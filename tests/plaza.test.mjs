/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Reference-area collision/support regressions, native EUC controller, no renderer/test hooks.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
globalThis.fetch=async url=>{const b=readFileSync(url);return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const {loadCity}=await import('../js/sj-world.js');
const {EucController,createPose}=await import('../js/euc/simulation/EucController.js');
const {NEUTRAL_ACTIONS}=await import('../js/euc/input/actions.js');
const w=await loadCity();
const {terrainFoundation}=await import('../js/sj-plaza-layout.js');
const clear=(x,z,y=w.height(x,z))=>w.sampler.isVolumeClear({x,z,headingY:0,halfWidthMetres:.2,halfLengthMetres:.2,minY:y+.05,maxY:y+1.6});

test('source geography and all large building envelopes remain exact',()=>{
  const original=JSON.parse(readFileSync(new URL('../data/city.json',import.meta.url)));
  assert.deepEqual(w.city.roads,original.roads);assert.deepEqual(w.city.places,original.places);
  for(let i=0;i<original.buildings.length;i++) {
    const a=original.buildings[i],b=w.city.buildings[i];
    if([410592051,410620625].includes(a.id)) {
      assert.deepEqual(b.outer,a.outer);assert.deepEqual(b.holes,a.holes);assert.equal(b.base,a.base);assert.ok(b.roof<a.roof);
    }else assert.deepEqual(a,b);
  }
});
test('fountain body matches the visible base; outside clearance remains open',()=>{
  const f=w.plaza.fountain;
  assert.equal(clear(f.x,f.z),false);
  for(let i=0;i<32;i++) {
    const a=i*Math.PI/16;
    assert.equal(clear(f.x+Math.cos(a)*(f.radius-.4),f.z+Math.sin(a)*(f.radius-.4)),false);
    assert.equal(clear(f.x+Math.cos(a)*(f.radius+1.1),f.z+Math.sin(a)*(f.radius+1.1)),true);
  }
});
test('bench, trunk, planter and lamp solids have clear adjacent recovery space',()=>{
  for(const p of [...w.plaza.benches,...w.plaza.trees,...w.plaza.palms,...w.plaza.lamps]) {
    assert.equal(clear(p.x,p.z),false);
    let open=0;
    for(let i=0;i<8;i++){const a=i*Math.PI/4,x=p.x+Math.cos(a)*2,z=p.z+Math.sin(a)*2;
      if(w.sampler.findPlacementTarget({x,z,headingY:a,referenceY:w.height(x,z)}))open++;}
    assert.ok(open>=2,`Recovery space ${p.x},${p.z}`);
  }
});
test('gazebo has a real supported deck between columns, not a visual floor',()=>{
  const g=w.plaza.gazebo;
  const floor=w.sampler.sampleGround(g.x,g.z,{normal:{}},g.y+1);
  assert.ok(Math.abs(floor.height-(g.y+.45))<1e-6);
  assert.equal(clear(g.x,g.z,g.y+.45),true);
  assert.equal(clear(g.x,g.z,g.y+3.5),false,'Canopy blocks an upward hop');
});
test('level fountain/gazebo foundations reach below every sampled perimeter and interior point',()=>{
  for(const name of ['fountain','gazebo']) {
    const f=w.plaza[name],base=f.foundation;
    assert.equal(base.maxY,f.y+(name==='fountain'?.205:.45));
    for(let i=0;i<f.outer.length;i++) {
      const a=f.outer[i],b=f.outer[(i+1)%f.outer.length];
      for(let u=0;u<=1;u+=.025) {
        const x=a[0]+(b[0]-a[0])*u,z=a[1]+(b[1]-a[1])*u;
        assert.ok(base.minY<=w.height(x,z)-.1199,`${name} edge footing`);
        for(const scale of [.25,.5,.75])assert.ok(base.minY<=w.height(f.x+(x-f.x)*scale,f.z+(z-f.z)*scale)-.1199);
      }
    }
    const body=w.plaza.colliders.find(c=>c.outer&&Math.abs(c.minY-base.minY)<1e-9&&c.outer.length===f.outer.length
      &&c.outer[0].x===f.outer[0][0]&&c.outer[0].z===f.outer[0][1]);
    assert.ok(body,`${name} shared collision bottom`);
    if(name==='gazebo')assert.equal(body.maxY,base.maxY);
  }
});
test('foundation bounds account for terrain depressions between perimeter samples',()=>{
  const t={x0:0,z0:0,step:1,nx:4,nz:4,heights:new Float32Array(16)};
  t.heights[6]=-3;
  const base=terrainFoundation([[.2,.2],[2.8,.2],[2.8,2.8],[.2,2.8]],t,1);
  assert.equal(base.minY,-3.12);assert.equal(base.maxY,1);
});
test('native central/plaza-adjoining street segments stay clear in both directions',()=>{
  const roads=w.city.roads.filter(r=>[247332273,22228550,60330109,60330137].includes(r.id));
  for(const road of roads)for(const reverse of [false,true]) {
    const points=reverse?[...road.points].reverse():road.points,a=points[0],b=points.at(-1);
    const heading=Math.atan2(b[0]-a[0],b[1]-a[1]),x=a[0]+Math.sin(heading)*4,z=a[1]+Math.cos(heading)*4;
    const start=w.sampler.findPlacementTarget({x,z,headingY:heading,referenceY:w.height(x,z)});
    assert.ok(start,`${road.id} placement`);
    const controller=new EucController(w.sampler,{spawn:{position:{x,y:start.y,z},headingY:heading}}),pose=createPose();
    for(let i=0;i<540;i++)controller.step(1/120,{...NEUTRAL_ACTIONS,throttle:.45});
    controller.writePose(pose);assert.equal(controller.crashed,false,`${road.id} reverse ${reverse}`);
    assert.ok(Math.hypot(pose.x-x,pose.z-z)>8);
  }
});
test('native fountain approach contacts the visible rim instead of entering the water',()=>{
  const f=w.plaza.fountain,x=f.x,z=f.z+f.radius+4,heading=Math.PI;
  const start=w.sampler.findPlacementTarget({x,z,headingY:heading,referenceY:w.height(x,z)});assert.ok(start);
  const c=new EucController(w.sampler,{spawn:{position:{x,y:start.y,z},headingY:heading}}),pose=createPose();
  let stopped=false;
  for(let i=0;i<720;i++) {
    c.step(1/120,{...NEUTRAL_ACTIONS,throttle:.65});c.writePose(pose);
    assert.ok(Math.hypot(pose.x-f.x,pose.z-f.z)>=f.radius-.3,'Never crosses physical rim');
    if(c.crashed){stopped=true;break;}
  }
  assert.ok(stopped||Math.abs(pose.speed)<.5);
});
test('native gazebo approach contacts the grounded plinth without entering beneath the deck',()=>{
  const g=w.plaza.gazebo,x=g.x-g.radius-4,z=g.z,heading=Math.PI/2;
  const start=w.sampler.findPlacementTarget({x,z,headingY:heading,referenceY:w.height(x,z)});assert.ok(start);
  const c=new EucController(w.sampler,{spawn:{position:{x,y:start.y,z},headingY:heading}}),pose=createPose();
  let stopped=false;
  for(let i=0;i<720;i++){
    c.step(1/120,{...NEUTRAL_ACTIONS,throttle:.65});c.writePose(pose);
    assert.ok(Math.hypot(pose.x-g.x,pose.z-g.z)>=g.radius-.3,'Never passes through visible foundation');
    if(c.crashed){stopped=true;break;}
  }
  assert.ok(stopped||Math.abs(pose.speed)<.5);
});
