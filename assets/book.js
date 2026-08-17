/* ============================================================
   The AI Auditor — scroll-opened book

   Lived on the Research page; now the home page's proof block, because
   the book is the single most credible object the firm owns and it was
   three scrolls deep on a page most visitors never reached.

   Pinned ScrollTrigger rather than a wheel hijack, so it stays in step
   with Lenis. The book starts lying flat, lifts to face the reader, then
   the jacket swings open on the spine to reveal the spread underneath.
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

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
  if (!bkx || !bkxPin || !bkxBook) return;

  function applyBook(p) {
    /* lie flat, then rise to face the reader */
    var lift = easeInOut(seg(p, 0.02, 0.42));
    bkxBook.style.transform =
      'rotateX(' + lerp(66, 8, lift).toFixed(2) + 'deg) ' +
      'rotateZ(' + lerp(-7, 0, lift).toFixed(2) + 'deg) ' +
      'scale(' + lerp(0.82, 1, lift).toFixed(3) + ')';

    /* the jacket swings off the spine */
    bkxCover.style.transform = 'rotateY(' + (-176 * easeInOut(seg(p, 0.30, 0.86))).toFixed(2) + 'deg)';

    /* the pages come up behind it */
    var l = easeOut(seg(p, 0.46, 0.74));
    var r = easeOut(seg(p, 0.58, 0.9));
    bkxLeft.style.opacity = l.toFixed(3);
    bkxLeft.style.transform = 'translateY(' + ((1 - l) * 14).toFixed(1) + 'px)';
    bkxRight.style.opacity = r.toFixed(3);
    bkxRight.style.transform = 'translateY(' + ((1 - r) * 14).toFixed(1) + 'px)';

    if (bkxHint) bkxHint.style.opacity = (1 - clamp01(p / 0.16)).toFixed(3);
  }

  if (reduce || !window.gsap || !window.ScrollTrigger) {
    /* no scrub available: present the opened book and let the page flow */
    bkx.style.height = 'auto';
    bkxPin.style.height = 'auto';
    bkxPin.style.padding = 'clamp(70px,10vh,120px) 0';
    applyBook(1);
    return;
  }

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
})();
