/* ============================================================
   Liquid glass — drives the specular highlight on .lg surfaces.
   Writes --mx/--my (percent within the element) so the CSS radial
   sweep tracks the cursor, which is what sells it as thick glass
   rather than flat frost.

   Deliberately event-driven, not rAF: one rect read per pointer
   event on a hovered element only, so it adds nothing to scroll.
   ============================================================ */
(function () {
  "use strict";
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  if (!(window.matchMedia && window.matchMedia('(pointer:fine)').matches)) return;

  var nodes = document.querySelectorAll('.lg');
  if (!nodes.length) return;

  /* Skip any surface that carries a backdrop-filter.
     Writing --mx/--my repaints the element, and repainting an element with
     a backdrop-filter forces the browser to re-sample and re-blur the
     whole area behind it. On a page with several such surfaces that is a
     full-viewport blur per pointer move, which is what made hovering feel
     heavy. Those surfaces keep the static centred highlight; everything
     else still tracks the cursor. */
  nodes = Array.prototype.filter.call(nodes, function (el) {
    var cs = getComputedStyle(el);
    var bf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
    return bf === 'none' || bf === '';
  });
  if (!nodes.length) return;

  nodes.forEach(function (el) {
    var raf = null, px = 50, py = 50;

    function paint() {
      raf = null;
      el.style.setProperty('--mx', px.toFixed(1) + '%');
      el.style.setProperty('--my', py.toFixed(1) + '%');
    }

    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      px = ((e.clientX - r.left) / r.width) * 100;
      py = ((e.clientY - r.top) / r.height) * 100;
      /* coalesce to one write per frame while the pointer is inside */
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });

    el.addEventListener('pointerleave', function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '50%');
    });
  });
})();
