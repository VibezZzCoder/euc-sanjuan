/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// La Perla district below the north wall — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// Area module (contract: header of sj-princesa-layout.js), registered after perlaWest.
// Reference imagery (Wikimedia Commons curid=80155724, curid=109811940, curid=99177715, curid=72372072, curid=72372077, curid=158401715, curid=100291752, curid=72372066, curid=80251220, curid=72372078, curid=12081006, curid=86543919, curid=86543964, curid=86543904, curid=86543903, curid=86543901, curid=109811939, curid=86543932, curid=137763018). Mapped: residential landuse 1189502372, the street/footway ways below, court 256387098, El Bowl
// 555008330, beach 1189502378, bare rock 509299736/509301219, building footprints. Inferred:
// running-strip widths, colours, the frontage kit, pole/palm/boulder/rail placement, court markings
// (Wikimedia Commons curid=100291752's 2014 scheme, no logos), bleacher size. Not drawn on purpose: El Bowl's depth or use (unverified), the
// placita/park/playground/community-centre furniture (no identified photo), the public stairs (left as mapped terrain).
import {circle,inRing,segmentDistance,terrainFoundation} from './sj-plaza-layout.js';
import {signedArea} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {unit,bounds,ribbon,minus,overlapB} from './sj-city-wall.js';
import {GROUND_AREAS} from './sj-streets-data.js';
import {drapedWalkRecord,registerStairFlights} from './sj-stairs.js';
import {drapeConvex} from './sj-seams-geo.js';

// OSM 1189502372 {"landuse": "residential"}
export const DISTRICT=[[-91.690,-321.033],[-179.716,-326.657],[-178.860,-343.337],[-182.693,-397.485],
[-214.169,-401.182],[-210.545,-434.930],[-210.228,-437.830],[-208.760,-451.289],[-212.489,-451.079],[-212.911,-457.122],
[-208.200,-456.370],[-175.574,-452.363],[-153.225,-453.259],[-140.708,-450.292],[-118.951,-442.290],[-98.682,-440.076],
[-81.846,-439.035],[-62.517,-434.519],[-56.518,-433.114],[-57.754,-427.933],[-58.007,-426.893],[-48.406,-424.159],
[-23.987,-420.362],[-15.442,-419.820],[98.323,-399.288],[135.597,-392.636],[149.761,-388.109],[149.687,-390.323],
[172.723,-418.836],[214.126,-400.318],[220.305,-397.607],[242.327,-393.312],[278.661,-387.048],[281.619,-385.687],
[289.213,-382.189],[326.328,-374.309],[330.226,-368.321],[333.975,-367.624],[339.500,-366.495],[354.899,-363.019],
[355.079,-361.282],[369.676,-358.404],[373.352,-353.257],[379.868,-352.350],[381.072,-356.644],[401.753,-352.771],
[399.493,-333.722],[404.056,-333.866],[404.120,-332.847],[411.925,-332.859],[411.777,-328.553],[420.882,-331.575],
[426.754,-330.313],[427.325,-328.620],[428.751,-320.462],[348.975,-305.330],[348.711,-310.156],[320.657,-318.601],
[311.289,-313.642],[303.811,-283.812],[250.662,-295.001],[211.878,-303.170],[196.446,-335.667],[164.379,-349.026],
[136.653,-330.608],[130.084,-317.558],[128.721,-314.835],[2.461,-320.170],[-6.189,-342.971],[-46.928,-350.719],
[-80.695,-336.906]];
// OSM 256387098 {"leisure": "pitch", "name": "Cancha Carmelo Anthony", "sport": "basketball"}
export const COURT=[[319.021,-284.753],[325.844,-312.590],[341.666,-308.462],[334.875,-280.846]];
// OSM 555008330 {"access": "yes", "leisure": "swimming_pool", "name": "El Bowl"}
export const BOWL=[[189.178,-403.982],[185.101,-404.159],[183.158,-405.288],[182.197,-407.181],[182.588,-408.763],
[183.823,-409.970],[184.922,-410.213],[186.168,-409.583],[187.900,-408.553],[190.097,-407.889],[190.657,-406.373],
[190.414,-404.790]];
// OSM 1189502378 {"natural": "beach"}
export const BEACH=[[-208.200,-456.370],[-212.911,-457.122],[-213.048,-459.170],[-216.449,-458.893],[-223.209,-465.258],
[-234.088,-478.109],[-242.580,-483.344],[-235.609,-496.294],[-233.359,-494.125],[-227.053,-488.945],[-216.143,-479.824],
[-196.783,-468.180],[-176.968,-467.416],[-171.941,-463.121],[-154.333,-464.615],[-140.360,-465.932],[-129.407,-463.132],
[-121.264,-460.885],[-104.428,-456.801],[-98.914,-457.166],[-89.260,-456.402],[-80.663,-455.926],[-73.375,-453.513],
[-59.148,-446.828],[-62.517,-434.519],[-81.846,-439.035],[-98.682,-440.076],[-118.951,-442.290],[-140.708,-450.292],
[-153.225,-453.259],[-175.574,-452.363]];
// OSM 509299736 {"natural": "bare_rock"}
export const ROCK_EAST=[[172.216,-420.629],[218.108,-400.141],[279.295,-388.177],[289.920,-383.252],[327.606,-375.371],
[330.437,-370.723],[354.656,-365.300],[354.899,-363.019],[355.079,-361.282],[369.676,-358.404],[373.352,-353.257],
[379.868,-352.350],[381.072,-356.644],[401.753,-352.771],[407.214,-354.597],[413.160,-355.228],[418.758,-356.922],
[421.019,-353.612],[428.380,-355.727],[430.239,-353.801],[431.633,-358.881],[421.853,-363.309],[413.678,-367.105],
[405.883,-370.558],[394.592,-371.809],[362.483,-374.631],[348.836,-380.906],[333.014,-382.588],[323.550,-390.690],
[318.206,-388.687],[314.879,-392.660],[312.196,-388.244],[302.574,-386.949],[291.769,-397.331],[279.971,-400.552],
[277.045,-400.087],[258.794,-403.584],[256.248,-401.503],[253.850,-404.525],[242.538,-406.694],[240.669,-404.901],
[238.028,-404.248],[238.081,-406.550],[236.338,-407.292],[237.447,-411.155],[234.828,-413.457],[222.006,-412.250],
[215.594,-412.992],[211.137,-416.091],[207.282,-413.911],[198.843,-416.932],[193.245,-422.555],[169.448,-431.974]];
// OSM 509301219 {"natural": "bare_rock"}
export const ROCK_WEST=[[169.448,-431.974],[160.650,-431.266],[161.041,-425.322],[157.355,-422.112],[152.264,-419.688],
[153.616,-413.622],[153.183,-409.195],[149.549,-408.630],[145.926,-409.416],[131.361,-409.748],[118.275,-412.537],
[101.037,-415.648],[62.084,-419.953],[51.184,-421.348],[44.086,-421.104],[27.187,-422.554],[8.545,-430.701],
[-27.472,-437.585],[-39.999,-439.876],[-44.551,-441.160],[-49.388,-443.695],[-59.148,-446.828],[-62.517,-434.519],
[-56.518,-433.114],[-57.754,-427.933],[-45.861,-425.067],[-24.536,-422.034],[93.739,-401.236],[128.721,-395.359],
[131.773,-396.200],[140.128,-395.215],[142.673,-396.621],[148.557,-397.263],[159.467,-409.018],[163.079,-409.715],
[172.216,-420.629]];
// OSM 311911400 {"leisure": "park", "name": "Placita Ismael Rivera"}
export const PLACITA=[[309.324,-323.448],[311.193,-342.276],[327.966,-340.494],[337.472,-330.666],[338.117,-324.733],
[327.396,-325.175],[316.802,-323.294]];
// OSM 554672557 {"leisure": "park", "name": "Parque Los Ramírez"}
export const PARK=[[-130.886,-374.749],[-130.157,-379.631],[-103.953,-388.651],[-100.604,-393.223],[-87.243,-393.532],
[-87.761,-389.692],[-87.243,-388.031],[-100.499,-382.530],[-98.619,-377.760],[-123.472,-368.318],[-125.669,-373.819]];

// Running strips (half widths, m). OSM carries no width tag here; Wikimedia Commons curid=72372072, curid=72372077, curid=72372066, curid=86543919 show ~3.5–4.5 m of patched asphalt
// between house fronts (S4: generator defaults of 6 m would pave through the houses). Order = ownership priority.
export const ROADS=[[291705108,2.0],[22228973,2.0],[291705109,1.9],[22228326,1.9],[22229137,1.9],[22229136,1.9],
  [22226154,1.8],[22223280,1.8],[22222073,1.8],[22231079,1.8],[311912596,1.6],[22226152,2.35],[22221861,1.6]];
// Footways: the east/west shore paths (Wikimedia Commons curid=86543904, curid=86543903: ~2.3 m jointed concrete) and the court paths; concrete slabs.
export const PATHS=[[382012770,1.15],[382012774,1.15],[382012771,1.0],[382012772,1.0],[382012773,1.0],[311911404,.8],
  [311911405,.8],[311911406,.8],[311911407,.8],[311911408,.8],[555008332,.8],[555008958,.8],[22222100,.9],[22229778,.9]];
// Photo-led plaster colours (65/66/68/81–84/86/87) and flat-roof tones (25/82/87: grey concrete, occasional rust metal).
export const PLASTER=['#8f72c6','#4f9fd6','#2f63b0','#39b0a1','#5aae4d','#e3c447','#e8903b','#c9473d','#e590ae','#a9dcc5',
  '#ece6d6','#f2f0e9','#d8b56b','#7fc5e6','#b46bb0','#62c6c0'];
export const ROOF=['#a7a39a','#b8b4aa','#9b968d','#c4c0b5','#8f8b83','#b0aca2','#8b5b3d','#a7a39a'];
// EDGE: terrain just beside the running strips and in fork wedges, in the patched asphalt's mean tone (V2: pale medians).
// SCRUB: rough slope — two rock-and-dust greys, two dry scrub greens (Wikimedia Commons curid=80251220, curid=86543964, curid=109811939, curid=86543932).
export const SCRUB=['#8a7f6c','#7b7262','#7d7d5c','#6f7650'],BANK=['#6d8a4a','#5f7d42','#7a9455','#56703d'],EARTH=['#8a6f55','#7a6a58','#94785a'];
export const EDGE=['#6c706e','#737775'],SAND=['#c8b083','#bfa676'],ROCK=['#9c8565','#8a7458','#6d5f4d','#a68f6c'],YARD=['#948d80','#8a8479','#9b9486'];
// Wikimedia Commons curid=86543903: timber rail on the sea side of 382012770 between its two geotags (x 262–314); not extrapolated beyond.
export const RAIL={way:382012770,minX:262,maxX:314,rise:1.0,offset:1.35,post:2.0};
// S4: the court footway 311911408 runs 0.1–0.6 m from the east wall of mass 270246056 (its OSM footprint overlaps the mapped
// path by 0.3 m) and turns round its SE corner; uphill riders stalled against it. That wall is set back 0.4 m and the corner
// cut back 1.2 m along both walls (drawn and solid alike). Inferred correction, not a survey.
// Further north the same footway threads between the NE corner of 270246183 and the W corner of 270246284 (1.9 m apart);
// the court arrival's return leg stalled on the latter (destination test), so that corner is cut back 1.0 m.
export const CHAMFER=new Map([[270246056,{edge:[[233.108,-315.013],[234.269,-322.075]],setback:.4,at:[234.269,-322.075],cut:1.2}],
  [270246284,{at:[232.981,-307.874],cut:1.0}]]);
export const COURT_DIMS={hoopInset:1.2,pole:.12,board:[1.8,1.05],rim:3.05,bleacher:{tiers:4,rise:.42,tread:.62,length:9}};

// Polyline offset by d (left of travel positive) with mitred joints (same rule as sj-city-wall ribbon).
function ribbonLine(line,d){const n=line.slice(1).map((b,i)=>{const [ux,uz]=unit(line[i],b);return [-uz,ux];});
  return line.map((p,i)=>{const a=n[Math.max(0,i-1)],b=n[Math.min(n.length-1,i)],mx=a[0]+b[0],mz=a[1]+b[1],m=Math.hypot(mx,mz)||1,
    k=d/Math.max(.5,(mx*b[0]+mz*b[1])/m);return [p[0]+mx/m*k,p[1]+mz/m*k];});}
const temper=(h,t=.18,to=[207,198,180])=>'#'+[1,3,5].map((o,i)=>Math.round(parseInt(h.slice(o,o+2),16)*(1-t)+to[i]*t).toString(16).padStart(2,'0')).join('');
export function hash(i,j,k=0){let h=Math.imul(i*73856093^j*19349663^k*83492791,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
const centroid=r=>{let a=0,x=0,z=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],c=p[0]*q[1]-q[0]*p[1];a+=c;x+=(p[0]+q[0])*c;z+=(p[1]+q[1])*c;}
  return Math.abs(a)<1e-9?r[0]:[x/(3*a),z/(3*a)];};

export function createPerlaDistrictLayout({city,height,terrain,surface,areas={}}) {
  const colliders=[],tops=[],cuts=[],tint=new Map(),surfaces=[],floorTriangles=[],buildingOverrides=new Map();
  const prism=(outer,minY,maxY,support=false)=>colliders.push({outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support});
  const earlier=Object.values(areas).filter(Boolean);
  const roadById=new Map(city.roads.map(r=>[r.id,r]));

  // ---- Houses: every mass whose footprint centroid lies in the residential landuse (S4: 285). Each keeps its mapped
  // footprint and roof; the base reaches the lowest terrain grid vertex under it (S4: 21 vertex-only bases floated up to
  // 0.67 m) and gets a photo-led plaster and roof tone. Masses another area already corrects are left to that owner. ----
  const taken=new Set(earlier.flatMap(a=>[...(a.buildingOverrides?.keys()??[])]));
  const houses=[];
  const chamfer=(ring0,{edge,setback,at,cut})=>{
    // Set back one mapped wall along its inward normal (towards the footprint's centroid), then cut the named corner.
    let ring=ring0;
    if(edge){const c=centroid(ring0),[ux,uz]=unit(...edge),n0=[-uz,ux],m=[(edge[0][0]+edge[1][0])/2,(edge[0][1]+edge[1][1])/2];
      const n=((c[0]-m[0])*n0[0]+(c[1]-m[1])*n0[1])>0?n0:[-n0[0],-n0[1]],on=p=>edge.some(e=>Math.hypot(p[0]-e[0],p[1]-e[1])<.01);
      ring=ring0.map(p=>on(p)?[p[0]+n[0]*setback,p[1]+n[1]*setback]:p);at=[at[0]+n[0]*setback,at[1]+n[1]*setback];}
    return ring.flatMap((p,i)=>{if(Math.hypot(p[0]-at[0],p[1]-at[1])>.01)return [p];
    const prev=ring[(i+ring.length-1)%ring.length],next=ring[(i+1)%ring.length],toward=(q)=>{const [ux,uz]=unit(p,q);return [p[0]+ux*cut,p[1]+uz*cut];};
    return [toward(prev),toward(next)];});};
  // Masses whose mapped footprint runs under an earlier area's fitted wall (2026-11-17: 270246226 ran 3.5 m
  // under the Norzagaray walk; its roof parapet stood out of the walk as a tan bar and its roof room rose through the wall).
  // The outline is clipped 3 cm outside the wall's outermost face line (the cordón, else the parapet face), drawing and
  // collision alike; such a mass gets no roof room or tank, and no parapet or openings along the clipped edge.
  const wallFeet=earlier.flatMap(a=>(a.walls??[]).filter(({a:s,b:t})=>s.B&&s.W&&s.T&&t.B&&t.W&&t.T).map(({a:s,b:t})=>{
    const ring=[s.B,t.B,t.W,s.W];return {s,t,ring,b:bounds(ring)};}));
  const clipHalf=(ring,p,n)=>{const out=[],side=q=>(q[0]-p[0])*n[0]+(q[1]-p[1])*n[1];
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],sa=side(a),sb=side(b);
      if(sa>=0)out.push(a);if((sa>=0)!==(sb>=0)){const t=sa/(sa-sb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}
    return out.filter((q,i,o)=>Math.hypot(q[0]-o[(i+1)%o.length][0],q[1]-o[(i+1)%o.length][1])>.01);};
  // (perf 2026-11-18: only the feet whose box meets the mass's box are tested, in their original order — same hits.)
  const underWall=ring=>{const bb=bounds(ring),hits=new Set(),feet=wallFeet.filter(f=>f.b[0]<=bb[1]&&f.b[1]>=bb[0]&&f.b[2]<=bb[3]&&f.b[3]>=bb[2]);
    if(!feet.length)return [];
    for(let x=bb[0]+.25;x<bb[1];x+=.5)for(let z=bb[2]+.25;z<bb[3];z+=.5){if(!inRing(x,z,ring))continue;
      for(const f of feet)if(x>=f.b[0]&&x<=f.b[1]&&z>=f.b[2]&&z<=f.b[3]&&inRing(x,z,f.ring))hits.add(f);}
    return [...hits];};
  // One clip line per mass: the chord of the face points over the walls it overlaps, pushed out past the wall's outermost
  // bulge (per-interval lines extended across a kinked wall cut far too deep).
  const wallClip=ring=>{const feet=underWall(ring);if(!feet.length)return null;
    const pts=feet.flatMap(({s,t})=>[s.C??s.T,t.C??t.T]),{s:s0}=feet[0],[ux0,uz0]=unit(s0.W,s0.B);
    const along=q=>q[0]*-uz0+q[1]*ux0,sorted=[...pts].sort((a,b)=>along(a)-along(b)),p0=sorted[0],p1=sorted.at(-1);
    const [ux,uz]=unit(p0,p1);let n=[-uz,ux];if(n[0]*ux0+n[1]*uz0<0)n=[-n[0],-n[1]];
    const off=Math.max(0,...pts.map(q=>(q[0]-p0[0])*n[0]+(q[1]-p0[1])*n[1]))+.03,p=[p0[0]+n[0]*off,p0[1]+n[1]*off];
    return {outer:clipHalf(ring,p,n),lines:[{p,n}]};};
  for(const b of city.buildings){if(taken.has(b.id))continue;const c=centroid(b.outer);if(!inRing(c[0],c[1],DISTRICT))continue;
    let outer=CHAMFER.has(b.id)?chamfer(b.outer,CHAMFER.get(b.id)):null;
    const clip=wallClip(outer??b.outer);if(clip)outer=clip.outer;
    const base=Math.min(b.base,terrainFoundation(outer??b.outer,terrain,b.roof).minY);
    // two (La Perla "not yet"; Wikimedia Commons curid=109811940, curid=72372072, curid=72372077, curid=80251220, curid=86543919, curid=86543964, curid=86543904, curid=86543903, curid=86543901): the palette stays as varied, but each plaster
    // is tempered 18 % toward a weathered warm grey, so large single-colour fields no longer read as raw saturated slabs.
    const colour=b.id===270246262?'#ece8dc':temper(PLASTER[Math.floor(hash(b.id,7)*PLASTER.length)]);
    const roofColour=ROOF[Math.floor(hash(b.id,11)*ROOF.length)];
    const o={base,colour,roofColour,...(outer?{outer}:{})};buildingOverrides.set(b.id,o);
    houses.push({...b,...o,src:b,...(clip?{wallLines:clip.lines}:{})});}
  const housePieces=houses.flatMap(h=>convexPieces(h.outer).map(p=>({p,b:bounds(p)})));
  const inHouse=(x,z,m=0)=>houses.some(h=>inRing(x,z,h.outer)||m>0&&h.outer.some((a,i)=>segmentDistance(x,z,a,h.outer[(i+1)%h.outer.length])<m));

  // ---- Street surfaces: single-owner convex pieces, after every earlier owner's surfaces and authored floors, outside
  // the houses, the court and El Bowl. ----
  const earlierRings=[...earlier.flatMap(a=>(a.surfaces??[]).map(s=>s.ring)),
    ...earlier.flatMap(a=>(a.floorTriangles??[]).map(t=>t.map(p=>[p[0],p[2]]))).filter(r=>Math.abs(signedArea(r))>1e-4)];
  const bowlPieces=convexPieces(BOWL),blockedFor=ring=>{const b=bounds(ring);
    return [...earlierRings.filter(r=>overlapB(bounds(r),b,.5)),...housePieces.filter(h=>overlapB(h.b,b,.5)).map(h=>h.p),COURT,...bowlPieces];};
  const streets=[];let done=[];
  const pave=(list,kind)=>{for(const [id,half] of list){const r=roadById.get(id);if(!r)continue;
    const pts=r.points.filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.05);streets.push({id,points:pts,half,kind,name:r.name});
    let pieces=ribbon(pts,-half,half);const bb=bounds(pieces.flat());
    pieces=minus(pieces,[...blockedFor(pieces.flat()),...done.filter(d=>overlapB(bounds(d),bb,.5))]);
    for(const ring of pieces)surfaces.push({kind,ring,owner:'perlaDistrict:'+id});done.push(...pieces);}};
  pave(ROADS,'patched');pave(PATHS,'morro');
  // 311911403: fit the strip of concrete on the bank outside the unmodified wall batter.
  // Draping the visible path on the actual terrain also keeps wall-foot rebuilds off its ground.
  const batterWay=roadById.get(311911403),batterLine=batterWay&&ribbonLine(batterWay.points,-1.05);
  registerStairFlights('perlaDistrict',batterLine?[drapedWalkRecord(batterLine,1,height)]:[]);
  // Keep the wall-side strip 36 cm narrower: the full metre displaced four fitted
  // wall-foot intervals, even though all three public ride lines fit inside 64 cm.
  if(batterLine){const strip=ribbon(batterLine,-1,.64),bb=bounds(strip.flat());
    for(const ring of minus(strip,[...blockedFor(strip.flat()),...done.filter(d=>overlapB(bounds(d),bb,.5))])){
      surfaces.push({kind:'morro',ring,owner:'perlaDistrict:311911403'});done.push(ring);}}
  // two (bowl-shore interface; Wikimedia Commons curid=86543904, curid=86543903: a continuous walking line with a defined edge): a flush
  // 0.3 m patched-concrete edge (the lanes' own material: no new draw) on both sides of every district footpath, single owner.
  // (Limited to the shore walk round El Bowl, x 120–330, z < −390, so the lanes' patched batch keeps its bounds: no new draws.)
  for(const [id,half] of PATHS){const st=streets.find(q=>q.id===id);if(!st||!st.points.some(p=>p[0]>120&&p[0]<330&&p[1]<-390))continue;
    for(const [u,v] of [[half,half+.3],[-half-.3,-half]]){let pieces=ribbon(st.points.filter(p=>p[0]>110&&p[0]<340),u,v);if(!pieces.length)continue;const bb=bounds(pieces.flat());
      pieces=minus(pieces,[...blockedFor(pieces.flat()),...done.filter(d=>overlapB(bounds(d),bb,.5))]);
      for(const ring of pieces)if(Math.abs(signedArea(ring))>.005)surfaces.push({kind:'patched',ring,owner:'perlaDistrict:edge:'+id});done.push(...pieces);}}
  // Second pass (El Bowl surround 178,−414): the dark stepped house footings met the pale apron in sharp angles.
  // A 0.9 m patched-concrete apron along every exposed house foot within 20 m of the bowl is the material return (the
  // lanes' own surface: no new draw), single owner like the path edges, outside the bowl paint, houses and earlier owners.
  {const bc=centroid(BOWL);
    for(const h of houses){if(!h.outer.some(p=>Math.hypot(p[0]-bc[0],p[1]-bc[1])<20))continue;const r=h.outer,sg=Math.sign(signedArea(r));
      for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)continue;
        const n=sg>0?[(b[1]-a[1])/L,-(b[0]-a[0])/L]:[-(b[1]-a[1])/L,(b[0]-a[0])/L];
        const q=[a,b,[b[0]+n[0]*.9,b[1]+n[1]*.9],[a[0]+n[0]*.9,a[1]+n[1]*.9]],ring=signedArea(q)<0?[...q].reverse():q;
        let pieces=[ring];const bb=bounds(ring);pieces=minus(pieces,[...blockedFor(ring),...done.filter(d=>overlapB(bounds(d),bb,.5))]);
        for(const pc of pieces)if(Math.abs(signedArea(pc))>.005)surfaces.push({kind:'patched',ring:pc,owner:'perlaDistrict:bowl-apron'});done.push(...pieces);}}}
  // El Bowl (seams 2026-11-18, audit rank 7; ): drawn as what the game can honestly support — flat painted
  // ground. The DEM has no hollow and the depth is unsurveyed, so the physics is the plain terrain; the earlier white
  // coping and darkening concentric blues promised a hole you could drop into. Now: a painted border line and a
  // field of mural colour blocks scattered over the footprint (no radial ordering, no shading), like a painted court.
  // Inferred from general knowledge of the site; no pack photo. The footprint is returned as `brick` (ownership without a
  // shared overlay) and drawn by the district builder.
  const bowlTris=[],brick=[{ring:BOWL,kind:'bowl',owner:'perlaDistrict:bowl'}];
  {const c=centroid(BOWL),radial=d=>BOWL.map(p=>{const L=Math.hypot(p[0]-c[0],p[1]-c[1]);return [p[0]-(p[0]-c[0])/L*d,p[1]-(p[1]-c[1])/L*d];});
    // Radial insets toward the centroid (the footprint is star-shaped about it).
    const rings=[0,.22,.9,1.6,2.1].map(d=>d?radial(d):BOWL);
    const MURAL=['#e5487a','#f2c230','#58b85a','#ef7d2e','#8f6ad0','#4fa9d2','#e9e4d6','#d4473f','#3fb7a4'];
    for(let b=0;b+1<rings.length;b++){const A=rings[b],B=rings[b+1];
      for(let i=0;i<A.length;i++){const j=(i+1)%A.length,q=[A[i],A[j],B[j],B[i]],ring=signedArea(q)<0?[...q].reverse():q;if(Math.abs(signedArea(ring))<1e-3)continue;
        const col=b===0?'#f0cc3c':MURAL[Math.floor(hash(i*7+b*3,b,71)*MURAL.length)];for(const piece of convexPieces(ring))drapeConvex(piece,terrain,bowlTris,col);}}
    const core=rings.at(-1);for(const piece of convexPieces(signedArea(core)<0?[...core].reverse():core))drapeConvex(piece,terrain,bowlTris,'#4fa9d2');}
  // (perf 2026-11-18: an 8 m grid of the street segments, each entered with its half width + 4.5 m; queries with m ≤ 4.5
  // give exactly the all-pairs answer, larger m falls back to the scan.)
  const segGrid=new Map(),GC=8,REACH=4.5;
  for(const s of streets)for(let i=0;i+1<s.points.length;i++){const a=s.points[i],b=s.points[i+1],r=s.half+REACH,seg={a,b,s};
    for(let gx=Math.floor((Math.min(a[0],b[0])-r)/GC);gx<=Math.floor((Math.max(a[0],b[0])+r)/GC);gx++)for(let gz=Math.floor((Math.min(a[1],b[1])-r)/GC);gz<=Math.floor((Math.max(a[1],b[1])+r)/GC);gz++){
      const k=gx*100003+gz;let l=segGrid.get(k);if(!l)segGrid.set(k,l=[]);l.push(seg);}}
  const nearAny=(x,z,m,patchedOnly)=>{if(m>REACH)return streets.some(s=>(!patchedOnly||s.kind==='patched')&&s.points.some((a,i)=>i+1<s.points.length&&segmentDistance(x,z,a,s.points[i+1])<s.half+m));
    for(const g of segGrid.get(Math.floor(x/GC)*100003+Math.floor(z/GC))??[])if((!patchedOnly||g.s.kind==='patched')&&segmentDistance(x,z,g.a,g.b)<g.s.half+m)return true;return false;};
  const nearRoad=(x,z,m)=>nearAny(x,z,m,true);
  const nearStreet=(x,z,m)=>nearAny(x,z,m,false);

  // ---- Ground tones (earlier owners keep priority): sand on the beach, mottled rock shelves, and pale patched concrete
  // in place of the generic asphalt-mask blue between the houses (lawn stays lawn). ----
  {const {x0,z0,step,nx,nz}=terrain,all=[DISTRICT,BEACH,ROCK_EAST,ROCK_WEST].map(bounds),H=terrain.heights;
    const steep=(i,j)=>{const k=j*nx+i;if(i<1||j<1||i>=nx-1||j>=nz-1)return 0;return Math.hypot(H[k+1]-H[k-1],H[k+nx]-H[k-nx])/(2*step);};
    const cemetery=(x,z)=>earlier.some(a=>a.offLimitsAt?.(x,z));
    const edgeOf=(x,z)=>{let d=Infinity;for(let q=0;q<DISTRICT.length;q++)d=Math.min(d,segmentDistance(x,z,DISTRICT[q],DISTRICT[(q+1)%DISTRICT.length]));return d;};
    const bb=[Math.min(...all.map(b=>b[0])),Math.max(...all.map(b=>b[1])),Math.min(...all.map(b=>b[2])),Math.max(...all.map(b=>b[3]))];
    for(let j=Math.max(0,Math.floor((bb[2]-z0)/step));j<=Math.min(nz-1,Math.ceil((bb[3]-z0)/step));j++)
      for(let i=Math.max(0,Math.floor((bb[0]-40-x0)/step));i<=Math.min(nx-1,Math.ceil((bb[1]-x0)/step));i++){
        const x=x0+i*step,z=z0+j*step,k=j*nx+i;
        if(inRing(x,z,BEACH))tint.set(k,SAND[hash(i,j,3)<.6?0:1]);
        else if(inRing(x,z,ROCK_EAST)||inRing(x,z,ROCK_WEST))tint.set(k,ROCK[Math.floor(hash(i,j,5)*ROCK.length)]);
        else if(nearRoad(x,z,1.2))tint.set(k,EDGE[hash(i,j,8)<.5?0:1]);
        else if((inRing(x,z,DISTRICT)||nearStreet(x,z,4))&&surface[k]!==2&&surface[k]!==3)
          // steep open slopes between the houses read as rough scrub and rock, not as yard
          // concrete (smooth grey wedges under the shore rows).
          // (calle-san-miguel-108_-394-w: a smooth grey slope up to the house flanks): every steep slope, also
          // beside a lane, is planted bank and scrub (Wikimedia Commons curid=86543919), the grey yard tone stays on the near-level ground.
          // within 1.5 m of a lane a steep bank is a soil verge
          // (earth tones), so the bright bank no longer meets the paving in faceted wedges.
          tint.set(k,steep(i,j)>.6&&nearStreet(x,z,1.5)?EARTH[Math.floor(hash(i,j,37)*EARTH.length)]:steep(i,j)>.6?(hash(i>>1,j>>1,69)<.5?BANK[Math.floor(hash(i,j,71)*BANK.length)]:SCRUB[Math.floor(hash(i,j,17)*SCRUB.length)]):YARD[Math.floor(hash(i,j,7)*YARD.length)]);
        // Seams: the open slope just outside the residential ring (the cream DEM wedges between the rows and the shore
        // shelves, below 18 m: not the city side under the wall) takes the same scrub/rock tones; lawn and water edges stay.
        else if(surface[k]!==2&&surface[k]!==3&&H[k]<18&&edgeOf(x,z)<22)tint.set(k,(steep(i,j)>.6?SCRUB.slice(0,2):SCRUB.slice(2))[Math.floor(hash(i,j,19)*2)]);
        // Seams: the bank between the cemetery lane and the west rows (Wikimedia Commons curid=109811939: a green vegetated slope under the wall, not
        // bare DEM), outside the closed cemetery.
        // Wikimedia Commons curid=109811939's bank is brown rock-cut earth under irregular green; low-frequency earth/rock patches.
        // natural ground only (lawn cells or banks > 0.6 m/m); the street's
        // mapped walk and roadway cells stay with `streets`, which draws the kerb and sidewalk there.
        else if(x<-170&&surface[k]!==3&&(surface[k]===2||steep(i,j)>.6)&&edgeOf(x,z)<45&&!cemetery(x,z))tint.set(k,hash(i>>2,j>>2,33)<.35||steep(i,j)>.9&&hash(i,j,35)<.6?EARTH[Math.floor(hash(i,j,37)*EARTH.length)]:BANK[Math.floor(hash(i,j,29)*BANK.length)]);}}

  // ---- Court (Wikimedia Commons curid=100291752, curid=137763018): the pitch keeps its nearly level terrain (18.00–18.42 m) and is draped with one marked
  // surface; two hoops on poles at the baselines; one short open-tier bleacher beside it where the ground allows. ----
  const court=(()=>{const [A,B,Cc,D]=COURT,e0=[(A[0]+D[0])/2,(A[1]+D[1])/2],e1=[(B[0]+Cc[0])/2,(B[1]+Cc[1])/2];
    const u=unit(e0,e1),v=[-u[1],u[0]],length=Math.hypot(e1[0]-e0[0],e1[1]-e0[1]),width=Math.hypot(D[0]-A[0],D[1]-A[1]);
    const origin=[e0[0]-v[0]*width/2,e0[1]-v[1]*width/2],P=(s,t)=>[origin[0]+u[0]*s+v[0]*t,origin[1]+u[1]*s+v[1]*t];
    const ys=COURT.map(p=>height(...p)),y=ys.reduce((s,h)=>s+h,0)/4;
    const hoops=[0,1].map(end=>{const s=end?length-.3:.3,dir=end?-1:1,[x,z]=P(s,width/2),g=height(x,z);
      prism(circle(x,z,COURT_DIMS.pole+.03,8),g-.15,g+COURT_DIMS.rim+1.2);return {x,z,y:g,dir,s};});
    // Bleacher on the long side whose 1.5–5.5 m band is free and near court level (Wikimedia Commons curid=137763018: white tiers on the grass).
    let bleacher=null;
    for(const side of [1,-1]){const t0=side>0?width+1.5:-1.5,t1=side>0?width+1.5+COURT_DIMS.bleacher.tiers*COURT_DIMS.bleacher.tread:-1.5-COURT_DIMS.bleacher.tiers*COURT_DIMS.bleacher.tread;
      const s0=length/2-COURT_DIMS.bleacher.length/2,s1=length/2+COURT_DIMS.bleacher.length/2;let ok=true,lo=Infinity,hi=-Infinity;
      for(let s=s0;s<=s1+1e-6&&ok;s+=1)for(const t of [t0,(t0+t1)/2,t1]){const [x,z]=P(s,t),g=height(x,z);lo=Math.min(lo,g);hi=Math.max(hi,g);
        if(inHouse(x,z,.5)||nearStreet(x,z,.4)||Math.abs(g-y)>.8)ok=false;}
      if(!ok)continue;
      const tiers=[];for(let k=0;k<COURT_DIMS.bleacher.tiers;k++){const a=t0+side*k*COURT_DIMS.bleacher.tread,b=a+side*COURT_DIMS.bleacher.tread;
        const ring=[P(s0,a),P(s1,a),P(s1,b),P(s0,b)],top=hi+(k+1)*COURT_DIMS.bleacher.rise;
        prism(signedArea(ring)<0?[...ring].reverse():ring,lo-.15,top,true);tiers.push({ring,top});}
      bleacher={side,s0,s1,t0,lo,hi,tiers};break;}
    return {ring:COURT,origin,u,v,length,width,y,hoops,bleacher,P};})();

  // ---- Palms (Wikimedia Commons curid=80155724, curid=109811940, curid=80251220, curid=109811939, curid=86543932, curid=137763018): small clusters at yard/coast breaks near photographed spots,
  // never on a running strip or against a house. Placement inferred. ----
  // reserved play ground, published as `sportsRings`
  // (streets and ground consume it): the court with a 1.5 m clear apron,
  // El Bowl with 1 m, playground 1358439374 (mapped). District planting tests full crown reach against them, and trunks
  // against every drawn building footprint (not only the district's own houses).
  const sportsRings=(()=>{const L=court.length,W=court.width,A=1.5,ap=[[-A,-A],[L+A,-A],[L+A,W+A],[-A,W+A]].map(([a,b])=>court.P(a,b));
    const c=centroid(BOWL),bowl=BOWL.map(p=>{const d=Math.hypot(p[0]-c[0],p[1]-c[1]);return [p[0]+(p[0]-c[0])/d,p[1]+(p[1]-c[1])/d];});
    const pg=GROUND_AREAS.find(g=>g.id===1358439374)?.ring;
    return [{ring:ap,kind:'basketball',source:256387098},{ring:bowl,kind:'skate-paint',source:'perlaDistrict:bowl'},...(pg?[{ring:pg.map(p=>[p[0],p[1]]),kind:'playground',source:1358439374}]:[])];})();
  const ringDist=(x,z,r)=>{if(inRing(x,z,r))return 0;let d=Infinity;for(let i=0;i<r.length;i++)d=Math.min(d,segmentDistance(x,z,r[i],r[(i+1)%r.length]));return d;};
  const nearSports=(x,z,m)=>sportsRings.some(o=>ringDist(x,z,o.ring)<m);
  const cityRings=city.buildings.map(b=>{const r=buildingOverrides.get(b.id)?.outer??b.outer;return {r,b:bounds(r)};});
  const inAnyBuilding=(x,z,m)=>cityRings.some(o=>x>=o.b[0]-m&&x<=o.b[1]+m&&z>=o.b[2]-m&&z<=o.b[3]+m&&ringDist(x,z,o.r)<m);
  const PALM_REACH=3.0,LEAF_REACH=2.4,CROWN=[.76,1.44,.42],CROWN_R=4.21+.1;   // palm frond envelope per sj-palm.js variant (measured)
  // The court apron and the playground are also ownership (`brick`, like El Bowl), so the generic ownership tests of later
  // packages (streets' planting/furniture `clearOf`) already keep off them before they read `sportsRings`.
  for(const o of sportsRings)if(o.kind!=='skate-paint')brick.push({ring:signedArea(o.ring)<0?[...o.ring].reverse():o.ring,kind:'sports',owner:'perlaDistrict:'+o.kind});
  const palms=[];
  const ANCHORS=[[-183,-411,5],[-150,-440,3],[-95,-430,2],[176,-382,2],[268,-395,2],[325,-318,3],[60,-404,2],[-30,-412,2]];
  for(const [ax,az,n] of ANCHORS){let got=0;
    for(let r=1.5;r<=12&&got<n;r+=1.5)for(let a=0;a<12&&got<n;a++){const t=a*Math.PI/6+hash(ax|0,az|0,a)*.5,x=ax+Math.cos(t)*r,z=az+Math.sin(t)*r,y=height(x,z);
      if(y<.6||inHouse(x,z,1.4)||inAnyBuilding(x,z,1.4)||nearSports(x,z,PALM_REACH)||nearStreet(x,z,1.0)||inRing(x,z,COURT)||inRing(x,z,BOWL)||palms.some(p=>Math.hypot(p.x-x,p.z-z)<3.2))continue;
      const sl=Math.max(...[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dz])=>Math.abs(height(x+dx*.6,z+dz*.6)-y)/.6));if(sl>.45)continue;
      // Second pass (recheck: a relocated palm's fronds reached over the court apron): test the transformed frond envelope,
      // not the trunk. sj-palm.js variant k = list index % 3; its leaves lie within 4.21 m of a crown centre CROWN[k] m out
      // along the lean (local +x, turned by yaw about Y). Keep the hashed yaw if clear, else turn the lean in 45° steps.
      const k=palms.length%3,y0=hash(palms.length,3)*Math.PI*2;let yaw=null;
      for(let q=0;q<8&&yaw===null;q++){const a=y0+q*Math.PI/4,cx=x+CROWN[k]*Math.cos(a),cz=z-CROWN[k]*Math.sin(a);
        if(!sportsRings.some(o=>ringDist(cx,cz,o.ring)<CROWN_R))yaw=a;}
      if(yaw===null)continue;
      palms.push({x,z,y,radius:.2,yaw});got++;}}
  for(const p of palms)prism(circle(p.x,p.z,p.radius,8),p.y-.1,p.y+4);

  // ---- Utility poles (Wikimedia Commons curid=72372072, curid=72372077, curid=86543919: concrete poles at the street edge with sagging lines), every ~30 m along the
  // main streets on alternating sides. ----
  const poles=[];
  for(const id of [22228973,291705109,22228326,291705108,22223280,22229136,22226154]){const s=streets.find(q=>q.id===id);if(!s)continue;
    let acc=12,side=1,last=null;
    for(let i=0;i+1<s.points.length;i++){const a=s.points[i],b=s.points[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),[ux,uz]=unit(a,b);
      for(let d=acc;d<L;d+=30){const off=s.half+.45,try2=[];
        // Second pass (seating guard, steep footprints): a pole stands on level ground beside its lane; try ±1…3 m along
        // the lane on either side for a 0.3 m footprint spanning ≤ 0.25 m of height.
        for(const sh of [0,1,-1,2,-2,3,-3])for(const sd of [side,-side])if(d+sh>=0&&d+sh<=L)try2.push([sd,d+sh]);
        for(const [sd,dd] of try2){const x=a[0]+ux*dd-uz*off*sd,z=a[1]+uz*dd+ux*off*sd,y=height(x,z);
          {const hs=[y,...[0,1,2,3,4,5,6,7].map(k=>height(x+Math.cos(k*Math.PI/4)*.3,z+Math.sin(k*Math.PI/4)*.3))];if(Math.max(...hs)-Math.min(...hs)>.25)continue;}
          if(y<.8||inHouse(x,z,.35)||streets.some(o=>o!==s&&o.points.some((p,k)=>k+1<o.points.length&&segmentDistance(x,z,p,o.points[k+1])<o.half+.35)))continue;
          const lowG=Math.min(y,...[0,1,2,3,4,5,6,7].map(k=>height(x+Math.cos(k*Math.PI/4)*.2,z+Math.sin(k*Math.PI/4)*.2)));   /* drawn bottom (y−.1) 3 cm under the footprint*/
          const pole={x,z,y:Math.min(y,lowG+.07),street:id,prev:last&&Math.hypot(last.x-x,last.z-z)<42?poles.indexOf(last):-1};poles.push(pole);last=pole;
          prism(circle(x,z,.16,8),y-.15,y+7.6);break;}
        side=-side;}
      acc=(acc-L)%30;if(acc<0)acc+=30;}}
  {const near=w0=>city.buildings.filter(b=>b.outer.some(q=>Math.hypot(q[0]-w0[0],q[1]-w0[1])<60));let dropped=0;
    for(const p of poles){if(p.prev<0)continue;const q=poles[p.prev],cands=near([(p.x+q.x)/2,(p.z+q.z)/2]),L=Math.hypot(q.x-p.x,q.z-p.z);
      const side=[-(q.z-p.z)/L,(q.x-p.x)/L];let hit=false;
      for(const o of [-.65,0,.65])for(let t=0;t<=1.0001&&!hit;t+=.05){const x=p.x+(q.x-p.x)*t+side[0]*o,z=p.z+(q.z-p.z)*t+side[1]*o,y=p.y+7.17+(q.y-p.y)*t-.7*4*t*(1-t);
        for(const b of cands){const o2=buildingOverrides.get(b.id),roof=o2?.roof??b.roof;if(y<roof+.8&&y>(o2?.base??b.base)&&inRing(x,z,o2?.outer??b.outer)){hit=true;break;}}}
      if(hit){p.prev=-1;dropped++;}}
    poles.dropped=dropped;}

  // ---- Shore: dark angular boulders on the rock shelves near the water (Wikimedia Commons curid=86543901), each its own small solid; the
  // Commons curid=86543903 timber rail on the sea side of the east path. ----
  const rocks=[];let clusters=0;
  {const {x0,z0,step}=terrain;
    for(const ring of [ROCK_EAST,ROCK_WEST]){const b=bounds(ring);
      for(let z=Math.ceil((b[2]-z0)/step)*step+z0;z<=b[3];z+=step)for(let x=Math.ceil((b[0]-x0)/step)*step+x0;x<=b[1];x+=step){
        const i=Math.round((x-x0)/step),j=Math.round((z-z0)/step);if(hash(i,j,21)>.045||!inRing(x,z,ring))continue;
        const y=height(x,z);if(y<.25||y>3.4||nearStreet(x,z,2.2)||inHouse(x,z,1.2)||rocks.some(r=>Math.hypot(r.x-x,r.z-z)<4.5))continue;
        const n=2+Math.floor(hash(i,j,27)*3);let big=null;
        for(let k=0;k<n;k++){const s=k?.3+hash(i,j,30+k)*.6:.7+hash(i,j,22)*.9,a=hash(i,j,40+k)*6.28,rr=k?.6+hash(i,j,50+k)*1.1:0;
          const px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr;if(nearStreet(px,pz,1.6))continue;
          const lo=Math.min(...circle(px,pz,s*.8,6).map(q=>height(...q)));
          const r={x:px,z:pz,y:lo-s*.18,s,ry:hash(i,j,25+k)*6.28,tone:hash(i,j,26+k),squash:.55+hash(i,j,60+k)*.35};rocks.push(r);if(!k)big=r;}
        if(big){clusters++;prism(circle(big.x,big.z,big.s*.8,7),big.y-.2,big.y+big.s*big.squash+.2);}}}}
  // Broadleaf crowns between the palms (Wikimedia Commons curid=72372077, curid=86543932, curid=137763018: palms stand among broad shade trees and scrub; V6), at the same
  // clusters, never on a strip or against a house. Each trunk is a small solid.
  const broadleaf=[];
  for(const [ax,az] of ANCHORS){let got=0;
    for(let r=2.5;r<=13&&got<2;r+=1.7)for(let a=0;a<10&&got<2;a++){const t=a*Math.PI/5+hash(ax|0,az|0,90+a),x=ax+Math.cos(t)*r,z=az+Math.sin(t)*r,y=height(x,z);
      const size=1+hash(broadleaf.length,8)*.5;
      if(y<.6||inHouse(x,z,2.6)||inAnyBuilding(x,z,2.6)||nearSports(x,z,LEAF_REACH*size)||nearStreet(x,z,2.2)||inRing(x,z,COURT)||inRing(x,z,BOWL)||palms.some(p=>Math.hypot(p.x-x,p.z-z)<3.4)||broadleaf.some(q=>Math.hypot(q.x-x,q.z-z)<4.5))continue;
      broadleaf.push({x,z,y,size});got++;}}
  for(const t of broadleaf)prism(circle(t.x,t.z,.22,8),t.y-.1,t.y+3.5);
  const rail=[];
  {const s0=streets.find(q=>q.id===RAIL.way);
    if(s0){const pts=[];
      // Clip the path polyline to RAIL.minX…maxX, segment by segment (x interpolated at the crossings).
      for(let i=0;i+1<s0.points.length;i++){const a=s0.points[i],b=s0.points[i+1],dx=b[0]-a[0];
        let t0=0,t1=1;if(Math.abs(dx)<1e-9){if(a[0]<RAIL.minX||a[0]>RAIL.maxX)continue;}
        else{const ta=(RAIL.minX-a[0])/dx,tb=(RAIL.maxX-a[0])/dx;t0=Math.max(0,Math.min(ta,tb));t1=Math.min(1,Math.max(ta,tb));if(t1<=t0)continue;}
        for(const t of [t0,t1]){const q=[a[0]+dx*t,a[1]+(b[1]-a[1])*t];if(!pts.length||Math.hypot(q[0]-pts.at(-1)[0],q[1]-pts.at(-1)[1])>.05)pts.push(q);}}
      if(pts.length>=2){const m=pts[Math.floor(pts.length/2)],[ux,uz]=unit(pts[0],pts.at(-1)),sea=height(m[0]-uz*3,m[1]+ux*3)<height(m[0]+uz*3,m[1]-ux*3)?1:-1;
        const line=ribbonLine(pts,RAIL.offset*sea);
        // Posts and beams follow the ground at ≤2 m steps; the solid is stepped so its top stays within 5 cm of the drawn
        // sloping cap (one flat prism per span stood 0.29 m over the beam and caught hops).
        for(let i=0;i+1<line.length;i++){const A=line[i],B=line[i+1],L=Math.hypot(B[0]-A[0],B[1]-A[1]),k=Math.max(1,Math.round(L/RAIL.post));
          for(let j=0;j<k;j++){const f0=j/k,f1=(j+1)/k,p0=[A[0]+(B[0]-A[0])*f0,A[1]+(B[1]-A[1])*f0],p1=[A[0]+(B[0]-A[0])*f1,A[1]+(B[1]-A[1])*f1];
            const g0=height(...p0),g1=height(...p1);rail.push({p0,p1,g0,g1});
            const [vx,vz]=unit(p0,p1),n=[-vz*.07,vx*.07],steps=Math.max(1,Math.ceil(Math.abs(g1-g0)/.05));
            for(let q=0;q<steps;q++){const a=q/steps,b=(q+1)/steps,c0=[p0[0]+(p1[0]-p0[0])*a,p0[1]+(p1[1]-p0[1])*a],c1=[p0[0]+(p1[0]-p0[0])*b,p0[1]+(p1[1]-p0[1])*b];
              const ring=[[c0[0]-n[0],c0[1]-n[1]],[c1[0]-n[0],c1[1]-n[1]],[c1[0]+n[0],c1[1]+n[1]],[c0[0]+n[0],c0[1]+n[1]]];
              prism(signedArea(ring)<0?[...ring].reverse():ring,Math.min(g0,g1)-.1,Math.min(g0+(g1-g0)*a,g0+(g1-g0)*b)+RAIL.rise+.03);}}}}}}

  // ---- believable ends for the district's genuine dead ends (no other mapped way
  // within 1.5 m of the end). An alley that runs into a house gets a closed door on that wall, on the alley's axis (Wikimedia Commons
  // curid=72372072, curid=72372077, curid=86543919: narrow doors straight onto the lanes). Ends on the beach, the rock shelves or an earlier area's wall are already ends and
  // are left. Nothing continues past these ends in OSM: no through route is invented. Lanes ending on open, rideable
  // ground are left open (an OSM graph dead end is not a physical one). ----
  const deadEnds=[];deadEnds.skipped=[];
  {const earlierSolid=earlier.flatMap(a=>(a.colliders??[]).filter(c=>c.outer)).map(c=>({ring:c.outer.map(q=>[q.x,q.z])}));
    const hitRing=(o,u,ring)=>{let best=null;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],den=u[0]*(b[1]-a[1])-u[1]*(b[0]-a[0]);if(Math.abs(den)<1e-9)continue;
      const t=((a[0]-o[0])*(b[1]-a[1])-(a[1]-o[1])*(b[0]-a[0]))/den,v=((a[0]-o[0])*u[1]-(a[1]-o[1])*u[0])/den;if(t>0&&t<14&&v>=0&&v<=1&&(!best||t<best.t))best={t,a,b};}return best;};
    for(const st of streets){const r=roadById.get(st.id);if(!r)continue;
      for(const end of [0,1]){const p=end?st.points.at(-1):st.points[0],q=end?st.points.at(-2):st.points[1];
        if(city.roads.some(o=>o.id!==st.id&&o.points.some((a,i)=>i+1<o.points.length&&segmentDistance(p[0],p[1],a,o.points[i+1])<1.5)))continue;
        const [ux,uz]=unit(q,p),ahead=[1,2.5,4].map(d=>[p[0]+ux*d,p[1]+uz*d]);
        if(ahead.some(a=>inRing(a[0],a[1],BEACH)||inRing(a[0],a[1],ROCK_EAST)||inRing(a[0],a[1],ROCK_WEST)||height(...a)<.6)){deadEnds.skipped.push([st.id,'shore']);continue;}
        if(ahead.some(a=>earlierSolid.some(c=>inRing(a[0],a[1],c.ring)))){deadEnds.skipped.push([st.id,'earlier wall']);continue;}
        let door=null;for(const b of city.buildings){const ring=buildingOverrides.get(b.id)?.outer??b.outer;if(!ring.some(a=>Math.abs(a[0]-p[0])<40&&Math.abs(a[1]-p[1])<40))continue;
          // Ray from 3 m back up the alley (an OSM end often sits on or just inside the wall); the wall may stand up to 9 m on.
          const hit=hitRing([p[0]-ux*3,p[1]-uz*3],[ux,uz],ring);if(hit&&hit.t>1&&(!door||hit.t<door.t))door={...hit,house:{colour:buildingOverrides.get(b.id)?.colour}};}
        if(door&&door.t<12){const x=p[0]+ux*(door.t-3),z=p[1]+uz*(door.t-3),[fx,fz]=unit(door.a,door.b);
          deadEnds.push({kind:'door',id:st.id,x,z,y:height(x-ux*.3,z-uz*.3),face:[fx,fz],out:[-ux,-uz],colour:door.house.colour});continue;}
        // a lane that stops on open ground is not a physical dead end (the court-side planter cut a line the
        // stock controller rides both ways on the base), so it gets nothing: the open slope stays rideable.
        deadEnds.skipped.push([st.id,'open ground, rideable']);}}}
  // ---- two (calle-san-miguel-108_-394-w; Wikimedia Commons curid=86543919: painted shoulder-height retaining walls where the
  // bank meets the lane, planting above): along every district lane, wherever the ground rises ≥ 0.6 m within 1.2 m beyond
  // the paved edge, a 0.3 m wall 0.15 m off the edge, its top at the bank (capped at shoulder height, 1.5 m over the lane
  // edge), pale coping. Solid (one prism per ≤ 2 m piece; it looks solid and a rider can reach it). Gaps where another
  // lane, a house, the court, El Bowl, any earlier owner's ground or point dressing is within reach, so every crossing stays
  // open. The bank behind takes scrub and green tones instead of the grey yard concrete (smooth "ramp" in the audit still).
  const retaining=[];
  {const dry=(x,z)=>height(x,z)>.3,RW={off:.15,thick:.3,probe:1.2,rise:.45,cap:1.5,step:1,piece:2,toe:3}   /* second pass (San Miguel): from a 0.3 m rise the bank meets the lane at a low kerb-terrace, not in DEM facets*/,COL=['#4f7fb8','#d8bd52','#5f9e55','#e2dccb','#b8584c','#7fb6a8'];
    const points=[...palms,...poles,...rocks,...broadleaf].filter(o=>Number.isFinite(o?.x));
    const otherLane=(x,z,self)=>streets.some(s=>s!==self&&s.points.some((a,i)=>i+1<s.points.length&&segmentDistance(x,z,a,s.points[i+1])<s.half+.8));
    const owned=(x,z)=>earlierRings.some(r=>inRing(x,z,r))||inRing(x,z,COURT)||inRing(x,z,BOWL)||surfaces.some(q=>inRing(x,z,q.ring));
    // Fix round (wall-foot strips): a bank that is a fitted city wall's batter is not a lane bank. No wall within 3.5 m of
    // any earlier area's wall foot (the wall-foot strip and its ~1 m verge own that band; sj-wall-foot.js).
    const feet=earlier.flatMap(a=>(a.walls??[]).filter(v=>v.a?.B&&v.b?.B).map(v=>[v.a.LB??v.a.B,v.b.LB??v.b.B]));
    const nearFoot=(x,z)=>feet.some(([f0,f1])=>Math.abs(x-f0[0])<40&&Math.abs(z-f0[1])<40&&segmentDistance(x,z,f0,f1)<3.5);
    for(const st of streets){let run=[];const flush=()=>{if(run.length>=2)retaining.push(run);run=[];};
      for(let i=0;i+1<st.points.length;i++){const a=st.points[i],b=st.points[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.5)continue;
        const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
        for(const side of [1,-1]){const nx=-uz*side,nz=ux*side;run=[];
          for(let t=.5;t<=L-.5+1e-6;t+=RW.step){const cx=a[0]+ux*t,cz=a[1]+uz*t;
            // Second pass (San Miguel): the wall stands at the bank's actual toe, searched up to 3 m out (a level yard
            // often lies between the paving and the bank), on unowned ground; a run breaks where the toe offset jumps > 0.6 m.
            let o=null;for(let e=0;e<=RW.toe+1e-9;e+=.5){const o1=st.half+RW.off+e,P1=[cx+nx*o1,cz+nz*o1],Q1=[cx+nx*(o1+RW.probe),cz+nz*(o1+RW.probe)];
              if(e>0&&owned(...P1))break;if(height(...Q1)-height(...P1)>=RW.rise){o=o1;break;}}
            if(o===null){flush();continue;}
            const P=[cx+nx*o,cz+nz*o],Q=[cx+nx*(o+RW.probe),cz+nz*(o+RW.probe)];
            const g0=height(...P),g1=height(...Q),ok=g1-g0>=RW.rise&&dry(...Q)&&!inHouse(...Q,.5)&&!inHouse(...P,.3)&&!otherLane(...Q,st)&&!otherLane(...P,st)
              &&!owned(...Q)&&!nearFoot(...P)&&!nearFoot(...Q)&&!points.some(o2=>Math.hypot(o2.x-P[0],o2.z-P[1])<1.2||Math.hypot(o2.x-Q[0],o2.z-Q[1])<1.2);
            if(ok&&run.length&&Math.abs(run.at(-1).o-o)>.6)flush();
            if(ok)run.push({P,o,g0,top:Math.min(g1+.08,g0+RW.cap),nx,nz,ux,uz,st:st.id});else flush();}
          flush();}}}
    // Pieces: consecutive samples, ≤ 2 m each, one prism and one drawn block (bottom 0.25 m under the lowest front ground).
    const pieces=[];
    for(const run of retaining){const col=COL[Math.floor(hash(run[0].P[0]|0,run[0].P[1]|0,61)*COL.length)];
      // 2 m pieces where the top changes ≤ 0.6 m over them, else 1 m (steep lanes: no tall stepped ends).
      for(let k=0,step=1;k+1<run.length;k+=step){step=k+4<run.length&&Math.abs(run[k+4].top-run[k].top)<=.3&&Math.abs(run[k+4].o-run[k].o)<=.3?4:k+2<run.length&&Math.abs(run[k+2].top-run[k].top)<=.6?2:1;   /* second pass: 4 m pieces on even runs (cost) */const A=run[k],B=run[k+step],t=RW.thick;
        const ring=[[A.P[0],A.P[1]],[B.P[0],B.P[1]],[B.P[0]+B.nx*t,B.P[1]+B.nz*t],[A.P[0]+A.nx*t,A.P[1]+A.nz*t]],r2=signedArea(ring)<0?[...ring].reverse():ring;
        const bottom=Math.min(A.g0,B.g0)-.25,top=Math.max(A.top,B.top);prism(r2,bottom,top);
        pieces.push({a:A.P,b:B.P,n:[A.nx,A.nz],bottom,topA:A.top,topB:B.top,thick:t,colour:col});}}
    retaining.length=0;retaining.push(...pieces);
    // The bank behind every piece (up to 4 m back): green scrub (Wikimedia Commons curid=86543919's planting), never the grey yard tone.
    const {x0,z0,step,nx}=terrain;
    for(const q of retaining)for(let f=0;f<=1;f+=.25)for(let d=.4;d<=4;d+=step*.75){const x=q.a[0]+(q.b[0]-q.a[0])*f+q.n[0]*d,z=q.a[1]+(q.b[1]-q.a[1])*f+q.n[1]*d;
      const i=Math.round((x-x0)/step),j=Math.round((z-z0)/step),k=j*nx+i;if(earlier.some(e=>e.tint?.has(k))||inHouse(x,z,.2))continue;
      tint.set(k,hash(i,j,63)<.55?BANK[Math.floor(hash(i,j,65)*BANK.length)]:SCRUB[Math.floor(hash(i,j,67)*SCRUB.length)]);}}
  const places=[{name:'Cancha Carmelo Anthony',x:court.P(court.length/2,court.width/2)[0],z:court.P(court.length/2,court.width/2)[1],source:256387098}];
  void tops;void cuts;void floorTriangles;
  return {colliders,tops,cuts,tint,surfaces,floorTriangles,places,buildingOverrides,ownedBuildings:houses.map(h=>h.id),houses,streets,court,palms,poles,rocks,rail,broadleaf,deadEnds,retaining,sportsRings,
    batterLine,
    grid:{x0:terrain.x0,z0:terrain.z0,step:terrain.step},
    bowl:{ring:BOWL,tris:bowlTris},brick,constants:{COURT_DIMS,RAIL},
    qa:()=>({houses:houses.length,lowered:houses.filter(h=>h.base<h.src.base-.13).length,streets:streets.length,
      surfaces:surfaces.length,asphalt:surfaces.filter(s=>s.kind==='patched').length,colliders:colliders.length,palms:palms.length,
      poles:poles.length,spans:poles.filter(p=>p.prev>=0).length,droppedSpans:poles.dropped,rocks:rocks.length,clusters,broadleaf:broadleaf.length,rail:rail.length,bleacher:!!court.bleacher,tint:tint.size})};
}
