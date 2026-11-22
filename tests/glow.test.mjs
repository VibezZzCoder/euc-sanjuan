/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Blue-hour light (js/sj-glow.js): the fixtures the builders report, the lit windows, the baked light field.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({resolve(specifier,context,next){
  if(specifier==='three/webgpu')return {url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true};
  return next(specifier,context);
}});
globalThis.fetch=async url=>{const b=readFileSync(url);return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
const noop=new Proxy(()=>{},{get:()=>noop,set:()=>true,apply:()=>noop});
globalThis.document??={createElement:()=>({width:0,height:0,getContext:()=>noop})};
const T=await import('three/webgpu');
const {loadCity,buildWorld}=await import('../js/sj-world.js');
const G=await import('../js/sj-glow.js');
const {PANES}=await import('../js/sj-glow-kinds.js');
const {areasOf}=await import('../js/sj-world.js');
G.GLOW_DIAGNOSTICS.keep=true;   // fixture lists back on the glow object (the game drops them after the bake)
const world=await loadCity(),scene=new T.Scene();scene.fog=new T.Fog(0xa7cbd0,350,2200);
const built=await buildWorld(scene,world),glow=built.glow,{lamps,floods,panes}=glow.fixtures,field=glow.field,lit=G.litPanes(panes);
const byKind={};for(const l of lamps)byKind[l.kind]=(byKind[l.kind]??0)+1;
const lum=e=>.2126*e[0]+.7152*e[1]+.0722*e[2];

test('every lamp family reports its luminous heads, matching the layouts',()=>{
  // Wall lanterns: the streets kit's placed instances plus the plaza/corridor frontage brackets.
  const streetLanterns=scene.children.filter(m=>m.name==='sj-streets-lanterns').reduce((s,m)=>s+m.count,0);
  assert.ok(streetLanterns>200);assert.ok(built.details.wallLanterns>0);
  assert.equal(byKind.lantern,streetLanterns+built.details.wallLanterns);
  assert.equal(byKind.post,world.plaza.lamps.length+world.gate.lamps.length+world.norzagaray.lamps.length+5);   // + the gazebo's pendant and four post lanterns
  assert.equal(byKind.globe,world.cristobal.plaza.lamps.reduce((s,l)=>s+(l.globes===2?2:1),0));
  assert.equal(byKind.cup,world.norzagaray.quinto.lamps.length);
  assert.equal(byKind.pylon,world.bahia.lamps.filter(l=>l.kind==='pylon').length);
  assert.equal(byKind.lattice,world.bahia.lamps.filter(l=>l.kind!=='pylon').length);
  assert.equal(byKind.port,world.waterfront.portLamps.length+(world.skatepark?.skate.lamps.length??0));   // + the skatepark's mast floods
  assert.equal(byKind.faro,1);assert.equal(byKind.lighthouse,1);assert.equal(byKind.bulb,2);assert.equal(byKind.bulbCool,1);assert.equal(byKind.threshold,3);   // La Perla pockets: two street fronts, one seaward, each with a lit threshold
  // Shared kit posts: one head on a stone base, three on the curled clusters; plus heads the builders place directly
  // (La Princesa's pilaster wall brackets and the Fortaleza gate piers).
  const kitLayout=['princesa','puntilla','waterfront','uptown','landmarks','eastcivic'].flatMap(k=>world[k]?.lamps??[]).reduce((s,l)=>s+(l.base?1:3),0);
  assert.ok(byKind.kit>=kitLayout&&byKind.kit-kitLayout<=30,`kit heads ${byKind.kit} vs layouts ${kitLayout}`);
  // Every lamp head has a halo.
  assert.equal(glow.halos.geometry.attributes.position.count,lamps.filter(l=>G.KINDS[l.kind].halo>0).length*4);   // thresholds are light without a fixture
});

test('a believable minority of windows is lit, chosen deterministically',()=>{
  const n=panes.length/7;
  assert.ok(n>10000,`registered panes ${n}`);
  const share=lit.length/n;assert.ok(share>.08&&share<.25,`lit share ${share}`);
  const count={};for(let i=6;i<panes.length;i+=7){const k=Object.keys(PANES)[panes[i]];count[k]??=[0,0];count[k][0]++;}
  for(const p of lit)count[p.kind][1]++;
  for(const [k,[all,on]] of Object.entries(count))if(all>=200)assert.ok(Math.abs(on/all-PANES[k].share)<.06,`${k}: ${on}/${all} vs ${PANES[k].share}`);
  assert.ok(count.leak[1]/count.leak[0]<.08,'closed shutters stay mostly dark');
  // Same choice on a second evaluation (position hash, no random state).
  assert.deepEqual(G.litPanes(panes).map(p=>p.x),lit.map(p=>p.x));assert.equal(glow.stats.lit,lit.length);
  // Lit glass stays glass-sized (storefront bays up to ~14 m²): no wall-sized panel.
  for(const p of lit)assert.ok(p.w*p.h<16,`lit pane ${p.w}×${p.h} at ${p.x},${p.z}`);
});

test('the light field is lit under the lamps and dark away from every source',()=>{
  assert.ok(field&&field.nx*field.nz<1.5e6,'field size');
  // Under (beside) lamps: the pool is there, measured from about the lamp's ground.
  let under=0;for(const l of lamps.filter(l=>l.kind!=='lighthouse'&&KIND_POWER(l)>0).filter((_,i)=>i%7===0)){
    const s=G.sampleField(field,l.x,l.z);if(lum(s.e)>.05&&Math.abs(s.base-l.ground)<3)under++;}
  const sampled=lamps.filter(l=>l.kind!=='lighthouse'&&KIND_POWER(l)>0).filter((_,i)=>i%7===0).length;
  assert.ok(under>=sampled*.95,`lit under ${under}/${sampled} lamps`);
  // Away from every source (beyond its radius): exactly dark, lamps and floods.
  const src=G.fieldSources({lamps,floods});let checked=0;
  for(let k=0;k<4000;k++){const x=field.x0+((k*7919)%997)/997*field.nx*field.texel,z=field.z0+((k*104729)%991)/991*field.nz*field.texel;
    if(src.some(s=>Math.hypot(s.x-x,s.z-z)<s.R+2*field.texel))continue;checked++;
    const s=G.sampleField(field,x,z);assert.equal(lum(s.e),0,`lamp light at ${x},${z}`);assert.equal(s.flood.f,0,`flood light at ${x},${z}`);}
  assert.ok(checked>1000,`dark samples ${checked}`);
  // Known dark places: the open sea north of the city and the middle of the El Morro esplanade.
  for(const [x,z] of [[0,-700],[-600,-470]]){const s=G.sampleField(field,x,z);assert.ok(lum(s.e)<1e-3&&s.flood.f<.02,`light at ${x},${z}`);}
});

test('no light is baked deep inside building masses (except the Capitol dome floods on its own roof)',async()=>{
  const {CAPITOL_ID}=await import('../js/sj-eastcivic-layout.js');let checked=0;
  const inRing=(x,z,r)=>{let s=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [ax,az]=r[i],[bx,bz]=r[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)s=!s;}return s;};
  const edge=(x,z,r)=>{let d=Infinity;for(let i=0,j=r.length-1;i<r.length;j=i++){const [ax,az]=r[i],[bx,bz]=r[j],dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l)):0;d=Math.min(d,Math.hypot(x-ax-dx*t,z-az-dz*t));}return d;};
  const over=new Map(areasOf(world).flatMap(a=>[...(a.buildingOverrides??[])]));
  for(const b0 of world.city.buildings){const b={...b0,...(over.get(b0.id)??{})};if(b.holes?.length)continue;
    let cx=0,cz=0;for(const [x,z] of b.outer){cx+=x;cz+=z;}cx/=b.outer.length;cz/=b.outer.length;
    if(!inRing(cx,cz,b.outer)||edge(cx,cz,b.outer)<4)continue;
    if(cx<field.x0||cz<field.z0||cx>field.x0+field.nx*field.texel||cz>field.z0+field.nz*field.texel)continue;
    const s=G.sampleField(field,cx,cz);checked++;
    assert.ok(lum(s.e)<.02,`lamp light inside building ${b.id}: ${lum(s.e)}`);
    if(b.id!==CAPITOL_ID)assert.ok(s.flood.f<.05,`flood light inside building ${b.id}: ${s.flood.f}`);}
  assert.ok(checked>200,`interiors checked ${checked}`);
});

test('floodlights follow the references: exterior faces only, dry public ground, never the Atlantic front',()=>{
  const plan=glow.stats.floodPlan;
  // Every named wall run and anchor the plan depends on must still exist and produce floods (fails loudly if an area
  // renames or drops a run).
  assert.deepEqual(plan.missing,[],`flood records missing: ${plan.missing}`);
  for(const k of [...G.FLOOD_GROUPS,'morro-entrance','cristobal-entrance','garitas','colon-accent','gate-portal','capitol-dome','capitol-portico','raices','cathedral','alcaldia'])
    assert.ok(plan[k]>0,`no floods for ${k}`);
  assert.ok(!Object.keys(plan).some(k=>/north/.test(k)),'no flood group on El Morro’s Atlantic (north) front');
  for(const f of floods){if(f.through||f.inside)continue;   // roof floods on the dome; floods on a fort's own grounds lighting faces seen from outsideassert.ok(world.isDry(f.x,f.z),`flood source in water ${f.x},${f.z}`);
    const priv=[...Object.values(world)].some(a=>typeof a?.offLimitsAt==='function'&&a.offLimitsAt(f.x,f.z,f.y+1));
    assert.ok(!priv,`flood source on private ground ${f.x},${f.z}`);}
});

test('everything is driven by the hour uniform: nothing glows by day, the bake is cheap',()=>{
  assert.ok(glow.stats.bakeMs<2000,`bake ${glow.stats.bakeMs} ms`);
  // The halos and windows are single meshes (one draw each) that read atmosphere.night; the light is one scene light.
  assert.equal(scene.children.filter(o=>o.isGlowLight).length,1);
  assert.equal(scene.children.filter(o=>o.name==='sj-glow-halos').length,1);
  assert.equal(scene.children.filter(o=>o.name==='sj-glow-windows').length,1);
  for(const m of [glow.halos,glow.windows])assert.equal(m.castShadow,false);
});

function KIND_POWER(l){return G.KINDS[l.kind].power;}

test('the light lands where a rider sees it: plazas, raised streets, colonnades; not on roofs above the lamps',async()=>{
  const up={x:0,y:1,z:0},inRing=(x,z,r)=>{let s=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [ax,az]=r[i],[bx,bz]=r[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)s=!s;}return s;};
  // Plaza de Armas: most of the square receives some lamp light (horizontal receiver at DEM+.04; was 43 %), with dark gaps kept.
  {const ring=world.detail.plaza.ring,xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);let n=0,lit=0,bright=0;
    for(let x=Math.min(...xs);x<=Math.max(...xs);x++)for(let z=Math.min(...zs);z<=Math.max(...zs);z++){if(!inRing(x,z,ring))continue;n++;
      const v=G.glowAt(field,x,world.height(x,z)+.04,z,up).lamp;if(v>=.001)lit++;if(v>.1)bright++;}
    assert.ok(lit/n>.65,`Plaza de Armas lit share ${lit/n}`);assert.ok(bright/n>.12&&bright/n<.6,`Plaza de Armas bright share ${bright/n}`);
    // an east-end source (gazebo) and a middle one (City Hall arcade) exist
    assert.ok(lamps.some(l=>l.x>20&&inRing(l.x,l.z,ring)),'no lamp at the east end');assert.ok(lamps.some(l=>Math.abs(l.x)<15&&l.z<8&&l.z>-2),'no lamp on the City Hall front');}
  // Raised street beside a lantern (the empty-texel height used to switch it off): the pool is there.
  for(const [x,z] of [[-10.29,-274.59],[-96.45,-193.53]]){const y=world.height(x,z)+.04,v=G.glowAt(field,x,y,z,up).lamp;
    assert.ok(v>.3,`pool beside the lantern at ${x},${z}: ${v}`);assert.ok(Math.abs(G.sampleField(field,x,z).base-world.height(x,z))<1,'height near the lamp');}
  // A low roof above its lantern stays dark; the street under it is lit.
  assert.ok(G.glowAt(field,-221.83,16.26,16.5,up).lamp<.01,'roof above the lantern');
  // Capitol: the open porticos receive their floods (the light map uses the drawn outline, not the old solid block).
  {const ec=world.eastcivic,F=ec.frame;for(const p of ec.porticos){const out=Math.sign(p.va-p.vb),n={x:F.s[0]*out,y:0,z:F.s[1]*out};
    const [x,z]=F.W((p.u0+p.u1)/2,(p.va+p.vb)/2);assert.ok(G.glowAt(field,x,18,z,n).flood>.2,`${p.side} portico flood`);}}
  // El Morro: the land front seen from the lawn gets washes along most of its length.
  {const st=world.fort.runs.find(r=>r.name==='land').stations;let lit=0;
    for(const s of st){const v=G.glowAt(field,s.x,s.ground+(s.top-s.ground)*.4,s.z,{x:s.nx,y:0,z:s.nz}).flood;if(v>.05)lit++;}
    assert.ok(lit/st.length>.4,`El Morro land front lit share ${lit/st.length}`);}
  // San Cristóbal: at least one face seen from Plaza Colón carries a wash at half height.
  {const st=world.forttops.fronts.find(f=>f.fort==='cristobal'&&f.name==='cavalier-west').stations;
    assert.ok(st.some(s=>G.glowAt(field,s.x,(s.ground+s.top)/2,s.z,{x:s.nx,y:0,z:s.nz}).flood>.1),'San Cristóbal west face unlit');}
  // La Perla: both inferred pockets exist and their openings are lit.
  {const lk=lit.map(p=>p.kind);for(const k of ['pocket','pocketCool','pocketAccent','pocketDim'])assert.ok(lk.includes(k),`La Perla pocket ${k}`);
    // the ground in front of each pocket's threshold is lit (the activity is outside, not only in the windows)
    for(const t of lamps.filter(l=>l.kind==='threshold'))assert.ok(G.glowAt(field,t.x,t.ground+.04,t.z,up).lamp>.2,`threshold pool at ${t.x},${t.z}`);}
  // the plaza-kit frontage lanterns throw less light than a street lantern (first frame out of the plaza)
  assert.ok(lamps.filter(l=>l.kind==='lantern'&&l.power<1).length>=30,'plaza-kit frontage lanterns toned down');
});

test('closed openings emit only what they would: shutters through their slats, timber leaves round their edges',()=>{
  for(const [k,v] of Object.entries(PANES)){
    if(/leak|Shutter/.test(k))assert.equal(v.cls,'louvre',k);if(/Door|door|Seam/.test(k))assert.equal(v.cls,'seam',k);}
  assert.equal(glow.windows.geometry.attributes.info.itemSize,4);
});

