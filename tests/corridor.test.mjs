/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Native street/stair access and single-owner geometry regressions, no production hooks.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
globalThis.fetch=async url=>{const b=readFileSync(url);return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const {loadCity}=await import('../js/sj-world.js');
const {EucController,createPose,slopeAccelFor}=await import('../js/euc/simulation/EucController.js');
const {NEUTRAL_ACTIONS}=await import('../js/euc/input/actions.js');
const {createPavingRegions,intersectRings,signedArea}=await import('../js/sj-paving.js');
const {inRing,segmentDistance}=await import('../js/sj-plaza-layout.js');
const w=await loadCity(),cat=w.corridor.cathedral;

function ride(points,speed=3.3,referenceY) {
  const [a,b]=points,headingY=Math.atan2(b[0]-a[0],b[1]-a[1]);
  const start=w.sampler.findPlacementTarget({x:a[0],z:a[1],headingY,referenceY:referenceY??w.height(...a)});
  assert.ok(start,'Clear native start');
  assert.ok(Math.hypot(start.x-a[0],start.z-a[1])<.05,'No relocated route start');
  const c=new EucController(w.sampler,{spawn:{position:{x:start.x,y:start.y,z:start.z},headingY}}),p=createPose();
  let next=1,distance=0,x=start.x,z=start.z,maxY=start.y;
  for(let step=0;step<36000;step++) {
    c.writePose(p);distance+=Math.hypot(p.x-x,p.z-z);x=p.x;z=p.z;maxY=Math.max(maxY,p.y);
    assert.equal(c.crashed,false,`Native crash at ${x.toFixed(2)},${z.toFixed(2)} waypoint ${next}`);
    assert.equal(w.sampler.isWater(x,z,p.y),false);
    while(next<points.length&&Math.hypot(points[next][0]-x,points[next][1]-z)<(speed<2?.24:1.2))next++;
    if(next===points.length)return {distance,seconds:step/120,pose:p,maxY};
    const to=points[next],angle=Math.atan2(to[0]-x,to[1]-z),error=Math.atan2(Math.sin(angle-p.headingY),Math.cos(angle-p.headingY));
    const target=Math.abs(error)>.4?Math.min(1.5,speed):speed;
    const grade=-slopeAccelFor(c.ground.normal,Math.sin(p.headingY),Math.cos(p.headingY),c.tuning.gravity);
    const drive=Math.asin(Math.max(-1,Math.min(1,(grade+(target-p.speed)*2)/c.tuning.leanToAccel)))/c.tuning.maxLeanPitch;
    c.step(1/120,{...NEUTRAL_ACTIONS,throttle:Math.max(-.8,Math.min(1,drive)),steer:Math.max(-1,Math.min(1,-error*1.8))});
  }
  assert.fail(`Route timeout at ${x.toFixed(2)},${z.toFixed(2)} waypoint ${next}`);
}
test('continuous native Plaza → Cristo → cathedral frontage → Monjas ride and return',()=>{
  const route=[[-25,14.4],[-44.848,19.171],[-134.375,37.068],[-146.246,-12.287],[-150.777,-32.122],[-185,-24.35]];
  const result=ride([...route,...route.slice(0,-1).reverse()]);
  assert.ok(result.distance>400&&result.distance<500);console.log('Corridor native loop',JSON.stringify({distance:result.distance,seconds:result.seconds}));
});
test('every entrance has native ascending and descending supported stair access',()=>{
  for(const door of cat.doors) {
    const point=d=>{const p=cat.frame.point(door.u,0,d);return [p[0],p[2]];};
    // Keep the controller continuous through the turn: arbitrary narrow-tread teleport checks are a different contract.
    const result=ride([point(4),point(1.15),point(4)],.8);
    assert.ok(result.maxY>w.height(...point(4))+.45);
    assert.ok(result.pose.y<result.maxY-.4);
  }
});
test('stair treads: drawn only, the smooth module support over them, DEM inside the render cut, outside the road strip',()=>{
  // Shared stair module (js/sj-stairs.js): no tread solids; the physical support is the lifted nose-line support.
  const inside=(x,z)=>{const y=w.height(x,z);return w.corridor.cuts.some(q=>q.planes.every(pl=>pl[0]*x+pl[1]*y+pl[2]*z+pl[3]>0));};
  assert.ok(!w.corridor.colliders.some(c=>cat.steps.some(s=>JSON.stringify(c.outer.map(p=>[p.x,p.z]))===JSON.stringify(s.outer))),'no tread solids');
  for(const s of cat.steps) {
    const p=cat.frame.point(s.u,0,s.front-s.depth/2);
    const floor=w.sampler.sampleGround(p[0],p[2],{normal:{}},s.maxY+.3);
    assert.ok(floor.height>=s.maxY-.005&&floor.height<=s.maxY+cat.flight.risers.h+.12,`support ${floor.height} over tread ${s.maxY}`);
    for(let u=.02;u<=.98;u+=.024)for(let d=.05;d<=.95;d+=.1) {
      const q=cat.frame.point(s.u-s.width/2+s.width*u,0,s.front-s.depth*d);
      assert.ok(inside(q[0],q[2])||s.maxY-w.height(q[0],q[2])>=.02499,'No terrain protrudes through a tread');
    }
    for(const v of s.outer) {
      assert.ok(s.minY<w.height(...v));
      for(const road of w.corridor.paving)assert.ok(segmentDistance(...v,road.a,road.b)>road.width/2+.8);
    }
  }
});
test('all combined corridor/plaza paving regions are nonoverlapping and retain the input union',()=>{
  const regions=createPavingRegions(w.detail,w.plaza);
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++)
    assert.ok(Math.abs(signedArea(intersectRings(regions[i].ring,regions[j].ring)))<1e-7);
  for(const road of w.corridor.paving)for(let i=1;i<20;i++) {
    const p=road.a.map((v,j)=>v+(road.b[j]-v)*i/20);
    assert.equal(regions.filter(r=>inRing(...p,r.ring)).length,1,'Road centreline has exactly one visible material');
  }
});
test('Cristo sett crosses San Francisco continuously and does not end at the old detail-box edge',()=>{
  const regions=createPavingRegions(w.detail,w.plaza),road=w.city.roads.find(r=>r.id===248557858);
  const a=road.points.at(-2),b=road.points.at(-1),len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  for(let d=-6.173;d<len-.5;d+=.731)for(const side of [-2.2,-.4,1.7]){
    const owners=regions.filter(r=>inRing(a[0]+ux*d-uz*side,a[1]+uz*d+ux*side,r.ring));
    assert.equal(owners.length,1);assert.equal(owners[0].kind,'sett',`Continuous cobbles at ${d.toFixed(3)}m`);
  }
  const last=w.corridor.paving.filter(r=>r.source===road.id).at(-1);
  assert.deepEqual(last.b,b,'Finish at the mapped street endpoint, not z=43');
  assert.equal(w.corridor.bounds.maxZ,43,'Facade scope remains bounded independently');
});
test('cathedral remains closed and the exterior arrival has two clear road directions',()=>{
  const p=cat.frame.point(cat.width/2,cat.ground,-.5);
  assert.equal(w.sampler.isVolumeClear({x:p[0],z:p[2],headingY:0,halfWidthMetres:.2,halfLengthMetres:.2,minY:p[1]+.1,maxY:p[1]+1.7}),false);
  const place=w.corridor.places[0];
  for(const headingY of [.235,.235+Math.PI])for(let d=0;d<=16;d+=.5) {
    const x=place.x+Math.sin(headingY)*d,z=place.z+Math.cos(headingY)*d;
    assert.ok(w.sampler.findPlacementTarget({x,z,headingY,referenceY:w.height(x,z)}));
  }
});
