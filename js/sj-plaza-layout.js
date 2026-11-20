/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// First reference-led area — © 2026 VibezZzCoder, MIT. OSM-derived anchors: ODbL.
// Shared physical/render dimensions. See  for photo IDs and inference.
export const DETAIL_BOUNDS = {minX:-100,maxX:85,minZ:-58,maxZ:108};
export const inDetail = (x,z) => x>DETAIL_BOUNDS.minX&&x<DETAIL_BOUNDS.maxX&&z>DETAIL_BOUNDS.minZ&&z<DETAIL_BOUNDS.maxZ;

export function inRing(x,z,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export const circle = (x,z,r,n=32) => Array.from({length:n},(_,i)=>[x+Math.cos(i*Math.PI*2/n)*r,z+Math.sin(i*Math.PI*2/n)*r]);
export function segmentDistance(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-dx*u,z-a[1]-dz*u);
}

export function plazaGroundBase(x,z,world) {
  // Keep this hot construction query local: most terrain vertices are far outside either detailed area.
  const a=DETAIL_BOUNDS,b=world.corridor?.pavingBounds??world.corridor?.bounds;
  if(!(x>=a.minX-6&&x<=a.maxX+6&&z>=a.minZ-6&&z<=a.maxZ+6)
    &&!(b&&x>=b.minX-6&&x<=b.maxX+6&&z>=b.minZ-6&&z<=b.maxZ+6))return false;
  const ring=world.detail.plaza.ring;
  return inRing(x,z,ring)||ring.some((a,i)=>segmentDistance(x,z,a,ring[(i+1)%ring.length])<3)
    ||world.plaza.paving.some(s=>segmentDistance(x,z,s.a,s.b)<s.width/2+3);
}

export function plazaBuilding(b,height) {
  // Small mapped cafe/telephone structures were assigned the generic TWO-STOREY fallback.
  // Replace that inference with explicitly approximate single-storey envelopes, same footprint for render/physics.
  const rise=b.id===410620625?3.4:b.id===410592051?2.65:null;
  if(rise===null)return b;
  const ground=Math.max(...b.outer.map(p=>height(...p)));
  return {...b,roof:ground+rise,heightSource:'authored-single-storey-plaza-inference'};
}

export function terrainFoundation(outer,terrain,maxY) {
  // Include every grid vertex of every cell intersecting the footprint's bounds. Any point of a terrain facet is
  // a convex combination of its vertices, so this minimum also bounds unsampled edge/interior depressions.
  const {x0,z0,step,nx,nz,heights}=terrain;
  const loX=Math.max(0,Math.floor((Math.min(...outer.map(p=>p[0]))-x0)/step));
  const hiX=Math.min(nx-1,Math.ceil((Math.max(...outer.map(p=>p[0]))-x0)/step));
  const loZ=Math.max(0,Math.floor((Math.min(...outer.map(p=>p[1]))-z0)/step));
  const hiZ=Math.min(nz-1,Math.ceil((Math.max(...outer.map(p=>p[1]))-z0)/step));
  let minimum=Infinity;
  for(let j=loZ;j<=hiZ;j++)for(let i=loX;i<=hiX;i++)minimum=Math.min(minimum,heights[j*nx+i]);
  if(!Number.isFinite(minimum)||maxY<=minimum)throw new Error('Invalid plaza foundation bounds');
  return {minY:minimum-.12,maxY}; // Buried toe; level upper geometry/terrain heights stay unchanged.
}

export function createPlazaLayout({city,detail,height,terrain}) {
  const ring=detail.fountain.ring;
  const x=ring.reduce((n,p)=>n+p[0],0)/ring.length,z=ring.reduce((n,p)=>n+p[1],0)/ring.length;
  const radius=Math.max(...ring.map(p=>Math.hypot(p[0]-x,p[1]-z)))+.45;
  const fountain={x,z,y:height(x,z),radius,outer:circle(x,z,radius),rim:.82};
  fountain.foundation=terrainFoundation(fountain.outer,terrain,fountain.y+.205);
  const trees=city.trees.filter(([tx,tz])=>inRing(tx,tz,detail.plaza.ring)).map(([tx,tz])=>({x:tx,z:tz,y:height(tx,tz),radius:.26}));
  // OSM positions; bench headings/dimensions inferred from Wikimedia Commons curid=119654687, curid=151531420, facing away from each nearby trunk.
  const benches=detail.benches.map(b=>{
    const [bx,bz]=b.point,tree=[...trees].sort((a,b)=>Math.hypot(a.x-bx,a.z-bz)-Math.hypot(b.x-bx,b.z-bz))[0];
    return {x:bx,z:bz,y:height(bx,bz),heading:Math.atan2(bx-tree.x,bz-tree.z),width:1.9,depth:.6,height:.95};
  });
  // Wikimedia Commons curid=151531420, curid=80303584: small potted palms near the western planting, not a surveyed planting inventory.
  const palms=[[-29.2,29.4],[-29.7,32.0],[-27.7,31.7]].map(([px,pz],i)=>({x:px,z:pz,y:height(px,pz),radius:.42,scale:.92+i*.12}));
  const lamps=[trees[0],trees[2]].filter(Boolean).map(tr=>({x:tr.x-1.2,z:tr.z+1,y:height(tr.x-1.2,tr.z+1),radius:.18}));
  const gr=detail.gazebo.ring,gx=gr.reduce((n,p)=>n+p[0],0)/gr.length,gz=gr.reduce((n,p)=>n+p[1],0)/gr.length;
  const gazebo={x:gx,z:gz,y:Math.max(...gr.map(p=>height(...p))),radius:3.2,outer:circle(gx,gz,3.2)};
  gazebo.foundation=terrainFoundation(gazebo.outer,terrain,gazebo.y+.45);
  const paving=[];
  for(const road of city.roads)if(road.kind==='residential')for(let i=1;i<road.points.length;i++) {
    const a=road.points[i-1],b=road.points[i];
    if(inDetail(...a)&&inDetail(...b))paving.push({a,b,width:road.width,kind:road.surface==='sett'?'sett':'asphalt',source:road.id});
  }
  const colliders=[];
  const prism=(outer,minY,maxY)=>({outer:outer.map(([x,z])=>({x,z})),holes:[],minY,maxY,surface:'pavement',support:false});
  // Fountain basin is excluded by its visible outer rim. Terrain/physics remain the shared unmodified heightfield.
  colliders.push(prism(fountain.outer,fountain.foundation.minY,fountain.y+fountain.rim));
  for(const b of benches)colliders.push({centre:{x:b.x,y:b.y+b.height/2,z:b.z},halfExtents:{x:b.width/2,y:b.height/2,z:b.depth/2},rotationY:b.heading,surface:'pavement'});
  for(const p of palms)colliders.push(prism(circle(p.x,p.z,p.radius,12),p.y-.08,p.y+.78));
  for(const t of trees)colliders.push(prism(circle(t.x,t.z,t.radius,12),t.y-.1,t.y+4));
  for(const l of lamps)colliders.push(prism(circle(l.x,l.z,l.radius,12),l.y-.1,l.y+3.9));
  colliders.push({...prism(gazebo.outer,gazebo.foundation.minY,gazebo.foundation.maxY),support:true});
  const canopy=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4+Math.PI/8;return [gx+Math.cos(a)*3.5,gz+Math.sin(a)*3.5];});
  colliders.push(prism(canopy,gazebo.y+3.5,gazebo.y+4.1));
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,px=gx+Math.cos(a)*2.8,pz=gz+Math.sin(a)*2.8;
    colliders.push(prism(circle(px,pz,.10,12),gazebo.y+.45,gazebo.y+3.8));
  }
  // trunks, pots and lamp feet are seated on the drawn ground under their whole footprint by the
  // world's construction pass (js/sj-street-kit.js seatRecords: r.foot, shared with these colliders).
  const seatLists=[{records:trees,radius:t=>t.radius},{records:lamps,radius:.18},{records:palms,radius:.3}];
  return {fountain,trees,benches,palms,lamps,gazebo,paving,colliders,seatLists};
}
