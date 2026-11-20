/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// San Cristóbal exterior / Plaza Colón: native ramp/gate/plaza rides, exact deck/terrain joins, rampart coverage,
// parapet protection, real stair/doors ends and single-owner plaza surfaces. No production hooks.
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
const {inRing}=await import('../js/sj-plaza-layout.js');
const w=await loadCity(),c=w.cristobal,rp=c.ramp,{P,UV,ax,az}=c.frame,e=c.entrance,pl=c.plaza;
const along=(x,z)=>{let best=null; // nearest ramp centreline point (d: lateral distance)
  for(let i=0;i+1<rp.rows.length;i++){const a=rp.rows[i],b=rp.rows[i+1],dx=b.p[0]-a.p[0],dz=b.p[1]-a.p[1],L=Math.hypot(dx,dz);
  const t=Math.max(0,Math.min(1,((x-a.p[0])*dx+(z-a.p[1])*dz)/(L*L))),px=a.p[0]+dx*t,pz=a.p[1]+dz*t,d=Math.hypot(x-px,z-pz);
  if(!best||d<best.d)best={d,y:a.y+(b.y-a.y)*t,s:a.s+(b.s-a.s)*t};}return best;};

function ride(points,speed=3.3,limit=120,referenceY=w.height(...points[0]),track) {
  const [a,c0]=points,headingY=Math.atan2(c0[0]-a[0],c0[1]-a[1]);
  const start=w.sampler.findPlacementTarget({x:a[0],z:a[1],headingY,referenceY});
  assert.ok(start,'Clear native start');
  const ctl=new EucController(w.sampler,{spawn:{position:{x:start.x,y:start.y,z:start.z},headingY}}),p=createPose();
  let next=1,x=start.x,z=start.z,deckErr=0,onDeck=0;
  for(let step=0;step<120*limit;step++) {
    ctl.writePose(p);x=p.x;z=p.z;
    const r=along(x,z);if(r.d<1.2&&r.s>2&&r.s<rp.length-1){onDeck++;deckErr=Math.max(deckErr,Math.abs(p.y-r.y));}
    track?.push([x,p.y,z]);
    assert.equal(ctl.crashed,false,`Native crash at ${x.toFixed(2)},${z.toFixed(2)} waypoint ${next}`);
    assert.equal(w.sampler.isWater(x,z,p.y),false);
    while(next<points.length&&Math.hypot(points[next][0]-x,points[next][1]-z)<1.2)next++;
    if(next===points.length)return {seconds:step/120,pose:p,deckErr,onDeck};
    const to=points[next],angle=Math.atan2(to[0]-x,to[1]-z),error=Math.atan2(Math.sin(angle-p.headingY),Math.cos(angle-p.headingY));
    const target=Math.abs(error)>.4?Math.min(1.5,speed):speed;
    const grade=-slopeAccelFor(ctl.ground.normal,Math.sin(p.headingY),Math.cos(p.headingY),ctl.tuning.gravity);
    const drive=Math.asin(Math.max(-1,Math.min(1,(grade+(target-p.speed)*2)/ctl.tuning.leanToAccel)))/ctl.tuning.maxLeanPitch;
    ctl.step(1/120,{...NEUTRAL_ACTIONS,throttle:Math.max(-.8,Math.min(1,drive)),steer:Math.max(-1,Math.min(1,-error*1.8))});
  }
  assert.fail(`Route timeout at ${x.toFixed(2)},${z.toFixed(2)} waypoint ${next}`);
}
function push(start,headingY,seconds,throttle=.6,referenceY=w.height(...start)+.3) {
  const s=w.sampler.findPlacementTarget({x:start[0],z:start[1],headingY,referenceY});
  assert.ok(s,'Clear native start');
  const ctl=new EucController(w.sampler,{spawn:{position:{x:s.x,y:s.y,z:s.z},headingY}}),p=createPose(),track=[];
  for(let i=0;i<120*seconds;i++){ctl.step(1/120,{...NEUTRAL_ACTIONS,throttle});ctl.writePose(p);track.push({x:p.x,y:p.y,z:p.z,crashed:ctl.crashed});}
  return track;
}
const rampUp=()=>{const s0=rp.rows[0].p,[ux,uz]=[rp.rows[1].p[0]-s0[0],rp.rows[1].p[1]-s0[1]],l=Math.hypot(ux,uz);
  return [[s0[0]-ux/l*5,s0[1]-uz/l*5],...rp.rows.filter((r,i)=>i%3===0&&r.s<rp.length-2).map(r=>r.p),P(e.uFront-1.2,0)];};

test('native rider climbs the San Cristóbal entrance ramp to the gate and back down on the deck',()=>{
  const up=rampUp(),there=ride(up,3.0,120);
  assert.ok(there.onDeck>200&&there.deckErr<.25,`Up: ${there.onDeck} deck samples, max deck error ${there.deckErr.toFixed(3)}`);
  const back=ride([...up].reverse(),3.0,120,rp.yGate+.3);
  assert.ok(back.onDeck>200&&back.deckErr<.25,`Down: max deck error ${back.deckErr.toFixed(3)}`);
  console.log('Ramp seconds',there.seconds.toFixed(1),back.seconds.toFixed(1),'grade',rp.grade.toFixed(3),'length',rp.length.toFixed(1));
});
test('the closed main gate is a real end; the Plaza Colón stair is a public flight',()=>{
  const track=push(P(e.uFront-6,0),Math.atan2(ax,az),4,.6,rp.yGate+.3);
  const most=Math.max(...track.map(p=>UV(p.x,p.z)[0]));
  assert.ok(most<=e.uFront+.05,`Rider reached u=${most.toFixed(2)} past the gate front ${e.uFront.toFixed(2)}`);
  // Public stairs ride up and down: uniform risers ≤ 0.16 m from the approach ground to the terrace it meets.
  const st=pl.stair,f=pl.flight;
  assert.ok(st.rise<=.16&&pl.steps.length>=10,`risers ${st.rise.toFixed(3)} × ${pl.steps.length}`);
  pl.steps.forEach((s,k)=>assert.ok(Math.abs(s.top-(f.foot.y+(k+1)*st.rise))<1e-9&&Math.abs(s.z0-s.z1+st.tread)<1e-9,`uniform tread ${k}`));
  assert.ok(Math.abs(pl.steps.at(-1).top-f.top.y)<1e-9,'top tread at the terrace landing');
  const med=a=>[...a].sort((p,q)=>p-q)[Math.floor(a.length/2)],line=z=>{const v=[];for(let x=st.x0;x<=st.x1+1e-6;x+=.5)v.push(w.height(x,z));return v;};
  assert.ok(Math.abs(med(line(st.zTop-.3))-f.top.y)<.01&&Math.abs(med(line(st.zFoot+.3))-f.foot.y)<.01,'landings on the ground they meet (median ≤ 1 cm)');
});
test('ramp deck, stair treads and monument base meet the shared heightfield; walls reach below their feet',()=>{
  for(const p of rp.rows[0].points)assert.ok(Math.abs(p[1]-.015-w.height(p[0],p[2]))<1e-9,'Deck start row lies on the terrain');
  for(const {side,list} of rp.sides)for(const s of list){const a=rp.rows[s.a],b=rp.rows[s.b];
    assert.ok(s.bottom<Math.min(a.y,b.y)-.4,'Wall bottom below the deck');
    for(const r of [a,b])assert.ok(s.bottom<w.height(...r.at(side*rp.outerHalf))-.3,'Wall bottom below the outer DEM');}
  // Bands beside the walls: outer edge on the exact kept terrain, skirts reach the kept terrain, wall bottoms below the foot.
  let edge=0;
  for(const band of rp.bands){for(const tri of band.tris)for(const p of tri){const v=Math.abs(along(p[0],p[2]).d);
      if(Math.abs(v-(rp.outerHalf+2.5))<1e-6){edge++;assert.ok(Math.abs(p[1]-w.height(p[0],p[2]))<1e-9,'Band outer edge on the terrain');}}
    for(const sk of band.skirts)for(const [lo,hi] of sk.rows)assert.ok(Math.abs(hi[1]-Math.max(lo[1],w.height(hi[0],hi[2])))<1e-9&&lo[1]<=hi[1],'Skirt top on the terrain');
    for(const {side,list} of rp.sides)if(side===band.side)for(const s of list)assert.ok(s.bottom<=Math.min(band.foot[s.a],band.foot[s.b])-.4,'Wall bottom below the band foot');}
  assert.ok(edge>100,`band edge vertices ${edge}`);
  // The smeared DEM hump is gone: the band surface beside the walls never rises above its kept outer edge by >2 cm.
  for(const band of rp.bands)for(const [p,q,v] of band.tris){const hi=Math.max(p[1],q[1],v[1]),out=[p,q,v].filter(x=>Math.abs(x[1]-w.height(x[0],x[2]))<1e-9);
    if(out.length)assert.ok(hi<=Math.max(...out.map(x=>x[1]))+.02,'Band rises above its outer edge');}
  // Every point of the deck lies inside the render cut (no DEM poking through) and the deck reaches the door plane.
  const inside=(x,z)=>c.cuts.some(q=>q.planes.every(pl=>pl[0]*x+pl[2]*z+pl[3]>0));
  for(let i=0;i+1<rp.rows.length;i++)for(const v of [-rp.outerHalf+.05,0,rp.outerHalf-.05]){const a=rp.rows[i].at(v),b=rp.rows[i+1].at(v);
    for(const t of [.1,.5,.9])assert.ok(inside(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),`Deck interval ${i} outside the cut`);}
  assert.ok(UV(...rp.rows.at(-1).p)[0]>=e.uDoor,'Deck reaches the door plane');
  // Treads: inside the flight's render cut (the smeared DEM never shows through) and with a replacement top at the drawn
  // tread height (physics = drawn), body below the lowest ground under it.
  const st=pl.stair;for(const s of pl.steps){const m=[(st.x0+st.x1)/2,(s.z0+s.z1)/2];assert.ok(inside(...m),'tread inside the render cut');
    assert.ok(s.bottom<w.height(...m),'tread body below the ground');const o={normal:{}};w.sampler.sampleGround(m[0],m[1],o,s.top+.3);
    // Part two (js/sj-stairs.js): the physical support is the smooth lifted nose-line support over the drawn treads.
    // (≥ tread − 3.5 cm: the convex top fillet's sloped-ground allowance; the presentation hook seats the drawn wheel.)
    assert.ok(o.height>=s.top-.035&&o.height<=s.top+st.rise+.12,`physical support ${o.height.toFixed(3)} over tread ${s.top.toFixed(3)}`);}
  assert.ok(pl.monument.bottom<w.height(pl.monument.x,pl.monument.z)-.1,'Monument base buried');
  // Approach and gate frame are coherent: the ramp arrives on the gate axis.
  const last=rp.rows.at(-3);assert.ok(Math.abs(UV(...last.p)[1])<1e-6,'Final landing on the gate axis');
});
test('San Cristóbal ramparts hide the smeared DEM scarp and never fold back; every face reaches below its foot',()=>{
  let checked=0;const corners=c.stations.filter(s=>s.corner).map(s=>s.F);
  const segCount=Object.fromEntries(c.runs.map(r=>[r.name,r.segs.length]));
  const firstReal=Object.fromEntries(c.runs.map(r=>[r.name,r.returns[0]?1:0])),lastReal=Object.fromEntries(c.runs.map(r=>[r.name,segCount[r.name]-(r.returns[1]?2:1)]));
  for(const {a,b,run} of c.walls){if(a.corner||b.corner||a.seg<firstReal[run]||a.seg>lastReal[run])continue;
    for(let t=.05;t<1;t+=.15)for(let d=.13;d<3;d+=.25){
      const limit=a.base+(b.base-a.base)*t+c.constants.PLINTH.rise,fx=a.F[0]+(b.F[0]-a.F[0])*t,fz=a.F[1]+(b.F[1]-a.F[1])*t,x=fx+a.nx*d,z=fz+a.nz*d;
      if(corners.some(q=>Math.hypot(q[0]-x,q[1]-z)<3.5))continue;
      if(along(x,z).d<rp.outerHalf+.5)continue; // the ramp body owns that ground
      assert.ok(w.height(x,z)<=limit+.25*d,`DEM ${(w.height(x,z)-limit).toFixed(2)} m above the plinth in front of ${fx.toFixed(1)},${fz.toFixed(1)}`);checked++;}}
  assert.ok(checked>2500,`checked ${checked}`);
  for(const run of c.runs){
    for(const seg of run.segs){const al=p=>(p[0]-seg.a[0])*seg.ux+(p[1]-seg.a[1])*seg.uz;
      for(const key of ['F','B','T','W'])for(let i=1;i<seg.stations.length;i++)
        assert.ok(al(seg.stations[i][key])>=al(seg.stations[i-1][key])-1e-6,`${run.name} ${key} folds back at s=${seg.stations[i].s.toFixed(1)}`);}
    for(const s of run.stations)assert.ok(s.bottom<=w.height(...s.F)-.39&&s.bottom<=w.height(...s.B)-.39,`${run.name} face bottom floats at s=${s.s.toFixed(1)}`);}
  assert.ok(c.stations.every(s=>s.dFoot<5),'Face feet within 5 m of the mapped outline');
  // No rampart face, foot or parapet stands in the ramp corridor.
  for(const s of c.stations)for(const key of ['F','B','T','L'])assert.ok(along(...s[key]).d>rp.outerHalf-.01||UV(...s[key])[0]>e.uFront-.01,`${key} inside the ramp at ${s[key].map(v=>v.toFixed(1))}`);
});
test('parapets keep a rider on the San Cristóbal wall walks',()=>{
  let tried=0;
  for(const s of c.stations.filter((s,i)=>!s.corner&&i%5===0&&s.walk-s.base>4)){
    const x=(s.Q[0]+s.W[0])/2,z=(s.Q[1]+s.W[1])/2,heading=Math.atan2(s.nx,s.nz),y=w.sampler.sampleGround(x,z,{normal:{}},s.walk+.3).height;
    const start=w.sampler.findPlacementTarget({x,z,headingY:heading,referenceY:y});
    if(!start||start.y<s.walk-.3)continue;tried++;
    const ctl=new EucController(w.sampler,{spawn:{position:{x:start.x,y:start.y,z:start.z},headingY:heading}}),p=createPose();
    let minY=start.y;
    for(let i=0;i<120*3;i++){ctl.step(1/120,{...NEUTRAL_ACTIONS,throttle:.55});ctl.writePose(p);minY=Math.min(minY,p.y);}
    assert.ok(minY>s.walk-1.2,`Fell from the San Cristóbal wall at s=${s.s.toFixed(1)} (min ${minY.toFixed(2)}, walk ${s.walk.toFixed(2)})`);}
  assert.ok(tried>20,`parapet starts ${tried}`);
});
test('Plaza Colón paving is a convex, disjoint single owner clear of every other overlay',()=>{
  for(const s of c.surfaces){const r=s.ring;assert.ok(signedArea(r)>0,'Counter-clockwise');
    for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],d=r[(i+2)%r.length];
      assert.ok((b[0]-a[0])*(d[1]-b[1])-(b[1]-a[1])*(d[0]-b[0])>=-1e-9,'Convex piece');}}
  for(let i=0;i<c.surfaces.length;i++)for(let j=i+1;j<c.surfaces.length;j++)
    assert.ok(Math.abs(signedArea(intersectRings(c.surfaces[i].ring,c.surfaces[j].ring)))<1e-6,'Disjoint pieces');
  const others=[...(w.gate?.surfaces??[]),...(w.fort?.surfaces??[]),...(w.princesa?.surfaces??[])];
  for(const s of c.surfaces)for(const o of others){const r=signedArea(o.ring)<0?[...o.ring].reverse():o.ring;
    assert.ok(Math.abs(signedArea(intersectRings(s.ring,r)))<1e-6,'No overlap with another area overlay');}
  const area=c.surfaces.reduce((n,s)=>n+signedArea(s.ring),0);assert.ok(area>2500&&area<4500,`plaza area ${area.toFixed(0)}`);
});
test('Plaza Colón terrace: monument/cascade/bastion are solid, the open sides are level crossings, the column is supported',()=>{
  const m=pl.monument;
  // Riding at the column from the terrace stops at the stepped base.
  const t=push([m.x,m.z-9],0,3,.5,pl.terraceY+.3);
  assert.ok(Math.min(...t.map(p=>Math.hypot(p.x-m.x,p.z-m.z)))>c.constants.MONUMENT_DIMS.base/2-.6,'Rode into the monument base');
  assert.ok(t.every(p=>!p.crashed||p.y<m.baseTop),'No ride onto the base');
  // Open sides: the terrace is reached at grade from the west and east level crossings (no wall where |Δ|<0.4 m).
  const westOpen=push([470,-76],Math.PI/2,3,.5),eastOpen=push([507,-76],-Math.PI/2,3,.5);
  assert.ok(westOpen.some(p=>p.x>478)&&!westOpen.at(-1).crashed,'West level crossing onto the terrace');
  assert.ok(eastOpen.some(p=>p.x<499)&&!eastOpen.at(-1).crashed,'East level crossing onto the terrace');
  // The column stands on the pedestal: every part's bottom is at or below the part beneath's top.
  assert.ok(m.baseTop<m.stepTop&&m.stepTop<m.pedestalTop&&m.pedestalTop<m.corniceTop&&m.corniceTop<m.shaftBottom&&m.shaftTop<m.capitalTop&&m.capitalTop<m.plinthTop);
  assert.ok(m.statueTop-pl.terraceY>14&&m.statueTop-pl.terraceY<19,`column height ${(m.statueTop-pl.terraceY).toFixed(1)}`);
  // Mapped trees are claimed exactly from city.trees (sj-world skips them) and stand inside the plaza.
  assert.equal(c.trees.length,9);
  for(const t of c.trees)assert.ok(w.city.trees.some(([x,z])=>x===t.x&&z===t.z)&&inRing(t.x,t.z,pl.ring));
});
test('San Cristóbal layout is bounded and finite with a dry ramp arrival and salient garitas',()=>{
  assert.equal(c.places.length,1);assert.ok(c.places.every(p=>w.isDry(p.x,p.z)));
  assert.ok(c.tops.every(t=>t.replacesTerrain&&Number.isFinite(t.plane.dx)&&Number.isFinite(t.plane.dz)&&t.maxReferenceY<40));
  assert.ok(c.colliders.every(q=>(q.outer??[]).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))&&(!q.outer||q.maxY>q.minY)));
  assert.ok(c.garitas.length>=1);for(const g of c.garitas)assert.ok(g.y>w.height(g.x,g.z)-1&&g.y<w.height(g.x,g.z)+25);
  assert.ok(rp.grade>.08&&rp.grade<.16,`ramp grade ${rp.grade.toFixed(3)}`);
  const q=c.qa();assert.ok(JSON.stringify(q).length<4000,'Bounded QA summary');
  console.log('San Cristóbal layout',JSON.stringify({walls:c.walls.length,colliders:c.colliders.length,tops:c.tops.length,cuts:c.cuts.length,
    runs:q.runs,garitas:q.garitas,ramp:{length:q.rampLength,grade:q.grade,y0:q.y0,gate:q.deckGate},terrace:q.terraceY,stair:[q.stairFoot,q.rise]}));
});
test('continuous ride: Plaza Colón → Norzagaray → up the ramp to the gate, and back down to the plaza',()=>{
  // Plaza north-east corner onto Norzagaray (OSM 196602955 / 295380549) up to the ramp foot.
  const street=[[505,-92],[527,-108],[536.6,-119.8],[536.15,-121.94],[531.49,-138.19],[515.57,-177.62],[507.19,-198.71],[500.05,-214.97],[495.22,-223.34],[491.71,-228.07]];
  const up=rampUp(),route=[...street,...up];
  const there=ride(route,3.4,240),back=ride([...route].reverse(),3.4,240,rp.yGate+.3);
  assert.ok(there.onDeck>150&&back.onDeck>150,'Rode the deck both ways');
  console.log('Plaza Colón ↔ San Cristóbal gate seconds',there.seconds.toFixed(1),back.seconds.toFixed(1));
});
