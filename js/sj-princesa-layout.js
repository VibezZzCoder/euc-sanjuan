/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Paseo de la Princesa east to Raíces (Wikimedia Commons curid=80420009, curid=182263283, curid=195143828, curid=122996449) — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// area module. Shared physical/render owner: sj-princesa.js draws exactly these numbers.
// Area contract (all fields consumed generically by sj-world.js / sj-plaza.js / main.js):
//   colliders  — SfTerrainSampler colliders (prisms {outer,holes,minY,maxY,surface,support} or boxes {centre,halfExtents,rotationY});
//                a prism with `soft: true` is foliage (shrub, hedge): construction still treats it as occupied, the rider drags
//                through it (js/sj-soft-foliage.js) and it is never a solid (no crash, no camera or placement obstacle)
//   tops       — replacement/support floors (same shape as sj-gate-layout / sj-fort-layout tops)
//   cuts       — render-only convex terrain cuts {planes,minX,maxX,minZ,maxZ}
//   tint       — Map(terrain vertex index → tone name ('rock','lawn','paseo','stone','masonry') or '#rrggbb')
//   surfaces   — [{ring,kind}] draped overlays; kind ∈ plaza|sett|asphalt|paseo|morro (single owner, convex)
//   floorTriangles — authored floor triangles [[x,y,z]×3] drawn in the sett 'passage' batch
//   places     — map arrivals [{name,x,z,source}]
// Mapped: city wall 704106796 (gate end → Fortaleza bastion → park curtain → Raíces bastion → jog 704106802), footway
// 561590373, pedestrian area 256661399, Fuente de las Raíces 344551844, coastline 700237422, park 1396452816.
// Inferred: face fit, seawall/coping, lamp/bench/tree/pillar/planter positions,
// fountain/sculpture/flag dimensions.
import {circle,segmentDistance,inRing,terrainFoundation} from './sj-plaza-layout.js';
import {subtractRing,signedArea} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {wallBody} from './sj-fort-layout.js';

// OSM 704106796 from the gate pass's last station (15 m along the bastion's Princesa face) to its east end, then the
// 704106802 jog. The 1.7 m stub (-231.09,205.33) at the Raíces salient is folded into the tip (Douglas–Peucker 1.8 m).
export const WALL=[[-302.117,94.596],[-308.77,148.25],[-284.34,175.7],[-281.93,171.9],[-237.07,184.61],[-232.79,205.67],
  [-179.71,192.44],[-180.27,187.61]];
// Segments with the gate's masonry parapet (the same bastion as the gate run, Wikimedia Commons curid=80420009, curid=80420699); elsewhere a low coping
// with the green iron lattice railing of Wikimedia Commons curid=182263283, curid=122996449.
const PARAPET_SEGS=new Set([0,1]);
// OSM 700237422 coastline from the gate seawall end to the Raíces pier root (also 256661399's sea edge).
const COAST=[[-310.32,91.4],[-312.51,109.88],[-315.63,134.49],[-316.8,143.45],[-318.5,150.59],[-294.56,178.28],[-247.91,205.88],
  [-236.38,213.72],[-235.47,214.55],[-239.05,223.9],[-236.65,226.23],[-236.14,228.27],[-236.84,232.07],[-237.08,239.31],
  [-234.88,244.6],[-236.79,248.84],[-229.43,266.07],[-217.2,260.22],[-211.49,258.08]];
// OSM 256661399 Raíces pedestrian area (paving_stones) and 344551844 fountain basin.
export const PLAZA=[[-148.64,230.09],[-149.37,220.56],[-177.58,220.99],[-230.89,208.85],[-232.9,211.35],[-235.47,214.55],
  [-239.05,223.9],[-236.65,226.23],[-236.14,228.27],[-236.84,232.07],[-237.08,239.31],[-234.88,244.6],[-236.79,248.84],
  [-229.43,266.07],[-217.2,260.22],[-211.49,258.08],[-198.51,253.21],[-195.16,246.75],[-147.59,242.48],[-147.74,239.92]];
const FOUNTAIN_RING=[[-212.49,232.47],[-211.58,230.61],[-210.14,229.13],[-208.29,228.18],[-206.24,227.86],[-204.06,228.23],
  [-202.11,229.32],[-200.67,230.99],[-199.85,233.05],[-199.79,235.26],[-200.49,237.36],[-201.84,239.11],[-203.72,240.31],
  [-205.88,240.81],[-207.94,240.59],[-209.83,239.74],[-211.37,238.35],[-212.37,236.55],[-212.76,234.52]];
const SPACING=2;
const SEA={half:.34,rise:.82};  // Wikimedia Commons curid=80420009: broad rounded coping (gate seawall .28 half-width, widened along the bastion)
const RAIL={rise:1.05,coping:.22}; // Wikimedia Commons curid=122996449: coping then a ~1 m green lattice railing

function hit(a,b,c,d) {
  const den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]);if(Math.abs(den)<1e-12)return null;
  const t=((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den,u=((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))/den;
  return t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9?[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,t,u]:null;
}
// Remove loops from an offset polyline (re-entrant corners make offset lines cross themselves).
export function untangle(pts) {
  let p=pts.map(q=>[q[0],q[1]]);
  for(let guard=0;guard<200;guard++){let cut=false;
    outer:for(let i=0;i+1<p.length;i++)for(let j=i+2;j+1<p.length;j++){const x=hit(p[i],p[i+1],p[j],p[j+1]);
      if(x&&!(j===i+1)){p=[...p.slice(0,i+1),[x[0],x[1]],...p.slice(j+1)];cut=true;break outer;}}
    if(!cut)break;}
  return p.filter((q,i)=>i===0||Math.hypot(q[0]-p[i-1][0],q[1]-p[i-1][1])>.05);
}
function resample(line,step) {
  const out=[];
  for(let i=0;i+1<line.length;i++){const a=line[i],b=line[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
    for(let j=0;j<n;j++)out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
  out.push([...line.at(-1)]);return out;
}
function simplify(path,tol,maxLen=12) {
  const keep=new Uint8Array(path.length);keep[0]=keep[path.length-1]=1;
  const dp=(i,j)=>{const a=path[i],b=path[j],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;let m=-1,k=-1;
    for(let q=i+1;q<j;q++){const d=Math.abs((b[0]-a[0])*(a[1]-path[q][1])-(a[0]-path[q][0])*(b[1]-a[1]))/L;if(d>m){m=d;k=q;}}
    if(k>0&&(m>tol||L>maxLen)){keep[k]=1;dp(i,k);dp(k,j);}};
  dp(0,path.length-1);return path.filter((p,i)=>keep[i]);
}
const nearestOn=(line,x,z)=>{let best={d:Infinity};
  for(let i=0;i+1<line.length;i++){const a=line[i],b=line[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    const p=[a[0]+dx*t,a[1]+dz*t],d=Math.hypot(p[0]-x,p[1]-z);if(d<best.d)best={d,p,i,t};}
  return best;};

export function createPrincesaLayout({city,height,terrain,surface,gate,fort}) {
  void fort;
  if(!gate)return {colliders:[],tops:[],cuts:[],tint:new Map(),surfaces:[],floorTriangles:[],places:[]};
  const {BATTER,PARAPET,PLINTH}=gate.constants;
  const g0=gate.stations.at(-1);
  const dry=(x,z)=>{if(!terrain?.nx)return height(x,z)>-3;const {x0,z0,step,nx,nz}=terrain,i=Math.floor((x-x0)/step),j=Math.floor((z-z0)/step);
    if(i<0||j<0||i>=nx-1||j>=nz-1)return false;return height(x,z)>-3&&landAt(j*nx+i);};
  // The land mask is not passed to area layouts. In this area sea cells are exactly the surface mask's 'waterEdge' class
  // (3) and the −4 nodata height (survey 2026-11-16: 2,706 sea / 6,794 land cells, no exceptions), so the four-corner
  // test matches world.isDry here.
  function landAt(k){return !surface||(surface[k]!==3&&surface[k+1]!==3&&surface[k+terrain.nx]!==3&&surface[k+terrain.nx+1]!==3);}

  // ---- Wall run: per-segment stations, owned DEM samples, battered face fit (port of the gate fitter). ----
  const segs=[];
  {let s0=0;for(let i=0;i+1<WALL.length;i++){const a=WALL[i],b=WALL[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;segs.push({k:i,a,b,L,ux,uz,nx:-uz,nz:ux,s0,parapet:PARAPET_SEGS.has(i)});s0+=L;}}
  for(const g of segs){g.stations=[];const n=Math.max(1,Math.ceil(g.L/SPACING));
    for(let j=0;j<=n;j++){const t=g.L*j/n;g.stations.push({x:g.a[0]+g.ux*t,z:g.a[1]+g.uz*t,t,s:g.s0+t,seg:g.k,nx:g.nx,nz:g.nz});}}
  const sample=(s,d)=>height(s.x+s.nx*d,s.z+s.nz*d);
  const off=(s,d)=>[s.x+s.nx*d,s.z+s.nz*d];
  const bbox=g=>({minX:Math.min(g.a[0],g.b[0]),maxX:Math.max(g.a[0],g.b[0]),minZ:Math.min(g.a[1],g.b[1]),maxZ:Math.max(g.a[1],g.b[1])});
  const near=segs.map((g,k)=>{const A=bbox(g);return segs.map((h,j)=>j).filter(j=>{if(j===k)return false;const B=bbox(segs[j]);
    return Math.max(B.minX-A.maxX,A.minX-B.maxX,B.minZ-A.maxZ,A.minZ-B.maxZ)<22;});});
  const owns=(s,d)=>{const [x,z]=off(s,d),mine=segmentDistance(x,z,segs[s.seg].a,segs[s.seg].b);
    return near[s.seg].every(j=>segmentDistance(x,z,segs[j].a,segs[j].b)+.25>=mine);};
  for(const g of segs)for(const s of g.stations){
    const plateau=[];for(let d=-6;d<=0;d+=.25)if(owns(s,d))plateau.push(sample(s,d));
    plateau.sort((p,q)=>p-q);let top=plateau.length?plateau[Math.floor(plateau.length*.7)]:sample(s,0);
    if(owns(s,-6)&&sample(s,-6)-sample(s,-4)>.8){const far=[];for(let d=-12;d<=-5;d+=.25)if(owns(s,d))far.push(sample(s,d));
      far.sort((p,q)=>p-q);if(far.length)top=Math.max(top,far[Math.floor(far.length*.7)]);}
    // Toe: first point outward where the next metre falls less than 0.32 m; capped 6 m out (the smear never reaches further).
    let foot=-1;for(;foot<6;foot+=.125){const h=sample(s,foot);if(!owns(s,foot+1)||h<top-2.5&&h-sample(s,foot+1)<.32)break;}
    const ground=sample(s,foot),base=ground,tolerance=PLINTH.rise*.6;
    let need=-6;
    for(const dt of [-1,-.67,-.33,0,.33,.67,1]){if(s.t+dt<0||s.t+dt>g.L)continue;const q={...s,x:s.x+g.ux*dt,z:s.z+g.uz*dt};
      for(let d=-8;d<=Math.max(foot,0)+2.5+.001;d+=.125){if(!owns(q,d))continue;const h=sample(q,d);if(h>base+tolerance)need=Math.max(need,d+(h-base)*BATTER);}}
    Object.assign(s,{top,ground,base,need:need+.05,full:true});
  }
  const stations0=segs.flatMap(g=>g.stations);
  // Pin the join to the gate run's last station; crest falls ≤0.12 m per metre along the wall (smeared salient tips).
  stations0[0].top=g0.top;
  {const base0=stations0.map(s=>s.top);
    for(let pass=0;pass<2;pass++){for(let i=1;i<stations0.length;i++)stations0[i].top=Math.max(stations0[i].top,stations0[i-1].top-.12*Math.abs(stations0[i].s-stations0[i-1].s));
      for(let i=stations0.length-2;i>=1;i--)stations0[i].top=Math.max(stations0[i].top,stations0[i+1].top-.12*Math.abs(stations0[i+1].s-stations0[i].s));}
    stations0.forEach((s,i)=>s.lifted=s.top-base0[i]);}
  for(const g of segs){const st=g.stations,d=st.map(s=>s.need);
    if(g.k===0)d[0]=g0.dFoot;
    for(let pass=0;pass<2;pass++){for(let i=1;i<st.length;i++)d[i]=Math.max(d[i],d[i-1]-.25*(st[i].t-st[i-1].t));
      for(let i=st.length-2;i>=(g.k===0?1:0);i--)d[i]=Math.max(d[i],d[i+1]-.25*(st[i+1].t-st[i].t));}
    st.forEach((s,i)=>s.dFoot=d[i]);}
  for(const g of segs){
    for(const s of g.stations){const base=Math.min(s.base,sample(s,s.dFoot)),crest=s.top+.06-PARAPET.cordon,dTop=s.dFoot-(crest-base)*BATTER;
      let dIn=dTop;for(;dIn>dTop-3.5;dIn-=.125)if(!owns(s,dIn-.125)||sample(s,dIn)>=s.top-.12)break;
      Object.assign(s,{dIn:dIn-.3});}
    const st=g.stations,d=st.map(s=>-s.dIn);
    for(let pass=0;pass<2;pass++){for(let i=1;i<st.length;i++)d[i]=Math.max(d[i],d[i-1]-.35*(st[i].t-st[i-1].t));
      for(let i=st.length-2;i>=0;i--)d[i]=Math.max(d[i],d[i+1]-.35*(st[i+1].t-st[i].t));}
    st.forEach((s,i)=>s.dIn=-d[i]);
  }
  const parapetOf=s=>segs[s.seg].parapet;
  for(const g of segs)for(const s of g.stations){
    const base=Math.min(s.base,sample(s,s.dFoot)),crest=s.top+.06-PARAPET.cordon,dTop=s.dFoot-(crest-base)*BATTER,dIn=s.dIn;
    let cover=-Infinity;for(let q=dIn;q<=dTop;q+=.125)cover=Math.max(cover,sample(s,q));
    const bottom=Math.min(base,sample(s,s.dFoot+PLINTH.proud))-.4,dBot=s.dFoot+(base-bottom)*BATTER;
    Object.assign(s,{base,crest,dTop,dIn,bottom,walk:Math.max(s.top+.06,cover+.04),
      F:off(s,s.dFoot),B:off(s,dBot),L:off(s,s.dFoot+PLINTH.proud),LB:off(s,dBot+PLINTH.proud),T:off(s,dTop),
      C:off(s,dTop+.2),Q:off(s,dTop-(parapetOf(s)?PARAPET.thick:.32)),W:off(s,dIn)});
  }
  // Exact join: the first station is the gate's last (same keys/heights), so the faces continue without a seam.
  {const s=segs[0].stations[0];for(const key of ['F','B','L','LB','T','C','Q','W'])s[key]=[...g0[key]];
    for(const key of ['base','crest','walk','bottom','dFoot','dTop','dIn','top'])s[key]=g0[key];s.join=true;}
  // Corners: plan polylines meet where they cross; convex salients with very different offsets become a short chamfer;
  // overshooting stations collapse onto the meeting point along each wall axis (the gate mitre).
  const ends=[];
  for(let k=0;k+1<segs.length;k++){
    const A=segs[k].stations,B=segs[k+1].stations;
    for(const key of ['F','B','L','LB','T','C','Q','W']){
      let found=null;
      for(let i=A.length-2;i>=Math.max(0,A.length-10)&&!found;i--)for(let j=0;j<Math.min(B.length-1,10)&&!found;j++){
        const x=hit(A[i][key],A[i+1][key],B[j][key],B[j+1][key]);if(x&&!(i===A.length-2&&j===0&&Math.hypot(x[0]-A.at(-1)[key][0],x[1]-A.at(-1)[key][1])<1e-9))found={i,j,x:[x[0],x[1]]};}
      if(found){for(let m=found.i+1;m<A.length;m++)A[m][key]=[...found.x];for(let m=0;m<=found.j;m++)B[m][key]=[...found.x];continue;}
      const ta=[A.at(-1)[key][0]-A.at(-2)[key][0],A.at(-1)[key][1]-A.at(-2)[key][1]],tb=[B[1][key][0]-B[0][key][0],B[1][key][1]-B[0][key][1]];
      const la=Math.hypot(...ta),lb=Math.hypot(...tb),mid=[(A.at(-1)[key][0]+B[0][key][0])/2,(A.at(-1)[key][1]+B[0][key][1])/2];
      let x=mid;
      if(la>1e-9&&lb>1e-9){const det=ta[0]/la*tb[1]/lb-ta[1]/la*tb[0]/lb;
        if(Math.abs(det)>.12){const p=A.at(-1)[key],q=B[0][key],kk=((q[0]-p[0])*tb[1]/lb-(q[1]-p[1])*tb[0]/lb)/det;x=[p[0]+ta[0]/la*kk,p[1]+ta[1]/la*kk];}}
      if(Math.hypot(x[0]-A.at(-1)[key][0],x[1]-A.at(-1)[key][1])>2.5||Math.hypot(x[0]-B[0][key][0],x[1]-B[0][key][1])>2.5)x=mid;
      A.at(-1)[key]=x;B[0][key]=[...x];
      const sa=segs[k],sb=segs[k+1],along=(p,g)=>(p[0]-g.a[0])*g.ux+(p[1]-g.a[1])*g.uz;
      for(const q of A)if(along(q[key],sa)>along(x,sa))q[key]=[...x];
      for(const q of B)if(along(q[key],sb)<along(x,sb))q[key]=[...x];
    }
    const a=A.at(-1),b=B[0];
    for(const key of ['crest','walk'])a[key]=b[key]=Math.max(a[key],b[key]);
    a.bottom=b.bottom=Math.min(a.bottom,b.bottom);a.corner=b.corner=k+1;
    // Parapet ↔ railing change: a masonry end closes the parapet block.
    if(segs[k].parapet!==segs[k+1].parapet)ends.push({s:a,dir:1,parapetOnly:true});
  }
  const lerp=(p,q,t)=>Array.isArray(p)?[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]:p+(q-p)*t;
  const NUM=['x','z','s','t','top','ground','base','crest','walk','dFoot','dTop','dIn'],KEYS=['F','B','L','LB','T','C','Q','W'];
  for(const g of segs){const out=[];
    g.stations.forEach((a,i)=>{out.push(a);const b=g.stations[i+1];if(!b)return;
      const span=Math.max(...['F','T','B'].map(key=>Math.hypot(b[key][0]-a[key][0],b[key][1]-a[key][1]))),n=span>1.8*SPACING?Math.ceil(span/SPACING):1;
      for(let j=1;j<n;j++){const t=j/n,q={seg:a.seg,nx:a.nx,nz:a.nz,full:true,inserted:true};
        for(const key of [...NUM,...KEYS])q[key]=lerp(a[key],b[key],t);q.bottom=Math.min(a.bottom,b.bottom);out.push(q);}});
    g.stations=out;}
  for(const g of segs)for(const s of g.stations)if(!s.join)s.bottom=Math.min(s.bottom,height(...s.F)-.4,height(...s.B)-.4,height(...s.L)-.4);
  const stations=segs.flatMap(g=>g.stations);
  for(const s of stations)s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);
  // Plinth course top (2026-11-16): following each station's DEM toe gave a scalloped band, and corner
  // trimming left stations on one plan point with base heights up to 3.7 m apart. Stations sharing a plinth point share
  // one height (the highest), then a short running mean of those groups; the join keeps the gate run's exact value.
  {const groups=[];for(const s of stations){const g=groups.at(-1);
      if(g&&Math.hypot(s.L[0]-g[0].L[0],s.L[1]-g[0].L[1])<.25)g.push(s);else groups.push([s]);}
    const raw=groups.map(g=>Math.max(...g.map(s=>s.base))+PLINTH.rise);
    groups.forEach((g,i)=>{let n=0,sum=0;for(let q=Math.max(0,i-2);q<=Math.min(groups.length-1,i+2);q++){sum+=raw[q];n++;}
      for(const s of g)s.plinthTop=s.join?g0.base+PLINTH.rise:sum/n;});
    for(const g of groups)if(g.some(s=>s.join))for(const s of g)s.plinthTop=g0.base+PLINTH.rise;}

  const colliders=[];
  const prism=(outer,minY,maxY,support=false,tag)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support,...(tag?{tag}:{})};colliders.push(c);return c;};
  const box=(x,y,z,hx,hy,hz,ry=0)=>colliders.push({centre:{x,y,z},halfExtents:{x:hx,y:hy,z:hz},rotationY:ry,surface:'pavement'});
  const walls=[];
  for(const g of segs)for(let i=0;i+1<g.stations.length;i++){
    const a=g.stations[i],b=g.stations[i+1],walk=Math.max(a.walk,b.walk),parapet=g.parapet;walls.push({a,b,walk,parapet});
    wallBody(prism,a,b,Math.min(a.bottom,b.bottom)-.2,walk,'walk');
    // Full-height parapet / railing colliders reach down into the wall body (donor sweep at pedal height).
    prism([a.T,b.T,b.Q,a.Q],Math.min(a.crest,b.crest)-1.5,walk+(parapet?PARAPET.rise:RAIL.coping+RAIL.rise));
  }
  // Wikimedia Commons curid=122996449: a garita on the Raíces bastion salient (OSM vertex 5), on the crest at the tip.
  const garitas=[];
  {const k=5,tip=segs[k-1].stations.at(-1),mx=segs[k-1].nx+segs[k].nx,mz=segs[k-1].nz+segs[k].nz,l=Math.hypot(mx,mz);
    const x=tip.T[0]+mx/l*.35,z=tip.T[1]+mz/l*.35,y=tip.walk-.55;
    garitas.push({x,z,y,radius:.82,body:2.2,corbel:1.15,wallNx:mx/l,wallNz:mz/l,kind:'corner',vertex:k});
    prism(circle(x,z,.88,14),y-.05,y+2.2+.95);}

  // ---- Seawall at the dry edge (Wikimedia Commons curid=80420009, curid=195143828, curid=80420013): from the gate seawall's end round the coast to the pier root. ----
  const coast=resample(COAST,1.5),inward=coast.map((p,i)=>{const q=coast[Math.min(i+1,coast.length-1)],o=coast[Math.max(i-1,0)],dx=q[0]-o[0],dz=q[1]-o[1],l=Math.hypot(dx,dz)||1;
    return [-dz/l,dx/l];});
  // Which side is land: test the midpoint of the run against the DEM.
  {const i=Math.floor(coast.length/3),[nx,nz]=inward[i],p=coast[i];if(height(p[0]+nx*6,p[1]+nz*6)<height(p[0]-nx*6,p[1]-nz*6))inward.forEach(v=>{v[0]=-v[0];v[1]=-v[1];});}
  let seaLine=coast.map((p,i)=>{const [nx,nz]=inward[i];let d=-3;
    for(;d<14;d+=.125){const x=p[0]+nx*d,z=p[1]+nz*d;if(dry(x,z)&&dry(x+nx*.6,z+nz*.6)&&dry(x+nx*SEA.half*2+nx*.4,z+nz*SEA.half*2+nz*.4))break;}
    return [p[0]+nx*(d+.1+SEA.half),p[1]+nz*(d+.1+SEA.half)];});
  for(let pass=0;pass<3;pass++)seaLine=seaLine.map((p,i)=>i===0||i===seaLine.length-1?p:[(seaLine[i-1][0]+2*p[0]+seaLine[i+1][0])/4,(seaLine[i-1][1]+2*p[1]+seaLine[i+1][1])/4]);
  // Join: start exactly at the gate seawall's last frame, blending onto the dry-edge line over ~8 m.
  {const e=gate.seaFrame.at(-1),start=[e.x,e.z];let k=0;while(k<seaLine.length&&Math.hypot(seaLine[k][0]-start[0],seaLine[k][1]-start[1])<8)k++;
    seaLine=[start,...seaLine.slice(k)];}
  // Douglas–Peucker keeps the seawall light; frames are pushed back onto dry ground below.
  seaLine=untangle(simplify(seaLine,.08,8));
  const seaFrame=seaLine.map((p,i)=>{const q=seaLine[Math.min(i+1,seaLine.length-1)],o=seaLine[Math.max(i-1,0)],dx=q[0]-o[0],dz=q[1]-o[1],l=Math.hypot(dx,dz)||1;
    let nx=-dz/l,nz=dx/l;if(height(p[0]+nx*3,p[1]+nz*3)<height(p[0]-nx*3,p[1]-nz*3)-.3){nx=-nx;nz=-nz;}
    return {x:p[0],z:p[1],nx,nz,half:Math.min(SEA.half,.28+Math.hypot(p[0]-seaLine[0][0],p[1]-seaLine[0][1])*.02)};}); // +n inland
  // Consistent inland side (smoothed frames may flip on the plaza's zigzag).
  for(let i=1;i<seaFrame.length;i++){const a=seaFrame[i-1],b=seaFrame[i];if(a.nx*b.nx+a.nz*b.nz<0){b.nx=-b.nx;b.nz=-b.nz;}}
  // Smoothing can drift a vertex seaward of the dry edge: push it inland until its centre and outer face stand on land.
  seaFrame.forEach((f,i)=>{if(i===0)return;for(let k=0;k<30&&!(dry(f.x,f.z)&&dry(f.x-f.nx*f.half,f.z-f.nz*f.half));k++){f.x+=f.nx*.1;f.z+=f.nz*.1;}
    seaLine[i]=[f.x,f.z];});
  const seaTop=seaFrame.map(f=>{let m=-Infinity;for(const d of [-.25,0,.25,.5,.9])m=Math.max(m,height(f.x+f.nx*d,f.z+f.nz*d));return m+SEA.rise;});
  // The outer face runs below the water line: the dry cells seaward of it are cut away below.
  const seaBottom=seaFrame.map(f=>Math.min(height(f.x-f.nx*.6,f.z-f.nz*.6),height(f.x+f.nx*.5,f.z+f.nz*.5),height(f.x,f.z),-.6)-.4);
  const seaIn=f=>[f.x+f.nx*f.half,f.z+f.nz*f.half];
  // dry 2 m DEM cells left seaward of the smoothed seawall stood out of the bay as pale
  // triangular teeth (1.1–1.3 m past the outer face, 1.3–1.7 m above the water). Render-only convex cuts remove the
  // terrain within 4 m seaward of the outer face, one per seawall span, bounded by shared bisector planes.
  const cuts=[],coastRings=[];
  {const outer=seaFrame.map(f=>[f.x-f.nx*f.half,f.z-f.nz*f.half]),dir=[],FAR=4;
    for(let i=0;i+1<outer.length;i++){const dx=outer[i+1][0]-outer[i][0],dz=outer[i+1][1]-outer[i][1],l=Math.hypot(dx,dz)||1;dir.push([dx/l,dz/l]);}
    const bis=i=>{const a=dir[Math.max(0,i-1)],b=dir[Math.min(dir.length-1,i)],x=a[0]+b[0],z=a[1]+b[1],l=Math.hypot(x,z)||1;return [x/l,z/l];};
    for(let i=0;i<dir.length;i++){const A=outer[i],B=outer[i+1],f=seaFrame[i];let nx=-dir[i][1],nz=dir[i][0];if(nx*f.nx+nz*f.nz<0){nx=-nx;nz=-nz;}
      const ta=bis(i),tb=bis(i+1),nA=nx*A[0]+nz*A[1];
      const planes=[[-nx,0,-nz,nA-1e-3],[nx,0,nz,FAR-nA],[ta[0],0,ta[1],-(ta[0]*A[0]+ta[1]*A[1])],[-tb[0],0,-tb[1],tb[0]*B[0]+tb[1]*B[1]]];
      // Plan of the volume: the exact intersection of its half-planes (sharp turns make the bisectors meet within FAR,
      // turning the quad into a triangle), so the paving subtraction below removes exactly what the cut removes.
      let ring=[[A[0]-20,A[1]-20],[A[0]+20,A[1]-20],[A[0]+20,A[1]+20],[A[0]-20,A[1]+20]];
      for(const q of planes){const v=ring.map(([x,z])=>q[0]*x+q[2]*z+q[3]),next=[];
        for(let k=0;k<ring.length;k++){const a=ring[k],b=ring[(k+1)%ring.length],va=v[k],vb=v[(k+1)%ring.length];if(va>=0)next.push(a);
          if((va>=0)!==(vb>=0)){const t=va/(va-vb);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}
        ring=next;if(ring.length<3)break;}
      if(ring.length<3)continue;coastRings.push(ring);
      cuts.push({planes,ring,kind:'coast',minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),
        minZ:Math.min(...ring.map(p=>p[1])),maxZ:Math.max(...ring.map(p=>p[1]))});}}
  for(let i=0;i+1<seaFrame.length;i++){const a=seaFrame[i],b=seaFrame[i+1],o=(f,d)=>[f.x+f.nx*d,f.z+f.nz*d];
    prism([o(a,-a.half),o(b,-b.half),o(b,b.half),o(a,a.half)],Math.min(seaBottom[i],seaBottom[i+1]),Math.max(seaTop[i],seaTop[i+1]));}

  // ---- Promenade: wall-side verge line (clear of the smeared toe) to the seawall's inner face. ----
  const runStations=stations.filter(s=>s.seg<=4);
  const lowAt=(x,z)=>{const q=nearestOn(seaLine,x,z).p;return height(q[0],q[1]);};
  // Wikimedia Commons curid=122996449: a narrow planted strip at the wall foot; never drape paving up the smeared toe: the verge ends where the
  // ground outward has stopped falling (<0.15 m over the next metre). Park/plaza-side runs keep ≥1.1 m of planting.
  // on the two bastion faces (segments 0–1) the minimum verge is 0.95 m
  // past the plinth, so the paving edge stays ≥ 1.07 m from the face foot and the wall-foot strip (sj-wall-foot.js) owns a
  // smooth foot line there (39 intervals were skipped as princesa:surface, DEM teeth up to 0.45 m). Wikimedia Commons curid=80420009 shows the walk
  // meeting a darker band at the bastion foot, so that strip takes a stone-gutter tone (below), not the planted green of 38.
  for(const s of runStations){let v=s.seg===3||s.seg===4?1.1:s.seg<=1?.95:.25;
    for(;v<4.5;v+=.1){const [x,z]=off(s,s.dFoot+PLINTH.proud+v),[x1,z1]=off(s,s.dFoot+PLINTH.proud+v+1);if(height(x,z)-height(x1,z1)<.15)break;}
    s.verge=v;}
  // Slope-limited envelope (≤0.3 m per metre of wall): no zigzag paving edge where the toe jitters between stations.
  {const v=runStations.map(s=>s.verge);
    for(let pass=0;pass<2;pass++){for(let i=1;i<v.length;i++)v[i]=Math.max(v[i],v[i-1]-.3*Math.abs(runStations[i].s-runStations[i-1].s));
      for(let i=v.length-2;i>=0;i--)v[i]=Math.max(v[i],v[i+1]-.3*Math.abs(runStations[i+1].s-runStations[i].s));}
    runStations.forEach((s,i)=>s.verge=v[i]);}
  const wallSide=runStations.map(s=>off(s,s.dFoot+PLINTH.proud+s.verge));
  let wallLine=untangle(wallSide);
  wallLine[0]=[...g0.F]; // gate forecourt ends on the gate's last wall foot
  wallLine=simplify(wallLine,.06,10);
  // Promenade ends where the plaza (256661399) begins: the bastion salient on the land side, 256661399's NW coast vertex.
  const seaEnd=nearestOn(seaLine,-235.47,214.55);
  // Strip parametrised by the seawall: from each frame's inner face, cast inland to the verge line. Neighbouring quads
  // share their edges; non-convex quads split into triangles; overlaps resolve by single-owner subtraction below.
  const castInland=(a,nx,nz)=>{let best=40;
    for(let i=0;i+1<wallLine.length;i++){const x=hit(a,[a[0]+nx*40,a[1]+nz*40],wallLine[i],wallLine[i+1]);if(x)best=Math.min(best,x[2]*40);}
    return best;};
  // Frames densified to ≤1.5 m (the simplified seawall keeps up to 8 m spans; toe facets intrude between them).
  const dense=[];
  for(let i=0;i<=seaEnd.i&&i<seaFrame.length;i++){const f=seaFrame[i],g=seaFrame[i+1];dense.push({f,a:seaIn(f)});
    if(!g||i===seaEnd.i)continue;const n=Math.ceil(Math.hypot(g.x-f.x,g.z-f.z)/1.5);
    for(let j=1;j<n;j++){const t=j/n,nx=f.nx+(g.nx-f.nx)*t,nz=f.nz+(g.nz-f.nz)*t,l=Math.hypot(nx,nz);
      const h={x:f.x+(g.x-f.x)*t,z:f.z+(g.z-f.z)*t,nx:nx/l,nz:nz/l,half:f.half+(g.half-f.half)*t};dense.push({f:h,a:seaIn(h)});}}
  {const f=seaFrame[Math.min(seaEnd.i,seaFrame.length-1)];dense.push({f,a:seaEnd.p});}
  const inner=dense.map(({f,a})=>{let w=castInland(a,f.nx,f.nz);
    // Pull the paved edge off the smeared toe: stop where the ground rose >0.18 m over the last metre (the gently
    // sloping park keeps its full width; Wikimedia Commons curid=80420009, curid=122996449 show a planted strip at the wall foot instead).
    const at=d=>height(a[0]+f.nx*d,a[1]+f.nz*d);
    while(w>.8&&(at(w)-at(w-1)>.18||at(w-.4)-at(w-1.4)>.18))w-=.1;
    return {a,f,w};});
  // ≤0.5 m of width change per metre (the 1.2 m/m limit still left bites in the planted-strip edge).
  for(let pass=0;pass<2;pass++){for(let i=1;i<inner.length;i++){const ds=Math.hypot(inner[i].a[0]-inner[i-1].a[0],inner[i].a[1]-inner[i-1].a[1]);inner[i].w=Math.min(inner[i].w,inner[i-1].w+.5*ds);}
    for(let i=inner.length-2;i>=0;i--){const ds=Math.hypot(inner[i].a[0]-inner[i+1].a[0],inner[i].a[1]-inner[i+1].a[1]);inner[i].w=Math.min(inner[i].w,inner[i+1].w+.5*ds);}}
  for(const q of inner)q.b=[q.a[0]+q.f.nx*q.w,q.a[1]+q.f.nz*q.w];
  const raw=[],convexRing=r=>{const s=Math.sign(signedArea(r));return r.every((b,i)=>{const a=r[(i+r.length-1)%r.length],c=r[(i+1)%r.length];return s*((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>=-1e-9;});};
  for(let i=0;i+1<inner.length;i++){const p=inner[i],q=inner[i+1],ring=[p.a,q.a,q.b,p.b];
    if(convexRing(ring)&&Math.abs(signedArea(ring))>1e-4)raw.push({kind:'paseo',ring,owner:'promenade'});
    else for(const tri of [[p.a,q.a,q.b],[p.a,q.b,p.b]])if(Math.abs(signedArea(tri))>1e-4)raw.push({kind:'paseo',ring:tri,owner:'promenade'});}
  const promenadeInner=inner.map(q=>q.b);
  // Raíces plaza (mapped pedestrian area) minus the fountain base; its coast edge stops at the seawall's inner face.
  const fx=FOUNTAIN_RING.reduce((n,p)=>n+p[0],0)/FOUNTAIN_RING.length,fz=FOUNTAIN_RING.reduce((n,p)=>n+p[1],0)/FOUNTAIN_RING.length;
  const fr=FOUNTAIN_RING.reduce((n,p)=>n+Math.hypot(p[0]-fx,p[1]-fz),0)/FOUNTAIN_RING.length;
  const plazaRing=PLAZA.map(p=>{const n=nearestOn(seaLine,...p);if(n.d<4){const f=seaFrame[Math.min(n.i,seaFrame.length-1)];
    const s=(p[0]-n.p[0])*f.nx+(p[1]-n.p[1])*f.nz;if(s<f.half+.02)return [n.p[0]+f.nx*(f.half+.02),n.p[1]+f.nz*(f.half+.02)];}return p;});
  const fountainCut=circle(fx,fz,(fr+.62)/Math.cos(Math.PI/24),24); // circumscribed: every edge clears the step
  for(const ring of convexPieces(plazaRing))raw.push({kind:'paseo',ring,owner:'plaza'});
  const surfaces=[],brick=[],rb=raw.map(r=>bounds(r.ring)),hitB=(a,b)=>a[0]<=b[1]&&b[0]<=a[1]&&a[2]<=b[3]&&b[2]<=a[3];
  const gateRings=gate.surfaces.map(s=>s.ring),gb=gateRings.map(bounds),fb=bounds(fountainCut);
  for(let i=0;i<raw.length;i++){
    let pieces=[signedArea(raw[i].ring)<0?[...raw[i].ring].reverse():raw[i].ring];
    const cuts=[...gateRings.filter((r,j)=>hitB(rb[i],gb[j])),...(hitB(rb[i],fb)?[fountainCut]:[]),...coastRings.filter(r=>hitB(rb[i],bounds(r))),...raw.slice(0,i).filter((r,j)=>hitB(rb[i],rb[j])).map(r=>r.ring)];
    for(const cut of cuts)pieces=pieces.flatMap(poly=>subtractRing(poly,signedArea(cut)<0?[...cut].reverse():cut));
    // Wikimedia Commons curid=37349529, curid=131971361: the Raíces plaza is warm brick (drawn by sj-princesa.js with its own texture); the promenade keeps the
    // pale slabs of Wikimedia Commons curid=80420009, curid=122996449 through the shared 'paseo' overlay.
    for(const ring of pieces)if(Math.abs(signedArea(ring))>1e-4)(raw[i].owner==='plaza'?brick:surfaces).push({kind:raw[i].owner==='plaza'?'brick':raw[i].kind,ring,owner:raw[i].owner});
  }
  const paved=[...surfaces,...brick];
  for(const s of paved)[s.b0,s.b1,s.b2,s.b3]=bounds(s.ring);
  const inPaved=(x,z)=>paved.some(s=>x>=s.b0&&x<=s.b1&&z>=s.b2&&z<=s.b3&&inRing(x,z,s.ring));

  // ---- Fountain (Wikimedia Commons curid=195143828, curid=37349529, curid=149388353): shallow step, low outer basin, raised inner basin, rock group; flagpoles either side. ----
  // the step sat on the DEM mound inside the basin (2.93 m) and read as a 0.35–0.8 m drum.
  // The level step now takes its height from the ground round its edge, and a render-only cut removes the mound under it
  // (the solid basin collider owns that ground; riders never stand inside it).
  const fRing=circle(fx,fz,fr+.6,32);let gMin=Infinity,edgeMax=-Infinity,edgeMin=Infinity;
  if(terrain?.nx){const {x0,z0,step,nx,heights}=terrain;
    for(let j=Math.floor((fz-fr-1-z0)/step);j<=Math.ceil((fz+fr+1-z0)/step);j++)for(let i=Math.floor((fx-fr-1-x0)/step);i<=Math.ceil((fx+fr+1-x0)/step);i++)
      gMin=Math.min(gMin,heights[j*nx+i]);}
  for(let k=0;k<48;k++){const a=k*Math.PI/24;for(const r of [fr+.6,fr+.9]){const h=height(fx+Math.cos(a)*r,fz+Math.sin(a)*r);edgeMax=Math.max(edgeMax,h);edgeMin=Math.min(edgeMin,h);}}
  if(!Number.isFinite(gMin))gMin=edgeMin;
  const stepTop=edgeMax+.1;
  const fountain={x:fx,z:fz,radius:fr,stepRadius:fr+.6,bottom:Math.min(gMin,edgeMin)-.12,stepTop,rimTop:stepTop+.5,water:stepTop+.34,
    inner:{radius:3.7,top:stepTop+1.15},edgeRise:{min:stepTop-edgeMax,max:stepTop-edgeMin},source:344551844};
  prism(fRing,fountain.bottom,fountain.rimTop);
  {const R=fr+.55,n=24,ring=[],planes=[];
    for(let k=0;k<n;k++){const a=(k+.5)*Math.PI*2/n;ring.push([fx+Math.cos(k*Math.PI*2/n)*R,fz+Math.sin(k*Math.PI*2/n)*R]);
      planes.push([-Math.cos(a),0,-Math.sin(a),R*Math.cos(Math.PI/n)+Math.cos(a)*fx+Math.sin(a)*fz]);}
    cuts.push({planes,ring,kind:'fountain',minX:fx-R,maxX:fx+R,minZ:fz-R,maxZ:fz+R});}
  // Flagpoles on the bay side of the basin (Wikimedia Commons curid=195143828 frames two either side behind the sculpture; Wikimedia Commons curid=131971361, curid=149388353 show 3–4).
  const toSea=[-1,0.15],tl=Math.hypot(...toSea),ax=toSea[0]/tl,az=toSea[1]/tl,seaAngle=Math.atan2(az,ax);
  const flags=[-1,1].map(s=>{const x=fx+ax*(fr+3.2)-az*s*7.5,z=fz+az*(fr+3.2)+ax*s*7.5;return {x,z,y:height(x,z),height:11.5,flag:true};});
  for(const p of flags)prism(circle(p.x,p.z,.16,8),p.y-.2,p.y+p.height);
  // Wikimedia Commons curid=37349529: white bollards ringing the fountain on its circular paving band (~2.4 m apart). An even count, offset half a
  // step from the bay axis, so both axes (bay and east approach) open between two bollards and the ring stays symmetric.
  const bollardRing=[];{const r=fr+3.3,n=2*Math.round(Math.PI*r/2.4);
    for(let i=0;i<n;i++){const a=seaAngle+(i+.5)*Math.PI*2/n,x=fx+Math.cos(a)*r,z=fz+Math.sin(a)*r;if(inPaved(x,z))bollardRing.push({x,z,y:height(x,z)});}}

  // ---- Dressing along the promenade (Wikimedia Commons curid=80420009, curid=122996449; positions inferred). ----
  const seaLen=[0];for(let i=1;i<seaLine.length;i++)seaLen.push(seaLen[i-1]+Math.hypot(seaLine[i][0]-seaLine[i-1][0],seaLine[i][1]-seaLine[i-1][1]));
  const along=(s,d)=>{let i=1;while(i<seaLen.length-1&&seaLen[i]<s)i++;const t=(s-seaLen[i-1])/(seaLen[i]-seaLen[i-1]||1);
    const a=seaFrame[i-1],b=seaFrame[i],x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,nx=a.nx+(b.nx-a.nx)*t,nz=a.nz+(b.nz-a.nz)*t,l=Math.hypot(nx,nz);
    const half=a.half+(b.half-a.half)*t;return {x:x+nx/l*(half+d),z:z+nz/l*(half+d),nx:nx/l,nz:nz/l};};
  const promEnd=seaLen[seaEnd.i]+Math.hypot(seaEnd.p[0]-seaLine[seaEnd.i][0],seaEnd.p[1]-seaLine[seaEnd.i][1]);
  const widthAt=p=>{const w=nearestOn(wallLine,p.x,p.z);return w.d;};
  const lamps=[],benches=[],trees=[],pillars=[],planters=[],palms=[];
  // Rotated-footprint support: covering-cell minimum (buried toe, as the plaza foundations) and a sampled maximum, so level
  // tops never sit below the ground they cover (pillar 21 cm in the air, planter straddling a slope).
  const footprint=(x,z,heading,hw,hd)=>{const c=Math.cos(heading),s=Math.sin(heading),P=(a,b)=>[x+c*a*hw+s*b*hd,z-s*a*hw+c*b*hd];
    let top=-Infinity;for(let a=-1;a<=1.001;a+=.25)for(let b=-1;b<=1.001;b+=.25)top=Math.max(top,height(...P(a,b)));
    const ring=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>P(a,b));
    let foot;if(terrain?.nx)foot=terrainFoundation(ring,terrain,top+10).minY;else foot=Math.min(...ring.map(p=>height(...p)))-.12;
    return {top,foot};};
  // Lamps on stone bases just inside the seawall every ~14 m (Wikimedia Commons curid=80420009).
  for(let s=7;s<promEnd-4;s+=14){const p=along(s,.55);lamps.push({x:p.x,z:p.z,y:height(p.x,p.z),base:true});}
  // Park stretch (Wikimedia Commons curid=122996449): a seaward row of broad shade trees, terracotta pillars with fenced planters, palms by the wall.
  const parkFrom=seaLen.findIndex((v,i)=>seaLine[i][0]>-296&&seaLine[i][1]>176);
  for(let s=(seaLen[parkFrom]??promEnd)+5;s<promEnd-3;s+=9.5){const p=along(s,2.2);if(widthAt(p)>6)trees.push({x:p.x,z:p.z,y:height(p.x,p.z),scale:1});}
  // Wikimedia Commons curid=80420009: one big tree leaning over the seawall. Rooted 1.5 m inland so the trunk clears the coping as it bends out.
  {const p=along(40,1.5);trees.push({x:p.x,z:p.z,y:height(p.x,p.z),scale:1.15,lean:[-p.nx,-p.nz]});}
  for(const s of [(seaLen[parkFrom]??0)+14,(seaLen[parkFrom]??0)+43]){if(s>promEnd-4)continue;const p=along(s,5.4);
    const heading=Math.atan2(p.nx,p.nz),fp=footprint(p.x,p.z,heading,.49,.49);pillars.push({x:p.x,z:p.z,y:height(p.x,p.z),heading,...fp});
    const q=along(s+3.6,5.2),qh=Math.atan2(q.nx,q.nz),fq=footprint(q.x,q.z,qh,1.3,.6);planters.push({x:q.x,z:q.z,y:height(q.x,q.z),heading:qh,w:2.6,d:1.2,...fq});}
  // Palms by the wall (crowns ran 0.5–1.3 m into the fort face). Each leans away from the wall and
  // stands far enough out that its widest fronds (4.3 m, drooping 2.4 m) stay ≥0.3 m clear of the battered face below
  // the parapet top.
  const palmAt=(st,h,lean)=>{let last=null;const faceAt=y=>y<=st.base?st.dFoot:y>=st.crest?st.dTop:st.dFoot+(st.dTop-st.dFoot)*(y-st.base)/(st.crest-st.base);
    for(let v=Math.max(.7,st.verge*.6);v<st.verge+3.01;v+=.1){const d=st.dFoot+PLINTH.proud+v,[x,z]=off(st,d),y=height(x,z),low=y+h-2.4;
      last={x,z,y,height:h,radius:.2,lean,leanDir:[st.nx,st.nz],clearance:d+lean*h*.5-4.3-faceAt(Math.max(low,st.base))};
      if(low>st.walk+1.35||last.clearance>=.3)return last;}
    return last;};
  for(const k of [3,4]){const st=segs[k].stations,mid=st[Math.floor(st.length*(k===3?.35:.5))];palms.push(palmAt(mid,9.6+(k%2)*.9,.3));}
  {const st=segs[3].stations,mid=st[Math.floor(st.length*.75)];palms.push(palmAt(mid,10.4,.3));}
  // Plaza: lamp rows flanking the axis from the east (Wikimedia Commons curid=195143828); shade trees on the south side, a palm row along the north
  // side (Wikimedia Commons curid=37349529: in front of the low La Princesa buildings); terracotta pillars either side of the axis east of the fountain.
  // Rows flank the axis but stay ≥1.6 m off the mapped service road (OSM 256661398) entering the plaza at z≈241.
  const road=[[-147.74,239.92],[-162.54,241.37]];
  for(const x of [-190,-180,-170,-160])for(const s of [-1,1]){const z=234.9+s*4.3;if(!inRing(x,z,PLAZA)||segmentDistance(x,z,...road)<1.6)continue;
    lamps.push({x,z,y:height(x,z),base:false,cluster:true});}
  for(const [x,z] of [[-183,245.2],[-171,244.6],[-160,243.4],[-160,225]])if(inRing(x,z,PLAZA))trees.push({x,z,y:height(x,z),scale:1.1});
  for(const x of [-194,-183,-172]){const zEdge=x<-177.58?220.99+(x+177.58)/(-230.89+177.58)*(208.85-220.99):220.9,z=zEdge+2.4;
    if(inPaved(x,z))palms.push({x,z,y:height(x,z),height:10.2+(x%2?0:.8),radius:.2,lean:.15});}
  for(const s of [-1,1]){const x=fx+17.5,z=fz+s*6.6;if(inPaved(x,z)){const fp=footprint(x,z,Math.PI/2,.49,.49);pillars.push({x,z,y:height(x,z),heading:Math.PI/2,...fp});}}
  // Benches last, against everything else (benches stood across the promenade, one 0.6 m into the
  // seawall; the fountain's four faced sideways 0.12 m from the bollards). Local forward is (sin h, cos h), the backrest
  // behind it. A bench is kept only where its whole 1.9×0.6 m seat plus 0.25 m stands on paving and clears the seawall,
  // trunks, posts, pillars, planters, flagpoles, bollards and the basin.
  const obstacles=[...trees.map(t=>[t.x,t.z,.34*t.scale+.45]),...palms.map(p=>[p.x,p.z,p.radius+.45]),...lamps.map(l=>[l.x,l.z,(l.base?.3:.18)+.4]),
    ...pillars.map(p=>[p.x,p.z,.75]),...planters.map(p=>[p.x,p.z,1.6]),...flags.map(p=>[p.x,p.z,.9]),...bollardRing.map(b=>[b.x,b.z,.17+1.0]),[fx,fz,fr+.6+1.2]];
  const seatClear=(x,z,heading)=>{const c=Math.cos(heading),s=Math.sin(heading),corners=[];
    for(const u of [-1.2,-.4,.4,1.2])for(const d of [-.55,0,.55])corners.push([x+c*u+s*d,z-s*u+c*d]);
    return corners.every(p=>inPaved(...p)&&(()=>{const n=nearestOn(seaLine,...p),f=seaFrame[Math.min(n.i,seaFrame.length-1)];
      return n.d>f.half+.25||(p[0]-n.p[0])*f.nx+(p[1]-n.p[1])*f.nz>f.half+.25;})())
      &&obstacles.every(([ox,oz,r])=>{const lu=(ox-x)*c-(oz-z)*s,ld=(ox-x)*s+(oz-z)*c;return Math.hypot(Math.max(0,Math.abs(lu)-.95),Math.max(0,Math.abs(ld)-.3))>=r;});};
  const benchAt=(x0,z0,heading)=>{let best=null;const c=Math.cos(heading),s=Math.sin(heading);
    // Slide along the seat (and only slightly across it), so the facing and the seawall/ring clearance stay as designed.
    for(let du=-1;du<=1.0001;du+=.2)for(const dd of [0,-.15,.15]){const x=x0+c*du+s*dd,z=z0-s*du+c*dd;if(!seatClear(x,z,heading))continue;
      const legs=[-.72,.72].flatMap(u=>[-.25,.25].map(d=>height(x+c*u+s*d,z-s*u+c*d)));
      const range=Math.max(...legs)-Math.min(...legs),cost=range+.02*Math.hypot(du,dd);if(!best||cost<best.cost)best={x,z,cost,range,top:Math.max(...legs)};}
    if(!best||best.range>.24)return null;
    const legs=[-.72,.72].map(u=>({u,ground:Math.min(...[-.25,.25].map(d=>height(best.x+c*u+s*d,best.z-s*u+c*d)))}));
    return {x:best.x,z:best.z,y:best.top,legs,crossFall:best.range,heading,width:1.9,depth:.6,height:.95};};
  // Promenade: between the lamps, facing the bay (back to the walk) where the lane stays ≥2.6 m wide behind them.
  for(let s=14;s<promEnd-4;s+=14){const q=along(s,1.0);if(widthAt(q)<=4.6)continue;const b=benchAt(q.x,q.z,Math.atan2(-q.nx,-q.nz));if(b)benches.push(b);}
  // Fountain: four benches facing the basin across the bollard ring, on the transverse sides (clear of the bay-side flags,
  // the east approach and the lamp rows); 1.2 m walk between the seat and the bollards.
  for(const da of [-.45,.45])for(const side of [-1,1]){const a=seaAngle+side*Math.PI/2+da,r=fr+5.0,x=fx+Math.cos(a)*r,z=fz+Math.sin(a)*r;
    const b=benchAt(x,z,Math.atan2(fx-x,fz-z));if(b)benches.push(b);}
  for(const t of trees){const s=t.scale,lx=(t.lean?.[0]??0)*1.6*s*.09,lz=(t.lean?.[1]??0)*1.6*s*.09; // trunk axis at ~1.2 m
    prism(circle(t.x+lx,t.z+lz,.34*s+(t.lean?.12:0),10),t.y-.1,t.y+3.5);}
  for(const p of palms)prism(circle(p.x,p.z,p.radius,10),p.y-.1,p.y+4);
  for(const l of lamps)prism(circle(l.x,l.z,l.base?.3:.18,10),l.y-.1,l.y+(l.base?4.6:4.1));
  for(const b of benches){const low=Math.min(...b.legs.map(l=>l.ground))-.05;
    box(b.x,(low+b.y+b.height)/2,b.z,b.width/2,(b.y+b.height-low)/2,b.depth/2,b.heading);}
  for(const p of pillars){const top=p.top+2.8;box(p.x,(p.foot+top)/2,p.z,.42,(top-p.foot)/2,.42,p.heading);}
  for(const p of planters){const top=p.top+.62;box(p.x,(p.foot+top)/2,p.z,p.w/2,(top-p.foot)/2,p.d/2,p.heading);}
  for(const b of bollardRing)box(b.x,b.y+.4,b.z,.16,.45,.16);
  // Wikimedia Commons curid=37349529 (2010): the strip between the Raíces wall and the plaza holds a LOW building at the wall foot with the bare
  // rubble wall rising above it; La Princesa itself is low. OSM 256339011's footprint is kept, but its default
  // "2 levels" roof (16.9 m, set by the wall-crest ground inside the footprint) becomes ~6.5 m above its base.
  const buildingOverrides=new Map();
  {const b=city?.buildings?.find(b=>b.id===256339011);if(b&&b.roof-b.base>9)buildingOverrides.set(b.id,{roof:b.base+6.5,heightSource:'princesa-photo54-low-inference',colour:'#e3dccd'});}

  // ---- Ground tints: paving tone under the overlays, lawn verge/garden at the wall foot, rock seaward of the seawall,
  // masonry tone on the bare smeared scarp east of the built wall end (Wikimedia Commons curid=182263283 weathered wall continues). ----
  const tint=new Map();
  // Seams item 4: the bastion-face verge (segments 0–1) is a stone gutter band (Wikimedia Commons curid=80420009); elsewhere the planted strip.
  const GUTTER='#9a9282',verge=(x,z)=>{let near=null,nd=Infinity;for(const s of runStations){const q=(x-s.F[0])**2+(z-s.F[1])**2;if(q<nd){nd=q;near=s;}}
    return near&&near.seg<=1?GUTTER:'#5d7748';};
  if(terrain?.nx){const {x0,z0,nx,nz,step}=terrain,minX=-322,maxX=-140,minZ=88,maxZ=272;
    for(let j=Math.max(0,Math.floor((minZ-z0)/step));j<=Math.min(nz-1,Math.ceil((maxZ-z0)/step));j++)
      for(let i=Math.max(0,Math.floor((minX-x0)/step));i<=Math.min(nx-1,Math.ceil((maxX-x0)/step));i++){
        const x=x0+i*step,z=z0+j*step,key=j*nx+i,h=height(x,z);
        if(z<96&&x>-312)continue; // gate forecourt keeps its own banks
        const sea=nearestOn(seaLine,x,z),f=seaFrame[Math.min(sea.i,seaFrame.length-1)],side=(x-sea.p[0])*f.nx+(z-sea.p[1])*f.nz;
        if(sea.d<6&&side<-.1){tint.set(key,'rock');continue;}
        // Brick tone round the plaza, including the unpaved metre or two up to La Princesa's facade (Wikimedia Commons curid=37349529).
        if(brick.some(s=>x>=s.b0-3&&x<=s.b1+3&&z>=s.b2-3&&z<=s.b3+3&&(inRing(x,z,s.ring)||segmentDistanceRing(x,z,s.ring)<3))){tint.set(key,'#8f6f5d');continue;}
        // Paved vertices hide under the overlay; those near the verge edge take the verge green so the visible strip between
        // the paving and the plinth is not a pale-to-green gradient across the 2 m facets.
        if(inPaved(x,z)){tint.set(key,nearestOn(promenadeInner,x,z).d<2.2&&!brick.some(s=>inRing(x,z,s.ring))?verge(x,z):'paseo');continue;}
        // Wall-foot verge between the plinth and the paving edge reads as the planted strip of Wikimedia Commons curid=80420009, curid=122996449: the vertex
        // lies outward of its nearest station's face foot and short of that station's paving edge.
        let near=null,nd=Infinity;for(const s of runStations){const q=(x-s.F[0])**2+(z-s.F[1])**2;if(q<nd){nd=q;near=s;}}
        if(near&&nd<64){const d=(x-near.x)*near.nx+(z-near.z)*near.nz;
          if(d>near.dFoot-6&&d<near.dFoot+PLINTH.proud+near.verge+.6){tint.set(key,near.seg<=1?GUTTER:'#5d7748');continue;}} // incl. hidden toe vertices: no pale gradient
        const wall=nearestOn(wallLine,x,z);
        if(wall.d<8&&h<lowAt(x,z)+3.5&&inRing(x,z,closeRing(wallLine,seaLine))){tint.set(key,'lawn');continue;}
        const slope=Math.hypot(height(x+1,z)-height(x-1,z),height(x,z+1)-height(x,z-1))/2;
        // the bare smeared scarp where the Raíces bastion, La Princesa and the plaza meet read as pale sand.
        if(slope>.6&&x>-242&&z<216&&z>196&&!inPaved(x,z)){tint.set(key,'masonry');continue;}
        if(surfaces.some(s=>x>=s.b0-.9&&x<=s.b1+.9&&z>=s.b2-.9&&z<=s.b3+.9&&segmentDistanceRing(x,z,s.ring)<.9)){tint.set(key,'paseo');continue;}
        if(x>-182&&z>170&&z<200&&slope>.7)tint.set(key,'masonry');
      }}

  // Path: promenade lane centreline (between the lamp line and the wall-side paving edge), then round the fountain's
  // north side to the plaza's east edge (Paseo Peatonal 256661394 / service road 256661398 continue east on the DEM).
  const path=[];
  for(let s=2;s<promEnd;s+=3){const p=along(s,1.25),w=nearestOn(wallLine,p.x,p.z);
    const m=[(p.x+w.p[0])/2,(p.z+w.p[1])/2],lane=w.d>7?along(s,3.6):{x:m[0],z:m[1]};path.push([lane.x,lane.z]);}
  // Round the bollard ring's north side (Wikimedia Commons curid=37349529 ring at fr+3.3), then east along the axis between the pillars.
  path.push([-224,221.5],[-214,220.2],[fx,fz-fr-7.4],[-197,220.6],[-188,229],[-178,234.4],[-165,234.8],[-151,235.2]);
  const arrival=[-174,234.8];
  const qa=()=>({stations:stations.length,wallLength:+segs.reduce((n,g)=>n+g.L,0).toFixed(1),walls:walls.length,colliders:colliders.length,
    surfaces:surfaces.length,seawall:seaFrame.length,promenadeLength:+promEnd.toFixed(1),
    pavedWidth:(()=>{const v=inner.map(q=>q.w).sort((a,b)=>a-b);return {min:+v[0].toFixed(2),median:+v[v.length>>1].toFixed(2)};})(),
    fountain:{x:+fx.toFixed(2),z:+fz.toFixed(2),radius:+fr.toFixed(2),rimTop:+fountain.rimTop.toFixed(2),stepTop:+fountain.stepTop.toFixed(2)},
    lamps:lamps.length,benches:benches.length,trees:trees.length,palms:palms.length,garitas:garitas.length,path:path.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]),
    places:[{name:'Fuente Raíces — Paseo de la Princesa',x:arrival[0],z:arrival[1]}],
    views:[]});
  // palm trunks, flagpoles and bollard cones seated by the world's construction pass (seatRecords).
  return {seatLists:[{records:palms,radius:.2},{records:flags,radius:.07},{records:bollardRing,radius:.17,offset:-.04}],segments:segs,stations,walls,ends,colliders,tops:[],cuts,tint,surfaces,brick,floorTriangles:[],buildingOverrides,
    seaLine,seaFrame,seaTop,seaBottom,wallLine,garitas,fountain,flags,lamps,benches,trees,palms,pillars,planters,bollards:bollardRing,path,
    places:[{name:'Fuente Raíces — Paseo de la Princesa',x:arrival[0],z:arrival[1],source:344551844}],
    constants:{BATTER,PARAPET,PLINTH,RAIL,SEA},grid:terrain,qa};
}
function bounds(r){const xs=r.map(p=>p[0]),zs=r.map(p=>p[1]);return [Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];}
function segmentDistanceRing(x,z,ring){let d=Infinity;for(let i=0;i<ring.length;i++)d=Math.min(d,segmentDistance(x,z,ring[i],ring[(i+1)%ring.length]));return d;}
function closeRing(a,b){return [...a,...[...b].reverse()];}
