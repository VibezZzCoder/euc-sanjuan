/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Single-owner paving regions — © 2026 VibezZzCoder, MIT. Input geography: OSM / ODbL.
// Convex half-plane partitioning happens once at construction, before clipping onto the original terrain facets.
export const signedArea=ring=>ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2;
const usable=ring=>ring.length>=3&&Math.abs(signedArea(ring))>1e-8;

function split(poly,a,b,sign) {
  const inside=[],outside=[];
  const distance=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
  for(let i=0;i<poly.length;i++) {
    const p=poly[i],q=poly[(i+1)%poly.length],dp=distance(p),dq=distance(q);
    (dp>=0?inside:outside).push(p);
    if((dp>=0)!==(dq>=0)) {
      const t=dp/(dp-dq),point=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
      inside.push(point);outside.push(point);
    }
  }
  return {inside,outside};
}

export function intersectRings(poly,ring) {
  let remaining=poly;const sign=Math.sign(signedArea(ring));
  for(let i=0;i<ring.length&&remaining.length;i++)remaining=split(remaining,ring[i],ring[(i+1)%ring.length],sign).inside;
  return remaining;
}

export function subtractRing(poly,ring) {
  // Emit each outside half-plane once, then continue with only the unassigned interior.
  if(!usable(intersectRings(poly,ring)))return [poly];
  let remaining=poly;const pieces=[],sign=Math.sign(signedArea(ring));
  for(let i=0;i<ring.length&&usable(remaining);i++) {
    const {inside,outside}=split(remaining,ring[i],ring[(i+1)%ring.length],sign);
    if(usable(outside))pieces.push(outside);
    remaining=inside;
  }
  return pieces;
}

export function pavingInputs(detail,plaza) {
  const nodes=new Map(),key=p=>p.map(v=>v.toFixed(6)).join(',');
  const sections=plaza.paving.map((road,index)=>{
    const {a,b,width,source,kind}=road,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const ends=[{point:a,dx:dx/length,dz:dz/length},{point:b,dx:-dx/length,dz:-dz/length}];
    for(const e of ends){Object.assign(e,{index,width,source,kind});const k=key(e.point);if(!nodes.has(k))nodes.set(k,[]);nodes.get(k).push(e);}
    return {road,ends,index};
  });
  function offset(e) {
    let nx=-e.dz,nz=e.dx;
    // Adjacent segments of one mapped street share a bounded mitre, rather than two mismatched square end caps.
    const mate=nodes.get(key(e.point)).filter(q=>q.index!==e.index&&q.source===e.source&&q.kind===e.kind&&q.width===e.width
      &&q.dx*e.dx+q.dz*e.dz<-.5).sort((a,b)=>(a.dx-b.dx)*e.dx+(a.dz-b.dz)*e.dz)[0];
    if(mate){const tx=e.dx-mate.dx,tz=e.dz-mate.dz,len=Math.hypot(tx,tz),mx=-tz/len,mz=tx/len,den=mx*nx+mz*nz;
      if(den>.5){nx=mx/den;nz=mz/den;}}
    return [nx*e.width/2,nz*e.width/2];
  }
  const roads=sections.map(({road,ends,index})=>{
    const {a,b,kind,priority=kind==='asphalt'?1:2}=road,[na,nb]=ends.map(offset);
    return {kind,index,priority,ring:[[a[0]+na[0],a[1]+na[1]],[b[0]-nb[0],b[1]-nb[1]],
      [b[0]+nb[0],b[1]+nb[1]],[a[0]-na[0],a[1]-na[1]]]};
  });
  // Explicit through-street ownership precedes default asphalt/sett priority. Source order breaks equal-priority ties.
  roads.sort((a,b)=>a.priority-b.priority||a.index-b.index);
  return [...roads,{kind:'plaza',index:-1,ring:detail.plaza.ring}];
}

export function createPavingRegions(detail,plaza) {
  const inputs=pavingInputs(detail,plaza),regions=[];
  for(let i=0;i<inputs.length;i++) {
    let pieces=[inputs[i].ring];
    for(let j=0;j<i&&pieces.length;j++)pieces=pieces.flatMap(poly=>subtractRing(poly,inputs[j].ring));
    for(const ring of pieces)regions.push({kind:inputs[i].kind,ring});
  }
  return regions;
}
