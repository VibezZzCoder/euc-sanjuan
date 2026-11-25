/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// San Juan riding host — © 2026 VibezZzCoder, MIT.
import * as THREE from 'three/webgpu';
import { loadCity,buildWorld,areasOf } from './sj-world.js';
import { AREA_LAYOUTS } from './sj-world.js';
import { HANDOFF,releaseConstruction } from './sj-handoff.js';
import { prepareEucRider,createEucEntity } from './euc-rider.js';
import { TouchControls } from './touch-controls.js';
import { GamepadControls } from './gamepad-controls.js';
import { EucAudio } from './euc-audio.js';
import { createHudModel } from './euc-hud.js';
import { initialRenderPreferences,createRenderResolutionPreference } from './render-resolution.js';
import { createFramePacer,createFrameRatePreference } from './frame-rate.js';
import { waitForRenderCompletion } from './render-completion.js';
import { RidingCamera } from './sj-camera.js';
import { createWaterWatchdog } from './euc-water-watchdog.js';
import { createAtmosphere,createTimePreference,timeOverride } from './sj-atmosphere.js';
import { createCityLife } from './sj-life.js';

import {animasTurnHint} from './sj-norzagaray-layout.js';
import {createShowFpsPreference,createFpsMeter,createStreetIndex,plaqueName,inputDevice,bindControlsHelp,keepPageHome,bindHeldFingerTaps,nearestMark,markPress,tagPlace} from './sj-ui.js';
import {GROUND_AREAS} from './sj-streets-data.js';
import {RIDERS} from './euc-roster.js';
import {createRiders,startingRider} from './sj-riders.js';
import {createDorkins} from './sj-dorkins.js';
import {createShell} from './sj-shell.js';
const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
const QUIET={preventScroll:true}; // focusing a menu control must never scroll the page on a phone
keepPageHome();
const heldTaps=bindHeldFingerTaps();for(const type of ['blur','resize','pagehide'])window.addEventListener(type,()=>heldTaps.reset());
let state='loading',renderer,entity,touch,pad,audio,context,master,world,scene,camera,scenery,life,lifeAudio;
let busy=false,resizePending=true,parked=false,sizeKey='',last=0,lastView=0,muted=false,transition=0,audioPreparation,cameraControls;
const keys={},touchKeys={},padKeys={},lookKeys={},pulses={},suppressed=new Set();
const preferences=initialRenderPreferences(),resolution=createRenderResolutionPreference(undefined,preferences.resolution);
const framePreference=createFrameRatePreference(),pacer=createFramePacer(framePreference.value);
const timePreference=createTimePreference();let atmos,timeOfDay=timeOverride(params)??timePreference.value;
const hudModel=createHudModel();
document.body.dataset.time=timeOfDay; // the loading poster and title vignette take their inks from the hour
// HUD text: cached nodes, written only when the string changes (no per-frame DOM churn over the 3D view).
const showFps=createShowFpsPreference(),fpsMeter=createFpsMeter(text=>{$('fps').firstChild.firstChild.data=text;});
let hudText={},streets=null,streetAt=-1e9,speedNodes=null,showHelp;
function setText(id,value){if(hudText[id]!==value){hudText[id]=value;$(id).textContent=value;}}
function speedText(){const s=$('speed'),b=s.querySelector('b'),k=s.querySelector('.kmh');
  if(!b||!k){s.replaceChildren();const nb=document.createElement('b'),u=document.createElement('span'),sep=document.createElement('span'),nk=document.createElement('span'),u2=document.createElement('span');
    nb.textContent='0';u.className='unit';u.textContent=' mph';sep.className='sep';sep.textContent=' · ';nk.className='kmh';nk.textContent='0';u2.className='unit2';u2.textContent=' km/h';s.append(nb,u,sep,nk,u2);return speedText();}
  return speedNodes={mph:b.firstChild,kmh:k.firstChild,last:''};}
// Re-fit the current name after a resize or rotation (the slot width changed); called from the resize handler.
function refitStreet(){const el=$('street'),n=el.dataset.name;if(n){delete el.dataset.name;setStreet(n);}}
function setStreet(name){const el=$('street');if(el.dataset.name===name&&(name||el.hasAttribute('data-empty')))return;el.dataset.name=name;
  // Fit on change only (one layout read per step): the usual plaque abbreviation, a tighter one, then without the small
  // prefix word; an ellipsis is the last resort.
  el.toggleAttribute('data-empty',!name);el.removeAttribute('data-bare');if(name)el.setAttribute('lang','es');
  for(const step of name?[0,1,2]:[0]){const [prefix,rest]=name?plaqueName(name,step?18:24,step>0):['',''];
    el.firstChild.textContent=prefix?prefix+' ':'';el.lastChild.textContent=rest;el.toggleAttribute('data-long',rest.length>19);el.toggleAttribute('data-bare',step===2);
    if(!name||el.hidden||el.lastChild.scrollWidth<=el.lastChild.clientWidth+1)break;}}
function setShowFps(on){$('fps').hidden=!on;fpsMeter.clear();}
const manager={inputEnabled:false,setTouchInput:(k,v)=>{if(manager.inputEnabled){if(v&&!touchKeys[k]&&['up','reset'].includes(k))pulses[k==='up'?'hopPressed':'resetPressed']=true;touchKeys[k]=v;}},clearTouchInput:()=>{clear(touchKeys);clear(pulses);},
  cancelTouchInput(){this.clearTouchInput();entity?.clearInput();},
  setGamepadInput:(k,v)=>{if(manager.inputEnabled)padKeys[k]=v;},clearGamepadInput:()=>clear(padKeys)};
function clear(record){for(const k of Object.keys(record))delete record[k];}
// ---- Host parts. The rider picker, the officer and the page shell plug in here instead of editing the loop. ----
// MENUS: state → the element whose controls the gamepad drives in that state. A part may wrap an entry (for a dialog it
// opens on top of that menu) or add a state of its own.
// parts: objects with any of these methods, each called where its name appears below:
//   warm(on)            around the boot compile: show everything you will ever draw, then hide it again
//   sound(context,out)  once, when the audio context is created from the first Ride
//   gate(next,prev)     after every state change
//   frame(dt,now)       every riding frame, after the rider stepped and before the rider's sounds; may change the state
//   idle(dt,now,state)  every frame of every other state while the page is visible (menus poll the gamepad themselves)
//   cancel()            Esc or pad B: return true when you closed something of your own
//   menu(input,dt)      every gamepad poll while a menu is open (sticks and edges); return true to consume it
//   placed(reason)      the rider was put somewhere: 'map' | 'restart' | 'rescue'
//   hour(name)          the time of day changed
//   resize()            the window changed size or orientation
//   view(camera)        a frame is being drawn and the riding camera is placed: a part may take the camera over (a cinematic)
//   map(ctx,k)          the map is being drawn, in world metres; k is one CSS pixel in metres
//   away() / returned(persisted)   the page is being left / shown again
//   interrupted()       the player looked away (window blur, page hidden or left): drop any start that is still pending
//   failed()            the game stopped on an error: close what you opened
const MENUS={title:()=>$('title'),paused:()=>$('pause'),map:()=>$('map')},parts=[];
const AUDIBLE=new Set(['riding']); // the states in which sound plays; every other state suspends the audio context
const RESUMABLE=new Set(['title','paused','map']); // the states Ride/Resume may start riding from
const each=(name,...args)=>{for(const part of parts)part[name]?.(...args);};
const cancelled=()=>parts.some(part=>part.cancel?.());
let riderId=startingRider(params);
const host={$,params,QUIET,MENUS,AUDIBLE,RESUMABLE,parts,notify:(name,...args)=>each(name,...args),manager,preferences,keys,touchKeys,padKeys,pulses,clear,
  get state(){return state;},get busy(){return busy;},set busy(value){busy=value;},get transition(){return transition;},
  get renderer(){return renderer;},get scene(){return scene;},get camera(){return camera;},get world(){return world;},
  get entity(){return entity;},get life(){return life;},get atmosphere(){return atmos;},get sun(){return sun;},
  get audio(){return audio;},get lifeAudio(){return lifeAudio;},get context(){return context;},get master(){return master;},get muted(){return muted;},
  get spawn(){return spawn;},get arrivals(){return arrivals;},get timeOfDay(){return timeOfDay;},
  get cameraControls(){return cameraControls;},get pad(){return pad;},get touch(){return touch;},
  get riderId(){return riderId;},set riderId(id){riderId=id;},
  gate:(...a)=>gate(...a),draw:(...a)=>draw(...a),resume:()=>resume(),pause:()=>pause(),openMap:()=>openMap(),
  failure:error=>failure(error),stage:(...a)=>stage(...a),sound:()=>sound(),arrival:(...a)=>arrival(...a),
  arrivalFor:point=>arrivalFor(point),setText:(...a)=>setText(...a),resizeSoon:()=>{resizePending=true;},
  restartClock:()=>{last=0;lastView=0;pacer.reset();},enterPause:()=>enterPause(),cancelStart:()=>{if(!pendingStart)return false;pendingStart.abort();return true;},redrawMap:()=>{if(state==='map'&&$('map').open)mapDrawing();}};
// ---- end host parts ----
function gate(next){const prev=state;transition++;state=next;document.body.dataset.state=next;fpsMeter.reset();manager.inputEnabled=next==='riding';clear(keys);clear(touchKeys);clear(padKeys);clear(pulses);
  clear(lookKeys);cameraControls?.resetInput();showCameraTools(false);
  entity?.clearInput();touch?.setEnabled(next==='riding');pad?.reset();if(context)context[AUDIBLE.has(next)&&!muted?'resume':'suspend']().catch(()=>{});
  each('gate',next,prev);}
function failure(error){if(state==='error')return;console.error(error);gate('error');renderer?.setAnimationLoop(null);
  audio?.dispose();lifeAudio?.dispose();
  for(const id of ['map','pause'])if($(id).open)$(id).close();try{each('failed');}catch(e){console.error(e);}$('loading').hidden=false;$('title').hidden=true;
  $('loading-status').textContent='Could not continue: '+error.message;$('retry').hidden=false;$('retry').focus(QUIET);}
function fallback(reason){if(renderer?.backend?.isWebGPUBackend&&params.get('webgpu')!=='0'){
  const url=new URL(location.href);url.searchParams.set('webgpu','0');url.searchParams.set('fallback',reason);location.replace(url);return true;}return false;}
function stage(message,value){$('loading-status').textContent=message;$('progress').value=value;}
// The 3D buffer's size inputs; Ride/Resume rebuild it only when they changed or the map parked it (start-of-ride warm-up).
const bufferKey=()=>`${Math.max(1,innerWidth)}x${Math.max(1,innerHeight)}@${resolution.scale}`;
function resize(){const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);camera.aspect=w/h;camera.updateProjectionMatrix();sizeKey=bufferKey();
  // Same logical-pixel resolution policy as SF; DOM/map remain independently sharp.
  renderer.setDrawingBufferSize(1,1,1);renderer.setDrawingBufferSize(w,h,resolution.scale);resizePending=false;}
function updateCamera(dt,snap=false){cameraControls.update(camera,entity,world,dt,snap);}
function draw(now,dt=0,snap=false){if(resizePending)resize();entity.prepareView(now);updateCamera(lastView?Math.min(.1,(now-lastView)/1000):dt,snap);each('view',camera);lastView=now;
  atmos.aim(entity.position,camera);renderer.render(scene,camera);}
// Start-of-ride warm-up. Behind the loading screen, with
// physics paused: one fenced real frame (normal sun shadow pass, the scene's cull/LOD updaters, chase camera) along each
// of the four headings out of the spawn, so turning into those streets does not compile/upload on the first ride frames;
// then real rAF-paced frames at the spawn until the per-frame render time settles. Bounded by frames and wall time.
const WARM={headings:4,settleFrames:40,settleMs:1500,minFrames:5,stable:3};
async function warmRidingView(){const start=performance.now();
  for(let k=1;k<WARM.headings;k++){const h=spawn.headingY+k*2*Math.PI/WARM.headings;
    if(!entity.placeAt(spawn.x,spawn.z,h,spawn.y,{requireClear:true,departure:0}))continue;
    draw(performance.now(),0,true);await waitForRenderCompletion(renderer);}
  if(!entity.placeAt(spawn.x,spawn.z,spawn.headingY,spawn.y,{requireClear:true,departure:0}))throw new Error('Could not restore the spawn after warming the view');
  const times=[],settle=performance.now();
  for(let i=0;i<WARM.settleFrames&&performance.now()-settle<WARM.settleMs;i++){
    const now=await new Promise(requestAnimationFrame),t=performance.now();draw(now,0,true);times.push(performance.now()-t);
    if(times.length>=WARM.minFrames){const floor=Math.max(8,1.25*Math.min(...times));if(times.slice(-WARM.stable).every(v=>v<=floor))break;}}
  await waitForRenderCompletion(renderer);return {ms:performance.now()-start,frames:times.length};}
// Boot compile of every material, geometry and pass variant in the city, whatever the spawn camera sees: objects first
// seen after a rotation, a teleport or an hour change (and their shadow-pass variants) otherwise build pipelines then.
// Behind the loading screen: the spatial cull updaters pause, every mesh is shown and unculled for one async compile
// and one real frame (main and shadow pass), then every flag is restored.
async function compileWholeCity(){const saved=[];
  scene.traverse(o=>{if(o.isLOD&&o.autoUpdate){saved.push([o,'autoUpdate',true]);o.autoUpdate=false;}
    if(o.isMesh||o.isLine||o.isPoints||o.isSprite){if(!o.visible){saved.push([o,'visible',false]);o.visible=true;}if(o.frustumCulled){saved.push([o,'frustumCulled',true]);o.frustumCulled=false;}}});
  try{await renderer.compileAsync(scene,camera);sun.shadow.needsUpdate=true;renderer.render(scene,camera);await waitForRenderCompletion(renderer);}
  finally{for(const [o,k,v] of saved)o[k]=v;}}
let sun,spawn,arrivals=[],waterWatch;
function arrival(point,headingY){return world.sampler.findPlacementTarget({x:point.x,z:point.z,headingY,referenceY:world.height(point.x,point.z),maxStepUp:entity?.controller.tuning.maxStepUp??.216});}
function findArrival(point){
  const segments=[];
  for(const road of world.city.roads)if(road.kind!=='steps')for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<8)continue;const f=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.z-a[1])*dz)/(length*length)));
    const x=a[0]+dx*f,z=a[1]+dz*f;segments.push({x,z,d:Math.hypot(x-point.x,z-point.z),heading:Math.atan2(dx,dz)});
  }
  segments.sort((a,b)=>a.d-b.d);
  for(const segment of segments.slice(0,24)){
    if(segment.d>35)continue;
    for(const heading of [segment.heading,segment.heading+Math.PI]){
      const start=arrival(segment,heading);if(!start)continue;
      let clear=true;
      for(let d=.5;d<=16;d+=.5)if(!arrival({x:start.x+Math.sin(heading)*d,z:start.z+Math.cos(heading)*d},heading)){clear=false;break;}
      if(clear)return {...point,...start};
    }
  }
  return null;
}
// ---- Exact on-site arrivals (skatepark): an area place carrying `arrival` {x,z,y,headingY} is checked on its own registered
// floor at that height and heading, with `clear` metres (default 16) clear ahead on the same floor; no road snap, no fallback
// to another layer. ----
function exactArrival(point){const a=point.arrival,step=entity?.controller.tuning.maxStepUp??.216;
  const at=(x,z,y)=>world.sampler.findPlacementTarget({x,z,headingY:a.headingY,referenceY:y,maxStepUp:step,registeredSurfaceOnly:true});
  const start=at(a.x,a.z,a.y);if(!start||Math.abs(start.y-a.y)>.05)return null;
  for(let d=.5;d<=(a.clear??16);d+=.5)if(!at(start.x+Math.sin(a.headingY)*d,start.z+Math.cos(a.headingY)*d,start.y))return null;
  return {...point,...start};}
function arrivalFor(point){return point.arrival?exactArrival(point):findArrival(point);}
// ---- end exact arrivals ----
// The game starts on the plaza's paved edge beside Calle San Francisco, looking along the street: a few metres off the
// traffic lane, so nobody waits behind a rider who is still reading the controls. Falls back to the street arrival.
const START={x:-.62,z:12.64};
function plazaStart(base){const start=arrival(START,base.headingY);if(!start)return base;
  for(let d=.5;d<=16;d+=.5)if(!arrival({x:start.x+Math.sin(base.headingY)*d,z:start.z+Math.cos(base.headingY)*d},base.headingY))return base;
  return {...base,...start};}
function updateHud(now){const speed=Math.abs(entity.speed),mph=(speed*2.23694).toFixed(0),kmh=(speed*3.6).toFixed(0);
  if(!speedNodes||!speedNodes.mph.isConnected)speedText();
  if(speedNodes.last!==mph+'|'+kmh){speedNodes.last=mph+'|'+kmh;speedNodes.mph.data=mph;speedNodes.kmh.data=kmh;}
  setText('location',`${entity.position.x.toFixed(1)}, ${entity.position.z.toFixed(1)} · ${entity.position.y.toFixed(1)} m`);
  const c=entity.controller,warning=hudModel.update({crashed:c.crashed,powerStage:c.powerWarning,tiltBack:c.tiltBack,overspeed:c.overspeed},performance.now()/1000);
  setText('rider-status',c.crashed?'R / B / GET UP to recover':warning.warningLabel||(warning.overspeed.visible?'Overspeed — slow down':
    animasTurnHint(entity.position.x,entity.position.z,entity.heading,entity.speed))||'');
  if(streets&&!(now-streetAt<500&&now>=streetAt)){streetAt=now;setStreet(streets.at(entity.position.x,entity.position.z));} // at most twice a second
  touch.setDown(entity.controller.crashed);}
function tick(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
  // The gamepad is polled even while something is being prepared, so B can still cancel it; nothing else runs then.
  try{pad.update(dt);if(busy||document.hidden)return;if(state!=='riding'){each('idle',dt,now,state);return;}
    cameraControls.applyGamepadInput((lookKeys.KeyL||0)-(lookKeys.KeyJ||0),(lookKeys.KeyK||0)-(lookKeys.KeyI||0),(lookKeys.Minus||0)-(lookKeys.Equal||0),dt);
    const blended={...pulses};clear(pulses);for(const source of [keys,touchKeys,padKeys])for(const k in source)blended[k]=Math.max(blended[k]??0,source[k]);
    atmos.advance(dt);life.update(dt,entity,camera);entity.update(dt,blended);waterWatch?.observe(entity.controller,dt,!!(blended.resetPressed||blended.reset));
    each('frame',dt,now);if(state!=='riding')return; // a part may end the ride (a capture)
    audio?.update(entity,entity.drainEvents());lifeAudio?.update(camera,dt);updateHud(now);
    if(pacer.shouldRender(now)){draw(now,dt);if(showFps.value)fpsMeter.frame(now);}
  }catch(error){failure(error);}}
async function sound(){if(muted)return;if(!context){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;
  context=new Context();master=context.createGain();master.gain.value=.65;master.connect(context.destination);audio=new EucAudio(context,master);
  lifeAudio=life?.createAudio(context,master);each('sound',context,master);} // the city's sound, under the rider's
  context.resume().catch(()=>{}); // Unlock synchronously from Ride/Resume, before fetching or decoding.
  // The committed rider's crash voice: the boot rider, or one chosen before the first Ride or while muted.
  if(audio.riderBanks.active?.id===riderId)return;
  if(audioPreparation?.id!==riderId){audioPreparation?.stop.abort();const id=riderId,stop=new AbortController(),run=(async()=>{const bank=await audio.riderBanks.prepareRider(id,context,{signal:stop.signal});
    try{if(bank.valid&&id===riderId)bank.commit();}finally{bank.dispose();}})();audioPreparation={id,stop,run};run.finally(()=>{if(audioPreparation?.run===run)audioPreparation=null;}).catch(()=>{});}
  await audioPreparation.run;
}
let pendingStart=null; // the Ride/Resume being prepared; aborted when the player looks away (host.cancelStart)
async function resume(){if(busy||!entity||!RESUMABLE.has(state))return;busy=true;const revision=transition,stop=pendingStart=new AbortController();
  const action=state==='title'?$('ride'):$('resume'),label=action.textContent;action.textContent='Preparing ride…';
  $('ride').disabled=$('resume').disabled=true;$('ride').setAttribute('aria-busy','true');
  try{await Promise.race([sound(),new Promise(r=>stop.signal.addEventListener('abort',r))]);if(revision!==transition||document.hidden||stop.signal.aborted)return;
    if(parked||sizeKey!==bufferKey())resizePending=true;parked=false;draw(performance.now(),0,true);await waitForRenderCompletion(renderer);
    if(revision!==transition||document.hidden||stop.signal.aborted)return;
  for(const id of ['pause','map'])if($(id).open)$(id).close();$('map-canvas').width=$('map-canvas').height=1;
  $('title').hidden=true;$('hud').hidden=false;$('ride-status').hidden=false;refitStreet();gate('riding');last=0;pacer.reset();renderer.domElement.focus(QUIET);
  }catch(e){failure(e);}finally{if(pendingStart===stop)pendingStart=null;busy=false;action.textContent=label;$('ride').disabled=$('resume').disabled=false;$('ride').removeAttribute('aria-busy');}}
// The device is read before the gate (the gate hides the touch controls); a failure here must not leave a frozen ride.
function pause(){if(busy||state!=='riding')return;enterPause();}
// Pause as if the player had paused here: also used when a part ends its own state without a ride (a released booking).
function enterPause(){const device=inputDevice(document.body);
  try{gate('paused');showHelp?.(device);if(!$('pause').open)$('pause').showModal();document.querySelector('#pause .sheet-body').scrollTop=0;$('resume').focus(QUIET);}catch(error){failure(error);}}
// Map palette: deep bay teal with paler shallows, warm sand land, plaster-coloured buildings, pale streets,
// gate-red destinations, the yellow rider arrow.
const MAP={sea:'#1c6a68',shallow:'#2f8c85',land:'#f0dcb0',building:'#d9a57c',road:'#fff8ea',edge:'#b78f68',dest:'#a62d23',ring:'#f8f1e3',ink:'#182c40',you:'#fee17d',water:'#d3ece8'};
function mapDrawing(){const canvas=$('map-canvas'),rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=1;canvas.height=1;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
  const ctx=canvas.getContext('2d'),t=world.terrain,w=(t.nx-1)*t.step,h=(t.nz-1)*t.step,s=Math.min(canvas.width/w,canvas.height/h)*.95;
  const ox=(canvas.width-w*s)/2,oz=(canvas.height-h*s)/2,px=x=>ox+(x-t.x0)*s,pz=z=>oz+(z-t.z0)*s;
  ctx.fillStyle=MAP.sea;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(ox,oz);ctx.scale(s,s);ctx.translate(-t.x0,-t.z0);
  const path=ring=>{ctx.moveTo(...ring[0]);for(const p of ring.slice(1))ctx.lineTo(...p);ctx.closePath();};
  ctx.strokeStyle=MAP.shallow;ctx.lineWidth=14*dpr/s;ctx.lineJoin='round';for(const p of world.city.boundary){ctx.beginPath();path(p.outer);ctx.stroke();}
  ctx.fillStyle=MAP.land;for(const p of world.city.boundary){ctx.beginPath();path(p.outer);for(const hole of p.holes)path(hole);ctx.fill('evenodd');}
  ctx.fillStyle=MAP.building;for(const b of world.city.buildings){ctx.beginPath();path(b.outer);for(const h of b.holes)path(h);ctx.fill('evenodd');}
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const [colour,extra] of [[MAP.edge,1.6/s],[MAP.road,0]]){ctx.strokeStyle=colour;
    for(const r of world.city.roads){ctx.beginPath();ctx.moveTo(...r.points[0]);for(const p of r.points.slice(1))ctx.lineTo(...p);ctx.lineWidth=Math.max(2/s,r.width)+extra;ctx.stroke();}}
  // Area map lines (e.g. worldedge's east closure): understated, no arrivals.
  for(const a of areasOf(world))for(const l of a.mapLines??[]){ctx.beginPath();ctx.moveTo(...l.points[0]);for(const p of l.points.slice(1))ctx.lineTo(...p);
    ctx.strokeStyle=l.colour;ctx.lineWidth=l.width/s;ctx.setLineDash((l.dash??[]).map(v=>v/s));ctx.stroke();ctx.setLineDash([]);}
  const k=dpr/s; // marks are sized in CSS pixels, like the legend
  for(const p of arrivals){ctx.beginPath();ctx.arc(p.x,p.z,6.5*k,0,Math.PI*2);ctx.fillStyle=MAP.ink;ctx.fill();
    ctx.beginPath();ctx.arc(p.x,p.z,5*k,0,Math.PI*2);ctx.fillStyle=MAP.ring;ctx.fill();ctx.beginPath();ctx.arc(p.x,p.z,3.5*k,0,Math.PI*2);ctx.fillStyle=MAP.dest;ctx.fill();}
  each('map',ctx,k);
  ctx.save();ctx.translate(entity.position.x,entity.position.z);ctx.rotate(-entity.heading);ctx.fillStyle=MAP.you;ctx.strokeStyle=MAP.ink;ctx.lineWidth=2*k;
  ctx.beginPath();ctx.moveTo(0,10*k);ctx.lineTo(7*k,-7*k);ctx.lineTo(0,-3*k);ctx.lineTo(-7*k,-7*k);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  // Quiet cartography in screen space: the two waters, a north mark and a scale bar.
  ctx.setTransform(1,0,0,1,0,0);const u=dpr,label=(text,x,z,size)=>{ctx.font=`600 ${size*u}px Overpass, Inter, sans-serif`;ctx.letterSpacing=`${.18*size*u}px`;
    ctx.textAlign='center';ctx.textBaseline='middle';const half=ctx.measureText(text.toUpperCase()).width/2+6*u;x=Math.max(half,Math.min(canvas.width-half,x));ctx.strokeStyle=MAP.sea;ctx.lineWidth=4*u;ctx.lineJoin='round';ctx.strokeText(text.toUpperCase(),x,z);
    ctx.fillStyle=MAP.water;ctx.fillText(text.toUpperCase(),x,z);ctx.letterSpacing='0px';};
  const size=canvas.width/u<520?10:12;
  label('Océano Atlántico',px((t.x0+w*.5)),pz(t.z0+h*.08),size);const bay=[[760,615],[640,640],[900,600],[380,650],[-260,650]].find(([x,z])=>[-150,-75,0,75,150].every(d=>world.sampler.isWater(x+d,z,0)&&world.sampler.isWater(x+d,z-18,0)&&world.sampler.isWater(x+d,z+18,0)))??[760,615];
  label('Bahía de San Juan',px(bay[0]),pz(bay[1]),size);
  const nx=canvas.width-22*u,nz=26*u;ctx.fillStyle=MAP.ring;ctx.strokeStyle=MAP.ink;ctx.lineWidth=1.5*u;
  ctx.beginPath();ctx.moveTo(nx,nz-14*u);ctx.lineTo(nx+7*u,nz+8*u);ctx.lineTo(nx,nz+3*u);ctx.lineTo(nx-7*u,nz+8*u);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.font=`700 ${11*u}px Overpass, Inter, sans-serif`;ctx.fillStyle=MAP.ring;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText('N',nx,nz+11*u);
  const metres=canvas.width/u<520?200:500,len=metres*s,bx=14*u,bz=canvas.height-16*u;
  ctx.fillStyle=MAP.ink;ctx.fillRect(bx-1.5*u,bz-6.5*u,len+3*u,9*u);ctx.fillStyle=MAP.ring;ctx.fillRect(bx,bz-5*u,len/2,6*u);ctx.fillRect(bx+len/2,bz-5*u,len/2,6*u);
  ctx.fillStyle=MAP.ink;ctx.fillRect(bx+len/2,bz-5*u,len/2,3*u);
  ctx.fillStyle=MAP.ring;ctx.textAlign='left';ctx.textBaseline='bottom';ctx.font=`700 ${10*u}px Overpass, Inter, sans-serif`;ctx.fillText(`${metres} m`,bx+len+6*u,bz+2*u);
  // the marks in CSS pixels of the canvas's content box (the bitmap is fitted into it), for the pointer
  const fx=canvas.clientWidth/canvas.width,fz=canvas.clientHeight/canvas.height;
  mapMarks=arrivals.map(p=>({x:px(p.x)*fx,y:pz(p.z)*fz}));mapYou={x:px(entity.position.x)*fx,y:pz(entity.position.z)*fz};
  if(mapCursor){mapCursor.x=Math.min(canvas.clientWidth,mapCursor.x);mapCursor.y=Math.min(canvas.clientHeight,mapCursor.y);}
  placeMapMarks();}
// ---- The destination marks can be chosen on the map itself: mouse (hover names it, a click goes), a finger (a tap
// names it, a tap on the named mark or on its name tag goes) and a controller (the left stick moves a pointer, A goes). The list on the
// right stays the keyboard's way; the mark of the row in focus is ringed so list and map explain each other. ----
let mapMarks=[],mapYou=null,mapPick=-1,mapPickBy='',mapCursor=null,mapDown=null;
const MAP_REACH={mouse:14,touch:26,pad:30},MAP_PICK_HINT={tap:'Tap again to go',pad:'A to go'};
function placeMapMarks(){const canvas=$('map-canvas'),ring=$('map-pick-ring'),tag=$('map-pick-tag'),cursor=$('map-cursor');
  const left=canvas.offsetLeft+canvas.clientLeft,top=canvas.offsetTop+canvas.clientTop,W=canvas.clientWidth,H=canvas.clientHeight,m=mapMarks[mapPick];
  ring.hidden=tag.hidden=!m;cursor.hidden=!mapCursor;canvas.classList.toggle('aimed',!!m&&mapPickBy==='hover');tag.classList.toggle('press',!!m&&mapPickBy==='tap');
  if(m){ring.style.setProperty('left',`${left+m.x}px`);ring.style.setProperty('top',`${top+m.y}px`);
    $('map-pick-name').textContent=arrivals[mapPick].name;const hint=MAP_PICK_HINT[mapPickBy]??'';
    if($('map-pick-hint').textContent!==hint)$('map-pick-hint').textContent=hint;$('map-pick-hint').hidden=!hint;
    tag.style.setProperty('max-width',`${Math.max(120,W-8)}px`);
    const at=tagPlace(m.x,m.y,tag.offsetWidth,tag.offsetHeight,W,H);tag.style.setProperty('left',`${left+at.left}px`);tag.style.setProperty('top',`${top+at.top}px`);}
  if(mapCursor){cursor.style.setProperty('left',`${left+mapCursor.x}px`);cursor.style.setProperty('top',`${top+mapCursor.y}px`);}}
function pickMark(index,by=''){if(index<0)by='';if(index===mapPick&&by===mapPickBy)return;mapPick=index;mapPickBy=by;
  let row=null;for(const b of $('places').children){const on=index>=0&&Number(b.dataset.index)===index;b.classList.toggle('picked',on);if(on)row=b;}
  // the row comes into view where the list scrolls on its own (never the whole dialog: the map would leave the screen)
  if(row&&by!=='list'){const d=row.closest('.directory');if(d.scrollHeight>d.clientHeight+1){const a=row.getBoundingClientRect(),b=d.getBoundingClientRect();
    if(a.top<b.top+4)d.scrollTop-=b.top+4-a.top;else if(a.bottom>b.bottom-4)d.scrollTop+=a.bottom-b.bottom+4;}}
  placeMapMarks();}
async function travel(p){if(busy||state!=='map')return;
  life.clearAround(p.x,p.z);
  if(!entity.placeAt(p.x,p.z,p.headingY,p.y,{requireClear:true,departure:1})){ $('map-status').textContent='That arrival is blocked. Choose another place.';return;}
  $('map-status').textContent='';each('placed','map');if(streets?.hold(p.name,p.x,p.z))streetAt=-1e9;await resume();}
function bindMapMarks(){const canvas=$('map-canvas');
  const at=event=>{const r=canvas.getBoundingClientRect();return [event.clientX-r.left-canvas.clientLeft,event.clientY-r.top-canvas.clientTop];};
  const dropCursor=()=>{if(mapCursor){mapCursor=null;placeMapMarks();}};
  canvas.addEventListener('pointermove',event=>{if(event.pointerType==='touch'||state!=='map')return;dropCursor();
    pickMark(nearestMark(mapMarks,...at(event),MAP_REACH.mouse),'hover');});
  canvas.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch'&&mapPickBy==='hover')pickMark(-1);});
  // a press is a pointer that goes down and up in one place (a drag that scrolls the dialog is cancelled by the browser)
  canvas.addEventListener('pointerdown',event=>{mapDown=event.isPrimary&&event.button===0?{id:event.pointerId,x:event.clientX,y:event.clientY}:null;});
  canvas.addEventListener('pointercancel',()=>{mapDown=null;});
  canvas.addEventListener('pointerup',event=>{const down=mapDown;mapDown=null;
    if(!down||down.id!==event.pointerId||Math.hypot(event.clientX-down.x,event.clientY-down.y)>12||state!=='map'||busy)return;
    dropCursor();const finger=event.pointerType==='touch';
    const press=markPress(mapMarks,...at(event),{picked:mapPick,radius:finger?MAP_REACH.touch:MAP_REACH.mouse,direct:!finger});
    if(press.go)travel(arrivals[press.index]);else pickMark(press.index,finger?'tap':'hover');});
  // a finger's name tag is a button: it goes to the place it names
  $('map-pick-tag').addEventListener('click',()=>{if(mapPickBy==='tap'&&mapPick>=0)travel(arrivals[mapPick]);});}
// The controller's left stick moves a pointer over the map; the nearest mark within reach is named and A goes there.
// The D-pad returns to the list.
function mapStick(input,dt){if(state!=='map'||!$('map').open)return false;const {movement,actions}=input,canvas=$('map-canvas');
  if(actions?.navigate||actions?.vertical){if(mapCursor){mapCursor=null;if(mapPickBy==='pad')pickMark(-1);else placeMapMarks();}return false;}
  const mx=movement?.x??0,my=movement?.y??0;
  if((mx||my)&&dt>0&&!busy){const W=canvas.clientWidth,H=canvas.clientHeight;
    if(!mapCursor){mapCursor={...(mapMarks[mapPick]??mapYou??{x:W/2,y:H/2})};canvas.scrollIntoView({block:'nearest'});}
    const speed=Math.max(220,Math.min(520,Math.min(W,H)*.75));
    mapCursor.x=Math.max(0,Math.min(W,mapCursor.x+mx*speed*dt));mapCursor.y=Math.max(0,Math.min(H,mapCursor.y+my*speed*dt));
    const near=nearestMark(mapMarks,mapCursor.x,mapCursor.y,MAP_REACH.pad);
    if(near===mapPick&&(near<0||mapPickBy==='pad'))placeMapMarks();else pickMark(near,'pad');
    return true;}
  if(mapCursor&&actions?.activate){if(mapPick>=0&&!busy)travel(arrivals[mapPick]);return true;}
  return false;}
const searchKey=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim();
function listPlaces(){const search=searchKey($('search').value);$('places').replaceChildren();for(const p of arrivals){if(!searchKey(p.name).includes(search))continue;
  const button=document.createElement('button'),index=arrivals.indexOf(p);button.textContent=p.name;button.dataset.index=index;button.onclick=()=>travel(p);
    // the row under the mouse or in focus rings its mark on the map
    button.onmouseenter=button.onfocus=()=>{if(!mapCursor)pickMark(index,'list');};button.onmouseleave=button.onblur=()=>{if(mapPickBy==='list'&&mapPick===index)pickMark(-1);};
    if(index===mapPick)button.classList.add('picked');$('places').append(button);}
  const none=!$('places').childElementCount?'No places match. Try another name.':'';if($('map-status').textContent!==none)$('map-status').textContent=none;}
async function openMap(){if(busy||state!=='riding')return;busy=true;gate('map');try{await waitForRenderCompletion(renderer);
  if(state!=='map')return;
  mapPick=-1;mapPickBy='';mapCursor=null;mapDown=null;
  $('map').showModal();$('search').value='';listPlaces();for(const el of document.querySelectorAll('#map .directory,#map .map-body'))el.scrollTop=0;mapDrawing();$('close-map').focus(QUIET);renderer.setDrawingBufferSize(1,1,1);parked=true;
  }catch(e){failure(e);}finally{busy=false;}}

// D-pad up/down: nearest control in the next visual row (map destination grid wraps); same-row ties go to the
// horizontally closest. Nothing further that way (single column ends) falls back to the in-order step, which wraps.
// Rows are compared in unscrolled layout positions, so a scrolled menu body (Pause keeps its heading and Resume fixed
// above it) still steps to the row that follows rather than the first one left in view.
const layoutBox=el=>{const q=el.getBoundingClientRect();let y=0;for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement)y+=p.scrollTop;
  return {left:q.left,right:q.right,top:q.top+y,bottom:q.bottom+y};};
function verticalTarget(controls,current,direction){
  const r=layoutBox(current),cx=(r.left+r.right)/2;let best=null,minGap=Infinity;
  const rows=controls.filter(el=>el!==current).map(el=>{const q=layoutBox(el);
    return {el,gap:direction>0?q.top-r.bottom:r.top-q.bottom,dx:Math.abs((q.left+q.right)/2-cx)};}).filter(c=>c.gap>-4);
  for(const c of rows)minGap=Math.min(minGap,c.gap);
  for(const c of rows)if(c.gap<=minGap+12&&(!best||c.dx<best.dx))best=c;
  return best?.el??null;
}
function menuInput(input,dt){if(parts.some(part=>part.menu?.(input,dt)))return;if(mapStick(input,dt))return;const {actions}=input;if(busy||(!actions?.navigate&&!actions?.vertical&&!actions?.activate))return;
  const root=MENUS[state]?.()??null;
  if(!root||!actions)return;
  const controls=[...root.querySelectorAll('button,a[href],input,select')].filter(el=>!el.disabled&&el.getClientRects().length);
  if(!controls.length)return;
  const step=actions.navigate||actions.vertical;
  if(step){const index=controls.indexOf(document.activeElement);
    const next=(actions.vertical&&index>=0&&verticalTarget(controls,controls[index],actions.vertical))||
      controls[index<0?(step>0?0:controls.length-1):(index+step+controls.length)%controls.length];
    next.focus();next.scrollIntoView({block:'nearest'});}
  else if(actions.activate){const active=controls.includes(document.activeElement)?document.activeElement:controls[0];
    active.focus();
    if(active.tagName==='SELECT'){active.selectedIndex=(active.selectedIndex+1)%active.options.length;active.dispatchEvent(new Event('change',{bubbles:true}));}
    else if(active.tagName!=='INPUT'||active.type==='checkbox')active.click();}
}

function showCameraTools(show){$('camera-tools').hidden=!show;$('camera-button').setAttribute('aria-expanded',String(show));document.body.classList.toggle('camera-tools-open',show);}
function cycleCamera(){if(state!=='riding')return;cameraControls.cycle();}
function syncCamera(mode){for(const id of ['camera-mode','camera-setting'])$(id).value=mode;
  $('camera-status').textContent=`Camera: ${mode==='look'?'Look-around':mode==='wide'?'Wide':'Chase'}${document.body.classList.contains('touch-enabled')?'':' · C / Y to switch'}`;
  $('camera-hint').textContent=mode==='look'?'Look around: drag to look up/down and turn. Pinch or +/− to magnify.':'Drag to orbit. Pinch or +/− to zoom. Look-around gives a rider-height view.';}

// Time of day: uniforms and one environment bake, no shader rebuild; redraw the still frame behind a menu.
function setTime(next){if(busy){for(const id of ['time-title','time-of-day'])$(id).value=timeOfDay;return;}if(next===timeOfDay)return;timeOfDay=next;document.body.dataset.time=next;timePreference.set(next);atmos.apply(next);life?.setHour(next);each('hour',next);
  for(const id of ['time-title','time-of-day'])$(id).value=next;if(state==='title'||state==='paused')draw(performance.now(),0,true);}
async function boot(){stage('Starting graphics…',.05);window.NYC={cityUniforms:{uInteriorGlow:{value:0}}};
  renderer=new THREE.WebGPURenderer({antialias:true,forceWebGL:params.get('webgpu')==='0'||(preferences.phone&&params.get('webgpu')!=='1'),powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;
  await renderer.init();$('world').append(renderer.domElement);renderer.domElement.tabIndex=-1;
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();failure(new Error('Graphics context lost. Retry to reload the city.'));});
  if(renderer.backend.device){renderer.backend.device.addEventListener('uncapturederror',event=>{event.preventDefault();if(!fallback('validation'))failure(event.error);});
    renderer.backend.device.lost.then(info=>{if(info.reason!=='destroyed'&&!fallback('device-lost'))failure(new Error('Graphics device lost'));});}
  scene=new THREE.Scene();scene.background=new THREE.Color('#a7cbd0');scene.fog=new THREE.Fog('#a7cbd0',350,2200);
  camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.15,5000);
  // Sky, sun, environment light, haze and exposure for the chosen hour (js/sj-atmosphere.js).
  atmos=createAtmosphere({renderer,scene,phone:preferences.phone});sun=atmos.sun;sun.userData.aim=(x,y,z)=>atmos.aim({x,y,z},camera);
  stage('Reading Old San Juan terrain and streets…',.12);world=await loadCity();
  stage('Building the compact city…',.25);scenery=await buildWorld(scene,world,p=>stage('Building streets and hills…',.25+p*.3));
  // Traffic and people (js/sj-life.js): built while the area records still exist, drawn and compiled with the city.
  stage('Bringing the streets to life…',.56);life=await createCityLife({scene,world,atmosphere:atmos,renderer,phone:preferences.phone,params,hour:timeOfDay});
  // Post-build handoff: drop construction-only area records (js/sj-handoff.js; ?handoff=0 keeps them).
  if(HANDOFF&&params.get('handoff')!=='0')releaseConstruction(world,Object.keys(AREA_LAYOUTS));
  atmos.apply(timeOfDay);
  stage('Preparing '+RIDERS[riderId].name+'…',.65);const appearance=await prepareEucRider(riderId);
  const candidate=world.city.places.find(p=>p.name==='Plaza de Armas')??{name:'Plaza de Armas',x:0,z:0};spawn=findArrival(candidate);
  if(!spawn)throw new Error('No safe Plaza de Armas spawn');
  spawn=plazaStart(spawn);
  entity=createEucEntity(scene,world.sampler,{x:spawn.x,z:spawn.z,y:spawn.y,heading:spawn.headingY,rider:riderId,appearance,softBodies:world.softBodies,dynamicWorld:life.dynamicWorld});
  // Immersion watchdog: a rider left in the sea without a native recovery is placed back at a checked dry public spot.
  waterWatch=createWaterWatchdog({sampler:world.sampler,spawn,arrivals:()=>arrivals,recovery:world.coast?.recoveryPoints,maxStepUp:entity.controller.tuning.maxStepUp,
    place:(x,z,h,y)=>{life.clearAround(x,z);const ok=entity.placeAt(x,z,h,y,{requireClear:true,departure:1.2});if(ok)each('placed','rescue');return ok;}});
  streets=createStreetIndex(world.city.roads,[...world.city.places,...world.corridor.places,...areasOf(world).flatMap(a=>a.places??[])],GROUND_AREAS);setStreet('');
  arrivals=[...world.city.places,...world.corridor.places,...(world.gate?.places??[]),...(world.fort?.places??[]),...areasOf(world).flatMap(a=>a.places??[])].map(arrivalFor).filter(Boolean);
  touch=new TouchControls(manager);touch.setEnabled(false);
  cameraControls=new RidingCamera(syncCamera);syncCamera('chase');
  cameraControls.bind(renderer.domElement,()=>state==='riding'&&!busy&&!document.hidden);
  pad=new GamepadControls(manager,cameraControls,{onToggleMenu:()=>state==='paused'||state==='map'?resume():pause(),
    onCycleCamera:cycleCamera,
    onToggleMap:()=>state==='map'?resume():openMap(),onCloseMenu:()=>cancelled()||(['map','paused'].includes(state)&&resume()),
    isMenuOpen:()=>state in MENUS,onMenuInput:menuInput,
    onActivity:()=>document.body.dataset.input='gamepad'});
  for(const type of ['pointerdown','keydown'])document.addEventListener(type,()=>delete document.body.dataset.input,{capture:true});
  $('resolution').value=resolution.value;$('frame-limit').value=framePreference.value;
  for(const id of ['time-title','time-of-day']){$(id).value=timeOfDay;$(id).onchange=()=>setTime($(id).value);}
  $('resolution').onchange=()=>{resolution.set($('resolution').value);resizePending=true;};
  $('frame-limit').onchange=()=>{framePreference.set($('frame-limit').value);pacer.set(framePreference.value);fpsMeter.reset();};
  $('show-fps').checked=showFps.value;setShowFps(showFps.value);$('show-fps').onchange=()=>{showFps.set($('show-fps').checked);setShowFps(showFps.value);};
  showHelp=bindControlsHelp($('controls-help'),[...document.querySelectorAll('.help-tabs [data-help]')]);
  $('sound').onchange=()=>{muted=!$('sound').checked;if(context)context.suspend();};
  $('ride').onclick=resume;$('resume').onclick=resume;
  $('camera-button').onclick=event=>{if(state!=='riding')return;showCameraTools($('camera-tools').hidden);
    if($('camera-tools').hidden&&event.detail)renderer.domElement.focus({preventScroll:true});};
  for(const id of ['camera-mode','camera-setting'])$(id).onchange=()=>cameraControls.setMode($(id).value);
  for(const [id,action] of [['camera-in',()=>cameraControls.zoom(-2)],['camera-out',()=>cameraControls.zoom(2)],['camera-center',()=>cameraControls.resetOrbit()]])$(id).onclick=event=>{
    if(state!=='riding')return;action();if(event.detail)renderer.domElement.focus({preventScroll:true});};
  $('pause-button').onclick=pause;$('map-button').onclick=openMap;$('close-map').onclick=resume;$('search').oninput=listPlaces;bindMapMarks();
  $('restart').onclick=()=>{life.clearAround(spawn.x,spawn.z);if(entity.placeAt(spawn.x,spawn.z,spawn.headingY,spawn.y,{requireClear:true,departure:1})){each('placed','restart');resume();}};
  for(const id of ['pause','map'])$(id).addEventListener('cancel',event=>{event.preventDefault();resume();});
  const mapping={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'up',ShiftLeft:'boost',ShiftRight:'boost',KeyR:'reset'};
  document.addEventListener('keydown',event=>{
    if(event.code==='Escape'){event.preventDefault();if(cancelled())return;if(state==='riding')pause();else if(state==='paused'||state==='map')resume();return;}
    if(event.code==='KeyM'&&!event.repeat&&state==='map'&&['BUTTON','A'].includes(event.target?.tagName)){event.preventDefault();resume();return;} // not while typing in search
    if(['INPUT','SELECT','TEXTAREA'].includes(event.target?.tagName)||(['BUTTON','A'].includes(event.target?.tagName)&&!['KeyM','KeyC'].includes(event.code)))return; // M and C also from a focused HUD button
    if(event.code==='KeyM'&&!event.repeat){event.preventDefault();state==='map'?resume():openMap();return;}
    if(['KeyC','KeyV','KeyI','KeyJ','KeyK','KeyL','Minus','Equal'].includes(event.code)){
      if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
      event.preventDefault();if(state!=='riding'){suppressed.add(event.code);return;}
      if(!event.repeat&&!suppressed.has(event.code)){
        if(event.code==='KeyC')cycleCamera();else if(event.code==='KeyV')cameraControls.resetOrbit();else lookKeys[event.code]=1;
      }return;
    }
    if(mapping[event.code]){event.preventDefault();if(state!=='riding'){suppressed.add(event.code);return;}
      if(!event.repeat&&!suppressed.has(event.code)){
        const action=mapping[event.code];keys[action]=1;
        if(action==='up'||action==='reset')pulses[action==='up'?'hopPressed':'resetPressed']=true;
      }}
  });
  document.addEventListener('keyup',event=>{suppressed.delete(event.code);delete lookKeys[event.code];if(mapping[event.code])delete keys[mapping[event.code]];});
  document.addEventListener('focusin',event=>{if(['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(event.target?.tagName)){clear(keys);clear(lookKeys);entity.clearInput();}});
  window.addEventListener('blur',()=>{if(state==='riding')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='riding')pause();last=0;fpsMeter.reset();});
  window.addEventListener('resize',()=>{resizePending=true;touch.reset();cameraControls.resetInput();clear(lookKeys);clear(keys);clear(padKeys);entity.clearInput();if(state==='map')mapDrawing();refitStreet();each('resize');});
  $('build').textContent=`Build ${document.querySelector('[name=euc-build]').content} · ${renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2'} · ${RIDERS[riderId].name}`;
  // The parts are built behind the loading screen, so whatever they will ever draw is compiled with the city.
  for(const create of [createRiders,createDorkins,createShell]){const part=await create(host);if(part)parts.push(part);}
  stage('Compiling the first view…',.85);resize();entity.prepareView();updateCamera(0,true);
  // Life gathers round the spawn; every actor pool draws at least one instance while the city compiles.
  life.focus(entity,camera);life.warm(true);each('warm',true);try{await compileWholeCity();}finally{life.warm(false);each('warm',false);}
  stage('Finishing the first frame…',.95);draw(performance.now(),0,true);await waitForRenderCompletion(renderer);
  stage('Warming the riding view…',.97);await warmRidingView();
  $('loading').hidden=true;$('title').hidden=false;gate('title');$('ride').focus(QUIET);renderer.setAnimationLoop(tick);
  // Page lifecycle (hide and a kept page shown again, calling away()/returned()): js/sj-shell.js. Retry is a full reload.
}
await boot().catch(error=>{if(!fallback('startup'))failure(error);});
