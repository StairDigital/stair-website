/* ============================================================
   ColorBends (vanilla WebGL1 port of the React Bits component, which used three)
   - Single fullscreen-triangle fragment shader, no dependencies.
   - Targets [data-colorbends]. Only one instance is ever mounted on the
     capabilities page: it is re-parented into whichever panel is open, so the
     page never holds more than one GL context.
   - Exposes window.ColorBends.setColors([...hex]) so each capability can
     recolour the field to its own accent.
   - DPR capped at 1.5, pauses when hidden or scrolled out of view.
   ============================================================ */
(function () {
  "use strict";
  var MAX_COLORS = 4;

  var VERT =
    'attribute vec2 aPos;attribute vec2 aUv;varying vec2 vUv;' +
    'void main(){vUv=aUv;gl_Position=vec4(aPos,0.0,1.0);}';

  var FRAG =
    'precision highp float;\n' +
    '#define MAX_COLORS ' + MAX_COLORS + '\n' +
    'uniform vec2 uCanvas;uniform float uTime,uSpeed,uScale,uFrequency,uWarpStrength;' +
    'uniform float uMouseInfluence,uParallax,uNoise,uIntensity,uBandWidth;' +
    'uniform vec2 uRot,uPointer;uniform int uColorCount,uIterations;uniform vec3 uColors[MAX_COLORS];' +
    'varying vec2 vUv;\n' +
    'void main(){' +
    ' float t=uTime*uSpeed;' +
    ' vec2 p=vUv*2.0-1.0;' +
    ' p+=uPointer*uParallax*0.1;' +
    ' vec2 rp=vec2(p.x*uRot.x-p.y*uRot.y,p.x*uRot.y+p.y*uRot.x);' +
    ' vec2 q=vec2(rp.x*(uCanvas.x/uCanvas.y),rp.y);' +
    ' q/=max(uScale,0.0001);' +
    ' q/=0.5+0.2*dot(q,q);' +
    ' q+=0.2*cos(t)-7.56;' +
    ' q+=(uPointer-rp)*uMouseInfluence*0.2;' +
    ' for(int j=0;j<5;j++){' +
    '   if(j>=uIterations-1) break;' +
    '   vec2 rr=sin(1.5*(q.yx*uFrequency)+2.0*cos(q*uFrequency));' +
    '   q+=(rr-q)*0.15;' +
    ' }' +
    ' vec2 s=q;vec3 sumCol=vec3(0.0);float cover=0.0;' +
    ' for(int i=0;i<MAX_COLORS;++i){' +
    '   if(i>=uColorCount) break;' +
    '   s-=0.01;' +
    '   vec2 r=sin(1.5*(s.yx*uFrequency)+2.0*cos(s*uFrequency));' +
    '   float m0=length(r+sin(5.0*r.y*uFrequency-3.0*t+float(i))/4.0);' +
    '   float kBelow=clamp(uWarpStrength,0.0,1.0);' +
    '   float kMix=pow(kBelow,0.3);' +
    '   float gain=1.0+max(uWarpStrength-1.0,0.0);' +
    '   vec2 warped=s+((r-s)*kBelow)*gain;' +
    '   float m1=length(warped+sin(5.0*warped.y*uFrequency-3.0*t+float(i))/4.0);' +
    '   float m=mix(m0,m1,kMix);' +
    '   float w=1.0-exp(-uBandWidth/exp(uBandWidth*m));' +
    '   sumCol+=uColors[i]*w;' +
    '   cover=max(cover,w);' +
    ' }' +
    ' vec3 col=clamp(sumCol,0.0,1.0)*uIntensity;' +
    ' float a=cover;' +
    ' if(uNoise>0.0001){' +
    '   float n=fract(sin(dot(gl_FragCoord.xy+vec2(uTime),vec2(12.9898,78.233)))*43758.5453123);' +
    '   col=clamp(col+(n-0.5)*uNoise,0.0,1.0);' +
    ' }' +
    ' gl_FragColor=vec4(col*a,a);' +
    '}';

  function hexToRgb(h) {
    h = String(h || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return [1, 1, 1];
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }
  function num(el, attr, dflt) {
    var v = parseFloat(el.getAttribute(attr));
    return isNaN(v) ? dflt : v;
  }

  function init(host) {
    var gl, canvas;
    try {
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' })
        || canvas.getContext('experimental-webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
    } catch (e) { gl = null; }
    if (!gl) { host.classList.add('cb-fallback'); return null; }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { host.classList.add('cb-fallback'); return null; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.classList.add('cb-fallback'); return null; }
    gl.useProgram(prog);

    /* fullscreen triangle: interleaved position + uv */
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 3, -1, 2, 0, -1, 3, 0, 2]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos'), aUv = gl.getAttribLocation(prog, 'aUv');
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    var U = {};
    ['uCanvas', 'uTime', 'uSpeed', 'uScale', 'uFrequency', 'uWarpStrength', 'uMouseInfluence',
      'uParallax', 'uNoise', 'uIntensity', 'uBandWidth', 'uRot', 'uPointer', 'uColorCount',
      'uIterations', 'uColors'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    var opt = {
      speed: num(host, 'data-speed', 0.2),
      scale: num(host, 'data-scale', 1),
      frequency: num(host, 'data-frequency', 1),
      warp: num(host, 'data-warp', 1),
      mouse: num(host, 'data-mouse', 1),
      parallax: num(host, 'data-parallax', 0.5),
      noise: num(host, 'data-noise', 0.1),
      iterations: num(host, 'data-iterations', 1),
      intensity: num(host, 'data-intensity', 1.4),
      band: num(host, 'data-band', 6),
      rotation: num(host, 'data-rotation', 90),
      autoRotate: num(host, 'data-autorotate', 0)
    };

    gl.uniform1f(U.uSpeed, opt.speed);
    gl.uniform1f(U.uScale, opt.scale);
    gl.uniform1f(U.uFrequency, opt.frequency);
    gl.uniform1f(U.uWarpStrength, opt.warp);
    gl.uniform1f(U.uMouseInfluence, opt.mouse);
    gl.uniform1f(U.uParallax, opt.parallax);
    gl.uniform1f(U.uNoise, opt.noise);
    gl.uniform1f(U.uIntensity, opt.intensity);
    gl.uniform1f(U.uBandWidth, opt.band);
    gl.uniform1i(U.uIterations, Math.max(1, Math.round(opt.iterations)));

    var colors = [];
    function setColors(list) {
      colors = (list && list.length ? list : ['#0E9C93', '#5FC9BF', '#F0854B']).slice(0, MAX_COLORS);
      var flat = new Float32Array(MAX_COLORS * 3);
      for (var i = 0; i < MAX_COLORS; i++) {
        var c = hexToRgb(colors[Math.min(i, colors.length - 1)]);
        flat[i * 3] = c[0]; flat[i * 3 + 1] = c[1]; flat[i * 3 + 2] = c[2];
      }
      gl.useProgram(prog);
      gl.uniform3fv(U.uColors, flat);
      gl.uniform1i(U.uColorCount, colors.length);
    }
    var initial = (host.getAttribute('data-colors') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    setColors(initial);

    host.appendChild(canvas);

    var dpr = Math.min(window.devicePixelRatio || 1, window.FX.coarse ? 1 : 1.5);
    var vis = window.FX.watch(host);
    var w = 0, h = 0;
    function resize() {
      var nw = Math.max(1, Math.round(vis.w * dpr)), nh = Math.max(1, Math.round(vis.h * dpr));
      if (nw === w && nh === h) return;
      w = nw; h = nh; canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.useProgram(prog);
      gl.uniform2f(U.uCanvas, w, h);
    }

    /* eased pointer, read across the whole panel */
    var pt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    function onMove(e) {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pt.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pt.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    }
    window.addEventListener('pointermove', onMove, { passive: true });

    var running = false, t0 = 0, paused = false;
    function visible() { return !paused && vis.visible(); }
    function frame(ts) {
      if (!visible()) return;
      if (!t0) t0 = ts;
      var el = (ts - t0) * 0.001;
      if (vis.consumeResize()) resize();
      gl.useProgram(prog);
      gl.uniform1f(U.uTime, el);
      var deg = (opt.rotation % 360) + opt.autoRotate * el;
      var rad = deg * Math.PI / 180;
      gl.uniform2f(U.uRot, Math.cos(rad), Math.sin(rad));
      cur.x += (pt.x - cur.x) * 0.12;
      cur.y += (pt.y - cur.y) * 0.12;
      gl.uniform2f(U.uPointer, cur.x, cur.y);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function start() { if (!running) { running = true; window.FX.add(frame); } }

    resize();
    start();

    return {
      el: host,
      setColors: setColors,
      pause: function (p) { paused = !!p; },
      resize: resize
    };
  }

  var hosts = document.querySelectorAll('[data-colorbends]');
  var instances = [];
  for (var i = 0; i < hosts.length; i++) {
    var inst = init(hosts[i]);
    if (inst) instances.push(inst);
  }
  window.ColorBends = instances[0] || null;
  window.ColorBendsAll = instances;
})();
