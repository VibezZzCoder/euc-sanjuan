/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Verify source notices without writing files. Paths are relative to this checkout, independent of cwd.
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=new URL('../',import.meta.url);
const origin='El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan';
const nyc=' — adapted from mrdoob/slop-newyork (MIT, (c) 2026 Mr.doob)';
const sf=' and unable12/slop-sanfrancisco (MIT)';
const lineage={'index.html':nyc+sf,'js/euc-headlight.js':nyc,'js/touch-controls.js':nyc,'js/gamepad-controls.js':nyc,
  'js/sf-support-store.js':nyc+sf,'js/sf-terrain-sampler.js':nyc+sf};
const data={'js/sj-ground-osm.js':'© OpenStreetMap contributors, ODbL 1.0','js/sj-streets-data.js':'© OpenStreetMap contributors, ODbL 1.0',
  'js/sj-worldedge-data.js':'USGS 3DEP, public domain','js/sj-forttops-bake.js':'fitted heights: USGS 3DEP; mapped coordinates: © OpenStreetMap contributors, ODbL 1.0'};
export function header(file){
  const text=(data[file]?origin.replace(' — MIT —',' — MIT code —')+' — Data: '+data[file]:origin)+(lineage[file]||'');
  return file.endsWith('.py')?'# '+text:file.endsWith('.html')?'<!-- '+text+' -->':'/*! '+text+' */';
}
function check(dir=''){
  let count=0;
  for(const e of readdirSync(new URL(dir||'.',root),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    const p=dir+e.name;
    if(!dir&&e.isDirectory()&&!['js','tests','tools','css'].includes(p))continue;
    if(e.isDirectory()){count+=check(p+'/');continue;}
    if(!/\.(?:js|mjs|css|py|html)$/.test(p)||p==='css/fonts.css')continue;
    if(!e.isFile())throw Error('Expected regular source file: '+p);
    const lines=readFileSync(new URL(p,root),'utf8').split('\n');
    if(p.startsWith('js/euc/')){
      if(!lines[0].startsWith('// Vendored by tools/vendor-euc.mjs from VibezZzCoder/EUC-thrills@') ||
         !lines[1]?.startsWith('// MIT, (c) 2026 VibezZzCoder. See js/euc/LICENSE and NOTICE-EUC-THRILLS.md.'))throw Error('Missing EUC notice: '+p);
    }else{
      const first=lines.find(line=>!/^#!|^<!doctype|^@charset/i.test(line));
      if(first!==header(p))throw Error('Incorrect source notice: '+p);
    }
    count++;
  }
  return count;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3||process.argv[2]!=='--check')throw Error('Usage: node tools/headers.mjs --check');
  console.log(`${check()} source notices checked`);
}
