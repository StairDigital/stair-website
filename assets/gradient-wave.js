/* ============================================================
   Gradient Wave (vanilla port of the React GradientWave / MiniGl component)
   A vertex-displaced plane whose layered simplex noise blends colour bands.
   Ported changes:
     - sizes to its CONTAINER rather than window.innerWidth/Height
     - pauses when hidden or scrolled out of view
     - DPR-aware sizing capped at 1.5
   Targets [data-gradientwave]; colours from data-colors (comma list).
   ============================================================ */
(function () {
  "use strict";

  function normalizeColor(hex) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (255 & hex) / 255];
  }

  function MiniGl(canvas) {
    var self = this;
    this.canvas = canvas;
    var gl = canvas.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    this.meshes = [];

    this.Uniform = function (e) {
      Object.assign(this, e);
      var map = { float: '1f', int: '1i', vec2: '2fv', vec3: '3fv', vec4: '4fv', mat4: 'Matrix4fv' };
      this.type = this.type || 'float';
      this.typeFn = map[this.type] || '1f';
    };
    this.Uniform.prototype.update = function (loc) {
      if (this.value === undefined || loc === null) return;
      if (this.typeFn.indexOf('Matrix') === 0) gl['uniform' + this.typeFn](loc, !!this.transpose, this.value);
      else gl['uniform' + this.typeFn](loc, this.value);
    };
    this.Uniform.prototype.getDeclaration = function (name, type, length) {
      if (this.excludeFrom === type) return '';
      if (this.type === 'array') {
        return this.value[0].getDeclaration(name, type, this.value.length) +
          '\nconst int ' + name + '_length = ' + this.value.length + ';';
      }
      if (this.type === 'struct') {
        var n = name.replace('u_', '');
        n = n.charAt(0).toUpperCase() + n.slice(1);
        var fields = Object.keys(this.value).map(function (k) {
          return self.Uniform.prototype.getDeclaration.call(this.value[k], k, type).replace(/^uniform/, '');
        }, this).join('');
        return 'uniform struct ' + n + ' {\n' + fields + '\n} ' + name + (length ? '[' + length + ']' : '') + ';';
      }
      return 'uniform ' + this.type + ' ' + name + (length ? '[' + length + ']' : '') + ';';
    };

    this.Attribute = function (e) {
      this.type = gl.FLOAT; this.normalized = false;
      this.buffer = gl.createBuffer();
      Object.assign(this, e);
    };
    this.Attribute.prototype.update = function () {
      if (!this.values) return;
      gl.bindBuffer(this.target, this.buffer);
      gl.bufferData(this.target, this.values, gl.STATIC_DRAW);
    };
    this.Attribute.prototype.attach = function (name, program) {
      var loc = gl.getAttribLocation(program, name);
      if (this.target === gl.ARRAY_BUFFER) {
        gl.bindBuffer(this.target, this.buffer);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, this.size, this.type, this.normalized, 0, 0);
      }
      return loc;
    };
    this.Attribute.prototype.use = function (loc) {
      gl.bindBuffer(this.target, this.buffer);
      if (this.target === gl.ARRAY_BUFFER) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, this.size, this.type, this.normalized, 0, 0);
      }
    };

    this.Material = function (vert, frag, uniforms) {
      uniforms = uniforms || {};
      var mat = this;
      mat.uniforms = uniforms;
      mat.uniformInstances = [];

      function shader(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      }
      function decls(u, type) {
        return Object.keys(u).map(function (k) { return u[k].getDeclaration(k, type); }).join('\n');
      }
      var prefix = 'precision highp float;';
      var vs = prefix + '\nattribute vec4 position;\nattribute vec2 uv;\nattribute vec2 uvNorm;\n' +
        decls(self.commonUniforms, 'vertex') + '\n' + decls(uniforms, 'vertex') + '\n' + vert;
      var fs = prefix + '\n' + decls(self.commonUniforms, 'fragment') + '\n' + decls(uniforms, 'fragment') + '\n' + frag;

      mat.program = gl.createProgram();
      gl.attachShader(mat.program, shader(gl.VERTEX_SHADER, vs));
      gl.attachShader(mat.program, shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(mat.program);
      if (!gl.getProgramParameter(mat.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(mat.program));
      gl.useProgram(mat.program);
      mat.attachUniforms(undefined, self.commonUniforms);
      mat.attachUniforms(undefined, mat.uniforms);
    };
    this.Material.prototype.attachUniforms = function (name, u) {
      var mat = this;
      if (name === undefined) { Object.keys(u).forEach(function (k) { mat.attachUniforms(k, u[k]); }); }
      else if (u.type === 'array') { u.value.forEach(function (v, i) { mat.attachUniforms(name + '[' + i + ']', v); }); }
      else if (u.type === 'struct') { Object.keys(u.value).forEach(function (k) { mat.attachUniforms(name + '.' + k, u.value[k]); }); }
      else { mat.uniformInstances.push({ uniform: u, location: gl.getUniformLocation(mat.program, name) }); }
    };

    this.PlaneGeometry = function () {
      this.attributes = {
        position: new self.Attribute({ target: gl.ARRAY_BUFFER, size: 3 }),
        uv: new self.Attribute({ target: gl.ARRAY_BUFFER, size: 2 }),
        uvNorm: new self.Attribute({ target: gl.ARRAY_BUFFER, size: 2 }),
        index: new self.Attribute({ target: gl.ELEMENT_ARRAY_BUFFER, size: 3, type: gl.UNSIGNED_SHORT })
      };
      this.xSegCount = 0; this.ySegCount = 0; this.vertexCount = 0;
    };
    this.PlaneGeometry.prototype.setTopology = function (xs, ys) {
      xs = xs || 1; ys = ys || 1;
      this.xSegCount = xs; this.ySegCount = ys;
      this.vertexCount = (xs + 1) * (ys + 1);
      var quads = xs * ys * 2;
      this.attributes.uv.values = new Float32Array(2 * this.vertexCount);
      this.attributes.uvNorm.values = new Float32Array(2 * this.vertexCount);
      this.attributes.index.values = new Uint16Array(3 * quads);
      for (var y = 0; y <= ys; y++) {
        for (var x = 0; x <= xs; x++) {
          var i = y * (xs + 1) + x;
          this.attributes.uv.values[2 * i] = x / xs;
          this.attributes.uv.values[2 * i + 1] = 1 - y / ys;
          this.attributes.uvNorm.values[2 * i] = (x / xs) * 2 - 1;
          this.attributes.uvNorm.values[2 * i + 1] = 1 - (y / ys) * 2;
          if (x < xs && y < ys) {
            var s = y * xs + x;
            this.attributes.index.values[6 * s] = i;
            this.attributes.index.values[6 * s + 1] = i + 1 + xs;
            this.attributes.index.values[6 * s + 2] = i + 1;
            this.attributes.index.values[6 * s + 3] = i + 1;
            this.attributes.index.values[6 * s + 4] = i + 1 + xs;
            this.attributes.index.values[6 * s + 5] = i + 2 + xs;
          }
        }
      }
      this.attributes.uv.update(); this.attributes.uvNorm.update(); this.attributes.index.update();
    };
    this.PlaneGeometry.prototype.setSize = function (w, h) {
      w = w || 1; h = h || 1;
      this.attributes.position.values = new Float32Array(3 * this.vertexCount);
      var ox = w / -2, oy = h / -2, sw = w / this.xSegCount, sh = h / this.ySegCount;
      for (var y = 0; y <= this.ySegCount; y++) {
        var py = oy + y * sh;
        for (var x = 0; x <= this.xSegCount; x++) {
          var idx = y * (this.xSegCount + 1) + x;
          this.attributes.position.values[3 * idx] = ox + x * sw;
          this.attributes.position.values[3 * idx + 1] = -py;
          this.attributes.position.values[3 * idx + 2] = 0;
        }
      }
      this.attributes.position.update();
    };

    this.Mesh = function (geometry, material) {
      this.geometry = geometry; this.material = material; this.attributeInstances = [];
      var m = this;
      Object.keys(geometry.attributes).forEach(function (k) {
        m.attributeInstances.push({ attribute: geometry.attributes[k], location: geometry.attributes[k].attach(k, material.program) });
      });
      self.meshes.push(this);
    };
    this.Mesh.prototype.draw = function () {
      gl.useProgram(this.material.program);
      this.material.uniformInstances.forEach(function (o) { o.uniform.update(o.location); });
      this.attributeInstances.forEach(function (o) { o.attribute.use(o.location); });
      gl.drawElements(gl.TRIANGLES, this.geometry.attributes.index.values.length, gl.UNSIGNED_SHORT, 0);
    };

    var I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    this.commonUniforms = {
      projectionMatrix: new this.Uniform({ type: 'mat4', value: I }),
      modelViewMatrix: new this.Uniform({ type: 'mat4', value: I }),
      resolution: new this.Uniform({ type: 'vec2', value: [1, 1] }),
      aspectRatio: new this.Uniform({ type: 'float', value: 1 })
    };
  }
  MiniGl.prototype.setSize = function (w, h) {
    this.width = w; this.height = h;
    this.canvas.width = w; this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.commonUniforms.resolution.value = [w, h];
    this.commonUniforms.aspectRatio.value = w / h;
  };
  MiniGl.prototype.setOrthographicCamera = function () {
    this.commonUniforms.projectionMatrix.value =
      [2 / this.width, 0, 0, 0, 0, 2 / this.height, 0, 0, 0, 0, -0.001, 0, 0, 0, 0, 1];
  };
  MiniGl.prototype.render = function () {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clearDepth(1);
    this.meshes.forEach(function (m) { m.draw(); });
  };

  var VERT = [
    'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    ' const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    ' vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
    ' vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
    ' vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);',
    ' vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    ' float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;',
    ' vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);',
    ' vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);',
    ' vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
    ' vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));',
    ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    ' vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
    ' vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    ' p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
    ' vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;',
    ' return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}',
    'vec3 blendNormal(vec3 base, vec3 blend, float opacity){return (blend*opacity + base*(1.0-opacity));}',
    'varying vec3 v_color;',
    'void main(){',
    ' float time=u_time*u_global.noiseSpeed;',
    ' vec2 noiseCoord=resolution*uvNorm*u_global.noiseFreq;',
    ' float tilt=resolution.y/2.0*uvNorm.y;',
    ' float incline=resolution.x*uvNorm.x/2.0*u_vertDeform.incline;',
    ' float offset=resolution.x/2.0*u_vertDeform.incline*mix(u_vertDeform.offsetBottom,u_vertDeform.offsetTop,uv.y);',
    ' float noise=snoise(vec3(noiseCoord.x*u_vertDeform.noiseFreq.x+time*u_vertDeform.noiseFlow,',
    '  noiseCoord.y*u_vertDeform.noiseFreq.y, time*u_vertDeform.noiseSpeed+u_vertDeform.noiseSeed))*u_vertDeform.noiseAmp;',
    ' noise*=1.0-pow(abs(uvNorm.y),2.0); noise=max(0.0,noise);',
    ' vec3 pos=vec3(position.x, position.y+tilt+incline+noise-offset, position.z);',
    ' v_color=u_baseColor;',
    ' for(int i=0;i<u_waveLayers_length;i++){',
    '  if(u_active_colors[i+1]==1.){',
    '   WaveLayers layer=u_waveLayers[i];',
    '   float layerNoise=smoothstep(layer.noiseFloor,layer.noiseCeil,',
    '    snoise(vec3(noiseCoord.x*layer.noiseFreq.x+time*layer.noiseFlow,',
    '     noiseCoord.y*layer.noiseFreq.y, time*layer.noiseSpeed+layer.noiseSeed))/2.0+0.5);',
    '   v_color=blendNormal(v_color,layer.color,pow(layerNoise,4.));',
    '  }}',
    ' gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);}'
  ].join('\n');

  var FRAG = [
    'varying vec3 v_color;',
    'void main(){',
    ' vec3 color=v_color;',
    ' if(u_darken_top==1.0){ vec2 st=gl_FragCoord.xy/resolution.xy;',
    '  color.g-=pow(st.y+sin(-12.0)*st.x,u_shadow_power)*0.4; }',
    ' gl_FragColor=vec4(color,1.0);}'
  ].join('\n');

  function init(host) {
    var colors = (host.getAttribute('data-colors') || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (colors.length < 2) colors = ['#E7F1EE', '#FAF8F3', '#CFE9E3', '#F1EDE4'];

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(canvas);

    var minigl, mesh;
    try {
      minigl = new MiniGl(canvas);

      var sc = colors.map(function (h) { return normalizeColor(parseInt(h.replace('#', '0x'), 16)); });
      var U = minigl.Uniform;
      var uniforms = {
        u_time: new U({ value: 0 }),
        u_shadow_power: new U({ value: parseFloat(host.getAttribute('data-shadow') || '8') }),
        u_darken_top: new U({ value: host.getAttribute('data-darken') === 'true' ? 1 : 0 }),
        u_active_colors: new U({ value: [1, 1, 1, 1], type: 'vec4' }),
        u_global: new U({
          value: {
            noiseFreq: new U({ value: [0.00014, 0.00029], type: 'vec2' }),
            noiseSpeed: new U({ value: parseFloat(host.getAttribute('data-noisespeed') || '0.000008') })
          }, type: 'struct'
        }),
        u_vertDeform: new U({
          value: {
            incline: new U({ value: parseFloat(host.getAttribute('data-incline') || '0.4') }),
            offsetTop: new U({ value: -0.5 }),
            offsetBottom: new U({ value: -0.5 }),
            noiseFreq: new U({ value: [3, 4], type: 'vec2' }),
            noiseAmp: new U({ value: parseFloat(host.getAttribute('data-amp') || '260') }),
            noiseSpeed: new U({ value: 10 }),
            noiseFlow: new U({ value: parseFloat(host.getAttribute('data-flow') || '5') }),
            noiseSeed: new U({ value: 5 })
          }, type: 'struct', excludeFrom: 'fragment'
        }),
        u_baseColor: new U({ value: sc[0], type: 'vec3', excludeFrom: 'fragment' }),
        u_waveLayers: new U({ value: [], excludeFrom: 'fragment', type: 'array' })
      };
      for (var i = 1; i < sc.length; i++) {
        uniforms.u_waveLayers.value.push(new U({
          value: {
            color: new U({ value: sc[i], type: 'vec3' }),
            noiseFreq: new U({ value: [2 + i / sc.length, 3 + i / sc.length], type: 'vec2' }),
            noiseSpeed: new U({ value: 11 + 0.3 * i }),
            noiseFlow: new U({ value: 6.5 + 0.3 * i }),
            noiseSeed: new U({ value: 5 + 10 * i }),
            noiseFloor: new U({ value: 0.1 }),
            noiseCeil: new U({ value: 0.63 + 0.07 * i })
          }, type: 'struct'
        }));
      }

      var material = new minigl.Material(VERT, FRAG, uniforms);
      var geometry = new minigl.PlaneGeometry();
      mesh = new minigl.Mesh(geometry, material);
    } catch (e) {
      host.classList.add('gw-fallback');
      canvas.remove();
      return;
    }

    var _coarse = !(window.matchMedia && window.matchMedia('(pointer:fine)').matches);
    var dpr = Math.min(window.devicePixelRatio || 1, _coarse ? 1 : 1.5);
    var vis = window.FX.watch(host);
    var lastW = 0, lastH = 0;
    /* This field spans whole sections, so on a tall one (the research page's
       hand-off band is ~1840px tall) the backing store hit 1.5 megapixels and
       every frame had to shade all of it. It is a heavily blurred gradient, so
       resolution buys nothing visually: cap the buffer and let CSS scale it
       back up. 1.5Mpx -> ~0.8Mpx is roughly half the shading work per frame. */
    var PIXEL_BUDGET = 800000;
    function resize() {
      var w = Math.max(1, Math.round(vis.w * dpr)), h = Math.max(1, Math.round(vis.h * dpr));
      var over = (w * h) / PIXEL_BUDGET;
      if (over > 1) {
        var k = Math.sqrt(over);
        w = Math.max(1, Math.round(w / k));
        h = Math.max(1, Math.round(h / k));
      }
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      minigl.setSize(w, h);
      minigl.setOrthographicCamera();
      mesh.geometry.setTopology(Math.ceil(w * 0.02), Math.ceil(h * 0.05));
      mesh.geometry.setSize(w, h);
    }
    resize();

    var t = 0, last = 0;
    function frame(ts) {
      if (!vis.visible()) { last = ts; return; }
      if (vis.consumeResize()) resize();
      t += Math.min(ts - last, 1000 / 15);
      last = ts;
      mesh.material.uniforms.u_time.value = t;
      minigl.render();
    }
    window.FX.add(frame);
  }

  document.querySelectorAll('[data-gradientwave]').forEach(init);
})();
