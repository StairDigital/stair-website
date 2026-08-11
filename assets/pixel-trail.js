/* ============================================================
   Pixelated image trail (vanilla port of React Bits PixelatedImageTrail)
   - Spawns sliced images that fan open along an eased cursor path.
   - The trail layer is pointer-events:none so cards underneath stay clickable;
     pointer is tracked on a host element ([data-trail-host] or parent).
   - Ships a small cursor-following "CLICK" cloud when data-trail-cloud is set.
   - Fine-pointer + motion-allowed only; silently no-ops otherwise.
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;

  var CFG = {
    imageLifespan: 1200,
    inDuration: 260,
    outDuration: 580,
    staggerIn: 11,
    staggerOut: 8,
    slideDuration: 1150,
    slideEasing: "cubic-bezier(0.16,1,0.3,1)",
    easing: "cubic-bezier(0.16,1,0.3,1)"
  };
  var MAX_ACTIVE = 12;

  function init(container) {
    var host = container.closest('[data-trail-host]') || container.parentElement || container;
    var sources = (container.getAttribute('data-images') || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!sources.length) return;

    var SIZE = parseInt(container.getAttribute('data-size') || '190', 10);
    var SLICES = Math.max(1, parseInt(container.getAttribute('data-slices') || '5', 10));
    var THRESHOLD = Math.max(1, parseInt(container.getAttribute('data-threshold') || '34', 10));
    var SMOOTH = 0.30;

    /* preload; only draw images that actually decoded */
    var valid = [];
    sources.forEach(function (src) {
      var im = new Image();
      im.onload = function () { if (valid.indexOf(src) < 0) valid.push(src); };
      im.src = src;
    });

    /* the CLICK cloud (optional) */
    var cloud = null;
    if (container.hasAttribute('data-trail-cloud')) {
      cloud = document.createElement('div');
      cloud.className = 'trail-cloud';
      cloud.textContent = container.getAttribute('data-trail-cloud') || 'CLICK';
      cloud.setAttribute('aria-hidden', 'true');
      container.appendChild(cloud);
    }

    var idx = 0, active = [], timers = [];
    var pActive = false;
    var p = { x: 0, y: 0 }, ip = { x: 0, y: 0 }, lastSpawn = { x: 0, y: 0 };
    var raf = null;

    function schedule(fn, delay) {
      var t = window.setTimeout(function () {
        timers = timers.filter(function (x) { return x !== t; });
        fn();
      }, delay);
      timers.push(t);
    }
    function sliceDelay(i, stagger) { return Math.abs(i - (SLICES - 1) / 2) * stagger; }
    function maxSliceDelay(stagger) { return ((SLICES - 1) / 2) * stagger; }

    function localPos(e) {
      var r = container.getBoundingClientRect();
      return {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      };
    }

    function onMove(e) {
      var q = localPos(e);
      if (cloud) { cloud.style.transform = 'translate3d(' + q.x + 'px,' + q.y + 'px,0) translate(-50%,-140%)'; }
      if (q.inside && !pActive) {
        pActive = true; ip.x = q.x; ip.y = q.y; lastSpawn.x = q.x; lastSpawn.y = q.y;
        if (cloud) cloud.classList.add('on');
      }
      if (q.inside) { p.x = q.x; p.y = q.y; if (cloud) cloud.classList.add('on'); }
      else if (cloud) cloud.classList.remove('on');
    }
    function onLeave() { pActive = false; if (cloud) cloud.classList.remove('on'); }

    function spawn() {
      if (!valid.length) return;
      var src = valid[idx % valid.length];
      idx = (idx + 1) % valid.length;

      var startX = ip.x - SIZE / 2, startY = ip.y - SIZE / 2;
      var targetX = startX + (p.x - ip.x) * 0.42, targetY = startY + (p.y - ip.y) * 0.42;

      var el = document.createElement('div');
      el.className = 'trail-img';
      el.style.cssText =
        'left:' + startX + 'px;top:' + startY + 'px;width:' + SIZE + 'px;height:' + SIZE + 'px;' +
        'transition:left ' + CFG.slideDuration + 'ms ' + CFG.slideEasing + ',top ' + CFG.slideDuration + 'ms ' + CFG.slideEasing +
        ',opacity ' + CFG.outDuration + 'ms ' + CFG.easing + ',transform ' + CFG.outDuration + 'ms ' + CFG.easing + ';';

      var layers = [];
      var frag = document.createDocumentFragment();
      for (var i = 0; i < SLICES; i++) {
        var s0 = i * (100 / SLICES), s1 = (i + 1) * (100 / SLICES);
        var layer = document.createElement('div');
        layer.className = 'trail-slice';
        layer.style.clipPath = 'polygon(50% ' + s0 + '%,50% ' + s0 + '%,50% ' + s1 + '%,50% ' + s1 + '%)';
        layer.style.transition = 'clip-path ' + CFG.inDuration + 'ms ' + CFG.easing;
        layer.style.transitionDelay = sliceDelay(i, CFG.staggerIn) + 'ms';
        var inner = document.createElement('div');
        inner.className = 'trail-slice-img';
        inner.style.backgroundImage = 'url("' + src + '")';
        layer.appendChild(inner);
        frag.appendChild(layer);
        layers.push(layer);
      }
      el.appendChild(frag);
      container.appendChild(el);
      active.push(el);
      while (active.length > MAX_ACTIVE) { var old = active.shift(); if (old) old.remove(); }

      requestAnimationFrame(function () {
        if (el.parentElement !== container) return;
        el.style.left = targetX + 'px';
        el.style.top = targetY + 'px';
        for (var i = 0; i < layers.length; i++) {
          var s0 = i * (100 / SLICES), s1 = (i + 1) * (100 / SLICES);
          layers[i].style.clipPath = 'polygon(0% ' + s0 + '%,100% ' + s0 + '%,100% ' + s1 + '%,0% ' + s1 + '%)';
        }
      });

      schedule(function () {
        el.style.opacity = '0';
        el.style.transform = 'scale(.22)';
        for (var i = 0; i < layers.length; i++) {
          var s0 = i * (100 / SLICES), s1 = (i + 1) * (100 / SLICES);
          layers[i].style.transition = 'clip-path ' + CFG.outDuration + 'ms ' + CFG.easing;
          layers[i].style.transitionDelay = sliceDelay(i, CFG.staggerOut) + 'ms';
          layers[i].style.clipPath = 'polygon(50% ' + s0 + '%,50% ' + s0 + '%,50% ' + s1 + '%,50% ' + s1 + '%)';
        }
        schedule(function () {
          active = active.filter(function (x) { return x !== el; });
          el.remove();
        }, CFG.outDuration + maxSliceDelay(CFG.staggerOut));
      }, CFG.imageLifespan);
    }

    function loop() {
      if (pActive && !document.hidden) {
        ip.x += (p.x - ip.x) * SMOOTH;
        ip.y += (p.y - ip.y) * SMOOTH;
        var dx = ip.x - lastSpawn.x, dy = ip.y - lastSpawn.y;
        if (Math.sqrt(dx * dx + dy * dy) > THRESHOLD) { lastSpawn.x = ip.x; lastSpawn.y = ip.y; spawn(); }
      }
      raf = requestAnimationFrame(loop);
    }

    if (reduce || !fine) { if (cloud) cloud.remove(); return; }
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(loop);
  }

  document.querySelectorAll('[data-pixeltrail]').forEach(init);
})();
