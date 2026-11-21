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
const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
let state='loading',renderer,entity,touch,pad,audio,context,master,world,scene,camera,scenery,life,lifeAudio;
let busy=false,resizePending=true,parked=false,sizeKey='',last=0,lastView=0,muted=false,transition=0,audioPreparation,cameraControls;
const keys={},touchKeys={},padKeys={},lookKeys={},pulses={},suppressed=new Set();
const preferences=initialRenderPreferences(),resolution=createRenderResolutionPreference(undefined,preferences.resolution);
const framePreference=createFrameRatePreference(),pacer=createFramePacer(framePreference.value);
const timePreference=createTimePreference();let atmos,timeOfDay=timeOverride(params)??timePreference.value;
const hudModel=createHudModel();
const manager={inputEnabled:false,setTouchInput:(k,v)=>{if(manager.inputEnabled){if(v&&!touchKeys[k]&&['up','reset'].includes(k))pulses[k==='up'?'hopPressed':'resetPressed']=true;touchKeys[k]=v;}},clearTouchInput:()=>{clear(touchKeys);clear(pulses);},
  cancelTouchInput(){this.clearTouchInput();entity?.clearInput();},
  setGamepadInput:(k,v)=>{if(manager.inputEnabled)padKeys[k]=v;},clearGamepadInput:()=>clear(padKeys)};
function clear(record){for(const k of Object.keys(record))delete record[k];}
function gate(next){transition++;state=next;document.body.dataset.state=next;manager.inputEnabled=next==='riding';clear(keys);clear(touchKeys);clear(padKeys);clear(pulses);
  clear(lookKeys);cameraControls?.resetInput();showCameraTools(false);
  entity?.clearInput();touch?.setEnabled(next==='riding');pad?.reset();if(context)context[next==='riding'&&!muted?'resume':'suspend']().catch(()=>{});}
function failure(error){if(state==='error')return;console.error(error);gate('error');renderer?.setAnimationLoop(null);
  audio?.dispose();lifeAudio?.dispose();
  for(const id of ['map','pause'])if($(id).open)$(id).close();$('loading').hidden=false;$('title').hidden=true;
  $('loading-status').textContent='Could not continue: '+error.message;$('retry').hidden=false;$('retry').focus();}
function fallback(reason){if(renderer?.backend?.isWebGPUBackend&&params.get('webgpu')!=='0'){
  const url=new URL(location.href);url.searchParams.set('webgpu','0');url.searchParams.set('fallback',reason);location.replace(url);return true;}return false;}
function stage(message,value){$('loading-status').textContent=message;$('progress').value=value;}
// The 3D buffer's size inputs; Ride/Resume rebuild it only when they changed or the map parked it (start-of-ride warm-up).
const bufferKey=()=>`${Math.max(1,innerWidth)}x${Math.max(1,innerHeight)}@${resolution.scale}`;
function resize(){const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);camera.aspect=w/h;camera.updateProjectionMatrix();sizeKey=bufferKey();
  // Same logical-pixel resolution policy as SF; DOM/map remain independently sharp.
  renderer.setDrawingBufferSize(1,1,1);renderer.setDrawingBufferSize(w,h,resolution.scale);resizePending=false;}
function updateCamera(dt,snap=false){cameraControls.update(camera,entity,world,dt,snap);}
function draw(now,dt=0,snap=false){if(resizePending)resize();entity.prepareView(now);updateCamera(lastView?Math.min(.1,(now-lastView)/1000):dt,snap);lastView=now;
  atmos.aim(entity.position,camera);renderer.render(scene,camera);}
// Start-of-ride warm-up (perf, 2026-11-19; ). Behind the loading screen, with
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
// The game starts on the plaza's paved edge beside Calle San Francisco, looking along the street: a few metres off the
// traffic lane, so nobody waits behind a rider who is still reading the controls. Falls back to the street arrival.
const START={x:-.62,z:12.64};
function plazaStart(base){const start=arrival(START,base.headingY);if(!start)return base;
  for(let d=.5;d<=16;d+=.5)if(!arrival({x:start.x+Math.sin(base.headingY)*d,z:start.z+Math.cos(base.headingY)*d},base.headingY))return base;
  return {...base,...start};}
function updateHud(){const speed=Math.abs(entity.speed);$('speed').textContent=`${(speed*2.23694).toFixed(0)} mph · ${(speed*3.6).toFixed(0)} km/h`;
  $('location').textContent=`${entity.position.x.toFixed(1)}, ${entity.position.z.toFixed(1)} · ${entity.position.y.toFixed(1)} m`;
  const c=entity.controller,warning=hudModel.update({crashed:c.crashed,powerStage:c.powerWarning,tiltBack:c.tiltBack,overspeed:c.overspeed},performance.now()/1000);
  $('rider-status').textContent=c.crashed?'R / B / GET UP to recover':warning.warningLabel||(warning.overspeed.visible?'Overspeed — slow down':
    animasTurnHint(entity.position.x,entity.position.z,entity.heading,entity.speed));
  touch.setDown(entity.controller.crashed);}
function tick(now){if(busy)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
  try{pad.update(dt);if(state!=='riding'||document.hidden)return;
    cameraControls.applyGamepadInput((lookKeys.KeyL||0)-(lookKeys.KeyJ||0),(lookKeys.KeyK||0)-(lookKeys.KeyI||0),(lookKeys.Minus||0)-(lookKeys.Equal||0),dt);
    const blended={...pulses};clear(pulses);for(const source of [keys,touchKeys,padKeys])for(const k in source)blended[k]=Math.max(blended[k]??0,source[k]);
    atmos.advance(dt);life.update(dt,entity,camera);entity.update(dt,blended);waterWatch?.observe(entity.controller,dt,!!(blended.resetPressed||blended.reset));audio?.update(entity,entity.drainEvents());lifeAudio?.update(camera,dt);updateHud();
    if(pacer.shouldRender(now))draw(now,dt);
  }catch(error){failure(error);}}
async function sound(){if(muted)return;if(!context){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;
  context=new Context();master=context.createGain();master.gain.value=.65;master.connect(context.destination);audio=new EucAudio(context,master);
  lifeAudio=life?.createAudio(context,master);} // the city's sound, under the rider's
  context.resume().catch(()=>{}); // Unlock synchronously from Ride/Resume, before fetching or decoding.
  if(!audioPreparation)audioPreparation=(async()=>{const bank=await audio.riderBanks.prepareRider('cool-rider',context);
    try{bank.commit();}finally{bank.dispose();}})();
  await audioPreparation;
}
async function resume(){if(busy||!entity||!['title','paused','map'].includes(state))return;busy=true;const revision=transition;
  const action=state==='title'?$('ride'):$('resume'),label=action.textContent;action.textContent='Preparing ride…';
  $('ride').disabled=$('resume').disabled=true;$('ride').setAttribute('aria-busy','true');
  try{await sound();if(revision!==transition||document.hidden)return;
    if(parked||sizeKey!==bufferKey())resizePending=true;parked=false;draw(performance.now(),0,true);await waitForRenderCompletion(renderer);
    if(revision!==transition||document.hidden)return;
  for(const id of ['pause','map'])if($(id).open)$(id).close();$('map-canvas').width=$('map-canvas').height=1;
  $('title').hidden=true;$('hud').hidden=false;$('ride-status').hidden=false;gate('riding');last=0;pacer.reset();renderer.domElement.focus();
  }catch(e){failure(e);}finally{busy=false;action.textContent=label;$('ride').disabled=$('resume').disabled=false;$('ride').removeAttribute('aria-busy');}}
async function pause(){if(busy||state!=='riding')return;gate('paused');$('pause').showModal();$('resume').focus();}
function mapDrawing(){const canvas=$('map-canvas'),rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=1;canvas.height=1;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
  const ctx=canvas.getContext('2d'),t=world.terrain,w=(t.nx-1)*t.step,h=(t.nz-1)*t.step,s=Math.min(canvas.width/w,canvas.height/h)*.95;
  ctx.fillStyle='#174050';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate((canvas.width-w*s)/2,(canvas.height-h*s)/2);ctx.scale(s,s);ctx.translate(-t.x0,-t.z0);
  const path=ring=>{ctx.moveTo(...ring[0]);for(const p of ring.slice(1))ctx.lineTo(...p);ctx.closePath();};
  ctx.fillStyle='#b6baa1';for(const p of world.city.boundary){ctx.beginPath();path(p.outer);for(const hole of p.holes)path(hole);ctx.fill('evenodd');}
  ctx.fillStyle='#7c7368';for(const b of world.city.buildings){ctx.beginPath();path(b.outer);for(const h of b.holes)path(h);ctx.fill('evenodd');}
  ctx.strokeStyle='#e5d6b7';for(const r of world.city.roads){ctx.beginPath();ctx.moveTo(...r.points[0]);for(const p of r.points.slice(1))ctx.lineTo(...p);ctx.lineWidth=Math.max(2/s,r.width);ctx.stroke();}
  // Area map lines (e.g. worldedge's east closure): understated, no arrivals.
  for(const a of areasOf(world))for(const l of a.mapLines??[]){ctx.beginPath();ctx.moveTo(...l.points[0]);for(const p of l.points.slice(1))ctx.lineTo(...p);
    ctx.strokeStyle=l.colour;ctx.lineWidth=l.width/s;ctx.setLineDash((l.dash??[]).map(v=>v/s));ctx.stroke();ctx.setLineDash([]);}
  for(const p of arrivals){ctx.beginPath();ctx.arc(p.x,p.z,4/s,0,Math.PI*2);ctx.fillStyle='#244951';ctx.fill();}
  ctx.translate(entity.position.x,entity.position.z);ctx.rotate(-entity.heading);ctx.fillStyle='#ffdc68';ctx.strokeStyle='#172b31';ctx.lineWidth=2/s;
  ctx.beginPath();ctx.moveTo(0,12/s);ctx.lineTo(7/s,-7/s);ctx.lineTo(0,-3/s);ctx.lineTo(-7/s,-7/s);ctx.closePath();ctx.fill();ctx.stroke();}
const searchKey=value=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim();
function listPlaces(){const search=searchKey($('search').value);$('places').replaceChildren();for(const p of arrivals){if(!searchKey(p.name).includes(search))continue;
  const button=document.createElement('button');button.textContent=p.name;button.onclick=async()=>{if(busy)return;
    life.clearAround(p.x,p.z);
    if(!entity.placeAt(p.x,p.z,p.headingY,p.y,{requireClear:true,departure:1})){ $('map-status').textContent='That arrival is blocked. Choose another place.';return;}
    $('map-status').textContent='';await resume();};$('places').append(button);}}
async function openMap(){if(busy||state!=='riding')return;busy=true;gate('map');try{await waitForRenderCompletion(renderer);
  if(state!=='map')return;
  $('map').showModal();$('search').value='';listPlaces();mapDrawing();$('close-map').focus();renderer.setDrawingBufferSize(1,1,1);parked=true;
  }catch(e){failure(e);}finally{busy=false;}}

// D-pad up/down: nearest control in the next visual row (map destination grid wraps); same-row ties go to the
// horizontally closest. Nothing further that way (single column ends) falls back to the in-order step, which wraps.
function verticalTarget(controls,current,direction){
  const r=current.getBoundingClientRect(),cx=(r.left+r.right)/2;let best=null,minGap=Infinity;
  const rows=controls.filter(el=>el!==current).map(el=>{const q=el.getBoundingClientRect();
    return {el,gap:direction>0?q.top-r.bottom:r.top-q.bottom,dx:Math.abs((q.left+q.right)/2-cx)};}).filter(c=>c.gap>-4);
  for(const c of rows)minGap=Math.min(minGap,c.gap);
  for(const c of rows)if(c.gap<=minGap+12&&(!best||c.dx<best.dx))best=c;
  return best?.el??null;
}
function menuInput({actions}){if(busy||(!actions?.navigate&&!actions?.vertical&&!actions?.activate))return;
  const root=state==='title'?$('title'):state==='paused'?$('pause'):state==='map'?$('map'):null;
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
  $('camera-status').textContent=`Camera: ${mode==='look'?'Look-around':mode==='wide'?'Wide':'Chase'} · C / Y to switch`;
  $('camera-hint').textContent=mode==='look'?'Look around: drag to look up/down and turn. Pinch or +/− to magnify.':'Drag to orbit. Pinch or +/− to zoom. Look-around gives a rider-height view.';}

// Time of day: uniforms and one environment bake, no shader rebuild; redraw the still frame behind a menu.
function setTime(next){if(busy){for(const id of ['time-title','time-of-day'])$(id).value=timeOfDay;return;}if(next===timeOfDay)return;timeOfDay=next;timePreference.set(next);atmos.apply(next);life?.setHour(next);
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
  stage('Preparing Cool Rider…',.65);const appearance=await prepareEucRider('cool-rider');
  const candidate=world.city.places.find(p=>p.name==='Plaza de Armas')??{name:'Plaza de Armas',x:0,z:0};spawn=findArrival(candidate);
  if(!spawn)throw new Error('No safe Plaza de Armas spawn');
  spawn=plazaStart(spawn);
  entity=createEucEntity(scene,world.sampler,{x:spawn.x,z:spawn.z,y:spawn.y,heading:spawn.headingY,appearance,softBodies:world.softBodies,dynamicWorld:life.dynamicWorld});
  // Immersion watchdog: a rider left in the sea without a native recovery is placed back at a checked dry public spot.
  waterWatch=createWaterWatchdog({sampler:world.sampler,spawn,arrivals:()=>arrivals,recovery:world.coast?.recoveryPoints,maxStepUp:entity.controller.tuning.maxStepUp,
    place:(x,z,h,y)=>{life.clearAround(x,z);return entity.placeAt(x,z,h,y,{requireClear:true,departure:1.2});}});
  arrivals=[...world.city.places,...world.corridor.places,...(world.gate?.places??[]),...(world.fort?.places??[]),...areasOf(world).flatMap(a=>a.places??[])].map(findArrival).filter(Boolean);
  touch=new TouchControls(manager);touch.setEnabled(false);
  cameraControls=new RidingCamera(syncCamera);syncCamera('chase');
  cameraControls.bind(renderer.domElement,()=>state==='riding'&&!busy&&!document.hidden);
  pad=new GamepadControls(manager,cameraControls,{onToggleMenu:()=>state==='paused'||state==='map'?resume():pause(),
    onCycleCamera:cycleCamera,
    onToggleMap:()=>state==='map'?resume():openMap(),onCloseMenu:()=>['map','paused'].includes(state)&&resume(),
    isMenuOpen:()=>['title','map','paused'].includes(state),onMenuInput:menuInput,
    onActivity:()=>document.body.dataset.input='gamepad'});
  for(const type of ['pointerdown','keydown'])document.addEventListener(type,()=>delete document.body.dataset.input,{capture:true});
  $('resolution').value=resolution.value;$('frame-limit').value=framePreference.value;
  for(const id of ['time-title','time-of-day']){$(id).value=timeOfDay;$(id).onchange=()=>setTime($(id).value);}
  $('resolution').onchange=()=>{resolution.set($('resolution').value);resizePending=true;};
  $('frame-limit').onchange=()=>{framePreference.set($('frame-limit').value);pacer.set(framePreference.value);};
  $('sound').onchange=()=>{muted=!$('sound').checked;if(context)context.suspend();};
  $('ride').onclick=resume;$('resume').onclick=resume;
  $('camera-button').onclick=event=>{if(state!=='riding')return;showCameraTools($('camera-tools').hidden);
    if($('camera-tools').hidden&&event.detail)renderer.domElement.focus({preventScroll:true});};
  for(const id of ['camera-mode','camera-setting'])$(id).onchange=()=>cameraControls.setMode($(id).value);
  for(const [id,action] of [['camera-in',()=>cameraControls.zoom(-2)],['camera-out',()=>cameraControls.zoom(2)],['camera-center',()=>cameraControls.resetOrbit()]])$(id).onclick=event=>{
    if(state!=='riding')return;action();if(event.detail)renderer.domElement.focus({preventScroll:true});};
  $('pause-button').onclick=pause;$('map-button').onclick=openMap;$('close-map').onclick=resume;$('search').oninput=listPlaces;
  $('restart').onclick=()=>{life.clearAround(spawn.x,spawn.z);if(entity.placeAt(spawn.x,spawn.z,spawn.headingY,spawn.y,{requireClear:true,departure:1}))resume();};
  for(const id of ['pause','map'])$(id).addEventListener('cancel',event=>{event.preventDefault();resume();});
  const mapping={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'up',ShiftLeft:'boost',ShiftRight:'boost',KeyR:'reset'};
  document.addEventListener('keydown',event=>{
    if(event.code==='Escape'){event.preventDefault();if(state==='riding')pause();else if(state==='paused'||state==='map')resume();return;}
    if(['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(event.target?.tagName))return;
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
  window.addEventListener('blur',()=>{if(state==='riding')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='riding')pause();last=0;});
  window.addEventListener('resize',()=>{resizePending=true;touch.reset();cameraControls.resetInput();clear(lookKeys);clear(keys);clear(padKeys);entity.clearInput();if(state==='map')mapDrawing();});
  $('build').textContent=`Build ${document.querySelector('[name=euc-build]').content} · ${renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2'} · Cool Rider`;
  stage('Compiling the first view…',.85);resize();entity.prepareView();updateCamera(0,true);
  // Life gathers round the spawn; every actor pool draws at least one instance while the city compiles.
  life.focus(entity,camera);life.warm(true);try{await compileWholeCity();}finally{life.warm(false);}
  stage('Finishing the first frame…',.95);draw(performance.now(),0,true);await waitForRenderCompletion(renderer);
  stage('Warming the riding view…',.97);await warmRidingView();
  $('loading').hidden=true;$('title').hidden=false;gate('title');$('ride').focus();renderer.setAnimationLoop(tick);
  // Page lifecycle retains BFCache state; terminal Retry is a full reload. No pagehide renderer destruction.
  window.addEventListener('pagehide',()=>{gate(['riding','map'].includes(state)?'paused':state);last=0;});
  window.addEventListener('pageshow',e=>{if(!e.persisted)return;gate(state);last=0;resizePending=true;
    if(state==='paused'){if($('map').open)$('map').close();if(!$('pause').open)$('pause').showModal();$('resume').focus();}
    else if(state==='title')$('ride').focus();else if(state==='error')$('retry').focus();});
}
await boot().catch(error=>{if(!fallback('startup'))failure(error);});
