/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Skatepark del Muelle drawing — © 2026 VibezZzCoder, MIT. Draws exactly the vertices sj-skatepark-layout.js registered as
// support (three meshes: shaped concrete, floor, steel), plus palms (shared instanced form), benches (street kit) and the light
// masts' heads, which report to the baked lamp map (js/sj-glow.js; no real lights). Concrete: vertex-colour paint blocks ×
// low-amplitude grain (after the SF edition's skatepark material) × form joints on level slabs that fade with distance.
import * as THREE from 'three/webgpu';
import {glowLamp} from './sj-glow.js';
import {streetKit} from './sj-street-kit.js';
import {palmInstances} from './sj-palm.js';

export function buildSkatepark(area,ctx){
  const {scene,own,mat,meshes,bake,box,cylinder,sphere}=ctx,sk=area.skate,T=THREE.TSL,f=sk.frame;
  const concrete=mat({roughness:.9,metalness:0}),steel=mat({roughness:.42,metalness:.55});
  // grain × joints, built afresh for each material that uses it (no node objects shared between materials)
  const finish=()=>{const pw=T.positionWorld,p=pw.xz.mul(1.3),i=T.floor(p),fr=T.fract(p),w=fr.mul(fr).mul(fr.mul(-2).add(3));
    const hash=q=>T.fract(T.sin(T.dot(T.mod(q,211),T.vec2(127.1,311.7))).mul(43758.5453));
    const grain=T.mix(T.mix(hash(i),hash(i.add(T.vec2(1,0))),w.x),T.mix(hash(i.add(T.vec2(0,1))),hash(i.add(T.vec2(1,1))),w.x),w.y);
    // park-local coordinates for the joint grid (3 m slabs), only on level faces, gone by 45 m
    const dx=pw.x.sub(f.x),dz=pw.z.sub(f.z),cs=Math.cos(f.theta),sn=Math.sin(f.theta),u=dx.mul(cs).sub(dz.mul(sn)),s=dx.mul(sn).add(dz.mul(cs));
    const line=q=>T.float(1).sub(T.smoothstep(0,.035,T.abs(T.fract(q.div(3)).sub(.5)).mul(-1).add(.5).mul(3)));
    const level=T.smoothstep(.985,.995,T.normalWorld.y),fade=T.float(1).sub(T.smoothstep(18,45,T.distance(pw,T.cameraPosition)));
    return grain.mul(.12).add(.94).mul(T.float(1).sub(T.max(line(u),line(s)).mul(level).mul(fade).mul(.28)));};
  steel.colorNode=T.attribute('color','vec3');
  // The bowl block: paint from the park-local position (rounded-rectangle distance to the flat bottom, as the layout builds
  // the wall), so the lip band and the colour blocks follow the curves exactly instead of the triangle grid.
  // One concrete material: vertices marked with colour 2.0 (the bowl batch), 3.0 (the berm) or 5.0 (the floor) take a procedural paint, the
  // rest their own vertex colour (a second node material here drew this one's graph in testing, and only adds a program).
  const vc=T.attribute('color','vec3');
  // Route marks (layout `floor.routes`: park-local polylines): white dashes along each, a chevron at its end pointing on.
  // Painted from the park-local position on every concrete surface they cross (floor, rollers, bank, deck, stairs).
  let routeMarks=c=>c;
  if(sk.floor?.routes?.length){const pw=T.positionWorld,cs=Math.cos(f.theta),sn=Math.sin(f.theta),dx=pw.x.sub(f.x),dz=pw.z.sub(f.z);
    const p=T.vec2(dx.mul(cs).sub(dz.mul(sn)),dx.mul(sn).add(dz.mul(cs))),k=new THREE.Color(sk.floor.colours.mark),white=T.vec3(k.r,k.g,k.b);
    const band=(q,half)=>T.float(1).sub(T.smoothstep(half,half+.015,T.abs(q)));let m=T.float(0);
    for(const line of sk.floor.routes){let run=0;
      for(let i=0;i+1<line.length;i++){const [au,as]=line[i],[bu,bs]=line[i+1],du=bu-au,ds=bs-as,L=Math.hypot(du,ds),eu=du/L,es=ds/L;
        const rel=p.sub(T.vec2(au,as)),along=T.clamp(rel.x.mul(eu).add(rel.y.mul(es)),0,L),across=rel.x.mul(-es).add(rel.y.mul(eu));
        const inside=T.step(0,rel.x.mul(eu).add(rel.y.mul(es))).mul(T.step(rel.x.mul(eu).add(rel.y.mul(es)),L));
        m=T.max(m,band(across,.05).mul(inside).mul(T.step(T.fract(along.add(run).div(1.1)),.55)));run+=L;
        if(i+2===line.length){const back=T.float(L).sub(rel.x.mul(eu).add(rel.y.mul(es)));   // distance behind the tip
          m=T.max(m,band(back.sub(T.abs(across).mul(.8)),.06).mul(T.step(T.abs(across),.42)).mul(T.step(T.float(-.05),back)));}}}
    routeMarks=c=>T.mix(c,white,m);}
  let paint=routeMarks(vc);
  if(sk.bowl){const B=sk.bowl,lin=hex=>{const k=new THREE.Color(hex);return T.vec3(k.r,k.g,k.b);},col=B.colours,pw=T.positionWorld;
    const cs=Math.cos(f.theta),sn=Math.sin(f.theta),dx=pw.x.sub(f.x),dz=pw.z.sub(f.z),u=dx.mul(cs).sub(dz.mul(sn)),s=dx.mul(sn).add(dz.mul(cs));
    const qx=T.abs(u.sub(B.cu)).sub(B.a-B.r0),qy=T.abs(s.sub(B.cs)).sub(B.b-B.r0);
    const d=T.length(T.max(T.vec2(qx,qy),T.vec2(0,0))).add(T.min(T.max(qx,qy),0)).sub(B.r0);
    const roll=u.greaterThan(B.cu).select(T.float(1).sub(T.smoothstep(0,1,T.abs(s.sub(B.cs)).sub(B.rollHalf).div(B.rollBlend))),T.float(0));
    const ang=T.atan(s.sub(B.cs),u.sub(B.cu)),idx=T.floor(ang.add(Math.PI).div(2*Math.PI).mul(6));
    let sector=lin(col.sectors[5]);for(let k=4;k>=0;k--)sector=idx.lessThan(k+.5).select(lin(col.sectors[k]),sector);
    const wall=d.greaterThan(B.run-B.band).and(roll.lessThan(.5)).select(lin(col.lip),sector);
    let b=d.lessThanEqual(0).select(lin(col.bottom),d.lessThan(B.run).select(wall,lin(col.deck)));
    b=roll.greaterThan(.5).and(d.greaterThan(0)).select(T.normalWorld.y.greaterThan(.995).select(lin(col.deck),lin(col.bank)),b);
    b=u.greaterThan(B.eastDeck+.02).and(T.normalWorld.y.lessThan(.995)).select(lin(col.bank),b);
    b=s.greaterThan(B.southDeck+.02).and(T.normalWorld.y.lessThan(.995)).select(u.lessThan(B.qpSplit).select(lin(col.quarter),lin(col.bank)),b);
    paint=vc.x.greaterThan(1.5).and(vc.x.lessThan(2.5)).select(b,paint);}
  // Floor marks (the layout's painted lines from the park-local position): on the floor batch (marker 5.0) and on the
  // berm's flat floor, where the kicker line starts.
  let marks=c=>c;
  if(sk.floor){const L=sk.floor,lin=hex=>{const k=new THREE.Color(hex);return T.vec3(k.r,k.g,k.b);},col=L.colours,pw=T.positionWorld;
    const cs=Math.cos(f.theta),sn=Math.sin(f.theta),dx=pw.x.sub(f.x),dz=pw.z.sub(f.z),u=dx.mul(cs).sub(dz.mul(sn)),s=dx.mul(sn).add(dz.mul(cs));
    const band=(q,half)=>T.float(1).sub(T.smoothstep(half,half+.015,T.abs(q)));
    const within=(q,a,b)=>T.step(a,q).mul(T.step(q,b));
    const K=L.kick,ku=u.sub(K.u),inK=within(s,K.s0,K.s1);
    const dash=band(ku,.06).mul(T.step(T.fract(s.div(1.4)),.6));
    const q=T.fract(s.div(3)).mul(3),chev=band(q.sub(1).sub(T.abs(ku).mul(.8)),.06).mul(T.step(T.abs(ku),.45));
    const kickMark=T.max(dash,chev).mul(inK);
    const S=L.start,startMark=band(s.sub(S.s),.08).mul(band(u.sub(S.u),.8));
    const E=L.euro,euroBar=band(s.sub(E.s),.1).mul(within(u,E.u0,E.u1));
    const white=kickMark,yellow=T.max(startMark,euroBar);
    marks=c=>routeMarks(T.mix(T.mix(c,lin(col.mark),white),lin(col.lip),yellow));
    paint=vc.x.greaterThan(4.5).select(marks(lin(col.floor)),paint);}
  if(sk.berm){const B=sk.berm,lin=hex=>{const k=new THREE.Color(hex);return T.vec3(k.r,k.g,k.b);},col=B.colours,pw=T.positionWorld;
    const cs=Math.cos(f.theta),sn=Math.sin(f.theta),dx=pw.x.sub(f.x),dz=pw.z.sub(f.z),qu=dx.mul(cs).sub(dz.mul(sn)).sub(B.cu),qs=dx.mul(sn).add(dz.mul(cs)).sub(B.cs);
    // the layout's radial distance: round the corner, straight along the two tapering arms
    const r=qu.greaterThanEqual(0).and(qs.greaterThanEqual(0)).select(T.length(T.vec2(qu,qs)),qs.lessThan(0).select(qu,qs));
    const taper=qu.greaterThanEqual(0).and(qs.greaterThanEqual(0)).select(T.float(1),qs.lessThan(0).select(qs.div(B.arm).add(1),qu.div(B.arm).add(1)));
    const raised=r.greaterThan(B.toe+.02).and(taper.greaterThan(.04)).and(qu.greaterThanEqual(0).or(qs.greaterThanEqual(0)));
    const face=r.greaterThan(B.R-B.band).and(taper.greaterThan(.6)).select(lin(col.lip),lin(col.face));
    const berm=raised.select(r.greaterThanEqual(B.R).select(lin(col.deck),face),marks(lin(col.floor)));
    paint=vc.x.greaterThan(2.5).and(vc.x.lessThan(3.5)).select(berm,paint);}
  concrete.colorNode=paint.mul(finish());
  // Three meshes for the whole park: the shaped concrete (ramps, bowl, berm, walls, features; casts shadows), the flat floor
  // with the painted lettering and flag plates (receive only) and the thin steel (coping, rails, railings, masts; no shadow). The four
  // concrete batches share one material, so they are merged with their paint markers (2.0 bowl, 3.0 berm, 5.0 floor).
  const c=new THREE.Color(),stats={triangles:0,meshes:0},groups=new Map();
  for(const [name,b] of sk.batches){const key=name==='metal'?'metal':name==='floor'||name==='paint'?'floor':'concrete';if(!groups.has(key))groups.set(key,[]);groups.get(key).push([name,b]);}
  for(const [key,list] of groups){const n=list.reduce((s,[,b])=>s+b.p.length,0),pos=new Float32Array(n),nor=new Float32Array(n),col=new Float32Array(n);let o=0;
    for(const [name,b] of list){pos.set(b.p,o);nor.set(b.n,o);
      if(name==='bowl')col.fill(2,o,o+b.c.length);else if(name==='berm')col.fill(3,o,o+b.c.length);else if(name==='floor')col.fill(5,o,o+b.c.length);
      else for(let k=0;k<b.c.length;k+=3){c.setRGB(b.c[k],b.c[k+1],b.c[k+2],THREE.SRGBColorSpace);col[o+k]=c.r;col[o+k+1]=c.g;col[o+k+2]=c.b;}
      o+=b.p.length;}
    const g=own(new THREE.BufferGeometry());
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,key==='metal'?steel:concrete);m.name='sj-skatepark-'+key;
    m.castShadow=key==='concrete';m.receiveShadow=true;scene.add(m);meshes.push(m);stats.triangles+=n/9;stats.meshes++;}
  // the four palms share one form (two instanced draws; the 8.6 m form, which the camera's crown list assumes)
  if(area.palms?.length)palmInstances(area.palms,'sj-skatepark-palm-',{scene,own,mat,meshes},{variants:[0]});
  streetKit({bake,own,box,cylinder,sphere}).benches(sk.benches);
  // Mast heads: a dark fixture with a pale lens facing into the park; the lens is the luminous part the lamp map lights.
  for(const l of sk.lamps){const ry=Math.atan2(f.x-l.x,f.z-l.z);
    bake(box,l.x,l.y+.05,l.z,.55,.16,.32,'#3d4442',ry,'solid');bake(box,l.x,l.y-.04,l.z,.48,.03,.26,'#eef1ee',ry,'solid');
    glowLamp(l.x,l.y-.05,l.z,'port',{ground:l.ground,power:2.1});}
  return stats;
}
