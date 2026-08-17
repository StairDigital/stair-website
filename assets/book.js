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

  /* If rAF is throttled or the observer never fires for any reason, the book
     must not sit shut forever with its content invisible behind the jacket. */
  setTimeout(function () {
    if (!bkx.classList.contains('open')) bkx.classList.add('open');
  }, 4000);
})();
