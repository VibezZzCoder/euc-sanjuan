/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({resolve(specifier,context,next){
  if(specifier==='three/webgpu')return {url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
const {loadCity,areasOf}=await import('../js/sj-world.js');
globalThis.fetch=async url=>{const b=readFileSync(url);return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const world=await loadCity();
const {EucController,createPose}=await import('../js/euc/simulation/EucController.js');
const {NEUTRAL_ACTIONS}=await import('../js/euc/input/actions.js');

test('shared terrain drawing diagonal matches the native sampler throughout dry cells',()=>{
  const t=world.terrain;let checks=0,authored=0;const walk=new Set([...world.gate.colliders,...(world.fort?.colliders??[]),...areasOf(world).flatMap(a=>a.colliders??[])].filter(c=>c.support));
  for(let j=1;j<t.nz-2;j+=13)for(let i=1;i<t.nx-2;i+=11){
    for(const [u,v] of [[.2,.3],[.8,.7]]){
      const x=t.x0+(i+u)*t.step,z=t.z0+(j+v)*t.step;if(!world.isDry(x,z))continue;
      const ground=world.sampler.sampleGround(x,z,{normal:{}},Infinity);
      // Only registered support (Puerta de San Juan, El Morro and other wall walks) may stand above the shared DEM, and the
      // harbour-front skatepark's raised floor (its own drawn facets; tests/skatepark.test.mjs checks drawn = ridden).
      if(Math.abs(ground.height-world.height(x,z))>=1e-9){
        const park=/^skatepark:/.test(ground.support?.source??'')&&ground.support?.capabilities?.restartsAtRest===true;
        assert.ok((walk.has(ground.support?.source)||park)&&ground.height>world.height(x,z),`Unexpected non-terrain support at ${x},${z}`);
        authored++;continue;}
      assert.ok(Math.abs(Math.hypot(ground.normal.x,ground.normal.y,ground.normal.z)-1)<1e-9);checks++;
    }
  }
  // Registered wall walks are a small share of dry ground (2026-11-16: 60/4760 = 1.26 % with the Norzagaray north wall's
  // 711 m walk; 0.82 % before it). The bound guards against blanket authored floors, not against adding walls.
  assert.ok(checks>2000&&authored<=checks*.02,`authored support samples ${authored}`);
});
test('ocean and outside frame cannot become safe placements',()=>{
  for(const [x,z] of [[-1200,-800],[0,-850],[2000,0],[-2000,0]]){
    assert.equal(world.isDry(x,z),false);
    assert.equal(world.sampler.findPlacementTarget({x,z,headingY:0,referenceY:0}),null);
  }
});

test('building footprint cores are solid, with original courtyard holes retained',()=>{
  let blocked=0;
  for(const b of world.city.buildings.slice(0,120)){
    const [x,z]=b.outer[0],body={x,z,headingY:0,halfWidthMetres:.2,halfLengthMetres:.2,minY:b.base+.1,maxY:b.roof-.1};
    if(!world.sampler.isVolumeClear(body))blocked++;
  }
  assert.ok(blocked>110);assert.ok(world.city.buildings.some(b=>b.holes.length));
});
test('stock native controller can ride the central street without a placement override',()=>{
  const road=world.city.roads.find(r=>r.name==='Calle de San Francisco'&&r.length>70);
  assert.ok(road,'source central street');
  let accepted=false;
  for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<25)continue;
    const heading=Math.atan2(b[0]-a[0],b[1]-a[1]),x=a[0]+Math.sin(heading)*3,z=a[1]+Math.cos(heading)*3;
    const start=world.sampler.findPlacementTarget({x,z,headingY:heading,referenceY:world.height(x,z)});if(!start)continue;
    const controller=new EucController(world.sampler,{spawn:{position:{x,y:start.y,z},headingY:heading}}),pose=createPose();
    for(let step=0;step<240;step++)controller.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
    controller.writePose(pose);
    assert.equal(controller.crashed,false);assert.ok(Math.hypot(pose.x-x,pose.z-z)>4);accepted=true;break;
  }
  assert.ok(accepted,'native segment was exercised');
});
test('compact data and index accounting remain inside initial targets',()=>{
  assert.ok(world.terrain.heights.byteLength+world.land.byteLength+world.surface.byteLength<32*1024*1024);
  assert.ok(world.sampler.stats.indexTypedBytes<64*1024*1024);
  const provenance=JSON.parse(readFileSync(new URL('../provenance/geodata.json',import.meta.url)));
  assert.ok(provenance.landAreaKm2<2);assert.ok(provenance.frameAreaKm2<5);
  assert.ok(provenance.quantizationErrorMaxM<=.00501);
});
