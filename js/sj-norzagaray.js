/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Calle Norzagaray / north city wall / Plaza del Quinto Centenario visuals — © 2026 VibezZzCoder, MIT.
// Wikimedia Commons curid=80155724 (dark rubble wall with pale joints, broad sloping top, grass behind, La Perla below), curid=109811940 (lawn over the wall,
// La Perla), curid=109811944 (slab sidewalk, lantern posts, grass bank), curid=38237168 (Quinto Centenario: splash pad, stair, balustrades,
// white-cup lamps, green handrails, Tótem). All dimensions come from sj-norzagaray-layout.js, which owns the matching
// solids, tops and cuts.
import * as THREE from 'three/webgpu';
import {surfaceBuffer} from './sj-gate.js';

const IRON='#1f2523',TURF='#7e9866',TOP='#a59d8b',STONE='#d5cdbb',RAIL='#e6e0d2',HANDRAIL='#2e4a3c';

function seeded(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
// Wikimedia Commons curid=80155724: dark grey-brown rubble of irregular, interlocking stones in many sizes, narrow pale lime joints, broad green/
// ochre weathering. (the first version's rows of rounded rectangles read as tiled brick.)
export function rubbleTexture(textures) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),random=seeded(90217);
  ctx.fillStyle='#a9a191';ctx.fillRect(0,0,256,256);
  const palette=[[88,86,77],[100,96,85],[80,80,73],[110,102,87],[94,92,83],[118,110,95],[72,74,68]];
  // Jittered cells of varied size; each stone an irregular polygon inset ~1.5 px, wrapping across the tile edges.
  const stone=(cx,cy,w,h)=>{const c=palette[Math.floor(random()*palette.length)],v=Math.floor(random()*14)-7,n=6+Math.floor(random()*3);
    ctx.fillStyle=`rgb(${c[0]+v},${c[1]+v},${c[2]+v})`;
    for(const [ox,oy] of [[0,0],[256,0],[-256,0],[0,256],[0,-256]]){ctx.beginPath();
      for(let k=0;k<n;k++){const a=(k+random()*.6)/n*Math.PI*2,rx=w/2*(.78+random()*.22),ry=h/2*(.78+random()*.22);
        const x=cx+ox+Math.cos(a)*rx,y=cy+oy+Math.sin(a)*ry;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.closePath();ctx.fill();}};
  for(let y=0;y<256;){const rowH=12+Math.floor(random()*22);
    for(let x=-Math.floor(random()*30);x<256;){const w=14+Math.floor(random()*40),h=rowH*(.8+random()*.5);
      stone(x+w/2,y+rowH/2+(random()-.5)*4,w,h);x+=w*(.86+random()*.1);}
    y+=rowH*(.82+random()*.12);}
  for(let i=0;i<40;i++){const g=random()<.5;ctx.fillStyle=g?`rgba(68,84,52,${.08+random()*.1})`:`rgba(150,112,62,${.06+random()*.09})`;
    ctx.beginPath();ctx.ellipse(random()*256,random()*256,16+random()*50,10+random()*36,random()*3,0,Math.PI*2);ctx.fill();}
  for(let i=0;i<18;i++){ctx.fillStyle=`rgba(40,42,36,${.05+random()*.07})`;ctx.fillRect(random()*256,random()*80,2+random()*5,80+random()*160);}
  for(let i=0;i<10000;i++){ctx.fillStyle=random()<.5?'rgba(20,20,16,.08)':'rgba(240,236,224,.05)';ctx.fillRect(random()*256,random()*256,1+random(),1+random());}
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.anisotropy=4;
  textures.add(tx);return tx;
}

// Fitted wall intervals and run ends (shared by every sj-city-wall area): battered face, outward-sloping broad top,
// inner face, grass walk (= its replacement tops) and inner edge. Wikimedia Commons curid=80155724 tones.
// safe: per-half winding at warped collapsed-corner quads (surfaceBuffer.quadSafe); Norzagaray keeps quad.
export function drawWallRuns(walls,ends,{rubble,turf,height,PARAPET,SC,safe=false}){
  const Q=safe?'quadSafe':'quad';
  const up=[0,1,0],W=(s,key,y)=>[s[key][0],y,s[key][1]];
  // Wikimedia Commons curid=80155724: near-black green-grey stone, ochre/brown stains in broad patches, lighter top course.
  const tone=s=>{const k=.9+.1*Math.sin(s.s*.19)*Math.sin(s.s*.053+.7),warm=Math.max(0,Math.sin(s.s*.029+1.1))**3,green=Math.max(0,Math.sin(s.s*.041+3.2))**4;
    const col=new THREE.Color('#d8d3c6').lerp(new THREE.Color('#d9b884'),warm*.55).lerp(new THREE.Color('#a8b48c'),green*.45).multiplyScalar(k);
    return [col.clone().multiplyScalar(.8),col];};

  // ---- Wall runs: battered face, outward-sloping broad top, inner face, grass walk (= its replacement tops), inner edge. ----
  for(const {a,b} of walls){const nO=[a.nx,0,a.nz],nI=[-a.nx,0,-a.nz],[ab,at]=tone(a),[bb,bt]=tone(b);
    const oa=a.walk+PARAPET.riseOut,ob=b.walk+PARAPET.riseOut,ia=a.walk+PARAPET.riseIn,ib=b.walk+PARAPET.riseIn;
    rubble[Q](W(a,'B',a.bottom),W(b,'B',b.bottom),W(b,'T',b.crest),W(a,'T',a.crest),[ab,bb,bt,at],nO,SC);
    rubble[Q](W(a,'T',a.crest),W(b,'T',b.crest),W(b,'T',ob),W(a,'T',oa),[at,bt,bt,at],nO,SC);
    rubble[Q](W(a,'T',oa),W(b,'T',ob),W(b,'Q',ib),W(a,'Q',ia),TOP,[nO[0]*.25,1,nO[2]*.25],1.6);
    rubble[Q](W(a,'Q',ia),W(b,'Q',ib),W(b,'Q',b.walk),W(a,'Q',a.walk),'#9a9282',nI,2.4);
    turf[Q](W(a,'Q',a.walk),W(b,'Q',b.walk),W(b,'W',b.walk),W(a,'W',a.walk),TURF,up);
    // Inner edge: a turf lip where the bank meets the walk; where the smeared DEM leaves the terreplein lower (bastion
    // interiors) the rampart shows a masonry retaining face, as real terrepleins do.
    const drop=Math.max(a.walk-height(...a.W),b.walk-height(...b.W));
    (drop>.35?rubble:turf)[Q](W(a,'W',a.walk),W(b,'W',b.walk),W(b,'W',b.kerb),W(a,'W',a.kerb),drop>.35?'#a39b8b':'#7b9462',nI,2.4);}
  // Run ends: masonry end faces through the whole section (open run ends, block sides and returns).
  for(const {s,dir} of ends){const t=[dir*s.nz,0,-dir*s.nx];
    rubble[Q](W(s,'B',s.bottom),W(s,'W',s.bottom),W(s,'W',s.walk),W(s,'T',s.walk),'#cfc8b8',t,SC);
    rubble[Q](W(s,'T',s.walk),W(s,'Q',s.walk),W(s,'Q',s.walk+PARAPET.riseIn),W(s,'T',s.walk+PARAPET.riseOut),'#cfc8b8',t,SC);}
}

export function buildNorzagaray(n,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}) {
  const {PARAPET,PASSAGE,STAIR}=n.constants,rubble=surfaceBuffer(),turf=surfaceBuffer(),up=[0,1,0];
  const W=(s,key,y)=>[s[key][0],y,s[key][1]],SC=4.2; // rubble texture: one tile per 4.2 m
  // Cylinder between two points (bake maps local +Y to Ry·Rz·Y: rz = acos(dy), ry = atan2(dz,−dx)).
  const seg=(a,b,r,colour,kind='solid')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-6)return;
    const rz=Math.acos(Math.max(-1,Math.min(1,dy/l))),ry=Math.hypot(dx,dz)>1e-9?Math.atan2(dz,-dx):0;
    bake(cylinder,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,l,r,colour,ry,kind,rz);};
  drawWallRuns(n.walls,n.ends,{rubble,turf,height,PARAPET,SC});

  // ---- Bajada Matadero sally port: block + curtain shoulder, arched bore, vault, voussoirs, walled inner lane. ----
  const ps=n.passage,{ax,az,px,pz}=ps.frame,O=ps.frame.origin,half=ps.half,{R,cy}=ps.arch;
  const P3=(u,v,y)=>[O[0]+ax*u+px*v,y,O[1]+az*u+pz*v],A3=(u,v,y)=>P3(u,ps.cAt(u)+v,y);
  const out=[-ax,0,-az],inward=[ax,0,az],sideN=s=>[s*px,0,s*pz];
  const arch=v=>cy+Math.sqrt(Math.max(0,R*R-v*v));            // above the local floor
  const N=10,vs=Array.from({length:N+1},(_,i)=>-half+2*half*i/N),blockColour=['#cfc8b8','#d6cebd'];
  const slabFace=(u,v0,v1,y0,y1,nrm)=>rubble.quad(P3(u,v0,y0),P3(u,v1,y0),P3(u,v1,y1),P3(u,v0,y1),blockColour,nrm,SC);
  for(const [u,nrm,floor] of [[ps.uFront,out,ps.outerY],[ps.uBack,inward,ps.innerY]]){
    // Piers either side, the spandrel strip from the arch to the top, then the voussoir ring (6 cm proud, closed edges).
    slabFace(u,ps.vMin,-half,ps.blockBottom,ps.blockTop,nrm);slabFace(u,half,ps.vPier,ps.blockBottom,ps.blockTop,nrm);
    slabFace(u,ps.vPier,ps.vMax,ps.shoulderBottom,ps.shoulderTop,nrm);
    for(let i=0;i<N;i++)rubble.quad(P3(u,vs[i],floor+arch(vs[i])),P3(u,vs[i+1],floor+arch(vs[i+1])),P3(u,vs[i+1],ps.blockTop),P3(u,vs[i],ps.blockTop),blockColour,nrm,SC);
    const sgn=nrm===out?-1:1,uf=u+sgn*.06,a0=Math.asin(Math.min(1,half/R)),ring=(r,k)=>{const ang=Math.PI/2+a0-(2*a0)*(k/9);return [Math.cos(ang)*r,cy+Math.sin(ang)*r];};
    for(let k=0;k<9;k++){const key=k===4?.14:0,i0=ring(R,k),i1=ring(R,k+1),o0=ring(R+.42+key,k),o1=ring(R+.42+key,k+1),c=k%2?'#c9c0aa':'#bdb39c';
      const Y=([vv,yy],uu)=>P3(uu,vv,floor+yy);
      rubble.quad(Y(i0,uf),Y(o0,uf),Y(o1,uf),Y(i1,uf),c,nrm,1.2);
      const om=[(o0[0]+o1[0])/2,(o0[1]+o1[1])/2-cy],im=[(i0[0]+i1[0])/2,(i0[1]+i1[1])/2-cy];
      rubble.quad(Y(o0,uf),Y(o1,uf),Y(o1,u),Y(o0,u),c,[om[0]*px,om[1],om[0]*pz],1.2);
      rubble.quad(Y(i0,uf),Y(i1,uf),Y(i1,u),Y(i0,u),c,[-im[0]*px,-im[1],-im[0]*pz],1.2);
      if(key)for(const [p,q] of [[i0,o0],[i1,o1]])rubble.quad(Y(p,uf),Y(q,uf),Y(q,u),Y(p,u),c,p===i0?[-px,0,-pz]:[px,0,pz],1.2);}}
  // Block and shoulder sides, the step between them (the curtain's end standing on the block), tops with parapets.
  rubble.quad(P3(ps.uFront,ps.vMin,ps.blockBottom),P3(ps.uBack,ps.vMin,ps.blockBottom),P3(ps.uBack,ps.vMin,ps.blockTop),P3(ps.uFront,ps.vMin,ps.blockTop),blockColour,sideN(-1),SC);
  rubble.quad(P3(ps.uFront,ps.vMax,ps.shoulderBottom),P3(ps.uBack,ps.vMax,ps.shoulderBottom),P3(ps.uBack,ps.vMax,ps.shoulderTop),P3(ps.uFront,ps.vMax,ps.shoulderTop),blockColour,sideN(1),SC);
  rubble.quad(P3(ps.uFront,ps.vPier,ps.blockTop),P3(ps.uBack,ps.vPier,ps.blockTop),P3(ps.uBack,ps.vPier,ps.shoulderTop),P3(ps.uFront,ps.vPier,ps.shoulderTop),blockColour,sideN(-1),SC);
  for(const [v0,v1,t] of [[ps.vMin,ps.vPier,ps.blockTop],[ps.vPier,ps.vMax,ps.shoulderTop]]){const u0=ps.uFront,u1=ps.uFront+PARAPET.thick;
    rubble.quad(P3(u0,v0,t),P3(u0,v1,t),P3(u0,v1,t+PARAPET.riseOut),P3(u0,v0,t+PARAPET.riseOut),blockColour,out,SC);
    rubble.quad(P3(u0,v0,t+PARAPET.riseOut),P3(u0,v1,t+PARAPET.riseOut),P3(u1,v1,t+PARAPET.riseIn),P3(u1,v0,t+PARAPET.riseIn),TOP,[out[0]*.25,1,out[2]*.25],1.6);
    rubble.quad(P3(u1,v0,t+PARAPET.riseIn),P3(u1,v1,t+PARAPET.riseIn),P3(u1,v1,t),P3(u1,v0,t),'#9a9282',inward,2.4);
    for(const [v,sg] of [[v0,-1],[v1,1]])rubble.quad(P3(u0,v,t),P3(u1,v,t),P3(u1,v,t+PARAPET.riseIn),P3(u0,v,t+PARAPET.riseOut),'#cfc8b8',sideN(sg),SC);
    turf.quad(P3(u1,v0,t),P3(ps.uBack,v0,t),P3(ps.uBack,v1,t),P3(u1,v1,t),TURF,up);}
  // Passage walls and vault (the floor is the layout's replacement-floor geometry).
  for(const s of [-1,1])rubble.quad(P3(ps.uFront,s*half,ps.outerY-.05),P3(ps.uBack,s*half,ps.innerY-.05),P3(ps.uBack,s*half,ps.innerY+PASSAGE.spring),P3(ps.uFront,s*half,ps.outerY+PASSAGE.spring),'#aaa291',sideN(-s),2.0);
  for(let i=0;i<N;i++){const vm=(vs[i]+vs[i+1])/2;
    rubble.quad(P3(ps.uFront,vs[i],ps.outerY+arch(vs[i])),P3(ps.uBack,vs[i],ps.innerY+arch(vs[i])),P3(ps.uBack,vs[i+1],ps.innerY+arch(vs[i+1])),P3(ps.uFront,vs[i+1],ps.outerY+arch(vs[i+1])),'#9d9585',[vm*px,-(arch(vm)-cy),vm*pz],2.0);}
  // Skirts under the outer floor's edges where the kept ground is level with it (render only); kerbs where it is higher.
  for(const k of ps.skirts){const v=k.side*(half+.03),e=u=>{const [x,,z]=P3(u,v,0);return [x,ps.floorAt(u),z];};
    const a=e(k.u0-.03),b=e(k.u1);rubble.quad(a,b,[b[0],b[1]-.5,b[2]],[a[0],a[1]-.5,a[2]],'#8e8a80',sideN(k.side),2.4);}
  for(const k of ps.kerbs){const v0=k.side<0?-half-.45:half,v1=k.side<0?-half:half+.45,vi=k.side<0?-half:half;
    rubble.quad(P3(k.u0,vi,k.bottom),P3(k.u1,vi,k.bottom),P3(k.u1,vi,k.top),P3(k.u0,vi,k.top),'#c4bcab',sideN(-k.side),2.4);
    rubble.quad(P3(k.u0,v0,k.top),P3(k.u1,v0,k.top),P3(k.u1,v1,k.top),P3(k.u0,v1,k.top),TOP,up,1.6);}
  // Inner lane (replaced the smeared V trench): retaining walls on both sides with a pale coping.
  for(const w of ps.laneWalls){const s=w.side,vi=s*half,vo=s*(half+.45);
    rubble.quad(A3(w.u0,vi,w.bottom),A3(w.u1,vi,w.bottom),A3(w.u1,vi,w.t1),A3(w.u0,vi,w.t0),'#bdb5a3',sideN(-s),SC);
    rubble.quad(A3(w.u0,vi,w.t0),A3(w.u1,vi,w.t1),A3(w.u1,vo,w.t1),A3(w.u0,vo,w.t0),TOP,up,1.6);
    rubble.quad(A3(w.u0,vo,w.t0),A3(w.u1,vo,w.t1),A3(w.u1,vo,w.bottom),A3(w.u0,vo,w.bottom),'#bdb5a3',sideN(s),SC);}
  {const last=ps.laneWalls.filter(w=>w.u1===ps.laneWalls.at(-1).u1);
    for(const w of last){const s=w.side;rubble.quad(A3(w.u1,s*half,w.bottom),A3(w.u1,s*(half+.45),w.bottom),A3(w.u1,s*(half+.45),w.t1),A3(w.u1,s*half,w.t1),'#bdb5a3',inward,SC);}}

  // ---- Norzagaray lanterns (Wikimedia Commons curid=109811944): widened dark foot, slender post, collar, framed lantern, pyramid cap, finial. ----
  const capG=own(new THREE.ConeGeometry(.17,.16,4));capG.rotateY(Math.PI/4);
  const lantern=(x,y,z,s=1)=>{bake(box,x,y+.03*s,z,.22*s,.06*s,.22*s,IRON,0,'solid');bake(box,x,y+.25*s,z,.2*s,.38*s,.2*s,'#e9d9a2',0,'solid');
    for(const [dx,dz] of [[-1,-1],[1,-1],[1,1],[-1,1]])bake(box,x+dx*.1*s,y+.25*s,z+dz*.1*s,.025*s,.4*s,.025*s,IRON,0,'solid');
    bake(capG,x,y+.52*s,z,s,s,s,IRON,0,'solid');bake(sphere,x,y+.63*s,z,.035*s,.05*s,.035*s,IRON,0,'solid');};
  for(const {x,y,z,foot} of n.lamps){const f=Number.isFinite(foot)?Math.min(y-.05,foot):y-.05; // seated foot (sj-street-kit seatKitLamps)
    bake(cylinder,x,f<y-.05?(f+y+.45)/2:y+.2,z,.15,f<y-.05?y+.45-f:.5,.15,IRON,0,'solid');bake(cylinder,x,y+.5,z,.1,.12,.1,IRON,0,'solid');
    bake(cylinder,x,y+2.05,z,.055,3.0,.055,IRON,0,'solid');bake(cylinder,x,y+3.58,z,.08,.08,.08,IRON,0,'solid');lantern(x,y+3.6,z);}

  // ---- Las Ánimas flight (public stairs ride up and down): treads and cheeks from the layout. ----
  if(n.animas){const an=n.animas,[ux,uz]=an.axis,ry=Math.atan2(-uz,ux),C=r=>[(r[0][0]+r[2][0])/2,(r[0][1]+r[2][1])/2];
    an.steps.forEach((st,k)=>{const [x,z]=C(st.ring);bake(box,x,(st.bottom+st.top)/2,z,st.s1-st.s0,st.top-st.bottom,2*an.half,['#c9c0ad','#c4bba7'][k%2],ry,'solid');
      const N_=an.flight.module?.nosing;if(N_&&st.nosing){const sm=st.s0-N_.out+N_.depth/2,f=an.flight.foot.line,mx=(f[0][0]+f[1][0])/2+ux*sm,mz=(f[0][1]+f[1][1])/2+uz*sm;
        bake(box,mx,st.top+N_.up-.015,mz,N_.depth,.03,2*an.half+.01,'#d6cfbf',ry,'solid');}});
    // Foot apron and west blend (layout: ruled triangles over a render cut), normals up.
    {const pos=[];for(const t of [...(an.aprons??[]),...(an.blend??[])]){let [a,b,c]=t;const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(ny<0)[b,c]=[c,b];pos.push(...a,...b,...c);}
      if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,'#c4bba7',0,'solid');g.dispose();}}
    for(const c of an.cheeks){const [x,z]=C(c.ring),len=Math.hypot(c.ring[1][0]-c.ring[0][0],c.ring[1][1]-c.ring[0][1]);
      bake(box,x,(c.bottom+c.top-.06)/2,z,len,c.top-.06-c.bottom,.3,'#8e8576',ry,'solid');bake(box,x,c.top-.03,z,len,.06,.34,'#d6cfbf',ry,'solid');}}
  // ---- Plaza del Quinto Centenario (Wikimedia Commons curid=38237168). ----
  const q=n.quinto,ry=Math.atan2(q.axis.x,q.axis.z),Q=q.Q;
  const slab=(a0,a1,c0,c1,y0,y1,colour)=>{const [x,z]=Q((a0+a1)/2,(c0+c1)/2);bake(box,x,(y0+y1)/2,z,Math.abs(c1-c0),y1-y0,Math.abs(a1-a0),colour,ry,'solid');};
  q.steps.forEach((s,k)=>slab(s.a0,s.a1,-STAIR.half,STAIR.half,s.bottom,s.top,['#d3cab7','#cfc6b2'][k%2]));
  // Nosing bars (js/sj-stairs.js STAIR_NOSING; none on the top riser).
  {const N_=q.flight?.module?.nosing;if(N_)for(const s of q.steps)if(s.nosing)slab(s.a0-N_.out,s.a0-N_.out+N_.depth,-STAIR.half-.005,STAIR.half+.005,s.top+N_.up-.03,s.top+N_.up,'#ddd5c3');}
  slab(q.landing.a0,q.landing.a1,-STAIR.half,STAIR.half,q.landing.bottom,q.landing.y,STONE);
  // Balustrades (Wikimedia Commons curid=38237168): pale wall, coping, white balusters under a rail, piers at segment ends.
  const balustrade=(a0,a1,c0,c1,top,alongA)=>{const L=alongA?a1-a0:Math.abs(c1-c0),count=Math.max(2,Math.floor(L/.32)),am=(a0+a1)/2,cm=(c0+c1)/2;
    for(let k=0;k<=count;k++){const t=(k+.5)/(count+1),[x,z]=alongA?Q(a0+(a1-a0)*t,cm):Q(am,c0+(c1-c0)*t);bake(cylinder,x,top+.08+.36,z,.06,.72,.06,RAIL,0,'solid');}
    slab(a0,a1,c0,c1,top+.8,top+.95,RAIL);};
  for(const c of q.cheeks){slab(c.a0,c.a1,c.c0,c.c1,c.bottom,c.top,'#d9d1bf');slab(c.a0,c.a1,c.c0-.04*c.side,c.c1+.04*c.side,c.top,c.top+.08,'#e8e2d4');
    balustrade(c.a0+.12,c.a1-.12,c.c0+.06*c.side,c.c1-.06*c.side,c.top,true);
    const [x,z]=Q(c.a0+.12,(c.c0+c.c1)/2);bake(box,x,c.top+.52,z,.44,.94,.24,'#e8e2d4',ry,'solid');}  // pier top 4 cm above the rail (was its plane)
  for(const w of q.endWall){slab(w.a0,w.a1,w.c0,w.c1,w.bottom,w.top,'#d9d1bf');slab(w.a0-.04,w.a1+.04,w.c0,w.c1,w.top,w.top+.08,'#e8e2d4');
    if(w.rail)balustrade(w.a0+.06,w.a1-.06,w.c0+.12,w.c1-.12,w.top,false);}
  // Dark green handrails dividing the broad stair (Wikimedia Commons curid=38237168), posts every third tread.
  for(const c of [-STAIR.half/3,STAIR.half/3]){const pts=[];
    for(let k=0;k<q.steps.length;k+=3){const s=q.steps[k],[x,z]=Q((s.a0+s.a1)/2,c);pts.push([x,s.top,z]);bake(cylinder,x,s.top+.45,z,.035,.9,.035,HANDRAIL,0,'solid');}
    {const s=q.steps.at(-1),[x,z]=Q(s.a1+.3,c);pts.push([x,q.landing.y,z]);bake(cylinder,x,q.landing.y+.45,z,.035,.9,.035,HANDRAIL,0,'solid');}
    for(let k=0;k+1<pts.length;k++)seg([pts[k][0],pts[k][1]+.9,pts[k][2]],[pts[k+1][0],pts[k+1][1]+.9,pts[k+1][2]],.03,HANDRAIL);}
  // Splash pad: the wet paving is a draped overlay (layout surface 'wet'); a thin dark rim follows its edge on the ground.
  const f=q.fountain;
  for(let k=0;k<f.rim.length;k++){const a=f.rim[k],b=f.rim[(k+1)%f.rim.length];seg(a,b,.05,'#2c3130');}
  for(const j of f.jets)bake(cylinder,j.x,j.y+.005,j.z,.06,.03,.06,'#3a3f3e',0,'solid');
  {const pos=[],nrm=[],M=new THREE.Matrix4(),one=new THREE.Vector3(1,1,1),qt=new THREE.Quaternion();
    const add=(g,x,y,z)=>{M.compose(new THREE.Vector3(x,y,z),qt,one);g.applyMatrix4(M);const m=g.index?g.toNonIndexed():g;
      pos.push(...m.attributes.position.array);nrm.push(...m.attributes.normal.array);if(m!==g)m.dispose();g.dispose();};
    // Wikimedia Commons curid=38237168: columns of white water widening as they rise, with a frothy crown; the clusters read as two plumes.
    for(const j of f.jets){const r=j.cluster?1:.6,col=new THREE.CylinderGeometry(.11*r,.035*r,j.h,8,1,true);col.translate(0,j.h/2,0);add(col,j.x,j.y,j.z);
      const crown=new THREE.IcosahedronGeometry(.17*r,1);crown.scale(1,.75,1);crown.translate(0,j.h,0);add(crown,j.x,j.y,j.z);}
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));
    g.computeBoundingSphere();const m=new THREE.Mesh(g,mat({color:'#e8f3f4',transparent:true,opacity:.55,roughness:.2,metalness:0,side:THREE.DoubleSide,depthWrite:false}));
    m.name='sj-plaza-quinto-jets';m.renderOrder=2;scene.add(m);meshes.push(m);}
  // Tótem Telúrico (OSM height 12 m, Wikimedia Commons curid=38237168): a smooth dark foot, then one continuous rough reddish shaft — an irregular
  // low-poly tube with knobbly radius noise and mottled vertex colour (stacked drums read as a tiered column).
  {const t=q.totem,random=seeded(1992);bake(cylinder,t.x,(t.bottom-.02+t.baseTop)/2,t.z,t.baseRadius,t.baseTop-t.bottom+.02,t.baseRadius,'#34393a',0,'solid');  // foot off the court slab's bottom plane
    const rings=26,sides=10,pos=[],col=[],idx=[],c=new THREE.Color(),reds=['#8c4a33','#9a5638','#7d4230','#a4603f','#874632'];
    for(let i=0;i<=rings;i++){const y=t.baseTop-.05+(t.top-t.baseTop+.05)*i/rings,wob=[Math.sin(i*.7)*.04,Math.cos(i*.53)*.04];
      for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2,r=t.radius*(.84+random()*.28)*(i===rings?.9:1);
        pos.push(t.x+wob[0]+Math.cos(a)*r,y+(random()-.5)*.08*(i>0&&i<rings),t.z+wob[1]+Math.sin(a)*r);
        c.set(reds[Math.floor(random()*reds.length)]).multiplyScalar(.9+random()*.2);col.push(c.r,c.g,c.b);}}
    for(let i=0;i<rings;i++)for(let k=0;k<sides;k++){const a=i*sides+k,b=i*sides+(k+1)%sides;idx.push(a,a+sides,b,b,a+sides,b+sides);}
    const top=pos.length/3;pos.push(t.x,t.top+.04,t.z);c.set(reds[0]);col.push(c.r,c.g,c.b);
    for(let k=0;k<sides;k++)idx.push(top,rings*sides+(k+1)%sides,rings*sides+k);
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat({vertexColors:true,roughness:.95,metalness:0,flatShading:true}));m.name='sj-plaza-quinto-totem';m.castShadow=true;m.receiveShadow=true;
    scene.add(m);meshes.push(m);}
  // White-cup lamps (Wikimedia Commons curid=38237168): dark post with a white tapered diffuser.
  const cup=own(new THREE.CylinderGeometry(.24,.08,.55,10));
  for(const {x,y,z,foot} of q.lamps){const lb=Number.isFinite(foot)?Math.min(y,foot):y;bake(cylinder,x,(lb+y+.5)/2,z,.12,y+.5-lb,.12,IRON,0,'solid');/* seated foot */bake(cylinder,x,y+1.95,z,.05,3.0,.05,IRON,0,'solid');bake(cup,x,y+3.72,z,1,1,1,'#f2f0ea',0,'solid');}

  const material=mat({map:rubbleTexture(textures),vertexColors:true,roughness:.95,metalness:0});
  const g=own(rubble.geometry()),m=new THREE.Mesh(g,material);m.name='sj-plaza-norzagaray-masonry';m.castShadow=true;m.receiveShadow=true;scene.add(m);meshes.push(m);
  const tg=own(turf.geometry()),tm=new THREE.Mesh(tg,mat({vertexColors:true,roughness:.96,metalness:0}));tm.name='sj-plaza-norzagaray-turf';tm.receiveShadow=true;scene.add(tm);meshes.push(tm);
  return {masonryTriangles:rubble.count/3,turfTriangles:turf.count/3,walls:n.walls.length,ends:n.ends.length,lamps:n.lamps.length,
    steps:q.steps.length,cheeks:q.cheeks.length,jets:f.jets.length};
}
