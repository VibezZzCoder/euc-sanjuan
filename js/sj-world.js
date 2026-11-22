/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// El Viejo San Juan blockout — © 2026 VibezZzCoder, MIT. OSM ODbL / USGS public-domain inputs.
import * as THREE from 'three/webgpu';
import { SfTerrainSampler } from './sf-terrain-sampler.js';
import { createPlazaLayout,plazaBuilding,plazaGroundBase } from './sj-plaza-layout.js';
import { buildPlaza,plazaWallColour } from './sj-plaza.js';
import { beginGlow,buildGlow } from './sj-glow.js';
import { createCorridorLayout } from './sj-corridor-layout.js';
import { createGateLayout, GATE_BOUNDS } from './sj-gate-layout.js';
import { createFortLayout } from './sj-fort-layout.js';
import { createPrincesaLayout } from './sj-princesa-layout.js';
import { createCristobalLayout } from './sj-cristobal-layout.js';
import { createNorzagarayLayout } from './sj-norzagaray-layout.js';
import { createPerlaWestLayout } from './sj-perla-west-layout.js';
import { createPerlaDistrictLayout } from './sj-perla-district-layout.js';
import { createPuntillaLayout } from './sj-puntilla-layout.js';
import { createStreetsLayout } from './sj-streets-layout.js';
import { createForttopsLayout } from './sj-forttops-layout.js';
import { createLandmarksLayout } from './sj-landmarks-layout.js';
import { createBahiaLayout } from './sj-bahia-layout.js';
import { createUptownLayout } from './sj-uptown-layout.js';
import { createEastcivicLayout } from './sj-eastcivic-layout.js';
import { createWaterfrontLayout } from './sj-waterfront-layout.js';
import { createSkateparkLayout } from './sj-skatepark-layout.js';
import { createCoastLayout } from './sj-coast-layout.js';
import { createWallFootLayout } from './sj-wall-foot.js';
import { createGroundLayout } from './sj-ground-layout.js';
import { groundPalette,groundMaterial } from './sj-ground.js';
import { createFabricLayout } from './sj-fabric-layout.js';
import { createWorldEdgeLayout } from './sj-worldedge-layout.js';
import { clipChunkTriangles, cutTouches } from './sj-terrain-cut.js';
import { shareSupportExtras } from './sj-handoff.js';
import { drawnGroundProbe, seatKitLamps, seatRecords } from './sj-street-kit.js';
import { SoftFoliageField, softBoxOf } from './sj-soft-foliage.js';
import { createParkingLayout, parkingEnabled } from './sj-parking-layout.js';

// area modules, in priority order (earlier tints win). Each key is a world field; nulling one must reproduce the
// output without it exactly. Builders are registered in sj-plaza.js under the same key.
export const AREA_LAYOUTS={princesa:createPrincesaLayout,cristobal:createCristobalLayout,norzagaray:createNorzagarayLayout,perlaWest:createPerlaWestLayout,
  perlaDistrict:createPerlaDistrictLayout,puntilla:createPuntillaLayout,waterfront:createWaterfrontLayout,skatepark:createSkateparkLayout,bahia:createBahiaLayout,uptown:createUptownLayout,landmarks:createLandmarksLayout,eastcivic:createEastcivicLayout,forttops:createForttopsLayout,worldedge:createWorldEdgeLayout,coast:createCoastLayout,ground:createGroundLayout,streets:createStreetsLayout,fabric:createFabricLayout,wallFoot:createWallFootLayout};
export const areasOf=world=>Object.keys(AREA_LAYOUTS).map(k=>world[k]).filter(Boolean);

export async function loadCity() {
  const get = async (name, json = false) => {
    const response = await fetch(new URL('../data/' + name, import.meta.url));
    if (!response.ok) throw new Error(`City data failed: ${name} (${response.status})`);
    return json ? response.json() : response.arrayBuffer();
  };
  const city = await get('city.json', true);
  const detail = await get('plaza-detail.json', true);
  const quantized = new Int16Array(await get('terrain.i16'));
  const land = new Uint8Array(await get('land.u8'));
  const surface = new Uint8Array(await get('surface.u8'));
  const t = city.terrain, count = t.nx * t.nz;
  if (quantized.length !== count || land.length !== count || surface.length !== count) throw new Error('City grid size mismatch');
  const heights = new Float32Array(count); for (let i = 0; i < count; i++) heights[i] = quantized[i] * t.scale;
  const terrain = { ...t, heights, rect: true, waterLevel: 0 };
  const cell = (x, z) => {
    const i = Math.floor((x-t.x0)/t.step), j = Math.floor((z-t.z0)/t.step);
    return i>=0 && j>=0 && i<t.nx-1 && j<t.nz-1 ? j*t.nx+i : -1;
  };
  const isDry = (x,z) => {
    const k = cell(x,z);
    return !!(k>=0 && land[k] && land[k+1] && land[k+t.nx] && land[k+t.nx+1]);
  };
  const height = (x,z) => {
    const k=cell(x,z); if(k<0) return -4;
    const u=(x-t.x0)/t.step-Math.floor((x-t.x0)/t.step), v=(z-t.z0)/t.step-Math.floor((z-t.z0)/t.step);
    return u+v<=1 ? heights[k]+(heights[k+1]-heights[k])*u+(heights[k+t.nx]-heights[k])*v
      : heights[k+t.nx+1]-(heights[k+t.nx+1]-heights[k+t.nx])*(1-u)-(heights[k+t.nx+1]-heights[k+1])*(1-v);
  };
  city.buildings=city.buildings.map(b=>plazaBuilding(b,height));
  const colliders=city.buildings.map(b=>({outer:b.outer.map(([x,z])=>({x,z})),
    holes:b.holes.map(r=>r.map(([x,z])=>({x,z}))),minY:b.base,maxY:b.roof,surface:'pavement',support:false}));
  // A visible barrier at clipped eastern road exits, shared by drawing and collision.
  const barriers=[];
  const east=t.x0+(t.nx-1)*t.step;
  for(const r of city.roads) for(const p of [r.points[0],r.points.at(-1)]) {
    if(p[0]<east-8 || !isDry(p[0]-3,p[1]) || barriers.some(b=>Math.hypot(b.x-p[0],b.z-p[1])<10)) continue;
    const b={x:p[0]-4,z:p[1],y:height(p[0]-4,p[1]),width:r.width+2}; barriers.push(b);
    colliders.push(b.collider={centre:{x:b.x,y:b.y+0.55,z:b.z},halfExtents:{x:0.35,y:0.55,z:b.width/2},rotationY:0,surface:'pavement'});
  }
  const gate=createGateLayout({height,terrain});
  const fort=createFortLayout({height,terrain,surface,paseo:gate.path});
  const corridor=createCorridorLayout({city,height,terrain,gate});
  // area modules (generic contract: see the header of sj-princesa-layout.js).
  const areaLayouts={};for(const [key,create] of Object.entries(AREA_LAYOUTS))areaLayouts[key]=create({city,detail,height,terrain,surface,land,gate,fort,corridor,isDry,areas:{...areaLayouts}});
  const areas=Object.values(areaLayouts);
  for(const a of areas)if(a.load)await a.load({terrain});  // optional async data hooks (area `ground`: its bake)
  // An area that draws its own closure at the east cut (worldedge) replaces the blockout barriers and their colliders.
  if(areas.some(a=>a.closesEastExits)){for(const b of barriers)colliders.splice(colliders.indexOf(b.collider),1);barriers.length=0;}
  // Area corrections for mapped buildings ({id → {roof?, base?, outer?, colour?, roofColour?}}): the collider here and the
  // drawn mass in buildWorld share them (base: a foundation reaching the terrain under the whole footprint; outer: a locally
  // trimmed footprint).
  {const index=new Map();city.buildings.forEach((b,i)=>{if(!index.has(b.id))index.set(b.id,i);});
    for(const a of areas)for(const [id,o] of a.buildingOverrides??[]){const i=index.get(id);if(i===undefined)continue;
      if(o.roof!==undefined)colliders[i].maxY=o.roof;if(o.base!==undefined)colliders[i].minY=o.base;
      if(o.outer)colliders[i].outer=o.outer.map(([x,z])=>({x,z}));}}
  const plaza=createPlazaLayout({city,detail,height,terrain});
  // street-kit lamp feet reach the drawn ground under the whole footprint (− 3 cm), sharing that
  // lower bound with their colliders (js/sj-street-kit.js). The probe is construction-only (not kept on the world).
  {const ground=drawnGroundProbe({height,isDry,tops:[...gate.tops,...fort.tops,...(corridor.tops??[]),...areas.flatMap(a=>a.tops??[])],
    prisms:[...plaza.colliders,...corridor.colliders,...gate.colliders,...fort.colliders,...areas.flatMap(a=>a.colliders??[])]});
    for(const a of areas){seatKitLamps(a.lamps,a.colliders,ground);
      // Optional `seatLists` [{records, radius, offset}] (records {x,y,z}; radius number or r => metres; the drawn base
      // bottom is r.y + offset, default 0): seated the same way; drawing extends only the foot to r.foot.
      for(const s of a.seatLists??[])seatRecords(s.records,a.colliders,ground,{radius:typeof s.radius==='function'?s.radius:()=>s.radius??.2,nominal:r=>r.y+(s.offset??0)});}
    for(const s of plaza.seatLists??[])seatRecords(s.records,plaza.colliders,ground,{radius:typeof s.radius==='function'?s.radius:()=>s.radius??.2,nominal:r=>r.y+(s.offset??0)});}
  // Parked cars (js/sj-parking-layout.js): static solids beside the kerbs, placed clear of every solid registered so far,
  // drawn by the vehicle kit (js/sj-vehicles.js). ?parked=0 leaves them out.
  const parking=parkingEnabled()?createParkingLayout({city,height,isDry,paved:areaLayouts.streets?.paved,
    solids:[...colliders,...plaza.colliders,...corridor.colliders,...gate.colliders,...fort.colliders,...areas.flatMap(a=>a.colliders??[])],
    tops:[...gate.tops,...fort.tops,...(corridor.tops??[]),...areas.flatMap(a=>a.tops??[])],offLimits:areas.map(a=>a.offLimitsAt).filter(Boolean),
    places:[...city.places,...corridor.places,...(gate.places??[]),...(fort.places??[]),...areas.flatMap(a=>a.places??[])],
    trees:[...city.trees,...(plaza.trees??[]),...areas.flatMap(a=>[...(a.trees??[]),...(a.claimedTrees??[]),...(a.palms??[]),...(a.broadleaf??[])])]}):null;
  // Soft foliage (`soft: true` prisms, js/sj-soft-foliage.js): occupied ground for every construction consumer, but never a
  // solid; the rider's controller drags through them (world.softBodies).
  const softBoxes=[];
  const solidOnly=list=>list.filter(c=>{if(!c.soft)return true;softBoxes.push(softBoxOf(c));return false;});
  plaza.paving.push(...corridor.paving);colliders.push(...solidOnly([...plaza.colliders,...corridor.colliders,...gate.colliders,...fort.colliders,...areas.flatMap(a=>a.colliders)]));
  if(parking)colliders.push(...parking.colliders);
  const softBodies=new SoftFoliageField(softBoxes);
  // Puerta de San Juan: bounded replacement floor + ceiling through the DEM rampart (SF tunnel-bore contract).
  // El Morro bridge deck: bounded replacement floor over the smeared DEM ridge (render cut inside the bridge body).
  // Areas may mark private ground (offLimitsAt(x,z,y): closed sites) for checked placement, recovery and arrivals.
  const privateAt=areas.map(a=>a.offLimitsAt).filter(Boolean);
  // Areas may re-class ground-mask cells for ride feel only (`groundClass` {cells, cls}: e.g. paved slabs over lawn-class
  // cells ride as pavement); the drawn terrain keeps `surface`. Without such an area the mask is `surface` itself.
  let groundMask=surface;for(const a of areas)if(a.groundClass?.cells?.length){if(groundMask===surface)groundMask=surface.slice();for(const k of a.groundClass.cells)groundMask[k]=a.groundClass.cls;}
  const sampler=new SfTerrainSampler({terrain,colliders,tops:[...gate.tops,...fort.tops,...(corridor.tops??[]),...areas.flatMap(a=>a.tops)],city:null,waterAt:(x,z)=>!isDry(x,z),
    offLimitsAt:privateAt.length?(x,z,y)=>!isDry(x,z)||privateAt.some(f=>f(x,z,y)):(x,z)=>!isDry(x,z),
    data:{groundMask:{header:{originX:t.x0,originZ:t.z0,w:t.nx,h:t.nz,cell:t.step,
      classes:['sidewalk','asphalt','lawn','waterEdge']},mask:groundMask}}});
  shareSupportExtras(sampler.topStore); // one shared entry per distinct `source` label (js/sj-handoff.js)
  return {city,detail,plaza,corridor,gate,fort,...areaLayouts,terrain,land,surface,sampler,softBodies,parking,height,isDry,barriers};
}

// Shore skirt neighbours: [di,dj, edge start, edge end] in grid offsets (constant, hoisted out of the per-cell loop).
const SHORE_SIDES=[[-1,0,[0,0],[0,1]],[1,0,[1,0],[1,1]],[0,-1,[0,0],[1,0]],[0,1,[0,1],[1,1]]];
// Party walls (see buildWorld): per building, outer-ring edge index -> [lo,hi], the height band of that wall already drawn
// by the neighbour whose reversed edge it shares (endpoints match to 1 mm). On each shared edge the lower id keeps its full
// wall; the higher id draws only its parts below lo and above hi, so no band is drawn twice and none is left open.
export function interiorPartyWalls(buildings){
  const k=p=>Math.round(p[0]*1000)+','+Math.round(p[1]*1000),edges=new Map(),out=new Map();
  for(const b of buildings){if(!(b.roof-b.base>.1))continue;const r=b.outer;for(let i=0;i<r.length;i++)edges.set(k(r[i])+'>'+k(r[(i+1)%r.length]),b);}
  for(const b of buildings){if(!(b.roof-b.base>.1))continue;const r=b.outer;
    for(let i=0;i<r.length;i++){const n=edges.get(k(r[(i+1)%r.length])+'>'+k(r[i]));if(!n||n===b||n.id===b.id||b.id<n.id)continue;
      const lo=Math.max(b.base,n.base),hi=Math.min(b.roof,n.roof);if(hi-lo<=1e-3)continue;
      if(!out.has(b))out.set(b,new Map());out.get(b).set(i,[lo,hi]);}}
  return out;}
export async function buildWorld(scene, world, progress=()=>{}) {
  const {city,terrain:t,land,surface,height}=world;
  const owned=new Set(), materials=new Set();beginGlow();
  const material=options=>{const m=new THREE.MeshStandardMaterial(options); materials.add(m); return m;};
  // Area `ground` (sj-ground.js): natural-ground class colours and the detail terrain material; null keeps the base.
  const ground=await groundPalette(world);
  const groundMat=ground?(m=>(materials.add(m),m))(groundMaterial(owned)):material({vertexColors:true,roughness:0.95,metalness:0});
  // Closed, outward-wound masses use back-face shadow casting; lit facades must not shadow their own front plane.
  const buildingMat=material({vertexColors:true,roughness:0.86,metalness:0,side:THREE.DoubleSide,shadowSide:THREE.BackSide});
  // sidewalk, asphalt, lawn, water edge; then the Paseo del Morro rip-rap margin tone (Wikimedia Commons curid=114692556, curid=82863744, curid=116769039); then El Morro's
  // weathered grey terreplein stone and ochre-grey masonry on smeared wall cells (Wikimedia Commons curid=72603185, curid=122907842, curid=123485577, curid=148962402, curid=148962401).
  const colours=['#c8bfaa','#687d91','#7e9866','#346d80','#676960','#9a958a','#8f8068'].map(c=>new THREE.Color(c)),tint=world.gate?.tint,fortTint=world.fort?.tint;
  // area tints: a named tone or a literal '#rrggbb' (cached). Earlier owners keep priority.
  const areaTints=areasOf(world).map(a=>a.tint).filter(m=>m?.size),hexColours=new Map(),TONES={rock:4,lawn:2,paseo:0,stone:5,masonry:6};
  const toneColour=tone=>{if(tone in TONES)return colours[TONES[tone]];if(!hexColours.has(tone))hexColours.set(tone,new THREE.Color(tone));return hexColours.get(tone);};
  // The tint chain below resolved once per tinted grid vertex (same lookups, same priority) instead of per vertex visit.
  const toneSlot=new Uint16Array(t.nx*t.nz),toneList=[undefined];
  // Optional `tintOver` (forttops, 2026-11-18): an area's tone that wins over the gate/fort tints at its vertices.
  const overTints=areasOf(world).map(a=>a.tintOver).filter(m=>m?.size);
  {const slot=new Map();for(const m of [...overTints,tint,fortTint,...areaTints])if(m)for(const k of m.keys()){if(!Number.isInteger(k)||k<0||k>=toneSlot.length||toneSlot[k])continue;
    let tone;for(let a=0;tone===undefined&&a<overTints.length;a++)tone=overTints[a].get(k);tone??=tint?.get(k)??fortTint?.get(k);for(let a=0;tone===undefined&&a<areaTints.length;a++)tone=areaTints[a].get(k);
    let n=slot.get(tone);if(n===undefined){slot.set(tone,n=toneList.length);toneList.push(tone);}toneSlot[k]=n;}}
  const h=t.heights, chunk=64, shoreColour=new THREE.Color('#66665c');
  // Terrain vertex colour at grid vertex (gi,gj): shared by the terrain chunks and the authored ground triangles below.
  const vertexColour=(gi,gj,base=false)=>{const k=gj*t.nx+gi,vx=t.x0+gi*t.step,vz=t.z0+gj*t.step;
    // Steep DEM banks around the gate (Wikimedia Commons curid=123113261's grassy slope by the Rogativa corner) read as grass, not paving.
    const bank=world.gate&&vx>=GATE_BOUNDS.minX&&vx<=GATE_BOUNDS.maxX&&vz>=GATE_BOUNDS.minZ&&vz<=GATE_BOUNDS.maxZ&&k>t.nx&&k<h.length-t.nx-1
      &&h[k]<12.3&&Math.hypot(h[k+1]-h[k-1],h[k+t.nx]-h[k-t.nx])/(2*t.step)>.7;
    const tone=toneList[toneSlot[k]];
    if(tone&&(base||!ground?.refines(tone,k)))return toneColour(tone);
    const g=base?null:ground?.colour(k,bank,tone,tone?toneColour(tone):undefined);if(g){groundBase=tone?toneColour(tone):colours[bank?2:surface[k]];return g;}
    return tone?toneColour(tone):colours[bank?2:plazaGroundBase(vx,vz,world)?0:surface[k]];};
  // Area `ground`: the base colour of the last vertex `ground` recoloured (cut-fragment keys, below).
  let groundBase=null;const baseCol=ground?new Float32Array((chunk+1)*(chunk+1)*3):null;
  // Authored ground (area `groundTriangles`, e.g. wall-foot strips): drawn in the chunk holding each triangle's centroid,
  // coloured by interpolating the terrain vertex colours on the same triangle split, so the tint matches its neighbours.
  const groundBuckets=new Map();
  for(const tri of areasOf(world).flatMap(a=>a.groundTriangles??[])){
    const ci=Math.floor(((tri[0][0]+tri[1][0]+tri[2][0])/3-t.x0)/t.step),cj=Math.floor(((tri[0][2]+tri[1][2]+tri[2][2])/3-t.z0)/t.step);
    const key=Math.floor(cj/chunk)*100000+Math.floor(ci/chunk);let list=groundBuckets.get(key);if(!list)groundBuckets.set(key,list=[]);list.push(tri);}
  const colourAt=(x,z)=>{const fx=(x-t.x0)/t.step,fz=(z-t.z0)/t.step,i=Math.max(0,Math.min(t.nx-2,Math.floor(fx))),j=Math.max(0,Math.min(t.nz-2,Math.floor(fz)));
    const u=fx-i,v=fz-j,c=new THREE.Color();
    if(u+v<=1){const a=vertexColour(i,j),b=vertexColour(i+1,j),d=vertexColour(i,j+1);c.r=a.r+(b.r-a.r)*u+(d.r-a.r)*v;c.g=a.g+(b.g-a.g)*u+(d.g-a.g)*v;c.b=a.b+(b.b-a.b)*u+(d.b-a.b)*v;}
    else{const e=vertexColour(i+1,j+1),b=vertexColour(i+1,j),d=vertexColour(i,j+1);c.r=e.r-(e.r-d.r)*(1-u)-(e.r-b.r)*(1-v);c.g=e.g-(e.g-d.g)*(1-u)-(e.g-b.g)*(1-v);c.b=e.b-(e.b-d.b)*(1-u)-(e.b-b.b)*(1-v);}
    return c;};
  // Every cut and shore-skip set, gathered once in owner order (each chunk filters the same list).
  const allCuts=[...(world.gate?.cuts??[]),...(world.fort?.cuts??[]),...(world.corridor?.cuts??[]),...areasOf(world).flatMap(a=>a.cuts??[])],shoreSkip=areasOf(world).map(a=>a.shoreSkip).filter(Boolean);
  // Areas may split listed grid cells along the other diagonal (`flipCells`, cell index j*nx+i; coast: natural banks), with
  // replacement tops on the same triangles; none listed → the fixed split as before.
  const flipCells=areasOf(world).map(a=>a.flipCells).filter(f=>f?.size);
  for(let z=0;z<t.nz-1;z+=chunk) {
    for(let x=0;x<t.nx-1;x+=chunk) {
      const w=Math.min(chunk,t.nx-1-x)+1,d=Math.min(chunk,t.nz-1-z)+1;
      const idx=[];
      for(let j=0;j<d-1;j++) for(let i=0;i<w-1;i++) {
        const k=(z+j)*t.nx+x+i,a=j*w+i;
        if(land[k]&&land[k+1]&&land[k+t.nx]&&land[k+t.nx+1]) {if(flipCells.length&&flipCells.some(f=>f.has(k)))idx.push(a,a+w,a+w+1,a,a+w+1,a+1);else idx.push(a,a+w,a+1,a+1,a+w,a+w+1);}
      }
      if(!idx.length) continue;
      let pos=new Float32Array(w*d*3), col=new Float32Array(w*d*3);
      for(let j=0;j<d;j++) for(let i=0;i<w;i++) {
        const k=(z+j)*t.nx+x+i,p=(j*w+i)*3;
        groundBase=null;const c=vertexColour(x+i,z+j);
        if(baseCol){const b=groundBase??c;baseCol[p]=b.r;baseCol[p+1]=b.g;baseCol[p+2]=b.b;}
        pos[p]=t.x0+(x+i)*t.step;pos[p+1]=h[k];pos[p+2]=t.z0+(z+j)*t.step;
        col[p]=c.r;col[p+1]=c.g;col[p+2]=c.b;
      }
      // Shore closure: the land mesh ends at the mask with no side, so raised banks read as thin
      // sheets above the water. Each emitted cell edge facing a non-emitted cell, standing above the water, gets a dark rock
      // skirt from its exact edge vertices to 1.2 m below the lower of the edge and the water line. Render only.
      {const emitted=(i,j)=>i>=0&&j>=0&&i<t.nx-1&&j<t.nz-1&&land[j*t.nx+i]&&land[j*t.nx+i+1]&&land[(j+1)*t.nx+i]&&land[(j+1)*t.nx+i+1];
        // Skirt vertices are shared along the shore (top = the grid vertex, bottom 1.2 m under min(height, water)).
        const sp=[],six=[],ids=new Map();let next=w*d;
        const vid=(gx,gz,low)=>{const key=(gz*t.nx+gx)*2+low;let id=ids.get(key);if(id===undefined){const y=h[gz*t.nx+gx];
          sp.push(t.x0+gx*t.step,low?Math.min(y,0)-1.2:y,t.z0+gz*t.step);id=next++;ids.set(key,id);}return id;};
        for(let j=0;j<d-1;j++)for(let i=0;i<w-1;i++){const gi=x+i,gj=z+j;if(!emitted(gi,gj))continue;
          for(const [di,dj,a0,a1] of SHORE_SIDES){
            if(emitted(gi+di,gj+dj))continue;
            // Areas that finish a shore themselves (coast) list the grid edges whose skirt they replace.
            if(shoreSkip.length&&shoreSkip.some(k=>k.has(`${gi},${gj},${di},${dj}`)))continue;
            const A=[gi+a0[0],gj+a0[1]],B=[gi+a1[0],gj+a1[1]];if(Math.max(h[A[1]*t.nx+A[0]],h[B[1]*t.nx+B[0]])<.05)continue;
            const at=vid(...A,0),bt=vid(...B,0),bb=vid(...B,1),ab=vid(...A,1);
            // Face outward (toward the missing cell): (B−A)×(down) points along ±(di,dj).
            const ex=B[0]-A[0],ez=B[1]-A[1],flip=(-ez*di+ex*dj)>0;
            six.push(...(flip?[at,bb,bt,at,ab,bb]:[at,bt,bb,at,bb,ab]));}}
        if(sp.length){const p2=new Float32Array(pos.length+sp.length),c2=new Float32Array(col.length+sp.length),rock=shoreColour;
          p2.set(pos);p2.set(sp,pos.length);c2.set(col);for(let k=col.length;k<c2.length;k+=3){c2[k]=rock.r;c2[k+1]=rock.g;c2[k+2]=rock.b;}
          pos=p2;col=c2;idx.push(...six);}}
      // Gate passage: render-only bounded subtraction; outside fragments keep the exact shared heightfield.
      const cuts=allCuts.filter(c=>cutTouches(c,t.x0+x*t.step,t.x0+(x+w-1)*t.step,t.z0+z*t.step,t.z0+(z+d-1)*t.step));
      // Area `ground`: fragments are shared/split by the base colouring, so positions and indices never depend on it.
      const keyCol=cuts.length&&ground?Float32Array.from(col):null;
      if(keyCol)keyCol.set(baseCol.subarray(0,w*d*3));
      if(cuts.length){const r=clipChunkTriangles(idx,pos,col,cuts,cuts.some(c=>c.tight),keyCol);
        const p2=new Float32Array(pos.length+r.extraPositions.length);p2.set(pos);p2.set(r.extraPositions,pos.length);pos=p2;
        const c2=new Float32Array(col.length+r.extraColours.length);c2.set(col);c2.set(r.extraColours,col.length);col=c2;
        idx.length=0;idx.push(...r.index);}
      {const list=groundBuckets.get(Math.floor(z/chunk)*100000+Math.floor(x/chunk));
        if(list){const ap=[],ac=[],ids=new Map();let next=pos.length/3;
          // Vertices shared within the authored ground (smooth normals across it), never with the clipped terrain.
          const vid=p=>{const key=p[0]+','+p[1]+','+p[2];let id=ids.get(key);if(id===undefined){const c=colourAt(p[0],p[2]);ap.push(p[0],p[1],p[2]);ac.push(c.r,c.g,c.b);ids.set(key,id=next++);}return id;};
          for(const tri of list)idx.push(vid(tri[0]),vid(tri[1]),vid(tri[2]));
          const p2=new Float32Array(pos.length+ap.length);p2.set(pos);p2.set(ap,pos.length);pos=p2;
          const c2=new Float32Array(col.length+ac.length);c2.set(col);c2.set(ac,col.length);col=c2;}}
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();owned.add(g);
      const mesh=new THREE.Mesh(g,groundMat);mesh.receiveShadow=true;scene.add(mesh);
    }
    progress(z/(t.nz-1)); await new Promise(resolve=>setTimeout(resolve,0));
  }
  // Shared per-chunk facade/roof buffers, with true footprint holes and flat roofs.
  const chunks=new Map(), palette=['#eed0a3','#bdc9b7','#e6b9a3','#c7c8da','#e9dba8','#c8d7d8'];
  const addTri=(batch,a,b,c,colour)=>{for(const p of [a,b,c]){batch.p.push(...p);batch.c.push(colour.r,colour.g,colour.b);}};
  const areaBuildings=new Map(areasOf(world).flatMap(a=>[...(a.buildingOverrides??[])]));
  // Optional draw-only area field `buildingColours` (Map id → {colour, roofColour}): the city fabric's plaster/roof tones.
  const areaColours=new Map(areasOf(world).flatMap(a=>[...(a.buildingColours??[])]));
  // OSM party walls are two coincident, oppositely wound wall quads
  // in this double-sided material, so from inside either mass both draw. An outer edge whose reversed twin belongs to
  // another drawn mass covering its whole height is interior: drop it (exact tie: the higher id drops). Silhouettes,
  // roofs, holes and colliders are unchanged.
  const finals=city.buildings.map(source=>areaBuildings.has(source.id)?{...source,...areaBuildings.get(source.id)}:source);
  const partyWalls=interiorPartyWalls(finals);
  for(const b of finals) {
    const key=`${Math.floor(b.outer[0][0]/128)},${Math.floor(b.outer[0][1]/128)}`;
    let batch=chunks.get(key);if(!batch) chunks.set(key,batch={p:[],c:[]});
    const colour=new THREE.Color(b.colour??plazaWallColour(b)??areaColours.get(b.id)?.colour??palette[b.id%palette.length]),roofColour=new THREE.Color(b.roofColour??areaColours.get(b.id)?.roofColour??'#c9bfb0');
    const rings=[b.outer,...b.holes];
    for(const r of rings) {const area=r.reduce((sum,p,j)=>{const q=r[(j+1)%r.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
      const reverse=(r===b.outer?area<0:area>0);
      const skip=r===b.outer?partyWalls.get(b):undefined;
      for(let i=0;i<r.length;i++) {
      const a=r[i],c=r[(i+1)%r.length],band=skip?.get(i);
      for(const [y0,y1] of band?[[b.base,band[0]],[band[1],b.roof]]:[[b.base,b.roof]]){if(y1-y0<=1e-3)continue;
      const a0=[a[0],y0,a[1]],a1=[a[0],y1,a[1]],c0=[c[0],y0,c[1]],c1=[c[0],y1,c[1]];
      if(reverse){addTri(batch,a0,c0,a1,colour);addTri(batch,a1,c0,c1,colour);}
      else {addTri(batch,a0,a1,c0,colour);addTri(batch,a1,c1,c0,colour);}}
    }}
    const flat=rings.flat(), tri=THREE.ShapeUtils.triangulateShape(b.outer.map(p=>new THREE.Vector2(...p)),b.holes.map(r=>r.map(p=>new THREE.Vector2(...p))));
    for(const face of tri) {
      const [a,c,d]=face.map(i=>[flat[i][0],b.roof,flat[i][1]]);
      if((c[0]-a[0])*(d[2]-a[2])-(c[2]-a[2])*(d[0]-a[0])>0)addTri(batch,a,d,c,roofColour);
      else addTri(batch,a,c,d,roofColour);
    }
  }
  for(const batch of chunks.values()) {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(batch.p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(batch.c,3));g.computeVertexNormals();g.computeBoundingSphere();owned.add(g);
    const mesh=new THREE.Mesh(g,buildingMat);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
  chunks.clear();
  // An area that draws the sea itself (coast: `sea:true`) replaces the flat plane.
  if(!areasOf(world).some(a=>a.sea)){const waterG=new THREE.PlaneGeometry(12000,12000);waterG.rotateX(-Math.PI/2);owned.add(waterG);
  scene.add(new THREE.Mesh(waterG,material({color:'#287e91',roughness:0.4,metalness:0})));}
  const box=new THREE.BoxGeometry(1,1,1);owned.add(box);
  const yellow=material({color:'#ddbb49',roughness:0.9});
  for(const b of world.barriers) {const m=new THREE.Mesh(box,yellow);m.position.set(b.x,b.y+0.55,b.z);m.scale.set(.7,1.1,b.width);scene.add(m);}
  // Small instanced trees for geographic cues; blockout dressing has no new collision claims.
  // areas may draw mapped trees themselves (optional `trees` [{x,z}] in the area contract).
  const areaTrees=areasOf(world).flatMap(a=>[...(a.trees??[]),...(a.claimedTrees??[])]);
  const genericTrees=city.trees.filter(([x,z])=>!world.plaza.trees.some(t=>t.x===x&&t.z===z)&&!areaTrees.some(t=>t.x===x&&t.z===z));
  const trunks=new THREE.InstancedMesh(box,material({color:'#7a6a50',roughness:1}),genericTrees.length);
  const leafG=new THREE.IcosahedronGeometry(1,0);owned.add(leafG);
  const leaves=new THREE.InstancedMesh(leafG,material({color:'#547c55',roughness:1}),genericTrees.length);
  const dummy=new THREE.Object3D();
  // Trunks reach 0.4 m below the centre height so a level box foot never shows daylight on a slope (157 mm).
  genericTrees.forEach(([x,z],i)=>{const y=height(x,z);dummy.position.set(x,y+1.8,z);dummy.scale.set(.35,4.4,.35);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    dummy.position.y=y+4.4;dummy.scale.set(2.2,2.6,2.2);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);});
  trunks.castShadow=leaves.castShadow=true;scene.add(trunks,leaves);
  const plazaDetail=buildPlaza(scene,world);
  // Artificial light at blue hour from the fixtures the builders reported (js/sj-glow.js).
  const glow=buildGlow(scene,world,{buildings:finals});   // light is stopped by the final drawn outlines (open porticos stay open)
  // Traffic and people are built by js/sj-life.js, not here.
  return {update(){},details:plazaDetail.stats,glow,dispose(){glow.dispose();plazaDetail.dispose();for(const g of owned)g.dispose();for(const m of materials)m.dispose();trunks.dispose();leaves.dispose();}};
}
