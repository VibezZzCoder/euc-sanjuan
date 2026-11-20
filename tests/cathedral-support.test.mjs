/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {buildCathedral}=await import('../js/sj-cathedral.js');
const {facadeFrame}=await import('../js/sj-corridor-layout.js');

test('all three authored statue plinths have continuous masonry below their front and side contact points',()=>{
  const frame=facadeFrame([-137.057,-29.321],[-132.389,-7.328]),roof=30.38,width=frame.length;
  const boxes=[],figures=[],owned=[];
  // Capture the actual render-kit boxes, independently of any support metadata or chosen pedestal dimensions.
  buildCathedral({frame,width,roof,ground:21,steps:[],doors:[],tiers:[
    {u:width/2,minY:roof,maxY:roof+3.9,front:0,depth:1.4,width:width*.56},
    {u:width/2,minY:roof+3.9,maxY:roof+7.7,front:0,depth:1.4,width:width*.56}]},
  {localBox:(f,u,y,d,w,h,depth)=>boxes.push({u,y,d,w,h,depth}),
    bake(){},own:g=>(owned.push(g),g),archGeometry:()=>null,box:null,sculpture:f=>figures.push(f)});
  try{
    assert.equal(figures.length,3);
    for(const f of figures){
      const foot=f.point(0,0,0),u=(foot[0]+137.057)*frame.ux+(foot[2]+29.321)*frame.uz;
      const ledge=boxes.filter(b=>b.w>width*.45&&Math.abs(u-b.u)<b.w/2&&b.y+b.h/2<foot[1])
        .sort((a,b)=>b.y+b.h/2-a.y-a.h/2)[0];
      assert.ok(ledge);
      for(const du of [-.24,0,.24])for(const d of [.08,.25,.42]){
        const intervals=boxes.filter(b=>Math.abs(u+du*f.scale-b.u)<b.w/2&&Math.abs(d-b.d)<b.depth/2)
          .map(b=>[b.y-b.h/2,b.y+b.h/2]).sort((a,b)=>a[0]-b[0]);
        let reached=ledge.y+ledge.h/2;
        for(const [lo,hi] of intervals){if(lo>reached+1e-9)break;reached=Math.max(reached,hi);}
        assert.ok(reached>=foot[1],`Air beneath statue at u=${u.toFixed(3)}, front=${d}`);
      }
    }
  }finally{owned.forEach(g=>g.dispose());}
});
