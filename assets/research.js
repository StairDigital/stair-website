/* ============================================================
   Research page

   The AI Auditor's scroll-opened book moved to the home page (assets/book.js);
   this page now presents it statically, so all that is left here is the
   work-card motif reveal.
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  var cards = Array.prototype.slice.call(document.querySelectorAll('.wk'));
  if (!cards.length) return;

  if (reduce || !('IntersectionObserver' in window)) {
    cards.forEach(function (c) { c.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.3 });
  cards.forEach(function (c) { io.observe(c); });
})();
