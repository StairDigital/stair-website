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
