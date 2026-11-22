/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The page shell: leaving for the main EUC Thrills game and coming back, and the installed (Home Screen) app.
// A host part (see the list in js/main.js).
//
// Page lifecycle. The renderer and the city are never torn down when the page is hidden: a browser that keeps the page
// (back/forward cache, an installed app sent to the background) shows it again exactly as it was. While it is hidden
// nothing rides: a ride or the map becomes Pause. When it comes back the clock restarts (no huge first step), every
// input record is cleared, the 3D buffer is re-sized, and focus goes to the menu of the state it is in. A state this
// file does not know (one added by another part) is kept as it is, with its own menu focused; it is never turned
// into riding. A page that was not kept simply loads again.
import {onLeave} from './sj-leave.js';

/** The state to hold while the page is hidden: nothing rides behind a hidden page. */
export function hiddenState(state){return state==='riding'||state==='map'?'paused':state;}

/** What to do when a kept page is shown again, from the state it is in and the dialogs that are open.
 *  Returns {state, closeMap, openPause, focus} where focus is 'resume' | 'ride' | 'retry' | 'menu' | null. */
export function returnPlan(state,{pauseOpen=false,mapOpen=false}={}){
  if(state==='loading')return {state,closeMap:false,openPause:false,focus:null}; // still starting: the boot carries on
  if(state==='error')return {state,closeMap:false,openPause:false,focus:'retry'};
  // Riding or the map should already be Pause (hidden first); if the hide was never seen, make it so now.
  if(state==='riding'||state==='map'||state==='paused')return {state:'paused',closeMap:mapOpen,openPause:!pauseOpen,focus:'resume'};
  if(state==='title')return {state,closeMap:mapOpen,openPause:false,focus:'ride'};
  return {state,closeMap:false,openPause:false,focus:'menu'};
}

/** The player looked away (blur, hidden, page left) while a ride was being prepared from a menu: what to do.
 *  Returns null (nothing pending, or not a menu) or {state, focus} where focus is 'ride' | 'resume' | 'map'. The ride
 *  never starts on its own afterwards: the menu stays, its button comes back, and a new press starts the ride. */
export function interruptPlan(state,{pending=false}={}){
  if(!pending)return null;
  if(state==='title')return {state,focus:'ride'};
  if(state==='paused')return {state,focus:'resume'};
  if(state==='map')return {state,focus:'map'};
  if(state==='booking')return {state,focus:'menu'};
  return null;
}

/** The states a main-menu link can be followed from (title and Pause carry one; the map is included for safety). */
export const LEAVE_FROM=new Set(['title','paused','map']);

/** A control that can take focus again: still in the page, enabled, shown. */
export function usable(el){return !!el&&el.isConnected!==false&&!el.disabled&&!el.closest?.('[hidden]')&&(el.getClientRects?.().length??1)>0;}

/** The first control a player can use inside a menu root, or null. */
export function firstControl(root){
  if(!root?.querySelectorAll)return null;
  return [...root.querySelectorAll('button,a[href],input,select')].find(el=>!el.disabled&&!el.closest('[hidden]')&&el.getClientRects().length)??null;
}

export async function createShell(host){
  const {$,QUIET,MENUS}=host,view=globalThis.window,doc=globalThis.document;
  if(!view||!doc)return null;
  let shell=null;
  const others=()=>host.parts.filter(part=>part!==shell);

  // Leaving from the title, Pause or the loading plaque: a Ride or Resume still being prepared is dropped at once, other
  // parts drop unfinished work (a rider being prepared, an open picker) and sound stops. The game then holds a
  // 'leaving' state, in which nothing can start, until the next page has replaced this one; if this page is shown
  // again instead, it returns to the menu it was left from. Nothing is saved here; committed choices are already saved.
  let leftFrom=null,focusAtHide=null;
  onLeave(()=>{host.cancelStart?.();
    if(LEAVE_FROM.has(host.state)){leftFrom=host.state;host.gate('leaving');}
    for(const part of others()){try{part.cancel?.();}catch(error){console.error(error);}}
    host.context?.suspend?.().catch?.(()=>{});});

  // Help line for adding the game to the Home Screen; not shown inside the installed app.
  const installed=view.navigator?.standalone===true||view.matchMedia?.('(display-mode: standalone)').matches===true;
  if(installed&&$('install-help'))$('install-help').hidden=true;

  // Focus a menu control once the cancelled start has unwound (its button is disabled until then). Bounded.
  const focusWhenReady=(pick,tries=60)=>{if(!host.busy){const el=pick();if(el&&!el.disabled)el.focus(QUIET);return;}
    if(tries>0)view.setTimeout(()=>focusWhenReady(pick,tries-1),16);};
  // The player looked away while a ride was still being prepared: that start is dropped, the menu stays as it was.
  const interrupted=()=>{if(host.state==='loading')return;
    const was=doc.activeElement,plan=interruptPlan(host.state,{pending:!!host.cancelStart?.()});
    host.notify('interrupted');
    if(!plan)return;
    host.gate(plan.state); // clears input, suspends sound outside riding, and makes any later completion stale
    if(plan.state==='map'){ // the rider was already put at the destination: show where, and say the ride did not start
      host.redrawMap?.();if($('map-status'))$('map-status').textContent='Ride not started. Choose the place again to go.';}
    const keep=root=>usable(was)&&root?.contains(was)?was:null;
    focusWhenReady(()=>plan.focus==='ride'?(MENUS.title?.()!==$('title')?keep(MENUS.title())??firstControl(MENUS.title()):$('ride')):
      plan.focus==='resume'?$('resume'):plan.focus==='menu'?keep(MENUS[plan.state]?.())??firstControl(MENUS[plan.state]?.()):
      (keep($('map'))?.tagName==='BUTTON'?was:$('close-map')));};
  view.addEventListener('blur',interrupted);
  doc.addEventListener?.('visibilitychange',()=>{if(doc.hidden)interrupted();});

  view.addEventListener('pagehide',()=>{if(host.state==='loading')return;
    focusAtHide=doc.activeElement;interrupted();host.notify('away');const next=hiddenState(host.state);host.gate(next);host.restartClock();});
  view.addEventListener('pageshow',event=>{if(!event.persisted||host.state==='loading')return;
    // Shown again after starting to leave: back to the menu it was left from.
    const from=host.state==='leaving'?leftFrom??'title':host.state;leftFrom=null;
    const plan=returnPlan(from,{pauseOpen:$('pause').open,mapOpen:$('map').open});
    host.gate(plan.state);host.restartClock();host.resizeSoon();
    try{
      if(plan.closeMap&&$('map').open)$('map').close();
      if(plan.openPause&&!$('pause').open)$('pause').showModal();
      // The control that had focus when the page was hidden keeps it, if it is still in this state's menu: focusing
      // another one can change what it shows (a picker stamp highlights its rider on focus).
      const was=focusAtHide;focusAtHide=null;
      const root=plan.focus==='resume'?$('pause'):plan.focus==='ride'||plan.focus==='menu'?MENUS[plan.state]?.():null;
      const kept=usable(was)&&root?.contains(was)?was:null;
      const target=plan.focus==='resume'?$('resume'):plan.focus==='ride'?$('ride'):plan.focus==='retry'?$('retry'):
        plan.focus==='menu'?firstControl(MENUS[plan.state]?.()):null;
      // A dialog another part opened over the title (a picker) owns focus: the title's own button is behind it.
      const over=plan.focus==='ride'?MENUS.title?.():null,inner=over&&over!==$('title')?firstControl(over):null;
      const pick=()=>kept??inner??target;focusWhenReady(pick);
    }catch(error){host.failure(error);return;}
    host.notify('returned',true);});

  shell={};
  return shell;
}
