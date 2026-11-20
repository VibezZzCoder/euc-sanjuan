/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Streets layout cache (startup) — © 2026 VibezZzCoder, MIT.
// A pure cache of createStreetsLayout's output ("" and "Browser acceptance"):
// data/streets-cache.bin, written by tools/build-streets-cache.mjs. Its key is a pure content key: the raw bytes of every
// module the world build runs before the streets layout (sj-world.js and its relative imports) and of the data files the
// world loads (STREETS_CONTENT_KEY in js/sj-streets-cache-key.js, generated), combined with the source text of the layout
// functions themselves. Nothing derived from the world is hashed: other areas' outputs go through Math.sin/cos, whose last
// bits differ between engines (Node and Chromium), so a world digest never matched in the browser. Any code or data change
// invalidates the cache (the runtime path runs, identical output); the streets test and tools/smoke.py fail until it is
// regenerated.
// File: 'SJS1' u32 version, u32 digest a, u32 digest b, u32 payload bytes, then the payload deflated (raw).

export const CACHE_VERSION=2;
// Data files the world build reads (js/sj-world.js and its modules); the tool fails if data/ gains an unlisted file.
export const CACHE_DATA=['city.json','ground.bin','land.u8','plaza-detail.json','stairs.json','surface.u8','terrain.i16'];
export const CACHE_IGNORED=['streets-cache.bin','boundary.geojson','boundary-review.svg'];   // not read by the game

// ---- 64-bit (2 × 32) mixing hash over numbers, strings and bytes. ----
const SH=new Map();   // short-string hash cache (object keys, kinds): one mix per occurrence
export function hasher(){let a=0x811c9dc5|0,b=0x9e3779b9|0;const f=new Float64Array(1),u=new Uint32Array(f.buffer);
  const mix=v=>{a=Math.imul(a^v,0x01000193);b=Math.imul(b^(v>>>7|v<<25),0x85ebca6b)^a;};
  const strHash=s=>{let x=s.length|0;for(let i=0;i<s.length;i++)x=Math.imul(x^s.charCodeAt(i),0x01000193);return x;};
  const h={num(x){f[0]=x;mix(u[0]);mix(u[1]);return h;},
    str(s){s=String(s);if(s.length<=32){let v=SH.get(s);if(v===undefined){v=strHash(s);SH.set(s,v);}mix(v);return h;}mix(strHash(s));return h;},
    bytes(view){const n=view.byteLength>>2,w=new Uint32Array(view.buffer,view.byteOffset,n);mix(view.byteLength);for(let i=0;i<n;i++)mix(w[i]);
      const r=new Uint8Array(view.buffer,view.byteOffset+n*4,view.byteLength-n*4);for(let i=0;i<r.length;i++)mix(r[i]);return h;},
    any(v,depth=0){if(depth>12)return h.str('#deep');
      if(v===null||v===undefined)return h.str(String(v));const t=typeof v;
      if(t==='number')return h.num(v);if(t==='string')return h.str('s'+v);if(t==='boolean')return h.str(v?'T':'F');if(t==='function')return h.str('f'+v.toString());
      if(ArrayBuffer.isView(v))return h.str('ta'+v.constructor.name).bytes(v);
      if(Array.isArray(v)){const n=v.length;h.str('[').num(n);
        // Fast paths: numbers, and [x, z] / [x, y, z] number tuples.
        if(n&&typeof v[0]==='number'&&typeof v[n-1]==='number'){let all=true;for(let i=0;i<n;i++)if(typeof v[i]!=='number'){all=false;break;}if(all){for(let i=0;i<n;i++)h.num(v[i]);return h;}}
        for(const x of v)h.any(x,depth+1);return h;}
      if(v instanceof Map){h.str('M').num(v.size);for(const [k,x] of v){h.any(k,depth+1);h.any(x,depth+1);}return h;}
      if(v instanceof Set){h.str('S').num(v.size);for(const x of v)h.any(x,depth+1);return h;}
      if(t==='object'){h.str('{');for(const k in v){if(!Object.prototype.hasOwnProperty.call(v,k))continue;h.str(k);const x=v[k];
          if(typeof x==='number')h.num(x);else h.any(x,depth+1);}h.str('}');return h;}
      return h.str('?');},
    digest(){return [a>>>0,b>>>0];}};
  return h;}

// ---- Payload: a little-endian byte writer/reader. ----
function writer(){let buf=new ArrayBuffer(1<<20),dv=new DataView(buf),n=0;
  const room=k=>{if(n+k>buf.byteLength){const b=new ArrayBuffer(Math.max(buf.byteLength*2,n+k));new Uint8Array(b).set(new Uint8Array(buf,0,n));buf=b;dv=new DataView(buf);}};
  return {u32(v){room(4);dv.setUint32(n,v>>>0,true);n+=4;},i32(v){room(4);dv.setInt32(n,v|0,true);n+=4;},f64(v){room(8);dv.setFloat64(n,v,true);n+=8;},
    u8(v){room(1);dv.setUint8(n,v);n+=1;},str(s){const b=new TextEncoder().encode(s);this.u32(b.length);room(b.length);new Uint8Array(buf,n,b.length).set(b);n+=b.length;},
    bytes(){return new Uint8Array(buf,0,n);}};}
function reader(u8){const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);let n=0;
  return {u32(){const v=dv.getUint32(n,true);n+=4;return v;},i32(){const v=dv.getInt32(n,true);n+=4;return v;},f64(){const v=dv.getFloat64(n,true);n+=8;return v;},
    u8(){return dv.getUint8(n++);},str(){const l=this.u32(),s=new TextDecoder().decode(u8.subarray(n,n+l));n+=l;return s;}};}

const KINDS=['sett','asphalt','slab','concrete','brick','parking','cycle','steps','square','apron'],MODES=['free','relaxed','strict'];
// Encode a runtime layout (+ cells the layout re-classed, the covered mask and the draw-private cells) to the payload.
export function encodeLayout(L,{remapped,covered,privateCells}){const w=writer();
  // Paved pieces: a vertex table (exact doubles), a frame table, then one record per piece.
  const vid=new Map(),V=[],fid=new Map(),F=[];
  const vkey=p=>{const k=(Object.is(p[0],-0)?'-0':p[0])+','+(Object.is(p[1],-0)?'-0':p[1]);let i=vid.get(k);if(i===undefined){i=V.length;vid.set(k,i);V.push(p);}return i;};
  const fkey=f=>{let i=fid.get(f);if(i===undefined){i=F.length;fid.set(f,i);F.push(f);}return i;};
  const recs=L.paved.map(p=>({p,ring:p.ring.map(vkey),frame:p.frame?fkey(p.frame):-1}));
  w.u32(V.length);for(const p of V){w.f64(p[0]);w.f64(p[1]);}
  w.u32(F.length);for(const f of F){w.f64(f.o[0]);w.f64(f.o[1]);w.f64(f.u[0]);w.f64(f.u[1]);w.f64(f.n[0]);w.f64(f.n[1]);w.f64(f.along);}
  w.u32(recs.length);
  for(const {p,ring,frame} of recs){const kind=KINDS.indexOf(p.kind);if(kind<0)throw new Error('cache: kind '+p.kind);
    w.u8(kind);w.u8((p.margin?1:0)|(MODES.indexOf(p.mode)+1)<<1);w.f64(p.hw);w.i32(frame);
    w.u8(p.road===undefined?0:1);if(p.road!==undefined)w.f64(p.road);
    w.u8(p.area===undefined?0:typeof p.area==='number'?1:2);if(typeof p.area==='number')w.f64(p.area);else if(p.area!==undefined)w.str(p.area);
    w.u32(ring.length);for(const i of ring)w.u32(i);}
  // Everything else (small): exact JSON (shortest round-trip doubles).
  const rest={ownedGround:L.ownedGround,trees:L.trees,palms:L.palms,broadleaf:L.broadleaf,benches:L.benches,bollards:L.bollards,lanterns:L.lanterns,
    parks:L.parks,colliders:L.colliders,droppedTrees:L.droppedTrees,qa:(({ms,prof,...q})=>q)(L.qa())};   // timings are not cached
  w.str(JSON.stringify(rest));
  w.u32(remapped.length);for(const k of remapped)w.u32(k);
  const runs=(mask)=>{const out=[];let i=0;while(i<mask.length){let j=i;while(j<mask.length&&!mask[j])j++;let e=j;while(e<mask.length&&mask[e])e++;if(j<mask.length)out.push(j,e-j);i=e;}return out;};
  const cr=runs(covered);w.u32(cr.length);for(const v of cr)w.u32(v);
  // Private cells and re-classed cells as runs of consecutive cell indices.
  const listRuns=list=>{const out=[];for(let i=0;i<list.length;){let e=i;while(e+1<list.length&&list[e+1]===list[e]+1)e++;out.push(list[i],e-i+1);i=e+1;}return out;};
  const pr=listRuns(privateCells);w.u32(pr.length);for(const v of pr)w.u32(v);
  return w.bytes();}

export function decodeLayout(u8,cells){const r=reader(u8);globalThis.__sjStreetsDigestParts?.push(['decoded']);
  const nV=r.u32(),V=new Array(nV);for(let i=0;i<nV;i++)V[i]=[r.f64(),r.f64()];
  const nF=r.u32(),F=new Array(nF);for(let i=0;i<nF;i++){const o=[r.f64(),r.f64()],u=[r.f64(),r.f64()],n=[r.f64(),r.f64()];F[i]={o,u,n,along:r.f64()};}
  const nP=r.u32(),paved=new Array(nP);
  for(let i=0;i<nP;i++){const kind=KINDS[r.u8()],fl=r.u8(),hw=r.f64(),fi=r.i32(),hasRoad=r.u8(),road=hasRoad?r.f64():undefined,at=r.u8();
    const area=at===1?r.f64():at===2?r.str():undefined,n=r.u32(),ring=new Array(n);for(let q=0;q<n;q++)ring[q]=V[r.u32()];
    const p={ring,kind,hw,frame:fi<0?null:F[fi],road,area,margin:!!(fl&1)};const m=fl>>1;if(m)p.mode=MODES[m-1];paved[i]=p;}
  const rest=JSON.parse(r.str());
  const nR=r.u32(),remapped=new Uint32Array(nR);for(let i=0;i<nR;i++)remapped[i]=r.u32();
  const covered=new Uint8Array(cells),nC=r.u32();for(let i=0;i<nC;i+=2){const s=r.u32(),l=r.u32();covered.fill(1,s,s+l);}
  const nPc=r.u32(),privateCells=new Uint8Array(cells);for(let i=0;i<nPc;i+=2){const s=r.u32(),l=r.u32();privateCells.fill(1,s,s+l);}
  return {paved,...rest,remapped,covered,privateCells};}

// ---- Loading (module top level of sj-streets-layout.js): the file, or null. No source fetches in the game: the code
// key is STREETS_CONTENT_KEY (js/sj-streets-cache-key.js, written by the tool; a test fails when it no longer matches the
// files) mixed with the source text of the layout functions themselves (runtimeCode). ----
export async function loadCache(base){
  try{if(typeof fetch!=='function'||typeof DecompressionStream!=='function')return null;
    if(globalThis.process?.env?.SJ_STREETS_CACHE==='0'||/[?&]streetscache=0\b/.test(globalThis.location?.search??''))return null;
    const res=await fetch(new URL('../data/streets-cache.bin',base));if(!res.ok)return null;
    const file=new Uint8Array(await res.arrayBuffer());const dv=new DataView(file.buffer,file.byteOffset,file.byteLength);
    if(String.fromCharCode(...file.subarray(0,4))!=='SJS1'||dv.getUint32(4,true)!==CACHE_VERSION)return null;
    return {digest:[dv.getUint32(8,true),dv.getUint32(12,true)],size:dv.getUint32(16,true),deflated:file.subarray(20)};}catch{return null;}}
export function runtimeCode(key,fns){const h=hasher();h.num(key[0]).num(key[1]);for(const f of fns)h.str('f'+f.toString());return h.digest();}
// The content key (tool and tests; reads files through fetch): sj-world.js and every module it reaches by relative static or
// dynamic import (except the generated key file), in a stable order, then CACHE_DATA. Returns {key, modules}.
export async function contentKey(jsBase){
  const bytes=async u=>{const r=await fetch(new URL(u));if(!r.ok)throw new Error('missing '+u);return new Uint8Array(await r.arrayBuffer());};
  const seen=new Map(),queue=[new URL('./sj-world.js',jsBase).href],dec=new TextDecoder();
  while(queue.length){const u=queue.shift();if(seen.has(u))continue;const b=await bytes(u);seen.set(u,b);
    for(const m of dec.decode(b).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)['"](\.\.?\/[^'"]+\.js)['"]/gm)){
      const v=new URL(m[1],u).href;if(!v.endsWith('/sj-streets-cache-key.js')&&!seen.has(v))queue.push(v);}}
  const root=new URL('../',jsBase).href,h=hasher();h.num(CACHE_VERSION);
  const modules=[...seen.keys()].map(u=>[u.startsWith(root)?u.slice(root.length):u,u]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  for(const [name,u] of modules)h.str('js:'+name).bytes(seen.get(u));
  for(const name of CACHE_DATA)h.str('data:'+name).bytes(await bytes(new URL('../data/'+name,jsBase)));
  return {key:h.digest(),modules:modules.map(m=>m[0])};}
// Inflate (sync callers get a promise resolved at module load; see sj-streets-layout.js).
export async function inflate(u8){const ds=new DecompressionStream('deflate-raw');return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());}
