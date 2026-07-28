/* ============================================================
   STAIR DIGITAL — scroll-driven 3D handshake hero
   Executive (left) + AI robot (right) meet and shake hands on a
   clean neutral studio stage; camera spirals top->bottom as the
   handshake completes. Driven by StairHandshake.setProgress(p).
   ============================================================ */
(function(){
  "use strict";

  var C = {
    ivory:0xFAF8F3, surface:0xE7F1EE,
    teal:0x0E9C93, tealDeep:0x0B857D, amber:0xF0854B,
    navy:0x22314C, navyD:0x1A2740, navyL:0x2E4066, burgundy:0x7C2F3B, shirt:0xF3F1EA,
    skin:0xE8C7A2, hair:0xC7C9CC,
    roboWhite:0xF6F7F6, roboSilver:0xC9D2CE, roboDark:0x8FA09A, eye:0x0E9C93
  };
  var MEET=0.70, START=6.0, CLASP={y:1.15, z:0.24};

  var THREEJS, renderer, scene, camera, canvas, small=false;
  var human, robot, burst, glowSprite, clasplight;
  var ready=false, onReady=null, reduced=false, running=true;
  var targetP=0, dispP=0;
  var mouse={x:0,y:0}, mLerp={x:0,y:0};

  function mat(c,o){o=o||{};return new THREEJS.MeshStandardMaterial({color:c,
    roughness:o.rough!==undefined?o.rough:0.6,metalness:o.metal!==undefined?o.metal:0.05,
    emissive:o.emissive!==undefined?o.emissive:0x000000,emissiveIntensity:o.ei!==undefined?o.ei:1});}
  function gloss(c,o){o=o||{};return new THREEJS.MeshPhysicalMaterial({color:c,
    roughness:o.rough!==undefined?o.rough:0.3,metalness:o.metal!==undefined?o.metal:0.1,
    clearcoat:o.cc!==undefined?o.cc:1,clearcoatRoughness:o.ccr!==undefined?o.ccr:0.18,
    emissive:o.emissive!==undefined?o.emissive:0x000000,emissiveIntensity:o.ei!==undefined?o.ei:1});}
  function cap(r,l,m){return new THREEJS.Mesh(new THREEJS.CapsuleGeometry(r,l,8,18),m);}
  function bx(w,h,d,m){var g=new THREEJS.BoxGeometry(w,h,d);return new THREEJS.Mesh(g,m);}
  function sph(r,m){return new THREEJS.Mesh(new THREEJS.SphereGeometry(r,26,22),m);}
  function shadows(o){o.traverse(function(c){if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});}
  function ease(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function smooth(a,b,x){var t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
  function lerp(a,b,t){return a+(b-a)*t;}

  function buildHand(m){
    /* simple closed hand (grip) for a handshake — no protruding thumb */
    var g=new THREEJS.Group();
    var cuff=cap(0.052,0.05,m); cuff.position.y=0.02; g.add(cuff);
    var fist=sph(0.082,m); fist.scale.set(1.02,0.9,0.82); fist.position.y=-0.05; g.add(fist);
    return g;
  }
  function buildArm(mU,mL,mH,joint){
    var g=new THREEJS.Group();
    if(joint){var s=sph(0.078,joint);g.add(s);}
    var u=cap(0.066,0.22,mU); u.position.y=-0.15; g.add(u);
    var el=new THREEJS.Group(); el.position.y=-0.30; g.add(el);
    if(joint){var e2=sph(0.06,joint);e2.position.y=0;el.add(e2);}
    var lo=cap(0.056,0.20,mL); lo.position.y=-0.13; el.add(lo);
    var hand=buildHand(mH); hand.position.y=-0.26; el.add(hand);
    g.userData={elbow:el,hand:hand}; return g;
  }
  function buildLeg(mU,mL,mF,face){
    face=face||1;
    var g=new THREEJS.Group();
    var u=cap(0.082,0.26,mU); u.position.y=-0.16; g.add(u);
    var kn=new THREEJS.Group(); kn.position.y=-0.33; g.add(kn);
    var lo=cap(0.07,0.24,mL); lo.position.y=-0.15; kn.add(lo);
    /* foot points forward along walking direction (toe = face) */
    var ft=bx(0.26,0.07,0.13,mF); ft.position.set(face*0.06,-0.30,0); kn.add(ft);
    var toe=bx(0.09,0.05,0.12,mF); toe.position.set(face*0.16,-0.315,0); kn.add(toe);
    g.userData={knee:kn}; return g;
  }

  function buildHuman(){
    var root=new THREEJS.Group();
    var suit=mat(C.navy,{rough:0.52}), suitD=mat(C.navyD,{rough:0.5}), suitL=mat(C.navyL,{rough:0.52});
    var shirt=mat(C.shirt,{rough:0.45}), skin=mat(C.skin,{rough:0.68}), hair=mat(C.hair,{rough:0.72});
    var tie=mat(C.burgundy,{rough:0.42}), shoe=mat(0x1C1712,{rough:0.35,metal:0.2});
    // pelvis
    var hips=cap(0.17,0.10,suit); hips.scale.set(1.2,1,0.85); hips.position.y=0.92; root.add(hips);
    var torso=new THREEJS.Group(); torso.position.y=0.98; root.add(torso);
    var chest=cap(0.185,0.30,suit); chest.scale.set(1.28,1,0.86); chest.position.y=0.18; torso.add(chest);
    // shirt + tie + lapels
    var vv=bx(0.12,0.30,0.05,shirt); vv.position.set(0.185,0.16,0); torso.add(vv);
    var lapL=bx(0.10,0.24,0.04,suitD); lapL.position.set(0.175,0.20,0.075); lapL.rotation.z=0.18; torso.add(lapL);
    var lapR=bx(0.10,0.24,0.04,suitD); lapR.position.set(0.175,0.20,-0.075); lapR.rotation.z=0.18; torso.add(lapR);
    var tieM=bx(0.045,0.24,0.03,tie); tieM.position.set(0.215,0.12,0); torso.add(tieM);
    var pkt=bx(0.03,0.045,0.02,tie); pkt.position.set(0.13,0.26,0.15); torso.add(pkt);
    // rounded shoulders
    var shL=sph(0.11,suitL); shL.position.set(0.02,0.34,0.20); torso.add(shL);
    var shR=sph(0.11,suitL); shR.position.set(0.02,0.34,-0.20); torso.add(shR);
    // neck + head
    var neck=cap(0.05,0.06,skin); neck.position.y=0.44; torso.add(neck);
    var head=sph(0.155,skin); head.scale.set(0.94,1.08,0.96); head.position.set(0.03,0.60,0); torso.add(head);
    var hairCap=sph(0.163,hair); hairCap.scale.set(0.98,0.74,1.02); hairCap.position.set(-0.02,0.67,0); torso.add(hairCap);
    var earL=sph(0.03,skin); earL.position.set(-0.01,0.60,0.14); torso.add(earL);
    var earR=sph(0.03,skin); earR.position.set(-0.01,0.60,-0.14); torso.add(earR);
    // arms
    var armIn=buildArm(suit,suit,skin,null); armIn.position.set(0.02,0.30,0.19); torso.add(armIn);
    var armOut=buildArm(suit,suit,skin,null); armOut.position.set(0.02,0.30,-0.19); torso.add(armOut);
    // legs
    var legF=buildLeg(suit,suit,shoe,1), legB=buildLeg(suit,suit,shoe,1);
    legF.position.set(0,0.90,0.09); legB.position.set(0,0.90,-0.09); root.add(legF); root.add(legB);
    root.userData={armIn:armIn,armOut:armOut,legF:legF,legB:legB,head:head,torso:torso};
    shadows(root); return root;
  }

  function buildRobot(){
    var root=new THREEJS.Group();
    var white=gloss(C.roboWhite,{rough:0.24,cc:1,ccr:0.12}), silver=gloss(C.roboSilver,{rough:0.28,metal:0.5,cc:0.8});
    var dark=mat(C.roboDark,{rough:0.4,metal:0.5});
    var eye=mat(C.eye,{rough:0.3,emissive:C.eye,ei:1.6});
    var glow=mat(C.teal,{rough:0.3,metal:0.2,emissive:C.teal,ei:0.8});
    var hips=cap(0.15,0.08,silver); hips.scale.set(1.15,1,0.85); hips.position.y=0.92; root.add(hips);
    var torso=new THREEJS.Group(); torso.position.y=0.98; root.add(torso);
    var chest=cap(0.175,0.28,white); chest.scale.set(1.22,1,0.88); chest.position.y=0.18; torso.add(chest);
    var seam=bx(0.02,0.28,0.14,silver); seam.position.set(0.155,0.18,0); torso.add(seam);
    var core=sph(0.055,glow); core.position.set(-0.145,0.20,0); torso.add(core);
    var coreR=new THREEJS.Mesh(new THREEJS.TorusGeometry(0.085,0.012,10,26),glow); coreR.position.set(-0.14,0.20,0); coreR.rotation.y=Math.PI/2; torso.add(coreR);
    var shL=sph(0.105,silver); shL.position.set(0.0,0.34,0.20); torso.add(shL);
    var shR=sph(0.105,silver); shR.position.set(0.0,0.34,-0.20); torso.add(shR);
    var neck=bx(0.08,0.08,0.10,dark); neck.position.y=0.43; torso.add(neck);
    var head=sph(0.148,white); head.scale.set(1.02,1.1,1.02); head.position.set(-0.01,0.59,0); torso.add(head);
    var visor=cap(0.02,0.14,mat(0x1E3A37,{rough:0.15,metal:0.4})); visor.rotation.x=Math.PI/2; visor.position.set(-0.128,0.60,0); torso.add(visor);
    var eyeL=sph(0.026,eye); eyeL.position.set(-0.14,0.61,0.055); torso.add(eyeL);
    var eyeR=sph(0.026,eye); eyeR.position.set(-0.14,0.61,-0.055); torso.add(eyeR);
    var earL=sph(0.028,glow); earL.position.set(0.03,0.59,0.145); torso.add(earL);
    var earR=sph(0.028,glow); earR.position.set(0.03,0.59,-0.145); torso.add(earR);
    var armIn=buildArm(white,silver,white,glow); armIn.position.set(-0.02,0.30,0.19); torso.add(armIn);
    var armOut=buildArm(white,silver,white,glow); armOut.position.set(-0.02,0.30,-0.19); torso.add(armOut);
    var legF=buildLeg(white,silver,silver,-1), legB=buildLeg(white,silver,silver,-1);
    legF.position.set(0,0.90,0.09); legB.position.set(0,0.90,-0.09); root.add(legF); root.add(legB);
    root.userData={armIn:armIn,armOut:armOut,legF:legF,legB:legB,head:head,torso:torso};
    shadows(root); return root;
  }

  /* ---------- clean studio stage ---------- */
  function studioTexture(){
    var cv=document.createElement('canvas'); cv.width=64; cv.height=512; var x=cv.getContext('2d');
    var g=x.createLinearGradient(0,0,0,512);
    g.addColorStop(0,'#FCFAF6'); g.addColorStop(0.5,'#EFF4F1'); g.addColorStop(1,'#E2ECE8');
    x.fillStyle=g; x.fillRect(0,0,64,512);
    var t=new THREEJS.CanvasTexture(cv); t.colorSpace=THREEJS.SRGBColorSpace; return t;
  }
  function buildStudio(){
    var g=new THREEJS.Group();
    // curved backdrop (cyclorama)
    var back=new THREEJS.Mesh(new THREEJS.PlaneGeometry(30,14), new THREEJS.MeshBasicMaterial({map:studioTexture()}));
    back.position.set(0,4,-7); g.add(back);
    // floor (soft, receives shadow)
    var floor=new THREEJS.Mesh(new THREEJS.PlaneGeometry(40,40), mat(C.surface,{rough:0.95,metal:0}));
    floor.rotation.x=-Math.PI/2; floor.position.y=0; floor.receiveShadow=true; g.add(floor);
    return g;
  }

  function buildBurst(){
    var g=new THREEJS.Group(); g.position.set(0,CLASP.y,CLASP.z);
    var N=70, geo=new THREEJS.BufferGeometry(), pos=new Float32Array(N*3), seed=[];
    for(var i=0;i<N;i++){ pos[i*3]=0;pos[i*3+1]=0;pos[i*3+2]=0;
      var th=Math.random()*6.28, ph=Math.acos(2*Math.random()-1), r=0.35+Math.random()*0.45;
      seed.push({x:Math.sin(ph)*Math.cos(th)*r,y:Math.cos(ph)*r*0.75,z:Math.sin(ph)*Math.sin(th)*r}); }
    geo.setAttribute('position',new THREEJS.BufferAttribute(pos,3));
    var pm=new THREEJS.PointsMaterial({color:C.teal,size:0.035,transparent:true,opacity:0,depthWrite:false});
    var pts=new THREEJS.Points(geo,pm); g.add(pts);
    g.userData={pts:pts,seed:seed,N:N}; return g;
  }
  function makeGlowSprite(){
    var cv=document.createElement('canvas'); cv.width=128; cv.height=128; var x=cv.getContext('2d');
    var gr=x.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0,'rgba(255,240,224,0.65)'); gr.addColorStop(0.22,'rgba(240,160,100,0.45)');
    gr.addColorStop(0.5,'rgba(14,156,147,0.26)'); gr.addColorStop(1,'rgba(14,156,147,0)');
    x.fillStyle=gr; x.fillRect(0,0,128,128);
    var tex=new THREEJS.CanvasTexture(cv);
    var sp=new THREEJS.Sprite(new THREEJS.SpriteMaterial({map:tex,transparent:true,opacity:0,depthWrite:false,blending:THREEJS.AdditiveBlending}));
    sp.position.set(0,CLASP.y,CLASP.z); sp.scale.set(0.9,0.9,1); return sp;
  }

  function poseFigure(fig,side,p){
    var startX=side<0?-START:START, meetX=side<0?-MEET:MEET;
    var wt=Math.max(0,Math.min((p-0.05)/0.42,1));
    var wp=ease(wt);
    var x=startX+(meetX-startX)*wp;
    var walking=wt<1?(1-wt):0;
    var stride=Math.sin(p*Math.PI*2*3.2);
    var amp=0.5*walking, ud=fig.userData;
    ud.legF.rotation.z=stride*amp; ud.legB.rotation.z=-stride*amp;
    ud.legF.userData.knee.rotation.z=Math.max(0,-stride)*0.5*walking;
    ud.legB.userData.knee.rotation.z=Math.max(0,stride)*0.5*walking;
    ud.armOut.rotation.z=-stride*0.4*walking;
    var bob=Math.abs(Math.sin(p*Math.PI*2*3.2))*0.03*walking;
    fig.position.set(x,bob,0);
    var reach=smooth(0.46,0.72,p);
    var shake=Math.sin(p*60)*0.05*smooth(0.6,0.66,p)*(1-smooth(0.9,0.98,p));
    var dir=side<0?1:-1;
    ud.armIn.rotation.z=dir*(reach*1.5+shake);
    ud.armIn.userData.elbow.rotation.z=dir*reach*0.16;
    ud.armIn.rotation.x=reach*0.10*dir;
  }

  function updateBurst(p){
    var ud=burst.userData, glow=smooth(0.6,0.72,p);
    var pos=ud.pts.geometry.attributes.position.array, prog=smooth(0.58,0.82,p);
    for(var i=0;i<ud.N;i++){var s=ud.seed[i];pos[i*3]=s.x*prog;pos[i*3+1]=s.y*prog;pos[i*3+2]=s.z*prog;}
    ud.pts.geometry.attributes.position.needsUpdate=true;
    ud.pts.material.opacity=glow*0.9; ud.pts.material.size=0.045;
    ud.pts.material.color.setHex(p<0.72?C.teal:C.amber);
    glowSprite.material.opacity=glow*0.5; var gs=0.35+prog*0.5; glowSprite.scale.set(gs,gs,1);
    if(clasplight) clasplight.intensity=glow*1.5;
  }

  function updateCamera(p){
    var e=ease(p);
    var theta=lerp(-0.62,0.02,e);
    var radius=lerp(6.8,5.0,e);
    var y=lerp(3.7,1.35,e);
    mLerp.x+=(mouse.x-mLerp.x)*0.05; mLerp.y+=(mouse.y-mLerp.y)*0.05;
    camera.position.set(Math.sin(theta)*radius + mLerp.x*0.25, y - mLerp.y*0.15, Math.cos(theta)*radius);
    camera.lookAt(0, lerp(1.55,1.06,e), CLASP.z);
  }

  function renderAt(p){
    poseFigure(human,-1,p); poseFigure(robot,+1,p); updateBurst(p); updateCamera(p);
    renderer.render(scene,camera);
  }

  var pending=false;
  function step(){
    pending=false;
    dispP += (targetP-dispP)*0.09;
    renderAt(dispP);
    if(!ready){ ready=true; if(onReady) onReady(); }
    var settling = Math.abs(targetP-dispP)>0.0004 || Math.abs(mouse.x-mLerp.x)>0.002 || Math.abs(mouse.y-mLerp.y)>0.002;
    if(running && settling){ pending=true; requestAnimationFrame(step); }
  }
  function wake(){ if(running && !pending){ pending=true; requestAnimationFrame(step); } }

  function resize(){
    var w=canvas.clientWidth||canvas.parentNode.clientWidth, h=canvas.clientHeight||canvas.parentNode.clientHeight;
    if(!w||!h) return;
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  }

  function init(opts){
    THREEJS=window.THREE; canvas=opts.canvas; onReady=opts.onReady; reduced=!!opts.reduced; small=!!opts.small;
    if(!THREEJS||!canvas){ if(onReady) onReady(); return; }
    renderer=new THREEJS.WebGLRenderer({canvas:canvas,alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, small?1.5:2));
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREEJS.PCFSoftShadowMap;
    renderer.outputColorSpace=THREEJS.SRGBColorSpace;
    renderer.toneMapping=THREEJS.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
    scene=new THREEJS.Scene();
    camera=new THREEJS.PerspectiveCamera(38,16/9,0.1,100);

    var hemi=new THREEJS.HemisphereLight(0xFFFFFF,0xE0EAE6,0.95); scene.add(hemi);
    var key=new THREEJS.DirectionalLight(0xFFF6EC,1.15);
    key.position.set(3.2,5,3.2); key.castShadow=true;
    var ms=small?512:1024;
    key.shadow.mapSize.set(ms,ms); key.shadow.radius=7;
    key.shadow.camera.near=1; key.shadow.camera.far=22;
    key.shadow.camera.left=-4.5; key.shadow.camera.right=4.5; key.shadow.camera.top=6; key.shadow.camera.bottom=-1;
    key.shadow.bias=-0.0004; scene.add(key);
    var fill=new THREEJS.DirectionalLight(0xC6EFE8,0.45); fill.position.set(-4,2.5,3); scene.add(fill);
    var rim=new THREEJS.DirectionalLight(0xFFFFFF,0.75); rim.position.set(-1,4,-5); scene.add(rim); // separation
    clasplight=new THREEJS.PointLight(0xF0A060,0,4); clasplight.position.set(0,CLASP.y,CLASP.z+0.3); scene.add(clasplight);

    scene.add(buildStudio());
    human=buildHuman(); robot=buildRobot(); scene.add(human); scene.add(robot);
    burst=buildBurst(); scene.add(burst);
    glowSprite=makeGlowSprite(); scene.add(glowSprite);

    resize();
    window.addEventListener('resize',function(){resize(); wake();});
    window.addEventListener('mousemove',function(e){mouse.x=(e.clientX/window.innerWidth-0.5)*2;mouse.y=(e.clientY/window.innerHeight-0.5)*2; if(!reduced) wake();});
    document.addEventListener('visibilitychange',function(){running=!document.hidden; if(running&&!reduced) wake();});

    if(reduced){ targetP=dispP=0.82; renderAt(0.82); if(onReady) onReady(); }
    else { wake(); }
  }
  function setProgress(p){ targetP=Math.max(0,Math.min(1,p)); wake(); }

  window.StairHandshake={ init:init, setProgress:setProgress };
})();
