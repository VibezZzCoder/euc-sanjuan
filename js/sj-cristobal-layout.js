/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// San Cristóbal exterior / Plaza Colón (Wikimedia Commons curid=127996363, curid=82861896, curid=14719072, curid=109811940, curid=109811944, curid=124496780, curid=49414779, curid=11855283, curid=34390675, curid=71286745, curid=31949754) — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// area module. Shared physical/render owner: sj-cristobal.js draws exactly these numbers.
// Area contract (all fields consumed generically by sj-world.js / sj-plaza.js / main.js):
//   colliders  — SfTerrainSampler colliders (prisms {outer,holes,minY,maxY,surface,support} or boxes {centre,halfExtents,rotationY})
//   tops       — replacement/support floors (same shape as sj-gate-layout / sj-fort-layout tops)
//   cuts       — render-only convex terrain cuts {planes,minX,maxX,minZ,maxZ}
//   tint       — Map(terrain vertex index → tone name ('rock','lawn','paseo','stone','masonry') or '#rrggbb')
//   surfaces   — [{ring,kind}] draped overlays; kind ∈ plaza|sett|asphalt|paseo|morro (single owner, convex)
//   floorTriangles — authored floor triangles [[x,y,z]×3] drawn in the sett 'passage' batch
//   places     — map arrivals [{name,x,z,source}]
//   trees      — mapped city.trees this area draws itself ({x,z} equal to the city entry); sj-world skips them
// Mapped vs inferred:
import {fitRun,wallBody} from './sj-fort-layout.js';
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea,subtractRing} from './sj-paving.js';
import {rideableFlight,stairRecord,registerStairFlights} from './sj-stairs.js';

// OSM 142863669 Castillo San Cristóbal (historic=castle), mapped order: (−uz,ux) of every edge points out of the fort.
export const CRISTOBAL_OUTLINE=[[530.05,-254.72],[531.26,-243.67],[531.89,-237.93],[540.2,-223.06],[541.47,-221.05],[542.94,-218.39],
  [561.12,-185.62],[582.16,-166.26],[588.76,-154.55],[583.98,-144.56],[572.12,-151.94],[571.26,-151.6],[571.59,-150.72],[593.94,-134.79],
  [593.25,-133.21],[593.99,-131.06],[589.37,-125.55],[582.51,-128.14],[582.17,-135.78],[580.83,-135.84],[581.32,-122.85],[594.84,-118.02],
  [601.12,-126.8],[621.43,-155.49],[639.14,-194.73],[639.97,-196.56],[647.32,-192.81],[658.91,-186.9],[655.31,-178.47],[679.86,-180.35],
  [731.49,-184.37],[729.89,-187.27],[702.07,-237.08],[701.36,-238.34],[690.99,-249.61],[692.61,-251.27],[696.3,-255.1],[695.29,-256.01],
  [694.64,-256.62],[692.36,-254.26],[689.29,-257.29],[692.92,-260.53],[714.49,-279.76],[668.7,-291.88],[615.21,-265.58]];
// Outer works (OSM 509326338 / 509326337, historic=castle) and the north glacis (meadow 509299738): tinted DEM only.
const OUTWORKS=[[[657.98,-106.87],[677.77,-120.88],[672.74,-169.46],[653.48,-168.69],[648.3,-153.83],[645.79,-155.17],[638.88,-142.09],
  [641.79,-141.69],[635.21,-132.5],[633.16,-133.65],[626.45,-123.41],[627.09,-122.78],[649.05,-120.57],[650.77,-117.94],[642.07,-111.91],
  [645.87,-106.4],[654.3,-112.51]],[[695.82,-109.47],[693.26,-108.2],[687.45,-104.5],[683.22,-101.64],[680.54,-99.89],[678.41,-98.63],
  [674.66,-98.64],[670.61,-99.55],[668.14,-101.39],[666.86,-103.49],[682.44,-114.62],[684.85,-118.91],[680.1,-170.24],[730.32,-173.61],
  [736.2,-174.53],[736.97,-173.55],[742.07,-164.33],[778.98,-177.42],[850.79,-184.11],[851.57,-182.92],[861.49,-184.6],[860.92,-186.86],
  [879.6,-191.4],[882.02,-185.59],[853.27,-174.33],[734.43,-152.07],[695.19,-147.28],[697.31,-144.89],[691.72,-144.9],[694.77,-121.24],
  [692.93,-114.48]]];
const GLACIS=[[481.93,-252.03],[452.54,-273.9],[459.04,-287.98],[438.84,-322.38],[439.65,-328.2],[458.92,-323.27],[472.37,-321.73],
  [484.97,-315.53],[507.5,-315.25],[520.53,-313.98],[539.37,-312.57],[567.84,-309.62],[586.39,-307.93],[601.98,-314.97],[617.56,-313.85],
  [617.42,-300.61],[656.23,-298.92],[673.09,-300.19],[668.7,-291.88],[615.21,-265.58],[530.05,-254.72],[497.98,-262.62]];
// West of the fort (apron tint only): OSM landuse=grass 311914275 and Bastión San Sebastián 1024680664 (Wikimedia Commons curid=109811940: grass).
const GRASS_WEST=[[346.83,-271.48],[354.78,-298.61],[432.32,-313.5],[447.86,-286.55],[438.19,-267.9],[418.87,-275.62],[350.62,-270.15]];
const BASTION_SS=[[452.54,-273.9],[459.04,-287.98],[438.84,-322.38],[428.75,-320.46],[348.97,-305.33],[339.7,-276.25],[338.66,-270.83],
  [344.03,-269.49],[414.58,-274.63],[444.18,-270.12]];
// North shore below the glacis (apron tint only; Wikimedia Commons curid=82861896, curid=11855283: dark rock at the waterline, green scrub above):
// natural=bare_rock 509299731/509299732/509299735 as rock, natural=scrub 509326334 as grass. Beach 509299737 stays pale.
const SHORE_ROCK=[[[617.6,-313.9],[623.0,-314.6],[627.5,-312.2],[630.5,-308.5],[633.4,-310.8],[640.1,-307.8],[649.0,-308.4],[656.9,-308.8],
  [663.5,-311.4],[671.5,-311.4],[675.9,-307.4],[674.5,-303.8],[673.1,-300.2],[664.9,-297.9],[656.2,-298.9],[646.6,-299.9],[637.2,-299.2],
  [617.4,-300.6],[616.6,-303.9],[616.1,-305.8]],[[668.1,-335.7],[669.5,-332.6],[668.8,-330.4],[665.9,-326.9],[663.9,-324.5],[659.5,-319.1],
  [658.6,-317.1],[644.6,-317.4],[641.8,-317.5],[621.2,-318.5],[616.9,-320.5],[605.8,-318.8],[602.0,-315.0],[597.2,-312.6],[593.6,-312.9],
  [595.8,-319.1],[597.6,-321.5],[616.7,-326.9],[618.7,-328.2],[615.1,-330.9],[612.0,-335.0],[625.5,-338.5],[632.8,-334.0],[641.3,-332.3],
  [658.2,-335.6],[663.9,-334.0]],[[461.5,-334.6],[467.3,-332.9],[471.9,-331.6],[477.6,-330.9],[482.7,-332.6],[489.3,-331.7],[494.0,-329.6],
  [501.9,-329.0],[508.6,-329.3],[514.7,-330.5],[520.0,-331.8],[524.2,-331.3],[528.4,-328.0],[532.3,-327.1],[535.4,-329.7],[541.2,-329.3],
  [549.5,-325.9],[558.4,-324.8],[566.3,-323.7],[564.8,-332.9],[540.6,-333.7],[535.9,-340.6],[527.2,-343.2],[508.2,-334.8],[477.5,-337.8],
  [464.9,-339.2],[457.6,-339.9],[451.1,-342.2],[443.6,-344.3],[429.2,-349.1],[435.1,-344.4],[440.9,-343.3],[446.7,-339.9],[453.0,-337.0]]];
const SHORE_SCRUB=[[675.9,-307.4],[674.4,-317.4],[667.6,-314.6],[659.3,-314.9],[653.8,-314.0],[646.2,-313.4],[645.2,-315.9],[644.6,-317.4],
  [641.8,-317.5],[621.2,-318.5],[616.9,-320.5],[605.8,-318.8],[602.0,-315.0],[606.9,-312.6],[609.1,-311.2],[617.6,-313.9],[623.0,-314.6],
  [627.5,-312.2],[630.5,-308.5],[633.4,-310.8],[640.1,-307.8],[649.0,-308.4],[656.9,-308.8],[663.5,-311.4],[671.5,-311.4]];
// OSM 260863192 "Fuerte San Cristóbal": the 27.5 m entrance terrace beside the ramp (Wikimedia Commons curid=124496780: lawn and benches).
const TERRACE_LAWN=[[484.91,-241.23],[500.96,-252.29],[531.26,-243.67],[531.89,-237.93],[540.2,-223.06],[528.3,-216.5],[521.99,-214.74],
  [516.35,-215.03],[512.26,-217.15],[506.69,-223.01],[502.27,-230.65],[498.99,-228.54],[495.13,-232.03]];
// Fitted fronts (2 m station survey, docs): the north/Atlantic faces 41→0 stand 7–23 m over the glacis and continue round the
// west flank 1→3 runs to the main gate (vertex 4, sally port node 2664381178); the land front 5→8 starts on its other side;
// the south-east faces 22→24 (10–22 m) and the east faces 28→32 (10–14 m). The hornwork jogs 9→21, the low east tip and
// the NE stair corner 33→40 (OSM steps 684010778/84) are left as tinted DEM. No return at the gate: the frontispiece
// closes the gap between the two run ends (a return there mitred its foot across the ramp axis).
// The 11 m tip 0→1 is not a wall in the DEM (the fort side dips below the 26–27 m entrance terrace): the north run ends at
// vertex 0 and the gate's west flank starts at vertex 1.
// Run ends where the fitted crest climbs onto the 45–46 m inner cavaliers stood as isolated slabs (first renders): the land
// front stops at its salient 7 (7→8 descends 46→32 m in 13 m) and the south-east front starts 30 % along 22→23, where its
// crest has reached the 31 m terreplein (the first 10 m rise 21→31 m along the hornwork flank).
const RUNS=[{name:'north',ids:[41,42,43,44,0],returns:[true,true]},{name:'gate-west',ids:[1,2,3],returns:[true,false]},
  {name:'land',ids:[5,6,7],returns:[false,false]},
  {name:'southeast',ids:['22+',23,24],returns:[false,true]},{name:'east',ids:[28,29,30,31,32],returns:[true,true]},
  // Wikimedia Commons curid=82861896 (from the outer work's terreplein): the entrance terrace's north edge (OSM 260863192, reversed so (−uz,ux)
  // points north over the glacis) stands ~9 m as a paler cream/ochre wall with a salient garita.
  {name:'terrace',ids:['t0','t1','t2'],returns:[false,false]}];
const TERRACE_NORTH={t0:[531.26,-243.67],t1:[500.96,-252.29],t2:[484.91,-241.23]};
const RETURN=7;
// OSM 270860925 (bridge=yes footway) from the Norzagaray side to the sally port; its last node is replaced by the gate axis.
const RAMP=[[500.46,-229.49],[505.46,-221.23],[507.46,-218.33],[509.47,-216.66],[512.16,-214.87],[515.21,-213.56],[519.23,-212.53],
  [521.68,-212.45],[525.23,-213.24],[529.51,-214.7],[533.04,-216.33]];
// Wikimedia Commons curid=124496780: a 3.5 m ramp between dark ashlar walls with a heavy rounded coping, rising along Norzagaray to the gate.
export const RAMP_SECTION={half:1.75,wall:.5,parapet:1.0,lead:5,landing:3};
// Wikimedia Commons curid=49414779: round-arched rusticated stone gate, cornice with broken-pediment corners and two ball finials on pedestals.
// Proportions estimated from the frame (opening ≈ 3.5 m, frontispiece wider than tall to the cornice; the first, narrower
// 7.2 m × 6.2 m draft read tower-like beside Wikimedia Commons curid=49414779); doors shown CLOSED (fort interior outside scope).
export const GATE={half:4.3,openHalf:1.75,spring:2.6,rise:.9,proud:.5,door:.3,cornice:5.6,finial:1.6};

// Plaza Colón (OSM 196605697, paving_stones; Wikimedia Commons curid=127996363, curid=71286745, curid=31949754). Monument node 2990313569 (Aquiles Canessa, 1894).
const PLAZA=[[510.33,-49.05],[504.75,-43.1],[473.68,-41.58],[457.39,-99.97],[526.66,-112.32],[527.3,-112.38],[533.76,-112.98],
  [531.54,-108.79],[516.44,-105.19],[509.36,-103.08],[510.25,-53.86]];
export const MONUMENT=[489.04,-67.1];
const BENCHES=[[466.36,-99.62],[475.56,-101.17],[504.88,-105.68]];   // OSM 4123994929/31/33 (backrest=yes)
// Raised terrace: the DEM itself holds it (level 11.8 m from x≈476–501, z≈−79.5…−51; the monument footprint is a 10 m
// non-ground hole at 11.0). Wikimedia Commons curid=127996363 from Teatro Tapia: central stair, cascade basins west, round balustraded bastion east.
export const TERRACE={minX:476,maxX:501,minZ:-79.5,maxZ:-51};
export const MONUMENT_DIMS={base:10.4,step:8.0,pedestal:3.6,cornice:4.1,pedestalTop:3.9,shaft:7.6,shaftR:.62,statue:1.75};
// STAIR.risers × STAIR.tread is the cascade/bastion datum (zEdge → zFoot); the flight itself is fitted below (
// 2026-11-19: public stairs ride up and down).
const STAIR={half:5.5,risers:7,tread:.48};

const unit=(a,b)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
function convexPlanes(ring) {
  // Vertical planes of a convex ring (any winding): inside ⇔ a·x+c·z+d>0 for every plane.
  const s=Math.sign(signedArea(ring));
  return ring.map((p,i)=>{const q=ring[(i+1)%ring.length],ex=q[0]-p[0],ez=q[1]-p[1];
    // Left of edge for CCW (s>0): normal (−ez, ex).
    const nx=-ez*s,nz=ex*s,l=Math.hypot(nx,nz);return [nx/l,0,nz/l,-(nx*p[0]+nz*p[1])/l];});
}
const boxOf=(ring,planes)=>({planes,ring,minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),
  minZ:Math.min(...ring.map(p=>p[1])),maxZ:Math.max(...ring.map(p=>p[1]))});
function triangulate(ring) {
  // Ear clipping of a simple polygon into CCW triangles (convex overlay pieces).
  let idx=ring.map((_,i)=>i);const out=[],ccw=signedArea(ring)>0;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const inside=(p,a,b,c)=>cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0;
  let guard=0;
  while(idx.length>3&&guard++<1000){
    for(let k=0;k<idx.length;k++){const i0=idx[(k+idx.length-1)%idx.length],i1=idx[k],i2=idx[(k+1)%idx.length];
      let a=ring[i0],b=ring[i1],c=ring[i2];if(!ccw)[a,c]=[c,a];
      if(cross(a,b,c)<=1e-9)continue;
      if(idx.some(j=>j!==i0&&j!==i1&&j!==i2&&inside(ring[j],a,b,c)))continue;
      out.push([a,b,c]);idx.splice(k,1);break;}}
  const [a,b,c]=idx.map(i=>ring[i]);out.push(ccw?[a,b,c]:[c,b,a]);
  return out;
}
const plane=tri=>{const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;return {x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny};};

export function createCristobalLayout({city,height,terrain,surface,gate,fort}) {
  void gate;
  const colliders=[],tops=[],cuts=[],surfaces=[],floorTriangles=[];
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  const {PARAPET,PLINTH}=fort?.constants??{PARAPET:{thick:.8,rise:1.0,cordon:.3},PLINTH:{proud:.12,rise:.5}};
  const O=CRISTOBAL_OUTLINE;

  // ---- Fitted ramparts (El Morro rules: per-run DEM fit, local crest closing, 4 m toe cap, drawn intervals ≥1.2 m). ----
  const withReturns=(pts,[head,tail])=>{const dir=(a,b)=>unit(a,b);const out=[...pts];
    if(head){const [ux,uz]=dir(pts[0],pts[1]);out.unshift([pts[0][0]+uz*RETURN,pts[0][1]-ux*RETURN]);}
    if(tail){const [ux,uz]=dir(pts.at(-2),pts.at(-1));out.push([pts.at(-1)[0]+uz*RETURN,pts.at(-1)[1]-ux*RETURN]);}
    return out;};
  const vertex=i=>i==='22+'?[O[22][0]+(O[23][0]-O[22][0])*.3,O[22][1]+(O[23][1]-O[22][1])*.3]:TERRACE_NORTH[i]??O[i];
  const runs=RUNS.map(r=>({name:r.name,ids:r.ids,returns:r.returns,...fitRun(withReturns(r.ids.map(vertex),r.returns),height)}));
  // San Cristóbal's north face 43→44 rises behind a lower DEM ledge (28.6–29.2 m) a metre or two out: the toe search stops
  // in the dip before it and the ledge buried the plinth by up to 0.33 m. The drawn plinth sits on the highest ground
  // within 3 m in front (face and bottom unchanged; lift capped at 1.5 m).
  for(const r of runs)for(const s of r.stations){let hi=-Infinity;
    for(let d=0;d<=3.001;d+=.25)hi=Math.max(hi,height(s.F[0]+s.nx*d,s.F[1]+s.nz*d));
    const lift=Math.min(1.5,hi+.05-PLINTH.rise-s.base);if(lift>0){s.base+=lift;s.ledge=lift;}}
  const walls=[],ends=[];
  for(const run of runs){const list=run.segs.flatMap(g=>g.stations.slice(0,-1).map((a,i)=>({a,b:g.stations[i+1]})));
    // Also not drawn: intervals whose crest jumps >3 m in one ≤2 m step. Where the 2 m DEM's inner cavaliers (45–46 m) meet
    // a 33 m curtain at a run end, the fitted crest climbs 11–14 m in a few metres and stood as a thin masonry fin (first
    // render, land vertex 7 and the south-east return); the tinted DEM shows there instead.
    const drawn=list.map(({a,b})=>Math.min(a.walk-a.base,b.walk-b.base)>=1.2&&Math.abs(a.walk-b.walk)<=3);
    list.forEach(({a,b},i)=>{if(!drawn[i])return;
      const walk=Math.max(a.walk,b.walk);walls.push({a,b,walk,run:run.name});
      wallBody(prism,a,b,Math.min(a.bottom,b.bottom)-.2,walk);
      prism([a.T,b.T,b.Q,a.Q],Math.min(a.crest,b.crest)-1.5,walk+PARAPET.rise);
      if(!drawn[i-1])ends.push({s:a,dir:-1});if(!drawn[i+1])ends.push({s:b,dir:1});});
    run.open=drawn.filter(d=>!d).length;run.drawn=drawn.filter(Boolean).length;}
  // Garitas on tall salients only (Wikimedia Commons curid=82861896, curid=34390675: domed sentry boxes on the salient angles; positions inferred from the outline).
  const garitas=[];
  for(const run of runs){const off=run.returns[0]?1:0;
    for(let k=1;k<run.segs.length;k++){const a=run.segs[k-1],b=run.segs[k];
      if((run.returns[0]&&k===1)||(run.returns[1]&&k===run.segs.length-1))continue;
      const turn=a.ux*b.nx+a.uz*b.nz;
      const tip=a.stations.at(-1),rise=Math.max(...[...a.stations.slice(-4),...b.stations.slice(0,4)].map(s=>s.top-s.base));
      if(turn<.45||rise<6||!walls.some(w=>w.a===tip||w.b===tip))continue;
      const bx=a.nx+b.nx,bz=a.nz+b.nz,l=Math.hypot(bx,bz),x=tip.T[0]+bx/l*.35,z=tip.T[1]+bz/l*.35,y=tip.walk-.55;
      garitas.push({x,z,y,radius:.8,body:2.15,corbel:1.15,wallNx:bx/l,wallNz:bz/l,run:run.name,vertex:run.ids[k-off]});
      prism(circle(x,z,.86,14),y-.05,y+2.15+.95);}}

  // ---- Main gate frame (Wikimedia Commons curid=49414779) between the north run's end (vertex 3) and the land run's start (vertex 5). ----
  const v3=O[3],v5=O[5],G=[(v3[0]+v5[0])/2,(v3[1]+v5[1])/2],[tx,tz]=unit(v3,v5),ax=tz,az=-tx,px=tx,pz=tz;
  const P=(u,v)=>[G[0]+ax*u+px*v,G[1]+az*u+pz*v];
  const UV=(x,z)=>{const dx=x-G[0],dz=z-G[1];return [dx*ax+dz*az,dx*px+dz*pz];};
  const allStations=runs.flatMap(r=>r.stations);
  const portal=allStations.filter(s=>{const [u,v]=UV(s.x,s.z);return Math.abs(v)<GATE.half+1.5&&Math.abs(u)<9&&(s===runs[1].stations.at(-1)||s===runs[2].stations[0]||Math.abs(v)<GATE.half+.5);});
  const uFoot=Math.min(...portal.map(s=>UV(...s.F)[0])),uFront=uFoot-GATE.proud,uDoor=uFront+GATE.door;
  const uBack=Math.max(uFront+1.6,Math.max(...portal.map(s=>UV(...s.T)[0]))+.05);
  // Gate threshold: the fort's inner level just behind the gate (median DEM).
  const inner=[];for(let u=2;u<=8;u+=1)for(let v=-2;v<=2;v+=1)inner.push(height(...P(u,v)));inner.sort((a,b)=>a-b);
  const yGate=inner[Math.floor(inner.length/2)];

  // ---- Entrance ramp (OSM 270860925; Wikimedia Commons curid=124496780). Bounded replacement deck over a render-only cut, walls both sides. ----
  const {half,wall,parapet,lead,landing}=RAMP_SECTION,outerHalf=half+wall;
  const [d0x,d0z]=unit(RAMP[0],RAMP[1]),S0=[RAMP[0][0]-d0x*lead,RAMP[0][1]-d0z*lead];
  const centre=[S0,...RAMP.filter(p=>UV(...p)[0]<uFront-2.5),P(uFront-landing,0),P(uFront,0),P(uDoor+.005,0)];
  const pts=[];for(let i=0;i<centre.length;i++){const p=centre[i];if(i===0){pts.push(p);continue;}
    const q=centre[i-1],L=Math.hypot(p[0]-q[0],p[1]-q[1]),n=Math.max(1,Math.ceil(L/2.2));
    for(let k=1;k<=n;k++)pts.push([q[0]+(p[0]-q[0])*k/n,q[1]+(p[1]-q[1])*k/n]);}
  const segN=pts.slice(1).map((q,i)=>{const [ux,uz]=unit(pts[i],q);return [-uz,ux];});
  let s=0;const rows=pts.map((p,i)=>{if(i)s+=Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1]);
    let side;
    if(UV(...p)[0]>=uFront-landing-1e-6)side=[px,pz];
    else{const a=segN[Math.max(0,i-1)],b=segN[Math.min(segN.length-1,i)],mx=a[0]+b[0],mz=a[1]+b[1],m=Math.hypot(mx,mz)||1;
      const k=1/Math.max(.6,(mx*b[0]+mz*b[1])/m);side=[mx/m*k,mz/m*k];}
    return {p,s,side};});
  const sLevel=rows.find(r=>UV(...r.p)[0]>=uFront-landing-1e-6).s;
  const y0=height(...S0);
  const deckAt=s=>y0+(yGate-y0)*Math.min(1,s/sLevel);
  const across=[-outerHalf,-half,0,half,outerHalf];
  for(const [i,r] of rows.entries()){
    r.y=deckAt(r.s);r.at=v=>[r.p[0]+r.side[0]*v,r.p[1]+r.side[1]*v];
    r.points=across.map(v=>{const [x,z]=r.at(v);return [x,i===0?height(x,z)+.015:r.y,z];});
  }
  const ramp={rows,sLevel,length:rows.at(-1).s,y0,yGate,outerHalf,grade:(yGate-y0)/sLevel,deckTriangles:[],sides:[]};
  for(let r=0;r+1<rows.length;r++){const A=rows[r].points,B=rows[r+1].points;
    for(let i=0;i+1<A.length;i++)for(const tri of [[A[i],B[i+1],B[i]],[A[i],A[i+1],B[i+1]]]){
      ramp.deckTriangles.push(tri);floorTriangles.push(tri);
      tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:Math.max(tri[0][1],tri[1][1],tri[2][1]),plane:plane(tri),
        replacesTerrain:true,maxReferenceY:Math.max(tri[0][1],tri[1][1],tri[2][1])+2.5,surface:'pavement',source:'cristobal:ramp'});}}
  // Bands (first Wikimedia Commons curid=124496780 render): the 2 m DEM smears the ramp's walls into 1–3.6 m humps up to ~2.5 m beside them (street
  // side rows 13–16 and 24–33). A 2.5 m band beside each wall is cut and replaced — drawn and physical — by ground falling
  // from a foot level (lowest kept edge height of the neighbouring rows) to the exact kept terrain at its outer edge
  // (grid-line and diagonal crossings of the shared triangles). Masonry skirts close the band ends (El Morro moat bands).
  const B=2.5,{x0:tx0,z0:tz0,step:tstep}=terrain;
  const profile=(a,b)=>{const ts=new Set([0,1]),dx=b[0]-a[0],dz=b[1]-a[1];
    const add=(f0,df,c0)=>{if(Math.abs(df)<1e-12)return;const lo=Math.min(f0,f0+df),hi=Math.max(f0,f0+df);
      for(let k=Math.ceil((lo-c0)/tstep);c0+k*tstep<=hi+1e-9;k++){const t=(c0+k*tstep-f0)/df;if(t>1e-9&&t<1-1e-9)ts.add(t);}};
    add(a[0],dx,tx0);add(a[1],dz,tz0);add(a[0]+a[1],dx+dz,tx0+tz0);
    return [...ts].sort((p,q)=>p-q).map(t=>{const x=a[0]+dx*t,z=a[1]+dz*t;return {t,x,z,y:height(x,z)};});};
  const last=rows.findIndex(r=>UV(...r.p)[0]>=uFront-1e-6);
  const bands=[];
  for(const side of [-1,1]){const prof=rows.slice(0,last).map((a,r)=>profile(a.at(side*(outerHalf+B)),rows[r+1].at(side*(outerHalf+B))));
    const lows=prof.map(q=>Math.min(...q.map(p=>p.y)));
    const foot=rows.slice(0,last+1).map((_,i)=>Math.min(lows[i-1]??Infinity,lows[i]??Infinity));
    foot[0]=Math.min(foot[0],height(...rows[0].at(side*outerHalf)));
    const tris=[],skirts=[];
    for(let r=0;r<last;r++){const a=rows[r],b=rows[r+1],A=a.at(side*outerHalf),Bp=b.at(side*outerHalf);
      const q=prof[r];
      const inner=t=>[A[0]+(Bp[0]-A[0])*t,foot[r]+(foot[r+1]-foot[r])*t,A[1]+(Bp[1]-A[1])*t];
      for(let k=0;k+1<q.length;k++){const I0=inner(q[k].t),I1=inner(q[k+1].t),Q0=[q[k].x,q[k].y,q[k].z],Q1=[q[k+1].x,q[k+1].y,q[k+1].z];
        tris.push([I0,Q0,Q1],[I0,Q1,I1]);}}
    for(const [r,dir] of [[0,-1],[last,1]]){const pr=profile(rows[r].at(side*outerHalf),rows[r].at(side*(outerHalf+B))),yo=pr.at(-1).y,rowsOut=[];
      for(const q of pr){const f=foot[r]+(yo-foot[r])*q.t;rowsOut.push([[q.x,f,q.z],[q.x,Math.max(f,q.y),q.z]]);}
      const t=unit(rows[Math.max(0,r-1)].p,rows[Math.min(rows.length-1,r+1)].p);
      skirts.push({dir,rows:rowsOut,hint:[-dir*t[0],0,-dir*t[1]]});}
    bands.push({side,foot,tris,skirts,lawn:inRing(...rows[Math.floor(last/2)].at(side*(outerHalf+B/2)),TERRACE_LAWN)});
    for(const tri of tris){const pl=plane(tri);if(!Number.isFinite(pl.dx)||!Number.isFinite(pl.dz))continue;
      tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:Math.max(tri[0][1],tri[1][1],tri[2][1]),plane:pl,replacesTerrain:true,
        maxReferenceY:Math.max(tri[0][1],tri[1][1],tri[2][1])+2.5,surface:'pavement',source:'cristobal:ramp-band'});}}
  ramp.bands=bands;
  // Walls: per interval, from below the outer DEM to a parapet over the deck (rising from 0.3 m at the foot, Wikimedia Commons curid=124496780).
  for(const side of [-1,1]){const list=[];
    for(let r=0;r+1<rows.length;r++){const a=rows[r],b=rows[r+1];
      if(UV(...a.p)[0]>=uFront-1e-6)break;
      const outer=[0,.5,1].map(t=>{const pa=a.at(side*(outerHalf+.05)),pb=b.at(side*(outerHalf+.05));return height(pa[0]+(pb[0]-pa[0])*t,pa[1]+(pb[1]-pa[1])*t);});
      const lift=s=>parapet*(.3+.7*Math.min(1,s/4));
      const topA=Math.max(a.y+lift(a.s),outer[0]+.12),topB=Math.max(b.y+lift(b.s),outer[2]+.12);
      const band=bands.find(x=>x.side===side),bottom=Math.min(...outer,a.y,b.y,band.foot[r]??Infinity,band.foot[r+1]??Infinity)-.45;
      list.push({a:r,b:r+1,topA,topB,bottom});
      prism([a.at(side*half),b.at(side*half),b.at(side*outerHalf),a.at(side*outerHalf)],bottom,Math.max(topA,topB));}
    ramp.sides.push({side,list});}
  // Render cut: one convex quad per interval across the whole body (the DEM's smeared ramp ridge rose 0.2 m through the deck).
  for(let r=0;r+1<rows.length;r++){const a=rows[r],b=rows[r+1];
    const w=r<last?outerHalf+B:outerHalf,ring=[a.at(-w),b.at(-w),b.at(w),a.at(w)],planes=convexPlanes(ring);
    if(r===0){const [ux,uz]=unit(a.p,b.p);planes.push([ux,0,uz,-(ux*a.p[0]+uz*a.p[1])-.03]);}
    cuts.push(boxOf(ring,planes));}

  // Gate body (closed: a real end). Bottom below the DEM in front of and under the frontispiece.
  let gateBottom=Math.min(yGate,rows.at(-1).y)-.3;
  for(let u=uFront;u<=uBack;u+=.5)for(const v of [-GATE.half,-1.5,0,1.5,GATE.half])gateBottom=Math.min(gateBottom,height(...P(u,v))-.3);
  const quad=(u0,u1,v0,v1)=>[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)];
  prism(quad(uFront,uBack,-GATE.half,GATE.half),gateBottom,rows.at(-1).y+GATE.cornice);
  const entrance={uFront,uFoot,uBack,uDoor,deckY:rows.at(-1).y,bottom:gateBottom};

  // ---- Plaza Colón ----
  const tset=[];
  for(const [x,z] of city.trees)if(inRing(x,z,PLAZA))tset.push({x,z,y:height(x,z),radius:.28});
  for(const t of tset)prism(circle(t.x,t.z,t.radius,10),t.y-.1,t.y+4);
  // Terrace level from the DEM (median of nodes, monument hole excluded).
  const {x0:gx,z0:gz,step,nx,heights}=terrain;
  const lv=[];for(let j=Math.ceil((TERRACE.minZ+1-gz)/step);gz+j*step<=TERRACE.maxZ-1;j++)for(let i=Math.ceil((TERRACE.minX+1-gx)/step);gx+i*step<=TERRACE.maxX-1;i++){
    const x=gx+i*step,z=gz+j*step;if(Math.abs(x-MONUMENT[0])<6&&Math.abs(z-MONUMENT[1])<6)continue;lv.push(heights[j*nx+i]);}
  lv.sort((a,b)=>a-b);const yT=lv[Math.floor(lv.length/2)];
  const M=MONUMENT_DIMS,[mx,mz]=MONUMENT;
  const sq=(cx,cz,h)=>[[cx-h,cz-h],[cx+h,cz-h],[cx+h,cz+h],[cx-h,cz+h]];
  let holeMin=Infinity;for(const [x,z] of sq(mx,mz,M.base/2))holeMin=Math.min(holeMin,height(x,z));
  {const lo=Math.floor((mx-M.base/2-gx)/step),hi=Math.ceil((mx+M.base/2-gx)/step),lz=Math.floor((mz-M.base/2-gz)/step),hz=Math.ceil((mz+M.base/2-gz)/step);
    for(let j=lz;j<=hz;j++)for(let i=lo;i<=hi;i++)holeMin=Math.min(holeMin,heights[j*nx+i]);}
  const monument={x:mx,z:mz,y:yT,bottom:holeMin-.12,baseTop:yT+.3,stepTop:yT+.6,pedestalTop:yT+.6+M.pedestalTop};
  monument.corniceTop=monument.pedestalTop+.35;monument.shaftBottom=monument.corniceTop+.35;monument.shaftTop=monument.shaftBottom+M.shaft;
  monument.capitalTop=monument.shaftTop+.5;monument.plinthTop=monument.capitalTop+.4;monument.statueTop=monument.plinthTop+1.8*M.statue;
  prism(sq(mx,mz,M.base/2),monument.bottom,monument.baseTop,true);
  prism(sq(mx,mz,M.step/2),monument.baseTop-.05,monument.stepTop,true);
  prism(sq(mx,mz,M.pedestal/2+.1),monument.stepTop-.05,monument.corniceTop);
  prism(circle(mx,mz,M.shaftR+.15,12),monument.corniceTop-.05,monument.statueTop);
  // South front (Wikimedia Commons curid=127996363): stair centred on the monument axis, cascade basins west, a round balustraded bastion east.
  const zEdge=TERRACE.maxZ,run=STAIR.risers*STAIR.tread,zFoot=zEdge+run,sx0=mx-STAIR.half,sx1=mx+STAIR.half;
  let yFoot;
  // public stairs are rideable up and down. The old flight (7 × 0.242 m to the terrace *median*)
  // stood ~0.59 m above the terrace edge it met. The DEM's smeared stair runs from the plaza (≈ 10.0 m, z −47.6) to the
  // flat terrace (≈ 11.8 m, z −53.6); Wikimedia Commons curid=71286745 shows shallow ochre risers (~15 cm) with deep treads beside the cascade.
  // So: foot on the approach ground just south of zFoot, top on the terrace just north of zTop, n = ceil(rise / 0.16)
  // uniform risers. A render cut removes the smeared DEM inside the footprint (treads, risers and cheeks close it); flat
  // replacement tops per tread make physics = drawn until the shared stair support (js/sj-stairs.js) adopts `flight`.
  const zTop=-53.6,med=a=>{a=[...a].sort((p,q)=>p-q);return a[Math.floor(a.length/2)];},line=z=>{const v=[];for(let x=sx0;x<=sx1+1e-6;x+=.5)v.push(height(x,z));return v;};
  yFoot=med(line(zFoot+.3));const yTop=med(line(zTop-.3)),nR=Math.max(1,Math.ceil((yTop-yFoot)/.16)),rise=(yTop-yFoot)/nR,tread=(zFoot-zTop)/nR,steps=[];
  for(let k=0;k<nR;k++){const z1=zFoot-k*tread,z0=z1-tread,topY=yFoot+(k+1)*rise;
    let lo=Infinity,hiDem=-Infinity;for(let x=sx0;x<=sx1+1e-6;x+=.5)for(const z of [z0,(z0+z1)/2,z1]){const h=height(x,z);lo=Math.min(lo,h);hiDem=Math.max(hiDem,h);}
    const bottom=Math.min(lo,yFoot)-.12;steps.push({z0,z1,top:topY,bottom,demMax:hiDem});}
  // Part two (shared stair module, js/sj-stairs.js): the drawn treads are the uniform treads above (with nosings); the
  // physical support is the module's smooth lifted nose-line support blended into the plaza and the terrace (replacement
  // tops; no tread solids). u across from sx0, s up the flight from the foot riser (z = zFoot).
  const rf=rideableFlight({at:(u,s)=>[sx0+u,zFoot-s],u0:0,u1:sx1-sx0,run:zFoot-zTop,yf:yFoot,yt:yTop,n:nR,ground:height,grid:terrain,margin:.035});  // margin as the Capitol's STAIR_MARGIN
  rf.treads.forEach((t,k)=>{steps[k].nosing=t.nosing;});
  for(const tri of rf.tops){const top=Math.max(tri[0][1],tri[1][1],tri[2][1]);
    tops.push({poly:tri.map(p=>({x:p[0],z:p[2]})),top,plane:plane(tri),replacesTerrain:true,maxReferenceY:top+4,surface:'pavement',source:'cristobal:colon-stair'});}
  registerStairFlights('cristobal',[stairRecord(rf,{samples:192})]);
  {const ring=[[sx0,zTop],[sx1,zTop],[sx1,zFoot],[sx0,zFoot]];cuts.push(boxOf(ring,convexPlanes(ring)));}
  // Flight frame for the shared stair module: foot/top lines, width, uphill axis, treads (s from the foot line), landings.
  const flight={id:'cristobal:colon',width:sx1-sx0,axis:[0,-1],foot:{line:[[sx0,zFoot],[sx1,zFoot]],y:yFoot},top:{line:[[sx0,zTop],[sx1,zTop]],y:yTop},
    treads:steps.map((st,k)=>({s0:zFoot-st.z1,s1:zFoot-st.z0,y:st.top,nose:zFoot-st.z1})),risers:{n:nR,h:rise,run:tread},
    landings:{foot:{y:yFoot,depth:3},top:{y:yTop,depth:3}},module:{worstGap:rf.worstGap,maxFloat:rf.maxFloat,lip:rf.lip,lipAt:rf.lipAt,theta:rf.theta,lift:rf.lift,footS:rf.footS,topS:rf.topS,nosing:rf.nosing}};
  const cascade={x0:TERRACE.minX,x1:sx0,z0:zEdge,z1:zFoot,tiers:[]};
  // Tier tops step down the slope but stay ≥0.15 m over the highest ground in their own footprint (the DEM rose up
  // to 0.54 m through the lower basins' water), dropping ≥0.2 m per tier.
  for(let k=0;k<4;k++){const za=zEdge+k*run/4,zb=za+run/4;
    let lo=Infinity,hi=-Infinity;for(let x=cascade.x0;x<=cascade.x1+1e-6;x+=.25)for(let z=za;z<=zb+1e-6;z+=(zb-za)/4){const h=height(x,z);lo=Math.min(lo,h);hi=Math.max(hi,h);}
    const prev=cascade.tiers.at(-1),top=k===0?yT+.35:Math.max(hi+.15,Math.min(prev.top-.2,yT-.2-(k-1)*.55));
    cascade.tiers.push({za,zb,top,water:top-.12,bottom:lo-.12,demMax:hi});}
  prism([[cascade.x0,zEdge-.45],[cascade.x1,zEdge-.45],[cascade.x1,zFoot],[cascade.x0,zFoot]],Math.min(...cascade.tiers.map(t=>t.bottom)),yT+.35);
  const bastion={x:(sx1+TERRACE.maxX)/2,z:zEdge,r:(TERRACE.maxX-sx1)/2,y:yT,parapet:1.0,thick:.32};
  {let lo=Infinity;for(let a=0;a<=Math.PI+1e-6;a+=Math.PI/16)for(const f of [.2,.6,1])lo=Math.min(lo,height(bastion.x+Math.cos(a)*bastion.r*f,bastion.z+Math.sin(a)*bastion.r*f));
    bastion.bottom=lo-.12;}
  // Cheeks: low ochre walls just outside both sides, from below the ground to 0.12 m over the higher of the tread and the
  // ground beside it (the cut's edge never shows), from the foot to the terrace.
  const cheeks=[];for(const [xa,xb] of [[sx0-.3,sx0],[sx1,sx1+.3]]){let lo=Infinity,hi=-Infinity;for(let z=zTop;z<=zFoot+1e-6;z+=.25){const hz=Math.max(height(xa,z),height(xb,z));lo=Math.min(lo,hz);hi=Math.max(hi,hz);}
    const c={x0:xa,x1:xb,z0:zTop,z1:zFoot,bottom:Math.min(lo,yFoot)-.15,rows:[]};
    for(const st of steps){if(xa<sx0&&st.z1>zEdge-.45)continue;  // the cascade's east rim closes that edge
      if(xa>=sx1-1e-9&&st.z1>bastion.z){const nx=Math.max(xa,Math.min(bastion.x,xb)),nz=Math.max(st.z0,Math.min(bastion.z,st.z1));if(Math.hypot(nx-bastion.x,nz-bastion.z)<bastion.r+.05)continue;}  // the drum closes it
      let g=-Infinity;for(const x of [xa,xb])for(const z of [st.z0,(st.z0+st.z1)/2,st.z1])g=Math.max(g,height(x,z));c.rows.push({z0:st.z0,z1:st.z1,top:Math.max(st.top,g)+.12});}
    cheeks.push(c);for(const r of c.rows)prism([[xa,r.z0],[xb,r.z0],[xb,r.z1],[xa,r.z1]],c.bottom,r.top);}
  const arc=(r,a0,a1,n)=>Array.from({length:n+1},(_,i)=>{const a=a0+(a1-a0)*i/n;return [bastion.x+Math.cos(a)*r,bastion.z+Math.sin(a)*r];});
  prism(arc(bastion.r,0,Math.PI,16),bastion.bottom,yT,true);   // half-drum: the diameter is the terrace edge
  for(let i=0;i<8;i++){const a0=i*Math.PI/8,a1=(i+1)*Math.PI/8,o=arc(bastion.r,a0,a1,2),n=arc(bastion.r-bastion.thick,a1,a0,2);
    prism([...o,...n],yT-.1,yT+bastion.parapet);}
  // Terrace side parapets only where the outside falls ≥0.4 m (retaining edge); level crossings stay open (DEM survey).
  const sideWalls=[];
  for(const [x,out] of [[TERRACE.minX,-1],[TERRACE.maxX,1]]){let cur=null;
    for(let z=TERRACE.minZ;z<zEdge-1e-6;z+=1){const drop=yT-height(x+out*1.4,z+.5);
      if(drop>=.4){if(!cur)sideWalls.push(cur={x,out,z0:z,z1:z+1});else cur.z1=z+1;}else cur=null;}}
  for(const w of sideWalls){if(w.z1>zEdge-1.5)w.z1=zEdge;
    let lo=Infinity;for(let z=w.z0;z<=w.z1;z+=.5)for(const d of [0,.45])lo=Math.min(lo,height(w.x+w.out*d,z));w.bottom=lo-.12;
    const xa=w.out<0?w.x-.45:w.x,xb=w.out<0?w.x:w.x+.45;prism([[xa,w.z0],[xb,w.z0],[xb,w.z1],[xa,w.z1]],w.bottom,yT+.95);}
  // Lamps (Wikimedia Commons curid=127996363: white globes on dark posts; positions inferred), benches (OSM, backrest), trees (OSM).
  const lamps=[[sx0-.45,zFoot+.55,2],[sx1+.45,zFoot+.55,2],[TERRACE.minX+1.2,TERRACE.minZ+1.5,1],[TERRACE.maxX-1.2,TERRACE.minZ+1.5,1],
    [476,-44.6,1],[500,-45.6,1],[464,-93,1],[515.5,-108.5,1]].map(([x,z,globes])=>({x,z,y:height(x,z),globes,pedestal:globes===2?1.0:0}));
  // Stair-flank lamps stand on square ochre pedestals (Wikimedia Commons curid=127996363); the pedestal footprint is the shared collider.
  for(const l of lamps){const r=l.pedestal?.36:.2;let lo=Infinity;for(const [dx,dz] of [[-r,-r],[r,-r],[r,r],[-r,r],[0,0]])lo=Math.min(lo,height(l.x+dx,l.z+dz));
    l.bottom=lo-.1;l.base=Math.max(...[[-r,-r],[r,-r],[r,r],[-r,r]].map(([dx,dz])=>height(l.x+dx,l.z+dz)));
    prism(l.pedestal?[[l.x-r,l.z-r],[l.x+r,l.z-r],[l.x+r,l.z+r],[l.x-r,l.z+r]]:circle(l.x,l.z,r,8),l.bottom,l.base+l.pedestal+3.9);}
  const benches=BENCHES.map(([x,z])=>{const heading=Math.atan2(mx-x,mz-z),legs=[-.72,.72].map(u=>({u,ground:height(x+Math.cos(heading)*u,z-Math.sin(heading)*u)}));
    const y=Math.max(...legs.map(l=>l.ground));return {x,z,y,heading,legs,width:1.8,depth:.6,height:.95};});
  for(const b of benches){const low=Math.min(...b.legs.map(l=>l.ground))-.05;
    colliders.push({centre:{x:b.x,y:(low+b.y+b.height)/2,z:b.z},halfExtents:{x:b.width/2,y:(b.y+b.height-low)/2,z:b.depth/2},rotationY:b.heading,surface:'pavement'});}
  // Plaza paving: the mapped polygon as convex ear-clipped pieces (one owner; nothing else overlays this ground).
  const stairCourt=[[sx0,zTop],[sx1,zTop],[sx1,zFoot],[sx0,zFoot]];
  for(const tri of triangulate(PLAZA))for(const ring of subtractRing(tri,stairCourt))surfaces.push({kind:'plaza',ring});
  const plaza={ring:PLAZA,terraceY:yT,monument,steps,cheeks,flight,stair:{x0:sx0,x1:sx1,zEdge,zTop,zFoot,yFoot,yTop,rise,tread},cascade,bastion,sideWalls,lamps,benches,trees:tset};

  // ---- Ground tint (Wikimedia Commons curid=82861896, curid=124496780, curid=11855283, curid=34390675): inside the outline steep cells read as masonry, level tops as terreplein stone
  // and the banks between as grass; the outer works likewise; the north glacis and the entrance terrace lawn as grass. ----
  const tint=new Map();
  if(terrain?.nx){const {x0,z0,nz}=terrain,h=heights;
    const zones=[O,...OUTWORKS,GLACIS,TERRACE_LAWN],all=zones.flat();
    const i0=Math.max(1,Math.floor((Math.min(...all.map(p=>p[0]))-x0)/step)),i1=Math.min(nx-2,Math.ceil((Math.max(...all.map(p=>p[0]))-x0)/step));
    const j0=Math.max(1,Math.floor((Math.min(...all.map(p=>p[1]))-z0)/step)),j1=Math.min(nz-2,Math.ceil((Math.max(...all.map(p=>p[1]))-z0)/step));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=x0+i*step,z=z0+j*step,k=j*nx+i;
      if(inRing(x,z,O)||OUTWORKS.some(r=>inRing(x,z,r))){
        // Level cells below the 30 m terreplein band are ditch/moat floors (Wikimedia Commons curid=34390675: earth/grass floor), not paved terrace.
        const slope=Math.hypot(h[k+1]-h[k-1],h[k+nx]-h[k-nx])/(2*step);tint.set(k,slope>1.1?'masonry':slope<.4&&h[k]>=30?'stone':'lawn');continue;}
      if(inRing(x,z,GLACIS)||inRing(x,z,TERRACE_LAWN))tint.set(k,'lawn');}
    // Apron (review of Wikimedia Commons curid=82861896/east vs Wikimedia Commons curid=82861896, curid=34390675; El Morro's apron rule): sidewalk-class cells within 30 m
    // outside the outline, outer works and terrace edge, and inside the mapped grass west of the fort (landuse=grass
    // 311914275; Bastión San Sebastián 1024680664, Wikimedia Commons curid=109811940's grass terreplein), read as grass — the moat floor, banks and
    // glacis read as a pale beach before. Real streets and their sidewalks (road half-width + 2.6 m; service roads + 0.4 m), footway lines
    // (1.4 m), Plaza Colón's paving and the ramp corridor keep the street colour.
    if(surface){const edges=[O,...OUTWORKS,[TERRACE_NORTH.t0,TERRACE_NORTH.t1,TERRACE_NORTH.t2]].flatMap(r=>r.map((a,q)=>[a,r[(q+1)%r.length]]).slice(0,r===O||OUTWORKS.includes(r)?undefined:-1));
      const grass=[GRASS_WEST,BASTION_SS,SHORE_SCRUB,...SHORE_ROCK];
      const bx0=Math.min(...edges.map(e=>Math.min(e[0][0],e[1][0])))-31,bx1=Math.max(...edges.map(e=>Math.max(e[0][0],e[1][0])))+31;
      const bz0=Math.min(...edges.map(e=>Math.min(e[0][1],e[1][1])),...grass.flat().map(p=>p[1]))-31,bz1=Math.max(...edges.map(e=>Math.max(e[0][1],e[1][1])))+31;
      const gx0=Math.min(...grass.flat().map(p=>p[0]));
      const streets=[];for(const r of city.roads){if(r.kind==='steps'||r.name==='Plaza Colón')continue;const m=['footway','cycleway','pedestrian'].includes(r.kind)?1.4:r.kind==='service'?r.width/2+.4:r.width/2+2.6;
        for(let q=0;q+1<r.points.length;q++){const a=r.points[q],b=r.points[q+1];
          if(Math.max(a[0],b[0])<Math.min(bx0,gx0)-10||Math.min(a[0],b[0])>bx1+10||Math.max(a[1],b[1])<bz0-10||Math.min(a[1],b[1])>bz1+10)continue;streets.push({a,b,m});}}
      const ramped=(x,z)=>rows.some(r=>Math.hypot(r.p[0]-x,r.p[1]-z)<outerHalf+B+.8);
      // Exact prefilter (perf 2026-11-18): a point within m of a segment lies inside the segment's box grown by m, so each
      // 32 m bucket lists the segments whose grown box touches it; the some answers are unchanged.
      const bucket=(list,margin)=>{const g=new Map();list.forEach((e,n)=>{const [a,b]=e,m=margin(e);
          for(let i=Math.floor((Math.min(a[0],b[0])-m)/32);i<=Math.floor((Math.max(a[0],b[0])+m)/32);i++)for(let j=Math.floor((Math.min(a[1],b[1])-m)/32);j<=Math.floor((Math.max(a[1],b[1])+m)/32);j++){
            const k=i*100003+j;let l=g.get(k);if(!l)g.set(k,l=[]);l.push(n);}});
        return (x,z)=>g.get(Math.floor(x/32)*100003+Math.floor(z/32))?.map(n=>list[n])??[];};
      const edgesAt=bucket(edges,()=>30),streetsAt=bucket(streets.map(s=>[s.a,s.b,s.m]),e=>e[2]);
      for(let j=Math.max(1,Math.floor((bz0-z0)/step));j<=Math.min(nz-2,Math.ceil((bz1-z0)/step));j++)
        for(let i=Math.max(1,Math.floor((Math.min(bx0,gx0)-x0)/step));i<=Math.min(nx-2,Math.ceil((bx1-x0)/step));i++){
          const k=j*nx+i;if(tint.has(k)||surface[k]!==0)continue;const x=x0+i*step,z=z0+j*step;
          if(!(grass.some(r=>inRing(x,z,r))||edgesAt(x,z).some(([a,b])=>segmentDistance(x,z,a,b)<30)))continue;
          if(inRing(x,z,PLAZA)||ramped(x,z)||streetsAt(x,z).some(([a,b,m])=>segmentDistance(x,z,a,b)<m))continue;
          tint.set(k,SHORE_ROCK.some(r=>inRing(x,z,r))?'rock':'lawn');}}
    // The ramp's own corridor keeps the street/pavement colour (its deck owns that ground).
    for(const r of rows){const [x,z]=r.p;for(let j=Math.floor((z-4-z0)/step);j<=Math.ceil((z+4-z0)/step);j++)for(let i=Math.floor((x-4-x0)/step);i<=Math.ceil((x+4-x0)/step);i++){
      const px0=x0+i*step,pz0=z0+j*step;if(Math.hypot(px0-x,pz0-z)<outerHalf+.6&&tint.get(j*nx+i)==='lawn')tint.delete(j*nx+i);}}}

  const arrival=[RAMP[0][0]+(RAMP[1][0]-RAMP[0][0])*.3,RAMP[0][1]+(RAMP[1][1]-RAMP[0][1])*.3];
  const places=[{name:'San Cristóbal — rampa de entrada',x:arrival[0],z:arrival[1],source:270860925}];
  const stations=runs.flatMap(r=>r.stations);
  // trunk toes at the centre height floated up to 13.6 cm downhill. Seated by the
  // world's construction pass (seatRecords; footprint grown 10 cm for the bastion-clearance draw shift).
  const seatLists=[{records:tset,radius:t=>t.radius+.1}];
  const layout={seatLists,runs,walls,ends,garitas,stations,frame:{origin:G,ax,az,px,pz,P,UV},ramp,entrance,plaza,colliders,tops,cuts,tint,surfaces,floorTriangles,places,
    trees:tset.map(t=>({x:t.x,z:t.z})),constants:{PARAPET,PLINTH,GATE,RAMP_SECTION,MONUMENT_DIMS,STAIR}};
  layout.qa=()=>({origin:G,ax,az,px,pz,uFront,uDoor,uBack,deckGate:+rows.at(-1).y.toFixed(3),y0:+y0.toFixed(3),grade:+ramp.grade.toFixed(4),
    rampLength:+ramp.length.toFixed(2),rampStart:S0,rampAxis:[d0x,d0z],
    rampProfile:rows.map((r,i)=>{const q=rows[Math.min(rows.length-1,i+1)],p0=rows[Math.max(0,i-1)];
      return [+r.p[0].toFixed(3),+r.p[1].toFixed(3),+r.y.toFixed(3),+Math.atan2(q.p[0]-p0.p[0],q.p[1]-p0.p[1]).toFixed(4)];}),rampMid:rows[Math.floor(rows.length/2)].p,rampMidY:+rows[Math.floor(rows.length/2)].y.toFixed(3),
    runs:runs.map(r=>({name:r.name,stations:r.stations.length,drawn:r.drawn,open:r.open})),garitas:garitas.map(g=>g.run+':'+g.vertex),
    walls:walls.length,colliders:colliders.length,tops:tops.length,cuts:cuts.length,surfaces:surfaces.length,places:places.map(p=>p.name),
    terraceY:+yT.toFixed(3),stairFoot:+yFoot.toFixed(3),rise:+rise.toFixed(4),monument:[mx,mz],monumentTop:+monument.statueTop.toFixed(2),
    stairZ:[zEdge,zFoot],stairX:[sx0,sx1],trees:tset.length,benches:benches.length,lamps:lamps.length,sideWalls:sideWalls.map(w=>[w.x,w.z0,w.z1])});
  return layout;
}
