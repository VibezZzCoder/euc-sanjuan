/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Southern waterfront visuals — © 2026 VibezZzCoder, MIT. Every dimension comes from sj-waterfront-layout.js (shared
// physical owner). Photos: 97 La Casita (ochre body, terracotta hip, three white porch arches, palms, red-banded slabs,
// low green bed fences); 98 Edificio Ochoa (cream pilaster grid, dark windows, tall ground arches, crest); 99 Muelle 2
// (low white flat canopy, pale square posts, green screens, teal fenders); 100 the hotel (cream/tan tiers, tight dark
// fenestration, white trim, palm-lined front). 89–96 (La Puntilla) for the shared lantern/bench kit. Courthouse, bank and
// cruise-port cues from the reference photographs. Shed, garage, fence and deck
// details are inferred restrained kits.
// Mesh budget: this builder keeps its own pools (boxes in two bands, cylinders, spheres, merged batches) instead of the
// shared 64 m chunk pools, so a 600 m stretch costs a fixed handful of draw calls.
import * as THREE from 'three/webgpu';
import { glowLamp,glowPane } from './sj-glow.js';
import {streetKit} from './sj-street-kit.js';
import {palmInstances} from './sj-palm.js';
import {paseoTexture} from './sj-gate.js';

const GLASS_TONES={office:['#6c8790','#748f98','#68828b'],hotel:['#6b7b82','#73838a','#677780'],tower:['#6b7a7e','#73828a'],
  deco:['#55666e','#5d6f78'],courthouse:['#5f717b','#687a83'],ochoa:['#4d6260','#55696a'],commercial:['#6d8088','#748890']};
const SURROUND='#efe9dc';
const GLASS='#2e3a40',DARK='#2b2a27',CONCRETE='#cbc7bd',CONCRETE_SIDE='#8d8a83',IRON_GREEN='#2f4a3c',WHITE='#f3f1ea';

function chainTexture(textures) {
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.clearRect(0,0,64,64);
  x.strokeStyle='rgba(170,178,175,1)';x.lineWidth=1.6;
  for(let k=-64;k<=64;k+=16){x.beginPath();x.moveTo(k,0);x.lineTo(k+64,64);x.stroke();x.beginPath();x.moveTo(k+64,0);x.lineTo(k,64);x.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;textures.add(t);return t;
}

function pools({scene,own,mat,meshes,box,cylinder,sphere}) {
  const standard=mat({vertexColors:true,roughness:.88,metalness:0}),foliage=mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const inst=new Map(),batch=new Map(),o=new THREE.Object3D(),m4=new THREE.Matrix4(),nm=new THREE.Matrix3(),col=new THREE.Color(),v=new THREE.Vector3(),n=new THREE.Vector3();
  const sector=(x,z)=>(x<440?'w':'e')+(z<300?'n':'s');
  function bake(g,x,y,z,sx,sy,sz,paint,ry=0,kind='solid',rz=0){
    o.position.set(x,y,z);o.rotation.set(0,ry,rz);o.scale.set(sx,sy,sz);o.updateMatrix();m4.copy(o.matrix);col.set(paint);
    const prim=g===box?'box':g===cylinder?'cylinder':g===sphere?'sphere':null;
    // every pool is binned into ≤ 4 sectors (x 440, z 300) so no batch spans more than ~400 m.
    // 'facade' and 'solid' instances share one pool per primitive/sector (same geometry, material, flags).
    if(prim){const sc=sector(x,z),key=prim+','+(kind==='facade'&&sc!=='en'?'solid':kind)+','+sc;
      // ('en' keeps two pools: its merged bounding sphere would reach the Bahía views.)
      let p=inst.get(key);if(!p)inst.set(key,p={g,kind,t:[],c:[]});
      p.t.push(...m4.elements);p.c.push(col.r,col.g,col.b);return;}
    nm.getNormalMatrix(m4);if(!g.boundingBox)g.computeBoundingBox();const c3=g.boundingBox.getCenter(v).applyMatrix4(m4),bk=(kind==='facade'?'solid':kind)+','+sector(c3.x,c3.z);   // facade arches/plates share the sector's solid batch (same material)
    let b=batch.get(bk);if(!b)batch.set(bk,b={p:[],n:[],c:[],kind});
    const P=g.attributes.position,N=g.attributes.normal,I=g.index;
    for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;v.fromBufferAttribute(P,j).applyMatrix4(m4);n.fromBufferAttribute(N,j).applyNormalMatrix(nm);
      b.p.push(v.x,v.y,v.z);b.n.push(n.x,n.y,n.z);b.c.push(col.r,col.g,col.b);}}
  function flush(){let count=0;
    for(const [key,p] of inst){const k=p.c.length/3,mesh=new THREE.InstancedMesh(p.g,p.kind==='leaf'?foliage:standard,k);
      mesh.instanceMatrix.array.set(p.t);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(p.c),3);
      // no shadows from this kit's parts (trim, openings, furniture, fences, decks, boats are thin or far).
      mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.name='sj-plaza-waterfront-'+key.replace(/,/g,'-');
      scene.add(mesh);meshes.push(mesh);count+=k;}
    for(const [key,b] of batch){const kind=b.kind;const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();
      const m=new THREE.Mesh(g,kind==='leaf'?foliage:standard);m.castShadow=false;m.receiveShadow=true;m.name='sj-plaza-waterfront-batch-'+key.replace(/,/g,'-');scene.add(m);meshes.push(m);}
    inst.clear();batch.clear();return count;}
  return {bake,flush};
}

// Non-indexed prism (flat normals): top polygon at `top`, sides down to `bottom`. ring: [[x,z]…] counter-clockwise in x/z.
function prismGeometry(ring,bottom,top,{sides=true,cap=true}={}) {
  const pos=[],r=ring;
  if(cap){const tri=THREE.ShapeUtils.triangulateShape(r.map(p=>new THREE.Vector2(p[0],p[1])),[]);
    for(const [a,b,c] of tri){const A=r[a],B=r[b],C=r[c],up=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);
      // Upward normal: (B−A)×(C−A) has +Y when the x/z winding is clockwise seen from above (−cross in x,z).
      for(const p of up<0?[A,B,C]:[A,C,B])pos.push(p[0],top,p[1]);}}
  if(sides){const area=r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0);
    for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];
      const q=area<0?[[a,top],[a,bottom],[b,bottom],[a,top],[b,bottom],[b,top]]:[[a,top],[b,bottom],[a,bottom],[a,top],[b,top],[b,bottom]];
      for(const [p,y] of q)pos.push(p[0],y,p[1]);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}

export function buildWaterfront(n,ctx) {
  const {scene,own,box,cylinder,sphere,mat,meshes,textures,height}=ctx;
  const P=pools(ctx),bake=P.bake,kit=streetKit({bake,own,box,cylinder,sphere}),stats={};
  const archShape=new THREE.Shape();archShape.moveTo(-.5,0);archShape.lineTo(.5,0);archShape.lineTo(.5,.6);archShape.absarc(0,.6,.5,0,Math.PI,false);archShape.lineTo(-.5,0);
  const arch=own(new THREE.ShapeGeometry(archShape,6));
  const plate=own(new THREE.PlaneGeometry(1,1));
  const frame=f=>{const ux=(f.b[0]-f.a[0])/f.length,uz=(f.b[1]-f.a[1])/f.length,ry=-Math.atan2(uz,ux),out=Math.abs(-uz-f.n[0])<1e-6&&Math.abs(ux-f.n[1])<1e-6;
    const Pt=(u,d)=>[f.a[0]+ux*u+f.n[0]*d,f.a[1]+uz*u+f.n[1]*d];
    return {L:f.length,ux,uz,ry,P:Pt,g:u=>{const [x,z]=Pt(Math.max(0,Math.min(f.length,u)),.6);return f.water?Math.max(0,f.lo):height(x,z);},
      // (cost give-back): thin facade plates (≤ 6 cm deep: glass, surrounds, bands, mullions) are one outward
      // quad at the plate's front face in the merged facade batch (2 triangles instead of a 12-triangle box instance).
      box:(u,y,d,w,h,dep,c,kind='facade')=>{if(w<=.01||h<=.01)return;if(kind==='facade'&&dep<=.0601){const [x,z]=Pt(u,d+dep/2);bake(plate,x,y,z,w,h,1,c,out?ry:ry+Math.PI,'facade');return;}
        // a box's back lies inside the shell at a depth set by its front (−1 cm − front),
        // so trim pieces with different fronts never share a back plane (buried same-facing duplicates); fronts unchanged.
        const fr=d+dep/2,bk=y+h/2<curR-.02?Math.min(d-dep/2,-.01-fr):d-dep/2;
        // Buried bottoms (more than 5 cm under the lowest ground along the part) drop ≥ 2 cm onto a 28 mm grid offset by 7 mm per
        // front-depth class (plinths / pilasters / piers / cores), so parts of different classes never share a bottom plane.
        let y0=y-h/2;const y1=y+h/2;{let gr=Infinity;for(let q=0;q<=4;q++){const uu=Math.max(0,Math.min(f.length,u-w/2+w*q/4)),[gx,gz]=Pt(uu,.6);gr=Math.min(gr,f.water?Math.max(0,f.lo):height(gx,gz));}if(y0<gr-.05){const G=.028,cls=fr<.1?0:fr<.3?1:fr<.55?2:3;y0=Math.floor((y0-.02)/G)*G-cls*.007;}}
        // Ends that land exactly on a face end (the building corner, where the next wall's plane is) stop 12–36 mm short (per class).
        const ic=.012+.008*(fr<.1?0:fr<.3?1:fr<.55?2:3);let u0=u-w/2,u1=u+w/2;if(Math.abs(u0)<.006)u0=ic;if(Math.abs(u1-f.length)<.006)u1=f.length-ic;if(u1-u0<.01)return;
        const [x,z]=Pt((u0+u1)/2,(fr+bk)/2);bake(box,x,(y0+y1)/2,z,u1-u0,y1-y0,fr-bk,c,ry,kind);},   // (not for parts reaching the roof plane)
      arch:(u,y0,d,w,h,c)=>{const [x,z]=Pt(u,d);bake(arch,x,y0,z,w,h/1.1,1,c,out?ry:ry+Math.PI,'facade');},
      // glazing that may be lit at blue hour (sj-glow.js): centre of its front face at depth d; long runs in ~3 m panes
      glow:(u,y,d,w,h,kind)=>{const n=Math.max(1,Math.round(w/3.2));for(let i=0;i<n;i++){const [x,z]=Pt(u-w/2+(i+.5)*w/n,d);glowPane(x,y,z,out?ry:ry+Math.PI,w/n-.08,h,kind);}}};};
  const range=(F,u0,u1)=>{let lo=Infinity,hi=-Infinity;for(let k=0;k<=4;k++){const g=F.g(u0+(u1-u0)*k/4);lo=Math.min(lo,g);hi=Math.max(hi,g);}return [lo,hi];};
  // Runs of a horizontal band at height y: the u-intervals whose ground stays `clear` below it.
  const runs=(F,y,clear,margin=.6)=>{const out=[];let s=null;for(let u=margin;u<=F.L-margin+1e-6;u+=1){const ok=F.g(u)<y-clear;
      if(ok&&s===null)s=u;if((!ok||u+1>F.L-margin)&&s!==null){const e=ok?Math.min(F.L-margin,u):u-1;if(e-s>=1.2)out.push([s,e]);s=null;}}return out;};
  const shade=(hex,k)=>{const c=new THREE.Color(hex);c.multiplyScalar(k);return '#'+c.getHexString();};
  let facadeBoxes=0,curR=Infinity;

  // ---- Owned building exteriors (one kit per style; visible faces only, decided per face from the terrain). ----
  for(const b of n.facades){curR=b.roof;const S=n.constants.STYLES[b.style],R=b.roof,wall=n.buildingOverrides.get(b.id)?.colour??'#d8d2c4',trim=shade(wall,1.07),deep=shade(wall,.78);
    for(const f of b.faces){const F=frame(f),L=F.L;if(L<2.5)continue;
      // Plinth band (6 m chunks follow the slope) and the cornice / parapet cap.
      if(b.style!=='ferry')for(let u=0;u<L;u+=6){const w=Math.min(6,L-u),[lo,hi]=range(F,u,u+w);F.box(u+w/2,(lo-.6+hi+.55)/2,.0375,w,hi+.55-(lo-.6),.065,deep);}   // back 5 mm off the shell plane
      if(!['casita','kiosk','ferry'].includes(b.style)){F.box(L/2,R-.2,.12,L+.2,.44,.28,trim);F.box(L/2,R+.37,-.05,L,.7,.2,wall);
        // a heavier cornice on the hotel and Ochoa (Wikimedia Commons curid=122894933, curid=110093131).
        if(b.style==='hotel'||b.style==='ochoa')F.box(L/2,R-.03,.31,L+.4,.5,.62,b.style==='ochoa'?'#f6f1e2':WHITE);}
      const [lo,hi]=range(F,0,L);
      if(['office','hotel','tower','ochoa','courthouse','deco','commercial'].includes(b.style)){
        const first=b.style==='ochoa'?4.6:b.style==='courthouse'?5.2:S.floor,top=R-.9;
        // Window bands per storey (dark glass), only where the ground is well below them.
        // (Comercio/Corretjer): the hotel (Wikimedia Commons curid=110093131) and the block east of it get punched windows in
        // pale surrounds instead of storey-long ribbons; ribbons stay on the glass offices.
        const punched=b.style==='hotel'||b.style==='commercial';
        let floors=0;for(let y=hi+first;y+S.floor*.55<=top;y+=S.floor,floors++){const h=S.floor*(b.style==='deco'?.62:.55);
          // /#6: tinted glass per building kit with storey-to-storey variation (not near-black), a pale sill line.
          const tones=GLASS_TONES[b.style]??[GLASS],glass=tones[(floors+b.id)%tones.length];
          if(punched){const k=Math.max(1,Math.round(L/S.bay)),bw=L/k,ww=Math.min(1.45,bw*.46),wh=S.floor*.5;
            for(let i=0;i<k;i++){const u=(i+.5)*bw,[,gh]=range(F,u-bw/2,u+bw/2);if(gh>y-.8)continue;
              // #100 right-hand block (identity inferred from position): recessed loggia bays at the ends of long faces.

              if(b.style==='hotel'&&k>=8&&i%7===3)continue;   // quiet wall strips between the window groups (Wikimedia Commons curid=110093131)
              F.box(u,y+wh/2,.02,ww+.38,wh+.4,.03,SURROUND);F.box(u,y+wh/2,.03,ww,wh,.03,glass);F.glow(u,y+wh/2,.045,ww,wh,'office');
              // Wikimedia Commons curid=110093131: balcony stacks on two bays per long face, every storey (vertical accents).
              if(b.style==='hotel'&&k>=8&&(i===Math.round(k*.25)||i===Math.round(k*.75))&&!f.water){F.box(u,y-.04,.38,ww+.8,.1,.76,WHITE);F.box(u,y+.45,.74,ww+.8,.05,.04,'#e9e4d8');}
              facadeBoxes++;}}
          else for(const [u0,u1] of runs(F,y,.8)){F.box((u0+u1)/2,y+h/2,.04,u1-u0,h,.06,glass);F.glow((u0+u1)/2,y+h/2,.07,u1-u0,h,'office');if(b.style!=='ochoa')F.box((u0+u1)/2,y-.04,.07,u1-u0,.1,.12,shade(wall,1.1));facadeBoxes++;}
          // a strong white tier break over the hotel's street base and every third storey (Wikimedia Commons curid=110093131).
          if(b.style==='hotel'&&(floors===0||floors%3===2))F.box(L/2,y+S.floor-.15,.18,L-.2,floors===0?.45:.22,.28,WHITE);
          // a white belt under the top storey (the crown tier, Wikimedia Commons curid=110093131).
          if(b.style==='hotel'&&y+S.floor*2>top&&y+S.floor*.55<=top)F.box(L/2,y-.2,.2,L-.2,.32,.4,WHITE);
          // Ochoa top storey: shallow white arches over the windows (Wikimedia Commons curid=122894933).
          if(b.style==='ochoa'&&y+S.floor*2>top){const k=Math.max(1,Math.round(L/S.bay)),bw=L/k;for(let i=0;i<k;i++)F.arch((i+.5)*bw,y+h-.1,.1,bw-.9,.9,WHITE);}
          if(b.style==='tower'&&floors>0){for(const [u0,u1] of runs(F,y-.4,1.5,1.2)){F.box((u0+u1)/2,y-.32,.65,u1-u0,.16,1.3,trim,'solid');F.box((u0+u1)/2,y+.18,1.27,u1-u0,.86,.05,'#a9b6b5');}}}
        // /#6: a real ground storey on street faces — storefront glazing with mullions, entrances every ~20 m and a
        // canopy line — and a solid stair/service core breaking the grid on long faces.
        if(['office','hotel','tower','deco','commercial'].includes(b.style)&&!f.water&&L>8){const gTop=hi+Math.min(first,3.6)-.45;
          for(const [u0,u1] of runs(F,gTop,2.3,.8)){
            // shopfront bays (~6 m) between pale piers instead of one storey-long pane; muted sky-tinted glass
            // above the plinth band, a transom and centre mullion, glazed doors in white frames every third bay (not black).
            const k=Math.max(1,Math.round((u1-u0)/6)),bw=(u1-u0)/k;
            for(let i=0;i<k;i++){const u=u0+(i+.5)*bw,[,gh]=range(F,u-bw/2,u+bw/2),y0=gh+.55;if(gTop-y0<1.6)continue;

              const door=i%3===1;if(b.style==='hotel')F.box(u,(gh+.2+gTop+.5)/2,.075,bw,gTop+.5-gh-.2,.01,'#efe5cc');   // the distinct pale ground storey
              F.box(u,(y0+gTop)/2,b.style==='hotel'?.11:.09,bw-.7,gTop-y0,.04,door?'#6f838b':'#8ea3aa');if(!door)F.glow(u,(y0+gTop)/2,(b.style==='hotel'?.11:.09)+.02,bw-.7,gTop-y0,'shop');
              F.box(u,gTop-.65,.15,bw-.7,.08,.03,WHITE);F.box(u,(y0+gTop-.65)/2,.15,.08,gTop-.65-y0,.03,WHITE);
              if(door){F.box(u,y0+1.15,.16,2.3,2.4,.03,WHITE);F.box(u,y0+1.1,.18,1.95,2.2,.03,'#5b6c73');F.glow(u,y0+1.1,.195,1.95,2.2,'shop');F.box(u,y0+1.1,.2,.06,2.2,.02,WHITE);}
              // Wikimedia Commons curid=110093131: dark green awnings over the hotel's street bays.
              if(b.style==='hotel'&&!door)F.box(u,gTop+.05,.7,bw-1.1,.32,1.3,'#3f5b4b','solid');}   // awnings broken at doors and piers
            for(let i=0;i<=k;i++){const u=Math.max(.35,Math.min(L-.35,u0+i*bw)),[gl]=range(F,Math.max(0,u-.4),Math.min(L,u+.4));F.box(u,(gl-.45+gTop)/2,.12,.62,gTop-(gl-.45),.2,SURROUND);}
            if(b.style!=='hotel')F.box((u0+u1)/2,gTop+.2,.75,u1-u0,.18,1.4,WHITE,'solid');}}
        if(['office','hotel','tower'].includes(b.style)&&L>30){const u=L*.5+(b.id%3-1)*L*.15,[gl]=range(F,u-2.5,u+2.5);
          F.box(u,(gl-.3+R+1.6)/2,.16,4.6,R+1.6-(gl-.3),.28,shade(wall,.9),'solid');for(let y=hi+4;y<R-1;y+=S.floor)F.box(u,y,.31,.6,1.1,.04,'#6c7a80');}
        // the hotel's warm vertical corner accent (Wikimedia Commons curid=110093131), rising above the parapet.
        if(b.style==='hotel'&&L>25&&f===b.faces.reduce((m,x)=>x.length>m.length?x:m)){   // accent on the longest face only (two met at a corner)
          const [gl]=range(F,0,3);F.box(1.6,(gl-.3+R+2.4)/2,.3,3.2,R+2.4-(gl-.3),.6,'#d4b077','solid');F.box(1.6,R+2.5,.3,3.5,.2,.8,WHITE,'solid');}
        // Pilasters / ribs over the bands (the grid): full height, rooted below the local ground.
        const bay=S.bay,k=Math.max(1,Math.round(L/bay)),bw=L/k,pw=b.style==='ochoa'?.62:b.style==='deco'?.38:b.style==='courthouse'?.7:.42;
        const proud=b.style==='deco'?.32:b.style==='courthouse'?.28:.1;
        for(let i=0;i<=k;i++){if(punched&&i>0&&i<k)continue;   // punched kits: corner pilasters only (the windows give the rhythm)
          const u=Math.max(pw/2,Math.min(L-pw/2,i*bw)),[gl]=range(F,Math.max(0,u-.4),Math.min(L,u+.4));
          F.box(u,(gl-.3+top)/2,proud/2+.02,pw,top-(gl-.3),proud+.06,b.style==='courthouse'?WHITE:trim);facadeBoxes++;}
        if(b.style==='ochoa'){// Wikimedia Commons curid=122894933: tall dark ground arches between the pilasters, and the crest on the parapet.
          for(let i=0;i<k;i++){const u=(i+.5)*bw,[gl,gh]=range(F,u-bw/2+.4,u+bw/2-.4),h=Math.min(4.2,hi+first-.4-gh,(bw-pw-.2)*1.3);if(h<2.4||gh-gl>.9)continue;
            // (La Tanca / Brumbaugh: the arches read as black holes): Wikimedia Commons curid=122894933's arches are dark
            // green frames around glazing with a fanlight — a white surround, a green frame, muted sky-tinted glass, green bars.
            // rounder arches (height ≤ 1.3 × width) and a pale fanlight above the springing over darker
            // teal door glazing, green transom and mullion (Wikimedia Commons curid=122894933).
            F.arch(u,gh+.05,.05,bw-pw-.2,h+.15,WHITE);F.arch(u,gh+.05,.08,bw-pw-.5,h,'#2f4a3c');F.arch(u,gh+.1,.11,bw-pw-.8,h-.25,'#a9bcbf');
            const sp=(h-.25)*.545;F.box(u,gh+.1+sp/2,.135,bw-pw-.8,sp,.01,'#5f777c');F.glow(u,gh+.1+sp/2,.14,bw-pw-.8,sp,'shop');
            F.box(u,gh+.1+sp,.15,bw-pw-.8,.08,.03,'#2f4a3c');F.box(u,gh+.1+sp/2,.15,.07,sp,.03,'#2f4a3c');
            for(const a of [-.6,0,.6])F.box(u+a*(bw-pw-.8)*.35,gh+.1+sp+(h-.25-sp)*.4,.15,.04,(h-.25-sp)*.7,.02,'#2f4a3c');}
          for(let i=0;i<=k;i++){const u=Math.max(.3,Math.min(L-.3,i*bw));F.box(u,R+1.2+(i%2?0:.35),.0,.55,1.3+(i%2?0:.7),.32,'#f6f1e2','solid');}}
        if(b.style==='courthouse'){// Pale colonnade storey: a dark recessed band behind the deep white pilasters.
          for(const [u0,u1] of runs(F,hi+.4,.0)){F.box((u0+u1)/2,(hi+.3+hi+first-.6)/2,.03,u1-u0,first-.9,.05,'#6a7074');
            for(let u=u0+1.05;u<u1;u+=2.1)F.box(u,(hi+.3+hi+first-.6)/2,.06,.08,first-.9,.03,'#d9d4c8');F.box((u0+u1)/2,hi+2.4,.06,u1-u0,.08,.03,'#d9d4c8');}
          F.box(L/2,hi+first-.35,.3,L,.5,.5,WHITE);
          // a low red tiled pent roof over the colonnade storey (the survey's low red hip, as a silhouette band).
          // Stepped tile courses (three boxes) read as the low sloping red roof from street and bay.
          for(const [d,dy,dep] of [[2.0,0,1.5],[1.3,.28,1.3],[.6,.56,.9]])F.box(L/2,hi+first+.15+dy,d,L+.8+d*.6,.3,dep,dy?'#a9553c':'#9c4b34','solid');}
      }
      else if(b.style==='parking'||b.style==='terminal'){
        const top=R-.9;if(b.style==='parking'){
          // (Comercio/Corretjer/Recinto Sur): deck openings per 5.5 m bay between the piers instead of
          // face-long dark bands — a lighter open-deck interior, a soffit shadow line and a pale parapet coping in each bay,
          // every fourth bay a solid screen panel and a pale belt every fourth deck, so the stack reads at human scale.
          // Inferred kit (no place-specific garage photo in the pack); vocabulary from Wikimedia Commons curid=122894933, curid=110093131 (pale surrounds).
          const kb=Math.max(1,Math.round(L/5.5)),bb=L/kb,ent=!f.water&&L>20?(Math.floor(kb*.3)+.5)*bb:null;let lev=0;
          for(let y=hi+S.floor;y+1.6<=top;y+=S.floor,lev++){let any=false;
            // each opening is a real reveal — the piers stand 0.42 m proud, a deck-edge sill and a soffit
            // band run the length of every deck at the same depth, so the opening reads recessed between jambs, sill and
            // soffit; behind it a dark (not black) deck interior with the far parapet line, lighter at the deck floor.
            for(let i=0;i<kb;i++){const u=(i+.5)*bb,[,gh]=range(F,u-bb/2,u+bb/2);if(gh>y-.6)continue;any=true;
              const grp=Math.floor(i/3);if(i%3===1&&grp%2===1){F.box(u,y+.92,.19,bb-.6,1.32,.38,shade(wall,.95));facadeBoxes++;continue;}
              F.box(u,y+.92,.02,bb-.6,1.32,.02,grp%2?['#6b7375','#707879'][(lev+i)%2]:['#5b6264','#606769'][(lev+i)%2]);
              F.box(u,y+.62,.035,bb-.6,.1,.01,'#8c9293');F.box(u,y+.33,.035,bb-.6,.12,.01,'#737a7b');facadeBoxes++;}
            if(any)for(const [u0,u1] of runs(F,y,.6)){F.box((u0+u1)/2,y+.12,.21,u1-u0,.3,.42,lev%4===3?SURROUND:shade(wall,1.02));
              F.box((u0+u1)/2,y+1.68,.2,u1-u0,.2,.4,shade(wall,.97));}}
          // Ground storey: a low pale screen wall with arched openings per bay (no storey-high slot), one framed vehicle
          // entrance per long street face (white portal, barrier arm, blue parking plate) instead of a yellow stripe.
          // Fabric's garage vocabulary: a glazed pedestrian door beside the vehicle entrance and louvred vents
          // in some bays, between the arched openings.
          for(let i=0;i<kb;i++){const u=(i+.5)*bb,[gl,gh]=range(F,u-bb/2+.3,u+bb/2-.3);if(gh-gl>.9||hi+S.floor-gh<2.9||(ent!==null&&Math.abs(u-ent)<bb*.9))continue;
            if(ent!==null&&Math.abs(u-ent-bb)<bb*.5){F.box(u,gh+1.3,.12,1.9,2.6,.04,SURROUND);F.box(u,gh+1.22,.15,1.5,2.36,.03,'#6f838b');F.glow(u,gh+1.22,.165,1.5,2.36,'stair');F.box(u,gh+1.22,.18,.06,2.36,.02,SURROUND);
              F.box(u,gh+2.75,.16,2.2,.16,.24,WHITE,'solid');continue;}
            if((i+b.id)%5===2){F.box(u,gh+1.7,.1,bb-1.6,1.3,.04,'#868c8b');for(let k=0;k<5;k++)F.box(u,gh+1.15+k*.26,.13,bb-1.7,.06,.04,'#a6acab');continue;}
            // the three garages keep their own ground storeys (mapped heights 33.8 / 19.7 / 18.2 m differ):
            // Paseo Portuario arches, Doña Fela square openings with grilles, Covadonga plain square openings — all set back
            // behind the 0.42 m piers with a lintel and sill and a dark-grey (not black) interior.
            if(b.id===256258731){F.arch(u,gh+.62,.1,bb-1.0,2.0,SURROUND);const glazed=i%3===1;F.arch(u,gh+.62,.12,bb-1.4,1.8,glazed?'#7f949b':'#767d7f');
              if(glazed)F.box(u,gh+1.4,.17,.07,1.5,.03,SURROUND);else for(let q=0;q<5;q++)F.box(u,gh+.85+q*.28,.17,bb-1.6,.07,.03,'#a7adac');}
            else{const h=b.id===142324879?2.0:2.3;F.box(u,gh+.6+h/2,.02,bb-.6,h,.02,'#5f6668');
              F.box(u,gh+.6+h+.14,.2,bb-.6,.28,.4,shade(wall,.97));F.box(u,gh+.46,.2,bb-.6,.32,.4,shade(wall,1.02));
              if(b.id===142324879)for(let k=-2;k<=2;k++)F.box(u+k*(bb-.8)/5,gh+.6+h/2,.06,.05,h,.03,'#7d8483');}}
          if(ent!==null){const u=ent,[,gh]=range(F,u-3.5,u+3.5);F.box(u,gh+1.5,.1,5.6,3.0,.04,'#596062');
            F.box(u,gh+3.15,.3,6.6,.42,.3,SURROUND);for(const sd of [-1,1])F.box(u+sd*3.0,gh+1.5,.3,.4,3.0,.3,SURROUND);
            F.box(u+3.0,gh+2.3,.47,.56,.56,.04,'#2d5f9e');F.box(u+3.0,gh+2.3,.5,.26,.34,.02,WHITE);
            F.box(u-1,gh+1.05,.15,4.2,.12,.06,'#e8e2d0','solid');}
          if(L>30){const u=L*.72,[gl]=range(F,u-3,u+3);F.box(u,(gl-.3+R+1.8)/2,.32,6,R+1.8-(gl-.3),.64,shade(wall,.92),'solid');
            for(let y=hi+2;y<R-1;y+=S.floor)F.box(u,y,.65,.9,1.6,.04,'#7c868a');}}
        else{for(const [u0,u1] of runs(F,hi+3.4,2.2)){F.box((u0+u1)/2,hi+2.2,.03,u1-u0,2.2,.05,'#71868d');F.glow((u0+u1)/2,hi+2.2,.055,u1-u0,2.2,'terminal');   // muted glass, not black
            for(let u=u0+1.5;u<u1-.3;u+=3)F.box(u,hi+2.2,.07,.1,2.2,.04,SURROUND);}
          for(const [u0,u1] of runs(F,hi+3.9,3.4,.05))F.box((u0+u1)/2,hi+3.95,.45,u1-u0,.45,.9,WHITE,'solid');}
        let leaf=null;if(b.style==='terminal'){const g=n.gates.find(q=>q.road===294776923),e=g?[g.x,g.z]:[659.5,156.45],t=(e[0]-f.a[0])*F.ux+(e[1]-f.a[1])*F.uz,dd=Math.abs((e[0]-f.a[0])*f.n[0]+(e[1]-f.a[1])*f.n[1]);
          if(dd<1.5&&t>=2.5&&t<=L-2.5){const [,gh]=range(F,t-3,t+3);leaf={u:t,u0:t-3.2,u1:t+3.2,gh,top:gh+3.7};}}
        const k=Math.max(1,Math.round(L/(b.style==='parking'?5.5:S.bay))),bw=L/k;for(let i=0;i<=k;i++){const u=Math.max(.3,Math.min(L-.3,i*bw)),[gl]=range(F,Math.max(0,u-.4),Math.min(L,u+.4));
          if(leaf&&u>leaf.u0-.4&&u<leaf.u1+.4){if(top>leaf.top+.35)F.box(u,(leaf.top+.25+top)/2,.08,.6,top-leaf.top-.25,.16,trim);continue;}   // owner 02: no rib across the shutter
          const deep=b.style==='parking',edge=deep&&i%3===0&&i>0&&i<k,tp=deep?top+.04:top;F.box(u,(gl-.3+tp)/2,deep?.23:.08,edge?1.2:.6,tp-(gl-.3),deep?.46:.16,edge?SURROUND:trim);facadeBoxes++;}
        // the terminal's controlled bus entry reads as a shut roller door behind the gate leaf.
        if(b.style==='terminal'){const g=n.gates.find(q=>q.road===294776923),e=g?[g.x,g.z]:[659.5,156.45],t=(e[0]-f.a[0])*F.ux+(e[1]-f.a[1])*F.uz,dd=Math.abs((e[0]-f.a[0])*f.n[0]+(e[1]-f.a[1])*f.n[1]);
          if(leaf){const u=leaf.u,gh=leaf.gh;F.box(u,gh+1.86,.13,6.4,3.68,.08,'#7a7f7c');   // leaf front .17
            for(let y=gh+.4;y<gh+3.6;y+=.45)F.box(u,y,.18,6.2,.05,.03,'#9aa09c');F.box(u,gh+.04,.3,6.6,.08,.5,'#bdb8ad');
            for(const sd of [-1,1])F.box(u+sd*3.35,gh+1.97,.12,.3,3.86,.24,trim);F.box(u,gh+3.85,.12,7.0,.3,.24,trim);}}}
      else if(b.style==='shed'){// Pale ribbed cladding, big shut doors on the land faces, fascia band.
        const base=f.water?-.3:lo-.3;for(let u=.8;u<L-.4;u+=S.bay){const [gl]=range(F,Math.max(0,u-.3),Math.min(L,u+.3));const y0=f.water?-.3:gl-.3;F.box(u,(y0+R-.6)/2,.05,.12,R-.6-y0,.1,trim);facadeBoxes++;}
        void base;   // the separate fascia band shared the cornice's top plane (removed)
        // roller doors with jambs and seams (short land faces get one centred door), a loading canopy over
        // every second door and a small identifier plate.
        const doors=!f.water&&L>14?Array.from({length:Math.floor((L-12)/22)+1},(_,i)=>10+i*22):!f.water&&L>=7?[L/2]:[];
        for(const [di,u] of doors.entries()){const w=Math.min(6,L-2),[gl,gh]=range(F,u-w/2,u+w/2);if(gh-gl>.6)continue;const h=Math.min(5.2,R-gh-1.4);
          F.box(u,gh+h/2,.12,w,h,.06,'#7c817d');for(let y=gh+.35;y<gh+h;y+=.4)F.box(u,y,.16,w-.1,.05,.03,'#9ba19c');
          for(const sd of [-1,1])F.box(u+sd*(w/2+.12),gh+h/2,.18,.24,h+.2,.2,'#5f6461');F.box(u,gh+h+.12,.18,w+.5,.24,.2,'#5f6461');
          if(di%2===0&&L>14)F.box(u,gh+h+.75,1.2,w+1.6,.18,2.4,WHITE,'solid');
          if(di===0)F.box(u+w/2+1.2,gh+h-.4,.14,.9,.5,.04,'#2f6f73');}}
      else if(b.style==='ferry'){// Wikimedia Commons curid=182041799: pale square posts, green screens, white fascia; teal fenders on the water faces.
        const top=R-.75;F.box(L/2,R-.33,.28,L+.5,.7,.56,WHITE,'solid');
        for(let u=1;u<=L-1+1e-6;u+=Math.max(3.6,(L-2)/Math.max(1,Math.round((L-2)/4.5)))){const [gl]=range(F,Math.max(0,u-.3),Math.min(L,u+.3));const y0=f.water?-.3:gl-.15;
          F.box(u,(y0+top)/2,.2,.36,top-y0,.4,'#e6e8e3','solid');facadeBoxes++;}
        // recessed pale-blue glazing behind the posts with green screens in only some bays (Wikimedia Commons curid=182041799).
        for(const [u0,u1] of runs(F,f.water?1.6:hi+2.8,f.water?.2:2.4,.5)){const y0=f.water?1.5:hi+.1,k=Math.max(1,Math.round((u1-u0)/4.5)),bw=(u1-u0)/k;
          for(let i=0;i<k;i++){const u=u0+(i+.5)*bw,green=i%3===1;F.box(u,y0+1.3,green?.08:.02,bw-.5,2.6,.05,green?'#3f7d5a':'#8fa6ad');if(!green)F.glow(u,y0+1.3,.045,bw-.5,2.6,'terminal');
            if(!green)F.box(u,y0+1.3,.05,.06,2.6,.03,'#e6e8e3');}}
        if(!f.water)for(const [u0,u1] of runs(F,hi+3.2,2.6,.5))F.box((u0+u1)/2,hi+2.95,.05,u1-u0,.5,.04,'#cfd6d2');
        // The closed passenger entrance where footway 1031719744 meets the face: dark glass doors in a white frame.
        if(!f.water){const e=[367.237,235.259],t=(e[0]-f.a[0])*F.ux+(e[1]-f.a[1])*F.uz,dd=Math.abs((e[0]-f.a[0])*f.n[0]+(e[1]-f.a[1])*f.n[1]);
          if(dd<.6&&t>-.5&&t<L+.5){const u=Math.max(2,Math.min(L-2,t)),[,gh]=range(F,u-1.6,u+1.6);F.box(u,gh+1.4,.09,3.6,2.8,.06,WHITE);F.box(u,gh+1.3,.13,3.0,2.5,.04,'#40525c');F.glow(u,gh+1.3,.15,3.0,2.5,'terminal');for(const du of [-.75,0,.75])F.box(u+du,gh+1.3,.16,.08,2.5,.04,WHITE);F.box(u,gh+1.25,.16,3.0,.08,.04,WHITE);F.box(u,gh+1.3,.19,1.4,.12,.03,'#2c2c2a');}}
        if(f.water){for(let u=2;u<L-1;u+=5.5){const [x,z]=F.P(u,.55);bake(cylinder,x,.6,z,.2,3.6,.2,'#2f6f73',0,'solid');}
          F.box(L/2,1.0,.32,L,.35,.22,'#2f7f86','solid');F.box(L/2,1.38,.75,L,.1,1.1,'#7a5a3e','solid');}}
      else if(b.style==='casita'||b.style==='kiosk'){// Wikimedia Commons curid=49348487: white window surrounds with dark green leaves; porch arches.
        const porch=b.style==='casita'&&f.n[1]<-.8&&L>10;
        // Shaded porch wall behind each arch with a dark timber door (the open loggia reads, nothing is enterable).
        if(porch){for(let i=0;i<3;i++){const u=L*(i+1)/4,[,gh]=range(F,u-1,u+1);F.arch(u,gh+.02,.06,2.3,2.75,WHITE);F.arch(u,gh+.02,.09,1.85,2.45,'#a98636');
            F.box(u,gh+1.0,.11,.95,2.0,.03,i===1?'#4a3424':'#e9e3d3');if(i!==1)F.box(u,gh+1.0,.13,.7,1.6,.03,'#2f4b35');}
          for(const u of [L/8,3*L/8,5*L/8,7*L/8].map(x=>x)){const [gl,gh]=range(F,u-.3,u+.3);F.box(u,(gl-.2+R-.15)/2,.12,.32,R-.15-(gl-.2),.24,WHITE);
            F.box(u,gh+.2,.14,.46,.4,.32,'#e9e4d8');F.box(u,R-.88,.14,.46,.22,.32,'#e9e4d8');}
          F.box(L/2,R-.55,.13,L,.45,.24,WHITE);F.box(L/2,R-.55,.27,2.2,.32,.03,'#f6f2e6');F.box(L/2,R-.55,.29,1.9,.08,.02,'#3b2f26');}
        else if(b.style==='kiosk'&&L>2.8&&f.n[1]<-.3){const [,gh]=range(F,L/2-1,L/2+1);F.box(L/2,gh+1.45,.06,1.6,1.1,.06,WHITE);F.box(L/2,gh+1.45,.09,1.35,.9,.04,'#6c5032');F.box(L/2,gh+.92,.2,1.7,.08,.3,WHITE);}
        else{const k=Math.max(1,Math.floor(L/3.2));for(let i=0;i<k;i++){const u=(i+.5)*L/k,[,gh]=range(F,u-.6,u+.6),y0=gh+.9,y1=Math.min(R-.5,y0+1.8);if(y1-y0<1)continue;
            F.box(u,(y0+y1)/2,.05,1.3,y1-y0+.3,.08,WHITE);F.box(u,(y0+y1)/2,.08,.95,y1-y0,.05,'#2f4b35');}}
        F.box(L/2,R-.12,.1,L+.2,.24,.2,WHITE);}
    }
    // Roofs: La Casita's terracotta hip and the kiosk's pyramid (Wikimedia Commons curid=49348487); the Art Deco crown and the hotel's top tier.
    if(b.style==='casita'||b.style==='kiosk'){const r=b.outer,c=r.reduce((s,p)=>[s[0]+p[0]/r.length,s[1]+p[1]/r.length],[0,0]),o=.45,rise=b.style==='casita'?2.2:1.4;
      const eave=r.map(p=>{const dx=p[0]-c[0],dz=p[1]-c[1],l=Math.hypot(dx,dz)||1;return [p[0]+dx/l*o,p[1]+dz/l*o];});
      let ridge;if(b.style==='casita'&&r.length===4){const e=[0,1,2,3].map(i=>Math.hypot(r[(i+1)%4][0]-r[i][0],r[(i+1)%4][1]-r[i][1])),i=e[0]>=e[1]?0:1;
        const m0=[(r[i][0]+r[(i+1)%4][0])/2,(r[i][1]+r[(i+1)%4][1])/2],m1=[(r[i+2][0]+r[(i+3)%4][0])/2,(r[i+2][1]+r[(i+3)%4][1])/2],half=(e[1-i]??e[1])/2;
        const ax=[r[(i+1)%4][0]-r[i][0],r[(i+1)%4][1]-r[i][1]],al=Math.hypot(...ax),u=[ax[0]/al,ax[1]/al];void m0;void m1;
        ridge=[[c[0]-u[0]*(al/2-half),c[1]-u[1]*(al/2-half)],[c[0]+u[0]*(al/2-half),c[1]+u[1]*(al/2-half)]];}
      else ridge=[c,c];
      const pos=[],Y=b.roof,T=Y+rise,near=p=>{const d0=Math.hypot(p[0]-ridge[0][0],p[1]-ridge[0][1]),d1=Math.hypot(p[0]-ridge[1][0],p[1]-ridge[1][1]);return d0<=d1?ridge[0]:ridge[1];};
      for(let i=0;i<eave.length;i++){const a=eave[i],q=eave[(i+1)%eave.length],ra=near(a),rq=near(q);
        const tri=(p0,p1,p2)=>{const e1=[p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]],e2=[p2[0]-p0[0],p2[1]-p0[1],p2[2]-p0[2]],ny=e1[2]*e2[0]-e1[0]*e2[2];pos.push(...(ny>0?[p0,p1,p2]:[p0,p2,p1]).flat());};
        tri([a[0],Y,a[1]],[q[0],Y,q[1]],[rq[0],T,rq[1]]);if(ra!==rq)tri([a[0],Y,a[1]],[rq[0],T,rq[1]],[ra[0],T,ra[1]]);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
      bake(g,0,0,0,1,1,1,n.buildingOverrides.get(b.id).roofColour,0,'solid');g.dispose();
      // Thin eave soffit band under the overhang (the white fascia of Wikimedia Commons curid=49348487).
      const sg=prismGeometry(eave.map(p=>p).reverse(),Y-.08,Y+.02,{cap:false});bake(sg,0,0,0,1,1,1,WHITE,0,'solid');sg.dispose();}
    if(b.style==='deco'){const r=b.outer,c=r.reduce((s,p)=>[s[0]+p[0]/r.length,s[1]+p[1]/r.length],[0,0]);
      const step=(k,h,y)=>{const ring=r.map(p=>[c[0]+(p[0]-c[0])*k,c[1]+(p[1]-c[1])*k]);const g=prismGeometry(ring,y,y+h);bake(g,0,0,0,1,1,1,shade(n.buildingOverrides.get(b.id).colour,1.03),0,'solid');g.dispose();};
      step(.72,3.2,R+.6);step(.45,2.6,R+3.8);}
  }
  stats.facadeBoxes=facadeBoxes;

  // ---- Pier decks (render-only, closed): concrete slab on the mapped ring with a dark face to below the water, a low
  // bull rail along the free edges and mooring bollards; the mooring dolphins as small capped platforms. ----
  for(const p of n.piers){const g=prismGeometry(p.ring,n.constants.DECK.face,p.top,{sides:false}),f=prismGeometry(p.ring,n.constants.DECK.face,p.top,{cap:false});
    bake(g,0,0,0,1,1,1,CONCRETE,0,'solid');bake(f,0,0,0,1,1,1,CONCRETE_SIDE,0,'solid');g.dispose();f.dispose();
    const r=p.ring;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<3)continue;
      const ch=p.chord,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],dch=Math.abs((mid[0]-ch[0][0])*p.seaward[0]+(mid[1]-ch[0][1])*p.seaward[1]);if(dch<1.5)continue;
      const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L,inn=isCcw(r)?[-uz,ux]:[uz,-ux];
      bake(box,mid[0]+inn[0]*.25,p.top+.11,mid[1]+inn[1]*.25,L-.3,.22,.3,'#dad6cc',-Math.atan2(uz,ux),'solid');
      // A darker wet band on the face just above the water (Wikimedia Commons curid=182041799's vertical concrete edge), 3 cm proud of the face.
      bake(box,mid[0]-inn[0]*.03,.35,mid[1]-inn[1]*.03,L,.9,.02,'#5f6a66',-Math.atan2(uz,ux),'solid');}}
  for(const b of n.bollards)bake(cylinder,b.x,b.y+.28,b.z,.18,.56,.18,'#2c302f',0,'solid');   // closed decks: no caps
  // Dolphins: capped concrete platforms on dark piles, a pair of fender piles each (render-only, offshore).
  for(const d of n.dolphins){const g=prismGeometry(d.ring,-1.2,d.top,{sides:false}),f=prismGeometry(d.ring,-1.2,d.top,{cap:false});
    bake(g,0,0,0,1,1,1,'#c9c5bb',0,'solid');bake(f,0,0,0,1,1,1,CONCRETE_SIDE,0,'solid');g.dispose();f.dispose();
    const c=d.ring.reduce((s,p)=>[s[0]+p[0]/d.ring.length,s[1]+p[1]/d.ring.length],[0,0]);bake(cylinder,c[0],d.top+.3,c[1],.22,.6,.22,'#2c302f',0,'solid');
    for(const p of d.ring){const x=c[0]+(p[0]-c[0])*.8,z=c[1]+(p[1]-c[1])*.8;bake(box,x,(d.top-.9-1.4)/2,z,.6,d.top-.9+1.4,.6,'#33322e',0,'solid');}
    for(const t of [.3,.7])bake(box,c[0]+(d.ring[0][0]-c[0])*t,(d.top-.9-1.4)/2,c[1]+(d.ring[0][1]-c[1])*t,.7,d.top-.9+1.4,.7,'#2c2b28',0,'solid');}

  // ---- Closures: chain-link fences (piers), concrete walls (Covadonga), the notch railing, and gates. ----
  {const {height:H,wall:WH,rail:RH}=n.constants.FENCE,parts={w:{pos:[],uv:[],nor:[],idx:[]},e:{pos:[],uv:[],nor:[],idx:[]}};let s=0;const posts=new Set();
    const post=(p,g)=>{const key=`${Math.round(p[0]*20)},${Math.round(p[1]*20)}`;if(posts.has(key))return;posts.add(key);bake(cylinder,p[0],g+(H+.1)/2-.05,p[1],.05,H+.1,.05,'#59605d',0,'solid');};
    for(const f of n.fence){const L=Math.hypot(f.q[0]-f.p[0],f.q[1]-f.p[1]),ry=-Math.atan2(f.q[1]-f.p[1],f.q[0]-f.p[0]),m=[(f.p[0]+f.q[0])/2,(f.p[1]+f.q[1])/2];
      if(f.hidden||f.kind==='wall'&&f.gate)continue;
      if(f.kind==='wall'){const lo=Math.min(f.g0,f.g1)-.3,hi=Math.max(f.g0,f.g1)+WH;bake(box,m[0],(lo+hi)/2,m[1],L+.02,hi-lo,.36,'#d2cbbb',ry,'solid');
        bake(box,m[0],hi+.06,m[1],L+.04,.12,.46,'#e2ddd0',ry,'solid');continue;}
      if(f.kind==='rail'){for(const yy of [.5,RH])kit.seg([f.p[0],f.g0+yy,f.p[1]],[f.q[0],f.g1+yy,f.q[1]],.035,'#7e8583');
        bake(cylinder,f.p[0],f.g0+RH/2,f.p[1],.045,RH+.1,.045,'#7e8583',0,'solid');continue;}
      if(f.gate)continue;const {pos,uv,nor,idx}=parts[m[0]<440?'w':'e'],nx=-(f.q[1]-f.p[1])/L,nz=(f.q[0]-f.p[0])/L,b=pos.length/3;
      pos.push(f.p[0],f.g0-.05,f.p[1],f.q[0],f.g1-.05,f.q[1],f.q[0],f.g1+H,f.q[1],f.p[0],f.g0+H,f.p[1]);
      for(let k=0;k<4;k++)nor.push(nx,0,nz);uv.push(s*2,0,(s+L)*2,0,(s+L)*2,(H+.05)*2,s*2,(H+.05)*2);
      idx.push(b,b+1,b+2,b,b+2,b+3);s+=L;post(f.p,f.g0);post(f.q,f.g1);kit.seg([f.p[0],f.g0+H,f.p[1]],[f.q[0],f.g1+H,f.q[1]],.03,'#59605d');}
    // One alpha-tested chain material, two sector meshes.
    const chainMat=mat({map:chainTexture(textures),color:'#b4bbb8',alphaTest:.2,side:THREE.DoubleSide,roughness:.7,metalness:.3});
    for(const [key,{pos,uv,nor,idx}] of Object.entries(parts))if(pos.length){const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingSphere();
      const m=new THREE.Mesh(g,chainMat);m.name='sj-plaza-waterfront-fence-'+key;m.castShadow=false;m.receiveShadow=true;scene.add(m);meshes.push(m);}
    // Gates: white-framed double leaves on the pier fences (the Puntilla gate look); dark barred leaves at Covadonga.
    for(const gt of n.gates){if(gt.covadonga)continue;   // Covadonga's leaves stand on building walls: the roller door is the drawn closure
      const A=[gt.x-gt.ux*gt.half,gt.z-gt.uz*gt.half],B=[gt.x+gt.ux*gt.half,gt.z+gt.uz*gt.half],C=[gt.x,gt.z],ga=height(...A),gb=height(...B),gc=height(...C);
      const colour=gt.covadonga?'#3a3f3d':'#ecece6',ry=-Math.atan2(gt.uz,gt.ux);
      for(const [p,g] of [[A,ga],[B,gb]])bake(box,p[0],g+1.28,p[1],.22,2.64,.22,gt.covadonga?'#cfc8b8':'#dcdcd4',ry,'solid');
      for(const yy of [.2,1.1,2.1])for(const [p,q,gp,gq] of [[A,C,ga,gc],[C,B,gc,gb]])kit.seg([p[0],gp+yy,p[1]],[q[0],gq+yy,q[1]],.04,colour);
      for(const [p,q,gp,gq] of [[A,C,ga,gc],[C,B,gc,gb]]){const L=Math.hypot(q[0]-p[0],q[1]-p[1]),k=Math.max(1,Math.round(L/(gt.covadonga?.25:.9)));
        for(let i=1;i<k;i++){const t=i/k,x=p[0]+(q[0]-p[0])*t,z=p[1]+(q[1]-p[1])*t,g=gp+(gq-gp)*t;bake(box,x,g+1.15,z,.03,1.9,.03,colour,ry,'solid');}}
      bake(box,C[0],gc+1.12,C[1],.08,2.05,.08,colour,ry,'solid');}}

  // ---- The paved quay strip over the mapped walk (layout tops = these triangles): the promenade's slab texture and tone
  // with the same UV rule as the draped paseo, a concrete face with a pale coping line down to the water. ----
  if(n.boardwalk){const sec={w:{pos:[],uv:[]},e:{pos:[],uv:[]}},deckMat=mat({color:'#f1e2cd',map:paseoTexture(textures),roughness:.94,metalness:0});
    for(const [a,b,c] of [...n.boardwalk.tris,...(n.quay?.tris??[])]){const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),{pos,uv}=sec[(a[0]+b[0]+c[0])/3<440?'w':'e'];
      for(const p of ny>0?[a,b,c]:[a,c,b]){pos.push(...p);uv.push((p[0]*.973-p[2]*.23)/3.2,(p[0]*.23+p[2]*.973)/3.2);}}
    for(const [key,{pos,uv}] of Object.entries(sec))if(pos.length){const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      g.computeVertexNormals();g.computeBoundingSphere();const m=new THREE.Mesh(g,deckMat);m.name='sj-plaza-waterfront-boardwalk-'+key;m.receiveShadow=true;scene.add(m);meshes.push(m);}
    const e=n.boardwalk.edge;for(let i=0;i+1<e.length;i++){if(!e[i].wet&&!e[i+1].wet)continue;const a=e[i].p,b=e[i+1].p,L=Math.hypot(b[0]-a[0],b[2]-a[2]);if(L<.05)continue;
      const ry=-Math.atan2(b[2]-a[2],b[0]-a[0]),top=Math.min(a[1],b[1]),mx=(a[0]+b[0])/2,mz=(a[2]+b[2])/2;
      bake(box,mx,(top-.02-1.2)/2,mz,L+.04,top-.02+1.2,.3,CONCRETE_SIDE,ry,'solid');if(!(e[i].wet&&e[i+1].wet))bake(box,mx,top-.08,mz,L+.08,.14,.32,'#e2ddd2',ry,'solid');}
    // /#13: a pale coping band (1.2 cm proud, half over the face) with a dark joint line on every finished edge.
    const coping=(a,b,inward)=>{const L=Math.hypot(b[0]-a[0],b[2]-a[2]);if(L<.05)return;const ry=-Math.atan2(b[2]-a[2],b[0]-a[0]),rz=Math.asin(Math.max(-1,Math.min(1,(b[1]-a[1])/Math.hypot(L,b[1]-a[1]))));
      const m=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];bake(box,m[0],m[1]-.058,m[2],Math.hypot(L,b[1]-a[1])+.08,.14,.56,'#eeebe3',ry,'solid',rz);   // 13 cm past the face (no shared plane)
      bake(box,m[0]+inward[0]*.27,m[1]+.025,m[2]+inward[1]*.27,Math.hypot(L,b[1]-a[1]),.02,.05,'#6d6a63',ry,'solid',rz);};
    for(let i=0;i+1<e.length;i++)if(e[i].wet&&e[i+1].wet)coping(e[i].p,e[i+1].p,e[i].inward);
    for(const f of n.quay?.faces??[])coping(f.a,f.b,f.inward);
    if(n.handoffRail){const {pts,y,height:hr}=n.handoffRail,a=pts[0],b=pts.at(-1);
      for(const yy of [.45,hr])kit.seg([a[0],y+yy,a[1]],[b[0],y+yy,b[1]],.03,'#7e8583');
      for(const p of pts)bake(cylinder,p[0],(p[2]-.1+y+hr)/2,p[1],.04,y+hr-p[2]+.1,.04,'#7e8583',0,'solid');}
    for(const b of n.edgeBollards??[]){bake(cylinder,b.x,b.y+.23,b.z,.18,.58,.18,'#2c302f',0,'solid');bake(sphere,b.x,b.y+.54,b.z,.21,.1,.21,'#2c302f',0,'solid');}   // foot 6 cm into the deck
    for(const f of n.quay?.faces??[]){const a=f.a,b=f.b,L=Math.hypot(b[0]-a[0],b[2]-a[2]);if(L<.05)continue;
      const ry=-Math.atan2(b[2]-a[2],b[0]-a[0]),top=Math.min(a[1],b[1]),mx=(a[0]+b[0])/2,mz=(a[2]+b[2])/2;
      bake(box,mx,(top-.02-1.2)/2,mz,L+.06,top-.02+1.2,.3,CONCRETE_SIDE,ry,'solid');}}

  for(const f of [n.ferryPlanter,n.ferryPlanterW].filter(Boolean)){const c=[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2];
    bake(box,c[0],(f.lo-.2+f.top)/2,c[1],f.length,f.top-f.lo+.2,f.width,'#d6d2c8',f.ry,'solid');bake(box,c[0],f.top+.04,c[1],f.length+.06,.08,f.width+.06,'#e8e5dc',f.ry,'solid');
    for(const [i,q] of f.shrubs.entries())bake(sphere,q.x,f.top+.28,q.z,.55,.4,.5,['#3f6b3a','#4b7743','#365f33'][i%3],0,'leaf');
    // (the tall west planter read as a blank plinth): a darker stone base, coursed joints wrapping the body
    // every 0.6 m, and planting trailing over both long edges (green with bougainvillea-pink sprays, an Old San Juan
    // street cue; inferred). All within the collider's footprint/height except the leaves (≤ 0.2 m proud, non-solid look).
    const ux=Math.cos(f.ry),uz=-Math.sin(f.ry),nx=uz,nz=-ux;
    bake(box,c[0],f.lo+.225,c[1],f.length+.03,.95,f.width+.03,'#7f796e',f.ry,'solid');   // a clear dark plinth
    for(let y=f.lo+.95;y<f.top-.25;y+=.6)bake(box,c[0],y,c[1],f.length+.02,.035,f.width+.02,'#bdb7ab',f.ry,'solid');
    // denser, varied cover — low mounds of three sizes along the top and short trailing masses on both faces.
    for(let u=-f.length/2+.35,i=0;u<f.length/2-.2;u+=.7,i++){const x=c[0]+ux*u,z=c[1]+uz*u,s2=.35+((i*37)%5)*.06;
      bake(sphere,x+nx*((i%3)-1)*.2,f.top+.12+s2*.25,z+nz*((i%3)-1)*.2,s2*1.3,s2*.8,s2,['#3f6b3a','#4b7743','#365f33','#56804a'][i%4],i*.7,'leaf');
      if(i%2)for(const sd of [-1,1]){const xx=x+nx*sd*(f.width/2+.04),zz=z+nz*sd*(f.width/2+.04);
        bake(sphere,xx,f.top-.18-((i+(sd>0?1:0))%3)*.07,zz,.45,.24+(i%3)*.05,.1,(i+(sd>0?1:0))%7===0?'#a9466f':['#3f6b3a','#4b7743','#365f33'][i%3],0,'leaf');}}}
  // the Covadonga reach's edge planters (pale coping, shrubs).
  for(const p of n.edgePlanters??[]){bake(box,p.x,(p.lo-.2+p.top)/2,p.z,p.length,p.top-p.lo+.2,p.width,'#d9d4c9',p.ry,'solid');bake(box,p.x,p.top+.035,p.z,p.length+.08,.07,p.width+.08,'#ece8de',p.ry,'solid');
    for(const [i,q] of p.shrubs.entries())bake(sphere,q.x,p.top+.22,q.z,.62,.38,.42,['#4b7743','#3f6b3a','#5a8a4a'][i%3],0,'solid');}   // closed spheres: the solid pool (no extra leaf mesh)
  // ---- Plaza Dársenas: bed fences (low green iron), shrubs, the sculpture, the green pavilion canopy (Wikimedia Commons curid=106059407, curid=49348487). ----
  for(const b of n.beds){const r=b.ring;for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],ga=height(...a),gq=height(...q),L=Math.hypot(q[0]-a[0],q[1]-a[1]);
      kit.seg([a[0],ga+.42,a[1]],[q[0],gq+.42,q[1]],.03,IRON_GREEN);kit.seg([a[0],ga+.12,a[1]],[q[0],gq+.12,q[1]],.025,IRON_GREEN);
      for(let k=0;k<Math.max(1,Math.round(L/1.2));k++){const t=k/Math.max(1,Math.round(L/1.2)),x=a[0]+(q[0]-a[0])*t,z=a[1]+(q[1]-a[1])*t,g=ga+(gq-ga)*t;bake(cylinder,x,g+.21,z,.025,.46,.025,IRON_GREEN,0,'solid');}}}
  for(const s of n.shrubs)bake(sphere,s.x,s.y+s.s*.55,s.z,s.s,s.s*.75,s.s,['#3f6b3a','#4b7743','#365f33'][Math.floor(s.s*20)%3],0,'leaf');
  {const s=n.statue,c=[s.x,s.z],ry=-Math.atan2(-.262,.965),y0=s.y-.15;
    bake(box,c[0],(y0+s.y+.35)/2,c[1],2.2,s.y+.35-y0,2.2,'#bdb4a2',ry,'solid');bake(box,c[0],s.y+.45,c[1],1.95,.2,1.95,'#c9c0ae',ry,'solid');
    bake(box,c[0],(y0-.03+s.top)/2,c[1],1.6,s.top-y0+.03,1.6,'#cfc6b4',ry,'solid');bake(box,c[0],s.top-.15,c[1],1.75,.18,1.75,'#ddd5c4',ry,'solid');
    bake(box,c[0],s.top+.255,c[1],.8,.49,.6,'#4a4337',ry,'solid');bake(box,c[0],s.top+.08,c[1],1.85,.16,1.85,'#ddd5c4',ry,'solid');
    bake(cylinder,c[0],s.top+.95,c[1],.36,1.55,.32,'#4a4337',0,'solid');bake(sphere,c[0],s.top+1.9,c[1],.2,.23,.2,'#4a4337',0,'solid');
    bake(box,c[0],s.top+1.25,c[1],.95,.18,.24,'#4a4337',ry,'solid');}
  if(n.pavilion){const pv=n.pavilion;const g=prismGeometry(pv.canopyRing,pv.canopy,pv.canopy+pv.thick),u=prismGeometry(pv.canopyRing,0,pv.canopy,{sides:false});
    // The underside (seen from the plaza): the same cap at the soffit, each triangle's winding reversed to face down.
    {const a=u.attributes.position.array;for(let i=0;i<a.length;i+=9)for(let k=0;k<3;k++){const t=a[i+3+k];a[i+3+k]=a[i+6+k];a[i+6+k]=t;}u.computeVertexNormals();}
    bake(g,0,0,0,1,1,1,'#4f7d5a',0,'solid');bake(u,0,0,0,1,1,1,'#e3e5df',0,'solid');g.dispose();u.dispose();
    // A few green underside members between the posts, all above head height.
    for(let i=0;i+1<pv.posts.length;i++){const a=pv.posts[i],b=pv.posts[i+1];kit.seg([a.x,pv.canopy-.12,a.z],[b.x,pv.canopy-.12,b.z],.07,'#3f6b4a');}
    for(const p of pv.posts)bake(cylinder,p.x,(p.y-.1+pv.canopy)/2,p.z,.12,pv.canopy-p.y+.1,.12,'#e8e6de',0,'solid');}

  // ---- Street furniture: dark lanterns and benches (shared kit), angular port lamps, palms. ----
  // Kit lamps are seated by sj-world's seatKitLamps (l.foot from the drawn ground, incl. this area's deck tops).
  kit.lamps(n.lamps);kit.benches(n.benches);
  for(const l of n.portLamps){const sx=Math.sin(l.face),sz=Math.cos(l.face);
    const f=Math.min(l.y,l.foot??l.y);bake(cylinder,l.x,(f+l.y+.5)/2,l.z,.16,l.y+.5-f,.16,'#4d5355',0,'solid');bake(cylinder,l.x,l.y+2.45,l.z,.07,4.4,.07,'#5d6466',0,'solid');
    // Arm leaning over the walk (away from the water) and a flat luminaire.
    const tip=[l.x-sx*.9,l.y+4.55,l.z-sz*.9];kit.seg([l.x,l.y+4.5,l.z],tip,.045,'#5d6466');
    bake(box,tip[0],tip[1]-.05,tip[2],.62,.12,.3,'#5d6466',Math.atan2(-sz,sx),'solid');bake(box,tip[0],tip[1]-.12,tip[2],.5,.03,.22,'#f2eedc',Math.atan2(-sz,sx),'solid');glowLamp(tip[0],tip[1]-.14,tip[2],'port',{ground:l.y});}
  // Moored ferry (Wikimedia Commons curid=182041799, inferred catamaran proportions): twin dark hulls, white main deck cabin with a dark window band,
  // a smaller upper cabin and a teal sheer stripe. Static and render-only.
  if(n.boat){const B=n.boat,ry=-Math.atan2(B.uz,B.ux),nx=B.uz,nz=-B.ux,at=(u,o)=>[B.x+B.ux*u+nx*o,B.z+B.uz*u+nz*o];
    for(const o of [-2.9,2.9]){const [x,z]=at(0,o);bake(box,x,.25,z,B.length,1.5,2.2,'#2b3f52',ry,'solid');bake(box,x,1.05,z,B.length-.6,.12,2.25,'#2f7f86',ry,'solid');}
    {const [x,z]=at(0,0);bake(box,x,1.35,z,B.length,.5,B.beam,WHITE,ry,'solid');bake(box,x,2.75,z,B.length-5,2.3,B.beam-.8,WHITE,ry,'solid');
      bake(box,x,2.9,z,B.length-4.96,.9,B.beam-.76,'#2a3438',ry,'solid');bake(box,...[at(2,0)].map(([p,q])=>[p,4.5,q])[0],10,1.3,B.beam-2.4,'#eef0ec',ry,'solid');
      const [hx,hz]=at(6,0);bake(box,hx,4.55,hz,3.2,.6,B.beam-2.35,'#2a3438',ry,'solid');bake(box,x,5.25,z,12,.12,B.beam-1.6,'#d9dcd8',ry,'solid');
      // tapered bows (sloped boxes) and two mooring lines back to the terminal's water face.
      for(const sd of [-1,1])for(const o of [-2.9,2.9]){const [bx,bz]=at(sd*(B.length/2+.9),o);bake(box,bx,.55,bz,2.2,.9,2.0,'#2b3f52',ry,'solid',sd*.38);}
      for(const u of [-9,9]){const [px,pz]=at(u,-B.beam/2),[qx,qz]=at(u*1.15,-B.beam/2-6.6);kit.seg([px,1.6,pz],[qx,1.2,qz],.03,'#d8d2bf');}}}
  // Palms (near-route crowns may shade) in two sectors so neither batch spans the whole shore.
  palmInstances(n.palms.filter(p=>p.x<440),'sj-plaza-waterfront-palm-w-',ctx);palmInstances(n.palms.filter(p=>p.x>=440),'sj-plaza-waterfront-palm-e-',ctx);
  const instances=P.flush();
  return {...stats,instances,palms:n.palms.length,lamps:n.lamps.length,portLamps:n.portLamps.length,benches:n.benches.length,fence:n.fence.length,gates:n.gates.length,
    facades:n.facades.length};
}
function isCcw(r){return r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0)>0;}
