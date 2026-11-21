/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// San Cristóbal exterior / Plaza Colón visuals — © 2026 VibezZzCoder, MIT. Wikimedia Commons curid=82861896, curid=34390675 (dark battered faces, cordón,
// garita), curid=124496780 (curved entrance ramp: dark ashlar walls with a heavy rounded coping), curid=49414779 (main gate), curid=11855283 (aerial massing),
// curid=127996363, curid=71286745, curid=31949754 (Plaza Colón: column, stair, cascade basins, round balustraded bastion, globe lamps, broadleaf trees).
// All dimensions come from sj-cristobal-layout.js, which owns the matching solids, deck tops and terrain cut.
import * as THREE from 'three/webgpu';
import { glowLamp } from './sj-glow.js';
import {surfaceBuffer,drawGarita,masonryTexture} from './sj-gate.js';
import {createStatueBuilder,statueFrame} from './sj-statues.js';

const GATE_STONE='#b2a283',QUOIN='#c9b994',WOOD='#7a5536',IRON='#1f2523',ASHLAR='#a8a397',COPING='#bdb8ad';
const OCHRE='#cfa365',OCHRE_DARK='#b78a52',PALE='#ddd4c0',MARBLE='#e9e5da',BRONZE='#5b4a33',WATER='#5f9198',FALL='#d4e6e8';

export function buildCristobal(c,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}) {
  void height;
  const {PARAPET,PLINTH,GATE}=c.constants,masonry=surfaceBuffer(),up=[0,1,0];
  const W=(s,key,y)=>[s[key][0],y,s[key][1]];
  const lerp=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
  function segment(a,b,r,colour,kind='solid') {
    const g=cylinder.clone(),d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    g.scale(r,d.length(),r);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));
    bake(g,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1,1,1,colour,0,kind);g.dispose();
  }
  // Wikimedia Commons curid=82861896, curid=11855283, curid=34390675: darker grey rubble than El Morro, with broad ochre patches (Wikimedia Commons curid=124496780's left wall, Wikimedia Commons curid=82861896's upper block).
  const tone=s=>{const k=.88+.12*Math.sin(s.s*.23)*Math.sin(s.s*.061+.4),warm=Math.max(0,Math.sin(s.s*.037+2.3))**3;
    const col=new THREE.Color('#b9b3a5').lerp(new THREE.Color('#cfae7c'),warm*.75).multiplyScalar(k);
    return [col.clone().multiplyScalar(.82),col];};
  // Wikimedia Commons curid=82861896: the outer work's walls read paler cream/ochre than the dark main fort.
  const paleTone=s=>{const k=.92+.08*Math.sin(s.s*.31),col=new THREE.Color('#dacfb4').lerp(new THREE.Color('#d6b47e'),Math.max(0,Math.sin(s.s*.05))**2*.6).multiplyScalar(k);
    return [col.clone().multiplyScalar(.85),col];};
  for(const {a,b,run} of c.walls){
    const n=[a.nx,0,a.nz],ni=[-a.nx,0,-a.nz],[ab,at]=(run==='terrace'?paleTone:tone)(a),[bb,bt]=(run==='terrace'?paleTone:tone)(b);
    masonry.quad(W(a,'B',a.bottom),W(b,'B',b.bottom),W(b,'T',b.crest),W(a,'T',a.crest),[ab,bb,bt,at],n,3.4);
    masonry.quad(W(a,'LB',a.bottom),W(b,'LB',b.bottom),W(b,'L',b.base+PLINTH.rise),W(a,'L',a.base+PLINTH.rise),'#99927f',n);
    masonry.quad(W(a,'L',a.base+PLINTH.rise),W(b,'L',b.base+PLINTH.rise),W(b,'F',b.base+PLINTH.rise),W(a,'F',a.base+PLINTH.rise),'#99927f',up);
    // Rounded cordón (Wikimedia Commons curid=34390675) and a plain sloped-top parapet (Wikimedia Commons curid=82861896, curid=124496780: no merlons on these fronts).
    const T=(s,f)=>lerp(s.T,s.C,f),cord=[[0,-.16],[.7,-.1],[1,0],[.7,.1],[0,.16]];
    for(let i=0;i<4;i++){const [f0,y0]=cord[i],[f1,y1]=cord[i+1],pa=T(a,f0),pb=T(b,f0),qa=T(a,f1),qb=T(b,f1);
      masonry.quad([pa[0],a.crest+y0,pa[1]],[pb[0],b.crest+y0,pb[1]],[qb[0],b.crest+y1,qb[1]],[qa[0],a.crest+y1,qa[1]],'#c2b9a4',[n[0],(y0+y1)*4,n[2]]);}
    const pa=a.walk+PARAPET.rise,pb=b.walk+PARAPET.rise,mid=q=>[(q.T[0]+q.Q[0])/2,(q.T[1]+q.Q[1])/2],ma=mid(a),mb=mid(b);
    masonry.quad(W(a,'T',a.crest+.16),W(b,'T',b.crest+.16),W(b,'T',pb),W(a,'T',pa),[at,bt,bt,at],n);
    masonry.quad(W(a,'T',pa),W(b,'T',pb),[mb[0],pb+.1,mb[1]],[ma[0],pa+.1,ma[1]],'#aea592',[n[0]*.4,1,n[2]*.4]);
    masonry.quad([ma[0],pa+.1,ma[1]],[mb[0],pb+.1,mb[1]],W(b,'Q',pb),W(a,'Q',pa),'#aea592',[ni[0]*.4,1,ni[2]*.4]);
    masonry.quad(W(a,'Q',pa),W(b,'Q',pb),W(b,'Q',b.walk),W(a,'Q',a.walk),'#c3baa6',ni);
    masonry.quad(W(a,'Q',a.walk),W(b,'Q',b.walk),W(b,'W',b.walk),W(a,'W',a.walk),'#958e81',up,1.6);
    masonry.quad(W(a,'W',a.walk),W(b,'W',b.walk),W(b,'W',b.kerb),W(a,'W',a.kerb),'#aca394',ni);
  }
  for(const {s,dir} of c.ends){const t=[dir*s.nz,0,-dir*s.nx];
    masonry.quad(W(s,'B',s.bottom),W(s,'W',s.bottom),W(s,'W',s.walk),W(s,'T',s.walk),'#a9a08c',t);
    masonry.quad(W(s,'T',s.walk),W(s,'Q',s.walk),W(s,'Q',s.walk+PARAPET.rise),W(s,'T',s.walk+PARAPET.rise),'#a9a08c',t);}
  for(const g of c.garitas)drawGarita(masonry,g,{bake,cylinder,sphere,box},'#d6cdb8','#a59c88');

  // Main gate (Wikimedia Commons curid=49414779): rusticated round-arched frontispiece, cornice, broken-pediment corners with ball finials. CLOSED.
  const {P,ax,az,px,pz}=c.frame,e=c.entrance,y0=e.deckY,H=GATE.half,oh=GATE.openHalf,sp=y0+GATE.spring,ry=Math.atan2(-ax,-az);
  const P3=(u,v,y)=>{const [x,z]=P(u,v);return [x,y,z];},out=[-ax,0,-az],uF=e.uFront,uB=e.uBack;
  // Ordered bounds (the left quoins had negative widths, so their back faces showed exactly in
  // the facade plane and shimmered). Textured relief blocks emit their visible faces into the masonry buffer.
  const block=(u0,u1,v0,v1,ya,yb,colour)=>{[u0,u1]=[Math.min(u0,u1),Math.max(u0,u1)];[v0,v1]=[Math.min(v0,v1),Math.max(v0,v1)];[ya,yb]=[Math.min(ya,yb),Math.max(ya,yb)];
    bake(box,...P3((u0+u1)/2,(v0+v1)/2,(ya+yb)/2),v1-v0,yb-ya,u1-u0,colour,ry,'solid');};
  const mblock=(u0,u1,v0,v1,ya,yb,colour,scale=2.2)=>{[v0,v1]=[Math.min(v0,v1),Math.max(v0,v1)];const pv=[px,0,pz],nv=[-px,0,-pz];
    masonry.quad(P3(u0,v0,ya),P3(u0,v1,ya),P3(u0,v1,yb),P3(u0,v0,yb),colour,out,scale);
    masonry.quad(P3(u0,v0,yb),P3(u0,v1,yb),P3(u1,v1,yb),P3(u1,v0,yb),colour,up,scale);masonry.quad(P3(u0,v0,ya),P3(u1,v0,ya),P3(u1,v1,ya),P3(u0,v1,ya),colour,[0,-1,0],scale);
    masonry.quad(P3(u0,v1,ya),P3(u1,v1,ya),P3(u1,v1,yb),P3(u0,v1,yb),colour,pv,scale);masonry.quad(P3(u0,v0,ya),P3(u0,v0,yb),P3(u1,v0,yb),P3(u1,v0,ya),colour,nv,scale);};
  const R=(oh*oh+GATE.rise**2)/(2*GATE.rise),cy=GATE.rise-R,a0=Math.asin(oh/R);
  const seg=(dr,steps)=>Array.from({length:steps+1},(_,i)=>{const t=a0-2*a0*i/steps;return [Math.sin(t)*(R+dr),cy+Math.cos(t)*(R+dr)];});
  {const shape=new THREE.Shape([[-H,e.bottom],[H,e.bottom],[H,y0+GATE.cornice],[-H,y0+GATE.cornice]].map(([v,y])=>new THREE.Vector2(v,y)));
    shape.holes.push(new THREE.Path([[-oh,y0-.02],[oh,y0-.02],...seg(0,10).map(([v,h])=>[v,sp+h])].map(([v,y])=>new THREE.Vector2(v,y))));
    const g=new THREE.ShapeGeometry(shape),pos=g.attributes.position,idx=g.index;
    for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return P3(uF,pos.getX(j),pos.getY(j));});masonry.tri(q[0],q[1],q[2],GATE_STONE,out,2.2);}
    g.dispose();}
  for(const s of [-1,1])masonry.quad(P3(uF,s*H,e.bottom),P3(uB,s*H,e.bottom),P3(uB,s*H,y0+GATE.cornice),P3(uF,s*H,y0+GATE.cornice),GATE_STONE,[s*px,0,s*pz],2.2);
  masonry.quad(P3(uF+.35,-H,y0+GATE.cornice),P3(uF+.35,H,y0+GATE.cornice),P3(uB,H,y0+GATE.cornice),P3(uB,-H,y0+GATE.cornice),'#a99c80',up,2.2);  // behind the cornice band
  const ud=e.uDoor,ring=[[oh,y0-.02],...seg(0,10).map(([v,h])=>[v,sp+h]),[-oh,y0-.02]];
  for(let i=0;i+1<ring.length;i++){const [v0,h0]=ring[i],[v1,h1]=ring[i+1],mv=(v0+v1)/2,mh=(h0+h1)/2-(sp+cy);
    masonry.quad(P3(uF,v0,h0),P3(ud,v0,h0),P3(ud,v1,h1),P3(uF,v1,h1),'#c4b593',[-mv*px,-(mh>0?mh:0),-mv*pz],2.2);}
  {const shape=new THREE.Shape(ring.map(([v,y])=>new THREE.Vector2(v,y)));const g=new THREE.ShapeGeometry(shape),pos=g.attributes.position,idx=g.index;
    for(let i=0;i<idx.count;i+=3){const q=[0,1,2].map(k=>{const j=idx.getX(i+k);return P3(ud,pos.getX(j),pos.getY(j));});masonry.tri(q[0],q[1],q[2],WOOD,out,1.2);}
    g.dispose();}
  // Closed leaves: plank joints, iron straps and studs (a real end, not a dark passage).
  block(ud-.05,ud,-.035,.035,y0,sp+GATE.rise-.05,IRON);
  for(const v of [-1.2,-.8,-.4,.4,.8,1.2])block(ud-.025,ud,v-.012,v+.012,y0+.05,sp+cy+Math.sqrt(R*R-v*v)-.08,'#4a3222');
  for(const h of [.5,1.6,2.7])block(ud-.05,ud,-oh+.08,oh-.08,y0+h,y0+h+.09,IRON);
  // Rusticated jambs and voussoirs (Wikimedia Commons curid=49414779: alternating long/short quoins), keystone, plinth course, cornice and attic.
  // Quoins: textured stone 7 cm proud, backs 2 cm into the facade (Wikimedia Commons curid=49414779's integrated rustication, not pasted tabs).
  for(const s of [-1,1])for(let k=0;k<6;k++){const ya=y0+.15+k*(GATE.spring-.15)/6,yb=ya+(GATE.spring-.15)/6-.05,w=k%2?.55:.85;
    mblock(uF-.07,uF+.02,s*oh,s*(oh+w),ya,yb,k%2?QUOIN:'#bfae89',1.4);}
  // Voussoirs 8 cm proud with their outer/inner edges and the keystone's sides closed back to the facade.
  {const inner=seg(.02,9),Q=(p,u)=>P3(u,p[0],sp+p[1]);
    for(let i=0;i<9;i++){const k=i===4?.25:0,o0=seg(.55+k,9)[i],o1=seg(.55+k,9)[i+1],c=i%2?QUOIN:'#bba985';
      masonry.quad(...[inner[i],o0,o1,inner[i+1]].map(p=>Q(p,uF-.08)),c,out,1.2);
      const om=[(o0[0]+o1[0])/2,(o0[1]+o1[1])/2-cy],im=[(inner[i][0]+inner[i+1][0])/2,(inner[i][1]+inner[i+1][1])/2-cy];
      masonry.quad(Q(o0,uF-.08),Q(o1,uF-.08),Q(o1,uF),Q(o0,uF),c,[om[0]*px,om[1],om[0]*pz],1.2);
      masonry.quad(Q(inner[i],uF-.08),Q(inner[i+1],uF-.08),Q(inner[i+1],uF),Q(inner[i],uF),c,[-im[0]*px,-im[1],-im[0]*pz],1.2);
      if(k)for(const [j,p] of [[i,o0],[i+1,o1]]){const q=seg(.55,9)[j];masonry.quad(Q(q,uF-.08),Q(p,uF-.08),Q(p,uF),Q(q,uF),c,j===i?[px,0,pz]:[-px,0,-pz],1.2);}}}
  // Plinth course: textured and open across the doorway (a 6.4 m-tall smooth cream slab, and a sill).
  for(const [v0,v1] of [[-H-.02,-oh-.02],[oh+.02,H+.02]])mblock(uF-.14,uF,v0,v1,e.bottom,y0+.35,'#a99f8a');  // ends 2 cm proud of the gate sides (were their plane)
  // the cornice cap's top shared the masonry top plane over the whole gate
  // (15.8 m² at 0.0015 mm). One top only: the cream leading band (front .3 m + .35 m return) and two side strips outside
  // the masonry footprint; the masonry top (walk) shows behind. Same silhouette from the street.
  block(uF-.3,uF+.35,-H-.2,H+.2,y0+GATE.cornice-.45,y0+GATE.cornice,'#c1b28f');
  for(const sd of [-1,1])block(uF+.35,uB,sd*H,sd*(H+.2),y0+GATE.cornice-.45,y0+GATE.cornice,'#c1b28f');
  block(uF-.18,uB,-H-.05,H+.05,y0+GATE.cornice-.8,y0+GATE.cornice-.45,'#b6a684');
  // Broken pediment corners (raking wedges toward the centre) with pedestals and ball finials (Wikimedia Commons curid=49414779).
  for(const s of [-1,1]){const vOut=s*(H+.2),vIn=s*(H-1.5),base=y0+GATE.cornice;
    const t0=P3(uF-.3,vOut,base),t1=P3(uF-.3,vIn,base),t2=P3(uF-.3,vOut,base+.75),b0=P3(uB,vOut,base),b1=P3(uB,vIn,base),b2=P3(uB,vOut,base+.75);
    masonry.tri(t0,t1,t2,'#c1b28f',out,2.2);masonry.tri(b0,b2,b1,'#c1b28f',[ax,0,az],2.2);
    masonry.quad(t1,b1,b2,t2,'#cbbd9b',[-s*px*.7,1,-s*pz*.7],2.2);
    const v=s*(H-.45);block(uF-.05,uF+.65,v-.36,v+.36,base,base+.95,'#bcae8d');block(uF-.1,uF+.7,v-.42,v+.42,base+.95,base+1.08,'#cbbd9b');
    bake(cylinder,...P3(uF+.3,v,base+1.2),.12,.24,.12,'#cbbd9b',0,'solid');bake(sphere,...P3(uF+.3,v,base+1.5),.27,.27,.27,'#c7b994',0,'solid');
    bake(cylinder,...P3(uF+.3,v,base+1.82),.05,.16,.05,'#c7b994',0,'solid');}

  // Entrance ramp (Wikimedia Commons curid=124496780): dark ashlar walls, heavy rounded coping; the deck is drawn as sett floor with the passage batch.
  const rp=c.ramp,{half}=c.constants.RAMP_SECTION,oH=rp.outerHalf;
  for(const {side,list} of rp.sides){const nO=s=>[s.side[0]*side,0,s.side[1]*side];
    for(const w of list){const a=rp.rows[w.a],b=rp.rows[w.b],A=a.at(side*oH),B=b.at(side*oH),Ai=a.at(side*half),Bi=b.at(side*half);
      const AO=a.at(side*(oH+.06)),BO=b.at(side*(oH+.06)),AI=a.at(side*(half-.06)),BI=b.at(side*(half-.06));
      masonry.quad([A[0],w.bottom,A[1]],[B[0],w.bottom,B[1]],[B[0],w.topB-.18,B[1]],[A[0],w.topA-.18,A[1]],ASHLAR,nO(a),2.0);
      masonry.quad([Ai[0],a.y-.05,Ai[1]],[Bi[0],b.y-.05,Bi[1]],[Bi[0],w.topB-.18,Bi[1]],[Ai[0],w.topA-.18,Ai[1]],'#b3aea2',[-a.side[0]*side,0,-a.side[1]*side],2.0);
      // Rounded coping: overhang both faces, three facets over the top. The two vertical lips face outward/inward (owner
      // an up hint is parallel to a vertical lip, which then faced into the coping and left a
      // see-through slit along the wall).
      const prof=[[AO,BO,-.18],[AO,BO,-.04],[lerp(A,Ai,.5),lerp(B,Bi,.5),.1],[AI,BI,-.04],[AI,BI,-.18]];
      const inward=[-a.side[0]*side,0,-a.side[1]*side],hints=[nO(a),[0,1,0],[0,1,0],inward];
      for(let i=0;i<4;i++){const [p0,q0,h0]=prof[i],[p1,q1,h1]=prof[i+1];
        masonry.quad([p0[0],w.topA+h0,p0[1]],[q0[0],w.topB+h0,q0[1]],[q1[0],w.topB+h1,q1[1]],[p1[0],w.topA+h1,p1[1]],COPING,hints[i],1.6);}
      masonry.quad([AO[0],w.topA-.18,AO[1]],[BO[0],w.topB-.18,BO[1]],[B[0],w.topB-.18,B[1]],[A[0],w.topA-.18,A[1]],COPING,[0,-1,0],1.6);
      masonry.quad([Ai[0],w.topA-.18,Ai[1]],[Bi[0],w.topB-.18,Bi[1]],[BI[0],w.topB-.18,BI[1]],[AI[0],w.topA-.18,AI[1]],COPING,[0,-1,0],1.6);}
    // Foot end of each wall (the open lower end of the ramp): the body up to the coping's underside, then the coping's own
    // end profile (the coping's end was open).
    const w=list[0],a=rp.rows[w.a],A=a.at(side*oH),Ai=a.at(side*half),back=[-(rp.rows[1].p[0]-a.p[0]),0,-(rp.rows[1].p[1]-a.p[1])];
    masonry.quad([A[0],w.bottom,A[1]],[Ai[0],w.bottom,Ai[1]],[Ai[0],w.topA-.18,Ai[1]],[A[0],w.topA-.18,A[1]],ASHLAR,back,2.0);
    {const AO=a.at(side*(oH+.06)),AI=a.at(side*(half-.06)),M=lerp(A,Ai,.5),y=w.topA;
      const e=[[AO,-.18],[AO,-.04],[M,.1],[AI,-.04],[AI,-.18]].map(([q,h])=>[q[0],y+h,q[1]]);
      for(let i=1;i<4;i++)masonry.tri(e[0],e[i],e[i+1],COPING,back,1.6);}}

  // Ramp bands (replacement ground beside the walls): grass on the entrance-terrace side, pavement tone on the street side,
  // matching the terrain palette; masonry skirts up to the kept terrain at the band ends.
  for(const band of rp.bands){if(!band.tris.length)continue;
    const flat=band.tris.flat(),cx=flat.reduce((n,p)=>n+p[0],0)/flat.length,cz=flat.reduce((n,p)=>n+p[2],0)/flat.length,pos=[];
    // 4 mm lift on the inner (wall-side) vertices only: vertices on the exact kept terrain stay on it (
    // 2026-11-17: a lifted outer edge left a 4 mm slot to the void along the band, seen as a cyan line on the lawn).
    const lift=x=>Math.abs(x[1]-height(x[0],x[2]))<1e-4?0:.004;
    for(const [p,q,v] of band.tris){const cr=(q[0]-p[0])*(v[2]-p[2])-(q[2]-p[2])*(v[0]-p[0]);for(const x of cr<0?[p,q,v]:[p,v,q])pos.push(x[0]-cx,x[1]+lift(x),x[2]-cz);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
    bake(g,cx,0,cz,1,1,1,band.lawn?'#7e9866':'#c8bfaa',0,'solid');g.dispose();
    for(const sk of band.skirts)for(let i=0;i+1<sk.rows.length;i++){const [a0,a1]=sk.rows[i],[b0,b1]=sk.rows[i+1];
      if(a1[1]-a0[1]<.003&&b1[1]-b0[1]<.003)continue;
      // the band-end skirt at the gate lay on the gate front's plane; skirts sit
      // 12 mm behind their face (hidden where the gate front covers them, an invisible recess elsewhere).
      const hl=Math.hypot(sk.hint[0],sk.hint[2])||1,o=p=>[p[0]-sk.hint[0]/hl*.012,p[1],p[2]-sk.hint[2]/hl*.012];
      masonry.quad(o(a0),o(b0),o(b1),o(a1),ASHLAR,sk.hint,2.0);}}

  // ---- Plaza Colón ----
  const pl=c.plaza,m=pl.monument,M=c.constants.MONUMENT_DIMS,yT=pl.terraceY;
  const cube=(x,y,z,w,h,d,col,r=0)=>bake(box,x,y,z,w,h,d,col,r,'solid');
  // Monument (Wikimedia Commons curid=127996363, curid=71286745): pale stepped base, dark pedestal with bronze relief panels, white column, statue.
  cube(m.x,(m.bottom+m.baseTop)/2,m.z,M.base,m.baseTop-m.bottom,M.base,'#cbc2ad');
  cube(m.x,(m.baseTop+m.stepTop)/2,m.z,M.step,m.stepTop-m.baseTop+.02,M.step,'#d6cdb9');
  cube(m.x,m.stepTop+.2,m.z,M.pedestal+.5,.4,M.pedestal+.5,'#b9b2a2');
  cube(m.x,(m.stepTop+.4+m.pedestalTop)/2,m.z,M.pedestal,m.pedestalTop-m.stepTop-.4,M.pedestal,'#b7b0a1');
  for(const [dx,dz,w,d] of [[0,1,1,0],[0,-1,1,0],[1,0,0,1],[-1,0,0,1]]){const o=M.pedestal/2+.03;
    cube(m.x+dx*o,(m.stepTop+m.pedestalTop)/2+.2,m.z+dz*o,w?2.2:.06,1.5,d?2.2:.06,BRONZE);}
  cube(m.x,(m.pedestalTop+m.corniceTop)/2,m.z,M.cornice,m.corniceTop-m.pedestalTop,M.cornice,'#cfc7b4');
  bake(cylinder,m.x,(m.corniceTop+m.shaftBottom)/2,m.z,M.shaftR+.22,m.shaftBottom-m.corniceTop,M.shaftR+.22,'#e1dccf',0,'solid');
  bake(cylinder,m.x,(m.shaftBottom+m.shaftTop)/2,m.z,M.shaftR,M.shaft,M.shaftR,MARBLE,0,'solid');
  bake(cylinder,m.x,m.shaftTop+.25,m.z,M.shaftR+.25,.5,M.shaftR+.25,'#e4dfd2',0,'solid');
  cube(m.x,(m.capitalTop+m.plinthTop)/2,m.z,1.0,m.plinthTop-m.capitalTop,1.0,'#ddd8cb');
  const sculpt=createStatueBuilder({bake,own,box,sphere,segment});
  const f=statueFrame(m.x,m.plinthTop,m.z,0,M.statue,1.2);sculpt(f,'#d8d4c9');
  // Standard / staff (Wikimedia Commons curid=127996363 silhouette): foot on the statue plinth, shaft through the right hand (it hung 7 cm
  // off the hand and 32 cm off the plinth).
  {const F=[.14,0,.22],Hd=[.2,.66,.28],k=2.35/.66,T=F.map((v,i)=>v+(Hd[i]-v)*k);segment(f.point(...F),f.point(...T),.06,'#cfcabd');}
  // Stair (Wikimedia Commons curid=127996363): seven pale-ochre stone treads; each tread box reaches below the DEM it covers (shared bounds).
  const st=pl.stair;
  for(const s of pl.steps)cube((st.x0+st.x1)/2,(s.bottom+s.top)/2,(s.z0+s.z1)/2,st.x1-st.x0,s.top-s.bottom,s.z1-s.z0,'#cdbb98');
  // Nosing bars (js/sj-stairs.js STAIR_NOSING: 2.5 cm proud of the riser, top 1.2 cm over the tread; none on the top riser).
  {const N_=pl.flight?.module?.nosing;if(N_)for(const s of pl.steps)if(s.nosing)cube((st.x0+st.x1)/2,s.top+N_.up-.015,s.z1+N_.out-N_.depth/2,st.x1-st.x0+.01,.03,N_.depth,'#d9c9a6');}
  // Flight cheeks (the stair rides; the cheeks close its render cut where the terrace stands higher).
  for(const c of pl.cheeks??[])for(const r of c.rows){cube((c.x0+c.x1)/2,(c.bottom+r.top-.06)/2,(r.z0+r.z1)/2,c.x1-c.x0,r.top-.06-c.bottom,r.z1-r.z0,OCHRE_DARK);
    cube((c.x0+c.x1)/2,r.top-.03,(r.z0+r.z1)/2,c.x1-c.x0+.04,.06,r.z1-r.z0,'#d8b47b');}
  // Cascade basins (Wikimedia Commons curid=127996363, curid=71286745): ochre tiers stepping down south, static water and falling sheets over each lip.
  const cs=pl.cascade,cw=cs.x1-cs.x0,cxm=(cs.x0+cs.x1)/2;
  // Each basin: body to its water level, a rim round it, water recessed 12 cm below the rim (water sat on top of
  // solid blocks, 13 cm above its declared level, and the DEM rose through the lower tiers; tier tops now clear it).
  cs.tiers.forEach((t,k)=>{const zm=(t.za+t.zb)/2,dz=t.zb-t.za,c=k%2?OCHRE:OCHRE_DARK;
    cube(cxm,(t.bottom+t.water)/2,zm,cw,t.water-t.bottom,dz,c);
    for(const [x,z,w,d] of [[cs.x0+.12,zm,.24,dz],[cs.x1-.12,zm,.24,dz],[cxm,t.za+.1,cw,.2],[cxm,t.zb-.1,cw,.2]])cube(x,(t.water+t.top)/2,z,w,t.top-t.water,d,c);
    cube(cxm,t.water+.012,zm,cw-.46,.012,dz-.38,WATER);  // bottom 6 mm off the tier top (coplanar guard)
    const next=cs.tiers[k+1],low=(next?next.water:t.bottom+.2)+.006;cube(cxm,(t.top+low)/2,t.zb+.03,cw-.7,Math.max(.05,t.top-low),.03,FALL);});  // fall foot 6 mm above the rim bottoms
  cube(cxm,yT+.2,cs.z0-.22,cw,.3+.1,.45,OCHRE_DARK);
  // Round bastion (Wikimedia Commons curid=127996363 right): ochre half-drum with dark openings, balustraded parapet of piers between rails.
  const bs=pl.bastion;
  {const n=24;for(let i=0;i<n;i++){const t0=i*Math.PI/n,t1=(i+1)*Math.PI/n,p=t=>[bs.x+Math.cos(t)*bs.r,bs.z+Math.sin(t)*bs.r];
      const [x0,z0]=p(t0),[x1,z1]=p(t1),nm=[Math.cos((t0+t1)/2),0,Math.sin((t0+t1)/2)];
      void nm;masonry.tri([bs.x,yT+.004,bs.z],[x0,yT+.004,z0],[x1,yT+.004,z1],'#bfae8c',up,2.0);}
    // Smooth ochre render (Wikimedia Commons curid=127996363), not rubble: an untextured half-drum.
    const drum=new THREE.CylinderGeometry(bs.r,bs.r,yT-bs.bottom,24,1,true,-Math.PI/2,Math.PI);
    bake(drum,bs.x,(bs.bottom+yT)/2,bs.z,1,1,1,OCHRE,0,'solid');drum.dispose();
    for(let i=0;i<6;i++){const t=(i+.5)*Math.PI/6,x=bs.x+Math.cos(t)*(bs.r+.005),z=bs.z+Math.sin(t)*(bs.r+.005);
      bake(box,x,yT-.85,z,.55,.7,.04,'#3b3530',Math.atan2(Math.cos(t),Math.sin(t)),'solid');}
    // `yaw` is already the tangent (local X along the arc, as the openings
    // above); the old yaw+π/2 turned every rail, coping and pier chord radial (17 cm overhangs, broken read). Chords now
    // run along the arc and their outer corners meet at the drum face (L = 2·r·tan(π/32)); the guard is unchanged.
    for(let i=0;i<16;i++){const t=(i+.5)*Math.PI/16,r=bs.r-bs.thick/2,x=bs.x+Math.cos(t)*r,z=bs.z+Math.sin(t)*r,yaw=Math.atan2(Math.cos(t),Math.sin(t));
      const L=2*bs.r*Math.tan(Math.PI/32)+.005;
      bake(box,x,yT+.15,z,L,.3,bs.thick,OCHRE,yaw,'solid');
      bake(box,x,yT+bs.parapet-.07,z,L+.04,.14,bs.thick+.06,'#d8b47b',yaw,'solid');
      bake(box,x,yT+.6,z,.2,.6,bs.thick,OCHRE,yaw,'solid');}}
  // Side parapets where the terrace edge falls ≥0.4 m (ochre walls with end pedestals).
  for(const w of pl.sideWalls){const xm=w.x+w.out*.225,top=yT+.95;
    cube(xm,(w.bottom+top)/2,(w.z0+w.z1)/2,.45,top-w.bottom,w.z1-w.z0,OCHRE);cube(xm,top+.04,(w.z0+w.z1)/2,.55,.08,w.z1-w.z0+.04,'#d8b47b');
    cube(xm,(w.bottom-.02+top+.25)/2,w.z0+.28,.62,top+.27-w.bottom,.64,OCHRE_DARK);}  // end pedestal 4 cm proud of the wall front (was its plane)
  // Globe lamps (Wikimedia Commons curid=127996363): dark posts, white globes; pedestal pairs at the stair foot.
  // the thin near-black post vanished against Teatro Tapia's dark arcade, so the
  // globe read as floating. Posts are a lighter weathered iron and every globe sits in a visible socket (collar + ring)
  // that laps 7 cm into the globe and onto the post or crossbar.
  const LAMP_IRON='#4d5550',SOCKET='#5d655f';
  for(const l of pl.lamps){let y=l.base;
    if(l.pedestal){cube(l.x,(l.bottom+l.base+l.pedestal)/2,l.z,.72,l.base+l.pedestal-l.bottom,.72,OCHRE_DARK);cube(l.x,l.base+l.pedestal+.05,l.z,.82,.1,.82,'#d8b47b');y=l.base+l.pedestal+.1;}
    else bake(cylinder,l.x,(l.bottom+y+.4)/2,l.z,.16,y+.4-l.bottom,.16,LAMP_IRON,0,'solid');
    bake(cylinder,l.x,y+1.7,l.z,.06,3.4,.06,LAMP_IRON,0,'solid');
    if(l.globes===2){cube(l.x,y+3.3,l.z,1.0,.05,.05,LAMP_IRON);for(const d of [-.5,.5]){bake(cylinder,l.x+d,y+3.36,l.z,.08,.1,.08,SOCKET,0,'solid');
        bake(cylinder,l.x+d,y+3.33,l.z,.11,.03,.11,SOCKET,0,'solid');bake(sphere,l.x+d,y+3.55,l.z,.23,.23,.23,'#f4f3ee',0,'solid');glowLamp(l.x+d,y+3.55,l.z,'globe',{ground:l.base});}}
    else{bake(cylinder,l.x,y+3.38,l.z,.09,.14,.09,SOCKET,0,'solid');bake(cylinder,l.x,y+3.33,l.z,.12,.04,.12,SOCKET,0,'solid');
      bake(sphere,l.x,y+3.62,l.z,.25,.25,.25,'#f4f3ee',0,'solid');glowLamp(l.x,y+3.62,l.z,'globe',{ground:l.base});}}
  // Benches (OSM, backrest): iron legs, timber slats.
  for(const b of pl.benches){const pt=(u,y,d=0)=>[b.x+Math.cos(b.heading)*u+Math.sin(b.heading)*d,y,b.z-Math.sin(b.heading)*u+Math.cos(b.heading)*d];
    for(const l of b.legs){const lo=l.ground-.05;bake(box,...pt(l.u,(lo+b.y+.47)/2),.08,b.y+.47-lo,.5,IRON,b.heading,'solid');}
    for(let i=0;i<3;i++)bake(box,...pt(0,b.y+.47,-.2+i*.18),b.width,.06,.14,'#7a6a48',b.heading,'solid');
    for(const l of b.legs)bake(box,...pt(l.u,b.y+.66,-.26),.06,.42,.05,IRON,b.heading,'solid'); // backrest uprights
    for(const y of [.68,.84])bake(box,...pt(0,b.y+y,-.26),b.width,.12,.05,'#7a6a48',b.heading,'solid');}
  // Mapped trees (OSM; Wikimedia Commons curid=127996363: broad dense rounded crowns over short trunks).
  pl.trees.forEach((t,i)=>{
    // Mapped tree inside the lowest cascade basin: a round stone planting island in the basin carries it.
    if(t.x>cs.x0&&t.x<cs.x1&&t.z>cs.z0&&t.z<cs.z1){const tier=cs.tiers.find(q=>t.z>=q.za&&t.z<=q.zb)??cs.tiers.at(-1);
      bake(cylinder,t.x,(tier.bottom-.02+tier.top+.25)/2,t.z,.75,tier.top+.27-tier.bottom,.75,OCHRE_DARK,0,'solid');  // foot 2 cm below the tier bottom
      bake(cylinder,t.x,tier.top+.255,t.z,.62,.03,.62,'#4d3e2f',0,'solid');}
    // A trunk that would cut 7 cm into the round bastion's drum stands just clear of it (draw position only).
    {const dx=t.x-bs.x,dz=t.z-bs.z,d=Math.hypot(dx,dz),need=bs.r+t.radius+.03;if(dz>0&&d<need&&d>bs.r-1){t={...t,x:bs.x+dx/d*need,z:bs.z+dz/d*need};}}
    {const tb=Number.isFinite(t.foot)?Math.min(t.y,t.foot):t.y;bake(cylinder,t.x,(tb+t.y+3.2)/2,t.z,t.radius,t.y+3.2-tb,t.radius,'#7b6d55',0,'solid');}  // seated toe (seatRecords)
    for(let j=0;j<6;j++){const a=j*Math.PI/3+i*.9,r=1.9+(j%2)*.6,p=[t.x+Math.cos(a)*r,t.y+4.6+(j%3)*.45,t.z+Math.sin(a)*r];
      segment([t.x,t.y+2.9,t.z],p,.1,'#7b6d55');bake(sphere,...p,2.3,1.7,2.2,['#3f633f','#4b7145','#3a5c3a'][j%3],a,'leaf');}
    bake(sphere,t.x,t.y+6.0,t.z,2.7,1.8,2.6,'#4f7548',0,'leaf');});

  // One material for all masonry: reuse El Morro's (same masonry texture/parameters) when it exists.
  const fortMesh=meshes.find(x=>x.name==='sj-plaza-fort-masonry');
  const material=fortMesh?.material??mat({map:masonryTexture(textures),vertexColors:true,roughness:.93,metalness:0});
  const g=own(masonry.geometry()),mesh=new THREE.Mesh(g,material);mesh.name='sj-plaza-cristobal-masonry';mesh.castShadow=true;mesh.receiveShadow=true;
  scene.add(mesh);meshes.push(mesh);
  return {masonryTriangles:masonry.count/3,garitas:c.garitas.length,walls:c.walls.length,rampRows:rp.rows.length,trees:pl.trees.length};
}
