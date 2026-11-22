/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Menu/HUD helpers: the FPS counter's preference and meter, the street plaque lookup, and the page contracts the
// menus keep (FPS checkbox after Riding sound, the name and metadata).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SHOW_FPS_KEY,createShowFpsPreference,createFpsMeter,createStreetIndex,splitStreetName,plaqueName} from '../js/sj-ui.js';
import {GROUND_AREAS} from '../js/sj-streets-data.js';

test('FPS preference: off by default, saved, tolerant of bad or blocked storage',()=>{
  const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const p=createShowFpsPreference(()=>storage);assert.equal(p.value,false);
  assert.equal(p.set(true),true);assert.equal(store.get(SHOW_FPS_KEY),'on');assert.equal(p.set(true),false);
  assert.equal(createShowFpsPreference(()=>storage).value,true);
  store.set(SHOW_FPS_KEY,'yes please');assert.equal(createShowFpsPreference(()=>storage).value,false);
  const blocked=createShowFpsPreference(()=>{throw new Error('blocked');});assert.equal(blocked.value,false);
  assert.equal(blocked.set(true),true);assert.equal(blocked.value,true);
  assert.match(SHOW_FPS_KEY,/^euc-sanjuan-/);
});

test('FPS meter: counts admitted frames over half a second, writes only on change, restarts after gaps',()=>{
  const writes=[],m=createFpsMeter(t=>writes.push(t));
  m.clear();assert.deepEqual(writes,['--']);
  for(let i=0;i<=120;i++)m.frame(i*1000/60);
  assert.deepEqual(writes,['--','60'],'a steady rate is written once, not every half second');
  m.reset();for(let t=5000;t<=6100;t+=1000/30)m.frame(t);assert.equal(writes.at(-1),'30');
  const before=writes.length;m.frame(9000);m.frame(9010);assert.equal(writes.length,before,'a long gap reseeds instead of publishing');
  m.frame(8000);m.frame(NaN);assert.equal(writes.length,before,'backward and invalid clocks reseed');
});

test('street names split like the corner plaques',()=>{
  assert.deepEqual(splitStreetName('Calle del Cristo'),['Calle','del Cristo']);
  assert.deepEqual(splitStreetName('Plaza Colón'),['Plaza','Colón']);
  assert.deepEqual(splitStreetName('Escalinata de las Monjas'),['Escalinata','de las Monjas']);
  assert.deepEqual(splitStreetName('Paseo del Morro'),['Paseo','del Morro']);
  assert.deepEqual(splitStreetName('La Perla'),['','La Perla']);
});

test('street index: nearest named street within reach, plazas win near their centre, no flicker at corners',async()=>{
  const city=JSON.parse(fs.readFileSync(new URL('../data/city.json',import.meta.url),'utf8'));
  const idx=createStreetIndex(city.roads,city.places);assert.ok(idx.size>1000);
  assert.equal(idx.at(10,82),'Calle de la Fortaleza');
  idx.reset();const armas=city.places.find(p=>p.name==='Plaza de Armas');assert.equal(idx.at(armas.x,armas.z),'Plaza de Armas');
  idx.reset();assert.equal(idx.at(0,-5000),'','nothing named out at sea');
  // A rider standing at a junction keeps the street they came from unless another is clearly nearer.
  idx.reset();const first=idx.at(-118.215+.3,110.287+.3);assert.equal(idx.at(-118.215,110.287),first);
});

test('the page keeps the FPS checkbox after Riding sound, and carries the Spin-off name',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const sound=html.indexOf('id="sound"'),fps=html.indexOf('id="show-fps"'),limit=html.indexOf('id="frame-limit"');
  assert.ok(limit>0&&sound>limit&&fps>sound,'frame limit → sound → FPS counter');
  assert.match(html,/<input id="show-fps" type="checkbox">/);
  assert.match(html,/<title>San Juan Spin-off: EUC Thrills<\/title>/);
  assert.match(html,/<meta name="apple-mobile-web-app-title" content="EUC San Juan">/);
  assert.match(html,/id="fps"[^>]*aria-hidden="true"/,'the FPS chip is not announced');
  assert.doesNotMatch(html,/id="fps"[^>]*role=/);
  const credits=fs.readFileSync(new URL('../credits.html',import.meta.url),'utf8');
  assert.match(credits,/<h1>San Juan Spin-off: EUC Thrills<\/h1>/);assert.match(credits,/OFL-Fraunces\.txt/);
});

test('long names fit the plaque: first official name, Dr., leading given names as initials, surnames and nicknames whole',()=>{
  assert.deepEqual(plaqueName('Paseo Dr. Gilberto Concepción de Gracia'),['Paseo','Dr. G. Concepción de Gracia']);
  assert.deepEqual(plaqueName('Calle Doctor Francisco Rufino de Goenaga'),['Calle','Dr. F. Rufino de Goenaga']);
  assert.deepEqual(plaqueName('Calle Arturo Alfonso Schomburg / Calle Presidio'),['Calle','Arturo Alfonso Schomburg']);
  assert.deepEqual(plaqueName('Calle Luis Armando Lozada Cruz "Vico C"'),['Calle','L. A. Lozada Cruz "Vico C"']);
  assert.deepEqual(plaqueName('Calle Maestro Osiris Delgado Mercado'),['Calle','Maestro O. Delgado Mercado']);
  assert.deepEqual(plaqueName('Calle del Cristo'),['Calle','del Cristo']);
  assert.deepEqual(plaqueName('Calle Reverendo Gerardo Dávila'),['Calle','Reverendo Gerardo Dávila'],'fits: untouched');
  // the tighter step used on narrow screens
  assert.deepEqual(plaqueName('Calle Reverendo Gerardo Dávila',18,true),['Calle','Rvdo. Gerardo Dávila']);
  assert.deepEqual(plaqueName('Avenida Manuel Fernández Juncos',18,true),['Avenida','M. Fernández Juncos']);
  assert.deepEqual(plaqueName('Plaza en Honor a la Mujer Puertorriqueña',18,true),['Plaza','Mujer Puertorriqueña']);
});

test('squares: inside a mapped footprint the square wins, map spelling is used, a chosen arrival holds its square',()=>{
  const city=JSON.parse(fs.readFileSync(new URL('../data/city.json',import.meta.url),'utf8'));
  const places=[{name:'Plaza de San José',x:-164,z:-181.88},{name:'Plaza San Juan Bautista',x:1160,z:-219.2}];
  const idx=createStreetIndex(city.roads,places,GROUND_AREAS);
  assert.ok(idx.squares.includes('Plaza de San José'),'OSM "Plaza San José" takes the map spelling');
  assert.deepEqual(idx.markers,['Plaza San Juan Bautista'],'a square without a footprint uses its marker');
  const ring=GROUND_AREAS.find(a=>a.name==='Plaza de la Barandilla').ring;let cx=0,cz=0;for(const [x,z] of ring){cx+=x;cz+=z;}cx/=ring.length;cz/=ring.length;
  idx.reset();assert.equal(idx.at(cx,cz),'Plaza de la Barandilla');
  idx.reset();assert.equal(idx.at(10,82),'Calle de la Fortaleza','streets away from squares are unchanged');
  idx.reset();assert.equal(idx.hold('Plaza de la Barandilla',cx+15,cz),true);assert.equal(idx.at(cx+15,cz),'Plaza de la Barandilla');
  assert.notEqual(idx.at(cx+300,cz),'Plaza de la Barandilla','the hold ends once the rider leaves');
  idx.reset();assert.equal(idx.hold('Plaza de la Barandilla',10,82),false,'no hold far from the square');
});

test('a venue with its own footprint names its ground on the plaque, and the street returns outside it',()=>{
  const roads=[{name:'Calle de Prueba',width:6,points:[[0,-40],[0,40]]}];
  const ring=[[10,-10],[30,-10],[30,10],[10,10]];
  const idx=createStreetIndex(roads,[{name:'Skatepark del Muelle',x:20,z:0,ring}],[]);
  assert.equal(idx.at(20,0),'Skatepark del Muelle');
  assert.equal(idx.at(0,0),'Calle de Prueba');
  assert.equal(idx.at(20,0),'Skatepark del Muelle');
  assert.equal(idx.at(60,60),'');
  assert.deepEqual(splitStreetName('Skatepark del Muelle'),['Skatepark','del Muelle']);
});
