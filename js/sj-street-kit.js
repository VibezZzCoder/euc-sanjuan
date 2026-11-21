/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Shared street furniture — © 2026 VibezZzCoder, MIT. Moved verbatim from sj-princesa.js (its output is byte-identical) and
// reused by La Puntilla: Wikimedia Commons curid=131971361, curid=184241561 black lantern posts (single on stone bases, or curled two-arm clusters), Wikimedia Commons curid=80420009, curid=184241561
// slat benches on their own ground, Wikimedia Commons curid=80420009, curid=195143828, curid=122996449, curid=184241561 broad shade trees (tapered trunk, limbs into canopy lobes).
// Every part sits on the layout's measured ground; the layouts own the matching solids.
import * as THREE from 'three/webgpu';
import { glowLamp } from './sj-glow.js';

export const IRON='#1f2523';

export function streetKit({bake,own,box,cylinder,sphere}) {
  // Cylinder between two points (shared instanced pool). bake turns local +Y to Ry(ry)·Rz(rz)·Y = (−sin rz·cos ry,
  // cos rz, sin rz·sin ry), so rz = acos(dy) and ry = atan2(dz,−dx); parts built this way meet at their joints.
  const seg=(a,b,r,colour,kind='solid')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-6)return;
    const rz=Math.acos(Math.max(-1,Math.min(1,dy/l))),ry=Math.hypot(dx,dz)>1e-9?Math.atan2(dz,-dx):0;
    bake(cylinder,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,l,r,colour,ry,kind,rz);};
  const capG=own(new THREE.ConeGeometry(.15,.14,4));capG.rotateY(Math.PI/4);
  // ---- Lamps: Wikimedia Commons curid=80420009 posts on stone bases along the seawall; Wikimedia Commons curid=131971361 black posts with curled arms and framed lanterns
  // (the lanterns hovered over a bare crossbar). Every lantern stands on a cup or the post top. ----
  let lampGround;   // ground under the post being drawn (light-field height reference), else the kind's default
  const lantern=(x,y,z,s=1)=>{glowLamp(x,y+.21*s,z,'kit',{ground:lampGround,scale:s});bake(box,x,y+.025*s,z,.2*s,.05*s,.2*s,IRON,0,'solid');bake(box,x,y+.21*s,z,.18*s,.32*s,.18*s,'#e6d49c',0,'solid');
    bake(capG,x,y+.43*s,z,s,s,s,IRON,0,'solid');bake(sphere,x,y+.52*s,z,.03*s,.04*s,.03*s,IRON,0,'solid');};
  // the foot ended at the centre-point ground (l.y), so on a slope its downhill edge floated (up to
  // 23.55 cm). `l.foot` (set by seatKitLamps from the drawn ground under the whole footprint, shared with the collider)
  // carries only the foot down; post, mouldings and lantern keep their heights. Without `l.foot` the old bytes result.
  const lamps=list=>{for(const l of list){const {x,y,z}=l,f=Number.isFinite(l.foot)?Math.min(y,l.foot):y;lampGround=y;
    if(l.base){bake(cylinder,x,f<y?(f+y+1.2)/2:y+.6,z,.3,f<y?y+1.2-f:1.2,.3,'#cfc4aa',0,'solid');bake(cylinder,x,y+1.24,z,.34,.08,.34,'#ddd3bd',0,'solid');
      bake(cylinder,x,y+2.62,z,.06,2.76,.06,IRON,0,'solid');lantern(x,y+3.98,z,1.5);}
    else{bake(cylinder,x,f<y?(f+y+.5)/2:y+.25,z,.18,f<y?y+.5-f:.5,.18,IRON,0,'solid');bake(cylinder,x,y+2.045,z,.06,3.19,.06,IRON,0,'solid');
      bake(sphere,x,y+3.15,z,.09,.07,.09,IRON,0,'solid');lantern(x,y+3.62,z);
      for(const sd of [-1,1]){const a=[x,y+3.12,z],b=[x+.38*sd,y+3.28,z],e=[x+.5*sd,y+3.42,z];seg(a,b,.028,IRON);seg(b,e,.028,IRON);
        bake(cylinder,x+.5*sd,y+3.44,z,.05,.06,.05,IRON,0,'solid');lantern(x+.5*sd,y+3.47,z);}}}lampGround=undefined;};
  // Benches: legs on their own ground, seat slats, backrest slats on two iron uprights (no floating backrest).
  const benches=list=>{for(const b of list){
    const P=(u,yy,d=0)=>[b.x+Math.cos(b.heading)*u+Math.sin(b.heading)*d,yy,b.z-Math.sin(b.heading)*u+Math.cos(b.heading)*d];
    const lb=(u,yy,d,w,h,dd,c)=>bake(box,...P(u,yy,d),w,h,dd,c,b.heading,'solid');
    for(const l of b.legs){const lo=l.ground-.05,hi=b.y+.5;lb(l.u,(lo+hi)/2,0,.085,hi-lo,.5,IRON);lb(l.u,b.y+.7,-.26,.06,.44,.06,IRON);}
    for(let i=0;i<3;i++)lb(0,b.y+.49,-.22+i*.2,b.width,.075,.15,'#6e5a3c');
    for(const yy of [.72,.88])lb(0,b.y+yy,-.22,b.width,.14,.05,'#6e5a3c');}};
  // ---- Broad shade trees (Wikimedia Commons curid=80420009, curid=195143828, curid=122996449). limbs floated up to 1.7 m off the trunk and the "lean"
  // shifted the trunk into the seawall. The trunk is now a tapered tube rooted at the layout anchor and bending into its
  // lean; every limb runs from inside the upper trunk to inside its canopy lobe. ----
  const tube=(pts,r0,r1,sides=7)=>{const pos=[],ix=[],n=pts.length,X=new THREE.Vector3(1,0,0),Z=new THREE.Vector3(0,0,1);
    for(let i=0;i<n;i++){const p=pts[i],q=pts[Math.min(i+1,n-1)],o=pts[Math.max(i-1,0)],T=new THREE.Vector3(q[0]-o[0],q[1]-o[1],q[2]-o[2]).normalize();
      const A=new THREE.Vector3().crossVectors(T,Math.abs(T.x)>.9?Z:X).normalize(),B=new THREE.Vector3().crossVectors(T,A),r=r0+(r1-r0)*i/(n-1);
      for(let k=0;k<sides;k++){const a=k*Math.PI*2/sides,ca=Math.cos(a)*r,sa=Math.sin(a)*r;pos.push(p[0]+A.x*ca+B.x*sa,p[1]+A.y*ca+B.y*sa,p[2]+A.z*ca+B.z*sa);}}
    for(let i=0;i+1<n;i++)for(let k=0;k<sides;k++){const a=i*sides+k,b=i*sides+(k+1)%sides;ix.push(a,b,a+sides,b,b+sides,a+sides);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();return g;};
  const trees=list=>list.forEach((t,i)=>{const s=t.scale,ox=(t.lean?.[0]??0)*1.6*s,oz=(t.lean?.[1]??0)*1.6*s,H=3.4*s;
    const C=u=>[t.x+ox*u*u,t.y-.15+(H+.15)*u,t.z+oz*u*u],T=C(1);
    const g=tube(Array.from({length:7},(_,k)=>C(k/6)),.3*s,.19*s);bake(g,0,0,0,1,1,1,'#6f6553',0,'solid');g.dispose();
    for(let j=0;j<5;j++){const a=j*Math.PI*2/5+i*.7,cy=T[1]+(1.35+(j%2)*.45)*s;
      seg(C(.8+.04*(j%3)),[T[0]+Math.cos(a)*1.45*s,cy-.55*s,T[2]+Math.sin(a)*1.45*s],.1*s,'#6f6553');
      bake(sphere,T[0]+Math.cos(a)*1.9*s,cy,T[2]+Math.sin(a)*1.9*s,1.9*s,1.3*s,1.9*s,['#3d6339','#4a7044','#355a36'][j%3],a,'leaf');}
    seg(C(.85),[T[0],T[1]+1.7*s,T[2]],.13*s,'#6f6553');
    bake(sphere,T[0],T[1]+2.2*s,T[2],2.45*s,1.5*s,2.3*s,'#4b7246',0,'leaf');});
  return {seg,lantern,lamps,benches,trees,tube};
}

// ---- Shared seating ("parts of objects levitating"). Anything standing on the ground is seated on
// the *drawn* surface under its whole footprint: base bottom ≥ 3 cm below the lowest drawn point, collider sharing that
// lower bound. drawnGroundProbe mirrors SfTerrainSampler.sampleGround (the physics authority) without needing the sampler:
// DEM triangles (`height`, the same triangles the terrain chunks draw and overlays clip), replacement tops (decks, bores,
// fitted floors: `replacesTerrain` replaces the DEM, others only rise above it), and `support:true` prisms/boxes. Tops
// higher than refY + reach are ignored (a bridge over the prop is not its support), as are tops whose ceiling or
// reference band excludes refY. Points over water with nothing drawn above return null (ignored by footprintRange).
export function drawnGroundProbe({height,isDry=null,tops=[],prisms=[],reach=.35}) {
  const C=8,cells=new Map(),key=(i,j)=>i*100003+j;
  const add=(o,minX,maxX,minZ,maxZ)=>{for(let i=Math.floor(minX/C);i<=Math.floor(maxX/C);i++)for(let j=Math.floor(minZ/C);j<=Math.floor(maxZ/C);j++){
    const k=key(i,j);let a=cells.get(k);if(!a)cells.set(k,a=[]);a.push(o);}};
  const bounds=poly=>{let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const p of poly){const x=p.x??p[0],z=p.z??p[1];
    if(x<a)a=x;if(x>b)b=x;if(z<c)c=z;if(z>d)d=z;}return [a,b,c,d];};
  const inPoly=(poly,x,z)=>{let s=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const ax=poly[i].x??poly[i][0],az=poly[i].z??poly[i][1],
    bx=poly[j].x??poly[j][0],bz=poly[j].z??poly[j][1];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)s=!s;}return s;};
  for(const t of tops)if(t?.poly?.length>=3){const b=bounds(t.poly);add({t},...b);}
  for(const p of prisms){if(p?.support!==true)continue;
    if(p.outer?.length>=3){const b=bounds(p.outer);add({p},...b);}
    else if(p.centre&&p.halfExtents){const h=Math.hypot(p.halfExtents.x,p.halfExtents.z);add({b:p},p.centre.x-h,p.centre.x+h,p.centre.z-h,p.centre.z+h);}}
  return (x,z,refY=Infinity)=>{
    const list=cells.get(key(Math.floor(x/C),Math.floor(z/C)))??[],lim=refY+reach;
    let base=isDry&&!isDry(x,z)?null:height(x,z),rep=-Infinity,sel=-Infinity;
    for(const o of list){
      if(o.t){const t=o.t;if(!inPoly(t.poly,x,z))continue;const pl=t.plane;const y=pl?pl.y+pl.dx*(x-pl.x)+pl.dz*(z-pl.z):t.top;
        const ceil=t.ceilingOffset?y+t.ceilingOffset:t.maxReferenceY;
        if(!Number.isFinite(y)||y>lim||refY<(t.minReferenceY??-Infinity)||(ceil!==undefined&&refY>=ceil))continue;
        if(t.replacesTerrain){if(y>rep)rep=y;}else if(y>sel)sel=y;}
      else if(o.p){const p=o.p;if(p.maxY>lim||!inPoly(p.outer,x,z)||(p.holes??[]).some(h=>inPoly(h,x,z)))continue;if(p.maxY>sel)sel=p.maxY;}
      else{const c=o.b,dx=x-c.centre.x,dz=z-c.centre.z,r=c.rotationY??0,cs=Math.cos(r),sn=Math.sin(r),y=c.centre.y+c.halfExtents.y;
        if(y>lim||Math.abs(cs*dx-sn*dz)>c.halfExtents.x||Math.abs(sn*dx+cs*dz)>c.halfExtents.z)continue;if(y>sel)sel=y;}}
    if(rep>-Infinity)base=rep;
    if(sel>-Infinity&&(base===null||sel>=base))base=sel;
    return base;};
}
// Lowest / highest drawn ground under a footprint: circle {x,z,r} or oriented rectangle {x,z,hw,hd,yaw} (hw along the
// local x axis rotated by yaw about +Y, the bake convention). Sampled at the centre, two rim rings (16 + 8 points) or the
// corners, edge midpoints and a 5×5 interior lattice. `ground` is a probe from drawnGroundProbe, an (x,z,refY) function,
// or a sampler with sampleGround. refY defaults to the nominal base + .5 m. Returns {lo,hi,n,missing}.
export function footprintRange(ground,fp,refY=Infinity) {
  const g=typeof ground==='function'?ground:(()=>{const o={normal:{}};return (x,z,r)=>{ground.sampleGround(x,z,o,r);return o.water?null:o.height;};})();
  const pts=[[fp.x,fp.z]];
  if(fp.r!==undefined){for(const [n,f] of [[16,1],[8,.5]])for(let k=0;k<n;k++){const a=(k+.5)*Math.PI*2/n;pts.push([fp.x+Math.cos(a)*fp.r*f,fp.z+Math.sin(a)*fp.r*f]);}}
  else{const c=Math.cos(fp.yaw??0),s=Math.sin(fp.yaw??0);
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const u=fp.hw*i/2,v=fp.hd*j/2;pts.push([fp.x+c*u+s*v,fp.z-s*u+c*v]);}}
  let lo=Infinity,hi=-Infinity,n=0,missing=0;
  for(const [x,z] of pts){const y=g(x,z,refY);if(y===null||!Number.isFinite(y)){missing++;continue;}n++;if(y<lo)lo=y;if(y>hi)hi=y;}
  return {lo,hi,n,missing};
}
export const STEEP_SPAN=.35;
// Footprints of the kit's lamp feet (base: .3 m stone drum; unbased: .18 m iron foot).
export const lampFootprint=l=>({x:l.x,z:l.z,r:l.base?.3:.18});
// Seat records generically: r.foot = min(nominal bottom, footprint minimum − toe) over a circular footprint of radius(r) at
// (r.x, r.z); the matching circular collider at that record (centred within 2 cm, minY within 2.5 cm of nominal −.1,
// the convention every layout here uses) gets the same lower bound. Drawing code extends only the foot to r.foot.
export function seatRecords(list,colliders,ground,{radius=r=>r.radius??.2,nominal=r=>r.y,toe=.03}={}) {
  // Steep footprint (recheck 2026-11-19): a footprint spanning more than STEEP_SPAN of drawn height stands on a face, not on
  // ground — r.steep records the span and stats.steep lists them; move such a prop rather than burying a tall drum.
  const stats={records:0,lowered:0,maxGap:0,colliders:0,steep:[]};if(!Array.isArray(list))return stats;
  const centroid=o=>{let x=0,z=0;for(const p of o){x+=p.x??p[0];z+=p.z??p[1];}return [x/o.length,z/o.length];};
  const near=new Map();for(const c of colliders??[])if(c?.outer?.length>=3&&Number.isFinite(c.minY)){const [x,z]=centroid(c.outer),k=Math.round(x)+','+Math.round(z);
    let a=near.get(k);if(!a)near.set(k,a=[]);a.push({c,x,z});}
  for(const l of list){if(!l||typeof l!=='object'||![l.x,l.y,l.z].every(Number.isFinite))continue;const y0=nominal(l);
    const r=footprintRange(ground,{x:l.x,z:l.z,r:radius(l)},y0+.5);stats.records++;if(!(r.n>0))continue;
    const gap=y0-r.lo;if(gap>stats.maxGap)stats.maxGap=gap;if(r.hi-r.lo>STEEP_SPAN){l.steep=r.hi-r.lo;stats.steep.push(l);}
    const foot=Math.min(y0,r.lo-toe);l.foot=foot;if(foot<y0)stats.lowered++;
    for(let i=Math.round(l.x)-1;i<=Math.round(l.x)+1;i++)for(let j=Math.round(l.z)-1;j<=Math.round(l.z)+1;j++)for(const e of near.get(i+','+j)??[])
      if(Math.hypot(e.x-l.x,e.z-l.z)<.02&&Math.abs(e.c.minY-(l.y-.1))<.025&&foot<e.c.minY){e.c.minY=foot;stats.colliders++;}}
  return stats;
}
// Street-kit lamps (records with x,y,z and no `kind`): the kit's foot footprints.
export function seatKitLamps(lamps,colliders,ground,{toe=.03}={}) {
  return seatRecords(Array.isArray(lamps)?lamps.filter(l=>l&&typeof l==='object'&&l.kind===undefined):lamps,colliders,ground,{radius:l=>lampFootprint(l).r,toe});
}
// Builder-side seating (drawing code with ctx.world): the drawn ground is the sampler's terrain + replacement tops
// (cityGround: support bodies such as a plinth's own collider are not counted as its ground; a quay cell the land mask
// calls water keeps its DEM triangle when that is above the water line). seatedBottom returns the bottom a base must
// reach: min(nominal, footprint minimum − toe). Use it for the lowest part only; keep the rest of the assembly in place.
export function drawnGroundOf(world){const o={normal:{}},wl=world.terrain?.waterLevel??0;
  return (x,z,ref=Infinity)=>{world.sampler.cityGround(x,z,o,ref);if(!o.water)return o.height;const h=world.height(x,z);return h>wl+.05?h:null;};}
export function seatedBottom(ground,fp,nominal,{toe=.03,ref=nominal+.5}={}){const r=footprintRange(ground,fp,ref);return r.n?Math.min(nominal,r.lo-toe):nominal;}
