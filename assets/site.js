(function(){
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var hasGsap = !!window.gsap;

  /* ---- nav ---- */
  var nav=document.getElementById('nav');
  if(nav){
    /* Native window.scroll fires with Lenis too (Lenis still ticks native scroll
       for ScrollTrigger), but we use Lenis's own event as the source of truth so
       the nav state is always in step with what Lenis reports. */
    var updateNav=function(scroll){ nav.classList.toggle('scrolled',(scroll||window.scrollY)>30); };
    if(window.__lenis){ window.__lenis.on('scroll',function(e){ updateNav(e.scroll); }); }
    else { window.addEventListener('scroll',function(){ updateNav(); },{passive:true}); }
    updateNav();
  }
  /* ---- fullscreen menu ---- */
  var burger=document.getElementById('burger'), drawer=document.getElementById('drawer');
  function setMenu(open){
    if(!burger || !drawer) return;
    drawer.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if(window.__lenis){ if(open && window.__lenis.stop) window.__lenis.stop(); else if(!open && window.__lenis.start) window.__lenis.start(); }
  }
  if(burger && drawer){
    burger.addEventListener('click',function(){ setMenu(!drawer.classList.contains('open')); });
    drawer.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){ setMenu(false); });});
    document.addEventListener('keydown',function(e){ if(e.key==='Escape' && drawer.classList.contains('open')) setMenu(false); });
  }

  /* ---- consultation chooser ---- */
  var chooser=document.getElementById('chooser');
  if(chooser){
    var openChooser=function(){chooser.classList.add('open');chooser.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
      if(window.__lenis&&window.__lenis.stop) window.__lenis.stop();};
    var closeChooser=function(){chooser.classList.remove('open');chooser.setAttribute('aria-hidden','true');document.body.style.overflow='';
      if(window.__lenis&&window.__lenis.start) window.__lenis.start();};
    document.querySelectorAll('[data-consult]').forEach(function(el){el.addEventListener('click',function(e){e.preventDefault();setMenu(false);openChooser();});});
    chooser.querySelectorAll('[data-close]').forEach(function(el){el.addEventListener('click',closeChooser);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeChooser();});
    chooser.querySelectorAll('.chooser-opt').forEach(function(a){a.addEventListener('click',function(){setTimeout(closeChooser,120);});});
  }

  /* ---- magnetic primary buttons: a restrained cursor-follow lean, fine-pointer devices only ---- */
  if(hasGsap && !reduce && window.matchMedia('(pointer:fine)').matches){
    document.querySelectorAll('.btn-primary').forEach(function(btn){
      var qx=gsap.quickTo(btn,'x',{duration:.5,ease:'power3'});
      var qy=gsap.quickTo(btn,'y',{duration:.5,ease:'power3'});
      btn.addEventListener('mousemove',function(e){
        var r=btn.getBoundingClientRect();
        qx((e.clientX-r.left-r.width/2)*.26);
        qy((e.clientY-r.top-r.height/2)*.45);
      });
      btn.addEventListener('mouseleave',function(){ qx(0); qy(0); });
    });
  }

  /* ---- reveals: GSAP ScrollTrigger.batch stagger when available, IntersectionObserver fallback ---- */
  var rvs=document.querySelectorAll('.rv');
  if(!rvs.length) return;
  if(reduce){
    rvs.forEach(function(e){e.classList.add('in');});
  } else if(hasGsap && window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.batch('.rv',{
      start:'top 88%',
      once:true,
      onEnter:function(batch){
        gsap.to(batch,{opacity:1,y:0,duration:.9,ease:'power3.out',stagger:.12,
          onComplete:function(){batch.forEach(function(e){e.classList.add('in');});}});
      }
    });
  } else if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});},{threshold:.16});
    rvs.forEach(function(e){io.observe(e);});
  } else {
    rvs.forEach(function(e){e.classList.add('in');});
  }
})();
