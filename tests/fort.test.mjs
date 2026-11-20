/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// El Morro exterior: native bridge/moat/entrance rides, exact deck and moat-band joins with the shared heightfield,
// rampart coverage of the smeared DEM, parapet protection and single-owner esplanade surfaces. No production hooks.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
globalThis.fetch=async url=>{const b=readFileSync(url);return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const {loadCity}=await import('../js/sj-world.js');
const {EucController,createPose,slopeAccelFor}=await import('../js/euc/simulation/EucController.js');
const {NEUTRAL_ACTIONS}=await import('../js/euc/input/actions.js');
const {intersectRings,signedArea}=await import('../js/sj-paving.js');
const {segmentDistance}=await import('../js/sj-plaza-layout.js');
const w=await loadCity(),f=w.fort,b=f.bridge,{P,UV,ax,az}=f.frame;

test('1385141770: ride between the two mapped side approaches at three pace targets, on three lines',async()=>{
  const {ridePath,recLocal}=await import('./stair-flights.mjs'),r=f.stairs[0].record;
  const low=recLocal(r,-738.795,-548.097),turn=recLocal(r,-736.683,-538.401),far=recLocal(r,-729.786,-545.119);
  const high=turn.map((p,i)=>p+(far[i]-p)*4/Math.hypot(far[0]-turn[0],far[1]-turn[1]));
  let min=Infinity,max=0,upSpeed=0,downSpeed=0;
  for(const u of [-.6,0,.6])for(const v of [1,3.5,7])for(const up of [true,false]){
    const path=up?[low,[u,r.footS,2],[u,-.25],[u,r.run-.2],[u,r.topS-.15,2],turn]:
      [high,[...turn,1.5],[u,r.topS-.37,1.5],[u,r.run-.5],[u,-.3],[u,r.footS+.2,2],low];
    const q=ridePath(w,r,path,v);assert.ok(q.pass&&!q.air&&!q.curbs&&q.minClr>=0&&q.maxGap<=.03,JSON.stringify({u,v,up,q}));
    min=Math.min(min,q.minClr);max=Math.max(max,q.maxGap);if(up)upSpeed=Math.max(upSpeed,q.maxSp);else downSpeed=Math.max(downSpeed,q.maxSp);}
  assert.ok(f.stairs[0].fl.lip<=.01);console.log('1385141770',{min,max,upSpeed,downSpeed,lip:f.stairs[0].fl.lip});
});

function ride(points,speed=3.3,limit=90,referenceY=w.height(...points[0])) {
  const [a,c0]=points,headingY=Math.atan2(c0[0]-a[0],c0[1]-a[1]);
  const start=w.sampler.findPlacementTarget({x:a[0],z:a[1],headingY,referenceY});
  assert.ok(start,'Clear native start');
  const c=new EucController(w.sampler,{spawn:{position:{x:start.x,y:start.y,z:start.z},headingY}}),p=createPose();
  let next=1,x=start.x,z=start.z,maxY=-Infinity,minY=Infinity;
  for(let step=0;step<120*limit;step++) {
    c.writePose(p);x=p.x;z=p.z;
    if(UV(x,z)[0]>b.uStart+1&&UV(x,z)[0]<b.uFront-1&&Math.abs(UV(x,z)[1])<b.outerHalf){maxY=Math.max(maxY,p.y);minY=Math.min(minY,p.y);}
    assert.equal(c.crashed,false,`Native crash at ${x.toFixed(2)},${z.toFixed(2)} waypoint ${next}`);
    assert.equal(w.sampler.isWater(x,z,p.y),false);
    while(next<points.length&&Math.hypot(points[next][0]-x,points[next][1]-z)<1.2)next++;
    if(next===points.length)return {seconds:step/120,pose:p,maxY,minY};
    const to=points[next],angle=Math.atan2(to[0]-x,to[1]-z),error=Math.atan2(Math.sin(angle-p.headingY),Math.cos(angle-p.headingY));
    const target=Math.abs(error)>.4?Math.min(1.5,speed):speed;
    const grade=-slopeAccelFor(c.ground.normal,Math.sin(p.headingY),Math.cos(p.headingY),c.tuning.gravity);
    const drive=Math.asin(Math.max(-1,Math.min(1,(grade+(target-p.speed)*2)/c.tuning.leanToAccel)))/c.tuning.maxLeanPitch;
    c.step(1/120,{...NEUTRAL_ACTIONS,throttle:Math.max(-.8,Math.min(1,drive)),steer:Math.max(-1,Math.min(1,-error*1.8))});
  }
  assert.fail(`Route timeout at ${x.toFixed(2)},${z.toFixed(2)} waypoint ${next}`);
}
function push(start,headingY,seconds,throttle=.6,referenceY=w.height(...start)+.3) {
  const s=w.sampler.findPlacementTarget({x:start[0],z:start[1],headingY,referenceY});
  assert.ok(s,'Clear native start');
  const c=new EucController(w.sampler,{spawn:{position:{x:s.x,y:s.y,z:s.z},headingY}}),p=createPose(),track=[];
  for(let i=0;i<120*seconds;i++){c.step(1/120,{...NEUTRAL_ACTIONS,throttle});c.writePose(p);track.push({x:p.x,y:p.y,z:p.z,crashed:c.crashed});}
  return track;
}

test('native rider crosses the El Morro bridge both ways at deck level over the smeared DEM dip',()=>{
  const across=[P(b.uStart-6,0),P(b.uStart+4,0),P((b.uStart+b.uFront)/2,0),P(b.uFront-3,0)];
  for(const route of [across,[...across].reverse().concat([P(b.uStart-9,0)])]){
    const r=ride(route);
    assert.ok(r.minY>=b.deckY-.1&&r.maxY<=b.deckY+.3,`Deck ${b.deckY.toFixed(2)}: rode ${r.minY.toFixed(2)}–${r.maxY.toFixed(2)}`);
  }
  // The DEM itself dips ≥2.5 m mid-bridge: the deck is what carries the rider.
  let dip=Infinity;for(let u=b.uStart+4;u<b.uFront-4;u+=.5)dip=Math.min(dip,w.height(...P(u,0)));
  assert.ok(dip<b.deckY-2.5,`DEM ridge minimum ${dip.toFixed(2)}`);
});
test('the closed entrance doors and the paseo-end gate are real ends: never ridden through',()=>{
  const track=push(P(b.uFront-7,0),Math.atan2(ax,az),4,.6,b.deckY+.3);
  const most=Math.max(...track.map(p=>UV(p.x,p.z)[0]));
  assert.ok(most<=b.uFront+.05,`Rider reached u=${most.toFixed(2)} past the entrance front ${b.uFront.toFixed(2)}`);
  const g=f.paseoGate,ux=g.nz,uz=-g.nx; // along the path, away from the end
  const t=p=>(p.x-g.x)*ux+(p.z-g.z)*uz;
  const into=push([g.x+ux*2,g.z+uz*2],Math.atan2(-ux,-uz),4,.5);
  assert.ok(Math.min(...into.map(t))>-.2,`Rider passed the paseo gate (t=${Math.min(...into.map(t)).toFixed(2)})`);
});
test('moat floor bands beside the bridge are rideable at their drawn level',()=>{
  let tried=0;
  for(const band of b.bands){if(band.ub-band.ua<8)continue;tried++;
    const v=band.side*(b.outerHalf+1.6),r=ride([P(band.ua+4.5,v),P(band.ub-3,v)],2.5,90,band.floor+.3);
    // The band slopes from the wall-foot floor to the exact kept terrain at its outer edge: sample on that surface.
    const [mx,mz]=P((band.ua+band.ub)/2,v),[ox,oz]=P((band.ua+band.ub)/2,band.side*(b.outerHalf+3.2));
    const y=w.sampler.sampleGround(mx,mz,{normal:{}},band.floor+.5).height,expect=band.floor+(w.height(ox,oz)-band.floor)*.5;
    assert.ok(Math.abs(y-expect)<.06,`Band ${band.side} surface ${expect.toFixed(2)} sampled ${y.toFixed(2)}`);
    assert.ok(r.pose.y<band.floor+.4,`Rode the band at ${r.pose.y.toFixed(2)}`);}
  assert.ok(tried>=2,`bands ridden ${tried}`);
});
test('deck and moat-band floors meet the shared heightfield exactly at their kept edges',()=>{
  for(const p of b.rows[0][1])assert.ok(Math.abs(p[1]-.015-w.height(p[0],p[2]))<1e-9,'Deck start row lies on the terrain');
  let edge=0;
  for(const tri of b.bandTriangles)for(const p of tri){const v=UV(p[0],p[2])[1];
    if(Math.abs(Math.abs(v)-(b.outerHalf+3.2))<1e-6){edge++;assert.ok(Math.abs(p[1]-w.height(p[0],p[2]))<1e-9,'Band outer edge on the terrain');}}
  assert.ok(edge>40,`band edge vertices ${edge}`);
  for(const sk of b.bandSkirts)for(const [lo,hi] of sk.rows){assert.ok(Math.abs(hi[1]-Math.max(lo[1],w.height(hi[0],hi[2])))<1e-9,'Skirt top on the terrain');assert.ok(lo[1]<=hi[1]);}
  // The bridge cut and deck reach the closed leaves: no DEM wall smear left inside the door recess (sliver repair).
  const cut=f.cuts.at(-1),door=b.uFront+f.constants.ENTRANCE.door,inside=p=>cut.planes.every(q=>q[0]*p[0]+q[1]*p[1]+q[2]*p[2]+q[3]>0);
  for(let u=b.uFront+.01;u<door;u+=.05)for(const v of [-1.3,0,1.3]){const [x,z]=P(u,v);assert.ok(inside([x,b.deckY,z]),'Recess inside the bridge cut');}
  assert.ok(b.rows.at(-1)[0]>=door,'Deck floor reaches the door plane');
  // Bridge side walls reach below the band floor and the deck.
  for(const {list} of b.sides)for(const l of list)assert.ok(l.bottom<b.deckY-.4);
  for(const band of b.bands)for(const l of band.items)assert.ok(l.bottom<=band.floor-.35);
});
test('El Morro ramparts hide the smeared DEM scarp and never fold back; every face reaches below its foot',()=>{
  let checked=0;const corners=f.stations.filter(s=>s.corner).map(s=>s.F);
  const segCount=Object.fromEntries(f.runs.map(r=>[r.name,r.segs.length]));
  // Returns (first/last segment of each run) are end treatments that sink into the continuing bank by design.
  for(const {a,b:c,run} of f.walls){if(a.corner||c.corner||a.seg===0||a.seg===segCount[run]-1)continue;
    for(let t=.05;t<1;t+=.15)for(let d=.13;d<3;d+=.25){
      const limit=a.base+(c.base-a.base)*t+f.constants.PLINTH.rise,fx=a.F[0]+(c.F[0]-a.F[0])*t,fz=a.F[1]+(c.F[1]-a.F[1])*t,x=fx+a.nx*d,z=fz+a.nz*d;
      if(corners.some(q=>Math.hypot(q[0]-x,q[1]-z)<3.5))continue;
      if(Math.abs(UV(x,z)[1])<b.outerHalf+3.3&&UV(x,z)[0]>b.uStart-1)continue; // bridge body and moat bands own that ground
      assert.ok(w.height(x,z)<=limit+.25*d,`DEM ${(w.height(x,z)-limit).toFixed(2)} m above the plinth in front of ${fx.toFixed(1)},${fz.toFixed(1)}`);checked++;}}
  assert.ok(checked>2500,`checked ${checked}`);
  for(const run of f.runs){
    for(const seg of run.segs){const along=p=>(p[0]-seg.a[0])*seg.ux+(p[1]-seg.a[1])*seg.uz;
      for(const key of ['F','B','T','W'])for(let i=1;i<seg.stations.length;i++)
        assert.ok(along(seg.stations[i][key])>=along(seg.stations[i-1][key])-1e-6,`${run.name} ${key} folds back at s=${seg.stations[i].s.toFixed(1)}`);}
    for(const s of run.stations)assert.ok(s.bottom<=w.height(...s.F)-.39&&s.bottom<=w.height(...s.B)-.39,`${run.name} face bottom floats at s=${s.s.toFixed(1)}`);}
  // Toes stay near the mapped wall foot (no faces standing out on the coastal bank).
  assert.ok(f.stations.every(s=>s.dFoot<5),'Face feet within 5 m of the mapped outline');
});
test('parapets keep a rider on the El Morro wall walks',()=>{
  let tried=0;
  for(const s of f.stations.filter((s,i)=>!s.corner&&i%5===0&&s.walk-s.base>4)){
    const x=(s.Q[0]+s.W[0])/2,z=(s.Q[1]+s.W[1])/2,heading=Math.atan2(s.nx,s.nz),y=w.sampler.sampleGround(x,z,{normal:{}},s.walk+.3).height;
    const start=w.sampler.findPlacementTarget({x,z,headingY:heading,referenceY:y});
    if(!start||start.y<s.walk-.3)continue;tried++;
    const c=new EucController(w.sampler,{spawn:{position:{x:start.x,y:start.y,z:start.z},headingY:heading}}),p=createPose();
    let minY=start.y;
    for(let i=0;i<120*3;i++){c.step(1/120,{...NEUTRAL_ACTIONS,throttle:.55});c.writePose(p);minY=Math.min(minY,p.y);}
    assert.ok(minY>s.walk-1.2,`Fell from the El Morro wall at s=${s.s.toFixed(1)} (min ${minY.toFixed(2)}, walk ${s.walk.toFixed(2)})`);}
  assert.ok(tried>20,`parapet starts ${tried}`);
});
test('esplanade surfaces are convex, disjoint single owners outside the bridge body and moat bands',()=>{
  for(const s of f.surfaces){const r=s.ring;
    for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],d=r[(i+2)%r.length];
      assert.ok((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0])>=-1e-9,'Convex, counter-clockwise piece');}
    for(const cut of [f.exclude,...f.cuts.slice(0,-1).map(c=>c.ring)])assert.ok(Math.abs(signedArea(intersectRings(s.ring,signedArea(cut)<0?[...cut].reverse():cut)))<1e-7,'No overlay over a cut');}
  for(let i=0;i<f.surfaces.length;i++)for(let j=i+1;j<f.surfaces.length;j++)
    assert.ok(Math.abs(signedArea(intersectRings(f.surfaces[i].ring,f.surfaces[j].ring)))<1e-6,'Disjoint surfaces');
});
test('El Morro layout is bounded and finite, clear of the paseo, with dry arrival and crest garitas',()=>{
  assert.equal(f.places.length,1);assert.ok(f.places.every(p=>w.isDry(p.x,p.z)));
  assert.ok(f.tops.every(t=>t.replacesTerrain&&Number.isFinite(t.plane.dx)&&Number.isFinite(t.plane.dz)&&t.maxReferenceY<40));
  assert.ok(f.colliders.every(c=>(c.outer??[]).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))&&(!c.outer||c.maxY>c.minY)));
  const path=w.gate.path,clear=Math.min(...f.stations.flatMap(s=>[s.B,s.F]).map(p=>Math.min(...path.slice(1).map((q,i)=>segmentDistance(p[0],p[1],path[i],q)))));
  assert.ok(clear>3,`Fort face within ${clear.toFixed(2)} m of the paseo centreline`);
  assert.ok(f.garitas.length>=3&&f.garitas.some(g=>g.vertex===3),'salient garita at vertex 3 present');
  for(const g of f.garitas)assert.ok(g.y>w.height(g.x,g.z)-1&&g.y<w.height(g.x,g.z)+12);
  assert.ok(f.lighthouse.y>35&&f.lighthouse.bottom<f.lighthouse.y);
  console.log('Fort layout',JSON.stringify({stations:f.stations.length,walls:f.walls.length,colliders:f.colliders.length,tops:f.tops.length,
    surfaces:f.surfaces.length,garitas:f.garitas.map(g=>g.run+':'+g.vertex),bridge:{length:+(b.uFront-b.uStart).toFixed(2),deckY:+b.deckY.toFixed(2),
    arches:b.arches.length,bands:b.bands.map(x=>[x.side,+(x.ub-x.ua).toFixed(1),+x.floor.toFixed(2)])}}));
});
test('continuous Calle del Morro from Norzagaray across the esplanade onto the bridge to the entrance, and back',()=>{
  const route=[[-475.436,-313.911],[-561.357,-392.068],[-714.936,-531.327],[-726.53,-537.70],P(b.uStart-3,0),P((b.uStart+b.uFront)/2,0),P(b.uFront-3,0)];
  const there=ride(route,3.6,200),back=ride([...route].reverse(),3.6,200,b.deckY+.3);
  assert.ok(there.minY>=b.deckY-.1&&back.minY>=b.deckY-.1,'Deck held both ways');
  console.log('Calle del Morro ride seconds',there.seconds.toFixed(1),back.seconds.toFixed(1));
});
