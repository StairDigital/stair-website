(function(){
  "use strict";
  var cards = Array.from(document.querySelectorAll('.ssc'));
  if(!cards.length) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var hasST = window.gsap && window.ScrollTrigger;
  var stack = window.matchMedia('(max-width:820px)').matches;

  function smooth(a,b,x){ var t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); }

  /* mobile / reduced-motion / no-GSAP: CSS shows the banner + a flat 2x2 grid of the backs */
  if(stack || reduce || !hasST) return;

  gsap.registerPlugin(ScrollTrigger);

  function render(card, p){
    var panels = card.__panels, stageW = card.__stage.clientWidth;
    var maxGap = stageW * 0.055;          /* how far the strips spread apart */
    var sep = smooth(0, 0.40, p);         /* phase 1: the image separates into strips */
    for(var i=0;i<panels.length;i++){
      var tx = (i - 1.5) * maxGap * sep;
      var fs = 0.42 + i*0.13, fe = fs + 0.20;   /* phase 2: staggered left-to-right flip */
      var rot = -180 * smooth(fs, fe, p);
      panels[i].style.transform = 'translateX('+tx.toFixed(1)+'px) rotateY('+rot.toFixed(1)+'deg)';
    }
  }

  cards.forEach(function(card){
    card.__stage = card.querySelector('.ssc-stage');
    card.__panels = Array.from(card.querySelectorAll('.ssc-panel'));
    render(card, 0);
    ScrollTrigger.create({
      trigger: card,
      start: 'top top',
      end: '+=185%',
      pin: card.querySelector('.ssc-pin'),
      pinSpacing: true,
      scrub: true,
      onUpdate: function(self){ render(card, self.progress); },
      onRefresh: function(){ render(card, 0); }
    });
  });
})();
