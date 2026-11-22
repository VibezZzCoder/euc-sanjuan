/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// El Bowl, La Perla — © 2026 VibezZzCoder, MIT. Construction only (no renderer): the rideable bowl inside its mapped rim.
// The real El Bowl (OSM 555008330) is a skate bowl and pool built by hand in 2006 by Chemi Rosado-Seijo with Roberto
// "Boly" Cortez, Luiggi Ramos, residents and visiting skaters, from rubble and cement on the shore (view-only sources:
// https://chemirosadoseijo.com/blogs/work/la-perla-bowl, https://www.primerahora.com/entretenimiento/cultura-teatro/notas/el-arte-urbano-se-hace-fuerte-en-el-barrio-la-perla/,
// https://blog.skateboard.com.au/skateparks/puerto-rico/la-perla-bowl/, https://virtualglobetrotting.com/map/la-perla-bowl-by-chemi-rosado-seijo/).
// Mapped: the rim (the OSM ring, exactly the outer edge here). From photos, qualitative: one asymmetric bean basin, a taller
// steeper crest on the sea-side arc standing above the shore shelf, a longer lower end, smooth concave transitions into a
// broad low floor, a rounded painted lip, a narrow apron nearly flush with the low lip, no coping, tiles, ladder or steps.
// Estimated (no survey): every depth and run below, and the paint, which is an original arrangement in the documented
// palette family (no mural copied).
//
// Construction: a radial mesh about the ring's centroid. Rows from the centre out: the level floor, the wall (a gentle
// eased ramp at the low east end blending into an eased-foot steep wall elsewhere), the lip band up to the mapped ring,
// and on the sea side, where the lip stands above the ground, an outer face down to the ground. Every riding triangle is
// one support facet from the same Float32 vertices (js/sj-skate-kit.js); the terrain is cut inside the ring and the bowl's
// tops replace it (bounded). Wall facets carry the transition capability; floor and lip band are rest-only. The raised
// lip is solid (prisms under the band, inside the drawn shell).
import {skateFrame,createSkateKit,wallProfile,easedRamp,smooth,capability} from './sj-skate-kit.js';

export const EL_BOWL=Object.freeze({
  floorY:3.08,       // level floor (world m); the ground at the rim is 3.47–4.03 (DEM)
  crest:1.27,        // lip above the floor on the sea-side arc (estimate; photos suggest 1–1.5 m)
  crestAt:232,       // degrees (atan2(dz,dx) about the centroid; 270 = due south, the sea)
  crestHalf:30,      // full height within ±crestHalf of crestAt, easing to none over crestEase more: shorter on the
  crestEase:[40,75], // west (wide lobe), longer toward the indentation in the south-east (the lip is closer there)
  shallowAt:355,      // the low end (east, toward the gap between the houses and the shore walk's turn)
  shallowHalf:24,shallowEase:30,
  gentleSlope:22,    // steepest point of the low end's ramp (degrees)
  steepCap:62,deepCap:72,   // eased-foot wall caps: elsewhere / at the crest
  band:.3,           // nominal lip band (the ring is a polygon; the lip is a smooth bean inside it)
  harmonics:3,
  angular:120,wallRows:18,
  arrival:[200.1,-406.6],   // map arrival: the shore walk east of the bowl (projected onto the mapped footway)
});
const FEATURE='sj-perla-bowl';
// Palette (sRGB): grey hand-poured concrete, a yellow lip, broad blocks of dark blue/teal, leaf green, pale cream, lilac
// and one saturated accent.
export const BOWL_COLOURS=Object.freeze({concrete:'#a7a49b',worn:'#8f8d86',face:'#8e8a82',lip:'#efc23a',
  deep:'#1f5b7c',teal:'#2d8c8a',leaf:'#5c9a48',cream:'#e7dcbc',lilac:'#9886c2',accent:'#e0603c'});

const TAU=Math.PI*2,deg=Math.PI/180;
const wrapDeg=a=>((a%360)+540)%360-180;   // to (−180, 180]
// weight 1 within ±half of centre, easing to 0 over `ease` degrees more
const arcWeight=(phiDeg,centre,half,ease)=>{const d=wrapDeg(phiDeg-centre),e=Array.isArray(ease)?ease[d<0?0:1]:ease;return 1-smooth((Math.abs(d)-half)/e);};
const hash=(a,b,c=0)=>{let h=Math.imul((a*73856093)^(b*19349663)^(c*83492791),2654435761)>>>0;h^=h>>>15;h=Math.imul(h,2246822519)>>>0;h^=h>>>13;return (h>>>0)/4294967296;};

/** Ray from c at angle phi to the first crossing of `ring` (star-shaped about c). */
function rayToRing(ring,c,phi){const dx=Math.cos(phi),dz=Math.sin(phi);let best=Infinity;
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ex=b[0]-a[0],ez=b[1]-a[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-12)continue;
    const t=((a[0]-c[0])*ez-(a[1]-c[1])*ex)/den,u=((a[0]-c[0])*dz-(a[1]-c[1])*dx)/den;if(t>1e-9&&u>=-1e-9&&u<=1+1e-9&&t<best)best=t;}
  return best;}
export function ringCentroid(r){let a=0,x=0,z=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],k=p[0]*q[1]-q[0]*p[1];a+=k;x+=(p[0]+q[0])*k;z+=(p[1]+q[1])*k;}
  return [x/(3*a),z/(3*a)];}

/**
 * @param ring  the mapped rim, open [[x,z]…]
 * @param height(x,z)  the drawn terrain height (the terrain's own triangles)
 * @param terrain  {x0,z0,step}: grid for exact rim joins with the cut terrain
 */
export function createPerlaBowl({ring,height,terrain,params=EL_BOWL}){
  const P=params,C=ringCentroid(ring),Yf=P.floorY;
  // ---- angles: uniform, plus the ring's vertices and every crossing of the ring with the terrain's triangle edges, so the
  // outer row runs exactly along the cut terrain's edge (no crack between the bowl and the ground) ----
  const ang=new Set();for(let k=0;k<P.angular;k++)ang.add(k/P.angular*TAU);
  const angOf=(x,z)=>{const a=Math.atan2(z-C[1],x-C[0]);return a<0?a+TAU:a;};
  for(const p of ring)ang.add(angOf(...p));
  {const {x0,z0,step}=terrain;
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];
      // grid lines x = x0 + i·step, z = z0 + j·step and the split diagonals (i + j constant)
      const lines=[[1,0,x0],[0,1,z0],[1,1,x0+z0]];
      for(const [kx,kz,o] of lines){const fa=(kx*a[0]+kz*a[1]-o)/step,fb=(kx*b[0]+kz*b[1]-o)/step;
        for(let n=Math.ceil(Math.min(fa,fb));n<=Math.floor(Math.max(fa,fb));n++){if(Math.abs(fb-fa)<1e-12)continue;const t=(n-fa)/(fb-fa);if(t<=1e-6||t>=1-1e-6)continue;
          ang.add(angOf(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t));}}}}
  const phis=[...ang].sort((a,b)=>a-b).filter((v,i,o)=>!i||v-o[i-1]>2e-4);
  // ---- the smooth lip: a few harmonics of the ring's radius, moved in so the band is at least ~0.17 m ----
  const NS=720,RS=Array.from({length:NS},(_,k)=>rayToRing(ring,C,k/NS*TAU)),A=[],B=[];
  for(let h=0;h<=P.harmonics;h++){let sa=0,sb=0;for(let k=0;k<NS;k++){const p=k/NS*TAU;sa+=RS[k]*Math.cos(h*p);sb+=RS[k]*Math.sin(h*p);}A.push(sa/NS*(h?2:1));B.push(sb/NS*2);}
  const fit=p=>A.reduce((s,a,h)=>s+a*Math.cos(h*p)+B[h]*Math.sin(h*p),0),dfit=p=>A.reduce((s,a,h)=>s-a*h*Math.sin(h*p)+B[h]*h*Math.cos(h*p),0);
  let over=-Infinity;for(let k=0;k<NS;k++)over=Math.max(over,fit(k/NS*TAU)-RS[k]);
  const shift=over+P.band-.13,rLip=p=>fit(p)-shift;
  // ---- profiles, normalised to rise 1 over run 1 ----
  const gEase=.4,gMax=1/(1-gEase),G=t=>easedRamp(t,1,gEase),gAspect=Math.tan(P.gentleSlope*deg)/gMax;
  // (the kit's profile is scaled to the requested height: its natural height y follows from the slope at the cap, and the
  // wall keeps the natural proportions, so the cap is the real steepest angle)
  const steep=cap=>{const w=wallProfile(1,cap,.35,1),e=1e-4,top=(w.rise(w.run)-w.rise(w.run-e))/e,y=Math.tan(cap*deg)/top;
    return {W:t=>w.rise(t*w.run),aspect:y/w.run};};
  const S1=steep(P.steepCap),S2=steep(P.deepCap);
  // ---- the lip's parameters, sampled densely along it: height (flush with the ground, or the raised crest), depth, blend
  // between the low end's ramp and the steep wall, and the wall's horizontal run ----
  const xzAt=(phi,r)=>[C[0]+Math.cos(phi)*r,C[1]+Math.sin(phi)*r];
  const lipParams=phi=>{const pd=phi/deg,Rl=rLip(phi),lip=xzAt(phi,Rl),demLip=height(...lip),crestW=arcWeight(pd,P.crestAt,P.crestHalf,P.crestEase);
    const raise=Math.max(0,Yf+P.crest*crestW-demLip),D=demLip+raise-Yf,k=1-arcWeight(pd,P.shallowAt,P.shallowHalf,P.shallowEase);
    const aspect=gAspect*(1-k)+(S1.aspect*(1-crestW)+S2.aspect*crestW)*k;
    return {phi,Rl,lip,demLip,raise,D,crestW,k,run:D/aspect};};
  const LS=Array.from({length:NS},(_,i)=>lipParams(i/NS*TAU));
  // Height inside the lip from the distance to it: h = D·shape(1 − d/run), with D, run and the blend weighted over the lip
  // points nearest p (a smooth field: walls meeting across a narrow part join without a step). The floor is where the wall
  // has run out (h = 0, exactly level).
  const SIG=.45;
  const field=(x,z)=>{let dmin=Infinity;const dist=new Float64Array(NS);
    for(let i=0;i<NS;i++){const a=LS[i].lip,b=LS[(i+1)%NS].lip,ex=b[0]-a[0],ez=b[1]-a[1],L2=ex*ex+ez*ez,t=Math.max(0,Math.min(1,((x-a[0])*ex+(z-a[1])*ez)/L2));
      const d=Math.hypot(x-a[0]-ex*t,z-a[1]-ez*t);dist[i]=d;if(d<dmin)dmin=d;}
    // the kernel narrows toward the lip, so at the lip the field is the lip's own value
    const sig=.02+SIG*Math.min(1,dmin/.6);
    let sw=0,D=0,run=0,k=0,c=0;for(let i=0;i<NS;i++){const e=(dist[i]-dmin)/sig;if(e>3)continue;const w=Math.exp(-e*e),q=LS[i];sw+=w;D+=w*q.D;run+=w*q.run;k+=w*q.k;c+=w*q.crestW;}
    D/=sw;run/=sw;k/=sw;c/=sw;const t=Math.max(0,Math.min(1,1-dmin/run));
    return {h:t<=0?0:D*(G(t)*(1-k)+(S1.W(t)*(1-c)+S2.W(t)*c)*k),t};};
  const per=phis.map(phi=>{const q=lipParams(phi);return {...q,Rr:rayToRing(ring,C,phi)};});
  // ---- vertices: rows per angle (radial fractions of the lip radius), then the lip band to the ring and the outer face ----
  const F=skateFrame({x:C[0],z:C[1],theta:0,y:Yf});
  const nIn=P.wallRows+8,inRows=Array.from({length:nIn},(_,i)=>{const u=i/(nIn-1);return .16+.84*(1-(1-u)**1.7);}),bandRows=[0,.5,1];
  const nA=phis.length,V=[],TT=[];   // V[a][r] = [x,y,z]; TT: the wall parameter t of each inner vertex (paint)
  const local=(x,z)=>[x-C[0],z-C[1]];
  for(let a=0;a<nA;a++){const q=per[a],row=[],tr=[];
    for(let r=0;r<nIn;r++){const [x,z]=xzAt(q.phi,q.Rl*inRows[r]);if(r===nIn-1){row.push(F.at(...local(x,z),q.D));tr.push(1);continue;}
      const f=field(x,z);row.push(F.at(...local(x,z),f.h));tr.push(f.t);}
    for(let b=1;b<bandRows.length;b++){const [x,z]=xzAt(q.phi,b===bandRows.length-1?q.Rr:q.Rl+(q.Rr-q.Rl)*bandRows[b]);
      row.push(F.at(...local(x,z),height(x,z)+q.raise-Yf));}
    {const p=xzAt(q.phi,q.Rr);row.push(F.at(...local(...p),height(...p)-Yf));}   // outer face bottom (on the ground)
    V.push(row);TT.push(tr);}
  const centre=F.at(0,0,0),iLip=nIn-1,iRing=iLip+bandRows.length-1,iBottom=iRing+1;
  // ---- normals for drawing: smooth over the floor, wall and lip band (the lip reads rounded), hard at the outer face ----
  const N=V.map(r=>r.map(()=>[0,0,0]));
  const fn=(a,b,c)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];};
  const quads=[];for(let a=0;a<nA;a++){const b=(a+1)%nA;for(let r=0;r<iRing;r++)quads.push([a,b,r]);}
  const split=(a,b,r)=>{const p=V[a][r],q=V[b][r],p1=V[a][r+1],q1=V[b][r+1];
    const d1=Math.hypot(p[0]-q1[0],p[2]-q1[2]),d2=Math.hypot(q[0]-p1[0],q[2]-p1[2]);
    return d1<=d2?[[[a,r],[b,r],[b,r+1]],[[a,r],[b,r+1],[a,r+1]]]:[[[a,r],[b,r],[a,r+1]],[[b,r],[b,r+1],[a,r+1]]];};
  const tris=[];
  for(let a=0;a<nA;a++){const b=(a+1)%nA;tris.push({ids:[null,[a,0],[b,0]],zone:'floor',r:-1,a});}
  const Y0=centre[1];
  for(const [a,b,r] of quads)for(const ids of split(a,b,r)){const level=ids.every(([i,j])=>V[i][j][1]===Y0);tris.push({ids,zone:r>=iLip?'band':level?'floor':'wall',r,a});}
  const pos=id=>id?V[id[0]][id[1]]:centre;
  for(const t of tris){let [p,q,s]=t.ids.map(pos),n=fn(p,q,s);if(n[1]<0){t.ids=[t.ids[0],t.ids[2],t.ids[1]];n=n.map(v=>-v);}t.n=n;
    if(t.zone!=='floor')for(const id of t.ids)if(id){const m=N[id[0]][id[1]];m[0]+=n[0];m[1]+=n[1];m[2]+=n[2];}}
  const unit=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  const normalOf=id=>{if(!id)return [0,1,0];const v=V[id[0]][id[1]];return v[1]===Y0?[0,1,0]:unit(N[id[0]][id[1]]);};
  // ---- paint, block by block along the mesh's own lines (radial columns and rows that follow the lip): a yellow lip (the
  // band and the wall's top row), broad blocks of colour on the walls, a cream floor with one green block; a soft
  // per-vertex wear toward the bare grey concrete, strongest where the wheels run (the floor and the wall's foot) ----
  const Cc=BOWL_COLOURS;
  // [from°, to°, lower wall, upper wall] (upper: ρ ≥ 0.84 of the lip radius)
  const SECTORS=[[178,248,Cc.deep,Cc.teal],[248,300,Cc.teal,Cc.deep],[300,338,Cc.leaf,Cc.leaf],[338,28,Cc.cream,Cc.lilac],[28,96,Cc.lilac,Cc.cream],
    [96,138,Cc.teal,Cc.teal],[138,178,Cc.leaf,Cc.accent]];
  const inSector=(d,f,t)=>f<t?d>=f&&d<t:d>=f||d<t;
  const colMid=a=>{const p0=per[a].phi,p1=per[(a+1)%nA].phi;let m=(p0+((p1-p0+TAU)%TAU)/2)%TAU;return m/deg;};
  const blockOf=(a,r)=>{if(r>=iLip-1)return Cc.lip;const d=colMid(a),rho=r<0?0:(inRows[r]+inRows[r+1])/2;
    if(rho<.5)return rho>.22&&inSector(d,205,262)?Cc.leaf:Cc.cream;
    const sec=SECTORS.find(([f,t])=>inSector(d,f,t));return rho>=.84?sec[3]:sec[2];};
  const rgb=h=>{const v=parseInt(h.slice(1),16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];};
  const hex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
  const wearAt=(p,amount)=>{const x=p[0],z=p[2],n=(Math.sin(x*1.7+z*.9)+Math.sin(x*-.8+z*2.3+1.3)+Math.sin((x+z)*3.1))/3;
    return Math.max(0,Math.min(.8,amount+n*.3));};
  const mix=(a,b,w)=>a.map((v,i)=>v+(b[i]-v)*w);
  const paintTri=t=>{const pts=t.ids.map(pos),block=blockOf(t.a,t.r),base=rgb(block),grey=rgb(Cc.concrete);
    if(block===Cc.concrete)return pts.map(p=>hex(mix(base,rgb(Cc.worn),wearAt(p,.25))));
    // wheels wear the paint most on the floor and the wall's foot, least near the lip
    const h=pts.map(p=>(p[1]-Y0)/Math.max(.3,per[t.a].D));
    return pts.map((p,k)=>hex(mix(base,grey,wearAt(p,block===Cc.lip?.05:.32-.25*Math.min(1,h[k])))));};
  // ---- emit: drawing and support from the same vertices ----
  const kit=createSkateKit(F,{source:'perlaDistrict:bowl',feature:FEATURE}),src='perlaDistrict:bowl';
  const slopeCap=capability(FEATURE,true),restCap=capability(FEATURE,false);
  const extra={replacesTerrain:true,maxReferenceY:Yf+P.crest+6};
  const counts={floor:0,wall:0,band:0,flagged:0,face:0};
  for(const t of tris){const pts=t.ids.map(pos),colour=paintTri(t);
    if(!kit.emit('concrete',...pts,colour,...t.ids.map(normalOf)))continue;
    const n=unit(t.n),slope=Math.acos(Math.min(1,n[1]))/deg,flag=t.zone==='wall'&&slope>2;
    if(kit.addTop(pts,flag?slopeCap:restCap,src+':'+t.zone,extra)){counts[t.zone]++;if(flag)counts.flagged++;}}
  // outer face (sea side, where the lip stands above the ground): drawn, not support; bare poured concrete, smooth shading
  const colliders=[],faceN=a=>{const p=V[a][iRing];return unit([p[0]-C[0],0,p[2]-C[1]]);};
  const faceColour=p=>hex(mix(rgb(Cc.face),rgb(Cc.worn),wearAt(p,.3)));
  for(let a=0;a<nA;a++){const b=(a+1)%nA,qa=per[a],qb=per[b];if(qa.raise<.01&&qb.raise<.01)continue;
    const T0=V[a][iRing],T1=V[b][iRing],B0=V[a][iBottom],B1=V[b][iBottom],na=faceN(a),nb=faceN(b),out=unit([na[0]+nb[0],0,na[2]+nb[2]]);
    const f=fn(T0,B0,B1),dir=f[0]*out[0]+f[2]*out[2]>0;
    if(dir){kit.emit('concrete',T0,B0,B1,[T0,B0,B1].map(faceColour),na,na,nb);kit.emit('concrete',T0,B1,T1,[T0,B1,T1].map(faceColour),na,nb,nb);}
    else{kit.emit('concrete',T0,B1,B0,[T0,B1,B0].map(faceColour),na,nb,na);kit.emit('concrete',T0,T1,B1,[T0,T1,B1].map(faceColour),na,nb,nb);}
    counts.face+=2;}
  // solids under the raised lip band: one prism per band quad whose band stands ≥ 5 cm above the ground; its top is the
  // lowest drawn band height over the quad (inside the shell), its foot 5 cm under the lowest ground
  for(let a=0;a<nA;a++){const b=(a+1)%nA;if(Math.min(per[a].raise,per[b].raise)<.05)continue;
    // inner side 40 % of the band out from the lip (the wheel rolls over the lip onto the band, never into a body face)
    const inset=(p,q)=>[p[0]+(q[0]-p[0])*.4,p[1],p[2]+(q[2]-p[2])*.4],ia=inset(V[a][iLip],V[a][iRing]),ib=inset(V[b][iLip],V[b][iRing]);
    const drawn=[V[a][iLip],V[b][iLip],V[a][iLip+1],V[b][iLip+1],V[a][iRing],V[b][iRing]].map(p=>p[1]);
    const corners=[ia,ib,V[b][iRing],V[a][iRing]],ground=[...corners,V[a][iBottom],V[b][iBottom]].map(p=>height(p[0],p[2]));
    const top=Math.min(...drawn)-1e-4,bottom=Math.min(...ground)-.05;if(top<bottom+.05)continue;
    let outer=corners.map(p=>({x:p[0],z:p[2]}));const ar=outer.reduce((s,p,i)=>{const q=outer[(i+1)%4];return s+p.x*q.z-q.x*p.z;},0);if(ar<0)outer=outer.reverse();
    colliders.push({outer,holes:[],minY:bottom,maxY:top,surface:'pavement',support:false,source:src+':lip-body'});}
  const R=kit.result();
  // ---- render cut: the terrain inside the ring (its convex pieces, vertical sides) ----
  const lipRing=per.map(q=>q.lip);
  const stats={tops:R.tops.length,flagged:counts.flagged,drawTriangles:R.counts.drawTriangles,bodies:colliders.length,angles:nA,
    floorY:Yf,maxLipY:+Math.max(...per.map(q=>q.demLip+q.raise)).toFixed(3),maxRaise:+Math.max(...per.map(q=>q.raise)).toFixed(3),
    depth:{min:+Math.min(...per.map(q=>q.D)).toFixed(3),max:+Math.max(...per.map(q=>q.D)).toFixed(3)},
    band:{min:+Math.min(...per.map(q=>q.Rr-q.Rl)).toFixed(3),max:+Math.max(...per.map(q=>q.Rr-q.Rl)).toFixed(3)},
    lipRadius:{min:+Math.min(...per.map(q=>q.Rl)).toFixed(3),max:+Math.max(...per.map(q=>q.Rl)).toFixed(3)}};
  return {tops:R.tops,colliders,batch:R.batches.get('concrete'),centre:C,frame:{x:F.x,z:F.z,theta:F.theta,y:F.y},F,
    lipRing,per,stats};
}
