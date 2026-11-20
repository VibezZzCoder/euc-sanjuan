/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// San Juan riding/inspection camera — © 2026 VibezZzCoder, MIT.
import * as THREE from 'three/webgpu';

export const CAMERA_VIEWS=['chase','wide','look'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class RidingCamera {
  constructor(onChange=()=>{}) {
    this.onChange=onChange;this.mode='chase';this.pointers=new Map();
    this.target=new THREE.Vector3();this.desired=new THREE.Vector3();this.direction=new THREE.Vector3();
    this.resetOrbit();
  }
  setMode(mode) {
    if(!CAMERA_VIEWS.includes(mode))return;
    this.mode=mode;this.resetInput();this.resetOrbit();this.onChange(mode);
  }
  cycle(){this.setMode(CAMERA_VIEWS[(CAMERA_VIEWS.indexOf(this.mode)+1)%CAMERA_VIEWS.length]);}
  resetOrbit(){this.orbit=0;this.pitch=this.mode==='look'?0:this.mode==='wide'?.55:.25;this.distance=this.mode==='wide'?12:5.8;this.fov=62;this.snap=true;}
  turn(x,y){this.orbit=(this.orbit-x)%(Math.PI*2);this.pitch=clamp(this.pitch+(this.mode==='look'?-y:y),this.mode==='look'?-1.2:.08,1.3);}
  zoom(amount){if(this.mode==='look')this.fov=clamp(this.fov+amount*3,40,85);else this.distance=clamp(this.distance+amount,3,24);}
  applyGamepadInput(x,y,zoom,dt){this.turn(x*dt*1.8,y*dt);this.zoom(zoom*dt*8);}
  resetInput(){
    const ids=[...this.pointers.keys()];this.pointers.clear();
    for(const id of ids)if(this.canvas?.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
  }
  bind(canvas,enabled) {
    this.canvas=canvas;
    canvas.addEventListener('pointerdown',e=>{
      if(!enabled()||e.button!==0||this.pointers.size>=2)return;
      e.preventDefault();canvas.focus({preventScroll:true});
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove',e=>{
      const point=this.pointers.get(e.pointerId);if(!point||!enabled())return;
      if(this.pointers.size===2){
        const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)[1];
        const before=Math.hypot(point.x-other.x,point.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);
        this.zoom((before-after)*.035);
      }else this.turn((e.clientX-point.x)*.006,(e.clientY-point.y)*.005);
      point.x=e.clientX;point.y=e.clientY;
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>this.pointers.delete(e.pointerId));
    canvas.addEventListener('wheel',e=>{if(!enabled())return;e.preventDefault();this.zoom(clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1),-200,200)*.01);},{passive:false});
  }
  update(camera,entity,world,dt,snap=false) {
    const {target,desired,direction}=this,p=entity.position,heading=entity.heading+this.orbit;
    const look=this.mode==='look';entity.mesh.visible=!look;
    if(camera.fov!==this.fov){camera.fov=this.fov;camera.updateProjectionMatrix();}
    if(look){
      // Rider-height inspection: presentation only; the controller remains the sole position owner.
      camera.position.set(p.x,p.y+1.7,p.z);
      target.set(p.x+Math.sin(heading)*Math.cos(this.pitch),p.y+1.7+Math.sin(this.pitch),p.z+Math.cos(heading)*Math.cos(this.pitch));
    }else{
      target.set(p.x,p.y+1.3,p.z);
      desired.set(p.x-Math.sin(heading)*this.distance,p.y+1.5+Math.sin(this.pitch)*this.distance,p.z-Math.cos(heading)*this.distance);
      camera.position.lerp(desired,snap||this.snap?1:1-Math.exp(-9*dt));
      camera.position.y=Math.max(camera.position.y,world.height(camera.position.x,camera.position.z)+.6);
      // Check the actual damped position: the chord between two clear orbit endpoints may cross a wall.
      direction.copy(camera.position).sub(target);const length=direction.length();direction.normalize();
      const hit=world.sampler.raycast(target,direction,length);
      if(Number.isFinite(hit))camera.position.copy(target).addScaledVector(direction,Math.max(.08,hit-.3));
    }
    camera.lookAt(target);this.snap=false;
  }
}
