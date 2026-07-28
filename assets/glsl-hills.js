/* ============================================================
   GLSL Hills — layered ridgelines receding into a pale sky.
   Written from scratch (no source was available for the reference),
   so it is built the way the rest of this site's fields are:
   raw WebGL1, one fullscreen triangle, DPR capped at 1.5, paused
   when hidden or off-screen, graceful .hl-fallback if anything fails.

   Six noise-driven ridges are drawn back to front. Atmospheric
   perspective does the work: far ridges sit high and almost sky
   coloured, near ridges sit low and hold more teal, so the frame
   stays light enough for ink type to sit on top of it.
   Targets [data-hills].
   ============================================================ */
(function () {
  "use strict";

  var VERT =
    'attribute vec2 aPos;attribute vec2 aUv;varying vec2 vUv;' +
    'void main(){vUv=aUv;gl_Position=vec4(aPos,0.0,1.0);}';

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;',
    'uniform vec3 uSkyTop,uSkyLow,uHillFar,uHillNear,uSun;',
    'uniform float uSpeed,uAmp;',
    'varying vec2 vUv;',

    'float hash(float n){return fract(sin(n)*43758.5453123);}',
    'float vnoise(float x){',
    ' float i=floor(x),f=fract(x);',
    ' f=f*f*(3.0-2.0*f);',
    ' return mix(hash(i),hash(i+1.0),f);}',
    /* five octaves is plenty for a ridge silhouette */
    'float fbm(float x){',
    ' float v=0.0,a=0.5;',
    ' for(int i=0;i<5;i++){v+=a*vnoise(x);x*=2.0;a*=0.5;}',
    ' return v;}',

    'void main(){',
    ' vec2 uv=vUv;',
    ' float aspect=uRes.x/max(uRes.y,1.0);',

    /* sky: ivory overhead easing to a pale teal at the horizon */
    ' vec3 col=mix(uSkyLow,uSkyTop,pow(clamp(uv.y,0.0,1.0),0.75));',

    /* a low warm sun, drifting very slightly with the cursor */
    ' vec2 sunPos=vec2(0.76,0.60)+uMouse*0.025;',
    ' float sd=length((uv-sunPos)*vec2(aspect,1.0));',
    ' col+=uSun*exp(-sd*sd/0.05)*0.42;',
    ' col+=uSun*exp(-sd*sd/0.55)*0.14;',

    /* ridges, far to near */
    ' for(int i=0;i<6;i++){',
    '  float fi=float(i);',
    '  float depth=fi/5.0;',                       /* 0 far, 1 near */
    '  float speed=(0.008+depth*0.030)*uSpeed;',
    '  float freq=1.15+fi*0.85;',
    '  float amp=(0.030+depth*0.085)*uAmp;',
    '  float base=0.56-depth*0.30;',               /* far ridges ride higher */
    '  float x=uv.x*aspect*freq+uTime*speed+fi*17.3+uMouse.x*depth*0.10;',
    '  float h=base+(fbm(x)-0.5)*2.0*amp;',
    /*  1 below the ridge line, 0 above it */
    '  float fill=1.0-smoothstep(h-0.0025,h+0.0025,uv.y);',
    '  vec3 hc=mix(uHillFar,uHillNear,depth);',
    /*  catch a little sun along the crest */
    '  float rim=smoothstep(h-0.010,h,uv.y)*smoothstep(h+0.010,h,uv.y);',
    '  hc+=uSun*rim*0.30*(0.35+depth);',
    '  col=mix(col,hc,fill);',
    ' }',

    /* a whisper of grain so the gradients never band */
    ' float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);',
    ' col+=(g-0.5)*0.012;',

    ' gl_FragColor=vec4(col,1.0);}'
  ].join('\n');

  function hexRgb(h, d) {
    h = String(h || '').replace('#', '').trim();
    if (h.length !== 6) return d;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }
  function num(el, a, d) { var v = parseFloat(el.getAttribute(a)); return isNaN(v) ? d : v; }

  function init(host) {
    var canvas, gl;
    try {
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
        || canvas.getContext('experimental-webgl', { antialias: false, alpha: false });
    } catch (e) { gl = null; }
    if (!gl) { host.classList.add('hl-fallback'); return; }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { host.classList.add('hl-fallback'); return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.classList.add('hl-fallback'); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 3, -1, 2, 0, -1, 3, 0, 2]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos'), aUv = gl.getAttribLocation(prog, 'aUv');
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    var U = {};
    ['uRes', 'uTime', 'uMouse', 'uSkyTop', 'uSkyLow', 'uHillFar', 'uHillNear', 'uSun', 'uSpeed', 'uAmp']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    gl.uniform3fv(U.uSkyTop, hexRgb(host.getAttribute('data-skytop'), [0.980, 0.973, 0.953]));
    gl.uniform3fv(U.uSkyLow, hexRgb(host.getAttribute('data-skylow'), [0.914, 0.957, 0.945]));
    gl.uniform3fv(U.uHillFar, hexRgb(host.getAttribute('data-hillfar'), [0.863, 0.929, 0.914]));
    gl.uniform3fv(U.uHillNear, hexRgb(host.getAttribute('data-hillnear'), [0.525, 0.773, 0.737]));
    gl.uniform3fv(U.uSun, hexRgb(host.getAttribute('data-sun'), [0.941, 0.522, 0.294]));
    gl.uniform1f(U.uSpeed, num(host, 'data-speed', 1));
    gl.uniform1f(U.uAmp, num(host, 'data-amp', 1));

    host.appendChild(canvas);

    var _coarse = !(window.matchMedia && window.matchMedia('(pointer:fine)').matches);
    var dpr = Math.min(window.devicePixelRatio || 1, _coarse ? 1 : 1.5);
    var vis = window.FX.watch(host);
    var w = 0, h = 0;
    function resize() {
      var nw = Math.max(1, Math.round(vis.w * dpr)), nh = Math.max(1, Math.round(vis.h * dpr));
      if (nw === w && nh === h) return;
      w = nw; h = nh; canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.useProgram(prog);
      gl.uniform2f(U.uRes, w, h);
    }
    var pt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    /* one rect read per pointer event rather than one per frame */
    window.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pt.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pt.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    }, { passive: true });

    var t0 = 0;
    function frame(ts) {
      if (!vis.visible()) return;
      if (!t0) t0 = ts;
      if (vis.consumeResize()) resize();
      gl.useProgram(prog);
      gl.uniform1f(U.uTime, (ts - t0) * 0.001);
      cur.x += (pt.x - cur.x) * 0.06;
      cur.y += (pt.y - cur.y) * 0.06;
      gl.uniform2f(U.uMouse, cur.x, cur.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    resize();
    window.FX.add(frame);
  }

  document.querySelectorAll('[data-hills]').forEach(init);
})();
