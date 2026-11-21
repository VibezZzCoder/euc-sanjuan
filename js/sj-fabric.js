/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// City fabric drawing — © 2026 VibezZzCoder, MIT. Draws exactly the parts placed by sj-fabric-layout.js.
// Cost model: three instanced kinds per 128 m cell — opening (surround + leaf in one instance, two-tone
// node material), balcony railing (alpha-tested) and back-less box — each with near / mid / far geometry tiers that a
// small isLOD updater swaps per cell from the camera distance (beyond the far limit the cell is hidden: plain masses).
// One shared 256² atlas (paired panelled/louvred leaves, alpha-tested railing). Nothing casts shadows.
import * as THREE from 'three/webgpu';
import {PART_STRIDE} from './sj-fabric-layout.js';
import {glowPanes} from './sj-glow.js';
// Tier limits (m, from the camera to a cell's bounding sphere): [near, mid, far]; beyond the last the cell is not drawn.
// Openings: near 20 triangles (surround, reveals, hood, sill, leaf), mid 8 (surround ring + leaf), far 2 (leaf only).
// Boxes: near 10 (no back), mid 4 (front + top), far 2 (front). Railings: near only. Fog starts at 500 m; at the phone's
// 633 px / 62° a 1.2 m opening at 150 m is ~5 px and a 0.26 m cornice at 180 m ~1 px.
// Boxes have a fourth tier to 400 m that keeps only the roof volumes (rooms, caps, tanks: sorted first in each cell and
// drawn through the instance count) with the mid geometry, so roofscapes seen from the forts keep their huts.
export const FABRIC_TIERS={frame:[60,110,150],box:[60,110,180,400],rail:[75]};
// railings dissolve (stable world-space stipple) between these fragment distances, so every railing is
// gone before its cell can switch off at 75 m from the cell's nearest point: no railing pop at any distance.
export const RAIL_FADE=[46,70];

// Unit opening (x ∈ [−.5,.5] along the wall, y ∈ [0,1] up, z outward from the wall plane at 0, not scaled): surround
// jambs and lintel with shaded inner reveals (the recess), a hood moulding and a sill (Wikimedia Commons curid=131971241, curid=151596781, curid=158245806), plus the leaf
// quad 4.5 cm proud of the wall. Vertex `color`: the surround's shade (reveals 0.5); the leaf's vertices carry 2 (a flag
// read by the material, which colours them from the instance's leaf tone and the atlas). Tiers: 'near' 20 triangles,
// 'mid' 8 (front ring + leaf), 'far' 2 (leaf).
export function openingGeometry(tier='near') {
  const p=[],n=[],col=[],uv=[],idx=[];let tone=1;
  const quad=(a,b,c,d,nn,uvs=[0,0,0,0,0,0,0,0])=>{const k=p.length/3;p.push(...a,...b,...c,...d);for(let i=0;i<4;i++){n.push(...nn);col.push(tone,tone,tone);}uv.push(...uvs);idx.push(k,k+1,k+2,k,k+2,k+3);};
  const J=.12,T=1.07,Z=.07,near=tier==='near';
  if(tier!=='far'){
    quad([-.5-J,0,Z],[-.5,0,Z],[-.5,T,Z],[-.5-J,T,Z],[0,0,1]);
    quad([.5,0,Z],[.5+J,0,Z],[.5+J,T,Z],[.5,T,Z],[0,0,1]);
    quad([-.5,1,Z],[.5,1,Z],[.5,T,Z],[-.5,T,Z],[0,0,1]);}
  if(near){tone=.5;
    quad([-.5,0,Z],[-.5,0,0],[-.5,1,0],[-.5,1,Z],[1,0,0]);
    quad([.5,0,0],[.5,0,Z],[.5,1,Z],[.5,1,0],[-1,0,0]);
    quad([-.5,1,0],[.5,1,0],[.5,1,Z],[-.5,1,Z],[0,-1,0]);tone=1;
    const hx=.5+J+.05,sx=.5+J-.02;
    quad([-hx,T,.12],[hx,T,.12],[hx,T+.05,.12],[-hx,T+.05,.12],[0,0,1]);
    quad([-sx,-.035,.12],[sx,-.035,.12],[sx,0,.12],[-sx,0,.12],[0,0,1]);quad([-sx,0,.12],[sx,0,.12],[sx,0,0],[-sx,0,0],[0,1,0]);}
  tone=2;const z=.045;quad([-.5,0,z],[.5,0,z],[.5,1,z],[-.5,1,z],[0,0,1],[.008,.004,.492,.004,.492,.996,.008,.996]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return g;
}
// Unit box without its back face (−z: against the wall, or the other half of a two-half box). Tiers: near 10 triangles
// (front, top, bottom, ends), mid 4 (front, top), far 2 (front).
export function boxGeometry(tier='near') {
  const keep=tier==='near'?[0,1,2,3,4]:tier==='mid'?[2,4]:[4];// BoxGeometry groups: +x, −x, +y, −y, +z, −z
  const g=new THREE.BoxGeometry(1,1,1),idx=g.index.array,out=[];
  for(const gi of keep){const gr=g.groups[gi];out.push(...idx.slice(gr.start,gr.start+gr.count));}
  g.setIndex(out);g.clearGroups();g.deleteAttribute('uv');return g;
}
// Balcony railing: front panel at the slab edge (z=1 × depth) and two returns to the wall; alpha-tested, double-sided.
function railGeometry() {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,1,.5,0,1,.5,1,1,-.5,1,1, -.5,0,0,-.5,0,1,-.5,1,1,-.5,1,0, .5,0,1,.5,0,0,.5,1,0,.5,1,1],3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1, -1,0,0,-1,0,0,-1,0,0,-1,0,0, 1,0,0,1,0,0,1,0,0,1,0,0],3));
  const s=[.508,.004,.62,.004,.62,.996,.508,.996];
  g.setAttribute('uv',new THREE.Float32BufferAttribute([.508,.004,.992,.004,.992,.996,.508,.996,...s,...s],2));
  g.setIndex([0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11]);return g;
}
// 256² atlas: left half, a pair of leaves (lower raised panels, upper louvres, centre meeting stile; Wikimedia Commons curid=151596781, curid=182287159, curid=158245806);
// right half, an iron railing (rails, balusters, a mid band of rings; Wikimedia Commons curid=131971241, curid=158245806), transparent between bars.
export function fabricAtlas(textures) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle='#e4e4e4';c.fillRect(0,0,128,256);
  for(const x0 of [4,66]){const w=58;
    c.fillStyle='#9a9a9a';c.fillRect(x0,4,w,248);c.fillStyle='#e8e8e8';c.fillRect(x0+5,9,w-10,238);
    // Louvres (upper two thirds).
    for(let y=14;y<160;y+=5){c.fillStyle='#f6f6f6';c.fillRect(x0+6,y,w-12,2);c.fillStyle='#8c8c8c';c.fillRect(x0+6,y+2,w-12,1);c.fillStyle='#bdbdbd';c.fillRect(x0+6,y+3,w-12,2);}
    c.fillStyle='#a0a0a0';c.fillRect(x0+5,162,w-10,6);
    // Raised lower panel.
    c.fillStyle='#d2d2d2';c.fillRect(x0+11,176,w-22,64);c.fillStyle='#f8f8f8';c.fillRect(x0+11,176,w-22,3);c.fillRect(x0+11,176,3,64);
    c.fillStyle='#8a8a8a';c.fillRect(x0+11,237,w-22,3);c.fillRect(x0+w-14,176,3,64);}
  c.fillStyle='#3a3a3a';c.fillRect(62,0,4,256);c.fillStyle='#555';c.fillRect(0,0,128,3);c.fillRect(0,253,128,3);c.fillRect(0,0,3,256);c.fillRect(125,0,3,256);
  c.clearRect(128,0,128,256);c.fillStyle='#d9d9d9';
  c.fillRect(128,0,128,14);c.fillStyle='#ffffff';c.fillRect(128,1,128,4);c.fillStyle='#d9d9d9';
  c.fillRect(128,228,128,12);c.fillRect(128,120,128,5);c.fillRect(128,150,128,5);
  for(let x=131;x<256;x+=12)c.fillRect(x,14,4,214);
  c.strokeStyle='#d9d9d9';c.lineWidth=3;for(let x=137;x<256;x+=12){c.beginPath();c.arc(x,137,5,0,Math.PI*2);c.stroke();}
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=4;textures.add(tx);return tx;
}

export function buildFabric(layout,{scene,mat,meshes,textures,own}) {
  const {parts,leafTones,boxRoof}=layout.fabric,atlas=fabricAtlas(textures),T=THREE.TSL;
  // Opening material: surround = instance `tone` × the vertex shade; leaf (vertex colour flag 2) = instance `leafTone`.rgb ×
  // mix(1, atlas, leafTone.a). Colours are linear; the atlas is sRGB-decoded on sampling (as the old map × instanceColor).
  const openMat=mat({roughness:.84,metalness:0});
  {const vc=T.attribute('color','vec3'),tone=T.attribute('tone','vec3'),lt=T.attribute('leafTone','vec4'),tex=T.texture(atlas,T.uv()).rgb;
    openMat.colorNode=T.select(vc.r.greaterThan(1.5),lt.rgb.mul(T.mix(T.vec3(1),tex,lt.w)),tone.mul(vc));}
  const plain=mat({roughness:.86,metalness:0});
  const railMat=mat({map:atlas,roughness:.6,metalness:.1,alphaTest:.5,side:THREE.DoubleSide});
  {const pw=T.positionWorld,q=T.floor(pw.mul(22)),n=T.fract(T.sin(T.dot(q,T.vec3(12.9898,78.233,37.719))).mul(43758.5453));
    const fade=T.float(1).sub(T.smoothstep(RAIL_FADE[0],RAIL_FADE[1],T.distance(pw,T.cameraPosition)));
    railMat.opacityNode=T.step(n,fade);}
  // Shared vertex sources (one GPU copy each); per-cell opening geometries reference them plus the cell's own instance
  // attributes. All tier geometries are owned by the cull updater (the plaza drops unreferenced own sources after baking).
  const tiers=['near','mid','far'],openSrc=Object.fromEntries(tiers.map(t=>[t,openingGeometry(t)]));
  const boxGeo=Object.fromEntries(tiers.map(t=>[t,boxGeometry(t)])),railGeo=railGeometry();
  const owned=[...Object.values(openSrc),...Object.values(boxGeo),railGeo];
  const culled=[],eye=new THREE.Vector3(),cull=new THREE.Object3D();cull.name='sj-fabric-cull';cull.isLOD=true;cull.autoUpdate=true;
  // Per pass: tier by distance to the cell's bounding sphere, then an exact world-AABB frustum test (a 128 m cell's sphere
  // reaches ~90 m behind a camera standing in it; the box does not).
  // orthographic passes (the sun's shadow map) are skipped — no fabric mesh casts, and the
  // main camera's state is what the shadow pass leaves untouched. Per perspective camera the tier/visibility result is
  // cached and only re-applied (no distance or box math) while the camera has moved < 1.5 m, turned < 0.5° and kept its
  // projection; the next full update happens as soon as it moves or turns more.
  const frustum=new THREE.Frustum(),pv=new THREE.Matrix4(),dir=new THREE.Vector3(),cache=new WeakMap();
  const apply=st=>{for(let i=0;i<culled.length;i++){const c=culled[i],t=st[i],on=t>=0;c.mesh.visible=on;
    if(on){if(c.mesh.geometry!==c.geos[t])c.mesh.geometry=c.geos[t];c.mesh.count=c.counts[t];}}};
  cull.stats={full:0,cached:0};
  cull.update=camera=>{if(camera.isOrthographicCamera)return;
    eye.setFromMatrixPosition(camera.matrixWorld);dir.set(0,0,-1).transformDirection(camera.matrixWorld);
    const pe=camera.projectionMatrix.elements;let k=cache.get(camera);
    if(k&&k.pos.distanceToSquared(eye)<2.25&&k.dir.dot(dir)>.99996&&k.p0===pe[0]&&k.p5===pe[5]){cull.stats.cached++;apply(k.st);return;}
    if(!k)cache.set(camera,k={pos:new THREE.Vector3(),dir:new THREE.Vector3(),st:new Int8Array(culled.length)});
    k.pos.copy(eye);k.dir.copy(dir);k.p0=pe[0];k.p5=pe[5];cull.stats.full++;
    frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem);
    for(let i=0;i<culled.length;i++){const c=culled[i],b=c.mesh.boundingSphere,d=eye.distanceTo(b.center)-b.radius,L=c.limits;let t=0;while(t<L.length&&d>=L[t])t++;
      k.st[i]=t<L.length&&c.counts[t]>0&&frustum.intersectsBox(c.box)?t:-1;}
    apply(k.st);};
  cull.dispose=()=>{for(const g of owned)g.dispose();};
  scene.add(cull);meshes.push(cull);
  // Instance matrix = T·R·Sh·S (Sh: local y += shear·x, for base-band pieces on the grade; determinant sx·sy·sz > 0).
  const m=new THREE.Matrix4(),r=new THREE.Matrix4(),S=PART_STRIDE;let instances=0,count=0;
  for(const kind of ['frame','rail','box']){const a=parts[kind],n=a.length/S,cells=new Map();
    for(let i=0;i<n;i++){const c=a[i*S];let l=cells.get(c);if(!l)cells.set(c,l=[]);l.push(i);}
    for(const [,cellList] of [...cells].sort((x,y)=>x[0]-y[0])){
      const list=kind==='box'?[...cellList.filter(i=>boxRoof[i]),...cellList.filter(i=>!boxRoof[i])]:cellList,nRoof=kind==='box'?list.filter(i=>boxRoof[i]).length:0,N=list.length,matrices=new Float32Array(N*16),colours=new Float32Array(N*3);
      let leaf=null;if(kind==='frame')leaf=new Float32Array(N*4);
      list.forEach((i,j)=>{const o=i*S,sx=a[o+5],sy=a[o+6],sz=a[o+7],k=a[o+11];
        m.set(sx,0,0,0, k*sx,sy,0,0, 0,0,sz,0, 0,0,0,1);m.premultiply(r.makeRotationY(a[o+4]));m.setPosition(a[o+1],a[o+2],a[o+3]);m.toArray(matrices,j*16);
        colours[j*3]=a[o+8];colours[j*3+1]=a[o+9];colours[j*3+2]=a[o+10];if(leaf)for(let q=0;q<4;q++)leaf[j*4+q]=leafTones[i*4+q];});
      let geos,material;
      if(kind==='frame'){const tone=new THREE.InstancedBufferAttribute(colours,3),lt=new THREE.InstancedBufferAttribute(leaf,4);
        geos=tiers.map(t=>{const src=openSrc[t],g=new THREE.BufferGeometry();for(const [name,at] of Object.entries(src.attributes))g.setAttribute(name,at);
          g.setIndex(src.index);g.setAttribute('tone',tone);g.setAttribute('leafTone',lt);owned.push(g);return g;});material=openMat;}
      else if(kind==='rail'){geos=[railGeo];material=railMat;}else{geos=[...tiers.map(t=>boxGeo[t]),boxGeo.mid];material=plain;}
      const counts=FABRIC_TIERS[kind].map((_,t)=>t<3?N:nRoof);
      const mesh=new THREE.InstancedMesh(geos[0],material,N);mesh.instanceMatrix=new THREE.InstancedBufferAttribute(matrices,16);
      if(kind!=='frame')mesh.instanceColor=new THREE.InstancedBufferAttribute(colours,3);
      mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();mesh.name='sj-fabric-'+(kind==='frame'?'open':kind);
      culled.push({mesh,geos,counts,limits:FABRIC_TIERS[kind],box:mesh.boundingBox});
      scene.add(mesh);meshes.push(mesh);instances+=N;count++;}}
  glowPanes(layout.fabric.glowPanes);   // glazing that may be lit at blue hour (sj-glow.js)
  return {...layout.fabric.stats,instances,meshes:count};
}
