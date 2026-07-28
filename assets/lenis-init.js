(function(){
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce || typeof Lenis==='undefined') return;

  var lenis = new Lenis({
    duration: 1.05,
    easing: function(t){ return 1 - Math.pow(1 - t, 3); },
    smoothWheel: true
  });
  window.__lenis = lenis;

  if(window.gsap && window.ScrollTrigger){
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    requestAnimationFrame(function raf(time){ lenis.raf(time); requestAnimationFrame(raf); });
  }
})();
