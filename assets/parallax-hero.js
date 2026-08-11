/* ============================================================
   Parallax hero (vanilla port of the Osmo layered-parallax component).

   Ported changes worth noting:
     - The React original creates its OWN Lenis instance and GSAP ticker. We
       already run exactly one of each in lenis-init.js, and a second one would
       double-drive the scroll and fight the first. This file only builds the
       timeline and leaves the clock alone.
     - scrub:0 in the original snaps the layers straight to the scroll position.
       A small scrub value hands the motion to GSAP's interpolator instead, so
       a coarse wheel step glides rather than jumping.
     - Layers are cached once. No per-frame DOM queries or layout reads.

   Markup contract:  [data-parallax-layers] wrapper
                     [data-parallax-layer="1..4"] children, 1 = furthest back
   ============================================================ */
(function () {
  "use strict";

  var host = document.querySelector('[data-parallax-layers]');
  if (!host) return;

  /* Back layers travel furthest, the foreground barely moves: that difference
     is the whole illusion of depth. */
  var LAYERS = [
    { layer: '1', yPercent: 70 },
    { layer: '2', yPercent: 55 },
    { layer: '3', yPercent: 40 },
    { layer: '4', yPercent: 10 }
  ];

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* Without GSAP, or with reduced motion, the hero simply stays put. It is
     styled to look right at rest, so nothing is missing — it just does not
     drift. Never gate the visibility of the copy on this running. */
  if (reduce || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  var tl = gsap.timeline({
    scrollTrigger: {
      trigger: host,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.45,          /* see note above: 0 snaps, this glides */
      invalidateOnRefresh: true
    }
  });

  LAYERS.forEach(function (l, i) {
    var els = host.querySelectorAll('[data-parallax-layer="' + l.layer + '"]');
    if (!els.length) return;
    tl.to(els, { yPercent: l.yPercent, ease: 'none' }, i === 0 ? undefined : '<');
  });
})();
