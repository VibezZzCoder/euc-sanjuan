/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Natural ground finish (area `ground`, 2026-11-18) — © 2026 VibezZzCoder, MIT. OSM ODbL / USGS DEM.
// Render only: terrain vertex positions/indices and all physics are untouched.
// Runtime side. The static per-vertex classification and the pre-owner scatter candidates are baked offline into
// data/ground.bin by tools/build-ground-bake.mjs, from js/sj-ground-classes.js (the same code the tests run live).
// This file only decodes the bake, applies the live rules (plaza ground, tint hand-off, owners), builds the detail
// material and draws the vegetation.
import * as THREE from 'three/webgpu';
import {GROUND} from './sj-ground-layout.js';
import {inRing,plazaGroundBase} from './sj-plaza-layout.js';
import {areasOf} from './sj-world.js';

export const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const hash2=(i,j,s)=>{let h=Math.imul(i|0,374761393)^Math.imul(j|0,668265263)^Math.imul(s|0,982451653);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};

// ---- data/ground.bin (little endian). Header: 'SJG1', u32 version, nx, nz, palette count, RLE bytes, natural count,
// cell count, cell bytes, cell grid width, 32-byte SHA-256 of the bake inputs. Then: sRGB palette (3 B each); the
// natural-vertex mask as LEB128 run lengths alternating off/on from vertex 0; one palette index per natural vertex in
// vertex order; scatter cells as LEB128 deltas of the cell index, each followed by one byte (kind | clump mask << 2). ----
export const BAKE_VERSION=1;
const readVar=(u8,o)=>{let v=0,s=0,b;do{b=u8[o.p++];v+=(b&127)*2**s;s+=7;}while(b&128);return v;};
export function decodeGroundBake(buf){
  const dv=new DataView(buf),u8=new Uint8Array(buf);
  if(String.fromCharCode(...u8.subarray(0,4))!=='SJG1'||dv.getUint32(4,true)!==BAKE_VERSION)throw new Error('ground.bin: bad header');
  const [nx,nz,nPal,rleBytes,nNat,nCells,cellBytes,CW]=[8,12,16,20,24,28,32,36].map(o=>dv.getUint32(o,true));
  let o=72;const palette=u8.slice(o,o+nPal*3);o+=nPal*3;
  const map=new Uint8Array(nx*nz);let k=0,on=false,q=0;const rle={p:o},end=o+rleBytes;
  const idx=u8.subarray(end,end+nNat);
  while(rle.p<end){const run=readVar(u8,rle);if(on)for(let r=0;r<run;r++)map[k+r]=idx[q++]+1;k+=run;on=!on;}
  if(q!==nNat)throw new Error('ground.bin: natural count mismatch');
  o=end+nNat;const cells=new Int32Array(nCells),codes=new Uint8Array(nCells),cp={p:o};let c=0;
  for(let i=0;i<nCells;i++){c+=readVar(u8,cp);cells[i]=c;codes[i]=u8[cp.p++];}
  if(cp.p!==o+cellBytes)throw new Error('ground.bin: cell stream mismatch');
  return {nx,nz,palette,map,cells,codes,CW,inputs:u8.slice(40,72)};}

const bakes=new WeakMap();
// Fetched once per world by loadCity (the layout's `load` hook), so every path that builds the world or the plaza has it.
export async function loadGroundBake(layout,terrain){
  let b=bakes.get(layout);if(b)return b;
  const response=await fetch(new URL('../data/ground.bin',import.meta.url));
  if(!response.ok)throw new Error(`City data failed: ground.bin (${response.status})`);
  b=decodeGroundBake(await response.arrayBuffer());
  if(b.nx!==terrain.nx||b.nz!==terrain.nz)throw new Error('ground.bin: grid mismatch (re-run tools/build-ground-bake.mjs)');
  bakes.set(layout,b);return b;}
const loadBake=world=>loadGroundBake(world.ground,world.terrain);

export const vnoise=(x,z,scale,s)=>{const fx=x/scale,fz=z/scale,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,su=u*u*(3-2*u),sv=v*v*(3-2*v);
  const a=hash2(i,j,s),b=hash2(i+1,j,s),c=hash2(i,j+1,s),d=hash2(i+1,j+1,s);return a+(b-a)*su+(c-a)*sv+(a-b-c+d)*su*sv;};
// Wall-foot scarp: steep ground within ~4–9 m of any fitted wall's face foot (stations' B points of every
// `walls` list: gate, fort, cristobal, princesa, norzagaray, perlaWest, forttops…) is the hillside climbing the face; it
// reads as bare earth/rock (Wikimedia Commons curid=123485577, curid=34389396, curid=82863744), not lawn. Runtime: wall geometry is area code, never in the bake. The named
// 'lawn' tint of those owners is handed over there; mown flat lawn is untouched (slope test).
const SCARP=['#7d6f5b','#686157'].map(c=>new THREE.Color(c)),SCARP_TONES=new Set(['lawn']);
function scarpWeights(world){
  const t=world.terrain,{nx,nz,step,x0,z0}=t,h=t.heights,land=world.land,out=new Map(),R=9;
  const owners=[world.gate,world.fort,...areasOf(world)].filter(a=>Array.isArray(a?.walls));
  // Sources: fitted wall stations' face feet, plus the edges of tall (> 4 m) solids of the wall owners and forttops
  // (bastion faces and tiers that are not fitted runs, e.g. El Morro's south face above the Paseo).
  const segs=[];for(const a of owners)for(const wl of a.walls)if(wl.a?.B&&wl.b?.B)segs.push([wl.a.B,wl.b.B]);
  for(const a of new Set([...owners,world.forttops].filter(Boolean)))for(const c of a.colliders??[]){if(!c.outer||c.maxY-c.minY<=4)continue;
    for(let q=0;q<c.outer.length;q++){const p=c.outer[q],r=c.outer[(q+1)%c.outer.length];segs.push([[p.x,p.z],[r.x,r.z]]);}}
  for(const [A,Bp] of segs){
    const dx=Bp[0]-A[0],dz=Bp[1]-A[1],L2=dx*dx+dz*dz||1e-9;
    const i0=Math.max(1,Math.floor((Math.min(A[0],Bp[0])-R-x0)/step)),i1=Math.min(nx-2,Math.ceil((Math.max(A[0],Bp[0])+R-x0)/step));
    const j0=Math.max(1,Math.floor((Math.min(A[1],Bp[1])-R-z0)/step)),j1=Math.min(nz-2,Math.ceil((Math.max(A[1],Bp[1])+R-z0)/step));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*nx+i;if(!land[k])continue;const x=x0+i*step,z=z0+j*step,u=Math.max(0,Math.min(1,((x-A[0])*dx+(z-A[1])*dz)/L2));
      const d=Math.hypot(x-A[0]-dx*u,z-A[1]-dz*u);if(d>R)continue;
      const sl=Math.hypot((land[k+1]?h[k+1]:h[k])-(land[k-1]?h[k-1]:h[k]),(land[k+nx]?h[k+nx]:h[k])-(land[k-nx]?h[k-nx]:h[k]))/(2*step);
      const wgt=(1-smooth(4,R,d))*smooth(.4,.7,sl)*.92;if(wgt>(out.get(k)??0))out.set(k,wgt);}}
  return out;}

// Unassigned hard ground: terrain vertices of surface.u8 class 1 ('asphalt') that are not natural
// ground showed the base palette's blue-grey asphalt '#687d91' (sj-world.js `colours[1]`) wherever no paving mesh covers
// them — shoulders, wedges at wall and building feet, junction islands, strips at fence toes — and its 2 m vertex gradient
// into the lawn green read turquoise/cyan. Unclaimed, it now reads as an intentional Old San Juan surface instead:
//   - worn concrete / compacted gravel shoulder in the warm grey-beige of the adjoining walks (Wikimedia Commons curid=124496780, curid=31949754, curid=116769039, curid=53594779);
//   - a narrow dry-earth / worn-grass verge where it touches natural ground (one grid step, Wikimedia Commons curid=31949754's walk edges);
//   - planted soil on steep islands (rise/run > ~0.3–0.55; Wikimedia Commons curid=31949754, curid=109811940 banks).
// Live, not baked: it depends only on committed surface/DEM plus the bake's natural mask and plaza ground; every area tint
// still wins (vertexColour), coast's tintBlend fades into it. Colour only: positions, indices and physics are unchanged.
const HARD={concrete:['#978f81','#878073'],verge:['#8c8660','#86775a'],soil:['#6f6b47','#7a6a4f']};
// Tints that only restate the base asphalt tone (worldedge's last two columns at the hoarding) are handed over on
// unassigned hard ground, so the hoarding toe gets the same finish.
const HARD_TONES=new Set(['#687d91']);
const HARDC=Object.fromEntries(Object.entries(HARD).map(([k,v])=>[k,v.map(c=>new THREE.Color(c))]));
// the worn edge is a strip along drawn paving, not a band. Distance (m, capped) from every vertex to the
// nearest owner paving — any area's `paved`, `surfaces`, `brick`, `tops` and `floorTriangles` (generic: streets, uptown,
// eastcivic… and whatever boundary they draw later) — rasterised on the vertex grid, then a two-pass chamfer.
const EDGE={cap:8,strip:[1.2,3.2]};
function pavingDistance(world,drawnOnly=false){
  const t=world.terrain,{nx,nz,step,x0,z0}=t,seed=new Uint8Array(nx*nz);
  const fill=ring=>{let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of ring){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}
    const i0=Math.max(0,Math.ceil((a-x0)/step)),i1=Math.min(nx-1,Math.floor((b-x0)/step)),j0=Math.max(0,Math.ceil((c-z0)/step)),j1=Math.min(nz-1,Math.floor((d-z0)/step));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*nx+i;if(!seed[k]&&inRing(x0+i*step,z0+j*step,ring))seed[k]=1;}};
  for(const a of areasOf(world)){
    for(const s of [...(a.paved??[]),...(a.surfaces??[]),...(a.brick??[])])if(s?.ring?.length>=3)fill(s.ring);
    if(drawnOnly)continue;   // drawn paving rings only (tops/floors may be physics over terrain that stays visible)
    for(const tp of a.tops??[])if(tp?.poly?.length>=3)fill(tp.poly.map(p=>[p.x,p.z]));
    for(const f of a.floorTriangles??[])if(f?.length===3)fill(f.map(p=>[p[0],p[2]]));}
  const D=new Float32Array(nx*nz),A=step,B=step*Math.SQRT2,cap=EDGE.cap;for(let k=0;k<D.length;k++)D[k]=seed[k]?0:cap;
  if(drawnOnly)return D;   // membership only (0 under paving)
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i;let v=D[k];if(!v)continue;
    if(i>0)v=Math.min(v,D[k-1]+A);if(j>0){v=Math.min(v,D[k-nx]+A);if(i>0)v=Math.min(v,D[k-nx-1]+B);if(i<nx-1)v=Math.min(v,D[k-nx+1]+B);}D[k]=v;}
  for(let j=nz-1;j>=0;j--)for(let i=nx-1;i>=0;i--){const k=j*nx+i;let v=D[k];if(!v)continue;
    if(i<nx-1)v=Math.min(v,D[k+1]+A);if(j<nz-1){v=Math.min(v,D[k+nx]+A);if(i<nx-1)v=Math.min(v,D[k+nx+1]+B);if(i>0)v=Math.min(v,D[k+nx-1]+B);}D[k]=v;}
  return D;}
// Worn edge of pale town ground (class 0) where it meets the lawn: a muted grey-beige, darker and less creamy than the
// '#c8bfaa' base, so it does not read as a second path (Casa Blanca; Wikimedia Commons curid=122996449, curid=31949754 walk edges).
const WET=new THREE.Color('#4a463e');
const EDGE0=['#a69e8a','#9a927e'].map(c=>new THREE.Color(c));
function hardGround(world,S){
  const t=world.terrain,{nx,nz,step,x0,z0}=t,h=t.heights,land=world.land,surface=world.surface,N8=[-1,1,-nx,nx,-nx-1,-nx+1,nx-1,nx+1];
  // Class 0 joins only where natural ground lies within two grid steps (lawn edges); elsewhere town ground keeps its base.
  const nearNat=k=>{const i=k%nx,j=(k-i)/nx;if(i<2||j<2||i>=nx-2||j>=nz-2)return false;
    for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++)if(S.map[k+dj*nx+di])return true;return false;};
  // Non-land vertices are never drawn, but cut fragments at the waterline interpolate toward them: they take a dark wet
  // tone instead of the base water-edge teal '#346d80' ((−467,−53)).
  const eligible=k=>!S.map[k]&&(!land[k]||land[k]===1&&(surface[k]===1||surface[k]===0&&nearNat(k)))&&!plazaGroundBase(x0+(k%nx)*step,z0+Math.floor(k/nx)*step,S.world);
  const lerp=(c,a,b,f)=>c.setRGB(a.r+(b.r-a.r)*f,a.g+(b.g-a.g)*f,a.b+(b.b-a.b)*f);
  const mix=(c,o,f)=>{if(f>0){c.r+=(o.r-c.r)*f;c.g+=(o.g-c.g)*f;c.b+=(o.b-c.b)*f;}return c;};
  const tmp=new THREE.Color(),avg=new THREE.Color();let dist=null,drawn=null;
  // natural vertices lying under owner paving take a worn-earth tone, so where a
  // slope's own triangles reach the walk edge the colour change sits on the earth side, not in lawn green over the walk.
  const UNDER=new THREE.Color('#90856c');
  return {eligible,
    under(k,c,out){if(!S.world)return c;drawn??=pavingDistance(S.world,true);if(drawn[k]>.01)return c;
      out.r=c.r+(UNDER.r-c.r)*.85;out.g=c.g+(UNDER.g-c.g)*.85;out.b=c.b+(UNDER.b-c.b)*.85;return out;},
    colour(k,bank,out){if(bank||!eligible(k))return null;if(!land[k])return out.copy(WET);const i=k%nx,j=(k-i)/nx,inner=i>1&&j>1&&i<nx-2&&j<nz-2;
      const x=x0+i*step,z=z0+j*step,n1=vnoise(x,z,11,61),n2=vnoise(x,z,3.7,62);
      let nat=0;if(inner)for(const d of N8)if(S.map[k+d])nat++;
      const L=i>0&&land[k-1]?k-1:k,R=i<nx-1&&land[k+1]?k+1:k,U=j>0&&land[k-nx]?k-nx:k,D=j<nz-1&&land[k+nx]?k+nx:k;
      const gx=R!==L?(h[R]-h[L])/((R-L)*step):0,gz=D!==U?(h[D]-h[U])/((D-U)/nx*step):0,sl=Math.sqrt(gx*gx+gz*gz);
      if(surface[k]===1){lerp(out,HARDC.concrete[0],HARDC.concrete[1],n1*.7+n2*.3);
        mix(out,lerp(tmp,HARDC.verge[0],HARDC.verge[1],n2),Math.min(1,nat/3)*.85);}
      else lerp(out,EDGE0[0],EDGE0[1],n1*.6+n2*.4);
      mix(out,lerp(tmp,HARDC.soil[0],HARDC.soil[1],n1),smooth(.3,.55,sl)*.9);
      // Strip, not band: away from drawn paving the edge gives way to the surrounding natural ground (5×5 mean colour),
      // so the worn tone follows the paving boundary whoever draws it.
      if(inner){let m=0;avg.setRGB(0,0,0);
        for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){const q=S.map[k+dj*nx+di];if(!q)continue;const c=S.colours[q-1];avg.r+=c.r;avg.g+=c.g;avg.b+=c.b;m++;}
        if(m){dist??=pavingDistance(S.world);avg.multiplyScalar(1/m);mix(out,avg,smooth(EDGE.strip[0],EDGE.strip[1],dist[k])*Math.min(1,m/6)*.92);}}
      return out;}};}

// Terrain vertex colour of natural ground from the bake, or null to keep the base colouring. Live rules: plaza ground
// keeps its base (plazaGroundBase), and area tints win unless the layout hands them over (`refineTones`, e.g.
// perlaDistrict's shore rock tones, which the Atlantic shelf class supersedes).
// The palette's construction state lives in one holder `S` that buildGround releases once the world is built (the
// palette object itself is referenced by buildWorld's closures for the whole session; it must not keep the bake alive).
const palettes=new WeakMap();
export async function groundPalette(world){
  if(!world.ground)return null;
  const B=await loadBake(world),t=world.terrain,refine=world.ground.refineTones??new Set();
  const colours=[];for(let i=0;i<B.palette.length;i+=3)colours.push(new THREE.Color().setRGB(B.palette[i]/255,B.palette[i+1]/255,B.palette[i+2]/255,THREE.SRGBColorSpace));
  // Areas whose tint fades into the terrain's own colour publish `tintBlend` (k → [r,g,b sRGB 0–255, fade]); on natural
  // ground the fade then targets the ground class colour instead of the old palette (coast's shore band).
  const S={map:B.map,colours,blends:areasOf(world).map(a=>a.tintBlend).filter(m=>m?.size),scarp:scarpWeights(world),world};
  // Ring of scratch colours: a caller (colourAt) holds three vertex colours, each taking up to three slots.
  const ring=Array.from({length:16},()=>new THREE.Color()),s={};let r=0;
  const hard=hardGround(world,S);
  // Own colour of vertex k: the baked natural class, else the unassigned hard-ground finish; then the
  // tintBlend fade (coast's shore band) toward it.
  const natural=(k,bank)=>{const m=S.map[k];let c;
    if(m){if(!bank&&plazaGroundBase(t.x0+(k%t.nx)*t.step,t.z0+Math.floor(k/t.nx)*t.step,S.world))return null;c=hard.under(k,S.colours[m-1],ring[r=(r+1)&15]);}
    else if(!(c=hard.colour(k,bank,ring[r=(r+1)&15])))return null;
    for(const bl of S.blends){const e=bl.get(k);if(!e)continue;c.getRGB(s,THREE.SRGBColorSpace);const f=e[3];
      return ring[r=(r+1)&15].setRGB((e[0]+(s.r*255-e[0])*f)/255,(e[1]+(s.g*255-e[1])*f)/255,(e[2]+(s.b*255-e[2])*f)/255,THREE.SRGBColorSpace);}
    return c;};
  const palette={has:k=>S.map[k]!==0,
    refines:(tone,k)=>refine.has(tone)||((S.map[k]!==0||hard.eligible(k))&&S.blends.some(m=>m.has(k)))||(HARD_TONES.has(tone)&&(S.map[k]!==0||hard.eligible(k)))||(S.scarp.has(k)&&SCARP_TONES.has(tone)),
    // toneCol: the area tint colour at k (when refines handed it over), the base for the scarp blend off natural ground.
    colour(k,bank,tone,toneCol){const w=S.scarp.get(k);
      // A tint handed over only for the scarp stays the blend's base (no edge where the scarp weight ends).
      const own=!tone||refine.has(tone)||S.blends.some(m=>m.has(k))||HARD_TONES.has(tone);if(!w)return own?natural(k,bank):null;
      const base=own?natural(k,bank)??toneCol:toneCol;if(!base)return null;
      const x=t.x0+(k%t.nx)*t.step,z=t.z0+Math.floor(k/t.nx)*t.step,v=vnoise(x,z,5,7),c=ring[r=(r+1)&15];
      const A=SCARP[0],Bc=SCARP[1];return c.setRGB(base.r+(A.r+(Bc.r-A.r)*v-base.r)*w,base.g+(A.g+(Bc.g-A.g)*v-base.g)*w,base.b+(A.b+(Bc.b-A.b)*v-base.b)*w);},
    // After the terrain is drawn nothing reads the palette again: drop the bake map, scarp weights and area references.
    release(){S.map=new Uint8Array(0);S.colours=[];S.blends=[];S.scarp=new Map();S.world=null;}};
  palettes.set(world.ground,palette);
  return palette;
}

// 256² RGBA detail, tileable, each channel normalised to mean 0.5: R grass (blade strokes), G earth (grit + pebbles), B rock
// (blotches, pits, broken fractures). Only fine features (≤ ~25 cm), so the 2.6 m tile has nothing to repeat visibly;
// mipmaps fade it to neutral with distance.
export const DETAIL_NORM=[[0.5087867886505544,257.7457079950583],[0.49580213390142225,286.90466953345265],[0.4721269884876784,245.2716695867235]];
export function groundDetailData(N=256){
  let seed=90217;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),M=N-1,NN=N*N;
  const R=new Float32Array(NN),G=new Float32Array(NN),B=new Float32Array(NN);
  const periodic=(P,s)=>{const L=new Float32Array(P*P),o=new Float32Array(NN),f=P/N;for(let j=0;j<P;j++)for(let i=0;i<P;i++)L[j*P+i]=hash2(i,j,s);
    const wx=new Float32Array(N),ix=new Int32Array(N);for(let x=0;x<N;x++){const fx=x*f,i=Math.floor(fx),u=fx-i;ix[x]=i;wx[x]=u*u*(3-2*u);}
    for(let y=0;y<N;y++){const j=ix[y],j1=(j+1)%P,sv=wx[y];for(let x=0;x<N;x++){const i=ix[x],i1=(i+1)%P,su=wx[x],A=L[j*P+i],Bb=L[j*P+i1],C=L[j1*P+i],D=L[j1*P+i1];
      o[y*N+x]=A+(Bb-A)*su+(C-A)*sv+(A-Bb-C+D)*su*sv;}}return o;};
  const p16=periodic(16,13),p32=periodic(32,12),p64=periodic(64,14);
  for(let k=0;k<NN;k++){R[k]=.5+(p32[k]-.5)*.3+(p64[k]-.5)*.25;G[k]=.5+(p32[k]-.5)*.3+(p64[k]-.5)*.2+(rnd()-.5)*.22;}
  for(let b=0;b<5000;b++){const x=rnd()*N,y=rnd()*N,a=rnd()*Math.PI*2,l=3+rnd()*6,v=rnd()<.55?.26:-.24,dx=Math.cos(a),dy=Math.sin(a);
    for(let s=0;s<l;s+=.7){const f=s/l;R[((Math.round(y+dy*s)&M)*N)+(Math.round(x+dx*s)&M)]+=v*(v>0?f:1-f)*.9;}}
  for(let p=0;p<700;p++){const x=Math.round(rnd()*N),y=Math.round(rnd()*N),r=.8+rnd()*2.6,v=rnd()<.6?.22:-.18;
    for(let yy=-4;yy<=4;yy++)for(let xx=-4;xx<=4;xx++){const d2=xx*xx+yy*yy;if(d2>(r+1)*(r+1))continue;
      G[((y+yy)&M)*N+((x+xx)&M)]+=d2<=r*r?v+(yy<0?.06:-.04):-.1;}}
  // Rock (21/45/85): blotches, solution pits and thin broken fractures (iso-lines of a fourth periodic field where a
  // blotch field lets them through).
  const p24=periodic(24,15);
  for(let k=0;k<NN;k++){const f=Math.abs(p24[k]-.5);B[k]=.5+(p16[k]-.5)*.55+(p32[k]-.5)*.35+(p64[k]-.5)*.2-(f<.035?(1-f/.035)*.32*smooth(.4,.62,p16[(k+N*37+91)&(NN-1)]):0)+(rnd()-.5)*.12;}
  for(let p=0;p<500;p++){const x=Math.round(rnd()*N),y=Math.round(rnd()*N),r=rnd()<.8?1:2;for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++)if(xx*xx+yy*yy<=r*r)B[((y+yy)&M)*N+((x+xx)&M)]-=.22;}
  const data=new Uint8Array(NN*4);
  // Mean → 127.5 and standard deviation → 40 code values per channel: the generator is deterministic, so its measured
  // mean/gain are constants.
  for(let ch=0;ch<3;ch++){const A=ch===0?R:ch===1?G:B,[m,g]=DETAIL_NORM[ch];
    for(let k=0;k<NN;k++){const v=Math.round(127.5+(A[k]-m)*g);data[k*4+ch]=v<0?0:v>255?255:v;}}
  for(let k=0;k<NN;k++)data[k*4+3]=255;
  return data;}

// Terrain material: base vertex colour × a detail factor. Two samples of the same texture: the ground-plan projection
// (world XZ, rotated 23.5° off the street grid, 2.6 m tile) and, blended in as the face steepens, a vertical projection
// on the dominant horizontal axis, so cliffs and steep banks keep square texels instead of corduroy streaks.
// The channel follows colour and slope: green → grass strokes, steep → rock, else earth grit. Pale colours (sand,
// pale stone) get a lower contrast.
export function groundMaterial(owned){
  const N=256,tex=new THREE.DataTexture(groundDetailData(N),N,N,THREE.RGBAFormat,THREE.UnsignedByteType);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps=true;tex.anisotropy=4;tex.colorSpace=THREE.NoColorSpace;tex.needsUpdate=true;owned.add(tex);
  const T=THREE.TSL,vc=T.vertexColor(),pw=T.positionWorld,n=T.normalWorld,ca=Math.cos(.41)/2.6,sa=Math.sin(.41)/2.6;
  const top=T.texture(tex,T.vec2(pw.x.mul(ca).sub(pw.z.mul(sa)),pw.x.mul(sa).add(pw.z.mul(ca))));
  // The vertical sample is taken only on steep fragments (branch with explicit gradients, valid in non-uniform flow), so
  // flat ground costs one sample.
  // the two side projections (x-facing faces use the z–y plane, z-facing faces the x–y plane) blend in a
  // narrow band around 45° azimuth instead of switching there (avoids a visible seam); outside the band each
  // steep fragment still takes one side sample, inside it two.
  const s=T.Fn(()=>{const ws=T.float(1).sub(T.smoothstep(.42,.72,n.y)),out=T.vec4(top).toVar(),side=T.vec4(0).toVar();
    const ax=T.abs(n.x),az=T.abs(n.z),wx=T.smoothstep(.4,.6,ax.div(ax.add(az).add(1e-4)));
    const ux=T.vec2(pw.z,pw.y).mul(1/2.6),uz=T.vec2(pw.x,pw.y).mul(1/2.6),gxx=T.dFdx(ux),gxy=T.dFdy(ux),gzx=T.dFdx(uz),gzy=T.dFdy(uz);
    T.If(ws.greaterThan(.001),()=>{
      T.If(wx.lessThan(.001),()=>{side.assign(T.texture(tex,uz).grad(gzx,gzy));})
        .ElseIf(wx.greaterThan(.999),()=>{side.assign(T.texture(tex,ux).grad(gxx,gxy));})
        .Else(()=>{side.assign(T.mix(T.texture(tex,uz).grad(gzx,gzy),T.texture(tex,ux).grad(gxx,gxy),wx));});
      out.assign(T.mix(top,side,ws));});
    return out;})();
  const grass=T.smoothstep(0,.035,vc.g.sub(T.max(vc.r,vc.b)));
  const rock=T.float(1).sub(T.smoothstep(.62,.86,n.y)).mul(T.float(1).sub(grass));
  const earth=T.float(1).sub(grass).sub(rock);   // grass + rock ≤ 1, so the three weights sum to one
  const d=s.r.mul(grass).add(s.g.mul(earth)).add(s.b.mul(rock));
  const amp=T.mix(T.float(.8),T.float(.42),T.smoothstep(.3,.5,T.dot(vc.rgb,T.vec3(.2126,.7152,.0722))));
  const m=new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:.95,metalness:0});
  m.colorNode=T.vec3(d.sub(.5).mul(amp).add(1));
  return m;}

// ---- Sparse vegetation on unowned natural ground (non-solid dressing). Kits carry a dark-base → light-top vertex shade.
function shade(g,lo,hi){const p=g.attributes.position.array,c=new Float32Array(p.length);let y0=Infinity,y1=-Infinity;
  for(let i=1;i<p.length;i+=3){y0=Math.min(y0,p[i]);y1=Math.max(y1,p[i]);}
  for(let i=0;i<p.length;i+=3){const f=(p[i+1]-y0)/(y1-y0||1),v=lo+(hi-lo)*f;c[i]=c[i+1]=c[i+2]=v;}
  g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;}
// five broader blades (11 cm at the base instead of 6 cm) with a softer tip highlight: fewer
// sub-pixel slivers at mid distance, fewer triangles, same draws.
function tuftGeometry(){const p=[],n=[];
  for(let b=0;b<5;b++){const a=b/5*Math.PI*2+.3,ca=Math.cos(a),sa=Math.sin(a),lean=.07+.05*(b%3)/2,hgt=.17+.07*((b*3)%5)/4,w=.055;
    const px=-sa*w,pz=ca*w;p.push(px,0,pz,-px,0,-pz,ca*lean,hgt,sa*lean);for(let q=0;q<3;q++)n.push(ca*.25,.97,sa*.25);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));return shade(g,.66,1.06);}
function lobeGeometry(lobes){const parts=lobes.map(([x,y,z,sx,sy,sz])=>{const g=new THREE.IcosahedronGeometry(1,0);g.scale(sx,sy,sz);g.translate(x,y,z);return g;});
  const p=[];for(const g of parts){const a=g.attributes.position.array;for(let i=0;i<a.length;i++)p.push(a[i]);g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return shade(g,.6,1.12);}

// Distance cull updater, built outside buildGround so its closure holds only the sector list (not the owner grid,
// candidates or bake of the builder's scope).
function groundCull(culled){
  const eye=new THREE.Vector3(),cull=new THREE.Object3D();cull.name='sj-ground-cull';cull.isLOD=true;cull.autoUpdate=true;
  cull.update=camera=>{eye.setFromMatrixPosition(camera.matrixWorld);
    for(const {mesh,limit} of culled){const b=mesh.boundingSphere;mesh.visible=eye.distanceTo(b.center)-b.radius<limit;}};
  return cull;}

export function buildGround(layout,{scene,own,mat,meshes,world,height}){
  const B=bakes.get(layout);if(!B)throw new Error('ground: bake not loaded (loadCity awaits the ground layout load hook)');
  const t=world.terrain,C=GROUND.clear,S=GROUND.scatterCell;
  // Candidate positions (hash-derived, as in the bake), then the owner index restricted to the cells they touch.
  const cell=8,key=(i,j)=>i*100003+j,need=new Set(),cand=[];
  for(let n=0;n<B.cells.length;n++){const id=B.cells[n],ci=id%B.CW,cj=(id-ci)/B.CW,code=B.codes[n];
    const x=t.x0+(ci+hash2(ci,cj,21))*S,z=t.z0+(cj+hash2(ci,cj,22))*S;cand.push([ci,cj,x,z,code]);
    for(const dx of [-1,1])for(const dz of [-1,1])need.add(key(Math.floor((x+dx)/cell),Math.floor((z+dz)/cell)));}
  const grid=new Map();
  const add=(ring,margin)=>{let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of ring){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}
    let it=null;
    for(let i=Math.floor((a-margin)/cell);i<=Math.floor((b+margin)/cell);i++)for(let j=Math.floor((c-margin)/cell);j<=Math.floor((d+margin)/cell);j++){const k=key(i,j);if(!need.has(k))continue;
      it??={ring,margin,m2:margin*margin,bb:[a-margin,b+margin,c-margin,d+margin]};let l=grid.get(k);if(!l)grid.set(k,l=[]);l.push(it);}};
  const segD2=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));const ex=x-a[0]-dx*u,ez=z-a[1]-dz*u;return ex*ex+ez*ez;};
  const hits=(x,z)=>{for(const it of grid.get(key(Math.floor(x/cell),Math.floor(z/cell)))??[]){const bb=it.bb;if(x<bb[0]||x>bb[1]||z<bb[2]||z>bb[3])continue;
      if(it.ring.length===2){if(segD2(x,z,it.ring[0],it.ring[1])<it.m2)return true;continue;}
      if(inRing(x,z,it.ring))return true;for(let q=0;q<it.ring.length;q++)if(segD2(x,z,it.ring[q],it.ring[(q+1)%it.ring.length])<it.m2)return true;}return false;};
  const boxRing=c=>{const {x:cx,z:cz}=c.centre,{x:hx,z:hz}=c.halfExtents,r=c.rotationY??0,cs=Math.cos(r),sn=Math.sin(r);
    return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([u,v])=>[cx+u*cs+v*sn,cz-u*sn+v*cs]);};
  // City buildings, roads and trees are bake inputs: the bake already dropped candidates near them (scatterCandidates).
  for(const p of world.plaza?.paving??[])add([p.a,p.b],p.width/2+C.ring);
  const owners=[world.gate,world.fort,world.corridor,world.plaza,...areasOf(world)].filter(a=>a&&a!==layout);
  const privateAt=owners.map(a=>a.offLimitsAt).filter(Boolean);
  const SKIP=new Set(['stations','walls','ends','places','runs','segs','segments','garitas','path','seaLine','wallLine']);
  for(const a of owners){
    for(const c of a.colliders??[]){const r=c.outer?c.outer.map(p=>[p.x,p.z]):c.centre?boxRing(c):null;if(r)add(r,C.collider);}
    for(const tp of a.tops??[])add(tp.poly.map(p=>[p.x,p.z]),C.ring);
    for(const c of a.cuts??[])add(c.ring??[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]],C.ring);
    for(const s of [...(a.surfaces??[]),...(a.brick??[]),...(a.paved??[]),...(a.ownedGround??[])])if(s.ring?.length>=3)add(s.ring,C.ring);
    // `sportsRings` (seams contract, 2026-11-19): reserved play ground, apron included — nothing planted inside or over it.
    // `coverRings`: render-only covers an area draws over the DEM (e.g. landmarks' Palomas scarp skin) — nothing beneath.
    for(const s of a.coverRings??[])if(s?.ring?.length>=3)add(s.ring,C.ring);
    for(const s of a.sportsRings??[])if(s?.ring?.length>=3)add(s.ring,1.4);  // 1.4 m: the largest scatter crown (sea grape) stays off it
    for(const f of [...(a.floorTriangles??[]),...(a.groundTriangles??[])])add(f.map(p=>[p[0],p[2]]),C.ring);
    for(const [field,v] of Object.entries(a)){if(SKIP.has(field)||!Array.isArray(v))continue;
      for(const o of v)if(o&&typeof o==='object'&&!Array.isArray(o)&&Number.isFinite(o.x)&&Number.isFinite(o.z)&&!o.outer)add([[o.x-.01,o.z],[o.x+.01,o.z]],C.point);}}
  const tints=[world.gate?.tint,world.fort?.tint,...areasOf(world).map(a=>a.tint)].filter(m=>m?.size);
  const cellOf=(x,z)=>Math.floor((z-t.z0)/t.step)*t.nx+Math.floor((x-t.x0)/t.step);
  const tmask=new Uint8Array(t.nx*t.nz);for(const m of tints)for(const k of m.keys())tmask[k]=1;
  const tinted=k=>tmask[k]|tmask[k+1]|tmask[k+t.nx]|tmask[k+t.nx+1];
  const clear=(x,z)=>{if(tinted(cellOf(x,z))||hits(x,z)||plazaGroundBase(x,z,world))return null;const y=height(x,z);return privateAt.some(f=>f(x,z,y))?null:y;};
  const kinds={tuft:[],shrub:[],grape:[]},NAMES=[null,'tuft','shrub','grape'],pt=new THREE.Object3D(),col=new THREE.Color();
  for(const [ci,cj,x,z,code] of cand){const kind=NAMES[code&3],y=clear(x,z);if(y===null)continue;
    kinds[kind].push({x,z,y,a:hash2(ci,cj,24)*Math.PI*2,s:hash2(ci,cj,25),v:hash2(ci,cj,26)});
    // Tufts come in loose clumps of up to four inside the same cell (children passed the class test in the bake).
    for(let q=0;q<3;q++){if(!(code>>2&1<<q))continue;const qx=x+(hash2(ci,cj,30+q)-.5)*1.6,qz=z+(hash2(ci,cj,40+q)-.5)*1.6,qy=clear(qx,qz);if(qy===null)continue;
      kinds.tuft.push({x:qx,z:qz,y:qy,a:hash2(ci,cj,50+q)*Math.PI*2,s:hash2(ci,cj,60+q),v:hash2(ci,cj,70+q)});}}
  // Lowest ground under a footprint (so nothing hovers on its downhill side).
  const foot=(o,r)=>{let m=o.y;for(let q=0;q<8;q++){const a=q/8*Math.PI*2;m=Math.min(m,height(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r));}return m;};
  const SC=['#62803f','#a99c69','#4f6638','#5e7341','#74904c','#5d6e3a','#6f6a3c'].map(c=>new THREE.Color(c));
  const pick=(c,a,b,w)=>{c.r=a.r+(b.r-a.r)*w;c.g=a.g+(b.g-a.g)*w;c.b=a.b+(b.b-a.b)*w;return c;};
  const spec={
    tuft:{g:own(tuftGeometry()),place:o=>{const s=.8+o.s*.7;pt.position.set(o.x,Math.min(o.y-.04,foot(o,.06*s)-.02),o.z);   // seated on the lowest ground under the blade bases (repairs: no downhill gap)pt.rotation.set(0,o.a,0);pt.scale.set(s,s*(.8+o.v*.5),s);
      return pick(col,SC[0],SC[1],o.v*.8);}},
    shrub:{g:own(lobeGeometry([[0,.1,0,1,.55,1],[.6,.02,.25,.62,.4,.6],[-.5,.04,-.35,.66,.42,.58],[.1,.03,.7,.5,.36,.5],[-.15,.28,.1,.5,.3,.45]])),place:o=>{const r=.3+o.s*.32;
      pt.position.set(o.x,foot(o,r*.9)+r*.1,o.z);pt.rotation.set(0,o.a,0);pt.scale.set(r,r*(.7+o.v*.4),r);
      return pick(col,SC[3],SC[4],o.v*.7);}},
    // Sea grape: broad olive lobes with rusty old leaves; the lowest lobes sit into the lowest ground under the crown.
    grape:{g:own(lobeGeometry([[0,.25,0,1.1,.6,1],[.8,.1,.3,.75,.45,.8],[-.7,.12,-.35,.8,.5,.7],[.1,.1,-.75,.7,.45,.6],[0,-.15,0,.9,.3,.9]])),place:o=>{const r=.6+o.s*.5;
      pt.position.set(o.x,foot(o,r*1.3)+r*.12,o.z);pt.rotation.set(0,o.a,0);pt.scale.set(r,r*(.8+o.v*.3),r);
      return pick(col,SC[5],SC[6],o.v);}},
  };
  const material=mat({color:'#ffffff',vertexColors:true,roughness:.95,metalness:0,side:THREE.DoubleSide});
  const stats={candidates:cand.length,sectors:0};
  // Perf: spatial sectors with tight bounds (tufts 256 m, shrubs/sea grape 512 m) so frustum culling works, and a distance
  // cull in the style of sj-fabric.js: an isLOD updater, added before the meshes, hides sectors whose nearest point is
  // beyond the plant's legible range (tufts 120 m, shrubs/grape 350 m). No plant casts shadows.
  const SECTOR={tuft:256,shrub:512,grape:512},LIMIT={tuft:120,shrub:350,grape:350},culled=[];
  const cull=groundCull(culled);scene.add(cull);meshes.push(cull);
  for(const [kind,list] of Object.entries(kinds)){stats[kind]=list.length;if(!list.length)continue;
    const sp=spec[kind],bins=new Map(),size=SECTOR[kind];
    for(const o of list){const key=Math.floor(o.x/size)*10007+Math.floor(o.z/size);let b=bins.get(key);if(!b)bins.set(key,b=[]);b.push(o);}
    for(const key of [...bins.keys()].sort((a,b)=>a-b)){const part=bins.get(key);
      const mesh=new THREE.InstancedMesh(sp.g,material,part.length);mesh.name='sj-ground-'+kind;
      part.forEach((o,i)=>{const c=sp.place(o);pt.updateMatrix();mesh.setMatrixAt(i,pt.matrix);mesh.setColorAt(i,c);});
      mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);
      culled.push({mesh,limit:LIMIT[kind]});stats.sectors++;}}
  // Construction data is garbage from here on: the bake buffers and the palette state (the updater holds only `culled`).
  bakes.delete(layout);palettes.get(layout)?.release();palettes.delete(layout);
  return stats;
}
