/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Eastern civic district (El Capitolio, the Constitución institutions, the Paseo memorial strip, Plaza de la Democracia
// and the San Juan Bautista overlook) — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// Area module (contract: header of sj-princesa-layout.js), registered after puntilla and before wallFoot.
// Survey; mapped vs inferred and References:
// Mapped: Capitolio 59744985, Cámara annex 5391069, Senado annex 5391070, Casa de España 3885884, Carnegie 292446817,
// Ateneo 292446816, Casa Olímpica 292446818, Escuela de Medicina Tropical 3885872; plazas 509430859/862/867/853/851/846,
// south forecourt rings 458602060/458602058, Democracia 458601936, Bautista overlook 256662600, Holocaust ring 295176729;
// steps 295176742/260861719/195141030 and service way 260861721; monument/statue/flagpole nodes listed in MONUMENTS.
// Inferred: every height above the DEM, the Capitol's portico depth/column count/dome dimensions, the stair treads and
// closures, the replacement floor of the service way under the south stair, all dressing placement, parapet line (survey
// polyline, I), facade bay rhythms, colours from the view-only references.
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {unit,bounds,ribbon,minus,overlapB,convexPlanes,plane} from './sj-city-wall.js';
import {eastcivicAt} from './sj-private.js';
import {rideableFlight,stairRecord,registerStairFlights} from './sj-stairs.js';

export const CAPITOL_ID=59744985,CAMARA_ID=5391069,SENADO_ID=5391070,ESPANA_ID=3885884,CARNEGIE_ID=292446817,ATENEO_ID=292446816,
  OLIMPICA_ID=292446818,TROPICAL_ID=3885872;
export const OWNED=[CAPITOL_ID,ESPANA_ID,ATENEO_ID,CARNEGIE_ID,OLIMPICA_ID,TROPICAL_ID,CAMARA_ID,SENADO_ID];
// Area of this package (the survey's selection: x ≥ 620, north of the waterfront seam, up to the east cut).
export const EC_BOUNDS={minX:620,maxX:1342,minZ:-360,maxZ:40};
// Building colours (view-only references, docs table): Capitol white marble; Carnegie pink with white trim and a green
// tile hip roof (P. Hughes photo); Ateneo white with Moorish arches and a red tile eave (P. Hughes photo); Casa de España white with blue-white tile; Casa Olímpica warm cream; Tropical Spanish-revival cream with
// red tile; annexes pale.
export const STYLE={
  [CAPITOL_ID]:{wall:'#ebe6db',roof:'#d8d2c4'},[CAMARA_ID]:{wall:'#e4ddcd',roof:'#c9c2b4'},[SENADO_ID]:{wall:'#e4ddcd',roof:'#c9c2b4'},
  [ESPANA_ID]:{wall:'#f0ebde',roof:'#c8bfae'},[CARNEGIE_ID]:{wall:'#e8beb3',roof:'#c9c0b2'},[ATENEO_ID]:{wall:'#f1eee6',roof:'#d6d0c4'},
  [OLIMPICA_ID]:{wall:'#e6d3ae',roof:'#c3b49c'},[TROPICAL_ID]:{wall:'#e9d8b4',roof:'#b85c3f'}};
// Capitol frame: u along the south front (1126.2,−117.5)→(1150.4,−119.6), v toward the south (Constitución).
export const CAP={O:[1137.4,-140.6],dir:[24.2,-2.1],uc:-.44,R:26.5,stylobate:12.95,colTop:22.9,entTop:24.6,
  south:{u0:-14.97,u1:14.09,door:10.0,wingW:18.68,wingE:19.29},north:{u0:-14.85,u1:14.26,door:-15.4,foot:-23.25},
  dome:{v:-2.7,attic:3.0,r:9.6,drum:5.6,rise:6.2,lantern:3.0},
  lower:{u0:-12.44,u1:11.56,top:38.3,foot:45.0},
  // Upper flight (open flights round): landing foot v 32.9 (DEM still level), top at the deck's south edge v 28.1 (the
  // service way's south abutment); width = the DEM ridge of the mapped stair (|u − uc| ≤ 9.4).
  upper:{u0:-9.84,u1:8.96,foot:32.9,top:28.1}};
// Physical support margin above r·(sec θ − 1) (lean/pitch allowance; measured, doc exterior flights.
export const STAIR_MARGIN=.035;
// Survey polylines (I placement, M datum): the Bautista parapet and the beach-stair guard.
export const PARAPET=[[1095.6,-236.4],[1098,-229.5],[1108,-232],[1118,-236],[1124,-237.5],[1138,-238.5],[1146,-235],[1154,-235],[1163,-237],[1172,-232],[1177.4,-232.9]];
// Recovery/placement exclusion seaward of the parapet: crash recovery must land on the plaza side.
export const OVERLOOK_SEA=[[1095.6,-236.4],[1098,-229.5],[1108,-232],[1118,-236],[1124,-237.5],[1138,-238.5],[1146,-235],[1154,-235],[1163,-237],[1172,-232],
  [1177.4,-232.9],[1179,-228.4],[1197,-231],[1197,-265],[1090,-265],[1090,-238]];
const BEACH_GUARD=[[1177.4,-232.9],[1178.7,-227.9]];
// OSM 295176729 Memorial al Holocausto (sculpture ring).
export const HOLOCAUST=[[1136.7,-69.2],[1137.1,-64.6],[1138.5,-61.3],[1141.4,-59.2],[1144.3,-59.0],[1148.0,-60.3],[1149.8,-62.3],[1150.5,-65.7],[1150.3,-70.3]];
// Landscape polygons (OSM natural/landuse) used for ground tone only.
const WOOD=[[1050.7,-248.9],[1060.5,-250.4],[1063.3,-249.0],[1067.7,-250.1],[1070.7,-243.8],[1077.6,-231.8],[1088.9,-231.8],[1086.6,-224.4],[1090.6,-225.7],
  [1092.6,-231.0],[1096.3,-234.4],[1102.5,-231.3],[1107.1,-235.5],[1110.3,-233.0],[1118.2,-237.9],[1116.4,-241.0],[1122.0,-243.1],[1127.8,-244.2],[1134.2,-243.9],
  [1139.5,-243.0],[1138.0,-239.3],[1146.5,-236.3],[1150.0,-239.8],[1154.0,-235.7],[1159.9,-240.1],[1163.4,-239.2],[1167.7,-238.9],[1171.4,-236.2],[1173.9,-232.0],
  [1175.4,-231.6],[1177.9,-231.5],[1182.9,-232.5],[1183.4,-236.5],[1181.2,-239.1],[1181.2,-242.0],[1182.4,-243.6],[1180.5,-245.4],[1172.4,-246.7],[1159.4,-247.2],
  [1147.7,-248.1],[1144.3,-249.8],[1135.6,-249.9],[1129.2,-252.3],[1107.6,-257.7],[1097.9,-264.1],[1091.0,-265.9],[1081.7,-264.6],[1074.3,-259.1],[1065.0,-258.8],
  [1056.1,-258.7],[1050.0,-258.3],[1045.5,-264.6],[1037.4,-269.1],[1035.2,-266.7],[1035.4,-264.0],[1038.8,-259.6],[1044.7,-256.1],[1044.1,-253.2],[1045.3,-249.8]];
// OSM 458603055 La Loma de los Vientos (landuse=meadow).
const LOMA=[[1093.5,-211.3],[1092.5,-218.3],[1091.0,-218.3],[1090.6,-225.7],[1086.6,-224.4],[1088.9,-231.8],[1077.6,-231.8],[1070.7,-243.8],[1067.7,-250.1],
  [1063.3,-249.0],[1060.5,-250.4],[1050.7,-248.9],[1051.2,-246.3],[1048.6,-243.5],[1033.8,-241.6],[1031.5,-244.2],[1031.3,-246.8],[1033.7,-248.3],[1035.2,-249.5],
  [1024.7,-251.9],[1018.5,-250.4],[1009.0,-250.5],[997.2,-256.9],[991.4,-268.4],[982.5,-265.4],[972.9,-239.3],[972.7,-238.3],[977.0,-234.1],[979.8,-231.2],
  [982.5,-227.6],[983.3,-226.0],[984.5,-223.5],[985.3,-220.5],[985.7,-217.8],[986.1,-215.4],[985.9,-211.9],[985.6,-208.2],[984.5,-204.8],[982.8,-200.8],
  [980.9,-197.2],[978.3,-194.4],[974.2,-191.7],[969.2,-189.5],[973.0,-175.3],[1042.8,-198.5],[1068.2,-205.0],[1090.1,-210.2]];
const SCRUB=[[[1037.4,-269.1],[1031.4,-273.6],[1021.2,-276.7],[998.6,-270.8],[991.4,-268.4],[997.2,-256.9],[1009.0,-250.5],[1018.5,-250.4],[1024.7,-251.9],
  [1035.2,-249.5],[1033.7,-248.3],[1031.3,-246.8],[1031.5,-244.2],[1033.8,-241.6],[1048.6,-243.5],[1051.2,-246.3],[1050.7,-248.9],[1045.3,-249.8],[1044.1,-253.2],
  [1044.7,-256.1],[1038.8,-259.6],[1035.4,-264.0],[1035.2,-266.7]],
  [[966.2,-322.3],[966.9,-325.9],[959.2,-328.0],[943.7,-334.5],[927.9,-337.6],[916.2,-330.5],[914.3,-328.3],[910.3,-323.6],[906.2,-322.2],[899.5,-321.2],
  [896.1,-318.0],[895.8,-311.7],[893.2,-305.8],[894.3,-302.7],[963.7,-318.8]]];
// Monuments at their mapped nodes (kind decides the drawn form; all inferred dimensions). Unnamed artworks and the
// Deporte monument (form not verified) get a restrained abstract stone, not an implied figure.
export const MONUMENTS=[
  {id:4545824515,name:'Monumento en Honor al Policía Puertorriqueño',x:994.77,z:-52.58,kind:'stele'},
  {id:9631640801,name:'Monumento al Maestro Puertorriqueño',x:1043.53,z:-56.39,kind:'statue',pose:'teacher',face:[0,1]},
  {id:9631640799,name:'Monumento de la Recordación',x:1143.25,z:-53.31,kind:'wall'},
  {id:9631640800,name:'Monumento a la Masacre de Lods',x:1096.01,z:-61.25,kind:'plaque'},
  {id:9688650678,name:'Monumento en Honor al Deporte de los Caballeros',x:1261.63,z:-59.05,kind:'abstract',face:[0,1]},
  {id:9688650679,name:'(monument, unnamed)',x:1235.42,z:-58.27,kind:'abstract',face:[0,1]},
  {id:4545808790,name:'(artwork, unnamed)',x:1196.65,z:-56.76,kind:'abstract',face:[0,1]},
  {id:4986628426,name:'(artwork, unnamed)',x:1249.09,z:-59.49,kind:'abstract',face:[0,1]},
  {id:4545808871,name:'Estatua de Santiago Iglesias Pantín',x:1332.25,z:-66.81,kind:'statue',pose:'orator',face:[-1,0]},
  {id:4694086268,name:'Escultura al Dr. Ramón Mellado Parsons',x:785.5,z:-41.46,kind:'bust'},
  {id:11891460092,name:'Busto de Eugenio María de Hostos',x:871.67,z:-76.29,kind:'bust'},
  {id:11891460093,name:'Busto de Juan Bosch',x:875.03,z:-76.55,kind:'bust'},
  {id:12596422607,name:'(statue, unnamed)',x:818.17,z:-70.68,kind:'abstract',face:[0,1]},
  {id:4545186264,name:'Estatua del Intendente Alejandro Ramírez',x:775.37,z:17.35,kind:'statue',pose:'cloak',face:[0,-1]},
  {id:4795699737,name:'San Juan Bautista',x:1128.62,z:-234.54,kind:'bautista',pose:'bautista',face:[0,-1]}];
const FLAGPOLES=[[1144.01,-195.98],[1118.93,-193.45]];
// Public spaces paved by this area: [way, kind]. The rings are OSM area outlines (closed ways).
const PLAZAS=[[509430859,'panel'],[509430862,'plaza'],[509430867,'morro'],[509430853,'morro'],[509430851,'morro'],[509430846,'panel'],
  [458602060,'morro'],[458602058,'morro'],[458601936,'morro'],[256662600,'morro']];
// Roads whose running strip stays with the city-wide streets owner (subtracted from the plazas).
const RUNNING=new Set(['primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','residential','service','cycleway','unclassified']);
const SERVICE_ID=260861721;
// San Cristóbal / fort-tops reserves: no tint, solids or dressing here.
const RESERVES=[[600,735,-360,-100],[626,678,-169,-106],[667,882,-191,-99],[645,679,-335,-307],[903,960,-247,-187],[760,890,-270,-200],[715,760,-300,-235]];
const LAWN=['#7d9a60','#86a266','#738f57'],DRY=['#9c9a6c','#a7a077','#8f9161'],ROCK=['#857d6d','#78725f','#918a78'],
  SCRUBT=['#5f7444','#687d4a'],WOODT=['#4f6a3c','#58723f'],PAVE=['#cfc7b3','#d6cebb'];

// Garden east of Los Leones: ring = Paseo Covadonga's north side 5.4 m off its centreline (the back of the
// streets owner's 1.6 m sidewalk on its 8 m carriageway), then the mapped edges of the Mujer plaza (509430846), Plaza del
// Maestro (509430862) and Plaza de los Leones (509430867) to the west, the east edge where the Covadonga sidewalk
// 458601930 begins. Paths: the mapped footways inside it (OSM width 2.2 m; drawn 2.3 m so the city-wide lane is covered).
export const GARDEN={path:1.15,verge:[-7.4,-5.4],steep:.5,steps:509430863,x:[1063.4,1100],covadonga:195483564,plazas:[509430867,509430862,509430846],
  paths:[458604301,509430865,509430847,509431154,509430863,509430860,509430864],
  edge:[[1100,-49],[1103,-58],[1103.3,-64.6],[1095.1,-65.5],[1085.2,-64.9],[1078.6,-64.4],[1058.3,-63.2],[1054.3,-53.9],[1054,-53.1],
    [1058.9,-49],[1061.8,-45.7],[1062.8,-43.8],[1063.3,-42.1]]};
export function gardenOf(roadById){const cv=roadById.get(GARDEN.covadonga);if(!cv)return null;
  // The carriageway's points around the garden (segments overlapping its x range ± 40 m, with their end points).
  const P=cv.points,keepI=new Set();for(let i=0;i+1<P.length;i++)if(Math.max(P[i][0],P[i+1][0])>GARDEN.x[0]-40&&Math.min(P[i][0],P[i+1][0])<GARDEN.x[1]+40){keepI.add(i);keepI.add(i+1);}
  const line=[...keepI].sort((a,b)=>a-b).map(i=>P[i]);if(line.length<2)return null;
  const at=x=>{for(let i=0;i+1<line.length;i++){const a=line[i],b=line[i+1];if(x>=a[0]&&x<=b[0]){const t=(x-a[0])/(b[0]-a[0]),l=Math.hypot(b[0]-a[0],b[1]-a[1]);
    return [a[1]+(b[1]-a[1])*t,(b[0]-a[0])/l,(b[1]-a[1])/l];}}return null;};
  // North edge: east to west every ≤ 4 m, offset to the north (−z) side by −verge[1] across the local direction.
  const north=[],d=-GARDEN.verge[1],n=Math.ceil((GARDEN.x[1]-GARDEN.x[0])/4);
  for(let k=0;k<=n;k++){const x=GARDEN.x[1]-(GARDEN.x[1]-GARDEN.x[0])*k/n,q=at(x);if(!q)return null;const [z,ux,uz]=q;north.push([x+uz*d,z-ux*d]);}
  const ring=[...GARDEN.edge,...north.reverse()];
  const paths=GARDEN.paths.filter(id=>roadById.get(id)).map(id=>Object.assign(roadById.get(id).points.filter((q,i,a)=>!i||Math.hypot(q[0]-a[i-1][0],q[1]-a[i-1][1])>.05),{id})).filter(p=>p.length>1);
  return {ring,paths,covadonga:line};}
// Convex ∩ convex (Sutherland–Hodgman), both counter-clockwise in signedArea's sense.
function clipConvex(p,c){let out=p;const s=Math.sign(signedArea(c));
  for(let i=0;i<c.length&&out.length;i++){const a=c[i],b=c[(i+1)%c.length],side=q=>s*((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]));const next=[];
    for(let k=0;k<out.length;k++){const P=out[k],Q=out[(k+1)%out.length],dp=side(P),dq=side(Q);if(dp>=0)next.push(P);
      if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push([P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t]);}}out=next;}
  return out;}

export function hash(i,j,k=0){let h=Math.imul(i*73856093^j*19349663^k*83492791,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
const ccw=r=>signedArea(r)<0?[...r].reverse():r;
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function outward(ring,i){const a=ring[i],b=ring[(i+1)%ring.length],[ux,uz]=unit(a,b),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  return inRing(m[0]-uz*.05,m[1]+ux*.05,ring)?[uz,-ux]:[-uz,ux];}
export const faceList=ring=>ring.map((a,i)=>{const b=ring[(i+1)%ring.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);return {i,a,b,length:L,n:outward(ring,i)};}).filter(f=>f.length>=1.5);
// Point / polyline helpers.
function nearest(pts,x,z){let best={d:Infinity};for(let i=0;i+1<pts.length;i++){const d=segmentDistance(x,z,pts[i],pts[i+1]);if(d<best.d)best={d,i};}return best;}

// Uniform-grid index of items by plan bounds; query returns each candidate once (construction-time speed only).
function gridIndex(items,boundsOf,cell=8){const map=new Map(),key=(i,j)=>i*100003+j;
  items.forEach((it,n)=>{const b=boundsOf(it);for(let i=Math.floor(b[0]/cell);i<=Math.floor(b[1]/cell);i++)for(let j=Math.floor(b[2]/cell);j<=Math.floor(b[3]/cell);j++){
    const k=key(i,j);let l=map.get(k);if(!l)map.set(k,l=[]);l.push(n);}});
  const seen=new Uint32Array(items.length);let stamp=0;
  return (x0,x1,z0,z1)=>{stamp++;const out=[];for(let i=Math.floor(x0/cell);i<=Math.floor(x1/cell);i++)for(let j=Math.floor(z0/cell);j<=Math.floor(z1/cell);j++)
    for(const n of map.get(key(i,j))??[])if(seen[n]!==stamp){seen[n]=stamp;out.push(items[n]);}return out;};}
// Grid vertices inside a polygon (scanned over its own bounds only).
function rasterRing(ring,terrain,set,value){const {x0,z0,step,nx,nz}=terrain,b=bounds(ring);
  for(let j=Math.max(0,Math.ceil((b[2]-z0)/step));j<=Math.min(nz-1,Math.floor((b[3]-z0)/step));j++)for(let i=Math.max(0,Math.ceil((b[0]-x0)/step));i<=Math.min(nx-1,Math.floor((b[1]-x0)/step));i++)
    if(inRing(x0+i*step,z0+j*step,ring))set.set(j*nx+i,value);}

export function createEastcivicLayout({city,height,terrain,surface,isDry,areas={}}) {
  const colliders=[],tops=[],cuts=[],tint=new Map(),surfaces=[],floorTriangles=[],buildingOverrides=new Map(),privateRects=[];
  const dry=isDry??(()=>true),earlier=Object.values(areas).filter(Boolean),roadById=new Map(city.roads.map(r=>[r.id,r]));
  const building=id=>city.buildings.find(b=>b.id===id);
  const prism=(outer,minY,maxY,support=false,extra={})=>{if(Math.abs(signedArea(outer))<1e-4||!(maxY>minY))return null;
    const c={outer:ccw(outer).map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support,...extra};colliders.push(c);return c;};
  const lowOn=ring=>{let m=Infinity;for(const p of ring)m=Math.min(m,height(...p));for(let k=0;k<ring.length;k++)m=Math.min(m,height(...lerp(ring[k],ring[(k+1)%ring.length],.5)));
    return m;};
  const highOn=(ring,step=.5)=>{const [x0,x1,z0,z1]=bounds(ring);let m=-Infinity;
    for(let x=x0;x<=x1+1e-6;x+=step)for(let z=z0;z<=z1+1e-6;z+=step)if(inRing(x,z,ring)||ring.some((a,i)=>segmentDistance(x,z,a,ring[(i+1)%ring.length])<.05))m=Math.max(m,height(x,z));
    for(const p of ring)m=Math.max(m,height(...p));return m;};
  const inReserve=(x,z,m=0)=>RESERVES.some(r=>x>=r[0]-m&&x<=r[1]+m&&z>=r[2]-m&&z<=r[3]+m);

  // ---- Capitol frame ----
  const L=Math.hypot(...CAP.dir),e=[CAP.dir[0]/L,CAP.dir[1]/L],s=[-e[1],e[0]],O=CAP.O;
  const W=(u,v)=>[O[0]+e[0]*u+s[0]*v,O[1]+e[1]*u+s[1]*v],UV=(x,z)=>[(x-O[0])*e[0]+(z-O[1])*e[1],(x-O[0])*s[0]+(z-O[1])*s[1]];
  const rectUV=(u0,u1,v0,v1)=>ccw([W(u0,v0),W(u1,v0),W(u1,v1),W(u0,v1)]);
  const capB=building(CAPITOL_ID),{R}=CAP,S=CAP.south,N=CAP.north;
  // Shell: the mapped outline with both central projections replaced by open porticos (the stairs, columns and the closed
  // doors stand in them). South: vertices 3–7 (projection front) → the door line v=10; north: 19–25 → the wing line.
  const capOuter=(()=>{const o=capB.outer,ix=p=>o.findIndex(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.2);
    const i2=ix([1124.1,-120.7]),i8=ix([1153.1,-122.6]),i18=ix([1150.4,-157.4]),i26=ix([1121.2,-154.5]);
    if([i2,i8,i18,i26].some(i=>i<0))return o;
    return [...o.slice(0,i2+1),W(S.u0,S.door),W(S.u1,S.door),...o.slice(i8,i18+1),W(N.u1,N.door),W(N.u0,N.door),...o.slice(i26+1)];})();
  buildingOverrides.set(CAPITOL_ID,{outer:capOuter,roof:R,colour:STYLE[CAPITOL_ID].wall,roofColour:STYLE[CAPITOL_ID].roof});
  for(const id of OWNED)if(id!==CAPITOL_ID&&building(id))buildingOverrides.set(id,{colour:STYLE[id].wall,roofColour:STYLE[id].roof});
  // Escuela de Medicina Tropical: the clipped footprint touches a nodata vertex (base −4.30). Its base becomes the
  // lowest dry ground under the walls (a shut shell; the east cut face belongs to worldedge).
  {const b=building(TROPICAL_ID);if(b){let m=Infinity;for(const r of [b.outer,...b.holes])for(let k=0;k<r.length;k++)for(const t of [0,.25,.5,.75]){
      const p=lerp(r[k],r[(k+1)%r.length],t);if(dry(...p))m=Math.min(m,height(...p));}
    if(Number.isFinite(m))buildingOverrides.set(TROPICAL_ID,{...buildingOverrides.get(TROPICAL_ID),base:m-.4});}}

  // ---- South service way 260861721 under the monumental stair (survey P1). The DEM smears the stair bridge into a 4.4 m
  // hump across the way (x 1128–1150). The public way keeps a continuous floor at its own grade: a bounded replacement
  // floor (drawn = physical) through a render-only cut, with retaining faces on both sides. No ride-under is invented: the
  // upper flight starts at the way's north kerb. ----
  const service=(()=>{const r=roadById.get(SERVICE_ID);if(!r)return null;const pts=r.points,half=2.0;
    // Arc stations every 1 m along the way between x≈1112 and x≈1166; the floor spans the stretch where the DEM across the
    // way rises more than 0.12 m over the straight line between the stretch's end grades.
    const st=[];for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],Ls=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(Ls);
      for(let k=0;k<n;k++){const p=lerp(a,b,k/n);if(p[0]>1108&&p[0]<1170){const [ux,uz]=unit(a,b);st.push({p,n:[-uz,ux]});}}}
    const across=q=>[-half,-half/2,0,half/2,half].map(d=>height(q.p[0]+q.n[0]*d,q.p[1]+q.n[1]*d));
    // Reference grade: the way's own centreline ground on either side of the hump (x<1122 / x>1158), linear between.
    const hump=st.map(q=>Math.max(...across(q))),ref=(()=>{const W0=st.filter(q=>q.p[0]<1122),E0=st.filter(q=>q.p[0]>1158),m=l=>l.reduce((a,q)=>a+height(...q.p),0)/l.length;
      const a={x:W0.reduce((t,q)=>t+q.p[0],0)/W0.length,y:m(W0)},b={x:E0.reduce((t,q)=>t+q.p[0],0)/E0.length,y:m(E0)};return x=>a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);})();
    let i0=st.findIndex((q,k)=>hump[k]>ref(q.p[0])+.35),i1=-1;for(let k=st.length-1;k>=0;k--)if(hump[k]>ref(st[k].p[0])+.35){i1=k;break;}
    if(i0<0)return null;i0=Math.max(0,i0-2);i1=Math.min(st.length-1,i1+2);
    const run=st.slice(i0,i1+1),y0=height(...run[0].p),y1=height(...run.at(-1).p);
    // Across samples: every DEM grid-line and diagonal crossing of both end sections (a 3-point section left a
    // 6 cm lip against the kept terrain), so the end rows equal the kept ground exactly along the cut line. The end
    // profiles fade into the uniform floor over three rows (a smooth transition, no step).
    const {x0:tx0,z0:tz0,step:ts}=terrain,L_=q=>[q.p[0]+q.n[0]*half,q.p[1]+q.n[1]*half],R_=q=>[q.p[0]-q.n[0]*half,q.p[1]-q.n[1]*half];
    const T=new Set([0,.25,.5,.75,1]);
    for(const q of [run[0],run.at(-1)]){const a=L_(q),b=R_(q),dx=b[0]-a[0],dz=b[1]-a[1];
      const add=(f0,df,c0)=>{if(Math.abs(df)<1e-9)return;const lo=Math.min(f0,f0+df),hi=Math.max(f0,f0+df);
        for(let k=Math.ceil((lo-c0)/ts);c0+k*ts<=hi+1e-9;k++){const t=(c0+k*ts-f0)/df;if(t>1e-6&&t<1-1e-6)T.add(+t.toFixed(9));}};
      add(a[0],dx,tx0);add(a[1],dz,tz0);add(a[0]+a[1],dx+dz,tx0+tz0);}
    const ts_=[...T].sort((p,q)=>p-q),N_=run.length-1,lin=k=>y0+(y1-y0)*k/N_;
    const prof=q=>ts_.map(t=>{const a=L_(q),b=R_(q);return height(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);});
    const e0=prof(run[0]).map(y=>y-y0),e1=prof(run.at(-1)).map(y=>y-y1),FADE=3;
    const rows=run.map((q,k)=>{const y=lin(k),a=L_(q),b=R_(q),w0=Math.max(0,1-k/FADE),w1=Math.max(0,1-(N_-k)/FADE);
      const pts=ts_.map((t,i)=>{const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;return [x,y+e0[i]*w0+e1[i]*w1,z];});
      const at=t=>pts[ts_.indexOf(t)];return {q,y,pts,l:at(0),c:at(.5),r:at(1)};});
    return {pts,half,rows,y0,y1,ts:ts_};})();
  if(service){const {rows}=service;
    for(let k=0;k+1<rows.length;k++){const A=rows[k],B=rows[k+1];
      const tris=[];for(let i=0;i+1<A.pts.length;i++)tris.push([A.pts[i],B.pts[i],B.pts[i+1]],[A.pts[i],B.pts[i+1],A.pts[i+1]]);
      // The floor owns every reference height up to 8 m over it (a high reference returned the cut-away hump).
      for(const tri of tris){const t=tri.map(p=>[...p]);t.kind='road';floorTriangles.push(t);
        tops.push({poly:t.map(p=>({x:p[0],z:p[2]})),top:Math.max(t[0][1],t[1][1],t[2][1]),plane:plane(t),replacesTerrain:true,
          maxReferenceY:Math.max(t[0][1],t[1][1],t[2][1])+8.0,surface:'pavement',source:'eastcivic:service'});}
      // Render cut: the way's own quad, all terrain above 0.25 m under the floor (the floor and the faces own that space).
      const ring=ccw([[A.l[0],A.l[2]],[B.l[0],B.l[2]],[B.r[0],B.r[2]],[A.r[0],A.r[2]]]),bb=bounds(ring);
      cuts.push({minX:bb[0],maxX:bb[1],minZ:bb[2],maxZ:bb[3],kind:'eastcivic-service',planes:[...convexPlanes(ring),[0,1,0,-(Math.min(A.y,B.y)-.25)]]});}
    // Side faces ('l' = south, 'r' = north for this west→east way): where the kept ground beside the floor stands above it.
    // South = the stair landing's retaining wall
    // (with a parapet); north = the stair base (drawn by the flight) or a plain retaining face.
    service.sides=[];
    for(const side of ['l','r']){const list=[];
      for(let k=0;k+1<rows.length;k++){const A=rows[k],B=rows[k+1],a=[A[side][0],A[side][2]],b=[B[side][0],B[side][2]];
        const ga=height(...a),gb=height(...b),gm=height(...lerp(a,b,.5));const top=Math.max(ga,gb,gm);
        list.push({a,b,fa:A.y,fb:B.y,ga,gb,top,rise:top-Math.min(A.y,B.y)});}
      service.sides.push({side,list});}}

  // ---- Capitol porticos and the open monumental flights (public stairs are rideable up and down,
  // with no wheel clipping; doc section exterior flights. Drawn: uniform treads with nosings over a render-only cut of the
  // footprint (fitted above the DEM). Physical: the smooth lifted nose-line support of js/sj-stairs.js (replacement tops),
  // blended into the ground before the foot and the surface beyond the top; the rendered wheel is seated on the drawn
  // treads by the presentation hook registered below. Cheek walls stay solid; balustrades only where they guard a drop. ----
  const flights=[],balustrades=[],stairRects=[],stairApproach=[],stairRecords=[];
  const capFrame={W,UV,rect:rectUV,ry:-Math.atan2(e[1],e[0])};
  const balustrade=(a,b,ga,gb,h=.95,kind='stone',loAt=null)=>{const ring=ccw((()=>{const [ux,uz]=unit(a,b),w=.17;return [[a[0]-uz*w,a[1]+ux*w],[b[0]-uz*w,b[1]+ux*w],[b[0]+uz*w,b[1]-ux*w],[a[0]+uz*w,a[1]-ux*w]];})());
    const lo=loAt??Math.min(lowOn(ring),ga,gb)-.15,hi=Math.max(ga,gb)+h;balustrades.push({a,b,ga,gb,h,kind,lo});prism(ring,lo,hi);};
  // flight: Capitol frame, treads from v=vf (foot) to v=vt (top), across u0..u1; yf foot ground, yt top surface;
  // `ground(x,z)` the drawn surface before the foot and beyond the top; `cheeks` [[u edge, outward sign, width]].
  const flight=(name,{u0,u1,vf,vt,yf,yt,n,ground=height,cheeks=[[u0,-1,.7],[u1,1,.7]],cheekTo=null,cheekFrom=null,footApron=0,topApron=0,uStep,frame=null,footReach,topReach,uBreaks,grid})=>{
    const Fm=frame??capFrame,W=Fm.W,rectUV=Fm.rect;
    const dir=Math.sign(vt-vf),run=Math.abs(vt-vf),at=(u,s)=>W(u,vf+dir*s);
    const fl=rideableFlight({at,u0,u1,run,yf,yt,n,ground,margin:STAIR_MARGIN,footApron,topApron,...(uStep?{uStep}:{}),...(footReach?{footReach}:{}),...(topReach?{topReach}:{}),...(uBreaks?{uBreaks}:{}),...(grid?{grid}:{})});
    const all=rectUV(u0,u1,Math.min(vf,vt),Math.max(vf,vt)),floor=Math.min(lowOn(all),yf,yt)-.25;
    const treads=fl.treads.map(t=>({v0:vf+dir*t.s0,v1:vf+dir*t.s1,top:t.top,lo:floor,nosing:t.nosing}));
    const f={frame:{W:Fm.W,UV:Fm.UV,ry:Fm.ry},name,u0,u1,vf,vt,yf,yt,n,dir,run,treads,cheeks:[],h:fl.h,g:fl.g,theta:fl.theta,lift:fl.lift,footS:fl.footS,topS:fl.topS,
      worstGap:fl.worstGap,maxFloat:fl.maxFloat,lip:fl.lip,lipAt:fl.lipAt,nosing:fl.nosing,lines:fl.lines,tops:fl.tops.length,aprons:fl.aprons};flights.push(f);
    // Aprons replace the smeared DEM between the flight's end and the real ground (render cut; drawn by the builder).
    for(const [a,b] of [footApron?[vf-dir*footApron,vf]:null,topApron?[vt,vt+dir*topApron]:null].filter(Boolean)){const r=rectUV(u0,u1,Math.min(a,b),Math.max(a,b)),bb=bounds(r);
      let lo=Infinity;for(const t of fl.aprons)for(const p of t)lo=Math.min(lo,p[1]);
      cuts.push({minX:bb[0],maxX:bb[1],minZ:bb[2],maxZ:bb[3],kind:'eastcivic-apron',planes:[...convexPlanes(r),[0,1,0,-(lo-.25)]]});stairRects.push(r);}
    for(const tri of fl.tops){const top=Math.max(tri[0][1],tri[1][1],tri[2][1]);
      tops.push({poly:tri.map(p=>({x:p[0],z:p[2]})),top,plane:plane(tri),replacesTerrain:true,maxReferenceY:top+4,surface:'pavement',source:'eastcivic:stair'});}
    {const bb=bounds(all);cuts.push({minX:bb[0],maxX:bb[1],minZ:bb[2],maxZ:bb[3],kind:'eastcivic-flight',planes:[...convexPlanes(all),[0,1,0,-(Math.min(yf,yt)-.25)]]});}
    stairRects.push(all);
    stairApproach.push(rectUV(u0,u1,Math.min(vf+dir*(fl.footS-1.5),vf),Math.max(vf+dir*(fl.footS-1.5),vf)),
      rectUV(u0,u1,Math.min(vt,vf+dir*(fl.topS+1.5)),Math.max(vt,vf+dir*(fl.topS+1.5))));
    // Cheek walls: stepped stone blocks, each level-topped 1.0 m over the flight line at its upper end (and 0.3 m over the
    // kept ground beside it); the foot piece is the newel pier (references: plain pier blocks, no rail across the foot).
    for(const [u,o,wd] of cheeks){const va=cheekFrom??vf,vb=cheekTo??vt,len=Math.abs(vb-va),k=Math.max(1,Math.min(4,Math.round(len/2)));
      let prevTop=-Infinity;
      for(let i=0;i<k;i++){const a=va+(vb-va)*i/k,b=va+(vb-va)*(i+1)/k,ring=rectUV(Math.min(u,u+o*wd),Math.max(u,u+o*wd),Math.min(a,b),Math.max(a,b));
        const line=yf+(yt-yf)*Math.max(0,Math.min(1,dir*(b-vf)/run)),lo=Math.min(lowOn(ring),floor)-.2;
        // Each piece steps up at least 5 cm (coplanar guard: two equal pieces' caps overlapped on one plane).
        const top=Math.max(Math.max(line,highOn(ring,.5)-.3)+1.0,prevTop+.05);prevTop=top;
        f.cheeks.push({ring,lo,top});prism(ring,lo,top);}}
    stairRecords.push(stairRecord(fl));
    return f;};
  // Exact service-floor height (the floor triangles), the DEM elsewhere.
  const floorAt=(x,z)=>{for(const t of floorTriangles){if(t.kind!=='road')continue;const a=t[0],b=t[1],c=t[2],d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-12)continue;
      const l1=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,l2=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,l3=1-l1-l2;
      if(l1>=-1e-9&&l2>=-1e-9&&l3>=-1e-9)return l1*a[1]+l2*b[1]+l3*c[1];}return height(x,z);};
  const UP=CAP.upper,UC=[UP.u0,UP.u1];
  // South lower flight (295176742): forecourt → landing (458602058), open at both ends.
  // The DEM is smeared 10–30 cm off the tread levels within ~1.5 m of both ends: fitted aprons carry the forecourt and
  // landing grades to the first and last risers (top = the landing's level 1.8 m in; foot = the forecourt 1.0 m out).
  const lowerTop=height(...W(CAP.uc,CAP.lower.top-1.8)),lowerFoot=height(...W(CAP.uc,CAP.lower.foot+1.0));
  flight('south-lower',{u0:CAP.lower.u0,u1:CAP.lower.u1,vf:CAP.lower.foot,vt:CAP.lower.top,yf:lowerFoot,yt:lowerTop,n:Math.round((lowerTop-lowerFoot)/.16),footApron:1.0,topApron:1.8});
  // South upper flight (260861719): landing → the bridge deck over the service way → the portico terrace (stylobate level).
  // The DEM ridge (|u| ≲ 9.5, rising 0.42 m/m from the landing) and the Xiquinho Silva / Mtmelendez photos: a flight between
  // plain piers, narrower than the lower flight, reaching the portico level before the service way passes under it.
  const upFoot=height(...W(CAP.uc,UP.foot+.6)),deckOr=g=>(x,z)=>UV(x,z)[1]<=UP.top+1e-6?CAP.stylobate:g(x,z);
  flight('south-upper',{u0:UC[0],u1:UC[1],vf:UP.foot,vt:UP.top,yf:upFoot,yt:CAP.stylobate,n:Math.round((CAP.stylobate-upFoot)/.16),ground:deckOr(height),footApron:.6});
  // Side flights 458602056 / 458602057 (mapped centrelines at u −13.2 / 12.4): landing edge (v 31.4) down to the service
  // way's south kerb, each between a wide inner cheek (to the upper flight's pier) and a narrow outer cheek.
  const lKerb=service?Math.max(...service.rows.map(r=>UV(r.l[0],r.l[2])[1])):27.7;
  const sides=[];
  for(const [id,uc,inner] of [[458602056,-13.2,1],[458602057,12.4,-1]]){const r=roadById.get(id);if(!r||!service)continue;
    // the first riser stands 0.85 m behind the kerb on a flat foot apron at the floor's level, so the foot
    // fillet (the support's blend) ends at the kerb line — the service way's 4 m stays flat (no bump, full width clear).
    // The foot stays on the service floor's own extent (beyond its ends the way's edge is the smeared DEM).
    const fu=service.rows.map(q=>UV(q.l[0],q.l[2])[0]),fu0=Math.min(...fu)+.15,fu1=Math.max(...fu)-.15;
    const um0=r.points.reduce((a,p)=>a+UV(...p)[0],0)/r.points.length,um=Math.max(fu0+1.2,Math.min(fu1-1.2,um0)),u0=um-1.2,u1=um+1.2,FA=.85,lF=Math.min(...service.rows.map(q=>UV(q.l[0],q.l[2])[1]))-.005,vf=lF+FA,vt=31.4;
    const yf=floorAt(...W(um,lKerb-.05)),yt=height(...W(um,vt+1.0)),n=Math.round((yt-yf)/.16);
    const lIn=lF-.005,ground=(x,z)=>{const [u,v]=UV(x,z);return v<lF+.01?floorAt(...W(u,Math.min(v,lIn))):height(x,z);};
    const pier=inner>0?[u1,1,UC[0]-.7-u1]:[u0,-1,u0-(UC[1]+.7)];
    sides.push(flight(id===458602056?'south-west':'south-east',{u0,u1,vf,vt,yf,yt,n,ground,cheeks:[pier,inner>0?[u0,-1,.5]:[u1,1,.5]],cheekFrom:lF,footApron:FA,footReach:FA,topApron:1.0,
      // Lateral lines at the floor's own row vertices (its kerb edge is piecewise linear along the way) and its east end.
      uBreaks:service.rows.map(q=>UV(q.l[0],q.l[2])[0]),grid:terrain}));void uc;
    // Drawn foot apron from the floor's own south edge (not the straight support row 0–1.5 cm inside it): no strip of
    // apron laid over the floor, no slit between them. Heights as the module's apron (floor at the edge → yf at the riser).
    {const f=sides.at(-1),ls=service.rows.map(q=>UV(q.l[0],q.l[2])).sort((a,b)=>a[0]-b[0]);
      const lEdge=u=>{for(let i=0;i+1<ls.length;i++)if(u>=ls[i][0]&&u<=ls[i+1][0])return ls[i][1]+(ls[i+1][1]-ls[i][1])*(u-ls[i][0])/(ls[i+1][0]-ls[i][0]);return ls.at(-1)[1];};
      // This apron ends at the service kerb, not at the module's extrapolated ground line.
      stairRecords.at(-1).footBoundary=u=>(lEdge(u)-vf)*f.dir;
      const P=(u,v)=>{const [x,z]=W(u,v),g=ground(...W(u,lF));return [x,g+(yf-g)*Math.max(0,Math.min(1,(v-lF)/FA)),z];};
      const us=f.lines.map(L=>L.u),tris=f.aprons.filter(t=>!t.every(p=>UV(p[0],p[2])[1]<vf+1e-3));
      for(let i=0;i+1<us.length;i++){const a=P(us[i],lEdge(us[i])),b=P(us[i+1],lEdge(us[i+1])),c=P(us[i+1],vf),d=P(us[i],vf);tris.push([a,b,c],[a,c,d]);}
      f.aprons=tris;}}
  // Bridge and terrace: the deck carries the upper flight's top level over the way (slab underside = headroom over the
  // floor), the terrace runs at stylobate level to the doors, full portico width (+0.7 m where the old cheeks stood).
  const TU=[S.u0-.7,S.u1+.7],slabLo=CAP.stylobate-.55,wallV=[23.3,23.7];
  const bridge={UC,TU,slabLo,deck:[UP.top,wallV[1]],abut:[lKerb,lKerb+.4],front:wallV,terrace:[15.6,wallV[0]]};
  const floorLow=service?Math.min(...service.rows.map(r=>r.y))-.3:lowerTop-2;
  bridge.floorLow=floorLow;bridge.headroom=service?slabLo-Math.max(...service.rows.filter(r=>{const u=UV(r.c[0],r.c[2])[0];return u>UC[0]&&u<UC[1];}).map(r=>Math.max(...r.pts.map(p=>p[1])))):null;
  prism(rectUV(UC[0],UC[1],wallV[1],lKerb),slabLo,CAP.stylobate);                                  // deck slab
  prism(rectUV(UC[0]-.7,UC[1]+.7,lKerb,lKerb+.4),floorLow,CAP.stylobate);                         // south abutment / tunnel wall
  prism(rectUV(TU[0],TU[1],wallV[0],wallV[1]),floorLow,CAP.stylobate);                            // terrace front / tunnel north wall
  bridge.terraceLo=lowOn(rectUV(TU[0],TU[1],15.6,wallV[0]))-.3;prism(rectUV(TU[0],TU[1],15.6,wallV[0]),bridge.terraceLo,CAP.stylobate);
  // Flat support over the deck, the terrace and the portico floor (drawn top = 12.95; every top replaces the cut DEM).
  const flat=(ring,y,src)=>{const r=ring.map(p=>[p[0],y,p[1]]);for(const tri of [[r[0],r[1],r[2]],[r[0],r[2],r[3]]])
    tops.push({poly:tri.map(p=>({x:p[0],z:p[2]})),top:y,plane:plane(tri),replacesTerrain:true,maxReferenceY:y+4,surface:'pavement',source:src});};
  flat(rectUV(UC[0],UC[1],wallV[1],UP.top),CAP.stylobate,'eastcivic:deck');flat(rectUV(TU[0],TU[1],S.door,wallV[1]),CAP.stylobate,'eastcivic:terrace');
  stairRects.push(rectUV(UC[0]-.7,UC[1]+.7,lKerb,UP.top),rectUV(TU[0],TU[1],S.door,wallV[1]));
  // Balustrades that guard drops: the deck sides over the way, the terrace front either side of the deck, the terrace ends.
  const T=CAP.stylobate,bal=(u0,v0,u1,v1,lo)=>balustrade(W(u0,v0),W(u1,v1),T,T,.95,'stone',lo);
  // (coplanar guard: their pier feet stood on the soffit plate's plane and their end piers flush with the
  // slab's edge — feet now 10 cm up inside the slab, ends 3 cm short of it.)
  bal(UC[0]+.17,wallV[1]-.15,UC[0]+.17,UP.top-.03,slabLo+.1);bal(UC[1]-.17,wallV[1]-.15,UC[1]-.17,UP.top-.03,slabLo+.1);
  bal(TU[0]+.17,wallV[1]-.15,UC[0]+.17,wallV[1]-.15,T-.3);bal(UC[1]-.17,wallV[1]-.15,TU[1]-.17,wallV[1]-.15,T-.3);
  bal(TU[0]+.17,wallV[1]-.15,TU[0]+.17,S.wingW,T-.3);bal(TU[1]-.17,wallV[1]-.15,TU[1]-.17,S.wingE,T-.3);
  // North flight (195141030): the mapped steps meet the portico over the north way's hump; the flight is the ridge's level
  // width (the trench either side is ~2 m lower), foot at the way's kerb; a terrace at stylobate level stands either side.
  const nVf=-23.6,nVt=-21.0,nYf=height(...W(CAP.uc,nVf-1.0));
  const ridgeOk=u=>Math.abs(height(...W(u,nVf-1.0))-nYf)<=.12&&Math.abs(height(...W(u,nVf-1.6))-nYf)<=.25;
  let nu0=CAP.uc,nu1=CAP.uc;while(nu0>N.u0+2&&ridgeOk(nu0-.25))nu0-=.25;while(nu1<N.u1-2&&ridgeOk(nu1+.25))nu1+=.25;nu0+=.3;nu1-=.3;
  const nGround=(x,z)=>UV(x,z)[1]>=nVt-1e-6?CAP.stylobate:height(x,z);
  flight('north',{u0:nu0,u1:nu1,vf:nVf,vt:nVt,yf:nYf,yt:T,n:Math.round((T-nYf)/.16),ground:nGround,cheeks:[],footApron:1.0,uStep:.5});
  const NT=[N.u0,N.u1];
  for(const [a,b] of [[NT[0],nu0],[nu1,NT[1]]]){const r=rectUV(a,b,nVf,nVt);prism(r,lowOn(r)-.3,T);}
  flat(rectUV(NT[0],nu0,nVf,N.door),T,'eastcivic:terrace');flat(rectUV(nu1,NT[1],nVf,N.door),T,'eastcivic:terrace');flat(rectUV(nu0,nu1,nVt,N.door),T,'eastcivic:terrace');
  stairRects.push(rectUV(NT[0],NT[1],nVf,N.door));
  {const cut=rectUV(NT[0],NT[1],nVf,nVt),bb=bounds(cut);cuts.push({minX:bb[0],maxX:bb[1],minZ:bb[2],maxZ:bb[3],kind:'eastcivic-portico',planes:[...convexPlanes(cut),[0,1,0,-(nYf-1.6)]]});}
  bal(NT[0]+.17,nVf+.15,nu0-.17,nVf+.15,T-.3);bal(nu1+.17,nVf+.15,NT[1]-.17,nVf+.15,T-.3);
  bal(nu0-.17,nVf+.15,nu0-.17,nVt,T-.3);bal(nu1+.17,nVf+.15,nu1+.17,nVt,T-.3);
  bal(NT[0]+.17,nVf+.15,NT[0]+.17,N.door-.03,T-.3);bal(NT[1]-.17,nVf+.15,NT[1]-.17,N.door-.03,T-.3);
  const northTerrace={NT,nu0,nu1,vf:nVf,vt:nVt,lo:lowOn(rectUV(NT[0],NT[1],nVf,nVt))-.3};
  // Service-way retaining faces (drawn by the builder from exactly these numbers). North side: the terrace front and the
  // tunnel wall own the portico width. South side: the abutment, the cheeks and the side flights own the span between the
  // side flights' outer cheeks; elsewhere faces over 0.6 m carry a 1.0 m parapet.
  const lSkip=sides.length?[Math.min(...sides.map(f=>f.u0))-.5,Math.max(...sides.map(f=>f.u1))+.5]:[UC[0]-.7,UC[1]+.7];
  if(service)for(const sd of service.sides)for(const w of sd.list){const [um]=UV(...lerp(w.a,w.b,.5));
    w.skip=sd.side==='r'?um>TU[0]-.05&&um<TU[1]+.05:um>lSkip[0]&&um<lSkip[1];if(w.skip||w.rise<.04)continue;
    const [ux,uz]=unit(w.a,w.b),o=sd.side==='l'?1:-1,nx=-uz*o,nz=ux*o,t=.4;// outward = away from the floor
    w.out=[nx,nz];w.wallTop=w.top+(sd.side==='l'&&w.rise>.6?1.0:0);w.parapet=sd.side==='l'&&w.rise>.6;
    w.ring=ccw([w.a,w.b,[w.b[0]+nx*t,w.b[1]+nz*t],[w.a[0]+nx*t,w.a[1]+nz*t]]);w.lo=Math.min(w.fa,w.fb)-.3;
    if(w.rise>.2)prism(w.ring,w.lo,w.wallTop);}
  // Service floor rows under the deck: their validity ends at the slab underside (a real ceiling for camera/placement).
  if(service){const slabRing=rectUV(UC[0],UC[1],wallV[1],lKerb);
    for(const t of tops)if(t.source==='eastcivic:service'){const cx=(t.poly[0].x+t.poly[1].x+t.poly[2].x)/3,cz=(t.poly[0].z+t.poly[1].z+t.poly[2].z)/3;
      if(inRing(cx,cz,slabRing)){t.ceilingOffset=slabLo-t.top;delete t.maxReferenceY;}}}
  // South cut: the terrace and portico floor and the deck zone (render only; the terrace, deck and stylobate own the space).
  {const ring=rectUV(S.u0,S.u1,S.door,wallV[1]),bb=bounds(ring);cuts.push({minX:bb[0],maxX:bb[1],minZ:bb[2],maxZ:bb[3],kind:'eastcivic-portico',
    planes:[...convexPlanes(ring),[0,1,0,-(floorLow)]]});}
  {const ring=rectUV(UC[0],UC[1],wallV[1],UP.top),bb=bounds(ring);cuts.push({minX:bb[0],maxX:bb[1],minZ:bb[2],maxZ:bb[3],kind:'eastcivic-deck',
    planes:[...convexPlanes(ring),[0,1,0,-(slabLo-.05)]]});}
  // Stylobates (portico floors) and the column rows: solid prisms from the ground to the floor, columns to the entablature.
  const porticos=[];
  for(const [side,u0,u1,va,vb,vc] of [['south',S.u0,S.u1,15.6,S.door,14.7],['north',N.u0,N.u1,-21.0,N.door,-20.1]]){
    const ring=rectUV(u0,u1,Math.min(va,vb),Math.max(va,vb)),lo=lowOn(ring)-.3;prism(ring,lo,CAP.stylobate);
    const cols=[],n=8,span=(u1-u0)-3.2;for(let k=0;k<n;k++){const u=u0+1.6+span*k/(n-1),[x,z]=W(u,vc);cols.push({u,x,z});prism(circle(x,z,.62,8),CAP.stylobate-.1,CAP.colTop);}
    // Return columns behind the corners (depth of the portico).
    for(const u of [u0+1.6,u1-1.6])for(const dv of [2.6]){const v=vc+(side==='south'?-dv:dv),[x,z]=W(u,v);cols.push({u,x,z,ret:true});prism(circle(x,z,.62,8),CAP.stylobate-.1,CAP.colTop);}
    porticos.push({side,u0,u1,va,vb,vc,lo,cols});}
  // Dome on the central block.
  const dome={...CAP.dome,centre:W(CAP.uc,CAP.dome.v),y0:R};

  // ---- Institution entries (public stairs rideable, no wheel clipping). The old three 0.25 m
  // risers stood on the highest ground of the footprint (a 73–75 cm first lip over the street). Now: a top pad at the
  // real doorway ground (highest ground under the pad + 3 cm), and a js/sj-stairs.js flight down to the street with
  // risers ≤ 0.17 m (as many treads as the rise needs, 0.33 m goings), fitted foot apron, cheek blocks; the doors stay
  // closed; the pad leaves room to turn before them. References: P. Hughes, Commons (Carnegie: columned portico on a
  // podium; Ateneo: a short centred flight before the arched door). ----
  const shellOfEarly=id=>{const b=building(id),ov=buildingOverrides.get(id)??{};return b&&{outer:ov.outer??b.outer};};
  const fronts=[];
  const facesOf=id=>{const o=buildingOverrides.get(id)?.outer??building(id)?.outer;return o?faceList(o):[];};
  const faceFrame=f=>{const [ux,uz]=unit(f.a,f.b),Wf=(u,v)=>[f.a[0]+ux*u+f.n[0]*v,f.a[1]+uz*u+f.n[1]*v];
    return {W:Wf,UV:(x,z)=>[(x-f.a[0])*ux+(z-f.a[1])*uz,(x-f.a[0])*f.n[0]+(z-f.a[1])*f.n[1]],rect:(u0,u1,v0,v1)=>ccw([Wf(u0,v0),Wf(u1,v0),Wf(u1,v1),Wf(u0,v1)]),ry:-Math.atan2(uz,ux)};};
  const entry=(id,f,{half,dep,stairHalf,cheek,kind,cols=0})=>{const Fm=faceFrame(f),mid=f.length/2,pad=Fm.rect(mid-half,mid+half,0,dep);
    const F=highOn(pad,.4)+.03,lo=lowOn(pad)-.2;prism(pad,lo,F,true);stairRects.push(pad);
    // Treads: smallest count with risers ≤ 0.17 m to the street ground at the apron's far edge (0.8 m out).
    let pick=null;for(let k=3;k<=9;k++){const vf=dep+k*.33,yf=height(...Fm.W(mid,vf+.8));if((F-yf)/k<=.17){pick={k,vf,yf};break;}}
    if(!pick)return null;
    const fl=flight(`${kind}-${id}`,{frame:Fm,u0:mid-stairHalf,u1:mid+stairHalf,vf:pick.vf,vt:dep,yf:pick.yf,yt:F,n:pick.k,
      ground:(x,z)=>Fm.UV(x,z)[1]<dep+1e-6?F:height(x,z),cheeks:[[mid-stairHalf,-1,cheek],[mid+stairHalf,1,cheek]],footApron:.8,uStep:.4,...(id===CARNEGIE_ID?{grid:terrain}:{})});
    const c=[];for(let k=0;k<cols;k++){const u=mid-half+1.4+(2*half-2.8)*k/(cols-1),[x,z]=Fm.W(u,dep-1.4);c.push({x,z,u});prism(circle(x,z,.4,8),F-.05,F+6.6);}
    fronts.push({id,kind,face:f,mid,half,dep,g:F,lo,floor:F,treads:[],pad:{top:F,lo},flight:fl.name,cols:c,top:F+6.6});return fl;};
  {const f=facesOf(CARNEGIE_ID).filter(q=>q.n[1]>.9&&q.length>15).sort((a,b)=>b.length-a.length)[0];
    if(f)entry(CARNEGIE_ID,f,{half:6.2,dep:2.8,stairHalf:5.0,cheek:.6,kind:'portico',cols:4});}
  {const f=facesOf(ATENEO_ID).filter(q=>q.n[1]>.9&&q.length>8).sort((a,b)=>b.length-a.length)[0];
    if(f)entry(ATENEO_ID,f,{half:2.3,dep:1.5,stairHalf:2.3,cheek:.4,kind:'steps'});}
  // ---- Door sills: the drawn doorsteps of Casa de España, Casa Olímpica and Medicina Tropical were
  // drawn-only (a rider drove through 14 / 3 / 1 cm). They are now solid support blocks fitted to the entrance ground,
  // with the builder drawing exactly these numbers (level top at the highest ground along the door's ±2–3 m, bottom 5 cm
  // under the lowest ground of the footprint). ----
  const sills=[];
  {const g3=(F,u0,u1)=>{let lo=Infinity,hi=-Infinity;for(let u=u0;u<=u1+1e-6;u+=Math.max(.3,(u1-u0)/5)){const y=height(...F.W(Math.max(0,Math.min(F.L,u)),.3));lo=Math.min(lo,y);hi=Math.max(hi,y);}return [lo,hi];};
    const add=(id,sel,du,w)=>{const sh=shellOfEarly(id);if(!sh)return;const f=faceList(sh.outer).filter(sel).sort((a,c)=>c.length-a.length)[0];if(!f)return;
      const Fm={...faceFrame(f),L:f.length},u=f.length/2,[,y0]=g3(Fm,u-du,u+du);let lo=Infinity;
      for(let k=0;k<=6;k++)for(const d of [0,.45,.9]){const uu=u-(w+.9)/2+(w+.9)*k/6;lo=Math.min(lo,height(...Fm.W(uu,d)));}
      lo=Math.min(lo,y0-.12)-.05;const ring=Fm.rect(u-(w+.9)/2,u+(w+.9)/2,0,.9);prism(ring,lo,y0,true);sills.push({id,face:f,u,w,y0,lo,ring});};
    add(ESPANA_ID,q=>q.n[1]>.9,2,2.8);add(OLIMPICA_ID,q=>q.n[1]>.9&&q.length>18,2,2.2);add(TROPICAL_ID,q=>q.n[1]<-.8,3,2.4);}

  // ---- Public spaces: the mapped plaza rings, single owner after every earlier owner's surfaces/floors, minus the running
  // strips of streets (left to the city-wide streets owner), buildings and the closed flights. ----
  const earlierRings=[...earlier.flatMap(a=>[...(a.surfaces??[]),...(a.brick??[])].map(q=>q.ring)),
    ...earlier.flatMap(a=>(a.floorTriangles??[]).map(t=>t.map(p=>[p[0],p[2]]))).filter(r=>Math.abs(signedArea(r))>1e-4)];
  const plazaBoxes=[...PLAZAS.map(([id])=>roadById.get(id)?.points).filter(Boolean).map(bounds),bounds(HOLOCAUST)];
  const runningPieces=city.roads.filter(r=>RUNNING.has(r.kind)&&plazaBoxes.some(b=>overlapB(bounds(r.points),b,r.width))).flatMap(r=>{
    const pts=r.points.filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.05);return pts.length>1?ribbon(pts,-r.width/2,r.width/2):[];}).map(p=>({p,b:bounds(p)}));
  const massPieces=city.buildings.filter(b=>b.outer.some(p=>p[0]>EC_BOUNDS.minX-20)).flatMap(b=>convexPieces((buildingOverrides.get(b.id)?.outer)??b.outer)).map(p=>({p,b:bounds(p)}));
  const done=[];
  const keep=(pieces,owner,kind)=>{const bx=bounds(pieces.flat());
    const block=[...earlierRings.filter(r=>overlapB(bounds(r),bx,.5)),...runningPieces.filter(o=>overlapB(o.b,bx,.5)).map(o=>o.p),
      ...massPieces.filter(o=>overlapB(o.b,bx,.5)).map(o=>o.p),...stairRects.filter(r=>overlapB(bounds(r),bx,.5)),...done.filter(d=>overlapB(bounds(d),bx,.5))];
    pieces=minus(pieces,block).filter(r=>r.every(p=>dry(p[0],p[1]))&&Math.abs(signedArea(r))>.05);
    for(const ring of pieces)surfaces.push({kind,ring,owner:'eastcivic:'+owner});done.push(...pieces);};
  // Bautista: only the terrace landward of the parapet (the bank beyond belongs to the coast owner).
  const parapetSea=(()=>{const p=PARAPET,far=p.map(q=>[q[0],q[1]-40]).reverse();return [[p[0][0]-6,p[0][1]],...p,[p.at(-1)[0]+8,p.at(-1)[1]],[p.at(-1)[0]+8,-290],[p[0][0]-6,-290]];})();
  for(const [id,kind] of PLAZAS){const r=roadById.get(id);if(!r)continue;let ring=r.points.slice(0,-1);
    if(Math.hypot(r.points[0][0]-r.points.at(-1)[0],r.points[0][1]-r.points.at(-1)[1])>.01)continue;
    let pieces;try{pieces=convexPieces(ccw(ring));}catch{continue;}
    if(id===256662600)pieces=minus(pieces,convexPieces(ccw(parapetSea)).map(ccw));
    keep(pieces,id,kind);}
  {let pieces;try{pieces=convexPieces(ccw(HOLOCAUST));}catch{pieces=[];}keep(pieces,295176729,'morro');}
  // Garden east of Los Leones (1061,−46): its footways were left to the city-wide paving, which only paves whole
  // 2 m terrain cells between this area's lawn tint, so the slabs met the grass in stair steps. The garden now has one
  // author: the mapped footways as smooth 2.3 m paths, a 3.4 m verge behind the Paseo Covadonga sidewalk (5.4–8.8 m off its
  // centreline: the sidewalk itself stays with the streets owner), lawn tint on every other garden vertex (below).
  const garden=gardenOf(roadById);
  if(garden){const R=convexPieces(ccw(garden.ring)).map(ccw),clip=ps=>ps.flatMap(p=>R.map(r=>clipConvex(p,r))).filter(p=>p.length>=3&&Math.abs(signedArea(p))>.05);
    // Piece by piece: a path's own ribbon pieces overlap at sharp bends and loop closures; each subtracts the ones before.
    // The blockers (as keep) are gathered once for the garden's bounds (layout time).
    const gb=bounds(garden.ring),near=r=>overlapB(bounds(r),gb,1),gd=[];
    const block=[...earlierRings.filter(near),...runningPieces.filter(o=>overlapB(o.b,gb,1)).map(o=>o.p),...massPieces.filter(o=>overlapB(o.b,gb,1)).map(o=>o.p),
      ...stairRects.filter(near),...done.filter(near)].map(r=>({r,b:bounds(r)}));
    const put=(p,owner)=>{const pb=bounds(p);for(const q of minus([p],[...block,...gd].filter(o=>overlapB(o.b,pb,.05)).map(o=>o.r)))
      if(q.every(v=>dry(v[0],v[1]))&&Math.abs(signedArea(q))>.05){surfaces.push({kind:'morro',ring:q,owner:'eastcivic:'+owner});done.push(q);gd.push({r:q,b:bounds(q)});}};
    for(const p of clip(ribbon(garden.covadonga,GARDEN.verge[0],GARDEN.verge[1]).map(ccw)))put(p,'garden-verge');
    // a path piece on a bank steeper than 1:2 is left as lawn (a pale slab on the slope read as one with
    // the sidewalk); the mapped steps keep theirs.
    const steep=r=>{const hs=r.map(v=>height(v[0],v[1])),b=bounds(r);return (Math.max(...hs)-Math.min(...hs))/Math.max(.5,Math.hypot(b[1]-b[0],b[3]-b[2]))>GARDEN.steep;};
    for(const line of garden.paths)for(const p of clip(ribbon(line,-GARDEN.path,GARDEN.path).map(ccw)))if(line.id===GARDEN.steps||!steep(p))put(p,'garden-path');}

  // ---- Plaza de los Leones exedra (OECH District 1: semicircular exedra, lions on its balustrade): a balustrade along the
  // curved edge shared with Plaza del Maestro (≈2 m higher), open at both ends, and two lion pedestals at its ends (I). ----
  const exedra={rail:[],lions:[]};
  {const r=roadById.get(509430867);if(r){const arc=r.points.slice(2,13),lens=arc.slice(1).map((q,i)=>Math.hypot(q[0]-arc[i][0],q[1]-arc[i][1])),tot=lens.reduce((a,b)=>a+b,0);
    const at=d=>{let acc=0;for(let i=0;i<lens.length;i++){if(d<=acc+lens[i])return lerp(arc[i],arc[i+1],(d-acc)/lens[i]);acc+=lens[i];}return arc.at(-1);};
    const s0=tot*.16,s1=tot*.84,n=Math.ceil((s1-s0)/3.2),pts=Array.from({length:n+1},(_,k)=>at(s0+(s1-s0)*k/n));
    for(let k=0;k<n;k++){const a=pts[k],b=pts[k+1];exedra.rail.push({a,b});balustrade(a,b,height(...a),height(...b),.95);}
    for(const p of [pts[0],pts.at(-1)]){const ring=circle(p[0],p[1],.8,8),g=highOn(ring,.4),lo=lowOn(ring)-.12;exedra.lions.push({x:p[0],z:p[1],g,lo,top:g+1.1});prism(ring,lo,g+1.1+1.0);}}}
  // ---- Parapet of the San Juan Bautista overlook (indicative line biased to the level terrace): coping 1.0 m
  // over the terrace, continuous wheel-stopping base, ends turned shoreward. ----
  const parapet=[];
  for(let i=0;i+1<PARAPET.length;i++){const a=PARAPET[i],b=PARAPET[i+1],[ux,uz]=unit(a,b),nl=[-uz,ux];// nl points landward (south, +z)
    const land=t=>{const p=lerp(a,b,t);let m=-Infinity;for(const d of [.5,1,1.5])m=Math.max(m,height(p[0]+nl[0]*d,p[1]+nl[1]*d));return m;};
    const ta=land(0),tb=land(1),w=.18,ring=ccw([[a[0]-nl[0]*w,a[1]-nl[1]*w],[b[0]-nl[0]*w,b[1]-nl[1]*w],[b[0]+nl[0]*w,b[1]+nl[1]*w],[a[0]+nl[0]*w,a[1]+nl[1]*w]]);
    const lo=lowOn(ring)-.25;parapet.push({a,b,ta,tb,lo,nl});prism(ring,lo,Math.max(ta,tb)+1.0);}
  // Beach-stair guard (458601935, closed): a short balustrade at its head.
  // ---- the public beach stair 458601935 (Playa Peña; inventory item 4: sanjuanpuertorico.com, plateapr.com).
  // Three legs on the mapped switchback, fitted to the cut slope with js/sj-stairs.js: A (gate → first turn, two flights
  // and a mid landing), B (back seaward under A), C (to the beach). Level turn pads (convex, drawn = physical support
  // prisms) with walls on every free edge (parapet 1 m over the pad, or the bank's retaining face where the ground is
  // higher), cheek walls on both sides of every flight. The foot is the mapped dry beach (DEM 1.2–1.6, wet line ~0.6 m
  // about 2.5–3.5 m further seaward), reached over a fitted foot apron. The corridor stays private for placement and
  // recovery (no rider is ever placed on the stair); the gate stands open, its leaves swung back onto the plaza. ----
  const BS=(()=>{const r=roadById.get(458601935);if(!r)return null;const P=r.points;
    const segFrame=(A,B)=>{const [ex,ez]=unit(A,B),ux=-ez,uz=ex,Wf=(u,v)=>[A[0]+ex*v+ux*u,A[1]+ez*v+uz*u];
      return {W:Wf,UV:(x,z)=>[(x-A[0])*ux+(z-A[1])*uz,(x-A[0])*ex+(z-A[1])*ez],rect:(u0,u1,v0,v1)=>ccw([Wf(u0,v0),Wf(u1,v0),Wf(u1,v1),Wf(u0,v1)]),ry:Math.atan2(-uz,ux),L:Math.hypot(B[0]-A[0],B[1]-A[1])};};
    // (look): two legs fitted into the bank instead of three legs round tall fill platforms. Leg A runs down the
    // top edge on the mapped line (the ground falls 10.1 → 6.9 m along it), one level turn pad sits on grade (cut and
    // fill balanced), leg B goes straight down the face (the ground falls ~0.45 m/m, as the flight) to the sand.
    // 1.5 m treads; plain sides: a low stone cheek (10 cm over the flight line, or 5 cm over the ground where the stair is
    // cut in) with a coping and a slim iron handrail (I: the references describe "stairs" / "short stairs/path" off the
    // plaza; none shows the stair's build, so the form is kept plain).
    const HW=.75,CW=.3,P0=P[0],P1=P[1],FA=segFrame(P0,P1);
    const V0=1.0,yTop=Math.max(...[-1,-.5,0,.5,1].map(u=>height(...FA.W(u,0))));
    const vA=10.0,vB=vA+2.4,PL=vB-vA+HW+CW,BR=8.5;
    const out={flights:[],pads:[],walls:[],guards:[]};
    // Level pad over the terrain (replaces it; render cut where the bank stands above the pad's level).
    const padTops=(ring,y)=>{{const bb=bounds(ring);cuts.push({minX:bb[0],maxX:bb[1],minZ:bb[2],maxZ:bb[3],kind:'eastcivic-beach-pad',planes:[...convexPlanes(ring),[0,1,0,-(y-.25)]]});}
      for(let i=1;i+1<ring.length;i++){const t=[[ring[0][0],y,ring[0][1]],[ring[i][0],y,ring[i][1]],[ring[i+1][0],y,ring[i+1][1]]];
        tops.push({poly:t.map(p=>({x:p[0],z:p[2]})),top:y,plane:plane(t),replacesTerrain:true,maxReferenceY:y+4,surface:'pavement',source:'eastcivic:beach-pad'});}};
    const padRing=FA.rect(-HW-CW,HW+CW,vA,vA+PL);
    let pmin=Infinity,pmax=-Infinity;for(let u=-HW-CW;u<=HW+CW+1e-9;u+=.25)for(let v=vA;v<=vA+PL+1e-9;v+=.25){const g=height(...FA.W(u,v));pmin=Math.min(pmin,g);pmax=Math.max(pmax,g);}
    // A little more cut than fill: leg B leaves the pad where the face falls fastest (keeps its seaward cheek ≤ 1.5 m).
    const y1=Math.round(((pmin+pmax)/2-.26)*100)/100;
    // Leg A: head at the gate (the plaza's level, 1 m fitted apron), one flight to the pad.
    const nA=Math.ceil((yTop-y1)/.17);
    const a=flight('beach-a',{frame:FA,u0:-HW,u1:HW,vf:vA,vt:V0,yf:y1,yt:yTop,n:nA,ground:(x,z)=>FA.UV(x,z)[1]>vA-1e-6?y1:height(x,z),cheeks:[],topApron:V0,topReach:V0,uStep:.4,grid:terrain});
    // Leg B: from the pad's seaward edge straight down the face; foot on the dry upper beach over a fitted apron (sand).
    const FB=segFrame(FA.W(-HW-CW,vB),FA.W(-HW-CW-BR-4,vB)),yBeach=height(...FB.W(0,BR+1.2)),nB=Math.ceil((y1-yBeach)/.17);
    const b=flight('beach-b',{frame:FB,u0:-HW,u1:HW,vf:BR,vt:0,yf:yBeach,yt:y1,n:nB,ground:(x,z)=>FB.UV(x,z)[1]<1e-6?y1:height(x,z),cheeks:[],footApron:1.2,uStep:.4,grid:terrain});
    out.flights.push(a,b);
    prism(padRing,lowOn(padRing)-.3,y1,true);stairRects.push(padRing);padTops(padRing,y1);out.pads.push({ring:padRing,y:y1,kind:'turn-1'});
    // Side guards: a band (u from uIn to uOut in frame F) from va to vb over a walking line. Stone top = max(line + .10,
    // outside ground + .05); a handrail 0.95 m over the line wherever the stone stands less than 0.6 m over it. Drawn as one
    // continuous wall; physical as 0.6 m pieces topped at the lower of their two ends (never above the drawn wall/rail).
    const guard=(F,uIn,uOut,va,vb,line,name)=>{const L=Math.abs(vb-va),k=Math.max(1,Math.ceil(L/.6)),so=Math.sign(uOut-uIn),S=[];
      for(let i=0;i<=k;i++){const v=va+(vb-va)*i/k,ln=line(v),gOut=Math.max(height(...F.W(uOut,v)),height(...F.W(uOut+so*.25,v)),height(...F.W((uIn+uOut)/2,v)));
        const gLow=Math.min(height(...F.W(uOut,v)),height(...F.W(uOut+so*.6,v)),height(...F.W(uIn,v)),ln);
        const stone=Math.max(ln+.1,gOut+.05),rail=stone<ln+.6?ln+.95:null;S.push({v,ln,stone,rail,lo:gLow-.3});}
      for(let i=0;i<k;i++){const A_=S[i],B_=S[i+1],ring=F.rect(Math.min(uIn,uOut),Math.max(uIn,uOut),Math.min(A_.v,B_.v),Math.max(A_.v,B_.v));
        const top=Math.min(A_.rail??A_.stone,B_.rail??B_.stone,Math.max(A_.stone,B_.stone)+.95);prism(ring,Math.min(lowOn(ring),A_.lo,B_.lo)-.1,Math.max(top,Math.min(A_.stone,B_.stone)));}
      const g={name,W:F.W,uIn,uOut,S};out.guards.push(g);return g;};
    const lineA=v=>v<=V0?yTop:v>=vA?y1:yTop+(y1-yTop)*(v-V0)/(vA-V0),lineB=v=>v<=0?y1:v>=BR?yBeach:y1+(yBeach-y1)*v/BR;
    for(const [ui,uo] of [[HW,HW+CW],[-HW,-HW-CW]])guard(FA,ui,uo,.25,vA,lineA,'a');
    for(const [ui,uo] of [[HW,HW+CW],[-HW,-HW-CW]])guard(FB,ui,uo,0,BR,lineB,'b');
    // Pad edges: landward side and the far end full length, the seaward side either side of leg B.
    guard(FA,HW,HW+CW,vA,vA+PL,()=>y1,'pad');
    {const E=segFrame(FA.W(-HW-CW,vA+PL),FA.W(HW+CW,vA+PL));guard(E,.3,0,0,2*(HW+CW)-CW,()=>y1,'pad');}
    guard(FA,-HW,-HW-CW,vA,vB-HW-CW,()=>y1,'pad');
    // The turn: a ~1.2 m arc from the landward side of the pad round into leg B (route waypoints for the tests).
    out.turns=[[FA.W(.3,vA+1.0),FA.W(.1,vA+1.9),FA.W(-.4,vB-.05),FA.W(-1.0,vB)]];
    // Gate: piers on the stair's sides (clear opening = the 1.5 m treads), wall stubs to the gate line's ends, two leaves
    // (each half the opening, the earlier gate's bars) swung 180° back onto the plaza flat against the stubs.
    const [g0,g1]=BEACH_GUARD,gL=Math.hypot(g1[0]-g0[0],g1[1]-g0[1]),[gx,gz]=unit(g0,g1),g=Math.max(height(...g0),height(...g1)),pc=P0;
    const tc=(pc[0]-g0[0])*gx+(pc[1]-g0[1])*gz,piers=[tc-HW-.35,tc+HW+.35].map(t=>[g0[0]+gx*t,g0[1]+gz*t]),gate={a:g0,b:g1,L:gL,g,piers,stubs:[],leaves:[],dir:[gx,gz]};
    // Stubs: wall from each pier to the gate line's end, 1.1 m over the stair head, stepped up with the grass rising to the
    // line's south end (two pieces, each 0.35 m over its highest ground); piers 1.8 m over the head (the piers and
    // stubs had been sized from the line's highest end, 3 m / 2.3 m over the head).
    const stubRing=(t0,t1)=>{const a_=[g0[0]+gx*t0,g0[1]+gz*t0],bq=[g0[0]+gx*t1,g0[1]+gz*t1],w=.2;return {a:a_,b:bq,r:ccw([[a_[0]-gz*w,a_[1]+gx*w],[bq[0]-gz*w,bq[1]+gx*w],[bq[0]+gz*w,bq[1]-gx*w],[a_[0]+gz*w,a_[1]-gx*w]])};};
    const stubTop=r=>Math.round(Math.max(yTop+1.14,highOn(r,.25)+.35)*100)/100;   // 4 cm over the overlook parapet it meets (no shared plane)
    for(const [ta,tb] of [[0,tc-HW-.6],[tc+HW+.6,gL]])if(tb-ta>.2){const tm=(ta+tb)/2,A_=stubRing(ta,tm),B_=stubRing(tm,tb),tA=stubTop(A_.r),tB=stubTop(B_.r);
      // One piece unless the halves differ by ≥ 5 cm (coplanar guard: equal copings would overlap on one plane).
      const parts=Math.abs(tA-tB)<.05?[[stubRing(ta,tb),Math.max(tA,tB)]]:[[A_,tA],[B_,tB]];
      for(const [S_,top] of parts){const lo=lowOn(S_.r)-.18;   // (-.15 shared a bottom plane with the overlook parapet)
       prism(S_.r,lo,top);gate.stubs.push({a:S_.a,b:S_.b,lo,top});}}
    gate.top=Math.max(yTop+1.8,...gate.stubs.map(q=>q.top+.2));
    for(const p of piers){const r=ccw(circle(p[0],p[1],.3,4));prism(r,lowOn(r)-.15,gate.top);}
    const e0=FA.W(0,1),back=[P0[0]-e0[0],P0[1]-e0[1]],side=(back[0]*-gz+back[1]*gx)>0?1:-1;   // plaza side of the gate line
    for(const [t0,sg] of [[tc-HW-.6,-1],[tc+HW+.6,1]]){const off=.29*side,hinge=[g0[0]+gx*t0-gz*off,g0[1]+gz*t0+gx*off],tip=[hinge[0]+gx*sg*HW,hinge[1]+gz*sg*HW],w=.03;
      const r=ccw([[hinge[0]-gz*w,hinge[1]+gx*w],[tip[0]-gz*w,tip[1]+gx*w],[tip[0]+gz*w,tip[1]-gx*w],[hinge[0]+gz*w,hinge[1]-gx*w]]);
      prism(r,yTop-.05,yTop+1.6);gate.leaves.push({a:hinge,b:tip,y0:yTop,top:yTop+1.6});}
    out.gate=gate;out.levels={yTop,y1,yBeach};return out;})();
  const beachGate=BS?.gate??null;


  // ---- Monuments: fitted pedestals (DEM minimum −0.12 to a level top) and figures; solid to the figure's head. ----
  const monuments=[];
  for(const m of MONUMENTS){if(!dry(m.x,m.z))continue;const face=m.face?Math.atan2(m.face[0],m.face[1]):0;
    const spec={stele:{w:2.6,d:1.6,ped:.55,fig:3.4},statue:{w:1.5,d:1.5,ped:1.7,fig:2.2},wall:{w:6.0,d:.7,ped:.0,fig:1.25},plaque:{w:.9,d:.5,ped:0,fig:.95},
      bust:{w:.7,d:.7,ped:1.35,fig:.75},bautista:{w:2.2,d:2.2,ped:2.0,fig:2.5},abstract:{w:1.6,d:1.6,ped:.45,fig:2.4}}[m.kind];
    const c=Math.cos(face),sn=Math.sin(face),ring=ccw([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[m.x+(c*a*spec.w/2+sn*b*spec.d/2),m.z+(-sn*a*spec.w/2+c*b*spec.d/2)]));
    const g=highOn(ring,.25),lo=lowOn(ring)-.12,top=g+.12+spec.ped;
    monuments.push({...m,heading:face,spec,ring,g,lo,top,head:top+spec.fig});
    // Collision follows the visible profile: the pedestal block to its cap, then the narrower upper part.
    const rect=(w,d)=>ccw([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[m.x+(c*a*w/2+sn*b*d/2),m.z+(-sn*a*w/2+c*b*d/2)]));
    if(spec.ped>0)prism(ring,lo,top);
    if(m.kind==='statue'||m.kind==='bautista')prism(circle(m.x,m.z,.3*spec.fig/1.75+.12,10),top-.05,top+spec.fig);
    else if(m.kind==='bust')prism(circle(m.x,m.z,.28,8),top-.05,top+spec.fig);
    else if(m.kind==='stele')prism(rect(1.1,.55),top-.05,top+spec.fig+.24);
    else if(m.kind==='abstract')prism(rect(.9,.9),top-.05,top+spec.fig);
    else prism(ring,lo,top+spec.fig);
    if(m.kind==='wall')prism(rect(1.3,.9),lo,top+2.6);}
  // Bounded paved bays round the strip's free-standing memorials: a 3.4 m pad each, single owner.
  for(const m of monuments.filter(q=>['abstract','plaque','wall','statue','bust'].includes(q.kind)&&q.x>1080||q.id===4694086268)){
    const r=m.kind==='wall'?4.6:3.4;let pieces;try{pieces=convexPieces(ccw(circle(m.x,m.z,r,16)));}catch{continue;}keep(pieces,'pad-'+m.id,'morro');m.pad=r;}
  // Holocaust memorial group: three figures of different height, posture and turn on a low bed, two title
  // panels; each solid to its visible profile.
  const holocaust={figures:[[-1.8,.6,2.5,'bowed',.5],[0,-.6,2.9,'stand',-.2],[1.7,.4,1.6,'child',.9]].map(([dx,dz,h,pose,rot])=>{const x=1144+dx,z=-65+dz,y=height(x,z);
      prism(circle(x,z,.32*h/1.75+.1,8),y-.15,y+h);return {x,z,y,h,pose,rot};}),
    panels:[-4.2,4.2].map(dx=>{const x=1144+dx,z=-62.5,y=height(x,z),r=ccw([[x-.7,z-.08],[x+.7,z-.08],[x+.7,z+.08],[x-.7,z+.08]]);prism(r,lowOn(r)-.1,y+1.6);return {x,z,y};})};
  const flagpoles=FLAGPOLES.filter(p=>dry(...p)).map(([x,z])=>{const y=height(x,z);prism(circle(x,z,.42,8),y-.15,y+.6);prism(circle(x,z,.12,6),y+.5,y+11);return {x,z,y,h:11};});

  // ---- Dressing: royal palms flanking both Capitol axes and along the Paseo lawns, shade trees in the memorial strip,
  // lamp posts and benches on the plazas. Every item on dry public ground, clear of running strips, masses, flights. ----
  // Closed area outlines (plazas) are not running strips: their interiors take dressing.
  const isRing=r=>r.points.length>3&&Math.hypot(r.points[0][0]-r.points.at(-1)[0],r.points[0][1]-r.points.at(-1)[1])<.01;
  const roadsNear=city.roads.filter(r=>r.kind!=='steps'&&!isRing(r)&&r.points.some(p=>p[0]>EC_BOUNDS.minX-20));
  const segs=roadsNear.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,h:r.width/2}))),segAt=gridIndex(segs,q=>[Math.min(q.a[0],q.b[0])-q.h,Math.max(q.a[0],q.b[0])+q.h,Math.min(q.a[1],q.b[1])-q.h,Math.max(q.a[1],q.b[1])+q.h]);
  const onRoad=(x,z,m)=>segAt(x-m,x+m,z-m,z+m).some(q=>segmentDistance(x,z,q.a,q.b)<q.h+m);
  const massAt=gridIndex(massPieces,o=>o.b);
  const inMass=(x,z,m=0)=>massAt(x-m,x+m,z-m,z+m).some(o=>x>=o.b[0]-m&&x<=o.b[1]+m&&z>=o.b[2]-m&&z<=o.b[3]+m&&(inRing(x,z,o.p)||m>0&&o.p.some((a,i)=>segmentDistance(x,z,a,o.p[(i+1)%o.p.length])<m)));
  const isPrivate=(x,z,m=0)=>[...stairRects,...stairApproach].some(r=>inRing(x,z,r)||m>0&&r.some((a,i)=>segmentDistance(x,z,a,r[(i+1)%r.length])<m));
  const occupied=[...monuments.map(o=>({x:o.x,z:o.z,r:Math.max(o.spec.w,o.spec.d,o.pad??0)})),...holocaust.figures.map(f=>({x:f.x,z:f.z,r:1.2})),...flagpoles.map(f=>({x:f.x,z:f.z,r:.6})),...exedra.lions.map(l=>({x:l.x,z:l.z,r:1.0}))];
  const steep=(x,z)=>Math.hypot(height(x+.6,z)-height(x-.6,z),height(x,z+.6)-height(x,z-.6))/1.2;
  const earlierList=earlier.flatMap(a=>[...(a.surfaces??[]),...(a.brick??[])]).map(q=>({ring:q.ring,b:bounds(q.ring)})).filter(q=>q.b[1]>EC_BOUNDS.minX-30);
  const earlierIdx=gridIndex(earlierList,q=>q.b,16);
  const earlierAt=(x,z,m)=>earlierIdx(x-m,x+m,z-m,z+m).some(q=>x>=q.b[0]-m&&x<=q.b[1]+m&&z>=q.b[2]-m&&z<=q.b[3]+m&&inRing(x,z,q.ring));
  const free=(x,z,r)=>dry(x,z)&&!onRoad(x,z,r)&&!inMass(x,z,r+.3)&&!isPrivate(x,z,r+.3)&&!inReserve(x,z,4)&&!earlierAt(x,z,r)
    &&!parapet.some(p=>segmentDistance(x,z,p.a,p.b)<r+.6)&&!balustrades.some(p=>segmentDistance(x,z,p.a,p.b)<r+.4)&&!occupied.some(o=>Math.hypot(o.x-x,o.z-z)<r+(o.r??.5));
  const palms=[],trees=[],lamps=[],benches=[];
  // trunks stand on the lowest ground under their trunk footprint (was the centre).
  const trunkLow=(x,z,r)=>{let m=height(x,z);for(let k=0;k<12;k++){const a=k*Math.PI/6;m=Math.min(m,height(x+Math.cos(a)*r,z+Math.sin(a)*r));}return m;};
  const addPalm=(x,z)=>{if(!free(x,z,.9)||steep(x,z)>.35)return false;const y=trunkLow(x,z,.25);palms.push({x,z,y,yaw:hash(Math.round(x*10),Math.round(z*10),3)*Math.PI*2});occupied.push({x,z,r:.9});
    prism(circle(x,z,.26,8),y-.15,y+3.6);return true;};
  const addTree=(x,z,sc=1,extra={})=>{if(!free(x,z,1.3)||steep(x,z)>.4)return false;const y=trunkLow(x,z,.32*sc);trees.push({x,z,y,scale:sc,...extra});occupied.push({x,z,r:1.6});
    prism(circle(x,z,.34*sc,10),y-.1,y+3.5);return true;};
  // Capitol south lawns: palm rows parallel to the axis, two each side (I; reference street views show palms on the
  // Constitución lawns, exact census not surveyed).
  for(const du of [-26,-20,20,26])for(let v=31;v<=56;v+=6.5){const [x,z]=W(CAP.uc+du,v);addPalm(x,z);}
  // North: Plaza de la Democracia edges (keep the statue's sea view open: nothing north of Muñoz Rivera on the axis).
  for(const du of [-19,-14,14,19])for(const v of [-38,-46,-54,-62]){const [x,z]=W(CAP.uc+du,v);addPalm(x,z);}
  // Paseo de los Presidentes lawns and the memorial strip: shade trees every ~16 m on lawn cells; palms by the plazas.
  for(let x=880;x<=1290;x+=8)for(const z of [-44,-50,-56,-62]){const {x0,z0,step,nx}=terrain,k=Math.round((z-z0)/step)*nx+Math.round((x-x0)/step);
    if(surface[k]!==2||hash(x,z|0,7)>.32)continue;if(hash(x,z|0,8)<.45)addPalm(x+hash(x,z|0,9)*2-1,z);else addTree(x,z,.9+hash(x,z|0,10)*.25);}
  // The one mapped tree (4988687963).
  const mapped=city.trees.filter(([x,z])=>x>EC_BOUNDS.minX&&z>EC_BOUNDS.minZ&&z<EC_BOUNDS.maxZ&&x<EC_BOUNDS.maxX);
  for(const [x,z] of mapped){const y=trunkLow(x,z,.32);trees.push({x,z,y,scale:1,mapped:true});prism(circle(x,z,.34,10),y-.1,y+3.5);}
  // Lamps: pale-based posts along the forecourt rings and plaza edges.
  const addLamp=(x,z)=>{if(!free(x,z,.5))return;const y=height(x,z);lamps.push({x,z,y,base:true});occupied.push({x,z,r:.5});prism(circle(x,z,.32,8),y-.1,y+4.5);};
  // Along each plaza outline every ~14 m, 1.3 m inside the ring.
  const lampAlong=(id,every)=>{const r=roadById.get(id);if(!r||!isRing(r))return;const ring=r.points.slice(0,-1);let acc=0;
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],Ls=Math.hypot(b[0]-a[0],b[1]-a[1]),n=outward(ring,i);
      for(let t=(every-acc%every)%every;t<Ls;t+=every){const p=lerp(a,b,t/Ls);addLamp(p[0]-n[0]*1.3,p[1]-n[1]*1.3);}acc+=Ls;}};
  // Keep both Capitol axes clear of posts (the photographed axial views).
  {const add=addLamp;const axisClear=(x,z)=>{const [u,v]=UV(x,z);return Math.abs(u-CAP.uc)<15&&(v>20&&v<60||v<-20&&v>-70);};
    for(const id of [458602060,458601936,509430859,509430853,509430862,509430846]){const r=roadById.get(id);if(!r||!isRing(r))continue;const ring=r.points.slice(0,-1);let acc=0;
      for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],Ls=Math.hypot(b[0]-a[0],b[1]-a[1]),nn=outward(ring,i);
        for(let t=(14-acc%14)%14;t<Ls;t+=14){const p=lerp(a,b,t/Ls),x=p[0]-nn[0]*1.3,z=p[1]-nn[1]*1.3;if(!axisClear(x,z))add(x,z);}acc+=Ls;}}}
  void lampAlong;
  // Bautista: lamps 1.1 m landward of the parapet every ~13 m.
  for(let i=0;i+1<PARAPET.length;i++){const a=PARAPET[i],b=PARAPET[i+1],[ux,uz]=unit(a,b),Ls=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let t=4;t<Ls-2;t+=13)addLamp(a[0]+ux*t-uz*1.1,a[1]+uz*t+ux*1.1);}
  // Benches on the plazas facing their monuments / the sea.
  const benchAt=(x,z,heading)=>{const c=Math.cos(heading),sn=Math.sin(heading),all=[-.72,.72].flatMap(u=>[-.25,.25].map(d=>height(x+c*u+sn*d,z-sn*u+c*d)));
    if(Math.max(...all)-Math.min(...all)>.22)return null;for(const u of [-1.1,0,1.1])for(const d of [-.4,.4])if(!free(x+c*u+sn*d,z-sn*u+c*d,.3))return null;
    const legs=[-.72,.72].map(u=>({u,ground:Math.min(...[-.25,.25].map(d=>height(x+c*u+sn*d,z-sn*u+c*d)))}));
    const b={x,z,y:Math.max(...all),legs,heading,width:1.9,depth:.6,height:.95};benches.push(b);occupied.push({x,z,r:1.2});
    const r=[[-1,-.32],[1,-.32],[1,.32],[-1,.32]].map(([u,d])=>[x+c*u+sn*d,z-sn*u+c*d]);prism(r,Math.min(...legs.map(l=>l.ground))-.1,b.y+.95);return b;};
  for(const m of monuments.filter(q=>['statue','stele','bautista'].includes(q.kind))){for(const a of [0,2.4,-2.4]){const h=m.heading+Math.PI+a*.5,d=m.kind==='bautista'?6:5;
    const x=m.x+Math.sin(m.heading+a*.5)*d,z=m.z+Math.cos(m.heading+a*.5)*d;benchAt(x,z,Math.atan2(m.x-x,m.z-z));void h;}}
  for(const t of [.25,.45,.6,.8]){const p=lerp(PARAPET[2],PARAPET.at(-2),t),x=p[0],z=p[1]+4.2;benchAt(x,z,Math.PI);}

  // ---- Ground tone: lawns in two/three tones, dry grass and pale earth on the open slopes, rock on scarps, dark scrub and
  // wood in their mapped polygons. Earlier owners keep their vertices; fort reserves, roads and shore cells are skipped. ----
  {const {x0,z0,step,nx,nz,heights:hh}=terrain,taken=k=>earlier.some(a=>a.tint?.has(k));
    const i0=Math.max(1,Math.floor((EC_BOUNDS.minX-x0)/step)),i1=Math.min(nx-2,Math.ceil((EC_BOUNDS.maxX-x0)/step));
    const j0=Math.max(1,Math.floor((EC_BOUNDS.minZ-z0)/step)),j1=Math.min(nz-2,Math.ceil((EC_BOUNDS.maxZ-z0)/step));
    const cls=new Map();rasterRing(LOMA,terrain,cls,4);for(const p of SCRUB)rasterRing(p,terrain,cls,3);rasterRing(WOOD,terrain,cls,2);for(const q of surfaces)rasterRing(q.ring,terrain,cls,1);
    // Coarse road mask for this box (cheap): cells within half width + 1 m of any road or footway.
    const roadCell=new Uint8Array((i1-i0+1)*(j1-j0+1));
    for(const r of city.roads){if(!r.points.some(p=>p[0]>EC_BOUNDS.minX-10))continue;const m=(r.width??2)/2+1;
      for(let q=0;q+1<r.points.length;q++){const a=r.points[q],b=r.points[q+1],Ls=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(Ls/1));
        for(let k=0;k<=n;k++){const p=lerp(a,b,k/n);for(let di=-Math.ceil(m/step);di<=Math.ceil(m/step);di++)for(let dj=-Math.ceil(m/step);dj<=Math.ceil(m/step);dj++){
          const i=Math.round((p[0]-x0)/step)+di,j=Math.round((p[1]-z0)/step)+dj;if(i<i0||i>i1||j<j0||j>j1)continue;
          if(Math.hypot(x0+i*step-p[0],z0+j*step-p[1])<=m)roadCell[(j-j0)*(i1-i0+1)+(i-i0)]=1;}}}}
    // Garden: a vertex whose eight neighbours are all inside the garden ring takes lawn, footway buffer
    // or not (its paths are drawn above as surfaces); every cell it touches then lies inside the garden, so no other
    // owner's paving there is blocked. The garden's outermost vertex row keeps the general rules below.
    // Neighbours on this area's own plazas around it (Leones, Maestro, Mujer: drawn by this area, never by streets) count
    // as inside too.
    const gin=new Map(),gown=new Map();if(garden){rasterRing(garden.ring,terrain,gin,1);for(const id of GARDEN.plazas){const r=roadById.get(id);if(r)rasterRing(r.points,terrain,gown,1);}}
    // A plaza vertex next to the garden takes lawn too (hidden under the plaza, it keeps the bed colour up to the edge).
    const touch=k=>{for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)if(gin.has(k+dj*nx+di))return true;return false;};
    const inner=k=>{for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const q=k+dj*nx+di;if(!gin.has(q)&&!gown.has(q))return false;}return true;};
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*nx+i,x=x0+i*step,z=z0+j*step,lawnBed=(gin.has(k)||gown.has(k)&&touch(k))&&inner(k);
      if(taken(k)||inReserve(x,z,6)||roadCell[(j-j0)*(i1-i0+1)+(i-i0)]&&!lawnBed)continue;
      const y=hh[k];if(y<1.2||surface[k]===3)continue;
      // Shore guard: leave the last 6 m of land before nodata/water to the coast owner.
      let shore=false;for(const [di,dj] of [[3,0],[-3,0],[0,3],[0,-3]]){const kk=(j+dj)*nx+i+di;if(kk<0||kk>=hh.length||surface[kk]===3||hh[kk]<-3){shore=true;break;}}if(shore)continue;
      const g=Math.hypot(hh[k+1]-hh[k-1],hh[k+nx]-hh[k-nx])/(2*step),r=hash(i,j,21);
      let tone=null;
      const c=cls.get(k);
      if(lawnBed)tone=g>1.7?ROCK[(r*3)|0]:g>.9?DRY[(r*3)|0]:LAWN[(r*3)|0];  // planted garden banks stay green
      else if(c===1)tone=PAVE[r<.5?0:1];
      else if(c===2)tone=g>1.1?ROCK[(r*3)|0]:WOODT[r<.5?0:1];
      else if(c===3)tone=g>1.1?ROCK[(r*3)|0]:SCRUBT[r<.5?0:1];
      else if(g>1.0)tone=ROCK[(r*3)|0];
      else if(surface[k]===2)tone=g>.45?DRY[(r*3)|0]:LAWN[(r*3)|0];
      else if(surface[k]===0&&(g>.22&&z<-150||c===4))tone=g>.6?DRY[(r*3)|0]:(r<.5?DRY[0]:LAWN[2]);
      if(tone)tint.set(k,tone);}}

  // ---- Private: the overlook's seaward bank (checked placement, recovery and arrivals). The flights are public (open
  // flights round); building interiors are shells. ----
  registerStairFlights('eastcivic',stairRecords);
  const offLimitsAt=eastcivicAt(privateRects,OVERLOOK_SEA); // privateRects is empty since the open flights round

  // Map arrivals: pinned on public ground next to each place; findArrival snaps them to a road segment.
  const places=[{name:'El Capitolio',x:1149,z:-84.2,source:CAPITOL_ID},{name:'Plaza San Juan Bautista',x:1160,z:-219.2,source:256662600},
    {name:'Plaza de la Policía',x:996,z:-66,source:509430859}];

  // Effective shell of an owned building (the overrides applied), for the builder.
  const shellOf=id=>{const b=building(id),ov=buildingOverrides.get(id)??{};return b&&{id,outer:ov.outer??b.outer,holes:b.holes??[],base:ov.base??b.base,roof:ov.roof??b.roof};};
  const layout={colliders,tops,cuts,tint,surfaces,floorTriangles,places,buildingOverrides,offLimitsAt,ownedBuildings:[...OWNED],shellOf,
    frame:{O,e,s,W,UV},capOuter,service,exedra,flights,sills,beachGate,beachStair:BS,balustrades,bridge,northTerrace,stairRects,stairApproach,porticos,dome,fronts,parapet,monuments,flagpoles,palms,trees,lamps,benches,
    privateRects,holocaust,constants:{CAP,STYLE,OWNED}};
  layout.qa=()=>({surfaces:surfaces.length,kinds:Object.fromEntries(['panel','plaza','paseo','morro'].map(k=>[k,surfaces.filter(q=>q.kind===k).length])),
    colliders:colliders.length,tops:tops.length,cuts:cuts.length,flights:flights.map(f=>[f.name,f.treads.length]),
    serviceRows:service?.rows.length??0,monuments:monuments.length,palms:palms.length,trees:trees.length,lamps:lamps.length,benches:benches.length,
    balustrades:balustrades.length,parapet:parapet.length,tint:tint.size,fronts:fronts.length,owned:OWNED.length});
  return layout;
}
