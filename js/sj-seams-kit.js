/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Seams kit — © 2026 VibezZzCoder, MIT.
// Mesh-count-bounded dressing for gaps inside finished areas: the shared spatial bake pools split by 64 m cell and kind,
// so dressing spread over a new district would add a mesh per cell. These helpers keep one InstancedMesh per call:
//   boxInstances  — unit boxes with per-instance colour (bake-compatible transform: Ry(ry)·Rz(rz), then scale);
//   formInstances — one form (built once at the origin with a bake-compatible collect) instanced per {x,y,z,yaw,scale};
//   mergedMesh    — arbitrary triangles with vertex colours in one static mesh.
import * as THREE from 'three/webgpu';
import {streetKit} from './sj-street-kit.js';

// Perf (2026-11-18): optional `sector(x,z)` key — one InstancedMesh per key (spatial bins ≤ 512 m, tight bounds).
export function boxInstances(name,{scene,own,mat,meshes},{castShadow=true,sector=null}={}) {
  const o=new THREE.Object3D(),bins=new Map(),col=new THREE.Color();
  const box=(x,y,z,sx,sy,sz,paint,ry=0,rz=0)=>{if(!(sx>0&&sy>0&&sz>0))return;o.position.set(x,y,z);o.rotation.set(0,ry,rz);o.scale.set(sx,sy,sz);
    const k=sector?sector(x,z):'';let b=bins.get(k);if(!b)bins.set(k,b={M:[],C:[]});
    o.updateMatrix();b.M.push(...o.matrix.elements);col.set(paint);b.C.push(col.r,col.g,col.b);};
  // Box from a to b (local +X along the segment), as the area builders' `bar`.
  const bar=(a,b,w,h,paint)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-4)return;
    box((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,l,h,w,paint,Math.atan2(-dz,dx),Math.asin(Math.max(-1,Math.min(1,dy/l))));};
  const flush=()=>{let total=0;if(!bins.size)return 0;const g=own(new THREE.BoxGeometry(1,1,1)),material=mat({vertexColors:false,roughness:.88,metalness:0});
    for(const [k,{M,C}] of [...bins].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))){const n=C.length/3;if(!n)continue;total+=n;
      const m=new THREE.InstancedMesh(g,material,n);m.instanceMatrix.array.set(M);
      m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(C),3);m.name=name+(k===''?'':'-'+k);m.castShadow=castShadow;m.receiveShadow=true;
      m.computeBoundingSphere();scene.add(m);meshes.push(m);}
    return total;};
  return {box,bar,flush,count:()=>[...bins.values()].reduce((n,b)=>n+b.C.length/3,0)};
}

// build(collectCtx) draws the form at the origin through collectCtx.bake (same signature as the plaza bake).
export function formInstances(list,name,build,{scene,own,mat,meshes},{castShadow=true,sector=null}={}) {
  if(!list.length)return 0;
  const o=new THREE.Object3D(),m4=new THREE.Matrix4(),nm=new THREE.Matrix3(),col=new THREE.Color(),vv=new THREE.Vector3(),nn=new THREE.Vector3();
  const acc={solid:{p:[],n:[],c:[]},leaf:{p:[],n:[],c:[]}};
  const bake=(g,x,y,z,sx,sy,sz,paint,ry=0,kind='solid',rz=0)=>{o.position.set(x,y,z);o.rotation.set(0,ry,rz);o.scale.set(sx,sy,sz);o.updateMatrix();
    m4.copy(o.matrix);nm.getNormalMatrix(m4);col.set(paint);const b=acc[kind==='leaf'?'leaf':'solid'],P=g.attributes.position,N=g.attributes.normal,I=g.index;
    for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;vv.fromBufferAttribute(P,j).applyMatrix4(m4);nn.fromBufferAttribute(N,j).applyNormalMatrix(nm);
      b.p.push(vv.x,vv.y,vv.z);b.n.push(nn.x,nn.y,nn.z);b.c.push(col.r,col.g,col.b);}};
  const temp=new Set(),tmpOwn=g=>(temp.add(g),g);
  const box=tmpOwn(new THREE.BoxGeometry(1,1,1)),cylinder=tmpOwn(new THREE.CylinderGeometry(1,1,1,8)),sphere=tmpOwn(new THREE.IcosahedronGeometry(1,1));
  build({bake,own:tmpOwn,box,cylinder,sphere});
  for(const g of temp)g.dispose();
  const materials={solid:mat({vertexColors:true,roughness:.9,metalness:0}),leaf:mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide})};
  let n=0;
  const groups=new Map();for(const p of list){const k=sector?sector(p.x,p.z):'';let l=groups.get(k);if(!l)groups.set(k,l=[]);l.push(p);}
  for(const kind of ['solid','leaf']){const b=acc[kind];if(!b.p.length)continue;const g=own(new THREE.BufferGeometry());
    g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();
    for(const [k,part] of [...groups].sort((a,c)=>String(a[0]).localeCompare(String(c[0])))){
      const mesh=new THREE.InstancedMesh(g,materials[kind],part.length);
      part.forEach((p,i)=>{const s=p.scale??1;o.position.set(p.x,p.y,p.z);o.rotation.set(0,p.yaw??0,0);o.scale.set(s,s,s);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
      mesh.name=name+kind+(k===''?'':'-'+k);mesh.castShadow=castShadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);n++;}}
  return n;
}

// A broad shade tree (the shared street-kit form, Wikimedia Commons curid=80420009, curid=195143828, curid=122996449, curid=184241561) at the origin, for formInstances.
export const shadeTreeForm=ctx=>streetKit(ctx).trees([{x:0,y:0,z:0,scale:1}]);
// Perf (2026-11-18) far/sealed forms: a broadleaf with one 20-triangle crown on a box trunk; a palm with a 12-triangle crown
// of six drooping fronds on a 5-sided tapered trunk. For ground a rider never approaches within ~80 m (the sealed base).
export const lowTreeForm=({bake,box})=>{const ico=new THREE.IcosahedronGeometry(1,0);
  bake(box,0,1.6,0,.32,3.4,.32,'#6f6553');bake(ico,0,4.3,0,2.5,1.7,2.4,'#4b7246',0,'leaf');ico.dispose();};
// the trunk foot reaches 25 cm below the anchor (was flush: 1–1.5 cm downhill daylight).
export const lowPalmForm=({bake})=>{const trunk=new THREE.CylinderGeometry(.13,.2,8.65,5,1,true);bake(trunk,.35,4.075,0,1,1,1,'#8b8069',0,'solid',-.04);trunk.dispose();
  const p=[];for(let k=0;k<6;k++){const a=k*Math.PI/3,c=Math.cos(a),s=Math.sin(a),x0=.65,y0=8.45,L=3.4,w=.55;
    const tip=[x0+c*L,y0-1.5,s*L],l=[x0+c*L*.45-s*w,y0+.25,s*L*.45+c*w],r=[x0+c*L*.45+s*w,y0+.25,s*L*.45-c*w],root=[x0,y0,0];
    p.push(...root,...l,...tip,...root,...tip,...r);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();
  bake(g,0,0,0,1,1,1,'#4d7240',0,'leaf');g.dispose();};

// Triangles [[x,y,z]×3, colour] → one static mesh (front faces wound by the caller).
export function mergedMesh(name,tris,{scene,own,mat,meshes},{castShadow=true}={}) {
  if(!tris.length)return null;const p=[],c=[],col=new THREE.Color();
  for(const [a,b,d,paint] of tris){col.set(paint);p.push(...a,...b,...d);for(let k=0;k<3;k++)c.push(col.r,col.g,col.b);}
  const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.Mesh(g,mat({vertexColors:true,roughness:.85,metalness:0}));m.name=name;m.castShadow=castShadow;m.receiveShadow=true;scene.add(m);meshes.push(m);return m;
}
