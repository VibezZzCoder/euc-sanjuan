/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Release construction records once both the sampler and drawn world own their finished representations.
// Map arrivals, private-ground predicates and recovery points are still needed while riding. Set ?handoff=0
// to retain the original area records for inspection.
export const HANDOFF=true;

// Contract fields every area may carry; consumed by loadCity (sampler, collider overrides) and buildWorld/buildPlaza.
export const CONSTRUCTION_FIELDS=['tops','cuts','tint','tintBlend','surfaces','floorTriangles','groundTriangles','colliders',
  'buildingOverrides','buildingColours','shoreSkip','brick','ownedBuildings','trees'];
// Area-specific heavy records (heap snapshot ranking). Owner indexes and the closures over them
// (streets ownerAt/insideMass/cellBlocked) are only read by later layouts and builders during construction.
export const AREA_FIELDS={
  streets:['ownerAt','insideMass','cellBlocked','paved','ownedGround','blocked','covered','droppedTrees','parks','palms','broadleaf',
    'benches','bollards','lanterns'],
  coast:['outline','foam','faces','copings','strips','seaGrid'],
  wallFoot:['strips','skipped'],
  fabric:['fabric','plansById'],
  bahia:['stations','rails'],
  worldedge:['nearTriangles'],
  perlaWest:['cemetery'],
  forttops:['outworks'], // San Cristóbal outworks records (walls, diablo), read only by buildForttops
};
// Keep these runtime bindings when releasing area geometry and temporary spatial indexes.
export const RUNTIME_FIELDS=['places','mapLines','offLimitsAt','sea','closesEastExits','recoveryPoints'];
// Freeze these district summaries before releasing their much larger captured construction state.
export const QA_AREAS=['princesa','cristobal','norzagaray','perlaWest','perlaDistrict','puntilla'];

// Fields released for an area object (all but the runtime fields; qa is replaced by its snapshot, not kept as a closure).
export function dropListFor(key,area=null){
  if(!area)return [...CONSTRUCTION_FIELDS,...(AREA_FIELDS[key]??[]),'qa'];
  return Object.keys(area).filter(f=>!RUNTIME_FIELDS.includes(f));
}
const factsOf=facts=>()=>structuredClone(facts);   // module scope: captures only the facts

// Releases construction-only fields of every registered area in `world` (keys of `areaKeys`). Returns what was dropped.
export function releaseConstruction(world,areaKeys){
  const dropped={};
  for(const key of areaKeys){const a=world[key];if(!a||typeof a!=='object')continue;
    let facts=null;if(QA_AREAS.includes(key)&&typeof a.qa==='function')facts=structuredClone(a.qa());
    const list=dropListFor(key,a).filter(f=>!(facts&&f==='qa'));   // retain computed summaries without their original closures
    for(const f of list)delete a[f];
    if(facts)a.qa=factsOf(facts);
    if(list.length)dropped[key]=list;}
  return dropped;
}

// Dev/test audit: rough per-field size of what remains on each area (arrays/typed arrays/Maps/Sets, counted recursively
// to a bounded depth; shared world data such as the terrain grid is not counted). Reports fields above `limit` bytes.
// Closure captures are invisible to it. Not used by the game.
export function auditRemaining(world,areaKeys,limit=1<<20){
  const out=[],shared=[world.terrain,world.terrain?.heights,world.land,world.surface,world.city,world.detail].filter(Boolean);
  for(const key of areaKeys){const a=world[key];if(!a)continue;
    for(const [field,value] of Object.entries(a)){const seen=new Set(shared),bytes=sizeOf(value,seen,0);if(bytes>limit)out.push({area:key,field,bytes});}}
  return out;
}
function sizeOf(v,seen,depth){
  if(v===null||typeof v!=='object')return typeof v==='string'?v.length*2:8;
  if(seen.has(v)||depth>6)return 0;seen.add(v);
  if(ArrayBuffer.isView(v))return v.byteLength;
  let n=32;
  if(v instanceof Map){for(const [k,x] of v)n+=sizeOf(k,seen,depth+1)+sizeOf(x,seen,depth+1);return n;}
  if(v instanceof Set){for(const x of v)n+=sizeOf(x,seen,depth+1);return n;}
  for(const k in v)n+=8+sizeOf(v[k],seen,depth+1);
  return n;
}

// The pinned donor support store (js/sf-support-store.js, byte-identical import) keeps one sparse `extras` entry per
// support record that carries a non-packed field; every authored San Juan top carries a `source` label, so that is ~24k
// pairs of small objects. Entries without geometry annotations whose fields are all primitives are replaced by one shared
// entry per distinct field set. The store's readers only copy from entries (spread / property reads), so every record view
// is unchanged. Called by loadCity right after the sampler is built (Node and browser alike).
// A frozen plain object of primitives (the skatepark's shared capability records) is the same value wherever it is
// referenced: keyed by identity, so entries that reference the same one can share.
export function shareSupportExtras(store){
  const extras=store?.extras;if(!(extras instanceof Map))return 0;
  const shared=new Map(),primitive=x=>x===null||(typeof x!=='object'&&typeof x!=='function'),ids=new Map();
  const frozen=x=>x!==null&&typeof x==='object'&&Object.isFrozen(x)&&Object.getPrototypeOf(x)===Object.prototype&&!Object.getOwnPropertySymbols(x).length&&Object.values(x).every(primitive);
  const id=x=>{let k=ids.get(x);if(k===undefined)ids.set(x,k=ids.size);return k;};let n=0;
  for(const [id_,e] of extras){const g=e?.geometry,f=e?.fields;
    if(!f||!g||g.plane||g.poly||g.outer||g.holes||Object.getOwnPropertySymbols(f).length)continue;
    const entries=Object.entries(f);if(entries.length!==Reflect.ownKeys(f).length||!entries.every(([,x])=>primitive(x)||frozen(x)))continue;
    const key=JSON.stringify(entries.map(([k,x])=>frozen(x)?[k,'frozen',id(x)]:[k,typeof x,Object.is(x,-0)?'-0':String(x)]));
    const first=shared.get(key);if(!first)shared.set(key,e);else{extras.set(id_,first);n++;}}
  return n;
}
