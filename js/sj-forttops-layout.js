/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// El Morro and San Cristóbal upper tiers, closures and seals (forttops, 2026-11-18) — © 2026 VibezZzCoder, MIT.
// OSM / ODbL outlines; heights: USGS DEM (2 m). References: Wikimedia Commons curid=72603185, curid=122907842, curid=123485577, curid=82861896, curid=14719072, curid=148962402, curid=148962401, curid=136301888, curid=124496780, curid=11855283, curid=34390675, HABS PR-47/PR-48/PR-94
// sheets (view-only), NPS flag FAQ.
// Area module (contract: header of sj-princesa-layout.js). Shared physical/render owner: sj-forttops.js draws
// exactly these numbers.
// Physics: both fort interiors are closed. The fitted fronts of `fort` / `cristobal` already stand along most of each
// outline; every outline stretch they do not cover gets a closure here — a closed iron gate where a mapped path or step
// meets the line, a low drawn masonry boundary wall elsewhere — and an invisible, non-occluding seal over it (the cemetery
// model, sj-perla-west-layout.js). `offLimitsAt` marks the interiors private for checked placement and recovery. Everything
// drawn inside the seals (upper tiers, barracks, cavaliers, flags) is render-only massing seated into the DEM.
import {fitRun,wallBody,FORT_OUTLINE,MERLON} from './sj-fort-layout.js';
import {fitKey,unpackFit} from './sj-forttops-fit.js';
import {FIT_BAKE} from './sj-forttops-bake.js';
import {CRISTOBAL_OUTLINE} from './sj-cristobal-layout.js';
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea} from './sj-paving.js';
import {minus,overlapB} from './sj-city-wall.js';
import {buildOutworks,buildDiablo} from './sj-forttops-outworks.js';
import {convexPieces} from './sj-gate-layout.js';
import {indexedRingsAt} from './sj-private.js';

// Closure blocks: level-topped 2 m pieces, 0.6 m thick, rise over the highest approach ground within 3 m
// outside (curtain/parapet height; launch envelope measured by the charged level hop ≈0.86 m incl. wheel query).
// bridges/connectors 2 cm narrower each side and joint blocks 3 cm proud on top, so no
// side or cap is coplanar with the pieces they overlap.
export const JOIN={inset:.02,proud:.03};
export const CLOSURE={bankSkip:true,rise:2.4,gate:2.4,iron:1.9,thick:.6,piece:2,lap:1.2,below:.6,insets:[0,.5,1.1,1.8,2.6,3.4,-.6,-1.2]};
// Low boundary wall where no fitted front stands (Wikimedia Commons curid=148962401: low masonry walls follow the bay-side slope; inferred height).
export const BOUNDARY={rise:1.15,half:.35,cap:.12};
// Closed iron gate at a mapped path/step crossing (the paseo-end gate's kit, sj-fort.js).
export const IRON_GATE={height:1.75,post:.5};
// Troop quarters (Wikimedia Commons curid=14719072: two storeys, cornice, low parapet; Wikimedia Commons curid=124496780: long cream facade, flags over it). Inferred metres.
export const BARRACKS={depth:10.5,eaves:7.4,roof:7.7,parapet:8.4};
// Flags (F1, Wikimedia Commons curid=14719072, curid=124496780): ~1.4×0.9 m on 6 m poles (inferred), 2.6 m apart.
export const FLAG={pole:6.2,w:1.45,h:.92,spacing:2.6,barracksAt:3.5,order:['burgundy','pr','us']};
const FLAGS={morro:[[-752.5,-603.5],[-750.4,-605.4],[-748.3,-607.3]]};

// Inner fronts (docs: DEM 5 m band maps + Wikimedia Commons curid=148962402, curid=148962401, HABS PR-48 sheet 2 for tier order). Points are inferred breakline
// fits in game metres; `returns` turn the ends 7 m into the high side like the fort's own runs.
const INNER_FRONTS=[
  // El Morro main block: the tall dark bay/Atlantic-facing scarp from the 35.5 m Plaza level down to the Santa Barbara
  // platform (22–23 m) and the north lawn (Wikimedia Commons curid=148962402, curid=148962401's dominant dark face; survey anchors (−798,−560) 35.55 etc.).
  {fort:'morro',name:'main-scarp',tone:'dark',line:[[-728,-642],[-760,-641.5],[-775,-636],[-783,-630],[-792,-623],[-799,-617],[-806,-609],
    [-806.5,-596],[-807,-582],[-811,-569],[-811.5,-557],[-815,-546]],returns:[true,false],openings:true,garitas:true},
  // Upper terreplein (42 m, land-front gun deck and main-block roofs) over the 35.5 m Plaza de Armas level: the 6–7 m inner
  // face the gate tunnel opens under (OSM fort footways 1179846758/1179846722 run along it); casemate doors at its foot.
  {fort:'morro',name:'upper-terrace',tone:'stone',line:[[-716,-613.5],[-735,-613],[-756,-612.5],[-760.5,-606],[-766,-600.5],[-771,-593.5],
    [-777.5,-586.5],[-783,-580.5],[-788,-575],[-792,-567.5],[-796,-560],[-797.5,-552],[-806,-545]],returns:[true,false],arcade:true,min:2},
  // Santa Barbara battery (Wikimedia Commons curid=148962402, curid=148962401 lower stepped battery with embrasures; HABS PR-48): its Atlantic face, the NW tip
  // over the water battery, and the long bay-side platform edge down to the south bastion's bay face (outline 47→55).
  {fort:'morro',name:'santa-barbara',tone:'stone',merlons:true,garitas:true,solid:true,line:[[-801,-659],[-815,-664.5],[-830,-671.5],[-845,-679.5],[-853,-678],
    [-857,-670],[-857,-657],[-850,-648],[-842,-641],[-840,-620],[-840,-600],[-838,-576],[-834,-556],[-829.17,-546.44]],returns:[true,false]},
  // South bastion's north face over the Santa Barbara platform (40→23 m), between the main scarp and the bay face.
  {fort:'morro',name:'bastion-north',tone:'dark',line:[[-805,-545.5],[-813.5,-543.2],[-822,-540]],returns:[true,false]},
  // South bastion's bay face on the mapped line itself (outline 46→55; Wikimedia Commons curid=148962401 right: dark walls over the green bay slope),
  // solid, so it is also the closure there.
  {fort:'morro',name:'bay-face',tone:'stone',merlons:true,solid:true,line:[[-829.17,-546.44],[-823.85,-537.6],[-825.27,-529.83],[-822.47,-513.49]],returns:[false,true]},
  // San Cristóbal cavalier (survey anchors (588,−175) 44.87 … (614,−250) 45.29; Wikimedia Commons curid=82861896, curid=11855283: the high angled ribbon over the
  // courtyard). West face 45→34 m over the Plaza de Armas (Wikimedia Commons curid=14719072 right: ochre casemate arches under it); east face 45→39 m.
  {fort:'cristobal',name:'cavalier-west',tone:'warm',line:[[598.5,-246],[595.5,-231],[593,-221],[588.5,-211],[588,-195],[588,-173],[590,-164.5],[594,-158.5]],
    returns:[true,true],arcade:true},
  {fort:'cristobal',name:'cavalier-east',tone:'warm',merlons:true,line:[[600.5,-160],[602.5,-175],[602,-205],[606,-215],[612,-221],[615,-236],[617,-250],[616.5,-259]],returns:[true,true]},
  // Main terreplein's south-east edge 39→30 m over the intermediate deck (survey (650,−210),(676,−218) ≈30.3).
  {fort:'cristobal',name:'deck-edge',tone:'warm',merlons:true,line:[[636,-213],[645,-226],[652,-233],[661,-241],[669,-250],[675,-259]],returns:[true,true]},
  // East bastion's raised terreplein (35–37 m) north-west edge over the 30 m deck.
  {fort:'cristobal',name:'east-bastion',tone:'warm',merlons:true,line:[[699,-236.5],[693,-231],[688.5,-215],[685,-202],[672,-197],[659,-192.5]],returns:[false,false]},
  // Hornwork (OSM outline 9→22+; 7→9 stays a low closure: a fit there climbs onto the cavalier's 45 m tip behind; HABS PR-94 location plan: the low outwork wedge south of the land front; Wikimedia Commons curid=11855283): fitted
  // on the mapped line itself, so it is a closure — solid like the fort's own fronts (wallBody + parapet).
  {fort:'cristobal',name:'hornwork',tone:'warm',merlons:true,outline:true,solid:true,line:[[583.98,-144.56],
    [572.12,-151.94],[571.26,-151.6],[571.59,-150.72],[593.94,-134.79],[593.25,-133.21],[593.99,-131.06],[589.37,-125.55],[582.51,-128.14],
    [582.17,-135.78],[580.83,-135.84],[581.32,-122.85],[594.84,-118.02],[601.12,-126.8],[607.2,-135.4]],returns:[false,false],min:1.5},
  // Trinidad outwork (OSM 509326338; HABS PR-94 sheets 1/5, Wikimedia Commons curid=34390675: the outwork's scarp opposite the fort across the
  // dry ditch). Its north and west faces over the ditch, solid (public ground on both sides); intervals whose foot comes
  // within 1.5 m of a mapped road edge are dropped (the ditch service road 260860202 runs below).
  {fort:'cristobal',name:'trinidad',tone:'warm',merlons:true,solid:true,roadClear:1.5,line:[[672.74,-169.46],[653.48,-168.69],[648.3,-153.83],[645.79,-155.17],[638.88,-142.09]],returns:[true,false],min:1.8},
  // Courtyard north side: the 41 m north rampart terreplein over the 34 m Plaza de Armas (Wikimedia Commons curid=14719072: tall plain end wall).
  {fort:'cristobal',name:'court-north',tone:'warm',line:[[556,-239],[572,-241.5],[588,-243.5],[595.5,-245.5]],returns:[true,false]},
];
// Decks. y: level of the platform; rise: cap over the walk edge; band: ramp width from the walk edge.
const DECKS=[
  {fort:'morro',name:'santa-barbara-platform',west:'santa-barbara',east:'main-scarp',z0:-617,z1:-555,y:22.6,rise:0,band:1.5,colour:'#c4bba7'},
  {fort:'morro',name:'plaza-level',west:'main-scarp',east:'upper-terrace',z0:-604,z1:-556,y:35.5,rise:1.5,band:3,colour:'#cbc2ae'},
  {fort:'cristobal',name:'plaza-de-armas',westRun:'land',east:'cavalier-west',z0:-227,z1:-170,y:34.1,rise:1.2,band:3,colour:'#c4b394'},
];
function convexCut(r){const s=Math.sign(signedArea(r));const planes=r.map((a,i)=>{const b=r[(i+1)%r.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1,nx=-s*ez/l,nz=s*ex/l;return [nx,0,nz,-(nx*a[0]+nz*a[1])];});
  const xs=r.map(p=>p[0]),zs=r.map(p=>p[1]);return {ring:r,planes,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),tight:true,kind:'forttops-deck'};}
const DECK_ROW=4;
// Water-battery coping: joints up to this step stay continuous (the 5.6 m abutment at the
// right return left a notch; the cap now runs up the return to the Santa Barbara face).
const WB_STEP=6;
// Stone-toned bank at the foot of El Morro's public-facing fronts (see the tint section).
const SKIRT_FRONTS=['bay-face','santa-barbara','bastion-north','main-scarp'],FOOTING_FRONTS=['bay-face','santa-barbara','bastion-north'],FOOTING={rise:.35,course:.25,proud:.3};
const WATER={y:7.0,xMax:-845,zMin:-692,zMax:-650};
// For tools/bake-forttops.mjs: each front's fitted input polyline (with returns) and inner reach.
export const INNER_FRONTS_FOR_BAKE=()=>INNER_FRONTS.map(sp=>({name:sp.name,pts:sp.returns?withReturns(sp.line,sp.returns):sp.line,inner:sp.inner??8}));
const MANUAL_RETURNS=[['morro',[[-802.4,-656.6],[-799.6,-655.2],[-798.4,-654.3]]]];
const withReturns=(pts,[head,tail],R=7)=>{const out=[...pts];
  if(head){const [ux,uz]=unit(pts[0],pts[1]);out.unshift([pts[0][0]+uz*R,pts[0][1]-ux*R]);}
  if(tail){const [ux,uz]=unit(pts.at(-2),pts.at(-1));out.push([pts.at(-1)[0]+uz*R,pts.at(-1)[1]-ux*R]);}
  return out;};
function ringsOverlap(A,B){const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(const p of A)if(inRing(p[0],p[1],B))return true;for(const p of B)if(inRing(p[0],p[1],A))return true;
  for(let i=0;i<A.length;i++)for(let j=0;j<B.length;j++){const a=A[i],b=A[(i+1)%A.length],c=B[j],d=B[(j+1)%B.length];
    if(cross(c,d,a)*cross(c,d,b)<0&&cross(a,b,c)*cross(a,b,d)<0)return true;}return false;}
const unit=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return [dx/l,dz/l];};
const lerp2=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function bbox(r){let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of r){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0];if(p[1]<c)c=p[1];if(p[1]>d)d=p[1];}return [a,b,c,d];}
// Uniform-grid index of items with a bbox `bb` ([minX,maxX,minZ,maxZ]); query returns candidates in insertion order.
function gridIndex(items,cell=8){const m=new Map(),k=(i,j)=>i*100003+j;
  items.forEach((it,n)=>{const b=it.bb;for(let i=Math.floor(b[0]/cell);i<=Math.floor(b[1]/cell);i++)for(let j=Math.floor(b[2]/cell);j<=Math.floor(b[3]/cell);j++){
    const key=k(i,j);let l=m.get(key);if(!l)m.set(key,l=[]);l.push(n);}});
  return bb=>{const out=new Set();for(let i=Math.floor(bb[0]/cell);i<=Math.floor(bb[1]/cell);i++)for(let j=Math.floor(bb[2]/cell);j<=Math.floor(bb[3]/cell);j++)
    for(const n of m.get(k(i,j))??[])out.add(n);return [...out].sort((a,b)=>a-b).map(n=>items[n]);};}
function distToRing(x,z,r){if(inRing(x,z,r))return 0;let d=Infinity;for(let i=0;i<r.length;i++)d=Math.min(d,segmentDistance(x,z,r[i],r[(i+1)%r.length]));return d;}

// Perimeter closure of one fort. covered(p): a fitted interval's masonry (face foot B → walk edge W) or a tall existing solid
// (gate frontispiece / body) stands within `near` metres. Returns the uncovered stretches as polylines along the outline.
function openStretches(outline,{walls,colliders,height},near=.6,step=.5){
  // Masonry B→W, plus the ground in front of a face mid-run (a face standing inside the outline still closes it). Not at a
  // run's last three intervals: a front zone there reaches round the run end (perimeter sweep: five corner entries).
  const lb=s=>s.LB??s.B,o=s=>[lb(s)[0]+s.nx*2,lb(s)[1]+s.nz*2],idx=new Map(walls.map((w,i)=>[w.a,i]));
  const same=(s,t)=>s&&t&&Math.abs(s.x-t.x)<1e-6&&Math.abs(s.z-t.z)<1e-6;
  const mid=w=>{let k=0;for(let i=idx.get(w.a),j=0;j<3;j++){const p=walls[i-1-j],q=walls[i+1+j];if(p&&same(p.b,walls[i-j].a)&&q&&same(q.a,walls[i+j].b))k++;}return k===3;};
  const quads=walls.flatMap(w=>{const {a,b}=w;return mid(w)?[[a.B,b.B,b.W,a.W],[lb(a),lb(b),o(b),o(a)]]:[[a.B,b.B,b.W,a.W]];}).map(r=>({r,bb:bbox(r)}));
  // …and the wedge in front of a mid-run salient (neighbouring front quads splay apart there).
  const feet=walls.filter(mid).flatMap(({a,b})=>[a,b]).map(s=>({f:lb(s),nx:s.nx,nz:s.nz,bb:[lb(s)[0],lb(s)[0],lb(s)[1],lb(s)[1]]})),fIdx=gridIndex(feet);
  const solids=colliders.filter(c=>c.outer&&c.outer.length>=3).map(c=>({r:c.outer.map(p=>[p.x,p.z]),c})).map(o=>({...o,bb:bbox(o.r)}))
    .filter(o=>{const [x0,x1,z0,z1]=o.bb;return Math.max(x1-x0,z1-z0)<30;});
  const qIdx=gridIndex(quads),sIdx=gridIndex(solids);
  const covered=(x,z)=>{for(const q of qIdx([x-near,x+near,z-near,z+near])){const b=q.bb;if(x<b[0]-near||x>b[1]+near||z<b[2]-near||z>b[3]+near)continue;if(distToRing(x,z,q.r)<near)return true;}
    for(const f of fIdx([x-2,x+2,z-2,z+2])){const dx=x-f.f[0],dz=z-f.f[1];if(Math.abs(dx)<2&&Math.abs(dz)<2&&Math.hypot(dx,dz)<2&&dx*f.nx+dz*f.nz>-.2)return true;}
    for(const o of sIdx([x-near,x+near,z-near,z+near])){const b=o.bb;if(x<b[0]-near||x>b[1]+near||z<b[2]-near||z>b[3]+near)continue;
      if(o.c.maxY-height(x,z)>2.5&&distToRing(x,z,o.r)<near)return true;}return false;};
  const samples=[];
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/step));
    for(let k=0;k<n;k++){const p=lerp2(a,b,k/n);samples.push({p,edge:i,covered:covered(...p)});}}
  // A covered gap of ≤2 m between open samples stays open (the NE stair corner's 0.6 m tip edge read as covered, so the
  // stair tongue's mouth was never closed).
  {const N=samples.length;for(let i=0;i<N;i++){if(samples[i].covered||!samples[(i+1)%N].covered)continue;
    let j=1;while(j<=5&&samples[(i+j)%N].covered)j++;if(j<=5&&!samples[(i+j)%N].covered)for(let k=1;k<j;k++)samples[(i+k)%N].covered=false;}}
  // Rotate so the list starts on a covered sample, then collect maximal uncovered runs (with one covered neighbour each side).
  const s0=samples.findIndex(s=>s.covered),N=samples.length,list=s0<0?samples:[...samples.slice(s0),...samples.slice(0,s0)];
  const runs=[];let cur=null;
  for(let i=0;i<=N;i++){const s=list[i%N];
    if(!s.covered){if(!cur)cur={pts:[list[(i-1+N)%N].p],edges:new Set()};cur.pts.push(s.p);cur.edges.add(s.edge);}
    else if(cur){cur.pts.push(s.p);runs.push(cur);cur=null;}}
  return runs;
}

export function createForttopsLayout({city,height,terrain,surface,fort,gate,isDry,areas}) {
  void surface;const T_=[['start',performance.now()]];
  const cristobal=areas?.cristobal;
  const colliders=[],tops=[],cuts=[],surfaces=[],floorTriangles=[],places=[];
  const prism=(outer,minY,maxY,extra={})=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support:false,...extra};colliders.push(c);return c;};
    const groundMax=(pts,r=2.5)=>{let m=-Infinity;for(const p of pts)for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]])m=Math.max(m,height(p[0]+dx,p[1]+dz));return m;};
  const groundMin=pts=>Math.min(...pts.map(p=>height(...p)));

  // ---- San Cristóbal troop quarters (Wikimedia Commons curid=14719072, curid=124496780): the long cream two-storey block right of the main gate stands on the
  // land-front line itself (Wikimedia Commons curid=124496780: its outer facade continues the gate frontispiece's plane to the salient garita at
  // vertex 6). The bare-earth DEM keeps no trace of it (courtyard 34 m behind a 28–30 m street edge), so the fitted land
  // front is not drawn there. Outer facade on the outline 5→6 from the frontispiece's south side to vertex 6; depth and
  // heights inferred from Wikimedia Commons curid=14719072's two storeys over the courtyard (gate threshold) level. Solid (reachable from outside).
  let barracks=null;
  if(cristobal?.frame){const O=CRISTOBAL_OUTLINE,a=O[5],b=O[6],[ux,uz]=unit(a,b),nx=-uz,nz=ux,L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const F=cristobal.frame,gv=p=>(p[0]-F.origin[0])*F.px+(p[1]-F.origin[1])*F.pz;
    // Behind the fitted land front: the outer facade stands 0.4 m inside the farthest wall-walk edge (W) along 5→6, so the
    // 4 m rampart and its walk stay in front of it (Wikimedia Commons curid=124496780: the facade rises over the ramp wall and rampart).
    const along=p=>(p[0]-a[0])*ux+(p[1]-a[1])*uz,inward=p=>-((p[0]-a[0])*nx+(p[1]-a[1])*nz);
    let d0=0;for(const w of cristobal.walls)if(w.run==='land')for(const s of [w.a,w.b]){const t=along(s.W);if(t>-2&&t<L+2)d0=Math.max(d0,inward(s.W),inward(s.Q));}
    d0+=.4;
    let t0=0;while(t0<L&&gv([a[0]+ux*t0-nx*d0,a[1]+uz*t0-nz*d0])<cristobal.constants.GATE.half+1.2)t0+=.02;
    const t1=L-1.5,depth=BARRACKS.depth,floor=cristobal.ramp.yGate;
    const P=(t,d)=>[a[0]+ux*t-nx*(d0+d),a[1]+uz*t-nz*(d0+d)];
    const ring=[P(t0,0),P(t1,0),P(t1,depth),P(t0,depth)];
    let lo=Infinity;for(let t=t0;t<=t1+1e-6;t+=.5)for(let d=0;d<=depth+.01;d+=.5)lo=Math.min(lo,height(...P(t,d)));
    barracks={a,ux,uz,nx,nz,t0,t1,d0,depth,floor,P,ring,bottom:lo-.4,eaves:floor+BARRACKS.eaves,roof:floor+BARRACKS.roof,parapet:floor+BARRACKS.parapet};}

  T_.push(['fronts',performance.now()]);
  // ---- Inner fronts (render-only; both interiors are sealed). fitRun (sj-fort-layout.js) on authored breaklines, the DEM's
  // own tier steps (5 m bands, docs): (−uz,ux) of each polyline points to the low side. Intervals overlapping an existing
  // fitted front's masonry or another owner are dropped; drawn where both stations stand ≥1.5 m. ----
  const ownMasonry=[];for(const [,area] of [['m',fort],['c',cristobal]])if(area)for(const {a,b} of area.walls){const r=[a.LB??a.B,b.LB??b.B,b.W,a.W];ownMasonry.push({r,bb:bbox(r)});}
  for(const t of [...(fort?.tops??[]),...(cristobal?.tops??[])]){const r=t.poly.map(p=>[p.x,p.z]);ownMasonry.push({r,bb:bbox(r)});}
  const omIdx=gridIndex(ownMasonry);
  const overlapsOwner=r=>{const bb=bbox(r);return omIdx(bb).some(o=>overlapB(o.bb,bb)&&ringsOverlap(r,o.r));};
  const roadSegs=city.roads.filter(r=>r.kind!=='steps').flatMap(r=>r.points.slice(1).map((q,i)=>({a:r.points[i],b:q,h:r.width/2,bb:bbox([r.points[i],q])}))),roadIdx=gridIndex(roadSegs,16);
  const fronts=[];
  for(const spec of INNER_FRONTS){const area=spec.fort==='morro'?fort:cristobal;if(!area)continue;
    const pts=spec.returns?withReturns(spec.line,spec.returns):spec.line;
    // Baked fit when its key (polyline, inner, DEM checksum) matches; else the runtime fit.
    const tf0=performance.now(),inner_=spec.inner??8,rec=FIT_BAKE?.[spec.name],key=rec&&terrain?.heights?fitKey(pts,inner_,terrain):null;
    const fit=rec&&rec.key===key?unpackFit(rec):fitRun(pts,height,{inner:inner_});if(rec&&rec.key!==key)T_.stale=(T_.stale??[]).concat(spec.name);T_.fit=(T_.fit??0)+performance.now()-tf0;
    // Plinth bottoms 0.4 m under the DEM at the plinth front too (fitRun buries F/B/L; LB sat 2 cm deep at one station).
    for(const st of fit.stations)st.bottom=Math.min(st.bottom,height(...st.LB)-.4,height(...st.B)-.4);
    const list=fit.segs.flatMap(g=>g.stations.slice(0,-1).map((a,i)=>({a,b:g.stations[i+1]})));
    const walls=[],ends=[];
    const roadNear=p=>spec.roadClear&&roadIdx([p[0]-8,p[0]+8,p[1]-8,p[1]+8]).some(r=>segmentDistance(p[0],p[1],r.a,r.b)<r.h+spec.roadClear);
    const ok=list.map(({a,b})=>Math.min(a.walk-a.base,b.walk-b.base)>=(spec.min??1.5)&&Math.abs(a.walk-b.walk)<=3&&!overlapsOwner([a.LB??a.B,b.LB??b.B,b.W,a.W])
      &&![a.LB??a.B,b.LB??b.B,a.W,b.W].some(roadNear));
    // Short gaps (≤3 intervals between drawn ones; crest jumps or low stations) are plugged with the neighbours' lower
    // crest/walk (slits between main-scarp sections, see-through once a deck cut runs behind them).
    const plugAt=new Map();
    for(let i=1;i<list.length-1;i++){if(ok[i]||!ok[i-1])continue;let j=i;while(j<list.length&&!ok[j])j++;
      if(j>=list.length||j-i>3){i=j;continue;}const p_=list[i-1],n_=list[j];
      const crest=Math.min(p_.a.crest,p_.b.crest,n_.a.crest,n_.b.crest),walk=Math.min(p_.a.walk,p_.b.walk,n_.a.walk,n_.b.walk);
      for(let k=i;k<j;k++){if(overlapsOwner([list[k].a.LB??list[k].a.B,list[k].b.LB??list[k].b.B,list[k].b.W,list[k].a.W]))continue;ok[k]=true;plugAt.set(k,{crest,walk});}i=j;}
    list.forEach(({a,b},i)=>{if(!ok[i])return;const pl=plugAt.get(i);
      walls.push(pl?{a,b,walk:pl.walk,crest:pl.crest,plugWalk:pl.walk,kerb:Math.min(a.kerb,b.kerb),run:spec.name}:{a,b,walk:Math.max(a.walk,b.walk),run:spec.name});
      if(spec.solid){const walk=Math.max(a.walk,b.walk),P_=fort?.constants?.PARAPET??{rise:1};wallBody(prism,a,b,Math.min(a.bottom,b.bottom)-.2,walk);
        prism([a.T,b.T,b.Q,a.Q],Math.min(a.crest,b.crest)-1.5,walk+P_.rise);}
      if(!ok[i-1])ends.push({s:a,dir:-1});if(!ok[i+1])ends.push({s:b,dir:1});});
    // Garitas (Wikimedia Commons curid=123485577, curid=136301888; HABS PR-48): on tall salients of fronts that carry them, the fort's own rule (turn ≥0.45, faces ≥6 m).
    const garitas=[];
    if(spec.garitas)for(let k=1;k<fit.segs.length;k++){const A=fit.segs[k-1],B=fit.segs[k],turn=A.ux*B.nx+A.uz*B.nz;
      const tip=A.stations.at(-1),rise=Math.max(...[...A.stations.slice(-4),...B.stations.slice(0,4)].map(s=>s.top-s.base));
      if(turn<.45||rise<6||!walls.some(x=>x.a===tip||x.b===tip))continue;
      const bx=A.nx+B.nx,bz=A.nz+B.nz,l=Math.hypot(bx,bz);
      garitas.push({x:tip.T[0]+bx/l*.35,z:tip.T[1]+bz/l*.35,y:tip.walk-.55,radius:.8,body:2.15,corbel:1.15,wallNx:bx/l,wallNz:bz/l});}
    fronts.push({...spec,fit,walls,ends,garitas,stations:fit.stations});}

  // where the DEM comes within 8 cm of an inner front's walk, the
  // terrain under that walk quad is cut (render only; the walk is drawn over exactly that footprint).
  for(const f of fronts)for(const w of f.walls){const {a,b}=w,q=[a.Q,b.Q,b.W,a.W],sg=Math.sign(signedArea(q));if(!sg)continue;
    const cvx=q.every((p0,k)=>{const p1=q[(k+1)%4],p2=q[(k+2)%4];return sg*((p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]))>1e-9;});if(!cvx)continue;
    const wa=w.plugWalk??a.walk,wb=w.plugWalk??b.walk,pts=[[a.Q,wa],[b.Q,wb],[b.W,wb],[a.W,wa],[[(a.Q[0]+b.W[0])/2,(a.Q[1]+b.W[1])/2],(wa+wb)/2]];
    if(pts.some(([p,y])=>height(...p)>y-.08)){const c=convexCut(q);c.kind='forttops-walk';cuts.push(c);}}

  T_.push(['decks',performance.now()]);
  // ---- Decks (platforms read as coloured terrain with DEM wedges between wall ribbons). A bounded paved
  // platform between one front's walk edge (W, at that walk) and the facing front's foot (L), level across at `y` (or the
  // walk itself), ruled every 2 m along z; the DEM under it is cut (render only, tight convex pieces) and its two open ends
  // get masonry skirts to the exact kept terrain. Interiors are sealed: no physics. The facing faces reach below it. ----
  const decks=[];
  const lineAt=(sts,key,hk)=>{const pts=sts.map(s=>({x:s[key][0],z:s[key][1],y:hk?s[hk]:0})).sort((a,b)=>a.z-b.z);
    return z=>{if(z<=pts[0].z)return {...pts[0],z};if(z>=pts.at(-1).z)return {...pts.at(-1),z};let i=1;while(pts[i].z<z)i++;const a=pts[i-1],b=pts[i],t=(z-a.z)/((b.z-a.z)||1);
      return {x:a.x+(b.x-a.x)*t,z,y:a.y+(b.y-a.y)*t};};};
  const terrainProfile=(a,b)=>{const {x0,z0,step}=terrain,ts=new Set([0,1]),dx=b[0]-a[0],dz=b[1]-a[1];
    const add=(f0,df,c0)=>{if(Math.abs(df)<1e-12)return;const lo=Math.min(f0,f0+df),hi=Math.max(f0,f0+df);
      for(let k=Math.ceil((lo-c0)/step);c0+k*step<=hi+1e-9;k++){const t=(c0+k*step-f0)/df;if(t>1e-9&&t<1-1e-9)ts.add(t);}};
    add(a[0],dx,x0);add(a[1],dz,z0);add(a[0]+a[1],dx+dz,x0+z0);
    return [...ts].sort((p,q)=>p-q).map(t=>{const x=a[0]+dx*t,z=a[1]+dz*t;return [x,height(x,z),z];});};
  for(const D of DECKS){const W_=fronts.find(f=>f.name===D.west)??null,E_=fronts.find(f=>f.name===D.east);
    const wSt=(W_?W_.walls.flatMap(x=>[x.a,x.b]):(D.fort==='cristobal'?cristobal:fort).walls.filter(x=>x.run===D.westRun).flatMap(x=>[x.a,x.b])).filter(s=>s.W[1]>=D.z0-3&&s.W[1]<=D.z1+3);
    const eSt=E_.walls.flatMap(x=>[x.a,x.b]).filter(s=>s.T[1]>=D.z0-3&&s.T[1]<=D.z1+3);
    if(wSt.length<2||eSt.length<2)continue;
    const Wl=lineAt(wSt,'W','walk'),El=lineAt(eSt,'T','base');
    const rows=[];for(let z=D.z0;z<=D.z1+1e-6;z+=Math.min(DECK_ROW,D.z1-z||DECK_ROW)){const w_=Wl(z),e_=El(z);const yW=w_.y-.03,y=D.y??yW;
      rows.push({z,W:[w_.x,w_.z],E:[e_.x,e_.z],yW:D.y===undefined?yW:Math.min(yW,D.y),y:Math.min(y,yW+D.rise),M:[w_.x+(e_.x-w_.x)*Math.min(.9,D.band/Math.max(1,Math.abs(e_.x-w_.x))),z]});if(z>=D.z1)break;}
    const tris=[],cutsD=[];
    for(let i=0;i+1<rows.length;i++){const a=rows[i],b=rows[i+1];
      const P=(p,y)=>[p[0],y,p[1]];
      tris.push([P(a.W,a.yW),P(b.W,b.yW),P(b.M,b.y)],[P(a.W,a.yW),P(b.M,b.y),P(a.M,a.y)],[P(a.M,a.y),P(b.M,b.y),P(b.E,b.y)],[P(a.M,a.y),P(b.E,b.y),P(a.E,a.y)]);
      for(const q of [[a.W,b.W,b.M,a.M],[a.M,b.M,b.E,a.E]]){if(Math.abs(signedArea(q))<1e-3)continue;
        const sg=Math.sign(signedArea(q)),cvx=q.every((p0,k)=>{const p1=q[(k+1)%4],p2=q[(k+2)%4];return sg*((p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]))>1e-9;});
        if(cvx)cutsD.push(convexCut(q));else for(const t of [[q[0],q[1],q[2]],[q[0],q[2],q[3]]])if(Math.abs(signedArea(t))>1e-4)cutsD.push(convexCut(t));}}
    const skirts=[];for(const r of [rows[0],rows.at(-1)])skirts.push({prof:terrainProfile(r.W,r.E),r});
    const minY=Math.min(...rows.map(r=>Math.min(r.yW,r.y)));
    for(const s of eSt){s.bottom=Math.min(s.bottom,minY-.4);if(s.B[1]>=D.z0-1&&s.B[1]<=D.z1+1)s.noPlinth=true;}
    cuts.push(...cutsD);decks.push({...D,rows,tris,skirts});}

  T_.push(['plugs',performance.now()]);
  // ---- Plugs: short undrawn gaps inside fitted fronts. `fort`/`cristobal` skip an interval whose crest jumps >3 m (the
  // 2 m DEM smears a salient tip low); at San Cristóbal's v43 salient that left a 3.7 m smeared ramp up to the 38.7 m walk
  // that the stock controller climbed (perimeter sweep). Each gap of ≤3 intervals between drawn neighbours, standing
  // ≥1.2 m, is filled with the neighbours' lower crest/walk: same section stations, solid to the parapet. ----
  const plugs=[];
  for(const [key,area] of [['morro',fort],['cristobal',cristobal]]){if(!area)continue;const drawn=new Set(area.walls.map(x=>x.a));
    for(const run of area.runs){const list=run.segs.flatMap((g,gi)=>g.stations.slice(0,-1).map((a,i)=>({a,b:g.stations[i+1],gi})));
      const last=run.segs.length-1;
      for(let i=1;i<list.length-1;i++){if(drawn.has(list[i].a)||!drawn.has(list[i-1].a))continue;
        let j=i;while(j<list.length&&!drawn.has(list[j].a))j++;
        if(j>=list.length||j-i>3)continue;const gap=list.slice(i,j);
        if(gap.some(iv=>iv.gi===0&&run.returns?.[0]!==false||iv.gi===last&&run.returns?.[1]!==false)&&(gap[0].gi===0||gap.at(-1).gi===last))continue;
        if(Math.min(...gap.map(iv=>Math.min(iv.a.walk-iv.a.base,iv.b.walk-iv.b.base)))<1.2&&Math.max(...gap.map(iv=>iv.a.walk-iv.a.base))<4)continue;
        const prev=list[i-1],next=list[j],crest=Math.min(prev.a.crest,prev.b.crest,next.a.crest,next.b.crest),walk=Math.min(prev.b.walk,next.a.walk,prev.a.walk,next.b.walk);
        for(const iv of gap){const bottom=Math.min(iv.a.bottom,iv.b.bottom)-.2;
          plugs.push({fort:key,run:run.name,a:iv.a,b:iv.b,crest,walk,bottom});
          prism([iv.a.B,iv.b.B,iv.b.W,iv.a.W],bottom,walk+(fort?.constants?.PARAPET?.rise??1));}
        i=j;}}}

  T_.push(['closures',performance.now()]);
  // ---- Perimeter closures: every closure is a drawn, solid, level-topped block — its collider is exactly
  // what is drawn (no invisible seals). Each block stands CLOSURE.rise over the highest ground within 3 m outside it, so a
  // rider always meets visible masonry or iron first. The enclosures are the outlines with two replacements:
  //  - El Morro's bay side follows the (now solid) Santa Barbara battery face and its north face; the water battery at
  //    the tip keeps the mapped line (its low parapet is the closure there), so the bay slope below the battery is public
  //    ground (Wikimedia Commons curid=148962401: green slope under the battery edge), not a boundary zigzag;
  //  - San Cristóbal's NE stair tongue (v35–v40) is cut off at its base by a closed iron gate from the east front's end to
  // the north front's return (7.5 m entry along the tongue).
  const closures={morro:[],cristobal:[]},stats={blocks:0,gates:0};
  const RINGS={};
  if(fort){const O=FORT_OUTLINE;RINGS.morro=[...O.slice(0,24),[-801,-659],[-815,-664.5],[-830,-671.5],[-845,-679.5],...O.slice(25,35),
    [-857,-657],[-850,-648],[-842,-641],[-840,-620],[-840,-600],[-838,-576],[-834,-556],...O.slice(46)];}
  if(cristobal){const O=CRISTOBAL_OUTLINE;RINGS.cristobal=[...O.slice(0,35),[689.9,-262.2],...O.slice(41)];}
  const forts=[['morro',fort,RINGS.morro],['cristobal',cristobal,RINGS.cristobal]].filter(f=>f[1]);
  // Ground in front of every fitted face (wall-foot strips; sj-wall-foot.js) stays clear of these solids.
  // Steep natural bank in front at both ends for every strip width: sj-wall-foot.js builds no strip there ('bank').
  // Mirrors sj-wall-foot.js's 'bank' rejection per interval: at every strip width one of its two nodes has the ground
  // at the strip's outer edge more than 0.8·width off the foot (meeting) height.
  const failAt=(s,wd)=>{const f=s.LB??s.B,y=Math.min(Math.max(height(...f),(height(...f)+height(...(s.L??f)))/2),s.base+.5);return Math.abs(height(f[0]+s.nx*wd,f[1]+s.nz*wd)-y)>.8*wd+.05;};
  const bankIv=(a,b)=>[2.5,2,1.6,1.3,1,.75,.5].every(wd=>failAt(a,wd)||failAt(b,wd));
  const zones=[];for(const [,area] of forts)for(const {a,b} of area.walls){if(CLOSURE.bankSkip&&bankIv(a,b))continue;const lb=s=>s.LB??s.B,o=s=>[lb(s)[0]+s.nx*4.5,lb(s)[1]+s.nz*4.5],
    back=s=>[lb(s)[0]-s.nx*.15,lb(s)[1]-s.nz*.15],[tx,tz]=unit(lb(a),lb(b)),e=(p,k)=>[p[0]+tx*k,p[1]+tz*k];
    if(Math.hypot(lb(b)[0]-lb(a)[0],lb(b)[1]-lb(a)[1])>1e-3)zones.push([e(back(a),-.4),e(back(b),.4),e(o(b),1.2),e(o(a),-1.2)]);}
  const zoneItems=zones.map(r=>({r,bb:bbox(r)})),zIdx=gridIndex(zoneItems);
  const clear=ring=>{const bb=bbox(ring),hit=zIdx(bb).filter(z=>overlapB(z.bb,bb)).map(z=>z.r);return hit.length?minus([ring],hit):[ring];};
  // Mapped paths/steps meeting the closed line (OSM footway/steps/pedestrian): a closed iron gate there.
  const paths=city.roads.filter(r=>['footway','path','steps','pedestrian'].includes(r.kind));
  const pathSegs=paths.flatMap(rd=>rd.points.slice(1).map((q,i)=>({a:rd.points[i],b:q,bb:bbox([rd.points[i],q])}))),pIdx=gridIndex(pathSegs,16);
  const nearPath=(p,r=1.6)=>pIdx([p[0]-r,p[0]+r,p[1]-r,p[1]+r]).some(sg=>segmentDistance(p[0],p[1],sg.a,sg.b)<r);
  const solidFronts=key=>fronts.filter(f=>f.solid&&f.fort===key).flatMap(f=>f.walls);
  const masonry=[];for(const [key,area] of forts)for(const {a,b} of [...area.walls,...plugs.filter(q=>q.fort===key),...solidFronts(key)]){const r=[a.B,b.B,b.W,a.W];if(Math.abs(signedArea(r))>1e-3)masonry.push({r,bb:bbox(r)});}
  const mIdx=gridIndex(masonry);
  // Face-top points (T→W, every 0.5 m along each drawn/plugged interval): where a connector meets solid masonry.
  const faceTops=[];for(const [key,area] of forts)for(const {a,b} of [...area.walls,...plugs.filter(q=>q.fort===key),...solidFronts(key)]){const L=Math.hypot(b.T[0]-a.T[0],b.T[1]-a.T[1]),n=Math.max(1,Math.ceil(L/.5));
    for(let i=0;i<=n;i++){const t=i/n,T=[a.T[0]+(b.T[0]-a.T[0])*t,a.T[1]+(b.T[1]-a.T[1])*t],W=[a.W[0]+(b.W[0]-a.W[0])*t,a.W[1]+(b.W[1]-a.W[1])*t];
      faceTops.push({p:[T[0]+(W[0]-T[0])*.3,T[1]+(W[1]-T[1])*.3],walk:Math.min(a.walk,b.walk)});}}
  const blocks=[];
  // One closure block: exact convex footprint, flat top; drawn and collided identically.
  const block=(ring,bottom,top,kind,key,role)=>{const c=prism(ring,bottom,top);if(!c)return null;const b={ring,bottom,top,kind,fort:key,role,collider:c};blocks.push(b);stats.blocks++;if(kind==='gate')stats.gates++;return b;};
  // Highest ground the block can be approached from: its footprint plus 0.5…3 m outside it (outward n).
  const approachTop=(pts,n)=>{let m=-Infinity;for(const p of pts)for(const d of [0,.5,1,2,3])m=Math.max(m,height(p[0]+n[0]*d,p[1]+n[1]*d));return m;};
  for(const [key,area,ring] of forts){
    const runs=openStretches(ring,{walls:[...area.walls,...plugs.filter(q=>q.fort===key),...solidFronts(key)],colliders:area.colliders,height});
    for(const run of runs){
      // Lap the run ends straight on until they are inside the covering masonry (≤5 m), else 1.2 m.
      const pts=run.pts.map(p=>[...p]);
      const lap=(p,[ux,uz])=>{for(let d=.25;d<=5;d+=.25){const q=[p[0]+ux*d,p[1]+uz*d];if(mIdx([q[0],q[0],q[1],q[1]]).some(m=>inRing(q[0],q[1],m.r)))return [q[0]+ux*.3,q[1]+uz*.3];}
        return [p[0]+ux*CLOSURE.lap,p[1]+uz*CLOSURE.lap];};
      pts[0]=lap(pts[0],unit(pts[1],pts[0]));pts[pts.length-1]=lap(pts.at(-1),unit(pts.at(-2),pts.at(-1)));
      const line=[pts[0]];for(let i=1;i<pts.length-1;i++){const [ax,az]=unit(pts[i-1],pts[i]),[bx,bz]=unit(pts[i],pts[i+1]);if(ax*bz-az*bx>1e-3||ax*bx+az*bz<.999)line.push(pts[i]);}line.push(pts.at(-1));
      const rec={line,length:line.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-line[i][0],p[1]-line[i][1]),0),pieces:[]};closures[key].push(rec);
      for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.05)continue;const [ux,uz]=unit(a,b),nx=-uz,nz=ux;
        const n=Math.max(1,Math.ceil(L/CLOSURE.piece));
        for(let k=0;k<n;k++){const p=lerp2(a,b,k/n),q=lerp2(a,b,(k+1)/n),m=lerp2(p,q,.5),off=(r,o)=>[r[0]-nx*o,r[1]-nz*o];
          const kind=nearPath(m)?'gate':'wall';
          // Inset: the first whose footprint the wall-foot strips leave whole (a strip in front of a face that stands inside
          // the line, or of a run end, would cut a slot); fallback: the inset keeping the most area.
          let best=null;
          for(const inset of CLOSURE.insets){const sq=[off(p,inset),off(q,inset),off(q,inset+CLOSURE.thick),off(p,inset+CLOSURE.thick)],cl=clear(sq);
            const area=cl.reduce((t,r)=>t+Math.abs(signedArea(r)),0),whole=cl.length===1&&Math.abs(area-Math.abs(signedArea(sq)))<1e-6;
            if(!best||area>best.area+1e-6)best={inset,cl,whole,area,sq};if(whole)break;}
          const foot=best.sq,bottom=Math.min(...foot.map(r=>height(...r)),height(...m))-CLOSURE.below;
          const top=approachTop([...foot,m],[nx,nz])+(kind==='gate'?CLOSURE.gate:CLOSURE.rise);
          const piece={kind,a:p,b:q,n:[nx,nz],inset:best.inset,P:off(p,best.inset+CLOSURE.thick/2),Q:off(q,best.inset+CLOSURE.thick/2),whole:best.whole,bottom,top,blocks:[]};
          for(const r of best.cl){const bl=block(r,bottom,top,kind,key,'piece');if(bl)piece.blocks.push(bl);}
          rec.pieces.push(piece);}}
      // Bridges between consecutive pieces at different insets (or across a corner): a block from one end to the next.
      for(let i=1;i<rec.pieces.length;i++){const A=rec.pieces[i-1],B=rec.pieces[i];
        const d=Math.hypot(B.P[0]-A.Q[0],B.P[1]-A.Q[1]);if(d<1e-3)continue;const [ux,uz]=unit(A.Q,B.P),h=CLOSURE.thick/2-JOIN.inset,e=h;
        const r0=[[A.Q[0]-uz*h-ux*e,A.Q[1]+ux*h-uz*e],[B.P[0]-uz*h+ux*e,B.P[1]+ux*h+uz*e],[B.P[0]+uz*h+ux*e,B.P[1]-ux*h+uz*e],[A.Q[0]+uz*h-ux*e,A.Q[1]-ux*h-uz*e]];
        const kind=A.kind==='gate'&&B.kind==='gate'?'gate':'wall';
        for(const r of clear(r0))block(r,Math.min(A.bottom,B.bottom),Math.max(A.top,B.top)+JOIN.proud,kind,key,'bridge');}
      // Connectors: where wall-foot strips in front of a run end clipped the end pieces, a block runs from the last whole
      // piece into the masonry behind the strip (a visible return).
      for(const fromEnd of [false,true]){const list=fromEnd?[...rec.pieces].reverse():rec.pieces;const k=list.findIndex(q=>q.whole);if(k<=0)continue;
        const start=fromEnd?list[k].Q:list[k].P;
        let best=null;for(const t of faceTops){const d=Math.hypot(t.p[0]-start[0],t.p[1]-start[1]);if(d<9&&(!best||d<best.d))best={t,d};}
        if(!best)continue;const c=best.t.p,[ux,uz]=unit(start,c),h=CLOSURE.thick/2-JOIN.inset,e=.3;
        const r0=[[start[0]-uz*h-ux*e,start[1]+ux*h-uz*e],[c[0]-uz*h+ux*e,c[1]+ux*h+uz*e],[c[0]+uz*h+ux*e,c[1]-ux*h+uz*e],[start[0]+uz*h-ux*e,start[1]-ux*h-uz*e]];
        const tops=list.slice(0,k+1).map(q=>q.top),bottoms=list.slice(0,k+1).map(q=>q.bottom);
        // Only an unclipped connector: a clipped one can still reach a wall-foot strip the zones underestimate.
        const cl=clear(r0);if(cl.length!==1||Math.abs(Math.abs(signedArea(cl[0]))-Math.abs(signedArea(r0)))>1e-6)continue;
        if(block(r0,Math.min(...bottoms,height(...c)-CLOSURE.below),Math.max(...tops)+JOIN.proud,'wall',key,'connector'))stats.connectors=(stats.connectors??0)+1;}
      // Corner joints: an octagonal pier at every interior vertex, as tall as its taller neighbour.
      for(let i=1;i<line.length-1;i++){const v=line[i],near_=rec.pieces.filter(q=>Math.hypot(q.a[0]-v[0],q.a[1]-v[1])<1e-6||Math.hypot(q.b[0]-v[0],q.b[1]-v[1])<1e-6);if(!near_.length)continue;
        const [ax,az]=unit(line[i-1],v),[bx,bz]=unit(v,line[i+1]),mx=-(az+bz),mz=ax+bx,ml=Math.hypot(mx,mz)||1,inset=Math.max(...near_.map(q=>q.inset));
        const c=[v[0]-mx/ml*(inset+CLOSURE.thick/2),v[1]-mz/ml*(inset+CLOSURE.thick/2)];
        for(const r of clear(circle(...c,CLOSURE.thick/2+.06,8)))block(r,Math.min(...near_.map(q=>q.bottom)),Math.max(...near_.map(q=>q.top))+JOIN.proud,near_.every(q=>q.kind==='gate')?'gate':'wall',key,'joint');}
    }
  }
  // Hand-fitted return (sweep): at El Morro's v23 the north front's return is buried under the 22 m Santa Barbara platform
  // (riders cross its top), so the v23 closure turns into the north face's solid body, clear of its wall-foot strip.
  for(const [key,line] of MANUAL_RETURNS){if(key==='morro'&&!fort||key==='cristobal'&&!cristobal)continue;
    for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],[ux,uz]=unit(a,b),h=CLOSURE.thick/2,e=.15;
      const r0=[[a[0]-uz*h-ux*e,a[1]+ux*h-uz*e],[b[0]-uz*h+ux*e,b[1]+ux*h+uz*e],[b[0]+uz*h+ux*e,b[1]-ux*h+uz*e],[a[0]+uz*h-ux*e,a[1]-ux*h-uz*e]];
      // Not clipped: hand-checked against sj-wall-foot.js (its v23 return intervals are 'bank' skips, no strips).
      block(r0,Math.min(height(...a),height(...b))-CLOSURE.below,approachTop([a,b],[uz,-ux])+CLOSURE.rise,'wall',key,'manual');}}

  T_.push(['water',performance.now()]);
  // ---- Water battery (Wikimedia Commons curid=148962402, curid=148962401, HABS PR-48 sheet 14): a distinct low paved tier at the NW tip between its
  // low curved parapet (the closure on the mapped line v24→v34) and the Santa Barbara tip face, level at WATER.y, the DEM
  // under it cut. Chains are resampled by arclength and ruled into quads; the face reaches below the apron. ----
  if(fort){const rec=closures.morro.find(r=>r.line.some(p=>Math.hypot(p[0]+866,p[1]+672)<12));
    const sb=fronts.find(f=>f.name==='santa-barbara');
    if(rec&&sb){const A=rec.pieces.filter(q=>q.a[0]<WATER.xMax).map(q=>[q.P[0]-q.n[0]*(CLOSURE.thick/2),q.P[1]-q.n[1]*(CLOSURE.thick/2)]);
      const last=rec.pieces.filter(q=>q.a[0]<WATER.xMax).at(-1);if(last)A.push([last.Q[0]-last.n[0]*(CLOSURE.thick/2),last.Q[1]-last.n[1]*(CLOSURE.thick/2)]);
      const st=sb.walls.flatMap(x=>[x.a,x.b]).filter(s=>s.T[0]<WATER.xMax&&s.T[1]<WATER.zMax&&s.T[1]>WATER.zMin);
      // Order the face stations along the tip in the same sense as the parapet (nearest-neighbour chain from A's start).
      const B=[];{const left=[...new Set(st)];let cur=left.reduce((m,s)=>Math.hypot(s.T[0]-A[0][0],s.T[1]-A[0][1])<Math.hypot(m.T[0]-A[0][0],m.T[1]-A[0][1])?s:m);
        while(cur){B.push(cur);left.splice(left.indexOf(cur),1);if(!left.length)break;const nx_=left.reduce((m,s)=>Math.hypot(s.T[0]-cur.T[0],s.T[1]-cur.T[1])<Math.hypot(m.T[0]-cur.T[0],m.T[1]-cur.T[1])?s:m);
          if(Math.hypot(nx_.T[0]-cur.T[0],nx_.T[1]-cur.T[1])>6)break;cur=nx_;}}
      const resample=(pts,n)=>{const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
        return Array.from({length:n+1},(_,k)=>{const d=L.at(-1)*k/n;let i=1;while(i<L.length-1&&L[i]<d)i++;const t=(d-L[i-1])/((L[i]-L[i-1])||1);return lerp2(pts[i-1],pts[i],t);});};
      if(A.length>2&&B.length>2){const n=Math.ceil(Math.max(...[A,B.map(s=>s.T)].map(c=>c.slice(1).reduce((t,p,i)=>t+Math.hypot(p[0]-c[i][0],p[1]-c[i][1]),0)))/DECK_ROW);
        const tipBlocks=rec.pieces.filter(q=>q.a[0]<WATER.xMax),y=Math.min(WATER.y,...tipBlocks.map(q=>q.top-1.1));
        const ra=resample(A,n),rb=resample(B.map(s=>s.T),n),tris=[],cutsW=[];
        // where the two chains cross, ruled triangles fold over their neighbours (coplanar
        // overlaps on the deck); triangles against the deck's dominant winding are the folds and are dropped.
        const cand=[];for(let i=0;i<n;i++){const q=[ra[i],ra[i+1],rb[i+1],rb[i]];
          for(const t of [[q[0],q[1],q[2]],[q[0],q[2],q[3]]])if(Math.abs(signedArea(t))>=1e-4)cand.push(t);}
        const dom=Math.sign(cand.reduce((a_,t)=>a_+signedArea(t),0));
        for(const t of cand){if(Math.sign(signedArea(t))!==dom)continue;tris.push(t.map(p=>[p[0],y,p[1]]));cutsW.push(convexCut(t));}
        // every tip station in the box, not only the chain (the chain broke at a
        // duplicated vertex station and left the segment-5 face bottom 0.9 m above the deck, open to the sea).
        for(const s of st){s.bottom=Math.min(s.bottom,y-.4);s.noPlinth=true;}
        for(const b of tipBlocks.flatMap(q=>q.blocks)){b.bottom=Math.min(b.bottom,y-.4);b.collider.minY=b.bottom;}
        cuts.push(...cutsW);decks.push({fort:'morro',name:'water-battery',y,colour:'#cbc3b0',tris,skirts:[{prof:terrainProfile(ra[0],rb[0]),r:{W:ra[0],M:ra[0],E:rb[0],yW:y,y}},{prof:terrainProfile(ra[n],rb[n]),r:{W:ra[n],M:ra[n],E:rb[n],yW:y,y}}],rows:[{},{}]});}}}

  // ---- Water-battery parapet (Wikimedia Commons curid=148962402, curid=148962401: the low tip parapet runs as one coped line with embrasures,
  // not 2 m steps). Along the tip closure the drawn coping is continuous: each joint takes the higher of its two pieces'
  // required tops (|step| ≤ 1.6 m; larger steps are abutments and stay vertical), each piece slopes between its joints.
  // Its collider top is the lower joint, never under the piece's own required top (CLOSURE.rise over its approach): the
  // drawn wall is everywhere at least as tall as its collider. Merlons (embrasures between them) are drawn above it. ----
  if(fort){const rec=closures.morro.find(r=>r.line.some(p=>Math.hypot(p[0]+866,p[1]+672)<12));
    if(rec){const P=rec.pieces,J=[P[0].top];for(let k=1;k<P.length;k++)J.push(Math.abs(P[k].top-P[k-1].top)<=WB_STEP?Math.max(P[k].top,P[k-1].top):null);J.push(P.at(-1).top);
      let s0=0;for(const [k,q] of P.entries()){const ya=J[k]??q.top,yb=J[k+1]??q.top,L=Math.hypot(q.b[0]-q.a[0],q.b[1]-q.a[1]);
        for(const bl of q.blocks){bl.slope={a:q.a,b:q.b,ya,yb,s0,L,merlons:Math.abs(yb-ya)/(L||1)<.12};bl.top=Math.min(ya,yb);bl.collider.maxY=bl.top;}
        q.slope={ya,yb};s0+=L;}
      // Joints and bridges keep flat tops at their joint (the max of their neighbours, which equals J there).
      stats.parapet={pieces:P.length,steps:J.filter(j=>j===null).length};}}

  T_.push(['private',performance.now()]);
  // ---- Private interiors (checked placement / recovery / arrivals): inside each enclosure ring, outside the fitted
  // masonry, the ground in front of each face, and the public decks. ----
  const keep=[];
  for(const [,area] of forts)for(const {a,b} of area.walls){const r=[a.B,b.B,b.W,a.W];keep.push({r,bb:bbox(r)});
    const o=s=>[s.B[0]+s.nx*4.5,s.B[1]+s.nz*4.5],lb=s=>s.LB??s.B,r2=[lb(a),lb(b),o(b),o(a)];keep.push({r:r2,bb:bbox(r2)});}
  // …and the same for this area's solid fronts (Santa Barbara, bay face, hornwork, Trinidad), and the 1 m in front of every
  // closure block: a rider standing at a face foot or against a closure is outside it.
  for(const f of fronts.filter(f=>f.solid))for(const {a,b} of f.walls){const r=[a.B,b.B,b.W,a.W];keep.push({r,bb:bbox(r)});
    const o=s=>[s.B[0]+s.nx*3.2,s.B[1]+s.nz*3.2],lb=s=>s.LB??s.B,r2=[lb(a),lb(b),o(b),o(a)];keep.push({r:r2,bb:bbox(r2)});}
  for(const bl of blocks){const xs=bl.ring.map(p=>p[0]),zs=bl.ring.map(p=>p[1]);keep.push({r:bl.ring,bb:[Math.min(...xs)-.7,Math.max(...xs)+.7,Math.min(...zs)-.7,Math.max(...zs)+.7],near:1});}
  if(fort?.bridge)for(const t of fort.bridge.deckTriangles){const r=t.map(p=>[p[0],p[2]]);keep.push({r,bb:bbox(r)});}
  if(cristobal?.ramp)for(const t of cristobal.ramp.deckTriangles){const r=t.map(p=>[p[0],p[2]]);keep.push({r,bb:bbox(r)});}
  // In front of a face at a salient the two neighbours' front quads splay apart: half-discs (3 m) at every face foot.
  const feet=[];for(const {a,b} of [...forts.flatMap(([,area])=>area.walls),...fronts.filter(f=>f.solid).flatMap(f=>f.walls)])for(const s of [a,b]){const f=s.LB??s.B;feet.push({x:f[0],z:f[1],nx:s.nx,nz:s.nz,bb:[f[0],f[0],f[1],f[1]]});}
  const kIdx=gridIndex(keep),ftIdx=gridIndex(feet);
  const kept=(x,z)=>kIdx([x-1,x+1,z-1,z+1]).some(({r,bb,near})=>x>=bb[0]-.3&&x<=bb[1]+.3&&z>=bb[2]-.3&&z<=bb[3]+.3&&distToRing(x,z,r)<(near??.3))
    ||ftIdx([x-3,x+3,z-3,z+3]).some(f=>Math.hypot(x-f.x,z-f.z)<3&&(x-f.x)*f.nx+(z-f.z)*f.nz>-.2);
  // A rider pressed against the closure on the ring itself is outside: 0.6 m tolerance band (closures stand up to 3.8 m in).
  const deep=(x,z,r)=>{for(let i=0;i<r.length;i++)if(segmentDistance(x,z,r[i],r[(i+1)%r.length])<.6)return false;return true;};
  const ringBox=Object.fromEntries(Object.entries(RINGS).map(([k,r])=>[k,bbox(r)]));
  const inside=(k,x,z)=>{const r=RINGS[k],b=ringBox[k];return r&&x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3]&&inRing(x,z,r)&&deep(x,z,r);};
  const offLimitsPoint=(x,z)=>(inside('morro',x,z)||inside('cristobal',x,z))&&!kept(x,z);
  // `privateRings` (streets contract, 2026-11-18 evening): the same private ground as polygons, so streets paves exactly to
  // it. Each enclosure ring (convex pieces) minus the 0.6 m band along its line and minus every kept shape grown by its
  // tolerance (0.3 m; 1 m round closure blocks; half-discs at face feet), all convex. `offLimitsAt` is then the point test
  // over exactly these rings, so the two agree by construction (agreement with the previous point test is in the doc).
  const grow=(r,d)=>{const s=Math.sign(signedArea(r))||1,n=r.length,L=r.map((p,i)=>{const q=r[(i+1)%n],ex=q[0]-p[0],ez=q[1]-p[1],l=Math.hypot(ex,ez)||1,nx=s*ez/l,nz=-s*ex/l;return {p:[p[0]+nx*d,p[1]+nz*d],e:[ex/l,ez/l],n:[nx,nz]};});
    return L.map((A,i)=>{const B=L[(i+n-1)%n],cr=B.e[0]*A.e[1]-B.e[1]*A.e[0];const v=r[i];
      if(Math.abs(cr)<1e-6)return [v[0]+A.n[0]*d,v[1]+A.n[1]*d];
      const mx=A.n[0]+B.n[0],mz=A.n[1]+B.n[1],ml=Math.hypot(mx,mz)||1,k=Math.min(3,d/Math.max(.34,(mx*A.n[0]+mz*A.n[1])/ml));return [v[0]+mx/ml*k,v[1]+mz/ml*k];});};
  const isConvex=r=>{const sg=Math.sign(signedArea(r));return sg!==0&&r.every((p0,k)=>{const p1=r[(k+1)%r.length],p2=r[(k+2)%r.length];return sg*((p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]))>-1e-9;});};
  const cut=[];const addCut=(r,d)=>{if(!r||r.length<3||Math.abs(signedArea(r))<1e-4)return;for(const c of isConvex(r)?[r]:convexPieces(r))if(c.length>=3&&Math.abs(signedArea(c))>1e-4)cut.push(grow(c,d));};
  for(const k of keep)addCut(k.r,k.near??.3);
  for(const f of feet){const tx=-f.nz,tz=f.nx,pts=[[f.x-f.nx*.2-tx*2.99,f.z-f.nz*.2-tz*2.99]];
    for(let i=0;i<=12;i++){const t=-Math.PI/2+Math.PI*i/12,c=Math.cos(t),sn=Math.sin(t);pts.push([f.x+(f.nx*c+tx*sn)*3,f.z+(f.nz*c+tz*sn)*3]);}
    pts.push([f.x-f.nx*.2+tx*2.99,f.z-f.nz*.2+tz*2.99]);if(Math.abs(signedArea(pts))>1e-3)cut.push(pts);}
  const privateRings=[];
  for(const [k,R] of Object.entries(RINGS)){if(!R)continue;
    for(let i=0;i<R.length;i++){const a=R[i],b=R[(i+1)%R.length],[ux,uz]=unit(a,b),w=.6;cut.push([[a[0]-uz*w-ux*w,a[1]+ux*w-uz*w],[b[0]-uz*w+ux*w,b[1]+ux*w+uz*w],[b[0]+uz*w+ux*w,b[1]-ux*w+uz*w],[a[0]+uz*w-ux*w,a[1]-ux*w-uz*w]]);}
    // Perf: each convex piece clipped to 16 m tiles; each tile subtracts only the cuts touching it.
    const cIdx=gridIndex(cut.map(r=>({r,bb:bbox(r)})),8);
    const clip=(poly,ax,ay,bx,by)=>{let out=poly;for(const [nx,nz,c] of [[1,0,-ax],[-1,0,bx],[0,1,-ay],[0,-1,by]]){const inp=out;out=[];
        for(let i=0;i<inp.length;i++){const P=inp[i],Q=inp[(i+1)%inp.length],dp=nx*P[0]+nz*P[1]+c,dq=nx*Q[0]+nz*Q[1]+c;if(dp>=0)out.push(P);
          if(dp*dq<0){const t=dp/(dp-dq);out.push([P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t]);}}if(out.length<3)return [];}return out;};
    for(const P of convexPieces(R)){const [x0,x1,z0,z1]=bbox(P),T=16;
      for(let tx=Math.floor(x0/T)*T;tx<x1;tx+=T)for(let tz=Math.floor(z0/T)*T;tz<z1;tz+=T){const q=clip(P,tx,tz,tx+T,tz+T);if(q.length<3||Math.abs(signedArea(q))<1e-4)continue;
        privateRings.push(...minus([q],cIdx([tx,tx+T,tz,tz+T]).map(o=>o.r)));}}}
  const prItems=privateRings.map(r=>({r,bb:bbox(r)})),prIdx=gridIndex(prItems);
  const offLimitsAt=indexedRingsAt(prIdx); // sj-private.js: keeps only the private-piece index alive, not this layout's scope

  T_.push(['outworks',performance.now()]);
  // ---- San Cristóbal outworks (sj-forttops-outworks.js): toe revetments on the DEM scarps of the covered
  // way, San Carlos's counterscarp, El Abanico and Santa Teresa, and the Garita del Diablo. Public ground: every piece is
  // solid where drawn, its coping/ledge a replacement top, and it stays off every earlier owner, roads/paths (+1 m) and water. ----
  let outworks=null;
  // Perf: only owners inside the outworks' bounds enter the index (the city-wide one cost ~30 ms).
  {const others=[],OB=[620,1010,-350,-90];const ring=(r)=>{if(!r||r.length<3)return;const b=bbox(r);if(overlapB(b,OB))others.push({r,bb:b});};
    for(const a of [gate,fort,...Object.values(areas??{})].filter(Boolean)){for(const t of a.tops??[])ring(t.poly.map(p=>[p.x,p.z]));
      for(const c of a.cuts??[])ring(c.ring??[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]]);for(const x of a.surfaces??[])ring(x.ring);
      for(const x of a.brick??[])ring(x.ring);for(const f of a.floorTriangles??[])ring(f.map(p=>[p[0],p[2]]));for(const f of a.groundTriangles??[])ring(f.map(p=>[p[0],p[2]]));
      for(const c of a.colliders??[])if(c.outer)ring(c.outer.map(p=>[p.x,p.z]));}
    for(const b of blocks)ring(b.ring);for(const c of cuts)ring(c.ring);for(const c of colliders)if(c.outer)ring(c.outer.map(p=>[p.x,p.z]));
    const oIdx=gridIndex(others);
    const rds=city.roads.flatMap(r=>r.points.slice(1).map((q,i)=>({a:r.points[i],b:q,h:r.width/2+1,bb:bbox([r.points[i],q])}))),rIdx=gridIndex(rds,16);
    const blocked=q=>{const bb=bbox(q);if(oIdx(bb).some(o=>overlapB(o.bb,bb)&&ringsOverlap(q,o.r)))return true;
      const [x0,x1,z0,z1]=bb;if(rIdx([x0-6,x1+6,z0-6,z1+6]).some(r=>q.some(p=>segmentDistance(p[0],p[1],r.a,r.b)<r.h)||segmentDistance((x0+x1)/2,(z0+z1)/2,r.a,r.b)<r.h))return true;
      for(const p of q)if(!isDry(p[0],p[1]))return true;return false;};
    const n0=colliders.length;
    outworks=buildOutworks({height,isDry,blocked,prism,terrainProfile,convexCut});
    const n1=colliders.length;outworks.diablo=buildDiablo({height,isDry,prism,circle,blocked});
    outworks.colliders=colliders.length-n0;outworks.colliderRange=[n0,n1,colliders.length];
    tops.push(...outworks.tops);cuts.push(...outworks.cuts);}

  T_.push(['foot',performance.now()]);
  // ---- Foot strips ( grass rising in huge teeth up the Santa Barbara bay face). On a steep bank the
  // 2 m DEM crosses a battered face in a meeting line that wobbles by metres. Beside every interval of this area's fronts a
  // strip (2 m, else 1.2 m) is cut and replaced — drawn (`groundTriangles`, terrain colours) and physical (replacement
  // tops) — by a ruled surface from a smooth foot line on the face (upper envelope of the meeting line within ±2 m, +5 cm)
  // down to the exact kept terrain at the strip's outer edge and ends: the ground follows the grade, the face shows no teeth.
  // Intervals whose strip would touch another owner (any area's tops/cuts/surfaces/floors/colliders, these closures, decks,
  // water, roads) are skipped. ----
  const groundTriangles=[],footCuts=[],footStats={},footings=[],toeSkirts=[];
  {const others=[];const ring=(r,what)=>{if(r&&r.length>=3)others.push({r,bb:bbox(r),what});};
    for(const a of [gate,fort,...Object.values(areas??{})].filter(Boolean)){for(const t of a.tops??[])ring(t.poly.map(p=>[p.x,p.z]),'top');
      for(const c of a.cuts??[])ring(c.ring??[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]],'cut');for(const x of a.surfaces??[])ring(x.ring,'surface');
      for(const x of a.brick??[])ring(x.ring,'brick');for(const f of a.floorTriangles??[])ring(f.map(p=>[p[0],p[2]]),'floor');for(const f of a.groundTriangles??[])ring(f.map(p=>[p[0],p[2]]),'ground');
      for(const c of a.colliders??[])if(c.outer)ring(c.outer.map(p=>[p.x,p.z]),'collider');}
    for(const b of blocks)ring(b.ring,'block');for(const c of cuts)ring(c.ring,'deck');
    const oIdx=gridIndex(others);
    const roads=city.roads.filter(r=>r.kind!=='steps').flatMap(r=>r.points.slice(1).map((q,i)=>({a:r.points[i],b:q,h:r.width/2+.6,bb:bbox([r.points[i],q])}))),rIdx=gridIndex(roads,16);
    const blocked=q=>{const bb=bbox(q);if(oIdx(bb).some(o=>overlapB(o.bb,bb)&&ringsOverlap(q,o.r)))return true;
      for(let u=0;u<=1;u+=.25)for(let v=0;v<=1;v+=.5){const p=lerp2(lerp2(q[0],q[1],u),lerp2(q[3],q[2],u),v);if(!isDry(p[0],p[1]))return true;
        if(rIdx([p[0],p[0],p[1],p[1]]).some(r=>segmentDistance(p[0],p[1],r.a,r.b)<r.h))return true;}return false;};
    const faceAt=(s,y)=>{const k=Math.max(0,Math.min(1,(y-s.bottom)/((s.crest-s.bottom)||1)));return [s.B[0]+(s.T[0]-s.B[0])*k,s.B[1]+(s.T[1]-s.B[1])*k];};
    const meet=s=>{let lo=s.bottom,hi=s.crest;const g=y=>height(...faceAt(s,y))-y;if(g(lo)<=0)return lo;if(g(hi)>=0)return hi;for(let i=0;i<32;i++){const m=(lo+hi)/2;if(g(m)>0)lo=m;else hi=m;}return (lo+hi)/2;};
    const convex=r=>{const sg=Math.sign(signedArea(r));if(!sg)return false;return r.every((p0,k)=>{const p1=r[(k+1)%r.length],p2=r[(k+2)%r.length];return sg*((p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]))>1e-9;});};
    const up=tri=>{const [p,q,r]=tri,ny=(q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]);return ny<0?[p,r,q]:tri;};
    for(const f of fronts){const W_=f.walls;if(!W_.length)continue;
      const st=[...new Set(W_.flatMap(x=>[x.a,x.b]))];const y0=new Map(st.map(s=>[s,meet(s)]));
      // the upper envelope of the bank contact within ±6 m, and its local wobble.
      const env6=s=>Math.min(s.crest-2,Math.max(...st.filter(o=>Math.abs(o.s-s.s)<=6||o===s).map(o=>y0.get(o)))+.15);
      const e6=new Map(st.map(s=>[s,env6(s)])),wob=s=>Math.max(...st.filter(o=>Math.abs(o.s-s.s)<=6||o===s).map(o=>e6.get(o)-y0.get(o)));
      // On El Morro's public-facing fronts the strip's top line is that ±6 m envelope and the strip may reach 3 m: the
      // gullies between the DEM spurs fill to one clean contact line on the face as a steep rock toe (terrain-coloured,
      // replacement ground), instead of masonry ending in pointed plates (a battered stone plinth was tried: the 45° spurs
      // poke through any steep plinth front).
      const toe=SKIRT_FRONTS.includes(f.name)&&f.fort==='morro';
      // ---- Footing course + level toe (#7 (−854,−559): pointed masonry plates where the
      // 2 m DEM spurs meet the battered face). On El Morro's public bay-side fronts the contact is designed instead of left
      // to the DEM: per ~1.2 m run a level contact line = highest DEM within 1 m of the face, rounded up to 0.25 m courses
      // (short ramps join neighbouring runs, so the line is continuous); replacement ground (the rock toe, drawn = physical)
      // is graded from that line to the kept terrain up to 3 m out; on the line a masonry footing course 0.35 m tall, 0.3 m
      // proud, battered like the face. The footing top is a constant height above the drawn grade and never ends in a point.
      const handled=new Set();
      if(FOOTING_FRONTS.includes(f.name)&&f.fort==='morro'){const runs=[];
        for(const {a,b} of W_){const L=Math.hypot(b.B[0]-a.B[0],b.B[1]-a.B[1]);if(L<.05)continue;const k=Math.max(1,Math.round(L/1.2));
          const fa=faceAt(a,y0.get(a)),fb=faceAt(b,y0.get(b)),n=[(a.nx+b.nx)/2,(a.nz+b.nz)/2],nl=Math.hypot(...n)||1;n[0]/=nl;n[1]/=nl;
          for(let j=0;j<k;j++){const t0=j/k,t1=(j+1)/k;let hi=-Infinity;
            for(let q=0;q<=4;q++)for(const d of [.1,.35,.65,1]){const t=t0+(t1-t0)*q/4;hi=Math.max(hi,height(fa[0]+(fb[0]-fa[0])*t+n[0]*d,fa[1]+(fb[1]-fa[1])*t+n[1]*d));}
            const lev=Math.ceil((hi+.05)/FOOTING.course)*FOOTING.course,cap=Math.min(a.crest+(b.crest-a.crest)*t0,a.crest+(b.crest-a.crest)*t1)-1.5;
            runs.push({a,b,t0,t1,n,lev,ok:lev<=cap});}}
        const at=(r,t,h,d=0)=>{const A=faceAt(r.a,h),B_=faceAt(r.b,h);return [A[0]+(B_[0]-A[0])*t+r.n[0]*d,A[1]+(B_[1]-A[1])*t+r.n[1]*d];};
        runs.forEach((r,i)=>{if(!r.ok)return;const nx=runs[i+1],pv=runs[i-1];
          const prevOk=pv&&pv.ok&&(pv.a===r.a&&Math.abs(pv.t1-r.t0)<1e-9||pv.b===r.a&&pv.t1===1&&r.t0===0),hb0=prevOk?(pv.lev+r.lev)/2:r.lev;
          const hb1=nx&&nx.ok&&(nx.a===r.a&&Math.abs(nx.t0-r.t1)<1e-9||nx.a===r.b&&r.t1===1&&nx.t0===0)?(nx.lev+r.lev)/2:r.lev;
          const span=r.t1-r.t0,ts=[r.t0,r.t0+span*.12,r.t1-span*.12,r.t1],hs=[hb0,r.lev,r.lev,hb1];
          const inner=ts.map((t,k)=>at(r,t,hs[k]));
          // The fill never lowers the real grade: along every cross-line it stays ≥ DEM − 5 cm (else a narrower strip, else
          // no run; a convex bank once dipped 1.8 m and opened a slit at the run's side).
          const under=w_=>{for(let k=0;k<4;k++){const p=inner[k],h=hs[k],q=[p[0]+r.n[0]*w_,p[1]+r.n[1]*w_],hq=height(...q);
            for(let d=.25;d<w_;d+=.25){const x=p[0]+r.n[0]*d,z=p[1]+r.n[1]*d;if(height(x,z)>h+(hq-h)*d/w_+.05)return true;}}return false;};
          let W=null;for(const w_ of [3,2,1.2,.6]){const outer=inner.map(p=>[p[0]+r.n[0]*w_,p[1]+r.n[1]*w_]);if(!under(w_)&&!blocked([...inner,...outer.reverse()])){W=w_;break;}}
          if(W===null)return;handled.add(r.a);r.built=true;r.W=W;r.inner=inner;r.hs=hs;
          const outer=inner.map(p=>[p[0]+r.n[0]*W,p[1]+r.n[1]*W]),P=(p,y)=>[p[0],y,p[1]];
          for(let k=0;k<3;k++){const pi=inner[k],pj=inner[k+1],qi=outer[k],qj=outer[k+1];if(Math.hypot(pj[0]-pi[0],pj[1]-pi[1])<.02)continue;
            const R=[P(pi,hs[k]),P(pj,hs[k+1]),...terrainProfile(qj,qi)];
            const C=[(pi[0]+pj[0]+qi[0]+qj[0])/4,(hs[k]+hs[k+1]+height(...qi)+height(...qj))/4,(pi[1]+pj[1]+qi[1]+qj[1])/4];
            for(let m=0;m<R.length;m++){let t=[C,R[m],R[(m+1)%R.length]];const ar=Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]));if(ar<1e-6)continue;
              t=up(t);const [p0,q0,r0]=t,ux=q0[0]-p0[0],uy=q0[1]-p0[1],uz=q0[2]-p0[2],vx=r0[0]-p0[0],vy=r0[1]-p0[1],vz=r0[2]-p0[2];
              const nx_=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(Math.abs(ny)<1e-9)continue;groundTriangles.push(t);
              tops.push({poly:t.map(v=>({x:v[0],z:v[2]})),top:Math.max(p0[1],q0[1],r0[1]),plane:{x:p0[0],y:p0[1],z:p0[2],dx:-nx_/ny,dz:-nz/ny},replacesTerrain:true,
                maxReferenceY:Math.max(p0[1],q0[1],r0[1])+2.5,surface:'grass',source:'forttops:foot'});}
            const q4=[pi,pj,qj,qi];if(convex(q4))footCuts.push(convexCut(q4));else for(const t3 of [[pi,pj,qj],[pi,qj,qi]])if(Math.abs(signedArea(t3))>1e-4&&convex(t3))footCuts.push(convexCut(t3));
            const Ti=[r.a.T[0]+(r.b.T[0]-r.a.T[0])*ts[k],r.a.T[1]+(r.b.T[1]-r.a.T[1])*ts[k]],Tj=[r.a.T[0]+(r.b.T[0]-r.a.T[0])*ts[k+1],r.a.T[1]+(r.b.T[1]-r.a.T[1])*ts[k+1]],mas=[Ti,Tj,pj,pi];
            if(Math.abs(signedArea(mas))>1e-3&&convex(mas))footCuts.push(convexCut(mas));
            // Footing course on the line: front battered with the face, 0.3 m proud; foot buried 0.6 m in the toe.
            const top0=hs[k]+FOOTING.rise,top1=hs[k+1]+FOOTING.rise,b0=hs[k]-.6,b1=hs[k+1]-.6;
            const fr=(t,h)=>at(r,t,h,FOOTING.proud),wl=(t,h)=>at(r,t,h,-.05);
            footings.push({fort:f.fort,front:f.name,n:[r.n[0],0,r.n[1]],q:[P(fr(ts[k],b0),b0),P(fr(ts[k+1],b1),b1),P(fr(ts[k+1],top1),top1),P(fr(ts[k],top0),top0)],
              cap:[P(fr(ts[k],top0),top0),P(fr(ts[k+1],top1),top1),P(wl(ts[k+1],top1),top1),P(wl(ts[k],top0),top0)],
              startEnd:k===0&&hb0===r.lev&&!(pv&&pv.built),endEnd:k===2&&hb1===r.lev,tan:[at(r,ts[k+1],0)[0]-at(r,ts[k],0)[0],0,at(r,ts[k+1],0)[1]-at(r,ts[k],0)[1]],
              wq0:P(wl(ts[k],b0),b0),wq1:P(wl(ts[k+1],b1),b1)});
            const yTop=Math.min(top0,top1)-.02;prism([at(r,ts[k],yTop,-.02),at(r,ts[k+1],yTop,-.02),at(r,ts[k+1],yTop,FOOTING.proud-.02),at(r,ts[k],yTop,FOOTING.proud-.02)],Math.min(b0,b1),yTop);}});
        // Side skirts: where a built run meets an unbuilt neighbour (or a different width), the fill's side edge (straight
        // from the contact line to the terrain at the strip edge) stands over the kept terrain; a rock face closes the step.
        runs.forEach((r,i)=>{if(!r.built)return;for(const [nb,k] of [[runs[i-1],0],[runs[i+1],3]]){const joined=nb&&nb.built&&nb.W===r.W&&(k===0?nb.inner[3]:nb.inner[0])&&Math.hypot(...[0,1].map(c=>(k===0?nb.inner[3]:nb.inner[0])[c]-r.inner[k][c]))<1e-6;
          // The skirt starts just beyond the footing's front (the footing's own end riser closes the first 0.3 m; sharing
          // that plane was a coplanar pair).
          if(joined)continue;const p=r.inner[k],h=r.hs[k],q=[p[0]+r.n[0]*r.W,p[1]+r.n[1]*r.W],hq=height(...q),d0=Math.min(r.W*.5,FOOTING.proud+.03),prof=terrainProfile([p[0]+r.n[0]*d0,p[1]+r.n[1]*d0],q);
          for(let j=0;j+1<prof.length;j++){const A=prof[j],B=prof[j+1],tA=Math.hypot(A[0]-p[0],A[2]-p[1])/r.W,tB=Math.hypot(B[0]-p[0],B[2]-p[1])/r.W,yA=h+(hq-h)*tA,yB=h+(hq-h)*tB;
            if(yA-A[1]<.01&&yB-B[1]<.01)continue;toeSkirts.push({fort:f.fort,q:[[A[0],Math.min(A[1],yA),A[2]],[B[0],Math.min(B[1],yB),B[2]],[B[0],yB,B[2]],[A[0],yA,A[2]]],n:k===0?[-r.n[1]*0,0,0]:[0,0,0],t:[(k===0?-1:1)*(r.b.B[0]-r.a.B[0]),0,(k===0?-1:1)*(r.b.B[1]-r.a.B[1])]});}}});}
      const foot=s=>Math.min(s.crest-.3,Math.max(...st.filter(o=>Math.abs(o.s-s.s)<=2&&o.seg===s.seg||o===s).map(o=>y0.get(o)))+.05);
      for(const {a,b} of W_){if(Math.hypot(b.B[0]-a.B[0],b.B[1]-a.B[1])<.05||handled.has(a))continue;
        const ya=toe?e6.get(a):foot(a),yb=toe?e6.get(b):foot(b),Ia=faceAt(a,ya),Ib=faceAt(b,yb),push=(p,s,d)=>[p[0]+s.nx*d,p[1]+s.nz*d];
        const fs=footStats[f.name]??={n:0,low:0,smooth:0,blocked:0,built:0};fs.n++;
        if(ya<=a.bottom+.05||yb<=b.bottom+.05){fs.low++;continue;}
        // Perf: only where the meeting line actually wobbles (teeth ≥ 0.8 m); a smooth foot keeps the plain terrain.
        if(Math.max(ya-y0.get(a),yb-y0.get(b))<.85){fs.smooth++;continue;}
        let wd=null;for(const w_ of toe?[3,2.5,2,1.2]:[2,1.2]){const q=[push(Ia,a,.03),push(Ib,b,.03),push(Ib,b,w_),push(Ia,a,w_)];if(convex(q)&&!blocked(q)){wd=w_;break;}}
        if(wd===null){fs.blocked++;continue;}fs.built++;
        const IA=push(Ia,a,.03),IB=push(Ib,b,.03),OA=push(Ia,a,wd),OB=push(Ib,b,wd),P=(p,y)=>[p[0],y,p[1]];
        const prof=(p,q)=>terrainProfile(p,q).slice(1,-1);
        const R=[P(IA,ya),P(IB,yb),...prof(IB,OB),P(OB,height(...OB)),...prof(OB,OA),P(OA,height(...OA)),...prof(OA,IA)];
        const C=[(IA[0]+IB[0]+OA[0]+OB[0])/4,((ya+yb)/2+(height(...OA)+height(...OB))/2)/2,(IA[1]+IB[1]+OA[1]+OB[1])/4];
        for(let i=0;i<R.length;i++){let t=[C,R[i],R[(i+1)%R.length]];const ar=Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]));if(ar<1e-6)continue;
          t=up(t);const [p0,q0,r0]=t,ux=q0[0]-p0[0],uy=q0[1]-p0[1],uz=q0[2]-p0[2],vx=r0[0]-p0[0],vy=r0[1]-p0[1],vz=r0[2]-p0[2];
          const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(Math.abs(ny)<1e-9)continue;groundTriangles.push(t);
          tops.push({poly:t.map(v=>({x:v[0],z:v[2]})),top:Math.max(p0[1],q0[1],r0[1]),plane:{x:p0[0],y:p0[1],z:p0[2],dx:-nx/ny,dz:-nz/ny},replacesTerrain:true,
            maxReferenceY:Math.max(p0[1],q0[1],r0[1])+2.5,surface:'grass',source:'forttops:foot'});}
        footCuts.push(convexCut([IA,IB,OB,OA]));
        const mas=[a.T,b.T,IB,IA];if(Math.abs(signedArea(mas))>1e-3&&convex(mas)&&!oIdx(bbox(mas)).some(o=>o.what!=='collider'&&o.what!=='block'&&overlapB(o.bb,bbox(mas))&&ringsOverlap(mas,o.r)))footCuts.push(convexCut(mas));}}
    for(const c of footCuts)c.kind='forttops-foot';cuts.push(...footCuts);}
  if(outworks)groundTriangles.push(...outworks.groundTriangles);

  T_.push(['tints',performance.now()]);
  // ---- Ground tones (geometry unchanged, drawn = physical as before). ----
  // (1) The great moat round San Carlos (`cristobal-east` (748,−200): streets' service-lane shards clipped by the
  // wall-foot bands and the road surface class's blue-grey halo). The moat floor (DEM under 26.4 m inside MOAT) is claimed
  // (`ownedGround`, so streets and scatter yield) and toned 'stone': one compacted service floor between the fort's east
  // faces and the counterscarp (CLR Fig. 4.6: a paved service floor in the great moat; inferred tone).
  // (2) El Morro's bay-side face foot (−854,−559): steep DEM teeth climbing the battered face read as
  // grass "plates". Within 4.5 m in front of the face, steep vertices (slope > 0.75) take a weathered-stone tone — a
  // rock/masonry footing keyed to the face — through `tintOver` (sj-world.js additive hook: wins over the gate/fort
  // tints, which colour this bank 'lawn'). The bank keeps its real grade.
  const tint=new Map(),tintOver=new Map(),ownedGround=[];
  if(terrain?.heights){const {x0,z0,step,nx,nz,heights:Hh}=terrain,key=(i,j)=>j*nx+i;
    if(cristobal){const MOAT=[[672,-167],[700,-169.5],[720,-172],[737,-173],[746.5,-177],[748,-186],[745.5,-196],[741,-206.5],[735,-217],[729,-229],
        [724.5,-241],[722.5,-253],[712,-252],[700,-243],[707,-232],[722,-205],[728,-192],[716,-182],[690,-180],[672,-177]];
      ownedGround.push({ring:MOAT,kind:'moat'});
      const [a0,a1,b0,b1]=bbox(MOAT);
      for(let j=Math.floor((b0-z0)/step);j<=Math.ceil((b1-z0)/step);j++)for(let i=Math.floor((a0-x0)/step);i<=Math.ceil((a1-x0)/step);i++){
        if(i<0||j<0||i>=nx||j>=nz)continue;const x=x0+i*step,z=z0+j*step;if(!inRing(x,z,MOAT)||Hh[key(i,j)]>=26.4)continue;tint.set(key(i,j),'stone');}}
    for(const f of fronts.filter(f=>f.fort==='morro'&&SKIRT_FRONTS.includes(f.name)))for(const {a,b} of f.walls){
      const lb=s=>s.LB??s.B,o=s=>[lb(s)[0]+s.nx*4.5,lb(s)[1]+s.nz*4.5],r=[lb(a),lb(b),o(b),o(a)],[a0,a1,b0,b1]=bbox(r);
      for(let j=Math.floor((b0-z0)/step);j<=Math.ceil((b1-z0)/step);j++)for(let i=Math.floor((a0-x0)/step);i<=Math.ceil((a1-x0)/step);i++){
        if(i<1||j<1||i>=nx-1||j>=nz-1)continue;const x=x0+i*step,z=z0+j*step;if(!inRing(x,z,r))continue;const k=key(i,j);
        if(!isDry(x,z)||offLimitsAt(x,z))continue;const sl=Math.hypot(Hh[k+1]-Hh[k-1],Hh[k+nx]-Hh[k-nx])/(2*step);if(sl>.75)tintOver.set(k,'#8e8573');}}}

  T_.push(['flags',performance.now()]);
  // ---- Flags (NPS FAQ: Puerto Rico, United States, Cross of Burgundy at both forts; Wikimedia Commons curid=14719072, curid=124496780 order at San Cristóbal:
  // Burgundy, PR, US). Three slim poles; positions inferred (El Morro: upper terreplein by the main block's north-east
  // corner, visible over the land front; San Cristóbal: barracks roof at the gate end, Wikimedia Commons curid=124496780). Render only.
  const flags=[];
  if(fort)for(const [i,[x,z]] of FLAGS.morro.entries())flags.push({fort:'morro',x,z,y:height(x,z)-.15,pole:FLAG.pole,kind:FLAG.order[i]});
  if(barracks){const t=barracks.t0+FLAG.barracksAt,d=barracks.depth*.5;for(let i=0;i<3;i++){const [x,z]=barracks.P(t+i*FLAG.spacing,d);flags.push({fort:'cristobal',x,z,y:barracks.roof,pole:FLAG.pole,kind:FLAG.order[i]});}}

  // Integration (fabric): OSM 684010786, the one mapped building inside San Cristóbal (on the 30 m intermediate deck), is
  // owned here so the city-wide civic fallback does not dress it as a modern grey block; drawn as a plain warm masonry
  // mass in the fort's tones (form unchanged; use inferred).
  const ownedBuildings=cristobal?[684010786]:[],buildingOverrides=new Map(cristobal?[[684010786,{colour:'#c3b291',roofColour:'#b4a88f'}]]:[]);
  T_.push(['end',performance.now()]);
  const layout={outworks,footStats,footings,toeSkirts,privateRings,offLimitsPoint,timing:[...T_.slice(1).map((t,i)=>[T_[i][0],+(t[1]-T_[i][1]).toFixed(1)]),['fitRun',+(T_.fit??0).toFixed(1)],['stale',T_.stale??[]]],groundTriangles,ownedBuildings,buildingOverrides,closures,blocks,rings:RINGS,decks,barracks,plugs,fronts,flags,colliders,tops,cuts,surfaces,floorTriangles,places,offLimitsAt,tint,tintOver,ownedGround,
    constants:{CLOSURE,BOUNDARY,IRON_GATE,BARRACKS,FLAG,MERLON,PARAPET:fort?.constants?.PARAPET??{thick:.8,rise:1.0,cordon:.3},PLINTH:fort?.constants?.PLINTH??{proud:.12,rise:.5}}};
  layout.qa=()=>({blocks:stats.blocks,gates:stats.gates,connectors:stats.connectors??0,invisible:colliders.filter(c=>c.occludes===false).length,plugs:plugs.map(q=>q.fort+':'+q.run+'@'+q.a.x.toFixed(1)+','+q.a.z.toFixed(1)),stretches:Object.fromEntries(Object.entries(closures).map(([k,v])=>[k,v.map(r=>({from:r.line[0].map(n=>+n.toFixed(2)),to:r.line.at(-1).map(n=>+n.toFixed(2)),length:+r.length.toFixed(1),pieces:r.pieces.length,gatePieces:r.pieces.filter(p=>p.kind==='gate').length}))])),
    colliders:colliders.length});
  void circle;void fitRun;void terrain;
  return layout;
}
