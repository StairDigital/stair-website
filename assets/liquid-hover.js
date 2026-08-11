/* Liquid Distortion — WebGL fluid-sim image that ripples under the cursor.
   Ported from componentry.dev's LiquidHover (React) to vanilla JS. Same GLSL
   (advection, divergence, Jacobi pressure, gradient subtract) distorting an
   image texture. Targets [data-liquid] elements with a data-src image.
   Falls back to a static cover image if WebGL / float textures are unavailable. */
(function(){
  "use strict";
  var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-liquid]'));
  if(!nodes.length) return;
  nodes.forEach(initLiquid);

  function initLiquid(container){
    var imageSrc = container.dataset.src;
    var resolution = parseFloat(container.dataset.resolution || '10');
    var cursorSize = parseFloat(container.dataset.cursor || '50');
    var intensity = parseFloat(container.dataset.intensity || '46');
    if(!imageSrc){ return; }

    function fallback(){
      container.style.backgroundImage = 'url("' + imageSrc + '")';
      container.style.backgroundSize = 'cover';
      container.style.backgroundPosition = 'center';
    }

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText = 'position:absolute;top:-10%;left:-10%;width:120%;height:120%;overflow:hidden';
    container.appendChild(canvas);

    var glMaybe = canvas.getContext('webgl', {alpha:true, premultipliedAlpha:false});
    if(!glMaybe){ canvas.remove(); fallback(); return; }
    var gl = glMaybe;
    var floatExt = gl.getExtension('OES_texture_float');
    gl.getExtension('OES_texture_float_linear');
    if(!floatExt){ canvas.remove(); fallback(); return; }
    gl.clearColor(0,0,0,0);

    var cp = intensity / 100;
    var params = {
      cursorRadiusPx: cursorSize,
      cursorPower: 5 + ((cp - 0.1) * (50 - 5)) / (1 - 0.1),
      distortionPower: intensity / 100
    };
    var overscanFactor = 1.2;
    var innerScale = 5/6;
    var pointer = { x: 0.65*container.clientWidth, y: 0.5*container.clientHeight, dx:0, dy:0, moved:false };
    var res = { w:0, h:0 };
    var outputColor, velocity, divergence, pressure;
    var imageTexture = null, imgRatio = 1, isHovering = false;

    var VERT =
'precision highp float;\nvarying vec2 vUv;\nattribute vec2 a_position;\n' +
'varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;uniform vec2 u_texel;\n' +
'void main(){ vUv=.5*(a_position+1.); vL=vUv-vec2(u_texel.x,0.); vR=vUv+vec2(u_texel.x,0.);' +
' vT=vUv+vec2(0.,u_texel.y); vB=vUv-vec2(0.,u_texel.y); gl_Position=vec4(a_position,0.,1.); }';

    var FRAG_ADVECT =
'precision highp float;precision highp sampler2D;varying vec2 vUv;' +
'uniform sampler2D u_velocity_texture;uniform sampler2D u_input_texture;uniform vec2 u_texel;' +
'uniform vec2 u_output_textel;uniform float u_dt;uniform float u_dissipation;' +
'vec4 bilerp(sampler2D sam, vec2 uv, vec2 tsize){ vec2 st=uv/tsize-0.5; vec2 iuv=floor(st); vec2 fuv=fract(st);' +
'vec4 a=texture2D(sam,(iuv+vec2(0.5,0.5))*tsize); vec4 b=texture2D(sam,(iuv+vec2(1.5,0.5))*tsize);' +
'vec4 c=texture2D(sam,(iuv+vec2(0.5,1.5))*tsize); vec4 d=texture2D(sam,(iuv+vec2(1.5,1.5))*tsize);' +
'return mix(mix(a,b,fuv.x),mix(c,d,fuv.x),fuv.y); }' +
'void main(){ vec2 coord=vUv - u_dt*bilerp(u_velocity_texture,vUv,u_texel).xy*u_texel;' +
'vec4 velocity=bilerp(u_input_texture,coord,u_output_textel); gl_FragColor=u_dissipation*velocity; }';

    var FRAG_DIVERGENCE =
'precision highp float;precision highp sampler2D;varying highp vec2 vUv;varying highp vec2 vL;varying highp vec2 vR;varying highp vec2 vT;varying highp vec2 vB;' +
'uniform sampler2D u_velocity_texture;' +
'void main(){ float L=texture2D(u_velocity_texture,vL).x; float R=texture2D(u_velocity_texture,vR).x;' +
'float T=texture2D(u_velocity_texture,vT).y; float B=texture2D(u_velocity_texture,vB).y;' +
'float div=.25*(R-L+T-B); gl_FragColor=vec4(div,0.,0.,1.); }';

    var FRAG_PRESSURE =
'precision highp float;precision highp sampler2D;varying highp vec2 vUv;varying highp vec2 vL;varying highp vec2 vR;varying highp vec2 vT;varying highp vec2 vB;' +
'uniform sampler2D u_pressure_texture;uniform sampler2D u_divergence_texture;' +
'void main(){ float L=texture2D(u_pressure_texture,vL).x; float R=texture2D(u_pressure_texture,vR).x;' +
'float T=texture2D(u_pressure_texture,vT).x; float B=texture2D(u_pressure_texture,vB).x;' +
'float divergence=texture2D(u_divergence_texture,vUv).x; float pressure=(L+R+B+T-divergence)*.25;' +
'gl_FragColor=vec4(pressure,0.,0.,1.); }';

    var FRAG_GRAD_SUB =
'precision highp float;precision highp sampler2D;varying highp vec2 vUv;varying highp vec2 vL;varying highp vec2 vR;varying highp vec2 vT;varying highp vec2 vB;' +
'uniform sampler2D u_pressure_texture;uniform sampler2D u_velocity_texture;' +
'void main(){ float L=texture2D(u_pressure_texture,vL).x; float R=texture2D(u_pressure_texture,vR).x;' +
'float T=texture2D(u_pressure_texture,vT).x; float B=texture2D(u_pressure_texture,vB).x;' +
'vec2 velocity=texture2D(u_velocity_texture,vUv).xy; velocity.xy-=vec2(R-L,T-B); gl_FragColor=vec4(velocity,0.,1.); }';

    var FRAG_POINT =
'precision highp float;precision highp sampler2D;varying vec2 vUv;uniform sampler2D u_input_texture;' +
'uniform float u_ratio;uniform float u_img_ratio;uniform vec3 u_point_value;uniform vec2 u_point;uniform float u_point_size;' +
'void main(){ vec2 p=vUv-u_point.xy; p.x*=u_ratio; vec3 splat=.6*pow(2.,-dot(p,p)/u_point_size)*u_point_value;' +
'vec3 base=texture2D(u_input_texture,vUv).xyz; gl_FragColor=vec4(base+splat,1.); }';

    var FRAG_OUTPUT =
'precision highp float;precision highp sampler2D;varying vec2 vUv;' +
'uniform float u_ratio;uniform float u_img_ratio;uniform float u_disturb_power;' +
'uniform sampler2D u_output_texture;uniform sampler2D u_velocity_texture;uniform sampler2D u_text_texture;' +
'uniform vec2 u_point;uniform float u_canvas_scale;uniform float u_inner_scale;' +
'vec2 get_img_uv(){ vec2 uv=vUv-0.5; uv*=u_canvas_scale; uv/=u_inner_scale;' +
'float containerAspect=u_ratio; float imageAspect=u_img_ratio; vec2 scale=vec2(1.0);' +
'if(containerAspect>imageAspect){ scale.y=imageAspect/containerAspect; } else { scale.x=containerAspect/imageAspect; }' +
'uv*=scale; return uv+0.5; }' +
'vec2 get_frame_uv(){ vec2 uv=vUv-0.5; uv*=u_canvas_scale; uv/=u_inner_scale; return uv+0.5; }' +
'float get_img_frame_alpha(vec2 uv, float w){ float a=smoothstep(0.,w,uv.x)*smoothstep(1.,1.-w,uv.x);' +
'a*=smoothstep(0.,w,uv.y)*smoothstep(1.,1.-w,uv.y); return a; }' +
'vec3 sample_image_smooth(vec2 uv){ vec2 uvc=clamp(uv,0.0,1.0); vec3 base=texture2D(u_text_texture,vec2(uvc.x,1.0-uvc.y)).rgb;' +
'float yB=step(uv.y,0.0); float yA=step(1.0,uv.y); float xL=step(uv.x,0.0); float xR=step(1.0,uv.x);' +
'float oob=max(max(yB,yA),max(xL,xR));' +
'if(oob>0.0){ float d=0.002; vec3 s=vec3(0.0);' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x-d,0.,1.),1.-clamp(uvc.y-d,0.,1.))).rgb;' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x,0.,1.),1.-clamp(uvc.y-d,0.,1.))).rgb;' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x+d,0.,1.),1.-clamp(uvc.y-d,0.,1.))).rgb;' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x-d,0.,1.),1.-clamp(uvc.y,0.,1.))).rgb;' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x,0.,1.),1.-clamp(uvc.y,0.,1.))).rgb;' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x+d,0.,1.),1.-clamp(uvc.y,0.,1.))).rgb;' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x-d,0.,1.),1.-clamp(uvc.y+d,0.,1.))).rgb;' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x,0.,1.),1.-clamp(uvc.y+d,0.,1.))).rgb;' +
's+=texture2D(u_text_texture,vec2(clamp(uvc.x+d,0.,1.),1.-clamp(uvc.y+d,0.,1.))).rgb; base=s/9.0; }' +
'return base; }' +
'void main(){ float offset=texture2D(u_output_texture,vUv).r; vec2 velocity=texture2D(u_velocity_texture,vUv).xy; velocity+=.001;' +
'vec2 img_uv=get_img_uv(); img_uv-=u_disturb_power*normalize(velocity)*offset; img_uv-=u_disturb_power*normalize(velocity)*offset;' +
'vec2 frame_uv=get_frame_uv(); frame_uv-=u_disturb_power*normalize(velocity)*offset;' +
'vec3 img=sample_image_smooth(img_uv); float opacity=get_img_frame_alpha(frame_uv,.002);' +
'gl_FragColor=vec4(img*opacity,opacity); }';

    function createShader(source, type){
      var sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){ gl.deleteShader(sh); throw new Error('shader'); }
      return sh;
    }
    function createProgram(vsSrc, fsSrc){
      var program = gl.createProgram();
      gl.attachShader(program, createShader(vsSrc, gl.VERTEX_SHADER));
      gl.attachShader(program, createShader(fsSrc, gl.FRAGMENT_SHADER));
      gl.bindAttribLocation(program, 0, 'a_position');
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program, gl.LINK_STATUS)){ throw new Error('link'); }
      var uniforms = {};
      var n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for(var i=0;i<n;i++){ var a = gl.getActiveUniform(program, i); if(a) uniforms[a.name] = gl.getUniformLocation(program, a.name); }
      return { program: program, uniforms: uniforms };
    }
    function blit(target){
      var vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,-1]), gl.STATIC_DRAW);
      var ebo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.enableVertexAttribArray(0);
      if(target == null){ gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      else { gl.viewport(0,0,target.width,target.height); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
    function createFBO(w, h){
      gl.activeTexture(gl.TEXTURE0);
      var texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, w, h, 0, gl.RGB, gl.FLOAT, null);
      var fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0,0,w,h); gl.clear(gl.COLOR_BUFFER_BIT);
      return { fbo: fbo, width: w, height: h, attach: function(id){ gl.activeTexture(gl.TEXTURE0+id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; } };
    }
    function createDoubleFBO(w, h){
      var fbo1 = createFBO(w, h), fbo2 = createFBO(w, h);
      return { width:w, height:h, texelSizeX:1/w, texelSizeY:1/h,
        read: function(){ return fbo1; }, write: function(){ return fbo2; },
        swap: function(){ var t=fbo1; fbo1=fbo2; fbo2=t; } };
    }

    var splatProgram, divergenceProgram, pressureProgram, gradientSubtractProgram, advectionProgram, displayProgram;
    try {
      splatProgram = createProgram(VERT, FRAG_POINT);
      divergenceProgram = createProgram(VERT, FRAG_DIVERGENCE);
      pressureProgram = createProgram(VERT, FRAG_PRESSURE);
      gradientSubtractProgram = createProgram(VERT, FRAG_GRAD_SUB);
      advectionProgram = createProgram(VERT, FRAG_ADVECT);
      displayProgram = createProgram(VERT, FRAG_OUTPUT);
    } catch(e){ canvas.remove(); fallback(); return; }

    resizeCanvas();
    initFBOs();
    setupEvents();
    loadImage(imageSrc);
    var raf = requestAnimationFrame(render);

    function initFBOs(){
      outputColor = createDoubleFBO(res.w, res.h);
      velocity = createDoubleFBO(res.w, res.h);
      divergence = createFBO(res.w, res.h);
      pressure = createDoubleFBO(res.w, res.h);
    }
    function updatePointerPosition(eX, eY){
      pointer.moved = true;
      pointer.dx = 6*(eX - pointer.x); pointer.dy = 6*(eY - pointer.y);
      pointer.x = eX; pointer.y = eY;
    }
    function setupEvents(){
      canvas.addEventListener('mouseenter', function(){ isHovering = true; });
      canvas.addEventListener('mouseleave', function(){ isHovering = false; pointer.moved = false; });
      function move(e){ if(!isHovering) return; var r = container.getBoundingClientRect(); updatePointerPosition(e.clientX - r.left, e.clientY - r.top); }
      canvas.addEventListener('mousemove', move);
      canvas.addEventListener('click', move);
      canvas.addEventListener('touchstart', function(){ isHovering = true; }, {passive:true});
      canvas.addEventListener('touchend', function(){ isHovering = false; pointer.moved = false; }, {passive:true});
      canvas.addEventListener('touchmove', function(e){ isHovering = true; var t = e.targetTouches[0]; var r = container.getBoundingClientRect(); updatePointerPosition(t.clientX - r.left, t.clientY - r.top); }, {passive:true});
      function onResize(){ resizeCanvas(); initFBOs(); if(imageTexture) gl.bindTexture(gl.TEXTURE_2D, imageTexture); }
      if('ResizeObserver' in window){ new ResizeObserver(onResize).observe(container); }
      else { window.addEventListener('resize', onResize); }
    }
    function resizeCanvas(){
      var width = container.clientWidth, height = container.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(2, Math.round(width * overscanFactor * dpr));
      canvas.height = Math.max(2, Math.round(height * overscanFactor * dpr));
      var cssW = width * overscanFactor, cssH = height * overscanFactor;
      canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
      var ratio = cssW / cssH;
      var baseResolution = 128 + ((resolution - 1) * (512 - 128)) / 9;
      res.w = Math.round(baseResolution * ratio); res.h = Math.round(baseResolution);
    }
    function getPointerUV(){
      var cssW = container.clientWidth * overscanFactor, cssH = container.clientHeight * overscanFactor;
      var dx = 0.5*(cssW - container.clientWidth), dy = 0.5*(cssH - container.clientHeight);
      return { u: (pointer.x + dx)/cssW, v: 1 - (pointer.y + dy)/cssH };
    }
    function loadImage(src){
      var img = new Image(); img.crossOrigin = 'anonymous'; img.src = src;
      img.onload = function(){
        imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
        imageTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      };
    }
    var menuEl = document.getElementById('drawer');
    function visible(){
      if(document.hidden) return false;
      if(menuEl && menuEl.classList.contains('open')) return false;   /* paused behind the open menu */
      return container.getClientRects().length > 0 && getComputedStyle(container).visibility !== 'hidden';
    }
    /* keep the heavy sim running only while the cursor is interacting or the
       ripples are still settling; otherwise just redraw the (undistorted) image */
    var activeUntil = performance.now() + 900;    /* initial settle draws the picture */
    var simTick = 0;
    function render(){
      raf = requestAnimationFrame(render);
      if(!visible()) return;
      var now = performance.now();
      if(pointer.moved) activeUntil = now + 800;
      /* the solve is the expensive part, so step it at ~30Hz and let the cheap
         display pass carry every frame: the ripple reads the same, at half cost */
      var active = (isHovering || (now < activeUntil)) && ((simTick++ & 1) === 0);
      var dt = 1/60;
      if(active){
        if(pointer.moved){
          pointer.moved = false;
          gl.useProgram(splatProgram.program);
          gl.uniform1i(splatProgram.uniforms.u_input_texture, velocity.read().attach(1));
          gl.uniform1f(splatProgram.uniforms.u_ratio, container.clientWidth / Math.max(1, container.clientHeight));
          var uv = getPointerUV();
          gl.uniform2f(splatProgram.uniforms.u_point, uv.u, uv.v);
          gl.uniform3f(splatProgram.uniforms.u_point_value, pointer.dx, -pointer.dy, 0);
          var ch = Math.max(1, container.clientHeight); var rr = params.cursorRadiusPx / ch;
          gl.uniform1f(splatProgram.uniforms.u_point_size, rr*rr);
          blit(velocity.write()); velocity.swap();
          gl.uniform1i(splatProgram.uniforms.u_input_texture, outputColor.read().attach(1));
          gl.uniform3f(splatProgram.uniforms.u_point_value, params.cursorPower*0.001, 0, 0);
          blit(outputColor.write()); outputColor.swap();
        }
        gl.useProgram(divergenceProgram.program);
        gl.uniform2f(divergenceProgram.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(divergenceProgram.uniforms.u_velocity_texture, velocity.read().attach(1));
        blit(divergence);
        gl.useProgram(pressureProgram.program);
        gl.uniform2f(pressureProgram.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(pressureProgram.uniforms.u_divergence_texture, divergence.attach(1));
        for(var i=0;i<6;i++){
          gl.uniform1i(pressureProgram.uniforms.u_pressure_texture, pressure.read().attach(2));
          blit(pressure.write()); pressure.swap();
        }
        gl.useProgram(gradientSubtractProgram.program);
        gl.uniform2f(gradientSubtractProgram.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(gradientSubtractProgram.uniforms.u_pressure_texture, pressure.read().attach(1));
        gl.uniform1i(gradientSubtractProgram.uniforms.u_velocity_texture, velocity.read().attach(2));
        blit(velocity.write()); velocity.swap();
        gl.useProgram(advectionProgram.program);
        gl.uniform2f(advectionProgram.uniforms.u_texel, velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform2f(advectionProgram.uniforms.u_output_textel, velocity.texelSizeX, velocity.texelSizeY);
        gl.uniform1i(advectionProgram.uniforms.u_velocity_texture, velocity.read().attach(1));
        gl.uniform1i(advectionProgram.uniforms.u_input_texture, velocity.read().attach(1));
        gl.uniform1f(advectionProgram.uniforms.u_dt, dt);
        gl.uniform1f(advectionProgram.uniforms.u_dissipation, 0.97);
        blit(velocity.write()); velocity.swap();
        gl.useProgram(advectionProgram.program);
        gl.uniform2f(advectionProgram.uniforms.u_output_textel, outputColor.texelSizeX, outputColor.texelSizeY);
        gl.uniform1i(advectionProgram.uniforms.u_input_texture, outputColor.read().attach(2));
        gl.uniform1f(advectionProgram.uniforms.u_dt, 8*dt);
        gl.uniform1f(advectionProgram.uniforms.u_dissipation, 0.98);
        blit(outputColor.write()); outputColor.swap();
      }
      /* display pass runs every frame (cheap) so the image is always shown */
      gl.useProgram(displayProgram.program);
      var uv2 = getPointerUV();
      gl.uniform2f(displayProgram.uniforms.u_point, uv2.u, uv2.v);
      gl.uniform1i(displayProgram.uniforms.u_velocity_texture, velocity.read().attach(2));
      gl.uniform1f(displayProgram.uniforms.u_ratio, container.clientWidth / Math.max(1, container.clientHeight));
      gl.uniform1f(displayProgram.uniforms.u_img_ratio, imgRatio);
      gl.uniform1f(displayProgram.uniforms.u_disturb_power, params.distortionPower);
      gl.uniform1i(displayProgram.uniforms.u_output_texture, outputColor.read().attach(1));
      gl.uniform1f(displayProgram.uniforms.u_canvas_scale, 1);
      gl.uniform1f(displayProgram.uniforms.u_inner_scale, innerScale);
      if(imageTexture){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imageTexture); gl.uniform1i(displayProgram.uniforms.u_text_texture, 0); }
      blit();
    }
  }
})();
