/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Artificial light at blue hour — © 2026 VibezZzCoder, MIT.
// Lamps, lanterns and floodlights are modelled by the area builders; while they build, each reports its luminous parts
// here (glowLamp / glowFlood). At the end of buildWorld one pass turns the list into:
//  • a top-down light field over the city (two small RGBA8 textures, GLOW.texel metres a texel): the colour and amount of
//    lamp light reaching each spot, the height it is measured from, how far up the walls it climbs and the direction
//    it comes from. Light does not pass through mapped buildings (a 1 m occupancy raster is marched at bake time).
//  • one scene light (GlowLight) whose node reads that field and adds it as irradiance to every lit material, shaded by
//    the surface normal (pools on the paving, washes on the walls that face the lamp, dark backs and dark gaps).
//    It is a light, not a material property: no material is touched (a node on a material would make three.js refresh
//    every render object every frame), it adds no draw, and an hour change only moves `atmosphere.night`.
//  • one draw of camera-facing additive halos at the lamp heads, depth-tested so walls hide them.
// By day `atmosphere.night` is 0: the field is skipped behind a uniform branch and the halos collapse to nothing.
import * as THREE from 'three/webgpu';
import {Fn,If,float,vec2,vec3,vec4,max,min,dot,length,smoothstep,exp,sqrt,step,mod,atan,abs,clamp,mix,texture,attribute,varying,
  positionWorld,positionLocal,normalWorld,uv,cameraViewMatrix,cameraProjectionMatrix,cameraPosition,screenSize} from '../vendor/three/build/three.tsl.js';
import {atmosphere} from './sj-atmosphere.js';

// ---- Tuning (linear values; blue hour renders at exposure 1.5 through Khronos Neutral, which compresses above ~0.76) ----
export const GLOW={
  texel:2,          // light-field resolution, metres
  lampGain:1,       // overall lamp and lantern light on the city
  floodGain:2.4,    // overall floodlight wash on forts, walls and monuments
  haloGain:1,       // overall brightness of the halos at the lamp heads
  windowGain:1,     // overall brightness of lit windows
  haloMinPx:3,      // smallest halo on screen (pixels), so distant lamps still read as points (and do not sparkle)
  occlusion:.8,     // metres of building a ray may cross before a texel counts as hidden from that lamp
};

// Fixture kinds. light: sRGB of the light it throws on the city (warm but less saturated than its glass, so pastel walls
// keep their hue); glass: the lit glass seen around the core; core: the hot centre; power: field strength; H: pool height
// (≈ mounting height above the ground, sets the pool's spread); R: radius of influence; V: how far up the walls it
// climbs; halo: core size (m). References (lighting survey §2): L1 old-grid lanterns warm cream/amber glass in dark iron,
// amber emitter #F5B05B, warm glass core #FFF0CD, warm-neutral glints on the setts under them; L2 Princesa decorative rows
// warm gold; L3 Plaza de Armas amber lantern faces; L4 Plaza Colón restrained warm white; L13 piers: practical path
// lights and a few brighter neutral work sources (#CFD8D8).
export const KINDS={
  lantern:{light:'#ffc98e',glass:'#f5b05b',core:'#fff0cd',power:1.55,H:3.6,R:12,V:8,  halo:.34},   // old-grid wall brackets (L1)
  kit:    {light:'#ffcd96',glass:'#f3b45e',core:'#fff0cd',power:.45,H:3.8,R:13,V:7,  halo:.32},   // power per head × its scale   // black post lanterns (L1, L2)
  post:   {light:'#ffca90',glass:'#f4b862',core:'#fff1d2',power:1.0,H:4.0,R:14,V:7.5,halo:.36},   // plaza, gate, Norzagaray posts (L1, L3, L7)
  globe:  {light:'#ffdcb4',glass:'#ffd9a6',core:'#fff4e0',power:1.0,H:3.6,R:13,V:7,  halo:.42},   // Plaza Colón globes (L4)
  cup:    {light:'#ffe6c8',glass:'#ffe3bd',core:'#fff6e8',power:.9, H:3.7,R:13,V:7,  halo:.34},   // Quinto Centenario cups (inferred)
  pylon:  {light:'#ffecd2',glass:'#f2dcb4',core:'#fff7ea',power:1.0,H:4.3,R:14,V:7.5,halo:.38},   // Bahía framed pylons (L13 civic path)
  lattice:{light:'#e9eeee',glass:'#cfd8d8',core:'#f4f8f8',power:1.25,H:4.5,R:16,V:8, halo:.42},   // Bahía lattice heads (L13 work light)
  port:   {light:'#eef1ee',glass:'#d6dcd8',core:'#f6f8f6',power:1.2,H:4.5,R:15,V:7.5,halo:.36},   // waterfront arm lights (L13)
  bulb:   {light:'#ffd8a8',glass:'#ffe6c0',core:'#fff6e6',power:1.6,H:2.0,R:9, V:5,  halo:.2},    // bare bulb at La Perla's lit pocket (L9 #68, inferred)
  bulbCool:{light:'#e9f0f4',glass:'#e4ecf2',core:'#f8fbff',power:1.3,H:2.0,R:9, V:5,  halo:.2},
  threshold:{light:'#ffcf96',glass:'#000000',core:'#000000',power:.8,H:1.2,R:5, V:3,  halo:0},   // light spilling from an open door onto its step and lane (no fixture)   // its cool-white shop light (#68)
  faro:   {light:'#ffd6a4',glass:'#f5c078',core:'#fff2d8',power:.35,H:2.7,R:7, V:4,  halo:.22},   // El Faro monument lantern (inferred)
  lighthouse:{light:'#ffffff',glass:'#ffffff',core:'#ffffff',power:0,H:1,R:1,V:1,halo:.9,flash:1}, // El Morro light, Fl(3) W 40 s (L11)
};
const KIND_LIST=Object.keys(KINDS);

import {PANES,PANE_LIST,PANE_CLASSES,paneKind} from './sj-glow-kinds.js';
export {PANES,paneKind};

// ---- Registry (filled while the world builds) ----
const sink={lamps:[],floods:[],panes:[]};
/** Start a world build: forget the previous build's fixtures. */
export function beginGlow(){sink.lamps.length=0;sink.floods.length=0;sink.panes.length=0;}
/** A pane that may glow: centre (x,y,z) of its front face, yaw `angle` (local +z = outward, the bake convention),
 * width w, height h, kind (PANES). */
export function glowPane(x,y,z,angle,w,h,kind){const k=typeof kind==='number'?kind:paneKind(kind);
  if(k<0||![x,y,z,angle,w,h].every(Number.isFinite)||w<=0||h<=0)return;sink.panes.push(x,y,z,angle,w,h,k);}
/** Register a compact list [x,y,z,angle,w,h,kindIndex]* (layouts that run before the build, e.g. the fabric). */
export function glowPanes(list){if(!list)return;for(let i=0;i+6<list.length;i+=7)glowPane(list[i],list[i+1],list[i+2],list[i+3],list[i+4],list[i+5],list[i+6]);}
/** A luminous lamp head at (x,y,z) (its centre). `ground` is the height of the ground the lamp lights (default: the
 * head height minus the kind's pool height). `scale` sizes the halo, `power` scales only its light on the city. */
export function glowLamp(x,y,z,kind,{ground,scale=1,power=1}={}){if(!KINDS[kind]||![x,y,z].every(Number.isFinite))return;
  sink.lamps.push({x,y,z,kind,ground:Number.isFinite(ground)?ground:y-KINDS[kind].H,scale,power});}
/** A floodlight washing a face: source on the ground at (x,y,z) in front of the face, throwing light toward (dx,dz);
 * `height` how far up the face it reaches, `power` its strength, `warmth` 1 warm (fort/wall masonry) … 0 ivory (civic),
 * `radius` its spread, `through` true for a source on a roof lighting its own building (dome), not stopped by it, `inside` true for a flood on a monument's own closed grounds lighting faces seen from outside. */
export function glowFlood(x,y,z,{dx=0,dz=0,height=12,power=1,warmth=1,radius=15,through=false,inside=false}={}){
  if(![x,y,z,dx,dz,height,power].every(Number.isFinite))return;sink.floods.push({x,y,z,dx,dz,height,power,warmth,radius,through,inside});}
/** Diagnostic callers (tests, QA tools) set `keep` before building to get the fixture lists back on the build's glow
 * object; the game does not keep them after the bake. */
export const GLOW_DIAGNOSTICS={keep:false};
/** The fixtures registered by the current build (for tests). */
export const glowFixtures=()=>({lamps:sink.lamps.slice(),floods:sink.floods.slice(),panes:Float32Array.from(sink.panes)});

// Deterministic per-opening choice: a hash of the pane's position (stable across builds and engines at mm rounding).
const hash01=(x,y,z,s)=>{let h=Math.imul(Math.round(x*100)^Math.imul(Math.round(z*100),0x27d4eb2d),0x9e3779b1)^Math.imul(Math.round(y*100)+s,0x85ebca6b);
  h^=h>>>15;h=Math.imul(h,0x2c1b3c6d);h^=h>>>12;h=Math.imul(h,0x297a2d39);h^=h>>>15;return (h>>>0)/4294967296;};
/** The lit panes of a registered list: [{x,y,z,angle,w,h,kind,colour:[r,g,b] linear × power}]. */
export function litPanes(list){const out=[];
  for(let i=0;i+6<list.length;i+=7){const [x,y,z,a,w,h,k]=list.slice(i,i+7),kind=PANES[PANE_LIST[k]];
    if(hash01(x,y,z,k)>=kind.share)continue;const r=hash01(x,y,z,k+101),c=lin(kind.tints[Math.floor(r*kind.tints.length)]),p=kind.power*(.7+.6*hash01(x,y,z,k+211));
    out.push({x,y,z,angle:a,w,h,kind:PANE_LIST[k],cls:PANE_CLASSES.indexOf(kind.cls),seed:hash01(x,y,z,k+307),colour:c.map(v=>v*p)});}
  return out;}

// ---- Field bake (pure; also run by the CPU test) ----
const lin=hex=>{const c=new THREE.Color(hex);return [c.r,c.g,c.b];};
const lum=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
// Floodlight colours, sRGB: warm-neutral on fort and wall masonry (L5, L7; Princesa warm gold L2), stately ivory on the
// Capitol (L8). A flood's `warmth` mixes between them.
export const FLOOD_WARM='#ffcf96',FLOOD_IVORY='#fff1de';
export const LAMP_REACH=8;   // metres up a wall that lamp light climbs (fading from about a third of it)
export const LAMP_TOP=3.4;   // lowest lamp mounting height above its ground: no pool on up-facing surfaces above it
/** Light sources for the field: lamps and floods in one shape. */
export function fieldSources({lamps,floods}){
  const out=[];
  for(const l of lamps){const k=KINDS[l.kind];if(!k.power)continue;const c=lin(k.light).map(v=>v*k.power*(l.scale??1)*(l.power??1)*GLOW.lampGain);
    out.push({x:l.x,z:l.z,base:l.ground,c,H:Math.max(1.5,l.y-l.ground),R:k.R,flood:false});}
  for(const f of floods){const n=Math.hypot(f.dx,f.dz)||1;
    out.push({x:f.x,z:f.z,base:f.y,e:f.power*GLOW.floodGain,H:6,R:f.radius,V:f.height,warmth:f.warmth,flood:true,through:f.through,dx:f.dx/n,dz:f.dz/n});}
  return out;
}
/** Rasterise mapped building footprints at 1 m into a byte grid over the field bounds (1 = inside a building). */
export function occupancy(buildings,b){const nx=Math.ceil(b.w),nz=Math.ceil(b.d),grid=new Uint8Array(nx*nz),xs=new Float64Array(256);
  for(const bd of buildings??[]){const rings=[bd.outer,...(bd.holes??[])];let z0=Infinity,z1=-Infinity;
    for(let i=0;i<bd.outer.length;i++){const z=bd.outer[i][1];if(z<z0)z0=z;if(z>z1)z1=z;}
    const j0=Math.max(0,Math.floor(z0-b.z0)),j1=Math.min(nz-1,Math.ceil(z1-b.z0));
    for(let j=j0;j<=j1;j++){const zc=b.z0+j+.5;let m=0;
      for(const r of rings)for(let i=0,k=r.length-1;i<r.length;k=i++){const az=r[i][1],bz=r[k][1];
        if((az>zc)!==(bz>zc)&&m<256){const ax=r[i][0];xs[m++]=ax+(zc-az)*(r[k][0]-ax)/(bz-az);}}
      if(m<2)continue;const v=xs.subarray(0,m).sort();
      for(let s=0;s+1<m;s+=2){const i0=Math.max(0,Math.ceil(v[s]-b.x0-.5)),i1=Math.min(nx-1,Math.floor(v[s+1]-b.x0-.5));
        if(i1>=i0)grid.fill(1,j*nx+i0,j*nx+i1+1);}}}
  return {nx,nz,grid,x0:b.x0,z0:b.z0};
}
/**
 * Bake the light field: two layers on one grid of `texel` metres.
 *  a (RGBA8): lamp light √(E/emax) rgb, the height it is measured from (bmin + a·brange)
 *  b (RGBA8): direction toward the lamps xz (·½+½), direction toward the floods xz (·½+½)
 *  c (RGBA8): flood light √(F/fmax), its base height, its reach (/40 m), its warmth
 */
export function bakeField(fixtures,buildings,{texel=GLOW.texel}={}){
  const src=fieldSources(fixtures);
  if(!src.length)return null;
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
  for(const s of src){x0=Math.min(x0,s.x-s.R);x1=Math.max(x1,s.x+s.R);z0=Math.min(z0,s.z-s.R);z1=Math.max(z1,s.z+s.R);}
  x0=Math.floor(x0/texel-2)*texel;z0=Math.floor(z0/texel-2)*texel;
  const nx=Math.ceil((x1-x0)/texel)+3,nz=Math.ceil((z1-z0)/texel)+3,n=nx*nz;
  const now=()=>globalThis.performance?.now?.()??0,t0=now(),times={};
  const occ=occupancy(buildings,{x0,z0,w:nx*texel,d:nz*texel});times.occupancy=now()-t0;
  // Accumulators in 32×32-texel tiles allocated on first touch (most of the bounds is dark): per texel E rgb, W,
  // W·base, W·dir xz (lamps); F, F·base, F·reach, F·warmth, F·dir xz (floods).
  const T=32,S=13,ntx=Math.ceil(nx/T),tiles=new Map();
  const cell=(i,j)=>{const key=(j>>5)*ntx+(i>>5);let t=tiles.get(key);if(!t)tiles.set(key,t=new Float32Array(T*T*S));return [t,((j&31)*T+(i&31))*S];};
  const hidden=(sx,sz,px,pz,d)=>{// building metres crossed on the way, ignoring the first metre and the last one
    if(d<2)return false;const steps=Math.floor(d-1);let inside=0;
    for(let s=1;s<=steps;s++){const t=s/d,x=sx+(px-sx)*t,z=sz+(pz-sz)*t,i=Math.floor(x-occ.x0),j=Math.floor(z-occ.z0);
      if(i>=0&&j>=0&&i<occ.nx&&j<occ.nz&&occ.grid[j*occ.nx+i]&&(inside+=1)>GLOW.occlusion)return true;}
    return false;};
  for(const s of src){const i0=Math.max(0,Math.floor((s.x-s.R-x0)/texel)),i1=Math.min(nx-1,Math.ceil((s.x+s.R-x0)/texel));
    const j0=Math.max(0,Math.floor((s.z-s.R-z0)/texel)),j1=Math.min(nz-1,Math.ceil((s.z+s.R-z0)/texel)),L=s.flood?s.e:lum(s.c);
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const px=x0+(i+.5)*texel,pz=z0+(j+.5)*texel,dx=s.x-px,dz=s.z-pz,d=Math.hypot(dx,dz);
      if(d>=s.R)continue;
      let f=Math.pow(1+(d/s.H)**2,-1.5)*(1-(d/s.R)**2)**2;
      if(s.flood){// a floodlight throws its light forward (toward its face), little to the sides or behind
        const fw=d>.01?-(dx*s.dx+dz*s.dz)/d:1;f*=Math.max(0,.2+.8*fw);}
      if(f<1e-4||(!s.through&&hidden(s.x,s.z,px,pz,d)))continue;
      const [t,o]=cell(i,j),w=f*L;
      if(s.flood){t[o+7]+=w;t[o+8]+=w*s.base;t[o+9]+=w*s.V;t[o+10]+=w*s.warmth;t[o+11]-=w*s.dx;t[o+12]-=w*s.dz;continue;}
      t[o]+=f*s.c[0];t[o+1]+=f*s.c[1];t[o+2]+=f*s.c[2];t[o+3]+=w;t[o+4]+=w*s.base;
      if(d>.25){t[o+5]+=w*dx/d;t[o+6]+=w*dz/d;}}}
  times.sources=now()-t0-times.occupancy;
  let emax=1e-6,fmax=1e-6,bmin=Infinity,bmax=-Infinity;
  for(const t of tiles.values())for(let o=0;o<t.length;o+=S){
    if(t[o+3]){emax=Math.max(emax,t[o],t[o+1],t[o+2]);const b=t[o+4]/t[o+3];bmin=Math.min(bmin,b);bmax=Math.max(bmax,b);}
    if(t[o+7]){fmax=Math.max(fmax,t[o+7]);const b=t[o+8]/t[o+7];bmin=Math.min(bmin,b);bmax=Math.max(bmax,b);}}
  if(!Number.isFinite(bmin)){bmin=0;bmax=1;}
  bmin=Math.floor(bmin-1);const brange=Math.max(1,Math.ceil(bmax+1-bmin));
  const a=new Uint8Array(n*4),b=new Uint8Array(n*4).fill(128),c=new Uint8Array(n*4),q=v=>Math.max(0,Math.min(255,Math.round(v*255)));
  const lampE=new Float32Array(n),floodE=new Float32Array(n),litLamp=[],litFlood=[];   // energies and lit texels, for the gutter below
  for(const [key,t] of tiles){const ti=key%ntx,tj=Math.floor(key/ntx);
    for(let jj=0;jj<T;jj++)for(let ii=0;ii<T;ii++){const i=ti*T+ii,j=tj*T+jj;if(i>=nx||j>=nz)continue;const o=(jj*T+ii)*S,k=j*nx+i;
      if(t[o+3]){for(let ch=0;ch<3;ch++)a[4*k+ch]=q(Math.sqrt(t[o+ch]/emax));a[4*k+3]=q((t[o+4]/t[o+3]-bmin)/brange);
        b[4*k]=q(t[o+5]/t[o+3]*.5+.5);b[4*k+1]=q(t[o+6]/t[o+3]*.5+.5);lampE[k]=t[o+3];litLamp.push(k);}
      if(t[o+7]){c[4*k]=q(Math.sqrt(t[o+7]/fmax));c[4*k+1]=q((t[o+8]/t[o+7]-bmin)/brange);c[4*k+2]=q(t[o+9]/t[o+7]/40);c[4*k+3]=q(t[o+10]/t[o+7]);
        b[4*k+2]=q(t[o+11]/t[o+7]*.5+.5);b[4*k+3]=q(t[o+12]/t[o+7]*.5+.5);floodE[k]=t[o+7];litFlood.push(k);}}}
  tiles.clear();
  // Metadata gutter: an unlit texel next to lit ones takes the height, direction (and flood reach/warmth) of its
  // brightest lit neighbour, energy left at zero. Bilinear filtering then blends light with zero, not with a made-up
  // ground height of bmin, which used to switch the light off right beside its source on raised streets.
  const take=new Int32Array(n);
  const gutter=(E,lit,copy)=>{take.fill(-1);
    for(const m of lit){const i=m%nx,j=(m-i)/nx;
      for(let dj=-1;dj<=1;dj++){const jj=j+dj;if(jj<0||jj>=nz)continue;
        for(let di=-1;di<=1;di++){const ii=i+di;if(ii<0||ii>=nx)continue;const k=jj*nx+ii;if(E[k])continue;const b=take[k];if(b<0||E[m]>E[b])take[k]=m;}}}
    for(const m of lit){const i=m%nx,j=(m-i)/nx;
      for(let dj=-1;dj<=1;dj++){const jj=j+dj;if(jj<0||jj>=nz)continue;
        for(let di=-1;di<=1;di++){const ii=i+di;if(ii<0||ii>=nx)continue;const k=jj*nx+ii;if(take[k]>=0){copy(k,take[k]);take[k]=-1;}}}}};
  gutter(lampE,litLamp,(k,m)=>{a[4*k+3]=a[4*m+3];b[4*k]=b[4*m];b[4*k+1]=b[4*m+1];});
  gutter(floodE,litFlood,(k,m)=>{c[4*k+1]=c[4*m+1];c[4*k+2]=c[4*m+2];c[4*k+3]=c[4*m+3];b[4*k+2]=b[4*m+2];b[4*k+3]=b[4*m+3];});
  times.encode=now()-t0-times.occupancy-times.sources;
  return {x0,z0,nx,nz,texel,emax,fmax,bmin,brange,a,b,c,sources:src.length,times};
}
/** Decoded field at (x,z) (bilinear, as the GPU samples it), for tests: lamp {e:[r,g,b], base, dir:[x,z]} and
 * flood {f, base, reach, warmth, dir:[x,z]}. */
export function sampleField(f,x,z){const u=(x-f.x0)/f.texel-.5,v=(z-f.z0)/f.texel-.5,i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j;
  const at=(arr,c)=>{let s=0;for(const [di,dj,w] of [[0,0,(1-fu)*(1-fv)],[1,0,fu*(1-fv)],[0,1,(1-fu)*fv],[1,1,fu*fv]]){
    const ii=Math.max(0,Math.min(f.nx-1,i+di)),jj=Math.max(0,Math.min(f.nz-1,j+dj));s+=w*arr[4*(jj*f.nx+ii)+c]/255;}return s;};
  return {e:[0,1,2].map(c=>at(f.a,c)**2*f.emax),base:f.bmin+at(f.a,3)*f.brange,dir:[at(f.b,0)*2-1,at(f.b,1)*2-1],
    flood:{f:at(f.c,0)**2*f.fmax,base:f.bmin+at(f.c,1)*f.brange,reach:at(f.c,2)*40,warmth:at(f.c,3),dir:[at(f.b,2)*2-1,at(f.b,3)*2-1]}};}

/** CPU mirror of the scene light's term at a surface point (x,y,z) with unit normal n {x,y,z}: lamp and flood
 * irradiance factors before colour (same formulas as GlowLightNode, without the π and night). For tests. */
export function glowAt(f,x,y,z,n){const s=sampleField(f,x,z),ss=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  const side=1-Math.abs(n.y),h=y-s.base,vert=ss(-1.5,0,h)*(1-ss(LAMP_REACH*.33,LAMP_REACH,h)),dl=Math.min(Math.hypot(...s.dir),1);
  const facing=Math.max(n.y,0)*(1-ss(LAMP_TOP-.8,LAMP_TOP,h))+Math.max(n.x*s.dir[0]+n.z*s.dir[1],0)*.9+(1-dl)*.5*side;
  const F=s.flood,fh=y-F.base,reach=Math.max(F.reach,1),fvert=ss(-1,0,fh)*Math.pow(1-Math.max(0,Math.min(1,fh/reach)),1.3);
  const ffacing=Math.max(n.x*F.dir[0]+n.z*F.dir[1],0)+Math.max(n.y,0)*.08;
  return {lamp:lum(s.e)*vert*facing,flood:F.f*fvert*ffacing};}

// ---- GPU side ----
// Once on the GPU the field's CPU copy is released (the renderer calls onUpdate after the upload); nothing re-uploads it.
const fieldTexture=(field,key)=>{const t=new THREE.DataTexture(field[key],field.nx,field.nz,THREE.RGBAFormat,THREE.UnsignedByteType);
  t.magFilter=t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.colorSpace=THREE.NoColorSpace;t.flipY=false;
  t.onUpdate=()=>{t.onUpdate=null;t.image.data=null;field[key]=null;};t.needsUpdate=true;return t;};

/** The scene light that carries the field into every lit material. */
export class GlowLight extends THREE.Light{
  constructor(field){super(0xffffff,1);this.isGlowLight=true;this.type='GlowLight';this.field=field;}
}
class GlowLightNode extends THREE.AnalyticLightNode{
  static get type(){return 'GlowLightNode';}
  setup(builder){const f=this.light.field;if(!f)return;const {context}=builder;
    const ta=f.textureA,tb=f.textureB,tc=f.textureC,origin=vec2(f.x0,f.z0),inv=vec2(1/(f.nx*f.texel),1/(f.nz*f.texel));
    const warm=vec3(...lin(FLOOD_WARM)),ivory=vec3(...lin(FLOOD_IVORY));
    const glow=Fn(()=>{const out=vec3(0).toVar();
      If(atmosphere.night.greaterThan(.001),()=>{
        const uv=positionWorld.xz.sub(origin).mul(inv),A=texture(ta,uv).level(0),B=texture(tb,uv).level(0),C=texture(tc,uv).level(0);
        const n=normalWorld,nxz=vec2(n.x,n.z),side=float(1).sub(abs(n.y));
        // Lamps: a pool on the ground, a wash on the walls that face them, climbing to LAMP_REACH; from all round where
        // lamps on several sides cancel the direction.
        const e=A.rgb.mul(A.rgb).mul(f.emax),h=positionWorld.y.sub(A.a.mul(f.brange).add(f.bmin));
        const vert=smoothstep(-1.5,0,h).mul(float(1).sub(smoothstep(LAMP_REACH*.33,LAMP_REACH,h)));
        const d=B.rg.mul(2).sub(1),dl=min(length(d),1);
        // Up-facing surfaces get the pool only below the lamps' mounting height (a low roof or a balcony top above
        // the lantern stays dark); faces turned toward the lamps keep their wash.
        const facing=max(n.y,0).mul(float(1).sub(smoothstep(LAMP_TOP-.8,LAMP_TOP,h))).add(max(dot(nxz,d),0).mul(.9)).add(float(1).sub(dl).mul(.5).mul(side));
        // Floods: rise from the foot of the faces that look toward them and fade toward the top of their reach.
        const fe=C.r.mul(C.r).mul(f.fmax),fh=positionWorld.y.sub(C.g.mul(f.brange).add(f.bmin)),reach=max(C.b.mul(40),1);
        const fvert=smoothstep(-1,0,fh).mul(float(1).sub(clamp(fh.div(reach),0,1)).pow(1.3));
        const fd=B.ba.mul(2).sub(1),ffacing=max(dot(nxz,fd),0).add(max(n.y,0).mul(.08));
        const flood=mix(ivory,warm,C.a).mul(fe.mul(fvert).mul(ffacing));
        out.assign(e.mul(vert.mul(facing)).add(flood).mul(atmosphere.night.mul(Math.PI)));});
      return out;});
    context.irradiance.addAssign(glow());}
}
GlowLight.registerNode(GlowLightNode);

// Halos: camera-facing quads at the lamp heads, additive, depth-tested (pulled a little toward the camera so the lamp's
// own glass does not hide its halo), never smaller than GLOW.haloMinPx. The El Morro light flashes Fl(3) W 40 s
// (USCG Light List 2025 no. 30735) and is screened inland: visible to observers from 241° through north to 101°.
function haloMesh(lamps,lighthouse){
  const list=lamps.filter(l=>KINDS[l.kind].halo>0);if(!list.length)return null;
  const n=list.length,P=new Float32Array(n*12),Q=new Float32Array(n*8),C=new Float32Array(n*12),G=new Float32Array(n*12),S=new Float32Array(n*4),F=new Float32Array(n*4),I=new Uint32Array(n*6);
  list.forEach((l,k)=>{const kind=KINDS[l.kind],c=lin(kind.core),gl=lin(kind.glass),size=kind.halo*(l.scale??1),fl=kind.flash?1:0;
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([u,v],m)=>{const o=k*4+m;P.set([l.x,l.y,l.z],3*o);Q.set([u,v],2*o);C.set(c,3*o);G.set(gl,3*o);S[o]=size;F[o]=fl;});
    I.set([0,1,2,0,2,3].map(v=>v+k*4),6*k);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('corner',new THREE.BufferAttribute(Q,2));
  g.setAttribute('tint',new THREE.BufferAttribute(C,3));g.setAttribute('glass',new THREE.BufferAttribute(G,3));g.setAttribute('size',new THREE.BufferAttribute(S,1));g.setAttribute('flash',new THREE.BufferAttribute(F,1));
  g.setIndex(new THREE.BufferAttribute(I,1));g.computeBoundingSphere();g.boundingSphere.radius+=2;
  const m=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:true});
  const centre=attribute('position','vec3'),corner=attribute('corner','vec2'),size=attribute('size','float'),flash=attribute('flash','float');
  const lh=lighthouse?vec2(lighthouse.x,lighthouse.z):vec2(0,0);
  // Lighthouse: three 0.5 s flashes in each 40 s, screened inland.
  const t=mod(atmosphere.elapsed,40),pulse=exp(t.sub(1).div(.22).pow(2).negate()).add(exp(t.sub(3.5).div(.22).pow(2).negate())).add(exp(t.sub(6).div(.22).pow(2).negate()));
  const toCam=cameraPosition.xz.sub(lh),az=atan(toCam.x,toCam.y.negate()).mul(180/Math.PI),azn=mod(az.add(360),360);
  const seen=step(azn,101).add(step(241,azn)).min(1);
  const beam=flash.mul(seen).mul(pulse.mul(.95).add(.05));
  const on=step(.001,atmosphere.night);
  const view=cameraViewMatrix.mul(vec4(centre,1)),dist=length(view.xyz),pull=min(flash.mul(1.4).add(.28),dist.mul(.5));   // the lighthouse light clears its 1 m lantern drum
  const pxWorld=dist.mul(2).div(cameraProjectionMatrix.element(1).y.mul(screenSize.y));
  const s=max(size.mul(float(1).add(flash.mul(beam).mul(2))),pxWorld.mul(GLOW.haloMinPx)).mul(on);
  const c=view.xyz.mul(float(1).sub(pull.div(max(dist,.01)))).add(vec3(corner.mul(s),0));
  m.vertexNode=cameraProjectionMatrix.mul(vec4(c,1));
  const vCorner=varying(corner),vTint=varying(attribute('tint','vec3')),vGlass=varying(attribute('glass','vec3')),
    vWeight=varying(float(1).sub(flash).add(beam).mul(atmosphere.night).mul(GLOW.haloGain).mul(float(1).sub(smoothstep(600,3600,dist).mul(.6)))),   // a little haze with distance
    vFar=varying(clamp(size.div(max(pxWorld.mul(GLOW.haloMinPx),.001)),.25,1));
  const r2=dot(vCorner,vCorner),r=sqrt(r2);
  // hot core in the core colour, a soft glass-coloured glow around it, nothing at the quad's edge
  const core=exp(r2.mul(-10)).mul(2.0),rim=exp(r.mul(-4.5)).mul(.4).mul(float(1).sub(smoothstep(.7,1,r)));
  m.colorNode=vec4(vTint.mul(core).add(vGlass.mul(rim)).mul(vWeight).mul(vFar.mul(.45).add(.55)),1);
  const mesh=new THREE.Mesh(g,m);mesh.name='sj-glow-halos';mesh.frustumCulled=true;mesh.renderOrder=5;mesh.castShadow=mesh.receiveShadow=false;
  return mesh;
}

// Lit windows: one merged mesh of quads 1.2 cm in front of the chosen openings, added to the frame (additive: the
// opening's own colour, frame and glazing bars stay; muntins and leaves in front still cross it), depth-tested, no depth
// write, collapsed by day. What emits depends on the opening (per-vertex class, seed, width, height):
//  room   glass with a lit room behind: brighter toward the head, darker reveal and sill, a mullion on some, one half
//         dimmer on some (L12: vary the source, not only its colour);
//  louvre a closed louvred shutter: only the slat gaps and the centre seam, averaged once the slats are under a few pixels;
//  seam   a closed timber leaf: a thin rim and the head of the opening.
// Panes smaller than about a pixel are dimmed (no distant sparkle), and all fade a little into the haze.
const WINDOW_FADE=[400,3600];   // metres
function windowMesh(lit){
  if(!lit.length)return null;
  const n=lit.length,P=new Float32Array(n*12),C=new Float32Array(n*12),U=new Float32Array(n*8),N=new Float32Array(n*16),I=new Uint32Array(n*6);
  lit.forEach((p,k)=>{const s=Math.sin(p.angle),c=Math.cos(p.angle),ox=s*.012,oz=c*.012,rx=c*p.w/2,rz=-s*p.w/2,hy=p.h/2;
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([u,v],m)=>{const o=k*4+m;P.set([p.x+ox+rx*u,p.y+hy*v,p.z+oz+rz*u],3*o);C.set(p.colour,3*o);U.set([(u+1)/2,(v+1)/2],2*o);
      N.set([p.cls,p.seed,p.w,p.h],4*o);});
    I.set([0,1,2,0,2,3].map(v=>v+k*4),6*k);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
  g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.setAttribute('info',new THREE.BufferAttribute(N,4));g.setIndex(new THREE.BufferAttribute(I,1));g.computeBoundingSphere();
  const m=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,side:THREE.FrontSide,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const on=step(.001,atmosphere.night);
  m.positionNode=positionLocal.mul(on);
  const info=varying(attribute('info','vec4')),cls=info.x,seed=info.y,w=info.z,h=info.w,uvn=uv();
  const dist=max(length(positionWorld.sub(cameraPosition)),.1),pxm=screenSize.y.mul(cameraProjectionMatrix.element(1).y).div(dist.mul(2));   // pixels per metre
  const e=min(min(uvn.x,float(1).sub(uvn.x)).mul(w),min(uvn.y,float(1).sub(uvn.y)).mul(h));   // metres to the nearest edge
  const reveal=smoothstep(.02,.1,e).mul(.45).add(.55);
  const room=uvn.y.mul(.3).add(.7).mul(reveal).mul(mix(float(.65),float(1),smoothstep(.06,.16,uvn.y)))
    .mul(float(1).sub(float(1).sub(smoothstep(.015,.035,abs(uvn.x.sub(.5)).mul(w))).mul(step(.55,seed)).mul(step(.8,w)).mul(.7)))
    .mul(float(1).sub(step(seed,.25).mul(float(1).sub(step(.5,uvn.x))).add(step(.25,seed).mul(step(seed,.45)).mul(step(.5,uvn.x))).mul(.5)));
  const slat=mod(uvn.y.mul(h).div(.11),1),gap=smoothstep(0,.2,slat).mul(float(1).sub(smoothstep(.3,.5,slat)));
  const louvre=max(mix(float(.22),gap,smoothstep(2.5,5,pxm.mul(.11))).mul(.6),float(1).sub(smoothstep(.01,.03,abs(uvn.x.sub(.5)).mul(w))).mul(.8));
  const seam=mix(float(.15),max(float(1).sub(smoothstep(.015,.05,e)),smoothstep(.84,.9,uvn.y).mul(.7)),smoothstep(1,4,pxm.mul(.05)));
  const shape=mix(mix(room,louvre,step(.5,cls)),seam,step(1.5,cls));
  const footprint=mix(float(.6),float(1),smoothstep(.4,1.4,sqrt(w.mul(h)).mul(pxm)));
  // a lit window reads brighter against a dark facade from afar than its share of a pixel: a gentle boost with distance
  // (up to 1.5× past ~500 m), then the haze takes it
  const fade=float(1).sub(smoothstep(WINDOW_FADE[0],WINDOW_FADE[1],dist).mul(.7)).mul(smoothstep(120,500,dist).mul(.5).add(1));
  m.colorNode=vec4(attribute('color','vec3').mul(shape).mul(footprint).mul(fade).mul(atmosphere.night).mul(GLOW.windowGain),1);
  const mesh=new THREE.Mesh(g,m);mesh.name='sj-glow-windows';mesh.renderOrder=4;mesh.castShadow=mesh.receiveShadow=false;
  return mesh;
}

// ---- Floodlighting plan (references §2; placements inferred from the wall and monument records, not a fixture survey) ----
// Wall runs: a flood a few metres out from the foot every `spacing` metres along the run's stations (outward normal,
// outer foot `ground`, `top`), on dry ground only, power varied per flood and some left out, so the wash is uneven.
const FLOOD_RUNS=[
  // L7 west city walls along the Paseo del Morro and the Puerta de San Juan: selective warm washes, low cadence.
  {area:'gate',stations:w=>w.gate?.stations,spacing:17,skip:.2,power:1,radius:14,minHeight:4,warmth:1},
  // L2 the Princesa wall: warm gold treatment.
  {area:'princesa',stations:w=>w.princesa?.stations,spacing:15,skip:.1,power:.9,radius:14,minHeight:4,warmth:1},
  // L5 El Morro: low glancing washes on the land front a rider sees from the lawn path and the bridge, and on the bay
  // faces; not the Atlantic front, not the upper terraces.
  {area:'fort-land',stations:w=>w.fort?.runs?.find(r=>r.name==='land')?.stations,spacing:12,skip:.12,power:1.3,radius:15,minHeight:5,warmth:.85},
  {area:'morro-bay',stations:w=>w.forttops?.fronts?.find(f=>f.fort==='morro'&&f.name==='bay-face')?.stations,spacing:20,skip:.2,power:1.1,radius:16,minHeight:5,warmth:.85},
  {area:'morro-santa-barbara',stations:w=>w.forttops?.fronts?.find(f=>f.fort==='morro'&&f.name==='santa-barbara')?.stations,spacing:26,skip:.3,power:.8,radius:14,minHeight:5,warmth:.85},
  // L6 San Cristóbal: accents on the faces seen from Plaza Colón, the ramp and Norzagaray (west and south-west); its
  // seaward fronts stay dark. The cavalier and Trinidad faces rise above the outer walls; their floods stand on the fort's
  // own (closed) grounds (`inside`).
  {area:'cristobal-gate-west',stations:w=>w.cristobal?.runs?.find(r=>r.name==='gate-west')?.stations,spacing:12,skip:0,power:1.1,radius:13,minHeight:4,warmth:.85},
  {area:'cristobal-land',stations:w=>w.cristobal?.runs?.find(r=>r.name==='land')?.stations,spacing:14,skip:.1,power:1.1,radius:13,minHeight:3,warmth:.85},
  {area:'cristobal-cavalier-west',inside:true,stations:w=>w.forttops?.fronts?.find(f=>f.fort==='cristobal'&&f.name==='cavalier-west')?.stations,spacing:16,skip:.15,power:1.1,radius:14,minHeight:5,warmth:.85},
  {area:'cristobal-trinidad',inside:true,stations:w=>w.forttops?.fronts?.find(f=>f.fort==='cristobal'&&f.name==='trinidad')?.stations,spacing:18,skip:.15,power:.9,radius:13,minHeight:4,warmth:.85},
];
export const FLOOD_GROUPS=FLOOD_RUNS.map(r=>r.area);
/** Register the floodlights for a built world (called by buildGlow before the bake). Returns counts per group and the
 * groups whose records are missing (`missing`; the test fails on any). */
export function planFloods(world){
  const counts={missing:[]},dry=(x,z)=>!world.isDry||world.isDry(x,z),add=(k,n=1)=>counts[k]=(counts[k]??0)+n;
  for(const run of FLOOD_RUNS){const st=run.stations(world);if(!Array.isArray(st)||st.length<2){counts.missing.push(run.area);continue;}
    // Walk the run; once `spacing` metres have passed, the next eligible station (tall enough, dry ground in front) takes a
    // flood and the walk restarts from it, carrying nothing over (so a run of ineligible stations is skipped, not lost).
    let walked=run.spacing/2;
    for(let i=1;i<st.length;i++){const a=st[i-1],b=st[i];walked+=Math.hypot(b.x-a.x,b.z-a.z);if(walked<run.spacing)continue;
      // the foot a rider sees: the ground in front of the face where it is lower than the record's (a terreplein or ramp
      // record stands above the street the face rises from)
      const off=4.5,sx=b.x+b.nx*off,sz=b.z+b.nz*off,foot=Math.min(b.ground,world.height?.(sx,sz)??b.ground),h=b.top-foot;if(!(h>=run.minHeight)||!dry(sx,sz))continue;
      walked=0;if(hash01(b.x,b.top,b.z,7)<run.skip)continue;
      glowFlood(sx,foot,sz,{dx:-b.nx,dz:-b.nz,height:h+1.5,power:run.power*(.65+.45*hash01(b.x,b.top,b.z,11)),warmth:run.warmth,radius:run.radius,inside:!!run.inside});add(run.area);}
    if(!counts[run.area])counts.missing.push(run.area);}
  // Fort entrances (L5, L6): the gate seen down its bridge or ramp, lit from in front of the portal.
  for(const [k,label] of [['fort','morro-entrance'],['cristobal','cristobal-entrance']]){const a=world[k],F=a?.frame,e=a?.entrance;
    if(!F?.P||!e){counts.missing.push(label);continue;}const [px,pz]=F.P(e.uFront,0),[sx,sz]=F.P(e.uFront-9,0),d=Math.hypot(px-sx,pz-sz);
    const top=e.portalTop??(e.deckY+9);glowFlood(sx,e.deckY,sz,{dx:(px-sx)/d,dz:(pz-sz)/d,height:top-e.deckY+3,power:1.5,warmth:.85,radius:13});add(label);}
  // L6 San Cristóbal from Plaza Colón: the two highest masonry returns that face the plaza (land run, hornwork,
  // cavalier) get a stronger grazing flood, so the fort reads above the street fronts; nothing on its seaward fronts.
  {const C=[496,-87],cand=[];
    for(const st of [world.cristobal?.runs?.find(r=>r.name==='land')?.stations,...['hornwork','cavalier-west'].map(n=>world.forttops?.fronts?.find(f=>f.fort==='cristobal'&&f.name===n)?.stations)])
      for(const s of st??[]){const dx=C[0]-s.x,dz=C[1]-s.z,d=Math.hypot(dx,dz);if((s.nx*dx+s.nz*dz)/d>.6&&dry(s.x+s.nx*4.5,s.z+s.nz*4.5))cand.push(s);}
    cand.sort((a,b)=>b.top-a.top);const picked=[];for(const s of cand){if(picked.length>=2)break;if(picked.every(p=>Math.hypot(p.x-s.x,p.z-s.z)>15))picked.push(s);}
    if(!picked.length)counts.missing.push('colon-accent');
    for(const s of picked){const sx=s.x+s.nx*4.5,sz=s.z+s.nz*4.5,foot=Math.min(s.ground,world.height?.(sx,sz)??s.ground);
      glowFlood(sx,foot,sz,{dx:-s.nx,dz:-s.nz,height:s.top-foot+1.5,power:2.6,warmth:.85,radius:12,inside:true});add('colon-accent');}}
  // Garitas on the landward and bay sides picked out from below (L5, L7); none on the Atlantic side.
  for(const g of [...(world.fort?.garitas??[]),...(world.gate?.garitas??[])]){if(!(g.wallNz>-.5))continue;
    const sx=g.x+g.wallNx*6,sz=g.z+g.wallNz*6;if(!dry(sx,sz))continue;const ground=world.height?.(sx,sz);if(!Number.isFinite(ground)||g.y-ground<3)continue;
    glowFlood(sx,ground,sz,{dx:-g.wallNx,dz:-g.wallNz,height:g.y-ground+4,power:.9,warmth:.85,radius:10});add('garitas');}
  // L7: the Puerta de San Juan picked out (the portal and its arch base), a little stronger than the run.
  {const g=world.gate,st=g?.stations;if(st&&Number.isFinite(g.gateS)){let best=null;for(const s of st)if(!best||Math.abs(s.s-g.gateS)<Math.abs(best.s-g.gateS))best=s;
    if(best){glowFlood(best.x+best.nx*5,best.ground,best.z+best.nz*5,{dx:-best.nx,dz:-best.nz,height:best.top-best.ground+1,power:1.4,radius:12});add('gate-portal');}}}
  // L8 the Capitol: ivory on the two porticos (from the foot of their steps) and the dome (from the roof round it).
  {const c=world.eastcivic,F=c?.frame;if(F?.W){
    for(const p of c.porticos??[]){const out=Math.sign(p.va-p.vb)||1,v=p.va+out*5;
      for(const t of [.15,.5,.85]){const [x,z]=F.W(p.u0+(p.u1-p.u0)*t,v);glowFlood(x,p.lo,z,{dx:-F.s[0]*out,dz:-F.s[1]*out,height:20,power:1.6,warmth:.1,radius:16});add('capitol-portico');}}
    // the dome: six floods from the roof round it, uneven in power so it reads as a lit volume, not a flat white cap
    const d=c.dome;if(d?.centre&&Number.isFinite(d.y0)){const H=(d.attic??0)+(d.drum??0)+(d.rise??0)+(d.lantern??0);
      for(let k=0;k<6;k++){const a=k*Math.PI/3,rr=d.r+5,x=d.centre[0]+Math.cos(a)*rr,z=d.centre[1]+Math.sin(a)*rr;
        glowFlood(x,d.y0,z,{dx:-Math.cos(a),dz:-Math.sin(a),height:H+1,power:[1.7,1.05,1.5,.85,1.6,1.15][k],warmth:.15,radius:13,through:true});add('capitol-dome');}}}}
  // L2 Raíces: the basin and the edges of the figures from just outside the rim (not the whole water).
  {const f=world.princesa?.fountain;if(f&&Number.isFinite(f.x)){for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4,rr=(f.stepRadius??f.radius)+3;
    glowFlood(f.x+Math.cos(a)*rr,f.stepTop??f.bottom??0,f.z+Math.sin(a)*rr,{dx:-Math.cos(a),dz:-Math.sin(a),height:7,power:.8,warmth:.75,radius:10});add('raices');}}}
  // L10 the cathedral: a restrained accent at the central portal and steps only.
  {const c=world.corridor?.cathedral,fr=c?.frame;if(fr?.point&&c.doors?.length){const door=c.doors[c.doors.length>>1],[x,,z]=fr.point(door.u,0,6);
    glowFlood(x,c.ground,z,{dx:-fr.nx,dz:-fr.nz,height:(c.roof-c.ground)+2,power:.8,warmth:.8,radius:12});add('cathedral');}}
  // L3 a modest civic accent on the Alcaldía front over the plaza.
  {const b=world.city?.buildings?.find(q=>q.id===252692668);if(b){const r=b.outer,signed=r.reduce((s,a,i)=>{const c=r[(i+1)%r.length];return s+a[0]*c[1]-c[0]*a[1];},0);
    let best=null;for(let i=0;i<r.length;i++){let a=r[i],e=r[(i+1)%r.length];if(signed>0)[a,e]=[e,a];const L=Math.hypot(e[0]-a[0],e[1]-a[1]),ux=(e[0]-a[0])/L,uz=(e[1]-a[1])/L,nx=-uz,nz=ux;
      if(nz>.8&&(!best||L>best.L))best={a,ux,uz,nx,nz,L};}
    if(best)for(const t of [.3,.7]){const x=best.a[0]+best.ux*best.L*t+best.nx*6,z=best.a[1]+best.uz*best.L*t+best.nz*6,g=world.height?.(x,z);
      if(Number.isFinite(g)){glowFlood(x,g,z,{dx:-best.nx,dz:-best.nz,height:(b.roof??g+12)-g+3,power:.6,warmth:.6,radius:12});add('alcaldia');}}}}
  return counts;
}

/** End of the world build: bake the field, add the light and the halos. Returns {field, light, halos, stats, dispose}. */
export function buildGlow(scene,world,{buildings:shells}={}){
  const floodPlan=planFloods(world),fixtures=glowFixtures(),buildings=shells??world.city?.buildings??[];
  const t0=globalThis.performance?.now?.()??0,field=bakeField(fixtures,buildings),bakeMs=(globalThis.performance?.now?.()??0)-t0;
  let light=null,halos=null;
  if(field){field.textureA=fieldTexture(field,'a');field.textureB=fieldTexture(field,'b');field.textureC=fieldTexture(field,'c');
    light=new GlowLight(field);light.name='sj-glow-light';scene.add(light);}
  const lighthouse=fixtures.lamps.find(l=>l.kind==='lighthouse');
  halos=haloMesh(fixtures.lamps,lighthouse);if(halos)scene.add(halos);
  const lit=litPanes(fixtures.panes),windows=windowMesh(lit);if(windows)scene.add(windows);
  beginGlow();   // the registry is consumed: release it
  const byKind={};for(const l of fixtures.lamps)byKind[l.kind]=(byKind[l.kind]??0)+1;
  const panesByKind={};for(let i=6;i<fixtures.panes.length;i+=7){const k=PANE_LIST[fixtures.panes[i]];panesByKind[k]??=[0,0];panesByKind[k][0]++;}
  for(const p of lit)panesByKind[p.kind][1]++;
  const stats={bakeParts:field?.times,lamps:fixtures.lamps.length,floods:fixtures.floods.length,floodPlan,byKind,panes:fixtures.panes.length/7,lit:lit.length,panesByKind,bakeMs,
    field:field?{nx:field.nx,nz:field.nz,texel:field.texel,bytes:field.nx*field.nz*12}:null};
  return {field,light,halos,windows,stats,fixtures:GLOW_DIAGNOSTICS.keep?fixtures:null,
    dispose(){if(light)scene.remove(light);if(halos){scene.remove(halos);halos.geometry.dispose();halos.material.dispose();}
      if(windows){scene.remove(windows);windows.geometry.dispose();windows.material.dispose();}
      field?.textureA?.dispose();field?.textureB?.dispose();field?.textureC?.dispose();}};
}
export {KIND_LIST};
