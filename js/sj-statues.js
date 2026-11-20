/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Small directional stone figures — © 2026 VibezZzCoder, MIT.
// Photo studies01/02 and29/30: outward fountain figures and street-facing cathedral figures.
import * as THREE from 'three/webgpu';

// Local +Z is the figure's front. All parts, including arms/face, use this same frame.
export function statueFrame(x,y,z,heading,scale=1,width=1) {
  const c=Math.cos(heading),s=Math.sin(heading);
  return {heading,scale,width,point:(u,v,d)=>[x+(c*u+s*d)*scale*width,y+v*scale,z+(-s*u+c*d)*scale*width]};
}

export function createStatueBuilder({bake,own,box,sphere,segment}) {
  const robe=own(new THREE.CylinderGeometry(.21,.36,1.35,8));
  return (f,paint,kind='solid')=>{
    const s=f.scale,w=s*f.width;
    bake(robe,...f.point(0,.675,0),w,s,w,paint,f.heading,kind);
    bake(sphere,...f.point(0,1.52,0),.22*w,.27*s,.23*w,paint,f.heading,kind);
    // Same stone finish; a modest brow/nose silhouette makes front versus back readable without painted faces.
    bake(box,...f.point(0,1.57,.205),.24*w,.055*s,.09*w,paint,f.heading,kind);
    bake(box,...f.point(0,1.49,.255),.09*w,.12*s,.12*w,paint,f.heading,kind);
    segment(f.point(-.3,1.09,0),f.point(-.36,.62,.15),.10*w,paint,kind);
    segment(f.point(.28,1.09,0),f.point(.2,.66,.28),.10*w,paint,kind);
  };
}
