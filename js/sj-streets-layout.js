/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// City-wide street ground and street dressing — © 2026 VibezZzCoder, MIT. Input geography: OSM / ODbL; heights: USGS DEM.
// area module. Registered after every geographic area and before `wallFoot`.
// Area contract: colliders (bollards, benches, tree trunks), tint (finished leftover ground), trees (the generic OSM trees it
// redraws), empty tops/cuts/surfaces/floorTriangles, plus its own fields drawn by sj-streets.js:
//   paved    — single-owner convex ground pieces [{ring,kind,hw,frame}] draped on the ORIGINAL terrain triangles (one
//              overlay layer, like sj-paving.js; nothing is stacked on another overlay) — carriageways, kerb+sidewalk
//              margins, lanes, squares and car parks. `frame` gives the street coordinates (across, along) the shader uses.
//   blocked  — per terrain cell: 1 when another owner's tint, water or private ground touches it (never paved).
//   lanterns, bollards, benches, palms, broadleaf — dressing records.
// Ownership: every older module and every area in `areas` is an owner (tops, cuts, surfaces, brick, floors, colliders,
// tints, private ground, point dressing), plus the Plaza de Armas detail box and the corridor's paved streets. Owned
// buildings: `ownedBuildings` and `buildingOverrides` of any area, read generically. Fitted walls of any area (`walls`
// stations with B/T/nx/nz): a 3 m band in front of every interval stays clear for the wall-foot strips.
// Physics: unchanged ground (drawn = physical triangles; sidewalks are flush — a deliberate simplification). Solids are
// small posts off the routes: bollards at pedestrian-lane mouths, bench boxes in squares, tree trunks beside streets.
import {signedArea,subtractRing,intersectRings} from './sj-paving.js';
const FREE_HW=280;  // half widths ≥ this are unkerbed (sj-streets.js FREE − 20)
const STOP_X0=CLOSE_X-7.1,STOP_X1=CLOSE_X-6.5;   // east-exit stop bar (paint ends at it)
// Sett → asphalt station lines (see the handoff block in runtimeLayout): Covadonga — both sett ways converging on node
// (647.0, 166.2), Calle Comercio 22227527 and 458535129, end on one line S before asphalt 60330127.
const MATERIAL_HANDOFFS=[[22227527,60330127,[645.5,163],[.9986,.052]],[458535129,60330127,[645.5,163],[.9986,.052]]];
import {convexPieces,GATE_BOUNDS} from './sj-gate-layout.js';
import {DETAIL_BOUNDS,inDetail,inRing,circle,createPlazaLayout} from './sj-plaza-layout.js';
import {createPavingRegions} from './sj-paving.js';
import {inCorridor} from './sj-corridor-layout.js';
import {GROUND_AREAS,BUILDING_PIECES} from './sj-streets-data.js';
import {CLOSE_X} from './sj-worldedge-layout.js';
import {loadCache,inflate,decodeLayout,runtimeCode} from './sj-streets-cache.js';
import {STREETS_CONTENT_KEY} from './sj-streets-cache-key.js';
import {GROUND_SPORTS} from './sj-ground-osm.js';

// Startup cache (sj-streets-cache.js): loaded and inflated once at module load; used by createStreetsLayout only when its
// key equals this build's content key (sources and data files). Otherwise (or SJ_STREETS_CACHE=0, ?streetscache=0) the
// runtime path below runs.
const CACHE=await (async()=>{const c=await loadCache(import.meta.url);if(!c)return null;try{c.payload=await inflate(c.deflated);}catch{return null;}
  return c.payload.length===c.size?c:null;})();
export const streetsCacheInfo=()=>CACHE?{digest:CACHE.digest,bytes:CACHE.deflated.length}:null;
// Cache key: the generated content key and the layout functions' own text.
let CODE=null;export const streetsCode=()=>CODE??=runtimeCode(STREETS_CONTENT_KEY,[createStreetsLayout,fromCache,runtimeLayout,bandSpan,dilate,grid,
  subtractAll,triangles,signedArea,subtractRing,intersectRings,convexPieces,createPlazaLayout,createPavingRegions,inCorridor,inRing,circle,inDetail]);

// Kind codes shared with the shader in sj-streets.js.
export const KIND={sett:0,asphalt:1,slab:2,concrete:3,brick:4,parking:5,cycle:6,steps:7,square:8,apron:9};
export const STREETS={kerb:.15,gutter:.3,fit:1.5,median:1.5,crownClear:1,clear:.8,apron:{reach:3.5,slope:.55,minRun:1},sidewalk:{primary:1.9,secondary:1.9,tertiary:1.6,primary_link:1.4,secondary_link:1.4,tertiary_link:1.4,
  residential:1.25,unclassified:1.25},wallBand:3,lanternHeight:3.4,lanternSpacing:11,cell:8};
const CARRIAGE={primary:0,secondary:1,primary_link:2,secondary_link:2,tertiary:3,tertiary_link:4,residential:5,unclassified:5,service:7};
const LANE={pedestrian:8,footway:9,cycleway:9,steps:9};
const SETT=new Set(['sett','cobblestone','paving_stones']);

const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function bbox(r){let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of r){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}return [a,b,c,d];}
const overlapBB=(a,b)=>a[0]<b[1]&&b[0]<a[1]&&a[2]<b[3]&&b[2]<a[3];
export function isConvex(r){if(r.length<3)return false;const s=Math.sign(signedArea(r));if(!s)return false;
  for(let i=0;i<r.length;i++)if(s*cross2(r[i],r[(i+1)%r.length],r[(i+2)%r.length])<-1e-9)return false;return true;}
const ccw=r=>signedArea(r)<0?[...r].reverse():r;
const usable=r=>r.length>=3&&Math.abs(signedArea(r))>1e-4;
function hull(pts){const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(p.length<3)return p;const lo=[],up=[];
  for(const q of p){while(lo.length>=2&&cross2(lo.at(-2),lo.at(-1),q)<=0)lo.pop();lo.push(q);}
  for(const q of [...p].reverse()){while(up.length>=2&&cross2(up.at(-2),up.at(-1),q)<=0)up.pop();up.push(q);}
  return [...lo.slice(0,-1),...up.slice(0,-1)];}
function grow(r,d){const cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length;
  return r.map(p=>{const dx=p[0]-cx,dz=p[1]-cz,l=Math.hypot(dx,dz)||1;return [p[0]+dx/l*d,p[1]+dz/l*d];});}
// Ear-clipped triangles of a simple ring (no merging: owner rings only need a convex cover; the merges cost most of
// convexPieces' time). Falls back to the hull when the ring is not simple (over-claims, never under-claims).
function triangles(ring){let pts=ring.filter((p,i)=>Math.hypot(p[0]-ring[(i+1)%ring.length][0],p[1]-ring[(i+1)%ring.length][1])>1e-6);
  if(signedArea(pts)<0)pts=[...pts].reverse();const out=[];let guard=pts.length*pts.length+8;
  const inside=(p,a,b,c)=>cross2(a,b,p)>1e-12&&cross2(b,c,p)>1e-12&&cross2(c,a,p)>1e-12;
  while(pts.length>3&&guard-->0){let clipped=false;
    for(let i=0;i<pts.length;i++){const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
      if(cross2(a,b,c)<=1e-12){if(Math.abs(cross2(a,b,c))<1e-9){pts.splice(i,1);clipped=true;break;}continue;}
      let ok=true;for(const p of pts)if(p!==a&&p!==b&&p!==c&&inside(p,a,b,c)){ok=false;break;}
      if(!ok)continue;out.push([a,b,c]);pts.splice(i,1);clipped=true;break;}
    if(!clipped)return [hull(ring)];}
  if(pts.length===3)out.push(pts);return out.filter(usable);}
function ownerPieces(r){if(!usable(r))return [];if(isConvex(r))return [ccw(r)];return triangles(r);}
// Convex pieces of any simple ring (falls back to its hull when the ring is not simple: over-claims, never under-claims).
function pieces(r){if(!usable(r))return [];if(isConvex(r))return [ccw(r)];try{return convexPieces(r).filter(usable);}catch{return [hull(r)];}}
// Subtract convex rings from convex pieces, skipping pieces whose bounding box misses the ring's (most of them).
// (Piece boxes are computed once per piece, not once per piece and item.)
function subtractAll(ps,items){let cur=ps.map(p=>[p,bbox(p)]);
  for(const it of items){const rb=it.bb??(it.bb=bbox(it.ring));const out=[];
    for(const e of cur){const pb=e[1];if(pb[1]<=rb[0]||rb[1]<=pb[0]||pb[3]<=rb[2]||rb[3]<=pb[2])out.push(e);else for(const r of subtractRing(e[0],it.ring))out.push([r,bbox(r)]);}
    cur=out;if(!cur.length)break;}return cur.map(e=>e[0]);}
function segDist(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*u,z-a[1]-dz*u);}

// out[q] = 1 iff some src[q + d·stride] (|d| ≤ D, index in range) is set: one prefix-sum pass per stride (same cells as
// the stencil loops it replaces, linear index as before).
function dilate(src,stride,D){const len=src.length,out=new Uint8Array(len);
  // One sequential pass per offset d·stride (|d| ≤ D): cache-friendly for the row stride too.
  for(let d=-D;d<=D;d++){const sh=d*stride,a=Math.max(0,-sh),b=Math.min(len,len-sh);for(let q=a;q<b;q++)if(src[q+sh])out[q]=1;}
  return out;}
// x range of a convex ring within the band za ≤ z ≤ zb (null when it misses the band), widened by 1 µm. Cells of a row
// outside it cannot touch the ring, so loops visit only the cells a piece can reach (same cells, same order, as walking
// its whole bounding box and discarding the rest).
export function bandSpan(r,za,zb){let lo=Infinity,hi=-Infinity;const n=r.length;
  for(let q=0;q<n;q++){const A=r[q],B=r[(q+1)%n];
    if(A[1]>=za&&A[1]<=zb){if(A[0]<lo)lo=A[0];if(A[0]>hi)hi=A[0];}
    if((A[1]-za)*(B[1]-za)<0){const x=A[0]+(B[0]-A[0])*(za-A[1])/(B[1]-A[1]);if(x<lo)lo=x;if(x>hi)hi=x;}
    if((A[1]-zb)*(B[1]-zb)<0){const x=A[0]+(B[0]-A[0])*(zb-A[1])/(B[1]-A[1]);if(x<lo)lo=x;if(x>hi)hi=x;}}
  return lo<=hi?[lo-1e-6,hi+1e-6]:null;}
// Engine-exact trigonometry (startup cache, ): Math.sin/cos/atan2 differ in the last bits between JavaScript
// engines (Node 24 and Chromium 156 already do), so the rings and probes this area emits use literal tables (written once
// from the same expressions): unit circles for the trunk/post/joint rings and the coast/relocation probe spirals. Dressing
// yaws keep atan2 but are rounded to 2⁻²⁰ rad (qYaw), so the last-bit differences between engines vanish.
const UNIT10=[[1,0],[0.8090169943749475,0.5877852522924731],[0.30901699437494745,0.9510565162951535],[-0.30901699437494734,0.9510565162951536],[-0.8090169943749473,0.5877852522924732],[-1,1.2246467991473532e-16],[-0.8090169943749475,-0.587785252292473],[-0.30901699437494756,-0.9510565162951535],[0.30901699437494723,-0.9510565162951536],[0.8090169943749473,-0.5877852522924734]],UNIT12=[[1,0],[0.8660254037844387,0.49999999999999994],[0.5000000000000001,0.8660254037844386],[6.123233995736766e-17,1],[-0.4999999999999998,0.8660254037844387],[-0.8660254037844387,0.49999999999999994],[-1,1.2246467991473532e-16],[-0.8660254037844388,-0.4999999999999997],[-0.5000000000000004,-0.8660254037844385],[-1.8369701987210297e-16,-1],[0.5000000000000001,-0.8660254037844386],[0.8660254037844384,-0.5000000000000004]],PROBE12=[[1,0],[0.866024791582939,0.5000010603626028],[0.4999978792725457,0.8660266281835431],[-0.0000036732051031245293,0.9999999999932537],[-0.5000042414459136,0.8660229549706501],[-0.8660284647724625,0.4999946981757423],[-0.9999999999730151,-0.000007346410206199498],[-0.8660211183466764,-0.5000074225224781],[-0.499991517072193,-0.8660303013496969],[0.000011019615309619434,-0.999999999939284],[0.5000106035922967,-0.8660192817110178],[0.8660321379152468,-0.4999883359618972]],SPIRAL12=[[1,0],[0.8660254037844387,0.49999999999999994],[0.5000000000000001,0.8660254037844386],[6.123233995736766e-17,1],[-0.4999999999999998,0.8660254037844387],[-0.8660254037844387,0.49999999999999994],[-1,1.2246467991473532e-16],[-0.8660254037844388,-0.4999999999999997],[-0.5000000000000004,-0.8660254037844385],[-1.8369701987210297e-16,-1],[0.5000000000000001,-0.8660254037844386],[0.8660254037844384,-0.5000000000000004]];
const UNIT32=[[1,0],[0.9807852804032304,0.19509032201612825],[0.9238795325112867,0.3826834323650898],[0.8314696123025452,0.5555702330196022],[0.7071067811865476,0.7071067811865475],[0.5555702330196023,0.8314696123025452],[0.38268343236508984,0.9238795325112867],[0.19509032201612833,0.9807852804032304],[6.123233995736766e-17,1],[-0.1950903220161282,0.9807852804032304],[-0.3826834323650897,0.9238795325112867],[-0.555570233019602,0.8314696123025453],[-0.7071067811865475,0.7071067811865476],[-0.8314696123025453,0.5555702330196022],[-0.9238795325112867,0.3826834323650899],[-0.9807852804032304,0.1950903220161286],[-1,1.2246467991473532e-16],[-0.9807852804032304,-0.19509032201612836],[-0.9238795325112868,-0.38268343236508967],[-0.8314696123025455,-0.555570233019602],[-0.7071067811865477,-0.7071067811865475],[-0.5555702330196022,-0.8314696123025452],[-0.38268343236509034,-0.9238795325112865],[-0.19509032201612866,-0.9807852804032303],[-1.8369701987210297e-16,-1],[0.1950903220161283,-0.9807852804032304],[0.38268343236509,-0.9238795325112866],[0.5555702330196018,-0.8314696123025455],[0.7071067811865474,-0.7071067811865477],[0.8314696123025452,-0.5555702330196022],[0.9238795325112865,-0.3826834323650904],[0.9807852804032303,-0.19509032201612872]];
const exactCircle=(x,z,r,U)=>U.map(([c,s])=>[x+c*r,z+s*r]);
const qYaw=v=>Math.round(v*1048576)/1048576;
// Uniform grid of items with a bounding box.
function grid(cell){const m=new Map(),key=(i,j)=>i*100003+j;let stamp=0;
  return {add(it){const [a,b,c,d]=it.bb;for(let i=Math.floor(a/cell);i<=Math.floor(b/cell);i++)for(let j=Math.floor(c/cell);j<=Math.floor(d/cell);j++){
      const k=key(i,j);let l=m.get(k);if(!l)m.set(k,l=[]);l.push(it);}},
    // Each item is returned once per query (a query stamp instead of a Set); the result is an array (with .size).
    query(bb){const out=[],q=++stamp;for(let i=Math.floor(bb[0]/cell);i<=Math.floor(bb[1]/cell);i++)for(let j=Math.floor(bb[2]/cell);j<=Math.floor(bb[3]/cell);j++){
      const l=m.get(key(i,j));if(l)for(const it of l)if(it._q!==q&&overlapBB(it.bb,bb)){it._q=q;out.push(it);}}
      out.size=out.length;return out;}};}

export function createStreetsLayout(args) {
  if(!args.noCache&&CACHE){const c=fromCache(args);if(c)return c;}
  return runtimeLayout(args);
}

// The cached layout: same data fields as the runtime path; the drawing tests (covered, draw-blocked cells, building
// masses) from the cache and the current tints; owner lookups and the strict cell test (tests only) from a lazy runtime run.
function fromCache(args){const t0=Date.now(),{city,terrain,surface,land,gate,fort,areas}=args;
  const before=surface.slice(),d=streetsCode();globalThis.__sjStreetsDigestParts?.push(['key',...d],['header',...CACHE.digest]);
  if(d[0]!==CACHE.digest[0]||d[1]!==CACHE.digest[1])return null;
  const {nx,nz}=terrain;let C;try{C=decodeLayout(CACHE.payload,nx*nz);}catch{return null;}
  for(const k of C.remapped)surface[k]=0;
  const others=[['gate',gate],['fort',fort],...Object.entries(areas)].filter(([,a])=>a);
  const tintMask=new Uint8Array(nx*nz);for(const [,a] of others)for(const m of [a.tint,a.tintOver])if(m?.size)for(const k of m.keys())if(Number.isInteger(k)&&k>=0&&k<tintMask.length)tintMask[k]=1;
  const T=k=>tintMask[k]===1,inGrid=(i,j)=>i>=0&&j>=0&&i<nx-1&&j<nz-1;
  const hard=(i,j)=>{if(!inGrid(i,j))return true;const k=j*nx+i;return !(land[k]&&land[k+1]&&land[k+nx]&&land[k+nx+1])||C.privateCells[k]===1;};
  const blockers={free:hard,relaxed:(i,j)=>inGrid(i,j)&&T(j*nx+i)&&T(j*nx+i+1)&&T(j*nx+i+nx)&&T(j*nx+i+nx+1)||hard(i,j),
    strict:(i,j)=>inGrid(i,j)&&(T(j*nx+i)||T(j*nx+i+1)||T(j*nx+i+nx)||T(j*nx+i+nx+1))||hard(i,j)};
  const bIdx=grid(16);city.buildings.forEach((b,i)=>bIdx.add({b,i,bb:bbox(b.outer)}));
  let full=null;const lazy=()=>full??=runtimeLayout({...args,surface:before.slice(),noCache:true});
  const ms=Date.now()-t0;
  const layout={droppedTrees:C.droppedTrees,paved:C.paved,ownedGround:C.ownedGround,covered:C.covered,remappedCells:[...C.remapped],
    blocked:null,cellBlocked:(i,j)=>lazy().cellBlocked(i,j),drawBlocked:(i,j,mode='relaxed')=>blockers[mode](i,j),
    ownerAt:(x,z)=>lazy().ownerAt(x,z),
    insideMass:(x,z)=>{for(const it of bIdx.query([x,x,z,z]))if(inRing(x,z,it.b.outer)&&!it.b.holes.some(h=>inRing(x,z,h)))return true;return false;},
    terrain,trees:C.trees,palms:C.palms,broadleaf:C.broadleaf,benches:C.benches,bollards:C.bollards,lanterns:C.lanterns,parks:C.parks,colliders:C.colliders,
    tops:[],cuts:[],surfaces:[],floorTriangles:[],places:[],constants:{STREETS,KIND}};
  layout.qa=()=>({...C.qa,ms,cached:true});
  return layout;
}

function runtimeLayout({city,detail,height,terrain,surface,land,gate,fort,corridor,isDry,areas}) {
  const S=STREETS,{x0,z0,step,nx,nz}=terrain,t0=Date.now(),prof={};let tp=t0;const mark=k=>{const n=Date.now();prof[k]=n-tp;tp=n;};
  const others=[['gate',gate],['fort',fort],...Object.entries(areas)].filter(([,a])=>a);

  // ---- Owner index: everything another module authored on or over the ground. ----
  const owners=grid(S.cell),ownerItems=[];let ownerRings=0;
  const own=(r,what)=>{for(const p of ownerPieces(r)){const it={ring:p,bb:bbox(p),what};owners.add(it);ownerItems.push(it);ownerRings++;}};
  const boxRing=c=>{const {x:cx,z:cz}=c.centre,{x:hx,z:hz}=c.halfExtents,r=c.rotationY??0,cs=Math.cos(r),sn=Math.sin(r);
    return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([u,v])=>[cx+u*cs+v*sn,cz-u*sn+v*cs]);};
  const points=[];  // other modules' point dressing (trees, lamps, benches…): kept clear by our own dressing
  const SKIP=new Set(['stations','walls','ends','places','runs','segs','segments','garitas','path','seaLine','wallLine']);
  for(const [key,a] of others){
    for(const t of a.tops??[])own(t.poly.map(p=>[p.x,p.z]),key+':top');
    for(const c of a.cuts??[])own(c.ring??[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]],key+':cut');
    for(const s of a.surfaces??[])own(s.ring,key+':surface');
    for(const s of a.brick??[])own(s.ring,key+':brick');
    for(const s of a.paved??[])own(s.ring,key+':paved');
    for(const f of a.floorTriangles??[])own(f.map(p=>[p[0],p[2]]),key+':floor');
    for(const c of a.colliders??[]){const r=c.outer?c.outer.map(p=>[p.x,p.z]):c.centre?boxRing(c):null;if(r)own(r,key+':collider');}
    for(const [field,v] of Object.entries(a)){if(SKIP.has(field)||!Array.isArray(v))continue;
      for(const o of v)if(o&&typeof o==='object'&&!Array.isArray(o)&&Number.isFinite(o.x)&&Number.isFinite(o.z)&&!o.outer)points.push([o.x,o.z]);}
    // Fitted walls (any area): the wall-foot strips (≤2.5 m) and the masonry behind them stay clear.
    for(const w of a.walls??[]){const s=w.a,e=w.b;if(!(s?.B&&s?.T&&e?.B&&e?.T&&Number.isFinite(s.nx)))continue;
      const fa=s.LB??s.B,fb=e.LB??e.B,n=[(s.nx+e.nx)/2,(s.nz+e.nz)/2],l=Math.hypot(...n)||1,d=S.wallBand/l;
      own(hull([s.T,e.T,s.B,e.B,fa,fb,[fa[0]+n[0]*d,fa[1]+n[1]*d],[fb[0]+n[0]*d,fb[1]+n[1]*d]]),key+':wallband');}}
  // Plaza de Armas and the corridor: their actual paving regions (sj-paving.js, the same inputs sj-plaza.js draws: the
  // residential streets inside DETAIL_BOUNDS, the corridor streets, the plaza square) and the plaza's own solids. The
  // ground around them is paved here up to those exact edges (no reserved 3 m band).
  const D=DETAIL_BOUNDS,plazaLayout=detail?createPlazaLayout({city,detail,height,terrain}):null;
  const plazaRing=detail?.plaza?.ring??GROUND_AREAS.find(g=>g.id===487051052)?.ring??[];
  if(plazaLayout){for(const r of createPavingRegions(detail,{paving:[...plazaLayout.paving,...(corridor?.paving??[])]}))own(r.ring,'plaza:paving');
    for(const c of plazaLayout.colliders){const r=c.outer?c.outer.map(p=>[p.x,p.z]):c.centre?boxRing(c):null;if(r)own(r,'plaza:collider');}}
  else if(plazaRing.length)own(plazaRing,'plaza:paving');
  // The corridor's own solids (cathedral steps and plinths, supported treads) are owners too.
  for(const c of corridor?.colliders??[]){const r=c.outer?c.outer.map(p=>[p.x,p.z]):c.centre?boxRing(c):null;if(r)own(r,'corridor:collider');}
  // …and, since the cathedral flight uses js/sj-stairs.js (2026-11-19), its drawn-only treads' support tops and render cuts.
  for(const t of corridor?.tops??[])own(t.poly.map(p=>[p.x,p.z]),'corridor:top');
  for(const c of corridor?.cuts??[])own(c.ring??[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]],'corridor:cut');
  const ownedAt=(x,z)=>{for(const it of owners.query([x,x,z,z]))if(inRing(x,z,it.ring))return it.what;return null;};

  mark('owners');
  // ---- Per-cell block map: another owner's tint on any corner, water, private ground. ----
  // Tinted grid vertices as one mask (tint keys are vertex indices; a non-integer key can never match a cell corner).
  const tintMask=new Uint8Array(nx*nz);for(const [,a] of others)for(const m of [a.tint,a.tintOver])if(m?.size)for(const k of m.keys())if(Number.isInteger(k)&&k>=0&&k<tintMask.length)tintMask[k]=1;
  const tinted=k=>tintMask[k]===1;
  const privates=others.map(([,a])=>a.offLimitsAt).filter(Boolean);
  const blocked=new Uint8Array(nx*nz); // 0 unknown, 1 free, 2 blocked
  // Private probes on a half-cell lattice (cell corners, edge midpoints, centres), each evaluated once and shared.
  // One lattice of state bits (startup): 1 = draw test done, 2 = draw-private (any of `drawPrivates`,
  // below), 4 = full test done, 8 = private (any area). Each private function runs at most once per lattice point, and
  // the draw path never runs the functions it does not need.
  const NX2=2*nx+1,priv=new Uint8Array(NX2*(2*nz+1));let drawPrivates=[],restPrivates=privates;
  const privDAt=(I,J)=>{const q=J*NX2+I;let st=priv[q];if(!(st&1)){const x=x0+I*step/2,z=z0+J*step/2,y=height(x,z);let hit=false;
      for(let f=0;f<drawPrivates.length&&!hit;f++)hit=!!drawPrivates[f](x,z,y);st|=hit?3:1;if(hit)st|=12;priv[q]=st;}return (st&2)!==0;};
  const privAt=(I,J)=>{const q=J*NX2+I;let st=priv[q];if(!(st&4)){if(privDAt(I,J))return true;st=priv[q];const x=x0+I*step/2,z=z0+J*step/2,y=height(x,z);let hit=false;
      for(let f=0;f<restPrivates.length&&!hit;f++)hit=!!restPrivates[f](x,z,y);st|=hit?12:4;priv[q]=st;}return (st&8)!==0;};
  const cellBlocked=(i,j)=>{if(i<0||j<0||i>=nx-1||j>=nz-1)return true;const k=j*nx+i;
    if(!blocked[k]){let b=!(land[k]&&land[k+1]&&land[k+nx]&&land[k+nx+1])||tinted(k)||tinted(k+1)||tinted(k+nx)||tinted(k+nx+1);
      if(!b&&privates.length)for(const [u,v] of [[1,1],[0,0],[2,0],[0,2],[2,2],[1,0],[0,1],[2,1],[1,2]]){if(privAt(2*i+u,2*j+v)){b=true;break;}}
      blocked[k]=b?2:1;}
    return blocked[k]===2;};
  // The private-free part of cellBlocked (water or any tinted corner), to test before costlier checks.
  const cheapBlocked=k=>!(land[k]&&land[k+1]&&land[k+nx]&&land[k+nx+1])||tinted(k)||tinted(k+1)||tinted(k+nx)||tinted(k+nx+1);
  // Drawn paving. Each piece gets a draw mode (set after placement, below):
  //  'free'    mapped carriageway cores: drawn through another owner's tint (a mapped road reads as a road; only water and
  //            private ground stop it) — the staircase of half-blocked cells along tinted lawns was the raw look;
  //  'relaxed' other pieces touching almost no fully tinted cell: a cell tinted on only some corners is a shared boundary
  //            cell, so the paving runs to its exact edge across it (skipping it left a 2 m sawtooth beside tinted lawns);
  //  'strict'  pieces running inside another owner's tinted finish (paths in a tinted lawn): whole cells as before.
  // The east closure's straight off-limits line (`closesEastExits`: x > closure.x − 0.45, sj-worldedge-layout.js) is an
  // exact owner edge (below) instead of whole blocked cells in every mode, so the street ends at the hoarding foot.
  const edgeLine=others.find(([,a])=>a.closesEastExits&&Number.isFinite(a.closure?.x));
  // Areas that publish their private ground as polygons (`privateRings`, e.g. uptown's Casa Blanca garden and courtyards):
  // those rings are exact owner edges (below), so the paving runs to the garden wall's foot instead of stopping a whole
  // cell short; their point test no longer blocks cells. Areas without polygons keep the cell rule.
  const ringed=new Set(others.filter(([,a])=>a.offLimitsAt&&Array.isArray(a.privateRings)&&a.privateRings.length).map(([k])=>k));
  drawPrivates=others.filter(([k,a])=>a.offLimitsAt&&k!==edgeLine?.[0]&&!ringed.has(k)).map(([,a])=>a.offLimitsAt);
  restPrivates=privates.filter(f=>!drawPrivates.includes(f));
  const tintAll=k=>tinted(k)&&tinted(k+1)&&tinted(k+nx)&&tinted(k+nx+1);
  // Water or (draw) private ground on a cell: blocked in every mode.
  const hard=new Uint8Array(nx*nz),hardBlocked=(i,j)=>{if(i<0||j<0||i>=nx-1||j>=nz-1)return true;const k=j*nx+i;
    if(!hard[k]){let b=!(land[k]&&land[k+1]&&land[k+nx]&&land[k+nx+1]);
      if(!b&&drawPrivates.length)for(const [u,v] of [[1,1],[0,0],[2,0],[0,2],[2,2],[1,0],[0,1],[2,1],[1,2]]){if(privDAt(2*i+u,2*j+v)){b=true;break;}}
      hard[k]=b?2:1;}
    return hard[k]===2;};
  const inGrid=(i,j)=>i>=0&&j>=0&&i<nx-1&&j<nz-1;
  const blockers={free:hardBlocked,relaxed:(i,j)=>inGrid(i,j)&&tintAll(j*nx+i)||hardBlocked(i,j),
    strict:(i,j)=>inGrid(i,j)&&(tinted(j*nx+i)||tinted(j*nx+i+1)||tinted(j*nx+i+nx)||tinted(j*nx+i+nx+1))||hardBlocked(i,j)};
  const drawBlocked=(i,j,mode='relaxed')=>blockers[mode](i,j);
  if(edgeLine){const X=edgeLine[1].closure.x-.45;own([[X,-2000],[X+60,-2000],[X+60,2000],[X,2000]],edgeLine[0]+':closure');}
  for(const [k,a] of others)if(ringed.has(k))for(const r of a.privateRings){const R=Array.isArray(r)?r:r.r??r.ring;if(R?.length>=3)own(R,k+':private');}

  mark('block');
  // Ground inside building masses is never seen: grid vertices inside a footprint (not in a courtyard hole). A terrain
  // triangle with all three vertices covered is not drawn (sj-streets.js).
  const covered=new Uint8Array(nx*nz);
  // Scanline fill per grid row (even-odd over the outer ring and its holes, as inRing): one pass per building.
  for(const b of city.buildings){const rings=[b.outer,...b.holes],[,,c,d]=bbox(b.outer);
    for(let j=Math.max(0,Math.ceil((c-z0)/step));j<=Math.min(nz-1,Math.floor((d-z0)/step));j++){const z=z0+j*step,xs=[];
      for(const r of rings)for(let q=0,p=r.length-1;q<r.length;p=q++){const A=r[q],B=r[p];if((A[1]>z)!==(B[1]>z))xs.push((B[0]-A[0])*(z-A[1])/(B[1]-A[1])+A[0]);}
      xs.sort((u,v)=>u-v);
      for(let e=0;e+1<xs.length;e+=2)for(let i=Math.max(0,Math.floor((xs[e]-x0)/step)+1);i<=Math.min(nx-1,Math.ceil((xs[e+1]-x0)/step)-1);i++){const x=x0+i*step;if(x>xs[e]&&x<xs[e+1])covered[j*nx+i]=1;}}}
  mark('covered');
  // ---- Regions (priority order decides who owns shared ground; the through street owns its crossings). ----
  const inputs=[];
  const roads=city.roads.map((r,index)=>({r,index})).filter(({r})=>r.kind in CARRIAGE||r.kind in LANE);
  const kindOf=r=>{const s=r.surface;
    if(r.kind in CARRIAGE)return SETT.has(s)?'sett':'asphalt';
    if(s==='dirt'||s==='grass')return null;if(r.kind==='cycleway')return 'cycle';
    // Mapped stairs (and the named stair streets, "Escalinata …"): tread cues on the same drape; physics unchanged.
    if(r.kind==='steps'||/^Escalinata/.test(r.name??''))return 'steps';
    if(s==='sett'||s==='cobblestone')return 'sett';if(s==='brick')return 'brick';if(s==='paving_stones')return 'slab';
    if(s==='asphalt'&&r.kind==='pedestrian')return 'asphalt';return 'concrete';};
  const lengthOf=r=>r.points.reduce((s,p,i)=>i?s+Math.hypot(p[0]-r.points[i-1][0],p[1]-r.points[i-1][1]):0,0);
  let roadOrder=0;
  // Cycle paths come first (a mapped cycle lane inside an avenue's width is drawn, not hidden under asphalt);
  // carriageways crossing them still own the crossing (below).
  const rankOf=r=>r.kind==='cycleway'?-1:CARRIAGE[r.kind]??LANE[r.kind];
  const sorted=roads.map(o=>({...o,rank:rankOf(o.r),len:lengthOf(o.r)})).sort((a,b)=>a.rank-b.rank||b.len-a.len||a.index-b.index);
  const carriage=[];   // [{a,b,hw}] centreline segments for clearance checks
  // Carriage centrelines first (for mapped separate sidewalks: footway segments running beside a carriageway are skipped,
  // since the street's own kerb + sidewalk margin draws them; re-added below wherever the margin did not cover them).
  const carPre=grid(16);for(const {r} of sorted)if(r.kind in CARRIAGE&&S.sidewalk[r.kind])for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];
    carPre.add({a,b,hw:r.width/2+S.kerb+S.sidewalk[r.kind],bb:[Math.min(a[0],b[0])-12,Math.max(a[0],b[0])+12,Math.min(a[1],b[1])-12,Math.max(a[1],b[1])+12]});}
  const besideStreet=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    for(const c of carPre.query([mx,mx,mz,mz])){const cx=c.b[0]-c.a[0],cz=c.b[1]-c.a[1],cl=Math.hypot(cx,cz)||1;
      if(Math.abs((dx*cx+dz*cz)/(l*cl))>.9&&segDist(mx,mz,c.a,c.b)<c.hw-.2&&segDist(a[0],a[1],c.a,c.b)<c.hw+.4&&segDist(b[0],b[1],c.a,c.b)<c.hw+.4)return true;}return false;};
  // Unnamed service aisles inside a mapped car park: the car-park surface draws them.
  const parkings=GROUND_AREAS.filter(g=>g.kind==='parking').map(g=>({ring:g.ring,bb:bbox(g.ring)}));
  const inParking=(a,b)=>{const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];return parkings.some(g=>m[0]>g.bb[0]&&m[0]<g.bb[1]&&m[1]>g.bb[2]&&m[1]<g.bb[3]&&inRing(m[0],m[1],g.ring)&&inRing(a[0],a[1],g.ring)&&inRing(b[0],b[1],g.ring));};
  // Building masses (precomputed convex pieces; areas' outline overrides recomputed): sidewalk margins are fitted to them.
  const outerOverride=new Map(others.flatMap(([,a])=>[...(a.buildingOverrides??[])].filter(([,o])=>o.outer).map(([id,o])=>[id,o.outer])));
  const masses=grid(S.cell);
  for(const [id,ps] of BUILDING_PIECES)for(const p of outerOverride.has(id)?pieces(outerOverride.get(id)):ps)masses.add({ring:p,bb:bbox(p)});
  for(const b of city.buildings)if(!BUILDING_PIECES.length)for(const p of pieces(b.outer))masses.add({ring:p,bb:bbox(p)});
  // Distance along a ray to the nearest building edge (frontage), or Infinity within `max`.
  const bEdges=grid(8);for(const b of city.buildings){const R=outerOverride.get(b.id)??b.outer;
    for(let i=0;i<R.length;i++){const p=R[i],q=R[(i+1)%R.length];bEdges.add({p,q,bb:[Math.min(p[0],q[0]),Math.max(p[0],q[0]),Math.min(p[1],q[1]),Math.max(p[1],q[1])]});}}
  const rayHit=(o,dir,max)=>{const e=[o[0]+dir[0]*max,o[1]+dir[1]*max];let best=Infinity;
    for(const it of bEdges.query([Math.min(o[0],e[0]),Math.max(o[0],e[0]),Math.min(o[1],e[1]),Math.max(o[1],e[1])])){
      const rx=it.q[0]-it.p[0],rz=it.q[1]-it.p[1],den=dir[0]*rz-dir[1]*rx;if(Math.abs(den)<1e-9)continue;
      const t=((it.p[0]-o[0])*rz-(it.p[1]-o[1])*rx)/den,u=((it.p[0]-o[0])*dir[1]-(it.p[1]-o[1])*dir[0])/den;
      if(t>=0&&t<=max&&u>=0&&u<=1)best=Math.min(best,t);}return best;};
  let sidewalkSkips=0;const skippedWalks=[];
  for(const {r,rank} of sorted){const kind=kindOf(r);if(!kind)continue;roadOrder++;
    if(r.id===311911403&&areas.perlaDistrict?.batterLine)continue;
    const P=r.points.filter((p,i)=>i===0||Math.hypot(p[0]-r.points[i-1][0],p[1]-r.points[i-1][1])>.05);if(P.length<2)continue;
    const hw=r.width/2,isCar=r.kind in CARRIAGE,side=isCar?S.sidewalk[r.kind]??0:0,G=side?S.gutter:0;
    const d=P.slice(1).map((p,i)=>{const dx=p[0]-P[i][0],dz=p[1]-P[i][1],l=Math.hypot(dx,dz);return [dx/l,dz/l,l];});
    const nrm=d.map(([ux,uz])=>[-uz,ux]);
    // Mitre at each vertex (bounded: a turn sharper than ~37° breaks into square ends plus a joint disc).
    const mit=P.map((p,i)=>{if(i===0)return {m:nrm[0],brk:false};if(i===P.length-1)return {m:nrm.at(-1),brk:false};
      const a=nrm[i-1],b=nrm[i],mx=a[0]+b[0],mz=a[1]+b[1],l=Math.hypot(mx,mz);if(l<1e-9)return {brk:true};
      const den=(mx*b[0]+mz*b[1])/l;return den>.8?{m:[mx/l/den,mz/l/den],brk:false}:{brk:true};});
    let along=0;
    for(let i=0;i<d.length;i++){const a=P[i],b=P[i+1],n=nrm[i];
      const ma=mit[i].brk?n:mit[i].m,mb=mit[i+1].brk?n:mit[i+1].m;
      const frame={o:a,u:[d[i][0],d[i][1]],n,along};
      const band=(lo,hi,sgn,hiA=hi,hiB=hi)=>{let q=[[a[0]+ma[0]*lo*sgn,a[1]+ma[1]*lo*sgn],[b[0]+mb[0]*lo*sgn,b[1]+mb[1]*lo*sgn],[b[0]+mb[0]*hiB*sgn,b[1]+mb[1]*hiB*sgn],[a[0]+ma[0]*hiA*sgn,a[1]+ma[1]*hiA*sgn]];
        if(!isConvex(q))q=[[a[0]+n[0]*lo*sgn,a[1]+n[1]*lo*sgn],[b[0]+n[0]*lo*sgn,b[1]+n[1]*lo*sgn],[b[0]+n[0]*hi*sgn,b[1]+n[1]*hi*sgn],[a[0]+n[0]*hi*sgn,a[1]+n[1]*hi*sgn]];
        return ccw(q);};
      if(r.kind==='footway'&&besideStreet(a,b)||r.kind==='service'&&!r.name&&inParking(a,b)){sidewalkSkips++;
        if(r.kind==='footway')skippedWalks.push({ring:band(-hw,hw,1),kind,hw:300,frame,prio:30e6+rank*1e6+roadOrder,road:r.id,lane:true,a,b});
        along+=d[i][2];continue;}
      // Carriageway core (to the gutter line); the gutter, kerb and sidewalk belong to the margins.
      inputs.push({ring:band(-(hw-G),hw-G,1),kind,hw:side?hw:300,frame,prio:rank*1e6+roadOrder,road:r.id,lane:!isCar,cycle:r.kind==='cycleway'});
      if(isCar)carriage.push({a,b,hw,road:r.id});
      if(side)for(const sg of [1,-1]){
        // Sidewalk fitted to the frontage: reaches a facade standing up to `fit` m beyond the nominal edge (else nominal);
        // building masses are subtracted, so a closer facade narrows it.
        const nominal=hw+S.kerb+side,fitTo=t=>{const o=[a[0]+(b[0]-a[0])*t+n[0]*sg*hw,a[1]+(b[1]-a[1])*t+n[1]*sg*hw];
          const h=hw+rayHit(o,[n[0]*sg,n[1]*sg],S.kerb+side+S.fit);return h<=nominal+S.fit?Math.max(nominal,h+.05):nominal;};
        const wm=fitTo(.5),outerA=Math.max(fitTo(.1),wm),outerB=Math.max(fitTo(.9),wm);
        inputs.push({ring:band(hw-G,Math.max(outerA,outerB),sg,outerA,outerB),kind,hw,frame,sg,prio:20e6+rank*1e6+roadOrder,road:r.id,margin:true});}
      along+=d[i][2];}
    // Joint discs where the mitre broke (core only).
    P.forEach((p,i)=>{if(!mit[i].brk)return;const ring=exactCircle(p[0],p[1],hw-G,UNIT12),u=d[Math.min(i,d.length-1)];
      inputs.push({ring:ccw(ring),kind,hw:300,frame:{o:p,u:[u[0],u[1]],n:[-u[1],u[0]],along:0},prio:rank*1e6+roadOrder,road:r.id,lane:!isCar});});
  }
  mark('roads');
  // Mapped squares (pedestrian areas, place=square) and car parks: their own surface, no street frame.
  const areaHits=GROUND_AREAS.map(g=>({...g,bb:bbox(g.ring),area:Math.abs(signedArea(g.ring))}));
  for(const g of areaHits){if(g.kind!=='square'&&g.kind!=='parking')continue;
    const kind=g.kind==='parking'?'parking':g.surface==='sett'||g.surface==='cobblestone'?'sett':g.surface==='concrete'?'concrete':'square';
    for(const p of g.pieces??pieces(g.ring))inputs.push({ring:p,kind,hw:300,frame:null,prio:(g.kind==='square'?10:40)*1e6+g.id%1e6,area:g.id});}
  inputs.sort((a,b)=>a.prio-b.prio);
  const dirDot=(p,q)=>Math.abs(p.frame.u[0]*q.frame.u[0]+p.frame.u[1]*q.frame.u[1]);
  // Cycle lanes give up only the carriageways that cross them (more than 30° apart): the street owns its crossing.
  {const cores=grid(S.cell);for(const i of inputs)if(!i.lane&&!i.margin&&i.frame&&!i.cycle){i.bb=bbox(i.ring);cores.add(i);}
    // (Constitución at 670,−49): the cycle lane ends SQUARE at each crossing — the crossing
    // takes the whole cross-lane band spanning its overlap (that band, minus the street's own core, is drawn as plain
    // carriageway of the crossing street), and a fragment left shorter than 4 m between two crossings joins the nearer
    // crossing. No angled paint tips, no holes between two link roads.
    const extras=new Map(),addExtra=(q,r)=>{if(!usable(r))return;if(!extras.has(q))extras.set(q,[]);extras.get(q).push(ccw(r));};
    const alongOf=(c,p)=>(p[0]-c.frame.o[0])*c.frame.u[0]+(p[1]-c.frame.o[1])*c.frame.u[1];
    const band=(c,a0,a1)=>{const {o,u,n}=c.frame,W=60;return ccw([[o[0]+u[0]*a0-n[0]*W,o[1]+u[1]*a0-n[1]*W],[o[0]+u[0]*a1-n[0]*W,o[1]+u[1]*a1-n[1]*W],
      [o[0]+u[0]*a1+n[0]*W,o[1]+u[1]*a1+n[1]*W],[o[0]+u[0]*a0+n[0]*W,o[1]+u[1]*a0+n[1]*W]]);};
    for(const c of inputs.filter(i=>i.cycle)){let ps=[c.ring];const cuts=[];
      for(const q of cores.query(bbox(c.ring))){if(dirDot(c,q)>.866)continue;
        const inter=intersectRings(c.ring,ccw(q.ring));if(!usable(inter))continue;
        const al=inter.map(p=>alongOf(c,p)),R=band(c,Math.min(...al),Math.max(...al));cuts.push({q,a0:Math.min(...al),a1:Math.max(...al)});
        const next=[];for(const p of ps){const inR=intersectRings(p,R);if(usable(inR))for(const e of subtractRing(inR,ccw(q.ring)))addExtra(q,e);next.push(...subtractRing(p,R));}
        ps=next.filter(usable);if(!ps.length)break;}
      if(cuts.length)ps=ps.filter(p=>{const al=p.map(v=>alongOf(c,v)),lo=Math.min(...al),hi=Math.max(...al);if(hi-lo>=4)return true;
        const mid=(lo+hi)/2,near=cuts.reduce((b,k)=>Math.abs((k.a0+k.a1)/2-mid)<Math.abs((b.a0+b.a1)/2-mid)?k:b);addExtra(near.q,p);return false;});
      // East closure (afternoon): the paint ends at a full-width pale stop bar 6.5–7.1 m before the
      // fence line (below); the lane beyond the bar is plain asphalt up to the barrier rows.
      ps=ps.flatMap(p=>subtractRing(p,[[STOP_X0,-1e4],[1e4,-1e4],[1e4,1e4],[STOP_X0,1e4]]));
      {const tail=intersectRings(c.ring,ccw([[STOP_X1,-1e4],[1e4,-1e4],[1e4,1e4],[STOP_X1,1e4]]));if(usable(tail))c.tail=ccw(tail);}
      c.rings=ps.filter(usable);}
    for(let i=inputs.length-1;i>=0;i--){const c=inputs[i];if(!c.tail)continue;
      inputs.splice(i+1,0,{ring:c.tail,kind:'asphalt',hw:300,frame:null,prio:c.prio,area:'stop-tail'});delete c.tail;}
    // The stop bar: one pale band across every carriageway and cycle lane crossing x = STOP_X0…STOP_X1 (the east exits),
    // placed before everything else (one input per crossing piece, so they never overlap each other).
    {const barRect=ccw([[STOP_X0,-1e4],[STOP_X1,-1e4],[STOP_X1,1e4],[STOP_X0,1e4]]),bars=[];
      for(const i of inputs)if((i.cycle||!i.lane&&!i.margin&&i.frame)&&i.ring){const b=bbox(i.ring);if(b[1]<STOP_X0||b[0]>STOP_X1)continue;
        const r=intersectRings(i.ring,barRect);if(usable(r))bars.push({ring:ccw(r),kind:'square',hw:300,frame:null,prio:-1e15,area:'stop-bar'});}
      inputs.unshift(...bars);}
    // The crossing streets' extra bands, placed right after each street's core (plain carriageway: half width beyond reach).
    for(let i=inputs.length-1;i>=0;i--){const q=inputs[i],ex=extras.get(q);if(!ex)continue;
      inputs.splice(i+1,0,{ring:q.ring,rings:ex,kind:q.kind,hw:q.hw<FREE_HW?q.hw+50:q.hw,frame:q.frame,prio:q.prio,road:q.road,crossing:true});}}
  // Corner kerbs: where two streets' sidewalk margins overlap, each keeps the part nearer its own kerb line (equal kerb
  // distance e = side·across − half-width is a straight line), so the two yellow kerbs meet in a mitred L at the corner
  // instead of one street's sidewalk owning the whole corner square.
  {const M=inputs.filter(i=>i.margin),idx=grid(S.cell);for(const m of M){m.bb=bbox(m.ring);idx.add(m);}
    const eLine=m=>{const {o,n}=m.frame;return [m.sg*n[0],m.sg*n[1],-m.sg*(o[0]*n[0]+o[1]*n[1])-m.hw];};  // e(p)=a·x+b·z+c
    const keepHalf=(ring,h)=>{const out=[];for(let i=0;i<ring.length;i++){const p=ring[i],r=ring[(i+1)%ring.length],dp=h[0]*p[0]+h[1]*p[1]+h[2],dr=h[0]*r[0]+h[1]*r[1]+h[2];
      if(dp<=0)out.push(p);if((dp<=0)!==(dr<=0)){const t=dp/(dp-dr);out.push([p[0]+(r[0]-p[0])*t,p[1]+(r[1]-p[1])*t]);}}return out;};
    const pos=new Map(inputs.map((x,i)=>[x,i]));
    for(const m of M){let ps=[m.ring];
      for(const q of idx.query(m.bb)){if(q===m||q.road===m.road)continue;
        const A=eLine(m),B=eLine(q),h=[B[0]-A[0],B[1]-A[1],B[2]-A[2]];if(Math.hypot(h[0],h[1])<1e-6)continue;
        // The part of q nearer q's kerb (e_q < e_m, i.e. e_q − e_m ≤ 0) is q's: m gives it up. Ties go to the earlier input.
        const theirs=keepHalf(q.ring,pos.get(q)<pos.get(m)?h:h.map(v=>v*(1-1e-12)));
        if(usable(theirs))ps=ps.flatMap(p=>subtractRing(p,ccw(theirs)));if(!ps.length)break;}
      m.cornerRings=ps.filter(usable);
      // Medians (Corretjer): where this sidewalk faces another carriageway's sidewalk across a
      // median narrower than STREETS.median (e_m + e_q < median: a half-plane), that sliver is carriageway, not a kerbed
      // island; the median starts with a blunt nose of that width instead of a needle point in the lane.
      let narrow=[];
      for(const q of idx.query(m.bb)){if(q===m||q.road===m.road)continue;
        const dn=m.sg*q.sg*(m.frame.n[0]*q.frame.n[0]+m.frame.n[1]*q.frame.n[1]);if(dn>-.7)continue;
        const A=eLine(m),B=eLine(q),h=[A[0]+B[0],A[1]+B[1],A[2]+B[2]-S.median];if(Math.hypot(h[0],h[1])<1e-6)continue;
        // …and only between the two carriageways (e_q ≥ −gutter: q's gutter and sidewalk side, not behind q's carriageway).
        // …and alongside q's own segment (its kerb line is only meaningful over the span its sidewalk covers).
        const hq=[-B[0],-B[1],-B[2]-S.gutter-.01],{o:qo,u:qu}=q.frame,qa=q.ring.map(p=>(p[0]-qo[0])*qu[0]+(p[1]-qo[1])*qu[1]);
        const h0=[-qu[0],-qu[1],qo[0]*qu[0]+qo[1]*qu[1]+Math.min(...qa)],h1=[qu[0],qu[1],-(qo[0]*qu[0]+qo[1]*qu[1])-Math.max(...qa)];
        const within=r=>{let a=r;for(const hh of [h,hq,h0,h1]){if(a.length<3)break;a=keepHalf(a,hh);}return a;};
        const cut=within(m.ring);if(!usable(cut))continue;const cr=ccw(cut);
        const next=[];for(const p of m.cornerRings){const inside=within(p);if(usable(inside))narrow.push(ccw(inside));next.push(...subtractRing(p,cr));}
        m.cornerRings=next.filter(usable);}
      if(narrow.length)m.narrow=narrow;}
    for(const m of M){m.rings=m.cornerRings;delete m.cornerRings;}
    // The median slivers become carriageway of the same street (kerbed material, half width beyond reach: plain core).
    for(let i=inputs.length-1;i>=0;i--){const m=inputs[i];if(!m.narrow)continue;
      inputs.splice(i+1,0,{ring:m.ring,rings:m.narrow,kind:m.kind,hw:m.hw+50,frame:m.frame,prio:m.prio,road:m.road,median:true});delete m.narrow;}}

  mark('inputs');
  // Single owner: each input minus every earlier input, then minus the other modules' ground (and, for sidewalk margins,
  // minus the building masses: the walk ends at the facade).
  const taken=grid(S.cell),paved=[];let order=0;
  const place=inp=>{let ps=inp.rings??[inp.ring];if(!ps.length)return;const bb=bbox(inp.rings?[inp.ring,...inp.rings].flat():inp.ring);
    ps=subtractAll(ps,[...taken.query(bb)].sort((a,b)=>a.n-b.n));
    if(ps.length)ps=subtractAll(ps,owners.query(bb));
    if(ps.length&&inp.margin)ps=subtractAll(ps,masses.query(bb));
    // Later inputs subtract this input's own region (after the corner split for margins).
    {const n=order++;for(const r of inp.rings??[inp.ring])taken.add({ring:r,bb:bbox(r),n});}
    // Orphan cycle-lane wedges left between crossings: under 2.5 m², dropped (the crossing owns the ground).
    for(const p of ps)if(usable(p)&&!(inp.kind==='cycle'&&Math.abs(signedArea(p))<2.5)&&!((inp.crossing||inp.median)&&Math.abs(signedArea(p))<.01))paved.push({ring:p,kind:inp.kind,hw:inp.hw,frame:inp.frame,road:inp.road,area:inp.area,margin:!!inp.margin&&inp.kind!=='apron'});};
  for(const inp of inputs)place(inp);
  // Mapped separate sidewalks skipped above: re-added (lowest priority) wherever their centreline is still uncovered.
  {const P=grid(S.cell);for(const p of paved)P.add({ring:p.ring,bb:bbox(p.ring)});
    const coveredAt=(x,z)=>{for(const it of P.query([x,x,z,z]))if(inRing(x,z,it.ring))return true;return !!ownedAt(x,z);};
    for(const w of skippedWalks){const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);let gap=false;
      for(let t=.5;t<L&&!gap;t+=1){const x=w.a[0]+(w.b[0]-w.a[0])*t/L,z=w.a[1]+(w.b[1]-w.a[1])*t/L;if(!coveredAt(x,z)&&isDry(x,z))gap=true;}
      if(gap){sidewalkSkips--;place(w);}}}
  mark('subtract');
  // ---- Leftover town ground. Grid cells of town substrate (pristine
  // class sidewalk/asphalt, not lawn or shore: those are `ground`'s natural classes), dry, untinted and unowned, gentle
  // (≤ 55 % grade), lying within `reach` of this area's paving AND within `reach` of a building, wall or another owner's
  // edge, are paved as a slab apron continuing the sidewalk to the building line: row runs of such cells become
  // rectangles, minus everything already placed, other owners and the building masses (lowest priority, exact edges).
  let apronPieces=0,islandArea=0;
  {const A=S.apron,R=A.reach,D=Math.ceil(R/step);
    // Cells whose centre this area paves, and building-covered vertices: dilated by `reach` (in cells).
    // (Per row, each edge's z term is computed once: the same products as the full expression.)
    const pc=new Uint8Array(nx*nz);for(const p of paved){const R=p.ring,n=R.length,[a,b,c,d]=bbox(R),sg=Math.sign(signedArea(R)),zt=new Float64Array(n),ex=new Float64Array(n),px=new Float64Array(n);
      for(let q=0;q<n;q++){const P=R[q],Q=R[(q+1)%n];ex[q]=Q[1]-P[1];px[q]=P[0];}
      for(let j=Math.max(0,Math.floor((c-z0)/step));j<=Math.min(nz-2,Math.floor((d-z0)/step));j++){const z=z0+(j+.5)*step,sp=bandSpan(R,z,z);if(!sp)continue;
        for(let q=0;q<n;q++){const P=R[q],Q=R[(q+1)%n];zt[q]=(Q[0]-P[0])*(z-P[1]);}
        for(let i=Math.max(0,Math.floor((a-x0)/step),Math.floor((sp[0]-x0)/step-.5));i<=Math.min(nx-2,Math.floor((b-x0)/step),Math.ceil((sp[1]-x0)/step-.5));i++){
          const x=x0+(i+.5)*step;let ok=true;for(let q=0;q<n;q++)if(sg*(zt[q]-ex[q]*(x-px[q]))<0){ok=false;break;}
          if(ok)pc[j*nx+i]=1;}}}
    mark('apronPc');
    // Edge mask: building-covered vertices and cells touched by another owner's piece (bounding boxes), dilated by D.
    // Natural lawn counts as an edge too (raw strips between the paving and the Capitol lawns).
    const edge=new Uint8Array(nx*nz);for(let k=0;k<covered.length;k++)if(covered[k]||surface[k]===2)edge[k]=1;
    // Union of the owners' boxes by per-row difference counts (same cells as filling every box).
    {const W1=nx+1,diff=new Int32Array(W1*nz);
      for(const it of ownerItems){const [a,b,c,d]=it.bb,i0=Math.max(0,Math.floor((a-x0)/step)),i1=Math.min(nx-1,Math.floor((b-x0)/step));if(i1<i0)continue;
        for(let j=Math.max(0,Math.floor((c-z0)/step));j<=Math.min(nz-1,Math.floor((d-z0)/step));j++){diff[j*W1+i0]++;diff[j*W1+i1+1]--;}}
      for(let j=0;j<nz;j++){let run=0;for(let i=0;i<nx;i++){run+=diff[j*W1+i];if(run>0)edge[j*nx+i]=1;}}}
    // Edge mask dilated by D cells once (separable, same linear-index stencil), instead of a 25-cell scan per candidate.
    const edgeNear=dilate(dilate(edge,1,D),nx,D);
    const near=(m,k)=>edgeNear[k]===1;
    mark('apronEdge');
    const cand=new Uint8Array(nx*nz),hts=terrain.heights,isle0=[];
    // Candidates: cells within D of a paved cell (dilation of the paved-cell mask), not paved themselves.
    // (Separable: the same linear-index offsets k+di+dj·nx as the square stencil, in two passes.)
    const zone=dilate(dilate(pc,1,D),nx,D);for(let q=0;q<zone.length;q++)if(!(q>nx&&q<nx*(nz-2)))zone[q]=0;
    for(let k=0;k<zone.length;k++){if(!zone[k]||pc[k])continue;const i=k%nx,j=(k-i)/nx;if(i<1||i>nx-3)continue;
      if(!(surface[k]===0||surface[k]===1)||covered[k]&&covered[k+1]&&covered[k+nx]&&covered[k+nx+1])continue;
      const g=Math.max(Math.abs(hts[k+1]-hts[k]),Math.abs(hts[k+nx]-hts[k]),Math.abs(hts[k+nx+1]-hts[k+1]),Math.abs(hts[k+nx+1]-hts[k+nx]))/step;if(g>A.slope)continue;
      const x=x0+(i+.5)*step,z=z0+(j+.5)*step;if(!near(edge,k)){isle0.push(k);continue;}if(cheapBlocked(k)||ownedAt(x,z)||cellBlocked(i,j))continue;cand[k]=1;}
    // Islands (raw mask islands at the Capitol, e.g. 704,−104 / 741,−277 / 846,−155): a connected patch of
    // town substrate enclosed by this area's paving alone (every outside neighbour is paved here), up to 1,200 m², is
    // finished the same way, wherever it lies.
    mark('apronCand');
    const okc=new Int8Array(nx*nz),ok=k=>{if(!okc[k]){const i=k%nx,j=(k-i)/nx;let v=i>=1&&i<=nx-3&&j>=1&&j<=nz-3&&!pc[k]&&(surface[k]===0||surface[k]===1)&&!(covered[k]&&covered[k+1]&&covered[k+nx]&&covered[k+nx+1]);
      if(v){const g=Math.max(Math.abs(hts[k+1]-hts[k]),Math.abs(hts[k+nx]-hts[k]),Math.abs(hts[k+nx+1]-hts[k+1]),Math.abs(hts[k+nx+1]-hts[k+nx]))/step;v=g<=A.slope&&!cheapBlocked(k)&&!ownedAt(x0+(i+.5)*step,z0+(j+.5)*step)&&!cellBlocked(i,j);}
      okc[k]=v?1:-1;}return okc[k]===1;};
    const seen=new Uint8Array(nx*nz),maxCells=Math.floor(1200/(step*step));let islandCells=0;
    // (inComp marks the current component: the same test as searching `comp`.)
    const inComp=new Uint8Array(nx*nz);   // 1 while a cell is in the component being grown (reset after each)
    for(const k0 of isle0){if(seen[k0]||cand[k0]||!ok(k0))continue;const comp=[k0];seen[k0]=1;inComp[k0]=1;let closed=true;
      for(let h=0;h<comp.length;h++){const k=comp[h];for(const q of [k-1,k+1,k-nx,k+nx]){if(seen[q]&&inComp[q])continue;
        if(ok(q)){if(!seen[q]){seen[q]=1;inComp[q]=1;comp.push(q);if(comp.length>maxCells){closed=false;break;}}}else if(!pc[q]){closed=false;}}
        if(!closed||comp.length>maxCells)break;}
      for(const k of comp)inComp[k]=0;
      if(closed&&comp.length<=maxCells){for(const k of comp)cand[k]=1;islandCells+=comp.length;}}
    islandArea=islandCells*step*step;
    mark('apronCells');
    let aprons=0;const open=new Map();  // span "i,e" → first row
    const emit=(i,e,j0,j1)=>{const xa=x0+i*step,xb=x0+(e+1)*step,za=z0+j0*step,zb=z0+(j1+1)*step,before=paved.length;
      place({ring:ccw([[xa,za],[xb,za],[xb,zb],[xa,zb]]),kind:'apron',hw:300,frame:null,area:'apron',margin:true});aprons+=paved.length-before;};
    for(let j=0;j<nz-1;j++){const spans=new Set();let i=0;
      while(i<nx-1){if(!cand[j*nx+i]){i++;continue;}let e=i;while(e+1<nx-1&&cand[j*nx+e+1])e++;spans.add(i+','+e);if(!open.has(i+','+e))open.set(i+','+e,j);i=e+1;}
      for(const [key,j0] of [...open])if(!spans.has(key)){const [a,b]=key.split(',').map(Number);emit(a,b,j0,j-1);open.delete(key);}}
    for(const [key,j0] of open){const [a,b]=key.split(',').map(Number);emit(a,b,j0,nz-2);}
    apronPieces=aprons;}
  mark('apron');
  // Draw modes (see drawBlocked): carriageway cores 'free'; other pieces 'strict' when more than 15 % of the cells whose
  // centre they cover (or the cell of their centroid) are tinted on all four corners by another owner, else 'relaxed'.
  {const carriageRoads=new Set(city.roads.filter(r=>r.kind in CARRIAGE).map(r=>r.id));
    // 16-cell blocks holding a fully tinted cell (from the tinted vertices): a piece whose box touches none is 'relaxed'
    // at once (a piece whose box does touch one is decided by the samples below, which give the same answer when its
    // own cells hold none).
    const BS=16,bw=Math.ceil(nx/BS),blk=new Uint8Array(bw*Math.ceil(nz/BS));
    for(let k=0;k<tintMask.length;k++)if(tintMask[k]){const i=k%nx,j=(k-i)/nx;   // k is the cell's first corner
      if(i<nx-1&&j<nz-1&&tintAll(k))blk[(j/BS|0)*bw+(i/BS|0)]=1;}
    const anyFull=(i0,i1,j0,j1)=>{for(let b=j0/BS|0;b<=(j1/BS|0);b++)for(let a=i0/BS|0;a<=(i1/BS|0);a++)if(blk[b*bw+a])return true;return false;};
    for(const p of paved){if(!p.margin&&p.frame&&carriageRoads.has(p.road)&&(p.kind==='sett'||p.kind==='asphalt')){p.mode='free';continue;}
      const R=p.ring,n=R.length,[a,b,c,d]=bbox(R),sg=Math.sign(signedArea(R));let tot=0,full=0;
      {const i0=Math.max(0,Math.floor((a-x0)/step)),i1=Math.min(nx-2,Math.floor((b-x0)/step)),j0=Math.max(0,Math.floor((c-z0)/step)),j1=Math.min(nz-2,Math.floor((d-z0)/step));
        if(i1<i0||j1<j0||!anyFull(i0,i1,j0,j1)){p.mode='relaxed';continue;}}
      // (A large piece is sampled on a coarser cell stride: about a hundred cell centres at most.)
      const ci0=Math.max(0,Math.floor((a-x0)/step)),ci1=Math.min(nx-2,Math.floor((b-x0)/step)),cj0=Math.max(0,Math.floor((c-z0)/step)),cj1=Math.min(nz-2,Math.floor((d-z0)/step));
      const st=Math.max(1,Math.ceil(Math.sqrt((ci1-ci0+1)*(cj1-cj0+1)/100)));
      for(let j=cj0;j<=cj1;j+=st)for(let i=ci0;i<=ci1;i+=st){
        const x=x0+(i+.5)*step,z=z0+(j+.5)*step;let ok=true;for(let q=0;q<n&&ok;q++){const P=R[q],Q=R[(q+1)%n];if(sg*((Q[0]-P[0])*(z-P[1])-(Q[1]-P[1])*(x-P[0]))<0)ok=false;}
        if(ok){tot++;if(tintAll(j*nx+i))full++;}}
      if(!tot){const cx=R.reduce((s,q)=>s+q[0],0)/n,cz=R.reduce((s,q)=>s+q[1],0)/n,i=Math.floor((cx-x0)/step),j=Math.floor((cz-z0)/step);
        tot=1;if(i>=0&&j>=0&&i<nx-1&&j<nz-1&&tintAll(j*nx+i))full=1;}
      p.mode=full>.15*tot?'strict':'relaxed';}}
  mark('modes');
  // a small mapped-path piece (< 6 m²) enclosed by carriageway — every probe
  // 0.3 m outside each of its edges lies on a carriageway core — is drawn as plain carriageway of that street (it read as
  // stray paving inside the junction).
  {const carriageRoads=new Set(city.roads.filter(r=>r.kind in CARRIAGE).map(r=>r.id)),idx=grid(S.cell);
    const isCore=p=>!p.margin&&p.frame&&carriageRoads.has(p.road)&&(p.kind==='sett'||p.kind==='asphalt');
    const small=p=>!p.margin&&!isCore(p)&&['concrete','slab','brick','square','steps'].includes(p.kind)&&p.road!==undefined&&Math.abs(signedArea(p.ring))<6;
    for(const p of paved)if(isCore(p)||p.margin&&carriageRoads.has(p.road)||small(p))idx.add({p,bb:bbox(p.ring)});
    const at=(x,z)=>{for(const it of idx.query([x,x,z,z]))if(inRing(x,z,it.p.ring))return it.p;return null;};
    // Probes may land on a carriageway core, a carriageway's own kerb/sidewalk margin, or another small piece of the same
    // path (one sliver split by a seam); at least one must land on a core, which becomes the host.
    const relabel=[];
    for(const p of paved){if(!small(p))continue;const R=p.ring,sg=Math.sign(signedArea(R));let host=null,ok=true;
      for(let q=0;q<R.length&&ok;q++){const A=R[q],B=R[(q+1)%R.length],l=Math.hypot(B[0]-A[0],B[1]-A[1]);if(l<1e-3)continue;
        const nx_=sg*(B[1]-A[1])/l,nz_=-sg*(B[0]-A[0])/l;
        for(const t of [.25,.5,.75]){const c=at(A[0]+(B[0]-A[0])*t+nx_*.3,A[1]+(B[1]-A[1])*t+nz_*.3);
          if(!c||!(isCore(c)||c.margin||small(c)&&c.road===p.road)){ok=false;break;}if(!host&&isCore(c))host=c;}}
      if(ok&&host)relabel.push([p,host]);}
    for(const [p,host] of relabel)Object.assign(p,{kind:host.kind,hw:host.hw<40?host.hw+50:host.hw,frame:host.frame,road:host.road,area:undefined,margin:false,mode:'free'});}
  // Material handoffs (Covadonga): where a mapped sett way runs into an asphalt way, one
  // station line perpendicular to the through alignment ends the setts; the converging part beyond it is drawn as the
  // asphalt way (kerbed or margin piece alike). The adjoining owner's apron returns along the same line
  // [sett way, asphalt way, station point, through direction].
  for(const [from,to,[sx,sz],[dx,dz]] of MATERIAL_HANDOFFS){
    const ahead=ccw([[sx-dz*60,sz+dx*60],[sx+dz*60,sz-dx*60],[sx+dz*60+dx*60,sz-dx*60+dz*60],[sx-dz*60+dx*60,sz+dx*60+dz*60]]);
    const behind=ccw([[sx-dz*60,sz+dx*60],[sx+dz*60,sz-dx*60],[sx+dz*60-dx*60,sz-dx*60-dz*60],[sx-dz*60-dx*60,sz+dx*60-dz*60]]);
    const host=m=>paved.find(q=>q.road===to&&!!q.margin===m);
    for(let i=paved.length-1;i>=0;i--){const p=paved[i];if(p.road!==from)continue;const a=intersectRings(p.ring,ahead);if(!usable(a))continue;
      const h=host(!!p.margin);if(!h)continue;const b=intersectRings(p.ring,behind);
      const moved={...p,ring:ccw(a),kind:h.kind,hw:h.hw,frame:h.frame,road:to,mode:h.mode};
      if(usable(b)){p.ring=ccw(b);paved.splice(i+1,0,moved);}else paved[i]=moved;}}
  // Cycle lane ends (−49; second pass). A free end is a piece edge about the
  // lane's width that no other piece of the same lane shares and that does not already meet a pale bar (the east exits).
  // Two free ends of the same lane facing each other across a junction (≤ 25 m) are joined: the lane is painted straight
  // across as a marked crossing (dashed 1 m marks cut out of the carriageway pieces under it), so the far-side start
  // never reads as a loose orange island. Every other free end gets a 0.5 m pale bar cut into the paint (a marked stop).
  {const cyc=paved.filter(p=>p.kind==='cycle'&&!p.margin),W=new Map(city.roads.map(r=>[r.id,r.width])),near=(a,b)=>Math.abs(a[0]-b[0])<.05&&Math.abs(a[1]-b[1])<.05;
    const shared=(p,A,B)=>cyc.some(q=>q!==p&&q.road===p.road&&q.ring.some(v=>near(v,A))&&q.ring.some(v=>near(v,B)));
    const pieceAt=(x,z)=>paved.find(q=>{const b=bbox(q.ring);return x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3]&&inRing(x,z,q.ring);});
    const ends=[];
    for(const p of cyc){const w=W.get(p.road)??2.5;
      for(let e=0;e<p.ring.length;e++){const R=p.ring,A=R[e],B=R[(e+1)%R.length],l=Math.hypot(B[0]-A[0],B[1]-A[1]);if(Math.abs(l-w)>.6||shared(p,A,B))continue;
        const sg=Math.sign(signedArea(R)),ix=-sg*(B[1]-A[1])/l,iz=sg*(B[0]-A[0])/l,mx=(A[0]+B[0])/2,mz=(A[1]+B[1])/2;   // ix,iz: into the piece
        if(!inRing(mx+ix*.3,mz+iz*.3,R))continue;const out=pieceAt(mx-ix*.15,mz-iz*.15);if(out&&out.kind==='square')continue;
        ends.push({p,A,B,ix,iz,mx,mz});break;}}
    const paired=new Set();
    for(const a of ends)for(const b of ends){if(a===b||paired.has(a)||paired.has(b)||a.p.road!==b.p.road)continue;
      const d=Math.hypot(b.mx-a.mx,b.mz-a.mz);
      if(d>25||a.ix*b.ix+a.iz*b.iz>-.9||(b.mx-a.mx)*a.ix+(b.mz-a.mz)*a.iz>-d*.9)continue;
      // (Sol confirmation): the crossing is drawn as dashed marks — 1 m blocks the lane's width, square to
      // the path, with 1 m of plain carriageway between them — not as one solid fill (it read as a patch from the side).
      const [b1,b2]=Math.hypot(b.A[0]-a.A[0],b.A[1]-a.A[1])<Math.hypot(b.B[0]-a.A[0],b.B[1]-a.A[1])?[b.A,b.B]:[b.B,b.A];
      const n=Math.max(1,Math.floor((d+1)/2)),off=(d-(2*n-1))/2,lerp=(P,Q,t)=>[P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t];
      for(let m=0;m<n;m++){const t0=(off+2*m)/d,t1=Math.min(1,(off+2*m+1)/d);
        const mark=ccw(hull([lerp(a.A,b1,t0),lerp(a.B,b2,t0),lerp(a.A,b1,t1),lerp(a.B,b2,t1)]));if(!usable(mark))continue;const bb=bbox(mark);
        for(let k=paved.length-1;k>=0;k--){const q=paved[k];if(q===a.p||q===b.p||q.area==='cycle-crossing')continue;const bq=bbox(q.ring);
          if(bq[1]<bb[0]||bq[0]>bb[1]||bq[3]<bb[2]||bq[2]>bb[3]||!usable(intersectRings(q.ring,mark)))continue;
          paved.splice(k,1,...subtractRing(q.ring,mark).filter(usable).map(r=>({...q,ring:ccw(r)})));}
        paved.push({...a.p,ring:mark,area:'cycle-crossing'});}
      paired.add(a);paired.add(b);}
    for(const e of ends){if(paired.has(e))continue;const {p,A,B,ix,iz}=e,R=p.ring;
      const bar=ccw([A,B,[B[0]+ix*.5,B[1]+iz*.5],[A[0]+ix*.5,A[1]+iz*.5]]),cutBar=intersectRings(R,bar);if(!usable(cutBar))continue;
      const rest=intersectRings(R,ccw([[A[0]+ix*.5-(B[0]-A[0])*40,A[1]+iz*.5-(B[1]-A[1])*40],[B[0]+ix*.5+(B[0]-A[0])*40,B[1]+iz*.5+(B[1]-A[1])*40],
        [B[0]+ix*80+(B[0]-A[0])*40,B[1]+iz*80+(B[1]-A[1])*40],[A[0]+ix*80-(B[0]-A[0])*40,A[1]+iz*80-(B[1]-A[1])*40]]));
      if(!usable(rest))continue;p.ring=ccw(rest);paved.push({...p,ring:ccw(cutBar),kind:'square',area:'cycle-end'});}}
  // Riding feel = the raster class mask (sampler groundMask), not the drawn paving: a lawn-class cell (2) at least 2/16
  // covered by this area's drawn paving (4×4 supersample; never a blocked cell) rides as pavement (0). Shared contract
  // with bahia (B04): the mask is mutated in place before the sampler is built; nulling this
  // area restores it. Only lawn → pavement; other classes are left as mapped.
  // True when one edge of the convex ring has the whole cell [cx, cx+step]×[cz, cz+step] outside it.
  const cellOut=(R,sg,cx,cz)=>{for(let q=0;q<R.length;q++){const A=R[q],B=R[(q+1)%R.length],ex=B[0]-A[0],ez=B[1]-A[1];let out=true;
      for(const [x,z] of [[cx,cz],[cx+step,cz],[cx,cz+step],[cx+step,cz+step]])if(sg*(ex*(z-A[1])-ez*(x-A[0]))>0){out=false;break;}
      if(out)return true;}return false;};
  const classCount=new Map(),mineCount=new Map();let remapped=0;
  for(const p of paved){const [a,b,c,d]=bbox(p.ring),sgn=Math.sign(signedArea(p.ring)),blk=blockers[p.mode];
    const inP=(x,z)=>{for(let q=0;q<p.ring.length;q++){const A=p.ring[q],B=p.ring[(q+1)%p.ring.length];if(sgn*((B[0]-A[0])*(z-A[1])-(B[1]-A[1])*(x-A[0]))<=0)return false;}return true;};
    for(let j=Math.floor((c-z0)/step);j<=Math.floor((d-z0)/step);j++){const sp=bandSpan(p.ring,z0+j*step,z0+(j+1)*step);if(!sp)continue;
     for(let i=Math.max(Math.floor((a-x0)/step),Math.floor((sp[0]-x0)/step)-1);i<=Math.min(Math.floor((b-x0)/step),Math.floor((sp[1]-x0)/step)+1);i++){
      if(i<0||j<0||i>=nx-1||j>=nz-1)continue;const k=j*nx+i;if(surface[k]!==2||blk(i,j))continue;
      const cx=x0+i*step,cz=z0+j*step;
      if(inP(cx,cz)&&inP(cx+step,cz)&&inP(cx,cz+step)&&inP(cx+step,cz+step)){mineCount.set(k,(mineCount.get(k)??0)+16);continue;}
      let hit=0;for(let v=0;v<4;v++)for(let u=0;u<4;u++)if(inP(x0+(i+(u+.5)/4)*step,z0+(j+(v+.5)/4)*step))hit++;
      // A sliver between the samples: any drawn overlap of the cell rides as pavement too.
      if(!hit&&!cellOut(p.ring,sgn,cx,cz)){let poly=p.ring;for(const [ax,az,c] of [[1,0,-cx],[-1,0,cx+step],[0,1,-cz],[0,-1,cz+step]]){const o=[];
          for(let q=0;q<poly.length;q++){const A=poly[q],B=poly[(q+1)%poly.length],da=ax*A[0]+az*A[1]+c,db=ax*B[0]+az*B[1]+c;
            if(da>=0)o.push(A);if((da>=0)!==(db>=0)){const t=da/(da-db);o.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]);}}poly=o;if(poly.length<3)break;}
        if(poly.length>=3&&Math.abs(signedArea(poly))>1e-4)hit=1;}
      if(hit)mineCount.set(k,(mineCount.get(k)??0)+hit);}}}
  // (This area's paving is not drawn on cells blocked for its piece's draw mode: skipped above.)
  for(const [k,n] of mineCount)if(n>=1)classCount.set(k,Math.max(n,2));
  mark('remapMine');
  // Earlier areas' drawn paving inside a mapped street corridor (centreline ± half-width + 3 m) counts too, also on cells
  // their own tint blocks for this area (bahia left 172 concrete samples beside PR-1 riding as grass for `streets`).
  {const segs=grid(16);for(const r of city.roads)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],h=r.width/2+3;
      segs.add({a,b,h,bb:[Math.min(a[0],b[0])-h,Math.max(a[0],b[0])+h,Math.min(a[1],b[1])-h,Math.max(a[1],b[1])+h]});}
    const inCorridor=(x,z)=>{for(const s of segs.query([x,x,z,z]))if(segDist(x,z,s.a,s.b)<s.h)return true;return false;};
    const theirs=others.flatMap(([,a])=>[...(a.surfaces??[]),...(a.brick??[]),...(a.paved??[])]).map(s=>s.ring).filter(r=>r?.length>=3);
    const seen=new Map();
    for(const r of theirs){const [a,b,c,d]=bbox(r);
      for(let j=Math.floor((c-z0)/step);j<=Math.floor((d-z0)/step);j++)for(let i=Math.floor((a-x0)/step);i<=Math.floor((b-x0)/step);i++){
        if(i<0||j<0||i>=nx-1||j>=nz-1)continue;const k=j*nx+i;if(surface[k]!==2)continue;
        if(!seen.has(k))seen.set(k,inCorridor(x0+(i+.5)*step,z0+(j+.5)*step)&&land[k]&&land[k+1]&&land[k+nx]&&land[k+nx+1]);if(!seen.get(k))continue;
        for(let v=0;v<4;v++)for(let u=0;u<4;u++)if(inRing(x0+(i+(u+.5)/4)*step,z0+(j+(v+.5)/4)*step,r))classCount.set(k,(classCount.get(k)??0)+1);}}}
  const remappedCells=[];for(const [k,n] of classCount)if(n>=2&&surface[k]===2){surface[k]=0;remapped++;remappedCells.push(k);}
  // Leftover ground colour belongs to the `ground` package (sj-world.js vertexColour): this area sets no terrain tint.
  mark('tint');
  // ---- Dressing. Clearance helpers. ----
  const carIdx=grid(16);for(const c of carriage)carIdx.add({...c,bb:[Math.min(c.a[0],c.b[0])-c.hw-6,Math.max(c.a[0],c.b[0])+c.hw+6,Math.min(c.a[1],c.b[1])-c.hw-6,Math.max(c.a[1],c.b[1])+c.hw+6]});
  const nearestCar=(x,z)=>{let best=null;for(const c of carIdx.query([x,x,z,z])){const dd=segDist(x,z,c.a,c.b)-c.hw;if(!best||dd<best.d)best={d:dd,c};}return best;};
  const bIdx=grid(16);city.buildings.forEach((b,i)=>bIdx.add({b,i,bb:bbox(b.outer)}));
  const inBuilding=(x,z,r=0)=>{for(const it of bIdx.query([x-r,x+r,z-r,z+r])){if(inRing(x,z,it.b.outer))return true;
    if(r)for(let q=0;q<it.b.outer.length;q++)if(segDist(x,z,it.b.outer[q],it.b.outer[(q+1)%it.b.outer.length])<r)return true;}return false;};
  const ptIdx=grid(8);for(const [x,z] of points)ptIdx.add({bb:[x,x,z,z]});
  const clearOf=(x,z,r)=>{if(ownedAt(x,z))return false;for(const it of owners.query([x-r,x+r,z-r,z+r]))for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]])if(inRing(x+dx,z+dz,it.ring))return false;
    return ptIdx.query([x-r,x+r,z-r,z+r]).size===0&&isDry(x,z)&&!cellBlocked(Math.floor((x-x0)/step),Math.floor((z-z0)/step));};
  const colliders=[],prism=(outer,minY,maxY)=>({outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support:false});

  mark('dressidx');
  // Every mapped line with its width: solids keep their whole footprint outside the mapped width and ≥ STREETS.clear
  // from the centreline, measured to the shape, not its centre.
  const allSegs=grid(16);for(const r of city.roads)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];
    allSegs.add({a,b,w:r.width,bb:[Math.min(a[0],b[0])-6,Math.max(a[0],b[0])+6,Math.min(a[1],b[1])-6,Math.max(a[1],b[1])+6]});}
  const need=s=>Math.max(S.clear,s.w/2);
  const nearRoadLine=(x,z,r)=>{for(const s of allSegs.query([x-r,x+r,z-r,z+r]))if(segDist(x,z,s.a,s.b)<r)return true;return false;};
  const circleClear=(x,z,r)=>{for(const s of allSegs.query([x,x,z,z]))if(segDist(x,z,s.a,s.b)<need(s)+r)return false;return true;};
  const segSeg=(p,q,a,b)=>{const c=(o,u,v)=>(u[0]-o[0])*(v[1]-o[1])-(u[1]-o[1])*(v[0]-o[0]);
    if(c(p,q,a)*c(p,q,b)<0&&c(a,b,p)*c(a,b,q)<0)return 0;return Math.min(segDist(...p,a,b),segDist(...q,a,b),segDist(...a,p,q),segDist(...b,p,q));};
  const ringClear=ring=>{const bb=bbox(ring);for(const s of allSegs.query(bb)){if(inRing(s.a[0],s.a[1],ring))return false;
    for(let i=0;i<ring.length;i++)if(segSeg(ring[i],ring[(i+1)%ring.length],s.a,s.b)<need(s))return false;}return true;};
  // Trees: every OSM tree no other module draws (Plaza de Armas trees stay with the plaza). Palms on the coast, else broadleaf.
  // A mapped point standing in a mapped way, a building or another owner's ground moves to the nearest free spot within
  // 6 m (trunk clear of every way, 0.6 m off facades); with none, the tree is not drawn.
  const areaTrees=new Set(others.flatMap(([,a])=>(a.trees??[]).map(t=>t.x+','+t.z)));
  const trees=[],palms=[],broadleaf=[],droppedTrees=[];let treesMoved=0,treesDropped=0;
  const coastal=(x,z)=>{for(let a=0;a<12;a++)for(const r of [12,24])if(!isDry(x+PROBE12[a][0]*r,z+PROBE12[a][1]*r))return true;return false;};
  const treeOK=(x,z)=>circleClear(x,z,.3)&&!inBuilding(x,z,.6)&&isDry(x,z)&&!ownedAt(x,z)&&!cellBlocked(Math.floor((x-x0)/step),Math.floor((z-z0)/step))&&clearOf(x,z,.6);
  const placed=[];
  // Crown fit: the broadleaf crown reaches ~4.1 m × scale from the trunk. Near a facade the
  // crown keeps STREETS.crownClear (1 m: balconies and slabs protrude ≤ 0.85 m, fabric maxProtrude) off the building line:
  // the crown is narrowed ACROSS the facade (instance x axis turned to the facade normal, x scale ≥ 0.3) — a street tree
  // pruned back from the balconies — and its overall scale is kept (≥ 0.5) so it still reads as a shade tree.
  const facade=(x,z,max)=>{let best=null;for(const it of bIdx.query([x-max,x+max,z-max,z+max])){const R=it.b.outer;
      for(let q=0;q<R.length;q++){const a=R[q],b=R[(q+1)%R.length],d=segDist(x,z,a,b);if(d<max&&(!best||d<best.d)){const ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1;best={d,n:[-ez/l,ex/l]};}}}
    return best;};
  let crownsFitted=0;
  // Reserved play ground: every area's `sportsRings`
  // (seams contract: ring includes its apron) and the mapped pitches/playgrounds (whole polygon + 0.5 m) and running-track
  // lanes (outline ± 6 m) of GROUND_SPORTS (ground's generated OSM table). Nothing streets plants or places stands on it
  // or reaches over it. Broadleaf crowns are tested by their whole drawn footprint (32 points, the kit's 4.0 m lobe reach
  // × sx across / × scale along, at the instance yaw) against reserved ground and against every drawn building mass
  // (area override outlines included) whose height overlaps the crown, keeping STREETS.crownClear (balconies ≤ 0.85 m)
  // off it. A crown that cannot be fitted (scale ≥ 0.55, across ≥ 0.3) moves its tree, or the tree is not drawn.
  const sport=grid(16);
  for(const [,a] of others)for(const r of a.sportsRings??[])if(r?.ring?.length>=3)sport.add({ring:r.ring,m:0,bb:bbox(r.ring)});
  for(const [,kind,,,ring] of GROUND_SPORTS){if(kind!=='track'){const b=bbox(ring);sport.add({ring,m:.5,bb:[b[0]-.5,b[1]+.5,b[2]-.5,b[3]+.5]});continue;}
    for(let q=0;q<ring.length;q++){const a=ring[q],b=ring[(q+1)%ring.length];
      sport.add({seg:[a,b],m:6,bb:[Math.min(a[0],b[0])-6,Math.max(a[0],b[0])+6,Math.min(a[1],b[1])-6,Math.max(a[1],b[1])+6]});}}
  const ringNear=(x,z,R,m)=>{if(inRing(x,z,R))return true;if(m)for(let q=0;q<R.length;q++)if(segDist(x,z,R[q],R[(q+1)%R.length])<m)return true;return false;};
  // True when the closed polygon P (or a point, P of length 1) touches reserved play ground.
  const onSport=P=>{const bb=bbox(P);for(const it of sport.query(bb)){
      if(it.seg){for(const [x,z] of P)if(segDist(x,z,it.seg[0],it.seg[1])<it.m)return true;if(P.length>2&&inRing(...it.seg[0],P))return true;continue;}
      for(const [x,z] of P)if(ringNear(x,z,it.ring,it.m))return true;if(P.length>2)for(const v of it.ring)if(inRing(v[0],v[1],P))return true;}return false;};
  const massOuter=b=>outerOverride.get(b.id)??b.outer;
  // True when P comes within `clear` of a building mass whose height range meets [lo, hi].
  const onMass=(P,lo,hi,clear)=>{const bb=bbox(P);for(const it of bIdx.query([bb[0]-clear,bb[1]+clear,bb[2]-clear,bb[3]+clear])){const b=it.b;if(b.roof<lo||b.base>hi)continue;
      const R=massOuter(b);for(const [x,z] of P)if(ringNear(x,z,R,clear))return true;for(const v of R)if(inRing(v[0],v[1],P))return true;}return false;};
  const cq=v=>Math.round(v*1073741824)/1073741824;   // engine-exact: last-bit differences of cos/sin vanish
  const crownPoly=(x,z,s,sx,yaw)=>{const c=cq(Math.cos(yaw)),n=cq(Math.sin(yaw));return UNIT32.map(([u,v])=>{const lx=u*4*sx,lz=v*4*s;return [x+lx*c+lz*n,z-lx*n+lz*c];});};
  // Second pass (recheck: crown envelopes): a crown may not cover ≥ 30 % of an already placed crown (or be ≥ 30 % covered).
  const crowns=grid(16),polyArea=P=>Math.abs(signedArea(P));
  const onCrown=P=>{const bb=bbox(P),aP=polyArea(P);for(const it of crowns.query(bb)){const I=intersectRings(P,it.P);if(usable(I)&&polyArea(I)>=.3*Math.min(aP,it.a))return true;}return false;};
  const addCrown=(x,z,f,yaw0)=>{const P=crownPoly(x,z,f.scale,f.sx??f.scale,f.yaw??yaw0);crowns.add({P,a:polyArea(P),bb:bbox(P)});};
  const crownOK=(x,z,y,s,sx,yaw)=>{const P=crownPoly(x,z,s,sx,yaw);return !onSport(P)&&!onMass(P,y-.12+3.35*s*.92,y+7.15*s*1.08,S.crownClear)&&!onCrown(P);};
  // The facade fit below, then (when its crown still meets a mass or play ground) smaller and narrower crowns across the
  // nearest facade or along it; null when none fits.
  const crownFit=(x,z,y,s0,yaw0)=>{const f=fitted(x,z,s0);if(crownOK(x,z,y,f.scale,f.sx??f.scale,f.yaw??yaw0))return f;
    const near=facade(x,z,4.1*s0+S.crownClear),yaws=near?[qYaw(Math.atan2(-near.n[1],near.n[0])),qYaw(Math.atan2(-near.n[1],near.n[0])+Math.PI/2)]:[yaw0,qYaw(yaw0+Math.PI/2)];
    for(let s=Math.min(s0,f.scale);s>=.549;s=Math.round((s-.05)*100)/100)for(let sx=s;sx>=.299;sx=Math.round((sx-.05)*100)/100)for(const yaw of yaws)
      if(crownOK(x,z,y,s,sx,yaw)){crownsFitted++;return sx<s?{scale:s,sx,yaw}:{scale:s,yaw};}
    return null;};
  const fitted=(x,z,s0)=>{const f=facade(x,z,4.1*s0+S.crownClear);if(!f||inBuilding(x,z))return {scale:s0};
    const room=f.d-S.crownClear;if(room>=4.1*s0)return {scale:s0};crownsFitted++;
    // Overall scale shrinks toward the facade room (≥ 0.55), and the crown is narrowed across the facade to fit.
    const s=Math.max(.55,Math.min(s0,(room+1.2)/4.1));return {scale:s,sx:Math.min(s,Math.max(.3,room/4.1)),yaw:qYaw(Math.atan2(-f.n[1],f.n[0]))};};
  for(const [ox,oz] of city.trees){if(areaTrees.has(ox+','+oz)||(plazaRing.length&&inRing(ox,oz,plazaRing)))continue;
    trees.push({x:ox,z:oz});
    let spot=null;const oy=height(ox,oz);
    // Never inside another owner's ground or a sealed (off-limits) zone: such a mapped point moves out or is not drawn.
    for(let r=0;r<=6&&!spot;r+=.75)for(let k=0;k<(r?12:1)&&!spot;k++){const x=ox+SPIRAL12[k][0]*r,z=oz+SPIRAL12[k][1]*r;
      // The mapped spot itself may be another area's ground (a car park, a plaza): kept if clear of ways and facades.
      // (A mapped spot on a cell another area only tints, e.g. a car park, is kept when clear.)
      const free=r?treeOK(x,z):circleClear(x,z,.3)&&!inBuilding(x,z,.6)&&isDry(x,z)&&!ownedAt(x,z)&&ptIdx.query([x-.6,x+.6,z-.6,z+.6]).size===0;
      if(!(free&&!privates.some(f=>f(x,z,height(x,z)))&&!placed.some(p=>Math.hypot(p[0]-x,p[1]-z)<1.5)))continue;
      // Crown: palms keep their fronds (≤ 3.2 m) off play ground; broadleaf crowns must fit.
      const palm=coastal(x,z),hh=((Math.abs(Math.round(ox*7+oz*13))%97)/97),fit=palm?(onSport(exactCircle(x,z,3.2,UNIT32))?null:{}):crownFit(x,z,height(x,z),.85+.3*hh,hh*6.283);
      if(fit)spot=[x,z,palm,fit];}
    if(!spot){treesDropped++;droppedTrees.push({x:ox,z:oz,road:!circleClear(ox,oz,.3),building:inBuilding(ox,oz,.6),owner:ownedAt(ox,oz),blocked:cellBlocked(Math.floor((ox-x0)/step),Math.floor((oz-z0)/step)),clear:clearOf(ox,oz,.6)});continue;}if(spot[0]!==ox||spot[1]!==oz)treesMoved++;
    const [x,z,palm,fit]=spot,y=height(x,z);placed.push(spot);
    const h=((Math.abs(Math.round(ox*7+oz*13))%97)/97);
    if(palm)palms.push({x,z,y,yaw:h*6.283,height:7.2+h*3});else{broadleaf.push({x,z,y,yaw:h*6.283,...fit});addCrown(x,z,fit,h*6.283);}
    colliders.push(prism(exactCircle(x,z,.3,UNIT10),y-.1,y+3.2));}
  mark('trees');
  // Pocket parks / small squares no other module owns: a few trees and a bench (paving comes from `paved`).
  // Pocket parks finished here are owned ground for render-only dressing of other areas (`ground` scatter reads it).
  const benches=[],parks=[],ownedGround=[];
  for(const g of areaHits){if(!(g.kind==='lawn'||g.kind==='square')||g.area<90||g.area>6000)continue;
    const cx=g.ring.reduce((s,p)=>s+p[0],0)/g.ring.length,cz=g.ring.reduce((s,p)=>s+p[1],0)/g.ring.length;
    if(ownedAt(cx,cz)||city.trees.some(([x,z])=>inRing(x,z,g.ring)))continue;
    const want=Math.min(3,Math.max(1,Math.round(g.area/400))),got=[];
    // Candidate spots: a lattice inside the ring, ranked by distance from the centroid.
    const cand=[];for(let x=g.bb[0];x<=g.bb[1];x+=2.5)for(let z=g.bb[2];z<=g.bb[3];z+=2.5)cand.push([x,z]);
    for(const c of cand)c.d=(c[0]-cx)**2+(c[1]-cz)**2;cand.sort((p,q)=>p.d-q.d);
    const edge=(x,z)=>Math.min(...g.ring.map((p,i)=>segDist(x,z,p,g.ring[(i+1)%g.ring.length])));
    for(const [x,z] of cand){if(got.length>=want)break;
      if(!inRing(x,z,g.ring)||edge(x,z)<2.2||got.some(p=>Math.hypot(p[0]-x,p[1]-z)<6)||!clearOf(x,z,2.5)||inBuilding(x,z,2.5))continue;
      const n=nearestCar(x,z);if(n&&n.d<2||!circleClear(x,z,.3+.7))continue;
      const y=height(x,z),h=((got.length+1)*.37+g.id%7*.11)%1,fit=crownFit(x,z,y,.8+.25*h,h*6.283);if(!fit)continue;
      got.push([x,z]);broadleaf.push({x,z,y,yaw:h*6.283,...fit});addCrown(x,z,fit,h*6.283);colliders.push(prism(exactCircle(x,z,.3,UNIT10),y-.1,y+3.2));}
    // Bench: 1.6 m inside the longest edge, facing the centroid.
    let best=null;g.ring.forEach((p,i)=>{const q=g.ring[(i+1)%g.ring.length],l=Math.hypot(q[0]-p[0],q[1]-p[1]);if(l>3&&(!best||l>best.l))best={p,q,l};});
    if(best){const mx=(best.p[0]+best.q[0])/2,mz=(best.p[1]+best.q[1])/2,ux=(best.q[0]-best.p[0])/best.l,uz=(best.q[1]-best.p[1])/best.l;
      for(const sg of [1,-1]){const x=mx-uz*1.6*sg,z=mz+ux*1.6*sg;if(!inRing(x,z,g.ring))continue;
        const n=nearestCar(x,z);if(n&&n.d<2.5||nearRoadLine(x,z,1.6)||!clearOf(x,z,1.4)||inBuilding(x,z,1.2)||got.some(p=>Math.hypot(p[0]-x,p[1]-z)<2.5))break;
        const heading=qYaw(Math.atan2(cx-x,cz-z)),legs=[-.72,.72].map(u=>({u,ground:height(x+Math.cos(heading)*u,z-Math.sin(heading)*u)}));
        const y=Math.max(...legs.map(l=>l.ground));if(y-Math.min(...legs.map(l=>l.ground))>.2)break;
        const box={centre:{x,y:y+.45,z},halfExtents:{x:.95,y:.45,z:.32},rotationY:heading,surface:'pavement'};if(!ringClear(boxRing(box))||onSport(boxRing(box)))continue;benches.push({x,z,y,heading,width:1.8,legs});
        colliders.push(box);break;}}
    parks.push({id:g.id,name:g.name,trees:got.length});ownedGround.push({ring:g.ring,kind:'park'});}

  mark('parks');
  // Bollards: a pair at each pedestrian-lane mouth on a carriageway, at the lane edges (the full middle stays open).
  const bollards=[];
  for(const {r} of sorted){if(r.kind!=='pedestrian'||r.width<4)continue;
    for(const end of [0,1]){const P=end?[...r.points].reverse():r.points;if(P.length<2)continue;
      const n0=nearestCar(P[0][0],P[0][1]);if(!n0||n0.d>1)continue;
      // Walk into the lane until 0.6 m clear of every carriageway.
      const [a,b]=[P[0],P[1]],l=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/l,uz=(b[1]-a[1])/l;let s=0;
      for(;s<Math.min(l,12);s+=.25){const n=nearestCar(a[0]+ux*s,a[1]+uz*s);if(!n||n.d>.6+r.width/2*0)break;}
      if(s>=Math.min(l,12))continue;
      // Just outside the lane's mapped width at both edges (posts stay out of every mapped way).
      // Both posts or none (Gambaro: a lone post reads as a stray object in the lane mouth).
      const pair=[1,-1].map(sg=>{const off=r.width/2+.3,x=a[0]+ux*s-uz*off*sg,z=a[1]+uz*s+ux*off*sg;
        return circleClear(x,z,.13)&&clearOf(x,z,.5)&&!inBuilding(x,z,.3)&&!onSport([[x,z]])?{x,z,y:height(x,z)}:null;});
      if(pair[0]&&pair[1])for(const b of pair){bollards.push(b);colliders.push(prism(exactCircle(b.x,b.z,.13,UNIT10),b.y-.45,b.y+.9));}}}

  // Wall lanterns (Wikimedia Commons curid=151596781, curid=182287159, curid=158245806, curid=99177670, curid=53594779): one bracket lantern near a street corner of every unowned building, 3.4 m up on
  // the street-facing facade 0.35 m from the corner (inside the 0.6 m the facade kit keeps clear). Non-solid, above heads.
  const ownedB=new Set(others.flatMap(([,a])=>[...(a.ownedBuildings??[]),...[...(a.buildingOverrides??[])].map(([id])=>id)]));
  const lanterns=[],lampIdx=grid(16);
  for(const b of city.buildings){if(ownedB.has(b.id))continue;
    const R=b.outer,sa=signedArea(R);if(R.some(p=>inDetail(...p)||inCorridor(...p)||ownedAt(p[0],p[1])))continue;
    for(let i=0;i<R.length;i++){const c=R[i],p=R[(i+R.length-1)%R.length],q=R[(i+1)%R.length];
      if(Math.sign(cross2(p,c,q))!==Math.sign(sa))continue;  // reflex (inner) corner
      const n=nearestCar(c[0],c[1]);if(!n||n.d>3.5||n.d<-.2)continue;
      // Facade edge most parallel to the street.
      const sd=[n.c.b[0]-n.c.a[0],n.c.b[1]-n.c.a[1]],sl=Math.hypot(...sd);
      const edges=[[c,p],[c,q]].map(([o,e])=>{const l=Math.hypot(e[0]-o[0],e[1]-o[1]);return {o,e,l,par:Math.abs(((e[0]-o[0])*sd[0]+(e[1]-o[1])*sd[1])/(l*sl||1))};}).filter(e=>e.l>2.5);
      if(!edges.length)continue;const E=edges.sort((u,v)=>v.par-u.par)[0];
      const ux=(E.e[0]-E.o[0])/E.l,uz=(E.e[1]-E.o[1])/E.l;let nxo=-uz,nzo=ux;
      const mx=E.o[0]+ux*.35,mz=E.o[1]+uz*.35;if(inRing(mx+nxo*.2,mz+nzo*.2,R)){nxo=-nxo;nzo=-nzo;}
      const fx=mx+nxo*.5,fz=mz+nzo*.5;
      if(lampIdx.query([mx-S.lanternSpacing,mx+S.lanternSpacing,mz-S.lanternSpacing,mz+S.lanternSpacing]).size||inBuilding(fx,fz)||ownedAt(fx,fz))continue;
      if(privates.some(f=>f(mx,mz,height(mx,mz))||f(fx,fz,height(fx,fz))))continue;  // never in a sealed (off-limits) zone
      const ground=Math.max(height(mx+nxo*.1,mz+nzo*.1),height(fx,fz)),y=ground+S.lanternHeight;
      if(b.roof<y+.9||b.base>ground+.5)continue;
      lanterns.push({at:[mx,y,mz],dir:[nxo,nzo],building:b.id});lampIdx.add({bb:[mx,mx,mz,mz]});}}

  mark('lanterns');
  const layout={droppedTrees,paved,ownedGround,blocked,covered,remappedCells,cellBlocked,drawBlocked,ownerAt:ownedAt,insideMass:(x,z)=>{for(const it of bIdx.query([x,x,z,z]))if(inRing(x,z,it.b.outer)&&!it.b.holes.some(h=>inRing(x,z,h)))return true;return false;},terrain,trees,palms,broadleaf,benches,bollards,lanterns,parks,colliders,
    tops:[],cuts:[],surfaces:[],floorTriangles:[],places:[],constants:{STREETS,KIND}};
  // `trees` carries {x,z} for sj-world.js; palms/broadleaf/benches/bollards are point dressing for later owners.
  const ms=Date.now()-t0;
  layout.qa=()=>({ms,prof,crownsFitted,islandArea,remapped,apronPieces,sidewalkSkips,treesMoved,treesDropped,inputs:inputs.length,paved:paved.length,ownerRings,trees:trees.length,palms:palms.length,
    broadleaf:broadleaf.length,benches:benches.length,bollards:bollards.length,lanterns:lanterns.length,colliders:colliders.length,parks:parks.length,
    byKind:paved.reduce((m,p)=>(m[p.kind+(p.margin?'+margin':'')]=(m[p.kind+(p.margin?'+margin':'')]??0)+1,m),{})});
  return layout;
}
