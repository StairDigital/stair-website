/* ============================================================
   Animated Gradient — vanilla port of the React AnimatedGradient
   component. WebGL2 fragment shader carried over verbatim (swirl
   iterations, domain distortion, Checks/Stripes/Edge shapes,
   three-colour blend). Presets kept as written; a "custom" config
   is expressed through data-* attributes instead of props.

   Targets [data-animgrad]. Falls back to a CSS gradient via
   .ag-fallback if WebGL2 is unavailable, mirroring the component's
   WebGLFallback path.
   ============================================================ */
(function () {
  "use strict";

  var SHAPES = { Checks: 0, Stripes: 1, Edge: 2 };

  var PRESETS = {
    Aurora:  { color1:"#0a001a", color2:"#1a0b2e", color3:"#f20089", rotation:-45, proportion:60, scale:0.6, speed:15, distortion:40, swirl:80,  swirlIterations:10, softness:100, offset:200,  shape:"Edge",    shapeSize:50 },
    Oceanic: { color1:"#000814", color2:"#001d3d", color3:"#00b4d8", rotation:0,   proportion:70, scale:0.4, speed:10, distortion:15, swirl:50,  swirlIterations:12, softness:80,  offset:150,  shape:"Checks",  shapeSize:30 },
    Amber:   { color1:"#140c00", color2:"#4a2500", color3:"#f57c00", rotation:120, proportion:80, scale:0.8, speed:20, distortion:25, swirl:60,  swirlIterations:8,  softness:90,  offset:500,  shape:"Stripes", shapeSize:40 },
    Toxic:   { color1:"#050d05", color2:"#0a240a", color3:"#39ff14", rotation:-90, proportion:55, scale:0.5, speed:25, distortion:60, swirl:100, swirlIterations:15, softness:70,  offset:-100, shape:"Edge",    shapeSize:20 },
    Ghost:   { color1:"#0a0a0a", color2:"#1c1c1c", color3:"#a3a3a3", rotation:45,  proportion:50, scale:0.3, speed:8,  distortion:10, swirl:30,  swirlIterations:5,  softness:100, offset:0,    shape:"Checks",  shapeSize:60 }
  };

  var VERT = '#version 300 es\nin vec4 a_position;\nvoid main(){ gl_Position = a_position; }';

  var FRAG = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}
vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;
    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);
    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);
    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float t = .5 * u_time;
    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv /= u_pixelRatio;
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);
    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * u_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);
    fragColor = vec4(color_mix.rgb, color_mix.a);
}`;

  function hexToRgba(hex) {
    var r = 0, g = 0, b = 0, a = 1;
    hex = String(hex || '').trim();
    if (hex.charAt(0) === '#') {
      var c = hex.slice(1);
      if (c.length === 3) {
        r = parseInt(c[0] + c[0], 16) / 255;
        g = parseInt(c[1] + c[1], 16) / 255;
        b = parseInt(c[2] + c[2], 16) / 255;
      } else if (c.length >= 6) {
        r = parseInt(c.slice(0, 2), 16) / 255;
        g = parseInt(c.slice(2, 4), 16) / 255;
        b = parseInt(c.slice(4, 6), 16) / 255;
        if (c.length === 8) a = parseInt(c.slice(6, 8), 16) / 255;
      }
    }
    return [r, g, b, a];
  }

  function num(el, attr, dflt) {
    var v = parseFloat(el.getAttribute(attr));
    return isNaN(v) ? dflt : v;
  }

  function init(host) {
    /* preset, then any data-* overrides on top (the "custom" path) */
    var presetName = host.getAttribute('data-preset') || 'Aurora';
    var base = PRESETS[presetName] || PRESETS.Aurora;
    var p = {
      color1: host.getAttribute('data-color1') || base.color1,
      color2: host.getAttribute('data-color2') || base.color2,
      color3: host.getAttribute('data-color3') || base.color3,
      rotation: num(host, 'data-rotation', base.rotation),
      proportion: num(host, 'data-proportion', base.proportion),
      scale: num(host, 'data-scale', base.scale),
      speed: num(host, 'data-speed', base.speed),
      distortion: num(host, 'data-distortion', base.distortion),
      swirl: num(host, 'data-swirl', base.swirl),
      swirlIterations: num(host, 'data-swirliterations', base.swirlIterations),
      softness: num(host, 'data-softness', base.softness),
      offset: num(host, 'data-offset', base.offset),
      shape: host.getAttribute('data-shape') || base.shape,
      shapeSize: num(host, 'data-shapesize', base.shapeSize)
    };

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%';

    var gl;
    try {
      gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true });
    } catch (e) { gl = null; }
    if (!gl) { host.classList.add('ag-fallback'); return; }

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
      return s;
    }
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { host.classList.add('ag-fallback'); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.classList.add('ag-fallback'); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['u_time','u_resolution','u_pixelRatio','u_scale','u_rotation','u_color1','u_color2','u_color3',
     'u_proportion','u_softness','u_shape','u_shapeScale','u_distortion','u_swirl','u_swirlIterations']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    host.appendChild(canvas);

    var vis = window.FX ? window.FX.watch(host) : null;
    var dpr = Math.min(window.devicePixelRatio || 1, window.FX && window.FX.coarse ? 1 : 1.5);
    var w = 0, h = 0;
    function resize() {
      var cw = vis ? vis.w : host.clientWidth;
      var ch = vis ? vis.h : host.clientHeight;
      var nw = Math.max(1, Math.round(cw * dpr)), nh = Math.max(1, Math.round(ch * dpr));
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    if (!vis) {
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
      else window.addEventListener('resize', resize);
    }
    resize();

    var t0 = 0;
    var c1 = hexToRgba(p.color1), c2 = hexToRgba(p.color2), c3 = hexToRgba(p.color3);

    function frame(ts) {
      if (vis) { if (!vis.visible()) return; if (vis.consumeResize()) resize(); }
      if (!t0) t0 = ts;
      var elapsed = (ts - t0) / 1000;
      var speed = (p.speed / 100) * 5;

      gl.useProgram(prog);
      gl.uniform1f(U.u_time, elapsed * speed + p.offset * 0.01);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(U.u_pixelRatio, dpr);
      gl.uniform1f(U.u_scale, p.scale);
      gl.uniform1f(U.u_rotation, (p.rotation * Math.PI) / 180);
      gl.uniform4f(U.u_color1, c1[0], c1[1], c1[2], c1[3]);
      gl.uniform4f(U.u_color2, c2[0], c2[1], c2[2], c2[3]);
      gl.uniform4f(U.u_color3, c3[0], c3[1], c3[2], c3[3]);
      gl.uniform1f(U.u_proportion, p.proportion / 100);
      gl.uniform1f(U.u_softness, p.softness / 100);
      gl.uniform1f(U.u_shape, SHAPES[p.shape] !== undefined ? SHAPES[p.shape] : 0);
      gl.uniform1f(U.u_shapeScale, p.shapeSize / 100);
      gl.uniform1f(U.u_distortion, p.distortion / 50);
      gl.uniform1f(U.u_swirl, p.swirl / 100);
      gl.uniform1f(U.u_swirlIterations, p.swirl === 0 ? 0 : p.swirlIterations);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (window.FX) window.FX.add(frame);
    else (function loop(ts) { frame(ts); requestAnimationFrame(loop); })(0);
  }

  document.querySelectorAll('[data-animgrad]').forEach(init);
})();
