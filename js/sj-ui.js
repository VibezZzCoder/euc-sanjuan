/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Menu and HUD helpers: the optional FPS counter and its saved preference, the street plaque (nearest named street or
// plaza) and the device-aware controls help. Nothing here touches the renderer; the FPS meter and the street lookup do
// no work unless asked, and write text only when it changes.

export const SHOW_FPS_KEY='euc-sanjuan-show-fps';

/** The page never scrolls. iOS can still shift it (a closing keyboard, an installed copy coming back to the front), and
 *  taps then land beside what is drawn; put it back, except while a field is being edited (iOS scrolls to keep that
 *  above the keyboard). The New York and San Francisco editions carry the same guard. */
export function keepPageHome(view=globalThis.window){
  const doc=view?.document;if(!doc||!view.addEventListener)return ()=>{};
  const editing=()=>{const el=doc.activeElement;return !!el&&(el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));};
  const snap=()=>{if(!editing()&&(view.scrollX!==0||view.scrollY!==0))view.scrollTo(0,0);};
  for(const type of ['load','pageshow','resize','orientationchange','scroll'])view.addEventListener(type,snap,{passive:true});
  view.addEventListener('focusout',()=>view.setTimeout(snap,0));
  view.visualViewport?.addEventListener('resize',snap);view.visualViewport?.addEventListener('scroll',snap);
  // Nothing outside a text field can start a selection (a long press or a double tap on game text).
  doc.addEventListener('selectstart',event=>{const t=event.target?.nodeType===1?event.target:event.target?.parentElement;
    if(!t?.closest?.('input,textarea,[contenteditable]'))event.preventDefault();});
  return snap;
}

/** A tap by a second finger while another is held (a thumb on the stick) gets no `click` from the browser, so Pause,
 *  Map and Camera did nothing while steering. Such a tap on a button outside the touch controls is activated on
 *  release, once. It must be a tap: short, never further than `slop` from where it landed, still on its button, with no
 *  long-press menu; and when one button's tap is taken, other buttons still held under resting fingers are disarmed.
 *  An only finger keeps the browser's own click. If the browser sends a click for a release already activated here,
 *  with no new contact in between, that click is dropped: it would act twice, or press whatever the first opened under
 *  the finger. A new contact always gets its own click. */
export function bindHeldFingerTaps(doc=globalThis.document,{slop=12,echo=400,hold=1000,now=()=>performance.now()}={}){
  if(!doc?.addEventListener)return {reset(){}};
  const presses=new Map();let touches=0,pending=null; // pointerId → {button,x,y,at,held,dead}
  const buttonOf=t=>{const el=t?.nodeType===1?t:t?.parentElement,b=el?.closest?.('button');return b&&!b.disabled&&!b.closest('#touch-controls')?b:null;};
  doc.addEventListener('pointerdown',e=>{pending=null;if(e.pointerType!=='touch')return;touches++;for(const p of presses.values())p.held=true;
    const button=buttonOf(e.target);if(button)presses.set(e.pointerId,{button,x:e.clientX,y:e.clientY,at:now(),held:touches>1,dead:false});},true);
  // A busy frame merges several moves into one event; the merged points still show a finger that left and came back.
  doc.addEventListener('pointermove',e=>{const p=presses.get(e.pointerId);if(!p||p.dead)return;
    for(const m of [e,...(e.getCoalescedEvents?.()??[])])if(Math.hypot(m.clientX-p.x,m.clientY-p.y)>slop){p.dead=true;break;}},{capture:true,passive:true});
  doc.addEventListener('contextmenu',()=>{for(const p of presses.values())p.dead=true;},true);
  const end=(e,released)=>{if(e.pointerType!=='touch')return;touches=Math.max(0,touches-1);const p=presses.get(e.pointerId);presses.delete(e.pointerId);
    if(!released||!p?.held||p.dead||now()-p.at>hold||Math.hypot(e.clientX-p.x,e.clientY-p.y)>slop||buttonOf(doc.elementFromPoint?.(e.clientX,e.clientY))!==p.button)return;
    for(const other of presses.values())other.dead=true;
    pending={at:now(),x:e.clientX,y:e.clientY};p.button.click();};
  doc.addEventListener('pointerup',e=>end(e,true),true);doc.addEventListener('pointercancel',e=>end(e,false),true);
  doc.addEventListener('click',e=>{if(!e.isTrusted||!pending)return;const echoed=now()-pending.at<echo&&Math.hypot(e.clientX-pending.x,e.clientY-pending.y)<=slop*2;pending=null;
    if(echoed){e.preventDefault();e.stopImmediatePropagation();}},true);
  return {reset(){presses.clear();touches=0;pending=null;}};
}

/** Saved on/off for the FPS counter. Off by default; unreadable or blocked storage keeps the choice in memory. */
export function createShowFpsPreference(getStorage=()=>globalThis.localStorage){
  let value=false;
  try{value=getStorage().getItem(SHOW_FPS_KEY)==='on';}catch{/* private storage: default off */}
  return {
    get value(){return value;},
    set(next){next=Boolean(next);if(next===value)return false;value=next;
      try{getStorage().setItem(SHOW_FPS_KEY,value?'on':'off');}catch{/* this visit still uses the choice */}
      return true;}
  };
}

/** Counts frames the pacer admitted and the game drew while riding; publishes about twice a second, only when the
 *  rounded rate changes. `write(text)` receives the new figure ('--' until the first sample). */
export function createFpsMeter(write,{window=500,gap=1000}={}){
  let epoch=-1,last=-1,count=0,shown=null;
  const publish=text=>{if(text!==shown){shown=text;write(text);}};
  return {
    reset(){epoch=-1;last=-1;count=0;},
    clear(){this.reset();publish('--');},
    frame(now){
      if(!Number.isFinite(now))return;
      if(epoch<0||now<last||now-last>gap){epoch=now;last=now;count=0;return;}
      last=now;count++;const elapsed=now-epoch;
      if(elapsed>=window){publish(String(Math.round(1000*count/elapsed)));epoch=now;count=0;}
    },
    get shown(){return shown;}
  };
}

// Words that open a street name; the plaque sets them small before the rest, as the corner plaques do.
const PREFIXES=['Calle','Callejón','Caleta','Paseo','Plazoleta','Plaza','Avenida','Escalinata','Carril','Acceso','Skatepark'];
/** 'Calle del Cristo' → ['Calle','del Cristo']; names without a prefix → ['', name]. */
export function splitStreetName(name){
  for(const p of PREFIXES)if(name.startsWith(p+' ')&&name.length>p.length+1)return [p,name.slice(p.length+1)];
  return ['',name];
}
const PARTICLES=new Set(['de','del','la','las','los','el','y','a','en']),TITLES=new Set(['Dr.','Maestro','Reverendo','Rvdo.','Mtro.']);
/** What the plaque shows: the first of two official names, 'Doctor' as 'Dr.', and leading given names reduced to
 *  initials (as the old corner plaques abbreviate: 'S. FRANCISCO') until the name fits `max` characters. The two last
 *  surnames, titles, particles and quoted nicknames are kept whole. Returns [prefix, name]. */
export function plaqueName(full,max=24,tight=false){
  let [prefix,rest]=splitStreetName(full.split(' / ')[0]);
  rest=rest.replace(/^Doctor /,'Dr. ');
  // Tighter, for narrow screens: the short forms of titles and of a dedication.
  if(tight)rest=rest.replace(/^Reverendo /,'Rvdo. ').replace(/^Maestro /,'Mtro. ').replace(/^en Honor a (?:la |el |los |las )?/,'');
  const words=rest.split(' ');
  const lead=[];for(let i=0;i<words.length;i++){const w=words[i];if(i===0&&TITLES.has(w))continue;if(!/^\p{Lu}\p{Ll}+$/u.test(w))break;lead.push(i);}
  let quoted=false;const named=[];for(let i=0;i<words.length;i++){const w=words[i];if(w.startsWith('"'))quoted=true;
    if(!quoted&&/^\p{Lu}/u.test(w)&&!TITLES.has(w))named.push(i);if(w.endsWith('"'))quoted=false;}
  const protect=new Set(named.slice(-2));
  for(const i of lead){if(words.join(' ').length<=max)break;if(protect.has(i))break;words[i]=words[i][0]+'.';}
  return [prefix,words.join(' ')];
}
const fold=t=>t.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().split(/\s+/).filter(w=>w&&!PARTICLES.has(w)).join(' ');
const inRing=(r,x,z)=>{let inside=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const xi=r[i],zi=r[i+1],xj=r[j],zj=r[j+1];
  if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}return inside;};
const ringEdge=(r,x,z)=>{let best=Infinity;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const ax=r[j],az=r[j+1],dx=r[i]-ax,dz=r[i+1]-az,l2=dx*dx+dz*dz;
  const f=l2>0?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2)):0;best=Math.min(best,Math.hypot(ax+dx*f-x,az+dz*f-z));}return best;};

/** Nearest named street, or the square the rider is standing in. Built once from the city's roads, the mapped square
 *  footprints (`areas`: {name, ring}) and the map's place markers; typed arrays and a 40 m grid for the streets.
 *  Inside a square's footprint its name wins (spelt as on the map when a map place names the same square); a square
 *  with no footprint uses a small disc round its marker. A place that carries a `ring` (a venue) names its own ground. A street returns once the rider is clearly off the square.
 *  `at(x,z)` keeps the current name unless another is clearly nearer, so names do not flicker at edges. */
export function createStreetIndex(roads,places=[],areas=[],{cell=40,reach=4,markerRadius=14,edge=3,keep=3}={}){
  const names=[],nameOf=new Map(),segs=[];
  const idOf=name=>{let id=nameOf.get(name);if(id===undefined){id=names.length;names.push(name);nameOf.set(name,id);}return id;};
  for(const r of roads){if(!r?.name||!r.points||r.points.length<2)continue;const id=idOf(r.name),half=Math.max(1,(r.width||4)/2)+reach;
    for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];segs.push(a[0],a[1],b[0],b[1],half,id);}}
  const n=segs.length/6,seg=new Float32Array(n*5),segName=new Uint16Array(n);
  for(let i=0;i<n;i++){for(let k=0;k<5;k++)seg[i*5+k]=segs[i*6+k];segName[i]=segs[i*6+5];}
  const grid=new Map(),key=(i,j)=>i*65536+j,cellOf=v=>Math.floor(v/cell);
  for(let s=0;s<n;s++){const o=s*5,h=seg[o+4];
    const i0=cellOf(Math.min(seg[o],seg[o+2])-h),i1=cellOf(Math.max(seg[o],seg[o+2])+h),j0=cellOf(Math.min(seg[o+1],seg[o+3])-h),j1=cellOf(Math.max(seg[o+1],seg[o+3])+h);
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=key(i,j);let list=grid.get(k);if(!list)grid.set(k,list=[]);list.push(s);}}
  for(const [k,list] of grid)grid.set(k,Uint16Array.from(list));
  const plazaPlaces=places.filter(p=>/^Plaza /.test(p?.name??'')&&Number.isFinite(p.x)&&Number.isFinite(p.z));
  const squares=[],matched=new Set();
  for(const a of areas){if(!/^Plaz/.test(a?.name??'')||!a.ring||a.ring.length<3)continue;
    const ring=new Float32Array(a.ring.flat());let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
    for(let i=0;i<ring.length;i+=2){x0=Math.min(x0,ring[i]);x1=Math.max(x1,ring[i]);z0=Math.min(z0,ring[i+1]);z1=Math.max(z1,ring[i+1]);}
    const place=plazaPlaces.find(p=>fold(p.name)===fold(a.name));if(place)matched.add(place);
    squares.push({name:place?.name??a.name,ring,x0,x1,z0,z1});}
  // Venues: a map place that carries its own footprint (`ring`, open [[x,z]…]) names itself inside it, like a square.
  for(const p of places){if(!p?.name||!Array.isArray(p.ring)||p.ring.length<3)continue;
    const ring=new Float32Array(p.ring.flat());let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
    for(let i=0;i<ring.length;i+=2){x0=Math.min(x0,ring[i]);x1=Math.max(x1,ring[i]);z0=Math.min(z0,ring[i+1]);z1=Math.max(z1,ring[i+1]);}
    squares.push({name:p.name,ring,x0,x1,z0,z1});}
  const markers=plazaPlaces.filter(p=>!matched.has(p)&&!squares.some(q=>inRing(q.ring,p.x,p.z)));
  let current='',held=null;
  // Distance from a point to a square's footprint (0 inside) or to a marker's disc.
  const reachOf=(name,x,z)=>{let best=Infinity;for(const q of squares)if(q.name===name)best=Math.min(best,inRing(q.ring,x,z)?0:ringEdge(q.ring,x,z));
    for(const p of markers)if(p.name===name)best=Math.min(best,Math.max(0,Math.hypot(p.x-x,p.z-z)-markerRadius));return best;};
  const distances=(x,z)=>{const found=new Map(),put=(name,d)=>{if(!(found.get(name)<=d))found.set(name,d);},list=grid.get(key(cellOf(x),cellOf(z)));
    if(list)for(const s of list){const o=s*5,ax=seg[o],az=seg[o+1],dx=seg[o+2]-ax,dz=seg[o+3]-az,l2=dx*dx+dz*dz;
      const f=l2>0?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2)):0,d=Math.hypot(ax+dx*f-x,az+dz*f-z);
      const nm=names[segName[s]];if(d<=seg[o+4]+(nm===current?2:0))put(nm,d);}  // the current name reaches 2 m further: no edge flicker
    // Squares: inside wins outright; just outside the edge they stay a candidate a little behind the street.
    for(const q of squares){const pad=edge+2;if(x<q.x0-pad||x>q.x1+pad||z<q.z0-pad||z>q.z1+pad)continue;
      const e=ringEdge(q.ring,x,z);if(inRing(q.ring,x,z))put(q.name,e>=1?-1:1.5-e);else if(e<=edge+(q.name===current?2:0))put(q.name,1.5+e);}
    for(const p of markers){const d=Math.hypot(p.x-x,p.z-z);if(d<=markerRadius-1)put(p.name,-1);else if(d<=markerRadius+edge+(p.name===current?2:0))put(p.name,1.5+d-markerRadius);}
    return found;};
  return {
    get size(){return n;},
    get squares(){return squares.map(q=>q.name);},
    get markers(){return markers.map(p=>p.name);},
    /** A square chosen on the map: map arrivals stand on the street beside it, so its name is kept round the arrival
     *  point (only when the footprint is within 20 m) until the rider leaves that area or rides into another square. */
    hold(name,x,z){const d=reachOf(name,x,z);held=d<=20?{name,x,z,r:Math.max(12,d+10)}:null;if(held)current=name;return !!held;},
    at(x,z){if(!Number.isFinite(x)||!Number.isFinite(z))return current='';
      const found=distances(x,z);
      if(held){if(Math.hypot(x-held.x,z-held.z)>held.r)held=null;
        else{for(const [name,d] of found)if(d<0&&name!==held.name){held=null;return current=name;}return current=held.name;}}let best='',bestD=Infinity;
      for(const [name,d] of found)if(d<bestD){best=name;bestD=d;}
      if(current&&found.has(current)&&found.get(current)<=bestD+keep&&!(bestD<0&&found.get(current)>=0))return current;
      return current=best;},
    reset(){current='';held=null;}
  };
}

/** Which controls the player is using: a controller after fresh pad input, touch where the touch controls are
 *  available, otherwise keyboard. */
export function inputDevice(body){return body.dataset.input==='gamepad'?'pad':body.classList.contains('touch-enabled')?'touch':'keyboard';}

/** Pause's controls help: opens on the device in use; the other two are one press away. */
export function bindControlsHelp(panel,tabs){
  const show=device=>{panel.dataset.show=device;for(const t of tabs)t.setAttribute('aria-pressed',String(t.dataset.help===device));};
  for(const t of tabs)t.addEventListener('click',()=>show(t.dataset.help));
  return show;
}
