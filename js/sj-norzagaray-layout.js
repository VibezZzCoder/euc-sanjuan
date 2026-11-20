/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Calle Norzagaray / north city wall / Plaza del Quinto Centenario (Wikimedia Commons curid=80155724, curid=109811940, curid=109811944, curid=38237168) — © 2026 VibezZzCoder, MIT.
// OSM / ODbL; heights: USGS DEM. Area module (contract in the header of sj-princesa-layout.js).
// Shared physical/render owner: sj-norzagaray.js draws exactly these numbers. Mapped vs inferred:
// Mapped: city wall 700234944 (vertices 14→32) + Bastión San Sebastián 1024680664's east flank; Calle de Norzagaray
// 295380549 (asphalt) / 22230175 (paving stones); sidewalks 270987788 (north) / 1339942431 (south); Bajada Matadero
// 224319348 / tunnel 224319347 / 22226152 with sally port node 2331412095; Plaza del Quinto Centenario 196604234;
// Tótem Telúrico node 3141865521 (height 12).
import {fitRun} from './sj-fort-layout.js';
import {unit,bounds,sideOf,ribbon,minus,convexPlanes,plane,withReturns,limitWalkEdge,agreeWalks,wallIntervals} from './sj-city-wall.js';
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {subtractRing,signedArea} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {rideableFlight,stairRecord,registerStairFlights} from './sj-stairs.js';

// OSM 700234944 vertices 14→32 (west → east), then the San Sebastián east flank (1024680664) to its gorge.
export const WALL=[[-179.716,-326.657],[-91.69,-321.033],[-80.695,-336.906],[-59.919,-345.207],[-46.928,-350.719],[-6.189,-342.971],
  [2.461,-320.17],[128.721,-314.835],[130.084,-317.558],[136.653,-330.608],[164.379,-349.026],[196.446,-335.667],[211.878,-303.17],
  [250.662,-295.001],[303.811,-283.812],[339.702,-276.253],[348.975,-305.33],[428.751,-320.462],[438.838,-322.377],[459.044,-287.977],
  [452.538,-273.897]];
// Openings (S1/S2 surveys): the Las Ánimas stair flank 16→17 (steps 270168283 run down outside it) stays open; the east
// footway 311911405 crosses at vertex 27 (±2.5 m); Bajada Matadero passes the Santo Tomás flank root (vertex 22) in a bore.
const FOOTWAY_GAP=2.5,RETURN=3;
// Las Ánimas (OSM steps 270168283 along the wall foot, then footway 256386981 up through the wall line to Calle Norzagaray;
// Wikimedia Commons curid=72372078/#82 for context). The climb: from the steps' east node to the footway's second vertex.
const ANIMAS={foot:[-59.919,-345.207],top:[-57.1,-339.0],half:1.1,maxRise:.165,gap:3.6,apron:2.0,blend:1.0};
// Advance notice on the two approaches to the blind, right-angle turn beside the wall.
// The paved turn is only two metres deep. The stock brake can shed speed before it.
const [ANIMAS_X,ANIMAS_Z]=unit(ANIMAS.foot,ANIMAS.top);
export function animasTurnHint(x,z,heading,speed){
  const dx=ANIMAS.foot[0]-x,dz=ANIMAS.foot[1]-z,d2=dx*dx+dz*dz;
  if(speed<=2.5||d2>18*18||d2<.25)return '';
  const along=Math.sin(heading)*dx+Math.cos(heading)*dz;
  if(along<=0||d2-along*along>2.5**2)return '';
  const u=dx*ANIMAS_Z-dz*ANIMAS_X,s=-dx*ANIMAS_X-dz*ANIMAS_Z;
  return ((u>0&&Math.abs(s+2)<1.8)||(s>0&&Math.abs(u)<1.8))?'Las Ánimas · slow for sharp turn':'';
}
// Rideable-flight support margin (as the Capitol's STAIR_MARGIN, js/sj-eastcivic-layout.js: lean/pitch allowance).
const STAIR_RIDE_MARGIN=.035;
const ANIMAS_START=W=>{const [ux,uz]=unit(W[3],W[4]);return [W[3][0]+ux*ANIMAS.gap,W[3][1]+uz*ANIMAS.gap];};
// Wikimedia Commons curid=80155724, curid=109811940: dark rubble face, no cordón, broad outward-sloping masonry top, grass behind. City-wall batter (gate 1/7).
export const PARAPET={thick:1.4,riseIn:.75,riseOut:.45};
// inner 9 m: the 2 m DEM smears the north wall's drop over ~7 m, so the walk must reach back to the bank (with El Morro's
// 3.5 m it stopped on the smear and left a 6 m inner drop at x≈60).
const FIT={batter:1/7,thick:PARAPET.thick,cordon:0,inner:9};
// Bajada Matadero passage frame: lower road just outside the sally port → upper road anchor in the inner channel (S2).
const PASS_OUT=[128.66,-318.71],PASS_IN=[139.6,-311.85];
export const PASSAGE={half:2.3,spring:2.35,crown:3.25,blockHalf:4.6,clear:3.0};
const FLOOR_BAND=2.5;
// Norzagaray: 22230175 west part (paving stones, one-way west) and 295380549 east part (asphalt) to the Cristóbal bend.
const ROAD_WEST=[[-445.144,-282.088],[-444.363,-282.785],[-442.958,-283.449],[-441.373,-283.87],[-437.296,-284.733],[-436.272,-284.932],
  [-282.454,-315.766],[-237.406,-314.803]];
const ROAD_EAST=[[-237.406,-314.803],[-196.52,-311.947],[-157.926,-309.334],[-114.653,-307.718],[-96.591,-307.275],[-78.53,-307.64],
  [-46.442,-309.389],[-14.301,-307.872],[3.866,-306.168],[32.584,-303.002],[45.491,-301.696],[60.775,-300.191],[74.284,-295.819],
  [91.11,-291.17],[108.812,-287.949],[143.424,-287.108],[169.164,-286.876],[198.031,-282.582],[216.737,-279.118],[243.628,-274.414],
  [282.909,-267.408],[317.638,-264.774],[325.126,-264.022],[336.935,-262.882],[351.236,-261.399],[364.893,-262.384],[377.008,-263.403],
  [390.01,-264.266],[399.463,-265.074],[410.902,-265.772],[417.556,-264.92],[425.816,-263.083],[437.128,-259.076],[452.264,-253.066],
  [463.65,-247.754],[473.885,-241.589]];
// Wikimedia Commons curid=109811944: a pale slab sidewalk on the seaward side, lantern posts at its kerb, grass beyond. OSM 270987788 (to x≈465).
const SIDEWALK_N=[[-475.436,-313.911],[-473.017,-316.368],[-471.084,-317.696],[-468.158,-318.958],[-463.902,-319.611],[-460.469,-319.334],
  [-458.093,-318.692],[-455.41,-317.153],[-452.875,-315.15],[-451.375,-313.047],[-450.066,-310.656],[-449.284,-308.077],[-449.052,-305.443],
  [-449.147,-303.318],[-449.274,-300.517],[-449.084,-297.75],[-447.425,-295.935],[-445.334,-294.23],[-443.285,-292.802],[-441.722,-292.072],
  [-438.521,-291.74],[-401.543,-299.11],[-338.888,-311.772],[-308.986,-317.815],[-293.291,-320.504],[-287.915,-321.268],[-284.535,-321.755],
  [-243.67,-319.784],[-237.449,-320.016],[-218.785,-319.407],[-196.235,-318.256],[-94.13,-313.042],[-87.096,-312.267],[-81.16,-312.422],
  [-52.23,-314.602],[-41.14,-315.532],[-33.324,-315.222],[-14.882,-313.827],[9.506,-311.182],[44.055,-307.762],[52.188,-306.987],
  [59.687,-305.902],[80.167,-300.457],[96.243,-295.498],[102.855,-294.037],[109.752,-293.052],[130.739,-292.964],[140.667,-294.137],
  [164.591,-293.672],[172.565,-293.052],[190.542,-290.407],[207.421,-287.607],[214.561,-286.113],[238.685,-281.553],[247.99,-279.76],
  [277.607,-274.403],[285.423,-273.164],[308.089,-270.828],[327.323,-268.814],[344.518,-267.099],[351.236,-266.789],[364.682,-268.195],
  [393.442,-270.985],[407.67,-272.236],[413.299,-272.701],[417.989,-272.236],[422.055,-271.295],[434.244,-266.481],[448.979,-260.36],
  [462.858,-253.122]];
const SIDEWALK_S=[[-436.314,-280.228],[-428.171,-281.822],[-323.478,-303.879],[-282.739,-311.87],[-272.188,-312.7],[-237.649,-309.999]];
const ROAD={eastHalf:4.2,westHalf:3.2,walkHalf:1.1};
// Lantern posts (Wikimedia Commons curid=109811944) along the north sidewalk's kerb side; spacing inferred (the photo does not resolve it).
const LAMP_STEP=24;
// Plaza del Quinto Centenario (Wikimedia Commons curid=38237168): lower fountain court, broad central stair up toward the Tótem, balustraded cheeks.
export const QUINTO=[[-260.085,-221.24],[-278.377,-306.325],[-277.902,-309.158],[-276.043,-310.553],[-273.909,-311.439],[-241.494,-311.87],
  [-221.184,-229.519],[-221.268,-227.992],[-222.282,-227.04],[-257.18,-219.613],[-258.849,-219.957]];
export const TOTEM={x:-244.843,z:-249.642,height:12,radius:.72,baseRadius:.95,baseHeight:1.15};
// Stair: risers ≥0.22 m (above the 0.216 m EUC step-up, as at Plaza Colón: a real stair, not a ramp in disguise), as many
// as fit the rise from the court to the upper terrace. Axis through the Tótem along the plaza's long direction.
export const STAIR={half:6,minRise:.22,tread:.72,maxRise:.16,fountainR:4.6};

export function createNorzagarayLayout({city,height,terrain,surface,gate,fort,areas={}}) {
  const colliders=[],tops=[],cuts=[],surfaces=[],floorTriangles=[];
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};

  // ---- Passage frame (u inward along Bajada Matadero, v across). ----
  const [ax,az]=unit(PASS_OUT,PASS_IN),px=-az,pz=ax;
  const P=(u,v)=>[PASS_OUT[0]+ax*u+px*v,PASS_OUT[1]+az*u+pz*v];
  const UV=(x,z)=>{const dx=x-PASS_OUT[0],dz=z-PASS_OUT[1];return [dx*ax+dz*az,dx*px+dz*pz];};
  const HB=PASSAGE.blockHalf;
  // Where a wall segment leaves the block side (|v| = HB + margin), walking from its block-side vertex.
  const leave=(from,to,margin=.25)=>{const [ux,uz]=unit(from,to),L=Math.hypot(to[0]-from[0],to[1]-from[1]);
    for(let t=0;t<=L;t+=.05){const q=[from[0]+ux*t,from[1]+uz*t];if(Math.abs(UV(...q)[1])>=HB+margin)return q;}return to;};
  const W=WALL,dir27=unit(W[12],W[13]);
  const at27=s=>[W[13][0]+dir27[0]*s,W[13][1]+dir27[1]*s];
  const RUNS=[
    {name:'animas-west',pts:W.slice(0,3),returns:{west:false,east:true}},
    // (public stairs ride up and down): the run starts 3.6 m east of vertex 17 (−59.92,−345.21), so its
    // west return no longer stands on the Las Ánimas climb (footway 256386981 from the steps' end up to Norzagaray).
    {name:'animas-tomas',pts:[ANIMAS_START(W),...W.slice(4,7),leave(W[7],W[6])],returns:{west:true,east:false}},
    {name:'santo-tomas',pts:[leave(W[8],W[9]),...W.slice(9,13),at27(-FOOTWAY_GAP)],returns:{west:false,east:true}},
    // East end: no return (a 3 m return met the San Sebastián flank at an acute angle and crossed its own section).
    {name:'east-san-sebastian',pts:[at27(FOOTWAY_GAP),...W.slice(14)],returns:{west:true,east:false}}];
  // Fitter convention: (−uz,ux) points out of the city, so runs are fitted east → west. Returns turn RETURN m inward.
  const runs=RUNS.map(r=>{const pts=[...r.pts].reverse();return {name:r.name,...fitRun(withReturns(pts,r.returns.east,r.returns.west,RETURN),height,FIT)};});
  limitWalkEdge(runs,height);
  agreeWalks(runs,height);
  // Curtain/shoulder join (the shoulder stood 0.23 m over the curtain's walk). The Matadero shoulder carries the
  // curtain's end at a level clearing the DEM under it (generous 14 m footprint); the curtain's last stations ease up to
  // it at ≤12 % so the walk meets the shoulder top flush.
  {const ce=runs[1].stations[0],fe=runs[2].stations.at(-1),vs=['B','T','Q','W'].map(k=>UV(...ce[k])[1]);
    const uF=Math.min(...[ce,fe].map(s=>UV(...s.F)[0]))-.3,v0=PASSAGE.half+1.2,v1=Math.max(v0+.5,...vs)+.3;
    let top=ce.walk;for(let u=uF;u<=uF+14;u+=.25)for(let v=v0;v<=v1+1e-6;v+=.5)top=Math.max(top,height(...P(u,v))+.05);
    for(const st of runs[1].stations){const d=st.s-ce.s;st.walk=Math.max(st.walk,top-.12*d);st.kerb=Math.min(st.walk-.45,height(...st.W)-.1);}}
  // where the body's top stands above the ground just inside the walk's inner edge, it was a second
  // floor under the walk (a rider from the Las Ánimas bank reached it and stalled 0.6 m under the drawn walk). Those bodies
  // are solid obstacles only; the replacement tops remain the walk's support. Buried bodies keep their support.
  const exposed=(a,b)=>{const top=Math.min(a.walk,b.walk)-.35;
    for(const s of [a,b]){const d=[s.W[0]-s.Q[0],s.W[1]-s.Q[1]],l=Math.hypot(...d)||1;
      for(const o of [.3,1])if(height(s.W[0]+d[0]/l*o,s.W[1]+d[1]/l*o)<top-.05)return true;}
    for(const f of [.25,.5,.75]){const q=[a.W[0]+(b.W[0]-a.W[0])*f,a.W[1]+(b.W[1]-a.W[1])*f],m=[a.Q[0]+(b.Q[0]-a.Q[0])*f,a.Q[1]+(b.Q[1]-a.Q[1])*f],
      d=[q[0]-m[0],q[1]-m[1]],l=Math.hypot(...d)||1;if(height(q[0]+d[0]/l*.3,q[1]+d[1]/l*.3)<top-.05)return true;}
    return false;};
  let exposedBodies=0;
  const {walls,ends}=wallIntervals(runs,{prism,tops,PARAPET,FLOOR_BAND,source:'norzagaray:walk',bodySupport:(a,b)=>{const e=exposed(a,b);exposedBodies+=e;return !e;}});

  // ---- Bajada Matadero sally port (node 2331412095): a masonry block through the Santo Tomás flank root with an arched
  // bore. Bore contract of Puerta de San Juan: replacement floor + ceiling, render cut, riders above keep their ground. ----
  // Runs are fitted east → west: 'animas-tomas' starts at the block (its curtain end, +v), 'santo-tomas' ends at it (−v).
  const [curtainEnd,flankEnd]=[runs[1].stations[0],runs[2].stations.at(-1)];
  const secV=s=>['B','T','Q','W'].map(k=>UV(...s[k])[1]);
  const uFront=Math.min(...[curtainEnd,flankEnd].map(s=>UV(...s.F)[0]))-.3;
  // the block now takes the flank's end section inside its north side, and a shoulder at the curtain's walk
  // height carries the curtain's end section on the south (the curtain stands ~4 m above the bastion here: real, so the
  // shoulder squares it off instead of leaving a 0.55 m slot and an unreturned face beside the block).
  const vMin=Math.min(-HB,...secV(flankEnd))-.15,vPier=PASSAGE.half+1.2,vMax=Math.max(vPier+.5,...secV(curtainEnd))+.3;
  const outerY=Math.max(...[-PASSAGE.half,0,PASSAGE.half].map(v=>height(...P(uFront-1.6,v))));
  // Inner mouth: first section past the rampart whose centre has come down into the upper road's channel.
  let uIn0=uFront+8;for(let u=uFront+6;u<uFront+18;u+=.125){const c=height(...P(u,0)),s=[-1.05,1.05].map(v=>height(...P(u,v)));
    if(c<outerY+2.2&&Math.min(...s)<outerY+2.6){uIn0=u+.5;break;}}
  const uBack=uIn0-1.4,uOut=uFront-1.6;
  const innerY=Math.min(...[-1.05,0,1.05].map(v=>height(...P(uIn0,v))));
  // Inner approach (a raw V trench of smeared DEM): a walled sunken lane centred on the mapped upper road
  // (OSM 224319348), from the inner mouth until the trench is ≤0.6 m deep (≤20 m), then the kept DEM.
  const ROAD_UP=[[135.006,-313.64],[156.141,-305.405],[208.181,-292.566]].map(p=>UV(...p));
  const roadV=u=>{for(let i=0;i+1<ROAD_UP.length;i++){const [u0,v0]=ROAD_UP[i],[u1,v1]=ROAD_UP[i+1];
    if(u<=u1||i+2===ROAD_UP.length){const t=Math.max(0,Math.min(1,(u-u0)/(u1-u0)));return v0+(v1-v0)*t;}}return 0;};
  const cAt=u=>u<=uBack?0:roadV(u)*Math.min(1,(u-uBack)/4);
  const at=(u,v)=>P(u,cAt(u)+v);
  const depth=u=>Math.max(height(...at(u,-PASSAGE.half-.6)),height(...at(u,PASSAGE.half+.6)))-height(...at(u,0));
  let uEnd=uBack+20;for(let u=uBack+5;u<=uBack+20;u+=.5)if(depth(u)<.6){uEnd=u;break;}
  const yEnd=Math.min(...[-1.05,0,1.05].map(v=>height(...at(uEnd,v))));
  const laneU=[uBack];for(let u=uBack+2.5;u<uEnd-.75;u+=2.5)laneU.push(u);laneU.push(uEnd);
  const floorAt=u=>u<=uFront?outerY:u<=uBack?outerY+(innerY-outerY)*(u-uFront)/(uBack-uFront)
    :innerY+(yEnd-innerY)*Math.min(1,(u-uBack)/(uEnd-uBack));
  let blockTop=-Infinity,blockBottom=Infinity;
  for(let u=uFront;u<=uBack+1e-6;u+=.25)for(let v=vMin;v<=vPier+1e-6;v+=.5){const h=height(...P(u,v));blockTop=Math.max(blockTop,h);blockBottom=Math.min(blockBottom,h);}
  blockTop=Math.max(blockTop+.05,innerY+PASSAGE.crown+.45);blockBottom=Math.min(blockBottom,outerY)-.4;
  let shoulderTop=curtainEnd.walk,shoulderBottom=blockBottom;
  for(let u=uFront;u<=uBack+1e-6;u+=.25)for(let v=vPier;v<=vMax+1e-6;v+=.5){const h=height(...P(u,v));shoulderTop=Math.max(shoulderTop,h+.05);shoulderBottom=Math.min(shoulderBottom,h-.4);}
  shoulderTop=Math.max(shoulderTop,curtainEnd.walk);
  // Segmental arch shared with the renderer; the declared ceiling stays 10 cm under it across each floor triangle
  // (a flat floor+3.0 m ceiling stood 0.48 m above the drawn arch near the walls).
  const archRise=PASSAGE.crown-PASSAGE.spring,R=(PASSAGE.half**2+archRise**2)/(2*archRise),archCy=PASSAGE.crown-R;
  const archAt=v=>archCy+Math.sqrt(Math.max(0,R*R-Math.min(v*v,PASSAGE.half**2)));
  const across=[-PASSAGE.half-.03,-1.05,0,1.05,PASSAGE.half+.03];
  const edgeRow=u=>across.map(v=>{const [x,z]=at(u,v);return [x,height(x,z)+.015,z];});
  const lineRow=(u,y)=>across.map(v=>{const [x,z]=at(u,v);return [x,y,z];});
  const rows=[[uOut-.03,edgeRow(uOut-.03)],[uFront,lineRow(uFront,outerY)],[uBack,lineRow(uBack,innerY)],
    ...laneU.slice(1,-1).map(u=>[u,lineRow(u,floorAt(u))]),[uEnd+.03,edgeRow(uEnd+.03)]];
  const passTriangles=[];
  for(let r=0;r+1<rows.length;r++){const [ua,A]=rows[r],[ub,B]=rows[r+1],covered=ua>=uFront-1e-6&&ub<=uBack+1e-6;
    for(let i=0;i+1<A.length;i++){const ceil=Math.min(archAt(across[i]),archAt(across[i+1]))-.1;
      for(const tri of [[A[i],B[i+1],B[i]],[A[i],A[i+1],B[i+1]]]){
        passTriangles.push(tri);floorTriangles.push(tri);
        tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:Math.max(tri[0][1],tri[1][1],tri[2][1]),plane:plane(tri),replacesTerrain:true,
          maxReferenceY:Math.max(tri[0][1],tri[1][1],tri[2][1])+FLOOR_BAND,surface:'pavement',source:'norzagaray:matadero',
          ...(covered?{ceilingOffset:ceil}:{})});}}}
  // Outer approach: render-only skirts where the kept ground lies level with the floor (the La Perla side; an outer kerb
  // blocked the road's turn north at the mouth), kerbs where it stands above. Lane: retaining walls both sides.
  const kerbs=[],skirts=[],laneWalls=[];
  for(const s of [-1,1]){let m=-Infinity;
    for(let u=uOut;u<=uFront+1e-6;u+=.125)for(const v of [PASSAGE.half,PASSAGE.half+.2,PASSAGE.half+.45])m=Math.max(m,height(...P(u,s*v)));
    if(m<outerY+.1){skirts.push({u0:uOut,u1:uFront,side:s});continue;}
    const lo=Math.min(outerY,height(...P(uOut,s*PASSAGE.half)),height(...P(uFront,s*PASSAGE.half)))-.4,top=Math.max(m+.05,outerY+.12);
    kerbs.push({u0:uOut,u1:uFront,side:s,top,bottom:lo});
    prism(s<0?[P(uOut,-PASSAGE.half-.45),P(uFront,-PASSAGE.half-.45),P(uFront,-PASSAGE.half),P(uOut,-PASSAGE.half)]
      :[P(uOut,PASSAGE.half),P(uFront,PASSAGE.half),P(uFront,PASSAGE.half+.45),P(uOut,PASSAGE.half+.45)],lo,top);}
  for(let k=0;k+1<laneU.length;k++){const u0=laneU[k],u1=k+2===laneU.length?uEnd+.03:laneU[k+1];
    for(const s of [-1,1]){const endTop=u=>{let m=-Infinity;for(const v of [PASSAGE.half+.05,PASSAGE.half+.3,PASSAGE.half+.6])m=Math.max(m,height(...at(u,s*v)));
        return Math.max(m+.05,floorAt(u)+.15);};
      const t0=endTop(u0),t1=endTop(u1),lo=Math.min(floorAt(u0),floorAt(u1))-.4;
      laneWalls.push({u0,u1,side:s,t0,t1,bottom:lo});
      prism(s<0?[at(u0,-PASSAGE.half-.45),at(u1,-PASSAGE.half-.45),at(u1,-PASSAGE.half),at(u0,-PASSAGE.half)]
        :[at(u0,PASSAGE.half),at(u1,PASSAGE.half),at(u1,PASSAGE.half+.45),at(u0,PASSAGE.half+.45)],lo,Math.max(t0,t1));}}
  const cutTop=Math.max(blockTop,...laneWalls.map(w=>Math.max(w.t0,w.t1)),innerY+PASSAGE.crown+1.1)+.1;
  {const ring=[P(uOut,-PASSAGE.half),P(uBack,-PASSAGE.half),P(uBack,PASSAGE.half),P(uOut,PASSAGE.half)];
    cuts.push({...(([x0,x1,z0,z1])=>({minX:x0,maxX:x1,minZ:z0,maxZ:z1}))(bounds(ring)),kind:'bore',planes:[...convexPlanes(ring),[0,-1,0,cutTop]]});}
  for(let k=0;k+1<laneU.length;k++){const u0=laneU[k],u1=k+2===laneU.length?uEnd+.03:laneU[k+1];
    const ring=[at(u0,-PASSAGE.half),at(u1,-PASSAGE.half),at(u1,PASSAGE.half),at(u0,PASSAGE.half)];
    cuts.push({...(([x0,x1,z0,z1])=>({minX:x0,maxX:x1,minZ:z0,maxZ:z1}))(bounds(ring)),kind:'bore',planes:[...convexPlanes(ring),[0,-1,0,cutTop]]});}
  const quad=(u0,u1,v0,v1)=>[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)];
  prism(quad(uFront,uBack,vMin,-PASSAGE.half),blockBottom,blockTop,true);
  prism(quad(uFront,uBack,PASSAGE.half,vPier),blockBottom,blockTop,true);
  prism(quad(uFront,uBack,vPier,vMax),shoulderBottom,shoulderTop,true);
  // Vault mass over the bore; its underside clears the ceiling the floor tops declare everywhere along the passage.
  prism(quad(uFront,uBack,-PASSAGE.half,PASSAGE.half),Math.max(outerY,innerY)+PASSAGE.crown,blockTop,true);
  // Parapets on the outer edges, continuous with the runs either side (Wikimedia Commons curid=80155724's broad sloping top).
  prism(quad(uFront,uFront+PARAPET.thick,vMin,vPier),blockTop-.6,blockTop+PARAPET.riseIn);
  prism(quad(uFront,uFront+PARAPET.thick,vPier,vMax),shoulderTop-.6,shoulderTop+PARAPET.riseIn);
  const passage={frame:{origin:PASS_OUT,ax,az,px,pz},uOut,uFront,uBack,uIn:uEnd,uEnd,outerY,innerY,yEnd,blockTop,blockBottom,
    shoulderTop,shoulderBottom,vMin,vPier,vMax,cutTop,floorAt,cAt,laneU,laneWalls,triangles:passTriangles,kerbs,skirts,
    half:PASSAGE.half,blockHalf:HB,arch:{R,cy:archCy}};

  // ---- Street surfaces (single owner, convex pieces). Priority: existing owners > road > sidewalks > plaza. ----
  const earlier=[...(gate?.surfaces??[]),...(fort?.surfaces??[]),...Object.values(areas).flatMap(a=>a?.surfaces??[])].map(s=>s.ring);
  const asphalt=minus(ribbon(ROAD_EAST,-ROAD.eastHalf,ROAD.eastHalf),earlier);
  const sett=minus(ribbon(ROAD_WEST,-ROAD.westHalf,ROAD.westHalf),[...earlier,...asphalt]);
  const roadRings=[...asphalt,...sett];
  // The sidewalks stop short of the Calle del Morro strip's own concrete and the Cristóbal bend.
  const walkN=minus(ribbon(SIDEWALK_N,-ROAD.walkHalf,ROAD.walkHalf),[...earlier,...roadRings]);
  const walkS=minus(ribbon(SIDEWALK_S,-1,1),[...earlier,...roadRings,...walkN]);
  for(const ring of asphalt)surfaces.push({kind:'asphalt',ring,owner:'norzagaray'});
  for(const ring of sett)surfaces.push({kind:'sett',ring,owner:'norzagaray'});
  for(const ring of [...walkN,...walkS])surfaces.push({kind:'morro',ring,owner:'norzagaray-sidewalk'});

  // ---- Plaza del Quinto Centenario (Wikimedia Commons curid=38237168). Lower court on the level DEM (≈29 m), fountain pad, central stair to the
  // upper terrace and the Tótem (OSM node, height 12). Axis: through the Tótem along the plaza's long direction. ----
  const nMid=[(QUINTO[4][0]+QUINTO[5][0])/2,(QUINTO[4][1]+QUINTO[5][1])/2],sMid=[(QUINTO[0][0]+QUINTO[9][0])/2,(QUINTO[0][1]+QUINTO[9][1])/2];
  const [qx,qz]=unit(nMid,sMid),qpx=-qz,qpz=qx;   // q: up the plaza (south), qp: across
  const Q=(a,c)=>[TOTEM.x+qx*a+qpx*c,TOTEM.z+qz*a+qpz*c];  // a<0 toward Norzagaray
  // Stair foot where the level court ends (first section, walking up the axis, whose ground rises ≥0.25 m over the court).
  const courtY=(()=>{const hs=[];for(let a=-56;a<=-40;a+=1)for(const c of [-6,-3,0,3,6])hs.push(height(...Q(a,c)));hs.sort((p,q)=>p-q);return hs[Math.floor(hs.length/2)];})();
  let aFoot=-30;for(let a=-44;a<-10;a+=.25){if([-STAIR.half,0,STAIR.half].some(c=>height(...Q(a,c))>courtY+.25)){aFoot=a-.4;break;}}
  // Upper terrace level: median DEM over the landing band below the Tótem; risers divide the climb evenly (≥ minRise).
  const upperY=(()=>{const hs=[];for(let a=-9;a<=-2;a+=1)for(const c of [-4,-2,0,2,4])hs.push(height(...Q(a,c)));hs.sort((p,q)=>p-q);return hs[Math.floor(hs.length/2)];})();
  // (public stairs ride up and down): the flight keeps its footprint (the old 0.22 m × 0.72 m count
  // sets the run) but takes ⌈rise / 0.16⌉ uniform risers — Wikimedia Commons curid=38237168 shows one long central flight of many shallow steps.
  // The court rises ~2 % toward the stair, so the flight starts from the ground at its foot (median across the width just
  // before the first nose), not from the far court's median.
  const footY=(()=>{const hs=[-STAIR.half,-3,0,3,STAIR.half].map(c=>height(...Q(aFoot-.3,c)));hs.sort((p,q)=>p-q);return hs[2];})();
  const run=Math.max(4,Math.floor((upperY-courtY)/STAIR.minRise))*STAIR.tread,risers=Math.max(4,Math.ceil((upperY-footY)/STAIR.maxRise)),
    rise=(upperY-footY)/risers,tread=run/risers;
  const aTop=aFoot+run,landY=footY+risers*rise;
  const steps=[];
  // Level replacement tops for treads and landing (where the smeared DEM stands above a tread or the landing
  // the physical ground must still be the drawn stone).
  const levelTops=(ring,y,source)=>{for(const tri of [[ring[0],ring[1],ring[2]],[ring[0],ring[2],ring[3]]])
    tops.push({poly:tri.map(([x,z])=>({x,z})),top:y,plane:{x:tri[0][0],y,z:tri[0][1],dx:0,dz:0},replacesTerrain:true,maxReferenceY:y+FLOOR_BAND,surface:'pavement',source});};
  for(let k=0;k<risers;k++){const a0=aFoot+k*tread,a1=a0+tread,top=footY+(k+1)*rise;
    let lo=Infinity,hi=-Infinity;for(let a=a0;a<=a1+1e-6;a+=tread/2)for(let c=-STAIR.half;c<=STAIR.half+1e-6;c+=1){const h=height(...Q(a,c));lo=Math.min(lo,h);hi=Math.max(hi,h);}
    const ring=[Q(a0,-STAIR.half),Q(a1,-STAIR.half),Q(a1,STAIR.half),Q(a0,STAIR.half)];
    steps.push({a0,a1,top,bottom:Math.min(lo,courtY)-.12,demMax:hi,ring});}
  // Upper landing (Wikimedia Commons curid=38237168: the Tótem stands on the terrace at the stair head). It runs past the Tótem, so it no longer
  // ends as an exposed slab across the slope (up to 1.30 m); a fitted end wall closes it below.
  const landA1=TOTEM.baseRadius+2.5;
  let landLo=Infinity,landHi=-Infinity;for(let a=aTop;a<=landA1+1e-6;a+=.5)for(let c=-STAIR.half;c<=STAIR.half+1e-6;c+=1){const h=height(...Q(a,c));landLo=Math.min(landLo,h);landHi=Math.max(landHi,h);}
  const landing={a0:aTop,a1:landA1,y:landY,bottom:Math.min(landLo,courtY)-.12,demMax:landHi};
  landing.ring=[Q(landing.a0,-STAIR.half),Q(landing.a1,-STAIR.half),Q(landing.a1,STAIR.half),Q(landing.a0,STAIR.half)];
  prism(landing.ring,landing.bottom,landY,true);levelTops(landing.ring,landY,'quinto:landing');
  // Part two (shared stair module, js/sj-stairs.js): drawn = the uniform treads above with nosings; physical = the module's
  // smooth lifted nose-line support from the court to the landing (replacement tops; no tread solids). u across (c), s up.
  const axisA=(x,z)=>(x-TOTEM.x)*qx+(z-TOTEM.z)*qz,onLanding=(x,z)=>{const a=axisA(x,z),c=(x-TOTEM.x)*qpx+(z-TOTEM.z)*qpz;return a>=aTop-1e-6&&a<=landing.a1&&Math.abs(c)<=STAIR.half+1e-6;};
  const quintoFlight=rideableFlight({at:(u,s)=>Q(aFoot+s,u),u0:-STAIR.half,u1:STAIR.half,run,yf:footY,yt:landY,n:risers,margin:STAIR_RIDE_MARGIN,ground:(x,z)=>onLanding(x,z)?landY:height(x,z),grid:terrain});
  quintoFlight.treads.forEach((t,k)=>{steps[k].nosing=t.nosing;});
  for(const tri of quintoFlight.tops){const top=Math.max(tri[0][1],tri[1][1],tri[2][1]);
    tops.push({poly:tri.map(p=>({x:p[0],z:p[2]})),top,plane:plane(tri),replacesTerrain:true,maxReferenceY:top+FLOOR_BAND,surface:'pavement',source:'quinto:stair'});}
  // Render cut over stair + landing (the smeared DEM rose through the treads); the solid treads own that ground.
  {const ring=[Q(aFoot,-STAIR.half),Q(landing.a1,-STAIR.half),Q(landing.a1,STAIR.half),Q(aFoot,STAIR.half)],b=bounds(ring);
    cuts.push({minX:b[0],maxX:b[1],minZ:b[2],maxZ:b[3],kind:'stair',planes:convexPlanes(ring)});}
  // Balustraded cheek walls (Wikimedia Commons curid=38237168) in ~2.4 m segments: each top follows the stair/landing it guards or the ground it
  // retains, whichever is higher (one 30 m wall at the highest ground stood 4 m over the court at the stair foot).
  const surfaceAt=a=>a>=aTop?landY:footY+Math.max(0,Math.min(risers,Math.floor((a-aFoot)/tread)+1))*rise;
  const cheeks=[];
  for(const s of [-1,1]){const c0=s*STAIR.half,c1=s*(STAIR.half+.5),n=Math.max(1,Math.round((landing.a1-aFoot)/2.4));
    for(let k=0;k<n;k++){const a0=aFoot+(landing.a1-aFoot)*k/n,a1=aFoot+(landing.a1-aFoot)*(k+1)/n;let lo=Infinity,hi=-Infinity;
      for(let a=a0;a<=a1+1e-6;a+=.4)for(const c of [c0,c1,s*(STAIR.half+.9)]){const h=height(...Q(a,c));lo=Math.min(lo,h);hi=Math.max(hi,h);}
      const ring=s<0?[Q(a0,c1),Q(a1,c1),Q(a1,c0),Q(a0,c0)]:[Q(a0,c0),Q(a1,c0),Q(a1,c1),Q(a0,c1)];
      const top=Math.max(surfaceAt(a1-.01)+.05,hi+.1),bottom=Math.min(lo,courtY)-.12;
      prism(ring,bottom,top+.95);cheeks.push({side:s,c0,c1,a0,a1,bottom,top,rail:.95,ring});}}
  // End wall across the landing's far edge: a retaining face where the terrace ground beyond stands higher, a balustrade
  // where it falls away more than 0.4 m (four segments across the cross-slope).
  const endWall=[];
  {const c0=-STAIR.half-.5,c1=STAIR.half+.5,a0=landing.a1,a1=landing.a1+.5;
    for(let k=0;k<4;k++){const ca=c0+(c1-c0)*k/4,cb=c0+(c1-c0)*(k+1)/4;let lo=Infinity,hi=-Infinity,beyondLo=Infinity;
      for(let c=ca;c<=cb+1e-6;c+=.5){for(const a of [a0,a1]){const h=height(...Q(a,c));lo=Math.min(lo,h);hi=Math.max(hi,h);}
        for(const a of [a1+.3,a1+1])beyondLo=Math.min(beyondLo,height(...Q(a,c)));}
      const top=Math.max(landY+.05,hi+.1),rail=landY-beyondLo>.4?.95:0,bottom=Math.min(lo,landing.bottom);
      const ring=[Q(a0,ca),Q(a1,ca),Q(a1,cb),Q(a0,cb)];prism(ring,bottom,top+rail);endWall.push({a0,a1,c0:ca,c1:cb,top,rail,bottom,ring});}}
  // Splash pad (Wikimedia Commons curid=38237168: a near-flush round court with a thin dark rim and clustered jets): a draped wet-paving overlay
  // on the court's own ground (a raised disc stood 8–20 cm above the support). One anchor array serves the
  // drawn nozzles and the jets.
  const fpad=Q(aFoot-STAIR.fountainR-3.2,0),padR=STAIR.fountainR;
  const fountain={x:fpad[0],z:fpad[1],radius:padR,ring:circle(fpad[0],fpad[1],padR,32)};
  fountain.rim=fountain.ring.map(([x,z])=>[x,height(x,z)+.02,z]);
  fountain.jets=[];{let seed=4401;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(const sd of [-1,1])for(let j=0;j<9;j++){const r=j?.45+rnd()*.7:0,an=rnd()*Math.PI*2,x=fpad[0]+qpx*sd*1.7+Math.cos(an)*r,z=fpad[1]+qpz*sd*1.7+Math.sin(an)*r;
      fountain.jets.push({x,z,y:height(x,z)+.01,h:2.0+rnd()*1.2-(j?r*.6:0),cluster:true});}
    for(let k=0;k<10;k++){const an=k*Math.PI/5,x=fpad[0]+Math.cos(an)*(padR-.9),z=fpad[1]+Math.sin(an)*(padR-.9);fountain.jets.push({x,z,y:height(x,z)+.01,h:.9+.3*(k%2),cluster:false});}}
  surfaces.push({kind:'wet',ring:fountain.ring,owner:'quinto'});
  // Tótem: smooth dark foot standing on the landing, rough reddish shaft to the OSM height (12 m) above it.
  const totem={...TOTEM,ground:landY,bottom:landing.bottom,baseTop:landY+TOTEM.baseHeight,top:landY+TOTEM.height};
  prism(circle(totem.x,totem.z,TOTEM.baseRadius,12),totem.bottom,totem.top);
  // White-cup lamps (Wikimedia Commons curid=38237168: dark posts, white tapered diffusers) beside the stair foot and at the court corners.
  const plazaLamps=[[-STAIR.half-1.2,aFoot-.9],[STAIR.half+1.2,aFoot-.9],[-STAIR.half-3,aFoot-13],[STAIR.half+3,aFoot-13]]
    .map(([c,a])=>{const [x,z]=Q(a,c);return {x,z,y:height(x,z)};}).filter(l=>inRing(l.x,l.z,QUINTO));
  for(const l of plazaLamps)prism(circle(l.x,l.z,.16,8),l.y-.1,l.y+4.2);
  // Court paving: the park polygon minus the roads/sidewalks, the stair/landing/cheeks/end wall, the pad and the Tótem.
  const stairRings=[...steps.map(s=>s.ring),landing.ring,...cheeks.map(c=>c.ring),...endWall.map(w=>w.ring)];
  const plazaPieces=minus(convexPieces(QUINTO),[...earlier,...roadRings,...walkN,...walkS,...stairRings,fountain.ring]);
  for(const ring of plazaPieces)surfaces.push({kind:'plaza',ring,owner:'quinto'});
  // The fountain court is drawn as paving but some inherited mask cells ride as
  // grass (2.8 m/s² rolling resistance). Change only the class under the court.
  const courtCells=[],bb=bounds(QUINTO);
  for(let j=Math.floor((bb[2]-terrain.z0)/terrain.step);j<=Math.ceil((bb[3]-terrain.z0)/terrain.step);j++)
    for(let i=Math.floor((bb[0]-terrain.x0)/terrain.step);i<=Math.ceil((bb[1]-terrain.x0)/terrain.step);i++){
      const x=terrain.x0+(i+.5)*terrain.step,z=terrain.z0+(j+.5)*terrain.step,k=j*terrain.nx+i;
      if(surface[k]===2&&(inRing(x,z,fountain.ring)||plazaPieces.some(r=>inRing(x,z,r))))courtCells.push(k);}
  // Flight frame for the shared stair module (js/sj-stairs.js): s from the foot line along the uphill axis; the handrails at
  // c = ±half/3 split it into three landing-to-landing lanes.
  const flight={id:'norzagaray:quinto',width:2*STAIR.half,axis:[qx,qz],foot:{line:[Q(aFoot,-STAIR.half),Q(aFoot,STAIR.half)],y:footY},
    top:{line:[Q(aTop,-STAIR.half),Q(aTop,STAIR.half)],y:landY},treads:steps.map(st=>({s0:st.a0-aFoot,s1:st.a1-aFoot,y:st.top,nose:st.a0-aFoot})),
    risers:{n:risers,h:rise,run:tread},landings:{foot:{y:footY,depth:3},top:{y:landY,depth:landing.a1-aTop}},
    lanes:[[-STAIR.half,-STAIR.half/3],[-STAIR.half/3,STAIR.half/3],[STAIR.half/3,STAIR.half]],
    module:{worstGap:quintoFlight.worstGap,maxFloat:quintoFlight.maxFloat,lip:quintoFlight.lip,lipAt:quintoFlight.lipAt,theta:quintoFlight.theta,lift:quintoFlight.lift,footS:quintoFlight.footS,topS:quintoFlight.topS,nosing:quintoFlight.nosing}};
  const quinto={axis:{x:qx,z:qz,px:qpx,pz:qpz},Q,courtY,upperY,aFoot,aTop,steps,landing,cheeks,endWall,fountain,totem,lamps:plazaLamps,rise,risers,tread,flight};

  // ---- Norzagaray lanterns (Wikimedia Commons curid=109811944) on the north sidewalk's kerb side, clear of junction mouths. ----
  const mouths=[[-237.406,-314.803],[216.737,-279.118],[247.99,-279.76],[-445.144,-282.088],[-457.343,-298.027]];
  const lamps=[];
  {let acc=LAMP_STEP/2;for(let i=0;i+1<SIDEWALK_N.length;i++){const a=SIDEWALK_N[i],b=SIDEWALK_N[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),[ux,uz]=unit(a,b);
    for(let t=LAMP_STEP-acc;t<L;t+=LAMP_STEP){const c=[a[0]+ux*t,a[1]+uz*t];
      // Kerb side: toward the road (the left of travel on this west→east sidewalk is south).
      let x=c[0]+uz*.75,z=c[1]-ux*.75;
      if(x<-430||x>460||mouths.some(m=>Math.hypot(m[0]-x,m[1]-z)<7))continue;
      // a kerb-side spot on the face of a scarp (the foot spanned 83 cm at (159.5,−294.5))
      // moves to the nearest level spot on the walk — inboard first, then along it — instead of a long buried drum.
      const span=(px,pz)=>{let lo=Infinity,hi=-Infinity;for(let k=0;k<9;k++){const a=k*Math.PI/4,r=k<8?.2:0,g=height(px+Math.cos(a)*r,pz+Math.sin(a)*r);lo=Math.min(lo,g);hi=Math.max(hi,g);}return hi-lo;};
      if(span(x,z)>.2){let best=null;
        for(const d of [.75,.25,0,-.25,-.5])for(const t2 of [0,.5,-.5,1,-1,1.5,-1.5,2,-2]){const px=c[0]+ux*t2+uz*d,pz=c[1]+uz*t2-ux*d;
          if(span(px,pz)<=.2){best=[px,pz];break;}}if(best)[x,z]=best;else continue;}
      lamps.push({x,z,y:height(x,z)});}
    acc=(acc+L)%LAMP_STEP;}}
  for(const l of lamps)prism(circle(l.x,l.z,.17,8),l.y-.1,l.y+4.3);

  // ---- Ground tint: the bank between the north sidewalk and the wall walk, and the bastion terrepleins, are grass
  // (Wikimedia Commons curid=80155724, curid=109811940, curid=109811944). Roads/footways, buildings and the plaza keep their colours; earlier area tints keep priority. ----
  const tint=new Map();
  if(terrain?.nx&&surface){const {x0,z0,step,nx,nz}=terrain;
    const others=[];for(const r of city.roads){if(['Calle de Norzagaray'].includes(r.name))continue;
      const m=['footway','pedestrian','cycleway','steps'].includes(r.kind)?1.2:r.width/2+.6;
      for(let q=0;q+1<r.points.length;q++){const a=r.points[q],b=r.points[q+1];if(Math.max(a[1],b[1])<-460||Math.min(a[1],b[1])>-240||Math.max(a[0],b[0])<-200||Math.min(a[0],b[0])>480)continue;others.push({a,b,m});}}
    const bld=city.buildings.filter(b=>b.outer.some(([x,z])=>x>-200&&x<480&&z>-380&&z<-240));
    for(let j=Math.floor((-380-z0)/step);j<=Math.ceil((-250-z0)/step);j++)for(let i=Math.floor((-182-x0)/step);i<=Math.ceil((462-x0)/step);i++){
      if(i<1||j<1||i>nx-2||j>nz-2)continue;const k=j*nx+i;if(surface[k]!==0)continue;const x=x0+i*step,z=z0+j*step;
      // sideOf: s>0 on the right of west→east travel (south, the city side), s<0 north.
      const w=sideOf(WALL,x,z);if(!w||w.d>45||w.s<0)continue;           // inside the wall line, within 45 m
      // North (seaward) of the sidewalk; vertices under its outer half are grass too, so no pale band blends out from it.
      const sw=sideOf(SIDEWALK_N,x,z);if(!sw||sw.s>0||sw.d<ROAD.walkHalf*.5)continue;
      if(others.some(o=>segmentDistance(x,z,o.a,o.b)<o.m))continue;
      if(bld.some(b=>inRing(x,z,b.outer)))continue;
      tint.set(k,'lawn');}}

  const court=Q(aFoot-2*STAIR.fountainR-9,0);
  const places=[{name:'Calle Norzagaray — muralla norte',x:60.775,z:-300.191,source:295380549},
    {name:'Plaza del Quinto Centenario',x:court[0],z:court[1],source:196604234}];
  const stations=runs.flatMap(r=>r.stations);
  // Quinto Centenario lamp feet seated by the world's construction pass (seatRecords).
  // ---- Las Ánimas flight: uniform risers ≤ 16.5 cm from the La Perla foot (the steps' level) up the mapped footway to the
  // bank; treads drawn and physical (flat replacement tops), a render cut under them, cheeks where the ground beside stands
  // higher, and a `paved` claim so `streets` draws nothing on it. Flight frame for the shared stair module. ----
  const animas=(()=>{const [ux,uz]=unit(ANIMAS.foot,ANIMAS.top),vx=-uz,vz=ux,L=Math.hypot(ANIMAS.top[0]-ANIMAS.foot[0],ANIMAS.top[1]-ANIMAS.foot[1]),h=ANIMAS.half;
    const A=(s,v)=>[ANIMAS.foot[0]+ux*s+vx*v,ANIMAS.foot[1]+uz*s+vz*v],med=a=>{a=[...a].sort((p,q)=>p-q);return a[Math.floor(a.length/2)];};
    const footY=med([-h,0,h].map(v=>height(...A(-.3,v)))),topY=med([-h,0,h].map(v=>height(...A(L+.3,v))));
    const n=Math.max(1,Math.ceil((topY-footY)/ANIMAS.maxRise)),rise=(topY-footY)/n,run=L/n,steps=[];
    for(let k=0;k<n;k++){const s0=k*run,s1=s0+run,top=footY+(k+1)*rise,ring=[A(s0,-h),A(s1,-h),A(s1,h),A(s0,h)];
      let lo=Infinity;for(const v of [-h,0,h])for(const s of [s0,s1])lo=Math.min(lo,height(...A(s,v)));
      const bottom=Math.min(lo,footY)-.15;steps.push({s0,s1,top,bottom,ring});}
    // Part two: the module's smooth support (replacement tops), no tread solids. u across (−h…h), s up the climb.
    // Foot apron (drawn and physical, over the cut): the DEM in front of the foot is the smeared flight; the apron carries a
    // straight ruled surface from the real ground on the along-wall approach row (s = −ANIMAS.apron, where steps way
    // 270168283 arrives from the west) to the foot riser.
    const fl=rideableFlight({at:(u,s)=>A(s,u),u0:-h,u1:h,run:L,yf:footY,yt:topY,n,ground:height,grid:terrain,uStep:.55,margin:STAIR_RIDE_MARGIN,footApron:ANIMAS.apron,approach:ANIMAS.apron+1.2});
    fl.treads.forEach((t,k)=>{steps[k].nosing=t.nosing;});
    for(const tri of fl.tops){const top=Math.max(tri[0][1],tri[1][1],tri[2][1]);
      tops.push({poly:tri.map(p=>({x:p[0],z:p[2]})),top,plane:plane(tri),replacesTerrain:true,maxReferenceY:top+FLOOR_BAND,surface:'pavement',source:'animas:stair'});}
    const foot=[A(0,-h),A(0,h)],ring=[A(0,-h),A(L,-h),A(L,h),A(0,h)],b=bounds(ring);
    cuts.push({minX:b[0],maxX:b[1],minZ:b[2],maxZ:b[3],kind:'stair',planes:convexPlanes(ring)});
    // Foot from the side the real approach comes from: the along-wall row s = −apron arrives from the west (+u). West of
    // the apron a ruled blend (drawn and physical) runs from the support at the flight edge to the real ground
    // ANIMAS.blend m out, so a rider turning in from the wall walk meets no side lip; east of the apron, where the ground
    // falls away to the city wall's face, a low cheek closes the edge. One render cut under apron and blend.
    const AP=ANIMAS.apron,BW=ANIMAS.blend,blend=[],grid=[];
    for(let i=0;i<=8;i++){const sv=-AP+AP*i/8,row=[];for(let j=0;j<=4;j++){const uv=h+BW*j/4,t=j/4,[x,z]=A(sv,uv);
      row.push([x,fl.support(h,sv)*(1-t)+height(...A(sv,h+BW))*t,z]);}grid.push(row);}
    for(let i=0;i<8;i++)for(let j=0;j<4;j++){const a=grid[i][j],b2=grid[i][j+1],c=grid[i+1][j+1],d=grid[i+1][j];
      for(const tri of [[a,b2,c],[a,c,d]]){blend.push(tri);const top=Math.max(tri[0][1],tri[1][1],tri[2][1]);
        tops.push({poly:tri.map(p=>({x:p[0],z:p[2]})),top,plane:plane(tri),replacesTerrain:true,maxReferenceY:top+FLOOR_BAND,surface:'pavement',source:'animas:foot-blend'});}}
    const footRing=[A(-AP,-h),A(0,-h),A(0,h+BW),A(-AP,h+BW)],fb=bounds(footRing);
    cuts.push({minX:fb[0],maxX:fb[1],minZ:fb[2],maxZ:fb[3],kind:'stair',planes:convexPlanes(footRing)});
    const cheeks=[];for(const [v0,v1] of [[-h-.3,-h],[h,h+.3]])for(const st of steps){let g=-Infinity,lo=Infinity;
      for(const v of [v0,v1])for(const s of [st.s0,(st.s0+st.s1)/2,st.s1]){const y=height(...A(s,v));g=Math.max(g,y);lo=Math.min(lo,y);}
      const r=[A(st.s0,v0),A(st.s1,v0),A(st.s1,v1),A(st.s0,v1)],top=Math.max(st.top,g)+.12,bottom=Math.min(lo,st.bottom);prism(r,bottom,top);cheeks.push({ring:r,top,bottom});}
    for(let i=0;i<8;i++){const s0=-AP+AP*i/8,s1=s0+AP/8,v0=-h-.3,v1=-h;let lo=Infinity;for(const v of [v0,v1])for(const sv of [s0,s1])lo=Math.min(lo,height(...A(sv,v)));
      const r=[A(s0,v0),A(s1,v0),A(s1,v1),A(s0,v1)],top=Math.max(fl.support(-h,s0),fl.support(-h,s1))+.12,bottom=lo-.15;prism(r,bottom,top);cheeks.push({ring:r,top,bottom,foot:true});}
    const flight={id:'norzagaray:animas',width:2*h,axis:[ux,uz],foot:{line:foot,y:footY},top:{line:[A(L,-h),A(L,h)],y:topY},
      treads:steps.map(st=>({s0:st.s0,s1:st.s1,y:st.top,nose:st.s0})),risers:{n,h:rise,run},landings:{foot:{y:footY,depth:3},top:{y:topY,depth:3}}};
    flight.module={worstGap:fl.worstGap,maxFloat:fl.maxFloat,lip:fl.lip,lipAt:fl.lipAt,theta:fl.theta,lift:fl.lift,footS:fl.footS,topS:fl.topS,nosing:fl.nosing};
    return {axis:[ux,uz],across:[vx,vz],half:h,length:L,steps,cheeks,ring,footRing,aprons:fl.aprons,blend,flight,record:stairRecord(fl,{reach:0,samples:192}),way:[270168283,256386981]};})();
  registerStairFlights('norzagaray',[stairRecord(quintoFlight,{samples:192}),animas.record]);
  const paved=[{ring:animas.ring,kind:'stair',owner:'norzagaray:animas'},{ring:animas.footRing,kind:'stair',owner:'norzagaray:animas'},...animas.cheeks.map(c=>({ring:c.ring,kind:'stair',owner:'norzagaray:animas'}))];
  const layout={seatLists:[{records:plazaLamps,radius:.12}],animas,paved,runs,walls,ends,stations,passage,quinto,lamps,colliders,tops,cuts,tint,surfaces,floorTriangles,places,
    groundClass:{cells:Uint32Array.from(courtCells),cls:0},constants:{PARAPET,PASSAGE,ROAD,STAIR,FIT,FLOOR_BAND}};
  layout.qa=()=>({runs:runs.map(r=>({name:r.name,stations:r.stations.length,drawn:r.drawn,open:r.open})),walls:walls.length,ends:ends.length,
    passage:{origin:PASS_OUT,ax,az,px,pz,uOut:+uOut.toFixed(3),uFront:+uFront.toFixed(3),uBack:+uBack.toFixed(3),uIn:+uEnd.toFixed(3),
      outerY:+outerY.toFixed(3),innerY:+innerY.toFixed(3),blockTop:+blockTop.toFixed(3),half:PASSAGE.half,clear:PASSAGE.clear,
      uEnd:+uEnd.toFixed(3),yEnd:+yEnd.toFixed(3),shoulderTop:+shoulderTop.toFixed(3),vMin:+vMin.toFixed(3),vMax:+vMax.toFixed(3)},
    quinto:{courtY:+courtY.toFixed(3),aFoot:+aFoot.toFixed(2),landY:+landY.toFixed(3),risers,rise:+rise.toFixed(3),fountain:[+fountain.x.toFixed(2),+fountain.z.toFixed(2)],
      totem:[TOTEM.x,TOTEM.z,+totem.ground.toFixed(2),+totem.top.toFixed(2)],stairFootY:+courtY.toFixed(3),cheeks:cheeks.length,endWall:endWall.map(w=>[+w.top.toFixed(2),w.rail])},
    lamps:lamps.length,colliders:colliders.length,exposedBodies,tops:tops.length,cuts:cuts.length,surfaces:surfaces.length,tint:tint.size,
    places:places.map(p=>p.name)});
  return layout;
}
