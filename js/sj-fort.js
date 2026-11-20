/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// El Morro exterior visuals — © 2026 VibezZzCoder, MIT. Wikimedia Commons curid=72603185 (esplanade/land front, merlons, garita), curid=122907842 (main
// entrance), curid=123485577 (Atlantic walls), curid=148962402, curid=148962401 (2024 aerials: massing, lighthouse, path), curid=34389396, curid=34389747 (HABS: moat, bridge arches,
// lighthouse, garita), curid=136301888 (garita). All dimensions come from sj-fort-layout.js, which owns the matching solids/tops.
import * as THREE from 'three/webgpu';
import {surfaceBuffer,drawGarita,masonryTexture} from './sj-gate.js';

const OCHRE='#b8935f',PALE='#cdb994',GREY='#958c7b',WOOD='#7a5536',IRON='#1f2523',WHITE='#ece6d6',LANTERN='#2a2f30';

export function buildFort(fort,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}) {
  const {frame:{P,ax,az,px,pz},constants:{PARAPET,PLINTH,MERLON,ENTRANCE,BRIDGE}}=fort;
  const masonry=surfaceBuffer(),up=[0,1,0];
  const W=(s,key,y)=>[s[key][0],y,s[key][1]];
  const lerp=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
  // Wikimedia Commons curid=72603185, curid=122907842, curid=148962402, curid=148962401: darker grey-brown rubble with warm ochre render patches and pale lime streaks; the slow along-wall
  // variation and a few broad ochre patches break up texture repetition. Wikimedia Commons curid=34389396: a rounded cordón under the parapet.
  // First render read chocolate-brown against Wikimedia Commons curid=72603185, curid=122907842, curid=34389396: lighter grey stone, ochre only in broad patches.
  const tone=s=>{const k=.9+.1*Math.sin(s.s*.29)*Math.sin(s.s*.07+.8),warm=Math.max(0,Math.sin(s.s*.045+1.7))**3;
    const c=new THREE.Color('#d2cbbb').lerp(new THREE.Color('#d9b884'),warm*.7).multiplyScalar(k);
    return [c.clone().multiplyScalar(.84),c];};
  const merlonRuns=[];
  for(const {a,b,run} of fort.walls){
    const n=[a.nx,0,a.nz],ni=[-a.nx,0,-a.nz],[ab,at]=tone(a),[bb,bt]=tone(b);
    masonry.quad(W(a,'B',a.bottom),W(b,'B',b.bottom),W(b,'T',b.crest),W(a,'T',a.crest),[ab,bb,bt,at],n,3.4);
    masonry.quad(W(a,'LB',a.bottom),W(b,'LB',b.bottom),W(b,'L',b.base+PLINTH.rise),W(a,'L',a.base+PLINTH.rise),'#a99f8c',n);
    masonry.quad(W(a,'L',a.base+PLINTH.rise),W(b,'L',b.base+PLINTH.rise),W(b,'F',b.base+PLINTH.rise),W(a,'F',a.base+PLINTH.rise),'#a99f8c',up);
    // Rounded cordón: four facets from the face top out to C and back in to the parapet foot.
    const T=(s,f)=>lerp(s.T,s.C,f),cord=[[0,-.16],[.7,-.1],[1,0],[.7,.1],[0,.16]];
    for(let i=0;i<4;i++){const [f0,y0]=cord[i],[f1,y1]=cord[i+1],pa=T(a,f0),pb=T(b,f0),qa=T(a,f1),qb=T(b,f1);
      masonry.quad([pa[0],a.crest+y0,pa[1]],[pb[0],b.crest+y0,pb[1]],[qb[0],b.crest+y1,qb[1]],[qa[0],a.crest+y1,qa[1]],'#cfc4ad',[n[0],(y0+y1)*4,n[2]]);}
    const pa=a.walk+PARAPET.rise,pb=b.walk+PARAPET.rise,mid=q=>[(q.T[0]+q.Q[0])/2,(q.T[1]+q.Q[1])/2],ma=mid(a),mb=mid(b);
    masonry.quad(W(a,'T',a.crest+.16),W(b,'T',b.crest+.16),W(b,'T',pb),W(a,'T',pa),[at,bt,bt,at],n);
    masonry.quad(W(a,'T',pa),W(b,'T',pb),[mb[0],pb+.08,mb[1]],[ma[0],pa+.08,ma[1]],'#b8ae9b',[n[0]*.4,1,n[2]*.4]);
    masonry.quad([ma[0],pa+.08,ma[1]],[mb[0],pb+.08,mb[1]],W(b,'Q',pb),W(a,'Q',pa),'#b8ae9b',[ni[0]*.4,1,ni[2]*.4]);
    masonry.quad(W(a,'Q',pa),W(b,'Q',pb),W(b,'Q',b.walk),W(a,'Q',a.walk),'#cfc6b4',ni);
    masonry.quad(W(a,'Q',a.walk),W(b,'Q',b.walk),W(b,'W',b.walk),W(a,'W',a.walk),'#9d968a',up,1.6);
    masonry.quad(W(a,'W',a.walk),W(b,'W',b.walk),W(b,'W',b.kerb),W(a,'W',a.kerb),'#b9b0a0',ni);
    merlonRuns.push({a,b,run,pa,pb});
  }
  for(const {s,dir} of fort.ends){
    const t=[dir*s.nz,0,-dir*s.nx];
    masonry.quad(W(s,'B',s.bottom),W(s,'W',s.bottom),W(s,'W',s.walk),W(s,'T',s.walk),'#bdb19b',t);
    masonry.quad(W(s,'T',s.walk),W(s,'Q',s.walk),W(s,'Q',s.walk+PARAPET.rise),W(s,'T',s.walk+PARAPET.rise),'#bdb19b',t);
  }
  // Merlons with embrasures (Wikimedia Commons curid=72603185 land front; Wikimedia Commons curid=34389747 by the lighthouse; Wikimedia Commons curid=123485577 lower and sloped seaward). Wikimedia Commons curid=122907842:
  // the curtain either side of the entrance has a plain parapet. Each merlon spans whole station intervals' sub-spans.
  // The plain curtain is centred on the entrance station itself (the first version used the start of the segment ending
  // at the gate, 29 m off, so merlons stood right beside the doorway).
  let gateS=0;{let best=Infinity;for(const g of fort.runs[0].segs)for(const s of g.stations){const d=Math.hypot(s.x-fort.frame.origin[0],s.z-fort.frame.origin[1]);if(d<best){best=d;gateS=s.s;}}}
  for(const {a,b,run,pa,pb} of merlonRuns){
    const rise0=run==='land'?MERLON.rise:.55,period=MERLON.length+MERLON.gap;
    if(run==='land'&&Math.max(Math.abs(a.s-gateS),Math.abs(b.s-gateS))<14)continue;
    if(b.s-a.s<1e-6)continue;
    for(let m=Math.floor(a.s/period)*period;m<b.s;m+=period){const s0=Math.max(a.s,m),s1=Math.min(b.s,m+MERLON.length);if(s1-s0<.05)continue;
      // Faces start at the coping's edges (pa), not its ridge (+8 cm): showed sky under every merlon.
      const f0=(s0-a.s)/(b.s-a.s),f1=(s1-a.s)/(b.s-a.s),y0=pa+(pb-pa)*f0,y1=pa+(pb-pa)*f1,n=[a.nx,0,a.nz],rise=rise0+.08;
      const T0=lerp(a.T,b.T,f0),T1=lerp(a.T,b.T,f1),Q0=lerp(a.Q,b.Q,f0),Q1=lerp(a.Q,b.Q,f1);
      const t0=[T0[0],y0,T0[1]],t1=[T1[0],y1,T1[1]],q0=[Q0[0],y0,Q0[1]],q1=[Q1[0],y1,Q1[1]];
      const T0u=[T0[0],y0+rise,T0[1]],T1u=[T1[0],y1+rise,T1[1]],Q0u=[Q0[0],y0+rise*.82,Q0[1]],Q1u=[Q1[0],y1+rise*.82,Q1[1]];
      masonry.quad(t0,t1,T1u,T0u,'#cdc3ae',n);masonry.quad(q1,q0,Q0u,Q1u,'#cdc3ae',[-n[0],0,-n[2]]);
      masonry.quad(T0u,T1u,Q1u,Q0u,'#d6cdb9',[n[0]*.15,1,n[2]*.15]);
      const tan=[b.T[0]-a.T[0],0,b.T[1]-a.T[1]];
      if(s0>a.s+1e-6||m>=a.s)masonry.quad(q0,t0,T0u,Q0u,'#c4b9a2',tan.map(v=>-v));
      if(s1<b.s-1e-6)masonry.quad(t1,q1,Q1u,T1u,'#c4b9a2',tan);}
  }
  for(const g of fort.garitas)drawGarita(masonry,g,{bake,cylinder,sphere,box},'#d9d0bd','#a99f8b');

  // Entrance frontispiece (Wikimedia Commons curid=122907842 crop ratios; Wikimedia Commons curid=34389396, curid=34389747): ochre stone body, paired pilasters with bases, architrave,
  // frieze with roundels, cornice and pediment; white crowned shield over a voussoir arch. Doors CLOSED (scope note).
  const e=fort.entrance,y0=e.deckY,{uFront}=e,uBody=Math.max(e.uBack,uFront+.8),ry=Math.atan2(-ax,-az);
  const P3=(u,v,y)=>{const [x,z]=P(u,v);return [x,y,z];};
  // Ordered bounds: a negative instance scale reverses the winding ( found mirrored quoins at San Cristóbal).
  const block=(u0,u1,v0,v1,ya,yb,colour)=>{[u0,u1]=[Math.min(u0,u1),Math.max(u0,u1)];[v0,v1]=[Math.min(v0,v1),Math.max(v0,v1)];[ya,yb]=[Math.min(ya,yb),Math.max(ya,yb)];
    bake(box,...P3((u0+u1)/2,(v0+v1)/2,(ya+yb)/2),v1-v0,yb-ya,u1-u0,colour,ry,'solid');};
  // Textured masonry block (front, top, bottom, sides; the back face is buried in the facade).
  const mblock=(u0,u1,v0,v1,ya,yb,colour,scale=2.2)=>{[v0,v1]=[Math.min(v0,v1),Math.max(v0,v1)];const o=out,pv=[px,0,pz],nv=[-px,0,-pz];
    masonry.quad(P3(u0,v0,ya),P3(u0,v1,ya),P3(u0,v1,yb),P3(u0,v0,yb),colour,o,scale);
    masonry.quad(P3(u0,v0,yb),P3(u0,v1,yb),P3(u1,v1,yb),P3(u1,v0,yb),colour,up,scale);masonry.quad(P3(u0,v0,ya),P3(u1,v0,ya),P3(u1,v1,ya),P3(u0,v1,ya),colour,[0,-1,0],scale);
    masonry.quad(P3(u0,v1,ya),P3(u1,v1,ya),P3(u1,v1,yb),P3(u0,v1,yb),colour,pv,scale);masonry.quad(P3(u0,v0,ya),P3(u0,v0,yb),P3(u1,v0,yb),P3(u1,v0,ya),colour,nv,scale);};
  const out=[-ax,0,-az],H=ENTRANCE.half,oh=ENTRANCE.openHalf,sp=y0+ENTRANCE.spring,arc=(r,steps)=>Array.from({length:steps+1},(_,i)=>{const t=Math.PI*i/steps;return [Math.cos(t)*r,Math.sin(t)*r];});
  // Segmental arch (Wikimedia Commons curid=122907842): circle through (±oh, spring) and (0, spring+rise); points from +oh over the top to −oh.
  const R=(oh*oh+ENTRANCE.rise**2)/(2*ENTRANCE.rise),cy=ENTRANCE.rise-R,a0=Math.asin(oh/R);
  const seg=(dr,steps)=>Array.from({length:steps+1},(_,i)=>{const t=a0-2*a0*i/steps;return [Math.sin(t)*(R+dr),cy+Math.cos(t)*(R+dr)];});
  {const shape=new THREE.Shape([[-H,e.portalBottom],[H,e.portalBottom],[H,y0+ENTRANCE.architrave],[-H,y0+ENTRANCE.architrave]].map(([v,y])=>new THREE.Vector2(v,y)));
    shape.holes.push(new THREE.Path([[-oh,y0-.02],[oh,y0-.02],...seg(0,10).map(([v,h])=>[v,sp+h])].map(([v,y])=>new THREE.Vector2(v,y))));
    const g=new THREE.ShapeGeometry(shape),pos=g.attributes.position,idx=g.index;
    for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return P3(uFront,pos.getX(j),pos.getY(j));});masonry.tri(q[0],q[1],q[2],OCHRE,out,2.2);}
    g.dispose();}
  for(const s of [-1,1])masonry.quad(P3(uFront,s*H,e.portalBottom),P3(uBody,s*H,e.portalBottom),P3(uBody,s*H,y0+ENTRANCE.architrave),P3(uFront,s*H,y0+ENTRANCE.architrave),OCHRE,[s*px,0,s*pz],2.2);
  // Reveal (jambs + intrados) to the closed doors, then the studded leaves with a dark meeting line.
  const ud=uFront+ENTRANCE.door,ring=[[oh,y0-.02],...seg(0,10).map(([v,h])=>[v,sp+h]),[-oh,y0-.02]];
  for(let i=0;i+1<ring.length;i++){const [v0,h0]=ring[i],[v1,h1]=ring[i+1],mv=(v0+v1)/2,mh=(h0+h1)/2-(sp+cy);
    masonry.quad(P3(uFront,v0,h0),P3(ud,v0,h0),P3(ud,v1,h1),P3(uFront,v1,h1),PALE,[-mv*px,-(mh>0?mh:0),-mv*pz],2.2);}
  {const shape=new THREE.Shape(ring.map(([v,y])=>new THREE.Vector2(v,y)));const g=new THREE.ShapeGeometry(shape),pos=g.attributes.position,idx=g.index;
    for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return P3(ud,pos.getX(j),pos.getY(j));});masonry.tri(q[0],q[1],q[2],WOOD,out,1.2);}
    g.dispose();}
  // Closed leaves must read as a real end, not a dark passage: lighter timber, plank joints,
  // three iron straps per leaf and studs.
  block(ud-.05,ud,-.035,.035,y0,sp+ENTRANCE.rise-.05,IRON);
  for(const v of [-1.05,-.7,-.35,.35,.7,1.05])block(ud-.025,ud,v-.012,v+.012,y0+.05,sp+cy+Math.sqrt(R*R-v*v)-.08,'#4a3222');
  for(const h of [.45,1.45,2.45])block(ud-.05,ud,-oh+.08,oh-.08,y0+h,y0+h+.09,IRON);
  for(let j=0;j<5;j++)for(const v of [-.95,-.45,.45,.95])block(ud-.06,ud,v-.035,v+.035,y0+.95+j*.4-.035,y0+.95+j*.4+.035,IRON);
  // Voussoir ring and keystone around the arch (pale stone), plinth course and the paired pilasters with bases/capitals.
  // Voussoirs are 6 cm proud: their outer/inner edges and the keystone's sides are closed back to the facade.
  {const inner=seg(.02,9),Q=(p,u)=>P3(u,p[0],sp+p[1]);
    for(let i=0;i<9;i++){const k=i===4?.16:0,o0=seg(.42+k,9)[i],o1=seg(.42+k,9)[i+1],c=i%2?'#d9c69d':'#cbb48a';
      masonry.quad(...[inner[i],o0,o1,inner[i+1]].map(p=>Q(p,uFront-.06)),c,out,1.2);
      const om=[(o0[0]+o1[0])/2,0,(o0[1]+o1[1])/2-cy],im=[(inner[i][0]+inner[i+1][0])/2,(inner[i][1]+inner[i+1][1])/2-cy];
      masonry.quad(Q(o0,uFront-.06),Q(o1,uFront-.06),Q(o1,uFront),Q(o0,uFront),c,[om[0]*px,om[2],om[0]*pz],1.2);
      masonry.quad(Q(inner[i],uFront-.06),Q(inner[i+1],uFront-.06),Q(inner[i+1],uFront),Q(inner[i],uFront),c,[-im[0]*px,-im[1],-im[0]*pz],1.2);
      if(k)for(const [j,p] of [[i,o0],[i+1,o1]]){const q=seg(.42,9)[j];masonry.quad(Q(q,uFront-.06),Q(p,uFront-.06),Q(p,uFront),Q(q,uFront),c,j===i?[px,0,pz]:[-px,0,-pz],1.2);}}}
  // Plinth course: textured, and open across the doorway (no 0.45 m sill in front of the doors).
  for(const [v0,v1] of [[-H,-oh-.02],[oh+.02,H]])mblock(uFront-.14,uFront,v0,v1,e.portalBottom,y0+.45,'#b9ad97');
  for(const s of [-1,1])for(const c of ENTRANCE.pilasters){const v0=s*c-ENTRANCE.pilasterHalf,v1=s*c+ENTRANCE.pilasterHalf;
    block(uFront-.24,uFront,v0-.06,v1+.06,y0+.45,y0+.95,GREY);block(uFront-.18,uFront,v0,v1,y0+.95,y0+ENTRANCE.architrave-.3,'#968b77');
    block(uFront-.26,uFront,v0-.07,v1+.07,y0+ENTRANCE.architrave-.3,y0+ENTRANCE.architrave,'#b7a583');}
  // Crowned shield (Wikimedia Commons curid=122907842: white, ~1.2 × 1.9 m) between the arch and the architrave.
  bake(sphere,...P3(uFront-.12,0,y0+4.7),.6,.85,.16,'#efebe1',ry,'solid');bake(sphere,...P3(uFront-.16,0,y0+4.62),.42,.6,.12,'#f4f1e8',ry,'solid');
  // Crown (a separate floating bar): a band seated on the shield top (≈1 cm overlap at its ends,
  // 7 cm at the centre) and 3 cm into the wall, with three points; top stays under the architrave.
  {const cyc=y0+5.48;block(uFront-.16,uFront+.03,-.22,.22,cyc,cyc+.14,'#efebe1');
    for(const v of [-.15,0,.15])bake(sphere,...P3(uFront-.09,v,cyc+.2),.07,v?.11:.15,.07,'#efebe1',ry,'solid');}
  // Entablature: architrave, frieze with seven roundels, projecting cornice (Wikimedia Commons curid=122907842; tones warmed/darkened after the
  // side-by-side comparison read the first pass as pale cream).
  block(uFront-.22,uBody,-H-.15,H+.15,y0+ENTRANCE.architrave,y0+ENTRANCE.frieze,'#b9a37c');
  block(uFront-.16,uBody,-H-.1,H+.1,y0+ENTRANCE.frieze,y0+ENTRANCE.cornice-.3,'#c0a981');
  // Roundels face out of the facade (local +Z after ry): a disc pre-rotated once, baked seven times.
  const disc=own(new THREE.CylinderGeometry(.21,.21,.07,14));disc.rotateX(Math.PI/2);
  for(let i=0;i<7;i++){const v=-H+.55+i*(2*H-1.1)/6;bake(disc,...P3(uFront-.19,v,y0+(ENTRANCE.frieze+ENTRANCE.cornice-.3)/2),1,1,1,'#d3c19c',ry,'solid');}
  block(uFront-.42,uBody,-H-.45,H+.45,y0+ENTRANCE.cornice-.3,y0+ENTRANCE.cornice,'#c8b48d');
  // Pediment: recessed tympanum and raking cornices up to the apex.
  {const base=y0+ENTRANCE.cornice,apex=y0+ENTRANCE.apex,hw=H+.45;
    const tri=(u,c,shrink=0)=>{const a=P3(u,-hw+shrink,base),b=P3(u,hw-shrink,base),t=P3(u,0,apex-shrink*.5);masonry.tri(a,b,t,c,out,2.2);};
    tri(uFront-.42,'#c9b48c');tri(uFront-.3,'#d3bf98',.55);
    for(const s of [-1,1]){const a=P3(uFront-.42,s*hw,base),t=P3(uFront-.42,0,apex),a2=P3(uBody,s*hw,base),t2=P3(uBody,0,apex);
      masonry.quad(a,t,t2,a2,'#cfbf9f',[s*px*.6,1,s*pz*.6],2.2);}}
  // Pediment back (seen above the curtain parapet from the wall walk) and the body's top behind the cornice.
  {const base=y0+ENTRANCE.cornice,apex=y0+ENTRANCE.apex,hw=H+.45;masonry.tri(P3(uBody,hw,base),P3(uBody,-hw,base),P3(uBody,0,apex),'#c9b897',[ax,0,az],2.2);}

  // Bridge (Wikimedia Commons curid=34389747, curid=122907842): masonry side walls with arched moat faces, pale coping; deck drawn as sett with the floors.
  const b=fort.bridge,oH=b.outerHalf;
  for(const {side,list} of b.sides)for(const seg of list){
    const nO=[side*px,0,side*pz],nI=[-side*px,0,-side*pz],c=tone({s:seg.u0*3});
    const ta=seg.topA??seg.top,tb=seg.topB??seg.top,iH=BRIDGE.half-.05,xH=oH+.05;
    masonry.quad(P3(seg.u0,side*oH,seg.bottom),P3(seg.u1,side*oH,seg.bottom),P3(seg.u1,side*oH,tb-.12),P3(seg.u0,side*oH,ta-.12),c[1],nO,3.0);
    masonry.quad(P3(seg.u0,side*BRIDGE.half,b.deckY-.05),P3(seg.u1,side*BRIDGE.half,b.deckY-.05),P3(seg.u1,side*BRIDGE.half,tb-.12),P3(seg.u0,side*BRIDGE.half,ta-.12),'#c9bfac',nI,2.4);
    // Coping: top, both fascias and both soffits, one continuous strip (joint heights shared with the neighbours).
    masonry.quad(P3(seg.u0,side*iH,ta),P3(seg.u1,side*iH,tb),P3(seg.u1,side*xH,tb),P3(seg.u0,side*xH,ta),'#ddd3bf',up,1.4);
    for(const [v,n] of [[xH,nO],[iH,nI]])masonry.quad(P3(seg.u0,side*v,ta-.12),P3(seg.u1,side*v,tb-.12),P3(seg.u1,side*v,tb),P3(seg.u0,side*v,ta),'#ddd3bf',n,1.4);
    for(const [v0,v1] of [[oH,xH],[iH,BRIDGE.half]])masonry.quad(P3(seg.u0,side*v0,ta-.12),P3(seg.u1,side*v0,tb-.12),P3(seg.u1,side*v1,tb-.12),P3(seg.u0,side*v1,ta-.12),'#cfc5b1',[0,-1,0],1.4);
  }
  for(const {side,list} of b.sides){const s0=list[0],t=[-ax,0,-az];
    const t0=s0.topA??s0.top;masonry.quad(P3(b.uStart,side*BRIDGE.half,s0.bottom),P3(b.uStart,side*oH,s0.bottom),P3(b.uStart,side*oH,t0-.12),P3(b.uStart,side*BRIDGE.half,t0-.12),'#c9bfac',t,2.4);
    masonry.quad(P3(b.uStart,side*(BRIDGE.half-.05),t0-.12),P3(b.uStart,side*(oH+.05),t0-.12),P3(b.uStart,side*(oH+.05),t0),P3(b.uStart,side*(BRIDGE.half-.05),t0),'#ddd3bf',t,1.4);}
  // Moat floor bands beside the bridge (grass, Wikimedia Commons curid=34389396, curid=34389747) and their end skirts (masonry, kept terrain above).
  if(b.bandTriangles.length){const flat=b.bandTriangles.flat(),cx=flat.reduce((s,p)=>s+p[0],0)/flat.length,cz=flat.reduce((s,p)=>s+p[2],0)/flat.length;
    // Stairs band triangles under the mapped concrete footway (bandPaved) in the paving tone, the rest grass.
    for(const paved of [false,true]){const pos=[];for(const [ti,tri] of b.bandTriangles.entries()){if(!!b.bandPaved?.[ti]!==paved)continue;const [p,q,w]=tri,cr=(q[0]-p[0])*(w[2]-p[2])-(q[2]-p[2])*(w[0]-p[0]);
      // Lift only off the exact kept terrain (a lifted outer edge leaves a 4 mm slot to the void; San Cristóbal ramp bands).
      for(const v of cr<0?[p,q,w]:[p,w,q])pos.push(v[0]-cx,v[1]+(Math.abs(v[1]-height(v[0],v[2]))<1e-4?0:.004),v[2]-cz);}
    if(!pos.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
    bake(g,cx,0,cz,1,1,1,paved?'#c8bfaa':'#7e9866',0,'solid');g.dispose();}}
  for(const sk of b.bandSkirts){const hint=[-sk.dir*ax,0,-sk.dir*az];
    for(let i=0;i+1<sk.rows.length;i++){const [a0,a1]=sk.rows[i],[b0,b1]=sk.rows[i+1];if(a1[1]-a0[1]<.003&&b1[1]-b0[1]<.003)continue;
      masonry.quad(a0,b0,b1,a1,'#b5ab98',hint,2.4);}}
  for(const a of b.arches){const nO=[a.side*px,0,a.side*pz],v=a.side*(oH+.04),r=(a.u1-a.u0)/2,uc=(a.u0+a.u1)/2;
    const shape=new THREE.Shape([[-r,a.ground-.3],[r,a.ground-.3],...arc(r,10).map(([x,h])=>[x,a.spring+h])].map(([x,y])=>new THREE.Vector2(x,y)));
    const g=new THREE.ShapeGeometry(shape),pos=g.attributes.position,idx=g.index;
    for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return P3(uc+pos.getX(j),v,pos.getY(j));});masonry.tri(q[0],q[1],q[2],'#2d2b27',nO,2);}
    g.dispose();
    for(let i=0;i<7;i++){const t0=Math.PI*i/7,t1=Math.PI*(i+1)/7,r1=r+.32;
      masonry.quad(...[[t0,r],[t0,r1],[t1,r1],[t1,r]].map(([t,rr])=>P3(uc+Math.cos(t)*rr,v+a.side*.02,a.spring+Math.sin(t)*rr)),'#d3c7ad',nO,1.2);}}

  // Lighthouse (Wikimedia Commons curid=148962402, curid=148962401, curid=34389396, curid=34389747): plinth, square body with string course and arched windows, cornice, merloned gallery with
  // pinnacle turrets, dark lantern drum, dome and vane.
  {const l=fort.lighthouse,ryL=Math.atan2(-l.uz,l.ux),L=(a,d,y)=>[l.x+l.ux*a+l.nx*d,y,l.z+l.uz*a+l.nz*d],y=l.y,hw=l.half;
    const lb=(a,d,yy,w,h,dd,c)=>bake(box,...L(a,d,yy),w,h,dd,c,ryL,'solid');
    lb(0,0,(l.bottom+y+.35)/2,2*hw+.3,y+.35-l.bottom,2*hw+.3,'#c9c1ad');
    lb(0,0,y+.35+(l.body-.35)/2,2*hw,l.body-.35,2*hw,WHITE);
    lb(0,0,y+3.7,2*hw+.14,.18,2*hw+.14,'#ded7c6');lb(0,0,y+l.body+.17,2*hw+.5,.34,2*hw+.5,'#e2dccb');
    // Gallery walls along the a-axis (faces ±d) and the d-axis (faces ±a), each with two small merlons.
    for(const s of [-1,1]){lb(0,s*(hw+.15),y+l.body+.74,2*hw+.5,.8,.2,WHITE);lb(s*(hw+.15),0,y+l.body+.74,.2,.8,2*hw+.1,WHITE);
      for(const k of [-.55,.55]){lb(k*hw,s*(hw+.15),y+l.body+1.32,.55,.36,.22,WHITE);lb(s*(hw+.15),k*hw,y+l.body+1.32,.22,.36,.55,WHITE);}}
    const cone=own(new THREE.ConeGeometry(.36,.62,8));
    for(const [a,d] of [[1,1],[1,-1],[-1,1],[-1,-1]]){bake(cylinder,...L(a*(hw+.1),d*(hw+.1),y+l.body+.34+.7),.3,1.4,.3,WHITE,0,'solid');
      bake(cone,...L(a*(hw+.1),d*(hw+.1),y+l.body+.34+1.4+.31),1,1,1,'#e6e0d0',0,'solid');}
    for(const [a,d,f] of [[0,hw+.02,0],[0,-hw-.02,0],[hw+.02,0,1],[-hw-.02,0,1]])for(const yy of [2.2,5.5])
      bake(box,...L(a,d,y+yy),f?.06:.6,1.1,f?.6:.06,'#3b3e3c',ryL,'facade');
    const top=y+l.body+.34;
    bake(cylinder,...L(0,0,top+.3),1.25,.6,1.25,WHITE,0,'solid');bake(cylinder,...L(0,0,top+.64),1.32,.08,1.32,LANTERN,0,'solid');
    bake(cylinder,...L(0,0,top+.68+1.0),1.0,2.0,1.0,LANTERN,0,'solid');
    bake(sphere,...L(0,0,top+2.68),1.05,.62,1.05,LANTERN,0,'solid');
    bake(cylinder,...L(0,0,top+3.5),.05,1.0,.05,IRON,0,'solid');bake(sphere,...L(0,0,top+3.35),.14,.14,.14,LANTERN,0,'solid');}

  // Esplanade benches (OSM, no backrest): concrete slab on two legs facing the turning circle.
  for(const bn of fort.benches){const f=(u,y,d=0)=>[bn.x+Math.cos(bn.heading)*u+Math.sin(bn.heading)*d,y,bn.z-Math.sin(bn.heading)*u+Math.cos(bn.heading)*d];
    for(const l of bn.legs){const lo=l.ground-.05,hi=bn.y+bn.height-.08;bake(box,...f(l.u,(lo+hi)/2),.16,hi-lo,.4,'#bdb6a8',bn.heading,'solid');}
    bake(box,...f(0,bn.y+bn.height-.04),bn.width,.08,bn.depth,'#cfc9bb',bn.heading,'solid');}

  // Stairs mapped flights drawn as real uniform treads (support and wheel seat: js/sj-stairs.js).
  for(const f of fort.stairs??[]){const ry=Math.atan2(f.frame.dx,f.frame.dz),N_=f.nosing;
    for(const {a,b,normal} of f.edgeFaces??[]){const low=p=>[p[0],p[1]-.4,p[2]];
      masonry.quad(a,b,low(b),low(a),'#ada08b',normal);}
    for(const t of f.treads){const len=t.s1-t.s0+(t.nosing?.02:0),c=t.quad.reduce((q,p)=>[q[0]+p[0]/4,q[1]+p[1]/4],[0,0]),off=t.nosing?.01:0;
      const cx=c[0]+f.frame.dx*off,cz=c[1]+f.frame.dz*off;bake(box,cx,(f.low+t.top)/2,cz,f.width,t.top-f.low,len,'#bdb6a8',ry,'solid');
      if(t.nosing){const sN=t.s0-N_.out+N_.depth/2,mid=(t.s0+t.s1)/2,nx_=cx+f.frame.dx*(sN-mid-off),nz_=cz+f.frame.dz*(sN-mid-off);
        bake(box,nx_,t.top+N_.up-.015,nz_,f.width+.01,.03,N_.depth,'#cfc8ba',ry,'facade');}}
    // Fitted aprons (module): drawn exactly as their physical facets, in the tread stone.
    if(f.aprons?.length){const pos=[];for(const tri of f.aprons){const [p,q,w]=tri,cr=(q[0]-p[0])*(w[2]-p[2])-(q[2]-p[2])*(w[0]-p[0]);for(const v of cr<0?[p,q,w]:[p,w,q])pos.push(...v);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();bake(g,0,0,0,1,1,1,'#bdb6a8',0,'solid');g.dispose();}}
  // Paseo end gate: two masonry posts with caps and a closed black iron gate (rails, bars, finials).
  if(fort.paseoGate){const g=fort.paseoGate,r=g.rotation,at=(s,y)=>[g.x+g.nx*s,y,g.z+g.nz*s];
    for(const p of g.posts){bake(box,p.x,(p.y-.2+g.y+1.75)/2,p.z,.5,g.y+1.75-(p.y-.2),.5,'#c9bfac',r,'solid');
      bake(box,p.x,g.y+1.83,p.z,.62,.16,.62,'#ddd3bf',r,'solid');}
    const w=2*g.half-.5;
    for(const y of [.18,.95,1.48])bake(box,...at(0,g.y+y),w,.06,.06,IRON,r,'solid');
    for(let i=0;i<=16;i++){const s=-w/2+.06+i*(w-.12)/16;bake(box,...at(s,g.y+.85),.035,1.55,.035,IRON,r,'solid');
      if(i%2===0)bake(sphere,...at(s,g.y+1.66),.05,.07,.05,IRON,0,'solid');}}
  const material=mat({map:masonryTexture(textures),vertexColors:true,roughness:.93,metalness:0});
  const g=own(masonry.geometry()),m=new THREE.Mesh(g,material);m.name='sj-plaza-fort-masonry';m.castShadow=true;m.receiveShadow=true;scene.add(m);meshes.push(m);
  return {masonryTriangles:masonry.count/3,garitas:fort.garitas.length,arches:b.arches.length};
}
