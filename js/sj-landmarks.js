/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Landmarks visuals — © 2026 VibezZzCoder, MIT. All dimensions come from sj-landmarks-layout.js (shared physical owner).
// ctx: {scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height} — the shared pools (instanced primitives, batched
// custom geometry). References (view only): La Fortaleza — Calle Fortaleza 1 (2025) and
// Calle de La Fortaleza (2012): dark iron gate between masonry piers at the street end, powder-blue palace with white
// pilasters, arched windows and a white balustrade behind. Capilla del Cristo DSC07130 (2011): weathered stone front, one
// round barred portal in a brick-red ring, corner urns, a bell-gable with one bell and a cross. Parque de las Palomas
// DSC07141 (2011) and the 2009 paving photo: rough stone wall with square nesting holes and vines, dark stone panels.
// Teatro Tapia DSC06972 (2011): ochre ground arcade of dark arches, yellow upper storeys, white pilasters, terracotta
// pediment. Antiguo Casino (2017): white Beaux-Arts front, rusticated base, arched ground openings, dark steep mansard.
// Santa Ana (2026): pink front, white pilasters, arched portal, oculus, curved shoulders, asymmetric belfry. San Francisco
// (2024/2011): yellow chapel, cream buttress pilasters, west door. Salvador Brau DSC06953 (2011): seated bronze on a pale
// plinth. Barandilla (2018): brick-red plates, trees, lanterns.
import * as THREE from 'three/webgpu';
import {streetKit,IRON} from './sj-street-kit.js';
import { glowPane } from './sj-glow.js';
import {settTexture} from './sj-streets.js';

const WHITE='#f5f3ec',DARK='#2a2724';

// Landmark pools (mobile budget; ). One group per landmark (nearest centre, by the part's REAL
// position — baked parts used to be grouped at the origin, which made one city-spanning batch), so each landmark costs a
// few draws with tight bounds (< 120 m). Shadows: only baked masses/walls/trunks and tree crowns cast; instanced trim,
// balusters, rails, lanterns, urns, bells, benches and statue parts never cast. Same vertex/instance format as sj-plaza.js.
const GROUPS=[['fortaleza',[-268,145]],['palomas',[-140,168]],['santa-ana',[122,112]],['san-francisco',[310,-90]],['colon',[530,-55]]];
// Far submission (69k triangles in 11 draws from Calle San Francisco 220–450 m away). Every
// non-casting instance pool is stored in ascending order of the pixels-per-metre at which its part first matters, so the
// parts worth drawing from a camera are always a PREFIX of the pool: a small updater (flagged isLOD like sj-fabric.js /
// sj-eastcivic.js, added before the pools) only sets `mesh.count` — no copies, no uploads, no extra memory beyond one float
// per instance. The rule is eastcivic's: a part stays if its middle dimension projects to ≥ `px` drawing-buffer pixels, or
// to ≥ `minPx` with a projected area (middle × largest) ≥ `areaPx`. The projected scale is bounded from above for the whole
// pool by its nearest bounding-sphere point and the frustum's corner angle, so no part that could reach the cutoff is
// dropped. Small non-casting baked batches switch off by the same bound. Casting pools (tree crowns) are untouched.
export const LANDMARKS_LOD={px:1,minPx:.25,areaPx:1.5,bufferHeight:800};
// Suffix-sphere checkpoint spacing: exact (every instance) for pools up to 512 instances, else every 8 (counts round up).
const stepOf=n=>n<=512?1:8;
const kStar=(S,X,L=LANDMARKS_LOD)=>S>0?Math.min(L.px/S,Math.max(L.minPx/S,Math.sqrt(L.areaPx/(S*Math.max(X,S))))):Infinity;
function sitePools({scene,own,mat,meshes,box,cylinder,sphere},crown) {
  const standard=mat({vertexColors:true,roughness:.88,metalness:0}),foliage=mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const roofParts=[];// flat-shaded roof solids drawn in the site's paving mesh (see the paving builder)
  const pools=new Map(),batches=new Map(),dummy=new THREE.Object3D(),m=new THREE.Matrix4(),nm=new THREE.Matrix3(),col=new THREE.Color(),v=new THREE.Vector3(),nv=new THREE.Vector3();
  // Assemblies: parts baked between asmBegin/asmEnd share ONE distance cutoff,
  // the smallest of their members, so a slender carrier (hanger, baluster, post, picket) is never trimmed while what it
  // carries (bell, rail, lantern) is still drawn. Parts outside an assembly hang on a wall or stand on the ground.
  let asm=0,asmN=0;const asmBegin=()=>{asm=++asmN;},asmEnd=()=>{asm=0;};
  const group=(x,z)=>{let best=0,d=Infinity;GROUPS.forEach(([,c],i)=>{const e=Math.hypot(x-c[0],z-c[1]);if(e<d){d=e;best=i;}});return best;};
  function bake(g,x,y,z,sx,sy,sz,paint,ry=0,kind='facade',rz=0){
    if(g===crown&&kind!=='leaf')g=sphere;   // lamp knobs etc. stay in the non-casting sphere pool
    dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();m.copy(dummy.matrix);col.set(paint);
    const prim=g===box?'box':g===cylinder?'cylinder':g===sphere?'sphere':g===crown?'crown':null;
    if(prim){const k=prim==='crown'?'leaf':prim==='box'&&kind==='facade'?'facade':kind==='leaf'?'leaf':'trim',gi=group(x,z),id=gi+':'+prim+':'+k;
      let p=pools.get(id);if(!p)pools.set(id,p={g,prim,kind:k,gi,t:[],c:[],a:[]});p.t.push(...m.elements);p.c.push(col.r,col.g,col.b);p.a.push(asm);return;}
    if(!g.boundingBox)g.computeBoundingBox();g.boundingBox.getCenter(v).applyMatrix4(m);const size=new THREE.Vector3();g.boundingBox.getSize(size).multiply(dummy.scale);
    if(kind!=='leaf'&&Math.max(size.x,size.y,size.z)<1&&GROUPS[group(v.x,v.z)][0]!=='santa-ana')kind='roof';// small non-casting baked parts ride in the site paving mesh (no own draw)
    if(kind==='roof'||kind==='skin'){const P=g.attributes.position,N=g.attributes.normal,I=g.index,out={gi:group(v.x,v.z),p:[],n:[],c:paint,smooth:kind==='skin'};nm.getNormalMatrix(m);
      for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;v.fromBufferAttribute(P,j).applyMatrix4(m);nv.fromBufferAttribute(N,j).applyNormalMatrix(nm);out.p.push(v.x,v.y,v.z);out.n.push(nv.x,nv.y,nv.z);}roofParts.push(out);return;}
    // Small custom parts (lantern caps, brackets…) never cast; masses, walls, gables, trunks do.
    const gi=group(v.x,v.z),k=kind==='leaf'?'leaf':Math.max(size.x,size.y,size.z)<1?'trim':'solid',id=gi+':'+k;let b=batches.get(id);if(!b)batches.set(id,b={kind:k,gi,p:[],n:[],c:[],kmin:Infinity});
    {const e=[Math.abs(size.x),Math.abs(size.y),Math.abs(size.z)].sort((a,c)=>a-c);b.kmin=Math.min(b.kmin,kStar(e[1],e[2]));}
    nm.getNormalMatrix(m);const P=g.attributes.position,N=g.attributes.normal,I=g.index;
    for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;v.fromBufferAttribute(P,j).applyMatrix4(m);nv.fromBufferAttribute(N,j).applyNormalMatrix(nm);
      b.p.push(v.x,v.y,v.z);b.n.push(nv.x,nv.y,nv.z);b.c.push(col.r,col.g,col.b);}}
  function finish(){
    // facade + trim boxes share one pool per landmark (neither casts): merge them before building meshes.
    for(const [id,p] of [...pools])if(p.prim==='box'&&p.kind==='trim'){const f=pools.get(p.gi+':box:facade');if(f){f.t.push(...p.t);f.c.push(...p.c);pools.delete(id);}else p.kind='facade';}
    // Far-submission updater first, so each pass sets counts before the pools are projected (see LANDMARKS_LOD).
    const lod=[],cull=new THREE.Object3D();cull.name='sj-plaza-landmarks-cull';cull.isLOD=true;cull.autoUpdate=true;scene.add(cull);meshes.push(cull);
    // Per-instance cutoffs first, then each assembly's minimum shared by all its members (across pools).
    const asmMin=new Map();
    for(const p of pools.values()){if(p.kind==='leaf')continue;const n=p.c.length/3;if(!p.g.boundingBox)p.g.computeBoundingBox();
      const bb=p.g.boundingBox,ex=bb.max.x-bb.min.x,ey=bb.max.y-bb.min.y,ez=bb.max.z-bb.min.z,T=p.t;p.ks=new Float32Array(n);
      for(let i=0;i<n;i++){const o=i*16,a=Math.hypot(T[o],T[o+1],T[o+2])*ex,b=Math.hypot(T[o+4],T[o+5],T[o+6])*ey,c=Math.hypot(T[o+8],T[o+9],T[o+10])*ez,mx=Math.max(a,b,c),mn=Math.min(a,b,c);
        p.ks[i]=kStar(a+b+c-mx-mn,mx);if(p.a[i])asmMin.set(p.a[i],Math.min(asmMin.get(p.a[i])??Infinity,p.ks[i]));}}
    for(const p of pools.values())if(p.ks)for(let i=0;i<p.ks.length;i++)if(p.a[i])p.ks[i]=asmMin.get(p.a[i]);
    for(const p of [...pools.values()].sort((a,b)=>a.gi-b.gi||a.prim.localeCompare(b.prim)||a.kind.localeCompare(b.kind))){
      const n=p.c.length/3,mesh=new THREE.InstancedMesh(p.g,p.kind==='leaf'?foliage:standard,n);
      if(p.kind==='leaf'){mesh.instanceMatrix.array.set(p.t);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(p.c),3);}
      else{const ks=p.ks,T=p.t;
        const order=Uint32Array.from({length:n},(_,i)=>i).sort((a,b)=>ks[a]-ks[b]||a-b),M=mesh.instanceMatrix.array,C=new Float32Array(n*3),K=new Float32Array(n);
        order.forEach((i,q)=>{for(let e=0;e<16;e++)M[q*16+e]=T[i*16+e];C[q*3]=p.c[i*3];C[q*3+1]=p.c[i*3+1];C[q*3+2]=p.c[i*3+2];K[q]=ks[i];});
        mesh.userData.assembly=Uint16Array.from(order,i=>p.a[i]);// assembly id per (sorted) instance, 0 = none
        {const mx=new Map();mesh.userData.assembly.forEach((a,q)=>{if(a)mx.set(a,q);});mesh.userData.asmMax=mx;}
        // Suffix spheres every STEP instances: sphere j bounds instances [STEP·j, n) — the parts a prefix of STEP·j leaves out.
        const STEP=stepOf(n),gs=p.g.boundingSphere??(p.g.computeBoundingSphere(),p.g.boundingSphere),cs=gs.center,m=Math.ceil(n/STEP),SS=new Float32Array(4*m),acc=new THREE.Sphere(),one=new THREE.Sphere();acc.makeEmpty();
        for(let q=n-1;q>=0;q--){const o=q*16;one.center.set(M[o]*cs.x+M[o+4]*cs.y+M[o+8]*cs.z+M[o+12],M[o+1]*cs.x+M[o+5]*cs.y+M[o+9]*cs.z+M[o+13],M[o+2]*cs.x+M[o+6]*cs.y+M[o+10]*cs.z+M[o+14]);
          one.radius=gs.radius*Math.max(Math.hypot(M[o],M[o+1],M[o+2]),Math.hypot(M[o+4],M[o+5],M[o+6]),Math.hypot(M[o+8],M[o+9],M[o+10]));acc.union(one);
          if(q%STEP===0){const j=q/STEP;SS[j*4]=acc.center.x;SS[j*4+1]=acc.center.y;SS[j*4+2]=acc.center.z;SS[j*4+3]=acc.radius;}}
        mesh.instanceColor=new THREE.InstancedBufferAttribute(C,3);lod.push({mesh,ks:K,full:n,SS,m,step:STEP});}
      mesh.castShadow=p.kind==='leaf';mesh.receiveShadow=true;
      mesh.name=`sj-plaza-landmarks-${GROUPS[p.gi][0]}-${p.prim}-${p.kind==='facade'?'trim':p.kind}`;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);}
    for(const b of [...batches.values()].sort((a,c)=>a.gi-c.gi||a.kind.localeCompare(c.kind))){
      const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,b.kind==='leaf'?foliage:standard);mesh.castShadow=b.kind!=='trim';mesh.receiveShadow=true;
      mesh.name=`sj-plaza-landmarks-${GROUPS[b.gi][0]}-baked-${b.kind}`;scene.add(mesh);meshes.push(mesh);if(b.kind==='trim')lod.push({mesh,kmin:b.kmin});}
    for(const E of lod)E.sphere=(E.mesh.isInstancedMesh?E.mesh.boundingSphere:E.mesh.geometry.boundingSphere).clone();
    // Drawing-buffer height for the pixel cutoff, read before each main-canvas render (chained, as sj-eastcivic.js).
    const view={height:LANDMARKS_LOD.bufferHeight},vb=new THREE.Vector2(),prevBefore=scene.onBeforeRender,eye=new THREE.Vector3();
    scene.onBeforeRender=function(renderer,sc,cam,target){prevBefore?.apply(this,arguments);if(!target&&renderer?.getDrawingBufferSize){renderer.getDrawingBufferSize(vb);if(vb.y>0)view.height=vb.y;}};
    // Upper bound of the pixels per metre anywhere in a sphere: nearest distance, and the depth factor cos θ at the largest
    // view angle a point of the sphere can have (capped at the frustum corner, beyond which nothing is drawn).
    const fwd=new THREE.Vector3(),kept=new Set();let ppm=0,thE=0;
    const kOf=(x,y,z,r)=>{const dx=x-eye.x,dy=y-eye.y,dz=z-eye.z,dist=Math.hypot(dx,dy,dz);if(dist<=r+.5)return Infinity;
      const th=Math.acos(Math.max(-1,Math.min(1,(dx*fwd.x+dy*fwd.y+dz*fwd.z)/dist)))+Math.asin(Math.min(1,r/dist));return ppm/((dist-r)*Math.cos(Math.min(th,thE)));};
    cull.update=camera=>{if(!camera.isPerspectiveCamera)return;camera.updateMatrixWorld();eye.setFromMatrixPosition(camera.matrixWorld);camera.getWorldDirection(fwd);
      const t=Math.tan(camera.fov*Math.PI/360)/(camera.zoom||1);ppm=view.height/(2*t);thE=Math.atan(t*Math.sqrt(1+camera.aspect*camera.aspect));
      for(const E of lod){
        if(E.ks){// Smallest checkpoint j whose left-out suffix stays below the cutoff everywhere (monotone in j).
          const ok=j=>{if(j>=E.m)return true;const s=E.SS,i=j*4;return kOf(s[i],s[i+1],s[i+2],s[i+3])<E.ks[j*E.step];};
          let lo=0,hi=E.m;while(lo<hi){const j=(lo+hi)>>1;if(ok(j))hi=j;else lo=j+1;}const c=Math.min(E.full,lo*E.step);E.mesh.count=c;E.mesh.visible=c>0;}
        else{const s=E.sphere;E.mesh.visible=kOf(s.center.x,s.center.y,s.center.z,s.radius)>=E.kmin;}}
      // Assemblies are drawn whole: any member inside a prefix keeps the assembly, and every pool's count is raised to its
      // last member of a kept assembly; repeated until stable (counts only grow, so it terminates).
      kept.clear();for(let changed=true;changed;){changed=false;
        for(const E of lod){if(!E.ks)continue;const A=E.mesh.userData.assembly;for(let i=0;i<E.mesh.count;i++){const a=A[i];if(a&&!kept.has(a)){kept.add(a);changed=true;}}}
        for(const E of lod){if(!E.ks)continue;let c=E.mesh.count;for(const [a,q] of E.mesh.userData.asmMax)if(q>=c&&kept.has(a))c=q+1;if(c!==E.mesh.count){E.mesh.count=c;E.mesh.visible=c>0;changed=true;}}}};
    return {pools:[...pools.keys()].length,batches:batches.size,standard,foliage,lod:lod.length};}
  return {bake,finish,roofParts,asmBegin,asmEnd};
}

export function buildLandmarks(n,ctx) {
  const {box,cylinder,sphere,height}=ctx,crown=ctx.own(new THREE.IcosahedronGeometry(1,0)),local=sitePools(ctx,crown),bake=local.bake,A0=local.asmBegin,A1=local.asmEnd;
  // Street kit with 20-triangle crown lobes (perf: park tree crowns ≈ 120 triangles, not 480).
  const kit=streetKit({...ctx,bake,sphere:crown}),stats={boxes:0};
  // Custom prism from a quad footprint (4 [x,z]) with per-corner bottom/top heights; batched (one draw per cell/kind).
  const prismGeom=(ring,bot,top)=>{const P=[],add=(...q)=>P.push(...q.flat());
    const B=ring.map((p,i)=>[p[0],bot[i],p[1]]),T=ring.map((p,i)=>[p[0],top[i],p[1]]),k=ring.length;
    const area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%k];return s+a[0]*b[1]-b[0]*a[1];},0),cw=area<0;
    for(let i=0;i<k;i++){const j=(i+1)%k;if(cw)add(B[i],B[j],T[j],B[i],T[j],T[i]);else add(B[i],T[j],B[j],B[i],T[i],T[j]);}
    // Top cap faces +Y (a positive XZ area with (T0,Ti,Ti+1) faced down and the coping read open from above).
    for(let i=1;i+1<k;i++){if(cw)add(T[0],T[i],T[i+1]);else add(T[0],T[i+1],T[i]);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();return g;};
  // Closed convex solid from triangles: each triangle is turned to face away from the solid's centroid.
  const convexSolid=(tris,colour,kind='solid')=>{const all=tris.flat(),c=[0,1,2].map(k=>all.reduce((s,p)=>s+p[k],0)/all.length),P=[];
    for(const [a,b,d] of tris){const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[d[0]-a[0],d[1]-a[1],d[2]-a[2]],nn=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
      const m=[(a[0]+b[0]+d[0])/3-c[0],(a[1]+b[1]+d[1])/3-c[1],(a[2]+b[2]+d[2])/3-c[2]];P.push(...a,...(nn[0]*m[0]+nn[1]*m[1]+nn[2]*m[2]<0?[...d,...b]:[...b,...d]));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,colour,0,kind);g.dispose();};
  // Extrude a (u, y) profile on a face frame F: front plane at d0, depth toward the wall (Santa Ana's crown as one
  // continuous profile instead of separate slabs and rakes).
  const extrudeOnFace=(F,pts,d0,depth,colour)=>{const sh=new THREE.Shape(pts.map(([u,y])=>new THREE.Vector2(u,y)));
    const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:6}),P=g.attributes.position;
    for(let i=0;i<P.count;i++){const u=P.getX(i),y=P.getY(i),e=P.getZ(i),[x,z]=F.P(u,d0-e);P.setXYZ(i,x,y,z);}
    const det=(F.ux*F.n[1]-F.uz*F.n[0]);if(det>0){const I=g.index;if(I){for(let i=0;i<I.count;i+=3){const t=I.getX(i+1);I.setX(i+1,I.getX(i+2));I.setX(i+2,t);}}
      else for(let i=0;i<P.count;i+=3)for(let c=0;c<3;c++){const t=P.array[(i+1)*3+c];P.array[(i+1)*3+c]=P.array[(i+2)*3+c];P.array[(i+2)*3+c]=t;}}
    g.computeVertexNormals();bake(g,0,0,0,1,1,1,colour,0,'solid');g.dispose();};
  const solid=(ring,bot,top,colour,kind='solid')=>{const g=prismGeom(ring,bot,top);bake(g,0,0,0,1,1,1,colour,0,kind);g.dispose();};
  // Box from a to b (local +X along the segment): bake turns Ry·Rz, rz = asin(dy/l), ry = atan2(−dz,dx).
  const bar=(a,b,w,h,colour,kind='solid')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-4)return;
    bake(box,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,l,h,w,colour,Math.atan2(-dz,dx),kind,Math.asin(Math.max(-1,Math.min(1,dy/l))));};
  // Face frame: u along a→b, d along the outward normal n, y absolute. Boxes turn local X along the face; disks (cylinders)
  // turn their axis onto the face normal.
  // an applied part whose back lies on the wall plane (d − dep/2 ≈ 0) gets its
  // back moved 10–30 mm INSIDE the wall, by a colour-keyed step of 4 mm, so no two trim backs (Tapia's ochre course and grey
  // plinth, Santa Ana's bands…) nor a back and the shell share a plane. The front face is unchanged.
  // The new back depends on the part's FRONT (back = −(1 cm + front), at most 25 cm in): fronts
  // ≥ 6 mm apart give backs ≥ 6 mm apart; parts with equal fronts never overlap anyway.
  let botN=0;const sink=(d,dep)=>{const back=d-dep/2;if(Math.abs(back)>.006)return [d,dep];const front=d+dep/2,nb=-Math.min(.25,.01+front);return [(front+nb)/2,front-nb];};
  const frame=f=>{const ux=(f.b[0]-f.a[0])/f.length,uz=(f.b[1]-f.a[1])/f.length,ry=-Math.atan2(uz,ux);
    const P=(u,d)=>[f.a[0]+ux*u+f.n[0]*d,f.a[1]+uz*u+f.n[1]*d];
    const F={L:f.length,ux,uz,ry,n:f.n,P,g:(u,d=.3)=>height(...P(u,d)),
      box:(u,y,d,w,h,dep,c,kind='facade')=>{[d,dep]=sink(d,dep);
        // a buried bottom (below the ground at the wall foot) is lowered by an emission-order step of 6 mm, so stacked courses'
        // hidden bottoms never share a plane; the top stays
        {const b0=y-h/2,g=height(...P(Math.max(0,Math.min(f.length,u)),.02));if(b0<g-.001){const nb=Math.floor(b0/.03)*.03-.006*(botN++%5),e=b0-nb;y-=e/2;h+=e;}}/* buried bottoms on a 3 cm lattice minus an emission-order step */
        const [x,z]=P(u,d);bake(box,x,y,z,w,h,dep,c,ry,kind);stats.boxes++;},
      glow:(u,y,d,w,h,kind)=>{const [x,z]=P(u,d);glowPane(x,y,z,Math.atan2(f.n[0],f.n[1]),w,h,kind);},   // glazing lit at blue hour (sj-glow.js)
      disk:(u,y,d,r,dep,c,kind='facade')=>{[d,dep]=sink(d,dep);const [x,z]=P(u,d);bake(cylinder,x,y,z,r,dep,r,c,ry+Math.PI/2,kind,Math.PI/2);},
      open:u=>!n.covered(...P(Math.max(.05,Math.min(f.length-.05,u)),.35))};
    // `lo` is the lowest ground both at the wall foot and 0.3 m out (previously only 0.3 m out, so
    // parts standing at the wall could float on a cross-fall); `hi` keeps the 0.3 m reading (window rows unchanged).
    F.range=(u0,u1)=>{let lo=Infinity,hi=-Infinity;for(let u=u0;u<=u1+1e-6;u+=Math.max(.25,(u1-u0)/4)){const uu=Math.max(0,Math.min(F.L,u)),g=F.g(uu);lo=Math.min(lo,g,F.g(uu,.02));hi=Math.max(hi,g);}return [lo,hi];};
    // Arch-headed opening: frame (rect + disk) then the dark fill in front of it, both flat (front faces at d+dep/2).
    // the fill stands 2.5 cm proud of its frame (was 1.5 cm) and its box stops 3 cm under the
    // spring, inside the disk, so no two faces of an opening share a plane (frame and fill tops used to coincide at the spring).
    F.arched=(u,y0,w,spring,trim,fill,t=.18,d=.05)=>{const r=w/2;
      if(trim){F.box(u,(y0-.03+spring)/2,d,w+2*t,spring-(y0-.03),.1,trim);F.disk(u,spring,d,r+t,.1,trim);}/* frame 3 cm below the fill (bottoms coincided) */
      {const top=spring-.03-r*.1;F.box(u,(y0+top)/2,d+.025,w,top-y0,.1,fill);}/* fill box top under its disk, by width (nested fills differed by nothing) */F.disk(u,spring,d+.025,r,.1,fill);};
    // Glass 3 cm proud of the frame (was 5 mm); muntins in front of the glass.
    F.window=(u,y0,y1,w,trim,fill,t=.16)=>{F.box(u,(y0+y1)/2,.06,w+2*t,y1-y0+2*t,.12,trim);F.box(u,(y0+y1)/2,.125,w,y1-y0,.05,fill);};
    return F;};

  // (consistency with fabric / uptown): window openings read as muted sky-tinted glass mixed with the style's
  // joinery tone and varied per window (fabric's afternoon palette, as sj-uptown.js `glaze`), not flat near-black panels.
  // Doors, portals, the Tapia arcade and shuttered windows stay dark timber/shade (closed places, photo-led).
  const mixHex=(a,b,t)=>'#'+new THREE.Color(a).lerp(new THREE.Color(b),t).getHexString();
  const glaze=(fill,u,y,id)=>{const h=Math.abs(Math.sin(u*12.9898+y*78.233+id*1.618))*43758.5453%1;
    return mixHex(mixHex(fill,'#8ea3ab',.62),h<.2?'#5d7078':'#d3dee2',h<.2?.35:h*.35);};
  // Generic facade for an owned mass: plinth band per 6 m, pilasters, windows per storey and bay, cornice. Every bay is
  // decided on its own ground; bays hidden against a neighbouring mass are skipped.
  // no style defined `plinth`, so every plinth band was NaN (376 matrix values, never drawn). Default 0.6 m.
  function facade(f,R,s){const F=frame(f);if(F.L<1.5)return F;const plinth=s.plinth??.6;
    if(s.cornice!==false){F.box(F.L/2,R-.21,.12,F.L+.22,.4,.3,s.trim);F.box(F.L/2,R+.05,.16,F.L+.3,.12,.38,s.trim);}
    for(let u=0;u<F.L;u+=6){const w=Math.min(6,F.L-u);if(!F.open(u+w/2))continue;const [lo,hi]=F.range(u,u+w);F.box(u+w/2,(lo-.25+hi+plinth)/2,.035,w+.02,hi+plinth-(lo-.25),.07,s.base);}/* segments overlap 1 cm: their ends never lie on a pilaster side */
    if(s.string){const [lo,hi]=F.range(0,F.L),y=hi+s.first+s.storey-.55;if(y<R-1.2&&F.open(F.L/2))F.box(F.L/2,y,.07,F.L+.06,.22,.14,s.trim);void lo;}
    if(F.L<(s.short??3.2))return F;
    const bays=Math.max(1,Math.round(F.L/s.bay)),bw=F.L/bays;
    for(let k=0;k<=bays;k++){const u=Math.max(.3,Math.min(F.L-.3,k*bw));if(!F.open(u))continue;const [lo]=F.range(u-.3,u+.3);if(R-.45-lo<1)continue;
      if(s.pilaster)F.box(u,(lo-.15+R-.45)/2,.045,s.pilaster,R-.45-(lo-.15),.09,s.pilasterColour??s.trim);}
    const holes=s.holes?.(F)??[];
    for(let k=0;k<bays;k++){const u=(k+.5)*bw;if(!F.open(u)||!F.open(u-bw*.3)||!F.open(u+bw*.3))continue;const [,hi]=F.range(u-.9,u+.9);
      for(let y=hi+s.first,row=0;y+s.win[1]<R-.9;y+=s.storey,row++){const w=s.win[0]*(row===0&&s.groundWide?1.25:1),h=s.win[1],fill=s.glass?glaze(s.fill,u,y,f.i):s.fill;
        if(holes.some(([u0,u1,y0,y1])=>u+w/2+.4>u0&&u-w/2-.4<u1&&y+h+.4>y0&&y-.4<y1))continue;
        if(s.arched&&(row>0||s.arched==='all')){F.arched(u,y,w,y+h-w/2,s.trim,fill,.15,.05);if(s.glass){const top=y+h-w/2-.03-w/20;F.glow(u,(y+top)/2,.127,w,top-y,'civic');}}
        else{F.window(u,y,y+h,w,s.trim,fill);if(s.glass)F.glow(u,y+h/2,.152,w,h,'civic');}
        if(s.muntin){F.box(u,y+h*.45,.16,.045,h*.9,.02,s.trim);F.box(u,y+h*.62,.165,w,.045,.02,s.trim);}
        if(s.balcony&&row===1){A0();F.box(u,y-.08,.22,w+.6,.1,.42,s.trim,'solid');for(let b=-w/2-.15;b<=w/2+.16;b+=.18)F.box(u+b,y+.33,.38,.04,.8,.04,IRON,'solid');F.box(u,y+.74,.38,w+.6,.05,.06,IRON,'solid');A1();}}}
    return F;}
  // Balustrade along a face above the roof line (instanced balusters between a plinth course and a rail).
  // the plinth course runs down onto the roof/cornice (it began 11 cm above the cornice top);
  // balusters overlap plinth and rail by 1.5 cm each.
  const balustrade=(F,R,colour,h=.85,step=.34)=>{A0();F.box(F.L/2,R+.21,-.05,F.L-.012,.46,.3,colour,'solid');/* 6 mm short: the next wall's plinth covers the corner */F.box(F.L/2,R+h,-.05,F.L+.06,.12,.36,colour,'solid');
    for(let u=step/2;u<F.L;u+=step){const [x,z]=F.P(u,-.05),b0=R+.44-.015,b1=R+h-.06+.015;bake(box,x,(b0+b1)/2,z,.1,b1-b0,.1,colour,F.ry,'solid');}A1();};

  // ---- La Fortaleza: palace faces (powder blue, white pilasters, arched upper windows, cornice and balustrade), the gate
  // piers and iron leaf, the forecourt entrance front with an attic and crest. ----
  {const s=n.shells.fortaleza,R=s.roof,C=n.constants.COLOURS;let gates=0;
    // carry the tiering round the short bastion returns — a storey string course everywhere, one bay on faces ≥ 1.9 m.
    const palace={trim:WHITE,base:'#98aab0',fill:'#3d4a52',glass:true,bay:3.6,storey:3.9,first:1.0,win:[1.1,2.2],arched:true,pilaster:.46,cornice:true,string:true,short:1.9};
    for(const f of n.faces.fortaleza){if(f.role==='court')continue;const F=facade(f,R,palace);if(F.L>2&&F.open(F.L/2))balustrade(F,R,WHITE,.85,.45);}
    // Forecourt (the recess behind the gate): pale entrance front with a white-framed shut door, pediment, attic and crest.
    for(const f of n.faces.fortaleza.filter(q=>q.role==='court')){const F=frame(f),[lo,hi]=F.range(0,F.L);
      F.box(F.L/2,R-.21,.12,F.L+.2,.4,.3,WHITE);F.box(F.L/2,(lo-.2+hi+.6)/2,.035,F.L-.012,hi+.6-(lo-.2),.07,'#98aab0');/* 6 mm short of the recess walls' planes */
      if(F.L>5){const u=F.L/2,[dlo]=F.range(u-1.2,u+1.2);F.box(u,(dlo-.08+hi+4.4)/2,.06,3.2,hi+4.4-(dlo-.08),.12,WHITE);F.box(u,(dlo-.05+hi+4.0)/2,.115,2.3,hi+4.0-(dlo-.05),.06,'#2f4a43');F.box(u,(dlo+hi+4.0)/2,.155,.05,hi+4.0-dlo,.02,'#22342f');
        bar(F.P(u-1.9,.15).flatMap((v,i)=>i?[hi+4.55,v]:[v]),F.P(u,.15).flatMap((v,i)=>i?[hi+5.35,v]:[v]),.22,.22,WHITE);
        bar(F.P(u,.15).flatMap((v,i)=>i?[hi+5.35,v]:[v]),F.P(u+1.9,.15).flatMap((v,i)=>i?[hi+4.55,v]:[v]),.22,.22,WHITE);
        F.box(u,hi+4.5,.1,4.0,.18,.2,WHITE);
        for(const sd of [-1,1])F.box(u+sd*(F.L/2-.5),(lo-.05+R-.4)/2,.045,.6,R-.4-(lo-.05),.09,WHITE);
        // Attic over the entrance front, rising above the palace roof: white panel, cornice, oval crest and a flagstaff.
        A0();const [ax,az]=F.P(u,-.6);bake(box,ax,R+1.2,az,F.L+1.4,2.4,1.4,'#e9eef0',F.ry,'solid');bake(box,ax,R+2.45,az,F.L+1.8,.2,1.7,WHITE,F.ry,'solid');
        F.disk(u,R+1.25,.12,.75,.1,'#c9a95a','solid');F.disk(u,R+1.25,.18,.55,.08,'#8a2f2a','solid');
        bake(cylinder,ax,R+4.6,az,.05,4.2,.05,'#d9d9d4',0,'solid');
        for(let k=0;k<5;k++)bake(box,...F.P(u+.8,-.6).flatMap((v,i)=>i?[R+6.48-k*.19,v]:[v]),1.5,.19,.03,k%2?'#f4f4f0':'#c8202c',F.ry,'solid');
        {const y3=(uu,y,d)=>{const p=F.P(uu,d);return [p[0],y,p[1]];},tri=[];for(const d of [-.585,-.615])tri.push([y3(u+.05,R+6.575,d),y3(u+.05,R+5.625,d),y3(u+.9,R+6.1,d)]);
          convexSolid([tri[0],tri[1],[tri[0][0],tri[0][1],tri[1][1]],[tri[0][0],tri[1][1],tri[1][0]],[tri[0][1],tri[0][2],tri[1][2]],[tri[0][1],tri[1][2],tri[1][1]],[tri[0][0],tri[0][2],tri[1][2]],[tri[0][0],tri[1][2],tri[1][0]]],'#2a5aa8');
          bake(box,...F.P(u+.33,-.63).flatMap((v,i)=>i?[R+6.1,v]:[v]),.16,.16,.02,'#f4f4f0',F.ry,'solid');A1();}}
      else{F.box(F.L/2,(lo-.05+R-.4)/2,.045,.5,R-.4-(lo-.05),.09,WHITE);}}
    // Gate: two pale masonry piers (urn and lantern on top) and the dark iron leaf with a scrolled top rail and crest.
    const G=n.fort,u=G.u,o=G.out,W=G.width,{w,proud,back}=n.constants.GATE.pier;
    const Q=(sv,d,y)=>[G.gN[0]+u[0]*sv+o[0]*d,y,G.gN[1]+u[1]*sv+o[1]*d],ry=-Math.atan2(u[1],u[0]);
    for(const p of G.piers){A0();const [x,,z]=Q(p.s,(proud-back)/2,0),hh=p.top-(p.g-.2);
      bake(box,x,(p.g-.2+p.top)/2,z,w,hh,proud+back,'#e8e4da',ry,'solid');bake(box,x,p.top+.08,z,w+.2,.16,proud+back+.2,WHITE,ry,'solid');
      bake(box,x,p.g+.23,z,w+.08,.94,proud+back+.1,'#b7b2a6',ry,'solid');/* plinth 20 cm into the ground (it reached only the corner minimum) */// plinth face 1 cm ahead of the inset (was coplanar)
      for(const sd of [-1,1]){const [px,,pz]=Q(p.s,(proud-back)/2+sd*(proud+back)/2+sd*.02,0);bake(box,px,(p.g+.75+p.top-.3)/2,pz,w*.55,p.top-.3-(p.g+.75),.04,'#f4f1e9',ry,'facade');}// inset starts above the plinth
      kit.lantern(x,p.top+.16,z,1.15);A1();}
    {A0();const L=G.leaf,s0=w*.5,s1=W-w*.5,y0=L.g,top=L.top;
      for(let sv=s0+.08;sv<s1-.04;sv+=.13){const [x,,z]=Q(sv,0,0),gy=height(x,z);bar([x,gy-.05,z],[x,top-.25+.18*Math.sin((sv-s0)/(s1-s0)*Math.PI),z],.035,.035,IRON);gates++;}
      for(const yy of [.25,1.45,2.6])bar(Q(s0,0,y0+yy),Q(s1,0,y0+yy),.06,.06,IRON);
      // Scrolled top rail: a shallow arch of short bars; centre crest disk and spear tips.
      for(let k=0;k<8;k++){const t0=k/8,t1=(k+1)/8,yA=top-.25+.18*Math.sin(t0*Math.PI),yB=top-.25+.18*Math.sin(t1*Math.PI);
        bar(Q(s0+(s1-s0)*t0,0,yA),Q(s0+(s1-s0)*t1,0,yB),.06,.06,IRON);}
      {const [x,,z]=Q((s0+s1)/2,0,0);bake(cylinder,x,top+.15,z,.32,.1,.32,'#b39243',ry+Math.PI/2,'solid',Math.PI/2);}
      bar(Q((s0+s1)/2,0,y0),Q((s0+s1)/2,0,top-.07),.08,.08,IRON);A1();}
    stats.fortalezaBars=gates;}

  // ---- Capilla del Cristo (north front on the Cristo/Tetuán turn). ----
  {const s=n.shells.cristo,R=s.roof;
    for(const f of n.faces.cristo){const F=frame(f);if(!F.open(F.L/2))continue;
      const [lo,hi]=F.range(0,F.L);F.box(F.L/2,R-.18,.1,F.L+.3,.34,.3,'#cdb995');
      for(let u=0;u<F.L;u+=6){const w=Math.min(6,F.L-u),[l2,h2]=F.range(u,u+w),e0=f.role==='front'&&u===0?.01:0,e1=f.role==='front'&&u+w>=F.L?.01:0;F.box(u+(w+e0-e1)/2,(l2-.25+h2+.5)/2,.03,w-e0-e1,h2+.5-(l2-.25),.06,'#9d8a6c');}/* front ends 1 cm inside the corner pilasters */
      // Weathering: darker and warmer stone patches, a few brick-red repairs (photo).
      // broken masonry courses (thin, irregular) and a few small worn blocks instead of large colour stickers.
      for(let y=hi+.9,row=0;y<R-.5;y+=.52,row++)for(let u=.15+((row*37)%7)/14;u<F.L-.3;){const len=Math.min(F.L-.15-u,.7+((row*13+Math.round(u*7))%9)/6);
        F.box(u+len/2,y+((row+Math.round(u))%3-1)*.03,.012,len,.035,.024,row%2?'#a68f6d':'#ac9673');u+=len+.25+((row*5+Math.round(u*3))%4)*.18;}
      const pm=f.role==='front'?.85:.4;if(F.L>2*pm+.1)for(let k=0;k<Math.round(F.L*.6);k++){const r1=((k*37+f.i*11)%17)/17,r2=((k*53+f.i*7)%13)/13,u=pm+r1*(F.L-2*pm),y=hi+1+r2*(R-hi-2);if(f.role==='front'&&Math.abs(u-F.L/2)<2.4)continue;/* front: clear of the corner pilasters and the portal / bell gable */
        F.box(u,y,.013,.22+r2*.3,.16+r1*.18,.046,/* front .036 (1.2 cm before the courses), back 1 cm into the wall */['#c4ae88','#9a8566',f.role==='front'&&k%3===0?'#a85a44':'#b29c79'][k%3]);}
      if(f.role!=='front')continue;
      const u=F.L/2,g=F.g(u,.4),[glo]=F.range(u-2.1,u+2.1),spring=g+2.85,rw=3.7;
      for(const uu of [.28,F.L-.28])F.box(uu,(lo-.1+R-.35)/2,.07,.56,R-.35-(lo-.1),.12,'#c8b38e');
      // Brick-red ring and dark barred opening (drawn shut: dark backing, black bars, two rails).
      F.arched(u,glo-.05,rw,spring,'#a6563f','#2e2823',.38,.03);
      for(let b=-rw/2+.18;b<rw/2-.1;b+=.2){const half=Math.sqrt(Math.max(0,(rw/2)**2-b*b));const [x,z]=F.P(u+b,.11);bar([x,glo-.06,z],[x,spring+half-.06,z],.03,.03,'#16181a');}
      for(const yy of [1.1,2.2])F.box(u,g+yy,.11,rw,.05,.03,'#16181a');
      F.box(u,spring+rw/2+.48,.06,rw+1.1,.22,.12,'#c8b38e');
      // Bell gable (espadaña) on the front wall: arched bell opening, one bell, coping and an iron cross; curved shoulders
      // stepping down to corner urns.
      // the bell hangs in a TRUE opening (daylight through it): sill block, two jambs, a head block; brick-red ring.
      A0();const [bx,bz]=F.P(u,-.2),GS='#b49d77';
      bake(box,bx,R+.27,bz,2.6,.54,.8,GS,F.ry,'solid');
      for(const sd of [-1,1]){const [jx,jz]=F.P(u+sd*.95,-.2);bake(box,jx,R+1.07,jz,.7,1.06,.8,GS,F.ry,'solid');F.box(u+sd*.66,R+1.07,.21,.14,1.08,.04,'#a6563f','solid');}
      bake(box,bx,R+1.92,bz,2.6,.64,.8,GS,F.ry,'solid');F.box(u,R+1.66,.21,1.46,.14,.04,'#a6563f','solid');/* lintel underside 1 cm below the head block's */
      {const [x,z]=F.P(u,-.2);// the bell hung 14 cm under its beam. Beam into both jambs (±0.75, jambs from ±0.6),
        // a hanger from 2 cm inside the bell crown to 2 cm inside the beam, the bell parts stacked on each other's extents.
        const beamLo=R+1.48;bake(box,x,beamLo+.03,z,1.5,.06,.06,'#3a332a',F.ry,'solid');/* slim iron bar (was 8×10 cm) */
        const lip=R+.84,body0=lip+.02,body1=body0+.36,crownTop=body1+.12;bake(cylinder,x,lip,z,.22,.06,.22,'#5f5032',0,'solid');bake(cylinder,x,(body0+body1)/2,z,.17,body1-body0,.17,'#6a5a38',0,'solid');
        bake(sphere,x,body1,z,.16,.14,.16,'#6a5a38',0,'solid');bake(box,x,(crownTop-.04+beamLo+.02)/2,z,.035,beamLo+.02-(crownTop-.04),.035,'#3a332a',F.ry,'solid');}
      const copTop=R+2.24+.18;bake(box,bx,copTop-.09,bz,3.0,.18,1.0,'#cdb995',F.ry,'solid');/* coping sits on the head block (top R+2.24; it floated 5 cm) */

      {const [x,z]=F.P(u,-.2);bake(box,x,copTop-.03+.5,z,.08,1.0,.08,IRON,F.ry,'solid');bake(box,x,copTop-.03+.7,z,.5,.08,.08,IRON,F.ry,'solid');}
      for(const sd of [-1,1]){const y3=(uu,d,y)=>{const p=F.P(uu,d);return [p[0],y,p[1]];},W=[];
        for(const d of [.05,-.55])W.push([y3(u+sd*1.3,d,R+1.75),y3(u+sd*1.3,d,R-.02),y3(u+sd*2.6,d,R-.02)]);
        convexSolid([W[0],W[1],[W[0][0],W[0][1],W[1][1]],[W[0][0],W[1][1],W[1][0]],[W[0][1],W[0][2],W[1][2]],[W[0][1],W[1][2],W[1][1]],[W[0][0],W[0][2],W[1][2]],[W[0][0],W[1][2],W[1][0]]],'#b49d77');
        F.disk(u+sd*2.45,R+.28,.07,.26,.14,'#c8b38e','solid');
        const [x,z]=F.P(u+sd*(F.L/2-.32),-.05);bake(box,x,R+.16,z,.52,.32,.52,'#cdb995',F.ry,'solid');bake(cylinder,x,R+.5,z,.17,.36,.17,'#c8b38e',0,'solid');bake(sphere,x,R+.86,z,.2,.24,.2,'#c8b38e',0,'solid');bake(cylinder,x,R+1.12,z,.05,.2,.05,'#c8b38e',0,'solid');}}}

  A1();
  // ---- Parque de las Palomas: rough stone parapet with a pale coping and a black picket rail; pigeon wall; trees etc. ----
  {A0();const P=n.parapet,{coping,rail,thick}=n.constants.PARAPET;
    for(let i=0;i+1<P.length;i++){const a=P[i],b=P[i+1];
      solid([a.O,b.O,b.I,a.I],[a.bottom,b.bottom,b.bottom,a.bottom],[a.g+coping-.12,b.g+coping-.12,b.g+coping-.12,a.g+coping-.12],i%3===1?'#a5916f':'#ab9776');
      const ext=(p,q,e)=>[p[0]+(p[0]-q[0])*e,p[1]+(p[1]-q[1])*e];
      const Oa=[a.O[0]-a.n[0]*.06,a.O[1]-a.n[1]*.06],Ob=[b.O[0]-b.n[0]*.06,b.O[1]-b.n[1]*.06],Ia=[a.I[0]+a.n[0]*.06,a.I[1]+a.n[1]*.06],Ib=[b.I[0]+b.n[0]*.06,b.I[1]+b.n[1]*.06];void ext;
      solid([Oa,Ob,Ib,Ia],[a.g+coping-.12,b.g+coping-.12,b.g+coping-.12,a.g+coping-.12],[a.g+coping,b.g+coping,b.g+coping,a.g+coping],'#d6cdb9');
      const m=t=>[(a.O[0]+a.I[0])/2+((b.O[0]+b.I[0])/2-(a.O[0]+a.I[0])/2)*t,a.g+coping+(b.g-a.g)*t,(a.O[1]+a.I[1])/2+((b.O[1]+b.I[1])/2-(a.O[1]+a.I[1])/2)*t];
      const top=t=>{const p=m(t);return [p[0],a.g+(b.g-a.g)*t+rail,p[2]];},low=t=>{const p=m(t);return [p[0],p[1]+.04,p[2]];};
      bar(low(0),low(1),.05,.05,IRON);bar(top(0),top(1),.06,.06,IRON);
      const L=Math.hypot(b.O[0]-a.O[0],b.O[1]-a.O[1]);for(let t=0;t<1;t+=.14/L){const p=m(t),q=top(t);bake(box,p[0],(p[1]-.01+q[1])/2,p[2],.025,q[1]-p[1]+.01,.025,IRON,0,'solid');}
      {const p=m(0),q=top(0);bake(box,p[0],(p[1]-.01+q[1])/2,p[2],.07,q[1]-p[1]+.03,.07,IRON,0,'solid');}}
    A1();for(const w of n.pigeon){const r=[w.a,w.b,[w.b[0]+w.n[0]*w.T,w.b[1]+w.n[1]*w.T],[w.a[0]+w.n[0]*w.T,w.a[1]+w.n[1]*w.T]];
      const ga=height(...r[3]),gb=height(...r[2]),tA=ga+3.1,tB=gb+3.1,top=Math.max(tA,tB);
      solid(r,[w.g-.3,w.g-.3,w.g-.3,w.g-.3],[top,top,top,top],'#9c8b70');
      const f={a:r[3],b:r[2],length:Math.hypot(r[2][0]-r[3][0],r[2][1]-r[3][1]),n:w.n},F=frame(f);
      F.box(F.L/2,top-.07,.08,F.L+.02,.16,.16,'#b7a888','solid');/* coping 1 cm above the wall top and 1 cm past its ends (its sunk back lay in the end planes) */
      // irregular nesting holes (size, spacing, gaps) with worn light surrounds; rough stone blocks; vines hang in strips.
      const hsh=(a,b)=>{let h=Math.imul(a*73856093^b*19349663,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};
      for(let u=.45,k=0;u<F.L-.4;k++){const g=Math.max(height(...F.P(u,.1)),height(...F.P(u+.3,.1)));
        for(let y=g+.7+hsh(k,1)*.2,row=0;y<top-.45;row++){const r=hsh(k,row+7);if(r<.18){y+=.5+r;continue;}const sz=.17+hsh(k,row+19)*.12,du=(hsh(k,row+31)-.5)*.16;
          if(r>.62)F.box(u+du,y,.015,sz+.13,sz+.11,.03,['#a4937a','#a08f73'][row%2]);F.box(u+du,y,.025,sz,sz*(.85+hsh(row,k)*.3),.04,'#221d1a');/* layers ≥1.5 cm apart: patch .014 / surround .03 / hole .045 / vines .065+ */y+=.46+hsh(k,row+43)*.24;}
        if(hsh(k,99)<.4)F.box(u+.2,g+.9+hsh(k,5)*1.7,.002+(k%3)*.006,.5+hsh(k,6)*.7,.3+hsh(k,8)*.4,.016,['#8f7c60','#a8957a','#86745c'][k%3]);/* patch fronts .010/.016/.022 by tone (overlapping patches shared a plane) */u+=.5+hsh(k,3)*.3;}
      for(let k=0;k<Math.round(F.L/4.5);k++){const u0=1.5+k*4.5+hsh(k,51)*2;
        for(let j=0;j<4+Math.floor(hsh(k,52)*4);j++){const uu=u0+j*.22+hsh(k,j)*.1,len=.8+hsh(j,k+3)*1.6;if(uu>F.L-.3)break;
          F.box(uu,top-.18-len/2,.05+j%2*.01,.12+hsh(j,k)*.12,len,.03,['#35552f','#3e5f35','#2f4c2a','#46663a'][(j+k)%4],'solid');}}}}

  // ---- Teatro Tapia: ochre arcade storey of dark arches, yellow upper storeys with white pilasters and shuttered windows,
  // white entablature, terracotta pediment with a crest on the north front, fly loft over the stage. ----
  {const s=n.shells.tapia,R=s.roof,C=n.constants.COLOURS,g0=n.tapiaFront,band=g0+5.0;
    for(const f of n.faces.tapia){const F=frame(f);if(!F.open(F.L/2)||F.L<2)continue;const front=f.role==='front';
      F.box(F.L/2,R-.26,.12,F.L+.24,.5,.32,WHITE);F.box(F.L/2,R+.05,.17,F.L+.34,.14,.42,WHITE);
      {const [lo,hi]=F.range(0,F.L);F.box(F.L/2,(lo-.2+band)/2,.035,F.L-.012,band-(lo-.2),.07,'#d69a50');/* 6 mm short of each end: at re-entrant corners the end lay in the next wall's plane */
        F.box(F.L/2,(lo-.2+hi+.45)/2,.05,F.L+.04,hi+.45-(lo-.2),.1,'#9c8f80');
        // rustication courses on the arcade storey (ref G's horizontal masonry), not one flat orange strip.
        // Courses stop at the opening frames (their tops met the frame heads, which step with the grade); gaps from the same
        // bay rule as the openings below.
        const gaps=[];if(F.L>=4){const na=Math.max(1,Math.round(F.L/2.8)),aw=F.L/na;for(let k=0;k<na;k++){const u=(k+.5)*aw,[l2,h3]=F.range(u-1.1,u+1.1);if(band-h3<3.2)continue;
          if(!front&&k%2===1)gaps.push([u-.7,u+.7,h3+.95,h3+2.8]);else{const aW=Math.min(2.05,aw-.7),sp=Math.min(band-1.4,h3+2.5);gaps.push([u-aW/2-.3,u+aW/2+.3,l2-.2,sp+aW/2+.4]);}}}
        for(let y=hi+.96;y<band-.25;y+=.48){let a=.006;const cut=gaps.filter(g=>y>g[2]&&y<g[3]).sort((p,q)=>p[0]-q[0]);
          for(const g of [...cut,[F.L-.006,F.L]]){const b=Math.min(g[0],F.L-.006);if(b-a>.3)F.box((a+b)/2,y,.072,b-a,.04,.02,'#b47d3e');/* no stubs under 30 cm */a=Math.max(a,g[1]);}}}
      F.box(F.L/2,band+.15,.06,F.L+.1,.3,.12,WHITE);
      if(F.L<4)continue;
      const arches=Math.max(1,Math.round(F.L/2.8)),aw=F.L/arches;
      for(let k=0;k<arches;k++){const u=(k+.5)*aw,[l2,hi]=F.range(u-1.1,u+1.1);if(band-hi<3.2)continue;const aW=Math.min(2.05,aw-.7),sp=Math.min(band-1.4,hi+2.5);
        // Secondary returns: every other bay is a plain grated window, so the side reads as a hierarchy, not a cloned arcade.
        if(!front&&k%2===1){F.window(u,hi+1.1,hi+2.6,1.0,'#b8803f','#3b2c22',.12);for(let b=-.36;b<.4;b+=.18)F.box(u+b,hi+1.85,.155,.03,1.5,.06,IRON);/* grille bars set 2.5 cm into the glass, 3.5 cm proud of it */continue;}
        F.arched(u,l2-.05,aW+.24,sp,'#b8803f','#8a5a2c',.12,.06);F.arched(u,l2-.05,aW,sp,null,'#3a2a20',0,.075);
        if(front){F.box(u,(l2+sp-.05)/2,.175,.05,sp-l2,.02,'#2b1e17');for(const sd of [-1,1])F.box(u+sd*aW/4,(l2+.2+sp-.25)/2,.16,aW/2-.2,sp-l2-.45,.02,'#4a3527');
          F.box(u,sp,.175,aW,.05,.02,IRON);for(let a=1;a<6;a++){const ang=a*Math.PI/6,[x,z]=F.P(u+Math.cos(ang)*aW/4,.18);bar([x,sp,z],[x+F.ux*Math.cos(ang)*aW/4,sp+Math.sin(ang)*aW/2*.92,z+F.uz*Math.cos(ang)*aW/4],.025,.025,IRON);}}}
      const bays=front?7:Math.max(1,Math.round(F.L/3.6)),bw=F.L/bays;
      for(let k=0;k<=bays;k++){const u=Math.max(.3,Math.min(F.L-.3,k*bw)),pw=(k===0||k===bays)&&front?.9:.55;F.box(u,(band+.3+R-.5)/2,.05,pw,R-.5-band-.3,.1,WHITE);}
      for(let k=0;k<bays;k++){const u=(k+.5)*bw;
        for(const [y0,y1] of [[band+1.0,band+3.5],[band+5.0,band+7.3]]){if(y1>R-.7)continue;F.window(u,y0,y1,1.2,WHITE,'#7a5a40',.17);// closed timber shutters in a mid wood tone (were near-black)
          for(const sd of [-1,1])F.box(u+sd*.3,(y0+y1)/2,.1,.02,y1-y0-.1,.02,'#4e3a2a');}}
      if(!front)continue;
      // Pediment over the central five bays (apex +3.4 m), terracotta tympanum, white raking cornices, oval crest.
      const u0=bw,u1=6*bw,uc=(u0+u1)/2,apex=R+3.4,y3=(p,y)=>[p[0],y,p[1]];
      {const A=y3(F.P(u0,.05),R+.12),B=y3(F.P(u1,.05),R+.12),T=y3(F.P(uc,.05),apex),A2=y3(F.P(u0,-.9),R+.12),B2=y3(F.P(u1,-.9),R+.12),T2=y3(F.P(uc,-.9),apex);
        convexSolid([[A,B,T],[A2,B2,T2],[A,T,T2],[A,T2,A2],[B,B2,T2],[B,T2,T],[A,A2,B2],[A,B2,B]],'#c66b4b','roof');}
      const yA=R+.15;bar([...F.P(u0-.3,.2)].flatMap((v,i)=>i?[yA,v]:[v]),[...F.P(uc,.2)].flatMap((v,i)=>i?[apex+.2,v]:[v]),.5,.32,WHITE);
      bar([...F.P(uc,.2)].flatMap((v,i)=>i?[apex+.2,v]:[v]),[...F.P(u1+.3,.2)].flatMap((v,i)=>i?[yA,v]:[v]),.5,.32,WHITE);
      F.box(uc,R+.2,.2,u1-u0+.6,.3,.5,WHITE,'solid');
      F.disk(uc,R+1.45,.12,.95,.1,WHITE,'solid');F.disk(uc,R+1.45,.19,.72,.06,'#d6b46c','solid');
      // Name band over the arcade (lettering reads as a dark line at riding distance).
      F.box(uc,R-.85,.11,9,.14,.02,'#7a6a52');
      // Fly loft over the stage (south part of the main block), yellow with a white cornice.
      const [fx,fz]=F.P(uc,-19);bake(box,fx,R+2.2,fz,15,4.4,11,C.tapia,F.ry,'solid');bake(box,fx,R+4.45,fz,15.4,.2,11.4,WHITE,F.ry,'solid');}}

  // ---- Antiguo Casino: white Beaux-Arts walls, rusticated grey base, arched ground openings, tall upper windows with
  // balconettes, paired pilasters, heavy cornice and balustrade, dark steep mansard with white dormers. ----
  {const s=n.shells.casino,R=s.roof;
    const st={trim:'#fbfaf6',base:'#c7c3ba',fill:'#4a5560',glass:true,bay:3.4,storey:5.6,first:1.6,win:[1.3,3.0],arched:'all',pilaster:.5,pilasterColour:'#dedbd3',balcony:true,cornice:true,muntin:true};
    for(const f of n.faces.casino){const F=facade(f,R,{...st,arched:f.role==='front'?false:'all',
      // the three authored arched entries on each front face are holes for the generic ground-row windows
      holes:f.role==='front'?(F=>F.L>8?[0,1,2].map(i=>{const u=(i+.5)*F.L/3,[,h2]=F.range(u-1.2,u+1.2);return [u-1.25,u+1.25,-1e9,h2+4.3];}):[]):null});if(F.L<2||!F.open(F.L/2))continue;
      // Rustication grooves on the base band and a frieze under the cornice.
      const [lo,hi]=F.range(0,F.L);for(let y=hi+.36;y<hi+1.5;y+=.38)F.box(F.L/2,y,.07,F.L-.012,.035,.02,'#a9a59c');/* bottoms 1 cm off the entry trims; ends 6 mm inside the corner pilasters; back .06 (1 cm off the entries' floating backs), front .08 (1 cm behind the pilaster fronts) */
      F.box(F.L/2,R-.75,.08,F.L+.1,.5,.16,'#e3e0d8');balustrade(F,R,'#f4f2ec',.9,.4);void lo;
      if(f.role==='front'&&F.L>8){const k=3,bw=F.L/k;
        const porch=n.portico?.face===f;for(let i=0;i<k;i++){const u=(i+.5)*bw,[l2,h2]=F.range(u-1.2,u+1.2);F.arched(u,l2-.05,1.9,h2+3.0,'#fbfaf6',porch?'#3d2c22':'#2f3438',.22,.12);
          if(porch){F.box(u,(l2+h2+2.1)/2,.2,.05,h2+2.1-l2,.02,'#2a1e17');F.box(u,h2+2.25,.2,1.9,.08,.02,'#fbfaf6');}}
        for(let i=0;i<=k;i++){const u=Math.max(.35,Math.min(F.L-.35,i*bw));for(const sd of [-.32,.32])F.box(u+sd,(hi+.2+R-.6)/2,.13,.34,R-.6-hi-.2,.18,'#f1efe9','solid');}}}
    // Portico (ref H): columns 2 m out on bases with capitals, an overhead balcony slab with balustrade, the shaded
    // porch soffit; a segmental crown with a cartouche over the projection's cornice.
    if(n.portico){A0();const pc=n.portico,F=frame(pc.face),cr=.3;
      for(const c of pc.cols){bake(cylinder,c.x,(c.lo+pc.top-.05)/2,c.z,cr,pc.top-.05-c.lo,cr,'#f4f2ec',0,'solid');/* shaft ends 5 cm inside its capital */{let gm=c.lo+.1;for(const a of [-.39,0,.39])for(const b2 of [-.39,0,.39])gm=Math.min(gm,height(c.x+F.ux*a+F.n[0]*b2,c.z+F.uz*a+F.n[1]*b2));const t0=c.lo+.4,b0=gm-.05;bake(box,c.x,(t0+b0)/2,c.z,.78,t0-b0,.78,'#dcd8cf',F.ry,'solid');}/* column base on its own footprint minimum */
        bake(box,c.x,pc.top-.12,c.z,.74,.24,.74,'#fbfaf6',F.ry,'solid');}
      F.box(pc.L/2,pc.top+.32,(pc.D+.35)/2-.05,pc.L+.4,.64,pc.D+.55,'#f1efe9','solid');F.box(pc.L/2,pc.top-.01,(pc.D+.35)/2-.05,pc.L+.2,.04,pc.D+.45,'#bdb9b0','solid');/* soffit 3 cm under the slab (was coplanar) */
      const bal={L:pc.L,P:(u,d)=>F.P(u,d+pc.D+.25),box:F.box};void bal;
      const pb0=pc.top+.64-.015,pb1=pc.top+1.28+.015;/* balusters 1.5 cm into the slab and the rail (they stood 3 cm above the slab) */
      for(let u=.2;u<pc.L-.1;u+=.3){const [x,z]=F.P(u,pc.D+.3);bake(box,x,(pb0+pb1)/2,z,.1,pb1-pb0,.1,'#f4f2ec',F.ry,'solid');}
      F.box(pc.L/2,pc.top+1.34,pc.D+.3,pc.L+.4,.12,.3,'#f4f2ec','solid');
      for(const sd of [-1,1]){const u=pc.L/2+sd*(pc.L/2+.1);for(let d=.3;d<pc.D+.2;d+=.3){const [x,z]=F.P(u,d);bake(box,x,(pb0+pb1)/2,z,.1,pb1-pb0,.1,'#f4f2ec',F.ry,'solid');}}
      const uc=pc.L/2;F.box(uc,R+.875,.05,pc.L-1.6,1.45,.54,'#f1efe9','solid');F.disk(uc,R+1.6,.05,1.7,.54,'#f1efe9','solid');/* crown starts inside its base box; depth differs from the balustrade's */
      F.box(uc,R+.1,.2,pc.L-1.2,.2,.6,'#fbfaf6','solid');F.disk(uc,R+1.3,.32,.62,.06,'#e2dccd','solid');F.disk(uc,R+1.3,.36,.42,.04,'#c9b98f','solid');A1();}
    // Mansard over the main block: slate slopes 3.6 m up, 1.5 m in, white dormers on the long faces, pale crest rail.
    {A0();const r=n.casinoRect,y0=R-.02,y1=R+3.6,/* mansard seated 2 cm into the roof (its base floated 2 cm above it) */i0=.35,i1=1.85,c=(a,b,i)=>[r.o[0]+r.u[0]*(a)+r.v[0]*(b),r.o[1]+r.u[1]*(a)+r.v[1]*(b)];
      const lo=[c(i0,i0),c(r.du-i0,i0),c(r.du-i0,r.dv-i0),c(i0,r.dv-i0)],hi=[c(i1,i1),c(r.du-i1,i1),c(r.du-i1,r.dv-i1),c(i1,r.dv-i1)];
      const L=lo.map(p=>[p[0],y0,p[1]]),H=hi.map(p=>[p[0],y1,p[1]]),tris=[];
      for(let i=0;i<4;i++){const j=(i+1)%4;tris.push([L[i],H[j],L[j]],[L[i],H[i],H[j]]);}
      tris.push([H[0],H[2],H[1]],[H[0],H[3],H[2]],[L[0],L[1],L[2]],[L[0],L[2],L[3]]);convexSolid(tris,'#48505a','roof');
      for(let i=0;i<4;i++){const a=H[i],b=H[(i+1)%4];bar([a[0],y1+.25,a[2]],[b[0],y1+.25,b[2]],.08,.08,'#e9e6de');bar([a[0],y1+.03,a[2]],[b[0],y1+.03,b[2]],.2,.1,'#e9e6de');
        // crest rail posts (the rail floated 13 cm over its base course): every ~1.2 m, 1.5 cm into both
        {const len=Math.hypot(b[0]-a[0],b[2]-a[2]),k=Math.max(2,Math.round(len/1.2));for(let j=0;j<=k;j++){const t=j/k;const p0=y1+.08-.02,p1=y1+.21+.02;bake(box,a[0]+(b[0]-a[0])*t,(p0+p1)/2,a[2]+(b[2]-a[2])*t,.05,p1-p0,.05,'#e9e6de',0,'solid');/* from 2 cm inside the base course (top y1+.08) to 2 cm inside the rail (bottom y1+.21) */}}
        const A=L[i],B=L[(i+1)%4],len=Math.hypot(B[0]-A[0],B[2]-A[2]);for(let t=.1;t<1;t+=5.2/len){const p=[A[0]+(B[0]-A[0])*t,A[2]+(B[2]-A[2])*t],cen=[(lo[0][0]+lo[2][0])/2,(lo[0][1]+lo[2][1])/2];
          const dx=cen[0]-p[0],dz=cen[1]-p[1],dl=Math.hypot(dx,dz),x=p[0]+dx/dl*.75,z=p[1]+dz/dl*.75,ry=-Math.atan2(B[2]-A[2],B[0]-A[0]);
          bake(box,x,y0+1.1,z,.95,1.3,.8,'#d8d5cd',ry,'solid');bake(box,x-dx/dl*.41,y0+1.0,z-dz/dl*.41,.6,.85,.04,'#3a4148',ry,'solid');bake(cylinder,x,y0+1.75,z,.48,.8,.48,'#d8d5cd',ry+Math.PI/2,'solid',Math.PI/2);}}}}

  A1();
  // ---- Santa Ana: pink front, white pilasters and entablature, arched portal, oculus, raised centre with curved shoulders
  // and a cross; asymmetric belfry over the west end. ----
  {const s=n.shells.santaAna,R=s.roof;
    for(const f of n.faces.santaAna){const front=f.role==='front',F=facade(f,R,{trim:WHITE,base:'#c99a98',fill:'#4a3a33',glass:true,bay:4,storey:4.2,first:2.6,win:[.9,1.8],arched:'all',pilaster:front?0:.5,
      // generic arched bays overlapped the authored portal, niches and oculus on the same plane
      holes:front?(F=>{const u=F.L/2,g=F.g(u,.4);return [[u-1.65,u+1.65,-1e9,g+4.7],[F.L*.14-.6,F.L*.14+.6,-1e9,F.g(F.L*.14,.4)+3.2],[F.L*.86-.6,F.L*.86+.6,-1e9,F.g(F.L*.86,.4)+3.2],[u-1.3,u+1.3,g+7.3,g+9.9]];}):null});
      if(!front)continue;const u=F.L/2,g=F.g(u,.4),[lo]=F.range(0,F.L),ent=g+6.2;
      for(const uu of [.35,F.L-.35])F.box(uu,(lo-.1+R-.4)/2,.06,.74,R-.4-(lo-.1),.12,WHITE);/* wraps the corner 2 cm (its end lay on the base band's) */
      for(const uu of [F.L*.27,F.L*.73])F.box(uu,(lo-.1+ent)/2,.055,.55,ent-(lo-.1),.11,WHITE);
      F.box(u,ent,.08,F.L+.1,.5,.16,WHITE);
      F.arched(u,F.range(u-1.5,u+1.5)[0]-.05,2.5,g+3.05,WHITE,'#4b3226',.26,.05);F.box(u,g+1.5,.15,.04,3.0,.02,'#33221a');/* leaf split 1.5 cm in front of the portal fill (front .125) */
      for(const uu of [F.L*.14,F.L*.86]){const gg=F.g(uu,.4);F.arched(uu,gg+1.2,.8,gg+2.5,WHITE,'#3f322c',.14,.05);}
      F.disk(u,g+8.6,.06,1.15,.12,WHITE);F.disk(u,g+8.6,.08,.82,.1,'#3a3f45');
      // Raised centre over the cornice with curved shoulders (stepped sloped bars), cross on top.
      // one continuous crown profile (curved shoulders rising into a peaked centre), white edge as a second profile.
      const prof=(e,lift=0)=>{const b=e?R-.03:R-.02,q=[[.35-e,b],[F.L-.35+e,b],[F.L-.35+e,R+.45+lift]];
        for(let k=1;k<=6;k++){const t=k/6;q.push([F.L-.35+e-(F.L/2-.35-2.1)*t,R+.45+lift+1.2*Math.sin(t*Math.PI/2)]);}
        q.push([u+2.1-e*.5,R+2.4+lift],[u,R+3.35+lift+e],[u-2.1+e*.5,R+2.4+lift]);
        for(let k=5;k>=0;k--){const t=k/6;q.push([.35-e+(F.L/2-.35-2.1)*t,R+.45+lift+1.2*Math.sin(t*Math.PI/2)]);}return q;};
      extrudeOnFace(F,prof(.1,.16),.08,.28,WHITE);extrudeOnFace(F,prof(0),.1,.85,n.constants.COLOURS.santaAna);
      F.disk(u,R+1.55,.15,.5,.08,WHITE,'solid');F.disk(u,R+1.55,.2,.34,.06,'#3a3f45','solid');
      {const [x,z]=F.P(u,-.15);bake(box,x,R+4.05,z,.1,1.0,.1,'#d8d5cc',F.ry,'solid');bake(box,x,R+4.25,z,.55,.1,.1,'#d8d5cc',F.ry,'solid');}
      // Belfry: square pink tower behind the west end of the front, arched openings, white cornice and a low dome.
      // Belfry tied to the roof by a pink base block, then four corner piers round TRUE openings (daylight), a bell, cornice, dome.
      {A0();const [x,z]=F.P(2.0,-2.2),T=R+5.2,PK=n.constants.COLOURS.santaAna;bake(box,x,(R-.3+R+3.1)/2,z,2.9,3.4,2.9,PK,F.ry,'solid');
        bake(box,x,R+3.15,z,3.05,.12,3.05,WHITE,F.ry,'solid');
        for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const px=x+F.ux*a*1.1+F.n[0]*b*1.1,pz=z+F.uz*a*1.1+F.n[1]*b*1.1;bake(box,px,(R+3.1+T-.4)/2,pz,.7,T-.4-R-3.1,.7,PK,F.ry,'solid');
          bake(box,px,(R+3.1+T-.4)/2,pz,.76,.12,.76,WHITE,F.ry,'solid');}
        bake(box,x,T-.2,z,2.9,.4,2.9,PK,F.ry,'solid');bake(cylinder,x,R+4.0,z,.2,.42,.2,'#6a5a38',0,'solid');
        // the bell hung 25.5 cm under a beam that ended short of the piers. Beam now spans the cap's underside
        // (1 cm into the cap, 2.9 m pier to pier); hanger from 2 cm inside the bell top into the beam.
        {const capLo=T-.4,beamLo=capLo-.06,bellTop=R+4.0+.21;bake(box,x,(beamLo+capLo+.01)/2,z,2.9,capLo+.01-beamLo,.06,'#3a332a',F.ry,'solid');bake(box,x,(bellTop-.02+beamLo+.02)/2,z,.035,beamLo+.02-(bellTop-.02),.035,'#3a332a',F.ry,'solid');/* slim bar and hanger */}
        bake(box,x,T+.1,z,3.2,.2,3.2,WHITE,F.ry,'solid');bake(sphere,x,T+.2,z,1.25,1.0,1.25,'#e9cfc9',0,'solid');bake(cylinder,x,T+1.35,z,.07,.5,.07,'#d8d5cc',0,'solid');A1();}}}

  // ---- San Francisco: yellow chapel, cream buttress pilasters on the street flank, high arched windows, west door with a
  // pediment and oculus. ----
  {const s=n.shells.sanFrancisco,R=s.roof;
    for(const f of n.faces.sanFrancisco){const F=facade(f,R,{trim:'#f2e6c8',base:'#c9a95a',fill:'#3d3a33',glass:true,bay:4.6,storey:20,first:R-F0(f)-5.6,win:[1.0,2.6],arched:'all',pilaster:0,
      holes:f.role==='front'?(F=>{const u=F.L/2,g=F.g(u,.4);return [[u-2.2,u+2.2,-1e9,g+4.95],[u-1.0,u+1.0,g+5.4,g+7.4]];}):
        f.role==='east'?(F=>{const [,h]=F.range(0,F.L),bw=F.L/Math.max(1,Math.round(F.L/4.6));return [[-1e9,1e9,-1e9,h+4.4+(bw-1.6)/2+.4]];}):null});
      if(F.L<3)continue;
      // Audit 17: the east face toward Tamarindo gets a stone footing, buttress pilasters and shallow blind arches (photo J's
      // buttress rhythm; no false windows).
      if(f.role==='east'){const k=Math.max(1,Math.round(F.L/4.6)),bw=F.L/k;
        for(let u=0;u<F.L;u+=6){const w2=Math.min(6,F.L-u),[l2,h2]=F.range(u,u+w2);F.box(u+w2/2,(l2-.25+h2+1.2)/2,.05,w2+.05,h2+1.2-(l2-.25),.1,'#cdb98f');F.box(u+w2/2,h2+1.22,.06,w2+.05,.1,.2,'#f2e6c8');}/* segments overlap 1.5–2.5 cm (their ends lay on the base band's segment ends) */
        for(let i=0;i<k;i++){const u=(i+.5)*bw,s0=Math.min(Math.floor(u/6)*6,F.L-.01),[,h2]=F.range(s0,Math.min(s0+6,F.L));if(!F.open(u))continue;F.arched(u,h2+1.35,bw-1.6,h2+4.4,'#f2e6c8','#d9b65a',.16,.04);}}/* arch base from its own footing segment (bottoms coincided by grade) */
      if(f.role==='flank'||f.role==='front'||f.role==='east'){const k=Math.max(1,Math.round(F.L/4.6)),bw=F.L/k;
        for(let i=0;i<=k;i++){const u=Math.max(.45,Math.min(F.L-.45,i*bw)),[lo]=F.range(u-.45,u+.45);if(!F.open(u))continue;
          /* P3: no pilaster through the west portal, pediment and oculus*/if(f.role==='front'&&Math.abs(u-F.L/2)<2.4)continue;F.box(u,(lo-.15+R-.45)/2,.07,.9,R-.45-(lo-.15),.14,'#f2e6c8');}}
      if(f.role==='front'){const u=F.L/2,g=F.g(u,.4),[dl]=F.range(u-1.7,u+1.7);
        // the leaf sat behind its own cream surround (front 0.105 < 0.12). Now surround 0.12, leaf 0.16, split 0.18; a
        // grounded stone sill (0.1 m proud, 0.14 high) and flanking pilasters.
        F.box(u,(dl-.06+g+3.8)/2,.06,3.4,g+3.8-(dl-.06),.12,'#f2e6c8');F.box(u,(dl+.1+g+3.6)/2,.13,2.5,g+3.6-(dl+.1),.06,'#4a3123');F.box(u,(dl+.1+g+3.6)/2,.17,.05,g+3.6-(dl+.1),.02,'#2a1a12');
        for(const sd of [-1,1])F.box(u+sd*.62,(dl+.6+g+3.1)/2,.165,.9,g+2.5-dl,.01,'#5a3d2c');
        F.box(u,dl+.07-.06,.1,3.2,.2,.2,'#d3cab7');for(const sd of [-1,1])F.box(u+sd*1.95,(dl-.1+g+4.2)/2,.08,.42,g+4.3-dl,.16,'#f2e6c8');
        bar([...F.P(u-1.9,.2)].flatMap((v,i)=>i?[g+3.95,v]:[v]),[...F.P(u,.2)].flatMap((v,i)=>i?[g+4.75,v]:[v]),.3,.2,'#f2e6c8');
        bar([...F.P(u,.2)].flatMap((v,i)=>i?[g+4.75,v]:[v]),[...F.P(u+1.9,.2)].flatMap((v,i)=>i?[g+3.95,v]:[v]),.3,.2,'#f2e6c8');
        F.disk(u,g+6.4,.06,.85,.12,'#f2e6c8');F.disk(u,g+6.4,.08,.6,.1,'#3a3f45');
        // Small pediment and cross over the west front.
        A0();const [x,z]=F.P(u,-.2);bar([...F.P(u-3.6,-.1)].flatMap((v,i)=>i?[R+.2,v]:[v]),[...F.P(u,-.1)].flatMap((v,i)=>i?[R+1.7,v]:[v]),.6,.3,'#f2e6c8');
        bar([...F.P(u,-.1)].flatMap((v,i)=>i?[R+1.7,v]:[v]),[...F.P(u+3.6,-.1)].flatMap((v,i)=>i?[R+.2,v]:[v]),.6,.3,'#f2e6c8');
        bake(box,x,R+.7,z,5.6,1.0,.35,n.constants.COLOURS.sanFrancisco,F.ry,'solid');
        {const apex=R+1.7+.15;bake(box,x,apex-.03+.45,z,.09,.9,.09,'#d8d5cc',F.ry,'solid');bake(box,x,apex-.03+.6,z,.45,.08,.09,'#d8d5cc',F.ry,'solid');A1();}}}/* cross 3 cm into the pediment apex (it stood 1.2 cm above) */
    function F0(f){return Math.min(height(...f.a),height(...f.b));}}

  // ---- Salvador Brau: pale plinth, bronze seated figure (legs crossed, arm on knee), plaque. ----
  {const b=n.brau,c=Math.cos(b.heading),s=Math.sin(b.heading),P=(u,y,d)=>[b.x+c*u+s*d,y,b.z-s*u+c*d];
    A0();const lb=(u,y,d,w,h,dd,col,rz=0)=>bake(box,...P(u,y,d),w,h,dd,col,b.heading,'solid',rz);const y=b.y,BR='#4f5d4c';
    let gm=b.g;for(let i=0;i<=6;i++)for(let j=0;j<=6;j++){const [px,,pz]=P(-.575+i*1.15/6,0,-.575+j*1.15/6);gm=Math.min(gm,height(px,pz));}
    lb(0,(gm-.15+y)/2,0,1.15,y-(gm-.15),1.15,'#ddd8cc');lb(0,y+.04,0,1.3,.08,1.3,'#e8e3d8');lb(0,y-.55,.58,.6,.35,.02,'#3d3a33');
    // limbs aimed hip→knee→ankle (explicit endpoints), sloped rock seat, lighter patina; crossed-leg diagonal.
    const BRZ='#5f7564',J=(u,yy,d)=>P(u,y+yy,d),limb=(a,b2,r)=>kit.seg(J(...a),J(...b2),r,BRZ);
    lb(0,y+.26,-.15,1.0,.48,.8,'#d7d1c3');lb(0,y+.5,-.33,.9,.16,.4,'#cfc8b9',.08);
    limb([0,.62,-.32],[0,1.28,-.4],.17);bake(sphere,...J(0,1.36,-.4),.21,.12,.15,BRZ,b.heading,'solid');
    bake(sphere,...J(0,1.58,-.36),.12,.14,.13,BRZ,0,'solid');limb([0,1.42,-.39],[0,1.5,-.38],.06);
    limb([-.12,.6,-.25],[-.14,.62,.22],.085);limb([-.14,.62,.22],[-.16,.1,.32],.07);              // left: thigh level, shin down
    limb([.12,.62,-.25],[-.02,.8,.2],.085);limb([-.02,.8,.2],[.16,.42,.44],.07);                   // right crossed over the left knee
    limb([-.21,1.3,-.38],[-.27,.98,-.15],.055);limb([-.27,.98,-.15],[-.06,.84,.18],.05);           // arms meeting on the knee
    limb([.21,1.3,-.38],[.25,.98,-.12],.055);limb([.25,.98,-.12],[.02,.86,.2],.05);A1();}

  // Lawn-bed kerbs (audit 18 / Colón triangle): a low pale stone kerb on every bed edge — a clean return, tiny dressing.
  for(const k of n.kerbs??[])bar([k.a[0],k.ga+.02,k.a[1]],[k.b[0],k.gb+.02,k.b[1]],.16,.13,'#d9d2c2');
  // Palomas: coursed masonry skin over the whole scarp under the parapet (the old city wall face below the park) (seen from the bay; the DEM keeps the
  // physics — this rides 0.1 m over it, out of reach beyond the parapet and its seal).
  // courses run HORIZONTALLY — each column down the scarp is sampled where the DEM crosses absolute
  // elevations k·0.6 m (not at fixed plan steps), so neighbouring columns share every course line and the alternating tones
  // read as level masonry courses instead of a ragged patchwork. The skin is drawn in the Palomas paving mesh (no shadow:
  // it lies 0.1 m on the DEM; casting from it changed nothing but cost).
  {const P=n.parapet,H=.6;
    const col2=s2=>{const at=d=>{const x=s2.O[0]-s2.n[0]*d,z=s2.O[1]-s2.n[1]*d;return [x,height(x,z),z];};
      const top=at(0),pts={top,lv:new Map(),bottom:null};let k=Math.ceil(top[1]/H)-1,a=top;
      for(let d=.1;d<=16+1e-9;d+=.1){const b=at(d);if(b[1]<5||b[1]<s2.g-17)break;
        while(k*H>b[1]&&k*H<=a[1]){const t=(a[1]-k*H)/(a[1]-b[1]);pts.lv.set(k,[a[0]+(b[0]-a[0])*t,k*H,a[2]+(b[2]-a[2])*t]);k--;}a=b;}
      pts.bottom=a;return pts;};
    const lift=p=>[p[0],p[1]+.1,p[2]];
    const quad=(q,band)=>{if(q.flat().some(v=>!Number.isFinite(v)))return;const g=new THREE.BufferGeometry(),pos=[];
      const up=(a,b,c2)=>{const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c2[0]-a[0],c2[1]-a[1],c2[2]-a[2]];return e1[2]*e2[0]-e1[0]*e2[2];};
      for(const t3 of [[q[0],q[1],q[2]],[q[0],q[2],q[3]]]){const u=up(...t3);if(!(Math.abs(u)>1e-4))continue;pos.push(...(u>0?t3:[t3[0],t3[2],t3[1]]).map(lift).flat());}
      if(!pos.length){g.dispose();return;}g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,band,0,'skin');g.dispose();};
    // stones of irregular length along each level course (joints every 2–5 columns, offset per course) in four
    // weathered masonry tones, instead of one uniform stripe per course; the courses stay level.
    const TONES=['#a29177','#a9987c','#9b8a6f','#b2a185'],hs=(a,b)=>{let h=Math.imul(a*73856093^b*19349663,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};
    const stone=(k,i)=>{let c=0,j=0;const off=Math.floor(hs(k,7)*5);while(c+off<=i){c+=2+Math.floor(hs(k,j+11)*4);j++;}return TONES[Math.floor(hs(k*31+j,3)*4)];};
    for(let i=0;i+1<P.length;i++){const A=col2(P[i]),B=col2(P[i+1]),ks=[...A.lv.keys()].filter(k=>B.lv.has(k)).sort((x,y)=>y-x),par=k=>stone(k,i);
      if(!ks.length){quad([A.top,B.top,B.bottom,A.bottom],stone(0,i));continue;}
      quad([A.top,B.top,B.lv.get(ks[0]),A.lv.get(ks[0])],par(ks[0]+1));
      for(let j=0;j+1<ks.length;j++)quad([A.lv.get(ks[j]),B.lv.get(ks[j]),B.lv.get(ks[j+1]),A.lv.get(ks[j+1])],par(ks[j]));
      quad([A.lv.get(ks.at(-1)),B.lv.get(ks.at(-1)),B.bottom,A.bottom],par(ks.at(-1)));}}
  // ---- Barandilla terrace edges and stair rails (physics in the layout): pale stone retaining edge with a
  // coping, short balusters and a top rail, following the existing slope. ----
  for(const t of n.terraces??[]){const st=t.st;
    for(let i=0;i+1<st.length;i++){const a=st[i],b=st[i+1],[ux,uz]=[(b.p[0]-a.p[0]),(b.p[1]-a.p[1])],l=Math.hypot(ux,uz),nx=-uz/l*.24,nz=ux/l*.24;
      const r=[[a.p[0]+nx,a.p[1]+nz],[b.p[0]+nx,b.p[1]+nz],[b.p[0]-nx,b.p[1]-nz],[a.p[0]-nx,a.p[1]-nz]],lo=Math.min(a.g,b.g)-.25;
      solid(r,[lo,lo,lo,lo],[a.g+.45,b.g+.45,b.g+.45,a.g+.45],'#cfc3ab');
      const r2=[[a.p[0]+nx*1.25,a.p[1]+nz*1.25],[b.p[0]+nx*1.25,b.p[1]+nz*1.25],[b.p[0]-nx*1.25,b.p[1]-nz*1.25],[a.p[0]-nx*1.25,a.p[1]-nz*1.25]];
      solid(r2,[a.g+.45,b.g+.45,b.g+.45,a.g+.45],[a.g+.55,b.g+.55,b.g+.55,a.g+.55],'#e6dfd0');
      for(let s2=.15;s2<l;s2+=.32){const f=s2/l,x=a.p[0]+(b.p[0]-a.p[0])*f,z=a.p[1]+(b.p[1]-a.p[1])*f,gy=a.g+(b.g-a.g)*f;bake(box,x,gy+.73,z,.11,.36,.11,'#ece6d8',Math.atan2(-(b.p[1]-a.p[1]),b.p[0]-a.p[0]),'solid');}
      bar([a.p[0],a.g+.94,a.p[1]],[b.p[0],b.g+.94,b.p[1]],.3,.1,'#ece6d8');}}

  // ---- Street furniture (shared kit) and tree cut-outs. ----
  A0();kit.lamps(n.lamps);A1();A0();kit.benches(n.benches);A1();A0();kit.trees(n.trees);A1();
  // Tree pits follow the grade (steep-footprint rule): a soil disc 5 cm over the ground at each rim vertex (over the paving) and a low kerb
  // (10 cm over the ground, 3 cm buried) whose segments take their heights from the ground at their own corners — no level
  // drum showing a buried side on a slope.
  for(const t of n.trees)if(t.cutout){const K=16,at=(r,k)=>{const a=k*2*Math.PI/K,x=t.x+Math.cos(a)*r,z=t.z+Math.sin(a)*r;return [x,z,height(x,z)];};
    const c=[t.x,t.z,height(t.x,t.z)];for(let k=0;k<K;k++){const q=[c,at(.97,k),at(.97,k+1)];solid(q.map(p=>[p[0],p[1]]),q.map(p=>p[2]-.05),q.map(p=>p[2]+.05),'#6b4a3a');}/* soil fanned from the trunk's ground */
    for(let k=0;k<K;k++){const q=[at(.95,k),at(.95,k+1),at(1.12,k+1),at(1.12,k)];solid(q.map(p=>[p[0],p[1]]),q.map(p=>p[2]-.03),q.map(p=>p[2]+.10),'#b9b2a4');}}
  // ---- Self-drawn paving: Palomas dark red-grey stone panels with pale borders (ref F, the near-
  // white" field), Barandilla brick-red/pink concrete plates (ref L). Clipped onto the ORIGINAL terrain facets (as the
  // shared overlays and the Princesa brick), so drawn = physical; exported as layout `brick` for ownership. ----
  // ONE neutral plate texture shared by every paving kind (was two 256² textures); the kind's tone is a vertex
  // colour, its plate size a UV scale (lawn uses a huge scale so the plates vanish into a flat tone). One mesh per landmark.
  const pave={};
  if(n.brick?.length&&n.grid?.nx){const t=n.grid;
    const clip=(poly,ring)=>{const sign=Math.sign(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0));let out=poly;
      for(let j=0;j<ring.length&&out.length;j++){const a=ring[j],b=ring[(j+1)%ring.length],input=out;out=[];const d=p=>sign*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
        for(let k=0;k<input.length;k++){const p=input[k],q=input[(k+1)%input.length],dp=d(p),dq=d(q);if(dp>=0)out.push(p);if((dp>=0)!==(dq>=0)){const w2=dp/(dp-dq);out.push(p.map((v,i)=>v+(q[i]-v)*w2));}}}
      return out;};
    const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');let seed=7717;const r=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    x.fillStyle='#8c8c8c';x.fillRect(0,0,256,256);
    for(let j=0;j<4;j++)for(let i=0;i<4;i++){const v=200+r()*40|0;x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(i*64+3,j*64+3,58,58);
      for(let k=0;k<160;k++){x.fillStyle=r()<.5?'rgba(0,0,0,.07)':'rgba(255,255,255,.07)';x.fillRect(i*64+3+r()*58,j*64+3+r()*58,2,2);}}
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;ctx.textures.add(tex);
    // the Fortaleza forecourt samples the STREET's sett texture (sj-streets.js settTexture, shared) in Calle
    // de la Fortaleza's frame with the street's convention (across/2.4, along/1.2), flagged by u + 1000 (repeat wrap keeps the
    // phase), so bond, scale, orientation, tone and phase continue across the street's end line. Same mesh, same draw.
    const T=THREE.TSL,sTex=settTexture(ctx.textures),FF=n.forecourtFrame;
    const material=new THREE.MeshStandardNodeMaterial({color:'#ffffff',vertexColors:true,roughness:.95,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    material.colorNode=T.select(T.uv().x.greaterThan(500),T.texture(sTex,T.uv()),T.texture(tex,T.uv()));
    const KIND={'palomas-stone':{c:'#8f7b73',S:9.6},'barandilla-plates':{c:'#c98272',S:3.2},'apron-stone':{c:'#d6cfc1',S:2.4},'lawn':{c:'#5f7f45',S:400},'setts':{c:'#ffffff',S:1}};
    // (draw budget): the San Francisco and Colón paving share one mesh — same material, flat ground, always
    // submitted together from the old-grid streets (Calle San Francisco/Tetuán) where both sites are in view; ~180 m radius.
    // Likewise the Fortaleza forecourt setts ride in the Palomas paving mesh (~70 m radius), so the forecourt adds no draw.
    const PAVE={0:1,4:3},groupOf=(px,pz)=>{let best=0,d=Infinity;GROUPS.forEach(([,cc],i)=>{const e=Math.hypot(px-cc[0],pz-cc[1]);if(e<d){d=e;best=i;}});return PAVE[best]??best;};
    const out=new Map(),col=new THREE.Color();
    for(const {ring,kind} of n.brick){const K=KIND[kind]??KIND['apron-stone'];col.set(K.c);const cx=ring.reduce((s2,p)=>s2+p[0],0)/ring.length,cz=ring.reduce((s2,p)=>s2+p[1],0)/ring.length,gi=groupOf(cx,cz);
      let o=out.get(gi);if(!o)out.set(gi,o={ids:new Map(),vp:[],uv:[],cl:[],index:[]});
      const minX=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[0]))-t.x0)/t.step)),maxX=Math.min(t.nx-2,Math.ceil((Math.max(...ring.map(p=>p[0]))-t.x0)/t.step));
      const minZ=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[1]))-t.z0)/t.step)),maxZ=Math.min(t.nz-2,Math.ceil((Math.max(...ring.map(p=>p[1]))-t.z0)/t.step));
      for(let j=minZ;j<=maxZ;j++)for(let i=minX;i<=maxX;i++){const x0=t.x0+i*t.step,z0=t.z0+j*t.step,k=j*t.nx+i,H=t.heights;
        const a=[x0,H[k],z0],b=[x0+t.step,H[k+1],z0],cc=[x0,H[k+t.nx],z0+t.step],d=[x0+t.step,H[k+t.nx+1],z0+t.step];
        for(const tri of [[a,cc,b],[b,cc,d]]){const poly=clip(tri,ring);
          for(let q=1;q<poly.length-1;q++){const P3=[poly[0],poly[q],poly[q+1]];
            if(Math.abs((P3[1][0]-P3[0][0])*(P3[2][2]-P3[0][2])-(P3[1][2]-P3[0][2])*(P3[2][0]-P3[0][0]))<1e-9)continue;
            for(const p of P3){const key=kind+':'+p[0].toFixed(4)+','+p[2].toFixed(4);let id=o.ids.get(key);
              if(id===undefined){id=o.vp.length/3;o.ids.set(key,id);o.vp.push(p[0],p[1],p[2]);if(kind==='setts'&&FF){const dx=p[0]-FF.o[0],dz=p[2]-FF.o[1];o.uv.push(1000+(dx*FF.n[0]+dz*FF.n[1])/2.4,(dx*FF.u[0]+dz*FF.u[1])/1.2);}else o.uv.push((p[0]*.995-p[2]*.1)/K.S,(p[0]*.1+p[2]*.995)/K.S);o.cl.push(col.r,col.g,col.b);}o.index.push(id);}}}}}
    // (draw budget): the Casino mansard and the Tapia pediment — roof-line solids that shade only their own
    // roof — ride in the site's paving mesh instead of a separate casting batch. Each triangle keeps its own vertices (flat
    // normals) and samples one uniform border texel of the plate texture (pixel (1,1), border on every side and under flipY),
    // so the texture factor is exactly the border grey and the vertex colour divides it out.
    {const tone=new THREE.Color('#8c8c8c').r;
      for(const r of local.roofParts){const gi=PAVE[r.gi]??r.gi;let o=out.get(gi);if(!o)out.set(gi,o={ids:new Map(),vp:[],uv:[],cl:[],index:[]});col.set(r.c);
        for(let i=0;i<r.p.length;i+=3){// the scarp skin is one smooth surface: its vertices are shared per course (key with the tone)
          const key=r.smooth?'skin:'+r.c+':'+r.p[i].toFixed(3)+','+r.p[i+1].toFixed(3)+','+r.p[i+2].toFixed(3):null;let id=key?o.ids.get(key):undefined;
          if(id===undefined){id=o.vp.length/3;if(key)o.ids.set(key,id);o.vp.push(r.p[i],r.p[i+1],r.p[i+2]);o.uv.push(1.5/256,1.5/256);o.cl.push(col.r/tone,col.g/tone,col.b/tone);}o.index.push(id);}}}
    for(const [gi,o] of [...out].sort((a,b)=>a[0]-b[0])){const g=ctx.own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(o.vp,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(o.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(o.cl,3));
      g.setIndex(new (o.vp.length/3<65536?THREE.Uint16BufferAttribute:THREE.Uint32BufferAttribute)(o.index,1));g.computeVertexNormals();g.computeBoundingSphere();
      const m=new THREE.Mesh(g,material);m.name='sj-plaza-landmarks-'+GROUPS[gi][0]+(gi===3?'-colon':gi===1?'-fortaleza':'')+'-paving';m.receiveShadow=true;ctx.scene.add(m);ctx.meshes.push(m);pave[GROUPS[gi][0]]=o.index.length/3;}}
  stats.paving=pave;
  const made=local.finish();
  return {...stats,...made,lamps:n.lamps.length,benches:n.benches.length,trees:n.trees.length,parapet:n.parapet.length};
}
