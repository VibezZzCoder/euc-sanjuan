/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// San Cristóbal outworks (forttops ) — © 2026 VibezZzCoder, MIT. OSM / ODbL; heights: USGS DEM.
// The outworks east of the fort are public open ground in the game: they get the masonry that defines them, nothing else.
// Visual sources:
//  - NPS Olmsted Center, Cultural Landscape Report for the San Cristóbal Outworks (2015), Drawing 3.1 Existing Conditions
//    (plan of San Carlos, Santa Teresa, El Abanico, the covered way and the south entry drive), Fig. 4.13 (El Abanico's pale
//    masonry from the central open area), Fig. 4.14 (HABS 1963 plan of El Abanico), Fig. 4.22 (outer wall along the south
//    entry drive: masonry wall at the foot, steep grass bank above), Fig. 4.6 (the great moat and San Carlos), Fig. 4.23;
//  - Wikimedia Commons curid=11855283 (2010 aerial: low dark walls round grass outworks) and the 1938 HABS view (: battered scarps over a dry moat).
// Mapped: the OSM outwork rings 509326337 / 509326338, node 5239995074 "El Abanico", way 561590374 "La Garita del Diablo",
// the paths and roads (kept clear), and the DEM (every wall line is traced on its scarp). Inferred: every wall line vertex
// (traced on the DEM, placed by the CLR plan), wall heights (capped by the DEM bank), the coping, the garita's pier.
// One primitive: a toe revetment. Along a polyline traced at the foot of a DEM bank (left normal (−uz,ux) points to the low
// side), each 2 m station stands a battered masonry face from the ground there up to y = min(bank crest − 5 cm, ground +
// hMax); behind its coping a narrow ledge runs back to where the bank reaches y again. Drawn and physical are the same:
//  - the face zone is solid (two non-support prisms following the batter, tops 0.35 m under the coping);
//  - the coping and ledge are replacement tops (same triangles as drawn; the ledge is drawn in the terrain chunks);
//  - the DEM under face, coping and ledge is cut (render only, tight convex pieces).
// The bank above and the ground in front stay the DEM: every grade is the real one; nothing invisible stands anywhere.
import {signedArea} from './sj-paving.js';
import {segmentDistance,inRing} from './sj-plaza-layout.js';

// Lines (game metres; inferred traces on the 2 m DEM, docs table). hMax: wall height cap over the foot; hMin: no wall
// where the bank is lower.
export const OUTWORK_WALLS=[
  // Covered way from San Carlos to El Abanico: its south scarp over the entry drive / Muñoz Rivera glacis (CLR Fig. 4.22,
  // Drawing 3.1 dark band; DEM toe z −153.5 at x 742 … −180 at x 868; crest 29–31 → 22 m).
  {name:'covered-way',tone:'pale',hMax:3.2,hMin:1.2,line:[[733,-153.5],[742,-153.6],[754,-154.6],[766,-156.8],[778,-158.4],[790,-161.2],
    [802,-164.2],[814,-165.8],[826,-168.4],[838,-170.6],[850,-173.4],[858,-175.3],[866,-178.6],[872,-181.5]]},
  // San Carlos counterscarp: the east bank of the great moat round the ravelin (CLR Fig. 4.6; DEM ditch 24.3–25.6, lawn
  // edge 29–32 m). Ends north of the ditch road's bend (road 509326339).
  {name:'san-carlos-counterscarp',toe:true,tone:'warm',hMax:4.4,hMin:1.4,line:[[721,-251],[721.6,-241],[724,-233.5],[726.6,-227],[730.6,-219.5],
    [733.6,-212],[737.6,-205.5],[741.6,-198],[743.4,-191],[743.8,-185.5]]},
  // El Abanico (node 5239995074; CLR Fig. 4.13/4.14, Drawing 3.1): south face, the fan apex, north face (main moat H), the
  // gorge counterscarp north of the entrance causeway (DEM z ≈ −200, kept open) and the south-west dry moat (A).
  {name:'abanico-south',tone:'pale',hMax:3.4,hMin:.9,line:[[904,-170.6],[914,-171.4],[924,-173],[934,-175.6],[944,-178.8],[954,-182.6],
    [963,-186.6],[972,-191.6],[980,-197.4]]},
  {name:'abanico-apex',tone:'pale',hMax:3,hMin:.9,line:[[980,-197.4],[987,-204],[991,-212.5],[991.5,-221],[987.5,-229],[981,-235.5]]},
  {name:'abanico-north',tone:'pale',hMax:2.8,hMin:1,line:[[951,-239],[944,-245],[936,-251],[928,-256.4],[919,-259.4],[910,-260.4]]},
  {name:'abanico-gorge',toe:true,tone:'pale',hMax:3.6,hMin:1.2,line:[[895.2,-205.5],[895.2,-212],[895.3,-219],[895.4,-226],[896.6,-231]]},
  // CLR Fig. 4.13: the pale lawn-facing plane of El Abanico across the gorge: the low west-facing
  // scarp on the gorge ditch's east bank, only where the DEM carries it (z −220: 18.9 → 21.3 m between x 897 and 900),
  // stopping short of the entrance causeway (z ≈ −200, open).
  {name:'abanico-gorge-scarp',toe:true,tone:'pale',hMax:2.6,hMin:1,line:[[897.7,-228.5],[897.4,-221],[897.4,-214],[897.6,-207.5]]},
  {name:'abanico-sw-moat',toe:true,tone:'pale',hMax:3.8,hMin:1.2,line:[[890.6,-168.5],[890.6,-174],[890.8,-180],[891,-186]]},
  // Santa Teresa battery's east work: the scarp falling east to the ditch toward the coast (Drawing 3.1 walls NE of Santa
  // Teresa; DEM 26 → 21–22 m at x 820–832).
  // retraced onto the real step (z −278: 25.73 → 22.14 m between x 820 and 822; the shipped x 828.6
  // stood on the flat with a 5.4 m ledge back to the bank).
  {name:'santa-teresa-east',tone:'stone',hMax:3,hMin:1.2,line:[[817.5,-268],[819.8,-273],[822,-278],[824.5,-284],[827,-289],[830,-294]]},
];
// La Garita del Diablo (OSM 561590374, the "Fortín del Espigón" tongue below the north cliff; NPS park page, Wikipedia):
// one garita on a masonry pier at the tongue's DEM crest tip (6–7 m; the tongue drops to the sea beyond). Inferred spot.
export const DIABLO={x:671.2,z:-326.4,pier:1.25,footing:1.7,radius:.82,body:2.1,corbel:1.1,face:[.2,-1]};
export const REVET={batter:.14,spacing:2,coping:.45,under:.35,bottom:.5,search:6,ledge:2.5,taper:.35};

const unit=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return [dx/l,dz/l];};
function convex(r){const sg=Math.sign(signedArea(r));if(!sg)return false;return r.every((p0,k)=>{const p1=r[(k+1)%r.length],p2=r[(k+2)%r.length];
  return sg*((p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]))>1e-9;});}

// Stations along a polyline: every ≤2 m, with the mitred low-side normal at vertices.
function stationsOf(line,spacing){const out=[];
  for(let i=0;i+1<line.length;i++){const a=line[i],b=line[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/spacing)),[ux,uz]=unit(a,b);
    for(let k=i?1:0;k<=n;k++){const t=k/n;out.push({p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],u:[ux,uz],vi:k===n?i+1:k===0?i:-1});}}
  for(const s of out){let [ux,uz]=s.u;if(s.vi>0&&s.vi<line.length-1){const [px,pz]=unit(line[s.vi-1],line[s.vi]),[qx,qz]=unit(line[s.vi],line[s.vi+1]);
      const mx=px+qx,mz=pz+qz,l=Math.hypot(mx,mz)||1;ux=mx/l;uz=mz/l;}s.n=[-uz,ux];s.t=[ux,uz];}
  return out;}

// Build every wall: stations, drawn intervals, colliders, tops, cuts and ledge ground. `blocked(ring)` says another owner,
// a road (with clearance) or water is there.
export function buildOutworks({height,isDry,blocked,prism,terrainProfile,convexCut}){
  const R=REVET,walls=[],tops=[],cuts=[],groundTriangles=[],skipped={},toes=[];
  const at=(s,d)=>[s.p[0]-s.n[0]*d,s.p[1]-s.n[1]*d];   // d>0: inward (high side)
  for(const spec of OUTWORK_WALLS){const st=stationsOf(spec.line,R.spacing);
    // nothing drawn may have open space under it (the sampler honours a top only
    // near the rider's own height, so a rider placed or rolling in at DEM level stayed under a 5.9 m fill ledge). The
    // bank must meet the coping within LEDGE metres (else the wall is lowered, else not built: no raised terraces over gentle
    // banks), and the solid body reaches under the coping and the ledge to 0.35 m below the drawn surface.
    const fit=(s,g,y)=>{const dT=R.batter*(y-g),dK=dT+R.coping;let dI=null;
      for(let d=dK+.25;d<=R.search+2+1e-9;d+=.125)if(height(...at(s,d))>=y){dI=d;break;}
      if(dI===null||dI-dK>R.ledge)return null;return {dT,dK,dI,yI:height(...at(s,dI))};};
    const place=(s,g,y,f)=>{Object.assign(s,{g,y,dT:f.dT,dK:f.dK,dI:f.dI,bottom:g-R.bottom,P:s.p,B:[s.p[0]+s.n[0]*R.batter*R.bottom,s.p[1]+s.n[1]*R.batter*R.bottom],
      T:at(s,f.dT),K:at(s,f.dK),I:at(s,f.dI),F:at(s,f.dT*.5),yI:f.yI});};
    for(const s of st){const g=height(...s.p);let crest=-Infinity;for(let d=.5;d<=R.search+1e-9;d+=.25)crest=Math.max(crest,height(...at(s,d)));
      s.ok=false;s.g=g;s.y=g;if(!isDry(...s.p))continue;
      let y=Math.min(crest-.05,g+spec.hMax);
      // The bank directly behind the coping may stand higher than y (bank steeper than the wall): raise y to it.
      for(let k=0;k<3;k++){const dK=R.batter*(y-g)+R.coping,hK=height(...at(s,dK));if(hK>y+.02)y=hK;else break;}
      if(y-g>spec.hMax+1.5)continue;
      for(;y-g>=spec.hMin-1e-9;y-=.1){const f=fit(s,g,y);if(f){place(s,g,y,f);s.ok=true;break;}}
      // Taper candidate: a 0.35 m stub that closes a run end into the grade.
      if(!s.ok&&crest-.05>=g+R.taper){const f=fit(s,g,g+R.taper);if(f){s.taper={g,y:g+R.taper,f};}}}
    // Run ends taper to grade: a station next to a full one that only carries the stub takes the stub geometry.
    for(let i=0;i<st.length;i++){const s=st[i];if(s.ok||!s.taper)continue;if(st[i-1]?.ok||st[i+1]?.ok){place(s,s.taper.g,s.taper.y,s.taper.f);s.ok=true;s.tapered=true;}}
    const pieces=[];
    // Band heights at a station: just over the ground, the middle, and 0.35 m under the coping (collapsing on low walls).
    const bands=s_=>{const H3=Math.max(s_.g+.05,s_.y-R.under),H1=Math.min(s_.g+.45,H3);return [H1,(H1+H3)/2,H3];};
    const faceAt=(s_,H)=>{const k=Math.max(0,Math.min(1,(H-s_.bottom)/((s_.y-s_.bottom)||1)));const d=.02;
      return [s_.B[0]+(s_.T[0]-s_.B[0])*k-s_.n[0]*d,s_.B[1]+(s_.T[1]-s_.B[1])*k-s_.n[1]*d];};
    const L2=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
    const bandPieces=(a,b,i)=>{const ha=bands(a),hb=bands(b),out=[],bot=Math.min(a.bottom,b.bottom)-.1;
      const m=Math.min(8,1+Math.ceil(Math.max(Math.abs(ha[2]-hb[2]),Math.abs(a.yI-b.yI))/.15));
      for(let k=0;k<3;k++){const fa=faceAt(a,ha[k]),fb=faceAt(b,hb[k]),ba=k<2?faceAt(a,ha[k+1]):a.I,bb=k<2?faceAt(b,hb[k+1]):b.I;
        for(let j=0;j<m;j++){const t0=j/m,t1=(j+1)/m,top=Math.min(ha[k]+(hb[k]-ha[k])*t0,ha[k]+(hb[k]-ha[k])*t1);
          if(top<Math.min(a.g,b.g)+.04)continue;
          const q={k,i,j,top,bot,f0:L2(fa,fb,t0),f1:L2(fa,fb,t1),b0:L2(ba,bb,t0),b1:L2(ba,bb,t1),u:[b.p[0]-a.p[0],b.p[1]-a.p[1]]};
          if(Math.abs(signedArea([q.f0,q.f1,q.b1,q.b0]))<.01)continue;out.push(q);}}
      return out;};
    const turn=(p,q)=>{const l1=Math.hypot(...p.u)||1,l2=Math.hypot(...q.u)||1;return Math.acos(Math.max(-1,Math.min(1,(p.u[0]*q.u[0]+p.u[1]*q.u[1])/l1/l2)));};
    const list=[];
    for(let i=0;i+1<st.length;i++){const a=st[i],b=st[i+1];if(!a.ok||!b.ok||a.tapered&&b.tapered){(skipped[spec.name]??={}).low=(skipped[spec.name].low??0)+1;continue;}
      const ring=[a.B,b.B,b.I,a.I];if(Math.abs(signedArea(ring))<.05)continue;
      if(blocked(ring)){(skipped[spec.name]??={}).owner=(skipped[spec.name].owner??0)+1;continue;}
      list.push({a,b,i});}
    // Drop single isolated intervals (a 2 m stub of wall reads as debris).
    const keep=list.filter((iv,k)=>list.some((o,j)=>j!==k&&(o.i===iv.i-1||o.i===iv.i+1)));
    const ivs=[];
    for(const {a,b,i} of keep){
      // Solid fill (a slice starting at the face foot or half-batter rose out through the battered face).
      // Inscribed stepped bands: band k's front edge lies on the drawn face where the face reaches the band's top, 2 cm
      // inward, so every collider stays inside the drawn masonry (closure rule). Pieces are merged per wall below.
      pieces.push(...bandPieces(a,b,i));
      // Coping + ledge: replacement tops (two coping triangles, the ledge fanned to the exact terrain profile at its edge).
      const P3=(p,y)=>[p[0],y,p[1]];
      const coping=[[P3(a.T,a.y),P3(b.T,b.y),P3(b.K,b.y)],[P3(a.T,a.y),P3(b.K,b.y),P3(a.K,a.y)]];
      const prof=terrainProfile(b.I,a.I),ledgeR=[P3(a.K,a.y),P3(b.K,b.y),...prof];
      const C=[(a.K[0]+b.K[0]+a.I[0]+b.I[0])/4,(a.y+b.y+a.yI+b.yI)/4,(a.K[1]+b.K[1]+a.I[1]+b.I[1])/4];
      const ledge=[];for(let k=0;k<ledgeR.length;k++){const t=[C,ledgeR[k],ledgeR[(k+1)%ledgeR.length]];
        const ar=Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]));if(ar<1e-6)continue;ledge.push(t);}
      for(const [t,surface,drawnHere] of [...coping.map(t=>[t,'pavement',true]),...ledge.map(t=>[t,'grass',false])]){
        let [p0,q0,r0]=t;const ny0=(q0[2]-p0[2])*(r0[0]-p0[0])-(q0[0]-p0[0])*(r0[2]-p0[2]);if(ny0<0)[q0,r0]=[r0,q0];
        const ux=q0[0]-p0[0],uy=q0[1]-p0[1],uz=q0[2]-p0[2],vx=r0[0]-p0[0],vy=r0[1]-p0[1],vz=r0[2]-p0[2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(Math.abs(ny)<1e-9)continue;const tri=[p0,q0,r0];
        if(!drawnHere)groundTriangles.push(tri);
        tops.push({poly:tri.map(v=>({x:v[0],z:v[2]})),top:Math.max(p0[1],q0[1],r0[1]),plane:{x:p0[0],y:p0[1],z:p0[2],dx:-nx/ny,dz:-nz/ny},replacesTerrain:true,
          maxReferenceY:Math.max(p0[1],q0[1],r0[1])+2.5,surface,source:'forttops:outwork'});}
      // Render cut from the face foot to the ledge edge (convex pieces).
      const cr=[a.P,b.P,b.I,a.I];
      if(convex(cr))cuts.push(convexCut(cr));else for(const t of [[cr[0],cr[1],cr[2]],[cr[0],cr[2],cr[3]]])if(Math.abs(signedArea(t))>1e-4&&convex(t))cuts.push(convexCut(t));
      ivs.push({a,b,coping});}
    // Keyed toe (grassy teeth at the ditch walls' foot, seen from the ditch floor). The DEM between stations
    // rises above the face foot; a strip of replacement ground runs from a smooth contact line on the face (the highest
    // DEM along the toe within ±3 m, +3 cm, never within 0.5 m of the coping) down to the kept terrain 1.5 m out (1.0/0.6 m
    // where a road or owner is near). Drawn in the terrain chunks, same triangles physical, DEM under it cut.
    if(spec.toe&&ivs.length){const ix=new Map(ivs.map((iv,k)=>[iv.a,k]));
      const env=s_=>{let m=-Infinity;for(let d=-3;d<=3+1e-9;d+=.5)m=Math.max(m,height(s_.p[0]+s_.t[0]*d,s_.p[1]+s_.t[1]*d));return Math.min(m+.03,s_.y-.5);};
      const onFace=(s_,H)=>{const k=Math.max(0,Math.min(1,(H-s_.bottom)/((s_.y-s_.bottom)||1)));return [s_.B[0]+(s_.T[0]-s_.B[0])*k,s_.B[1]+(s_.T[1]-s_.B[1])*k];};
      for(const {a,b} of ivs){const ea=env(a),eb=env(b);if(ea<=a.g+.08&&eb<=b.g+.08)continue;
        const Fa=onFace(a,Math.max(ea,a.g)),Fb=onFace(b,Math.max(eb,b.g)),out=(F,s_,w)=>[F[0]+s_.n[0]*w,F[1]+s_.n[1]*w];
        let w=null;for(const w_ of [1.5,1,.6]){const q=[Fa,Fb,out(Fb,b,w_),out(Fa,a,w_)];if(convex(q)&&!blocked(q)){w=w_;break;}}if(w===null)continue;
        const Oa=out(Fa,a,w),Ob=out(Fb,b,w),P3=(p,y)=>[p[0],y,p[1]],R_=[P3(Fa,Math.max(ea,a.g)),P3(Fb,Math.max(eb,b.g)),...terrainProfile(Ob,Oa)];
        const C=[(Fa[0]+Fb[0]+Oa[0]+Ob[0])/4,(R_[0][1]+R_[1][1]+height(...Oa)+height(...Ob))/4,(Fa[1]+Fb[1]+Oa[1]+Ob[1])/4];
        for(let k=0;k<R_.length;k++){let [p0,q0,r0]=[C,R_[k],R_[(k+1)%R_.length]];const ar=Math.abs((q0[0]-p0[0])*(r0[2]-p0[2])-(q0[2]-p0[2])*(r0[0]-p0[0]));if(ar<1e-6)continue;
          const ny0=(q0[2]-p0[2])*(r0[0]-p0[0])-(q0[0]-p0[0])*(r0[2]-p0[2]);if(ny0<0)[q0,r0]=[r0,q0];
          const ux=q0[0]-p0[0],uy=q0[1]-p0[1],uz=q0[2]-p0[2],vx=r0[0]-p0[0],vy=r0[1]-p0[1],vz=r0[2]-p0[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(Math.abs(ny)<1e-9)continue;
          const tri=[p0,q0,r0];groundTriangles.push(tri);tops.push({poly:tri.map(v=>({x:v[0],z:v[2]})),top:Math.max(p0[1],q0[1],r0[1]),plane:{x:p0[0],y:p0[1],z:p0[2],dx:-nx/ny,dz:-nz/ny},
            replacesTerrain:true,maxReferenceY:Math.max(p0[1],q0[1],r0[1])+2.5,surface:'grass',source:'forttops:outwork'});}
        const cr=[Fa,Fb,Ob,Oa];if(convex(cr))cuts.push(convexCut(cr));toes.push({wall:spec.name,ring:cr});void ix;}}
    // Run ends (an interval without a drawn neighbour) get an end face across face, coping and ledge.
    const ends=[];for(const [k,iv] of ivs.entries()){if(!ivs[k-1]||ivs[k-1].b!==iv.a)ends.push({s:iv.a,dir:-1});if(!ivs[k+1]||ivs[k+1].a!==iv.b)ends.push({s:iv.b,dir:1});}
    // Merge consecutive pieces of the same band into one box while their tops agree (face bands 15 cm, the band under the
    // coping/ledge 8 cm, which bounds the space under drawn ground), at most 16 pieces and no sharp bend (fewer colliders).
    const colliders_=[];
    for(let k=0;k<3;k++){const P=pieces.filter(q=>q.k===k);let run=[];
      const flush=()=>{if(!run.length)return;const ring=[...run.map(q=>q.f0),run.at(-1).f1,run.at(-1).b1,...run.map(q=>q.b0).reverse()];
        const c=prism(ring,Math.min(...run.map(q=>q.bot)),Math.min(...run.map(q=>q.top)));if(c)colliders_.push(c);run=[];};
      for(const q of P){const prev=run.at(-1),tops=[...run.map(r=>r.top),q.top];
        if(prev&&(prev.i!==q.i&&prev.i+1!==q.i||Math.hypot(prev.f1[0]-q.f0[0],prev.f1[1]-q.f0[1])>1e-6||Math.max(...tops)-Math.min(...tops)>(k<2?.15:.08)||run.length>=16||turn(prev,q)>.25))flush();
        run.push(q);}
      flush();}
    walls.push({...spec,stations:st,intervals:ivs,ends,colliders:colliders_});}
  for(const c of cuts)c.kind='forttops-outwork';
  return {walls,tops,cuts,groundTriangles,skipped,toes};
}

// Garita del Diablo: an octagonal masonry pier on the tongue's crest, the garita on top; solid to the dome.
export function buildDiablo({height,isDry,prism,circle,blocked}){
  const D=DIABLO;if(!isDry(D.x,D.z))return null;
  const ring=circle(D.x,D.z,D.pier,8);if(blocked(ring))return null;
  let lo=Infinity,hi=-Infinity;for(const p of [...ring,[D.x,D.z]]){const h=height(...p);lo=Math.min(lo,h);hi=Math.max(hi,h);}
  const y=hi+.35,l=Math.hypot(...D.face);
  // the pier is keyed into the spur as a broader battered footing (radius 1.7 m) under the 1.25 m
  // drum, so it reads as the end of the stone spur, not a pedestal. Scale of the garita itself unchanged.
  const foot=circle(D.x,D.z,D.footing,8),yF=Math.max(lo+.4,y-1.1),useFoot=!blocked(foot);
  prism(ring,lo-.5,y);if(useFoot)prism(foot,lo-.6,yF);prism(circle(D.x,D.z,D.radius+.12,8),y,y+D.body+D.radius+.35);
  return {x:D.x,z:D.z,ring,foot:useFoot?foot:null,yF,bottom:lo-.5,y,radius:D.radius,body:D.body,corbel:D.corbel,wallNx:D.face[0]/l,wallNz:D.face[1]/l};
}
void inRing;void segmentDistance;
