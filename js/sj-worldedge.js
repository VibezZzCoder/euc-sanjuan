/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// World edge visuals — © 2026 VibezZzCoder, MIT. All positions come from sj-worldedge-layout.js (the single physical owner).
// ctx: {scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height} — the shared pools (this module adds its own few
// meshes instead of the 64 m spatial pools, to stay within its mesh budget).
// The 2024 El Morro aerial views show distant towers east-southeast and mountains to the south. Across the harbour
// mouth the low shore reads as a thin strip; mid-rise Miramar blocks are visible behind Muelle 2.
// The backdrop is inferred beyond the mapped land.
import * as THREE from 'three/webgpu';
import {positionLocal,positionWorld,cameraPosition,smoothstep,mix,vec4,float,max,uniform} from '../vendor/three/build/three.tsl.js';

// City ground palette at the cut (sidewalk, unpaved class 1, lawn, water edge). class 1 follows the
// ground package's unassigned hard ground (worn concrete `#978f81`–`#878073`, sj-ground.js HARD) instead of the old
// base asphalt `#687d91`, which faded into lawn as turquoise behind the hoarding.
const CITY=['#c8bfaa','#8f887a','#7e9866','#346d80'];
// Far zones carry more vegetation tone (Wikimedia Commons curid=148962402, curid=148962401, curid=131971361: the far shores read as dark green bands under pale blocks).
// ((1225,245) / (−225,248)): the far zones read as a pale band under the 500–4400 m fog; refs
// 55/32/40 show the far shore as a darker low strip with small pale blocks, so the across-water zones and the waterline
// are toned down (masses keep their pale palette). Asphalt follows the streets owner's `#73777a` (× its noise ≈ 0.95).
const ZONE={pdt:'#b2ab9b',pdtport:'#7c7972',park:'#7e9866',pdtcoast:'#869c6c',cabras:'#4d6645',catano:'#64714f',islagrande:'#8c907c',
  miramar:'#8a8e79',condado:'#9a9885'};
const ROCK='#6f6e63',SHORE='#8f8873',WATERLINE='#5c5b53',QUAY='#726f68',SIDEWALK='#c8bfaa',ASPHALT='#6d7174';
const BOARD=['#d8d6cc','#cfccc1'],POST='#6c706d',NET='#2f4f42',TRIM='#efe9dc',GLASS=['#33424a','#3d4c52','#4a5658','#2c3a40'],PLINTH='#9a9184';
// Global scene fog (interim recommendation): 500–4400 m, inside the camera's 5000 m far plane. Applied from
// this area's builder, so nulling the area restores the base 350–2200 m.
export const FOG={near:500,far:4400};
// Masses nearer the cut than DETAIL_X get facade detail (windows, string courses, cornice, plinth). Nothing of this area
// casts shadows (it is all outside the polygon or a thin fence) and every batch is split into 512 m sectors.
const DETAIL_X=1540,SECTOR=512,FINE_FAR=350;  // facade detail only within ~200 m of the hoarding; 512 m culling sectors

export function buildWorldEdge(e,ctx) {
  const {scene,own,mat,meshes,textures,height}=ctx,stats={};
  const c=new THREE.Color(),c2=new THREE.Color();
  const extraMaterials=[];
  const add=(mesh,name)=>{mesh.name='sj-worldedge-'+name;mesh.castShadow=false;mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);return mesh;};
  // Draw-call round (perf report 2): every kind is merged into a few static vertex-coloured meshes on ONE flat-shaded
  // material — two continuation groups (north / south of z −60, with the closure) and one per far shore (west: Isla de
  // Cabras + Cataño; south: Isla Grande + Miramar; east: Puerta de Tierra east + Condado). Netting (alpha-tested) and the
  // sky are the only other meshes. Colours are unorm8; boxes and crowns share vertices (flat shading needs no normals).
  // the two far-shore pieces that street views actually frame are split off their 3–5 km meshes — Isla de
  // Cabras / El Morro side north of z 0 (Paseo del Morro) and the bay shore west of x 1024 (Plaza de Armas).
  const groupOf=(x,z)=>x>1300&&x<1700&&Math.abs(z)<700?(z<-60?'cont-n':'cont-s'):x<-500?(z<0?'west-n':'west'):z>380?(x<1024?'south-w':'south'):'east';
  const buckets=new Map(),bucket=k=>{let b=buckets.get(k);if(!b)buckets.set(k,b={pos:[],col:[],idx:[],fine:[]});return b;};
  const pushColour=(b,col)=>b.col.push(Math.round(Math.min(1,col.r)*255),Math.round(Math.min(1,col.g)*255),Math.round(Math.min(1,col.b)*255),255);
  // Append a (indexed) unit geometry transformed by an Object3D placement; colour = item colour × vertex colour (if any).
  const v3=new THREE.Vector3(),vc=new THREE.Color();
  // `fine`: near-only detail (facade trim, windows, closure kit, signs) goes to the bucket's second index
  // list, emitted after the silhouette so a far camera draws only the first part (see the draw-range updater below).
  const appendInstances=(geometry,items,place,fine=false)=>{const d=new THREE.Object3D(),P=geometry.attributes.position,C=geometry.attributes.color,I=geometry.index;
    for(const it of items){place(it,d,c);d.updateMatrix();const b=bucket(groupOf(d.position.x,d.position.z)),base=b.pos.length/3,out=(typeof fine==='function'?fine(it):fine)?b.fine:b.idx;
      for(let i=0;i<P.count;i++){v3.fromBufferAttribute(P,i).applyMatrix4(d.matrix);b.pos.push(v3.x,v3.y,v3.z);
        if(C)vc.setRGB(C.getX(i),C.getY(i),C.getZ(i)).multiply(c);else vc.copy(c);pushColour(b,vc);}
      if(I)for(let i=0;i<I.count;i++)out.push(base+I.getX(i));else for(let i=0;i<P.count;i++)out.push(base+i);}};
  // Append whole-surface triangles (shared vertices per group).
  const appendSurface=(pos,col,idx)=>{const maps=new Map();
    for(let t=0;t<idx.length;t+=3){const a=idx[t],b0=idx[t+1],d=idx[t+2],k=groupOf((pos[3*a]+pos[3*b0]+pos[3*d])/3,(pos[3*a+2]+pos[3*b0+2]+pos[3*d+2])/3);
      const b=bucket(k);let m=maps.get(k);if(!m)maps.set(k,m=new Map());
      for(const v of [a,b0,d]){let id=m.get(v);if(id===undefined){id=b.pos.length/3;m.set(v,id);b.pos.push(pos[3*v],pos[3*v+1],pos[3*v+2]);vc.setRGB(col[3*v],col[3*v+1],col[3*v+2]);pushColour(b,vc);}b.idx.push(id);}}};
  const flatMat=mat({vertexColors:true,flatShading:true,roughness:.9,metalness:0});
  const ranged=[];let netting=null;
  const emitBuckets=()=>{for(const [k,b] of buckets){if(!b.idx.length&&!b.fine.length)continue;const g=own(new THREE.BufferGeometry());
      g.setAttribute('position',new THREE.Float32BufferAttribute(b.pos,3));g.setAttribute('color',new THREE.BufferAttribute(new Uint8Array(b.col),4,true));
      g.setIndex([...b.idx,...b.fine]);g.computeBoundingSphere();g.computeBoundingBox();const mesh=add(new THREE.Mesh(g,flatMat),k);boxed.push(mesh);
      if(b.fine.length)ranged.push({mesh,silhouette:b.idx.length,all:b.idx.length+b.fine.length});}
    stats.groups=buckets.size;stats.fineTriangles=ranged.reduce((n,r)=>n+(r.all-r.silhouette)/3,0);buckets.clear();};
  // Shared-vertex unit box (12 vertices: ground ring, wall-top ring, darker roof ring; no bottom) and icosahedron.
  const box12=own(new THREE.BufferGeometry());
  {const C=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],pos=[],col=[],idx=[];
    for(const [y,sh] of [[0,1],[1,1],[1,.82]])for(const [x,z] of C){pos.push(x,y,z);col.push(sh,sh,sh);}
    for(let i=0;i<4;i++){const j=(i+1)%4;idx.push(i,4+i,j,j,4+i,4+j);}idx.push(8,11,10,8,10,9);
    box12.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));box12.setAttribute('color',new THREE.Float32BufferAttribute(col,3));box12.setIndex(idx);}
  const ico12=own(new THREE.BufferGeometry());
  {const src=new THREE.IcosahedronGeometry(1,0),P=src.attributes.position,map=new Map(),pos=[],idx=[];
    for(let i=0;i<P.count;i++){const k=[P.getX(i),P.getY(i),P.getZ(i)].map(v=>v.toFixed(4)).join(',');let id=map.get(k);if(id===undefined){id=pos.length/3;map.set(k,id);pos.push(P.getX(i),P.getY(i),P.getZ(i));}idx.push(id);}
    ico12.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));ico12.setIndex(idx);src.dispose();}
  const noise=(x,z)=>{let h=Math.imul(Math.round(x*.37)^Math.imul(Math.round(z*.41),0x27d4eb2d),0x165667b1);h^=h>>>13;h=Math.imul(h,0x5bd1e995);return ((h^h>>>15)>>>0)/4294967296;};
  // Ground colour at a vertex: zone tone with ±6% patchiness, rock on steep banks, wet rock/sand on the waterline.
  const ground=(x,z,h,slope,shore,out)=>{
    // The waterline vertex itself is a dark wet/shadow line: the land-to-water contact stays legible from across the bay.
    if(h<=e.water+.3){out.set(WATERLINE);return out;}
    if(shore&&h<1.6)out.set(SHORE);
    // built-up shores (Puerta de Tierra, its port, Isla Grande) end in a concrete quay, not a beach (afternoon:
    // weathered grey, not the pale strip that read white under the fog; the above-water rim darker still).
    if(shore&&['pdt','pdtport','islagrande'].includes(e.zoneAt(x,z))&&slope<=.55){out.set(QUAY);return out;}else if(slope>.55)out.set(ROCK);else{out.set(ZONE[e.zoneAt(x,z)]??ZONE.pdt);
      const port=e.zoneAt(x,z)==='pdtport',k=port?.86+noise(x,z)*.24:.94+noise(x,z)*.12;out.multiplyScalar(k);  // port aprons: patchier asphalt/concrete
      if(['catano','miramar','islagrande','condado'].includes(e.zoneAt(x,z))&&noise(z*1.7,x*1.3)<.35)out.lerp(c2.set('#66804f'),.35);}
    if(slope>.55&&shore)out.set(ROCK);return out;};
  // Near-ground colour as drawn (zone tone, blended into the city's own class colour over the first 14 m past the cut).
  const nearColour=(x,z,h,slope,shore,out)=>{ground(x,z,h,slope,shore,out);
    const cls=x<e.cutX+14?e.cityClassAt(e.cutX,z):-1;
    if(cls>=0&&h>e.water+1e-6&&slope<=.55){c2.set(CITY[cls]??CITY[0]);out.lerp(c2,1-(x-e.cutX)/14);}return out;};

  // ---- Near terrain (4 m grid stitched to the city's 2 m cut column; smooth normals like the city). ----
  {const pos=[],col=[],idx=[],ids=new Map();
    const shoreAt=(x,z)=>{for(const [dx,dz] of [[4,0],[-4,0],[0,4],[0,-4]]){const g=e.groundAt(x+dx,z+dz);if(g!==null&&g<=e.water+1e-6)return true;}return false;};
    const vid=p=>{const key=p[0]+','+p[2];let id=ids.get(key);if(id!==undefined)return id;id=pos.length/3;ids.set(key,id);pos.push(p[0],p[1],p[2]);
      const gx=e.groundAt(p[0]+2,p[2]),gz=e.groundAt(p[0],p[2]+2),slope=Math.max(Math.abs((gx??p[1])-p[1]),Math.abs((gz??p[1])-p[1]))/2;
      nearColour(p[0],p[2],p[1],slope,shoreAt(p[0],p[2]),c);col.push(c.r,c.g,c.b);return id;};
    for(const [a,b,d] of e.nearTriangles)idx.push(vid(a),vid(b),vid(d));
    appendSurface(pos,col,idx);stats.nearTriangles=idx.length/3;}

  // ---- Far terrain (32 m, smooth normals as the near grid, so the seam at x 1536 shades continuously). ----
  {const F=e.far,pos=[],col=[],idx=[],ids=new Map();
    const vid=(i,j)=>{const key=j*F.nx+i;let id=ids.get(key);if(id!==undefined)return id;id=pos.length/3;ids.set(key,id);
      const x=F.x0+i*F.step,z=F.z0+j*F.step,h=x===1600&&(j&1)&&j+1<F.nz?(F.height(i,j-1)+F.height(i,j+1))/2:F.height(i,j);pos.push(x,h,z);
      const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>i+a>=0&&j+b>=0&&i+a<F.nx&&j+b<F.nz?F.height(i+a,j+b):e.water);
      const slope=Math.max(...nb.map(n=>Math.abs(n-h)))/F.step,shore=nb.some(n=>n<=e.water+1e-6);
      ground(x,z,h,slope*1.6,shore,c);col.push(c.r,c.g,c.b);return id;};
    // Far shores on a 64 m lattice, except the 32 m strip x 1536–1600 that meets the near grid; on x = 1600 the odd rows take
    // their neighbours' mean so the two lattices share every edge (no T-junction cracks).
    const ok=(i,j)=>i>=0&&j>=0&&i<F.nx&&j<F.nz&&F.heights[j*F.nx+i]!==-32767,done=new Set();
    for(const cell of e.farCells){const i=cell%F.nx,j=(cell/F.nx)|0;
      const xc=F.x0+i*F.step;if(!(xc>=1536&&xc<1600)){const i0=i&~1,j0=j&~1,k=j0*F.nx+i0;if(done.has(k))continue;done.add(k);
        if(ok(i0,j0)&&ok(i0+2,j0)&&ok(i0,j0+2)&&ok(i0+2,j0+2)){const a=vid(i0,j0),b=vid(i0+2,j0),cc=vid(i0,j0+2),d=vid(i0+2,j0+2);idx.push(a,cc,b,b,cc,d);continue;}}
      const a=vid(i,j),b=vid(i+1,j),cc=vid(i,j+1),d=vid(i+1,j+1);idx.push(a,cc,b,b,cc,d);}
    appendSurface(pos,col,idx);stats.farTriangles=idx.length/3;}

  // ---- Roads beyond the cut: draped ribbons (asphalt + avenue sidewalks), 12 cm proud (merged, no depth offset). The first 12 m
  // take the drawn ground colour under them (the city's tinted road) and blend into the ribbon (no ruler-straight switch
  // at x 1340); sidewalks fade in over the same 12 m; everything fades into the ground along its length. ----
  {const pos=[],col=[],idx=[];
    const strip=(points,inner,outer,colour,fadeFrom,fadeTo)=>{const base=pos.length/3;
      for(let k=0;k<points.length;k++){const a=points[Math.max(0,k-1)],b=points[Math.min(points.length-1,k+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
        const nx=-dz/l,nz=dx/l,s=points[k][0]-e.cutX,f=Math.max(0,Math.min(1,(s-fadeFrom)/(fadeTo-fadeFrom))),t=Math.max(0,Math.min(1,s/12));
        for(const off of [inner,outer]){const x=points[k][0]+nx*off,z=points[k][1]+nz*off,h=e.groundAt(Math.max(e.cutX,x),z)??0;
          pos.push(x,h+.12,z);c.set(colour);ground(x,z,h,0,false,c2);c.lerp(c2,f*f*(3-2*f));
          if(t<1){nearColour(Math.max(e.cutX,x),z,h,0,false,c2);c.lerp(c2,1-t*t*(3-2*t));}col.push(c.r,c.g,c.b);}}
      for(let k=0;k+1<points.length;k++){const a=base+2*k;idx.push(a,a+2,a+1,a+1,a+2,a+3);}};
    for(const r of e.roads){const hw=r.width/2,colour=r.kind==='cycleway'?'#7d7270':r.kind==='footway'?SIDEWALK:ASPHALT;
      strip(r.points,-hw,hw,colour,r.fadeFrom,r.fadeTo);
      if(r.avenue&&r.kind!=='cycleway'){strip(r.points,hw,hw+2.6,SIDEWALK,r.fadeFrom,r.fadeTo);strip(r.points,-hw-2.6,-hw,SIDEWALK,r.fadeFrom,r.fadeTo);}}
    for(let k=0;k<idx.length;k+=3){const [a,b,d]=[idx[k],idx[k+1],idx[k+2]];
      const cross=(pos[3*b+2]-pos[3*a+2])*(pos[3*d]-pos[3*a])-(pos[3*b]-pos[3*a])*(pos[3*d+2]-pos[3*a+2]);if(cross<0){idx[k+1]=d;idx[k+2]=b;}}
    if(idx.length)appendSurface(pos,col,idx);
    stats.roads=e.roads.length;}

  // ---- Instanced unit boxes in two sets: near (closure, trunks, cranes no, masses within SHADOW_X; casts shadows) and far
  // (everything else; no shadow casting). Items: [x,y(bottom),z,w,h,d,ry,colour]. Top faces are slightly darker (roofs).
  const near=[],far=[],fineSet=new Set(),fine=it=>{fineSet.add(it);return it;};
  const put=item=>near.push(item);
  // Facade detail for masses near the cut (plain towers just behind the closure): plinth, a string course
  // per floor, recessed dark window bays, a cornice/parapet; the face turned away from the city (east) is left plain.
  const windows=[];
  for(const m of e.masses){const [x,y,z,w,h,d,ry]=m,colour=e.palette[m[7]],isNear=true;put([x,y,z,w,h,d,ry,colour],isNear);
    if(x>DETAIL_X||x<e.cutX)continue;
    const s=Math.sin(ry),co=Math.cos(ry),top=y+h,ground0=y+.6;
    put(fine([x,top-.12,z,w+.5,.54,d+.5,ry,TRIM]),isNear);put(fine([x,y,z,w+.08,.6+.9,d+.08,ry,PLINTH]),isNear);
    const floors=Math.max(1,Math.floor((h-.6-1.2)/3.2));
    for(const [ax,az,len,sign] of [[1,0,d,1],[1,0,d,-1],[0,1,w,1],[0,1,w,-1]]){
      // Face normal in world (local +x face → (co,−s); local +z face → (s,co)).
      const nx=ax?co*sign:s*sign,nz=ax?-s*sign:co*sign;if(nx>.7)continue;
      const off=(ax?w:d)/2+.02,bays=Math.max(1,Math.floor(len/3.6));
      for(let f=0;f<floors;f++){const fy=ground0+f*3.2;

        for(let b=0;b<bays;b++){const u=(b+.5)*len/bays-len/2,px=x+nx*off+(ax?s:co)*u*(ax?1:1),pz=z+nz*off+(ax?co:-s)*u;
          const tall=f===0?2.3:1.5,wide=f===0?1.6:1.15;
          windows.push([px+nx*.04,fy+(f===0?.1:.8),pz+nz*.04,wide,tall,Math.atan2(nx,nz),GLASS[Math.floor(noise(px*3,pz*3+f)*4)]]);}}}}
  stats.masses=e.masses.length;stats.windows=windows.length;
  for(const t of e.trees)if(t[4])near.push(fine([t[0],t[1]-.3,t[2],.32,2.9,.32,0,'#6f5c45']));
  // Gantry cranes (inferred): four legs, sill and portal beams, the boom over the water and the machinery house.
  for(const k of e.cranes){const s=Math.sin(k.ry),co=Math.cos(k.ry),P=(u,v)=>[k.x+u*co+v*s,k.z-u*s+v*co],red='#b8432f',pale='#d9d6cc';
    for(const [u,v] of [[-9,-6],[9,-6],[-9,6],[9,6]]){const [x,z]=P(u,v);far.push([x,k.y-.3,z,1.2,30,1.2,k.ry,red]);}
    for(const v of [-6,6]){const [x,z]=P(0,v);far.push([x,k.y+28,z,19.2,2,1.4,k.ry,red]);}
    {const [x,z]=P(0,0);far.push([x,k.y+30,z,2.2,2.2,66,k.ry,pale]);far.push([x,k.y+32.2,z,8,5,9,k.ry,pale]);}
    {const [x,z]=P(0,-30);far.push([x,k.y+31,z,1.6,7,1.6,k.ry,red]);}}
  for(const k of e.cranes){const s=Math.sin(k.ry),co=Math.cos(k.ry),x=k.x+40*co,z=k.z-40*s;far.push([x,k.y-.5,z,30,11,60,k.ry,'#c7c3b6']);}
  // Closure: plain site hoarding. Boards (lo − 0.3 m, buried, to the board line), a post at every panel joint through the
  // full height, a rail at the board line and on top; netting is the separate alpha-tested mesh below. Everything stays
  // inside the collider slab (x ± half) and between its bottom and top.
  const cl=e.closure,F=cl.fence;
  // the netting sheets lie exactly on the collider faces (x ± half), so posts and
  // rails, which crossed those planes, stand 2 cm proud of them (TP); boards stay 1 cm inside.
  const T=2*F.half,TP=T+.04;
  for(const p of cl.panels){if(p.hidden)continue;const len=p.z1-p.z0,zc=p.zc,tone=BOARD[Math.round(zc/2.5)&1];
    near.push(fine([cl.x,p.lo-.3,zc,T-.02,p.boards-(p.lo-.3),len-.02,0,tone]));
    near.push(fine([cl.x,p.lo-.3,p.z0+.05,TP,p.top-(p.lo-.3),.1,0,POST]));
    near.push(fine([cl.x,p.boards-.05,zc,TP,.1,len,0,POST]));near.push(fine([cl.x,p.top-.08,zc,TP,.08,len,0,POST]));}
  {const last=cl.panels.filter(p=>!p.hidden).at(-1);if(last)near.push(fine([cl.x,last.lo-.3,last.z1-.05,TP,last.top-(last.lo-.3),.1,0,POST]));}
  stats.panels=cl.panels.filter(p=>!p.hidden).length;
  const placeBox=([x,y,z,w,h,dd,ry,colour],d,col)=>{d.position.set(x,y,z);d.rotation.set(0,ry,0);d.scale.set(w,h,dd);col.set(colour);};
  // Advance stands: the weighted base reaches 3 cm under the lowest ground of its footprint.
  for(const k of e.closure.advance??[]){let lo=Infinity;for(const [a,b] of [[-.275,-.35],[.275,-.35],[-.275,.35],[.275,.35],[0,0]])lo=Math.min(lo,height(k.x+a,k.z+b));lo=Math.min(lo,k.y)-.03;
    near.push(fine([k.x,k.y,k.z,.1,1.95,.1,0,POST]),fine([k.x,lo,k.z,.55,k.y+.08-lo,.7,0,'#3d4240']));}
  appendInstances(box12,[...near,...far],placeBox,it=>fineSet.has(it));
  // Windows: single quads on their facade (no hidden faces).
  const pane=own(new THREE.PlaneGeometry(1,1));pane.translate(0,.5,0);pane.deleteAttribute('uv');pane.deleteAttribute('normal');
  appendInstances(pane,windows,([x,y,z,w,h,ry,colour],d,col)=>{d.position.set(x,y,z);d.rotation.set(0,ry,0);d.scale.set(w,h,1);col.set(colour);},true);
  stats.boxes=near.length+far.length;stats.windows=windows.length;

  // ---- Tree crowns (instanced low-poly lobes): round, wide flat (flamboyán-like) and columnar canopies. ----
  const oct6=own(new THREE.OctahedronGeometry(1,0));{const P=oct6.attributes.position,map=new Map(),pos=[],idx=[];
    for(let i=0;i<P.count;i++){const k=[P.getX(i),P.getY(i),P.getZ(i)].map(v=>v.toFixed(4)).join(',');let id=map.get(k);if(id===undefined){id=pos.length/3;map.set(k,id);pos.push(P.getX(i),P.getY(i),P.getZ(i));}idx.push(id);}
    oct6.deleteAttribute('normal');oct6.deleteAttribute('uv');oct6.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));oct6.setIndex(idx);}
  // Far canopy (beyond the continuation, only seen across water): 8-triangle octahedra.
  appendInstances(oct6,e.trees.filter(t=>!t[4]),([x,y,z,r],d,col)=>{d.position.set(x,y+r*.5,z);d.rotation.set(0,noise(x,z)*6.28,0);d.scale.set(r,r*.7,r);
    col.set(['#4f7a4e','#5b8752','#466f47','#68905a'][Math.floor(noise(z,x)*4)]);});
  {appendInstances(ico12,e.trees.filter(t=>t[4]),([x,y,z,r,trunk,kind=0],d,col)=>{   // 20 triangles per near crown
      const sx=kind===1?r*1.45:kind===2?r*.62:r,sy=kind===1?r*.42:kind===2?r*1.35:r*(trunk?.78:.7);
      d.position.set(x,y+(trunk?2.6+sy*.85:sy*.75),z);d.rotation.set(0,noise(x,z)*6.28,0);d.scale.set(sx,sy,sx);
      col.set(kind===1?['#56794a','#4d7146'][Math.floor(noise(z,x)*2)]:['#4f7a4e','#5b8752','#466f47','#68905a'][Math.floor(noise(z,x)*4)]);});
    stats.trees=e.trees.length;}

  // ---- Debris netting above the boards (alpha-tested 64 px weave, one tile per 0.5 m), to the panel top (= collider). ----
  {const tx=netTexture(textures);const plane=own(new THREE.PlaneGeometry(1,1));plane.rotateY(Math.PI/2);plane.translate(0,.5,0);
    const list=cl.panels.filter(p=>!p.hidden),m=mat({color:NET,map:tx,alphaTest:.4,side:THREE.DoubleSide,roughness:.9,metalness:0});
    // One sheet on each face of the framing (the collider's faces).
    const mesh=new THREE.InstancedMesh(plane,m,list.length*2),d=new THREE.Object3D();tx.repeat.set(5,2);
    list.forEach((p,i)=>{for(const k of [0,1]){d.position.set(cl.x+(k?1:-1)*cl.fence.half,p.boards,p.zc);d.scale.set(1,p.top-p.boards,p.z1-p.z0);d.updateMatrix();mesh.setMatrixAt(2*i+k,d.matrix);}});
    mesh.computeBoundingSphere();netting=add(mesh,'netting');}

  // ---- Barrier rows: water-filled road barriers (generic red/white plastic profile). ----
  {const B=cl.barrier,shape=new THREE.Shape();
    shape.moveTo(-B.half,0);shape.lineTo(B.half,0);shape.lineTo(B.half*.72,.18);shape.lineTo(B.half*.42,B.height);shape.lineTo(-B.half*.42,B.height);shape.lineTo(-B.half*.72,.18);shape.lineTo(-B.half,0);
    const g=own(new THREE.ExtrudeGeometry(shape,{depth:B.length-.06,bevelEnabled:false}));g.translate(0,0,-(B.length-.06)/2);
    g.deleteAttribute('uv');g.deleteAttribute('normal');
    // a water-filled barrier rests on the lawn — pitched along its length to the ground at its two ends
    // and lowered until every corner of its foot is ≥ 2 cm in the ground (it was set at the centre height).
    const L=B.length-.06,seatB=b=>{const ga=height(b.x,b.z-L/2),gb=height(b.x,b.z+L/2),k=(gb-ga)/L,ym=(ga+gb)/2;let d=Infinity;
      for(const u of [-B.half,0,B.half])for(const v of [-L/2,0,L/2])d=Math.min(d,height(b.x+u,b.z+v)-(ym+k*v));return {y:ym+Math.min(0,d)-.02,pitch:-Math.atan(k)};};
    appendInstances(g,cl.barriers,(b,d,col)=>{const q=seatB(b);d.position.set(b.x,q.y,b.z);d.rotation.set(q.pitch,0,0);d.scale.set(1,1,1);col.set(b.red?'#c4352c':'#eeece6');},true);
    stats.barriers=cl.barriers.length;}

  // ---- Signs: a generic "no entry" roundel (red disc, white bar, grey back) on the hoarding at each carriageway. ----
  {const parts=[];const paint=(g,colour)=>{c.set(colour);const a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));};
    const disc=(r,x,colour)=>{const g=new THREE.CircleGeometry(r,24);g.rotateY(-Math.PI/2);g.translate(x,0,0);paint(g,colour);parts.push(g);};
    disc(.32,0,'#f2f0ea');disc(.29,-.004,'#c4352c');
    {const bar=new THREE.PlaneGeometry(.4,.09);bar.rotateY(-Math.PI/2);bar.translate(-.008,0,0);paint(bar,'#f6f5f0');parts.push(bar);}
    {const back=new THREE.CircleGeometry(.32,24);back.rotateY(Math.PI/2);back.translate(.004,0,0);paint(back,'#7d8482');parts.push(back);}
    const merged=own(mergeColoured(parts));for(const p of parts)p.dispose();
    appendInstances(merged,cl.signs,(s,d,col)=>{d.position.set(s.x-.02,s.y+1.55,s.z);d.rotation.set(0,0,0);d.scale.set(1,1,1);col.set('#ffffff');},true);
    stats.signs=cl.signs.length;}

  // ---- Advance warning signs: warning triangle over a white "closed" plate, facing the approach (−x). ----
  if(cl.advance?.length){const parts=[],paint=(g,colour)=>{c.set(colour);const a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));if(g.attributes.uv)g.deleteAttribute('uv');if(g.attributes.normal)g.deleteAttribute('normal');};
    const tri=(r,y,dx,colour,back=false)=>{const sh=new THREE.Shape();for(let k=0;k<3;k++){const a=Math.PI/2+k*2*Math.PI/3;k?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
      const g=new THREE.ShapeGeometry(sh);g.rotateY(back?Math.PI/2:-Math.PI/2);g.translate(dx,y,0);paint(g,colour);parts.push(g);};
    const rect=(w,h,y,dx,colour,back=false)=>{const g=new THREE.PlaneGeometry(w,h);g.rotateY(back?Math.PI/2:-Math.PI/2);g.translate(dx,y,0);paint(g,colour);parts.push(g);};
    tri(.42,2.2,-.04,'#c4352c');tri(.3,2.18,-.045,'#f4f2ec');tri(.42,2.2,-.02,'#7d8482',true);rect(.07,.22,2.2,-.05,'#1d1f1e');rect(.04,.04,2.05,-.05,'#1d1f1e');
    rect(.8,.32,1.6,-.04,'#f4f2ec');rect(.62,.09,1.6,-.045,'#c4352c');rect(.8,.32,1.6,-.02,'#7d8482',true);
    const merged=own(mergeColoured(parts));for(const g of parts)g.dispose();
    appendInstances(merged,cl.advance,(k,d,col)=>{d.position.set(k.x,k.y,k.z);d.rotation.set(0,0,0);d.scale.set(1,1,1);col.set('#ffffff');},true);
    stats.advance=cl.advance.length;}
  // Draw-range LOD: a camera more than FINE_FAR from a group's bounding sphere draws only
  // its silhouette prefix (ground, roads, mass bodies, crowns, far shores); the near-only detail (windows, trim, closure
  // kit, signs) is the index tail. Same meshes, same buffers, no extra draws; an updater flagged isLOD (sj-fabric.js
  // pattern), added before the groups, runs first in each pass. Orthographic (sun) cameras are ignored.
  // The same updater also culls each group by its exact bounding box: the far shores are flat slabs 3–5 km wide whose
  // bounding spheres passed the view frustum from most of the old town while none of their triangles were in view.
  const boxed=[];
  {const cull=new THREE.Object3D(),eye=new THREE.Vector3(),fr=new THREE.Frustum(),pm=new THREE.Matrix4();cull.name='sj-worldedge-lod';cull.isLOD=true;cull.autoUpdate=true;
    cull.update=camera=>{if(!camera.isPerspectiveCamera)return;camera.updateMatrixWorld();eye.setFromMatrixPosition(camera.matrixWorld);
      fr.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth);  // the renderer's own convention
      for(const m of boxed)m.visible=fr.intersectsBox(m.geometry.boundingBox);
      for(const r of ranged){const s=r.mesh.geometry.boundingSphere,far=eye.distanceTo(s.center)-s.radius>FINE_FAR;r.mesh.geometry.setDrawRange(0,far?r.silhouette:Infinity);}
      // The debris netting is closure detail too: hidden as a whole beyond FINE_FAR.
      if(netting){const s=netting.boundingSphere;netting.visible=eye.distanceTo(s.center)-s.radius<=FINE_FAR&&fr.intersectsSphere(s);}};
    scene.add(cull);meshes.push(cull);}
  emitBuckets();

  // ---- Sky: camera-centred dome (r 4400 m, inside the 5000 m far plane) drawn first without depth. Horizon = the fog
  // colour so fogged land and sea melt into it; a pale haze band just above; bluer overhead. (the distant
  // ridge / far-shore band painted on the dome was removed — a camera-centred band cannot be grounded and floated above
  // the haze from high cameras; the real DEM shores carry the far view.) ----
  const fogColour=scene.fog?.color?.clone?.()??new THREE.Color('#a7cbd0');
  {const R=4400,el=[-90,-6,0,.6,1.7,4,9,17,30,50,70,90].map(d=>d*Math.PI/180);  // rows packed at the horizon, 24 segments
    const g=new THREE.LatheGeometry(el.map(a=>new THREE.Vector2(Math.max(1e-3,Math.cos(a)*R),Math.sin(a)*R)),24),p=g.attributes.position,col=new Float32Array(p.count*3);
    const hz=fogColour.clone(),haze=new THREE.Color('#bfd8da'),mid=new THREE.Color('#9dc6dc'),top=new THREE.Color('#84b5d6');
    for(let i=0;i<p.count;i++){const y=p.getY(i)/R;
      if(y<=0)c.copy(hz);else if(y<.03)c.copy(hz).lerp(haze,y/.03);else if(y<.3)c.copy(haze).lerp(mid,(y-.03)/.27);else c.copy(mid).lerp(top,Math.min(1,(y-.3)/.5));
      col.set([c.r,c.g,c.b],3*i);}
    g.setAttribute('color',new THREE.BufferAttribute(col,3));g.deleteAttribute('normal');g.deleteAttribute('uv');
    const dome=own(mergeColoured([g]));g.dispose();
    const m=new THREE.MeshBasicNodeMaterial({vertexColors:true,fog:false,depthWrite:false,side:THREE.DoubleSide});
    m.positionNode=positionLocal.add(cameraPosition);extraMaterials.push(m);
    const mesh=new THREE.Mesh(dome,m);mesh.frustumCulled=false;mesh.renderOrder=-1000;add(mesh,'sky');mesh.receiveShadow=false;}

  // ---- Fog range (GLOBAL change, see FOG) and the sea's horizon blend (the only change to the sea: an output hook;
  // coast owns its look). ----
  if(scene.fog?.isFog){scene.fog.near=FOG.near;scene.fog.far=FOG.far;}
  // The sea may be built by a later area (coast registers after worldedge): patch it once, on the sky's first frame.
  const hazeColour=uniform(fogColour);
  const patchSea=()=>{const sea=scene.children?.find(m=>m.userData?.sea)??scene.children?.find(m=>m.isMesh&&m.geometry?.parameters?.width>=5000);
    if(!sea||sea.userData.worldedgeHorizon)return !!sea;
    let m=sea.material;
    if(!m.isNodeMaterial){const n=new THREE.MeshStandardNodeMaterial();for(const key in m)if(key!=='uuid')n[key]=m[key];m=n;}
    const base=m.setupOutput;
    // Within ~2.6° of the horizon the sea turns toward the haze (up to 85%), and fully before the fog end.
    m.setupOutput=function(builder,out){const d=positionWorld.sub(cameraPosition),dist=d.length().max(1);
      const dip=cameraPosition.y.sub(positionWorld.y).div(dist);
      const f=max(float(1).sub(smoothstep(0,.045,dip)).mul(.85),smoothstep(2400,4300,dist));
      return base.call(this,builder,vec4(mix(out.rgb,hazeColour,f),out.a));};
    m.needsUpdate=true;if(m!==sea.material){extraMaterials.push(m);sea.material=m;}sea.userData.worldedgeHorizon=true;return true;};
  stats.seaHorizon=patchSea()&&!!scene.children?.find(m=>m.userData?.sea);
  {const sky=meshes.find(m=>m.name==='sj-worldedge-sky');if(sky){let done=false;sky.onBeforeRender=()=>{if(!done)done=patchSea()&&!!scene.children?.find(m=>m.userData?.sea);};}}
  const sky=meshes.find(m=>m.name==='sj-worldedge-sky');if(sky)sky.dispose=()=>{for(const m of extraMaterials)m.dispose();};
  return stats;
}

// Merge geometries that all carry position + color; normals recomputed.
function mergeColoured(parts) {
  const pos=[],col=[],idx=[];let base=0;
  for(const g of parts){const p=g.attributes.position,c=g.attributes.color;
    for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));col.push(c.getX(i),c.getY(i),c.getZ(i));}
    if(g.index)for(let i=0;i<g.index.count;i++)idx.push(base+g.index.getX(i));else for(let i=0;i<p.count;i++)idx.push(base+i);
    base+=p.count;}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  out.setIndex(idx);out.computeVertexNormals();out.computeBoundingSphere();return out;
}

// Debris-netting weave: dense horizontal and vertical strands on transparent, 64 px.
function netTexture(textures) {
  const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');x.clearRect(0,0,64,64);
  x.fillStyle='rgba(255,255,255,1)';for(let k=0;k<64;k+=8){x.fillRect(0,k,64,4);x.fillRect(k,0,3,64);}
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;textures.add(t);return t;
}
