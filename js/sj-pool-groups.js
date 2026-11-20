/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Shared plaza detail pools: tight-merge grouping (perf pass, afternoon 2026-11-18) — © 2026 VibezZzCoder, MIT.
// `bake` in sj-plaza.js pools repeated parts in 64 m cells, which left 40–70 small draws per old-city street view. This
// merges compatible pools (same primitive or merged-batch kind, same material, same shadow flags) only where the merged
// bounding sphere stays almost as tight as the larger member: then a view that submits the merged pool would have
// submitted the larger member anyway, so draws fall without new far submissions. Shadow-casting pools never merge
// (merged casters entered the 96 m sun frustum where neither member did, +1k–5k sun triangles), so
// every caster batch and the shadow pass are exactly as before. Measured on the ten cost stations and 1,850 rider cameras
// along every road:  "" / "".
// Pure function on plain spheres; deterministic (greedy smallest growth first, ties by input order).
export const POOL_GROUPING={delta:24,cap:128,triCap:6000};

// items: [{key, x, y, z, r, tri, cast}] → array of index groups (each group: ascending input indices).
export function groupPools(items,{delta,cap,triCap}=POOL_GROUPING){
  const byKey=new Map();
  items.forEach((it,i)=>{let list=byKey.get(it.key);if(!list)byKey.set(it.key,list=[]);list.push({members:[i],x:it.x,y:it.y,z:it.z,r:it.r,tri:it.tri,cast:it.cast});});
  const out=[];
  for(const list of byKey.values()){
    for(;;){
      let best=null;
      for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){
        const A=list[a],B=list[b];
        if(A.cast||B.cast||Math.min(A.tri,B.tri)>triCap)continue;
        const u=union(A,B),big=Math.max(A.r,B.r);
        if(u.r>Math.min(cap,big+delta))continue;
        const grow=u.r-big;if(!best||grow<best.grow)best={grow,a,b,u};
      }
      if(!best)break;
      const A=list[best.a],B=list[best.b];
      list[best.a]={members:[...A.members,...B.members],...best.u,tri:A.tri+B.tri,cast:A.cast};list.splice(best.b,1);
    }
    for(const g of list)out.push(g.members.sort((p,q)=>p-q));
  }
  return out.sort((p,q)=>p[0]-q[0]);
}

// Smallest sphere enclosing two spheres.
function union(A,B){
  const dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z,d=Math.hypot(dx,dy,dz);
  if(d+B.r<=A.r)return {x:A.x,y:A.y,z:A.z,r:A.r};
  if(d+A.r<=B.r)return {x:B.x,y:B.y,z:B.z,r:B.r};
  const r=(d+A.r+B.r)/2,t=(r-A.r)/d;
  return {x:A.x+dx*t,y:A.y+dy*t,z:A.z+dz*t,r};
}

// Shared paving (perf afternoon 2026-11-18): split one kind's flat triangle list (9 numbers per triangle) into geographic
// clusters — 128 m cells holding a triangle centroid, joined when they touch (8-neighbour), so a gap of one empty cell
// separates clusters. Triangles keep their exact values and their order inside each cluster; clusters are ordered by
// their first triangle. Returns plain arrays (the caller copies them into typed attributes).
export const PAVING_CLUSTER_CELL=128;
export function pavingClusters(positions,cell=PAVING_CLUSTER_CELL){
  const keyAt=i=>Math.floor((positions[i]+positions[i+3]+positions[i+6])/3/cell)+','+Math.floor((positions[i+2]+positions[i+5]+positions[i+8])/3/cell);
  const occupied=new Set();for(let i=0;i<positions.length;i+=9)occupied.add(keyAt(i));
  const component=new Map();let n=0;
  for(const start of occupied){if(component.has(start))continue;component.set(start,n);const stack=[start];
    while(stack.length){const [a,b]=stack.pop().split(',').map(Number);
      for(let da=-1;da<=1;da++)for(let db=-1;db<=1;db++){const k=(a+da)+','+(b+db);if(occupied.has(k)&&!component.has(k)){component.set(k,n);stack.push(k);}}}
    n++;}
  if(n<2)return [positions];
  const out=new Map();
  for(let i=0;i<positions.length;i+=9){const c=component.get(keyAt(i));let list=out.get(c);if(!list)out.set(c,list=[]);for(let j=0;j<9;j++)list.push(positions[i+j]);}
  return [...out.values()];
}
