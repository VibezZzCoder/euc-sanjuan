/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Reference-led Plaza de Armas kit — © 2026 VibezZzCoder, MIT.
// Wikimedia Commons curid=119654687, curid=151531420, curid=131971241, curid=151530323, curid=151596781, curid=182287159, curid=158245806, curid=122798497, curid=80303584, curid=131971302 guide forms; source IDs and inferred dimensions live in the private area notes.
import * as THREE from 'three/webgpu';
import { glowLamp,glowPane } from './sj-glow.js';
import {inDetail,inRing} from './sj-plaza-layout.js';
import {createPavingRegions} from './sj-paving.js';
import {CATHEDRAL_ID,inCorridor,corridorFacade} from './sj-corridor-layout.js';
import {buildCathedral,CATHEDRAL_WALL} from './sj-cathedral.js';
import {createStatueBuilder,statueFrame} from './sj-statues.js';
import {buildGate,paseoTexture} from './sj-gate.js';
import {buildFort} from './sj-fort.js';
import {buildPrincesa} from './sj-princesa.js';
import {buildCristobal} from './sj-cristobal.js';
import {buildNorzagaray} from './sj-norzagaray.js';
import {buildPerlaWest,aggregateTexture} from './sj-perla-west.js';
import {buildPerlaDistrict,patchedTexture} from './sj-perla-district.js';
import {buildPuntilla,panelTexture} from './sj-puntilla.js';
import {buildStreets} from './sj-streets.js';
import {buildGround} from './sj-ground.js';
import {buildForttops} from './sj-forttops.js';
import {buildFabric} from './sj-fabric.js';
import {buildLandmarks} from './sj-landmarks.js';
import {buildBahia,linearTexture,terraTexture} from './sj-bahia.js';
import {buildUptown} from './sj-uptown.js';
import {buildEastcivic} from './sj-eastcivic.js';
import {buildWaterfront} from './sj-waterfront.js';
import {buildWorldEdge} from './sj-worldedge.js';
import {smallWaterMaterial,compileAtBoot} from './sj-sea.js';
import {buildCoast} from './sj-coast.js';
import {AREA_LAYOUTS,areasOf} from './sj-world.js';
import {groupPools,pavingClusters} from './sj-pool-groups.js';

// area builders, keyed like AREA_LAYOUTS in sj-world.js.
const AREA_BUILDERS={princesa:buildPrincesa,cristobal:buildCristobal,norzagaray:buildNorzagaray,perlaWest:buildPerlaWest,perlaDistrict:buildPerlaDistrict,puntilla:buildPuntilla,waterfront:buildWaterfront,bahia:buildBahia,uptown:buildUptown,landmarks:buildLandmarks,eastcivic:buildEastcivic,forttops:buildForttops,worldedge:buildWorldEdge,coast:buildCoast,ground:buildGround,streets:buildStreets,fabric:buildFabric,
  // Wall-foot strips are drawn by sj-world.js inside the terrain mesh (groundTriangles), so this builder only reports.
  wallFoot:w=>({strips:w.strips.length,triangles:w.groundTriangles.length})};

const C={trim:'#eee7d7',stone:'#ad977c',wood:'#49372e',iron:'#273c37',shadow:'#26312e',leaf:'#366342'};
export function plazaWallColour(b) {
  if(b.id===CATHEDRAL_ID)return CATHEDRAL_WALL;
  if(b.id===252692668)return '#b7ced1'; // 2022 Wikimedia Commons curid=119654687, not the 2013 pink repaint in Wikimedia Commons curid=131971241.
  if(b.id===3335798)return '#b6c5b7';
  if(b.outer.some(p=>inDetail(...p)||inCorridor(...p)))return ['#d4aa59','#a4c4bd','#d4997e','#c7b3bd','#dad4b5','#9ab6c9'][b.id%6];
  return null;
}

export function buildPlaza(scene,world) {
  const {city,detail,plaza,height,terrain:t}=world;
  const geometries=new Set(),materials=new Set(),textures=new Set(),meshes=[];
  const own=g=>(geometries.add(g),g);
  const mat=o=>{const m=new THREE.MeshStandardMaterial(o);materials.add(m);return m;};
  const standard=mat({vertexColors:true,roughness:.88,metalness:0});
  const foliage=mat({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const batches=new Map(),instances=new Map(),matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),dummy=new THREE.Object3D();
  const v=new THREE.Vector3(),n=new THREE.Vector3(),colour=new THREE.Color();
  const box=own(new THREE.BoxGeometry(1,1,1));
  const cylinder=own(new THREE.CylinderGeometry(1,1,1,12));
  const sphere=own(new THREE.IcosahedronGeometry(1,1));
  let facadePass=true;const THIN=.065;
  function bake(g,x,y,z,sx,sy,sz,paint,ry=0,kind=facadePass?'facade':'solid',rz=0) {
    // Fine parts (rails, bars, thin poles: two cross extents ≤ THIN) receive but don't cast. Thinner than a sun-map texel
    // (≈5.7 cm desktop, 8.6 cm phone), they print aliased, crawling stripes instead of a shadow.
    if(kind==='solid'&&(g===box||g===cylinder||g===sphere)){const k=g===box?1:2,e=[Math.abs(sx)*k,Math.abs(sy)*(g===sphere?2:1),Math.abs(sz)*k].sort((p,q)=>p-q);if(e[1]<=THIN)kind='facade';}
    const key=`${Math.floor(x/64)},${Math.floor(z/64)},${kind}`;
    dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();matrix.copy(dummy.matrix);
    normalMatrix.getNormalMatrix(matrix);colour.set(paint);
    // Repeated primitive parts keep one shared vertex/index source; spatial pools bound visible submissions.
    const primitive=g===box?'box':g===cylinder?'cylinder':g===sphere?'sphere':null;
    if(primitive) {
      const id=key+','+primitive;let pool=instances.get(id);
      if(!pool)instances.set(id,pool={g,kind,transforms:[],colours:[]});
      pool.transforms.push(...matrix.elements);pool.colours.push(colour.r,colour.g,colour.b);return;
    }
    let b=batches.get(key);if(!b)batches.set(key,b={p:[],n:[],c:[],kind});
    const p=g.attributes.position,no=g.attributes.normal,idx=g.index;
    for(let i=0;i<(idx?.count??p.count);i++) {
      const j=idx?idx.getX(i):i;
      v.fromBufferAttribute(p,j).applyMatrix4(matrix);n.fromBufferAttribute(no,j).applyNormalMatrix(normalMatrix);
      b.p.push(v.x,v.y,v.z);b.n.push(n.x,n.y,n.z);b.c.push(colour.r,colour.g,colour.b);
    }
  }
  const cube=(x,y,z,w,h,d,c,ry=0)=>bake(box,x,y,z,w,h,d,c,ry);
  const cyl=(x,y,z,r,h,c)=>bake(cylinder,x,y,z,r,h,r,c);
  function segment(a,b,r,c,kind='solid') {
    // Cylinders along arbitrary vectors, baked once; used for branch structure and palm midribs.
    const g=cylinder.clone(),direction=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
    g.scale(r,direction.length(),r);g.applyQuaternion(q);
    bake(g,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1,1,1,c,0,kind);g.dispose();
  }
  const frame=(a,b)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
    return {length,ux,uz,nx:-uz,nz:ux,angle:-Math.atan2(uz,ux),point:(u,y,d=0)=>[a[0]+ux*u-uz*d,y,a[1]+uz*u+ux*d]};
  };
  function localBox(f,u,y,d,w,h,depth,c,coarseShadow=false) {
    bake(box,...f.point(u,y,d),w,h,depth,c,f.angle,coarseShadow?'solid':facadePass?'facade':'solid');
  }
  const archShapes=new Map();
  function archGeometry(w,h,trim=false) {
    const key=`${w},${h},${trim}`;if(archShapes.has(key))return archShapes.get(key);
    const outline=(path,extra=0)=>{const r=w/2+extra,cy=h-w/2;
      path.moveTo(-r,-extra);path.lineTo(r,-extra);path.lineTo(r,cy);
      path.absarc(0,cy,r,0,Math.PI,false);path.lineTo(-r,-extra);};
    const shape=new THREE.Shape();outline(shape,trim?.14:0);
    if(trim){const hole=new THREE.Path();outline(hole);shape.holes.push(hole);}
    const g=own(new THREE.ShapeGeometry(shape,8));archShapes.set(key,g);return g;
  }
  function opening(f,u,bottom,w,h,arched=false) {
    // Recessed-looking CLOSED timber openings: no false traversable doorway through an unchanged building body.
    if(arched) {
      bake(archGeometry(w,h),...f.point(u,bottom,.07),1,1,1,C.shadow,f.angle);
      bake(archGeometry(w,h,true),...f.point(u,bottom,.12),1,1,1,C.trim,f.angle);
    }else{
      localBox(f,u,bottom+h/2,.045,w,h,.08,C.shadow);
      for(const s of [-1,1])localBox(f,u+s*(w/2+.09),bottom+h/2,.11,.16,h+.25,.18,C.trim);
      localBox(f,u,bottom+h+.08,.12,w+.4,.18,.22,C.trim);
    }
    localBox(f,u,bottom+h*.41,.095,w*.83,h*.8,.065,C.wood);
    localBox(f,u,bottom-.07,.13,w+.4,.16,.24,C.trim);
    localBox(f,u,bottom+h*.4,.14,.045,h*.78,.05,'#81664b');
    for(let j=1;j<4;j++)localBox(f,u,bottom+h*j/4,.14,w*.78,.045,.045,'#735b43');
  }
  function balcony(f,u,y,w,civic=false) {
    // The slab is a useful coarse shadow. Fine rails/trim receive light/shadow, but do not alias into the shadow map.
    localBox(f,u,y,.44,w+.45,.16,.94,C.trim,true);
    for(const side of [-1,1])localBox(f,u+side*w*.36,y-.25,.24,.12,.45,.48,C.iron);
    for(const h of [.2,.92])localBox(f,u,y+h,.88,w+.38,civic?.10:.055,civic?.10:.055,civic?C.trim:C.iron);
    for(let j=0;j<=Math.ceil(w/.22);j++)localBox(f,u-w/2+j*w/Math.ceil(w/.22),y+.55,.88,civic?.085:.035,.8,civic?.085:.035,civic?C.trim:C.iron);
    for(const side of [-1,1])localBox(f,u+side*(w/2+.12),y+.92,.47,.04,.04,.83,C.iron);
  }
  // Bracket wall lantern at facade station u, plate centre height y (local +d = out): plate 2 cm into the wall, arm,
  // framed glass, pyramid cap; the glass reports itself to the blue-hour light (sj-glow.js).
  let lanternCap=null,wallLanterns=0;
  function wallLantern(f,u,y,power=1) {
    lanternCap??=own(new THREE.ConeGeometry(.17,.16,4));
    localBox(f,u,y-.05,.0125,.14,.34,.065,C.iron);localBox(f,u,y,.28,.044,.044,.5,C.iron);
    localBox(f,u,y+.02,.52,.15,.04,.15,C.iron);localBox(f,u,y+.2,.52,.2,.32,.2,'#e8d9a4');
    for(const [a,d] of [[-1,-1],[-1,1],[1,-1],[1,1]])localBox(f,u+a*.1,y+.2,.52+d*.1,.032,.34,.032,C.iron);
    bake(lanternCap,...f.point(u,y+.43,.52),1,1,1,C.iron,f.angle+Math.PI/4);
    glowLamp(...f.point(u,y+.2,.52),'lantern',{power});wallLanterns++;
  }
  let facades=0,openings=0,corridorFacades=0;
  for(const b of city.buildings) {
    if(!b.outer.some(p=>inDetail(...p)||inCorridor(...p))||[410592051,410620625,CATHEDRAL_ID].includes(b.id))continue;
    const signed=b.outer.reduce((sum,a,i)=>{const c=b.outer[(i+1)%b.outer.length];return sum+a[0]*c[1]-c[0]*a[1];},0);
    // Decide every edge first: cornices need to know whether the neighbouring facade is also detailed.
    const plan=b.outer.map((_,i)=>{
      let a=b.outer[i],end=b.outer[(i+1)%b.outer.length];
      // Frame +Z always faces outwards, independent of source ring winding.
      if(signed>0)[a,end]=[end,a];
      const f=frame(a,end),mid=f.point(f.length/2,0,1);
      const corridor=world.corridor&&corridorFacade(f,world.corridor);
      if(f.length<3||(!inDetail(mid[0],mid[2])&&!corridor))return null;
      if(city.buildings.some(other=>other!==b&&inRing(mid[0],mid[2],other.outer)&&!other.holes.some(h=>inRing(mid[0],mid[2],h))))return null;
      const ground=height(mid[0],mid[2]);
      if(b.roof-ground<3)return null;
      // First-area envelope: plaza perimeter and directly adjoining San Francisco/Cordero street walls.
      const distanceToPlaza=Math.min(...detail.plaza.ring.map((p,j)=>{
        const q=detail.plaza.ring[(j+1)%detail.plaza.ring.length],dx=q[0]-p[0],dz=q[1]-p[1];
        const u=Math.max(0,Math.min(1,((mid[0]-p[0])*dx+(mid[2]-p[1])*dz)/(dx*dx+dz*dz)));
        return Math.hypot(mid[0]-p[0]-dx*u,mid[2]-p[1]-dz*u);
      }));
      return distanceToPlaza>26&&!corridor?null:{f,corridor,ground,onPlaza:distanceToPlaza<8};
    });
    for(let i=0;i<plan.length;i++) {
      if(!plan[i])continue;
      // The facade continuing from this edge's end: ring order reverses when the frames were swapped outward.
      const {f,corridor,ground,onPlaza}=plan[i],next=plan[(i+(signed>0?plan.length-1:1))%plan.length];
      // Bound detailing to the plaza-facing block and its immediate adjoining streets.
      facades++;
      if(corridor)corridorFacades++;
      const cityHall=b.id===252692668&&f.nz>.8;
      const floors=Math.max(1,Math.min(5,Math.round((b.roof-ground)/3.65)));
      const floorH=(b.roof-ground-.6)/floors;
      // Outward (convex) corner to another detailed facade: carry projecting trim through the corner by its own
      // projection, so cornices/string courses wrap it instead of leaving an open notch. Same trim colour/normal.
      const convex=next&&f.ux*next.f.uz-f.uz*next.f.ux<-.2;
      // String courses only return where the continuing facade's course meets at the same height (else a stub).
      const nextFloors=next&&Math.max(1,Math.min(5,Math.round((b.roof-next.ground)/3.65)));
      const meets=floor=>!floor||next&&Math.abs(ground+floor*floorH-next.ground-floor*(b.roof-next.ground-.6)/nextFloors)<.05;
      const run=(project,d,depth,y,h,floor=0)=>{const extra=convex&&meets(floor)?project:0;
        localBox(f,(f.length+extra)/2,y,d,f.length+extra,h,depth,C.trim);};
      // this cornice ran 7.5 cm into the mass with its top 5 mm above the roof (a
      // depth tie from ~110 m). It now starts at the wall plane, same front (.275) and height.
      run(.275,.1375,.275,b.roof-.12,.27);  // top and underside 1 cm off a neighbouring fabric cornice's planes
      run(.235,.02,.43,b.roof+.15,.22);  // top and underside 1 cm off a neighbouring fabric cornice's planes (same roof datum at corners)
      // Stepped base band follows the terrain bay by bay (front .01 m, behind the .07 m arch backing). A single
      // band at the facade-midpoint height floated ~2 m up the wall on downhill runs.
      const plinths=Math.max(1,Math.round(f.length/3.1));
      for(let s=0;s<plinths;s++) {
        const u0=s*f.length/plinths,u1=(s+1)*f.length/plinths;
        const hs=[u0,(u0+u1)/2,u1].map(u=>{const p=f.point(u,0,.02);return height(p[0],p[2]);});
        const lo=Math.min(...hs)-.12,hi=Math.max(...hs)+.6;
        // where this facade ends at a re-entrant (non-convex) corner, the band's end
        // face lay on the next wall's plane; it stops 1 cm short there and at its start (convex ends keep the closed mitre).
        const e=s===plinths-1&&!convex?.01:0,b0=s===0?.01:0;localBox(f,(u0+b0+u1-e)/2,(lo+hi)/2,-.03,u1-u0-e-b0,hi-lo,.08,'#b7afa1');
      }
      const bays=cityHall?7:Math.max(1,Math.floor(f.length/3.1));
      for(let floor=0;floor<floors;floor++) {
        if(floor)run(.17,.06,.22,ground+floor*floorH,.18,floor);
        for(let j=0;j<bays;j++) {
          const u=(j+.5)*f.length/bays,p=f.point(u,0,.4);
          const bottom=floor?ground+floor*floorH+.4:height(p[0],p[2])+.16;
          const width=Math.min(cityHall?2.1:1.4,f.length/bays*.62),nominal=Math.min(2.75,floorH-.55);
          // Uphill ground-floor bays keep their doorstep at the local street, but stop below the first string
          // course/balcony brackets (identical to nominal where the street is level with the facade midpoint).
          const h=floor?nominal:Math.min(nominal,ground+floorH-.39-bottom);
          const arched=cityHall?(floor===0||j>0&&j<6):floor===0&&j%3===0;opening(f,u,bottom,width,h,arched);openings++;
          // Light round a closed leaf (the recess shows at its edges and over its head; L12); more often on the plaza fronts.
          {const hh=arched?h-width/2:h;glowPane(...f.point(u,bottom+hh/2,.09),f.angle,width,hh,floor?'upperSeam':onPlaza||cityHall?'doorPlaza':'doorSeam');}
          if(floor&&(cityHall||j%2===(b.id%2)))balcony(f,u,bottom-.17,width+.1,cityHall);
        }
      }
      // Wall lanterns (the street lanterns' bracket form, Wikimedia Commons curid=182287159, curid=158245806; D1/G3 iron
      // wall brackets on Cristo): on every third pier between ground-floor bays (every other one on the cathedral corridor
      // streets), below the first string course and clear
      // of the balconies (piers sit half a bay from either opening). Above heads, non-solid.
      // City Hall: a lantern on every arcade pier (its arcade rhythm at dusk, L3; inferred fixtures); the corridor streets
      // every other pier, other fronts every third.
      if(bays>1)for(let j=1;j<bays;j++){if(!cityHall&&(j+b.id)%(corridor?2:3))continue;
        const u=j*f.length/bays,p=f.point(u,0,.5),y=height(p[0],p[2])+2.7;if(y+.62>ground+floorH-.12)continue;
        // their light on pale plaster at close range was brighter than the street's (first frame out of the plaza):
        // the plaza-kit fronts alternate 50 / 70 % of a street lantern's light, City Hall's arcade 45 / 65 % (every pier keeps
        // its lantern and core: the rhythm stays, the plaster under them is no longer the brightest thing out of the plaza)
        wallLantern(f,u,y,cityHall?(j%2?.45:.65):j%2?.5:.7);}
      // Twin belfries are the defining City Hall silhouette (Wikimedia Commons curid=119654687, curid=131971241); dimensions inferred within OSM facade.
      if(cityHall)for(const u of [f.length*.12,f.length*.88]) {
        facadePass=false; // Keep the large tower/cap silhouette in the shadow map.
        const base=b.roof;
        // Wikimedia Commons curid=119654687, curid=131971241: lower tower walls continue the facade, not an unsupported streetward cantilever.
        const depth=3.5,centre=-depth/2,front=centre+depth/2,upperFront=centre+3.1/2;
        localBox(f,u,base+1.4,centre,3.5,2.8,depth,'#b7ced1');
        localBox(f,u,base+2.8,centre,3.9,.24,3.9,C.trim);
        localBox(f,u,base+4.25,centre,3.1,2.65,3.1,'#b7ced1');
        const tf={...f,point:(s,y,d=0)=>f.point(u+s,y,d+upperFront+.02)};
        opening(tf,0,base+3.15,1.55,1.85,true);
        localBox(f,u,base+5.6,centre,3.6,.25,3.6,C.trim);
        const cap=own(new THREE.CylinderGeometry(1.25,1.8,.75,4));
        bake(cap,...f.point(u,base+6.05,centre),1,1,1,C.trim,f.angle+Math.PI/4);
        cyl(...f.point(u,base+6.65,centre),.09,.5,C.trim);
        // Round clock face and hands, mounted on the street-facing tower wall.
        const clock=own(new THREE.CircleGeometry(.4,24));
        const cp=f.point(u,base+1.5,front+.03);
        bake(clock,...cp,1,1,1,C.trim,f.angle);
        localBox(f,u,base+1.62,front+.05,.045,.28,.025,C.iron);
        localBox(f,u+.1,base+1.5,front+.05,.23,.04,.025,C.iron);
        facadePass=true;
      }
    }
  }
  const sculpture=createStatueBuilder({bake,own,box,sphere,segment});
  if(world.corridor)buildCathedral(world.corridor.cathedral,{localBox,bake,own,archGeometry,sphere,cylinder,box,sculpture});
  facadePass=false;
  // Puerta de San Juan / Paseo del Morro: shared spatial pools, plus masonry/plaster/rock owners of its own.
  const gateStats=world.gate?buildGate(world.gate,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}):null;
  const fortStats=world.fort?buildFort(world.fort,{scene,bake,own,box,cylinder,sphere,mat,meshes,textures,height}):null;
  // area modules (Princesa east, San Cristóbal / Plaza Colón): same shared pools and owners.
  const areaStats={};for(const key of Object.keys(AREA_LAYOUTS))areaStats[key]=world[key]?AREA_BUILDERS[key](world[key],{scene,bake,own,box,cylinder,sphere,mat,materials,meshes,textures,height,world}):null;

  // Fountain: mapped circumference, low layered warm-stone ring, central bowl and four simplified draped figures.
  const f=plaza.fountain,ringG=own(new THREE.TorusGeometry(f.radius-.25,.23,6,48));ringG.rotateX(Math.PI/2);
  const baseG=own(new THREE.CylinderGeometry(f.radius,f.radius,f.foundation.maxY-f.foundation.minY,32));
  bake(baseG,f.x,(f.foundation.minY+f.foundation.maxY)/2,f.z,1,1,1,C.stone);
  const wallG=own(new THREE.CylinderGeometry(f.radius-.18,f.radius-.12,.56,32,1,true));
  bake(wallG,f.x,f.y+.43,f.z,1,1,1,C.stone);
  bake(ringG,f.x,f.y+.62,f.z,1,1,1,'#c4ac8d');
  const water=own(new THREE.CircleGeometry(f.radius-.42,48));water.rotateX(-Math.PI/2);
  const wm=smallWaterMaterial({},scene);   // js/sj-sea.js: ripple, sky Fresnel, sun
  const waterMesh=new THREE.Mesh(water,wm);waterMesh.name='sj-plaza-fountain-water';compileAtBoot(waterMesh);waterMesh.position.set(f.x,f.y+.47,f.z);materials.add(wm);scene.add(waterMesh);meshes.push(waterMesh);
  cyl(f.x,f.y+.65,f.z,1.25,1.1,'#aa8b60');cyl(f.x,f.y+1.23,f.z,1.45,.16,'#c4aa7d');
  cyl(f.x,f.y+1.8,f.z,.065,1.05,'#c8d9ce');
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2+.23,x=f.x+Math.cos(a)*(f.radius-.28),z=f.z+Math.sin(a)*(f.radius-.28);
    cube(x,f.y+.7,z,.94,1.2,.94,C.stone,a);
    sculpture(statueFrame(x,f.y+1.28,z,Math.atan2(x-f.x,z-f.z)),'#ded9c6');
  }
  // Static pale jets: tiny opaque ribbons, no particles, reflection targets or transparent sorting.
  for(let j=0;j<16;j++) {
    const a=j*Math.PI/8,points=[];
    for(let k=0;k<=8;k++){const u=k/8,r=1.2+(f.radius-1.85)*u;
      points.push(new THREE.Vector3(f.x+Math.cos(a)*r,f.y+.55-.1*u+2.7*u*(1-u),f.z+Math.sin(a)*r));}
    const jet=own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),8,.019,3,false));
    bake(jet,0,0,0,1,1,1,'#c8d9ce');
  }

  // Original OSM tree positions retained, broad rounded multi-lobed canopies and visible branching (Wikimedia Commons curid=119654687, curid=151531420).
  for(let i=0;i<plaza.trees.length;i++) {
    // Seated trunk (r.foot from the world's construction pass; js/sj-street-kit.js seatRecords).
    const tr=plaza.trees[i],tb=Number.isFinite(tr.foot)?Math.min(tr.y,tr.foot):tr.y;cyl(tr.x,(tb+tr.y+4)/2,tr.z,tr.radius,tr.y+4-tb,'#81765e');
    for(let j=0;j<6;j++) {
      const a=j*Math.PI/3+i*.7,r=1.6+(j%2)*.5;
      const p=[tr.x+Math.cos(a)*r,tr.y+4.7+(j%3)*.4,tr.z+Math.sin(a)*r];
      segment([tr.x,tr.y+2.5,tr.z],p,.11,'#81765e');
      bake(sphere,...p,2.15,1.65,2.0,['#426341','#4c7145','#3d5f3c'][j%3],a,'leaf');
    }
    bake(sphere,tr.x,tr.y+5.9,tr.z,2.45,1.65,2.25,'#537749',0,'leaf');
  }
  // Compact palms: curved rachis plus paired tapered leaflets, shared once across the three planters.
  function palm(p) {
    const pb=Number.isFinite(p.foot)?Math.min(p.y,p.foot):p.y,pot=own(new THREE.CylinderGeometry(p.radius,.30,.72+p.y-pb,12));  // seated pot foot
    bake(pot,p.x,(pb+p.y+.72)/2,p.z,1,1,1,'#a2694a');cyl(p.x,p.y+.74,p.z,p.radius,.12,'#ba8156');
    cyl(p.x,p.y+.81,p.z,p.radius*.86,.04,'#554c35');
    const crown=p.y+.8+1.55*p.scale;
    cyl(p.x,(p.y+.8+crown)/2,p.z,.08,crown-p.y-.8,'#8d8b57');
    for(let j=0;j<11;j++) {
      const a=j*Math.PI*2/11,pitch=(j%3)*.18;
      const point=u=>[p.x+Math.cos(a)*1.65*p.scale*u,crown+p.scale*(1.6*u-2.0*u*u+pitch*u),p.z+Math.sin(a)*1.65*p.scale*u];
      const rib=u=>{const k=Math.min(3,Math.floor(Math.max(0,u)*4)),f=u*4-k,p0=point(k/4),p1=point((k+1)/4);return p0.map((v,i)=>v+(p1[i]-v)*f);};
      const ps=[];
      for(let k=1;k<=9;k++) {
        const u=k/10,at=rib(u),width=.42*Math.sin(u*Math.PI)*p.scale;
        for(const side of [-1,1]) {
          const end=[at[0]+Math.cos(a+.95*side)*width,at[1]-.15,at[2]+Math.sin(a+.95*side)*width];
          const next=rib(u+.08); // roots on the 4-segment rib itself (up to 6 mm off it)
          ps.push(...at,...end,...next);
        }
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.computeVertexNormals();
      bake(g,0,0,0,1,1,1,['#38603b','#496f3d','#65854b'][j%3],0,'leaf');g.dispose();
      for(let k=0;k<4;k++)segment(point(k/4),point((k+1)/4),.014,'#718449','leaf');
    }
  }
  for(const p of plaza.palms)palm(p);
  for(const b of plaza.benches) {
    const f={angle:b.heading,point:(u,y,d=0)=>[b.x+Math.cos(b.heading)*u+Math.sin(b.heading)*d,y,b.z-Math.sin(b.heading)*u+Math.cos(b.heading)*d]};
    for(const s of [-.72,.72])localBox(f,s,b.y+.22,0,.085,.56,.5,C.iron); // 6 cm into the ground (35 mm daylight)
    for(let i=0;i<3;i++)localBox(f,0,b.y+.49,-.22+i*.2,b.width,.075,.15,'#797447');
    for(const y of [.72,.88])localBox(f,0,b.y+y,-.26,b.width,.14,.07,'#797447');
    for(const s of [-.82,.82])localBox(f,s,b.y+.72,-.26,.06,.45,.07,C.iron);
  }
  // A small number of traditional dark posts, Wikimedia Commons curid=119654687, curid=151531420 silhouettes; placement inferred beside mapped trees.
  for(const {x,y,z,foot} of plaza.lamps) {
    cyl(x,y+1.8,z,.065,3.6,C.iron);
    const lb=Number.isFinite(foot)?Math.min(y,foot):y;cyl(x,(lb+y+.44)/2,z,.18,y+.44-lb,C.iron);/* seated foot */cube(x,y+3.7,z,.28,.5,.28,'#dbc997');glowLamp(x,y+3.7,z,'post',{ground:y});
    const cap=own(new THREE.ConeGeometry(.29,.22,4));bake(cap,x,y+4.06,z,1,1,1,C.iron,Math.PI/4);
  }
  // Supplementary Wikimedia Commons curid=131971302: octagonal green canopy, slender posts, stone base and copper-coloured roof cap.
  const gazebo=plaza.gazebo,gy=gazebo.y;
  const deck=own(new THREE.CylinderGeometry(gazebo.radius,gazebo.radius,gazebo.foundation.maxY-gazebo.foundation.minY,32));
  bake(deck,gazebo.x,(gazebo.foundation.minY+gazebo.foundation.maxY)/2,gazebo.z,1,1,1,C.stone);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,x=gazebo.x+Math.cos(a)*2.8,z=gazebo.z+Math.sin(a)*2.8;
    cyl(x,gy+2.125,z,.10,3.35,'#485c43');
  }
  const canopy=own(new THREE.CylinderGeometry(3.5,3.5,.6,8));
  bake(canopy,gazebo.x,gy+3.8,gazebo.z,1,1,1,'#46614c',Math.PI/8);
  const roof=own(new THREE.ConeGeometry(3.5,1.0,8));
  bake(roof,gazebo.x,gy+4.6,gazebo.z,1,1,1,'#71826a',Math.PI/8);
  cyl(gazebo.x,gy+5.05,gazebo.z,.45,.5,'#486347');
  const cupola=own(new THREE.ConeGeometry(.65,.45,8));bake(cupola,gazebo.x,gy+5.5,gazebo.z,1,1,1,'#b47e53');
  // Gazebo lanterns (inferred; a lit kiosk is the plaza's east anchor at dusk, L3): a pendant under the canopy and a
  // bracket lantern on the outer face of every other post, all under the canopy edge and above heads. Non-solid.
  {const lamp=(x,y,z,ry)=>{bake(box,x,y-.18,z,.2,.04,.2,C.iron,ry,'facade');bake(box,x,y,z,.18,.3,.18,'#e8d9a4',ry,'facade');
      bake(box,x,y+.19,z,.24,.06,.24,C.iron,ry,'facade');};
    bake(cylinder,gazebo.x,gy+3.27,gazebo.z,.015,.5,.015,C.iron,0,'facade');lamp(gazebo.x,gy+2.86,gazebo.z,Math.PI/8);
    glowLamp(gazebo.x,gy+2.86,gazebo.z,'post',{ground:gy+.45});
    for(let i=1;i<8;i+=2){const a=i*Math.PI/4,c=Math.cos(a),sn=Math.sin(a),at=r=>[gazebo.x+c*r,gazebo.z+sn*r];
      const [ax,az]=at(2.88),[lx,lz]=at(3.2);bake(box,(ax+lx)/2,gy+2.98,(az+lz)/2,.34,.04,.04,C.iron,-a,'facade');
      lamp(lx,gy+2.8,lz,-a);glowLamp(lx,gy+2.8,lz,'post',{ground:gy+.45});}}
  // Small mapped structures retain their footprints; finish is provisional, not a branded shop replica.
  for(const b of city.buildings.filter(b=>[410592051,410620625].includes(b.id))) {
    const signed=b.outer.reduce((sum,p,j)=>{const q=b.outer[(j+1)%b.outer.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    for(let i=0;i<b.outer.length;i++) {
      let a=b.outer[i],end=b.outer[(i+1)%b.outer.length];
      if(signed>0)[a,end]=[end,a];
      const fr=frame(a,end);
      localBox(fr,fr.length/2,b.roof-.18,.04,fr.length,.3,.12,'#40584b');
      if(fr.length>1.2){const ground=height(...a);opening(fr,fr.length/2,ground+.5,Math.min(1.2,fr.length*.7),1.5);}
    }
  }

  // Surface overlays clip original terrain triangles, so there is no new flat floor or per-stone geometry.
  function texture(kind) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');let seed=3721;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    ctx.fillStyle=kind==='sett'?'#515a5a':'#5c6360';ctx.fillRect(0,0,256,256);
    const rows=kind==='sett'?8:4,cols=kind==='sett'?8:4,w=256/cols,h=256/rows;
    for(let j=0;j<rows;j++)for(let i=-1;i<=cols;i++) {
      const x=i*w+(j%2)*w*.5,y=j*h,v=Math.floor(random()*22);
      ctx.fillStyle=kind==='sett'?`rgb(${105+v},${120+v},${129+v})`:`rgb(${105+v},${110+v},${109+v})`;
      ctx.fillRect(x+1,y+1,w-2,h-2);
      ctx.fillStyle='rgba(245,235,209,.13)';ctx.fillRect(x+1,y+1,w-2,1);
    }
    for(let i=0;i<8000;i++){ctx.fillStyle=random()<.5?'rgba(20,30,20,.05)':'rgba(230,230,210,.06)';ctx.fillRect(random()*256,random()*256,1,1);}
    const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.anisotropy=4;textures.add(tx);return tx;
  }
  function clip(poly,ring) {
    const sign=Math.sign(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0));
    let out=poly;
    for(let j=0;j<ring.length&&out.length;j++) {
      const a=ring[j],b=ring[(j+1)%ring.length],input=out;out=[];
      const d=p=>sign*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
      for(let k=0;k<input.length;k++) {
        const p=input[k],q=input[(k+1)%input.length],dp=d(p),dq=d(q);
        if(dp>=0)out.push(p);
        if((dp>=0)!==(dq>=0)){const u=dp/(dp-dq);out.push(p.map((v,i)=>v+(q[i]-v)*u));}
      }
    }
    return out;
  }
  // aggregate: reddish exposed-aggregate paving with grey bands (cemetery approach/walks, Wikimedia Commons curid=51518101, curid=80369333, curid=80369335); roadFloor:
  // authored asphalt floor triangles (Calle Cementerio bore and lane, OSM surface=asphalt).
  // patched: La Perla district running strips (Wikimedia Commons curid=72372072, curid=72372077, curid=72372066, curid=86543919), their own patched-asphalt texture. panel: La Princesa's
  // promenade (Wikimedia Commons curid=184241561: large warm-grey/rose panels).
  const surfaceBatches={plaza:[],sett:[],asphalt:[],paseo:[],morro:[],passage:[],wet:[],aggregate:[],roadFloor:[],aggregateFloor:[],patched:[],panel:[],linear:[],terra:[],linearE:[],terraE:[]};
  function overlay(ring,kind) {
    const minX=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[0]))-t.x0)/t.step));
    const maxX=Math.min(t.nx-2,Math.ceil((Math.max(...ring.map(p=>p[0]))-t.x0)/t.step));
    const minZ=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[1]))-t.z0)/t.step));
    const maxZ=Math.min(t.nz-2,Math.ceil((Math.max(...ring.map(p=>p[1]))-t.z0)/t.step));
    for(let j=minZ;j<=maxZ;j++)for(let i=minX;i<=maxX;i++) {
      const x=t.x0+i*t.step,z=t.z0+j*t.step,k=j*t.nx+i;
      const a=[x,t.heights[k],z],b=[x+t.step,t.heights[k+1],z],c=[x,t.heights[k+t.nx],z+t.step],d=[x+t.step,t.heights[k+t.nx+1],z+t.step];
      for(const tri of [[a,c,b],[b,c,d]]) {
        const poly=clip(tri,ring);
        for(let q=1;q<poly.length-1;q++) {
          const [a,b,c]=[poly[0],poly[q],poly[q+1]];
          if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))<1e-9)continue;
          surfaceBatches[kind].push(...a,...b,...c);
        }
      }
    }
  }
  // Regions are disjoint, including same-material road junctions. Offset only separates this single layer from terrain.
  const pavingRegions=createPavingRegions(detail,plaza);
  for(const {ring,kind} of pavingRegions)overlay(ring,kind);
  // Gate paseo surfaces drape the terrain; the passage floor is the authored replacement-floor geometry itself.
  if(world.gate){for(const {ring,kind} of world.gate.surfaces)overlay(ring,kind);
    for(const tri of [...world.gate.passage.floorTriangles,...world.gate.passage.skirts])surfaceBatches.passage.push(...tri.flat());
    // Stairs round: the 270140129 landing is the throat court's own ground (same sett), drawn = its replacement tops.
    for(const tri of world.gate.landing?.floorTriangles??[])surfaceBatches.passage.push(...tri.flat());}
  // El Morro esplanade strip/turning circle drape the terrain; the bridge deck is authored floor geometry (sett, OSM).
  if(world.fort){for(const {ring,kind} of world.fort.surfaces)overlay(ring,kind);
    for(const tri of world.fort.bridge.deckTriangles)surfaceBatches.passage.push(...tri.flat());}
  for(const area of areasOf(world)){for(const {ring,kind} of area.surfaces)overlay(ring,kind);
    for(const tri of area.floorTriangles)surfaceBatches[tri.kind==='road'?'roadFloor':tri.kind==='aggregate'?'aggregateFloor':'passage'].push(...tri.flat());}
  // wet: the Quinto Centenario splash pad (Wikimedia Commons curid=38237168) — the plaza's stone, darker and glossier.
  const shared=new Map(),textureFor=kind=>{const key=kind==='linearE'?'linear':kind==='terraE'?'terra':kind==='passage'?'sett':kind==='morro'?'paseo':kind==='aggregate'||kind==='aggregateFloor'?'aggregate':kind==='wet'?'plaza':kind;
    if(!shared.has(key))shared.set(key,key==='paseo'?paseoTexture(textures):key==='aggregate'?aggregateTexture(textures):key==='patched'?patchedTexture(textures):key==='panel'?panelTexture(textures):key==='linear'?linearTexture(textures):key==='terra'?terraTexture(textures):texture(key));return shared.get(key);};
  const tint={asphalt:'#727875',paseo:'#f1e2cd',morro:'#e4e4df',passage:'#9e9d96',wet:'#7d8786',aggregate:'#ffffff',roadFloor:'#727875',aggregateFloor:'#ffffff',patched:'#ffffff',panel:'#ffffff'};
  // these kinds are scattered over the whole city; each geographically separate cluster is its
  // own draw (same material, same triangles, see sj-pool-groups.js), so a street view no longer submits far clusters.
  const clustered=new Set(['sett','paseo','morro','panel','roadFloor']),surfaceMats=new Map();
  for(const [kind,all] of Object.entries(surfaceBatches))if(all.length)for(const positions of clustered.has(kind)?pavingClusters(all):[all]) {
    const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const sett=kind==='sett'||kind==='passage',slab=kind==='paseo'||kind==='morro'||kind==='aggregate'||kind==='aggregateFloor';
    const uv=[];for(let i=0;i<positions.length;i+=3){const x=positions[i],z=positions[i+2];uv.push((x*.973-z*.23)/(sett?2.4:slab?3.2:kind==='patched'?8:kind==='panel'?4.8:4),(x*.23+z*.973)/(sett?1.28:slab?3.2:kind==='patched'?8:kind==='panel'?4.8:4));}
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();
    // The bore floor is authored geometry over a terrain cut, not a coplanar overlay: no depth offset (keeps its stone line).
    // aggregateFloor (La Perla wall-foot aprons) keeps the overlay offset: it lies over kept ground, not a full cut.
    const floor=kind==='passage'||kind==='roadFloor';
    const m=surfaceMats.get(kind)??surfaceMats.set(kind,mat({color:tint[kind]??'#ffffff',map:kind==='asphalt'||kind==='roadFloor'?null:textureFor(kind),roughness:kind==='wet'?.32:.94,metalness:0,
      ...(floor?{}:{polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})})).get(kind);
    const mesh=new THREE.Mesh(g,m);mesh.name=kind==='passage'?'sj-plaza-gate-floor':kind==='roadFloor'?'sj-plaza-road-floor':kind==='aggregateFloor'?'sj-plaza-apron-floor':'sj-plaza-surface-'+kind;mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);
  }
  // The plain position lists were copied into typed attributes; the returned dispose closure must not keep them alive.
  for(const kind of Object.keys(surfaceBatches))surfaceBatches[kind]=null;
  let vertices=0;
  // compatible 64 m pools whose merged bounds stay tight are drawn as one (sj-pool-groups.js).
  // Instance transforms/colours and merged vertices are concatenated unchanged; materials and shadow flags are per key.
  const poolList=[...instances.values()],batchList=[...batches.values()],sphere0=new THREE.Sphere(),sphere1=new THREE.Sphere(),m4=new THREE.Matrix4();
  const poolItems=[...poolList.map(pool=>{
    if(!pool.g.boundingSphere)pool.g.computeBoundingSphere();sphere0.makeEmpty();
    for(let i=0;i<pool.transforms.length;i+=16){m4.fromArray(pool.transforms,i);sphere1.copy(pool.g.boundingSphere).applyMatrix4(m4);sphere0.union(sphere1);}
    return {key:`i,${pool.g===box?'box':pool.g===cylinder?'cylinder':'sphere'},${pool.kind==='leaf'},${pool.kind!=='facade'}`,x:sphere0.center.x,y:sphere0.center.y,z:sphere0.center.z,r:sphere0.radius,
      tri:(pool.g.index?.count??pool.g.attributes.position.count)/3*pool.colours.length/3,cast:pool.kind!=='facade'};
  }),...batchList.map(b=>{
    const p=b.p;let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity,r2=0;
    for(let i=0;i<p.length;i+=3){x0=Math.min(x0,p[i]);x1=Math.max(x1,p[i]);y0=Math.min(y0,p[i+1]);y1=Math.max(y1,p[i+1]);z0=Math.min(z0,p[i+2]);z1=Math.max(z1,p[i+2]);}
    const x=(x0+x1)/2,y=(y0+y1)/2,z=(z0+z1)/2;for(let i=0;i<p.length;i+=3)r2=Math.max(r2,(p[i]-x)**2+(p[i+1]-y)**2+(p[i+2]-z)**2);
    return {key:`b,${b.kind==='leaf'},${b.kind!=='facade'}`,x,y,z,r:Math.sqrt(r2),tri:p.length/9,cast:b.kind!=='facade'};
  })];
  for(const group of groupPools(poolItems)) {
    if(group[0]<poolList.length) {
      const members=group.map(i=>poolList[i]),pool=members[0],count=members.reduce((n,q)=>n+q.colours.length/3,0);
      const mesh=new THREE.InstancedMesh(pool.g,pool.kind==='leaf'?foliage:standard,count),colours=new Float32Array(count*3);
      let at=0;for(const q of members){mesh.instanceMatrix.array.set(q.transforms,at*16);colours.set(q.colours,at*3);at+=q.colours.length/3;}
      mesh.instanceColor=new THREE.InstancedBufferAttribute(colours,3);
      mesh.castShadow=pool.kind!=='facade';mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);meshes.push(mesh);
      vertices+=(pool.g.index?.count??pool.g.attributes.position.count)*count;
    }else{
      const members=group.map(i=>batchList[i-poolList.length]),b=members[0],cat=key=>{const out=new Float32Array(members.reduce((n,q)=>n+q[key].length,0));let at=0;for(const q of members){out.set(q[key],at);at+=q[key].length;}return out;};
      const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.BufferAttribute(cat('p'),3));
      g.setAttribute('normal',new THREE.BufferAttribute(cat('n'),3));g.setAttribute('color',new THREE.BufferAttribute(cat('c'),3));g.computeBoundingSphere();
      const m=new THREE.Mesh(g,b.kind==='leaf'?foliage:standard);m.castShadow=b.kind!=='facade';m.receiveShadow=true;scene.add(m);meshes.push(m);vertices+=g.attributes.position.count;
    }
  }
  // The grouping lists hold the plain transform/vertex arrays and are captured by this scope's closures (dispose):
  // empty them so the copied construction data is not retained after the build (perf 2026-11-18, heap check).
  poolList.length=0;batchList.length=0;poolItems.length=0;
  instances.clear();
  batches.clear();
  for(const mesh of meshes)if(!mesh.name)mesh.name='sj-plaza-detail';
  // Unit/temporary authored sources are no longer needed after baking; keep only drawn geometries owned.
  const drawn=new Set(meshes.map(m=>m.geometry));
  for(const g of geometries)if(!drawn.has(g)){g.dispose();geometries.delete(g);}
  const bytes=[...geometries].reduce((n,g)=>n+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength??0),0)
    +meshes.reduce((n,m)=>n+(m.instanceMatrix?.array.byteLength??0)+(m.instanceColor?.array.byteLength??0),0);
  return {stats:{facades,openings,corridorFacades,wallLanterns,cathedralSteps:world.corridor?.cathedral.steps.length??0,
    palms:plaza.palms.length,trees:plaza.trees.length,benches:plaza.benches.length,
    meshes:meshes.length,vertices,geometryBytes:bytes,textureBytes:textures.size*4*(256*256*4-1)/3,colliders:plaza.colliders.length+(world.corridor?.colliders.length??0)+(world.gate?.colliders.length??0)+(world.fort?.colliders.length??0)+areasOf(world).reduce((n,a)=>n+a.colliders.length,0),pavingRegions:pavingRegions.length,
    gate:gateStats&&{...gateStats,colliders:world.gate.colliders.length,floorTops:world.gate.tops.length,surfaces:world.gate.surfaces.length},
    fort:fortStats&&{...fortStats,colliders:world.fort.colliders.length,floorTops:world.fort.tops.length,surfaces:world.fort.surfaces.length},
    ...Object.fromEntries(Object.entries(areaStats).map(([key,st])=>[key,st&&{...st,colliders:world[key].colliders.length,floorTops:world[key].tops.length,surfaces:world[key].surfaces.length}]))},
    dispose(){for(const m of meshes){scene.remove(m);m.dispose?.();}for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}};
}
