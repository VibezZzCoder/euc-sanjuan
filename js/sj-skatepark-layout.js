/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Skatepark del Muelle — © 2026 VibezZzCoder, MIT. An authored, fictional public skatepark on the harbour-front lot by the
// Cataño ferry terminal (OSM 260859576, mapped as a private surface car park; the game invents a park there and claims no
// real facility). Poured concrete in the spirit of La Perla's hand-built bowl: broad painted colour blocks, a yellow lip.
// One tilted floor plane fitted above the lot's gentle grade (everything above grade; no street is flattened), short
// eased aprons at the two openings. Shared physical/render owner: sj-skatepark.js draws exactly these numbers.
// Area contract: colliders, tops (every drawn riding triangle, from the same Float32 vertices), cuts (render-only terrain
// cut under the park), sportsRings, palms, places (an exact on-park map arrival: `arrival` {x,z,y,headingY}), routeLines,
// and its own drawing record `skate` (vertex batches, lamps, masts, benches) read by sj-skatepark.js.
// Zones along the long axis s (north −, uphill; south +, the bay), across u (west −, Paseo de Colón; east +):
//   north: the bowl block (15 × 11 m bowl, 1.4 m deep, rolled east exit; deck 1.4 m; east bank, south quarter + bank) and
//          a 0.9 m street deck (bank, five-riser stair set) in the north-east corner;
//   middle: a clear spine 4–5 m wide the whole length; west: the forecourt pocket from Calle Paseo de Colón, a pyramid
//          into a euro gap, a grind ledge, ledge, flat rail and two manual pads; east of the spine: a tabletop and a kicker
//          pair aimed north, and the four-roller pump line along the east wall;
//   south: a halfpipe across the west half (opposing quarters, 2 m decks, outer banks) and a corner berm in the south-east
//          returning the pump line onto the spine; the berm's bank runs the whole south wall, so the spine ends in a bank.
//   openings: west and east, each at the back of a pocket of solid walls (a dog-leg: no straight line from the park floor
//          reaches either gate).
// Profiles and shapes follow the original game's Foundry Yard (src/level/skateparkLevel.ts); construction follows the SF
// edition's skatepark kit (see js/sj-skate-kit.js and provenance/skate-import.json).
import {skateFrame,createSkateKit,wallProfile,easedRamp,smooth,roundedRectDistance,samples} from './sj-skate-kit.js';

// Frame fitted to OSM 260859576: centre and long-axis heading of its 57 × 34 m rectangle (game heading, radians).
export const SKATEPARK={name:'Skatepark del Muelle',x:526.41,z:130.64,theta:15.7*Math.PI/180,ds:-.012,du:0,
  // interior (inner wall faces) and wall thickness
  u0:-15.6,u1:15.6,s0:-27.1,s1:27.1,wall:.4,
  // openings: west (Calle Paseo de Colón) and east (Calle Nilita), each at the back of a pocket of solid walls: from either
  // gate a straight line meets a wall, a seat or a deck before it reaches the park floor (tests/skatepark-audit.mjs)
  west:{s0:-1.8,s1:.8,apron:2.6},east:{s0:-15.4,s1:-13.0,apron:2.0},
  // map arrival: the south end of the kicker line, facing north (holding forward rides both kickers and the tabletop)
  arrival:{u:7.5,s:19.4,du:0,ds:-1}};
const P=SKATEPARK;
// Palette (sRGB): concrete, paint blocks after La Perla's painted bowl (broad flat blocks, yellow lip) and the old city's
// plaster colours; no words, no marks.
const C={floor:'#9a9b94',deck:'#b0aa9b',concrete:'#b5ae9f',bottom:'#bdb4a2',side:'#77716a',lip:'#efbd2f',
  teal:'#2f8f8c',cobalt:'#2f5c9c',leaf:'#5d9449',lilac:'#8f80b3',cream:'#e2d5b2',coral:'#d0694a',ochre:'#d9a441',sea:'#3f8f7a',
  // perimeter plaster in the old city's pastel facade tones, a white cap; painted blocks stay on the riding surfaces
  wall:['#e8dcc2','#e4a27d','#93c0bd','#e6cd7d','#a1b5d4','#e8dcc2','#c9d9a3'],cap:'#f1ebdd',steel:'#a9afac',rail:'#2f4a3c',
  planter:'#c9b48e',soil:'#5a4a35',mast:'#3d4442',flagRed:'#e1232d',flagBlue:'#1f5fb6',flagWhite:'#f6f4ee',letter:'#2f5c9c'};

export function createSkateparkLayout({city,height,isDry}){
  // ---- Floor plane: fixed grade along the lot (DEM trend), lifted to clear the DEM by 3 cm everywhere under the park ----
  let lift=-Infinity;
  const pre=skateFrame({x:P.x,z:P.z,theta:P.theta,y:0,du:P.du,ds:P.ds});
  for(let u=P.u0-P.wall;u<=P.u1+P.wall+1e-9;u+=.5)for(let s=P.s0-P.wall;s<=P.s1+P.wall+1e-9;s+=.5){const w=pre.world(u,s);
    if(!isDry(w.x,w.z))throw new Error('Skatepark footprint is not dry');lift=Math.max(lift,height(w.x,w.z)-pre.floorY(u,s));}
  const F=skateFrame({x:P.x,z:P.z,theta:P.theta,y:Math.round((lift+.03)*1000)/1000,du:P.du,ds:P.ds});
  const kit=createSkateKit(F,{source:'skatepark',feature:'skatepark'}),rects=[];
  // The spine ends in a bank at both ends: north, a 0.9 m quarter facing south with a deck behind it (level with the street
  // deck); south, the berm's bank along the whole south wall (below).
  // The quarter's lip stands 2 m off the wall on a 0.9 m deck: a wheel that comes up the kicker line at any speed airs off
  // the lip and comes back down the face (with the lip on the wall it struck the wall first).
  const NQ={u0:-.8,u1:9.4,h:.9,deck:2},nq=wallProfile(2.0,55,.5,NQ.h),nqLip=P.s0+NQ.deck,nqToe=nqLip+nq.run,northQ=s=>nq.rise(nqToe-s);
  const ssNorth=samples([[P.s0,nqToe+.4,.18]],nq.chords(14).map(q=>nqToe-q));
  const field=(spec,rect)=>{rects.push({...rect,id:spec.id,us:spec.us,ss:spec.ss});return kit.field(spec);};
  const lamps=[],masts=[],benches=[],palms=[],coping=[];let bermPaint=null;

  // =============== North: the bowl block ===============
  const B={cu:-8.5,cs:-18,au:5.5,as:7.5,rLip:3.6,depth:1.4,eastDeck:-.8,southDeck:-8.9};
  const wall=wallProfile(2.4,65,.6,B.depth),run=wall.run,a=B.au-run,b=B.as-run,r0=B.rLip-run;
  const qp=wallProfile(2.8,60,.5,B.depth),qpToe=B.southDeck+qp.run,ROLL=3.6;
  const bowlH=(u,s)=>{const d=roundedRectDistance(u,s,B.cu,B.cs,a,b,r0);if(d<=0)return 0;let hw=wall.rise(d);
    if(u>B.cu){const w=1-smooth((Math.abs(s-B.cs)-2.5)/1.2);if(w>0)hw+=(B.depth*easedRamp(d,ROLL,.6)-hw)*w;}return Math.min(B.depth,hw);};
  const eastBank=u=>B.depth*(1-easedRamp(u-B.eastDeck,3.4,.5));
  const southFace=(u,s)=>{if(s<=B.southDeck)return B.depth;const hq=qp.rise(qpToe-s),hb=B.depth*(1-easedRamp(s-B.southDeck,3.4,.5)),w=smooth((u+7.5)/2);return hq+(hb-hq)*w;};
  const blockH=(u,s)=>Math.max(Math.min(bowlH(u,s),eastBank(u),southFace(u,s)),u>=NQ.u0?Math.min(northQ(s),B.depth):0);
  const bowlD=(u,s)=>roundedRectDistance(u,s,B.cu,B.cs,a,b,r0);
  // The bowl block is painted per pixel by its own material (js/sj-skatepark.js) from these same numbers: crisp rounded
  // lip band (~30 cm pool-coping yellow on the steep wall), broad sector blocks, deck, banks.
  const bowlPaint={cu:B.cu,cs:B.cs,a,b,r0,run,band:.33,rollHalf:2.5,rollBlend:1.2,eastDeck:B.eastDeck,southDeck:B.southDeck,qpSplit:-6.5,
    colours:{bottom:C.bottom,deck:C.deck,lip:C.lip,sectors:[C.teal,C.cobalt,C.leaf,C.cream,C.lilac,C.teal],quarter:C.cobalt,bank:C.teal}};
  const bowlDiag=(i,j,u,s)=>(u-B.cu)*(s-B.cs)>0;
  {const lipU0=B.cu-B.au,lipU1=B.cu+B.au,lipS0=B.cs-B.as,lipS1=B.cs+B.as,bend=B.rLip+.15;
    const ch=wall.chords(16);
    const us=samples([[P.u0,lipU0,.8],[lipU0,lipU0+bend,.25],[lipU0+bend,lipU1-bend,.5],[lipU1-bend,lipU1,.25],[lipU1,B.eastDeck+.3,.3],[B.eastDeck,2.6,.25]],
      [P.u0,2.6,...ch.map(q=>B.cu-a-q),...ch.map(q=>B.cu+a+q)]);
    const ss=samples([[P.s0,lipS0,.8],[lipS0,lipS0+bend,.25],[lipS0+bend,B.cs-3.9,.5],[B.cs-3.9,B.cs+3.9,.4],[B.cs+3.9,lipS1-bend,.5],[lipS1-bend,lipS1,.25],
      [lipS1,B.southDeck,.8],[qpToe,-5.3,.3]],[P.s0,-5.3,...qp.chords(16).map(q=>qpToe-q),...ch.map(q=>B.cs-b-q),...ch.map(q=>B.cs+b+q),...ssNorth]);
    field({id:'bowl',us,ss,h:blockH,paint:()=>C.deck,material:'bowl',diagonal:bowlDiag},{u0:P.u0,u1:2.6,s0:P.s0,s1:-5.3});}

  // =============== North end of the spine: the return quarter ===============
  {const us=samples([[2.6,NQ.u1,.6]]);
    field({id:'north-quarter',us,ss:ssNorth.filter(s=>s<=nqToe+.4+1e-9),h:(u,s)=>northQ(s),paint:(u,s,h,sd)=>sd<2&&h>.5?C.deck:h>NQ.h-.12&&sd>15?C.lip:C.teal},{u0:2.6,u1:NQ.u1,s0:P.s0,s1:nqToe+.4});
    coping.push([[2.6,nqLip,NQ.h+.03],[NQ.u1,nqLip,NQ.h+.03]]);}

  // =============== North-east: 0.9 m street deck, a stair set and a bank down into the east gate's pocket ===============
  // A sitting wall stands on the deck's west edge (the deck's west face is a 0.9 m drop to the floor): anything ridden onto
  // the deck from the east pocket meets it or the walls, so the pocket sees no park floor.
  const D={h:.9,west:NQ.u1,edge:-19.5,stair0:NQ.u1,stair1:12.6,cheek1:13.2,bankEnd:-15.9};
  {const us=samples([[D.west,P.u1,.75]],[D.stair1,D.cheek1]);
    const ssD=samples([[P.s0,D.edge,.9]],ssNorth);
    field({id:'street-deck',us,ss:ssD,h:()=>D.h,paint:()=>C.ochre,sideColour:C.wall[5],skirts:[{edge:'s1',lo:D.stair0,hi:D.stair1},{edge:'u0',lo:nqLip,hi:D.edge}]},{u0:D.west,u1:P.u1,s0:P.s0,s1:D.edge});
    kit.block({id:'deck-seat',u0:D.west,u1:D.west+.6,s0:P.s0,s1:D.edge,height:D.h+.45,paint:C.cap,side:C.wall[2]});
    kit.block({id:'cheek',u0:D.stair1,u1:D.cheek1,s0:D.edge,s1:-17.1,height:D.h,paint:C.cap,side:C.wall[5]});
    const us2=samples([[D.cheek1,P.u1,.6]]),ss2=samples([[D.edge,D.bankEnd,.2]]);
    field({id:'street-bank',us:us2,ss:ss2,h:(u,s)=>D.h*(1-easedRamp(s-D.edge,D.bankEnd-D.edge,.5)),paint:(u,s,h,sd)=>sd>2?C.ochre:C.deck},{u0:D.cheek1,u1:P.u1,s0:D.edge,s1:D.bankEnd});
    for(let k=0;k<4;k++)kit.block({id:'stair-'+k,u0:D.stair0,u1:D.stair1,s0:D.edge+k*.35,s1:D.edge+(k+1)*.35,height:.72-k*.18,paint:k%2?C.deck:C.cream,side:C.side});}

  // =============== Middle west: pyramid into a euro gap, ledge, flat rail, manual pads ===============
  // The pyramid sits just south of the bowl block; its south face runs straight onto the euro's launch (one line).
  {const cu=-6.5,cs=-2.1,half=3.7,hs=3.1;   // pyramid: 7.4 × 6.2 m base, 3.5 × 2.3 m top at 0.6 m, eased 25° faces, rounded hips
    const pyr=(u,s)=>{const t=Math.min(half-Math.abs(u-cu),hs-Math.abs(s-cs));return .6*easedRamp(t-.2,1.75,.46);};
    const span=[[cu-half,cu-half+2.1,.24],[cu-half+2.1,cu+half-2.1,.7],[cu+half-2.1,cu+half,.24]],sspan=[[cs-hs,cs-hs+2.1,.24],[cs-hs+2.1,cs+hs-2.1,.7],[cs+hs-2.1,cs+hs,.24]];
    field({id:'pyramid',us:samples(span),ss:samples(sspan),h:pyr,diagonal:(i,j,u,s)=>(u-cu)*(s-cs)<0,paint:(u,s,h,sd)=>{if(sd<2)return h>.3?C.cream:C.floor;
      const du=u-cu,dsv=s-cs;return Math.abs(du)>Math.abs(dsv)?C.teal:C.cobalt;}},{u0:cu-half,u1:cu+half,s0:cs-hs,s1:cs+hs});}
  const EURO={s0:2.3,u0:-8.0,u1:-3.6};
  {const E=EURO;
    // launch bank (eased foot, straight 18° face) straight into a 1.3 m gap at floor level, then a 0.45 m table and a 20° run-out
    const e0=EURO.s0,up=s=>{const q=s-e0,f=q<=0?0:q<.6?q*q/1.2:q-.3;return .45*Math.min(1,f/1.4);};
    field({id:'euro-launch',us:samples([[E.u0,E.u1,.8]]),ss:samples([[e0,e0+1.7,.15]]),h:(u,s)=>up(s),
      paint:(u,s,h,sd)=>sd>2?C.teal:C.deck,skirts:[{edge:'s1'},{edge:'u0'},{edge:'u1'}]},{u0:E.u0,u1:E.u1,s0:e0,s1:e0+1.7});
    // the table's near edge is painted yellow (the landing nose); the 20° run-out leads south to the pad row
    field({id:'euro-landing',us:samples([[E.u0,E.u1,.8]]),ss:samples([[e0+3.0,e0+3.25,.25],[e0+3.25,e0+4.3,.55],[e0+4.3,e0+5.7,.15]]),h:(u,s)=>.45*(1-easedRamp(s-e0-4.3,1.4,.3)),
      paint:(u,s,h,sd)=>s<e0+3.25?C.lip:sd>2?C.teal:C.deck,skirts:[{edge:'s0'},{edge:'u0'},{edge:'u1'}]},{u0:E.u0,u1:E.u1,s0:e0+3.0,s1:e0+5.7});}
  kit.block({id:'ledge',u0:-9.8,u1:-9.2,s0:12.0,s1:17.6,height:.42,paint:C.cream,side:C.coral});
  coping.push([[-9.8,12.0,.425],[-9.8,17.6,.425]],[[-9.2,12.0,.425],[-9.2,17.6,.425]]);
  kit.rail({id:'flat-rail',points:[[-7.8,11.8,.40],[-7.8,16.8,.40]],width:.06,thickness:.06,posts:[{u:-7.8,s:12.2,height:.35,size:.06},{u:-7.8,s:16.4,height:.35,size:.06}]});
  kit.block({id:'manual-low',u0:-6.6,u1:-4.4,s0:11.4,s1:17.0,height:.16,paint:C.cream,side:C.cobalt});
  kit.block({id:'manual-high',u0:-3.2,u1:-.9,s0:11.6,s1:17.0,height:.30,paint:C.deck,side:C.teal});
  coping.push([[-3.2,11.6,.305],[-3.2,17.0,.305]]);

  // =============== Middle east: tabletop and a kicker pair aimed north (along the park, never at a street) ===============
  {const uu0=5.6,uu1=10.0,taper=u=>Math.min(1,(u-uu0)/1.1,(uu1-u)/1.1);
    const tab=s=>{const t=s+10.5;return t<3?.55*easedRamp(t,2.5,.5):.55*(1-easedRamp(t-4.5,2.5,.5));};   // 2.5 up, 2 m crest, 2.5 down
    field({id:'tabletop',us:samples([[uu0,uu0+1.1,.22],[uu0+1.1,uu1-1.1,.8],[uu1-1.1,uu1,.22]]),ss:samples([[-10.5,-8,.2],[-8,-6,1],[-6,-3.5,.2]]),
      h:(u,s)=>Math.min(tab(s),.55*easedRamp(taper(u)*1.1,1.1,.3)),paint:(u,s,h,sd)=>sd>2?C.coral:h>.3?C.cream:C.floor},{u0:uu0,u1:uu1,s0:-10.5,s1:-3.5});}
  const kicker=(id,toe,width)=>{   // original game's kicker: quadratic 1.65 m approach to 0.30 m, 0.30 m level flagged lip, 0.10 m back drop, 0.75 m eased bank
    const uu0=7.5-width/2-.55,uu1=7.5+width/2+.55,lip0=toe-1.65,lip1=lip0-.30,end=lip1-.75,yl=F.floorY(7.5,lip0)+.30;
    const prof=s=>s>=lip0?.30*((toe-s)/1.65)**2:s>=lip1?.30:.20*easedRamp(s-end,.75,.25);
    const side=u=>Math.tan(30*Math.PI/180)*Math.min(u-uu0,uu1-u);
    field({id,us:samples([[uu0,uu0+.6,.15],[uu0+.6,uu1-.6,.9],[uu1-.6,uu1,.15]]),ss:samples([[end,lip1,.15],[lip1-.001,lip1-.001,1],[lip1,lip0,.15],[lip0,toe,.12]]),
      h:(u,s)=>Math.min(prof(s),side(u)),level:[{u0:uu0+.55,u1:uu1-.55,s0:lip1,s1:lip0,y:yl}],flagLevel:true,
      paint:(u,s,h,sd)=>s>lip1-1e-6&&s<lip0+1e-6&&h>.29?C.lip:sd>2?C.coral:C.floor},{u0:uu0,u1:uu1,s0:end,s1:toe});};
  kicker('kicker-north',2.6,3.5);kicker('kicker-south',16.6,3.2);

  // Halfpipe and berm meet along the halfpipe's outer bank toe: one set of rows for both, the berm's west arm runs at full
  // height to the halfpipe deck, so the spine ends in a bank.
  const M={h:1.2,deck:2,s0:19.0};
  const quarter=wallProfile(2.4,62,.5,M.h);M.flat=Math.min(4.5,-.4-2.9-2*M.deck-2*quarter.run-P.u0);
  const lipW=P.u0+M.deck,toeW=lipW+quarter.run,toeE=toeW+M.flat,lipE=toeE+quarter.run,deckE=lipE+M.deck,bankE=deckE+2.9;
  const BERM={cu:9.6,cs:21.1,arm:4.3,u0:bankE,deck:0};{const bw=wallProfile(4.5,42,.8,1.2);BERM.R=P.u1-BERM.cu;BERM.toe=BERM.R-BERM.deck-bw.run;BERM.bw=bw;
    BERM.arm_=s=>bw.rise(s-BERM.cs-BERM.toe);
    BERM.h=(u,s)=>{const qu=u-BERM.cu,qs=s-BERM.cs;
      if(qu>=0&&qs>=0)return bw.rise(Math.hypot(qu,qs)-BERM.toe);if(qs<0&&qu>=0)return bw.rise(qu-BERM.toe)*smooth(1+qs/BERM.arm);if(qs>=0)return bw.rise(qs-BERM.toe);return 0;};}
  const SS_SOUTH=samples([[BERM.cs-BERM.arm,M.s0,.6],[M.s0,M.s0+2.9,.2],[M.s0+2.9,BERM.cs,.75],[BERM.cs,P.s1,.33]]);

  // =============== East: pump line (four cosine rollers) ===============
  {const r=[[-9,5.6,.30],[-3.4,5.6,.38],[2.2,5.6,.45],[7.8,5.6,.38]],uu0=11.0;
    const roll=s=>{for(const [s0,L,H] of r)if(s>=s0&&s<=s0+L)return H*(1-Math.cos((s-s0)/L*Math.PI*2))/2;return 0;};
    field({id:'pump',us:samples([[uu0,uu0+1.0,.25],[uu0+1.0,P.u1,1.05]]),ss:samples([[-9,13.4,.3],[13.4,15.8,1.2]]),h:(u,s)=>roll(s)*smooth((u-uu0)/1.0),
      paint:(u,s)=>s<13.4?(Math.floor((s+9)/5.6)%2?C.sea:C.teal):C.floor},{u0:uu0,u1:P.u1,s0:-9,s1:15.8});}

  // =============== South-east: corner berm returning the pump line onto the spine ===============
  {const cu=BERM.cu,cs=BERM.cs,R=BERM.R,toe=BERM.toe,arm=BERM.arm,berm=BERM.h;
    const us=samples([[BERM.u0,cu,.6],[cu,P.u1,.33]]),ss=SS_SOUTH;
    // painted per pixel like the bowl (js/sj-skatepark.js): cobalt face, yellow lip band along the top, deck in the corner
    bermPaint={cu,cs,R:R-BERM.deck,toe,arm,band:.33,colours:{floor:C.floor,face:C.cobalt,lip:C.lip,deck:C.deck}};
    field({id:'berm',us,ss,h:berm,diagonal:(i,j,u,s)=>(u-cu)*(s-cs)>0,paint:()=>C.deck,material:'berm'},{u0:BERM.u0,u1:P.u1,s0:cs-arm,s1:P.s1});}

  // =============== South-west: halfpipe across the park (riding along u) ===============
  {const hp=u=>u<=lipW?M.h:u<toeW?quarter.rise(toeW-u):u<=toeE?0:u<lipE?quarter.rise(u-toeE):u<=deckE?M.h:M.h*(1-easedRamp(u-deckE,bankE-deckE,.4));
    const sideB=s=>M.h*easedRamp(s-M.s0,2.9,.4);
    const ch=quarter.chords(18),us=samples([[P.u0,lipW,1],[toeE,toeE,1],[deckE,bankE,.25],[lipE,deckE,1]],[...ch.map(q=>toeW-q),...ch.map(q=>toeE+q),toeW+1,toeW+2,toeW+3]);
    const ss=SS_SOUTH.filter(s=>s>=M.s0-1e-9);
    field({id:'halfpipe',us,ss,h:(u,s)=>Math.max(Math.min(hp(u),sideB(s)),u>=deckE?BERM.arm_(s):0),
      paint:(u,s,h,sd)=>{if(h<.02)return C.floor;if(sd<2)return C.deck;if(u>deckE&&BERM.arm_(s)>=h-1e-6)return h>1.12?C.lip:C.cobalt;if(s<M.s0+2.9-.05&&(u<toeW||u>toeE))return u>deckE?C.cream:C.ochre;return u<toeW?C.sea:u>deckE?C.cream:C.teal;}},
      {u0:P.u0,u1:bankE,s0:M.s0,s1:P.s1});
    // steel pipe coping on both lips (render only, 1 cm proud of the lip)
    for(const u of [lipW,lipE])coping.push([[u,M.s0+2.9,M.h+.03],[u,P.s1-.05,M.h+.03]]);}
  if(bankE>-.15||M.flat<3.2)throw new Error('Skatepark halfpipe does not fit');

  // =============== Floor: everything not owned by a field, plus the two openings ===============
  const inRect=(u,s)=>rects.find(r=>u>r.u0+1e-9&&u<r.u1-1e-9&&s>r.s0+1e-9&&s<r.s1-1e-9);
  const inWestGate=(u,s)=>u<P.u0&&s>P.west.s0&&s<P.west.s1,inEastGate=(u,s)=>u>P.u1&&s>P.east.s0&&s<P.east.s1;
  // Floor cells are emitted after the aprons (below) so that every cell edge lying on a field's edge carries exactly that
  // field's edge vertices (no T-junction slivers in the support between two owners).
  const demY=(x,z)=>height(x,z);
  // Aprons: eased from the park floor down to the street ground at the exact drawn DEM height, with flared sides.
  {const W=P.west,uo=P.u0-P.wall,ue=uo-W.apron,flare=1.4;
    const worldY=(u,s,x,z)=>{const g=demY(x,z),f=F.floorY(uo,s),t=easedRamp(uo-u,W.apron,.6),lat=smooth(Math.min(s-(W.s0-flare),(W.s1+flare)-s)/flare);
      return g+(f-g)*(1-t)*lat;};
    const us=samples([[ue,uo,.3]]),ss=samples([[W.s0-flare,W.s0,.35],[W.s0,W.s1,1],[W.s1,W.s1+flare,.35]]);
    kit.field({id:'apron-west',us,ss,worldY,slopeFlag:Infinity,topExtra:{replacesTerrain:true},paint:()=>C.floor});
    rects.push({u0:ue,u1:uo,s0:W.s0-flare,s1:W.s1+flare,id:'apron-west',outside:true,us,ss});}
  {const E=P.east,uo=P.u1+P.wall,ue=uo+E.apron,flare=1.2;
    const worldY=(u,s,x,z)=>{const g=demY(x,z),f=F.floorY(uo,s),t=easedRamp(u-uo,E.apron,.5),lat=smooth(Math.min(s-(E.s0-flare),(E.s1+flare)-s)/flare);
      return g+(f-g)*(1-t)*lat;};
    const us=samples([[uo,ue,.25]]),ss=samples([[E.s0-flare,E.s0,.3],[E.s0,E.s1,.75],[E.s1,E.s1+flare,.3]]);
    kit.field({id:'apron-east',us,ss,worldY,slopeFlag:Infinity,topExtra:{replacesTerrain:true},paint:()=>C.floor});
    rects.push({u0:uo,u1:ue,s0:E.s0-flare,s1:E.s1+flare,id:'apron-east',outside:true,us,ss});}

  {const breaksU=[P.u0-P.wall,P.u0,P.u1,P.u1+P.wall,...rects.flatMap(r=>[r.u0,r.u1])],breaksS=[P.s0,P.s1,P.west.s0,P.west.s1,P.east.s0,P.east.s1,...rects.flatMap(r=>[r.s0,r.s1])];
    const us=samples([[P.u0-P.wall,P.u1+P.wall,2]],breaksU),ss=samples([[P.s0,P.s1,2]],breaksS),E=1e-7;
    const between=(list,lo,hi)=>list.filter(v=>v>lo+E&&v<hi-E);
    const extra=(line,lo,hi,axis)=>{const out=[];for(const r of rects){
      if(axis==='u'){if((Math.abs(r.u1-line)<E||Math.abs(r.u0-line)<E)&&r.s0<hi-E&&r.s1>lo+E)out.push(...between(r.ss,lo,hi));}
      else if((Math.abs(r.s1-line)<E||Math.abs(r.s0-line)<E)&&r.u0<hi-E&&r.u1>lo+E)out.push(...between(r.us,lo,hi));}
      return [...new Set(out)].sort((a,b)=>a-b);};
    const cells=[];
    for(let i=0;i+1<us.length;i++)for(let j=0;j+1<ss.length;j++){const ua=us[i],ub=us[i+1],sa=ss[j],sb=ss[j+1],u=(ua+ub)/2,s=(sa+sb)/2;
      if(inRect(u,s))continue;const inside=u>P.u0&&u<P.u1&&s>P.s0&&s<P.s1;if(!inside&&!(inWestGate(u,s)||inEastGate(u,s)))continue;
      // counter-clockwise in (u,s): south edge (s=sa) u ascending, east edge (u=ub) s ascending, north edge, west edge
      const loop=[[ua,sa],...extra(sa,ua,ub,'s').map(v=>[v,sa]),[ub,sa],...extra(ub,sa,sb,'u').map(v=>[ub,v]),[ub,sb],
        ...extra(sb,ua,ub,'s').reverse().map(v=>[v,sb]),[ua,sb],...extra(ua,sa,sb,'u').reverse().map(v=>[ua,v])];
      cells.push(loop);}
    kit.polygons({id:'floor',loops:cells,paint:()=>C.floor,material:'floor'});}
  // =============== Perimeter: painted walls and harbour-green railings ===============
  // Each run: [edge, from, to, wall height above floor, guard height (railing top) or 0, railing kind]. Guard heights follow
  // measured crash throws: against a flat wall a flat-out crash (up to ~19 m/s on the longest run-up) lifts the body
  // 1.3–1.9 m, so 2.2 m over flat floor; 1.2 m over a deck beside the halfpipe; the berm launches the body to ~3.1 m, so
  // 3.6 m with close pickets there only; the north quarter and the bowl's back walls 3.0 m (come-back airs).
  const T=P.wall,ES=P.east,runs=[
    ['u0',P.s0,-5.3,2.45,3.0,'rail'],['u0',-5.3,P.west.s0,1.0,2.2,'rail'],['u0',P.west.s1,M.s0-.6,1.0,2.2,'rail'],['u0',M.s0-.6,P.s1,1.0,2.4,'rail'],
    ['s1',P.u0-T,deckE,1.0,2.4,'rail'],['s1',deckE,P.u1+T,1.0,3.6,'pickets'],
    ['u1',P.s1,16.0,1.0,3.6,'pickets'],['u1',16.0,ES.s1,1.0,2.2,'rail'],['u1',ES.s0,P.s0,1.95,2.8,'rail'],
    ['s0',P.u1+T,7.0,1.95,2.8,'rail'],['s0',7.0,2.6,1.95,3.0,'rail'],['s0',2.6,P.u0-T,2.45,3.0,'rail']];
  const groundAlong=(pts)=>Math.min(...pts.map(([u,s])=>{const w=F.world(u,s);return demY(w.x,w.z);}));
  let panel=0;
  for(const [edge,a0,a1,wh,guard,kind] of runs){const lo=Math.min(a0,a1),hi=Math.max(a0,a1),n=Math.max(1,Math.round((hi-lo)/7.2));
    for(let k=0;k<n;k++){const p0=lo+(hi-lo)*k/n,p1=lo+(hi-lo)*(k+1)/n,colour=C.wall[panel++%C.wall.length];
      const box=edge==='u0'?{u0:P.u0-T,u1:P.u0,s0:p0,s1:p1}:edge==='u1'?{u0:P.u1,u1:P.u1+T,s0:p0,s1:p1}:edge==='s0'?{u0:p0,u1:p1,s0:P.s0-T,s1:P.s0}:{u0:p0,u1:p1,s0:P.s1,s1:P.s1+T};
      const outer=edge==='u0'?[[box.u0,p0],[box.u0,p1]]:edge==='u1'?[[box.u1,p0],[box.u1,p1]]:edge==='s0'?[[p0,box.s0],[p1,box.s0]]:[[p0,box.s1],[p1,box.s1]];
      const cu=(box.u0+box.u1)/2,cs=(box.s0+box.s1)/2,mid=[[cu,cs]];
      const fl=Math.min(F.floorY(box.u0,box.s0),F.floorY(box.u1,box.s1));
      const bottom=Math.min(fl,groundAlong([...outer,...[0,.25,.5,.75,1].map(t=>[outer[0][0]+(outer[1][0]-outer[0][0])*t,outer[0][1]+(outer[1][1]-outer[0][1])*t]),...mid]))-.06;
      const top=Math.max(F.floorY(box.u0,box.s0),F.floorY(box.u1,box.s1))+wh;
      kit.prism({...box,bottom,top,paint:f=>f==='top'?C.cap:colour,collide:false});
      // collider top = the lowest drawn top over the segment (the visible wall reaches it)
      const minTop=Math.min(F.floorY(box.u0,box.s0),F.floorY(box.u1,box.s1))+wh;
      kit.result().colliders.push({centre:{...F.world(cu,cs),y:(bottom+minTop)/2},halfExtents:{x:(box.u1-box.u0)/2,y:(minTop-bottom)/2,z:(box.s1-box.s0)/2},
        rotationY:F.theta,surface:'pavement',source:'skatepark:wall'});
      if(guard>wh){const g=Math.min(F.floorY(box.u0,box.s0),F.floorY(box.u1,box.s1))+guard;
        // railing bay: square posts every ~2.4 m, a top rail and one mid rail; round the berm close vertical pickets as well.
        // One see-through collision box reaches the top rail.
        const along=edge[0]==='u'?(t=>[cu,p0+(p1-p0)*t]):(t=>[p0+(p1-p0)*t,cs]),L=p1-p0,posts=Math.max(1,Math.round(L/2.4));
        for(let q=0;q<=posts;q++){const [u,s]=along(q/posts);kit.prism({u0:u-.035,u1:u+.035,s0:s-.035,s1:s+.035,bottom:top-.05,top:g+.02,paint:C.rail,material:'metal'});}
        const [ua,sa]=along(0),[ub,sb]=along(1);
        kit.tube({points:[[ua,sa,guard],[ub,sb,guard]],radius:.032,sides:6,colour:C.rail});
        kit.tube({points:[[ua,sa,wh+(guard-wh)*.45],[ub,sb,wh+(guard-wh)*.45]],radius:.018,sides:4,colour:C.rail});
        if(kind==='pickets'){const m=Math.round(L/.16);for(let q=1;q<m;q++){const [u,s]=along(q/m);kit.tube({points:[[u,s,wh],[u,s,guard]],radius:.011,sides:3,colour:C.rail});}}
        kit.result().colliders.push({centre:{...F.world(cu,cs),y:(minTop+g)/2},halfExtents:{x:(box.u1-box.u0)/2,y:(g-minTop)/2,z:(box.s1-box.s0)/2},
          rotationY:F.theta,surface:'pavement',occludes:false,source:'skatepark:railing'});}}}

  // ---- The two gate pockets (dog-legs of solid walls; tests/skatepark-audit.mjs gateVisibility) ----
  // West: the gate opens into a 3 m pocket between the wall and a sitting wall, closed at its north end; the way in leaves
  // its south end and turns east through a 2.4 m slot past a grind ledge. A line from the gate leaving the pocket's south
  // end (at most 37° off the wall) meets the grind ledge.
  // The pocket walls carry a harbour-green railing to 2.2 m (the perimeter's flat-floor guard): a wheel thrown off a kicker,
  // the euro or the bowl does not fly over them into the pocket. One see-through collision box per wall.
  const pocketRail=(u0,u1,s0,s1,base)=>{const alongU=u1-u0>s1-s0,cu=(u0+u1)/2,cs=(s0+s1)/2,L=alongU?u1-u0:s1-s0,n=Math.max(1,Math.round(L/2.0));
    const at=f=>alongU?[u0+.05+(L-.1)*f,cs]:[cu,s0+.05+(L-.1)*f],guard=2.2;
    for(let q=0;q<=n;q++){const [u,s]=at(q/n);kit.prism({u0:u-.035,u1:u+.035,s0:s-.035,s1:s+.035,bottomLocal:base-.02,topLocal:guard+.02,paint:C.rail,material:'metal'});}
    const [ua,sa]=at(0),[ub,sb]=at(1);kit.tube({points:[[ua,sa,guard],[ub,sb,guard]],radius:.032,sides:6,colour:C.rail});
    kit.tube({points:[[ua,sa,base+(guard-base)*.45],[ub,sb,base+(guard-base)*.45]],radius:.018,sides:4,colour:C.rail});
    const c=F.world(cu,cs),fy=F.floorY(cu,cs);kit.result().colliders.push({centre:{...c,y:fy+(base+guard)/2},halfExtents:{x:(u1-u0)/2,y:(guard-base)/2,z:(s1-s0)/2},
      rotationY:F.theta,surface:'pavement',occludes:false,source:'skatepark:pocket-railing'});};
  kit.block({id:'pocket-return',u0:P.u0,u1:-12.0,s0:-2.6,s1:-2.0,height:.45,paint:C.cap,side:C.wall[1]});
  kit.block({id:'forecourt-seat',u0:-12.6,u1:-12.0,s0:-2.0,s1:4.8,height:.45,paint:C.cap,side:C.wall[1]});
  pocketRail(P.u0,-12.0,-2.6,-2.0,.45);pocketRail(-12.6,-12.0,-2.0,4.8,.45);
  kit.block({id:'slot-ledge',u0:P.u0,u1:-10.8,s0:7.2,s1:7.8,height:.42,paint:C.cream,side:C.wall[3]});
  coping.push([[P.u0+.05,7.2,.425],[-10.8,7.2,.425]],[[P.u0+.05,7.8,.425],[-10.8,7.8,.425]]);
  // East: the gate opens into a 2.4 m pocket between the wall and a sitting wall, closed at its south end; its north end is
  // the bank up to the street deck (the way in), so a line from the gate rises onto the deck and meets its walls.
  kit.block({id:'east-seat',u0:D.stair1,u1:D.cheek1,s0:-17.1,s1:-11.6,height:.45,paint:C.cap,side:C.wall[2]});
  kit.block({id:'east-return',u0:D.cheek1,u1:P.u1,s0:-12.2,s1:-11.6,height:.45,paint:C.cap,side:C.wall[2]});
  pocketRail(D.stair1,D.cheek1,-17.1,-11.6,.45);pocketRail(D.cheek1,P.u1,-12.2,-11.6,.45);

  // ---- Painted name and one Puerto Rican flag on the tall west wall (street side), 2 cm proud of the plaster (no shadow) ----
  // Plates on a wall face at u = faceU, normal `out` (±1 along u); reading direction `dir` (±1 along s). Wall-plane points
  // are (s, y) with y a world height.
  const plate=(faceU,out,proud,poly,colour)=>{const P3=poly.map(([s,y])=>{const w=F.world(faceU+out*proud,s);return [Math.fround(w.x),Math.fround(y),Math.fround(w.z)];});
    const B3=poly.map(([s,y])=>{const w=F.world(faceU,s);return [Math.fround(w.x),Math.fround(y),Math.fround(w.z)];});
    const n=[out*F.cs,0,-out*F.sn],fan=k=>[P3[0],P3[k],P3[k+1]];
    for(let k=1;k+1<P3.length;k++){let tri=fan(k);const ux=tri[1][0]-tri[0][0],uy=tri[1][1]-tri[0][1],uz=tri[1][2]-tri[0][2],vx=tri[2][0]-tri[0][0],vy=tri[2][1]-tri[0][1],vz=tri[2][2]-tri[0][2];
      const nx=uy*vz-uz*vy,nz=ux*vy-uy*vx;if(nx*n[0]+nz*n[2]<0)tri=[tri[0],tri[2],tri[1]];kit.emit('paint',...tri,colour,n,n,n);}
    for(let k=0;k<P3.length;k++){const a=P3[k],b=P3[(k+1)%P3.length],a0=B3[k],b0=B3[(k+1)%P3.length];kit.emit('paint',a,a0,b0,colour);kit.emit('paint',a,b0,b,colour);
      kit.emit('paint',a,b0,a0,colour);kit.emit('paint',a,b,b0,colour);}};
  const STROKES={S:[[1,1,0,1],[0,1,0,.5],[0,.5,1,.5],[1,.5,1,0],[1,0,0,0]],K:[[0,0,0,1],[0,.48,1,1],[.3,.62,1,0]],A:[[0,0,.5,1],[.5,1,1,0],[.24,.4,.76,.4]],
    T:[[0,1,1,1],[.5,1,.5,0]],E:[[1,1,0,1],[0,1,0,0],[0,0,1,0],[0,.5,.75,.5]],P:[[0,0,0,1],[0,1,1,1],[1,1,1,.48],[1,.48,0,.48]],
    R:[[0,0,0,1],[0,1,1,1],[1,1,1,.5],[1,.5,0,.5],[.45,.5,1,0]],D:[[0,0,0,1],[0,1,.62,1],[.62,1,1,.68],[1,.68,1,.32],[1,.32,.62,0],[.62,0,0,0]],
    L:[[0,1,0,0],[0,0,1,0]],M:[[0,0,0,1],[0,1,.5,.42],[.5,.42,1,1],[1,1,1,0]],U:[[0,1,0,0],[0,0,1,0],[1,0,1,1]]};
  const lettering=(text,faceU,out,dir,sStart,y0,size,colour)=>{const wdt=size*.62,adv=size*.86,sw=size*.15;let k=0;
    for(const ch of text){if(STROKES[ch])for(const [x0,y0_,x1,y1] of STROKES[ch]){
      const a=[sStart+dir*(k*adv+x0*wdt),y0+y0_*size],b=[sStart+dir*(k*adv+x1*wdt),y0+y1*size],L=Math.hypot(b[0]-a[0],b[1]-a[1]),px=-(b[1]-a[1])/L*sw/2,py=(b[0]-a[0])/L*sw/2,ex=(b[0]-a[0])/L*sw/2,ey=(b[1]-a[1])/L*sw/2;
      plate(faceU,out,.02,[[a[0]-ex+px,a[1]-ey+py],[b[0]+ex+px,b[1]+ey+py],[b[0]+ex-px,b[1]+ey-py],[a[0]-ex-px,a[1]-ey-py]],colour);}k++;}};
  {const face=P.u0-T,yb=F.floorY(P.u0-T,-18);
    lettering('SKATEPARK DEL MUELLE',face,-1,1,-22.6,yb+1.45,.62,C.letter);
    // inside, over the bowl deck: the same name, read from the park
    lettering('SKATEPARK DEL MUELLE',P.u0,1,-1,-7.6,F.floorY(P.u0,-12)+1.62,.5,C.letter);
    // the flag: five red and white stripes, the blue triangle at the hoist with the white star (3:2), hoist to the north
    const W=1.65,H=1.1,s0=-26.55,y0=yb+.95,tri=H*Math.sqrt(3)/2,xt=y=>tri*(1-Math.abs(y-H/2)/(H/2));
    for(let i=0;i<5;i++){const top=H-i*H/5,bot=H-(i+1)*H/5,poly=[[xt(top),top],[W,top],[W,bot],[xt(bot),bot]];if(bot<H/2&&top>H/2)poly.push([tri,H/2]);
      plate(face,-1,.02,poly.map(([x,y])=>[s0+x,y0+y]),i%2?C.flagWhite:C.flagRed);}
    plate(face,-1,.02,[[s0,y0],[s0+tri,y0+H/2],[s0,y0+H]],C.flagBlue);
    const star=[];for(let k=0;k<10;k++){const a=Math.PI/2+k*Math.PI/5,r=k%2?.085:.21;star.push([s0+tri/3+Math.cos(a)*r,y0+H/2+Math.sin(a)*r]);}
    plate(face,-1,.04,[[s0+tri/3,y0+H/2],...star,star[0]],C.flagWhite);}

  // ---- Coping (render-only steel pipe / angle; thin parts cast no shadow in the builder) ----
  for(const line of coping)kit.tube({points:line,radius:.03,sides:8,colour:C.steel});

  // ---- Lights for blue hour: masts on the wall tops; heads report to the baked lamp map (no real lights) ----
  for(const [u,s] of [[P.u0-T/2,-14],[P.u0-T/2,1.8],[P.u0-T/2,12],[P.u0-T/2,23],[-6,P.s0-T/2],[11.5,P.s0-T/2],[P.u1+T/2,-20.5],[P.u1+T/2,-4],[P.u1+T/2,7],[P.u1+T/2,22],[-8,P.s1+T/2],[4.5,P.s1+T/2]]){
    const w=F.world(u,s),base=F.floorY(u,s),top=base+6.2;masts.push({x:w.x,z:w.z,u,s,y0:base+1,y1:top});
    kit.prism({u0:u-.06,u1:u+.06,s0:s-.06,s1:s+.06,bottom:base+.9,top,paint:C.mast,material:'metal'});
    lamps.push({x:w.x,y:top-.1,z:w.z,ground:base});}

  // ---- Palms in masonry planters outside the openings (crowns well above every ride line) ----
  for(const [u,s] of [[P.u0-T-.65,P.west.s0-2.2],[P.u0-T-.65,P.west.s1+2.2],[P.u1+T+.65,P.east.s0-2.0],[P.u1+T+.65,P.east.s1+2.0]]){
    const w=F.world(u,s),g=Math.min(...[[-.6,-.6],[.6,-.6],[.6,.6],[-.6,.6],[0,0]].map(([du,dss])=>{const p=F.world(u+du,s+dss);return demY(p.x,p.z);}));
    const top=Math.max(...[[-.6,-.6],[.6,-.6],[.6,.6],[-.6,.6]].map(([du,dss])=>{const p=F.world(u+du,s+dss);return demY(p.x,p.z);}))+.5;
    kit.prism({u0:u-.6,u1:u+.6,s0:s-.6,s1:s+.6,bottom:g-.05,top,paint:f=>f==='top'?'#5a4a35':C.planter,collide:true,source:'skatepark:planter'});
    // the trunk stands on the ground inside the planter (its foot hidden by the masonry)
    palms.push({x:w.x,y:g,z:w.z,yaw:(u*7.1+s*3.3)%(Math.PI*2)});}

  // ---- Benches against the wall (backs to the wall), street-kit form ----
  for(const [u,s,fu,fs] of [[P.u0+.45,10.6,1,0],[P.u0+.45,14.0,1,0]]){const w=F.world(u,s),wx=fu*F.cs+fs*F.sn,wz=-fu*F.sn+fs*F.cs,heading=Math.atan2(wx,wz);
    const c=Math.cos(heading),sn=Math.sin(heading),legs=[-.72,.72].map(lu=>{const x=w.x+c*lu,z=w.z-sn*lu,[pu,ps]=F.local(x,z);return {u:lu,ground:F.floorY(pu,ps)};});
    const y=Math.max(...legs.map(l=>l.ground));benches.push({x:w.x,z:w.z,y,legs,heading,width:1.9,depth:.6,height:.95});
    kit.result().colliders.push({centre:{x:w.x,y:y+.4,z:w.z},halfExtents:{x:.98,y:.45,z:.32},rotationY:heading,surface:'pavement',source:'skatepark:bench'});}

  const R=kit.result();
  // ---- Ownership, terrain cut, arrival ----
  const ringOf=(u0,u1,s0,s1)=>[[u0,s0],[u1,s0],[u1,s1],[u0,s1]].map(([u,s])=>{const w=F.world(u,s);return [w.x,w.z];});
  const footprint=ringOf(P.u0-T,P.u1+T,P.s0-T,P.s1+T),aprons=rects.filter(r=>r.outside).map(r=>ringOf(r.u0,r.u1,r.s0,r.s1));
  const cutOf=ring=>{const sa=ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0),planes=[];
    for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],ex=q[0]-p[0],ez=q[1]-p[1];
      // inward normal: left of the edge for a counter-clockwise (x,z) ring
      let nx=-ez,nz=ex;if(sa<0){nx=-nx;nz=-nz;}const l=Math.hypot(nx,nz);nx/=l;nz/=l;planes.push([nx,0,nz,-(nx*p[0]+nz*p[1])]);}
    const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);return {planes,ring,tight:true,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};};
  const cuts=[footprint,...aprons].map(cutOf);
  const A=P.arrival,aw=F.world(A.u,A.s),arrival={x:aw.x,z:aw.z,y:F.floorY(A.u,A.s),headingY:F.heading(A.du,A.ds),clear:2.5};
  // Riding line from the arrival out through the forecourt opening to the Paseo de Colón / waterfront avenue corner.
  const colon=city.roads.find(r=>r.id===22224648),corner=colon?.points.at(-1)??[504.84,169.89],gs=(P.west.s0+P.west.s1)/2;
  const via=[[4.2,18.6],[2.6,10],[0.5,9.5],[-9.4,9.6],[-9.4,6.0],[-12.0,6.0],[-14.1,4.6],[-14.1,gs],[P.u0-T-P.west.apron-.6,gs],[-21.3,gs],[-21.3,33.0]].map(([u,s])=>{const w=F.world(u,s);return [w.x,w.z];});
  const routeLines=[{name:P.name+' forecourt',points:[[aw.x,aw.z],...via,corner]}];
  const es=(P.east.s0+P.east.s1)/2,WAY_IN=[[-19.2,gs],[-14.1,gs],[-14.1,4.6],[-12.0,6.0],[-9.4,6.0],[-9.4,9.6],[0.5,9.5]],
    WAY_EAST=[[19.0,es],[14.4,es],[14.4,-16.4],[14.4,-20.6],[12.0,-21.6],[11.0,-20.2],[11.0,-16.6],[8.0,-14.0],[2.6,-8]];
  // The gates' passage zones (park-local polygons): the only floor a straight line from a gate reaches.
  const ZONES={west:[[[P.u0,-2.0],[-12.6,-2.0],[-12.6,4.8],[-10.8,4.8],[-10.8,7.2],[P.u0,7.2]]],east:[[[D.cheek1,D.bankEnd-.6],[P.u1,D.bankEnd-.6],[P.u1,-12.2],[D.cheek1,-12.2]]]};
  // Floor paint (drawn by the concrete material from park-local position, no overlay faces): the kicker line (dashes and
  // north-pointing chevrons from the berm through both kickers to the tabletop), the start bar at the arrival, the euro
  // gap's take-off bar; route marks (above) for the pump exit and the gates.
  // Route marks (dashes with an arrow at the end, painted on whatever they cross: floor, rollers, bank, deck, stairs): the
  // early left exit off the northbound pump line before its last roller, and the turn inside each gate.
  const ROUTES=[
    [[14.2,-3.0],[10.6,-2.4],[5.0,-1.8],[3.0,-1.8]],                       // pump line → spine, before the last roller
    [[-14.1,-.6],[-14.1,4.2],[-13.2,5.6],[-11.2,6.0],[-9.4,7.4]],         // west: down the pocket, round the wall, out of the slot
    [[15.0,-14.2],[14.4,-14.6],[14.4,-15.9]],                             // east: into the pocket, turn to the bank
    [[14.4,-16.6],[14.4,-20.6]],[[13.8,-21.5],[11.7,-21.5]],[[11.0,-20.7],[11.0,-18.6]]];   // up the bank, along the deck, down the stairs
  const floorPaint={kick:{u:7.5,s0:-3.5,s1:18.6},start:{u:A.u,s:A.s},euro:{u0:EURO.u0,u1:EURO.u1,s:EURO.s0-.25},routes:ROUTES,
    colours:{floor:C.floor,mark:C.cap,lip:C.lip}};
  const stats={floorY0:F.y,lift:+(lift).toFixed(3),tops:R.tops.length,flagged:R.counts.flagged,bodies:R.colliders.length,drawTriangles:R.counts.drawTriangles,
    bytes:[...R.batches.values()].reduce((s,b)=>s+(b.p.length+b.n.length+b.c.length)*4,0)};
  return {tops:R.tops,colliders:R.colliders,cuts,surfaces:[],floorTriangles:[],
    sportsRings:[{ring:footprint,kind:'skatepark',source:'skatepark'},...aprons.map(ring=>({ring,kind:'skatepark',source:'skatepark'}))],
    palms,places:[{name:P.name,x:aw.x,z:aw.z,source:'skatepark',ring:footprint.map(q=>[q[0],q[1]]),arrival}],routeLines,
    skate:{batches:R.batches,bowl:bowlPaint,berm:bermPaint,floor:floorPaint,lamps,masts,benches,frame:{x:F.x,z:F.z,theta:F.theta,y:F.y,du:F.du,ds:F.ds}},
    frame:F,ways:{west:WAY_IN,east:WAY_EAST,zones:ZONES},qa:()=>stats};
}
