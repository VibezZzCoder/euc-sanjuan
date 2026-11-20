/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Cathedral corridor — © 2026 VibezZzCoder, MIT. Mapped footprints/streets: OSM / ODbL.
// Wikimedia Commons curid=151530323, curid=151596781, curid=158245895, curid=1798720, curid=15687347 guide proportions; heights/ornament are authored inferences, not a survey.
import {terrainFoundation} from './sj-plaza-layout.js';
import {intersectRings} from './sj-paving.js';
import {rideableFlight,stairRecord,registerStairFlights} from './sj-stairs.js';

export const CATHEDRAL_ID=255583481;
export const CORRIDOR_BOUNDS={minX:-190,maxX:-36,minZ:-53,maxZ:43};
// Carry the southern Cristo approach to its mapped endpoint, not a six-metre tail past San Francisco.
// Facade authoring stays within CORRIDOR_BOUNDS; paving/ground masking have their own bounded extent.
export const CORRIDOR_PAVING_BOUNDS={...CORRIDOR_BOUNDS,maxZ:110.287};
// gate approach: Caleta de San Juan from Cristo down to the Puerta de San Juan inner mouth (Wikimedia Commons curid=53594779, curid=151530324).
export const CALETA_BOUNDS={minX:-284,maxX:-140,minZ:-20,maxZ:42};
const inBox=(b,x,z)=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;
export const inCorridor=(x,z)=>inBox(CORRIDOR_BOUNDS,x,z)||inBox(CALETA_BOUNDS,x,z);
export function facadeFrame(a,b) {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
  return {length,ux,uz,nx:-uz,nz:ux,angle:-Math.atan2(uz,ux),
    point:(u,y,d=0)=>[a[0]+ux*u-uz*d,y,a[1]+uz*u+ux*d]};
}
export function corridorFacade(f,corridor) {
  const p=f.point(f.length/2,0,1);
  if(!inCorridor(p[0],p[2]))return false;
  return corridor.paving.some(s=>{
    const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],u=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[2]-s.a[1])*dz)/(dx*dx+dz*dz)));
    const x=s.a[0]+u*dx,z=s.a[1]+u*dz;
    return Math.hypot(x-p[0],z-p[2])<s.width/2+3.5&&(x-p[0])*f.nx+(z-p[2])*f.nz>0;
  });
}
function terrainMaximum(ring,terrain,height) {
  // Exact extrema of piecewise-linear terrain over this convex tread: include all clipped facet vertices.
  const t=terrain;
  const x0=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[0]))-t.x0)/t.step));
  const x1=Math.min(t.nx-2,Math.floor((Math.max(...ring.map(p=>p[0]))-t.x0)/t.step));
  const z0=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[1]))-t.z0)/t.step));
  const z1=Math.min(t.nz-2,Math.floor((Math.max(...ring.map(p=>p[1]))-t.z0)/t.step));
  let maximum=-Infinity;
  for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++) {
    const x=t.x0+i*t.step,z=t.z0+j*t.step,s=t.step;
    for(const tri of [[[x,z],[x+s,z],[x,z+s]],[[x+s,z],[x+s,z+s],[x,z+s]]])
      for(const p of intersectRings(tri,ring))maximum=Math.max(maximum,height(...p));
  }
  if(!Number.isFinite(maximum))throw new Error('Missing cathedral tread terrain');
  return maximum;
}
const triPlane=tri=>{const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;return {x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny};};
export function createCorridorLayout({city,height,terrain,gate=null}) {
  const paving=[];
  for(const r of city.roads.filter(r=>[247332271,248557858,248557857].includes(r.id))) {
    for(let i=1;i<r.points.length;i++) {
      const a=r.points[i-1],b=r.points[i];let lo=0,hi=1;
      for(const [axis,min,max] of [[0,CORRIDOR_PAVING_BOUNDS.minX,CORRIDOR_PAVING_BOUNDS.maxX],[1,CORRIDOR_PAVING_BOUNDS.minZ,CORRIDOR_PAVING_BOUNDS.maxZ]]) {
        const d=b[axis]-a[axis];
        if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)hi=-1;continue;}
        const p=(min-a[axis])/d,q=(max-a[axis])/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));
      }
      if(hi<=lo)continue;
      const at=u=>a.map((v,j)=>v+(b[j]-v)*u);
      // Cristo's continuous sett carriageway owns the San Francisco crossing (Wikimedia Commons curid=151596781); the asphalt branch
      // meets its edge, rather than ending halfway across it. Other mixed junctions retain their existing priority.
      paving.push({a:at(lo),b:at(hi),width:r.width,kind:r.surface==='sett'?'sett':'asphalt',source:r.id,
        ...(r.id===248557858?{priority:0}:{})});
    }
  }
  // Caleta de San Juan (22229090 sett; 248557853 untagged service, inferred cobbles from Wikimedia Commons curid=81591500, curid=53594779, curid=151530324) ends at the
  // gate's inner face: the passage floor, not draped heightfield paving, owns the bore and its mouth.
  for(const r of city.roads.filter(r=>[22229090,248557853].includes(r.id)))for(let i=1;i<r.points.length;i++) {
    let a=r.points[i-1],b=r.points[i];
    if(gate&&r.id===248557853){
      // Keep only the part outside (u ≥ inner face) of the passage frame.
      const end=gate.passage.uInner,ua=gate.frame.UV(...a)[0],ub=gate.frame.UV(...b)[0];
      if(ua<end&&ub<end)continue;
      if(ua<end||ub<end){const t=(end-ua)/(ub-ua),p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(ua<end)a=p;else b=p;}
    }
    paving.push({a,b,width:r.width,kind:'sett',source:r.id});
  }
  const building=city.buildings.find(b=>b.id===CATHEDRAL_ID);
  if(!building)throw new Error('Cathedral footprint missing');
  // The mapped west face has one collinear intermediate vertex. Keep its exact two end anchors.
  const frame=facadeFrame(building.outer[5],building.outer[7]),width=frame.length;
  const ground=Math.max(...[.05,.25,.5,.75,.95].map(u=>{const p=frame.point(width*u,0,0);return height(p[0],p[2]);}))+.15;
  const roof=building.roof,solids=[],steps=[];
  function solid(u,front,depth,w,minY,maxY,support=false) {
    const point=(x,d)=>{const p=frame.point(x,0,d);return [p[0],p[2]];};
    const outer=[point(u-w/2,front-depth),point(u+w/2,front-depth),point(u+w/2,front),point(u-w/2,front)];
    const item={u,front,depth,width:w,outer,minY,maxY,support};solids.push(item);return item;
  }
  // One short broad flight below the three portals (Wikimedia Commons curid=1798720, curid=15687347). Keep every tread above the exact terrain
  // facets, not merely above the centre sample: the earlier long flight visibly intersected the slope.
  const doors=[.18,.5,.82].map(r=>({u:r*width,width:r===.5?3.25:2.75}));
  // (public stairs ride up and down, no wheel clipping), part two: uniform risers from the lowest
  // foot level that still keeps every tread 2.5 cm over the exact terrain under it, up to the top tread at the doors
  // (unchanged); treads are drawn only (no tread solids): the physical support is js/sj-stairs.js's smooth lifted
  // nose-line support (`tops`), blended into the street and onto the 0.5 m top pad before the closed doors.
  const tops=[],cuts=[];let stairFlight=null;const FOOT_APRON=2.4;
  {
    const count=6,run=.5,w0=.4,w1=width-.4,yt=ground,P=(u,d)=>{const p=frame.point(u,0,d);return [p[0],p[2]];};
    // Foot at the street's lowest level along the foot line (the street's convex knee in front of the steps
    // leaves no clearing fillet from a higher foot); a render cut over the footprint (below) keeps the DEM out of
    // the drawn treads instead of lifting the flight off the street.
    const yf=[.1,.3,.5,.7,.9].map(t=>height(...P(w0+(w1-w0)*t,3.3))).sort((a,b)=>a-b)[0];
    for(let i=0;i<count;i++) {
      const front=3-i*run,top=yf+(i+1)*(yt-yf)/count;
      const s=solid(width/2,front,run+.015,width-.8,building.base,top,true);s.tread=true;
      s.minY=terrainFoundation(s.outer,terrain,s.maxY).minY;steps.push(s);
    }
    // The street rises to the steps: span its convex knee with a fitted 2.4 m foot apron (drawn and
    // physical, over a render cut) carries it to the first riser, as on the Capitol.
    const fl=rideableFlight({at:(u,sv)=>P(u,3-sv),u0:w0,u1:w1,run:count*run,yf,yt,n:count,footApron:FOOT_APRON,approach:3.5,margin:.035,  // margin as the Capitol's STAIR_MARGIN
     
      ground:(x,z)=>{const dx=x-P(0,0)[0],dz=z-P(0,0)[1],q=P(0,1),d=dx*(q[0]-P(0,0)[0])+dz*(q[1]-P(0,0)[1]);return d<0?yt:height(x,z);},grid:terrain});
    fl.treads.forEach((t,k)=>{steps[k].nosing=t.nosing;});
    for(const tri of fl.tops){const top=Math.max(tri[0][1],tri[1][1],tri[2][1]);
      tops.push({poly:tri.map(p=>({x:p[0],z:p[2]})),top,plane:triPlane(tri),replacesTerrain:true,maxReferenceY:top+4,surface:'pavement',source:'corridor:cathedral-stair'});}
    {let lo=Infinity;for(const t of fl.aprons)for(const p of t)lo=Math.min(lo,p[1]);
      const ring=[P(w0-.01,3-count*run-.01),P(w1+.01,3-count*run-.01),P(w1+.01,3+FOOT_APRON),P(w0-.01,3+FOOT_APRON)],xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
      const cw=(a,b)=>{const nx=-(b[1]-a[1]),nz=b[0]-a[0],l=Math.hypot(nx,nz);return [nx/l,0,nz/l,-(nx*a[0]+nz*a[1])/l];};
      const sgn=Math.sign(ring.reduce((t,p,i)=>{const q=ring[(i+1)%4];return t+p[0]*q[1]-q[0]*p[1];},0));
      const planes=ring.map((p,i)=>{const pl=cw(p,ring[(i+1)%4]);return sgn>0?pl:pl.map(v=>-v);});
      cuts.push({minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),kind:'corridor-apron',planes:[...planes,[0,1,0,-(lo-.25)]]});}
    registerStairFlights('corridor',[stairRecord(fl,{samples:192})]);stairFlight=fl;
  }
  // Upper facade masses stay behind the existing west footprint plane; trim/pediment/sculpture are visual ornament.
  const tiers=[solid(width/2,0,1.4,width*.56,roof,roof+3.9),solid(width/2,0,1.4,width*.56,roof+3.9,roof+7.7)];
  const colliders=solids.filter(s=>!s.tread).map(s=>({outer:s.outer.map(([x,z])=>({x,z})),holes:[],minY:s.minY,maxY:s.maxY,surface:'pavement',support:s.support}));
  const arrival=frame.point(width/2,0,12);
  const pavingBounds={...CORRIDOR_PAVING_BOUNDS,minX:Math.min(CORRIDOR_PAVING_BOUNDS.minX,CALETA_BOUNDS.minX)};
  // Flight frame for the shared stair module (public stairs ride up and down without wheel clipping).
  // Uphill is toward the facade; s runs from the foot line (outer edge of the lowest tread) inward. The top tread is the
  // 0.5 m pad before the closed doors (turn/roll-out there); street connector 465231622 meets this frontage, not a flight.
  const flight=(()=>{const P=(u,d)=>{const p=frame.point(u,0,d);return [p[0],p[2]];},o=P(0,0),q=P(0,1),nrm=[q[0]-o[0],q[1]-o[1]],w0=.4,w1=width-.4;
    const foot=steps[0].front,topD=steps.at(-1).front-steps.at(-1).depth,footY=stairFlight.yf;
    return {id:'corridor:cathedral',width:w1-w0,axis:[-nrm[0],-nrm[1]],foot:{line:[P(w0,foot),P(w1,foot)],y:footY},top:{line:[P(w0,topD),P(w1,topD)],y:steps.at(-1).maxY},
      treads:steps.map(st=>({s0:foot-st.front,s1:foot-st.front+st.depth,y:st.maxY,nose:foot-st.front})),
      risers:{n:steps.length,h:(steps.at(-1).maxY-footY)/steps.length,run:.5},landings:{foot:{y:footY,depth:3},top:{y:steps.at(-1).maxY,depth:steps.at(-1).depth,closedDoors:true}},
      module:{worstGap:stairFlight.worstGap,maxFloat:stairFlight.maxFloat,lip:stairFlight.lip,lipAt:stairFlight.lipAt,theta:stairFlight.theta,lift:stairFlight.lift,footS:stairFlight.footS,topS:stairFlight.topS,nosing:stairFlight.nosing,yf:stairFlight.yf}};})();
  return {bounds:CORRIDOR_BOUNDS,pavingBounds,paving,cathedral:{id:CATHEDRAL_ID,frame,width,ground,roof,doors,steps,tiers,flight,aprons:stairFlight.aprons},colliders,tops,cuts,
    places:[{name:'Catedral de San Juan Bautista — exterior',x:arrival[0],z:arrival[2],source:CATHEDRAL_ID}]};
}
