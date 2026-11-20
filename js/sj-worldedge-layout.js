/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// World edge: the east land cut toward Puerta de Tierra, the far bay shores and the horizon — © 2026 VibezZzCoder, MIT.
// Heights: USGS 1 m DEM tile USGS_1M_19_x80y205 (public domain), resampled by tools/build-worldedge.py into
// js/sj-worldedge-data.js. Roads: the game's own OSM (ODbL) road ends at the cut, extrapolated (inferred).
// Area module (contract: header of sj-princesa-layout.js). Everything here is OUTSIDE the playable polygon
// and render-only, except the east closure (a continuous site hoarding with barrier rows at each carriageway), which is
// the physical boundary: its colliders stand exactly where sj-worldedge.js draws it, and `offLimitsAt` keeps placement and
// recovery on the city side. `closesEastExits` tells sj-world.js to drop the old yellow blockout barriers.
// Mapped: DEM heights everywhere (near 8 m grid x 1344–1536 + 2 m cut column over Puerta de Tierra; far 32 m grid over Isla de Cabras,
// Cataño, Isla Grande/Miramar, Puerta de Tierra east and Condado); the city's road end positions and directions.
// Inferred: road continuation beyond the cut, every building mass and tree outside the
// polygon, zones (park, port, towers), El Cañuelo, the cranes, the closure kit.
import {NEAR,FAR,NEAR_B64,FAR_B64} from './sj-worldedge-data.js';
import {eastOf} from './sj-private.js';

export const CUT_X=1340;          // the terrain's last drawn column (cells 1338–1340; land.u8 is false at x = 1342)
export const CLOSE_X=1338;        // closure (fence) centreline
export const WATER_Y=-1.5;        // undersea vertex height: land cells slope into the sea, the waterline is the 0 contour
const FENCE={half:.15,panel:2.5,board:2.4,top:3.4,sea:14};  // a 0.30 m timber-framed hoarding (boards both faces)
const BARRIER={x:CLOSE_X-.75,half:.28,height:.82,length:1.2};
const NEAR_END=NEAR.x0+(NEAR.nx-1)*NEAR.step,NEAR_ZEND=NEAR.z0+(NEAR.nz-1)*NEAR.step;

const decode=b64=>{const s=atob(b64),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new Int16Array(u.buffer);};
let rngSeed=0;const rng=seed=>{rngSeed=seed>>>0;return()=>((rngSeed=Math.imul(rngSeed,1664525)+1013904223>>>0)/4294967296);};

const segDist=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],f=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(a[0]+dx*f-p[0],a[1]+dz*f-p[1]);};
// Barycentric height on one triangle; null if (x,z) is outside it.
function onTri(a,b,c,x,z) {
  const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-12)return null;
  const l1=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,l2=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,l3=1-l1-l2;
  return l1>=-1e-9&&l2>=-1e-9&&l3>=-1e-9?l1*a[1]+l2*b[1]+l3*c[1]:null;
}

export function createWorldEdgeLayout({city,terrain:t,height,isDry,land,surface}) {
  const nearQ=decode(NEAR_B64),farQ=decode(FAR_B64);
  const nearLand=(i,j)=>nearQ[j*NEAR.nx+i]>-32767&&nearQ[j*NEAR.nx+i]*NEAR.scale>-.5;
  // ---- Near grid (8 m, x 1344–1536, z −432…368) stitched to a 2 m column at the cut (x 1340) carrying the
  // game's own terrain heights (rows −250…138 are the cut's land; the rest is sea); the last column follows the far grid. ----
  const farLandAt=(i,j)=>{const q=farQ[j*FAR.nx+i];return q>-32767&&q*FAR.scale>-.5;};
  const farH=(i,j)=>farLandAt(i,j)?farQ[j*FAR.nx+i]*FAR.scale:WATER_Y;
  const Q=Math.round(NEAR.step/2);   // 2 m cut rows per near row
  const col0=[];   // z = NEAR.z0 + 2k
  const ci=Math.round((CUT_X-t.x0)/t.step);
  for(let k=0;k<=(NEAR.nz-1)*Q;k++){const z=NEAR.z0+2*k,j=Math.round((z-t.z0)/t.step),idx=j*t.nx+ci;
    col0.push(j>=0&&j<t.nz&&land[idx]?t.heights[idx]:WATER_Y);}
  const nearCols=[];
  for(let i=0;i<NEAR.nx;i++){const col=[];for(let j=0;j<NEAR.nz;j++)col.push(nearLand(i,j)?nearQ[j*NEAR.nx+i]*NEAR.scale:WATER_Y);nearCols.push(col);}
  {const fi=Math.round((NEAR_END-FAR.x0)/FAR.step),last=nearCols.at(-1);
    for(let j=0;j<NEAR.nz;j++){const z=NEAR.z0+j*NEAR.step,fj=(z-FAR.z0)/FAR.step,j0=Math.floor(fj+1e-9),f=fj-j0;
      last[j]=f<1e-9?farH(fi,j0):farH(fi,j0)*(1-f)+farH(fi,j0+1)*f;}
    // ease the last 32 m of the near grid into that 32 m edge profile (no transverse step at the seam).
    const B=Math.round(32/NEAR.step);for(let k=1;k<B;k++){const col=nearCols[nearCols.length-1-k],w=1-k/B,ws=w*w*(3-2*w);
      for(let j=0;j<NEAR.nz;j++){const a=col[j],b=last[j];if(a<=WATER_Y+1e-6&&b<=WATER_Y+1e-6)continue;col[j]=a+(b-a)*ws;}}}
  const near={col0,cols:nearCols,x0:NEAR.x0,z0:NEAR.z0,step:NEAR.step,nx:NEAR.nx,nz:NEAR.nz};
  const nearVertex=(i,j)=>[NEAR.x0+i*NEAR.step,nearCols[i][j],NEAR.z0+NEAR.step*j];
  const A=k=>[CUT_X,col0[k],NEAR.z0+2*k];
  // Stitch strip triangles for near row r: fan the Q+1 cut vertices to B0 (first half), B1 (second half) and one middle tri.
  const stripTris=r=>{const B0=nearVertex(0,r),B1=nearVertex(0,r+1),m=Q>>1,out=[];
    for(let k=0;k<m;k++)out.push([A(Q*r+k),A(Q*r+k+1),B0]);out.push([A(Q*r+m),B1,B0]);for(let k=m;k<Q;k++)out.push([A(Q*r+k),A(Q*r+k+1),B1]);return out;};
  const nearTriangles=[];
  const wet=p=>p[1]<=WATER_Y+1e-6;
  const pushTri=(a,b,c)=>{if(wet(a)&&wet(b)&&wet(c))return;
    // Counter-clockwise seen from above (+Y normal).
    const cross=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);nearTriangles.push(cross>=0?[a,b,c]:[a,c,b]);};
  for(let r=0;r<NEAR.nz-1;r++)for(const tri of stripTris(r))pushTri(...tri);
  for(let j=0;j<NEAR.nz-1;j++)for(let i=0;i<NEAR.nx-1;i++){const a=nearVertex(i,j),b=nearVertex(i+1,j),c=nearVertex(i,j+1),d=nearVertex(i+1,j+1);
    pushTri(a,c,b);pushTri(b,c,d);}
  // Exact drawn height of the near surface (for draped roads, masses and trees).
  const nearHeight=(x,z)=>{
    if(x<CUT_X-1e-6||x>NEAR_END+1e-6||z<NEAR.z0||z>NEAR_ZEND)return null;
    const r=Math.min(NEAR.nz-2,Math.max(0,Math.floor((z-NEAR.z0)/NEAR.step)));
    if(x<=NEAR.x0){for(const tri of stripTris(r)){const h=onTri(...tri,x,z);if(h!==null)return h;}return null;}
    const i=Math.min(NEAR.nx-2,Math.floor((x-NEAR.x0)/NEAR.step)),u=(x-NEAR.x0)/NEAR.step-i,v=(z-NEAR.z0)/NEAR.step-r;
    const a=nearVertex(i,r)[1],b=nearVertex(i+1,r)[1],c=nearVertex(i,r+1)[1],d=nearVertex(i+1,r+1)[1];
    return u+v<=1?a+(b-a)*u+(c-a)*v:d-(d-c)*(1-u)-(d-b)*(1-v);};
  // ---- Far grid (32 m): excluded vertices (−32767: near the playable land or inside the near grid) never draw. ----
  const farOk=(i,j)=>farQ[j*FAR.nx+i]!==-32767;
  const farCells=[];
  for(let j=0;j<FAR.nz-1;j++)for(let i=0;i<FAR.nx-1;i++){
    if(!farOk(i,j)||!farOk(i+1,j)||!farOk(i,j+1)||!farOk(i+1,j+1))continue;
    if(!farLandAt(i,j)&&!farLandAt(i+1,j)&&!farLandAt(i,j+1)&&!farLandAt(i+1,j+1))continue;
    // Beyond 4.7 km of the islet the 4.4 km fog has already hidden the land.
    if(Math.hypot(FAR.x0+(i+.5)*FAR.step-200,FAR.z0+(j+.5)*FAR.step-200)>4700)continue;
    farCells.push(j*FAR.nx+i);}
  const farHeight=(x,z)=>{const fx=(x-FAR.x0)/FAR.step,fz=(z-FAR.z0)/FAR.step,i=Math.floor(fx),j=Math.floor(fz);
    if(i<0||j<0||i>=FAR.nx-1||j>=FAR.nz-1)return null;
    if(!farOk(i,j)||!farOk(i+1,j)||!farOk(i,j+1)||!farOk(i+1,j+1))return null;
    const u=fx-i,v=fz-j,a=farH(i,j),b=farH(i+1,j),c=farH(i,j+1),d=farH(i+1,j+1);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d-(d-c)*(1-u)-(d-b)*(1-v);};
  const groundAt=(x,z)=>x>=CUT_X&&x<=NEAR_END&&z>=NEAR.z0&&z<=NEAR_ZEND?nearHeight(x,z):farHeight(x,z);
  // Distance (m) from a point to the sea on the extension (coarse ring scan); used to keep masses off the shore.
  const shoreClear=(x,z,r)=>{for(let a=0;a<12;a++){const s=Math.sin(a*Math.PI/6),c=Math.cos(a*Math.PI/6);
    for(const d of [r*.5,r]){const h=groundAt(x+s*d,z+c*d);if(h===null||h<.6)return false;}}return true;};

  // ---- Roads continued beyond the cut (inferred): each OSM road ending at the cut keeps its last direction, bending
  // toward due east (the islet's axis) over 80 m. Avenues run the length of the near grid, fading from 130 m; side streets,
  // cycle and footways stop at 70 m. Footways along the cut itself (running north–south on x ≈ 1341) are skipped. ----
  const roads=[],candidates=[];
  for(const r of city.roads){
    for(const end of [0,1]){const pts=end?r.points:[...r.points].reverse(),e=pts.at(-1);if(e[0]<CUT_X+.5)continue;
      let back=pts.length-2,acc=0;while(back>0&&acc<25){acc+=Math.hypot(pts[back+1][0]-pts[back][0],pts[back+1][1]-pts[back][1]);if(acc<25)back--;}
      const p=pts[Math.max(0,back)],dx=e[0]-p[0],dz=e[1]-p[1],len=Math.hypot(dx,dz);if(len<3||Math.abs(dx)<.6*len)continue;
      const avenue=['primary','secondary','tertiary'].includes(r.kind);
      const reach=avenue?NEAR_END-CUT_X-6:70,points=[[CUT_X,e[1]+(CUT_X-e[0])*dz/dx]];let ux=dx/len,uz=dz/len;
      for(let s=4;s<=reach;s+=4){const w=Math.min(1,s/80);let vx=ux*(1-w)+w,vz=uz*(1-w);const l=Math.hypot(vx,vz);vx/=l;vz/=l;
        const q=points.at(-1),n=[q[0]+vx*4,q[1]+vz*4],h=nearHeight(n[0],n[1]);if(h===null||h<.8)break;points.push(n);}
      if(points.length>3)candidates.push({id:r.id,name:r.name,kind:r.kind,width:r.width,avenue,points,fadeFrom:avenue?90:30,fadeTo:avenue?reach:70});}}
  // Widest first; a road starting inside an accepted road's corridor (cycle/footways beside an avenue) is not continued,
  // so no two ribbons overlap (coplanar z-fighting).
  candidates.sort((a,b)=>b.width-a.width);
  for(const r of candidates){const s=r.points[0],room=o=>o.width/2+(o.avenue?2.6:0)+r.width/2+.3;
    if(roads.some(o=>Math.abs(o.points[0][1]-s[1])<room(o)))continue;
    // Side streets stop where they would run into an accepted road's corridor.
    const k=r.points.findIndex(p=>roads.some(o=>o.points.some((q,i)=>i>0&&segDist(p,o.points[i-1],q)<room(o))));
    if(k>=0)r.points=r.points.slice(0,k);if(r.points.length>3){r.fadeTo=Math.min(r.fadeTo,r.points.at(-1)[0]-CUT_X);roads.push(r);}}
  const roadDistance=(x,z)=>{let best=Infinity,hw=0;for(const r of roads)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];
    const dx=b[0]-a[0],dz=b[1]-a[1],f=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),d=Math.hypot(a[0]+dx*f-x,a[1]+dz*f-z)-r.width/2-(r.avenue?2.6:0);
    if(d<best){best=d;hw=r.width;}}return best;};

  // ---- Zones (inferred from OpenStreetMap-free general geography): ----
  const zoneAt=(x,z)=>{
    if(x<-1700&&z<-150)return 'cabras';                       // Isla de Cabras (park, El Cañuelo)
    if(x<-500)return 'catano';                                // Cataño / Palo Seco shore (low-rise)
    if(z>440&&x<2350)return 'islagrande';                     // Isla Grande: convention district, port sheds, airfield
    if(z>380)return 'miramar';                                // Miramar / Santurce (mid- and high-rise)
    if(x>3150)return 'condado';                               // Condado (beachfront towers)
    // Parque Luis Muñoz Rivera: Commons "Paseo Central" camera 18.46437 −66.09117 → (2696, 125); 11 ha between the avenues.
    if(x>2420&&x<3000&&z>-130&&z<250)return 'park';
    if(z<-205&&x<3100)return 'pdtcoast';                      // Puerta de Tierra north shore (Tercer Milenio, Escambrón)
    if(z>120)return 'pdtport';                                // Puerta de Tierra south piers / sheds
    return 'pdt';};

  // ---- Masses (instanced boxes, render-only): [x,y(base),z,w,h,d,ry,colourIndex]. ----
  const masses=[],cellsOf=new Map(),CELL=32;
  const massKeys=(x0,z0,x1,z1,f)=>{for(let i=Math.floor(x0/CELL);i<=Math.floor(x1/CELL);i++)for(let j=Math.floor(z0/CELL);j<=Math.floor(z1/CELL);j++)f(i*100003+j);};
  // True if (x,z) ± (hw,hd) (axis-aligned bound, plus margin) meets an accepted mass.
  const massNear=(x,z,hw,hd,margin)=>{let hit=false;massKeys(x-hw-margin,z-hd-margin,x+hw+margin,z+hd+margin,k=>{if(hit)return;
    for(const m of cellsOf.get(k)??[]){const r=Math.hypot(m[3],m[5])/2;if(Math.abs(m[0]-x)<r+hw+margin&&Math.abs(m[2]-z)<r+hd+margin){hit=true;return;}}});return hit;};
  const indexMass=m=>{const r=Math.hypot(m[3],m[5])/2;massKeys(m[0]-r,m[2]-r,m[0]+r,m[2]+r,k=>{let l=cellsOf.get(k);if(!l)cellsOf.set(k,l=[]);l.push(m);});};
  const PAL=['#ece6d8','#dfd5c2','#e9dcc6','#d3d8d2','#e5d0b4','#cfc6b8','#f0ece4','#c9d2d6'];
  const addMass=(x,z,w,d,h,ry,c)=>{
    // Base: the lowest drawn ground under the four corners (minus a buried toe) so no corner floats.
    let lo=Infinity;const s=Math.sin(ry),co=Math.cos(ry);
    for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]]){const px=x+u*w/2*co+v*d/2*s,pz=z-u*w/2*s+v*d/2*co,g=groundAt(px,pz);if(g===null||g<.4)return false;lo=Math.min(lo,g);}
    const m=[x,lo-.6,z,w,h+.6,d,ry,c];masses.push(m);indexMass(m);return true;};
  // The two OSM buildings clipped by the cut continue east (same base/roof, 26 m, render-only; their own colliders stay).
  const continuations=[];
  for(const b of city.buildings){const east=b.outer.filter(p=>p[0]>CUT_X+1.2);if(east.length<2)continue;
    const zs=east.map(p=>p[1]),z0=Math.min(...zs),z1=Math.max(...zs),x0=Math.max(...east.map(p=>p[0]));
    continuations.push({id:b.id,x0,z0,z1,base:b.base,roof:b.roof});
    // side faces 3 cm inside the clipped building's wall planes (were flush).
    const m=[x0+13,b.base,(z0+z1)/2,26,b.roof-b.base,z1-z0-.06,0,b.id%PAL.length];masses.push(m);indexMass(m);}
  // Avenue frontage (inferred): continuous rows of 3–5 storey blocks behind both sidewalks, aligned to the avenue, with
  // the occasional gap; park/coastal zones stay open.
  {const r=rng(2026);
    for(const road of roads)if(road.avenue){const set=road.width/2+2.6+.6;
      for(const sd of [-1,1]){let s=24+r()*6;
        while(s<road.points.length*4-12){const k=Math.min(road.points.length-2,Math.floor(s/4)),a=road.points[k],b=road.points[k+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
          const w=12+r()*9,d=12+r()*7,ux=dx/l,uz=dz/l,nx=-uz*sd,nz=ux*sd,cx=a[0]+ux*(w/2)+nx*(set+d/2),cz=a[1]+uz*(w/2)+nz*(set+d/2);s+=w+(r()<.25?4+r()*6:.4);
          const zone=zoneAt(cx,cz);if(zone==='park'||zone==='pdtcoast')continue;
          if(roadDistance(cx,cz)<d/2-1||!shoreClear(cx,cz,Math.max(w,d)/2+6)||massNear(cx,cz,w/2,d/2,.3))continue;
          addMass(cx,cz,w,d,8+r()*8+(r()<.15?6:0),Math.atan2(-uz,ux),Math.floor(r()*PAL.length));}}}}
  // Near lots: jittered 22 m grid, aligned to the islet axis, kept off roads, the fence view and the shore.
  {const r=rng(1341);
    for(let x=CUT_X+18;x<NEAR_END-4;x+=22)for(let z=NEAR.z0;z<NEAR_ZEND;z+=22){
      const px=x+r()*8-4,pz=z+r()*8-4,zone=zoneAt(px,pz);if(zone==='park'||zone==='pdtcoast')continue;
      // Port zone: long transit sheds parallel to the south shore (the south side was bare).
      const w=zone==='pdtport'?42+r()*30:12+r()*9,d=zone==='pdtport'?18+r()*8:11+r()*8,h=zone==='pdtport'?8+r()*4:7+r()*r()*14+(px<1520&&pz<-60?5:0);
      if(roadDistance(px,pz)<Math.max(w,d)/2+2.5||!shoreClear(px,pz,Math.max(w,d)/2+(zone==='pdtport'?20:12))||massNear(px,pz,w/2,d/2,1.5))continue;
      addMass(px,pz,w,d,h,(r()-.5)*.08,Math.floor(r()*PAL.length));}}
  // Far lots by zone (heights from Wikimedia Commons curid=148962402, curid=148962401, curid=182041799 for the Condado/Miramar towers; otherwise inferred low-rise).
  const towers=[];
  {const r=rng(66116);
    const spec={catano:{cell:44,p:.55,w:[12,24],h:[4,9]},islagrande:{cell:80,p:.3,w:[40,95],h:[7,13]},miramar:{cell:52,p:.6,w:[16,28],h:[10,44]},
      condado:{cell:46,p:.65,w:[18,30],h:[18,70]},pdt:{cell:40,p:.55,w:[14,24],h:[7,16]},pdtport:{cell:56,p:.45,w:[24,48],h:[7,12]},
      park:{cell:90,p:.12,w:[14,22],h:[5,9]},pdtcoast:{cell:120,p:.1,w:[10,16],h:[4,7]},cabras:{cell:200,p:.06,w:[8,12],h:[3,5]}};
    for(let j=0;j<FAR.nz-1;j++)for(let i=0;i<FAR.nx-1;i++){
      const x=FAR.x0+(i+.5)*FAR.step,z=FAR.z0+(j+.5)*FAR.step;if(Math.hypot(x-200,z-200)>4700)continue;
      const zone=zoneAt(x,z),s=spec[zone];if(!s)continue;
      // One candidate per s.cell² on average: thin the 32 m lattice by area.
      if(r()>FAR.step*FAR.step/(s.cell*s.cell)*1.8)continue;if(r()>s.p*.45)continue;
      const px=x+(r()-.5)*FAR.step,pz=z+(r()-.5)*FAR.step,g=farHeight(px,pz);if(g===null||g<1)continue;
      if(!shoreClear(px,pz,18))continue;
      const w=s.w[0]+r()*(s.w[1]-s.w[0]),d=zone==='islagrande'?16+r()*14:w*(.6+r()*.5);let h=s.h[0]+r()*r()*(s.h[1]-s.h[0]);if(massNear(px,pz,w/2,d/2,2))continue;
      if(zone==='condado'&&z<120&&r()<.6)h=Math.max(h,38+r()*42);          // the beachfront tower line (Wikimedia Commons curid=148962402, curid=148962401)
      const ry=zone==='islagrande'?(r()<.5?0:Math.PI/2)+(r()-.5)*.1:(r()-.5)*.5,col=zone==='islagrande'?[3,5,7][Math.floor(r()*3)]:Math.floor(r()*PAL.length);
      if(addMass(px,pz,w,d,h,ry,col)&&h>30)towers.push([px,pz]);}}
  // Landmark masses (inferred positions): a tall hotel slab at Puerta de Tierra's east tip and El Cañuelo.
  const landmarks=[];
  {let best=null;for(let j=0;j<FAR.nz;j++)for(let i=0;i<FAR.nx;i++){const x=FAR.x0+i*FAR.step,z=FAR.z0+j*FAR.step;
      if(x<-1700&&z<-200&&farLandAt(i,j)&&farOk(i,j)){const d=Math.hypot(x+800,z+600);if(!best||d<best.d)best={x,z,d};}}
    if(best){const g=farHeight(best.x,best.z)??1;const m=[best.x,g-1,best.z,16,7,16,.6,1];masses.push(m);indexMass(m);landmarks.push({name:'El Cañuelo (inferred)',x:best.x,z:best.z});}
    const hx=3030,hz=-150,hg=farHeight(hx,hz);if(hg!==null&&hg>.5){const m=[hx,hg-1,hz,22,48,58,.35,6];masses.push(m);indexMass(m);landmarks.push({name:'east-tip hotel slab (inferred)',x:hx,z:hz});}}
  // Port gantry cranes and sheds on Isla Grande's bay front (inferred; the brief's "port to the south-east" cue).
  const cranes=[];
  // Isla Grande's west (bay) shore, z 650–1150: land vertices with sea directly west; three spaced ≥ 70 m apart.
  {for(let j=0;j<FAR.nz;j++)for(let i=1;i<FAR.nx;i++){const x=FAR.x0+i*FAR.step,z=FAR.z0+j*FAR.step;
      if(x<800||x>2000||z<650||z>1150||!farLandAt(i,j)||!farOk(i,j)||farLandAt(i-1,j)||!farLandAt(i+1,j))continue;
      if(cranes.length<3&&cranes.every(k=>Math.hypot(k.x-x,k.z-z)>70)){const g=Math.max(farH(i,j),farH(i+1,j));if(g>.5)cranes.push({x:x+20,y:g,z,ry:Math.PI/2});}}}
  // ---- Trees (instanced, render-only): [x,y,z,crownRadius,trunk(0|1),kind(0 round, 1 wide flat, 2 columnar)]. ----
  const trees=[];
  {const r=rng(4242);
    // Avenue trees on the near grid, both sides of the avenues every 12 m from 20 m past the fence.
    for(const road of roads)if(road.avenue&&road.kind!=='cycleway')for(let k=5;k<road.points.length-1;k+=3){
      const a=road.points[k],b=road.points[k+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
      for(const sd of [-1,1]){const off=road.width/2+1.6,x=a[0]-dz/l*off*sd,z=a[1]+dx/l*off*sd,g=nearHeight(x,z);
        if(g!==null&&g>.8&&roadDistance(x,z)>-1.5&&!massNear(x,z,0,0,1)){const kind=road.kind==="primary"?2:(Math.floor(k/3)+(sd>0?1:0))%4===0?1:0;trees.push([x+(r()-.5)*1.2,g,z,kind===1?3.2+r():2+r()*.9,1,kind]);}}}
    // Park and coastal lawns (near): loose clumps.
    for(let x=CUT_X+12;x<NEAR_END;x+=9)for(let z=NEAR.z0;z<NEAR_ZEND;z+=9){const px=x+r()*7,pz=z+r()*7,zone=zoneAt(px,pz);
      const p=zone==='park'?.55:zone==='pdtcoast'?.12:.05;if(r()>p)continue;
      const g=nearHeight(px,pz);if(g===null||g<1||roadDistance(px,pz)<2||!shoreClear(px,pz,6))continue;
      if(massNear(px,pz,0,0,2))continue;trees.push([px,g,pz,2.4+r()*1.6,1,r()<.35?1:0]);}
    // Far canopy: green zones dense, built zones sparse.
    for(const c of farCells){const i=c%FAR.nx,j=(c/FAR.nx)|0,x=FAR.x0+(i+.5)*FAR.step,z=FAR.z0+(j+.5)*FAR.step;if(Math.hypot(x-200,z-200)>4700)continue;
      const zone=zoneAt(x,z),p={cabras:.9,park:.9,pdtcoast:.45,catano:.3,islagrande:.12,miramar:.25,condado:.15,pdt:.3,pdtport:.05}[zone]??0;
      if(r()>p*.45)continue;const px=x+(r()-.5)*FAR.step,pz=z+(r()-.5)*FAR.step,g=farHeight(px,pz);if(g===null||g<.8)continue;
      if(massNear(px,pz,0,0,3))continue;trees.push([px,g,pz,5+r()*4,0,0]);}}

  // ---- The east closure (physical): a plain site hoarding on the line x = CLOSE_X, 14 m out into the sea at both ends
  // (a crashed slide went round the old 3.5 m south end). Solid boards to BOARD m and visible debris
  // netting on the posts to TOP m above the panel's base, where the base is the highest ground within ±5 m along the line.
  // Sizing (1,078 simulated approaches to an unlimited line): riders reach the line at most
  // 2.30 m above that ground, so TOP = 3.4 m keeps > 1 m margin. The collider is exactly the drawn boards + netting
  // (no invisible caps); it reaches 0.5 m below the panel's lowest ground. Panels are 2.5 m, or 1.25 m (stepped) where
  // the ground changes by more than 0.35 m across them.
  let zN=null,zS=null;for(let z=-300;z<=200;z+=.5)if(isDry(CLOSE_X,z)){zN??=z;zS=z;}
  zN-=FENCE.sea;zS+=FENCE.sea;
  const edgeBuildings=city.buildings.filter(b=>b.outer.some(p=>p[0]>=CLOSE_X-1));
  const inBuilding=(x,z)=>edgeBuildings.some(b=>{
    let inside=false;const r=b.outer;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],c=r[j];if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])inside=!inside;}return inside;});
  const ground=(x,z)=>isDry(x,z)?height(x,z):Math.max(-.3,Math.min(height(x,z),0));
  const span=(z0,z1)=>{let lo=Infinity,hi=-Infinity;for(let s=0;s<=8;s++){const z=z0+(z1-z0)*s/8;for(const dx of [-FENCE.half,FENCE.half]){const g=ground(CLOSE_X+dx,z);lo=Math.min(lo,g);hi=Math.max(hi,g);}}return {lo,hi};};
  const panels=[],colliders=[];
  {const n=Math.ceil((zS-zN)/(FENCE.panel/2)),len=(zS-zN)/n,half=[];
    for(let k=0;k<n;k++){const z0=zN+k*len,z1=z0+len;half.push({z0,z1,...span(z0,z1)});}
    for(let k=0;k<half.length;){const a=half[k],b=half[k+1];
      if(b&&Math.max(a.hi,b.hi)-Math.min(a.lo,b.lo)<=.35&&a.hi-a.lo<=.35&&b.hi-b.lo<=.35){panels.push({z0:a.z0,z1:b.z1,lo:Math.min(a.lo,b.lo),hi:Math.max(a.hi,b.hi)});k+=2;}
      else{panels.push({...a});k++;}}
    for(const p of panels)p.zc=(p.z0+p.z1)/2;
    for(const p of panels){p.base=Math.max(...panels.filter(q=>Math.abs(q.zc-p.zc)<=5).map(q=>q.hi));
      p.top=p.base+FENCE.top;p.boards=p.base+FENCE.board;p.bottom=p.lo-.5;
      // Hidden only when the whole panel runs inside one of the two OSM buildings clipped by the cut (they close the line).
      p.hidden=[p.z0+.05,p.zc,p.z1-.05].every(z=>inBuilding(CLOSE_X-FENCE.half,z)&&inBuilding(CLOSE_X+FENCE.half,z));
      colliders.push({centre:{x:CLOSE_X,y:(p.top+p.bottom)/2,z:p.zc},halfExtents:{x:FENCE.half,y:(p.top-p.bottom)/2,z:(p.z1-p.z0)/2},rotationY:0,surface:'pavement'});}}
  // Barrier rows across each carriageway (and its sidewalks) at the city's own road ends, in front of the fence.
  const barriers=[],signs=[];
  for(const r of city.roads){const e=[r.points[0],r.points.at(-1)].find(p=>p[0]>CUT_X+.5);if(!e)continue;
    const pts=e===r.points[0]?r.points:[...r.points].reverse(),p=pts[1],dx=e[0]-p[0],dz=e[1]-p[1];if(Math.abs(dx)<.6*Math.hypot(dx,dz))continue;
    const zc=e[1]+(BARRIER.x-e[0])*dz/dx;if(zc<zN+2||zc>zS-2)continue;
    const carriage=!['footway','cycleway','path','steps'].includes(r.kind);
    const span=r.width+(carriage?1:0),n=Math.max(1,Math.round(span/BARRIER.length));
    for(let k=0;k<n;k++){const z=zc+(k-(n-1)/2)*BARRIER.length;if(barriers.some(b=>Math.abs(b.z-z)<BARRIER.length*.9))continue;
      if(!isDry(BARRIER.x,z))continue;const g=height(BARRIER.x,z);
      barriers.push({x:BARRIER.x,z,y:g,red:(barriers.length%2)===0});
      colliders.push({centre:{x:BARRIER.x,y:g+BARRIER.height/2-.1,z},halfExtents:{x:BARRIER.half,y:BARRIER.height/2+.1,z:BARRIER.length/2-.03},rotationY:0,surface:'pavement'});}
    if(carriage&&!signs.some(s=>Math.abs(s.z-zc)<6)){const g=height(CLOSE_X-.2,zc);signs.push({x:CLOSE_X-FENCE.half-.01,z:zc,y:g,name:r.name||r.kind});}}
  const offLimitsAt=eastOf(CLOSE_X-.45); // sj-private.js: no reference to this layout's scope
  // carry the ground tone to the hoarding foot. The city's last two vertex columns (x 1338 under the boards,
  // x 1340 behind them) take the asphalt tone where the city maps a road and the extension's ground tone elsewhere, so
  // the terrain no longer washes toward the water-edge colour at the foot (earlier tints win; ground/streets come later).
  const tint=new Map();
  for(const x of [CLOSE_X,CUT_X]){const i=Math.round((x-t.x0)/t.step);
    for(let j=0;j<t.nz;j++){const k=j*t.nx+i,z=t.z0+j*t.step;if(!land[k]||z<zN||z>zS)continue;tint.set(k,surface[k]===1?'#687d91':'#c4bca7');}}
  // Advance warning: a weighted portable sign stand on the kerb side of each avenue lane, 18 m before the
  // barrier rows — a red-bordered warning triangle over a white "closed" plate (red bar). Post, plate and base are solid.
  const advance=[];
  for(const s of signs){const r=city.roads.find(q=>(q.name||q.kind)===s.name&&[q.points[0],q.points.at(-1)].some(p=>p[0]>CUT_X+.5));
    if(!r||!['primary','secondary','tertiary'].includes(r.kind))continue;
    const x=CLOSE_X-18,z=s.z+r.width/2-.7;if(!isDry(x,z))continue;const g=height(x,z);
    advance.push({x,z,y:g,name:s.name});
    // Collider = the drawn post (0.1 m, 1.95 m) and the two plates (x − 0.04, y 1.42–2.5, ±0.4 m); the 8 cm base is dressing.
    colliders.push({centre:{x,y:g+.975,z},halfExtents:{x:.05,y:.975,z:.05},rotationY:0,surface:'pavement'});
    colliders.push({centre:{x:x-.04,y:g+1.96,z},halfExtents:{x:.03,y:.54,z:.4},rotationY:0,surface:'pavement'});}

  // Inspection views of the edge (not map arrivals: the closure is a boundary, not a destination).
  return {colliders,tops:[],cuts:[],tint,surfaces:[],floorTriangles:[],places:[],ownedBuildings:[],
    closesEastExits:true,offLimitsAt,
    // 2D map: an understated closure line on the cut (main.js draws area mapLines; no arrivals).
    mapLines:[{points:[[CLOSE_X,zN],[CLOSE_X,zS]],colour:'#c4352c',width:3,dash:[6,4]}],
    closure:{x:CLOSE_X,zN,zS,fence:FENCE,barrier:BARRIER,panels,barriers,signs,advance},
    near,nearTriangles,nearHeight,farHeight,groundAt,farCells,far:{...FAR,heights:farQ,landAt:farLandAt,height:farH},
    roads,masses,palette:PAL,trees,cranes,landmarks,towers,continuations,zoneAt,
    nearEnd:NEAR_END,nearZEnd:NEAR_ZEND,water:WATER_Y,cutX:CUT_X,
    // The city's base ground class (0 sidewalk, 1 asphalt, 2 lawn, 3 water edge) at the 2 m vertex nearest (x,z), or −1.
    cityClassAt:(x,z)=>{const i=Math.round((x-t.x0)/t.step),j=Math.round((z-t.z0)/t.step);if(i<0||j<0||i>=t.nx||j>=t.nz)return -1;const k=j*t.nx+i;return land[k]?surface[k]:-1;}};
}
