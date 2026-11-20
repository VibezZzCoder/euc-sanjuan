/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// La Puntilla — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// Area module (contract: header of sj-princesa-layout.js), registered after perlaDistrict.
// Reference imagery (Wikimedia Commons curid=122996449, curid=37349529, curid=184241561, curid=122889567, curid=184240865, curid=184238581, curid=149388376, curid=106059407, curid=123441024, curid=182263185).
// Mapped: Paseo Peatonal de la Princesa 256661394, Calle Paseo de la Princesa 256661395 (+ service seam 256661398), Plaza
// del Inmigrante 59744983/1413872646 and its island 648549003, Calle La Puntilla 22226185/382021487, Comercio west 60330138,
// Schomburg 22228928, Plaza de Hostos 256661396, parking 59744982, La Princesa 256339011, Arsenal 3623972, Aduana 929962,
// Coast Guard Base San Juan (landuse=military) 291706131. Inferred: running widths, the
// forecourt, hedge/palm/tree/lamp/bench/planter placement, facade bay rhythms and ornament, the Arsenal cupola position,
// the Aduana pavilion size, the Coast Guard fence (no photo of the current perimeter) and gates.
// The southern point is a closed federal site: the base polygon is sealed where it meets public land and is private for
// placement, recovery and arrivals (the closed-cemetery recipe, "close it like the cemetery").
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {unit,bounds,ribbon,minus,overlapB} from './sj-city-wall.js';
import {PLAZA as RAICES_PLAZA} from './sj-princesa-layout.js';
import {drapeConvex} from './sj-seams-geo.js';
import {ringAt} from './sj-private.js';
import {seatedBottom} from './sj-street-kit.js';
import {GROUND_AREAS} from './sj-streets-data.js';

// OSM 291706131 {"landuse":"military","military_service":"coast_guard","name":"U.S. Coast Guard - Base San Juan"}
export const BASE=[[116.094,516.138],[2.926,524.54],[2.007,501.484],[4.975,491.91],[8.619,481.926],[-2.704,476.369],
[-9.887,477.554],[-11.492,464.26],[-13.679,462.08],[-63.397,525.58],[-88.547,508.911],[-90.543,494.223],[-92.803,494.267],
[-98.465,494.743],[-100.324,494.422],[-101.327,487.869],[-109.904,488.467],[-114.478,439.433],[-117.984,401.8],
[-129.729,275.961],[-132.063,250.935],[-186.249,256.624],[-205.958,271.511],[-208.715,273.592],[-206.106,279.558],
[-203.698,297.611],[-197.974,350.319],[-196.432,372.39],[-195.302,379.164],[-203.636,379.95],[-203.604,381.455],
[-196.506,391.827],[-192.091,398.291],[-190.021,414.495],[-187.708,432.714],[-185.511,446.439],[-182.174,482.312],
[-175.435,511.876],[-159.19,553.749],[-159.729,559.715],[-162.876,566.6],[-133.185,592.777],[-125.696,591.404],
[-114.14,598.931],[-109.398,594.083],[-94.357,604.787],[-69.756,637.45],[-64.274,644.722],[-53.152,669.748],
[-37.213,689.97],[-16.446,699.335],[-4.215,700.707],[6.243,693.446],[16.584,714.011],[19.784,720.365],[26.523,724.549],
[31.857,727.858],[52.507,711.432],[125.337,653.532],[125.432,645.054],[125.538,636.896],[125.928,605.594],[126.023,597.503],
[126.425,565.847],[126.53,557.501],[126.72,541.795],[126.815,534.269],[126.836,532.332],[126.9,527.163],[126.762,525.248],
[127.037,516.028]];
// OSM 59744982 {"amenity":"parking","name":"Estacionamiento La Puntilla","surface":"asphalt"}
export const PARKING=[[115.28,237.03],[103.05,224.69],[-111.02,250.51],[-98.36,426.77],[-84.3,425.49],[7.79,297.67],
[67.95,340.15],[86.03,316.57],[101.1,254.46]];
// OSM 648549003 {"leisure":"park","name":"Plaza del Inmigrante"}: the planted island inside the junction ring (Wikimedia Commons curid=184238581).
export const ISLAND=[[139.49,227.72],[141.04,230.24],[143.34,232.07],[145.94,233.0],[148.71,233.07],[151.35,232.26],
[153.61,230.67],[155.24,228.46],[156.08,225.83],[156.05,223.09],[155.15,220.49],[153.46,218.31],[151.18,216.77],
[148.52,216.01],[145.56,216.18],[142.84,217.33],[140.66,219.32],[139.3,221.94],[138.89,224.85]];
export const PRINCESA_ID=256339011,ARSENAL_ID=3623972,ADUANA_ID=929962,HOSTOS_ID=256661396,PROMENADE_ID=256661394;
// Running surfaces [way, half width, kind]. Order = ownership priority. OSM gives no widths; Wikimedia Commons curid=184241561 shows the promenade's
// large warm-grey/rose panels, 91 the smaller grey units of Calle Paseo de la Princesa, 92 the blue-grey setts of the
// Inmigrante junction. Calle La Puntilla and Schomburg have no surface tag and no photo: plain asphalt.
export const WAYS=[[PROMENADE_ID,3.5,'panel'],[59744983,3.0,'sett'],[1413872646,3.0,'sett'],[382021487,3.0,'sett'],
  [60330138,3.0,'sett'],[256661395,3.0,'sett'],[256661398,2.0,'sett'],[22226185,3.0,'asphalt'],[22228928,3.0,'asphalt'],
  // Calle Tizol 60330123 (OSM surface=sett), the raw strip between Plaza de Hostos and the
  // Inmigrante ring (audit plaza-de-hostos-162_212-s); x < 159, west of the waterfront pass's node. Lowest priority.
  [60330123,3.0,'sett']];
// Public roads that meet the base fence get a gate there; private ways inside are closed by the same fence.
const GATE_WAYS=[22226185,22228928,22221576,22228673];
export const FENCE={height:2.2,piece:3,seal:3.5,half:.2,post:.05};
// Aduana quay apron (seams ): search box, chord breaks (z), apron width inside the face chord per break, darker joint band along the
// parking edge, reach past the face (drawing is clipped to real triangles anyway).
// South of z 340 `coast` builds low waterline strips and tints the land up to ~5 m from them (blocking `streets`' cells
// up to ~7 m in): the apron widens to 7.5 m there so no tinted ground is left between it and the parking.
export const QUAY={x0:100,x1:172,z0:278,z1:392,breaks:[278,336,344,392],width:[3.2,4.5,7.5,7.5],band:.3,past:2.5};
// the base's mapped basketball and sand-volleyball courts, each with a 1.5 m
// apron (radial from the centroid), published as `sportsRings`; the lawn planting keeps its
// full crown reach (3 m) off them. Presentation only: the base stays closed.
export const BASE_SPORTS=[829206459,829206460].map(id=>{const g=GROUND_AREAS.find(a=>a.id===id);if(!g)return null;
  const r=g.ring,c=r.reduce((a,p)=>[a[0]+p[0]/r.length,a[1]+p[1]/r.length],[0,0]);
  return {ring:r.map(p=>{const d=Math.hypot(p[0]-c[0],p[1]-c[1])||1;return [p[0]+(p[0]-c[0])/d*1.5,p[1]+(p[1]-c[1])/d*1.5];}),kind:g.surface==='sand'?'volleyball':'basketball',source:id};}).filter(Boolean);
export const COLOURS={arsenal:'#f0cb46',arsenalRoof:'#cbc5b8',aduana:'#e7a598',aduanaRoof:'#b4583f'};
// Parking asphalt tone (Wikimedia Commons curid=184241561's parked forecourt edge; S5: quiet, no invented striping), the paved verge between the
// promenade and Calle Paseo (Wikimedia Commons curid=184240865), lawn on the Inmigrante island.
const PARK_TONE=['#676c6d','#6e7374'],SETT_TONE=['#8e9295','#969a9c'],VERGE=['#b9b2a6','#c1baae'],LAWN=['#6f8f4f','#78965a'],FORECOURT=['#a7745e','#9b6a55'];

export function hash(i,j,k=0){let h=Math.imul(i*73856093^j*19349663^k*83492791,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
const near=(pts,x,z)=>{let best={d:Infinity};for(let i=0;i+1<pts.length;i++){const d=segmentDistance(x,z,pts[i],pts[i+1]);if(d<best.d)best={d,i};}return best;};
// Point at arclength s along a polyline with its unit tangent and left normal (−uz,ux).
function along(pts,s){let acc=0;for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(s<=acc+L||i+2===pts.length){const t=Math.max(0,Math.min(1,(s-acc)/L)),[ux,uz]=unit(a,b);return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,ux,uz,nx:-uz,nz:ux};}
    acc+=L;}}
const lengthOf=pts=>pts.slice(1).reduce((s,q,i)=>s+Math.hypot(q[0]-pts[i][0],q[1]-pts[i][1]),0);
// Outward normal of ring edge i (the side whose test point falls outside the ring).
function outward(ring,i){const a=ring[i],b=ring[(i+1)%ring.length],[ux,uz]=unit(a,b),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  return inRing(m[0]-uz*.05,m[1]+ux*.05,ring)?[uz,-ux]:[-uz,ux];}
function segX(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;
  return t>=0&&t<=1&&u>=0&&u<=1?{t,u,p:[a[0]+r[0]*t,a[1]+r[1]*t]}:null;}

export function createPuntillaLayout({city,height,terrain,surface,land:landMask,isDry,areas={}}) {
  const colliders=[],tops=[],cuts=[],tint=new Map(),surfaces=[],floorTriangles=[],buildingOverrides=new Map();
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  const earlier=Object.values(areas).filter(Boolean),roadById=new Map(city.roads.map(r=>[r.id,r]));
  const building=id=>city.buildings.find(b=>b.id===id),dry=isDry??(()=>true);
  const bb=bounds(BASE),inBase=(x,z)=>x>=bb[0]&&x<=bb[1]&&z>=bb[2]&&z<=bb[3]&&inRing(x,z,BASE);

  // ---- Landmark masses (Wikimedia Commons curid=184238581, curid=149388376, curid=106059407, curid=123441024, curid=182263185): photo-led plaster and roof tones on the mapped shells (heights unchanged: generator
  // estimates, S5). La Princesa's shell, roof and colour stay with the Princesa owner; only its public face is detailed. ----
  buildingOverrides.set(ARSENAL_ID,{colour:COLOURS.arsenal,roofColour:COLOURS.arsenalRoof});
  buildingOverrides.set(ADUANA_ID,{colour:COLOURS.aduana,roofColour:COLOURS.aduanaRoof});
  const princesaOwner=earlier.map(a=>a.buildingOverrides?.get(PRINCESA_ID)).find(Boolean)??{};
  const shell=id=>{const b=building(id),o=buildingOverrides.get(id)??(id===PRINCESA_ID?princesaOwner:{});
    return b&&{id,outer:o.outer??b.outer,holes:b.holes??[],base:o.base??b.base,roof:o.roof??b.roof};};
  const princesa=shell(PRINCESA_ID),arsenal=shell(ARSENAL_ID),aduana=shell(ADUANA_ID);
  const faces=(s,keep)=>s.outer.map((a,i)=>{const b=s.outer[(i+1)%s.outer.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=outward(s.outer,i);
    return {i,a,b,length:L,n};}).filter(f=>f.length>=2&&keep(f));
  // La Princesa: the south face (promenade and Raíces side); the north edge is the wall crest.
  const princesaFaces=faces(princesa,f=>f.n[1]>.5&&f.length>8);
  // Arsenal: portico on the projecting 10.4 m north block (Wikimedia Commons curid=149388376; 2017 street view from (72,349)), the harbour face
  // with big arched bays (Wikimedia Commons curid=182263185), the long street face along Calle La Puntilla (barred openings, pierced parapet).
  const arsenalFaces=faces(arsenal,()=>true).map(f=>{const m=[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2];
    const role=f.length>9&&f.length<12&&f.n[1]<-.9&&m[1]<373?'portico':f.n[0]>.9&&f.length>20?'harbour':f.length>60&&f.n[0]<-.5?'street':'plain';return {...f,role};});
  // Aduana: north end on the Inmigrante junction (Wikimedia Commons curid=184238581) and the long harbour face with the ochre pavilion (Wikimedia Commons curid=106059407).
  const aduanaFaces=faces(aduana,()=>true).map(f=>{const role=f.n[1]<-.9&&f.length>25?'north':f.n[0]>.9&&f.length>80?'harbour':f.length>30?'street':'plain';return {...f,role};});
  // Most interior roof point of the Arsenal away from its two courtyards: the separate red-domed cupola of Wikimedia Commons curid=182263185
  // (position inferred).
  const cupola=(()=>{const [x0,x1,z0,z1]=bounds(arsenal.outer),rings=[arsenal.outer,...arsenal.holes];let best=null;
    for(let x=x0;x<=x1;x+=1)for(let z=z0;z<=z1;z+=1){if(!inRing(x,z,arsenal.outer)||arsenal.holes.some(h=>inRing(x,z,h)))continue;
      const d=Math.min(...rings.flatMap(r=>r.map((a,i)=>segmentDistance(x,z,a,r[(i+1)%r.length]))));
      const pull=Math.hypot(x-92,z-430)*.02;if(!best||d-pull>best.score)best={x,z,d,score:d-pull};}
    return {x:best.x,z:best.z,radius:Math.min(2.6,best.d-.6),roof:arsenal.roof};})();
  // Solids for the parts that stand proud of the mapped shells: the Arsenal portico (columns 0.75 m out, entablature to
  // 1.7 m) and the Aduana's ochre pavilion (1.8 m); the builder draws exactly these extents.
  const faceRing=(f,u0,u1,d0,d1)=>{const [ux,uz]=unit(f.a,f.b),P=(u,d)=>[f.a[0]+ux*u+f.n[0]*d,f.a[1]+uz*u+f.n[1]*d];
    const r=[P(u0,d0),P(u1,d0),P(u1,d1),P(u0,d1)];return signedArea(r)<0?[...r].reverse():r;};
  const lowOn=ring=>Math.min(...ring.map(p=>height(...p)));
  for(const f of arsenalFaces.filter(q=>q.role==='portico')){const u=f.length/2,R=arsenal.roof;
    const front=faceRing(f,u-3.0,u+3.0,0,.62);prism(front,lowOn(front)-.1,R+1.9);                  // yellow frontispiece
    for(const sd of [-1,1]){const pl=faceRing(f,u+sd*2.15-.75,u+sd*2.15+.75,.55,1.35);prism(pl,lowOn(pl)-.1,R+.95);}   // plinth + column pair
    const top=faceRing(f,u-3.5,u+3.5,-.2,1.7);prism(top,R+.9,R+2.1);}                                 // entablature (overhead)
  for(const f of aduanaFaces.filter(q=>q.role==='harbour')){const r=faceRing(f,f.length/2-8,f.length/2+8,0,1.8);prism(r,lowOn(r)-.2,aduana.roof+3.35);}
  // (stairs round, item 5): the stone thresholds under the Aduana's closed ground arches (drawn by
  // sj-puntilla.js from the same recipe: arch span u ± 1.25, sill hi + .2, ground − .25, front .10) are solid, not
  // drive-through visual geometry.
  {const gAt=(f,u)=>{const [ux,uz]=[(f.b[0]-f.a[0])/f.length,(f.b[1]-f.a[1])/f.length];return height(f.a[0]+ux*u+f.n[0]*.3,f.a[1]+uz*u+f.n[1]*.3);};
    const gR=(f,u0,u1)=>{let lo=Infinity,hi=-Infinity;for(let u=u0;u<=u1+1e-6;u+=Math.max(.25,(u1-u0)/4)){const g=gAt(f,Math.max(0,Math.min(f.length,u)));lo=Math.min(lo,g);hi=Math.max(hi,g);}return [lo,hi];};
    const mid=(aduana.base+aduana.roof)/2+.4;
    for(const f of aduanaFaces){if(f.role==='plain'||f.role==='street'||f.length<6)continue;const L=f.length,k=Math.max(1,Math.floor(L/4.2)),bw=L/k,centre=L/2,pav=f.role==='harbour'?8:0;
      for(let i=0;i<k;i++){const u=(i+.5)*bw;if(pav&&Math.abs(u-centre)<pav+.8)continue;const [,hi]=gR(f,u-1.2,u+1.2),top=Math.min(mid-.35,hi+3.4);if(top-hi<=2.2)continue;
        const sill=hi+.2,[lo]=gR(f,u-1.25,u+1.25);if(sill-(lo-.25)<=.05)continue;const r=faceRing(f,u-1.25,u+1.25,0,.1);prism(r,lo-.25,sill);}}}
  const housePieces=[princesa,arsenal,aduana].filter(Boolean).flatMap(s=>convexPieces(s.outer)).map(p=>({p,b:bounds(p)}));
  const otherMasses=city.buildings.filter(b=>{const c=b.outer[0];return c[0]>-240&&c[0]<200&&c[1]>150&&c[1]<540;})
    .map(b=>({ring:(buildingOverrides.get(b.id)?.outer)??b.outer,b:bounds(b.outer)}));
  const inMass=(x,z,m=0)=>otherMasses.some(o=>x>=o.b[0]-m&&x<=o.b[1]+m&&z>=o.b[2]-m&&z<=o.b[3]+m&&
    (inRing(x,z,o.ring)||m>0&&o.ring.some((a,i)=>segmentDistance(x,z,a,o.ring[(i+1)%o.ring.length])<m)));

  // ---- Running surfaces: single-owner convex pieces after every earlier owner's surfaces and floors, outside the masses,
  // the island and the closed base. Hostos is its own paved area; La Princesa gets a paved forecourt (Wikimedia Commons curid=184241561). ----
  // Princesa's Raíces brick is returned separately from its surfaces; it is ownership too.
  const earlierRings=[...earlier.flatMap(a=>[...(a.surfaces??[]),...(a.brick??[])].map(s=>s.ring)),
    ...earlier.flatMap(a=>(a.floorTriangles??[]).map(t=>t.map(p=>[p[0],p[2]]))).filter(r=>Math.abs(signedArea(r))>1e-4)];
  const basePieces=convexPieces(BASE),islandPieces=convexPieces(ISLAND);
  const blockedFor=ring=>{const b=bounds(ring);return [...earlierRings.filter(r=>overlapB(bounds(r),b,.5)),
    ...housePieces.filter(h=>overlapB(h.b,b,.5)).map(h=>h.p),...islandPieces,...basePieces.filter(p=>overlapB(bounds(p),b,.5))];};
  const streets=[],done=[];
  const keep=(pieces,owner,kind)=>{const bx=bounds(pieces.flat());
    pieces=minus(pieces,[...blockedFor(pieces.flat()),...done.filter(d=>overlapB(bounds(d),bx,.5))]);
    // Dry ground only: a drape never hangs over a missing (sea) terrain cell (S5).
    pieces=pieces.filter(r=>r.every(p=>dry(p[0],p[1]))&&dry(...r.reduce((s,p)=>[s[0]+p[0]/r.length,s[1]+p[1]/r.length],[0,0])));
    for(const ring of pieces)surfaces.push({kind,ring,owner:'puntilla:'+owner});done.push(...pieces);};
  // The next pass's section at Inmigrante east: node 3852230414, perpendicular to the outgoing Comercio 22229666 (S5). Both
  // junction arcs stop flush on it (V3: their own perpendicular caps poked past it and left a wedge).
  const NODE=[159.039,230.801],AX=[.971,.24],PX=[-AX[1],AX[0]];
  const eastOfCut=[[NODE[0]+PX[0]*9,NODE[1]+PX[1]*9],[NODE[0]-PX[0]*9,NODE[1]-PX[1]*9],[NODE[0]-PX[0]*9+AX[0]*9,NODE[1]-PX[1]*9+AX[1]*9],[NODE[0]+PX[0]*9+AX[0]*9,NODE[1]+PX[1]*9+AX[1]*9]];
  // Calle Comercio: the setts feathered into a grey terrain apron and a streets
  // wedge before the waterfront panels. The waterfront boundary is the section line through node 3852230414 (along PX);
  // a 0.3 m pale flush edge course on this side of it, then the sett bond carried to the Aduana's north face.
  const cutLine=[[NODE[0]-PX[0]*4,NODE[1]-PX[1]*4],[NODE[0]+PX[0]*22,NODE[1]+PX[1]*22]],ccw=r=>signedArea(r)<0?[...r].reverse():r;
  const aduanaRing=ccw(aduana.outer.map(p=>[p[0],p[1]]));
  {const [a,b]=cutLine,o=.3,q=ccw([a,b,[b[0]-AX[0]*o,b[1]-AX[1]*o],[a[0]-AX[0]*o,a[1]-AX[1]*o]]);keep(minus([q],[aduanaRing]),'comercio-edge','plaza');}
  for(const [id,half,kind] of WAYS){const r=roadById.get(id);if(!r)continue;
    const pts=r.points.filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.05);streets.push({id,points:pts,half,kind,name:r.name});
    let pieces=ribbon(pts,-half,half);if(id===59744983||id===1413872646)pieces=minus(pieces,[signedArea(eastOfCut)<0?[...eastOfCut].reverse():eastOfCut]);
    keep(pieces,id,kind);}
  // Inmigrante: setts up to the island's lip (V3: a cream moat between the ring paving and the lip), and the junction
  // closed at the next pass's node 3852230414 with a flush section perpendicular to the outgoing Comercio 22229666 (S5;
  // V3: two capped arcs left a wedge). East of that section belongs to the waterfront pass.
  {const ring=[];for(let i=0;i<ISLAND.length;i++){const a=ISLAND[i],b=ISLAND[(i+1)%ISLAND.length],n=outward(ISLAND,i),o=3.6;
      const q=[a,b,[b[0]+n[0]*o,b[1]+n[1]*o],[a[0]+n[0]*o,a[1]+n[1]*o]];ring.push(...convexPieces(signedArea(q)<0?[...q].reverse():q));}
    keep(ring,'inmigrante-surround','sett');
    const node=NODE,ax=AX,disc=circle(node[0],node[1],3.4,16).map(([x,z])=>{const t=(x-node[0])*ax[0]+(z-node[1])*ax[1];return t>0?[x-ax[0]*t,z-ax[1]*t]:[x,z];});
    const clean=disc.filter((q,i,a)=>Math.hypot(q[0]-a[(i+1)%a.length][0],q[1]-a[(i+1)%a.length][1])>.02);
    keep(convexPieces(signedArea(clean)<0?[...clean].reverse():clean),'inmigrante-east','sett');}
  {const f=aduanaFaces.find(q=>q.role==='north');if(f){const D=21,X0=122.5,[a,b]=cutLine;
      // The face line extended 10 m both ways (the east end is trimmed at the section line): the sett also takes the start of
      // service way 22222069 north of that line, which ended in a grey wedge; south of it the service road starts square.
      const L=Math.hypot(f.b[0]-f.a[0],f.b[1]-f.a[1]),u=[(f.b[0]-f.a[0])/L,(f.b[1]-f.a[1])/L],fa=[f.a[0]-u[0]*10,f.a[1]-u[1]*10],fb=[f.b[0]+u[0]*10,f.b[1]+u[1]*10];
      const front=ccw([fa,fb,[fb[0]+f.n[0]*D,fb[1]+f.n[1]*D],[fa[0]+f.n[0]*D,fa[1]+f.n[1]*D]]);
      const east=ccw([a,b,[b[0]+AX[0]*30,b[1]+AX[1]*30],[a[0]+AX[0]*30,a[1]+AX[1]*30]]),west=ccw([[X0-60,200],[X0,200],[X0,280],[X0-60,280]]);
      // 2 m cells: keep drops any piece with a wet vertex, so a few large pieces near the quay left terrain slivers.
      const clip=(r,x0,x1,z0,z1)=>{let P=r;for(const [ax,s,v] of [[0,1,x0],[0,-1,x1],[1,1,z0],[1,-1,z1]]){const Q=[];
        for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],dp=(p[ax]-v)*s,dq=(q[ax]-v)*s;if(dp>=0)Q.push(p);
          if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);Q.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}P=Q;if(P.length<3)return null;}
        return Math.abs(signedArea(P))>1e-4?ccw(P):null;};
      const big=minus(convexPieces(front),[east,west,aduanaRing]),cells=[];
      for(const r of big){const [bx0,bx1,bz0,bz1]=bounds(r);for(let x=Math.floor(bx0/2)*2;x<bx1;x+=2)for(let z=Math.floor(bz0/2)*2;z<bz1;z+=2){const c=clip(r,x,x+2,z,z+2);if(c)cells.push(c);}}
      keep(cells,'aduana-frontage','sett');}}
  const prom=streets.find(s=>s.id===PROMENADE_ID).points,calle=streets.find(s=>s.id===256661395)?.points;
  // Forecourt: from 1.4 m off La Princesa's face (hedge and palm row) to the promenade.
  const forecourt=[];
  for(const f of princesaFaces){const d0=near(prom,...f.a).d,d1=near(prom,...f.b).d;if(Math.min(d0,d1)>16)continue;
    const q=[[f.a[0]+f.n[0]*1.4,f.a[1]+f.n[1]*1.4],[f.b[0]+f.n[0]*1.4,f.b[1]+f.n[1]*1.4],[f.b[0]+f.n[0]*d1,f.b[1]+f.n[1]*d1],[f.a[0]+f.n[0]*d0,f.a[1]+f.n[1]*d0]];
    forecourt.push(...convexPieces(signedArea(q)<0?[...q].reverse():q));}
  keep(forecourt,'forecourt','panel');
  const hostosRing=roadById.get(HOSTOS_ID)?.points.slice(0,-1);
  if(hostosRing)keep(convexPieces(signedArea(hostosRing)<0?[...hostosRing].reverse():hostosRing),HOSTOS_ID,'plaza');
  const nearStreet=(x,z,m)=>streets.some(s=>near(s.points,x,z).d<s.half+m);

  // Wikimedia Commons curid=149388376: the warm, worn terracotta forecourt in front of the Arsenal's north block and wings (within 9 m, off the roads).
  const arsenalNorth=arsenalFaces.filter(f=>f.n[1]<-.5);
  const forecourtArsenal=(x,z)=>!nearStreet(x,z,.3)&&arsenalNorth.some(f=>{const t=(x-f.a[0])*f.n[0]+(z-f.a[1])*f.n[1];return t>0&&t<9&&segmentDistance(x,z,f.a,f.b)<9.2;});
  // ---- Ground tones (earlier owners keep their vertices): the parking asphalt, the paved verge between the promenade and
  // Calle Paseo (Wikimedia Commons curid=184240865), lawn on the island. ----
  // Seams item 5: Plaza de Hostos (this area's place) keeps a 5 m paved surround on every side, east of the node too.
  const hostosLine=roadById.get(HOSTOS_ID)?.points??[],nearHostos=(x,z)=>hostosLine.length>2&&x>150&&x<185&&z>165&&z<225&&
    (inRing(x,z,hostosLine)||hostosLine.some((a,i)=>i+1<hostosLine.length&&segmentDistance(x,z,a,hostosLine[i+1])<5));
  {const {x0,z0,step,nx,nz}=terrain,box=[-200,200,160,520],taken=k=>earlier.some(a=>a.tint?.has(k));
    for(let j=Math.max(0,Math.floor((box[2]-z0)/step));j<=Math.min(nz-1,Math.ceil((box[3]-z0)/step));j++)
      for(let i=Math.max(0,Math.floor((box[0]-x0)/step));i<=Math.min(nx-1,Math.ceil((box[1]-x0)/step));i++){
        const x=x0+i*step,z=z0+j*step,k=j*nx+i;if(taken(k)||inBase(x,z))continue;
        if(inRing(x,z,ISLAND))tint.set(k,LAWN[hash(i,j,4)<.5?0:1]);
        else if(forecourtArsenal(x,z))tint.set(k,FORECOURT[hash(i,j,11)<.5?0:1]);
        else if(inRing(x,z,PARKING)&&!nearStreet(x,z,.5))tint.set(k,PARK_TONE[hash(i,j,6)<.5?0:1]);
        else if(calle&&x>-122&&x<142&&near(prom,x,z).d<9.5&&near(calle,x,z).d<10&&surface[k]!==3)tint.set(k,VERGE[hash(i,j,9)<.5?0:1]);
        // Seams item 5: the Inmigrante/Hostos precinct west of the waterfront node (x < 159): the raw asphalt-mask blue and the
        // pale leftover between the ways read as asphalt and paved sidewalk (Wikimedia Commons curid=184238581's grey junction surround).
        // (The integration round's quay tint here was replaced by the drawn quay apron below: a tinted vertex blocks
        // `streets`' cells, which made its parking edge a staircase.)
        // the side ground takes Wikimedia Commons curid=184238581's grey-blue sett tone rather than the pale verge.
        else if((x>118&&x<159&&z>165&&z<250||nearHostos(x,z))&&surface[k]!==3)tint.set(k,surface[k]===1?PARK_TONE[hash(i,j,6)<.5?0:1]:SETT_TONE[hash(i,j,9)<.5?0:1]);}}

  // ---- Joins (aduana-quay-160_286-s, P2): the Aduana quay apron. The mapped parking (OSM
  // 260859574) runs to the water, but `streets` must stop at every cell with a water corner, so its edge was a staircase
  // with raw earth between it and `coast`'s quay coping. This area owns one straight-edged strip instead: from a line
  // QUAY.width inside the chord of the quay face out past the face (`paved`: `streets` subtracts it exactly and `ground`
  // scatters nothing on it; `coast` does not read `paved`, so its faces, fills, copings and quay aprons are unchanged).
  // Drawn by sj-puntilla.js on the land cells' own terrain triangles in `coast`'s quay-apron tone, up to `coast`'s own
  // apron over the fill ears and its coping (Wikimedia Commons curid=106059407: the paved yard runs to the quay edge): render only.
  const quayApron=(()=>{const {x0,z0,step,nx,nz}=terrain,Q=QUAY;if(!landMask)return null;
    const E=(i,j)=>i>=0&&j>=0&&i<nx-1&&j<nz-1&&landMask[j*nx+i]&&landMask[j*nx+i+1]&&landMask[(j+1)*nx+i]&&landMask[(j+1)*nx+i+1];
    // Seaward-most land corner on each grid row line (the quay faces east into the inlet).
    const pts=[];for(let j=Math.ceil((Q.z0-z0)/step);j<=Math.floor((Q.z1-z0)/step);j++){let best=null;
      for(let i=Math.floor((Q.x0-x0)/step);i<=Math.ceil((Q.x1-x0)/step);i++)if(E(i,j)||E(i,j-1))best=x0+(i+1)*step;
      if(best!==null)pts.push([best,z0+j*step]);}
    if(pts.length<4)return null;
    // Chords between the face corners nearest the breaks; each leg's lines are offset along its own seaward (east) normal
    // and mitred at the joints, so every leg is one convex quad and the inner edge is one clean polyline.
    const P=Q.breaks.map(z=>pts.reduce((b,p)=>Math.abs(p[1]-z)<Math.abs(b[1]-z)?p:b));
    const legs=P.slice(1).map((B,k)=>{const A=P[k],[ux,uz]=unit(A,B),n=[uz,-ux],d=p=>(p[0]-A[0])*n[0]+(p[1]-A[1])*n[1];
      return {A,B,n,out:Math.max(0,...pts.filter(p=>p[1]>=A[1]-1e-6&&p[1]<=B[1]+1e-6).map(d))+Q.past};});
    // Point k offset by t_k along the mitre of its legs (the joint normal scaled so each leg's line keeps its distance).
    const line=t=>P.map((p,k)=>{const L=legs[Math.min(k,legs.length-1)],M=legs[Math.max(0,k-1)],tk=t(k);
      const mx=M.n[0]+L.n[0],mz=M.n[1]+L.n[1],m=Math.hypot(mx,mz),c=(mx*L.n[0]+mz*L.n[1])/m,r=tk/Math.max(.5,c);
      return [p[0]+mx/m*r,p[1]+mz/m*r];});
    const W=k=>-Q.width[k],outAt=k=>Math.max(legs[Math.min(k,legs.length-1)].out,legs[Math.max(0,k-1)].out);
    const inner=line(W),joint=line(k=>W(k)+Q.band),outer=line(outAt);
    const ccwR=r=>signedArea(r)<0?[...r].reverse():r,quad=(u,v,k)=>ccwR([u[k],u[k+1],v[k+1],v[k]]);
    const rings=legs.map((_,k)=>quad(inner,outer,k)),bands=legs.map((_,k)=>quad(inner,joint,k)),mains=legs.map((_,k)=>quad(joint,outer,k));
    const tris=[];for(let k=0;k<legs.length;k++){drapeConvex(bands[k],terrain,tris,0,E);drapeConvex(mains[k],terrain,tris,1,E);}
    return {rings,bands,mains,inner,face:P,tris};})();
  const paved=(quayApron?.rings??[]).map(ring=>({ring,kind:'quay',owner:'puntilla:aduana-quay'}));

  // ---- Street furniture (Wikimedia Commons curid=184241561, curid=184240865, curid=184238581). Black curled-arm lantern clusters (the Raíces type of Wikimedia Commons curid=131971361), slat benches,
  // broad shade trees in the verge and forecourt cut-outs, a palm row and clipped hedge along La Princesa (Wikimedia Commons curid=122889567), the
  // planted island's lip, trees and lanterns, pale planters at the Aduana's north end. All clear of every running strip. ----
  const lamps=[],benches=[],trees=[],palms=[],hedges=[],planters=[],kerb=[];
  const free=(x,z,r,list=[])=>!nearStreet(x,z,r)&&!inMass(x,z,r)&&!inBase(x,z)&&dry(x,z)&&!list.some(o=>Math.hypot(o.x-x,o.z-z)<r+(o.r??.5));
  const benchAt=(x,z,heading)=>{const c=Math.cos(heading),s=Math.sin(heading),legs=[-.72,.72].map(u=>({u,ground:Math.min(...[-.25,.25].map(d=>height(x+c*u+s*d,z-s*u+c*d)))}));
    const all=[-.72,.72].flatMap(u=>[-.25,.25].map(d=>height(x+c*u+s*d,z-s*u+c*d)));if(Math.max(...all)-Math.min(...all)>.24)return null;
    for(const u of [-1.1,0,1.1])for(const d of [-.4,.4])if(!free(x+c*u+s*d,z-s*u+c*d,.25,[...lamps,...trees,...palms]))return null;
    return {x,z,y:Math.max(...all),legs,heading,width:1.9,depth:.6,height:.95};};
  const promLen=lengthOf(prom),occupied=[];
  // Verge (south of the promenade): lamp, bench, tree, bench … every 8 m, 4.6–6.5 m off the promenade centreline.
  for(let s=6,k=0;s<promLen-4;s+=8,k++){const p=along(prom,s),side=p.nz>0?1:-1,sx=p.nx*side,sz=p.nz*side; // +z side = south
    const at=o=>[p.x+sx*o,p.z+sz*o];
    if(k%2===0){const [x,z]=at(4.6);if(free(x,z,.6,occupied)){lamps.push({x,z,y:height(x,z),base:false});occupied.push({x,z,r:.4});}}
    else if(k%4===1){const [x,z]=at(6.6);if(free(x,z,1.4,occupied)){trees.push({x,z,y:height(x,z),scale:.95+hash(k,3)*.2});occupied.push({x,z,r:1.0});}}
    else{const [x,z]=at(4.4),b=benchAt(x,z,Math.atan2(-sx,-sz));if(b){benches.push(b);occupied.push({x,z,r:1.2});}}}
  // Forecourt (north of the promenade, along La Princesa): shade trees in round cut-outs and benches facing the promenade.
  for(const f of princesaFaces){const L=f.length,[ux,uz]=unit(f.a,f.b);
    for(let u=6;u<L-4;u+=12){const x=f.a[0]+ux*u+f.n[0]*6.2,z=f.a[1]+uz*u+f.n[1]*6.2;if(near(prom,x,z).d<5.2)continue;
      if(free(x,z,1.2,occupied)){trees.push({x,z,y:height(x,z),scale:.9+hash(Math.round(u),5)*.2,cutout:true});occupied.push({x,z,r:1.0});}
      const bx=f.a[0]+ux*(u+6)+f.n[0]*5.4,bz=f.a[1]+uz*(u+6)+f.n[1]*5.4;if(near(prom,bx,bz).d<4.6)continue;
      const b=benchAt(bx,bz,Math.atan2(f.n[0],f.n[1]));if(b){benches.push(b);occupied.push({x:bx,z:bz,r:1.2});}}}
  // Palm row and clipped hedge along La Princesa's face (Wikimedia Commons curid=184241561, curid=122889567), broken at the central entrance under the cupola.
  const facadeLen=princesaFaces.reduce((s,f)=>s+f.length,0);let run=0,entrance=null;
  for(const f of princesaFaces){const [ux,uz]=unit(f.a,f.b);
    if(!entrance&&run+f.length>=facadeLen/2){const bays=Math.max(1,Math.round(f.length/4.2)),bw=f.length/bays,k=Math.min(bays-1,Math.floor((facadeLen/2-run)/bw)),u=(k+.5)*bw;
      entrance={x:f.a[0]+ux*u,z:f.a[1]+uz*u,face:f.i,u,bw};}
    const gap=(u0,u1,m)=>entrance&&entrance.face===f.i&&u1>entrance.u-entrance.bw/2-m&&u0<entrance.u+entrance.bw/2+m;
    // The Raíces plaza is the Princesa owner's composition; its mapped perimeter 256661399 runs ~1 m off the face there
    // (G3: a palm and the hedge blocked that rideable edge line).
    const raicesEdges=city.roads.filter(q=>q.id===256661399).map(q=>q.points),raices=(x,z)=>inRing(x,z,RAICES_PLAZA)||raicesEdges.some(e=>near(e,x,z).d<1.6);
    for(let u=.4;u<f.length-.4;u+=3.2){const L=Math.min(3.0,f.length-.4-u);if(L<.6||gap(u,u+L,.6))continue;
      const c=[f.a[0]+ux*(u+L/2)+f.n[0]*.7,f.a[1]+uz*(u+L/2)+f.n[1]*.7];if(near(prom,...c).d<4||[0,.5,1].some(t=>raices(f.a[0]+ux*(u+L*t)+f.n[0]*.7,f.a[1]+uz*(u+L*t)+f.n[1]*.7)))continue;hedges.push({x:c[0],z:c[1],len:L,ang:Math.atan2(-uz,ux),ux,uz,n:f.n,y:height(...c)});}
    for(let u=3;u<f.length-2;u+=5.5){if(gap(u,u,1.6))continue;
      const x=f.a[0]+ux*u+f.n[0]*2.0,z=f.a[1]+uz*u+f.n[1]*2.0;if(near(prom,x,z).d<4.2||!dry(x,z)||raices(x,z))continue;
      // Lean away from the face (V3: crowns cut the coping): the variant leans along local +X, turned by yaw about Y.
      palms.push({x,z,y:height(x,z),yaw:Math.atan2(-f.n[1],f.n[0])+(hash(Math.round(x*10),Math.round(z*10))-.5)*.8});}
    run+=f.length;}
  for(const h of hedges){const w=.42,r=[[-h.len/2,-w],[h.len/2,-w],[h.len/2,w],[-h.len/2,w]].map(([u,v])=>[h.x+h.ux*u+h.n[0]*v,h.z+h.uz*u+h.n[1]*v]);
    h.ring=signedArea(r)<0?[...r].reverse():r;h.lo=Math.min(...h.ring.map(p=>height(...p)));prism(h.ring,h.lo-.1,h.y+.9);}
  for(const p of palms)prism(circle(p.x,p.z,.24,8),p.y-.15,p.y+3.5);
  // Inmigrante island (Wikimedia Commons curid=184238581): a low lip round the planted island, dense broadleaf trees and dark lanterns inside.
  {const c=ISLAND.reduce((s,p)=>[s[0]+p[0]/ISLAND.length,s[1]+p[1]/ISLAND.length],[0,0]);
    for(let i=0;i<ISLAND.length;i++){const a=ISLAND[i],b=ISLAND[(i+1)%ISLAND.length],n=outward(ISLAND,i),w=.18;
      const r=[[a[0]-n[0]*w,a[1]-n[1]*w],[b[0]-n[0]*w,b[1]-n[1]*w],[b[0],b[1]],[a[0],a[1]]];
      const ga=height(...a),gb=height(...b);kerb.push({a,b,n,ta:ga+.16,tb:gb+.16,lo:Math.min(ga,gb)-.1});
      const steps=Math.max(1,Math.ceil(Math.abs(gb-ga)/.03)),L=(t,q0,q1)=>[q0[0]+(q1[0]-q0[0])*t,q0[1]+(q1[1]-q0[1])*t];
      for(let k=0;k<steps;k++){const t0=k/steps,t1=(k+1)/steps,q=[L(t0,r[0],r[1]),L(t1,r[0],r[1]),L(t1,r[3],r[2]),L(t0,r[3],r[2])];
        prism(signedArea(q)<0?[...q].reverse():q,Math.min(ga,gb)-.1,Math.min(ga+(gb-ga)*t0,ga+(gb-ga)*t1)+.16+.01,true);}}
    for(const [dx,dz,s] of [[-4.2,1.2,.85],[3.8,-2.4,.95],[1.0,4.6,.8]]){const x=c[0]+dx,z=c[1]+dz;trees.push({x,z,y:height(x,z),scale:s,island:true});}
    for(const [dx,dz] of [[-1.2,-4.6],[5.2,2.8]]){const x=c[0]+dx,z=c[1]+dz;lamps.push({x,z,y:height(x,z),base:false});}}
  // Pale planters by the Aduana's north end (Wikimedia Commons curid=184238581), on the pavement between the building and the junction ring.
  {const f=aduanaFaces.find(q=>q.role==='north');if(f){const [ux,uz]=unit(f.a,f.b);
    for(let u=4;u<f.length-3;u+=6.5){const x=f.a[0]+ux*u+f.n[0]*1.6,z=f.a[1]+uz*u+f.n[1]*1.6;if(!free(x,z,.8))continue;
      const g=Math.min(...circle(x,z,.6,4).map(p=>height(...p))),top=Math.max(...circle(x,z,.6,4).map(p=>height(...p)))+.75;
      planters.push({x,z,g,top,ang:Math.atan2(-uz,ux)});prism(circle(x,z,.62,4).map(p=>p),g-.1,top);}}}
  for(const t of trees)prism(circle(t.x,t.z,.34*t.scale,10),t.y-.1,t.y+3.5);
  for(const l of lamps)prism(circle(l.x,l.z,.22,8),l.y-.1,l.y+3.6);
  for(const b of benches){const c=Math.cos(b.heading),s=Math.sin(b.heading),r=[[-1,-.32],[1,-.32],[1,.32],[-1,.32]].map(([u,d])=>[b.x+c*u+s*d,b.z-s*u+c*d]);
    prism(signedArea(r)<0?[...r].reverse():r,Math.min(...b.legs.map(l=>l.ground))-.1,b.y+.95);}

  // ---- Closed Coast Guard base. Where the mapped polygon meets dry public
  // land: a plain perimeter fence (inferred: no photo of the current perimeter), invisible non-occluding seal prisms from the
  // ground to 3.5 m above the highest ground within 2 m, joints, gates where a road meets the fence, and a private interior
  // for checked placement, recovery and arrivals. The sea side needs no fence. ----
  const fence=[],gates=[],seals=[];
  const landEdge=i=>{const a=BASE[i],b=BASE[(i+1)%BASE.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.05)return false;const n=outward(BASE,i);
    let k=0;for(const f of [.25,.5,.75])for(const o of [2,4]){const x=a[0]+(b[0]-a[0])*f+n[0]*o,z=a[1]+(b[1]-a[1])*f+n[1]*o;if(dry(x,z)&&!inBase(x,z))k++;}return k>=3;};
  const land=BASE.map((_,i)=>landEdge(i));
  // Close one-edge gaps between fenced edges (a short sea-facing jog between two land edges is still a way in).
  for(let i=0;i<BASE.length;i++)if(!land[i]&&land[(i+BASE.length-1)%BASE.length]&&land[(i+1)%BASE.length])land[i]='gap';
  const sealPiece=(p,q,lo,hi)=>{const [ux,uz]=unit(p,q),h=FENCE.half,r=[[p[0]-uz*h,p[1]+ux*h],[q[0]-uz*h,q[1]+ux*h],[q[0]+uz*h,q[1]-ux*h],[p[0]+uz*h,p[1]-ux*h]];
    const c=prism(signedArea(r)<0?[...r].reverse():r,lo,hi);if(c){c.occludes=false;seals.push(c);}};
  const groundMax=(p,q)=>{let m=-Infinity;const n=[-(q[1]-p[1]),q[0]-p[0]],l=Math.hypot(...n)||1;
    for(const f of [0,.5,1])for(const o of [-2,-.8,0,.8,2]){const x=p[0]+(q[0]-p[0])*f+n[0]/l*o,z=p[1]+(q[1]-p[1])*f+n[1]/l*o;m=Math.max(m,height(x,z));}return m;};
  const crossings=GATE_WAYS.flatMap(id=>{const r=roadById.get(id);if(!r)return [];const out=[];
    for(let i=0;i<BASE.length;i++){const a=BASE[i],b=BASE[(i+1)%BASE.length];for(let k=0;k+1<r.points.length;k++){const x=segX(a,b,r.points[k],r.points[k+1]);if(x)out.push({id,edge:i,t:x.t,p:x.p});}
      // A road ending exactly on the boundary (Schomburg at the base corner) also gets a gate.
      for(const e of [r.points[0],r.points.at(-1)])if(segmentDistance(e[0],e[1],a,b)<.3&&!out.some(o=>Math.hypot(o.p[0]-e[0],o.p[1]-e[1])<1))out.push({id,edge:i,p:e,end:true});}
    return out;});
  for(let i=0;i<BASE.length;i++){if(!land[i])continue;const a=BASE[i],b=BASE[(i+1)%BASE.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/FENCE.piece));
    for(let k=0;k<n;k++){const p=[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],q=[a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n];
      const g0=height(...p),g1=height(...q),gate=crossings.find(c=>c.edge===i&&segmentDistance(c.p[0],c.p[1],p,q)<.01);
      fence.push({p,q,g0,g1,edge:i,gate:!!gate});
      sealPiece(p,q,Math.min(g0,g1)-.3,Math.max(groundMax(p,q)+FENCE.seal,Math.max(g0,g1)+FENCE.height+.3));}}
  // Seams (2026-11-18): a fenced run that ends at the water could be ridden round at its end (at the pier corner:
  // from (109.5,508.6) past vertex 0 across the unfenced edge 70 onto dry ground inside; also on base 797017c). Every run end
  // now carries the visible fence and its seal on along the boundary, in 1.5 m pieces, while any public dry ground lies within
  // 3.5 m, then 4 m further (the coast pass's shore strip reaches 2.05 m past the mask), capped at 40 m. Over water the panel
  // stands on the waterline. Public ground is never crossed: the extension follows the base's own boundary.
  const N=BASE.length,publicDryNear=(x,z)=>{for(let a=0;a<8;a++){const t=a*Math.PI/4;for(const r of [1.2,2.4,3.5]){const X=x+Math.cos(t)*r,Z=z+Math.sin(t)*r;
      if(dry(X,Z)&&!inBase(X,Z))return true;}}return dry(x,z)&&!inBase(x+.01,z+.01);};
  const extVertices=[];
  for(let i=0;i<N;i++){if(!land[i])continue;
    for(const dir of [1,-1]){if(land[(i+dir+N)%N])continue;
      // Walk away from the run: forward from vertex i+1 over edges i+1…, or backward from vertex i over edges i−1….
      let v=dir>0?(i+1)%N:i,clear=0,total=0;
      while(total<40&&clear<4){const e=dir>0?v:(v-1+N)%N;if(land[e])break;const a=BASE[v],b=BASE[dir>0?(v+1)%N:(v-1+N)%N],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
        const n=Math.max(1,Math.ceil(L/1.5));let k=0;
        for(;k<n&&total<40&&clear<4;k++){const p=[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],q=[a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n];
          const m=[(p[0]+q[0])/2,(p[1]+q[1])/2],d=L/n;total+=d;clear=publicDryNear(...m)?0:clear+d;
          const h0=height(...p),h1=height(...q),g0=Math.max(h0,0),g1=Math.max(h1,0);
          fence.push({p,q,g0,g1,edge:e,gate:false,ext:true});
          sealPiece(p,q,Math.min(h0,h1,0)-.3,Math.max(groundMax(p,q)+FENCE.seal,Math.max(g0,g1)+FENCE.height+.3));}
        if(k<n)break;extVertices.push(b);v=dir>0?(v+1)%N:(v-1+N)%N;}}}
  for(const p of extVertices){const g=Math.max(height(...p),0),c=prism(circle(p[0],p[1],.3,8),Math.min(height(...p),0)-.3,Math.max(g+FENCE.height+.3,groundMax(p,p)+FENCE.seal));if(c){c.occludes=false;seals.push(c);}}
  for(const c of crossings){if(!land[c.edge]||gates.some(g=>Math.hypot(g.x-c.p[0],g.z-c.p[1])<4))continue;const a=BASE[c.edge],b=BASE[(c.edge+1)%BASE.length],[ux,uz]=unit(a,b),half=3.4;
    gates.push({id:c.id,x:c.p[0],z:c.p[1],ux,uz,half,y:height(...c.p)});}
  // Joints: every fenced vertex (wedges between straight seals).
  for(let i=0;i<BASE.length;i++){const prev=land[(i+BASE.length-1)%BASE.length];if(!land[i]&&!prev)continue;const p=BASE[i],g=height(...p);
    const c=prism(circle(p[0],p[1],.3,8),g-.3,Math.max(g+FENCE.height+.3,groundMax(p,p)+FENCE.seal));if(c){c.occludes=false;seals.push(c);}}
  // Private interior: inside the mapped base (placement, recovery, map arrival).
  const offLimitsAt=ringAt(BASE,bb); // = inBase; sj-private.js keeps only the ring alive, not this layout's scope

  // Map arrival (S5: the Plaza del Inmigrante marker snaps to the Tizol/Inmigrante junction; ride-away, recovery and the
  // exact Plaza de Armas round trip pass on the stock controller).
  const places=[{name:'Plaza del Inmigrante',x:149.8,z:220.8,source:59744983}];

  // ---- the closed base's visible interior, render only (the base stays sealed and private;
  // nothing here is reachable, so nothing here is solid). View-only References: Commons "View of
  // the Coast Guard Station San Juan … from the Convent … 1" (white/cream houses with red hip tile roofs, palms and broadleaf
  // trees over lawns, a shore road with parked cars and a low seawall), "USCG housing, San Juan" (tan blocks on lawns),
  // HABS PR-134 / PR,7-SAJU,63B–D (guard house, store house: plain white flat-roofed service blocks, roll-up doors, cars on
  // cracked concrete), "CGS San Juan cutters" (white cutters alongside the east finger piers). ----
  const baseDress=createBaseDress({city,height,terrain,surface,land:landMask,dry,inBase,earlier,tint,buildingOverrides,roadById});

  // Seams (`streets` privateRings contract): the closed base's private ground is exactly BASE.
  const layout={colliders,tops,cuts,tint,surfaces,floorTriangles,places,buildingOverrides,offLimitsAt,privateRings:[BASE.map(p=>[p[0],p[1]])],paved,quayApron,
    streets,princesa,arsenal,aduana,princesaFaces,arsenalFaces,aduanaFaces,cupola,entrance,lamps,benches,trees,palms,hedges,planters,kerb,
    fence,gates,constants:{FENCE,COLOURS},baseDress,sportsRings:BASE_SPORTS,claimedTrees:baseDress.claimedTrees,ownedBuildings:[ARSENAL_ID,ADUANA_ID,...baseDress.buildings.map(b=>b.id)]};
  layout.qa=()=>({surfaces:surfaces.length,kinds:Object.fromEntries(['panel','sett','asphalt','plaza'].map(k=>[k,surfaces.filter(s=>s.kind===k).length])),
    colliders:colliders.length,seals:seals.length,fence:fence.length,gates:gates.map(g=>g.id),lamps:lamps.length,benches:benches.length,trees:trees.length,
    palms:palms.length,hedges:hedges.length,planters:planters.length,tint:tint.size,landEdges:land.filter(Boolean).length,
    faces:{princesa:princesaFaces.length,arsenal:Object.fromEntries(['portico','harbour','street','plain'].map(r=>[r,arsenalFaces.filter(f=>f.role===r).length])),
      aduana:Object.fromEntries(['north','harbour','street','plain'].map(r=>[r,aduanaFaces.filter(f=>f.role===r).length]))},
    cupola:[+cupola.x.toFixed(1),+cupola.z.toFixed(1),+cupola.radius.toFixed(2)],entrance:entrance&&[+entrance.x.toFixed(1),+entrance.z.toFixed(1)]});
  return layout;
}

// ---- closed Coast Guard base interior (render only; see createPuntillaLayout). Roles, tones and placements
// are inferred from the view-only references listed there (no survey of the current base). ----
const BASE_TONES={house:['#f1ece0','#ebe3d2','#f3efe6'],houseRoof:'#a9503a',service:['#f0ece2','#e8e2d3','#d7a46c','#e3dccb'],serviceRoof:'#bdbab2',
  yard:['#aca89f','#b3afa6'],apron:['#9f9c94','#a7a49c'],point:['#6f8f4f','#78965a','#86806f','#6c8a4c','#7a7466'],lot:['#7b7e80','#838688'],asphalt:['#5c6062','#62666a'],grass:['#6c8c4c','#77955a','#688849'],quay:['#a9a7a0','#b1afa8']};
const CAR_PAINT=['#e8e8e4','#2d3134','#8a9096','#5a6f86','#9b2f2a','#c9c4b6','#e8e8e4','#46525a'];
// Oriented minimum-area rectangle of a ring (edge-direction candidates) and the ring's fill of it.
function minRect(ring){let best=null;
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.5)continue;
    const u=[(b[0]-a[0])/L,(b[1]-a[1])/L],v=[-u[1],u[0]];let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
    for(const p of ring){const s=p[0]*u[0]+p[1]*u[1],t=p[0]*v[0]+p[1]*v[1];u0=Math.min(u0,s);u1=Math.max(u1,s);v0=Math.min(v0,t);v1=Math.max(v1,t);}
    const area=(u1-u0)*(v1-v0);if(!best||area<best.area)best={area,u,v,u0,u1,v0,v1};}
  if(!best)return null;const {u,v,u0,u1,v0,v1}=best,P=(s,t)=>[u[0]*s+v[0]*t,u[1]*s+v[1]*t];
  return {ring:[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)],u,v,len:u1-u0,wid:v1-v0,fill:Math.abs(signedArea(ring))/best.area};}

function createBaseDress({city,height,terrain,surface,land,dry,inBase,earlier,tint,buildingOverrides,roadById}){
  const ownedBefore=new Set(earlier.flatMap(a=>[...(a.buildingOverrides?.keys()??[]),...(a.ownedBuildings??[])]));
  const centroid=r=>r.reduce((s,p)=>[s[0]+p[0]/r.length,s[1]+p[1]/r.length],[0,0]);
  const buildings=[];
  for(const b of city.buildings){if([PRINCESA_ID,ARSENAL_ID,ADUANA_ID].includes(b.id)||ownedBefore.has(b.id)||buildings.some(q=>q.id===b.id))continue;
    const c=centroid(b.outer);if(!inBase(...c))continue;
    const area=Math.abs(signedArea(b.outer)),role=c[0]<-100?'house':/boat/i.test(b.name)||area>900?'shed':'service';
    const pal=role==='house'?BASE_TONES.house:BASE_TONES.service,rect=minRect(b.outer);
    const hip=role==='house'&&rect&&rect.fill>.9&&!b.holes.length&&rect.wid>4?rect:null;
    buildingOverrides.set(b.id,{colour:pal[b.id%pal.length],roofColour:role==='house'?BASE_TONES.houseRoof:BASE_TONES.serviceRoof});
    const faces=b.outer.map((a,i)=>{const q=b.outer[(i+1)%b.outer.length],L=Math.hypot(q[0]-a[0],q[1]-a[1]);return {i,a,b:q,L,n:outward(b.outer,i)};}).filter(f=>f.L>=2.5);
    buildings.push({id:b.id,name:b.name,role,outer:b.outer,base:b.base,roof:b.roof,hip,area,c,faces});}
  const bIndex=buildings.map(b=>({b,bb:bounds(b.outer)})),allB=city.buildings.map(b=>({ring:b.outer,bb:bounds(b.outer)}));
  // (perf 2026-11-18: buildings in a 32 m grid entered with a 6 m reach; queries with m ≤ 6 give the full scan's answer.)
  const bGrid=new Map(),BG=32,BR=6,near_=o=>(x,z,m)=>x>=o.bb[0]-m&&x<=o.bb[1]+m&&z>=o.bb[2]-m&&z<=o.bb[3]+m&&
    (inRing(x,z,o.ring)||o.ring.some((a,i)=>segmentDistance(x,z,a,o.ring[(i+1)%o.ring.length])<m));
  for(const o of allB){o.test=near_(o);for(let gx=Math.floor((o.bb[0]-BR)/BG);gx<=Math.floor((o.bb[1]+BR)/BG);gx++)for(let gz=Math.floor((o.bb[2]-BR)/BG);gz<=Math.floor((o.bb[3]+BR)/BG);gz++){
    const k=gx*100003+gz;let l=bGrid.get(k);if(!l)bGrid.set(k,l=[]);l.push(o);}}
  const nearBuilding=(x,z,m)=>m>BR?allB.some(o=>o.test(x,z,m)):(bGrid.get(Math.floor(x/BG)*100003+Math.floor(z/BG))??[]).some(o=>o.test(x,z,m));
  void bIndex;
  const baseRoads=city.roads.filter(r=>r.kind!=='footway'&&r.points.some(p=>inBase(...p))).map(r=>({id:r.id,pts:r.points,half:(r.width??4)/2}));
  const roadDist=(x,z)=>{let d=Infinity;for(const r of baseRoads)for(let i=0;i+1<r.pts.length;i++)d=Math.min(d,segmentDistance(x,z,r.pts[i],r.pts[i+1])-r.half);return d;};
  const wet=(x,z,r)=>{for(let a=0;a<8;a++){const t=a*Math.PI/4;if(!dry(x+Math.cos(t)*r,z+Math.sin(t)*r))return true;}return !dry(x,z);};
  // Doors on the face nearest a base road (≥ 4 m long).
  // no door (or its canopy) on a face within 2 m of the fence line (271366518 stands 0.54 m off it).
  const fenceDist=(x,z)=>{let d=Infinity;for(let i=0;i<BASE.length;i++)d=Math.min(d,segmentDistance(x,z,BASE[i],BASE[(i+1)%BASE.length]));return d;};
  for(const b of buildings){let best=null;for(const f of b.faces){if(f.L<4||Math.min(fenceDist(...f.a),fenceDist(...f.b))<2)continue;const m=[(f.a[0]+f.b[0])/2+f.n[0]*2,(f.a[1]+f.b[1])/2+f.n[1]*2],d=roadDist(...m);
    if(!best||d<best.d)best={d,i:f.i};}b.door=best?.i??null;}

  // Ground tones on the terrain grid inside the polygon (and the Raíces tongue's point). Earlier owners and this module's own
  // tones keep priority.
  const grass=new Set();let tinted=0;
  {const {x0,z0,step,nx,nz}=terrain,bb=bounds(BASE),early=new Uint8Array(nx*nz);for(const a of earlier)for(const k of a.tint?.keys()??[])early[k]=1;
    const taken=k=>tint.has(k)||early[k]===1;
    // A grid vertex drawn by any land cell (the vertex land flag), not only one whose south-east cell is dry: the shore
    // corners of drawn cells otherwise kept the default pale tone (item 3, the Raíces tongue's pale wedge).
    const onLand=(k,x,z)=>land?!!land[k]:dry(x,z);
    const edgeDist=(x,z)=>{let d=Infinity;for(let i=0;i<BASE.length;i++)d=Math.min(d,segmentDistance(x,z,BASE[i],BASE[(i+1)%BASE.length]));return d;};
    for(let j=Math.max(0,Math.floor((bb[2]-27-z0)/step));j<=Math.min(nz-1,Math.ceil((bb[3]-z0)/step));j++)
      for(let i=Math.max(0,Math.floor((bb[0]-27-x0)/step));i<=Math.min(nx-1,Math.ceil((bb[1]+27-x0)/step));i++){
        const x=x0+i*step,z=z0+j*step,k=j*nx+i;if(taken(k)||surface[k]===3)continue;const h=hash(i,j,23),pick=a=>a[Math.floor(h*a.length)];
        if(inBase(x,z)){
          const tone=surface[k]===1||roadDist(x,z)<.8?pick(BASE_TONES.asphalt):wet(x,z,3)?pick(BASE_TONES.quay):nearBuilding(x,z,6)||roadDist(x,z)<2.5?pick(BASE_TONES.yard):pick(BASE_TONES.grass);
          if(tone===BASE_TONES.grass[0]||tone===BASE_TONES.grass[1]||tone===BASE_TONES.grass[2])grass.add(k);tint.set(k,tone);tinted++;}
        // Seams item 3: the bare tongue between the Raíces pier root and the base corner (audit la-puntilla-edge--205_260)
        // reads as the Princesa park's grassy, rocky point rather than paving (inferred; the shore line itself is coast's).
        else if(onLand(k,x,z)&&x<-180&&z<290&&edgeDist(x,z)<30){tint.set(k,pick(BASE_TONES.point));tinted++;}
        // Seams the service-lot / verge tones on the public ground outside the fence stay only where
        // `streets` has no input (the promenade/fence verge west of x −118, item 3, and fence-line vertices inside the
        // ring). In front of the gates `streets` paves that ground with its own kerbs, sidewalks and aprons, and a tinted
        // vertex blocked its cells there (s1-puntilla-gate).
        else if(onLand(k,x,z)&&(inRing(x,z,BASE)||x<-118&&z<300)&&edgeDist(x,z)<(z>380?25:20)){tint.set(k,surface[k]===1?pick(BASE_TONES.asphalt):z>380?pick(BASE_TONES.lot):pick(BASE_TONES.apron));tinted++;}}}

  // Trees: the 19 mapped trees along Calle Acacia (claimed from the generic placeholders) as coconut palms with every third a
  // broad shade tree, then sparse trees on the interior lawns (jittered 15 m grid, clear of masses, roads, water, fence).
  // lawn trees and palms stood on the base's mapped basketball and volleyball
  // courts (OSM 829206459/829206460). The jittered lawn pass keeps the court, a 1.5 m apron and its crown reach (palm
  // fronds 3.4 m, shade crowns 2.6 m) clear; mapped Acacia claims are unchanged.
  // (One implementation: the `BASE_SPORTS` rings published as `sportsRings`, apron included, plus the crown reach.)
  const palms=[],trees=[],claimedTrees=[];
  city.trees.forEach(([x,z],i)=>{if(!inBase(x,z))return;claimedTrees.push({x,z});const y=height(x,z),yaw=hash(Math.round(x*10),Math.round(z*10),3)*Math.PI*2;
    if(i%3===2)trees.push({x,y:y-.05,z,yaw,scale:.9+hash(i,7)*.25});else palms.push({x,y,z,yaw});});
  {const {x0,z0,step,nx}=terrain,bb=bounds(BASE);let n=0;
    for(let gx=bb[0];gx<bb[1];gx+=15)for(let gz=bb[2];gz<bb[3];gz+=15){const h1=hash(Math.round(gx),Math.round(gz),31),h2=hash(Math.round(gx),Math.round(gz),37);
      const x=gx+(h1-.5)*9,z=gz+(h2-.5)*9,k=Math.round((z-z0)/step)*nx+Math.round((x-x0)/step);
      if(!grass.has(k)||h1*h2>.42||!inBase(x,z)||wet(x,z,4)||nearBuilding(x,z,4.5)||roadDist(x,z)<3)continue;
      let edge=Infinity;for(let i=0;i<BASE.length;i++)edge=Math.min(edge,segmentDistance(x,z,BASE[i],BASE[(i+1)%BASE.length]));if(edge<3.5)continue;
      if([...palms,...trees].some(t=>Math.hypot(t.x-x,t.z-z)<6))continue;
      if(BASE_SPORTS.some(o=>inRing(x,z,o.ring)||o.ring.some((q,i)=>segmentDistance(x,z,q,o.ring[(i+1)%o.ring.length])<(h2<.4?3.4:2.6))))continue;   // crown reach off the published court+apron
      const y=height(x,z),yaw=h1*Math.PI*2;if(h2<.4)palms.push({x,y,z,yaw});else trees.push({x,y:y-.05,z,yaw,scale:.85+h1*.35});if(++n>=80)break;}}

  // each base palm's root 3 cm under the lowest ground of its 0.3 m footprint.
  for(const p of palms)p.y=seatedBottom((x,z)=>height(x,z),{x:p.x,z:p.z,r:.3},p.y);
  // Parked cars along the base roads (reference: the shore road lined with parked cars; HABS store-house yard).
  const cars=[];
  for(const r of baseRoads)for(let i=0;i+1<r.pts.length;i++){const a=r.pts[i],b=r.pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<6)continue;
    const [ux,uz]=unit(a,b);for(let s=3;s<L-3;s+=6.5){const h=hash(r.id%100000,i*97+Math.round(s),41);if(h>.34)continue;const side=hash(r.id%100000,i*97+Math.round(s),43)<.5?1:-1;
      const off=r.half+1.5,x=a[0]+ux*s-uz*off*side,z=a[1]+uz*s+ux*off*side;
      const foot=[[-2.3,-1],[2.3,-1],[2.3,1],[-2.3,1],[0,0]].map(([p,q])=>[x+ux*p-uz*q,z+uz*p+ux*q]);
      if(foot.some(p=>!inBase(...p)||!dry(...p)||nearBuilding(...p,.6))||cars.some(c=>Math.hypot(c.x-x,c.z-z)<5.2))continue;
      if(foot.some(p=>roadDist(...p)<-.2))continue;
      // only near-level bays (the four tyre contacts within 6 cm), the car on their mean, so no wheel floats or
      // sinks more than 5 cm; three generic profiles so a row does not read copy-pasted.
      const type=Math.floor(hash(i,Math.round(s),53)*3),half=type===1?1.2:type===2?1.6:1.4;
      const tyres=[[-half,-.75],[half,-.75],[half,.75],[-half,.75]].map(([p,q])=>height(x+ux*p-uz*q,z+uz*p+ux*q));
      if(Math.max(...tyres)-Math.min(...tyres)>.06)continue;
      cars.push({x,z,y:tyres.reduce((a,b)=>a+b,0)/4,heading:Math.atan2(-uz,ux),type,half,paint:CAR_PAINT[Math.floor(hash(i,Math.round(s),47)*CAR_PAINT.length)]});}}

  // Low seawall on the water side of Calle Acacia 256338713 (reference: the shore road's low wall), ≥ 0.9 m inside the
  // dry edge so the shoreline line itself stays with the coast pass.
  const wall=[];
  {const r=roadById.get(256338713);if(r){let prev=null;const pts=r.points;
    for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),[ux,uz]=unit(a,b);
      for(let s=0;s<L;s+=3){const x=a[0]+ux*s,z=a[1]+uz*s;let st=null;
        for(const side of [1,-1]){let dw=null;for(let d=2;d<=10;d+=.25)if(!dry(x-uz*d*side,z+ux*d*side)){dw=d;break;}
          if(dw===null)continue;const d=Math.max(2.7,dw-.9);if(d>dw-.6)continue;const p=[x-uz*d*side,z+ux*d*side];
          if(!inBase(...p)||!dry(...p)||nearBuilding(...p,.5))continue;if(!st||dw<st.dw)st={dw,p,side};}
        if(st&&prev&&prev.side===st.side&&Math.hypot(st.p[0]-prev.p[0],st.p[1]-prev.p[1])<4.6)wall.push({a:[prev.p[0],height(...prev.p),prev.p[1]],b:[st.p[0],height(...st.p),st.p[1]]});
        prev=st;}}}}

  // Cutters alongside the three east finger piers (reference "CGS San Juan cutters"): generic white patrol-boat shapes, no
  // markings. Kept only where the whole hull lies over water.
  // three variants (length, superstructure station, mast, boat) so the moored row is not a clone.
  const cutters=[[146,568.4,0,30,0],[148,608.4,0,26,1],[143,632.6,0,34,2]].map(([x,z,heading,length,v])=>({x,z,heading,length,beam:length<28?6:6.6,v}))
    .filter(c=>[[-c.length/2,-3.3],[c.length/2,-3.3],[c.length/2,3.3],[-c.length/2,3.3],[0,0]].every(([u,v])=>!dry(c.x+u,c.z+v)));

  // Calle Acacia's asphalt (256338713, 22228673): a crisp draped ribbon on the exact terrain triangles (the 2 m tint alone
  // read as a sawtooth from the Raíces plaza and the audit's Acacia cameras). Drawn in its own offset mesh: the base is not
  // a public surface owner.
  const roadTris=[];
  for(const id of [256338713,22228673]){const r=roadById.get(id);if(!r)continue;
    const pts=r.points.filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.05);
    for(const ring of ribbon(pts,-2.5,2.5)){const keepRing=ring.every(p=>dry(...p));if(!keepRing)continue;drapeConvex(ring,terrain,roadTris);}}

  return {buildings,tinted,trees,palms,cars,wall,cutters,claimedTrees,roadTris};
}
