/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The page shell: Home Screen install identity, leaving for the main EUC Thrills game by replacing this page in
// history, the page lifecycle for every state, and the small-window layout rules in css/game.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url));
const text=path=>read(path).toString('utf8');
const html=text('index.html'),head=html.split('</head>')[0],css=text('css/game.css');
const MAIN='https://vibezzzcoder.github.io/EUC-thrills/';
const png=raw=>({sig:raw.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),w:raw.readUInt32BE(16),h:raw.readUInt32BE(20),depth:raw[24],colour:raw[25]});

test('web manifest: own app identity, relative to the game folder, any and maskable icons that exist at their sizes',()=>{
  const app=JSON.parse(text('manifest.webmanifest'));
  assert.equal(app.name,'San Juan Spin-off: EUC Thrills');assert.equal(app.short_name,'EUC San Juan');
  for(const key of ['id','start_url','scope'])assert.equal(app[key],'./',key);
  assert.equal(app.display,'standalone');
  const theme=head.match(/<meta name="theme-color" content="([^"]+)">/)[1];
  assert.equal(app.theme_color,theme);assert.equal(app.background_color,theme);
  const byPurpose={};
  for(const icon of app.icons){const p=png(read(icon.src.replace('./','')));
    assert.ok(p.sig,icon.src);assert.equal(icon.type,'image/png');assert.equal(icon.sizes,`${p.w}x${p.h}`,icon.src);
    assert.equal(p.colour,2,'8-bit RGB, no alpha: '+icon.src);assert.equal(p.depth,8);
    (byPurpose[icon.purpose]??=[]).push(p.w);}
  assert.deepEqual(byPurpose,{any:[192,512],maskable:[512]});
  assert.ok(!('orientation' in app),'both orientations stay available');
  assert.match(text('assets/icons/SOURCE.txt'),/tools\/render-icons\.py/);
  for(const svg of ['assets/icons/icon.svg','assets/icons/icon-maskable.svg'])assert.match(text(svg),/<rect width="512" height="512" fill="#254873"\/>/,svg+' is opaque edge to edge');
});

test('page head: a shared link shows the game (Open Graph card with one hosted image; metadata only)',()=>{
  const home='https://vibezzzcoder.github.io/euc-sanjuan/';
  const og=Object.fromEntries([...head.matchAll(/<meta property="og:([a-z:_]+)" content="([^"]*)">/g)].map(m=>[m[1],m[2]]));
  assert.equal(og.title,'San Juan Spin-off: EUC Thrills');assert.equal(og.type,'website');assert.equal(og.url,home);
  assert.equal(og.image,home+'screenshots/social.jpg');assert.equal(og['image:type'],'image/jpeg');
  assert.deepEqual([og['image:width'],og['image:height']],['1200','630']);
  assert.ok(og.description.length>=60&&og.description.length<=200);assert.ok(og['image:alt'].length>10);
  assert.match(head,/<meta name="twitter:card" content="summary_large_image">/);
  // The preview is metadata only: the page itself still loads nothing from another host.
  assert.doesNotMatch(head,/<(?:script|link rel="stylesheet"|img)[^>]+https?:/);
});

test('page head: manifest, 180px Apple icon and capable flag, keeping the theme, viewport, SVG favicon and Apple title',()=>{
  assert.match(head,/<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(head,/<link rel="apple-touch-icon" href="assets\/icons\/icon-180\.png" sizes="180x180">/);
  const apple=png(read('assets/icons/icon-180.png'));assert.deepEqual([apple.w,apple.h,apple.colour],[180,180,2]);
  assert.match(head,/<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(head,/<meta name="apple-mobile-web-app-title" content="EUC San Juan">/);
  assert.match(head,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
  assert.match(head,/<link rel="icon" href="assets\/euc-badge\.svg" type="image\/svg\+xml">/);
  assert.doesNotMatch(head,/status-bar-style/,'no status-bar style');
  // The leave module loads after the import map (an import map must come before any module) and on its own.
  assert.ok(head.indexOf('<script type="module" src="js/sj-leave.js"></script>')>head.indexOf('type="importmap"'));
  const sources=fs.readdirSync(new URL('../js/',import.meta.url)).filter(n=>n.endsWith('.js')).map(n=>text('js/'+n)).join('\n');
  assert.doesNotMatch(sources,/serviceWorker\.register/,'no service worker, no offline promise');
});

test('the three main-menu links replace this page; credits links stay new-tab links',()=>{
  const links=[...html.matchAll(/<a href="([^"]+)"([^>]*)>/g)];
  const leave=links.filter(m=>/\sdata-leave\b/.test(m[2]));
  assert.equal(leave.length,3,'loading/error plaque, title, Pause');
  for(const m of leave){assert.equal(m[1],MAIN);assert.doesNotMatch(m[2],/target=/);}
  for(const m of links.filter(m=>m[1]==='credits.html'))assert.doesNotMatch(m[2],/data-leave/);
  assert.equal(links.filter(m=>m[1]===MAIN).length,3,'no main-menu link without the handler');
});

test('leave decision: an ordinary click replaces the page; modified, middle, handled or other-window clicks do not',async()=>{
  const {leaveDecision}=await import('../js/sj-leave.js');
  const anchor=(attrs={})=>({href:MAIN,getAttribute:n=>attrs[n]??null,hasAttribute:n=>n in attrs});
  const click=(o={})=>({button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false,...o});
  assert.equal(leaveDecision(click(),anchor()),'replace');
  assert.equal(leaveDecision(click(),anchor({target:'_self'})),'replace');
  for(const o of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{button:2},{defaultPrevented:true}])
    assert.equal(leaveDecision(click(o),anchor()),'browser',JSON.stringify(o));
  assert.equal(leaveDecision(click(),anchor({target:'_blank'})),'browser');
  assert.equal(leaveDecision(click(),anchor({download:''})),'browser');
  assert.equal(leaveDecision(click(),null),'browser');
});

test('leave links: replace on a plain click after the hooks ran (even a failing one); the browser keeps the rest',async()=>{
  const {bindLeaveLinks,onLeave}=await import('../js/sj-leave.js');
  let handler=null;const doc={addEventListener:(t,f)=>{if(t==='click')handler=f;},removeEventListener(){}};
  const replaced=[];const view={location:{replace:href=>replaced.push(href)}};
  const unbind=bindLeaveLinks(doc,view);assert.equal(typeof unbind,'function');
  const anchor={href:MAIN,getAttribute:()=>null,hasAttribute:()=>false};
  const icon={nodeType:1,closest:sel=>sel==='a[data-leave]'?anchor:null}; // the arrow icon inside the link
  const calls=[];const off1=onLeave(()=>{calls.push('a');throw new Error('hook failure');}),off2=onLeave(href=>calls.push('b:'+href));
  const errorLog=console.error;console.error=()=>{};
  let prevented=0;const ev=o=>({target:icon,button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,defaultPrevented:false,preventDefault(){prevented++;},...o});
  try{handler(ev());}finally{console.error=errorLog;}
  assert.deepEqual(replaced,[MAIN]);assert.equal(prevented,1);assert.deepEqual(calls,['a','b:'+MAIN]);
  handler(ev({ctrlKey:true}));handler(ev({button:1}));handler(ev({defaultPrevented:true}));
  handler(ev({target:{nodeType:1,closest:()=>null}}));
  assert.deepEqual(replaced,[MAIN],'only the plain click left by replacement');assert.equal(prevented,1);
  off1();off2();
});

test('lifecycle decisions: nothing rides while hidden; each state comes back to its own menu',async()=>{
  const {hiddenState,returnPlan}=await import('../js/sj-shell.js');
  assert.equal(hiddenState('riding'),'paused');assert.equal(hiddenState('map'),'paused');
  for(const s of ['title','paused','error','loading','booking','riders'])assert.equal(hiddenState(s),s);
  assert.deepEqual(returnPlan('paused',{pauseOpen:false,mapOpen:true}),{state:'paused',closeMap:true,openPause:true,focus:'resume'});
  assert.deepEqual(returnPlan('paused',{pauseOpen:true}),{state:'paused',closeMap:false,openPause:false,focus:'resume'});
  for(const s of ['riding','map'])assert.equal(returnPlan(s).state,'paused','a hide that was never seen still ends in Pause');
  assert.equal(returnPlan('title').focus,'ride');assert.equal(returnPlan('error').focus,'retry');
  assert.equal(returnPlan('loading').focus,null);
  for(const s of ['booking','riders','something-new'])assert.deepEqual(returnPlan(s),{state:s,closeMap:false,openPause:false,focus:'menu'},s);
});

// A minimal host and page for createShell: records gates, focus, dialog calls and part notifications.
async function harness(){
  const {createShell}=await import('../js/sj-shell.js');
  const on={},docOn={},focused=[],gates=[],notes=[];let state='title',busy=false,pending=false,cancels=0;
  const el=(id,extra={})=>({id,hidden:false,disabled:false,open:false,focus(){focused.push(id);},closest:()=>null,getClientRects:()=>[1],
    showModal(){this.open=true;},close(){this.open=false;},querySelectorAll:()=>[],contains(x){return this.querySelectorAll().includes(x);},textContent:'',...extra});
  const els={pause:el('pause'),map:el('map'),resume:el('resume'),ride:el('ride'),retry:el('retry'),title:el('title'),'install-help':el('install-help'),'close-map':el('close-map'),'map-status':el('map-status')};
  const pickerButton=el('picker-first'),picker=el('riders',{querySelectorAll:()=>[pickerButton]});
  const bookingButton=el('booking-first'),booking=el('booking',{querySelectorAll:()=>[bookingButton]});
  let pickerOpen=false;
  const MENUS={title:()=>pickerOpen?picker:els.title,paused:()=>els.pause,map:()=>els.map,booking:()=>booking};
  const other={cancelled:0,cancel(){this.cancelled++;},away(){notes.push('away');},returned(p){notes.push('returned:'+p);},interrupted(){notes.push('interrupted');}};
  const parts=[other];let clock=0,resized=0,suspended=0,redraws=0;
  const host={$:id=>els[id],QUIET:{preventScroll:true},MENUS,parts,get state(){return state;},get busy(){return busy;},
    cancelStart:()=>{if(!pending)return false;pending=false;cancels++;return true;},
    gate:next=>{gates.push(next);state=next;},redrawMap:()=>{redraws++;},restartClock:()=>{clock++;},resizeSoon:()=>{resized++;},failure:e=>{throw e;},
    notify:(name,...a)=>{for(const p of parts)p[name]?.(...a);},get context(){return {suspend:()=>{suspended++;return Promise.resolve();}};}};
  const timers=[];const doc={activeElement:null,hidden:false,addEventListener:(t,f)=>{docOn[t]=f;}};
  globalThis.window={addEventListener:(t,f)=>{on[t]=f;},navigator:{},matchMedia:()=>({matches:false}),setTimeout:f=>timers.push(f)};globalThis.document=doc;
  const part=await createShell(host);parts.push(part);
  delete globalThis.window;delete globalThis.document;
  els.map.querySelectorAll=()=>[placeButton];const placeButton=el('place');placeButton.tagName='BUTTON';placeButton.isConnected=true;
  return {flush(){while(timers.length)timers.shift()();},on,docOn,doc,focused,gates,notes,other,els,placeButton,set busy(v){busy=v;},set pending(v){pending=v;},get cancels(){return cancels;},get redraws(){return redraws;},get clock(){return clock;},get resized(){return resized;},get suspended(){return suspended;},
    set state(s){state=s;},get state(){return state;},openPicker(){pickerOpen=true;},pickerButton,bookingButton};
}

test('lifecycle: hide → kept page shown again, from title, riding, map, Pause, error, an open picker and an unknown state',async()=>{
  const h=await harness();
  const cycle=s=>{h.state=s;h.focused.length=0;h.gates.length=0;h.notes.length=0;h.on.pagehide();h.on.pageshow({persisted:true});return [...h.gates];};
  assert.deepEqual(cycle('title'),['title','title']);assert.deepEqual(h.focused,['ride']);assert.deepEqual(h.notes,['interrupted','away','returned:true']);
  assert.deepEqual(cycle('riding'),['paused','paused']);assert.ok(h.els.pause.open);assert.deepEqual(h.focused,['resume']);
  h.els.pause.open=false;h.els.map.open=true;
  assert.deepEqual(cycle('map'),['paused','paused']);assert.ok(!h.els.map.open,'the map closes');assert.ok(h.els.pause.open,'Pause opens');
  assert.deepEqual(cycle('paused'),['paused','paused']);assert.deepEqual(h.focused,['resume']);
  assert.deepEqual(cycle('error'),['error','error']);assert.deepEqual(h.focused,['retry']);
  h.openPicker();cycle('title');assert.deepEqual(h.focused,['picker-first'],'a picker over the title keeps focus');
  assert.deepEqual(cycle('booking'),['booking','booking']);assert.deepEqual(h.focused,['booking-first']);
  assert.ok(h.clock===14&&h.resized===7,'the clock restarts on hide and show; the 3D buffer is re-sized on show');
  // A page that was not kept loads again: pageshow without persisted does nothing. Nothing happens while loading.
  h.gates.length=0;h.on.pageshow({persisted:false});h.state='loading';h.on.pagehide();h.on.pageshow({persisted:true});assert.deepEqual(h.gates,[]);
});

test('leaving: the other parts drop unfinished work and sound stops; nothing is saved',async()=>{
  const h=await harness();const {leave}=await import('../js/sj-leave.js');
  const replaced=[];leave(MAIN,{location:{replace:u=>replaced.push(u)}});
  assert.equal(h.other.cancelled,1);assert.equal(h.suspended,1);assert.deepEqual(replaced,[MAIN]);
});

test('keyboard: M and C still work while a HUD button has focus; typing in a field is left alone',()=>{
  const main=text('js/main.js');
  assert.match(main,/\['INPUT','SELECT','TEXTAREA'\]\.includes\(event\.target\?\.tagName\)\|\|\(\['BUTTON','A'\]\.includes\(event\.target\?\.tagName\)&&!\['KeyM','KeyC'\]\.includes\(event\.code\)\)\)return;/);
  assert.doesNotMatch(main,/addEventListener\('pageshow'/,'the page lifecycle lives in js/sj-shell.js');
});

test('small windows: the layout rules that fixed measured defects stay',()=>{
  // The stick zone stops short of the thumb buttons at every width.
  assert.match(css,/#stick-zone\{[^}]*width:min\(48%,calc\(100% - var\(--thumbs-right\) - var\(--thumbs-width\) - 8px\)\)/);
  assert.match(css,/\.touch-buttons\{position:absolute;right:var\(--thumbs-right\)[^}]*grid-template-columns:70px 92px;gap:12px/);
  assert.match(css,/--thumbs-right:max\(18px,env\(safe-area-inset-right\)\);--thumbs-width:174px/,'70 + 12 + 92');
  assert.match(css,/--thumbs-width:144px\}\.touch-buttons\{grid-template-columns:58px 78px;gap:8px\}/,'58 + 8 + 78');
  // Overlays centre their plaque with auto margins (a taller plaque scrolls from its top), never align-content.
  assert.doesNotMatch(css,/#(title|loading)\{[^}]*align-content/);
  assert.match(css,/\.loader-plaque,\.title-plaque\{margin-block:auto\}/);
  // Title links are 44px targets on phones.
  assert.doesNotMatch(css,/min-height:40px/);
  // Safe-area maxima survive the short-window rules; dialogs centre inside the safe area.
  assert.doesNotMatch(css,/padding:8px var\(--sr\) 8px/);assert.doesNotMatch(css,/\.touch-buttons\{bottom:16px\}/);
  assert.match(css,/dialog:modal\{inset:calc\(12px \+ env\(safe-area-inset-top\)\) calc\(12px \+ env\(safe-area-inset-right\)\) calc\(12px \+ env\(safe-area-inset-bottom\)\) calc\(12px \+ env\(safe-area-inset-left\)\)\}/);
  // Map header: Credits then Close, in the DOM and on screen (D-pad right moves right); the pair may wrap.
  assert.doesNotMatch(css,/row-reverse/);
  const actions=html.match(/<div class="map-actions">([\s\S]*?)<\/div>/)[1];
  assert.ok(actions.indexOf('credits.html')<actions.indexOf('id="close-map"'));
  assert.match(css,/\.map-actions\{display:flex;flex-wrap:wrap/);
  assert.match(html,/id="close-map"[^>]*>[\s\S]*?<span>Close<span class="close-word"> map<\/span><\/span><\/button>/,'one text item: the space stays a space');assert.match(css,/\.close-word\{display:none\}/);
  // The legend fits a short map; the camera panel leaves the stick zone alone in short windows.
  assert.match(css,/#map-canvas\{min-height:72px\}/);
  // The help line for the Home Screen sits under About and hides inside the installed app.
  assert.match(html,/<p id="install-help" class="muted">[^<]*Add to Home Screen[^<]*<\/p>/);
});
test('the open camera panel never sits on the stick zone or the thumb buttons',()=>{
  // Narrow windows: the stick zone starts below the full panel.
  assert.match(css,/@media \(max-aspect-ratio:4\/3\)\{\.camera-tools-open #stick-zone\{height:min\(55%,calc\(100% - var\(--st\) - 248px\)\)\}\}/);
  // Short windows from 400px wide: one 66px row (8 top border + 2 bottom + 12 padding + 44 controls), stick zone below
  // it (56px HUD row and gap + 66 + 4), and this rule comes after the narrow one so it wins where both apply.
  const short=css.indexOf('@media (max-height:372px),(max-height:500px) and (min-width:400px) and (max-width:599px){');assert.ok(short>css.indexOf('@media (max-aspect-ratio:4/3){.camera-tools-open'));
  const block=css.slice(short,css.indexOf('\n}',short));
  assert.match(block,/#camera-tools\{display:flex;[^}]*padding:6px 8px\}/);assert.match(block,/min-height:44px;padding:0;border:0/);
  assert.match(block,/#camera-hint\{display:none\}/);assert.match(block,/\.camera-tools-open #stick-zone\{height:min\(55%,calc\(100% - var\(--st\) - 126px\)\)\}/);
});

test('looking away while a ride is being prepared: the start is dropped, the menu stays, its button gets focus back',async()=>{
  const {interruptPlan}=await import('../js/sj-shell.js');
  assert.equal(interruptPlan('title'),null,'nothing pending: nothing to do');
  assert.deepEqual(interruptPlan('title',{pending:true}),{state:'title',focus:'ride'});
  assert.deepEqual(interruptPlan('paused',{pending:true}),{state:'paused',focus:'resume'});
  assert.deepEqual(interruptPlan('map',{pending:true}),{state:'map',focus:'map'});
  for(const s of ['riding','error','leaving'])assert.equal(interruptPlan(s,{pending:true}),null,s);
  assert.deepEqual(interruptPlan('booking',{pending:true}),{state:'booking',focus:'menu'});
  const h=await harness();
  const look=(state,how)=>{h.state=state;h.gates.length=0;h.focused.length=0;h.notes.length=0;h.pending=true;h.busy=true;
    if(how==='blur')h.on.blur();else{h.doc.hidden=true;h.docOn.visibilitychange();h.doc.hidden=false;}};
  look('title','blur');assert.equal(h.cancels,1);assert.deepEqual(h.gates,['title'],'re-gated: input cleared, sound suspended, completion stale');
  assert.deepEqual(h.notes,['interrupted']);assert.deepEqual(h.focused,[],'not while the start is still unwinding');
  h.busy=false;h.flush();assert.deepEqual(h.focused,['ride'],'focus returns once the start has unwound');
  look('paused','hidden');h.busy=false;h.flush();assert.equal(h.cancels,2);assert.deepEqual(h.gates,['paused']);assert.ok(h.focused.includes('resume'));
  h.doc.activeElement=h.placeButton;look('map','blur');h.busy=false;h.flush();assert.deepEqual(h.gates,['map']);assert.ok(h.focused.includes('place'),'the destination pressed');
  h.doc.activeElement=null;look('map','blur');h.busy=false;h.flush();assert.ok(h.focused.includes('close-map'));
  // Riding (nothing pending): nothing here; the host pauses the ride itself. The picker hears interrupted() either way.
  h.state='riding';h.gates.length=0;h.notes.length=0;h.on.blur();assert.deepEqual(h.gates,[]);assert.deepEqual(h.notes,['interrupted']);
  const main=text('js/main.js');
  assert.match(main,/await Promise\.race\(\[sound\(\),new Promise\(r=>stop\.signal\.addEventListener\('abort',r\)\)\]\);if\(revision!==transition\|\|document\.hidden\|\|stop\.signal\.aborted\)return;/);
  assert.match(main,/cancelStart:\(\)=>\{if\(!pendingStart\)return false;pendingStart\.abort\(\);return true;\}/);
  assert.match(text('js/sj-riders.js'),/interrupted\(\) \{ if \(part\.selection\.preparing\) settleCancel\(/);
});

test('a controller on the loading and error plaque: neutral first, then D-pad/stick steps and one A per press',async()=>{
  const {padReading,padGate,plaqueControls}=await import('../js/sj-leave.js');
  const pad=(pressed=[],axes=[0,0])=>({buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0})),axes});
  assert.deepEqual(padReading(pad()),{neutral:true,step:0,activate:false});
  assert.equal(padReading(pad([13])).step,1);assert.equal(padReading(pad([14])).step,-1);
  assert.equal(padReading(pad([],[0,.9])).step,1);assert.equal(padReading(pad([],[-.9,0])).step,-1);assert.equal(padReading(pad([],[.3,.2])).step,0);
  const g=padGate(),run=list=>list.map(p=>g(padReading(p)));
  assert.deepEqual(run([pad([0]),pad([0]),pad([0])]),[null,null,null],'A held from the page before does nothing');
  assert.deepEqual(run([pad(),pad([0]),pad([0]),pad(),pad([0])]),[null,'activate',null,null,'activate']);
  assert.deepEqual(run([pad([15]),pad([15]),pad(),pad([],[0,-.8])]),[1,null,null,-1]);
  const btn=(o={})=>({disabled:false,closest:()=>null,getClientRects:()=>[1],...o});
  const shown=btn(),off=btn({disabled:true}),hid=btn({closest:()=>({})}),none=btn({getClientRects:()=>[]});
  assert.deepEqual(plaqueControls({querySelectorAll:()=>[off,shown,hid,none]}),[shown]);
  assert.deepEqual(plaqueControls(null),[]);
});

test('short windows: Ride and Choose rider share one title row',()=>{
  const block=css.slice(css.indexOf('@media (max-height:500px) and (min-width:480px){'));
  assert.match(block,/\.title-plaque #ride\{display:inline-flex;width:calc\(100% - 166px\);vertical-align:top;/);
  assert.match(block,/\.title-plaque #choose-rider\{display:inline-flex;width:154px;min-height:48px;margin:0 0 0 4px;vertical-align:top;/);
});

test('leaving drops a pending start at once and holds a leaving state; shown again, it is back at its menu',async()=>{
  const h=await harness();const {leave}=await import('../js/sj-leave.js');const view={location:{replace(){}}};
  for(const from of ['title','paused']){h.state=from;h.pending=true;h.gates.length=0;h.focused.length=0;
    leave(MAIN,view);assert.equal(h.state,'leaving',from);assert.ok(h.gates.includes('leaving'));
    h.busy=false;h.on.pageshow({persisted:true});assert.equal(h.state,from,'back where it was left from');h.flush();
    assert.ok(h.focused.includes(from==='title'?'ride':'resume'),from+': '+h.focused);}
  assert.equal(h.cancels,2,'the pending start was cancelled by the leave itself');
  // From the loading plaque nothing is gated: the boot carries on until the next page replaces this one.
  h.state='loading';h.gates.length=0;leave(MAIN,view);assert.deepEqual(h.gates,[]);
});

test('a kept page shown again keeps the control that had focus (a picker\'s Choose), never moves focus onto a stamp',async()=>{
  const h=await harness();h.openPicker();h.state='title';h.doc.activeElement=h.pickerButton;h.focused.length=0;
  h.on.pagehide();h.on.pageshow({persisted:true});h.flush();assert.deepEqual(h.focused,['picker-first']);
  // Booking: the focused control of its dialog is kept the same way, and a pending start in it is dropped.
  h.state='booking';h.doc.activeElement=h.bookingButton;h.pending=true;h.busy=true;h.focused.length=0;h.gates.length=0;
  h.on.blur();assert.deepEqual(h.gates,['booking']);h.busy=false;h.flush();assert.deepEqual(h.focused,['booking-first']);
});

test('an interrupted map arrival redraws the open map (the rider is already there) and says the ride did not start',async()=>{
  const h=await harness();h.state='map';h.pending=true;h.busy=true;h.on.blur();
  assert.equal(h.redraws,1);assert.match(h.els['map-status'].textContent,/Ride not started/);
  assert.match(text('js/main.js'),/redrawMap:\(\)=>\{if\(state==='map'&&\$\('map'\)\.open\)mapDrawing\(\);\}/);
});

test('small windows: the picker footer fits (short label, full accessible name), the Camera row depends on height',()=>{
  const riders=text('js/sj-riders.js'),rcss=text('css/riders.css');
  assert.match(riders,/name\.className = 'confirm-name'/);assert.match(riders,/ui\.confirm\.setAttribute\('aria-label', label\)/);
  const small=rcss.slice(rcss.indexOf('@media (max-height:500px) and (max-width:619px),(max-width:360px){'));
  assert.ok(small.length>20);assert.match(small,/\.confirm-name\{display:none\}\.riders-actions \.primary::after\{display:none\}/);
  assert.match(small,/\.riders-foot\{flex-direction:column/);
  assert.match(css,/@media \(max-height:372px\),\(max-height:500px\) and \(min-width:400px\) and \(max-width:599px\)\{\n  #camera-tools\{display:flex/);
  assert.match(css,/@media \(max-height:372px\) and \(max-width:399px\)\{#camera-tools \.row\{display:none\}\}/);
});

