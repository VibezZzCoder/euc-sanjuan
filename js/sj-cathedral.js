/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// San Juan Bautista exterior — © 2026 VibezZzCoder, MIT.
// Wikimedia Commons curid=158245895, curid=1798720, curid=15687347: three entrances, paired pilasters, curved shoulders, upper niche and pediment.
// Approximate proportions in the mapped footprint. Closed portals; no explorable interior.
import * as THREE from 'three/webgpu';
import {statueFrame} from './sj-statues.js';

export const CATHEDRAL_WALL='#e6ddc7';
export function buildCathedral(cathedral,kit) {
  const {frame:f,width:w,ground:y,roof,steps,tiers,doors}=cathedral;
  const {localBox:box,bake,own,archGeometry,sculpture}=kit;
  const trim='#f2ebde',stone='#a99b85',wood='#35413b';
  for(const s of [...steps,...tiers])box(f,s.u,(s.minY+s.maxY)/2,s.front-s.depth/2,s.width,s.maxY-s.minY,s.depth,
    s.support?stone:CATHEDRAL_WALL,true);
  // Foot apron (js/sj-stairs.js footApron): the fitted ruled surface from the street to the first riser, over its cut.
  if(cathedral.aprons?.length){const pos=[];for(const t of cathedral.aprons){let [a,b,c]=t;const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(ny<0)[b,c]=[c,b];pos.push(...a,...b,...c);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,'#bfb6a5',0,'solid');g.dispose();}
  // Nosing bars on the flight (js/sj-stairs.js STAIR_NOSING; none on the top riser): front 2.5 cm proud of the riser.
  {const N_=cathedral.flight?.module?.nosing;if(N_)for(const s of steps)if(s.nosing)box(f,s.u,s.maxY+N_.up-.015,s.front+N_.out-N_.depth/2,s.width+.01,.03,N_.depth,trim,true);}
  function moulding(u,level,width) {
    box(f,u,level,.10,width,.12,.28,trim);
    box(f,u,level+.14,.16,width+.16,.14,.40,trim);
    const capY=level+.29,capHeight=.12;
    box(f,u,capY,.23,width+.34,capHeight,.54,trim);
    return {top:capY+capHeight/2};
  }
  function pilaster(u,base,top,width=.46) {
    box(f,u,(base+top)/2,.12,width,top-base,.26,trim);
    for(const [v,h,extra] of [[base+.10,.20,.20],[base+.31,.12,.12],[top-.16,.13,.18],[top,.18,.28]])
      box(f,u,v,.18,width+extra,h,.38,trim);
  }
  function door(u,base,width,height) {
    // Photographed semicircular lunettes are plaster infill above rectangular closed doors, not open arches.
    bake(archGeometry(width,height),...f.point(u,base,.055),1,1,1,CATHEDRAL_WALL,f.angle,'facade');
    bake(archGeometry(width,height,true),...f.point(u,base,.12),1,1,1,trim,f.angle,'facade');
    const doorH=height-width/2-.18;
    box(f,u,base-.02+(doorH+.02)/2,.10,width,doorH+.02,.08,wood);  // leaf foot 2 cm into the step (its bottom was the trim's plane)
    box(f,u,base+doorH+.08,.18,width+.25,.18,.27,trim);
    for(let i=1;i<9;i++)box(f,u-width/2+width*i/9,base+doorH/2,.16,.045,doorH,.045,'#667066');
    for(const level of [.23,.53,.8])box(f,u,base+doorH*level,.16,width,.055,.045,'#788073');
  }
  for(const d of doors)door(d.u,y,d.width,Math.min(6.5,roof-y-1.05));
  for(const u of [.035,.105,.365,.425,.575,.635,.895,.965])pilaster(u*w,y,roof-.65);
  const lowerLedge=moulding(w/2,roof-.55,w+.2),tierLedges=[];
  // Flat central upper tiers, the lower window and the higher saint niche follow the photo hierarchy.
  for(const tier of tiers) {
    for(const u of [.245,.305,.695,.755])pilaster(u*w,tier.minY+.25,tier.maxY-.35,.37);
    tierLedges.push(moulding(w/2,tier.maxY-.15,tier.width+.3));
  }
  door(w/2,roof+.45,1.8,2.9);
  bake(archGeometry(1.8,2.75),...f.point(w/2,roof+4.35,.06),1,1,1,'#b5ad99',f.angle,'facade');
  bake(archGeometry(1.8,2.75,true),...f.point(w/2,roof+4.35,.12),1,1,1,trim,f.angle,'facade');
  function statue(u,base,scale,paint,ledge) {
    // Wikimedia Commons curid=1798720, curid=15687347: the plinth is carried by masonry, not a shelf hovering above the cornice.
    // Seat the narrower pedestal fully on its ledge, with small buried overlaps at both ends.
    const bottom=ledge.top-.02,top=base+.02;
    box(f,u,(bottom+top)/2,.23,.72*scale,top-bottom,.50,stone);
    box(f,u,base+.08,.28,.8*scale,.16,.65,stone);
    sculpture(statueFrame(...f.point(u,base+.12*scale,.22),f.angle,scale,.83),paint,'facade');
  }
  statue(w/2,roof+4.4,1,trim,tierLedges[0]);
  for(const u of [.095,.905])statue(w*u,roof+.18,1.05,'#969283',lowerLedge);
  function profile(points,paint) {
    const shape=new THREE.Shape();shape.moveTo(...points[0]);
    for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
    const g=own(new THREE.ExtrudeGeometry(shape,{depth:1.4,bevelEnabled:false,steps:1,curveSegments:8}));
    bake(g,...f.point(0,roof,-1.4),1,1,1,paint,f.angle,'solid');
  }
  // Concave shoulder curves bridge the broad lower front to the narrower upper wall.
  for(const side of [-1,1]) {
    const inner=w/2+side*w*.28,outer=w/2+side*w*.44;
    const points=[[inner,0],[outer,0]];
    for(let i=0;i<=12;i++){const t=i/12;points.push([outer+(inner-outer)*t,3.9*t*t]);}
    profile(points,CATHEDRAL_WALL);
  }
  const half=w*.31,base=7.9,peak=9.7;
  profile([[w/2-half,base],[w/2+half,base],[w/2,peak]],CATHEDRAL_WALL);
  moulding(w/2,roof+base-.1,half*2);
  // Sloping pediment trim is a single rotated box on each edge, with no texture/extra material.
  for(const side of [-1,1]) {
    const length=Math.hypot(half,peak-base),angle=Math.atan2(peak-base,half)*-side;
    bake(kit.box,...f.point(w/2+side*half/2,roof+(base+peak)/2,.19),length,.19,.38,trim,f.angle,'facade',angle);
  }
  box(f,w/2,roof+peak+.72,-.42,.17,1.6,.18,trim);
  box(f,w/2,roof+peak+.95,-.42,.94,.15,.18,trim);
}
