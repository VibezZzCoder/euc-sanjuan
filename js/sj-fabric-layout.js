/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// City fabric: a finished Old San Juan exterior on every building no other module details — © 2026 VibezZzCoder, MIT.
// Footprints/heights: OSM / ODbL; ground: USGS DEM. area module (contract: header of sj-princesa-layout.js).
// This area adds NO physics: no colliders, tops, cuts, tints, surfaces or floors. It only places presentation parts on the
// existing building masses (which keep their colliders/footprints) and gives each dressed mass a wall/roof colour through
// the optional draw-only field `buildingColours` (Map id → {colour, roofColour}).
// References: Wikimedia Commons curid=131971241, curid=151530323, curid=151596781, curid=182287159, curid=158245806, curid=99177670, curid=131971302 (street rows: pastel/saturated plaster, white trim,
// tall paired panelled/louvred openings, iron balconies on slabs, cornice + parapet, darker base band), curid=99177715 (flat roofs,
// roof rooms, tanks), curid=127996363, curid=82861896, curid=14719072 (civic stone/cream masonry). Mapped: footprints, heights, streets, terrain. Inferred:
// storeys, bays, styles and colours (deterministic per building id), never address-by-address replicas.
// Ownership: buildings owned by earlier modules/areas (`ownedBuildings`, `buildingOverrides` keys, the cathedral and the
// plaza kiosks) are skipped entirely; on buildings the plaza/corridor kit details, only the edges that kit leaves blank are
// dressed (`plazaEdges` mirrors sj-plaza.js's facade plan).
// Output parts (Float32Array records, PART_STRIDE floats each): cell, x, y, z, angle, sx, sy, sz, r, g, b, shear.
//   shear: dy/du of the local +x axis (sloping base-band pieces follow the street grade; 0 elsewhere). Cells (afternoon
//   round): squares of FABRIC.cell m (offset FABRIC.cellOffset) by part position; each cell is one draw per kind, with a
//   near/mid/far geometry tier chosen per frame from the camera distance (sj-fabric.js).
//   frame: one opening = surround frame + its leaf (shutter pair, door or glazing) in a single instance; origin at the
//   bottom centre on the wall plane; local +x along the wall, +z outward; sx=width, sy=height; r,g,b = surround colour.
//   The leaf's colour and texture weight are in `leafTones` (Float32Array, 4 per frame record: r, g, b, texture 0-1;
//   0 = flat glazing).
//   rail: balcony railing, origin at the slab top centre on the wall plane; sx=width, sy=height, sz=depth.
//   box: centred boxes WITHOUT a back face (wall-mounted trim never shows it). Parts seen from all round (parapets and
//   copings standing above the roof, roof rooms, tanks, caps) are two back-to-back half boxes (pushBoth).
// Openings additionally carry a role code in `roles` (Uint8Array per frame record): 1 ground door, 2 ground window, 3 upper.
import {inDetail,inRing,segmentDistance} from './sj-plaza-layout.js';
import {CATHEDRAL_ID,inCorridor,corridorFacade} from './sj-corridor-layout.js';
import {paneKind} from './sj-glow-kinds.js';

export const PART_STRIDE=12;
export const FABRIC={corner:.6,bay:3.3,civicBay:4.3,storey:3.35,probe:[.8,2.4],reach:[1.5,4,7,10],roadSlack:1.2,
  band:.6,civicBand:1.05,slabDepth:.72,clearUnder:2.5,maxProtrude:.85,groundProtrude:.2,doorGrade:.21,seen:24,
  cell:128,cellOffset:[64,0]};
// Plaza kiosks / cathedral: drawn whole by sj-plaza.js and sj-cathedral.js.
const PLAZA_WHOLE=new Set([410592051,410620625,CATHEDRAL_ID]);
// Raw OSM tags (research/san-juan-data, read-only): building=church/cathedral/school/university/government/hospital/office/
// warehouse/industrial, amenity=place_of_worship/school/theatre/library/courthouse/parking/ferry_terminal/community_centre/
// kindergarten, office=government, historic=*, plus named institutions (Cuartel, Departamento, Edificio Lcdo., Ateneo,
// Casa Olímpica, Cámara de Comercio, La Fortaleza, Casa Blanca, Antiguo Teatro). Later landmark packages take these over
// through `ownedBuildings`; this restrained civic variant is the fallback.
export const CIVIC_IDS=new Set([59745023,196602956,196602958,247344184,251385682,252692640,256259084,256388549,256658272,256659484,
  256662599,257267971,257269274,259205062,259206919,260858526,268171786,268181332,268344833,269744558,270246171,270246078,
  292446817,382021489,382021492,3440230,3501975,3610153,3610377,929959,268181308,268181329,292446816,292446818,292448146,
  292448147,292550203,260860823,269739384,270107204,260820853,271366509,292550206,142324879,252692620,256258731,256259155,
  256401363,292446820,294775992,3885914]);
// Parking garages (amenity=parking, building=garage), ferry/cruise terminals, warehouses and industrial sheds: the plain
// modern variant; garages additionally get deck openings and beams instead of house bays.
export const GARAGE_IDS=new Set([142324879,247344186,252692620,256258731,256259155,256401363,271366513,271366524,292446820,294775992,
  829206456,3885914]);
export const MODERN_IDS=new Set([...GARAGE_IDS,259206919,382021489,382021492,271366509,292550206]);
// Small fort ruins: plain masonry, no openings.
export const RUIN_IDS=new Set([60252372,270181111,270181113]);

// Reference palettes (Wikimedia Commons curid=131971241, curid=151530323, curid=151596781, curid=182287159, curid=158245806, curid=99177670, curid=131971302; La Perla's brighter set stays with that district).
const TOWN=['#efc35e','#f3e19a','#86b8e0','#6fc0ba','#eeaab5','#f09f84','#d8805c','#b5d67c','#b2e0c8','#c4b2dc','#f4ead0',
  '#f5f2ea','#f6c597','#e98b78','#5c8dcc','#f0a04c','#9fd8de','#c8d987','#f2d36b','#d79bb5'];
const CIVIC=['#e6dcc6','#d8cdb5','#cfc8bb','#e9e3d6','#dac49c','#cdbca3','#e4d2b0'];
// Modern / commercial blocks of the port and the eastern district (-11-18): plain light stucco.
const MODERN=['#eceae4','#dcdcd6','#d9d2c3','#c9ced0','#e4ddcd','#d2d6cf','#bfc4c2'];
const ROOF=['#cbc4b6','#a9a398','#dedad2','#a5705c','#b98e72','#c9c2b0','#8f8a82','#b4b8b3','#c27f62'];
const SHUTTER=['#6b4630','#7e3f2a','#356848','#33797e','#ece9e1','#4670a0','#97653e','#4a5a46','#8a3631','#ece9e1'];
const RAIL=['#22282a','#22282a','#22282a','#20372d','#e9e6de','#5a3a28'];
const TRIM=['#f3efe6','#efe5cd','#f6f3ec'];
// DARK: an open window's shaded interior ("black openings"): a warm dark grey, not black.
const STONE='#a39d92',DARK='#5b534c';

const unit=(x)=>{let s=(x|0)^0x9e3779b9;s=Math.imul(s^(s>>>16),0x85ebca6b);s=Math.imul(s^(s>>>13),0xc2b2ae35);return ((s^(s>>>16))>>>0)/4294967296;};
export const hash=(id,salt)=>unit(Math.imul(id%1000000007,31)+salt*7919+(Math.floor(id/1000000007)|0));
const HEX=new Map(),hex=c=>{let v=HEX.get(c);if(!v)HEX.set(c,v=[parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255]);return v;};
const lin=c=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); // sRGB → linear (instance colours are linear)
const shade=(c,k)=>c.map(v=>v*k);
const signed=r=>r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const bbox=r=>{let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of r){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}return [a,b,c,d];};
const frameOf=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
  return {a,b,length,ux,uz,nx:-uz,nz:ux,angle:-Math.atan2(uz,ux),point:(u,y,d=0)=>[a[0]+ux*u-uz*d,y,a[1]+uz*u+ux*d]};};

function grid(cell){const m=new Map(),key=(i,j)=>i*100003+j;
  return {add(bb,item){for(let i=Math.floor(bb[0]/cell);i<=Math.floor(bb[1]/cell);i++)for(let j=Math.floor(bb[2]/cell);j<=Math.floor(bb[3]/cell);j++){
      const k=key(i,j);let l=m.get(k);if(!l)m.set(k,l=[]);l.push(item);}},
    at(x,z){return m.get(key(Math.floor(x/cell),Math.floor(z/cell)))??[];}};}

// The plaza/corridor facade plan of sj-plaza.js, edge by edge (same frames, same rejections), so fabric never dresses an
// edge that kit dresses. Returns the set of outer-ring edge indices it details.
export function plazaEdges(b,{city,detail,corridor,height,others=null}) {
  const out=new Set();
  if(!b.outer.some(p=>inDetail(...p)||inCorridor(...p))||PLAZA_WHOLE.has(b.id))return out;
  const s=b.outer.reduce((sum,a,i)=>{const c=b.outer[(i+1)%b.outer.length];return sum+a[0]*c[1]-c[0]*a[1];},0);
  b.outer.forEach((_,i)=>{let a=b.outer[i],end=b.outer[(i+1)%b.outer.length];if(s>0)[a,end]=[end,a];
    const f=frameOf(a,end),mid=f.point(f.length/2,0,1),cor=corridor&&corridorFacade(f,corridor);
    if(f.length<3||(!inDetail(mid[0],mid[2])&&!cor))return;
    if((others?others(mid[0],mid[2]):city.buildings).some(o=>o!==b&&inRing(mid[0],mid[2],o.outer)&&!o.holes.some(h=>inRing(mid[0],mid[2],h))))return;
    if(b.roof-height(mid[0],mid[2])<3)return;
    const ring=detail.plaza.ring,dist=Math.min(...ring.map((p,j)=>segmentDistance(mid[0],mid[2],p,ring[(j+1)%ring.length])));
    if(dist>26&&!cor)return;out.add(i);});
  return out;
}

export function createFabricLayout({city,detail,height,terrain,corridor,gate,fort,isDry,areas={}}) {
  const t0=Date.now(),F=FABRIC,earlier=Object.values(areas).filter(Boolean);
  // ---- Ownership ----
  const owned=new Set([...PLAZA_WHOLE]);
  for(const a of earlier){for(const id of a.ownedBuildings??[])owned.add(id);for(const id of a.buildingOverrides?.keys?.()??[])owned.add(id);}
  const overrideOf=new Map(earlier.flatMap(a=>[...(a.buildingOverrides??[])]));
  // ---- Spatial indexes: buildings (outer rings), roads, and earlier areas' solids/walls (probes never open onto them). ----
  const bIndex=grid(16),bbs=city.buildings.map(b=>bbox(overrideOf.get(b.id)?.outer??b.outer));bbs.forEach((bb,i)=>bIndex.add(bb,i));
  const inBox=(i,x,z)=>{const q=bbs[i];return x>=q[0]&&x<=q[1]&&z>=q[2]&&z<=q[3];};
  const ringOf=b=>overrideOf.get(b.id)?.outer??b.outer;
  const insideBuilding=(x,z,self=-1)=>{for(const i of bIndex.at(x,z)){if(!inBox(i,x,z))continue;const b=city.buildings[i],r=ringOf(b);
    if(inRing(x,z,r)&&!b.holes.some(h=>inRing(x,z,h)))return i===self?-2:i;}return -1;};
  const rIndex=grid(16),roads=[];
  for(const r of city.roads)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],h=r.width/2+F.roadSlack;
    const s={a,b,h};roads.push(s);rIndex.add([Math.min(a[0],b[0])-h,Math.max(a[0],b[0])+h,Math.min(a[1],b[1])-h,Math.max(a[1],b[1])+h],s);}
  const onRoad=(x,z)=>rIndex.at(x,z).some(s=>segmentDistance(x,z,s.a,s.b)<=s.h);
  const solids=grid(16),solidList=[];
  const addSolid=(ring,minY,maxY)=>{if(!ring||ring.length<3)return;const bb=bbox(ring);if((bb[1]-bb[0])*(bb[3]-bb[2])<1.5&&maxY-minY<2.5)return;
    const s={ring,bb,minY,maxY};solidList.push(s);solids.add(bb,s);};
  const boxRing=c=>{const {x:cx,z:cz}=c.centre,{x:hx,z:hz}=c.halfExtents,r=c.rotationY??0,cs=Math.cos(r),sn=Math.sin(r);
    return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([u,v])=>[cx+u*cs+v*sn,cz-u*sn+v*cs]);};
  for(const a of [gate,fort,...earlier].filter(Boolean)){
    for(const c of a.colliders??[])addSolid(c.outer?c.outer.map(p=>[p.x,p.z]):c.centre?boxRing(c):null,c.minY??(c.centre?.y-c.halfExtents?.y),c.maxY??(c.centre?.y+c.halfExtents?.y));
    for(const wl of a.walls??[]){const s=wl.a,e=wl.b;if(s?.B&&s?.W&&e?.B&&e?.W)addSolid([s.B,e.B,e.W,s.W],-50,200);}}
  const inSolid=(x,z,y)=>solids.at(x,z).some(s=>x>=s.bb[0]&&x<=s.bb[1]&&z>=s.bb[2]&&z<=s.bb[3]&&inRing(x,z,s.ring)&&(y===undefined||y>s.minY-.5&&y<s.maxY+.5));
  const ground=(x,z)=>height(x,z);

  // ---- Classify buildings ----
  const areaOf=r=>Math.abs(signed(r));
  const plazaColour=b=>['#d4aa59','#a4c4bd','#d4997e','#c7b3bd','#dad4b5','#9ab6c9'][b.id%6]; // sj-plaza.js plazaWallColour
  const plans=[],skipped={owned:0,plazaEdges:0};
  // Raw footprints (the plaza kit tests raw outers, not area overrides) for plazaEdges' containment query.
  const rawIndex=grid(16);city.buildings.forEach((b,i)=>rawIndex.add(bbox(b.outer),i));
  // Modern zone: east of x ≈ 620 (Puerta de Tierra, port, Bahía Urbana) and the waterfront south of Calle del Recinto Sur.
  const sur=city.roads.filter(r=>r.name==='Calle del Recinto Sur').flatMap(r=>r.points.slice(1).map((q,i)=>[r.points[i],q]));
  const southOfSur=(x,z)=>{let best=null,d=Infinity;for(const [a,c] of sur){if(x<Math.min(a[0],c[0])||x>Math.max(a[0],c[0]))continue;
    const zz=a[1]+(c[1]-a[1])*(x-a[0])/((c[0]-a[0])||1e-9),dd=Math.abs(zz-z);if(dd<d){d=dd;best=zz;}}return best!==null&&z>best+4;};
  city.buildings.forEach((b,i)=>{
    if(owned.has(b.id)){skipped.owned++;return;}
    const pe=plazaEdges(b,{city,detail,corridor,height,others:(x,z)=>{const out=[];for(const j of rawIndex.at(x,z))out.push(city.buildings[j]);return out;}});skipped.plazaEdges+=pe.size;
    const mixed=b.outer.some(p=>inDetail(...p)||inCorridor(...p));
    const area=areaOf(b.outer),h=b.roof-b.base;
    const cx=b.outer.reduce((s,q)=>s+q[0],0)/b.outer.length,cz=b.outer.reduce((s,q)=>s+q[1],0)/b.outer.length;
    // La Puntilla south of the Princesa promenade (z > 250: Coast Guard base and service blocks) is utilitarian too.
    const modern=!mixed&&!RUIN_IDS.has(b.id)&&(MODERN_IDS.has(b.id)||!CIVIC_IDS.has(b.id)&&(cx>620||southOfSur(cx,cz)||cz>250&&cx<140));
    const kind=RUIN_IDS.has(b.id)?'ruin':mixed?'town':modern||CIVIC_IDS.has(b.id)||area>1300||h>21&&area>350?'civic':'town';
    plans.push({i,b,id:b.id,kind,modern,mixed,plazaEdges:pe,area});
  });
  // Neighbour-distinct colours: greedy over a contact graph, preferring each building's hashed palette slot.
  const near=new Map(plans.map(p=>[p.i,new Set()]));
  {const all=city.buildings.map((b,i)=>({i,bb:bbox(b.outer)})),g=grid(24);all.forEach(o=>g.add([o.bb[0]-1,o.bb[1]+1,o.bb[2]-1,o.bb[3]+1],o));
    for(const p of plans){const r=p.b.outer,bb=bbox(r),seen=new Set();
      for(let x=Math.floor((bb[0]-1)/24);x<=Math.floor((bb[1]+1)/24);x++)for(let z=Math.floor((bb[2]-1)/24);z<=Math.floor((bb[3]+1)/24);z++)
        for(const o of g.at(x*24+1,z*24+1)){if(o.i===p.i||seen.has(o.i))continue;seen.add(o.i);
          if(o.bb[0]>bb[1]+1||bb[0]>o.bb[1]+1||o.bb[2]>bb[3]+1||bb[2]>o.bb[3]+1)continue;
          const q=city.buildings[o.i].outer;
          if(q.some(v=>r.some((a,k)=>segmentDistance(v[0],v[1],a,r[(k+1)%r.length])<1))||r.some(v=>q.some((a,k)=>segmentDistance(v[0],v[1],a,q[(k+1)%q.length])<1)))near.get(p.i).add(o.i);}}}
  const colourOf=new Map();
  for(const b of city.buildings){const o=overrideOf.get(b.id);if(o?.colour)colourOf.set(b.id,o.colour);
    else if(b.outer.some(p=>inDetail(...p)||inCorridor(...p))&&b.id!==CATHEDRAL_ID)colourOf.set(b.id,plazaColour(b));}
  const buildingColours=new Map();
  for(const p of [...plans].sort((a,b)=>a.id-b.id)){
    if(p.mixed){p.colour=colourOf.get(p.id);continue;}
    const pal=p.kind==='town'?TOWN:p.modern?MODERN:CIVIC,start=Math.floor(hash(p.id,1)*pal.length),used=new Set([...near.get(p.i)].map(j=>colourOf.get(city.buildings[j].id)));
    // Perceptual contrast, not just a different hex: every contact neighbour at least 0.12 apart in sRGB.
    const far=c=>[...used].every(u=>!u||Math.hypot(...hex(u).map((v,k)=>v-hex(c)[k]))>=.12);
    let c=pal[start];for(let k=0;k<pal.length&&!far(c);k++)c=pal[(start+k)%pal.length];
    if(p.kind==='ruin')c='#b9ab92';
    p.colour=c;colourOf.set(p.id,c);
    p.roofColour=p.kind==='town'?ROOF[Math.floor(hash(p.id,2)*ROOF.length)]:['#c3bcae','#b3aea4','#a9a59c','#cbc6ba'][Math.floor(hash(p.id,2)*4)];
    buildingColours.set(p.id,{colour:c,roofColour:p.roofColour});
  }

  const centre=p=>{const r=p.b.outer;return [r.reduce((s,q)=>s+q[0],0)/r.length,r.reduce((s,q)=>s+q[1],0)/r.length];};
  // Roof-zone trim level per building: neighbours in contact with (nearly) equal roofs would put
  // their cornices, parapets and copings on one plane where they meet; each building takes a small vertical offset that
  // differs from every such neighbour's (plaza-kit edges keep within 2.4 cm of the kit's own trim, which sits ≥ 2 cm away).
  {const roofOf=i=>{const b=city.buildings[i];return overrideOf.get(b.id)?.roof??b.roof;},byI=new Map(plans.map(p=>[p.i,p]));
    for(const p of [...plans].sort((a,b)=>a.id-b.id)){const lv=[],R=roofOf(p.i);
      for(const j of near.get(p.i)){const q=byI.get(j);if(q&&q.tShift!==undefined)lv.push(roofOf(j)+q.tShift);}
      p.tShift=(p.mixed?[0,-.012,-.024,-.036]:[0,-.025,-.05,-.075,-.1]).find(v=>lv.every(l=>Math.abs(R+v-l)>=.012))??0;}}
  // ---- Parts ----
  const parts={frame:[],rail:[],box:[]},roles=[],leafTones=[],boxRoof=[],stats={buildings:0,civic:0,modern:0,garages:0,rearFacades:0,articulated:0,copings:0,
    ruins:0,facades:0,streetBays:0,openings:0,doors:0,doorsToWindows:0,balconies:0,huts:0,tanks:0,plainEdges:0};
  const push=(kind,p,chunk,pt,angle,sx,sy,sz,c,shear=0,roof=0)=>{parts[kind].push(0,pt[0],pt[1],pt[2],angle,sx,sy,sz,c[0],c[1],c[2],shear);if(kind==='box')boxRoof.push(roof);};
  // One opening: surround (colour c) + leaf (colour lc; tex 1 = the panelled/louvred atlas leaf, 0 = flat glazing).
  const opening=(pt,angle,w,h,c,lc,tex=1)=>{push('frame',null,0,pt,angle,w,h,1,c);leafTones.push(lc[0],lc[1],lc[2],tex);};
  // an opening's sill (fascia at 0.12 m out, cap at the opening datum) must never
  // share a plane with what carries it. Door threshold steps and balcony slabs therefore stop SILL_DROP below the datum
  // and their exposed fronts sit 2 cm behind the sill fascia (steps) — the sill reads as a stone sill on its support.
  const SILL_DROP=.015;
  // Glazing that may be lit from inside at blue hour (sj-glow.js): front-face centre, yaw, size, kind, 7 numbers each.
  const glowList=[],glow=(f,u,y,d,w,h,kind)=>{const q=f.point(u,y,d);glowList.push(q[0],q[1],q[2],f.angle,w,h,paneKind(kind));};
  // A box seen from all round: two back-to-back half boxes (the box geometry has no back face).
  // roof = 1: a roof volume (room, cap, tank) that stays drawn to the far roof tier (sj-fabric.js) for fort/aerial views.
  const pushBoth=(pt,angle,sx,sy,sz,c,shear=0,roof=0)=>{const nx=Math.sin(angle)*sz/4,nz=Math.cos(angle)*sz/4;
    push('box',null,0,[pt[0]+nx,pt[1],pt[2]+nz],angle,sx,sy,sz/2,c,shear,roof);push('box',null,0,[pt[0]-nx,pt[1],pt[2]-nz],angle+Math.PI,sx,sy,sz/2,c,-shear,roof);};
  const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
  // Another building's body at (x,z,y) (roof trim must not run into a neighbour's envelope).
  const inEnvelope=(x,z,y,self)=>{for(const i of bIndex.at(x,z)){if(i===self||!inBox(i,x,z))continue;const o=city.buildings[i],ov=overrideOf.get(o.id),r=ov?.outer??o.outer;
    if(y>(ov?.base??o.base)&&y<(ov?.roof??o.roof)+.02&&inRing(x,z,r)&&!o.holes.some(h=>inRing(x,z,h)))return true;}return inSolid(x,z,y);};
  for(const p of plans){
    const {b,kind,chunk,modern}=p,ring=b.outer,s=signed(ring),rnd=k=>hash(p.id,10+k),garage=GARAGE_IDS.has(p.id);stats.buildings++;
    if(kind==='civic')stats[modern?'modern':'civic']++;if(kind==='ruin')stats.ruins++;if(garage)stats.garages++;
    const wall=lin(hex(p.colour)),white=lin(hex(kind==='town'?(p.colour==='#f5f2ea'||p.colour==='#f4ead0'?'#c9d4d8':TRIM[Math.floor(rnd(0)*TRIM.length)]):'#efe9dc'));
    // a third of town houses carry wall-toned mouldings instead of white ones.
    const trim=kind==='town'&&!p.mixed&&rnd(15)<.35?mix(wall,white,.5):white,cap=mix(trim,wall,.35);
    // Base course (row 2): a masonry tone, not a dark shade of the plaster, so steep-street plinths read as stone.
    const band=kind==='town'?(rnd(1)<.45?lin(hex(STONE)):mix(shade(wall,.78),lin(hex(STONE)),.5)):lin(hex('#a8a296'));
    const shutter=lin(hex(SHUTTER[Math.floor(rnd(2)*SHUTTER.length)])),door=rnd(3)<.5?shutter:lin(hex(SHUTTER[Math.floor(rnd(4)*SHUTTER.length)]));
    const rail=lin(hex(RAIL[Math.floor(rnd(5)*RAIL.length)])),dark=lin(hex(DARK));
    // Town styles (Wikimedia Commons curid=131971241, curid=151596781, curid=158245806, curid=99177670): balconies none / alternate first-floor / continuous first-floor / every upper bay.
    const bMode=kind!=='town'?0:(r=>r<.2?0:r<.45?1:r<.75?2:3)(rnd(6)),courses=kind==='civic'||rnd(7)<.6,shopFront=kind==='town'&&rnd(8)<.3;
    // Variety (Wikimedia Commons curid=131971241, curid=151596781, curid=182287159, curid=158245806): fanlights, French doors with flush railings or sash windows, balustrades, parapet heights.
    const fan=kind==='town'&&rnd(9)<.4,upStyle=kind!=='town'?'civic':(r=>r<.3?'window':r<.62?'flush':'plain')(rnd(12));
    const balustrade=kind==='town'&&!p.mixed&&rnd(13)<.2,ph=balustrade?.3:.38+rnd(14)*.5,glass=lin(hex(modern?'#8ea3ab':'#71878f'));
    // Modern façade style per building (port rows; Wikimedia Commons curid=122894933 Edificio Ochoa / Hotel Rumbao as
    // character references): ribbon windows over tinted spandrels, a pale pilaster grid with warm inset spandrels (Commons curid=122894933), or
    // grouped bays between piers. Inferred per building id; not a survey of any facade.
    const mstyle=modern&&!garage?['ribbon','pilaster','grouped'][Math.floor(rnd(77)*3)]:null;
    const plazaDims=p.mixed;
    // Trim that stops at a wall end without wrapping the corner is held 15 mm short of it, so its end face never lies on
    // the plane of the adjoining wall.
    const inset=(u0,u1,L)=>[Math.abs(u0)<.001?.015:u0,Math.abs(u1-L)<.001?L-.015:u1];
    const edges=ring.map((_,k)=>{let a=ring[k],e=ring[(k+1)%ring.length];if(s>0)[a,e]=[e,a];return {k,f:frameOf(a,e)};}).filter(e=>e.f.length>.3);
    // Exposure along each edge, sampled every metre: party (a building or earlier solid right outside), low (roof less than
    // 2.8 m above the ground in front: no projecting trim at head height), above (party wall rising over a lower neighbour).
    for(const e of edges){const f=e.f,n=Math.max(1,Math.round(f.length));e.samples=[];
      for(let j=0;j<n;j++){const u=(j+.5)*f.length/n,q=f.point(u,0,F.probe[0]);
        // also probe 0.25 m out, so a neighbour standing closer than the 0.8 m sample
        // still makes this a party face.
        const q2=f.point(u,0,.25),nb0=insideBuilding(q[0],q[2],p.i),nb2=nb0===-1?insideBuilding(q2[0],q2[2],p.i):-1,nb=nb0!==-1?nb0:nb2>=0?nb2:-1,party=nb!==-1||inSolid(q[0],q[2]),low=b.roof-ground(q[0],q[2])<2.8;
        const above=nb>=0&&(overrideOf.get(city.buildings[nb].id)?.roof??city.buildings[nb].roof)<b.roof-.6;e.samples.push({u,party,low,above});}
      e.plaza=p.plazaEdges.has(e.k);}
    const order=s>0?[...edges].reverse():edges;
    const runsOf=(e,ok)=>{const out=[];let cur=null;const step=e.f.length/e.samples.length;
      for(const q of e.samples){if(ok(q)){if(!cur)out.push(cur={u0:q.u-step/2,u1:q.u+step/2});else cur.u1=q.u+step/2;}else cur=null;}
      for(const r of out){r.u0=Math.max(0,r.u0);r.u1=Math.min(e.f.length,r.u1);}return out.filter(r=>r.u1-r.u0>.6);};
    for(const e of edges){e.runs=e.plaza?[]:runsOf(e,q=>!q.party);e.tall=e.plaza?[]:runsOf(e,q=>!q.party&&!q.low);}
    order.forEach((e,j)=>e.at=j);const nextOf=e=>order[(e.at+1)%order.length],prevOf=e=>order[(e.at+order.length-1)%order.length];
    const convexAt=(e1,e2)=>e1.f.ux*e2.f.uz-e1.f.uz*e2.f.ux<-.2;
    // A box along an edge between u0 and u1, emitted only over the stretches whose plan footprint stays out of every other
    // building's body at that height (sampled every 0.2 m at the box front and at 0.32 of its depth).
    const clipped=(f,U0,U1,Y,dz,depth,hgt,c,shear=0,both=false)=>{const [u0,u1]=inset(U0,U1,f.length),y=Y+p.tShift;const put=both?pushBoth:(pt,a,sx,sy,sz,cc,sh)=>push('box',p,chunk,pt,a,sx,sy,sz,cc,sh);
      // Fast path: no other building body (or earlier solid) whose box meets this footprint's box at this height.
      {let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
        for(const uu of [u0,u1])for(const dd of [dz-depth/2,dz+depth/2]){const qx=f.a[0]+f.ux*uu-f.uz*dd,qz=f.a[1]+f.uz*uu+f.ux*dd;
          if(qx<x0)x0=qx;if(qx>x1)x1=qx;if(qz<z0)z0=qz;if(qz>z1)z1=qz;}let hit=false;
        for(let i=Math.floor(x0/16);i<=Math.floor(x1/16)&&!hit;i++)for(let j=Math.floor(z0/16);j<=Math.floor(z1/16)&&!hit;j++){
          for(const k of bIndex.at(i*16+1,j*16+1)){if(k===p.i)continue;const q=bbs[k],o=city.buildings[k],ov=overrideOf.get(o.id);
            if(q[0]<=x1&&x0<=q[1]&&q[2]<=z1&&z0<=q[3]&&y>(ov?.base??o.base)&&y<(ov?.roof??o.roof)+.02){hit=true;break;}}
          for(const sd of solids.at(i*16+1,j*16+1))if(sd.bb[0]<=x1&&x0<=sd.bb[1]&&sd.bb[2]<=z1&&z0<=sd.bb[3]&&y>sd.minY-.5&&y<sd.maxY+.5){hit=true;break;}}
        if(!hit){put(f.point((u0+u1)/2,y,dz),f.angle,u1-u0,hgt,depth,c,shear);return;}}
      const pts=[];for(let u=u0;u<=u1+1e-6;u+=.2)pts.push(Math.min(u,u1));if(pts.at(-1)<u1)pts.push(u1);
      let a=null;const flush=(end)=>{if(a!==null&&end-a>.3)put(f.point((a+end)/2,y+shear*((a+end)/2-(u0+u1)/2),dz),f.angle,end-a,hgt,depth,c,shear);a=null;};
      for(let k=0;k<pts.length;k++){const u=pts[k],bad=[dz+depth/2-.003,dz+depth*.32].some(d=>{const q=f.point(u,0,d);return inEnvelope(q[0],q[2],y,p.i);});
        if(!bad&&a===null)a=k?Math.min(u,pts[k-1]+.21):u;if(bad&&a!==null)flush(Math.max(a,u-.21));}
      flush(u1);};
    let anyDressed=false;
    // Party walls rising above a lower neighbour: a coping set back inside the wall line (front 1 cm behind it).
    if(kind!=='ruin'&&!p.mixed)for(const e of edges){if(e.plaza)continue;for(const r of runsOf(e,q=>q.party&&q.above)){
      pushBoth(e.f.point((r.u0+r.u1)/2,b.roof+.05,-.14),e.f.angle,r.u1-r.u0,.12,.26,cap);stats.copings++;}}
    for(const e of edges){if(e.plaza||!e.runs.length)continue;
      const f=e.f,nx=nextOf(e),pv=prevOf(e),L=f.length;
      const endOpen=nx&&!nx.plaza&&nx.tall.some(r=>r.u0<.05)&&e.tall.at(-1)?.u1>L-.05&&convexAt(e,nx);
      const startOpen=pv&&!pv.plaza&&pv.tall.some(r=>r.u1>pv.f.length-.05)&&e.tall[0]?.u0<.05&&convexAt(pv,e);
      // Roof trim on every open, full-height run (cornice + parapet + coping); low runs get a flush coping only.
      // Concave corner at the end of this edge: the next edge's trim runs into the corner; this run
      // stops where that box's outer face is (dz + depth/2 out from the next wall), so the two never overlap.
      // Any concave bend over ~1°: the overlap reaches (dz + depth/2)·tan(bend) along this edge (whole box depth at ≥ 45°).
      const sinB=nx?e.f.ux*nx.f.uz-e.f.uz*nx.f.ux:0,endConcave=nx&&!nx.plaza&&nx.tall.some(r=>r.u0<.05)&&e.tall.at(-1)?.u1>L-.05&&sinB>.02,
        cutK=endConcave?Math.min(1,sinB/Math.sqrt(Math.max(1e-6,1-sinB*sinB))):0;
      for(const r of e.tall){const ext0=r.u0<.05&&startOpen,ext1=r.u1>L-.05&&endOpen,cut1=r.u1>L-.05&&endConcave;
        // `both`: parts standing above the roof are seen from the roof side too (forts, wall walks): two half boxes.
        // Convex corners: only the run ending at the corner extends over the corner square; the run
        // starting there begins exactly where that box ends (depth/2 − dz), so the two never overlap (no coplanar tops,
        // bottoms or fronts at corners).
        const trimRun=(dz,depth,y,hgt,c=trim,both=false)=>clipped(f,r.u0+(ext0?depth/2-dz:0),r.u1+(ext1?dz+depth/2:cut1?-(dz+depth/2)*cutK-.005:0),y,dz,depth,hgt,c,0,both);
        if(kind==='ruin'){trimRun(.02,.5,b.roof+.12,.3,lin(hex('#b3a68e')),true);continue;}
        if(plazaDims){trimRun(.1,.35,b.roof-.15,.25);trimRun(.02,.43,b.roof+.13,.2,trim,true);}
        // Parapets end flush in the wall tone (no separate bright coping strip: roof outlines, and one box less).
        else if(modern)trimRun(.0,.3,b.roof+.31,.66,wall,true);
        else if(kind==='civic'){trimRun(.2,.62,b.roof-.32,.42);trimRun(.0,.38,b.roof+.36,.72,wall,true);}
        else{trimRun(.13,.36,b.roof-.16,.26);trimRun(-.06,.26,b.roof+ph/2,ph+.04,wall,true);
          if(balustrade&&r.u1-r.u0>2){const n=Math.max(1,Math.round((r.u1-r.u0-.2)/1.5));
            for(let j=0;j<n;j++){const a=r.u0+.1+j*(r.u1-r.u0-.2)/n,c=r.u0+.1+(j+1)*(r.u1-r.u0-.2)/n;
              push('rail',p,chunk,f.point((a+c)/2,b.roof+ph+.08,-.16),f.angle,c-a,.62,.16,trim);}
            trimRun(-.06,.3,b.roof+ph+.74,.08,cap,true);}}}
      for(const r of runsOf(e,q=>!q.party&&q.low))if(kind!=='ruin'&&!plazaDims)clipped(f,r.u0,r.u1,b.roof+.05,-.1,.26,.12,cap,0,true);
      const gp=(u,d)=>{const q=f.point(u,0,d);return ground(q[0],q[2]);};
      // Street: a public way within 10 m in front with nothing between; back: 2.4 m clear yard; seen: a public way within
      // 24 m in front with nothing between (for articulation of walls that get no openings).
      const reachRoad=(u,max)=>{const y=gp(u,.4)+1.6;for(let d=1.5;d<=max;d+=1.5){const q=f.point(u,0,d);if(insideBuilding(q[0],q[2])!==-1||inSolid(q[0],q[2],max>11?y:undefined))return false;if(onRoad(q[0],q[2]))return true;}return false;};
      const isStreet=u=>reachRoad(u,10.5);
      const isBack=u=>{const q=f.point(u,0,F.probe[1]);return insideBuilding(q[0],q[2])===-1&&!inSolid(q[0],q[2]);};
      const spacing=garage?4.2:modern?3.1+rnd(75)*1.1:kind==='civic'?F.civicBay:F.bay,w0=garage?3.0:mstyle==='ribbon'?3.2:mstyle==='pilaster'?1.3:modern?1.4+rnd(76)*.6:kind==='civic'?1.5:shopFront?1.8:1.22;
      let bays=[];const back=[];
      // Small walls (kiosks, narrow fronts) still get one narrow opening (≥ 0.7 m) when it clears both corners.
      for(const r of e.runs){const len=r.u1-r.u0-2*F.corner;if(len<1.13)continue;
        const n=Math.max(1,Math.round(len/spacing)),pitch=len/n,w=Math.min(w0,pitch*(mstyle==='ribbon'?.74:.62));if(w<.7)continue;
        for(let j=0;j<n;j++){const u=r.u0+F.corner+(j+.5)*pitch;
          const open=[u-w/2-.2,u,u+w/2+.2].every(v=>!e.samples[Math.min(e.samples.length-1,Math.max(0,Math.floor(v/(L/e.samples.length))))].party);
          if(!open)continue;
          if(isStreet(u))bays.push({u,w,r,pitch});else if(isBack(u))back.push({u,w,r,pitch});}}
      const rear=!bays.length;
      if(rear)bays=back.filter((q,j)=>j%(kind==='town'?2:1)===(kind==='town'?(Math.round(hash(p.id,e.k))%2):0)).map(q=>({...q,w:Math.min(q.w,1.0)}));
      // Exact frame footprint samples (the door/burial probe): ±0.67 w along the wall, 0–0.35 m out.
      const span=(u,w)=>{let lo=Infinity,hi=-Infinity;for(const k of [-.67,-.5,-.25,0,.25,.5,.67])for(const d of [0,.045,.16,.35]){const y=gp(u+k*w,d);if(y<lo)lo=y;if(y>hi)hi=y;}return {lo,hi};};
      const tall=b.roof-Math.max(...e.runs.map(r=>gp((r.u0+r.u1)/2,.35)));
      // Base band: sloping pieces (sheared boxes) whose top follows the street 0.6 m (civic 1.05 m) above the wall foot and
      // whose bottom stays 15 cm under the lowest terrain sample of the piece (no sawtooth stripe, no burial).
      const bandRise=kind==='civic'?F.civicBand:F.band;
      // (cost): pieces are adaptive — one piece wherever the street grade is linear within 6 cm along it,
      // split at the worst point otherwise (pieces ≥ 1.5 m); the old fixed 3 m pieces were 30 % of all fabric boxes.
      // `cuts` ([u0,u1] intervals) keep the band and its raked coping off door/low-sill leaves (Cristo).
      const bandRun=(r,cuts=[])=>{const us=[r.u0],split=(a,c)=>{const ta=gp(a,.05),tc=gp(c,.05);let worst=0,at=-1;
          if(c-a>3)for(let v=a+.75;v<c-.74;v+=.75){const e=Math.abs(ta+(tc-ta)*(v-a)/(c-a)-gp(v,.05));if(e>worst){worst=e;at=v;}}
          if(worst>.06){const m=Math.min(c-1.5,Math.max(a+1.5,at));split(a,m);split(m,c);}else us.push(c);};
        split(r.u0,r.u1);const n=us.length-1,tops=us.map(u=>gp(u,.05)+bandRise);
        for(let k=0;k<n;k++){const A=us[k],C=us[k+1],sh=(tops[k+1]-tops[k])/(C-A),line=v=>tops[k]+sh*(v-A);
          if(Math.max(tops[k],tops[k+1])>b.roof-1)continue;
          let segs=[[A,C]];for(const [x0,x1] of cuts)segs=segs.flatMap(([a,c])=>x1<=a||x0>=c?[[a,c]]:[[a,x0],[x1,c]].filter(([p0,p1])=>p1-p0>.2));
          for(const [a0,c0] of segs){const [a,c]=inset(a0,c0,L),len=c-a;if(len<.2)continue;let dev=0;
            for(let v=a;v<=c+1e-6;v+=.25){const t=line(v)-bandRise-gp(v,.05);if(t>dev)dev=t;}
            const H=bandRise+dev+.15,mid=line((a+c)/2);
            push('box',p,chunk,f.point((a+c)/2,mid-H/2,-.02),f.angle,len,H,.08,band,sh);
            // On steep pieces a raked coping line caps the course (continuous along the grade, reads as dressed masonry).
            if(Math.abs(sh)>.07)push('box',p,chunk,f.point((a+c)/2,mid+.02,.0),f.angle,len,.07,.12,cap,sh);}}};
      if(kind==='ruin'||!bays.length){
        // No openings here. A wall a rider sees from a public way is not left a featureless slab: base band,
        // pilasters (blind bays) and, when tall, a string course; the roof trim above is already in place.
        const seenRuns=e.runs.filter(r=>[.25,.5,.75].some(t=>reachRoad(r.u0+(r.u1-r.u0)*t,F.seen)));
        if(kind==='ruin'||plazaDims||!seenRuns.length||tall<1.6){stats.plainEdges++;continue;}
        stats.articulated++;anyDressed=true;
        for(const r of seenRuns){bandRun(r);const len=r.u1-r.u0;if(len<2)continue;
          const n=Math.max(1,Math.round(len/(modern?4.5:3.8))),top=b.roof-(e.tall.length?.5:.2);
          for(let j=0;j<=n;j++){const u=r.u0+.3+j*(len-.6)/n,lo=Math.max(gp(u-.25,.05),gp(u+.25,.05))+bandRise-.05;
            if(top-lo>.8)push('box',p,chunk,f.point(u,(lo+top)/2,.04),f.angle,.42,top-lo,.12,trim);}
          if(courses&&tall>5.5){const g0=Math.max(gp(r.u0,.3),gp(r.u1,.3)),y=g0+Math.min(F.storey,(b.roof-g0)/2);
            if(y<b.roof-1.2){const [a,c]=inset(r.u0,r.u1,L);push('box',p,chunk,f.point((a+c)/2,y,.07),f.angle,c-a,.15,.2,trim);}}}
        continue;}
      anyDressed=true;stats.facades++;if(rear)stats.rearFacades++;else stats.streetBays+=bays.length;
      const g=u=>gp(u,.35);
      const datum=Math.max(...bays.map(q=>span(q.u,q.w).hi));
      const top=b.roof-(kind==='civic'?.6:.35),rise=top-datum;
      let floors=Math.max(1,Math.round(rise/(garage?3.0:kind==='civic'?4.4:F.storey)));if(rise/floors>4.9)floors++;if(floors>1&&rise/floors<2.75&&!garage)floors--;
      const floorH=rise/floors;
      const frameMark=parts.frame.length;
      if((courses||garage)&&!rear)for(let k=1;k<floors;k++){const y=datum+k*floorH-.12;
        for(const r of e.runs)if(bays.some(q=>q.r===r)){const [a,c]=inset(r.u0,r.u1,L);push('box',p,chunk,f.point((a+c)/2,y,.07),f.angle,c-a,garage?.35:.15,.2,garage?shade(wall,1.08):trim);}}
      if(kind==='civic'&&!modern&&!rear)for(const r of e.runs){const rb=bays.filter(q=>q.r===r);if(!rb.length)continue;
        const us=[r.u0+F.corner*.5,...rb.slice(1).map((q,j)=>(q.u+rb[j].u)/2),r.u1-F.corner*.5];
        for(const u of us){const lo=Math.max(g(u-.25),g(u+.25))+bandRise-.05;push('box',p,chunk,f.point(u,(lo+b.roof-.5)/2,.05),f.angle,.5,b.roof-.5-lo,.14,trim);}}
      // Openings. Modern: subtle surrounds, flat glazing (box, not the louvred leaf); garages: dark deck openings.
      // Modern / garage rework (rows 5/6/19): lighter glazing with per-pane blinds/reflection variation, spandrel
      // bands, piers grouping every few bays, a glazed ground storey under a canopy line, lighter deck recesses.
      // lighter deck recesses (grey-green two steps above the wall shade, never black) and sky-tinted panes
      // (most reflect the sky, a few read darker), warm inset spandrels for the pilaster style (Commons curid=122894933).
      const surround=modern?shade(wall,1.05):trim,deck=mix(lin(hex(['#727a78','#7b807c','#6d7775'][Math.floor(rnd(70)*3)])),wall,.2);
      const pane=k=>{const r=rnd(71+k);return r<.18?mix(glass,lin(hex('#5d7078')),.55):mix(glass,lin(hex('#d3dee2')),r*.6);};let paneN=0;
      const transom=mix(lin(hex('#a9bcc2')),lin(hex('#dfe8ea')),rnd(81)*.5),tBar=mix(lin(hex('#3d4a43')),transom,.35),
        tBars=(r=>r<.45?[]:r<.8?[0]:[-.25,0,.25])(rnd(82)),warm=mix(wall,lin(hex('#c49a6c')),.35),civicHood=kind==='civic'&&!modern&&!rear&&rnd(78)<.6;
      // Stair/lift core (modern and garages, ≥ 7 bays on a run, ≥ 3 storeys): one bay near an end is a solid strip with
      // narrow landing windows and the run's entrance at its foot — breaks the uniform grid ("two templates").
      if(modern&&!rear&&floors>=3)for(const r of e.runs){const rb=bays.filter(q=>q.r===r);if(rb.length<7)continue;
        // The strip starts above the ground storey (the entrance stays clear); landing windows sit on its face (CORE_D).
        const c=rb[rnd(79)<.5?1:rb.length-2];c.core=true;const lo=datum+floorH-.1,hi=b.roof-.1;
        if(hi-lo>3)push('box',p,chunk,f.point(c.u,(lo+hi)/2,.06),f.angle,c.pitch*.86,hi-lo,.14,mix(wall,lin(hex('#b8b2a7')),.45));}
      // Garages: every fourth bay is a solid pier bay (no deck opening), one ground bay is the vehicle entrance.
      if(garage&&!rear)for(const r of e.runs){const rb=bays.filter(q=>q.r===r);rb.forEach((q,j)=>{if(j%4===3&&j<rb.length-1)q.pier=true;});
        if(rb.length>=3){const v=rb[Math.max(0,Math.min(rb.length-1,Math.round((rnd(80)<.5?.25:.75)*(rb.length-1))))];if(!v.core)v.vehicle=true;}}
      // Transom/fanlight glazing over the top of a door leaf (the leaf fills the whole opening): front 3 cm before the leaf.
      const glazed=(u,y,w,h)=>{push('box',p,chunk,f.point(u,y+h/2,.058),f.angle,w,h,.03,modern?pane(paneN++):glass);glow(f,u,y+h/2,.073,w,h,modern?'shop':'transom');};
      if(modern&&!rear){const group=garage?99:mstyle==='pilaster'?1:mstyle==='ribbon'?99:2+Math.floor(rnd(72)*3);
        for(const r of e.runs){const rb=bays.filter(q=>q.r===r);if(rb.length<2)continue;
          // Piers between bay groups (pilaster style: at every bay, paler and slimmer), full height above the base course.
          for(let j=group;j<rb.length;j+=group){if(rb[j].core||rb[j-1].core)continue;const u=(rb[j].u+rb[j-1].u)/2,lo=Math.max(g(u-.4),g(u+.4))+bandRise-.05,hi=b.roof-.1;
            if(hi-lo>2)push('box',p,chunk,f.point(u,(lo+hi)/2,.06),f.angle,mstyle==='pilaster'?.42:.5,hi-lo,.16,shade(wall,mstyle==='pilaster'?1.12:1.07));}
          // Spandrel bands between storeys (ribbon: deeper, tinted) and a canopy line over the ground storey (≥ 2.6 m clear).
          if(mstyle!=='pilaster')for(let k=1;k<floors;k++)push('box',p,chunk,f.point((r.u0+r.u1)/2,datum+k*floorH+.45,.015),f.angle,r.u1-r.u0,mstyle==='ribbon'?1.0:.85,.03,mstyle==='ribbon'?mix(wall,lin(hex('#8f9c9e')),.3):shade(wall,.9));
          const gmaxRun=Math.max(...[r.u0,(r.u0+r.u1)/2,r.u1].map(v=>gp(v,.8)),datum),cy=Math.max(datum+3.0,gmaxRun+2.75);
          if(floors>1&&cy<datum+floorH-.2&&rnd(73)<.7)push('box',p,chunk,f.point((r.u0+r.u1)/2,cy,.4),f.angle,r.u1-r.u0-.2,.12,.8,mix(wall,lin(hex('#3d4446')),.6));}}
      for(const q of bays){const {u,w}=q,{lo:gmin,hi:gmax}=span(u,w);
        if(garage){// Deck openings on every storey except pier bays; ground: the vehicle entrance, a pedestrian door at the
          // middle bay, louvred vent panels elsewhere (no blank or black ground storey).
          for(let k=0;k<floors;k++){const y=datum+k*floorH+(k?.9:.0),h=Math.min(1.2,floorH-1.2);
            if(k===0){if(rear)continue;
              if(q.vehicle){const vw=Math.min(q.pitch*.85,5.2),sp=span(u,vw),sample=v=>e.samples[Math.min(e.samples.length-1,Math.max(0,Math.floor(v/(L/e.samples.length))))];
                if(!sample(u-vw/2-.2).party&&!sample(u+vw/2+.2).party&&sp.hi-sp.lo<=F.doorGrade&&floorH>3&&u-vw*.67>=q.r.u0+F.corner&&u+vw*.67<=q.r.u1-F.corner){opening(f.point(u,sp.hi+.02,0),f.angle,vw,Math.min(2.7,floorH-.5),surround,lin(hex('#59605d')),0);
                  roles.push(1);stats.openings++;stats.doors++;continue;}}
              if(Math.abs(u-L/2)<q.pitch*.6&&u-1.61>=q.r.u0+F.corner&&u+1.61<=q.r.u1-F.corner){const sp=span(u,2.4);if(sp.hi-sp.lo<=F.doorGrade&&floorH>3){
                opening(f.point(u,sp.hi+.02,0),f.angle,2.4,Math.min(2.6,floorH-.6),surround,deck);roles.push(1);stats.openings++;stats.doors++;continue;}}
              const vw=Math.min(q.pitch*.6,2.4),vy=gmax+1.0;if(vy+1.1<datum+floorH-.4&&vw>.8){opening(f.point(u,vy,0),f.angle,vw,1.1,surround,shade(wall,.78));roles.push(2);stats.openings++;}
              continue;}
            if(q.pier)continue;
            if(q.core){if(y>gmax+2.6){opening(f.point(u,y,.13),f.angle,.6,Math.min(1.05,h),surround,pane(paneN++),0);glow(f,u,y+Math.min(1.05,h)/2,.175,.6,Math.min(1.05,h),'stair');roles.push(3);stats.openings++;}continue;}
            if(h>.6&&y>gmax+2.6)push('box',p,chunk,f.point(u,y+h/2,.02),f.angle,Math.min(q.pitch*.72,3.4),h,.04,deck);}
          // Columns at each bay edge read the structural cadence instead of continuous slots.
          const lo=gmax+bandRise-.05;if(b.roof-.1-lo>2)push('box',p,chunk,f.point(u+q.pitch/2,(lo+b.roof-.1)/2,.06),f.angle,.5,b.roof-.1-lo,.16,shade(wall,1.08));
          continue;}
        // Ground floor (street fronts only). Doors sit on their own bay's grade: the frame footprint may vary at most
        // FABRIC.doorGrade; otherwise a narrower door or a small shift along the bay, else a raised window.
        if(!rear){let doorAt=null;
          const wantWindow=q.core?false:modern?rnd(20+Math.round(u))<.5:kind==='civic'?Math.abs(u-L/2)>spacing*.6:shopFront?false:rnd(20+Math.round(u))<.25;
          if(!wantWindow)for(const ww of [w,Math.max(.95,Math.min(w,1.22)*.8)])for(const sh of [0,.3,-.3,.6,-.6]){
            if(doorAt)break;const uu=u+sh;if(uu-.67*ww<q.r.u0+F.corner-.01||uu+.67*ww>q.r.u1-F.corner+.01||Math.abs(sh)>q.pitch/2-.67*ww)continue;
            const sp=span(uu,ww);if(sp.hi-sp.lo<=F.doorGrade)doorAt={u:uu,w:ww,...sp};}
          const limit=floors>1?datum+floorH-.5:top-.45;
          if(doorAt){const yb=doorAt.hi+.02+SILL_DROP,hh=Math.min(modern?2.75:kind==='civic'?3.4:3.1,limit-yb),uu=doorAt.u,ww=doorAt.w;
            if(hh>=1.95){opening(f.point(uu,yb,0),f.angle,ww,hh,surround,door);
              if(modern){if(hh>2.6)glazed(uu,yb+2.28,ww,hh-2.28);}
              else if((fan||shopFront)&&hh>=2.6){const hd=hh*(shopFront?.68:.74);
                // Transom: a light sky-tinted pane (Wikimedia Commons curid=151596781: light glazed heads over the doors). the dense
                // black railing grille is gone; per building none / one / three thin dark grey-green glazing bars (inferred).
                const th=hh-hd-.08;push('box',p,chunk,f.point(uu,yb+hd+.04,.06),f.angle,ww,.08,.08,trim);push('box',p,chunk,f.point(uu,yb+hd+.08+th/2,.058),f.angle,ww,th,.03,transom);glow(f,uu,yb+hd+.08+th/2,.073,ww,th,shopFront?'transomShop':'transom');
                for(const t of tBars)push('box',p,chunk,f.point(uu+t*ww,yb+hd+.08+th/2,.081),f.angle,.045,th,.02,tBar);}
              roles.push(1);stats.openings++;stats.doors++;
              push('box',p,chunk,f.point(uu,(doorAt.lo-.12+yb-SILL_DROP)/2,.03),f.angle,ww+.3,yb-SILL_DROP-doorAt.lo+.12,.14,band);}}
          else{if(!wantWindow)stats.doorsToWindows++;
            // Modern ground storey: low-sill shop/service glazing (sill 0.45 m) instead of upper-floor slots.
            const yb=gmax+(modern?.45:kind==='civic'?(floors>1?1.25:.75):.85),hh=Math.min(modern?2.4:kind==='civic'?2.0:2.1,limit-yb);
            if(hh>=.8){if(modern)opening(f.point(u,yb,0),f.angle,w,hh,surround,pane(paneN++),0);else opening(f.point(u,yb,0),f.angle,w,hh,surround,shutter);
              glow(f,u,yb+hh/2,.045,w,hh,modern?'shop':'leak');
              roles.push(2);stats.openings++;}}}
        for(let k=1;k<floors;k++){const fl=datum+k*floorH,civicSill=kind==='civic'?.85:0;
          const sash=upStyle==='window'||rear||modern,wb=fl+.04+(rear||modern?.85:civicSill+(sash?.8:0));
          const wh=Math.min(rear?1.45:modern?1.35+rnd(74)*.5:kind==='civic'?2.3:sash?1.75:2.5,floorH-(rear||modern?1.3:kind==='civic'?1.35:sash?1.5:.72),top-.4-wb);
          if(wh<1.1||wb<gmax+2.6)continue;
          const darkLeaf=rnd(40+k*7+Math.round(u*3))<.14;
          if(q.core){opening(f.point(u,fl+floorH*.38,.13),f.angle,.6,Math.min(1.05,floorH*.4),surround,pane(paneN++),0);glow(f,u,fl+floorH*.38+Math.min(1.05,floorH*.4)/2,.175,.6,Math.min(1.05,floorH*.4),'stair');roles.push(3);stats.openings++;continue;}
          if(modern)opening(f.point(u,wb,0),f.angle,w,wh,surround,pane(paneN++),0);else opening(f.point(u,wb,0),f.angle,w,wh,surround,darkLeaf?dark:shutter,darkLeaf?0:1);
          glow(f,u,wb+wh/2,.045,w,wh,modern?'office':darkLeaf?'open':'leak');

          if(mstyle==='pilaster')push('box',p,chunk,f.point(u,fl+.04+.42,.035),f.angle,w,.72,.03,warm);
          // Civic piano nobile hood (cornisa) just above the frame's own hood moulding (top at 1.12 × the height).
          if(civicHood&&k===1)push('box',p,chunk,f.point(u,wb+wh*1.12+.1,.13),f.angle,w+.5,.16,.16,trim);
          roles.push(3);stats.openings++;
          if(rear||modern)continue;
          // Civic piano nobile (Wikimedia Commons curid=127996363, curid=14719072): the first-floor windows carry flush iron balconettes.
          if(kind==='civic'){if(k===1&&wb>gmax+2.6)push('rail',p,chunk,f.point(u,wb,0),f.angle,w+.06,.9,.16,rail);continue;}
          const want=bMode===3||bMode===2&&k===1||bMode===1&&k===1&&Math.round(u/spacing)%2===0;
          if((!want||sash)&&upStyle==='flush'&&!(bMode===2&&k===1))push('rail',p,chunk,f.point(u,wb,0),f.angle,w+.06,.95,.16,rail);
          if(!want||bMode===2||sash)continue;
          const D=F.slabDepth,under=Math.max(...[-w/2-.25,w/2+.25].map(v=>g(u+v)),gp(u,D));
          if(wb-.14<under+F.clearUnder)continue;
          // Slab and railing (the sub-decimetre brackets were dropped: never legible at street distance, cost note).
          push('box',p,chunk,f.point(u,wb-.07-SILL_DROP,D/2),f.angle,w+.5,.14,D,trim);
          // Railing foot 1 cm into the (lowered) slab (attachment rule), top unchanged.
          push('rail',p,chunk,f.point(u,wb-SILL_DROP-.01,0),f.angle,w+.42,1+SILL_DROP+.01,D-.04,rail);stats.balconies++;}
      }
      // Base band after the openings: cut at every opening whose foot is below the band top (doors, low-sill glazing).
      {const cuts=[],fr=parts.frame;for(let o=frameMark;o<fr.length;o+=PART_STRIDE){const u=(fr[o+1]-f.a[0])*f.ux+(fr[o+3]-f.a[1])*f.uz,w=fr[o+5]*.67+.04;
          if(fr[o+2]<gp(u,.05)+bandRise+.05)cuts.push([u-w,u+w]);}
        for(const r of e.runs)if(bays.some(q=>q.r===r))bandRun(r,cuts);}
      if(bMode===2&&floors>1&&!rear&&!garage){const fl=datum+floorH,wb=fl+.04,D=F.slabDepth;
        for(const r of e.runs){const rb=bays.filter(q=>q.r===r);if(!rb.length)continue;
          const u0=rb[0].u-rb[0].w/2-.35,u1=rb.at(-1).u+rb.at(-1).w/2+.35;
          const under=Math.max(...[u0,(u0+u1)/2,u1].map(v=>Math.max(g(v),gp(v,D))));
          if(wb-.14<under+F.clearUnder||u1-u0<1)continue;
          push('box',p,chunk,f.point((u0+u1)/2,wb-.07-SILL_DROP,D/2),f.angle,u1-u0,.14,D,trim);
          // Railing panels split midway between bays: a panel return never lands on a window reveal.
          const cuts=[u0+.04,...rb.slice(1).map((q,j)=>(q.u+rb[j].u)/2),u1-.04];for(let j=0;j+1<cuts.length;j++){const a=cuts[j],c=cuts[j+1];
            push('rail',p,chunk,f.point((a+c)/2,wb-SILL_DROP-.01,0),f.angle,c-a,1+SILL_DROP+.01,D-.04,rail);}
          stats.balconies++;}}
    }
    // Roof rooms / stair huts and tanks (Wikimedia Commons curid=99177715), aligned with the longest wall, clear of every earlier solid. The cap
    // sinks 1 cm into the room's walls and a tank sits 1 cm into the cap (no floating caps).
    if((kind==='town'||modern)&&!p.mixed&&p.area>35&&!garage){
      let best=null;ring.forEach((q,k)=>{const r=ring[(k+1)%ring.length],l=Math.hypot(r[0]-q[0],r[1]-q[1]);if(!best||l>best.l)best={l,ux:(r[0]-q[0])/l,uz:(r[1]-q[1])/l};});
      const ang=-Math.atan2(best.uz,best.ux),{ux,uz}=best,c=centre(p);
      // A 5×5 grid over the padded footprint (corner-only tests let a room bridge a light-well slot).
      const G5=[-1,-.5,0,.5,1],fits=(x,z,hx,hz,m)=>G5.every(a=>G5.every(d=>{const qx=x+ux*a*(hx+m)-uz*d*(hz+m),qz=z+uz*a*(hx+m)+ux*d*(hz+m);
        return inRing(qx,qz,ring)&&!b.holes.some(h=>inRing(qx,qz,h))&&!inSolid(qx,qz,b.roof+1);}));
      const room=p.area>70&&rnd(60)<(modern?.35:.55);
      if(room){const hx=Math.min(2.6,Math.sqrt(p.area)*.22),hz=Math.min(2.2,Math.sqrt(p.area)*.18),ox=(rnd(61)-.5)*Math.sqrt(p.area)*.3,oz=(rnd(62)-.5)*Math.sqrt(p.area)*.2;
        const x=c[0]+ux*ox-uz*oz,z=c[1]+uz*ox+ux*oz;
        if(hx>1&&hz>1&&fits(x,z,hx,hz,.6)){const hh=2.3+rnd(63)*.4,wallTop=b.roof-.05+hh;pushBoth([x,b.roof+hh/2-.05,z],ang,hx*2,hh,hz*2,wall,0,1);
          pushBoth([x,wallTop+.04,z],ang,hx*2+.24,.1,hz*2+.24,cap,0,1);stats.huts++;
          if(rnd(64)<.6)pushBoth([x+ux*hx*.4,wallTop+.08+.45,z+uz*hx*.4],ang,.9,.9,.9,lin(hex('#2b2e2f')),0,1);}}
      else if(rnd(65)<.45){const x=c[0]+ux*(rnd(66)-.5)*2,z=c[1]+uz*(rnd(66)-.5)*2;
        if(fits(x,z,.5,.5,.5)){pushBoth([x,b.roof+.5,z],ang,1,1.1,1,lin(hex(rnd(67)<.7?'#2b2e2f':'#d8d4c8')),0,1);stats.tanks++;}}}
    if(anyDressed)p.dressed=true;
  }
  // Cells: squares of FABRIC.cell m by part position (dense ids shared by all kinds).
  const ids=new Map(),[ox,oz]=F.cellOffset;
  for(const a of Object.values(parts))for(let o=0;o<a.length;o+=PART_STRIDE){const k=Math.floor((a[o+1]-ox)/F.cell)*100003+Math.floor((a[o+3]-oz)/F.cell);
    let id=ids.get(k);if(id===undefined)ids.set(k,id=ids.size);a[o]=id;}
  const out={};for(const [k,v] of Object.entries(parts))out[k]=Float32Array.from(v);
  const ms=Date.now()-t0;
  return {colliders:[],tops:[],cuts:[],tint:new Map(),surfaces:[],floorTriangles:[],places:[],
    buildingColours,fabric:{parts:out,leafTones:Float32Array.from(leafTones),glowPanes:Float32Array.from(glowList),boxRoof:Uint8Array.from(boxRoof),roles:Uint8Array.from(roles),chunks:ids.size,stats:{...stats,ms,skipped}},
    plansById:new Map(plans.map(p=>[p.id,{kind:p.kind,modern:p.modern,mixed:p.mixed,plazaEdges:p.plazaEdges,dressed:!!p.dressed}]))};
}
