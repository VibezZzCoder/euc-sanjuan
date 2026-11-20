/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('three/webgpu');
const {RidingCamera}=await import('../js/sj-camera.js');
const fixture=()=>({controls:new RidingCamera(),camera:new THREE.PerspectiveCamera(62,1,.15,5000),entity:{position:new THREE.Vector3(0,10,0),heading:0,mesh:{visible:true}},world:{height:()=>10,sampler:{raycast:()=>null}}});
test('chase keeps original resting framing; look-around looks upward without moving the rider',()=>{
  const {controls:c,camera,entity:e,world:w}=fixture();c.update(camera,e,w,0,true);
  assert.deepEqual(camera.position.toArray(),[0,11.5+Math.sin(.25)*5.8,-5.8]);
  c.setMode('look');c.turn(0,-.8);c.update(camera,e,w,0);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).y>.7);assert.equal(e.mesh.visible,false);
  assert.deepEqual(e.position.toArray(),[0,10,0]);assert.equal(e.heading,0);
  c.cycle();c.update(camera,e,w,0);assert.equal(e.mesh.visible,true);assert.equal(c.mode,'chase');
});
test('extreme inputs stay bounded and recenter restores the selected preset',()=>{
  const {controls:c}=fixture();
  for(const mode of ['chase','wide','look']){c.setMode(mode);c.turn(1e5,1e5);c.zoom(1e5);
    assert.ok(Math.abs(c.orbit)<Math.PI*2&&Math.abs(c.pitch)<=1.3);assert.ok(c.distance<=24&&c.fov<=85);
    c.zoom(-1e5);assert.ok(c.distance>=3&&c.fov>=40);c.resetOrbit();assert.equal(c.orbit,0);assert.equal(c.fov,62);
    assert.equal(c.distance,mode==='wide'?12:5.8);
  }
});
test('actual damped camera ray is clipped before a wall, including a near-target obstruction',()=>{
  const {controls:c,camera,entity:e,world:w}=fixture();c.update(camera,e,w,0,true);c.orbit=Math.PI/2;
  let origin,direction,length;w.sampler.raycast=(o,d,l)=>{origin=o.clone();direction=d.clone();length=l;return 1;};
  c.update(camera,e,w,1/60);assert.ok(length>1);assert.ok(Math.abs(camera.position.distanceTo(origin)-.7)<1e-9);
  assert.ok(camera.position.clone().sub(origin).normalize().distanceTo(direction)<1e-9);
  w.sampler.raycast=()=>.4;c.update(camera,e,w,1/60);assert.ok(camera.position.distanceTo(c.target)<.4);
});
test('unobstructed camera damping is independent of render cadence',()=>{
  const positions=[];
  for(const hz of [30,60,120]){const {controls:c,camera,entity:e,world:w}=fixture();c.update(camera,e,w,0,true);c.orbit=.8;
    for(let i=0;i<hz;i++)c.update(camera,e,w,1/hz);positions.push(camera.position);}
  assert.ok(positions[0].distanceTo(positions[1])<1e-9&&positions[1].distanceTo(positions[2])<1e-9);
});
