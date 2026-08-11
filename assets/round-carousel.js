/* ============================================================
   Round Carousel (vanilla port of the Originkit React component)
   A 3D ring of images that turns on its own and can be dragged.
   Targets [data-roundcarousel]; images come from data-images (comma list)
   or data-count + data-prefix/data-pad for numbered files.
   Pauses when hidden or scrolled out of view.
   ============================================================ */
(function () {
  "use strict";

  function num(el, attr, dflt) {
    var v = parseFloat(el.getAttribute(attr));
    return isNaN(v) ? dflt : v;
  }

  function init(host) {
    /* ---- gather sources ---- */
    var srcs = (host.getAttribute('data-images') || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!srcs.length) {
      var count = num(host, 'data-count', 0);
      var prefix = host.getAttribute('data-prefix') || '';
      var ext = host.getAttribute('data-ext') || '.jpg';
      for (var i = 0; i < count; i++) {
        srcs.push(prefix + (i < 10 ? '0' + i : '' + i) + ext);
      }
    }
    if (!srcs.length) return;

    var n = srcs.length;
    var imageWidth = num(host, 'data-width', 300);
    var imageHeight = num(host, 'data-height', 300);
    var spacing = num(host, 'data-spacing', 3);
    var speed = num(host, 'data-speed', 7);
    var dirLeft = (host.getAttribute('data-direction') || 'right') === 'left';
    var sensitivity = num(host, 'data-sensitivity', 5);
    var tilt = num(host, 'data-tilt', -7);
    var perspective = num(host, 'data-perspective', 3000);
    var radiusPx = num(host, 'data-radius', 22);
    var innerDim = num(host, 'data-innerdim', 3.5);
    var canDrag = host.getAttribute('data-drag') !== 'false';

    var angle = 360 / n;
    var factor = 1 + spacing * 0.15;
    var ringRadius = (imageWidth * factor) / (2 * Math.tan(Math.PI / n));
    var degPerSec = speed * 6 * (dirLeft ? -1 : 1);

    /* ---- build the ring ---- */
    host.style.perspective = perspective + 'px';
    if (canDrag) host.style.cursor = 'grab';
    host.style.touchAction = 'pan-y';

    var tiltBox = document.createElement('div');
    tiltBox.className = 'rc-tilt';
    tiltBox.style.transform = 'rotateX(' + tilt + 'deg)';

    var ring = document.createElement('div');
    ring.className = 'rc-ring';
    ring.style.width = imageWidth + 'px';
    ring.style.height = imageHeight + 'px';

    for (var k = 0; k < n; k++) {
      var cell = document.createElement('div');
      cell.className = 'rc-cell';
      cell.style.transform = 'rotateY(' + (k * angle) + 'deg) translateZ(' + ringRadius + 'px)';

      var front = document.createElement('div');
      front.className = 'rc-face';
      front.style.borderRadius = radiusPx + 'px';
      front.style.backgroundImage = 'url("' + srcs[k] + '")';

      var back = document.createElement('div');
      back.className = 'rc-face rc-back';
      back.style.borderRadius = radiusPx + 'px';
      back.style.backgroundImage = 'url("' + srcs[k] + '")';
      back.style.filter = 'brightness(' + (innerDim / 10) + ')';

      cell.appendChild(front);
      cell.appendChild(back);
      ring.appendChild(cell);
    }
    tiltBox.appendChild(ring);
    host.appendChild(tiltBox);

    /* ---- spin ---- */
    var rotY = 0, vel = 0, last = 0, raf = null;
    var drag = { active: false, x: 0 };

    function apply() {
      ring.style.transform = 'translateZ(' + (-ringRadius) + 'px) rotateY(' + rotY + 'deg)';
    }
    apply();

    var vis = window.FX.watch(host);

    function draw(now) {
      if (!vis.visible()) { last = now; return; }
      var dt = last ? (now - last) / 1000 : 0;
      last = now;
      var f = Math.min(dt, 0.1);
      if (!drag.active) {
        if (Math.abs(vel) > 0.01) { rotY += vel * f; vel *= 0.94; }
        else { rotY += degPerSec * f; }
      }
      apply();
    }
    window.FX.add(draw);

    if (canDrag) {
      host.addEventListener('pointerdown', function (e) {
        if (host.setPointerCapture) { try { host.setPointerCapture(e.pointerId); } catch (x) {} }
        drag.active = true; drag.x = e.clientX; vel = 0;
        host.style.cursor = 'grabbing';
      });
      host.addEventListener('pointermove', function (e) {
        if (!drag.active) return;
        var dx = e.clientX - drag.x;
        drag.x = e.clientX;
        var kk = 0.3 * sensitivity;
        rotY += dx * kk;
        vel = dx * kk * 60;
      });
      function release(e) {
        if (host.releasePointerCapture && e.pointerId != null) {
          try { host.releasePointerCapture(e.pointerId); } catch (x) {}
        }
        drag.active = false;
        host.style.cursor = 'grab';
      }
      host.addEventListener('pointerup', release);
      host.addEventListener('pointercancel', release);
    }
  }

  document.querySelectorAll('[data-roundcarousel]').forEach(init);
})();
