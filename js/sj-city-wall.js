/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Fitted city-wall runs shared by wall areas (Norzagaray north wall, La Perla west / Cementerio) — © 2026
// VibezZzCoder, MIT. Extracted unchanged from sj-norzagaray-layout.js (2026-11-16): geometry helpers, walk-edge limits,
// walk/bank agreement and drawn intervals whose rideable walk is exactly the drawn grass quad (replacement tops).
import {wallBody} from './sj-fort-layout.js';
import {subtractRing,signedArea} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';

export const unit=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return [dx/l,dz/l];};
// Same values as Math.min/max over the spread coordinates (pairwise Math.min/max), without the temporary arrays (perf 2026-11-18).
export function bounds(r){let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of r){a=Math.min(a,p[0]);b=Math.max(b,p[0]);c=Math.min(c,p[1]);d=Math.max(d,p[1]);}return [a,b,c,d];}
export const overlapB=(a,b,m=0)=>a[0]<=b[1]+m&&b[0]<=a[1]+m&&a[2]<=b[3]+m&&b[2]<=a[3]+m;
// Signed distance to a polyline: negative on the left of travel (west→east lines: south), with the nearest segment.
export function sideOf(line,x,z){let best=null;
  for(let i=0;i+1<line.length;i++){const a=line[i],b=line[i+1],dx=b[0]-a[0],dz=b[1]-a[1],L2=dx*dx+dz*dz||1;
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L2)),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(x-px,z-pz);
    if(!best||d<best.d)best={d,i,t,s:Math.sign(dx*(z-a[1])-dz*(x-a[0]))||1};}
  return best;}
// Ribbon of convex quads along a polyline between offsets lo..hi (left negative), mitred at shared bisectors.
export function ribbon(line,lo,hi){const n=line.slice(1).map((b,i)=>{const [ux,uz]=unit(line[i],b);return [-uz,ux];});
  const off=(i,d)=>{const a=n[Math.max(0,i-1)],b=n[Math.min(n.length-1,i)],mx=a[0]+b[0],mz=a[1]+b[1],m=Math.hypot(mx,mz)||1,
    k=d/Math.max(.5,(mx*b[0]+mz*b[1])/m);return [line[i][0]+mx/m*k,line[i][1]+mz/m*k];};
  const out=[];for(let i=0;i+1<line.length;i++){const q=[off(i,lo),off(i+1,lo),off(i+1,hi),off(i,hi)];
    if(Math.abs(signedArea(q))>1e-4)out.push(...convexPieces(q));}
  return out;}
export function minus(pieces,rings){let out=pieces;const pb=new Map(),boundsOf=p=>{let b=pb.get(p);if(!b)pb.set(p,b=bounds(p));return b;};
  for(const r of rings){const rb=bounds(r),next=[];for(const p of out){if(!overlapB(boundsOf(p),rb,.01)){next.push(p);continue;}next.push(...subtractRing(p,r));}out=next;}
  return out.filter(p=>p.length>=3&&Math.abs(signedArea(p))>1e-3);}
export function convexPlanes(ring){const s=Math.sign(signedArea(ring)),planes=[];
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1;
    // inside ⇔ on the interior side of every edge
    const nx=-s*ez/l,nz=s*ex/l;planes.push([nx,0,nz,-(nx*a[0]+nz*a[1])+1e-4]);}
  return planes;}
export const plane=tri=>{const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;return {x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny};};

// Fitter convention: (−uz,ux) points out of the city, so runs are fitted east → west. Returns turn `ret` m inward.
export function withReturns(pts,head,tail,ret=3){const out=[...pts];
    if(head){const [ux,uz]=unit(pts[0],pts[1]);out.unshift([pts[0][0]+uz*ret,pts[0][1]-ux*ret]);}
    if(tail){const [ux,uz]=unit(pts.at(-2),pts.at(-1));out.push([pts.at(-1)[0]+uz*ret,pts.at(-1)[1]-ux*ret]);}
    return out;}

export function limitWalkEdge(runs,height){
  // The broad top must not overrun the walk: where the bank rises right behind the wall (and at return corners) the
  // walk's inner edge W sits at least 0.4 m behind the parapet's inner face Q.
  for(const run of runs)for(const s of run.stations){const f=p=>(p[0]-s.x)*s.nx+(p[1]-s.z)*s.nz,fq=f(s.Q);
    if(f(s.W)>fq-.4){const d=fq-.4-f(s.W);s.W=[s.W[0]+s.nx*d,s.W[1]+s.nz*d];s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);}}
}

export function agreeWalks(runs,height){
  // Walk/bank agreement (V review): the drawn walk strip [Q..W] must stay above the kept DEM. Along five lines per
  // interval, march from Q toward W and stop where the DEM rises 2 cm over the walk line; each station's W comes in to
  // the nearest limit of its intervals (never closer than 0.4 m behind Q). Where even that strip is covered, the walk rises.
  for(const run of runs){const st=run.stations,lim=st.map(()=>1),Lq=(a,b,k,f)=>[a[k][0]+(b[k][0]-a[k][0])*f,a[k][1]+(b[k][1]-a[k][1])*f];
    for(let i=0;i+1<st.length;i++){const a=st[i],b=st[i+1];
      for(const f of [0,.25,.5,.75,1]){const q=Lq(a,b,'Q',f),w=Lq(a,b,'W',f),y=a.walk+(b.walk-a.walk)*f,len=Math.hypot(w[0]-q[0],w[1]-q[1]);if(len<1e-6)continue;
        let t=1;for(let d=.1;d<=len+1e-6;d+=.1)if(height(q[0]+(w[0]-q[0])*d/len,q[1]+(w[1]-q[1])*d/len)>y+.02){t=(d-.1)/len;break;}
        if(f<=.5)lim[i]=Math.min(lim[i],t);if(f>=.5)lim[i+1]=Math.min(lim[i+1],t);}}
    for(let i=0;i+1<st.length;i++)if(Math.hypot(st[i].x-st[i+1].x,st[i].z-st[i+1].z)<1e-6)lim[i]=lim[i+1]=Math.min(lim[i],lim[i+1]);
    st.forEach((s,i)=>{const q=s.Q,w=s.W,len=Math.hypot(w[0]-q[0],w[1]-q[1]);if(len<1e-6)return;
      const t=Math.max(lim[i],Math.min(1,.4/len));if(t<1)s.W=[q[0]+(w[0]-q[0])*t,q[1]+(w[1]-q[1])*t];
      let hi=-Infinity;for(let d=0;d<=1.0001;d+=.25)hi=Math.max(hi,height(q[0]+(s.W[0]-q[0])*d,q[1]+(s.W[1]-q[1])*d));
      if(hi>s.walk+.02){s.walk=hi+.03;s.raised=true;}
      s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);});
    for(let i=0;i+1<st.length;i++)if(Math.hypot(st[i].x-st[i+1].x,st[i].z-st[i+1].z)<1e-6){const m=Math.max(st[i].walk,st[i+1].walk);st[i].walk=st[i+1].walk=m;}}
}

// Drawn intervals (both stations ≥1.2 m, walk steps ≤3 m): walk replacement tops, wall body, full-height parapet, ends.
// bodyTop(a,b): optional body-prism top (default 0.35 m under the interval's lower walk; corner-aware areas pass their own).
// bodySupport:false makes the body under the walk a solid obstacle only (La Perla a rider who dropped off a
// notched inner edge landed on the supporting body 0.8 m under the rising walk and rode 47 m beneath it). The walk's
// replacement tops stay the only support on the wall. bodySupport may also be a function (a,b) → boolean per interval
// (Norzagaray, 2026-11-17: only bodies exposed above the inner ground lose support).
const bodyPrism=(prism,support)=>support===false?(ring,lo,hi,sup,...tag)=>prism(ring,lo,hi,false,...tag):prism;
export function wallIntervals(runs,{prism,tops,PARAPET,FLOOR_BAND,source,bodyTop,bodySupport}){
  const walls=[],ends=[],body=bodyTop??((a,b)=>Math.min(a.walk,b.walk)-.35),bodyFor=typeof bodySupport==='function'
    ?(a,b)=>bodyPrism(prism,bodySupport(a,b)):(()=>{const p=bodyPrism(prism,bodySupport);return ()=>p;})();
  for(const run of runs){const list=run.segs.flatMap(g=>g.stations.slice(0,-1).map((a,i)=>({a,b:g.stations[i+1]})));
    // Drawn only where both stations stand ≥1.2 m and the walk steps ≤3 m (El Morro / San Cristóbal rule).
    const drawn=list.map(({a,b})=>Math.min(a.walk-a.base,b.walk-b.base)>=1.2&&Math.abs(a.walk-b.walk)<=3);
    list.forEach(({a,b},i)=>{if(!drawn[i])return;
      const walk=Math.max(a.walk,b.walk);walls.push({a,b,walk,run:run.name});
      // The rideable walk is exactly the drawn grass quad (same two-triangle split as surfaceBuffer.quad): replacement
      // tops (a flat prism at the interval's higher end stood up to 0.7 m over the drawn slope and blocked all
      // eight along-walk rides). The body stays just below them; the battered face is stepped (shared wallBody).
      {const Qa=[a.Q[0],a.walk,a.Q[1]],Qb=[b.Q[0],b.walk,b.Q[1]],Wb=[b.W[0],b.walk,b.W[1]],Wa=[a.W[0],a.walk,a.W[1]];
        for(const tri of [[Qa,Qb,Wb],[Qa,Wb,Wa]]){const area=Math.abs((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0]));
          if(area<1e-4)continue;const y=Math.max(tri[0][1],tri[1][1],tri[2][1]);
          tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:y,plane:plane(tri),replacesTerrain:true,maxReferenceY:y+FLOOR_BAND,surface:'grass',source});}}
      // Body top 0.35 m under the lower end: at corners a neighbour's body must not stand over a sloped walk triangle.
      wallBody(bodyFor(a,b),a,b,Math.min(a.bottom,b.bottom)-.2,body(a,b));
      // Full-height parapet collider (gate rule): no bar for the wheel to pass beneath.
      prism([a.T,b.T,b.Q,a.Q],Math.min(a.crest,b.crest)-1.5,walk+PARAPET.riseIn);
      if(!drawn[i-1])ends.push({s:a,dir:-1});if(!drawn[i+1])ends.push({s:b,dir:1});});
    run.drawn=drawn.filter(Boolean).length;run.open=drawn.length-run.drawn;}

  return {walls,ends};}

// Exact corner mitre (La Perla west, 2026-11-16). The fitter's per-key crossing search can leave a corner section out of
// order (three inversions on the west wall: a parapet reversing, a face folding). Here every section key of the two corner
// copies becomes the intersection of that key's offset lines on either side, anchored at each side's nearest station not
// collapsed onto the corner, so the projection on each copy's own normal is that side's offset and the order holds on
// both. Stations whose key lies past the mitre point along their own segment collapse onto it. clampA:false leaves side A
// untouched (A may be another area's station, e.g. Norzagaray's last section at v14).
const same=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6;
export const SECTION_KEYS=['F','B','L','LB','T','C','Q','W'];
export function mitre(A,B,ua,ub,{clampA=true,keys=SECTION_KEYS}={}){
  const along=(p,u)=>p[0]*u[0]+p[1]*u[1],same=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6,out={};
  for(const k of keys){
    let i=A.length-2;while(i>0&&same(A[i][k],A[i+1][k]))i--;const pa=(i>=0?A[i]:A.at(-1))[k];
    let j=Math.min(1,B.length-1);while(j<B.length-1&&same(B[j][k],B[j-1][k]))j++;const pb=B[j][k];
    // Nearly collinear sides (a 0.3° turn at La Perla v6) meet far away: use the midpoint, as the fitter does.
    const den=ua[0]*ub[1]-ua[1]*ub[0],mid=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2];let x=mid;
    if(Math.abs(den)>=.05){const t=((pb[0]-pa[0])*ub[1]-(pb[1]-pa[1])*ub[0])/den;x=[pa[0]+ua[0]*t,pa[1]+ua[1]*t];}
    out[k]=x;
    if(clampA){for(const s of A)if(along(s[k],ua)>along(x,ua))s[k]=[...x];A.at(-1)[k]=[...x];}
    for(const s of B)if(along(s[k],ub)<along(x,ub))s[k]=[...x];B[0][k]=[...x];
  }
  return out;}
// Section order outward along a station's own normal: B ≥ T ≥ Q ≥ W (the battered face never folds, the parapet never
// reverses, the walk lies inside the parapet).
export function sectionOrdered(s,eps=1e-6){const f=p=>(p[0]-s.x)*s.nx+(p[1]-s.z)*s.nz;
  return f(s.B)>=f(s.T)-eps&&f(s.T)>=f(s.Q)-eps&&f(s.Q)>=f(s.W)-eps;}
// Re-mitre every corner of a fitted run whose corner copies are out of order.
export function repairCorners(run,height){let fixed=0;
  for(let k=1;k<run.segs.length;k++){const A=run.segs[k-1].stations,B=run.segs[k].stations;
    if(sectionOrdered(A.at(-1))&&sectionOrdered(B[0]))continue;
    mitre(A,B,[run.segs[k-1].ux,run.segs[k-1].uz],[run.segs[k].ux,run.segs[k].uz]);fixed++;
    // The mitred inner walk edge can reach into the bank: pull both copies' W back along Q→W to where the kept DEM
    // meets the walk (never closer than 0.4 m behind Q), as the walk/bank agreement does for ordinary stations.
    {const a=A.at(-1),b=B[0],q=a.Q,wv=a.W,len=Math.hypot(wv[0]-q[0],wv[1]-q[1]);
      if(len>.4){let t=1;for(let d=.1;d<=len+1e-6;d+=.1)if(height(q[0]+(wv[0]-q[0])*d/len,q[1]+(wv[1]-q[1])*d/len)>a.walk+.02){t=(d-.1)/len;break;}
        t=Math.max(t,.4/len);if(t<1){a.W=[q[0]+(wv[0]-q[0])*t,q[1]+(wv[1]-q[1])*t];b.W=[...a.W];}}}
    for(const s of [...A.slice(-6),...B.slice(0,6)])s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);}
  return fixed;}

// Fill narrow walk dips: a station lower than the highest walks within `reach` m on both sides rises to the lower of them
// (a 2 m DEM smear at a salient tip left one La Perla station 2.1 m low, and the next interval's body stood over it).
// Raising a walk only makes the wall taller there; the walk stays above the kept DEM.
// Repeated until stable (one pass with per-station windows can lift a tip above a neighbour that its own window left low);
// on a monotone slope nothing rises.
export function closeWalkDips(run,height,reach=3){const st=run.stations,changed=new Set();
  for(let pass=0;pass<12;pass++){const base=st.map(s=>s.walk);let any=false;
    st.forEach((s,i)=>{let l=-Infinity,r=-Infinity;
      for(let j=i-1;j>=0&&s.s-st[j].s<=reach;j--)l=Math.max(l,base[j]);
      for(let j=i+1;j<st.length&&st[j].s-s.s<=reach;j++)r=Math.max(r,base[j]);
      const m=Math.min(l,r);if(m>s.walk+1e-9){s.walk=m;s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);changed.add(s);any=true;}});
    if(!any)break;}
  return changed.size;}

// Fill notches in the walk's inner edge (La Perla at v10 one station's W sat 0.78 m behind the chord of its
// neighbours, over a 1.3 m drop, right on the walk's centre line; at salient tips the collapsed inner corner forms a V).
// Where a station's W lies on the parapet side of the chord between the nearest stations with a different W, every station
// between them gets its W on that chord (along its own inward normal, else the nearest chord point), at most `maxShift`
// m away, and only where the kept ground along the move stays below the walk (the extension then gets the masonry
// retaining face; it never buries the walk under the DEM) and W stays ≥0.3 m inward of Q.
// Repeated until stable, so a notch spanning several stations fills from its rims. Corner copies end on one shared W.
// blocked(p): optional plan test (e.g. a city building footprint) that a moved W must stay out of.
export function fillWalkNotches(run,height,{maxShift=3,minDepth=.1,blocked=null}={}){const st=run.stations;let filled=0;
  const side=(A,B,p)=>(B[0]-A[0])*(p[1]-A[1])-(B[1]-A[1])*(p[0]-A[0]),area=t=>((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]))/2;
  // A move must not fold a walk quad: both triangles of every quad keep the run's plan orientation (|area| > 0.02 m²).
  // Corner copies (same station point) are not drawn intervals and are skipped.
  const copy=i=>Math.hypot(st[i].x-st[i+1].x,st[i].z-st[i+1].z)<1e-6;
  let pos=0,neg=0;for(let i=0;i+1<st.length;i++){if(copy(i))continue;const t=area([st[i].Q,st[i+1].Q,st[i+1].W]);if(t>.02)pos++;else if(t<-.02)neg++;}
  const sgn=pos>=neg?1:-1,folds=(lo,hi)=>{for(let i=Math.max(0,lo);i<Math.min(st.length-1,hi);i++){if(copy(i))continue;const a=st[i],b=st[i+1];
    for(const t of [area([a.Q,b.Q,b.W]),area([a.Q,b.W,a.W])])if(t*sgn<-.02)return true;}return false;};
  for(let pass=0;pass<24;pass++){let any=false;
  for(let i=1;i+1<st.length;i++){const s=st[i];
    let j=i-1;while(j>=0&&same(st[j].W,s.W))j--;let k=i+1;while(k<st.length&&same(st[k].W,s.W))k++;if(j<0||k>=st.length)continue;
    const A=st[j].W,B=st[k].W,L=Math.hypot(B[0]-A[0],B[1]-A[1]);if(L<.05)continue;
    const dW=side(A,B,s.W)/L,dQ=side(A,B,s.Q)/L;if(!(Math.sign(dW)===Math.sign(dQ)&&Math.abs(dW)>minDepth&&Math.abs(dQ)>Math.abs(dW)))continue;
    const moves=[];let ok=true;
    for(let m=j+1;m<k&&ok;m++){const q=st[m],u=[-q.nx,-q.nz],e=[B[0]-A[0],B[1]-A[1]],den=u[0]*e[1]-u[1]*e[0];let nw=null;
      if(Math.abs(den)>1e-9){const t=((A[0]-q.Q[0])*e[1]-(A[1]-q.Q[1])*e[0])/den,f=((A[0]-q.Q[0])*u[1]-(A[1]-q.Q[1])*u[0])/den;
        if(t>.3&&f>=-.05&&f<=1.05)nw=[q.Q[0]+u[0]*t,q.Q[1]+u[1]*t];}
      if(!nw){const f=Math.max(0,Math.min(1,((q.Q[0]-A[0])*e[0]+(q.Q[1]-A[1])*e[1])/(L*L)));nw=[A[0]+e[0]*f,A[1]+e[1]*f];}
      // Only ever outward from the parapet: never closer to Q along the inward normal than the old W, and ≥0.3 m from Q.
      const inw=p=>(p[0]-q.Q[0])*u[0]+(p[1]-q.Q[1])*u[1];if(inw(nw)<Math.max(.3,inw(q.W)-1e-6))ok=false;
      const D=Math.hypot(nw[0]-q.W[0],nw[1]-q.W[1]);if(D>maxShift)ok=false;
      for(let d=.1;d<D&&ok;d+=.1)if(height(q.W[0]+(nw[0]-q.W[0])*d/D,q.W[1]+(nw[1]-q.W[1])*d/D)>q.walk-.05)ok=false;
      if(ok&&height(...nw)>q.walk-.05)ok=false;
      if(ok&&blocked){for(let d=0;d<=1.0001&&ok;d+=.25)if(blocked([q.Q[0]+(nw[0]-q.Q[0])*d,q.Q[1]+(nw[1]-q.Q[1])*d]))ok=false;}
      moves.push([q,nw,D]);}
    if(!ok)continue;
    if(moves.every(([,,D])=>D<1e-4))continue;
    {const old=moves.map(([q])=>q.W);moves.forEach(([q,nw])=>{q.W=nw;});const f=folds(j-1,k+1);moves.forEach(([q],m)=>{q.W=old[m];});if(f)continue;}
    for(const [q,nw,D] of moves){q.W=nw;q.kerb=Math.min(q.walk-.45,height(...nw)-.1);(run.notchShifts??=[]).push(+D.toFixed(3));}
    filled++;any=true;i=k-1;}
  // Corner copies (same station point, consecutive) share the W that lies further inward on both normals.
  for(let i=0;i+1<st.length;i++){const a=st[i],b=st[i+1];if(Math.hypot(a.x-b.x,a.z-b.z)>1e-6||same(a.W,b.W))continue;
    const inw=(s,p)=>-((p[0]-s.Q[0])*s.nx+(p[1]-s.Q[1])*s.nz),pick=Math.min(inw(a,a.W),inw(b,a.W))>=Math.min(inw(a,b.W),inw(b,b.W))?a.W:b.W;
    const other=pick===a.W?b:a,keep=other.W;other.W=[...pick];
    if(folds(i-1,i+2)){other.W=keep;const alt=pick===a.W?b.W:a.W;a.W=[...alt];b.W=[...alt];if(folds(i-1,i+2))continue;}
    for(const s of [a,b])s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);any=true;}
  if(!any)break;}
  return filled;}
// Consecutive stations that share a Q or W point (collapsed corner stations) share one walk height, their maximum: two walk
// triangles meeting at one plan point at different heights are a step (La Perla 0.41 m at v5, 0.47 m at v10,
// 0.53 m at v12 stopped native riders). `pinned` stations keep their walk (e.g. a join to another area's section).
export function unifyCollapsedWalks(run,height,pinned=new Set()){const st=run.stations;let raised=0;
  for(let i=0;i<st.length;){let k=i;while(k+1<st.length&&(same(st[k].Q,st[k+1].Q)||same(st[k].W,st[k+1].W)))k++;
    if(k>i){const group=st.slice(i,k+1),pin=group.find(s=>pinned.has(s)),m=pin?pin.walk:Math.max(...group.map(s=>s.walk));
      for(const s of group)if(Math.abs(s.walk-m)>1e-9){s.walk=m;s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);raised++;}}
    i=k+1;}
  return raised;}

// One drawn interval (a,b) outside any run (e.g. an elbow joining another area's end section).
export function wallInterval(a,b,{prism,tops,PARAPET,FLOOR_BAND,source,run,bodySupport}){
  const walk=Math.max(a.walk,b.walk);
  const Qa=[a.Q[0],a.walk,a.Q[1]],Qb=[b.Q[0],b.walk,b.Q[1]],Wb=[b.W[0],b.walk,b.W[1]],Wa=[a.W[0],a.walk,a.W[1]];
  for(const tri of [[Qa,Qb,Wb],[Qa,Wb,Wa]]){const area=Math.abs((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0]));
    if(area<1e-4)continue;const y=Math.max(tri[0][1],tri[1][1],tri[2][1]);
    tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:y,plane:plane(tri),replacesTerrain:true,maxReferenceY:y+FLOOR_BAND,surface:'grass',source});}
  wallBody(bodyPrism(prism,bodySupport),a,b,Math.min(a.bottom,b.bottom)-.2,Math.min(a.walk,b.walk)-.35);
  prism([a.T,b.T,b.Q,a.Q],Math.min(a.crest,b.crest)-1.5,walk+PARAPET.riseIn);
  return {a,b,walk,run};}
