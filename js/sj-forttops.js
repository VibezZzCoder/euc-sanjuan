/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// El Morro and San Cristóbal upper tiers, closures and seals — drawing (forttops, 2026-11-18) — © 2026 VibezZzCoder, MIT.
// All dimensions come from sj-forttops-layout.js, which owns the matching solids/seals. Wall sections follow sj-fort.js
// exactly (same tone function, cordón, parapet, merlons) so new and old masonry read as one fort.
import * as THREE from 'three/webgpu';
import {surfaceBuffer,drawGarita,masonryTexture} from './sj-gate.js';

const IRON='#1f2523';
// Wikimedia Commons curid=72603185, curid=122907842, curid=148962402, curid=148962401 (sj-fort.js): grey stone with broad warm ochre patches; `dark` deepens the tall weathered bay-facing
// scarps (Wikimedia Commons curid=148962402, curid=148962401: streaked, darker than the land front), `warm` the San Cristóbal faces (Wikimedia Commons curid=82861896, curid=11855283: ochre-grey).
function toneOf(kind) {
  const base=new THREE.Color(kind==='pale'?'#f0e3c6':'#d2cbbb'),warmC=new THREE.Color('#d9b884'),dark=kind==='dark'?.78:kind==='warm'?.92:1;
  return s=>{const k=(.9+.1*Math.sin(s.s*.29)*Math.sin(s.s*.07+.8))*dark,warm=Math.max(0,Math.sin(s.s*.045+1.7))**3*(kind==='warm'?1:.7);
    const c=base.clone().lerp(warmC,warm).multiplyScalar(k);return [c.clone().multiplyScalar(.84),c];};
}

// One fitted front (fitRun stations, drawn intervals) in the sj-fort.js section: face, plinth, cordón, parapet, walk, kerb,
// optional merlons (Wikimedia Commons curid=72603185, curid=123485577) and end faces.
export function drawFront(masonry,{walls,ends=[],PARAPET,PLINTH,MERLON,merlons=false,tone='stone',openings=null,detail=masonry,fins=true,plain=null}) {
  const up=[0,1,0],W=(s,key,y)=>[s[key][0],y,s[key][1]],lerp=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t],toneFn=toneOf(tone);
  // Per-station walks (sj-fort.js): a per-interval max left open risers at every joint (slits across the walk).
  for(const w of walls){const {a,b}=w,crestA=w.crest??a.crest,crestB=w.crest??b.crest,walkA=w.plugWalk??a.walk,walkB=w.plugWalk??b.walk;
    const n=[a.nx,0,a.nz],ni=[-a.nx,0,-a.nz],[ab,at]=toneFn(a),[bb,bt]=toneFn(b),bottomA=w.bottom??a.bottom,bottomB=w.bottom??b.bottom;
    masonry.quad(W(a,'B',bottomA),W(b,'B',bottomB),W(b,'T',crestB),W(a,'T',crestA),[ab,bb,bt,at],n,3.4);
    // A plug draws its face to the neighbours' lower crest; the neighbour's edge at the shared station rises to that
    // station's own crest. The thin triangle between the two edges was open sky: close it with a fin
    // (one triangle in the double-sided plain batch; two windings were back-to-back coplanar faces).
    if(fins&&w.crest!==undefined)for(const [s,c,bt_,bot] of [[a,crestA,at,bottomA],[b,crestB,bt,bottomB]])if(s.crest>c+.01)
      (plain??detail).tri(W(s,'B',bot),W(s,'T',c),W(s,'T',s.crest),[bt_,bt_,bt_],[s.nz,0,-s.nx],3.4);
    // Faces standing on a deck run to it without a plinth (the deck reaches the face foot B).
    if(!a.noPlinth&&!b.noPlinth){masonry.quad(W(a,'LB',bottomA),W(b,'LB',bottomB),W(b,'L',a.base+PLINTH.rise),W(a,'L',a.base+PLINTH.rise),'#a99f8c',n);
    detail.quad(W(a,'L',a.base+PLINTH.rise),W(b,'L',b.base+PLINTH.rise),W(b,'F',b.base+PLINTH.rise),W(a,'F',a.base+PLINTH.rise),'#a99f8c',up);}
    // one facet (a sloped band from the face to the roll's crown; same silhouette at the fort's range).
    const T=(s,f)=>lerp(s.T,s.C,f),cord=[[0,-.16],[1,.16]];
    for(let i=0;i<1;i++){const [f0,y0]=cord[i],[f1,y1]=cord[i+1],pa=T(a,f0),pb=T(b,f0),qa=T(a,f1),qb=T(b,f1);
      detail.quad([pa[0],crestA+y0,pa[1]],[pb[0],crestB+y0,pb[1]],[qb[0],crestB+y1,qb[1]],[qa[0],crestA+y1,qa[1]],'#cfc4ad',[n[0],(y0+y1)*4,n[2]]);}
    const pa=walkA+PARAPET.rise,pb=walkB+PARAPET.rise;
    masonry.quad(W(a,'T',crestA+.16),W(b,'T',crestB+.16),W(b,'T',pb),W(a,'T',pa),[at,bt,bt,at],n);
    // Coping: one flat quad (the 8 cm ridge is invisible from outside the fort).
    detail.quad(W(a,'T',pa),W(b,'T',pb),W(b,'Q',pb),W(a,'Q',pa),'#b8ae9b',up);
    masonry.quad(W(a,'Q',pa),W(b,'Q',pb),W(b,'Q',walkB),W(a,'Q',walkA),'#cfc6b4',ni);
    detail.quad(W(a,'Q',walkA),W(b,'Q',walkB),W(b,'W',walkB),W(a,'W',walkA),'#9d968a',up,1.6);
    if(Math.max(Math.abs(walkA-(w.kerb??a.kerb)),Math.abs(walkB-(w.kerb??b.kerb)))>.04)detail.quad(W(a,'W',walkA),W(b,'W',walkB),W(b,'W',w.kerb??b.kerb),W(a,'W',w.kerb??a.kerb),'#b9b0a0',ni);
    // Dark segmental openings (HABS PR-48 sheet 2 / Wikimedia Commons curid=148962402, curid=148962401: small deep-looking casemate openings in the bay scarps).
    // Proud reveal blocks, never on the face plane itself.
    if(openings)openings(w,{n,W,lerp,crestA,crestB});
    if(merlons&&b.s-a.s>1e-6){const period=MERLON.length+MERLON.gap,rise0=MERLON.rise*.65;
      for(let m=Math.floor(a.s/period)*period;m<b.s;m+=period){const s0=Math.max(a.s,m),s1=Math.min(b.s,m+MERLON.length);if(s1-s0<.05)continue;
        const f0=(s0-a.s)/(b.s-a.s),f1=(s1-a.s)/(b.s-a.s),y0=pa+(pb-pa)*f0,y1=pa+(pb-pa)*f1,rise=rise0+.08;
        const T0=lerp(a.T,b.T,f0),T1=lerp(a.T,b.T,f1),Q0=lerp(a.Q,b.Q,f0),Q1=lerp(a.Q,b.Q,f1);
        const t0=[T0[0],y0,T0[1]],t1=[T1[0],y1,T1[1]],q0=[Q0[0],y0,Q0[1]],q1=[Q1[0],y1,Q1[1]];
        const T0u=[T0[0],y0+rise,T0[1]],T1u=[T1[0],y1+rise,T1[1]],Q0u=[Q0[0],y0+rise*.82,Q0[1]],Q1u=[Q1[0],y1+rise*.82,Q1[1]];
        detail.quad(t0,t1,T1u,T0u,'#cdc3ae',n);detail.quad(q1,q0,Q0u,Q1u,'#cdc3ae',ni);
        detail.quad(T0u,T1u,Q1u,Q0u,'#d6cdb9',[n[0]*.15,1,n[2]*.15]);
        const tan=[b.T[0]-a.T[0],0,b.T[1]-a.T[1]];
        if(s0>a.s+1e-6||m>=a.s)detail.quad(q0,t0,T0u,Q0u,'#c4b9a2',tan.map(v=>-v));
        if(s1<b.s-1e-6)detail.quad(t1,q1,Q1u,T1u,'#c4b9a2',tan);}}
  }
  for(const {s,dir,walk} of ends){const t=[dir*s.nz,0,-dir*s.nx],y=walk??s.walk;
    masonry.quad(W(s,'B',s.bottom),W(s,'W',s.bottom),W(s,'W',y),W(s,'T',y),'#bdb19b',t);
    masonry.quad(W(s,'T',y),W(s,'Q',y),W(s,'Q',y+PARAPET.rise),W(s,'T',y+PARAPET.rise),'#bdb19b',t);}
}

// Garita (Wikimedia Commons curid=123485577, curid=136301888; sj-gate.js drawGarita profile): lathe body, dome, finial and three dark slits, all in the masonry
// batch (no instance pools).
function garita(target,g){const r=g.radius,b=g.body,profile=[[.22,-g.corbel],[r*.55,-g.corbel*.7],[r*.8,-g.corbel*.35],[r+.06,-.08],[r+.1,0],[r,.06],[r,b],
    [r+.12,b+.04],[r+.14,b+.2],[r,b+.24],...Array.from({length:7},(_,i)=>{const t=(i+1)/7*Math.PI/2;return [r*.97*Math.cos(t),b+.24+r*.92*Math.sin(t)];}),
    [.08,b+.24+r*.92+.02],[.08,b+.24+r*.92+.3],[.14,b+.24+r*.92+.34],[.001,b+.24+r*.92+.5]];
  const lathe=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(Math.max(x,.001),y)),14),pos=lathe.attributes.position,idx=lathe.index;
  for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return [g.x+pos.getX(j),g.y+pos.getY(j),g.z+pos.getZ(j)];});
    const cx=(q[0][0]+q[1][0]+q[2][0])/3-g.x,cyy=(q[0][1]+q[1][1]+q[2][1])/3-g.y-b,cz=(q[0][2]+q[1][2]+q[2][2])/3-g.z;
    target.tri(q[0],q[1],q[2],'#d9d0bd',[cx,cyy>0?cyy:0,cz],1.4);}
  lathe.dispose();
  const face=Math.atan2(g.wallNx,g.wallNz);
  for(const a of [-1.1,0,1.1]){const t=face+a,s=Math.sin(t),c=Math.cos(t),tx=c,tz=-s,R=r+.03,y0=g.y+b*.45,y1=g.y+b*.8,x=g.x+s*R,z=g.z+c*R;
    target.quad([x-tx*.05,y0,z-tz*.05],[x+tx*.05,y0,z+tz*.05],[x+tx*.05,y1,z+tz*.05],[x-tx*.05,y1,z-tz*.05],'#2a2a26',[s,0,c],1.4);}
}

export function buildForttops(ft,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures}) {
  const C=ft.constants,stats={};
  // per fort (each ≤ 250 m across) a shadow-casting mass batch (faces, parapets, closures, barracks body)
  // and a no-shadow detail batch (merlons, cordón, coping, walks, decks, openings, garitas, flags, iron, trim).
  const FORTS=['morro','cristobal'],mk=()=>Object.fromEntries(FORTS.map(f=>[f,surfaceBuffer()]));
  const buffers=mk(),detailB=mk(),plainB=mk(),plainD=mk();
  // ---- Plugs in the fitted fronts (same section as their neighbours). ----
  for(const q of ft.plugs)drawFront(buffers[q.fort],{detail:detailB[q.fort],walls:[{a:q.a,b:q.b,crest:q.crest,plugWalk:q.walk,kerb:Math.min(q.a.kerb,q.b.kerb),bottom:q.bottom}],
    PARAPET:C.PARAPET,PLINTH:C.PLINTH,MERLON:C.MERLON,tone:'stone',fins:false});
  // ---- Inner fronts (main scarp, Santa Barbara battery …). ----
  for(const f of ft.fronts){const m=detailB[f.fort];
    drawFront(buffers[f.fort],{detail:m,plain:plainD[f.fort],walls:f.walls,ends:f.ends,PARAPET:C.PARAPET,PLINTH:C.PLINTH,MERLON:C.MERLON,merlons:!!f.merlons,tone:f.tone});
    // Face openings on a battered face: points on the face plane at (station fraction t, height y), pushed `o` m out.
    const onFace=(a,b,t,y,o)=>{const at=s=>{const k=(y-s.bottom)/((s.crest??s.walk)-s.bottom||1);return [s.B[0]+(s.T[0]-s.B[0])*k+s.nx*o,s.B[1]+(s.T[1]-s.B[1])*k+s.nz*o];};
      const pa=at(a),pb=at(b);return [pa[0]+(pb[0]-pa[0])*t,y,pa[1]+(pb[1]-pa[1])*t];};
    const opening=(a,b,t0,t1,y0,y1,yc,frame,dark)=>{const n=[a.nx,0,a.nz],q=(u0,u1,v0,v1,o,c)=>m.quad(onFace(a,b,u0,v0,o),onFace(a,b,u1,v0,o),onFace(a,b,u1,v1,o),onFace(a,b,u0,v1,o),c,n,1.2);
      const L=Math.hypot(b.B[0]-a.B[0],b.B[1]-a.B[1])||1,f=.22/L;
      q(t0-f,t1+f,y0-.12,yc+.3,.07,frame);q(t0,t1,y0,y1,.13,dark);
      // Segmental head: a dark lens over the jambs (three slices).
      const w=t1-t0;for(let i=0;i<3;i++){const s0=t0+w*i/3,s1=t0+w*(i+1)/3,h=k=>y1+(yc-y1)*Math.sin(Math.PI*k);q(s0,s1,y1-.01,Math.min(h((i+.5)/3),yc),.13,dark);}};
    // One opening at an interval's midpoint every `every` intervals (2 m stations: arches 1.7/1.5 m, windows 1.0 m wide).
    if(f.openings||f.arcade){const every=f.arcade?(f.fort==='cristobal'?2:3):5;let k=0;
      for(const {a,b} of f.walls){const L=Math.hypot(b.B[0]-a.B[0],b.B[1]-a.B[1]);if(L<1.6||(k++)%every)continue;
        const ground=Math.max(a.base,b.base),hA=Math.min(a.crest-a.bottom,b.crest-b.bottom);
        if(f.arcade){const w=(f.fort==='cristobal'?1.7:1.5)/L,y0=ground+.05,y1=y0+(f.fort==='cristobal'?2.5:2.1),yc=y1+.6;
          if(yc<=Math.min(a.crest,b.crest)-.8)opening(a,b,.5-w/2,.5+w/2,y0,y1,yc,'#dcc38f','#1f1b17');}
        else if(hA>=9){const w=1.0/L,y0=Math.max(a.bottom,b.bottom)+hA*.42,y1=y0+1.2;opening(a,b,.5-w/2,.5+w/2,y0,y1,y1+.32,'#9a8f7b','#262421');}}}
    for(const g of f.garitas??[])garita(m,g);}
  // ---- Perimeter closures: every block drawn exactly as its collider (footprint, flat top). Masonry: battered-look stone
  // with a pale coping band; gates: a 0.5 m masonry footing under a dark iron grille block with top and bottom rails
  // (same footprint — the grille reads as a closed gate at range; Wikimedia Commons curid=72603185's paseo-end gate kit colours). ----
  // a block side that coincides with another block's side (abutting pieces) is hidden inside the
  // closure; it is not drawn (the iron's double-sided material showed it fighting the neighbour's face).
  const edgeKey=(u,v)=>{const q=p=>Math.round(p[0]*50)+','+Math.round(p[1]*50),A=q(u),B=q(v);return A<B?A+'|'+B:B+'|'+A;};
  const topOf=(bl,p)=>{const S=bl.slope;if(!S)return bl.top;const dx=S.b[0]-S.a[0],dz=S.b[1]-S.a[1],t=Math.max(0,Math.min(1,((p[0]-S.a[0])*dx+(p[1]-S.a[1])*dz)/((dx*dx+dz*dz)||1)));return S.ya+(S.yb-S.ya)*t;};
  const edges=new Map();for(const bl of ft.blocks)for(let i=0;i<bl.ring.length;i++){const k=edgeKey(bl.ring[i],bl.ring[(i+1)%bl.ring.length]);let l=edges.get(k);if(!l)edges.set(k,l=[]);l.push(bl);}
  // Height up to which a side is hidden by an abutting block (its top at u and v), or null.
  const hiddenTo=(self,u,v)=>{const l=edges.get(edgeKey(u,v));if(!l||l.length<2)return null;let hu=-Infinity,hv=-Infinity;
    for(const o of l)if(o!==self){hu=Math.max(hu,topOf(o,u));hv=Math.max(hv,topOf(o,v));}return [hu,hv];};
  for(const bl of ft.blocks){const m=buffers[bl.fort],plain=plainD[bl.fort],r=bl.ring,cx=r.reduce((t,q)=>t+q[0],0)/r.length,cz=r.reduce((t,q)=>t+q[1],0)/r.length,up=[0,1,0];
    const side=(y0,y1,c,buf=m,scale=2.6)=>{for(let i=0;i<r.length;i++){const u=r[i],v=r[(i+1)%r.length],o=[(u[0]+v[0])/2-cx,0,(u[1]+v[1])/2-cz];const hid=hiddenTo(bl,u,v);if(hid){const a0=Math.max(y0,hid[0]),b0=Math.max(y0,hid[1]);if(a0>=y1-.005&&b0>=y1-.005)continue;buf.quad([u[0],a0,u[1]],[v[0],b0,v[1]],[v[0],y1,v[1]],[u[0],y1,u[1]],c,o,scale);continue;}
      buf.quad([u[0],y0,u[1]],[v[0],y0,v[1]],[v[0],y1,v[1]],[u[0],y1,u[1]],c,o,scale);}};
    const cap=(y,c,buf=m)=>{for(let i=2;i<r.length;i++)buf.tri([r[0][0],y,r[0][1]],[r[i-1][0],y,r[i-1][1]],[r[i][0],y,r[i][1]],c,up,1.4);};
    if(bl.kind==='gate'){const foot=bl.top-C.CLOSURE.iron;side(bl.bottom,foot,'#b5ab98');side(foot,bl.top,'#262d2b',plain);
      // a closed iron grille on both long faces — vertical bars every 0.16 m (1.5 cm
      // proud), top, middle and bottom rails (4 cm proud, never in the bars' plane) on the (unchanged) dark block; footprint and collider unchanged.
      if(r.length===4)for(const [u,v] of [[r[0],r[1]],[r[2],r[3]]]){const L=Math.hypot(v[0]-u[0],v[1]-u[1]);if(L<.2)continue;
        const tx=(v[0]-u[0])/L,tz=(v[1]-u[1])/L,mx=(u[0]+v[0])/2,mz=(u[1]+v[1])/2,ox=mx-cx,oz=mz-cz,ol=Math.hypot(ox,oz)||1,nx=ox/ol*.015,nz=oz/ol*.015,hint=[ox,0,oz];
        const P=(t,y,k=1)=>[u[0]+tx*t+nx*k,y,u[1]+tz*t+nz*k];
        for(let t=.08;t<L-.04;t+=.16)plainD[bl.fort].quad(P(t,foot+.06),P(t+.035,foot+.06),P(t+.035,bl.top-.06),P(t,bl.top-.06),'#59625e',hint);
        for(const y of [foot+.06,(foot+bl.top)/2,bl.top-.14])plainD[bl.fort].quad(P(0,y,2.7),P(L,y,2.7),P(L,y+.08,2.7),P(0,y+.08,2.7),'#646d68',hint);}
      cap(bl.top,'#1f2523',plain);}
    // Final polish (San Cristóbal's pale approaches plainer than stone): the fort's own tone (warm ochre-grey at
    // San Cristóbal, Wikimedia Commons curid=82861896, curid=11855283), varied per block, a darker foot and a stone-grey cap.
    else{const [lo,hi]=toneOf(bl.fort==='cristobal'?'warm':'stone')({s:cx*.7+cz*1.3}),S=bl.slope;
      // Water-battery parapet: a coping sloping between shared joint heights along the piece axis.
      const topAt=S?p=>{const dx=S.b[0]-S.a[0],dz=S.b[1]-S.a[1],t=Math.max(0,Math.min(1,((p[0]-S.a[0])*dx+(p[1]-S.a[1])*dz)/((dx*dx+dz*dz)||1)));return S.ya+(S.yb-S.ya)*t;}:()=>bl.top;
      for(let i=0;i<r.length;i++){const u=r[i],v=r[(i+1)%r.length],hid=hiddenTo(bl,u,v),bu=hid?Math.min(topAt(u),Math.max(bl.bottom,hid[0])):bl.bottom,bv=hid?Math.min(topAt(v),Math.max(bl.bottom,hid[1])):bl.bottom;
        if(hid&&bu>=topAt(u)-.005&&bv>=topAt(v)-.005)continue;
        m.quad([u[0],bu,u[1]],[v[0],bv,v[1]],[v[0],topAt(v),v[1]],[u[0],topAt(u),u[1]],[lo,lo,hi,hi],[(u[0]+v[0])/2-cx,0,(u[1]+v[1])/2-cz],2.6);}
      const capC=bl.fort==='cristobal'?'#c2b391':'#c9c0ad';
      if(!S)cap(bl.top,capC);
      else{for(let i=2;i<r.length;i++)m.tri([r[0][0],topAt(r[0]),r[0][1]],[r[i-1][0],topAt(r[i-1]),r[i-1][1]],[r[i][0],topAt(r[i]),r[i][1]],capC,up,1.4);
        // Merlons every 3.2 m along the stretch (2.2 m long, 0.55 m over the coping); the gaps between them are the
        // embrasures (Wikimedia Commons curid=148962402, curid=148962401). Drawn above the collider, never below it.
        if(S.merlons&&r.length===4){const P_=3.2,M_=2.2,R_=.55,e=f=>[r[0][0]+(r[1][0]-r[0][0])*f,r[0][1]+(r[1][1]-r[0][1])*f],i_=f=>[r[3][0]+(r[2][0]-r[3][0])*f,r[3][1]+(r[2][1]-r[3][1])*f];
          const det=detailB[bl.fort],tan=[r[1][0]-r[0][0],0,r[1][1]-r[0][1]],out=[r[0][0]-r[3][0],0,r[0][1]-r[3][1]];
          for(let m0=Math.floor(S.s0/P_)*P_;m0<S.s0+S.L;m0+=P_){const s0=Math.max(S.s0,m0),s1=Math.min(S.s0+S.L,m0+M_);if(s1-s0<.08)continue;
            const f0=(s0-S.s0)/S.L,f1=(s1-S.s0)/S.L,A=e(f0),B=e(f1),C=i_(f1),D=i_(f0),Y=p=>topAt(p),U=p=>Y(p)+R_;
            const P3=(p,y)=>[p[0],y,p[1]];
            det.quad(P3(A,Y(A)),P3(B,Y(B)),P3(B,U(B)),P3(A,U(A)),'#cdc3ae',out);det.quad(P3(C,Y(C)),P3(D,Y(D)),P3(D,U(D)),P3(C,U(C)),'#cdc3ae',out.map(v=>-v));
            det.quad(P3(A,U(A)),P3(B,U(B)),P3(C,U(C)),P3(D,U(D)),'#d6cdb9',up);
            if(s0>S.s0+1e-6||m0>=S.s0)det.quad(P3(D,Y(D)),P3(A,Y(A)),P3(A,U(A)),P3(D,U(D)),'#c4b9a2',tan.map(v=>-v));
            if(s1<S.s0+S.L-1e-6)det.quad(P3(B,Y(B)),P3(C,Y(C)),P3(C,U(C)),P3(B,U(B)),'#c4b9a2',tan);}}}}}
  // Footing course: on the designed contact line, constant height over the drawn grade.
  // Toe side skirts: rock steps at run ends, shaded like the bank they belong to (up-facing normals), not dark slits.
  for(const k of ft.toeSkirts??[])detailB[k.fort].quadSafe(...k.q,'#a49b84',k.t,2.6,[[0,1,0],[0,1,0],[0,1,0],[0,1,0]]);
  for(const q of ft.footings??[]){const m=detailB[q.fort],c0='#9c917b',c1='#b1a68f';
    m.quad(q.q[0],q.q[1],q.q[2],q.q[3],[c0,c0,c1,c1],q.n,2.0);detailB[q.fort].quad(...q.cap,'#bdb29b',[0,1,0],1.4);
    if(q.startEnd)m.quadSafe(q.wq0,q.q[0],q.q[3],q.cap[3],'#a69b84',q.tan.map(v=>-v),2.0);
    if(q.endEnd)m.quadSafe(q.q[1],q.wq1,q.cap[2],q.q[2],'#a69b84',q.tan,2.0);}
  stats.closureBlocks=ft.blocks.length;
  // ---- San Cristóbal outworks: toe revetments drawn exactly as laid out (face from its buried foot to
  // the coping, coping = the replacement top's two triangles, end faces); the ledge is drawn in the terrain chunks. One
  // no-shadow batch (low walls far from the streets; ). CLR Fig. 4.13: El Abanico pale ochre limestone; Fig. 4.22 /
  // Wikimedia Commons curid=11855283: warm grey covered-way and counterscarp masonry with a darker weathered foot. ----
  // Perf: drawn into San Cristóbal's existing no-shadow detail batch (same material): no new draw call in any view.
  const OW=detailB.cristobal,ow0=OW.count;
  if(ft.outworks){const T3=(p,y)=>[p[0],y,p[1]],up=[0,1,0];
    // pale warm lime with broad irregular stains and a darker
    // weathered foot, finer coursing (2.0 m texture period, was 3.4); Santa Teresa stays the darker stone (Fig. 4.23).
    const OWT={pale:'#f6ecd6',warm:'#eadbbb',stone:'#cfc6b3'},STAIN=new THREE.Color('#c2ad87'),FOOT=new THREE.Color('#9c9078');
    const owTone=(tone,p)=>{const u=p[0]*.9+p[1]*.4,k=Math.max(0,Math.sin(u*.071+1.3)*Math.sin(u*.023+.4)+.25*Math.sin(u*.31))*.55,
      c=new THREE.Color(OWT[tone]??OWT.stone).lerp(STAIN,Math.min(.45,k));return [c.clone().lerp(FOOT,.55),c];};
    // Pale walls (covered way, El Abanico): the same stone texture lifted to pale weathered lime by vertex colour (×1.55,
    // linear); an untextured lime version was tried and read as concrete.
    for(const w of ft.outworks.walls){const pale=w.tone==='pale',lift=pale?1.55:1,BUF=OW;
      for(const {a,b,coping} of w.intervals){const n=[a.n[0],0,a.n[1]],[ab,at]=owTone(w.tone,a.p),[bb,bt]=owTone(w.tone,b.p);
        OW.quad(T3(a.B,a.bottom),T3(b.B,b.bottom),T3(b.T,b.y),T3(a.T,a.y),[ab,bb,bt,at].map(c=>c.clone().multiplyScalar(lift)),n,2.0);
        for(const t of coping)BUF.tri(t[0],t[1],t[2],pale?'#c8bda3':'#ddd2b8',up,1.4);
        // Coping lip (CLR Fig. 4.13/4.22: a pale capping course proud of the face): a 0.22 m band 9 cm out, closed on top.
        const o=(s,k)=>[s.T[0]+s.n[0]*k,s.T[1]+s.n[1]*k];
        BUF.quad(T3(o(a,.09),a.y-.22),T3(o(b,.09),b.y-.22),T3(o(b,.09),b.y),T3(o(a,.09),a.y),'#e6dcc4',n,1.4);
        BUF.quad(T3(o(a,.09),a.y),T3(o(b,.09),b.y),T3(b.T,b.y),T3(a.T,a.y),'#e0d5bc',up,1.4);
        BUF.quad(T3(a.T,a.y-.22),T3(b.T,b.y-.22),T3(o(b,.09),b.y-.22),T3(o(a,.09),a.y-.22),'#9f937c',[0,-1,0],1.4);}
      for(const {s,dir} of w.ends){const t=[dir*s.t[0],0,dir*s.t[1]];
        BUF.quadSafe(T3(s.B,s.bottom),T3(s.I,s.bottom),T3(s.I,Math.max(s.yI,s.y)),T3(s.B,s.y),'#b9ad95',t,2.6);}}
    const d=ft.outworks.diablo;
    if(d){const r=d.ring;for(let i=0;i<r.length;i++){const u=r[i],v=r[(i+1)%r.length];OW.quad([u[0],d.bottom,u[1]],[v[0],d.bottom,v[1]],[v[0],d.y,v[1]],[u[0],d.y,u[1]],
        ['#a99b80','#a99b80','#c7b896','#c7b896'],[(u[0]+v[0])/2-d.x,0,(u[1]+v[1])/2-d.z],2.6);}
      for(let i=2;i<r.length;i++)OW.tri([r[0][0],d.y,r[0][1]],[r[i-1][0],d.y,r[i-1][1]],[r[i][0],d.y,r[i][1]],'#cbbfa4',up,1.4);
      if(d.foot){const f=d.foot;for(let i=0;i<f.length;i++){const u=f[i],v=f[(i+1)%f.length];OW.quad([u[0],d.bottom-.1,u[1]],[v[0],d.bottom-.1,v[1]],[v[0],d.yF,v[1]],[u[0],d.yF,u[1]],
        ['#8a7f69','#8a7f69','#a39578','#a39578'],[(u[0]+v[0])/2-d.x,0,(u[1]+v[1])/2-d.z],2.6);}
        for(let i=0;i<f.length;i++){const u=f[i],v=f[(i+1)%f.length],U=r[i],V=r[(i+1)%r.length];OW.quad([u[0],d.yF,u[1]],[v[0],d.yF,v[1]],[V[0],d.yF+.02,V[1]],[U[0],d.yF+.02,U[1]],'#a39578',up,1.4);}}
      garita(OW,d);}}
  stats.outworks=(OW.count-ow0)/3;
  // ---- Decks: paved terrepleins (Wikimedia Commons curid=148962402, curid=148962401 pale decks; HABS PR-47/48 regular courts), masonry skirts at their ends. ----
  for(const d of ft.decks??[]){const m=detailB[d.fort],up=[0,1,0];
    for(const t of d.tris)m.tri(t[0],t[1],t[2],d.colour,up,3.2);
    for(const {prof,r} of d.skirts){const yAt=p=>{const L=Math.hypot(r.E[0]-r.W[0],r.E[1]-r.W[1])||1,t=Math.hypot(p[0]-r.W[0],p[2]-r.W[1])/L,
        tm=Math.hypot(r.M[0]-r.W[0],r.M[1]-r.W[1])/L;return t<=tm?r.yW+(r.y-r.yW)*(t/(tm||1)):r.y;};
      const all=d.tris.flat(),cx=all.reduce((t,p)=>t+p[0],0)/all.length,cz=all.reduce((t,p)=>t+p[2],0)/all.length,mx=(r.W[0]+r.E[0])/2,mz=(r.W[1]+r.E[1])/2,hint=[mx-cx,0,mz-cz];
      for(let i=0;i+1<prof.length;i++){const a=prof[i],b=prof[i+1],ya=yAt(a),yb=yAt(b);
        if(Math.abs(a[1]-ya)<.005&&Math.abs(b[1]-yb)<.005)continue;
        m.quadSafe([a[0],Math.min(ya,a[1]),a[2]],[b[0],Math.min(yb,b[1]),b[2]],[b[0],Math.max(yb,b[1]),b[2]],[a[0],Math.max(ya,a[1]),a[2]],'#b3a994',hint,2.4);}}}
  // ---- San Cristóbal troop quarters (Wikimedia Commons curid=14719072: two storeys of tall arched windows between pilasters, cornice and low
  // parapet, worn cream plaster with a darker weathered end wall; Wikimedia Commons curid=124496780: the long facade over the gate rampart). ----
  if(ft.barracks){const b=ft.barracks,P3=(t,d,y)=>{const [x,z]=b.P(t,d);return [x,y,z];},out=[-b.nx,0,-b.nz].map(v=>-v),inn=[-b.nx,0,-b.nz],along=[b.ux,0,b.uz];
    // Faces of an axis-aligned block in the barracks frame (t along the facade, d inward from the outer facade).
    // host: the d of the face lying on the facade it projects from — never drawn (no decoration on its host's plane).
    const body=plainB.cristobal,plain=plainD.cristobal;
    const block=(t0,t1,d0,d1,y0,y1,c,{top=true,ends=true,host=null}={})=>{
      if(host!==d0)plain.quad(P3(t0,d0,y0),P3(t1,d0,y0),P3(t1,d0,y1),P3(t0,d0,y1),c,out);if(host!==d1)plain.quad(P3(t1,d1,y0),P3(t0,d1,y0),P3(t0,d1,y1),P3(t1,d1,y1),c,inn);
      if(ends){plain.quad(P3(t0,d1,y0),P3(t0,d0,y0),P3(t0,d0,y1),P3(t0,d1,y1),c,along.map(v=>-v));plain.quad(P3(t1,d0,y0),P3(t1,d1,y0),P3(t1,d1,y1),P3(t1,d0,y1),c,along);}
      if(top)plain.quad(P3(t0,d0,y1),P3(t1,d0,y1),P3(t1,d1,y1),P3(t0,d1,y1),c,[0,1,0]);};
    // Wikimedia Commons curid=124496780, curid=14719072: older, subdued cream with broad faded staining (darker toward the foot and in slow
    // patches along the facade), a dark weathered rubble end, softer window slots and warm trim.
    const CREAM='#d9cdb1',END='#8f8470',TRIM='#e4dac4',DARK='#3b3631',L=b.t1-b.t0;
    const stain=(t,y)=>{const k=.9+.08*Math.sin(t*.7+1.3)*Math.sin(t*.23)+.05*Math.sin(t*1.9);const c=new THREE.Color(CREAM).multiplyScalar(k);
      const f=Math.max(0,Math.min(1,(y-b.bottom)/(b.parapet-b.bottom)));return c.lerp(new THREE.Color('#a8987b'),Math.max(0,.45-f)*.9);};
    const seg=Math.max(4,Math.round(L/2));
    for(let i=0;i<seg;i++){const t0=b.t0+L*i/seg,t1=b.t0+L*(i+1)/seg;
      body.quad(P3(t0,0,b.bottom),P3(t1,0,b.bottom),P3(t1,0,b.parapet),P3(t0,0,b.parapet),[stain(t0,b.bottom),stain(t1,b.bottom),stain(t1,b.parapet),stain(t0,b.parapet)],out);
      body.quad(P3(t1,b.depth,b.bottom),P3(t0,b.depth,b.bottom),P3(t0,b.depth,b.parapet),P3(t1,b.depth,b.parapet),[stain(t1+9,b.bottom),stain(t0+9,b.bottom),stain(t0+9,b.parapet),stain(t1+9,b.parapet)],inn);}
    body.quad(P3(b.t0,b.depth,b.bottom),P3(b.t0,0,b.bottom),P3(b.t0,0,b.parapet),P3(b.t0,b.depth,b.parapet),END,along.map(v=>-v));
    body.quad(P3(b.t1,0,b.bottom),P3(b.t1,b.depth,b.bottom),P3(b.t1,b.depth,b.parapet),P3(b.t1,0,b.parapet),'#b2a68c',along);
    // Low roof vents (Wikimedia Commons curid=124496780: small boxes along the roof).
    for(const f of [.2,.45,.7,.9])block(b.t0+L*f-.35,b.t0+L*f+.35,b.depth*.5-.35,b.depth*.5+.35,b.roof,b.roof+.55,'#c4b9a2');
    plain.quad(P3(b.t0+.35,.35,b.roof),P3(b.t1-.35,.35,b.roof),P3(b.t1-.35,b.depth-.35,b.roof),P3(b.t0+.35,b.depth-.35,b.roof),'#cfc5b2',[0,1,0]);
    // Parapet inner faces and coping (the roof sits 0.7 m below the parapet top).
    for(const [d0,d1,n] of [[.35,.35,inn],[b.depth-.35,b.depth-.35,out]])plain.quad(P3(b.t0+.35,d0,b.roof),P3(b.t1-.35,d1,b.roof),P3(b.t1-.35,d1,b.parapet),P3(b.t0+.35,d0,b.parapet),'#d8cfba',n);
    for(const [t,n] of [[b.t0+.35,along],[b.t1-.35,along.map(v=>-v)]])plain.quad(P3(t,.35,b.roof),P3(t,b.depth-.35,b.roof),P3(t,b.depth-.35,b.parapet),P3(t,.35,b.parapet),'#d8cfba',n);
    for(const [d0,d1] of [[0,.35],[b.depth-.35,b.depth]])plain.quad(P3(b.t0,d0,b.parapet),P3(b.t1,d0,b.parapet),P3(b.t1,d1,b.parapet),P3(b.t0,d1,b.parapet),TRIM,[0,1,0]);
    for(const [t0,t1] of [[b.t0,b.t0+.35],[b.t1-.35,b.t1]])plain.quad(P3(t0,.35,b.parapet),P3(t1,.35,b.parapet),P3(t1,b.depth-.35,b.parapet),P3(t0,b.depth-.35,b.parapet),TRIM,[0,1,0]);
    // Cornice band (proud 0.28 m) both long sides, string course between storeys, plinth.
    for(const [d,s] of [[0,-1],[b.depth,1]]){const dd=d+s*.28;block(b.t0-.2,b.t1+.2,Math.min(d,dd),Math.max(d,dd),b.eaves-.32,b.eaves,TRIM,{host:d});
      const d2=d+s*.12;block(b.t0,b.t1,Math.min(d,d2),Math.max(d,d2),b.floor+3.55,b.floor+3.75,TRIM,{ends:false,host:d});}
    // Bays: tall arched-head windows (dark panes proud 0.1 m in pale surrounds), pilasters between bays.
    const bays=Math.max(4,Math.round(L/4.2));
    for(let i=0;i<bays;i++){const tc=b.t0+(i+.5)*L/bays;
      for(const [d,s] of [[0,-1],[b.depth,1]]){const D=(o)=>d+s*o;
        for(const [y0,y1] of [[b.floor+.5,b.floor+3.0],[b.floor+4.3,b.floor+6.6]]){
          block(tc-.78,tc+.78,Math.min(D(0),D(.06)),Math.max(D(0),D(.06)),y0-.18,y1+.22,TRIM,{host:d});
          block(tc-.55,tc+.55,Math.min(D(.06),D(.12)),Math.max(D(.06),D(.12)),y0,y1,DARK,{host:D(.06)});}
        if(i)block(b.t0+i*L/bays-.3,b.t0+i*L/bays+.3,Math.min(D(0),D(.09)),Math.max(D(0),D(.09)),b.floor,b.eaves-.32,'#ece4d0',{top:false,host:d});}}
    stats.barracks=bays;}
  // ---- Flags (F1; Wikimedia Commons curid=14719072, curid=124496780): pole, gilded ball, flag panel flying west (trade winds), non-overlapping colour quads. ----
  for(const f of ft.flags){const top=f.y+f.pole,plain=plainD[f.x<0?'morro':'cristobal'];
    bake(cylinder,f.x,(f.y-.3+top)/2,f.z,.045,top-f.y+.3,.045,'#d9d9d4',0,'solid');bake(sphere,f.x,top+.06,f.z,.08,.08,.08,'#c9a24a',0,'solid');
    const W=C.FLAG.w,H=C.FLAG.h,y1=top-.08,y0=y1-H,X=u=>f.x-.05-u*W,Zw=u=>f.z+Math.sin(u*3.1)*.08;
    const q=(u0,u1,v0,v1,c,z=0)=>plain.quad([X(u0),y0+v0*H,Zw(u0)+z],[X(u1),y0+v0*H,Zw(u1)+z],[X(u1),y0+v1*H,Zw(u1)+z],[X(u0),y0+v1*H,Zw(u0)+z],c,[0,0,1]);
    const RED='#b3262e',WHITE='#f3f1ea',BLUE='#253f7a',SKY='#3b6fb6';
    if(f.kind==='us'){for(let r=0;r<13;r++){const v0=r/13,v1=(r+1)/13,c=r%2?WHITE:RED;if(r>=6)q(.4,1,v0,v1,c);else q(0,1,v0,v1,c);}
      q(0,.4,6/13,1,BLUE);}
    else if(f.kind==='pr'){
      // Five stripes cut by the hoist triangle (equilateral on the hoist, tip at 0.866·H), no two colours in one place;
      // the white star on both faces, 2 cm off the triangle like the saltire.
      const tip=.866*H/W,ue=v=>tip*(1-Math.abs(2*v-1)),PT=(u,v,z=0)=>[X(u),y0+v*H,Zw(u)+z],N=[0,0,1];
      for(let r=0;r<5;r++){const v0=r/5,v1=(r+1)/5,c=r%2?WHITE:RED;
        if(r===2){plain.quad(PT(ue(v0),v0),PT(1,v0),PT(1,.5),PT(tip,.5),c,N);plain.quad(PT(tip,.5),PT(1,.5),PT(1,v1),PT(ue(v1),v1),c,N);}
        else plain.quad(PT(ue(v0),v0),PT(1,v0),PT(1,v1),PT(ue(v1),v1),c,N);}
      plain.tri(PT(0,0),PT(tip,.5),PT(0,1),SKY,N);
      for(const z of [.02,-.02]){const cu=tip/3,R=.2*H,S=k=>{const a=Math.PI/2+k*Math.PI/5,r=k%2?R*.382:R;return PT(cu+Math.cos(a)*r/W,.5+Math.sin(a)*r/H,z);};
        for(let k=0;k<10;k+=2)plain.quad(PT(cu,.5,z),S(k+9),S(k),S(k+1),WHITE,[0,0,z>0?1:-1]);}}
    else {q(0,1,0,1,WHITE);
      // Ragged red saltire (Cross of Burgundy) on both faces, 2 cm off the field.
      for(const z of [.02,-.02])for(const [a,b2] of [[[0,0],[1,1]],[[0,1],[1,0]]]){const w2=.09;
        const P=(p)=>[X(p[0]),y0+p[1]*H,Zw(p[0])+z];
        plain.quad(P([a[0],a[1]-w2]),P([b2[0],b2[1]-w2]),P([b2[0],b2[1]+w2]),P([a[0],a[1]+w2]),RED,[0,0,z>0?1:-1]);}}}
  // ---- Meshes: one textured masonry batch per fort, one plain batch (iron, flags, render). ----
  const material=mat({map:masonryTexture(textures),vertexColors:true,roughness:.93,metalness:0});
  const plainMat=mat({vertexColors:true,roughness:.8,metalness:0,side:THREE.DoubleSide});
  for(const [set,mtl,cast,tag] of [[buffers,material,true,''],[detailB,material,false,'-detail'],[plainB,plainMat,true,'-plain'],[plainD,plainMat,false,'-plain-detail']])
    for(const [key,buf] of Object.entries(set)){if(!buf.count)continue;
      const g=own(buf.geometry()),m=new THREE.Mesh(g,mtl);m.name='sj-forttops-'+key+tag;m.castShadow=cast;m.receiveShadow=true;scene.add(m);meshes.push(m);
      stats[key+tag]=buf.count/3;}
  void box;void sphere;void drawGarita;
  return stats;
}
