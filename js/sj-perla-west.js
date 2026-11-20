/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// La Perla west visuals — © 2026 VibezZzCoder, MIT. Wikimedia Commons curid=80155724, curid=58051549, curid=163264065, curid=80369330 (dark weathered rubble wall), curid=80369333 (dark round
// tunnel arch framing the white cemetery gate), curid=80369335 (white railing enclosure with grey lattice panels), curid=51518101, curid=163264054, curid=163264058 (round
// arcaded chapel: terracotta plinth, pale ochre arcade, drum, coral dome, lantern), curid=51518101, curid=163264061, curid=80369330, curid=80369332 (dense white tombs, crosses,
// small mausoleums, statues). All dimensions come from sj-perla-west-layout.js, which owns the matching solids/tops/cuts.
import * as THREE from 'three/webgpu';
import {surfaceBuffer} from './sj-gate.js';
import {rubbleTexture,drawWallRuns} from './sj-norzagaray.js';

const IRON='#24282a',TURF='#7e9866',TOP='#a59d8b',WHITE='#eeede7',STONE='#a49d8e',OCHRE='#e1c38e',CORAL='#cf745a',TERRACOTTA='#a75a43';

// Wikimedia Commons curid=80369333, curid=80369335, curid=163264058: warm reddish exposed aggregate with sparse grey bands (the paseo slab texture read as large
// peach tiles). One 256 px tile per 3.2 m: dense grain of light and dark pebbles, a broad grey band, no square joints. The
// colour lives in the texture (the material tint is white) so the bands stay grey.
export function aggregateTexture(textures) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  let seed=90217;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  ctx.fillStyle='#c79e86';ctx.fillRect(0,0,256,256);
  for(let i=0;i<40;i++){ctx.fillStyle=`rgba(${random()<.5?'150,105,85':'225,195,170'},${.05+random()*.06})`;ctx.beginPath();
    ctx.ellipse(random()*256,random()*256,10+random()*30,8+random()*20,random()*3,0,Math.PI*2);ctx.fill();}
  // Grey band (≈0.27 m) across the tile, its own grain.
  ctx.fillStyle='#9d9a93';ctx.fillRect(0,104,256,22);
  for(let i=0;i<14000;i++){const x=random()*256,y=random()*256,band=y>=104&&y<126,k=random();
    ctx.fillStyle=band?(k<.5?'rgba(70,70,68,.18)':'rgba(220,218,210,.16)'):k<.4?'rgba(120,80,62,.2)':k<.8?'rgba(240,215,190,.18)':'rgba(90,90,88,.16)';
    const r=random()<.85?1:2;ctx.fillRect(x,y,r,r);}
  ctx.fillStyle='rgba(60,55,50,.18)';ctx.fillRect(0,103,256,1);ctx.fillRect(0,126,256,1);
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.anisotropy=4;
  textures.add(tx);return tx;
}

// Inward-facing open cylinder (seen from inside, e.g. the chapel portico's entablature).
function inwardCylinder(r,h,seg){const g=new THREE.CylinderGeometry(r,r,h,seg,1,true),idx=g.index.array;
  for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}
  const n=g.attributes.normal.array;for(let i=0;i<n.length;i++)n[i]=-n[i];return g;}
// Arch head: a rectangle spring..top with a semicircular opening of radius r (local x across, y up, extruded along z).
function archHead(halfW,r,spring,top,depth){const s=new THREE.Shape();
  s.moveTo(-halfW,top);s.lineTo(halfW,top);s.lineTo(halfW,spring);s.lineTo(r,spring);s.absarc(0,spring,r,0,Math.PI,false);s.lineTo(-halfW,spring);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:10});g.translate(0,0,-depth/2);return g;}

export function buildPerlaWest(n,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}) {
  const {PARAPET,PASSAGE}=n.constants,rubble=surfaceBuffer(),turf=surfaceBuffer(),up=[0,1,0],SC=4.2;
  drawWallRuns(n.walls,n.ends,{rubble,turf,height,PARAPET,SC,safe:true});
  // Cylinder between two points (bake maps local +Y to Ry·Rz·Y: rz = acos(dy), ry = atan2(dz,−dx)).
  const seg=(a,b,r,colour)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-6)return;
    const rz=Math.acos(Math.max(-1,Math.min(1,dy/l))),ry=Math.hypot(dx,dz)>1e-9?Math.atan2(dz,-dx):0;
    bake(cylinder,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,l,r,colour,ry,'solid',rz);};

  // ---- Calle Cementerio sally port (Wikimedia Commons curid=80369333: dark round arch, deep plain reveal). ----
  const ps=n.passage,{ax,az,px,pz}=ps.frame,O=ps.frame.origin,half=ps.half,{R,cy}=ps.arch,HR=ps.rearHalf;
  const P3=(u,v,y)=>[O[0]+ax*u+px*v,y,O[1]+az*u+pz*v];
  const out=[-ax,0,-az],inward=[ax,0,az],sideN=s=>[s*px,0,s*pz];
  const arch=v=>cy+Math.sqrt(Math.max(0,R*R-v*v));
  const N=12,vs=Array.from({length:N+1},(_,i)=>-half+2*half*i/N),dark=['#a39c8d','#9b9486'];
  const face=(u,v0,v1,y0,y1,nrm,c=dark)=>rubble.quad(P3(u,v0,y0),P3(u,v1,y0),P3(u,v1,y1),P3(u,v0,y1),c,nrm,SC);
  const portal=(u,nrm,floor,vLo,vHi,top,bottom)=>{
    face(u,vLo,-half,bottom,top,nrm);face(u,half,vHi,bottom,top,nrm);
    for(let i=0;i<N;i++)rubble.quad(P3(u,vs[i],floor+arch(vs[i])),P3(u,vs[i+1],floor+arch(vs[i+1])),P3(u,vs[i+1],top),P3(u,vs[i],top),dark,nrm,SC);
    // A slightly proud, darker archivolt band closes the reveal edge.
    const sgn=nrm===out?-1:1,uf=u+sgn*.04,a0=Math.asin(Math.min(1,half/R)),ring=(r,k)=>{const ang=Math.PI/2+a0-(2*a0)*(k/12);return [Math.cos(ang)*r,cy+Math.sin(ang)*r];};
    for(let k=0;k<12;k++){const i0=ring(R,k),i1=ring(R,k+1),o0=ring(R+.36,k),o1=ring(R+.36,k+1),Y=([vv,yy],uu)=>P3(uu,vv,floor+yy);
      rubble.quad(Y(i0,uf),Y(o0,uf),Y(o1,uf),Y(i1,uf),'#8a8477',nrm,1.2);
      const om=[(o0[0]+o1[0])/2,(o0[1]+o1[1])/2-cy];rubble.quad(Y(o0,uf),Y(o1,uf),Y(o1,u),Y(o0,u),'#8a8477',[om[0]*px,om[1],om[0]*pz],1.2);}};
  portal(ps.uFront,out,ps.outerY,ps.vMin,ps.vMax,ps.blockTop,ps.blockBottom);
  portal(ps.uRear,inward,ps.innerY,-HR,HR,ps.rearTop,ps.rearBottom);
  // Front block: sides, the back edge where it meets the kept terrace, parapet and turf top (continuous with the walks).
  rubble.quad(P3(ps.uFront,ps.vMin,ps.blockBottom),P3(ps.uBlk,ps.vMin,ps.blockBottom),P3(ps.uBlk,ps.vMin,ps.blockTop),P3(ps.uFront,ps.vMin,ps.blockTop),dark,sideN(-1),SC);
  rubble.quad(P3(ps.uBlk,ps.vMax,ps.blockBottom),P3(ps.uFront,ps.vMax,ps.blockBottom),P3(ps.uFront,ps.vMax,ps.blockTop),P3(ps.uBlk,ps.vMax,ps.blockTop),dark,sideN(1),SC);
  for(const [v0,v1] of [[ps.vMin,-half],[half,ps.vMax]]){let lo=Infinity;for(let v=v0;v<=v1+1e-6;v+=.5)lo=Math.min(lo,height(...[P3(ps.uBlk,v,0)[0],P3(ps.uBlk,v,0)[2]]));
    face(ps.uBlk,v1,v0,lo-.3,ps.blockTop,inward);}
  {const t=ps.blockTop,u0=ps.uFront,u1=ps.uFront+PARAPET.thick,v0=ps.vMin,v1=ps.vMax;
    face(u0,v0,v1,t,t+PARAPET.riseOut,out);
    rubble.quad(P3(u0,v0,t+PARAPET.riseOut),P3(u0,v1,t+PARAPET.riseOut),P3(u1,v1,t+PARAPET.riseIn),P3(u1,v0,t+PARAPET.riseIn),TOP,[out[0]*.25,1,out[2]*.25],1.6);
    rubble.quad(P3(u1,v1,t+PARAPET.riseIn),P3(u1,v0,t+PARAPET.riseIn),P3(u1,v0,t),P3(u1,v1,t),'#9a9282',inward,2.4);
    for(const [v,sg] of [[v0,-1],[v1,1]])rubble.quad(P3(u0,v,t),P3(u1,v,t),P3(u1,v,t+PARAPET.riseIn),P3(u0,v,t+PARAPET.riseOut),'#bdb5a4',sideN(sg),SC);
    turf.quad(P3(u1,v0,t),P3(ps.uBlk,v0,t),P3(ps.uBlk,v1,t),P3(u1,v1,t),TURF,up);}
  // Rear block: sides, its uphill edge (above the vault over the passage), turf top.
  rubble.quad(P3(ps.uR0,-HR,ps.rearBottom),P3(ps.uRear,-HR,ps.rearBottom),P3(ps.uRear,-HR,ps.rearTop),P3(ps.uR0,-HR,ps.rearTop),dark,sideN(-1),SC);
  rubble.quad(P3(ps.uRear,HR,ps.rearBottom),P3(ps.uR0,HR,ps.rearBottom),P3(ps.uR0,HR,ps.rearTop),P3(ps.uRear,HR,ps.rearTop),dark,sideN(1),SC);
  {const u=ps.uR0,fl=ps.floorAt(u);let lo=Infinity;for(let v=-HR;v<=HR+1e-6;v+=.5)lo=Math.min(lo,height(...[P3(u,v,0)[0],P3(u,v,0)[2]]));
    face(u,HR,half,lo-.3,ps.rearTop,out);face(u,-half,-HR,lo-.3,ps.rearTop,out);
    for(let i=0;i<N;i++)rubble.quad(P3(u,vs[i+1],fl+arch(vs[i+1])+.02),P3(u,vs[i],fl+arch(vs[i])+.02),P3(u,vs[i],ps.rearTop),P3(u,vs[i+1],ps.rearTop),dark,out,SC);}
  turf.quad(P3(ps.uR0,-HR,ps.rearTop),P3(ps.uRear,-HR,ps.rearTop),P3(ps.uRear,HR,ps.rearTop),P3(ps.uR0,HR,ps.rearTop),TURF,up);
  // Passage walls and vault, the whole bore (the floor is the layout's replacement-floor geometry).
  {const f0=ps.floorAt(ps.uFront),f1=ps.floorAt(ps.uRear);
    for(const s of [-1,1])rubble.quad(P3(ps.uFront,s*half,f0-.05),P3(ps.uRear,s*half,f1-.05),P3(ps.uRear,s*half,f1+PASSAGE.spring),P3(ps.uFront,s*half,f0+PASSAGE.spring),'#8f897c',sideN(-s),2.0);
    for(let i=0;i<N;i++){const vm=(vs[i]+vs[i+1])/2;
      rubble.quad(P3(ps.uFront,vs[i],f0+arch(vs[i])),P3(ps.uRear,vs[i],f1+arch(vs[i])),P3(ps.uRear,vs[i+1],f1+arch(vs[i+1])),P3(ps.uFront,vs[i+1],f0+arch(vs[i+1])),'#827c70',[-vm*px,-(arch(vm)-cy),-vm*pz],2.0);}}   // inward (toward the arch centre): the round arch's sides face across
  for(const k of ps.skirts){const v=k.side*(half+.03),e=u=>{const [x,,z]=P3(u,v,0);return [x,ps.floorAt(u),z];};
    const a=e(ps.uOut-.03),b=e(ps.uFront);rubble.quad(a,b,[b[0],b[1]-.5,b[2]],[a[0],a[1]-.5,a[2]],'#8e8a80',sideN(k.side),2.4);}
  for(const k of ps.kerbs){const vi=k.side*half,vo=k.side*(half+.45);
    rubble.quad(P3(ps.uOut,vi,k.bottom),P3(ps.uFront,vi,k.bottom),P3(ps.uFront,vi,k.top),P3(ps.uOut,vi,k.top),'#c4bcab',sideN(-k.side),2.4);
    rubble.quad(P3(ps.uOut,vi,k.top),P3(ps.uFront,vi,k.top),P3(ps.uFront,vo,k.top),P3(ps.uOut,vo,k.top),TOP,up,1.6);}
  // Lane retaining walls (OSM 561646847): rendered faces, a pale coping; end caps at the lane's top.
  {const W3=(p,y)=>[p[0],y,p[1]],nrm=(p,q)=>{const d=[q[0]-p[0],q[1]-p[1]],l=Math.hypot(...d)||1;return [d[0]/l,0,d[1]/l];};
    for(const w of ps.laneWalls){const o=nrm(w.p0,w.q0),i=[-o[0],0,-o[2]];
      rubble.quad(W3(w.p0,w.bottom),W3(w.p1,w.bottom),W3(w.p1,w.t1),W3(w.p0,w.t0),'#b8b0a0',i,SC);
      rubble.quad(W3(w.p0,w.t0),W3(w.p1,w.t1),W3(w.q1,w.t1),W3(w.q0,w.t0),TOP,up,1.6);
      rubble.quad(W3(w.q0,w.t0),W3(w.q1,w.t1),W3(w.q1,w.bottom),W3(w.q0,w.bottom),'#b8b0a0',o,SC);}
    for(const s of [-1,1]){const w=[...ps.laneWalls].reverse().find(x=>x.side===s);if(!w)continue;const d=nrm(w.p0,w.p1);
      rubble.quad(W3(w.p1,w.bottom),W3(w.q1,w.bottom),W3(w.q1,w.t1),W3(w.p1,w.t1),'#b8b0a0',d,SC);}}

  // ---- Cemetery enclosure (Wikimedia Commons curid=51518101, curid=163264061, curid=58051549, curid=80369335, curid=80369332): white plaster walls with piers; along Tiburcio a low white wall with
  // grey lattice panels between piers. ----
  const C=n.cemetery,boxAlong=(p,q,y0,y1,th,c)=>{const dx=q[0]-p[0],dz=q[1]-p[1],L=Math.hypot(dx,dz);if(L<1e-3||y1-y0<1e-3)return;
    bake(box,(p[0]+q[0])/2,(y0+y1)/2,(p[1]+q[1])/2,L,y1-y0,th,c,Math.atan2(-dz,dx),'solid');};
  // Wikimedia Commons curid=80369333, curid=80369335: open diagonal crisscross metal panels between the piers (a solid grey sheet read as blank infill).
  // Bars at ±45° every 0.26 m, clipped to the panel; shared pooled boxes.
  const lattice=(p,q,y0,y1,c)=>{const dx=q[0]-p[0],dz=q[1]-p[1],L=Math.hypot(dx,dz),H=y1-y0;if(L<.05||H<.05)return;
    const ux=dx/L,uz=dz/L,ry=Math.atan2(-dz,dx),sp=.26;
    for(const dir of [1,-1])for(let c0=-H+sp/2;c0<L;c0+=sp){const s0=c0,s1=c0+H,h0=dir>0?0:H,h1=dir>0?H:0;
      const t0=Math.max(0,-s0/H),t1=Math.min(1,(L-s0)/H);if(t1-t0<.02)continue;
      const A=[s0+H*t0,h0+(h1-h0)*t0],B=[s0+H*t1,h0+(h1-h0)*t1],m=[(A[0]+B[0])/2,(A[1]+B[1])/2],len=Math.hypot(B[0]-A[0],B[1]-A[1]);
      bake(box,p[0]+ux*m[0],y0+m[1],p[1]+uz*m[0],len,.022,.022,c,ry,'solid',Math.atan2(B[1]-A[1],B[0]-A[0]));}
    boxAlong(p,q,y0,y0+.04,.05,c);};
  for(const w of C.enclosure){
    if(w.rail){boxAlong(w.p,w.q,w.bottom,w.low,.36,WHITE);boxAlong(w.p,w.q,w.low,w.low+.08,.44,'#dcdad2');
      lattice(w.p,w.q,w.low+.08,w.top-.14,'#7d8386');boxAlong(w.p,w.q,w.top-.14,w.top-.04,.1,'#f2f1ec');}
    else{boxAlong(w.p,w.q,w.bottom,w.top-.1,.4,WHITE);boxAlong(w.p,w.q,w.top-.1,w.top,.52,'#d8d6ce');}}
  for(const p of C.piers){const s=p.rail?.46:.56,ry=Math.atan2(p.ni[0],p.ni[1]);
    bake(box,p.x,(p.bottom-.02+p.top)/2,p.z,s,p.top-p.bottom+.02,s,'#f3f1ec',ry,'solid');   /* pier foot 2 cm under the wall's, not on its plane*/bake(box,p.x,p.top+.05,p.z,s+.12,.1,s+.12,'#d9d7cf',ry,'solid');}
  // Gate (Wikimedia Commons curid=80369333): salmon plinths, white pilasters, cream arch head, cornice, stepped attic with a curved crown, plaque,
  // Latin cross; closed dark iron leaves (the photo shows them open; the cemetery interior is out of scope, as El Morro's).
  {const g=C.gate,dd=g.dir,ni=g.inward,y0=g.ground,ry=Math.atan2(-dd[1],dd[0]),at=(s,o)=>[g.x+dd[0]*s+ni[0]*o,g.z+dd[1]*s+ni[1]*o];
    const gb=(s,o,yb,yt,w,d,c)=>{const [x,z]=at(s,o);bake(box,x,(yb+yt)/2,z,w,yt-yb,d,c,ry,'solid');};
    const hc=g.clear/2;
    for(const s of [-1,1]){gb(s*(hc+.55),0,g.bottom,y0+g.cornice,1.1,g.depth,'#f3f1ea');gb(s*(hc+.55),0,g.bottom,y0+.55,1.24,g.depth+.14,'#cf9575');}
    const head=own(archHead(hc+.05,hc,g.spring,g.cornice,g.depth*.9));
    {const [x,z]=at(0,0);bake(head,x,y0,z,1,1,1,'#eedfbb',ry,'solid');}
    gb(0,0,y0+g.cornice,y0+g.cornice+.28,g.width+.4,g.depth+.24,'#f6f5f0');
    gb(0,0,y0+g.cornice+.28,y0+g.cornice+.72,g.width-.9,g.depth*.75,'#f3f1ea');
    gb(0,0,y0+g.cornice+.72,y0+g.attic,g.width-2.3,g.depth*.65,'#f3f1ea');
    // Wikimedia Commons curid=80369333: a shallow curved crown over the upper step, then a plain pale Latin cross.
    {const s=new THREE.Shape();s.moveTo(1.0,0);s.absarc(0,0,1.0,0,Math.PI,false);s.closePath();
      const cg=own(new THREE.ExtrudeGeometry(s,{depth:g.depth*.6,bevelEnabled:false,curveSegments:12}));cg.translate(0,0,-g.depth*.3);
      const [x,z]=at(0,0);bake(cg,x,y0+g.attic,z,1,.42,1,'#f3f1ea',ry,'solid');}
    gb(0,-(g.depth*.375+.02),y0+g.cornice+.32,y0+g.cornice+.68,g.width-1.3,.04,'#d6cbb0');
    {const [x,z]=at(0,0),yc=y0+g.attic+.38,ch=g.cross-g.attic-.38;bake(box,x,yc+ch/2,z,.18,ch,.18,'#e9e7e1',ry,'solid');
      bake(box,x,yc+ch*.66,z,.7,.16,.16,'#e9e7e1',ry,'solid');}
    for(let s=-hc+.1;s<=hc-.1+1e-6;s+=.14){const hh=g.spring+Math.sqrt(Math.max(0,hc*hc-s*s))-.06,[x,z]=at(s,0);bake(cylinder,x,y0+hh/2,z,.018,hh,.018,IRON,0,'solid');}
    for(const yy of [1.0,2.1])gb(0,0,y0+yy,y0+yy+.06,g.clear,.05,IRON);}

  // ---- Chapel (Wikimedia Commons curid=51518101, curid=163264054, curid=163264058): terracotta plinth, 12-bay pale ochre arcade with white pilasters, entablature, annular
  // roof, drum with small dark windows, coral dome, pale lantern with a thin cross; entrance stair east. ----
  {const c=C.chapel,g=c.ground,fl=c.floor,rad=th=>[Math.cos(th),Math.sin(th)],ryR=th=>Math.atan2(Math.cos(th),Math.sin(th));
    const cyl=(r,h,seg,y,colour,open=false)=>{const geo=own(new THREE.CylinderGeometry(r,r,h,seg,1,open));bake(geo,c.x,y,c.z,1,1,1,colour,0,'solid');};
    cyl(c.plinthR,fl-c.bottom,36,(c.bottom+fl)/2,TERRACOTTA);cyl(c.plinthR+.1,.14,36,fl+.02,'#bdb4a7');
    const chord=2*c.arcadeR*Math.sin(Math.PI/c.bays),pierW=.95,ar=(chord-pierW)/2;
    for(let k=0;k<c.bays;k++){const tp=(k+.5)/c.bays*Math.PI*2,[cx,cz]=rad(tp);
      bake(box,c.x+cx*c.arcadeR,fl+c.entab/2,c.z+cz*c.arcadeR,pierW,c.entab,.8,OCHRE,ryR(tp),'solid');
      bake(box,c.x+cx*(c.arcadeR+.42),fl+(c.entab-.2)/2,c.z+cz*(c.arcadeR+.42),.5,c.entab-.2,.06,'#f3eee2',ryR(tp),'solid');
      const tb=k/c.bays*Math.PI*2,[bx,bz]=rad(tb),headG=own(archHead(ar+.12,ar,c.spring,c.entab,.8));
      bake(headG,c.x+bx*c.arcadeR,fl,c.z+bz*c.arcadeR,1,1,1,OCHRE,ryR(tb),'solid');}
    cyl(c.arcadeR+.42,c.cornice-c.entab,48,fl+(c.entab+c.cornice)/2,'#e8d7ae',true);
    {const geo=own(inwardCylinder(c.arcadeR-.42,c.cornice-c.entab,48));bake(geo,c.x,fl+(c.entab+c.cornice)/2,c.z,1,1,1,'#ddcaa0',0,'solid');}
    // Cornice band: an open ring with its own soffit; the annular roof is the only surface at its top (a closed
    // cylinder cap and the roof ring shared y = cornice+0.2 over 168 m² and z-fought in radial wedges).
    cyl(c.arcadeR+.6,.2,48,fl+c.cornice+.1,'#f4f1ea',true);
    {const ceil=own(new THREE.RingGeometry(c.drumR,c.arcadeR+.42,48));ceil.rotateX(Math.PI/2);bake(ceil,c.x,fl+c.entab,c.z,1,1,1,'#d8cbaf',0,'solid');
      const soffit=own(new THREE.RingGeometry(c.arcadeR+.42,c.arcadeR+.6,48));soffit.rotateX(Math.PI/2);bake(soffit,c.x,fl+c.cornice,c.z,1,1,1,'#e9e3d4',0,'solid');
      const roof=own(new THREE.RingGeometry(c.drumR,c.arcadeR+.6,48));roof.rotateX(-Math.PI/2);bake(roof,c.x,fl+c.cornice+.2,c.z,1,1,1,'#cbbda4',0,'solid');}
    cyl(c.drumR,g+c.drumTop-fl,36,(fl+g+c.drumTop)/2,'#efe7d4',true);cyl(c.drumR+.16,.3,36,g+c.drumTop,'#f4f1ea');
    // Wikimedia Commons curid=163264054, curid=163264058: small round openings in the squat drum (square slots).
    for(let k=0;k<8;k++){const t=(k+.5)/8*Math.PI*2,[dx,dz]=rad(t),y=g+c.drumTop-1.0;
      seg([c.x+dx*(c.drumR-.02),y,c.z+dz*(c.drumR-.02)],[c.x+dx*(c.drumR+.06),y,c.z+dz*(c.drumR+.06)],.36,'#e9e3d4');
      seg([c.x+dx*(c.drumR+.06),y,c.z+dz*(c.drumR+.06)],[c.x+dx*(c.drumR+.075),y,c.z+dz*(c.drumR+.075)],.27,'#3c3a36');}
    // Wikimedia Commons curid=163264058: shallow arched panels round the red base, darker than the plinth (one per 15°, sized to the local ground).
    for(let k=0;k<24;k++){const t=(k+.5)/24*Math.PI*2,[dx,dz]=rad(t);if(Math.abs(t)<.35||Math.abs(t-Math.PI*2)<.35)continue; // the stair
      const px=c.x+dx*c.plinthR,pz=c.z+dz*c.plinthR,yb=height(px,pz)+.16,yt=fl-.16,hw=.72,ht=yt-yb;if(ht<.4)continue;
      const sh=new THREE.Shape(),rise=Math.min(.18,ht*.25);sh.moveTo(-hw,0);sh.lineTo(hw,0);sh.lineTo(hw,ht-rise);sh.quadraticCurveTo(0,ht+rise,-hw,ht-rise);sh.closePath();
      const pg=own(new THREE.ExtrudeGeometry(sh,{depth:.12,bevelEnabled:false,curveSegments:3}));pg.translate(0,0,-.08);
      bake(pg,c.x+dx*(c.plinthR+.02),yb,c.z+dz*(c.plinthR+.02),1,1,1,'#8f4a37',ryR(t),'solid');}
    bake(box,c.x+c.drumR+.03,fl+1.3,c.z,.1,2.6,1.4,'#4a3c30',0,'solid');
    {const dome=own(new THREE.SphereGeometry(c.domeR,32,12,0,Math.PI*2,0,Math.PI/2));bake(dome,c.x,g+c.drumTop+.15,c.z,1,1,1,CORAL,0,'solid');}
    const lt=g+c.drumTop+.15+c.domeR;cyl(c.lanternR,c.lanternH,16,lt+c.lanternH/2,'#f2ece0');
    for(let k=0;k<6;k++){const t=k/6*Math.PI*2,[dx,dz]=rad(t);bake(box,c.x+dx*(c.lanternR+.02),lt+c.lanternH*.55,c.z+dz*(c.lanternR+.02),.22,.6,.05,'#3c3a36',ryR(t),'solid');}
    {const cap=own(new THREE.SphereGeometry(.85,16,6,0,Math.PI*2,0,Math.PI/2));bake(cap,c.x,lt+c.lanternH,c.z,1,.7,1,CORAL,0,'solid');}
    const ct=lt+c.lanternH+.6;bake(sphere,c.x,ct+.05,c.z,.13,.13,.13,'#e9e5dc',0,'solid');
    bake(box,c.x,ct+.55,c.z,.06,.9,.06,IRON,0,'solid');bake(box,c.x,ct+.72,c.z,.42,.06,.06,IRON,0,'solid');
    // Entrance stair (Wikimedia Commons curid=163264058: short straight grey stair with low solid sloping sides), east toward the incoming walk.
    const steps=5,rise=(fl-g)/steps,tread=.38;
    for(let k=0;k<steps;k++){const r0=c.plinthR+(steps-1-k)*tread;bake(box,c.x+r0+tread/2,(c.bottom+g+(k+1)*rise)/2,c.z,tread,g+(k+1)*rise-c.bottom,3.2,'#aaa8a1',0,'solid');}
    // Sloping solid cheeks from the plinth top down to the first tread (level blocks 0.48 m under the top tread).
    for(const s of [-1,1]){const x0=c.plinthR-.05,x1=c.plinthR+steps*tread,sh=new THREE.Shape();
      sh.moveTo(x0,c.bottom);sh.lineTo(x1,c.bottom);sh.lineTo(x1,g+rise+.14);sh.lineTo(x0,fl+.14);sh.closePath();
      const cg=own(new THREE.ExtrudeGeometry(sh,{depth:.3,bevelEnabled:false}));cg.translate(0,0,-.15);
      bake(cg,c.x,0,c.z+s*1.75,1,1,1,TERRACOTTA,0,'solid');}}

  // Triangular prism with its apex up and its axis along local z (a pediment facing the door end).
  const pediment=own(new THREE.CylinderGeometry(1,1,1,3));pediment.rotateX(-Math.PI/2);
  // ---- Tombs (inferred rows, Wikimedia Commons curid=51518101, curid=163264061, curid=80369330, curid=80369332): one terrain-reaching body each; crosses at the head of some; a few
  // small mausoleums with a cornice and cross, robed figures on plinths, obelisks. ----
  // Robed figure (Wikimedia Commons curid=163264061, curid=80369330, curid=80369332; plain cylinders read as bollards): tapered robe, shoulders, head, arms joined in
  // front, some with folded wings. Obelisks taper to a point. Shared geometries; no likenesses or inscriptions.
  // Open-ended: the pedestal, shoulders and tip hide the ends.
  const robe=own(new THREE.CylinderGeometry(.12,.25,1.2,8,1,true)),shaft=own(new THREE.CylinderGeometry(.1,.16,1.8,4,1,true)),tip=own(new THREE.CylinderGeometry(0,.1,.3,4,1,true));
  shaft.rotateY(Math.PI/4);tip.rotateY(Math.PI/4);
  for(const t of C.tombs){const s=Math.sin(t.ry),c=Math.cos(t.ry);
    const local=(lx,lz)=>[t.x+c*lx+s*lz,t.z-s*lx+c*lz],L3=(lx,y,lz)=>{const [x,z]=local(lx,lz);return [x,y,z];};
    if(t.type==='mausoleum'){const w=t.w,l=t.l,yb=t.top;
      bake(box,t.x,(t.bottom+yb)/2,t.z,w,yb-t.bottom,l,t.colour,t.ry,'solid');
      bake(box,t.x,yb+.12,t.z,w+.24,.24,l+.24,'#efede6',t.ry,'solid');
      // Wikimedia Commons curid=163264061: a small pediment over the door end (a triangular prism laid across the front).
      {const [hx,hz]=local(0,-l/2+.15);bake(pediment,hx,yb+.24+.18,hz,w*.6,.35,.3,'#efede6',t.ry,'solid');}
      const [hx,hz]=local(0,-l/2-.02);bake(box,hx,(t.bottom+yb)/2-.3,hz,w*.45,(yb-t.bottom)*.55,.06,'#5d554b',t.ry,'solid');
      bake(box,t.x,yb+.6,t.z,.1,.7,.1,'#e9e7e1',t.ry,'solid');bake(box,t.x,yb+.72,t.z,.36,.08,.08,'#e9e7e1',t.ry,'solid');continue;}
    const body=t.type==='statue'||t.type==='obelisk'?t.top-.35:t.top;
    // Stepped base: a wider low plinth reaching the ground, its top just above the highest ground under the tomb.
    if(t.base){const bt=Math.min(body-.12,t.groundHi+.1);if(bt>t.bottom+.05)bake(box,t.x,(t.bottom+bt)/2,t.z,t.w+.2,bt-t.bottom,t.l+.2,t.colour,t.ry,'solid');}
    bake(box,t.x,(t.bottom+body)/2,t.z,t.w,body-t.bottom,t.l,t.colour,t.ry,'solid');
    if(t.type==='statue'){bake(box,t.x,body+.45,t.z,.55,.9,.55,'#e9e7e0',t.ry,'solid');const y0=body+.9,fig='#f1efe9';
      bake(robe,t.x,y0+.6,t.z,1,1,1,fig,t.ry,'solid');bake(sphere,t.x,y0+1.25,t.z,.21,.12,.15,fig,t.ry,'solid');
      bake(sphere,t.x,y0+1.45,t.z,.1,.125,.105,fig,t.ry,'solid');
      for(const sd of [-1,1])seg(L3(sd*.17,y0+1.22,0),L3(sd*.03,y0+.92,.17),.045,fig);
      if(t.wings)for(const sd of [-1,1]){const [x,z]=local(sd*.2,-.16);bake(box,x,y0+1.05,z,.05,.95,.5,fig,t.ry+sd*.45,'solid');}}
    else if(t.type==='obelisk'){bake(box,t.x,body+.35,t.z,.55,.7,.55,'#e2dfd6',t.ry,'solid');
      bake(shaft,t.x,body+.7+.9,t.z,1,1,1,'#e8e5dd',t.ry,'solid');bake(tip,t.x,body+.7+1.8+.15,t.z,1,1,1,'#e8e5dd',t.ry,'solid');}
    if(t.cross){const [hx,hz]=local(0,-t.l/2+.18),h=t.crossH;
      bake(box,hx,t.top+h/2,hz,.13,h,.13,'#ecebe5',t.ry,'solid');bake(box,hx,t.top+h*.7,hz,.52,.11,.11,'#ecebe5',t.ry,'solid');}
    // Rounded headstone (Wikimedia Commons curid=163264061, curid=80369332) at the head end.
    if(t.stele){const hw=t.w*.34,[hx,hz]=local(0,-t.l/2+.12);bake(box,hx,t.top+t.steleH/2,hz,hw*2,t.steleH,.12,t.colour,t.ry,'solid');
      seg(L3(0,t.top+t.steleH,-t.l/2+.06),L3(0,t.top+t.steleH,-t.l/2+.18),hw,t.colour);}
    // Small urns at the foot corners of a few chests.
    if(t.urns)for(const sd of [-1,1]){const p=L3(sd*(t.w/2-.13),t.top,t.l/2-.16);
      bake(cylinder,p[0],p[1]+.1,p[2],.07,.2,.07,'#e4e1d8',0,'solid');bake(sphere,p[0],p[1]+.24,p[2],.085,.07,.085,'#e4e1d8',0,'solid');}}

  const masonryMesh=meshes.find(x=>x.name==='sj-plaza-norzagaray-masonry'),turfMesh=meshes.find(x=>x.name==='sj-plaza-norzagaray-turf');
  const material=masonryMesh?.material??mat({map:rubbleTexture(textures),vertexColors:true,roughness:.95,metalness:0});
  const g=own(rubble.geometry()),m=new THREE.Mesh(g,material);m.name='sj-plaza-perlawest-masonry';m.castShadow=true;m.receiveShadow=true;scene.add(m);meshes.push(m);
  const tg=own(turf.geometry()),tm=new THREE.Mesh(tg,turfMesh?.material??mat({vertexColors:true,roughness:.96,metalness:0}));
  tm.name='sj-plaza-perlawest-turf';tm.receiveShadow=true;scene.add(tm);meshes.push(tm);
  return {masonryTriangles:rubble.count/3,turfTriangles:turf.count/3,walls:n.walls.length,ends:n.ends.length,
    enclosure:C.enclosure.length,piers:C.piers.length,tombs:C.tombs.length,laneWalls:ps.laneWalls.length};
}
