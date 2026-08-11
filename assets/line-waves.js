/* LineWaves — animated warped line field.
   Ported from React Bits' LineWaves (ogl) to raw WebGL: same GLSL fragment
   shader on a fullscreen triangle. Targets [data-linewaves] containers.
   Colours default to the STAIR palette; cursor-reactive; DPR-capped and
   paused when off-screen for smoothness. */
(function(){
  "use strict";
  var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-linewaves]'));
  if(!nodes.length) return;

  function hexToVec3(hex){
    var h = (hex||'#ffffff').replace('#','');
    if(h.length===3){ h = h.split('').map(function(c){return c+c;}).join(''); }
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
  }

  var VERT =
'attribute vec2 position;\nattribute vec2 uv;\nvarying vec2 vUv;\n' +
'void main(){ vUv=uv; gl_Position=vec4(position,0.,1.); }';

  var FRAG =
'precision highp float;\n' +
'uniform float uTime; uniform vec3 uResolution; uniform float uSpeed;\n' +
'uniform float uInnerLines; uniform float uOuterLines; uniform float uWarpIntensity;\n' +
'uniform float uRotation; uniform float uEdgeFadeWidth; uniform float uColorCycleSpeed;\n' +
'uniform float uBrightness; uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uColor3;\n' +
'uniform vec2 uMouse; uniform float uMouseInfluence; uniform bool uEnableMouse;\n' +
'#define HALF_PI 1.5707963\n' +
'float hashF(float n){ return fract(sin(n*127.1)*43758.5453123); }\n' +
'float smoothNoise(float x){ float i=floor(x); float f=fract(x); float u=f*f*(3.0-2.0*f); return mix(hashF(i),hashF(i+1.0),u); }\n' +
'float displaceA(float coord,float t){ float r=sin(coord*2.123)*0.2; r+=sin(coord*3.234+t*4.345)*0.1; r+=sin(coord*0.589+t*0.934)*0.5; return r; }\n' +
'float displaceB(float coord,float t){ float r=sin(coord*1.345)*0.3; r+=sin(coord*2.734+t*3.345)*0.2; r+=sin(coord*0.189+t*0.934)*0.3; return r; }\n' +
'vec2 rotate2D(vec2 p,float a){ float c=cos(a); float s=sin(a); return vec2(p.x*c-p.y*s,p.x*s+p.y*c); }\n' +
'void main(){\n' +
'  vec2 coords=gl_FragCoord.xy/uResolution.xy; coords=coords*2.0-1.0; coords=rotate2D(coords,uRotation);\n' +
'  float halfT=uTime*uSpeed*0.5; float fullT=uTime*uSpeed;\n' +
'  float mouseWarp=0.0;\n' +
'  if(uEnableMouse){ vec2 mPos=rotate2D(uMouse*2.0-1.0,uRotation); float mDist=length(coords-mPos); mouseWarp=uMouseInfluence*exp(-mDist*mDist*4.0); }\n' +
'  float warpAx=coords.x+displaceA(coords.y,halfT)*uWarpIntensity+mouseWarp;\n' +
'  float warpAy=coords.y-displaceA(coords.x*cos(fullT)*1.235,halfT)*uWarpIntensity;\n' +
'  float warpBx=coords.x+displaceB(coords.y,halfT)*uWarpIntensity+mouseWarp;\n' +
'  float warpBy=coords.y-displaceB(coords.x*sin(fullT)*1.235,halfT)*uWarpIntensity;\n' +
'  vec2 fieldA=vec2(warpAx,warpAy); vec2 fieldB=vec2(warpBx,warpBy);\n' +
'  vec2 blended=mix(fieldA,fieldB,mix(fieldA,fieldB,0.5));\n' +
'  float fadeTop=smoothstep(uEdgeFadeWidth,uEdgeFadeWidth+0.4,blended.y);\n' +
'  float fadeBottom=smoothstep(-uEdgeFadeWidth,-(uEdgeFadeWidth+0.4),blended.y);\n' +
'  float vMask=1.0-max(fadeTop,fadeBottom);\n' +
'  float tileCount=mix(uOuterLines,uInnerLines,vMask);\n' +
'  float scaledY=blended.y*tileCount; float nY=smoothNoise(abs(scaledY));\n' +
'  float ridge=pow(step(abs(nY-blended.x)*2.0,HALF_PI)*cos(2.0*(nY-blended.x)),5.0);\n' +
'  float lines=0.0;\n' +
'  for(float i=1.0;i<3.0;i+=1.0){ lines+=pow(max(fract(scaledY),fract(-scaledY)),i*2.0); }\n' +
'  float pattern=vMask*lines;\n' +
'  float cycleT=fullT*uColorCycleSpeed;\n' +
'  float rChannel=(pattern+lines*ridge)*(cos(blended.y+cycleT*0.234)*0.5+1.0);\n' +
'  float gChannel=(pattern+vMask*ridge)*(sin(blended.x+cycleT*1.745)*0.5+1.0);\n' +
'  float bChannel=(pattern+lines*ridge)*(cos(blended.x+cycleT*0.534)*0.5+1.0);\n' +
'  vec3 col=(rChannel*uColor1+gChannel*uColor2+bChannel*uColor3)*uBrightness;\n' +
'  float alpha=clamp(length(col),0.0,1.0);\n' +
'  gl_FragColor=vec4(col,alpha);\n' +
'}';

  nodes.forEach(function(container){
    var d = container.dataset;
    var P = {
      speed: +(d.speed||0.3), inner: +(d.inner||32), outer: +(d.outer||36),
      warp: +(d.warp||1.0), rotation: (+(d.rotation||-45))*Math.PI/180,
      edgeFade: +(d.edgefade||0.0), cycle: +(d.cycle||0.6), brightness: +(d.brightness||0.62),
      c1: hexToVec3(d.color1||'#0E9C93'), c2: hexToVec3(d.color2||'#5FC9BF'), c3: hexToVec3(d.color3||'#F0854B'),
      mouseInf: +(d.mouse||2.0), enableMouse: d.nomouse!=='true'
    };

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(canvas);
    var gl = canvas.getContext('webgl', {alpha:true, premultipliedAlpha:false, antialias:true});
    if(!gl){ canvas.remove(); container.classList.add('lw-fallback'); return; }
    gl.clearColor(0,0,0,0);

    function compile(type, src){ var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ gl.deleteShader(s); return null; } return s; }
    var vs=compile(gl.VERTEX_SHADER,VERT), fs=compile(gl.FRAGMENT_SHADER,FRAG);
    if(!vs||!fs){ canvas.remove(); container.classList.add('lw-fallback'); return; }
    var prog=gl.createProgram(); gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){ canvas.remove(); container.classList.add('lw-fallback'); return; }
    gl.useProgram(prog);

    var buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    /* fullscreen triangle: pos + uv interleaved */
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 0,0,  3,-1, 2,0,  -1,3, 0,2]), gl.STATIC_DRAW);
    var pos=gl.getAttribLocation(prog,'position'), uv=gl.getAttribLocation(prog,'uv');
    gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);

    function u(n){ return gl.getUniformLocation(prog,n); }
    var U = { time:u('uTime'), res:u('uResolution'), speed:u('uSpeed'), inner:u('uInnerLines'),
      outer:u('uOuterLines'), warp:u('uWarpIntensity'), rot:u('uRotation'), edge:u('uEdgeFadeWidth'),
      cycle:u('uColorCycleSpeed'), bright:u('uBrightness'), c1:u('uColor1'), c2:u('uColor2'), c3:u('uColor3'),
      mouse:u('uMouse'), mInf:u('uMouseInfluence'), enM:u('uEnableMouse') };
    gl.uniform1f(U.speed,P.speed); gl.uniform1f(U.inner,P.inner); gl.uniform1f(U.outer,P.outer);
    gl.uniform1f(U.warp,P.warp); gl.uniform1f(U.rot,P.rotation); gl.uniform1f(U.edge,P.edgeFade);
    gl.uniform1f(U.cycle,P.cycle); gl.uniform1f(U.bright,P.brightness);
    gl.uniform3fv(U.c1,P.c1); gl.uniform3fv(U.c2,P.c2); gl.uniform3fv(U.c3,P.c3);
    gl.uniform1f(U.mInf,P.mouseInf); gl.uniform1i(U.enM,P.enableMouse?1:0);

    var vis = window.FX.watch(container);
    function resize(){
      var pr = Math.min(window.devicePixelRatio || 1, window.FX.coarse ? 1 : 1.5);
      var w=Math.max(1,Math.round(vis.w*pr)), h=Math.max(1,Math.round(vis.h*pr));
      canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h);
      gl.uniform3f(U.res, w, h, w/h);
    }
    resize();

    var mx=0.5,my=0.5,tmx=0.5,tmy=0.5;
    if(P.enableMouse){
      canvas.addEventListener('mousemove', function(e){ var r=canvas.getBoundingClientRect(); tmx=(e.clientX-r.left)/r.width; tmy=1-(e.clientY-r.top)/r.height; });
      canvas.addEventListener('mouseleave', function(){ tmx=0.5; tmy=0.5; });
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    function frame(t){
      if(!vis.visible()) return;
      if(vis.consumeResize()) resize();
      mx+=0.05*(tmx-mx); my+=0.05*(tmy-my);
      gl.useProgram(prog);
      gl.uniform1f(U.time, t*0.001);
      gl.uniform2f(U.mouse, mx, my);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
    /* draw one frame immediately, then loop (unless reduced motion) */
    (function(){ gl.uniform1f(U.time,0); gl.uniform2f(U.mouse,0.5,0.5); gl.drawArrays(gl.TRIANGLES,0,3); })();
    if(!reduce) window.FX.add(frame);
  });
})();
