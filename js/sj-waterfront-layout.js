/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Southern waterfront (Plaza del Inmigrante → Muelle 4) — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// Area module (contract: header of sj-princesa-layout.js), registered after puntilla, before wallFoot.
// Survey  (inventory.json); references Wikimedia Commons curid=184241561, curid=122889567, curid=184240865, curid=184238581, curid=149388376, curid=106059407, curid=123441024, curid=182263185, curid=49348487, curid=122894933, curid=182041799, curid=110093131 (97–100 for this shore).
// Mapped: Calle Comercio 22229666 (from Puntilla's section at node 3852230414), Plaza Dársenas 256336227 and its sculpture
// node 9520401483, bay-side walk 271033267, PR-1 143318965/1388699368/1388699366/458535129/60330127/195483566, Muelle 1
// 260863200, Muelle 3 260863197 (+ detached mooring rings 1356199419/20/21), Muelle 4 113347943, Terminal Covadonga
// 60252431 (east wall 458535131), and the owned buildings below. Inferred: every closure
// line, fence/wall/gate, bed, palm/lamp/bench placement, promenade widths and the hotel-reach detour (RS P1: the walk
// leaves the dry mask between (422,218) and (473.6,204)), deck heights, the facade styles and every Muelle 2 canopy detail.
// Closed: cruise piers 1/3/4, the ferry terminal's enclosed deck, the Covadonga bus/garage compound. Public:
// Plaza Dársenas, the promenade and the street-side frontages. Pier decks and mooring dolphins are render-only (sealed,
// private); the bay-front promenade, plaza and Comercio paving drape the shared terrain (drawn = physical).
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea,intersectRings} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {unit,bounds,ribbon,minus,overlapB,plane} from './sj-city-wall.js';
import {ringsAt,inRingAt,anyOf} from './sj-private.js';

// ---- Mapped rings (OSM ways, projected into game x/z) ----
// 256336227 {"leisure":"park","name":"Plaza Dársenas"}
export const DARSENAS=[[170.49,277.986],[162.303,251.488],[161.279,250.348],[159.789,244.427],[160.244,242.833],[260.027,216.931],
  [264.897,218.724],[272.164,245.344],[273.653,249.893]];
// 260863200 {"man_made":"pier","name":"Muelle 1"}
export const PIER1=[[275.893,259.456],[284.406,257.32],[299.743,253.468],[306.027,251.885],[325.612,327.837],[330.639,326.609],
  [350.203,404.797],[345.999,406.169],[353.087,433.154],[354.143,437.15],[344.542,439.298],[337.179,411.77],[321.737,415.567],
  [319.117,414.449],[316.064,415.213],[313.329,415.91],[288.896,321.717],[292.403,320.676]];
// 260863197 {"man_made":"pier","name":"Muelle 3"}: two root arms, a water notch between them, one long finger.
export const PIER3=[[480.086,204.309],[495.528,200.855],[493.194,205.493],[493.775,208.437],[517.996,246.822],[520.626,253.585],
  [522.474,246.335],[540.947,199.448],[539.975,195.873],[537.735,194.589],[552.28,195.031],[545.594,204.03],[528.769,244.542],
  [527.291,272.246],[559.577,497.701],[562.693,518.145],[559.187,518.045],[559.187,518.997],[557.275,519.086],[556.863,516.507],
  [556.651,513.496],[558.331,510.939],[553.704,480.213],[551.612,478.752],[551.369,475.741],[552.172,474.535],[547.028,466.71],
  [540.521,461.629],[534.638,468.426],[531.099,478.642],[531.237,499.694],[532.157,513.962],[534.174,515.755],[534.122,520.725],
  [530.879,520.769],[530.879,521.245],[529.178,521.19],[527.931,500.602],[516.465,272.424],[511.024,247.354],[486.539,209.112]];
// 113347943 {"man_made":"pier","name":"Carnival CruisePort Muelle 4"}
export const PIER4=[[680.192,202.72],[722.04,206.127],[727.332,206.36],[726.297,216.543],[753.463,463.36],[709.1,467.557],[678.513,217.685]];
// Detached Muelle 3 mooring structures (the city polygon's three small rings): 1356199419/20/21.
export const DOLPHINS=[[[530.077,550.743],[535.548,550.344],[536.087,557.539],[530.605,557.948]],
  [[532.19,587.701],[537.672,587.302],[538.201,594.497],[532.719,594.906]],
  [[546.113,622.345],[548.564,646.275],[566.373,644.825],[564.175,620.806],[559.623,619.588],[550.507,620.242]]];
// 60252431 {"amenity":"bus_station","name":"Terminal Covadonga"}: the operations compound (garage, bays, lanes A–F).
export const COVADONGA=[[616.403,149.095],[602.385,91.993],[594.589,60.492],[592.265,51.05],[602.943,32.787],[621.585,28.082],
  [684.97,12.064],[680.884,71.546],[675.436,141.677],[674.159,155.059],[673.958,157.206],[656.446,156.288],[622.318,153.743]];
// Root chords: the public quay ends here; everything seaward is the closed pier. Muelle 3's chord spans both
// arms and the water notch between them (a railing on the quay top closes the notch, fences close the arms).
const PIER_CHORDS=[{id:260863200,ring:PIER1,a:[275.893,259.456],b:[306.027,251.885]},
  {id:260863197,ring:PIER3,a:[480.086,204.309],b:[552.28,195.031],notch:[[495.528,200.855],[537.735,194.589]]},
  {id:113347943,ring:PIER4,a:[680.192,202.72],b:[727.332,206.36]}];
export const NODE=[159.039,230.801],AX=[.971,.24];                 // Puntilla's section (node 3852230414, ⟂ 22229666)
export const JUNCTION_EAST=[727.913,203.714];                      // Muelle 4 / Bahía Urbana handoff (package map)
export const FERRY_ID=259206919,CASITA_ID=460205717,KIOSK_ID=460205715,PAVILION_ID=460205716;
// Owned buildings and their exterior style (Wikimedia Commons curid=49348487, curid=122894933, curid=182041799, curid=110093131 and the reference photographs; styles are inferred kits).
export const OWNED={
  [CASITA_ID]:{style:'casita',colour:'#dcae3e',roofColour:'#b4583f'},       // Wikimedia Commons curid=49348487: ochre, terracotta, white arches
  [KIOSK_ID]:{style:'kiosk',colour:'#d9b45a',roofColour:'#b4583f'},         // small plaza kiosk (identity unconfirmed)
  [PAVILION_ID]:{style:'pavilion'},                                           // shelter: open green canopy (Wikimedia Commons curid=106059407 fg.)
  [FERRY_ID]:{style:'ferry',colour:'#eceeea',roofColour:'#e4e6e1'},         // Wikimedia Commons curid=182041799: low white canopy, green screens
  113347941:{style:'ochoa',colour:'#ece3cd',roofColour:'#cbc5b8'},          // Wikimedia Commons curid=122894933: cream grid, ground arches, crest
  113347942:{style:'tower',colour:'#d6c4a0',roofColour:'#c2baa8'},          // Harbor Plaza: tan balcony stacks
  196615606:{style:'hotel',colour:'#e8d5a9',roofColour:'#c9bea8'},          // Wikimedia Commons curid=110093131: cream/tan tiers, white trim
  256258731:{style:'parking',colour:'#d2cdc2',roofColour:'#a9a69f'},        // Paseo Portuario garage
  142324879:{style:'parking',colour:'#cfc9bc',roofColour:'#a9a69f'},        // Doña Fela garage
  256401363:{style:'parking',colour:'#d4cbbb',roofColour:'#a9a69f'},        // Covadonga garage (stepped, dark bands)
  256401364:{style:'terminal',colour:'#d8d2c4',roofColour:'#b5b2aa'},       // Covadonga lower terminal block
  256259084:{style:'courthouse',colour:'#e2d4b8',roofColour:'#b9b2a6'},     // federal courthouse: pale colonnade, tan grid
  256661397:{style:'deco',colour:'#e9e1cc',roofColour:'#c9c2b2'},           // Banco Popular: ribbed Art Deco tower
  268141823:{style:'office',colour:'#d9d3c6',roofColour:'#b8b3a9'},         // First Bank
  256329295:{style:'office',colour:'#e3ddd0',roofColour:'#b8b3a9'},         // Popular (low branch)
  260859571:{style:'commercial',colour:'#d8d1c3',roofColour:'#b8b3a9'},    // block east of the hotel: identity unconfirmed, restrained commercial front (inferred)
  260859572:{style:'office',colour:'#dccfba',roofColour:'#b8b3a9'},         // low two-storey block at the hotel
  382021489:{style:'shed',colour:'#d6d9d2',roofColour:'#b4b8b2'},           // Muelle 1 shed
  382021491:{style:'shed',colour:'#d6d9d2',roofColour:'#b4b8b2'},           // Muelle 1 root shed
  382021492:{style:'shed',colour:'#dcdcd4',roofColour:'#b4b8b2'}};          // Muelle 4 cruise terminal shed
export const STYLES={casita:{floor:3.4},kiosk:{floor:3.0},ferry:{floor:4.4},ochoa:{floor:3.5,bay:3.3},tower:{floor:3.1,bay:2.6},
  hotel:{floor:3.3,bay:3.0},commercial:{floor:3.3,bay:3.4},parking:{floor:3.0,bay:8},terminal:{floor:4.2,bay:6},courthouse:{floor:4.2,bay:4.2},deco:{floor:3.8,bay:1.6},
  office:{floor:3.6,bay:3.2},shed:{floor:8,bay:1.6}};
// Promenade centreline: 271033267 from Dársenas' east corner, with the RS hotel-reach detour on dry ground, to Muelle 4.
// Vertices shared with the mapped way use its exact coordinates (destination-graph junctions);
// the Muelle 3 notch reach runs ≥2.9 m north of the notch railing.
export const PROMENADE=[[272.164,245.344],[272.956,245.477],[274.033,245.986],[275.945,248.067],[278.111,255.97],[279.241,256.634],
  [283.952,255.405],[298.982,251.487],[301.042,250.944],[304.316,249.528],[309.175,248.199],[366.445,232.89],[393.0,224.9],[404.5,222.7],[412.0,220.4],[422.0,215.6],[440.0,210.6],
  [473.0,201.8],[486.0,198.8],[500.0,195.0],[512.0,191.6],[524.0,189.6],[534.176,189.63],[606.096,194.166],[690.427,199.432],[718.312,203.25],JUNCTION_EAST];
// PR-1 carriageways the promenade and its apron never overpaint (streets owns them); half widths from city.json (10 m).
const PR1=[143318965,1388699368,1388699366,458535129,60330127,195483566,143318960];
const COMERCIO=22229666,SAN_JUSTO_NODE=[190.769,227.193];
export const FENCE={height:2.2,piece:3,seal:3.5,half:.2,wall:2.4,rail:1.05};
export const DECK={face:-1.2,skirt:2.5};
// Plaza frame: the quay direction, origin at the sculpture (node 9520401483, Wikimedia Commons curid=49348487 setting).
export const STATUE=[213.785,253.901];const PU=[.965,-.262],PV=[.262,.965];
// Planting beds in the plaza frame [u0,u1,v0,v1] (inferred from Wikimedia Commons curid=49348487's low green bed fences; paths between them).
const BEDS=[[-17,-6,-9.5,-4.5],[6,17,-9.5,-4.5],[-17,-6,3.5,7.5],[6,17,3.5,7.5]];
const LAWN=['#6f8f4f','#78965a'];

export function hash(i,j,k=0){let h=Math.imul(i*73856093^j*19349663^k*83492791,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
const ccw=r=>signedArea(r)<0?[...r].reverse():r;
const lengthOf=pts=>pts.slice(1).reduce((s,q,i)=>s+Math.hypot(q[0]-pts[i][0],q[1]-pts[i][1]),0);
function along(pts,s){let acc=0;for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(s<=acc+L||i+2===pts.length){const t=Math.max(0,Math.min(1,(s-acc)/L)),[ux,uz]=unit(a,b);return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,ux,uz,i};}
    acc+=L;}}
const nearLine=(pts,x,z)=>{let d=Infinity;for(let i=0;i+1<pts.length;i++)d=Math.min(d,segmentDistance(x,z,pts[i],pts[i+1]));return d;};
function outward(ring,i){const a=ring[i],b=ring[(i+1)%ring.length],[ux,uz]=unit(a,b),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  return inRing(m[0]-uz*.05,m[1]+ux*.05,ring)?[uz,-ux]:[-uz,ux];}
// Exact vertical planes of a convex ring (inside ⇔ a·x+c·z+d > 0), the wall-foot cut format.
function planesOf(r){const s=Math.sign(signedArea(r));
  return r.map((a,i)=>{const b=r[(i+1)%r.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1,nx=-s*ez/l,nz=s*ex/l;return [nx,0,nz,-(nx*a[0]+nz*a[1])];});}
const cutOf=r=>{const [minX,maxX,minZ,maxZ]=bounds(r);return {ring:r,planes:planesOf(r),minX,maxX,minZ,maxZ,kind:'waterfront-deck',tight:true};};
// Offset a convex ring outward by d (edge lines moved out, consecutive lines intersected; near-collinear edges dropped).
function grow(ring,d){let r=ccw(ring);r=r.filter((p,i)=>{const a=r[(i+r.length-1)%r.length],b=r[(i+1)%r.length];
    return Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))>1e-3*Math.hypot(b[0]-a[0],b[1]-a[1]);});
  const L=r.map((a,i)=>{const b=r[(i+1)%r.length],[ux,uz]=unit(a,b),n=[uz,-ux];return {p:[a[0]+n[0]*d,a[1]+n[1]*d],u:[ux,uz]};});
  return L.map((l,i)=>{const m=L[(i+L.length-1)%L.length],det=m.u[0]*l.u[1]-m.u[1]*l.u[0];if(Math.abs(det)<1e-6)return l.p;
    const k=((l.p[0]-m.p[0])*l.u[1]-(l.p[1]-m.p[1])*l.u[0])/det;return [m.p[0]+m.u[0]*k,m.p[1]+m.u[1]*k];});}
// Half-plane as a big ring on the side `s` (unit normal) of line a→b.
const halfPlane=(a,b,s,R=2000)=>{const [ux,uz]=unit(a,b);return ccw([[a[0]-ux*R,a[1]-uz*R],[b[0]+ux*R,b[1]+uz*R],
  [b[0]+ux*R+s[0]*R,b[1]+uz*R+s[1]*R],[a[0]-ux*R+s[0]*R,a[1]-uz*R+s[1]*R]]);};

export function createWaterfrontLayout({city,height,terrain,surface,isDry,areas={}}) {
  const layoutStats={},T0=performance.now();const colliders=[],tops=[],cuts=[],tint=new Map(),surfaces=[],floorTriangles=[],buildingOverrides=new Map(),seals=[];
  const dry=isDry??(()=>true),earlier=Object.values(areas).filter(Boolean),roadById=new Map(city.roads.map(r=>[r.id,r]));
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  const byId=new Map(city.buildings.map(b=>[b.id,b]));
  const gMin=r=>Math.min(...r.map(p=>height(...p))),gMax=r=>Math.max(...r.map(p=>height(...p)));
  const sampleRing=(r,step=1.5)=>{const out=[];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
    for(let k=0;k<n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;};

  // ---- Owned buildings: exterior overrides (colour, roof; the pavilion's mass is replaced by its open canopy). ----
  const ownedBuildings=Object.keys(OWNED).map(Number).filter(id=>byId.has(id));
  for(const id of ownedBuildings){const o=OWNED[id],b=byId.get(id),g=gMax(sampleRing(b.outer).filter(p=>dry(...p)).concat([b.outer[0]]));
    const over={};if(o.colour){over.colour=o.colour;over.roofColour=o.roofColour;}
    if(o.style==='casita')over.roof=g+3.4;                       // Wikimedia Commons curid=49348487: one storey, eave ~3.4 m (RS should-list)
    if(o.style==='kiosk')over.roof=g+3.0;
    if(o.style==='pavilion')over.roof=b.base+.01;               // the shell sinks below ground; the canopy is drawn/solid
    // Muelle 2 (RS P1): the DEM carries the canopy (median 5.05 m); a low flat canopy just above it, not a 10.6 m hall.
    if(o.style==='ferry')over.roof=5.9;
    buildingOverrides.set(id,over);}
  const shell=id=>{const b=byId.get(id),o=buildingOverrides.get(id)??{};return {id,outer:b.outer,holes:b.holes??[],base:b.base,roof:o.roof??b.roof};};
  // Faces with their outward normal and the ground along them (decided per face from the shared terrain).
  const facades=ownedBuildings.filter(id=>OWNED[id].style!=='pavilion').map(id=>{const s=shell(id),r=s.outer;
    const faces=r.map((a,i)=>{const b=r[(i+1)%r.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<2)return null;const n=outward(r,i);
      const g=[];let wet=0;for(let k=0;k<=Math.ceil(L/2);k++){const t=k/Math.ceil(L/2),x=a[0]+(b[0]-a[0])*t+n[0]*.6,z=a[1]+(b[1]-a[1])*t+n[1]*.6;
        if(dry(x,z))g.push(height(x,z));else wet++;}
      // A face whose outside is another mass (party wall) gets no detail.
      const m=[(a[0]+b[0])/2+n[0]*1.2,(a[1]+b[1])/2+n[1]*1.2],party=city.buildings.some(o=>o.id!==id&&inRing(m[0],m[1],o.outer));
      return {i,a,b,length:L,n,lo:g.length?Math.min(...g):0,hi:g.length?Math.max(...g):0,water:wet>g.length,party};}).filter(f=>f&&!f.party);
    return {id,style:OWNED[id].style,roof:s.roof,base:s.base,outer:r,faces};});

  layoutStats.t_closures0=Math.round(performance.now()-T0);
  // ---- Closures: pier chords (fence + gate, notch railing), Covadonga perimeter (wall + gates). ----
  const fence=[],gates=[],closed=[];
  const extendToWater=(p,dir,max=8)=>{let q=p;for(let s=.5;s<=max;s+=.5){const c=[p[0]+dir[0]*s,p[1]+dir[1]*s];q=c;if(!dry(...c))break;}return q;};
  // Fence runs are split exactly at the gate posts (whole-panel skipping left open-looking slots beside the
  // posts) and at ≤3 m. g0/g1 are the visible datum (ground, or the deck level past the quay edge: no net
  // plunging to the seabed); h0/h1 the raw ground for the solids/seals. Pieces over water are not drawn (seal only).
  const addRun=(pts,kind,datum=height,skip=()=>false,hide=(x,z)=>!dry(x,z))=>{for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.02)continue;
    const ts=new Set([0,1]);for(const g of gates)for(const sd of [-1,1]){const p=[g.x+g.ux*g.half*sd,g.z+g.uz*g.half*sd],t=((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/(L*L);
      if(t>1e-4&&t<1-1e-4&&segmentDistance(p[0],p[1],a,b)<.05)ts.add(t);}
    const T=[...ts].sort((x,y)=>x-y);
    for(let j=0;j+1<T.length;j++){const n=Math.max(1,Math.ceil(L*(T[j+1]-T[j])/FENCE.piece));
      for(let k=0;k<n;k++){const t0=T[j]+(T[j+1]-T[j])*k/n,t1=T[j]+(T[j+1]-T[j])*(k+1)/n,p=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],q=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1];
        const m=[(p[0]+q[0])/2,(p[1]+q[1])/2];if(skip(...m))continue;
        fence.push({p,q,g0:datum(...p),g1:datum(...q),h0:height(...p),h1:height(...q),kind,hidden:hide(...m)});}}}};
  const piers=[];
  for(const c of PIER_CHORDS){const [ux,uz]=unit(c.a,c.b),cen=c.ring.reduce((s,p)=>[s[0]+p[0]/c.ring.length,s[1]+p[1]/c.ring.length],[0,0]);
    let s=[-uz,ux];if((cen[0]-c.a[0])*s[0]+(cen[1]-c.a[1])*s[1]<0)s=[uz,-ux];            // seaward unit normal
    // Fence ends continue along their own run (each Muelle 3 arm has its own direction) until they meet the water.
    const dA=c.notch?unit(c.notch[0],c.a):[-ux,-uz],dB=c.notch?unit(c.notch[1],c.b):[ux,uz];
    const A=extendToWater(c.a,dA),B=extendToWater(c.b,dB);
    // The deck is the mapped ring; the render cut is the ring grown by the skirt, seaward of the chord only.
    const sea=halfPlane(c.a,c.b,s),pieces=convexPieces(c.ring);
    const skirt=pieces.map(p=>intersectRings(ccw(grow(p,DECK.skirt)),sea)).filter(p=>p.length>=3&&Math.abs(signedArea(p))>.01).map(ccw);
    for(const p of skirt)cuts.push(cutOf(p));
    // Deck top: the quay level at the root (the deck itself is render-only; the closed pier is sealed and private).
    const rootY=Math.max(...[0,.25,.5,.75,1].map(t=>height(c.a[0]+(c.b[0]-c.a[0])*t-s[0]*1.5,c.a[1]+(c.b[1]-c.a[1])*t-s[1]*1.5)));
    const pier={id:c.id,ring:c.ring,pieces,skirt,top:Math.max(1.5,rootY)+.02,seaward:s,chord:[A,B]};piers.push(pier);
    // Drawn fence: on the quay top only (the low bank/water ends are sealed but not drawn); datum = the quay ground there.
    const datum=(x,z)=>dry(x,z)?Math.max(height(x,z),pier.top-.6):pier.top,hide=(x,z)=>!dry(x,z)||height(x,z)<pier.top-.6;
    if(!c.notch){const mid=[(c.a[0]+c.b[0])/2,(c.a[1]+c.b[1])/2];gates.push({x:mid[0],z:mid[1],ux,uz,half:3.4,y:height(...mid),pier:c.id});}
    else for(const [p,q] of [[c.a,c.notch[0]],[c.notch[1],c.b]]){const m=[(p[0]+q[0])/2,(p[1]+q[1])/2],[ax,az]=unit(p,q);gates.push({x:m[0],z:m[1],ux:ax,uz:az,half:Math.min(3.4,Math.hypot(q[0]-p[0],q[1]-p[1])/2-.6),y:height(...m),pier:c.id});}
    if(c.notch){// Arms: fences; notch: a railing on the quay top (the notch is water-level ground drawn as water).
      // Per station: the landward shift that puts the rail on the quay top; a ±1-station max filter keeps it off the bank
      // without pulling it toward the walk (a ±3 window put it 0.5 m from the riding line).
      const [n0,n1]=c.notch,shift=[];for(let k=0;k<=24;k++){const t=k/24,p=[n0[0]+(n1[0]-n0[0])*t,n0[1]+(n1[1]-n0[1])*t];let d=0;
        for(;d<=6;d+=.25){const q=[p[0]-s[0]*d,p[1]-s[1]*d];if(dry(...q)&&height(...q)>1.35&&height(q[0]-s[0]*.5,q[1]-s[1]*.5)>1.35)break;}shift.push(d);}
      const rail=shift.map((_,k)=>{const d=Math.max(...shift.slice(Math.max(0,k-1),k+2)),t=k/24;return [n0[0]+(n1[0]-n0[0])*t-s[0]*d,n0[1]+(n1[1]-n0[1])*t-s[1]*d];});
      const simple=[rail[0]];for(let k=1;k<rail.length-1;k++){const p=simple.at(-1),q=rail[k+1];if(segmentDistance(...rail[k],p,q)>.25)simple.push(rail[k]);}simple.push(rail.at(-1));
      addRun([A,n0],'chain',datum,undefined,hide);addRun([n0,simple[0]],'chain',datum,undefined,hide);addRun(simple,'rail');addRun([simple.at(-1),n1],'chain',datum,undefined,hide);addRun([n1,B],'chain',datum,undefined,hide);
      pier.rail=simple;pier.line=[A,n0,...simple,n1,B];const notch=ccw([...simple,n1,n0]);closed.push({ring:notch,b:bounds(notch)});}
    else{addRun([A,B],'chain',datum,undefined,hide);pier.line=[A,B];}
    pier.landSign=(-uz*s[0]+ux*s[1])>0?-1:1;   // ribbon offsets along (−uz,ux): landward is the side away from s
    // Private: the ring, its skirt and the notch (everything seaward of the closure line near this pier).
    const hull=ccw(grow(ccw(convexHull([...c.ring,A,B])),DECK.skirt+.5));const zone=intersectRings(hull,halfPlane(A,B,s));
    closed.push({ring:ccw(zone),b:bounds(zone)});}
  // Mooring dolphins (detached rings): render-only platforms; their terrain fragments are cut.
  const dolphins=DOLPHINS.map(r=>{const cut=ccw(grow(ccw(r),1.5));cuts.push(cutOf(cut));closed.push({ring:cut,b:bounds(cut)});return {ring:ccw(r),top:2.1};});
  // Covadonga: concrete perimeter wall where the outside is public dry ground; gates where the access ways cross.
  {const R=COVADONGA,inside=(x,z)=>inRing(x,z,R);
    // A wall piece is not drawn where a building wall already closes the line (inside, or within 0.6 m of its outline:
    // perimeter walls masked the terminal's glazing).
    const blocked=(x,z)=>city.buildings.some(b=>inRing(x,z,b.outer)||b.outer.some((p,j)=>segmentDistance(x,z,p,b.outer[(j+1)%b.outer.length])<.6));
    // Access ways crossing the ring (294776923 Acceso al Terminal; 196837840/294776705 west exit).
    for(const r of city.roads){if(r.kind==='footway')continue;for(let k=0;k+1<r.points.length;k++)for(let i=0;i<R.length;i++){
      const x=segX(r.points[k],r.points[k+1],R[i],R[(i+1)%R.length]);if(!x)continue;const [ux,uz]=unit(R[i],R[(i+1)%R.length]);
      // A service way that enters a building wall right at the boundary needs no gate (the wall is the closure); the bus
      // access 294776923 keeps the RS's shut leaf at (656.4,156.3) in front of the terminal's covered passage.
      const atWall=r.id!==294776923&&city.buildings.some(b=>inRing(x[0],x[1],b.outer)||b.outer.some((p,j)=>segmentDistance(x[0],x[1],p,b.outer[(j+1)%b.outer.length])<1));
      // A crossing at a ring vertex slides along its edge so both posts stand on that one wall run.
      const A=R[i],B=R[(i+1)%R.length],ta=Math.hypot(x[0]-A[0],x[1]-A[1]),tb=Math.hypot(x[0]-B[0],x[1]-B[1]),sh=ta<3.1?3.1-ta:tb<3.1?-(3.1-tb):0,g=[x[0]+ux*sh,x[1]+uz*sh];
      if(!atWall&&!gates.some(q=>Math.hypot(q.x-g[0],q.z-g[1])<4))gates.push({x:g[0],z:g[1],ux,uz,half:3.0,y:height(...g),covadonga:true,road:r.id});}}
    for(let i=0;i<R.length;i++){const a=R[i],b=R[(i+1)%R.length],n=outward(R,i);let k=0;
      for(const f of [.2,.5,.8])for(const o of [1.5,3]){const x=a[0]+(b[0]-a[0])*f+n[0]*o,z=a[1]+(b[1]-a[1])*f+n[1]*o;if(dry(x,z)&&!inside(x,z))k++;}
      if(k<2)continue;addRun([a,b],'wall',height,()=>false,(x,z)=>!dry(x,z)||blocked(x,z));}
    closed.push({ring:R,b:bounds(R)});}
  // Gate leaves replace exactly the fence pieces between their posts (drawn as framed leaves; the seal stays continuous).
  for(const f of fence){const m=[(f.p[0]+f.q[0])/2,(f.p[1]+f.q[1])/2];
    f.gate=gates.some(g=>Math.abs((m[0]-g.x)*g.ux+(m[1]-g.z)*g.uz)<g.half-.01&&Math.abs((m[0]-g.x)*g.uz-(m[1]-g.z)*g.ux)<.1);}
  // Seals: invisible, non-occluding, non-support prisms on every closure piece, plus joints (the Puntilla recipe).
  const groundMax=(p,q)=>{let m=-Infinity;const n=[-(q[1]-p[1]),q[0]-p[0]],l=Math.hypot(...n)||1;
    for(const f of [0,.5,1])for(const o of [-2,-.8,0,.8,2]){const x=p[0]+(q[0]-p[0])*f+n[0]/l*o,z=p[1]+(q[1]-p[1])*f+n[1]/l*o;m=Math.max(m,height(x,z));}return m;};
  const sealPiece=(p,q,lo,hi,half=FENCE.half)=>{const [ux,uz]=unit(p,q),r=[[p[0]-uz*half,p[1]+ux*half],[q[0]-uz*half,q[1]+ux*half],[q[0]+uz*half,q[1]-ux*half],[p[0]+uz*half,p[1]-ux*half]];
    const c=prism(ccw(r),lo,hi);if(c){c.occludes=false;seals.push(c);}};
  for(const f of fence){const top=f.kind==='wall'?FENCE.wall:f.kind==='rail'?FENCE.rail:FENCE.height,lo=Math.min(f.g0,f.g1,f.h0,f.h1)-.3,hi=Math.max(f.g0,f.g1,f.h0,f.h1);
    // The visible wall/rail itself is solid (occluding); the seal reaches 3.5 m above the local ground.
    if(f.kind!=='chain'&&!f.gate&&!f.hidden){const [ux,uz]=unit(f.p,f.q),h=f.kind==='wall'?.18:.06,r=[[f.p[0]-uz*h,f.p[1]+ux*h],[f.q[0]-uz*h,f.q[1]+ux*h],[f.q[0]+uz*h,f.q[1]-ux*h],[f.p[0]+uz*h,f.p[1]-ux*h]];
      prism(ccw(r),lo,hi+top);}
    sealPiece(f.p,f.q,lo,Math.max(groundMax(f.p,f.q)+FENCE.seal,hi+top+.3));}
  {const ends=new Map();for(const f of fence)for(const p of [f.p,f.q]){const k=p.map(v=>v.toFixed(2)).join(',');ends.set(k,p);}
    for(const p of ends.values()){const g=height(...p),c=prism(circle(p[0],p[1],.3,8),g-.3,Math.max(g+FENCE.height+.3,groundMax(p,p)+FENCE.seal));if(c){c.occludes=false;seals.push(c);}}}
  const inClosed=(x,z)=>closed.some(c=>x>=c.b[0]&&x<=c.b[1]&&z>=c.b[2]&&z<=c.b[3]&&inRing(x,z,c.ring));
  const ferry=byId.get(FERRY_ID),inFerry=(x,z)=>!!ferry&&inRing(x,z,ferry.outer);
  // Same test as inClosed||inFerry; sj-private.js keeps only the rings alive, not this layout's scope.
  const offLimitsAt=anyOf(ringsAt(closed.map(c=>({r:c.ring,b:c.b}))),...(ferry?[inRingAt(ferry.outer)]:[]));

  layoutStats.t_surf0=Math.round(performance.now()-T0);
  // ---- Running surfaces: single owner, after every earlier owner, outside masses, closures and PR-1 carriageways. ----
  const earlierRings=[...earlier.flatMap(a=>[...(a.surfaces??[]),...(a.brick??[])].map(s=>s.ring)),
    ...earlier.flatMap(a=>(a.floorTriangles??[]).map(t=>t.map(p=>[p[0],p[2]]))),
    ...earlier.flatMap(a=>(a.tops??[]).map(t=>t.poly.map(p=>[p.x,p.z])))].filter(r=>r.length>=3&&Math.abs(signedArea(r))>1e-4);
  // subtractRing needs convex blockers: masses and closures enter as convex pieces.
  const pieces=r=>{try{return convexPieces(r);}catch{return [ccw(r)];}};
  const masses=city.buildings.filter(b=>{if(b.id===PAVILION_ID)return false;const [x0,x1,z0,z1]=bounds(b.outer);return x1>140&&x0<760&&z1>0&&z0<470;}).map(b=>({ring:b.outer,b:bounds(b.outer),pieces:pieces(b.outer)}));
  const closedPieces=closed.flatMap(c=>pieces(c.ring));
  const roadRings=PR1.map(id=>roadById.get(id)).filter(Boolean).flatMap(r=>ribbon(r.points,-r.width/2,r.width/2));
  const westOfCut=(()=>{const P=[-AX[1],AX[0]];return halfPlane([NODE[0]-P[0],NODE[1]-P[1]],[NODE[0]+P[0],NODE[1]+P[1]],[-AX[0],-AX[1]]);})();
  const eastOfJunction=(()=>{const [ux,uz]=unit([718.312,203.25],JUNCTION_EAST),P=[-uz,ux];
    return halfPlane([JUNCTION_EAST[0]-P[0],JUNCTION_EAST[1]-P[1]],[JUNCTION_EAST[0]+P[0],JUNCTION_EAST[1]+P[1]],[ux,uz]);})();
  const done=[];
  // Blocker bounds once (keep used to recompute ring bounds for every piece × blocker pair).
  const earlierRB=earlierRings.map(r=>({r,b:bounds(r)})),closedRB=closedPieces.map(r=>({r,b:bounds(r)})),roadRB=roadRings.map(r=>({r,b:bounds(r)}));
  const doneRB=[];const pushDone=list=>{for(const r of list){done.push(r);doneRB.push({r,b:bounds(r)});}};
  const halfB=[-1e9,1e9,-1e9,1e9];
  const keep=(pieces,owner,kind,{roads=true}={})=>{const bx=bounds(pieces.flat()),near=list=>list.filter(e=>overlapB(e.b,bx,.5));
    const block=[...near(earlierRB),...masses.filter(m=>overlapB(m.b,bx,.5)).flatMap(m=>m.pieces.map(r=>({r,b:bounds(r)}))),
      ...near(closedRB),...(roads?near(roadRB):[]),...near(doneRB),{r:westOfCut,b:halfB},{r:eastOfJunction,b:halfB}];
    // Pieces of one call can overlap each other (inner mitres): each is cut by the ones already accepted.
    const outB=[];let out=[];for(const piece of pieces.flatMap(p=>convexPieces(p))){const pb=bounds(piece);
      const got=minus([piece],[...block.filter(e=>overlapB(e.b,pb,.5)).map(e=>e.r),...outB.filter(e=>overlapB(e.b,pb,.5)).map(e=>e.r)]);
      for(const r of got){out.push(r);outB.push({r,b:bounds(r)});}}
    out=out.filter(r=>r.every(p=>dry(p[0],p[1]))&&dry(...r.reduce((s,p)=>[s[0]+p[0]/r.length,s[1]+p[1]/r.length],[0,0])));
    for(const ring of out)surfaces.push({kind,ring,owner:'waterfront:'+owner});pushDone(out);return out;};
  // 1. Calle Comercio from Puntilla's section to San Justo (Wikimedia Commons curid=184238581: the blue-grey sett field continues east of the
  //    junction). Half width 3.4 m = Puntilla's junction disc, so the two edges meet flush on the section line.
  const comercio=roadById.get(COMERCIO)?.points??[NODE,SAN_JUSTO_NODE],cPts=[NODE,...comercio.filter(p=>p[0]>NODE[0]+.5&&p[0]<=SAN_JUSTO_NODE[0]+.01)];
  const comercioEnd=(()=>{const [ux,uz]=unit(cPts.at(-2),cPts.at(-1)),P=[-uz,ux],E=SAN_JUSTO_NODE;return halfPlane([E[0]-P[0],E[1]-P[1]],[E[0]+P[0],E[1]+P[1]],[ux,uz]);})();
  keep(minus(ribbon(cPts,-3.4,3.4),[comercioEnd]),COMERCIO,'sett',{roads:false});
  //    Its north (courthouse) sidewalk on the same stretch: dark grey stone slabs (RS Recinto reference: dark stone walks),
  //    so the Inmigrante handoff has no raw mask patch between the setts and the owned courthouse front.
  keep(minus(ribbon(cPts,-9,-3.4),[comercioEnd]),'comercio-north','plaza',{roads:false});
  // 2. Plaza Dársenas: warm-grey/rose slabs (Wikimedia Commons curid=49348487) outside the planting beds and the kiosk/Casita bodies.
  const beds=BEDS.map(([u0,u1,v0,v1])=>ccw([[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>[STATUE[0]+PU[0]*u+PV[0]*v,STATUE[1]+PU[1]*u+PV[1]*v])))
    .filter(r=>r.every(p=>inRing(...p,DARSENAS)&&dry(...p))).map(r=>({ring:r,y:gMin(r)}));
  const plazaPieces=minus(convexPieces(DARSENAS),beds.map(b=>b.ring));keep(plazaPieces,256336227,'panel');
  // 3. The sidewalk between Comercio and the plaza (same slabs; Comercio's south side up to the PR-1 corner).
  if(comercio.length>1)keep(ribbon(comercio,3.4,16).filter(p=>p.every(q=>q[0]<272)),'comercio-south','panel');
  // 3b. The Aduana NE corner: the same slabs fill the strip between service way 22222069's east
  //     edge (4 m road, streets) and the plaza, from the Comercio sidewalk down to the quay, west edge on Puntilla's section
  //     line (keep cuts there). 1 m cells: keep drops a piece with a wet vertex, so the quay edge is followed cell by cell.
  {const svc=roadById.get(22222069);if(svc){const west=ribbon(svc.points,-40,svc.width/2),cells=[];
    for(let x=150;x<166;x++)for(let z=240;z<262;z++)cells.push(...minus([ccw([[x,z],[x+1,z],[x+1,z+1],[x,z+1]])],west));
    keep(cells,'aduana-corner','panel');}}
  // 4a. The mapped bay-side walk 271033267 where the land mask treats it as water ((422,218)…(473.6,204); ):
  //     a paved quay strip from the promenade line to 1.4 m beyond the mapped walk, drawn = physical (replacement tops on
  //     the same triangles), the terrain inside render-cut, a concrete face down to the water on its seaward edge.
  const boardwalk=(()=>{const raw=roadById.get(271033267)?.points;if(!raw)return null;const X0=404.5,X1=486;
    const atX=(pts,x)=>{for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1];if((a[0]-x)*(b[0]-x)<=0&&a[0]!==b[0]){const t=(x-a[0])/(b[0]-a[0]);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}}return null;};
    const land=PROMENADE.filter(p=>p[0]>=X0-1e-6&&p[0]<=X1+1e-6),wet=[atX(raw,X0),...raw.filter(p=>p[0]>X0&&p[0]<X1),atX(raw,X1)];
    const sea=wet.map((p,i)=>{const a=wet[Math.max(0,i-1)],b=wet[Math.min(wet.length-1,i+1)],[ux,uz]=unit(a,b);return [p[0]-uz*1.4,p[1]+ux*1.4];});
    const N=Math.ceil(lengthOf(land)/2),La=lengthOf(land),Sa=lengthOf(sea),pt=(pts,s)=>{const q=along(pts,s);return [q.x,q.z];};
    // Level cross-sections at the promenade height; only the two end sections take the kept terrain at their seaward point
    // (a dry but low shore cell inside the strip must not tilt the deck: found a 0.75 grade there).
    const st=Array.from({length:N+1},(_,k)=>{const L=pt(land,La*k/N),S=pt(sea,Sa*k/N),yL=height(...L),end=k===0||k===N;
      return {L:[L[0],yL,L[1]],S:[S[0],end&&dry(...S)?height(...S):yL,S[1]],low:!dry(...S)||height(...S)<yL-.25};});
    const tris=[],rings=[];for(let k=0;k<N;k++){const A=st[k],B=st[k+1];
      for(const t of [[A.L,B.L,B.S],[A.L,B.S,A.S]]){const r=t.map(p=>[p[0],p[2]]);if(Math.abs(signedArea(r))<1e-3)continue;tris.push(t);rings.push(ccw(r));
        tops.push({poly:t.map(p=>({x:p[0],z:p[2]})),top:Math.max(...t.map(p=>p[1])),plane:plane(t),replacesTerrain:true,maxReferenceY:Math.max(...t.map(p=>p[1]))+2.5,surface:'pavement',source:'waterfront-boardwalk'});
        cuts.push(cutOf(ccw(r)));}}
    pushDone(rings);return {tris,edge:st.map(q=>({p:q.S,wet:q.low,inward:unit([q.S[0],q.S[2]],[q.L[0],q.L[2]])})),rings,wet};})();

  // 4. Bay-front promenade: pale slabs on dry ground, variable widths (seaward to 0.6 m from the mapped water, landward to
  //    the PR-1 kerb when within 6 m), ending flush on the Muelle 4 / Bahía Urbana section.
  const stations=[];{const L=lengthOf(PROMENADE);let acc=0;
    for(let i=0;i+1<PROMENADE.length;i++){const a=PROMENADE[i],b=PROMENADE[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(l/2));
      for(let k=0;k<n;k++){const t=k/n;stations.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,s:acc+l*t,seg:i,vertex:k===0});}acc+=l;}
    stations.push({x:JUNCTION_EAST[0],z:JUNCTION_EAST[1],s:L,seg:PROMENADE.length-2,vertex:true});}
  const segN=PROMENADE.slice(1).map((b,i)=>{const [ux,uz]=unit(PROMENADE[i],b);return [-uz,ux];});
  const waterDist=(x,z,n)=>{for(let d=.25;d<=8;d+=.25)if(!dry(x+n[0]*d,z+n[1]*d)||inClosed(x+n[0]*d,z+n[1]*d))return d;return 8;};
  const roadB=roadRings.map(r=>({r,b:bounds(r)}));
  const roadDist=(x,z,n)=>{const near=roadB.filter(e=>overlapB(e.b,[x-10,x+10,z-10,z+10])).map(e=>e.r);if(!near.length)return 99;
    for(let d=.25;d<=8;d+=.25)if(near.some(r=>inRing(x+n[0]*d,z+n[1]*d,r)))return d;return 99;};
  // The bay is on the +n side ((−uz,ux): south for the west→east line); each side's width follows its own probes.
  stations.forEach((st,i)=>{const last=i===stations.length-1,a=segN[last?st.seg:Math.max(0,st.vertex?st.seg-1:st.seg)],b=segN[st.seg];
    let mx=a[0]+b[0],mz=a[1]+b[1];const m=Math.hypot(mx,mz)||1;mx/=m;mz/=m;
    const k=1/Math.max(.55,mx*b[0]+mz*b[1]);st.n=[mx*k,mz*k];st.sea=1;
    const wSea=waterDist(st.x,st.z,[mx,mz]),wLand=waterDist(st.x,st.z,[-mx,-mz]),rd=roadDist(st.x,st.z,[-mx,-mz]);
    st.wSea=wSea;st.seaHalf=Math.max(.8,Math.min(2.6,wSea-.6));st.landHalf=Math.max(.8,Math.min(rd<10?rd+.05:2.6,wLand-.6));});
  // Smooth the widths (no saw edges from the 0.25 m water probe).
  for(const key of ['seaHalf','landHalf']){const v=stations.map(s=>s[key]);stations.forEach((s,i)=>{s[key]=Math.min(v[i],...[i-1,i+1].filter(j=>j>=0&&j<v.length).map(j=>v[j]+.5));});}
  const off=(st,d)=>[st.x+st.n[0]*d,st.z+st.n[1]*d];
  const promQuads=[];for(let i=0;i+1<stations.length;i++){const A=stations[i],B=stations[i+1],sa=A.sea,sb=B.sea;
    // Two halves per interval (merge round): a seaward half that meets the water no longer drops the landward half too
    // (whole-width drops left diagonal unpaved stripes at x 309–313 and 323–327); the quay deck fills seaward gaps.
    for(const q of [[[A.x,A.z],[B.x,B.z],off(B,-sb*B.landHalf),off(A,-sa*A.landHalf)],[off(A,sa*A.seaHalf),off(B,sb*B.seaHalf),[B.x,B.z],[A.x,A.z]]])
      if(Math.abs(signedArea(q))>1e-3)promQuads.push(ccw(q));}
  // the west ferry planter's public toe (the DEM tent) is a dark stone apron, so the rise reads as a
  // planter base on its own paving rather than tilted promenade slabs (drape: drawn = physical; grade unchanged).
  if(ferry){const a=[330.49,245.188],b=[367.237,235.259],[ux,uz]=unit(a,b),P=u=>[a[0]+ux*u,a[1]+uz*u];
    keep(ribbon([P((332.6-a[0])/ux-1),P((342-a[0])/ux+1)],-3.0,-1.15),'ferry-planter-apron','plaza');}
  // along the Covadonga reach the promenade's landward edge is
  // one intentional 0.5 m dark-stone border (the plaza slab kit) between the planters and the road, instead of slabs
  // running straight into the carriageway kerb. Drape (drawn = physical), claimed before the promenade slabs.
  {const pts=stations.filter(st=>st.x>=545&&st.x<=712).map(st=>off(st,-st.sea*(st.landHalf-.25)));if(pts.length>2)keep(ribbon(pts,-.25,.25),'covadonga-border','plaza');}
  const promenade=keep(promQuads,271033267,'paseo');
  layoutStats.t_quay0=Math.round(performance.now()-T0);
  // 4b. Finished quay edge along the promenade (merge round, coast integration: `coast` yields every shore edge this area
  //     touches, so the mask's stair-steps at (322–330, 244–246), (576, 196) … were left raw). From the promenade line to
  //     a smoothed line at or beyond the mapped water (±3-station max of the first-wet distance), the gaps the paving left
  //     get a paved deck: replacement tops on exactly the drawn triangles (vertex y = terrain where dry, else the level of
  //     the paving edge), terrain render-cut inside, a concrete face with a pale coping down to the water on the outer line.
  //     Not where the paving already reaches 6 m of dry ground, not in the existing quay strip, closures, buildings or the
  //     planter.
  const tq0=performance.now();const onDeck=(x,z)=>quayRings().some(r=>inRing(x,z,r));let quayRings=()=>[];
  const ferryR=ferry?convexPieces(ferry.outer):[],blockRings=[...closed.flatMap(c=>pieces(c.ring).map(r=>ccw(grow(r,.3)))),...ferryR,...(boardwalk?.rings??[]),
    ...masses.flatMap(m=>m.pieces)];
  const withB=list=>list.map(r=>({r,b:bounds(r)}));
  // sts: [{x,z,n (seaward, mitred),wSea,seaHalf}] — the inner line; the deck runs to a smoothed outer line at or beyond the
  // mapped water (±8-station max, three ±3 averages, so the edge reads as one finished line, not a wavy cut).
  const deckAlong=(sts,use,source)=>{const tris=[],rings=[],faces=[],n=sts.length;
    let D=sts.map((st,i)=>{let m=st.wSea;for(let j=Math.max(0,i-8);j<=Math.min(n-1,i+8);j++)m=Math.max(m,sts[j].wSea);return Math.min(m+.05,st.seaHalf+3.5);});
    for(let it=0;it<3;it++)D=D.map((d,i)=>{let s2=0,c=0;for(let j=Math.max(0,i-3);j<=Math.min(n-1,i+3);j++){s2+=D[j];c++;}return Math.max(s2/c,Math.min(sts[i].wSea+.05,sts[i].seaHalf+3.5));});
    const qb=bounds(sts.flatMap(st=>[[st.x-12,st.z-12],[st.x+12,st.z+12]]));
    const blockB=withB(blockRings).filter(e=>overlapB(e.b,qb)),earlierB=withB(earlierRings).filter(e=>overlapB(e.b,qb)),doneB=withB(done).filter(e=>overlapB(e.b,qb));
    for(let i=0;i+1<n;i++){if(!use[i]||!use[i+1])continue;const A=sts[i],B=sts[i+1];
      const q=ccw([[A.x,A.z],[B.x,B.z],off(B,D[i+1]),off(A,D[i])]);if(Math.abs(signedArea(q))<1e-3)continue;
      const bb=bounds(q),hit=list=>list.filter(e=>overlapB(e.b,bb,.5)).map(e=>e.r);let out=minus([q],[...hit(blockB),...hit(earlierB),...rings.filter(r=>overlapB(bounds(r),bb,.5))]);
      // Only the part not already paved (the paving keeps its drape; the deck fills its gaps).
      out=minus(out,hit(doneB));
      const edgeY=height(...off(A,Math.max(0,Math.min(A.seaHalf,A.wSea-.6)))),edgeYB=height(...off(B,Math.max(0,Math.min(B.seaHalf,B.wSea-.6))));
      const yAt=(x,z)=>{if(dry(x,z))return height(x,z);const t=Math.max(0,Math.min(1,((x-A.x)*(B.x-A.x)+(z-A.z)*(B.z-A.z))/((B.x-A.x)**2+(B.z-A.z)**2||1)));return edgeY+(edgeYB-edgeY)*t;};
      for(const r of out){if(Math.abs(signedArea(r))<.01)continue;rings.push(r);
        for(let k=1;k+1<r.length;k++){const t=[r[0],r[k],r[k+1]].map(([x,z])=>[x,yAt(x,z),z]);if(Math.abs(signedArea([r[0],r[k],r[k+1]]))<1e-4)continue;tris.push(t);
          tops.push({poly:t.map(p=>({x:p[0],z:p[2]})),top:Math.max(...t.map(p=>p[1])),plane:plane(t),replacesTerrain:true,maxReferenceY:Math.max(...t.map(p=>p[1]))+2.5,surface:'pavement',source});
          cuts.push(cutOf(ccw([r[0],r[k],r[k+1]])));}}
      // Face on the outer line where the deck reaches it (with its inward normal for coping/bollards).
      const oa=off(A,D[i]),ob=off(B,D[i+1]),l=Math.hypot(...A.n)||1,mid=[(oa[0]+ob[0])/2-A.n[0]/l*.05,(oa[1]+ob[1])/2-A.n[1]/l*.05];
      if(out.some(r=>inRing(...mid,r)))faces.push({a:[oa[0],yAt(...oa),oa[1]],b:[ob[0],yAt(...ob),ob[1]],inward:[-A.n[0]/l,-A.n[1]/l]});}
    pushDone(rings);return {tris,rings,faces};};
  const quay=(()=>{const X0=404.5,X1=486;const q=deckAlong(stations,stations.map(st=>st.wSea<6&&!(st.x>X0-.5&&st.x<X1+.5)),'waterfront-quay');
    // Plaza Dársenas' quay (the park's mapped quay edge 256336227) gets the same finished deck edge instead of a
    // lumpy lawn dropping to the water: inner line 3.5 m inside the mapped edge, seaward normal toward the bay.
    const Q0=DARSENAS[0],Q1=DARSENAS[DARSENAS.length-1],[ux,uz]=unit(Q0,Q1),nn=[-uz,ux],L=Math.hypot(Q1[0]-Q0[0],Q1[1]-Q0[1]),k=Math.ceil(L/2);
    const ps=Array.from({length:k+1},(_,i)=>{const x=Q0[0]+(Q1[0]-Q0[0])*i/k-nn[0]*3.5,z=Q0[1]+(Q1[1]-Q0[1])*i/k-nn[1]*3.5;return {x,z,n:nn,wSea:waterDist(x,z,nn),seaHalf:0};});
    const p=deckAlong(ps,ps.map(st=>st.wSea<8),'waterfront-plaza-quay');
    return {tris:[...q.tris,...p.tris],rings:[...q.rings,...p.rings],faces:[...q.faces,...p.faces]};})();quayRings=()=>[...quay.rings,...(boardwalk?.rings??[])];
  layoutStats.quayMs=Math.round(performance.now()-tq0);
  // mooring bollards every ~12 m along every finished quay edge (deck faces and the strip's wet edge), 0.55 m in
  // from the edge, solid; never by a fence, gate or another bollard.
  const edgeBollards=[];{const segs=[...quay.faces.map(f=>({a:f.a,b:f.b,inward:f.inward})),
      ...(boardwalk?boardwalk.edge.slice(1).map((e,i)=>({a:boardwalk.edge[i].p,b:e.p,inward:e.inward,wet:e.wet&&boardwalk.edge[i].wet})).filter(s=>s.wet):[])];
    let acc=6;for(const sg of segs){const L=Math.hypot(sg.b[0]-sg.a[0],sg.b[2]-sg.a[2]);acc+=L;if(acc<12)continue;
      const x=(sg.a[0]+sg.b[0])/2+sg.inward[0]*.55,z=(sg.a[2]+sg.b[2])/2+sg.inward[1]*.55;
      if(fence.some(f=>segmentDistance(x,z,f.p,f.q)<2.5)||edgeBollards.some(o=>Math.hypot(o.x-x,o.z-z)<9)||!dry(x,z)&&!onDeck(x,z))continue;
      const y=(sg.a[1]+sg.b[1])/2;edgeBollards.push({x,z,y});prism(circle(x,z,.2,8),y-.1,y+.55);acc=0;}}

  // (harbour-piers-edge-485_201-out): the strip of raw ground the paving left between its seaward
  // edge and each pier closure line (fence, gate, notch railing) gets a dark stone sill band on the public side, butting the
  // slab grid; a drape (drawn = physical), only where nothing else (paving, quay deck) is paved.
  for(const pr of piers){const w=1.6*pr.landSign,l0=pr.line.filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.05);
    // the sill returns 1.5 m past each end of the closure line (the gravel wedge at the fence end).
    const ext=(p,q)=>{const [ux,uz]=unit(q,p);return [p[0]+ux*1.5,p[1]+uz*1.5];},line=[ext(l0[0],l0[1]),...l0,ext(l0.at(-1),l0.at(-2))];
    keep(ribbon(line,Math.min(0,w),Math.max(0,w)),'sill-'+pr.id,'plaza');}

  // 5. Ferry frontage apron (Muelle 2's public street side, Wikimedia Commons curid=182041799 / RS: exterior frontage public) up to the terminal face.
  if(ferry){const front=[[330.49,245.188],[367.237,235.259],[404.522,225.186]];keep(ribbon(front,-9,0).concat(ribbon(front,0,9)),'ferry-apron','panel');}

  // 6. Covadonga's public apron (RS: a ground-level public-facing apron in front of the closed compound), PR-1 kerb to wall.
  // the apron meets the streets handoff exactly — west of the
  //    station line S (x 645.5, perpendicular to 60330127) it reaches the sett kerb line (635.07,163.72)→(645.5,164.50),
  //    returns square along S, and east of S stops at the asphalt kerb line (645.5,161.47)→(648.10,161.59)→(658.67,162.08)
  // Same drape height as the street: no lip; nothing solid on S.
  {const front=[[616.403,149.095],[622.318,153.743],[656.446,156.288],[673.958,157.206]];
    const W=ccw([[630,163.344],[645.5,164.5],[645.5,185],[630,185]]),E=ccw([[645.5,161.47],[648.1,161.59],[658.67,162.08],[690,163.533],[690,185],[645.5,185]]);
    keep(minus(ribbon(front,0,9),[W,...convexPieces(E)]),'covadonga-apron','paseo');}

  // ---- Paving physics: where these slabs lie on cells the ground mask classes as lawn (the Dársenas park,
  // the Bahía edge of the promenade), the rider must feel pavement, not grass (rolling resistance 2.8 vs 0.35 stalled the
  // destinations driver at the Muelle 4 junction). Support tops on exactly the terrain triangles under the slabs (clipped to
  // each slab piece, the same planes, so the sampler selects them at equal height), surface 'pavement'; drawn geometry is unchanged.
  // the same ride feel from the ground-mask class (sj-world `groundClass` hook) instead of 2,780 support tops:
  // lawn-class cells whose centre lies under these slabs ride as sidewalk; nothing drawn changes.
  const groundCells=[];if(surface){const {x0,z0,step,nx}=terrain,seen=new Set();
    for(const sp of [...surfaces.map(q=>q.ring),...quay.rings]){const [bx0,bx1,bz0,bz1]=bounds(sp);
      for(let j=Math.floor((bz0-z0)/step);j<=Math.floor((bz1-z0)/step);j++)for(let i=Math.floor((bx0-x0)/step);i<=Math.floor((bx1-x0)/step);i++){
        const k=j*nx+i;if(surface[k]!==2||seen.has(k))continue;if(inRing(x0+(i+.5)*step,z0+(j+.5)*step,sp)){seen.add(k);groundCells.push(k);}}}
    layoutStats.groundCells=groundCells.length;}

  layoutStats.t_tint0=Math.round(performance.now()-T0);
  // ---- Bed lawn tint (terrain vertices inside the beds; earlier owners keep theirs). ----
  {const {x0,z0,step,nx}=terrain,taken=k=>earlier.some(a=>a.tint?.has(k));
    for(const b of beds){const [bx0,bx1,bz0,bz1]=bounds(b.ring);
      for(let j=Math.floor((bz0-z0)/step);j<=Math.ceil((bz1-z0)/step);j++)for(let i=Math.floor((bx0-x0)/step);i<=Math.ceil((bx1-x0)/step);i++){
        const x=x0+i*step,z=z0+j*step,k=j*nx+i;if(!taken(k)&&inRing(x,z,grow(b.ring,.9)))tint.set(k,LAWN[hash(i,j,21)<.5?0:1]);}}}

  layoutStats.t_dress0=Math.round(performance.now()-T0);
  // furniture standing on the quay strip / finished quay deck is seated on that drawn deck
  // surface (its replacement tops), not on the render-cut terrain under it; elsewhere on the terrain as before.
  const deckTris=[...(boardwalk?.tris??[]),...(quay?.tris??[])].map(t=>({t,b:bounds(t.map(p=>[p[0],p[2]]))}));
  const footAt=(x,z,r)=>Math.min(...[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]].map(([a,b])=>surfY(x+a,z+b)))-.04;
  const surfY=(x,z)=>{for(const {t,b} of deckTris){if(x<b[0]-1e-6||x>b[1]+1e-6||z<b[2]-1e-6||z>b[3]+1e-6)continue;const [A,B,C]=t;
      const d=(B[2]-C[2])*(A[0]-C[0])+(C[0]-B[0])*(A[2]-C[2]);if(Math.abs(d)<1e-9)continue;const l1=((B[2]-C[2])*(x-C[0])+(C[0]-B[0])*(z-C[2]))/d,l2=((C[2]-A[2])*(x-C[0])+(A[0]-C[0])*(z-C[2]))/d,l3=1-l1-l2;
      if(l1>=-1e-6&&l2>=-1e-6&&l3>=-1e-6)return l1*A[1]+l2*B[1]+l3*C[1];}return height(x,z);};
  // ---- Dressing (all on dry public ground, clear of the running lines). ----
  const lamps=[],portLamps=[],benches=[],palms=[],shrubs=[],bollards=[],statue={x:STATUE[0],z:STATUE[1],y:gMin(circle(...STATUE,.9,6))};
  const nearPR1=(x,z,m)=>roadRings.some(r=>{const [a,b,c,d]=bounds(r);return x>=a-m&&x<=b+m&&z>=c-m&&z<=d+m&&(inRing(x,z,r)||r.some((p,i)=>segmentDistance(x,z,p,r[(i+1)%r.length])<m));});
  const inMass=(x,z,m=0)=>masses.some(o=>x>=o.b[0]-m&&x<=o.b[1]+m&&z>=o.b[2]-m&&z<=o.b[3]+m&&(inRing(x,z,o.ring)||m>0&&o.ring.some((p,i)=>segmentDistance(x,z,p,o.ring[(i+1)%o.ring.length])<m)));
  // Dressing also keeps clear of the mapped walk 271033267 and stays off the quay strip (a lamp blocked the walk).
  const rawWalk=roadById.get(271033267)?.points??[],onStrip=(x,z)=>!!boardwalk&&boardwalk.rings.some(r=>inRing(x,z,r));
  const occupied=[],edgePlanters=[];const free=(x,z,r)=>dry(x,z)&&nearLine(rawWalk,x,z)>Math.max(1.2,r+.6)&&!onStrip(x,z)&&!offLimitsAt(x,z)&&!inMass(x,z,r)&&!nearPR1(x,z,r)&&!occupied.some(o=>Math.hypot(o.x-x,o.z-z)<r+o.r)
    &&[0,Math.PI/2,Math.PI,1.5*Math.PI].every(a=>dry(x+Math.cos(a)*(r+.5),z+Math.sin(a)*(r+.5)))&&!fence.some(f=>segmentDistance(x,z,f.p,f.q)<r+.6);
  const benchAt=(x,z,heading)=>{const c=Math.cos(heading),s=Math.sin(heading),legs=[-.72,.72].map(u=>({u,ground:Math.min(...[-.25,.25].map(d=>surfY(x+c*u+s*d,z-s*u+c*d)))}));
    const all=[-.72,.72].flatMap(u=>[-.25,.25].map(d=>surfY(x+c*u+s*d,z-s*u+c*d)));if(Math.max(...all)-Math.min(...all)>.24)return null;
    for(const u of [-1.1,0,1.1])for(const d of [-.4,.4])if(!free(x+c*u+s*d,z-s*u+c*d,.2))return null;
    return {x,z,y:Math.max(...all),legs,heading,width:1.9,depth:.6,height:.95};};
  const take=(o,r)=>{occupied.push({x:o.x,z:o.z,r});return o;};
  // Plaza: palms in the beds (Wikimedia Commons curid=49348487's fan palms), dark lanterns at the bed corners, benches facing the paths.
  occupied.push({x:statue.x,z:statue.z,r:1.6});
  for(const [bi,b] of beds.entries()){const [u0,u1,v0,v1]=BEDS[bi],P=(u,v)=>[STATUE[0]+PU[0]*u+PV[0]*v,STATUE[1]+PU[1]*u+PV[1]*v];
    for(const u of [u0+2.6,u1-2.6]){const [x,z]=P(u,(v0+v1)/2);palms.push(take({x,z,y:surfY(x,z),yaw:hash(bi,Math.round(u))*6.28,bed:bi},1));}
    for(let u=u0+1.2;u<u1-.6;u+=1.5){const [x,z]=P(u,(v0+v1)/2+(hash(bi,Math.round(u*3))-.5)*1.6);if(palms.some(p=>Math.hypot(p.x-x,p.z-z)<1.3))continue;shrubs.push({x,z,y:surfY(x,z),s:.45+hash(bi,Math.round(u*7))*.25});}
    for(const [u,v] of [[u0-.9,v0-.9],[u1+.9,v1+.9]]){const [x,z]=P(u,v);if(free(x,z,.5))lamps.push(take({x,z,y:surfY(x,z),base:false},.5));}
    {const v=v0<0?v0-1.6:v1+1.6,[x,z]=P((u0+u1)/2,v),hd=Math.atan2(PU[0],PU[1]),bh=b=>benchAt(x,z,b);const bb=bh(v0<0?hd:hd+Math.PI);if(bb)benches.push(take(bb,1.2));}}
  // Palm row along the plaza's quay edge (Wikimedia Commons curid=49348487 background) and a pair framing La Casita's porch.
  {const q0=[170.49,277.986],q1=[273.653,249.893],[ux,uz]=unit(q0,q1),L=Math.hypot(q1[0]-q0[0],q1[1]-q0[1]);
    for(let u=10;u<L-6;u+=11){const x=q0[0]+ux*u-uz*-3.6,z=q0[1]+uz*u+ux*-3.6;if(free(x,z,1))palms.push(take({x,z,y:surfY(x,z),yaw:hash(Math.round(u),3)*6.28},1));}}
  // Promenade: angular port lamps on the seaward side, palms on the landward side (Wikimedia Commons curid=110093131's palm-lined front), benches
  // looking at the bay. Every item keeps the central 2 m riding line clear.
  {const L=lengthOf(PROMENADE);const at=s=>{let best=stations[0];for(const st of stations)if(Math.abs(st.s-s)<Math.abs(best.s-s))best=st;return best;};
    for(let s=14,k=0;s<L-4;s+=8,k++){const st=at(s),sea=st.sea;
      if(k%4===0&&st.seaHalf>1.9){const [x,z]=off(st,sea*(st.seaHalf-.55));if(free(x,z,.4))portLamps.push(take({x,z,y:surfY(x,z),face:Math.atan2(st.n[0]*sea,st.n[1]*sea)},.5));}
      if(k%2===0&&st.landHalf>2.3){const [x,z]=off(st,-sea*(st.landHalf-1.0));if(free(x,z,.9))palms.push(take({x,z,y:surfY(x,z),yaw:hash(k,9)*6.28},.9));}
      // Benches between the palms: looking at the bay from the seaward edge, or at the walk from the landward side.
      if(k%4===1&&st.seaHalf>2.2){const [x,z]=off(st,sea*(st.seaHalf-.7)),b=benchAt(x,z,Math.atan2(-st.n[0]*sea,-st.n[1]*sea));if(b)benches.push(take(b,1.2));}
      if(k%4===3&&st.landHalf>3.2){const [x,z]=off(st,-sea*(st.landHalf-.9)),b=benchAt(x,z,Math.atan2(st.n[0]*sea,st.n[1]*sea));if(b)benches.push(take(b,1.2));}}
    // (san-cristobal-edge-578_192-in): along the Covadonga reach the landward edge between the
    // palms gets low planters (pale coping, shrubs; Wikimedia Commons curid=49348487's planting vocabulary, not La Casita's beds) so the edge to
    // the road has a border rhythm. Solid to 0.45 m like the plaza beds; inner edge 1.55 m off the line (the 2 m riding line stays clear); gaps between.
    for(let s=22;s<L-4;s+=16){const st=at(s),sea=st.sea;if(st.x<540||st.x>712||st.landHalf<2.4)continue;const d=st.landHalf-.6,[x,z]=off(st,-sea*d);
      if(!free(x,z,1.0)||occupied.some(o=>Math.hypot(o.x-x,o.z-z)<1.7+o.r))continue;const t=[st.n[1],-st.n[0]],P=(u,v)=>[x+t[0]*u+st.n[0]*v,z+t[1]*u+st.n[1]*v],ring=ccw([P(-1.5,-.45),P(1.5,-.45),P(1.5,.45),P(-1.5,.45)]);
      if(!ring.every(q=>dry(...q)))continue;const lo=gMin(sampleRing(ring,.5)),top=gMax(sampleRing(ring,.5))+.45;
      edgePlanters.push(take({x,z,ring,lo,top,length:3,width:.9,ry:-Math.atan2(t[1],t[0]),shrubs:[-1,0,1].map(u=>{const q=P(u,0);return {x:q[0],z:q[1]};})},1.7));}}
  // Pier decks: mooring bollards along the free edges (render-only, closed decks).
  for(const p of piers){const r=p.ring;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<12)continue;
      const n=outward(r,i),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(segmentDistance(...mid,PIER_CHORDS.find(c=>c.id===p.id).a,PIER_CHORDS.find(c=>c.id===p.id).b)<2)continue;
      for(let u=6;u<L-4;u+=14){const t=u/L;bollards.push({x:a[0]+(b[0]-a[0])*t-n[0]*.55,z:a[1]+(b[1]-a[1])*t-n[1]*.55,y:p.top,pier:p.id});}}}
  // Solids: palms, lanterns, port lamps, benches, the sculpture, bed fences (low iron, Wikimedia Commons curid=49348487), pavilion posts and canopy.
  for(const p of palms)prism(circle(p.x,p.z,.24,8),p.y-.15,p.y+3.5);
  for(const l of lamps){l.foot=footAt(l.x,l.z,.18);prism(circle(l.x,l.z,.22,8),Math.min(l.y-.1,l.foot),l.y+3.6);}
  for(const l of portLamps){l.foot=footAt(l.x,l.z,.16);prism(circle(l.x,l.z,.18,8),Math.min(l.y-.1,l.foot),l.y+4.8);}
  for(const b of benches){const c=Math.cos(b.heading),s=Math.sin(b.heading),r=[[-1,-.32],[1,-.32],[1,.32],[-1,.32]].map(([u,d])=>[b.x+c*u+s*d,b.z-s*u+c*d]);
    prism(ccw(r),Math.min(...b.legs.map(l=>l.ground))-.1,b.y+.95);}
  {const r=ccw([[-.8,-.8],[.8,-.8],[.8,.8],[-.8,.8]].map(([u,v])=>[statue.x+PU[0]*u+PV[0]*v,statue.z+PU[1]*u+PV[1]*v]));statue.ring=r;statue.top=gMax(r)+1.9;prism(r,statue.y-.15,statue.top+2.1);}
  for(const b of beds){b.top=gMax(b.ring)+.45;prism(b.ring,b.y-.15,b.top);}
  for(const p of edgePlanters)prism(p.ring,p.lo-.2,p.top);
  let pavilion=null;{const b=byId.get(PAVILION_ID);if(b){const r=ccw(b.outer),g=gMax(r),posts=[];
      for(let i=0;i<r.length;i++){const a=r[i],n=outward(r,i);const p=[a[0]-n[0]*.35,a[1]-n[1]*.35];if(posts.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<2.2))continue;posts.push(p);}
      pavilion={ring:r,canopyRing:ccw(r.map(p=>p)),posts:posts.map(p=>({x:p[0],z:p[1],y:height(...p)})),canopy:g+3.1,thick:.28};
      for(const p of pavilion.posts)prism(circle(p.x,p.z,.18,8),p.y-.1,pavilion.canopy);
      prism(pavilion.canopyRing,pavilion.canopy,pavilion.canopy+pavilion.thick);}}

  // A moored Cataño ferry (Wikimedia Commons curid=182041799: the boat at the terminal's water face): render-only, on open water, unreachable.
  const boat=(()=>{const a=[395.8,274.9],b=[401.7,295.2],[ux,uz]=unit(a,b),nO=[uz,-ux],c=[(a[0]+b[0])/2+nO[0]*7.5,(a[1]+b[1])/2+nO[1]*7.5];
    const ok=[-14,0,14].every(t=>[-4,4].every(o=>!dry(c[0]+ux*t+nO[0]*o,c[1]+uz*t+nO[1]*o)));return ok?{x:c[0],z:c[1],ux,uz,length:26,beam:8.4}:null;})();

  // Muelle 2's east frontage: the DEM drops ~1.2 m into a nook within 1 m of the terminal face between x 388
  // and 404.5, where a rider who crashed there found no recovery placement. A long concrete planter (inferred) fills that
  // nook as one solid, so a crash stops on the level apron in front of it.
  const ferryPlanter=(()=>{if(!ferry)return null;const a=[367.237,235.259],b=[404.522,225.186],[ux,uz]=unit(a,b),L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[uz,-ux];
    const u0=(388-a[0])/ux,u1=L,w=1.2,P=(u,d)=>[a[0]+ux*u+n[0]*d,a[1]+uz*u+n[1]*d],ring=ccw([P(u0,-.05),P(u1,-.05),P(u1,w),P(u0,w)]);
    const lo=gMin(sampleRing(ring,.5)),top=gMax(sampleRing(ring,.5).filter(q=>dry(...q)))+.55;prism(ring,lo-.2,top);
    return {ring,a:P(u0,w/2),b:P(u1,w/2),length:u1-u0,width:w,lo,top,ry:-Math.atan2(uz,ux),shrubs:Array.from({length:Math.floor((u1-u0)/1.6)},(_,i)=>{const q=P(u0+.8+i*1.6,w/2);return {x:q[0],z:q[1]};})};})();
  // Merge round: the same treatment where the canopy DEM rises against the west front (x 333–341, a 3.3 m tent of paving).
  const ferryPlanterW=(()=>{if(!ferry)return null;const a=[330.49,245.188],b=[367.237,235.259],[ux,uz]=unit(a,b),n=[uz,-ux];
    const u0=(332.6-a[0])/ux,u1=(342-a[0])/ux,w=1.2,P=(u,d)=>[a[0]+ux*u+n[0]*d,a[1]+uz*u+n[1]*d],ring=ccw([P(u0,-.05),P(u1,-.05),P(u1,w),P(u0,w)]);
    const lo=gMin(sampleRing(ring,.5)),top=gMax(sampleRing(ring,.5).filter(q=>dry(...q)))+.55;prism(ring,lo-.2,top);
    return {ring,a:P(u0,w/2),b:P(u1,w/2),length:u1-u0,width:w,lo,top,ry:-Math.atan2(uz,ux),shrubs:Array.from({length:Math.floor((u1-u0)/1.6)},(_,i)=>{const q=P(u0+.8+i*1.6,w/2);return {x:q[0],z:q[1]};})};})();

  layoutStats.t_places0=Math.round(performance.now()-T0);
  // Handoff corner (full-suite route defect 2026-11-18): east of x ≈ 727.3 the DEM bank under the outer 1.8 m of the walk
  // (z ≥ 204.0) falls 0.4–0.8 m in under a metre inside `bahia`'s railing; a rider on those lanes met a steep face. A short
  // railing return on this side of the line closes the outer lanes onto the bank, from the walk to the finished quay edge,
  // meeting bahia's railing start at (727.41, 205.16). Visible and solid (no seal); the inner lanes stay open across the line.
  const handoffRail=(()=>{const a=[727.3,204.2],b=[727.3,205.95],L=Math.hypot(b[0]-a[0],b[1]-a[1]),k=Math.max(1,Math.round(L/1.5)),pts=[];
    for(let i=0;i<=k;i++){const t=i/k,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;pts.push([x,z,height(x,z)]);}
    const y=Math.max(...pts.map(p=>p[2])),r=ccw([[a[0]-.06,a[1]],[b[0]-.06,b[1]],[b[0]+.06,b[1]],[a[0]+.06,a[1]]]);prism(r,Math.min(...pts.map(p=>p[2]))-.3,y+1.08);
    return {pts,y,height:1.08};})();

  // ---- Map arrivals on public approaches. ----
  const places=[{name:'Plaza Dársenas',x:219,z:244,source:256336227},{name:'Terminal de Cataño',x:370,z:231.95,source:FERRY_ID},
    {name:'Terminal Covadonga',x:625,z:165.7,source:60252431}];

  // Destination-graph hook: the authored promenade is the riding line; the mapped way it
  // replaces stays in the graph as provenance at a high cost (its Muelle 3 notch reach passes 1.2 m from the railing).
  const routeLines=[{name:'authored waterfront promenade',points:PROMENADE}],supersededWays=[271033267];
  const layout={groundClass:{cells:Uint32Array.from(groundCells),cls:0},routeLines,supersededWays,colliders,tops,cuts,tint,surfaces,floorTriangles,places,buildingOverrides,offLimitsAt,ownedBuildings,
    facades,piers,dolphins,boat,boardwalk,quay,edgeBollards,handoffRail,ferryPlanter,ferryPlanterW,edgePlanters,fence,gates,seals,beds,lamps,portLamps,benches,palms,shrubs,bollards,statue,pavilion,promenade,stations,
    constants:{FENCE,DECK,NODE,AX,JUNCTION_EAST,STYLES}};
  layout.qa=()=>({surfaces:surfaces.length,kinds:Object.fromEntries(['sett','panel','paseo'].map(k=>[k,surfaces.filter(s=>s.kind===k).length])),
    colliders:colliders.length,seals:seals.length,fence:fence.length,gates:gates.length,cuts:cuts.length,owned:ownedBuildings.length,
    lamps:lamps.length,portLamps:portLamps.length,benches:benches.length,palms:palms.length,beds:beds.length,bollards:bollards.length,edgePlanters:edgePlanters.length,
    facadeFaces:facades.reduce((s,f)=>s+f.faces.length,0),...layoutStats,promenadeArea:+promenade.reduce((s,r)=>s+Math.abs(signedArea(r)),0).toFixed(1)});
  return layout;
}

function segX(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;
  return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+r[0]*t,a[1]+r[1]*t]:null;}
function convexHull(pts){const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],hi=[];for(const q of p){while(lo.length>=2&&cr(lo.at(-2),lo.at(-1),q)<=0)lo.pop();lo.push(q);}
  for(const q of [...p].reverse()){while(hi.length>=2&&cr(hi.at(-2),hi.at(-1),q)<=0)hi.pop();hi.push(q);}
  return lo.slice(0,-1).concat(hi.slice(0,-1));}
