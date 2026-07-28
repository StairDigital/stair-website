/* ============================================================
   STAIR DIGITAL — scroll-driven 3D handshake hero
   A tailored-suit executive (left) and a sleek AI robot (right)
   walk in from the sides and shake hands. Hand-built, procedural.
   Driven by StairHandshake.setProgress(p), p in [0,1].
   ============================================================ */
(function(){
  "use strict";

  var C = {
    ivory:0xFAF8F3, surface:0xE7F1EE,
    teal:0x0E9C93, tealDeep:0x0B857D, amber:0xF0854B,
    navy:0x2E4272, navyD:0x22314F, navyL:0x3E5488,
    shirt:0xF4F2EC, tie:0x8C3341, skin:0xE7C4A0, skinD:0xD9B189, hair:0xB9BCC1,
    shoe:0x1A1613,
    roboW:0xF5F7F6, roboS:0xCBD4D0, roboD:0x8DA09A, eye:0x0E9C93
  };
  var MEET=0.60, START=3.4, CLASP={y:1.18, z:0.18};

  var THREEJS, renderer, scene, camera, canvas, small=false;
  var human, robot, burst, glowSprite, clasplight;
  var ready=false, onReady=null, reduced=false, running=true, looping=false;
  var targetP=0, dispP=0;
  var mouse={x:0,y:0}, mLerp={x:0,y:0};

  function mat(c,o){o=o||{};return new THREEJS.MeshStandardMaterial({color:c,
    roughness:o.rough!==undefined?o.rough:0.6,metalness:o.metal!==undefined?o.metal:0.04,
    emissive:o.emissive!==undefined?o.emissive:0x000000,emissiveIntensity:o.ei!==undefined?o.ei:1});}
  function gloss(c,o){o=o||{};return new THREEJS.MeshPhysicalMaterial({color:c,
    roughness:o.rough!==undefined?o.rough:0.3,metalness:o.metal!==undefined?o.metal:0.1,
    clearcoat:o.cc!==undefined?o.cc:1,clearcoatRoughness:o.ccr!==undefined?o.ccr:0.18,
    emissive:o.emissive!==undefined?o.emissive:0x000000,emissiveIntensity:o.ei!==undefined?o.ei:1});}
  function cap(r,l,m){return new THREEJS.Mesh(new THREEJS.CapsuleGeometry(r,l,8,18),m);}
  function bx(w,h,d,m){return new THREEJS.Mesh(new THREEJS.BoxGeometry(w,h,d),m);}
  function sph(r,m){return new THREEJS.Mesh(new THREEJS.SphereGeometry(r,26,22),m);}
  function shadows(o){o.traverse(function(c){if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});}
  function ease(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function smooth(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
  function lerp(a,b,t){return a+(b-a)*t;}

  /* ---- limbs (jointed groups) ---- */
  function armHuman(sleeve,skin,handMat){
    var g=new THREEJS.Group();
    var up=cap(0.055,0.20,sleeve); up.position.y=-0.13; g.add(up);
    var el=new THREEJS.Group(); el.position.y=-0.26; g.add(el);
    var lo=cap(0.048,0.18,sleeve); lo.position.y=-0.12; el.add(lo);
    var cuff=cap(0.05,0.02,skin); cuff.position.y=-0.24; el.add(cuff);
    var hand=sph(0.062,handMat); hand.scale.set(1.0,0.9,0.75); hand.position.y=-0.30; el.add(hand);
    g.userData={elbow:el,hand:hand}; return g;
  }
  function armRobot(white,silver,glowJ){
    var g=new THREEJS.Group();
    var sh=sph(0.062,silver); g.add(sh);
    var up=cap(0.05,0.19,white); up.position.y=-0.13; g.add(up);
    var el=new THREEJS.Group(); el.position.y=-0.26; g.add(el);
    var ej=sph(0.05,glowJ); el.add(ej);
    var lo=cap(0.044,0.17,silver); lo.position.y=-0.12; el.add(lo);
    var hand=sph(0.062,white); hand.scale.set(1.0,0.9,0.78); hand.position.y=-0.29; el.add(hand);
    g.userData={elbow:el,hand:hand}; return g;
  }
  function legHuman(trouser,shoe,face){
    var g=new THREEJS.Group();
    var up=cap(0.075,0.24,trouser); up.position.y=-0.15; g.add(up);
    var kn=new THREEJS.Group(); kn.position.y=-0.30; g.add(kn);
    var lo=cap(0.062,0.22,trouser); lo.position.y=-0.14; kn.add(lo);
    var sh=bx(0.24,0.07,0.11,shoe); sh.position.set(face*0.06,-0.28,0); kn.add(sh);
    var toe=bx(0.09,0.05,0.10,shoe); toe.position.set(face*0.15,-0.29,0); kn.add(toe);
    g.userData={knee:kn}; return g;
  }
  function legRobot(white,silver,glowJ){
    var g=new THREEJS.Group();
    var up=cap(0.072,0.22,white); up.position.y=-0.14; g.add(up);
    var kn=new THREEJS.Group(); kn.position.y=-0.29; g.add(kn);
    var kj=sph(0.058,glowJ); kn.add(kj);
    var lo=cap(0.06,0.20,silver); lo.position.y=-0.13; kn.add(lo);
    var ft=bx(0.20,0.07,0.11,silver); ft.position.set(-0.05,-0.27,0); kn.add(ft);
    g.userData={knee:kn}; return g;
  }

  /* ---------- THE EXECUTIVE (tailored navy suit) ---------- */
  function buildHuman(){
    var root=new THREEJS.Group();
    var navy=mat(C.navy,{rough:0.62}), navyD=mat(C.navyD,{rough:0.6}), navyL=mat(C.navyL,{rough:0.62});
    var shirt=mat(C.shirt,{rough:0.5}), skin=mat(C.skin,{rough:0.65}), skinD=mat(C.skinD,{rough:0.65});
    var hair=mat(C.hair,{rough:0.75}), tie=mat(C.tie,{rough:0.5}), shoe=mat(C.shoe,{rough:0.4,metal:0.2});

    /* pelvis + legs */
    var hips=bx(0.30,0.18,0.20,navy); hips.position.y=0.88; root.add(hips);
    var legF=legHuman(navy,shoe,1), legB=legHuman(navy,shoe,1);
    legF.position.set(0,0.86,0.08); legB.position.set(0,0.86,-0.08); root.add(legF); root.add(legB);

    /* torso / jacket */
    var torso=new THREEJS.Group(); torso.position.y=0.96; root.add(torso);
    var jacket=cap(0.17,0.30,navy); jacket.scale.set(1.16,1,0.82); jacket.position.y=0.20; torso.add(jacket);
    /* shoulders (rounded, tailored) */
    var shL=sph(0.10,navyL); shL.position.set(0.0,0.36,0.185); torso.add(shL);
    var shR=sph(0.10,navyL); shR.position.set(0.0,0.36,-0.185); torso.add(shR);
    /* lapels V + shirt + tie on +x front */
    var shirtV=bx(0.10,0.30,0.05,shirt); shirtV.position.set(0.175,0.19,0); torso.add(shirtV);
    var collar=bx(0.14,0.06,0.20,shirt); collar.position.set(0.14,0.34,0); torso.add(collar);
    var lapL=bx(0.075,0.26,0.03,navyD); lapL.position.set(0.178,0.22,0.075); lapL.rotation.z=0.32; lapL.rotation.x=-0.12; torso.add(lapL);
    var lapR=bx(0.075,0.26,0.03,navyD); lapR.position.set(0.178,0.22,-0.075); lapR.rotation.z=0.32; lapR.rotation.x=0.12; torso.add(lapR);
    var tieK=bx(0.05,0.05,0.03,tie); tieK.position.set(0.205,0.30,0); torso.add(tieK);
    var tieB=bx(0.05,0.22,0.03,tie); tieB.position.set(0.205,0.16,0); tieB.rotation.z=0.02; torso.add(tieB);
    var btn1=sph(0.012,navyD); btn1.position.set(0.20,0.10,0); torso.add(btn1);
    var btn2=sph(0.012,navyD); btn2.position.set(0.20,0.02,0); torso.add(btn2);
    var pocket=bx(0.05,0.008,0.04,shirt); pocket.position.set(0.11,0.28,0.13); torso.add(pocket);

    /* neck + head */
    var neck=cap(0.045,0.05,skinD); neck.position.y=0.42; torso.add(neck);
    var head=sph(0.125,skin); head.scale.set(0.92,1.08,0.96); head.position.set(0.02,0.57,0); torso.add(head);
    var jaw=bx(0.10,0.07,0.14,skin); jaw.position.set(0.06,0.49,0); torso.add(jaw);
    var nose=bx(0.04,0.05,0.045,skinD); nose.position.set(0.135,0.55,0); torso.add(nose);
    var browL=bx(0.02,0.015,0.03,hair); browL.position.set(0.115,0.60,0.05); torso.add(browL);
    var browR=bx(0.02,0.015,0.03,hair); browR.position.set(0.115,0.60,-0.05); torso.add(browR);
    var eyeL=sph(0.017,mat(0x2A2622)); eyeL.position.set(0.115,0.575,0.05); torso.add(eyeL);
    var eyeR=sph(0.017,mat(0x2A2622)); eyeR.position.set(0.115,0.575,-0.05); torso.add(eyeR);
    var earL=sph(0.028,skin); earL.position.set(-0.01,0.55,0.115); torso.add(earL);
    var earR=sph(0.028,skin); earR.position.set(-0.01,0.55,-0.115); torso.add(earR);
    /* hair — swept, covers top/back/sides, open face */
    var hairTop=sph(0.135,hair); hairTop.scale.set(0.98,0.78,1.02); hairTop.position.set(-0.01,0.635,0); torso.add(hairTop);
    var hairBack=bx(0.10,0.20,0.24,hair); hairBack.position.set(-0.075,0.55,0); torso.add(hairBack);
    var part=bx(0.11,0.03,0.02,hair); part.position.set(0.06,0.665,0.06); part.rotation.z=-0.2; torso.add(part);

    /* arms */
    var armIn=armHuman(navy,skin,skin); armIn.position.set(0.02,0.33,0.185); torso.add(armIn);
    var armOut=armHuman(navy,skin,skin); armOut.position.set(0.02,0.33,-0.185); torso.add(armOut);

    root.userData={armIn:armIn,armOut:armOut,legF:legF,legB:legB,head:head,torso:torso};
    shadows(root); return root;
  }

  /* ---------- THE AI ROBOT (sleek white / teal) ---------- */
  function buildRobot(){
    var root=new THREEJS.Group();
    var white=gloss(C.roboW,{rough:0.22,cc:1,ccr:0.1}), silver=gloss(C.roboS,{rough:0.3,metal:0.5,cc:0.7});
    var dark=mat(C.roboD,{rough:0.4,metal:0.5});
    var glow=mat(C.teal,{rough:0.3,metal:0.15,emissive:C.teal,ei:0.75});
    var eye=mat(C.eye,{rough:0.3,emissive:C.eye,ei:1.7});

    var hips=bx(0.26,0.16,0.19,silver); hips.position.y=0.88; root.add(hips);
    var legF=legRobot(white,silver,glow), legB=legRobot(white,silver,glow);
    legF.position.set(0,0.86,0.08); legB.position.set(0,0.86,-0.08); root.add(legF); root.add(legB);

    var torso=new THREEJS.Group(); torso.position.y=0.96; root.add(torso);
    var chest=cap(0.155,0.28,white); chest.scale.set(1.14,1,0.86); chest.position.y=0.20; torso.add(chest);
    var seam=bx(0.015,0.26,0.14,silver); seam.position.set(0.135,0.20,0); torso.add(seam);
    var core=sph(0.05,glow); core.position.set(-0.13,0.22,0); torso.add(core);
    var coreR=new THREEJS.Mesh(new THREEJS.TorusGeometry(0.075,0.01,10,26),glow); coreR.position.set(-0.125,0.22,0); coreR.rotation.y=Math.PI/2; torso.add(coreR);
    var shL=sph(0.092,silver); shL.position.set(0,0.36,0.18); torso.add(shL);
    var shR=sph(0.092,silver); shR.position.set(0,0.36,-0.18); torso.add(shR);
    var neck=bx(0.07,0.07,0.09,dark); neck.position.y=0.42; torso.add(neck);
    /* head — smooth, dark visor facing -x (toward human), teal eyes */
    var head=sph(0.135,white); head.scale.set(1.0,1.06,1.0); head.position.set(-0.01,0.57,0); torso.add(head);
    var visor=cap(0.02,0.13,mat(0x1C3A37,{rough:0.15,metal:0.4})); visor.rotation.x=Math.PI/2; visor.position.set(-0.115,0.575,0); torso.add(visor);
    var eyeL=sph(0.024,eye); eyeL.position.set(-0.125,0.585,0.05); torso.add(eyeL);
    var eyeR=sph(0.024,eye); eyeR.position.set(-0.125,0.585,-0.05); torso.add(eyeR);
    var earL=sph(0.026,glow); earL.position.set(0.02,0.57,0.135); torso.add(earL);
    var earR=sph(0.026,glow); earR.position.set(0.02,0.57,-0.135); torso.add(earR);
    var ant=cap(0.008,0.06,glow); ant.position.set(-0.02,0.70,0); torso.add(ant);

    var armIn=armRobot(white,silver,glow); armIn.position.set(-0.02,0.33,0.18); torso.add(armIn);
    var armOut=armRobot(white,silver,glow); armOut.position.set(-0.02,0.33,-0.18); torso.add(armOut);

    root.userData={armIn:armIn,armOut:armOut,legF:legF,legB:legB,head:head,torso:torso};
    shadows(root); return root;
  }

  /* ---------- studio + fx ---------- */
  function studioTex(){
    var cv=document.createElement('canvas'); cv.width=64; cv.height=512; var x=cv.getContext('2d');
    var g=x.createLinearGradient(0,0,0,512);
    g.addColorStop(0,'#FCFAF6'); g.addColorStop(0.5,'#EFF4F1'); g.addColorStop(1,'#E2ECE8');
    x.fillStyle=g; x.fillRect(0,0,64,512);
    var t=new THREEJS.CanvasTexture(cv); t.colorSpace=THREEJS.SRGBColorSpace; return t;
  }
  function buildStudio(){
    var g=new THREEJS.Group();
    var back=new THREEJS.Mesh(new THREEJS.PlaneGeometry(30,14), new THREEJS.MeshBasicMaterial({map:studioTex()}));
    back.position.set(0,4,-7); g.add(back);
    var floor=new THREEJS.Mesh(new THREEJS.PlaneGeometry(40,40), mat(C.surface,{rough:0.95}));
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; g.add(floor);
    return g;
  }
  function buildBurst(){
    var g=new THREEJS.Group(); g.position.set(0,CLASP.y,CLASP.z);
    var N=64, geo=new THREEJS.BufferGeometry(), pos=new Float32Array(N*3), seed=[];
    for(var i=0;i<N;i++){ pos[i*3]=0;pos[i*3+1]=0;pos[i*3+2]=0;
      var th=Math.random()*6.28, ph=Math.acos(2*Math.random()-1), r=0.3+Math.random()*0.4;
      seed.push({x:Math.sin(ph)*Math.cos(th)*r,y:Math.cos(ph)*r*0.8,z:Math.sin(ph)*Math.sin(th)*r}); }
    geo.setAttribute('position',new THREEJS.BufferAttribute(pos,3));
    var pts=new THREEJS.Points(geo,new THREEJS.PointsMaterial({color:C.teal,size:0.04,transparent:true,opacity:0,depthWrite:false}));
    g.add(pts); g.userData={pts:pts,seed:seed,N:N}; return g;
  }
  function makeGlow(){
    var cv=document.createElement('canvas'); cv.width=128; cv.height=128; var x=cv.getContext('2d');
    var gr=x.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0,'rgba(255,240,224,0.55)'); gr.addColorStop(0.25,'rgba(240,160,100,0.38)');
    gr.addColorStop(0.55,'rgba(14,156,147,0.22)'); gr.addColorStop(1,'rgba(14,156,147,0)');
    x.fillStyle=gr; x.fillRect(0,0,128,128);
    var sp=new THREEJS.Sprite(new THREEJS.SpriteMaterial({map:new THREEJS.CanvasTexture(cv),transparent:true,opacity:0,depthWrite:false,blending:THREEJS.AdditiveBlending}));
    sp.position.set(0,CLASP.y,CLASP.z); sp.scale.set(0.8,0.8,1); return sp;
  }

  function poseFigure(fig,side,p){
    var startX=side<0?-START:START, meetX=side<0?-MEET:MEET;
    var wt=Math.max(0,Math.min((p-0.05)/0.42,1));
    var wp=ease(wt);
    var x=startX+(meetX-startX)*wp;
    var walking=wt<1?(1-wt):0;
    var stride=Math.sin(p*Math.PI*2*3.4);
    var amp=0.5*walking, ud=fig.userData;
    ud.legF.rotation.z=stride*amp; ud.legB.rotation.z=-stride*amp;
    ud.legF.userData.knee.rotation.z=Math.max(0,-stride)*0.5*walking;
    ud.legB.userData.knee.rotation.z=Math.max(0,stride)*0.5*walking;
    ud.armOut.rotation.z=-stride*0.35*walking;
    var lean=walking*0.06;
    var bob=Math.abs(Math.sin(p*Math.PI*2*3.4))*0.025*walking;
    fig.position.set(x,bob,0); fig.rotation.z=(side<0?-1:1)*lean*0;

    var reach=smooth(0.46,0.72,p);
    var shake=Math.sin(p*58)*0.05*smooth(0.6,0.66,p)*(1-smooth(0.9,0.98,p));
    var dir=side<0?1:-1;
    ud.armIn.rotation.z=dir*(reach*1.46+shake);
    ud.armIn.userData.elbow.rotation.z=dir*reach*0.2;
    ud.armIn.rotation.x=reach*0.08*dir;
    /* subtle head turn toward partner once close */
    ud.head.rotation.y=0;
  }
  function updateBurst(p){
    var ud=burst.userData, glow=smooth(0.6,0.74,p);
    var pos=ud.pts.geometry.attributes.position.array, prog=smooth(0.56,0.82,p);
    for(var i=0;i<ud.N;i++){var s=ud.seed[i];pos[i*3]=s.x*prog;pos[i*3+1]=s.y*prog;pos[i*3+2]=s.z*prog;}
    ud.pts.geometry.attributes.position.needsUpdate=true;
    ud.pts.material.opacity=glow*0.9; ud.pts.material.color.setHex(p<0.74?C.teal:C.amber);
    glowSprite.material.opacity=glow*0.5; var gs=0.35+prog*0.45; glowSprite.scale.set(gs,gs,1);
    if(clasplight) clasplight.intensity=glow*1.5;
  }
  function updateCamera(p){
    /* frontal descending dolly — never enters the figures' walking lane */
    var e=ease(p);
    var y=lerp(3.4,1.5,e), z=lerp(8.2,6.1,e), xOff=Math.sin(e*Math.PI)*0.55;
    mLerp.x+=(mouse.x-mLerp.x)*0.05; mLerp.y+=(mouse.y-mLerp.y)*0.05;
    camera.position.set(xOff+mLerp.x*0.3, y-mLerp.y*0.15, z);
    camera.lookAt(0, lerp(1.5,1.12,e), 0);
  }

  function renderAt(p){ poseFigure(human,-1,p); poseFigure(robot,+1,p); updateBurst(p); updateCamera(p); renderer.render(scene,camera); }
  function step(){
    if(!running){ looping=false; return; }
    looping=true; requestAnimationFrame(step);
    dispP+=(targetP-dispP)*0.09; renderAt(dispP);
    if(!ready){ ready=true; onReady&&onReady(); }
    var settling=Math.abs(targetP-dispP)>0.0004||Math.abs(mouse.x-mLerp.x)>0.002||Math.abs(mouse.y-mLerp.y)>0.002;
    if(!settling && running){ /* keep a gentle idle tick so parallax stays responsive */ }
  }
  function startLoop(){ running=true; if(!looping) step(); }
  function resize(){
    var w=canvas.clientWidth||canvas.parentNode.clientWidth, h=canvas.clientHeight||canvas.parentNode.clientHeight;
    if(!w||!h) return; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  }

  function init(opts){
    THREEJS=window.THREE; canvas=opts.canvas; onReady=opts.onReady; reduced=!!opts.reduced; small=!!opts.small;
    if(!THREEJS||!canvas){ onReady&&onReady(); return; }
    renderer=new THREEJS.WebGLRenderer({canvas:canvas,alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, small?1.5:2));
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREEJS.PCFSoftShadowMap;
    renderer.outputColorSpace=THREEJS.SRGBColorSpace;
    renderer.toneMapping=THREEJS.ACESFilmicToneMapping; renderer.toneMappingExposure=1.18;
    scene=new THREEJS.Scene();
    camera=new THREEJS.PerspectiveCamera(38,16/9,0.1,100);

    scene.add(new THREEJS.HemisphereLight(0xFFFFFF,0xE0EAE6,0.95));
    var key=new THREEJS.DirectionalLight(0xFFF6EC,1.2); key.position.set(3,5,4); key.castShadow=true;
    var ms=small?1024:2048; key.shadow.mapSize.set(ms,ms); key.shadow.radius=6;
    key.shadow.camera.near=1; key.shadow.camera.far=22;
    key.shadow.camera.left=-4.5; key.shadow.camera.right=4.5; key.shadow.camera.top=6; key.shadow.camera.bottom=-1;
    key.shadow.bias=-0.0004; scene.add(key);
    var fill=new THREEJS.DirectionalLight(0xC6EFE8,0.6); fill.position.set(-4,2.5,3); scene.add(fill);
    var front=new THREEJS.DirectionalLight(0xFFFFFF,0.5); front.position.set(0,2,7); scene.add(front);
    var rim=new THREEJS.DirectionalLight(0xFFFFFF,0.85); rim.position.set(-1,4,-5); scene.add(rim);
    clasplight=new THREEJS.PointLight(0xF0A060,0,4); clasplight.position.set(0,CLASP.y,CLASP.z+0.3); scene.add(clasplight);

    scene.add(buildStudio());
    human=buildHuman(); robot=buildRobot(); scene.add(human); scene.add(robot);
    burst=buildBurst(); scene.add(burst);
    glowSprite=makeGlow(); scene.add(glowSprite);

    resize();
    window.addEventListener('resize', function(){ resize(); startLoop(); });
    window.addEventListener('mousemove', function(e){ mouse.x=(e.clientX/window.innerWidth-0.5)*2; mouse.y=(e.clientY/window.innerHeight-0.5)*2; startLoop(); });
    document.addEventListener('visibilitychange', function(){ if(document.hidden){ running=false; } else { startLoop(); } });

    opts.onLoaded && opts.onLoaded();   /* nothing to download — ready at once */
    if(reduced){ targetP=dispP=0.82; renderAt(0.82); onReady&&onReady(); }
    else { startLoop(); }
  }
  function setProgress(p){ targetP=Math.max(0,Math.min(1,p)); startLoop(); }
  function forceRender(p,n){ if(p!=null){targetP=dispP=p;} renderAt(dispP); return {dispP:dispP}; }
  function debug(){
    var info={dispP:+dispP.toFixed(3),camera:camera.position.toArray().map(function(n){return +n.toFixed(2);})};
    function proj(f,nm){ if(!f)return; var hx=f.position.x;
      var head=new THREEJS.Vector3(hx,1.72,0).project(camera), feet=new THREEJS.Vector3(hx,0.02,0).project(camera);
      info[nm]={x:+head.x.toFixed(2),headY:+head.y.toFixed(2),feetY:+feet.y.toFixed(2),worldX:+hx.toFixed(2)}; }
    proj(human,'human'); proj(robot,'robot'); return info;
  }

  window.StairHandshake={ init:init, setProgress:setProgress, forceRender:forceRender, debug:debug };
  window.dispatchEvent(new Event('stairhandshake-ready'));
})();
