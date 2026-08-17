/* Home hero support.

   All the hero's own motion is CSS, so the only thing left for script is
   the nav: the home page hides its section links until the visitor has
   moved past the hero, then fades them in.

   The old hero-player.js drove this from the frame index of the canvas
   sequence. With the sequence gone it is one IntersectionObserver, which
   costs nothing and never touches layout on scroll. */
(function () {
  var hero = document.getElementById('hero');
  var nav = document.getElementById('nav');
  if (!hero || !nav || !document.getElementById('navLinks')) return;

  if (!('IntersectionObserver' in window)) { nav.classList.add('links-on'); return; }

  // Fire when the hero's last sliver leaves the top of the viewport. rootMargin
  // pulls the boundary down by the nav's own height so the links do not appear
  // while the hero is still sitting behind the bar.
  var io = new IntersectionObserver(function (entries) {
    nav.classList.toggle('links-on', !entries[0].isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px', threshold: 0 });

  io.observe(hero);
})();
