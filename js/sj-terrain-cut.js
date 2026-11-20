/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Bounded convex terrain subtraction (render only) — © 2026 VibezZzCoder, MIT.
// Same contract as the SF fork's tunnel cavities: triangles outside a cut keep their exact shared heightfield vertices;
// only the part inside the convex volume is removed, and an authored floor/walls/vault own that space instead.

// planes: [a,b,c,d], inside ⇔ a·x+b·y+c·z+d > eps for every plane. Vertices: [x,y,z,...attributes].
export function subtractConvex(poly,planes,eps=1e-9) {
  const pieces=[];let remaining=poly;
  for(const q of planes) {
    const d=remaining.map(v=>q[0]*v[0]+q[1]*v[1]+q[2]*v[2]+q[3]);
    if(d.every(x=>x<=eps)){pieces.push(remaining);return pieces;}  // wholly outside this plane: keep all of it
    if(d.every(x=>x>eps))continue;
    const inside=[],outside=[];
    for(let i=0;i<remaining.length;i++) {
      const a=remaining[i],b=remaining[(i+1)%remaining.length],da=d[i],db=d[(i+1)%remaining.length];
      (da>eps?inside:outside).push(a);
      if((da>eps)!==(db>eps)){const t=da/(da-db);const p=a.map((v,k)=>v+(b[k]-v)*t);inside.push(p);outside.push(p);}
    }
    if(outside.length>=3)pieces.push(outside);
    remaining=inside;
    if(remaining.length<3)return pieces;
  }
  return pieces; // what is left lies inside every plane and is removed
}

export const cutTouches=(cut,minX,maxX,minZ,maxZ)=>cut.maxX>=minX&&cut.minX<=maxX&&cut.maxZ>=minZ&&cut.minZ<=maxZ;

// Opt-in for vertical-prism cuts with a convex plan `ring` (`tight:true`, wall-foot strips): a triangle whose plan does
// not overlap the ring's interior is left whole. Without it, any triangle straddling a plane's extended line inside the
// cut's bounding box is split into needless fragments (+7 MB of ground arrays for the wall-foot cuts). Cuts without the
// flag keep the original path byte for byte.
function separated(a,b){for(const [p,q] of [[a,b],[b,a]])for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length],nx=u[1]-v[1],nz=v[0]-u[0];
  let pmin=Infinity,pmax=-Infinity,qmin=Infinity,qmax=-Infinity;
  for(const r of p){const s=r[0]*nx+r[1]*nz;if(s<pmin)pmin=s;if(s>pmax)pmax=s;}
  for(const r of q){const s=r[0]*nx+r[1]*nz;if(s<qmin)qmin=s;if(s>qmax)qmax=s;}
  const tol=1e-9*Math.hypot(nx,nz);if(pmax<=qmin+tol||qmax<=pmin+tol)return true;}
  return false;}

// Fragment sharing keyed by the first six values (position + key colour) with the same equality as their joined decimal
// strings (shortest round-trip: distinct doubles differ, 0 and -0 and NaN/NaN match = SameValueZero), without the strings.
const same=(a,b)=>a===b||(a!==a&&b!==b);
function sharedId(ids,v,next){let byZ=ids.get(v[0]);if(!byZ)ids.set(v[0],byZ=new Map());let list=byZ.get(v[2]);if(!list)byZ.set(v[2],list=[]);
  for(const e of list)if(same(e[0],v[1])&&same(e[1],v[3])&&same(e[2],v[4])&&same(e[3],v[5]))return e[4];
  list.push([v[1],v[3],v[4],v[5],next]);return undefined;}

// Index one regular-grid terrain chunk: untouched triangles reuse the shared grid vertices; touched triangles are
// clipped and their outside fragments appended as new vertices (position + colour), preserving winding.
// share (opt-in, chunks holding `tight` cuts): fragment vertices with identical position and colour are emitted once.
// keyCol (optional, area `ground`): the colours that decide sharing and fragment identity instead of `col`, so a recoloured
// terrain keeps exactly the vertex positions and indices of the base colouring; `col` is only interpolated.
export function clipChunkTriangles(idx,pos,col,cuts,share=false,keyCol=null) {
  const out=[],extraP=[],extraC=[],ids=share?new Map():null;let next=pos.length/3;
  const vertex=keyCol?i=>[pos[i*3],pos[i*3+1],pos[i*3+2],keyCol[i*3],keyCol[i*3+1],keyCol[i*3+2],col[i*3],col[i*3+1],col[i*3+2]]
    :i=>[pos[i*3],pos[i*3+1],pos[i*3+2],col[i*3],col[i*3+1],col[i*3+2]];
  // Candidate cuts per triangle from a 4 m hash (a superset, kept in the original order, then the same exact test), so
  // chunks holding thousands of small cuts stay fast; the result is identical to filtering the whole list.
  const H=4,hash=new Map(),hk=(i,j)=>i*1000003+j;
  if(cuts.length>8)cuts.forEach((c,n)=>{for(let i=Math.floor(c.minX/H);i<=Math.floor(c.maxX/H);i++)for(let j=Math.floor(c.minZ/H);j<=Math.floor(c.maxZ/H);j++){
    const k=hk(i,j);let l=hash.get(k);if(!l)hash.set(k,l=[]);l.push(n);}});
  // Same candidates as a Set + sort, without per-triangle allocation when no cut box touches the triangle (most of them).
  const seen=new Int32Array(cuts.length).fill(-1),found=[];
  const candidates=(x0,x1,z0,z1,t)=>{if(cuts.length<=8)return cuts;found.length=0;
    for(let i=Math.floor(x0/H);i<=Math.floor(x1/H);i++)for(let j=Math.floor(z0/H);j<=Math.floor(z1/H);j++){const l=hash.get(hk(i,j));
      if(l)for(const n of l)if(seen[n]!==t){seen[n]=t;found.push(n);}}
    return found.length?found.sort((a,b)=>a-b).map(n=>cuts[n]):found;};
  for(let t=0;t<idx.length;t+=3) {
    const i0=idx[t],i1=idx[t+1],i2=idx[t+2],xa=pos[i0*3],xb=pos[i1*3],xc=pos[i2*3],za=pos[i0*3+2],zb=pos[i1*3+2],zc=pos[i2*3+2];
    const x0=Math.min(xa,xb,xc),x1=Math.max(xa,xb,xc),z0=Math.min(za,zb,zc),z1=Math.max(za,zb,zc);
    const near=candidates(x0,x1,z0,z1,t);
    if(!near.length){out.push(i0,i1,i2);continue;}
    const tri=[i0,i1,i2];
    const local=near.filter(c=>cutTouches(c,x0,x1,z0,z1)
      &&!(c.tight&&separated(tri.map(i=>[pos[i*3],pos[i*3+2]]),c.ring)));
    if(!local.length){out.push(...tri);continue;}
    let polys=[tri.map(vertex)];
    for(const c of local)polys=polys.flatMap(p=>subtractConvex(p,c.planes));
    if(polys.length===1&&polys[0].length===3&&polys[0].every((v,k)=>v.every((x,j)=>x===vertex(tri[k])[j]))){out.push(...tri);continue;}
    for(const p of polys)for(let k=1;k+1<p.length;k++) {
      for(const v of [p[0],p[k],p[k+1]]){
        if(ids){const id=sharedId(ids,v,next);if(id!==undefined){out.push(id);continue;}}
        extraP.push(v[0],v[1],v[2]);if(keyCol)extraC.push(v[6],v[7],v[8]);else extraC.push(v[3],v[4],v[5]);out.push(next++);}
    }
  }
  return {index:out,extraPositions:extraP,extraColours:extraC};
}
