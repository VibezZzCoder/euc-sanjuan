/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Bake the static natural-ground classification of area `ground` into data/ground.bin (format: js/sj-ground.js).
// Offline and deterministic: it reads only the committed city data and runs js/sj-ground-classes.js, the same code the
// tests run live. Re-run after changing the DEM/land/surface/city data, js/sj-ground-osm.js, js/sj-ground-classes.js or
// js/sj-ground-layout.js: tests/ground.test.mjs fails on a stale bake.
// Usage (from the fork root): node tools/build-ground-bake.mjs [--check]
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
const ROOT=new URL('../',import.meta.url);
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('vendor/three/build/three.webgpu.js',ROOT).href,shortCircuit:true}:next(s,c);}});
globalThis.fetch=async url=>{const b=readFileSync(url);return {ok:true,json:async()=>JSON.parse(b),arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};

export const BAKE_INPUTS=['data/terrain.i16','data/land.u8','data/surface.u8','data/city.json','js/sj-ground-osm.js','js/sj-ground-classes.js','js/sj-ground-layout.js'];
export function inputHash(root=ROOT){const h=createHash('sha256');for(const f of BAKE_INPUTS){h.update(f);h.update(readFileSync(new URL(f,root)));}return h.digest();}

// Deterministic 255-colour quantiser: median cut on the sRGB bytes, then Lloyd refinement (k-means) passes.
function quantise(rgb,count,K=255){
  const idx=new Uint32Array(count);for(let i=0;i<count;i++)idx[i]=i;
  let boxes=[{a:0,b:count}];
  const range=(a,b)=>{const lo=[255,255,255],hi=[0,0,0];for(let i=a;i<b;i++)for(let c=0;c<3;c++){const v=rgb[idx[i]*3+c];if(v<lo[c])lo[c]=v;if(v>hi[c])hi[c]=v;}
    const r=hi.map((h,c)=>h-lo[c]);const ch=r.indexOf(Math.max(...r));return {ch,r:r[ch]};};
  while(boxes.length<K){let best=-1,score=-1;for(let n=0;n<boxes.length;n++){const b=boxes[n];if(b.b-b.a<2)continue;b.rg??=range(b.a,b.b);const s=b.rg.r*Math.sqrt(b.b-b.a);if(s>score){score=s;best=n;}}
    if(best<0)break;const b=boxes[best],ch=b.rg.ch,part=Array.from(idx.subarray(b.a,b.b)).sort((p,q)=>rgb[p*3+ch]-rgb[q*3+ch]||p-q);idx.set(part,b.a);
    const m=(b.a+b.b)>>1;boxes.splice(best,1,{a:b.a,b:m},{a:m,b:b.b});}
  let pal=boxes.map(b=>{const s=[0,0,0];for(let i=b.a;i<b.b;i++)for(let c=0;c<3;c++)s[c]+=rgb[idx[i]*3+c];return s.map(v=>v/(b.b-b.a));});
  const assign=new Uint8Array(count);
  for(let pass=0;pass<6;pass++){const sum=pal.map(()=>[0,0,0,0]);
    for(let i=0;i<count;i++){let bd=Infinity,bi=0;const r=rgb[i*3],g=rgb[i*3+1],b=rgb[i*3+2];
      for(let p=0;p<pal.length;p++){const q=pal[p],d=(r-q[0])**2+(g-q[1])**2+(b-q[2])**2;if(d<bd){bd=d;bi=p;}}
      assign[i]=bi;const s=sum[bi];s[0]+=r;s[1]+=g;s[2]+=b;s[3]++;}
    pal=pal.map((q,p)=>sum[p][3]?[sum[p][0]/sum[p][3],sum[p][1]/sum[p][3],sum[p][2]/sum[p][3]]:q);}
  const out=pal.map(q=>q.map(v=>Math.round(v)));
  // Final assignment against the rounded palette.
  for(let i=0;i<count;i++){let bd=Infinity,bi=0;for(let p=0;p<out.length;p++){const q=out[p],d=(rgb[i*3]-q[0])**2+(rgb[i*3+1]-q[1])**2+(rgb[i*3+2]-q[2])**2;if(d<bd){bd=d;bi=p;}}assign[i]=bi;}
  return {palette:out,assign};}

const varint=(out,v)=>{do{let b=v%128;v=Math.floor(v/128);if(v)b|=128;out.push(b);}while(v);};

export async function bakeGround(){
  const {loadCity}=await import(new URL('js/sj-world.js',ROOT).href);
  const G=await import(new URL('js/sj-ground-classes.js',ROOT).href);
  const {BAKE_VERSION}=await import(new URL('js/sj-ground.js',ROOT).href);
  const world=await G.bakeWorld(await loadCity()),t=world.terrain,n=t.nx*t.nz,F=G.groundFields(world),w={};
  const THREE=await import('three/webgpu');const col=new THREE.Color(),srgb={};
  const verts=[],rgb=[];
  for(let k=0;k<n;k++){if(!G.naturalColour(world,F,k,G.gateBank(world,k),col,w))continue;col.getRGB(srgb,THREE.SRGBColorSpace);
    verts.push(k);rgb.push(...[srgb.r,srgb.g,srgb.b].map(v=>Math.max(0,Math.min(255,Math.round(v*255)))));}
  const {palette,assign}=quantise(Uint8Array.from(rgb),verts.length);
  const rle=[];let k=0;for(let q=0;q<verts.length;){const start=verts[q];varint(rle,start-k);let e=q;while(e+1<verts.length&&verts[e+1]===verts[e]+1)e++;varint(rle,e-q+1);k=verts[e]+1;q=e+1;}
  const {cells,CW}=G.scatterCandidates(world,F),cs=[];let prev=0;for(const [id,code] of cells){varint(cs,id-prev);cs.push(code);prev=id;}
  const head=Buffer.alloc(72);head.write('SJG1',0,'latin1');
  [BAKE_VERSION,t.nx,t.nz,palette.length,rle.length,verts.length,cells.length,cs.length,CW].forEach((v,i)=>head.writeUInt32LE(v,4+i*4));
  inputHash().copy(head,40);
  const bin=Buffer.concat([head,Buffer.from(palette.flat()),Buffer.from(rle),Buffer.from(assign),Buffer.from(cs)]);
  let err=0,max=0;for(let i=0;i<verts.length;i++)for(let ch=0;ch<3;ch++){const e=Math.abs(rgb[i*3+ch]-palette[assign[i]][ch]);err+=e;if(e>max)max=e;}
  return {bin,stats:{natural:verts.length,palette:palette.length,rleBytes:rle.length,cells:cells.length,cellBytes:cs.length,bytes:bin.length,meanErr:err/verts.length/3,maxErr:max}};}

if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop())){
  const {bin,stats}=await bakeGround(),target=new URL('data/ground.bin',ROOT);
  if(process.argv.includes('--check')){const cur=readFileSync(target);console.log(JSON.stringify(stats));if(!cur.equals(bin)){console.error('data/ground.bin is stale');process.exit(1);}console.log('data/ground.bin up to date');}
  else{writeFileSync(target,bin);console.log(JSON.stringify(stats));}
}
