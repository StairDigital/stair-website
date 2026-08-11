/* Dither Prism field — WebGL2 fullscreen shader.
   Ported from componentry.dev's DitherPrismHero (React Three Fiber) to vanilla JS:
   same GLSL (fbm noise, 8x8 Bayer + blue-noise dithering, prismatic refraction,
   holographic iridescence, morphing crystal shapes, vignette), rendered on a
   fullscreen quad instead of an R3F plane. Floating particles layer omitted.
   Colours mapped to the STAIR palette; mouse follows the cursor per container. */
(function(){
  "use strict";
  var containers = Array.prototype.slice.call(document.querySelectorAll('[data-prism]'));
  if(!containers.length) return;

  /* deep -> mid -> light, brand palette (reference used indigo/pink on near-black) */
  var COLOR1 = [0.071, 0.235, 0.224];   /* #123C39 deep ink-teal */
  var COLOR2 = [0.055, 0.612, 0.576];   /* #0E9C93 teal          */
  var COLOR3 = [0.980, 0.973, 0.953];   /* #FAF8F3 ivory         */
  var SPEED = 0.55;            /* slow + composed, not frantic */
  var DITHER_INTENSITY = 0.12; /* the signature grain */
  var PRISM_INTENSITY = 0.22;  /* rainbow refraction kept restrained for the brand */
  var MOUSE_INTENSITY = 0.28;  /* subtle cursor bloom */

  var VERT =
'#version 300 es\n' +
'in vec2 a_position;\n' +
'out vec2 vUv;\n' +
'void main(){ vUv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }';

  var FRAG =
'#version 300 es\n' +
'precision highp float;\n' +
'uniform float uTime;\n' +
'uniform vec2 uResolution;\n' +
'uniform vec2 uMouse;\n' +
'uniform float uMouseIntensity;\n' +
'uniform vec3 uColor1;\n' +
'uniform vec3 uColor2;\n' +
'uniform vec3 uColor3;\n' +
'uniform float uDitherIntensity;\n' +
'uniform float uPrismIntensity;\n' +
'in vec2 vUv;\n' +
'out vec4 fragColor;\n' +
'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
'vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }\n' +
'float snoise(vec2 v){\n' +
'  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);\n' +
'  vec2 i  = floor(v + dot(v, C.yy));\n' +
'  vec2 x0 = v - i + dot(i, C.xx);\n' +
'  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n' +
'  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;\n' +
'  i = mod(i, 289.0);\n' +
'  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));\n' +
'  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);\n' +
'  m = m*m; m = m*m;\n' +
'  vec3 x = 2.0 * fract(p * C.www) - 1.0;\n' +
'  vec3 h = abs(x) - 0.5;\n' +
'  vec3 ox = floor(x + 0.5);\n' +
'  vec3 a0 = x - ox;\n' +
'  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);\n' +
'  vec3 g;\n' +
'  g.x  = a0.x  * x0.x  + h.x  * x0.y;\n' +
'  g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n' +
'  return 130.0 * dot(m, g);\n' +
'}\n' +
'float fbm(vec2 p, int octaves){\n' +
'  float value = 0.0; float amplitude = 0.5; float frequency = 1.0;\n' +
'  for (int i = 0; i < 6; i++){\n' +
'    if (i >= octaves) break;\n' +
'    value += amplitude * snoise(p * frequency);\n' +
'    frequency *= 2.0; amplitude *= 0.5;\n' +
'  }\n' +
'  return value;\n' +
'}\n' +
/* 8x8 Bayer ordered-dither threshold matrix (verbatim from the reference) */
'const int bayerMat[64] = int[64](\n' +
'   0, 32,  8, 40,  2, 34, 10, 42,\n' +
'  48, 16, 56, 24, 50, 18, 58, 26,\n' +
'  12, 44,  4, 36, 14, 46,  6, 38,\n' +
'  60, 28, 52, 20, 62, 30, 54, 22,\n' +
'   3, 35, 11, 43,  1, 33,  9, 41,\n' +
'  51, 19, 59, 27, 49, 17, 57, 25,\n' +
'  15, 47,  7, 39, 13, 45,  5, 37,\n' +
'  63, 31, 55, 23, 61, 29, 53, 21);\n' +
'float bayer8x8(vec2 uv){\n' +
'  ivec2 p = ivec2(mod(uv, 8.0));\n' +
'  return float(bayerMat[p.y * 8 + p.x]) / 64.0;\n' +
'}\n' +
'float blueNoise(vec2 uv, float time){\n' +
'  float n1 = hash(uv + vec2(time * 0.1, 0.0));\n' +
'  float n2 = hash(uv * 2.1 + vec2(0.0, time * 0.13));\n' +
'  float n3 = hash(uv * 4.3 + vec2(time * 0.07, time * 0.11));\n' +
'  return fract(n1 + n2 * 0.5 + n3 * 0.25);\n' +
'}\n' +
'vec3 prism(vec2 uv, float time, float intensity){\n' +
'  float angle = atan(uv.y - 0.5, uv.x - 0.5);\n' +
'  float dist = length(uv - 0.5);\n' +
'  float prismAngle = angle + time * 0.3 + dist * 3.0;\n' +
'  float r = 0.5 + 0.5 * sin(prismAngle);\n' +
'  float g = 0.5 + 0.5 * sin(prismAngle + 2.094);\n' +
'  float b = 0.5 + 0.5 * sin(prismAngle + 4.188);\n' +
'  return vec3(r, g, b) * intensity;\n' +
'}\n' +
'vec3 iridescence(vec2 uv, float time){\n' +
'  float t = time * 0.5; vec2 p = uv * 3.0;\n' +
'  float n1 = snoise(p + vec2(t, 0.0));\n' +
'  float n2 = snoise(p * 1.3 + vec2(0.0, t * 0.7));\n' +
'  float n3 = snoise(p * 0.7 + vec2(t * 0.5, t * 0.3));\n' +
'  vec3 col1 = vec3(0.5 + 0.5 * sin(n1 * 3.14159 + t));\n' +
'  vec3 col2 = vec3(0.5 + 0.5 * sin(n2 * 3.14159 + t * 1.3 + 2.0));\n' +
'  vec3 col3 = vec3(0.5 + 0.5 * sin(n3 * 3.14159 + t * 0.7 + 4.0));\n' +
'  return (col1 + col2 + col3) / 3.0;\n' +
'}\n' +
'float diamond(vec2 p){ return abs(p.x) + abs(p.y); }\n' +
'float morphShape(vec2 uv, float time){\n' +
'  float morph = sin(time * 0.4) * 0.5 + 0.5;\n' +
'  vec2 p = uv * 4.0 - 2.0;\n' +
'  p = p + vec2(sin(time * 0.3), cos(time * 0.4)) * 0.5;\n' +
'  float circle = length(p) - 1.0;\n' +
'  float diam = diamond(p) - 1.4;\n' +
'  float shape = mix(circle, diam, morph);\n' +
'  vec2 q = mod(uv * 8.0, 2.0) - 1.0;\n' +
'  float multiShape = mix(length(q), diamond(q), morph) - 0.3;\n' +
'  return min(shape, multiShape);\n' +
'}\n' +
'float mouseRipple(vec2 uv, vec2 mouse, float time, float intensity){\n' +
'  float dist = length(uv - mouse);\n' +
'  float ripple1 = sin(dist * 40.0 - time * 5.0) * exp(-dist * 3.0);\n' +
'  float ripple2 = sin(dist * 25.0 - time * 3.5 + 1.0) * exp(-dist * 4.0);\n' +
'  float ripple3 = sin(dist * 60.0 - time * 7.0) * exp(-dist * 5.0);\n' +
'  return (ripple1 + ripple2 * 0.5 + ripple3 * 0.3) * intensity;\n' +
'}\n' +
'vec3 mouseGlow(vec2 uv, vec2 mouse, float time, float intensity, vec3 glowColor){\n' +
'  float dist = length(uv - mouse);\n' +
'  float core = exp(-dist * 15.0) * 1.5;\n' +
'  float outer = exp(-dist * 5.0) * 0.8;\n' +
'  float pulse = 0.8 + 0.2 * sin(time * 3.0);\n' +
'  float chromatic = sin(dist * 30.0 + time * 2.0) * exp(-dist * 8.0);\n' +
'  vec3 rainbow = vec3(sin(time * 2.0) * 0.5 + 0.5, sin(time * 2.0 + 2.094) * 0.5 + 0.5, sin(time * 2.0 + 4.188) * 0.5 + 0.5);\n' +
'  vec3 glow = glowColor * (core + outer) * pulse * intensity;\n' +
'  glow += rainbow * chromatic * intensity * 0.5;\n' +
'  return glow;\n' +
'}\n' +
'vec2 mouseLensDistort(vec2 uv, vec2 mouse, float intensity){\n' +
'  vec2 delta = uv - mouse;\n' +
'  float dist = length(delta);\n' +
'  float distortion = exp(-dist * 6.0) * intensity * 0.15;\n' +
'  return uv + normalize(delta + 0.001) * distortion;\n' +
'}\n' +
'void main(){\n' +
'  vec2 uv = vUv;\n' +
'  vec2 pixelCoord = gl_FragCoord.xy;\n' +
'  float time = uTime;\n' +
'  vec2 distortedUv = mouseLensDistort(uv, uMouse, uMouseIntensity);\n' +
'  float noise1 = fbm(distortedUv * 2.0 + vec2(time * 0.05, time * 0.03), 4);\n' +
'  float noise2 = fbm(distortedUv * 3.0 + vec2(-time * 0.04, time * 0.06), 3);\n' +
'  float diagonal = (distortedUv.x + distortedUv.y) * 0.5;\n' +
'  float flow = diagonal + noise1 * 0.3 + noise2 * 0.2;\n' +
'  flow += sin(time * 0.2) * 0.1;\n' +
'  vec3 col;\n' +
'  float t1 = smoothstep(0.0, 0.5, flow);\n' +
'  float t2 = smoothstep(0.5, 1.0, flow);\n' +
'  col = mix(uColor1, uColor2, t1);\n' +
'  col = mix(col, uColor3, t2);\n' +
'  vec3 prismColor = prism(distortedUv, time, uPrismIntensity);\n' +
'  float edgeMask = abs(fract(flow * 5.0) - 0.5) * 2.0;\n' +
'  edgeMask = smoothstep(0.3, 0.7, edgeMask);\n' +
'  col += prismColor * edgeMask * 0.4;\n' +
'  vec3 iris = iridescence(distortedUv, time);\n' +
'  float irisMask = snoise(distortedUv * 5.0 + time * 0.1);\n' +
'  irisMask = smoothstep(-0.2, 0.8, irisMask) * 0.15;\n' +
'  col = mix(col, iris, irisMask);\n' +
'  float shape = morphShape(distortedUv, time);\n' +
'  float shapeMask = 1.0 - smoothstep(-0.1, 0.1, shape);\n' +
'  col = mix(col, col * 1.15 + vec3(0.08), shapeMask * 0.3);\n' +
'  float ripple = mouseRipple(uv, uMouse, time, uMouseIntensity);\n' +
'  col += ripple * prismColor * 1.2;\n' +
'  col += ripple * vec3(0.3, 0.2, 0.4);\n' +
'  vec3 glow = mouseGlow(uv, uMouse, time, uMouseIntensity, vec3(1.0, 0.95, 0.9));\n' +
'  col += glow;\n' +
'  float mouseDist = length(uv - uMouse);\n' +
'  float proximityBoost = exp(-mouseDist * 4.0) * uMouseIntensity;\n' +
'  col = mix(col, col * 1.5 + prismColor * 0.3, proximityBoost);\n' +
'  float bayer = bayer8x8(pixelCoord);\n' +
'  float blue = blueNoise(pixelCoord * 0.1, time);\n' +
'  float ditherPattern = mix(bayer, blue, 0.3 + 0.2 * sin(time * 0.5));\n' +
'  vec3 ditherOffset = (vec3(ditherPattern) - 0.5) * uDitherIntensity;\n' +
'  col += ditherOffset;\n' +
'  float levels = 16.0;\n' +
'  vec3 quantized = floor(col * levels + ditherPattern) / levels;\n' +
'  col = mix(col, quantized, uDitherIntensity * 0.5);\n' +
'  float scanline = sin(pixelCoord.y * 2.0 + time * 2.0) * 0.02;\n' +
'  col += scanline * uDitherIntensity;\n' +
'  float vignette = 1.0 - length((uv - 0.5) * 1.2);\n' +
'  vignette = smoothstep(0.0, 0.7, vignette);\n' +
'  col *= 0.85 + vignette * 0.15;\n' +
'  col = clamp(col, 0.0, 1.0);\n' +
'  fragColor = vec4(col, 1.0);\n' +
'}';

  function initPrism(container){
    function fail(){ container.classList.add('prism-fallback'); }

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden','true');
    container.insertBefore(canvas, container.firstChild);

    var gl = canvas.getContext('webgl2', {premultipliedAlpha:true, alpha:true, antialias:false});
    if(!gl){ canvas.remove(); fail(); return; }

    function compile(type, src){
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){ gl.deleteShader(sh); return null; }
      return sh;
    }
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if(!vs || !fs){ canvas.remove(); fail(); return; }

    var program = gl.createProgram();
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){ canvas.remove(); fail(); return; }
    gl.useProgram(program);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    var posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    function u(n){ return gl.getUniformLocation(program, n); }
    var U = {
      time:u('uTime'), resolution:u('uResolution'), mouse:u('uMouse'),
      mouseIntensity:u('uMouseIntensity'), color1:u('uColor1'), color2:u('uColor2'),
      color3:u('uColor3'), dither:u('uDitherIntensity'), prism:u('uPrismIntensity')
    };
    gl.uniform3fv(U.color1, COLOR1);
    gl.uniform3fv(U.color2, COLOR2);
    gl.uniform3fv(U.color3, COLOR3);
    gl.uniform1f(U.dither, DITHER_INTENSITY);
    gl.uniform1f(U.prism, PRISM_INTENSITY);
    gl.uniform1f(U.mouseIntensity, container.getAttribute('data-mouse') === 'false' ? 0 : MOUSE_INTENSITY);

    var vis = window.FX.watch(container, {
      /* the menu canvas is laid out even while the drawer is closed, and
         IntersectionObserver cannot see visibility:hidden, so gate on the class */
      gate: function(){ var d = container.closest('.drawer'); return !d || d.classList.contains('open'); }
    });
    function resize(){
      var pr = Math.min(window.devicePixelRatio || 1, window.FX.coarse ? 1 : 1.5);
      canvas.width = Math.max(1, Math.round(container.clientWidth * pr));
      canvas.height = Math.max(1, Math.round(container.clientHeight * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    if('ResizeObserver' in window){ new ResizeObserver(resize).observe(container); }
    else { window.addEventListener('resize', resize); }

    /* cursor drives the lens/glow; eased so it never snaps.
       data-mouse="false" opts an instance out entirely (no glow, no listener) */
    var mouseOn = container.getAttribute('data-mouse') !== 'false';
    var mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
    if (mouseOn) {
      container.closest('section, .drawer, body').addEventListener('mousemove', function(e){
        var r = container.getBoundingClientRect();
        if(!r.width || !r.height) return;
        tmx = (e.clientX - r.left) / r.width;
        tmy = 1 - (e.clientY - r.top) / r.height;   /* gl uv origin is bottom-left */
      }, {passive:true});
    }

    var startedAt = performance.now();
    var reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var raf;

    function render(time){
      var elapsed = (time - startedAt) / 1000;
      mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
      gl.uniform1f(U.time, elapsed * SPEED);
      gl.uniform2f(U.resolution, canvas.width, canvas.height);
      gl.uniform2f(U.mouse, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    /* getComputedStyle per frame forced a style recalc every frame on every
       page; visibility now comes from the cached observer + class gate */
    function loop(time){ if(vis.visible()) render(time); }
    render(performance.now());            /* paint at once, no blank first frame */
    if(!reduceMotion) window.FX.add(loop);
  }

  containers.forEach(initPrism);
})();
