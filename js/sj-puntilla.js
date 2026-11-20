/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// La Puntilla visuals — © 2026 VibezZzCoder, MIT. All dimensions come from sj-puntilla-layout.js (shared physical owner).
// ctx: {scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height} — the shared pools.
// Wikimedia Commons curid=184241561, curid=122889567: La Princesa's pale face, white pilasters, tall white shutters in raised surrounds, strong white cornice,
// raised centre bay with a small domed cupola, dark wall lanterns, palm row and clipped hedge, broad shade trees, black
// lanterns and slat benches on large warm-grey/rose panels. 91/92: grey units on Calle Paseo, blue-grey setts and the
// planted island at Inmigrante, pale planters. 93/96: the Arsenal's golden-yellow walls, white portico with an arched
// portal, harbour wing of big arched bays with dark closures, separate red-domed cupola. 92/94: the Aduana's coral-pink
// two-tier walls, ground arches, ochre central pavilion on the harbour face. Coast Guard fence: inferred, plain.
import * as THREE from 'three/webgpu';
import {streetKit,IRON} from './sj-street-kit.js';
import {palmInstances} from './sj-palm.js';
import {boxInstances,formInstances,lowTreeForm,lowPalmForm,mergedMesh} from './sj-seams-kit.js';
import {minusConvex} from './sj-seams-geo.js';

const TRIM='#f4f1e8',PRINCESA_TRIM='#f6f4ee',SHUTTER='#f8f7f3',PLINTH='#cfc8bb',DARK='#2c2a27',ARCH='#36322d';

// Wikimedia Commons curid=184241561: large square panels (≈1.2 m) in warm grey with rose-tinted ones, fine grey joints. One 256 px tile = 4.8 m.
export function panelTexture(textures) {
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  let seed=90211;const r=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){const rose=(i+j)%2===0?r()<.55:r()<.2;
    x.fillStyle=rose?`rgb(${200+r()*10|0},${178+r()*8|0},${170+r()*8|0})`:`rgb(${190+r()*10|0},${186+r()*8|0},${178+r()*8|0})`;x.fillRect(i*64,j*64,64,64);
    for(let k=0;k<220;k++){x.fillStyle=r()<.5?'rgba(80,72,66,.08)':'rgba(255,250,240,.08)';x.fillRect(i*64+r()*64,j*64+r()*64,2,2);}}
  x.strokeStyle='rgba(95,90,84,.75)';x.lineWidth=2;for(let k=0;k<=4;k++){x.beginPath();x.moveTo(k*64,0);x.lineTo(k*64,256);x.stroke();x.beginPath();x.moveTo(0,k*64);x.lineTo(256,k*64);x.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;textures.add(t);return t;
}
// Chain-link diamonds (alpha-tested): one tile per 0.5 m, so ~12 cm diamonds of ~1.2 cm galvanised wire (V3: the first
// 25 cm / 3 cm lattice read as a heavy black grille up close).
// a DataTexture with the link colour in every texel and the coverage in alpha only. The canvas version
// stored transparent texels as premultiplied black, so the mips averaged the link toward black and the fence read as a dark
// wall from the parking and Calle Acacia. Same 64 px tile, 16 px pitch, ~1.6 px wire.
function chainTexture(textures) {
  const S=64,data=new Uint8Array(S*S*4);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const px=x+.5,py=y+.5,m=v=>{const r=((v%16)+16)%16;return Math.min(r,16-r);};
    const dist=Math.min(m(px-py),m(px+py))/Math.SQRT2,a=dist<.8?1:dist<1.3?(1.3-dist)/.5:0,o=(y*S+x)*4;
    data[o]=170;data[o+1]=178;data[o+2]=175;data[o+3]=Math.round(a*255);}
  const t=new THREE.DataTexture(data,S,S,THREE.RGBAFormat);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;textures.add(t);return t;
}

export function buildPuntilla(n,ctx) {
  const {scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}=ctx;
  const kit=streetKit(ctx),stats={};
  // Flat arch panel (rectangle + semicircle), unit width, facing +Z: drawn 2–6 cm proud of a facade.
  const archShape=new THREE.Shape();archShape.moveTo(-.5,0);archShape.lineTo(.5,0);archShape.lineTo(.5,.6);archShape.absarc(0,.6,.5,0,Math.PI,false);archShape.lineTo(-.5,0);
  const arch=own(new THREE.ShapeGeometry(archShape,6));
  const fanShape=new THREE.Shape();fanShape.moveTo(-1,0);fanShape.lineTo(1,0);fanShape.absarc(0,0,1,0,Math.PI,false);const fan=own(new THREE.ShapeGeometry(fanShape,6));
  // Face frame: u along a→b, d along the outward normal n, y absolute. Boxes turn local X along the face; flat panels are
  // turned so their +Z faces outward.
  const frame=f=>{const [ux,uz]=[(f.b[0]-f.a[0])/f.length,(f.b[1]-f.a[1])/f.length],ry=-Math.atan2(uz,ux),out=Math.abs(-uz-f.n[0])<1e-6&&Math.abs(ux-f.n[1])<1e-6;
    const P=(u,d)=>[f.a[0]+ux*u+f.n[0]*d,f.a[1]+uz*u+f.n[1]*d];
    return {L:f.length,ux,uz,ry,P,g:(u,d=.3)=>height(...P(u,d)),
      box:(u,y,d,w,h,dep,c,kind='facade')=>{const [x,z]=P(u,d);bake(box,x,y,z,w,h,dep,c,ry,kind);},
      arch:(u,y0,d,w,h,c)=>{const [x,z]=P(u,d);bake(arch,x,y0,z,w,h/1.1,1,c,out?ry:ry+Math.PI,'facade');}};};
  // Box from a to b (local +X along the segment): bake turns Ry·Rz, rz = asin(dy/l), ry = atan2(−dz,dx).
  const bar=(a,b,w,h,colour,kind='solid')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-4)return;
    bake(box,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,l,h,w,colour,Math.atan2(-dz,dx),kind,Math.asin(Math.max(-1,Math.min(1,dy/l))));};
  const gRange=(F,u0,u1)=>{let lo=Infinity,hi=-Infinity;for(let u=u0;u<=u1+1e-6;u+=Math.max(.25,(u1-u0)/4)){const g=F.g(Math.max(0,Math.min(F.L,u)));lo=Math.min(lo,g);hi=Math.max(hi,g);}return [lo,hi];};

  // ---- La Princesa (Wikimedia Commons curid=184241561, curid=122889567): the Princesa owner's pale shell gets pilasters, shutters, cornice, parapet, plinth,
  // wall lanterns, the central entrance and its cupola. ----
  {const s=n.princesa,R=s.roof;let run=0,shutters=0;
    for(const f of n.princesaFaces){const F=frame(f),bays=Math.max(1,Math.round(F.L/4.2)),bw=F.L/bays;
      F.box(F.L/2,R-.2,.12,F.L+.24,.42,.28,PRINCESA_TRIM);F.box(F.L/2,R+.06,.16,F.L+.32,.1,.38,PRINCESA_TRIM);
      F.box(F.L/2,R+.375,-.06,F.L,.85,.2,'#e7e1d4');F.box(F.L/2,R+.84,-.06,F.L+.06,.08,.26,PRINCESA_TRIM);
      for(let k=0;k<=bays;k++){const u=k*bw,[lo]=gRange(F,Math.max(0,u-.3),Math.min(F.L,u+.3)),top=R-.42;if(top-lo<1)continue;
        F.box(Math.max(.28,Math.min(F.L-.28,u)),(lo-.15+top)/2,.04,.56,top-lo+.15,.1,PRINCESA_TRIM);
        if(k%2===1&&top-lo>4.6){const y=lo+3.7,P=d=>F.P(u,d),[x0,z0]=P(.09),[x1,z1]=P(.32),[x2,z2]=P(.55);
          kit.seg([x0,y-.25,z0],[x1,y+.05,z1],.025,IRON);kit.seg([x1,y+.05,z1],[x2,y+.12,z2],.025,IRON);kit.seg([x0,y+.12,z0],[x1,y+.05,z1],.02,IRON);
          kit.lantern(x2,y+.12,z2,.85);}}
      for(let k=0;k<bays;k++){const u=(k+.5)*bw,mid=run+u;const [lo,hi]=gRange(F,u-.9,u+.9);
        F.box(u,(lo-.25+hi+.45)/2,.025,bw-.56,hi+.45-(lo-.25),.09,PLINTH);  // back 2 cm inside the shell (pilaster backs at −.01)
        void mid;if(n.entrance&&n.entrance.face===f.i&&Math.abs(u-n.entrance.u)<.01){const top=Math.min(R-.6,hi+3.4);
          F.box(u,(hi+top)/2,.04,2.5,top-hi,.08,PRINCESA_TRIM);F.box(u,(hi+.01+top-.2)/2,.08,1.9,top-hi-.21,.06,'#33443a');continue;}
        const b0=hi+.75,b1=Math.min(R-.75,b0+3.2);if(b1-b0<2)continue;
        // Raised surround, a shaded reveal and a pair of louvred leaves (Wikimedia Commons curid=122889567: deep white frames, bright louvres).
        F.box(u,(b0+b1)/2,.06,1.5,b1-b0+.34,.12,PRINCESA_TRIM);F.box(u,(b0+b1)/2,.075,1.18,b1-b0+.04,.04,'#b9b4aa');
        for(const sd of [-1,1])F.box(u+sd*.285,(b0+b1)/2,.11,.54,b1-b0,.05,SHUTTER);
        for(let t=.08;t<.95;t+=.085)F.box(u,b0+(b1-b0)*t,.14,1.1,.025,.012,'#cfcbc2');shutters++;}
      run+=f.length;}
    {const fs=n.princesaFaces;for(const [f,end] of [[fs[0],0],[fs.at(-1),1]]){const F=frame(f),u=end?F.L:0,[x,z]=F.P(u,.05),back=end?1:-1,[ux,uz]=[F.ux*back,F.uz*back];void ux;void uz;
        bake(box,x-f.n[0]*.18,R-.2,z-f.n[1]*.18,.42,.42,.42,PRINCESA_TRIM,F.ry,'facade');bake(box,x-f.n[0]*.12,R+.375,z-f.n[1]*.12,.3,.85,.3,'#e7e1d4',F.ry,'facade');}}
    // Raised centre bay and its cupola (Wikimedia Commons curid=184241561, curid=122889567: square base with arched openings, small white dome).
    if(n.entrance){const f=n.princesaFaces.find(q=>q.i===n.entrance.face),F=frame(f),u=n.entrance.u;
      F.box(u,R+1.2,-.06,8.2,.9,.24,'#e7e1d4');F.box(u,R+1.68,-.06,8.5,.1,.32,PRINCESA_TRIM);
      const [cx,cz]=F.P(u,-4.0),y0=R;bake(box,cx,y0+1.3,cz,2.7,2.6,2.7,PRINCESA_TRIM,F.ry,'solid');
      for(const k of [0,1,2,3]){const a=F.ry+k*Math.PI/2,ox=Math.sin(a)*1.37,oz=Math.cos(a)*1.37;
        bake(arch,cx+ox*1.0,y0+.55,cz+oz*1.0,1.1,1.6/1.1,1,ARCH,a,'facade');}
      bake(box,cx,y0+2.7,cz,3.0,.2,3.0,PRINCESA_TRIM,F.ry,'solid');bake(cylinder,cx,y0+3.05,cz,1.2,.5,1.2,PRINCESA_TRIM,0,'solid');
      // A moulded ring at the dome's spring line hides the faceted sphere/drum join (V3).
      bake(sphere,cx,y0+3.3,cz,1.18,1.05,1.18,'#f2f0ea',0,'solid');bake(cylinder,cx,y0+3.34,cz,1.3,.16,1.3,PRINCESA_TRIM,0,'solid');bake(cylinder,cx,y0+4.5,cz,.12,.5,.12,'#d9d6cf',0,'solid');
      bake(sphere,cx,y0+4.8,cz,.16,.16,.16,'#d9d6cf',0,'solid');}
    stats.princesaShutters=shutters;}

  // Ground-following base course (used by the Arsenal and the Aduana): one strip per face, bottom
  // g − .25, top g + up, front .07, sampled ≤ 1 m, cut at `cuts` [u0,u1,…]. A stepped 6 m box course put its flat top above
  // the local ground at every downhill bay, where it met the arch fills on their own plane.
  const course=(F,f,cuts,up=.4,colour='#c98b80')=>{const runs=[];let a=0;for(const [c0,c1] of [...cuts].sort((x,y)=>x[0]-y[0])){if(c0>a+.05)runs.push([a,Math.min(c0,F.L)]);a=Math.max(a,c1);}
    if(F.L>a+.05)runs.push([a,F.L]);const o=F.P(0,0),pos=[];
    const V=(u,d,y)=>{const [x,z]=F.P(u,d);return [x-o[0],y,z-o[1]];};
    const quad=(A,B,C,D,nx,nz,isTop)=>{const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
      const cr=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],ok=isTop?cr[1]>0:cr[0]*nx+cr[2]*nz>0;
      for(const t of ok?[[A,B,C],[A,C,D]]:[[A,C,B],[A,D,C]])pos.push(...t.flat());};
    for(const [u0,u1] of runs){const n=Math.max(1,Math.ceil(u1-u0)),us=Array.from({length:n+1},(_,i)=>u0+(u1-u0)*i/n),gs=us.map(u=>F.g(u));
      for(let i=0;i<n;i++){const [ua,ub]=[us[i],us[i+1]],[ga,gb]=[gs[i],gs[i+1]];
        quad(V(ua,.07,ga-.25),V(ub,.07,gb-.25),V(ub,.07,gb+up),V(ua,.07,ga+up),f.n[0],f.n[1],false);
        quad(V(ua,.07,ga+up),V(ub,.07,gb+up),V(ub,-.01,gb+up),V(ua,-.01,ga+up),0,0,true);}
      for(const [u,g,sd] of [[u0,gs[0],-1],[u1,gs[n],1]])quad(V(u,-.01,g-.25),V(u,.07,g-.25),V(u,.07,g+up),V(u,-.01,g+up),F.ux*sd,F.uz*sd,false);}
    if(!pos.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
    bake(g,o[0],0,o[1],1,1,1,colour,0,'facade');g.dispose();};
  // ---- Arsenal (Wikimedia Commons curid=149388376, curid=182263185): golden walls, white cornice, dark plinth; portico on the north block, arched harbour bays,
  // barred openings and a pierced parapet on the street face; the separate red-domed cupola. ----
  {const s=n.arsenal,R=s.roof;let arches=0,bars=0;
    for(const f of n.arsenalFaces){const F=frame(f);
      // Cornice from the wall plane out (its top shared the mass roof at R over 1 cm); base course follows the ground.
      F.box(F.L/2,R-.175,.11,F.L+.2,.37,.22,TRIM);  // top 1 cm above the roof (corner overhangs)
      course(F,f,[],.55,'#4f4a44');
      if(f.role==='harbour'){const k=Math.max(1,Math.floor(F.L/4.6)),bw=F.L/k;
        for(let i=0;i<k;i++){const u=(i+.5)*bw,[,hi]=gRange(F,u-1.5,u+1.5),top=Math.min(R-.6,hi+4.8);if(top-hi<3)continue;
          F.arch(u,hi+.55,.04,3.4,top-hi-.5,TRIM);F.arch(u,hi+.55,.07,2.9,top-hi-.85,ARCH);arches++;
          if(i>0){const [lo]=gRange(F,i*bw-.3,i*bw+.3);F.box(i*bw,(lo+R-.36)/2,.05,.5,R-.36-lo,.1,TRIM);}}}
      else if(f.role==='street'||f.role==='plain'&&f.n[1]<-.5&&F.L>5){for(let u=2.4;u<F.L-1.5;u+=3.8){const [,hi]=gRange(F,u-.6,u+.6),b0=hi+1.1,b1=Math.min(R-1.0,b0+1.8);if(b1-b0<1)continue;
          F.box(u,(b0+b1)/2,.035,1.3,b1-b0+.24,.07,TRIM);F.box(u,(b0+b1)/2,.065,1.0,b1-b0,.05,DARK);
          for(const t of [-.3,0,.3])F.box(u+t,(b0+b1)/2,.1,.05,b1-b0,.04,'#8d8a82');bars++;}
        F.box(F.L/2,R+.34,-.05,F.L,.78,.22,TRIM);
        for(let u=.6;u<F.L-.4;u+=1.2)F.box(u,R+.42,.07,.5,.3,.02,'#8f7f4a');}
      else if(f.role==='portico'){const u=F.L/2,[lo,hi]=gRange(F,u-3,u+3);
        F.box(u,(lo-.2+R+1.88)/2,.29,6.0,R+1.88-(lo-.2),.62,n.constants.COLOURS.arsenal,'solid');  // back 2 cm inside the shell, top inside the entablature
        F.arch(u,hi,.62,3.0,4.6,TRIM);F.arch(u,hi,.66,2.4,4.2,'#2b2621');
        const spring=hi+4.2*.6/1.1;F.box(u,spring,.7,2.5,.16,.06,TRIM);{const [x,z]=F.P(u,.69);bake(fan,x,spring+.08,z,1.08,1.75,1,'#7f8c90',F.ry+(Math.abs(-F.uz-f.n[0])<1e-6?0:Math.PI),'facade');}
        for(const du of [-2.55,-1.75,1.75,2.55]){const [x,z]=F.P(u+du,.95);bake(cylinder,x,(hi+.5+R+.9)/2,z,.3,R+.4-hi,.3,TRIM,0,'solid');}
        for(const sd of [-1,1]){const [x,z]=F.P(u+sd*2.15,.95);bake(box,x,(lo-.1+hi+.5)/2,z,1.5,hi+.6-lo,.8,'#4f4a44',F.ry,'solid');}
        F.box(u,R+1.4,.75,6.6,1.0,1.9,TRIM,'solid');F.box(u,R+2.0,.75,7.0,.2,2.1,TRIM,'solid');
        F.box(u,R+2.65,.3,1.8,1.1,.3,TRIM,'solid');{const [x,z]=F.P(u,.3);bake(sphere,x,R+3.35,z,.32,.32,.32,TRIM,0,'solid');}}}
    // Cupola (Wikimedia Commons curid=182263185): yellow drum, white rings, red dome, white lantern. Position inferred (most interior roof point).
    {const c=n.cupola,r=Math.max(1.4,c.radius*.75),y=R;bake(cylinder,c.x,y+1.0,c.z,r,2.0,r,'#f0cb46',0,'solid');
      bake(cylinder,c.x,y+2.05,c.z,r*1.08,.18,r*1.08,TRIM,0,'solid');bake(sphere,c.x,y+2.1,c.z,r*1.02,r*.95,r*1.02,'#b8452f',0,'solid');
      bake(cylinder,c.x,y+2.1+r*.95+.3,c.z,.28,.6,.28,TRIM,0,'solid');bake(sphere,c.x,y+2.1+r*.95+.75,c.z,.22,.26,.22,TRIM,0,'solid');}
    stats.arsenalArches=arches;stats.arsenalBarred=bars;}

  // ---- Aduana (Wikimedia Commons curid=184238581, curid=106059407): coral-pink two-tier walls, cream band and cornice, ground arches with dark fills, upper
  // openings, the ochre central pavilion on the harbour face. ----
  {const s=n.aduana,R=s.roof;let openings=0;
    // the pink base course (front.07) and the dark arch
    // fills (.07) shared one plane at every ground arch. Now: openings are decided first, the base course is one strip that
    // follows the ground (bottom g − .25, top g + .4, front .07, sampled ≤ 1 m) and is cut at each ground arch's surround; a
    // stone threshold fills the cut up to the opening's sill. Ground arches get a real leaf: cream surround (.04), reveal
    // jambs proud to .14, a timber leaf recessed between them (front .09) with a centre stile, a transom and a glazed
    // fanlight (.08) in the muted glass tone fabric/landmarks use (Wikimedia Commons curid=184238581, curid=106059407: glazed arcade doors behind the arches).
    // Street-face openings start at hi + .8, above the course top (local g + .4 ≤ hi + .4): no cut needed there.
    const LEAF='#5b4838',STILE='#3a2e25',FAN=new THREE.Color('#4a3a32').lerp(new THREE.Color('#8ea3ab'),.62).getHexString();
    // Upper and street openings: muted glazing varied per window (the fabric/landmarks palette) behind a white mullion,
    // not flat near-black panels.
    const glaze=(u,y,i)=>{const h=Math.abs(Math.sin(u*12.9898+y*78.233+i*1.618))*43758.5453%1,c=new THREE.Color(ARCH).lerp(new THREE.Color('#8ea3ab'),.62);
      return '#'+c.lerp(new THREE.Color(h<.2?'#5d7078':'#d3dee2'),h<.2?.35:h*.35).getHexString();};
    for(const f of n.aduanaFaces){const F=frame(f),mid=(s.base+R)/2+.4;
      // Cornice from the wall plane outward (was −.02…+.22: its top shared the mass roof plane at R over a 2 cm strip).
      F.box(F.L/2,R-.195,.11,F.L+.2,.41,.22,'#f1e3cf');F.box(F.L/2,mid,.05,F.L,.22,.12,'#f1e3cf');
      const cuts=[],draw=[];
      if(f.role!=='plain'&&F.L>=6){
      const k=Math.max(1,Math.floor(F.L/4.2)),bw=F.L/k,centre=F.L/2,pav=f.role==='harbour'?8:0;
      for(let i=0;i<k;i++){const u=(i+.5)*bw;if(pav&&Math.abs(u-centre)<pav+.8)continue;const [,hi]=gRange(F,u-1.2,u+1.2);
        const top=Math.min(mid-.35,hi+3.4);if(top-hi>2.2){if(f.role==='street'){draw.push(()=>{F.box(u,(hi+.9+top)/2,.035,1.25,top-hi-.9+.2,.07,'#f1e3cf');F.box(u,(hi+.9+top)/2,.065,1.0,top-hi-.9,.05,glaze(u,hi,f.i));
            F.box(u,(hi+.9+top)/2,.1,.05,top-hi-.9,.02,'#f1e3cf');});}
          else{cuts.push([u-1.25,u+1.25,hi+.2]);draw.push(()=>{const y0=hi+.2,h=top-hi-.45,spring=y0+.6*h/1.1;
            F.arch(u,y0,.04,2.5,top-hi-.2,'#f1e3cf');
            F.box(u,(y0+spring)/2,.07,2.05,spring-y0,.04,LEAF);F.box(u,(y0+spring)/2,.105,.07,spring-y0,.02,STILE);
            F.box(u,spring+.035,.1,2.05,.07,.04,STILE);for(const sd of [-1,1])F.box(u+sd*1.095,(y0+spring)/2,.06,.14,spring-y0,.16,'#efe0c9');
            const [x,z]=F.P(u,.08);bake(fan,x,spring+.07,z,1.025,.5*h/1.1-.07,1,'#'+FAN,F.ry+(Math.abs(-F.uz-f.n[0])<1e-6&&Math.abs(F.ux-f.n[1])<1e-6?0:Math.PI),'facade');
            F.box(u,hi+1.4,.125,1.9,.06,.02,'#cdbfae');});}openings++;}
        const u0=mid+.6,u1=R-.8;if(u1-u0>1.2){
          if(f.role==='north'){F.arch(u,u0-.08,.035,1.45,u1-u0+.16,'#f1e3cf');F.arch(u,u0,.06,1.15,u1-u0,glaze(u,u0,f.i));
            const sp=u0+.6*(u1-u0)/1.1;F.box(u,(u0+sp)/2,.075,.05,sp-u0,.02,'#f1e3cf');F.box(u,sp,.075,1.15,.05,.02,'#f1e3cf');}
          else{F.box(u,(u0+u1)/2,.035,1.25,u1-u0+.2,.07,'#f1e3cf');F.box(u,(u0+u1)/2,.065,1.0,u1-u0,.05,glaze(u,u0,f.i));F.box(u,(u0+u1)/2,.1,.05,u1-u0,.02,'#f1e3cf');}openings++;}}
      if(pav)cuts.push([centre-pav,centre+pav,null]);}
      course(F,f,cuts);
      // Thresholds under the cut openings: ground − .25 up to the opening's sill, front .10 (proud of the course).
      for(const [c0,c1,sill] of cuts){if(sill===null)continue;const [lo]=gRange(F,c0,c1);if(sill-(lo-.25)>.05)F.box((c0+c1)/2,(lo-.25+sill)/2,.05,c1-c0,sill-(lo-.25),.1,'#d3c8b6');}
      for(const d of draw)d();
      if(f.role==='plain'||F.L<6)continue;
      const centre=F.L/2,pav=f.role==='harbour'?8:0;
      if(pav){const [lo,hi]=gRange(F,centre-pav,centre+pav),top=R+3.2;F.box(centre,(lo-.2+top)/2,.89,2*pav,top-lo+.2,1.82,'#cf9440','solid');  // back 2 cm inside the shell
        F.box(centre,top+.15,.9,2*pav+.4,.3,2.1,'#efdcae','solid');
        F.arch(centre,hi+.15,1.82,3.6,4.9,'#efdcae');F.arch(centre,hi+.15,1.85,2.9,4.5,'#3a2c22');
        for(const du of [-5.6,-3.6,3.6,5.6]){F.box(centre+du,(hi+.9+hi+3.6)/2,1.82,.8,2.7,.04,'#efdcae');F.box(centre+du,(hi+.9+hi+3.6)/2,1.85,.56,2.45,.03,'#3a2c22');}
        const y0=mid+.5,y1=top-.7,cols=9,rows=4;
        for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const u=centre-pav+.9+(i+.5)*(2*pav-1.8)/cols,y=y0+(j+.5)*(y1-y0)/rows;
          F.box(u,y,1.82,(2*pav-1.8)/cols-.35,(y1-y0)/rows-.3,.04,(i+j)%2?'#b36f2f':'#a55f27');F.box(u,y,1.84,.18,.18,.03,'#e4c27e');}
        for(const du of [-pav,-pav/2,0,pav/2,pav])F.box(centre+du,top+.6,.9,.32,.6,.32,'#efdcae','solid');}}
    // Shallow red pitches on the long faces above the cornice (Wikimedia Commons curid=106059407: tile roofs read at water level). Hip-trimmed slopes
    // from the cornice to a ridge 3.4 m inside, 1.3 m up; the flat red roof below fills the remaining area.
    {const tiles=[],rise=1.3,run=3.4;
      for(const f of n.aduanaFaces){if(f.length<12||f.role==='plain')continue;const F=frame(f),inn=[-f.n[0],-f.n[1]],L=F.L;
        const a0=F.P(0,0),b0=F.P(L,0),a1=[a0[0]+inn[0]*run+F.ux*run,a0[1]+inn[1]*run+F.uz*run],b1=[b0[0]+inn[0]*run-F.ux*run,b0[1]+inn[1]*run-F.uz*run];
        tiles.push([[a0[0],R+.02,a0[1]],[b0[0],R+.02,b0[1]],[b1[0],R+.02+rise,b1[1]],[a1[0],R+.02+rise,a1[1]]]);}
      const pos=[];for(const [a,b,c,d] of tiles){const up=(q,p0,p1)=>{const e1=[p0[0]-q[0],p0[1]-q[1],p0[2]-q[2]],e2=[p1[0]-q[0],p1[1]-q[1],p1[2]-q[2]];return e1[2]*e2[0]-e1[0]*e2[2];};
        for(const t of [[a,b,c],[a,c,d]])pos.push(...(up(...t)>0?t:[t[0],t[2],t[1]]).flat());}
      if(pos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
        bake(g,0,0,0,1,1,1,n.constants.COLOURS.aduanaRoof,0,'solid');g.dispose();stats.aduanaRoofSlopes=tiles.length;}}
    stats.aduanaOpenings=openings;}

  // ---- Street furniture (shared kit), palms, hedge, island lip, planters, tree cut-outs. ----
  kit.lamps(n.lamps);kit.benches(n.benches);kit.trees(n.trees);
  for(const t of n.trees)if(t.cutout)bake(cylinder,t.x,t.y+.0,t.z,1.05,.1,1.05,'#5b4e40',0,'solid');
  // the closed base's palms are appended to the same instanced variants (existing palms keep their slots).
  // (Perf 2026-11-18: the base's palms are low-poly forms of their own again; this set is La Princesa's row only.)
  palmInstances(n.palms,'sj-plaza-puntilla-palm-',ctx);
  for(const [i,h] of n.hedges.entries()){bake(box,h.x,(h.lo-.1+h.y+.82)/2,h.z,h.len,h.y+.82-(h.lo-.1),.84,'#3f6b3a',h.ang,'solid');
    for(const t of [-.3,0,.3])bake(sphere,h.x+h.ux*h.len*t,h.y+.84,h.z+h.uz*h.len*t,h.len*.24,.16,.46,['#46753f','#3d6837','#4f7d45'][(i+Math.round(t*10))%3],h.ang,'leaf');}
  for(const k of n.kerb){const H=Math.max(k.ta,k.tb)-k.lo+.05,o=[-k.n[0]*.09,-k.n[1]*.09];
    bar([k.a[0]+o[0],k.ta-H/2,k.a[1]+o[1]],[k.b[0]+o[0],k.tb-H/2,k.b[1]+o[1]],.18,H,'#cbc6ba');}
  for(const p of n.planters){bake(box,p.x,(p.g-.1+p.top)/2,p.z,1.0,p.top-p.g+.1,1.0,'#e6e2d8',p.ang,'solid');bake(sphere,p.x,p.top+.3,p.z,.48,.42,.48,'#4f7a46',0,'leaf');}

  // ---- Coast Guard fence (inferred): chain-link panels, posts, top rail; white-framed gates where roads meet it. ----
  {const {height:H}=n.constants.FENCE,pos=[],uv=[],nor=[],idx=[];let s=0;
    const posts=new Set(),post=(p,g)=>{const key=`${Math.round(p[0]*20)},${Math.round(p[1]*20)}`;if(posts.has(key))return;posts.add(key);
      bake(cylinder,p[0],g+(H+.1)/2-.05,p[1],.05,H+.1,.05,'#59605d',0,'solid');};
    const inGate=q=>n.gates.some(g=>Math.hypot(q[0]-g.x,q[1]-g.z)<g.half-.05);
    for(const f of n.fence){const L=Math.hypot(f.q[0]-f.p[0],f.q[1]-f.p[1]),nx=-(f.q[1]-f.p[1])/L,nz=(f.q[0]-f.p[0])/L,b=pos.length/3;
      pos.push(f.p[0],f.g0-.05,f.p[1],f.q[0],f.g1-.05,f.q[1],f.q[0],f.g1+H,f.q[1],f.p[0],f.g0+H,f.p[1]);
      for(let k=0;k<4;k++)nor.push(nx,0,nz);uv.push(s*2,0,(s+L)*2,0,(s+L)*2,(H+.05)*2,s*2,(H+.05)*2);
      idx.push(b,b+1,b+2,b,b+2,b+3);s+=L;if(!inGate(f.p))post(f.p,f.g0);if(!inGate(f.q))post(f.q,f.g1);
      if(!inGate(f.p)&&!inGate(f.q))kit.seg([f.p[0],f.g0+H,f.p[1]],[f.q[0],f.g1+H,f.q[1]],.03,'#59605d');}
    if(pos.length){const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingSphere();
      // alphaTest 0.25: the link coverage (~0.35) survives the averaged mips, so the mesh reads as a grey panel at approach
      // distance instead of dropping out (V3, phone WebGL2). metalness 0 (galvanised grey; with no environment map
      // the metallic link read as a near-black wall from the parking and Acacia).
      const m=new THREE.Mesh(g,mat({map:chainTexture(textures),color:'#b4bbb8',alphaTest:.2,side:THREE.DoubleSide,roughness:.8,metalness:0}));
      m.name='sj-plaza-puntilla-fence';m.castShadow=false;m.receiveShadow=true;scene.add(m);meshes.push(m);}
    for(const gt of n.gates){for(const sd of [-1,1]){const x=gt.x+gt.ux*gt.half*sd,z=gt.z+gt.uz*gt.half*sd,g=height(x,z);
        bake(box,x,g+1.3,z,.22,2.6,.22,'#dcdcd4',-Math.atan2(gt.uz,gt.ux),'solid');}
      const A=[gt.x-gt.ux*gt.half,gt.z-gt.uz*gt.half],B=[gt.x+gt.ux*gt.half,gt.z+gt.uz*gt.half],ga=height(...A),gb=height(...B),C=[gt.x,gt.z],gc=height(...C);
      for(const yy of [.2,1.1,2.1])for(const [p,q,gp,gq] of [[A,C,ga,gc],[C,B,gc,gb]])bar([p[0],gp+yy,p[1]],[q[0],gq+yy,q[1]],.07,.07,'#ecece6');
      bar([C[0],gc+.1,C[1]],[C[0],gc+2.15,C[1]],.08,.08,'#ecece6');
      for(const [p,q,gp,gq] of [[A,C,ga,gc],[C,B,gc,gb]])bar([p[0],gp+.2,p[1]],[q[0],gq+2.1,q[1]],.05,.05,'#ecece6');}}
  if(n.baseDress)Object.assign(stats,drawBaseDress(n.baseDress,ctx,quayTriangles(n.quayApron,ctx.world?.coast)));
  return {...stats,lamps:n.lamps.length,benches:n.benches.length,trees:n.trees.length,palms:n.palms.length,hedges:n.hedges.length,fence:n.fence.length,gates:n.gates.length};
}

// ---- the closed Coast Guard base interior (render only; layout `baseDress`). Plain white/cream service
// blocks with window bands, doors and roll-up doors, red hip tile roofs on the shore houses, roof plant, parked cars, the
// Acacia seawall, palms and shade trees, generic white cutters at the east piers. Three meshes: one box instance set, one
// merged roof/hull mesh, the shade-tree form (two). Palms join the existing palm instances. ----
function drawBaseDress(d,ctx,quay=[]){
  // Perf (2026-11-18): the sealed base is never approached within the fence, so nothing in it casts a shadow, its trees are
  // low-poly forms, and every batch is split north/south of z 490 (each part well under 512 m, tight bounds).
  const sector=(x,z)=>z<490?'n':'s',{height}=ctx,bx=boxInstances('sj-plaza-puntilla-base-boxes',ctx,{castShadow:false,sector}),tris=[];
  const face=(f,u,dd)=>[f.a[0]+(f.b[0]-f.a[0])/f.L*u+f.n[0]*dd,f.a[1]+(f.b[1]-f.a[1])/f.L*u+f.n[1]*dd];
  const fry=f=>-Math.atan2(f.b[1]-f.a[1],f.b[0]-f.a[0]);
  // the drawn masses stand 6 cm out from these face lines, so every trim front (.06)
  // shared the wall plane (22 sites). The whole dress set moves 3 cm out (trim fronts 3 cm proud, glass 5 cm).
  const fb=(f,u,y,dd,w,h,dep,c)=>{const [x,z]=face(f,u,dd+.03);bx.box(x,y,z,w,h,dep,c,fry(f));};
  let windows=0,doors=0,roofs=0;
  const tri=(a,b,c,paint,up)=>{const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const nrm=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
    tris.push(nrm[0]*up[0]+nrm[1]*up[1]+nrm[2]*up[2]>=0?[a,b,c,paint]:[a,c,b,paint]);};
  for(const b of d.buildings){
    const trim=b.role==='house'?'#ffffff':'#d9d5cb',glass='#36444b',R=b.roof;
    for(const f of b.faces){let lo=Infinity,hi=-Infinity;for(let u=0;u<=f.L+1e-6;u+=Math.max(.5,f.L/6)){const g=height(...face(f,Math.min(u,f.L),.4));lo=Math.min(lo,g);hi=Math.max(hi,g);}
      // Roof edge: a parapet coping on flat roofs; a white fascia under the hip eaves.
      if(b.hip)fb(f,f.L/2,R-.16,.07,f.L,.26,.12,'#f6f4ee');else{const fi=b.faces.indexOf(f),k=(fi===b.faces.length-1&&fi%2===0&&fi>0?2:fi%2)*.015;fb(f,f.L/2,R+.24+k,-.1,f.L+.24,.52,.26,'#f4f2ec');}   /* bottom 2 cm under the roof plane, alternate faces 1.5 cm apart at the overlapping corners*/
      const door=b.door===f.i,levels=Math.max(1,Math.min(3,Math.floor((R-hi)/3.1))),n=Math.floor((f.L-.8)/3.2);
      if(n<1)continue;
      const doorU=door?(Math.round((n-1)/2)+.5)*f.L/n:null;
      // two (the shed's even square rhythm read as blockout): sheds group their openings in pairs
      // with a blank panel between groups and an occasional ground-floor service door (photo-free inference; base refs).
      const shed=b.role==='shed',grouped=k=>(shed&&n>=4||n>=6)&&k%3===2;
      for(let l=0;l<levels;l++)for(let k=0;k<n;k++){const u=(k+.5)*f.L/n,s=hi+.95+l*3.15,t=s+1.35;if(t>R-.45)continue;
        if(door&&l===0&&Math.abs(u-doorU)<.01)continue;
        // A shed's big door surround (w + .4 wide, up to hi + h + .125) covers upper windows on its own plane: skip those.
        if(door&&shed&&f.L>7&&Math.abs(u-doorU)<(Math.min(4.2,f.L-2)+.4)/2+.65&&s<hi+Math.min(4.2,R-hi-.6)+.25)continue;
        if(grouped(k)){if(l===0&&!door&&k%6===2&&hi+2.4<R-.4){fb(f,u,hi+1.15,.03,1.5,2.3,.06,trim);fb(f,u,hi+1.1,.06,1.2,2.2,.04,'#6f7a7e');doors++;}continue;}
        fb(f,u,(s+t)/2,.03,1.3,t-s+.24,.06,trim);fb(f,u,(s+t)/2,.06,1.0,t-s,.04,glass);windows++;}
      if(door){if(b.role==='shed'&&f.L>7){const w=Math.min(4.2,f.L-2),h=Math.min(4.2,R-hi-.6);
          fb(f,doorU,hi+h/2,.03,w+.4,h+.25,.06,'#ebe8df');fb(f,doorU,hi+h/2-.06,.06,w,h-.1,.04,'#9aa3a6');
          for(let y=hi+.5;y<hi+h-.2;y+=.6)fb(f,doorU,y,.085,w-.1,.04,.02,'#7f878a');}
        else{fb(f,doorU,hi+1.2,.03,1.5,2.5,.06,trim);fb(f,doorU,hi+1.15,.06,1.1,2.3,.04,'#4f5e66');
          fb(f,doorU,hi+2.62,.25,1.9,.12,.55,'#f4f2ec');}
        doors++;}}
    // Hip roof (houses with a rectangular footprint): eaves 0.35 m out, ridge on the long axis, a soffit under the overhang.
    if(b.hip){const r=b.hip,o=.35,c=[r.ring.reduce((s,p)=>s+p[0],0)/4,r.ring.reduce((s,p)=>s+p[1],0)/4],[u,v]=[r.u,r.v];
      const long=r.len>=r.wid,L=(long?r.len:r.wid)/2+o,Wd=(long?r.wid:r.len)/2+o,ax=long?u:v,bxv=long?v:u,rise=Math.min(2.4,Wd*.55),ey=R-.08,ry=R-.08+rise;
      const P=(s,t,y)=>[c[0]+ax[0]*s+bxv[0]*t,y,c[1]+ax[1]*s+bxv[1]*t],r0=L-Wd;
      const E=[P(-L,-Wd,ey),P(L,-Wd,ey),P(L,Wd,ey),P(-L,Wd,ey)],K=[P(-r0,0,ry),P(r0,0,ry)],up=q=>[q[0]-c[0],5,q[2]-c[1]];
      const col='#a9503a',mid=(...ps)=>ps.reduce((s,p)=>[s[0]+p[0]/ps.length,s[1]+p[1]/ps.length,s[2]+p[2]/ps.length],[0,0,0]);
      tri(E[0],E[1],K[1],col,up(mid(E[0],E[1],K[1])));tri(E[0],K[1],K[0],col,up(mid(E[0],K[1],K[0])));
      tri(E[2],E[3],K[0],col,up(mid(E[2],E[3],K[0])));tri(E[2],K[0],K[1],col,up(mid(E[2],K[0],K[1])));
      tri(E[1],E[2],K[1],col,up(mid(E[1],E[2],K[1])));tri(E[3],E[0],K[0],col,up(mid(E[3],E[0],K[0])));
      tri(E[0],E[1],E[2],'#e9e4d8',[0,-1,0]);tri(E[0],E[2],E[3],'#e9e4d8',[0,-1,0]);roofs++;}
    else if(b.role!=='house'){const units=Math.min(3,Math.max(1,Math.round(b.area/350)));
      for(let k=0;k<units;k++){const x=b.c[0]+(k-(units-1)/2)*3.2,z=b.c[1]+(k%2?1.4:-1.4);if(!inRingXZ(x,z,b.outer))continue;
        bx.box(x,R+.625,z,1.7,1.23,1.3,'#aeb2b0');bx.box(x,R+1.28,z,1.2,.1,.9,'#8d9290');}}}  // unit 1 cm off the roof and off coping planes
  // Cars: four tyres on the sampled level bay, and three generic profiles — sedan, hatchback, van. Unmarked.
  for(const c of d.cars){const P=(u,v)=>[c.x+Math.cos(-c.heading)*u-Math.sin(-c.heading)*v,c.z+Math.sin(-c.heading)*u+Math.cos(-c.heading)*v];
    const y=c.y,b=(u,v,yy,l,h,w,col)=>{const [x,z]=P(u,v);bx.box(x,y+yy,z,l,h,w,col,c.heading);},glass='#2b353b';
    for(const u of [-c.half,c.half])for(const v of [-.75,.75])b(u,v,.31,.62,.62,.22,'#1f2224');
    if(c.type===2){b(0,0,1.05,4.9,1.4,1.8,c.paint);b(2.46,0,1.38,.02,.5,1.6,glass);
      for(const v of [-.91,.91])b(.6,v,1.4,2.8,.4,.02,glass);}
    else{const L=c.type===1?3.9:4.4,cab=c.type===1?2.0:2.2,off=c.type===1?-.45:-.3;
      b(0,0,.66,L,.6,1.74,c.paint);b(off,0,1.18,cab,.46,1.5,c.paint);
      for(const v of [-.76,.76])b(off,v,1.2,cab-.3,.3,.02,glass);
      for(const u of [off-cab/2-.01,off+cab/2+.01])b(u,0,1.2,.02,.3,1.34,glass);}}
  // Seawall: a low rendered wall and a coping on the water side of Calle Acacia.
  for(const s of d.wall){const lift=(p,dy)=>[p[0],p[1]+dy,p[2]];bx.bar(lift(s.a,.2),lift(s.b,.2),.38,1.0,'#d9d5cb');bx.bar(lift(s.a,.74),lift(s.b,.74),.5,.1,'#ecebe5');}
  // Cutters: hull (dark boot below 0.5 m, white topsides, grey deck) and a white superstructure. Generic, no markings.
  for(const c of d.cutters){const k=c.length/30,q=c.beam/6.6,cs=Math.cos(c.heading),sn=Math.sin(c.heading);
    const W=(u,v,y)=>[c.x+cs*u-sn*v,y,c.z+sn*u+cs*v];
    const deck=[[-15,-3.3],[8,-3.3],[12.5,-2.2],[15,0],[12.5,2.2],[8,3.3],[-15,3.3]].map(([u,v])=>[u*k,v*q]);
    const ring=(y,s)=>deck.map(([u,v])=>W(u*(s<1?.97:1),v*s,y));
    const D=ring(1.9,1),M=ring(.5,.92),B=ring(-.4,.8),cen=W(0,0,0);
    for(let i=0;i<deck.length;i++){const j=(i+1)%deck.length,out=p=>[p[0]-cen[0],0,p[2]-cen[2]];
      const m=[(D[i][0]+D[j][0])/2,0,(D[i][2]+D[j][2])/2];
      tri(D[i],D[j],M[j],'#eef0ee',out(m));tri(D[i],M[j],M[i],'#eef0ee',out(m));tri(M[i],M[j],B[j],'#3a3f43',out(m));tri(M[i],B[j],B[i],'#3a3f43',out(m));
      tri(W(0,0,1.9),D[i],D[j],'#a3a8a8',[0,1,0]);}
    const sb=(u,v,y,w,h,dd,col)=>{const p=W(u*k,v*q,y);bx.box(p[0],p[1],p[2],w*k,h,dd*q,col,-c.heading);};
    const o=[0,2.5,-1.5][c.v??0],mh=[4.4,3.4,5.2][c.v??0];
    sb(-3+o,0,3.15,[11,9,13][c.v??0],2.5,5,'#f2f3f0');sb(.5+o,0,5.3,5,1.8,5.4,'#f2f3f0');sb(3.03+o,0,5.4,.06,.7,5,'#26323a');
    for(const v of [-2.72,2.72])sb(.5+o,v,5.4,4.6,.6,.05,'#26323a');
    sb(-.5+o,0,6.2+mh/2,.35,mh,.35,'#e8e9e6');sb(-.5+o,0,6.2+mh-1,.2,.2,3,'#e8e9e6');sb(-.5+o,0,7.3,1.6,.15,.3,'#3a3f42');sb(-6+o,0,4.7,1.6,1,2,'#f2f3f0');
    if(c.v!==1){sb(-11,0,2.4,6.5,.9,2.6,'#d07a2c');sb(-11,0,2.95,1.2,.5,1,'#e8e8e4');}else sb(-10,0,2.6,3,1.2,3.6,'#d9dcd9');
    for(const v of [-3.15,3.15])sb(-3.5,v,2.45,23,.05,.05,'#cfd2cf');}
  mergedMesh('sj-plaza-puntilla-base-roofs-n',tris.filter(t=>(t[0][2]+t[1][2]+t[2][2])/3<490),ctx,{castShadow:false});
  mergedMesh('sj-plaza-puntilla-base-roofs-s',tris.filter(t=>(t[0][2]+t[1][2]+t[2][2])/3>=490),ctx,{castShadow:false});
  // Calle Acacia asphalt drape (exact terrain triangles; offset like the shared overlays, so it never fights the ground).
  // Seams the Aduana quay apron (`quay`, [a,b,c,colour]) shares this mesh through vertex colours (no new
  // draw call or material); both parts lie within z 278–600, well under the 512 m sector rule.
  const drape=[...d.roadTris.map(t=>[t[0],t[1],t[2],'#6a6f70']),...quay];
  if(drape.length){const p=new Float32Array(drape.length*9),col=new Float32Array(drape.length*9),c=new THREE.Color();
    drape.forEach((t,q)=>{c.set(t[3]);for(let v=0;v<3;v++){p.set(t[v],q*9+v*3);col.set([c.r,c.g,c.b],q*9+v*3);}});
    const g=ctx.own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
    g.computeVertexNormals();g.computeBoundingSphere();
    // The quay apron is near level (≤ 1.3 m over 7 m): straight-up normals, so its clipped triangles do not shade as facets.
    {const nr=g.attributes.normal.array;for(let v=d.roadTris.length*3;v<drape.length*3;v++)nr.set([0,1,0],v*3);}
    const m=new THREE.Mesh(g,ctx.mat({color:'#ffffff',vertexColors:true,roughness:.94,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    m.name='sj-plaza-puntilla-base-asphalt';m.receiveShadow=true;ctx.scene.add(m);ctx.meshes.push(m);}
  const n=bx.flush();
  formInstances(d.trees,'sj-plaza-puntilla-base-tree-',lowTreeForm,ctx,{castShadow:false,sector});
  formInstances(d.palms,'sj-plaza-puntilla-base-palm-',lowPalmForm,ctx,{castShadow:false,sector});
  return {baseBoxes:n,baseWindows:windows,baseDoors:doors,baseHipRoofs:roofs,baseCars:d.cars.length,baseWall:d.wall.length,baseCutters:d.cutters.length,
    baseTrees:d.trees.length,basePalms:d.palms.length};
}
// Seams the Aduana quay apron's triangles, [a,b,c,colour], on the land cells' terrain triangles (the
// layout's drape). `coast` owns the fill ears beyond them (its quay aprons, +3 cm, same weathered-concrete tone) and the
// coping, so the apron takes that tone with a light per-2 m-cell variation (Wikimedia Commons curid=106059407: the paved yard runs to the quay
// edge) and a pale concrete joint line against the parking. `coast`'s waterline strips (south of z 336) cut the terrain
// and draw their own sloped shore: the apron stops at them.
function quayTriangles(q,coast){if(!q)return [];const out=[],up=t=>{const e1=[t[1][0]-t[0][0],t[1][2]-t[0][2]],e2=[t[2][0]-t[0][0],t[2][2]-t[0][2]];
    return e1[1]*e2[0]-e1[0]*e2[1]>=0?t:[t[0],t[2],t[1]];};
  const SLAB=['#6d706c','#6b6e6a','#6f726e'],tone=(x,z)=>{let h=Math.imul(Math.floor(x/2)*73856093^Math.floor(z/2)*19349663,2654435761)>>>0;return SLAB[h%3];};
  const paint=t=>{const cx=(t[0][0]+t[1][0]+t[2][0])/3,cz=(t[0][2]+t[1][2]+t[2][2])/3;return t[3]===0?'#a29f97':tone(cx,cz);};
  const strips=(coast?.cuts??[]).filter(c=>c.kind==='coast-strip'&&q.rings.some(r=>c.ring.some(p=>p[0]>Math.min(...r.map(v=>v[0]))-1&&p[0]<Math.max(...r.map(v=>v[0]))+1&&p[1]>Math.min(...r.map(v=>v[1]))-1&&p[1]<Math.max(...r.map(v=>v[1]))+1))).map(c=>c.ring);
  const fan=(poly,tag)=>{for(let k=1;k+1<poly.length;k++){const tri=[poly[0],poly[k],poly[k+1]];
    if(Math.abs((tri[1][0]-tri[0][0])*(tri[2][2]-tri[0][2])-(tri[1][2]-tri[0][2])*(tri[2][0]-tri[0][0]))<1e-9)continue;out.push([...up(tri),paint([...tri,tag])]);}};
  for(const t of q.tris){let polys=[t.slice(0,3)];
    for(const r of strips){const bx=[Math.min(...r.map(p=>p[0])),Math.max(...r.map(p=>p[0])),Math.min(...r.map(p=>p[1])),Math.max(...r.map(p=>p[1]))];
      polys=polys.flatMap(pp=>Math.max(...pp.map(p=>p[0]))<bx[0]||Math.min(...pp.map(p=>p[0]))>bx[1]||Math.max(...pp.map(p=>p[2]))<bx[2]||Math.min(...pp.map(p=>p[2]))>bx[3]?[pp]:minusConvex(pp,r));}
    for(const pp of polys)fan(pp,t[3]);}
  return out;}
function inRingXZ(x,z,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
