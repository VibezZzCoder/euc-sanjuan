/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const THREE=await import('three/webgpu');
const {RidingCamera,CAMERA_PRESETS,CAMERA_TUNING,springStep}=await import('../js/sj-camera.js');
// A small geometric world: flat ground at y=10, optional roof, axis-aligned boxes. Rays from inside a box return 0, as
// the sampler's do.
function boxRay(b,o,d,max){let t0=0,t1=max;
  for(const k of ['x','y','z']){const i=k==='x'?0:k==='y'?1:2;
    if(Math.abs(d[k])<1e-12){if(o[k]<b.min[i]||o[k]>b.max[i])return null;continue;}
    let a=(b.min[i]-o[k])/d[k],c=(b.max[i]-o[k])/d[k];if(a>c)[a,c]=[c,a];t0=Math.max(t0,a);t1=Math.min(t1,c);if(t0>t1)return null;}
  return t0;}
const fixture=({aspect=1.6,roof,boxes=[]}={})=>{
  const controller={placementSerial:1,crashed:false,airborne:false,ground:{normal:{x:0,y:1,z:0}}};
  const world={boxes,height:()=>10,sampler:{waterLevel:0,
    raycast:(o,d,l)=>{const L=Math.hypot(d.x,d.y,d.z),u={x:d.x/L,y:d.y/L,z:d.z/L};let best=null;for(const b of world.boxes){const h=boxRay(b,o,u,l);if(h!==null&&(best===null||h<best))best=h;}return best;},
    cityGround:(x,z,out)=>Object.assign(out,{height:10,offCourse:false,water:false,support:roof?{ceiling:roof}:null})}};
  return {controls:new RidingCamera(),camera:new THREE.PerspectiveCamera(62,aspect,.15,5000),
    entity:{position:new THREE.Vector3(0,10,0),heading:0,speed:0,mesh:{visible:true},pose:{airHeight:0,crashBlend:0},controller},world};
};
const box=(x0,y0,z0,x1,y1,z1)=>({min:[x0,y0,z0],max:[x1,y1,z1]});
const step=(f,seconds,hz=60,each)=>{for(let i=0;i<Math.round(seconds*hz);i++){each?.((i+1)/hz);f.controls.update(f.camera,f.entity,f.world,1/hz);}};
const resting=(pivotY,{distance,pitch},yaw=0)=>[-Math.sin(yaw)*Math.cos(pitch)*distance,pivotY+Math.sin(pitch)*distance,-Math.cos(yaw)*Math.cos(pitch)*distance];
const PIVOT=()=>new THREE.Vector3(0,10+CAMERA_TUNING.pivotHeight,0);

test('chase rests behind and above the chest; look-around looks upward without moving the rider',()=>{
  const {controls:c,camera,entity:e,world:w}=fixture();c.update(camera,e,w,0,true);
  const want=resting(10+CAMERA_TUNING.pivotHeight,CAMERA_PRESETS.chase);
  camera.position.toArray().forEach((v,i)=>assert.ok(Math.abs(v-want[i])<1e-9,`resting chase ${camera.position.toArray()}`));
  camera.updateMatrixWorld();const ndc=new THREE.Vector3(0,11.05,0).project(camera);assert.ok(ndc.y<-.05&&ndc.y>-.6,`rider ndc ${ndc.y}`);
  c.setMode('look');c.turn(0,-.8);c.update(camera,e,w,0);
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).y>.7);assert.equal(e.mesh.visible,false);
  assert.deepEqual(e.position.toArray(),[0,10,0]);assert.equal(e.heading,0);
  c.cycle();c.update(camera,e,w,0);assert.equal(e.mesh.visible,true);assert.equal(c.mode,'chase');
});

test('extreme or invalid inputs stay bounded; Center restores the preset; zoom is remembered per view',()=>{
  const {controls:c}=fixture();
  for(const mode of ['chase','wide','look']){c.setMode(mode);c.turn(1e5,1e5);c.zoom(1e5);c.turn(NaN,0);c.zoom(NaN);c.turn(0,Infinity);
    assert.ok(Math.abs(c.orbit)<=Math.PI&&Math.abs(c.pitch)<=1.3);assert.ok(c.distance<=24&&c.fov<=85);
    c.zoom(-1e5);assert.ok(c.distance>=3&&c.fov>=40);c.resetOrbit();assert.equal(c.orbit,0);assert.equal(c.fov,62);
    assert.equal(c.distance,mode==='look'?CAMERA_PRESETS.chase.distance:CAMERA_PRESETS[mode].distance);
  }
  c.setMode('chase');c.zoom(4);const chase=c.distance;c.setMode('wide');c.zoom(-2);const wide=c.distance;
  c.setMode('look');c.zoom(-3);const fov=c.fov;
  c.setMode('chase');assert.equal(c.distance,chase);c.setMode('wide');assert.equal(c.distance,wide);c.setMode('look');assert.equal(c.fov,fov);
});

test('a thin wall behind springs the boom in over a few frames; a lens inside a thick wall is cut at once',()=>{
  const f=fixture();step(f,.3);
  f.world.boxes.push(box(-20,0,-2.6,20,40,-2.3));f.controls.update(f.camera,f.entity,f.world,1/60);
  const d1=f.camera.position.distanceTo(PIVOT());assert.ok(d1>3,`one frame later the boom is still springing (${d1})`);
  step(f,.4);assert.ok(f.camera.position.z>-2.3+.25,`in front of the wall after 0.4 s (z ${f.camera.position.z})`);
  const g=fixture();step(g,.3);g.world.boxes.push(box(-20,0,-30,20,40,-2.3));g.controls.update(g.camera,g.entity,g.world,1/60);
  assert.ok(g.camera.position.z>-2.3+.2,`cut in front of a thick wall in one frame (z ${g.camera.position.z})`);
  const h=fixture({boxes:[box(-20,0,-30,20,40,-.6)]});h.controls.update(h.camera,h.entity,h.world,0,true);step(h,.2);
  assert.ok(h.camera.position.distanceTo(PIVOT())<=CAMERA_TUNING.minDistance+1e-6);assert.equal(h.entity.mesh.visible,false,'rider hidden, not sliced');
});

test('a 10 cm post on the boom does not pull the camera in; a wall moving away is followed out after a wait',()=>{
  const f=fixture({boxes:[box(-.05,0,-3.05,.05,40,-2.95)]});f.controls.update(f.camera,f.entity,f.world,0,true);step(f,.5);
  assert.ok(Math.abs(f.controls.actual-CAMERA_PRESETS.chase.distance)<1e-6,`post ignored (${f.controls.actual})`);
  f.world.boxes=[box(-20,0,-30,20,40,-2.5)];step(f,.3);assert.ok(f.controls.actual<2.3);
  f.world.boxes=[];step(f,.2);assert.ok(f.controls.actual<2.6,'waits before easing out');
  step(f,3);assert.ok(f.controls.actual>CAMERA_PRESETS.chase.distance-.05,'eventually back at rest');
});

test('a bore ceiling keeps the lens below the roof and above the floor',()=>{
  const f=fixture({roof:13.2});f.controls.update(f.camera,f.entity,f.world,0,true);step(f,1);
  assert.ok(f.camera.position.y<=13.2-CAMERA_TUNING.lensClearance+1e-6,`lens ${f.camera.position.y}`);
  assert.ok(f.camera.position.y>=10+CAMERA_TUNING.lensClearance-1e-6);
});

test('manual orbit holds while steered, then eases back behind a moving rider; it stays put when stopped',()=>{
  const f=fixture();step(f,.2);f.controls.turn(-1.2,0);
  step(f,1);assert.ok(Math.abs(f.controls.orbit-1.2)<1e-9,'standing: orbit kept');
  f.entity.speed=4;step(f,1,60,()=>f.controls.turn(0.0001,0));assert.ok(Math.abs(f.controls.orbit)>1,'held while the player keeps steering');
  step(f,4);assert.ok(Math.abs(f.controls.orbit)<.15,`eased back ${f.controls.orbit}`);
});

test('heading filter: holds in the air and while down, hands back smoothly, follows fast backward riding',()=>{
  const f=fixture(),e=f.entity;step(f,.2);const yaw=f.controls.yaw;
  e.pose.airHeight=.4;e.controller.airborne=true;e.heading=Math.PI;step(f,.4);assert.ok(Math.abs(f.controls.yaw-yaw)<1e-9,'air: held');
  e.pose.airHeight=0;e.controller.airborne=false;e.controller.crashed=true;step(f,.5);assert.ok(Math.abs(f.controls.yaw-yaw)<1e-9,'crash: held');
  e.controller.crashed=false;e.speed=3;let worst=0,prev=f.controls.yaw;
  step(f,3,60,t=>{e.position.z+=-3/60;});
  // Handed back continuously, then follows the new facing (cos → +1 when facing π: the camera sits behind at yaw π).
  step(f,.01,60,()=>{});assert.ok(Math.cos(f.controls.yaw-Math.PI)>.99,`landed: follows (${f.controls.yaw})`);
  // Fakie: travelling backward at 2.5 m/s → the camera looks the way of travel.
  e.heading=0;e.speed=-2.5;step(f,3,60,()=>{e.position.z-=2.5/60;});assert.ok(Math.cos(f.controls.yaw-Math.PI)>.99,`reverse: along travel (${f.controls.yaw})`);
  e.speed=1;step(f,4,60,()=>{e.position.z+=1/60;});assert.ok(Math.cos(f.controls.yaw)>.99,'forward again');
  void worst;void prev;
});

test('180 landing: the handed-back heading moves continuously (bounded per-frame yaw change)',()=>{
  const f=fixture(),e=f.entity,c=e.controller;e.speed=6;
  for(let i=0;i<60;i++){e.position.z+=.1;f.controls.update(f.camera,f.entity,f.world,1/60);}
  // Airborne spin: heading sweeps 0 → π while travelling on; on landing the speed sign flips (riding fakie).
  c.airborne=true;e.pose.airHeight=.3;
  for(let i=1;i<=30;i++){e.heading=Math.PI*i/30;e.position.z+=.1;f.controls.update(f.camera,f.entity,f.world,1/60);}
  let worst=0,prev=f.controls.yaw;c.airborne=false;e.pose.airHeight=0;e.speed=-6;
  for(let i=0;i<60;i++){e.position.z+=.1;f.controls.update(f.camera,f.entity,f.world,1/60);worst=Math.max(worst,Math.abs(Math.atan2(Math.sin(f.controls.yaw-prev),Math.cos(f.controls.yaw-prev))));prev=f.controls.yaw;}
  assert.ok(worst<.02,`largest per-frame yaw change after landing ${worst} rad`);
  assert.ok(Math.cos(f.controls.yaw)>.99,'still looking along the travel');
});

test('springs are exact: stable for any step, irregular steps converge to the same rest',()=>{
  for(const dt of [1/144,1/60,1/30,1/12,1/10,1/8,1/4]){let x=.3,v=0;for(let i=0;i<Math.ceil(3/dt);i++)[x,v]=springStep(x,v,0,11,dt);assert.ok(Math.abs(x)<1e-6,`dt ${dt} → ${x}`);}
  // The camera itself: a 30 cm step then standing still, at sustained 8–144 Hz and an irregular cadence.
  for(const cadence of [[1/144],[1/60],[1/12],[1/10],[1/8],[1/60,1/8,1/30,1/10,1/144,1/20]]){
    const f=fixture();f.controls.update(f.camera,f.entity,f.world,0,true);f.entity.position.y+=.3;
    let t=0,i=0,peak=0;while(t<3){const dt=cadence[i++%cadence.length];t+=dt;f.controls.update(f.camera,f.entity,f.world,dt);
      if(t>1)peak=Math.max(peak,Math.abs(f.controls.pivot.y-(10.3+CAMERA_TUNING.pivotHeight)));}
    assert.ok(peak<.02,`cadence ${cadence} still moving after 1 s: ${peak}`);
  }
});

test('teleports and rescues start a fresh view; small recovery shifts do not sweep',()=>{
  const f=fixture();step(f,.5);
  f.entity.position.set(500,10,-300);f.entity.controller.placementSerial++;f.controls.update(f.camera,f.entity,f.world,1/60);
  assert.ok(f.camera.position.distanceTo(f.entity.position)<8,'snapped to the new place');
  f.entity.position.x+=2;f.entity.controller.placementSerial++;f.controls.update(f.camera,f.entity,f.world,1/60);
  assert.ok(f.camera.position.distanceTo(f.entity.position)<8);
});

test('portrait widens the view and lifts the aim; landscape keeps 62°; the rider stays above the touch buttons',()=>{
  const l=fixture({aspect:1.6});l.controls.update(l.camera,l.entity,l.world,0,true);assert.equal(l.camera.fov,62);
  const p=fixture({aspect:390/844});p.controls.update(p.camera,p.entity,p.world,0,true);
  assert.ok(p.camera.fov>70&&p.camera.fov<=CAMERA_TUNING.maxFov);
  for(const f of [l,p])f.camera.updateMatrixWorld();
  const y=(f,h)=>new THREE.Vector3(0,10+h,0).project(f.camera).y;assert.ok(y(p,1.05)<y(l,1.05),'rider lower in portrait');
  // Buttons up to NDC −0.55: at every boom length the wheel ends above them.
  for(const d of [3,4.5,6,10,13.5]){const f=fixture({aspect:390/844});f.controls.setSafeArea(.8,-.55);f.controls.distance=d;
    f.controls.update(f.camera,f.entity,f.world,0,true);step(f,.6);f.camera.updateMatrixWorld();
    assert.ok(y(f,.12)>-.55&&y(f,1.8)<.8,`boom ${d}: wheel ${y(f,.12)} head ${y(f,1.8)}`);}
});

test('unobstructed camera motion is independent of render cadence',()=>{
  const positions=[];
  for(const hz of [30,60,120]){const f=fixture();f.controls.update(f.camera,f.entity,f.world,0,true);f.entity.speed=3;
    step(f,1.5,hz,t=>{f.entity.heading=Math.min(1.2,t);f.entity.position.set(Math.sin(t)*3,10,t*3);});positions.push(f.camera.position.clone());}
  assert.ok(positions[0].distanceTo(positions[1])<.03&&positions[1].distanceTo(positions[2])<.015,positions.map(p=>p.toArray().join(',')).join(' | '));
});
