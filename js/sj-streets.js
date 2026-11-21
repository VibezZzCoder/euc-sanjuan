/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// City-wide street ground and dressing (draws sj-streets-layout.js) — © 2026 VibezZzCoder, MIT.
// References: Wikimedia Commons curid=151596781, curid=182287159, curid=151530324, curid=99177670 (blue-grey adoquines, narrow grey sidewalks, painted yellow
// kerb line), curid=122798497 (adoquín colour/size), curid=182287159, curid=158245806, curid=99177670, curid=53594779 (black bracket lanterns on corners), curid=182287159 (round street bollards),
// curid=80420009, curid=195143828, curid=122996449 (broad shade trees), curid=80155724, curid=80420696, curid=137843368, curid=71816504 (coastal palms).
// One draped mesh: every paved piece is clipped onto the ORIGINAL terrain triangles (exact physical ground), one overlay
// layer with the shared −2/−2 depth offset (no two overlays on the same ground). A per-vertex street frame
// (across, along, carriage half-width, kind) lets the shader draw the carriageway, the yellow kerb line and the slab
// sidewalk from one vertex set: no extra kerb geometry.
import * as THREE from 'three/webgpu';
import { glowLamp } from './sj-glow.js';
import {tallPalm} from './sj-palm.js';
import {subtractRing,signedArea} from './sj-paving.js';
import {bandSpan} from './sj-streets-layout.js';
import {hasher} from './sj-streets-cache.js';

const T=THREE.TSL;
export const KERB_COLOUR='#cfa848';

// Texture period (m): every street texture repeats an integer number of times per PERIOD in both directions, so each
// piece's street coordinates can be shifted by a multiple of it and packed into 16-bit centimetres.
export const PERIOD=7.2,UNIT=100/32767;
// Exact clip of the terrain triangles under each paved piece. Vertices are shared within a vertex-sharing group (one
// street segment: carriageway and margins; or one mapped area); pieces are ordered in 128 m tiles and packed, per material
// (kind, plus the carriageway half-width on kerbed streets), into chunks of < 65,536 vertices (16-bit indices).
// Attributes: position (float32) and street (snorm16 ×2, centimetres): the SIGNED across coordinate (the shader takes
// |across| − half-width after interpolation, so the bond stays uniform across the centreline) and the along coordinate;
// unkerbed pieces shift both by whole texture periods per group. Parking/concrete/cycle and unkerbed asphalt have none.
export const FREE=320,SECTOR=Number(globalThis.process?.env?.SJ_SECTOR??256),KIT_SECTOR=Number(globalThis.process?.env?.SJ_KIT??512),SECTOR_OX=Number(globalThis.process?.env?.SJ_SOX??0),SECTOR_OZ=Number(globalThis.process?.env?.SJ_SOZ??0);
const sectorOf=(x,z,S=SECTOR)=>Math.floor((x-SECTOR_OX)/S)+','+Math.floor((z-SECTOR_OZ)/S);
// Bins of items on a `size` grid (draw budget): a bin lighter than `min` (by `weight`) joins its heaviest
// neighbouring bin (8-neighbourhood) when the joined bounds stay within `span` m, lightest first; a few-triangle batch
// otherwise costs a draw of its own. Returns item → bin key. `box(it)` gives [minX,maxX,minZ,maxZ].
export function bins(items,box,weight,size,min,span=560){
  const B=new Map(),of=new Map();
  for(const it of items){const b0=box(it),i=Math.floor(((b0[0]+b0[1])/2-SECTOR_OX)/size),j=Math.floor(((b0[2]+b0[3])/2-SECTOR_OZ)/size),k=i+','+j;
    let b=B.get(k);if(!b)B.set(k,b={k,i,j,w:0,bb:[Infinity,-Infinity,Infinity,-Infinity],items:[]});
    b.w+=weight(it);b.bb=[Math.min(b.bb[0],b0[0]),Math.max(b.bb[1],b0[1]),Math.min(b.bb[2],b0[2]),Math.max(b.bb[3],b0[3])];b.items.push(it);}
  for(const b of [...B.values()].sort((a,c)=>a.w-c.w||(a.k<c.k?-1:1))){if(b.w>=min||B.get(b.k)!==b)continue;let best=null,bestBB=null;
    for(const c of B.values()){if(c===b||Math.abs(c.i-b.i)>1||Math.abs(c.j-b.j)>1)continue;
      const u=[Math.min(b.bb[0],c.bb[0]),Math.max(b.bb[1],c.bb[1]),Math.min(b.bb[2],c.bb[2]),Math.max(b.bb[3],c.bb[3])];
      if(u[1]-u[0]>span||u[3]-u[2]>span)continue;if(!best||c.w>best.w||c.w===best.w&&c.k<best.k){best=c;bestBB=u;}}
    if(!best)continue;best.w+=b.w;best.bb=bestBB;best.items.push(...b.items);B.delete(b.k);}
  for(const b of B.values())for(const it of b.items)of.set(it,b.k);return of;}
// Kinds whose surface needs no street coordinates (no kerb, isotropic texture): textured in world space, no attribute.
export const WORLD_UV=new Set(['parking','concrete','cycle','square','apron']);
// Draw-call cap: all paving of a 512 m sector is drawn by two meshes, `kerbed` (kerbed carriageways, the
// shader branches on the per-vertex half width and sett/asphalt flag) and `open` (every other kind, per-vertex kind code).
// Per-vertex `street` (Int16×4, normalised, ×327.67): across, along (street-coordinate kinds; 0 for world-UV kinds),
// then kerbed: half width, sett flag; open: kind code, 0.
export const KIND_CODE={sett:0,asphalt:1,parking:2,slab:3,square:4,concrete:5,apron:6,brick:7,cycle:8,steps:9};
// Later ground owners (`exclude`: convex plan rings, e.g. the wall-foot strips, whose tops replace the terrain) are
// subtracted from the pieces here, at draw time: those owners are built after this area's layout.
export function laterOwners(world){return (world?.wallFoot?.cuts??[]).filter(c=>c.kind==='wall-foot').map(c=>c.ring);}
// Wall lanterns vs the facade kit built after this area (`fabric` parts: openings, leaves, balcony rails, boxes): a lantern
// keeps clear of every part on its wall (0.2 m beside an opening/rail, its plate/body/arm outside every box). It tries
// 3.4, 3.6 and 3.2 m above its ground and is dropped if all collide. Records: [sector,x,y,z,angle,sx,sy,sz,r,g,b,shear].
export function placeLanterns(lanterns,world){
  const F=world?.fabric?.fabric?.parts;if(!F)return lanterns;const STRIDE=12,G=new Map(),key=(i,j)=>i*100003+j;
  for(const [kind,a] of Object.entries(F))for(let o=0;o<a.length;o+=STRIDE){const k=key(Math.floor(a[o+1]/8),Math.floor(a[o+3]/8));
    if(!G.has(k))G.set(k,[]);G.get(k).push([kind,a,o]);}
  const near=(x,z)=>{const out=[];for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)out.push(...(G.get(key(Math.floor(x/8)+i,Math.floor(z/8)+j))??[]));return out;};
  const hits=(l,y)=>{const [x,,z]=l.at;
    for(const [kind,a,o] of near(x,z)){const ang=a[o+4],ux=Math.cos(ang),uz=-Math.sin(ang),nx=Math.sin(ang),nz=Math.cos(ang);
      const dx=x-a[o+1],dz=z-a[o+3],du=dx*ux+dz*uz,dn=dx*nx+dz*nz,sx=a[o+5],sy=a[o+6],sz=a[o+7],py=a[o+2];
      if(kind==='box'||kind==='solid'){
        // Lantern sample points: plate (0.02 out), arm mid (0.27), body (0.52) at their heights; box centred on its origin.
        for(const [d,h] of [[.02,-.2],[.02,.1],[.27,0],[.52,.05],[.52,.4]]){const pu=du+d*(l.dir[0]*ux+l.dir[1]*uz),pn=dn+d*(l.dir[0]*nx+l.dir[1]*nz);
          if(Math.abs(pu)<sx/2+.05&&Math.abs(y+h-py)<sy/2+.05&&Math.abs(pn)<sz/2+.05)return true;}
        continue;}
      // Openings/leaves/rails: same wall (facing the lantern's way, on its plane), overlapping along and in height.
      if(l.dir[0]*nx+l.dir[1]*nz<.9||Math.abs(dn)>.6)continue;
      const lo=kind==='rail'?py-.35:py,hi=py+sy+(kind==='rail'?.1:.15);
      if(Math.abs(du)<sx/2+.2&&y+.6>lo&&y-.25<hi)return true;}
    return false;};
  const out=[];
  for(const l of lanterns){const g=l.at[1]-3.4;let y=null;for(const h of [3.4,3.6,3.2])if(!hits(l,g+h)){y=g+h;break;}
    if(y!==null)out.push({...l,at:[l.at[0],y,l.at[2]]});}
  return out;
}

export function streetGeometry(layout,exclude=[]) {
  const t=layout.terrain,{x0,z0,step,nx,heights}=t,chunks=[];let triangles=0,vertices=0;
  const bufs=new Map(),groups=new Map();let pos,att,idx,cur;
  // Vertex-sharing groups: one street segment (core, margins and their split pieces share its frame) or one mapped area.
  // Offsets are per group, so shared boundary vertices carry identical attributes.
  const groupOf=p=>p.frame??('a'+p.area);
  const mins=new Map();for(const p of layout.paved)if(!p.frame){let m=mins.get(p.area);if(!m)mins.set(p.area,m=[Infinity,Infinity]);
    for(const [x,z] of p.ring){m[0]=Math.min(m[0],x*.973-z*.23);m[1]=Math.min(m[1],x*.23+z*.973);}}
  for(const p of layout.paved){const g=groupOf(p);if(groups.has(g))continue;
    if(p.frame)groups.set(g,{offA:-36,offB:Math.floor(p.frame.along/PERIOD)*PERIOD});
    else{const m=mins.get(p.area);groups.set(g,{offA:Math.floor(m[0]/PERIOD)*PERIOD,offB:Math.floor(m[1]/PERIOD)*PERIOD});}}
  // (flush runs once per material key: when it first appears and at the end, so no vertex map outlives its buffer.)
  // Buffers are growable typed arrays (same element conversions as building them from plain arrays at the end).
  const typed=(T,n=1<<14)=>({a:new T(n),n:0}),room=(g,m)=>{if(g.n+m>g.a.length){const b=new g.a.constructor(Math.max(g.a.length*2,g.n+m));b.set(g.a);g.a=b;}};
  const flush=k=>{const b=bufs.get(k);const mk=k.split('@')[0];
    if(b?.idx.n){const nv=b.pos.n/3;chunks.push({material:mk,sector:k.split('@')[1],position:b.pos.a.slice(0,b.pos.n),street:b.att.a.slice(0,b.att.n),index:nv>65535?b.idx.a.slice(0,b.idx.n):Uint16Array.from(b.idx.a.subarray(0,b.idx.n))});}
    if(b)vertices+=b.pos.n/3;bufs.set(k,{pos:typed(Float32Array,1<<16),att:typed(Int16Array,1<<16),idx:typed(Uint32Array,1<<16)});};
  // Pieces ordered in 128 m tiles inside 512 m sectors (no batch spans more than ~512 m).
  const ringBox=r=>{let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const q of r){if(q[0]<a)a=q[0];if(q[0]>b)b=q[0];if(q[1]<c)c=q[1];if(q[1]>d)d=q[1];}return [a,b,c,d];};
  // Sectors: SECTOR m bins by piece centre; a bin under 1,500 m² of paving joins a neighbour (bins above).
  const binOf=bins(layout.paved,p=>ringBox(p.ring),p=>Math.abs(signedArea(p.ring)),SECTOR,1500);
  const order=layout.paved.map((p,i)=>{const r=p.ring,cx=r.reduce((a,q)=>a+q[0],0)/r.length,cz=r.reduce((a,q)=>a+q[1],0)/r.length;
    return {p,i,sector:binOf.get(p),key:Math.floor((cx-x0)/128)*1000+Math.floor((cz-z0)/128)};}).sort((a,b)=>a.key-b.key||a.i-b.i);
  // Exclusion index (8 m grid) over the later owners' rings.
  const EX=new Map(),ek=(i,j)=>i*100003+j;
  for(const r of exclude){const xs=r.map(p=>p[0]),zs=r.map(p=>p[1]),bb=[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];
    const item={r:signedArea(r)<0?[...r].reverse():r,bb};
    for(let i=Math.floor(bb[0]/8);i<=Math.floor(bb[1]/8);i++)for(let j=Math.floor(bb[2]/8);j<=Math.floor(bb[3]/8);j++){const k=ek(i,j);if(!EX.has(k))EX.set(k,[]);EX.get(k).push(item);}}
  const yieldTo=piece=>{if(!EX.size)return [piece];const r=piece.ring,xs=r.map(p=>p[0]),zs=r.map(p=>p[1]),bb=[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)],hits=new Set();
    for(let i=Math.floor(bb[0]/8);i<=Math.floor(bb[1]/8);i++)for(let j=Math.floor(bb[2]/8);j<=Math.floor(bb[3]/8);j++)for(const it of EX.get(ek(i,j))??[])
      if(it.bb[0]<bb[1]&&bb[0]<it.bb[1]&&it.bb[2]<bb[3]&&bb[2]<it.bb[3])hits.add(it);
    if(!hits.size)return [piece];let ps=[r];for(const it of hits){ps=ps.flatMap(p=>subtractRing(p,it.r));if(!ps.length)break;}
    return ps.filter(p=>p.length>=3&&Math.abs(signedArea(p))>1e-4).map(ring=>({...piece,ring}));};
  // Three passes (triangle budget). 1: every piece is clipped onto the terrain triangles it touches, as
  // before; fragments are kept per merge set — pieces sharing a material, kind, half width and (for street-coordinate
  // kinds) vertex-sharing group, i.e. the same linear attribute field. 2: a terrain triangle the set covers completely
  // (fragment areas sum to the triangle) is drawn ONCE as that triangle instead of one fan per fragment (the gutter
  // line and corner splits inside a street no longer multiply its triangles); every vertex a partial fragment puts on a
  // terrain edge is registered. 3: emission — a whole triangle carries the registered points of its three edges (no
  // T-junctions against its neighbours' fragments). Same planes, same attribute fields: the drawn look is unchanged.
  const sets=new Map(),gid=new Map();let nSets=0;
  const fragMeta=typed(Int32Array,1<<20),fragXYZ=typed(Float64Array,1<<20),fragArea=typed(Float64Array,1<<18);   // meta: set, tri (k·2+w), start, count (count 0 = whole)
  const TRI=step*step/2;let RT=new Float64Array(4096),RB=new Float64Array(4096);
  // Points registered per terrain edge: open-addressing table edge → first/last node; nodes in typed arrays, kept in
  // insertion order (as the lists they replace).
  let EC=1<<17,EM=EC-1,eKey=new Int32Array(EC).fill(-1),eFirst=new Int32Array(EC),eLast=new Int32Array(EC),eN=0;
  let epXYZ=new Float64Array(3*(1<<16)),epNext=new Int32Array(1<<16),epN=0;
  const eSlot=e=>(Math.imul(e,-1640531535)>>>0)&EM;
  const epHead=e=>{let j=eSlot(e);while(eKey[j]!==-1){if(eKey[j]===e)return eFirst[j];j=(j+1)&EM;}return -1;};
  const hasPts=new Uint8Array(3*nx*t.nz);   // terrain edges that carry a registered point
  const epAdd=(e,x,y,z)=>{hasPts[e]=1;if(epN===epNext.length){const a=new Float64Array(epXYZ.length*2);a.set(epXYZ);epXYZ=a;const b=new Int32Array(epNext.length*2);b.set(epNext);epNext=b;}
    const n=epN++;epXYZ[n*3]=x;epXYZ[n*3+1]=y;epXYZ[n*3+2]=z;epNext[n]=-1;let j=eSlot(e);
    while(eKey[j]!==-1){if(eKey[j]===e){epNext[eLast[j]]=n;eLast[j]=n;return;}j=(j+1)&EM;}
    eKey[j]=e;eFirst[j]=n;eLast[j]=n;if(++eN>EC*.6){const oK=eKey,oF=eFirst,oL=eLast;EC*=2;EM=EC-1;eKey=new Int32Array(EC).fill(-1);eFirst=new Int32Array(EC);eLast=new Int32Array(EC);
      for(let i=0;i<oK.length;i++)if(oK[i]!==-1){let q=eSlot(oK[i]);while(eKey[q]!==-1)q=(q+1)&EM;eKey[q]=oK[i];eFirst[q]=oF[i];eLast[q]=oL[i];}}};let CA=new Float64Array(3*64),CB=new Float64Array(3*64);
  for(const {p:whole,sector} of order)for(const piece of yieldTo(whole)){
    const r=piece.ring,n=r.length,s=Math.sign(r.reduce((a,p,i)=>{const q=r[(i+1)%n];return a+p[0]*q[1]-q[0]*p[1];},0));
    // Half-planes: inside ⇔ e(p) ≥ 0.
    const E=r.map((a,i)=>{const b=r[(i+1)%n],ex=(b[0]-a[0])*s,ez=(b[1]-a[1])*s;return [-ez,ex,ez*a[0]-ex*a[1]];});
    const kerbed=piece.hw<FREE-20,plain=WORLD_UV.has(piece.kind)||piece.kind==='asphalt'&&!kerbed,mat='ground@'+sector;
    const g=groupOf(piece);if(!gid.has(g))gid.set(g,gid.size);
    const key=mat+'|'+(plain?'':gid.get(g))+'|'+piece.kind+':'+piece.hw;let S=sets.get(key);
    if(!S){const f=piece.frame,code=KIND_CODE[piece.kind]??1,grp=groups.get(g),offA=grp.offA,offB=grp.offB;
      const across=(x,z)=>f?(x-f.o[0])*f.n[0]+(z-f.o[1])*f.n[1]:x*.973-z*.23,along=(x,z)=>f?f.along+(x-f.o[0])*f.u[0]+(z-f.o[1])*f.u[1]:x*.23+z*.973;
      S={id:nSets++,mat,plain,pv0:kerbed?Math.round(piece.hw*100):code*100,pv1:kerbed?(piece.kind==='sett'?200:100):0,offB,along,
        edge:kerbed?(x,z)=>across(x,z):(x,z)=>across(x,z)-offA,};sets.set(key,S);}
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const p of r){if(p[0]<minX)minX=p[0];if(p[0]>maxX)maxX=p[0];if(p[1]<minZ)minZ=p[1];if(p[1]>maxZ)maxZ=p[1];}
    const i0=Math.max(0,Math.floor((minX-x0)/step)),i1=Math.min(nx-2,Math.floor((maxX-x0)/step)),j0=Math.max(0,Math.floor((minZ-z0)/step)),j1=Math.min(t.nz-2,Math.floor((maxZ-z0)/step));
    // Edge values at the four cell corners (shared by both triangles); the blocked-cell test (private-ground probes) runs
    // only for cells a triangle of this piece actually touches.
    const blockedHere=layout.drawBlocked?(i,j)=>layout.drawBlocked(i,j,piece.mode??'strict'):layout.cellBlocked;
    if(3*(E.length+4)>CA.length){CA=new Float64Array(3*(E.length+4));CB=new Float64Array(3*(E.length+4));}
    const nE=E.length,cv=layout.covered;
    for(let j=j0;j<=j1;j++){const sp=bandSpan(r,z0+j*step,z0+(j+1)*step);if(!sp)continue;
     const ia=Math.max(i0,Math.floor((sp[0]-x0)/step)-1),ib=Math.min(i1,Math.floor((sp[1]-x0)/step)+1);
     // Edge values at this row's corner points, computed once per corner (grid coordinates are whole metres, so
     // x + step is exactly the next column's x: the same values the per-cell evaluation produced).
     const nW=ib-ia+2,zr=z0+j*step,zr2=zr+step;if(nE*nW>RT.length){RT=new Float64Array(nE*nW*2);RB=new Float64Array(nE*nW*2);}
     for(let q=0;q<nE;q++){const e=E[q],e0=e[0],e1=e[1],e2=e[2],o=q*nW;for(let c=0;c<nW;c++){const x=x0+(ia+c)*step;RT[o+c]=e0*x+e1*zr+e2;RB[o+c]=e0*x+e1*zr2+e2;}}
     for(let i=ia;i<=ib;i++){
      const x=x0+i*step,z=zr,k=j*nx+i,xs=x+step,zs=zr2,c0=i-ia;
      const cA=cv[k],cB=cv[k+1],cC=cv[k+nx],cD=cv[k+nx+1],skip1=cA&&cB&&cC,skip2=cB&&cC&&cD;  // under a building mass
      if(skip1&&skip2)continue;
      let out1=!!skip1,all1=true,out2=!!skip2,all2=true;
      for(let q=0;q<nE&&!(out1&&out2);q++){const o=q*nW+c0,a=RT[o],b=RT[o+1],c=RB[o],d=RB[o+1];
        if(!out1){if(a<0&&c<0&&b<0)out1=true;else if(a<0||c<0||b<0)all1=false;}
        if(!out2){if(b<0&&c<0&&d<0)out2=true;else if(b<0||c<0||d<0)all2=false;}}
      if(out1&&out2||blockedHere(i,j))continue;
      for(let w2=0;w2<2;w2++){
        if(w2?out2:out1)continue;
        const all=w2?all2:all1,tid=k*2+w2;
        if(all){room(fragMeta,4);const F=fragMeta.a,o=fragMeta.n;F[o]=S.id;F[o+1]=tid;F[o+2]=0;F[o+3]=0;fragMeta.n=o+4;room(fragArea,1);fragArea.a[fragArea.n++]=TRI;continue;}
        // Clip in scratch buffers (x,y,z triples; ping-pong): the same arithmetic as before, no per-vertex arrays.
        let P=CA,Q=CB,n=3;
        if(w2){P[0]=xs;P[1]=heights[k+1];P[2]=z;P[3]=x;P[4]=heights[k+nx];P[5]=zs;P[6]=xs;P[7]=heights[k+nx+1];P[8]=zs;}
        else{P[0]=x;P[1]=heights[k];P[2]=z;P[3]=x;P[4]=heights[k+nx];P[5]=zs;P[6]=xs;P[7]=heights[k+1];P[8]=z;}
        for(let h=0;h<nE&&n>=3;h++){const e=E[h],e0=e[0],e1=e[1],e2=e[2];let m=0;
          for(let q=0;q<n;q++){const pq=q*3,wq=((q+1)%n)*3,dp=e0*P[pq]+e1*P[pq+2]+e2,dw=e0*P[wq]+e1*P[wq+2]+e2;
            if(dp>=0){Q[m*3]=P[pq];Q[m*3+1]=P[pq+1];Q[m*3+2]=P[pq+2];m++;}
            if((dp>=0)!==(dw>=0)){const u=dp/(dp-dw);Q[m*3]=P[pq]+(P[wq]-P[pq])*u;Q[m*3+1]=P[pq+1]+(P[wq+1]-P[pq+1])*u;Q[m*3+2]=P[pq+2]+(P[wq+2]-P[pq+2])*u;m++;}}
          const t=P;P=Q;Q=t;n=m;}
        if(n<3)continue;
        // A clipped fragment wholly under a building mass (all corners inside one footprint) is never seen.
        {let inside=true,cx=0,cz=0;for(let q=0;q<n;q++){cx+=P[q*3];cz+=P[q*3+2];if(inside&&!layout.insideMass(P[q*3],P[q*3+2]))inside=false;}
          if(inside&&layout.insideMass(cx/n,cz/n))continue;}
        let ar=0;for(let q=0;q<n;q++){const a=q*3,b=((q+1)%n)*3;ar+=P[a]*P[b+2]-P[b]*P[a+2];}
        room(fragArea,1);fragArea.a[fragArea.n++]=Math.abs(ar)/2;
        room(fragMeta,4);{const F=fragMeta.a,o=fragMeta.n;F[o]=S.id;F[o+1]=tid;F[o+2]=fragXYZ.n;F[o+3]=n;fragMeta.n=o+4;}
        room(fragXYZ,n*3);{const X=fragXYZ.a;let o=fragXYZ.n;for(let q=0;q<n*3;q++)X[o++]=P[q];fragXYZ.n=o;}}}}
  }
  const byId=[...sets.values()];
  const M=fragMeta.a,XYZ=fragXYZ.a,nF=fragMeta.n,fragPoly=f=>{const out=[];for(let q=0;q<M[f+3];q++){const o=M[f+2]+q*3;out.push([XYZ[o],XYZ[o+1],XYZ[o+2]]);}return out;};
  // Partly covered terrain triangles: the fragments of one set in one triangle are merged into one polygon and the
  // vertices that only end a seam BETWEEN fragments of that set (gutter lines, corner splits, segment joints) are dropped
  // where the boundary runs straight through them — on both sides of a terrain edge alike, so no T-junction appears.
  // Anything unusual (several loops, a non-convex union) keeps its fragments.
  const merge=polys=>{const V=[],VK=[],idOf=p=>{const k=Math.round(p[0]*1e6)*4e9+Math.round(p[2]*1e6);let i=VK.indexOf(k);if(i<0){i=V.length;VK.push(k);V.push(p);}return i;};
    const F=polys.map(p=>p.map(idOf)),edges=[];
    for(const f of F)for(let q=0;q<f.length;q++){const a=f[q],b=f[(q+1)%f.length];if(a===b)continue;
      const A=V[a],B=V[b],dx=B[0]-A[0],dz=B[2]-A[2],L2=dx*dx+dz*dz,mids=[];
      for(let v=0;v<V.length;v++){if(v===a||v===b)continue;const P=V[v],u=((P[0]-A[0])*dx+(P[2]-A[2])*dz)/L2;if(u<=1e-9||u>=1-1e-9)continue;
        if(Math.abs((P[0]-A[0])*dz-(P[2]-A[2])*dx)<1e-6*Math.sqrt(L2))mids.push([u,v]);}
      if(mids.length>1)mids.sort((x,y)=>x[0]-y[0]);let prev=a;for(const [,v] of mids){edges.push(prev,v);prev=v;}edges.push(prev,b);}
    // (Small polygons: linear scans instead of Maps — same tests.)
    const nV=V.length,seam=new Uint8Array(nV),next=new Int32Array(nV).fill(-1);let nNext=0,first=-1,nSeam=0;
    const has=(a,b)=>{for(let e=0;e<edges.length;e+=2)if(edges[e]===a&&edges[e+1]===b)return true;return false;};
    for(let e=0;e<edges.length;e+=2){const a=edges[e],b=edges[e+1];if(has(b,a)){if(!seam[a]){seam[a]=1;nSeam++;}if(!seam[b]){seam[b]=1;nSeam++;}continue;}
      if(next[a]!==-1)return polys;next[a]=b;nNext++;if(first<0)first=a;}
    if(!nSeam||nNext<3)return polys;
    const start=first,loop=[start];for(let v=next[start];v!==start;v=next[v]){if(v===-1||loop.length>nNext)return polys;loop.push(v);}
    if(loop.length!==nNext)return polys;
    let ring=loop;for(let again=true;again&&ring.length>3;){again=false;
      for(let q=0;q<ring.length;q++){if(!seam[ring[q]])continue;const A=V[ring[(q+ring.length-1)%ring.length]],B=V[ring[q]],C=V[ring[(q+1)%ring.length]];
        const cr=(B[0]-A[0])*(C[2]-A[2])-(B[2]-A[2])*(C[0]-A[0]),fw=(B[0]-A[0])*(C[0]-B[0])+(B[2]-A[2])*(C[2]-B[2]);
        if(Math.abs(cr)<=1e-7*Math.hypot(C[0]-A[0],C[2]-A[2])&&fw>0){ring=ring.filter((_,i)=>i!==q);again=true;break;}}}
    const P=ring.map(i=>V[i]);let sg=0;
    for(let q=0;q<P.length;q++){const A=P[q],B=P[(q+1)%P.length],C=P[(q+2)%P.length],cr=(B[0]-A[0])*(C[2]-A[2])-(B[2]-A[2])*(C[0]-A[0]);
      if(Math.abs(cr)<1e-12)continue;const t=Math.sign(cr);if(!sg)sg=t;else if(t!==sg)return polys;}
    // The merged polygon must cover exactly the fragments' area (guards near-collinear seams).
    const area=Q=>{let a=0;for(let q=0;q<Q.length;q++){const A=Q[q],B=Q[(q+1)%Q.length];a+=A[0]*B[2]-B[0]*A[2];}return Math.abs(a)/2;};
    let sum=0;for(const p of polys)sum+=area(p);if(Math.abs(area(P)-sum)>1e-9+1e-9*sum)return polys;
    return [P];};
  // All fragments grouped by (terrain triangle, set) with one native numeric sort of packed keys
  // (triangle · 2^11 + set) · 2^19 + fragment; a group whose areas sum to the triangle is drawn whole.
  const nFr=nF/4,SB=2048,FB=524288,packed=nSets<SB&&nFr<FB;let ord;
  if(packed){const K=new Float64Array(nFr);for(let q=0;q<nFr;q++)K[q]=(M[q*4+1]*SB+M[q*4])*FB+q;K.sort();ord=new Int32Array(nFr);for(let q=0;q<nFr;q++)ord[q]=K[q]%FB;}
  else{ord=new Int32Array(nFr);for(let q=0;q<nFr;q++)ord[q]=q;ord.sort((u,v)=>(M[u*4+1]-M[v*4+1])||(M[u*4]-M[v*4])||u-v);}
  const groupEnd=r=>{const t=M[ord[r]*4+1],sd=M[ord[r]*4];let e=r+1;while(e<nFr&&M[ord[e]*4+1]===t&&M[ord[e]*4]===sd)e++;return e;};
  const wholes=[];   // first fragment index of each whole group
  // Terrain edges: H (i,j)→(i+1,j) = k·3, V (i,j)→(i,j+1) = k·3+1, diagonal (i+1,j)→(i,j+1) = k·3+2. Every vertex an
  // emitted partial polygon puts on a terrain edge is registered for the whole triangles beside it.
  const register=(tid,vx,vy,vz)=>{const k=tid>>1,w2=tid&1,i=k%nx,j=(k-i)/nx,X=x0+i*step,Z=z0+j*step;let e=-1;
    const onX=vx===X,onXs=vx===X+step,onZ=vz===Z,onZs=vz===Z+step,onD=Math.abs(vx-X+vz-Z-step)<1e-6;
    if((onX||onXs)&&(onZ||onZs))return;   // a terrain corner
    if(w2===0){if(onX)e=k*3+1;else if(onZ)e=k*3;else if(onD)e=k*3+2;}
    else{if(onXs)e=(k+1)*3+1;else if(onZs)e=(k+nx)*3;else if(onD)e=k*3+2;}
    if(e<0)return;epAdd(e,vx,vy,vz);};
  let mergedTris=0,multi=0,single=0;const singles=[],merged=[];
  for(let r=0;r<nFr;){const e=groupEnd(r),f0=ord[r]*4,tid=M[f0+1];let ar=0;for(let q=r;q<e;q++)ar+=fragArea.a[ord[q]];
    if(ar>=TRI-1e-6){wholes.push(f0);r=e;continue;}
    if(e-r===1){single++;singles.push(f0);for(let q=0;q<M[f0+3];q++){const o=M[f0+2]+q*3;register(tid,XYZ[o],XYZ[o+1],XYZ[o+2]);}}
    else{multi++;const polys=[];for(let q=r;q<e;q++)polys.push(fragPoly(ord[q]*4));const m=merge(polys);if(m.length<polys.length)mergedTris++;
      merged.push(byId[M[f0]],m);for(const P of m)for(const v of P)register(tid,v[0],v[1],v[2]);}
    r=e;}
  // Points registered on one terrain edge, sorted from `from` toward `to` (duplicates dropped).
  const along=(e,from,to)=>{let n=epHead(e);if(n<0)return [];const dx=to[0]-from[0],dz=to[2]-from[2],L=dx*dx+dz*dz,pts=[];
    for(;n>=0;n=epNext[n]){const px=epXYZ[n*3],py=epXYZ[n*3+1],pz=epXYZ[n*3+2],u=((px-from[0])*dx+(pz-from[2])*dz)/L;if(u>1e-9&&u<1-1e-9)pts.push([u,px,py,pz]);}
    pts.sort((a,b)=>a[0]-b[0]);const out=[];for(const p of pts)if(!out.length||p[0]-out.at(-1)[0]>1e-9)out.push(p);return out.map(p=>[p[1],p[2],p[3]]);};
  let wholeTris=0,curMat=null,FAN=new Int32Array(64);
  const emit=(S,poly)=>{if(S.mat!==curMat){if(!bufs.has(S.mat))flush(S.mat);cur=bufs.get(S.mat);({pos,att,idx}=cur);curMat=S.mat;}
    const ids=poly.map(p=>vid(S,p[0],p[1],p[2]));
    for(let q=1;q+1<ids.length;q++){const a=poly[0],b=poly[q],c=poly[q+1];
      if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))<1e-7||ids[0]===ids[q]||ids[q]===ids[q+1]||ids[0]===ids[q+1])continue;
      room(idx,3);idx.a[idx.n]=ids[0];idx.a[idx.n+1]=ids[q];idx.a[idx.n+2]=ids[q+1];idx.n+=3;triangles++;}};
  // Vertex key: (merge set, millimetre x, millimetre z) in one open-addressing table (typed arrays; same identity as a
  // map per set).
  let HC=1<<19,HM=HC-1,hS=new Int32Array(HC).fill(-1),hX=new Int32Array(HC),hZ=new Int32Array(HC),hV=new Int32Array(HC),hN=0;
  const slot=(sid,kx,kz)=>((Math.imul(kx,73856093)^Math.imul(kz,19349663)^Math.imul(sid+1,83492791))>>>0)&HM;
  const rehash=()=>{const oS=hS,oX=hX,oZ=hZ,oV=hV;HC*=2;HM=HC-1;hS=new Int32Array(HC).fill(-1);hX=new Int32Array(HC);hZ=new Int32Array(HC);hV=new Int32Array(HC);
    for(let i=0;i<oS.length;i++)if(oS[i]!==-1){let j=slot(oS[i],oX[i],oZ[i]);while(hS[j]!==-1)j=(j+1)&HM;hS[j]=oS[i];hX[j]=oX[i];hZ[j]=oZ[i];hV[j]=oV[i];}};
  const vid=(S,x,y,z)=>{const kx=Math.round(x*1000+2e6),kz=Math.round(z*1000+2e6),sid=S.id;let j=slot(sid,kx,kz);
    while(hS[j]!==-1){if(hS[j]===sid&&hX[j]===kx&&hZ[j]===kz)return hV[j];j=(j+1)&HM;}
    const id=pos.n/3;hS[j]=sid;hX[j]=kx;hZ[j]=kz;hV[j]=id;if(++hN>HC*.6)rehash();
    room(pos,3);room(att,4);const P=pos.a,Q=att.a;let o=pos.n;P[o]=x;P[o+1]=y;P[o+2]=z;pos.n=o+3;o=att.n;
    if(S.plain){Q[o]=0;Q[o+1]=0;}else{Q[o]=Math.round(S.edge(x,z)*100);Q[o+1]=Math.round((S.along(x,z)-S.offB)*100);}Q[o+2]=S.pv0;Q[o+3]=S.pv1;att.n=o+4;
    return id;};
  // A convex polygon whose sides may carry straight-through vertices: fan from a corner none of whose two sides carries
  // one (every vertex stays a vertex), else from the centroid (on the triangle's plane).
  const straight=(A,B,C)=>Math.abs((B[0]-A[0])*(C[2]-A[2])-(B[2]-A[2])*(C[0]-A[0]))<=1e-7*Math.hypot(C[0]-A[0],C[2]-A[2]);
  const cross3=(A,B,C)=>Math.abs((B[0]-A[0])*(C[2]-A[2])-(B[2]-A[2])*(C[0]-A[0]));
  const emitConvex=(S,P)=>{const n=P.length;if(n===3){emit(S,P);return;}
    // Among the valid apexes, the one whose thinnest fan triangle is widest (no needle slivers along a near-straight run).
    let best=-1,bestMin=-1;
    for(let q=0;q<n;q++){const at=i=>P[(q+i+n)%n];if(straight(at(-1),at(0),at(1))||straight(at(-2),at(-1),at(0))||straight(at(0),at(1),at(2)))continue;
      let m=Infinity;for(let i=1;i+1<n;i++)m=Math.min(m,cross3(at(0),at(i),at(i+1)));if(m>bestMin){bestMin=m;best=q;}}
    if(best>=0){emit(S,[...P.slice(best),...P.slice(0,best)]);return;}
    const c=[0,1,2].map(d=>P.reduce((s,p)=>s+p[d],0)/n);for(let q=0;q<n;q++)emit(S,[c,P[q],P[(q+1)%n]]);};
  for(const f of wholes){const S=byId[M[f]],tid=M[f+1];wholeTris++;
      const k=tid>>1,w2=tid&1,i=k%nx,j=(k-i)/nx,x=x0+i*step,z=z0+j*step,xs=x+step,zs=z+step;
      // Common case: no registered point on any of its edges — one triangle, no temporary arrays.
      if(!hasPts[k*3+2]&&!(w2?hasPts[(k+nx)*3]||hasPts[(k+1)*3+1]:hasPts[k*3+1]||hasPts[k*3])){
        if(S.mat!==curMat){if(!bufs.has(S.mat))flush(S.mat);cur=bufs.get(S.mat);({pos,att,idx}=cur);curMat=S.mat;}
        const a=w2?vid(S,xs,heights[k+1],z):vid(S,x,heights[k],z),b=vid(S,x,heights[k+nx],zs),c=w2?vid(S,xs,heights[k+nx+1],zs):vid(S,xs,heights[k+1],z);
        room(idx,3);idx.a[idx.n]=a;idx.a[idx.n+1]=b;idx.a[idx.n+2]=c;idx.n+=3;triangles++;continue;}
      const A=[x,heights[k],z],B=[xs,heights[k+1],z],C=[x,heights[k+nx],zs],Dd=[xs,heights[k+nx+1],zs];
      // Corners in the original winding with each edge's registered points.
      const [P0,P1,P2,e01,e12,e20]=w2?[B,C,Dd,k*3+2,(k+nx)*3,(k+1)*3+1]:[A,C,B,k*3+1,k*3+2,k*3];
      const s01=along(e01,P0,P1),s12=along(e12,P1,P2),s20=along(e20,P2,P0);
      emitConvex(S,[P0,...s01,P1,...s12,P2,...s20]);}
  // Single fragments straight from the store (fan from the first vertex, as clipped); merged polygons.
  for(const f of singles){const S=byId[M[f]],n=M[f+3],o0=M[f+2];if(S.mat!==curMat){if(!bufs.has(S.mat))flush(S.mat);cur=bufs.get(S.mat);({pos,att,idx}=cur);curMat=S.mat;}
    const ids=FAN.length>=n?FAN:(FAN=new Int32Array(n*2));for(let q=0;q<n;q++){const o=o0+q*3;ids[q]=vid(S,XYZ[o],XYZ[o+1],XYZ[o+2]);}
    const ax=XYZ[o0],az=XYZ[o0+2];
    for(let q=1;q+1<n;q++){const b=o0+q*3,c=b+3;
      if(Math.abs((XYZ[b]-ax)*(XYZ[c+2]-az)-(XYZ[b+2]-az)*(XYZ[c]-ax))<1e-7||ids[0]===ids[q]||ids[q]===ids[q+1]||ids[0]===ids[q+1])continue;
      room(idx,3);idx.a[idx.n]=ids[0];idx.a[idx.n+1]=ids[q];idx.a[idx.n+2]=ids[q+1];idx.n+=3;triangles++;}}
  for(let q=0;q<merged.length;q+=2){const S=merged[q],polys=merged[q+1];for(const P of polys)if(polys.length===1&&P.length>3)emitConvex(S,P);else emit(S,P);}
  for(const k of [...bufs.keys()])flush(k);
  return {chunks,triangles,vertices,wholeTris,mergedTris,multi,single,sets:nSets};
}

// Small shared canvas textures (one each, 256/128/64 px).
function canvasTexture(size,draw,textures){
  const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');let seed=9187;
  const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);draw(ctx,rnd,size);
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.anisotropy=4;textures.add(tx);return tx;}
// Wikimedia Commons curid=122798497: blue-grey slag adoquines with dark joints, staggered courses (same scale/look as the plaza's sett).
const settDraw=(ctx,rnd,S)=>{ctx.fillStyle='#454d4d';ctx.fillRect(0,0,S,S);const w=S/8,h=S/8;
  // Wikimedia Commons curid=122798497, curid=99177670: mostly blue-grey slag blocks, some grey and a few warm ones; worn, slightly irregular arrises and joints.
  const tone=()=>{const r=rnd(),v=Math.floor(rnd()*22);return r<.8?[98+v,113+v,124+v]:r<.97?[110+v,115+v,117+v]:[118+v,114+v,106+v];};
  for(let j=0;j<8;j++)for(let i=-1;i<=8;i++){const x=i*w+(j%2)*w*.5,y=j*h,[r,g,b]=tone(),ix=1+rnd()*2,iy=1+rnd()*1.5,iw=2+rnd()*2.5,ih=2+rnd()*2;
    ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.beginPath();ctx.roundRect?ctx.roundRect(x+ix,y+iy,w-iw-ix+1,h-ih-iy+1,3):ctx.rect(x+ix,y+iy,w-iw-ix+1,h-ih-iy+1);ctx.fill();
    ctx.fillStyle=`rgba(240,236,220,${.06+rnd()*.1})`;ctx.fillRect(x+ix+1,y+iy+1,w-iw-ix-2,1.5);
    ctx.fillStyle=`rgba(20,25,25,${rnd()*.12})`;ctx.fillRect(x+ix+rnd()*w*.5,y+iy+rnd()*h*.5,w*.35,h*.3);}
  for(let i=0;i<6000;i++){ctx.fillStyle=rnd()<.5?'rgba(20,30,30,.06)':'rgba(230,235,230,.07)';ctx.fillRect(rnd()*S,rnd()*S,1,1);}};
// Wikimedia Commons curid=151596781, curid=151530324: worn grey concrete/stone sidewalk slabs with thin dark joints.
const slabDraw=(ctx,rnd,S)=>{ctx.fillStyle='#a8a49c';ctx.fillRect(0,0,S,S);const n=2,w=S/n;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const v=Math.floor(rnd()*14);ctx.fillStyle=`rgb(${196+v},${192+v},${184+v})`;ctx.fillRect(i*w+1,j*w+1,w-2,w-2);}
  for(let i=0;i<5000;i++){ctx.fillStyle=rnd()<.5?'rgba(60,55,50,.07)':'rgba(255,255,250,.08)';ctx.fillRect(rnd()*S,rnd()*S,1+rnd()*2,1);}};
// Wikimedia Commons curid=182287159: dark asphalt with a fine aggregate speckle.
const noiseDraw=(ctx,rnd,S)=>{ctx.fillStyle='#808080';ctx.fillRect(0,0,S,S);
  for(let i=0;i<S*S*.6;i++){const v=Math.floor(96+rnd()*64);ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(Math.floor(rnd()*S),Math.floor(rnd()*S),1,1);}};

// Per-kind street materials. Kerbed kinds (sett, asphalt) draw, from the per-vertex street coordinate e: the carriageway
// (signed across: one uniform bond over the full width), the gutter course (−0.3…0 m, setts laid lengthwise, darker), the
// worn yellow kerb paint (0…kerb) and the slab sidewalk; edges are smoothed over one pixel (fwidth). Unkerbed kinds draw
// their surface only; parking/concrete/cycle have no street attribute and are textured in world space.
// The street sett texture, one per texture set (shared with landmarks' Fortaleza forecourt, which continues this bond).
const settMemo=new WeakMap();
export function settTexture(textures){let t=settMemo.get(textures);if(!t){t=canvasTexture(256,settDraw,textures);settMemo.set(textures,t);}return t;}
function streetMaterials(textures,K){
  const sett=settTexture(textures),slab=canvasTexture(128,slabDraw,textures),noise=canvasTexture(64,noiseDraw,textures);
  const W=T.positionWorld,wu=W.x.mul(.973).sub(W.z.mul(.23)),wv=W.x.mul(.23).add(W.z.mul(.973));
  const noiseAt=(u,v,sc)=>T.texture(noise,T.vec2(u.div(sc),v.div(sc))).r;
  const settAt=(u,v)=>T.texture(sett,T.vec2(u.div(2.4),v.div(1.2))).rgb;
  // One family for all paving (draw budget): per-vertex w > 0 marks a kerbed carriageway piece (w = 1
  // asphalt, 2 sett; z = half width), w = 0 an open piece (z = kind code). Both colour paths share the street-coordinate
  // sett/noise/slab lookups; the result is selected per fragment.
  const s4=T.attribute('street','vec4').mul(327.67),fam=()=>{
    const m=new THREE.MeshStandardNodeMaterial({roughness:.93,metalness:0,flatShading:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    const kerbed=s4.w.greaterThan(.5),isSett=s4.w.greaterThan(1.5);
    // open: one branch-free select chain on the per-vertex kind code (codes: KIND_CODE)
    const code=s4.z,lt=x=>code.lessThan(x),streetUV=kerbed.or(lt(.5)).or(code.greaterThan(2.5).and(lt(3.5))).or(code.greaterThan(6.5).and(lt(7.5))).or(code.greaterThan(8.5));
    const u=T.select(streetUV,s4.x,wu),v=T.select(streetUV,s4.y,wv),N=noiseAt(u,v,1.8),st=settAt(u,v);
    const sc=T.select(lt(4.5),T.float(1.2),T.select(lt(5.5),T.float(2.4),T.select(lt(6.5),T.float(1.8),T.float(2.4))));
    const sl=T.texture(slab,T.vec2(u.div(sc),v.div(sc))).rgb,f=T.fract(v.div(.32));
    const steps=sl.mul(T.color('#cfc9bd')).mul(T.mix(T.float(.62),T.float(1),T.smoothstep(T.float(.05),T.float(.16),f))).mul(T.mix(T.float(1.12),T.float(1),T.smoothstep(T.float(.16),T.float(.24),f)));
    const asph=T.color('#73777a').mul(N.mul(.7).add(.78));
    const chain=[st,asph,T.color('#6e7275').mul(N.mul(.7).add(.78)),sl.mul(T.color('#e4ddd0')),sl.mul(T.color('#e4ddd0')),
      sl.mul(T.color('#cdc8bd')).mul(N.mul(.2).add(.92)),sl.mul(T.color('#d6d0c4')),st.mul(T.color('#e0a07c')),T.color('#b0644e').mul(N.mul(.6).add(.8)),steps];
    let open=chain[9];for(let i=8;i>=0;i--)open=T.select(lt(i+.5),chain[i],open);
    // kerbed: e = distance past the carriageway edge (−gutter…0 gutter, 0…kerb paint, then sidewalk) from the signed across a.
    const a=s4.x,b=s4.y,hw=s4.z,e=T.abs(a).sub(hw),fw=T.max(T.fwidth(e),T.float(.004));
    const side=T.texture(slab,T.vec2(e.div(1.8),b.div(1.8))).rgb.mul(T.color('#ded8cc'));
    const wear=T.smoothstep(T.float(.35),T.float(.75),noiseAt(b,b.mul(0),3.1));
    const kerb=T.mix(T.color(KERB_COLOUR),T.color('#a8a294'),wear.mul(.55)).mul(T.texture(slab,T.vec2(e.div(.9),b.div(.9))).r.mul(.35).add(.68));
    const coreC=T.select(isSett,st,asph);   // st, asph: sampled at (a, b) on kerbed pieces
    const gut=T.select(isSett,settAt(b,e),asph).mul(.8),tg=T.smoothstep(T.float(-.3).sub(fw),T.float(-.3).add(fw),e);
    const t1=T.smoothstep(fw.negate(),fw,e),t2=T.smoothstep(T.float(K).sub(fw),T.float(K).add(fw),e);
    m.colorNode=T.select(kerbed,T.mix(T.mix(coreC,gut,tg),T.mix(kerb,side,t2),t1),open);
    return m;};
  let one=null;
  return ()=>one??=fam();
}

// Bake a list of parts into one indexed vertex-coloured geometry at the origin (for instancing). Vertices with the same
// position and normal inside a part are shared (a 1-level icosahedron lobe keeps 42 of its 240 corners).
function merged(parts){const P=[],N=[],C=[],I=[],col=new THREE.Color(),m=new THREE.Matrix4(),nm=new THREE.Matrix3(),o=new THREE.Object3D(),v=new THREE.Vector3(),n=new THREE.Vector3();
  for(const {g,at=[0,0,0],scale=[1,1,1],rot=[0,0,0],colour} of parts){o.position.set(...at);o.rotation.set(...rot);o.scale.set(...scale);o.updateMatrix();m.copy(o.matrix);nm.getNormalMatrix(m);col.set(colour);
    const p=g.attributes.position,no=g.attributes.normal,ix=g.index,ids=new Map();
    // A mirrored transform flips the winding: reverse each triangle so faces stay outward.
    const flip=m.determinant()<0;
    const vid=j=>{v.fromBufferAttribute(p,j).applyMatrix4(m);n.fromBufferAttribute(no,j).applyNormalMatrix(nm);
      const key=[v.x,v.y,v.z,n.x,n.y,n.z].map(x=>Math.round(x*1e5)).join(',');let id=ids.get(key);
      if(id===undefined){id=P.length/3;ids.set(key,id);P.push(v.x,v.y,v.z);N.push(n.x,n.y,n.z);C.push(col.r,col.g,col.b);}return id;};
    const cnt=ix?.count??p.count;for(let i=0;i<cnt;i+=3){const t=[0,1,2].map(k=>vid(ix?ix.getX(i+k):i+k));if(flip)t.reverse();I.push(...t);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingSphere();return g;}
function seg(a,b,r,colour,sides=6,open=false){const d=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),l=d.length(),g=new THREE.CylinderGeometry(r,r,l,sides,1,open);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);return {g,colour};}

// Bounding sphere of a position array: the same steps as BufferGeometry.computeBoundingSphere (box centre, then the largest
// squared distance), in one typed pass instead of a Vector3 per vertex.
function sphereOf(P){let a=Infinity,b=Infinity,c=Infinity,d=-Infinity,e=-Infinity,f=-Infinity;
  for(let i=0;i<P.length;i+=3){const x=P[i],y=P[i+1],z=P[i+2];if(x<a)a=x;if(y<b)b=y;if(z<c)c=z;if(x>d)d=x;if(y>e)e=y;if(z>f)f=z;}
  const cx=(a+d)*.5,cy=(b+e)*.5,cz=(c+f)*.5;let m=0;
  for(let i=0;i<P.length;i+=3){const dx=P[i]-cx,dy=P[i+1]-cy,dz=P[i+2]-cz,q=dx*dx+dy*dy+dz*dz;if(q>m)m=q;}
  return new THREE.Sphere(new THREE.Vector3(cx,cy,cz),Math.sqrt(m));}

export function buildStreets(layout,{scene,own,mat,meshes,textures,world:ctxWorld}) {
  const stats={};
  // ---- Ground ----
  const G=streetGeometry(layout,laterOwners(ctxWorld));
  if(G.chunks.length){const materialFor=streetMaterials(textures,layout.constants.STREETS.kerb),used=new Set();
    G.chunks.forEach(c=>{const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.BufferAttribute(c.position,3));
      g.setAttribute('street',new THREE.BufferAttribute(c.street,4,true));g.setIndex(new THREE.BufferAttribute(c.index,1));g.boundingSphere=sphereOf(c.position);
      const material=materialFor(c.material),mesh=new THREE.Mesh(g,material);mesh.name='sj-streets-'+c.material;mesh.userData.sector=c.sector;mesh.receiveShadow=true;
      if(!used.has(material)){used.add(material);mesh.dispose=()=>material.dispose();}scene.add(mesh);meshes.push(mesh);});
    }
  stats.triangles=G.triangles;stats.vertices=G.vertices;stats.chunks=G.chunks.length;
  // Diagnostics (sj-streets-cache.js; nothing when off): digests of the built street ground and the layout's solids.
  {const P=globalThis.__sjStreetsDigestParts;if(P){const h=hasher();for(const c of G.chunks){h.str(c.material+'@'+c.sector).bytes(c.position).bytes(c.street).bytes(c.index);}
    P.push(['geometry',...h.digest()]);const q=hasher();q.any(layout.colliders);q.any(layout.paved.map(p=>[p.ring,p.kind,p.hw,p.road??null,p.mode??null]));P.push(['layoutOut',...q.digest()]);
    if(P.detail){const one=v=>{const x=hasher();x.any(v);return x.digest()[0];};P.push(['items',layout.colliders.map(one),layout.paved.map(p=>one([p.ring,p.kind,p.hw,p.road??null,p.mode??null]))]);
      if(P.detail.length)P.push(['values',P.detail.map(([k,i])=>k==='c'?layout.colliders[i]:layout.paved[i].ring)]);}}}
  const solid=mat({vertexColors:true,roughness:.85,metalness:0}),leafy=mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const o=new THREE.Object3D();
  // Instanced kits: one InstancedMesh per KIT_SECTOR (1024 m: draw-call cap; bounds still per sector), shared geometry and
  // material. Shadows: only tree crowns cast; lanterns and the furniture mesh only receive.
  // Kit sectors: KIT_SECTOR bins; a bin of fewer than 12 instances joins a neighbour (bins above).
  const bySector=list=>{const ptBox=it=>{const x=it.x??it.at[0],z=it.z??it.at[2];return [x,x,z,z];},of=bins(list,ptBox,()=>1,KIT_SECTOR,12),by=new Map();
    for(const it of list){const k=of.get(it);if(!by.has(k))by.set(k,[]);by.get(k).push(it);}return by;};
  const instanced=(geo,material,list,place,name,cast=false)=>{if(!list.length)return;const g=own(geo),by=bySector(list);
    for(const [k,items] of by){const mesh=new THREE.InstancedMesh(g,material,items.length);
      items.forEach((it,i)=>{place(it,o);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
      mesh.name=name;mesh.userData.sector=k;mesh.castShadow=cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);}};
  const tmp=[],furniture=[];const keep=g=>(tmp.push(g),g);
  // ---- Broad shade tree (Wikimedia Commons curid=80420009, curid=195143828, curid=122996449): tapered trunk, five limbs into lobed crown. One shared form, yaw/scale vary. ----
  // crown capped at 100 triangles (four lobes + top, 20-face icosahedra), 4-sided open limbs, 6-sided open
  // trunk: 144 triangles per tree (was ~650).
  {const lobe=keep(new THREE.IcosahedronGeometry(1,0)),bark='#6f6553',parts=[];
    const trunk=keep(new THREE.CylinderGeometry(.19,.3,4,6,1,true));parts.push({g:trunk,at:[0,1.4,0],colour:bark});
    for(let j=0;j<4;j++){const a=j*Math.PI/2+.4,cy=3.4+1.35+(j%2)*.45;
      parts.push(seg([Math.cos(a)*.08,2.9,Math.sin(a)*.08],[Math.cos(a)*1.45,cy-.55,Math.sin(a)*1.45],.1,bark,4,true));
      parts.push({g:lobe,at:[Math.cos(a)*1.95,cy,Math.sin(a)*1.95],scale:[2.05,1.4,2.05],rot:[0,a,0],colour:['#3d6339','#4a7044','#355a36','#44693e'][j]});}
    parts.push(seg([0,3,0],[0,5.1,0],.13,bark,4,true));parts.push({g:lobe,at:[0,5.6,0],scale:[2.5,1.55,2.35],colour:'#4b7246'});
    instanced(merged(parts),solid,layout.broadleaf,(t,o)=>{o.position.set(t.x,t.y-.12,t.z);o.rotation.set(0,t.yaw,0);o.scale.set(t.sx??t.scale,t.scale*(.92+.16*((Math.abs(t.yaw)*3)%1)),t.scale);},'sj-streets-trees',true);}
  // ---- Tall coastal palm (shared sj-palm form): one form, scaled to each palm's height. ----
  {const parts=[],collect=(g,x,y,z,sx,sy,sz,paint,ry=0,kind,rz=0)=>{const c=g.clone();parts.push({g:keep(c),at:[x,y,z],scale:[sx,sy,sz],rot:[0,ry,rz],colour:paint});};
    const nut=keep(new THREE.IcosahedronGeometry(1,0));tallPalm({x:0,y:0,z:0,height:8.6,lean:.2,leanDir:[1,0]},1,{bake:collect,sphere:nut});
    instanced(merged(parts),leafy,layout.palms,(p,o)=>{const k=p.height/8.6;o.position.set(p.x,p.y-.15,p.z);o.rotation.set(0,p.yaw,0);o.scale.set(1,k,1);},'sj-streets-palms',true);}
  // ---- Wall lantern (Wikimedia Commons curid=182287159, curid=158245806, curid=99177670, curid=53594779): wall plate, bracket arm, framed lantern with a pyramid cap. Local +Z = out.
  // (cost): 80 triangles (was 144) — brace and finial dropped; corner posts as open 4-sided prisms.
  // the wall plate is set 2 cm into the facade (its back face was coplanar with the wall);
  // its face stands 4.5 cm out (not 3 or 4 cm: facade bands and boxes of the fabric kit use those depths). Seating:
  // tree trunks reach 0.6 m and bench legs 0.4 m below their ground (slopes).
  {const box=keep(new THREE.BoxGeometry(1,1,1)),cap=keep(new THREE.ConeGeometry(.17,.16,4,1,true)),iron='#1f2523',glass='#e8d9a4';
    const parts=[{g:box,at:[0,-.05,.0125],scale:[.14,.34,.065],colour:iron},seg([0,0,.02],[0,0,.52],.022,iron,4,true),
      {g:box,at:[0,.02,.52],scale:[.15,.04,.15],colour:iron},{g:box,at:[0,.2,.52],scale:[.2,.32,.2],colour:glass},
      // the dark frame around the pane, as four open 4-sided corner posts (8 triangles each).
      ...[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>seg([a*.1,.04,.52+b*.1],[a*.1,.36,.52+b*.1],.016,iron,4,true)),
      {g:cap,at:[0,.43,.52],rot:[0,Math.PI/4,0],colour:iron}];
    const lanterns=placeLanterns(layout.lanterns,ctxWorld);stats.lanternsDropped=layout.lanterns.length-lanterns.length;
    for(const l of lanterns){const n=Math.hypot(l.dir[0],l.dir[1])||1;glowLamp(l.at[0]+l.dir[0]/n*.52,l.at[1]+.2,l.at[2]+l.dir[1]/n*.52,'lantern');}
    instanced(merged(parts),solid,lanterns,(l,o)=>{o.position.set(...l.at);o.rotation.set(0,Math.atan2(l.dir[0],l.dir[1]),0);o.scale.set(1,1,1);},'sj-streets-lanterns');}
  // ---- Bollard (Wikimedia Commons curid=182287159; kit form: tapered body, neck, domed cap) ----
  {const body=keep(new THREE.CylinderGeometry(.1,.14,1.12,10)),neck=keep(new THREE.CylinderGeometry(.075,.09,.08,10)),dome=keep(new THREE.SphereGeometry(.1,10,5,0,Math.PI*2,0,Math.PI/2));
    // the body reaches 0.45 m below its centre ground (lane mouths at kerbs/slopes), the collider too.
    const parts=[{g:body,at:[0,.11,0],colour:'#3d4341'},{g:neck,at:[0,.71,0],colour:'#3d4341'},{g:dome,at:[0,.75,0],colour:'#5b625f'}];
    furniture.push({geo:keep(merged(parts)),list:layout.bollards,place:(b,o)=>{o.position.set(b.x,b.y,b.z);o.rotation.set(0,0,0);o.scale.set(1,1,1);}});}
  // ---- Bench (kit form: iron legs on their own ground, three seat slats, two back slats on iron uprights) ----
  {const box=keep(new THREE.BoxGeometry(1,1,1)),iron='#1f2523',wood='#6e5a3c',parts=[];
    for(const u of [-.72,.72]){parts.push({g:box,at:[u,.055,0],scale:[.085,.91,.5],colour:iron});parts.push({g:box,at:[u,.7,-.26],scale:[.06,.44,.06],colour:iron});}
    for(let i=0;i<3;i++)parts.push({g:box,at:[0,.49,-.22+i*.2],scale:[1.8,.075,.15],colour:wood});
    for(const y of [.72,.88])parts.push({g:box,at:[0,y,-.22],scale:[1.8,.14,.05],colour:wood});
    furniture.push({geo:keep(merged(parts)),list:layout.benches,place:(b,o)=>{o.position.set(b.x,b.y,b.z);o.rotation.set(0,b.heading,0);o.scale.set(1,1,1);}});}
  // Bollards and benches (few, small) share one static mesh per kit sector: one draw instead of two instanced sets.
  {const all=furniture.flatMap(f=>f.list.map(it=>[f,it])),of=bins(all,([,it])=>[it.x,it.x,it.z,it.z],()=>1,KIT_SECTOR,12),by=new Map();for(const e of all){const k=of.get(e);if(!by.has(k))by.set(k,[]);by.get(k).push(e);}
    for(const [k,items] of by){const P=[],N=[],C=[],I=[],v=new THREE.Vector3(),nm=new THREE.Matrix3();
      for(const [f,it] of items){f.place(it,o);o.updateMatrix();nm.getNormalMatrix(o.matrix);const g=f.geo,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,base=P.length/3;
        for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrix);P.push(v.x,v.y,v.z);v.fromBufferAttribute(n,i).applyNormalMatrix(nm);N.push(v.x,v.y,v.z);C.push(c.getX(i),c.getY(i),c.getZ(i));}
        for(let i=0;i<g.index.count;i++)I.push(base+g.index.getX(i));}
      const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
      g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,solid);mesh.name='sj-streets-furniture';mesh.userData.sector=k;mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);}}
  for(const g of tmp)g.dispose();
  Object.assign(stats,{pieces:layout.paved.length,trees:layout.broadleaf.length,palms:layout.palms.length,lanterns:layout.lanterns.length-(stats.lanternsDropped??0),
    bollards:layout.bollards.length,benches:layout.benches.length});
  return stats;
}
