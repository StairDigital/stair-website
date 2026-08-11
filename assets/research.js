/* ============================================================
   Research page
   1) The AI Auditor turns toward the cursor in real 3D (CSS transform-style
      preserve-3d, so the spine and page edge stay attached as it rotates).
   2) The two work cards animate their motifs in on scroll.
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;

  /* ---------- 1. the book opens as you scroll ----------
     Pinned ScrollTrigger rather than a wheel hijack, so it stays in step
     with Lenis. The book starts lying flat, lifts, then the jacket swings
     open on the spine to reveal the spread underneath. */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  var bkx = document.getElementById('bookScroll');
  var bkxPin = document.getElementById('bkxPin');
  var bkxBook = document.getElementById('bkxBook');
  var bkxCover = document.getElementById('bkxCover');
  var bkxLeft = document.getElementById('bkxLeft');
  var bkxRight = document.getElementById('bkxRight');
  var bkxHint = document.getElementById('bkxHint');

  function applyBook(p) {
    if (!bkxBook) return;

    /* lie flat, then rise to face the reader */
    var lift = easeInOut(seg(p, 0.02, 0.42));
    var rotX = lerp(66, 8, lift);
    var scale = lerp(0.82, 1, lift);
    var rotZ = lerp(-7, 0, lift);
    bkxBook.style.transform =
      'rotateX(' + rotX.toFixed(2) + 'deg) rotateZ(' + rotZ.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';

    /* the jacket swings off the spine */
    var open = easeInOut(seg(p, 0.30, 0.86));
    bkxCover.style.transform = 'rotateY(' + (-176 * open).toFixed(2) + 'deg)';

    /* the pages come up behind it */
    var l = easeOut(seg(p, 0.46, 0.74));
    var r = easeOut(seg(p, 0.58, 0.9));
    bkxLeft.style.opacity = l.toFixed(3);
    bkxLeft.style.transform = 'translateY(' + ((1 - l) * 14).toFixed(1) + 'px)';
    bkxRight.style.opacity = r.toFixed(3);
    bkxRight.style.transform = 'translateY(' + ((1 - r) * 14).toFixed(1) + 'px)';

    if (bkxHint) bkxHint.style.opacity = (1 - clamp01(p / 0.16)).toFixed(3);
  }

  if (bkx && bkxPin && bkxBook) {
    if (reduce || !window.gsap || !window.ScrollTrigger) {
      /* no scrub available: present the opened book and let the page flow */
      bkx.style.height = '100vh';
      applyBook(1);
    } else {
      gsap.registerPlugin(ScrollTrigger);
      applyBook(0);
      ScrollTrigger.create({
        trigger: bkx,
        start: 'top top',
        end: 'bottom bottom',
        pin: bkxPin,
        pinSpacing: false,
        scrub: 0.6,
        onUpdate: function (self) { applyBook(self.progress); },
        onRefresh: function (self) { applyBook(self.progress); }
      });
    }
  }

  /* ---------- 2. work-card motifs draw in on scroll ---------- */
  var cards = Array.prototype.slice.call(document.querySelectorAll('.wk'));
  if (cards.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      cards.forEach(function (c) { c.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.3 });
      cards.forEach(function (c) { io.observe(c); });
    }
  }
})();
