(function(){
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var hasST = window.gsap && window.ScrollTrigger;
  if(hasST) gsap.registerPlugin(ScrollTrigger);

  /* ============ HERO: scroll-scrubbed image sequence ============ */
  var canvas=document.getElementById('heroCanvas');
  var ctx=canvas.getContext('2d');
  var pin=document.getElementById('heroPin');
  var title=document.getElementById('heroTitle'), titleDock=document.getElementById('heroTitleDocked');
  var scrim=document.getElementById('heroScrim'), pulse=document.getElementById('pulse');
  var figL=document.getElementById('figL'), figC=document.getElementById('figC'), figR=document.getElementById('figR');
  var cap=document.getElementById('cap');
  var cards=[document.getElementById('o1'),document.getElementById('o2'),document.getElementById('o3')];
  var heroLoad=document.getElementById('heroLoad');
  var n40=document.getElementById('n40'), n100=document.getElementById('n100'), n13=document.getElementById('n13');
  var n10=document.getElementById('n10'), n24=document.getElementById('n24'), n36=document.getElementById('n36');
  var n40b=document.getElementById('n40b'), n70=document.getElementById('n70');

  var FILM_START=0.05, FILM_END=0.86;   /* the film completes as the clasp lands; the finale grows out of it */
  var HS_X=0.50, HS_Y=0.52;             /* handshake point in frame coordinates */

  var FRAMES=(typeof HERO_FRAMES!=='undefined')?HERO_FRAMES:[];
  var N=FRAMES.length, maxIdx=Math.max(0,N-1);
  var useBitmaps=('createImageBitmap' in window) && N>0;

  /* ---- frame store: bounded ImageBitmap ring buffer (pre-decoded, GPU-ready, memory-capped) ---- */
  var blobs=new Array(N), bitmaps=new Map(), pending=new Map();
  var CACHE_MAX=32, AHEAD=10;
  var imgs=null; /* legacy fallback */

  function b64ToBlob(b64){
    var bin=atob(b64), len=bin.length, u8=new Uint8Array(len);
    for(var i=0;i<len;i++) u8[i]=bin.charCodeAt(i);
    return new Blob([u8],{type:'image/webp'});
  }
  function trimCache(center){
    if(bitmaps.size<=CACHE_MAX) return;
    var keys=Array.from(bitmaps.keys()).sort(function(a,b){return Math.abs(b-center)-Math.abs(a-center);});
    while(bitmaps.size>CACHE_MAX && keys.length){
      var k=keys.shift();
      if(k===0||k===maxIdx) continue; /* keep the poster and finale frames resident */
      var bm=bitmaps.get(k); bitmaps.delete(k);
      if(bm && bm.close) bm.close();
    }
  }
  function ensure(i){
    if(i<0||i>maxIdx||bitmaps.has(i)||pending.has(i)) return;
    if(!blobs[i]) blobs[i]=b64ToBlob(FRAMES[i]);
    var p=createImageBitmap(blobs[i]).then(function(bm){
      bitmaps.set(i,bm); pending.delete(i); trimCache(Math.round(curPos));
      if(i===Math.round(curPos) && i!==lastDrawnIndex) draw(i);
    }).catch(function(){ pending.delete(i); });
    pending.set(i,p);
  }
  function nearestReady(i){
    if(bitmaps.has(i)) return i;
    for(var d=1;d<=maxIdx;d++){
      if(bitmaps.has(i-d)) return i-d;
      if(bitmaps.has(i+d)) return i+d;
    }
    return -1;
  }

  /* ---- geometry: measured once per resize, never inside the draw loop ---- */
  var geo={pw:0,ph:0,dx:0,dy:0,dw:0,dh:0,natW:1680,natH:944};
  var hsPt={x:0,y:0}, deltas=[{x:0,y:0},{x:0,y:0},{x:0,y:0}];
  function smoothingOn(){ ctx.imageSmoothingEnabled=true; try{ctx.imageSmoothingQuality='medium';}catch(e){} }
  function measure(){
    var cw=canvas.clientWidth, ch=canvas.clientHeight;
    /* Cap dpr to 1.25 maximum for the canvas. The source frames are 1680x944, so allocating
       3000x1800 2x DPR buffers wastes GPU memory and causes heavy fill-rate lag. */
    var dpr=Math.max(1, Math.min(window.devicePixelRatio||1, 1.25));
    var pw=Math.round(cw*dpr), ph=Math.round(ch*dpr);
    if(canvas.width!==pw||canvas.height!==ph){ canvas.width=pw; canvas.height=ph; smoothingOn(); }
    geo.pw=pw; geo.ph=ph;
    var s=Math.min(pw/geo.natW, ph/geo.natH);
    geo.dw=geo.natW*s; geo.dh=geo.natH*s;
    geo.dx=(pw-geo.dw)/2; geo.dy=(ph-geo.dh)/2;
    /* handshake point in CSS px, relative to the pin */
    hsPt.x=(geo.dx+geo.dw*HS_X)/dpr + canvas.offsetLeft;
    hsPt.y=(geo.dy+geo.dh*HS_Y)/dpr + canvas.offsetTop;
    pulse.style.left=(hsPt.x-6)+'px'; pulse.style.top=(hsPt.y-6)+'px';
    /* card birth vectors: measured with transforms cleared */
    for(var i=0;i<3;i++) cards[i].style.transform='none';
    var pr=pin.getBoundingClientRect();
    for(var j=0;j<3;j++){
      var r=cards[j].getBoundingClientRect();
      deltas[j]={x:hsPt.x-(r.left-pr.left+r.width/2), y:hsPt.y-(r.top-pr.top+r.height/2)};
    }
  }

  var lastDrawnIndex=-1;
  function draw(i){
    var src=null;
    if(useBitmaps){
      var r=nearestReady(i); if(r<0) return;
      src=bitmaps.get(r); i=r;
    }else{
      var im=imgs&&imgs[i];
      if(!im||!im.complete||!im.naturalWidth) return;
      src=im;
    }
    ctx.clearRect(0,0,geo.pw,geo.ph);
    ctx.fillStyle='#FAF8F3';
    ctx.fillRect(0,0,geo.pw,geo.ph);
    ctx.drawImage(src,geo.dx,geo.dy,geo.dw,geo.dh);
    lastDrawnIndex=i;
  }

  /* ---- unified ticker: advances film frame AND drives UI in one rAF pass ---- */
  var targetPos=0, curPos=0, raf=null;
  function posFor(p){ var t=(p-FILM_START)/(FILM_END-FILM_START); return Math.max(0,Math.min(1,t))*maxIdx; }

  /* ---- UI animation: driven from tick() above, not its own rAF ---- */
  var uiPos=0;
  function sm(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
  function outCubic(t){t=Math.max(0,Math.min(1,t));return 1-Math.pow(1-t,3);}
  var cntCache={};
  function cnt(el,to,a,b,p){
    var v=Math.round(outCubic((p-a)/(b-a))*to);
    if(cntCache[el.id]!==v){ cntCache[el.id]=v; el.textContent=v; }
  }
  function figShow(el,a,b,p,fade){
    var v=sm(a,b,p)*(1-fade);
    el.style.opacity=v.toFixed(3);
    el.style.transform='translate3d(0,'+((1-v)*16).toFixed(1)+'px,0)';
  }

  var CARDW=[[0.855,0.955],[0.885,0.985],[0.915,1.0]];
  function updateUI(p){
    /* title crossfade: large centred intro hands over to the docked mark */
    var dk=sm(0.012,0.05,p);
    title.style.opacity=(1-dk).toFixed(3);
    title.style.transform='translate3d(-50%,-50%,0) translateY('+(-26*dk).toFixed(1)+'px) scale('+(1-0.05*dk).toFixed(3)+')';
    titleDock.style.opacity=dk.toFixed(3);
    titleDock.style.transform='translate3d(0,'+(10*(1-dk)).toFixed(1)+'px,0)';
    canvas.style.opacity = p>0.006 ? 1 : 0;

    /* the three input figures */
    var fade=sm(0.72,0.82,p);
    figShow(figL,0.10,0.20,p,fade); cnt(n40,40,0.10,0.34,p);
    figShow(figC,0.28,0.38,p,fade); cnt(n100,100,0.28,0.52,p);
    figShow(figR,0.46,0.56,p,fade); cnt(n13,13,0.46,0.70,p);

    /* the film recedes: focus scrim */
    scrim.style.opacity=(0.98*sm(0.82,0.93,p)).toFixed(3);

    /* pulse: rings born at the clasp */
    var pu=sm(0.80,0.90,p);
    var puOp = (pu<=0||pu>=1) ? 0 : (pu<0.25 ? pu/0.25 : 1-(pu-0.25)/0.75);
    pulse.style.opacity=puOp.toFixed(3);
    pulse.style.transform='scale3d('+(1+pu*26).toFixed(2)+','+(1+pu*26).toFixed(2)+',1)';

    /* caption: settles in below the cards, once they have arrived */
    var c=sm(0.93,0.99,p);
    cap.style.opacity=c.toFixed(3);
    cap.style.transform='translate3d(0,'+((1-c)*12).toFixed(1)+'px,0)';

    /* outcome cards: emerge from the handshake point with stagger */
    for(var i=0;i<3;i++){
      var e=outCubic(sm(CARDW[i][0],CARDW[i][1],p));
      var d=deltas[i];
      cards[i].style.opacity=Math.min(1,e*1.5).toFixed(3);
      cards[i].style.transform='translate3d('+(d.x*(1-e)).toFixed(1)+'px,'+(d.y*(1-e)).toFixed(1)+'px,0) scale('+(0.42+0.58*e).toFixed(3)+')';
    }
    cnt(n10,10,CARDW[0][0],CARDW[0][1],p);
    cnt(n24,24,CARDW[1][0],CARDW[1][1],p); cnt(n36,36,CARDW[1][0],CARDW[1][1],p);
    cnt(n40b,40,CARDW[2][0],CARDW[2][1],p); cnt(n70,70,CARDW[2][0],CARDW[2][1],p);

    /* the sequence has played out: hand the nav over to the section buttons */
    setNavLinks(p>=0.985);
  }

  /* home-only: reveal the section buttons once the hero has finished */
  var navEl=document.getElementById('nav'), linksOn=null;
  function setNavLinks(on){
    if(!navEl || !document.getElementById('navLinks') || linksOn===on) return;
    linksOn=on;
    navEl.classList.toggle('links-on', on);
  }

  var uiRaf=null, lastP=0, animated=false;
  function uiTick(){
    uiPos = lastP;
    updateUI(lastP);
  }
  function applyStatic(){
    title.style.opacity=0;
    titleDock.style.opacity=1; titleDock.style.transform='none';
    scrim.style.opacity=0.6;
    cap.style.opacity=1; cap.style.transform='none';
    cards.forEach(function(cd){ cd.style.opacity=1; cd.style.transform='none'; });
    n10.textContent='10'; n24.textContent='24'; n36.textContent='36'; n40b.textContent='40'; n70.textContent='70';
    canvas.style.opacity=1;
    setNavLinks(true);
  }
  function remeasure(){ measure(); if(animated) updateUI(uiPos); else applyStatic(); if(lastDrawnIndex>=0) draw(lastDrawnIndex); }

  if('ResizeObserver' in window){ new ResizeObserver(function(){ remeasure(); }).observe(pin); }
  else{ window.addEventListener('resize',remeasure); }

  smoothingOn();
  measure();

  /* ---- boot: decode poster frame immediately, pre-warm Blobs in idle background tasks ---- */
  function bootBitmaps(){
    blobs[0]=b64ToBlob(FRAMES[0]);
    createImageBitmap(blobs[0]).then(function(bm){
      bitmaps.set(0,bm);
      if(heroLoad) heroLoad.classList.add('hide');
      draw(Math.round(curPos));
    });
    for(var k=1;k<=16;k++) ensure(k);
    ensure(maxIdx);

    /* Background idle pre-decoding: convert all base64 frames to Blobs off the scroll loop */
    var bgIdx = 17;
    function preDecodeIdle(){
      var end = Math.min(N, bgIdx + 8);
      for(var i = bgIdx; i < end; i++){
        if(!blobs[i]) blobs[i] = b64ToBlob(FRAMES[i]);
      }
      bgIdx = end;
      if(bgIdx < N){
        if('requestIdleCallback' in window) requestIdleCallback(preDecodeIdle);
        else setTimeout(preDecodeIdle, 20);
      }
    }
    if('requestIdleCallback' in window) requestIdleCallback(preDecodeIdle);
    else setTimeout(preDecodeIdle, 40);
  }
  function bootImages(onFirst){
    imgs=new Array(N);
    var loaded=0, firstFired=false;
    FRAMES.forEach(function(src,i){
      var im=new Image();
      im.onload=function(){
        loaded++;
        if(!firstFired){ firstFired=true; if(onFirst) onFirst(); }
      };
      im.onerror=function(){ loaded++; };
      im.src='data:image/webp;base64,'+src;
      imgs[i]=im;
    });
  }

  if(reduce || !hasST || !N){
    /* static fallback: the meeting already made, the outcomes already on the table */
    document.getElementById('hero').classList.add('static');
    document.getElementById('figures').style.display='none';
    applyStatic();
    curPos=targetPos=maxIdx;
    if(useBitmaps){
      if(heroLoad) heroLoad.classList.add('hide');
      ensure(maxIdx);
    }else if(N){
      bootImages(function(){ if(heroLoad) heroLoad.classList.add('hide'); draw(maxIdx); });
      var poll=setInterval(function(){ if(imgs[maxIdx]&&imgs[maxIdx].complete){ draw(maxIdx); clearInterval(poll); } },120);
    }
  } else {
    animated=true;
    if(useBitmaps) bootBitmaps();
    else bootImages(function(){ if(heroLoad) heroLoad.classList.add('hide'); draw(0); });

    /* Direct response scrub on GSAP's ticker: map targetPos directly to curPos.
       Lenis ALREADY smoothly eases the scroll progress. Direct response means zero
       artificial double-lerp delay — 1:1 crisp responsiveness! */
    gsap.ticker.add(function(){
      if(!animated) return;
      curPos = targetPos;
      var idx = Math.round(curPos);
      if(useBitmaps){
        var dir = targetPos >= curPos ? 1 : -1;
        ensure(idx);
        for(var k=1; k<=AHEAD; k++) ensure(idx + k);
        for(var m=1; m<=3; m++) ensure(idx - m);
      }
      if(idx!==lastDrawnIndex) draw(idx);
      uiTick();
    });

    function buildHeroTrigger(){
      ScrollTrigger.create({
        trigger:'#hero', start:'top top', end:'bottom bottom',
        pin:'#heroPin', pinSpacing:true, scrub:true,
        anticipatePin: 1,
        onUpdate:function(self){
          /* Just write the targets — the gsap.ticker callback above
             picks them up in the same frame, no rAF scheduling needed. */
          lastP=self.progress;
          targetPos=posFor(lastP);
        },
        onRefresh:function(){ remeasure(); }
      });
      updateUI(0);
      /* re-measure once the page is genuinely done settling */
      if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ ScrollTrigger.refresh(); });
      window.addEventListener('load', function(){ ScrollTrigger.refresh(); });
      setTimeout(function(){ ScrollTrigger.refresh(); }, 300);
      /* and whenever the pin's own box changes size for real */
      if('ResizeObserver' in window){
        var lastW = pin.clientWidth;
        new ResizeObserver(function(){
          if(Math.abs(pin.clientWidth - lastW) > 1){ lastW = pin.clientWidth; ScrollTrigger.refresh(); }
        }).observe(pin.parentElement || pin);
      }
    }
    (function waitForLayout(tries){
      if(pin.clientWidth > 0 || tries > 60) buildHeroTrigger();
      else requestAnimationFrame(function(){ waitForLayout(tries+1); });
    })(0);
  }
})();
