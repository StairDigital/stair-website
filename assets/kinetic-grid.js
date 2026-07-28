/* ============================================================
   Kinetic Grid (vanilla port of the React KineticGrid component)
   A canvas grid that warps toward the pointer and ripples on click.
   Ported changes worth noting:
     - sizes to its CONTAINER, not the window, so it can live inside a dialog
     - pointer/click coordinates are container-relative
     - only animates while the container is actually on screen and visible,
       which matters because the consultation dialog is usually closed
     - palette pulled onto the STAIR teal rather than the original blue
   Targets [data-kineticgrid].
   ============================================================ */
(function () {
  "use strict";

  var CELL_SIZE = 46;
  var INFLUENCE_RADIUS = 220;
  var MAX_WARP = 20;
  var DOT_SPACING = 26;
  var LERP_SPEED = 0.10;

  var LINE_BASE_DARK = { r: 255, g: 255, b: 255, a: 0.12 };   /* light lines on a dark ground */
  var LINE_BASE_LIGHT = { r: 28, g: 59, b: 56, a: 0.16 };     /* ink lines on a light ground  */
  var NODE_BASE_RADIUS = 1.6;
  var NODE_ACTIVE_RADIUS = 3.0;

  function lerpN(a, b, t) { return a + (b - a) * t; }
  function lerpColor(base, active, t) {
    return 'rgba(' + Math.round(lerpN(base.r, active.r, t)) + ',' +
      Math.round(lerpN(base.g, active.g, t)) + ',' +
      Math.round(lerpN(base.b, active.b, t)) + ',' +
      lerpN(base.a, active.a, t).toFixed(3) + ')';
  }
  function hexRgb(h, dflt) {
    h = String(h || '').replace('#', '').trim();
    if (h.length !== 6) return dflt;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function init(host) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    host.insertBefore(canvas, host.firstChild);

    var accent = hexRgb(host.getAttribute('data-accent'), { r: 14, g: 156, b: 147 });
    var bg = host.getAttribute('data-bg') || '#0d1a18';
    var light = host.getAttribute('data-tone') === 'light';
    var LINE_BASE = light ? LINE_BASE_LIGHT : LINE_BASE_DARK;
    var DOT_FILL = light ? 'rgba(28,59,56,0.09)' : 'rgba(255,255,255,0.05)';
    var NODE_BASE = light ? { r: 28, g: 59, b: 56, a: 0.22 } : { r: 255, g: 255, b: 255, a: 0.2 };
    var theme = {
      bg: bg,
      lineActive: { r: accent.r, g: accent.g, b: accent.b, a: 0.92 },
      nodeActive: light ? { r: accent.r, g: accent.g, b: accent.b, a: 1 }
        : { r: Math.min(255, accent.r + 70), g: Math.min(255, accent.g + 60), b: Math.min(255, accent.b + 55), a: 1 },
      glow: accent.r + ',' + accent.g + ',' + accent.b,
      ripple: Math.min(255, accent.r + 90) + ',' + Math.min(255, accent.g + 70) + ',' + Math.min(255, accent.b + 65)
    };

    var coarse = !(window.matchMedia && window.matchMedia('(pointer:fine)').matches);
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5);
    var mouse = { x: -9999, y: -9999 }, target = { x: -9999, y: -9999 };
    var ripples = [];
    var raf = null;

    function resize() {
      if (!vis.consumeResize()) return false;
      var nw = Math.max(1, vis.w), nh = Math.max(1, vis.h);
      if (nw === W && nh === H) return false;
      W = nw; H = nh;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }

    function warped(gx, gy, col, row, cols, rows) {
      /* edge pin: boundary rows and cols stay put so the grid never tears */
      var edge = 1.5;
      var colPin = Math.min(col / edge, (cols - 1 - col) / edge, 1);
      var rowPin = Math.min(row / edge, (rows - 1 - row) / edge, 1);
      var pin = colPin * colPin * rowPin * rowPin;

      var dx = gx - mouse.x, dy = gy - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var proximity = Math.max(0, 1 - dist / INFLUENCE_RADIUS) * pin;

      var rx = 0, ry = 0;
      for (var i = 0; i < ripples.length; i++) {
        var rp = ripples[i];
        var rdx = gx - rp.x, rdy = gy - rp.y;
        var rdist = Math.sqrt(rdx * rdx + rdy * rdy);
        var waveWidth = 50;
        var diff = rdist - rp.radius;
        if (Math.abs(diff) < waveWidth) {
          var strength = (1 - Math.abs(diff) / waveWidth) * rp.opacity * 16 * pin;
          var a = Math.atan2(rdy, rdx);
          var sign = diff < 0 ? -1 : 1;
          rx += Math.cos(a) * strength * sign * -1;
          ry += Math.sin(a) * strength * sign * -1;
        }
      }

      if (dist < INFLUENCE_RADIUS && dist > 0 && pin > 0) {
        var t = dist / INFLUENCE_RADIUS;
        var eased = t < 0.01 ? 0 : (1 - t) * (1 - t) * Math.min(1, dist / 60);
        var amt = eased * MAX_WARP * pin;
        var ang = Math.atan2(dy, dx);
        return { x: gx - Math.cos(ang) * amt + rx, y: gy - Math.sin(ang) * amt + ry, p: proximity };
      }
      return { x: gx + rx, y: gy + ry, p: proximity };
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, W, H);

      /* static dot texture */
      ctx.fillStyle = DOT_FILL;
      for (var x = DOT_SPACING / 2; x < W; x += DOT_SPACING) {
        for (var y = DOT_SPACING / 2; y < H; y += DOT_SPACING) {
          ctx.beginPath(); ctx.arc(x, y, 0.7, 0, Math.PI * 2); ctx.fill();
        }
      }

      for (var i = ripples.length - 1; i >= 0; i--) {
        var rp = ripples[i];
        var age = (now - rp.born) / 1000;
        rp.radius = Math.max(0, age * 360);
        rp.opacity = Math.max(0, 1 - age * 1.2);
        if (rp.opacity <= 0) ripples.splice(i, 1);
      }

      var cols = Math.max(2, Math.ceil(W / CELL_SIZE)) + 1;
      var rows = Math.max(2, Math.ceil(H / CELL_SIZE)) + 1;
      var cw = W / (cols - 1), ch = H / (rows - 1);

      var pts = [], prox = [];
      for (var row = 0; row < rows; row++) {
        pts[row] = []; prox[row] = [];
        for (var col = 0; col < cols; col++) {
          var r = warped(col * cw, row * ch, col, row, cols, rows);
          pts[row][col] = r; prox[row][col] = r.p;
        }
      }

      function seg(p1, p2, a1, a2) {
        var avg = (a1 + a2) / 2;
        var t = avg * avg * (3 - 2 * avg);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = lerpColor(LINE_BASE, theme.lineActive, t);
        ctx.lineWidth = lerpN(0.8, 1.5, t);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      for (row = 0; row < rows; row++)
        for (col = 0; col < cols - 1; col++)
          seg(pts[row][col], pts[row][col + 1], prox[row][col], prox[row][col + 1]);
      for (col = 0; col < cols; col++)
        for (row = 0; row < rows - 1; row++)
          seg(pts[row][col], pts[row + 1][col], prox[row][col], prox[row + 1][col]);

      for (row = 0; row < rows; row++) {
        for (col = 0; col < cols; col++) {
          var p = pts[row][col], pr = prox[row][col];
          var t2 = pr * pr * (3 - 2 * pr);
          var rad = lerpN(NODE_BASE_RADIUS, NODE_ACTIVE_RADIUS, t2);
          if (t2 > 0.3) {
            var gr = rad + lerpN(0, 6, (t2 - 0.3) / 0.7);
            var grd = ctx.createRadialGradient(p.x, p.y, rad * 0.5, p.x, p.y, gr);
            grd.addColorStop(0, 'rgba(' + theme.glow + ',' + (t2 * 0.32).toFixed(3) + ')');
            grd.addColorStop(1, 'rgba(' + theme.glow + ',0)');
            ctx.beginPath(); ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
            ctx.fillStyle = grd; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          ctx.fillStyle = lerpColor(NODE_BASE, theme.nodeActive, t2);
          ctx.fill();
        }
      }

      for (i = 0; i < ripples.length; i++) {
        ctx.beginPath();
        ctx.arc(ripples[i].x, ripples[i].y, Math.max(0, ripples[i].radius), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + theme.ripple + ',' + (ripples[i].opacity * 0.3).toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    /* the consultation dialog is laid out at all times but only visible when
       open, and IntersectionObserver cannot see that, so gate on the class */
    var dlg = host.closest('#chooser');
    var vis = window.FX.watch(host, {
      gate: dlg ? function () { return dlg.classList.contains('open'); } : null
    });
    function onScreen() { return vis.visible(); }

    var painted = false;
    function loop(now) {
      if (!onScreen()) return;
      var grew = resize();
      mouse.x = lerpN(mouse.x, target.x, LERP_SPEED);
      mouse.y = lerpN(mouse.y, target.y, LERP_SPEED);
      var settling = Math.abs(target.x - mouse.x) > 0.4 || Math.abs(target.y - mouse.y) > 0.4;
      /* nothing is moving and nothing is decaying: the frame would be identical */
      if (painted && !grew && !settling && ripples.length === 0) return;
      draw(now);
      painted = true;
    }


    var surface = host.closest('[data-kinetic-surface]') || host;
    /* one rect read per pointer event, not per frame */
    surface.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
    }, { passive: true });
    surface.addEventListener('pointerleave', function () { target.x = -9999; target.y = -9999; });
    surface.addEventListener('click', function (e) {
      var r = host.getBoundingClientRect();
      ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, radius: 0, opacity: 1, born: performance.now() });
    });

    resize();
    window.FX.add(loop);
  }

  document.querySelectorAll('[data-kineticgrid]').forEach(init);
})();
