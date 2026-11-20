/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// La Perla west: city wall west of Las Ánimas, Calle Cementerio sally port, Cementerio Santa María Magdalena de Pazzis
// (Wikimedia Commons curid=51518101, curid=163264054, curid=163264061, curid=80369333, curid=58051549, curid=163264065, curid=80369699, curid=80369335, curid=80369330, curid=80369332, curid=163264058) — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// Area module (contract in the header of sj-princesa-layout.js). Shared physical/render owner:
// sj-perla-west.js draws exactly these numbers. Mapped vs inferred:
// Mapped: city wall 700234944 v0→14 + 119438993 (San Antonio); tunnel 142860683 / sally port node 1563299471; Calle
// Cementerio 142860686; retaining wall 561646847 (both lane sides); Calle Tiburcio Reyes 22229137; cemetery 28966510
// (its v6→v0 edges are the historic wall); service road 270181115 and loop 142860677.
import {fitRun} from './sj-fort-layout.js';
import {unit,bounds,overlapB,ribbon,minus,convexPlanes,plane,limitWalkEdge,agreeWalks,wallIntervals,wallInterval,mitre,
  repairCorners,closeWalkDips,fillWalkNotches,unifyCollapsedWalks,SECTION_KEYS} from './sj-city-wall.js';
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {cemeteryAt} from './sj-private.js';

// OSM 700234944 v0→v14 (cemetery NW corner … Calle Cementerio sally port … Las Ánimas) and 119438993 v1→v5.
export const WALL_V=[[-534.450,-562.845],[-542.595,-530.370],[-465.282,-473.431],[-443.323,-490.487],[-387.185,-499.983],
  [-371.776,-461.253],[-380.511,-443.356],[-384.873,-434.567],[-339.985,-412.695],[-294.526,-388.609],[-282.072,-409.163],
  [-214.169,-401.182],[-182.693,-397.485],[-178.860,-343.337],[-179.716,-326.657]];
export const SAN_ANTONIO=[[-558.552,-600.910],[-625.409,-608.229],[-638.221,-603.868],[-647.600,-600.415],[-658.363,-596.442]];
// Norzagaray's wall section and fitter options, so the two areas read as one wall (Wikimedia Commons curid=80155724, curid=58051549, curid=163264065, curid=80369330).
const PARAPET={thick:1.4,riseIn:.75,riseOut:.45},FIT={batter:1/7,thick:PARAPET.thick,cordon:0,inner:9},FLOOR_BAND=2.5;
// Tunnel 142860683 (20.7 m) from the sally port to its upper end; the frame starts on the lower throat (22221861).
const SALLY=[-339.985,-412.695],TUNNEL_IN=[-347.769,-393.502],THROAT=[-338.390,-416.104];
// Wikimedia Commons curid=80369333 (looking out of the tunnel at the cemetery gate): a dark, round, deep masonry arch. Clear width 4.9 m (the mapped
// retaining walls stand 4.9 m apart at the upper mouth); spring 2.0, crown 3.6 (≈ semicircular; a taller crown would
// break through the 18 m roof at the rear). Shift centres the bore on the mapped road (+0.2 m) and both lane walls.
export const PASSAGE={half:2.45,spring:2.0,crown:3.6,shift:.4,blockHalf:5.6,rearHalf:3.65,rearDepth:2.8,uRear:24.3};
// Calle Cementerio above the bore (142860686) and the retaining wall 561646847 along both lane sides (east side reversed).
const ROAD_UP=[[-348.952,-388.289],[-346.365,-383.994],[-297.124,-357.86],[-252.573,-334.206],[-241.24,-328.196],
  [-237.449,-320.016],[-237.406,-314.803]];
const RET_E=[[-346.09,-392.406],[-346.512,-389.949],[-345.731,-387.691],[-344.949,-386.706],[-343.471,-385.787],
  [-338.306,-383.286],[-315.28,-371.752],[-288.601,-358.281]];
const RET_W=[[-350.41,-394.808],[-351.54,-390.934],[-350.98,-386.618],[-350.262,-384.393],[-348.572,-382.268],
  [-315.228,-364.402],[-314.869,-362.366],[-301.022,-355.713]];
const ROAD_HALF=2.6;
// Cemetery 28966510 (open ring). Edges 0→19 are its own enclosure; 19→0 (v6 … v0) is the historic wall.
export const CEMETERY=[[-534.45,-562.845],[-463.748,-556.257],[-417.867,-537.395],[-411.171,-532.68],[-408.995,-522.441],
  [-381.154,-518.035],[-379.992,-521.29],[-367.085,-518.544],[-333.899,-495.123],[-321.658,-497.569],[-299.066,-494.237],
  [-296.203,-502.804],[-242.58,-483.344],[-244.882,-475.519],[-248.252,-476.493],[-252.329,-460.554],[-267.137,-419.036],
  [-288.515,-420.996],[-299.585,-401.869],[-380.511,-443.356],[-371.776,-461.253],[-387.185,-499.983],[-443.323,-490.487],
  [-465.282,-473.431],[-542.595,-530.37]];
const ENCLOSURE_EDGES=19,RAIL_EDGE=18;
// Service road 270181115 from the gate to the chapel loop 142860677; it crosses the enclosure at the gate (S3).
const SERVICE=[[-338.39,-416.104],[-320.359,-449.487],[-333.161,-460.589],[-335.199,-467.274],[-356.587,-483.567],
  [-380.605,-506.602],[-462.534,-522.553]];
const GATE_AT=[-335.996,-420.535];
// Wikimedia Commons curid=80369333: white pilasters, cream arch field, cornice, stepped curved attic, Latin cross; estimates.
export const GATE={width:5.0,depth:.9,clear:2.8,spring:2.5,cornice:4.5,attic:5.5,cross:6.7};
// Wikimedia Commons curid=51518101, curid=163264054, curid=163264058: round arcaded chapel with a terracotta plinth, coral dome and pale lantern. Centre of loop 142860677.
export const CHAPEL={x:-474.60,z:-523.74,plinthR:8.9,plinthH:1.2,arcadeR:8.2,bays:12,spring:2.7,entab:4.5,cornice:5.3,
  drumR:4.9,drumTop:8.6,domeR:5.0,lanternR:.75,lanternH:1.5};
// Wikimedia Commons curid=51518101, curid=163264061, curid=80369330, curid=80369332: dense raised tombs in rows, white/off-white/pale grey, some dark slabs, salmon/ochre monuments.
const TOMB={pitchU:1.35,pitchP:2.95,aisleEvery:7,aisle:1.1,crossEvery:16,crossAisle:1.7};
const along=(p,u)=>p[0]*u[0]+p[1]*u[1],same=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6;
function hash(i,j,k=0){let h=Math.imul(i*73856093^j*19349663^k*83492791,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}

export function createPerlaWestLayout({city,height,terrain,surface,gate,fort,areas={}}) {
  void surface;
  const colliders=[],tops=[],cuts=[],surfaces=[],floorTriangles=[];
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  const nz=areas.norzagaray;

  // ---- Tunnel frame (u inward along the tunnel, v across, +v west). ----
  const AX=unit(SALLY,TUNNEL_IN),VX=[-AX[1],AX[0]];
  const O=[THROAT[0]+VX[0]*PASSAGE.shift,THROAT[1]+VX[1]*PASSAGE.shift];
  const P=(u,v)=>[O[0]+AX[0]*u+VX[0]*v,O[1]+AX[1]*u+VX[1]*v];
  const UV=(x,z)=>{const dx=x-O[0],dz=z-O[1];return [dx*AX[0]+dz*AX[1],dx*VX[0]+dz*VX[1]];};
  const {half,blockHalf:HB,rearHalf:HR}=PASSAGE;
  const leave=(from,to,margin=.25)=>{const [ux,uz]=unit(from,to),L=Math.hypot(to[0]-from[0],to[1]-from[1]);
    for(let t=0;t<=L;t+=.05){const q=[from[0]+ux*t,from[1]+uz*t];if(Math.abs(UV(...q)[1])>=HB+margin)return q;}return to;};

  // ---- Wall runs, fitted east → west so (−uz,ux) points out of the city (toward La Perla and the cemetery). ----
  const V=WALL_V;
  const RUNS=[{name:'animas-flank',pts:[V[14],V[13],V[12],V[11],V[10],V[9],leave(V[8],V[9])]},
    {name:'santo-domingo-san-antonio',pts:[leave(V[8],V[7]),V[7],V[6],V[5],V[4],V[3],V[2],V[1],V[0],...SAN_ANTONIO]}];
  const runs=RUNS.map(r=>({name:r.name,...fitRun(r.pts,height,FIT)}));
  limitWalkEdge(runs,height);agreeWalks(runs,height);
  // Dips up to ~12 m wide between higher walks are DEM smear at salient tips (v4 1.2 m, v12 3.5 m, the San Antonio
  // corner's sawtooth); filling them only makes the wall taller there.
  const repaired=runs.map(r=>repairCorners(r,height)),dips=runs.map(r=>closeWalkDips(r,height,6));
  // Moved inner edges stay out of the city's building masses (houses abut the wall's inner side in places).
  const nearB=city.buildings.filter(b=>b.outer.some(([x,z])=>x>-700&&x<-150&&z>-640&&z<-300));
  const inBuilding=p=>nearB.some(b=>inRing(p[0],p[1],b.outer));
  const notches=runs.map(r=>fillWalkNotches(r,height,{blocked:inBuilding}));
  // Elbow at v14 (S3: an independent fit left a 1.12 m step and an open elbow): Norzagaray's last section stays as it
  // is; the new run's first section is mitred against it and the walk rises to Norzagaray's at ≤12 %.
  let elbow=null;
  {const nzRun=nz?.runs?.find(r=>r.name==='animas-west'),a=nzRun?.stations.at(-1),g=runs[0].segs[0];
    if(a&&Math.hypot(a.x-V[14][0],a.z-V[14][1])<.05){const prev=nzRun.stations.at(-2),ua=unit([prev.x,prev.z],[a.x,a.z]);
      const x=mitre([a],g.stations,ua,[g.ux,g.uz],{clampA:false});
      // Keys whose mitre point lies behind Norzagaray's end (the new face is set back there) keep Norzagaray's point, so
      // the elbow interval never folds back over Norzagaray's last interval.
      for(const k of SECTION_KEYS)if(along(x[k],ua)<along(a[k],ua)-1e-9)for(const s of g.stations)if(same(s[k],x[k]))s[k]=[...a[k]];
      const b=g.stations[0];b.walk=Math.max(b.walk,a.walk);b.crest=Math.max(b.crest,a.crest);
      for(const s of runs[0].stations){s.walk=Math.max(s.walk,a.walk-.12*(s.s-b.s));s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);}
      elbow={a,b};}}

  // ---- Sally port front block: carries both run ends (their full sections) and the arch; parapet on its outer edge. ----
  const eastEnd=runs[0].stations.at(-1),westStart=runs[1].stations[0];
  const secV=s=>['F','B','T','Q','W'].map(k=>UV(...s[k])[1]),secU=(s,keys)=>keys.map(k=>UV(...s[k])[0]);
  const uFront=Math.min(...secU(eastEnd,['F']),...secU(westStart,['F']))-.3,uOut=uFront-1.6;
  const uBlk=Math.max(...secU(eastEnd,['W']),...secU(westStart,['W']))+.3;
  const vMin=Math.min(-HB,...secV(eastEnd))-.15,vMax=Math.max(HB,...secV(westStart))+.15;
  const {uRear}=PASSAGE,uR0=uRear-PASSAGE.rearDepth;
  const outerY=Math.max(...[-half,-1,0,1,half].map(v=>height(...P(uOut,v))));
  const innerY=Math.min(...[-1.05,0,1.05].map(v=>height(...P(uRear+1.5,v))));
  const floorAt=u=>u<=uFront?outerY:u>=uRear?innerY:outerY+(innerY-outerY)*(u-uFront)/(uRear-uFront);
  let blockTop=Math.max(eastEnd.walk,westStart.walk),blockBottom=outerY;
  for(let u=uFront;u<=uBlk+1e-6;u+=.25)for(let v=vMin;v<=vMax+1e-6;v+=.5){const h=height(...P(u,v));blockTop=Math.max(blockTop,h+.05);blockBottom=Math.min(blockBottom,h);}
  blockBottom-=.4;
  // Both run walks ease up to the block top (≤12 %), so the walk meets the block flush.
  for(const st of runs[0].stations){st.walk=Math.max(st.walk,blockTop-.12*(eastEnd.s-st.s));st.kerb=Math.min(st.walk-.45,height(...st.W)-.1);}
  for(const st of runs[1].stations){st.walk=Math.max(st.walk,blockTop-.12*(st.s-westStart.s));st.kerb=Math.min(st.walk-.45,height(...st.W)-.1);}
  // Collapsed corner stations share one walk (after every walk-raising step); the elbow keeps Norzagaray's height.
  const unified=runs.map(r=>unifyCollapsedWalks(r,height,new Set(elbow?[elbow.b]:[])));
  // Mitres moved some feet and face bottoms: bury every face bottom again below its actual foot (fitter rule).
  for(const s of runs.flatMap(r=>r.stations))s.bottom=Math.min(s.bottom,height(...s.F)-.4,height(...s.B)-.4);
  let rearTop=-Infinity,rearBottom=innerY;
  for(let u=uR0;u<=uRear+1e-6;u+=.25)for(let v=-HR;v<=HR+1e-6;v+=.5){const h=height(...P(u,v));rearTop=Math.max(rearTop,h+.05);rearBottom=Math.min(rearBottom,h);}
  rearBottom-=.4;
  // Between the blocks the vault runs under the kept 18–19 m roof: report the thinnest cover (renderer has no cut there).
  let cover=Infinity;for(let u=uBlk;u<=uR0+1e-6;u+=.5)for(let v=-half-.5;v<=half+.5+1e-6;v+=.5)cover=Math.min(cover,height(...P(u,v))-(floorAt(u)+PASSAGE.crown));

  // ---- Walls: drawn intervals, the elbow interval, ends (none at the elbow's joint). ----
  // Corner-aware body tops (first tests: at v10 a corner interval's body, 0.35 m under its own walk, reached over the next
  // segment's walk 0.47 m lower): 0.35 m under the lowest walk within 4 m.
  const lowWalk=new Map();for(const run of runs){const st=run.stations;
    for(const s of st){let m=s.walk;for(const q of st)if(Math.abs(q.s-s.s)<=6&&Math.hypot(q.x-s.x,q.z-s.z)<=4)m=Math.min(m,q.walk);lowWalk.set(s,m);}}
  const {walls,ends:runEnds}=wallIntervals(runs,{prism,tops,PARAPET,FLOOR_BAND,source:'perlaWest:walk',bodySupport:false,
    bodyTop:(a,b)=>Math.min(lowWalk.get(a),lowWalk.get(b))-.35});
  let ends=runEnds;
  if(elbow){walls.unshift(wallInterval(elbow.a,elbow.b,{prism,tops,PARAPET,FLOOR_BAND,source:'perlaWest:walk',run:'elbow',bodySupport:false}));
    ends=ends.filter(e=>e.s!==elbow.b);}

  // ---- Floor: outer approach, bore (covered: ceiling 10 cm under the drawn arch), then the lane. ----
  const rise=PASSAGE.crown-PASSAGE.spring,R=(half*half+rise*rise)/(2*rise),archCy=PASSAGE.crown-R;
  const archAt=v=>archCy+Math.sqrt(Math.max(0,R*R-Math.min(v*v,half*half)));
  // Bore rows follow the renderer's 12 arch strips, so each band's ceiling (its lowest arch point −10 cm) tracks the drawn
  // arch (five-point rows gave the outer 1.43 m bands only 1.90 m and rejected visibly clear placements).
  const across=Array.from({length:13},(_,i)=>i===0?-half-.03:i===12?half+.03:-half+2*half*i/12);
  const LANE_V=[-half-.03,-1.05,0,1.05,half+.03],FR=LANE_V.map(v=>(v+half+.03)/(2*half+.06));
  const edgeRow=u=>across.map(v=>{const [x,z]=P(u,v);return [x,height(x,z)+.015,z];});
  const lineRow=(u,y)=>across.map(v=>{const [x,z]=P(u,v);return [x,y,z];});
  const boreU=[uFront];for(let u=uFront+4;u<uRear-1.5;u+=4)boreU.push(u);boreU.push(uRear);
  const rows=[[uOut-.03,edgeRow(uOut-.03),false],...boreU.map(u=>[u,lineRow(u,floorAt(u)),true])];
  const floorTop=(tri,source,ceil)=>{const y=Math.max(tri[0][1],tri[1][1],tri[2][1]);
    tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:y,plane:plane(tri),replacesTerrain:true,maxReferenceY:y+FLOOR_BAND,surface:'pavement',source,
      ...(ceil!==undefined?{ceilingOffset:ceil}:{})});};
  const pushFloor=(A,B,source,covered)=>{for(let i=0;i+1<A.length;i++){const ceil=covered?Math.min(archAt(across[i]),archAt(across[i+1]))-.1:undefined;
    if(covered&&A.length!==across.length)throw new Error('covered floor rows must use the bore strips');
    for(const tri of [[A[i],B[i+1],B[i]],[A[i],A[i+1],B[i+1]]]){tri.kind='road';floorTriangles.push(tri);floorTop(tri,source,ceil);}}};
  for(let r=0;r+1<rows.length;r++)pushFloor(rows[r][1],rows[r+1][1],'perlaWest:bore',rows[r][2]&&rows[r+1][2]);
  // Outer approach sides: render-only skirts where the kept ground is level with the floor (the throat: Tiburcio and the
  // cemetery service turn there, so no kerb), kerbs only where it stands higher.
  const skirts=[],kerbs=[];
  for(const s of [-1,1]){let m=-Infinity;for(let u=uOut;u<=uFront+1e-6;u+=.125)for(const v of [half,half+.2,half+.45])m=Math.max(m,height(...P(u,s*v)));
    if(m<outerY+.1){skirts.push({side:s});continue;}
    const top=Math.max(m+.05,outerY+.12),lo=Math.min(outerY,height(...P(uOut,s*half)),height(...P(uFront,s*half)))-.4;kerbs.push({side:s,top,bottom:lo});
    prism(s<0?[P(uOut,-half-.45),P(uFront,-half-.45),P(uFront,-half),P(uOut,-half)]:[P(uOut,half),P(uFront,half),P(uFront,half+.45),P(uOut,half+.45)],lo,top);}

  // ---- Lane: the sunken upper road between the mapped retaining walls, from the rear portal until the banks are low. ----
  const portalE=P(uRear,-half),portalW=P(uRear,half);
  const wallE=[portalE,...RET_E.filter(p=>UV(...p)[0]>uRear+.3)],wallW=[portalW,...RET_W.filter(p=>UV(...p)[0]>uRear+.3)];
  const centre=[P(uRear,0),...ROAD_UP];
  // Rows at the centreline vertices (bisector direction) and every ≤2.5 m on straights, ≥1.2 m from a vertex.
  const rowPts=[];{let s0=0;
    for(let i=0;i+1<centre.length;i++){const a=centre[i],b=centre[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),d=unit(a,b);
      const nPrev=i?(()=>{const p=unit(centre[i-1],a);return [-p[1],p[0]];})():[-d[1],d[0]];
      const nHere=[-d[1],d[0]],bis=unit([0,0],[nPrev[0]+nHere[0],nPrev[1]+nHere[1]]);
      rowPts.push({c:a,n:bis,s:s0});
      const k=Math.max(1,Math.ceil((L-2.4)/2.5));for(let j=1;j<=k&&L>2.4;j++){const t=1.2+(L-2.4)*j/(k+1);rowPts.push({c:[a[0]+d[0]*t,a[1]+d[1]*t],n:nHere,s:s0+t});}
      s0+=L;if(s0>70)break;}}
  const hitLine=(c,n,line)=>{let best=null;for(let i=0;i+1<line.length;i++){const p=line[i],q=line[i+1],e=[q[0]-p[0],q[1]-p[1]];
      const den=n[0]*e[1]-n[1]*e[0];if(Math.abs(den)<1e-9)continue;
      const t=((p[0]-c[0])*e[1]-(p[1]-c[1])*e[0])/den,f=((p[0]-c[0])*n[1]-(p[1]-c[1])*n[0])/den;
      if(f>=-1e-6&&f<=1+1e-6&&t>.4&&t<8&&(!best||t<best.t))best={t,p:[c[0]+n[0]*t,c[1]+n[1]*t]};}return best?.p??null;};
  const lane=[];
  for(const r of rowPts){
    let e,wv;if(!lane.length){e=portalE;wv=portalW;}else{e=hitLine(r.c,[-r.n[0],-r.n[1]],wallE);wv=hitLine(r.c,r.n,wallW);}
    if(!e||!wv)break;
    const dir=unit(e,wv),dem=height(...r.c),bank=Math.max(height(e[0]-dir[0]*.6,e[1]-dir[1]*.6),height(wv[0]+dir[0]*.6,wv[1]+dir[1]*.6));
    lane.push({c:r.c,s:r.s,e,w:wv,dir,dem,bank});
    if(lane.length>4&&r.s>15&&bank-dem<.5)break;}
  // Level rows; the floor never descends uphill (running max of the centre DEM from the bore floor); the last row is the
  // exact kept road so the floor meets it.
  {let y=innerY;lane.forEach((r,i)=>{if(i)y=Math.max(y,r.dem);r.y=y;});}
  const laneRow=(r,last)=>FR.map(f=>{const x=r.e[0]-r.dir[0]*.03+(r.w[0]-r.e[0]+r.dir[0]*.06)*f,z=r.e[1]-r.dir[1]*.03+(r.w[1]-r.e[1]+r.dir[1]*.06)*f;
    return [x,last?height(x,z)+.015:r.y,z];});
  for(let i=0;i+1<lane.length;i++)pushFloor(laneRow(lane[i],false),laneRow(lane[i+1],i+2===lane.length),'perlaWest:lane',false);
  // Retaining walls (561646847) both sides: coping at the kept bank just behind (≥15 cm over the floor), shared at rows.
  const laneWalls=[];
  for(const side of [-1,1]){const end=r=>side<0?r.e:r.w,out=r=>[end(r)[0]+side*r.dir[0]*.45,end(r)[1]+side*r.dir[1]*.45];
    const topAt=r=>{let m=-Infinity;for(const d of [.15,.45,.9])m=Math.max(m,height(end(r)[0]+side*r.dir[0]*d,end(r)[1]+side*r.dir[1]*d));return Math.max(m+.05,r.y+.15);};
    for(let i=0;i+1<lane.length;i++){const a=lane[i],b=lane[i+1],t0=topAt(a),t1=topAt(b),bottom=Math.min(a.y,b.y)-.4;
      laneWalls.push({side,p0:end(a),p1:end(b),q0:out(a),q1:out(b),t0,t1,bottom});
      // Stepped pieces whose tops stay within 5 cm of the drawn sloped coping (one flat prism at max(t0,t1) stood
      // up to 47 cm over it).
      const k=Math.max(1,Math.ceil(Math.abs(t1-t0)/.05)),L=(p,q,f)=>[p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f];
      for(let j=0;j<k;j++){const f0=j/k,f1=(j+1)/k,e0=L(end(a),end(b),f0),e1=L(end(a),end(b),f1),o0=L(out(a),out(b),f0),o1=L(out(a),out(b),f1);
        prism(side<0?[o0,o1,e1,e0]:[e0,e1,o1,o0],bottom,Math.max(t0+(t1-t0)*f0,t0+(t1-t0)*f1),true);}}}
  const laneTop=Math.max(...laneWalls.map(w=>Math.max(w.t0,w.t1)))+.1;

  // ---- Solids and render cuts. ----
  const quad=(u0,u1,v0,v1)=>[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)];
  prism(quad(uFront,uBlk,vMin,-half),blockBottom,blockTop,true);prism(quad(uFront,uBlk,half,vMax),blockBottom,blockTop,true);
  prism(quad(uFront,uBlk,-half,half),floorAt(uBlk)+PASSAGE.crown,blockTop,true);
  prism(quad(uFront,uFront+PARAPET.thick,vMin,vMax),blockTop-.6,blockTop+PARAPET.riseIn);
  prism(quad(uR0,uRear,-HR,-half),rearBottom,rearTop,true);prism(quad(uR0,uRear,half,HR),rearBottom,rearTop,true);
  prism(quad(uR0,uRear,-half,half),floorAt(uRear)+PASSAGE.crown,rearTop,true);
  const cutRing=(ring,top)=>{const b=bounds(ring);cuts.push({minX:b[0],maxX:b[1],minZ:b[2],maxZ:b[3],kind:'bore',planes:[...convexPlanes(ring),[0,-1,0,top]]});};
  cutRing(quad(uOut,uBlk,-half,half),blockTop+.1);cutRing(quad(uR0,uRear,-half,half),rearTop+.1);
  const laneRings=[];for(let i=0;i+1<lane.length;i++){const ring=[lane[i].e,lane[i+1].e,lane[i+1].w,lane[i].w];
    for(const piece of convexPieces(ring)){laneRings.push(piece);cutRing(piece,laneTop);}}
  const passage={frame:{origin:O,ax:AX[0],az:AX[1],px:VX[0],pz:VX[1]},uOut,uFront,uBlk,uR0,uRear,outerY,innerY,blockTop,blockBottom,
    rearTop,rearBottom,vMin,vMax,half,rearHalf:HR,floorAt,arch:{R,cy:archCy},skirts,kerbs,cover,lane,laneWalls};

  // ---- Surfaces: Calle Cementerio above the lane (asphalt), the Tiburcio corridor between wall and fence (Wikimedia Commons curid=80369335:
  // reddish exposed aggregate with grey bands), the cemetery's axial walk and chapel ring (Wikimedia Commons curid=51518101, curid=80369333, curid=163264058, reddish). ----
  const earlier=[...(gate?.surfaces??[]),...(fort?.surfaces??[]),...Object.values(areas).flatMap(a=>a?.surfaces??[])].map(s=>s.ring);
  const floorRings=[quad(uOut-.03,uRear,-half-.03,half+.03),...laneRings];
  const lastRow=lane.at(-1),upper=[lastRow.c,...ROAD_UP.filter(p=>Math.hypot(p[0]-lastRow.c[0],p[1]-lastRow.c[1])>1&&
    along([p[0]-lastRow.c[0],p[1]-lastRow.c[1]],unit(lane.at(-2).c,lastRow.c))>0)];
  const road=minus(ribbon(upper,-ROAD_HALF,ROAD_HALF),[...earlier,...floorRings]);
  for(const ring of road)surfaces.push({kind:'asphalt',ring,owner:'perlaWest'});

  // Cemetery enclosure pieces (needed before paving so overlays stop at them).
  const ringSign=Math.sign(signedArea(CEMETERY));
  const inward=(a,b)=>{const [ux,uz]=unit(a,b);return [-uz*ringSign,ux*ringSign];};   // into the cemetery
  const gateEdge=[CEMETERY[RAIL_EDGE],CEMETERY[RAIL_EDGE+1]],gateDir=unit(...gateEdge),gateIn=inward(...gateEdge);
  const gateS=along([GATE_AT[0]-gateEdge[0][0],GATE_AT[1]-gateEdge[0][1]],gateDir);
  const enclosure=[],piers=[];
  for(let e=0;e<ENCLOSURE_EDGES;e++){const a=CEMETERY[e],b=CEMETERY[e+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),d=unit(a,b),ni=inward(a,b);
    const rail=e===RAIL_EDGE,n=Math.max(1,Math.round(L/(rail?2.6:2.8)));
    for(let k=0;k<n;k++){let s0=L*k/n,s1=L*(k+1)/n;
      if(rail){const g0=gateS-GATE.width/2-.05,g1=gateS+GATE.width/2+.05;if(s1>g0&&s0<g1){if(s0<g0)s1=g0;else if(s1>g1)s0=g1;else continue;if(s1-s0<.3)continue;}}
      const p=[a[0]+d[0]*s0,a[1]+d[1]*s0],q=[a[0]+d[0]*s1,a[1]+d[1]*s1],th=rail?.2:.2;
      const ring=[[p[0]-ni[0]*th,p[1]-ni[1]*th],[q[0]-ni[0]*th,q[1]-ni[1]*th],[q[0]+ni[0]*th,q[1]+ni[1]*th],[p[0]+ni[0]*th,p[1]+ni[1]*th]];
      let ground=-Infinity,lo=Infinity;
      for(let t=0;t<=1.0001;t+=.25){const m=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];ground=Math.max(ground,height(m[0]+ni[0]*.8,m[1]+ni[1]*.8));
        for(const o of [-th-.05,0,th+.05])lo=Math.min(lo,height(m[0]+ni[0]*o,m[1]+ni[1]*o));}
      const top=ground+(rail?1.85:1.95),bottom=lo-.15;
      enclosure.push({edge:e,rail,p,q,ni,ring,ground,top,low:rail?ground+.75:top,bottom});
      prism(ring,bottom,top);}}
  // Piers at every joint (they also hide the stepped copings), at the gate cheeks and at the historic-wall junctions.
  for(let i=0;i<enclosure.length;i++){const w=enclosure[i],next=enclosure[i+1];
    const add=(p,top,bottom,rail,ni)=>{piers.push({x:p[0],z:p[1],top:top+.25,bottom,rail,ni});};
    if(i===0||!same(enclosure[i-1].q,w.p))add(w.p,w.top,w.bottom,w.rail,w.ni);
    add(w.q,Math.max(w.top,next&&same(next.p,w.q)?next.top:w.top),Math.min(w.bottom,next&&same(next.p,w.q)?next.bottom:w.bottom),w.rail,w.ni);}
  for(const pr of piers){const s=pr.rail?.28:.32;prism(circle(pr.x,pr.z,s,6),pr.bottom,pr.top);}
  // Gate (Wikimedia Commons curid=80369333): a closed white gateway with dark iron leaves, centred on the service crossing, facing the tunnel.
  const gateC=[gateEdge[0][0]+gateDir[0]*gateS,gateEdge[0][1]+gateDir[1]*gateS];
  let gateGround=-Infinity,gateLo=Infinity;
  for(let s=-GATE.width/2;s<=GATE.width/2+1e-6;s+=.5)for(const o of [-GATE.depth/2-1,0,GATE.depth/2+1]){const h=height(gateC[0]+gateDir[0]*s+gateIn[0]*o,gateC[1]+gateDir[1]*s+gateIn[1]*o);
    gateGround=Math.max(gateGround,h);gateLo=Math.min(gateLo,h);}
  const gateRec={x:gateC[0],z:gateC[1],dir:gateDir,inward:gateIn,ground:gateGround,bottom:gateLo-.2,...GATE};
  {const hw=GATE.width/2,hd=GATE.depth/2,c=gateC,dd=gateDir,ni=gateIn;
    prism([[c[0]-dd[0]*hw-ni[0]*hd,c[1]-dd[1]*hw-ni[1]*hd],[c[0]+dd[0]*hw-ni[0]*hd,c[1]+dd[1]*hw-ni[1]*hd],
      [c[0]+dd[0]*hw+ni[0]*hd,c[1]+dd[1]*hw+ni[1]*hd],[c[0]-dd[0]*hw+ni[0]*hd,c[1]-dd[1]*hw+ni[1]*hd]],gateRec.bottom,gateGround+GATE.cornice);}
  const enclosureRings=[...enclosure.map(w=>w.ring),...piers.map(p=>circle(p.x,p.z,.4,6))];
  const gateRing=(()=>{const hw=GATE.width/2+.1,hd=GATE.depth/2+.1,c=gateC,dd=gateDir,ni=gateIn;
    return [[c[0]-dd[0]*hw-ni[0]*hd,c[1]-dd[1]*hw-ni[1]*hd],[c[0]+dd[0]*hw-ni[0]*hd,c[1]+dd[1]*hw-ni[1]*hd],
      [c[0]+dd[0]*hw+ni[0]*hd,c[1]+dd[1]*hw+ni[1]*hd],[c[0]-dd[0]*hw+ni[0]*hd,c[1]-dd[1]*hw+ni[1]*hd]];})();

  // Tiburcio corridor: from the fence/wall junction at v6 along the wall feet to the front block and on to v9, back along
  // the fence (Wikimedia Commons curid=80369335). Overlays stop at the bore floor, the block, the fence and the gate.
  // Wall foot along the corridor (first renders: terrain triangles straddling the foot rose steeply to their vertex high in
  // the smeared bank, so the draped paving showed 2 m-grid teeth up to ~0.8 m against the face). An authored apron 2 m wide
  // runs from the foot (at the face's base) down to the kept ground, drawn as the corridor's paving and physical as
  // replacement floor; render cuts remove the terrain above it and over the face footprint [F..T] above the foot.
  // Render-only terrain cut inside a plan triangle (∩ an optional convex clip) above that triangle's own plane + off.
  const planeCut=(tri,off,clip,top)=>{const ring=tri.map(t=>[t[0],t[2]]);if(Math.abs(signedArea(ring))<1e-4)return;
    const pl=plane(tri);if(!Number.isFinite(pl.dx)||!Number.isFinite(pl.dz))return;const bb=bounds(clip??ring);
    cuts.push({minX:bb[0],maxX:bb[1],minZ:bb[2],maxZ:bb[3],kind:'foot',
      planes:[...convexPlanes(ring),...(clip?convexPlanes(clip):[]),[0,-1,0,top],[-pl.dx,1,-pl.dz,-(pl.y-pl.dx*pl.x-pl.dz*pl.z)-off]]});};
  const APRON=2,corridorSeg=(run,seg)=>run==='animas-flank'?seg===5:run==='santo-domingo-san-antonio'?seg<=1:false;
  // The apron's outer edge is one more section key (AP), mitred and clamped at every corner like the wall's own keys, so
  // neighbouring aprons and the corridor edge never fold over each other at a re-entrant corner (v7).
  for(const run of runs){for(const s of run.stations)s.AP=[s.F[0]+s.nx*APRON,s.F[1]+s.nz*APRON];
    for(let k=1;k<run.segs.length;k++)mitre(run.segs[k-1].stations,run.segs[k].stations,[run.segs[k-1].ux,run.segs[k-1].uz],[run.segs[k].ux,run.segs[k].uz],{keys:['AP']});}
  const outerOf=s=>s.AP;
  const aprons=[];
  // Free apron edges (the outer edge, and a side edge no neighbouring apron shares) follow the terrain exactly: they are
  // split wherever they cross a terrain grid line or cell diagonal and sit 1.5 cm over it (between its two end
  // points a straight outer edge ran under bulging bank, whose kept sliver then exposed a see-through edge). Each apron
  // is a fan from its centroid, wound up; the foot edge stays at the face's base.
  const crossings=(p,q)=>{const {x0,z0,step}=terrain,ts=new Set([0,1]),u0=(p[0]-x0)/step,v0=(p[1]-z0)/step,du=(q[0]-p[0])/step,dv=(q[1]-p[1])/step;
    for(const [s0,ds] of [[u0,du],[v0,dv],[u0+v0,du+dv]])if(Math.abs(ds)>1e-9)for(let k=Math.ceil(Math.min(s0,s0+ds));k<=Math.floor(Math.max(s0,s0+ds));k++){const t=(k-s0)/ds;if(t>1e-4&&t<1-1e-4)ts.add(t);}
    return [...ts].sort((x,y)=>x-y);};
  const key=p=>p[0].toFixed(4)+','+p[1].toFixed(4),quads=[];
  for(const {a,b,run} of walls){if(!corridorSeg(run,a.seg))continue;
    const A0=a.F,B0=b.F,A1=outerOf(a),B1=outerOf(b),ring=[A0,B0,B1,A1];if(Math.abs(signedArea(ring))<.05)continue;quads.push({a,b,A0,B0,A1,B1,ring});}
  const sideUse=new Map();for(const q of quads)for(const e of [[q.A0,q.A1],[q.B0,q.B1]]){const k=key(e[0])+'|'+key(e[1]);sideUse.set(k,(sideUse.get(k)??0)+1);}
  const surfY=p=>height(...p)+.015;
  for(const {a,b,A0,B0,A1,B1,ring} of quads){
    // Boundary A0 → B0 (foot, straight at base) → B1 (side) → A1 (outer) → A0 (side), with heights.
    const pts=[[A0[0],a.base,A0[1]],[B0[0],b.base,B0[1]]];
    const edge=(p,q,yp,yq,free)=>{if(!free)return;for(const t of crossings(p,q).slice(1,-1)){const x=p[0]+(q[0]-p[0])*t,z=p[1]+(q[1]-p[1])*t;
      pts.push([x,Math.max(yp+(yq-yp)*t,surfY([x,z])),z]);}};
    const freeB=sideUse.get(key(B0)+'|'+key(B1))===1,freeA=sideUse.get(key(A0)+'|'+key(A1))===1;
    edge(B0,B1,b.base,surfY(B1),freeB);pts.push([B1[0],surfY(B1),B1[1]]);
    for(const t of crossings(B1,A1).slice(1,-1)){const x=B1[0]+(A1[0]-B1[0])*t,z=B1[1]+(A1[1]-B1[1])*t;pts.push([x,surfY([x,z]),z]);}
    pts.push([A1[0],surfY(A1),A1[1]]);edge(A1,A0,surfY(A1),a.base,freeA);
    const plan=pts.map(p=>[p[0],p[2]]),sg=Math.sign(signedArea(plan));
    let convex=true;for(let k=0;k<plan.length&&convex;k++){const p0=plan[k],p1=plan[(k+1)%plan.length],p2=plan[(k+2)%plan.length];
      if(sg*((p1[0]-p0[0])*(p2[1]-p1[1])-(p1[1]-p0[1])*(p2[0]-p1[0]))<-1e-6)convex=false;}
    const tris=[];
    if(convex){const cx=plan.reduce((m,p)=>m+p[0],0)/plan.length,cz=plan.reduce((m,p)=>m+p[1],0)/plan.length;
      // Centre height on the ramp: the foot line's base blended toward the outer edge by distance (foot→outer ≈ 2 m).
      const fu=unit(A0,B0),dist=Math.abs((cx-A0[0])*-fu[1]+(cz-A0[1])*fu[0]),fb=(a.base+b.base)/2,ob=(surfY(A1)+surfY(B1))/2;
      const C=[cx,fb+(ob-fb)*Math.min(1,dist/APRON),cz];
      for(let k=0;k<pts.length;k++)tris.push([C,pts[k],pts[(k+1)%pts.length]]);}
    else{const P0=pts[0],Q0=pts[1],Q1=[B1[0],surfY(B1),B1[1]],P1=[A1[0],surfY(A1),A1[1]];tris.push([P0,Q0,Q1],[P0,Q1,P1]);}
    const apronTris=[];
    for(let tri of tris){const d1=[tri[1][0]-tri[0][0],tri[1][2]-tri[0][2]],d2=[tri[2][0]-tri[0][0],tri[2][2]-tri[0][2]],ny=d1[1]*d2[0]-d1[0]*d2[1];
      if(Math.abs(ny)<1e-4)continue;if(ny<0)tri=[tri[0],tri[2],tri[1]];   // front face up
      tri.kind='aggregate';floorTriangles.push(tri);floorTop(tri,'perlaWest:apron');apronTris.push(tri);}
    aprons.push(ring);
    // Cuts are bounded below by the actual surface they uncover (a level bound over the [F..T] plan hull removed
    // terrain lying in front of the battered face, ~0.3 m under it, and opened sky-coloured slits at the v7 corner):
    // under each apron triangle only terrain standing above it (+5 mm) goes, so ground is kept everywhere beneath the
    // apron, which carries the overlays' depth offset against it. Under each drawn face triangle (the same split
    // surfaceBuffer.quad uses) terrain above the face plane −2 cm goes: above the battered face is in front of it, below it
    // is inside the masonry and hidden, and terrain kept within a centimetre of the face z-fought with it.
    const top=Math.max(a.crest,b.crest)+.5;
    for(const tri of apronTris)planeCut(tri,.005,null,top);
    const fa=[a.B[0],a.bottom,a.B[1]],fb=[b.B[0],b.bottom,b.B[1]],ta=[a.T[0],a.crest,a.T[1]],tb=[b.T[0],b.crest,b.T[1]];
    for(const tri of [[fa,fb,tb],[fa,tb,ta]])planeCut(tri,-.02,null,top);}
  const feet=(run,from,to)=>run.stations.filter(s=>s.seg>=from&&s.seg<=to).map(s=>outerOf(s));
  const westFeet=feet(runs[1],0,1).reverse(),eastFeet=feet(runs[0],5,5);
  const corridor=[...westFeet,P(uFront-.15,vMax),P(uFront-.15,vMin),...eastFeet.reverse(),CEMETERY[RAIL_EDGE]];
  const corridorPieces=minus(convexPieces(corridor),[...earlier,...floorRings,...aprons,quad(uFront-.15,uBlk,vMin,vMax),gateRing,...enclosureRings,...road]);
  for(const ring of corridorPieces)surfaces.push({kind:'aggregate',ring,owner:'perlaWest-corridor'});

  // Cemetery walks: the service road from the gate to the chapel loop, the loop as a round walk around the chapel.
  const C=CHAPEL,loopIn=10.4,loopOut=13.4,LOOP=32;
  const loopPieces=[];for(let k=0;k<LOOP;k++){const a0=k/LOOP*Math.PI*2,a1=(k+1)/LOOP*Math.PI*2,pt=(r,a)=>[C.x+Math.cos(a)*r,C.z+Math.sin(a)*r];
    loopPieces.push([pt(loopIn,a0),pt(loopOut,a0),pt(loopOut,a1),pt(loopIn,a1)]);}
  const inner=SERVICE.map(p=>p);inner[0]=[gateC[0]+gateIn[0]*(GATE.depth/2+.1),gateC[1]+gateIn[1]*(GATE.depth/2+.1)];
  const walk=minus(ribbon(inner,-1.8,1.8),[...earlier,...enclosureRings,gateRing,...loopPieces,circle(C.x,C.z,loopIn,24)]);
  for(const ring of [...loopPieces.filter(p=>Math.abs(signedArea(p))>1e-3),...walk])surfaces.push({kind:'aggregate',ring,owner:'cemetery'});

  // ---- Chapel (Wikimedia Commons curid=51518101, curid=163264054, curid=163264058): ground from its footprint; entrance stair east, toward the incoming walk. ----
  let cg=-Infinity,cl=Infinity;for(let k=0;k<24;k++)for(const r of [0,C.plinthR*.5,C.plinthR]){const h=height(C.x+Math.cos(k*Math.PI/12)*r,C.z+Math.sin(k*Math.PI/12)*r);cg=Math.max(cg,h);cl=Math.min(cl,h);}
  const chapel={...C,ground:cg,bottom:cl-.3,floor:cg+C.plinthH,entrance:[1,0]};

  // ---- Tomb field (inferred pattern, not a burial map): rows along the cemetery's long axis, aisles every few rows and
  // cross aisles, clear of the enclosure (≥2.4 m), the historic wall's foot (≥1.4 m outside B), the walks and the chapel
  // ring, and of steep or low bank ground. Each tomb box reaches the terrain at its lowest corner. ----
  const U=unit(CEMETERY[0],CEMETERY[12]),PN=[-U[1],U[0]],cb=bounds(CEMETERY);
  const corners=[[cb[0],cb[2]],[cb[1],cb[2]],[cb[0],cb[3]],[cb[1],cb[3]]];
  const ua=corners.map(p=>along(p,U)),pa=corners.map(p=>along(p,PN));
  const histIntervals=walls.filter(w=>w.run==='santo-domingo-san-antonio');
  // (perf 2026-11-18: intervals indexed by midpoint in 12 m cells; a tomb only tests the 3×3 cells round it, which hold
  // every interval within 12 m — the same boolean as the full scan.)
  const histGrid=new Map();for(const iv of histIntervals){const k=Math.floor((iv.a.x+iv.b.x)/24)*100003+Math.floor((iv.a.z+iv.b.z)/24);let l=histGrid.get(k);if(!l)histGrid.set(k,l=[]);l.push(iv);}
  const histNear=(x,z)=>{const out=[],gx=Math.floor(x/12),gz=Math.floor(z/12);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const iv of histGrid.get((gx+i)*100003+gz+j)??[])out.push(iv);return out;};
  const tombs=[];
  // variety from Wikimedia Commons curid=163264061, curid=163264065, curid=80369330, curid=80369332 (stepped bases, rounded steles, urns, weathered tones, small yaw/offsets,
  // the odd empty plot); mausoleums take a double plot. Foundations reach the lowest terrain grid vertex of every cell
  // under the final footprint (any facet point is a convex combination of its vertices), tops clear its highest sample.
  const gridRange=(ring)=>{const {x0,z0,step,nx,nz,heights}=terrain;let lo=Infinity;
    const i0=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[0]))-x0)/step)),i1=Math.min(nx-1,Math.ceil((Math.max(...ring.map(p=>p[0]))-x0)/step));
    const j0=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[1]))-z0)/step)),j1=Math.min(nz-1,Math.ceil((Math.max(...ring.map(p=>p[1]))-z0)/step));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)lo=Math.min(lo,heights[j*nx+i]);return lo;};
  const PALETTE=['#efece5','#e9e6de','#e2dfd6','#dcd9cf','#d3d1c9','#cfcbbf','#c4c3bd','#d8d2c2','#bfc0b8','#e6e2d4'];
  {let jRow=0;for(let b=Math.min(...pa);b<=Math.max(...pa);jRow++){
    let iCol=0,skip=false;for(let a=Math.min(...ua);a<=Math.max(...ua);iCol++){
      const a0=a;a+=TOMB.pitchU+((iCol+1)%TOMB.crossEvery===0?TOMB.crossAisle:0);
      if(skip){skip=false;continue;}
      const r=hash(iCol,jRow,4),wide=r<.015&&(iCol+1)%TOMB.crossEvery!==0,type=wide?'mausoleum':r<.035?'statue':r<.05?'obelisk':r<.4?'chest':'slab';
      if(!wide&&hash(iCol,jRow,10)<.05)continue;   // an empty plot now and then
      const ju=(hash(iCol,jRow,1)-.5)*.1,jp=(hash(iCol,jRow,11)-.5)*.16,centre=a0+(wide?TOMB.pitchU/2:0)+ju;
      const x=U[0]*centre+PN[0]*(b+jp),z=U[1]*centre+PN[1]*(b+jp);
      if(!inRing(x,z,CEMETERY))continue;
      let ok=true;for(let e=0;e<ENCLOSURE_EDGES&&ok;e++)if(segmentDistance(x,z,CEMETERY[e],CEMETERY[e+1])<2.4)ok=false;
      if(!ok||Math.hypot(x-C.x,z-C.z)<loopOut+.8)continue;
      for(let i=0;i+1<inner.length&&ok;i++)if(segmentDistance(x,z,inner[i],inner[i+1])<2.6)ok=false;
      for(const {a:s0,b:s1} of histNear(x,z)){if(!ok)break;const m=[(s0.x+s1.x)/2,(s0.z+s1.z)/2];if(Math.hypot(x-m[0],z-m[1])>12)continue;
        const fb=(s0.B[0]-s0.x)*s0.nx+(s0.B[1]-s0.z)*s0.nz;if((x-s0.x)*s0.nx+(z-s0.z)*s0.nz<fb+1.4)ok=false;}
      if(!ok)continue;
      const w=wide?1.75+hash(iCol,jRow,2)*.4:.85+hash(iCol,jRow,2)*.3,l=wide?2.7+hash(iCol,jRow,3)*.4:1.95+hash(iCol,jRow,3)*.5;
      const ry=Math.atan2(PN[0],PN[1])+(hash(iCol,jRow,12)-.5)*.05,sn=Math.sin(ry),cs=Math.cos(ry);
      const at=(lx,lz)=>[x+cs*lx+sn*lz,z-sn*lx+cs*lz],ring=[at(-w/2,-l/2),at(w/2,-l/2),at(w/2,l/2),at(-w/2,l/2)];
      let lo=Infinity,hi=-Infinity;for(let fx=0;fx<=4;fx++)for(let fz=0;fz<=6;fz++){const h=height(...at(w*(fx/4-.5),l*(fz/6-.5)));lo=Math.min(lo,h);hi=Math.max(hi,h);}
      if(hi-lo>.5||lo<6)continue;
      if(wide)skip=true;
      const h=type==='slab'?.22+hash(iCol,jRow,5)*.25:type==='chest'?.55+hash(iCol,jRow,5)*.45:type==='mausoleum'?2.0+hash(iCol,jRow,5)*.8:.6;
      const cross=(type==='chest'||type==='slab')&&hash(iCol,jRow,6)<.26;
      const stele=!cross&&(type==='slab'?hash(iCol,jRow,13)<.24:type==='chest'?hash(iCol,jRow,13)<.08:false);
      const base=type==='mausoleum'||(type==='chest'?hash(iCol,jRow,14)<.45:type==='slab'?hash(iCol,jRow,14)<.15:type!=='slab');
      const urns=type==='chest'&&hash(iCol,jRow,15)<.07,wings=type==='statue'&&hash(iCol,jRow,16)<.35;
      const tone=hash(iCol,jRow,7),colour=type==='mausoleum'?(tone<.4?'#d6a58b':tone<.7?'#dcc28f':'#ebe7de'):
        tone<.06?'#6d6f6c':PALETTE[Math.floor(hash(iCol,jRow,17)*PALETTE.length)];
      tombs.push({x,z,ry,w,l,ring,bottom:Math.min(lo,gridRange(ring))-.05,top:hi+h,groundHi:hi,type,cross,stele,base,urns,wings,colour,
        crossH:.9+hash(iCol,jRow,8)*.9,steleH:.55+hash(iCol,jRow,18)*.35});}
    b+=TOMB.pitchP+((jRow+1)%TOMB.aisleEvery===0?TOMB.aisle:0);}}

  // ---- Tint: cemetery ground pale stone with grass gaps (Wikimedia Commons curid=51518101); the green strip round the chapel plinth. ----
  const tint=new Map();
  if(terrain?.nx){const {x0,z0,step,nx}=terrain;
    for(let j=Math.floor((cb[2]-z0)/step);j<=Math.ceil((cb[3]-z0)/step);j++)for(let i=Math.floor((cb[0]-x0)/step);i<=Math.ceil((cb[1]-x0)/step);i++){
      const x=x0+i*step,z=z0+j*step;if(!inRing(x,z,CEMETERY))continue;const k=j*nx+i,dc=Math.hypot(x-C.x,z-C.z);
      tint.set(k,dc<loopIn&&dc>C.plinthR-.5?'lawn':hash(i,j,9)<.3?'#8f9b74':'#aeab9e');}}

  // ---- Seal of the closed cemetery (63 hop entries over the white enclosure and the historic
  // parapets, none through the gate). Boundary solids only; the 2,687 tombs stay non-solid. Each seal is an invisible,
  // non-occluding prism (the camera ignores it) laid over a drawn boundary, from its drawn top to well above any ground a
  // rider could launch from. The drawn fence, parapets, walk and the public corridor/walk are unchanged. ----
  const SEAL={fence:3.5,parapet:2.6,half:.2};
  const seal=(ring,minY,maxY)=>{const c=prism(ring,minY,maxY);if(c)c.occludes=false;return c;};
  // The wall's top band (outer parapet edge T → walk inner edge W) of every interval stays clear of fence seals: at v6 the
  // enclosure's last piece ends on the walk itself.
  const bands=walls.flatMap(({a,b})=>convexPieces([a.T,b.T,b.W,a.W]));
  const fenceSeals=[];
  for(let e=0;e<ENCLOSURE_EDGES;e++){const a=CEMETERY[e],b=CEMETERY[e+1],ni=inward(a,b),ps=enclosure.filter(w=>w.edge===e);if(!ps.length)continue;
    const L=Math.hypot(b[0]-a[0],b[1]-a[1]);let ground=-Infinity;
    for(let t=0;t<=L+1e-6;t+=.5)for(const o of [-2,-.8,.8,2]){const f=t/L;ground=Math.max(ground,height(a[0]+(b[0]-a[0])*f+ni[0]*o,a[1]+(b[1]-a[1])*f+ni[1]*o));}
    const lo=Math.min(...ps.map(w=>w.top))-.05,hi=Math.max(...ps.map(w=>w.top),ground+SEAL.fence),h=SEAL.half;
    const ring=[[a[0]-ni[0]*h,a[1]-ni[1]*h],[b[0]-ni[0]*h,b[1]-ni[1]*h],[b[0]+ni[0]*h,b[1]+ni[1]*h],[a[0]+ni[0]*h,a[1]+ni[1]*h]];
    const near=bands.filter(q=>overlapB(bounds(q),bounds(ring),.1));
    for(const piece of near.length?minus([ring],near):[ring])fenceSeals.push(seal(piece,lo,hi));
    ps.forEach(w=>{w.seal=hi;});}
  // Joints (convex corners leave a wedge between two straight seals) and the wall junctions.
  for(let v=0;v<=ENCLOSURE_EDGES;v++){const p=CEMETERY[v],adj=enclosure.filter(w=>same(w.p,p)||same(w.q,p));if(!adj.length)continue;
    // (perf 2026-11-18: the pieces are computed once and only bands whose box meets the ring can cover a piece — a far band
    // leaves minus its input, so the result is unchanged.)
    const ring=circle(p[0],p[1],.32,8),rp=convexPieces(ring),rb=bounds(ring);
    if(bands.some(q=>overlapB(bounds(q),rb,.01)&&rp.some(r=>minus([r],[q]).length===0)))continue;
    const cut=minus(convexPieces(ring),bands.filter(q=>overlapB(bounds(q),bounds(ring),.1)));
    for(const piece of cut)seal(piece,Math.min(...adj.map(w=>w.top))-.05,Math.max(...adj.map(w=>w.seal)));}
  // Lap where a junction vertex stands outside the parapet's outer edge (v0: 0.35 m of open air between pier and parapet).
  for(const v of [0,ENCLOSURE_EDGES]){const p=CEMETERY[v],st=runs.flatMap(r=>r.stations).reduce((m,s)=>Math.hypot(s.x-p[0],s.z-p[1])<Math.hypot(m.x-p[0],m.z-p[1])?s:m);
    const out=(p[0]-st.T[0])*st.nx+(p[1]-st.T[1])*st.nz;if(out<=.02)continue;
    const t=[-st.nz*SEAL.half,st.nx*SEAL.half],e=enclosure.find(w=>same(w.p,p)||same(w.q,p));
    seal([[p[0]+t[0],p[1]+t[1]],[p[0]-t[0],p[1]-t[1]],[st.T[0]-t[0],st.T[1]-t[1]],[st.T[0]+t[0],st.T[1]+t[1]]].map(q=>q),e.bottom,e.seal);}
  // Historic parapets facing the cemetery: seal from the drawn parapet top to 2.6 m above it (B: launches off the walk
  // cleared it by more than 2 m).
  let parapetSeals=0;
  for(const {a,b,walk,run} of walls){if(run==='elbow')continue;const m=[(a.T[0]+b.T[0])/2,(a.T[1]+b.T[1])/2],o=[m[0]+a.nx*4,m[1]+a.nz*4];
    if(!inRing(o[0],o[1],CEMETERY))continue;
    if(seal([a.T,b.T,b.Q,a.Q],walk+PARAPET.riseIn-.05,walk+PARAPET.riseIn+SEAL.parapet))parapetSeals++;}
  // Private interior for checked placement, recovery and map arrival: inside the ring, outside the wall's footprint
  // (the wall walk crosses the ring high above the field). A rider who still ends up inside recovers to a recorded
  // safe point outside.
  const foot=walls.flatMap(({a,b})=>convexPieces([a.B,b.B,b.W,a.W])).map(q=>({q,b:bounds(q)})),cbx=bounds(CEMETERY);
  // Seams (2026-11-18): the historic wall's cemetery-side foot B stands up to 1.6 m inside the mapped ring line
  // (Santo Domingo – San Antonio elbow, v21), so a strip of field outside the ring counted as public: a checked start or a
  // recovery there rolled straight into the field (cemetery.mjs, also on base 797017c). The apron outward of every
  // cemetery-facing interval's foot (3 m, toward the field) is private too; the wall footprint and walk stay public.
  const apron=walls.filter(({a,b})=>{const m=[(a.B[0]+b.B[0])/2,(a.B[1]+b.B[1])/2];return inRing(m[0]+a.nx*4,m[1]+a.nz*4,CEMETERY);})
    .map(({a,b})=>{const r=[a.B,b.B,[b.B[0]+b.nx*3,b.B[1]+b.nz*3],[a.B[0]+a.nx*3,a.B[1]+a.nz*3]];return signedArea(r)<0?[...r].reverse():r;})
    .filter(r=>Math.abs(signedArea(r))>1e-4).flatMap(r=>convexPieces(r)).map(q=>({q,b:bounds(q)}));
  const inApron=(x,z)=>apron.some(({q,b})=>x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3]&&inRing(x,z,q));
  const offLimitsAt=cemeteryAt(cbx,CEMETERY,apron,foot); // same test; sj-private.js keeps only these lists alive

  const places=[{name:'Cementerio Santa María Magdalena de Pazzis',x:THROAT[0],z:THROAT[1],source:28966510}];
  const cemetery={ring:CEMETERY,enclosure,piers,gate:gateRec,chapel,tombs,axis:{u:U,p:PN}};
  // Seams (`streets` privateRings contract): the private ground as polygons, so `streets` paves exactly to
  // the cemetery's edge instead of stopping on whole 2 m cells. The ring and its field-side aprons; `offLimitsAt` also
  // exempts the wall footprint (+0.3 m), which `streets` never paves anyway (a wall band owner).
  const privateRings=[CEMETERY.map(p=>[p[0],p[1]]),...apron.map(({q})=>q.map(p=>[p[0],p[1]]))];
  const layout={runs,walls,ends,stations:runs.flatMap(r=>r.stations),passage,cemetery,colliders,tops,cuts,tint,surfaces,floorTriangles,places,offLimitsAt,privateRings,
    seal:{fence:fenceSeals.length,parapets:parapetSeals},
    constants:{PARAPET,PASSAGE,FIT,FLOOR_BAND,GATE,CHAPEL}};
  const r3=v=>+v.toFixed(3);
  layout.qa=()=>({runs:runs.map(r=>({name:r.name,stations:r.stations.length,drawn:r.drawn,open:r.open})),repaired,dips,notches,unified,elbow:!!elbow,
    walls:walls.length,ends:ends.length,
    passage:{origin:O.map(r3),ax:AX[0],az:AX[1],px:VX[0],pz:VX[1],uOut:r3(uOut),uFront:r3(uFront),uBlk:r3(uBlk),uR0:r3(uR0),uRear:r3(uRear),
      outerY:r3(outerY),innerY:r3(innerY),blockTop:r3(blockTop),rearTop:r3(rearTop),cover:r3(cover),half,lane:lane.length,
      laneEnd:lane.at(-1).c.map(r3),laneLength:r3(lane.at(-1).s)},
    cemetery:{enclosure:enclosure.length,piers:piers.length,tombs:tombs.length,gate:[gateC[0],gateC[1]].map(r3),gateInward:gateIn.map(r3),chapel:[C.x,C.z,r3(cg)]},
    colliders:colliders.length,tops:tops.length,cuts:cuts.length,surfaces:surfaces.length,tint:tint.size,places:places.map(p=>p.name)});
  return layout;
}
