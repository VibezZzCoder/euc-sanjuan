/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Wall-foot strips for every fitted rampart  — © 2026 VibezZzCoder, MIT. Heights: USGS DEM.
// area module, registered last so it can see every other owner. Contract fields: tops, cuts, groundTriangles
// (drawn by sj-world.js inside the terrain mesh, with the terrain's own vertex colours), plus empty colliders/surfaces.
// Cause: the 2 m DEM grid crosses each battered face at a shallow angle, so the line where the kept terrain meets the
// face (or the plinth in front of it) wobbled up to 1.1 m inside one 2 m interval ("sawtooth" grass).
// Rule: beside each drawn interval a 2.5 m strip of ground is replaced, drawn and physical, by a ruled surface from a
// smooth foot line on the wall's visible front (plinth front where one is drawn, else the face) out to the exact kept
// terrain (its polyline crossings of grid lines and the shared triangles' diagonals). The foot line is the lower envelope
// of the old meeting line (±2 m), smoothed: a shallow ditch no deeper than the teeth it removes, the plinth fully shown.
// At a strip's ends the foot returns to the old meeting height and the end edge is the exact terrain polyline too, so no
// skirt or lip exists anywhere on a strip's boundary. Render cuts: the strip's own plan (exact edges) and the masonry
// footprint behind it up to the crest line (terrain there is inside the wall or a tooth through its face).
// Never overlaps another owner: intervals touching another area's tops, cuts, surfaces, floors, paving, colliders,
// trees/dressing, private ground, water or another strip are skipped.
import {signedArea} from './sj-paving.js';
import {inRing} from './sj-plaza-layout.js';

export const WALL_FOOT={widths:[2.5,2,1.6,1.3,1,.75,.5],slope:.3,bank:.8,push:.03,reach:2,taper:4,low:.1,high:.08,clear:.6,minLength:.05};

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],lerp2=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function bbox(r){let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of r){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}return [a,b,c,d];}
function convex(r){const s=Math.sign(signedArea(r));if(!s||Math.abs(signedArea(r))<1e-3)return false;
  for(let i=0;i<r.length;i++)if(s*cross2(r[i],r[(i+1)%r.length],r[(i+2)%r.length])<-1e-9)return false;return true;}
// Exact vertical planes of a convex ring: inside ⇔ a·x+c·z+d > 0 (no offset, so shared edges leave no sliver).
function planesOf(r){const s=Math.sign(signedArea(r));
  return r.map((a,i)=>{const b=r[(i+1)%r.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1,nx=-s*ez/l,nz=s*ex/l;return [nx,0,nz,-(nx*a[0]+nz*a[1])];});}
const cutOf=(r,kind)=>{const [minX,maxX,minZ,maxZ]=bbox(r);return {ring:r,planes:planesOf(r),minX,maxX,minZ,maxZ,kind,tight:true};};
function shrink(r,d){const cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length;
  return r.map(p=>{const dx=p[0]-cx,dz=p[1]-cz,l=Math.hypot(dx,dz)||1,k=Math.max(0,l-d)/l;return [cx+dx*k,cz+dz*k];});}
function segCross(a,b,c,d){const d1=cross2(c,d,a),d2=cross2(c,d,b),d3=cross2(a,b,c),d4=cross2(a,b,d);return d1*d2<0&&d3*d4<0;}
// Does convex ring A (already shrunk) overlap polygon B (any simple ring)?
function overlaps(A,B){const sA=Math.sign(signedArea(A));for(const p of B)if(insideConvex(p,A,sA))return true;for(const p of A)if(inRing(p[0],p[1],B))return true;
  for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++)if(segCross(A[i],A[(i+1)%A.length],B[j],B[(j+1)%B.length]))return true;return false;}
function insideConvex(p,r,s=Math.sign(signedArea(r))){for(let i=0;i<r.length;i++)if(s*cross2(r[i],r[(i+1)%r.length],p)<=0)return false;return true;}

// Uniform-grid index of owner rings / points.
function index(cell=8){const m=new Map(),key=(i,j)=>i*100003+j;
  return {add(item){const [a,b,c,d]=item.bb;for(let i=Math.floor(a/cell);i<=Math.floor(b/cell);i++)for(let j=Math.floor(c/cell);j<=Math.floor(d/cell);j++){
      const k=key(i,j);let l=m.get(k);if(!l)m.set(k,l=[]);l.push(item);}},
    query(bb){const out=new Set();for(let i=Math.floor(bb[0]/cell);i<=Math.floor(bb[1]/cell);i++)for(let j=Math.floor(bb[2]/cell);j<=Math.floor(bb[3]/cell);j++)
      for(const it of m.get(key(i,j))??[])if(it.bb[0]<=bb[1]&&bb[0]<=it.bb[1]&&it.bb[2]<=bb[3]&&bb[2]<=it.bb[3])out.add(it);return out;}};}

export function createWallFootLayout({city,height,terrain,surface,land,gate,fort,corridor,areas}) {
  const W=WALL_FOOT,{x0,z0,step,nx,nz}=terrain,tops=[],cuts=[],groundTriangles=[],strips=[],skipped=[];
  const cellOf=(x,z)=>{const i=Math.floor((x-x0)/step),j=Math.floor((z-z0)/step);return i>=0&&j>=0&&i<nx-1&&j<nz-1?j*nx+i:-1;};
  const dry=(x,z)=>{const k=cellOf(x,z);return !!(k>=0&&land&&land[k]&&land[k+1]&&land[k+nx]&&land[k+nx+1]);};
  // Exact kept-terrain polyline along a→b: crossings of grid lines and the shared triangles' b–c diagonals (u+v=1).
  const profile=(a,b,extra=[])=>{const ts=new Set([0,1,...extra]),dx=b[0]-a[0],dz=b[1]-a[1];
    const add=(f0,df,c0)=>{if(Math.abs(df)<1e-12)return;const lo=Math.min(f0,f0+df),hi=Math.max(f0,f0+df);
      for(let k=Math.ceil((lo-c0)/step);c0+k*step<=hi+1e-9;k++){const t=(c0+k*step-f0)/df;if(t>1e-9&&t<1-1e-9)ts.add(t);}};
    add(a[0],dx,x0);add(a[1],dz,z0);add(a[0]+a[1],dx+dz,x0+z0);
    return [...ts].sort((p,q)=>p-q).map(t=>{const x=a[0]+dx*t,z=a[1]+dz*t;return {t,x,z,y:height(x,z)};});};

  // ---- Owners: everything another area authored on or over the ground. ----
  const rings=index(),things=index(),private_=[];
  const ownRing=(r,what)=>{if(r?.length>=3)rings.add({ring:r,bb:bbox(r),what});};
  const others=[['gate',gate],['fort',fort],...Object.entries(areas)].filter(([,a])=>a);
  for(const [key,a] of others){
    for(const t of a.tops??[])ownRing(t.poly.map(p=>[p.x,p.z]),key+':top');
    for(const c of a.cuts??[])ownRing(c.ring??[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]],key+':cut');
    for(const s of a.surfaces??[])ownRing(s.ring,key+':surface');
    // Princesa draws its Raíces brick separately from its surfaces (merge review: two strip pieces overlapped it, 0.75 m²).
    for(const s of a.brick??[])ownRing(s.ring,key+':brick');
    for(const f of a.floorTriangles??[])ownRing(f.map(p=>[p[0],p[2]]),key+':floor');
    if(a.offLimitsAt)private_.push(a.offLimitsAt);}
  const boxRing=c=>{const {x:cx,z:cz}=c.centre,{x:hx,z:hz}=c.halfExtents,r=c.rotationY??0,cs=Math.cos(r),sn=Math.sin(r);
    return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([u,v])=>[cx+u*cs+v*sn,cz-u*sn+v*cs]);};
  const colliderRing=(c,what)=>{const r=c.outer?c.outer.map(p=>[p.x,p.z]):c.centre?boxRing(c):null;if(r&&Math.abs(signedArea(r))>1e-4)things.add({ring:r,bb:bbox(r),what});};
  for(const [key,a] of others)for(const c of a.colliders??[])colliderRing(c,key+':collider');
  for(const b of city.buildings)things.add({ring:b.outer,bb:bbox(b.outer),what:'building'});
  // Draped paving strips (corridor streets): the segment ± half width + 0.5 m.
  for(const p of corridor?.paving??[]){const [ux,uz]=(d=>{const l=Math.hypot(...d)||1;return [d[0]/l,d[1]/l];})(sub(p.b,p.a)),h=p.width/2+.5;
    ownRing([[p.a[0]-uz*h-ux*h,p.a[1]+ux*h-uz*h],[p.b[0]-uz*h+ux*h,p.b[1]+ux*h+uz*h],[p.b[0]+uz*h+ux*h,p.b[1]-ux*h+uz*h],[p.a[0]+uz*h-ux*h,p.a[1]-ux*h-uz*h]],'corridor:paving');}
  // Point dressing (trees, palms, lamps, benches, bollards, poles, rocks…): any area array of {x,z} records, plus city trees.
  const point=(x,z,what)=>{const r=W.clear;things.add({ring:[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]],bb:[x-r,x+r,z-r,z+r],what});};
  for(const [x,z] of city.trees)point(x,z,'tree');
  const SKIP=new Set(['stations','walls','ends','places','runs','segs','segments','garitas','path','seaLine','wallLine']);
  for(const [key,a] of others)for(const [field,v] of Object.entries(a)){if(SKIP.has(field)||!Array.isArray(v))continue;
    for(const o of v)if(o&&typeof o==='object'&&!Array.isArray(o)&&Number.isFinite(o.x)&&Number.isFinite(o.z)&&!o.outer)point(o.x,o.z,key+':'+field);}

  // ---- Wall intervals and their visible front. ----
  const sources=[['gate',gate,gate?.constants?.PLINTH,w=>!w.portal,(a,b)=>a.full&&b.full],['fort',fort,fort?.constants?.PLINTH],
    ['cristobal',areas.cristobal,areas.cristobal?.constants?.PLINTH],['princesa',areas.princesa,areas.princesa?.constants?.PLINTH],
    ['norzagaray',areas.norzagaray,null],['perlaWest',areas.perlaWest,null]].filter(s=>s[1]?.walls?.length);
  const chains=[];
  for(const [key,area,PLINTH,keep=()=>true,plinthOK=()=>true] of sources){
    // Visible front at a station: plinth front (LB at bottom → L at plinth top) or the face (B at bottom → T at crest).
    const front=(s,plinth)=>plinth?{bot:s.LB,top:s.L,yb:s.bottom,yt:s.plinthTop??s.base+PLINTH.rise}:{bot:s.B,top:s.T,yb:s.bottom,yt:s.crest};
    let cur=null,last=null;
    for(const w of area.walls){if(!keep(w)){cur=null;continue;}
      const plinth=!!PLINTH&&plinthOK(w.a,w.b),fa=front(w.a,plinth),fb=front(w.b,plinth);
      if(Math.hypot(...sub(fb.bot,fa.bot))<W.minLength&&Math.hypot(...sub(fb.top,fa.top))<W.minLength){continue;}  // collapsed corner interval
      const joined=cur&&last&&last.plinth===plinth&&Math.hypot(...sub(last.fb.bot,fa.bot))<1e-6&&Math.hypot(...sub(last.fb.top,fa.top))<1e-6;
      if(!joined){cur={area:key,nodes:[{s:w.a,f:fa}],intervals:[]};chains.push(cur);}
      cur.nodes.push({s:w.b,f:fb});cur.intervals.push({w,plinth});last={fb,plinth};}
  }
  // Node geometry: outward normal per interval, mitred at joints; the old meeting height y0 of terrain and front.
  const frontAt=(f,y)=>{const t=Math.max(0,Math.min(1,(y-f.yb)/(f.yt-f.yb||1)));return lerp2(f.bot,f.top,t);};
  const meet=f=>{const g=y=>{const p=frontAt(f,y);return height(p[0],p[1])-y;};if(g(f.yb)<=0)return f.yb;if(g(f.yt)>=0)return f.yt;
    let lo=f.yb,hi=f.yt;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(g(m)>0)lo=m;else hi=m;}return (lo+hi)/2;};
  for(const c of chains){const N=c.nodes;
    const nrm=c.intervals.map((iv,k)=>{const a=N[k].f.bot,b=N[k+1].f.bot,d=sub(b,a),l=Math.hypot(...d)||1,s=N[k].s;
      let n=[-d[1]/l,d[0]/l];if(n[0]*s.nx+n[1]*s.nz<0)n=[-n[0],-n[1]];iv.n=n;return n;});
    N.forEach((node,k)=>{const a=nrm[Math.max(0,k-1)],b=nrm[Math.min(nrm.length-1,k)],mx=a[0]+b[0],mz=a[1]+b[1],m=Math.hypot(mx,mz)||1;
      node.m=[mx/m,mz/m];node.k=1/Math.max(.5,(mx*b[0]+mz*b[1])/m);node.y0=meet(node.f);
      node.bottom=node.f.yb;node.top=node.f.yt;});
    let s=0;N.forEach((node,k)=>{if(k)s+=Math.hypot(...sub(node.f.bot,N[k-1].f.bot));node.along=s;});}
  const inner=(node,y)=>{const p=frontAt(node.f,y);return [p[0]-node.m[0]*W.push,p[1]-node.m[1]*W.push];};
  const outer=(node,I,width)=>[I[0]+node.m[0]*node.k*width,I[1]+node.m[1]*node.k*width];

  // ---- Acceptance per interval (provisional foot = old meeting height). ----
  const accepted=index(4);
  // passOnly: the caller needs only accepted/rejected (every width but the last), so the cheap ownership tests run before the
  // 81-point water/private scan; the tests are pure, so the verdict is the same. The last width keeps the original order,
  // which decides the recorded skip reason.
  const reasonOf=(c,k,width,passOnly=false)=>{const N=c.nodes,a=N[k],b=N[k+1];
    const Ia=inner(a,a.y0),Ib=inner(b,b.y0),Oa=outer(a,Ia,width),Ob=outer(b,Ib,width),strip=[Ia,Ib,Ob,Oa],mas=[a.s.T,b.s.T,Ib,Ia];
    if(!convex(strip))return 'fold';
    // A front standing over a steep natural bank (cross-fall > 45°) has no foot line to repair: the bank stays DEM.
    if(Math.abs(height(...Oa)-a.y0)>W.bank*width||Math.abs(height(...Ob)-b.y0)>W.bank*width)return 'bank';
    if(Math.abs(signedArea(mas))>1e-3&&!convex(mas))return 'fold';
    const scan=()=>{for(let u=0;u<=1.0001;u+=.125)for(let v=0;v<=1.0001;v+=.125){const p=lerp2(lerp2(Ia,Ib,u),lerp2(Oa,Ob,u),v);if(!dry(p[0],p[1]))return 'water';
      const y=height(p[0],p[1]);if(private_.some(f=>f(p[0],p[1],y)))return 'private';}return null;};
    if(!passOnly){const r=scan();if(r)return r;}
    for(const p of [a.s.T,b.s.T])if(!dry(p[0],p[1]))return 'water';
    const all=[...strip,a.s.T,b.s.T],bb=bbox(all),test=shrink(strip,.02),testM=Math.abs(signedArea(mas))>1e-3?shrink(mas,.05):null;
    for(const it of rings.query(bb))if(overlaps(test,it.ring)||(testM&&overlaps(testM,it.ring)))return it.what;
    // Colliders and dressing: only the part of the strip clear of the wall's own masonry (outward of the face bottom).
    const off=nd=>{const f=nd.f,d=Math.max(0,...[f.bot,nd.s.B,nd.s.LB??nd.s.B].map(p=>(p[0]-f.bot[0])*nd.m[0]+(p[1]-f.bot[1])*nd.m[1]))+.12;return d;};
    const Ta=[Ia[0]+a.m[0]*off(a),Ia[1]+a.m[1]*off(a)],Tb=[Ib[0]+b.m[0]*off(b),Ib[1]+b.m[1]*off(b)],out=[Ta,Tb,Ob,Oa];
    if(convex(out)){const t2=shrink(out,.02);for(const it of things.query(bbox(out)))if(overlaps(t2,it.ring))return it.what;}
    for(const it of accepted.query(bb))if(it.chain!==c||Math.abs(it.k-k)>1){if(overlaps(test,it.ring))return 'strip';}
    return passOnly?scan():null;};
  // Widest strip that fits (2.5 m like the San Cristóbal ramp bands, down to 1 m before a paseo or promenade edge).
  for(const c of chains){c.ok=c.intervals.map((iv,k)=>{let r=null;
    for(const width of W.widths){r=reasonOf(c,k,width,width!==W.widths.at(-1));if(!r){iv.width=width;break;}}iv.reason=r;
    if(!r){const N=c.nodes,Ia=inner(N[k],N[k].y0),Ib=inner(N[k+1],N[k+1].y0),ring=[Ia,Ib,outer(N[k+1],Ib,iv.width),outer(N[k],Ia,iv.width)];accepted.add({ring,bb:bbox(ring),chain:c,k});}
    else skipped.push({area:c.area,reason:r,x:+c.nodes[k].s.x.toFixed(2),z:+c.nodes[k].s.z.toFixed(2)});
    return !r;});}

  // ---- Strips: maximal runs of accepted intervals. Foot line, then exact geometry. ----
  // Stairs (seams): a strip under a mapped paved way (footway, path, steps; not tagged grass/dirt/ground/unpaved)
  // rides as pavement there whatever the DEM mask says (El Morro 1179846746: grass's rolling resistance stalled a climb).
  const UNPAVED=/grass|dirt|ground|earth|sand|mud|unpaved|gravel/,PG=8,pavedCells=new Map();
  for(const r of city?.roads??[]){if(!['footway','path','steps','pedestrian'].includes(r.kind)||UNPAVED.test(r.surface??''))continue;const half=(r.width||2.2)/2;
    for(let i=0;i+1<r.points.length;i++){const a=r.points[i],b=r.points[i+1],seg={a,b,half};
      for(let gx=Math.floor((Math.min(a[0],b[0])-half)/PG);gx<=Math.floor((Math.max(a[0],b[0])+half)/PG);gx++)for(let gz=Math.floor((Math.min(a[1],b[1])-half)/PG);gz<=Math.floor((Math.max(a[1],b[1])+half)/PG);gz++){
        const k=gx*100003+gz;let l=pavedCells.get(k);if(!l)pavedCells.set(k,l=[]);l.push(seg);}}}
  const onPavedWay=(x,z)=>(pavedCells.get(Math.floor(x/PG)*100003+Math.floor(z/PG))??[]).some(q=>{const dx=q.b[0]-q.a[0],dz=q.b[1]-q.a[1],l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-q.a[0])*dx+(z-q.a[1])*dz)/l));return Math.hypot(x-q.a[0]-dx*t,z-q.a[1]-dz*t)<=q.half;});
  const surfaceAt=(x,z)=>{const k=cellOf(x,z);return k>=0&&surface?.[k]===2&&!onPavedWay(x,z)?'grass':'pavement';};
  const up=tri=>{const [p,q,r]=tri,ny=(q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]);return ny<0?[p,r,q]:tri;};
  const planeOf=tri=>{const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
    const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;return {x:p[0],y:p[1],z:p[2],dx:-cx/cy,dz:-cz/cy};};
  // Build every strip, then reject any interval whose final quad overlaps another quad (a fold at a sharp re-entrant
  // corner or a return, where neighbours are not excluded) and rebuild until none do.
  const acceptSkips=skipped.splice(0),built=[];let buildSkips=[];
  for(let pass=0;pass<8;pass++){
    for(const a of [tops,cuts,groundTriangles,strips,built])a.length=0;buildSkips=[];
    for(const c of chains){let k=0;
      while(k<c.intervals.length){if(!c.ok[k]){k++;continue;}let e=k;while(e+1<c.intervals.length&&c.ok[e+1])e++;
        build(c,k,e);k=e+1;}}
    const idx=index(4);built.forEach((q,i)=>{q.i=i;q.bb=bbox(q.ring);idx.add(q);});let bad=0;
    for(const q of built){if(!q.c.ok[q.k])continue;const t=shrink(q.ring,.02);
      for(const o of idx.query(q.bb))if(o.i<q.i&&o.c.ok[o.k]&&overlaps(t,o.ring)){q.c.ok[q.k]=false;bad++;
        acceptSkips.push({area:q.c.area,reason:'strip',x:+q.c.nodes[q.k].s.x.toFixed(2),z:+q.c.nodes[q.k].s.z.toFixed(2)});break;}}
    if(!bad)break;}
  skipped.push(...acceptSkips,...buildSkips);
  function build(c,k0,k1){
    const N=c.nodes.slice(k0,k1+2),ivs=c.intervals.slice(k0,k1+1);
    // Foot line (docs: "foot level"): the lower envelope of the old meeting line within ±reach (a shallow ditch, the
    // plinth shown), held within ±30 % cross-fall of the kept ground at the strip's outer edge (narrow verges beside a
    // paseo stay a gentle fall, not a groove; where the bank falls away the toe follows it down) and never more than
    // 30 cm over the old line (no buried face). Three [1 2 1] passes; the ends return to the old meeting height.
    // A node's width is the narrower of its intervals' (shrinking only ever moves a strip away from other owners).
    const width=N.map((n,i)=>Math.min(ivs[i-1]?.width??Infinity,ivs[i]?.width??Infinity));
    const yOut=N.map((n,i)=>height(...outer(n,inner(n,n.y0),width[i])));
    const clamp=(v,i)=>Math.max(N[i].bottom+W.low,Math.min(N[i].top-W.high,v));
    let f=N.map(n=>Math.min(...N.filter(o=>Math.abs(o.along-n.along)<=W.reach).map(o=>o.y0)));
    f=f.map((v,i)=>clamp(Math.min(N[i].y0+.3,Math.max(yOut[i]-W.slope*width[i],Math.min(yOut[i]+W.slope*width[i],v))),i));
    for(let p=0;p<3;p++)f=f.map((v,i)=>i===0||i===f.length-1?v:(f[i-1]+2*v+f[i+1])/4);
    const L=N.at(-1).along-N[0].along,tau=Math.min(W.taper,L/2)||1;
    const ends=[[0,N[0].y0-f[0]],[N.length-1,N.at(-1).y0-f.at(-1)]];
    f=f.map((v,i)=>{let y=v;for(const [j,dy] of ends){const d=Math.abs(N[i].along-N[j].along);if(d<tau)y+=dy*(1-d/tau);}return clamp(y,i);});
    // Strip ends whose old meeting line is buried above the front (or exposes its bottom) are trimmed off.
    const endBad=i=>N[i].y0>N[i].top-W.high||N[i].y0<N[i].bottom+W.low;
    if(endBad(0)||endBad(N.length-1)){
      if(k1===k0){buildSkips.push({area:c.area,reason:'buried-end',x:+N[0].s.x.toFixed(2),z:+N[0].s.z.toFixed(2)});return;}
      if(endBad(0)){buildSkips.push({area:c.area,reason:'buried-end',x:+N[0].s.x.toFixed(2),z:+N[0].s.z.toFixed(2)});return build(c,k0+1,k1);}
      buildSkips.push({area:c.area,reason:'buried-end',x:+N.at(-1).s.x.toFixed(2),z:+N.at(-1).s.z.toFixed(2)});return build(c,k0,k1-1);}
    const I=N.map((n,i)=>inner(n,f[i])),O=N.map((n,i)=>outer(n,I[i],width[i]));
    // End vertices sit exactly on the kept terrain (so the end edge is the exact terrain polyline).
    const fy=f.map((v,i)=>i===0||i===N.length-1?height(...I[i]):v);
    const strip={area:c.area,keys:ivs.map(iv=>[iv.w.a,iv.w.b].map(q=>q.x.toFixed(4)+','+q.z.toFixed(4)).join('|')),nodes:N.map((n,i)=>({I:I[i],O:O[i],width:width[i],y:fy[i],y0:n.y0,bottom:n.bottom,top:n.top,along:n.along-N[0].along,x:n.s.x,z:n.s.z})),tris:[],intervals:ivs.length};
    for(let k=0;k<ivs.length;k++){const a=k,b=k+1,startEnd=k===0,lastEnd=k===ivs.length-1;
      // Convex interval polygon: inner edge (straight, the visible line), the end line's exact terrain polyline at a strip
      // end, the outer edge's exact terrain polyline, then the start end line; fanned from the plan centroid (no slivers
      // with steep grades where two crossings nearly coincide).
      const P=(p,y)=>[p[0],y,p[1]],E=(p,q)=>profile(p,q).slice(1,-1).map(r=>[r.x,r.y,r.z]);
      const ring=[P(I[a],fy[a]),P(I[b],fy[b]),...(lastEnd?E(I[b],O[b]):[]),P(O[b],height(...O[b])),...E(O[b],O[a]),P(O[a],height(...O[a])),
        ...(startEnd?E(O[a],I[a]):[])];
      const mid=lerp2(O[a],O[b],.5),C=[(I[a][0]+I[b][0]+O[a][0]+O[b][0])/4,((fy[a]+fy[b])/2+height(...mid))/2,(I[a][1]+I[b][1]+O[a][1]+O[b][1])/4];
      const tris=ring.map((p,r)=>[C,p,ring[(r+1)%ring.length]]);
      for(let tri of tris){const ar=Math.abs((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0]));if(ar<1e-6)continue;
        tri=up(tri);const pl=planeOf(tri);if(!Number.isFinite(pl.dx)||!Number.isFinite(pl.dz))continue;
        const cx=(tri[0][0]+tri[1][0]+tri[2][0])/3,cz=(tri[0][2]+tri[1][2]+tri[2][2])/3,y=Math.max(tri[0][1],tri[1][1],tri[2][1]);
        groundTriangles.push(tri);strip.tris.push(tri);
        tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:y,plane:pl,replacesTerrain:true,maxReferenceY:y+2.5,surface:tri.some(t=>onPavedWay(t[0],t[2]))?'pavement':surfaceAt(cx,cz),source:'wallFoot:'+c.area});}
      built.push({c,k:k0+k,ring:[I[a],I[b],O[b],O[a]]});cuts.push(cutOf([I[a],I[b],O[b],O[a]],'wall-foot'));
      const mas=[N[a].s.T,N[b].s.T,I[b],I[a]];if(Math.abs(signedArea(mas))>1e-3&&convex(mas))cuts.push(cutOf(mas,'wall-foot-masonry'));}
    strips.push(strip);}

  const total=chains.reduce((s,c)=>s+c.intervals.length,0);
  const layout={strips,skipped,tops,cuts,groundTriangles,colliders:[],surfaces:[],floorTriangles:[],places:[],constants:{WALL_FOOT}};
  // Created outside this scope: a closure made here would keep the whole construction context (owner indexes, chains) alive.
  layout.qa=footQa(total,strips,skipped,tops,cuts,groundTriangles);
  return layout;
}
function footQa(total,strips,skipped,tops,cuts,groundTriangles){
  const count=(list,f)=>list.reduce((m,x)=>{const k=f(x);m[k]=(m[k]??0)+1;return m;},{});
  return ()=>({intervals:total,stripIntervals:strips.reduce((s,x)=>s+x.intervals,0),strips:strips.length,triangles:groundTriangles.length,
    tops:tops.length,cuts:cuts.length,byArea:count(strips,s=>s.area),skipped:count(skipped,s=>s.area+' '+s.reason)});
}
