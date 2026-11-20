/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Puerta de San Juan / Paseo del Morro visuals — © 2026 VibezZzCoder, MIT.
// Wikimedia Commons curid=81591499, curid=123113261 (portal, battered wall, paseo), curid=81591500 (passage/doors), curid=114692556, curid=80420013, curid=80420699 (wall, seawall garita), curid=122996449 (garita/lamps).
// All dimensions come from sj-gate-layout.js, which also owns the matching solids, floor tops and terrain cut.
import * as THREE from 'three/webgpu';

const RED='#b5382c',WHITE='#eeebe2',PLASTER='#e0d6c1',WOOD='#5a2e22',IRON='#1f2523',STONE='#a89f8f';

function seeded(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
export function masonryTexture(textures) {
  // Weathered coursed rubble (Wikimedia Commons curid=81591499, curid=114692556, curid=80420013, curid=122996449): irregular grey-beige-ochre stones, soft joints, soot/lime mottling
  // and rain streaks. Large-scale tone variation also comes from vertex colours along the wall.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),random=seeded(51893);
  ctx.fillStyle='#8a8374';ctx.fillRect(0,0,256,256);
  const palette=[[164,157,142],[150,145,132],[172,160,138],[140,136,126],[158,150,128],[176,170,156]];
  for(let y=-6;y<256;){const h=20+Math.floor(random()*22);
    for(let x=-Math.floor(random()*60);x<256;){const w=34+Math.floor(random()*58),c=palette[Math.floor(random()*palette.length)],v=Math.floor(random()*16)-8;
      const inset=1+random()*2.5,r=3+random()*6;
      ctx.fillStyle=`rgb(${c[0]+v},${c[1]+v},${c[2]+v})`;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x+inset,y+inset,w-2*inset,h-2*inset,r);else ctx.rect(x+inset,y+inset,w-2*inset,h-2*inset);ctx.fill();
      ctx.fillStyle='rgba(255,250,235,.08)';ctx.fillRect(x+inset+2,y+inset+1,w-2*inset-4,2);
      ctx.fillStyle='rgba(40,38,30,.10)';ctx.fillRect(x+inset+2,y+h-inset-3,w-2*inset-4,2);x+=w;}
    y+=h;}
  for(let i=0;i<70;i++){const lime=random()<.35;ctx.fillStyle=lime?`rgba(232,228,214,${.08+random()*.14})`:`rgba(52,56,46,${.06+random()*.12})`;
    ctx.beginPath();ctx.ellipse(random()*256,random()*256,8+random()*40,6+random()*26,random()*3,0,Math.PI*2);ctx.fill();}
  for(let i=0;i<26;i++){ctx.fillStyle=`rgba(46,48,40,${.04+random()*.06})`;ctx.fillRect(random()*256,random()*120,2+random()*6,60+random()*140);}
  for(let i=0;i<12000;i++){ctx.fillStyle=random()<.5?'rgba(25,25,20,.07)':'rgba(240,235,220,.06)';ctx.fillRect(random()*256,random()*256,1+random(),1+random());}
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.anisotropy=4;
  textures.add(tx);return tx;
}
export function paseoTexture(textures) {
  // Light scored concrete/stone slabs; material tints separate the grey Morro strip (Wikimedia Commons curid=123113261) and warmer forecourt (18).
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),random=seeded(7741);
  ctx.fillStyle='#9f998d';ctx.fillRect(0,0,256,256);
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){const v=Math.floor(random()*18)-9;
    ctx.fillStyle=`rgb(${206+v},${200+v},${188+v})`;ctx.fillRect(i*64+1,j*64+1,62,62);}
  for(let i=0;i<60;i++){ctx.fillStyle=`rgba(90,85,75,${.04+random()*.06})`;ctx.beginPath();
    ctx.ellipse(random()*256,random()*256,4+random()*16,3+random()*10,random()*3,0,Math.PI*2);ctx.fill();}
  for(let i=0;i<9000;i++){ctx.fillStyle=random()<.5?'rgba(40,38,30,.07)':'rgba(255,255,245,.07)';ctx.fillRect(random()*256,random()*256,1,1);}
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.anisotropy=4;
  textures.add(tx);return tx;
}

// Indexed buffers with per-face normals, triplanar-by-face UVs and vertex colours: a quad shares its four corners
// (4 vertices + 6 indices instead of 6 vertices), which keeps ~1.2 km of Paseo del Morro wall inside the phone budget.
export function surfaceBuffer() {
  const p=[],n=[],uv=[],c=[],idx=[],col=new THREE.Color();
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const face=(a,b,e)=>{const u=sub(b,a),v=sub(e,a);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
  // Emits vertices for one flat face; order is already front-facing. ns: optional smooth per-vertex normals.
  function emit(pts,cs,nrm,scale,ns) {
    const l=Math.hypot(...nrm),nx=nrm[0]/l,ny=nrm[1]/l,nz=nrm[2]/l,hl=Math.hypot(nx,nz)||1,tx=-nz/hl,tz=nx/hl,base=p.length/3;
    pts.forEach((q,k)=>{p.push(...q);col.set(cs[k]);c.push(col.r,col.g,col.b);
      if(ns){const m=ns[k],ml=Math.hypot(...m);n.push(m[0]/ml,m[1]/ml,m[2]/ml);}else n.push(nx,ny,nz);
      if(Math.abs(ny)>.7)uv.push(q[0]/scale,q[2]/scale);else uv.push((q[0]*tx+q[2]*tz)/scale,q[1]/scale);});
    return base;
  }
  // colour: one value or one per vertex; normals (optional): smooth per-vertex directions, e.g. for vaults.
  function tri(a,b,e,colour,hint,scale=2.6,normals=null) {
    let cs=Array.isArray(colour)?colour:[colour,colour,colour],ns=normals,f=face(a,b,e);
    if(hint&&f[0]*hint[0]+f[1]*hint[1]+f[2]*hint[2]<0){[b,e]=[e,b];cs=[cs[0],cs[2],cs[1]];ns=ns&&[ns[0],ns[2],ns[1]];f=f.map(v=>-v);}
    if(Math.hypot(...f)<1e-10)return;
    const base=emit([a,b,e],cs,f,scale,ns);idx.push(base,base+1,base+2);
  }
  function quad(a,b,e,d,colour,hint,scale=2.6,normals) {
    // Face normal from the first non-degenerate half (collapsed corner stations), flipped to the hint like tri.
    let f=face(a,b,e);if(Math.hypot(...f)<1e-10)f=face(a,e,d);if(Math.hypot(...f)<1e-10)return;
    let cs=Array.isArray(colour)?colour:[colour,colour,colour,colour],ns=normals,order=[0,1,2,0,2,3];
    if(hint&&f[0]*hint[0]+f[1]*hint[1]+f[2]*hint[2]<0){f=f.map(v=>-v);order=[0,2,1,0,3,2];}
    const base=emit([a,b,e,d],cs,f,scale,ns);for(const k of order)idx.push(base+k);
  }
  // Each half on its own when the halves disagree about facing (La Perla one warped collapsed-corner quad emitted
  // a half against its normal); degenerate halves are skipped. Output equals quad whenever both halves agree.
  function quadSafe(a,b,e,d,colour,hint,scale=2.6,normals) {
    const f1=face(a,b,e),f2=face(a,e,d),l1=Math.hypot(...f1),l2=Math.hypot(...f2),dot=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
    if(l1>=1e-10&&l2>=1e-10&&(hint?Math.sign(dot(f1,hint))===Math.sign(dot(f2,hint)):dot(f1,f2)>0))return quad(a,b,e,d,colour,hint,scale,normals);
    const cs=Array.isArray(colour)?colour:[colour,colour,colour,colour],ns=normals;
    if(l1>=1e-10)tri(a,b,e,[cs[0],cs[1],cs[2]],hint,scale,ns&&[ns[0],ns[1],ns[2]]);
    if(l2>=1e-10)tri(a,e,d,[cs[0],cs[2],cs[3]],hint,scale,ns&&[ns[0],ns[2],ns[3]]);
  }
  function geometry() {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
    g.setIndex(new (p.length/3<65536?THREE.Uint16BufferAttribute:THREE.Uint32BufferAttribute)(idx,1));
    g.computeBoundingSphere();return g;
  }
  return {tri,quad,quadSafe,geometry,get count(){return idx.length;}};
}
function frustum(w0,d0,w1,d1,h) {
  // Rectangular frustum centred at the origin (bottom w0×d0, top w1×d1), flat normals.
  const s=surfaceBuffer(),b=[[-w0/2,-h/2,-d0/2],[w0/2,-h/2,-d0/2],[w0/2,-h/2,d0/2],[-w0/2,-h/2,d0/2]],t=[[-w1/2,h/2,-d1/2],[w1/2,h/2,-d1/2],[w1/2,h/2,d1/2],[-w1/2,h/2,d1/2]];
  for(let i=0;i<4;i++){const j=(i+1)%4,mid=[(b[i][0]+b[j][0])/2,0,(b[i][2]+b[j][2])/2];s.quad(b[i],b[j],t[j],t[i],'#ffffff',mid);}
  s.quad(t[0],t[1],t[2],t[3],'#ffffff',[0,1,0]);
  return s.geometry();
}

// Shared garita form (city wall and El Morro): corbelled base, cylindrical body with slits, cornice ring, dome, finial.
export function drawGarita(target,g,{bake,cylinder,sphere,box},colour='#e6e0d4',trim='#b9b2a4') {
  const r=g.radius,b=g.body,profile=[[.22,-g.corbel],[r*.55,-g.corbel*.7],[r*.8,-g.corbel*.35],[r+.06,-.08],[r+.1,0],[r,.06],[r,b],
    [r+.12,b+.04],[r+.14,b+.2],[r,b+.24],...Array.from({length:7},(_,i)=>{const t=(i+1)/7*Math.PI/2;return [r*.97*Math.cos(t),b+.24+r*.92*Math.sin(t)];}),[0,b+.24+r*.92]];
  const lathe=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(Math.max(x,.001),y)),16),pos=lathe.attributes.position,idx=lathe.index;
  for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return [g.x+pos.getX(j),g.y+pos.getY(j),g.z+pos.getZ(j)];});
    const cx=(q[0][0]+q[1][0]+q[2][0])/3-g.x,cyy=(q[0][1]+q[1][1]+q[2][1])/3-g.y-b,cz=(q[0][2]+q[1][2]+q[2][2])/3-g.z;
    target.tri(q[0],q[1],q[2],colour,[cx,cyy>0?cyy:0,cz],1.4);}
  lathe.dispose();
  bake(cylinder,g.x,g.y+b+.24+r*.92+.12,g.z,.07,.24,.07,trim,0,'solid');
  bake(sphere,g.x,g.y+b+.24+r*.92+.32,g.z,.13,.13,.13,trim,0,'solid');
  const face=Math.atan2(g.wallNx,g.wallNz);
  for(const a of [-1.1,0,1.1]){const t=face+a,x=g.x+Math.sin(t)*(r+.01),z=g.z+Math.cos(t)*(r+.01);
    bake(box,x,g.y+b*.62,z,.09,.42,.06,'#2a2a26',t,'facade');}
}

export function buildGate(gate,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}) {
  const {frame:{P,ax,az,px,pz},passage:ps,constants:{PARAPET,PLINTH,PORTAL,PASSAGE}}=gate;
  const P3=(u,v,y)=>{const [x,z]=P(u,v);return [x,y,z];};
  const out=[-ax,0,-az],inward=[ax,0,az],up=[0,1,0];
  const masonry=surfaceBuffer(),plaster=surfaceBuffer();
  const ry=Math.atan2(-ax,-az); // local +Z faces out of the portal, local +X = +v
  const block=(u0,u1,v0,v1,y0,y1,colour,kind='solid')=>bake(box,...P3((u0+u1)/2,(v0+v1)/2,(y0+y1)/2),v1-v0,y1-y0,u1-u0,colour,ry,kind);
  const W=(s,key,y)=>[s[key][0],y,s[key][1]];

  // Battered masonry face, plinth, cordón, parapet and wall walk (Wikimedia Commons curid=81591499, curid=123113261, curid=114692556). Portal intervals keep only the top.
  for(const {a,b,portal} of gate.walls) {
    const n=[a.nx,0,a.nz],ni=[-a.nx,0,-a.nz];
    if(!portal) {
      // Damp darker foot, lighter crest and a slow along-wall variation break up texture repetition (Wikimedia Commons curid=81591499, curid=114692556).
      const tone=s=>{const k=.9+.1*Math.sin(s.s*.37)*Math.sin(s.s*.11+1.3);return [new THREE.Color('#bdb4a3').multiplyScalar(k),new THREE.Color('#ffffff').multiplyScalar(k)];};
      const [ab,at]=tone(a),[bb,bt]=tone(b);
      masonry.quad(W(a,'B',a.bottom),W(b,'B',b.bottom),W(b,'T',b.crest),W(a,'T',a.crest),[ab,bb,bt,at],n,3.4);
      if(a.full&&b.full){
        masonry.quad(W(a,'LB',a.bottom),W(b,'LB',b.bottom),W(b,'L',b.base+PLINTH.rise),W(a,'L',a.base+PLINTH.rise),'#d9d2c5',n);
        masonry.quad(W(a,'L',a.base+PLINTH.rise),W(b,'L',b.base+PLINTH.rise),W(b,'F',b.base+PLINTH.rise),W(a,'F',a.base+PLINTH.rise),'#d9d2c5',up);
      }
      masonry.quad(W(a,'T',a.crest-.14),W(b,'T',b.crest-.14),W(b,'C',b.crest-.06),W(a,'C',a.crest-.06),'#e4ddd0',[n[0],-1,n[2]]);
      masonry.quad(W(a,'C',a.crest-.06),W(b,'C',b.crest-.06),W(b,'C',b.crest+.08),W(a,'C',a.crest+.08),'#e4ddd0',n);
      masonry.quad(W(a,'C',a.crest+.08),W(b,'C',b.crest+.08),W(b,'T',b.crest+.16),W(a,'T',a.crest+.16),'#e4ddd0',[n[0],1,n[2]]);
    }
    // Per-station heights keep neighbouring intervals crack-free; the physical tops use each interval's maximum.
    const pa=a.walk+PARAPET.rise,pb=b.walk+PARAPET.rise,mid=q=>[(q.T[0]+q.Q[0])/2,(q.T[1]+q.Q[1])/2],ma=mid(a),mb=mid(b);
    masonry.quad(W(a,'T',a.crest+.16),W(b,'T',b.crest+.16),W(b,'T',pb),W(a,'T',pa),'#ffffff',n);
    masonry.quad(W(a,'T',pa),W(b,'T',pb),[mb[0],pb+.07,mb[1]],[ma[0],pa+.07,ma[1]],'#cfc8bb',[n[0]*.4,1,n[2]*.4]);
    masonry.quad([ma[0],pa+.07,ma[1]],[mb[0],pb+.07,mb[1]],W(b,'Q',pb),W(a,'Q',pa),'#cfc8bb',[ni[0]*.4,1,ni[2]*.4]);
    masonry.quad(W(a,'Q',pa),W(b,'Q',pb),W(b,'Q',b.walk),W(a,'Q',a.walk),'#ffffff',ni);
    masonry.quad(W(a,'Q',a.walk),W(b,'Q',b.walk),W(b,'W',b.walk),W(a,'W',a.walk),'#bdb3a2',up,1.6);
    masonry.quad(W(a,'W',a.walk),W(b,'W',b.walk),W(b,'W',b.kerb),W(a,'W',a.kerb),'#ffffff',ni);
  }
  // Seams integration round (polish, pf-34-s1077-fwd at (−424.7,−61.8)): where two segments meet, the collapsed
  // corner fans several face triangles into one edge and the GPU showed a hairline of sky along it. A backing strip inside
  // the wall body, from the shared foot to the shared crest and 0.6 m deep along the inward bisector (both windings), so a
  // crack can only ever show masonry. Render only; inside the wall's own collider.
  for(let i=0;i+1<gate.stations.length;i++){const a=gate.stations[i],b=gate.stations[i+1];if(a.seg===b.seg||Math.hypot(a.x-b.x,a.z-b.z)>.01||a.portal||!a.B)continue;
    let ix=-(a.nx+b.nx),iz=-(a.nz+b.nz);const l=Math.hypot(ix,iz);if(l<1e-6)continue;ix/=l;iz/=l;
    const bot=Math.min(a.bottom,b.bottom),top=Math.max(a.crest,b.crest),B=a.B,T=a.T;
    const q=[[B[0],bot,B[1]],[T[0],top,T[1]],[T[0]+ix*.6,top,T[1]+iz*.6],[B[0]+ix*.6,bot,B[1]+iz*.6]],tn=[-iz,0,ix];
    masonry.quad(q[0],q[1],q[2],q[3],'#bdb4a3',tn);masonry.quad(q[3],q[2],q[1],q[0],'#bdb4a3',[iz,0,-ix]);}
  // Run ends, plus full-height faces that stop against a crest band (Rogativa corner).
  for(const {s,dir} of [{s:gate.stations[0],dir:-1},{s:gate.stations.at(-1),dir:1},...gate.ends]){
    const t=[dir*s.nz,0,-dir*s.nx],walk=s.walk; // ±wall tangent
    masonry.quad(W(s,'B',s.bottom),W(s,'W',s.bottom),W(s,'W',walk),W(s,'T',walk),'#ffffff',t);
    masonry.quad(W(s,'T',walk),W(s,'Q',walk),W(s,'Q',walk+PARAPET.rise),W(s,'T',walk+PARAPET.rise),'#ffffff',t);
  }

  // Red portal (Wikimedia Commons curid=81591499, curid=123113261 crops): pilaster strips, white bases, blank plaque, moulded white cornice, red attic and
  // bell-cast cap. Doorway reveal is red; the folded studded doors sit in the recess behind it (Wikimedia Commons curid=81591500).
  const y0=ps.portalY,yb=ps.portalBottom,H=ps.portalTop-y0,body=y0+.70*H,{uFront,uDoor,uChamber,uBack}=ps;
  const half=PORTAL.half,oh=PORTAL.openHalf,top=y0+PORTAL.openHeight;
  for(const s of [-1,1]){
    const v=a=>s*a;
    block(uFront,uDoor-.03,Math.min(v(oh),v(half)),Math.max(v(oh),v(half)),yb,body,RED);
    block(uDoor,uChamber-.03,Math.min(v(PASSAGE.recessHalf+.03),v(half)),Math.max(v(PASSAGE.recessHalf+.03),v(half)),yb,body,RED);
    if(uBack>uChamber)block(uChamber,uBack,Math.min(v(PASSAGE.half+.03),v(half)),Math.max(v(PASSAGE.half+.03),v(half)),yb,body,RED);
    block(uFront-.05,uFront+.3,Math.min(v(half-.38),v(half-.015)),Math.max(v(half-.38),v(half-.015)),y0+.45,body-.02,'#c34536');   // doors recheck: outer side 1.5 cm inside the body's (was the same plane)
    block(uFront-.07,uFront+.3,Math.min(v(half-.42),v(half+.02)),Math.max(v(half-.42),v(half+.02)),yb+.2,y0+.45,WHITE);
    // Studded timber leaves folded against the recess sides, iron grilles in their upper third.
    const lv=[v(PASSAGE.leaf[0]),v(PASSAGE.leaf[1])].sort((p,q)=>p-q);
    block(uDoor+.05,uDoor+1.25,lv[0],lv[1],y0-.02,y0+3.85,WOOD);
    for(let i=1;i<4;i++)block(uDoor+.05+i*.3-.02,uDoor+.05+i*.3+.02,lv[0]-.03,lv[1]+.03,y0+2.55,y0+3.7,IRON);
    for(let j=0;j<4;j++)block(uDoor+.06,uDoor+1.24,lv[0]-.03,lv[1]+.03,y0+2.6+j*.35,y0+2.64+j*.35,IRON);
  }
  block(uFront,uDoor-.03,-oh,oh,top,body,RED);
  block(uDoor,uChamber-.03,-PASSAGE.recessHalf-.03,PASSAGE.recessHalf+.03,y0+PASSAGE.recessSpring+PASSAGE.recessHalf+.05,body,RED);
  if(uBack>uChamber)block(uChamber,uBack,-PASSAGE.half-.03,PASSAGE.half+.03,y0+PASSAGE.crown+.05,body,RED);
  block(uFront-.04,uFront+.2,-oh-.01,oh+.01,y0+.55*H,y0+.66*H,WHITE);   // 1 cm into the side blocks: no side plane shared with the lintel
  // Cornice: fascia, projecting moulding and crown (white), then attic, rim and two-stage bell cap (red).
  block(uFront-.18,uBack,-half-.15,half+.15,body,y0+.74*H,WHITE);
  block(uFront-.25,uBack,-half-.22,half+.22,y0+.74*H,y0+.77*H,WHITE);
  block(uFront-.3,uBack,-half-.28,half+.28,y0+.77*H,y0+.79*H,WHITE);
  block(uFront-.02,uBack,-half+.08,half-.08,y0+.79*H,y0+.875*H,RED);
  block(uFront-.12,uBack,-half-.06,half+.06,y0+.875*H,y0+.885*H,WHITE);
  const depth=uBack-uFront+.24,uc=(uFront+uBack)/2;
  const cap1=own(frustum(2*half+.12,depth,2*half-.7,depth-.6,.045*H)),cap2=own(frustum(2*half-.7,depth-.6,2*half-1.4,depth-1.2,.07*H));
  bake(cap1,...P3(uc,0,y0+.9075*H),1,1,1,RED,ry,'solid');bake(cap2,...P3(uc,0,y0+.965*H),1,1,1,RED,ry,'solid');

  // Plastered recess (semicircular) and segmental barrel vault (Wikimedia Commons curid=81591500), drawn facing the passage interior.
  const fy=ps.floorAt,rh=PASSAGE.recessHalf,rs=PASSAGE.recessSpring,hh=PASSAGE.half,sp=PASSAGE.spring,cr=PASSAGE.crown;
  const R=(hh*hh+(cr-sp)**2)/(2*(cr-sp)),cy=cr-R,vault=v=>cy+Math.sqrt(Math.max(0,R*R-v*v));
  const arc=(r,c0,steps,f)=>Array.from({length:steps+1},(_,i)=>{const t=Math.PI*i/steps;return f(Math.cos(t)*r,c0+Math.sin(t)*r);});
  for(const s of [-1,1]){
    plaster.quad(P3(uDoor,s*rh,fy(uDoor)-.05),P3(uChamber,s*rh,fy(uChamber)-.05),P3(uChamber,s*rh,fy(uChamber)+rs),P3(uDoor,s*rh,fy(uDoor)+rs),PLASTER,[-s*px,0,-s*pz]);
    plaster.quad(P3(uChamber,s*hh,fy(uChamber)-.05),P3(ps.uInner,s*hh,fy(ps.uInner)-.05),P3(ps.uInner,s*hh,fy(ps.uInner)+sp),P3(uChamber,s*hh,fy(uChamber)+sp),PLASTER,[-s*px,0,-s*pz]);
  }
  const recessArc=arc(rh,rs,10,(v,y)=>[v,y]);
  for(let i=0;i<10;i++){const [v0,h0]=recessArc[i],[v1,h1]=recessArc[i+1],mv=(v0+v1)/2,mh=(h0+h1)/2-rs;
    const n0=[-v0*px,-(h0-rs),-v0*pz],n1=[-v1*px,-(h1-rs),-v1*pz];
    plaster.quad(P3(uDoor,v0,fy(uDoor)+h0),P3(uChamber,v0,fy(uChamber)+h0),P3(uChamber,v1,fy(uChamber)+h1),P3(uDoor,v1,fy(uDoor)+h1),PLASTER,[-mv*px,-mh,-mv*pz],2.6,[n0,n0,n1,n1]);}
  const a0=Math.asin(hh/R),vaultPts=Array.from({length:17},(_,i)=>{const t=-a0+2*a0*i/16;return [R*Math.sin(t),cy+R*Math.cos(t)];});
  for(let i=0;i<16;i++){const [v0,h0]=vaultPts[i],[v1,h1]=vaultPts[i+1],mv=(v0+v1)/2,mh=(h0+h1)/2-cy;
    const n0=[-v0*px,-(h0-cy),-v0*pz],n1=[-v1*px,-(h1-cy),-v1*pz];
    plaster.quad(P3(uChamber,v0,fy(uChamber)+h0),P3(ps.uInner,v0,fy(ps.uInner)+h0),P3(ps.uInner,v1,fy(ps.uInner)+h1),P3(uChamber,v1,fy(uChamber)+h1),
      PLASTER,[-mv*px,-mh,-mv*pz],2.6,[n0,n0,n1,n1]);}
  // End walls, as shapes with holes: chamber section minus recess (at uChamber) and recess minus doorway (at uDoor).
  function endWall(u,outline,hole,colour,target) {
    const shape=new THREE.Shape(outline.map(([v,h])=>new THREE.Vector2(v,h)));shape.holes.push(new THREE.Path(hole.map(([v,h])=>new THREE.Vector2(v,h))));
    const g=new THREE.ShapeGeometry(shape),pos=g.attributes.position,idx=g.index,y=fy(u);
    for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return P3(u,pos.getX(j),y+pos.getY(j));});target.tri(q[0],q[1],q[2],colour,inward);}
    g.dispose();
  }
  endWall(uChamber,[[-hh,-.05],[hh,-.05],...vaultPts.slice().reverse()],[[-rh,-.04],[rh,-.04],...recessArc],PLASTER,plaster);
  endWall(uDoor,[[-rh,-.05],[rh,-.05],...recessArc],[[-oh,-.04],[oh,-.04],[oh,PORTAL.openHeight],[-oh,PORTAL.openHeight]],PLASTER,plaster);

  // Inner face (weathered masonry, Wikimedia Commons curid=81591500) with the segmental opening; masonry cap and rim parapet over the bore.
  const ui=ps.uInner,iy=ps.innerY,ih=PASSAGE.innerHalf,it=ps.inner.top;
  {
    // Outline: terrain-following foot, then the top; hole: floor line, then the vault from +v back to −v (not crossing).
    const shape=new THREE.Shape([...ps.inner.footProfile,[ih,it],[-ih,it]].map(([v,h])=>new THREE.Vector2(v,h)));
    shape.holes.push(new THREE.Path([[-hh,iy-.02],[hh,iy-.02],...vaultPts.slice().reverse().map(([v,h])=>[v,iy+h])].map(([v,h])=>new THREE.Vector2(v,h))));
    const g=new THREE.ShapeGeometry(shape),pos=g.attributes.position,idx=g.index;
    for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return P3(ui,pos.getX(j),pos.getY(j));});masonry.tri(q[0],q[1],q[2],'#ffffff',inward);}
    g.dispose();
    const c0=ps.inner.capFrom,ct=ps.cutTop-.1;
    masonry.quad(P3(c0,-ih,it),P3(ui,-ih,it),P3(ui,ih,it),P3(c0,ih,it),'#bdb3a2',up,1.6);
    for(const s of [-1,1])masonry.quad(P3(c0,s*ih,ct),P3(ui,s*ih,ct),P3(ui,s*ih,it),P3(c0,s*ih,it),'#ffffff',[s*px,0,s*pz]);
    const pr=it+PARAPET.rise;
    masonry.quad(P3(ui,-ih,it),P3(ui,ih,it),P3(ui,ih,pr),P3(ui,-ih,pr),'#ffffff',inward);
    masonry.quad(P3(ui-.55,-ih,pr),P3(ui,-ih,pr),P3(ui,ih,pr),P3(ui-.55,ih,pr),'#cfc8bb',up);
    masonry.quad(P3(ui-.55,-ih,it),P3(ui-.55,ih,it),P3(ui-.55,ih,pr),P3(ui-.55,-ih,pr),'#ffffff',out);
    for(const s of [-1,1])masonry.quad(P3(ui-.55,s*ih,it),P3(ui,s*ih,it),P3(ui,s*ih,pr),P3(ui-.55,s*ih,pr),'#ffffff',[s*px,0,s*pz]);
    for(const k of ps.kerbs){const v0=k.side<0?-2.45:hh,v1=k.side<0?-hh:2.45;block(ui,ps.uIn,v0,v1,iy-.4,k.top,STONE);}
  }
  // Central line of flat stones down the cobbled floor (Wikimedia Commons curid=81591500).
  for(let i=0;i<4;i++){
    const ua=[ps.uOut,uFront,uChamber,ui,ps.uIn][i],ub=[ps.uOut,uFront,uChamber,ui,ps.uIn][i+1];
    const ya=i===0?height(...P(ua,0))+.012:fy(ua)+.012,yb=i===3?height(...P(ub,0))+.012:fy(ub)+.012;
    masonry.quad(P3(ua,-.27,ya),P3(ub,-.27,yb),P3(ub,.27,yb),P3(ua,.27,ya),'#7a7568',up,1.1);
  }

  // Low rounded seawall (Wikimedia Commons curid=81591499, curid=80420013), masonry both faces.
  const sf=gate.seaFrame;
  for(let i=0;i+1<sf.length;i++){
    const a=sf[i],b=sf[i+1],o=(f,d,y)=>[f.x+f.nx*d,y,f.z+f.nz*d],ta=gate.seaTop[i],tb=gate.seaTop[i+1];
    const ina=Math.min(height(a.x+a.nx*.3,a.z+a.nz*.3),ta-.3)-.3,inb=Math.min(height(b.x+b.nx*.3,b.z+b.nz*.3),tb-.3)-.3;
    masonry.quad(o(a,.28,ina),o(b,.28,inb),o(b,.28,tb),o(a,.28,ta),'#ffffff',[a.nx,0,a.nz]);
    masonry.quad(o(a,.28,ta),o(b,.28,tb),o(b,0,tb+.08),o(a,0,ta+.08),'#d3ccbf',[a.nx*.5,1,a.nz*.5]);
    masonry.quad(o(a,0,ta+.08),o(b,0,tb+.08),o(b,-.28,tb),o(a,-.28,ta),'#d3ccbf',[-a.nx*.5,1,-a.nz*.5]);
    masonry.quad(o(a,-.28,gate.seaBottom[i]),o(b,-.28,gate.seaBottom[i+1]),o(b,-.28,tb),o(a,-.28,ta),'#ffffff',[-a.nx,0,-a.nz]);
  }
  {const e=sf.at(-1),dx=e.x-sf.at(-2).x,dz=e.z-sf.at(-2).z,l=Math.hypot(dx,dz);
    masonry.quad([e.x+e.nx*.28,gate.seaBottom.at(-1),e.z+e.nz*.28],[e.x-e.nx*.28,gate.seaBottom.at(-1),e.z-e.nz*.28],
      [e.x-e.nx*.28,gate.seaTop.at(-1),e.z-e.nz*.28],[e.x+e.nx*.28,gate.seaTop.at(-1),e.z+e.nz*.28],'#ffffff',[dx/l,0,dz/l]);}

  // Garitas (Wikimedia Commons curid=80420696, curid=80420013, curid=80420699, curid=122996449): corbelled base, cylindrical body with slits, cornice ring, dome and finial.
  for(const g of gate.garitas)drawGarita(masonry,g,{bake,cylinder,sphere,box});

  // Bollards (Wikimedia Commons curid=123113261): grey concrete posts with white caps; rip-rap boulders (Wikimedia Commons curid=123113261, curid=114692556) as one faceted instance set.
  // Stairs mapped flights drawn as real uniform treads (support and wheel seat: js/sj-stairs.js, registered by
  // the layout). Each tread a stone box from below the ground to its top; nosing bars as the module draws them.
  for(const f of gate.stairs??[]){const ry=Math.atan2(f.frame.dx,f.frame.dz),N_=f.nosing;
    for(const t of f.treads){const len=t.s1-t.s0+(t.nosing?.02:0),c=t.quad.reduce((q,p)=>[q[0]+p[0]/4,q[1]+p[1]/4],[0,0]),off=t.nosing?.01:0;
      const cx=c[0]+f.frame.dx*off,cz=c[1]+f.frame.dz*off;bake(box,cx,(f.low+t.top)/2,cz,f.width,t.top-f.low,len,'#bdb6a8',ry,'solid');
      if(t.nosing){const sN=t.s0-N_.out+N_.depth/2,mid=(t.s0+t.s1)/2,nx_=cx+f.frame.dx*(sN-mid-off),nz_=cz+f.frame.dz*(sN-mid-off);
        bake(box,nx_,t.top+N_.up-.015,nz_,f.width+.01,.03,N_.depth,'#cfc8ba',ry,'facade');}}
    // Fitted aprons (module): drawn exactly as their physical facets, in the tread stone.
    if(f.aprons?.length){const pos=[];for(const tri of f.aprons){const [p,q,w]=tri,cr=(q[0]-p[0])*(w[2]-p[2])-(q[2]-p[2])*(w[0]-p[0]);for(const v of cr<0?[p,q,w]:[p,w,q])pos.push(...v);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,'#bdb6a8',0,'solid');g.dispose();}}
  for(const p of gate.bollards){const f=p.foot??p.y;bake(cylinder,p.x,(f+p.y+.68)/2,p.z,.13,p.y+.68-f,.13,'#9e998e',0,'solid');bake(cylinder,p.x,p.y+.74,p.z,.14,.12,.14,'#f0eee7',0,'solid');}
  // Rip-rap: drawn by area `coast`  (sj-coast.js, the Paseo stone band); gate.rocks is empty.

  // Lamps (Wikimedia Commons curid=80420009, curid=81591499, curid=122996449): tall black posts with lanterns along the wall side.
  for(const {x,y,z} of gate.lamps){
    bake(cylinder,x,y+2.05,z,.07,4.1,.07,IRON,0,'solid');bake(cylinder,x,y+.25,z,.19,.5,.19,IRON,0,'solid');
    bake(box,x,y+4.25,z,.3,.52,.3,'#e1d3a4',0,'solid');bake(box,x,y+4.53,z,.36,.06,.36,IRON,0,'solid');
  }
  for(const b of gate.benches){
    const f={angle:b.heading,point:(u,y,d=0)=>[b.x+Math.cos(b.heading)*u+Math.sin(b.heading)*d,y,b.z-Math.sin(b.heading)*u+Math.cos(b.heading)*d]};
    const lb=(u,y,d,w,h,dd,c)=>bake(box,...f.point(u,y,d),w,h,dd,c,f.angle,'solid');
    // Each leg runs from its own ground (5 cm buried) to the level seat.
    for(const l of b.legs){const lo=l.ground-.05,hi=b.y+.5;lb(l.u,(lo+hi)/2,0,.085,hi-lo,.5,IRON);}
    for(let i=0;i<3;i++)lb(0,b.y+.49,-.22+i*.2,b.width,.075,.15,'#797447');
    for(const y of [.72,.88])lb(0,b.y+y,-.26,b.width,.14,.07,'#797447');
    for(const l of b.legs)lb(l.u,b.y+.7,-.26,.06,.44,.06,IRON); // backrest uprights (the backrest floated 12 cm)
  }
  // Raised round planter with one broad shade tree (Wikimedia Commons curid=81591499).
  const pl=gate.planter;
  const planterG=own(new THREE.CylinderGeometry(pl.radius,pl.radius,pl.foundation.maxY-pl.foundation.minY,24));
  bake(planterG,pl.x,(pl.foundation.minY+pl.foundation.maxY)/2,pl.z,1,1,1,'#bdb19c',0,'solid');
  bake(cylinder,pl.x,pl.y+.015,pl.z,pl.radius-.18,.04,pl.radius-.18,'#4d3e2f',0,'solid');
  bake(cylinder,pl.x,pl.y+2.585,pl.z,.36,5.23,.36,'#6f6553',0,'solid');   // foot 3 cm into the planter, not on the soil disc's underside plane
  const limb=own(new THREE.CylinderGeometry(1,1,1,6,1,true)),from=new THREE.Vector3(pl.x,pl.y+3.6,pl.z),q=new THREE.Quaternion();
  for(let j=0;j<8;j++){const a=j*Math.PI/4+.3,r=2.3+(j%2)*.7,p=[pl.x+Math.cos(a)*r,pl.y+5.9+(j%3)*.5,pl.z+Math.sin(a)*r];
    // Open six-sided limb, oriented once (the shared segment bakes capped 12-sided cylinders).
    const to=new THREE.Vector3(...p),d=to.clone().sub(from),lg=limb.clone();lg.scale(.14,d.length(),.14);
    lg.applyQuaternion(q.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));
    bake(lg,(from.x+to.x)/2,(from.y+to.y)/2,(from.z+to.z)/2,1,1,1,'#6f6553',0,'solid');lg.dispose();
    bake(sphere,...p,2.7,1.8,2.5,['#3d6339','#4a7044','#355a36'][j%3],a,'leaf');}
  bake(sphere,pl.x,pl.y+7.6,pl.z,3.4,1.9,3.2,'#4b7246',0,'leaf');
  // Tall coconut-type palms with curved trunks and drooping crowns (Wikimedia Commons curid=80420696, curid=81591499, curid=80420699). One 6-sided tube per trunk and
  // midribs folded into each frond ribbon keep the two palms to a few thousand vertices.
  for(const [k,p] of gate.palms.entries()){
    const dir=k?-.6:.5,lx=Math.cos(dir)*p.lean,lz=Math.sin(dir)*p.lean,pts=[];
    for(let i=0;i<=8;i++){const t=i/8;pts.push(new THREE.Vector3(p.x+lx*p.height*t*t*.5,p.y+p.height*t,p.z+lz*p.height*t*t*.5));}
    const trunk=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),8,.19,6,false),tp=trunk.attributes.position;
    for(let i=0;i<tp.count;i++){const t=(tp.getY(i)-p.y)/p.height,c=pts[Math.round(Math.min(1,Math.max(0,t))*8)],f=1-.3*t; // taper
      tp.setXYZ(i,c.x+(tp.getX(i)-c.x)*f,tp.getY(i),c.z+(tp.getZ(i)-c.z)*f);}
    trunk.computeVertexNormals();bake(trunk,0,0,0,1,1,1,'#8b8069',0,'solid');trunk.dispose();
    // Crown (owner: the single ball read as a coconut skewered by the trunk). Wikimedia Commons curid=137843368: a brown fibrous boot of old frond
    // bases, slightly wider than the trunk, continues it along the leaning top tangent; Wikimedia Commons curid=71816504 (species structure only):
    // separate ~25 cm nuts hang in a bunch round the trunk top under the frond bases. Each nut clears the hexagonal trunk
    // and sinks 2 cm into the boot face at its own height; the boot's 0.18 m base covers the trunk end (no trunk tip through anything).
    const c=pts[8],T=c.clone().sub(pts[7]).normalize(),U=new THREE.Vector3(-T.z,0,T.x).normalize(),V=new THREE.Vector3().crossVectors(T,U);
    const boot=new THREE.CylinderGeometry(.3,.18,.8,8,1,false);boot.applyQuaternion(q.setFromUnitVectors(new THREE.Vector3(0,1,0),T));
    const mid=c.clone().addScaledVector(T,-.15);bake(boot,mid.x,mid.y,mid.z,1,1,1,'#6b5a3b',0,'solid');boot.dispose();
    for(let n=0;n<5;n++){const a=n*1.33+k*.9,along=-.2-(n%3)*.06,r=.12+(n%2)*.015,out=(.18+.12*(along+.55)/.8)*Math.cos(Math.PI/8)+r-.02;
      const at=c.clone().addScaledVector(T,along).addScaledVector(U,Math.cos(a)*out).addScaledVector(V,Math.sin(a)*out);
      bake(sphere,at.x,at.y,at.z,r,r*1.12,r,['#8a8738','#7b7a31','#9c8a3f'][n%3],a,'solid');}
    for(let j=0;j<14;j++){
      const a=j*Math.PI*2/14+k*.4,pitch=(j%3)*.25-.1,L=3.7+(j%2)*.5;
      const point=u=>[c.x+Math.cos(a)*L*u,c.y+L*(.55*u-1.05*u*u+pitch*u*.5),c.z+Math.sin(a)*L*u];
      // Leaflet roots sit on the rib itself: the rib is the 4-chord polyline of the curve and the roots are sampled on it
      // (roots on the curve floated up to 0.22 m off a coarser straight rib).
      const rib=u=>{const k=Math.min(3,Math.floor(Math.max(0,u)*4)),f=u*4-k,p0=point(k/4),p1=point((k+1)/4);return p0.map((v,i)=>v+(p1[i]-v)*f);};
      const tris=[];
      for(let q=1;q<=10;q++){const u=q/11,at=rib(u),next=rib(u+.08),width=.62*Math.sin(u*Math.PI);
        for(const side of [-1,1])tris.push(...at,at[0]+Math.cos(a+1.25*side)*width,at[1]-.32*width,at[2]+Math.sin(a+1.25*side)*width,...next);}
      for(let q=0;q<4;q++){const p0=point(q/4),p1=point((q+1)/4),sx=-Math.sin(a)*.035,sz=Math.cos(a)*.035;
        tris.push(p0[0]-sx,p0[1],p0[2]-sz,p0[0]+sx,p0[1],p0[2]+sz,p1[0]+sx,p1[1],p1[2]+sz,p0[0]-sx,p0[1],p0[2]-sz,p1[0]+sx,p1[1],p1[2]+sz,p1[0]-sx,p1[1],p1[2]-sz);}
      const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(tris,3));fg.computeVertexNormals();
      bake(fg,0,0,0,1,1,1,['#3b6337','#4d7240','#5f8448'][j%3],0,'leaf');fg.dispose();
    }
  }

  // Shared texture/material owners; one draw per surface family.
  const masonryMat=mat({map:masonryTexture(textures),vertexColors:true,roughness:.92,metalness:0});
  const plasterMat=mat({vertexColors:true,roughness:.9,metalness:0});
  const result=[];
  for(const [buffer,material,name,shadow] of [[masonry,masonryMat,'sj-plaza-gate-masonry',true],[plaster,plasterMat,'sj-plaza-gate-plaster',false]]){
    const g=own(buffer.geometry()),m=new THREE.Mesh(g,material);m.name=name;m.castShadow=shadow;m.receiveShadow=true;scene.add(m);meshes.push(m);result.push(m);}
  return {masonryTriangles:masonry.count/3,plasterTriangles:plaster.count/3,rocks:gate.rocks.length};
}
