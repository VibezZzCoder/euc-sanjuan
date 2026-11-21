/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Bahía Urbana visuals — © 2026 VibezZzCoder, MIT. Every position and dimension comes from sj-bahia-layout.js (the shared
// physical owner). References (view-only Wikimedia Commons): B1 terracotta plaza, concrete
// light pylons with lantern heads, palms in round planters, white pergolas; B2/B5 grey-brown linear pavers, dark curved
// flat-bar railing posts with a light handrail and horizontal rods, the footbridge on concrete piers; B3 raised square
// planters with trees, slim lattice light towers; B4 white obelisk; B6 unrailed quay with yellow bollards; B7 bronze
// sculpture on a stone plinth in a low basin.
// Mobile budget: the whole area draws through a handful of area-wide pools (instanced box/cylinder/icosahedron, one merged
// solid and one merged leaf batch, one water batch) instead of the 64 m spatial pools, plus the shared palm instancing.
import * as THREE from 'three/webgpu';
import { glowLamp } from './sj-glow.js';
import {streetKit} from './sj-street-kit.js';
import {smallWaterMaterial,compileAtBoot} from './sj-sea.js';

const hash01=(x,z)=>{let h=Math.imul(Math.round(x*10)|0,374761393)^Math.imul(Math.round(z*10)|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const CONCRETE='#c9c4b8',PYLON='#a19e97',RAIL_POST='#2f3433',HANDRAIL='#c8ccca',ROD='#8d9493',WHITE='#eeece6',BRONZE='#6f5236';

// B2/B5: grey-brown linear pavers (~0.6 × 0.2 m, stretcher bond) with a few darker units. One 256 px tile = 4 m.
export function linearTexture(textures) {
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  let seed=51173;const r=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  x.fillStyle='#5f5a54';x.fillRect(0,0,256,256);
  const w=38.4,h=12.8;for(let j=0;j<20;j++)for(let i=-1;i<8;i++){const ox=i*w+(j%2)*w/2,dark=r()<.18,v=r()*14|0;
    x.fillStyle=dark?`rgb(${104+v},${98+v},${92+v})`:`rgb(${138+v},${131+v},${122+v})`;x.fillRect(ox+1,j*h+1,w-2,h-2);}
  for(let k=0;k<5000;k++){x.fillStyle=r()<.5?'rgba(40,36,30,.07)':'rgba(255,250,240,.06)';x.fillRect(r()*256,r()*256,1,1);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;textures.add(t);return t;
}
// B1/B7: terracotta square pavers (~0.4 m) with warm grey joints, a few paler and darker units. One tile = 4 m.
export function terraTexture(textures) {
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  let seed=70411;const r=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  x.fillStyle='#8f7f72';x.fillRect(0,0,256,256);
  const s=25.6;for(let j=0;j<10;j++)for(let i=0;i<10;i++){const v=r()*14|0,pale=r()<.05;
    x.fillStyle=pale?`rgb(${176+v},${142+v},${128+v})`:`rgb(${150+v},${104+v},${92+v})`;x.fillRect(i*s+1.2,j*s+1.2,s-2.4,s-2.4);}
  for(let k=0;k<5000;k++){x.fillStyle=r()<.5?'rgba(50,30,20,.07)':'rgba(255,240,225,.06)';x.fillRect(r()*256,r()*256,1,1);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;textures.add(t);return t;
}

export function buildBahia(n,ctx) {
  const {scene,own,box,sphere,mat,meshes,height}=ctx;
  // every pool and batch is split at x 1045 into two sectors (each < 400 m across, so frustum
  // culling works); only palm and tree crowns cast shadows; the shared low-poly icosahedron (20 faces) replaces the 80-face
  // sphere for crowns and shrubs; rail rods are single double-sided quads.
  const cylinder=own(new THREE.CylinderGeometry(1,1,1,8)),plane=own(new THREE.PlaneGeometry(1,1));void sphere;const ico=own(new THREE.IcosahedronGeometry(1,0));const icoFine=own(new THREE.SphereGeometry(1,7,4));   // smooth 42-triangle lobe for tree crowns (was an 80-face icosahedron)
  const solidMat=mat({vertexColors:true,roughness:.86,metalness:0}),leafMat=mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const pools=new Map(),batches={},region=x=>x<1045?'w':'e',batch=(kind,x)=>{const k=kind+'|'+(kind==='water'?'all':region(x));   // the fountain and pond water share one batch
    return batches[k]??=({kind,p:[],n:[],c:[]});};
  const o=new THREE.Object3D(),m4=new THREE.Matrix4(),nm=new THREE.Matrix3(),col=new THREE.Color(),vv=new THREE.Vector3(),nn=new THREE.Vector3();
  // Same contract as sj-plaza.js bake: Ry(ry)·Rz(rz), scale (sx,sy,sz). Primitives become instances in area-wide pools
  // (box and leaf split west/east of x 1045 for culling); any other geometry is merged into the solid or leaf batch.
  function bake(g,x,y,z,sx,sy,sz,paint,ry=0,kind='solid',rz=0) {
    o.position.set(x,y,z);o.rotation.set(0,ry,rz);o.scale.set(sx,sy,sz);o.updateMatrix();col.set(paint);
    if(g===sphere)g=ico;   // the shared kit's crowns/limbs come through here too
    // (cost): cylinders and the closed shrub/hedge lobes join the sector's merged solid batch (same lit
    // vertex-colour material; the shrubs are closed shapes, single-sided is enough) — four fewer draws in the park views.
    const merge=g===cylinder||g===ico&&kind==='leaf';if(merge&&kind==='leaf')kind='solid';
    const leaf=kind==='leaf'||kind==='crown'||kind==='rod',prim=merge?null:g===box?'box':g===ico?'sph':g===icoFine?'sph':g===plane?'plane':null;
    if(prim){const id=`${prim}|${kind==='crown'?'crown':leaf?'leaf':'solid'}|${region(x)}`;let pool=pools.get(id);
      if(!pool)pools.set(id,pool={g,leaf,cast:kind==='crown',m:[],c:[]});pool.m.push(...o.matrix.elements);pool.c.push(col.r,col.g,col.b);return;}
    m4.copy(o.matrix);nm.getNormalMatrix(m4);const b=batch(leaf?'leaf':kind==='water'?'water':'solid',x+(g.boundingSphere??(g.computeBoundingSphere(),g.boundingSphere)).center.x),P=g.attributes.position,N=g.attributes.normal,I=g.index;
    for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;vv.fromBufferAttribute(P,j).applyMatrix4(m4);nn.fromBufferAttribute(N,j).applyNormalMatrix(nm);
      b.p.push(vv.x,vv.y,vv.z);b.n.push(nn.x,nn.y,nn.z);b.c.push(col.r,col.g,col.b);}
  }
  // Flat-shaded triangle straight into a batch (deck, water, basins).
  // dir: the side the face must look at (winding flipped to match; the materials are single-sided).
  const tri=(a,b,c,paint,kind='solid',dir=null)=>{const B=batch(kind,a[0]),ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],wx=c[0]-a[0],wy=c[1]-a[1],wz=c[2]-a[2];
    let nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;const l=Math.hypot(nx,ny,nz);if(l<1e-9)return;nx/=l;ny/=l;nz/=l;
    if(dir&&nx*dir[0]+ny*dir[1]+nz*dir[2]<0){[b,c]=[c,b];nx=-nx;ny=-ny;nz=-nz;}col.set(paint);
    for(const p of [a,b,c]){B.p.push(...p);B.n.push(nx,ny,nz);B.c.push(col.r,col.g,col.b);}};
  const quad=(a,b,c,d,paint,kind='solid',dir=null)=>{tri(a,b,c,paint,kind,dir);tri(a,c,d,paint,kind,dir);};
  const UP=[0,1,0],DOWN=[0,-1,0];
  // Box from a to b (local +X along the segment): bake turns Ry·Rz, rz = asin(dy/l), ry = atan2(−dz,dx).
  const bar=(a,b,w,h,paint)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-4)return;
    bake(box,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,l,h,w,paint,Math.atan2(-dz,dx),'solid',Math.asin(Math.max(-1,Math.min(1,dy/l))));};
  const kit=streetKit({bake,own,box,cylinder,sphere});const stats={};

  // ---- Railings (B5): dark flat-bar posts bending out over the water at the top, a light handrail, four rods. ----
  const posts=new Set();
  const railBay=(a,b,nIn,H)=>{const out=[-nIn[0],-nIn[1]],lean=.1;
    // Perf: one slanted flat-bar per post (the outward lean in one piece), a box handrail and six rods as single quads —
    // about 36 triangles a bay.
    for(const p of [a,b]){const key=`${Math.round(p[0]*50)},${Math.round(p[2]*50)}`;if(posts.has(key))continue;posts.add(key);
      bar([p[0],p[1]-.08,p[2]],[p[0]+out[0]*lean,p[1]+H-.02,p[2]+out[1]*lean],.045,.03,RAIL_POST);}
    const A=[a[0]+out[0]*lean,a[1]+H,a[2]+out[1]*lean],B=[b[0]+out[0]*lean,b[1]+H,b[2]+out[1]*lean];bar(A,B,.055,.045,HANDRAIL);
    const rod=(p,q)=>{const dx=q[0]-p[0],dy=q[1]-p[1],dz=q[2]-p[2],l=Math.hypot(dx,dy,dz);bake(plane,(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2,l,.016,1,ROD,Math.atan2(-dz,dx),'rod',Math.asin(Math.max(-1,Math.min(1,dy/l))));};
    for(const y of [.16,.31,.46,.61,.76,.91])rod([a[0]+out[0]*lean*.3,a[1]+y,a[2]+out[1]*lean*.3],[b[0]+out[0]*lean*.3,b[1]+y,b[2]+out[1]*lean*.3]);};
  for(const r of n.rails)railBay(r.a,r.b,r.n,n.constants.RAIL.height);
  // (1129_215): the low stone bank that ends the grass beyond the railings where coast yields —
  // a stone face from the bank line to below the water, a pale coping, and an abutment block at each run end (bridge
  // landings and the hand-offs to coast's edge). Batched / pooled: no new draws.
  for(const r of n.bank??[]){const P=r.pts,L=n.constants.TONES?.lawn??['#6e9150','#76984f','#6a8b4c'];
    for(let i=0;i+1<P.length;i++){const A=P[i],B=P[i+1];if(A.skip)continue;const out=[-(A.n[0]+B.n[0])/2,0,-(A.n[1]+B.n[1])/2];
      // The kept grass strip (render-only turf over the cut terrain, lawn tones), the stone face and the coping.
      if(!A.paved)quad([A.ix,A.iy,A.iz],[B.ix,B.iy,B.iz],[B.x,B.y,B.z],[A.x,A.y,A.z],L[i%3],'solid',UP);   // no turf over this area's own paving
      const wa=Math.min(.35,A.y-.05),wb=Math.min(.35,B.y-.05);   // a darker wet band from just above the water down
      quad([A.x,A.y,A.z],[A.x,wa,A.z],[B.x,wb,B.z],[B.x,B.y,B.z],'#8a8273','solid',out);quad([A.x,wa,A.z],[A.x,-1.2,A.z],[B.x,-1.2,B.z],[B.x,wb,B.z],'#5d5f59','solid',out);
      const ox=out[0]*.11,oz=out[2]*.11;bar([A.x+ox,A.y+.03,A.z+oz],[B.x+ox,B.y+.03,B.z+oz],.26,.12,'#bcb5a6');}
    // the run ends are stone abutments covering the whole strip (rail side to bank face) up to the local
    // ground, so the coping never climbs into a turf triangle at a landing or a coast hand-off.
    for(const E of [P[0],P.at(-1)]){const top=Math.max(E.y,E.iy)+.16;bake(box,(E.x+E.ix)/2,(top-1.2)/2,(E.z+E.iz)/2,1.0,top+1.2,1.35,'#a39f95',Math.atan2(E.n[0],E.n[1]));
      bake(box,(E.x+E.ix)/2,top+.04,(E.z+E.iz)/2,1.1,.08,1.45,'#bcb5a6',Math.atan2(E.n[0],E.n[1]));}}
  stats.railBays=n.rails.length;

  // ---- Footbridge (B5): the deck top is exactly the layout's support triangles; edge faces and a soffit, rails both sides,
  // paired round piers under cross beams. ----
  {const rows=n.deckRows,T=n.constants.DECK.thick;
    // construction joints read as a slightly darker tone on every fourth 1.6 m bay of the deck.
    n.deckTriangles.forEach((t,i)=>tri(t[0],t[1],t[2],Math.floor(i/8)%4===3?'#b4afa4':CONCRETE,'solid',UP));
    for(let r=0;r+1<rows.length;r++){const A=rows[r].row,B=rows[r+1].row;
      for(const [k,sd] of [[0,-1],[4,1]]){const a=A[k],b=B[k],a2=[a[0],a[1]-T,a[2]],b2=[b[0],b[1]-T,b[2]],p=rows[r].p;quad(a,a2,b2,b,'#b9b4a8','solid',[p.nx*sd,0,p.nz*sd]);}
      const s0=[A[0][0],A[0][1]-T,A[0][2]],s1=[A[4][0],A[4][1]-T,A[4][2]],s2=[B[4][0],B[4][1]-T,B[4][2]],s3=[B[0][0],B[0][1]-T,B[0][2]];quad(s0,s1,s2,s3,'#8f8a80','solid',DOWN);}
    const sides=[-1,1].map(sd=>n.deckRails.filter(q=>q.side===sd));
    for(const list of sides)for(let i=0;i+1<list.length;i++){const a=list[i],b=list[i+1],p=rows[a.r].p,nIn=[-p.nx*a.side,-p.nz*a.side];railBay([a.x,a.y,a.z],[b.x,b.y,b.z],nIn,n.constants.RAIL.height);}
    for(const pr of n.piers){for(const sd of [-1.3,1.3])bake(cylinder,pr.x+pr.nx*sd,(pr.y-2.6)/2,pr.z+pr.nz*sd,.32,pr.y+2.6,.32,'#a9a59b');
      bake(box,pr.x,pr.y-.33,pr.z,.7,.6,4.2,'#a39f95',Math.atan2(-pr.uz,pr.ux));}   // cap top 3 cm inside the deck slab (was on the deck plane)
    stats.deckTriangles=n.deckTriangles.length;}

  // ---- Light pylons (B1) and lattice towers (B3). ----
  for(const l of n.lamps){const {x,y,z,ang}=l,c=Math.cos(ang),s=Math.sin(ang),P=(u,v)=>[x+c*u+s*v,z-s*u+c*v];
    const f=l.foot??y-.05,pt=(t0)=>Math.max(y+t0,(l.hi??-1e9)+.06);   // plinth top: level, ≥6 cm above the uphill ground
    if(l.kind==='pylon'){{const t=pt(.25);bake(box,x,(f-.02+t)/2,z,.62,t+.02-f,.48,'#8b8880',ang);}bake(box,x,(f+y+4.0)/2,z,.46,y+4.0-f,.34,PYLON,ang);   // shaft rooted with the base (seating scan reads the shaft)
      for(const [u,v] of [[-.27,-.21],[.27,-.21],[.27,.21],[-.27,.21]]){const [px,pz]=P(u,v);bake(box,px,y+4.3,pz,.05,.6,.05,'#3b3f3e',ang);}
      bake(box,x,y+4.28,z,.42,.48,.32,'#f1e8c8',ang);glowLamp(x,y+4.28,z,'pylon',{ground:y});bake(box,x,y+4.64,z,.66,.08,.52,'#3b3f3e',ang);bake(box,x,y+4.02,z,.62,.06,.5,'#3b3f3e',ang);}
    else{// an open lattice — four corner angles and crossed braces on every face, a boxed head.
      const C=[[-.16,-.16],[.16,-.16],[.16,.16],[-.16,.16]].map(([u,v])=>P(u,v));{const t=pt(.24);bake(box,x,(f+t)/2,z,.44,t-f,.44,'#5d6260',ang);}
      for(const [px,pz] of C)bake(box,px,y+2.15,pz,.04,4.1,.04,'#646a68',ang);
      for(let k=0;k<4;k++){const a=C[k],b=C[(k+1)%4];for(let lv=0;lv<3;lv++){const y0=y+.4+lv*1.23,y1=y0+1.23,[p,q]=lv%2?[b,a]:[a,b];bar([p[0],y0,p[1]],[q[0],y1,q[1]],.02,.02,'#7c8280');}}
      bake(box,x,y+4.45,z,.42,.6,.42,'#e8e6de',ang);glowLamp(x,y+4.45,z,'lattice',{ground:y});bake(box,x,y+4.8,z,.5,.1,.5,'#5d6260',ang);}}
  // ---- Benches (shared kit), palms (shared instancing) with round planter rings on paving, raised planters with trees. ----
  kit.benches(n.benches);
  // Perf: a low-poly coconut palm (curved 5-sided trunk, boot, three nuts, eight fronds; ~100-triangle crown) instanced per
  // sector with per-palm yaw and height; same silhouette rules as the shared palm (boot plus nut bunch, no ball).
  {const sol={p:[],n:[],c:[]},lf={p:[],n:[],c:[]},H=9.2,lean=.2,pts=[];for(let i=0;i<=4;i++){const t=i/4;pts.push([lean*H*t*t*.5,H*t,0]);}
    const push=(B,g,paint)=>{col.set(paint);const P=g.attributes.position,N=g.attributes.normal,I=g.index;for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;B.p.push(P.getX(j),P.getY(j),P.getZ(j));B.n.push(N.getX(j),N.getY(j),N.getZ(j));B.c.push(col.r,col.g,col.b);}};
    const trunk=kit.tube(pts,.2,.14,5);push(sol,trunk,'#8b8069');trunk.dispose();
    const c=pts[4],boot=new THREE.CylinderGeometry(.3,.17,.8,6,1,true);boot.translate(c[0],c[1]-.15,c[2]);push(sol,boot,'#6b5a3b');boot.dispose();
    for(let k=0;k<3;k++){const a=k*2.1,nut=new THREE.OctahedronGeometry(.14,0);nut.translate(c[0]+Math.cos(a)*.3,c[1]-.35,c[2]+Math.sin(a)*.3);push(sol,nut,'#8a8738');nut.dispose();}
    // (1173_65 / 1095_96, Wikimedia Commons curid=137843368, curid=71816504): fuller near crowns — nine arching fronds whose leaflets
    // hang as two continuous drooping fans (a V under the rachis) with a comb edge, instead of separate triangles with gaps.
    // 8 fronds × 3 segments × 2 sides × 2 triangles = 96 crown triangles (was 144) (the park's palms all stand within ~30 m of a
    // walk; the old 470-triangle shared crown is not restored). Same two instanced meshes per sector: no new draws.
    for(let j=0;j<8;j++){const a=j*2*Math.PI/8+(j%2)*.14,L=3.7+(j%3)*.35,up=j%3===0?.75:.5,droop=j%3===0?.9:1.15,
        pt=u=>[c[0]+Math.cos(a)*L*u,c[1]+L*(up*u-droop*u*u),c[2]+Math.sin(a)*L*u],tris=[],S=3;
      const leaf=(u,sd,k)=>{const p=pt(u),w=(.95*Math.sin(Math.min(1,u*1.15)*Math.PI*.92)+.08)*(k%2?.78:1),ang=a+sd*1.35,f=.25;
        return [p[0]+Math.cos(ang)*w*.62+Math.cos(a)*w*f,p[1]-w*.78,p[2]+Math.sin(ang)*w*.62+Math.sin(a)*w*f];};
      for(let q=0;q<S;q++){const u0=q/S,u1=(q+1)/S,p0=pt(u0),p1=pt(u1);
        for(const sd of [-1,1]){const l0=leaf(u0,sd,q),l1=leaf(u1,sd,q+1);tris.push(...p0,...p1,...l1,...p0,...l1,...l0);}}
      const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(tris,3));fg.computeVertexNormals();push(lf,fg,['#3b6337','#4d7240','#5f8448'][j%3]);fg.dispose();}
    const geo=B=>{const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(B.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(B.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(B.c,3));g.computeBoundingSphere();return g;};
    const gs=geo(sol),gl=geo(lf);
    for(const r of ['w','e']){const list=n.palms.filter(p=>region(p.x)===r);if(!list.length)continue;
      for(const [g,m,kind] of [[gs,solidMat,'solid'],[gl,leafMat,'leaf']]){const mesh=new THREE.InstancedMesh(g,m,list.length);
        list.forEach((p,i)=>{o.position.set(p.x,p.y-.15,p.z);o.rotation.set(0,p.yaw,0);const h=.85+hash01(p.x,p.z)*.3;o.scale.set(1,h,1);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
        mesh.name=`sj-plaza-bahia-palm-${kind}-${r}`;mesh.castShadow=kind==='leaf';mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);}}}
  for(const p of n.palms)if(p.ring){const f=p.foot??p.y-.07;bake(cylinder,p.x,(f+p.y+.43)/2,p.z,.95,p.y+.43-f,.95,'#d6d0c3');bake(cylinder,p.x,p.y+.44,p.z,.8,.04,.8,'#4d3d2d');}
  for(const p of n.planters){const H=p.top-p.g+.1;bake(box,p.x,p.g-.1+H/2,p.z,p.w,H,p.w,'#cdc8bc');bake(box,p.x,p.top+.01,p.z,p.w-.36,.04,p.w-.36,'#4b3c2c');
    bake(box,p.x,p.top+.025,p.z,p.w+.12,.05,.12,'#bdb8ac',0);   // coping lip (front)
    for(const [dx,dz] of [[-.9,-.9],[.9,.8],[.8,-.9]])bake(ico,p.x+dx*p.w/4,p.top+.28,p.z+dz*p.w/4,.55,.36,.55,'#4c7a45',0,'leaf');}
  // Perf: shade trees as a 5-sided trunk tube and three low-poly crown lobes (60 triangles, casting) instead of the kit's
  // limbed form (~500 triangles).
  for(const t of n.trees){const sc=t.scale,H=3.4*sc,tr=kit.tube([[t.x,t.y-.15,t.z],[t.x,t.y+H*.5,t.z],[t.x+.15*sc,t.y+H,t.z]],.3*sc,.18*sc,5);bake(tr,0,0,0,1,1,1,'#6f6553');tr.dispose();
    // (canopy silhouette): two overlapping smooth-shaded lobes (subdivided icosahedron, 80
    // faces each, rounder than the faceted 20-face lobes) — 160 crown triangles a tree, the same crown pools (no new draws).
    // per-tree outline variation (lobe spread, height and flattening from a hash) so the crowns are not
    // identical ovals.
    {const a=t.x*1.7,v=hash01(t.x,t.z),w=hash01(t.z,t.x);
      bake(icoFine,t.x+Math.cos(a)*(.5+v*.6)*sc,t.y+H+(1.1+w*.3)*sc,t.z+Math.sin(a)*(.5+v*.6)*sc,(2.3+v*.5)*sc,(1.45+w*.4)*sc,(2.1+w*.4)*sc,['#3d6339','#4a7044','#355a36'][Math.round(t.z)%3],a,'crown');
      bake(icoFine,t.x-Math.cos(a)*(.7+w*.6)*sc,t.y+H+(1.7+v*.5)*sc,t.z-Math.sin(a)*(.7+w*.6)*sc,(1.7+w*.5)*sc,(1.2+v*.3)*sc,(1.6+v*.4)*sc,'#4b7246',a+1,'crown');}}
  for(const s of n.shrubs)bake(ico,s.x,s.y+.42,s.z,.85*s.s+.1,.55,.8*s.s+.1,['#3f6e3d','#4a7b44','#386636'][Math.round(s.x)%3],s.x,'leaf');

  // ---- Pergolas (B1), umbrella canopies (B3), bike racks, bollards (B6). ----
  for(const g of n.pergolas){const c=Math.cos(g.ang),s=Math.sin(g.ang),P=(u,v)=>[g.x+c*u+s*v,g.z-s*u+c*v],top=g.g+2.75;
    for(const p of g.posts){const y=height(...p);bake(box,p[0],(y-.05+top)/2,p[1],.14,top-y+.05,.14,WHITE,g.ang);}
    for(const v of [-g.W/2+.2,g.W/2-.2]){const [x,z]=P(0,v);bake(box,x,top+.09,z,g.L+.3,.18,.12,WHITE,g.ang);}
    for(let u=-g.L/2+.25;u<=g.L/2-.2;u+=.42){const [x,z]=P(u,0);bake(box,x,top+.23,z,.06,.1,g.W+.3,'#f4f2ec',g.ang);}}
  const cone=own(new THREE.ConeGeometry(1,1,12,1,true));
  for(const q of n.canopies){const f=q.foot??q.y;bake(cylinder,q.x,(f+q.y+3.6)/2,q.z,.14,q.y+3.6-f,.14,WHITE);bake(cone,q.x,q.y+3.32,q.z,q.r,.55,q.r,'#f3f2ee',0,'solid',Math.PI);
    bake(cylinder,q.x,q.y+3.62,q.z,q.r,.06,q.r,'#e9e8e2');}
  for(const r of n.racks)for(const k of [-1,0,1]){const x=r.x+k*.9,y=height(x,r.z);for(const d of [-.33,.33])bake(box,x,y+.38,r.z+d,.05,.84,.05,'#8e9493');bake(box,x,y+.8,r.z,.05,.05,.71,'#8e9493');}
  for(const b of n.bollards){const f=b.foot??b.y;bake(box,b.x,(f+b.y+.1)/2,b.z,.7,b.y+.1-f,.7,'#3a3c3a');bake(cylinder,b.x,b.y+.3,b.z,.22,.5,.22,'#d6b33b');bake(cylinder,b.x,b.y+.58,b.z,.3,.1,.3,'#d6b33b');}

  // ---- Fountain (B7): low rim on the mapped basin, water, a stone plinth with dark tile panels, a tall bronze figure of
  // leaf blades (form simplified), water spouts. ----
  {const f=n.fountain,ring=f.basin;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ga=height(...a),gb=height(...b);
      const L=Math.hypot(b[0]-a[0],b[1]-a[1]),cx=(a[0]+b[0])/2,cz=(a[1]+b[1])/2,lo=Math.min(ga,gb)-.12;
      bake(box,cx,(lo+f.rim)/2,cz,L+.3,f.rim-lo,.3,'#d9d4c6',Math.atan2(-(b[1]-a[1]),b[0]-a[0]));}
    const w=f.rim-.1,c=[f.x,w,f.z];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];tri(c,[b[0],w,b[1]],[a[0],w,a[1]],'#3d6c73','water',UP);}
    const y0=f.g;bake(box,f.x,y0+1.35,f.z,1.3,2.7,1.3,'#8d9893');for(const k of [0,1,2,3])bake(box,f.x+Math.sin(k*Math.PI/2)*.66,y0+1.5,f.z+Math.cos(k*Math.PI/2)*.66,.8,1.6,.03,'#3f4f4c',k*Math.PI/2);
    bake(box,f.x,y0+2.76,f.z,1.45,.12,1.45,'#b9bdb5');
    // tapered, twisting bronze ribbons spreading from the plinth into a broad upper silhouette (double-sided
    // strips; form simplified, read from the three B7 views).
    const ribbon=(ang,lean,len,w0,twist)=>{const N=7;let prev=null;
      for(let i=0;i<=N;i++){const t=i/N,r=lean*len*t*t,ya=y0+2.8+len*t,a=ang+twist*t,w=w0*(1-.75*t)+.04,cx=f.x+Math.cos(ang)*r,cz=f.z+Math.sin(ang)*r;
        const L=[cx-Math.sin(a)*w/2,ya,cz+Math.cos(a)*w/2],R=[cx+Math.sin(a)*w/2,ya,cz-Math.cos(a)*w/2];
        if(prev){const nrm=[Math.cos(a),0,Math.sin(a)];quad(prev[0],prev[1],R,L,BRONZE,'solid',nrm);quad(prev[0],prev[1],R,L,'#5f4630','solid',[-nrm[0],0,-nrm[2]]);}prev=[L,R];}};
    for(const [ang,lean,len,w0,tw] of [[0,.3,3.8,1.0,.9],[1.3,.42,3.2,.9,-.8],[2.5,.26,4.1,.85,1.1],[3.7,.4,2.9,.9,-1.0],[4.9,.32,3.5,.9,.7]])ribbon(ang,lean,len,w0,tw);
    bar([f.x,y0+2.8,f.z],[f.x,y0+4.4,f.z],.32,.32,BRONZE);
    for(const k of [0,1,2,3]){const a=k*Math.PI/2;bar([f.x+Math.sin(a)*.7,y0+1.0,f.z+Math.cos(a)*.7],[f.x+Math.sin(a)*1.0,w+.02,f.z+Math.cos(a)*1.0],.05,.05,'#dfeef0');}}
  // ---- El Faro monument (node only; form inferred): a dark granite stele on a pale base with a bronze plaque and a small
  // lantern. Obelisk (B4). Pond (421337002) with its jet (4211120239). ----
  {const m=n.faro,f=m.foot??m.y-.02;bake(box,m.x,(f+m.y+.18)/2,m.z,1.7,m.y+.18-f,.9,'#cfcabd');bake(box,m.x,m.y+1.3,m.z,1.2,2.3,.5,'#4d5052');bake(box,m.x,m.y+1.35,m.z+.26,.7,.5,.02,'#8a6a3e');
    bake(box,m.x,m.y+2.55,m.z,.36,.2,.36,'#2f3231');bake(box,m.x,m.y+2.72,m.z,.26,.18,.26,'#f0e3b8');glowLamp(m.x,m.y+2.72,m.z,'faro',{ground:m.y});}
  // Obelisk (B4, B09): a tall flat-topped white blade on a low base, with the curved cream seat wall and hedge.
  {const m=n.obelisk,f=m.foot??m.y;bake(box,m.x,(f+m.y+.6)/2,m.z,1.5,m.y+.6-f,1.5,'#dedbd2');bake(box,m.x,m.y+3.65,m.z,.55,6.1,1.25,'#f0eee8',.35);bake(box,m.x,m.y+6.74,m.z,.62,.08,1.32,'#e2dfd7',.35);
    for(const sg of n.obeliskSet.seat){const L=Math.hypot(sg.q[0]-sg.p[0],sg.q[1]-sg.p[1]),ry=Math.atan2(-(sg.q[1]-sg.p[1]),sg.q[0]-sg.p[0]),H=sg.y+sg.h-(sg.g-.1);
      bake(box,(sg.p[0]+sg.q[0])/2,sg.g-.1+H/2,(sg.p[1]+sg.q[1])/2,L+.05,H,sg.w,'#e4dccb',ry);bake(box,(sg.p[0]+sg.q[0])/2,sg.y+sg.h+.03,(sg.p[1]+sg.q[1])/2,L+.08,.06,sg.w+.1,'#f1ece0',ry);}
    for(const sg of n.obeliskSet.hedge){const L=Math.hypot(sg.q[0]-sg.p[0],sg.q[1]-sg.p[1]),ry=Math.atan2(-(sg.q[1]-sg.p[1]),sg.q[0]-sg.p[0]),H=sg.y+sg.h-(sg.g-.1);
      bake(box,(sg.p[0]+sg.q[0])/2,sg.g-.1+H/2,(sg.p[1]+sg.q[1])/2,L+.1,H,sg.w,'#3d6a39',ry);bake(ico,(sg.p[0]+sg.q[0])/2,sg.y+sg.h,(sg.p[1]+sg.q[1])/2,L*.55,.18,sg.w*.6,'#467541',ry,'leaf');}}
  // Seat-planters on the plazas (B11, B1): a long cream box with a cap and low shrubs.
  for(const q of n.seatPlanters){const H=q.top-q.g+.1;bake(box,q.x,q.g-.1+H/2,q.z,3.2,H,1.1,'#d9d3c6',q.ang);bake(box,q.x,q.top+.03,q.z,3.35,.06,1.25,'#ece7dc',q.ang);
    for(const u of [-1.05,0,1.05])bake(ico,q.x+Math.cos(q.ang)*u,q.top+.32,q.z-Math.sin(q.ang)*u,.58,.4,.45,['#3f6e3d','#4a7b44','#386636'][Math.round(u+1)],0,'leaf');}
  {const p=n.pond,ring=p.ring;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ga=height(...a),gb=height(...b),L=Math.hypot(b[0]-a[0],b[1]-a[1]),lo=Math.min(ga,gb)-.12;
      bake(box,(a[0]+b[0])/2,(lo+p.rim)/2,(a[1]+b[1])/2,L+.32,p.rim-lo,.32,'#d4cfc2',Math.atan2(-(b[1]-a[1]),b[0]-a[0]));}
    const w=p.rim-.1,c=ring.reduce((s,q)=>[s[0]+q[0]/ring.length,s[1]+q[1]/ring.length],[0,0]);
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];tri([c[0],w,c[1]],[b[0],w,b[1]],[a[0],w,a[1]],'#3a6870','water',UP);}
    // a coping lip, a low nozzle with a split spray and a pale foam ring instead of the pole and ball.
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);bake(box,(a[0]+b[0])/2,p.rim+.03,(a[1]+b[1])/2,L+.5,.06,.5,'#ebe7dc',Math.atan2(-(b[1]-a[1]),b[0]-a[0]));}
    bake(cylinder,p.jet[0],w+.08,p.jet[1],.12,.16,.12,'#8d918f');bake(cylinder,p.jet[0],w+.015,p.jet[1],.75,.02,.75,'#cfe3e5',0,'water');
    for(let k=0;k<6;k++){const a=k*Math.PI/3,o=[p.jet[0]+Math.cos(a)*.45,w+.95,p.jet[1]+Math.sin(a)*.45];bar([p.jet[0],w+.12,p.jet[1]],o,.035,.035,'#e3eff1');}
    bar([p.jet[0],w+.12,p.jet[1]],[p.jet[0],w+1.35,p.jet[1]],.05,.05,'#eef6f7');}

  // ---- Owned buildings (no photos; simple modern exteriors, inferred): a dark glazed ground floor with white mullions, a
  // window band above when tall enough, a white fascia; Café Ocho also gets a terrace canopy on its longest face. ----
  {const outward=(ring,i)=>{const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      const t=[m[0]-dz/l*.05,m[1]+dx/l*.05];let inside=false;for(let k=0,j=ring.length-1;k<ring.length;j=k++){const p=ring[k],q=ring[j];if((p[1]>t[1])!==(q[1]>t[1])&&t[0]<(q[0]-p[0])*(t[1]-p[1])/(q[1]-p[1])+p[0])inside=!inside;}
      return inside?[dz/l,-dx/l]:[-dz/l,dx/l];};
    for(const s of n.shells){let longest=null;
      for(let i=0;i<s.outer.length;i++){const a=s.outer[i],b=s.outer[(i+1)%s.outer.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<2)continue;
        const nO=outward(s.outer,i),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L,ry=-Math.atan2(uz,ux),P=(u,d)=>[a[0]+ux*u+nO[0]*d,a[1]+uz*u+nO[1]*d];
        const g=Math.min(height(...a),height(...b));if(!longest||L>longest.L)longest={a,b,L,nO,ux,uz,ry,P,g};
        {const [x,z]=P(L/2,.04);bake(box,x,s.roof-.18,z,L+.08,.4,.1,'#f4f2ec',ry);}
        if(L>3){const [x,z]=P(L/2,.0175),y0=Math.max(g,s.base)+.35,y1=Math.min(s.roof-1.2,y0+2.6);if(y1-y0>1.5){bake(box,x,(y0+y1)/2,z,L-.7,y1-y0,.075,s.id===421337004?'#2e3b40':'#4b6670',ry);
            for(let u=.35;u<=L-.34;u+=1.6){const [mx,mz]=P(u,.06);bake(box,mx,(y0+y1)/2,mz,.07,y1-y0,.05,'#f0eee8',ry);}}
          if(s.roof-s.base>6.5){const [x2,z2]=P(L/2,.0075),w0=y1+1.0,w1=Math.min(s.roof-.6,w0+1.1);if(w1-w0>.6)bake(box,x2,(w0+w1)/2,z2,L-1.0,w1-w0,.095,'#3a474c',ry);}}}
      if(s.id===421337004&&n.cafe){const c=n.cafe,P=(u,d)=>[c.a[0]+c.u[0]*u+c.n[0]*d,c.a[1]+c.u[1]*u+c.n[1]*d],ry=-Math.atan2(c.u[1],c.u[0]),[x,z]=P(c.L/2,1.1);
        bake(box,x,c.y,z,c.L-.6,.16,2.2,'#f2f0ea',ry);for(const q of c.posts)bake(cylinder,q.x,(q.y+c.y)/2,q.z,.09,c.y-q.y,.09,'#5c6260');
        // Entry bay (B11): a projecting white frame and a lighter glazed door pair in the middle of the face.
        {const [ex,ez]=P(c.L/2,.1),g=Math.max(height(ex,ez),s.base);bake(box,ex,g+1.45,ez,2.6,2.9,.28,'#f6f4ee',ry);const [dx,dz]=P(c.L/2,.25);bake(box,dx,g+1.2,dz,1.8,2.3,.04,'#6f8a94',ry);}}}}

  // ---- Emit the pools and batches. ----
  for(const [id,pool] of pools){const count=pool.c.length/3,mesh=new THREE.InstancedMesh(pool.g,pool.leaf?leafMat:solidMat,count);mesh.userData.cast=pool.cast;
    mesh.instanceMatrix.array.set(pool.m);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(pool.c),3);
    mesh.name='sj-plaza-bahia-'+id.replaceAll('|','-');mesh.castShadow=!!pool.cast;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);}
  const waterMat=smallWaterMaterial({vertexColors:true});ctx.materials?.add(waterMat);   // js/sj-sea.js: ripple, sky Fresnel, sun
  for(const [key,b] of Object.entries(batches)){const kind=b.kind;if(!b.p.length)continue;const g=own(new THREE.BufferGeometry());
    g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,kind==='leaf'?leafMat:kind==='water'?waterMat:solidMat);mesh.name='sj-plaza-bahia-'+key.replace('|','-');
    mesh.castShadow=false;mesh.receiveShadow=true;if(kind==='water')compileAtBoot(mesh);scene.add(mesh);meshes.push(mesh);}
  return {...stats,lamps:n.lamps.length,benches:n.benches.length,palms:n.palms.length,trees:n.trees.length,planters:n.planters.length,
    pergolas:n.pergolas.length,canopies:n.canopies.length,bollards:n.bollards.length,racks:n.racks.length,pools:pools.size};
}
