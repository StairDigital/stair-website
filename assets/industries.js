/* ============================================================
   Industries page
   1) Scroll-expand hero: the same idea as React Bits' ScrollExpandMedia,
      but driven by a pinned GSAP ScrollTrigger instead of hijacking the
      wheel. That keeps it in step with Lenis smooth scroll and never
      fights the browser, which is what made the original feel sticky.
   2) Industry rows reveal on scroll.
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var hasST = window.gsap && window.ScrollTrigger;

  /* ---------- 1. scroll-expand hero ---------- */
  var hero = document.getElementById('indHero');
  var pin = document.getElementById('ihPin');
  var media = document.getElementById('ihMedia');
  var veil = document.getElementById('ihVeil');
  var field = document.getElementById('ihField');
  var l1 = document.getElementById('ihL1');
  var l2 = document.getElementById('ihL2');
  var sub = document.getElementById('ihSub');
  var hint = document.getElementById('ihHint');

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }   /* outCubic */

  function applyHero(p) {
    if (!media) return;
    var e = ease(clamp01(p));

    /* the picture opens from a card to full bleed */
    media.style.width = lerp(32, 100, e).toFixed(2) + 'vw';
    media.style.height = lerp(44, 100, e).toFixed(2) + 'vh';
    media.style.borderRadius = lerp(20, 0, e).toFixed(1) + 'px';
    if (veil) veil.style.opacity = lerp(0.55, 0.34, e).toFixed(3);

    /* the two title lines part as it opens */
    var push = e * 46;                                  /* vw travelled apart */
    if (l1) l1.style.transform = 'translateX(' + (-push).toFixed(2) + 'vw)';
    if (l2) l2.style.transform = 'translateX(' + push.toFixed(2) + 'vw)';

    /* everything that would clutter the full-bleed frame steps back */
    var fade = clamp01((e - 0.55) / 0.4);
    if (l1) l1.style.opacity = (1 - fade).toFixed(3);
    if (l2) l2.style.opacity = (1 - fade).toFixed(3);
    if (sub) sub.style.opacity = (1 - clamp01(e / 0.45)).toFixed(3);
    if (hint) hint.style.opacity = (1 - clamp01(e / 0.28)).toFixed(3);
    if (field) field.style.opacity = lerp(1, 0.22, e).toFixed(3);
  }

  if (hero && pin) {
    if (reduce || !hasST) {
      /* no scrub available: present the finished state and let the page flow */
      hero.style.height = '100vh';
      applyHero(1);
      if (l1) { l1.style.transform = 'none'; l1.style.opacity = 1; }
      if (l2) { l2.style.transform = 'none'; l2.style.opacity = 1; }
    } else {
      gsap.registerPlugin(ScrollTrigger);
      applyHero(0);
      ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom bottom',
        pin: pin,
        pinSpacing: false,
        scrub: 0.55,
        onUpdate: function (self) { applyHero(self.progress); },
        onRefresh: function (self) { applyHero(self.progress); }
      });
    }
  }

  /* ---------- 2. industry rows reveal ---------- */
  var rows = Array.prototype.slice.call(document.querySelectorAll('.ind-row'));
  if (rows.length) {
    if (reduce) {
      rows.forEach(function (r) { r.classList.add('in'); });
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
      rows.forEach(function (r) { io.observe(r); });
    } else {
      rows.forEach(function (r) { r.classList.add('in'); });
    }
  }
})();
