(function(){
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce || typeof Lenis==='undefined') return;

  /* Touch devices keep their NATIVE scroll on purpose.
     Lenis can smooth touch as well (syncTouch), but on a phone that means every
     finger drag is re-driven from JS on the main thread — the same thread the
     WebGL fields are already on — so it reads as lag and fights the browser's
     own fling physics. Native momentum scrolling is compositor driven and is
     already the smoothest thing on the device. We only take over the wheel. */
  var lenis = new Lenis({
    duration: 0.95,                 /* slightly snappier than 1.05: less float */
    easing: function(t){ return 1 - Math.pow(1 - t, 3); },
    smoothWheel: true,
    syncTouch: false,               /* explicit: never intercept touch */
    touchMultiplier: 1.6,
    wheelMultiplier: 1
  });
  window.__lenis = lenis;

  if(window.gsap && window.ScrollTrigger){
    lenis.on('scroll', ScrollTrigger.update);
    /* one clock drives Lenis, GSAP and every canvas effect, so scroll and
       animation can never drift into two competing rhythms */
    gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    requestAnimationFrame(function raf(time){ lenis.raf(time); requestAnimationFrame(raf); });
  }
})();
