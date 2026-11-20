/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Seams geometry helpers — © 2026 VibezZzCoder, MIT. No three.js: layout-side.
import {signedArea} from './sj-paving.js';

// Clip the two triangles of every terrain cell under a convex ring (XZ), keeping exact terrain heights (Sutherland–Hodgman;
// the plaza overlay's recipe and diagonal split [a,c,b],[b,c,d]). Appends [[x,y,z]×3] to out; `tag` (optional) is stored
// as the triangle's fourth element.
export function drapeConvex(ring,terrain,out,tag,cellOk){const {x0,z0,step,nx,nz,heights:H}=terrain,ccw=signedArea(ring)>0?1:-1;
  const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
  const i0=Math.max(0,Math.floor((Math.min(...xs)-x0)/step)),i1=Math.min(nx-2,Math.floor((Math.max(...xs)-x0)/step));
  const j0=Math.max(0,Math.floor((Math.min(...zs)-z0)/step)),j1=Math.min(nz-2,Math.floor((Math.max(...zs)-z0)/step));
  const clip=poly=>{let o=poly;for(let e=0;e<ring.length&&o.length;e++){const a=ring[e],b=ring[(e+1)%ring.length],side=p=>ccw*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
      const next=[];for(let k=0;k<o.length;k++){const p=o[k],q=o[(k+1)%o.length],dp=side(p),dq=side(q);if(dp>=0)next.push(p);
        if((dp>=0)!==(dq>=0)){const u=dp/(dp-dq);next.push(p.map((v,i)=>v+(q[i]-v)*u));}}o=next;}return o;};
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){if(cellOk&&!cellOk(i,j))continue;const k=j*nx+i,x=x0+i*step,z=z0+j*step;
    const a=[x,H[k],z],b=[x+step,H[k+1],z],c=[x,H[k+nx],z+step],d=[x+step,H[k+nx+1],z+step];
    for(const tri of [[a,c,b],[b,c,d]]){const poly=clip(tri);for(let q=1;q+1<poly.length;q++){const A=poly[0],B=poly[q],C=poly[q+1];
      if(Math.abs((B[0]-A[0])*(C[2]-A[2])-(B[2]-A[2])*(C[0]-A[0]))<1e-9)continue;out.push(tag===undefined?[A,B,C]:[A,B,C,tag]);}}}}

// An [x,y,z] polygon minus a convex XZ ring: the pieces outside it (each outside one edge and inside the edges before it).
export function minusConvex(poly,ring){const r=signedArea(ring)>0?ring:[...ring].reverse(),pieces=[];let rest=poly;
  const half=(o,a,b,keepLeft)=>{const side=p=>(keepLeft?1:-1)*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));const next=[];
    for(let k=0;k<o.length;k++){const p=o[k],q=o[(k+1)%o.length],dp=side(p),dq=side(q);if(dp>=0)next.push(p);
      if((dp>0&&dq<0)||(dp<0&&dq>0)){const u=dp/(dp-dq);next.push(p.map((v,i)=>v+(q[i]-v)*u));}}return next;};
  for(let e=0;e<r.length&&rest.length>=3;e++){const a=r[e],b=r[(e+1)%r.length],out=half(rest,a,b,false);if(out.length>=3)pieces.push(out);rest=half(rest,a,b,true);}
  return pieces;}

// Closed ring offset inward by d (mitred; small d only — no collapse handling).
export function insetRing(ring,d){const s=signedArea(ring)>0?1:-1,n=ring.length;
  return ring.map((p,i)=>{const a=ring[(i+n-1)%n],b=ring[(i+1)%n],e=(q,r)=>{const L=Math.hypot(r[0]-q[0],r[1]-q[1])||1;return [-(r[1]-q[1])/L*s,(r[0]-q[0])/L*s];};
    const n0=e(a,p),n1=e(p,b),mx=n0[0]+n1[0],mz=n0[1]+n1[1],m=Math.hypot(mx,mz)||1,k=d/Math.max(.5,(mx*n1[0]+mz*n1[1])/m);
    return [p[0]+mx/m*k,p[1]+mz/m*k];});}

// ---- Stairs (public stairs ride up and down, no wheel clipping) ----
// A mapped flight drawn as real uniform treads with the shared model of js/sj-stairs.js (smooth lifted nose-line support
// as replacement tops, presentation seat via the registered record). A thin wrapper only: the model is the module's.
// a→b: the flight's plan axis (foot at a + s0 along it); width: tread width across; ground(x,z): the drawn surface before
// the foot and beyond the top. Returns {fl, tops, cut, treads (plan quads + top), record}.
import {rideableFlight,stairRecord} from './sj-stairs.js';
export function seamsFlight({a,b,s0=0,run,width,yf,yt,n,ground,grid,source,margin=.02,footApron=0,topApron=0,refAbove=4}){
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/L,dz=(b[1]-a[1])/L,nx=-dz,nz=dx;
  const at=(u,s)=>[a[0]+dx*(s0+s)+nx*u,a[1]+dz*(s0+s)+nz*u],u0=-width/2,u1=width/2;
  const fl=rideableFlight({at,u0,u1,run,yf,yt,n,ground,margin,footApron,topApron,...(grid?{grid}:{})});
  const plane=t=>{const [p,q,w]=t,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2],cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;
    return {x:p[0],y:p[1],z:p[2],dx:-cx/cy,dz:-cz/cy};};
  const tops=fl.tops.map(t=>{const top=Math.max(t[0][1],t[1][1],t[2][1]);return {poly:t.map(p=>({x:p[0],z:p[2]})),top,plane:plane(t),replacesTerrain:true,maxReferenceY:top+refAbove,surface:'pavement',source};});
  // Render-only cut of the flight's footprint (the treads are drawn above the DEM).
  let ring=[at(u0,-footApron),at(u1,-footApron),at(u1,run+topApron),at(u0,run+topApron)];if(signedArea(ring)<0)ring.reverse();const sa=Math.sign(signedArea(ring));
  const planes=ring.map((p,k)=>{const q=ring[(k+1)%4],ex=q[0]-p[0],ez=q[1]-p[1],l=Math.hypot(ex,ez)||1,px=-sa*ez/l,pz=sa*ex/l;return [px,0,pz,-(px*p[0]+pz*p[1])];});
  const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
  let lo=Math.min(yf,yt);for(const t of fl.aprons??[])for(const p of t)lo=Math.min(lo,p[1]);
  const cut={ring,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),kind:'seams-flight',planes:[...planes,[0,1,0,-(lo-.25)]]};
  const treads=fl.treads.map(t=>({quad:[at(u0,t.s0),at(u1,t.s0),at(u1,t.s1),at(u0,t.s1)],s0:t.s0,s1:t.s1,top:t.top,nosing:t.nosing}));
  return {fl,tops,cut,treads,aprons:fl.aprons??[],record:stairRecord(fl),frame:{a:at(0,0),dx,dz,nx,nz,u0,u1},nosing:fl.nosing,run,width};}
