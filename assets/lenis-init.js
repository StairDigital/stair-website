(function(){
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce || typeof Lenis==='undefined') return;

  var lenis = new Lenis({
    duration: 1.2,
    easing: function(t){ return t===1?1:1-Math.pow(2,-10*t); },
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.5,
    infinite: false
  });
  window.__lenis = lenis;

  if(window.gsap && window.ScrollTrigger){
    /* Keep ScrollTrigger in sync with Lenis's virtual scroll position */
    lenis.on('scroll', ScrollTrigger.update);
    /* Drive Lenis from GSAP's ticker so both run in one rAF */
    gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
    /* lagSmoothing(0) tells GSAP not to skip frames when the tab is
       briefly backgrounded — this prevents the hero from jumping. */
    gsap.ticker.lagSmoothing(0);
  } else {
    requestAnimationFrame(function raf(time){ lenis.raf(time); requestAnimationFrame(raf); });
  }
})();
