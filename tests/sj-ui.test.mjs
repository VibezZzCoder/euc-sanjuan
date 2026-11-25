/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Menu/HUD helpers: the FPS counter's preference and meter, the street plaque lookup, and the page contracts the
// menus keep (FPS checkbox after Riding sound, the name and metadata).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SHOW_FPS_KEY,createShowFpsPreference,createFpsMeter,createStreetIndex,splitStreetName,plaqueName,nearestMark,markPress,tagPlace} from '../js/sj-ui.js';
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

test('phones: Pause has a definite height and no zero-basis flex item, game text is not selectable, fields stay at 16 px',()=>{
  const css=fs.readFileSync(new URL('../css/game.css',import.meta.url),'utf8');
  // Older WebKit (every iOS browser and Home Screen apps before 2026) gives `flex:1` in an auto-height column no height:
  // Pause opened as a dimmed screen with a 4 px line and nothing to tap.
  assert.match(css,/#pause\{height:calc\(100dvh[^}]*\)[^}]*\}/,'Pause is sized like the Map, not by its content');
  for(const sel of ['.dialog-content,.map-content','.sheet-body']){
    const rule=css.match(new RegExp(sel.replace(/[.,]/g,m=>'\\'+m)+'\\{([^}]*)\\}'))?.[1];assert.ok(rule,sel);
    assert.doesNotMatch(rule,/flex:1(;|$)/,sel+' must not use the zero-basis shorthand');assert.match(rule,/flex:1 1 auto/,sel);}
  const root=css.match(/\nhtml,dialog\{([^}]*)\}/)?.[1]??'';
  for(const decl of ['-webkit-user-select:none','user-select:none','-webkit-touch-callout:none','-webkit-tap-highlight-color:transparent','touch-action:manipulation','-webkit-text-size-adjust:100%'])
    assert.ok(root.includes(decl),'html{'+decl+'}');
  assert.match(css,/input\[type=search\][^{]*\{-webkit-user-select:text;user-select:text[^}]*\}/,'the map search can still be edited and selected');
  // iOS zooms the page when a field under 16 px takes focus.
  for(const m of css.matchAll(/(select|input\[type=search\])[^{}]*\{[^}]*font-size:([\d.]+)px/g))assert.ok(+m[2]>=16,m[0].slice(0,80));
  const main=fs.readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
  assert.doesNotMatch(main,/\$\('[a-z-]+'\)\.focus\(\)/,'menu focus never scrolls the page: use focus(QUIET)');
  assert.match(main,/keepPageHome\(\);/);
});
test('the page-home guard snaps a scrolled page back, but not while a field is being edited',async()=>{
  const {keepPageHome}=await import('../js/sj-ui.js');
  const on={},docOn={};let scrolled=0;const doc={activeElement:null,addEventListener:(t,f)=>{docOn[t]=f;}};
  const view={document:doc,scrollX:0,scrollY:0,addEventListener:(t,f)=>{on[t]=f;},setTimeout:f=>f(),scrollTo:()=>{scrolled++;view.scrollX=view.scrollY=0;},visualViewport:{addEventListener(){}}};
  keepPageHome(view);on.scroll();assert.equal(scrolled,0,'nothing to do at the origin');
  view.scrollY=40;on.scroll();assert.equal(scrolled,1);
  view.scrollY=40;doc.activeElement={tagName:'INPUT'};on.resize();assert.equal(scrolled,1,'a focused field is left where iOS put it');
  doc.activeElement={tagName:'BUTTON'};on.focusout();assert.equal(scrolled,2);
  let stopped=0;const ev=t=>({target:t,preventDefault(){stopped++;}});
  docOn.selectstart(ev({nodeType:1,closest:()=>null}));assert.equal(stopped,1,'game text cannot start a selection');
  docOn.selectstart(ev({nodeType:1,closest:()=>({})}));assert.equal(stopped,1,'a text field can');
});
test('a second finger\'s tap on a button is activated on release, once; an only finger is left to the browser',async()=>{
  const {bindHeldFingerTaps}=await import('../js/sj-ui.js');
  const on={};let clock=0,under=null;const doc={addEventListener:(t,f)=>{on[t]=f;},elementFromPoint:()=>under};
  const mk=(inTouch=false)=>{const b={nodeType:1,disabled:false,clicks:0,click(){this.clicks++;},closest(sel){return sel==='button'?b:sel==='#touch-controls'&&inTouch?{}:null;}};return b;};
  const ev=(id,target,x,y,pointerType='touch')=>({pointerId:id,target,clientX:x,clientY:y,pointerType});
  const canvas={nodeType:1,closest:()=>null},pauseButton=mk(),hop=mk(true);
  const taps=bindHeldFingerTaps(doc,{now:()=>clock});
  // an only finger: nothing synthesized
  on.pointerdown(ev(1,pauseButton,350,30));under=pauseButton;on.pointerup(ev(1,pauseButton,351,31));assert.equal(pauseButton.clicks,0);
  // a thumb on the stick, then the other thumb taps Pause
  on.pointerdown(ev(2,canvas,100,600));on.pointerdown(ev(3,pauseButton,350,30));on.pointerup(ev(3,pauseButton,352,31));assert.equal(pauseButton.clicks,1);
  // the browser's own click for that tap, if it comes, is dropped once; a later click is not
  let stopped=0;const click=(x,y,isTrusted=true)=>({isTrusted,clientX:x,clientY:y,preventDefault(){stopped++;},stopImmediatePropagation(){}});
  clock=30;on.click(click(352,31));assert.equal(stopped,1);on.click(click(352,31));assert.equal(stopped,1);
  // the button finger went down first and the stick thumb joined during the press: still a held-finger tap
  on.pointerup(ev(2,canvas,100,600));on.pointerdown(ev(4,pauseButton,350,30));on.pointerdown(ev(5,canvas,90,610));on.pointerup(ev(4,pauseButton,350,30));assert.equal(pauseButton.clicks,2);
  clock=900;on.click(click(350,30));assert.equal(stopped,1,'a click long after is a new, intended one');
  // dragged off, cancelled, a touch-control button, a mouse: nothing
  on.pointerdown(ev(6,pauseButton,350,30));on.pointerup(ev(6,pauseButton,390,30));
  on.pointerdown(ev(7,pauseButton,350,30));on.pointercancel(ev(7,pauseButton,350,30));
  on.pointerdown(ev(8,pauseButton,350,30));under=canvas;on.pointerup(ev(8,pauseButton,351,30));under=pauseButton;
  on.pointerdown(ev(9,hop,300,700));under=hop;on.pointerup(ev(9,hop,300,700));under=pauseButton;
  on.pointerdown(ev(10,pauseButton,350,30,'mouse'));on.pointerup(ev(10,pauseButton,350,30,'mouse'));
  assert.equal(pauseButton.clicks,2);assert.equal(hop.clicks,0);
  // a new contact straight after an activated tap gets its own click (Close under the Map button, a second Camera tap)
  taps.reset();stopped=0;clock=2000;on.pointerdown(ev(20,canvas,100,600));on.pointerdown(ev(21,pauseButton,350,30));on.pointerup(ev(21,pauseButton,350,30));assert.equal(pauseButton.clicks,3);
  on.pointerup(ev(20,canvas,100,600));clock=2096;on.pointerdown(ev(22,pauseButton,352,31));on.pointerup(ev(22,pauseButton,352,31));on.click(click(352,31));assert.equal(stopped,0,'not an echo: a new finger went down');
  // a finger resting on one button is disarmed when another button's tap is taken, and by a long-press menu, and by time
  const resume=mk();taps.reset();clock=3000;on.pointerdown(ev(30,resume,200,100));on.pointerdown(ev(31,pauseButton,350,30));under=pauseButton;on.pointerup(ev(31,pauseButton,350,30));
  under=resume;on.pointerup(ev(30,resume,200,100));assert.equal(pauseButton.clicks,4);assert.equal(resume.clicks,0,'the resting finger does not press Resume when it lifts');
  taps.reset();on.pointerdown(ev(32,canvas,100,600));on.pointerdown(ev(33,resume,200,100));on.contextmenu({});on.pointerup(ev(33,resume,200,100));assert.equal(resume.clicks,0,'a long press is not a tap');
  on.pointerdown(ev(34,resume,200,100));clock+=1500;on.pointerup(ev(34,resume,200,100));assert.equal(resume.clicks,0,'nor is a long hold');
  // a drag that leaves the slop and comes back is not a tap
  on.pointerdown(ev(35,resume,200,100));on.pointermove(ev(35,resume,100,134));on.pointermove(ev(35,resume,200,100));on.pointerup(ev(35,resume,200,100));assert.equal(resume.clicks,0);
  on.pointerdown(ev(36,resume,200,100));on.pointermove(ev(36,resume,203,102));on.pointerup(ev(36,resume,203,102));assert.equal(resume.clicks,1,'a small wobble still is');
  under=pauseButton;
  // after a reset (blur, rotation) a lone tap is single again
  taps.reset();on.pointerdown(ev(11,pauseButton,350,30));on.pointerup(ev(11,pauseButton,350,30));assert.equal(pauseButton.clicks,4);
});

test('map marks: the nearest mark within reach answers; a mouse press travels, a finger names first and travels on the named mark',()=>{
  const marks=[{x:100,y:100},{x:105,y:102},{x:300,y:40}];
  assert.equal(nearestMark(marks,101,100,14),0);assert.equal(nearestMark(marks,104,102,14),1);
  assert.equal(nearestMark(marks,200,200,14),-1,'open sea');assert.equal(nearestMark(marks,114,100,14),1);assert.equal(nearestMark([],0,0,50),-1);
  assert.equal(nearestMark(marks,300,54,14),2,'the edge of the reach counts');assert.equal(nearestMark(marks,300,54.5,14),-1);
  // a mouse: the name was shown on hover, a click on a mark goes
  assert.deepEqual(markPress(marks,300,42,{direct:true}),{index:2,go:true});
  assert.deepEqual(markPress(marks,200,200,{direct:true,picked:2}),{index:-1,go:false});
  // a finger: first press names, a press on the named mark goes
  assert.deepEqual(markPress(marks,296,48,{radius:26}),{index:2,go:false});
  assert.deepEqual(markPress(marks,304,36,{radius:26,picked:2}),{index:2,go:true});
  assert.deepEqual(markPress(marks,304,36,{radius:26,picked:0}),{index:2,go:false},'another mark is named, not travelled to');
  // two marks 5 px apart: a second press that lands nearer the neighbour names the neighbour; it never travels to it unasked
  assert.deepEqual(markPress(marks,100,100,{radius:26}),{index:0,go:false});
  assert.deepEqual(markPress(marks,104,101,{radius:26,picked:0}),{index:1,go:false});
  assert.deepEqual(markPress(marks,99,99,{radius:26,picked:0}),{index:0,go:true});
  assert.deepEqual(markPress(marks,400,400,{radius:26,picked:0}),{index:-1,go:false},'a press on open sea clears');
});

test('map name tag: above its mark, below when there is no room, always inside the chart',()=>{
  assert.deepEqual(tagPlace(200,200,120,40,400,300),{left:140,top:144,below:false});
  assert.deepEqual(tagPlace(200,20,120,40,400,300),{left:140,top:36,below:true});
  assert.equal(tagPlace(10,200,120,40,400,300).left,4);assert.equal(tagPlace(395,200,120,40,400,300).left,276);
  const low=tagPlace(200,290,120,40,400,300);assert.equal(low.below,false);assert.ok(low.top>=4&&low.top+40<=300);
  const tight=tagPlace(50,10,120,60,400,80);assert.ok(tight.top+60<=80-4+1e-9,'a short chart keeps the tag inside');
});

test('map page: the marks have their ring, name tag and pointer, and the controller hint names the stick',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),main=fs.readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
  for(const id of ['map-pick-ring','map-pick-tag','map-pick-name','map-pick-hint','map-cursor'])assert.equal(html.split(`id="${id}"`).length,2,id);
  assert.match(html,/left stick points at the map/);assert.match(main,/bindMapMarks\(\)/);assert.match(main,/mapStick\(input,dt\)/);
});
