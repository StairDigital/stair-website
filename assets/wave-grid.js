/* ============================================================
   Wave Grid Background — faithful vanilla port of the React
   WaveGridBackground component (Three.js + custom GLSL + post FX).

   Ported as written: 40x40 instanced cubes, mouse-trail wave
   displacement injected into the vertex shader, shadow-casting key
   light, and the vignette / RGB-shift post pass through
   EffectComposer. The only additions are (a) reading props from
   data-* attributes instead of React props and (b) skipping frames
   while the element is off screen, which costs nothing visually.

   Targets [data-wavegrid]. Requires the three importmap in the page.
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const MAX_TRAIL = 128;

const VIGNETTE_RGB_SHIFT_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    shiftAmount: { value: 0.005 },
    vignetteRadius: { value: 0.3 },
    vignetteSoftness: { value: 0.3 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float shiftAmount;
    uniform float vignetteRadius;
    uniform float vignetteSoftness;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5);
      float dist = distance(vUv, center);
      float horzQuadrant = sign(vUv.x - center.x);
      float vertQuadrant = sign(vUv.y - center.y);

      float vignetteFactor = smoothstep(vignetteRadius, vignetteRadius + vignetteSoftness, dist);
      float currentShift = shiftAmount * vignetteFactor;

      float r = texture2D(tDiffuse, vUv + vec2(currentShift * horzQuadrant, currentShift * vertQuadrant)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - vec2(currentShift * horzQuadrant, currentShift * vertQuadrant)).b;

      float darken = 1.0 - vignetteFactor * 0.5;
      gl_FragColor = vec4(vec3(r, g, b) * darken, 1.0);
    }
  `
};

/* injects the trail-driven wave displacement into a standard material's
   vertex shader; shared with the depth material so shadows deform too */
function overrideVertexShader(vertexShader) {
  return vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      varying float vHeight;
      attribute vec2 aOffset;
      uniform sampler2D uTrailTexture;
      uniform int       uTrailCount;
      uniform float     uWaveSpeed;
      uniform float     uWaveFreq;
      uniform float     uWaveWidth;
      uniform float     uFadeTime;
      uniform float     uAmplitude;
      uniform float     uJitter;
      uniform float     uMaxHeight;

      vec2 hash2( vec2 p ) {
        p = vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) );
        return fract( sin( p ) * 43758.5453123 ) - 0.5;
      }`
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>

      vHeight = 0.0;

      if ( position.y > 0.0 ) {
        vec2 jitter  = hash2( aOffset ) * uJitter;
        vec2 worldXZ = aOffset + jitter;
        float waveHeight  = 0.0;
        float totalWeight = 0.0;

        for ( int i = 0; i < 128; i++ ) {
          if ( i >= uTrailCount ) break;
          vec4 td = texture2D( uTrailTexture, vec2( ( float(i) + 0.5 ) / 128.0, 0.5 ) );
          float dist      = length( worldXZ - td.rg );
          float wavefront = uWaveSpeed * td.b;
          float relDist   = dist - wavefront;

          float window = exp( -( relDist * relDist ) / ( uWaveWidth * uWaveWidth ) );
          float fade   = exp( -td.b / uFadeTime );
          float atten  = 1.0 / ( 1.0 + dist * 0.1 );
          float weight = fade * window * atten * td.a;

          waveHeight  += weight * cos( uWaveFreq * relDist );
          totalWeight += weight;
        }

        waveHeight /= max( totalWeight, 1.0 );

        float displacement = clamp( waveHeight * uAmplitude, -uMaxHeight, uMaxHeight );
        transformed.y += displacement;
        vHeight = displacement;
      }`
    );
}

function attr(el, name, dflt) {
  const v = el.getAttribute(name);
  if (v === null) return dflt;
  const n = parseFloat(v);
  return isNaN(n) ? v : n;
}

function init(container) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const gridSize     = attr(container, 'data-grid', 40);
  const colorBase    = container.getAttribute('data-base') || '#232338';
  const colorHigh    = container.getAttribute('data-high') || '#FF7A3D';
  const waveAmplitude= attr(container, 'data-amplitude', 0.4);
  const waveSpeed    = attr(container, 'data-speed', 6.0);
  const waveFrequency= attr(container, 'data-frequency', 1.2);
  const waveWidth    = attr(container, 'data-width', 3.0);
  const waveMaxHeight= attr(container, 'data-maxheight', 0.4);
  const waveJitter   = attr(container, 'data-jitter', 0.2);
  const autoAnimate  = container.getAttribute('data-auto') !== 'false';
  const vignette     = container.getAttribute('data-vignette') !== 'false';
  /* optional explicit scene background (and clear colour); when absent we keep
     the reference behaviour of base*0.5, which a light base would turn grey */
  const sceneBg      = container.getAttribute('data-scenebg');
  /* the reference exposure (1.95) lifts a dark scene; on a light field it blows
     the colours to white, so let a light hero dial it down and keep the ripple */
  const exposure     = attr(container, 'data-exposure', 1.95);

  const cubeWidth = 0.8, cubeHeight = 3, gap = 0.01;
  const bounds = gridSize * (cubeWidth + gap);

  const getSize = () => ({
    width: container.clientWidth || 1,
    height: container.clientHeight || 1,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
  });
  let size = getSize();

  const scene = new THREE.Scene();
  scene.background = sceneBg ? new THREE.Color(sceneBg) : new THREE.Color(colorBase).multiplyScalar(0.5);

  /* camera orbits gently with the cursor */
  const radius = 12, alphaRange = Math.PI * 0.03, betaRange = Math.PI * 0.05;
  const mouse = new THREE.Vector2(0, 0);
  const lerpedMouse = new THREE.Vector2(0, 0);

  const camera = new THREE.PerspectiveCamera(40, size.width / size.height, 0.1, 200);
  const positionCamera = (mx, my) => {
    const alpha = my * alphaRange, beta = mx * betaRange;
    camera.position.set(
      -radius * Math.cos(alpha) * Math.sin(beta),
      radius * Math.cos(alpha) * Math.cos(beta),
      radius * Math.sin(alpha)
    );
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
  };
  positionCamera(0, 0);
  scene.add(camera);

  const onMouseMove = e => {
    mouse.x = (e.clientX / size.width) * 2 - 1;
    mouse.y = -(e.clientY / size.height) * 2 + 1;
  };
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  scene.add(new THREE.AmbientLight('#ffffff', 0.5));

  const keyLight = new THREE.DirectionalLight('#ffffff', 4.0);
  keyLight.position.set(-20, 10, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.radius = 6;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 60;
  keyLight.shadow.camera.left = -22;
  keyLight.shadow.camera.right = 22;
  keyLight.shadow.camera.top = 22;
  keyLight.shadow.camera.bottom = -22;
  keyLight.shadow.bias = 0.0001;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#ffffff', 1.0);
  fillLight.position.set(10, 5, -3);
  scene.add(fillLight);

  /* ---- mouse trail: world-space ripple sources ---- */
  const trailData = new Float32Array(MAX_TRAIL * 4);
  const trailTexture = new THREE.DataTexture(trailData, MAX_TRAIL, 1, THREE.RGBAFormat, THREE.FloatType);
  trailTexture.needsUpdate = true;

  const trailUniforms = {
    uTrailTexture: { value: trailTexture },
    uTrailCount: { value: 0 },
    uFadeTime: { value: 2.0 },
    uWaveSpeed: { value: waveSpeed },
    uWaveFreq: { value: waveFrequency },
    uWaveWidth: { value: waveWidth },
    uAmplitude: { value: waveAmplitude },
    uJitter: { value: waveJitter },
    uMaxHeight: { value: waveMaxHeight }
  };
  const colorUniforms = {
    uColorBase: { value: new THREE.Color(colorBase) },
    uColorHigh: { value: new THREE.Color(colorHigh) }
  };

  const trail = [];
  let lastPoint = null, timeSinceLastMove = 0, randomPointTimer = 0, placingRandom = true;
  const fadeTime = 2.0, trailSpacing = 0.1;

  const rayPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds, bounds),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, visible: false })
  );
  rayPlane.rotation.x = -Math.PI / 2;
  rayPlane.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let rect = canvas.getBoundingClientRect();

  const onPointerMove = e => {
    pointerNDC.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObject(rayPlane);
    if (hits.length === 0) return;
    const { x, z } = hits[0].point;

    let distDelta = 0;
    if (lastPoint) {
      const dx = x - lastPoint.x, dz = z - lastPoint.z;
      distDelta = Math.sqrt(dx * dx + dz * dz);
      if (distDelta < trailSpacing) return;
    }
    if (trail.length >= MAX_TRAIL) trail.shift();
    trail.push({ x, z, age: 0, distDelta });
    lastPoint = { x, z };
    timeSinceLastMove = 0;
    placingRandom = false;
    randomPointTimer = 0;
  };
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });

  const addRandomPoint = () => {
    const x = (Math.random() * 0.5 - 0.25) * bounds;
    const z = (Math.random() * 0.5 - 0.25) * bounds;
    const distDelta = 0.8 + Math.random() * 0.2;
    if (trail.length >= MAX_TRAIL) trail.shift();
    trail.push({ x, z, age: 0, distDelta });
  };

  const updateTrail = delta => {
    const expiry = fadeTime * 4;
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].age += delta;
      if (trail[i].age > expiry) trail.splice(i, 1);
    }
    timeSinceLastMove += delta;
    if (timeSinceLastMove >= 3.0 && !placingRandom && autoAnimate) {
      placingRandom = true; randomPointTimer = 0;
    }
    if (placingRandom && autoAnimate) {
      randomPointTimer += delta;
      if (randomPointTimer >= 1.5) { addRandomPoint(); randomPointTimer = 0; }
    }
    const count = Math.min(trail.length, MAX_TRAIL);
    if (count > 0 || trailUniforms.uTrailCount.value > 0) {
      for (let i = 0; i < count; i++) {
        const ti = i * 4;
        trailData[ti] = trail[i].x;
        trailData[ti + 1] = trail[i].z;
        trailData[ti + 2] = trail[i].age;
        trailData[ti + 3] = trail[i].distDelta;
      }
      trailTexture.needsUpdate = true;
      trailUniforms.uTrailCount.value = count;
    }
  };

  /* ---- instanced cube grid ---- */
  const count = gridSize * gridSize;
  const geometry = new THREE.BoxGeometry(cubeWidth, cubeHeight, cubeWidth);
  const offsetAttribute = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  geometry.setAttribute('aOffset', offsetAttribute);

  const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, trailUniforms, colorUniforms);
    shader.vertexShader = overrideVertexShader(shader.vertexShader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        `#include <common>
        varying float vHeight;
        uniform vec3  uColorBase;
        uniform vec3  uColorHigh;
        uniform float uMaxHeight;`)
      .replace('#include <color_fragment>',
        `#include <color_fragment>
        float t = clamp( vHeight / uMaxHeight, 0.0, 1.0 );
        diffuseColor.rgb = mix( uColorBase, uColorHigh, t );`);
  };

  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, trailUniforms);
    shader.vertexShader = overrideVertexShader(shader.vertexShader);
  };

  const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  instancedMesh.customDepthMaterial = depthMaterial;
  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;
  scene.add(instancedMesh);

  const dummy = new THREE.Object3D();
  const spacing = cubeWidth + gap;
  const offset = ((gridSize - 1) * spacing) / 2;
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const index = i * gridSize + j;
      const x = i * spacing - offset, z = j * spacing - offset;
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index, dummy.matrix);
      offsetAttribute.setXY(index, x, z);
    }
  }
  instancedMesh.instanceMatrix.needsUpdate = true;
  offsetAttribute.needsUpdate = true;

  /* ---- renderer + post ---- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(sceneBg || '#808080');
  renderer.setSize(size.width, size.height);
  renderer.setPixelRatio(size.pixelRatio);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (vignette) composer.addPass(new ShaderPass(VIGNETTE_RGB_SHIFT_SHADER));
  composer.addPass(new OutputPass());
  composer.setSize(size.width, size.height);
  composer.setPixelRatio(size.pixelRatio);

  const applySize = () => {
    size = getSize();
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(size.pixelRatio);
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(size.pixelRatio);
    rect = canvas.getBoundingClientRect();
  };
  new ResizeObserver(applySize).observe(container);
  window.addEventListener('resize', applySize);

  /* visibility gate: identical output, no work while off screen */
  const vis = window.FX ? window.FX.watch(container) : null;

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (vis && !vis.visible()) return;
    updateTrail(delta);
    lerpedMouse.x += (mouse.x - lerpedMouse.x) * 0.04;
    lerpedMouse.y += (mouse.y - lerpedMouse.y) * 0.04;
    positionCamera(lerpedMouse.x, lerpedMouse.y);
    composer.render();
  });
}

document.querySelectorAll('[data-wavegrid]').forEach(init);
