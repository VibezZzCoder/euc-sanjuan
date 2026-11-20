/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Coast visuals — © 2026 VibezZzCoder, MIT. Every shore number comes from sj-coast-layout.js (shared physical owner).
// ctx: {scene,own,mat,meshes} — the shared pools. Four draws: shore faces, quay copings, loose rocks and the sea.
// Vertex colours only, no textures. Everything outside the polygon (far shore, horizon, east land) belongs to `worldedge`.
// References: Wikimedia Commons curid=86543901 tan/brown pitted eolianite shelf, dark wet rock and white surf; Wikimedia Commons
// curid=72372087, curid=80251220, curid=109811939 La Perla's rock-and-rubble shore with a surf line; Wikimedia Commons curid=123485577 dark rocks and surf under El Morro; Wikimedia Commons curid=123441024 the
// Puntilla east quay (pale concrete coping, dark wet face); Wikimedia Commons curid=106059407, curid=182263185 low pale quay walls at the Aduana and Arsenal.
import * as THREE from 'three/webgpu';

const ROCK=['#75664d','#665b49','#80714f','#5e5950'].map(c=>new THREE.Color(c));
const WET=new THREE.Color('#3a3731'),SURF=new THREE.Color('#b9c5c1'),DEEP=new THREE.Color('#2b6170');
const RIPRAP=['#6a6c64','#5c6058','#72766c','#63675e'].map(c=>new THREE.Color(c)),APRON=new THREE.Color('#6d706c'),FOAM_OUT=new THREE.Color('#3f9497'),FACE_SURF=new THREE.Color('#8d9894');   // softer face surf row (no bright wedges at face ends)
const STONE=['#5c6058','#6c7066','#63675e','#73766b','#686a60'].map(c=>new THREE.Color(c)),STONE_WET=new THREE.Color('#34372f');
const QUAY=new THREE.Color('#a8a397'),QUAY_STAIN=new THREE.Color('#7d796d'),QUAY_WET=new THREE.Color('#33403b'),COPING=new THREE.Color('#d2ccbf');
const hash=(x,z)=>{let h=Math.imul(Math.round(x*16)|0,374761393)^Math.imul(Math.round(z*16)|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};

const smooth=(x,z,s)=>{const fx=x/s,fz=z/s,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,e=t=>t*t*(3-2*t);
  const a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);return a+(b-a)*e(u)+(c-a)*e(v)+(a-b-c+d)*e(u)*e(v);};
function geometry(p,c,idx){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));if(idx)g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;}

export function buildCoast(n,ctx) {
  const {scene,own,mat,meshes}=ctx;
  const add=(g,m,name,{shadow=false}={})=>{const mesh=new THREE.Mesh(own(g),m);mesh.name=name;mesh.receiveShadow=shadow;scene.add(mesh);meshes.push(mesh);return mesh;};
  const stats={faces:n.faces.length,strips:n.strips.length,copings:n.copings.length,rocks:n.rocks.length};

  // everything along the shore is sectored in 512 m bins (tight bounds, so frustum culling works; the old
  // single meshes spanned the city and passed every view). Faces, surf and copings share one vertex-coloured material.
  const BIN=512,binKey=(x,z)=>Math.floor(x/BIN)+','+Math.floor(z/BIN),bins=new Map();
  const binOf=(x,z)=>{const k=binKey(x,z);let b=bins.get(k);if(!b)bins.set(k,b={p:[],c:[],idx:[],ids:new Map(),next:0});return b;};
  const shoreMat=mat({vertexColors:true,roughness:.92,metalness:0,side:THREE.DoubleSide});
  // ---- Shore faces: one strip per run of final segments, vertices shared along the run inside a bin. ----
  {const tmp=new THREE.Color();let tris=0;
    const rowColour=(v,quay,r,rows)=>{
      if(quay)return r===0?COPING:r===1?QUAY:r===2?QUAY_STAIN.clone().lerp(QUAY_WET,.35):QUAY_WET;   // pale coping course on the face top
      // Built-shore rock faces (low bay banks, ) are grey harbour rip-rap; natural shores keep the eolianite.
      const PAL=v.quay?RIPRAP:ROCK,nz=smooth(v.x+11,v.z-11,5)*PAL.length,k=Math.min(PAL.length-1,Math.floor(nz)),base=tmp.copy(PAL[k]).lerp(PAL[(k+1)%PAL.length],nz-k);
      return [base.clone(),base.clone().lerp(WET,.35),WET,FACE_SURF,DEEP][r];};
    const vid=(B,v,quay,r,rows)=>{const key=v.id+'|'+quay+'|'+r;let id=B.ids.get(key);if(id!==undefined)return id;
      const row=rows[r];B.p.push(v.x+v.m[0]*row[0],row[1],v.z+v.m[1]*row[0]);const col=rowColour(v,quay,r,rows);B.c.push(col.r,col.g,col.b);B.ids.set(key,id=B.next++);return id;};
    const starts=new Set(n.faces.map(f=>f.a.id)),ends=new Set(n.faces.map(f=>f.b.id));
    const byB=new Map(n.faces.map(f=>[f.b.id,f])),byA=new Map(n.faces.map(f=>[f.a.id,f]));
    for(const f of n.faces){const R=f.rowsA.length,B=binOf(f.a.x,f.a.z);
      for(let r=0;r+1<R;r++){const a0=vid(B,f.a,f.quay,r,f.rowsA),b0=vid(B,f.b,f.quay,r,f.rowsB),a1=vid(B,f.a,f.quay,r+1,f.rowsA),b1=vid(B,f.b,f.quay,r+1,f.rowsB);
        // Land is on the left of a→b; the face looks seaward (right): wind so its normal points out to sea.
        B.idx.push(a0,b1,b0,a0,a1,b1);tris+=2;}
      // Run ends (and type changes) get a vertical end cap down the normal line, so no side gap shows beside a skirt.
      const capAt=(v,rows,flip)=>{if(rows.length<3)return;const top=vid(B,v,f.quay,0,rows);
        const foot=B.next++;B.p.push(v.x,rows.at(-1)[1],v.z);const col=rowColour(v,f.quay,rows.length-1,rows);B.c.push(col.r,col.g,col.b);
        for(let r=0;r+1<rows.length;r++){const a=vid(B,v,f.quay,r,rows),b=vid(B,v,f.quay,r+1,rows);B.idx.push(...(flip?[top,a,b]:[top,b,a]));tris++;}
        B.idx.push(...(flip?[top,vid(B,v,f.quay,rows.length-1,rows),foot]:[top,foot,vid(B,v,f.quay,rows.length-1,rows)]));tris++;};
      if(!ends.has(f.a.id)||byB.get(f.a.id)?.quay!==f.quay)capAt(f.a,f.rowsA,true);
      if(!starts.has(f.b.id)||byA.get(f.b.id)?.quay!==f.quay)capAt(f.b,f.rowsB,false);}
    // Surf lines across the waterline strips (Wikimedia Commons curid=72372087, curid=86543901): a flat soft foam band 4 cm over the water along the smoothed
    // contact, white at the contact fading out to the shallow-water tone. Entries: [inland, seaward].
    for(const run of n.foam)for(let k=0;k+1<run.length;k++){const [i0,o0]=run[k],[i1,o1]=run[k+1];
      if(Math.hypot(i1[0]-i0[0],i1[2]-i0[2])>3.5)continue;const B=binOf(i0[0],i0[2]);
      // the crest brightness varies along the shore too (smooth noise over ~9 m), not only the width.
      const ids4=[i0,i1,o1,o0].map(q=>{B.p.push(...q);const f=q===i0||q===i1?tmp.copy(SURF).lerp(FOAM_OUT,.65*smooth(q[0]+5,q[2]-3,9)):FOAM_OUT;B.c.push(f.r,f.g,f.b);return B.next++;});
      // Upward-facing: (i0,i1,o1) / (i0,o1,o0) or the reverse, by the plan winding.
      const cr=(i1[0]-i0[0])*(o1[2]-i0[2])-(i1[2]-i0[2])*(o1[0]-i0[0]);
      B.idx.push(...(cr<0?[ids4[0],ids4[1],ids4[2],ids4[0],ids4[2],ids4[3]]:[ids4[0],ids4[2],ids4[1],ids4[0],ids4[3],ids4[2]]));tris+=2;}
    // Quay aprons over the fill ears: weathered concrete, the same bins and material.
    for(const ap of n.aprons??[]){const B=binOf(ap.x,ap.z),AC=ap.colour?new THREE.Color(ap.colour):APRON;for(const q of ap.polys)for(let i=1;i+1<q.length;i++){const t=[q[0],q[i],q[i+1]];
      const cr=(t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]);for(const v of (cr<0?t:[t[0],t[2],t[1]])){B.p.push(...v);B.c.push(AC.r,AC.g,AC.b);B.idx.push(B.next++);}tris++;}}
    // ---- Quay copings: the drawn ground clipped to the band, +3 cm, and the nose. Same bins, non-shared vertices. ----
    for(const k of n.copings){const B=binOf(k.a.x,k.a.z);const push=(...pts)=>{for(const q of pts){B.p.push(...q);B.c.push(COPING.r,COPING.g,COPING.b);B.idx.push(B.next++);}tris+=pts.length/3;};
      for(const q of k.polys)for(let i=1;i+1<q.length;i++)push(q[0],q[i],q[i+1]);
      }   // no nose past the face line (the face carries the pale course)
    // Paseo del Morro rip-rap band (Wikimedia Commons curid=114692556): per stone 9 vertices (6 seated rim, 3 top) and 10 triangles, its
    // own shared vertices (smooth, weathered lumps, not dice); rim darker, top lighter, wet-dark toward the waterline.
    {const S=n.stones;if(S?.count){const tmp=new THREE.Color(),SIDES=[[0,1,6],[1,2,6],[2,7,6],[2,3,7],[3,4,7],[4,8,7],[4,5,8],[5,0,8],[0,6,8],[6,7,8]];
      for(let q=0;q<S.count;q++){const o=q*27,cx=(S.pos[o]+S.pos[o+9])/2,cz=(S.pos[o+2]+S.pos[o+11])/2,B=binOf(cx,cz),b0=B.next;
        const tone=STONE[Math.min(STONE.length-1,Math.floor(S.tone[q]*STONE.length))];let mx=0,my=0,mz=0;
        for(let v=0;v<9;v++){const x=S.pos[o+v*3],y=S.pos[o+v*3+1],z=S.pos[o+v*3+2];B.p.push(x,y,z);mx+=x/9;my+=y/9;mz+=z/9;
          tmp.copy(tone).multiplyScalar(v<6?.82:1.1);const wet=Math.max(0,Math.min(1,(.45-y)/.6));tmp.lerp(STONE_WET,.75*wet);B.c.push(tmp.r,tmp.g,tmp.b);}
        B.next+=9;
        for(const [i,j,k] of SIDES){const P=t=>[S.pos[o+t*3],S.pos[o+t*3+1],S.pos[o+t*3+2]],A=P(i),Bv=P(j),Cv=P(k);
          const ux=Bv[0]-A[0],uy=Bv[1]-A[1],uz=Bv[2]-A[2],vx=Cv[0]-A[0],vy=Cv[1]-A[1],vz=Cv[2]-A[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
          const out=nx*((A[0]+Bv[0]+Cv[0])/3-mx)+ny*((A[1]+Bv[1]+Cv[1])/3-my+.05)+nz*((A[2]+Bv[2]+Cv[2])/3-mz);
          B.idx.push(...(out>=0?[b0+i,b0+j,b0+k]:[b0+i,b0+k,b0+j]));tris++;}}
      stats.stones=S.count;}}
    // Geometry storage: the shore bins keep 8-bit normalized colours and normals (3 B each instead of 12; rock, sand,
    // concrete and foam tones and lumpy normals do not need float precision). Positions stay Float32.
    const compact=g=>{const c=g.attributes.color.array,n=g.attributes.normal.array,c8=new Uint8Array(c.length),n8=new Int8Array(n.length);
      for(let i=0;i<c.length;i++)c8[i]=Math.round(Math.max(0,Math.min(1,c[i]))*255);for(let i=0;i<n.length;i++)n8[i]=Math.round(Math.max(-1,Math.min(1,n[i]))*127);
      g.setAttribute('color',new THREE.BufferAttribute(c8,3,true));g.setAttribute('normal',new THREE.BufferAttribute(n8,3,true));return g;};
    for(const [key,B] of bins){if(!B.idx.length)continue;add(compact(geometry(B.p,B.c,B.idx)),shoreMat,'sj-coast-shore-'+key,{shadow:true});}
    stats.faceTriangles=tris;stats.shoreBins=bins.size;}

  // ---- Loose rocks at the natural toe (Wikimedia Commons curid=86543901, curid=123485577): flattened instanced icosahedra, one InstancedMesh per 512 m bin. ----
  // the Paseo del Morro rip-rap toe (n.riprap, grey-green boulders, Wikimedia Commons curid=114692556) shares the instance sets.
  const allRocks=[...n.rocks,...(n.riprap??[]).map(r=>({...r,riprap:true}))];
  if(allRocks.length){const g=own(new THREE.IcosahedronGeometry(1,0)),m=mat({vertexColors:false,roughness:.95,metalness:0});
    const groups=new Map();for(const r of allRocks){const k=binKey(r.x,r.z);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
    const d=new THREE.Object3D(),col=new THREE.Color();
    for(const [key,list] of groups){const rocks=new THREE.InstancedMesh(g,m,list.length);
      list.forEach((r,i)=>{d.position.set(r.x,r.y,r.z);d.rotation.set(.2*(r.tone-.5),r.yaw,.25*(r.tone-.5));d.scale.set(r.r*1.25,r.r*.62,r.r);d.updateMatrix();
        rocks.setMatrixAt(i,d.matrix);rocks.setColorAt(i,r.riprap?col.copy(RIPRAP[Math.floor(r.tone*4)]).lerp(WET,.25):col.copy(ROCK[Math.floor(r.tone*3)]).lerp(WET,.45));});
      rocks.computeBoundingSphere();rocks.name='sj-coast-rocks-'+key;rocks.receiveShadow=true;scene.add(rocks);meshes.push(rocks);}
    stats.rockBins=groups.size;}

  // ---- The sea: one coarse grid with vertex colours (Wikimedia Commons curid=123485577, curid=72372087, curid=86543901: turquoise over the north-shore reef shelf, deep
  // blue offshore, greener bay water to the south) instead of the flat 12 km plane. Same water line (y = 0). ----
  {const {land,...t}=n.seaGrid;
    // Coarse land occupancy (10 m) and a chamfer distance to it, for the shallow-water tint.
    const cs=10,cw=Math.ceil((t.nx-1)*t.step/cs),ch=Math.ceil((t.nz-1)*t.step/cs),dist=new Float32Array(cw*ch).fill(1e9);
    for(let j=0;j<t.nz;j+=5)for(let i=0;i<t.nx;i+=5)if(land[j*t.nx+i])dist[Math.min(ch-1,Math.floor(j*t.step/cs))*cw+Math.min(cw-1,Math.floor(i*t.step/cs))]=0;
    for(let pass=0;pass<2;pass++)for(let jj=0;jj<ch;jj++)for(let ii0=0;ii0<cw;ii0++){const j=pass?ch-1-jj:jj,i=pass?cw-1-ii0:ii0,k=j*cw+i,s=pass?1:-1;
      for(const [di,dj,w] of [[s,0,1],[0,s,1],[s,s,1.414],[-s,s,1.414]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=cw||b>=ch)continue;const v=dist[b*cw+a]+w*cs;if(v<dist[k])dist[k]=v;}}
    // Grid lines: 75 m (was 50 m) over the islet and its near water, then widening to ±12 km (the old ±6 km edge could sit inside the 5 km far plane at the east end).
    const axis=(lo,hi,R)=>{const a=[];for(let v=lo;v<=hi;v+=75)a.push(v);let s=75,v=lo;while(v>-R){s*=1.8;v=Math.max(-R,v-s);a.unshift(v);}s=75;v=a.at(-1);while(v<R){s*=1.6;v=Math.min(R,v+s);a.push(v);}return a;};
    const XS=axis(-1850,1750,12000),ZS=axis(-1350,1050,12000),NX=XS.length,NZ=ZS.length;
    const shoreDist=(x,z)=>{const i=Math.floor((x-t.x0)/cs),j=Math.floor((z-t.z0)/cs);if(i<0||j<0||i>=cw||j>=ch)return 1e9;return dist[j*cw+i];};
    const HAZE=new THREE.Color('#86b4bb'),OPEN=new THREE.Color('#1c5f7d'),BAY=new THREE.Color('#236b7a'),SHALLOW=new THREE.Color('#2f878c'),col=new THREE.Color();
    const noise=(x,z,s)=>{const fx=x/s,fz=z/s,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,e=q=>q*q*(3-2*q);
      const a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);return a+(b-a)*e(u)+(c-a)*e(v)+(a-b-c+d)*e(u)*e(v);};
    const p=new Float32Array(NX*NZ*3),c=new Float32Array(p.length),idx=[];
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const x=XS[i],z=ZS[j],k=(j*NX+i)*3;p[k]=x;p[k+1]=0;p[k+2]=z;
      // North (open Atlantic, z < -300) to south (the bay, z > 200): blend; then shallow turquoise within ~90 m of land.
      const bay=Math.max(0,Math.min(1,(z+300)/700));col.copy(OPEN).lerp(BAY,bay);
      const d=shoreDist(x,z),sh=d<120?.75*Math.pow(1-d/120,1.5)*(bay>.6?.5:1):0;col.lerp(SHALLOW,sh);
      const nz=noise(x,z,260)-.5;col.offsetHSL(0,0,nz*.03);
      // Far water shades toward the haze ((−225,248)): beyond ~0.3 km from the islet the tone eases to a pale bay
      // teal by ~3 km, so it meets worldedge's horizon blend instead of a dark band under the sky.
      {const dx=Math.max(-1400-x,0,x-1340),dz=Math.max(-940-z,0,z-660),far=Math.max(0,Math.min(1,(Math.hypot(dx,dz)-300)/2700));col.lerp(HAZE,.6*far);}c[k]=col.r;c[k+1]=col.g;c[k+2]=col.b;}
    for(let j=0;j+1<NZ;j++)for(let i=0;i+1<NX;i++){const a=j*NX+i;idx.push(a,a+NX,a+1,a+1,a+NX,a+NX+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));
    g.setIndex(idx);const nrm=new Float32Array(p.length);for(let k=1;k<nrm.length;k+=3)nrm[k]=1;g.setAttribute('normal',new THREE.BufferAttribute(nrm,3));g.computeBoundingSphere();
    const sea=add(g,mat({vertexColors:true,roughness:.32,metalness:0}),'sj-coast-sea');sea.userData.sea=true;   // worldedge finds it by this flag
    stats.seaVertices=p.length/3;stats.seaTriangles=idx.length/3;}

  return stats;
}
