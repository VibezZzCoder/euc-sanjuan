/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Offline connected-route and native-controller survey. No renderer, no player-position overrides after spawn.
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
globalThis.fetch=async url=>{const b=fs.readFileSync(url);return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const {loadCity}=await import('../js/sj-world.js');
const {EucController,createPose}=await import('../js/euc/simulation/EucController.js');
const {NEUTRAL_ACTIONS}=await import('../js/euc/input/actions.js');
const world=await loadCity(),graph=new Map();
const key=p=>p.map(n=>n.toFixed(2)).join(',');
const node=p=>{const id=key(p);if(!graph.has(id))graph.set(id,{id,p,edges:[]});return graph.get(id);};
for(const r of world.city.roads){
  if(['steps','service','cycleway'].includes(r.kind))continue;
  for(let i=1;i<r.points.length;i++){
    const a=node(r.points[i-1]),b=node(r.points[i]),length=Math.hypot(b.p[0]-a.p[0],b.p[1]-a.p[1]);
    if(length<.01)continue;
    a.edges.push({id:b.id,length,name:r.name});b.edges.push({id:a.id,length,name:r.name});
  }
}
function near(p){return [...graph.values()].sort((a,b)=>Math.hypot(a.p[0]-p.x,a.p[1]-p.z)-Math.hypot(b.p[0]-p.x,b.p[1]-p.z))[0];}
function route(from,to){
  const a=near(from),b=near(to),distance=new Map([[a.id,0]]),previous=new Map(),queue=[a.id];
  while(queue.length){queue.sort((x,y)=>distance.get(y)-distance.get(x));const at=queue.pop();if(at===b.id)break;
    for(const edge of graph.get(at).edges){const next=distance.get(at)+edge.length;if(next<(distance.get(edge.id)??Infinity)){
      distance.set(edge.id,next);previous.set(edge.id,at);if(!queue.includes(edge.id))queue.push(edge.id);}}
  }
  if(!distance.has(b.id))return null;
  const ids=[b.id];while(ids.at(-1)!==a.id)ids.push(previous.get(ids.at(-1)));ids.reverse();
  return {points:ids.map(id=>graph.get(id).p),length:distance.get(b.id)};
}
function ride(path){
  const points=path.points;let initial=null,index=1;
  // Start on the first connected segment, not at an arbitrary building/landmark centroid.
  for(let i=1;i<Math.min(points.length,6);i++){
    const a=points[i-1],b=points[i],heading=Math.atan2(b[0]-a[0],b[1]-a[1]);
    initial=world.sampler.findPlacementTarget({x:a[0],z:a[1],headingY:heading,referenceY:world.height(...a)});
    if(initial){index=i;break;}
  }
  if(!initial)return {pass:false,reason:'start-clearance'};
  const controller=new EucController(world.sampler,{spawn:{position:{x:initial.x,y:initial.y,z:initial.z},headingY:initial.headingY}}),pose=createPose();
  let travelled=0,px=initial.x,pz=initial.z;
  const maxSteps=Math.min(240000,Math.ceil((path.length/2+30)*120));
  for(let step=0;step<maxSteps;step++){
    controller.writePose(pose);
    while(index<points.length&&Math.hypot(points[index][0]-pose.x,points[index][1]-pose.z)<1.4)index++;
    if(index===points.length)return {pass:true,distance:travelled,seconds:step/120};
    const p=points[index],angle=Math.atan2(p[0]-pose.x,p[1]-pose.z),error=Math.atan2(Math.sin(angle-pose.headingY),Math.cos(angle-pose.headingY));
    const target=Math.abs(error)>.4?1.8:4.5;
    const throttle=Math.max(-.8,Math.min(.65,(target-pose.speed)*.22));
    controller.step(1/120,{...NEUTRAL_ACTIONS,throttle,steer:Math.max(-1,Math.min(1,-error*1.8))});
    travelled+=Math.hypot(pose.x-px,pose.z-pz);px=pose.x;pz=pose.z;
    if(controller.crashed)return {pass:false,reason:'native-crash',index,points:points.length,x:pose.x,y:pose.y,z:pose.z,distance:travelled};
  }
  return {pass:false,reason:'steering-timeout',index,points:points.length,x:pose.x,z:pose.z,distance:travelled};
}
const names=['Plaza de Armas','El Morro — esplanade','San Cristóbal — exterior','Plaza Colón','Plaza de Armas','Paseo de la Princesa'];
const results=[],circuit=[];
for(let i=1;i<names.length;i++){
  const from=world.city.places.find(p=>p.name===names[i-1]),to=world.city.places.find(p=>p.name===names[i]);
  const path=route(from,to);const result={from:names[i-1],to:names[i],connected:!!path,length:path?.length,...(path?ride(path):{pass:false,reason:'disconnected-source-graph'})};
  if(path&&i<5)circuit.push(...path.points.slice(circuit.length?1:0));
  results.push(result);console.log(JSON.stringify(result));
}
const loop={from:'Plaza de Armas',to:'Continuous central / esplanade / Norzagaray / Colón loop',
  ...ride({points:circuit,length:results.slice(0,4).reduce((n,r)=>n+r.length,0)})};
results.push(loop);console.log(JSON.stringify(loop));
const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify({graphNodes:graph.size,results},null,2)+'\n');
process.exitCode=results.some(r=>!r.pass)?1:0;
