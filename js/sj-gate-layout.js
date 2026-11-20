/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Puerta de San Juan / Paseo del Morro — © 2026 VibezZzCoder, MIT. Wall/paths/coast/gate node: OSM / ODbL;
// heights: USGS DEM. Wikimedia Commons curid=81591499, curid=123113261, curid=81591500, curid=53594779, curid=151530324, curid=114692556, curid=80420013, curid=80420699, curid=122996449 guide forms; dimensions are authored inferences.
// Shared physical/render owner: every solid, floor and terrain cut here is drawn with the same numbers in sj-gate.js.
import {circle,segmentDistance,inRing} from './sj-plaza-layout.js';
import {subtractRing,signedArea} from './sj-paving.js';
import {wallBody} from './sj-fort-layout.js';
import {seamsFlight} from './sj-seams-geo.js';
import {registerStairFlights} from './sj-stairs.js';

// OSM 2306823907 (historic=city_gate) is the shared vertex of wall 119438994's two segments.
export const GATE_NODE=[-291.97,36.09];
// Wall 119438994 → 704106796, outward (+n) always the paseo/sea side:
// - Paseo del Morro extension (2026-11-15 morro pass): from Santa Elena's north flank (OSM vertex 7) round the Bastión
//   de Santa Elena (rounded tip simplified Douglas–Peucker 1.6 m: vertices 7,8,10,12,14,17), the long run to the
//   Bastión San Agustín salients (18,21,23–26), the 27–28 jog and the Paseo del Morro face to La Rogativa;
// - gate pass: the Rogativa re-entrant corner, the gate, the Fortaleza-side run, bastion north face and tip, then 15 m
//   of the bastion's Princesa-facing west face.
const TIP=[-300.27,79.71];
const SALIENTS=[[-779.01,-274.15],[-580.17,-74.21],[-517.7,-59.06]];
export const WALL_RUN=[[-766.85,-330.59],[-763.49,-306.77],[-780.01,-282.21],[-779.01,-274.15],[-774.04,-268.22],
  [-759.77,-265.79],[-691.33,-291.43],[-610.15,-196.75],[-563.26,-130.89],[-580.17,-74.21],[-517.7,-59.06],[-503.32,-80.22],
  [-426.71,-65.88],[-420.19,-73.21],[-316.84,-2.19],[-301.2,-2.55],GATE_NODE,[-286.12,57.5],[-281.57,73.21],TIP,[-302.117,94.596]];
const GATE_SEG=WALL_RUN.indexOf(GATE_NODE),TIP_SEG=WALL_RUN.indexOf(TIP);
// OSM 561590375 Paseo del Morro, from its El Morro end (barrier=gate node 5414831906) to the gate forecourt.
export const PASEO=[[-791.75,-688.87],[-790.18,-691.78],[-798.39,-693.03],[-810.85,-694.45],[-825.71,-692.26],[-834.08,-693.32],
  [-844.57,-695.29],[-851.78,-696.75],[-857.39,-693.5],[-863.22,-688.67],[-867.5,-683.68],[-872.19,-674.36],[-874.14,-665.63],
  [-874.34,-650.7],[-858.43,-579.18],[-854.78,-560.18],[-847.77,-541.7],[-841.69,-529.47],[-836.02,-500.46],[-835.37,-490.21],
  [-835.44,-484.1],[-838.08,-479.85],[-847.96,-460.86],[-852.4,-449.76],[-852.46,-437.81],[-849.05,-415.19],[-846.15,-406.7],
  [-837.17,-392.95],[-824.18,-373.08],[-811.36,-350.09],[-791.58,-326.9],[-787.12,-321.51],[-784.5,-313.95],[-785.13,-307.05],
  [-787.7,-299.69],[-793.27,-288.45],[-797.39,-278.18],[-797.07,-265.45],[-792.09,-256.41],[-786.1,-252.77],[-777.57,-249.75],
  [-769.67,-248.95],[-761.19,-251.36],[-704.29,-274.09],[-695.79,-275.83],[-687.72,-274.8],[-676.8,-267.97],[-623.16,-204.52],
  [-568.97,-135.93],[-567.22,-130.71],[-567.09,-125.75],[-571.21,-110.8],[-582.94,-78.41],[-583.91,-73.44],[-580.42,-65.36],
  [-572.52,-60.39],[-551.05,-51.01],[-538.06,-48.88],[-526.23,-51.84],[-504.12,-58.35],[-499.76,-61.33],[-495.15,-66.79],
  [-482.75,-71.94],[-424.75,-63.28],[-403.94,-54.75],[-366.18,-31.07],[-310.01,11.29],[-303.16,16.76],[-300.16,23.3],[-295.63,37.55]];
export const GATE_BOUNDS={minX:-362,maxX:-270,minZ:-32,maxZ:100};
const BATTER=1/7;            // horizontal per vertical, Wikimedia Commons curid=81591499, curid=114692556 battered face
const PARAPET={thick:.62,rise:.9,cordon:.32};
const SPACING=1.25,PLINTH={proud:.12,rise:.5};
// Wikimedia Commons curid=123113261, curid=81591499: the grassy bank in the Rogativa re-entrant corner keeps its DEM slope under a masonry crest band;
// elsewhere (Wikimedia Commons curid=114692556 Paseo del Morro, Wikimedia Commons curid=81591499 by the gate) the battered masonry reaches the paseo.
const faceMode=(k,t)=>k===GATE_SEG-2?0:k===GATE_SEG-1?Math.max(0,Math.min(1,(t-12)/4)):1;
// Portal/passage (Wikimedia Commons curid=81591499, curid=123113261, curid=81591500), metres. Opening/plaque/cornice ratios measured on Wikimedia Commons curid=123113261's near-frontal crop.
export const PORTAL={half:2.4,openHalf:1.2,openHeight:3.95,proud:.6,depth:.9};
// Wikimedia Commons curid=81591500: doors fold into an arched end recess; the plastered barrel vault beyond is wider and taller.
export const PASSAGE={half:2.1,recessHalf:1.5,recessDepth:1.35,recessSpring:3.1,spring:3.4,crown:4.8,clear:3.6,innerHalf:6.5,leaf:[1.36,1.46]};
const FLOOR_BAND=2.5;        // a passage floor serves riders below this height above it (SF grade-separation value)

// Ear clipping for simple polygons (x,z rings): overlay clipping and ring subtraction both require convex pieces.
export function convexPieces(ring) {
  let pts=ring.filter((p,i)=>Math.hypot(p[0]-ring[(i+1)%ring.length][0],p[1]-ring[(i+1)%ring.length][1])>1e-6);
  if(signedArea(pts)<0)pts=[...pts].reverse();
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),out=[];
  const inside=(p,a,b,c)=>cross(a,b,p)>1e-12&&cross(b,c,p)>1e-12&&cross(c,a,p)>1e-12;
  let guard=pts.length*pts.length;
  while(pts.length>3&&guard-->0){
    // Collinear points and hairline spikes (collapsed corner stations) carry no area: drop them first.
    const flat=pts.findIndex((b,i)=>Math.abs(cross(pts[(i+pts.length-1)%pts.length],b,pts[(i+1)%pts.length]))<1e-6);
    if(flat>=0){pts.splice(flat,1);continue;}
    let clipped=false;
    for(let i=0;i<pts.length;i++){const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
      if(cross(a,b,c)<=1e-12)continue;
      if(pts.some(p=>p!==a&&p!==b&&p!==c&&inside(p,a,b,c)))continue;
      out.push([a,b,c]);pts.splice(i,1);clipped=true;break;}
    if(!clipped)throw Object.assign(new Error('Gate surface ring is not simple'),{ring});
  }
  if(pts.length===3&&Math.abs(signedArea(pts))>1e-9)out.push(pts);
  // Hertel–Mehlhorn: greedily merge neighbours across shared edges while the union stays convex (fewer overlay pieces,
  // so fewer clipped terrain fragments and less construction work).
  // same merges in the same order as the plain all-pairs scan (first i, then j>i, then edge a
  // of A, then edge b of B), but point keys are formatted once per point object and candidate partners come from an
  // index of directed edges; pairs already found unmergeable are not re-tested after a restart (pieces are immutable).
  const keys=new Map(),key=p=>{let k=keys.get(p);if(k===undefined)keys.set(p,k=p[0].toFixed(6)+','+p[1].toFixed(6));return k;};
  const convex=r=>r.every((b,i)=>cross(r[(i+r.length-1)%r.length],b,r[(i+1)%r.length])>=-1e-9);
  const join=(A,B,a,b)=>{const ring=[...A.slice(a+1),...A.slice(0,a+1),...B.slice(b+2),...B.slice(0,b)].filter((p,k,r)=>key(p)!==key(r[(k+1)%r.length]));
    return ring.filter((p,k)=>Math.abs(cross(ring[(k+ring.length-1)%ring.length],p,ring[(k+1)%ring.length]))>1e-9);};
  if(out.length<=16){
    // Few pieces (most calls: small rings): the plain all-pairs scan is cheapest.
    for(let merged=true;merged;){merged=false;
      outer:for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){const A=out[i],B=out[j];
        for(let a=0;a<A.length;a++){const a0=key(A[a]),a1=key(A[(a+1)%A.length]);
          for(let b=0;b<B.length;b++)if(key(B[b])===a1&&key(B[(b+1)%B.length])===a0){const clean=join(A,B,a,b);
            if(clean.length>=3&&convex(clean)){out[i]=clean;out.splice(j,1);merged=true;break outer;}}}}}
    return out;
  }
  const edges=new Map(),index=piece=>{for(let b=0;b<piece.length;b++){const e=key(piece[b])+'>'+key(piece[(b+1)%piece.length]);
    let l=edges.get(e);if(!l)edges.set(e,l=[]);l.push(piece);}};
  const unindex=piece=>{for(let b=0;b<piece.length;b++){const e=key(piece[b])+'>'+key(piece[(b+1)%piece.length]),l=edges.get(e);l.splice(l.indexOf(piece),1);}};
  for(const piece of out)index(piece);
  const failed=new WeakMap(),tried=(A,B)=>failed.get(A)?.has(B);
  for(let merged=true;merged;){merged=false;
    for(let i=0;i<out.length&&!merged;i++){const A=out[i],order=new Map(out.map((p,n)=>[p,n]));
      // Partners j>i sharing a reversed edge, in ascending j; each tried with all its (a,b) matches in scan order.
      const partners=new Set();
      for(let a=0;a<A.length;a++)for(const B of edges.get(key(A[(a+1)%A.length])+'>'+key(A[a]))??[])if(order.get(B)>i&&!tried(A,B))partners.add(B);
      for(const B of [...partners].sort((p,q)=>order.get(p)-order.get(q))){
        for(let a=0;a<A.length&&!merged;a++){const a0=key(A[a]),a1=key(A[(a+1)%A.length]);
          for(let b=0;b<B.length;b++)if(key(B[b])===a1&&key(B[(b+1)%B.length])===a0){
            const clean=join(A,B,a,b);
            if(clean.length>=3&&convex(clean)){unindex(A);unindex(B);out[i]=clean;out.splice(order.get(B),1);index(clean);merged=true;break;}
          }}
        if(merged)break;
        let f=failed.get(A);if(!f)failed.set(A,f=new WeakSet());f.add(B);
      }
    }}
  return out;
}

function intersect(p,t,q,r) {
  const det=t[0]*r[1]-t[1]*r[0];
  if(Math.abs(det)<.12)return null; // nearly collinear: caller averages instead
  const k=((q[0]-p[0])*r[1]-(q[1]-p[1])*r[0])/det;return [p[0]+t[0]*k,p[1]+t[1]*k];
}

export function createGateLayout({height,terrain}) {
  const segs=[];
  {let s0=0;for(let i=0;i+1<WALL_RUN.length;i++){const a=WALL_RUN[i],b=WALL_RUN[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;segs.push({a,b,L,ux,uz,nx:-uz,nz:ux,s0});s0+=L;}}
  const gateS=segs[GATE_SEG].s0;
  // Passage frame: inward axis = −(mean outward normal of the two segments meeting at the mapped gate node).
  const mx=segs[GATE_SEG-1].nx+segs[GATE_SEG].nx,mz=segs[GATE_SEG-1].nz+segs[GATE_SEG].nz,ml=Math.hypot(mx,mz),ax=-mx/ml,az=-mz/ml,px=-az,pz=ax;
  const P=(u,v)=>[GATE_NODE[0]+ax*u+px*v,GATE_NODE[1]+az*u+pz*v];
  const UV=(x,z)=>{const dx=x-GATE_NODE[0],dz=z-GATE_NODE[1];return [dx*ax+dz*az,dx*px+dz*pz];};
  // Stations per segment (own normal, both ends); exact breaks where the ribbon meets the portal block's sides.
  for(const [k,g] of segs.entries()) {
    const cuts=[0,g.L];
    if(k===GATE_SEG-1||k===GATE_SEG){const v0=UV(...g.a)[1],dv=g.ux*px+g.uz*pz;for(const v of [-PORTAL.half-.04,PORTAL.half+.04]){const t=(v-v0)/dv;if(t>.05&&t<g.L-.05)cuts.push(t);}}
    // Extension segments use 2 m stations (phone geometry budget: ~1.2 km of wall); the gate stretch keeps 1.25 m.
    cuts.sort((p,q)=>p-q);g.stations=[];g.spacing=k<GATE_SEG-3?2:SPACING;
    for(let i=0;i+1<cuts.length;i++){const n=Math.max(1,Math.ceil((cuts[i+1]-cuts[i])/g.spacing));
      for(let j=0;j<n;j++){const t=cuts[i]+(cuts[i+1]-cuts[i])*j/n;g.stations.push({x:g.a[0]+g.ux*t,z:g.a[1]+g.uz*t,t,s:g.s0+t,seg:k,nx:g.nx,nz:g.nz});}}
    g.stations.push({x:g.b[0],z:g.b[1],t:g.L,s:g.s0+g.L,seg:k,nx:g.nx,nz:g.nz});
  }
  const sample=(s,d)=>height(s.x+s.nx*d,s.z+s.nz*d);
  const off=(s,d)=>[s.x+s.nx*d,s.z+s.nz*d];
  // A station only reads DEM points nearer its own wall segment than any other: at re-entrant corners the normal
  // otherwise runs into the neighbouring wall's plateau/scarp and drags this face far out.
  // Samples lie within ~10 m of their own segment, so only segments within 22 m of it can be nearer (phone cost).
  const box=g=>({minX:Math.min(g.a[0],g.b[0]),maxX:Math.max(g.a[0],g.b[0]),minZ:Math.min(g.a[1],g.b[1]),maxZ:Math.max(g.a[1],g.b[1])});
  const near=segs.map((g,k)=>{const A=box(g);return segs.map((h,j)=>j).filter(j=>{if(j===k)return false;const B=box(segs[j]);
    return Math.max(B.minX-A.maxX,A.minX-B.maxX,B.minZ-A.maxZ,A.minZ-B.maxZ)<22;});});
  const owns=(s,d)=>{const nr=near[s.seg];if(!nr.length)return true;const [x,z]=off(s,d),mine=segmentDistance(x,z,segs[s.seg].a,segs[s.seg].b);
    return nr.every(j=>segmentDistance(x,z,segs[j].a,segs[j].b)+.25>=mine);};
  for(const g of segs)for(const s of g.stations) {
    // Plateau (rampart/terreplein) height just inside the mapped line.
    // Robust plateau level (70th percentile), not a local bump: it sets the crest, wall walk and band height.
    const plateau=[];for(let d=-6;d<=0;d+=.25)if(owns(s,d))plateau.push(sample(s,d));
    plateau.sort((p,q)=>p-q);let top=plateau.length?plateau[Math.floor(plateau.length*.7)]:sample(s,0);
    // Extension only: where the mapped line lies well seaward of the DEM scarp (San Agustín's west face, ~8 m) the
    // ground is still climbing steeply 4–6 m in; then read the plateau 5–12 m in instead.
    if(s.seg<GATE_SEG-3&&owns(s,-6)&&sample(s,-6)-sample(s,-4)>.8){const far=[];
      for(let d=-12;d<=-5;d+=.25)if(owns(s,d))far.push(sample(s,d));far.sort((p,q)=>p-q);
      if(far.length)top=Math.max(top,far[Math.floor(far.length*.7)]);}
    // Toe of the steep DEM scarp: first point outward where the next metre falls less than 0.32 m.
    let foot=-1;
    for(;foot<9;foot+=.125){const h=sample(s,foot);if(!owns(s,foot+1)||h<top-2.5&&h-sample(s,foot+1)<.32)break;}
    const ground=sample(s,foot),blend=faceMode(s.seg,s.t);
    const base=ground*blend+(top-2.6)*(1-blend),tolerance=blend>0?PLINTH.rise*.6:.12;
    // Every DEM point higher than the plinth can hide must lie behind the battered face plane.
    // Sample five parallel lines spanning half an interval either side: the 2 m DEM's diagonal facets otherwise bulge
    // out between 1.25 m stations.
    let need=-6;
    // 2 m extension stations sample seven parallel lines (0.33 m apart) so DEM facets between stations stay covered.
    for(const dt of g.spacing>SPACING?[-1,-.67,-.33,0,.33,.67,1]:[-.62,-.31,0,.31,.62]){if(s.t+dt<0||s.t+dt>g.L)continue;const q={...s,x:s.x+g.ux*dt,z:s.z+g.uz*dt};
      // Extension: also cover DEM bumps up to 2.5 m beyond the toe (the face envelope often stands past the toe there).
      for(let d=-8;d<=Math.max(foot,0)+(s.seg<GATE_SEG-3?2.5:0)+.001;d+=.125){if(!owns(q,d))continue;const h=sample(q,d);if(h>base+tolerance)need=Math.max(need,d+(h-base)*BATTER);}}
    Object.assign(s,{top,ground,base,need:need+.05,full:blend>0,v:UV(s.x,s.z)[1]});
  }
  // Extension crest: a level bastion terreplein does not dip at its salient (the 2 m DEM smears narrow tips low), so the
  // crest may fall at most 0.12 m per metre of wall; genuine along-wall grades (Santa Elena flank ~0.09) are kept.
  {const ext=segs.filter((g,k)=>k<GATE_SEG-3).flatMap(g=>g.stations),base0=ext.map(s=>s.top);
    for(let pass=0;pass<2;pass++){for(let i=1;i<ext.length;i++)ext[i].top=Math.max(ext[i].top,ext[i-1].top-.12*Math.abs(ext[i].s-ext[i-1].s));
      for(let i=ext.length-2;i>=0;i--)ext[i].top=Math.max(ext[i].top,ext[i+1].top-.12*Math.abs(ext[i+1].s-ext[i].s));}
    ext.forEach((s,i)=>s.lifted=s.top-base0[i]);}
  // The 2 m DEM smear makes the toe jitter by >1 m between 1.25 m stations. A per-face slope-limited upper envelope
  // keeps every point covered while the face can only bulge gently (≤0.25 m per metre of wall).
  for(const g of segs){const st=g.stations,d=st.map(s=>s.need);
    for(let pass=0;pass<2;pass++){for(let i=1;i<st.length;i++)d[i]=Math.max(d[i],d[i-1]-.25*(st[i].t-st[i-1].t));
      for(let i=st.length-2;i>=0;i--)d[i]=Math.max(d[i],d[i+1]-.25*(st[i+1].t-st[i].t));}
    st.forEach((s,i)=>s.dFoot=d[i]);}
  for(const g of segs){
    for(const s of g.stations){const base=Math.min(s.base,sample(s,s.dFoot)),crest=s.top+.06-PARAPET.cordon,dTop=s.dFoot-(crest-base)*BATTER;
      // Wall walk covers the DEM's smeared crest from the parapet back to the true plateau.
      let dIn=dTop;for(;dIn>dTop-3.5;dIn-=.125)if(!owns(s,dIn-.125)||sample(s,dIn)>=s.top-.12)break;
      Object.assign(s,{dIn:dIn-.3});}
    // Same slope-limited envelope for the inner edge (inward only): no zigzag kerb along the rampart walk.
    const st=g.stations,d=st.map(s=>-s.dIn);
    for(let pass=0;pass<2;pass++){for(let i=1;i<st.length;i++)d[i]=Math.max(d[i],d[i-1]-.35*(st[i].t-st[i-1].t));
      for(let i=st.length-2;i>=0;i--)d[i]=Math.max(d[i],d[i+1]-.35*(st[i+1].t-st[i].t));}
    st.forEach((s,i)=>s.dIn=-d[i]);
  }
  for(const g of segs)for(const s of g.stations) {
    const base=Math.min(s.base,sample(s,s.dFoot)),crest=s.top+.06-PARAPET.cordon,dTop=s.dFoot-(crest-base)*BATTER,dIn=s.dIn;
    let cover=-Infinity;for(let q=dIn;q<=dTop;q+=.125)cover=Math.max(cover,sample(s,q));
    const bottom=Math.min(base,sample(s,s.dFoot+PLINTH.proud))-.4,dBot=s.dFoot+(base-bottom)*BATTER;
    Object.assign(s,{base,crest,dTop,dIn,bottom,walk:Math.max(s.top+.06,cover+.04),
      F:off(s,s.dFoot),B:off(s,dBot),L:off(s,s.dFoot+PLINTH.proud),LB:off(s,dBot+PLINTH.proud),T:off(s,dTop),
      C:off(s,dTop+.2),Q:off(s,dTop-PARAPET.thick),W:off(s,dIn)});
  }
  // Corners: both faces meet where their actual plan polylines cross (enveloped offsets curve, so straight
  // extensions of the end stations miss it); if they never cross (convex outer lines), extend the end spans to meet.
  // Stations overshooting the meeting point collapse onto it, so no ribbon/prism/paving ring folds back.
  const ends=[];
  const segHit=(a,b,c,d)=>{const den=(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]);if(Math.abs(den)<1e-12)return null;
    const t=((c[0]-a[0])*(d[1]-c[1])-(c[1]-a[1])*(d[0]-c[0]))/den,u=((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))/den;
    return t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9?[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]:null;};
  for(let k=0;k+1<segs.length;k++){
    const A=segs[k].stations,B=segs[k+1].stations;
    for(const key of ['F','B','L','LB','T','C','Q','W']){
      let hit=null;
      for(let i=A.length-2;i>=Math.max(0,A.length-10)&&!hit;i--)for(let j=0;j<Math.min(B.length-1,10)&&!hit;j++){
        const x=segHit(A[i][key],A[i+1][key],B[j][key],B[j+1][key]);if(x&&!(i===A.length-2&&j===0&&Math.hypot(x[0]-A.at(-1)[key][0],x[1]-A.at(-1)[key][1])<1e-9))hit={i,j,x};}
      if(hit){for(let m=hit.i+1;m<A.length;m++)A[m][key]=[...hit.x];for(let m=0;m<=hit.j;m++)B[m][key]=[...hit.x];continue;}
      const ta=[A.at(-1)[key][0]-A.at(-2)[key][0],A.at(-1)[key][1]-A.at(-2)[key][1]],tb=[B[1][key][0]-B[0][key][0],B[1][key][1]-B[0][key][1]];
      const la=Math.hypot(...ta),lb=Math.hypot(...tb);
      const mid=[(A.at(-1)[key][0]+B[0][key][0])/2,(A.at(-1)[key][1]+B[0][key][1])/2];
      let x=(la>1e-9&&lb>1e-9?intersect(A.at(-1)[key],[ta[0]/la,ta[1]/la],B[0][key],[tb[0]/lb,tb[1]/lb]):null)??mid;
      // Convex bastion salients whose faces stand at very different offsets (Santa Elena tip, San Agustín) would meet
      // 5–13 m out, almost on the paseo: beyond 2.5 m from either end the corner becomes a short chamfer instead.
      if(Math.hypot(x[0]-A.at(-1)[key][0],x[1]-A.at(-1)[key][1])>2.5||Math.hypot(x[0]-B[0][key][0],x[1]-B[0][key][1])>2.5)x=mid;
      A.at(-1)[key]=x;B[0][key]=[...x];
      // With very different face offsets (the Rogativa corner: 7 m smear vs a 3 m crest band) the spans meet behind
      // the vertex; trim the overshooting stations by their position along each wall axis.
      const sa=segs[k],sb=segs[k+1],along=(p,g)=>(p[0]-g.a[0])*g.ux+(p[1]-g.a[1])*g.uz;
      for(const q of A)if(along(q[key],sa)>along(x,sa))q[key]=[...x];
      for(const q of B)if(along(q[key],sb)<along(x,sb))q[key]=[...x];
    }
    const a=A.at(-1),b=B[0];
    for(const key of ['crest','walk'])a[key]=b[key]=Math.max(a[key],b[key]);
    if(a.full===b.full)a.bottom=b.bottom=Math.min(a.bottom,b.bottom);
    a.corner=b.corner=k+1;
    // A full-height face meeting a crest band gets a masonry end, not an open sheet edge.
    if(a.full!==b.full)ends.push(a.full?{s:a,dir:1}:{s:b,dir:-1});
  }
  // Corner trimming can stretch the first/last interval (10 m under La Rogativa). Subdivide long intervals and let
  // every face bottom reach below the actual DEM at its foot, so no band or face floats over a lower bank.
  const lerp=(p,q,t)=>Array.isArray(p)?[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]:p+(q-p)*t;
  const NUM=['x','z','s','t','v','top','ground','base','crest','walk','dFoot','dTop','dIn'],KEYS=['F','B','L','LB','T','C','Q','W'];
  for(const g of segs){const out=[];
    g.stations.forEach((a,i)=>{out.push(a);const b=g.stations[i+1];if(!b)return;
      const span=Math.max(...['F','T','B'].map(key=>Math.hypot(b[key][0]-a[key][0],b[key][1]-a[key][1]))),n=span>1.8*g.spacing?Math.ceil(span/g.spacing):1;
      for(let j=1;j<n;j++){const t=j/n,q={seg:a.seg,nx:a.nx,nz:a.nz,full:a.full&&b.full,inserted:true};
        for(const key of [...NUM,...KEYS])q[key]=lerp(a[key],b[key],t);q.bottom=Math.min(a.bottom,b.bottom);out.push(q);}});
    g.stations=out;}
  for(const g of segs)for(const s of g.stations)s.bottom=Math.min(s.bottom,height(...s.F)-.4,height(...s.B)-.4,height(...s.L)-.4);
  const stations=segs.flatMap(g=>g.stations);
  // Inner kerb of the raised wall walk reaches the actual DEM at its edge (the bastion plateau sits lower).
  for(const s of stations)s.kerb=Math.min(s.walk-.45,height(...s.W)-.1);
  // Portal sits proud of every adjacent face station, so the masonry never overtakes its sides.
  const portalStations=stations.filter(s=>Math.abs(s.v)<PORTAL.half+1.3&&Math.abs(s.s-gateS)<5);
  const uFoot=Math.min(...portalStations.map(s=>UV(...s.F)[0]));
  const uFront=uFoot-PORTAL.proud,uDoor=uFront+PORTAL.depth,uChamber=uDoor+PASSAGE.recessDepth;
  const uBack=Math.max(...portalStations.map(s=>UV(...s.T)[0]))+.05;
  const across3=[-PASSAGE.half,0,PASSAGE.half];
  // Outer floor: paseo in front of the portal. Inner floor: Caleta de San Juan street level beyond the inner scarp.
  const outerY=Math.max(...across3.map(v=>height(...P(uFront-1.6,v))));
  let innerY=Infinity;
  for(let u=uChamber+4;u<20;u+=.125){const ys=across3.map(v=>height(...P(u,v)));if(Math.max(...ys)<outerY+2.6){innerY=ys.sort((p,q)=>p-q)[1];break;}}
  // Inner face: first station from the plateau where the whole width has descended (the street keeps rising east).
  let uInner=uChamber+4;
  for(let u=uChamber+4;u<20;u+=.125){let high=false;for(let v=-PASSAGE.half;v<=PASSAGE.half;v+=.25)high||=height(...P(u,v))>innerY+.6;
    if(!high){uInner=u+.05;break;}}
  const uOut=uFront-1.6,uIn=uInner+1.4;
  const floorAt=u=>u<=uFront?outerY:u>=uInner?innerY:outerY+(innerY-outerY)*(u-uFront)/(uInner-uFront);
  // Exact terrain at both mouth edges (five points across) so the authored floor meets the shared heightfield.
  const across=[-PASSAGE.half-.03,-1.05,0,1.05,PASSAGE.half+.03];
  const edge=u=>across.map(v=>{const [x,z]=P(u,v);return [x,height(x,z)+.015,z];});
  const line=(u,y)=>across.map(v=>{const [x,z]=P(u,v);return [x,y,z];});
  // Portal-face row: its outer corners rise to meet the ground where the DEM beside the mouth stands above the floor
  // (5 cm on the north side); otherwise the open cut edge shows between paving and floor.
  const front=line(uFront,floorAt(uFront)).map((q,i)=>i===0||i===across.length-1?[q[0],Math.max(q[1],height(q[0],q[2])+.006),q[2]]:q);
  const rows=[[uOut-.03,edge(uOut-.03)],[uFront,front],[uChamber,line(uChamber,floorAt(uChamber))],
    [uInner,line(uInner,floorAt(uInner))],[uIn+.03,edge(uIn+.03)]];
  const tops=[],floorTriangles=[];
  for(let r=0;r+1<rows.length;r++){
    const [ua,A]=rows[r],[ub,B]=rows[r+1],covered=ua>=uFront-1e-6&&ub<=uInner+1e-6;
    // Counter-clockwise from above (u inward, v toward the Fortaleza side): drawn faces point up.
    for(let i=0;i+1<A.length;i++)for(const tri of [[A[i],B[i+1],B[i]],[A[i],A[i+1],B[i+1]]]){
      floorTriangles.push(tri);
      // Plane through the triangle: y = y0 + dx*(x-x0) + dz*(z-z0).
      const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      tops.push({poly:tri.map(t=>({x:t[0],z:t[2]})),top:Math.max(p[1],q[1],w[1]),plane:{x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny},
        replacesTerrain:true,maxReferenceY:Math.max(p[1],q[1],w[1])+FLOOR_BAND,surface:'pavement',source:'gate:passage',
        ...(covered?{ceilingOffset:PASSAGE.clear}:{})});
    }
  }
  // Outer floor sides in front of the portal stand a few cm above the paving and the cut: short skirts close the lip so
  // the cut (and the water below it) never shows through. Behind uFront the block hides them.
  const skirts=[];
  for(const i of [0,across.length-1]){const [a,b]=[rows[0][1][i],rows[1][1][i]],out=Math.sign(across[i]);
    const a2=[a[0],a[1]-.5,a[2]],b2=[b[0],b[1]-.5,b[2]];
    // Outward-facing winding: for +v the order a,b,b2 faces +v when the passage axis points +u.
    skirts.push(...(out>0?[[a,b2,b],[a,a2,b2]]:[[a,b,b2],[a,b2,a2]]));}
  // Render-only terrain subtraction: the floor footprint below a ceiling above the vault, under the kept rampart.
  const cutTop=Math.max(outerY,innerY)+PASSAGE.crown+1.1;
  const corners=[P(uOut,-PASSAGE.half),P(uOut,PASSAGE.half),P(uIn,PASSAGE.half),P(uIn,-PASSAGE.half)];
  const along=ax*GATE_NODE[0]+az*GATE_NODE[1],side=px*GATE_NODE[0]+pz*GATE_NODE[1];
  const cuts=[{minX:Math.min(...corners.map(c=>c[0])),maxX:Math.max(...corners.map(c=>c[0])),
    minZ:Math.min(...corners.map(c=>c[1])),maxZ:Math.max(...corners.map(c=>c[1])),
    // inside ⇔ a·x+b·y+c·z+d > 0 for every plane
    planes:[[ax,0,az,-along-uOut],[-ax,0,-az,along+uIn],[px,0,pz,-side+PASSAGE.half],[-px,0,-pz,side+PASSAGE.half],[0,-1,0,cutTop]]}];

  const colliders=[];
  const prism=(outer,minY,maxY,support=false)=>{if(Math.abs(signedArea(outer))<1e-4)return null; // collapsed corner interval
    const c={outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support};colliders.push(c);return c;};
  const quad=(u0,u1,v0,v1)=>[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)];
  // Wall body + parapet per station interval; the portal interval's body only exists above the passage cut.
  const walls=[],walkTops=[];
  for(const g of segs)for(let i=0;i+1<g.stations.length;i++){
    const a=g.stations[i],b=g.stations[i+1],mid=UV((a.x+b.x)/2,(a.z+b.z)/2),portal=Math.abs(mid[1])<PORTAL.half&&Math.abs(mid[0])<6;
    const walk=Math.max(a.walk,b.walk);walls.push({a,b,portal,walk});
    // Stairs round (public footway 270140128 runs on this walk, from the 270140129 stair top south): there the body's flat
    // top stood up to 0.4 m above the drawn sloped walk and stepped between intervals. On those intervals the body stops at
    // the lower end's walk and the drawn walk quad (Q→W) itself is the replacement top: physics = the drawn walk.
    const onWalkWay=!portal&&[a,b].every(q=>segmentDistance((q.Q[0]+q.W[0])/2,(q.Q[1]+q.W[1])/2,[-290.83,27.55],[-300.2,-5.6])<2.5);
    if(onWalkWay){wallBody(prism,a,b,Math.min(a.bottom,b.bottom)-.2,Math.min(a.walk,b.walk)-.01);
      const A=[[...a.Q],[...b.Q],[...b.W],[...a.W]].map((q,k)=>[q[0],k===1||k===2?b.walk:a.walk,q[1]]);
      for(let tri of [[A[0],A[1],A[2]],[A[0],A[2],A[3]]]){const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(Math.abs(ny)<1e-9)continue;
        walkTops.push({poly:tri.map(t3=>({x:t3[0],z:t3[2]})),top:Math.max(p[1],q[1],w[1]),plane:{x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny},
          replacesTerrain:true,maxReferenceY:Math.max(p[1],q[1],w[1])+FLOOR_BAND,surface:'pavement',source:'gate:walk-270140128'});}}
    else if(portal)prism([a.T,b.T,b.W,a.W],cutTop,walk,true);else wallBody(prism,a,b,Math.min(a.bottom,b.bottom)-.2,walk);
    // Parapet colliders are full-height masonry down into the wall body: a stepped walk or corner ground can never
    // leave an elevated bar for the wheel to pass beneath (donor controller sweeps at pedal height).
    prism([a.T,b.T,b.Q,a.Q],Math.min(a.crest,b.crest)-1.5,walk+PARAPET.rise);
  }
  tops.push(...walkTops);
  const g0=stations.reduce((best,s)=>Math.abs(s.s-gateS)<Math.abs(best.s-gateS)?s:best);
  const portalY=floorAt(uFront),portalTop=g0.walk+.5;
  // Block footing: below the lowest ground under the pilasters (the paseo dips north of the mouth), so the bore cut
  // never shows through a gap beneath the red block.
  let portalBottom=portalY-.3;
  for(let u=uFront-.1;u<=uBack;u+=.2)for(const v of [-PORTAL.half-.05,-2.25,2.25,PORTAL.half+.05])portalBottom=Math.min(portalBottom,height(...P(u,v))-.3);
  // Red portal block either side of the doorway, its lintel mass, then recess/chamber sides and door leaves.
  for(const s of [-1,1]){
    const lo=v=>s<0?-v[1]:v[0],hi=v=>s<0?-v[0]:v[1];
    prism(quad(uFront,uDoor,lo([PORTAL.openHalf,PORTAL.half]),hi([PORTAL.openHalf,PORTAL.half])),portalBottom,portalTop);
    prism(quad(uDoor,uChamber,lo([PASSAGE.recessHalf,PORTAL.half]),hi([PASSAGE.recessHalf,PORTAL.half])),portalBottom,cutTop);
    prism(quad(uChamber,uInner,lo([PASSAGE.half,PASSAGE.half+.9]),hi([PASSAGE.half,PASSAGE.half+.9])),Math.min(portalY,innerY)-.3,cutTop);
    prism(quad(uDoor+.05,uDoor+1.25,lo(PASSAGE.leaf),hi(PASSAGE.leaf)),portalY-.05,portalY+3.85);
  }
  prism(quad(uFront,uChamber,-PORTAL.openHalf,PORTAL.openHalf),portalY+PORTAL.openHeight,portalTop);
  // Inner face over the street, a masonry cap from the plateau edge to it (the DEM there lies below the cut), and a
  // parapet on its rim. Short kerbs retain the raised park terrain beside the inner mouth.
  let capFrom=uInner;for(let u=uInner;u>uChamber;u-=.125)if(across3.every(v=>height(...P(u,v))>=cutTop+.15)){capFrom=u;break;}
  let innerTop=-Infinity;for(let u=capFrom-1;u<=uInner;u+=.25)for(const v of [-PASSAGE.innerHalf,0,PASSAGE.innerHalf])innerTop=Math.max(innerTop,height(...P(u,v)));
  // Bottom follows the street/park terrain just outside the face (the raised park meets it south of the mouth).
  const footProfile=Array.from({length:27},(_,i)=>{const v=-PASSAGE.innerHalf+i*PASSAGE.innerHalf/13;
    return [v,Math.abs(v)<=PASSAGE.half?innerY-.4:Math.min(innerY,height(...P(uInner+.15,v)))-.4];});
  const inner={u:uInner,y:innerY,capFrom:capFrom-.4,top:Math.max(innerTop,cutTop+.3)+.06,footProfile};
  for(const s of [-1,1])prism(quad(uInner-.6,uInner,s<0?-PASSAGE.innerHalf:PASSAGE.half,s<0?-PASSAGE.half:PASSAGE.innerHalf),innerY-.4,inner.top);
  prism(quad(uInner-.6,uInner,-PASSAGE.half,PASSAGE.half),innerY+PASSAGE.crown,inner.top);
  prism(quad(inner.capFrom,uInner-.6,-PASSAGE.innerHalf,PASSAGE.innerHalf),cutTop-.1,inner.top,true);
  prism(quad(uInner-.55,uInner,-PASSAGE.innerHalf,PASSAGE.innerHalf),inner.top-.05,inner.top+PARAPET.rise);
  const kerbs=[];
  for(const s of [-1,1]){let m=floorAt(uInner);for(let u=uInner;u<=uIn;u+=.125)for(const v of [2.1,2.3,2.45])m=Math.max(m,height(...P(u,s*v)));
    kerbs.push({side:s,top:m+.05});prism(quad(uInner,uIn,s<0?-2.45:PASSAGE.half,s<0?-PASSAGE.half:2.45),innerY-.4,m+.05);}

  // Paseo dressing anchored to the photographed composition (Wikimedia Commons curid=81591499, curid=123113261, curid=80420013): seawall garita at the bend,
  // corner garita on the bastion tip, white-capped bollards on the north path edge, rip-rap below.
  const seawall=[[-300.85,35.4],[-301.2,37.6],[-300.6,42],[-300.8,48],[-301.0,54],[-301.3,60],[-302.0,66],[-303.6,72.4],[-305.6,78],[-307.0,86],[-307.5,94]];
  const seaTop=seawall.map(([x,z])=>{let m=-Infinity;for(const d of [.35,.6,.9])m=Math.max(m,height(x+d,z));return m+.78;});
  const seaFrame=seawall.map((p,i)=>{const q=seawall[Math.min(i+1,seawall.length-1)],o=seawall[Math.max(i-1,0)],dx=q[0]-o[0],dz=q[1]-o[1],l=Math.hypot(dx,dz);
    return {x:p[0],z:p[1],nx:dz/l,nz:-dx/l};}); // +n = inland (east) side
  const seaBottom=seaFrame.map(f=>Math.min(height(f.x-f.nx*.6,f.z-f.nz*.6),height(f.x+f.nx*.4,f.z+f.nz*.4))-.4);
  for(let i=0;i+1<seawall.length;i++){
    const a=seaFrame[i],b=seaFrame[i+1],o=(f,d)=>[f.x+f.nx*d,f.z+f.nz*d];
    prism([o(a,-.28),o(b,-.28),o(b,.28),o(a,.28)],Math.min(seaBottom[i],seaBottom[i+1]),Math.max(seaTop[i],seaTop[i+1]));
  }
  const garitas=[];
  {const f=seaFrame[1],x=f.x-f.nx*.55,z=f.z-f.nz*.55,y=seaTop[1]-.05;
    garitas.push({x,z,y,radius:.82,body:2.25,corbel:.55,wallNx:-f.nx,wallNz:-f.nz,kind:'seawall'});
    prism(circle(x,z,.88,14),height(x,z)-.4,y+2.25+.9);}
  // Corner garitas sit on the salient's crest. Wikimedia Commons curid=80420699: the bastion tip by the Princesa; Wikimedia Commons curid=82863744: the Santa Elena salient;
  // Wikimedia Commons curid=114692556, curid=116769039 show further salient garitas along the paseo (the two San Agustín salients are inferred, unverified).
  const cornerGarita=k=>{const tip=segs[k-1].stations.at(-1),mx=segs[k-1].nx+segs[k].nx,mz=segs[k-1].nz+segs[k].nz,l=Math.hypot(mx,mz);
    const x=tip.T[0]+mx/l*.35,z=tip.T[1]+mz/l*.35,y=tip.walk-.55;
    garitas.push({x,z,y,radius:.8,body:2.15,corbel:1.15,wallNx:mx/l,wallNz:mz/l,kind:'corner'});
    prism(circle(x,z,.86,14),y-.05,y+2.15+.95);};
  cornerGarita(TIP_SEG);
  for(const v of SALIENTS)cornerGarita(WALL_RUN.findIndex(p=>p[0]===v[0]&&p[1]===v[1]));
  // OSM 561590375 Paseo del Morro (Wikimedia Commons curid=123113261, curid=114692556, curid=82863744, curid=116769039). The 2 m DEM smears each wall's scarp 2–9 m seaward and the fitted
  // face follows it, so wherever the mapped line lies within 1.9 m of a full face's foot (or behind it) the 3.4 m strip
  // is pushed clear of the foot; elsewhere it keeps the mapped line. Light smoothing, re-pushed after each pass.
  const feet=stations.filter(s=>s.full),footCells=new Map(),cellOf=(x,z)=>Math.floor(x/8)*4096+Math.floor(z/8);
  for(const s of feet){const k=cellOf(...s.F);if(!footCells.has(k))footCells.set(k,[]);footCells.get(k).push(s);}
  const feetNear=(x,z,r)=>{const out=[],n=Math.ceil(r/8);for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++)out.push(...(footCells.get(cellOf(x+i*8,z+j*8))??[]));return out;};
  const clearOfWall=p=>{let push=0,dir=null;
    for(const s of feetNear(p[0],p[1],14)){const dx=p[0]-s.F[0],dz=p[1]-s.F[1];if(dx*dx+dz*dz>196)continue;
      const g=segs[s.seg],along=dx*g.ux+dz*g.uz,d=dx*s.nx+dz*s.nz;
      if(Math.abs(along)>segs[s.seg].spacing*.75||d<-14||2.05-d<=push)continue;push=2.05-d;dir=[s.nx,s.nz];}
    return dir?[p[0]+dir[0]*push,p[1]+dir[1]*push]:p;};
  let path=[];
  for(let i=0;i+1<PASEO.length;i++){const a=PASEO[i],b=PASEO[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    for(let j=0;j<n;j++)path.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
  path.push([...PASEO.at(-1)]);path=path.map(clearOfWall);
  for(let pass=0;pass<3;pass++)path=path.map((p,i)=>i===0||i===path.length-1?p:
    clearOfWall([(path[i-1][0]+2*p[0]+path[i+1][0])/4,(path[i-1][1]+2*p[1]+path[i+1][1])/4]));
  path=path.reduce((out,p)=>{if(!out.length||Math.hypot(p[0]-out.at(-1)[0],p[1]-out.at(-1)[1])>.6)out.push(p);return out;},[]);
  // Douglas–Peucker (0.12 m, pieces ≤ 14 m): straight runs become single strip pieces (fewer overlay cuts on phones);
  // with the 2.05 m push, chords stay ≥1.9 m clear of every wall foot.
  const keep=new Uint8Array(path.length);keep[0]=keep[path.length-1]=1;
  const dp=(i,j)=>{const a=path[i],b=path[j],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;let m=-1,k=-1;
    for(let q=i+1;q<j;q++){const d=Math.abs((b[0]-a[0])*(a[1]-path[q][1])-(a[0]-path[q][0])*(b[1]-a[1]))/L;if(d>m){m=d;k=q;}}
    if(k>0&&(m>.12||L>14)){keep[k]=1;dp(i,k);dp(k,j);}};
  dp(0,path.length-1);path=path.filter((p,i)=>keep[i]);
  // Seaward-edge bollards: Wikimedia Commons curid=123113261 (2017) white-capped posts ~2.6 m apart on the gate stretch; Wikimedia Commons curid=82863744, curid=116769039 show sparser
  // posts along the rest of the paseo (spacing inferred ~6 m). Offset (−uz,ux) is seaward along the whole path.
  const bollards=[];
  for(let i=0,carry=1.3;i+1<path.length;i++){const a=path[i],b=path[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
    let t=carry;
    for(;t<L;t+=a[0]>-372?2.6:6.2){const x=a[0]+ux*t-uz*1.85,z=a[1]+uz*t+ux*1.85;
      if(z<=33.5&&height(x,z)>.3)bollards.push({x,z,y:height(x,z)});}
    carry=t-L;}
  // a standing part's base 3 cm under the lowest ground of its whole footprint.
  const groundLow=(x,z,r)=>{let lo=height(x,z);for(const f of [1,.5])for(let k=0;k<12;k++){const a=k*Math.PI/6;lo=Math.min(lo,height(x+Math.cos(a)*r*f,z+Math.sin(a)*r*f));}return lo;};
  for(const b of bollards)b.foot=Math.min(b.y,groundLow(b.x,b.z,.08))-.05;   // drawn post: foot → y+.68 (top unchanged); 5 cm toe (the paseo floor runs ~2 cm under the DEM)
  for(const b of bollards)colliders.push({centre:{x:b.x,y:b.y+.4,z:b.z},halfExtents:{x:.13,y:.4,z:.13},rotationY:0,surface:'pavement'});
  // Rip-rap (Wikimedia Commons curid=123113261, curid=114692556, curid=82863744, curid=116769039): moved to area `coast`, which lays it as an embedded, low, irregular
  // band on the finished shore ground (strips, bank diagonals) it owns; see sj-coast-layout.js `stones`. Kept as an
  // empty list for older readers.
  const rocks=[];
  // Forecourt (Wikimedia Commons curid=81591499): one large broadleaf tree in a raised round planter seaward of a clear wall-side lane, two
  // tall palms and lamps along the wall foot, benches facing the bay. Wall-relative items follow the fitted face.
  const at=(s,d)=>{const st=stations.reduce((b,q)=>Math.abs(q.s-s)<Math.abs(b.s-s)?q:b);const [x,z]=off(st,st.dFoot+d);return {x,z,y:height(x,z)};};
  const planter={x:-296.6,z:51.0,radius:2.4};
  const ring=circle(planter.x,planter.z,planter.radius,20);
  planter.y=Math.max(...ring.map(p=>height(...p)))+.45;planter.foundation={minY:Math.min(...ring.map(p=>height(...p)))-.12,maxY:planter.y};
  prism(ring,planter.foundation.minY,planter.y);
  const palms=[[gateS+6.5,1.1,10.6],[gateS+25.5,1.15,11.4]].map(([s,d,h])=>({...at(s,d),height:h,radius:.2,lean:.35}));
  // Wikimedia Commons curid=80420696, curid=82863744, curid=116769039: palms with broadleaf trees beside the paseo/wall. Small deterministic groups on fairly level low
  // ground between the strip and a wall foot ≥7 m away, at least 55 m apart (positions inferred; counts kept small).
  for(let i=2,last=-1e9,run=0;i+2<path.length;i++){const p=path[i],q=path[i+1];run+=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(run-last<55||p[0]>-372)continue;
    const l=Math.hypot(q[0]-p[0],q[1]-p[1]),nx=(q[1]-p[1])/l,nz=-(q[0]-p[0])/l; // landward = −seaward
    const x=p[0]+nx*4.4,z=p[1]+nz*4.4,y=height(x,z),slope=Math.hypot(height(x+.7,z)-height(x-.7,z),height(x,z+.7)-height(x,z-.7))/1.4;
    const foot=feetNear(p[0],p[1],26).reduce((b,s)=>Math.min(b,Math.hypot(s.F[0]-p[0],s.F[1]-p[1])),Infinity);
    if(foot<7||foot>26||slope>.35||y>height(...p)+1.2||y<.6)continue;
    last=run;palms.push({x,z,y,height:9.5+(palms.length%3)*.9,radius:.2,lean:.3});
    if(palms.length>=9)break;}
  for(const p of palms)p.y=Math.min(p.y,groundLow(p.x,p.z,p.radius+.05)-.03);   // seated
  for(const p of palms)prism(circle(p.x,p.z,p.radius,10),p.y-.1,p.y+4);
  const lamps=[[gateS+10,1.3],[gateS+18,1.3],[gateS+30,1.3]].map(([s,d])=>at(s,d));
  lamps.push({x:-301.0,z:31.5,y:height(-301.0,31.5)});
  for(const l of lamps)l.y=Math.min(l.y,groundLow(l.x,l.z,.11)-.03);   // the drum seated
  // Second pass (float recheck P3): the collider is the drawn lamp, drum toe (y) to cap top (y+4.56; sj-gate.js lamps).
  for(const l of lamps)prism(circle(l.x,l.z,.17,10),l.y,l.y+4.56);
  // one bench sat on a 0.56 m cross-fall. Pick the flattest spot within 1.2 m of each composed
  // position (staying clear of the seawall), keep the seat level, and run each leg down to its own ground.
  const benchHeading=-1.5,legAt=(x,z,u,d)=>[x+Math.cos(benchHeading)*u+Math.sin(benchHeading)*d,z-Math.sin(benchHeading)*u+Math.cos(benchHeading)*d];
  const legGround=(x,z,u)=>[-.25,.25].map(d=>height(...legAt(x,z,u,d)));
  const benches=[[-298.5,45.2],[-299.0,57.0],[-299.6,63.2]].map(([x0,z0])=>{
    let best=null;
    for(let dx=-1.2;dx<=1.2001;dx+=.2)for(let dz=-1.2;dz<=1.2001;dz+=.2){const x=x0+dx,z=z0+dz;
      if(seawall.some((p,j)=>j+1<seawall.length&&segmentDistance(x,z,p,seawall[j+1])<1.4))continue;
      const ys=[-.72,.72].flatMap(u=>legGround(x,z,u)),range=Math.max(...ys)-Math.min(...ys),cost=range+.02*Math.hypot(dx,dz);
      if(!best||cost<best.cost)best={x,z,cost,range,top:Math.max(...ys)};}
    const legs=[-.72,.72].map(u=>({u,ground:Math.min(...legGround(best.x,best.z,u))}));
    return {x:best.x,z:best.z,y:best.top,legs,crossFall:best.range,heading:benchHeading,width:1.9,depth:.6,height:.95};});
  for(const b of benches){const low=Math.min(...b.legs.map(l=>l.ground))-.05;
    colliders.push({centre:{x:b.x,y:(low+b.y+b.height)/2,z:b.z},halfExtents:{x:b.width/2,y:(b.y+b.height-low)/2,z:b.depth/2},rotationY:b.heading,surface:'pavement'});}

  // Wikimedia Commons curid=123113261: grey concrete Paseo del Morro strip; Wikimedia Commons curid=81591499: warmer forecourt pavers. Single owner per point
  // (earlier rings subtract from later ones) and the passage mouth floor excluded: no coplanar overlay fights.
  const afterPortal=stations.filter(s=>s.s>gateS+PORTAL.half&&s.seg>=GATE_SEG).map(s=>s.F);
  const forecourt=[P(uFoot,PORTAL.half+.06),...afterPortal,[-307.6,94.6],
    ...seaFrame.slice(1).reverse().map(f=>[f.x+f.nx*.28,f.z+f.nz*.28]).filter(p=>p[1]<94),[-300.6,35.5]];
  const raw=convexPieces(forecourt).map(ring=>({kind:'paseo',ring}));
  // Apron in front of the whole portal block: the Morro strip stopped short of its north pilaster (bare-terrain sliver).
  // It stops at the portal's front face; behind it the block and the authored floor own the ground.
  raw.push({kind:'paseo',ring:quad(uOut-1.2,uFront,-PORTAL.half-1.5,PORTAL.half+.06)});
  // Narrow strips beside the block reach back into the wall foot (hidden under block/masonry), outside the bore cut.
  for(const [v0,v1] of [[-PORTAL.half-1.5,-PASSAGE.half-.05],[PASSAGE.half+.05,PORTAL.half+.06]])
    raw.push({kind:'paseo',ring:quad(uFront,uFoot+1.5,v0,v1)});
  // Mitred 3.4 m strip: neighbouring quads share their joint edges (no wedge gaps/overlaps on gentle bends); the last
  // quad runs 1.4 m on under the forecourt. Sharp mapped kinks fall back to the plain segment rectangle. The landward
  // half narrows (1.7 → ≥0.9 m) where the DEM toe already rises >12 cm: draped paving never climbs the smeared scarp
  // as pale spikes; that verge reads as the planted strip at the wall foot (Wikimedia Commons curid=82863744) via the lawn tint below.
  {const pts=path.map(p=>[...p]),e=pts.length-1,lx=pts[e][0]-pts[e-1][0],lz=pts[e][1]-pts[e-1][1],ll=Math.hypot(lx,lz);
    pts[e]=[pts[e][0]+lx/ll*1.4,pts[e][1]+lz/ll*1.4];
    const nrm=pts.slice(1).map((q,i)=>{const p=pts[i],l=Math.hypot(q[0]-p[0],q[1]-p[1]);return [-(q[1]-p[1])/l,(q[0]-p[0])/l];});
    const side=pts.map((p,i)=>{const a=nrm[Math.max(0,i-1)],b=nrm[Math.min(nrm.length-1,i)],mx=a[0]+b[0],mz=a[1]+b[1],ml=Math.hypot(mx,mz)||1;
      const k=1/Math.max(.6,(mx*b[0]+mz*b[1])/ml),y0=height(...p);let land=1.7;
      if(p[0]<-325)while(land>.9&&height(p[0]-mx/ml*land,p[1]-mz/ml*land)>y0+.12)land-=.1;
      return {sea:[mx/ml*k*1.7,mz/ml*k*1.7],land:[mx/ml*k*land,mz/ml*k*land],half:land,dir:[mx/ml*k,mz/ml*k]};});
    // Wall-foot verge (2026-11-18; Wikimedia Commons curid=123113261's narrow green strip at the wall foot): on the
    // Paseo del Morro face and extension the landward edge stays ≥ VERGE m from every full face foot, so the wall-foot
    // strip (sj-wall-foot.js) owns a smooth foot line there instead of 2 m DEM teeth. Checked along each edge chord too.
    const VERGE=1.05,footClear=q=>{let m=Infinity;
      for(const s of feetNear(q[0],q[1],14)){const dx=q[0]-s.F[0],dz=q[1]-s.F[1];if(dx*dx+dz*dz>196)continue;
        const g=segs[s.seg],along=dx*g.ux+dz*g.uz,d=dx*s.nx+dz*s.nz;if(Math.abs(along)>g.spacing*.75||d<-14)continue;m=Math.min(m,d);}return m;};
    const edgeAt=(i,h)=>[pts[i][0]-side[i].dir[0]*h,pts[i][1]-side[i].dir[1]*h];
    const cap=pts.map((p,i)=>{if(p[0]>=-305)return null;let h=side[i].half;while(h>.6&&footClear(edgeAt(i,h))<VERGE)h-=.05;return h<side[i].half-1e-9?h:null;});
    for(let i=0;i<e;i++){if(pts[i][0]>=-305||pts[i+1][0]>=-305)continue;
      for(let guard=0;guard<40;guard++){const h0=cap[i]??side[i].half,h1=cap[i+1]??side[i+1].half,A=edgeAt(i,h0),B=edgeAt(i+1,h1);let bad=false;
        for(let t=.1;t<.95&&!bad;t+=.1)bad=footClear([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t])<VERGE;
        if(!bad||h0<=.6&&h1<=.6)break;if(h0>.6)cap[i]=h0-.05;if(h1>.6)cap[i+1]=h1-.05;}}
    cap.forEach((h,i)=>{if(h!==null){side[i].land=[side[i].dir[0]*h,side[i].dir[1]*h];side[i].half=h;}});
    const convex=r=>r.every((b,i)=>{const a=r[(i+r.length-1)%r.length],c=r[(i+1)%r.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<=1e-9;})
      ||r.every((b,i)=>{const a=r[(i+r.length-1)%r.length],c=r[(i+1)%r.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=-1e-9;});
    const edging=[],rawAt=raw.length;
    for(let i=0;i<e;i++){const a=pts[i],b=pts[i+1],m0=side[i],m1=side[i+1],n=nrm[i];
      let ring=[[a[0]+m0.sea[0],a[1]+m0.sea[1]],[a[0]-m0.land[0],a[1]-m0.land[1]],[b[0]-m1.land[0],b[1]-m1.land[1]],[b[0]+m1.sea[0],b[1]+m1.sea[1]]];
      const la=cap[i]??1.7,lb=cap[i+1]??1.7;
      if(!convex(ring))ring=[[a[0]+n[0]*1.7,a[1]+n[1]*1.7],[a[0]-n[0]*la,a[1]-n[1]*la],[b[0]-n[0]*lb,b[1]-n[1]*lb],[b[0]+n[0]*1.7,b[1]+n[1]*1.7]];
      // (the earlier stone edging lived in the `passage` batch, which is drawn as an
      // authored floor without the overlay depth offset, so on the terrain it z-fought as black hatched stripes. Removed:
      // the paving ends on its own straight ring edge against the verge.)
      raw.push({kind:'morro',ring});}
    raw.splice(rawAt,0,...edging);}
  // Calle de la Defensa (OSM 270140130 → 256401110), the raw city-side
  // approach climbing north from the bore's inner mouth (audit stills san-juan-gate-throat--289_34-n and
  // calle-de-la-defensa--292_84-ne). Untagged service way: setts like Caleta's inferred cobbles (Wikimedia Commons curid=81591500, curid=53594779, curid=151530324), 4.4 m wide,
  // from the bore's drawn edge (every corner ≥ 0.3 m past the cut at z 39; a 2.5 m bare gap read as a paving sample laid in
  // the road) to the mapped node at (−292.9, 85.1), where the ordinary street carries on. Last in the
  // raw order, so every earlier gate ring keeps its ground; draped like every gate surface (visual only).
  {const D=[[-287.941,29.507],[-276.936,65.911],[-275.172,72.774],[-275.119,74.899],[-276.841,77.334],[-288.903,82.425],[-292.875,85.148]];
    const t=(39.95-D[0][1])/(D[1][1]-D[0][1]);D[0]=[D[0][0]+(D[1][0]-D[0][0])*t,39.95];
    const half=2.2,nrm=D.slice(1).map((q,i)=>{const p=D[i],l=Math.hypot(q[0]-p[0],q[1]-p[1]);return [-(q[1]-p[1])/l,(q[0]-p[0])/l];});
    const off=(i,d)=>{const a=nrm[Math.max(0,i-1)],b=nrm[Math.min(nrm.length-1,i)],mx=a[0]+b[0],mz=a[1]+b[1],m=Math.hypot(mx,mz)||1,k=d/Math.max(.5,(mx*b[0]+mz*b[1])/m);
      return [D[i][0]+mx/m*k,D[i][1]+mz/m*k];};
    for(let i=0;i+1<D.length;i++){const q=[off(i,-half),off(i+1,-half),off(i+1,half),off(i,half)];
      if(Math.abs(signedArea(q))>1e-4)for(const ring of convexPieces(q))raw.push({kind:'sett',ring});}}
  // Joins (paseo-del-morro--866_-701-e): the mapped lookout loop at the paseo's west tip (OSM
  // 22229416, concrete footway, 2.2 m) round the little point between the paseo nodes (−863,−689) and (−852,−697). It was
  // `streets`' concrete cut into slivers where it met the paseo, inside a soft pale blob of tint: it is now the paseo's own
  // paving (same kind, 2.4 m), so the walk returns onto the paseo at both ends as one path. Last in the raw order, so every
  // earlier ring keeps its ground; draped like every gate surface (visual only).
  const LOOP=[[-863.22,-688.673],[-868.923,-695.293],[-869.346,-698.082],[-867.476,-701.181],[-863.917,-701.867],[-858.53,-701.834],[-851.781,-696.753]];
  {const D=LOOP,half=1.2,nrm=D.slice(1).map((q,i)=>{const p=D[i],l=Math.hypot(q[0]-p[0],q[1]-p[1]);return [-(q[1]-p[1])/l,(q[0]-p[0])/l];});
    const off=(i,d)=>{const a=nrm[Math.max(0,i-1)],b=nrm[Math.min(nrm.length-1,i)],mx=a[0]+b[0],mz=a[1]+b[1],m=Math.hypot(mx,mz)||1,k=d/Math.max(.5,(mx*b[0]+mz*b[1])/m);
      return [D[i][0]+mx/m*k,D[i][1]+mz/m*k];};
    for(let i=0;i+1<D.length;i++){const q=[off(i,-half),off(i+1,-half),off(i+1,half),off(i,half)];
      if(Math.abs(signedArea(q))>1e-4)for(const ring of convexPieces(q))raw.push({kind:'morro',ring});}}
  // ---- Stairs round (public stairs ride both ways). OSM steps 270140129 climb from Caleta de San
  // Juan to the through node it shares with footway 270140128 (paving stones, no layer tag), the walk along the top of the
  // wall (the wall bodies here are support: their top, 12.0–12.8 m, is the walk). The stair top (12.3 m) and the walk end
  // (12.0–12.3 m) are level, but the 2 m DEM sampled the bore mouth as a hollow between them (down to 10.1 m), so the
  // wheel dropped in and met the walk's 1.8 m side face. A landing fills just that hollow: a boundary-pinned surface over
  // a 0.5 m grid, its edges the ground they meet (DEM, or the walk top where it laps a wall body), the interior a Coons
  // patch of those edges; the wall bodies are subtracted exactly. Same triangles drawn (`landing.floorTriangles`) and as
  // replacement tops; a tight render cut removes the faceted ground beneath. No masonry is cut or moved.
  const landing={floorTriangles:[],ring:null};
  // Stairs the 270140129 flight (below) owns its own footprint; the landing yields it (one owner per ground).
  const STAIR_A=[-273.83,20.88],STAIR_B=[-288.61,26.67],STAIR_X=-288.1,STAIR_W=2,STAIR_TOP_APRON=.4;
  const stairRing=(()=>{const L=Math.hypot(STAIR_B[0]-STAIR_A[0],STAIR_B[1]-STAIR_A[1]),dx=(STAIR_B[0]-STAIR_A[0])/L,dz=(STAIR_B[1]-STAIR_A[1])/L,run=L*(STAIR_X-STAIR_A[0])/(STAIR_B[0]-STAIR_A[0]),h=STAIR_W/2;
    const at=(u,s2)=>[STAIR_A[0]+dx*s2-dz*u,STAIR_A[1]+dz*s2+dx*u];return [at(-h,0),at(h,0),at(h,run+STAIR_TOP_APRON),at(-h,run+STAIR_TOP_APRON)];})();
  {const X0=-291.6,X1=-288.1,Z0=23.9,Z1=28.9,STEP=.5,ring=[[X0,Z0],[X1,Z0],[X1,Z1],[X0,Z1]];
    const bodies=colliders.filter(c=>c.support&&c.outer?.length>=3).map(c=>({r:c.outer.map(q=>[q.x,q.z]),top:c.maxY}))
      .filter(b=>b.r.some(p=>p[0]>X0-3&&p[0]<X1+3&&p[1]>Z0-3&&p[1]<Z1+3));
    const walkAt=(x,z)=>{for(const t of walkTops){if(inRing(x,z,t.poly.map(q=>[q.x,q.z])))return t.plane.y+t.plane.dx*(x-t.plane.x)+t.plane.dz*(z-t.plane.z);}return null;};
    const f=(x,z)=>{const wa=walkAt(x,z);if(wa!==null)return wa;let t=null;for(const b of bodies)if(inRing(x,z,b.r))t=Math.max(t??-Infinity,b.top);return t??height(x,z);};
    // Boundary samples every 0.1 m: the rectangle's open edges carry the ground (DEM, or a walk top where a body laps them);
    // every wall-body face inside the rectangle carries that body's walk top. S is their inverse-distance blend (power 4):
    // it meets each join at the join's own height.
    const samples=[];const segSamples=(a,b,y)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/.1));for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n;samples.push([x,z,y??f(x,z)]);}};
    for(let k=0;k<4;k++)segSamples(ring[k],ring[(k+1)%4]);
    const inRect=(x,z)=>x>=X0-1e-9&&x<=X1+1e-9&&z>=Z0-1e-9&&z<=Z1+1e-9;
    for(const bd of bodies)for(let k=0;k<bd.r.length;k++){const p0=bd.r[k],p1=bd.r[(k+1)%bd.r.length],L=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),n=Math.max(1,Math.ceil(L/.1));
      for(let i=0;i<=n;i++){const x=p0[0]+(p1[0]-p0[0])*i/n,z=p0[1]+(p1[1]-p0[1])*i/n;if(inRect(x,z)){const e=.03,cx=x+(p0[1]-p1[1])/L*e,cz=z+(p1[0]-p0[0])/L*e,wa=walkAt(cx,cz)??walkAt(x-(cx-x),z-(cz-z));samples.push([x,z,wa??bd.top]);}}}
    const S=(x,z)=>{let wsum=0,ysum=0;for(const [sx,sz,sy] of samples){const d2=(x-sx)**2+(z-sz)**2;if(d2<1e-10)return sy;const wt=1/(d2*d2);wsum+=wt;ysum+=wt*sy;}return ysum/wsum;};
    const clipOut=(poly,r)=>subtractRing(signedArea(poly)<0?[...poly].reverse():poly,signedArea(r)<0?[...r].reverse():r);
    for(let x=X0;x<X1-1e-9;x+=STEP)for(let z=Z0;z<Z1-1e-9;z+=STEP){const a=[x,z],b=[x+STEP,z],c=[x+STEP,z+STEP],d=[x,z+STEP];
      for(const t of [[a,b,c],[a,c,d]]){let pieces=[t];for(const bd of bodies)pieces=pieces.flatMap(pc=>clipOut(pc,bd.r));pieces=pieces.flatMap(pc=>clipOut(pc,stairRing));
        for(const pc of pieces){if(Math.abs(signedArea(pc))<1e-4)continue;const P=pc.map(p=>[p[0],S(p[0],p[1]),p[1]]);
          for(let k=1;k+1<P.length;k++){let tri=[P[0],P[k],P[k+1]];
            // drawn faces point up (counter-clockwise from above, as the passage floor)
            if((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0])>0)tri=[tri[0],tri[2],tri[1]];
            landing.floorTriangles.push(tri);const [p,q,w]=tri,ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=w[0]-p[0],vy=w[1]-p[1],vz=w[2]-p[2];
            const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(Math.abs(ny)<1e-9)continue;
            tops.push({poly:tri.map(t3=>({x:t3[0],z:t3[2]})),top:Math.max(p[1],q[1],w[1]),plane:{x:p[0],y:p[1],z:p[2],dx:-nx/ny,dz:-nz/ny},
              replacesTerrain:true,maxReferenceY:Math.max(p[1],q[1],w[1])+FLOOR_BAND,surface:'pavement',source:'gate:landing-270140129'});}}}}
    const r=signedArea(ring)<0?[...ring].reverse():ring,sa=Math.sign(signedArea(r));landing.ring=r;
    cuts.push({ring:r,planes:r.map((a,k)=>{const b=r[(k+1)%r.length],ex=b[0]-a[0],ez=b[1]-a[1],l=Math.hypot(ex,ez)||1,nx=-sa*ez/l,nz=sa*ex/l;return [nx,0,nz,-(nx*a[0]+nz*a[1])];}),
      minX:X0,maxX:X1,minZ:Z0,maxZ:Z1,kind:'gate-landing',tight:true});
    landing.S=S;}
  // ---- Stairs 270140129 drawn as real uniform treads with the shared model (js/sj-stairs.js via seamsFlight):
  // painted over the 2 m DEM it pitched to ~60° mid-flight (79 % over 1 m) and the vertical wheel cut it by 9.3 cm. Foot on
  // Caleta (the steps' OSM end node), top at the landing's east edge; the landing is the ground beyond the top.
  const stairs=[];
  {const a=STAIR_A,b=STAIR_B,X=STAIR_X,L=Math.hypot(b[0]-a[0],b[1]-a[1]),run=L*(X-a[0])/(b[0]-a[0]);
    const inLanding=(x,z)=>x>=-291.6&&x<=X+1e-9&&z>=23.9&&z<=28.9;
    const ground=(x,z)=>inLanding(x,z)?landing.S(x,z):height(x,z);
    // Treads no deeper than 0.40 m (the 0.5 m wheel bridges nosing to nosing; deeper bays left the seated wheel 15 cm over
    // the drawn bay at 7 m/s down) and risers ≤ 16 cm.
    const top=[a[0]+(b[0]-a[0])*run/L,a[1]+(b[1]-a[1])*run/L],yf=height(...a),yt=landing.S(...top),n=Math.max(2,Math.round((yt-yf)/.16),Math.ceil(run/.40));
    const F=seamsFlight({a,b,run,width:STAIR_W,yf,yt,n,ground,topApron:STAIR_TOP_APRON,refAbove:3,grid:terrain?.nx?{x0:terrain.x0,z0:terrain.z0,step:terrain.step}:null,source:'gate:stair-270140129'});
    tops.push(...F.tops);cuts.push(F.cut);stairs.push({name:'270140129',...F,low:Math.min(yf,yt)-.25});}
  registerStairFlights('gate',stairs.map(f=>f.record));
  // Joins (san-juan-gate-throat--289_34-n): the rampart top over the bore's city mouth (DEM
  // 13 → 10 m, gentle; the city level, never the paseo) read as a smear of grey tint, grass and stepped street ends. It is
  // one drawn sett court (Wikimedia Commons curid=81591500, curid=53594779, curid=151530324: Caleta's grey cobbles) from the wall to the street east of it, clipped to the
  // gentle ground: south of z 22 it stops 5 m short of the bore mouth's scarp (DEM 12 → 7 m over 4 m), which keeps its
  // ground. Last in the raw order (every earlier gate ring keeps its ground); `streets` subtracts it exactly.
  // (class sweep): the court also yields every gate top, cut and solid footprint (wall bodies, the
  // rampart top over the bore), so no drawn sett ever lies under or over a different physical surface.
  {const ccw=r=>signedArea(r)<0?[...r].reverse():r,box=[-299,-276,-2,31.5],inBox=r=>r.some(p=>p[0]>box[0]&&p[0]<box[1]&&p[1]>box[2]&&p[1]<box[3]);
    const blockers=[...tops.map(t=>t.poly.map(p=>[p.x,p.z])),...cuts.map(c=>c.ring??[[c.minX,c.minZ],[c.maxX,c.minZ],[c.maxX,c.maxZ],[c.minX,c.maxZ]]),
      ...colliders.filter(c=>c.outer).map(c=>c.outer.map(p=>[p.x,p.z]))].filter(r=>r.length>=3&&Math.abs(signedArea(r))>1e-4&&inBox(r)).flatMap(r=>convexPieces(ccw(r)));
    // the west edge was two hand-drawn pieces whose diagonal left a bare wedge
    // against the wall toe and stepped back at z 22. Now one trim curve along the break of slope: scanning west every 0.5 m
    // of z, the court ends where the ground starts falling faster than 1 m/m (1 m/m: the scarp under the wall and at the bore
    // mouth); the wall bodies still trim it exactly, and the scarp keeps its ground.
    // Where the masonry itself is within 1.5 m of the break, the court runs on into the wall body (subtracted below), so the
    // join is the wall face, not a sliver of the wall's own DEM scarp. A 3-tap median along z removes single-row spikes.
    const inBlock=(x,z)=>blockers.some(r=>inRing(x,z,r)),xs=[],zs=[];
    for(let z=-1;z<=30.7+1e-9;z+=.5){let x=-299;for(let xi=-284.5;xi>-299;xi-=.25)if(height(xi,z)-height(xi-.25,z)>.25){x=xi;break;}
      for(let d=.25;d<=1.5;d+=.25)if(inBlock(x-d,z)){x=x-d-.3;break;}
      xs.push(x);zs.push(z);}
    const west=xs.map((x,i)=>[+[xs[Math.max(0,i-1)],x,xs[Math.min(xs.length-1,i+1)]].sort((a,b)=>a-b)[1].toFixed(3),+zs[i].toFixed(3)]);
    const court=[[-277,-1],[-277,22],[-284.5,22],[-285.5,30.7],...west.reverse()];
    for(const q of [court]){
      let pieces=convexPieces(ccw(q));for(const b of blockers)pieces=pieces.flatMap(poly=>subtractRing(poly,b));
      // drop repeated vertices (≤ 1 mm) the subtraction can leave; a zero-length edge breaks the
      // convex clipping of later owners (streets kept a triangle under the court).
      for(const r0 of pieces){const ring=r0.filter((p,i)=>{const q=r0[(i+1)%r0.length];return Math.hypot(p[0]-q[0],p[1]-q[1])>1e-3;});
        if(ring.length>=3&&Math.abs(signedArea(ring))>1e-3)raw.push({kind:'sett',ring});}}}
  // Slightly inside the floor footprint (rows start at uOut−0.03, ±(half+0.03)): the floor laps 6 cm over the paseo.
  // A wider hole left a bare-terrain line; an exactly shared edge still showed a hairline.
  const exclude=quad(uOut+.03,uFront+.02,-PASSAGE.half+.03,PASSAGE.half-.03);
  const surfaces=[],bounds=r=>{const xs=r.map(p=>p[0]),zs=r.map(p=>p[1]);return [Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];};
  const rb=raw.map(r=>bounds(r.ring)),eb=bounds(exclude),hit=(a,b)=>a[0]<=b[1]&&b[0]<=a[1]&&a[2]<=b[3]&&b[2]<=a[3];
  for(let i=0;i<raw.length;i++){
    let pieces=[signedArea(raw[i].ring)<0?[...raw[i].ring].reverse():raw[i].ring];
    // Bounding-box prefilter keeps the ~650-piece paseo linear rather than quadratic in subtraction work.
    const cuts=[...(hit(rb[i],eb)?[exclude]:[]),...raw.slice(0,i).filter((r,j)=>hit(rb[i],rb[j])).map(r=>r.ring)];
    for(const cut of cuts)pieces=pieces.flatMap(poly=>subtractRing(poly,cut));
    for(const ring of pieces)surfaces.push({kind:raw[i].kind,ring});
  }
  // Ground tint beside the extension (Wikimedia Commons curid=114692556, curid=82863744, curid=116769039): dark rip-rap tone on the low seaward margin; lawn/scrub on the
  // low landward strip and the steep DEM slopes below Santa Elena/El Morro; plain paving tone under the strip core, so
  // the surface mask's rasterised OSM footway line (often inside the smear, where the strip no longer runs) cannot
  // bleed grey-blue past the strip edge. Thresholds overlap the 1.7 m strip edge. The gate forecourt keeps its banks.
  const tint=new Map();
  if(terrain?.nx){const {x0,z0,nx,nz,step}=terrain,best=new Map(),R=30;
    for(let i=0;i+1<path.length;i++){const a=path[i],b=path[i+1];if(a[0]>-325)continue;
      const dx=b[0]-a[0],dz=b[1]-a[1],L2=dx*dx+dz*dz,L=Math.sqrt(L2);
      const i0=Math.max(0,Math.floor((Math.min(a[0],b[0])-R-x0)/step)),i1=Math.min(nx-1,Math.ceil((Math.max(a[0],b[0])+R-x0)/step));
      const j0=Math.max(0,Math.floor((Math.min(a[1],b[1])-R-z0)/step)),j1=Math.min(nz-1,Math.ceil((Math.max(a[1],b[1])+R-z0)/step));
      for(let j=j0;j<=j1;j++)for(let k=i0;k<=i1;k++){const x=x0+k*step,z=z0+j*step,t=((x-a[0])*dx+(z-a[1])*dz)/L2;if(t<0||t>1)continue;
        const d=((z-a[1])*dx-(x-a[0])*dz)/L,key=j*nx+k,prev=best.get(key);
        if(prev===undefined||Math.abs(d)<Math.abs(prev.d))best.set(key,{d,y:height(a[0]+dx*t,a[1]+dz*t)});}}
    for(const [key,{d,y}] of best){const x=x0+(key%nx)*step,z=z0+Math.floor(key/nx)*step,h=height(x,z);
      if(d<=1.2&&d>=-.8)tint.set(key,h<y+.12?'paseo':'lawn'); // raised strip-edge vertices read as verge
      else if(d>1.2&&d<8.5&&h<y+.3)tint.set(key,'rock');
      else if(d<-.8){const slope=Math.hypot(height(x+1,z)-height(x-1,z),height(x,z+1)-height(x,z-1))/2;if(h<y+2.2&&d>-14||slope>.6)tint.set(key,'lawn');}}}
  // Seams round the lookout loop the paving tone runs 1.3 m either side of its line, and the little lawn it
  // encloses with the paseo is lawn (it showed the trail class as a pale blob).
  if(terrain?.nx){const {x0,z0,nx,step}=terrain,ring=[...LOOP,[-857.0,-693.2]];
    for(let x=Math.ceil((-873-x0)/step)*step+x0;x<=-848;x+=step)for(let z=Math.ceil((-706-z0)/step)*step+z0;z<=-684;z+=step){
      const key=Math.round((z-z0)/step)*nx+Math.round((x-x0)/step);let d=Infinity;
      for(let i=0;i+1<LOOP.length;i++)d=Math.min(d,segmentDistance(x,z,LOOP[i],LOOP[i+1]));
      let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}
      if(d<=1.3)tint.set(key,'paseo');else if(inside)tint.set(key,'lawn');}}
  // (Seams the integration round's sett-grey terrain tint on the rampart top is replaced by the drawn
  // throat setts above; a tinted corner blocks `streets`' cells and stair-stepped its edge against it.)
  const arrival=P(uOut-4.5,0);
  const nearestPath=(x,z)=>path.reduce((b,p)=>Math.hypot(p[0]-x,p[1]-z)<Math.hypot(b[0]-x,b[1]-z)?p:b);
  return {frame:{origin:GATE_NODE,ax,az,px,pz,P,UV},segments:segs,stations,walls,gateS,landing,stairs,
    passage:{uOut,uFront,uDoor,uChamber,uInner,uIn,uFoot,uBack,outerY,innerY,floorAt,portalY,portalBottom,portalTop,cutTop,inner,kerbs,floorTriangles,skirts},
    ends,tops,cuts,colliders,garitas,bollards,rocks,seawall,seaTop,seaFrame,seaBottom,planter,palms,lamps,benches,surfaces,exclude,
    path,tint,
    places:[{name:'Puerta de San Juan — Paseo del Morro',x:arrival[0],z:arrival[1],source:2306823907},
      ...[['Paseo del Morro — Bastión de Santa Elena',-735,-263,1024680662],['Paseo del Morro — Bastión San Agustín',-520,-55,1024680663]]
        .map(([name,x,z,source])=>{const p=nearestPath(x,z);return {name,x:p[0],z:p[1],source};})],
    constants:{BATTER,PARAPET,PLINTH,PORTAL,PASSAGE,FLOOR_BAND}};
}
