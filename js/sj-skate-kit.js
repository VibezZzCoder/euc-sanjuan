/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Skatepark geometry kit — © 2026 VibezZzCoder, MIT. Construction only: no renderer, scene or update loop.
// Adapted from the author's own editions (MIT): the SF edition's js/sf-skatepark-geometry.js (site frame rounded once to
// Float32, exact support from the drawn triangles, contour-partitioned inscribed bodies, wheel-sweep rail bars) and the
// original game's src/level/skateparkLevel.ts (eased-foot wall profile, eased ramps, soft minimum). See
// provenance/skate-import.json.
//
// Frame: world = [x + u·cosθ + s·sinθ, y + du·u + ds·s + h, z − u·sinθ + s·cosθ]; (u, s) are site-local metres, h the
// height above the site's floor plane. Every vertex is rounded to Float32 once and both the drawing and the support facets
// are made from those same numbers: the drawn surface is the ridden surface.
//
// Pieces (the kit accumulates; result() returns everything):
//   field({id, us, ss, h | worldY, paint, skip, skirts, level, flagLevel, slopeFlag})
//       a height field over the tensor grid us × ss (strictly increasing and non-uniform: put dense samples where the
//       surface bends; a value repeated twice makes a vertical face). h(u,s) ≥ 0 above the floor, or worldY(u,s,x,z) for an
//       absolute height (access aprons meeting the street). Cells split on the (i,j)–(i+1,j+1) diagonal; every triangle
//       with an upward area is one support facet, capabilities {transition:true} when steeper than `slopeFlag` degrees
//       against the floor (default 2), otherwise rest-only. skirts: [{edge:'u0'|'u1'|'s0'|'s1', lo, hi}] vertical sides down
//       to the floor (only over lo ≤ coordinate ≤ hi along the edge), with inscribed bodies under that edge row of cells.
//       level: [{u0,u1,s0,s1,y}] boxes whose vertices take the exact world height y (a truly level top); flagLevel flags
//       those (the original game's kicker lip, the one flat flagged surface). skip(i,j) leaves a cell to another piece.
//       paint(u,s,h,slopeDeg,i,j) → '#rrggbb' per triangle (crisp colour blocks along grid lines); vertexPaint(u,s,h,gradDeg)
//       per vertex (soft edges on curved faces); diagonal(i,j,u,s) true splits that cell on the other diagonal (follow a hip
//       or a curved lip). topExtra: fields copied onto every support facet (e.g. replacesTerrain for an access apron).
//   block({id, u0,u1,s0,s1, height, paint, side}) a solid from the floor (pad, ledge, tread): top = support, sides drawn,
//       the body under it partitioned into inscribed prisms.
//   rail({id, points:[[u,s,top]…], width, thickness, posts}) a thin steel bar (wheel-sweep body) on ordinary posts.
//   prism({u0,u1,s0,s1, bottom, top | bottomLocal, topLocal, paint, collide, occludes, faces}) an oriented box (walls,
//       planters, masts): drawn, and optionally one native yawed box collider.
//   tube({points:[[u,s,h]…], radius, sides, colour}) render-only round bar (coping, railings) in the metal batch.
const UP_EPS=1e-12;

export function skateFrame({x,z,theta,y,du=0,ds=0}){
  const cs=Math.cos(theta),sn=Math.sin(theta);
  return {x,z,theta,y,du,ds,cs,sn,
    at:(u,s,h)=>[Math.fround(x+u*cs+s*sn),Math.fround(y+du*u+ds*s+h),Math.fround(z-u*sn+s*cs)],
    world:(u,s)=>({x:x+u*cs+s*sn,z:z-u*sn+s*cs}),
    local:(px,pz)=>{const dx=px-x,dz=pz-z;return [dx*cs-dz*sn,dx*sn+dz*cs];},
    floorY:(u,s)=>y+du*u+ds*s,
    heading:(du_,ds_)=>theta+Math.atan2(du_,ds_),   // game heading of a local direction
    // world normal of a local height gradient (∂h/∂u, ∂h/∂s) on the tilted floor
    normal:(gu,gs)=>{const nu=-du-gu,ns=-ds-gs,k=1/Math.hypot(nu,1,ns);return [(nu*cs+ns*sn)*k,k,(-nu*sn+ns*cs)*k];}};
}

// ---- Profiles (adapted from the original game's skateparkLevel.ts: wallProfile, easedRamp, smin) ----
/** Eased-foot transition: curvature ramps from 0 to 1/radius over `ease` metres of arc, then holds to `capDeg`; scaled to
 * `height`. rise(q) for horizontal distance q from the toe; run = horizontal length; chords(n) = horizontal positions of n
 * equal turning-angle steps (dense where it is steep). */
export function wallProfile(radius,capDeg,ease,height){
  const cap=capDeg*Math.PI/180,step=.0005,us=[0],ys=[0],phis=[0];let s=0,phi=0,u=0,y=0;
  while(phi<cap){const k=s<ease?s/ease/radius:1/radius;phi=Math.min(cap,phi+k*step);u+=Math.cos(phi)*step;y+=Math.sin(phi)*step;s+=step;
    us.push(u);ys.push(y);phis.push(phi);}
  const scale=height/y,plan=Float64Array.from(us),rise=Float64Array.from(ys,v=>v*scale),run=u;
  const at=q=>{if(q<=0)return 0;if(q>=run)return height;let lo=0,hi=plan.length-1;
    while(hi-lo>1){const m=(lo+hi)>>1;if(plan[m]<=q)lo=m;else hi=m;}
    return rise[lo]+(rise[hi]-rise[lo])*(q-plan[lo])/(plan[hi]-plan[lo]);};
  const chords=n=>{const out=[0];let k=1;for(let i=1;i<phis.length&&k<n;i++)if(phis[i]>=cap*k/n){out.push(plan[i]);k++;}out.push(run);return out;};
  return {run,height,rise:at,chords};
}
/** 0 → 1 over `length` with quadratic eases of `ease` at both ends and a straight middle (C1). */
export function easedRamp(q,length,ease){
  if(q<=0)return 0;if(q>=length)return 1;const slope=1/(length-ease);
  if(q<ease)return slope*q*q/(2*ease);
  if(q>length-ease){const r=length-q;return 1-slope*r*r/(2*ease);}
  return slope*(q-ease/2);
}
/** Polynomial soft minimum: exact beyond `k` apart, rounded within it. */
export function smin(a,b,k){const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** Rounded-rectangle signed distance (centre cu,cs; half sizes a (u), b (s); corner radius r). */
export function roundedRectDistance(u,s,cu,cs,a,b,r){
  const qx=Math.abs(u-cu)-(a-r),qy=Math.abs(s-cs)-(b-r);
  return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;
}
/** Sample list: breakpoints plus fill no coarser than `step` inside each [lo,hi,step] span; sorted, unique (1e-6 m). */
export function samples(spans,breaks=[]){
  const out=[...breaks];for(const [lo,hi,step] of spans){const n=Math.max(1,Math.ceil((hi-lo)/step-1e-9));for(let k=0;k<=n;k++)out.push(lo+(hi-lo)*k/n);}
  out.sort((a,b)=>a-b);const u=[];for(const v of out)if(!u.length||v-u.at(-1)>1e-6)u.push(v);return u;
}

// ---- Facets and bodies (adapted from the SF edition's sf-skatepark-geometry.js) ----
const cross2=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
const xz=p=>({x:p[0],z:p[2]});
export function faceNormal(a,b,c){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,l=Math.hypot(x,y,z);return l>1e-12?[x/l,y/l,z/l]:null;}
function planeOf(tri){const [a,b,c]=tri,n=faceNormal(a,b,c);if(!n||n[1]<=0)throw new RangeError('Skatepark top must have an upward area');
  return p=>a[1]-(n[0]*(p.x-a[0])+n[2]*(p.z-a[2]))/n[1];}
function bodyPolygonHasArea(poly){return poly.length>=3&&Math.abs(poly.reduce((s,p,i)=>s+cross2(poly[0],p,poly[(i+1)%poly.length]),0))>=1e-12;}
function* heightStripes(poly,height,budget){
  const hs=poly.map(height),lo=Math.min(...hs),hi=Math.max(...hs),count=Math.max(1,Math.ceil((hi-lo)/budget));
  if(!Number.isFinite(count)||count>65536)throw new RangeError('Skatepark body subdivision exceeds 65536 stripes');
  for(let i=1;i<count;i++){const level=lo+(hi-lo)*i/count,below=[],above=[];
    for(let j=0;j<poly.length;j++){const p=poly[j],q=poly[(j+1)%poly.length],dp=height(p)-level,dq=height(q)-level;
      if(dp<=0)below.push(p);if(dp>=0)above.push(p);
      if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq),cut={x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t};below.push(cut);above.push(cut);}}
    if(bodyPolygonHasArea(below))yield below;poly=above;}
  if(bodyPolygonHasArea(poly))yield poly;
}
/** Inscribed vertical prisms under one drawn top triangle down to its base triangle: floor contours ≤ 3 cm, roof contours
 * ≤ 6 cm; every prism stays strictly inside the drawn solid (minY above the base, maxY below the top). */
function inscribedBodies(top,base,out,options){
  const roof=planeOf(top),floor=planeOf(base),boundary=top.map(xz);
  for(const strip of heightStripes(boundary,floor,.03-3e-7))for(const outer of heightStripes(strip,roof,.06-3e-7)){
    const minY=Math.max(...outer.map(floor))+1e-7,maxY=Math.min(...outer.map(roof))-1e-7;
    if(maxY>minY+1e-6)out.push({outer,minY,maxY,...options});}
}

const CAPS=new Map();
/** One shared frozen capability object per (feature, policy). */
export function capability(feature,transition){const k=feature+'|'+transition;let c=CAPS.get(k);
  if(!c)CAPS.set(k,c=Object.freeze(transition?{feature,transition:true,restartsAtRest:true}:{feature,restartsAtRest:true}));return c;}

export function createSkateKit(frame,{source='skatepark',feature='skatepark'}={}){
  const F=frame,batches=new Map(),tops=[],colliders=[],counts={topTriangles:0,drawTriangles:0,flagged:0};
  const batch=name=>{let b=batches.get(name);if(!b)batches.set(name,b={p:[],n:[],c:[]});return b;};
  const rgbCache=new Map(),rgb=hex=>{let k=rgbCache.get(hex);if(!k){const v=parseInt(hex.slice(1),16);rgbCache.set(hex,k=[(v>>16&255)/255,(v>>8&255)/255,(v&255)/255]);}return k;};
  // Colours stay sRGB components here; the builder converts them once.
  // colour: one '#rrggbb' for the triangle, or an array of three (per vertex, for soft paint edges on curved faces)
  const emit=(name,a,b,c,colour,na,nb,nc)=>{const f=faceNormal(a,b,c);if(!f)return false;const B=batch(name);
    const [ka,kb,kc]=Array.isArray(colour)?colour.map(rgb):[rgb(colour),rgb(colour),rgb(colour)];
    B.p.push(...a,...b,...c);B.n.push(...(na??f),...(nb??f),...(nc??f));B.c.push(...ka,...kb,...kc);counts.drawTriangles++;return true;};
  const addTop=(tri,cap,src,extra)=>{const [a,b,c]=tri,n=faceNormal(a,b,c);if(!n||n[1]<=UP_EPS)return false;
    tops.push({poly:tri.map(xz),top:Math.max(a[1],b[1],c[1]),plane:{x:a[0],y:a[1],z:a[2],dx:-n[0]/n[1],dz:-n[2]/n[1]},
      surface:'pavement',...extra,source:src,capabilities:cap});counts.topTriangles++;if(cap.transition)counts.flagged++;return true;};
  const upward=(a,b,c)=>{const f=faceNormal(a,b,c);return f&&f[1]<0?[a,c,b]:[a,b,c];};
  const floorN=F.normal(0,0);
  const slopeDeg=tri=>{const n=faceNormal(...tri);if(!n)return 90;
    return Math.acos(Math.max(-1,Math.min(1,Math.abs(n[0]*floorN[0]+n[1]*floorN[1]+n[2]*floorN[2]))))*180/Math.PI;};
  // Outward vertical sides of a quad solid (top ring T over base ring B, same order).
  const sides=(T,B,material,colour,skip=[])=>{const cx=T.reduce((a,p)=>a+p[0],0)/T.length,cz=T.reduce((a,p)=>a+p[2],0)/T.length;
    for(let k=0;k<T.length;k++){if(skip.includes(k))continue;const a=T[k],b=T[(k+1)%T.length],a0=B[k],b0=B[(k+1)%T.length],f=faceNormal(a,a0,b0)??faceNormal(a,b0,b);
      if(!f)continue;const out=f[0]*((a[0]+b[0])/2-cx)+f[2]*((a[2]+b[2])/2-cz)>0,q=out?[a,a0,b0,b]:[a,b,b0,a0];
      const c=typeof colour==='function'?colour(k):colour;emit(material,q[0],q[1],q[2],c);emit(material,q[0],q[2],q[3],c);}};

  function field({id,us,ss,h,worldY=null,topExtra=null,paint=()=>'#a9a397',vertexPaint=null,diagonal=null,skip=null,skirts=[],level=[],flagLevel=false,slopeFlag=2,material='concrete',sideColour='#6f6a60',smoothNormals=true}){
    const src=source+':'+id,nu=us.length,ns=ss.length,H=new Float64Array(nu*ns),G=new Float64Array(nu*ns),P=new Array(nu*ns),N=new Array(nu*ns);
    const inLevel=(u,s)=>level.find(b=>u>=b.u0-1e-9&&u<=b.u1+1e-9&&s>=b.s0-1e-9&&s<=b.s1+1e-9);
    const hOf=(u,s,strict=true)=>{if(worldY){const w=F.world(u,s);return worldY(u,s,w.x,w.z)-F.floorY(u,s);}const v=h(u,s);
      if(strict&&(!Number.isFinite(v)||v<-1e-9))throw new RangeError(`Skatepark field ${id}: h(${u},${s})=${v}`);return Math.max(0,v);};
    for(let i=0;i<nu;i++)for(let j=0;j<ns;j++){const u=us[i],s=ss[j],v=hOf(u,s),L=inLevel(u,s);H[i*ns+j]=v;
      const p=F.at(u,s,v);if(worldY)p[1]=Math.fround(worldY(u,s,p[0],p[2]));if(L)p[1]=Math.fround(L.y);P[i*ns+j]=p;
      if(smoothNormals||vertexPaint){const e=.02,gu=(hOf(u+e,s,false)-hOf(u-e,s,false))/(2*e),gs=(hOf(u,s+e,false)-hOf(u,s-e,false))/(2*e);
        N[i*ns+j]=L?[0,1,0]:F.normal(gu,gs);G[i*ns+j]=Math.atan(Math.hypot(gu,gs))*180/Math.PI;}}
    const rest=capability(feature+':'+id,false),slope=capability(feature+':'+id,true);
    const bodyCells=new Set(),inRange=(v,sk)=>v>=(sk.lo??-Infinity)-1e-9&&v<=(sk.hi??Infinity)+1e-9;
    for(const sk of skirts){
      if(sk.edge==='u0'||sk.edge==='u1'){const i=sk.edge==='u0'?0:nu-2;for(let j=0;j+1<ns;j++)if(inRange((ss[j]+ss[j+1])/2,sk))bodyCells.add(i*ns+j);}
      else{const j=sk.edge==='s0'?0:ns-2;for(let i=0;i+1<nu;i++)if(inRange((us[i]+us[i+1])/2,sk))bodyCells.add(i*ns+j);}}
    for(let i=0;i+1<nu;i++)for(let j=0;j+1<ns;j++){if(skip?.(i,j))continue;
      const k00=i*ns+j,k10=(i+1)*ns+j,k01=i*ns+j+1,k11=(i+1)*ns+j+1;
      // diagonal(i,j) true: split on (i+1,j)–(i,j+1) instead (follow a hip or a curved lip through the cell)
      const anti=diagonal?.(i,j,(us[i]+us[i+1])/2,(ss[j]+ss[j+1])/2);
      for(const ids of anti?[[k00,k10,k01],[k10,k11,k01]]:[[k00,k10,k11],[k00,k11,k01]]){
        let tri=ids.map(k=>P[k]),ord=ids;const f=faceNormal(...tri);if(f&&f[1]<0){tri=[tri[0],tri[2],tri[1]];ord=[ids[0],ids[2],ids[1]];}
        const uc=ids.reduce((a,k)=>a+us[Math.floor(k/ns)],0)/3,sc=ids.reduce((a,k)=>a+ss[k%ns],0)/3,hc=ids.reduce((a,k)=>a+H[k],0)/3,sd=slopeDeg(tri);
        const lv=inLevel(uc,sc),cap=lv?(flagLevel?slope:rest):sd>slopeFlag?slope:rest;
        // near-vertical faces (a repeated sample) are drawn, never support
        const colour=vertexPaint?ord.map(k=>vertexPaint(us[Math.floor(k/ns)],ss[k%ns],H[k],G[k])):paint(uc,sc,hc,sd,i,j);
        if(emit(material,...tri,colour,...(smoothNormals?ord.map(k=>N[k]):[]))&&sd<80)addTop(tri,cap,src,topExtra);
        // same plan winding as the (upward) drawn triangle, so the base is upward too
        if(bodyCells.has(k00)){const base=ord.map(k=>F.at(us[Math.floor(k/ns)],ss[k%ns],0));
          if(faceNormal(...tri)?.[1]>0&&faceNormal(...base)?.[1]>0&&tri.some((p,q)=>p[1]>base[q][1]+1e-4))inscribedBodies(tri,base,colliders,{surface:'pavement',support:false,source:src+':body'});}}}
    // skirts: vertical faces from the edge down to the floor
    for(const sk of skirts){const list=sk.edge==='u0'?Array.from({length:ns},(_,j)=>j):sk.edge==='u1'?Array.from({length:ns},(_,j)=>(nu-1)*ns+j)
      :sk.edge==='s0'?Array.from({length:nu},(_,i)=>i*ns):Array.from({length:nu},(_,i)=>i*ns+ns-1);
      const along=k=>sk.edge[0]==='u'?ss[k%ns]:us[Math.floor(k/ns)],out=sk.edge==='u1'||sk.edge==='s1'?1:-1;
      for(let k=0;k+1<list.length;k++){const ka=list[k],kb=list[k+1];if(!inRange((along(ka)+along(kb))/2,sk))continue;if(H[ka]<1e-4&&H[kb]<1e-4)continue;
        const a=P[ka],b=P[kb],a0=F.at(us[Math.floor(ka/ns)],ss[ka%ns],0),b0=F.at(us[Math.floor(kb/ns)],ss[kb%ns],0);
        // face away from the field: outward along +u/+s for the far edges
        const n=faceNormal(a,a0,b0)??faceNormal(a,b0,b);if(!n)continue;
        const dirU=sk.edge[0]==='u'?out:0,dirS=sk.edge[0]==='s'?out:0,w=[dirU*F.cs+dirS*F.sn,-dirU*F.sn+dirS*F.cs];
        const q=n[0]*w[0]+n[2]*w[1]>0?[a,a0,b0,b]:[a,b,b0,a0];emit(material,q[0],q[1],q[2],sideColour);emit(material,q[0],q[2],q[3],sideColour);}}
    return {heightAt:(i,j)=>H[i*ns+j],point:(i,j)=>P[i*ns+j]};
  }

  // Flat floor polygons (h = 0) given as (u,s) loops: quads split on their diagonal, longer loops fanned from their centroid
  // so collinear edge vertices shared with a neighbouring field are kept exactly.
  function polygons({id,loops,paint=()=>'#8e918b',material='concrete'}){
    const src=source+':'+id,rest=capability(feature+':'+id,false),up=[0,1,0];
    for(const loop of loops){const pts=loop.map(([u,s])=>F.at(u,s,0)),c=paint(loop);
      const tris=pts.length===4?[[pts[0],pts[1],pts[2]],[pts[0],pts[2],pts[3]]]:(()=>{const cu=loop.reduce((a,p)=>a+p[0],0)/loop.length,cs=loop.reduce((a,p)=>a+p[1],0)/loop.length,o=F.at(cu,cs,0);
        return pts.map((p,k)=>[o,p,pts[(k+1)%pts.length]]);})();
      for(const t0 of tris){const tri=upward(...t0);if(emit(material,...tri,c))addTop(tri,rest,src);}}
  }
  function block({id,u0,u1,s0,s1,height,paint='#b4ab98',side='#6f6a60',material='concrete'}){
    const src=source+':'+id,T=[[u0,s0],[u1,s0],[u1,s1],[u0,s1]].map(([u,s])=>F.at(u,s,height)),B=[[u0,s0],[u1,s0],[u1,s1],[u0,s1]].map(([u,s])=>F.at(u,s,0));
    const rest=capability(feature+':'+id,false);
    for(const ids of [[0,1,2],[0,2,3]]){const tri=upward(...ids.map(k=>T[k])),base=upward(...ids.map(k=>B[k]));emit(material,...tri,paint);addTop(tri,rest,src);
      inscribedBodies(tri,base,colliders,{surface:'pavement',support:false,source:src+':body'});}
    sides(T,B,material,side);return {top:T,base:B};
  }

  // Thin steel bar: native yawed boxes strictly inside the drawn bar, tagged for the wheel sweep only; posts are ordinary.
  function rail({id,points,width=.08,thickness=.08,posts=[],colour='#2c3331'}){
    const src=source+':'+id+':bar',rest=capability(feature+':'+id,false);
    for(let k=0;k+1<points.length;k++){const [u0,s0,t0]=points[k],[u1,s1,t1]=points[k+1],L=Math.hypot(u1-u0,s1-s0),pu=-(s1-s0)/L*width/2,ps=(u1-u0)/L*width/2;
      const c=[[u0+pu,s0+ps,t0],[u1+pu,s1+ps,t1],[u1-pu,s1-ps,t1],[u0-pu,s0-ps,t0]],q=c.map(([u,s,hh])=>F.at(u,s,hh)),b=c.map(([u,s,hh])=>F.at(u,s,hh-thickness));
      for(const ids of [[0,1,2],[0,2,3]]){const tri=upward(...ids.map(i=>q[i]));emit('metal',...tri,colour);addTop(tri,rest,src);}
      sides(q,b,'metal',colour);
      // pieces ≤ 0.8 m so the bar's own grade (and the floor's) stays well inside half its thickness per box
      const n=Math.max(1,Math.ceil(L/.8));
      for(let m=0;m<n;m++){const f0=m/n,f1=(m+1)/n,ua=u0+(u1-u0)*f0,ub=u0+(u1-u0)*f1,sa=s0+(s1-s0)*f0,sb=s0+(s1-s0)*f1,ta=t0+(t1-t0)*f0,tb=t0+(t1-t0)*f1;
        const ends=[F.at(ua,sa,ta),F.at(ub,sb,tb)],top=Math.min(ends[0][1],ends[1][1]),bot=Math.max(ends[0][1],ends[1][1])-thickness;
        if(!(top-bot>1e-3))throw new RangeError('Skatepark bar has no inscribed thickness: '+id);
        const mid=F.world((ua+ub)/2,(sa+sb)/2);
        colliders.push({centre:{x:mid.x,y:(top+bot)/2,z:mid.z},halfExtents:{x:width/2-2e-4,y:(top-bot)/2-1e-6,z:L/n/2-2e-4},rotationY:F.heading(u1-u0,s1-s0),
          surface:'pavement',wheelSweep:true,source:src});}}
    for(const p of posts){const hw=(p.size??width)/2;prism({u0:p.u-hw,u1:p.u+hw,s0:p.s-hw,s1:p.s+hw,bottomLocal:-.03,topLocal:p.height,paint:colour,material:'metal',collide:true,source:source+':'+id+':post'});}
  }

  // Oriented box in the park frame with world bottom/top (or heights above the floor at its centre).
  function prism({u0,u1,s0,s1,bottom,top,bottomLocal,topLocal,paint='#d9cdb4',material='concrete',collide=false,occludes,source:src=source+':prism',faces=null}){
    const cu=(u0+u1)/2,cs=(s0+s1)/2,y0=bottom??F.floorY(cu,cs)+bottomLocal,y1=top??F.floorY(cu,cs)+topLocal;
    const corners=[[u0,s0],[u1,s0],[u1,s1],[u0,s1]].map(([u,s])=>F.world(u,s));
    const P=(c,y)=>[Math.fround(c.x),Math.fround(y),Math.fround(c.z)],T=corners.map(c=>P(c,y1)),B=corners.map(c=>P(c,y0));
    const names=['s0','u1','s1','u0'],col=f=>typeof paint==='function'?paint(f):paint,face=k=>!faces||faces.includes(k);
    if(face('top')){emit(material,...upward(T[0],T[1],T[2]),col('top'));emit(material,...upward(T[0],T[2],T[3]),col('top'));}
    sides(T,B,material,k=>col(names[k]),names.map((n,k)=>face(n)?-1:k));
    if(collide){const c=F.world(cu,cs);colliders.push({centre:{x:c.x,y:(y0+y1)/2,z:c.z},halfExtents:{x:(u1-u0)/2,y:(y1-y0)/2,z:(s1-s0)/2},rotationY:F.theta,
      surface:'pavement',source:src,...(occludes===false?{occludes:false}:{})});}
    return {top:T,base:B};
  }
  // Render-only round bar through local points (coping, railings).
  function tube({points,radius=.03,sides:n=6,colour='#59605c',material='metal',world=false}){
    const W=world?points:points.map(([u,s,hh])=>F.at(u,s,hh));
    for(let k=0;k+1<W.length;k++){const a=W[k],b=W[k+1],d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...d);if(l<1e-6)continue;
      const t=d.map(v=>v/l),ref=Math.abs(t[1])>.9?[1,0,0]:[0,1,0],A=norm(crossV(t,ref)),Bv=crossV(t,A);
      const ring=c=>Array.from({length:n},(_,i)=>{const ang=i*Math.PI*2/n,ca=Math.cos(ang)*radius,sa=Math.sin(ang)*radius;
        return [c[0]+A[0]*ca+Bv[0]*sa,c[1]+A[1]*ca+Bv[1]*sa,c[2]+A[2]*ca+Bv[2]*sa];});
      const ra=ring(a),rb=ring(b);
      for(let i=0;i<n;i++){const j=(i+1)%n,n0=norm(ra[i].map((v,q)=>v-a[q])),n1=norm(ra[j].map((v,q)=>v-a[q]));
        // outward winding
        const f=faceNormal(ra[i],rb[i],rb[j]),o=f&&f[0]*n0[0]+f[1]*n0[1]+f[2]*n0[2]>0;
        if(o){emit(material,ra[i],rb[i],rb[j],colour,n0,n0,n1);emit(material,ra[i],rb[j],ra[j],colour,n0,n1,n1);}
        else{emit(material,ra[i],rb[j],rb[i],colour,n0,n1,n0);emit(material,ra[i],ra[j],rb[j],colour,n0,n1,n1);}}}
  }
  return {field,polygons,block,rail,prism,tube,emit,addTop,upward,
    result:()=>({batches,tops,colliders,counts:{...counts,bodies:colliders.length}})};
}
const crossV=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
