/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// La Perla district visuals — © 2026 VibezZzCoder, MIT. Every position/dimension comes from sj-perla-district-layout.js,
// which owns the matching solids. References: curid=72372072, curid=72372077, curid=72372066, curid=86543919 street fronts (patched asphalt,
// louvred openings, solid balcony fronts on brackets, roof rails, utility poles and lines), curid=99177715, curid=158401715, curid=86543964, curid=86543932 flat roofs with
// low parapets, roof rooms and water tanks, curid=100291752, curid=137763018 court and bleachers, curid=86543904, curid=86543903 east path timber rail, 85 dark boulders on the
// tan shelf, curid=80155724, curid=109811940, curid=80251220, curid=109811939, curid=86543932, curid=137763018 palms.
import * as THREE from 'three/webgpu';
import {palmInstances} from './sj-palm.js';
import {inRing,segmentDistance} from './sj-plaza-layout.js';
import {BEACH,ROCK_EAST,ROCK_WEST} from './sj-perla-district-layout.js';

const TRIM='#f1efe8',SHUTTER=['#f3f2ec','#f3f2ec','#ece6d2','#2f5d4a','#f3f2ec'],DOOR=['#3a332d','#5a3b2b','#2e4f6e','#6f2d29','#3f4a3c'];
const FOUND=['#8d8981','#97938a'],hash01=(a,b)=>{let h=Math.imul(a*73856093^b*19349663,2654435761)>>>0;h^=h>>>15;return (h>>>0)/4294967296;};
// roof-slab lips (pale weathered concrete, Wikimedia Commons curid=86543964, curid=86543903) and base-band pairs (Wikimedia Commons curid=86543964: green, cream, ochre).
const LIP=['#d9d5ca','#cfcabe','#e4e1d8'],BAND=['#4f8a4a','#e7dfc9','#c9a24a','#7d7a73'];
const shade=(h,k)=>'#'+[1,3,5].map(o=>Math.round(parseInt(h.slice(o,o+2),16)*k).toString(16).padStart(2,'0')).join('');
const RECESS='#2b2c2c',POLE='#9c9a93',LINE='#262626',TIMBER='#8b6a43',BOARD='#f4f4f1';

// Wikimedia Commons curid=100291752 (2014 finish; Wikimedia Commons curid=137763018 shows the same layout in 2010): blue playing area, darker grey-blue surround and keys,
// muted red centre/key circles, white lines. No lettering or logos. 320×184 px over the pitch (≈9 cm per px).
function courtTexture(textures,L,W){
  const cw=320,ch=184,canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;const ctx=canvas.getContext('2d');
  const sx=cw/L,sy=ch/W,X=s=>s*sx,Y=t=>t*sy,m={s:.35,t:.65},pl=L-2*m.s,pw=W-2*m.t;
  ctx.fillStyle='#4f6f86';ctx.fillRect(0,0,cw,ch);                     // surround
  ctx.fillStyle='#78b3d6';ctx.fillRect(X(m.s),Y(m.t),X(pl),Y(pw));     // playing area
  let seed=7741;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let i=0;i<5000;i++){ctx.fillStyle=random()<.5?'rgba(255,255,255,.05)':'rgba(0,20,40,.06)';ctx.fillRect(random()*cw,random()*ch,1,1);}
  const mid=W/2,line=Math.max(1.2,.06*sx);ctx.lineWidth=line;
  for(const end of [0,1]){const base=end?L-m.s:m.s,dir=end?-1:1;
    ctx.fillStyle='#4f6f86';ctx.fillRect(X(Math.min(base,base+dir*5.8)),Y(mid-2.45),X(5.8),Y(4.9));     // key
    ctx.fillStyle='#b8575a';ctx.beginPath();ctx.ellipse(X(base+dir*5.8),Y(mid),X(1.8),Y(1.8),0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffffff';ctx.strokeRect(X(Math.min(base,base+dir*5.8)),Y(mid-2.45),X(5.8),Y(4.9));
    ctx.beginPath();ctx.ellipse(X(base+dir*5.8),Y(mid),X(1.8),Y(1.8),0,0,Math.PI*2);ctx.stroke();
    // Three-point line: straight 0.9 m from the sidelines, arc of 6.75 m round the rim (1.575 m in from the baseline).
    const rim=base+dir*1.575,r=6.75,side=Math.min(pw/2-.0,6.6),ang=Math.asin(side/r),reach=rim+dir*r*Math.cos(ang);
    ctx.beginPath();ctx.moveTo(X(base),Y(mid-side));ctx.lineTo(X(reach),Y(mid-side));
    ctx.ellipse(X(rim),Y(mid),X(r),Y(r),0,end?Math.PI+ang:-ang,end?Math.PI-ang:ang,end===1);
    ctx.lineTo(X(base),Y(mid+side));ctx.stroke();}
  ctx.fillStyle='#b8575a';ctx.beginPath();ctx.ellipse(X(L/2),Y(mid),X(1.8),Y(1.8),0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ffffff';ctx.beginPath();ctx.ellipse(X(L/2),Y(mid),X(1.8),Y(1.8),0,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(X(L/2),Y(m.t));ctx.lineTo(X(L/2),Y(W-m.t));ctx.stroke();
  ctx.strokeRect(X(m.s),Y(m.t),X(pl),Y(pw));
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=4;textures.add(tx);return tx;
}

// Wikimedia Commons curid=72372072, curid=72372077, curid=72372066, curid=86543919: patched dark asphalt — grey base, darker and lighter repair rectangles, a few cracks. One 256 px tile
// per 8 m (sj-plaza 'patched' kind); the colour lives in the texture (white material tint).
export function patchedTexture(textures) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  let seed=51713;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  ctx.fillStyle='#6f7371';ctx.fillRect(0,0,256,256);
  for(let i=0;i<9;i++){const w=20+random()*70,h=14+random()*46,x=random()*256,y=random()*256,dark=random()<.6;
    ctx.fillStyle=dark?'rgba(55,58,58,.55)':'rgba(140,142,138,.35)';for(const dx of [0,-256])for(const dy of [0,-256])ctx.fillRect(x+dx,y+dy,w,h);}
  for(let i=0;i<9000;i++){const k=random();ctx.fillStyle=k<.5?'rgba(30,32,32,.16)':'rgba(190,190,182,.12)';ctx.fillRect(random()*256,random()*256,1,1);}
  ctx.strokeStyle='rgba(35,36,36,.45)';ctx.lineWidth=1;
  for(let i=0;i<6;i++){let x=random()*256,y=random()*256;ctx.beginPath();ctx.moveTo(x,y);for(let k=0;k<5;k++){x+=(random()-.5)*30;y+=(random()-.5)*30;ctx.lineTo(x,y);}ctx.stroke();}
  const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.anisotropy=4;
  textures.add(tx);return tx;
}

export function buildPerlaDistrict(n,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}) {
  const {COURT_DIMS,RAIL}=n.constants;
  // Box from a to b (local +X along the segment; bake applies Ry·Rz: rz = asin(dy/l), ry = atan2(−dz,dx)).
  const bar=(a,b,w,h,colour,kind='facade')=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);if(l<1e-4)return;
    bake(box,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,l,h,w,colour,Math.atan2(-dz,dx),kind,Math.asin(Math.max(-1,Math.min(1,dy/l))));};
  // Edge frame: u along a→b, +d outward (the plaza convention), y absolute.
  const frame=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
    return {length,ux,uz,angle:-Math.atan2(uz,ux),point:(u,y,d=0)=>[a[0]+ux*u-uz*d,y,a[1]+uz*u+ux*d]};};
  const lbox=(f,u,y,d,w,h,depth,c,kind='facade')=>bake(box,...f.point(u,y,d),w,h,depth,c,f.angle,kind);
  const streetLines=n.streets.flatMap(s=>s.points.slice(1).map((b,i)=>({a:s.points[i],b,half:s.half})));
  const houseRings=n.houses.map(h=>h.outer);
  const inOther=(x,z,self)=>houseRings.some(r=>r!==self&&inRing(x,z,r));
  let edges=0,openings=0,balconies=0,rooftop=0,found=0,lips=0,bands=0,doors=0,courseHits=0;

  // ---- Houses: low roof parapets on every mass (Wikimedia Commons curid=99177715, curid=86543964, curid=86543932), a few roof rooms and tanks; street-facing fronts get
  // the opening kit (65/66/81/84): louvred windows, narrow doors at the local street, solid balconies on two brackets. ----
  for(const h of n.houses){const r=h.outer,signed=r.reduce((s,a,i)=>{const c=r[(i+1)%r.length];return s+a[0]*c[1]-c[0]*a[1];},0);
    const seed=h.id%1000,floor=Math.max(...r.map(p=>height(p[0],p[1])));
    for(let i=0;i<r.length;i++){let a=r[i],b=r[(i+1)%r.length];if(signed>0)[a,b]=[b,a];const f=frame(a,b);if(f.length<.6)continue;
      // An edge clipped at an earlier area's wall (layout wallLines) stays plain: the wall's own face is there.
      if(h.wallLines?.some(({p,n})=>[a,b].every(q=>Math.abs((q[0]-p[0])*n[0]+(q[1]-p[1])*n[1])<.02)))continue;
      // Parapet: inside the footprint, flush with the facade, on its own (hidden) top 0.55 m above the roof.
      // (outer face 1 cm proud of the facade plane; bottom on the roof plane, facing down, never seen).
      lbox(f,f.length/2,h.roof+.275,-.07,f.length,.55,.16,h.colour);
      const mid=f.point(f.length/2,0,1.0),party=inOther(mid[0],mid[2],r);
      // two (Wikimedia Commons curid=86543964, curid=86543903: the concrete roof slab shows as a pale projecting lip on every exposed side): a
      // coping slab on the parapet, 0.15 m proud, on every edge that is not a party wall.
      if(!party){lbox(f,f.length/2,h.roof+.61+(seed%LIP.length)*.012,.1,f.length+.2,.12,.34,LIP[seed%LIP.length]);lips++;}   /* neighbours' lips in other tones meet 12 mm apart, not on one plane*/
      if(f.length<2.6||party)continue;
      const street=streetLines.some(s=>segmentDistance(mid[0],mid[2],s.a,s.b)<s.half+2.6);
      // Sea-facing fronts (blank shore rows; Wikimedia Commons curid=80251220, curid=86543904, curid=86543903, curid=109811939, curid=86543932): the ground falls away or meets the beach/rock
      // shelves within 12 m outward, and no other house stands in front within 4 m.
      const seaward=!street&&(()=>{const g0=height(mid[0],mid[2]);for(const d of [6,12]){const q=f.point(f.length/2,0,d);
        if(inRing(q[0],q[2],BEACH)||inRing(q[0],q[2],ROCK_EAST)||inRing(q[0],q[2],ROCK_WEST)||height(q[0],q[2])<Math.min(.3,g0-2))return true;}return false;})()
        &&!inOther(...(p=>[p[0],p[2]])(f.point(f.length/2,0,3.5)),r);
      // rear and side faces over open ground (nothing within 2 m) were blank coloured walls.
      // They get the same louvred openings, fewer (about a third of the bays left blank) and no doors or balconies.
      const rear=!street&&!seaward&&f.length>=2.6&&!inOther(...(p=>[p[0],p[2]])(f.point(f.length/2,0,1.4)),r);   // alley faces from 1.4 m
      if(!street&&!seaward&&!rear)continue;
      edges++;
      const bays=Math.max(1,Math.floor(f.length/2.7)),gs=[];for(let j=0;j<bays;j++){const p=f.point((j+.5)*f.length/bays,0,.5);gs.push(height(p[0],p[2]));}
      const gMax=Math.max(...gs),floors=Math.max(1,Math.min(4,Math.floor((h.roof-gMax+.4)/2.9))),door=Math.floor((seed/7)%bays);
      const shutter=SHUTTER[seed%SHUTTER.length],doorC=DOOR[(seed>>2)%DOOR.length];
      const banded=hash01(seed,77)<.6,band=hash01(seed,78)<.3?BAND[seed%BAND.length]:shade(h.colour,.7);
      // Seams: on downhill rear and sea faces the wall below the house floor (the highest ground under the footprint) is an
      // exposed concrete-block foundation (Wikimedia Commons curid=80251220, curid=86543904, curid=109811939, curid=86543932), stepped every 3 m on the lower ground, not plaster.
      const courses=[];
      if(rear||seaward)for(let u=0;u<f.length-.05;u+=3){const w=Math.min(3,f.length-u),p0=f.point(u,0,.3),p1=f.point(u+w,0,.3),g=Math.min(height(p0[0],p0[2]),height(p1[0],p1[2]));
        const top=Math.min(floor-.05,h.roof-1.2,seaward?g+.85:Infinity);if(top-g<.7)continue;const k=Math.round(u/3)%2*.012;   /* neighbouring blocks (1 cm lap) differ by 12 mm at front and back*/
         lbox(f,u+w/2,(g-.15+top)/2,.02,w+.01,top-g+.15,.05+2*k,FOUND[(seed+Math.round(u))%2]);
        // a block-course line breaks the plain band (Wikimedia Commons curid=86543904, curid=86543932 exposed block).
        for(let y=g+.6;y<top-.2;y+=1.2)courses.push({u0:u,u1:u+w,y,k});found++;}   /* drawn below, cut at door surrounds */
      // (Wikimedia Commons curid=86543964: a painted base band, often a contrasting colour, on the lower metre of the plaster): on bays whose
      // ground is within 0.75 m of the house floor (elsewhere the block footing shows), 1 m above the local ground.
      if(banded)for(let j=0;j<bays;j++){const u=(j+.5)*f.length/bays,g=gs[j];if((rear||seaward)&&floor-g>.75)continue;
        lbox(f,u,g+.42,.022,f.length/bays+.01,1.04,.025,band);bands++;}   /* back +0.95 cm, front +3.45 cm: ≥ 9.5 mm off every footing, sill, recess and door-frame face*/
      // a back door on rear faces where the ground meets the floor (Wikimedia Commons curid=72372077, curid=86543919 side and back entries).
      let backDoor=rear&&f.length>=3.4&&hash01(seed,i*3+1)<.55?Math.floor(hash01(seed,i)*bays):-1;
      // Door-focused z-fight follow-up: a 5 cm block-course stripe ran over door surrounds on
      // the same front plane. Stripes stop 2 cm outside every surround they cross: alley dead-end trims (1.45 m), back and
      // street door frames and lintels (1.22 m). Counted before the cut (stats.courseHits), none remain after.
      {const o=f.point(0,0,0),e=f.point(1,0,0),dx=e[0]-o[0],dz=e[2]-o[2],cuts=[];
        for(const d of n.deadEnds??[]){if(d.kind!=='door')continue;const rx=d.x-o[0],rz=d.z-o[2],u=rx*dx+rz*dz,off=Math.abs(rx*dz-rz*dx);
          if(off<.45&&u>-1&&u<f.length+1)cuts.push([u-.745,u+.745,d.y-.1,d.y+2.5]);}
        for(let j=0;j<bays;j++){const u=(j+.5)*f.length/bays,g=gs[j];
          if(j===backDoor&&floor-g<.45&&g+2.3<h.roof-.5||street&&j===door&&g+2.15<=h.roof-.5)cuts.push([u-.63,u+.63,g-.1,g+2.4]);}
        for(const c of courses){let segs=[[c.u0,c.u0+Math.min(3,f.length-c.u0)]];
          for(const [a,b,y0,y1] of cuts){if(c.y+.025<y0||c.y-.025>y1)continue;const nx=[];
            for(const [s0,s1] of segs){if(s1<=a||s0>=b){nx.push([s0,s1]);continue;}courseHits++;if(a>s0)nx.push([s0,a]);if(b<s1)nx.push([b,s1]);}segs=nx;}
          for(const [s0,s1] of segs)if(s1-s0>.05)lbox(f,(s0+s1)/2,c.y,.05+c.k,s1-s0,.05,.02,'#76726b');}}
      for(let fl=0;fl<floors;fl++)for(let j=0;j<bays;j++){const u=(j+.5)*f.length/bays,g=gs[j];
        if(fl===0&&j===backDoor&&floor-g<.45&&g+2.3<h.roof-.5){lbox(f,u,g+1.06,.03,.98,2.2,.08,RECESS);lbox(f,u,g+1.04,.06,.86,2.12,.05,doorC);
          lbox(f,u,g+2.26,.07,1.22,.14,.14,TRIM);openings++;doors++;continue;}
        if(street&&fl===0&&j===door){const top=g+2.15;if(top>h.roof-.5)continue;              // narrow door at the local street
          lbox(f,u,g+1.06,.03,.98,2.2,.08,RECESS);lbox(f,u,g+1.04,.06,.86,2.12,.05,doorC);lbox(f,u,top+.1,.07,1.22,.16,.14,TRIM);openings++;continue;}
        let bottom=fl?gMax+fl*2.9+.95:g+1.0;if(rear){if(hash01(seed,i*13+j*5+fl)<.15)continue;bottom=Math.max(bottom,floor+.95+fl*2.9);}   // 15 % blank
        const top=bottom+1.15;if(top>h.roof-.45||bottom<g+.7)continue;
        // Recess, a pair of horizontal-louvre leaves with three slat shadows across them, a sill.
        // Rear openings (seams): a cheaper three-part window — recess, one louvred leaf, sill.
        // mixed apertures — some dark louvres, some open dark recesses with a grille bar, a few smaller.
        if(rear){const v=hash01(seed+j*31,i*7+fl),sz=v<.2?.75:1;lbox(f,u,bottom+.575,.02,1.04*sz,1.19*sz,.06,RECESS);
          if(v>=.35)lbox(f,u,bottom+.575,.055,.9*sz,1.08*sz,.04,v<.6?['#2f4a3a','#5a3b2b','#33464f'][(seed+j)%3]:shutter);else lbox(f,u,bottom+.575,.05,.06,1.1*sz,.03,'#3a3a38');
          lbox(f,u,bottom-.04,.08,1.16*sz,.08,.18,TRIM);openings++;continue;}
        lbox(f,u,bottom+.575,.02,1.04,1.19,.06,RECESS);
        for(const s of [-1,1])lbox(f,u+s*.255,bottom+.575,.055,.47,1.11,.04,shutter);
        for(const k of [-1,0,1])lbox(f,u,bottom+.575+k*.27,.08,.98,.025,.02,'#8f8f89');
        lbox(f,u,bottom-.04,.08,1.16,.08,.18,TRIM);openings++;}
      // (Wikimedia Commons curid=86543903: a cantilevered slab with a light rail on the back of the blue house): some rear faces, first floor.
      if(rear&&floors>1&&f.length>=3.6&&(seed+i)%3===1){const y=Math.max(floor,gMax)+2.9-.08,w=Math.min(f.length*.55,4),u=f.length/2;
        if(y+1.2<h.roof){lbox(f,u,y,.42,w,.14,.84,TRIM);for(const s of [-1,1])lbox(f,u+s*(w/2-.04),y+.5,.8,.05,.9,.05,'#3a3a38');
          lbox(f,u,y+.95,.8,w,.05,.05,'#3a3a38');for(let k=-Math.floor(w/2/.5);k<=Math.floor(w/2/.5);k++)lbox(f,u+k*.5,y+.5,.8,.025,.9,.025,'#3a3a38');balconies++;}}
      // Shore fronts: projecting floor slabs (83/86/87 tiered terraces), the first with a solid painted terrace front.
      if(seaward&&floors>1&&(seed+i)%2===0)for(let fl=1;fl<floors;fl++){const y=gMax+fl*2.9-.08,w=f.length*.9,u=f.length/2;
        lbox(f,u,y,.35,w,.14,.7,TRIM,'solid');if(fl===1)lbox(f,u,y+.5,.66,w,.86,.08,h.colour,'solid');balconies++;}
      // Wikimedia Commons curid=72372072, curid=72372077: one projecting slab with a solid painted front on two brackets, upper floor, some fronts only.
      if(street&&floors>1&&f.length>=3.2&&(seed+i)%3===0){const y=gMax+2.9-.08,w=Math.min(f.length*.7,5.5),u=f.length/2;
        lbox(f,u,y,.45,w,.16,.9,TRIM,'solid');lbox(f,u,y+.55,.86,w,.94,.1,h.colour,'solid');
        for(const s of [-1,1])lbox(f,u+s*(w/2-.3),y-.3,.25,.16,.44,.46,TRIM);balconies++;}}
    // Roof room (68/82) or a water tank (25/82) on some roofs, fully inside the footprint.
    const c=r.reduce((s,p)=>[s[0]+p[0]/r.length,s[1]+p[1]/r.length],[0,0]),kind=seed%9;
    if(h.wallLines)continue;
    if(kind<2&&[[-1.8,-1.8],[1.8,-1.8],[1.8,1.8],[-1.8,1.8]].every(([dx,dz])=>inRing(c[0]+dx,c[1]+dz,r))){
      bake(box,c[0],h.roof+1.1,c[1],2.4,2.2,2.4,h.colour,(seed%7)*.2,'solid');bake(box,c[0],h.roof+2.25,c[1],2.6,.12,2.6,'#b8b4aa',(seed%7)*.2,'solid');rooftop++;}
    else if(kind<4&&[[-.8,-.8],[.8,-.8],[.8,.8],[-.8,.8]].every(([dx,dz])=>inRing(c[0]+dx,c[1]+dz,r))){
      bake(cylinder,c[0],h.roof+.75,c[1],.55,1.5,.55,kind===2?'#2b2b2b':'#e9e7df',0,'solid');rooftop++;}}

  // ---- two: lane retaining walls (layout `retaining`; Wikimedia Commons curid=86543919), painted, with a pale coping; non-shadow pool. ----
  let walls=0;
  for(const q of n.retaining??[]){const f=frame(q.a,q.b);if(f.length<.3)continue;const d=q.thick/2,sgn=((q.b[0]-q.a[0])*q.n[1]-(q.b[1]-q.a[1])*q.n[0])<0?1:-1;
    // frame's +d is to the left of a→b; the wall body lies on the n side.
    const D=sgn*d,top=Math.max(q.topA,q.topB),h=top-q.bottom;
    lbox(f,f.length/2,q.bottom+h/2,D,f.length+.02,h,q.thick,q.colour);
    lbox(f,f.length/2,top+.04,D,f.length+.06,.08,q.thick+.08,'#dcd8cc');walls++;}
  // ---- Utility poles and sagging lines between neighbours (65/66/81). ----
  // Cross-arms across the line to the neighbouring pole; two lines hang between the arm ends (0.7 m sag at mid-span).
  const arm=p=>{const q=p.prev>=0?n.poles[p.prev]:n.poles.find(o=>o.prev===n.poles.indexOf(p));if(!q)return [1,0];
    const d=Math.hypot(q.x-p.x,q.z-p.z)||1;return [-(q.z-p.z)/d,(q.x-p.x)/d];};
  for(const p of n.poles){bake(cylinder,p.x,p.y+3.7,p.z,.11,7.6,.11,POLE,0,'solid');const [ax,az]=arm(p);
    bar([p.x-ax*.65,p.y+7.1,p.z-az*.65],[p.x+ax*.65,p.y+7.1,p.z+az*.65],.1,.1,'#6d6a64');}
  for(const p of n.poles){if(p.prev<0)continue;const q=n.poles[p.prev],[ax,az]=arm(p),[bx,bz]=arm(q),sg=ax*bx+az*bz<0?-1:1;
    for(const o of [-.5,.5]){const a=[p.x+ax*o,p.y+7.17,p.z+az*o],b=[q.x+bx*o*sg,q.y+7.17,q.z+bz*o*sg],pts=[];
      for(let k=0;k<=4;k++){const t=k/4;pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-.7*4*t*(1-t),a[2]+(b[2]-a[2])*t]);}
      for(let k=0;k<4;k++)bar(pts[k],pts[k+1],.025,.025,LINE);}}

  // ---- Court surface: the terrain triangles under the pitch, clipped to it, UV in pitch metres. ----
  const C=n.court;
  {const pos=[],uv=[],ring=C.ring,{x0,z0,step}=n.grid,sign=Math.sign(ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1];},0));
    const clip=poly=>{let out=poly;for(let j=0;j<ring.length&&out.length;j++){const a=ring[j],b=ring[(j+1)%ring.length],input=out;out=[];
        const d=p=>sign*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
        for(let k=0;k<input.length;k++){const p=input[k],q=input[(k+1)%input.length],dp=d(p),dq=d(q);if(dp>=0)out.push(p);
          if((dp>=0)!==(dq>=0)){const s=dp/(dp-dq);out.push(p.map((v,i)=>v+(q[i]-v)*s));}}}return out;};
    // The shared heightfield's own cells (same diagonal split as sj-plaza overlay: [a,c,b],[b,c,d]); vertices exact.
    const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),P=(px,pz)=>[px,height(px,pz),pz];
    for(let z=Math.floor((Math.min(...zs)-z0)/step);z<=Math.ceil((Math.max(...zs)-z0)/step);z++)
      for(let x=Math.floor((Math.min(...xs)-x0)/step);x<=Math.ceil((Math.max(...xs)-x0)/step);x++){
        const X=x0+x*step,Z=z0+z*step,a=P(X,Z),b=P(X+step,Z),c=P(X,Z+step),d=P(X+step,Z+step);
        for(const tri of [[a,c,b],[b,c,d]]){const poly=clip(tri);
          for(let q=1;q<poly.length-1;q++){const [p0,p1,p2]=[poly[0],poly[q],poly[q+1]];
            if(Math.abs((p1[0]-p0[0])*(p2[2]-p0[2])-(p1[2]-p0[2])*(p2[0]-p0[0]))<1e-9)continue;
            for(const p of [p0,p1,p2]){pos.push(...p);const rx=p[0]-C.origin[0],rz=p[2]-C.origin[1];uv.push((rx*C.u[0]+rz*C.u[1])/C.length,1-(rx*C.v[0]+rz*C.v[1])/C.width);}}}}
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.computeVertexNormals();g.computeBoundingSphere();
    const m=mat({map:courtTexture(textures,C.length,C.width),roughness:.82,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    const mesh=new THREE.Mesh(g,m);mesh.name='sj-plaza-perladistrict-court';mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);}
  // Hoops (Wikimedia Commons curid=100291752: dark supports, rectangular white boards, orange rims) facing into the court.
  for(const hp of C.hoops){const P=(s,t,y)=>{const [x,z]=C.P(s,t);return [x,y,z];},t=C.width/2,dir=hp.dir;
    bake(cylinder,hp.x,hp.y+(COURT_DIMS.rim+1.15)/2-.1,hp.z,COURT_DIMS.pole,COURT_DIMS.rim+1.25,COURT_DIMS.pole,'#3b4046',0,'solid');
    bar(P(hp.s,t,hp.y+COURT_DIMS.rim+.95),P(hp.s+dir*.95,t,hp.y+COURT_DIMS.rim+.95),.1,.1,'#3b4046','solid');
    const bc=P(hp.s+dir*.95,t,hp.y+COURT_DIMS.rim+.45),ang=Math.atan2(-C.u[1],C.u[0]);
    bake(box,bc[0],bc[1],bc[2],.05,COURT_DIMS.board[1],COURT_DIMS.board[0],BOARD,ang,'solid');
    const rimC=P(hp.s+dir*1.2,t,hp.y+COURT_DIMS.rim);
    const tor=own(new THREE.TorusGeometry(.23,.012,4,16));tor.rotateX(Math.PI/2);bake(tor,rimC[0],rimC[1],rimC[2],1,1,1,'#d4612c',0,'facade');}
  // Bleacher (Wikimedia Commons curid=137763018: white open tiers on the grass), one solid tier per step, matching the layout's support prisms.
  if(C.bleacher){const b=C.bleacher,ang=Math.atan2(-C.u[1],C.u[0]),T=COURT_DIMS.bleacher.tread,len=b.s1-b.s0,legs=Math.max(2,Math.round(len/2)+1);
    // Wikimedia Commons curid=137763018: open white seat planks on light grey frames; the solid stepped tiers in the layout are the collision.
    b.tiers.forEach((tier,k)=>{const front=b.t0+b.side*k*T,back=front+b.side*T,[sx,sz]=C.P((b.s0+b.s1)/2,front+b.side*T*.62),[fx,fz]=C.P((b.s0+b.s1)/2,front+b.side*T*.2);
      bake(box,sx,tier.top-.03,sz,len,.06,T*.62,k%2?'#ecece7':'#f5f5f1',ang,'solid');
      bake(box,fx,tier.top-COURT_DIMS.bleacher.rise*.55,fz,len,.05,T*.3,'#e2e2dc',ang,'facade');
      for(let j=0;j<legs;j++){const s0=b.s0+.15+(len-.3)*j/(legs-1),[lx,lz]=C.P(s0,back-b.side*.05),y0=b.lo-.15;
        bake(box,lx,(y0+tier.top-.06)/2,lz,.06,tier.top-.06-y0,.06,'#b9bcbc',ang,'facade');}});}

  // ---- Palms: the shared Princesa form built once per variant at the origin and instanced (S4: ~40 KB of baked geometry
  // per palm otherwise). Each palm turns its variant about its own trunk foot, sunk 0.15 m (slopes ≤ 45 % at the foot). ----
  palmInstances(n.palms,'sj-plaza-perladistrict-palm-',{scene,own,mat,meshes});

  // ---- Broadleaf shade trees among the palms (66/87/88): a trunk, three branches and four crown lobes, pooled. ----
  for(const [k,t] of (n.broadleaf??[]).entries()){const top=t.y+3.4*t.size;bake(cylinder,t.x,t.y+1.6*t.size,t.z,.2,3.4*t.size,.2,'#6f6450',0,'solid');
    for(let j=0;j<4;j++){const a=j*Math.PI/2+k*.7,rr=1.5*t.size,p=[t.x+Math.cos(a)*rr,top+(j%2)*.4,t.z+Math.sin(a)*rr];
      if(j<3)bar([t.x,top-1.1,t.z],p,.12,.12,'#6f6450','solid');
      bake(sphere,...p,2.0*t.size,1.5*t.size,1.9*t.size,['#3f6a3c','#4a7444','#365c35','#55784a'][j],a,'leaf');}
    bake(sphere,t.x,top+.8,t.z,2.3*t.size,1.6*t.size,2.2*t.size,'#4b7246',0,'leaf');}

  // ---- Shore: dark angular boulders (Wikimedia Commons curid=86543901) and the Commons curid=86543903 timber rail. ----
  if(n.rocks.length){const rockG=own(new THREE.IcosahedronGeometry(1,0)),o=new THREE.Object3D(),c=new THREE.Color();
    const mesh=new THREE.InstancedMesh(rockG,mat({roughness:.95,metalness:0,flatShading:true}),n.rocks.length);
    n.rocks.forEach((r,i)=>{const sq=r.squash??.72;o.position.set(r.x,r.y+r.s*sq*.55,r.z);o.rotation.set(0,r.ry,0);o.scale.set(r.s,r.s*sq,r.s*.9);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);
      mesh.setColorAt(i,c.set(r.tone<.4?'#4b4740':r.tone<.75?'#5b5348':'#3f3d38'));});
    mesh.name='sj-plaza-perladistrict-boulders';mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);}
  n.rail.forEach((seg,i)=>{const ang=Math.atan2(-(seg.p1[1]-seg.p0[1]),seg.p1[0]-seg.p0[0]);
    for(const [p,g] of i===n.rail.length-1?[[seg.p0,seg.g0],[seg.p1,seg.g1]]:[[seg.p0,seg.g0]])
      bake(box,p[0],g+RAIL.rise/2-.05,p[1],.12,RAIL.rise+.12,.12,TIMBER,ang,'solid');
    for(const [y,w,hh] of [[.5,.07,.1],[RAIL.rise,.16,.06]])bar([seg.p0[0],seg.g0+y,seg.p0[1]],[seg.p1[0],seg.g1+y,seg.p1[1]],w,hh,TIMBER,'solid');});

  // ---- Dead ends: a closed door on the end wall of an alley. ----
  for(const d of n.deadEnds??[]){
    if(d.kind==='door'){let [nx,nz]=[-d.face[1],d.face[0]];if(nx*d.out[0]+nz*d.out[1]<0){nx=-nx;nz=-nz;}const ry=-Math.atan2(d.face[1],d.face[0]);
      const at=o=>[d.x+nx*o,d.z+nz*o];
      {const [x,z]=at(.03);bake(box,x,d.y+1.2,z,1.45,2.55,.06,TRIM,ry,'facade');}
      {const [x,z]=at(.06);bake(box,x,d.y+1.12,z,1.05,2.3,.05,DOOR[(d.id>>3)%DOOR.length],ry,'facade');}
      {const [x,z]=at(.09);bake(box,x,d.y+1.1,z+0,.06,.06,.03,'#c9b37a',ry,'facade');}
      {const [x,z]=at(.2);bake(box,x,d.y+2.62,z,1.7,.12,.4,TRIM,ry,'facade');}      // small parts cast no shadow (perf)
      {const [x,z]=at(.2);bake(box,x,d.y+.02,z,1.3,.04,.36,'#9b968c',ry,'facade');}}
}
  // ---- El Bowl: the layout's painted bands on the exact terrain triangles, one vertex-colour mesh with
  // the shared overlays' depth offset. ----
  if(n.bowl?.tris?.length){const p=[],c=[],col=new THREE.Color();for(const [a,b,d,paint] of n.bowl.tris){col.set(paint);p.push(...a,...b,...d);for(let k=0;k<3;k++)c.push(col.r,col.g,col.b);}
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
    g.computeVertexNormals();g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat({vertexColors:true,roughness:.8,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    m.name='sj-plaza-perladistrict-bowl';m.receiveShadow=true;scene.add(m);meshes.push(m);}
  return {foundations:found,courseHits,houses:n.houses.length,broadleaf:(n.broadleaf??[]).length,frontages:edges,openings,balconies,rooftop,lips,bands,backDoors:doors,retaining:walls,poles:n.poles.length,palms:n.palms.length,rocks:n.rocks.length,rail:n.rail.length};
}
