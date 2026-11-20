/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Bahía Urbana and the south-east inlet — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// Area module (contract: header of sj-princesa-layout.js), registered after puntilla (before wallFoot).
// Eastern waterfront. View-only references (Wikimedia
// Commons): B1 Mapillary jmoliver 2024-02-11 07H46M05S889
// (terracotta square-paver plaza, grey concrete light pylons with lantern heads, steel railing, palms in round planters,
// white pergolas, hedges); B2 07H46M03S786 (grey-brown linear pavers, railing at the water, lawn and trees behind);
// B3 07H46M19S469 (raised square concrete planters with trees, brick-paver rings, concrete walks, trash bins); B4
// 07H46M20S336 (white obelisk, curved concrete wall, hedges, palms); B5 "Resilient Lady Feb 2025" (curved dark flat-bar
// railing posts, light handrail, horizontal rods, linear pavers with a pale band, the footbridge on concrete piers);
// B6 "Sea Owl in Puerto Rico" (unrailed working quay at the east end: concrete edge, dark apron, yellow bollard); B7
// Panoramio Puerta de Tierra 2014 (bronze sculpture on a stone plinth in a low basin, terracotta pavers).
// Mapped: park 256258027 (the single ground owner), cycleways 1550042461/271033260/271351143 "Paseo Bahía Urbana",
// footways 271351142/271351144/458529506–511/381416336/421337006/421337009/421338724/421341443/421341444, footbridge
// 271033262 (bridge=yes, concrete), service 421337008, parking 421338723 + aisle 421338725, fountain 458535315, water
// 421337002 + fountain node 4211120239, sand 421341442, monument node 8516392692 "Monumento SS El Faro", bicycle parking
// nodes 5667353444–448, park nodes 13361926773/771/772 (Muelle 6/7/8), Café Ocho 421337004, buildings 381416327/381416328.
// Inferred: widths, the promenade band, plaza extents, the peninsula link and spine paths, every furniture position, the
// sculpture/monument/obelisk forms, railing extents (main promenade, inlet, bridge and the south-west lawn edge) versus
// the unrailed east quay with bollards (B6), the bridge profile and piers.
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea,intersectRings} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {unit,bounds,ribbon,minus,overlapB} from './sj-city-wall.js';

// OSM 256258027 {"leisure":"park","name":"Bahía Urbana"} (closing node dropped).
export const PARK=[[1189.275,91.445],[1143.676,78.486],[1141.163,85.637],[1119.098,79.417],[1048.167,197.368],[1039.084,211.581],
  [1031.089,224.365],[978.498,221.302],[727.332,206.36],[722.04,206.127],[723.212,182.806],[723.856,180.725],[725.345,179.02],
  [726.676,178.5],[728.197,178.068],[730.891,177.714],[950.316,190.81],[1019.754,194.957],[1023.429,194.304],[1025.637,193.706],
  [1031.826,190.009],[1034.551,186.81],[1104.109,72.799],[1106.602,68.582],[1108.925,64.918],[1111.439,62.273],[1114.174,59.948],
  [1118.832,57.026],[1123.237,54.967],[1127.123,53.428],[1131.348,52.564],[1135.573,52.055],[1140.58,51.878],[1145.502,52.143],
  [1151.628,52.995],[1162.497,55.141],[1201.367,65.942],[1316.954,98.299],[1316.025,101.852],[1307.07,130.266],[1302.697,138.457],
  [1296.867,135.756],[1210.274,278.912],[1141.321,254.864],[1106.4,242.68],[1129.9,203.783],[1131.304,201.879],[1124.713,198.57]];
// OSM 271033262 {"bridge":"yes","highway":"footway","surface":"concrete"}, west → east across the inlet mouth.
export const BRIDGE=[[1039.1,211.6],[1083.3,207.8],[1129.9,203.8]];
// West neighbour (waterfront, Muelle 4) ends here: a straight north–south cut 1.5 m west of cycleway node 2759827444.
export const WEST_CUT=726.4;
// Convex pieces of PARK by vertex index (convexPieces(PARK) at authoring time; tests check they tile the ring exactly).
export const PARK_PIECES=[[1,2,3,22,23,24],[3,4,5],[3,5,6,21,22],[6,7,8,10,11,12,13,14,15,16,17],[8,9,10],[6,17,18],[6,18,19],[6,19,20],
  [6,20,21],[0,1,24,25,26,27,28,29,30,31,32,33,34,35,36,37],[47,0,37,38,39,41,46],[39,40,41],[41,42,43,44,45,46]];
export const POND=[[1131.8,227.2],[1134.9,235.9],[1125.9,239.1],[1123.5,239.0],[1122.1,237.7],[1120.8,235.7],[1120.4,233.5],[1121.2,231.3],[1123.5,230.1]];
export const SAND=[[1191.3,139.5],[1195.9,143.2],[1200.1,144.5],[1204.1,144.6],[1209.5,144.0],[1213.5,142.8],[1216.3,141.5],[1218.1,140.0],
  [1219.4,137.6],[1220.1,134.8],[1220.0,131.1],[1220.0,127.5],[1219.5,123.1],[1215.1,119.7],[1208.0,123.3],[1203.5,124.8],[1201.6,125.0]];
export const PARKING=[[1278.43,128.12],[1280.22,121.88],[1283.98,108.76],[1244.25,97.53],[1240.5,110.61],[1238.71,116.89]];
export const FOUNTAIN=[[937.3,208.7],[934.7,208.5],[935.0,201.7],[937.6,201.8]];
export const EL_FARO=[1023.73,212.47];
export const OWNED=[421337004,381416327,381416328];
// Running strips [way, half width, kind]: order = ownership priority. OSM: cycleways and the near-water walk are
// surface=concrete; 458529510/511 paving_stones. Widths inferred (1550042461 is tagged 3 m).
export const WAYS=[[1550042461,1.5,'morro'],[271033260,1.5,'morro'],[271351143,1.5,'morro'],[271351142,1.2,'morro'],
  [458529506,1.2,'morro'],[458529507,1.2,'morro'],[458529508,1.2,'morro'],[458529509,1.2,'morro'],[458529510,1.2,'terra'],
  [458529511,1.2,'terra'],[381416336,1.3,'morro'],[421337006,1.1,'morro'],[421337009,1.1,'morro'],[421338724,1.1,'morro'],
  [421341443,1.0,'morro'],[421341444,1.0,'morro'],[421337008,2.6,'asphalt'],[421338725,2.5,'asphalt']];
// Inferred links (no OSM way): bridge east landing → the curved park walk; the walk's north end → the cycleway.
export const LINKS=[['link',[[1131.6,204.6],[1146,207.4],[1162,212.6],[1180.4,217.3]],1.5,'morro'],
  ['spine',[[1184.1,152.2],[1189.2,140.6],[1189.8,118.5],[1203,96.5],[1212.2,76.2]],1.5,'morro']];
// Near-water walk 271351144: drawn by the promenade band, kept here for furniture clearance and the route tests.
export const PROMENADE_WALK=271351144;
export const DECK={half:2.0,rise:1.1,thick:.55,step:1.6,rail:1.85,flare:1.4,flareLen:6.4};
export const RAIL={height:1.08,inset:.6,spacing:1.6,search:[-3,6],walk:1.5};
export const BANK={width:1.1};   // the kept grass strip beyond the railing ends on the stone bank this far out
const MINE=new Set([...WAYS.map(w=>w[0]),PROMENADE_WALK,271033262]);
const CARRIAGEWAY=new Set(['primary','primary_link','secondary','secondary_link','tertiary','residential','service','unclassified','living_street']);
// Ground tones (vertex tints): lawn (B1/B2/B4 well-kept grass), the grey-brown promenade (B2/B5), terracotta plazas (B1/B7),
// sand (OSM 421341442), the dark working apron and parking asphalt at the east quay (B6).
export const TONES={lawn:['#6e9150','#76984f','#6a8b4c'],linear:['#8b857d','#857f77'],terra:['#9c6a5c','#a27060'],
  sand:['#d6c7a2','#cfbf98'],apron:['#6d6c67','#73726c'],asphalt:['#646968','#6a6f6e']};

export function hash(i,j,k=0){let h=Math.imul(i*73856093^j*19349663^k*83492791,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
const near=(pts,x,z)=>{let best={d:Infinity,i:0};for(let i=0;i+1<pts.length;i++){const d=segmentDistance(x,z,pts[i],pts[i+1]);if(d<best.d)best={d,i};}return best;};
const lengthOf=pts=>pts.slice(1).reduce((s,q,i)=>s+Math.hypot(q[0]-pts[i][0],q[1]-pts[i][1]),0);
function along(pts,s){let acc=0;for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(s<=acc+L||i+2===pts.length){const t=Math.max(0,Math.min(1,(s-acc)/(L||1))),[ux,uz]=unit(a,b);return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,ux,uz,nx:-uz,nz:ux};}
    acc+=L;}}
// Uniform grid of segments with a reach r each: near(x,z,m) ⇔ some segment lies within r+m (m ≤ 2.5).
function segGrid(items,cell=8){const g=new Map(),key=(i,j)=>i*100003+j;
  for(const it of items){const p=it.r+2.5,i0=Math.floor((Math.min(it.a[0],it.b[0])-p)/cell),i1=Math.floor((Math.max(it.a[0],it.b[0])+p)/cell),
      j0=Math.floor((Math.min(it.a[1],it.b[1])-p)/cell),j1=Math.floor((Math.max(it.a[1],it.b[1])+p)/cell);
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=key(i,j);let l=g.get(k);if(!l)g.set(k,l=[]);l.push(it);}}
  return (x,z,m=0)=>{const l=g.get(key(Math.floor(x/cell),Math.floor(z/cell)));if(l)for(const it of l)if(segmentDistance(x,z,it.a,it.b)<it.r+m)return true;return false;};}
const segsOf=(pts,r)=>pts.slice(1).map((b,i)=>({a:pts[i],b,r}));
const ccw=r=>signedArea(r)<0?[...r].reverse():r;
const quad=(a,b,c,d)=>ccw([a,b,c,d]);
const centroid=r=>r.reduce((s,p)=>[s[0]+p[0]/r.length,s[1]+p[1]/r.length],[0,0]);

export function createBahiaLayout({city,height,terrain,surface,land,isDry,areas={}}) {
  const colliders=[],tops=[],cuts=[],tint=new Map(),surfaces=[],floorTriangles=[],buildingOverrides=new Map();
  const {x0,z0,step,nx,nz}=terrain,dry=isDry??(()=>true);
  const footMin=(x,z,hx,hz=hx,ang=0)=>{const c=Math.cos(ang),s=Math.sin(ang);let m=Infinity;
    for(const [u,v] of [[0,0],[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[0,1],[-1,0],[1,0]]){const a=u*hx,b=v*hz;m=Math.min(m,height(x+c*a+s*b,z-s*a+c*b));}return m-.04;};
  // Ground span under a footprint (same 9 points) and a level-spot search (steep-footprint check): a
  // prop whose footprint spans more than `lim` moves to the flattest acceptable spot within `R` m (rings of ½ m), else stays.
  const spanAt=(x,z,hx,hz=hx,ang=0)=>{const c=Math.cos(ang),s=Math.sin(ang);let lo=Infinity,hi=-Infinity;
    for(const [u,v] of [[0,0],[-1,-1],[1,-1],[1,1],[-1,1],[0,-1],[0,1],[-1,0],[1,0]]){const a=u*hx,b=v*hz,h=height(x+c*a+s*b,z-s*a+c*b);lo=Math.min(lo,h);hi=Math.max(hi,h);}return hi-lo;};
  const levelSpot=(x,z,hx,hz,ang,lim,R,ok,dirs=null)=>{let best={x,z,sp:spanAt(x,z,hx,hz,ang)};if(best.sp<=lim)return best;
    for(let r=.5;r<=R+1e-9;r+=.5){const D=dirs??Array.from({length:Math.max(8,Math.round(r*8))},(_,k)=>{const t=2*Math.PI*k/Math.max(8,Math.round(r*8));return [Math.cos(t),Math.sin(t)];});
      for(const [dx,dz] of D){const X=x+dx*r,Z=z+dz*r;if(!ok(X,Z))continue;const sp=spanAt(X,Z,hx,hz,ang);if(sp<best.sp-.01)best={x:X,z:Z,sp};}
      if(best.sp<=lim)break;}
    return best;};
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:ccw(outer).map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  const earlier=Object.values(areas).filter(Boolean),roadById=new Map(city.roads.map(r=>[r.id,r]));
  const parkPieces=PARK_PIECES.map(r=>r.map(i=>PARK[i])).map(p=>({p,b:bounds(p)})),pb=bounds(PARK);
  const inPark=(x,z)=>x>=pb[0]&&x<=pb[1]&&z>=pb[2]&&z<=pb[3]&&inRing(x,z,PARK);
  const sign=Math.sign(signedArea(PARK));   // inward normal of edge a→b is sign·(−uz,ux)
  const cellDry=(i,j)=>i>=0&&j>=0&&i<nx-1&&j<nz-1&&(()=>{const k=j*nx+i;return !!(land[k]&&land[k+1]&&land[k+nx]&&land[k+nx+1]);})();

  // ---- Foreign carriageways (PR-1, Fernández Juncos and their links) keep their full ribbons: our ground stops 0.3 m off
  // their mapped edge (streets owns them). Footways/cycleways of other owners are not subtracted (later owners yield). ----
  const foreign=city.roads.filter(r=>!MINE.has(r.id)&&CARRIAGEWAY.has(r.kind)&&r.points.some(p=>p[0]>WEST_CUT-20&&p[0]<1345&&p[1]>30&&p[1]<300));
  const foreignPieces=foreign.flatMap(r=>ribbon(r.points,-(r.width/2+.3),r.width/2+.3)).map(p=>({p:ccw(p),b:bounds(p)}));
  const onForeign=segGrid(foreign.flatMap(r=>segsOf(r.points,r.width/2+.3)));
  const westOfCut=[[WEST_CUT-60,20],[WEST_CUT,20],[WEST_CUT,320],[WEST_CUT-60,320]];

  // ---- Owned buildings (no photo of any of them; simple modern exteriors, inferred): Café Ocho (bar) and two park
  // pavilions keep their mapped shells and generator heights. ----
  const building=id=>city.buildings.find(b=>b.id===id);
  const COL={421337004:{colour:'#ece6d8',roofColour:'#8e918d'},381416327:{colour:'#e2ddd2',roofColour:'#878a86'},381416328:{colour:'#dcd6c8',roofColour:'#878a86'}};
  for(const id of OWNED)if(building(id))buildingOverrides.set(id,COL[id]);
  const masses=city.buildings.filter(b=>b.outer.some(p=>p[0]>WEST_CUT-5&&p[0]<1345&&p[1]>40&&p[1]<290)).map(b=>({b,ring:b.outer,bb:bounds(b.outer)}));
  const inMass=(x,z,m=0)=>masses.some(o=>x>=o.bb[0]-m&&x<=o.bb[1]+m&&z>=o.bb[2]-m&&z<=o.bb[3]+m&&
    (inRing(x,z,o.ring)||m>0&&o.ring.some((a,i)=>segmentDistance(x,z,a,o.ring[(i+1)%o.ring.length])<m)));
  const ownedShells=OWNED.map(building).filter(Boolean).map(b=>({id:b.id,outer:b.outer,base:b.base,roof:b.roof}));
  // Café Ocho's terrace (B06/B11): the canopy on its longest face stands on three posts that are solid (prisms of
  // the drawn diameter); a terracotta hardstand runs under it (inferred), and the entry bay is the face's middle bay.
  const cafe=(()=>{const b=building(421337004);if(!b)return null;let f=null;
    for(let i=0;i<b.outer.length;i++){const a=b.outer[i],c=b.outer[(i+1)%b.outer.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]);if(!f||L>f.L)f={a,b:c,L};}
    const ux=(f.b[0]-f.a[0])/f.L,uz=(f.b[1]-f.a[1])/f.L;let n=[-uz,ux];const m=[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2];if(inRing(m[0]+n[0]*.2,m[1]+n[1]*.2,b.outer))n=[uz,-ux];
    const P=(u,d)=>[f.a[0]+ux*u+n[0]*d,f.a[1]+uz*u+n[1]*d],g=Math.min(height(...f.a),height(...f.b)),y=Math.max(g,b.base)+3.2;
    const posts=[.6,f.L/2,f.L-.6].map(u=>{const [x,z]=P(u,2.05);return {x,z,y:height(x,z)};});
    for(const q of posts)prism(circle(q.x,q.z,.09,8),q.y-.1,y);
    return {a:f.a,b:f.b,L:f.L,u:[ux,uz],n,y,posts,pad:quad(P(-.4,.15),P(f.L+.4,.15),P(f.L+.4,3.6),P(-.4,3.6))};})();

  // ---- Water-facing edges of the park ring. A run is railed (B5: main promenade, inlet, bridge; the south-west lawn edge is
  // inferred) or a working quay with bollards (B6: the east and south-east quay). The bridge landings leave gaps. ----
  const QUAY=new Set([39,40,41]);   // edges 39→40→41→42 (east quay, Muelle 8 side)
  //  south of z 160 the outer bank of edge 41 faces the park lawns, so it gets the inboard
  // railed promenade treatment; the working quay with bollards (B6) keeps the north-east stretch by Muelle 8.
  const QUAY41=160,q41=(()=>{const a=PARK[41],b=PARK[42],t=(QUAY41-a[1])/(b[1]-a[1]);return [a[0]+(b[0]-a[0])*t,QUAY41];})();
  const edgeInfo=PARK.map((a,i)=>{const b=PARK[(i+1)%PARK.length],[ux,uz]=unit(a,b),n=[sign*-uz,sign*ux],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    let wet=0,all=0;for(const f of [.2,.4,.6,.8])for(const o of [3,6]){all++;if(!dry(a[0]+(b[0]-a[0])*f-n[0]*o,a[1]+(b[1]-a[1])*f-n[1]*o))wet++;}
    return {i,a,b,u:[ux,uz],n,L,water:wet/all>=.5,quay:QUAY.has(i)};});
  // Railing stations: along each water edge every ~1.6 m, the mask edge found by marching inward from 3 m outside, then
  // RAIL.inset inland; the inset is the max over ±3 neighbours so the railing never stands on a sawtooth notch.
  const stations=[];
  for(const e of edgeInfo){if(!e.water||e.L<.5)continue;const k=Math.max(1,Math.round(e.L/RAIL.spacing));
    for(let s=0;s<=k;s++){const t=s/k,p=[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t];let edge=null;
      for(let d=RAIL.search[0];d<=RAIL.search[1];d+=.25){let ok=true;
        for(const dd of [0,.25,.5,.75])for(const w of [-.35,.35]){const x=p[0]+e.n[0]*(d+dd)+e.u[0]*w,z=p[1]+e.n[1]*(d+dd)+e.u[1]*w;if(!dry(x,z)){ok=false;break;}}
        if(ok){edge=d;break;}}
      stations.push({edge:e.i,s,k,p,n:e.n,u:e.u,d:edge,quay:e.quay&&!(e.i===41&&p[1]>=QUAY41)});}}
  const stGrid=new Map();for(const st of stations)if(st.d!==null){const k=Math.floor(st.p[0]/7)*10007+Math.floor(st.p[1]/7);let l=stGrid.get(k);if(!l)stGrid.set(k,l=[]);l.push(st);}
  const insetAt=(x,z)=>{let m=0;const i0=Math.floor(x/7),j0=Math.floor(z/7);for(let i=i0-1;i<=i0+1;i++)for(let j=j0-1;j<=j0+1;j++)for(const st of stGrid.get(i*10007+j)??[])
    if(Math.hypot(st.p[0]-x,st.p[1]-z)<7)m=Math.max(m,st.d);return m;};
  for(let i=0;i<stations.length;i++){const st=stations[i];if(st.d===null){st.inset=null;continue;}let m=-Infinity;
    for(let j=Math.max(0,i-3);j<=Math.min(stations.length-1,i+3);j++){const o=stations[j];if(Math.abs(o.edge-st.edge)>1&&!(o.edge===0&&st.edge===PARK.length-1)&&!(st.edge===0&&o.edge===PARK.length-1))continue;
      if(Math.hypot(o.p[0]-st.p[0],o.p[1]-st.p[1])>6)continue;if(o.d!==null)m=Math.max(m,o.d);}
    m=Math.max(m,insetAt(...st.p));st.dmax=m;st.inset=m+RAIL.inset;st.x=st.p[0]+st.n[0]*st.inset;st.z=st.p[1]+st.n[1]*st.inset;}
  // The mapped near-water walk 271351144 runs within ~1 m of the land-mask edge in places (a rider turning
  // at node (856.2,210.8) pinned on the rail). Keep the rail ≥1.5 m off the walk line: step it out toward the water, at most
  // to 0.1 m inside the neighbourhood's deepest mask edge (a rail past the edge left a water strip landward of it).
  {const wl=roadById.get(PROMENADE_WALK)?.points??[],dw=(x,z)=>wl.length?Math.min(...wl.slice(1).map((b,i)=>segmentDistance(x,z,wl[i],b))):Infinity;
    for(const st of stations){if(st.inset===null||st.quay)continue;let t=st.inset;
      while(dw(st.p[0]+st.n[0]*t,st.p[1]+st.n[1]*t)<RAIL.walk&&t>st.dmax+.2)t-=.05;
      st.inset=t;st.x=st.p[0]+st.n[0]*t;st.z=st.p[1]+st.n[1]*t;}}

  // ---- Footbridge 271033262 (B5: concrete deck on piers, railings both sides). Landings where a 4.4 m cross-section first
  // stands fully dry; the first deck row takes the exact ground there, then a gentle arch (rise 1.1 m) over the water. ----
  // The mapped ends stand 3 m out in the water (west) and 12 m inland (east) of the land mask: the line is extended 12 m at
  // both ends, the water span found along it, and each landing is the last fully dry cross-section before the water.
  const bL=lengthOf(BRIDGE),bAt=s=>{const e0=along(BRIDGE,0),e1=along(BRIDGE,bL);
      if(s<0)return {...e0,x:e0.x+e0.ux*s,z:e0.z+e0.uz*s};if(s>bL)return {...e1,x:e1.x+e1.ux*(s-bL),z:e1.z+e1.uz*(s-bL)};return along(BRIDGE,s);},
    crossDry=s=>{const p=bAt(s);for(const v of [-2.2,-1.1,0,1.1,2.2])if(!dry(p.x+p.nx*v,p.z+p.nz*v))return false;return true;};
  let sA=-12;while(sA<bL&&dry(bAt(sA).x,bAt(sA).z))sA+=.25;while(sA>-12&&!crossDry(sA))sA-=.25;
  let sB=bL+12;while(sB>0&&dry(bAt(sB).x,bAt(sB).z))sB-=.25;while(sB<bL+12&&!crossDry(sB))sB+=.25;
  // the deck flares from 2.0 to 3.4 m half width over its last 6.4 m at each end (a chamfered entry, so a
  // diagonal approach finds the opening instead of the rail's nose), and returns close the shore railing onto the deck rail
  // ends. Landing rows take the exact ground where dry; interior rows stand 4 cm over the highest ground within 1.6 m (B14).
  const halfAt=s=>DECK.half+DECK.flare*Math.max(0,1-Math.min(s-sA,sB-s)/DECK.flareLen);
  const groundOver=(x,z)=>{let m=-Infinity;for(const [dx,dz] of [[0,0],[.8,0],[-.8,0],[0,.8],[0,-.8],[1.6,0],[-1.6,0],[0,1.6],[0,-1.6],[1.1,1.1],[-1.1,1.1],[1.1,-1.1],[-1.1,-1.1]])if(dry(x+dx,z+dz))m=Math.max(m,height(x+dx,z+dz));return m;};
  const deckRows=[];{const n=Math.max(2,Math.round((sB-sA)/DECK.step));const yA=height(bAt(sA).x,bAt(sA).z),yB=height(bAt(sB).x,bAt(sB).z);
    for(let r=0;r<=n;r++){const t=r/n,s=sA+(sB-sA)*t,p=bAt(s),hw=halfAt(s),base=yA+(yB-yA)*t+DECK.rise*Math.sin(Math.PI*t);
      const row=[-1,-.5,0,.5,1].map(v=>{const x=p.x+p.nx*v*hw,z=p.z+p.nz*v*hw;
        let y=(r===0||r===n)&&dry(x,z)?height(x,z):base;
        if(r>0&&r<n){const g=groundOver(x,z);if(Number.isFinite(g))y=Math.max(y,g+.04);}return [x,y,z];});
      deckRows.push({s,p,row,hw});}}
  const deckTriangles=[];
  for(let r=0;r+1<deckRows.length;r++){const A=deckRows[r].row,B=deckRows[r+1].row;
    for(let i=0;i+1<A.length;i++)for(const tri of [[A[i],B[i+1],B[i]],[A[i],A[i+1],B[i+1]]]){
      const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
      const nx_=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz_=ux*vy-uy*vx;const t=ny<0?[p,w,q]:tri;deckTriangles.push(t);
      tops.push({poly:t.map(v=>({x:v[0],z:v[2]})),top:Math.max(p[1],q[1],w[1]),plane:{x:p[0],y:p[1],z:p[2],dx:-nx_/ny,dz:-nz_/ny},surface:'pavement',source:'bahia:bridge'});}}
  const deckFoot=deckRows.length?ccw([...deckRows.map(r=>[r.row[0][0],r.row[0][2]]),...[...deckRows].reverse().map(r=>[r.row[4][0],r.row[4][2]])]):[];
  const deckPieces=deckFoot.length?convexPieces(deckFoot):[];
  const landings=deckRows.length?[deckRows[0],deckRows.at(-1)].map(r=>({x:r.p.x,z:r.p.z,y:r.row[2][1],hw:r.hw})):[];
  // Deck railings (B5): 0.15 m inside each (flared) edge; a solid thin prism per bay from below the deck to 1.1 m over it.
  const deckRails=[];
  for(const sd of [-1,1])for(let r=0;r<deckRows.length;r++){const {p,row,hw}=deckRows[r],o=hw-.15,v=o/hw,
      x=p.x+p.nx*sd*o,z=p.z+p.nz*sd*o,y=row[2][1]+(row[sd<0?0:4][1]-row[2][1])*v;deckRails.push({side:sd,r,x,z,y});}
  const railPrism=(a,b)=>{const [ux,uz]=unit([a.x,a.z],[b.x,b.z]),h=.06,r=[[a.x-uz*h,a.z+ux*h],[b.x-uz*h,b.z+ux*h],[b.x+uz*h,b.z-ux*h],[a.x+uz*h,a.z-ux*h]];
    // Over land the prism reaches into the ground; over water it hangs from the deck edge.
    prism(r,Math.min(a.y,b.y)-.6,Math.max(a.y,b.y)+RAIL.height+.02);};
  for(const sd of [-1,1]){const list=deckRails.filter(q=>q.side===sd);for(let i=0;i+1<list.length;i++)railPrism(list[i],list[i+1]);}
  // Piers every ~13 m over the water (visual; unreachable), a pair of round columns under a cross beam.
  const piers=[];{const n=Math.max(1,Math.round((sB-sA)/13));for(let k=1;k<n;k++){const s=sA+(sB-sA)*k/n,p=bAt(s);
      const r=deckRows.reduce((b,q)=>Math.abs(q.s-s)<Math.abs(b.s-s)?q:b);if(dry(p.x,p.z))continue;piers.push({x:p.x,z:p.z,nx:p.nx,nz:p.nz,ux:p.ux,uz:p.uz,y:r.row[2][1]-DECK.thick});}}
  // Shore railing gaps at the landings (flared half width + 1.6 m), closed by the returns below.
  const nearLanding=(x,z,m=0)=>landings.some(l=>Math.hypot(x-l.x,z-l.z)<l.hw+1.6+m);
  for(const st of stations)if(st.inset!==null&&nearLanding(st.x,st.z))st.gap=true;

  // ---- Running surfaces: single-owner convex pieces, after every earlier owner, outside foreign carriageways, the deck,
  // the masses, the pond/fountain and west of the cut; dry cells only (row runs of dry cells clip a piece that touches the
  // water, so the paving reaches the land-mask edge exactly and never drapes over the sea). ----
  const earlierRings=[...earlier.flatMap(a=>[...(a.surfaces??[]),...(a.brick??[])].map(s=>s.ring)),
    ...earlier.flatMap(a=>(a.floorTriangles??[]).map(t=>t.map(p=>[p[0],p[2]]))),...earlier.flatMap(a=>(a.tops??[]).map(t=>t.poly.map(p=>[p.x,p.z])))]
    .filter(r=>Math.abs(signedArea(r))>1e-4).map(r=>({p:ccw(r),b:bounds(r)}));
  const solidRings=[...masses.flatMap(o=>convexPieces(o.ring)),...convexPieces(POND),ccw(FOUNTAIN.map((p,i,a)=>{const c=centroid(a);return [c[0]+(p[0]-c[0])*1.25,c[1]+(p[1]-c[1])*1.25];}))]
    .map(p=>({p:ccw(p),b:bounds(p)}));
  const done=[];
  const dryRows=piece=>{const [bx0,bx1,bz0,bz1]=bounds(piece),i0=Math.floor((bx0-x0)/step),i1=Math.floor((bx1-x0)/step),j0=Math.floor((bz0-z0)/step),j1=Math.floor((bz1-z0)/step);
    let all=true;for(let j=j0;j<=j1&&all;j++)for(let i=i0;i<=i1;i++)if(!cellDry(i,j)){all=false;break;}
    if(all)return [piece];const out=[];
    for(let j=j0;j<=j1;j++){let i=i0;while(i<=i1){if(!cellDry(i,j)){i++;continue;}let e=i;while(e+1<=i1&&cellDry(e+1,j))e++;
        const r=[[x0+i*step,z0+j*step],[x0+(e+1)*step,z0+j*step],[x0+(e+1)*step,z0+(j+1)*step],[x0+i*step,z0+(j+1)*step]];
        const q=intersectRings(piece,r);if(q.length>=3&&Math.abs(signedArea(q))>.01)out.push(ccw(q));i=e+1;}}
    return out;};
  const clipPark=pieces=>pieces.flatMap(p=>{const b=bounds(p);return parkPieces.filter(q=>overlapB(q.b,b,.01)).map(q=>intersectRings(p,q.p))
    .filter(q=>q.length>=3&&Math.abs(signedArea(q))>.01).map(ccw);});
  const keep=(pieces,owner,kind,{park=true}={})=>{pieces=pieces.map(ccw);if(park)pieces=clipPark(pieces);if(!pieces.length)return [];
    const bx=bounds(pieces.flat()),sel=list=>list.filter(o=>overlapB(o.b,bx,.5)).map(o=>o.p);
    const fixed=[ccw(westOfCut),...sel(earlierRings),...sel(foreignPieces),...sel(solidRings),...deckPieces.map(ccw)],out=[];
    // One piece at a time against everything already owned, including this call's earlier pieces (offset ribbons overlap
    // themselves at concave corners).
    for(const piece of pieces){const pbx=bounds(piece);const kept=minus([piece],[...fixed.filter(r=>overlapB(bounds(r),pbx,.01)),...done.filter(d=>overlapB(d.b,pbx,.01)).map(d=>d.p)]);
      for(const k of kept){done.push({p:k,b:bounds(k)});for(const r of dryRows(k))if(r.length>=3&&Math.abs(signedArea(r))>.01){out.push(r);
        // Perf: the park's own paver kinds are drawn in two sectors (x 1045), each its own culled mesh in sj-plaza.js.
        const sk=(kind==='linear'||kind==='terra')&&centroid(r)[0]>=1045?kind+'E':kind;surfaces.push({kind:sk,ring:r,owner:'bahia:'+owner});}}}
    return out;};
  const lineOf=id=>{const r=roadById.get(id);return r?r.points.filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.05):null;};
  // 271351142's last bend crossed the west deck rail; it now turns onto the bridge axis 5 m before the landing.
  // 421338724's bend ran into the south-west railing kink; it is refitted 1.5–2 m landward (inferred line).
  const REFIT={271351142:pts=>{const l=landings[0],p=deckRows[0]?.p;return l?[pts[0],pts[1],[l.x-p.ux*5,l.z-p.uz*5],[l.x,l.z]]:pts;},
    421338724:()=>[[1163.2,248.3],[1158.6,255.2],[1142.9,250.4]]};
  const strips=[];for(const [id,half,kind] of WAYS){let pts=lineOf(id);if(!pts)continue;if(REFIT[id])pts=REFIT[id](pts);strips.push({id,points:pts,half,kind,name:roadById.get(id).name,refit:!!REFIT[id]});}
  // The link starts on the bridge's east landing (the deck's own end row).
  for(const [id,pts,half,kind] of LINKS)strips.push({id,points:id==='link'&&landings[1]?[[landings[1].x,landings[1].z],...pts.slice(1)]:pts,half,kind,inferred:true});
  const walk=lineOf(PROMENADE_WALK);
  const nearStrip=segGrid([...strips.flatMap(s=>segsOf(s.points,s.half)),...(walk?segsOf(walk,1.5):[])]);
  // Rails keep ≥0.9 m off every running strip's edge (B05), stepping out no further than 0.1 m inside their own mask edge, and none
  // stand west of the cut (that corner is the waterfront's).
  for(const st of stations){if(st.inset===null||st.quay)continue;let t=st.inset;
    while(nearStrip(st.p[0]+st.n[0]*t,st.p[1]+st.n[1]*t,.9)&&t>st.dmax+.2)t-=.05;
    st.inset=t;st.x=st.p[0]+st.n[0]*t;st.z=st.p[1]+st.n[1]*t;if(st.x<WEST_CUT+.3)st.gap=true;}
  const cyc=lineOf(1550042461);
  // Plazas (B1/B7: terracotta square pavers around the sculpture fountain; inferred extents at the Muelle 6 node and the
  // El Faro monument by the bridge landing), from the cycleway's south edge to 3 m past the water edge.
  const southZ=x=>{const e=[PARK[8],PARK[7],PARK[6]];for(let i=0;i+1<e.length;i++)if(x>=e[i][0]&&x<=e[i+1][0])return e[i][1]+(e[i+1][1]-e[i][1])*(x-e[i][0])/(e[i+1][0]-e[i][0]);return e.at(-1)[1];};
  const cycZ=x=>{for(let i=0;i+1<cyc.length;i++){const a=cyc[i],b=cyc[i+1];if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&Math.abs(b[0]-a[0])>.5)return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return cyc.at(-1)[1];};
  const plazaRect=(xa,xb)=>quad([xa,cycZ(xa)+1.5],[xb,cycZ(xb)+1.5],[xb,southZ(xb)+3],[xa,southZ(xa)+3]);
  const PLAZAS=[{name:'Muelle 6',x:[866,898],ring:plazaRect(866,898)},{name:'fountain',x:[912,960],ring:plazaRect(912,960)},
    {name:'El Faro',x:[1003,1036],ring:ccw([[1003,cycZ(1003)+1.5],[1024.5,202.1],[1037.5,209.2],[1040.5,214],[1034,228],[1003,southZ(1003)+3]])}];
  if(cafe){const b=bounds(cafe.pad);PLAZAS.push({name:'cafe',x:[b[0],b[1]],ring:cafe.pad});}
  for(const p of PLAZAS)p.pieces=keep(convexPieces(p.ring),'plaza-'+p.name,'terra',{park:false});
  // Running strips: the three cycleways first (the long route has priority at junctions); the promenade band next, so the
  // short connectors stop at its edge instead of spilling across it; then the other walks and the inferred links.
  const CYCLE=new Set([1550042461,271033260,271351143]);
  for(const s of strips)if(CYCLE.has(s.id))keep(ribbon(s.points,-s.half,s.half),s.id,s.kind);
  // Promenade band (B2/B5 grey-brown linear pavers): from 3 m outside each railed water edge to 8 m inside on the main
  // promenade (edges 5–7), 4.5 m elsewhere; clipped to dry cells, so it ends exactly on the land mask.
  //  every band and railing ends on short straight lines (8 m pieces) inland of the deepest land-mask notch
  // within 7 m, so no grid shore edge's seaward probe touches our ground and the coast package draws the whole edge line.
  const bandRuns=[];{let cur=null;for(const e of edgeInfo){const W=e.i>=5&&e.i<=7?8:4.5;
      if(e.water&&!e.quay&&e.L>.3){if(cur&&cur.W===W&&cur.last===e.i-1){cur.pts.push(e.b);cur.last=e.i;}else{cur={W,pts:[e.a,e.b],last:e.i};bandRuns.push(cur);}}else cur=null;}}
  bandRuns.push({W:4.5,pts:[q41,PARK[42]],last:-1});
  // pale concrete cross bands, 0.6 m wide every 24 m across the promenade, owned before the pavers.
  for(const run of bandRuns){const L=lengthOf(run.pts);for(let t=12;t<L-2;t+=24){const p=along(run.pts,t),o=[insetAt(p.x,p.z)+.25,run.W].map(v=>v*sign);
      const P=(du,v)=>[p.x+p.ux*du+p.nx*v,p.z+p.uz*du+p.nz*v];keep([quad(P(-.3,o[0]),P(.3,o[0]),P(.3,o[1]),P(-.3,o[1]))],'band-cross','morro',{park:false});}}
  const bandPieces=[];for(const run of bandRuns){const L=lengthOf(run.pts),n8=Math.max(1,Math.round(L/8));
    const cum=[0];for(let i=1;i<run.pts.length;i++)cum.push(cum[i-1]+Math.hypot(run.pts[i][0]-run.pts[i-1][0],run.pts[i][1]-run.pts[i-1][1]));
    for(let k=0;k<n8;k++){const s0=L*k/n8,s1=L*(k+1)/n8,a0=along(run.pts,s0),a1=along(run.pts,s1),pts=[[a0.x,a0.z],...run.pts.filter((q,i)=>cum[i]>s0+.01&&cum[i]<s1-.01),[a1.x,a1.z]];
      const m=along(run.pts,(s0+s1)/2),c=insetAt(m.x,m.z)+.25,lo=sign>0?c:-run.W,hi=sign>0?run.W:-c;if(run.W>c+.3)bandPieces.push(...ribbon(pts,lo,hi));}
    keep(bandPieces.splice(0),'band','linear',{park:false});}
  // a pale concrete threshold band along the open east quay, 1.4 m in from the land-mask edge.
  // Merge round: the band now runs on a straight line per quay edge, 0.4–1.8 m inland of that edge's deepest land-mask
  // notch, so nothing of ours touches the grid shore and the coast package draws the quay bulkhead and coping there.
  const quayInset=new Map();for(const e of edgeInfo.filter(e=>e.quay)){const ds=stations.filter(s=>s.edge===e.i&&s.d!==null).map(s=>s.d);quayInset.set(e.i,ds.length?Math.max(...ds):0);}
  // Edges 39/40 are short (9 m, 6 m) corner jogs: no band there (their offset ribbons stuck out at the corner).
  {const q=[];for(const e of edgeInfo.filter(e=>e.quay&&e.water&&e.L>12)){const d=quayInset.get(e.i),lo=sign>0?d+.4:-(d+1.8),hi=sign>0?d+1.8:-(d+.4);q.push(...ribbon([e.a,e.i===41?q41:e.b],lo,hi));}keep(q,'quay-band','morro');}
  for(const s of strips)if(!CYCLE.has(s.id))keep(ribbon(s.points,-s.half,s.half),s.id,s.kind);
  // West tie (B07): linear pavers fill the corner between the cut line x = 726.4, the cycleway's north–south leg and
  // the water, so the waterfront's promenade meets paving on a straight line through node 2759827444 with no unpaved strip.
  keep([quad([WEST_CUT,197.5],[732.5,197.5],[732.5,203.85],[WEST_CUT,203.85])],'west-tie','linear',{park:false});   // ends 0.15 m inside the z 204 shore
  // Obelisk (B4, inferred position at the cycleway fork): a small terracotta ring.
  // the obelisk stands in a paved room (r 5.5) backed by a low hedge and a curved cream seat wall.
  const OBELISK=[1221.5,91.0];keep(convexPieces(ccw(circle(OBELISK[0],OBELISK[1],5.5,20))),'obelisk','terra');
  // two shaded park rooms on the peninsula lawns (terracotta pads r 4.2 with a pergola and benches, inferred),
  // and a paved apron ring round the pond (B10); the central lawn of the round park stays open.
  const rooms=[[1236,224],[1262,176],[1150,232]].map(([x,z])=>({x,z,r:4.2})).filter(r=>circle(r.x,r.z,r.r+.6,12).every(p=>inPark(...p)&&dry(...p)&&!inMass(...p,.5)&&!inRing(...p,POND))&&!nearStrip(r.x,r.z,r.r+.3));
  for(const r of rooms)keep(convexPieces(ccw(circle(r.x,r.z,r.r,20))),'room','terra');
  {const c=centroid(POND),ring=ccw(POND.map(p=>{const dx=p[0]-c[0],dz=p[1]-c[1],l=Math.hypot(dx,dz);return [p[0]+dx/l*1.8,p[1]+dz/l*1.8];}));keep(convexPieces(ring),'pond-apron','terra');}
  const inBand=segGrid(bandRuns.flatMap(r=>segsOf(r.pts,r.W+.2)),12);

  // ---- Ground tones (earlier owners keep their vertices). Every dry vertex in the park (or the band past the edge),
  // off the foreign carriageways and east of the cut: lawn, promenade, terracotta, sand, the dark east apron, parking. ----
  {const box=[WEST_CUT,1345,40,290],taken=k=>earlier.some(a=>a.tint?.has(k)),quayEdges=edgeInfo.filter(e=>e.quay).map(e=>e.i===41?{...e,b:q41}:e);
    const pzb=PLAZAS.map(p=>bounds(p.ring));const inPlaza=(x,z)=>PLAZAS.some((p,i)=>x>=pzb[i][0]-.5&&x<=pzb[i][1]+.5&&z>=pzb[i][2]-.5&&z<=pzb[i][3]+.5&&inRing(x,z,p.ring))||Math.hypot(x-OBELISK[0],z-OBELISK[1])<5.6||rooms.some(r=>Math.hypot(x-r.x,z-r.z)<r.r+.1);
    for(let j=Math.max(0,Math.floor((box[2]-z0)/step));j<=Math.min(nz-1,Math.ceil((box[3]-z0)/step));j++)
      for(let i=Math.max(0,Math.floor((box[0]-x0)/step));i<=Math.min(nx-1,Math.ceil((box[1]-x0)/step));i++){
        const x=x0+i*step,z=z0+j*step,k=j*nx+i;if(x<WEST_CUT+.01||taken(k))continue;
        const park=inPark(x,z),band=!park&&inBand(x,z);if(!park&&!band)continue;
        // a vertex of a dry cell (the terrain draws cells, not vertices)
        // Polish: any land vertex, so the coast package's seaward fill (drawn with the land vertices' own colours) continues
        // the paver tone beyond the railings instead of a green strip.
        if(!(cellDry(i,j)||cellDry(i-1,j)||cellDry(i,j-1)||cellDry(i-1,j-1))&&!(band||inBand(x,z))||!land[k])continue;
        if(onForeign(x,z,.6))continue;const v=hash(i,j,27)<.5?0:1;
        // Paving tones only where the vertex and its four grid neighbours share the zone, so the vertex-colour blend happens
        // under the paving and never smears onto the lawn beside it (a red halo round the obelisk ring).
        const whole=f=>f(x,z)&&f(x+step,z)&&f(x-step,z)&&f(x,z+step)&&f(x,z-step);
        if(whole(inPlaza))tint.set(k,TONES.terra[v]);
        else if(x>1230&&x<1292&&z>90&&z<136&&whole((a,b)=>inRing(a,b,PARKING)))tint.set(k,TONES.asphalt[v]);
        else if(band||whole((a,b)=>inBand(a,b,-1.2)))tint.set(k,TONES.linear[v]);
        else if(x>1190&&x<1221&&z>119&&z<146&&inRing(x,z,SAND))tint.set(k,TONES.sand[v]);
        else if(quayEdges.some(e=>segmentDistance(x,z,e.a,e.b)<8))tint.set(k,TONES.apron[v]);
        else tint.set(k,TONES.lawn[hash(i,j,31)<.34?0:hash(i,j,31)<.67?1:2]);}}

  // ---- Furniture. Everything stands on dry public ground, clear of every running strip and the near-water walk. ----
  const lamps=[],benches=[],palms=[],trees=[],planters=[],pergolas=[],canopies=[],bollards=[],racks=[],shrubs=[];
  const point=[];   // clearance list {x,z,r}
  const free=(x,z,r,m=r)=>x>WEST_CUT+1&&!nearStrip(x,z,m)&&!inMass(x,z,r)&&dry(x,z)&&!onForeign(x,z,r)&&!nearLanding(x,z,r+1)&&
    (inPark(x,z)||inBand(x,z))&&!inRing(x,z,POND)&&Math.hypot(x-936.2,z-205.2)>4.5+r&&!point.some(o=>Math.hypot(o.x-x,o.z-z)<r+o.r)&&
    !stations.some(s=>s.inset!==null&&Math.hypot(s.x-x,s.z-z)<r+.4);
  const claim=(x,z,r)=>point.push({x,z,r});if(cafe)for(const q of cafe.posts)claim(q.x,q.z,.5);
  // Light pylons (B1: grey concrete shafts with a framed lantern head; B3: a slimmer lattice variant on the peninsula and
  // north band) every ~24 m along the inner edge of the promenade band, and along the peninsula walks.
  for(const run of bandRuns){const L=lengthOf(run.pts);for(let s=8;s<L-4;s+=24){const p=along(run.pts,s),o=run.W-.9;
      const ang=Math.atan2(-p.uz,p.ux),q=levelSpot(p.x+p.nx*sign*o,p.z+p.nz*sign*o,.31,.24,ang,.12,4,(X,Z)=>free(X,Z,.5),[[p.ux??0,p.uz??0],[-(p.ux??0),-(p.uz??0)]]),{x,z}=q;
      if(!free(x,z,.5))continue;lamps.push({x,z,y:height(x,z),kind:'pylon',ang});claim(x,z,.5);}}
  for(const id of [381416336,'spine','link',271351143]){const s=strips.find(q=>q.id===id);if(!s)continue;const L=lengthOf(s.points);
    for(let t=6;t<L-3;t+=22){const p=along(s.points,t);for(const sd of [1,-1]){const o=s.half+1.1,x=p.x+p.nx*sd*o,z=p.z+p.nz*sd*o;
        if(free(x,z,.45)){const ang=Math.atan2(-p.uz,p.ux),q=levelSpot(x,z,.22,.22,ang,.12,4,(X,Z)=>free(X,Z,.45)&&Math.abs((X-p.x)*p.nx+(Z-p.z)*p.nz-sd*o)<.35,[[p.ux,p.uz],[-p.ux,-p.uz]]);
          lamps.push({x:q.x,z:q.z,y:height(q.x,q.z),kind:'lattice',ang});claim(q.x,q.z,.45);break;}}}}
  // Benches (inferred placement; B1 shows seating on the promenade): facing the water between the pylons.
  const benchAt=(x,z,heading)=>{const c=Math.cos(heading),s=Math.sin(heading),legs=[-.72,.72].map(u=>({u,ground:Math.min(...[-.25,.25].map(d=>height(x+c*u+s*d,z-s*u+c*d)))}));
    const all=[-.72,.72].flatMap(u=>[-.25,.25].map(d=>height(x+c*u+s*d,z-s*u+c*d)));if(Math.max(...all)-Math.min(...all)>.24)return null;
    for(const u of [-1.1,0,1.1])for(const d of [-.4,.4])if(!free(x+c*u+s*d,z-s*u+c*d,.25,.35))return null;
    return {x,z,y:Math.max(...all),legs,heading,width:1.9,depth:.6,height:.95};};
  for(const run of bandRuns){const L=lengthOf(run.pts);for(let s=20;s<L-4;s+=24){const p=along(run.pts,s),o=run.W-1.0;
      const x=p.x+p.nx*sign*o,z=p.z+p.nz*sign*o,b=benchAt(x,z,Math.atan2(-p.nx*sign,-p.nz*sign));if(b){benches.push(b);claim(x,z,1.2);}}}
  // Benches beside the walks (inferred): every ~30 m, 1.5 m off the walk's edge, facing it.
  for(const id of [381416336,271033260,'link',271351143]){const st=strips.find(q=>q.id===id);if(!st)continue;const L=lengthOf(st.points);
    for(let t=15;t<L-5;t+=30){const p=along(st.points,t);for(const sd of [-1,1]){const o=st.half+1.5,x=p.x+p.nx*sd*o,z=p.z+p.nz*sd*o,b=benchAt(x,z,Math.atan2(-p.nx*sd,-p.nz*sd));
        if(b){benches.push(b);claim(x,z,1.2);break;}}}}
  // Palms (B1/B4): rows in the lawn between the promenade and the cycleway, along the road side of the south strip, the
  // diagonal strip and the north band; clusters on the peninsula; round planter rings where they stand in the paving.
  const palmAt=(x,z,yawSeed)=>{if(!free(x,z,.9,.8))return false;const ring=done.some(d=>x>=d.b[0]&&x<=d.b[1]&&z>=d.b[2]&&z<=d.b[3]&&inRing(x,z,d.p));
    if(ring&&nearStrip(x,z,1.9))return false;   // a 0.95 m planter ring must stay off the strip too
    const y=height(x,z);palms.push({x,z,y,yaw:hash(Math.round(x*7),Math.round(z*7),yawSeed)*Math.PI*2,ring});claim(x,z,ring?1.2:.9);return true;};
  if(cyc){const L=lengthOf(cyc);for(let s=10;s<L-6;s+=11){const p=along(cyc,s);if(p.x<735)continue;const sd=p.nz>0?1:-1;   // +z side = south
      palmAt(p.x+p.nx*sd*5.5,p.z+p.nz*sd*5.5,1);if(Math.round(s/11)%2===0)palmAt(p.x-p.nx*sd*3.6,p.z-p.nz*sd*3.6,2);}}
  for(const id of [271033260,271351143]){const s=strips.find(q=>q.id===id);if(!s)continue;const L=lengthOf(s.points);
    for(let t=8;t<L-6;t+=12){const p=along(s.points,t);for(const sd of [1,-1])palmAt(p.x+p.nx*sd*3.4,p.z+p.nz*sd*3.4,3+sd);}}
  // Fountain plaza palms in round planters and the El Faro plaza edge (B1).
  for(const [x,z] of [[918,201],[930,200.8],[944,201.5],[956,202.2],[872,197.6],[892,198.8],[1008,203.2],[1018,203.6]])palmAt(x,z,7);
  // Peninsula: palms along the curved walk and the link, shade trees in raised square planters (B3) on the lawns.
  for(const id of [381416336,'link','spine']){const s=strips.find(q=>q.id===id);if(!s)continue;const L=lengthOf(s.points);
    for(let t=5;t<L-3;t+=9){const p=along(s.points,t);palmAt(p.x+p.nx*3.2,p.z+p.nz*3.2,9);}}
  const planterAt=(x0,z0,w=3.6)=>{const okP=(X,Z)=>[[X-w/2,Z-w/2],[X+w/2,Z-w/2],[X+w/2,Z+w/2],[X-w/2,Z+w/2]].every(p=>free(p[0],p[1],.3,.6))&&free(X,Z,w/2+.3,w/2+.4);
    const {x,z}=levelSpot(x0,z0,w/2,w/2,0,.3,6,okP);const r=[[x-w/2,z-w/2],[x+w/2,z-w/2],[x+w/2,z+w/2],[x-w/2,z+w/2]];if(!r.every(p=>free(p[0],p[1],.3,.6))||!free(x,z,w/2+.3,w/2+.4))return false;
    const g=Math.min(...r.map(p=>height(...p))),top=Math.max(...r.map(p=>height(...p)))+.75;planters.push({x,z,w,g,top});claim(x,z,w*.75);
    trees.push({x,z,y:top-.1,scale:.85+hash(Math.round(x),Math.round(z),5)*.2,planter:true});prism(r,g-.1,top);
    // a brick ring 1.1 m wide round the planter.
    const h=w/2,o=h+1.1;keep([quad([x-o,z-o],[x+o,z-o],[x+o,z-h],[x-o,z-h]),quad([x-o,z+h],[x+o,z+h],[x+o,z+o],[x-o,z+o]),quad([x-o,z-h],[x-h,z-h],[x-h,z+h],[x-o,z+h]),quad([x+h,z-h],[x+o,z-h],[x+o,z+h],[x+h,z+h])],'planter-ring','terra');return true;};
  for(const [x,z] of [[1140,68.5],[1158,72],[1175,77],[1262,106.5],[1160,226],[1192,232],[1238,214],[1255,190],[1275,160],
    [1147,197],[1088,128],[1072,156],[985,208.5],[800,200],[840,202],[1060,180]])planterAt(x,z);
  // Broadleaf shade trees on the open lawns (inferred; B2/B4 show trees behind the promenade lawns).
  for(const [x,z] of [[1176,239],[1205,247],[1226,232],[1244,206],[1262,180],[1283,148],[1170,95],[1240,138],[1121,213],[760,192.5],[780,194],[1050,140],[1030,175.5]])
    if(free(x,z,1.3,1.0)){trees.push({x,z,y:height(x,z),scale:.95+hash(Math.round(x),Math.round(z),8)*.25});claim(x,z,1.3);}
  // Peninsula interior (inferred): scattered palms and shade trees on a jittered 15 m lattice, thinned by hash, clear of the
  // walks, the sand, the parking and the buildings, leaving the central lawn of the round park (421337017) open.
  for(let gx=1150;gx<1300;gx+=15)for(let gz=95;gz<275;gz+=15){const h=hash(gx,gz,41);if(h<.45)continue;
    const x=gx+(hash(gx,gz,42)-.5)*8,z=gz+(hash(gx,gz,43)-.5)*8;
    if(inRing(x,z,SAND)||inRing(x,z,PARKING)||Math.hypot(x-1185,z-185)<22||!inPark(x,z))continue;
    if(h<.72){palmAt(x,z,44);}else if(free(x,z,1.3,1.0)){trees.push({x,z,y:height(x,z),scale:.9+hash(gx,gz,45)*.3});claim(x,z,1.3);}}
  // Pergolas (B1: white frames with slatted roofs) on the fountain plaza; umbrella shade canopies (B3 background: white
  // columns with broad tops) by the El Faro plaza and Café Ocho. Positions inferred.
  const pergolaAt=(x,z,ang,L=6,W=3)=>{const c=Math.cos(ang),s=Math.sin(ang),posts=[];
    for(const u of [-L/2+.2,L/2-.2])for(const v of [-W/2+.2,W/2-.2])posts.push([x+c*u+s*v,z-s*u+c*v]);
    if(!posts.every(p=>free(p[0],p[1],.25,.3)))return false;const g=Math.max(...posts.map(p=>height(...p)));pergolas.push({x,z,ang,L,W,posts,g});
    for(const p of posts)prism(circle(p[0],p[1],.12,6),height(...p)-.1,g+2.75);claim(x,z,1.2);return true;};
  for(const [x,z,ang] of [[924,204.6,.06],[949,206.1,.06]])pergolaAt(x,z,ang);
  // Park rooms (B12): a pergola over each pad, a bench on either side facing in.
  for(const r of rooms){pergolaAt(r.x,r.z,.4,4.6,2.6);for(const sd of [-1,1]){const x=r.x+Math.sin(.4)*sd*3.0,z=r.z+Math.cos(.4)*sd*3.0,b=benchAt(x,z,Math.atan2(-Math.sin(.4)*sd,-Math.cos(.4)*sd));if(b){benches.push(b);claim(x,z,1.2);}}}
  // Plaza clusters (B11, B1): long seat-planters with shrubs and a bench in front, at the Muelle 6 and El Faro plazas.
  const seatPlanters=[];for(const [x,z] of [[878,201.4],[887,202],[1009,208.6],[1017,209.3]]){const ang=-.06,c=Math.cos(ang),s=Math.sin(ang);
    const r=[[-1.6,-.55],[1.6,-.55],[1.6,.55],[-1.6,.55]].map(([u,v])=>[x+c*u+s*v,z-s*u+c*v]);if(!r.every(p=>free(p[0],p[1],.3,.5)))continue;
    const g=Math.min(...r.map(p=>height(...p))),top=Math.max(...r.map(p=>height(...p)))+.55;seatPlanters.push({x,z,ang,g,top});prism(r,g-.1,top);claim(x,z,1.8);
    const bx=x+s*1.4,bz=z+c*1.4,b=benchAt(bx,bz,ang+Math.PI);if(b){benches.push(b);claim(bx,bz,1.2);}}
  // Obelisk setting (B09, B4): a curved cream seat wall (r 4.4) and a trimmed hedge (r 5.1) round its south side.
  const obeliskSet={seat:[],hedge:[]};
  for(let a=Math.PI*.2;a<Math.PI*.8-1e-6;a+=Math.PI*.6/7){const b=a+Math.PI*.6/7;
    for(const [list,R,w,h] of [[obeliskSet.seat,4.4,.5,.46],[obeliskSet.hedge,5.15,.7,.9]]){const p=[OBELISK[0]+Math.cos(a)*R,OBELISK[1]+Math.sin(a)*R],q=[OBELISK[0]+Math.cos(b)*R,OBELISK[1]+Math.sin(b)*R];
      const [ux,uz]=unit(p,q),r=[[p[0]-uz*w/2,p[1]+ux*w/2],[q[0]-uz*w/2,q[1]+ux*w/2],[q[0]+uz*w/2,q[1]-ux*w/2],[p[0]+uz*w/2,p[1]-ux*w/2]];
      if(r.some(t=>nearStrip(t[0],t[1],.3)||!dry(...t)))continue;const g=Math.min(...r.map(t=>height(...t)));list.push({p,q,w,g,h,y:Math.max(...r.map(t=>height(...t)))});prism(r,g-.1,Math.max(...r.map(t=>height(...t)))+h);}}
  // Pond benches (B10): two benches on the apron facing the basin.
  {const c=centroid(POND);for(const a of [.6,2.4]){const x=c[0]+Math.cos(a)*7.6,z=c[1]+Math.sin(a)*7.6,b=benchAt(x,z,Math.atan2(c[0]-x,c[1]-z));if(b){benches.push(b);claim(x,z,1.2);}}}
  for(const [x,z] of [[1010,217],[1018,221],[1026,224.5],[1232,176],[1247,172.5],[1213,170],[1252,134]])
    if(free(x,z,.5,.6)){canopies.push({x,z,y:height(x,z),r:2.3,foot:footMin(x,z,.14)});prism(circle(x,z,.16,8),Math.min(height(x,z)-.1,footMin(x,z,.14)),height(x,z)+3.6);claim(x,z,.6);}
  // Bicycle racks at the mapped bicycle_parking nodes (3 stands each), moved to the nearest free spot within 4 m.
  for(const [x,z] of [[769.2,184],[810,186],[899,192],[867,190],[976,196]]){let best=null;
    for(let r=0;r<=4&&!best;r+=.5)for(let a=0;a<12&&!best;a++){const px=x+Math.cos(a*Math.PI/6)*r,pz=z+Math.sin(a*Math.PI/6)*r;
      if([-1,0,1].every(k=>free(px+k*.9,pz,.45,.5)))best=[px,pz];}
    if(best){racks.push({x:best[0],z:best[1],y:height(...best)});for(const k of [-1,0,1])prism(quad([best[0]+k*.9-.04,best[1]-.4],[best[0]+k*.9+.04,best[1]-.4],[best[0]+k*.9+.04,best[1]+.4],[best[0]+k*.9-.04,best[1]+.4]),height(best[0]+k*.9,best[1])-.1,height(best[0]+k*.9,best[1])+.85);claim(best[0],best[1],1.6);}}
  // Bollards on the unrailed east quay (B6): every ~11 m on the threshold band's straight line (1.1 m inside the edge's
  // deepest notch; merge round: clear of the coast's quay coping).
  {const q=stations.filter(s=>s.quay&&s.d!==null);let last=null;
    for(const s of q){if(edgeInfo[s.edge].L<=12)continue;const d=quayInset.get(s.edge)+1.1,x=s.p[0]+s.n[0]*d,z=s.p[1]+s.n[1]*d;if(last&&Math.hypot(x-last[0],z-last[1])<11)continue;
      if(!dry(x,z)||nearStrip(x,z,.4))continue;bollards.push({x,z,y:height(x,z),foot:footMin(x,z,.35)});prism(circle(x,z,.22,8),Math.min(height(x,z)-.1,footMin(x,z,.35)),height(x,z)+.62);last=[x,z];}}
  // Low shrubs along the north (road-side) edge of the south strip (B1 hedges), clear of the crossings.
  for(let x=742;x<1018;x+=4.2){const e=[PARK[15],PARK[16],PARK[17]];let zN=null;for(let i=0;i+1<e.length;i++)if(x>=e[i][0]&&x<=e[i+1][0])zN=e[i][1]+(e[i+1][1]-e[i][1])*(x-e[i][0])/(e[i+1][0]-e[i][0]);
    if(zN===null)continue;const z=zN+2.2;if(!free(x,z,.8,.7))continue;shrubs.push({x,z,y:height(x,z),s:.75+hash(Math.round(x),3)*.3});prism(circle(x,z,.75,8),height(x,z)-.1,height(x,z)+.9);claim(x,z,.8);}
  // bases reach 4 cm below the lowest DEM point (= the drawn drapes) under
  // their footprint (centre, corners, edge mid-points); colliders share that bound. The builder reads `foot`.
  for(const p of palms){p.foot=footMin(p.x,p.z,p.ring?.95:.3);prism(circle(p.x,p.z,.24,8),Math.min(p.y-.15,p.foot),p.y+3.5);if(p.ring)prism(circle(p.x,p.z,.95,10),p.foot,p.y+.45);}
  for(const t of trees)if(!t.planter)prism(circle(t.x,t.z,.34*t.scale,10),t.y-.1,t.y+3.5);
  for(const l of lamps){const w=l.kind==='pylon'?.26:.2,c=Math.cos(l.ang),s=Math.sin(l.ang),r=[[-w,-w],[w,-w],[w,w],[-w,w]].map(([u,v])=>[l.x+c*u+s*v,l.z-s*u+c*v]);
    l.foot=l.kind==='pylon'?footMin(l.x,l.z,.31,.24,l.ang):footMin(l.x,l.z,.22,.22,l.ang);l.hi=l.foot+.04+(l.kind==='pylon'?spanAt(l.x,l.z,.31,.24,l.ang):spanAt(l.x,l.z,.22,.22,l.ang));   // uphill ground: the plinth top stays ≥6 cm above it
    prism(r,Math.min(l.y-.1,l.foot),l.y+4.6);}
  for(const b of benches){const c=Math.cos(b.heading),s=Math.sin(b.heading),r=[[-1,-.32],[1,-.32],[1,.32],[-1,.32]].map(([u,d])=>[b.x+c*u+s*d,b.z-s*u+c*d]);
    prism(r,Math.min(...b.legs.map(l=>l.ground))-.1,b.y+.95);}

  // ---- Railings (B5) on the promenade edge stations: posts at the stations, a thin solid per bay. ----
  const rails=[];
  for(let i=0;i+1<stations.length;i++){const a=stations[i],b=stations[i+1];
    if(a.inset===null||b.inset===null||a.quay||b.quay||a.gap||b.gap)continue;const L=Math.hypot(b.x-a.x,b.z-a.z);if(L<.05||L>2.6)continue;
    const ga=height(a.x,a.z),gb=height(b.x,b.z);rails.push({a:[a.x,ga,a.z],b:[b.x,gb,b.z],n:a.n});
    const [ux,uz]=unit([a.x,a.z],[b.x,b.z]),h=.06,r=[[a.x-uz*h,a.z+ux*h],[b.x-uz*h,b.z+ux*h],[b.x+uz*h,b.z-ux*h],[a.x+uz*h,a.z-ux*h]];
    prism(r,Math.min(ga,gb)-.15,Math.max(ga,gb)+RAIL.height+.02);}
  // (puerta-de-tierra-edge-1129_215-out): beyond the railings where `coast` yields these shores to
  // this area (its 4.5 m probe touches our ground: the inlet banks and the peninsula's south-west edges, plus two short
  // runs on the main promenade; regions below, measured on the merged world), the grass ended in the grid's right-angle
  // bites. It now ends on one smoothed line just landward of the deepest bite (≥ 0.35 m inside the rail): the terrain
  // seaward of the line is render-cut and a low stone bank (coping + face to below the water) closes it, stopping at the
  // bridge landings with an abutment block. Render only: the strip lies behind the solid railing.
  const BANK_REGIONS=[[1100,1192,128,276],[995,1092,128,232],[905,966,208,226],[860,903,208,222]];
  const bank=[];{const inR=(x,z)=>BANK_REGIONS.some(([x0,x1,z0,z1])=>x>=x0&&x<=x1&&z>=z0&&z<=z1);let run=null;
    for(let i=0;i<stations.length;i++){const st=stations[i];
      const ok=st.inset!==null&&!st.quay&&!st.gap&&inR(st.x,st.z)&&!nearLanding(st.x,st.z,.6);
      const prev=run?.raw.at(-1);if(!ok||(prev&&Math.hypot(prev.st.x-st.x,prev.st.z-st.z)>2.6)){run=null;if(!ok)continue;}
      if(!run)bank.push(run={raw:[]});run.raw.push({st});}
    const sm=P=>{for(let it=0;it<2;it++)P=P.map((q,i)=>i===0||i===P.length-1?q:[(P[i-1][0]+2*q[0]+P[i+1][0])/4,(P[i-1][1]+2*q[1]+P[i+1][1])/4]);return P;};
    for(const r of bank){const at=d=>sm(r.raw.map(({st})=>[st.p[0]+st.n[0]*(st.inset-d),st.p[1]+st.n[1]*(st.inset-d)]));
      // inner: 0.15 m seaward of the rail (dry: the rail stands ≥ 0.6 m inside the deepest bite); outer: the bank line 1.1 m out.
      const I=at(.15),O=at(BANK.width);
      r.pts=I.map((q,i)=>{const yi=height(q[0],q[1]),o=O[i],yo=Math.min(yi,dry(o[0],o[1])?height(o[0],o[1]):yi)-.06;
        return {x:o[0],z:o[1],y:yo,ix:q[0],iz:q[1],iy:yi,n:r.raw[i].st.n};});delete r.raw;
      // the coping runs level — the bank line keeps the lower of its own height and a
      // ±2-station average, and never rises more than 0.1 m per station (it may stay below the turf, which then slopes).
      const Y=r.pts.map(q=>q.y),A=Y.map((_,i)=>{let t=0,c=0;for(let j=Math.max(0,i-2);j<=Math.min(Y.length-1,i+2);j++){t+=Y[j];c++;}return t/c;});
      r.pts.forEach((q,i)=>{q.y=Math.min(q.y,A[i]);});for(let it=0;it<2;it++){for(let i=1;i<r.pts.length;i++)r.pts[i].y=Math.min(r.pts[i].y,r.pts[i-1].y+.1);
        for(let i=r.pts.length-2;i>=0;i--)r.pts[i].y=Math.min(r.pts[i].y,r.pts[i+1].y+.1);}}
    for(let k=bank.length-1;k>=0;k--)if(bank[k].pts.length<3)bank.splice(k,1);
    // where this area's paving already runs past the rail (the promenade runs), the bank keeps
    // its cut, face and coping but draws no turf over the paving (1 mm apart before).
    const paved=(x,z)=>surfaces.some(q=>inRing(x,z,q.ring));
    for(const r of bank)for(let i=0;i+1<r.pts.length;i++){const A=r.pts[i],B=r.pts[i+1];A.paved=paved((A.ix+B.ix+A.x+B.x)/4,(A.iz+B.iz+A.z+B.z)/4);}
    for(const r of bank)for(let i=0;i+1<r.pts.length;i++){const A=r.pts[i],B=r.pts[i+1],D=4,q=[[A.ix,A.iz],[B.ix,B.iz],[B.x-B.n[0]*D,B.z-B.n[1]*D],[A.x-A.n[0]*D,A.z-A.n[1]*D]];
      const cr=q.map((a,k)=>{const b=q[(k+1)%4],c=q[(k+2)%4];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});
      if(!(cr.every(v=>v>1e-6)||cr.every(v=>v<-1e-6))){A.skip=true;continue;}const ring=ccw(q),[minX,maxX,minZ,maxZ]=bounds(ring),sa=Math.sign(signedArea(ring));
      cuts.push({ring,planes:ring.map((a,k)=>{const b=ring[(k+1)%ring.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1,nx=-sa*ez/l,nz=sa*ex/l;return [nx,0,nz,-(nx*a[0]+nz*a[1])];}),minX,maxX,minZ,maxZ,kind:'bahia-bank',tight:true});}}
  // The grid's default rock skirt under the cut (vertical, so the plan cut cannot remove it) is skipped through the generic
  // `shoreSkip` contract (sj-world): every shore edge of a cell whose centre lies in a bank cut or within 0.6 m of one.
  const shoreSkip=new Set();for(const c of cuts){if(c.kind!=='bahia-bank')continue;
    for(let gj=Math.floor((c.minZ-1-z0)/step);gj<=Math.floor((c.maxZ+1-z0)/step);gj++)for(let gi=Math.floor((c.minX-1-x0)/step);gi<=Math.floor((c.maxX+1-x0)/step);gi++){
      const cx=x0+(gi+.5)*step,cz=z0+(gj+.5)*step;if(!c.planes.every(([a,,b,d])=>a*cx+b*cz+d>-.6))continue;
      for(const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]])shoreSkip.add(`${gi},${gj},${di},${dj}`);}}
  // Landing returns (B01): from each deck rail end at the landing row to the nearest live shore station on that side,
  // in ≤1.6 m bays with posts and solid bays, so the fence runs unbroken shore → return → deck. The lean faces the water.
  const returns=[];
  for(const [li,row] of [[0,deckRows[0]],[1,deckRows.at(-1)]]){if(!row)continue;const L=landings[li],into=li===0?[row.p.ux,row.p.uz]:[-row.p.ux,-row.p.uz];
    const land=[L.x-into[0]*4,L.z-into[1]*4];
    for(const sd of [-1,1]){const E=deckRails.find(q=>q.side===sd&&q.r===(li===0?0:deckRows.length-1));
      const live=stations.filter(st=>st.inset!==null&&!st.gap&&!st.quay&&((st.x-L.x)*row.p.nx+(st.z-L.z)*row.p.nz)*sd>.5&&Math.hypot(st.x-E.x,st.z-E.z)<16);
      if(!live.length)continue;const S=live.reduce((b,q)=>Math.hypot(q.x-E.x,q.z-E.z)<Math.hypot(b.x-E.x,b.z-E.z)?q:b);
      const Sy=height(S.x,S.z),len=Math.hypot(S.x-E.x,S.z-E.z),k=Math.max(1,Math.ceil(len/RAIL.spacing)),pts=[];
      for(let i=0;i<=k;i++){const t=i/k,x=E.x+(S.x-E.x)*t,z=E.z+(S.z-E.z)*t;pts.push({x,z,y:i===0?E.y:dry(x,z)?height(x,z):E.y+(Sy-E.y)*t});}
      for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],m=[(a.x+b.x)/2,(a.z+b.z)/2],[ux,uz]=unit([a.x,a.z],[b.x,b.z]);
        let n=[-uz,ux];if((land[0]-m[0])*n[0]+(land[1]-m[1])*n[1]<0)n=[uz,-ux];
        rails.push({a:[a.x,a.y,a.z],b:[b.x,b.y,b.z],n,ret:true});railPrism(a,b);}
      returns.push({landing:li,side:sd,from:[E.x,E.z],to:[S.x,S.z],len});}}

  // ---- Fountain with the bronze sculpture (B7; mapped basin 458535315), the El Faro monument (node 8516392692; form
  // inferred: a granite stele with a small lantern), the obelisk (B4), the peninsula pond with its jet (421337002 /
  // 4211120239). Basins are solid to the rim: closed water, not a ride. ----
  const fc=centroid(FOUNTAIN),basin=ccw(FOUNTAIN.map(p=>[fc[0]+(p[0]-fc[0])*1.25,fc[1]+(p[1]-fc[1])*1.25]));
  // Basin tops stand over the highest ground inside the ring (the pond's DEM is domed: 3.43 m inside a 2.26–2.69 m rim).
  const groundMax=ring=>{const [a,b,c,d]=bounds(ring);let m=Math.max(...ring.map(p=>height(...p)));for(let x=a;x<=b;x+=.5)for(let z=c;z<=d;z+=.5)if(inRing(x,z,ring))m=Math.max(m,height(x,z));return m;};
  const fg=Math.min(...basin.map(p=>height(...p)));prism(basin,fg-.15,groundMax(basin)+.45);
  const plinth=ccw(circle(fc[0],fc[1],.95,4).map(([x,z])=>[x,z]));prism(plinth,fg-.1,fg+2.7);
  const fountain={x:fc[0],z:fc[1],g:fg,basin,rim:groundMax(basin)+.45};
  const faro={x:EL_FARO[0],z:EL_FARO[1],y:height(...EL_FARO)};faro.foot=footMin(faro.x,faro.z,.85,.45);prism(quad([faro.x-.6,faro.z-.3],[faro.x+.6,faro.z-.3],[faro.x+.6,faro.z+.3],[faro.x-.6,faro.z+.3]),Math.min(faro.y-.1,faro.foot),faro.y+2.6);
  const obelisk={x:OBELISK[0],z:OBELISK[1],y:height(...OBELISK)};obelisk.foot=footMin(obelisk.x,obelisk.z,.75);prism(quad([obelisk.x-.75,obelisk.z-.75],[obelisk.x+.75,obelisk.z-.75],[obelisk.x+.75,obelisk.z+.75],[obelisk.x-.75,obelisk.z+.75]),Math.min(obelisk.y-.1,obelisk.foot),obelisk.y+7.5);
  const pg=Math.min(...POND.map(p=>height(...p))),pond={ring:ccw(POND),g:pg,rim:groundMax(POND)+.42,jet:[1127.4,234.0]};
  prism(pond.ring,pg-.15,pond.rim);

  // ---- Ground material = drawn ground. The raster class mask (surface.u8: sidewalk/asphalt/lawn/waterEdge) is what the
  // sampler gives the wheel; here it is lawn (rolling resistance 2.8) under much of the drawn paving and pavement or
  // waterEdge under the drawn lawn (a rider stalled on a lawn cell of the paved Muelle 6 connector). Only
  // cells whose own vertex this area tints change (so no other vertex colour moves): paved cell centre → sidewalk, lawn or
  // sand → lawn. Nulling the area leaves the mask untouched. ----
  const remapped={paved:0,lawn:0};
  // the class follows a 4×4 supersample of each cell (≥2/16 paved → pavement, so the public path wins over a
  // fractional verge), and the lawn/apron fallback only applies to cells centred inside the mapped park.
  if(surface){const paved=new Map();
    for(const r of surfaces){const [a,b,c,d]=bounds(r.ring);
      for(let j=Math.floor((c-z0)/step);j<=Math.floor((d-z0)/step);j++)for(let i=Math.floor((a-x0)/step);i<=Math.floor((b-x0)/step);i++){
        const X=x0+i*step,Z=z0+j*step;let hit=0;   // pieces are convex: four inside corners ⇒ the whole cell
        if(inRing(X,Z,r.ring)&&inRing(X+step,Z,r.ring)&&inRing(X,Z+step,r.ring)&&inRing(X+step,Z+step,r.ring))hit=16;
        else for(let u=0;u<4;u++)for(let v=0;v<4;v++)if(inRing(X+(u+.5)/4*step,Z+(v+.5)/4*step,r.ring))hit++;
        if(hit){const k=j*nx+i;paved.set(k,(paved.get(k)??0)+hit);}}}
    const LAWNISH=new Set([...TONES.lawn,...TONES.sand]);
    // A cell whose vertex an earlier owner tints (the waterfront's at the x 726 joint) keeps that owner's colour, so a paved
    // cell centred east of the cut may change class there too.
    const earlierTint=k=>earlier.some(a=>a.tint?.has(k));
    // Cells mostly paved by this area (≥8/16) whose vertex nobody tints (it lies in a foreign carriageway's 0.6 m margin,
    // e.g. the cycleway beside PR-1 at x 1130) also take the paved class; the later street owner tints that vertex.
    for(const [k,c] of paved)if(c>=8&&!tint.has(k)&&!earlierTint(k)){const i=k%nx,j=(k-i)/nx,cx=x0+(i+.5)*step,cz=z0+(j+.5)*step;
      if(cellDry(i,j)&&x0+i*step>=WEST_CUT&&inPark(cx,cz)&&surface[k]===2){surface[k]=0;remapped.paved++;remapped.margin=(remapped.margin??0)+1;}}
    for(const [k] of paved)if(!tint.has(k)&&earlierTint(k)){const i=k%nx,j=(k-i)/nx;if(cellDry(i,j)&&x0+(i+.5)*step>WEST_CUT&&(paved.get(k)??0)>=2&&surface[k]===2){surface[k]=0;remapped.paved++;}}
    for(const [k,tone] of tint){const i=k%nx,j=(k-i)/nx;if(!cellDry(i,j))continue;const cx=x0+(i+.5)*step,cz=z0+(j+.5)*step;
      if((paved.get(k)??0)>=2){if(surface[k]===2){surface[k]=0;remapped.paved++;}}
      else if(!inPark(cx,cz))continue;
      else if(LAWNISH.has(tone)){if(surface[k]!==2){surface[k]=2;remapped.lawn++;}}
      else if(surface[k]===2){surface[k]=0;remapped.paved++;}}}

  // Map arrival (snaps to the cycleway by the fountain plaza; ride-away and Plaza de Armas round trip in tests).
  const places=[{name:'Bahía Urbana',x:936,z:196.3,source:256258027}];

  const layout={colliders,tops,cuts,tint,surfaces,floorTriangles,places,buildingOverrides,ownedBuildings:[...OWNED],
    shoreSkip,streets:strips,walk,stations,rails,returns,bank,rooms,seatPlanters,obeliskSet,deckRows,deckTriangles,deckRails,piers,landings,lamps,benches,palms,trees,planters,pergolas,canopies,
    bollards,racks,shrubs,fountain,faro,obelisk,pond,plazas:PLAZAS.map(p=>({name:p.name,ring:p.ring})),shells:ownedShells,
    constants:{DECK,RAIL,TONES,WEST_CUT},cafe};
  layout.qa=()=>({surfaces:surfaces.length,kinds:Object.fromEntries(['terra','linear','morro','asphalt'].map(k=>[k,surfaces.filter(s=>s.kind===k||s.kind===k+'E').length])),
    area:Object.fromEntries(['terra','linear','morro','asphalt'].map(k=>[k,Math.round(surfaces.filter(s=>s.kind===k||s.kind===k+'E').reduce((s,q)=>s+Math.abs(signedArea(q.ring)),0))])),
    colliders:colliders.length,tops:tops.length,tint:tint.size,stations:stations.length,rails:rails.length,deckRows:deckRows.length,piers:piers.length,
    lamps:lamps.length,benches:benches.length,palms:palms.length,trees:trees.length,planters:planters.length,pergolas:pergolas.length,canopies:canopies.length,
    bollards:bollards.length,racks:racks.length,shrubs:shrubs.length,remapped,landings:landings.map(l=>[+l.x.toFixed(2),+l.z.toFixed(2),+l.y.toFixed(2)])});
  return layout;
}
