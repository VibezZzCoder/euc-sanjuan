/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Stair flights published by the layouts (`flight` frames for the shared stair module) and a native
// straight-line driver over them. Test-only.
const controller=(w,start,headingY=start.headingY)=>new EucController(w.sampler,{spawn:{position:{x:start.x,y:start.y,z:start.z},headingY}});
const {EucController,createPose,slopeAccelFor}=await import('../js/euc/simulation/EucController.js');
const {NEUTRAL_ACTIONS:N}=await import('../js/euc/input/actions.js');
export const flightsOf=w=>[w.cristobal?.plaza?.flight,w.norzagaray?.quinto?.flight,w.norzagaray?.animas?.flight,w.corridor?.cathedral?.flight].filter(Boolean);
// Point at (s along the uphill axis from the foot line, t ∈ [0,1] across the foot line).
export function at(f,s,t=.5){const [a,b]=f.foot.line;return [a[0]+(b[0]-a[0])*t+f.axis[0]*s,a[1]+(b[1]-a[1])*t+f.axis[1]*s];}
export const length=f=>f.treads.at(-1).s1;
// Straight ride from `from` to `to` (points), target speed, from a checked placement. Returns outcome, airborne transitions.
export function rideLine(w,from,to,speed,via=[]){
  const pts=[...via,to];let j=0;const first=pts[0],headingY=Math.atan2(first[0]-from[0],first[1]-from[1]);
  const start=w.sampler.findPlacementTarget({x:from[0],z:from[1],headingY,referenceY:w.height(...from)+3});
  if(!start)return {ok:false,reason:'placement'};
  const c=controller(w,start,headingY),p=createPose(),serial=c.placementSerial,L=Math.hypot(to[0]-from[0],to[1]-from[1]);
  let air=0,was=false,best=Infinity,stall=0,maxSpeed=0;
  for(let k=0;k<120*40;k++){c.writePose(p);
    if(c.crashed)return {ok:false,reason:'crash',air,s:+((p.x-from[0])*(to[0]-from[0])/L+(p.z-from[1])*(to[1]-from[1])/L).toFixed(2)};
    if(c.placementSerial!==serial)return {ok:false,reason:'placement-moved',air};
    if(c.airborne&&!was)air++;was=!!c.airborne;maxSpeed=Math.max(maxSpeed,Math.abs(p.speed));
    if(j<pts.length-1&&Math.hypot(pts[j][0]-p.x,pts[j][1]-p.z)<1){j++;best=Infinity;}
    const q=pts[j],d=Math.hypot(q[0]-p.x,q[1]-p.z);if(j===pts.length-1&&d<.6)return {ok:true,air,maxSpeed:+maxSpeed.toFixed(2),seconds:+(k/120).toFixed(1)};
    if(d<best-.05){best=d;stall=0;}else if(++stall>120*6)return {ok:false,reason:'stall',air,left:+d.toFixed(2)};
    const ang=Math.atan2(q[0]-p.x,q[1]-p.z),err=Math.atan2(Math.sin(ang-p.headingY),Math.cos(ang-p.headingY));
    const g=c.ground.normal,grade=-slopeAccelFor(g,Math.sin(p.headingY),Math.cos(p.headingY),c.tuning.gravity);
    const lean=Math.asin(Math.max(-1,Math.min(1,(grade+(speed-p.speed)*2.5)/c.tuning.leanToAccel)))/c.tuning.maxLeanPitch;
    c.step(1/120,{...N,throttle:Math.max(-.8,Math.min(1,lean)),steer:Math.max(-1,Math.min(1,-err*1.9))});}
  return {ok:false,reason:'timeout',air};
}

// ---- Part two (shared module, js/sj-stairs.js) ----
const {stairRigOffset,stairTyreClearance}=await import('../js/sj-stairs.js');
export const recLocal=(r,x,z)=>{const dx=x-r.ox,dz=z-r.oz;return [dx*r.cx+dz*r.cz,dx*r.ex+dz*r.ez];};
export const recAt=(r,u,s)=>[r.ox+r.cx*u+r.ex*s,r.oz+r.cz*u+r.ez*s];
// Native ride along a polyline of flight-local points [[u,s],…] (the first is the checked placement), holding `speed`
// (grade, rolling resistance and drag compensated), steering onto
// each segment by pure pursuit. A third value on a point caps the speed there (approached at ≤ 2.5 m/s² braking): the stock wheel cannot
// take a tight turn at 7 m/s. Per fixed step: crash/water/placement events, airborne transitions, curb step-ups above 4 cm, progress,
// and the rendered wheel (physics pose + the presentation hook) against the drawn treads, nosings and end surfaces.
export function ridePath(w,r,path,speed,{refY=null,trace=null}={}){
  const caps=path.map(q=>q[2]??Infinity),P=path.map(([u,s])=>recAt(r,u,s)),hd0=Math.atan2(P[1][0]-P[0][0],P[1][1]-P[0][1]);
  const g0={};w.sampler.sampleGround(P[0][0],P[0][1],g0,(refY??Math.max(w.height(...P[0]),path[0][1]>r.run?r.yt:-Infinity))+.3);
  const st=w.sampler.findPlacementTarget({x:P[0][0],z:P[0][1],headingY:hd0,referenceY:refY??g0.height??w.height(...P[0])});if(!st)return {pass:false,reason:'start'};
  const c=controller(w,st,hd0),p=createPose(),serial=c.placementSerial,view={off:0};
  let floatFrames=0,gapAt=null,air=0,was=false,curbs=0,curbAt=null,minClr=Infinity,maxGap=0,maxSp=0,onFlight=0,j=1,best=Infinity,stall=0,clrAt=null;
  let total=0;for(let i=1;i<P.length;i++)total+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
  const limit=120*(20+total/Math.max(.6,speed*.5));
  for(let k=0;k<limit;k++){c.writePose(p);
    if(c.crashed||c.placementSerial!==serial||w.sampler.isWater(p.x,p.z,p.y))return {pass:false,reason:c.crashed?'crash':'water/placement',at:recLocal(r,p.x,p.z).map(v=>+v.toFixed(2)),air,minClr};
    const A=P[j-1],B=P[j],dx=B[0]-A[0],dz=B[1]-A[1],len=Math.hypot(dx,dz),tx=dx/len,tz=dz/len,along=(p.x-A[0])*tx+(p.z-A[1])*tz,cross=(p.x-A[0])*tz-(p.z-A[1])*tx;
    if(along>=len-(j<P.length-1?Math.min(.8,len*.5):0)){if(j===P.length-1)return {pass:true,air,curbs,curbAt,minClr,clrAt,maxGap,gapAt,floatFrames,maxSp,onFlight,seconds:k/120};j++;best=Infinity;stall=0;continue;}
    if(c.airborne&&!was)air++;was=c.airborne;
    const [pu,ps]=recLocal(r,p.x,p.z);if(trace&&k%15===0)trace.push([+(k/120).toFixed(2),+pu.toFixed(2),+ps.toFixed(2),+p.y.toFixed(2),+p.speed.toFixed(2),j]);
    if(c.lastStepUp>.04){curbs++;curbAt=[+pu.toFixed(2),+ps.toFixed(2),+c.lastStepUp.toFixed(3)];}maxSp=Math.max(maxSp,Math.abs(p.speed));
    const off=stairRigOffset(p,1/120,view);
    if(ps>=r.footS&&ps<=r.topS&&pu>=r.u0&&pu<=r.u1&&!c.airborne){onFlight++;const q={...p,y:p.y+off},cl=stairTyreClearance(r,q);if(cl<minClr){minClr=cl;clrAt=[+pu.toFixed(2),+ps.toFixed(2)];}if(cl>.03)floatFrames++;if(cl>maxGap){maxGap=cl;gapAt=[+pu.toFixed(2),+ps.toFixed(2)];}}
    const rem=len-along;if(rem<best-.1){best=rem;stall=0;}else if(++stall>120*6)return {pass:false,reason:'stuck',at:[+pu.toFixed(2),+ps.toFixed(2)],air};
    let v=speed;for(let i=j,d=rem;i<P.length;i++){if(i>j)d+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);v=Math.min(v,Math.sqrt(caps[i]**2+5*d));}
    if(j>0)v=Math.min(v,caps[j-1]<Infinity&&along<1?caps[j-1]:v);
    const grade=-slopeAccelFor(c.ground.normal,Math.sin(p.headingY),Math.cos(p.headingY),c.tuning.gravity),rr=c.surfaceResponse().rollingResistance*c.tuning.rollingResistanceScale;
    const lean=Math.asin(Math.max(-1,Math.min(1,(grade+rr+c.tuning.dragCoefficient*v**2+(v-p.speed)*2.5)/c.tuning.leanToAccel)))/c.tuning.maxLeanPitch;
    // Pure pursuit: aim at the point 1 m ahead of the projection on the current segment (holds the line after a turn-in).
    const la=Math.min(len,Math.max(0,along)+1),hd=Math.atan2(A[0]+tx*la-p.x,A[1]+tz*la-p.z),he=Math.atan2(Math.sin(hd-p.headingY),Math.cos(hd-p.headingY));void cross;
    c.step(1/120,{...N,throttle:Math.max(-.8,Math.min(1,lean)),steer:Math.max(-1,Math.min(1,-he*1.9))});}
  return {pass:false,reason:'timeout',air};}
