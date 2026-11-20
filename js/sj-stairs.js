/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Rideable public stairs with wheel-conditioned support —
// © 2026 VibezZzCoder, MIT. Shared by districts with fitted
// exterior flights.
// The stock EUC controller (js/euc/simulation/EucController.js, generated; never edited) has a point contact: the support
// height is sampled at the wheel's (x,z); a rise above 0.04 m in one 1/120 s step costs speed (20 m/s per metre), a rise
// above 0.216 m stops the wheel, and a drop under the predicted ground plane above 0.05 m launches it. The rig
// (js/euc/render/ridingRig.js) draws the tyre (radius r = WHEEL.tyreDiameter/2 = 0.25 m, width 0.075 m, rounded edges)
// with its centre r above that contact point and pitches it about the contact point (wheelPitch); it does not pitch with
// the ground (groundTiltPitchFollow 0). So exact treads as support make the wheel stall at every riser on the way up and
// hop off every nose on the way down, and a vertical wheel of radius r standing on a slope θ cuts the slope by
// r·(1 − cos θ) perpendicular.
// Model (chosen by measurement, see the eastcivic doc): drawn treads are real uniform treads; the physical support is a
// smooth lifted nose plane — the line through the nosings raised by L = r·(sec θ − 1) + margin, so a vertical wheel of
// radius r standing on it is tangent to the nose line and never reaches a nosing — joined to the ground before the foot
// by a concave fillet and to the surface beyond the top by a convex fillet. Every fillet is checked against the exact
// rolling envelope S_r (the lowest support a wheel of radius r can have over the drawn profile without cutting it) and
// shrunk until it clears it. The faceted support is published as replacement tops (drawn ≠ physical here by design; the
// gap is the float, bounded and reported).
// API
//   rideableFlight({at, u0, u1, run, yf, yt, n, ground, ...options}) → flight
//     at(u,s) → [x,z]       plan position; s = 0 at the foot riser, s = run at the top tread's back edge; u across.
//     ground(x,z) → y       drawn surface outside the flight (before the foot and beyond the top).
//     yf, yt                foot ground and top surface heights at the flight (uniform risers h = (yt − yf)/n).
//     options: wheel {radius}, margin (default 0.02 m, pitch/lean allowance on the slope), uStep, sStep (0.08 m),
//              footReach / topReach (the support's blend may not reach further than this beyond the foot / top; default:
//              the apron's length when there is one, so the blend lies on the apron's straight line),
//              uBreaks (extra lateral lines, e.g. DEM grid crossings), nosing {out, up, depth} (drawn nosing bar).
//   flight: {h, g, theta, lift, treads:[{k,s0,s1,top}], nosing, lines:[{u, footStart, footEnd, topStart, topEnd}],
//            support(u,s), envelope(u,s), drawnAt(u,s), tops:[[x,y,z]×3 …], footS, topS, worstGap, maxFloat}
//   Callers draw treads/nosings from `treads`/`nosing` and publish `tops` as replacement support facets.
import {WHEEL} from './euc/data/tuning.js';

export const STAIR_WHEEL=Object.freeze({radius:WHEEL.tyreDiameter/2,halfWidth:WHEEL.tyreWidth/2});
// Drawn nosing bar: protrudes `out` in front of the riser, top `up` over the tread, `depth` back from its front face.
export const STAIR_NOSING=Object.freeze({out:.025,up:.012,depth:.04});

// Tolerance of the fillet check (terrain that is not a straight line within the fitted metre); below the presentation margin.
const TOL=.002;
const FILLET_RADII=[2.4,1.8,1.4,1.1,.85,.65,.5,.38,.28,.2,.14,.1];

// Fillet between two lines y = a1 + m1·s (entering) and y = a2 + m2·s (leaving), radius R. Concave when m2 > m1.
// Returns {s1, s2, at(s)} (tangent points and the arc height), or null when the lines are parallel.
function fillet(a1,m1,a2,m2,R){
  if(Math.abs(m2-m1)<1e-9)return null;
  const sc=(a1-a2)/(m2-m1),yc=a1+m1*sc,al1=Math.atan(m1),al2=Math.atan(m2),D=Math.abs(al2-al1),d=R*Math.tan(D/2);
  const s1=sc-d*Math.cos(al1),s2=sc+d*Math.cos(al2),y1=yc-d*Math.sin(al1),concave=m2>m1;
  // Centre: from the first tangent point along the line's normal, toward the inside of the bend.
  const nx=concave?-Math.sin(al1):Math.sin(al1),ny=concave?Math.cos(al1):-Math.cos(al1),cx=s1+nx*R,cy=y1+ny*R;
  const at=s=>{const q=Math.sqrt(Math.max(0,R*R-(s-cx)**2));return concave?cy-q:cy+q;};
  return {s1,s2,at,sc,yc};}

// DEM triangle-edge crossings (grid lines and x+z diagonals, the terrain's split) of the plan row s between u0 and u1, as
// lateral positions: a support or apron row that ends on the terrain needs a line there to follow it exactly.
export function rowBreaks(at,u0,u1,s,{x0,z0,step}){const a=at(u0,s),b=at(u1,s),out=[],add=(f0,df,c0)=>{if(Math.abs(df)<1e-9)return;
    const lo=Math.min(f0,f0+df),hi=Math.max(f0,f0+df);for(let k=Math.ceil((lo-c0)/step);c0+k*step<=hi+1e-9;k++){const t=(c0+k*step-f0)/df;if(t>1e-4&&t<1-1e-4)out.push(u0+(u1-u0)*t);}};
  add(a[0],b[0]-a[0],x0);add(a[1],b[1]-a[1],z0);add(a[0]+a[1],b[0]-a[0]+b[1]-a[1],x0+z0);return out;}

// With `grid` (the terrain's {x0,z0,step}) the rows where the support or an apron meets the terrain get extra lateral lines
// at every DEM triangle-edge crossing (exact joins, many more facets); without it the joins are checked between lines
// (`lip`).
export function rideableFlight(o){
  const first=buildFlight(o);if(!o.grid)return first;
  const rows=[first.footS,first.topS];if(o.footApron)rows.push(-o.footApron);if(o.topApron)rows.push(o.run+o.topApron);
  return buildFlight({...o,uBreaks:[...(o.uBreaks??[]),...rows.flatMap(s=>rowBreaks(o.at,o.u0,o.u1,s,o.grid))]});}

function buildFlight({at,u0,u1,run,yf,yt,n,ground,wheel=STAIR_WHEEL,margin=.02,uStep=Math.min(1,Math.max(.3,(u1-u0)/10)),sStep=.08,uBreaks=[],nosing=STAIR_NOSING,approach=2.2,beyond=2.2,footApron=0,topApron=0,footReach=footApron||approach,topReach=topApron||beyond}){
  const r=wheel.radius,h=(yt-yf)/n,g=run/n,theta=Math.atan2(h,g),lift=r*(1/Math.cos(theta)-1)+margin;
  // The top riser's edge is the landing's own edge: no nosing bar there (it would stand proud of the landing surface).
  const treads=[];for(let k=0;k<n;k++)treads.push({k,s0:k*g,s1:(k+1)*g,top:yf+(k+1)*h,nosing:k<n-1});
  // Drawn ground outside the flight: the caller's surface, or a fitted apron (a ruled surface from the tread level at the
  // flight's end to the real ground `footApron`/`topApron` metres out, drawn and physical alike) where the DEM is smeared.
  const G=(u,s)=>ground(...at(u,s));
  const dg=(u,s)=>footApron&&s<0&&s>=-footApron?yf+(G(u,-footApron)-yf)*(-s/footApron)
    :topApron&&s>run&&s<=run+topApron?yt+(G(u,run+topApron)-yt)*((s-run)/topApron):G(u,s);
  // Drawn profile at lateral u: ground before the foot, treads with nosing bars, the surface beyond the top.
  const profile=u=>{const pts=[];
    for(let s=-approach;s<-nosing.out-1e-9;s+=.01)pts.push([s,dg(u,s)]);
    for(const t of treads){// nosing bar: front face at s0 − out, top at top + up, back at s0 − out + depth
      const a=t.s0-nosing.out,b=a+nosing.depth;if(t.nosing)for(let s=a;s<=b+1e-9;s+=.005)pts.push([s,t.top+nosing.up]);
      for(let s=t.nosing?b:t.s0;s<=t.s1+1e-9;s+=.01)pts.push([s,t.top]);}
    for(let s=run;s<=run+beyond+1e-9;s+=.01)pts.push([s,dg(u,s)]);
    return pts.sort((p,q)=>p[0]-q[0]);};
  // Exact rolling envelope minus r: the lowest contact height for a vertical wheel of radius r centred over s.
  const envelopeOf=(pts,u)=>{const S=Float64Array.from(pts,p=>p[0]),Y=Float64Array.from(pts,p=>p[1]);
    return s=>{if(s<S[0]+r||s>S[S.length-1]-r)return dg(u,s);let lo=0,hi=S.length;while(lo<hi){const m=(lo+hi)>>1;if(S[m]<s-r)lo=m+1;else hi=m;}
      let m=-Infinity;for(let i=lo;i<S.length&&S[i]<=s+r;i++){const d=S[i]-s,y=Y[i]+Math.sqrt(Math.max(0,r*r-d*d))-r;if(y>m)m=y;}return m;};};
  const noseY=s=>yf+h+nosing.up+(s+nosing.out)*h/g;  // line through the nosing bars' front top edges
  const plane=s=>noseY(s)+lift;
  // Lateral lines: every ≤ uStep plus the caller's breaks, inside [u0,u1].
  const us=[...new Set([u0,u1,...uBreaks.filter(u=>u>u0+1e-6&&u<u1-1e-6)].map(u=>+u.toFixed(6)))];
  for(let k=1,m=Math.ceil((u1-u0)/uStep);k<m;k++)us.push(+(u0+(u1-u0)*k/m).toFixed(6));
  const U=[...new Set(us)].sort((a,b)=>a-b).filter((u,i,a)=>!i||u-a[i-1]>.01||u===u1);
  const lines=U.map(u=>{const pts=profile(u),env=envelopeOf(pts,u);
    // Ground line before the foot (fit over the last metre) and the surface line beyond the top.
    // (Over the apron where there is one: the fillets start on it.)
    const dF=footApron?Math.max(.3,footApron*.9):1.0,dT=topApron?Math.max(.3,topApron*.9):1.0;
    const gA=dg(u,-nosing.out-.03),gB=dg(u,-nosing.out-dF),mF=(gA-gB)/(dF-.03),aF=gA-mF*(-nosing.out-.03);
    const tA=dg(u,run+.03),tB=dg(u,run+dT),mT=(tB-tA)/(dT-.03),aT=tA-mT*(run+.03);
    const aP=noseY(0)+lift,mP=h/g;
    let foot=null,top=null;
    // A wheel on any sloped ground already stands r·(sec − 1) into it (the rig's contact is under the centre): the fillets
    // may meet the ground and top lines with that same allowance, never more.
    const slackF=r*(Math.hypot(1,mF)-1),slackT=r*(Math.hypot(1,mT)-1);
    for(const R of FILLET_RADII){const f=fillet(aF,mF,aP,mP,R);if(!f||f.s1<-Math.min(approach-.05,footReach)||f.s2>run*.5)continue;
      let ok=true;for(let s=f.s1;s<=f.s2;s+=.01)if(f.at(s)<env(s)-slackF-TOL){ok=false;break;}
      if(ok){foot=f;break;}}
    for(const R of FILLET_RADII){const f=fillet(aP,mP,aT,mT,R);if(!f||f.s2>run+Math.min(beyond-.05,topReach)||f.s1<run*.5)continue;
      let ok=true;for(let s=f.s1;s<=f.s2;s+=.01)if(f.at(s)<env(s)-slackT-TOL){ok=false;break;}
      if(ok){top=f;break;}}
    if(!foot||!top)throw new Error(`sj-stairs: no clearing fillet at u ${u} (${!foot?"foot":"top"}; yf ${yf.toFixed(3)} yt ${yt.toFixed(3)} n ${n} run ${run.toFixed(2)} ground ${aF.toFixed(3)}+${mF.toFixed(3)}s top ${aT.toFixed(3)}+${mT.toFixed(3)}s)`);
    return {u,pts,env,foot,top,aF,mF,aT,mT,slackF,slackT};});
  // Support along a line: drawn ground before the foot fillet, fillet, plane, fillet, drawn surface beyond.
  // (A fillet can end inside the flight: the end line carries on over the last treads to the flight's edge.)
  // Inside each fillet the drawn ground's own departure from the fitted line fades out, so the support meets the drawn
  // ground exactly where the fillet starts (no millimetre seam that would make a sliver facet steep).
  const lineSupport=(L,s)=>{if(s<=L.foot.s1)return s<-nosing.out?dg(L.u,s):L.aF+L.mF*s;
    if(s<L.foot.s2){const t=(s-L.foot.s1)/(L.foot.s2-L.foot.s1),d=s<-nosing.out?dg(L.u,s)-(L.aF+L.mF*s):0;return L.foot.at(s)+d*(1-t);}
    if(s<=L.top.s1)return plane(s);
    if(s<L.top.s2){const t=(s-L.top.s1)/(L.top.s2-L.top.s1),d=s>run?dg(L.u,s)-(L.aT+L.mT*s):0;return L.top.at(s)+d*t;}
    return s<=run?L.aT+L.mT*s:dg(L.u,s);};
  // Shared rows: from the earliest fillet start (or the apron's far edge) to the latest fillet end (or the far apron edge),
  // fine through the fillets and aprons, one span on the plane. Inside an apron and outside a line's fillet the support is
  // the apron itself (drawn = physical there).
  const f1=Math.min(...lines.map(L=>L.foot.s1)),footE=Math.max(...lines.map(L=>L.foot.s2)),footS=Math.min(f1,footApron?-footApron:-nosing.out-.05);
  const topS=Math.min(...lines.map(L=>L.top.s1)),t2=Math.max(...lines.map(L=>L.top.s2)),topE=Math.max(t2,topApron?run+topApron:run+.05);
  const rows=new Set([footS,footE,topS,topE,f1,t2,0,run]);
  for(let s=f1;s<footE;s+=sStep)rows.add(s);for(let s=topS;s<t2;s+=sStep)rows.add(s);
  for(const L of lines)for(const s of [L.foot.s1,L.foot.s2,L.top.s1,L.top.s2])rows.add(s);
  const S=[...rows].map(s=>+s.toFixed(6)).sort((a,b)=>a-b).filter((s,i,a)=>!i||s-a[i-1]>.02||s===footS||s===topE);
  const tops=[],P=(L,s)=>{const [x,z]=at(L.u,s);return [x,lineSupport(L,s),z];};
  for(let i=0;i+1<lines.length;i++)for(let j=0;j+1<S.length;j++){const A=lines[i],B=lines[i+1],s0=S[j],s1=S[j+1];
    const a=P(A,s0),b=P(B,s0),c=P(B,s1),d=P(A,s1);tops.push([a,b,c],[a,c,d]);}
  // Apron triangles (drawn surface; the support over them is `tops`, equal to them outside the fillets).
  const aprons=[],D=(L,s)=>{const [x,z]=at(L.u,s);return [x,dg(L.u,s),z];};
  for(const [s0,s1] of [footApron?[-footApron,0]:null,topApron?[run,run+topApron]:null].filter(Boolean))
    for(let i=0;i+1<lines.length;i++){const A=lines[i],B=lines[i+1],a=D(A,s0),b=D(B,s0),c=D(B,s1),d=D(A,s1);aprons.push([a,b,c],[a,c,d]);}
  // Support and envelope at any (u,s): linear across the lateral lines (as the facets are).
  const bracket=u=>{let i=0;while(i+2<lines.length&&lines[i+1].u<u)i++;const A=lines[i],B=lines[i+1]??A,t=B===A?0:Math.max(0,Math.min(1,(u-A.u)/(B.u-A.u)));return [A,B,t];};
  const support=(u,s)=>{const [A,B,t]=bracket(u);return lineSupport(A,s)*(1-t)+lineSupport(B,s)*t;};
  const envelope=(u,s)=>{const [A,B,t]=bracket(u);return t<.5?A.env(s):B.env(s);};
  // Worst (smallest) support − envelope over all lines (≥ 0: a vertical wheel never cuts the drawn profile, beyond the
  // sloped-ground allowance on the fillets), and the largest float of the support over the envelope.
  let worstGap=Infinity,maxFloat=0,floatAt=null;
  for(const L of lines)for(let s=L.foot.s1;s<=L.top.s2;s+=.01){const e=L.env(s),y=lineSupport(L,s),slack=s<L.foot.s2?L.slackF:s>L.top.s1?L.slackT:0;
    worstGap=Math.min(worstGap,y-e+slack);if(y-e>maxFloat){maxFloat=y-e;floatAt=[L.u,+s.toFixed(2)];}}
  // Mouth/exit lips: support vs drawn surface on the support's outermost rows (where the tops meet the untouched ground).
  let lip=0,lipAt=null;for(const s of [footS,topE])for(let u=u0;u<=u1+1e-9;u+=.1){const d=Math.abs(support(Math.min(u,u1),s)-G(Math.min(u,u1),s));if(d>lip){lip=d;lipAt=[+u.toFixed(2),+s.toFixed(3),+support(Math.min(u,u1),s).toFixed(3),+G(Math.min(u,u1),s).toFixed(3)];}}
  return {h,g,theta,lift,margin,radius:r,run,n,yf,yt,u0,u1,at,treads,nosing,noseY,plane,footApron,topApron,
    lines:lines.map(L=>({u:L.u,footStart:L.foot.s1,footEnd:L.foot.s2,topStart:L.top.s1,topEnd:L.top.s2})),
    lineFits:lines.map(L=>[L.u,L.aF,L.mF,L.aT,L.mT]),support,envelope,tops,aprons,footS,topS:topE,worstGap,maxFloat,floatAt,lip,lipAt};}

// Signed clearance between a tyre point cloud (world) and a set of drawn boxes given in a flight frame
// ({toLocal(x,y,z) → [u,s,y]}; boxes {u0,u1,s0,s1,y0,y1}). Negative = inside a box (penetration depth).
export function boxClearance(points,toLocal,boxes){let worst=Infinity,at=null;
  for(const p of points){const [u,s,y]=toLocal(...p);
    for(const b of boxes){const dx=Math.max(b.u0-u,0,u-b.u1),ds=Math.max(b.s0-s,0,s-b.s1),dy=Math.max(b.y0-y,0,y-b.y1);
      let d;if(dx===0&&ds===0&&dy===0)d=-Math.min(u-b.u0,b.u1-u,s-b.s0,b.s1-s,y-b.y0,b.y1-y);else d=Math.hypot(dx,ds,dy);
      if(d<worst){worst=d;at=[u,s,y];}}}
  return {worst,at};}

// Tyre surface points in world space for a controller pose (ridingRig.js transform chain: group at (x,y,z) yawed by
// headingY → ground pivot (groundPitch, groundRoll) → lean pivot (wheelPitch, −rollAngle) → machine yaw / crash pop →
// tyre centre r up, axis lateral). Rounded tread profile from js/euc/render/euc.js (edge radius 0.824 r).
const RINGS=[[-1,.824],[-.62,.928],[-.3,.986],[0,1],[.3,.986],[.62,.928],[1,.824]];
export function tyrePoints(pose,{radius=STAIR_WHEEL.radius,halfWidth=STAIR_WHEEL.halfWidth,angles=96,lower=false}={}){
  const out=[],rot=(v,ax,a)=>{const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;
    return ax==='x'?[x,c*y-s*z,s*y+c*z]:ax==='y'?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];};
  // three.js Euler 'XYZ': R = Rx·Ry·Rz, so a vector is turned by z first, then y, then x.
  const euler=(v,x,y,z)=>rot(rot(rot(v,'z',z),'y',y),'x',x);
  for(const [t,f] of RINGS)for(let k=0;k<angles;k++){const a=k*2*Math.PI/angles;if(lower&&Math.cos(a)>.35)continue;
    let v=[t*halfWidth,radius+radius*f*Math.cos(a),radius*f*Math.sin(a)];         // tyre frame: axis x, centre r up
    v=rot(v,'y',(pose.wobbleYaw??0)+(pose.styleYaw??0)+(pose.wheelCrashSpin??0));v[1]+=pose.wheelCrashPop??0;
    v=euler(v,pose.wheelPitch??0,0,-(pose.rollAngle??0));
    v=euler(v,pose.groundPitch??0,0,pose.groundRoll??0);
    v=rot(v,'y',pose.headingY??0);out.push([v[0]+pose.x,v[1]+pose.y,v[2]+pose.z]);}
  return out;}

// Posed tyre centre and axle axis (same chain as tyrePoints).
export function tyreFrame(pose,radius=STAIR_WHEEL.radius){const rot=(v,ax,a)=>{const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;
    return ax==='x'?[x,c*y-s*z,s*y+c*z]:ax==='y'?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];};
  const euler=(v,x,z)=>rot(rot(v,'z',z),'x',x);
  const chain=(v,point)=>{v=rot(v,'y',(pose.wobbleYaw??0)+(pose.styleYaw??0)+(pose.wheelCrashSpin??0));if(point)v[1]+=pose.wheelCrashPop??0;
    v=euler(v,pose.wheelPitch??0,-(pose.rollAngle??0));v=euler(v,pose.groundPitch??0,pose.groundRoll??0);v=rot(v,'y',pose.headingY??0);
    return point?[v[0]+pose.x,v[1]+pose.y,v[2]+pose.z]:v;};
  return {C:chain([0,radius,0],true),a:chain([1,0,0],false)};}
const ringRadius=t=>{const x=Math.min(1,Math.abs(t));for(let i=3;i<6;i++){const [t0,f0]=RINGS[i],[t1,f1]=RINGS[i+1];if(x<=t1)return f0+(f1-f0)*(x-t0)/(t1-t0);}return RINGS[6][1];};
// Signed distance from a world point to the posed tyre solid (negative inside) and the vertical lift that clears it.
function cornerVsTyre(Q,T,radius,halfWidth){const D=[Q[0]-T.C[0],Q[1]-T.C[1],Q[2]-T.C[2]],a=T.a,t=D[0]*a[0]+D[1]*a[1]+D[2]*a[2];
  if(Math.abs(t)>halfWidth)return {d:Math.abs(t)-halfWidth,lift:-Infinity};
  const R=radius*ringRadius(t/halfWidth),ev0=[-a[1]*a[0],1-a[1]*a[1],-a[1]*a[2]],L=Math.hypot(...ev0),ev=ev0.map(v=>v/L);
  const rx=D[0]-t*a[0],ry=D[1]-t*a[1],rz=D[2]-t*a[2],q=rx*ev[0]+ry*ev[1]+rz*ev[2],rho=Math.hypot(rx,ry,rz),p2=Math.max(0,rho*rho-q*q);
  const lift=p2>=R*R?-Infinity:(q+Math.sqrt(R*R-p2))/ev[1];return {d:rho-R,lift};}
// Drawn convex corner lines of a registered flight near plan s: [s,y] (nosing front-top, front-bottom, back-top; the top
// tread's edge).
function cornersNear(f,s0,s1){const out=[];for(let b=Math.max(0,Math.floor((s0+f.out)/f.g));b<=Math.min(f.n-1,Math.ceil((s1+f.out)/f.g));b++){
    const top=f.yf+(b+1)*f.h;if(b<f.n-1)out.push([b*f.g-f.out,top+f.up],[b*f.g-f.out,top-.018],[b*f.g-f.out+f.depth,top+f.up]);else out.push([b*f.g,top]);}
  return out;}
const corners2world=(f,u,s)=>[f.ox+f.cx*u+f.ex*s,f.oz+f.cz*u+f.ez*s];
// Signed clearance of a posed tyre over a registered flight: sampled tyre points against the drawn height field and the
// drawn corner lines against the tyre solid. ≥ 0: no penetration.
export function stairTyreClearance(f,pose,{radius=STAIR_WHEEL.radius,halfWidth=STAIR_WHEEL.halfWidth}={}){let worst=Infinity;
  for(const p of tyrePoints(pose,{angles:96,lower:true,radius,halfWidth})){const [u,s]=local(f,p[0],p[2]);if(u<f.u0||u>f.u1)continue;worst=Math.min(worst,p[1]-stairDrawnHeight(f,u,s));}
  const T=tyreFrame(pose,radius),[uc,sc]=local(f,T.C[0],T.C[2]);
  for(const [cs,cy] of cornersNear(f,sc-radius,sc+radius))for(let du=-.3;du<=.3001;du+=.02){const u=uc+du;if(u<f.u0||u>f.u1)continue;
    const [x,z]=corners2world(f,u,cs);worst=Math.min(worst,cornerVsTyre([x,cy,z],T,radius,halfWidth).d);}
  return worst;}
// ---- Presentation: seat the drawn rig on the drawn treads (direction 2026-11-19) ----
// Physics rides the smooth lifted support above; the rendered wheel would hang up to ~11 cm over the tread bays. Each
// submitted view, for a rider on a registered flight, the rig (wheel and rider together; not the camera, not the physics)
// is moved vertically to the lowest height at which every lower tyre point of the posed wheel clears the drawn treads,
// nosings and end surfaces by REST_MARGIN. It rises at once when the steps require it (never a penetration) and settles
// at RATE_DOWN, so at speed it reads as a light rumble over the noses rather than a 19 Hz strobe. Off a flight the hook
// is one bounds test and returns 0.
export const STAIR_PRESENTATION=Object.freeze({margin:.008,rateDown:2.4,rateUp:.8,fade:.8});
const FLIGHTS=new Map();let ALL=[],BOX=[Infinity,-Infinity,Infinity,-Infinity];
function rebuild(){ALL=[...FLIGHTS.values()].flat();BOX=[Infinity,-Infinity,Infinity,-Infinity];
  for(const f of ALL){BOX[0]=Math.min(BOX[0],f.box[0]);BOX[1]=Math.max(BOX[1],f.box[1]);BOX[2]=Math.min(BOX[2],f.box[2]);BOX[3]=Math.max(BOX[3],f.box[3]);}}
// Compact record of a rideableFlight result (plan frame, tread numbers and the end-surface lines per lateral line).
// stairRecord(flight[, {reach}]): `reach` (default 0.3 m) is how far beside the flight's u0…u1 edges the presentation hook
// still engages. Pass 0 where a riding surface continues beside the flight (e.g. a side blend at a foot): there only the few
// tyre points over the flight would count and would pull the drawn wheel down into that surface. (Option added for the
// Las Ánimas foot, 2026-11-19; records without it behave exactly as before.) `samples` (default 64) is the number of tyre
// points the hook tests against the drawn treads; steep flights and turning foot transitions want more (part two passes 192).
export function stairRecord(fl,{reach,samples}={}){const [ox,oz]=fl.at(0,0),[sx,sz]=fl.at(0,1),[ux,uz]=fl.at(1,0),pad=fl.radius+fl.lines.length*0;
  const corners=[[fl.u0,fl.footS-fl.radius-STAIR_PRESENTATION.fade],[fl.u1,fl.footS-fl.radius-STAIR_PRESENTATION.fade],[fl.u0,fl.topS+fl.radius+STAIR_PRESENTATION.fade],[fl.u1,fl.topS+fl.radius+STAIR_PRESENTATION.fade]].map(([u,s])=>fl.at(u,s));
  const box=[Math.min(...corners.map(p=>p[0]))-pad,Math.max(...corners.map(p=>p[0]))+pad,Math.min(...corners.map(p=>p[1]))-pad,Math.max(...corners.map(p=>p[1]))+pad];
  // Compact height lookup used only to identify the physical layer, never as riding support.
  const ns=Math.ceil((fl.topS-fl.footS)/.2),nu=Math.ceil((fl.u1-fl.u0)/.4),Y=new Float32Array((nu+1)*(ns+1));
  for(let i=0;i<=nu;i++)for(let j=0;j<=ns;j++)Y[i*(ns+1)+j]=fl.support(fl.u0+(fl.u1-fl.u0)*i/nu,fl.footS+(fl.topS-fl.footS)*j/ns);
  return {layer:{ns,nu,Y,band:Math.max(.04,fl.lift+.5*Math.abs(fl.h/fl.g)*.2)},ox,oz,ex:sx-ox,ez:sz-oz,cx:ux-ox,cz:uz-oz,u0:fl.u0,u1:fl.u1,run:fl.run,n:fl.n,h:fl.h,g:fl.g,yf:fl.yf,yt:fl.yt,out:fl.nosing.out,up:fl.nosing.up,depth:fl.nosing.depth,
    footS:fl.footS,topS:fl.topS,box,lines:Float64Array.from(fl.lineFits.flat()),nl:fl.lineFits.length,...(reach===undefined?{}:{reach}),...(samples===undefined?{}:{samples})};}
export function registerStairFlights(owner,records){if(records?.length)FLIGHTS.set(owner,records);else FLIGHTS.delete(owner);rebuild();}
// A mapped stair way can instead be an almost-level paved walk on the DEM (311911403).
// It has no risers or fillets. Seat the same posed tyre against its actual terrain
// triangles: even with identical drawn/physical ground the rig pitches about its contact.
export function drapedWalkRecord([a,b],half,ground){
  const run=Math.hypot(b[0]-a[0],b[1]-a[1]),ex=(b[0]-a[0])/run,ez=(b[1]-a[1])/run,pad=half+STAIR_WHEEL.radius+STAIR_PRESENTATION.fade;
  return {ox:a[0],oz:a[1],ex,ez,cx:-ez,cz:ex,u0:-half,u1:half,footS:0,topS:run,run,n:0,g:run,out:0,
    yf:ground(...a),yt:ground(...b),
    box:[Math.min(a[0],b[0])-pad,Math.max(a[0],b[0])+pad,Math.min(a[1],b[1])-pad,Math.max(a[1],b[1])+pad],
    reach:0,samples:96,drape:(u,s)=>ground(a[0]+ex*s-ez*u,a[1]+ez*s+ex*u)};
}
const local=(f,x,z)=>{const dx=x-f.ox,dz=z-f.oz;return [dx*f.cx+dz*f.cz,dx*f.ex+dz*f.ez];};
// Drawn height at (u,s): end surfaces (per-line fits), treads, nosing bars.
export function stairDrawnHeight(f,u,s){if(f.drape)return f.drape(u,s);
  let i=0;const L=f.lines,nl=f.nl;while(i+2<nl&&L[(i+1)*5]<u)i++;
  const j=Math.min(nl-1,i+1),t=j===i?0:Math.max(0,Math.min(1,(u-L[i*5])/(L[j*5]-L[i*5])));
  const lineY=(o,m)=>(L[i*5+o]+L[i*5+m]*s)*(1-t)+(L[j*5+o]+L[j*5+m]*s)*t;
  if(s>f.run)return lineY(3,4);
  let y=s<0?lineY(1,2):f.yf+(Math.min(f.n-1,Math.floor(s/f.g))+1)*f.h;
  const b=Math.floor((s+f.out)/f.g);if(b>=0&&b<f.n-1&&s>=b*f.g-f.out&&s<=b*f.g-f.out+f.depth)y=Math.max(y,f.yf+(b+1)*f.h+f.up);
  return y;}
function layerY(f,u,s){
  if(f.drape)return f.drape(u,s);
  if(s<f.footS||s>f.topS)return stairDrawnHeight(f,u,s);
  const {ns,nu,Y}=f.layer,U=Math.max(0,Math.min(nu,(u-f.u0)*nu/(f.u1-f.u0))),S=Math.max(0,Math.min(ns,(s-f.footS)*ns/(f.topS-f.footS)));
  const i=Math.min(nu-1,Math.floor(U)),j=Math.min(ns-1,Math.floor(S)),k=i*(ns+1)+j,t=S-j,v=U-i;
  return (1-v)*((1-t)*Y[k]+t*Y[k+1])+v*((1-t)*Y[k+ns+1]+t*Y[k+ns+2]);
}
// Each profile ring of the rounded tyre projects to an ellipse in the flight's (s,y) plane.
// Its lowest point *inside* a rectangular tread interval is either its bottom or its cross
// section at the nearer end. Includes contacts on vertical riser edges between mesh vertices.
function posedNeed(f,tyre,skin=0){
  tyre.updateWorldMatrix(true,false);
  const m=tyre.matrixWorld.elements,[u,s]=local(f,m[12],m[14]),y=m[13];
  let need=-Infinity;
  if(f.drape||s<.32||s>f.run-.32||u<f.u0+.27||u>f.u1-.27){
    const p=tyre.geometry.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),v=p.getY(i),z=p.getZ(i),[U,S]=local(f,m[0]*x+m[4]*v+m[8]*z+m[12],m[2]*x+m[6]*v+m[10]*z+m[14]);
      if(U<f.u0||U>f.u1)continue;
      need=Math.max(need,stairDrawnHeight(f,U,S)-(m[1]*x+m[5]*v+m[9]*z+y)+skin);}
  }
  if(!f.n||u<f.u0||u>f.u1)return need;
  const ay=m[5],as=m[4]*f.ex+m[6]*f.ez,vs=Math.max(1e-10,1-as*as),vy=Math.max(1e-10,1-ay*ay),cov=-as*ay;
  const k0=Math.max(0,Math.floor((s-.31)/f.g)),k1=Math.min(f.n-1,Math.floor((s+.31)/f.g));
  for(const [t,frac] of RINGS){const a=t*STAIR_WHEEL.halfWidth,sc=s+a*as,yc=y+a*ay,R=frac*STAIR_WHEEL.radius+skin,low=-R*cov/Math.sqrt(vy);
    const over=(l,h,top)=>{const d=Math.min(h,Math.max(l,sc+low))-sc,rad=R*R-d*d/vs;
      if(rad>=0)need=Math.max(need,top-yc-cov*d/vs+Math.sqrt(Math.max(0,(vy-cov*cov/vs)*rad)));};
    for(let k=k0;k<=k1;k++){const l=k*f.g,top=f.yf+(k+1)*f.h;over(l,l+f.g,top);
      if(k<f.n-1)over(l-f.out,l-f.out+f.depth,top+f.up);}
  }
  return need;
}
export function stairRigOffset(pose,seconds,state,tyre=null,root=null){
  const step=Math.max(0,seconds),travel=state.x===undefined?0:Math.hypot(pose.x-state.x,pose.z-state.z);
  if(travel>1.5)state.off=0;
  state.x=pose.x;state.z=pose.z;
  const release=()=>state.off=Math.sign(state.off||0)*Math.max(0,Math.abs(state.off||0)-step*1.2-travel*.4);
  if(pose.x<BOX[0]||pose.x>BOX[1]||pose.z<BOX[2]||pose.z>BOX[3])return release();
  let f=null,w=0,su=0,ss=0;
  for(const q of ALL){if(pose.x<q.box[0]||pose.x>q.box[1]||pose.z<q.box[2]||pose.z>q.box[3])continue;const [u,s]=local(q,pose.x,pose.z);
    const reach=q.reach??.3;if(u<q.u0-reach||u>q.u1+reach)continue;const ww=Math.max(0,Math.min(1,1-Math.max(q.footS-s,s-q.topS,0)/STAIR_PRESENTATION.fade));
    if(ww<=w||(q.footBoundary&&s<=q.footBoundary(u)+.001)||Math.abs(pose.y-(pose.airHeight??0)-layerY(q,u,s))>(q.layer?.band??.06))continue;
    w=ww;f=q;su=u;ss=s;}
  if(!f||(pose.crashBlend??0)>0||(pose.ragdollBlend??0)>0||(tyre&&(pose.airHeight??0)>.001))return release();
  if(tyre){
    // Near-solid probes may displace the rig by a whole tread in one view (including
    // along a perfectly clear riding line). The fitted support already carries the wheel.
    // Fade out only that longitudinal presentation push inside this flight; preserve a
    // transverse push away from a real cheek. Then solve using the *resulting* axle.
    if(root){const ds=(root.position.x-pose.x)*f.ex+(root.position.z-pose.z)*f.ez;
      const blend=Math.min(w,Math.max(0,Math.min(1,(su-f.u0)/.18,(f.u1-su)/.18)));
      root.position.x-=ds*f.ex*blend;root.position.z-=ds*f.ez*blend;}
    // Clamp the *total* visual offset, not just the stair contribution (the rig may
    // already have been lifted). The feasible interval is measured NORMAL to the
    // tread/nose by expanding the tyre, not vertically over a near-vertical riser.
    const lift=root?root.position.y-pose.y:0,low=posedNeed(f,tyre,.003)+lift;
    if(!Number.isFinite(low))return release();
    const high=posedNeed(f,tyre,.025)+lift,prior=state.off??0,limit=step*.35+travel*.28;
    // At pace favour the middle of the correction range over a tread cycle, so
    // the rig doesn't chase the bottom of each bay just before the next riser.
    const speedMix=Math.min(1,Math.abs(pose.speed??0)/3.5);
    const goal=w*(low+(Math.min(high,Math.max(low,-.35*(f.h??0)))-low)*speedMix);
    state.off=Math.max(low,Math.min(high,Math.max(prior-limit,Math.min(prior+limit,goal))));
    return state.off-lift;}
  void su;void ss;
  // Lift needed so every lower tyre point clears the drawn surface by the margin (negative: the rig may come down).
  let need=-Infinity;for(const p of tyrePoints(pose,{angles:f.samples??64,lower:true})){const [u,s]=local(f,p[0],p[2]);if(u<f.u0||u>f.u1)continue;
    const d=stairDrawnHeight(f,u,s)-p[1];if(d>need)need=d;}
  {const T=tyreFrame(pose),[uc,sc]=local(f,T.C[0],T.C[2]),R=STAIR_WHEEL.radius;
    for(const [cs,cy] of cornersNear(f,sc-R,sc+R))for(let du=-.3;du<=.3001;du+=.02){const u=uc+du;if(u<f.u0||u>f.u1)continue;
      const [x,z]=corners2world(f,u,cs),l=cornerVsTyre([x,cy,z],T,R,STAIR_WHEEL.halfWidth).lift;if(l>need)need=l;}}
  if(need===-Infinity){state.off=0;return 0;}
  need+=STAIR_PRESENTATION.margin;
  const airborne=(pose.airHeight??0)>1e-4,goal=airborne?Math.max(need,0):need*w+Math.max(need,0)*(1-w);
  let off=state.off??0;
  if(goal>off)off=Math.min(goal,off+STAIR_PRESENTATION.rateUp*seconds);else off=Math.max(goal,off-STAIR_PRESENTATION.rateDown*seconds);
  off=Math.max(off,need);state.off=off;return off;}
// Registered flight records used by the presentation hook.
export function stairFlightRecords(owner){return owner?FLIGHTS.get(owner)??[]:ALL;}

// Test an entire walking segment against the padded oriented stair/approach rectangle.
// Slab clipping includes segments with both endpoints outside the rectangle.
export function crossesStairApproach(a,b,pad=1.25){return ALL.some(f=>{
  const A=local(f,...a),B=local(f,...b);let t0=0,t1=1;
  for(const [i,lo,hi] of [[0,f.u0-pad,f.u1+pad],[1,f.footS-pad-1.5,f.topS+pad+1.5]]){
    const d=B[i]-A[i];if(Math.abs(d)<1e-10){if(A[i]<lo||A[i]>hi)return false;continue;}
    const l=(lo-A[i])/d,h=(hi-A[i])/d;t0=Math.max(t0,Math.min(l,h));t1=Math.min(t1,Math.max(l,h));if(t0>t1)return false;}
  return true;});}
