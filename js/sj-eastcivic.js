/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Eastern civic district visuals — © 2026 VibezZzCoder, MIT. Every physical dimension comes from sj-eastcivic-layout.js.
// ctx: {scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height} — the shared pools. This district spans ~720 m, so
// it keeps its own few pools (one instanced mesh per primitive and pass, one merged batch per pass) instead of the shared
// 64 m cells: about a dozen draw calls for the whole east end.
// References (view-only): the Capitol's white marble, heavy cornice, tall shadowed openings,
// balustraded roof with urns, freestanding Corinthian shafts before closed dark doors, pale monumental stairs, low ribbed
// dome on a drum with a small lantern (Mtmelendez / J. Láscar / NRHP); Carnegie's columned centre; the Ateneo's red front
// and raised crown; Casa de España's tiled corner towers and arched entrance; the YMCA's cornice, paired openings and
// balconies; the Tropical school's red tile roofs and tower; San Juan Bautista's bronze on a marble pedestal behind a low
// parapet; lions on the Leones exedra (OECH District 1).
import * as THREE from 'three/webgpu';
import {streetKit,IRON} from './sj-street-kit.js';
import {tallPalm} from './sj-palm.js';
import {createStatueBuilder,statueFrame} from './sj-statues.js';
import {faceList,STYLE,CAPITOL_ID,CAMARA_ID,SENADO_ID,ESPANA_ID,CARNEGIE_ID,ATENEO_ID,OLIMPICA_ID,TROPICAL_ID} from './sj-eastcivic-layout.js';

const MARBLE='#ece7dc',MARBLE_SH='#dcd5c7',TRIM='#f7f4ed',GLASS='#30353a',DOOR='#3a3124',BRONZE='#5d4b37',GRANITE='#8a8780',TREAD=['#e0d9cb','#d7d0c1'];

// ---- Near/far compaction  ----
// Cutoff in drawing-buffer pixels: a part stays if its middle dimension projects to ≥ `px` pixels, or to ≥ `minPx` with a
// projected area (middle × largest dimension) ≥ `areaPx` (long thin parts covering more than about a pixel stay). Pixels
// per metre come from the actual drawing-buffer height (read before every main render in scene.onBeforeRender, so the 3D
// resolution setting, rotation and window size count), the camera's vertical FOV and each part's projected depth. `bufferHeight` is only the value used before the first frame (and by Node tools).
// Palms switch one by one between the full palm and a two-part proxy (trunk box + crown in the box/ico pools) at their own
// distance with hysteresis (near below palmNear, far above palmFar).
export const EASTCIVIC_LOD={px:1,minPx:.25,areaPx:1.5,near:30,shadowNear:110,cone:20*Math.PI/180,move:4,turn:10*Math.PI/180,palmNear:230,palmFar:250,bufferHeight:800};
// Per-instance world centre/radius (geometry bounding sphere through the instance matrix), middle and largest scaled extent.
// band: {pid,want} — an instance with pid ≥ 0 is kept only while its palm's near state equals `want`.
function compactEntry(mesh,cone,band=null,asm=null){const g=mesh.geometry,n=mesh.count,src=mesh.instanceMatrix.array.slice(0,n*16),col=mesh.instanceColor?.array.slice(0,n*3)??null;
  if(!g.boundingSphere)g.computeBoundingSphere();if(!g.boundingBox)g.computeBoundingBox();
  const gc=g.boundingSphere.center,gr=g.boundingSphere.radius,bb=g.boundingBox,ex=bb.max.x-bb.min.x,ey=bb.max.y-bb.min.y,ez=bb.max.z-bb.min.z;
  const C=new Float32Array(n*4),S=new Float32Array(n),X=new Float32Array(n);
  for(let i=0;i<n;i++){const o=i*16,lx=Math.hypot(src[o],src[o+1],src[o+2]),ly=Math.hypot(src[o+4],src[o+5],src[o+6]),lz=Math.hypot(src[o+8],src[o+9],src[o+10]);
    C[i*4]=src[o]*gc.x+src[o+4]*gc.y+src[o+8]*gc.z+src[o+12];C[i*4+1]=src[o+1]*gc.x+src[o+5]*gc.y+src[o+9]*gc.z+src[o+13];C[i*4+2]=src[o+2]*gc.x+src[o+6]*gc.y+src[o+10]*gc.z+src[o+14];
    C[i*4+3]=gr*Math.max(lx,ly,lz);const a=lx*ex,b=ly*ey,c=lz*ez,mx=Math.max(a,b,c),mn=Math.min(a,b,c);S[i]=a+b+c-mx-mn;X[i]=mx;}
  return {mesh,n,src,col,C,S,X,cone,band,asm,flag:new Uint8Array(n),idx:new Int32Array(n),prev:new Int32Array(n),prevN:-1};}
function compactor(list,palms,view,asmCount=0,asmBatch=new Set()){const L=EASTCIVIC_LOD,eye=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),last=new THREE.Vector3(Infinity,0,0),lastF=new THREE.Vector3();
  const asmKeep=new Uint8Array(asmCount),asmStatic=new Uint8Array(asmCount);for(const a of asmBatch)asmStatic[a]=1;
  let lf=NaN,la=NaN,lh=NaN;const sphere=new THREE.Sphere(),one=new THREE.Sphere(),near=new Uint8Array(palms.length/3).fill(1);
  return camera=>{if(!camera.isPerspectiveCamera)return;camera.updateMatrixWorld();eye.setFromMatrixPosition(camera.matrixWorld);camera.getWorldDirection(fwd);
    const H=view.height;if(camera.fov===lf&&camera.aspect===la&&H===lh&&eye.distanceToSquared(last)<L.move*L.move&&fwd.dot(lastF)>Math.cos(L.turn))return;
    last.copy(eye);lastF.copy(fwd);lf=camera.fov;la=camera.aspect;lh=H;right.setFromMatrixColumn(camera.matrixWorld,0).normalize();up.setFromMatrixColumn(camera.matrixWorld,1).normalize();
    const t=Math.tan(camera.fov*Math.PI/360),vA=Math.atan(t)+L.cone,hA=Math.atan(t*camera.aspect)+L.cone;
    // Focal length in buffer pixels; a part's scale is focal / projected depth, the depth taken at its angle off the view
    // axis plus the 10° turn allowed before the next recompute (≤ 80°), so a later turn cannot make a dropped part bigger.
    const ppm=H/(2*t),cT=Math.cos(L.turn),sT=Math.sin(L.turn);
    for(let p=0;p<near.length;p++){const d=Math.hypot(palms[p*3]-eye.x,palms[p*3+1]-eye.y,palms[p*3+2]-eye.z);if(near[p]&&d>L.palmFar)near[p]=0;else if(!near[p]&&d<L.palmNear)near[p]=1;}
    // Pass 1: per instance, bit 1 = in view (or near), bit 2 = big enough (or near); an assembly is kept when any member has
    // both. Pass 2 keeps a member that is in view while its assembly is kept (or always, for members of batch assemblies).
    asmKeep.set(asmStatic);
    for(const E of list){const {n,C,S,X,band,flag,asm}=E;
      for(let i=0;i<n;i++){flag[i]=0;if(band){const p=band.pid[i];if(p>=0&&near[p]!==band.want)continue;}
        const dx=C[i*4]-eye.x,dy=C[i*4+1]-eye.y,dz=C[i*4+2]-eye.z,r=C[i*4+3],dist=Math.hypot(dx,dy,dz),gap=dist-r;
        if(gap<=(E.cone?L.near:L.shadowNear)){flag[i]=3;}
        else{let f=1;
          if(E.cone){const z=dx*fwd.x+dy*fwd.y+dz*fwd.z,x=dx*right.x+dy*right.y+dz*right.z,y=dx*up.x+dy*up.y+dz*up.z;
            if(Math.atan2(Math.abs(x),z)-Math.asin(Math.min(1,r/Math.max(1e-3,Math.hypot(x,z))))>hA||Math.atan2(Math.abs(y),z)-Math.asin(Math.min(1,r/Math.max(1e-3,Math.hypot(y,z))))>vA)f=0;}
          const ca=Math.max(-1,Math.min(1,(dx*fwd.x+dy*fwd.y+dz*fwd.z)/Math.max(dist,1e-3))),sa=Math.sqrt(1-ca*ca);
          const k=ppm/(Math.max(dist,1e-3)*Math.max(.17,ca*cT-sa*sT)),m=S[i]*k;if(m>=L.px||m>=L.minPx&&m*X[i]*k>=L.areaPx)f|=2;flag[i]=f;}
        if(flag[i]===3&&asm&&asm[i]>=0)asmKeep[asm[i]]=1;}}
    for(const E of list){const {mesh,n,src,col,C,idx,flag,asm}=E;let j=0;
      for(let i=0;i<n;i++){const f=flag[i];if(f===3||(f&1)&&asm&&asm[i]>=0&&asmKeep[asm[i]])idx[j++]=i;}
      mesh.visible=j>0;
      // Upload only when the kept set changed (exact comparison of the index lists, no per-instance allocation).
      let same=j===E.prevN;for(let q=0;same&&q<j;q++)if(idx[q]!==E.prev[q])same=false;if(same)continue;
      E.prev.set(idx.subarray(0,j));E.prevN=j;mesh.count=j;if(!j)continue;
      const M=mesh.instanceMatrix.array,K=mesh.instanceColor?.array;sphere.makeEmpty();
      for(let q=0;q<j;q++){const i=idx[q],o=i*16,w=q*16;for(let e=0;e<16;e++)M[w+e]=src[o+e];if(K){K[q*3]=col[i*3];K[q*3+1]=col[i*3+1];K[q*3+2]=col[i*3+2];}
        one.center.set(C[i*4],C[i*4+1],C[i*4+2]);one.radius=C[i*4+3];sphere.union(one);}
      (mesh.boundingSphere??=new THREE.Sphere()).copy(sphere);
      mesh.instanceMatrix.clearUpdateRanges?.();mesh.instanceMatrix.addUpdateRange?.(0,j*16);mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor){mesh.instanceColor.clearUpdateRanges?.();mesh.instanceColor.addUpdateRange?.(0,j*3);mesh.instanceColor.needsUpdate=true;}}};}

// Posed figure parts in the statue frame (local +Z front, y up from the pedestal top, metres at sc = 1): 'cyl' (robe/coat,
// radii r0 bottom / r1 top), 'box' (centre c, size s), 'sph' (centre c, radii r), 'seg' (a→b, radius r).
// repairs: every part overlaps the part that carries it by ≥ 1 cm; the
// orator's former zero-radius robe left a 10.7 cm gap between legs and torso — he now wears a frock coat from mid-thigh.
export const FIGURE_POSES=['stand','bautista','teacher','orator','cloak','bowed','child'];
export function figureParts(pose){const out=[],seg=(a,b,r)=>out.push({t:'seg',a,b,r}),cyl=(y0,y1,r0,r1)=>out.push({t:'cyl',y0,y1,r0,r1});
  if(pose==='orator'){seg([-.11,0,0],[-.11,.85,0],.085);seg([.11,0,0],[.11,.85,0],.085);cyl(.55,1.02,.25,.21);}
  else if(pose==='child')cyl(0,.95,.26,.16);
  else cyl(0,pose==='cloak'?1.35:1.25,pose==='cloak'?.42:pose==='bautista'?.3:.34,.2);
  const sh=pose==='child'?.95:1.3;
  out.push({t:'box',c:[0,sh-.12,0],s:[.46,.5,.26]});
  const hd=pose==='bowed'?[0,sh+.22,.12]:[0,sh+.3,0];seg([0,sh+.1,0],hd,.06);
  out.push({t:'sph',c:hd,r:[.13,.16,.14]});out.push({t:'box',c:[hd[0],hd[1]-.01,hd[2]+.13],s:[.05,.07,.06]});
  const L=[-.25,sh-.05,0],R=[.25,sh-.05,0];
  if(pose==='bautista'){seg(R,[.38,sh-.3,.18],.065);seg([.38,sh-.3,.18],[.36,sh+.25,.28],.06);
    seg([.36,0,.3],[.36,sh+.85,.3],.03);seg([.2,sh+.62,.3],[.52,sh+.62,.3],.028);seg(L,[-.18,sh-.45,.22],.065);}
  else if(pose==='teacher'){seg(L,[-.12,sh-.4,.28],.06);seg(R,[.15,sh-.42,.28],.06);out.push({t:'box',c:[0,sh-.38,.33],s:[.36,.05,.26],paint:'#7a6448'});}
  else if(pose==='orator'){seg(R,[.42,sh+.2,.25],.06);seg([.42,sh+.2,.25],[.45,sh+.55,.35],.055);seg(L,[-.3,sh-.6,.05],.06);}
  else if(pose==='cloak'){seg(L,[.05,sh-.3,.25],.07);seg(R,[.3,sh-.65,.05],.07);}
  else if(pose==='bowed'){seg(L,[-.22,sh-.6,.2],.06);seg(R,[.22,sh-.6,.2],.06);}
  else if(pose==='child'){seg(L,[-.45,sh-.2,0],.05);seg(R,[.25,sh-.5,0],.05);}
  else{seg(L,[-.27,sh-.62,0],.06);seg(R,[.27,sh-.62,0],.06);}
  return out;}

export function buildEastcivic(n,ctx) {
  const {scene,own,mat,meshes,height}=ctx,stats={};
  const standard=mat({vertexColors:true,roughness:.85,metalness:0}),foliage=mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const box=ctx.box,cylinder=ctx.cylinder,sphere=ctx.sphere,cyl8=own(new THREE.CylinderGeometry(1,1,1,8)),cone4=own(new THREE.ConeGeometry(1,1,4));cone4.rotateY(Math.PI/4);
  // Perf (geometry budget): thin cylinders get 8 sides, balusters/pins 5 (open-ended: their ends are hidden), foliage
  // lobes and small knobs (urns, capital lobes, heads < 0.5 m) a 20-face icosahedron.
  const cyl5=own(new THREE.CylinderGeometry(1,1,1,5,1,true)),ico0=own(new THREE.IcosahedronGeometry(1,0));
  // Thin facade plates (panes, plaques, leaves, frames ≤ 6 cm deep): only the two broad faces of the unit box (4 triangles
  // instead of 12); their edges are under 6 cm and never read.
  const plate=own(new THREE.BufferGeometry());{const b=new THREE.BoxGeometry(1,1,1),gr=b.groups.filter(q=>q.materialIndex>=4),ix=b.index.array;
    plate.setAttribute('position',b.attributes.position);plate.setAttribute('normal',b.attributes.normal);plate.setIndex(gr.flatMap(q=>[...ix.slice(q.start,q.start+q.count)]));b.dispose();}
  void cyl5;
  // Draw budget: the whole district is one small set of submissions — every view that sees any of it sees
  // all of it (sectors did not cull the old-town views), so it keeps 7 meshes: casting boxes, non-casting boxes (incl.
  // square balusters), plates, thin non-casting cylinders, one icosahedron pool (crowns and knobs), one merged casting
  // batch (shapes, figures, large columns/spheres/cones) and one palm InstancedMesh.
  // Shadows only from large masses (≥ 3 m) and tree crowns; small/thin parts go to the non-casting pass.
  const CAST=3.0,CAST_LEAF=1.5;
  let palmTag=-1;  // palm index while baking a palm's far proxy, else −1
  // Assemblies (attachment rule): parts of one prop (lamp, bench, tree, monument, flag, lion, column,
  // urn) share an id; the compactor keeps every in-view pooled part of an assembly while any part of it is kept, and always
  // when a part of it lies in the never-trimmed merged batch — a carrier is never dropped under what it carries.
  let asm=-1,asmCount=0;const asmBatch=new Set(),newAsm=()=>(asm=asmCount++);
  const pools=new Map(),batches=new Map(),o=new THREE.Object3D(),m4=new THREE.Matrix4(),nm=new THREE.Matrix3(),col=new THREE.Color(),vv=new THREE.Vector3(),nn=new THREE.Vector3();
  // Same signature as the shared bake (so the street kit, statues and palms reuse their forms).
  function bake(g,x,y,z,sx,sy,sz,paint,ry=0,kind='solid',rz=0){
    const sxz=Math.max(sx,sz);
    if(g===box&&kind==='facade'&&sz<=.061&&rz===0)g=plate;
    if(g===cylinder&&sxz<.8)g=cyl8;if(g===cyl8&&sxz<.12){g=box;sx*=1.8;sz*=1.8;}if(g===sphere&&(kind==='leaf'||Math.max(sx,sy,sz)<.5))g=ico0;
    if(!g.boundingSphere)g.computeBoundingSphere();const bs=g.boundingSphere,size=2*bs.radius*Math.max(sx,sy,sz);
    if(kind==='solid'&&size<CAST)kind='facade';if(kind==='leaf'&&size<CAST_LEAF)kind='leafnc';
    o.position.set(x,y,z);o.rotation.set(0,ry,rz);o.scale.set(sx,sy,sz);o.updateMatrix();col.set(paint);
    const cast=kind==='solid'||kind==='leaf';
    const key=g===plate?'plate':g===box?(cast?'box-cast':'box'):g===cyl8&&!cast?'cyl8':g===ico0?'ico':null;
    if(key){let q=pools.get(key);if(!q)pools.set(key,q={g,kind:key==='box-cast'?'solid':'facade',t:[],c:[],pid:[]});q.t.push(...o.matrix.elements);q.c.push(col.r,col.g,col.b);q.pid.push(palmTag);(q.asm??=[]).push(asm);return;}
    if(asm>=0)asmBatch.add(asm);m4.copy(o.matrix);nm.getNormalMatrix(m4);const bk='batch';let b=batches.get(bk);if(!b)batches.set(bk,b={kind:'solid',p:[],n:[],c:[]});
    const P=g.attributes.position,N=g.attributes.normal,I=g.index;
    for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;vv.fromBufferAttribute(P,j).applyMatrix4(m4);nn.fromBufferAttribute(N,j).applyNormalMatrix(nm);
      b.p.push(vv.x,vv.y,vv.z);b.n.push(nn.x,nn.y,nn.z);b.c.push(col.r,col.g,col.b);}}
  const segment=(a,b,r,c,kind='solid')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-6)return;
    bake(cylinder,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,l,r,c,Math.hypot(dx,dz)>1e-9?Math.atan2(dz,-dx):0,kind,Math.acos(Math.max(-1,Math.min(1,dy/l))));};
  const kit=streetKit({bake,own,box,cylinder,sphere}),sculpture=createStatueBuilder({bake,own,box,sphere,segment});
  // Face frame: u along a→b, d along the outward normal n (puntilla convention).
  const frame=f=>{const ux=(f.b[0]-f.a[0])/f.length,uz=(f.b[1]-f.a[1])/f.length,ry=-Math.atan2(uz,ux),P=(u,d)=>[f.a[0]+ux*u+f.n[0]*d,f.a[1]+uz*u+f.n[1]*d];
    return {L:f.length,ux,uz,ry,P,g:u=>height(...P(Math.max(0,Math.min(f.length,u)),.3)),
      box:(u,y,d,w,h,dep,c,kind='facade')=>{if(Math.abs(d-dep/2)<.006){const k=backInset(c);dep+=k;d-=k/2;}const [x,z]=P(u,d);bake(box,x,y,z,w,h,dep,c,ry,kind);},
      cyl:(u,y,d,r,h,c,kind='solid')=>{const [x,z]=P(u,d);bake(cylinder,x,y,z,r,h,r,c,0,kind);}};};
  // wall-mounted trim boxes all had their back face on the wall plane; hidden inside
  // the building mass, but differently coloured backs shared one plane. Each colour's back now sits at its own depth inside
  // the wall (6 mm steps from 8 mm, one step per colour; same-colour backs may share a plane).
  const insetOf=new Map(),backInset=c=>{if(!insetOf.has(c))insetOf.set(c,.008+.006*insetOf.size);return insetOf.get(c);};
  // lowest drawn ground under a footprint, sampled on a 4×4 lattice plus corners.
  const footLow=(cx,cz,hw,hd,ry=0)=>{const c=Math.cos(ry),s=Math.sin(ry);let m=Infinity;
    for(let a=0;a<=4;a++)for(let b=0;b<=4;b++){const u=(a/2-1)*hw,v=(b/2-1)*hd;m=Math.min(m,height(cx+c*u+s*v,cz-s*u+c*v));}return m;};
  const gRange=(F,u0,u1)=>{let lo=Infinity,hi=-Infinity;for(let u=u0;u<=u1+1e-6;u+=Math.max(.3,(u1-u0)/5)){const g=F.g(u);lo=Math.min(lo,g);hi=Math.max(hi,g);}return [lo,hi];};
  const bar=(a,b,w,h,c,kind='solid')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-4)return;
    bake(box,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,l,h,w,c,Math.atan2(-dz,dx),kind,Math.asin(Math.max(-1,Math.min(1,dy/l))));};
  // Baluster run between plan points a→b on level top y (base y0): plinth, balusters every 0.42 m, rail, and square piers
  // at both ends and every ~3.6 m (an intentional balustrade, not rail pieces laid across the steps).
  const balusters=(a,b,y0,y,c=TRIM,base=MARBLE_SH,piers=true)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.2)return;
    // Plinth and rail stop 2 cm inside the end piers (their end faces were flush with the piers' outer faces).
    const e=piers?.02/L:0,A=[a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e],Bp=[b[0]-(b[0]-a[0])*e,b[1]-(b[1]-a[1])*e];
    bar([A[0],(y0+y-.75)/2,A[1]],[Bp[0],(y0+y-.75)/2,Bp[1]],.36,Math.max(.05,y-.75-y0),base);
    const ang=Math.atan2(-(b[1]-a[1]),b[0]-a[0]),np=piers?Math.max(1,Math.round(L/3.6)):0,pierAt=new Set();
    for(let k=0;k<=np&&piers;k++){const t=Math.min(L-.21,Math.max(.21,L*k/np)),p=[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L];pierAt.add(Math.round(t*10));
      bake(box,p[0],(y0-.03+y+.12)/2,p[1],.42,y+.12-y0+.03,.42,base,ang,'solid');bake(box,p[0],y+.16,p[1],.48,.1,.48,c,ang,'solid');}  // pier foot 3 cm below the plinth's
    for(let t=.25;t<L-.1;t+=.42){if(piers&&[...pierAt].some(q=>Math.abs(q/10-t)<.3))continue;const p=[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L];bake(cyl8,p[0],y-.43,p[1],.07,.62,.07,c,0,'facade');}
    bar([A[0],y-.08,A[1]],[Bp[0],y-.08,Bp[1]],.36,.16,c);};
  // Round-headed (or slightly horseshoe) arch panel, unit width, height 1.12 per unit; faces +Z.
  const archShape=new THREE.Shape();archShape.moveTo(-.5,0);archShape.lineTo(.5,0);archShape.lineTo(.5,.62);archShape.absarc(0,.62,.5,0,Math.PI,false);archShape.lineTo(-.5,0);
  const archG=own(new THREE.ShapeGeometry(archShape,6));
  const horseShape=new THREE.Shape();horseShape.moveTo(-.5,0);horseShape.lineTo(.5,0);horseShape.lineTo(.5,.62);horseShape.absarc(0,.62,.5,-.25,Math.PI+.25,false);horseShape.lineTo(-.5,0);
  const horseG=own(new THREE.ShapeGeometry(horseShape,6));
  const archOn=(Fr,f,u,y0,w,h,c,d,g=archG)=>{const [x,z]=Fr.P(u,d);const out=Math.abs(-Fr.uz-f.n[0])<1e-6&&Math.abs(Fr.ux-f.n[1])<1e-6;bake(g,x,y0,z,w,h/1.12,1,c,out?Fr.ry:Fr.ry+Math.PI,'facade');};
  // Recessed panelled door: surround, dark reveal, two leaves with raised panels, threshold step; arched fanlight if
  // `arch` (Mtmelendez photo: dark arched door heads behind the columns).
  const door=(Fr,f,u,y0,w,h,{arch=false,leaf=DOOR,trim=TRIM,step=true}={})=>{
    // every layer stands ≥ 1.5 cm proud of the one behind it — surround 0–.14,
    // dark reveal .144–.156, fanlight trim .165 and glass .18, leaves .16–.19, panels .195–.215, transom bar .185–.215.
    Fr.box(u,y0+h/2,.07,w+.7,h+.35,.14,trim);Fr.box(u,y0+h/2,.15,w,h,.012,'#1e1a15');
    const lh=arch?h-w/2:h;for(const sd of [-1,1]){const lu=u+sd*w/4;Fr.box(lu,y0+lh/2,.175,w/2-.06,lh-.04,.03,leaf);
      for(const t of [.2,.5,.8])Fr.box(lu,y0+lh*t,.205,w/2-.36,lh*.22,.02,'#5b4732');}
    if(arch){archOn(Fr,f,u,y0+lh-.6*w,w+.5,w*.62+.6*w+.25,trim,.165);archOn(Fr,f,u,y0+lh-.6*w,w,w*.62+.6*w,'#2b3036',.18);Fr.box(u,y0+lh,.2,w,.08,.03,trim);}
    if(step){let lo=Infinity;for(let k=0;k<=6;k++)for(const d of [0,.45,.9]){const uu=u-(w+.9)/2+(w+.9)*k/6;lo=Math.min(lo,height(...Fr.P(uu,d)));}
      lo=Math.min(lo,y0-.12)-.05;Fr.box(u,(lo+y0)/2,.45,w+.9,y0-lo,.9,'#d9d2c3','facade');}};
  // Posed figures: one frame (local +Z front), distinct silhouettes per pose; robe/coat, torso, neck, head
  // with brow and nose, arms as segments, attributes.
  const figure=(x,y,z,heading,sc,pose,paint)=>{const F_=statueFrame(x,y,z,heading,sc),P=(u,v,d)=>F_.point(u,v,d);
    for(const q of figureParts(pose)){const c=q.paint??paint;
      if(q.t==='seg')segment(P(...q.a),P(...q.b),q.r*sc,c);
      else if(q.t==='cyl'){const g=new THREE.CylinderGeometry(q.r1,q.r0,q.y1-q.y0,10);bake(g,...P(0,(q.y0+q.y1)/2,0),sc,sc,sc,c,heading,'solid');g.dispose();}
      else if(q.t==='box'){const g=new THREE.BoxGeometry(...q.s);bake(g,...P(...q.c),sc,sc,sc,c,heading,'solid');g.dispose();}
      else bake(sphere,...P(...q.c),q.r[0]*sc,q.r[1]*sc,q.r[2]*sc,c,heading,'solid');}};

  // ======================= El Capitolio =======================
  {const F=n.frame,{CAP}=n.constants,R=CAP.R,ry=-Math.atan2(F.e[1],F.e[0]);
    const cbox=(u,y,v,wu,h,wv,c,kind='solid')=>{const [x,z]=F.W(u,v);bake(box,x,y,z,wu,h,wv,c,ry,kind);};
    let windows=0,urns=0;
    // Facades of the shell (portico recess faces get doors instead of windows).
    for(const f of faceList(n.capOuter)){const Fr=frame(f),Lf=Fr.L,[uA,vA]=F.UV(...f.a),[uB,vB]=F.UV(...f.b);
      const recess=(Math.abs(vA-vB)<.3&&(Math.abs(vA-CAP.south.door)<.3||Math.abs(vA-CAP.north.door)<.3)&&Math.min(uA,uB)>=CAP.south.u0-1&&Math.max(uA,uB)<=CAP.south.u1+1);
      const recessSide=!recess&&Math.abs(uA-uB)<.3&&Math.min(vA,vB)>=CAP.south.door-.3&&Math.max(vA,vB)<=CAP.south.wingW+.7&&Math.abs(Math.abs(uA)-15)<1.2;
      const [glo,ghi]=gRange(Fr,0,Lf),pn=13.6;
      // Rusticated base to the main-floor line, frieze and the heavy cornice; balustrade on the roof edge.
      Fr.box(Lf/2,(glo-.3+pn)/2,.05,Lf+.1,pn-glo+.3,.1,MARBLE_SH);Fr.box(Lf/2,pn+.12,.1,Lf+.2,.24,.2,TRIM);
      // no frieze on the recessed faces (the portico attic covers them and was flush with
      // it); the cornice top stands 2 cm over the roof plane it crosses at concave corners.
      if(!recess&&!recessSide)Fr.box(Lf/2,R-1.05,.04,Lf,.7,.08,'#e3ddd0');Fr.box(Lf/2,R-.29,.22,Lf+.5,.62,.5,TRIM,'solid');
      if(!recess){const [x0,z0]=Fr.P(0,-.15),[x1,z1]=Fr.P(Lf,-.15);balusters([x0,z0],[x1,z1],R,R+1.05);}
      if(recess){// Closed bronze doors behind the columns (survey: closed dark doors), in tall white frames.
        for(const t of [-.28,0,.28]){const u=Lf/2+t*Lf;door(Fr,f,u,CAP.stylobate,2.6,6.0,{arch:true,leaf:'#4b3a26',step:false});}
        for(let u=2;u<Lf-1.5;u+=3.6){if([-.28,0,.28].some(t=>Math.abs(u-(Lf/2+t*Lf))<2.2))continue;Fr.box(u,CAP.stylobate+7.5,.05,1.3,2.6,.08,GLASS);}continue;}
      if(recessSide||Lf<2.5)continue;
      // Giant-order pilasters and two window storeys per bay (main floor tall with a cap; upper square); small basement
      // windows where the base storey is tall enough (the wings toward Constitución).
      const bays=Math.max(1,Math.round(Lf/3.7)),bw=Lf/bays;
      for(let k=0;k<=bays;k++)Fr.box(Math.max(.25,Math.min(Lf-.25,k*bw)),(pn+R-1.4)/2,.09,.5,R-1.4-pn,.14,TRIM);
      for(let k=0;k<bays;k++){const u=(k+.5)*bw;if(bw<1.9)continue;
        // lower contrast (grey-blue glass), a mullion, transom and sill on every opening.
        const WG='#4f5960';Fr.box(u,17.0,.06,1.75,5.0,.1,TRIM);Fr.box(u,17.0,.1,1.35,4.6,.06,WG);Fr.box(u,17.0,.14,.08,4.6,.03,TRIM);Fr.box(u,18.3,.14,1.35,.08,.03,TRIM);
        Fr.box(u,14.45,.16,1.95,.12,.26,TRIM);Fr.box(u,19.75,.14,2.1,.22,.22,TRIM);
        Fr.box(u,22.4,.06,1.55,2.8,.1,TRIM);Fr.box(u,22.4,.1,1.15,2.4,.06,WG);Fr.box(u,22.4,.14,.07,2.4,.03,TRIM);Fr.box(u,20.95,.15,1.7,.1,.2,TRIM);windows+=2;
        const [,hi]=gRange(Fr,u-.8,u+.8);if(pn-hi>2.6){Fr.box(u,(hi+1.0+pn-.6)/2,.1,1.0,pn-.6-hi-1.0,.06,WG);windows++;}}}
    // Urns on the roof-edge corners.
    for(const p of n.capOuter){newAsm();bake(cyl8,p[0],R+1.25,p[1],.22,.35,.22,TRIM,0,'solid');bake(sphere,p[0],R+1.6,p[1],.3,.38,.3,TRIM,0,'solid');urns++;}
  asm=-1;
    // Porticos: stylobate, closed flights' treads already belong to the flights; columns with bases and simplified Corinthian
    // capitals, entablature, attic and roof over the portico, balustrade above.
    for(const p of n.porticos){const sg=p.side==='south'?1:-1,uc=(p.u0+p.u1)/2,wu=p.u1-p.u0;
      // Open flights round: the portico floor is ridden, so its drawn top is the support (y = stylobate exactly); the cap
      // (and the terrace/deck slab it is part of) is drawn with the flights below; the body stops 5 cm inside the cap.
      cbox(uc,(p.lo+CAP.stylobate-.05)/2,(p.va+p.vb)/2,wu-.04,CAP.stylobate-.05-p.lo,Math.abs(p.va-p.vb)-.04,MARBLE_SH);
      for(const c of p.cols){newAsm();const y0=CAP.stylobate,h=CAP.colTop-y0;bake(box,c.x,y0+.18,c.z,1.45,.36,1.45,TRIM,ry,'solid');bake(cylinder,c.x,y0+.48,c.z,.7,.26,.7,TRIM,0,'solid');
        bake(cylinder,c.x,y0+.6+(h-1.75)/2,c.z,.55,h-1.75,.55,MARBLE,0,'solid');bake(cylinder,c.x,CAP.colTop-.7,c.z,.66,.95,.62,'#efe9dd',0,'solid');
        bake(sphere,c.x,CAP.colTop-.95,c.z,.74,.4,.74,'#e6dfd1',0,'solid');bake(box,c.x,CAP.colTop-.13,c.z,1.6,.26,1.6,TRIM,ry,'solid');
        bake(cylinder,c.x,CAP.colTop-1.2,c.z,.6,.14,.6,TRIM,0,'solid');for(let k=0;k<8;k++){const a=k*Math.PI/4;bake(sphere,c.x+Math.sin(a)*.62,CAP.colTop-.62,c.z+Math.cos(a)*.62,.16,.22,.16,'#efe9dd',0,'solid');}}
  asm=-1;
      const front=p.vc+sg*.95,back=p.vb,depth=Math.abs(front-back),vm=(front+back)/2;
      cbox(uc,CAP.colTop+.35,vm,wu+.3,.7,depth,TRIM);cbox(uc,(CAP.colTop+.7+CAP.entTop)/2,vm,wu+.3,CAP.entTop-CAP.colTop-.7,depth,MARBLE);
      // Soffit (doc limit "frieze reads tan in shade"): a downward face is lit only by the hemisphere's
      // brown ground colour, so the marble ceiling read as a brown band between the capitals. A cool-tinted ceiling plate
      // 5 cm below it cancels the cast and reads as neutral shade (no lighting change).
      cbox(uc,CAP.colTop-.03,vm,wu+.2,.04,depth-.1,'#b4c4ff','facade');
      cbox(uc,CAP.entTop+.22,vm+sg*.25,wu+1.0,.44,depth+.5,TRIM);
      for(let k=0;k<Math.floor((wu+.8)/.45);k++){const u=p.u0-.4+.225+k*.45;cbox(u,CAP.entTop-.06,front+sg*.42,.22,.16,.16,TRIM,'facade');}cbox(uc,(CAP.entTop+.44+R-.6)/2,vm-sg*.2,wu,R-.6-CAP.entTop-.44,depth-.4,MARBLE);  // attic ends under the portico cornice (was flush with its top)
      cbox(uc,R-.29,vm+sg*.05,wu+.6,.62,depth+.1,TRIM);
      {const a=F.W(p.u0,front-sg*.15),b=F.W(p.u1,front-sg*.15);balusters(a,b,R,R+1.05);}
      // (The north portico's open sides carry layout balustrades with colliders since the open flights round.)
      // Attic inscription panel (dark band, no legible text).
      cbox(uc,(CAP.entTop+R)/2+.2,front+sg*.02,wu*.5,1.0,.06,'#cfc7b6','facade');}
  asm=-1;
    // Raised central block, drum, low ribbed dome and lantern.
    {const d=n.dome,[cx,cz]=d.centre,yA=R+d.attic,yD=yA+d.drum;
      cbox(CAP.uc,(R+yA)/2,(CAP.south.door+CAP.north.door)/2,CAP.south.u1-CAP.south.u0-.4,d.attic,CAP.south.door-CAP.north.door-.4,MARBLE);
      cbox(CAP.uc,yA-.17,(CAP.south.door+CAP.north.door)/2,CAP.south.u1-CAP.south.u0+.2,.4,CAP.south.door-CAP.north.door+.2,TRIM);  // 3 cm over the block top (was flush, 358 m²)
      bake(cylinder,cx,yA+.3,cz,d.r+.8,.6,d.r+.8,MARBLE_SH,0,'solid');
      const drumG=own(new THREE.CylinderGeometry(d.r,d.r,d.drum,32,1,true));bake(drumG,cx,(yA+yD)/2+.3,cz,1,1,1,MARBLE,0,'solid');
      bake(cylinder,cx,yA+.4+(d.drum)/2,cz,d.r-.4,d.drum,d.r-.4,'#c9c2b3',0,'solid');
      for(let k=0;k<24;k++){const a=k*Math.PI*2/24,x=cx+Math.sin(a)*(d.r+.12),z=cz+Math.cos(a)*(d.r+.12);
        bake(cylinder,x,(yA+yD)/2+.3,z,.3,d.drum-.6,.3,TRIM,0,'solid');
        if(k%3===1){const a2=a+Math.PI/24,x2=cx+Math.sin(a2)*(d.r+.03),z2=cz+Math.cos(a2)*(d.r+.03);bake(archG,x2,yA+1.0,z2,1.7,3.4/1.12,1,'#2f353b',a2,'facade');}}
      bake(cylinder,cx,yD+.55,cz,d.r+.55,.5,d.r+.55,TRIM,0,'solid');
      // Lathe: low elliptical cap (rise d.rise) with 32 facets; alternate meridians pushed out 1.5 % read as ribs.
      const prof=[];for(let k=0;k<=7;k++){const t=k/7;prof.push(new THREE.Vector2(Math.max(.01,(d.r+.15)*Math.cos(t*Math.PI/2)),yD+.8+d.rise*Math.sin(t*Math.PI/2)));}
      const lathe=new THREE.LatheGeometry(prof,32),lp=lathe.attributes.position;
      for(let i=0;i<lp.count;i++){const x=lp.getX(i),z=lp.getZ(i),a=Math.atan2(x,z),k=Math.round(a/(Math.PI*2/32));if(k%2===0){lp.setX(i,x*1.015);lp.setZ(i,z*1.015);}}
      lathe.computeVertexNormals();bake(lathe,cx,0,cz,1,1,1,'#e9e4d8',0,'solid');lathe.dispose();
      const top=yD+.8+d.rise;
      bake(cylinder,cx,top+d.lantern/2-.2,cz,2.0,d.lantern,2.0,MARBLE,0,'solid');
      for(let k=0;k<8;k++){const a=k*Math.PI/4;bake(cylinder,cx+Math.sin(a)*2.05,top+d.lantern/2-.2,cz+Math.cos(a)*2.05,.16,d.lantern-.3,.16,TRIM,0,'solid');
        const a2=a+Math.PI/8;bake(archG,cx+Math.sin(a2)*2.02,top+.1,cz+Math.cos(a2)*2.02,.7,(d.lantern-.7)/1.12,1,'#2f353b',a2,'facade');}
      bake(cylinder,cx,top+d.lantern-.1,cz,2.3,.35,2.3,TRIM,0,'solid');bake(sphere,cx,top+d.lantern+.1,cz,1.9,1.1,1.9,'#e9e4d8',0,'solid');
      bake(cylinder,cx,top+d.lantern+1.25,cz,.12,.9,.12,'#c9b98a',0,'solid');bake(sphere,cx,top+d.lantern+1.8,cz,.22,.22,.22,'#c9b98a',0,'solid');
      stats.domeTop=+(top+d.lantern+2).toFixed(2);}
    stats.capitolWindows=windows;stats.urns=urns;}

  // ======================= Open flights, aprons, bridge and terraces, balustrades =======================
  {const F=n.frame,ry=-Math.atan2(F.e[1],F.e[0]),{CAP}=n.constants,T=CAP.stylobate;
    const boxUV=(u0,u1,v0,v1,y0,y1,c,kind='solid')=>{const [x,z]=F.W((u0+u1)/2,(v0+v1)/2);bake(box,x,(y0+y1)/2,z,u1-u0,y1-y0,Math.abs(v1-v0),c,ry,kind);};
    // Triangle soup → one baked geometry (normals up for ground pieces).
    const soup=(tris,c,up=true)=>{if(!tris.length)return;const pos=new Float32Array(tris.length*9);let k=0;
      for(const t of tris){let [a,b,cc]=t;const nx=(b[1]-a[1])*(cc[2]-a[2])-(b[2]-a[2])*(cc[1]-a[1]),ny=(b[2]-a[2])*(cc[0]-a[0])-(b[0]-a[0])*(cc[2]-a[2]);void nx;
        if(up&&ny<0)[b,cc]=[cc,b];for(const q of [a,b,cc]){pos[k++]=q[0];pos[k++]=q[1];pos[k++]=q[2];}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,c,0,'solid');g.dispose();};
    // Slab with a flat top at y over a plan polygon made of rectangles (Capitol frame), sides along its outline only.
    const inRects=(rects,u,v)=>rects.some(([u0,u1,v0,v1])=>u>u0&&u<u1&&v>Math.min(v0,v1)&&v<Math.max(v0,v1));
    const slab=(rects,outline,y,depth,c)=>{const tris=[];for(const [u0,u1,v0,v1] of rects){const q=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>{const [x,z]=F.W(u,v);return [x,y,z];});tris.push([q[0],q[1],q[2]],[q[0],q[2],q[3]]);}
      soup(tris,c);const pos=[];
      for(let i=0;i<outline.length;i++){const [ua,va]=outline[i],[ub,vb]=outline[(i+1)%outline.length],L=Math.hypot(ub-ua,vb-va);if(L<1e-6)continue;
        // Outward (plan, Capitol frame): the side of the edge that is not inside the slab.
        let nu=-(vb-va)/L,nv=(ub-ua)/L;if(inRects(rects,(ua+ub)/2+nu*.05,(va+vb)/2+nv*.05)){nu=-nu;nv=-nv;}
        const [xa,za]=F.W(ua,va),[xb,zb]=F.W(ub,vb),[xo,zo]=F.W(nu,nv),[x0,z0]=F.W(0,0),out=[xo-x0,zo-z0];
        let A=[xa,y,za],Bq=[xb,y,zb],C=[xb,y-depth,zb],D=[xa,y-depth,za];
        const nx=(Bq[1]-A[1])*(C[2]-A[2])-(Bq[2]-A[2])*(C[1]-A[1]),nz=(Bq[0]-A[0])*(C[1]-A[1])-(Bq[1]-A[1])*(C[0]-A[0]);
        if(nx*out[0]+nz*out[1]<0){[A,Bq]=[Bq,A];[C,D]=[D,C];}
        for(const q of [A,Bq,C,A,C,D])pos.push(...q);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,c,0,'solid');g.dispose();};
    const apron=[],sandApron=[];
    for(const f of n.flights){const uc=(f.u0+f.u1)/2,wu=f.u1-f.u0,FW=f.frame?.W??F.W,FUV=f.frame?.UV??F.UV,fry=f.frame?.ry??ry;
      f.treads.forEach((t,k)=>{const last=k===f.treads.length-1,len=Math.abs(t.v1-t.v0)+(last?0:.02),vm=(t.v0+t.v1)/2+(last?0:f.dir*.01),[x,z]=FW(uc,vm),lo=t.lo-(k%2)*.02;
        bake(box,x,(lo+t.top)/2,z,wu-(k%2)*.02,t.top-lo,len,TREAD[k%2],fry,'solid');
        // Nosing bar (js/sj-stairs.js STAIR_NOSING): 2.5 cm proud of the riser, top 1.2 cm over the tread; none on the top riser.
        if(t.nosing){const N_=f.nosing,[xn,zn]=FW(uc,t.v0-f.dir*(N_.out-N_.depth/2));bake(box,xn,t.top+N_.up-.015,zn,wu+.01,.03,N_.depth,'#c9c1b1',fry,'facade');}});
      (f.name==='beach-b'?sandApron:apron).push(...f.aprons);   // the beach foot's fitted apron is sand
      const urned=new Set();
      for(const c of f.cheeks){const xs=c.ring.map(p=>p[0]),zs=c.ring.map(p=>p[1]),[cu,cv]=FUV(xs.reduce((a,b)=>a+b)/4,zs.reduce((a,b)=>a+b)/4);
        const us=c.ring.map(p=>FUV(...p)[0]),vs=c.ring.map(p=>FUV(...p)[1]),wu2=Math.max(...us)-Math.min(...us),wv=Math.max(...vs)-Math.min(...vs),[x,z]=FW(cu,cv);
        bake(box,x,(c.lo+c.top)/2,z,wu2,c.top-c.lo,wv,MARBLE_SH,fry,'solid');bake(box,x,c.top+.08,z,wu2+.16,.16,wv+.16,TRIM,fry,'solid');
        // One urn per side, on the foot piece (the newel pier holding the foot end).
        const side=cu<(f.u0+f.u1)/2?'w':'e',foot=Math.min(...vs)<=f.vf+1e-6&&Math.max(...vs)>=f.vf-1e-6;
        if(foot&&!urned.has(side)&&wu2<1){urned.add(side);newAsm();const [xe,ze]=FW(cu,f.vf+f.dir*.5);bake(cyl8,xe,c.top+.35,ze,.2,.4,.2,TRIM,0,'solid');bake(sphere,xe,c.top+.72,ze,.28,.34,.28,TRIM,0,'solid');asm=-1;}}}
    asm=-1;
    soup(apron,'#ddd6c7');soup(sandApron,'#8b8265');   // the bank's sandy ground as rendered at the foot (stairs4 foot-close: same mean colour)
    // South bridge and terrace: one slab (portico floor + terrace + deck) whose top is the support (y = stylobate), bodies
    // stopping inside it, walls 2 cm inside its edges (no shared faces), the slab's soffit over the service way.
    const B=n.bridge;if(B){const [U0,U1]=B.UC,[T0,T1]=B.TU,S_=CAP.south;
      const rects=[[T0,T1,S_.door,B.front[1]],[U0,U1,B.front[1],B.deck[0]]];
      slab(rects,[[T0,S_.door],[T1,S_.door],[T1,B.front[1]],[U1,B.front[1]],[U1,B.deck[0]],[U0,B.deck[0]],[U0,B.front[1]],[T0,B.front[1]]],T,.14,'#e8e2d5');
      boxUV(T0+.02,T1-.02,B.terrace[0],B.front[0],B.terraceLo,T-.05,MARBLE_SH);                     // terrace body
      boxUV(T0+.02,T1-.02,B.front[0],B.front[1]-.02,B.floorLow,T-.05,MARBLE_SH);                    // terrace front / tunnel north wall
      boxUV(U0+.02,U1-.02,B.front[1]-.2,B.abut[0]+.2,B.slabLo,T-.05,MARBLE_SH);                       // deck soffit body
      // Soffit plate (as the portico ceilings): a downward face is lit only by the hemisphere's brown ground colour; a cool
      // tint 2 cm under the slab reads as neutral shade in the tunnel.
      boxUV(U0+.1,U1-.1,B.front[1]+.05,B.abut[0]-.05,B.slabLo-.03,B.slabLo-.01,'#b4c4ff','facade');
      boxUV(U0-.7,U1+.7,B.abut[0]+.02,B.abut[1],B.floorLow,T-.05,MARBLE_SH);}                        // south abutment
    // North terrace either side of the north flight: body and cap at the stylobate (cap top = support).
    const NTr=n.northTerrace;if(NTr){const N_=CAP.north,[A0,A1]=NTr.NT;
      for(const [a,b] of [[A0,NTr.nu0],[NTr.nu1,A1]])boxUV(a+.02,b-.02,NTr.vf+.02,NTr.vt,NTr.lo,T-.05,MARBLE_SH);
      slab([[A0,NTr.nu0,NTr.vf,N_.door],[NTr.nu0,NTr.nu1,NTr.vt,N_.door],[NTr.nu1,A1,NTr.vf,N_.door]],
        [[A0,NTr.vf],[NTr.nu0,NTr.vf],[NTr.nu0,NTr.vt],[NTr.nu1,NTr.vt],[NTr.nu1,NTr.vf],[A1,NTr.vf],[A1,N_.door],[A0,N_.door]],T,.14,'#e8e2d5');}
    for(const b of n.balustrades){const top=Math.max(b.ga,b.gb)+b.h;balusters(b.a,b.b,b.lo,top);}
    stats.flights=n.flights.length;stats.balustrades=n.balustrades.length;}

  // ======================= Service-way retaining faces =======================
  if(n.service){for(const sd of n.service.sides)for(const w of sd.list){if(w.skip||w.rise<.04||!w.out)continue;const t=.4,[nx,nz]=w.out;
      const a=[w.a[0]+nx*t/2,w.a[1]+nz*t/2],b=[w.b[0]+nx*t/2,w.b[1]+nz*t/2],y0=w.lo,y1=w.top+.02;
      bar([a[0],(y0+y1)/2,a[1]],[b[0],(y0+y1)/2,b[1]],t,y1-y0,'#d2cab9');
      // Masonry reading: a coping on every face, piers every ~4 m and at the ends of each side.
      const k=sd.list.indexOf(w),endA=k===0||sd.list[k-1].rise<.04,endB=k===sd.list.length-1||sd.list[k+1].rise<.04,ang=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);
      if(w.parapet){bar([a[0],w.top+.5,a[1]],[b[0],w.top+.5,b[1]],t,1.0,MARBLE_SH);bar([a[0],w.top+1.04,a[1]],[b[0],w.top+1.04,b[1]],t+.12,.1,TRIM);}
      else bar([a[0],y1+.04,a[1]],[b[0],y1+.04,b[1]],t+.12,.08,TRIM);
      for(const [q,on] of [[a,endA||k%4===0],[b,endB]])if(on){const top=w.parapet?w.top+1.15:y1+.12;bake(box,q[0],(y0-.03+top)/2,q[1],.55,top-y0+.03,t+.18,'#c9c0ad',ang,'solid');}}}

  // ======================= Institutions =======================
  // Generic articulation: base band, string course, cornice, parapet, bays of framed openings per storey.
  const dress=(id,{storeys,bay=3.6,trim=TRIM,glass='#46525a',base,arch=false,parapet='plain',skip=()=>false,pair=false,arcade=null})=>{const s=n.buildings?.[id];void s;
    const b=n.shells[id];if(!b)return 0;let count=0;
    // A face on the east cut (both ends at x ≥ 1339) is internal: the world-edge continuation carries the building on.
    for(const f of faceList(b.outer)){if(f.length<2.5||skip(f)||f.a[0]>=1339&&f.b[0]>=1339)continue;const Fr=frame(f),Lf=Fr.L,[glo,ghi]=gRange(Fr,0,Lf),R=b.roof;
      Fr.box(Lf/2,(glo-.3+ghi+.7)/2,.05,Lf+.1,ghi+.7-glo+.3,.1,base??STYLE[id].wall);
      Fr.box(Lf/2,R-.27,.18,Lf+.36,.58,.36,trim,'solid');  // top 2 cm over the roof plane
      if(parapet==='balustrade'){const [x0,z0]=Fr.P(0,-.12),[x1,z1]=Fr.P(Lf,-.12);balusters([x0,z0],[x1,z1],R,R+.9,trim,STYLE[id].wall);}
      else if(parapet==='plain')Fr.box(Lf/2,R+.35,-.08,Lf,.7,.24,STYLE[id].wall,'solid');
      const H=R-(ghi+.7)-1.0,sh=H/storeys,bays=Math.max(1,Math.round(Lf/bay)),bw=Lf/bays;if(sh<2.2||bw<1.6)continue;
      for(let s2=1;s2<storeys;s2++)Fr.box(Lf/2,ghi+.7+sh*s2,.07,Lf,.16,.12,trim);
      for(let k=0;k<bays;k++){const u=(k+.5)*bw,[,hi]=gRange(Fr,u-.7,u+.7);
        for(let s2=0;s2<storeys;s2++){const f0=ghi+.7+sh*s2,top=f0+sh*.78,hgt=Math.min(sh*.56,2.7),y1=top,y0=Math.max(hi+.9,y1-hgt);if(y1-y0<1.1)continue;const w=Math.min(1.25,bw*.4);
          if(arcade&&s2===0&&arcade(f)){archOn(Fr,f,u,ghi+.7,Math.min(2.4,bw*.7),Math.min(sh-.3,3.4),trim,.05);archOn(Fr,f,u,ghi+.7,Math.min(2.4,bw*.7)-.4,Math.min(sh-.3,3.4)-.25,'#2c2a27',.08);count++;continue;}
          const parts=pair&&w>.9?[-.3,.3]:[0],pw=pair&&w>.9?w*.42:w;
          Fr.box(u,(y0+y1)/2,.05,w+.3,y1-y0+.3,.08,trim);
          for(const du of parts){Fr.box(u+du*w,(y0+y1)/2,.08,pw,y1-y0,.05,glass);Fr.box(u+du*w,(y0+y1)/2,.11,.06,y1-y0,.02,trim);Fr.box(u+du*w,y0+(y1-y0)*.7,.11,pw,.06,.02,trim);}
          Fr.box(u,y0-.08,.13,w+.45,.1,.24,trim);if(arch)Fr.box(u,y1+.12,.09,w*.55,.24,.1,trim);count++;}}}
    return count;};
  n.shells=Object.fromEntries(n.constants.OWNED.map(id=>[id,n.shellOf(id)]).filter(([,v])=>v));
  stats.openings=0;
  stats.openings+=dress(CAMARA_ID,{storeys:2,bay:2.2,parapet:'plain',glass:'#5a646b'});
  stats.openings+=dress(SENADO_ID,{storeys:2,bay:2.2,parapet:'plain',glass:'#5a646b'});
  // Annexes: one recessed, canopied entrance on the longest face.
  for(const id of [CAMARA_ID,SENADO_ID]){const b=n.shells[id];if(!b)continue;const f=faceList(b.outer).sort((a,c)=>c.length-a.length)[0],Fr=frame(f),u=Fr.L/2,[,hi]=gRange(Fr,u-2,u+2);
    Fr.box(u,(hi+hi+4.2)/2,.125,5.6,4.2,.1,'#d9d2c3');Fr.box(u,hi+1.6,.19,3.6,3.2,.03,'#3a4248');Fr.box(u,hi+3.6,.6,6.2,.22,1.2,TRIM,'solid');Fr.box(u,hi+4.0,.2,4.2,.5,.06,'#9c968a');}  // panel front .175, 2 cm proud of every window layer
  stats.openings+=dress(CARNEGIE_ID,{storeys:2,bay:3.4,parapet:'none',glass:'#55744c',pair:true});
  stats.openings+=dress(ATENEO_ID,{storeys:2,bay:2.8,arch:true,trim:'#e4ddcf',base:'#e2dccf',parapet:'none',skip:f=>f.n[1]>.9&&f.length>8});
  stats.openings+=dress(OLIMPICA_ID,{storeys:3,bay:3.2,arch:true,parapet:'balustrade',pair:true});
  stats.openings+=dress(ESPANA_ID,{storeys:2,bay:3.6,arch:true,glass:'#2d3c48',parapet:'plain'});
  stats.openings+=dress(TROPICAL_ID,{storeys:3,bay:3.4,arch:true,parapet:'none',base:'#d7c39d',arcade:f=>f.length>20&&(f.n[1]<-.8||f.n[0]<-.8)});
  // Fronts: Carnegie's columned centre on a three-tread podium; the Ateneo's entry stair (layout-owned treads, drawn as-is).
  for(const fr of n.fronts){const Fr=frame(fr.face),u=fr.mid;
    // the top pad at the doorway ground (support prism, top = drawn top); the flight is one of n.flights.
    if(fr.pad)Fr.box(u,(fr.pad.lo+fr.pad.top)/2,fr.dep/2,2*fr.half,fr.pad.top-fr.pad.lo,fr.dep,TREAD[0],'solid');
    if(fr.kind!=='portico')continue;const yb=fr.floor,yt=fr.top;
    for(const c of fr.cols){newAsm();bake(cylinder,c.x,yb+.15,c.z,.5,.3,.5,TRIM,0,'solid');bake(cylinder,c.x,(yb+.3+yt-.6)/2,c.z,.38,yt-.9-yb,.38,'#f1ece0',0,'solid');
      bake(cylinder,c.x,yt-.72,c.z,.46,.18,.46,TRIM,0,'solid');bake(box,c.x,yt-.45,c.z,.95,.3,.95,TRIM,Fr.ry,'solid');}
    asm=-1;Fr.box(u,yt+.3,1.4,2*fr.half+.4,.6,2.9,TRIM,'solid');Fr.box(u,yt+.95,1.3,2*fr.half,.7,2.6,'#f1ece0','solid');
    Fr.box(u,yt+1.4,1.45,2*fr.half+.6,.2,2.95,TRIM,'solid');Fr.box(u,yt-.02,1.4,2*fr.half,.04,2.7,'#cfc6b6','facade');  // ceiling plate 4 cm under the entablature (was flush)
    // Main entry: arched fanlight over a panelled door (Hughes photo).
    door(Fr,fr.face,u,yb,1.9,4.2,{arch:true,leaf:'#4a5a3e',step:false});}
  asm=-1;
  // Ateneo (P. Hughes photo): white walls, a continuous upper arcade of horseshoe-arched windows under a red tile eave
  // between two plain end blocks, a large framed tile panel round the arched entrance over its stair.
  {const b=n.shells[ATENEO_ID];if(b){const R=b.roof,f=faceList(b.outer).filter(q=>q.n[1]>.9&&q.length>8).sort((a,c)=>c.length-a.length)[0];
    if(f){const Fr=frame(f),L=Fr.L,[,hi0]=gRange(Fr,0,L),fr=n.fronts.find(q=>q.id===ATENEO_ID),hi=fr?fr.floor:hi0,mid=L/2,end=Math.min(3.6,L*.18);
      for(const u of [end/2,L-end/2])Fr.box(u,R+.8,-.2,end,1.6,1.2,'#f1eee6','solid');
      Fr.box(L/2,R-.27,.18,L+.36,.58,.36,'#e4ddcf','solid');Fr.box(L/2,(hi0-.3+hi0+.8)/2,.05,L+.1,1.1,.1,'#e2dccf');
      const yA=Math.max(hi+5.4,R-4.4),n7=Math.max(4,Math.round((L-2*end)/2.2)),aw=(L-2*end)/n7;
      for(let k=0;k<n7;k++){const u=end+(k+.5)*aw;archOn(Fr,f,u,yA-.1,aw-.2,3.3,'#e4ddcf',.05,horseG);archOn(Fr,f,u,yA,aw-.6,2.95,'#2b2f34',.09,horseG);Fr.box(u,yA-.15,.14,aw-.3,.12,.24,'#e4ddcf');}
      for(let k=0;k<=n7;k++)Fr.box(end+k*aw,yA+1.3,.12,.16,2.7,.16,'#efe9dd');
      for(const u of [end/2,L-end/2])for(const y of [hi0+1.4,yA+.3]){Fr.box(u,y+.8,.05,.95,1.6,.08,'#e4ddcf');Fr.box(u,y+.8,.08,.7,1.35,.05,'#3b444b');Fr.box(u,y-.05,.1,1.1,.1,.2,'#e4ddcf');}
      // Large tile frame (ochre/blue/white, Hughes) round the arched door.
      // (coplanar guard): frame front .12 and tiles .11–.13, 2–3 cm clear of the base band (.10) and the door surround (.14).
      Fr.box(mid,hi+2.9,.105,5.0,5.8,.03,'#b48a4a');for(let i=0;i<8;i++)for(let j=0;j<7;j++){if(i>1&&i<6&&j<5)continue;Fr.box(mid-2.2+i*.63,hi+.35+j*.78,.12,.56,.7,.02,(i+j)%2?'#c9a25a':'#3f5f86');}
      door(Fr,f,mid,hi,2.0,4.0,{arch:true,leaf:'#3c2f22',step:false});
      // Red tile eave over the centre (between the end blocks), with a dark soffit band below.
      const a0=Fr.P(end,1.0),b0=Fr.P(L-end,1.0),a1=Fr.P(end,-1.6),b1=Fr.P(L-end,-1.6),y0=R-.15,y1=R+1.0,pos=[];
      for(const t of [[[a0[0],y0,a0[1]],[b0[0],y0,b0[1]],[b1[0],y1,b1[1]]],[[a0[0],y0,a0[1]],[b1[0],y1,b1[1]],[a1[0],y1,a1[1]]]]){const e1=[t[1][0]-t[0][0],t[1][2]-t[0][2]],e2=[t[2][0]-t[0][0],t[2][2]-t[0][2]];
        pos.push(...((e1[1]*e2[0]-e1[0]*e2[1])>0?t:[t[0],t[2],t[1]]).flat());}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,'#b4553a',0,'solid');g.dispose();
      Fr.box(L/2,R-.3,.55,L-2*end,.2,1.0,'#6e5a48','solid');}}}
  // Casa de España: tiled caps on the two projecting south-corner pavilions, arched central entrance, iron balconies.
  {const b=n.shells[ESPANA_ID];if(b){const R=b.roof;
    for(const c of [[908.6,-87.2],[937.6,-88.8]]){bake(box,c[0],R+1.6,c[1],5.0,3.2,5.0,'#f0ebde',-.08,'solid');bake(box,c[0],R+3.25,c[1],5.4,.25,5.4,TRIM,-.08,'solid');
      // Open-looking upper tier (Klotz / Tichnor): paired dark arches each side under a projecting eave.
      for(const sd of [0,1,2,3]){const a=-.08+sd*Math.PI/2;for(const o of [-.9,.9]){const x=c[0]+Math.sin(a)*2.52+Math.cos(a)*o,z=c[1]+Math.cos(a)*2.52-Math.sin(a)*o;bake(archG,x,R+.55,z,1.2,2.2/1.12,1,'#24303a',a,'facade');}}
      bake(box,c[0],R+3.05,c[1],5.9,.18,5.9,'#d9d2c3',-.08,'solid');
      // Glazed-tile cap: blue pyramid with a white band and a gilt finial (I: pattern simplified to bands).
      bake(cone4,c[0],R+3.4+1.35,c[1],3.75,2.7,3.75,'#2f5f8f',-.08,'solid');bake(box,c[0],R+3.56,c[1],5.25,.28,5.25,'#f2f0ea',-.08,'solid');
      bake(cone4,c[0],R+3.4+2.45,c[1],1.7,.5,1.7,'#f2f0ea',-.08,'solid');bake(sphere,c[0],R+6.35,c[1],.2,.3,.2,'#c9b98a',0,'solid');
}
    const f=faceList(b.outer).filter(q=>q.n[1]>.9).sort((a,c)=>c.length-a.length)[0];
    if(f){const Fr=frame(f),u=Fr.L/2,[,hi]=gRange(Fr,u-2,u+2);
      // Big round-arched entrance: separate surround / voussoir / leaf planes (the old trim and door shared
      // an outer plane), blue-white tile voussoirs.
      archOn(Fr,f,u,hi,4.4,6.0,TRIM,.04);for(let k=0;k<7;k++){const a=Math.PI*(k+.5)/7;Fr.box(u+Math.cos(a)*1.9,hi+3.7+Math.sin(a)*1.9,.1,.5,.36,.05,k%2?'#2f5f8f':'#f2f0ea');}
      door(Fr,f,u,hi,2.8,5.0,{arch:true,leaf:'#3a2e22',trim:'#efeae0',step:false});
      // Ground-floor loggia: deep shadowed round arches either side of the entrance.
      for(const du of [-9,-6,6,9])if(Math.abs(du)<Fr.L/2-1.5){archOn(Fr,f,u+du,hi,2.4,3.6,TRIM,.05);archOn(Fr,f,u+du,hi,1.9,3.3,'#2a2724',.09);}
      for(const du of [-6,6]){const y=hi+6.2;Fr.box(u+du,y,.45,2.6,.12,.9,'#d9d3c6','solid');for(let t=-1.2;t<=1.21;t+=.3)Fr.box(u+du+t,y+.5,.85,.04,.9,.04,IRON);Fr.box(u+du,y+.95,.85,2.6,.05,.05,IRON);}}}}
  // Casa Olímpica: balconies on the main floor of the long south front (I), fanlight caps already from `arch`.
  {const b=n.shells[OLIMPICA_ID];if(b){for(const f of faceList(b.outer).filter(q=>q.n[1]>.9&&q.length>18)){const Fr=frame(f),bays=Math.round(Fr.L/3.2),bw=Fr.L/bays,[,ghi]=gRange(Fr,0,Fr.L);
    const y=ghi+.7+(b.roof-(ghi+.7)-1.0)/3;for(let k=1;k<bays-1;k+=2){const u=(k+.5)*bw;Fr.box(u,y,.4,1.9,.14,.8,'#d8cfbd','solid');
      for(let t=-.85;t<=.86;t+=.28)Fr.box(u+t,y+.5,.76,.035,.86,.035,IRON);Fr.box(u,y+.93,.76,1.9,.05,.05,IRON);}
    // Entrance: pilastered frame with a cornice slab over a panelled door; a darker band under the main cornice.
    if(f.i===faceList(b.outer).filter(q=>q.n[1]>.9&&q.length>18).sort((p,q)=>q.length-p.length)[0].i){const u=Fr.L/2,[,hi]=gRange(Fr,u-2,u+2);for(const du of [-2.2,2.2]){const [lo]=gRange(Fr,u+du-.3,u+du+.3);Fr.box(u+du,(lo-.05+hi+5.2)/2,.15,.55,hi+5.2-lo+.05,.3,'#efe6d2');}Fr.box(u,hi+5.35,.3,5.4,.4,.6,'#efe6d2');
      archOn(Fr,f,u,hi,3.0,4.6,'#efe6d2',.06);door(Fr,f,u,hi,2.2,4.2,{arch:true,leaf:'#4a3a28',step:false});}
    Fr.box(Fr.L/2,b.roof-.7,.2,Fr.L,.2,.4,'#8f8068');}}}
  // Door sills: layout-owned solid blocks (drawn = physical), exactly the layout's numbers.
  for(const q of n.sills??[]){const Fr=frame(q.face);Fr.box(q.u,(q.lo+q.y0)/2,.45,q.w+.9,q.y0-q.lo,.9,'#d9d2c3','facade');}
  // Beach stair: the turn pad (level slab, sides in the walls' stone), the side guards (low stone cheek with a
  // coping, slim iron handrail on posts), the open gate (piers, wall stubs, leaves swung back flat against the stubs). The
  // flights themselves are drawn with n.flights.
  {const BS=n.beachStair;if(BS){const STONE='#d8d0bf',COPE='#e9e3d6';
    // Triangles with their normals turned to `want` (a direction), one baked mesh.
    const mesh=(tris,c)=>{const pos=[];for(const [A,B,C,want] of tris){const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
        const nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0];pos.push(...(nx*want[0]+ny*want[1]+nz*want[2]>=0?[A,B,C]:[A,C,B]).flat());}
      if(!pos.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,c,0,'solid');g.dispose();};
    const quad=(T,a,b,c,d,want)=>{T.push([a,b,c,want],[a,c,d,want]);};
    for(const p of BS.pads){const ring=p.ring,y=p.y;let lo=Infinity;for(const q of ring)lo=Math.min(lo,height(...q));lo-=.3;
      const cx=ring.reduce((s_,q)=>s_+q[0],0)/ring.length,cz=ring.reduce((s_,q)=>s_+q[1],0)/ring.length,T=[],S_=[];
      for(let i=1;i+1<ring.length;i++)T.push([[ring[0][0],y,ring[0][1]],[ring[i][0],y,ring[i][1]],[ring[i+1][0],y,ring[i+1][1]],[0,1,0]]);
      // Sides 3 cm inside the top's edge (coplanar guard: the side guards' outer faces stand on the pad edge).
      const ins=ring.map(q=>{const d=Math.hypot(q[0]-cx,q[1]-cz);return [q[0]-(q[0]-cx)/d*.03,q[1]-(q[1]-cz)/d*.03];});
      for(let i=0;i<ins.length;i++){const A=ins[i],B=ins[(i+1)%ins.length],o=[(A[0]+B[0])/2-cx,0,(A[1]+B[1])/2-cz];quad(S_,[A[0],y,A[1]],[B[0],y,B[1]],[B[0],lo,B[1]],[A[0],lo,A[1]],o);}
      mesh(T,TREAD[0]);mesh(S_,STONE);}
    const capAt=new Set(['a:0','b:end']);
    for(const G of BS.guards){const {W,uIn,uOut,S}=G,so=Math.sign(uOut-uIn),k=S.length-1,dv=Math.sign(S[k].v-S[0].v);
      // Profile mesh between u0 and u1 from `topOf` down to the sample's foot; end caps only where the run is free.
      const prof=(u0,u1,topOf,botOf,c,caps)=>{const T=[],P=(u,i,y)=>{const [x,z]=W(u,S[i].v);return [x,y,z];};
        const out=(u)=>{const [x0,z0]=W(0,S[0].v),[x1,z1]=W(u>0?1:-1,S[0].v);return [x1-x0,0,z1-z0];};
        for(let i=0;i<k;i++){const t0=topOf(S[i]),t1=topOf(S[i+1]),b0=botOf(S[i]),b1=botOf(S[i+1]);
          quad(T,P(u0,i,t0),P(u1,i,t0),P(u1,i+1,t1),P(u0,i+1,t1),[0,1,0]);
          for(const u of [u0,u1]){const o=out(u-(u0+u1)/2);quad(T,P(u,i,t0),P(u,i+1,t1),P(u,i+1,b1),P(u,i,b0),o);}}
        for(const [i,want] of caps){const [xa,za]=W(0,S[i].v),[xb,zb]=W(0,S[i].v-dv*(i===0?1:-1)),o=[xb-xa,0,zb-za];quad(T,P(u0,i,topOf(S[i])),P(u1,i,topOf(S[i])),P(u1,i,botOf(S[i])),P(u0,i,botOf(S[i])),o);void want;}
        mesh(T,c);};
      const caps=[capAt.has(G.name+':0')?[0]:null,capAt.has(G.name+':end')?[k]:null].filter(Boolean).map(i=>[i[0],0]);
      const a0=Math.min(uIn-so*.01,uOut),a1=Math.max(uIn-so*.01,uOut);   // inner face 1 cm into the treads (no shared plane)
      prof(a0,a1,q=>q.stone,q=>q.lo,STONE,caps);
      prof(Math.min(uIn,uOut)-.04,Math.max(uIn,uOut)+.04,q=>q.stone+.05,q=>q.stone-.04,COPE,caps);
      // Handrail: posts every ~1.2 m where the rail stands, a top rail and a mid rail between railed posts.
      const um=(uIn+uOut)/2,post=[];for(let i=0;i<=k;i+=2)if(S[i].rail!=null)post.push(i);if(post.at(-1)!==k&&S[k].rail!=null)post.push(k);
      newAsm();for(const i of post){const [x,z]=W(um,S[i].v);bar([x,S[i].stone,z],[x,S[i].rail+.02,z],.045,.045,IRON);}
      for(let j=0;j+1<post.length;j++){const i0=post[j],i1=post[j+1];if(i1-i0>2)continue;const [x0,z0]=W(um,S[i0].v),[x1,z1]=W(um,S[i1].v);
        bar([x0,S[i0].rail,z0],[x1,S[i1].rail,z1],.05,.05,IRON);bar([x0,(S[i0].rail+S[i0].stone)/2,z0],[x1,(S[i1].rail+S[i1].stone)/2,z1],.03,.03,IRON);}
      asm=-1;}
    const G=BS.gate,[gx,gz]=G.dir,ga=Math.atan2(-gz,gx);newAsm();
    for(const p of G.piers){bake(box,p[0],(height(...p)-.15+G.top)/2,p[1],.5,G.top-height(...p)+.15,.5,STONE,ga,'solid');bake(box,p[0],G.top+.055,p[1],.6,.17,.6,COPE,ga,'solid');}
    for(const q of G.stubs){const m=[(q.a[0]+q.b[0])/2,(q.a[1]+q.b[1])/2],L=Math.hypot(q.b[0]-q.a[0],q.b[1]-q.a[1]);bake(box,m[0],(q.lo+q.top)/2,m[1],L,q.top-q.lo,.4,STONE,ga,'solid');bake(box,m[0],q.top+.035,m[1],L+.1,.13,.5,COPE,ga,'solid');}   // coping sunk 3 cm (no shared plane with the wall's top)
    // Leaves: the earlier gate's grille (rails at +0.15 / +0.9 / +1.55, 1.5 m bars every 0.12 m), standing upright.
    for(const q of G.leaves){const la=Math.atan2(-(q.b[1]-q.a[1]),q.b[0]-q.a[0]),L=Math.hypot(q.b[0]-q.a[0],q.b[1]-q.a[1]),ux=(q.b[0]-q.a[0])/L,uz=(q.b[1]-q.a[1])/L;
      for(const y of [q.y0+.15,q.y0+.9,q.y0+1.55])bar([q.a[0],y,q.a[1]],[q.b[0],y,q.b[1]],.05,.05,IRON);
      bar([q.a[0],q.y0+.02,q.a[1]],[q.a[0],q.y0+1.6,q.a[1]],.06,.06,IRON);
      for(let t=.06;t<L-.03;t+=.12)bake(box,q.a[0]+ux*t,q.y0+.85,q.a[1]+uz*t,.025,1.5,.025,IRON,la,'facade');}
    asm=-1;}}
  // Tile eaves (hip slopes from an overhanging eave to a ridge `run` inside; the flat roof fills the rest).
  const eaves=(b,colour,{rise=3.0,run=3.6,ov=.75,keep=()=>true,soffit='#e8e2d6'}={})=>{const R=b.roof,tiles=[];
    for(const f of faceList(b.outer)){if(f.length<6||!keep(f))continue;const Fr=frame(f),inn=[-f.n[0],-f.n[1]],Lf=Fr.L,a0=Fr.P(-ov,ov),b0=Fr.P(Lf+ov,ov),r=Math.min(run,Lf/2);
      const a1=[a0[0]+inn[0]*(r+ov)+Fr.ux*(r+ov),a0[1]+inn[1]*(r+ov)+Fr.uz*(r+ov)],b1=[b0[0]+inn[0]*(r+ov)-Fr.ux*(r+ov),b0[1]+inn[1]*(r+ov)-Fr.uz*(r+ov)];
      tiles.push([[a0[0],R-.25,a0[1]],[b0[0],R-.25,b0[1]],[b1[0],R-.25+rise*r/run,b1[1]],[a1[0],R-.25+rise*r/run,a1[1]]]);Fr.box(Lf/2,R-.38,ov/2,Lf+2*ov,.26,ov,soffit,'solid');}
    const pos=[];for(const [a,b2,c,d] of tiles){const up=(q,p0,p1)=>{const e1=[p0[0]-q[0],p0[1]-q[1],p0[2]-q[2]],e2=[p1[0]-q[0],p1[1]-q[1],p1[2]-q[2]];return e1[2]*e2[0]-e1[0]*e2[2];};
      for(const t of [[a,b2,c],[a,c,d]])pos.push(...(up(...t)>0?t:[t[0],t[2],t[1]]).flat());}
    if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,colour,0,'solid');g.dispose();}
    return tiles.length;};
  {const b=n.shells[CARNEGIE_ID];if(b)stats.carnegieEaves=eaves(b,'#4e7262',{rise:2.8,run:4.0,ov:1.1,soffit:'#55625a'});}
  // Escuela de Medicina Tropical: red tile hip slopes from the cornice (Spanish revival) and a tiled tower on the corner
  // facing Muñoz Rivera and the west approach (I).
  {const b=n.shells[TROPICAL_ID];if(b){const R=b.roof,tiles=[],rise=3.0,run=3.6,ov=.75;
    for(const f of faceList(b.outer)){if(f.length<10)continue;const Fr=frame(f),inn=[-f.n[0],-f.n[1]],Lf=Fr.L,a0=Fr.P(-ov,ov),b0=Fr.P(Lf+ov,ov);
      const a1=[a0[0]+inn[0]*(run+ov)+Fr.ux*(run+ov),a0[1]+inn[1]*(run+ov)+Fr.uz*(run+ov)],b1=[b0[0]+inn[0]*(run+ov)-Fr.ux*(run+ov),b0[1]+inn[1]*(run+ov)-Fr.uz*(run+ov)];
      tiles.push([[a0[0],R-.25,a0[1]],[b0[0],R-.25,b0[1]],[b1[0],R-.25+rise,b1[1]],[a1[0],R-.25+rise,a1[1]]]);
      // Eave underside (soffit) so the overhang reads from the street.
      Fr.box(Lf/2,R-.32,ov/2,Lf+2*ov,.14,ov,'#d9c7a0','solid');}
    const pos=[];for(const [a,b2,c,d] of tiles){const up=(q,p0,p1)=>{const e1=[p0[0]-q[0],p0[1]-q[1],p0[2]-q[2]],e2=[p1[0]-q[0],p1[1]-q[1],p1[2]-q[2]];return e1[2]*e2[0]-e1[0]*e2[2];};
      for(const t of [[a,b2,c],[a,c,d]])pos.push(...(up(...t)>0?t:[t[0],t[2],t[1]]).flat());}
    if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,'#b85c3f',0,'solid');g.dispose();}
    // The north-west corner (facing Muñoz Rivera and the west approach); the tower stands just inside it.
    const c=b.outer.reduce((best,p)=>!best||p[0]+p[1]*.2<best[0]+best[1]*.2?p:best,null),t=[c[0]+4.2,c[1]+4.2];
    bake(box,t[0],R+2.6,t[1],6.0,5.2,6.0,'#e9d8b4',-1.49,'solid');bake(box,t[0],R+5.3,t[1],6.5,.3,6.5,TRIM,-1.49,'solid');
    bake(cone4,t[0],R+6.6,t[1],4.6,2.3,4.6,'#b85c3f',-1.49,'solid');
    for(const sd of [0,1,2,3]){const a=-1.49+sd*Math.PI/2;bake(archG,t[0]+Math.sin(a)*3.02,R+2.0,t[1]+Math.cos(a)*3.02,1.4,2.6/1.12,1,'#2c2a27',a,'facade');}
    // Carved-looking framed entry between projections on the long north face (I: Schrag postcard, simplified).
    {const f=faceList(b.outer).filter(q=>q.n[1]<-.8).sort((a,c)=>c.length-a.length)[0];if(f){const Fr=frame(f),u=Fr.L/2,[,hi]=gRange(Fr,u-3,u+3);
      for(const du of [-3.4,3.4]){const [lo]=gRange(Fr,u+du-.7,u+du+.7);Fr.box(u+du,(lo-.05+R-2)/2,.25,1.4,R-2-lo+.05,.5,'#e3cfa6');}Fr.box(u,hi+3.5,.06,5.2,7.0,.12,'#e3cfa6');  // front .12: clear of the base band (.1) and the arcade's dark arch plane at .08
      door(Fr,f,u,hi,2.4,4.6,{arch:true,leaf:'#4a3424',step:false});Fr.box(u,hi+5.6,.25,4.0,.5,.3,'#d6bf92');}}}}  // entry band back 10 cm off the wall (was on a string course's plane)

  // ======================= Bautista overlook =======================
  for(const p of n.parapet){const top=Math.max(p.ta,p.tb)+1.0,[nx,nz]=p.nl;
    bar([p.a[0],(p.lo+top-.12)/2,p.a[1]],[p.b[0],(p.lo+top-.12)/2,p.b[1]],.36,top-.12-p.lo,'#e6e0d4');
    bar([p.a[0],top-.06,p.a[1]],[p.b[0],top-.06,p.b[1]],.48,.12,TRIM);
    for(const q of [p.a,p.b])bake(box,q[0],(p.lo-.03+top+.1)/2,q[1],.55,top+.1-p.lo+.03,.55,'#ddd6c8',-Math.atan2(nz,-nx),'solid');void nx;}
  // Coat-of-arms field: muted inset plaques on the landward face either side of the statue (no legible arms, survey).
  {const st=n.monuments.find(m=>m.kind==='bautista');if(st){let k=0;for(const p of n.parapet){const mx=(p.a[0]+p.b[0])/2;if(Math.abs(mx-st.x)>16)continue;
    const L=Math.hypot(p.b[0]-p.a[0],p.b[1]-p.a[1]),ux=(p.b[0]-p.a[0])/L,uz=(p.b[1]-p.a[1])/L,top=Math.max(p.ta,p.tb)+1.0;
    for(let t=1.4;t<L-.8;t+=2.2){const x=p.a[0]+ux*t+p.nl[0]*.2,z=p.a[1]+uz*t+p.nl[1]*.2;bake(box,x,top-.5,z,.5,.5,.04,['#8a5a4e','#5e6b7c','#6e7a5e','#a39573'][k++%4],-Math.atan2(uz,ux),'facade');}}}}

  // ======================= Monuments =======================
  // Distinct silhouettes: posed bronzes on marble pedestals for named statues, restrained abstract stones for
  // unverified art, busts with neck and shoulders, the Policía stele with a dark inset tier, a bevelled Lod plaque and a
  // Recordación wall with a central stele.
  for(const m of n.monuments){newAsm();const c=Math.cos(m.heading),s=Math.sin(m.heading),P=(u,d)=>[m.x+c*u+s*d,m.z-s*u+c*d],{w,d}=m.spec;
    const ped=(c1,c2)=>{bake(box,m.x,(m.lo+m.top-.12)/2,m.z,w,m.top-.12-m.lo,d,c1,m.heading,'solid');bake(box,m.x,m.top-.06,m.z,w+.14,.12,d+.14,c2,m.heading,'solid');
      // a level pedestal on a grade-shaped stepped base (Plaza Colón foundation style) —
      // on a slope a wide footing step to mid-grade, then a narrower step to 3 cm over the highest ground, then the moulded
      // skirt fully above ground all round (it used to sink up to 71 cm into the uphill paving). Flat sites: step + skirt.
      const low=m.lo+.12,hi=m.g,yB=hi+.03;if(hi-low>.15){const yA=(low+hi)/2;bake(box,m.x,(m.lo+yA)/2,m.z,w+.1,yA-m.lo,d+.1,c1,m.heading,'solid');}
      bake(box,m.x,(m.lo+yB)/2,m.z,w+.04,yB-m.lo,d+.04,c1,m.heading,'solid');bake(box,m.x,yB+.075,m.z,w+.1,.15,d+.1,c2,m.heading,'solid');};
    if(m.kind==='statue'||m.kind==='bautista'){ped(m.kind==='bautista'?'#ece6da':'#ddd6c8',TRIM);figure(m.x,m.top,m.z,m.heading,m.spec.fig/1.75,m.pose??'stand',BRONZE);
      const pl=P(0,d/2+.01);bake(box,pl[0],(m.lo+m.top)/2+.2,pl[1],w*.55,.4,.02,'#8a7a5a',m.heading,'facade');}
    else if(m.kind==='stele'){bake(box,m.x,(m.lo+m.top)/2,m.z,w,m.top-m.lo,d,'#cfc9bd',m.heading,'solid');bake(box,m.x,m.top+.15,m.z,1.5,.3,.85,'#bdb7ab',m.heading,'solid');
      bake(box,m.x,m.top+.02+m.spec.fig/2,m.z,1.1,m.spec.fig-.04,.55,'#9a958c',m.heading,'solid');const pl=P(0,.28);
      bake(box,pl[0],m.top+1.9,pl[1],.8,1.9,.02,'#3b3f44',m.heading,'facade');{const pb=P(0,.305);bake(box,pb[0],m.top+2.55,pb[1],.5,.42,.03,BRONZE,m.heading,'facade');}
      bake(box,m.x,m.top+m.spec.fig+.12,m.z,1.3,.24,.7,'#cfc9bd',m.heading,'solid');}
    else if(m.kind==='abstract'){ped('#d6d0c4',TRIM);bake(box,m.x,m.top+.7,m.z,.85,1.4,.85,'#8f8a82',m.heading+.785,'solid');bake(box,m.x,m.top+1.75,m.z,.6,.7,.6,'#8f8a82',m.heading+.4,'solid');
      bake(sphere,m.x,m.top+2.25,m.z,.28,.28,.28,BRONZE,0,'solid');}
    else if(m.kind==='wall'){bake(box,m.x,(m.lo+m.top+m.spec.fig)/2,m.z,w,m.top+m.spec.fig-m.lo,d,GRANITE,m.heading,'solid');bake(box,m.x,m.top+m.spec.fig+.05,m.z,w+.1,.1,d+.1,'#b3aea4',m.heading,'solid');
      bake(box,m.x,(m.lo-.03+m.top+2.6)/2,m.z,1.2,m.top+2.6-m.lo+.03,.84,'#7d7a74',m.heading,'solid');bake(box,m.x,m.top+2.65,m.z,1.35,.12,.95,'#b3aea4',m.heading,'solid');
      for(const k of [-2.2,-1.3,1.3,2.2]){const pl=P(k,d/2+.02);bake(box,pl[0],m.top+.7,pl[1],.7,.5,.03,BRONZE,m.heading,'facade');}
      const pl=P(0,.42);bake(box,pl[0],m.top+1.7,pl[1],.6,.9,.03,BRONZE,m.heading,'facade');}
    else if(m.kind==='plaque'){bake(box,m.x,(m.lo+m.top+.65)/2,m.z,w,m.top+.65-m.lo,d,GRANITE,m.heading,'solid');
      bake(box,m.x,m.top+.74,m.z,w,.18,d*.85,'#7f7c76',m.heading,'solid',.12);const pl=P(0,d/2+.02);bake(box,pl[0],m.top+.45,pl[1],.6,.35,.03,BRONZE,m.heading,'facade');}
    else if(m.kind==='bust'){ped('#ddd6c8',TRIM);const t=m.top;bake(box,m.x,t+.14,m.z,.56,.28,.3,BRONZE,m.heading,'solid');bake(sphere,m.x,t+.3,m.z,.27,.13,.16,BRONZE,m.heading,'solid');
      bake(cylinder,m.x,t+.42,m.z,.06,.14,.06,BRONZE,0,'solid');bake(sphere,m.x,t+.58,m.z,.13,.16,.14,BRONZE,m.heading,'solid');const nz=P(0,.13);bake(box,nz[0],t+.57,nz[1],.04,.06,.05,BRONZE,m.heading,'solid');}}
  asm=-1;
  // Holocaust memorial: three figures of different height, posture and turn on a low dark bed; title panels with a pale
  // band (no fabricated text).
  {const H=n.holocaust,ys=[[1141,-65],[1147,-65],[1144,-63.3],[1144,-66.7],[1144,-65]].map(p=>height(...p)),lo=Math.min(...ys)-.05,hi=Math.max(...ys)+.08;bake(cylinder,1144,(lo+hi)/2,-65,3.0,hi-lo,1.7,'#56524c',0,'solid');
    newAsm();for(const f of H.figures)figure(f.x,f.y-.05,f.z,f.rot,f.h/1.75,f.pose,'#4e4136');
    for(const p of H.panels){const lo=footLow(p.x,p.z,.7,.06)-.05;bake(box,p.x,(lo+p.y+1.6)/2,p.z,1.4,p.y+1.6-lo,.12,'#4a4a48',0,'solid');bake(box,p.x,p.y+1.4,p.z+.075,1.2,.16,.01,'#cfc9bd',0,'facade');bake(box,p.x,p.y+.85,p.z+.075,1.1,.7,.01,'#5e5c58',0,'facade');}}
  asm=-1;
  // Lions on the Leones exedra (OECH: lions on the balustrade): crouched — body, haunches, front legs and paws, maned head,
  // projecting muzzle — facing out along the exedra ends.
  for(const l of n.exedra.lions){newAsm();bake(box,l.x,(l.lo+l.top-.1)/2,l.z,1.05,l.top-.1-l.lo,1.05,'#ddd6c8',0,'solid');  // top under the cap (was flush)bake(box,l.x,l.top-.05,l.z,1.15,.1,1.15,TRIM,0,'solid');
    const y=l.top,h=Math.atan2(l.x-1044,l.z+47),cc=Math.cos(h),ss=Math.sin(h),Q=(u,d)=>[l.x+cc*u+ss*d,l.z-ss*u+cc*d],LC='#ece6da';
    {const [x,z]=Q(0,-.12);bake(box,x,y+.28,z,.42,.38,.85,LC,h,'solid');}{const [x,z]=Q(0,-.42);bake(sphere,x,y+.3,z,.26,.28,.26,LC,h,'solid');}
    for(const sd of [-.15,.15]){const [x,z]=Q(sd,.25);bake(box,x,y+.2,z,.12,.4,.14,LC,h,'solid');const [x2,z2]=Q(sd,.36);bake(box,x2,y+.04,z2,.14,.08,.22,LC,h,'solid');}
    {const [x,z]=Q(0,.24);bake(sphere,x,y+.58,z,.3,.3,.26,'#e3dccd',h,'solid');}{const [x,z]=Q(0,.42);bake(sphere,x,y+.6,z,.17,.18,.17,LC,h,'solid');}
    {const [x,z]=Q(0,.56);bake(box,x,y+.55,z,.14,.12,.14,LC,h,'solid');}}
  asm=-1;
  // Flagpoles of Plaza de la Democracia (mapped) with the two flags flown at the Capitol (simplified, I).
  // the base reaches 5 cm under the lowest ground of its footprint; the cloth's hoist edge laps the
  // pole by 2 cm (it started 12.8 cm off the pole).
  n.flagpoles.forEach((f,i)=>{newAsm();const lo=footLow(f.x,f.z,.4,.4)-.05;bake(cylinder,f.x,(lo+f.y+.6)/2,f.z,.4,f.y+.6-lo,.4,'#ddd6c8',0,'solid');bake(cylinder,f.x,(lo+f.y+f.h)/2,f.z,.08,f.y+f.h-lo,.08,'#f2f2ee',0,'solid');
    bake(sphere,f.x,f.y+f.h+.12,f.z,.14,.14,.14,'#c9b98a',0,'solid');const y=f.y+f.h-1.1,x0=f.x+.1;
    const h0=f.x+.06;  // hoist edge, 2 cm inside the 8 cm pole
    for(let k=0;k<5;k++)bake(box,h0+1.2,y+.6-k*.3,f.z,2.4,.3,.03,k%2?'#f4f4f0':'#b8312f',0,'solid');
    if(i===0){const t=new THREE.BufferGeometry();t.setAttribute('position',new THREE.Float32BufferAttribute([h0,y+.75,f.z+.03,h0,y-.75,f.z+.03,h0+1.2,y,f.z+.03, h0,y+.75,f.z-.03,h0+1.2,y,f.z-.03,h0,y-.75,f.z-.03],3));t.computeVertexNormals();bake(t,0,0,0,1,1,1,'#2b4f8c',0,'solid');t.dispose();}
    else bake(box,h0+.475,y+.37,f.z,.95,.78,.06,'#2b3f73',0,'solid');void x0;});  // canton and triangle 1.5 cm proud of the stripes

  asm=-1;
  // ======================= Street furniture, trees and palms =======================
  for(const l of n.lamps){newAsm();kit.lamps([l]);}for(const b of n.benches){newAsm();kit.benches([b]);}
  n.trees.forEach(t=>{newAsm();kit.trees([t]);});asm=-1;
  // Palms: one shared tall-palm form (sj-palm.js) merged trunk+fronds, one InstancedMesh, varied by yaw and scale; no
  // shadow casting (thin trunks, open fronds), receive only.
  let palmMesh=null;const palmFeet=[];
  if(n.palms.length){const acc={p:[],n:[],c:[]},q=new THREE.Object3D(),M=new THREE.Matrix4(),NM=new THREE.Matrix3(),C=new THREE.Color(),V=new THREE.Vector3(),Nn=new THREE.Vector3();
    const collect=(g,x,y,z,sx,sy,sz,paint,ry=0,kind,rz=0)=>{q.position.set(x,y,z);q.rotation.set(0,ry,rz);q.scale.set(sx,sy,sz);q.updateMatrix();M.copy(q.matrix);NM.getNormalMatrix(M);C.set(paint);
      const P=g.attributes.position,N=g.attributes.normal,I=g.index;for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;V.fromBufferAttribute(P,j).applyMatrix4(M);Nn.fromBufferAttribute(N,j).applyNormalMatrix(NM);
        acc.p.push(V.x,V.y,V.z);acc.n.push(Nn.x,Nn.y,Nn.z);acc.c.push(C.r,C.g,C.b);}};
    tallPalm({x:0,y:0,z:0,height:9.0,lean:.2,leanDir:[1,0]},1,{bake:collect,sphere:ico0});
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(acc.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(acc.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(acc.c,3));g.computeBoundingSphere();
    const m=new THREE.InstancedMesh(g,foliage,n.palms.length);n.palms.forEach((p,i)=>{const sc=.82+((i*.618)%1)*.36;q.position.set(p.x,p.y-.15,p.z);q.rotation.set(0,p.yaw,0);q.scale.set(sc,sc,sc);q.updateMatrix();m.setMatrixAt(i,q.matrix);
      // Far proxy: a leaning trunk box and a drooping crown lobe (box and ico pools: no extra draw),
      // shown instead of this palm only while it is far (per palm, with hysteresis).
      palmTag=i;const c=Math.cos(p.yaw),s=Math.sin(p.yaw),L=(u,y)=>[p.x+c*u*sc,p.y-.15+y*sc,p.z-s*u*sc];
      {const [x,y,z]=L(.45,4.5);bake(box,x,y,z,.34*sc,9*sc,.34*sc,'#8b8069',p.yaw,'facade',-.1);}
      {const [x,y,z]=L(.9,8.6);bake(sphere,x,y,z,3.4*sc,1.15*sc,3.4*sc,'#4d7240',p.yaw,'leaf');}
      palmTag=-1;palmFeet.push(p.x,p.y+4.5*sc,p.z);});
    m.name='sj-plaza-eastcivic-palms';m.castShadow=false;m.receiveShadow=true;m.computeBoundingSphere();palmMesh=m;
  }

  // ---- Emit pools ----
  let verts=0;
  const leafy=k=>k==='leaf'||k==='leafnc',casts=k=>k==='solid'||k==='leaf';
  // Near/far submission: the pools span the whole district, so a frustum test per pool
  // submitted all 126k triangles from Calle San Francisco 900 m away. A small updater flagged isLOD (the sj-fabric.js
  // pattern; added before the pools so it runs first in each pass) compacts every pool to the instances that matter for
  // the current camera: parts that project to less than about a pixel of the drawing buffer drop out with distance, and the
  // non-casting pools also keep only instances inside the view frustum widened by 20° on each axis (everything within 30 m
  // always stays). Casting pools stay distance-only and keep everything within 110 m, so the 96 m sun box never loses a
  // caster. It recomputes only when the camera moves 4 m, turns 10° or changes lens, and uploads only when the kept set
  // changes. Same seven meshes; the instance arrays start full, so hashes/tools see every part.
  const cull=new THREE.Object3D();cull.name='sj-plaza-eastcivic-cull';cull.isLOD=true;cull.autoUpdate=true;scene.add(cull);meshes.push(cull);
  const compacted=[];
  for(const [key,q] of pools){const count=q.c.length/3,mesh=new THREE.InstancedMesh(q.g,leafy(q.kind)?foliage:standard,count);mesh.instanceMatrix.array.set(q.t);
    mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(q.c),3);mesh.castShadow=casts(q.kind);mesh.receiveShadow=true;mesh.computeBoundingSphere();
    mesh.name='sj-plaza-eastcivic-'+key.replaceAll('|','-');scene.add(mesh);meshes.push(mesh);verts+=count;
    if(q.asm.some(v=>v>=0))mesh.userData.asm=Int32Array.from(q.asm);  // assembly ids in source order (assembly metadata)
    compacted.push(compactEntry(mesh,!mesh.castShadow,q.pid.some(v=>v>=0)?{pid:Int16Array.from(q.pid),want:0}:null,q.asm.some(v=>v>=0)?Int32Array.from(q.asm):null));}
  if(palmMesh){scene.add(palmMesh);meshes.push(palmMesh);compacted.push(compactEntry(palmMesh,true,{pid:Int16Array.from(n.palms,(_,i)=>i),want:1}));}
  // Drawing-buffer height for the pixel cutoff: read before each main-canvas render (chained; no render target).
  const view={height:EASTCIVIC_LOD.bufferHeight},vb=new THREE.Vector2(),prevBefore=scene.onBeforeRender;
  scene.onBeforeRender=function(renderer,sc,cam,target){prevBefore?.apply(this,arguments);if(!target&&renderer?.getDrawingBufferSize){renderer.getDrawingBufferSize(vb);if(vb.y>0)view.height=vb.y;}};
  cull.update=compactor(compacted,Float32Array.from(palmFeet),view,asmCount,asmBatch);cull.userData.asmBatch=asmBatch;
  for(const [key,b] of batches){const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();const m=new THREE.Mesh(g,leafy(b.kind)?foliage:standard);m.castShadow=casts(b.kind);m.receiveShadow=true;
    m.name='sj-plaza-eastcivic-'+key.replaceAll('|','-');scene.add(m);meshes.push(m);}
  return {...stats,instances:verts,pools:pools.size,batches:batches.size,palms:n.palms.length,trees:n.trees.length,lamps:n.lamps.length,benches:n.benches.length,monuments:n.monuments.length};
}
