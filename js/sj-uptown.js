/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Upper town visuals — © 2026 VibezZzCoder, MIT. Every dimension comes from sj-uptown-layout.js (shared physical owner).
// ctx: {scene,own,box,cylinder,sphere,mat,meshes,height} — this area keeps its OWN instanced pools in two spatial zones
// (west of x −300: lawn, Escuela, Asilo, Ballajá, Casa Blanca; east: San José, Galería, Hospital, Museo) so ~1,000 m of
// facades cost a handful of draw calls instead of one pool per 64 m block (mesh budget +25).
// References: Wikimedia Commons curid=126751363 (Escuela), Wikimedia Commons curid=163264065 + Bjoertvedt 2016 (Ballajá), P. Hughes 2009 (Asilo),
// Mariordo 2019 + Ligocsicnarf89 2025 (San José and its plaza), P. Hughes 2018 (Ponce de León), Hughes 2018 /
// Ligocsicnarf89 2025 (Casa Blanca), wanderlost63 2012 (Casals), HABS PR-1530 (Contrafuertes), Ligocsicnarf89 2025
// (Museo de San Juan), Wikimedia Commons curid=72603185 (lawn edge).
import * as THREE from 'three/webgpu';
import {streetKit,IRON} from './sj-street-kit.js';

const DOOR='#4a3426',DOOR_LINE='#2a1d14',BRONZE='#3d3a30',ARCH_DARK='#5e574b';

export function buildUptown(n,ctx) {
  const {scene,own,box,cylinder,sphere,mat,meshes,height}=ctx;
  const stats={};
  // ---- Own pools: instanced primitives per zone/kind, merged batches for one-off geometry. ----
  const archShape=new THREE.Shape();archShape.moveTo(-.5,0);archShape.lineTo(.5,0);archShape.lineTo(.5,.6);archShape.absarc(0,.6,.5,0,Math.PI,false);archShape.lineTo(-.5,0);
  const arch=own(new THREE.ShapeGeometry(archShape,6));
  const fanShape=new THREE.Shape();fanShape.moveTo(-1,0);fanShape.lineTo(1,0);fanShape.absarc(0,0,1,0,Math.PI,false);const fan=own(new THREE.ShapeGeometry(fanShape,6));
  const ico0=own(new THREE.IcosahedronGeometry(1,0));
  const prims=new Map([[box,'box'],[cylinder,'cyl'],[sphere,'sph'],[arch,'arch'],[fan,'fan'],[ico0,'ico0']]);
  const pools=new Map(),batches=new Map(),dummy=new THREE.Object3D(),m4=new THREE.Matrix4(),nm=new THREE.Matrix3(),col=new THREE.Color(),v=new THREE.Vector3(),nv=new THREE.Vector3();
  // 256 m spatial bins (every batch spans ≤ ~370 m: frustum culling works), facade and small solid
  // parts share one non-casting pool; only kind 'cast' (walls, roofs, nave, dome, magazine) and 'leaf' (route-side crowns)
  // cast shadows; 'leafx' (sealed-garden planting) does not.
  const zoneOf=([x,z])=>`${Math.floor(x/256)}_${Math.floor(z/256)}`;
  function put(g,x,y,z,sx,sy,sz,paint,ry=0,kind0='facade',rz=0,zoneAt=[x,z]){const kind=kind0==='facade'||kind0==='solid'?'part':kind0;
    dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();col.set(paint);
    const prim=prims.get(g),zone=zoneOf(zoneAt);
    if(prim){const key=zone+'|'+kind+'|'+prim;let p=pools.get(key);if(!p)pools.set(key,p={g,kind,name:prim,zone,m:[],c:[]});
      p.m.push(...dummy.matrix.elements);p.c.push(col.r,col.g,col.b);return;}
    m4.copy(dummy.matrix);nm.getNormalMatrix(m4);const key=zone+'|'+kind;let b=batches.get(key);if(!b)batches.set(key,b={kind,zone,p:[],n:[],c:[]});
    const P=g.attributes.position,N=g.attributes.normal,I=g.index;
    for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;v.fromBufferAttribute(P,j).applyMatrix4(m4);nv.fromBufferAttribute(N,j).applyNormalMatrix(nm);
      b.p.push(v.x,v.y,v.z);b.n.push(nv.x,nv.y,nv.z);b.c.push(col.r,col.g,col.b);}}
  // An instance with an explicit (possibly sheared) matrix into its zone's pool (column-major elements).
  const putM=(g,m,paint,kind0,zoneAt)=>{const kind=kind0==='facade'||kind0==='solid'?'part':kind0;col.set(paint);const prim=prims.get(g),zone=zoneOf(zoneAt),key=zone+'|'+kind+'|'+prim;
    let p=pools.get(key);if(!p)pools.set(key,p={g,kind,name:prim,zone,m:[],c:[]});p.m.push(...m);p.c.push(col.r,col.g,col.b);};
  // Raw triangles (world space) into a batch, optionally both windings (eaves seen from below).
  const tris=(list,paint,kind='solid',both=false)=>{if(!list.length)return;const pos=[];
    for(const [a,b,c] of list){pos.push(...a,...b,...c);if(both)pos.push(...a,...c,...b);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
    put(g,0,0,0,1,1,1,paint,0,kind,0,[list[0][0][0],list[0][0][2]]);g.dispose();};
  const upTri=(a,b,c)=>{const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];return (e1[2]*e2[0]-e1[0]*e2[2])>0?[a,b,c]:[a,c,b];};
  const kit=streetKit({bake:put,own,box,cylinder,sphere});
  const bar=(a,b,w,h,colour,kind='solid')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-4)return;
    put(box,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,l,h,w,colour,Math.atan2(-dz,dx),kind,Math.asin(Math.max(-1,Math.min(1,dy/l))));};

  // Face frame: u along a→b, d along the outward normal; boxes turn local X along the face, flat panels face outward.
  const backsOf=new Map();  // face → applied boxes' [u0,u1,y0,y1,back] (back allocator below)
  const frame=f=>{const ry=Math.atan2(-f.uz,f.ux),rp=Math.atan2(f.n[0],f.n[1]),P=(u,d)=>[f.a[0]+f.ux*u+f.n[0]*d,f.a[1]+f.uz*u+f.n[1]*d];
    // no-coplanar rule: an applied box whose back would lie within 1 cm of the wall plane is extended
    // 1 cm into the wall (same front), so its back face never ties with the shell.
    // Back allocator: per face, a box's back takes the first 6 mm step (deeper, front kept) that no overlapping box
    // on the same face already uses — backs near the wall plane start 1.2 cm inside it; others start at their own back.
    const placed=backsOf.get(f)??backsOf.set(f,[]).get(f);
    return {P,ry,rp,L:f.L,box:(u,y,d,w,h,dep,c,kind='facade')=>{const fr=d+dep/2,back0=d-dep/2,wall=back0>-.04&&back0<.01,u0=u-w/2,u1=u+w/2,y0=y-h/2,y1=y+h/2;
      const clash=nb=>placed.some(q=>q[0]<u1&&q[1]>u0&&q[2]<y1&&q[3]>y0&&Math.abs(q[4]-nb)<.0055);
      let nb=wall?-.012:back0;for(let k=0;k<24&&clash(nb);k++)nb=(wall?-.012:back0)-.006*(k+1);
      placed.push([u0,u1,y0,y1,nb]);d=(fr+nb)/2;dep=fr-nb;
      const [x,z]=P(u,d);put(box,x,y,z,w,h,dep,c,ry,kind);},
      panel:(g,u,y,d,w,h,c,kind='facade')=>{const [x,z]=P(u,d);put(g,x,y,z,w,h,1,c,rp,kind);}};};
  const shade=(hex,k)=>{const c=new THREE.Color(hex);c.multiplyScalar(k);return '#'+c.getHexString();};

  // ---- Facades: plinth/base, quoins, string courses, cornice and parapet, openings (layout grid). ----
  let windows=0,doors=0,arches=0;
  // Perf: a face that only looks onto sealed private ground (Casa Blanca garden/yard, closed courts: probe
  // 3 m out at mid-face) is never approached (≥ 30 m from any public route): its windows keep frame and glass, no sills or
  // shutters, and its stone base no loose patches.
  // / fabric hand-over: no flat black openings — glazing reads as muted sky-tinted glass (fabric's afternoon
  // palette, ``) mixed with the style's joinery colour, varied per window;
  // ground-floor windows get a thin iron mullion. San José keeps dark timber (closed church openings).
  const mixHex=(a,b,t)=>{const c=new THREE.Color(a).lerp(new THREE.Color(b),t);return '#'+c.getHexString();};
  const glaze=(st,u,y,id)=>{const h=Math.abs(Math.sin(u*12.9898+y*78.233+id%997))*43758.5453%1;
    return id===n.special.gable?.id?'#4a3a2c':mixHex(mixHex(st.fill,'#8ea3ab',.62),h<.2?'#5d7078':'#d3dee2',h<.2?.35:h*.35);};
  // cornice levels (no-coplanar rule): where two facades' cornices overlap at a corner at the same height, their bottoms (and
  // the upper course tops) step 2 cm apart; greedy over facade order, levels 0–3
  const segmentDistance=(x,z,ax,az,bx,bz)=>{const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l)):0;return Math.hypot(x-ax-dx*t,z-az-dz*t);};
  const corniceLevel=new Map();{const ends=F=>{const f=F.face;return [f.a,[f.a[0]+f.ux*f.L,f.a[1]+f.uz*f.L]];};
    // horizontal planes of a cornice at level l: bottom, course joint, top; a level is taken when one of its planes comes within
    // 1.5 cm of a plane of an overlapping neighbour's cornice (any height difference, e.g. a neighbour 0.44 m higher)
    const planes=(F,l)=>[0,.44,.56].map(h=>F.top+h+.02*l);
    for(const F of n.facades){const e=ends(F),nb=[];
      for(const [G,l] of corniceLevel)if(ends(G).some(q=>segmentDistance(q[0],q[1],...e[0],...e[1])<.5)||e.some(q=>segmentDistance(q[0],q[1],...ends(G)[0],...ends(G)[1])<.5))nb.push(planes(G,l));
      let l=0;while(l<6&&nb.some(ps=>ps.some(p=>planes(F,l).some(q=>Math.abs(p-q)<.015))))l++;corniceLevel.set(F,l<6?l:0);}}
  for(const F of n.facades){const f=F.face,st=F.style,X=frame(f),L=f.L,priv=n.offLimitsAt(...X.P(L/2,3));
    // Steep street faces (Calle del Hospital −260,−123): one grade-following plinth band (sampled every metre,
    // muted towards the wall tone) that drops to a stone threshold at each door, instead of stepped dark level boxes.
    const steep=!st.stone&&f.hi-f.lo>.6;
    // no base band or plinth crosses a door — every span is partitioned at the door's full trim footprint
    // (as the special portals and fabric do); the leaf stands in its frame with nothing in front of it.
    const TRIMW={door:.4,archdoor:.5,arcade:.36},doorsU=F.openings.filter(o=>o.kind==='door'||o.kind==='archdoor'||o.kind==='arcade'&&o.storey===0)
      .map(o=>[o.u-(o.w+TRIMW[o.kind])/2,o.u+(o.w+TRIMW[o.kind])/2]);
    const cutDoors=(u0,u1)=>{let segs=[[u0,u1]];for(const [a,b] of doorsU)segs=segs.flatMap(([c,d])=>b<=c||a>=d?[[c,d]]:[[c,Math.min(a,d)],[Math.max(b,c),d]]);return segs.filter(([c,d])=>d-c>.05);};
    if(steep){
      // pieces ≤ 2 m (the DEM step) split at the door edges, each a sloped instanced box (the part-box pool every view
      // already draws: no new draw); ends on the ground sampled at the face foot
      // under a window the band also stops below the sill (it crossed low ground-floor windows: shutter and line behind it)
      const winsU=F.openings.filter(o=>o.kind==='win'||o.kind==='arch').map(o=>[o.u-(o.w+.45)/2,o.u+(o.w+.45)/2,(o.kind==='arch'?o.y0-.17:o.y0-.2)-.05-.02]);
      const us=new Set([0,L]);for(let u=2;u<L;u+=2)us.add(u);for(const [a,b] of [...doorsU,...winsU])for(const v of [a,b])if(v>.05&&v<L-.05)us.add(v);
      const U=[...us].sort((a,b)=>a-b),inDoor=u=>doorsU.some(([a,b])=>u>a&&u<b),g=u=>height(...X.P(u,.15)),band=mixHex(st.plinth,st.wall,.35);
      for(let i=0;i+1<U.length;i++){const a=U[i],b=U[i+1];if(b-a<.05||inDoor((a+b)/2))continue;const door=false,ga=g(a),gb=g(b),m=(a+b)/2;
        const cap=Math.min(Infinity,...winsU.filter(([c,d])=>m>c&&m<d).map(q=>q[2]-Math.max(ga,gb)));const H=Math.min(st.plinthH,cap);if(H<.03)continue;
        // a sheared span between the vertical station planes u=a and u=b (a pitched box overhangs its stations and met the
        // piece two along on one plane: Dominican complex): one instance of the part-box pool (no new draw) whose matrix shears
        // the unit box — local x runs a→b with the grade, y is vertical (ground −0.3 … ground + H at each end), z is the depth
        // from the buried back (−.035) to the front; alternate pieces 2 cm proud
        const df=.125+(i%2)*.02,dm=(df-.035)/2,[xa,za]=X.P(a,dm),[xb,zb]=X.P(b,dm),hh=H+.3;
        putM(box,[xb-xa,gb-ga,zb-za,0, 0,hh,0,0, f.n[0]*(df+.035),0,f.n[1]*(df+.035),0, (xa+xb)/2,(ga+gb)/2-.3+hh/2,(za+zb)/2,1],door?'#cfc6b3':band,'solid',[(xa+xb)/2,(za+zb)/2]);}}
    else for(const p of F.plinths)for(const [u0,u1] of cutDoors(p.u0-.01,p.u1+.01))X.box((u0+u1)/2,(p.y0+p.y1)/2,.045,u1-u0,p.y1-p.y0,.11,st.plinth);
    // Casa Blanca: a rough battered retaining base — a deeper lower batter, irregular stone patches in a merged
    // palette, broken coursing; the white wall starts at an uneven line.
    if(st.stone&&!priv){let seed=F.id%9973+f.i*31;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);const laid=[];
      for(const p of F.plinths){const H=p.y1-p.y0,w=p.u1-p.u0,uc=(p.u0+p.u1)/2;if(H<.8)continue;
        X.box(uc,p.y0+H*.22+.015,.17,w+.06,H*.44-.03,.34,shade(st.plinth,.9));X.box(uc,p.y0+H*.47,.13,w+.1,.12,.26,shade(st.plinth,.8));  // ends 2/4 cm past the plinth box ends
        // no-coplanar rule: proud stones never overlap one another on the same face (overlapping draws are skipped)
        for(let k=0;k<Math.min(10,Math.ceil(w*H/1.6));k++){const bw=.5+rnd()*1.1,bh=.3+rnd()*.35,u=p.u0+bw/2+rnd()*Math.max(.01,w-bw),y=p.y0+.4+rnd()*(H-.8),c=shade(st.plinth,.78+rnd()*.3);
          if(laid.some(q=>Math.abs(q[0]-u)<(q[2]+bw)/2+.03&&Math.abs(q[1]-y)<(q[3]+bh)/2+.03))continue;laid.push([u,y,bw,bh]);
          X.box(u,y,y<p.y0+H*.44?.35:.11,bw,bh,.03,c);}
        X.box(uc+(rnd()-.5)*w*.3,p.y1-.08-rnd()*.25,.12,w*(.4+rnd()*.5),.16,.06,shade(st.plinth,1.05));}}
    if(st.quoins&&L>6)for(const u of [.32,L-.32])for(let y=F.base0-.2,k=0;y<F.top-.3;y+=.62,k++)X.box(u+(u<1?1:-1)*(k%2?.12:0),y+.27,.085,k%2?.88:.64,.52,.06,st.trim);
    for(let k=1;k<F.storeys;k++)X.box(L/2,F.base0+k*F.fh,.06,L,.18,.14,st.trim);
    if(F.role!=='front'||F.id!==n.special.gable?.id){
      const lv=.02*(corniceLevel.get(F)??0);X.box(L/2,F.top+.22+lv,.12,L+.24,.44,.3,st.trim);X.box(L/2,F.top+.5+lv,.17,L+.3,.12,.42,st.trim);
      if(st.parapet>0)X.box(L/2,F.roof+st.parapet/2-.01,-.14,L+.02,st.parapet+.02,.24,st.wall);}
    // sill tops never level (± 2 cm) with a plinth top on the same face (no-coplanar rule)
    const sillY=y=>F.plinths.some(q=>Math.abs(q.y1-(y+.05))<.02)?y+.035:y;
    for(const o of F.openings){const h=o.y1-o.y0,yc=(o.y0+o.y1)/2,s=o.shell??0,s0=o.shellMin??0;
      // trim: front s+.07, back down to the least shell under it (no slit behind it on a face at an angle to its shell)
      const trimBox=(u,y,w,hh)=>X.box(u,y,(s+.07+s0-.012)/2,w,hh,s+.07-(s0-.012),st.trim);
      if(o.kind==='win'){trimBox(o.u,yc,o.w+.3,h+.3);
        // Closed shutters (perf): one leaf-pair panel over the opening with the dark meeting line (it hid the glass box anyway).
        // shutters s+.115 (meeting line 1 cm on them), glazing s+.09 (mullion s+.121), sill s+.165 — all ≥ 2 cm off the trim s+.07
        if(st.shutter&&!priv){X.box(o.u,yc,s+.1,o.w,h,.03,st.shutter);X.box(o.u,yc,s+.12,.035,h-.04,.01,DOOR_LINE);}
        else{X.box(o.u,yc,s+.065,o.w,h,.05,glaze(st,o.u,yc,F.id));if(o.storey===0&&!priv&&F.id!==n.special.gable?.id)X.box(o.u,yc,s+.115,.035,h,.012,IRON);}
        if(!priv)X.box(o.u,sillY(o.y0-.2),s+.08,o.w+.45,.1,.17,st.trim);windows++;}
      else if(o.kind==='arch'){X.panel(arch,o.u,o.y0-.12,s+.045,o.w+.3,(h+.2)/1.1,st.trim);X.panel(arch,o.u,o.y0,s+.075,o.w,h/1.1,glaze(st,o.u,o.y0,F.id));X.box(o.u,sillY(o.y0-.17),s+.08,o.w+.45,.1,.17,st.trim);arches++;}
      else if(o.kind==='arcade'){X.panel(arch,o.u,o.y0,s+.045,o.w+.36,(h+.16)/1.1,st.trim);X.panel(arch,o.u,o.y0,s+.075,o.w,h/1.1,ARCH_DARK);
        if(o.storey>0)X.box(o.u,o.y0-.5,s+.11,o.w+.1,.9,.18,st.trim);arches++;}
      // doors: trim front s+.07, leaf front s+.095 (2.5 cm proud of the trim, nothing in front of it: the band/plinth stop at the
      // trim), meeting line 1 cm on the leaf
      else if(o.kind==='archdoor'){trimBox(o.u,o.y0+(h-o.w/2)/2-.05,o.w+.5,h-o.w/2+.1);X.panel(arch,o.u,o.y0,s+.095,o.w,h/1.1,DOOR);X.panel(arch,o.u,o.y0-.05,s+.05,o.w+.5,(h+.3)/1.1,st.trim);
        X.box(o.u,o.y0+(h-o.w/2)/2,s+.1,.04,h-o.w/2,.01,DOOR_LINE);doors++;}
      else if(o.kind==='door'){trimBox(o.u,yc+.035,o.w+.4,h+.17);X.box(o.u,yc,s+.07,o.w,h,.05,DOOR);X.box(o.u,yc,s+.1,.04,h-.05,.01,DOOR_LINE);
        X.box(o.u,o.y1+.22,s+.08,o.w+.65,.14,.16,st.trim);doors++;}}}
  stats.windows=windows;stats.doors=doors;stats.arches=arches;

  // ---- Portals: frontispiece 0.3 m proud (layout solid), pilasters, entablature, closed dark double leaves under an arch. ----
  const S=n.constants.STYLE;
  for(const p of n.special.portals){const st=S[p.id],X=frame(p.face),[dw,dh]=p.door,wall=p.church?'#f6f4ee':shade(st.wall,1.06);
    X.box(p.u,(p.lo-.3+p.top)/2,.15,p.w,p.top-p.lo+.3,.3,wall,'solid');
    // the plinth stops at the outer frame/arch edges (two pieces), as at
    // the Aduana; nothing of it lies behind or across the opening.
    {const hw=(p.fan?dw+.5:p.reveal?dw+1.6:dw+.6)/2,left=p.u-(p.w+.1)/2,right=p.u+(p.w+.1)/2;
      for(const [u0,u1] of [[left,p.u-hw],[p.u+hw,right]])if(u1-u0>.05)X.box((u0+u1)/2,(p.lo-.33+p.lo+.7)/2,.33,u1-u0,1.03,.08,st.plinth);}
    for(const sd of [-1,1])X.box(p.u+sd*(p.w/2-.35),(p.lo+.7+p.top-.9)/2,.34,.55,p.top-p.lo-1.6,.1,st.trim);
    X.box(p.u,p.top-.55,.36,p.w+.2,.5,.16,st.trim);X.box(p.u,p.top-.12,.38,p.w+.4,.18,.2,st.trim);
    const y0=p.lo-.03;
    if(p.fan){X.box(p.u,y0+dh/2,.34,dw+.5,dh+.1,.06,st.trim);X.box(p.u,y0+dh/2,.38,dw,dh,.04,DOOR);X.box(p.u,y0+dh/2,.405,.04,dh,.01,DOOR_LINE);
      X.panel(fan,p.u,y0+dh+.05,.34,dw/2+.25,dw/2+.25,st.trim);X.panel(fan,p.u,y0+dh+.05,.36,dw/2,dw/2,'#3f6e4f');
      // Raised centre crest over the cornice (Ligocsicnarf89 2025): a stepped panel with a small pediment.
      const [x,z]=X.P(p.u,.13);put(box,x,p.top+.53,z,2.4,1.1,.26,st.wall,X.ry,'solid');put(box,x,p.top+1.15,z,2.7,.14,.36,st.trim,X.ry,'solid');}
    else if(p.reveal){// Bjoertvedt 2016: stone-framed portal, deep reveal, smaller closed leaves.
      const sw=dw+1.6,sh=dh+1.0;X.box(p.u,(y0+y0+sh-sw/2)/2,.33,sw,sh-sw/2,.06,'#cdbb9a');X.panel(arch,p.u,y0,.38,sw,(sh+.1)/1.1,'#cdbb9a');
      // layers ≥ 2 cm apart (no-coplanar rule): frame .36, outer arch .38, reveal .40, leaves .42, meeting line .435, side stones .40
      X.panel(arch,p.u,y0,.40,dw+.5,(dh+.3)/1.1,'#3a332c');X.panel(arch,p.u,y0,.42,dw,dh/1.1,'#4a3a2c');X.box(p.u,y0+(dh-dw/2)/2,.425,.04,dh-dw/2,.01,DOOR_LINE);
      for(const sd of [-1,1])for(let k=0;k<5;k++)X.box(p.u+sd*(sw/2+.15),y0+.35+k*.75,.37,.5,.55,.06,'#c4b190');}
    else{X.panel(arch,p.u,y0,.32,dw+.6,(dh+.35)/1.1,st.trim);X.panel(arch,p.u,y0,.345,dw,dh/1.1,DOOR);X.box(p.u,y0+(dh-dw/2)/2,.35,.04,dh-dw/2,.01,DOOR_LINE);}
    if(p.church){// oculus over the door (Mariordo 2019 shows a spare front): dark round window in a pale ring.
      // the whole circle between the arch top (y0+dh+.35) and the entablature's underside (p.top−.8), 6 cm clear of each;
      // radius 0.62 where it fits (pupil 0.45/0.62 of it), pupil 30 mm in front of the ring
      const lo2=y0+dh+.35+.06,hi2=p.top-.8-.06,r=Math.max(.3,Math.min(.62,(hi2-lo2)/2)),cy=(lo2+hi2)/2;
      const [x,z]=X.P(p.u,.32);put(cylinder,x,cy,z,r,.04,r,'#d8d3c6',X.rp+Math.PI/2,'solid',Math.PI/2);
      const [x2,z2]=X.P(p.u,.35);put(cylinder,x2,cy,z2,r*.45/.62,.04,r*.45/.62,'#2d2a27',X.rp+Math.PI/2,'solid',Math.PI/2);}}
  // ---- Asilo frontispiece: projecting centre, three broad arches below, paired pilasters above, low pediment. ----
  for(const p of n.special.pediments){const st=S[p.id],X=frame(p.face),R=n.facades.find(F=>F.face===p.face).roof,proud=p.proud;
    X.box(p.u,(p.lo-.3+R-.025)/2,proud/2,p.w,R-.025-p.lo+.3,proud,st.wall,'solid');  // top 2.5 cm under the roof plane (no tie with the shell)
    // Low base band between the three arches (the arched doors themselves reach the ground: no sill off the ground).
    for(let u=-p.w/2;u<p.w/2-.01;u+=p.w/3){const c=p.u+u+p.w/6,hw=(3.0+.7)/2;  // the band stops at each arched door's trim
      for(const [u0,u1] of [[c-p.w/6,c-hw],[c+hw,c+p.w/6]])if(u1-u0>.05)X.box((u0+u1)/2,(p.lo-.3+p.hi+.35)/2,proud+.035,u1-u0,p.hi+.35-p.lo+.3,.07,st.plinth);}
    const mid=p.hi+.8+(R-.8-p.hi-.8)/2;X.box(p.u,mid,proud+.05,p.w+.2,.2,.14,st.trim);
    // Hughes 2009: a white framed two-tier composition — full-height white piers between the three axial bays,
    // a white arcade frame round the three closed arched doors, paired upper pilasters round arched lights.
    for(const k of [-1.5,-.5,.5,1.5]){const u=p.u+k*p.w/3;X.box(u,(p.lo-.3+R-.7)/2,proud+.07,.9,R-.7-p.lo+.3,.14,st.trim);}
    for(const k of [-1,0,1]){const u=p.u+k*p.w/3,aw=3.0,g0=Math.min(...[-aw/2-.2,0,aw/2+.2].map(t=>{const [x,z]=X.P(u+t,proud+.1);return height(x,z);}))-.03,ah=Math.min(4.6,mid-g0-.35);
      X.panel(arch,u,g0,proud+.08,aw+.7,(ah+.35)/1.1,st.trim);X.panel(arch,u,g0,proud+.1,aw,ah/1.1,'#24493a');X.box(u,g0+(ah-aw/2)/2,proud+.105,.04,ah-aw/2,.01,DOOR_LINE);
      X.box(u,g0+ah*.62,proud+.12,aw+.1,.12,.04,st.trim);
      const lh=Math.min(2.6,R-mid-1.5),ly=mid+.55;X.panel(arch,u,ly-.1,proud+.08,1.75,(lh+.25)/1.1,st.trim);X.panel(arch,u,ly,proud+.1,1.3,lh/1.1,glaze(st,u,ly,p.id));
      X.box(u,ly-.2,proud+.12,1.9,.12,.18,st.trim);}
    for(const k of [-1,0,1])for(const sd of [-1,1])X.box(p.u+k*p.w/3+sd*1.25,(mid+R-.7)/2,proud+.12,.32,R-.7-mid,.12,st.trim);
    X.box(p.u,R-.35,proud+.08,p.w+.4,.7,.2,st.trim);
    // Low pediment: triangle prism over the frontispiece, white raking coping.
    {const a=X.P(p.u-p.w/2-.2,proud+.1),b=X.P(p.u+p.w/2+.2,proud+.1),c=X.P(p.u,proud+.1),a2=X.P(p.u-p.w/2-.2,-.4),b2=X.P(p.u+p.w/2+.2,-.4),c2=X.P(p.u,-.4),y=R,t=R+p.rise;
      tris([[[a[0],y,a[1]],[b[0],y,b[1]],[c[0],t,c[1]]].reverse(),[[a2[0],y,a2[1]],[c2[0],t,c2[1]],[b2[0],y,b2[1]]].reverse(),
        [[a[0],y,a[1]],[c[0],t,c[1]],[c2[0],t,c2[1]]],[[a[0],y,a[1]],[c2[0],t,c2[1]],[a2[0],y,a2[1]]],[[b[0],y,b[1]],[b2[0],y,b2[1]],[c2[0],t,c2[1]]],[[b[0],y,b[1]],[c2[0],t,c2[1]],[c[0],t,c[1]]]].map(t=>t),st.wall,'cast',true);
      bar([a[0],y+.06,a[1]],[c[0],t+.06,c[1]],.6,.16,st.trim);bar([c[0],t+.06,c[1]],[b[0],y+.06,b[1]],.6,.16,st.trim);}}  // bottoms 2 cm into the slope
  // ---- Escuela portico (Wikimedia Commons curid=126751363): four white columns, entablature, pediment, door; red dome with lantern behind. ----
  for(const p of n.special.porticos){const st=S[p.id],X=frame(p.face),top=p.top,eb=top-1.4;
    for(const c of p.cols){const [x,z]=X.P(p.u+c,p.out),g=p.colBase;put(box,x,g-.05+.18,z,.95,.46,.95,st.trim,X.ry,'solid');
      put(cylinder,x,(g+.4+eb)/2,z,.36,eb-g-.4,.36,st.trim,0,'solid');put(box,x,eb-.14,z,.9,.28,.9,st.trim,X.ry,'solid');}
    X.box(p.u,eb+.4,(p.out+.55)/2+.02,p.w+.5,.8,p.out+.55,st.trim,'solid');X.box(p.u,top-.5,(p.out+.7)/2+.02,p.w+.8,.2,p.out+.7,st.trim,'solid');
    {const d=p.out+.4,a=X.P(p.u-p.w/2-.4,d),b=X.P(p.u+p.w/2+.4,d),c=X.P(p.u,d),a2=X.P(p.u-p.w/2-.4,.05),b2=X.P(p.u+p.w/2+.4,.05),c2=X.P(p.u,.05),y=top-.4,t=y+1.25;
      tris([[[a[0],y,a[1]],[c[0],t,c[1]],[b[0],y,b[1]]],[[a[0],y,a[1]],[c[0],t,c[1]],[c2[0],t,c2[1]]],[[a[0],y,a[1]],[c2[0],t,c2[1]],[a2[0],y,a2[1]]],
        [[b[0],y,b[1]],[b2[0],y,b2[1]],[c2[0],t,c2[1]]],[[b[0],y,b[1]],[c2[0],t,c2[1]],[c[0],t,c[1]]]],st.wall,'cast',true);
      bar([a[0],y+.08,a[1]],[c[0],t+.08,c[1]],.5,.2,st.trim);bar([c[0],t+.08,c[1]],[b[0],y+.08,b[1]],.5,.2,st.trim);}  // bottoms 2 cm into the slope
    X.panel(arch,p.u,p.lo-.03,.36,2.6,4.6/1.1,st.trim);X.panel(arch,p.u,p.lo-.03,.39,2.0,4.3/1.1,'#3a5f63');
    for(const sd of [-1,1]){X.box(p.u+sd*2.6,p.lo+1.4,.37,1.1,2.4,.04,st.trim);X.box(p.u+sd*2.6,p.lo+1.4,.4,.8,2.1,.03,glaze(st,p.u+sd,p.lo,p.id));}}
  // Wikimedia Commons curid=126751363: the dome reads first — a tall yellow drum with white bands and small round openings, the terracotta
  // dome and its white lantern, standing right behind the portico.
  for(const d of n.special.domes){const H=d.drum??1.8;put(cylinder,d.x,d.y+H/2-.02,d.z,d.r,H,d.r,'#e2b84c',0,'cast');
    for(const yy of [.15,H-.05])put(cylinder,d.x,d.y+yy,d.z,d.r+.15,.2,d.r+.15,'#f6f3ea',0,'solid');
    for(let k=0;k<8;k++){const a=k*Math.PI/4;put(cylinder,d.x+Math.sin(a)*(d.r+.02),d.y+H*.55,d.z+Math.cos(a)*(d.r+.02),.32,.05,.32,'#2f6a63',a,'solid',Math.PI/2);}
    put(sphere,d.x,d.y+H,d.z,d.r-.05,d.r*.85,d.r-.05,'#b5533d',0,'cast');put(cylinder,d.x,d.y+H+d.r*.85+.4,d.z,.55,1.0,.55,'#f6f3ea',0,'solid');
    put(sphere,d.x,d.y+H+d.r*.85+.95,d.z,.6,.45,.6,'#b5533d',0,'solid');put(cylinder,d.x,d.y+H+d.r*.85+1.5,d.z,.06,.5,.06,'#d9d6cf',0,'solid');}
  // ---- San José: nave roof, front gable, bell gable (espadaña) with two arched openings. ----
  if(n.special.gable){const gb=n.special.gable,f=gb.face,X=frame(f),L=gb.u1,R=gb.roof,R0=gb.base,top=R+gb.rise,D=gb.depth,roof='#9c6a52',wall='#f1eee5';
    const P=(u,d,y)=>{const [x,z]=X.P(u,d);return [x,y,z];};
    // Nave block over the mapped shell (stepped masses): four white walls from the shell roof to the nave top.
    tris([[P(0,0,R0-.05),P(L,0,R0-.05),P(L,0,R)],[P(0,0,R0-.05),P(L,0,R),P(0,0,R)],[P(0,-D,R0-.05),P(L,-D,R),P(L,-D,R0-.05)],[P(0,-D,R0-.05),P(0,-D,R),P(L,-D,R)],
      [P(0,0,R0-.05),P(0,-D,R),P(0,-D,R0-.05)],[P(0,0,R0-.05),P(0,0,R),P(0,-D,R)],[P(L,0,R0-.05),P(L,-D,R0-.05),P(L,-D,R)],[P(L,0,R0-.05),P(L,-D,R),P(L,0,R)]],wall,'cast',true);
    {const side=frame({a:X.P(L,0),b:X.P(L,-D),L:D,ux:-f.n[0],uz:-f.n[1],n:[f.ux,f.uz]});
      for(let u=3;u<D-2;u+=5.5){side.box(u,R0+(R-R0)*.55,.035,1.05,1.05,.07,'#e0dbcd');side.box(u,R0+(R-R0)*.55,.065,.75,.75,.05,'#4a3a2c');}
      side.box(D/2,R-.25,.1,D+.2,.4,.26,'#e0dbcd');}
    X.box(L/2,R0+.06,.08,L+.1,.12,.18,'#e0dbcd');
    tris([upTri(P(-.4,.4,R-.05),P(L/2,.4,top),P(L/2,-D,top)),upTri(P(-.4,.4,R-.05),P(L/2,-D,top),P(-.4,-D,R-.05)),
      upTri(P(L+.4,.4,R-.05),P(L/2,-D,top),P(L/2,.4,top)),upTri(P(L+.4,.4,R-.05),P(L+.4,-D,R-.05),P(L/2,-D,top))],roof,'cast',true);
    tris([[P(0,.06,R),P(L,.06,R),P(L/2,.06,top-.08)],[P(0,-D+.4,R),P(L/2,-D+.4,top-.08),P(L,-D+.4,R)]],wall,'cast',true);
    bar(P(-.2,.2,R+.05),P(L/2,.2,top+.12),.5,.2,'#e0dbcd');bar(P(L/2,.2,top+.12),P(L+.2,.2,R+.05),.5,.2,'#e0dbcd');
    X.box(L/2,R-.28,.1,L+.2,.5,.26,'#e0dbcd');
    const bf=n.special.belfry,u=bf.u,y0=top-.5,[bx,bz]=X.P(u,-.3);put(box,bx,y0+bf.h/2,bz,bf.w,bf.h,.7,wall,X.ry,'solid');
    for(const sd of [-1,1]){X.panel(arch,u+sd*.85,y0+1.1,.06,.9,1.7/1.1,'#4b4640');
      const [x,z]=X.P(u+sd*.85,-.3);put(sphere,x,y0+1.9,z,.26,.3,.26,'#5c4b2e',0,'solid');}
    // back openings (the slab is seen from the plaza side too)
    {const b=frame({...f,n:[-f.n[0],-f.n[1]],a:f.b,b:f.a,ux:-f.ux,uz:-f.uz});for(const sd of [-1,1])b.panel(arch,f.L-u+sd*.85,y0+1.1,.66,.9,1.7/1.1,'#4b4640');}
    put(box,bx,y0+bf.h+.1,bz,bf.w+.3,.2,.9,'#e0dbcd',X.ry,'solid');put(box,bx,y0+bf.h+.75,bz,.12,1.1,.12,IRON,X.ry,'solid');put(box,bx,y0+bf.h+.95,bz,.55,.1,.12,IRON,X.ry,'solid');}
  // ---- Balconies: timber (Casa Blanca) or dark iron (Casals): deck, brackets, posts or balusters, top rail. ----
  for(const b of n.special.balconies){const X=frame(b.face),c=b.iron?IRON:'#4a3426',L=b.u1-b.u0,u=(b.u0+b.u1)/2;
    X.box(u,b.y-.07,b.depth/2+.02,L,.14,b.depth,b.iron?'#3c3f3d':'#5a4330','solid');
    for(let t=b.u0+.3;t<b.u1;t+=1.6)X.box(t,b.y-.35,b.depth/2,.1,.42,b.depth-.05,c,'solid');
    X.box(u,b.y+1.0,b.depth-.03,L,.07,.07,c,'solid');X.box(u,b.y+.12,b.depth-.03,L,.05,.05,c,'solid');
    for(let t=b.u0;t<=b.u1+1e-6;t+=b.iron?.24:.55)X.box(Math.min(t,b.u1),b.y+.55,b.depth-.03,b.iron?.025:.08,.9,b.iron?.025:.08,c,'solid');
    for(const t of [b.u0,b.u1])X.box(t,b.y+.55,b.depth/2,.06,.9,b.depth,c,'solid');
    if(!b.iron){X.box(u,b.y+2.9,b.depth/2+.15,L+.4,.1,b.depth+.4,'#7b4f3a','solid');for(let t=b.u0+.2;t<b.u1;t+=2.4)X.box(t,b.y+1.45,b.depth-.05,.1,2.85,.1,'#4a3426','solid');}}
  // ---- Buttresses (Contrafuertes): stepped masonry piers. ----
  for(const b of n.special.buttresses){const X=frame(b.face),st=S[n.facades.find(F=>F.face===b.face).id],mid=b.lo+(b.top-b.lo)*.55;
    X.box(b.u,(b.lo-.3+mid)/2,b.depth/2,b.w,mid-b.lo+.3,b.depth,shade(st.wall,.95),'solid');X.box(b.u,(mid+b.top)/2,.24,b.w*.86,b.top-mid,.48,shade(st.wall,.95),'solid');
    X.box(b.u,mid+.05,b.depth/2+.03,b.w+.08,.14,b.depth+.06,st.trim,'solid');/* band bottom 2 cm under the upper pier's foot */X.box(b.u,b.top+.06,.26,b.w,.12,.52,st.trim,'solid');}

  // ---- Escuela court fence (Wikimedia Commons curid=126751363): ochre piers with white caps, reddish base wall, black iron bars. ----
  {const {height:H,pier}=n.constants.FENCE;let bars=0;const pierSeen=new Set();
    for(const s of n.fence){const piers=[[s.p,s.g0],[s.q,s.g1]].filter(([p])=>{const k=p[0].toFixed(2)+','+p[1].toFixed(2);if(pierSeen.has(k))return false;pierSeen.add(k);return true;});
      for(const [p,g] of piers)put(box,p[0],(g-.3+g+H)/2,p[1],pier,H+.3,pier,'#e2b84c',Math.atan2(-(s.q[1]-s.p[1]),s.q[0]-s.p[0]),'solid');
      for(const [p,g] of piers){put(box,p[0],g+H+.08,p[1],pier+.1,.16,pier+.1,'#f6f3ea',Math.atan2(-(s.q[1]-s.p[1]),s.q[0]-s.p[0]),'solid');put(sphere,p[0],g+H+.32,p[1],.18,.2,.18,'#f6f3ea',0,'solid');}
      const L=Math.hypot(s.q[0]-s.p[0],s.q[1]-s.p[1]),ux=(s.q[0]-s.p[0])/L,uz=(s.q[1]-s.p[1])/L,o=pier/2,A=[s.p[0]+ux*o,s.p[1]+uz*o],B=[s.q[0]-ux*o,s.q[1]-uz*o],gA=s.g0+(s.g1-s.g0)*o/L,gB=s.g1-(s.g1-s.g0)*o/L;
      bar([A[0],gA+.1,A[1]],[B[0],gB+.1,B[1]],.34,.9,'#b9735a');
      bar([A[0],gA+.58,A[1]],[B[0],gB+.58,B[1]],.06,.05,IRON);bar([A[0],gA+1.55,A[1]],[B[0],gB+1.55,B[1]],.06,.05,IRON);
      for(let t=.12;t<L-pier;t+=.2){const x=A[0]+ux*t,z=A[1]+uz*t,g=gA+(gB-gA)*t/(L-pier);put(box,x,g+1.08,z,.03,1.0,.03,IRON,0,'solid');bars++;}}
    stats.fenceBars=bars;}
  // ---- Gates: pale piers with caps, closed dark iron double leaves. ----
  for(const g of n.gates){if(g.skipped)continue;
    for(const p of g.piers){put(box,p.x,p.y+1.15,p.z,.84,2.9,.84,'#d9d2c2',Math.atan2(-g.uz,g.ux),'solid');put(box,p.x,p.y+2.65,p.z,1.0,.16,1.0,'#ece6d8',Math.atan2(-g.uz,g.ux),'solid');}
    if(g.open)continue;
    const A=[g.x-g.ux*g.half,g.z-g.uz*g.half],B=[g.x+g.ux*g.half,g.z+g.uz*g.half],ga=height(...A),gb=height(...B),gc=g.y;
    for(const yy of [.15,1.05,2.0])bar([A[0],ga+yy,A[1]],[B[0],gb+yy,B[1]],.06,.07,IRON);
    const L=2*g.half;for(let t=.1;t<L;t+=.17){const x=A[0]+g.ux*t,z=A[1]+g.uz*t,y=ga+(gb-ga)*t/L;put(box,x,y+1.1,z,.03,2.05,.03,IRON,0,'solid');}
    put(box,g.x,gc+1.1,g.z,.06,2.1,.06,IRON,0,'solid');}

  // ---- Ponce de León (P. Hughes 2018): warm steps, pale panelled plinth, bronze figure with an extended right arm. ----
  {const s=n.statue,{x,z}=s;put(box,x,(s.lo-.15+s.step1)/2,z,3.0,s.step1-s.lo+.15,3.0,'#b39a7e',0,'solid');put(box,x,(s.lo-.18+s.step2)/2,z,2.4,s.step2-s.lo+.18,2.4,'#bfa688',0,'solid');
    const pt=s.plinthTop;put(box,x,(s.step2+pt-.35)/2,z,1.8,pt-.35-s.step2,1.8,'#e2dccd',0,'solid');put(box,x,s.step2+.12,z,2.0,.24,2.0,'#d6cfbe',0,'solid');
    for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])put(box,x+Math.sin(a)*.91,(s.step2+pt)/2-.1,z+Math.cos(a)*.91,1.2,(pt-s.step2)*.55,.04,'#cfc7b5',a,'facade');
    put(box,x,pt-.2,z,2.0,.3,2.0,'#d6cfbe',0,'solid');put(box,x,pt+.02,z,1.6,.14,1.6,'#e2dccd',0,'solid');
    // P. Hughes 2018: moulded pale pedestal with inscribed panels; the figure in breeches and boots, a cape to the
    // knees, left hand on the hip, the right arm raised and bent forward, plumed hat. Local +Z is the front.
    put(box,x,s.step2+.42,z,1.95,.16,1.95,'#d8d1c0',0,'solid');put(box,x,pt-.5,z,1.95,.14,1.95,'#d8d1c0',0,'solid');
    for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])put(box,x+Math.sin(a)*.925,(s.step2+pt)/2-.05,z+Math.cos(a)*.925,.9,(pt-s.step2)*.42,.03,'#b9b09c',a,'facade');
    // attachment rule: feet sink 2 cm into the plinth cap; a neck overlaps shoulders and head
    const y=pt+.07,h=s.heading,c=Math.cos(h),sn=Math.sin(h),P=(u,vv,d)=>[x+c*u+sn*d,y+vv,z-sn*u+c*d];
    for(const sd of [-1,1]){kit.seg(P(sd*.14,0,.02),P(sd*.13,.5,0),.095,BRONZE);kit.seg(P(sd*.13,.5,0),P(sd*.12,.98,0),.11,BRONZE);}
    put(box,...P(0,1.06,0),.46,.3,.3,BRONZE,h,'solid');kit.seg(P(0,1.1,0),P(0,1.66,.02),.21,BRONZE);put(box,...P(0,1.56,0),.62,.2,.34,BRONZE,h,'solid');
    // cape: from the shoulders to the knees, flaring behind.
    bar(P(0,1.62,-.16),P(0,.62,-.3),.66,.1,BRONZE);
    kit.seg(P(0,1.6,0),P(0,1.8,.01),.075,BRONZE);put(sphere,...P(0,1.86,.02),.14,.17,.15,BRONZE,h,'solid');put(cylinder,...P(0,1.99,0),.26,.05,.26,BRONZE,0,'solid');put(cylinder,...P(0,2.07,0),.13,.13,.13,BRONZE,0,'solid');
    put(sphere,...P(-.12,2.14,-.05),.09,.16,.07,BRONZE,h,'solid');
    kit.seg(P(.25,1.6,0),P(.42,1.42,.28),.06,BRONZE);kit.seg(P(.42,1.42,.28),P(.5,1.86,.52),.055,BRONZE);put(sphere,...P(.5,1.9,.54),.06,.07,.06,BRONZE,0,'solid');
    kit.seg(P(-.25,1.6,0),P(-.42,1.3,.02),.06,BRONZE);kit.seg(P(-.42,1.3,.02),P(-.2,1.12,.08),.055,BRONZE);}

  // ---- Plaza de Ballajá basin: stone rim on the mapped ring, water, small jet. ----
  {const b=n.basin,r=b.ring,cx=r.reduce((s,p)=>s+p[0]/r.length,0),cz=r.reduce((s,p)=>s+p[1]/r.length,0);
    // Rim inset by its half width so its outer face is the solid's ring (it overhung by 18 cm).
    const In=p=>{const dx=cx-p[0],dz=cz-p[1],l=Math.hypot(dx,dz);return [p[0]+dx/l*.25,p[1]+dz/l*.25];};
    for(let i=0;i<r.length;i++){const a=In(r[i]),c=In(r[(i+1)%r.length]);bar([a[0],(b.lo-.2+b.top)/2,a[1]],[c[0],(b.lo-.2+b.top)/2,c[1]],.36,b.top-b.lo+.2,'#cdc4b2');}
    put(box,cx,b.top-.14,cz,3.4,.06,3.4,'#3f7a86',Math.atan2(-(r[1][1]-r[0][1]),r[1][0]-r[0][0]),'solid');put(cylinder,cx,b.top+.2,cz,.25,.8,.25,'#cdc4b2',0,'solid');}
  // ---- Plaza de Ballajá beds (308898111–119): low stone kerbs on the mapped outlines (12 cm: dressing, rideable). ----
  for(const r of n.beds){for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],ga=height(...a),gc=height(...c);
    bar([a[0],ga+.02,a[1]],[c[0],gc+.02,c[1]],.16,.2,'#c9c0ad');}
    // bed interiors read as planted beds, not layout outlines — a dark soil fill just under the kerb top and
    // a low planted cushion, as boxes in the part-box pool (no new draw; dressing, no solid). Square beds only.
    if(r.length===4){const cx=r.reduce((t,p)=>t+p[0]/4,0),cz=r.reduce((t,p)=>t+p[1]/4,0),e=[r[1][0]-r[0][0],r[1][1]-r[0][1]],e2=[r[2][0]-r[1][0],r[2][1]-r[1][1]];
      const L1=Math.hypot(...e),L2=Math.hypot(...e2),ry=Math.atan2(-e[1],e[0]),y=Math.max(...r.map(p=>height(...p)),height(cx,cz));
      put(box,cx,y-.1,cz,L1-.3,.34,L2-.3,'#6b5841',ry,'solid');put(box,cx,y+.14,cz,(L1-.3)*.62,.16,(L2-.3)*.62,'#4f6d3c',ry,'solid');}}
  // ---- Casa Blanca family: shallow overhanging tile eaves (hip-trimmed slopes per face), dark timber fascia. ----
  {const list=[],returns=[];for(const F of n.facades){if(!F.style.eave||F.face.L<3)continue;const f=F.face,X=frame(f),L=f.L,run=Math.min(2.4,L/2-.05),rise=run*.42,R=F.roof;
      const P=(u,d,y)=>{const [x,z]=X.P(u,d);return [x,y,z];},a0=P(-.55,.55,R-.2),b0=P(L+.55,.55,R-.2),a1=P(run,-run,R+rise),b1=P(L-run,-run,R+rise);
      list.push(upTri(a0,b0,b1),upTri(a0,b1,a1));X.box(L/2,R-.28,.6,L+1.1,.18,.08,'#4a3426');
      // (own limit "roof returns"): at a convex corner where the next eave face starts, the hip-trimmed skirts
      // left an open wedge; close it with the return between this face's end hip and the next face's start hip.
      const next=n.facades.find(G=>G!==F&&G.id===F.id&&G.style.eave&&Math.hypot(G.face.a[0]-f.b[0],G.face.a[1]-f.b[1])<.05);
      if(next){const g=next.face,run2=Math.min(2.4,g.L/2-.05),rise2=run2*.42,Y=frame(g),Q=(u,d,y)=>{const [x,z]=Y.P(u,d);return [x,y,z];};
        if(g.ux*f.n[0]+g.uz*f.n[1]<-.2){const a0n=Q(-.55,.55,next.roof-.2),a1n=Q(run2,-run2,next.roof+rise2);returns.push(upTri(b0,b1,a1n),upTri(b0,a1n,a0n));}}}
    // returns: small corner wedges, not casting (no extra shadow-pass triangles)
    tris(list,'#a8553c','cast',true);tris(returns,'#a8553c','solid',true);stats.eaves=list.length/2;stats.eaveReturns=returns.length/2;}

  // ---- Polvorín de Santa Elena (P. Hughes 2022, view-only): enclosure coping, garita, gabled magazine, vents, pillars. ----
  if(n.special.polvorin){const P=n.special.polvorin,{W,mag,top,eave,ridge}=P,wall='#d3cdbd',cap='#e2ddd0',roof='#7d5a45';
    for(const f of P.faces){const X=frame(f);X.box(f.L/2,top+.09,.0,f.L+.4,.18,.5,cap,'solid');}
    const V=(u,v,y)=>{const [x,z]=W(u,v);return [x,y,z];},vm=(mag.v0+mag.v1)/2,{u0,u1,v0,v1}=mag,b=top-.3;
    tris([upTri(V(u0,v0,b),V(u1,v0,b),V(u1,v0,eave)),upTri(V(u0,v0,b),V(u1,v0,eave),V(u0,v0,eave)),upTri(V(u0,v1,b),V(u1,v1,eave),V(u1,v1,b)),upTri(V(u0,v1,b),V(u0,v1,eave),V(u1,v1,eave)),
      [V(u0,v0,b),V(u0,v1,b),V(u0,vm,ridge)],[V(u0,v0,b),V(u0,vm,ridge),V(u0,v1,b)],[V(u1,v0,b),V(u1,vm,ridge),V(u1,v1,b)],[V(u1,v0,b),V(u1,v1,b),V(u1,vm,ridge)]],wall,'cast',true);
    tris([upTri(V(u0-.5,v0-.5,eave-.15),V(u1+.5,v0-.5,eave-.15),V(u1+.5,vm,ridge+.05)),upTri(V(u0-.5,v0-.5,eave-.15),V(u1+.5,vm,ridge+.05),V(u0-.5,vm,ridge+.05)),
      upTri(V(u0-.5,v1+.5,eave-.15),V(u1+.5,vm,ridge+.05),V(u1+.5,v1+.5,eave-.15)),upTri(V(u0-.5,v1+.5,eave-.15),V(u0-.5,vm,ridge+.05),V(u1+.5,vm,ridge+.05))],roof,'cast',true);
    for(const [u,sd] of [[u0,-1],[u1,1]]){const [x,z]=W(u+sd*.06,vm);put(cylinder,x,(eave+ridge)/2-.3,z,.75,.05,.75,'#4b4740',Math.atan2(-P.az,P.ax),'solid',Math.PI/2);}
    for(const [x,z] of P.pillars){const g=top;put(box,x,(g+ridge+3.2)/2,z,.95,ridge+3.2-g,.95,'#cfc8b6',Math.atan2(-P.az,P.ax),'solid');put(box,x,ridge+3.3,z,1.1,.2,1.1,cap,Math.atan2(-P.az,P.ax),'solid');}
    const g=P.garita;put(cylinder,g.x,(g.y-.2+top+.4)/2,g.z,.95,top+.6-g.y,.95,'#ddd7c8',0,'solid');put(sphere,g.x,top+.4,g.z,1.0,.85,1.0,'#ddd7c8',0,'solid');
    put(sphere,g.x,top+1.35,g.z,.16,.22,.16,cap,0,'solid');}
  // ---- Casa Blanca closure walls: whitewashed rendered garden walls on a grey base, pale coping; level-topped
  // pieces stepping with the slope (exactly the layout's solids). ----
  const wallPiers=new Map();let wallIdx=0;
  for(const w of n.walls){const dx=w.q[0]-w.p[0],dz=w.q[1]-w.p[1],L=Math.hypot(dx,dz)+.08,ry=Math.atan2(-dz,dx),x=(w.p[0]+w.q[0])/2,z=(w.p[1]+w.q[1])/2,H=w.top-w.lo;
    // (−408,−165): tone breakup per piece (weathered render) and a darker stone plinth band as the contact cue.
    const tone=['#ebe7dd','#e6e1d5','#efebe2','#e2ddd0'][Math.floor(Math.abs(Math.sin(x*12.9898+z*78.233))*43758.5453)%4];
    // alternate pieces 3 cm thicker (their faces overlap at the joints with a different tone: never on one plane); the base
    // band's buried bottom stands 3 cm above the body's
    const wi=wallIdx++;put(box,x,(w.lo+w.top)/2,z,L,H,.5+(wi%2)*.03,tone,ry,'cast');put(box,x,w.lo+.515,z,L+.016,.97,.56+(wi%2)*.03,'#b9b19f',ry,'solid');put(box,x,w.lo+1.03,z,L+.034,.08,.6+(wi%2)*.03,'#cfc8b8',ry,'solid');put(box,x,w.top+.0675,z,L+.05,.135,.62+(wi%2)*.03,'#d6d0c2',ry,'solid');
    // Piers at every piece end (one per joint, the taller top): they carry the stepped level tops.
    for(const e of [w.p,w.q]){const k=e[0].toFixed(2)+','+e[1].toFixed(2),o=wallPiers.get(k);wallPiers.set(k,{x:e[0],z:e[1],ry:o?.ry??ry,lo:Math.min(o?.lo??Infinity,w.lo),top:Math.max(o?.top??-Infinity,w.top)});}}
  for(const pr of wallPiers.values())put(box,pr.x,(pr.lo-.04+pr.top+.28)/2,pr.z,.5,pr.top+.28-pr.lo+.04,.68,'#e4dfd3',pr.ry,'solid');
  // ---- Recinto Oeste retaining footings (layout `footings`, exactly its solids). the face reads as the
  // weathered rendered masonry of the west wall (Wikimedia Commons curid=82863744 Santa Elena bastion: pale cream-buff render worn through to warm
  // stone in irregular patches, darker damp streaks at the foot, a cordon/coping line; view-only P. Hughes "View of Casa Blanca
  // from below the city walls", CC BY 4.0: pale weathered render, local exposed warm masonry, grass at the toe, a pronounced
  // upper lip). Per piece: render tone variation; 1–3 exposed-masonry patches with staggered short joints; a base course with
  // a thin projecting top edge; a broken damp band above it; a coping with a shadow line at the top; the diagonal end
  // returns (toe 0 at run ends, layout) carry the same vocabulary. All vertex colour in the zone's part batch: no texture, no
  // draw, no shadow (the garden wall behind casts this silhouette).
  {const RENDER=['#ddd6c6','#d6cebd','#e2dbcc','#d1c9b7','#dad2c0'],STONE=['#cbbc9f','#c4b496','#d0c2a6','#bfae91'],JOINT='#ab9c82',BASE=['#a8a090','#9f9786'],
      BASETOP='#bdb5a4',DAMP=['#bfb7a4','#b6ae9b','#c5bdab'],COPE='#e4ded0',SHADOW='#a69f8f';
    const lists=new Map(),L=c=>{if(!lists.has(c))lists.set(c,[]);return lists.get(c);};
    const insideWall=(m,out)=>n.walls.some(w=>{const dx=w.q[0]-w.p[0],dz=w.q[1]-w.p[1],l=Math.hypot(dx,dz)||1,ux=dx/l,uz=dz/l;
      return [.02,.045,.07].some(o=>{const x=m[0]+out[0]*o-(w.p[0]+w.q[0])/2,z=m[1]+out[1]*o-(w.p[1]+w.q[1])/2;return Math.abs(x*ux+z*uz)<l/2+.05&&Math.abs(-x*uz+z*ux)<.31;});});
    // vertical quad a→b (plan points) between per-end heights, wound to face `out`, pushed `off` m along `out`
    const vq=(c,a,b,ya0,yb0,ya1,yb1,out,off=0)=>{const A=[a[0]+out[0]*off,a[1]+out[1]*off],B=[b[0]+out[0]*off,b[1]+out[1]*off];
      const A0=[A[0],ya0,A[1]],B0=[B[0],yb0,B[1]],B1=[B[0],yb1,B[1]],A1=[A[0],ya1,A[1]],nrm=[-(B[1]-A[1]),B[0]-A[0]],flip=nrm[0]*out[0]+nrm[1]*out[1]<0;
      L(c).push(flip?[A0,B1,B0]:[A0,B0,B1]);L(c).push(flip?[A0,A1,B1]:[A0,B1,A1]);};
    const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    // a shallow block standing `d` proud of the face: front, top, bottom and both ends (no floating plates)
    const slab=(c,A,B,Y0,Y1,out,d)=>{vq(c,A,B,Y0,Y0,Y1,Y1,out,d);const A2=[A[0]+out[0]*d,A[1]+out[1]*d],B2=[B[0]+out[0]*d,B[1]+out[1]*d];
      L(c).push(upTri([A[0],Y1,A[1]],[B[0],Y1,B[1]],[B2[0],Y1,B2[1]]),upTri([A[0],Y1,A[1]],[B2[0],Y1,B2[1]],[A2[0],Y1,A2[1]]));
      const dn=t=>[t[0],t[2],t[1]];L(c).push(upTri([A[0],Y0,A[1]],[B2[0],Y0,B2[1]],[B[0],Y0,B[1]]).reverse(),upTri([A[0],Y0,A[1]],[A2[0],Y0,A2[1]],[B2[0],Y0,B2[1]]).reverse());void dn;
      const ax=[B[0]-A[0],B[1]-A[1]],al=Math.hypot(...ax)||1,u=[ax[0]/al,ax[1]/al];vq(c,A,A2,Y0,Y0,Y1,Y1,[-u[0],-u[1]]);vq(c,B,B2,Y0,Y0,Y1,Y1,u);};
    // an end face is drawn only where it shows: a run end, or above a lower neighbour (internal joints are inside the mass)
    const jk=e=>e[0].toFixed(2)+','+e[1].toFixed(2),jt=new Map();for(const f of n.footings)for(const e of [f.p,f.q]){const k=jk(e);if(!jt.has(k))jt.set(k,[]);jt.get(k).push(f.top);}
    const endShows=(e,top)=>{const l=jt.get(jk(e));return l.length<2||l.some(t=>t<top-.01);};
    for(const [fi,f] of n.footings.entries()){const {P,Q,p,q,n:nn,lo,top}=f,T=top-.03;let seed=fi*7919+13;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
      const gP=f.footP-.45,gQ=f.footQ-.45,len=Math.hypot(Q[0]-P[0],Q[1]-P[1]),g=t=>gP+(gQ-gP)*t,render=RENDER[fi%RENDER.length];
      // faces: front (toe line) and the two ends (wall line → toe), each with the same vocabulary
      const ax=[q[0]-p[0],q[1]-p[1]],al=Math.hypot(...ax)||1,u=[ax[0]/al,ax[1]/al];
      const faces=[{a:P,b:Q,out:nn,ga:gP,gb:gQ,len}];
      for(const [w,t,sd,gt] of [[p,P,-1,gP],[q,Q,1,gQ]]){const l2=Math.hypot(t[0]-w[0],t[1]-w[1]);if(l2<.3||!endShows(w,top))continue;
        // end/return face: from the wall line to the toe; outward = along the wall axis (or its normal on a tapered return)
        const e=[t[0]-w[0],t[1]-w[1]],o1=[-e[1]/l2,e[0]/l2],o=o1[0]*u[0]*sd+o1[1]*u[1]*sd>=0?o1:[-o1[0],-o1[1]];faces.push({a:w,b:t,out:o,ga:height(...w),gb:gt,len:l2,end:true});}
      for(const F of faces){const {a,b,out,ga,gb}=F,gm=Math.max(ga,gb);
        vq(BASE[fi%2],a,b,lo,lo,ga+.38,gb+.38,out);
        vq(render,a,b,ga+.38,gb+.38,T-.32,T-.32,out);
        // base course top edge (4 cm proud) and coping + shadow line
        vq(BASETOP,a,b,ga+.36,gb+.36,ga+.42,gb+.42,out,.04);
        vq(SHADOW,a,b,T-.36,T-.36,T-.3,T-.3,out,.02);vq(COPE,a,b,T-.3,T-.3,T+.05,T+.05,out,.06);
        {const A=[a[0]+out[0]*.06,a[1]+out[1]*.06],B=[b[0]+out[0]*.06,b[1]+out[1]*.06];L(COPE).push(upTri([a[0],T+.05,a[1]],[b[0],T+.05,b[1]],[B[0],T+.05,B[1]]),upTri([a[0],T+.05,a[1]],[B[0],T+.05,B[1]],[A[0],T+.05,A[1]]));}
        // overlays only where the face is not inside a garden-wall body (there they surfaced exactly on the wall face)
        if(F.len<1||Array.from({length:Math.ceil(F.len/.25)+1},(_,k)=>lerp(a,b,Math.min(1,k*.25/F.len))).some(m=>insideWall(m,out)))continue;
        // broken damp band: 2–4 irregular streaks rising from the base course
        // layers (no-coplanar rule): damp .012, patch blocks .045, joints .065 — streaks never overlap each other, nor patches
        const streaks=[];for(let k=0,n2=2+Math.floor(rnd()*3);k<n2;k++){const w=.35+rnd()*.9,t0=rnd()*Math.max(.01,F.len-w),t1=t0+w,h=.25+rnd()*.55,h2=h*(.6+rnd()*.5);
          if(streaks.some(([s0,s1])=>t0<s1+.03&&t1>s0-.03)||gm+.42+Math.max(h,h2)>T-.4)continue;streaks.push([t0,t1]);
          vq(DAMP[k%3],lerp(a,b,t0/F.len),lerp(a,b,t1/F.len),ga+(gb-ga)*t0/F.len+.42,ga+(gb-ga)*t1/F.len+.42,gm+.42+h,gm+.42+h2,out,.012);}
        // exposed masonry patches with staggered short joints
        const hi=T-.6,np=F.end?1:1+Math.floor(rnd()*2.6),patches=[];
        // each patch: two overlapping offset rectangles (an irregular worn-through outline), coursed with short staggered joints
        for(let k=0;k<np;k++){const w=.6+rnd()*Math.min(1.3,F.len*.5),t0=rnd()*Math.max(.01,F.len-w),y0=gm+.8+rnd()*Math.max(.1,(hi-gm-.8)*.7),hh=.4+rnd()*Math.min(.8,Math.max(.2,hi-y0-.1));
          if(y0+hh>hi||w>F.len)continue;const c=STONE[Math.floor(rnd()*STONE.length)];
          if(patches.some(([q0,q1])=>t0-w*.4<q1+.05&&t0+w*1.4>q0-.05))continue;patches.push([t0-w*.4,t0+w*1.4]);
          for(const [dt,dy,sw,sh] of [[0,0,1,1],[(rnd()-.3)*.5,hh*(.35+rnd()*.4),.55+rnd()*.3,.5+rnd()*.4]]){
            const s0=Math.max(0,Math.min(F.len-.2,t0+dt*w)),s1=Math.min(F.len,s0+w*sw),Y0=y0+dy,Y1=Math.min(hi,Y0+hh*sh);if(s1-s0<.2||Y1-Y0<.15)continue;
            const A=lerp(a,b,s0/F.len),B=lerp(a,b,s1/F.len),ww=s1-s0;slab(c,A,B,Y0,Y1,out,.045);
            for(let y=Y0+.26,r=0;y<Y1-.08;y+=.26,r++){vq(JOINT,A,B,y,y,y+.018,y+.018,out,.065);
              for(let t=(r%2?.2:.45);t<ww-.08;t+=.45+rnd()*.25){const J=lerp(A,B,t/ww);vq(JOINT,J,lerp(A,B,Math.min(ww,t+.018)/ww),y-.26,y-.26,y,y,out,.065);}}}}}}
    for(const [c,l] of lists)tris(l,c,'solid');stats.footings=n.footings.length;}
  // ---- Casa Blanca terrace edges: whitewashed low walls with a pale coping (level: both ends on the contour). ----
  for(const t of n.terraces){const dx=t.q[0]-t.p[0],dz=t.q[1]-t.p[1],L=Math.hypot(dx,dz)+.1,ry=Math.atan2(-dz,dx),x=(t.p[0]+t.q[0])/2,z=(t.p[1]+t.q[1])/2;
    put(box,x,t.y-.025,z,L,1.15,.4,'#d3cdbf',ry,'solid');put(box,x,t.y+.6,z,L+.02,.1,.46,'#c2bba9',ry,'solid');}
  // ---- Trees, lamps, shrubs. ----
  // Trees: route-side crowns capped at ~100 triangles (one 80-tri lobe + one 20-tri lobe) on a tapered trunk
  // with two limbs, casting; trees inside the sealed Casa Blanca garden are never approached: one 20-tri crown on a box trunk,
  // no shadow. Shrubs there: two 20-tri clumps, no shadow.
  for(const [i,t] of n.trees.entries()){const s=t.scale,priv=n.offLimitsAt(t.x,t.z),H=3.4*s;
    // Afternoon verge trees (Recinto Oeste): trunk and two lobes go to the zone's merged cast batch (sparse pools bake into it),
    // so they add no draw to views that did not already see this zone's foliage pool.
    if(t.verge){put(box,t.x,t.y+H/2-.1,t.z,.4*s,H+.2,.4*s,'#6f6553',i,'solid');put(sphere,t.x,t.y+H+1.5*s,t.z,2.5*s,1.6*s,2.35*s,['#4b7246','#3d6339'][i%2],i,'cast');
      const a=i*1.7;put(ico0,t.x+Math.cos(a)*1.6*s,t.y+H+.9*s,t.z+Math.sin(a)*1.6*s,1.6*s,1.2*s,1.6*s,'#355a36',a,'solid');continue;}
    if(priv){put(box,t.x,t.y+H/2-.1,t.z,.34*s,H+.2,.34*s,'#6f6553',i,'solid');put(ico0,t.x,t.y+H+1.2*s,t.z,2.3*s,1.6*s,2.2*s,['#3d6339','#4a7044','#355a36'][i%3],i,'leafx');continue;}
    put(cylinder,t.x,t.y+H/2-.1,t.z,.24*s,H+.2,.24*s,'#6f6553',0,'solid');
    for(const k of [0,1]){const a=i*.9+k*2.6;kit.seg([t.x,t.y+H*.8,t.z],[t.x+Math.cos(a)*1.3*s,t.y+H+.5*s,t.z+Math.sin(a)*1.3*s],.1*s,'#6f6553');}
    put(sphere,t.x,t.y+H+1.5*s,t.z,2.5*s,1.6*s,2.35*s,['#4b7246','#3d6339','#4a7044'][i%3],i,'leaf');
    const a=i*1.7;put(ico0,t.x+Math.cos(a)*1.6*s,t.y+H+.9*s,t.z+Math.sin(a)*1.6*s,1.6*s,1.2*s,1.6*s,'#355a36',a,'leaf');}
  kit.lamps(n.lamps);kit.benches(n.benches??[]);
  for(const [i,s] of n.shrubs.entries()){put(ico0,s.x,s.y+.45,s.z,s.r,.65,s.r*.9,['#3f6b3a','#4a7443','#365f33'][i%3],i,'leafx');
    put(ico0,s.x+.3,s.y+.85,s.z-.2,s.r*.65,.45,s.r*.6,['#4f7d45','#3d6837'][i%2],i*.7,'leafx');}

  // ---- Plaza San José paving (Ligocsicnarf89 2025): warm red-brown brick with stone bands, small repeat (1.4 m
  // per tile), clipped onto the ORIGINAL terrain facets (the Raíces brick recipe: the heightfield stays the only ground). ----
  stats.brickTriangles=0;
  if(n.brick?.length&&n.grid?.nx){const t=n.grid,pos=[];
    const clip=(poly,ring)=>{const sign=Math.sign(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0));let out=poly;
      for(let j=0;j<ring.length&&out.length;j++){const a=ring[j],b=ring[(j+1)%ring.length],input=out;out=[];const dd=p=>sign*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
        for(let k=0;k<input.length;k++){const p=input[k],q=input[(k+1)%input.length],dp=dd(p),dq=dd(q);if(dp>=0)out.push(p);if((dp>=0)!==(dq>=0)){const u=dp/(dp-dq);out.push(p.map((v,i)=>v+(q[i]-v)*u));}}}
      return out;};
    // Plaza San José is drawn from the layout's boundary-pinned surface triangles (the same triangles as its
    // replacement floor; the old facets are cut), any other brick ring still drapes the terrain facets.
    if(n.plazaSJ)for(const tri of n.plazaSJ.tris){const t=upTri(...tri);pos.push(...t[0],...t[1],...t[2]);stats.brickTriangles++;}
    const surfaced=new Set((n.plazaSJ?.pieces??[]).map(r=>r.map(p=>p.join()).join(';')));
    for(const {ring} of n.brick){if(surfaced.has(ring.map(p=>p.join()).join(';')))continue;const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
      const i0=Math.max(0,Math.floor((Math.min(...xs)-t.x0)/t.step)),i1=Math.min(t.nx-2,Math.ceil((Math.max(...xs)-t.x0)/t.step)),j0=Math.max(0,Math.floor((Math.min(...zs)-t.z0)/t.step)),j1=Math.min(t.nz-2,Math.ceil((Math.max(...zs)-t.z0)/t.step));
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=t.x0+i*t.step,z=t.z0+j*t.step,k=j*t.nx+i,H=t.heights;
        const a=[x,H[k],z],b=[x+t.step,H[k+1],z],c=[x,H[k+t.nx],z+t.step],d=[x+t.step,H[k+t.nx+1],z+t.step];
        for(const tri of [[a,c,b],[b,c,d]]){const poly=clip(tri,ring);for(let q=1;q<poly.length-1;q++){const [p0,p1,p2]=[poly[0],poly[q],poly[q+1]];
          if(Math.abs((p1[0]-p0[0])*(p2[2]-p0[2])-(p1[2]-p0[2])*(p2[0]-p0[0]))<1e-9)continue;pos.push(...p0,...p1,...p2);stats.brickTriangles++;}}}}
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c2=canvas.getContext('2d');let seed=7331;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    c2.fillStyle='#7a6152';c2.fillRect(0,0,256,256);
    for(let row=0;row<16;row++)for(let col=-1;col<9;col++){const x=col*32+(row%2)*16,y=row*16,v=Math.floor(rnd()*28)-14;
      c2.fillStyle=`rgb(${150+v},${98+v},${78+v})`;c2.fillRect(x+1,y+1,30,14);}
    c2.fillStyle='#a49a8c';c2.fillRect(0,0,256,10);c2.fillRect(0,0,10,256);
    for(let i=0;i<9000;i++){c2.fillStyle=rnd()<.5?'rgba(30,20,15,.08)':'rgba(255,235,215,.07)';c2.fillRect(rnd()*256,rnd()*256,1,1);}
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;ctx.textures.add(tex);
    const ids=new Map(),vp=[],uv=[],index=[];
    for(let i=0;i<pos.length;i+=3){const x=pos[i],y=pos[i+1],z=pos[i+2],key=x.toFixed(4)+','+z.toFixed(4);let id=ids.get(key);
      if(id===undefined){id=vp.length/3;ids.set(key,id);vp.push(x,y,z);uv.push((x*.976+z*.218)/2.8,(-x*.218+z*.976)/2.8);}index.push(id);}
    const bg=own(new THREE.BufferGeometry());bg.setAttribute('position',new THREE.Float32BufferAttribute(vp,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    bg.setIndex(new (vp.length/3<65536?THREE.Uint16BufferAttribute:THREE.Uint32BufferAttribute)(index,1));bg.computeVertexNormals();bg.computeBoundingSphere();
    const bm=new THREE.Mesh(bg,mat({color:'#ffffff',map:tex,roughness:.95,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    bm.name='sj-plaza-uptown-brick';bm.receiveShadow=true;scene.add(bm);meshes.push(bm);}
  // ---- Emit pools and batches. ----
  // One opaque material (facade, parts, casters) and one foliage material for the whole area (perf: fewer programs).
  const opaque=mat({vertexColors:true,roughness:.88,metalness:0}),foliage=mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const matOf=k=>k==='leaf'||k==='leafx'?foliage:opaque,casts=k=>k==='cast'||k==='leaf';let instances=0;
  // Sparse pools (< 40 instances) are baked into their zone's merged batch of the same kind: fewer draws, same look.
  {const e=new THREE.Matrix4();for(const [key,p] of [...pools]){if(p.c.length/3>=40)continue;pools.delete(key);
    const bk=p.zone+'|'+p.kind;let b=batches.get(bk);if(!b)batches.set(bk,b={kind:p.kind,zone:p.zone,p:[],n:[],c:[]});
    const P=p.g.attributes.position,N=p.g.attributes.normal,I=p.g.index;
    for(let k=0;k<p.c.length/3;k++){e.fromArray(p.m,k*16);nm.getNormalMatrix(e);
      for(let i=0;i<(I?.count??P.count);i++){const j=I?I.getX(i):i;v.fromBufferAttribute(P,j).applyMatrix4(e);nv.fromBufferAttribute(N,j).applyNormalMatrix(nm);
        b.p.push(v.x,v.y,v.z);b.n.push(nv.x,nv.y,nv.z);b.c.push(p.c[k*3],p.c[k*3+1],p.c[k*3+2]);}}}}
  for(const p of pools.values()){const count=p.c.length/3,m=new THREE.InstancedMesh(p.g,matOf(p.kind),count);
    m.instanceMatrix.array.set(p.m);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(p.c),3);
    m.name=`sj-plaza-uptown-${p.zone}-${p.kind}-${p.name}`;m.castShadow=casts(p.kind);m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);meshes.push(m);instances+=count;}
  for(const b of batches.values()){const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,matOf(b.kind));m.name=`sj-plaza-uptown-${b.zone}-${b.kind}-batch`;m.castShadow=casts(b.kind);m.receiveShadow=true;scene.add(m);meshes.push(m);}
  pools.clear();batches.clear();
  return {...stats,instances,meshes:0,trees:n.trees.length,lamps:n.lamps.length,shrubs:n.shrubs.length,facades:n.facades.length};
}
