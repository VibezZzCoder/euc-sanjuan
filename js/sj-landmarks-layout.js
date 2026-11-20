/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Landmarks of the centre / south-west / south of the old grid — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// Area module (contract: header of sj-princesa-layout.js), registered after puntilla, before wallFoot.
// Mapped footprints and authored architectural details are distinguished below.
// Mapped: La Fortaleza 3501975 (outer 260860826 / courtyard 260860827), Capilla del Santo Cristo de la Salud 268171786,
// Parque de las Palomas 196604231, Teatro Tapia 196602958, Antiguo Casino / Centro de Recepciones 256662599, Plaza de la
// Barandilla 196604233, Plaza Salvador Brau 260858525, Capilla de San Francisco 260858526, Santa Ana 252692640, Calle de la
// Fortaleza 22229776 / 247332270 (public approach), Calle del Cristo 196604230.
// Inferred (view-only references): the Fortaleza gate recess, gate and piers; every facade bay rhythm, ornament
// size and colour; the Palomas parapet line (fitted to the DEM scarp top), pigeon wall, trees, benches and lamps; the Brau
// monument position; the roof corrections below (photo-led storey counts, mansard on the Casino).
// Closed: La Fortaleza (governor's residence) is shut behind its street gate and private for placement, recovery and arrivals.
// Casa Rosa (465214645) is NOT built: its footprint is a large complex envelope that cannot be attributed.
import {circle,inRing,segmentDistance} from './sj-plaza-layout.js';
import {signedArea} from './sj-paving.js';
import {convexPieces} from './sj-gate-layout.js';
import {unit,bounds,minus,overlapB,ribbon} from './sj-city-wall.js';
import {ringAt} from './sj-private.js';

export const IDS={fortaleza:3501975,cristo:268171786,tapia:196602958,casino:256662599,sanFrancisco:260858526,santaAna:252692640};
// OSM 196604231 {"leisure":"park","name":"Parque de las Palomas"} (raw ring, not a runtime road; closing vertex dropped).
export const PALOMAS=[[-113.441,174.828],[-113.504,170.788],[-110.526,170.6],[-111.128,164.778],[-113.082,155.646],[-144.294,160.593],
  [-189.374,168.773],[-186.375,179.598]];
// OSM 196604233 {"name":"Plaza de la Barandilla","place":"square","surface":"concrete:plates"}.
export const BARANDILLA=[[255.915,-60.812],[275.022,-65.45],[276.015,-67.299],[275.856,-67.897],[264.533,-110.212],[259.283,-129.88],
  [253.242,-128.342],[254.974,-125.032],[258.449,-122.564],[255.185,-120.107],[251.256,-118.535],[246.682,-117.849],[242.225,-117.993],
  [243.788,-122.143],[243.788,-125.807],[238.518,-124.191],[255.682,-61.654]];
// OSM 260858525 {"leisure":"park","name":"Plaza Salvador Brau","surface":"asphalt"}.
export const BRAU=[[324.432,-78.877],[324.823,-76.907],[281.877,-67.111],[279.986,-68.151],[275.444,-86.857],[320.46,-97.76],[322.224,-89.37]];
// Barandilla's internal public line (footways 1339942438/39 and the 256658274 link): kept clear 1.8 m each side.
const BARANDILLA_LINE=[[266.171,-64.897],[254.309,-107.566],[251.256,-118.535],[247.686,-131.795]],BARANDILLA_SPUR=[[254.309,-107.566],[264.533,-110.212]];
// Photo-led colours: Fortaleza powder blue + white; Cristo weathered stone; Tapia yellow over an ochre
// arcade; Casino white/grey; Santa Ana pink; San Francisco yellow.
export const COLOURS={fortaleza:'#bcd2da',fortalezaRoof:'#d6d2c8',cristo:'#b9a37f',cristoRoof:'#9c8a70',tapia:'#efcd78',tapiaRoof:'#c3b79f',
  casino:'#ebe9e2',casinoRoof:'#cfccc4',santaAna:'#eab3b4',santaAnaRoof:'#c8b8a8',sanFrancisco:'#ecc965',sanFranciscoRoof:'#c9bca2'};
// Gate (inferred ~5–6 m span, 2.5–3.1 m tall): opening on the palace's east face where Calle de la Fortaleza ends.
export const GATE={z0:137.1,z1:130.9,depth:3.2,leaf:3.1,seal:6.5,pier:{w:.9,proud:.45,back:.35,h:3.6}};
export const PARAPET={thick:.55,coping:.92,rail:1.3,seal:2.6,inset:[.3,3.2],step:2};

export function hash(i,j,k=0){let h=Math.imul(i*73856093^j*19349663^k*83492791,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
const near=(pts,x,z)=>{let best={d:Infinity};for(let i=0;i+1<pts.length;i++){const d=segmentDistance(x,z,pts[i],pts[i+1]);if(d<best.d)best={d,i};}return best;};
const ccw=r=>signedArea(r)<0?[...r].reverse():r;
// Outward normal of ring edge i (the side whose test point falls outside the ring).
function outward(ring,i){const a=ring[i],b=ring[(i+1)%ring.length],[ux,uz]=unit(a,b),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  return inRing(m[0]-uz*.05,m[1]+ux*.05,ring)?[uz,-ux]:[-uz,ux];}

export function createLandmarksLayout({city,height,terrain,isDry,areas={}}) {
  const colliders=[],tops=[],cuts=[],tint=new Map(),surfaces=[],floorTriangles=[],buildingOverrides=new Map(),seals=[];
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null;
    const c={outer:ccw(outer).map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  const seal=(outer,minY,maxY)=>{const c=prism(outer,minY,maxY);if(c){c.occludes=false;seals.push(c);}return c;};
  const earlier=Object.values(areas).filter(Boolean),dry=isDry??(()=>true);
  const byId=new Map(city.buildings.map(b=>[b.id,b]));
  const lowOn=ring=>Math.min(...ring.map(p=>height(...p)));
  const highOn=ring=>Math.max(...ring.map(p=>height(...p)));

  // ---- Roof / colour corrections (photo-led storey counts; generator heights were defaults). Base and footprint stay mapped,
  // except the Fortaleza gate recess. The collider shares them (sj-world.js). ----
  const F0=byId.get(IDS.fortaleza),cristo0=byId.get(IDS.cristo);
  // Gate recess: the east face edge (−242.239,145.318)→(−248.798,126.689) is where Calle de la Fortaleza (22229776) ends.
  const fe=F0.outer.findIndex((p,i)=>Math.hypot(p[0]+242.239,p[1]-145.318)<.01&&Math.hypot(F0.outer[(i+1)%F0.outer.length][0]+248.798,F0.outer[(i+1)%F0.outer.length][1]-126.689)<.01);
  if(fe<0)throw new Error('Fortaleza gate face not found');
  const ea=F0.outer[fe],eb=F0.outer[fe+1],at=z=>{const t=(ea[1]-z)/(ea[1]-eb[1]);return [ea[0]+(eb[0]-ea[0])*t,z];};
  const gN=at(GATE.z0),gS=at(GATE.z1),gu=unit(gN,gS),gOut=outward(F0.outer,fe),gIn=[-gOut[0],-gOut[1]];
  const bN=[gN[0]+gIn[0]*GATE.depth,gN[1]+gIn[1]*GATE.depth],bS=[gS[0]+gIn[0]*GATE.depth,gS[1]+gIn[1]*GATE.depth];
  const fortOuter=[...F0.outer.slice(0,fe+1),gN,bN,bS,gS,...F0.outer.slice(fe+1)];
  const recess=ccw([gN,bN,bS,gS]);
  // Roof +2.2 m: the mapped default (two levels, 7.3 m over the gate) reads lower than the palace's two tall storeys in the
  // 2025/2012 street-axis photos.
  buildingOverrides.set(IDS.fortaleza,{outer:fortOuter,roof:F0.roof+2.2,colour:COLOURS.fortaleza,roofColour:COLOURS.fortalezaRoof});
  // Capilla del Cristo: the chapel stands on the wall terrace; its north (street) front is ~5.3 m to the cornice.
  const cristoFront=Math.max(height(-111.128,164.778),height(-105.012,164.268));
  buildingOverrides.set(IDS.cristo,{roof:cristoFront+5.3,colour:COLOURS.cristo,roofColour:COLOURS.cristoRoof});
  // Tapia: the 2011 front reads ~14.5 m to the entablature (arcade + two storeys); the pediment and the fly loft rise above.
  const tapia0=byId.get(IDS.tapia),tapiaFront=Math.max(height(484.505,-32.736),height(509.908,-32.061));
  buildingOverrides.set(IDS.tapia,{roof:tapiaFront+14.5,colour:COLOURS.tapia,roofColour:COLOURS.tapiaRoof});void tapia0;
  // Casino: mapped height 17.1 includes the mansard; the walls stop ~13.6 m above the front street, the mansard is drawn above.
  const casino0=byId.get(IDS.casino),casinoEave=Math.max(...casino0.outer.map(p=>height(...p)))+13.2;
  buildingOverrides.set(IDS.casino,{roof:casinoEave,colour:COLOURS.casino,roofColour:COLOURS.casinoRoof});
  // Santa Ana: two-tier front (~11 m) with an asymmetric belfry above; mapped height=16 is the belfry top.
  const ana0=byId.get(IDS.santaAna),anaFront=Math.max(height(119.736,125.285),height(130.182,123.005));
  buildingOverrides.set(IDS.santaAna,{roof:anaFront+11.2,colour:COLOURS.santaAna,roofColour:COLOURS.santaAnaRoof});
  // San Francisco: tall single-volume chapel (photo 2024 street flank), ~10 m above its upper street corner.
  const sf0=byId.get(IDS.sanFrancisco);
  buildingOverrides.set(IDS.sanFrancisco,{roof:Math.max(...sf0.outer.map(p=>height(...p)))+9.6,colour:COLOURS.sanFrancisco,roofColour:COLOURS.sanFranciscoRoof});
  // Casino main block (between the porch projection, the east/west wings and the north side): the mansard's footprint. Axis
  // from the mapped north edge (539.629,−89.807)→(574.97,−91.347); depth to the mapped south line (552.832,−63.021).
  const casinoRect=(()=>{const NW=[539.629,-89.807],NE=[574.97,-91.347],S=[552.832,-63.021],u=unit(NW,NE),v=[-u[1],u[0]];
    const dv=(S[0]-NW[0])*v[0]+(S[1]-NW[1])*v[1],du=Math.hypot(NE[0]-NW[0],NE[1]-NW[1]);return {o:NW,u,v:dv<0?[-v[0],-v[1]]:v,du,dv:Math.abs(dv)};})();
  const shell=id=>{const b=byId.get(id),o=buildingOverrides.get(id)??{};return {id,outer:o.outer??b.outer,holes:b.holes??[],base:o.base??b.base,roof:o.roof??b.roof};};
  const shells=Object.fromEntries(Object.entries(IDS).map(([k,id])=>[k,shell(id)]));
  // Other masses close to the owned ones: faces hidden against a neighbour get no detail.
  const others=city.buildings.filter(b=>!Object.values(IDS).includes(b.id)).map(b=>({ring:b.outer,b:bounds(b.outer)}));
  const covered=(x,z)=>others.some(o=>x>=o.b[0]-.01&&x<=o.b[1]+.01&&z>=o.b[2]-.01&&z<=o.b[3]+.01&&inRing(x,z,o.ring));
  const faces=(s,role)=>s.outer.map((a,i)=>{const b=s.outer[(i+1)%s.outer.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=outward(s.outer,i);
    return {i,a,b,length:L,n,role:role({i,a,b,L,n})};}).filter(f=>f.length>=1.2);
  const mid=f=>[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2];
  const facesOf={
    fortaleza:faces(shells.fortaleza,f=>{const m=[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2];
      return inRing(m[0]+f.n[0]*.05-gOut[0]*.1,m[1]+f.n[1]*.05-gOut[1]*.1,recess)||segmentDistance(m[0],m[1],bN,bS)<.01?'court':
        segmentDistance(m[0],m[1],ea,eb)<.01?'gate':'palace';}),
    cristo:faces(shells.cristo,f=>f.n[1]<-.9&&f.L>5?'front':'plain'),
    // Tapia: the north front on Calle de la Fortaleza / Plaza Colón; the set-back wings keep the arcade.
    tapia:faces(shells.tapia,f=>f.n[1]<-.9&&f.L>20?'front':'side'),
    // Casino: the south elevation toward Constitución (the 10.6 m projection is its centre).
    casino:faces(shells.casino,f=>f.n[1]>.9&&mid(f)[1]>-66?'front':'side'),
    santaAna:faces(shells.santaAna,f=>f.n[1]>.9&&f.L>8?'front':'side'),
    // San Francisco: the street flank is the long south face on Calle de San Francisco (60330117 runs south of it).
    sanFrancisco:faces(shells.sanFrancisco,f=>f.n[0]<-.9&&mid(f)[1]>-98&&mid(f)[1]<-89?'front':f.n[1]>.9&&f.L>20?'flank':f.n[0]>.9&&f.L>15?'east':'side')};

  // ---- La Fortaleza: closed and sealed (for closed places: drawn shut, sealed, not rideable). Iron gate between
  // two masonry piers on the face line; behind it the 3.2 m forecourt recess and the palace entrance front. ----
  const fort={gN,gS,bN,bS,u:gu,out:gOut,width:Math.hypot(gS[0]-gN[0],gS[1]-gN[1]),ground:Math.max(height(...gN),height(...gS))};
  {const P=(s,d)=>[gN[0]+gu[0]*s+gOut[0]*d,gN[1]+gu[1]*s+gOut[1]*d],W=fort.width,{w,proud,back,h}=GATE.pier;
    fort.piers=[0,W].map((s,k)=>{const s0=k?s-w*.5:s-w*.5,s1=s0+w,r=[P(s0,-back),P(s1,-back),P(s1,proud),P(s0,proud)],g=lowOn(r);
      prism(r,g-.2,highOn(r)+h);return {ring:r,s:(s0+s1)/2,g,top:highOn(r)+h};});
    const L=[P(w*.5,-.12),P(W-w*.5,-.12),P(W-w*.5,.12),P(w*.5,.12)],g=lowOn(L);fort.leaf={ring:L,g,top:highOn(L)+GATE.leaf};
    prism(L,g-.2,fort.leaf.top);seal(L,fort.leaf.top,highOn(L)+GATE.seal);
    // Pier tops are seal-capped too (a hop onto a pier could not reach the forecourt, but keep the line closed).
    for(const p of fort.piers)seal(p.ring,p.top,p.g+GATE.seal);}
  const F_RING=F0.outer,F_B=bounds(F_RING);
  const offLimitsAt=ringAt(F_RING,F_B); // sj-private.js: keeps only the ring alive, not this layout's scope
  // `privateRings` contract: the same polygon that
  // offLimitsAt tests, so `streets` paves exactly up to the palace walls and the gate line instead of blocking 2 m cells.
  const privateRings=[F_RING.map(p=>[p[0],p[1]])];

  // ---- Running/plaza surfaces: single owner after every earlier owner's surfaces, brick and floors, outside the masses. ----
  const earlierRings=[...earlier.flatMap(a=>[...(a.surfaces??[]),...(a.brick??[])].map(s=>s.ring)),
    ...earlier.flatMap(a=>(a.floorTriangles??[]).map(t=>t.map(p=>[p[0],p[2]]))).filter(r=>Math.abs(signedArea(r))>1e-4),
    ...earlier.flatMap(a=>(a.tops??[]).map(t=>t.poly.map(p=>[p.x,p.z])))];
  const massPieces=city.buildings.map(b=>({b:bounds(b.outer),ring:b.outer})),done=[];
  const brick=[];
  // Perf: earlier rings bucketed on a 32 m grid with cached bounds; building convex pieces memoized.
  const ringB=earlierRings.map(r=>({r,b:bounds(r)})),bucket=new Map(),bk=(i,j)=>i*100003+j;
  ringB.forEach((e,idx)=>{for(let i=Math.floor(e.b[0]/32);i<=Math.floor(e.b[1]/32);i++)for(let j=Math.floor(e.b[2]/32);j<=Math.floor(e.b[3]/32);j++){const k=bk(i,j);let l=bucket.get(k);if(!l)bucket.set(k,l=[]);l.push(idx);}});
  const near=bx=>{const out=new Set();for(let i=Math.floor((bx[0]-.5)/32);i<=Math.floor((bx[1]+.5)/32);i++)for(let j=Math.floor((bx[2]-.5)/32);j<=Math.floor((bx[3]+.5)/32);j++)for(const idx of bucket.get(bk(i,j))??[])out.add(idx);
    return [...out].filter(idx=>overlapB(ringB[idx].b,bx,.5)).map(idx=>ringB[idx].r);};
  const pieceMemo=new Map(),piecesOf=m=>{let p=pieceMemo.get(m);if(!p){try{p=convexPieces(ccw(m.ring));}catch{p=[];}pieceMemo.set(m,p);}return p;};
  const keep=(ring,kind,owner,into=surfaces)=>{const bx=bounds(ring);let pieces=convexPieces(ccw(ring));
    const block=[...near(bx),...massPieces.filter(m=>overlapB(m.b,bx,.5)).flatMap(piecesOf)];
    pieces=minus(pieces,[...block,...done.filter(d=>overlapB(bounds(d),bx,.5))]);
    pieces=pieces.filter(r=>r.every(p=>dry(p[0],p[1])));
    for(const r of pieces)into.push({kind,ring:r,owner:'landmarks:'+owner});done.push(...pieces);return pieces;};

  // ---- Parque de las Palomas (public, open on grade from Calle del Cristo). Panels of warm grey/rose stone (2009 paving
  // photo), a rough stone parapet with a black rail where the park meets the scarp over the Paseo de la Princesa, the pigeon
  // wall (2011 park-wall photo) in front of the north houses, shade trees, benches facing the bay, black lanterns. ----
  const parapet=[];
  {// Path: down the west edge from the house corner, then east along the south edge to the chapel's west wall.
    const A=PALOMAS[6],B=PALOMAS[7],C=PALOMAS[0],path=[[A[0]+(B[0]-A[0])*.02,A[1]+(B[1]-A[1])*.02],B,[C[0]+.35,C[1]]];
    const inward=(a,b)=>{const [ux,uz]=unit(a,b),n=[-uz,ux];const m=[(a[0]+b[0])/2+n[0]*.6,(a[1]+b[1])/2+n[1]*.6];return inRing(m[0],m[1],PALOMAS)?n:[-n[0],-n[1]];};
    const segN=path.slice(1).map((b,i)=>inward(path[i],b));
    const st=[];
    for(let i=0;i+1<path.length;i++){const a=path[i],b=path[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/PARAPET.step));
      for(let k=i?1:0;k<=n;k++){const t=k/n,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],corner=k===n&&i+2<path.length;
        let nn=segN[i];if(corner){const m=[segN[i][0]+segN[i+1][0],segN[i][1]+segN[i+1][1]],l=Math.hypot(...m);nn=[m[0]/l,m[1]/l];}
        st.push({p,n:nn,t:unit(a,b),k:corner?1/Math.max(.5,nn[0]*segN[i][0]+nn[1]*segN[i][1]):1});}}
    // Inset each station until the outer face stands on the level park (not the scarp), smoothed with a running maximum.
    for(const s of st){const ref=height(s.p[0]+s.n[0]*4,s.p[1]+s.n[1]*4);let d=PARAPET.inset[0];
      while(d<PARAPET.inset[1]&&height(s.p[0]+s.n[0]*d,s.p[1]+s.n[1]*d)<ref-.4)d+=.1;s.d0=d;}
    st.forEach((s,i)=>{s.d=Math.max(...st.slice(Math.max(0,i-1),i+2).map(q=>q.d0));});
    // Stations whose offset point would run backwards along the path (the inset jumps at the west/south corner) are dropped,
    // so the wall never folds over itself.
    for(const s of st){const O=[s.p[0]+s.n[0]*s.d*s.k,s.p[1]+s.n[1]*s.d*s.k],I=[O[0]+s.n[0]*PARAPET.thick*s.k,O[1]+s.n[1]*PARAPET.thick*s.k];
      const last=parapet.at(-1);if(last&&((O[0]-last.O[0])*s.t[0]+(O[1]-last.O[1])*s.t[1]<.6||(I[0]-last.I[0])*s.t[0]+(I[1]-last.I[1])*s.t[1]<.3))continue;
      const g=height(...I),below=Math.min(height(...O),height(O[0]-s.n[0]*.8,O[1]-s.n[1]*.8));
      parapet.push({O,I,n:s.n,g,bottom:Math.max(g-7,below-.3)});}
    for(let i=0;i+1<parapet.length;i++){const a=parapet[i],b=parapet[i+1],r=[a.O,b.O,b.I,a.I];
      const lo=Math.min(a.bottom,b.bottom),hi=Math.max(a.g,b.g);prism(r,lo,hi+PARAPET.rail);seal(r,hi+PARAPET.rail,hi+PARAPET.seal);}}
  // `coverRings` (ground contract): plan footprint of the Palomas scarp skin that sj-landmarks.js
  // draws 0.1 m over the DEM from each station's outer face down the scarp (same stop rule); natural scatter stays out of it.
  const skinDepth=s=>{let d=0;for(let e=.1;e<=16+1e-9;e+=.1){const y=height(s.O[0]-s.n[0]*e,s.O[1]-s.n[1]*e);if(y<5||y<s.g-17)break;d=e;}return d+.6;};
  const coverRings=parapet.length>1?[{ring:[...parapet.map(s=>s.O),...parapet.map(s=>{const d=skinDepth(s);return [s.O[0]-s.n[0]*d,s.O[1]-s.n[1]*d];}).reverse()],kind:'skin'}]:[];
  // Park ground: inside the parapet's inner line only (the scarp outside stays DEM with the Princesa owner's masonry tint).
  const parkInner=[...parapet.map(s=>s.I).reverse(),PALOMAS[6],PALOMAS[5],PALOMAS[4],PALOMAS[3],PALOMAS[2],PALOMAS[1]];
  // Pigeon wall: rough stone face with rows of square nesting holes, 0.06 m off the north houses' park faces (247332278, 247332286).
  const pigeon=[];
  {const edges=[[PALOMAS[4],PALOMAS[5]],[PALOMAS[5],PALOMAS[6]]];
    for(const [a0,b0] of edges){const [ux,uz]=unit(a0,b0),n0=[-uz,ux],m=[(a0[0]+b0[0])/2+n0[0]*.6,(a0[1]+b0[1])/2+n0[1]*.6],n=inRing(m[0],m[1],PALOMAS)?n0:[-n0[0],-n0[1]];
      const L=Math.hypot(b0[0]-a0[0],b0[1]-a0[1]),cut=a0===PALOMAS[4]?1.2:.4;
      const a=[a0[0]+ux*cut+n[0]*.06,a0[1]+uz*cut+n[1]*.06],b=[b0[0]-ux*.4+n[0]*.06,b0[1]-uz*.4+n[1]*.06],T=.38;
      const r=[a,b,[b[0]+n[0]*T,b[1]+n[1]*T],[a[0]+n[0]*T,a[1]+n[1]*T]],g=lowOn(r),top=highOn(r)+3.1;
      prism(r,g-.3,top);pigeon.push({a,b,n,u:[ux,uz],L:L-cut-.4,T,g,top});}}
  // both parks draw their own paving (dark red-grey stone panels / brick-red plates; no shared kind fits),
  // exported as `brick` like the Princesa owner's Raíces plaza so every later owner reads them as ownership.
  const parkPieces=keep(parkInner,'palomas-stone','palomas',brick);
  const inPark=(x,z)=>parkPieces.some(r=>inRing(x,z,r));

  // ---- Plaza de la Barandilla (brick-red concrete plates, photo 2018) and Plaza Salvador Brau (asphalt, kept DEM tone). ----
  keep(BARANDILLA,'barandilla-plates','barandilla',brick);
  const reserved=(x,z,m=1.8)=>near(BARANDILLA_LINE,x,z).d<m||near(BARANDILLA_SPUR,x,z).d<m;

  // ---- Dressing (shared street kit): shade trees, benches, black lanterns; and the Brau monument. All on public ground clear
  // of the mapped internal lines and the parks' approach throats. ----
  const lamps=[],benches=[],trees=[],planters=[];
  const blocked=(x,z,r)=>city.buildings.some(b=>{const bb=bounds(b.outer);return x>=bb[0]-r&&x<=bb[1]+r&&z>=bb[2]-r&&z<=bb[3]+r&&
    (inRing(x,z,b.outer)||b.outer.some((p,i)=>segmentDistance(x,z,p,b.outer[(i+1)%b.outer.length])<r));});
  const roadsNear=city.roads.filter(r=>r.kind!=='steps');
  const onRoad=(x,z,m)=>roadsNear.some(r=>r.points.some((a,i)=>i+1<r.points.length&&segmentDistance(x,z,a,r.points[i+1])<(r.width??4)/2+m));
  // ---- Barandilla terraces. The real plaza steps up in terraces with stone balustrades (ref L, 2011 "Escalinta
  // Calle Tanca"). The DEM here is a smooth ~8 % grade with no mapped tread levels, and the spine (footways 1339942438/39) must
  // stay an open rideable climb, so the terraces are NOT real level changes: low stone retaining edges with a balustrade stand
  // on the existing slope along contour lines (Y 16.8 / 17.6 / 18.4) in both wings, 2.6 m clear of the spine and 1.6 m short
  // of the plaza edge, so every wing bay stays open to the spine (no pocket). Side rails flank the mapped head stair 256658274.
  const terraces=[];
  {const spineAt=y=>{for(let i=0;i+1<BARANDILLA_LINE.length;i++){const a=BARANDILLA_LINE[i],b=BARANDILLA_LINE[i+1],ha=height(...a),hb=height(...b);
      if((ha-y)*(hb-y)<=0&&ha!==hb){const t=(y-ha)/(hb-ha);return {p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],u:unit(a,b)};}}return null;};
    const edgeDist=(x,z)=>Math.min(...BARANDILLA.map((a,i)=>segmentDistance(x,z,a,BARANDILLA[(i+1)%BARANDILLA.length])));
    const okAt=(x,z)=>inRing(x,z,BARANDILLA)&&edgeDist(x,z)>1.6&&!blocked(x,z,1.2)&&!onRoad(x,z,.6);
    const run=(pts,kind)=>{if(pts.length<2)return;const st=pts.map(p=>({p,g:height(...p)}));terraces.push({kind,st});
      for(let i=0;i+1<st.length;i++){const a=st[i].p,b=st[i+1].p,[ux,uz]=unit(a,b),h=.24,r=[[a[0]-uz*h,a[1]+ux*h],[b[0]-uz*h,b[1]+ux*h],[b[0]+uz*h,b[1]-ux*h],[a[0]+uz*h,a[1]-ux*h]];
        prism(r,Math.min(st[i].g,st[i+1].g)-.25,Math.max(st[i].g,st[i+1].g)+.95);}};
    for(const y of [16.8,17.6,18.4]){const s0=spineAt(y);if(!s0)continue;const perp=[-s0.u[1],s0.u[0]];
      for(const sd of [-1,1]){const pts=[];for(let d=2.6;d<40;d+=1){const x=s0.p[0]+perp[0]*sd*d,z=s0.p[1]+perp[1]*sd*d;if(!okAt(x,z))break;pts.push([x,z]);}
        if(pts.length>=3)run(pts,'terrace');}}
    // Head stair 256658274 (247.686,−131.795)→(251.256,−118.535): stone side rails at ±1.7 m where they stand on plaza ground.
    {const a=[251.256,-118.535],b=[247.686,-131.795],[ux,uz]=unit(a,b);
      for(const sd of [-1,1]){const pts=[];for(let t=.5;t<Math.hypot(b[0]-a[0],b[1]-a[1]);t+=1){const x=a[0]+ux*t-uz*sd*1.7,z=a[1]+uz*t+ux*sd*1.7;
          if(!(inRing(x,z,BARANDILLA)&&!blocked(x,z,.6)&&w0(x,z)))break;pts.push([x,z]);}
        if(pts.length>=3)run(pts,'stair');}}
    function w0(x,z){return dry(x,z);}}
  const nearTerrace=(x,z,m)=>terraces.some(t=>t.st.some((q,i)=>i+1<t.st.length&&segmentDistance(x,z,q.p,t.st[i+1].p)<m));

  const benchAt=(x,z,heading)=>{const c=Math.cos(heading),s=Math.sin(heading),legs=[-.72,.72].map(u=>({u,ground:Math.min(...[-.25,.25].map(d=>height(x+c*u+s*d,z-s*u+c*d)))}));
    const all=[-.72,.72].flatMap(u=>[-.25,.25].map(d=>height(x+c*u+s*d,z-s*u+c*d)));if(Math.max(...all)-Math.min(...all)>.24)return null;
    return {x,z,y:Math.max(...all),legs,heading,width:1.9,depth:.6,height:.95};};
  // Palomas: trees along the middle line, benches 1.5 m inside the parapet facing the bay, lamps by the pigeon wall.
  // Trees 3.3 m off the pigeon wall's park face, clear of the survey's peel-off line (−116,159.5)→(−145,168) and the throat.
  const northEdge=x=>{const [a,b]=x>PALOMAS[5][0]?[PALOMAS[4],PALOMAS[5]]:[PALOMAS[5],PALOMAS[6]];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);};
  for(const [x,s] of [[-173,1.0],[-157,.92],[-133,1.05]]){const z=northEdge(x)+3.3;trees.push({x,z,y:height(x,z),scale:s,park:'palomas'});}
  // benches stand with their backs flush to the pigeon wall (0.13 m, no lane behind), facing the bay across
  // the park. Next to the parapet they made dead lanes and left a crashed rider no clear heading to recover on.
  for(const [wi,t] of [[1,.1],[1,.4],[1,.75],[0,.35]]){const w=pigeon[wi],x=w.a[0]+w.u[0]*w.L*t+w.n[0]*(w.T+.45),z=w.a[1]+w.u[1]*w.L*t+w.n[1]*(w.T+.45);
    const b=benchAt(x,z,Math.atan2(w.n[0],w.n[1]));if(b&&inPark(x,z)&&!trees.some(q=>Math.hypot(q.x-x,q.z-z)<2.2))benches.push({...b,park:'palomas'});}
  for(const t of [.22,.58]){const w=pigeon[1],x=w.a[0]+w.u[0]*w.L*t+w.n[0]*(w.T+.8),z=w.a[1]+w.u[1]*w.L*t+w.n[1]*(w.T+.8);lamps.push({x,z,y:height(x,z),base:false,park:'palomas'});}
  {const w=pigeon[0],x=w.a[0]+w.u[0]*w.L*.55+w.n[0]*(w.T+.8),z=w.a[1]+w.u[1]*w.L*.55+w.n[1]*(w.T+.8);lamps.push({x,z,y:height(x,z),base:false,park:'palomas'});}
  // Barandilla: trees in the wings beside the climb, lamps on both sides, benches under the trees.
  for(const [x,z,s] of [[267.6,-84.8,.95],[262.8,-98.6,1.0],[252.4,-82.6,.9],[249.6,-95.8,.95]])if(!reserved(x,z,2.6)&&inRing(x,z,BARANDILLA)&&!blocked(x,z,1.6)&&!nearTerrace(x,z,2.2))
    trees.push({x,z,y:height(x,z),scale:s,park:'barandilla',cutout:true});
  for(const [x,z] of [[270.6,-70.2],[262.6,-103.8],[257.1,-72.5],[247.6,-112.8]])if(!reserved(x,z,1.2)&&inRing(x,z,BARANDILLA)&&!blocked(x,z,.8)&&!nearTerrace(x,z,1.2))lamps.push({x,z,y:height(x,z),base:false,park:'barandilla'});
  for(const [x,z,hd] of [[269.2,-85.8,-1.31],[254.2,-93.2,1.83]]){if(reserved(x,z,1.6)||!inRing(x,z,BARANDILLA)||blocked(x,z,1.2))continue;if(nearTerrace(x,z,2.0))continue;const b=benchAt(x,z,hd);if(b)benches.push({...b,park:'barandilla'});}
  // Brau: seated bronze figure on a pale plinth (2011 photo), facing Calle de San Francisco; shade trees and benches.
  const brau={x:301.5,z:-86.2,heading:.2,plinth:[1.15,1.1,1.15]};
  {const c=Math.cos(brau.heading),s=Math.sin(brau.heading);
    const q=[[-.575,-.575],[.575,-.575],[.575,.575],[-.575,.575]].map(([u,d])=>[brau.x+c*u+s*d,brau.z-s*u+c*d]);
    brau.ring=q;brau.g=lowOn(q);brau.y=highOn(q)+brau.plinth[1];prism(q,brau.g-.15,brau.y+.08);
    // Figure and rock seat: a smaller solid matching the drawn figure (the plinth-wide prism overreached the sides).
    const f=[[-.5,-.55],[.5,-.55],[.5,.72],[-.5,.72]].map(([u,d])=>[brau.x+c*u+s*d,brau.z-s*u+c*d]);brau.figure=f;prism(f,brau.y,brau.y+1.78);}
  for(const [x,z,s] of [[290.4,-80.6,1.0],[313.2,-88.2,.95],[284.6,-74.2,.9]])if(inRing(x,z,BRAU)&&!blocked(x,z,1.6))trees.push({x,z,y:height(x,z),scale:s,park:'brau'});
  for(const [x,z,hd] of [[296.2,-82.8,2.92],[307.2,-84.4,2.92]]){const b=benchAt(x,z,hd);if(b&&inRing(x,z,BRAU))benches.push({...b,park:'brau'});}
  for(const [x,z] of [[281.6,-80.4],[318.2,-93.6]])if(inRing(x,z,BRAU)&&!blocked(x,z,.8))lamps.push({x,z,y:height(x,z),base:false,park:'brau'});
  // Solids for the dressing (the Puntilla recipe: trunk/post/bench prisms).
  for(const t of trees)prism(circle(t.x,t.z,.34*t.scale,10),t.y-.1,t.y+3.5);
  for(const l of lamps)prism(circle(l.x,l.z,.22,8),l.y-.1,l.y+3.6);
  for(const b of benches){const c=Math.cos(b.heading),s=Math.sin(b.heading),r=[[-1,-.32],[1,-.32],[1,.32],[-1,.32]].map(([u,d])=>[b.x+c*u+s*d,b.z-s*u+c*d]);
    prism(r,Math.min(...b.legs.map(l=>l.ground))-.1,b.y+.95);}

  // ---- Antiguo Casino portico (ref H): a shallow porch in front of the mapped central projection — four columns
  // 2.0 m out carrying a balcony slab (overhead, 4.6 m up) with a balustrade; closed leaves stay on the building face behind.
  // Separate column solids; no slab in front at riding height.
  const portico=(()=>{const f=facesOf.casino.find(q=>q.role==='front'&&q.length<11.5&&mid(q)[1]>-58.5);if(!f)return null;
    const [ux,uz]=unit(f.a,f.b),P=(u,d)=>[f.a[0]+ux*u+f.n[0]*d,f.a[1]+uz*u+f.n[1]*d],L=f.length,D=2.0;
    const g=Math.max(...[0,L/2,L].map(u=>height(...P(u,.3)))),cols=[0,1,2,3].map(k=>{const u=.75+k*(L-1.5)/3,[x,z]=P(u,D),r=circle(x,z,.3,10);
      const lo=lowOn(r)-.1;prism(r,lo,g+4.6);return {x,z,u,lo};});
    const slab=[P(-.2,-.1),P(L+.2,-.1),P(L+.2,D+.45),P(-.2,D+.45)];prism(slab,g+4.6,g+5.25);
    return {face:f,g,top:g+4.6,cols,D,L};})();

  // ---- Frontage aprons (final audit rows 9/17/18 and the Colón triangle). The leftover ground beside these landmarks is
  // taken to the real street edges: everything not a carriageway (+ kerb + sidewalk, the streets package's own widths), lane
  // or building inside each region becomes stone apron up to the building base; at the Casino the garden and forecourt
  // become kerbed lawn beds (ref H) inside a 1.4 m stone margin; the Colón triangle a kerbed planter. Flush with the DEM
  // (drawn = physical); exported as `brick` so streets/ground (merged later) yield.
  const SIDE={primary:1.9,secondary:1.9,tertiary:1.6,primary_link:1.4,secondary_link:1.4,tertiary_link:1.4,residential:1.25,unclassified:1.25};
  const lawnRings=[];let forecourtFrame=null;
  {// Road ribbons per segment near the region only (perf: whole-road ribbons and buffered buildings cost ~0.7 s).
    const roadPieces=(bb,extra,skip)=>city.roads.flatMap(r=>{if(skip?.has(r.id))return [];const hw=(r.width??4)/2+(r.kind in SIDE?.15+SIDE[r.kind]:.05)+extra,out=[];
      for(let i=0;i+1<r.points.length;i++){const a=r.points[i],b=r.points[i+1];if(Math.hypot(b[0]-a[0],b[1]-a[1])<.05)continue;
        if(!overlapB([Math.min(a[0],b[0]),Math.max(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[1],b[1])],bb,hw+1))continue;out.push(...ribbon([a,b],-hw,hw));
        // Joint discs: per-segment ribbons leave wedge gaps on the outside of every bend (a sliver sat on footway 458601937).
        if(i>0)out.push(ccw(circle(a[0],a[1],hw,12)));}return out;});
    const region=(ring,kind,owner,beds=[],skip=null)=>{const bb=bounds(ring);
      const lawnP=minus(beds.flatMap(r=>convexPieces(ccw(r))),roadPieces(bb,1.4)).filter(r=>Math.abs(signedArea(r))>1);
      for(const r of lawnP){const kept=keep(r,'lawn',owner+'-lawn',brick);lawnRings.push(...kept);}
      for(const r of minus(convexPieces(ccw(ring)),roadPieces(bb,0,skip)))keep(r,kind,owner,brick);};
    region([[349,-84],[384,-84],[384,-130],[345,-130]],'apron-stone','sf-east');
    // Casino garden beds (ref H: lawn round the building inside a stone margin), read off the 1 m owner map: the west
    // garden with a cross path at z −64…−62.6, and the south-east forecourt bed; 1.2–1.4 m off walls, roads and walks.
    region([[516,-97],[546,-97],[546,-63],[582,-63],[582,-42],[516,-42]],'apron-stone','casino',[
      [[524,-88.4],[538.2,-88.4],[538.8,-76.6],[533.4,-76.4],[533.8,-64.0],[524,-64.0]],
      [[524,-62.6],[533.6,-62.6],[533.6,-58.0],[526.0,-53.2],[524,-53.2]],
      [[566.2,-62.3],[575.8,-62.8],[575.8,-51.2],[566.2,-50.7]]]);
    region([[510,-103.5],[515.5,-103.5],[515.5,-95.5],[510,-95.5]],'lawn','colon-planter');
    // La Fortaleza's gate forecourt — the open ground where Calle de la Fortaleza (residential 247332270,
    // 6 m) ends at (−206.6,128.2) and its service spur 22229776 / Calle Clara Lair 704106799 / footway 1339942435 run on to
    // the gate. It was nobody's paving (raw ground colour, with 2 m cell steps at the streets edge). Blue-grey setts (ref A,
    // Calle Fortaleza 2025: the street ends at the gate in adoquines) from the palace face to the residential streets'
    // sidewalks; the spurs inside it are part of the forecourt. Flush with the DEM (drawn = physical), exported as `brick`.
    // the setts continue Calle de la Fortaleza's own bond (sj-landmarks.js reads `forecourtFrame`, the street's
    // first-segment frame as sj-streets-layout.js builds it), so the forecourt runs up to the street's end line (through the
    // road's end point, across it) and takes the sidewalk tips west of it; east of the line everything stays the street's.
    {const r=city.roads.find(q=>q.id===247332270),o=r.points[0],u=unit(o,r.points[1]),nn=[-u[1],u[0]],at=z=>{const t=(z-o[1])/nn[1];return [o[0]+nn[0]*t,z];};
      forecourtFrame={o:[o[0],o[1]],u,n:nn};
      region([[-251,118],at(118),at(131.7),[-203,131.7],[-203,153.5],[-251,153.5]],'setts','fortaleza-forecourt',[],new Set([22229776,704106799,1339942435,247332270]));}
    for(const b of brick.filter(q=>q.owner==='landmarks:colon-planter'))lawnRings.push(b.ring);}
  // Kerb edges of every lawn bed: boundary edges (not shared by two pieces), drawn as a low pale stone kerb.
  // Kerbs only where lawn lies on exactly one side (internal piece edges, T-junctions included, have lawn on both).
  const kerbs=[];{const inLawn=(x,z)=>lawnRings.some(r=>inRing(x,z,r));
    for(const r of lawnRings)for(let i=0;i<r.length;i++){const A=r[i],B=r[(i+1)%r.length],L=Math.hypot(B[0]-A[0],B[1]-A[1]);if(L<.05)continue;
      const nx=-(B[1]-A[1])/L,nz=(B[0]-A[0])/L,k=Math.max(1,Math.round(L/.5));
      for(let j=0;j<k;j++){const a=[A[0]+(B[0]-A[0])*j/k,A[1]+(B[1]-A[1])*j/k],b=[A[0]+(B[0]-A[0])*(j+1)/k,A[1]+(B[1]-A[1])*(j+1)/k],m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
        if(inLawn(m[0]+nx*.15,m[1]+nz*.15)!==inLawn(m[0]-nx*.15,m[1]-nz*.15)&&!kerbs.some(q=>Math.hypot((q.a[0]+q.b[0])/2-m[0],(q.a[1]+q.b[1])/2-m[1])<.05))kerbs.push({a,b,ga:height(...a),gb:height(...b)});}}}

  // ---- Map arrivals (candidates; checked by the destination suite). ----
  const places=[{name:'La Fortaleza',x:-206.559,z:128.239,source:IDS.fortaleza},
    {name:'Capilla del Cristo',x:-111,z:147.8,source:IDS.cristo},
    {name:'Iglesia de Santa Ana',x:121,z:128,source:IDS.santaAna},
    {name:'Plaza de la Barandilla',x:273,z:-62,source:196604233},
    {name:'Teatro Tapia',x:488,z:-36.6,source:IDS.tapia}];

  const layout={colliders,tops,cuts,tint,surfaces,floorTriangles,places,buildingOverrides,offLimitsAt,privateRings,
    ownedBuildings:Object.values(IDS),brick,kerbs,forecourtFrame,grid:terrain,terraces,portico,shells,faces:facesOf,fort,parapet,pigeon,brau,lamps,benches,trees,planters,seals,covered,coverRings,
    cristoFront,casinoEave,anaFront,tapiaFront,casinoRect,constants:{GATE,PARAPET,COLOURS}};
  layout.qa=()=>({surfaces:surfaces.length,kerbs:kerbs.length,brick:Object.fromEntries(['palomas-stone','barandilla-plates','apron-stone','lawn'].map(k=>[k,brick.filter(s=>s.kind===k).length])),terraces:terraces.map(t=>t.kind+':'+t.st.length),
    colliders:colliders.length,seals:seals.length,parapet:parapet.length,lamps:lamps.length,benches:benches.length,trees:trees.length,
    faces:Object.fromEntries(Object.entries(facesOf).map(([k,fs])=>[k,fs.reduce((o,f)=>(o[f.role]=(o[f.role]??0)+1,o),{})])),
    gate:+fort.width.toFixed(2),places:places.length});
  return layout;
}
