/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// El Morro (Castillo San Felipe del Morro) exterior — © 2026 VibezZzCoder, MIT. Fort outline, entrance node, bridge,
// lighthouse, Calle del Morro, moat lawns and benches: OSM / ODbL; heights: USGS DEM. Wikimedia Commons curid=72603185, curid=122907842, curid=123485577, curid=148962402, curid=148962401, curid=34389396, curid=34389747, curid=136301888 guide forms;
// dimensions are authored inferences. Shared physical/render owner: sj-fort.js draws
// exactly these numbers. The DEM stays the ground everywhere except the render-only cut inside the bridge body.
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {subtractRing,signedArea} from './sj-paving.js';
import {seamsFlight,minusConvex} from './sj-seams-geo.js';
import {registerStairFlights,rowBreaks,stairRecord} from './sj-stairs.js';

// OSM 561634537 (historic=castle), mapped vertex order: (−uz,ux) of every edge points out of the fort.
export const FORT_OUTLINE=[[-815.57,-499.70],[-798.59,-505.67],[-774.71,-492.79],[-759.61,-535.91],[-779.22,-550.91],
  [-761.96,-571.09],[-760.73,-573.18],[-758.87,-575.22],[-757.20,-577.26],[-758.14,-577.94],[-743.44,-594.04],[-723.63,-576.66],
  [-683.07,-597.09],[-708.79,-619.18],[-708.07,-640.71],[-705.01,-645.96],[-701.31,-652.71],[-711.94,-655.18],[-718.37,-655.54],
  [-718.64,-647.06],[-734.52,-645.60],[-765.55,-647.93],[-774.62,-662.57],[-799.16,-655.65],[-846.65,-683.16],[-849.92,-682.62],
  [-858.24,-689.05],[-863.71,-685.24],[-867.55,-680.39],[-869.95,-675.18],[-871.43,-670.07],[-871.90,-664.53],[-872.03,-659.94],
  [-870.13,-660.14],[-864.23,-657.08],[-865.25,-651.23],[-849.35,-640.69],[-845.95,-625.30],[-839.22,-609.55],[-841.93,-598.97],
  [-845.07,-588.70],[-838.12,-586.86],[-842.65,-572.14],[-849.85,-565.82],[-843.06,-557.94],[-835.85,-552.76],[-829.17,-546.44],
  [-823.85,-537.60],[-825.77,-534.74],[-830.53,-534.35],[-830.18,-533.80],[-826.39,-533.39],[-829.53,-531.66],[-828.81,-529.55],
  [-825.27,-529.83],[-822.47,-513.49],[-821.45,-513.78],[-820.81,-510.68],[-817.26,-499.83]];
// Fitted fronts (2 m station survey, docs): the land front 0→14 (south bastion, curtain with the main entrance node
// 741560515 = vertex 6, north bastion; the ≤1.1 m curtain jog 5/7/8/9 is dropped) and the Atlantic front 16→23 both
// stand 5–18 m over toes within ~2 m of the mapped line. Not fitted here: 23→24 runs into the NW tip's tiered batteries,
// which the DEM holds only as a hill (a 20 m face there ended as a tall wedge); the bay side 34→58 sits low on one
// continuous bank (no toe within 9 m: Wikimedia Commons curid=148962401's green slope); the 2.5 m water battery 25→34 abuts the paseo strip.
// Mapped public ways that pass a run end (OSM 1179846717, 1179846718, 1179846716; footway width 2.2 m).
// Mapped paved ways over the moat band (OSM 1385141771 concrete footway, the lower 2 m of steps 1385141770).
const PAVED_WAYS=[[[-738.8,-548.1],[-736.45,-545.56],[-737.04,-543.65]]];
const PUBLIC_WAYS=[[[-681.43,-598.39],[-681.62,-597.05],[-681.73,-595.96],[-681.8,-594.9],[-682.2,-594.1],[-683.2,-591.9]]];
const RUNS=[{name:'land',ids:[0,1,2,3,4,6,10,11,12,13,14]},{name:'north',ids:[16,17,18,19,20,21,22,23]}];
export const FORT_GATE=FORT_OUTLINE[6];
const LIGHTHOUSE=[-729.55,-611.96];                                  // OSM 4124264489 Faro Castillo del Morro
const TURNING=[-726.53,-537.70];                                     // OSM 239008745, end of Calle del Morro
// OSM 59745018 Calle del Morro (pedestrian, concrete, 5 m) across the esplanade (Wikimedia Commons curid=148962402, curid=148962401: the pale straight path).
const CALLE=[[-475.436,-313.911],[-561.357,-392.068],[-714.936,-531.327],TURNING];
const BENCHES=[[-731.53,-526.63],[-726.97,-525.21]];                 // OSM 5415318077/5415318080 (no backrest)
// OSM 410617401 / 410617400: lawns either side of the bridge (moat floor; north terrace). Wikimedia Commons curid=34389396, curid=34389747: grass floor.
const MOAT_LAWNS=[[[-779.22,-550.91],[-761.96,-571.09],[-758.58,-567.97],[-757.48,-564.99],[-741.10,-550.72],[-738.80,-548.10],
  [-759.61,-535.91]],[[-758.87,-575.22],[-733.44,-552.25],[-729.62,-552.21],[-725.31,-554.52],[-705.36,-564.31],[-684.91,-574.59],
  [-683.07,-597.09],[-723.63,-576.66],[-743.44,-594.04],[-758.14,-577.94]]];
const BATTER=1/6;                         // Wikimedia Commons curid=34389396, curid=123485577: steeper than the city wall's 1/7 batter
const PARAPET={thick:.8,rise:1.0,cordon:.3};
const SPACING=2,PLINTH={proud:.12,rise:.5};
// Wikimedia Commons curid=72603185: tall square merlons with narrow embrasures on the land front (Wikimedia Commons curid=123485577: sloped embrasures seaward).
export const MERLON={length:2.9,gap:1.0,rise:.85};
// Wikimedia Commons curid=122907842 near-frontal crop (deck line ≈690 px): opening 178 px ≈ 2.8 m sets 63.6 px/m → body 8 m, cornice 9.3 m; segmental
// arch springing 2.67 m with 0.8 m rise; architrave 5.95, frieze 6.3–6.85, cornice top 7.15, apex 9.4 m over the bridge.
export const ENTRANCE={half:4.0,proud:.5,openHalf:1.4,spring:2.67,rise:.8,depth:.6,door:.3,pilasters:[2.0,3.05],pilasterHalf:.42,
  architrave:5.95,frieze:6.3,cornice:7.15,apex:9.4};
// Wikimedia Commons curid=34389747, curid=122907842: arched masonry bridge across the dry moat; clear deck and parapets inferred from the opening/proportions.
export const BRIDGE={half:2.3,wall:.55,parapet:1.0,arch:2.8,pier:1.3,band:2.5};
// Moat bands (Wikimedia Commons curid=34389747): the smeared DEM ridge flank buried the bridge arches as pale spikes. Beside each moat face a
// 3.2 m band is cut and replaced — drawn and physical — by the moat floor, meeting the kept terrain exactly.
const MOAT_BAND=3.2;
// Run ends turn 7 m back into the fort (a masonry return): the cap sinks into the plateau instead of standing as a slab.
const RETURN=7;
const FOOTWAY=[[-662.229,-584.134],[-661.068,-582.85],[-722.941,-548.871]]; // OSM 1179846713 along the north moat terrace

function intersect(p,t,q,r) {
  const det=t[0]*r[1]-t[1]*r[0];
  if(Math.abs(det)<.12)return null;
  const k=((q[0]-p[0])*r[1]-(q[1]-p[1])*r[0])/det;return [p[0]+t[0]*k,p[1]+t[1]*k];
}

// Battered rampart fitted to the shared DEM, one run at a time. Same rules as the accepted Paseo del Morro extension
// (sj-gate-layout.js): owned samples only, robust plateau, toe search, seven-line DEM cover, slope-limited envelopes,
// crossing-polyline corners and bottoms below the actual DEM at every face foot.
// opts (city walls): {batter, thick, cordon, spacing, inner}; omitted values keep El Morro's constants exactly.
// inner: how far (m) the wall walk may reach back from the crest to meet the kept ground (El Morro 3.5).
export function fitRun(points,height,opts={}) {
  const BATTER_=opts.batter??BATTER,THICK=opts.thick??PARAPET.thick,CORDON=opts.cordon??PARAPET.cordon,SPACING_=opts.spacing??SPACING,INNER=opts.inner??3.5;
  const segs=[];
  {let s0=0;for(let i=0;i+1<points.length;i++){const a=points[i],b=points[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;segs.push({a,b,L,ux,uz,nx:-uz,nz:ux,s0});s0+=L;}}
  for(const [k,g] of segs.entries()){const n=Math.max(1,Math.ceil(g.L/SPACING_));g.stations=[];
    for(let j=0;j<=n;j++){const t=g.L*j/n;g.stations.push({x:g.a[0]+g.ux*t,z:g.a[1]+g.uz*t,t,s:g.s0+t,seg:k,nx:g.nx,nz:g.nz});}}
  const sample=(s,d)=>height(s.x+s.nx*d,s.z+s.nz*d),off=(s,d)=>[s.x+s.nx*d,s.z+s.nz*d];
  const box=g=>({minX:Math.min(g.a[0],g.b[0]),maxX:Math.max(g.a[0],g.b[0]),minZ:Math.min(g.a[1],g.b[1]),maxZ:Math.max(g.a[1],g.b[1])});
  const near=segs.map((g,k)=>{const A=box(g);return segs.map((h,j)=>j).filter(j=>{if(j===k)return false;const B=box(segs[j]);
    return Math.max(B.minX-A.maxX,A.minX-B.maxX,B.minZ-A.maxZ,A.minZ-B.maxZ)<22;});});
  // No neighbouring segment within 22 m: every sample is owned (same answer as the empty every, without the distances).
  const owns=(s,d)=>{const nr=near[s.seg];if(!nr.length)return true;const [x,z]=off(s,d),mine=segmentDistance(x,z,segs[s.seg].a,segs[s.seg].b);
    return nr.every(j=>segmentDistance(x,z,segs[j].a,segs[j].b)+.25>=mine);};
  for(const g of segs)for(const s of g.stations){
    const plateau=[];for(let d=-6;d<=0;d+=.25)if(owns(s,d))plateau.push(sample(s,d));
    plateau.sort((p,q)=>p-q);let top=plateau.length?plateau[Math.floor(plateau.length*.7)]:sample(s,0);
    if(owns(s,-6)&&sample(s,-6)-sample(s,-4)>.8){const far=[];
      for(let d=-12;d<=-5;d+=.25)if(owns(s,d))far.push(sample(s,d));far.sort((p,q)=>p-q);
      if(far.length)top=Math.max(top,far[Math.floor(far.length*.7)]);}
    // Toe: first point outward where the next metre falls less than 0.32 m (below the crest band on tall faces; the
    // first flattening on low faces, whose toe never drops 2.5 m under the crest). OSM traces the fort's wall foot and the
    // survey's toes lie 0–4 m out, so the search stops at 4 m: beyond, the natural coastal bank stays DEM below the face
    // (the paseo's 9 m search stood a 13 m face on the Atlantic bank at x≈−715).
    const low=top-sample(s,0)<3;let foot=-1;
    for(;foot<4;foot+=.125){const h=sample(s,foot);if(!owns(s,foot+1)||(low||h<top-2.5)&&h-sample(s,foot+1)<.32)break;}
    const ground=sample(s,foot),base=ground,tolerance=PLINTH.rise*.6;
    let need=-6;
    for(const dt of [-1,-.67,-.33,0,.33,.67,1]){if(s.t+dt<0||s.t+dt>g.L)continue;const q={...s,x:s.x+g.ux*dt,z:s.z+g.uz*dt};
      // Reach 3.2 m past the toe (the paseo's 2.5 m left a 6 cm DEM lip at 2.9 m before the north bastion's low corner).
      for(let d=-8;d<=Math.max(foot,0)+3.2+.001;d+=.125){if(!owns(q,d))continue;const h=sample(q,d);if(h>base+tolerance)need=Math.max(need,d+(h-base)*BATTER_);}}
    Object.assign(s,{top,ground,base,need:need+.05,full:true});
  }
  // A level terreplein does not dip at its salient (the 2 m DEM smears narrow tips low). El Morro's fronts step between
  // tiers, so the paseo's along-wall slope limit would lift whole lower batteries (12–17 m in the first fit): instead a
  // closing fills only dips narrower than ~10 m — a station rises to the lower of the highest crests within 5 m each side.
  {const st=segs.flatMap(g=>g.stations),base0=st.map(s=>s.top);
    st.forEach((s,i)=>{let left=-Infinity,right=-Infinity;
      for(let j=i-1;j>=0&&s.s-st[j].s<=5;j--)left=Math.max(left,base0[j]);
      for(let j=i+1;j<st.length&&st[j].s-s.s<=5;j++)right=Math.max(right,base0[j]);
      s.top=Math.max(base0[i],Math.min(left,right));s.lifted=s.top-base0[i];});}
  for(const g of segs){const st=g.stations,d=st.map(s=>s.need);
    for(let pass=0;pass<2;pass++){for(let i=1;i<st.length;i++)d[i]=Math.max(d[i],d[i-1]-.25*(st[i].t-st[i-1].t));
      for(let i=st.length-2;i>=0;i--)d[i]=Math.max(d[i],d[i+1]-.25*(st[i+1].t-st[i].t));}
    st.forEach((s,i)=>s.dFoot=d[i]);}
  for(const g of segs){
    for(const s of g.stations){const base=Math.min(s.base,sample(s,s.dFoot)),crest=s.top+.06-CORDON,dTop=s.dFoot-(crest-base)*BATTER_;
      let dIn=dTop;for(;dIn>dTop-INNER;dIn-=.125)if(!owns(s,dIn-.125)||sample(s,dIn)>=s.top-.12)break;
      s.dIn=dIn-.3;}
    const st=g.stations,d=st.map(s=>-s.dIn);
    for(let pass=0;pass<2;pass++){for(let i=1;i<st.length;i++)d[i]=Math.max(d[i],d[i-1]-.35*(st[i].t-st[i-1].t));
      for(let i=st.length-2;i>=0;i--)d[i]=Math.max(d[i],d[i+1]-.35*(st[i+1].t-st[i].t));}
    st.forEach((s,i)=>s.dIn=-d[i]);
  }
  for(const g of segs)for(const s of g.stations){
    const base=Math.min(s.base,sample(s,s.dFoot)),crest=s.top+.06-CORDON,dTop=s.dFoot-(crest-base)*BATTER_,dIn=s.dIn;
    let cover=-Infinity;for(let q=dIn;q<=dTop;q+=.125)cover=Math.max(cover,sample(s,q));
    const bottom=Math.min(base,sample(s,s.dFoot+PLINTH.proud))-.4,dBot=s.dFoot+(base-bottom)*BATTER_;
    Object.assign(s,{base,crest,dTop,dIn,bottom,walk:Math.max(s.top+.06,cover+.04),
      F:off(s,s.dFoot),B:off(s,dBot),L:off(s,s.dFoot+PLINTH.proud),LB:off(s,dBot+PLINTH.proud),T:off(s,dTop),
      C:off(s,dTop+.22),Q:off(s,dTop-THICK),W:off(s,dIn)});
  }
  const segHit=(a,b,c,d)=>{const den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]);if(Math.abs(den)<1e-12)return null;
    const t=((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den,u=((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))/den;
    return t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9?[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]:null;};
  for(let k=0;k+1<segs.length;k++){
    const A=segs[k].stations,B=segs[k+1].stations;
    for(const key of ['F','B','L','LB','T','C','Q','W']){
      let hit=null;
      for(let i=A.length-2;i>=Math.max(0,A.length-10)&&!hit;i--)for(let j=0;j<Math.min(B.length-1,10)&&!hit;j++){
        const x=segHit(A[i][key],A[i+1][key],B[j][key],B[j+1][key]);if(x&&!(i===A.length-2&&j===0&&Math.hypot(x[0]-A.at(-1)[key][0],x[1]-A.at(-1)[key][1])<1e-9))hit={i,j,x};}
      if(hit){for(let m=hit.i+1;m<A.length;m++)A[m][key]=[...hit.x];for(let m=0;m<=hit.j;m++)B[m][key]=[...hit.x];continue;}
      const ta=[A.at(-1)[key][0]-A.at(-2)[key][0],A.at(-1)[key][1]-A.at(-2)[key][1]],tb=[B[1][key][0]-B[0][key][0],B[1][key][1]-B[0][key][1]];
      const la=Math.hypot(...ta),lb=Math.hypot(...tb),mid=[(A.at(-1)[key][0]+B[0][key][0])/2,(A.at(-1)[key][1]+B[0][key][1])/2];
      let x=(la>1e-9&&lb>1e-9?intersect(A.at(-1)[key],[ta[0]/la,ta[1]/la],B[0][key],[tb[0]/lb,tb[1]/lb]):null)??mid;
      if(Math.hypot(x[0]-A.at(-1)[key][0],x[1]-A.at(-1)[key][1])>2.5||Math.hypot(x[0]-B[0][key][0],x[1]-B[0][key][1])>2.5)x=mid;
      A.at(-1)[key]=x;B[0][key]=[...x];
      const sa=segs[k],sb=segs[k+1],along=(p,g)=>(p[0]-g.a[0])*g.ux+(p[1]-g.a[1])*g.uz;
      for(const q of A)if(along(q[key],sa)>along(x,sa))q[key]=[...x];
      for(const q of B)if(along(q[key],sb)<along(x,sb))q[key]=[...x];
    }
    const a=A.at(-1),b=B[0];
    for(const key of ['crest','walk'])a[key]=b[key]=Math.max(a[key],b[key]);
    a.bottom=b.bottom=Math.min(a.bottom,b.bottom);a.corner=b.corner=k+1;
  }
  const lerp=(p,q,t)=>Array.isArray(p)?[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]:p+(q-p)*t;
  const NUM=['x','z','s','t','top','ground','base','crest','walk','dFoot','dTop','dIn'],KEYS=['F','B','L','LB','T','C','Q','W'];
  for(const g of segs){const out=[];
    g.stations.forEach((a,i)=>{out.push(a);const b=g.stations[i+1];if(!b)return;
      const span=Math.max(...['F','T','B'].map(key=>Math.hypot(b[key][0]-a[key][0],b[key][1]-a[key][1]))),n=span>1.8*SPACING_?Math.ceil(span/SPACING_):1;
      for(let j=1;j<n;j++){const t=j/n,q={seg:a.seg,nx:a.nx,nz:a.nz,full:true,inserted:true};
        for(const key of [...NUM,...KEYS])q[key]=lerp(a[key],b[key],t);q.bottom=Math.min(a.bottom,b.bottom);out.push(q);}});
    g.stations=out;}
  for(const g of segs)for(const s of g.stations)s.bottom=Math.min(s.bottom,height(...s.F)-.4,height(...s.B)-.4,height(...s.L)-.4);
  const stations=segs.flatMap(g=>g.stations);
  for(const s of stations)s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);
  return {segs,stations};
}

// Wall-body colliders for one fitted interval. Walk support only from the parapet line
// inward ([T..W]); the battered face as three stepped, non-support prisms flush with the face at 25/50/75 % of its run
// from the foot. The earlier [B..W] walk-level prism left an invisible ledge outside every parapet that ordinary crash
// recovery used (25 reproduced recoveries at the gate, El Morro, San Cristóbal and the Princesa).
export function wallBody(prism,a,b,bottom,walk,...tag){
  prism([a.T,b.T,b.W,a.W],bottom,walk,true,...tag);
  const F=(s,f)=>[s.B[0]+(s.T[0]-s.B[0])*f,s.B[1]+(s.T[1]-s.B[1])*f];
  for(const f of [.25,.5,.75]){const y=Math.min(a.bottom+(a.crest-a.bottom)*f,b.bottom+(b.crest-b.bottom)*f);
    if(y>bottom+.05)prism([F(a,f),F(b,f),b.T,a.T],bottom,Math.min(y,walk));}
}

export function createFortLayout({height,terrain,surface,paseo}) {
  const colliders=[];
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  // n=(−uz,ux) points out of the fort, so each return runs along −n from its end and faces along the run.
  const withReturns=pts=>{const dir=(a,b)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
    const [ux0,uz0]=dir(pts[0],pts[1]),[ux1,uz1]=dir(pts.at(-2),pts.at(-1));
    return [[pts[0][0]+uz0*RETURN,pts[0][1]-ux0*RETURN],...pts,[pts.at(-1)[0]+uz1*RETURN,pts.at(-1)[1]-ux1*RETURN]];};
  const runs=RUNS.map(r=>({name:r.name,...fitRun(withReturns(r.ids.map(i=>FORT_OUTLINE[i])),height)}));
  const land=runs[0],gateSeg=RUNS[0].ids.indexOf(6)+1,gateS=land.segs[gateSeg].s0;

  // Entrance frame: u inward (−mean outward normal of the curtain either side of the mapped entrance), v along it.
  const g0=land.segs[gateSeg-1],g1=land.segs[gateSeg],mx=g0.nx+g1.nx,mz=g0.nz+g1.nz,ml=Math.hypot(mx,mz),ax=-mx/ml,az=-mz/ml,px=-az,pz=ax;
  const P=(u,v)=>[FORT_GATE[0]+ax*u+px*v,FORT_GATE[1]+az*u+pz*v];
  const UV=(x,z)=>{const dx=x-FORT_GATE[0],dz=z-FORT_GATE[1];return [dx*ax+dz*az,dx*px+dz*pz];};
  for(const s of land.stations)s.v=UV(s.x,s.z)[1];
  const portalStations=land.stations.filter(s=>Math.abs(s.v)<ENTRANCE.half+1.3&&Math.abs(s.s-gateS)<7);
  const uFoot=Math.min(...portalStations.map(s=>UV(...s.F)[0])),uFront=uFoot-ENTRANCE.proud;
  const uBack=Math.max(...portalStations.map(s=>UV(...s.T)[0]))+.05;

  // Bridge (OSM 410617399, sett) on the entrance axis, which is within 4° of the mapped line. It starts where the esplanade
  // is still level a body-width either side (the moat wraps round the bridge head: survey) and ends at the entrance front.
  const outerHalf=BRIDGE.half+BRIDGE.wall,centreRef=height(...P(uFront-60,0));
  let uStart=uFront-8;
  for(let u=uFront-8;u>uFront-60;u-=.25){const ys=[-outerHalf-1.5,-outerHalf,0,outerHalf,outerHalf+1.5].map(v=>height(...P(u,v)));
    if(Math.min(...ys)>=Math.max(...ys)-.45&&ys[2]>centreRef-1.5){uStart=u;break;}}
  const across=[-BRIDGE.half-BRIDGE.wall,-1.15,0,1.15,BRIDGE.half+BRIDGE.wall];
  const startRow=across.map(v=>{const [x,z]=P(uStart-.03,v);return [x,height(x,z)+.015,z];});
  const deckY=Math.max(...startRow.map(p=>p[1]));
  const rows=[[uStart-.03,startRow]];
  for(let u=uStart+1.5;u<uFront+.02-1e-6;u+=Math.max(2,(uFront-uStart)/14))rows.push([u,across.map(v=>{const [x,z]=P(u,v);return [x,deckY,z];})]);
  // The deck runs on under the 0.3 m door recess to the closed leaves: the DEM's 8 m-in-4 m wall smear otherwise rose
  // through the recess as a thin diagonal sliver in front of the doors.
  const uDoor=uFront+ENTRANCE.door;
  rows.push([uFront+.02,across.map(v=>{const [x,z]=P(uFront+.02,v);return [x,deckY,z];})]);
  rows.push([uDoor+.005,across.map(v=>{const [x,z]=P(uDoor+.005,v);return [x,deckY,z];})]);
  const tops=[],deckTriangles=[];
  for(let r=0;r+1<rows.length;r++){const A=rows[r][1],B=rows[r+1][1];
    for(let i=0;i+1<A.length;i++)for(const tri of [[A[i],B[i+1],B[i]],[A[i],A[i+1],B[i+1]]]){
      deckTriangles.push(tri);
      const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      // The deck replaces the smeared DEM ridge it covers (render cut below), so riders keep the deck level over the dip.
      tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:Math.max(p[1],q[1],w[1]),plane:{x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny},
        replacesTerrain:true,maxReferenceY:Math.max(p[1],q[1],w[1])+BRIDGE.band,surface:'pavement',source:'fort:bridge'});
    }}
  // Side walls: per 2 m interval, from below the outer DEM to a parapet 1 m over the deck, or 12 cm over a higher bank
  // (the north terrace, Wikimedia Commons curid=122907842's grass beyond the low wall). Arched moat faces where the floor lies ≥3 m below (Wikimedia Commons curid=34389747).
  const sides=[];
  for(const s of [-1,1]){const list=[];
    for(let u=uStart;u<uFront-1e-6;){const u1=Math.min(uFront,u+2);
      const outer=[u,(u+u1)/2,u1].map(q=>height(...P(q,s*(outerHalf+.06)))),inner=[u,u1].map(q=>height(...P(q,s*(BRIDGE.half-.05))));
      const ground=Math.min(...outer),top=Math.max(deckY+BRIDGE.parapet,Math.max(...outer)+.12);
      const collider=prism([P(u,s*BRIDGE.half),P(u1,s*BRIDGE.half),P(u1,s*outerHalf),P(u,s*outerHalf)].map(p=>p),Math.min(ground,deckY)-.45,top);
      list.push({u0:u,u1,ground,bottom:Math.min(ground,...inner,deckY)-.45,top,collider});
      u=u1;}
    // each 2 m interval had its own level top, so the coping stepped up to 0.28 m with open
    // risers and read as floating shelves. Joints now share one height (the higher neighbour), so the coping is one
    // continuous sloping strip that is never lower than its own interval's requirement.
    list.forEach((g,i)=>{g.topA=Math.max(g.top,list[i-1]?.top??g.top);g.topB=Math.max(g.top,list[i+1]?.top??g.top);
      if(g.collider)g.collider.maxY=Math.max(g.topA,g.topB);delete g.collider;});
    sides.push({side:s,list});}
  // Moat bands: contiguous intervals whose outer floor lies ≥1.5 m under the deck. Exact terrain polyline along each cut
  // line (crossings of grid lines and the b–c diagonals of the shared triangles), so the band and kept terrain share edges.
  const profile=(a,b)=>{const {x0,z0,step}=terrain,ts=new Set([0,1]),dx=b[0]-a[0],dz=b[1]-a[1];
    const add=(f0,df,c0)=>{if(Math.abs(df)<1e-12)return;const lo=Math.min(f0,f0+df),hi=Math.max(f0,f0+df);
      for(let k=Math.ceil((lo-c0)/step);c0+k*step<=hi+1e-9;k++){const t=(c0+k*step-f0)/df;if(t>1e-9&&t<1-1e-9)ts.add(t);}};
    add(a[0],dx,x0);add(a[1],dz,z0);add(a[0]+a[1],dx+dz,x0+z0);
    return [...ts].sort((p,q)=>p-q).map(t=>{const x=a[0]+dx*t,z=a[1]+dz*t;return {t,x,z,y:height(x,z)};});};
  const bands=[],bandTriangles=[],bandSkirts=[],cuts=[];
  const box4=(c,planes)=>({planes,ring:c,minX:Math.min(...c.map(p=>p[0])),maxX:Math.max(...c.map(p=>p[0])),minZ:Math.min(...c.map(p=>p[1])),maxZ:Math.max(...c.map(p=>p[1]))});
  const uPlane=(u,sign)=>[sign*ax,0,sign*az,-sign*(ax*FORT_GATE[0]+az*FORT_GATE[1])-sign*u];   // inside ⇔ sign·(u−U)>0
  const vPlane=(v,sign)=>[sign*px,0,sign*pz,-sign*(px*FORT_GATE[0]+pz*FORT_GATE[1])-sign*v];
  for(const {side,list} of sides){let start=null;
    // Every outer sample low: an interval with one low end at the bridge head dug the band into esplanade-level ground.
    const moat=l=>Math.max(...[l.u0,(l.u0+l.u1)/2,l.u1].map(u=>height(...P(u,side*(outerHalf+MOAT_BAND)))))<deckY-1.5;
    for(let i=0;i<=list.length;i++){const ok=i<list.length&&moat(list[i]);
      if(ok&&start===null)start=i;
      if(!ok&&start!==null){bands.push({side,ua:list[start].u0,ub:list[i-1].u1,items:list.slice(start,i)});start=null;}}}
  for(const band of bands){const {side,ua,ub}=band,vIn=side*outerHalf,vOut=side*(outerHalf+MOAT_BAND);
    const edge=profile(P(ua,vOut),P(ub,vOut)),floor=Math.min(...edge.map(p=>p.y));band.floor=floor;
    for(const l of band.items)l.bottom=Math.min(l.bottom,floor-.35);
    for(let i=0;i+1<edge.length;i++){const a=edge[i],b=edge[i+1],ia=P(ua+(ub-ua)*a.t,vIn),ib=P(ua+(ub-ua)*b.t,vIn);
      const A=[a.x,a.y,a.z],B=[b.x,b.y,b.z],IA=[ia[0],floor,ia[1]],IB=[ib[0],floor,ib[1]];
      bandTriangles.push(side>0?[IA,A,B]:[IA,B,A],side>0?[IA,B,IB]:[IA,IB,B]);}
    // End skirts: from the band floor's end edge up to the exact kept terrain along each end line.
    for(const [u,dir] of [[ua,-1],[ub,1]]){const prof=profile(P(u,vIn),P(u,vOut)),out=[];
      const yOut=height(...P(u,vOut));
      for(const q of prof){const f=floor+(yOut-floor)*q.t;out.push([[q.x,f,q.z],[q.x,Math.max(f,q.y),q.z]]);}
      bandSkirts.push({dir,side,rows:out});}
    cuts.push(box4([P(ua,vIn),P(ub,vIn),P(ub,vOut),P(ua,vOut)],[uPlane(ua,1),uPlane(ub,-1),vPlane(Math.min(vIn,vOut),1),vPlane(Math.max(vIn,vOut),-1)]));
  }
  // Physical band floor: replacement tops (the moat grass under the bridge arches).
  // Stairs the mapped concrete footway 1385141771 and the foot of steps 1385141770 cross the band; there the band
  // is paved (drawn in the paving tone and physically pavement: grass's rolling resistance stalled a slow climb).
  // A triangle is paved where the 2.2 m footway corridor touches it (a 0.2 m lattice of corridor points, ±1.1 m across).
  const corridor=[];for(const l of PAVED_WAYS)for(let k=0;k+1<l.length;k++){const a=l[k],b=l[k+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
    for(let t=0;t<=L+1e-9;t+=.2)for(let v=-1.1;v<=1.1001;v+=.2)corridor.push([a[0]+ux*t-uz*v,a[1]+uz*t+ux*v]);}
  const inTri=(x,z,t)=>{const c=(p,q)=>(q[0]-p[0])*(z-p[2])-(q[2]-p[2])*(x-p[0]),d1=c(t[0],t[1]),d2=c(t[1],t[2]),d3=c(t[2],t[0]);return (d1>=0&&d2>=0&&d3>=0)||(d1<=0&&d2<=0&&d3<=0);};
  // OSM 1385141770 traverses the bank obliquely: the 2 m width crosses almost 2 m of
  // elevation at the head. Set the steps between level turning pads on the mapped line,
  // then connect the two side approaches to the pads, rather than fitting across the bank.
  const stairs=[],shoulderFinish=new Map();
  {
    const a=[-736.45,-545.562],b=[-738.468,-539.043],len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
    const at=(u,s)=>[a[0]-dz*u+dx*s,a[1]+dx*u+dz*s],sOf=(x,z)=>(x-a[0])*dx+(z-a[1])*dz;
    const bank=(x,z)=>{for(const t of bandTriangles)if(inTri(x,z,t)){
        const [p,q,r]=t,A=q[0]-p[0],B=q[2]-p[2],C=r[0]-p[0],D=r[2]-p[2],det=A*D-B*C;
        if(Math.abs(det)>1e-9)return p[1]+((x-p[0])*D-(z-p[2])*C)/det*(q[1]-p[1])+(A*(z-p[2])-B*(x-p[0]))/det*(r[1]-p[1]);}
      return height(x,z);};
    const yf=bank(...a),yt=bank(...b),f=seamsFlight({a,b,s0:1.4,run:len-2.8,width:2,yf,yt,n:12,
      ground:(x,z)=>sOf(x,z)<len/2?yf:yt,footApron:1.4,topApron:1.4,source:'fort:moat-stair'});
    f.record=stairRecord(f.fl,{samples:192,reach:0});
    // Four trapezoidal shoulders join the actual band/DEM around the two pads. At the long
    // sides their inner edges follow the physical stair edge. Close the exposed vertical
    // inside face down past the tread: a smooth edge stands above the bay between noses.
    const corners=[[1,0],[1,len],[-1,len],[-1,0]],outer=[[2.5,-.9],[2.5,len+1.5],[-2.5,len+1.5],[-2.5,-.9]];
    const ring=outer.map(p=>at(...p)),shoulders=[],saved=bandTriangles.slice();
    for(let i=0;i<4;i++){const j=(i+1)%4,p=corners[i],q=corners[j],v=outer[i],w=outer[j],lerp=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t);
      const row=(t,k)=>{const [u,s]=lerp(lerp(p,q,t),lerp(v,w,t),k),[x,z]=at(u,s),inner=lerp(p,q,t),out=at(...lerp(v,w,t));
        // Carry level pad shoulders past the rider hull before the bank climbs away.
        const shelf=.25*Math.max(0,Math.min(1,2-inner[1]));
        const mix=Math.max(0,(k-shelf)/(1-shelf));
        return [x,f.fl.support(inner[0],inner[1]-1.4)*(1-mix)+bank(...out)*mix,z];};
      const breaks=[0,1,...rowBreaks((t)=>at(...lerp(v,w,t)),0,1,0,terrain)];
      // The outer edge can also cross a band facet; meet that actual piecewise line.
      const A=at(...v),B=at(...w),dx=B[0]-A[0],dz=B[1]-A[1];
      for(const tri of saved)for(let k=0;k<3;k++){const p=tri[k],q=tri[(k+1)%3],ex=q[0]-p[0],ez=q[2]-p[2],det=dx*ez-dz*ex;if(Math.abs(det)<1e-10)continue;
        const px=p[0]-A[0],pz=p[2]-A[1],t=(px*ez-pz*ex)/det,h=(px*dz-pz*dx)/det;if(t>0&&t<1&&h>=0&&h<=1)breaks.push(t);}
      const N=Math.ceil(Math.hypot(v[0]-w[0],v[1]-w[1])/.18);for(let n=1;n<N;n++)breaks.push(n/N);
      const ts=[...new Set(breaks)].sort((a,b)=>a-b);
      for(let k=1;k<ts.length;k++){const t=ts[k-1],T=ts[k];if(T-t<1e-7)continue;
        const A=row(t,0),B=row(T,0),M=row(t,.25),N=row(T,.25),C=row(T,1),D=row(t,1),pair=[[A,B,N],[A,N,M],[M,N,C],[M,C,D]];
        const s=lerp(p,q,(t+T)/2)[1];for(const tri of pair)shoulderFinish.set(tri,s<1.4||s>len-1.4);
        shoulders.push(...pair);
        if(i%2===0)(f.edgeFaces??=[]).push({a:A,b:B,normal:[dz,0,-dx]});}}
    bandTriangles.length=0;for(const tri of saved){const p=tri.map(v=>[v[0],v[2]]);
      if(subtractRing(p,ring)[0]===p){bandTriangles.push(tri);continue;}
      for(const poly of minusConvex(tri,ring))for(let j=1;j+1<poly.length;j++)bandTriangles.push([poly[0],poly[j],poly[j+1]]);}
    bandTriangles.push(...shoulders);
    const sign=Math.sign(signedArea(ring));cuts.push({...f.cut,ring,minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),
      minZ:Math.min(...ring.map(p=>p[1])),maxZ:Math.max(...ring.map(p=>p[1])),planes:ring.map((p,i)=>{const q=ring[(i+1)%4],x=sign*(p[1]-q[1]),z=sign*(q[0]-p[0]);return [x,0,z,-x*p[0]-z*p[1]];}),tight:true});
    stairs.push({name:'1385141770',...f,low:yf-.2});tops.push(...f.tops);
    registerStairFlights('fort',[f.record]);
  }
  const bandPaved=bandTriangles.map(t=>shoulderFinish.get(t)??corridor.some(([x,z])=>inTri(x,z,t)));
  for(const [ti,tri] of bandTriangles.entries()){const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(Math.abs(ny)<1e-9)continue;
    tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:Math.max(p[1],q[1],w[1]),plane:{x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny},
      replacesTerrain:true,maxReferenceY:Math.max(p[1],q[1],w[1])+BRIDGE.band,surface:bandPaved[ti]?'pavement':'grass',source:'fort:moat'});}
  // Side wall bodies down to below the band floor (the interval prisms above used the flank's DEM).
  for(const band of bands)for(const l of band.items)prism([P(l.u0,band.side*BRIDGE.half),P(l.u1,band.side*BRIDGE.half),P(l.u1,band.side*outerHalf),P(l.u0,band.side*outerHalf)],l.bottom,deckY-.2);
  const arches=[];
  for(const {side,list} of sides){const len=uFront-uStart,n=Math.floor((len-BRIDGE.pier)/(BRIDGE.arch+BRIDGE.pier));
    const first=uStart+(len-n*(BRIDGE.arch+BRIDGE.pier)+BRIDGE.pier)/2;
    for(let i=0;i<n;i++){const u0=first+i*(BRIDGE.arch+BRIDGE.pier),u1=u0+BRIDGE.arch;
      const band=bands.find(b=>b.side===side&&u0>=b.ua-1e-6&&u1<=b.ub+1e-6);
      let ground=Infinity;for(let u=u0;u<=u1+1e-6;u+=.35)ground=Math.min(ground,height(...P(u,side*(outerHalf+.06))));
      if(band)ground=band.floor;
      const crown=deckY-.65,spring=crown-BRIDGE.arch/2;if(spring-ground<1)continue;arches.push({side,u0,u1,ground,spring,crown});}}
  cuts.push(box4([P(uStart,-outerHalf),P(uStart,outerHalf),P(uFront,outerHalf),P(uFront,-outerHalf)],
    [uPlane(uStart+.03,1),uPlane(uDoor+.01,-1),vPlane(-outerHalf,1),vPlane(outerHalf,-1)]));

  // Entrance frontispiece (Wikimedia Commons curid=122907842; Wikimedia Commons curid=34389747 from the moat): doors shown CLOSED — the fort interior is outside this scope.
  let portalBottom=deckY-.3;
  for(let u=uFront;u<=uFoot+1;u+=.25)for(const v of [-ENTRANCE.half,-2,0,2,ENTRANCE.half])portalBottom=Math.min(portalBottom,height(...P(u,v))-.3);
  const portalTop=deckY+ENTRANCE.apex;
  const quad=(u0,u1,v0,v1)=>[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)];
  prism(quad(uFront,Math.max(uFoot+1,uFront+ENTRANCE.depth+.4),-ENTRANCE.half,ENTRANCE.half),portalBottom,deckY+ENTRANCE.cornice);

  // Fitted rampart bodies (support: the wall walk) and full-height parapets, per station interval.
  // Where the mapped line crosses level ground (the north bastion's 5 pm path gate at vertex 12, OSM 10958225270) there
  // is no wall: an interval is drawn only when both stations stand ≥1.2 m (a token face there buried its plinth 7 cm); the
  // masonry either side of an opening gets an end.
  const walls=[],ends=[];
  for(const run of runs){const list=run.segs.flatMap(g=>g.stations.slice(0,-1).map((a,i)=>({a,b:g.stations[i+1]})));
    // Stairs round: no interval stands inside a mapped public way — the steps 1179846717 → footway
    // 1179846718 → steps 1179846716 (OSM, 2.2 m wide) pass the end of this run; the first interval's parapet tip stood
    // 0.28 m from their centreline. Such an interval is an opening like the low ones (its neighbour gets the end face).
    const inWay=({a,b})=>[a.T,b.T,b.Q,a.Q,a.W,b.W].filter(Boolean).some(p=>PUBLIC_WAYS.some(l=>l.some((q,k)=>k+1<l.length&&segmentDistance(p[0],p[1],q,l[k+1])<1.1)));
    const drawn=list.map(({a,b})=>Math.min(a.walk-a.base,b.walk-b.base)>=1.2&&!inWay({a,b}));
    list.forEach(({a,b},i)=>{if(!drawn[i])return;
      const walk=Math.max(a.walk,b.walk);walls.push({a,b,walk,run:run.name});
      wallBody(prism,a,b,Math.min(a.bottom,b.bottom)-.2,walk);
      prism([a.T,b.T,b.Q,a.Q],Math.min(a.crest,b.crest)-1.5,walk+PARAPET.rise);
      if(!drawn[i-1])ends.push({s:a,dir:-1});if(!drawn[i+1])ends.push({s:b,dir:1});});
    run.open=drawn.filter(d=>!d).length;}
  // Corner garitas on tall salients (Wikimedia Commons curid=34389396: the south bastion's salient, vertex 3; Wikimedia Commons curid=80420696, curid=123485577, curid=136301888 further salients
  // on the land and Atlantic fronts — those positions are inferred from the outline, not individually verified).
  const garitas=[];
  for(const run of runs)for(let k=2;k<run.segs.length-1;k++){const a=run.segs[k-1],b=run.segs[k];
    const turn=a.ux*b.nx+a.uz*b.nz; // >0: the next face turns back toward the fort = salient
    // The 2 m DEM smears a narrow tip low (Wikimedia Commons curid=34389396's salient reads 5.7 m at the tip, 9–10 m on its faces): judge the
    // salient by its faces within four stations either side.
    const tip=a.stations.at(-1),rise=Math.max(...[...a.stations.slice(-4),...b.stations.slice(0,4)].map(s=>s.top-s.base));
    if(turn<.45||rise<6)continue;
    const bx=a.nx+b.nx,bz=a.nz+b.nz,l=Math.hypot(bx,bz),x=tip.T[0]+bx/l*.35,z=tip.T[1]+bz/l*.35,y=tip.walk-.55;
    garitas.push({x,z,y,radius:.8,body:2.15,corbel:1.15,wallNx:bx/l,wallNz:bz/l,kind:'corner',run:run.name,vertex:RUNS[runs.indexOf(run)].ids[k-1]});
    prism(circle(x,z,.86,14),y-.05,y+2.15+.95);}

  // Lighthouse (OSM 4124264489; Wikimedia Commons curid=34389396, curid=34389747 1960, 43/44 2024): square tower, cornice, merloned gallery with four
  // pinnacle turrets, dark lantern drum, dome and vane. Sides aligned with the land-front curtain.
  const lh={x:LIGHTHOUSE[0],z:LIGHTHOUSE[1],half:2.3,body:7.6,ux:g1.ux,uz:g1.uz,nx:g1.nx,nz:g1.nz};
  {const ring=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[lh.x+(g1.ux*a+g1.nx*b)*lh.half,lh.z+(g1.uz*a+g1.nz*b)*lh.half]);
    lh.y=height(lh.x,lh.z);lh.bottom=Math.min(...ring.map(p=>height(...p)),lh.y)-.15;lh.ring=ring;
    prism(ring,lh.bottom,lh.y+lh.body+4.6);}

  // Esplanade (Wikimedia Commons curid=72603185, curid=148962402, curid=148962401): Calle del Morro as a pale concrete strip, a small paved turning circle by the benches and
  // the approach to the bridge head. Single owner per point; nothing under the bridge-body cut.
  const raw=[];
  const strip=(pts,half,kind)=>{const nrm=pts.slice(1).map((q,i)=>{const p=pts[i],l=Math.hypot(q[0]-p[0],q[1]-p[1]);return [-(q[1]-p[1])/l,(q[0]-p[0])/l];});
    const side=pts.map((p,i)=>{const a=nrm[Math.max(0,i-1)],b=nrm[Math.min(nrm.length-1,i)],mx=a[0]+b[0],mz=a[1]+b[1],m=Math.hypot(mx,mz)||1;
      const k=1/Math.max(.6,(mx*b[0]+mz*b[1])/m);return [mx/m*k*half,mz/m*k*half];});
    for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],m0=side[i],m1=side[i+1];
      raw.push({kind,ring:[[a[0]+m0[0],a[1]+m0[1]],[a[0]-m0[0],a[1]-m0[1]],[b[0]-m1[0],b[1]-m1[1]],[b[0]+m1[0],b[1]+m1[1]]]});}};
  const head=P(uStart,0);
  raw.push({kind:'morro',ring:circle(TURNING[0],TURNING[1],5.5,20)});
  strip([...CALLE.slice(0,-1),[TURNING[0]+(CALLE[2][0]-TURNING[0])*.2,TURNING[1]+(CALLE[2][1]-TURNING[1])*.2]],2.5,'morro');
  strip([TURNING,head],BRIDGE.half+BRIDGE.wall,'morro');
  strip(FOOTWAY,1.1,'morro');
  // Seams integration round (calle-del-morro--471_-300-nw): the esplanade spine stopped ~1.5–2 m short of the
  // Calle del Morro loop (OSM 22230965, its 6 m carriageway paved by `streets`), leaving raw mask. One fan continues the
  // spine back from its first station, widening 1 m a side, to 2.8 m from the loop's centreline (0.2 m under the
  // carriageway edge, which `streets` then meets as an older owner's edge). Draped like the spine: drawn = physical ground.
  {const LOOP=[[-473.4,-303.4],[-473.2,-306.3],[-472.8,-308.6],[-471.7,-311.2],[-469.9,-313.2]];   // 22230965 near the spine
    const c=CALLE[0],L=Math.hypot(CALLE[1][0]-c[0],CALLE[1][1]-c[1]),ux=(CALLE[1][0]-c[0])/L,uz=(CALLE[1][1]-c[1])/L,nx=-uz,nz=ux;
    const dLoop=(x,z)=>Math.min(...LOOP.slice(1).map((b,i)=>segmentDistance(x,z,LOOP[i],b)));
    let d=0;while(d<6&&dLoop(c[0]-ux*d,c[1]-uz*d)>2.8)d+=.05;
    if(d>.2){const A=[c[0]+nx*2.5,c[1]+nz*2.5],B=[c[0]-nx*2.5,c[1]-nz*2.5],e=[-ux*d,-uz*d];
      raw.push({kind:'morro',ring:[A,B,[B[0]+e[0]-nx,B[1]+e[1]-nz],[A[0]+e[0]+nx,A[1]+e[1]+nz]]});}}
  // Verge ( the Calle del Morro loop island, OSM 22230965, showed `streets`' slab fill with green
  // triangular lawn holes): the island inside the 6 m loop carriageway (centreline inset 3.15 m: half width + kerb) is one
  // pale paving like the esplanade spine (Wikimedia Commons curid=72603185, curid=148962402, curid=148962401), single owner; `streets` meets it as an older owner's edge.
  {const L=[[-455.81,-311.93],[-454.24,-309.25],[-453.58,-306.22],[-453.92,-303.13],[-455.22,-300.31],[-457.34,-298.03],[-460.25,-296.47],
      [-463.51,-295.95],[-466.76,-296.53],[-469.65,-298.16],[-471.81,-300.65],[-472.88,-303.07],[-473.24,-305.7],[-472.89,-308.32],[-471.85,-310.76],
      [-469.83,-313.12],[-467.17,-314.75],[-464.13,-315.47],[-461.02,-315.2],[-458.16,-313.99]];
    const c=L.reduce((a,p)=>[a[0]+p[0]/L.length,a[1]+p[1]/L.length],[0,0]);
    const island=L.map(p=>{const dx=p[0]-c[0],dz=p[1]-c[1],r=Math.hypot(dx,dz),k=Math.max(0,r-3.15)/r;return [c[0]+dx*k,c[1]+dz*k];});
    raw.push({kind:'morro',ring:signedArea(island)<0?[...island].reverse():island});}
  const exclude=quad(uStart+.03,uFront+.5,-outerHalf-.02,outerHalf+.02);
  const surfaces=[];
  for(let i=0;i<raw.length;i++){
    let pieces=[signedArea(raw[i].ring)<0?[...raw[i].ring].reverse():raw[i].ring];
    for(const cut of [exclude,...raw.slice(0,i).map(r=>r.ring),...cuts.slice(0,-1).map(c=>c.ring)])pieces=pieces.flatMap(poly=>subtractRing(poly,cut));
    // Convex inputs (circle, gently mitred quads, the cut quad) stay convex under half-plane subtraction.
    for(const ring of pieces)surfaces.push({kind:raw[i].kind,ring});
  }
  const benches=BENCHES.map(([x,z])=>{const heading=Math.atan2(TURNING[0]-x,TURNING[1]-z),legs=[-.7,.7].map(u=>{
      const lx=x+Math.cos(heading)*u,lz=z-Math.sin(heading)*u;return {u,ground:height(lx,lz)};});
    const y=Math.max(...legs.map(l=>l.ground));return {x,z,y,heading,legs,width:1.8,depth:.45,height:.46};});
  for(const b of benches){const low=Math.min(...b.legs.map(l=>l.ground))-.05;
    colliders.push({centre:{x:b.x,y:(low+b.y+b.height)/2,z:b.z},halfExtents:{x:b.width/2,y:(b.y+b.height-low)/2,z:b.depth/2},rotationY:b.heading,surface:'pavement'});}

  // Ground tint (Wikimedia Commons curid=72603185, curid=122907842, curid=123485577, curid=148962402, curid=148962401): inside the fort outline steep DEM cells read as weathered masonry, level tops as grey
  // terreplein stone and the banks between as grass/scrub; the moat-floor lawns read as grass; the strip core as paving.
  const tint=new Map();
  if(terrain?.nx){const {x0,z0,nx,nz,step,heights:h}=terrain;
    const xs=FORT_OUTLINE.map(p=>p[0]),zs=FORT_OUTLINE.map(p=>p[1]);
    const i0=Math.max(1,Math.floor((Math.min(...xs)-x0)/step)),i1=Math.min(nx-2,Math.ceil((Math.max(...xs)-x0)/step));
    const j0=Math.max(1,Math.floor((Math.min(...zs)-z0)/step)),j1=Math.min(nz-2,Math.ceil((Math.max(...zs)-z0)/step));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=x0+i*step,z=z0+j*step,k=j*nx+i;
      if(MOAT_LAWNS.some(r=>inRing(x,z,r))){tint.set(k,'lawn');continue;}
      if(!inRing(x,z,FORT_OUTLINE))continue;
      const slope=Math.hypot(h[k+1]-h[k-1],h[k+nx]-h[k-nx])/(2*step);
      tint.set(k,slope>1.1?'masonry':slope<.4?'stone':'lawn');}
    // Joins (calle-del-morro--471_-300-nw): the band tint below reached into the Calle del Morro
    // loop's 6 m carriageway (OSM 22230965), and a tinted corner blocks `streets`' cell, so the carriageway had holes of
    // lawn and raw blue mask between the asphalt mouth and the spine. No vertex of a cell the carriageway touches (3 m +
    // a cell diagonal from its centreline) takes this band's tint; `streets` paves the loop to its edge.
    const RING=[[-455.81,-311.93],[-454.24,-309.25],[-453.58,-306.22],[-453.92,-303.13],[-455.22,-300.31],[-457.34,-298.03],[-460.25,-296.47],
      [-463.51,-295.95],[-466.76,-296.53],[-469.65,-298.16],[-471.81,-300.65],[-472.88,-303.07],[-473.24,-305.7],[-472.89,-308.32],[-471.85,-310.76],
      [-469.83,-313.12],[-467.17,-314.75],[-464.13,-315.47],[-461.02,-315.2],[-458.16,-313.99],[-455.81,-311.93]];
    const nearLoop=(x,z,r)=>{for(let q=0;q+1<RING.length;q++)if(segmentDistance(x,z,RING[q],RING[q+1])<r)return true;return false;},onLoop=(x,z)=>nearLoop(x,z,3+step*Math.SQRT2);
    // Apron: pavement-class cells within 30 m outside the fort read as grass/scrub (Wikimedia Commons curid=123485577; pale "beach" before).
    if(surface)for(let j=Math.max(1,j0-15);j<=Math.min(nz-2,j1+15);j++)for(let i=Math.max(1,i0-15);i<=Math.min(nx-2,i1+15);i++){
      const k=j*nx+i;if(tint.has(k)||surface[k]!==0)continue;const x=x0+i*step,z=z0+j*step;
      // (Seams nor round the loop's carriageway and sidewalk, 9 m from its centreline, which `streets` paves.)
      if(FORT_OUTLINE.some((a,q)=>segmentDistance(x,z,a,FORT_OUTLINE[(q+1)%FORT_OUTLINE.length])<30)&&!nearLoop(x,z,9))tint.set(k,'lawn');}
    const line=[...CALLE,head];
    for(let i=0;i+1<line.length;i++){const a=line[i],b=line[i+1],R=6;
      const ii0=Math.max(0,Math.floor((Math.min(a[0],b[0])-R-x0)/step)),ii1=Math.min(nx-1,Math.ceil((Math.max(a[0],b[0])+R-x0)/step));
      const jj0=Math.max(0,Math.floor((Math.min(a[1],b[1])-R-z0)/step)),jj1=Math.min(nz-1,Math.ceil((Math.max(a[1],b[1])+R-z0)/step));
      for(let j=jj0;j<=jj1;j++)for(let k=ii0;k<=ii1;k++){const x=x0+k*step,z=z0+j*step,d=segmentDistance(x,z,a,b);
        if(d<5.5&&onLoop(x,z))continue;
        if(d<=2.2)tint.set(j*nx+k,'paseo');else if(d<5.5&&!tint.has(j*nx+k))tint.set(j*nx+k,'lawn');}}
    for(let i=0;i+1<FOOTWAY.length;i++){const a=FOOTWAY[i],b=FOOTWAY[i+1];
      for(let j=Math.floor((Math.min(a[1],b[1])-4-z0)/step);j<=Math.ceil((Math.max(a[1],b[1])+4-z0)/step);j++)
        for(let k=Math.floor((Math.min(a[0],b[0])-4-x0)/step);k<=Math.ceil((Math.max(a[0],b[0])+4-x0)/step);k++){
          const d=segmentDistance(x0+k*step,z0+j*step,a,b);if(d<=.9)tint.set(j*nx+k,'paseo');else if(d<3.5)tint.set(j*nx+k,'lawn');}}}

  // Paseo del Morro's El Morro end: OSM barrier=gate 5414831906 (the paseo closes after hours). Masonry posts and a closed
  // black iron gate across the drawn strip, 0.8 m in from its end — a clear real end. Appearance inferred (no photo).
  let paseoGate=null;
  if(paseo?.length>1){const a=paseo[0],b=paseo[1],l=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/l,uz=(b[1]-a[1])/l;
    const x=a[0]+ux*.8,z=a[1]+uz*.8,nx=-uz,nz=ux,half=2.05,rotation=Math.atan2(-nz,nx);
    const posts=[-1,1].map(s=>{const px0=x+nx*s*half,pz0=z+nz*s*half;return {x:px0,z:pz0,y:height(px0,pz0)};});
    const y=Math.min(...posts.map(p=>p.y),height(x,z));paseoGate={x,z,y,nx,nz,half,rotation,posts};
    colliders.push({centre:{x,y:y+.8,z},halfExtents:{x:half+.25,y:.95,z:.14},rotationY:rotation,surface:'pavement'});}
  const arrival=[CALLE[2][0]+(CALLE[1][0]-CALLE[2][0])*.17,CALLE[2][1]+(CALLE[1][1]-CALLE[2][1])*.17];
  return {frame:{origin:FORT_GATE,ax,az,px,pz,P,UV},runs,walls,ends,garitas,stations:runs.flatMap(r=>r.stations),
    bridge:{uStart,uFront,uFoot,uBack,deckY,rows,deckTriangles,sides,arches,outerHalf,bands,bandTriangles,bandPaved,bandSkirts},
    entrance:{uFront,uFoot,uBack,portalBottom,portalTop,deckY},lighthouse:lh,benches,paseoGate,stairs,surfaces,exclude,tops,cuts,colliders,tint,
    places:[{name:'El Morro — puente de entrada',x:arrival[0],z:arrival[1],source:741560515}],
    constants:{BATTER,PARAPET,PLINTH,MERLON,ENTRANCE,BRIDGE}};
}
