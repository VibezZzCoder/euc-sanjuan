/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Finished coastline for the whole islet (coast pass 2026-11-18) — © 2026 VibezZzCoder, MIT. Heights: USGS DEM; land
// mask from the recorded OSM coastline. area module, registered after every geographic area and before `wallFoot`.
// Contract fields: tops, groundTriangles (drawn inside the terrain chunks by sj-world.js with the land vertices' own
// colours), shoreSkip (grid shore edges whose default rock skirt this area replaces), faces (drawn by sj-coast.js),
// copings, rocks; empty colliders/cuts/surfaces/floorTriangles/places.
// Shoreline geometry: the land mesh ends at the 2 m land
// mask, so the shore is a staircase of cell edges with a vertical skirt hanging from it.
// Rule: every boundary loop of the emitted land cells is traced; its notches (land-reflex corners) are filled seaward,
// shallowest first, by "ears" (triangles of existing land grid vertices, so their edges and heights are the terrain's own)
// while every buried original corner stays within COAST.depth of the new line. The fill only ever adds ground seaward,
// never cuts the kept terrain, so the drawn and physical ground (fill triangles are ordinary tops over water cells) end
// on the same smoothed line. A finished face hangs from that line:
//   - rock (north/west natural shores): a 3-row rough eolianite slope to just below the water, rock → wet → surf colours,
//     physical tops above the waterline (a rider who rides off rolls down it and lands in the water);
//   - quay (the bay side east of La Princesa): a vertical bulkhead with a wet band and a 15 cm coping lip (drawn = top).
// Never overlaps another owner: grid edges whose seaward probe touches another area's tops, cuts, surfaces, brick,
// floors, colliders, fitted wall plans, point dressing, private ground or a building keep the default skirt, and no ear or
// face zone may touch them either.
import {signedArea} from './sj-paving.js';
import {inRing} from './sj-plaza-layout.js';
import {subtractConvex} from './sj-terrain-cut.js';

export const COAST={depth:2.05,minY:.05,probe:4.5,toe:-.35,foam:.05,wet:.32,quayWet:.55,coping:{width:.5,rise:.03,over:0},
  slope:[.38,.85],apron:[.7,1.1],rockEvery:6,maxRun:3.2,clear:.6,rockFloor:.35,strip:{inner:.3,max:7.5,absorb:.8},
  foamY:.04,quayMin:.55,flip:{reach:24,gain:.5,bend:.2,minY:-.3,margin:1,road:2.5,tree:2.5},riprap:{every:.7}};

const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function bbox(r){let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of r){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}return [a,b,c,d];}
function segCross(a,b,c,d){const d1=cross2(c,d,a),d2=cross2(c,d,b),d3=cross2(a,b,c),d4=cross2(a,b,d);return d1*d2<0&&d3*d4<0;}
function insideConvex(p,r){const s=Math.sign(signedArea(r));for(let i=0;i<r.length;i++)if(s*cross2(r[i],r[(i+1)%r.length],p)<=0)return false;return true;}
function overlaps(A,B){for(const p of B)if(insideConvex(p,A))return true;for(const p of A)if(inRing(p[0],p[1],B))return true;
  for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++)if(segCross(A[i],A[(i+1)%A.length],B[j],B[(j+1)%B.length]))return true;return false;}
function shrink(r,d){const cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length;
  return r.map(p=>{const dx=p[0]-cx,dz=p[1]-cz,l=Math.hypot(dx,dz)||1,k=Math.max(0,l-d)/l;return [cx+dx*k,cz+dz*k];});}
function index(cell=8){const m=new Map(),key=(i,j)=>i*100003+j;let stamp=0;
  return {add(item){const [a,b,c,d]=item.bb;for(let i=Math.floor(a/cell);i<=Math.floor(b/cell);i++)for(let j=Math.floor(c/cell);j<=Math.floor(d/cell);j++){
      const k=key(i,j);let l=m.get(k);if(!l)m.set(k,l=[]);l.push(item);}},
    // de-duplicated by a per-query stamp instead of a Set; same items in the same order.
    query(bb){const out=[],q=++stamp;for(let i=Math.floor(bb[0]/cell);i<=Math.floor(bb[1]/cell);i++)for(let j=Math.floor(bb[2]/cell);j<=Math.floor(bb[3]/cell);j++)
      for(const it of m.get(key(i,j))??[])if(it._q!==q&&it.bb[0]<=bb[1]&&bb[0]<=it.bb[1]&&it.bb[2]<=bb[3]&&bb[2]<=it.bb[3]){it._q=q;out.push(it);}return out;}};}
// Deterministic value noise in [0,1) from integer-ish coordinates (no Math.random: the world must hash identically).
const hash=(x,z)=>{let h=Math.imul(Math.round(x*16)|0,374761393)^Math.imul(Math.round(z*16)|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
function smoothNoise(x,z,s){const fx=x/s,fz=z/s,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,e=t=>t*t*(3-2*t);
  const a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);return a+(b-a)*e(u)+(c-a)*e(v)+(a-b-c+d)*e(u)*e(v);}

// Exact vertical planes of a convex ring (inside ⇔ a·x+c·z+d > 0), as in sj-wall-foot.js.
function planesOf(r){const s=Math.sign(signedArea(r));
  return r.map((a,i)=>{const b=r[(i+1)%r.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1,nx=-s*ez/l,nz=s*ex/l;return [nx,0,nz,-(nx*a[0]+nz*a[1])];});}
const cutOf=(r,kind)=>{const [minX,maxX,minZ,maxZ]=bbox(r);return {ring:r,planes:planesOf(r),minX,maxX,minZ,maxZ,kind,tight:true};};

const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const toHex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');

// Built shores: the whole bay side from La Puntilla east to the polygon edge, Bahía Urbana inlet included (quays,
// bulkheads and pier heads, Wikimedia Commons curid=106059407, curid=123441024, curid=182263185, curid=182041799). The north shore (z < −200 east of El Morro) is natural.
export const builtShore=(x,z)=>z>40&&x>-160;
// La Puntilla's photographed quay walls (Wikimedia Commons curid=106059407, curid=123441024, curid=182263185: Aduana, Arsenal, Puntilla east quay): quays at any height.
const photographedQuay=(x,z)=>x>-160&&x<240&&z>240&&z<720;

// the two whole-grid scans as small standalone loops, which the JIT optimises at once.
function emittedCells(land,nx,nz){const E=new Uint8Array(nx*nz);
  for(let j=0;j<nz-1;j++){const r=j*nx;for(let i=0;i<nx-1;i++){const k=r+i;E[k]=(land[k]&land[k+1]&land[k+nx]&land[k+nx+1])?1:0;}}return E;}
// Emitted cells with a non-emitted 4-neighbour (outside the grid counts as not emitted), in row order.
function boundaryCells(E,nx,nz){const out=[];
  for(let j=0;j<nz-1;j++){const r=j*nx;for(let i=0;i<nx-1;i++){const k=r+i;if(E[k]!==1)continue;
    if(i>0&&j>0&&i<nx-2&&j<nz-2&&E[k-1]===1&&E[k+1]===1&&E[k-nx]===1&&E[k+nx]===1)continue;out.push(k);}}return out;}

export function createCoastLayout({city,height,terrain,surface,land,gate,fort,corridor,areas}) {
  const C=COAST,{x0,z0,step,nx,nz}=terrain,H=terrain.heights;
  // Emitted (four-corner land) cells, once: the terrain mesh's and isDry's own rule.
  const E=emittedCells(land,nx,nz);
  const emitted=(i,j)=>i>=0&&j>=0&&i<nx-1&&j<nz-1&&E[j*nx+i]===1;
  const dryAt=(x,z)=>emitted(Math.floor((x-x0)/step),Math.floor((z-z0)/step));
  const P=v=>[x0+(v%nx)*step,z0+Math.floor(v/nx)*step];
  const surfaceAt=(x,z)=>{const i=Math.floor((x-x0)/step),j=Math.floor((z-z0)/step);return i>=0&&j>=0&&i<nx&&j<nz&&surface?.[j*nx+i]===2?'grass':'pavement';};

  // ---- Owners (same generic reading as sj-wall-foot.js, plus fitted wall plans and buildings). ----
  const owners=index(8),private_=[];
  const own=(r,what)=>{if(r?.length>=3&&Math.abs(signedArea(r))>1e-4)owners.add({ring:r,bb:bbox(r),what});};
  const others=[['gate',gate],['fort',fort],...Object.entries(areas)].filter(([,a])=>a);
  const boxRing=c=>{const {x:cx,z:cz}=c.centre,{x:hx,z:hz}=c.halfExtents,r=c.rotationY??0,cs=Math.cos(r),sn=Math.sin(r);
    return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([u,v])=>[cx+u*cs+v*sn,cz-u*sn+v*cs]);};
  const SKIP=new Set(['stations','walls','ends','places','runs','segs','segments','garitas','path','seaLine','wallLine']);
  for(const [key,a] of others){
    for(const t of a.tops??[])own(t.poly.map(p=>[p.x,p.z]),key+':top');
    for(const c of a.cuts??[])own(c.ring??[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]],key+':cut');
    for(const s of a.surfaces??[])own(s.ring,key+':surface');
    for(const s of a.brick??[])own(s.ring,key+':brick');
    for(const f of a.floorTriangles??[])own(f.map(p=>[p[0],p[2]]),key+':floor');
    for(const t of a.groundTriangles??[])own(t.map(p=>[p[0],p[2]]),key+':ground');
    for(const c of a.colliders??[])own(c.outer?c.outer.map(p=>[p.x,p.z]):c.centre?boxRing(c):null,key+':collider');
    // Fitted walls (and their wall-foot strips, which sit in front of them): the plan from crest to the foot, 3 m out.
    for(const w of a.walls??[]){const s=[w.a,w.b];if(!s.every(q=>q?.T&&q?.B))continue;
      const out=q=>{const f=q.LB??q.B,d=Math.hypot(f[0]-q.T[0],f[1]-q.T[1])||1;return [f[0]+3*(f[0]-q.T[0])/d,f[1]+3*(f[1]-q.T[1])/d];};
      own([s[0].T,s[1].T,out(s[1]),out(s[0])],key+':wall');}
    if(a.offLimitsAt)private_.push(a.offLimitsAt);
    for(const [field,v] of Object.entries(a)){if(SKIP.has(field)||!Array.isArray(v))continue;
      for(const o of v)if(o&&typeof o==='object'&&!Array.isArray(o)&&Number.isFinite(o.x)&&Number.isFinite(o.z)&&!o.outer){const r=Math.max(C.clear,Number.isFinite(o.r)?o.r+C.clear:0);   // rip-rap stones and other sized dressing keep their own radius
        
        own([[o.x-r,o.z-r],[o.x+r,o.z-r],[o.x+r,o.z+r],[o.x-r,o.z+r]],key+':'+field);}}}
  for(const g of [...(gate?.cuts??[]),...(fort?.cuts??[])])own(g.ring??[[g.minX,g.minZ],[g.maxX,g.minZ],[g.maxX,g.maxZ],[g.minX,g.maxZ]],'cut');
  for(const b of city.buildings)own(b.outer,'building');
  for(const p of corridor?.paving??[]){const dx=p.b[0]-p.a[0],dz=p.b[1]-p.a[1],l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l,h=p.width/2+.5;
    own([[p.a[0]-uz*h-ux*h,p.a[1]+ux*h-uz*h],[p.b[0]-uz*h+ux*h,p.b[1]+ux*h+uz*h],[p.b[0]+uz*h+ux*h,p.b[1]-ux*h+uz*h],[p.a[0]+uz*h-ux*h,p.a[1]-ux*h-uz*h]],'corridor:paving');}
  const ownedBy=r=>{const t=shrink(r,.02);for(const it of owners.query(bbox(r)))if(overlaps(t,it.ring))return it.what;return null;};
  // Layout time: an 8 m block (grown by `m`) that touches no owner clears every smaller ring inside it,
  // so most per-edge / per-vertex ownership tests on the open shore are answered once per block. Exact: the full test still
  // runs wherever the block is touched.
  const blockMemos=new Map(),blockFreeAt=(x,z,m)=>{let blockMemo=blockMemos.get(m);if(!blockMemo)blockMemos.set(m,blockMemo=new Map());
    const bi=Math.floor(x/8),bj=Math.floor(z/8),k=bi*100003+bj;let v=blockMemo.get(k);
    if(v===undefined){const a=bi*8-m,b=bi*8+8+m,c=bj*8-m,d=bj*8+8+m;blockMemo.set(k,v=!ownedBy([[a,c],[b,c],[b,d],[a,d]]));}return v;};
  // Memoised the shore probes sample a 0.5 m lattice, so neighbouring edges and cells ask
  // the same points; the answer for a point is unchanged.
  const privateMemo=new Map(),privateAt=(x,z)=>{const k=Number.isInteger(x*4)&&Number.isInteger(z*4)?(x*4+4e5)*1e7+(z*4+4e5):x+','+z;let v=privateMemo.get(k);if(v===undefined)privateMemo.set(k,v=private_.some(f=>f(x,z,height(x,z))));return v;};

  // ---- Boundary edges of the emitted cells, directed with land on the left: corners c0(i,j) c1(i+1,j) c2(i+1,j+1) c3(i,j+1). ----
  const out=new Map(),edgeKey=new Map();   // vertex → outgoing edges [{to,key}]
  let edges=0;
  for(const k0 of boundaryCells(E,nx,nz)){const i=k0%nx,j=(k0-i)/nx;
    const c=[j*nx+i,j*nx+i+1,(j+1)*nx+i+1,(j+1)*nx+i];
    for(const [d,di,dj] of [[0,0,-1],[1,1,0],[2,0,1],[3,-1,0]]){if(emitted(i+di,j+dj))continue;
      const a=c[d],b=c[(d+1)%4],key=`${i},${j},${di},${dj}`;let l=out.get(a);if(!l)out.set(a,l=[]);l.push({to:b,key});edges++;}}
  // Trace loops; at a pinch vertex take the sharpest left turn (each diagonal-touching land piece keeps its own loop).
  const used=new Set(),loops=[];
  for(const [start,list] of out)for(const first of list){if(used.has(first.key))continue;
    const loop=[];let from=start,e=first;
    for(let guard=0;guard<1e6;guard++){used.add(e.key);loop.push({v:from,key:e.key});const prev=from;from=e.to;if(from===start&&loop.length>2)break;
      const cand=out.get(from).filter(o=>!used.has(o.key));if(!cand.length)break;
      if(cand.length===1){e=cand[0];continue;}
      const [px,pz]=P(prev),[vx,vz]=P(from),din=Math.atan2(vz-pz,vx-px);
      e=cand.map(o=>{const [qx,qz]=P(o.to);let t=Math.atan2(qz-vz,qx-vx)-din;while(t<=-Math.PI)t+=2*Math.PI;while(t>Math.PI)t-=2*Math.PI;return {o,t};}).sort((a,b)=>b.t-a.t)[0].o;}
    loops.push(loop);}

  // ---- Per original edge: world edge (grid border), low (both ends at or under the water), or owned. ----
  const pinch=new Set([...out].filter(([,l])=>l.length>1).map(([v])=>v));
  const border=v=>{const i=v%nx,j=Math.floor(v/nx);return i<=1||j<=1||i>=nx-3||j>=nz-3;};
  const edgeState=new Map(),reasons={},renderOnly=new Set();
  for(const loop of loops)loop.forEach((e,k)=>{const b=loop[(k+1)%loop.length].v,A=P(e.v),B=P(b);
    let s=null;
    if(border(e.v)||border(b))s='border';
    else{const ex=B[0]-A[0],ez=B[1]-A[1],l=Math.hypot(ex,ez),ox=ez/l,oz=-ex/l;   // seaward normal (right of the edge)
      const probe=[[A[0]-ox*.05,A[1]-oz*.05],[B[0]-ox*.05,B[1]-oz*.05],[B[0]+ox*C.probe,B[1]+oz*C.probe],[A[0]+ox*C.probe,A[1]+oz*C.probe]];
      s=blockFreeAt((A[0]+B[0])/2,(A[1]+B[1])/2,C.probe+1.2)?null:ownedBy(probe);
      if(s)s='owned:'+s.split(':')[0];}
    // Closed sites (cemetery, Coast Guard base) and 4 m either side of them: drawn, but no new physical ground, so the
    // finished edge can never open a dry way round the end of a seal.
    if(s===null){const ex=B[0]-A[0],ez=B[1]-A[1],l=Math.hypot(ex,ez),ux=ex/l,uz=ez/l,ix=-ez/l,iz=ex/l,mx=(A[0]+B[0])/2,mz=(A[1]+B[1])/2;
      outer:for(const d of [.5,2,4])for(const u of [-4,0,4])if(privateAt(mx+ix*d+ux*u,mz+iz*d+uz*u)){renderOnly.add(e.key);break outer;}}
    edgeState.set(e.key,s);const tag=s??(Math.max(H[e.v],H[b])<C.minY?'free-low':'free');reasons[tag]=(reasons[tag]??0)+1;});

  // Integration round: a short free run (≤ 5 grid edges) between two edges owned by other areas yields to them too, so
  // coast pieces never interleave with another owner's quay as white tabs (Bahía Urbana's quay, x 1220–1284).
  let yielded=0;
  for(const loop of loops){const st=loop.map(e=>edgeState.get(e.key)),L=loop.length;
    for(let k=0;k<L;k++){if(st[k]!==null||st[(k-1+L)%L]===null)continue;const prev=st[(k-1+L)%L];if(!prev.startsWith('owned:'))continue;
      let e=k;while(e-k<6&&st[e%L]===null)e++;const next=st[e%L];if(e-k>5||next===null||!next.startsWith('owned:'))continue;
      for(let q=k;q<e;q++){edgeState.set(loop[q%L].key,prev);yielded++;}}}
  for(const k of Object.keys(reasons))delete reasons[k];
  for(const loop of loops)for(const e of loop){const s2=edgeState.get(e.key);reasons[s2??'free']=(reasons[s2??'free']??0)+1;}
  reasons.yieldedShortRuns=yielded;

  // ---- Notch filling (ear removal at land-reflex corners), shallowest first, per loop. ----
  const segIdx=index(6),alive=new Set(),groundTriangles=[],tops=[],shoreSkip=new Set(),fills=[];
  const nodes=[];   // {v,x,z,prev,next,loop,free,buried:[], edgeKey (edge to next, original or null)}
  for(const loop of loops){const base=nodes.length;
    loop.forEach((e,k)=>{const [x,z]=P(e.v);nodes.push({id:base+k,v:e.v,x,z,y:H[e.v],prev:base+(k-1+loop.length)%loop.length,next:base+(k+1)%loop.length,
      key:e.key,state:edgeState.get(e.key),ro:renderOnly.has(e.key),buriedNext:[]});});
    for(let k=0;k<loop.length;k++){const n=nodes[base+k];alive.add(n.id);addSeg(n);}}
  function addSeg(n){const m=nodes[n.next];segIdx.add({a:n.id,b:m.id,bb:bbox([[n.x,n.z],[m.x,m.z]])});}
  const segAlive=s=>alive.has(s.a)&&nodes[s.a].next===s.b;
  const canRemove=n=>{
    if(!alive.has(n.id)||pinch.has(n.v))return null;
    const p=nodes[n.prev],q=nodes[n.next];if(p.id===q.id||nodes[q.next].id===p.id)return null;
    if(p.state!==null||n.state!==null)return null;          // both segments at this corner must be free
    const tri=[[p.x,p.z],[n.x,n.z],[q.x,q.z]],cr=cross2(...tri);if(cr>=-1e-9)return null;   // land-reflex only (right turn)
    const l=Math.hypot(q.x-p.x,q.z-p.z);let d=0;
    for(const o of [n,...p.buriedNext,...n.buriedNext])d=Math.max(d,Math.abs(cross2([p.x,p.z],[q.x,q.z],[o.x,o.z]))/l);
    if(d>C.depth)return null;
    return {d,area:-cr/2};};
  const clearTri=(n)=>{const p=nodes[n.prev],q=nodes[n.next],tri=[[p.x,p.z],[n.x,n.z],[q.x,q.z]],bb=bbox(tri);
    for(const s of segIdx.query(bb)){if(!segAlive(s))continue;const a=nodes[s.a],b=nodes[s.b];
      if(s.a===p.id||s.a===n.id)continue;   // the triangle's own two segments
      const A=[a.x,a.z],B=[b.x,b.z];
      if(segCross(tri[0],tri[2],A,B))return false;
      for(const o of [a,b])if(o.id!==p.id&&o.id!==q.id&&o.id!==n.id&&insideConvex([o.x,o.z],tri))return false;}
    // The new segment's seaward zone and the triangle itself must stay clear of every other owner and of private ground.
    const ex=q.x-p.x,ez=q.z-p.z,l=Math.hypot(ex,ez),ox=ez/l,oz=-ex/l;
    const zone=[[p.x,p.z],[q.x,q.z],[q.x+ox*C.probe,q.z+oz*C.probe],[p.x+ox*C.probe,p.z+oz*C.probe]];
    if(ownedBy(tri)||ownedBy(zone))return false;
    return true;};
  // Binary heap of candidate corners by depth.
  const heap=[],push=it=>{heap.push(it);let i=heap.length-1;while(i){const pa=(i-1)>>1;if(heap[pa].d<=heap[i].d)break;[heap[pa],heap[i]]=[heap[i],heap[pa]];i=pa;}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;
    if(l<heap.length&&heap[l].d<heap[m].d)m=l;if(r<heap.length&&heap[r].d<heap[m].d)m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
  const version=new Map(),offer=n=>{const r=canRemove(n);const ver=(version.get(n.id)??0)+1;version.set(n.id,ver);if(r)push({d:r.d,id:n.id,ver});};
  for(const n of nodes)offer(n);
  const up=tri=>{const [p,q,r]=tri,ny=(q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]);return ny<0?[p,r,q]:tri;};
  const planeOf=tri=>{const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
    const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;return {x:p[0],y:p[1],z:p[2],dx:-cx/cy,dz:-cz/cy};};
  let removed=0;
  // Physical support only above the waterline (+5 cm): a top reaching under the water would hold a rider on a submerged
  // ledge instead of letting the stock water recovery take over. Clipped part of the drawn triangle → convex fan.
  const addTops=(tri,pl,props,floor=C.minY)=>{let poly=tri;const out=[];
    {const r=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a[1]-floor,db=b[1]-floor;
      if(da>=0)r.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);r.push([a[0]+(b[0]-a[0])*t,floor,a[2]+(b[2]-a[2])*t]);}}poly=r;}
    for(let k=1;k+1<poly.length;k++){const t=[poly[0],poly[k],poly[k+1]];
      if(Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]))<1e-6)continue;
      tops.push({poly:t.map(p=>({x:p[0],z:p[2]})),top:Math.max(...t.map(p=>p[1])),plane:pl,...props});out.push(t);}
    return out.length;};
  while(heap.length){const it=pop();if(version.get(it.id)!==it.ver||!alive.has(it.id))continue;
    const n=nodes[it.id];const r=canRemove(n);if(!r||Math.abs(r.d-it.d)>1e-9){if(r)push({d:r.d,id:n.id,ver:it.ver});continue;}
    if(!clearTri(n)){continue;}
    const p=nodes[n.prev],q=nodes[n.next];
    const tri=up([[p.x,p.y,p.z],[n.x,n.y,n.z],[q.x,q.y,q.z]]);
    fills.push({tri,depth:r.d,ro:p.ro||n.ro,apex:n.id});
    p.ro=p.ro||n.ro;
    // Buried edges: the two segments at n (their original grid edges skip the default skirt).
    p.buriedNext=[...p.buriedNext,n,...n.buriedNext];
    alive.delete(n.id);p.next=q.id;q.prev=p.id;addSeg(p);removed++;
    offer(p);offer(q);offer(nodes[p.prev]);offer(nodes[q.next]);}
  // Each fill belongs to the final segment that buried its apex.
  const ownerOf=new Map();for(const id of alive)for(const o of nodes[id].buriedNext)ownerOf.set(o.id,id);
  const lowSeg=n=>Math.max(n.y,nodes[n.next].y)<C.minY;
  // Strip candidates: every submerged final segment, plus every natural segment whose corners stay under
  // 0.8 m. Long low shores are then one continuous strip run with a single waterline, instead of strips and short rock
  // faces taking turns (their waterlines sat metres apart: the stepped surf of the north shore, rank 3/4).
  // A natural candidate whose strip cannot be built gets its fills and rock face back.
  const stripCand=new Set(),absorbed=new Set();
  for(const id of alive){const n=nodes[id],b=nodes[n.next];if(n.state!==null)continue;
    if(lowSeg(n))stripCand.add(id);
    // (Bahía: outer bank (1215–1245, 240–275), SW tip (1200–1216, 272–282), east corner): low bay banks
    // outside La Puntilla's photographed quays are strip runs too (one smooth grey bank and waterline), not saw-edged
    // low faces.
    else if(Math.max(n.y,b.y)<C.strip.absorb&&(!builtShore(n.x,n.z)&&!builtShore(b.x,b.z)||!photographedQuay(n.x,n.z)&&!photographedQuay(b.x,b.z))){stripCand.add(id);absorbed.add(id);}}
  // Fill triangles: drawn in the terrain chunks and physical as ordinary tops over the water cells. Fills of a strip
  // segment are left out: the waterline strip owns that ground.
  const fillIdx=index(6);
  const addFill=f=>{const pl=planeOf(f.tri);if(!Number.isFinite(pl.dx)||!Number.isFinite(pl.dz)||Math.max(...f.tri.map(t=>t[1]))<C.minY)return;
    groundTriangles.push(f.tri);const r=f.tri.map(t=>[t[0],t[2]]);fillIdx.add({ring:r,bb:bbox(r),tri:f.tri});if(f.ro)return;
    addTops(f.tri,pl,{surface:'gravel',source:'coast:fill'});};
  for(const f of fills)if(!stripCand.has(ownerOf.get(f.apex)))addFill(f);

  const segNormal=a=>{const b=nodes[a.next],ex=b.x-a.x,ez=b.z-a.z,l=Math.hypot(ex,ez)||1;return [ez/l,-ex/l];};
  // ---- Waterline strips: the 0 m contour of the low shores runs inside the land along the −0.21 m stair corners, so it
  // is stair-shaped. Each strip run is a ruled surface, drawn and physical (replacement tops on every drawn triangle),
  // from the shore line (inside a run: smoothed, at −0.21 m) in to an inner line on ground ≥ 0.3 m (exact kept-terrain
  // profile, wall-foot style); a tight render cut removes the terrain under it. One waterline per run. ----
  // ---- Bank diagonals (north-shore terracing below El Morro / west of the cemetery). The terrain splits
  // every 2 m cell along one fixed diagonal; where a steep natural bank runs across that diagonal each cell draws a tooth,
  // so the shelf-to-bank scarp reads as a staircase of terraces. Within 24 m of a natural final shore, a cell whose other
  // diagonal joins two corners of much more similar height (the crease along the contour) is split that way instead:
  // same four DEM heights, so the grades are the mapped ones. `flipCells` (grid cell index) tells sj-world.js to emit
  // those cells with the other diagonal (the same shared vertices and smooth normals); replacement tops on the same
  // triangles (minus the strips, which replace that ground themselves) keep drawn = physical, and the strips below are
  // fitted to the flipped surface (hF). Never near another owner, a road, a mapped tree, a built shore or private ground
  // (those keep the default split everyone else's geometry was fitted to). Decided before the strips. ----
  const flipCells=new Set();
  {const F=C.flip,lines=[];
    for(const id of alive){const n=nodes[id],q=nodes[n.next];if(n.state!==null||builtShore(n.x,n.z)||builtShore(q.x,q.z))continue;lines.push([[n.x,n.z],[q.x,q.z]]);}
    // Cells within about `reach` of the natural line: the line is rasterised into 8 m blocks,
    // dilated by reach/8 blocks; then a single scan keeps the emitted cells in those blocks that pass the cheap height
    // tests (gain, bend), in grid order.
    const B8=8,bw=Math.ceil(nx*step/B8)+1,bh=Math.ceil(nz*step/B8)+1,near8=new Uint8Array(bw*bh),R8=Math.ceil(F.reach/B8);
    for(const [A,B] of lines){const n=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/4));
      for(let q=0;q<=n;q++){const bi=Math.floor((A[0]+(B[0]-A[0])*q/n-x0)/B8),bj=Math.floor((A[1]+(B[1]-A[1])*q/n-z0)/B8);
        for(let dj=-R8;dj<=R8;dj++)for(let di=-R8;di<=R8;di++){const ii=bi+di,jj=bj+dj;if(ii>=0&&jj>=0&&ii<bw&&jj<bh)near8[jj*bw+ii]=1;}}}
    const mark=[],per=B8/step;
    for(let bj=0;bj<bh;bj++)for(let bi=0;bi<bw;bi++){if(!near8[bj*bw+bi])continue;
      for(let j=bj*per;j<(bj+1)*per&&j<nz-1;j++)for(let i=bi*per;i<(bi+1)*per&&i<nx-1;i++){const k=j*nx+i;if(E[k]!==1)continue;
        const h00=H[k],h10=H[k+1],h01=H[k+nx],h11=H[k+nx+1];
        if(Math.min(h00,h10,h01,h11)<F.minY||Math.abs(h10-h01)-Math.abs(h00-h11)<F.gain||Math.abs(h00+h11-h10-h01)/2<F.bend)continue;mark.push(k);}}
    const rIdx=index(16);for(const r of city.roads??[])for(let q=0;q+1<r.points.length;q++){const a=r.points[q],b=r.points[q+1],h=(r.width??4)/2+F.road;
      rIdx.add({a,b,h,bb:[Math.min(a[0],b[0])-h,Math.max(a[0],b[0])+h,Math.min(a[1],b[1])-h,Math.max(a[1],b[1])+h]});}
    const tIdx=index(8);for(const t of city.trees??[])tIdx.add({p:t,bb:[t[0]-F.tree,t[0]+F.tree,t[1]-F.tree,t[1]+F.tree]});
    const segD=(x,z,a,b)=>{const ex=b[0]-a[0],ez=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*ex+(z-a[1])*ez)/(ex*ex+ez*ez||1e-9)));return Math.hypot(x-a[0]-ex*u,z-a[1]-ez*u);};
    const blockFree=new Map(),blockPrivate=new Map();
    for(const k of mark.sort((p,q)=>p-q)){const i=k%nx,j=(k-i)/nx;
      const h00=H[k],h10=H[k+1],h01=H[k+nx],h11=H[k+nx+1];
      if(Math.min(h00,h10,h01,h11)<F.minY||Math.abs(h10-h01)-Math.abs(h00-h11)<F.gain||Math.abs(h00+h11-h10-h01)/2<F.bend)continue;   // a nearly planar cell looks the same either way: no flip, no tops
      const xa=x0+i*step,za=z0+j*step,xb=xa+step,zb=za+step,cx=(xa+xb)/2,cz=(za+zb)/2,m=F.margin;
      if(builtShore(cx,cz))continue;
      if(tIdx.query([xa,xb,za,zb]).length)continue;
      if([...rIdx.query([cx,cx,cz,cz])].some(r=>segD(cx,cz,r.a,r.b)<r.h+1.42))continue;
      // Private ground (closed sites) per 8 m block: no flip in a block whose own or neighbours' corners/centres are private.
      {const bi=Math.floor(i/4),bj=Math.floor(j/4),bk=bj*100003+bi;let pv=blockPrivate.get(bk);
        if(pv===undefined){pv=false;for(let dj=-1;dj<=1&&!pv;dj++)for(let di=-1;di<=1&&!pv;di++){const bx=x0+(bi+di)*8,bz=z0+(bj+dj)*8;
          if([[bx,bz],[bx+4,bz+4],[bx+8,bz],[bx,bz+8],[bx+8,bz+8]].some(([x,z])=>privateAt(x,z)))pv=true;}blockPrivate.set(bk,pv);}
        if(pv)continue;}
      // Ownership test per 8 m block first (one polygon test clears 16 cells), per cell only where the block is touched.
      {const bi=Math.floor(i/4),bj=Math.floor(j/4),bk=bj*100003+bi;let free=blockFree.get(bk);
        if(free===undefined){const bx=x0+bi*4*step,bz=z0+bj*4*step,e=4*step;free=!ownedBy([[bx-m,bz-m],[bx+e+m,bz-m],[bx+e+m,bz+e+m],[bx-m,bz+e+m]]);blockFree.set(bk,free);}
        if(!free&&ownedBy([[xa-m,za-m],[xb+m,za-m],[xb+m,zb+m],[xa-m,zb+m]]))continue;}
      flipCells.add(k);}}
  const flipMask=new Uint8Array(nx*nz);for(const k of flipCells)flipMask[k]=1;
  // Flip-aware terrain height: exactly the drawn (and, through the bank tops, physical) surface.
  const hF=(x,z)=>{const fx=(x-x0)/step,fz=(z-z0)/step,i=Math.floor(fx),j=Math.floor(fz);if(i<0||j<0||i>=nx-1||j>=nz-1)return height(x,z);
    const k=j*nx+i;if(!flipMask[k])return height(x,z);const u=fx-i,v=fz-j;
    return u>=v?H[k]+(H[k+1]-H[k])*u+(H[k+nx+1]-H[k+1])*v:H[k]+(H[k+nx+1]-H[k+nx])*u+(H[k+nx]-H[k])*v;};

  const strips=[],foam=[],cuts=[],stripSkips={},skipAt=[];
  const profile=(a,b)=>{const ts=new Set([0,1]),dx=b[0]-a[0],dz=b[1]-a[1];
    const add=(f0,df,c0)=>{if(Math.abs(df)<1e-12)return;const lo=Math.min(f0,f0+df),hi=Math.max(f0,f0+df);
      for(let k=Math.ceil((lo-c0)/step);c0+k*step<=hi+1e-9;k++){const t=(c0+k*step-f0)/df;if(t>1e-9&&t<1-1e-9)ts.add(t);}};
    add(a[0],dx,x0);add(a[1],dz,z0);add(a[0]+a[1],dx+dz,x0+z0);
    // Flipped cells crease along the other diagonal (x − z = const): its crossings too, where the segment meets one.
    if(flipCells.size){let any=false;const [i0,i1]=[Math.floor((Math.min(a[0],b[0])-x0)/step),Math.floor((Math.max(a[0],b[0])-x0)/step)],[j0,j1]=[Math.floor((Math.min(a[1],b[1])-z0)/step),Math.floor((Math.max(a[1],b[1])-z0)/step)];
      for(let j=Math.max(0,j0);j<=j1&&!any;j++)for(let i=Math.max(0,i0);i<=i1;i++)if(flipMask[j*nx+i]){any=true;break;}
      if(any)add(a[0]-a[1],dx-dz,x0-z0);}
    return [...ts].sort((p,q)=>p-q).map(t=>{const x=a[0]+dx*t,z=a[1]+dz*t;return {t,x,z,y:hF(x,z)};});};
  {const SKIPS=(k,n)=>{stripSkips[k]=(stripSkips[k]??0)+1;if(n)skipAt.push([k,Math.round(n.x),Math.round(n.z)]);};
    const cand=[...alive].filter(id=>stripCand.has(id));
    let ok=new Set(cand);const P0=n=>[n.x,n.z];let pos=new Map();
    const at=n=>pos.get(n.id)??P0(n);
    const inward=n=>{const p=nodes[n.prev],q=nodes[n.next],c=at(n),a=ok.has(p.id)?[c[0]-at(p)[0],c[1]-at(p)[1]]:null,b=ok.has(n.id)?[at(q)[0]-c[0],at(q)[1]-c[1]]:null;
      const nm=v=>{const l=Math.hypot(...v)||1;return [v[1]/l,-v[0]/l];},u=a?nm(a):nm(b),w=b?nm(b):u;
      let mx=u[0]+w[0],mz=u[1]+w[1];const m=Math.hypot(mx,mz);if(m<1e-6){mx=w[0];mz=w[1];}else{mx/=m;mz/=m;}const k=1/Math.max(.6,mx*w[0]+mz*w[1]);return [-mx*k,-mz*k];};
    let D2,inner,reason;const why=new Map(),depthMemo=new Map();   // depthMemo: same position and direction, same answer
    // Iterate: smooth the outer line inside runs, place the inner line, check every quad; drop failures and redo.
    for(let pass=0;pass<5;pass++){
      pos=new Map();
      // Smoothed outer positions for run-interior nodes (run ends stay on their grid corner, shared with faces/terrain).
      const interior=id=>ok.has(nodes[id].prev)&&ok.has(id);
      // the smoothing only ever moves a node seaward along its own normal. Moving a convex corner
      // landward left the kept terrain triangle at that corner outside the strip (uncut, no skirt): the sand teeth and
      // stepped surf of the north shore at rider height (−560…−500, −640…−600).
      for(let it=0;it<4;it++){const next=new Map();
        for(const id of ok){const n=nodes[id];if(!interior(id))continue;const p=at(nodes[n.prev]),q=at(nodes[n.next]),c=at(n),o=P0(n);
          const s1=segNormal(nodes[n.prev]),s2=segNormal(n);let sx=s1[0]+s2[0],sz=s1[1]+s2[1];const sl=Math.hypot(sx,sz);if(sl<1e-6)continue;sx/=sl;sz/=sl;
          const d=((p[0]+2*c[0]+q[0])/4-o[0])*sx+((p[1]+2*c[1]+q[1])/4-o[1])*sz;
          next.set(id,[o[0]+Math.min(.6,Math.max(0,d))*sx,o[1]+Math.min(.6,Math.max(0,d))*sz]);}
        for(const [k,v] of next)pos.set(k,v);}
      const D=new Map(),depthAt=n=>{const m=inward(n),c=at(n),key=c[0]+','+c[1]+','+m[0]+','+m[1],memo=depthMemo.get(n.id);if(memo&&memo.key===key)return memo.v;let v=null;
        for(let d=2;d<=C.strip.max;d+=.25){const x=c[0]+m[0]*d,z=c[1]+m[1]*d;if(dryAt(x,z)&&hF(x,z)>=C.strip.inner){v=Math.min(C.strip.max,d+.5);break;}}
        depthMemo.set(n.id,{key,v});return v;};
      for(const id of ok)for(const n of [nodes[id],nodes[nodes[id].next]])if(!D.has(n.id))D.set(n.id,depthAt(n));
      // Inner line: the deepest requirement within ±3 run nodes, so it does not jump segment by segment.
      D2=new Map();for(const [id,d] of D){if(d==null){D2.set(id,null);continue;}let best=d,m=nodes[id],q=nodes[id];
        for(let k=0;k<3;k++){m=nodes[m.prev];q=nodes[q.next];for(const o of [m,q]){const v=D.get(o.id);if(v!=null&&v>best)best=v;}}D2.set(id,Math.min(C.strip.max,best));}
      inner=n=>{const m=inward(n),d=D2.get(n.id),c=at(n);return d==null?null:[c[0]+m[0]*d,c[1]+m[1]*d];};
      const idx=index(6);reason=new Map();
      for(const id of ok){const a=nodes[id],b=nodes[a.next],Ia=inner(a),Ib=inner(b);if(!Ia||!Ib){reason.set(id,'no-inner');continue;}
        const q=[at(a),at(b),Ib,Ia];
        if(cross2(q[0],q[1],q[2])<=1e-6||cross2(q[1],q[2],q[3])<=1e-6||cross2(q[2],q[3],q[0])<=1e-6||cross2(q[3],q[0],q[1])<=1e-6){reason.set(id,'fold');continue;}
        const w=ownedBy(q);if(w){reason.set(id,'owner:'+w.split(':')[0]);continue;}
        const t=shrink(q,.02);let clash=false;for(const it of fillIdx.query(bbox(q)))if(overlaps(t,it.ring)){clash=true;break;}
        if(!clash)for(const it of idx.query(bbox(q)))if(it.id!==a.prev&&it.id!==b.id&&overlaps(t,it.ring)){clash=true;break;}
        if(clash){reason.set(id,'clash');continue;}
        idx.add({ring:q,bb:bbox(q),id});}
      if(!reason.size)break;
      for(const [id,r] of reason){ok.delete(id);why.set(id,r);}}
    for(const id of cand)if(!ok.has(id)){SKIPS(why.get(id)??'dropped',nodes[id]);}
    // A natural (non-submerged) candidate without a strip is a normal high segment again: fills back, face below.
    for(const id of absorbed)if(!ok.has(id)){stripCand.delete(id);absorbed.delete(id);for(const f of fills)if(ownerOf.get(f.apex)===id)addFill(f);}
    for(const id of cand)if(!ok.has(id))stripCand.delete(id);
    // Build. Outer corners inside a run go to −0.21 m (the DEM's own fill value); run ends keep the DEM height.
    const oy=n=>ok.has(n.prev)&&ok.has(n.id)?Math.min(n.y,-.21):n.y;
    const runs=[];
    for(const id of ok){if(ok.has(nodes[id].prev))continue;const run=[];let m=id;while(ok.has(m)&&!run.includes(m)){run.push(m);m=nodes[m].next;}runs.push(run);}
    {const seen=new Set(runs.flat());for(const id of ok)if(!seen.has(id)){const run=[];let m=id;while(ok.has(m)&&!seen.has(m)){seen.add(m);run.push(m);m=nodes[m].next;}runs.push(run);}}
    for(const run of runs){const surf=[];
      for(const id of run){const a=nodes[id],b=nodes[a.next],Ia=inner(a),Ib=inner(b),first=!ok.has(a.prev),last=!ok.has(b.id);
        const ro=a.ro,ya=oy(a),yb=oy(b),A=at(a),B=at(b);
        const prof=profile(Ia,Ib);
        const O=t=>[A[0]+(B[0]-A[0])*t,ya+(yb-ya)*t,A[1]+(B[1]-A[1])*t],I=p=>[p.x,p.y,p.z];
        const cells=[];for(let i=0;i+1<prof.length;i++)cells.push([O(prof[i].t),O(prof[i+1].t),I(prof[i+1]),I(prof[i])]);
        if(first){const side=profile(Ia,A).slice(1,-1).map(r=>[r.x,r.y,r.z]);cells[0]=[...cells[0],...side];}
        if(last){const side=profile(B,Ib).slice(1,-1).map(r=>[r.x,r.y,r.z]);const c=cells.at(-1);cells[cells.length-1]=[c[0],c[1],...side,c[2],c[3]];}
        const tris=[];
        for(const c of cells){if(c.length===4){tris.push([c[0],c[1],c[2]],[c[0],c[2],c[3]]);continue;}
          const C3=[c.reduce((s,p)=>s+p[0],0)/c.length,c.reduce((s,p)=>s+p[1],0)/c.length,c.reduce((s,p)=>s+p[2],0)/c.length];
          for(let k=0;k<c.length;k++)tris.push([C3,c[k],c[(k+1)%c.length]]);}
        for(let tri of tris){const ar=Math.abs((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0]));if(ar<1e-6)continue;
          tri=up(tri);const pl=planeOf(tri);if(!Number.isFinite(pl.dx)||!Number.isFinite(pl.dz))continue;groundTriangles.push(tri);
          if(ro)continue;const y=Math.max(...tri.map(p=>p[1])),cx=(tri[0][0]+tri[1][0]+tri[2][0])/3,cz=(tri[0][2]+tri[1][2]+tri[2][2])/3;
          // fully submerged triangles over sea cells need no support (the sea is what is there, as drawn).
          if(y<-.05&&tri.every(p=>!dryAt(p[0],p[2])))continue;
          // The whole strip replaces the terrain (also its submerged part, like the −0.21 m DEM land it replaces), so
          // drawn = physical everywhere on it; the sea beyond its outer line is water as before.
          tops.push({poly:tri.map(p=>({x:p[0],z:p[2]})),top:y,plane:pl,replacesTerrain:true,maxReferenceY:y+2.5,surface:surfaceAt(cx,cz),source:'coast:strip'});}
        cuts.push(cutOf([A,B,Ib,Ia],'coast-strip'));
        // Water contact along this strip's rungs (0 m crossing), appended to the run's single surf line.
        for(const r of prof){const o=O(r.t),yI=r.y;if(!(o[1]<0&&yI>0))continue;const s=-o[1]/(yI-o[1]),l=Math.hypot(r.x-o[0],r.z-o[2]);
          const w=[o[0]+(r.x-o[0])*s,o[2]+(r.z-o[2])*s],dir=[(r.x-o[0])/l,(r.z-o[2])/l],slope=(yI-o[1])/l;
          if(surf.length&&Math.hypot(surf.at(-1).w[0]-w[0],surf.at(-1).w[1]-w[1])<1e-6)continue;surf.push({w,dir,slope});}
        strips.push({a:id,b:b.id,ring:[A,B,Ib,Ia],absorbed:absorbed.has(id)});}
      // Surf ribbon: up to 0.3 m inland of the water contact, 2–3 cm over the strip, tapered to nothing over 1.5 m at
      // each end of the run (no blunt tabs), and broken where the contact jumps more than 3 m.
      // the contact points are smoothed along the run ([1 2 1] ×3, ends fixed) and the foam is a flat band
      // 4 cm over the water, from 0.25 m inland (buried in the rising strip) to 0.5 m out to sea, so a wobbling contact no
      // longer draws a dashed, kinked ribbon. Each entry: [inner, outer] points.
      for(let it=0;it<3;it++){const w=surf.map(p=>p.w);
        for(let i=1;i+1<surf.length;i++){if(Math.hypot(w[i+1][0]-w[i-1][0],w[i+1][1]-w[i-1][1])>6)continue;
          surf[i].w=[(w[i-1][0]+2*w[i][0]+w[i+1][0])/4,(w[i-1][1]+2*w[i][1]+w[i+1][1])/4];}}
      let along=[0];for(let i=1;i<surf.length;i++)along.push(along[i-1]+Math.hypot(surf[i].w[0]-surf[i-1].w[0],surf[i].w[1]-surf[i-1].w[1]));
      const total=along.at(-1)??0;let cur=[];
      surf.forEach((p,i)=>{if(i&&Math.hypot(p.w[0]-surf[i-1].w[0],p.w[1]-surf[i-1].w[1])>3){if(cur.length>1)foam.push(cur);cur=[];}
        //: width varies along the run (smooth noise over ~7 m) and the band nearly breaks in
        // places, so the contact reads as broken surf, not a painted border.
        const nz_=smoothNoise(p.w[0]+17,p.w[1]-9,7),vary=nz_<.18?.12:.35+.9*nz_,k=Math.min(1,along[i]/1.5,(total-along[i])/1.5)*vary,wi=.25*k,wo=.5*k;
        cur.push([[p.w[0]+p.dir[0]*wi,C.foamY,p.w[1]+p.dir[1]*wi],[p.w[0]-p.dir[0]*wo,C.foamY,p.w[1]-p.dir[1]*wo]]);});   // dir points inland
      if(cur.length>1)foam.push(cur);}}

  // Bank tops: the two flipped triangles of each cell, minus every strip quad over them (the strip's own tops replace
  // that ground, with the same plan planes as its render cut).
  {const sIdx=index(6);for(const c of cuts)sIdx.add({ring:c.ring,bb:bbox(c.ring),planes:c.planes});
    for(const k of flipCells){const i=k%nx,j=(k-i)/nx,xa=x0+i*step,za=z0+j*step,xb=xa+step,zb=za+step,cx=xa+step/2,cz=za+step/2;
      const v00=[xa,H[k],za],v10=[xb,H[k+1],za],v01=[xa,H[k+nx],zb],v11=[xb,H[k+nx+1],zb],near=[...sIdx.query([xa,xb,za,zb])];
      for(const tri0 of [[v00,v01,v11],[v00,v11,v10]]){let pieces=[tri0];for(const c of near)pieces=pieces.flatMap(p=>subtractConvex(p,c.planes));
        for(const p of pieces)for(let q=1;q+1<p.length;q++){let tri=[p[0],p[q],p[q+1]];
          if(Math.abs((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0]))<1e-6)continue;
          tri=up(tri);const pl=planeOf(tri);if(!Number.isFinite(pl.dx)||!Number.isFinite(pl.dz))continue;const y=Math.max(...tri.map(v=>v[1]));
          tops.push({poly:tri.map(v=>({x:v[0],z:v[2]})),top:y,plane:pl,replacesTerrain:true,maxReferenceY:y+2.5,surface:surfaceAt(cx,cz),source:'coast:bank'});}}}}

  // ---- Final shore polylines: runs of alive free segments; faces hang from them. ----
  // Original grid edges under a final segment (or under fill) are recorded in shoreSkip.
  const finalSegs=[];
  for(const id of alive){const n=nodes[id];if(n.state!==null||stripCand.has(id))continue;const q=nodes[n.next];
    if(Math.max(n.y,q.y)<C.minY)continue;
    finalSegs.push({a:n,b:q});}
  // Every free original edge is either buried under fill or replaced by a face (or lies at the water): no default skirt.
  for(const n of nodes)if(n.state===null)shoreSkip.add(n.key);

  // Vertex outward normals (mitred) along the final loops.
  const isFinal=new Set(finalSegs.map(s=>s.a.id));
  const vert=new Map();
  const vertexOf=n=>{let v=vert.get(n.id);if(v)return v;
    const p=nodes[n.prev],nIn=isFinal.has(p.id)?segNormal(p):null,nOut=isFinal.has(n.id)?segNormal(n):null,a=nIn??nOut,b=nOut??nIn;
    let mx=a[0]+b[0],mz=a[1]+b[1];const m=Math.hypot(mx,mz);if(m<1e-6){mx=b[0];mz=b[1];}else{mx/=m;mz/=m;}
    const k=1/Math.max(.55,mx*b[0]+mz*b[1]);
    const quay=builtShore(n.x,n.z),y=n.y;
    // Rock run outward from the top edge to the toe: steeper for high banks, varied by smooth noise (no grid pattern).
    const sl=C.slope[0]+(C.slope[1]-C.slope[0])*smoothNoise(n.x,n.z,9);
    let run=Math.min(C.maxRun,Math.max(.6,(y-C.toe)*sl+C.apron[0]+C.apron[1]*smoothNoise(n.x+50,n.z,3.1)));
    // a low top (under the wet band) gets a short run, so it never reads as a thin plank laid out over
    // the water (clipped tips at (−563,−631), (1098,−266), (924,−355)).
    const runRaw=run;if(y<C.wet+.1)run=Math.min(run,.5+Math.max(0,y)*2);
    // (coast bay nose (1300,130); (1098,−266)): a face end on a submerged corner tapers to its own
    // corner instead of laying a flat sheet out over the water.
    const run0=runRaw;if(y<C.foam)run=.05;
    // Never reach other land across a narrow channel: stop 0.4 m before the first dry cell along the normal.
    let cap=Infinity;for(let d=.25;d<=C.maxRun+.4;d+=.25)if(dryAt(n.x+mx*k*d,n.z+mz*k*d)){cap=Math.max(.15,d-.4);break;}
    run=Math.min(run,cap);
    v={id:n.id,x:n.x,y,z:n.z,m:[mx*k,mz*k],run,run0,cap,quay};vert.set(n.id,v);return v;};
  const faces=[];
  for(const s of finalSegs){const A=vertexOf(s.a),B=vertexOf(s.b);faces.push({a:A,b:B,quay:A.quay&&B.quay,ro:s.a.ro});}
  // a built-shore stretch is a quay only where the ground stands like one. A face whose neighbourhood
  // (±4 faces along the line) has a median edge height under 0.55 m is a low bank (the south-east inlet's east bank at
  // (1286–1306, 125–152): dark 0–0.8 m bulkhead facets on a sloping bank) and gets a grey rip-rap rock face instead.
  {const byA=new Map(faces.map(f=>[f.a.id,f])),byB=new Map(faces.map(f=>[f.b.id,f])),demote=[];
    // La Puntilla's photographed quay walls (Wikimedia Commons curid=106059407, curid=123441024, curid=182263185: Aduana, Arsenal, Puntilla east quay) stay quays at any height.
    for(const f of faces){if(!f.quay||photographedQuay(f.a.x,f.a.z))continue;const hs=[f.a.y,f.b.y];let p=f,q=f;
      for(let k=0;k<4;k++){p=p&&byB.get(p.a.id);q=q&&byA.get(q.b.id);for(const g of [p,q])if(g?.quay)hs.push(g.a.y,g.b.y);}
      hs.sort((x,y)=>x-y);if(hs[hs.length>>1]<C.quayMin)demote.push(f);}
    for(const f of demote)f.quay=false;
    // (Bahía SW tip (1200–1216, 272–282)): an isolated quay piece (a run of fewer than three quay faces)
    // between other owners' edges is a bank end, not a quay: rock, so it caps like the bank beside it.
    const isolated=[];for(const f of faces){if(!f.quay||photographedQuay(f.a.x,f.a.z))continue;let n=1,p=byB.get(f.a.id),q=byA.get(f.b.id);
      while(p?.quay&&n<3){n++;p=byB.get(p.a.id);}while(q?.quay&&n<3){n++;q=byA.get(q.b.id);}if(n<3)isolated.push(f);}
    for(const f of isolated){f.quay=false;for(const v of [f.a,f.b])v.run=v.run0=Math.min(v.run,.5);}}   // a short, steep rock end, no flap

  // Rock face rows (shared by drawing and physics): top (the shore line), shoulder, wet line, surf line, toe.
  // (quay join, Aduana (163.96, 290.14)): the coping no longer has a nose 3 cm proud of the face (drawn
  // ground over water); the face itself carries the coping's pale top course, flush with the face line.
  const rows=(v,quay)=>{if(quay){const cp=Math.max(C.toe-.2,v.y-.33);return [[0,v.y+C.coping.rise],[0,cp],[0,Math.min(cp,C.quayWet)],[0,C.toe-.3]];}
    const bulge=.18+.3*smoothNoise(v.x-20,v.z+7,2.3),r=v.run,top=v.y;
    if(top<C.wet+.1){const t=Math.max(top,C.toe+.05);return [[0,t],[r*.3,Math.max(C.toe+.04,t-.01)],[r*.6,Math.max(C.toe+.03,Math.min(t,C.wet)-.02)],[r*.8,Math.min(t,C.foam)],[r+.2,C.toe]];}
    const ws=Math.max(C.wet,Math.min(top-.05,C.wet+.25*smoothNoise(v.x,v.z-31,4.7)));
    const yS=ws+(top-ws)*.55,fS=Math.max(0,Math.min(1,(top-yS)/Math.max(.01,top-C.toe)));
    return [[0,top],[Math.min(r,r*fS+bulge*Math.min(1,top-ws)),yS],[r*(top-ws)/Math.max(.01,top-C.toe)+bulge*.5,ws],
      [r*(top-C.foam)/Math.max(.01,top-C.toe)+.1,C.foam],[r+.2,C.toe]];};
  // (Bahía outer bank: "a saw of short diagonals"): inside a run of rock faces the outward run is
  // smoothed over its neighbours (before the low/submerged-corner limits), so alternating 0/0.6 m DEM corners no longer
  // give 0.05 / 2 m teeth; those limits apply only where a run ends; the channel cap always applies.
  {const byA=new Map(faces.map(f=>[f.a.id,f])),byB=new Map(faces.map(f=>[f.b.id,f])),next=new Map();
    for(const v of vert.values()){const fin=byB.get(v.id),fout=byA.get(v.id);if(!fin||!fout||fin.quay||fout.quay)continue;
      const p=fin.a,q=fout.b;next.set(v,Math.min(v.cap,Math.max(.6,(p.run0+2*v.run0+q.run0)/4)));}
    for(const [v,r] of next)v.run=r;}
  for(const f of faces){f.rowsA=rows(f.a,f.quay);f.rowsB=rows(f.b,f.quay);}
  // Physical rock faces: one top per face triangle reaching above the water (below it the sea keeps its water flag).
  const at=(v,row)=>[v.x+v.m[0]*row[0],row[1],v.z+v.m[1]*row[0]];
  let faceTops=0;
  for(const f of faces){if(f.quay||f.ro)continue;
    for(let r=0;r+1<f.rowsA.length;r++){const a0=at(f.a,f.rowsA[r]),b0=at(f.b,f.rowsB[r]),a1=at(f.a,f.rowsA[r+1]),b1=at(f.b,f.rowsB[r+1]);
      for(let tri of [[a0,b0,b1],[a0,b1,a1]]){if(Math.max(...tri.map(p=>p[1]))<=C.rockFloor)continue;
        const ar=Math.abs((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0]));if(ar<1e-4)continue;
        tri=up(tri);const pl=planeOf(tri);if(!Number.isFinite(pl.dx)||!Number.isFinite(pl.dz)||Math.hypot(pl.dx,pl.dz)>6)continue;
        // Solid only above the wet band: below it the face is render-only, so a rider in the water can
        // never be pressed onto or held by rock under the surface; it falls to the sea floor and the water recovery runs.
        faceTops+=addTops(tri,pl,{surface:'gravel',source:'coast:rock'},C.rockFloor);}}}

  // ---- Quay coping: a pale 0.5 m band that IS the drawn ground (terrain grid triangles and fill ears
  // clipped to the band, exact split as the terrain mesh) raised 3 cm, render-only. The rideable surface stays the ground
  // itself, so the quay edge is never a step or a wall (the old 15 cm prism made inboard steps up to 61 cm),
  // and drawn ≠ physical by 3 cm at most. A nose face drops 0.36 m from the band's sea edge, 3 cm proud of the quay face.
  const copings=[],aprons=[];
  {const CP=C.coping,stripRings=index(6);for(const st of strips)stripRings.add({ring:st.ring,bb:bbox(st.ring)});
    const clip=(poly,ring)=>{const sg=Math.sign(signedArea(ring));let out=poly;
      for(let i=0;i<ring.length&&out.length>=3;i++){const a=ring[i],b=ring[(i+1)%ring.length],side=p=>sg*cross2(a,b,[p[0],p[2]]);const r=[];
        for(let k=0;k<out.length;k++){const P=out[k],Q=out[(k+1)%out.length],dp=side(P),dq=side(Q);
          if(dp>=0)r.push(P);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);r.push(P.map((v,j)=>v+(Q[j]-v)*t));}}out=r;}
      return out.length>=3?out:null;};
    const grid=(i,j)=>[x0+i*step,H[j*nx+i],z0+j*step];
    for(const f of faces){if(!f.quay||f.ro)continue;const A=f.a,B=f.b;if(Math.hypot(B.x-A.x,B.z-A.z)<.3||Math.min(A.y,B.y)<.1)continue;
      const band=[[A.x,A.z],[B.x,B.z],[B.x-B.m[0]*CP.width,B.z-B.m[1]*CP.width],[A.x-A.m[0]*CP.width,A.z-A.m[1]*CP.width]];
      if(Math.abs(signedArea(band))<1e-3||ownedBy(band))continue;
      {const t=shrink(band,.02);let hit=false;for(const it of stripRings.query(bbox(band)))if(overlaps(t,it.ring)){hit=true;break;}if(hit)continue;}   // a strip owns that ground
      const polys=[],[bx0,bx1,bz0,bz1]=bbox(band);
      for(let j=Math.floor((bz0-z0)/step);j<=Math.floor((bz1-z0)/step);j++)for(let i=Math.floor((bx0-x0)/step);i<=Math.floor((bx1-x0)/step);i++){
        if(!emitted(i,j))continue;
        for(const t of [[grid(i,j),grid(i,j+1),grid(i+1,j)],[grid(i+1,j),grid(i,j+1),grid(i+1,j+1)]]){const q=clip(t,band);if(q)polys.push(q);}}
      for(const it of fillIdx.query(bbox(band))){const q=clip(it.tri,band);if(q)polys.push(q);}
      if(!polys.length)continue;
      copings.push({a:A,b:B,polys:polys.map(q=>q.map(p=>[p[0],p[1]+CP.rise,p[2]])),nose:[[A.x+A.m[0]*CP.over,A.y+CP.rise,A.z+A.m[1]*CP.over],[B.x+B.m[0]*CP.over,B.y+CP.rise,B.z+B.m[1]*CP.over]],band});}
    // ((160,286) / La Puntilla V04): the fill ears behind a quay line were drawn in the terrain's
    // own earth colours, so the stair notches between the paving (which yields to the fills) and the coping read as
    // brown polygons. Each quay's fills, minus every coping band, become a weathered concrete apron (+3 cm, render-only;
    // the fills stay the physical ground). Never coplanar with a band: the band is subtracted exactly.
    const bandIdx=index(6);for(const k of copings)bandIdx.add({ring:k.band,bb:bbox(k.band),planes:planesOf(k.band)});
    const fillsBySeg=new Map();for(const f of fills){const o=ownerOf.get(f.apex);if(o===undefined||stripCand.has(o)||f.ro)continue;
      if(Math.max(...f.tri.map(t=>t[1]))<C.minY)continue;let l=fillsBySeg.get(o);if(!l)fillsBySeg.set(o,l=[]);l.push(f);}
    for(const f of faces){if(!f.quay||f.ro)continue;const list=fillsBySeg.get(f.a.id);if(!list)continue;const polys=[];
      for(const fl of list){let pieces=[fl.tri.map(p=>[...p])];const r=fl.tri.map(t=>[t[0],t[2]]);
        for(const b of bandIdx.query(bbox(r)))pieces=pieces.flatMap(p=>subtractConvex(p,b.planes));
        for(const p of pieces)if(p.length>=3&&Math.abs(signedArea(p.map(v=>[v[0],v[2]])))>1e-4)polys.push(p.map(v=>[v[0],v[1]+CP.rise,v[2]]));}
      // Colour: the paving tone an earlier owner tints the ground 3 m inland with (La Puntilla's parking asphalt at the
      // Aduana), so that paving reads as running out to the coping; else a weathered concrete grey (drawn default).
      const mx=(f.a.m[0]+f.b.m[0])/2,mz=(f.a.m[1]+f.b.m[1])/2,ml=Math.hypot(mx,mz)||1,px=(f.a.x+f.b.x)/2-mx/ml*3,pz=(f.a.z+f.b.z)/2-mz/ml*3;
      const kk=Math.round((pz-z0)/step)*nx+Math.round((px-x0)/step);let colour=null;
      for(const a of [...Object.values(areas),gate,fort])if(a?.tint?.has(kk)){const v=a.tint.get(kk);colour=typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:null;break;}
      if(polys.length)aprons.push({x:f.a.x,z:f.a.z,polys,colour});}}

  // Embedded rip-rap supports the edge of the continuous Paseo del Morro walkway.
  // It used to be the gate's ~1–2.5 m faceted icosahedra standing on the DEM; it moved here because only this area knows
  // the finished ground under it (strips, bank diagonals, faces). Stones 0.5–1.4 m across, squat (0.45–0.7 of their
  // width), each an irregular lump (6-vertex rim seated 7 cm into the ground at every rim vertex, a tilted 3-vertex top,
  // 10 triangles), laid in overlapping rows over a ~3.4 m band from its first free spot past 1.85 m off the walk's centreline (past the forecourt paving at the gate) (the 3.4 m strip keeps its
  // width), on to the waterline and ~1 m into the water where the bank is narrower. Drawn in the shore bins (no extra draw, no shadow). A dry stone standing
  // more than 20 cm proud is solid: a yawed box inside its top facet (never wider or taller than the drawn stone);
  // lower ones (the wheel steps 0.216 m) and wet ones are dressing, like the loose rocks. ----
  const stones={pos:[],tone:[],count:0},stoneColliders=[];
  if(gate?.path?.length>1){let seed=90217;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const inTri=(x,z,r)=>{const a=cross2(r[0],r[1],[x,z]),b=cross2(r[1],r[2],[x,z]),c=cross2(r[2],r[0],[x,z]);return (a>=0&&b>=0&&c>=0)||(a<=0&&b<=0&&c<=0);};
    const PB=bbox(gate.path);PB[0]-=40;PB[1]+=40;PB[2]-=40;PB[3]+=40;   // only the tops around the paseo (layout time)
    const cellTops=new Map(),ck=(i,j)=>i*100003+j;
    for(const t of tops){const p0=t.poly[0];if((p0.x<PB[0]||p0.x>PB[1]||p0.z<PB[2]||p0.z>PB[3])&&!(p0.x>740&&p0.z>40))continue;const r=t.poly.map(p=>[p.x,p.z]),bb=bbox(r),it={r,t};
      for(let i=Math.floor(bb[0]/2);i<=Math.floor(bb[1]/2);i++)for(let j=Math.floor(bb[2]/2);j<=Math.floor(bb[3]/2);j++){const k=ck(i,j);let l=cellTops.get(k);if(!l)cellTops.set(k,l=[]);l.push(it);}}
    // The finished ground: a coast top (strip, fill, bank, rock face) where there is one, else the drawn terrain, else a
    // shallow sea bed for the stones just past the waterline.
    const groundAt=(x,z)=>{let y=-Infinity;for(const it of cellTops.get(ck(Math.floor(x/2),Math.floor(z/2)))??[])if(inTri(x,z,it.r)){const p=it.t.plane;y=Math.max(y,p.y+p.dx*(x-p.x)+p.dz*(z-p.z));}
      return y>-Infinity?y:dryAt(x,z)?hF(x,z):-.6;};
    const path=gate.path,lines=[{pts:path.filter(p=>p[1]<34),start:1.85,edgeRow:true,sea:(a,b)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [-(b[1]-a[1])/l,(b[0]-a[0])/l];}}];
    if(gate.seaFrame?.length>3)lines.push({pts:gate.seaFrame.slice(0,4).map(f=>[f.x,f.z]),start:.75,sea:(a,b,i)=>[-gate.seaFrame[i].nx,-gate.seaFrame[i].nz]});
    const pCells=new Map();for(let i=0;i+1<path.length;i++){const a=path[i],b=path[i+1];
      for(let ci=Math.floor((Math.min(a[0],b[0])-16)/16);ci<=Math.floor((Math.max(a[0],b[0])+16)/16);ci++)for(let cj=Math.floor((Math.min(a[1],b[1])-16)/16);cj<=Math.floor((Math.max(a[1],b[1])+16)/16);cj++){
        const k=ci*100003+cj;let l=pCells.get(k);if(!l)pCells.set(k,l=[]);l.push(i);}}
    const pathY=(x,z)=>{let best=Infinity,y=0;for(const i of pCells.get(Math.floor(x/16)*100003+Math.floor(z/16))??[]){const a=path[i],b=path[i+1];
      const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1))),cx=a[0]+dx*u,cz=a[1]+dz*u,d=Math.hypot(x-cx,z-cz);
      if(d<best){best=d;y=hF(cx,cz);}}return {d:best,y};};
    const taken=new Map(),cellK=(x,z)=>Math.floor(x/1.2)*100003+Math.floor(z/1.2);
    const near=(x,z,r)=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const q of taken.get(cellK(x+i*1.2,z+j*1.2))??[])if(Math.hypot(q[0]-x,q[1]-z)<r)return true;return false;};
    // One stone: 6 rim vertices seated 7 cm into the finished ground, 3 top vertices over the rim sectors (tilted).
    const placeStone=(x,z,g,sx,sy,sz,edge=null)=>{const m=Math.max(sx,sz);if(!blockFreeAt(x,z,1.2)&&ownedBy([[x-m,z-m],[x+m,z-m],[x+m,z+m],[x-m,z+m]])||privateAt(Math.round(x*4)/4,Math.round(z*4)/4))return false;
      const th=edge?edge.yaw+(rnd()-.5)*.3:rnd()*6.283,cs=Math.cos(th),sn=Math.sin(th),W=(u,v)=>[x+u*cs+v*sn,z-u*sn+v*cs],P9=[];let gmin=Infinity,gsum=0;
      const h0=hF(x,z);   // rim seating: the finished ground at the centre plus the terrain's own change to each rim vertex
      for(let q=0;q<6;q++){const an=q*Math.PI/3+(rnd()-.5)*.5,j=.85+.25*rnd(),[px,pz]=W(sx*Math.cos(an)*j,sz*Math.sin(an)*j),gy=g+(dryAt(px,pz)?hF(px,pz)-h0:0);
        gmin=Math.min(gmin,gy);gsum+=gy;P9.push(px,gy-.07,pz);}
      const base=Math.max(g,gsum/6),tx=(rnd()-.5)*.25,tz=(rnd()-.5)*.25;let topMin=Infinity;
      for(let q=0;q<3;q++){const an=(2*q+1)*Math.PI/3+(rnd()-.5)*.5,j=edge?.63+.07*rnd():.4+.12*rnd(),u=sx*Math.cos(an)*j,v=sz*Math.sin(an)*j,[px,pz]=W(u,v),py=base+(edge?Math.max(.5,sy*(.6+.25*rnd())):sy*(.6+.25*rnd()))+tx*u+tz*v;
        topMin=Math.min(topMin,py);P9.push(px,py,pz);}
      stones.pos.push(...P9);stones.tone.push(rnd());stones.count++;const k=cellK(x,z);if(!taken.has(k))taken.set(k,[]);taken.get(k).push([x,z]);
      if(edge?g>=-.25&&topMin-Math.max(g,0)>.1:g>=.05&&topMin-g>.2){const bot=Math.min(g,gmin)-.3,top=topMin-.03,f=edge?.42:.3;
        stoneColliders.push({centre:{x,y:(bot+top)/2,z},halfExtents:{x:f*sx,y:(top-bot)/2,z:f*sz},rotationY:th,surface:'pavement',riprap:true,...(edge?{edge:true}:{})});}
      return true;};
    // Edge polylines (one point per band station), resampled below at a constant spacing so the row has no wide gaps.
    let edgeLine=[];const edgeLines=[],breakEdge=()=>{if(edgeLine.length>1)edgeLines.push(edgeLine);edgeLine=[];};
    for(const L of lines){let carry=0;
      for(let i=0;i+1<L.pts.length;i++){const a=L.pts[i],b=L.pts[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-6)continue;const ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,[nx_,nz_]=L.sea(a,b,i);
        let t=carry;
        for(;t<len;t+=1.6){let edge=L.start,firstD=null;
          for(let k=0;k<14;k++){const rh=.28+.42*rnd()**1.2,sx=rh*(1+.3*rnd()),sz=rh*(.75+.25*rnd()),sy=rh*(.45+.25*rnd()),D=edge+Math.max(sx,sz)*.8+.15*rnd(),along=t+(rnd()-.5)*.5;
            edge=D+Math.max(sx,sz)*.7;if(firstD!==null?D>firstD+1.2:D>L.start+6)break;
            const x=a[0]+ux*along+nx_*D,z=a[1]+uz*along+nz_*D,g=groundAt(x,z);if(g<-.5)break;
            const pd=pathY(x,z);
            if(pd.d-Math.max(sx,sz)*1.05<1.8||g>pd.y+.15||Math.abs(hF(x+.5,z)-hF(x-.5,z))>.9||Math.abs(hF(x,z+.5)-hF(x,z-.5))>.9)continue;
            if(placeStone(x,z,g,sx,sy,sz)&&firstD===null)firstD=D;}
          // (three cross-band rides reached the water where the old boulders stopped them): the outermost
          // row is a near-continuous edge of larger stones laid along the walk at the waterline (or just past the band where
          // the bank is wide), solid wherever they stand ≥ 10 cm proud (boxes inside their broad top facets).
          if(L.edgeRow&&firstD!==null){let De=null;const gTop=groundAt(a[0]+ux*t+nx_*firstD,a[1]+uz*t+nz_*firstD);   // on a steep bank the edge stands where the bank starts to drop (a rider is still on the ground there), not at its foot
            for(let D=Math.max(edge,firstD);D<=firstD+9;D+=.25){const gx=a[0]+ux*t+nx_*D,gz=a[1]+uz*t+nz_*D,gg=groundAt(gx,gz);if(gg<.45||gg<gTop-1.5){De=D-.2;break;}}
            if(De===null)De=Math.max(edge,firstD+3.2);
            while(De>firstD&&groundAt(a[0]+ux*t+nx_*De,a[1]+uz*t+nz_*De)<.12)De-=.25;   // the edge stands on dry ground
            const ep=[a[0]+ux*t+nx_*De,a[1]+uz*t+nz_*De],lp=edgeLine.at(-1);if(lp&&Math.hypot(ep[0]-lp[0],ep[1]-lp[1])>8)breakEdge();edgeLine.push(ep);}
          else if(L.edgeRow)breakEdge();}
        carry=t-len;}breakEdge();}
    for(const ln0 of edgeLines){let acc=0,ln=ln0;
      for(let it=0;it<3;it++)ln=ln.map((p,i)=>i===0||i===ln.length-1?p:[(ln[i-1][0]+2*p[0]+ln[i+1][0])/4,(ln[i-1][1]+2*p[1]+ln[i+1][1])/4]);   // no zigzag
      for(let i=0;i+1<ln.length;i++){const a=ln[i],b=ln[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<1e-6||l>10)continue;const ux=(b[0]-a[0])/l,uz=(b[1]-a[1])/l;
        for(;acc<l;acc+=.72){const x=a[0]+ux*acc,z=a[1]+uz*acc,rh=.45+.18*rnd(),sx=rh*1.6,sz=rh*(.95+.2*rnd()),sy=rh*(.5+.2*rnd());
          // (band ride (−854.8, −696.3)): where the walk's own paving (gate's paseo-end surface) owns the
          // edge line, the edge stands just past that paving on the open bank (the lower side), still on dry ground.
          if(!placeStone(x,z,groundAt(x,z),sx,sy,sz,{yaw:Math.atan2(-uz,ux)})){const sd=groundAt(x+uz*2,z-ux*2)<groundAt(x-uz*2,z+ux*2)?1:-1;
            for(let o=.5;o<=6;o+=.5){const px=x+uz*o*sd,pz=z-ux*o*sd,g=groundAt(px,pz);if(g<.12||!dryAt(px,pz))break;
              if(!ownedBy([[px-sx,pz-sx],[px+sx,pz-sx],[px+sx,pz+sx],[px-sx,pz+sx]])&&placeStone(px,pz,g,sx,sy,sz,{yaw:Math.atan2(-uz,ux)}))break;}}}
        acc-=l;}}
    // The toe: the same stones seated along the beach contact (half in the water), every ~1 m where the band above
    // has not already reached the water, so path edge and shore read as one revetment ((−409,−44)).
    // the same toe along the low bay banks east of the Muelle 4 (Bahía: east corner, outer bank).
    {const inPaseo=(x,z)=>x>740&&z>40&&!photographedQuay(x,z);let acc=0;
      for(const run of foam){for(let k=0;k+1<run.length;k++){const [i0,o0]=run[k],[i1,o1]=run[k+1];if(!inPaseo(o0[0],o0[2]))continue;
        const sx_=o0[0]-i0[0]+o1[0]-i1[0],sz_=o0[2]-i0[2]+o1[2]-i1[2],sl=Math.hypot(sx_,sz_);if(sl<.1)continue;
        const cx0=(i0[0]+o0[0])/2,cz0=(i0[2]+o0[2])/2,cx1=(i1[0]+o1[0])/2,cz1=(i1[2]+o1[2])/2,l=Math.hypot(cx1-cx0,cz1-cz0);acc+=l;
        while(acc>=1.0){acc-=1.0;const u=1-acc/Math.max(l,1e-6),bx=cx0+(cx1-cx0)*u,bz=cz0+(cz1-cz0)*u;
          const rh=.25+.3*rnd(),sx=rh*(1+.3*rnd()),sz=rh*(.75+.25*rnd()),sy=rh*(.45+.25*rnd()),out=-.2+.8*rnd(),x=bx+sx_/sl*out,z=bz+sz_/sl*out;
          if(near(x,z,1.1))continue;placeStone(x,z,groundAt(x,z),sx,sy,sz);}}}}
    stones.pos=Float32Array.from(stones.pos);stones.tone=Float32Array.from(stones.tone);}

  // ---- Shore tint (Wikimedia Commons curid=72372087, curid=80251220, curid=86543901, curid=109811939): land and strip corners within 5 m of a natural final shore line take a rock / wet
  // sand tone in large smooth patches, fading by distance into the terrain's own class colour, so the band follows the
  // smoothed line (not the grid). Corners another owner stands on (0.8 m) or that an earlier area tints are left alone.
  // tintBlend (k → [r,g,b sRGB 0–255, fade]): the unfaded tone and fade, so area `ground` can fade toward its own colour.
  const tint=new Map(),tintBlend=new Map();
  {const ROCK=['#75664d','#665b49','#80714f','#5e5950'].map(hexRGB),SAND=['#ad9a74','#a39170','#b5a27b'].map(hexRGB);
    const BASE=['#c8bfaa','#687d91','#7e9866','#346d80'].map(hexRGB),GREY=['#8e8b84','#85827b','#97938b'].map(hexRGB),R=5.5;
    const earlier=Object.values(areas).filter(a=>a?.tint?.size).map(a=>a.tint);if(gate?.tint)earlier.push(gate.tint);if(fort?.tint)earlier.push(fort.tint);
    const lines=[...faces.filter(f=>!f.quay).map(f=>[[f.a.x,f.a.z],[f.b.x,f.b.z]]),...strips.map(s=>[s.ring[0],s.ring[1]])];
    const best=new Map();
    for(const [A,B] of lines){const [a,b,c,d]=bbox([A,B]),ex=B[0]-A[0],ez=B[1]-A[1],l2=ex*ex+ez*ez||1e-9;
      for(let j=Math.floor((c-R-z0)/step);j<=Math.ceil((d+R-z0)/step);j++)for(let i=Math.floor((a-R-x0)/step);i<=Math.ceil((b+R-x0)/step);i++){
        if(i<0||j<0||i>=nx||j>=nz)continue;const x=x0+i*step,z=z0+j*step,u=Math.max(0,Math.min(1,((x-A[0])*ex+(z-A[1])*ez)/l2));
        // land side only (left of A→B), or the point lies on the line
        if(cross2(A,B,[x,z])<-1e-6)continue;
        const dd=Math.hypot(x-A[0]-ex*u,z-A[1]-ez*u);if(dd>R)continue;const k=j*nx+i;if((best.get(k)??Infinity)>dd)best.set(k,dd);}}
    // the Paseo stones' solid boxes keep the shore tint off the ground they stand on, as the gate's boulders did
    // (owners) before the band moved here.
    const stoneIdx=index(8);for(const k of stoneColliders){const r=boxRing(k);stoneIdx.add({ring:r,bb:bbox(r)});}
    const free=k=>{const [x,z]=P(k);{const q=[[x-.8,z-.8],[x+.8,z-.8],[x+.8,z+.8],[x-.8,z+.8]];for(const it of stoneIdx.query(bbox(q)))if(overlaps(q,it.ring))return false;}
      if(blockFreeAt(x,z,.9))return true;for(const it of owners.query([x-.8,x+.8,z-.8,z+.8]))if(overlaps([[x-.8,z-.8],[x+.8,z-.8],[x+.8,z+.8],[x-.8,z+.8]],it.ring))return false;return true;};
    // no shore tint within 9 m of a fitted wall's foot or a tall wall-owner solid: `ground` blends that ground into
    // its scarp tone (sj-ground.js scarpWeights), which would otherwise mix with this band.
    const wallIdx=index(16),wallOwners=[gate,fort,...Object.values(areas)].filter(a=>Array.isArray(a?.walls));
    const addSeg=(A,B)=>wallIdx.add({A,B,bb:[Math.min(A[0],B[0])-9,Math.max(A[0],B[0])+9,Math.min(A[1],B[1])-9,Math.max(A[1],B[1])+9]});
    for(const a of wallOwners)for(const wl of a.walls)if(wl.a?.B&&wl.b?.B)addSeg(wl.a.B,wl.b.B);
    for(const a of new Set([...wallOwners,areas.forttops].filter(Boolean)))for(const c of a.colliders??[]){if(!c.outer||c.maxY-c.minY<=4)continue;
      for(let q=0;q<c.outer.length;q++){const p=c.outer[q],r=c.outer[(q+1)%c.outer.length];addSeg([p.x,p.z],[r.x,r.z]);}}
    const nearWall=(x,z)=>{for(const it of wallIdx.query([x,x,z,z])){const ex=it.B[0]-it.A[0],ez=it.B[1]-it.A[1],u=Math.max(0,Math.min(1,((x-it.A[0])*ex+(z-it.A[1])*ez)/(ex*ex+ez*ez||1e-9)));
      if(Math.hypot(x-it.A[0]-ex*u,z-it.A[1]-ez*u)<=9)return true;}return false;};
    for(const [k,dd] of best){if(earlier.some(m=>m.has(k))||!free(k)||nearWall(...P(k)))continue;const [x,z]=P(k);
      const pick=(list,s)=>list[Math.min(list.length-1,Math.floor(smoothNoise(x+s,z-s,5)*list.length))];
      const rocky=smoothNoise(x,z,9)<.5,low=H[k]<1.2;
      // Built (bay) shores take a wet concrete/gravel grey, not rock or sand ((160,286)); natural shores keep a
      // full-strength band to 3 m before fading ((−409,−44): a continuous anchored bank, not a mottle).
      const built=builtShore(x,z),tone=built?pick(GREY,31):rocky||!low?pick(ROCK,11):pick(SAND,23),base=BASE[land[k]?surface?.[k]??0:0]??BASE[0];
      const f=Math.max(0,Math.min(1,(dd-3)/(R-3)))**1.3;
      tint.set(k,toHex(tone.map((v,c)=>v+(base[c]-v)*f)));tintBlend.set(k,[...tone,f]);}}
  // ---- Loose rocks: a few asymmetric clusters (2–5 rocks, mixed sizes) set into the wet band of the natural
  // rock faces, where smooth noise allows — not an even string beyond the shore. Dressing in the water region only. ----
  const rocks=[];
  {let acc=0;for(const f of faces){if(f.quay||f.ro)continue;const l=Math.hypot(f.b.x-f.a.x,f.b.z-f.a.z);acc+=l;
    while(acc>=C.rockEvery){acc-=C.rockEvery;const u=1-acc/Math.max(l,1e-6),x=f.a.x+(f.b.x-f.a.x)*u,z=f.a.z+(f.b.z-f.a.z)*u;
      if(smoothNoise(x+3,z-5,23)<.62)continue;
      const m=[f.a.m[0]+(f.b.m[0]-f.a.m[0])*u,f.a.m[1]+(f.b.m[1]-f.a.m[1])*u],ml=Math.hypot(...m)||1,run=f.a.run+(f.b.run-f.a.run)*u,top=f.a.y+(f.b.y-f.a.y)*u;
      if(top<.4)continue;
      const t=[(f.b.x-f.a.x)/l,(f.b.z-f.a.z)/l],nRock=2+Math.floor(hash(x,z)*4);
      for(let k=0;k<nRock;k++){const along=(hash(x+k,z)-.5)*3,out=run*(.55+.4*hash(z+k,x)),r=(k?.22:.45)+(k?.35:.5)*hash(x-k,z+k);
        const px=x+t[0]*along+m[0]/ml*out,pz=z+t[1]*along+m[1]/ml*out;
        if(dryAt(px,pz)||ownedBy([[px-r,pz-r],[px+r,pz-r],[px+r,pz+r],[px-r,pz+r]]))continue;
        rocks.push({x:+px.toFixed(3),z:+pz.toFixed(3),y:-.15+r*.3,r:+r.toFixed(3),yaw:hash(px,pz)*6.283,tone:hash(pz,px)});}}}}

  const riprap=[];   // the Paseo toe is part of the embedded stone band (`stones`) below

  // ---- Shore recovery points along public routes. A sparse set of dry public
  // spots on the routes along the shore (OSM ways except steps — the Paseo, the forecourt, Princesa, La Puntilla, the
  // quays, Bahía, the north overlooks, La Perla's walk — plus the gate's paseo and areas' authored `routeLines`), one per
  // ~65 m: dry, public (no private ground within 4 m), ≥ 6 m and ≤ 60 m from the sea, heading along the route away from
  // the sea. Typed (x, z, heading) triples, so later owner scans never read them as dressing. The watchdog checks each
  // placement at use (checked placement + departure). ----
  let recoveryPoints;
  {const seaDir=(x,z,R)=>{let near=Infinity,sx=0,sz=0;for(let a=0;a<16;a++){const sn=Math.sin(a*Math.PI/8),cs=Math.cos(a*Math.PI/8);
      for(let d=1;d<=R;d++)if(!dryAt(x+sn*d,z+cs*d)){if(d<near)near=d;sx+=sn/d;sz+=cs/d;break;}}return {near,sx,sz};};
    const routes=[...(city.roads??[]).filter(r=>r.kind!=='steps').map(r=>r.points),...(gate?.path?[gate.path]:[]),
      ...Object.values(areas).flatMap(a=>(a?.routeLines??[]).map(l=>l.points))].filter(p=>p?.length>1);
    const kept=[],cellK2=(x,z)=>Math.floor(x/65)*100003+Math.floor(z/65),grid=new Map();
    const free=(x,z)=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const q of grid.get(cellK2(x+i*65,z+j*65))??[])if(Math.hypot(q[0]-x,q[1]-z)<65)return false;return true;};
    for(const pts of routes)for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1e-6)continue;const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
      for(let t=0;t<L;t+=3){const x=a[0]+ux*t,z=a[1]+uz*t;if(!dryAt(x,z)||height(x,z)<.3||!free(x,z))continue;
        if([[x,z],[x+4,z],[x-4,z],[x,z+4],[x,z-4]].some(([px,pz])=>privateAt(Math.round(px*4)/4,Math.round(pz*4)/4)))continue;
        const sd=seaDir(x,z,60);if(!(sd.near>6&&sd.near<=60))continue;
        const away=-(ux*sd.sx+uz*sd.sz)>=0?Math.atan2(ux,uz):Math.atan2(-ux,-uz);
        kept.push(x,z,away);const k=cellK2(x,z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push([x,z]);}}
    // Gaps between routes (the open public bank below El Morro's lawn and west of the cemetery): unowned natural ground
    // 8–40 m from the sea on a 10 m lattice, gentle (≤ 0.25 rise/run), filling the same 65 m spacing; heading away from the sea.
    {const [bx0,bz0]=[x0,z0],bx1=x0+(nx-1)*step,bz1=z0+(nz-1)*step;
      for(let z=bz0+10;z<bz1;z+=10)for(let x=bx0+10;x<bx1;x+=10){if(!dryAt(x,z)||!free(x,z))continue;const y=hF(x,z);if(y<.3)continue;
        if(Math.hypot(hF(x+1,z)-hF(x-1,z),hF(x,z+1)-hF(x,z-1))/2>.25)continue;
        const sd=seaDir(x,z,40);if(!(sd.near>8&&sd.near<=40))continue;
        if([[x,z],[x+4,z],[x-4,z],[x,z+4],[x,z-4]].some(([px,pz])=>privateAt(px,pz)))continue;
        if(ownedBy([[x-2,z-2],[x+2,z-2],[x+2,z+2],[x-2,z+2]]))continue;
        kept.push(x,z,Math.atan2(-sd.sx,-sd.sz));const k=cellK2(x,z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push([x,z]);}}
    recoveryPoints=Float32Array.from(kept);}

  // Original shore loops (grid corners with the state of the edge leaving each): read-only mesh boundary data.
  const outline=loops.map(loop=>loop.map(e=>{const [x,z]=P(e.v);return {x,z,y:H[e.v],key:e.key,state:edgeState.get(e.key)};}));
  const count=(list,f)=>list.reduce((m,x)=>{const k=f(x);m[k]=(m[k]??0)+1;return m;},{});
  const layout={loops:loops.length,outline,skipAt,edges,tint,tintBlend,tops,groundTriangles,shoreSkip,faces,copings,aprons,rocks,riprap,flipCells,
    strips,foam,cuts,stones,recoveryPoints,colliders:stoneColliders,surfaces:[],floorTriangles:[],places:[],constants:{COAST},builtShore,sea:true,
    seaGrid:{land,x0,z0,nx,nz,step}};
  layout.qa=()=>({loops:loops.length,edges,edgeStates:reasons,fills:fills.length,removed,finalSegments:finalSegs.length,
    faces:count(faces,f=>f.quay?'quay':'rock'),faceTops,copings:copings.length,aprons:aprons.length,rocks:rocks.length,riprap:riprap.length,recoveryPoints:recoveryPoints.length/3,stones:stones.count,stoneColliders:stoneColliders.length,flipCells:flipCells.size,tops:tops.length,
    strips:strips.length,absorbed:absorbed.size,stripSkips,foamRuns:foam.length,cuts:cuts.length,renderOnly:renderOnly.size,tinted:tint.size,skipped:shoreSkip.size,maxDepth:Math.max(0,...fills.map(f=>f.depth))});
  return layout;
}
