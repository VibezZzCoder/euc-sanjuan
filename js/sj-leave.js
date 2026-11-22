/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Leaving for the main EUC Thrills game. The page loads this module on its own, before the game, so the links on the
// loading and error plaque work even when the game is still starting or could not start.
//
// An ordinary click or tap on a link marked `data-leave` replaces this page in the tab's history instead of adding to
// it, so Back from the main game does not bring back a stale city page. Anything else (Ctrl/Cmd/Shift/Alt, a middle
// click, a click already handled elsewhere, a link opening another window) is left to the browser, and without
// JavaScript the links are ordinary links.

/** What to do with a click on a leave link: 'replace' this page, or 'browser' (leave it alone). */
export function leaveDecision(event,anchor){
  if(!anchor||!anchor.href)return 'browser';
  if(event.defaultPrevented||event.button!==0)return 'browser';
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return 'browser';
  const target=anchor.getAttribute?.('target');if(target&&target!=='_self')return 'browser';
  if(anchor.hasAttribute?.('download'))return 'browser';
  return 'replace';
}

const hooks=new Set();
/** Called just before the page is replaced (the game drops unfinished work there). Returns an unsubscribe function. */
export function onLeave(fn){hooks.add(fn);return ()=>hooks.delete(fn);}

/** Runs the hooks (a failing hook never keeps the player here), then replaces this page with `href`. */
export function leave(href,view=globalThis.window){
  for(const fn of hooks){try{fn(href);}catch(error){console.error(error);}}
  view.location.replace(href);
}

/** Listens on the document. Bubbling phase, so a handler that already took the click wins. */
export function bindLeaveLinks(doc=globalThis.document,view=globalThis.window){
  if(!doc?.addEventListener)return ()=>{};
  const onClick=event=>{const el=event.target?.nodeType===1?event.target:event.target?.parentElement;
    const anchor=el?.closest?.('a[data-leave]');if(!anchor||leaveDecision(event,anchor)!=='replace')return;
    event.preventDefault();leave(anchor.href,view);};
  doc.addEventListener('click',onClick);
  return ()=>doc.removeEventListener('click',onClick);
}

// ---- A controller on the loading and error plaque ----
// The game's own controller support starts with the title. Before that (still loading) and after the game stopped on
// an error, a standard pad can still move between the plaque's controls (D-pad or left stick) and press the focused one
// (A). Nothing acts until every button is released and the stick is centred once, so an A still held from the previous
// page does nothing; after that each press acts once.
const AXIS=.5,SCREENS=new Set(['loading','error']);

/** One pad reading → {neutral, step (-1|0|1), activate}. Pure, for tests. */
export function padReading(pad){
  const b=i=>!!(pad?.buttons?.[i]?.pressed||(pad?.buttons?.[i]?.value??0)>.5),x=pad?.axes?.[0]??0,y=pad?.axes?.[1]??0;
  const back=b(12)||b(14)||y<-AXIS||x<-AXIS,forward=b(13)||b(15)||y>AXIS||x>AXIS;
  return {neutral:!b(0)&&!back&&!forward,step:back===forward?0:back?-1:1,activate:b(0)};
}

/** Edge-triggered steps from successive readings, with the neutral gate. Returns a function: reading → action|null. */
export function padGate(){
  let armed=false,last={step:0,activate:false};
  return reading=>{
    if(!armed){if(reading.neutral)armed=true;last=reading;return null;}
    const action=reading.activate&&!last.activate?'activate':reading.step&&reading.step!==last.step?reading.step:null;
    last=reading;return action;};
}

/** The plaque's usable controls, in page order. */
export function plaqueControls(root){
  return root?[...root.querySelectorAll('button,a[href]')].filter(el=>!el.disabled&&!el.closest('[hidden]')&&el.getClientRects().length):[];
}

export function bindPlaquePad(doc=globalThis.document,view=globalThis.window){
  const nav=view?.navigator;if(!doc?.body||!nav?.getGamepads||!view.requestAnimationFrame)return ()=>{};
  let frame=0,gate=padGate();
  const poll=()=>{frame=0;if(!SCREENS.has(doc.body.dataset.state))return;
    const pad=[...(nav.getGamepads()??[])].find(p=>p&&p.connected!==false&&p.mapping==='standard');
    const action=pad?gate(padReading(pad)):null;
    if(action){const controls=plaqueControls(doc.getElementById('loading'));
      if(controls.length){doc.body.dataset.input='gamepad';
        const at=controls.indexOf(doc.activeElement);
        if(action==='activate')(at>=0?controls[at]:controls[0]).click();
        else{const next=controls[at<0?(action>0?0:controls.length-1):(at+action+controls.length)%controls.length];next.focus({preventScroll:true});}}}
    frame=view.requestAnimationFrame(poll);};
  // Runs only on the two plaque states; the game's own controller handling takes over from the title.
  const sync=()=>{const on=SCREENS.has(doc.body.dataset.state);if(on&&!frame){gate=padGate();frame=view.requestAnimationFrame(poll);}
    else if(!on&&frame){view.cancelAnimationFrame?.(frame);frame=0;}};
  const watch=new view.MutationObserver(sync);watch.observe(doc.body,{attributes:true,attributeFilter:['data-state']});sync();
  return ()=>{watch.disconnect();if(frame)view.cancelAnimationFrame?.(frame);frame=0;};
}

if(globalThis.document){bindLeaveLinks();bindPlaquePad();}
