/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// North-west upper town (Ballajá, Beneficencia, Escuela, San José, Casa Blanca, El Morro lawn edges) — © 2026 VibezZzCoder,
// MIT. OSM / ODbL; heights: USGS DEM. Area module (contract: header of sj-princesa-layout.js), registered
// after puntilla and before wallFoot.
// Mapped: the 22 shells in OWNED (city.buildings), Plaza San José 196605698, Parque de la Beneficencia 256259810, Plaza del
// Soportal 256658276, the Ballajá basin 308898109 and beds 308898111–119, the esplanade lawns 410617402/410617405, the
// Casa Blanca grounds 269740868, the lawn footway 386702922, the Ponce de León statue n4560131422, gates n2748751825 /
// n2748751836 / n2748751844, city trees. Inferred: bay rhythms, storey lines, opening sizes,
// every ornament dimension, colours (photo-led), the portals' positions on the faces, San José's nave height and gable,
// the belfry, the statue's proportions, the Escuela court fence line, lamp/tree placement.
// Single physics authority: sj-uptown.js draws exactly these numbers.
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea,intersectRings} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {unit,bounds,ribbon,minus,overlapB} from './sj-city-wall.js';
import {STREETS} from './sj-streets-layout.js';
import {GROUND_AREAS} from './sj-streets-data.js';
import {ringsAt} from './sj-private.js';

// Survey §6 explicit building ownership (city.buildings ids); fabric/streets skip these.
// + the Polvorín de Santa Elena 60252372 on the esplanade's south-west lawn (in the survey ledger, not its list: added here).
export const OWNED=[929959,929960,59745023,1344473441,256388549,3435178,269744558,256658271,270161725,269739380,269739381,
  269739382,269739383,269739384,269739385,6800675,3610153,256659484,256659483,3595797,256658272,256658273,60252372];
export const BALLAJA=929959,ASILO=929960,ESCUELA=59745023,SANJOSE=256388549,CASALS=256658271,CONTRAFUERTES=270161725,
  CASA_BLANCA=269739384,MUSEO=6800675,POLVORIN=60252372;
export const CASA_WINGS=[269739380,269739381,269739382,269739383,269739385];
// Closed courtyards (.2: exact mapped holes).
export const COURTYARDS=[929959,929960,3435178,6800675,3610153,3595797];
// Facade styles. wall/trim/plinth/fill/shutter colours are photo-led; bay, floor, opening ratios inferred.
// plinth: base colour, plinthH its height over the highest ground; win: window width/height as fractions of bay/floor; door: every n-th street bay (phase), 0 = none; stone: Casa Blanca's
// rough retaining base up to the building's high ground; arch: arched window heads; quoins: corner blocks.
const S=(o)=>({bay:4,floor:3.8,win:[.36,.5],door:[3,1],plinthH:.7,cornice:.7,parapet:.55,fill:'#3a3029',shutter:null,
  quoins:false,stone:false,arch:false,eave:false,...o});
export const STYLE={
  // Ballajá — Bjoertvedt 2016 outer face, Wikimedia Commons curid=163264065: long ochre/buff three-register block, cream bands and cornice, ordered
  // deep openings with dark timber, darker rough base.
  [BALLAJA]:S({wall:'#d4ad78',trim:'#efe4cb',plinth:'#a08c74',fill:'#4a4d4c',shutter:'#5b4836',bay:3.7,floor:4.2,win:[.34,.52],door:[0,0],plinthH:1.0,cornice:.8}),
  // Asilo — P. Hughes 2009: ochre, white surrounds/entablature, green arched joinery, dark plinth.
  [ASILO]:S({wall:'#d5a24a',trim:'#f4efe3',plinth:'#8a8076',fill:'#2f5846',bay:4.4,floor:4.6,win:[.34,.5],door:[0,0],quoins:true}),
  // Escuela — Wikimedia Commons curid=126751363: golden-yellow walls, white quoins/trim, teal-green windows, reddish base, white portico, red dome.
  [ESCUELA]:S({wall:'#e2b84c',trim:'#f6f3ea',plinth:'#b9735a',fill:'#2f6a63',bay:4.2,floor:4.3,win:[.34,.48],door:[0,0],quoins:true,plinthH:.55}),
  1344473441:S({wall:'#d4c8b2',trim:'#ece6d8',plinth:'#8d8476',bay:5,win:[.28,.4],door:[0,0]}),
  // San José — Mariordo 2019 lateral face: plain white, spare tall arched openings high in the wall, dark timber doors.
  [SANJOSE]:S({wall:'#f1eee5',trim:'#e0dbcd',plinth:'#c2bba9',fill:'#2f2a25',bay:4.6,floor:99,win:[.24,.0],door:[0,0],parapet:.7,cornice:.5}),
  // Galería Nacional / Dominican convent — no matched finish (survey): austere cream, small deep openings, quiet parapet.
  3435178:S({wall:'#ebe2cf',trim:'#d9ccb0',plinth:'#a49783',fill:'#3a3029',bay:3.6,floor:4.2,win:[.3,.42],door:[4,2]}),
  269744558:S({wall:'#e9dfcb',trim:'#d6c8ab',plinth:'#a49783',fill:'#3a3029',bay:3.6,floor:4.2,win:[.3,.42],door:[3,1]}),
  // Casals — wanderlost63 2012: warm ochre, white rectangular surrounds, green timber, long dark iron balcony (three axes).
  [CASALS]:S({wall:'#d8a24f',trim:'#f3efe4',plinth:'#8c7b62',fill:'#2c5a43',shutter:'#2f5f46',bay:2.9,floor:3.9,win:[.42,.6],door:[3,1]}),
  // Contrafuertes — HABS PR-1530: buttressed street wall (no paint source: restrained pale).
  [CONTRAFUERTES]:S({wall:'#e6dcc6',trim:'#d4c7ab',plinth:'#9a8e7b',fill:'#3a3029',bay:3.6,win:[.3,.44],door:[3,1]}),
  // Casa Blanca family — Hughes 2018 / Ligocsicnarf89 2025: weathered white over rough pale-grey retaining masonry, dark
  // wooden shutters, shallow overhanging tile roof.
  [CASA_BLANCA]:S({wall:'#efede6',trim:'#e4e1d8',plinth:'#a9a497',fill:'#3f2d22',shutter:'#4a3426',bay:3.6,floor:3.4,win:[.36,.52],door:[0,0],stone:true,eave:true,parapet:0,cornice:.35}),
  ...Object.fromEntries(CASA_WINGS.map(id=>[id,S({wall:'#ece9e1',trim:'#e1ddd3',plinth:'#a9a497',fill:'#3f2d22',shutter:'#4a3426',bay:3.8,floor:3.4,win:[.3,.5],door:[0,0],stone:true,eave:true,parapet:0,cornice:.3})])),
  // Museo de San Juan — Ligocsicnarf89 2025: ochre one-storey market, white cornice and surrounds, arc-headed openings,
  // green fanlight over the central portal.
  [MUSEO]:S({wall:'#d9a447',trim:'#f4efe2',plinth:'#7e705d',fill:'#2f5d45',bay:4.4,floor:4.0,win:[.4,.62],door:[0,0],arch:true}),
  // Polvorín de Santa Elena — P. Hughes 2022 (view-only): weathered grey-cream walled enclosure; magazine drawn on top.
  [POLVORIN]:S({wall:'#d3cdbd',trim:'#e2ddd0',plinth:'#a8a293',bay:99,door:[0,0],parapet:0,cornice:0}),
  // Hospital / Liga / Seminario / Soportal backdrop: shared austere institutional blocks, understated palette (survey).
  3610153:S({wall:'#e1d5bd',trim:'#f0ebdf',plinth:'#7f776a',fill:'#3b3a35',bay:3.8,floor:4.2,win:[.32,.46],door:[5,2]}),
  256659484:S({wall:'#d8c6a2',trim:'#efe8da',plinth:'#7f776a',fill:'#36403a',bay:3.8,floor:4.2,win:[.32,.46],door:[4,1]}),
  256659483:S({wall:'#cfbe9c',trim:'#ece4d4',plinth:'#7f776a',fill:'#36403a',bay:3.8,floor:4.2,win:[.32,.46],door:[4,1]}),
  3595797:S({wall:'#ebe5d6',trim:'#f6f3ea',plinth:'#6a635a',fill:'#3a3631',bay:3.6,floor:4.0,win:[.32,.46],door:[5,2]}),
  256658272:S({wall:'#ece6d7',trim:'#f6f3ea',plinth:'#6a635a',fill:'#3a3631',bay:3.6,floor:4.0,win:[.32,.46],door:[5,2]}),
  256658273:S({wall:'#d9ccb1',trim:'#eee7d6',plinth:'#857b6c',fill:'#3a3631',bay:3.8,floor:4.0,win:[.3,.44],door:[3,1]}),
};
// Raw-only rings (survey.json; Douglas–Peucker 1 m on the two lawns and the grounds, exact elsewhere).
export const PLAZA_SJ=[[-179.632,-181.26],[-187.691,-216.735],[-179.431,-218.882],[-176.041,-216.037],[-172.217,-216.989],
  [-170.052,-221.749],[-162.859,-223.143],[-161.961,-221.018],[-150.533,-223.984],[-148.283,-215.45],[-145.506,-203.839],[-142.189,-189.517]];
export const PARK_BENEFICENCIA=[[-372.837,-190.793],[-330.334,-199.935],[-319.636,-148.432],[-347.879,-147.99],[-372.827,-187.074]];
export const SOPORTAL=[[-214.09,-220.94],[-215.52,-222.17],[-231.95,-218.37],[-220.69,-170.63],[-203.37,-175.79],[-204.92,-183.06],
  [-196.59,-184.82],[-200.87,-204.95],[-210.21,-202.99],[-212.15,-211.88]];
export const BASIN=[[-400.667,-260.99],[-399.875,-257.028],[-395.861,-257.824],[-396.643,-261.776]];
export const BEDS=[[[-391.43,-228.5],[-377.55,-211.53],[-381.26,-231.05]],[[-409.02,-265.35],[-408.24,-261.4],[-404.23,-262.19],[-405.01,-266.14]],
  [[-399.81,-255.01],[-399.02,-251.05],[-395.01,-251.85],[-395.79,-255.8]],[[-393.25,-262.26],[-392.47,-258.3],[-388.45,-259.1],[-389.24,-263.05]],
  [[-401.81,-267.05],[-401.03,-263.08],[-397.0,-263.88],[-397.78,-267.83]],[[-407.69,-259.35],[-406.91,-255.4],[-402.88,-256.19],[-403.68,-260.14]],
  [[-394.51,-268.3],[-393.73,-264.33],[-389.7,-265.13],[-390.5,-269.08]],[[-406.48,-253.35],[-405.69,-249.4],[-401.67,-250.19],[-402.45,-254.14]],
  [[-392.37,-256.15],[-391.58,-252.19],[-387.56,-252.99],[-388.35,-256.94]]];
export const LAWN_NE=[[-345.2,-405.1],[-376.3,-418.8],[-379.3,-416.7],[-391.7,-423.3],[-389.1,-428.2],[-394.3,-431.0],[-391.7,-435.8],[-395.2,-437.6],
  [-383.9,-460.1],[-393.3,-486.0],[-428.1,-479.1],[-430.0,-463.5],[-426.7,-460.2],[-429.0,-457.7],[-437.2,-464.0],[-439.6,-468.9],[-444.5,-466.5],
  [-447.0,-470.4],[-459.8,-460.7],[-466.8,-459.9],[-482.8,-471.7],[-479.2,-475.8],[-541.1,-520.9],[-543.8,-516.9],[-547.7,-520.0],[-545.1,-523.9],
  [-549.7,-527.5],[-549.3,-532.1],[-554.2,-533.4],[-547.2,-560.0],[-561.5,-585.0],[-557.8,-587.5],[-559.2,-589.5],[-564.3,-588.7],[-565.4,-594.2],
  [-575.9,-595.5],[-577.3,-591.5],[-581.0,-590.2],[-583.3,-592.2],[-583.5,-596.4],[-623.4,-601.2],[-621.6,-594.5],[-630.3,-591.8],[-633.0,-600.4],
  [-646.2,-596.2],[-645.4,-587.8],[-648.1,-581.8],[-652.0,-577.7],[-658.5,-574.5],[-659.8,-577.3],[-650.3,-584.1],[-648.2,-587.8],[-648.4,-594.9],
  [-651.2,-597.3],[-658.4,-595.2],[-658.9,-589.9],[-661.8,-585.8],[-729.6,-552.2],[-733.4,-552.2],[-724.2,-549.7],[-718.7,-546.1],[-712.4,-533.7],
  [-475.0,-318.4],[-464.2,-320.6],[-459.5,-320.1],[-452.2,-315.7],[-449.0,-310.5],[-447.5,-299.7],[-444.9,-296.4],[-439.9,-295.1],[-420.3,-299.9],
  [-420.1,-298.5],[-392.4,-303.3],[-392.6,-304.6],[-385.9,-305.6],[-385.6,-304.0],[-306.2,-320.3],[-306.8,-323.5],[-299.0,-325.7],[-298.5,-335.9],
  [-295.7,-343.2],[-296.6,-347.7],[-302.8,-352.4],[-301.0,-355.7],[-314.9,-362.4],[-315.2,-364.4],[-348.6,-382.3],[-350.3,-384.4],[-351.5,-390.9]];
export const LAWN_SW=[[-741.0,-533.9],[-740.1,-535.5],[-740.4,-531.6],[-736.5,-526.3],[-713.2,-524.8],[-477.4,-309.3],[-478.2,-303.7],[-597.7,-206.9],
  [-672.1,-292.6],[-674.9,-297.7],[-674.8,-300.4],[-668.2,-300.7],[-667.2,-291.9],[-613.7,-298.0],[-615.5,-321.0],[-669.6,-314.8],[-668.7,-306.0],
  [-684.7,-304.4],[-685.5,-311.5],[-689.7,-311.1],[-691.5,-312.5],[-693.3,-319.0],[-700.2,-318.7],[-702.3,-313.2],[-706.8,-308.0],[-727.8,-301.5],
  [-729.4,-307.1],[-750.1,-301.3],[-763.5,-306.8],[-766.8,-330.6],[-809.7,-385.9],[-799.8,-391.6],[-803.4,-399.6],[-788.5,-439.6],[-794.1,-443.0],
  [-796.6,-437.0],[-803.5,-438.2],[-820.2,-402.8],[-815.6,-424.8],[-804.8,-446.2],[-802.6,-455.2],[-809.9,-486.7],[-800.5,-488.4],[-768.5,-471.2],[-760.7,-476.5]];
export const CASA_GROUNDS=[[-384.7,-142.5],[-379.6,-147.2],[-397.4,-168.8],[-447.0,-127.5],[-412.8,-97.2],[-351.5,-48.1],[-331.3,-68.9],[-332.1,-69.8],
  [-349.7,-62.4],[-357.5,-79.5],[-367.0,-91.9],[-381.3,-107.9],[-384.2,-105.8],[-399.4,-123.7],[-393.5,-128.4],[-407.7,-146.2],[-396.9,-156.1]];
export const PONCE=[-166.144,-203.032];
// Mapped barrier=gate nodes on private ways (.3). Closed iron leaves between piers, fitted across the road.
// the Calle Beneficencia east gate n2748751836 stands OPEN (piers only): the service road was rideable on the
// base build both ways and stays public. Only the Casa Blanca spur gate is closed (tied to the wings by return walls).
export const GATES=[{node:2748751825,road:256386341,at:[-358.135,-147.359]},{node:2748751836,road:248557854,at:[-384.963,-184.451],open:true},
  {node:2748751844,road:248557854,at:[-445.535,-262.176],open:true}];
// Casa Blanca closure: the garden wall runs on the open edges of the mapped grounds 269740868 (north along the
// service road, west and south along the Recinto road and Calle del Sol) between building corners; the spur yard between the
// wings is closed by the spur gate's returns and two short yard walls (wing 383 → wing 380 → main house).
export const GARDEN_WALL=[[-397.38,-168.83],[-447.0,-127.5],[-412.8,-97.2],[-351.5,-48.1],[-332.1,-69.8]];
export const YARD_WALLS=[[[-371.36,-138.55],[-359.31,-99.02]],[[-359.31,-99.02],[-360.33,-94.63]]];
export const WALL={height:2.4,half:.25,piece:2.5,seal:3.5};
export const LAWN_PATH=386702922;
// Escuela forecourt fence (Wikimedia Commons curid=126751363): ochre piers with dark iron railing on the front line; seals above it (closed courts).
export const FENCE={height:1.85,pier:.62,seal:3.5,half:.2,rail:1.25};
const ccw=r=>signedArea(r)<0?[...r].reverse():r;
const d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),terrace0=t=>t;
export function hash(i,j,k=0){let h=Math.imul(i*73856093^j*19349663^k*83492791,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}

export function createUptownLayout({city,height,terrain,surface,isDry,gate,fort,areas={}}) {
  const colliders=[],tops=[],cuts=[],tint=new Map(),surfaces=[],floorTriangles=[],buildingOverrides=new Map();
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:ccw(outer).map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  const earlier=Object.values(areas).filter(Boolean),dry=isDry??(()=>true);
  const byId=new Map();for(const b of city.buildings)if(!byId.has(b.id))byId.set(b.id,b);
  const roads=city.roads.filter(r=>r.points.some(p=>p[0]>-840&&p[0]<0&&p[1]>-620&&p[1]<-30));
  const roadById=new Map(city.roads.map(r=>[r.id,r]));
  const roadDist=(x,z,r)=>{let d=Infinity;for(let i=0;i+1<r.points.length;i++)d=Math.min(d,segmentDistance(x,z,r.points[i],r.points[i+1]));return d;};
  // 16 m bucket index of road segments and mass bounds (layout time: the tone pass queries ~100k vertices).
  const G=16,cellKey=(i,j)=>i*100003+j,grid=(items,box)=>{const m=new Map();for(const it of items){const b=box(it);
      for(let i=Math.floor(b[0]/G);i<=Math.floor(b[1]/G);i++)for(let j=Math.floor(b[2]/G);j<=Math.floor(b[3]/G);j++){const k=cellKey(i,j);let l=m.get(k);if(!l)m.set(k,l=[]);l.push(it);}}return m;};
  // Early-exit bucket scan (an item spanning several cells may be tested twice; harmless for these predicates).
  const near=(m,x,z,r,fn)=>{for(let i=Math.floor((x-r)/G);i<=Math.floor((x+r)/G);i++)for(let j=Math.floor((z-r)/G);j<=Math.floor((z+r)/G);j++){const l=m.get(cellKey(i,j));if(l)for(const it of l)if(fn(it))return true;}return false;};
  const segs=grid(roads.filter(r=>r.kind!=='steps').flatMap(r=>r.points.slice(1).map((b,i)=>({r,a:r.points[i],b}))),s=>[Math.min(s.a[0],s.b[0]),Math.max(s.a[0],s.b[0]),Math.min(s.a[1],s.b[1]),Math.max(s.a[1],s.b[1])]);
  // Clearance from every carriageway/footway edge (m > 0 = outside the running width by m); kinds filters the ways.
  const onRoad=(x,z,m=0,kinds=null)=>near(segs,x,z,m+4,s=>(!kinds||kinds.includes(s.r.kind))&&segmentDistance(x,z,s.a,s.b)<s.r.width/2+m);
  const masses=city.buildings.filter(b=>b.outer.some(p=>p[0]>-840&&p[0]<0&&p[1]>-620&&p[1]<-30)).map(b=>({id:b.id,ring:b.outer,b:bounds(b.outer)}));
  const massGrid=grid(masses,o=>o.b);
  const inMass=(x,z,m=0,skip=-1)=>near(massGrid,x,z,Math.max(0,m),o=>o.id!==skip&&x>=o.b[0]-m&&x<=o.b[1]+m&&z>=o.b[2]-m&&z<=o.b[3]+m&&
    (inRing(x,z,o.ring)||m>0&&o.ring.some((a,i)=>segmentDistance(x,z,a,o.ring[(i+1)%o.ring.length])<m)));
  // Earlier owners' solids (gate/fort/areas): prisms by ring, boxes by their centre radius.
  const solidItems=[...(gate?.colliders??[]),...(fort?.colliders??[]),...earlier.flatMap(a=>a.colliders??[])].map(c=>c.outer?{ring:c.outer.map(p=>[p.x,p.z])}:
    {c:[c.centre.x,c.centre.z],r:Math.hypot(c.halfExtents.x,c.halfExtents.z)}).map(o=>({...o,b:o.ring?bounds(o.ring):[o.c[0]-o.r,o.c[0]+o.r,o.c[1]-o.r,o.c[1]+o.r]}));
  const solidGrid=grid(solidItems,o=>o.b);
  const inSolid=(x,z,m=0)=>near(solidGrid,x,z,m,o=>x>=o.b[0]-m&&x<=o.b[1]+m&&z>=o.b[2]-m&&z<=o.b[3]+m&&
    (o.ring?inRing(x,z,o.ring)||o.ring.some((a,i)=>segmentDistance(x,z,a,o.ring[(i+1)%o.ring.length])<m):Math.hypot(x-o.c[0],z-o.c[1])<o.r+m));
  // ---- Street-paving clearance (uptown rows). The streets package draws no paving on a grid cell
  // with a tinted corner, so a tint closer than one cell diagonal to its paving punched holes in the street edge and left the
  // raw blue-grey asphalt class showing (the "turquoise" fringe). edgeD(x,z): distance beyond the nearest paving streets
  // draws (carriageway + kerb + sidewalk + its 1.5 m frontage fit; footways/steps/pedestrian lanes; mapped squares and car
  // parks), negative inside; Infinity beyond 8 m. Tints stay > TINT_CLEAR beyond it (one 2 m cell diagonal + margin).
  const TINT_CLEAR=2.9,DRAWN_CAR=new Set(['primary','secondary','primary_link','secondary_link','tertiary','tertiary_link','residential','unclassified','service']),
    DRAWN_LANE=new Set(['pedestrian','footway','cycleway','steps']);
  const edgeList=city.roads.filter(r=>r.id!==LAWN_PATH&&(DRAWN_CAR.has(r.kind)||DRAWN_LANE.has(r.kind)&&r.surface!=='dirt'&&r.surface!=='grass')&&r.points.some(p=>p[0]>-860&&p[0]<20&&p[1]>-640&&p[1]<-10))
    .flatMap(r=>{const w=r.width/2+(DRAWN_CAR.has(r.kind)&&STREETS.sidewalk[r.kind]?STREETS.kerb+STREETS.sidewalk[r.kind]+STREETS.fit:0);return r.points.slice(1).map((b,i)=>({a:r.points[i],b,w}));});
  const edgeSegs=grid(edgeList,s=>[Math.min(s.a[0],s.b[0])-s.w,Math.max(s.a[0],s.b[0])+s.w,Math.min(s.a[1],s.b[1])-s.w,Math.max(s.a[1],s.b[1])+s.w]);
  const squares=GROUND_AREAS.filter(g=>g.kind==='square'||g.kind==='parking').map(g=>({ring:g.ring,b:bounds(g.ring)})).filter(o=>overlapB(o.b,[-860,20,-640,-10],0));
  const edgeD=(x,z)=>{let d=Infinity;for(let i=Math.floor((x-8)/G);i<=Math.floor((x+8)/G);i++)for(let j=Math.floor((z-8)/G);j<=Math.floor((z+8)/G);j++){const l=edgeSegs.get(cellKey(i,j));if(l)for(const s of l)d=Math.min(d,segmentDistance(x,z,s.a,s.b)-s.w);}
    for(const o of squares){if(x<o.b[0]-8||x>o.b[1]+8||z<o.b[2]-8||z>o.b[3]+8)continue;if(inRing(x,z,o.ring))return -1;for(let q=0;q<o.ring.length;q++)d=Math.min(d,segmentDistance(x,z,o.ring[q],o.ring[(q+1)%o.ring.length]));}
    return d;};

  // ---- Shell colours (STYLE). San José keeps its mapped shell height (the lower chapels, stepped masses); the
  // tall nave is drawn above it in sj-uptown.js (special.gable.nave, overhead, no solid needed). ----
  for(const id of OWNED){const st=STYLE[id];if(!st||!byId.has(id))continue;
    buildingOverrides.set(id,{colour:st.wall,roofColour:st.eave?'#b8ad9c':id===SANJOSE?'#d9d4c8':id===POLVORIN?'#b9b3a3':'#c8bca9',});}
  // Polvorín: the mapped footprint is the walled enclosure (photo: ~3 m wall, gabled magazine inside). Its shell drops to a
  // wall 2.8 m over the highest ground of the footprint (drawing and collision); the magazine stands on it (overhead only).
  {const b=byId.get(POLVORIN);if(b){const top=Math.max(...b.outer.map(p=>height(...p)))+2.8;buildingOverrides.get(POLVORIN).roof=top;}}
  const shell=id=>{const b=byId.get(id),o=buildingOverrides.get(id)??{};return b&&{id,outer:b.outer,holes:b.holes??[],base:b.base,roof:o.roof??b.roof};};

  // ---- Faces: outer edges merged where collinear (≤4°, vertex within 0.15 m of the chord), outward normal, per-metre
  // party/blocked flags (another mass within 0.9 m outward), ground 0.35 m out. ----
  const gAt=(f,u,d=.35)=>height(f.a[0]+f.ux*u+f.n[0]*d,f.a[1]+f.uz*u+f.n[1]*d);
  const gRange=(f,u0,u1,d=.35)=>{let lo=Infinity,hi=-Infinity;const n=Math.max(2,Math.ceil((u1-u0)/.5));
    for(let k=0;k<=n;k++){const g=gAt(f,Math.max(0,Math.min(f.L,u0+(u1-u0)*k/n)),d);lo=Math.min(lo,g);hi=Math.max(hi,g);}return [lo,hi];};
  function merged(ring){let r=ring.map(p=>[...p]),changed=true;
    while(changed&&r.length>3){changed=false;for(let i=0;i<r.length;i++){const p=r[(i+r.length-1)%r.length],q=r[i],s=r[(i+1)%r.length];
      const a1=Math.atan2(q[1]-p[1],q[0]-p[0]),a2=Math.atan2(s[1]-q[1],s[0]-q[0]),da=Math.abs(Math.atan2(Math.sin(a2-a1),Math.cos(a2-a1)));
      if(da<4*Math.PI/180&&segmentDistance(q[0],q[1],p,s)<.15){r.splice(i,1);changed=true;break;}}}return r;}
  const facesOf=id=>{const s=shell(id);if(!s)return [];const r=merged(s.outer),out=[];
    for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<2.4)continue;
      const [ux,uz]=unit(a,b),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];const n=inRing(m[0]-uz*.08,m[1]+ux*.08,s.outer)?[uz,-ux]:[-uz,ux];
      const f={id,i,a,b,L,ux,uz,n},blocked=[];
      for(let u=.5;u<L;u+=1){const x=a[0]+ux*u+n[0]*.9,z=a[1]+uz*u+n[1]*.9;blocked.push(inMass(x,z,0,id)||inRing(x,z,s.outer));}
      f.blocked=blocked;f.party=blocked.filter(Boolean).length/blocked.length;if(f.party>.6)continue;
      [f.lo,f.hi]=gRange(f,0,L);
      const mx=m[0]+n[0]*3,mz=m[1]+n[1]*3;f.street=roads.some(q=>q.kind!=='footway'&&roadDist(mx,mz,q)<q.width/2+4);
      out.push(f);}
    return out;};
  const clearSpan=(f,u0,u1)=>{for(let k=Math.max(0,Math.floor(u0-.5));k<=Math.min(f.blocked.length-1,Math.ceil(u1-.5));k++)if(f.blocked[k])return false;return true;};

  // ---- Facade grid per face (sills and door feet follow the terrain). ----
  const facades=[];
  function facade(id,f,{exclude=[],role='plain'}={}){
    const st=STYLE[id],s=shell(id),gTopB=Math.max(...s.outer.map(p=>height(...p)));
    const top=s.roof-st.cornice;let base0=st.stone?Math.max(f.hi,gTopB)+.1:f.hi+.05;
    let storeys=Math.max(1,Math.round((top-base0)/st.floor));if(st.floor>50)storeys=1;
    while(storeys>1&&(top-base0)/storeys<2.6)storeys--;const fh=(top-base0)/storeys;
    const F={id,face:f,role,style:st,roof:s.roof,top,base0,fh,storeys,openings:[],plinths:[],stoneTop:st.stone?base0-.05:null};
    // Plinth/base pieces ≤6 m, shortened on steep faces so each spans ≤0.6 m of ground rise (min 1 m): a stepped base,
    // not a 3 m dark slab on Calle del Hospital (bottom 0.3 m under the lowest ground of the piece, top over its highest).
    for(let u=0;u<f.L-1e-6;){let len=Math.min(6,f.L-u),r=gRange(f,u,u+len,.15);
      while(len>1.05&&r[1]-r[0]>.6){len=Math.max(1,len/2);r=gRange(f,u,u+len,.15);}
      const u1=u+len,[lo,hi]=r;F.plinths.push({u0:u,u1,y0:lo-.3,y1:st.stone?Math.max(hi+.4,base0-.05):hi+st.plinthH});u=u1;}
    const nb=f.L<st.bay*.75?0:Math.max(1,Math.round(f.L/st.bay)),bw=nb?f.L/nb:0;F.bays=nb;F.bw=bw;
    const ex=u=>exclude.some(([a,b])=>u>a&&u<b);
    for(let i=0;i<nb;i++){const u=(i+.5)*bw;if(ex(u))continue;const w=Math.min(bw*st.win[0],1.45);if(u-w/2<.55||u+w/2>f.L-.55)continue;
      if(!clearSpan(f,u-bw*.4,u+bw*.4))continue;
      const [glo,ghi]=gRange(f,u-w/2-.15,u+w/2+.15);
      // Door: on street faces every n-th bay; its foot is 3 cm under the lowest ground across it (no sill off the ground).
      if(role!=='arcade'&&f.street&&st.door[0]&&i%st.door[0]===st.door[1]&&ghi-glo<.32&&!st.stone){const y0=glo-.03,y1=Math.min(base0+fh-.4,y0+2.9);
        if(y1-y0>=2.15){F.openings.push({kind:'door',u,w:Math.max(1.2,Math.min(1.7,w+.2)),y0,y1});continue;}}
      if(role==='arcade'){// Wikimedia Commons curid=126751363: two storeys of round arches on piers; the ground arches reach the court floor.
        F.openings.push({kind:'arcade',u,w:bw*.64,y0:glo-.03,y1:base0+fh-.5,storey:0});
        for(let k=1;k<storeys;k++)F.openings.push({kind:'arcade',u,w:bw*.64,y0:base0+k*fh+.95,y1:base0+(k+1)*fh-.5,storey:k});continue;}
      for(let k=0;k<storeys;k++){const y0=base0+k*fh;
        if(id===SANJOSE){// Mariordo 2019 lateral: small punched dark square openings high in the plain white wall.
          const yb=base0+fh*.62;if(yb>ghi+3&&yb+.9<top-.3)F.openings.push({kind:'win',u,w:.85,y0:yb,y1:yb+.85,storey:0});continue;}
        // Head/sill hierarchy (on Ballajá): taller ground-floor openings, squatter top register.
        const h=Math.min(fh*st.win[1]*(storeys>2?(k===0?1.12:k===storeys-1?.82:1):1),2.6),yc=y0+fh*(k===0&&storeys>1?.5:.52),yb=yc-h/2;
        if(yb<ghi+(k===0?.75:.5)||yc+h/2>top-.25)continue;
        F.openings.push({kind:st.arch?'arch':'win',u,w,y0:yb,y1:yb+h,storey:k});}}
    facades.push(F);return F;}

  // ---- Landmark faces and specials. ----
  const special={portals:[],pediments:[],porticos:[],arcadeFaces:[],belfry:null,gable:null,balconies:[],buttresses:[],crest:null,domes:[]};
  // Ballajá: emphasized portal axis at the centre of the Norzagaray (north) and Goenaga (south) faces (Bjoertvedt 2016;
  // positions inferred). Frontispiece 0.3 m proud, rising 1.2 m above the cornice; closed dark double doors.
  for(const f of facesOf(BALLAJA)){const big=f.L>60,ex=[];
    if(big&&Math.abs(f.n[1])>.9){const u=f.L/2,[lo,hi]=gRange(f,u-4,u+4);special.portals.push({id:BALLAJA,face:f,u,w:7.2,lo,hi,top:shell(BALLAJA).roof+1.2,door:[2.6,3.9],reveal:true});ex.push([u-4.6,u+4.6]);}
    facade(BALLAJA,f,{exclude:ex,role:big?'long':'plain'});}
  // Asilo: centre three bays on the long NE face (towards Plaza de Ballajá; inferred): a 0.4 m projecting frontispiece,
  // low triangular pediment (1.6 m rise), three broad arches below, paired pilasters above (P. Hughes 2009).
  for(const f of facesOf(ASILO)){const ex=[];
    if(f.L>60&&f.n[0]>.6){const u=f.L/2,[lo,hi]=gRange(f,u-7.5,u+7.5);special.pediments.push({id:ASILO,face:f,u,w:14.4,lo,hi,proud:.4,rise:1.7});ex.push([u-7.6,u+7.6]);}
    facade(ASILO,f,{exclude:ex});}
  // Escuela (Wikimedia Commons curid=126751363): the lawn front is a comb — end pavilions and the centre block on the front line, arcaded wings set
  // back ~21 m. Central block: white tetrastyle portico, pediment, red dome with lantern behind. Courts closed by the fence.
  const esc=shell(ESCUELA),escFaces=facesOf(ESCUELA),NW=[-.64,-.77];
  {const d=p=>p[0]*NW[0]+p[1]*NW[1],fronts=escFaces.filter(f=>f.n[0]*NW[0]+f.n[1]*NW[1]>.95),front=Math.max(...fronts.map(f=>d(f.a)));
    const AX=[-NW[1],NW[0]],us=esc.outer.map(p=>p[0]*AX[0]+p[1]*AX[1]),uC=(Math.min(...us)+Math.max(...us))/2;
    const centre=fronts.filter(f=>d(f.a)>front-1).sort((x,y)=>Math.abs(((x.a[0]+x.b[0])/2)*AX[0]+((x.a[1]+x.b[1])/2)*AX[1]-uC)-Math.abs(((y.a[0]+y.b[0])/2)*AX[0]+((y.a[1]+y.b[1])/2)*AX[1]-uC))[0];
    for(const f of escFaces){
      if(f===centre){const u=f.L/2,[lo,hi]=gRange(f,u-6,u+6,1.2);special.porticos.push({id:ESCUELA,face:f,u,w:9.6,lo,hi,out:2.6,cols:[-3.9,-1.35,1.35,3.9],top:esc.roof+.2});
        special.domes.push({x:f.a[0]+f.ux*u-f.n[0]*4.6,z:f.a[1]+f.uz*u-f.n[1]*4.6,y:esc.roof,r:3.3,drum:3.4});facade(ESCUELA,f,{exclude:[[u-5.2,u+5.2]],role:'centre'});}
      else if(fronts.includes(f)&&d(f.a)<front-8){special.arcadeFaces.push(f);facade(ESCUELA,f,{role:'arcade'});}
      else facade(ESCUELA,f);}
    // Court closure: each set-back wing's court, from its face to 1.3 m inside the front line (inside the pavilion corners,
    // 0.8–1.0 m behind the front, so each fence end meets a return wall), between its two side returns.
    special.courts=special.arcadeFaces.map(f=>{const back=front-d(f.a)-1.3,P=(p,k)=>[p[0]+NW[0]*k,p[1]+NW[1]*k];
      return {face:f,ring:ccw([f.a,f.b,P(f.b,back),P(f.a,back)]),line:[P(f.a,back),P(f.b,back)]};});}
  // San José: plain white gabled front on Calle del Cristo (the plaza sees the lateral elevation, survey), the nave raised,
  // a pitched roof 30 m back, a two-opening bell gable over the front, dark timber doors (Mariordo 2019; inferred sizes).
  // Nave block (inferred): the front's northern 4 m short of the plaza side, 30 m deep, walls from the mapped roof to 46.0 m;
  // the plaza-side 4 m and the chapels stay at the mapped height (stepped white masses).
  {const fs=facesOf(SANJOSE),plazaFace=fs.filter(f=>f.n[1]>.9).reduce((m,f)=>!m||f.L>m.L?f:m,null);
    for(const f of fs){
      if(f.n[0]<-.9&&f.L>15){const U=f.L-4,u=U/2,[lo,hi]=gRange(f,u-1.2,u+1.2);special.gable={id:SANJOSE,face:f,u,u0:0,u1:U,w:U,rise:4.2,depth:30,roof:46.0,base:shell(SANJOSE).roof};
        special.belfry={face:f,u,w:3.6,h:3.8};special.portals.push({id:SANJOSE,face:f,u,w:4.6,lo,hi,top:Math.min(lo+7.2,shell(SANJOSE).roof-.6),door:[2.6,4.3],church:true});
        facade(SANJOSE,f,{exclude:[[u-3,u+3]],role:'front'});}
      else{const F=facade(SANJOSE,f);
        // One closed lateral arched door at ground level on the longest plaza face (Mariordo 2019).
        if(f===plazaFace){const u=f.L/2,[glo,ghi]=gRange(f,u-1.4,u+1.4);if(ghi-glo<.3){F.openings=F.openings.filter(o=>Math.abs(o.u-u)>2);F.openings.push({kind:'archdoor',u,w:2.4,y0:glo-.03,y1:glo+3.7});}}}}}
  // Casals: one long shallow dark iron balcony across three axes of the plaza face (wanderlost63 2012).
  for(const f of facesOf(CASALS)){const F=facade(CASALS,f);if(f.n[0]<-.9&&F.storeys>1)special.balconies.push({face:f,u0:.5,u1:f.L-.5,y:F.base0+F.fh,depth:.7,iron:true});}
  // Contrafuertes: the buttress rhythm on the street wall (HABS PR-1530), solid 0.8 m deep, stepped.
  for(const f of facesOf(CONTRAFUERTES)){const F=facade(CONTRAFUERTES,f,{exclude:f.street&&f.L>12?[[0,f.L]]:[]});
    if(f.street&&f.L>12){const k=4;for(let i=0;i<k;i++){const u=.6+i*(f.L-1.2)/(k-1),[lo,hi]=gRange(f,u-.5,u+.5,.5);
      special.buttresses.push({face:f,u,w:1.0,depth:.8,lo,hi,top:F.roof-1.6});}
      for(let i=0;i+1<k;i++){const u=.6+(i+.5)*(f.L-1.2)/(k-1),w=1.2,[glo,ghi]=gRange(f,u-.8,u+.8);
        F.openings.push({kind:'door',u,w,y0:glo-.03,y1:glo+2.7});F.openings.push({kind:'win',u,w,y0:F.base0+F.fh+.6,y1:F.base0+F.fh+2.4,storey:1});}}}
  // Casa Blanca main house: continuous upper timber balcony on the downhill (Calle del Sol) face (Hughes 2018).
  for(const f of facesOf(CASA_BLANCA)){const F=facade(CASA_BLANCA,f);if(f.n[1]>.5&&f.L>15&&F.storeys>1)special.balconies.push({face:f,u0:1,u1:f.L-1,y:F.base0+F.fh,depth:1.0,iron:false});}
  for(const id of CASA_WINGS)for(const f of facesOf(id))facade(id,f);
  // Museo de San Juan: central portal under a green fanlight on the Norzagaray front, raised crest over the cornice.
  for(const f of facesOf(MUSEO)){const ex=[];
    if(f.n[1]<-.9&&f.L>40){const u=f.L/2,[lo,hi]=gRange(f,u-2,u+2);special.portals.push({id:MUSEO,face:f,u,w:5.4,lo,hi,top:shell(MUSEO).roof+1.6,door:[2.6,3.4],fan:true});ex.push([u-3.4,u+3.4]);}
    facade(MUSEO,f,{exclude:ex});}
  for(const id of OWNED)if(![BALLAJA,ASILO,ESCUELA,SANJOSE,CASALS,CONTRAFUERTES,CASA_BLANCA,MUSEO,POLVORIN,...CASA_WINGS].includes(id))for(const f of facesOf(id))facade(id,f);
  // Polvorín (P. Hughes 2022): enclosure faces (coping, one closed door on the west front), a garita on the south-west
  // corner, the magazine (ridge along the long axis, gable to the west, rusty tile roof, round vents) and two tall pillars.
  {const s0=shell(POLVORIN);if(s0){const faces=facesOf(POLVORIN),long=faces.reduce((m,f)=>f.L>m.L?f:m,faces[0]),[ax,az]=[long.ux,long.uz];
    const pts=s0.outer,us=pts.map(p=>p[0]*ax+p[1]*az),vs=pts.map(p=>-p[0]*az+p[1]*ax),u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs),v1=Math.max(...vs);
    const W=(u,v)=>[u*ax-v*az,u*az+v*ax],top=s0.roof,mag={u0:u0+6,u1:u1-6,v0:v0+4,v1:v1-4};
    const west=faces.filter(f=>f.L<30).sort((a,b)=>(a.a[0]+a.b[0])-(b.a[0]+b.b[0]))[0];
    const doorU=west?west.L*.62:0,[glo]=west?gRange(west,doorU-.7,doorU+.7):[0];
    special.polvorin={faces,top,ax,az,W,mag,eave:top+2.4,ridge:top+2.4+3.4,west,door:west&&{u:doorU,w:1.3,y0:glo-.03,y1:glo+2.3},
      garita:(()=>{const c=pts.reduce((m,p)=>Math.hypot(p[0]+669.59,p[1]+314.824)<Math.hypot(m[0]+669.59,m[1]+314.824)?p:m,pts[0]);return {x:c[0],z:c[1],y:height(...c)};})(), // south-west corner (photo)
      // free-standing pillars beside the magazine at diagonally opposite ends (photo: north side at the east end, south
      // side by the west gable), 1.4 m outside its long walls: clear of the 0.5 m roof overhang, inside the enclosure
      pillars:[W(mag.u0+1.5,mag.v1+1.4),W(mag.u1-3,mag.v0-1.4)]};
    if(special.polvorin.door)facades.push({id:POLVORIN,face:west,role:'enclosure',style:STYLE[POLVORIN],roof:top,top,base0:west.hi,fh:top-west.hi,storeys:1,
      openings:[{kind:'door',...special.polvorin.door}],plinths:[],stoneTop:null,bays:0,bw:0});}}

  // ---- the drawn shell under each opening. A face line can sit off its building's
  // drawn ring (face 3435178/8 runs at an angle to it: the ring stands 4–13 cm proud). Each opening records the ring's outward
  // exit along the face normal across its trim footprint (every 5 cm): `shell` (max) and `shellMin` (min), ≥ 0; the builder
  // seats trim, leaf, glazing and sills outside `shell` and backs the trim down to `shellMin`.
  {const TRIM={door:.4,archdoor:.5,arcade:.36,arch:.3,win:.3};
    for(const F of facades){const f=F.face,cx=f.a[0]+f.ux*f.L/2,cz=f.a[1]+f.uz*f.L/2,R=f.L/2+30;
      const rings=city.buildings.filter(b=>b.outer.some(p=>Math.abs(p[0]-cx)<R&&Math.abs(p[1]-cz)<R)).map(b=>b.outer);
      const exitAt=u=>{const ox=f.a[0]+f.ux*u-f.n[0]*.3,oz=f.a[1]+f.uz*u-f.n[1]*.3,dx=f.n[0],dz=f.n[1];let best=0;
        for(const r of rings)for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],ex=q[0]-p[0],ez=q[1]-p[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-12)continue;
          const t=((p[0]-ox)*ez-(p[1]-oz)*ex)/den,sg=((p[0]-ox)*dz-(p[1]-oz)*dx)/den;if(sg<0||sg>1||t<0||t>.8)continue;best=Math.max(best,t-.3);}return best;};
      for(const o of F.openings){const tw=o.w+(TRIM[o.kind]??.3);let mx=0,mn=Infinity;for(let u=o.u-tw/2;u<=o.u+tw/2+1e-6;u+=.05){const e=exitAt(u);mx=Math.max(mx,e);mn=Math.min(mn,e);}
        o.shell=mx;o.shellMin=Math.min(mx,mn);}}}
  // ---- Solids for the parts standing proud of the mapped shells (fit to what is drawn). ----
  const faceRing=(f,u0,u1,d0,d1)=>{const P=(u,d)=>[f.a[0]+f.ux*u+f.n[0]*d,f.a[1]+f.uz*u+f.n[1]*d];return ccw([P(u0,d0),P(u1,d0),P(u1,d1),P(u0,d1)]);};
  for(const p of special.portals)prism(faceRing(p.face,p.u-p.w/2,p.u+p.w/2,-.05,.3),p.lo-.3,p.top);
  for(const p of special.pediments)prism(faceRing(p.face,p.u-p.w/2,p.u+p.w/2,-.05,p.proud),p.lo-.3,shell(p.id).roof);
  for(const p of special.porticos){for(const c of p.cols){const r=faceRing(p.face,p.u+c-.42,p.u+c+.42,p.out-.42,p.out+.42),g=Math.min(...r.map(q=>height(...q)));
      p.colBase=Math.min(p.colBase??Infinity,g);prism(r,g-.3,p.top-1.4);}
    prism(faceRing(p.face,p.u-p.w/2,p.u+p.w/2,-.05,.35),p.lo-.3,p.top);}
  for(const b of special.buttresses)prism(faceRing(b.face,b.u-b.w/2,b.u+b.w/2,-.05,b.depth),b.lo-.3,b.top);
  if(special.polvorin){const g=special.polvorin.garita;prism(circle(g.x,g.z,.95,10),g.y-.3,special.polvorin.top+1.2);}

  // ---- Escuela courts: fence on the front line (piers + iron), invisible non-occluding seals to 3.5 m over the highest
  // ground nearby, private court interiors (placement/recovery/arrivals; the closed-cemetery recipe). ----
  const fence=[],seals=[];
  for(const c of special.courts??[]){const [p,q]=c.line,L=Math.hypot(q[0]-p[0],q[1]-p[1]),n=Math.max(1,Math.round(L/3.2));
    for(let k=0;k<n;k++){const A=[p[0]+(q[0]-p[0])*k/n,p[1]+(q[1]-p[1])*k/n],B=[p[0]+(q[0]-p[0])*(k+1)/n,p[1]+(q[1]-p[1])*(k+1)/n];
      const g0=height(...A),g1=height(...B);fence.push({p:A,q:B,g0,g1});
      const [ux,uz]=unit(A,B),h=FENCE.half,r=[[A[0]-uz*h,A[1]+ux*h],[B[0]-uz*h,B[1]+ux*h],[B[0]+uz*h,B[1]-ux*h],[A[0]+uz*h,A[1]-ux*h]];
      prism(r,Math.min(g0,g1)-.3,Math.max(g0,g1)+FENCE.height);
      let top=-Infinity;for(const t of [0,.5,1])for(const o of [-2,0,2]){const x=A[0]+(B[0]-A[0])*t-uz*o,z=A[1]+(B[1]-A[1])*t+ux*o;top=Math.max(top,height(x,z));}
      const s=prism(r,Math.max(g0,g1)+FENCE.height-.05,top+FENCE.seal);if(s){s.occludes=false;seals.push(s);}}}
  const courtRings=(special.courts??[]).map(c=>c.ring);

  // ---- Plaza San José (Ligocsicnarf89 2025: warm stone/brick paving under broadleaf shade; 'panel' warm-grey/rose kind),
  // minus the masses and the Cristo/San Sebastián carriageways (the streets package paves those). ----
  const earlierRings=[...earlier.flatMap(a=>[...(a.surfaces??[]),...(a.brick??[])].map(s=>s.ring)),
    ...earlier.flatMap(a=>(a.floorTriangles??[]).map(t=>t.map(p=>[p[0],p[2]]))).filter(r=>Math.abs(signedArea(r))>1e-4),
    ...(gate?.surfaces??[]).map(s=>s.ring),...(fort?.surfaces??[]).map(s=>s.ring)];
  const massPieces=masses.filter(o=>overlapB(o.b,[-200,-130,-235,-175],2)).flatMap(o=>convexPieces(o.ring)).map(p=>({p,b:bounds(p)}));
  // the plaza is a warm brick/stone field (Ligocsicnarf89 2025), drawn by sj-uptown.js on the original terrain
  // facets like Princesa's Raíces brick; returned as `brick` (ownership for later areas).
  const brick=[];
  // Bounds cached once (the merged world has thousands of earlier rings; recomputing them per call cost ~250 ms).
  const earlierB=earlierRings.map(r=>({r,b:bounds(r)})),doneB=[],massPc=new Map();
  const keep=(pieces,owner,kind,extra=[])=>{const bx=bounds(pieces.flat());
    const block=[...earlierB.filter(o=>overlapB(o.b,bx,.5)).map(o=>o.r),...masses.filter(o=>overlapB(o.b,bx,.5)).flatMap(o=>{if(!massPc.has(o))massPc.set(o,convexPieces(o.ring));return massPc.get(o);}),...extra,...doneB.filter(o=>overlapB(o.b,bx,.5)).map(o=>o.r)];
    pieces=minus(pieces,block).filter(r=>r.every(p=>dry(p[0],p[1])));
    for(const ring of pieces){(kind==='brick'?brick:surfaces).push({kind,ring,owner:'uptown:'+owner});doneB.push({r:ring,b:bounds(ring)});}};
  {const carriage=[22230837,259147610].map(id=>roadById.get(id)).filter(Boolean).flatMap(r=>ribbon(r.points,-r.width/2,r.width/2));
    keep(convexPieces(ccw(PLAZA_SJ)),196605698,'brick',carriage);}
  // ---- Plaza San José is a built surface. The brick field
  // used to drape the 2 m DEM facets, so every kink (a 12–16 cm tent in front of the statue) showed through the joint grid
  // and the plinth looked as if it hung over a hole. A boundary-pinned surface replaces BOTH the drawn and the physical
  // triangles inside the plaza's own pieces: S = T + w·(F − T), T the existing drawn ground, F a least-squares gentle
  // quadratic over the plaza, w a smoothstep of the distance to the region's outer edge (0 on the edge, 1 from 3 m in).
  // On the edge S = T exactly (lip-free joins with the streets, steps, thresholds and the church; nothing outside changes).
  // Triangles: the DEM grid's own cells and diagonal clipped to each convex piece; the same triangles are the drawn brick,
  // the replacement floor (`tops`, replacesTerrain) and the boundary of the tight render cut that removes the old facets.
  const plazaSJ=(()=>{const P=brick.filter(b=>b.owner==='uptown:196605698').map(b=>b.ring);if(!P.length)return null;
    const pb=P.map(r=>({r,b:bounds(r)})),inP=(x,z)=>pb.some(o=>x>=o.b[0]-1e-9&&x<=o.b[1]+1e-9&&z>=o.b[2]-1e-9&&z<=o.b[3]+1e-9&&inRing(x,z,o.r));
    const edges=[];for(const r of P)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],[ux,uz]=unit(a,b),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      if(!(inP(m[0]-uz*.05,m[1]+ux*.05)&&inP(m[0]+uz*.05,m[1]-ux*.05)))edges.push([a,b]);}
    const dB=(x,z)=>{let d=Infinity;for(const [a,b] of edges)d=Math.min(d,segmentDistance(x,z,a,b));return d;};
    const B=bounds(P.flat()),R=3;
    // least-squares quadratic over a 1 m lattice inside the plaza (normal equations, 6×6, Gauss)
    const A=Array.from({length:6},()=>new Array(7).fill(0));
    for(let x=Math.ceil(B[0]);x<=B[1];x++)for(let z=Math.ceil(B[2]);z<=B[3];z++){if(!inP(x,z))continue;const u=x-B[0],v=z-B[2],f=[1,u,v,u*u,u*v,v*v],y=height(x,z);
      for(let i=0;i<6;i++){for(let j=0;j<6;j++)A[i][j]+=f[i]*f[j];A[i][6]+=f[i]*y;}}
    for(let i=0;i<6;i++){let p=i;for(let r=i+1;r<6;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;[A[i],A[p]]=[A[p],A[i]];
      for(let r=0;r<6;r++)if(r!==i){const k=A[r][i]/A[i][i];for(let c=i;c<7;c++)A[r][c]-=k*A[i][c];}}
    const c=A.map((row,i)=>row[6]/row[i]),F=(x,z)=>{const u=x-B[0],v=z-B[2];return c[0]+c[1]*u+c[2]*v+c[3]*u*u+c[4]*u*v+c[5]*v*v;};
    const S=(x,z)=>{const T=height(x,z);if(!inP(x,z))return T;const t=Math.min(1,dB(x,z)/R),w=t*t*(3-2*t);return T+w*(F(x,z)-T);};
    // DEM-aligned triangles clipped to each convex piece (Sutherland–Hodgman in plan), fan-triangulated, y = S
    const {x0,z0,step}=terrain,tris=[],clip=(poly,ring)=>{const sg=Math.sign(signedArea(ring));let out=poly;
      for(let j=0;j<ring.length&&out.length;j++){const a=ring[j],b=ring[(j+1)%ring.length],inp=out;out=[];const dd=p=>sg*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
        for(let k=0;k<inp.length;k++){const p=inp[k],q=inp[(k+1)%inp.length],dp=dd(p),dq=dd(q);if(dp>=0)out.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}}
      return out;};
    for(const r of P){const rb=bounds(r);
      for(let i=Math.floor((rb[0]-x0)/step);i<=Math.floor((rb[1]-x0)/step);i++)for(let j=Math.floor((rb[2]-z0)/step);j<=Math.floor((rb[3]-z0)/step);j++){
        const x=x0+i*step,z=z0+j*step,a=[x,z],b=[x+step,z],cc=[x,z+step],d=[x+step,z+step];
        for(const t of [[a,cc,b],[b,cc,d]]){const poly=clip(t,r);if(poly.length<3)continue;const Y=poly.map(p=>[p[0],S(...p),p[1]]);
          for(let q=1;q+1<Y.length;q++){const tri=[Y[0],Y[q],Y[q+1]];if(Math.abs((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0]))<1e-6)continue;tris.push(tri);}}}}
    for(const tri of tris){const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:Math.max(p[1],q[1],w[1]),plane:{x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny},replacesTerrain:true,maxReferenceY:Math.max(p[1],q[1],w[1])+2.5,surface:'pavement',source:'uptown:plaza-sj'});}
    for(const r of P){const ring=ccw(r),[minX,maxX,minZ,maxZ]=bounds(ring),sa=Math.sign(signedArea(ring));
      cuts.push({ring,planes:ring.map((a,k)=>{const b=ring[(k+1)%ring.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1,nx=-sa*ez/l,nz=sa*ex/l;return [nx,0,nz,-(nx*a[0]+nz*a[1])];}),minX,maxX,minZ,maxZ,kind:'uptown-plaza',tight:true});}
    return {pieces:P,edges,tris,S,inP,F};})();
  // Ground under props: the plaza surface inside the plaza, the drawn terrain elsewhere (seating rule).
  const groundAt=(x,z)=>plazaSJ&&plazaSJ.inP(x,z)?plazaSJ.S(x,z):height(x,z);
  // Lawn footway 386702922 (concrete, 2.2 m): a pale 'morro' drape instead of the blue raster trace (lawn row).
  {const r=roadById.get(LAWN_PATH);if(r)keep(ribbon(r.points,-r.width/2,r.width/2),LAWN_PATH,'morro');}

  // ---- Ponce de León (n4560131422, 1882; P. Hughes 2018): dark bronze standing figure, one arm extended, on a tall pale
  // panelled plinth over two warm steps. Plinth 1.8 m square exactly on the mapped point; solid from below the lowest
  // terrain of its 3.0 m step footprint to the plinth top. Facing: south, toward the plaza's open half (inferred). ----
  const statue=(()=>{const [x,z]=PONCE,foot=[];for(const a of [-1.5,0,1.5])for(const b of [-1.5,0,1.5])foot.push([x+a,z+b]);
    // seated on the plaza surface: footprint sampled on a 0.5 m lattice over the 3 m step square
    const fp=[];for(let a=-1.5;a<=1.5;a+=.5)for(let b=-1.5;b<=1.5;b+=.5)fp.push(groundAt(x+a,z+b));
    const lo=Math.min(...fp),hi=Math.max(...fp);
    const sq=(r)=>ccw([[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]]);const step1=hi+.22,step2=step1+.2,plinthTop=step2+2.3;
    prism(sq(1.5),lo-.15,step1);prism(sq(1.2),lo-.15,step2);prism(sq(.9),lo-.15,plinthTop+2.0);
    return {x,z,lo,hi,step1,step2,plinthTop,figure:2.0,heading:0};})();

  // ---- Casa Blanca closure (the closed-cemetery recipe): whitewashed garden walls (2.4 m, level-topped 2.5 m pieces
  // stepping with the slope) on the open edges, the spur gate tied to the wings, two short yard walls; invisible non-occluding
  // seals only above drawn walls; the grounds and the yard private for placement, recovery and arrivals. ----
  const SPUR=256386341,publicWays=roads.filter(r=>r.id!==SPUR&&r.kind!=='steps');
  // Interior wall vertices pushed clear of every public way (half width + 0.9 m); building-corner ends stay put.
  const clearPt=p=>{let [x,z]=p;for(let it=0;it<8;it++){let moved=false;
      for(const r of publicWays)for(let i=0;i+1<r.points.length;i++){const a=r.points[i],b=r.points[i+1],need=r.width/2+.9,dx=b[0]-a[0],dz=b[1]-a[1];
        const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1))),cx=a[0]+dx*t,cz=a[1]+dz*t,l=Math.hypot(x-cx,z-cz);
        if(l<need&&l>1e-6){x=cx+(x-cx)/l*need;z=cz+(z-cz)/l*need;moved=true;}}
      if(!moved)break;}return [x,z];};
  const gardenLine=GARDEN_WALL.map((p,i)=>i===0||i===GARDEN_WALL.length-1?p:clearPt(p));
  // First hit of a ray from p along dir with any mapped mass edge (gate returns).
  function faceHit(p,dir,maxD){let best=null;for(const o of masses){if(!overlapB(o.b,[p[0]-maxD,p[0]+maxD,p[1]-maxD,p[1]+maxD]))continue;
      for(let i=0;i<o.ring.length;i++){const a=o.ring[i],b=o.ring[(i+1)%o.ring.length],ex=b[0]-a[0],ez=b[1]-a[1],den=dir[0]*ez-dir[1]*ex;if(Math.abs(den)<1e-9)continue;
        const t=((a[0]-p[0])*ez-(a[1]-p[1])*ex)/den,u=((a[0]-p[0])*dir[1]-(a[1]-p[1])*dir[0])/den;if(t>0&&t<maxD&&u>=0&&u<=1&&(!best||t<best.t))best={t,x:p[0]+dir[0]*t,z:p[1]+dir[1]*t};}}
    return best&&[best.x,best.z];}
  const walls=[];
  const wallRun=(line,kind)=>{for(let k=0;k+1<line.length;k++){const a=line[k],b=line[k+1],L=d2(a,b),n=Math.max(1,Math.ceil(L/WALL.piece));
      for(let i=0;i<n;i++){const p=[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n],q=[a[0]+(b[0]-a[0])*(i+1)/n,a[1]+(b[1]-a[1])*(i+1)/n],[ux,uz]=unit(p,q),h=WALL.half;
        const e=.04,P=[p[0]-ux*e,p[1]-uz*e],Q=[q[0]+ux*e,q[1]+uz*e],r=[[P[0]-uz*h,P[1]+ux*h],[Q[0]-uz*h,Q[1]+ux*h],[Q[0]+uz*h,Q[1]-ux*h],[P[0]+uz*h,P[1]-ux*h]];
        // seating rule: the foot is sampled every 0.25 m along both faces and across the ends
        let lo=Infinity,hi=-Infinity;for(let e=0;e<4;e++){const A=r[e],B2=r[(e+1)%4],L=Math.hypot(B2[0]-A[0],B2[1]-A[1]),n2=Math.max(2,Math.ceil(L/.25));
          for(let k=0;k<=n2;k++){const g=height(A[0]+(B2[0]-A[0])*k/n2,A[1]+(B2[1]-A[1])*k/n2);lo=Math.min(lo,g);hi=Math.max(hi,g);}}
        const top=hi+WALL.height;prism(r,lo-.35,top);
        let gmax=-Infinity;for(const t of [0,.5,1])for(const o of [-2,-1,0,1,2])gmax=Math.max(gmax,height(p[0]+(q[0]-p[0])*t-uz*o,p[1]+(q[1]-p[1])*t+ux*o));
        const s2=prism(r,top-.05,Math.max(top+.6,gmax+WALL.seal));if(s2){s2.occludes=false;seals.push(s2);}
        walls.push({p,q,lo:lo-.35,top,kind});}}};
  wallRun(gardenLine,'garden');for(const l of YARD_WALLS)wallRun(l,'yard');
  const nearWall=(x,z,m)=>walls.some(w2=>segmentDistance(x,z,w2.p,w2.q)<m);
  // Private interiors: the grounds ring with its open edges replaced by the wall line, and the spur yard behind the gate.
  const GARDEN=[...CASA_GROUNDS.slice(0,2),...gardenLine,...CASA_GROUNDS.slice(8)];
  const gateLine=(()=>{const G=GATES[0],r=roadById.get(G.road);if(!r)return null;const [ux,uz]=unit(r.points[0],r.points[1]),px=-uz,pz=ux;
    return [faceHit(G.at,[-px,-pz],8),faceHit(G.at,[px,pz],8)];})();
  const YARD=gateLine&&gateLine.every(Boolean)?[gateLine[0],[-370.51,-144.56],[-371.36,-138.55],[-359.31,-99.02],[-360.33,-94.63],[-362.38,-96.29],[-389.84,-128.21],
    [-393.48,-128.4],[-395.53,-132.37],[-384.72,-142.47],[-379.6,-147.18],[-374.57,-151.53],gateLine[1]]:null;
  // ---- Final polish (#11, own limit): a pale draped footing verge 2.2 m wide along the public side of every
  // closure wall, on the ORIGINAL terrain facets (drawn = physical, no DEM change) — the 2 m-grid teeth at the wall foot now
  // meet a continuous pale apron instead of grass; carriageways (half width + 0.45 m) stay with the streets package. ----
  // ----  (Recinto Oeste (−439,−110) / (−356,−40)): where the DEM smears the real retaining wall into a
  // 0.6–4 m bank at the garden-wall foot, the wall is thickened out to a fitted toe line on the flat lane-side ground: one
  // battered-looking retaining face (muted stone base with a darker footer band, whitewash above, the wall's own top) that
  // meets level ground on a straight line, instead of a pale drape climbing the bank in 2 m-grid triangles. The toe keeps
  // ≥ 0.8 m of open verge before the street paving; collision = the drawn block (wall line → toe, to the wall top; the top is
  // ≥ 3 m over any public ground, unreachable). Joints share one toe point on the bisector, so the face is continuous.
  const privB=[GARDEN,...(YARD?[YARD]:[])].map(r=>({r,b:bounds(r)}));
  const inPrivate=(x,z)=>privB.some(o=>x>=o.b[0]&&x<=o.b[1]&&z>=o.b[2]&&z<=o.b[3]&&inRing(x,z,o.r));
  const publicNormal=c=>{const [ux,uz]=unit(c.p,c.q),m=[(c.p[0]+c.q[0])/2,(c.p[1]+c.q[1])/2];let n=[-uz,ux];
    if(inPrivate(m[0]+n[0]*1.2,m[1]+n[1]*1.2))n=[-n[0],-n[1]];return inPrivate(m[0]+n[0]*1.2,m[1]+n[1]*1.2)?null:n;};
  const footings=[];
  {const S0=.3,cand=[];
    for(const c of walls){if(c.kind!=='garden'){cand.push(null);continue;}const n=publicNormal(c);if(!n){cand.push(null);continue;}
      let T=0,H=-Infinity,ok=true;
      for(const t of [.1,.5,.9]){const P=[c.p[0]+(c.q[0]-c.p[0])*t,c.p[1]+(c.q[1]-c.p[1])*t],at=s=>[P[0]+n[0]*s,P[1]+n[1]*s];
        let smax=S0;for(let s=S0;s<=9;s+=.25){const [x,z]=at(s);if(edgeD(x,z)<.8||inMass(x,z,.3)||inSolid(x,z,.1)&&s>.6)break;smax=s;}
        if(smax<1.2){ok=false;break;}const f=height(...at(smax));H=Math.max(H,height(...at(S0))-f);
        let toe=0;for(let s=smax;s>=S0;s-=.25)if(height(...at(s))-f>.3){toe=Math.min(smax,s+.25);break;}T=Math.max(T,toe);}
      cand.push(ok&&H>=.6&&T>=.5?{c,n,T,H}:null);}
    // Joint toe = the larger of the two pieces meeting there (a piece without footing leaves an end return).
    const key=p=>p[0].toFixed(2)+','+p[1].toFixed(2),joint=new Map();
    for(const f of cand)if(f)for(const e of [f.c.p,f.c.q]){const k=key(e),o=joint.get(k);joint.set(k,{t:Math.max(o?.t??0,f.T),n:[(o?.n[0]??0)+f.n[0],(o?.n[1]??0)+f.n[1]],c:(o?.c??0)+1});}
    // a run end (a joint only one footing piece uses) returns into the bank — toe 0 there, so the end piece
    // tapers back to the wall line as a diagonal return face instead of stopping as a cut plane.
    for(const j of joint.values())if(j.c===1)j.t=0;
    const toeAt=(e,n)=>{const j=joint.get(key(e)),l=Math.hypot(...j.n)||1,m=[j.n[0]/l,j.n[1]/l],k=Math.max(.6,m[0]*n[0]+m[1]*n[1]);return [e[0]+m[0]*j.t/k,e[1]+m[1]*j.t/k];};
    for(const f of cand){if(!f)continue;const {c,n}=f,P2=toeAt(c.p,n),Q2=toeAt(c.q,n);if(d2(P2,c.p)<.05&&d2(Q2,c.q)<.05)continue;const ring=ccw([c.p,c.q,Q2,P2]);
      let yb=Infinity,toeLo=Infinity,toeHi=-Infinity;for(const [a,b] of [[c.p,c.q],[c.q,Q2],[Q2,P2],[P2,c.p]])for(const t of [0,.25,.5,.75,1]){const g=height(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);yb=Math.min(yb,g);}
      for(const t of [0,.25,.5,.75,1]){const g=height(P2[0]+(Q2[0]-P2[0])*t,P2[1]+(Q2[1]-P2[1])*t);toeLo=Math.min(toeLo,g);toeHi=Math.max(toeHi,g);}
      const bankTop=Math.max(height(c.p[0]+n[0]*S0,c.p[1]+n[1]*S0),height(c.q[0]+n[0]*S0,c.q[1]+n[1]*S0));
      prism(ring,yb-.35,c.top);c.footing=true;
      footings.push({p:c.p,q:c.q,P:P2,Q:Q2,n,lo:yb-.35,top:c.top,toeLo,toeHi,stone:Math.min(c.top-.8,bankTop+.3)});}
    // Course lines continuous along the run: the stone top and the footer top are per-joint values (stone: the larger of the
    // two pieces, under both tops; footer: 0.45 m over the toe ground there), sloping linearly across each piece.
    const js=new Map();for(const f of footings)for(const e of [f.p,f.q]){const k=key(e),o=js.get(k);js.set(k,{s:Math.max(o?.s??-Infinity,f.stone),t:Math.min(o?.t??Infinity,f.top-.8)});}
    for(const f of footings){f.stoneP=Math.min(js.get(key(f.p)).s,js.get(key(f.p)).t);f.stoneQ=Math.min(js.get(key(f.q)).s,js.get(key(f.q)).t);
      f.footP=height(...f.P)+.45;f.footQ=height(...f.Q)+.45;}}
  {const wb=bounds(walls.flatMap(c=>[c.p,c.q])),ways=publicWays.filter(r=>overlapB(bounds(r.points),wb,8)).map(r=>ribbon(r.points,-(r.width/2+.45),r.width/2+.45)).flat();
    const pieces=[];for(const c of walls){if(c.footing)continue;const L=d2(c.p,c.q),[ux,uz]=unit(c.p,c.q);let n=[-uz,ux];const m=[(c.p[0]+c.q[0])/2,(c.p[1]+c.q[1])/2];
      const inPriv=(x,z)=>[GARDEN,...(YARD?[YARD]:[])].some(r=>inRing(x,z,r));if(inPriv(m[0]+n[0]*1.2,m[1]+n[1]*1.2)){n=[-n[0],-n[1]];}if(inPriv(m[0]+n[0]*1.2,m[1]+n[1]*1.2))continue;
      const P=[c.p[0]-ux*.05,c.p[1]-uz*.05],Q=[c.q[0]+ux*.05,c.q[1]+uz*.05],D=2.2;pieces.push(ccw([P,Q,[Q[0]+n[0]*D,Q[1]+n[1]*D],[P[0]+n[0]*D,P[1]+n[1]*D]]));void L;}
    const near=b=>ways.filter(r=>overlapB(bounds(r),b,.5));
    for(const pc of pieces){const out=minus([pc],near(bounds(pc)));if(out.length)keep(out,'wall-verge','morro');}}
  // the wedge between Recinto Oeste, Rafael Cordero and the end of Calle del Sol at the garden-wall corner was
  // a raw hump (blue cells the streets package leaves round the private ring, a stray apron triangle): one pale concrete walk
  // polygon up to the nominal street paving edges (inferred finish), minus the footings and masses.
  const nominal=r=>r.width/2+(DRAWN_CAR.has(r.kind)&&STREETS.sidewalk[r.kind]?STREETS.kerb+STREETS.sidewalk[r.kind]:0);
  const footRings=footings.map(f=>ccw([f.p,f.q,f.Q,f.P]));
  {const W=[[-355.9,-40.4],[-337.5,-29.3],[-327.4,-24.4],[-317.2,-22],[-309.3,-21.2],[-305.1,-21.3],[-314,-24.4],[-323.8,-28.1],[-345,-44.5],[-346.1,-46.3],[-345.3,-49.7],gardenLine[3],[-357.5,-45.5]];
    // The two sidewalks on the wedge side (Calle del Sol's end, Rafael Cordero) were left undrawn at this corner (cells touching
    // the private garden ring / corner splits): the walk takes them up to the carriageways; Recinto Oeste keeps its paving.
    const ways=[431949745,22228551,22229751].map(id=>roadById.get(id)).filter(Boolean).flatMap(r=>{const w2=r.id===431949745?nominal(r):r.width/2-STREETS.gutter;return ribbon(r.points,-w2,w2);});
    keep(convexPieces(ccw(W)),'recinto-corner','morro',[...ways,...footRings]);}
  // (−205,−313): the Galería / Dominican convent north footing on Calle de Norzagaray — a pale paved shoulder from the
  // facade to the Norzagaray gutter (the streets package keeps the carriageway and gutter).
  {const nz=roadById.get(295380549),hw=nz?nz.width/2+.15:3.15;
    for(const id of [3435178,269744558])for(const f of facesOf(id)){if(f.n[1]>-.9||f.L<6||!nz)continue;const pc=[];
      for(let u=0;u<f.L-.01;u+=3){const u1=Math.min(f.L,u+3),dist=t=>{const x=f.a[0]+f.ux*t,z=f.a[1]+f.uz*t;let d=Infinity;for(let i=0;i+1<nz.points.length;i++)d=Math.min(d,segmentDistance(x,z,nz.points[i],nz.points[i+1]));return d;};
        const D0=dist(u)-hw,D1=dist(u1)-hw;if(Math.min(D0,D1)<.4||Math.max(D0,D1)>14)continue;
        const P=(t,d)=>[f.a[0]+f.ux*t+f.n[0]*d,f.a[1]+f.uz*t+f.n[1]*d];pc.push(ccw([P(u,0),P(u1,0),P(u1,D1),P(u,D0)]));}
      if(pc.length)keep(pc,'footing-'+id,'morro');}}
  // ---- Trees: the mapped city trees in the two plazas, the Beneficencia park, Plaza de Ballajá, Plaza del Soportal and the
  // Casa Blanca grounds, drawn with the shared broadleaf kit (survey: broadleaf shade, the esplanade stays open lawn).
  // Trunk solids only where clear of every running way by 1 m. ----
  const claimed=new Set(earlier.flatMap(a=>(a.trees??[]).map(t=>t.x+','+t.z)));
  const zones=[PLAZA_SJ,PARK_BENEFICENCIA,SOPORTAL,CASA_GROUNDS,[[-412,-275],[-372,-283],[-366,-205],[-400,-198]]];
  const trees=[];
  for(const [x,z] of city.trees){if(claimed.has(x+','+z)||!zones.some(r=>inRing(x,z,r))||inMass(x,z,.6))continue;
    const free=!onRoad(x,z,1.0)&&!inSolid(x,z,.8)&&!nearWall(x,z,1.2)&&!courtRings.some(r=>inRing(x,z,r));if(!free)continue;
    const s=.9+hash(Math.round(x*10),Math.round(z*10))*.25,t={x,z,y:groundAt(x,z),scale:s,mapped:true};trees.push(t);}
  // Plaza San José keeps its mapped shade trees; two more fill the open north-east quarter of the paved ring (inferred,
  // Ligocsicnarf89 2025 shows a canopy on that side) where they clear the statue and the streets.
  for(const [x,z] of [[-152.5,-198.5],[-176,-191.5]])if(!onRoad(x,z,2)&&!inMass(x,z,1.5)&&!inSolid(x,z,1)&&Math.hypot(x-PONCE[0],z-PONCE[1])>6)trees.push({x,z,y:groundAt(x,z),scale:.95});
  // Parque de la Beneficencia (survey: broadleaf shade; only three mapped trees): up to five inferred shade trees on a 9 m
  // lattice inside the mapped park, clear of its footway and the streets.
  {let added=0;for(let x=-370;x<=-321&&added<5;x+=9)for(let z=-196;z<=-150&&added<5;z+=9){const jx=x+(hash(x,z,13)-.5)*2,jz=z+(hash(x,z,17)-.5)*2;
    if(!inRing(jx,jz,PARK_BENEFICENCIA)||onRoad(jx,jz,1.6)||inMass(jx,jz,1.5)||inSolid(jx,jz,1)||trees.some(t=>Math.hypot(t.x-jx,t.z-jz)<7))continue;
    trees.push({x:jx,z:jz,y:height(jx,jz),scale:.95+hash(x,z,19)*.2});added++;}}
  // the footings cover the bank where the streets pocket park beside the Recinto Oeste wall stood (its two
  // inferred shade trees and bench, which streets now drops for lack of clearance): the same two trees and the bench stand on
  // the open verge in front of the footing face (tree 2.4 m, bench 1.2 m beyond the toe), clear of the lane.
  const benches=[];
  {const nearestFoot=(x,z)=>footings.reduce((m,f)=>{const d=segmentDistance(x,z,f.P,f.Q);return !m||d<m.d?{f,d}:m;},null);
    const off=(x,z,k)=>{const m=nearestFoot(x,z);if(!m||m.d>9)return null;const {f}=m,dx=f.Q[0]-f.P[0],dz=f.Q[1]-f.P[1],L2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-f.P[0])*dx+(z-f.P[1])*dz)/L2));
      // bench heading: width along the toe line, seat facing out (+n) — kit frame: width axis (cos h, −sin h), front (sin h, cos h)
      const L=Math.sqrt(L2);let h=Math.atan2(-dz/L,dx/L);if(Math.sin(h)*f.n[0]+Math.cos(h)*f.n[1]<0)h+=Math.PI;
      return [f.P[0]+dx*t+f.n[0]*k,f.P[1]+dz*t+f.n[1]*k,h];};
    for(const [x0,z0] of [[-388.6,-71.5],[-378.6,-64]]){const p=off(x0,z0,2.4);if(!p)continue;const [x,z]=p;
      if(onRoad(x,z,1.0)||inSolid(x,z,.8)||trees.some(t=>Math.hypot(t.x-x,t.z-z)<5))continue;trees.push({x,z,y:height(x,z),scale:.95,verge:true});}
    // the bench sits in line with the two trees (2.4 m beyond the toe), leaving the toe-following lane
    // (0–2 m) and the lane to the road clear, on a flush worn pad.
    const p=off(-385.5,-68.2,2.4);if(p){const [x,z,heading]=p,legs=[-.72,.72].map(u=>({u,ground:height(x+Math.cos(heading)*u,z-Math.sin(heading)*u)}));
      const y=Math.max(...legs.map(l=>l.ground));
      if(!onRoad(x,z,1.2)&&y-Math.min(...legs.map(l=>l.ground))<=.2&&trees.every(t=>Math.hypot(t.x-x,t.z-z)>2.5)){benches.push({x,z,y,heading,width:1.8,legs});
        {const c2=Math.cos(heading),s2=Math.sin(heading);keep([ccw([[-1.3,-.75],[1.3,-.75],[1.3,.75],[-1.3,.75]].map(([u,v])=>[x+u*c2+v*s2,z-u*s2+v*c2]))],'bench-pad','morro');}
        const c=Math.cos(heading),s=Math.sin(heading),r=[[-.95,-.32],[.95,-.32],[.95,.32],[-.95,.32]].map(([u,v])=>[x+u*c+v*s,z-u*s+v*c]);prism(r,y-.1,y+.9);}}}
  // Casa Blanca grounds (Ligocsicnarf89 2025 garden side: dense low planting, a few shade trees): inferred shrub clumps and
  // two trees on a 7 m lattice, 2.5 m clear of every way and mass, inside the mapped grounds.
  const shrubs=[];
  // seating rule: props stand on the lowest drawn point under their footprint (centre + 8 rim points)
  const lowUnder=(x,z,r)=>{let m=groundAt(x,z);for(let k=0;k<8;k++){const a=k*Math.PI/4;m=Math.min(m,groundAt(x+Math.cos(a)*r,z+Math.sin(a)*r));}return m;};
  for(let x=-440;x<=-336;x+=7)for(let z=-160;z<=-55;z+=7){const jx=x+(hash(x,z,3)-.5)*3,jz=z+(hash(x,z,5)-.5)*3;
    if(!inRing(jx,jz,GARDEN)||onRoad(jx,jz,2.5)||inMass(jx,jz,2.5)||inSolid(jx,jz,2.0)||nearWall(jx,jz,2.0)||!dry(jx,jz))continue;
    if(hash(x,z,9)<.16&&trees.every(t=>Math.hypot(t.x-jx,t.z-jz)>6))trees.push({x:jx,z:jz,y:height(jx,jz),scale:.85+hash(x,z,2)*.2});
    else{const r=.8+hash(x,z,7)*.5;shrubs.push({x:jx,z:jz,y:lowUnder(jx,jz,r*.85),r});}}
  // Terrace edges (Ligocsicnarf89 2025 garden side; survey: "visible terrace layers"): low whitewashed walls along DEM contours
  // every 2.5 m inside the mapped grounds where the slope exceeds 18 %, 2.5 m clear of every way, mass and earlier solid.
  // A contour wall is level by construction (both ends on the iso line); 0.55 m over it, solid.
  const terraces=[];
  {const {x0,z0,step,nx,heights:H}=terrace0(terrain),cb=bounds(CASA_GROUNDS);
    const i0=Math.floor((cb[0]-x0)/step),i1=Math.ceil((cb[1]-x0)/step),j0=Math.floor((cb[2]-z0)/step),j1=Math.ceil((cb[3]-z0)/step);
    let hmin=Infinity,hmax=-Infinity;for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const h=H[j*nx+i];hmin=Math.min(hmin,h);hmax=Math.max(hmax,h);}
    for(let L=Math.ceil(hmin/2.5)*2.5+.01;L<hmax;L+=2.5)for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++){
      const c=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>({x:x0+a*step,z:z0+b*step,h:H[b*nx+a]})),pts=[];
      for(let e=0;e<4;e++){const a=c[e],b=c[(e+1)%4];if((a.h-L)*(b.h-L)<0){const t=(L-a.h)/(b.h-a.h);pts.push([a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t]);}}
      if(pts.length!==2)continue;const [p,q]=pts,m=[(p[0]+q[0])/2,(p[1]+q[1])/2];
      const slope=Math.hypot(c[1].h-c[0].h,c[3].h-c[0].h)/step;if(slope<.18||d2(p,q)<.6)continue;
      if(![p,q,m].every(r=>inRing(r[0],r[1],GARDEN)&&!onRoad(r[0],r[1],2.5)&&!inMass(r[0],r[1],2.0)&&!inSolid(r[0],r[1],1.5)&&!nearWall(r[0],r[1],2.0)&&dry(r[0],r[1])))continue;
      if(trees.some(t=>Math.hypot(t.x-m[0],t.z-m[1])<1.2))continue;
      // Not on cliffs: the ground 0.25 m either side stays within 0.45 m of the contour (wall foot and top cover it).
      {const [ux,uz]=unit(p,q);let ok=true;for(const f of [0,.5,1])for(const o of [-.25,.25]){const x=p[0]+(q[0]-p[0])*f-uz*o,z=p[1]+(q[1]-p[1])*f+ux*o;if(Math.abs(height(x,z)-L)>.45)ok=false;}if(!ok)continue;}
      terraces.push({p,q,y:L});}}
  // keep only continuous bands — segments chained by shared contour endpoints, chains ≥ 10 m (no chopped bits);
  // collision = drawn body (0.46 m wide, to 0.65 m over the contour), non-support.
  {const key=p=>p[0].toFixed(3)+','+p[1].toFixed(3),adj=new Map();terraces.forEach((t,i)=>{for(const p of [t.p,t.q]){const k=key(p);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);}});
    const seen=new Set(),keepIdx=new Set();
    for(let i=0;i<terraces.length;i++){if(seen.has(i))continue;const chain=[],stack=[i];seen.add(i);
      while(stack.length){const c=stack.pop();chain.push(c);for(const p of [terraces[c].p,terraces[c].q])for(const j of adj.get(key(p)))if(!seen.has(j)&&terraces[j].y===terraces[c].y){seen.add(j);stack.push(j);}}
      if(chain.reduce((s2,c)=>s2+d2(terraces[c].p,terraces[c].q),0)>=10)chain.forEach(c=>keepIdx.add(c));}
    terraces.splice(0,terraces.length,...terraces.filter((t,i)=>keepIdx.has(i)));}
  for(const t of terraces){const [ux,uz]=unit(t.p,t.q),h=.23,A=[t.p[0]-ux*.05,t.p[1]-uz*.05],B=[t.q[0]+ux*.05,t.q[1]+uz*.05];
    prism([[A[0]-uz*h,A[1]+ux*h],[B[0]-uz*h,B[1]+ux*h],[B[0]+uz*h,B[1]-ux*h],[A[0]+uz*h,A[1]-ux*h]],t.y-.6,t.y+.65);}
  shrubs.splice(0,shrubs.length,...shrubs.filter(s=>terraces.every(t=>segmentDistance(s.x,s.z,t.p,t.q)>s.r+.5)));
  for(const t of trees)prism(circle(t.x,t.z,.34*t.scale,10),t.y-.15,t.y+3.5);
  for(const s of shrubs){const c=prism(circle(s.x,s.z,s.r*.85,8),s.y-.15,s.y+1.05);if(c)c.soft=true;}   // foliage: soft (js/sj-soft-foliage.js)
  // Lanterns at the plaza perimeter (survey: two or three dark lanterns) and in the Beneficencia park.
  const lamps=[];
  for(const [x,z] of [[-183.6,-205.5],[-147.2,-208.6],[-160.2,-185.2],[-334.5,-188.8],[-352.6,-172.4]]){
    if(onRoad(x,z,.6)||inMass(x,z,.6)||inSolid(x,z,.6)||trees.some(t=>Math.hypot(t.x-x,t.z-z)<2.2))continue;lamps.push({x,z,y:lowUnder(x,z,.25),base:false});}
  for(const l of lamps)prism(circle(l.x,l.z,.22,8),l.y-.1,l.y+3.6);

  // ---- Plaza de Ballajá basin (308898109): a solid low cap over the exact ring, no separate ride floor (.5). ----
  const basin=(()=>{const r=ccw(BASIN),g=r.map(p=>height(...p)),lo=Math.min(...g),hi=Math.max(...g);prism(r,lo-.2,hi+.5);return {ring:r,lo,hi,top:hi+.5};})();

  // ---- Gates (mapped barrier=gate on the private ways; .3): piers just outside the running width, two closed iron
  // leaves across it, solids for both. Skipped (recorded in qa) if a pier would stand on another way. ----
  const gates=[];
  for(const G of GATES){const r=roadById.get(G.road);if(!r)continue;let best={d:Infinity};
    for(let i=0;i+1<r.points.length;i++){const d=segmentDistance(G.at[0],G.at[1],r.points[i],r.points[i+1]);if(d<best.d)best={d,i};}
    const a=r.points[best.i],b=r.points[best.i+1],[ux,uz]=unit(a,b),half=r.width/2+.35,px=-uz,pz=ux;
    const piers=[-1,1].map(sd=>[G.at[0]+px*(half+.3)*sd,G.at[1]+pz*(half+.3)*sd]);
    const clash=piers.some(p=>roads.some(q=>q.id!==G.road&&roadDist(p[0],p[1],q)<q.width/2+.4)||inMass(p[0],p[1],-.1));
    if(clash){gates.push({...G,skipped:true});continue;}
    const y=height(...G.at),gate={...G,x:G.at[0],z:G.at[1],ux:px,uz:pz,half,y,piers:piers.map(p=>({x:p[0],z:p[1],y:height(...p)}))};gates.push(gate);
    for(const p of piers){const g=height(...p);prism(ccw(circle(p[0],p[1],.42,4).map(q=>q)),g-.3,g+2.6);}
    if(G.open)continue;
    // Returns from each pier to the building face across the lane (flank shots passed the piers).
    gate.returns=piers.map((p,k)=>{const sd=k?1:-1,end=faceHit([p[0],p[1]],[px*sd,pz*sd],8);return end&&[[p[0],p[1]],[end[0]+px*sd*.3,end[1]+pz*sd*.3]];}).filter(Boolean);
    for(const r of gate.returns)wallRun(r,'return');
    const A=[G.at[0]-px*half,G.at[1]-pz*half],B=[G.at[0]+px*half,G.at[1]+pz*half],h=.12,ga=height(...A),gb=height(...B);
    prism([[A[0]-ux*h,A[1]-uz*h],[B[0]-ux*h,B[1]-uz*h],[B[0]+ux*h,B[1]+uz*h],[A[0]+ux*h,A[1]+uz*h]],Math.min(ga,gb)-.3,Math.max(ga,gb)+2.2);}

  // ---- Ground tones (earlier owners keep their vertices): Beneficencia park and Ballajá beds lawn, Casa Blanca garden
  // (dense dark planting), the esplanade lawn where the raster left blue/pale traces off any mapped way. ----
  // the Recinto Oeste junction and wall-side strip are claimed here (`ownedGround`): J1 runs from the
  // garden wall line to the Recinto Oeste / Rafael Cordero centrelines; J2 is the traffic island and the verges west of the
  // junction up to the next mass (not the parapet side of the street, which another owner finished).
  const JUNCTION=[{ring:[gardenLine[1],gardenLine[2],gardenLine[3],[-346.1,-46.3],[-323.8,-28.1],[-327.4,-24.4],[-337.5,-29.3],[-355.9,-40.4],[-421,-89.1],[-433.3,-102.9],[-454.1,-127.5]],kind:'verge'},
    {ring:[[-433.3,-102.9],[-421,-89.1],[-447,-89.7],[-476.7,-92.7],[-480.5,-103.5],[-472.2,-150.6],[-462.6,-139.2]],kind:'verge'},
    // Plaza de Ballajá lawn round the basin and the nine beds (the tree zone): one planted field up to the street paving,
    // instead of streets' cell-stepped aprons on lawn (sweep: calle-del-morro -397,-218 / ref-asilo-front / ref-ballaja-basin).
    {ring:[[-412,-275],[-372,-283],[-366,-205],[-364,-193],[-406,-188],[-400,-198]],kind:'lawn'}].map(o=>({...o,ring:ccw(o.ring)}));
  // J3: the parapet side of Recinto Oeste (south of 270766168 at the junction, south-west of 431949745 to the
  // town end), 14 m deep. Its pedestrian walk was streets' cell-stepped apron (diamonds, a walk that kept losing its edge):
  // one fitted 3 m walk from the lane edge, minus earlier owners, lawn behind it.
  const PARAPET=[[-476.7,-92.7],[-447,-89.7],[-421,-89.1],[-355.9,-40.4],[-337.5,-29.3],[-327.4,-24.4],[-317.2,-22],[-309.3,-21.2]];
  for(const pc of ribbon(PARAPET,0,14))JUNCTION.push({ring:ccw(pc),kind:'verge'});
  const nominalWays=city.roads.filter(r=>(DRAWN_CAR.has(r.kind)||DRAWN_LANE.has(r.kind)&&r.surface!=='dirt'&&r.surface!=='grass')&&r.id!==LAWN_PATH&&r.points.some(p=>p[0]>-860&&p[0]<20&&p[1]>-640&&p[1]<-10))
    .map(r=>({r,b:bounds(r.points)}));
  const waysNear=b=>nominalWays.filter(o=>overlapB(o.b,b,8)).flatMap(o=>ribbon(o.r.points,-nominal(o.r),nominal(o.r)));
  // (one keep per piece: ribbon pieces overlap at bends; each later piece gives up what an earlier one took)
  {const pcs=ribbon(PARAPET,2.0,5.3),ways=waysNear(bounds(pcs.flat()));for(const pc of pcs)keep([pc],'parapet-walk','morro',ways);}
  // Plaza de Ballajá: one fitted 3.2 m walk inside the plaza (it covers the whole band where no tint is allowed) along the streets that bound it ("clip the perimeter to a
  // single walk edge"), instead of apron teeth; no blanket paving into the lawn.
  {const zone=JUNCTION.find(o=>o.kind==='lawn').ring,zb=bounds(zone),zp=convexPieces(zone),pcs=[];
    for(const o of nominalWays){if(!overlapB(o.b,zb,6)||o.r.kind==='steps')continue;const w=nominal(o.r);
      for(const q of [...ribbon(o.r.points,w,w+3.2),...ribbon(o.r.points,-w-3.2,-w)])for(const z of zp){const c=intersectRings(q,z);if(c.length>=3&&Math.abs(signedArea(c))>.05)pcs.push(c);}}
    {const ways=waysNear(zb);for(const pc of pcs)keep([pc],'ballaja-walk','morro',ways);}}
  // Claim rings (`paved`, ownership only — nothing draws them): the planted zones minus the street paving, so streets lays no
  // cell-stepped apron into the narrow edge band this area finishes ("2 m paving teeth").
  const claimRings=[],edgeCells=[];
  {const parkBand=PARK_BENEFICENCIA.map((a,q)=>{const b=PARK_BENEFICENCIA[(q+1)%PARK_BENEFICENCIA.length],[ux,uz]=unit(a,b),out=inRing((a[0]+b[0])/2-uz*.5,(a[1]+b[1])/2+ux*.5,PARK_BENEFICENCIA)?[uz,-ux]:[-uz,ux];
      return ccw([a,b,[b[0]+out[0]*3,b[1]+out[1]*3],[a[0]+out[0]*3,a[1]+out[1]*3]]);});
    for(const r of [...JUNCTION.map(o=>o.ring),PARK_BENEFICENCIA,...parkBand]){const pcs=minus(convexPieces(ccw(r)),[...waysNear(bounds(r)),...squares.filter(o=>overlapB(o.b,bounds(r),1)).flatMap(o=>convexPieces(ccw(o.ring)))]);
      for(const c of pcs)if(Math.abs(signedArea(c))>.05)claimRings.push({ring:c,kind:'claim'});}}
  {const {x0,z0,step,nx,nz}=terrain,box=[-830,-130,-610,-20];
    // Startup: earlier owners' tinted vertices as one mask, earlier rings in a 16 m bucket index (was a scan per vertex).
    const takenM=new Uint8Array(nx*nz);for(const m of [gate?.tint,fort?.tint,...earlier.map(a=>a.tint)])if(m)for(const k of m.keys())if(k>=0&&k<takenM.length)takenM[k]=1;
    const taken=k=>takenM[k]===1,earlierGrid=grid(earlierB,o=>o.b);
    const zonesR=[PARK_BENEFICENCIA,CASA_GROUNDS,LAWN_NE,LAWN_SW,...JUNCTION.map(o=>o.ring)];
    const rb=new Map(zonesR.map(r=>[r,bounds(r)])),inR=(x,z,r)=>{const b=rb.get(r);return x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3]&&inRing(x,z,r);};
    const bedBox=bounds(BEDS.flat()),earlierIn=(x,z)=>near(earlierGrid,x,z,0,o=>x>=o.b[0]&&x<=o.b[1]&&z>=o.b[2]&&z<=o.b[3]&&inRing(x,z,o.r));
    const LAWN=['#7e9866','#78935f'],PATH=['#c9c3b3','#c2bcac'],PARK=['#6f8f4f','#78965a'],GARDEN=['#4f7340','#58794a'],BED='#5e8a45',DRIVE=['#8f8a7f','#87837a'];
    const lawnPath=roadById.get(LAWN_PATH),spurR=roadById.get(SPUR),spurDrive=(x,z)=>!!spurR&&roadDist(x,z,spurR)<spurR.width/2+.6;
    // A planted tone within TINT_CLEAR of street paving is not tinted (that would cut the street); a town-class vertex there
    // draws as lawn instead (surface class 2, so its colour blends green into the planting) and keeps its pavement ride feel
    // through `groundClass`. Footways streets draws are no longer tinted pale: the crisp street drape is the path edge.
    // Startup: one raster pass marks the grid vertices within TINT_CLEAR (+ a margin) of street paving; only those pay for
    // the exact edgeD query (the lawns hold tens of thousands of vertices).
    const I0=Math.max(0,Math.floor((box[0]-x0)/step)),J0=Math.max(0,Math.floor((box[2]-z0)/step)),NI=Math.min(nx-1,Math.ceil((box[1]-x0)/step))-I0+1,NJ=Math.min(nz-1,Math.ceil((box[3]-z0)/step))-J0+1;
    const nearSt=new Uint8Array(NI*NJ),mark=(b0,b1,c0,c1,test)=>{for(let j=Math.max(0,Math.floor((c0-z0)/step)-J0);j<=Math.min(NJ-1,Math.ceil((c1-z0)/step)-J0);j++)
      for(let i=Math.max(0,Math.floor((b0-x0)/step)-I0);i<=Math.min(NI-1,Math.ceil((b1-x0)/step)-I0);i++)if(!nearSt[j*NI+i]&&test(x0+(i+I0)*step,z0+(j+J0)*step))nearSt[j*NI+i]=1;};
    const R=TINT_CLEAR+.5;
    for(const sg of edgeList){const m=sg.w+R;if(Math.max(sg.a[0],sg.b[0])+m<box[0]||Math.min(sg.a[0],sg.b[0])-m>box[1]||Math.max(sg.a[1],sg.b[1])+m<box[2]||Math.min(sg.a[1],sg.b[1])-m>box[3])continue;
      mark(Math.min(sg.a[0],sg.b[0])-m,Math.max(sg.a[0],sg.b[0])+m,Math.min(sg.a[1],sg.b[1])-m,Math.max(sg.a[1],sg.b[1])+m,(x,z)=>segmentDistance(x,z,sg.a,sg.b)<m);}
    for(const o of squares)mark(o.b[0]-R,o.b[1]+R,o.b[2]-R,o.b[3]+R,()=>true);
    const nearStreet=(x,z)=>nearSt[(Math.round((z-z0)/step)-J0)*NI+Math.round((x-x0)/step)-I0]===1;
    // a vertex is tinted when none of its four cells holds street paving (5×5 lattice at 1 m, 0.3 m margin:
    // cell-exact, ~2–2.8 m from the paving instead of a blanket 2.9 m); the vertices in between keep the town class 1, which
    // the ground package finishes as one consistent narrow worn concrete / dry-verge edge (no class-2 vertices there that
    // streets would flip to pale sidewalk class: the blotchy washouts). Ride feel: class 1 = pavement.
    const cellsFree=(x,z)=>{for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)if(edgeD(x+a,z+b)<=.3)return false;return true;};
    const planted=(k,tone,x,z)=>{if(!nearStreet(x,z)||cellsFree(x,z)){tint.set(k,tone);return;}
      if(surface[k]!==3&&!earlierIn(x,z)&&surface[k]!==1){surface[k]=1;edgeCells.push(k);}};
    for(let j=Math.max(0,Math.floor((box[2]-z0)/step));j<=Math.min(nz-1,Math.ceil((box[3]-z0)/step));j++)
      for(let i=Math.max(0,Math.floor((box[0]-x0)/step));i<=Math.min(nx-1,Math.ceil((box[1]-x0)/step));i++){
        const x=x0+i*step,z=z0+j*step,k=j*nx+i;
        if(!(x>=bedBox[0]&&x<=bedBox[1]&&z>=bedBox[2]&&z<=bedBox[3])&&!zonesR.some(r=>{const b=rb.get(r);return x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3];}))continue;
        if(taken(k)||inMass(x,z,.2))continue;
        if(x>=bedBox[0]&&x<=bedBox[1]&&z>=bedBox[2]&&z<=bedBox[3]&&BEDS.some(r=>inRing(x,z,r))){if(!nearStreet(x,z)||cellsFree(x,z))tint.set(k,BED);}
        else if(inR(x,z,PARK_BENEFICENCIA)){if(onRoad(x,z,.5,['path']))tint.set(k,PATH[hash(i,j,7)<.5?0:1]);else planted(k,PARK[hash(i,j,4)<.5?0:1],x,z);}
        // Private Casa Blanca grounds and spur yard: streets draws nothing on a cell with a private probe, so every vertex here
        // is tinted (no clearance needed); the private spur drive 256386341 reads as a worn cobble-grey drive, not raw ground.
        else if(inPrivate(x,z)){if(spurDrive(x,z))tint.set(k,DRIVE[hash(i,j,8)<.5?0:1]);else tint.set(k,GARDEN[hash(i,j,5)<.5?0:1]);}
        else if(inR(x,z,CASA_GROUNDS))planted(k,GARDEN[hash(i,j,5)<.5?0:1],x,z);
        // Beside the lawn footway this area draws itself (LAWN_PATH): tinted lawn right up to its edge, whatever the class, so
        // the streets class flip under an owner's drape cannot leave a pale halo along it.
        else if(surface[k]!==3&&lawnPath&&roadDist(x,z,lawnPath)<lawnPath.width/2+TINT_CLEAR&&(inR(x,z,LAWN_NE)||inR(x,z,LAWN_SW)))tint.set(k,LAWN[hash(i,j,6)<.5?0:1]);
        else if(surface[k]!==2&&surface[k]!==3&&(inR(x,z,LAWN_NE)||inR(x,z,LAWN_SW))){
          if(onRoad(x,z,.5,['path']))tint.set(k,PATH[hash(i,j,7)<.5?0:1]);else planted(k,LAWN[hash(i,j,6)<.5?0:1],x,z);}
        else if(surface[k]!==3&&JUNCTION.some(o=>inR(x,z,o.ring))&&!inPrivate(x,z))planted(k,LAWN[hash(i,j,6)<.5?0:1],x,z);
        // A 3 m band just outside the park (between its ring and the street paving round it): no tint, only the lawn class,
        // so no blue-grey vertex bleeds into the planting edge (at (−365,−169)).
        else if(surface[k]===0&&PARK_BENEFICENCIA.some((a,q)=>segmentDistance(x,z,a,PARK_BENEFICENCIA[(q+1)%PARK_BENEFICENCIA.length])<3)&&!earlierIn(x,z)){surface[k]=1;edgeCells.push(k);}}}

  // ---- Private interiors: the mapped courtyards and the Escuela courts (placement, recovery, map arrivals). ----
  const courtyardRings=COURTYARDS.flatMap(id=>byId.get(id)?.holes??[]);
  const casaRings=[GARDEN,...(YARD?[YARD]:[])];
  const privateRings=[...courtyardRings,...courtRings,...casaRings].map(r=>({r,b:bounds(r)}));
  const offLimitsAt=ringsAt(privateRings); // sj-private.js: keeps only the rings alive, not this layout's scope

  // Map arrivals on public roads.
  const places=[{name:'Cuartel de Ballajá',x:-336.0,z:-305.03,source:929959},{name:'Plaza de San José',x:-164.0,z:-181.88,source:196605698},
    {name:'Casa Blanca',x:-329.0,z:-146.71,source:269739384},{name:'Museo de San Juan',x:-77.0,z:-307.72,source:6800675}];

  const layout={colliders,tops,cuts,tint,surfaces,floorTriangles,places,buildingOverrides,offLimitsAt,ownedBuildings:[...OWNED],
    ownedGround:JUNCTION,paved:claimRings,edgeCells:Uint32Array.from(edgeCells),footings,
    plazaSJ:plazaSJ&&{tris:plazaSJ.tris,pieces:plazaSJ.pieces,edges:plazaSJ.edges},groundAt,facades,special,statue,trees,shrubs,terraces,lamps,benches,basin,beds:BEDS,gates,fence,seals,walls,casaRings,courtRings,courtyardRings,brick,grid:terrain,
    privateRings:[...courtyardRings,...courtRings,...casaRings],constants:{FENCE,STYLE,WALL}};
  layout.qa=()=>({facades:facades.length,openings:facades.reduce((s,F)=>s+F.openings.length,0),
    doors:facades.reduce((s,F)=>s+F.openings.filter(o=>o.kind==='door').length,0),portals:special.portals.length,pediments:special.pediments.length,
    porticos:special.porticos.length,arcades:special.arcadeFaces.length,courts:courtRings.length,fence:fence.length,seals:seals.length,
    gates:gates.map(g=>g.skipped?'skip:'+g.node:g.node),trees:trees.length,shrubs:shrubs.length,terraces:terraces.length,walls:walls.length,yard:!!YARD,lamps:lamps.length,
    surfaces:surfaces.length,colliders:colliders.length,tint:tint.size,footings:footings.length,edgeClass:edgeCells.length,claims:claimRings.length,gable:!!special.gable,balconies:special.balconies.length,buttresses:special.buttresses.length});
  return layout;
}
