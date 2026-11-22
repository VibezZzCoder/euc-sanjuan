/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// San Juan riding/inspection camera — © 2026 VibezZzCoder, MIT.
// Presentation only: reads the rider's interpolated pose and the world's queries, never writes to the controller.
//
// Third-person rig: a smoothed pivot at the rider's chest, a spherical offset (yaw, pitch, distance) and a look target
// slightly above and ahead of the rider. The yaw follows the rider's heading through a filter: held in the air and while
// down, handed back gradually after landing or getting up, and along the travel when riding backward fast.
// Collision: five solid rays (centre plus four whiskers, so a lone post or trunk does not make it pulse), a floor /
// ceiling / sea profile along the boom, the lens point and its footprint (the masses beside a bore are terrain, not
// colliders), a look-ahead from where the rider will be, and tree crowns from a baked list. The lens is cut in only when
// it would otherwise be inside a solid or the ground; every other obstruction springs the boom in over a few frames.
// Springs are critically damped and integrated exactly, so any frame time (1/144 s … 1/4 s) is stable.
import * as THREE from 'three/webgpu';
import {CROWNS} from './sj-camera-crowns-bake.js';

export const CAMERA_VIEWS=['chase','wide','look'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const ease=(rate,dt)=>1-Math.exp(-rate*dt);
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
// Exact critically damped step toward `target` (any dt is stable). Returns [x, v].
const SPRING=[0,0];
const LOOK_SLOP=8; // CSS px a touch must travel before it turns the view
export function springStep(x,v,target,w,dt){
  const e=x-target,c=v+w*e,k=Math.exp(-w*dt),a=e+c*dt;SPRING[0]=target+a*k;SPRING[1]=(c-w*a)*k;return SPRING;
}

// Resting presets: boom length (m) and elevation (rad) behind the rider. Chase keeps the old framing's height and
// reach (≈ 6 m back, 1.6 m above the chest); Wide is the old elevated inspection view.
export const CAMERA_PRESETS={chase:{distance:6,pitch:.27},wide:{distance:13.5,pitch:.5},look:{distance:0,pitch:0}};
export const CAMERA_TUNING={
  pivotHeight:1.35,        // chest; the rig is ~1.75 m tall
  lensClearance:.3,        // lens kept this far from walls/ground/ceilings (near plane is 0.15 m)
  whisker:.34,             // whisker spread at the lens end (m)
  whiskerRoot:.1,          // and at the pivot
  minDistance:.45,closest:.12,
  showAbove:1.1,hideAxis:.6,showAxis:.72, // m: a boom shorter than showAbove re-extends briskly; hide/show by lens-to-rider-axis distance
  pullIn:12,easeOut:2.4,clearHold:.3,
  boomAccel:240,           // m/s² cap on boom length changes (×2.5 when a wall is already between pivot and lens)
  yawRate:[1.4,5.2],       // heading follow rate (1/s) standing → riding fast
  yawAccel:6,              // rad/s² cap on the boom's swing (a long Wide boom amplifies it)
  handover:.4,             // s to hand the heading back after the air or a crash
  idleReturn:1.6,returnRate:1.5,lostReturn:.15,lostOrbitRate:5.5,
  shoulderPitch:.5,        // extra elevation when there is no room behind the rider
  lookAhead:[.25,.5],      // s of travel the boom checks ahead of the rider (porticos, overhangs), along its curve
  boomRetract:5,planSpeed:45, // m/s           // m/s the boom is planned to retract at when something is predicted ahead (time to contact)
  orbitRate:4,orbitAccel:25, // rad/s and rad/s² for the applied orbit (it slows to what the boom can retract for)
  arcRetract:5,arcPlan:10,  // m/s: the boom's assumed retraction for the orbit's rate; its planned pull-in speed
  orbitHoldMax:.25,         // s the orbit may wait for the boom to retract before it turns again regardless
  baseFov:62,portraitHfov:46,maxFov:76,
  maxDt:.25,
};

const DIRS=4,CELL=16;
export class RidingCamera {
  constructor(onChange=()=>{}) {
    this.onChange=onChange;this.mode='chase';this.pointers=new Map();
    this.zooms={chase:CAMERA_PRESETS.chase.distance,wide:CAMERA_PRESETS.wide.distance,look:CAMERA_TUNING.baseFov};
    const V=()=>new THREE.Vector3();
    this.pivot=V();this.target=V();this.dir=V();this.right=V();this.up=V();this.lens=V();this.vel=V();this.lastPos=V();
    this._o=V();this._d=V();this._p=V();this._q=V();this._w=V();this._r=V();this.offset=V();this._probe={normal:{}};this._hits=new Float64Array(DIRS+1);
    this._around={floor:0,roof:0};this._space={floor:0,roof:0};this._cam=V();this._ap=V();this._oq=V();this.nearPush=V();
    this.yaw=0;this.actual=CAMERA_PRESETS.chase.distance;this.distanceVelocity=0;this.clearFor=0;this.slope=0;this.grade=0;this.slopeV=0;this.gradeV=0;
    this.roofPitch=1.4;this.roofPitchV=0;this.shoulder=0;this.shoulderWanted=0;this.probeClock=0;this.reverse=false;this.idle=99;this.serial=undefined;
    this.riderHidden=false;this.pivotVelocity=0;this.last=new THREE.Vector3(NaN,NaN,NaN);this.stats={rays:0,samples:0};
    this.handover=1;this.yawV=0;this.closeBlend=0;this.swing=0;this.prevYaw=0;this.tilt=0;this.crownTime=0;this.crownLimit=Infinity;this.crownPitch=0;this.crownPitchV=0;this.crownPitchWant=0;this.crownClock=0;this.ahead=null;this.aheadClock=0;
    this.safe={top:1,bottom:-1};this.safeDirty=true;this.hRate=0;this.prevHeading=0;this.aheadFar=false;this.aheadVals=[Infinity,Infinity];
    this.resetOrbit();this.orbitShown=0;this.orbitV=0;this.pitchShown=this.pitch;this.pitchSV=0;this.lengthShown=this.distance;this.lengthV=0;
    this.arcSoft=Infinity;this.orbitHold=0;this.lastPitchUse=this.pitch;this.boomClear=Infinity;
  }
  setMode(mode) {
    if(!CAMERA_VIEWS.includes(mode))return;
    // Chase ↔ Wide glide (orbit, pitch and boom length follow smoothly, collisions included); Look-around jumps.
    const prev=this.mode;this.storeZoom();this.mode=mode;this.resetInput();this.orbit=0;this.pitch=CAMERA_PRESETS[mode].pitch;this.loadZoom();
    this.snap=mode==='look'||prev==='look';this.onChange(mode);
  }
  cycle(){this.setMode(CAMERA_VIEWS[(CAMERA_VIEWS.indexOf(this.mode)+1)%CAMERA_VIEWS.length]);}
  storeZoom(){this.zooms[this.mode]=this.mode==='look'?this.fov:this.distance;}
  loadZoom(){const z=this.zooms[this.mode];if(this.mode==='look'){this.fov=z;this.distance=CAMERA_PRESETS.chase.distance;}else{this.distance=z;this.fov=CAMERA_TUNING.baseFov;}}
  // Center: behind the rider at the selected view's resting framing and zoom.
  resetOrbit(){
    this.orbit=0;this.pitch=CAMERA_PRESETS[this.mode].pitch;
    this.zooms[this.mode]=this.mode==='look'?CAMERA_TUNING.baseFov:CAMERA_PRESETS[this.mode].distance;this.loadZoom();this.snap=this.mode==='look';
  }
  turn(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(x||y)this.idle=0;
    // Turning back drops a turn still pending (the applied orbit waiting for the boom): the view reverses at once.
    if(x&&this.mode!=='look'&&this.orbitShown!==undefined){const pend=wrap(this.orbit-this.orbitShown);if(pend*-x<0&&Math.abs(pend)>.02)this.orbit=this.orbitShown;}
    this.orbit=wrap(this.orbit-x);this.pitch=clamp(this.pitch+(this.mode==='look'?-y:y),this.mode==='look'?-1.2:-.05,1.3);
  }
  zoom(amount){if(!Number.isFinite(amount))return;if(this.mode==='look')this.fov=clamp(this.fov+amount*3,40,85);else this.distance=clamp(this.distance+amount,3,24);this.storeZoom();}
  applyGamepadInput(x,y,zoom,dt){this.turn(x*dt*1.8,y*dt);if(zoom)this.zoom(zoom*dt*8);}
  resetInput(){
    const ids=[...this.pointers.keys()];this.pointers.clear();
    for(const id of ids)if(this.canvas?.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
  }
  // Screen region the rider (wheel to head) should stay inside, in NDC y: below the HUD and above the touch buttons.
  setSafeArea(top=1,bottom=-1){this.safe.top=clamp(top,-1,1);this.safe.bottom=clamp(bottom,-1,this.safe.top-.2);}
  // Reads the real HUD and touch-button rectangles (those over the middle of the screen, where the rider is drawn).
  measureSafeArea(){
    const c=this.canvas,doc=c?.ownerDocument;if(!doc)return;const r=c.getBoundingClientRect();if(!(r.height>0))return;
    const ndc=y=>1-2*(y-r.top)/r.height,mid0=r.left+r.width*.3,mid1=r.left+r.width*.7;let top=1,bottom=-1;
    const visible=e=>e&&!e.closest('[hidden]')&&e.getClientRects().length>0;
    for(const e of doc.querySelectorAll('#hud,#ride-status')){if(!visible(e))continue;const b=e.getBoundingClientRect();if(b.bottom<r.top+r.height*.4)top=Math.min(top,ndc(b.bottom));}
    // The floating stick is not measured: it appears under the thumb, and treating it as an obstacle tilted the view the
    // moment a thumb touched the screen.
    for(const e of doc.querySelectorAll('#touch-controls button')){if(!visible(e))continue;const b=e.getBoundingClientRect();
      if(b.right>mid0&&b.left<mid1&&b.top>r.top+r.height*.5)bottom=Math.max(bottom,ndc(b.top));}
    this.setSafeArea(top,bottom);
  }
  bind(canvas,enabled) {
    this.canvas=canvas;this.watchLayout(canvas);
    canvas.addEventListener('pointerdown',e=>{
      if(!enabled()||e.button!==0||this.pointers.size>=2)return;
      e.preventDefault();canvas.focus({preventScroll:true});
      // A finger settles before it drags: a touch turns the view only after it has moved LOOK_SLOP px from where it landed.
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,armed:e.pointerType!=='touch'});
      try{canvas.setPointerCapture(e.pointerId);}catch{/* the pointer ended already: window-less capture is optional */}
    });
    canvas.addEventListener('pointermove',e=>{
      const point=this.pointers.get(e.pointerId);if(!point||!enabled())return;
      if(this.pointers.size===2){
        const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)[1];
        const before=Math.hypot(point.x-other.x,point.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);
        this.zoom((before-after)*.035);
      }else if(point.armed)this.turn((e.clientX-point.x)*.006,(e.clientY-point.y)*.005);
      else{const dx=e.clientX-point.x0,dy=e.clientY-point.y0,d=Math.hypot(dx,dy);
        // Crossing the slop: only the first LOOK_SLOP px are spent; the rest of this move already turns the view.
        if(d>=LOOK_SLOP){point.armed=true;const k=LOOK_SLOP/d;this.turn((dx-dx*k)*.006,(dy-dy*k)*.005);}}
      point.x=e.clientX;point.y=e.clientY;
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>this.pointers.delete(e.pointerId));
    canvas.addEventListener('wheel',e=>{if(!enabled())return;e.preventDefault();this.zoom(clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1),-200,200)*.01);},{passive:false});
  }

  // Re-measure the safe area only when the layout can have changed: element sizes (resize observer, called after
  // layout), visibility/classes of the HUD and touch controls, the body state (camera tools, riding/paused), rotation.
  watchLayout(canvas){
    const doc=canvas.ownerDocument,view=doc?.defaultView;if(!doc||!view)return;const dirty=()=>{this.safeDirty=true;};
    const els=()=>[canvas,...doc.querySelectorAll('#hud,#ride-status,#touch-controls,#touch-controls button')];
    if(view.ResizeObserver){this._layoutRO=new view.ResizeObserver(()=>{this.safeDirty=false;this.measureSafeArea();});for(const e of els())this._layoutRO.observe(e);}
    if(view.MutationObserver){this._layoutMO=new view.MutationObserver(dirty);this._layoutMO.observe(doc.body,{attributes:true,attributeFilter:['class','data-state']});
      for(const e of els())this._layoutMO.observe(e,{attributes:true,attributeFilter:['hidden','class','style']});}
    view.addEventListener('resize',dirty);view.addEventListener('orientationchange',dirty);
  }
  // ---- World queries (cheap, bounded per frame) ----
  solid(world,o,d,length){this.stats.rays++;const h=world.sampler.raycast(o,d,length,true);return Number.isFinite(h)?h:Infinity;}
  // Boom profile samples move a few centimetres per frame: reuse them from a small bounded cache, evaluated at the
  // centre of a 0.25 m × 0.5 m cell so the result is a pure function of the cell (deterministic at any frame rate).
  spaceCached(world,x,y,z){
    if(this.cacheWorld!==world){this.cacheWorld=world;this.cache=new Map();}
    const i=Math.round(x*4),j=Math.round(y*2),k=Math.round(z*4),key=((i*73856093)^(j*19349663)^(k*83492791))*4096+((i&15)<<8|(j&15)<<4|(k&15));
    let v=this.cache.get(key);
    if(!v||v.i!==i||v.j!==j||v.k!==k){if(this.cache.size>4096)this.cache.clear();const r=this.space(world,i/4,j/2,k/4);v={i,j,k,floor:r.floor,roof:r.roof};this.cache.set(key,v);}
    return v;
  }
  // Floor, ceiling and sea under a point at its own height (bores and arcades report their replacement floor/roof).
  // A "floor" above the point means the point is inside a mass (the wall beside a bore is terrain, not a collider).
  space(world,x,y,z){
    this.stats.samples++;const s=world.sampler,g=s.cityGround?s.cityGround(x,z,this._probe,y):null,out=this._space;
    if(!g){out.floor=world.height(x,z);out.roof=Infinity;return out;}
    const roof=g.support?.ceiling??(g.support?.ceilingOffset?g.height+g.support.ceilingOffset:Infinity);
    out.floor=g.offCourse?(g.water?s.waterLevel??0:-Infinity):g.height;out.roof=Number.isFinite(roof)&&roof>g.height?roof:Infinity;return out;
  }
  open(world,x,y,z,margin=0){const s=this.space(world,x,y,z);return y>=s.floor+margin&&y<=s.roof-margin;}
  // Longest clear boom (≤ length) from `pivot` along `dir`: soft ignores one blocked ray (a post or trunk); hard needs
  // three agreeing rays (a wall); sight is where the floor/ceiling/sea profile is crossed (a crest, a lintel, a roof).
  reach(world,pivot,dir,length,out={},lensAt=length){
    const T=CAMERA_TUNING,c=T.lensClearance,o=this._o,d=this._d,hits=this._hits;
    this.right.set(dir.z,0,-dir.x);if(this.right.lengthSq()<1e-6)this.right.set(1,0,0);this.right.normalize();
    this.up.crossVectors(this.right,dir).normalize();
    hits[0]=this.solid(world,pivot,dir,length+c);
    for(let i=0;i<DIRS;i++){
      const axis=i<2?this.right:this.up,sign=i%2?-1:1;
      o.copy(pivot).addScaledVector(axis,sign*T.whiskerRoot);
      d.copy(pivot).addScaledVector(dir,length).addScaledVector(axis,sign*T.whisker).sub(o);
      const L=d.length();hits[i+1]=this.solid(world,o,d.divideScalar(L),L+c)*length/L;
    }
    // A wall or slab blocks the boom across its width (two of centre/left/right) and its height (two of centre/up/down);
    // a post or trunk only blocks a vertical line of rays, a rail or lintel edge a horizontal one: those are ignored.
    const mid2=(a,b,c)=>Math.max(Math.min(a,b),Math.min(Math.max(a,b),c));
    let hard=Math.max(mid2(hits[0],hits[1],hits[2]),mid2(hits[0],hits[3],hits[4]))-c,soft=hard;
    // Any ray blocked near the lens end (a wall edge sliding in from the side): start the pull-in early.
    const near=Math.min(length,lensAt);
    for(let i=0;i<=DIRS;i++){const h=hits[i];if(h>near*.6&&h<hard+c)soft=Math.min(soft,h-c);}
    // Profile: every ≤ 0.6 m along the boom, at the boom's own height. Leaving a roofed stretch above its roof means
    // crossing the mass over a portal; a step (portal face, wall top) stops at the last clear sample.
    const n=clamp(Math.ceil(length/.6),3,24);let prevMargin=Infinity,prevRoof=Infinity,sight=Infinity;
    for(let i=1;i<=n;i++){
      const f=length*i/n,p=this._p.copy(pivot).addScaledVector(dir,f),sp=this.spaceCached(world,p.x,p.y,p.z);
      let margin=Math.min(p.y-(sp.floor+c),sp.roof-c-p.y);
      if(Number.isFinite(prevRoof)&&!Number.isFinite(sp.roof))margin=Math.min(margin,prevRoof-c-p.y);
      if(margin<0){let lo=length*(i-1)/n,hi=f;
        // A face (portal, bore side wall, wall top): find it between the samples (a long boom samples coarsely, and
        // the first sample may already be inside the mass beside a bore); a gentle slope: interpolate.
        if(!Number.isFinite(prevMargin)||prevMargin-margin>.6){
          for(let k=0;k<4;k++){const m=(lo+hi)/2,q=this._p.copy(pivot).addScaledVector(dir,m),s=this.space(world,q.x,q.y,q.z);
            if(Math.min(q.y-(s.floor+c),s.roof-c-q.y)>=0)lo=m;else hi=m;}
          sight=lo;}
        else sight=lo+(f-lo)*prevMargin/(prevMargin-margin);
        break;}
      prevMargin=margin;prevRoof=sp.roof;
    }
    soft=Math.min(soft,sight-.25);
    out.soft=Math.max(0,Math.min(soft,hard));out.hard=Math.max(0,hard);out.sight=Math.max(0,sight);return out;
  }
  boom(yaw,pitch,out){const cp=Math.cos(pitch);return out.set(-Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp);}

  // ---- Tree crowns (camera-only ellipsoids, js/sj-camera-crowns-bake.js) ----
  crownGrid(){
    if(this._crowns)return this._crowns;const g=new Map();
    for(let i=0;i<CROWNS.length;i+=5){const x=CROWNS[i],z=CROWNS[i+2],r=CROWNS[i+3];
      for(let cx=Math.floor((x-r)/CELL);cx<=Math.floor((x+r)/CELL);cx++)for(let cz=Math.floor((z-r)/CELL);cz<=Math.floor((z+r)/CELL);cz++){
        const k=cx*100003+cz;let a=g.get(k);if(!a)g.set(k,a=[]);a.push(i);}}
    return this._crowns=g;
  }
  // Does the segment a→b pass through any crown?
  crownBlocks(a,b){
    const g=this.crownGrid(),x0=Math.floor(Math.min(a.x,b.x)/CELL),x1=Math.floor(Math.max(a.x,b.x)/CELL),z0=Math.floor(Math.min(a.z,b.z)/CELL),z1=Math.floor(Math.max(a.z,b.z)/CELL);
    for(let cx=x0;cx<=x1;cx++)for(let cz=z0;cz<=z1;cz++){const list=g.get(cx*100003+cz);if(!list)continue;
      for(const i of list){const rx=CROWNS[i+3],ry=CROWNS[i+4];
        // Segment against the ellipsoid, scaled to a unit sphere.
        const ox=(a.x-CROWNS[i])/rx,oy=(a.y-CROWNS[i+1])/ry,oz=(a.z-CROWNS[i+2])/rx,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry,dz=(b.z-a.z)/rx;
        const A=dx*dx+dy*dy+dz*dz,B=ox*dx+oy*dy+oz*dz,C=ox*ox+oy*oy+oz*oz-1;if(C<0)return true;
        const disc=B*B-A*C;if(disc<0||A<1e-12)continue;const t=(-B-Math.sqrt(disc))/A;if(t>=0&&t<=1)return true;}}
    return false;
  }
  insideCrown(q){return this.crownBlocks(q,q);}
  // Rider points (wheel, chest, head) hidden from `lens` by crowns.
  crownHidden(lens,p){let n=0;const q=this._q;for(const y of [.3,1.05,1.6]){q.set(p.x,p.y+y,p.z);if(this.crownBlocks(lens,q))n++;}return n;}

  update(camera,entity,world,dt,snap=false) {
    const T=CAMERA_TUNING,p=entity.position,pose=entity.pose??{},c=entity.controller;
    dt=Number.isFinite(dt)?clamp(dt,0,T.maxDt):0;
    const serial=c?.placementSerial;
    // Teleports, rescues and resumes start a fresh view instead of sweeping across the city.
    const jump=this.last.distanceToSquared(p);
    if(!(jump<64)||serial!==this.serial&&!(jump<9))snap=true;
    this.serial=serial;this.last.copy(p);
    snap||=this.snap;this.snap=false;
    const look=this.mode==='look';
    // FOV: 62° in landscape; portrait widens toward a 46° horizontal view (capped) so the road ahead stays visible.
    const aspect=camera.aspect||1,hfovFloor=2*Math.atan(Math.tan(T.portraitHfov*Math.PI/360)/aspect)*180/Math.PI;
    const base=clamp(Math.max(T.baseFov,hfovFloor),T.baseFov,T.maxFov),fov=look?clamp(this.fov*base/T.baseFov,30,95):base;
    if(Math.abs(camera.fov-fov)>1e-6){camera.fov=fov;camera.updateProjectionMatrix();}
    const portrait=aspect<.9;
    // Layout is read only when it may have changed (observers below); a resize observer reads it after layout.
    if(this.canvas&&this.safeDirty){this.safeDirty=false;this.measureSafeArea();}

    // Travel velocity in plan from the rendered positions (continuous through spins, unlike heading × signed speed).
    if(snap||!(dt>0)){if(snap)this.vel.set(Math.sin(entity.heading),0,Math.cos(entity.heading)).multiplyScalar(entity.speed??0);}
    else{this._w.set((p.x-this.lastPos.x)/dt,0,(p.z-this.lastPos.z)/dt);if(this._w.lengthSq()<900)this.vel.lerp(this._w,ease(10,dt));}
    this.lastPos.copy(p);
    // Heading filter. In the air (spins) and while down the view holds; afterwards it is handed back over `handover`
    // seconds. Backward faster than walking pace keeps the view along the travel; slow backing up stays behind the back.
    const speed=entity.speed??0,air=!!c?.airborne||(pose.airHeight??0)>.03,down=!!c?.crashed||(pose.crashBlend??0)>.01,hold=air||down;
    this.handover=snap?1:hold?0:Math.min(1,this.handover+dt/T.handover);
    if(!hold){const f=this._r.set(Math.sin(entity.heading),0,Math.cos(entity.heading)),v=this.vel.length(),along=this.vel.dot(f);
      if(!this.reverse&&v>1.6&&along<-.5*v)this.reverse=true;else if(this.reverse&&(v<.6||along>.2*v))this.reverse=false;}
    const heading=entity.heading+(this.reverse?Math.PI:0);
    const rate=(T.yawRate[0]+(T.yawRate[1]-T.yawRate[0])*clamp(Math.abs(speed)/7,0,1))*smooth(this.handover);
    // Second order (critically damped): starting or stopping a turn never jumps the boom's swing speed. Held: coast to a stop.
    if(snap){this.yaw=heading;this.yawV=0;}
    else if(rate>0){const [,vs]=springStep(0,this.yawV,wrap(heading-this.yaw),rate*1.6,dt),a=T.yawAccel*dt;
      const v1=this.yawV+clamp(vs-this.yawV,-a,a);this.yaw=wrap(this.yaw+(this.yawV+v1)/2*dt);this.yawV=v1;}
    else{const k=Math.exp(-8*dt);this.yaw=wrap(this.yaw+this.yawV*(1-k)/8);this.yawV*=k;}
    // Manual orbit holds while the player steers it; after a short idle while riding it eases back behind.
    if(this.pointers.size)this.idle=0;else this.idle+=dt;
    // Riding with the rider hidden (the boom pinned short by a face ahead or beside): return behind sooner and faster
    // (the trailing side is where the rider just rode through), through the side with more room (sampled once).
    const lost=this.riderHidden&&Math.abs(speed)>1,returning=!look&&!snap&&lost&&this.idle>T.lostReturn;
    if(returning){const o=this.orbitShown??0;
      if(!this.lostReturning){const span=s=>{const r=wrap(-o);return r*s>=0?Math.abs(r):2*Math.PI-Math.abs(r);};
        const room=s=>{let m=Infinity;for(const f of [.25,.5,.75]){const r=this.reach(world,this.pivot,this.boom(this.yaw+o+s*f*span(s),this.lastPitchUse,this._oq),3,this._rarc??={});m=Math.min(m,r.hard,r.sight);}return m;};
        const a=room(1),b=room(-1),short=wrap(-o)>=0?1:-1;this.lostSide=Math.abs(a-b)<.2?short:a>b?1:-1;}
      let rem=wrap(-o);if(rem*this.lostSide<0)rem+=this.lostSide*2*Math.PI;
      this.orbit=wrap(o+this.lostSide*Math.min(1.5,Math.abs(rem)));this.pitch+=(CAMERA_PRESETS[this.mode].pitch-this.pitch)*ease(T.returnRate*6,dt);}
    else if(!look&&this.idle>T.idleReturn&&Math.abs(speed)>1){const k=ease(T.returnRate,dt);
      this.orbit-=wrap(this.orbit)*k;this.pitch+=(CAMERA_PRESETS[this.mode].pitch-this.pitch)*k;}
    this.lostReturning=returning;

    // Pivot: exact in plan, vertically a critically damped follow (stairs, kerbs, hops); ±1 m is only a safety bound.
    const want=p.y+(look?1.65:T.pivotHeight);
    if(snap){this.pivot.set(p.x,want,p.z);this.pivotVelocity=0;}
    else{const [y,v]=springStep(this.pivot.y,this.pivotVelocity,want,air?7:11,dt);
      const yc=clamp(y,want-1,want+1);this.pivotVelocity=yc===y?v:0;this.pivot.set(p.x,yc,p.z);}

    // The applied orbit, pitch and boom length follow the player's settings (mode changes, Center, zoom glide).
    if(snap||look){this.orbitShown=this.orbit;this.orbitV=0;this.pitchShown=this.pitch;this.pitchSV=0;this.lengthShown=this.distance;this.lengthV=0;this.arcSoft=Infinity;}
    else{[this.pitchShown,this.pitchSV]=springStep(this.pitchShown,this.pitchSV,this.pitch,8,dt);
      [this.lengthShown,this.lengthV]=springStep(this.lengthShown,this.lengthV,this.distance,6,dt);this.orbitStep(world,dt);}
    if(look){this._lookDt=snap?0:dt;return this.updateLook(camera,entity,world);}

    // Slope: descending raises the boom (keeps the rider and the road below in view), climbing lowers it a little.
    const n=c?.ground?.normal,yawCam=this.yaw+this.orbitShown;
    const grade=n&&n.y>.2?-(n.x*Math.sin(this.yaw)+n.z*Math.cos(this.yaw))/n.y:0;
    const slopeWant=hold?this.slope:clamp(-grade*.6,-.1,.3);
    const gradeWant=hold?this.grade:clamp(grade,-.8,.8);
    // Critically damped (no velocity jumps from paving facets; a long Wide boom would amplify them).
    if(snap){this.slope=slopeWant;this.slopeV=0;this.grade=gradeWant;this.gradeV=0;}
    else{[this.slope,this.slopeV]=springStep(this.slope,this.slopeV,slopeWant,4,dt);[this.grade,this.gradeV]=springStep(this.grade,this.gradeV,gradeWant,4,dt);}
    const pitchBase=clamp(this.pitchShown+this.slope+(portrait?.05:0),-.1,1.35);

    // Over-the-shoulder rise when there is no room behind (decided on the resting boom, re-checked every 50 ms).
    const length=this.lengthShown;
    const tight=!this.lastReach||this.lastReach.hard<length*.6||this.shoulderWanted>0;
    this.probeClock+=dt;
    if(snap||tight&&this.probeClock>=.05){this.probeClock=0;
      const rb=this.reach(world,this.pivot,this.boom(yawCam,pitchBase,this._q),length,this._rb??={});
      if(rb.hard<length*.55&&this.shoulderWanted===0){
        const ro=this.reach(world,this.pivot,this.boom(yawCam,clamp(pitchBase+T.shoulderPitch,-.1,1.4),this._q),length,this._ro??={});
        if(ro.hard>rb.hard+1)this.shoulderWanted=T.shoulderPitch;
      }else if(this.shoulderWanted>0&&rb.hard>=length*.75)this.shoulderWanted=0;
    }
    this.shoulder=snap?this.shoulderWanted:this.shoulder+(this.shoulderWanted-this.shoulder)*ease(2.5,dt);
    // Under a roof (bores, arcades) the boom flattens so the lens runs below the ceiling instead of along its facets.
    const roofP=this.spaceCached(world,this.pivot.x,this.pivot.y,this.pivot.z).roof;
    const cap=Number.isFinite(roofP)?Math.asin(clamp((roofP-this.pivot.y-T.lensClearance-.25)/Math.max(1,length),-.1,1)):1.4;
    const pitchWant=clamp(pitchBase+this.shoulder,-.1,1.4),capWant=Math.min(cap,pitchWant);
    this.roofPitch=snap?capWant:this.roofPitch+(capWant-this.roofPitch)*ease(capWant<this.roofPitch?6:2,dt);
    // The canopy lowering (decided below, from the previous frames) is integrated with this frame's dt before use.
    if(snap)this.crownPitch=this.crownPitchWant;else{[this.crownPitch,this.crownPitchV]=springStep(this.crownPitch,this.crownPitchV,this.crownPitchWant,5,dt);}
    const pitchUse=Math.max(-.1,Math.min(pitchWant,this.roofPitch)+this.crownPitch);
    const dir=this.boom(yawCam,pitchUse,this.dir),r=this.reach(world,this.pivot,dir,length,this._reach??={},this.actual);
    this.boomClear=Math.min(r.soft,r.hard,r.sight-.25);   // the present boom's own limit (edge warnings included)
    // The boom is still flattening toward the roof cap: the lower boom must be clear too.
    if(!snap&&pitchUse-capWant>.03){const rc=this.reach(world,this.pivot,this.boom(yawCam,capWant,this._q),length,this._rc??={});r.soft=Math.min(r.soft,rc.hard,rc.sight-.25);}
    // Anticipate the swing: where the boom is turning to (heading follow and manual orbit) must be clear too
    // (tight streets, corners, a fast drag toward a wall).
    const ahead=wrap(heading-this.yaw);
    this.swing=snap||!(dt>0)?0:this.swing+(wrap(yawCam-this.prevYaw)/dt-this.swing)*ease(12,dt);this.prevYaw=yawCam;
    const lead=clamp(this.swing*.35+(rate>0?ahead*.6:0),-1.2,1.2);
    if(!snap&&Math.abs(lead)>.15){
      for(const f of Math.abs(lead)>.4?[.5,1]:[1]){
        const rp=this.reach(world,this.pivot,this.boom(yawCam+lead*f,pitchUse,this._q),length,this._rp??={},this.actual);r.soft=Math.min(r.soft,rp.hard+.2,rp.sight);}
    }
    // Anticipate travel: the boom from where the rider will be at 0.25 and 0.5 s along the current curve (speed and
    // turn rate), only where the rider can get to (no wall on the way). Time to contact: a limit first seen at a horizon
    // may arrive any time after the nearer horizon, so it allows the boom `boomRetract`·(nearer horizon) of slack now:
    // a far false alarm costs little, a near one is taken seriously.
    this.hRate=snap||!(dt>0)?0:this.hRate+(clamp(wrap(entity.heading-this.prevHeading)/dt,-3,3)-this.hRate)*ease(8,dt);this.prevHeading=entity.heading;
    const v=this.vel.length();this.aheadClock-=dt;
    if(snap||v<1.2){this.aheadVals.fill(Infinity);this.aheadFar=false;}
    else{const i=this.aheadClock<=0&&!this.aheadFar?1:0;this.aheadFar=i===1;if(i)this.aheadClock=1/30;
      // One horizon per update (cost): the farther at 30 Hz, never twice in a row, the nearer on every other update;
      // the one not refreshed keeps its value for that update. The boom there keeps today's pitch unless a roof
      // ahead flattens it (after a roof it only rises slowly) and turns at the camera's own yaw rate.
      const h=T.lookAhead[i],wr=this.hRate,a0=Math.atan2(this.vel.x,this.vel.z);
      const dx=Math.abs(wr)>1e-3?v*(Math.cos(a0)-Math.cos(a0+wr*h))/wr:v*Math.sin(a0)*h,dz=Math.abs(wr)>1e-3?v*(Math.sin(a0+wr*h)-Math.sin(a0))/wr:v*Math.cos(a0)*h;
      const L=Math.hypot(dx,dz);let val=Infinity;
      if(L>.05&&this.solid(world,this.pivot,this._d.set(dx/L,0,dz/L),L+.5)>L+.5-1e-6){
        // At the ground there (stairs and slopes ahead), within a step of today's level.
        this._ap.set(this.pivot.x+dx,this.pivot.y,this.pivot.z+dz);const s0=this.space(world,this._ap.x,this._ap.y,this._ap.z),floor=s0.floor,roofA=s0.roof;
        const ground=this.pivot.y-T.pivotHeight;if(Number.isFinite(floor)&&Math.abs(floor-ground)<1.5)this._ap.y=floor+T.pivotHeight;
        // The rider's body needs room there: a predicted pivot within 0.3 m of a solid is a deflection, not a pass.
        let room=true;for(const [ax,az] of [[1,0],[-1,0],[0,1],[0,-1]])if(room&&this.solid(world,this._ap,this._d.set(ax,0,az),.3)<.3)room=false;
        if(room&&Math.abs(floor-ground)<1.5&&roofA>this._ap.y){
          const capA=Number.isFinite(roofA)?Math.asin(clamp((roofA-this._ap.y-T.lensClearance-.25)/Math.max(1,length),-.1,1)):1.4;
          const ra=this.reach(world,this._ap,this.boom(yawCam+clamp(this.yawV*h,-1,1),Math.min(pitchUse,capA),this._r),length,this._ra??={});
          // An edge (a slab, a lintel) arrives all at once somewhere within the horizon: the slack is the nearer horizon's.
          val=Math.min(ra.hard,ra.sight-.25)+T.boomRetract*(i>0?T.lookAhead[i-1]:0);}}
      this.aheadVals[i]=val;}
    r.soft=Math.min(r.soft,...this.aheadVals,this.arcSoft);
    // Crowns: when two of the rider's three points stay hidden behind foliage, first lower the boom under the canopy
    // (the lens stays outside it), else shorten to a lens position outside every crown. Never rest inside a crown.
    this.crownClock-=dt;
    if(snap||this.crownClock<=0){this.crownClock=.1;
      this._cam.copy(this.pivot).addScaledVector(dir,this.actual);
      const hidden=this.riderHidden?0:this.crownHidden(this._cam,p);
      this.crownTime=hidden>=2?this.crownTime+.1:Math.max(0,this.crownTime-.05);
      if(this.crownTime>.15){let found=false;
        const base=pitchUse-this.crownPitch;
        for(const dp of [-.15,-.3,-.45,-.6]){const pt=Math.max(-.08,base+dp);if(pt-base>this.crownPitchWant-.01)continue;
          const bd=this.boom(yawCam,pt,this._ap);this._cam.copy(this.pivot).addScaledVector(bd,this.actual);
          if(!this.insideCrown(this._cam)&&this.crownHidden(this._cam,p)<2&&this.open(world,this._cam.x,this._cam.y,this._cam.z,T.lensClearance)
            &&this.solid(world,this.pivot,bd,this.actual+T.lensClearance)>this.actual+T.lensClearance-.01){this.crownPitchWant=pt-base;found=true;break;}}
        if(!found){let d=this.actual;
          while(d>2.5){d=Math.max(2.5,d-.75);this._cam.copy(this.pivot).addScaledVector(dir,d);if(!this.insideCrown(this._cam)&&this.crownHidden(this._cam,p)<2)break;}
          this.crownLimit=Math.min(this.crownLimit,d);}}
      else if(this.crownTime===0&&(this.crownPitchWant<0||Number.isFinite(this.crownLimit))){
        // Release only when the resting boom would see the rider again (no flip-flop under the canopy).
        this._cam.copy(this.pivot).addScaledVector(this.boom(yawCam,pitchUse-this.crownPitch,this._q),length);
        let swept=this.crownHidden(this._cam,p)<2;
        for(const f of [.33,.66])if(swept){this._cam.copy(this.pivot).addScaledVector(this.boom(yawCam,pitchUse-this.crownPitch*f,this._q),this.actual);swept=!this.insideCrown(this._cam);}
        if(swept){this.crownLimit=Infinity;this.crownPitchWant=0;}}}
    r.soft=Math.min(r.soft,this.crownLimit);
    this.lastReach=r;this.lastPitchUse=pitchUse;

    // The boom's shortest length: minDistance, or less (down to `closest`, the rider hidden) where a solid is nearer than
    // that at this angle (the rider against a wall): an orbit can always pass, the lens never enters the wall.
    const low=this.low=Math.max(T.closest,Math.min(T.minDistance,r.hard));
    const hard=clamp(r.hard,low,length),soft=clamp(r.soft,low,length),cl=T.lensClearance;
    // Distance: a wall between pivot and lens springs the boom in fast; it is cut only when the lens would be inside a
    // solid. A blocked sightline springs in; clear space waits, then eases out. No velocity jumps.
    if(snap){this.actual=Math.min(hard,soft);this.distanceVelocity=0;this.clearFor=0;}
    else{
      const through=this.actual>hard+.02;
      this.clearFor=soft>this.actual+.25?this.clearFor+dt:0;
      // A short boom (the rider hidden or nearly) re-extends at once and briskly: the rider is drawn again quickly.
      const short=this.actual<T.showAbove;
      const target=through?Math.min(hard,soft):soft<this.actual?soft:short||this.clearFor>T.clearHold||soft-this.actual<.25?soft:this.actual;
      const gap=this.actual-target,w=gap>0?(through?T.pullIn*2:r.sight<this.actual?T.pullIn*1.6:T.pullIn)*(1+Math.min(1,gap/2)):short?T.easeOut*2:T.easeOut;
      // The spring sets the wanted velocity; the boom's acceleration is capped so a pull-in is an S-curve, not a jolt.
      const v0=this.distanceVelocity,[,vs]=springStep(this.actual,v0,target,w,dt),amax=through?T.boomAccel*2.5:T.boomAccel;
      let v1=v0+clamp(vs-v0,-amax*dt,amax*dt);if(target>=this.actual)v1=Math.max(0,v1);
      // A pull-in that is only planned (the present boom is clear: look-ahead, orbit arc) has a bounded speed.
      if(!through&&r.sight>=this.actual&&r.hard>=this.actual)v1=Math.max(v1,-T.planSpeed);
      let x=this.actual+(v0+v1)/2*dt;
      if((x-target)*(this.actual-target)<0){x=target;v1=0;}
      this.distanceVelocity=v1;this.actual=clamp(x,low,length);
      if(this.actual>hard+.02){this._p.copy(this.pivot).addScaledVector(dir,this.actual);
        // Inside a solid, or a solid within the near plane's reach in front of the lens: cut.
        if(this.solid(world,this._p,this._d.copy(dir).negate(),cl)<cl-.02||this.solid(world,this._p,dir,.12)<.05){this.actual=hard;this.distanceVelocity=0;}}
    }
    const lens=this.lens.copy(this.pivot).addScaledVector(dir,this.actual);
    if(!this.open(world,lens.x,lens.y,lens.z,-.02)||(!this.open(world,lens.x,lens.y,lens.z,cl)&&r.sight<this.actual))this.walkBack(world,dir,length,lens);

    // Lens corrections: faces beside the lens (solids) and the edges of its open space (bore walls are masses, a floor
    // or roof at the lens) push it off by the clearance. Eased over a few frames so paving and kerbs under the lens do
    // not jitter it; a lens that would be inside is corrected at once.
    this.right.set(dir.z,0,-dir.x);if(this.right.lengthSq()<1e-6)this.right.set(1,0,0);this.right.normalize();this.up.crossVectors(this.right,dir).normalize();
    const fix=this._w.set(0,0,0);let urgent=false;
    const hx=dir.x,hz=dir.z,hl=Math.hypot(hx,hz)||1;
    for(let i=0;i<=DIRS;i++){const axis=i<2?this.right:i<4?this.up:dir,sign=i%2&&i<4?-1:1;this._d.copy(axis).multiplyScalar(sign);
      const h=this.solid(world,lens,this._d,cl);if(h<cl){fix.addScaledVector(this._d,-(cl-h));urgent||=h<.05;}}
    // The near plane's corners sit 0.15 m in front of the lens (toward the rider) and to the sides: keep them clear too.
    {const n=camera.near||.15,hh=Math.tan(camera.fov*Math.PI/360)*n,hw=hh*(camera.aspect||1);
      for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){this._d.copy(dir).multiplyScalar(-n).addScaledVector(this.right,sx*hw).addScaledVector(this.up,sy*hh);
        const L=this._d.length(),h=this.solid(world,lens,this._d.divideScalar(L),L+.1);if(h<L+.1){fix.addScaledVector(this._d,-(L+.1-h));urgent||=h<L;}}}
    // Exact footprint probes only where the cached neighbourhood shows ground rising to the lens or a roof (bores).
    let massNear=false;for(const [ax,az] of [[cl,0],[-cl,0],[0,cl],[0,-cl]]){const n=this.spaceCached(world,lens.x+ax,lens.y,lens.z+az);if(n.floor>lens.y-cl||Number.isFinite(n.roof)){massNear=true;break;}}
    if(massNear)for(const [ax,az] of [[this.right.x,this.right.z],[-this.right.x,-this.right.z],[hx/hl,hz/hl],[-hx/hl,-hz/hl]]){
      if(this.open(world,lens.x+ax*cl,lens.y,lens.z+az*cl,cl*.5))continue;
      let lo=0,hi=cl;for(let k=0;k<3;k++){const m=(lo+hi)/2;if(this.open(world,lens.x+ax*m,lens.y,lens.z+az*m,cl*.5))lo=m;else hi=m;}
      fix.x-=ax*(cl-lo);fix.z-=az*(cl-lo);urgent||=lo<.05;}
    const ly=lens.y+fix.y,sp=this.spaceAround(world,lens.x+fix.x,ly,lens.z+fix.z);
    if(ly<sp.floor+cl){fix.y+=Math.min(sp.floor+cl,sp.roof-cl)-ly;urgent||=ly<sp.floor+.05;}
    else if(ly>sp.roof-cl){fix.y+=Math.max(sp.roof-cl,sp.floor+.1)-ly;urgent||=ly>sp.roof-.05;}
    if(snap||urgent)this.offset.copy(fix);else this.offset.lerp(fix,ease(fix.lengthSq()>this.offset.lengthSq()?22:8,dt));
    // Final check of the corrected lens: open space, and nothing solid between it and the pivot.
    const F=this._q.copy(lens).add(this.offset);
    if(!this.open(world,F.x,F.y,F.z,.02)){this.offset.copy(fix);F.copy(lens).add(fix);if(!this.open(world,F.x,F.y,F.z,.02)){this.offset.set(0,0,0);F.copy(lens);}}
    this._d.copy(F).sub(this.pivot);const back=this._d.length();
    // A correction must not move the lens behind something the uncorrected boom was clear of.
    if(this.offset.lengthSq()>0&&back>1e-3&&this.actual<=hard+.02&&this.solid(world,this.pivot,this._d.divideScalar(back),back+.05)<back){
      this.offset.set(0,0,0);F.copy(lens);}
    camera.position.copy(F);

    // At the closest range hide the rider instead of letting the near plane slice through them, and look ahead from
    // the shoulder instead of at the paving.
    // Hidden only while the near plane would really cut the rider: the lens's distance to the rider's body axis (wheel
    // to head), not the boom length (a boom pinned short beside a bore often still clears the body).
    const ay=clamp(F.y,p.y+.2,p.y+1.75),axis=Math.hypot(F.x-p.x,F.y-ay,F.z-p.z);
    this.riderHidden=this.riderHidden?axis<T.showAxis:axis<T.hideAxis;
    entity.mesh.visible=!this.riderHidden;
    // Once the rider is hidden, ease toward looking ahead from the shoulder (not at the paving); while drawn, frame them.
    this.closeBlend=snap?(this.riderHidden?1:0):this.closeBlend+((this.riderHidden?1:0)-this.closeBlend)*ease(2.5,dt);
    const close=smooth(this.closeBlend);
    // Framing: the rider sits below the centre with road ahead visible; portrait lifts the aim more. The aim follows
    // the slope ahead: down a descent (the stairs below stay in view), up a climb.
    const lift=portrait?.75:.35,ahead2=(portrait?2.4:1.5)*clamp((this.actual-.8)/3,0,1);
    const aimY=this.pivot.y+lift*clamp(this.actual/3,.3,1)+clamp(this.grade*ahead2*Math.cos(this.orbitShown),-1.2,.8);
    const fx=Math.sin(yawCam),fz=Math.cos(yawCam);
    this.target.set(this.pivot.x+fx*ahead2,aimY,this.pivot.z+fz*ahead2);
    if(close>0)this.target.lerp(this._r.set(this.pivot.x+fx*8,this.pivot.y+.3+this.grade*8*.5,this.pivot.z+fz*8),close);
    camera.lookAt(this.target);
    this.frame(camera,p,dt,this.riderHidden);
    // The lens corrections above already keep the corners clear for a camera looking back along the boom; the final
    // pass is needed when the view turns away from it (rider hidden, strong framing tilt) or a push is still easing out.
    if(this.riderHidden||this.closeBlend>.01||Math.abs(this.tilt)>.05||this.nearPush.lengthSq()>0||urgent)this.clearNearPlane(camera,world,snap?0:dt);
  }
  // Final pass with the camera's real orientation: the near plane's corners must be in open space (out of solids and
  // the masses beside bores). The push off a corner grows at once (never inside) and is released gradually (no snap).
  clearNearPlane(camera,world,dt=0){
    const n=camera.near||.15,hh=Math.tan(camera.fov*Math.PI/360)*n,hw=hh*(camera.aspect||1),c=camera.position,d=this._d,q=this._q,push=this.nearPush;
    push.multiplyScalar(dt>0?Math.exp(-6*dt):0);c.add(push);
    for(let pass=0;pass<2;pass++){camera.updateMatrixWorld();let moved=false;const e=camera.matrixWorld.elements;
      for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
        // Corner in world space: lens + R·(sx·hw, sy·hh, −n).
        d.set(e[0]*sx*hw+e[4]*sy*hh-e[8]*n,e[1]*sx*hw+e[5]*sy*hh-e[9]*n,e[2]*sx*hw+e[6]*sy*hh-e[10]*n);
        const L=d.length();d.divideScalar(L);const h=this.solid(world,c,d,L+.06);q.copy(c).addScaledVector(d,L+.03);
        const blocked=h<L+.06?L+.06-h:!this.open(world,q.x,q.y,q.z,0)?.08:0;
        if(blocked>0){const back=this.solid(world,c,this._w.copy(d).negate(),blocked+.1),k=-Math.min(blocked,Math.max(0,back-.05));
          c.addScaledVector(d,k);push.addScaledVector(d,k);moved=true;}}
      if(!moved)break;}
    // A released push must not walk the lens back into anything: drop it if the eased position is not open.
    if(push.lengthSq()>0&&!this.open(world,c.x,c.y,c.z,.02)){c.sub(push);push.set(0,0,0);}
  }
  // The applied orbit moves toward the player's orbit at a bounded rate. It looks along the arc it is about to sweep
  // and slows to what the boom can retract for, starting the retraction early, so turning inside a bore never cuts.
  orbitStep(world,dt){
    // The player's orbit may run ahead of the applied one (while it waits for the boom) by at most 1.5 rad.
    let delta=wrap(this.orbit-this.orbitShown);if(Math.abs(delta)>1.5){delta=Math.sign(delta)*1.5;this.orbit=wrap(this.orbitShown+delta);}
    const T=CAMERA_TUNING,R=T.arcRetract;const cap=this.lostReturning?T.lostOrbitRate:T.orbitRate;let vd=clamp(delta*12,-cap,cap);this.arcSoft=Infinity;
    // Still beyond the clear line at the present angle: hold briefly while the boom retracts. Never wait for a clearance
    // the boom cannot reach (its minimum), and never for long: a held orbit always moves again.
    const holding=Math.abs(vd)>.05&&this.actual>Math.max(T.minDistance,this.boomClear)+.4&&this.orbitHold<T.orbitHoldMax;
    const want=Math.abs(vd);this.orbitHold=holding?this.orbitHold+dt:0;if(holding)vd=0;
    // The arc ahead: the orbit slows to what the boom can retract for (`arcRetract`), and the boom plans its pull-in
    // from when the *commanded* turn would reach each angle (`arcPlan`), so it pulls in early instead of waiting on the
    // slowed orbit (which would wait on it in turn).
    if(want>.05||Math.abs(this.orbitV)>.05){const s=Math.sign(want>.05?delta:this.orbitV);
      for(const a of [.05,.12,.3,.6]){if(a>Math.abs(delta)+.15&&want>.05)break;
        const r=this.reach(world,this.pivot,this.boom(this.yaw+this.orbitShown+s*a,this.lastPitchUse,this._oq),this.lengthShown,this._rarc??={},this.actual);
        const lim=Math.max(T.closest,Math.min(r.hard,r.sight-.25)),need=this.actual-lim;
        if(need>.05){vd=s*Math.min(Math.abs(vd),a*R/need);}
        this.arcSoft=Math.min(this.arcSoft,lim+T.arcPlan*a/Math.max(.3,want));}}
    const acc=T.orbitAccel*dt;this.orbitV+=clamp(vd-this.orbitV,-acc,acc);
    const next=this.orbitShown+this.orbitV*dt;
    if(Math.abs(delta)<.05&&wrap(this.orbit-next)*delta<=0&&Math.abs(vd)<.05){this.orbitShown=this.orbit;this.orbitV=0;}else this.orbitShown=wrap(next);
  }
  // Keep the whole rider (wheel to head) between the HUD and the touch buttons: tilt the view as little as needed.
  frame(camera,p,dt,skip){
    let want=0;
    if(!skip&&!this.riderHidden){
      camera.updateMatrixWorld();const inv=camera.matrixWorldInverse,t=Math.tan(camera.fov*Math.PI/360),m=.06;
      const ang=y=>{const q=this._q.set(p.x,p.y+y,p.z).applyMatrix4(inv);return Math.atan2(q.y,-q.z);};
      const lo=Math.atan((Math.max(this.safe.bottom,-.97)+m)*t),hi=Math.atan((Math.min(this.safe.top,.97)-m)*t),aw=ang(.12),ah=ang(1.8);
      if(aw<lo)want=aw-lo;else if(ah>hi)want=Math.min(ah-hi,Math.max(0,aw-lo));
    }
    this.tilt=dt>0?this.tilt+(want-this.tilt)*ease(Math.abs(want)>Math.abs(this.tilt)?(this.closeBlend>.05?9:24):8,dt):want;
    if(Math.abs(this.tilt)>1e-5)camera.rotateX(this.tilt);
  }
  // Walk back along the boom to open space (never lift onto a hill).
  walkBack(world,dir,length,lens){
    const T=CAMERA_TUNING,cl=T.lensClearance;let d=this.actual;
    const low=this.low??T.minDistance;while(d>low){d=Math.max(low,d-.1);const q=this._p.copy(this.pivot).addScaledVector(dir,d);if(this.open(world,q.x,q.y,q.z,cl*.5))break;}
    this.actual=d;this.distanceVelocity=0;lens.copy(this.pivot).addScaledVector(dir,d);
  }
  // The lens is a small sphere: highest floor and lowest roof over its footprint (sloped bore ceilings are facets),
  // probing just below and above too (a roof facet the lens has risen through is only reported to a point under it).
  spaceAround(world,x,y,z){
    const c=this.space(world,x,y,z),r=CAMERA_TUNING.lensClearance,out=this._around;out.floor=c.floor;out.roof=c.roof;
    for(let i=0;i<6;i++){const n=this.spaceCached(world,x+(i===0?r:i===1?-r:0),y+(i===4?-r:i===5?r:0),z+(i===2?r:i===3?-r:0));
      if(n.floor<=y+.5)out.floor=Math.max(out.floor,n.floor);if(n.roof>y-.5)out.roof=Math.min(out.roof,n.roof);}
    return out;
  }
  // Look-around: rider-height inspection. Kept below a ceiling and backed off a wall it faces.
  updateLook(camera,entity,world){
    const yaw=this.yaw+this.orbit,lens=this.lens.copy(this.pivot);entity.mesh.visible=false;this.riderHidden=true;
    const sp=this.space(world,lens.x,lens.y,lens.z);if(lens.y>sp.roof-.2)lens.y=Math.max(sp.roof-.2,sp.floor+.3);
    const fx=Math.sin(yaw),fz=Math.cos(yaw),d=this._d.set(fx,0,fz),ahead=this.solid(world,lens,d,.32);
    if(ahead<.32){const behind=this.solid(world,lens,d.set(-fx,0,-fz),.4);lens.x-=fx*Math.min(.32-ahead,Math.max(0,behind-.08));lens.z-=fz*Math.min(.32-ahead,Math.max(0,behind-.08));}
    camera.position.copy(lens);
    this.target.set(lens.x+fx*Math.cos(this.pitch),lens.y+Math.sin(this.pitch),lens.z+fz*Math.cos(this.pitch));
    camera.lookAt(this.target);this.clearNearPlane(camera,world,this._lookDt);
  }
}
