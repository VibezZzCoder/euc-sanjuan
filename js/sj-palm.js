/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Shared tall coconut-type palm — © 2026 VibezZzCoder, MIT. Princesa's form (Wikimedia Commons curid=80420696, curid=182263283, curid=122996449; crown boot + nut bunch per
// the curved trunk profile): curved 6-sided tube trunk tapering 30 %, fibrous boot, five nuts, eleven fronds with leaflet
// roots on the 4-chord rib. p = {x,y,z,height,lean,leanDir?}; k varies the lean direction and frond phase.
import * as THREE from 'three/webgpu';

const q=new THREE.Quaternion();
export function tallPalm(p,k,{bake,sphere}){
  const dir=k*1.9+.4,lx=p.leanDir?p.leanDir[0]*p.lean:Math.cos(dir)*p.lean,lz=p.leanDir?p.leanDir[1]*p.lean:Math.sin(dir)*p.lean,pts=[];
  for(let i=0;i<=8;i++){const t=i/8;pts.push(new THREE.Vector3(p.x+lx*p.height*t*t*.5,p.y+p.height*t,p.z+lz*p.height*t*t*.5));}
  const trunk=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),8,.19,6,false),tp=trunk.attributes.position;
  for(let i=0;i<tp.count;i++){const t=(tp.getY(i)-p.y)/p.height,c=pts[Math.round(Math.min(1,Math.max(0,t))*8)],f2=1-.3*t;
    tp.setXYZ(i,c.x+(tp.getX(i)-c.x)*f2,tp.getY(i),c.z+(tp.getZ(i)-c.z)*f2);}
  trunk.computeVertexNormals();bake(trunk,0,0,0,1,1,1,'#8b8069',0,'solid');trunk.dispose();
  // a seated record (p.foot below p.y, js/sj-street-kit.js seatRecords) gets a trunk-coloured
  // root collar from p.foot to 0.3 m up, so the downhill edge meets the ground. Without p.foot nothing changes.
  if(Number.isFinite(p.foot)&&p.foot<p.y){const h=p.y+.3-p.foot,g=new THREE.CylinderGeometry(.19,.2,h,6,1,true);bake(g,p.x,p.foot+h/2,p.z,1,1,1,'#8b8069',0,'solid');g.dispose();}
  const c=pts[8],T=c.clone().sub(pts[7]).normalize(),U=new THREE.Vector3(-T.z,0,T.x).normalize(),V=new THREE.Vector3().crossVectors(T,U);
  const boot=new THREE.CylinderGeometry(.3,.18,.8,8,1,false);boot.applyQuaternion(q.setFromUnitVectors(new THREE.Vector3(0,1,0),T));
  const mid=c.clone().addScaledVector(T,-.15);bake(boot,mid.x,mid.y,mid.z,1,1,1,'#6b5a3b',0,'solid');boot.dispose();
  for(let n=0;n<5;n++){const a=n*1.33+k*.9,alongT=-.2-(n%3)*.06,r=.12+(n%2)*.015,out=(.18+.12*(alongT+.55)/.8)*Math.cos(Math.PI/8)+r-.02;
    const at=c.clone().addScaledVector(T,alongT).addScaledVector(U,Math.cos(a)*out).addScaledVector(V,Math.sin(a)*out);
    bake(sphere,at.x,at.y,at.z,r,r*1.12,r,['#8a8738','#7b7a31','#9c8a3f'][n%3],a,'solid');}
  for(let j=0;j<11;j++){
    const a=j*Math.PI*2/11+k*.4,pitch=(j%3)*.25-.1,L=3.7+(j%2)*.5;
    const point=u=>[c.x+Math.cos(a)*L*u,c.y+L*(.55*u-1.05*u*u+pitch*u*.5),c.z+Math.sin(a)*L*u];
    // Leaflet roots sit on the rib itself: the rib is the 4-chord polyline of the curve and the roots are sampled on it
    // (roots on the curve floated up to 0.22 m off a coarser straight rib).
    const rib=u=>{const k=Math.min(3,Math.floor(Math.max(0,u)*4)),f=u*4-k,p0=point(k/4),p1=point((k+1)/4);return p0.map((v,i)=>v+(p1[i]-v)*f);};
    const tris=[];
    for(let qq=1;qq<=7;qq++){const u=qq/8,at=rib(u),next=rib(u+.1),width=.66*Math.sin(u*Math.PI);
      for(const side of [-1,1])tris.push(...at,at[0]+Math.cos(a+1.25*side)*width,at[1]-.32*width,at[2]+Math.sin(a+1.25*side)*width,...next);}
    for(let qq=0;qq<4;qq++){const p0=point(qq/4),p1=point((qq+1)/4),sx=-Math.sin(a)*.035,sz=Math.cos(a)*.035;
      tris.push(p0[0]-sx,p0[1],p0[2]-sz,p0[0]+sx,p0[1],p0[2]+sz,p1[0]+sx,p1[1],p1[2]+sz,p0[0]-sx,p0[1],p0[2]-sz,p1[0]+sx,p1[1],p1[2]+sz,p1[0]-sx,p1[1],p1[2]-sz);}
    const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(tris,3));fg.computeVertexNormals();
    bake(fg,0,0,0,1,1,1,['#3b6337','#4d7240','#5f8448'][j%3],0,'leaf');fg.dispose();
  }
}

// Instanced tall palms (La Perla district S4: ~40 KB of baked geometry per palm otherwise): the shared form built once per
// variant at the origin; each palm {x,y,z,yaw} turns its variant (i mod 3) about its own trunk foot, sunk 0.15 m.
// `variants` (optional) limits the forms used (indices into VARIANTS): a few palms in one form cost two draws, not six.
export function palmInstances(palms,name,{scene,own,mat,meshes},{variants:use=null}={}) {
  const o=new THREE.Object3D(),m4=new THREE.Matrix4(),nm=new THREE.Matrix3(),col=new THREE.Color(),vv=new THREE.Vector3(),nn=new THREE.Vector3();
    const materials={solid:mat({vertexColors:true,roughness:.9,metalness:0}),leaf:mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide})};
    // Nuts use a 20-face icosahedron (≈25 cm, read at a distance) instead of the 80-face shared sphere.
    const nut=own(new THREE.IcosahedronGeometry(1,0)),VARIANTS=[{height:8.6,lean:.18},{height:10.4,lean:.28},{height:7.2,lean:.12}];
    const variants=VARIANTS.map((v,k)=>{const acc={solid:{p:[],n:[],c:[]},leaf:{p:[],n:[],c:[]}};
      const collect=(g,x,y,z,sx,sy,sz,paint,ry=0,kind='solid',rz=0)=>{o.position.set(x,y,z);o.rotation.set(0,ry,rz);o.scale.set(sx,sy,sz);o.updateMatrix();
        m4.copy(o.matrix);nm.getNormalMatrix(m4);col.set(paint);const b=acc[kind==='leaf'?'leaf':'solid'],P=g.attributes.position,N=g.attributes.normal,I=g.index;
        for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;vv.fromBufferAttribute(P,j).applyMatrix4(m4);nn.fromBufferAttribute(N,j).applyNormalMatrix(nm);
          b.p.push(vv.x,vv.y,vv.z);b.n.push(nn.x,nn.y,nn.z);b.c.push(col.r,col.g,col.b);}};
      tallPalm({x:0,y:0,z:0,...v,leanDir:[1,0]},k,{bake:collect,sphere:nut});
      return Object.fromEntries(Object.entries(acc).map(([kind,b])=>{const g=own(new THREE.BufferGeometry());
        g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
        g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();return [kind,g];}));});
    const by=VARIANTS.map(()=>[]),pick=use??VARIANTS.map((v,k)=>k);palms.forEach((p,i)=>by[pick[i%pick.length]].push(p));
    by.forEach((list,k)=>{if(!list.length)return;for(const kind of ['solid','leaf']){const mesh=new THREE.InstancedMesh(variants[k][kind],materials[kind],list.length);
      list.forEach((p,i)=>{o.position.set(p.x,p.y-.15,p.z);o.rotation.set(0,p.yaw,0);o.scale.set(1,1,1);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
      mesh.name=name+kind;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);}});
}
