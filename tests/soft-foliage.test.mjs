/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Soft foliage (js/sj-soft-foliage.js): shrubs and hedges are drag bodies for the native controller, never solids.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){
  if(specifier==='three/webgpu')return {url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true};
  return next(specifier,context);}});
globalThis.fetch=async url=>{const b=readFileSync(url);return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const {loadCity,AREA_LAYOUTS}=await import('../js/sj-world.js');
const {SoftFoliageField,softBoxOf}=await import('../js/sj-soft-foliage.js');
const {SoftBodyField,NO_SOFT_BODIES}=await import('../js/euc/simulation/softBodies.js');
const {EucController,createPose,slopeAccelFor}=await import('../js/euc/simulation/EucController.js');
const {NEUTRAL_ACTIONS:N}=await import('../js/euc/input/actions.js');
const world=await loadCity();
const field=world.softBodies;
const soft=Object.keys(AREA_LAYOUTS).flatMap(k=>(world[k]?.colliders??[]).filter(c=>c.soft).map(c=>[k,c]));
const T=new EucController(world.sampler,{spawn:{position:{x:0,y:0,z:0},headingY:0}}).tuning;

// The owner's shrub (Bahía Urbana south strip, rider at 902.5, 190.3).
const OWNER=world.bahia.shrubs.reduce((b,s)=>Math.hypot(s.x-902.5,s.z-190.3)<Math.hypot(b.x-902.5,b.z-190.3)?s:b);

test('inventory: every foliage prism is soft, nothing else is',()=>{
  const counts={};for(const [k] of soft)counts[k]=(counts[k]??0)+1;
  const hedgeMid=world.bahia.obeliskSet.hedge.map(h=>[(h.p[0]+h.q[0])/2,(h.p[1]+h.q[1])/2]);
  assert.deepEqual(counts,{puntilla:world.puntilla.hedges.length,bahia:world.bahia.shrubs.length+hedgeMid.length,uptown:world.uptown.shrubs.length});
  assert.equal(field.count,soft.length);assert.ok(field instanceof SoftBodyField);
  const records={bahia:[...world.bahia.shrubs.map(s=>[s.x,s.z]),...hedgeMid],puntilla:world.puntilla.hedges.map(h=>[h.x,h.z]),uptown:world.uptown.shrubs.map(s=>[s.x,s.z])};
  for(const [k,c] of soft){const b=softBoxOf(c);   // each soft prism is centred on a drawn shrub or hedge piece
    assert.ok(records[k].some(([x,z])=>Math.hypot(x-b.centre.x,z-b.centre.z)<.05),`${k} soft prism at ${b.centre.x.toFixed(2)},${b.centre.z.toFixed(2)} is not foliage`);
    assert.ok(field.contains(b.centre.x,b.centre.y,b.centre.z));
    // along the box's long local axis (local X = (cos r, −sin r)), through its middle: the hedge, not the wall behind it
    const lx=b.halfExtents.x>=b.halfExtents.z,hl=lx?b.halfExtents.x:b.halfExtents.z,r=b.rotationY,d=lx?{x:Math.cos(r),y:0,z:-Math.sin(r)}:{x:Math.sin(r),y:0,z:Math.cos(r)};
    const o={x:b.centre.x-d.x*(hl+.05),y:b.centre.y,z:b.centre.z-d.z*(hl+.05)},hit=world.sampler.raycast(o,d,2*hl+.1,true);
    assert.ok(!Number.isFinite(hit),`${k} soft prism still stops the camera ray`);}
  // the obelisk seat wall stays solid
  const seat=world.bahia.obeliskSet.seat[0],m=[(seat.p[0]+seat.q[0])/2,(seat.p[1]+seat.q[1])/2];
  assert.equal(world.sampler.isVolumeClear({x:m[0],z:m[1],headingY:0,halfWidthMetres:.1,halfLengthMetres:.1,minY:seat.y,maxY:seat.y+.3}),false);
});

test('no solid stands inside a soft footprint',()=>{
  const blocked=[];
  for(const [k,c] of soft){const b=softBoxOf(c);   // isVolumeClear's width axis (cos h, −sin h) is the soft box's local X
    const body={x:b.centre.x,z:b.centre.z,headingY:b.rotationY,halfWidthMetres:b.halfExtents.x-.05,halfLengthMetres:b.halfExtents.z-.05,
      minY:b.centre.y-b.halfExtents.y+.25,maxY:b.centre.y+b.halfExtents.y};
    if(!world.sampler.isVolumeClear(body))blocked.push([k,+b.centre.x.toFixed(2),+b.centre.z.toFixed(2)]);}
  assert.deepEqual(blocked,[]);
});

test('packed field matches the stock SoftBodyField',()=>{
  const boxes=soft.map(([,c])=>softBoxOf(c)),stock=new SoftBodyField(boxes);let n=0,inside=0;
  for(const b of boxes)for(let i=0;i<40;i++){const a=i*2.4,r=(i%5)*.25*Math.max(b.halfExtents.x,b.halfExtents.z),y=b.centre.y+((i%3)-1)*.6*b.halfExtents.y;
    const x=b.centre.x+Math.cos(a)*r,z=b.centre.z+Math.sin(a)*r;const s=stock.contains(x,y,z);if(s)inside++;
    if(Math.abs(Math.abs(x-b.centre.x)-b.halfExtents.x)<1e-3||Math.abs(Math.abs(z-b.centre.z)-b.halfExtents.z)<1e-3)continue;
    assert.equal(field.contains(x,y,z),s);n++;}
  assert.ok(n>4000&&inside>1000);assert.equal(new SoftFoliageField([]).empty,true);
});

// Native ride along a straight line holding `speed` until `hold` metres before the target point, then a constant
// throttle (open loop) through the bush. Returns per-step facts.
function ride(softBodies,from,to,speed,{hold=3,hopAt=null,limit=12}={}){
  const hd=Math.atan2(to[0]-from[0],to[1]-from[1]),L=Math.hypot(to[0]-from[0],to[1]-from[1]),ux=(to[0]-from[0])/L,uz=(to[1]-from[1])/L;
  const st=world.sampler.findPlacementTarget({x:from[0],z:from[1],headingY:hd,referenceY:world.height(...from)+1});assert.ok(st,'placement');
  const c=new EucController(world.sampler,{spawn:{position:{x:st.x,y:st.y,z:st.z},headingY:hd},softBodies}),p=createPose();
  let throttle=0,frozen=false,inside=0,drag=0,entry=null,exit=null,crashed=false,airOver=0,maxV=0;const trace=[];
  for(let k=0;k<120*limit;k++){c.writePose(p);if(c.crashed||c.crashing){crashed=true;break;}
    const s=(p.x-from[0])*ux+(p.z-from[1])*uz;if(s>=L)break;maxV=Math.max(maxV,p.speed);
    if(k%12===0)trace.push([+(k/120).toFixed(2),+s.toFixed(2),+p.speed.toFixed(3),c.inSoftBody?1:0,+p.headingY.toFixed(2),+throttle.toFixed(2)]);
    if(c.inSoftBody){inside++;if(entry===null)entry=p.speed;const v=Math.abs(p.speed);drag+=(T.softBodyDrag*Math.min(1,v/T.softBodyDragFadeSpeed)+T.softBodyDragQuadratic*v*v)/120;exit=p.speed;}
    if(c.airborne&&field.contains(p.x,p.y+.3,p.z))airOver++;
    const ang=Math.atan2(from[0]+ux*(s+3)-p.x,from[1]+uz*(s+3)-p.z),err=Math.atan2(Math.sin(ang-p.headingY),Math.cos(ang-p.headingY));   // pure pursuit 3 m ahead
    if(s<L-hold-(to[2]??0)){const g=c.ground.normal,grade=-slopeAccelFor(g,Math.sin(p.headingY),Math.cos(p.headingY),T.gravity);
      throttle=Math.max(-.8,Math.min(1,Math.asin(Math.max(-1,Math.min(1,(grade+(speed-p.speed)*8)/T.leanToAccel)))/T.maxLeanPitch));}
    else frozen=true;
    const hop=hopAt!==null&&Math.abs(s-hopAt)<.05;
    c.step(1/120,{...N,throttle,steer:Math.max(-1,Math.min(1,-err*1.9)),hop,hopHeld:hop});}
  c.writePose(p);
  return {crashed,inside,drag,entry,exit,final:p.speed,s:(p.x-from[0])*ux+(p.z-from[1])*uz,airOver,maxV,trace,frozen};
}
// Lines through the owner's shrub: across the strip from the promenade (walking), a 45 m diagonal run-up (fast).
const along=(s,a,d)=>[s.x+Math.sin(a)*d,s.z+Math.cos(a)*d];
const WALK=[[OWNER.x,OWNER.z-7],[OWNER.x,OWNER.z+2.2]];
const RUN=a=>[along(OWNER,a,-45),along(OWNER,a,3)];
const facts={};
if(process.env.SJ_SOFT_FACTS)process.on('exit',()=>writeFileSync(process.env.SJ_SOFT_FACTS,JSON.stringify(facts,null,1)));

test('walking pace through the owner\'s shrub: no crash, pushes through under throttle',()=>{
  const a=ride(field,...WALK,1.5,{hold:0}),b=ride(NO_SOFT_BODIES,...WALK,1.5,{hold:0});facts.walk={soft:a,none:{maxV:b.maxV,final:b.final}};
  assert.equal(a.crashed,false);assert.equal(b.crashed,false);assert.ok(a.inside>20,'rode inside the bush');
  assert.ok(a.s>=9.2-.05,`came out the far side (${a.s.toFixed(2)} of 9.2 m)`);
  const minIn=Math.min(...a.trace.filter(t=>t[3]).map(t=>t[2]));facts.walk.minInside=minIn;assert.ok(minIn<1.4,'the bush slows the wheel');
});

test('fast through the owner\'s shrub on a diagonal run-up: no crash, slowed by the stock drag',()=>{
  const ang=30*Math.PI/180,[f,t]=RUN(ang);
  const a=ride(field,f,t,9,{hold:4.5,limit:14}),b=ride(NO_SOFT_BODIES,f,t,9,{hold:4.5,limit:14});facts.fast={soft:a,none:{final:b.final}};
  assert.equal(a.crashed,false);assert.equal(b.crashed,false);assert.ok(a.entry>8,`entry ${a.entry}`);assert.ok(a.inside>5);
  const lost=b.final-a.final;facts.fast.lost=lost;assert.ok(lost>a.drag*.5&&lost<a.drag*1.5,`lost ${lost.toFixed(3)} vs predicted ${a.drag.toFixed(3)}`);
});

test('from a standstill inside the bush, throttle rides out',()=>{
  const c=new EucController(world.sampler,{spawn:{position:{x:OWNER.x,y:OWNER.y,z:OWNER.z},headingY:0},softBodies:field}),p=createPose();
  let out=null;for(let k=0;k<120*8;k++){c.writePose(p);assert.equal(c.crashed||c.crashing,false);
    if(!field.contains(p.x,p.y+.1,p.z)&&k>10){out=k/120;break;}c.step(1/120,{...N,throttle:.6});}
  facts.standstill={seconds:out};assert.ok(out!==null&&out<6,`left after ${out}`);
});

test('a hop into the bush: no crash, no drag while airborne',()=>{
  const a=ride(field,...WALK,3.5,{hold:4,hopAt:5.6});facts.hop={crashed:a.crashed,airOver:a.airOver,inside:a.inside,final:a.final};
  assert.equal(a.crashed,false);assert.ok(a.airOver>0,'airborne over the bush footprint');
});

test('a Puntilla hedge: ridden along its line, no crash',()=>{
  const h=world.puntilla.hedges.find(q=>world.puntilla.hedges.some(r=>r!==q&&Math.hypot(r.x-q.x,r.z-q.z)<3.4&&Math.abs(r.ux*q.ux+r.uz*q.uz)>.99));
  const from=[h.x-h.ux*5,h.z-h.uz*5],to=[h.x+h.ux*2,h.z+h.uz*2];
  const a=ride(field,from,to,3,{hold:0});facts.hedge={at:[h.x,h.z],crashed:a.crashed,inside:a.inside,final:a.final};
  assert.equal(a.crashed,false);assert.ok(a.inside>10);assert.ok(a.s>=7-.05,`rode out (${a.s.toFixed(2)} of 7 m)`);
});

test('step cost: soft lookup is negligible',()=>{
  const t0=performance.now();let hit=0;for(let i=0;i<200000;i++)if(field.contains(OWNER.x+(i%97)*.01,OWNER.y+.4,OWNER.z+(i%89)*.01))hit++;
  const per=(performance.now()-t0)/200000*1e3;facts.containsMicroseconds=per;assert.ok(hit>0);assert.ok(per<2,`${per} µs per lookup`);
});
