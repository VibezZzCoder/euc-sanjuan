/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Paseo de la Princesa east to Raíces (Wikimedia Commons curid=80420009, curid=182263283, curid=195143828, curid=122996449) visuals — © 2026 VibezZzCoder, MIT. All dimensions come from sj-princesa-layout.js.
// ctx: {scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height} — same shared pools buildGate/buildFort use.
// Wikimedia Commons curid=80420009: battered bastion, broad seawall with ochre inner face and pale coping, lamps on stone bases, benches, shade tree.
// Wikimedia Commons curid=122996449: weathered wall with a salient garita, green lattice railing, terracotta pillars, fenced planters, tree row.
// Wikimedia Commons curid=195143828: Raíces fountain (ochre basin, rock mass, pale bronze group, jets) between two flagpoles.
import * as THREE from 'three/webgpu';
import {tallPalm} from './sj-palm.js';
import {surfaceBuffer,drawGarita,masonryTexture} from './sj-gate.js';
import {streetKit} from './sj-street-kit.js';
import {smallWaterMaterial,compileAtBoot} from './sj-sea.js';

const IRON='#1f2523',GREEN='#2f5b45',TERRA='#b4573b',BRONZE='#6f6a5c';

export function buildPrincesa(layout,ctx) {
  if(!layout?.stations?.length)return null;
  const {scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}=ctx;
  const {PARAPET,PLINTH,RAIL}=layout.constants;
  const masonry=surfaceBuffer(),up=[0,1,0];
  const W=(s,key,y)=>[s[key][0],y,s[key][1]];
  // Cylinder between two points (shared instanced pool). bake turns local +Y to Ry(ry)·Rz(rz)·Y = (−sin rz·cos ry,
  // cos rz, sin rz·sin ry), so rz = acos(dy) and ry = atan2(dz,−dx); parts built this way meet at their joints.
  const seg=(a,b,r,colour,kind='solid')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-6)return;
    const rz=Math.acos(Math.max(-1,Math.min(1,dy/l))),ry=Math.hypot(dx,dz)>1e-9?Math.atan2(dz,-dx):0;
    bake(cylinder,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,l,r,colour,ry,kind,rz);};
  // Bastion faces keep the gate's warm masonry (Wikimedia Commons curid=80420009); the Fortaleza/Raíces curtains are the darker weathered grey with
  // pale lime blotches of Wikimedia Commons curid=182263283, curid=122996449, curid=37349529 (broad slow variation; the shared texture supplies the blotches).
  const tone=s=>{const k=.9+.1*Math.sin(s.s*.37)*Math.sin(s.s*.11+1.3),grey=s.seg>=2?1:s.seg===1?Math.max(0,Math.min(1,(s.s-80)/10)):0;
    const top=new THREE.Color('#ffffff').lerp(new THREE.Color('#b9b6ad'),grey),foot=new THREE.Color('#bdb4a3').lerp(new THREE.Color('#8f8c84'),grey);
    return [foot.multiplyScalar(k),top.multiplyScalar(k)];};
  // ---- City wall: battered face, plinth, cordón; masonry parapet (bastion) or coping + green lattice railing. ----
  let railBars=0;
  for(const {a,b,parapet} of layout.walls){
    const n=[a.nx,0,a.nz],ni=[-a.nx,0,-a.nz],[ab,at]=tone(a),[bb,bt]=tone(b);
    masonry.quad(W(a,'B',a.bottom),W(b,'B',b.bottom),W(b,'T',b.crest),W(a,'T',a.crest),[ab,bb,bt,at],n,3.4);
    masonry.quad(W(a,'LB',a.bottom),W(b,'LB',b.bottom),W(b,'L',b.plinthTop),W(a,'L',a.plinthTop),'#d9d2c5',n);
    masonry.quad(W(a,'L',a.plinthTop),W(b,'L',b.plinthTop),W(b,'F',b.plinthTop),W(a,'F',a.plinthTop),'#d9d2c5',up);
    masonry.quad(W(a,'T',a.crest-.14),W(b,'T',b.crest-.14),W(b,'C',b.crest-.06),W(a,'C',a.crest-.06),'#e4ddd0',[n[0],-1,n[2]]);
    masonry.quad(W(a,'C',a.crest-.06),W(b,'C',b.crest-.06),W(b,'C',b.crest+.08),W(a,'C',a.crest+.08),'#e4ddd0',n);
    masonry.quad(W(a,'C',a.crest+.08),W(b,'C',b.crest+.08),W(b,'T',b.crest+.16),W(a,'T',a.crest+.16),'#e4ddd0',[n[0],1,n[2]]);
    const rise=parapet?PARAPET.rise:RAIL.coping,pa=a.walk+rise,pb=b.walk+rise;
    masonry.quad(W(a,'T',a.crest+.16),W(b,'T',b.crest+.16),W(b,'T',pb),W(a,'T',pa),[at,bt,bt,at],n);
    if(parapet){const mid=q=>[(q.T[0]+q.Q[0])/2,(q.T[1]+q.Q[1])/2],ma=mid(a),mb=mid(b);
      masonry.quad(W(a,'T',pa),W(b,'T',pb),[mb[0],pb+.07,mb[1]],[ma[0],pa+.07,ma[1]],'#cfc8bb',[n[0]*.4,1,n[2]*.4]);
      masonry.quad([ma[0],pa+.07,ma[1]],[mb[0],pb+.07,mb[1]],W(b,'Q',pb),W(a,'Q',pa),'#cfc8bb',[ni[0]*.4,1,ni[2]*.4]);}
    else masonry.quad(W(a,'T',pa),W(b,'T',pb),W(b,'Q',pb),W(a,'Q',pa),'#d4ccbd',up,1.4);
    masonry.quad(W(a,'Q',pa),W(b,'Q',pb),W(b,'Q',b.walk),W(a,'Q',a.walk),'#ffffff',ni);
    masonry.quad(W(a,'Q',a.walk),W(b,'Q',b.walk),W(b,'W',b.walk),W(a,'W',a.walk),'#bdb3a2',up,1.6);
    masonry.quad(W(a,'W',a.walk),W(b,'W',b.walk),W(b,'W',b.kerb),W(a,'W',a.kerb),'#ffffff',ni);
    if(!parapet){
      // Wikimedia Commons curid=122996449 green lattice railing on the coping: posts, top/bottom rails and an X per bay.
      const p0=[a.T[0]+(a.Q[0]-a.T[0])*.25,a.T[1]+(a.Q[1]-a.T[1])*.25],p1=[b.T[0]+(b.Q[0]-b.T[0])*.25,b.T[1]+(b.Q[1]-b.T[1])*.25];
      const len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);if(len<.05)continue;
      const ry=Math.atan2(-(p1[1]-p0[1]),p1[0]-p0[0]),y0=(pa+pb)/2,h=RAIL.rise,cx=(p0[0]+p1[0])/2,cz=(p0[1]+p1[1])/2;
      // Fine rail parts (2.5–6 cm, under one shadow texel) receive but don't cast: as sun-map casters they printed
      // aliased stripes on the bank below the wall.
      bake(box,p0[0],pa+h/2,p0[1],.06,h,.06,GREEN,ry,'facade');
      for(const y of [.08,h-.04])bake(box,cx,y0+y,cz,len,.045,.045,GREEN,ry,'facade');
      const diag=Math.hypot(len,h-.12),tilt=Math.atan2(h-.12,len);
      for(const s of [-1,1])bake(box,cx,y0+h/2,cz,diag,.025,.025,GREEN,ry,'facade',s*tilt);
      railBars+=5;
    }
  }
  // Run end (east, against the unbuilt DEM scarp) and the parapet → railing change at the Fortaleza flank.
  {const s=layout.stations.at(-1),t=[s.nz,0,-s.nx];
    masonry.quad(W(s,'B',s.bottom),W(s,'W',s.bottom),W(s,'W',s.walk),W(s,'T',s.walk),'#ffffff',t);
    masonry.quad(W(s,'T',s.walk),W(s,'Q',s.walk),W(s,'Q',s.walk+RAIL.coping),W(s,'T',s.walk+RAIL.coping),'#ffffff',t);}
  for(const {s,dir} of layout.ends){const t=[dir*s.nz,0,-dir*s.nx];
    masonry.quad(W(s,'T',s.walk+RAIL.coping),W(s,'Q',s.walk+RAIL.coping),W(s,'Q',s.walk+PARAPET.rise),W(s,'T',s.walk+PARAPET.rise),'#ffffff',t);}
  for(const g of layout.garitas)drawGarita(masonry,g,{bake,cylinder,sphere,box});

  // ---- Seawall (Wikimedia Commons curid=80420009): masonry outer face, broad pale rounded coping, ochre-red painted inner face. ----
  const sf=layout.seaFrame;
  for(let i=0;i+1<sf.length;i++){
    const a=sf[i],b=sf[i+1],o=(f,d,y)=>[f.x+f.nx*d,y,f.z+f.nz*d],ta=layout.seaTop[i],tb=layout.seaTop[i+1];
    const ina=Math.min(height(a.x+a.nx*(a.half+.05),a.z+a.nz*(a.half+.05)),ta-.3)-.3,inb=Math.min(height(b.x+b.nx*(b.half+.05),b.z+b.nz*(b.half+.05)),tb-.3)-.3;
    masonry.quad(o(a,a.half,ina),o(b,b.half,inb),o(b,b.half,tb-.1),o(a,a.half,ta-.1),'#c9826a',[a.nx,0,a.nz],2.2);
    masonry.quad(o(a,a.half,ta-.1),o(b,b.half,tb-.1),o(b,a.half*.55,tb+.04),o(a,a.half*.55,ta+.04),'#e2dacb',[a.nx*.7,1,a.nz*.7]);
    masonry.quad(o(a,a.half*.55,ta+.04),o(b,b.half*.55,tb+.04),o(b,-b.half*.55,tb+.04),o(a,-a.half*.55,ta+.04),'#e2dacb',up,1.2);
    masonry.quad(o(a,-a.half*.55,ta+.04),o(b,-b.half*.55,tb+.04),o(b,-b.half,tb-.1),o(a,-a.half,ta-.1),'#d8cfbe',[-a.nx*.7,1,-a.nz*.7]);
    masonry.quad(o(a,-a.half,layout.seaBottom[i]),o(b,-b.half,layout.seaBottom[i+1]),o(b,-b.half,tb-.1),o(a,-a.half,ta-.1),'#ffffff',[-a.nx,0,-a.nz]);
  }
  {const e=sf.at(-1),p=sf.at(-2),dx=e.x-p.x,dz=e.z-p.z,l=Math.hypot(dx,dz),top=layout.seaTop.at(-1),bot=layout.seaBottom.at(-1);
    masonry.quad([e.x+e.nx*e.half,bot,e.z+e.nz*e.half],[e.x-e.nx*e.half,bot,e.z-e.nz*e.half],[e.x-e.nx*e.half,top,e.z-e.nz*e.half],[e.x+e.nx*e.half,top,e.z+e.nz*e.half],'#ffffff',[dx/l,0,dz/l]);}

  // ---- Raíces fountain (Wikimedia Commons curid=195143828, curid=37349529, curid=149388353): shallow step, low moulded salmon-sandstone outer basin with pilaster blocks, a
  // raised inner basin brimming over its rim, the ochre rock with the bronze group, and tall pale jets.
  // Everything below is built joint to joint and seated on the surfaces it stands on.
  const f=layout.fountain,ib=f.inner;
  const inward=g=>{const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}
    const nn=g.attributes.normal;for(let i=0;i<nn.count;i++)nn.setXYZ(i,-nn.getX(i),-nn.getY(i),-nn.getZ(i));return g;};
  bake(own(new THREE.CylinderGeometry(f.stepRadius,f.stepRadius+.08,f.stepTop-f.bottom,48)),f.x,(f.stepTop+f.bottom)/2,f.z,1,1,1,'#b48a72',0,'solid');
  bake(own(new THREE.CylinderGeometry(f.radius,f.radius+.05,f.rimTop-f.stepTop,48,1,true)),f.x,(f.rimTop+f.stepTop)/2,f.z,1,1,1,'#c48d70',0,'solid');
  {const g=own(new THREE.TorusGeometry(f.radius+.04,.09,4,48));g.rotateX(Math.PI/2);bake(g,f.x,f.stepTop+.08,f.z,1,1,1,'#b9846a',0,'solid');}
  {const g=own(new THREE.TorusGeometry(f.radius-.12,.17,6,48));g.rotateX(Math.PI/2);bake(g,f.x,f.rimTop,f.z,1,1,1,'#d7ab8d',0,'solid');}
  for(let i=0;i<16;i++){const a=(i+.5)*Math.PI/8,x=f.x+Math.cos(a)*(f.radius+.02),z=f.z+Math.sin(a)*(f.radius+.02);
    bake(box,x,(f.stepTop+f.rimTop+.08)/2,z,.18,f.rimTop+.08-f.stepTop,.5,'#c99273',-a,'solid');}
  bake(inward(own(new THREE.CylinderGeometry(f.radius-.29,f.radius-.29,f.rimTop-f.water+.1,48,1,true))),f.x,(f.rimTop+f.water-.1)/2,f.z,1,1,1,'#a98168',0,'solid');
  const waterMat=smallWaterMaterial({},ctx.scene);ctx.materials?.add(waterMat);   // js/sj-sea.js: ripple, sky Fresnel, sun
  for(const [r,y,name] of [[f.radius-.28,f.water,'sj-plaza-princesa-water'],[ib.radius-.18,ib.top-.05,'sj-plaza-princesa-water-upper']]){
    const g=own(new THREE.CircleGeometry(r,40));g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,waterMat);m.position.set(f.x,y,f.z);m.name=name;
    m.receiveShadow=true;compileAtBoot(m);scene.add(m);meshes.push(m);}
  bake(own(new THREE.CylinderGeometry(ib.radius,ib.radius+.06,ib.top-.15-(f.water-.3),40)),f.x,(ib.top-.15+f.water-.3)/2,f.z,1,1,1,'#c27f63',0,'solid');
  {const g=own(new THREE.TorusGeometry(ib.radius-.08,.15,6,40));g.rotateX(Math.PI/2);bake(g,f.x,ib.top,f.z,1,1,1,'#d29a7b',0,'solid');}
  // Rock (Wikimedia Commons curid=195143828): overlapping faceted boulders rising to a summit. Supports come from the very triangles baked.
  const rockY=ib.top-.12,rocks=[[0,.5,0,1.75,1.2,1.6,0],[-.15,1.15,.05,.8,.85,.75,.6],[1.25,.15,.75,1.0,.7,.9,1.1],[-1.1,.15,.95,1.0,.8,1.0,2.3],
    [.55,.1,-1.25,1.1,.7,.9,.4],[-.8,.1,-1.05,1.0,.75,.9,1.7],[1.5,0,-.35,.9,.55,.8,2.9]]; // [dx,dy,dz,rx,ry,rz,yaw]
  const rockTris=[];
  {const pos=sphere.attributes.position,ix=sphere.index,v=new THREE.Vector3(),o=new THREE.Object3D(),n=ix?ix.count:pos.count;
    rocks.forEach(([dx,dy,dz,rx,ry,rz,yaw],i)=>{o.position.set(f.x+dx,rockY+dy,f.z+dz);o.rotation.set(0,yaw,0);o.scale.set(rx,ry,rz);o.updateMatrix();
      for(let k=0;k<n;k+=3)rockTris.push([0,1,2].map(q=>v.fromBufferAttribute(pos,ix?ix.getX(k+q):k+q).applyMatrix4(o.matrix).toArray()));
      bake(sphere,f.x+dx,rockY+dy,f.z+dz,rx,ry,rz,['#8a6a48','#7b5e40','#9a7a52'][i%3],yaw,'solid');});}
  const rockTop=(x,z)=>{let top=-Infinity;
    for(const [a,b,c] of rockTris){const d=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(d)<1e-12)continue;
      const u=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/d,w=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/d;
      if(u>=0&&w>=0&&u+w<=1)top=Math.max(top,a[1]+u*(b[1]-a[1])+w*(c[1]-a[1]));}
    return Number.isFinite(top)?top:ib.top;};
  // Figures: limbs run joint to joint (cylinders between points), joints and hands overlap them, the head sits on a neck,
  // and each ankle reaches the rock under its own foot. Local frame: u forward (facing), v across, y up; units of height h.
  const figures=[];
  const person=(dx,dz,face,h,pose,colour)=>{const x=f.x+dx,z=f.z+dz,c=Math.cos(face),s=Math.sin(face);
    const at=(u,v)=>[x+c*u*h-s*v*h,z+s*u*h+c*v*h];
    const footY=[1,-1].map(side=>{const a=pose.legs[side>0?0:1].ankle;return rockTop(...at(a[0]+.04,a[2]*side))-.03;});
    const y0=Math.max(...footY),J=(u,y,v)=>{const [px,pz]=at(u,v);return [px,y0+y*h,pz];},P=pose.pelvis??.52;
    [1,-1].forEach((side,k)=>{const l=pose.legs[k],hip=J(0,P,.085*side),knee=J(l.knee[0],l.knee[1],l.knee[2]*side);
      const ankle=J(l.ankle[0],(footY[k]-y0)/h+.045,l.ankle[2]*side);
      seg(hip,knee,.066*h,colour);seg(knee,ankle,.05*h,colour);bake(sphere,...knee,.056*h,.056*h,.056*h,colour,0,'solid');
      const toe=J(l.ankle[0]+.075,(footY[k]-y0)/h+.022,l.ankle[2]*side);seg(ankle,toe,.04*h,colour);});
    bake(sphere,...J(0,P+.01,0),.1*h,.085*h,.14*h,colour,-face,'solid');
    seg(J(0,P,0),J(0,P+.22,0),.085*h,colour);bake(sphere,...J(0,P+.16,0),.095*h,.12*h,.145*h,colour,-face,'solid');
    const head=pose.head??[0,0];seg(J(0,P+.22,0),J(head[0]*.5,P+.335,0),.04*h,colour);
    bake(sphere,...J(head[0],P+.385,0),.075*h,.088*h,.068*h,colour,-face,'solid',head[1]);
    [1,-1].forEach((side,k)=>{const a=pose.arms[k],sh=J(0,P+.27,.145*side),el=J(a[0][0],a[0][1],a[0][2]*side),wr=J(a[1][0],a[1][1],a[1][2]*side);
      bake(sphere,...sh,.052*h,.052*h,.052*h,colour,0,'solid');seg(sh,el,.042*h,colour);seg(el,wr,.036*h,colour);
      bake(sphere,...el,.041*h,.041*h,.041*h,colour,0,'solid');bake(sphere,...wr,.043*h,.047*h,.036*h,colour,-face,'solid');});
    figures.push({x,z,y0,h,J});return J;};
  const STAND={legs:[{knee:[.02,.28,.09],ankle:[0,0,.09]},{knee:[.02,.28,.09],ankle:[0,0,.09]}]};
  const BR='#6c6a5c';
  // Main figure (Wikimedia Commons curid=195143828, curid=131971361, curid=149388353): slender, on the summit, one arm straight up holding a branch, the other out level, head up,
  // a long sash trailing in the wind.
  const main=person(-.1,.05,0,2.3,{...STAND,head:[.01,-.25],arms:[[[0,.97,.17],[.02,1.17,.13]],[[.04,.8,.38],[.07,.82,.6]]]},'#8d8a7c');
  {const w=main(.02,1.17,.13);seg(w,main(.04,1.36,.11),.012*2.3,'#8d8a7c');seg(main(.03,1.26,.12),main(.1,1.33,.2),.008*2.3,'#8d8a7c');
    seg(main(.03,1.3,.12),main(-.04,1.38,.05),.008*2.3,'#8d8a7c');
    const pts=[main(-.02,.8,-.12),main(-.12,.7,-.3),main(-.24,.6,-.5),main(-.38,.55,-.7),main(-.5,.56,-.86)],tri=[];
    for(let i=0;i+1<pts.length;i++){const a=pts[i],b=pts[i+1],wa=.07*(1-i/5)*2.3,wb=.07*(1-(i+1)/5)*2.3;
      tri.push(a[0],a[1]+wa,a[2],b[0],b[1]+wb,b[2],b[0],b[1]-wb,b[2],a[0],a[1]+wa,a[2],b[0],b[1]-wb,b[2],a[0],a[1]-wa,a[2]);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(tri,3));g.computeVertexNormals();
    bake(g,0,0,0,1,1,1,'#8d8a7c',0,'leaf');g.dispose();}
  // The group round the rock (Wikimedia Commons curid=195143828, curid=149388353): raised-arm adult and a child on the north side, an adult with one arm out on
  // the south, a seated figure south-west, one reaching toward the horse, one facing the bay.
  person(-.2,-1.35,-.9,1.8,{...STAND,arms:[[[.03,.93,.27],[.08,1.08,.16]],[[.03,.93,.27],[.08,1.08,.16]]]},BR);
  person(.85,-1.6,-.5,1.1,{...STAND,arms:[[[.05,.62,.2],[.18,.62,.22]],[[.0,.6,.2],[.04,.44,.2]]]},BR);
  person(.3,1.45,.75,1.85,{...STAND,arms:[[[.05,.78,.36],[.12,.78,.58]],[[-.06,.62,.24],[.02,.53,.16]]]},BR);
  person(-.95,1.05,2.3,1.7,{pelvis:.3,legs:[{knee:[.24,.33,.1],ankle:[.27,0,.1]},{knee:[.24,.33,.1],ankle:[.27,0,.1]}],
    arms:[[[.1,.42,.2],[.22,.37,.14]],[[.1,.42,.2],[.22,.37,.14]]]},BR);
  person(.55,-.85,.25,1.75,{...STAND,arms:[[[0,.97,.18],[.03,1.15,.14]],[[.2,.75,.2],[.38,.78,.18]]]},BR);
  person(-1.45,.1,Math.PI,1.8,{...STAND,arms:[[[.15,.88,.2],[.32,.98,.18]],[[.02,.6,.2],[.06,.43,.19]]]},BR);
  // Horse rearing toward the east approach (Wikimedia Commons curid=195143828, curid=149388353): hind legs on the rock, folded forelegs, long neck, real head.
  {const x0=f.x+1.05,z0=f.z-.15,H=(u,y,v)=>[x0+u,y,z0+v],hoof=[1,-1].map(sd=>rockTop(x0-.02,z0+.17*sd)-.03),hy=Math.max(...hoof),Y=(u,y,v)=>H(u,hy+y,v);
    [1,-1].forEach((sd,k)=>{const hock=Y(-.12,.42,.17*sd),stifle=Y(.05,.8,.2*sd);seg(H(-.02,hoof[k],.17*sd),hock,.06,BR);seg(hock,stifle,.09,BR);
      bake(sphere,...hock,.08,.08,.08,BR,0,'solid');
      const sh=Y(.98,1.42,.16*sd),kn=Y(1.3,1.2,.16*sd),hf=Y(1.22,.9,.16*sd);seg(sh,kn,.075,BR);seg(kn,hf,.055,BR);
      bake(sphere,...kn,.07,.07,.07,BR,0,'solid');bake(sphere,...hf,.075,.06,.075,BR,0,'solid');
      seg(Y(1.2,2.28,.06*sd),Y(1.16,2.44,.07*sd),.028,BR);});
    bake(sphere,...Y(.05,1.0,0),.42,.38,.3,BR,0,'solid');
    bake(sphere,...Y(.5,1.3,0),.72,.36,.31,BR,0,'solid',.55);
    bake(sphere,...Y(.95,1.62,0),.32,.34,.28,BR,0,'solid');
    seg(Y(1.0,1.68,0),Y(1.22,2.2,0),.17,BR);bake(sphere,...Y(1.22,2.2,0),.15,.15,.13,BR,0,'solid');
    bake(sphere,...Y(1.42,2.14,0),.33,.13,.12,BR,0,'solid',-.75);
    seg(Y(1.0,1.75,0),Y(1.2,2.28,0),.06,'#5f5d51'); // mane ridge
    seg(Y(-.32,1.05,0),Y(-.62,.62,0),.07,BR);seg(Y(-.62,.62,0),Y(-.7,.35,0),.05,BR);}
  // Water (translucent): a sheet spilling round the inner basin, six tall jets leaning toward the rock with falling veils,
  // and splash rings (Wikimedia Commons curid=37349529, curid=149388353). One small merged mesh; no particles.
  const M=new THREE.Matrix4(),one=new THREE.Vector3(1,1,1);
  const sprayMesh=(name,opacity,build)=>{const pos=[],nrm=[];
    build((g,at,quat=new THREE.Quaternion())=>{M.compose(at,quat,one);g.applyMatrix4(M);const n=g.index?g.toNonIndexed():g;
      pos.push(...n.attributes.position.array);nrm.push(...n.attributes.normal.array);if(n!==g)n.dispose();g.dispose();});
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));
    g.computeBoundingSphere();const m=new THREE.Mesh(g,mat({color:'#e6f2f3',transparent:true,opacity,roughness:.2,metalness:0,side:THREE.DoubleSide,depthWrite:false}));
    m.name=name;m.renderOrder=2;scene.add(m);meshes.push(m);};
  // Wikimedia Commons curid=37349529: the jets are tall tapering spires of white water leaning in toward the rock, with a foam ring where they rise.
  sprayMesh('sj-plaza-princesa-spray',.42,add=>{
    for(let j=0;j<6;j++){const a=j*Math.PI/3+.4,r=(f.radius-.3+ib.radius+.2)/2,h=2.8+(j%3)*.8,base=new THREE.Vector3(f.x+Math.cos(a)*r,f.water,f.z+Math.sin(a)*r);
      const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-Math.sin(a),0,Math.cos(a)),.16);
      const spire=new THREE.CylinderGeometry(.025,.2,h,8,3,true);spire.translate(0,h/2,0);add(spire,base,tilt);
      const core=new THREE.CylinderGeometry(.015,.09,h*.92,6,1,true);core.translate(0,h*.46,0);add(core,base,tilt);
      add(new THREE.CylinderGeometry(.26,.36,.14,10,1,true),base.clone().setY(f.water+.05));}});
  // Wikimedia Commons curid=149388353: a thin sheet brimming over the inner basin rim, faint so the salmon stone shows through.
  sprayMesh('sj-plaza-princesa-spill',.2,add=>add(new THREE.CylinderGeometry(ib.radius+.09,ib.radius+.18,ib.top-f.water,40,1,true),new THREE.Vector3(f.x,(ib.top+f.water)/2,f.z)));

  // Flagpoles with Puerto Rico flags (Wikimedia Commons curid=195143828). the blue triangle was drawn on the stripes' own plane and
  // shimmered. The flag is now one small canvas texture on a single double-sided cloth (2:3, equilateral hoist triangle).
  {const cv=document.createElement('canvas');cv.width=192;cv.height=128;const g2=cv.getContext('2d');
    for(let k=0;k<5;k++){g2.fillStyle=k%2?'#f4f2ee':'#d0202d';g2.fillRect(0,Math.floor(k*128/5),192,Math.ceil(128/5)+1);}
    g2.fillStyle='#2d5fb8';g2.beginPath();g2.moveTo(0,0);g2.lineTo(192*Math.sqrt(3)/3,64);g2.lineTo(0,128);g2.closePath();g2.fill();
    g2.fillStyle='#ffffff';g2.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,r=k%2?7:18;const px=192*Math.sqrt(3)/9+Math.cos(a)*r,py=64+Math.sin(a)*r;k?g2.lineTo(px,py):g2.moveTo(px,py);}
    g2.closePath();g2.fill();
    const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;textures.add(tex);
    const L=2.4,Hh=1.6,cloth=own(new THREE.PlaneGeometry(L,Hh));cloth.rotateY(Math.PI/2);
    const flagMat=mat({map:tex,roughness:.8,metalness:0,side:THREE.DoubleSide});
    for(const p of layout.flags){const fb=Number.isFinite(p.foot)?Math.min(p.y,p.foot):p.y;bake(cylinder,p.x,(fb+p.y+p.height)/2,p.z,.07,p.y+p.height-fb,.07,'#a9aaa6',0,'solid');
      bake(cylinder,p.x,p.y+.3,p.z,.16,.6,.16,'#8f8f8b',0,'solid');bake(sphere,p.x,p.y+p.height+.08,p.z,.1,.1,.1,'#c9a54a',0,'solid');
      const m=new THREE.Mesh(cloth,flagMat);m.position.set(p.x,p.y+p.height-.25-Hh/2,p.z-.07-L/2);m.name='sj-plaza-princesa-flag';
      m.castShadow=true;scene.add(m);meshes.push(m);}}

  // ---- Lamps (Wikimedia Commons curid=80420009 posts on stone bases; Wikimedia Commons curid=131971361 black curled-arm clusters), benches and broad shade trees: the shared
  // street kit (js/sj-street-kit.js; moved there verbatim, same bake order). ----
  {const kit=streetKit(ctx);kit.lamps(layout.lamps);kit.benches(layout.benches);kit.trees(layout.trees);}
  // ---- Palms (Wikimedia Commons curid=80420696, curid=182263283, curid=122996449): same form as the gate palms (shared js/sj-palm.js). ----
  for(const [k,p] of layout.palms.entries())tallPalm(p,k,{bake,sphere});
  // ---- Terracotta pillars with fenced planters (Wikimedia Commons curid=122996449). ----
  // Pillars and planters stand on their rotated footprints: base from the covering-cell minimum (buried toe) to just
  // above the highest ground they cover (a pillar 21 cm in the air, a planter straddling the slope).
  for(const p of layout.pillars){const r=p.heading,y0=p.top??p.y,P=(u,yy,v)=>[p.x+Math.cos(r)*u+Math.sin(r)*v,y0+yy,p.z-Math.sin(r)*u+Math.cos(r)*v];
    const foot=(p.foot??p.y)-y0;bake(box,...P(0,(foot+.3)/2,0),.98,.3-foot,.98,'#a8503a',r,'solid');bake(box,...P(0,1.35,0),.8,2.1,.8,TERRA,r,'solid');
    for(const [u,v] of [[.41,0],[-.41,0],[0,.41],[0,-.41]])bake(box,...P(u,1.25,v),u?.02:.5,1.5,u?.5:.02,'#9a4632',r,'solid');
    bake(box,...P(0,2.5,0),.96,.2,.96,'#c06548',r,'solid');bake(box,...P(0,2.7,0),.7,.2,.7,TERRA,r,'solid');
    bake(box,...P(0,1.95,.41),.16,.12,.03,'#3a2a22',r,'solid');}
  for(const p of layout.planters){const r=p.heading,y0=(p.top??p.y)-.04,P=(u,yy,v)=>[p.x+Math.cos(r)*u+Math.sin(r)*v,y0+yy,p.z-Math.sin(r)*u+Math.cos(r)*v];
    const foot=(p.foot??p.y-.06)-y0;bake(box,...P(0,(foot+.18)/2,0),p.w,.18-foot,p.d,'#bdb3a0',r,'solid');bake(box,...P(0,.19,0),p.w-.1,.04,p.d-.1,'#5d7a3e',r,'solid');
    for(const [u,v,w,d] of [[0,p.d/2,p.w,.03],[0,-p.d/2,p.w,.03],[p.w/2,0,.03,p.d],[-p.w/2,0,.03,p.d]]){
      bake(box,...P(u,.5,v),w,.035,d,GREEN,r,'solid');bake(box,...P(u,.24,v),w,.035,d,GREEN,r,'solid');}
    for(const [u,v] of [[p.w/2,p.d/2],[-p.w/2,p.d/2],[p.w/2,-p.d/2],[-p.w/2,-p.d/2]])bake(box,...P(u,.28,v),.05,.5,.05,GREEN,r,'solid');
    for(let i=0;i<3;i++)bake(sphere,...P((i-1)*p.w*.3,.45,0),.45,.3,.4,['#557a45','#4c6f3d','#678a4f'][i],i,'leaf');}

  // Wikimedia Commons curid=37349529: white conical bollards round the fountain (truncated cone + cap ball).
  // One instanced cone (the shared pools only instance boxes/cylinders/spheres; baking 26 cones cost ~110 KB).
  // Wikimedia Commons curid=37349529: a gently tapered body, a short neck and a rounded cap (the thin cones read as pins).
  if(layout.bollards.length){const cone=own(new THREE.CylinderGeometry(.145,.17,.66,12)),cones=new THREE.InstancedMesh(cone,mat({color:'#e7e2d6',roughness:.85,metalness:0}),layout.bollards.length);
    const m4=new THREE.Matrix4();layout.bollards.forEach((b,i)=>{const cb=Number.isFinite(b.foot)?Math.min(b.y-.04,b.foot):b.y-.04;  // seated cone foot
      cones.setMatrixAt(i,cb<b.y-.04?m4.makeScale(1,(b.y+.62-cb)/.66,1).setPosition(b.x,(cb+b.y+.62)/2,b.z):m4.makeTranslation(b.x,b.y+.29,b.z));
      bake(cylinder,b.x,b.y+.65,b.z,.115,.06,.115,'#d9d3c6',0,'solid');bake(sphere,b.x,b.y+.7,b.z,.15,.11,.15,'#e7e2d6',0,'solid');});
    cones.castShadow=cones.receiveShadow=true;cones.computeBoundingSphere();cones.name='sj-plaza-princesa-bollards';scene.add(cones);meshes.push(cones);}

  // ---- Raíces plaza brick (Wikimedia Commons curid=37349529, curid=131971361, curid=182263283): clipped onto the ORIGINAL terrain triangles like the shared overlays, so the
  // shared heightfield stays the only ground; its own warm running-bond texture (no shared kind fits). ----
  let brickTriangles=0;
  if(layout.brick?.length&&layout.grid?.nx){const t=layout.grid,pos=[];
    const clip=(poly,ring)=>{const sign=Math.sign(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0));let out=poly;
      for(let j=0;j<ring.length&&out.length;j++){const a=ring[j],b=ring[(j+1)%ring.length],input=out;out=[];
        const d=p=>sign*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
        for(let k=0;k<input.length;k++){const p=input[k],q=input[(k+1)%input.length],dp=d(p),dq=d(q);if(dp>=0)out.push(p);
          if((dp>=0)!==(dq>=0)){const u=dp/(dp-dq);out.push(p.map((v,i)=>v+(q[i]-v)*u));}}}
      return out;};
    for(const {ring} of layout.brick){
      const minX=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[0]))-t.x0)/t.step)),maxX=Math.min(t.nx-2,Math.ceil((Math.max(...ring.map(p=>p[0]))-t.x0)/t.step));
      const minZ=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[1]))-t.z0)/t.step)),maxZ=Math.min(t.nz-2,Math.ceil((Math.max(...ring.map(p=>p[1]))-t.z0)/t.step));
      for(let j=minZ;j<=maxZ;j++)for(let i=minX;i<=maxX;i++){const x=t.x0+i*t.step,z=t.z0+j*t.step,k=j*t.nx+i,H=t.heights;
        const a=[x,H[k],z],b=[x+t.step,H[k+1],z],c=[x,H[k+t.nx],z+t.step],d=[x+t.step,H[k+t.nx+1],z+t.step];
        for(const tri of [[a,c,b],[b,c,d]]){const poly=clip(tri,ring);
          for(let q=1;q<poly.length-1;q++){const [p0,p1,p2]=[poly[0],poly[q],poly[q+1]];
            if(Math.abs((p1[0]-p0[0])*(p2[2]-p0[2])-(p1[2]-p0[2])*(p2[0]-p0[0]))<1e-9)continue;pos.push(...p0,...p1,...p2);brickTriangles++;}}}}
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c2=canvas.getContext('2d');let seed=6151;
    const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    c2.fillStyle='#6b5d55';c2.fillRect(0,0,256,256);
    for(let row=0;row<8;row++)for(let col=-1;col<5;col++){const x=col*64+(row%2)*32,y=row*32,v=Math.floor(rnd()*26)-13;
      c2.fillStyle=`rgb(${146+v},${116+v},${102+v})`;c2.fillRect(x+2,y+2,60,28);c2.fillStyle='rgba(255,235,210,.10)';c2.fillRect(x+2,y+2,60,2);}
    for(let i=0;i<7000;i++){c2.fillStyle=rnd()<.5?'rgba(30,20,15,.07)':'rgba(255,240,220,.06)';c2.fillRect(rnd()*256,rnd()*256,1,1);}
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;textures.add(tex);
    // Indexed: unclipped facets share their grid vertices (about a quarter of the non-indexed bytes).
    const ids=new Map(),vp=[],uv=[],index=[];
    for(let i=0;i<pos.length;i+=3){const x=pos[i],y=pos[i+1],z=pos[i+2],key=x.toFixed(4)+','+z.toFixed(4);let id=ids.get(key);
      if(id===undefined){id=vp.length/3;ids.set(key,id);vp.push(x,y,z);uv.push((x*.995-z*.1)/1.6,(x*.1+z*.995)/1.6);}index.push(id);}
    const bg=own(new THREE.BufferGeometry());bg.setAttribute('position',new THREE.Float32BufferAttribute(vp,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    bg.setIndex(new (vp.length/3<65536?THREE.Uint16BufferAttribute:THREE.Uint32BufferAttribute)(index,1));
    bg.computeVertexNormals();bg.computeBoundingSphere();
    const bm=new THREE.Mesh(bg,mat({color:'#ffffff',map:tex,roughness:.95,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    bm.name='sj-plaza-surface-brick';bm.receiveShadow=true;scene.add(bm);meshes.push(bm);}

  const material=mat({map:masonryTexture(textures),vertexColors:true,roughness:.92,metalness:0});
  const g=own(masonry.geometry()),m=new THREE.Mesh(g,material);m.name='sj-plaza-princesa-masonry';m.castShadow=true;m.receiveShadow=true;scene.add(m);meshes.push(m);
  return {masonryTriangles:masonry.count/3,walls:layout.walls.length,railBars,garitas:layout.garitas.length,lamps:layout.lamps.length,
    benches:layout.benches.length,trees:layout.trees.length,palms:layout.palms.length,bollards:layout.bollards.length,brickTriangles};
}
