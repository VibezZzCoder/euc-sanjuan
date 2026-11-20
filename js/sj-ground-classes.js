/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Natural ground classification (area `ground`) — © 2026 VibezZzCoder, MIT. OSM ODbL / USGS DEM.
// Offline/bake and test module: tools/build-ground-bake.mjs runs it to write data/ground.bin. The browser does not load
// it; at runtime sj-ground.js only reads the bake. Everything here is a pure function of the committed city data:
// DEM, land, surface, buildings, roads, the baked OSM natural polygons and the gate bank rule.
// The palette separates mown esplanades from rough scrub, pale raised rock, dark wet Atlantic shelves and beach sand.
import * as THREE from 'three/webgpu';
import {GROUND_OSM,GROUND_SPORTS} from './sj-ground-osm.js';
import {GROUND} from './sj-ground-layout.js';
import {inRing} from './sj-plaza-layout.js';
import {GATE_BOUNDS} from './sj-gate-layout.js';
import {hash2,smooth} from './sj-ground.js';

// sRGB swatches sampled by eye from the reference photos, converted to linear by THREE.Color.
export const PALETTE=Object.fromEntries(Object.entries({
  lawnA:'#6e9447',lawnB:'#80a058',lawnDry:'#9ba564',                // 19, 43/44: mown esplanade, patchy sun-dried mowing
  roughA:'#74904c',roughB:'#62803f',straw:'#a99c69',                // 22, 50, 86: rough bank grass with straw patches
  scrubA:'#4f6638',scrubB:'#5e7341',                               // 24, 39, 86: sea-grape / scrub on the slopes
  earthA:'#8d6449',earthB:'#a07c5c',                               // 86: rusty red-brown exposed soil on steep banks
  rockLight:'#968b77',rockDark:'#6d665b',                          // 21, 45: sunlit ochre-grey limestone / eolianite
  shelfA:'#57524a',shelfB:'#857761',                               // 85, 24, 75: dark grey-brown eroded shelf, warm crests
  wetRock:'#33302b',                                               // 85, 75, 50: dark wet rock at the waterline
  trailA:'#a99d7f',trailB:'#9d9175',                               // 43, 44: trodden earth paths over grass
  pavedPath:'#b6b2a8',                                             // concrete/paved footways (OSM surface tag)
  gravel:'#7c776b',gravelB:'#857f72',                               // 35/40/39: grey-brown gravel/earth bank behind the bay rip-rap
  sandA:'#d6c49c',sandB:'#c7b38b',wetSand:'#9b8d72',               // 86, 67, 35: beach sand
}).map(([k,v])=>[k,new THREE.Color(v)]));
const P=PALETTE;
const OSM_CLASS={sand:1,rock:2,scrub:3,wood:4,meadow:5,paved:6};
const PAVED=new Set(['concrete','paved','asphalt','paving_stones','sett','concrete:plates']);
export const vnoise=(x,z,scale,s)=>{const fx=x/scale,fz=z/scale,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,su=u*u*(3-2*u),sv=v*v*(3-2*v);
  const a=hash2(i,j,s),b=hash2(i+1,j,s),c=hash2(i,j+1,s),d=hash2(i+1,j+1,s);return a+(b-a)*su+(c-a)*sv+(a-b-c+d)*su*sv;};

// Two-pass chamfer distance (m) on the vertex grid from seed vertices, capped.
function chamfer(seed,nx,nz,step,cap){const d=new Float32Array(nx*nz),a=step,b=step*Math.SQRT2;
  for(let k=0;k<d.length;k++)d[k]=seed[k]?0:cap;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i;let v=d[k];if(!v)continue;
    if(i>0)v=Math.min(v,d[k-1]+a);if(j>0){v=Math.min(v,d[k-nx]+a);if(i>0)v=Math.min(v,d[k-nx-1]+b);if(i<nx-1)v=Math.min(v,d[k-nx+1]+b);}d[k]=v;}
  for(let j=nz-1;j>=0;j--)for(let i=nx-1;i>=0;i--){const k=j*nx+i;let v=d[k];if(!v)continue;
    if(i<nx-1)v=Math.min(v,d[k+1]+a);if(j<nz-1){v=Math.min(v,d[k+nx]+a);if(i<nx-1)v=Math.min(v,d[k+nx+1]+b);if(i>0)v=Math.min(v,d[k+nx-1]+b);}d[k]=v;}
  return d;}
function fillRing(ring,t,cb){let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const [x,z] of ring){a=Math.min(a,x);b=Math.max(b,x);c=Math.min(c,z);d=Math.max(d,z);}
  const i0=Math.max(0,Math.ceil((a-t.x0)/t.step)),i1=Math.min(t.nx-1,Math.floor((b-t.x0)/t.step)),j0=Math.max(0,Math.ceil((c-t.z0)/t.step)),j1=Math.min(t.nz-1,Math.floor((d-t.z0)/t.step));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(inRing(t.x0+i*t.step,t.z0+j*t.step,ring))cb(j*t.nx+i);}

// The gate-bank rule of sj-world.js vertexColour (Wikimedia Commons curid=123113261's grassy slope by the Rogativa corner), same expression.
export function gateBank(world,k){const t=world.terrain,h=t.heights,vx=t.x0+(k%t.nx)*t.step,vz=t.z0+Math.floor(k/t.nx)*t.step;
  return !!world.gate&&vx>=GATE_BOUNDS.minX&&vx<=GATE_BOUNDS.maxX&&vz>=GATE_BOUNDS.minZ&&vz<=GATE_BOUNDS.maxZ&&k>t.nx&&k<h.length-t.nx-1
    &&h[k]<12.3&&Math.hypot(h[k+1]-h[k-1],h[k+t.nx]-h[k-t.nx])/(2*t.step)>.7;}

// The bake classifies the committed data only: `surface` is re-read from data/surface.u8, because areas may remap the
// loaded copy at load time (bahia's surface-feel classes). Area tints, owners and remaps act at runtime, never in the bake.
export async function bakeWorld(world){
  const r=await fetch(new URL('../data/surface.u8',import.meta.url));if(!r.ok)throw new Error('surface.u8 missing');
  return {...world,surface:new Uint8Array(await r.arrayBuffer())};}

const cache=new WeakMap();
// Per-vertex fields (computed once per surface array; pass bakeWorld(world)).
export function groundFields(world){
  let F=cache.get(world.surface);if(F)return F;
  const t=world.terrain,{nx,nz,step}=t,n=nx*nz,h=t.heights,land=world.land,surface=world.surface;
  const water=new Uint8Array(n);for(let k=0;k<n;k++)water[k]=land[k]?0:1;
  // Atlantic water: reached from the north edge down each column, and from the west edge along rows north of the bay
  // mouth (El Morro's headland, z < −250). Its distance marks the north/west shore shelves (Wikimedia Commons curid=109811940, curid=80251220, curid=86543901).
  const atl=new Uint8Array(n);
  for(let i=0;i<nx;i++)for(let j=0;j<nz&&!land[j*nx+i];j++)atl[j*nx+i]=1;
  for(let j=0;j<nz&&t.z0+j*step<-250;j++)for(let i=0;i<nx&&!land[j*nx+i];i++)atl[j*nx+i]=1;
  const built=new Uint8Array(n);for(const b of world.city.buildings)fillRing(b.outer,t,k=>{built[k]=1;});
  const osm=new Uint8Array(n);for(const [,kind,ring] of GROUND_OSM)fillRing(ring,t,k=>{osm[k]=OSM_CLASS[kind];});
  // Footpaths away from motor roads: 1 = unpaved/unknown surface (trodden path), 2 = OSM-paved footway or cycleway.
  const path=new Uint8Array(n),motor=new Uint8Array(n),PATHS=new Set(['footway','path','cycleway','track']);
  for(const r of world.city.roads){const m=PATHS.has(r.kind)?path:r.kind==='steps'||r.kind==='pedestrian'?null:motor;if(!m)continue;
    const half=r.width/2+(m===motor?1:.2),val=m===motor?1:PAVED.has(r.surface)||r.kind==='cycleway'?2:1;
    for(let q=1;q<r.points.length;q++){const a=r.points[q-1],b=r.points[q],dx=b[0]-a[0],dz=b[1]-a[1],L2=dx*dx+dz*dz||1;
      const i0=Math.max(0,Math.floor((Math.min(a[0],b[0])-half-t.x0)/step)),i1=Math.min(nx-1,Math.ceil((Math.max(a[0],b[0])+half-t.x0)/step));
      const j0=Math.max(0,Math.floor((Math.min(a[1],b[1])-half-t.z0)/step)),j1=Math.min(nz-1,Math.ceil((Math.max(a[1],b[1])+half-t.z0)/step));
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=t.x0+i*step,z=t.z0+j*step,u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L2)),ex=x-a[0]-dx*u,ez=z-a[1]-dz*u;
        if(ex*ex+ez*ez<=half*half)m[j*nx+i]=Math.max(m[j*nx+i],val);}}}
  for(let k=0;k<n;k++)if(motor[k])path[k]=0;
  F={t,surface,h,land,osm,path,waterDist:chamfer(water,nx,nz,step,80),atlDist:chamfer(atl,nx,nz,step,80),buildDist:chamfer(built,nx,nz,step,80),w:new Float32Array(7)};
  cache.set(world.surface,F);return F;}
// Soft OSM class weights at vertex k: share of each class in the 5×5 vertex window (≈ a 4 m blend each side).
function osmWeights(F,k){const W=F.w;W.fill(0);const t=F.t,nx=t.nx,i=k%nx,j=(k-i)/nx;
  for(let dj=-2;dj<=2;dj++){const jj=Math.max(0,Math.min(t.nz-1,j+dj))*nx;for(let di=-2;di<=2;di++)W[F.osm[jj+Math.max(0,Math.min(nx-1,i+di))]]+=.04;}
  return W;}
// Gradient magnitude (rise/run) from the drawn land neighbours only (water vertices sit at the −4 m nodata floor).
function slopeAt(F,k){const {h,land}=F,{nx,nz,step}=F.t,i=k%nx,j=(k-i)/nx;
  const L=i>0&&land[k-1]?k-1:k,R=i<nx-1&&land[k+1]?k+1:k,U=j>0&&land[k-nx]?k-nx:k,D=j<nz-1&&land[k+nx]?k+nx:k;
  const gx=R!==L?(h[R]-h[L])/((R-L)*step):0,gz=D!==U?(h[D]-h[U])/((D-U)/nx*step):0;return Math.sqrt(gx*gx+gz*gz);}

// Natural class weights at vertex k, or null when it is not natural ground: roads, town ground, operational aprons, or
// open water away from any drawn cell. The plaza ground rule (plazaGroundBase) is applied live at runtime, not here.
export function classifyVertex(world,F,k,bank,out={}){
  const s=F.surface[k];if(s===1&&!(F.path[k]&&F.buildDist[k]>6))return null;
  const t=F.t,nx=t.nx,land=F.land;
  if(!land[k]){if(!(land[k-1]||land[k+1]||land[k-nx]||land[k+nx]||land[k-nx-1]||land[k-nx+1]||land[k+nx-1]||land[k+nx+1]))return null;}
  const i=k%nx,j=(k-i)/nx,x=t.x0+i*t.step,z=t.z0+j*t.step;
  const sl=land[k]?slopeAt(F,k):0,W=osmWeights(F,k),sand=W[1],rockM=W[2],scrub=W[3]+W[4],meadow=W[5],paved=W[6];
  if(s!==3&&!bank&&paved>.5&&sl<GROUND.bankSlope)return null;
  if(!(s===2||s===3||bank||sand>0||rockM>0||scrub>0||meadow>0||F.buildDist[k]>GROUND.townDist||sl>GROUND.bankSlope))return null;
  out.x=x;out.z=z;out.slope=sl;out.sand=sand;out.rockM=rockM;out.scrub=scrub;out.wood=W[4];out.water=s===3||!land[k];
  out.trail=s===1?F.path[k]:0;out.mapped=s===2&&!bank;out.wd=F.waterDist[k];out.hk=F.h[k];
  out.lawn=s===2&&!bank?(1-meadow)*(1-smooth(.35,.6,sl)):0;
  // Atlantic shelf: low ground (< ~4 m) within ~15 m of the open ocean, mapped beaches excepted (they keep sand with outcrops).
  const atl=1-smooth(4,14,F.atlDist[k]-F.waterDist[k]);
  out.shelf=atl*(1-smooth(9,20,out.wd))*(1-smooth(2.5,5.5,out.hk))*(1-sand*.75)*(1-out.lawn);
  out.rock=Math.max(s===2?smooth(1.05,1.6,sl):smooth(.8,1.3,sl),rockM*.92,out.shelf);
  out.wet=out.water?1:Math.max((1-smooth(1.5,6,out.wd))*(1-smooth(1.2,3.4,out.hk)),
    atl*(1-smooth(1.5,6,out.wd))*(1-smooth(.8,2.4,out.hk)));
  out.atl=atl;
  // Bay-side shore bank (polish, Paseo del Morro foreshore): low untagged ground behind the rip-rap reads as one
  // calm grey-brown gravel/earth bank, matching the gate's rip-rap margin tone, not a grass/rock/straw patchwork.
  out.gravel=s===0&&!bank?(1-atl)*(1-smooth(8,14,out.wd))*(1-smooth(2.5,4,out.hk))*(1-sand)*(1-smooth(.5,.9,sl)):0;
  return out;}

const mixC=(c,o,w)=>{if(w>0){c.r+=(o.r-c.r)*w;c.g+=(o.g-c.g)*w;c.b+=(o.b-c.b)*w;}return c;};
const pick=(c,a,b,w)=>{c.r=a.r+(b.r-a.r)*w;c.g=a.g+(b.g-a.g)*w;c.b=a.b+(b.b-a.b)*w;return c;};

// Linear colour of natural vertex k (into `c`), or null. This is the computation the bake stores.
export function naturalColour(world,F,k,bank,c=new THREE.Color(),w={}){
  if(!classifyVertex(world,F,k,bank,w))return null;
  const tmp=new THREE.Color(),tmp2=new THREE.Color();
  const {x,z}=w,n1=vnoise(x,z,37,1),n2=vnoise(x,z,13,2),n3=vnoise(x,z,6.5,3);
  // Grass base: rough bank grass with straw patches; mown lawn on mapped grass; drier near the salt spray.
  pick(c,P.roughA,P.roughB,n1);mixC(c,P.straw,smooth(.52,.74,n2*.75+n3*.25)*(w.mapped?.4:.75));
  if(w.lawn>0){pick(tmp,P.lawnA,P.lawnB,.3+n1*.4+n3*.15);mixC(tmp,P.lawnDry,smooth(.7,.86,n2)*.35);mixC(c,tmp,w.lawn);}
  mixC(c,P.straw,(1-smooth(6,24,w.wd))*(1-smooth(3,9,w.hk))*(1-w.lawn*.5)*(1-w.atl)*.35);
  if(w.scrub>0)mixC(c,pick(tmp,P.scrubA,P.scrubB,n2),w.scrub*(w.wood>.5?1:.85));
  // Rusty exposed soil on moderately steep banks; rock on cliffs, mapped bare rock and the Atlantic shelf.
  mixC(c,pick(tmp,P.earthA,P.earthB,n2),(w.mapped?smooth(.6,1.1,w.slope)*.5:smooth(.42,.78,w.slope))*(.5+.5*n3)*(1-w.lawn));
  if(w.rock>0){pick(tmp,P.rockLight,P.rockDark,Math.min(1,n2*.6+n3*.25+(1-smooth(2,10,w.hk))*.35));
    // Shelf rock: dark grey-brown with warm crests (85), darker toward the sea.
    if(w.shelf>0){const crest=smooth(.38,.72,n3*.65+n2*.35),v=vnoise(x,z,3.1,4);
      pick(tmp2,P.shelfA,P.shelfB,Math.min(1,Math.max(0,crest*(.55+.45*smooth(1,4,w.hk))+(v-.5)*.5)));mixC(tmp,tmp2,Math.min(1,w.shelf*1.5));}
    mixC(c,tmp,w.rock);}
  if(w.sand>0){pick(tmp2,P.sandA,P.sandB,n3);
    // Atlantic beaches: broken dark rock outcrops through the sand (75/67).
    if(w.atl>.3)mixC(tmp2,P.shelfA,smooth(.6,.72,n2*.7+n3*.3)*.85*w.atl);
    mixC(c,tmp2,w.sand*(1-w.rock*.6));}
  if(w.wet>0)mixC(c,w.sand>.3?P.wetSand:P.wetRock,w.wet*(w.sand>.3?.8:.92));
  if(w.gravel>0)mixC(c,pick(tmp,P.gravel,P.gravelB,n1*.6+n3*.4),w.gravel);
  if(w.trail===1)mixC(c,pick(tmp,P.trailA,P.trailB,n3),.6);   // 43/44: trodden paths (mapped width, soft at 2 m)
  else if(w.trail===2)mixC(c,P.pavedPath,.75);
  return c;}

// Scatter candidates before any ownership test (owners are checked live at runtime): one per 4 m cell (ci,cj) from the
// grid origin; kind 1 tuft / 2 shrub / 3 grape and a 3-bit mask of clump tufts that pass the class test.
export const SCATTER_EXCLUDE=w=>w.water||w.trail||w.lawn>.2||w.rock>.55||w.wet>.25||w.gravel>.5;
// Sports exclusion (m): margin outside mapped pitches/playgrounds/tracks; width of a track's running lanes inside its outline.
export const SPORTS_MARGIN={pitch:1.4,playground:1,track:1.4},TRACK_LANE=6;   // 1.4 m: largest scatter crown reach
export function scatterCandidates(world,F){
  const t=F.t,S=GROUND.scatterCell,CW=Math.ceil((t.nx-1)*t.step/S),CH=Math.ceil((t.nz-1)*t.step/S),out=[],w={},w2={},C=GROUND.clear;
  // Static city owners (bake inputs): buildings + 1.2 m, road centrelines at half width + 1 m, mapped trees + 1.4 m.
  // Area owners (and everything merged later) are checked live in sj-ground.js buildGround.
  const cell=8,grid=new Map(),key=(i,j)=>i*100003+j;
  const add=(ring,margin)=>{const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),it={ring,m2:margin*margin,bb:[Math.min(...xs)-margin,Math.max(...xs)+margin,Math.min(...zs)-margin,Math.max(...zs)+margin]};
    for(let i=Math.floor(it.bb[0]/cell);i<=Math.floor(it.bb[1]/cell);i++)for(let j=Math.floor(it.bb[2]/cell);j<=Math.floor(it.bb[3]/cell);j++){const k=key(i,j);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(it);}};
  const segD2=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return (x-a[0]-dx*u)**2+(z-a[1]-dz*u)**2;};
  const hits=(x,z)=>{for(const it of grid.get(key(Math.floor(x/cell),Math.floor(z/cell)))??[]){const bb=it.bb;if(x<bb[0]||x>bb[1]||z<bb[2]||z>bb[3])continue;
    if(it.lane){if(inRing(x,z,it.ring)&&it.ring.some((p,q)=>segD2(x,z,p,it.ring[(q+1)%it.ring.length])<it.lane*it.lane))return true;continue;}
    if(it.ring.length===2){if(segD2(x,z,it.ring[0],it.ring[1])<it.m2)return true;continue;}
    if(inRing(x,z,it.ring))return true;for(let q=0;q<it.ring.length;q++)if(segD2(x,z,it.ring[q],it.ring[(q+1)%it.ring.length])<it.m2)return true;}return false;};
  for(const b of world.city.buildings)add(b.outer,C.building);
  for(const r of world.city.roads)for(let q=1;q<r.points.length;q++)add([r.points[q-1],r.points[q]],r.width/2+C.road);
  for(const [x,z] of world.city.trees)add([[x-.01,z],[x+.01,z]],C.point);
  // Mapped sports surfaces: the playing surface and its lines/run-off. Pitches and playgrounds: the
  // whole polygon plus a margin. Tracks: the running lanes only (a band inside the outline plus the margin outside), so
  // a large infield is not bulldozed; mapped pitches inside a track are excluded by their own polygon.
  for(const [,kind,,,ring] of GROUND_SPORTS){if(kind!=='track'){add(ring,SPORTS_MARGIN[kind]);continue;}
    for(let q=0;q<ring.length;q++)add([ring[q],ring[(q+1)%ring.length]],SPORTS_MARGIN.track);
    const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),it={ring,lane:TRACK_LANE,bb:[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)]};
    for(let i=Math.floor(it.bb[0]/cell);i<=Math.floor(it.bb[1]/cell);i++)for(let j=Math.floor(it.bb[2]/cell);j<=Math.floor(it.bb[3]/cell);j++){const k=key(i,j);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(it);}}
  const vk=(x,z)=>Math.round((z-t.z0)/t.step)*t.nx+Math.round((x-t.x0)/t.step);
  for(let cj=0;cj<CH;cj++)for(let ci=0;ci<CW;ci++){
    const roll=hash2(ci,cj,23);if(roll>=.6)continue;
    const x=t.x0+(ci+hash2(ci,cj,21))*S,z=t.z0+(cj+hash2(ci,cj,22))*S;
    const i=Math.floor((x-t.x0)/t.step),j=Math.floor((z-t.z0)/t.step);if(i<1||j<1||i>t.nx-3||j>t.nz-3)continue;
    const c0=j*t.nx+i;if(!F.land[c0]||!F.land[c0+1]||!F.land[c0+t.nx]||!F.land[c0+t.nx+1])continue;
    if(!classifyVertex(world,F,vk(x,z),false,w)||SCATTER_EXCLUDE(w)||w.slope>1.05)continue;
    const shore=(1-smooth(8,30,w.wd))*(1-smooth(4,12,w.hk));
    let kind=0;
    if(w.sand>.6){if(shore>.3&&w.sand<.95&&roll<.08)kind=3;}
    else if(shore>.35&&roll<.16*shore)kind=3;
    else if(w.scrub>.4&&roll<.5*w.scrub)kind=2;
    else if(roll<.09+.15*smooth(.25,.7,w.slope))kind=2;
    else if(roll<.4+.2*smooth(.2,.6,w.slope))kind=1;
    if(!kind||hits(x,z))continue;
    let mask=0;
    if(kind===1)for(let q=0;q<3;q++){const qx=x+(hash2(ci,cj,30+q)-.5)*1.6,qz=z+(hash2(ci,cj,40+q)-.5)*1.6;
      if(classifyVertex(world,F,vk(qx,qz),false,w2)&&!SCATTER_EXCLUDE(w2)&&!hits(qx,qz))mask|=1<<q;}
    out.push([cj*CW+ci,kind|mask<<2]);}
  return {cells:out,CW};}

// Read-only class query (pass bakeWorld(world)): dominant natural class at grid vertex k, or null.
export function groundClassOf(world,k){
  if(!world.ground)return null;const F=groundFields(world),w=classifyVertex(world,F,k,false,{});if(!w)return null;
  return {...w,name:w.trail?'trail':w.gravel>.6?'gravel':w.wet>.6?(w.sand>.3?'wetSand':'wetRock'):w.rock>.6?(w.shelf>.5?'shelf':'rock'):w.sand>.6?'sand':w.lawn>.6?'lawn':w.scrub>.5?'scrub':w.slope>.42?'bank':'rough'};}
