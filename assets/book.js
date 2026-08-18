/* The AI Auditor opens itself once, when it comes into view.

   Everything about the motion is CSS transitions on a single .open class
   (see book.css). All this does is decide when to add it, so there is no
   scroll handler and nothing measured per frame. */
(function () {
  "use strict";
  var bkx = document.getElementById('bookScroll');
  if (!bkx) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) { bkx.classList.add('no-anim'); return; }

  var io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    bkx.classList.add('open');
    io.disconnect();               /* it opens once; it never closes again */
  }, { threshold: 0.35 });

  io.observe(bkx);

  /* Failsafe, so the book can never sit shut with its content hidden behind
     the jacket if the observer misfires. It used to fire unconditionally
     four seconds after load, which meant that on a long page the book had
     already opened by the time anyone scrolled to it and the animation
     appeared never to happen. Now it only forces the issue if the section
     is actually on screen and still shut. */
  setInterval(function () {
    if (bkx.classList.contains('open')) return;
    var r = bkx.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.8 && r.bottom > 0) bkx.classList.add('open');
  }, 1200);
})();
