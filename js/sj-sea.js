/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Sea and small-water surfaces — © 2026 VibezZzCoder, MIT. One unlit node material on the coast's sea grid (y = 0, flat:
// no vertex displacement, so the drawn water line is the physical one) and a simpler variant for fountains and the pond.
// Everything is analytic and reads the shared time-of-day uniforms (js/sj-atmosphere.js), so the water agrees with the sky
// at every hour: wave normals from a few band-limited directional waves (detail the pixel cannot resolve becomes
// roughness instead of sparkle), Fresnel reflection of the sky gradient, the sun's specular path, the body colour from the
// reference tints, shallows and surf from a baked shore-distance texture, and the far sea melting into the haze.
// References (colour and surface, view only):
//  - Wikimedia Commons curid=123485577, curid=72372087, curid=86543901: turquoise over the north-shore reef shelf, deep
//    Atlantic blue offshore, a white surf line breaking on the rock shelf below La Perla and El Morro.
//  - Wikimedia Commons curid=114692556 (Paseo del Morro): calm, greener bay water along the wall, small chop, no surf.
//  - Wikimedia Commons curid=123441024, curid=106059407 (La Puntilla quays): dark green harbour water against the quay
//    face, a thin lapping line only.
import * as THREE from 'three/webgpu';
import {Fn,attribute,vertexColor,vec2,vec3,float,positionWorld,cameraPosition,normalize,dot,max,mix,pow,sin,cos,smoothstep,
  saturate,fwidth,dFdx,dFdy,abs,exp,fract,length,min,texture,reflect,oneMinus,select,uniform,frontFacing} from '../vendor/three/build/three.tsl.js';
import {atmosphere} from './sj-atmosphere.js';

const TAU=Math.PI*2,G=9.81;
// Directional waves [wavelength m, travel bearing ° (clockwise from north; north is −z, east +x), peak slope, group].
// Trade winds from the east-northeast push wind waves toward the west-southwest; the winter Atlantic swell arrives
// from the north/north-northeast. No two trains are both near-parallel and of similar length, and wavelengths are
// mutually incommensurate. Groups: 0 swell (open Atlantic only), 1 wind waves (calmer in the bay), 2 ripples.
const dirOf=b=>[Math.sin(b*Math.PI/180),-Math.cos(b*Math.PI/180)];
const WAVES=[[83,195,.016,0],[53,163,.013,0],
  [19.3,250,.026,1],[12.7,224,.022,1],[8.3,276,.020,1],[5.6,206,.017,1],
  [3.1,241,.020,2],[2.05,291,.018,2],[1.33,214,.016,2],[.87,261,.014,2]].map(([l,b,s,g])=>[l,...dirOf(b),s,g]);
const RIPPLES=[[.61,-.8,.6,.05],[.37,.3,.95,.045],[.23,-.97,-.24,.04]];   // fountains and the pond
const FIELD={lo:-6,range:96};    // shore-distance texture: metres stored as (d − lo) / range in one byte (0.38 m steps)

const v3=c=>{const k=new THREE.Color(c);return vec3(k.r,k.g,k.b);};
const TURQUOISE=v3('#3a9c98'),SEABED=v3('#8fb8a4'),UNDERSIDE=v3('#0e3b40');

// Fresnel (Schlick, water F0 = 0.02).
const fresnel=(c,floor=0)=>float(.02).add(float(.98).mul(pow(oneMinus(max(saturate(c),floor)),5)));

// Sky radiance seen along the reflected direction: horizon → zenith, a little brighter toward the sun's azimuth
// (the west glow at golden and blue hour), plus a soft halo round the sun itself.
// When the atmosphere publishes a sunward haze colour (hazeSun, hazeLobe) the horizon takes it toward the sun's azimuth.
// Horizon colour toward the reflected ray's azimuth. With the atmosphere's sunward haze (`hazeSun`, `hazeLobe`) this is
// the sky's own horizon formula, haze → sunward haze by pow(½ + ½·cos, lobe), without its forward glow: a reflected ray
// that points well above the horizon must not pick up horizon-strength glow; the halo term below carries the glow.
const towardSun=(base,az,brighten)=>atmosphere.hazeSun?mix(base,atmosphere.hazeSun,pow(az,atmosphere.hazeLobe??float(2))):base.mul(float(1).add(pow(az,3).mul(brighten)));
const horizonAlong=(R,L)=>{const f=vec2(R.x,R.z),s=vec2(L.x,L.z),c=dot(f.div(max(length(f),1e-4)),s.div(max(length(s),1e-4)));
  return atmosphere.hazeSun?mix(atmosphere.haze,atmosphere.hazeSun,pow(saturate(c.mul(.5).add(.5)),atmosphere.hazeLobe??float(2)))
    :towardSun(atmosphere.skyHorizon,saturate(c),.35);};
const skyAlong=(R,L)=>{const ry=saturate(R.y),near=oneMinus(ry).mul(oneMinus(ry));
  const horizon=mix(atmosphere.skyHorizon,horizonAlong(R,L),atmosphere.hazeSun?float(1):near);
  return mix(horizon,atmosphere.skyZenith,pow(ry,.55)).add(atmosphere.sunColor.mul(pow(saturate(dot(R,L)),12).mul(.05)));};

// The sun's specular reflection: GGX distribution, Schlick Fresnel, Kelemen visibility. a2 is roughness squared.
const sunSpecular=(n,V,L,a2)=>{const H=normalize(L.add(V)),nh=saturate(dot(n,H)),nl=saturate(dot(n,L)),lh=max(saturate(dot(L,H)),.1);
  const d=nh.mul(nh).mul(a2.sub(1)).add(1),D=a2.div(d.mul(d).mul(Math.PI));
  return atmosphere.sunColor.mul(D.mul(fresnel(lh)).mul(nl).div(lh.mul(lh).mul(4)).min(5)).mul(smoothstep(-.02,.04,L.y));};

// Light arriving at the water from above (radiance-equivalent, ÷π): direct sun on a level surface plus the sky dome.
const downwelling=L=>atmosphere.sunColor.mul(saturate(L.y)).div(Math.PI).add(mix(atmosphere.skyHorizon,atmosphere.skyZenith,.55));

// Sum of band-limited directional waves at p (xz). Each wave fades out once its wavelength spans fewer than ~8 pixels
// along its own direction (`along(dx,dz)` = metres per pixel that way); the slope variance it would have added moves
// into roughness instead. `packets`: swell and wind trains get short drifting envelopes and a phase warp (below).
function waveSlopes(waves,p,t,along,gain,packets=false){let sx=float(0),sz=float(0),lost=float(0);
  waves.forEach(([lambda,dx,dz,slope,group],i)=>{const k=TAU/lambda,w=Math.sqrt(G*k);let amp=float(slope).mul(gain(group,i));
    // Swell and wind trains: a drifting packet envelope (crests ~2.5 wavelengths long, ~4 across).
    if(packets&&group<2)amp=amp.mul(sin(p.x.mul(-dz*k/2.5+dx*k/4.3).add(p.y.mul(dx*k/2.5+dz*k/4.3)).sub(t.mul(w/8.6)).add(i*2.3)).mul(.5).add(.55));
    const fade=smoothstep(3,8,float(lambda).div(max(along(dx,dz),1e-4))),c=cos(p.x.mul(dx*k).add(p.y.mul(dz*k)).sub(t.mul(w)).add(i*1.7)).mul(amp).mul(fade);
    sx=sx.add(c.mul(dx));sz=sz.add(c.mul(dz));lost=lost.add(amp.mul(amp).mul(.5).mul(oneMinus(fade.mul(fade))));});
  return {n:normalize(vec3(sx.negate(),1,sz.negate())),lost};}

// Shore-distance field: signed metres from the waterline that is actually drawn (positive over water, negative over dry
// ground), one texel per terrain sample (2 m). The drawn ground is the terrain's emitted cells on their drawn diagonal
// (`flip`: cells split the other way), plus explicit triangles (the coast's fill ground and shore faces). It is
// sampled on a 0.5 m lattice around every place where it can cross the water line, the y = 0 contour is traced there,
// and exact distances to that contour are carried over the whole grid by two raster passes (nearest-point
// propagation). Built once at construction; only the texture is kept.
export function shoreField(grid,{heights=null,flip=[],triangles=[],cuts=[]}={}){
  const {land,x0,z0,nx,nz,step}=grid,SUB=4,ds=step/SUB,WATER=-1,NEAR=3;
  const H=heights??Float32Array.from(land,v=>v?1:WATER);
  // Per cell: 1 emitted (drawn terrain), 2 split along a–d (flipped), 4 has render cuts, 8 has explicit triangles.
  const cell=new Uint8Array(nx*nz);
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const k=j*nx+i;if(land[k]&&land[k+1]&&land[k+nx]&&land[k+nx+1])cell[k]=1;}
  for(const f of flip)for(const k of f)if(k>=0&&k<cell.length)cell[k]|=2;
  // Explicit triangles that reach within NEAR m of the water line (higher floors cannot meet it), in 2 m buckets;
  // render cuts (convex plan rings) likewise. Vertical triangles have no plan area and are skipped.
  const tris=[],tBuckets=new Map(),cBuckets=new Map();
  const stamp=(map,bit,a,b,c,d,item)=>{for(let j=Math.max(0,Math.floor((c-z0)/step));j<=Math.min(nz-1,Math.floor((d-z0)/step));j++)
    for(let i=Math.max(0,Math.floor((a-x0)/step));i<=Math.min(nx-1,Math.floor((b-x0)/step));i++){const k=j*nx+i;cell[k]|=bit;let l=map.get(k);if(!l)map.set(k,l=[]);l.push(item);}};
  for(const [A,B,C] of triangles){if(Math.min(A[1],B[1],C[1])>NEAR)continue;const area=(B[0]-A[0])*(C[2]-A[2])-(B[2]-A[2])*(C[0]-A[0]);if(Math.abs(area)<1e-6)continue;
    const t=[A,B,C,area];tris.push(t);stamp(tBuckets,8,Math.min(A[0],B[0],C[0]),Math.max(A[0],B[0],C[0]),Math.min(A[2],B[2],C[2]),Math.max(A[2],B[2],C[2]),t);}
  for(const r of cuts){let a=Infinity,b=-Infinity,c=Infinity,d=-Infinity;for(const q of r){if(q[0]<a)a=q[0];if(q[0]>b)b=q[0];if(q[1]<c)c=q[1];if(q[1]>d)d=q[1];}stamp(cBuckets,4,a,b,c,d,r);}
  const inConvex=(x,z,r)=>{let sgn=0;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],c=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);
    if(c>1e-9){if(sgn<0)return false;sgn=1;}else if(c<-1e-9){if(sgn>0)return false;sgn=-1;}}return true;};
  // Terrain height in cell k at local (u,v) ∈ [0,1]², on the drawn split.
  const cellHeight=(k,u,v)=>{const a=H[k],b=H[k+1],c=H[k+nx],d=H[k+nx+1];
    if(cell[k]&2)return u>=v?a+(b-a)*u+(d-b)*v:a+(c-a)*v+(d-c)*u;   // split a–d
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);};   // split b–c
  // Drawn height at lattice point (I,J) (0.5 m steps from x0,z0): the highest drawn surface over it, else water.
  // A point on a cell edge or corner belongs to every cell that touches it.
  const at=(I,J)=>{const x=x0+I*ds,z=z0+J*ds,ci=Math.floor(I/SUB),cj=Math.floor(J/SUB),iLo=I%SUB?ci:ci-1,jLo=J%SUB?cj:cj-1;let best=-Infinity,cut=false;
    for(let j=Math.max(0,jLo);j<=Math.min(nz-1,cj);j++)for(let i=Math.max(0,iLo);i<=Math.min(nx-1,ci);i++){const k=j*nx+i,f=cell[k];
      if(f&4&&!cut)for(const r of cBuckets.get(k))if(inConvex(x,z,r)){cut=true;break;}
      if(f&8)for(const [A,B,C,area] of tBuckets.get(k)){
        const w1=((x-A[0])*(C[2]-A[2])-(z-A[2])*(C[0]-A[0]))/area,w2=((B[0]-A[0])*(z-A[2])-(B[2]-A[2])*(x-A[0]))/area;
        if(w1<-1e-6||w2<-1e-6||w1+w2>1+1e-6)continue;const y=A[1]+(B[1]-A[1])*w1+(C[1]-A[1])*w2;if(y>best)best=y;}}
    if(!cut)for(let j=Math.max(0,jLo);j<=Math.min(nz-2,cj);j++)for(let i=Math.max(0,iLo);i<=Math.min(nx-2,ci);i++){const k=j*nx+i;
      if(cell[k]&1){const y=cellHeight(k,Math.min(1,I/SUB-i),Math.min(1,J/SUB-j));if(y>best)best=y;}}
    return best===-Infinity?WATER:best;};
  // Node heights; the water line can only pass through cells whose corners disagree, or that carry low triangles or
  // cuts next to low ground.
  const N=new Float32Array(nx*nz);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i;
    const near=(cell[k]|(i>0?cell[k-1]:0)|(j>0?cell[k-nx]:0)|(i>0&&j>0?cell[k-nx-1]:0));
    N[k]=near&12?at(i*SUB,j*SUB):near&1?H[k]:WATER;}
  const seg=[],v=new Float32Array((SUB+1)*(SUB+1)),cross=(xa,za,ya,xb,zb,yb)=>{const t=ya/(ya-yb);return [xa+(xb-xa)*t,za+(zb-za)*t];};
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const k=j*nx+i,s0=N[k]>=0;
    const mixed=(N[k+1]>=0)!==s0||(N[k+nx]>=0)!==s0||(N[k+nx+1]>=0)!==s0;
    if(!mixed&&!((cell[k]&12)&&Math.min(N[k],N[k+1],N[k+nx],N[k+nx+1])<NEAR))continue;
    for(let b=0;b<=SUB;b++)for(let a=0;a<=SUB;a++)v[b*(SUB+1)+a]=(a%SUB||b%SUB)?at(i*SUB+a,j*SUB+b):N[k+(b?nx:0)+(a?1:0)];
    for(let b=0;b<SUB;b++)for(let a=0;a<SUB;a++){const q0=v[b*(SUB+1)+a],q1=v[b*(SUB+1)+a+1],q2=v[(b+1)*(SUB+1)+a+1],q3=v[(b+1)*(SUB+1)+a];
      const e0=q0>=0,e1=q1>=0,e2=q2>=0,e3=q3>=0;if(e0===e1&&e1===e2&&e2===e3)continue;
      const X=x0+(i*SUB+a)*ds,Z=z0+(j*SUB+b)*ds,hits=[];
      if(e0!==e1)hits.push(cross(X,Z,q0,X+ds,Z,q1));if(e1!==e2)hits.push(cross(X+ds,Z,q1,X+ds,Z+ds,q2));
      if(e2!==e3)hits.push(cross(X+ds,Z+ds,q2,X,Z+ds,q3));if(e3!==e0)hits.push(cross(X,Z+ds,q3,X,Z,q0));
      seg.push(hits[0][0],hits[0][1],hits[1][0],hits[1][1]);if(hits.length===4)seg.push(hits[2][0],hits[2][1],hits[3][0],hits[3][1]);}}
  // Nearest contour point per node (squared distance): seeded within 2 cells of each segment, then a forward and a backward raster pass, up to the stored range.
  const px=new Float32Array(nx*nz),pz=new Float32Array(nx*nz),dd=new Float32Array(nx*nz).fill(Infinity);
  for(let s=0;s<seg.length;s+=4){const ax=seg[s],az=seg[s+1],bx=seg[s+2],bz=seg[s+3],ex=bx-ax,ez=bz-az,L2=ex*ex+ez*ez||1e-9;
    const i0=Math.max(0,Math.floor((Math.min(ax,bx)-x0)/step)-2),i1=Math.min(nx-1,Math.ceil((Math.max(ax,bx)-x0)/step)+2);
    const j0=Math.max(0,Math.floor((Math.min(az,bz)-z0)/step)-2),j1=Math.min(nz-1,Math.ceil((Math.max(az,bz)-z0)/step)+2);
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=x0+i*step,z=z0+j*step,t=Math.max(0,Math.min(1,((x-ax)*ex+(z-az)*ez)/L2));
      const cx=ax+ex*t,cz=az+ez*t,d=(x-cx)*(x-cx)+(z-cz)*(z-cz),k=j*nx+i;if(d<dd[k]){dd[k]=d;px[k]=cx;pz[k]=cz;}}}
  const CAP=(FIELD.range+FIELD.lo)**2,relax=(k,i,j,n)=>{if(dd[n]===Infinity)return;const ex=x0+i*step-px[n],ez=z0+j*step-pz[n],d=ex*ex+ez*ez;if(d<dd[k]&&d<CAP){dd[k]=d;px[k]=px[n];pz[k]=pz[n];}};
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i;if(i>0)relax(k,i,j,k-1);if(j>0){relax(k,i,j,k-nx);if(i>0)relax(k,i,j,k-nx-1);if(i+1<nx)relax(k,i,j,k-nx+1);}}
  for(let j=nz-1;j>=0;j--)for(let i=nx-1;i>=0;i--){const k=j*nx+i;if(i+1<nx)relax(k,i,j,k+1);if(j+1<nz){relax(k,i,j,k+nx);if(i+1<nx)relax(k,i,j,k+nx+1);if(i>0)relax(k,i,j,k+nx-1);}}
  // Width padded to a multiple of 4 (one-byte rows keep the default 4-byte unpack alignment on WebGL2).
  const TW=Math.ceil(nx/4)*4,TH=nz,data=new Uint8Array(TW*TH).fill(255);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,d=(N[k]>=0?-1:1)*(dd[k]===Infinity?FIELD.range:Math.sqrt(dd[k]));
    data[j*TW+i]=Math.round(Math.max(0,Math.min(1,(d-FIELD.lo)/FIELD.range))*255);}
  const tex=new THREE.DataTexture(data,TW,TH,THREE.RedFormat,THREE.UnsignedByteType);
  tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;tex.needsUpdate=true;
  // Texel I is centred on terrain sample I: x0 + I·step.
  return {texture:tex,origin:[x0-step/2,z0-step/2],size:[step*TW,step*TH],texels:[TW,TH],segments:seg.length/4};
}

// The sea material. `field` from shoreField(); the geometry carries `color` (reference body tint) and `exposure`
// (0 sheltered bay … 1 open Atlantic).
export function seaMaterial(field){
  const m=new THREE.MeshBasicNodeMaterial({side:THREE.DoubleSide});m.name='sj-sea';
  const origin=uniform(new THREE.Vector2(...field.origin)),size=uniform(new THREE.Vector2(...field.size));
  m.colorNode=Fn(()=>{
    const P=positionWorld,p0=P.xz,t=atmosphere.elapsed,night=atmosphere.night,L=atmosphere.sunDirection;
    const fp=max(max(fwidth(P.x),fwidth(P.z)),1e-4),dpx=dFdx(p0),dpy=dFdy(p0);
    const along=(dx,dz)=>abs(dpx.x.mul(dx).add(dpx.y.mul(dz))).add(abs(dpy.x.mul(dx).add(dpy.y.mul(dz))));
    const expo=attribute('exposure','float');
    // Shore distance (outside the field's box: open water). Built quays (the bay side east of La Princesa) get no
    // sandy shallows or surf, only a thin lapping line.
    const uv=p0.sub(origin).div(size),inBox=uv.x.greaterThan(0).and(uv.x.lessThan(1)).and(uv.y.greaterThan(0)).and(uv.y.lessThan(1));
    const raw=texture(field.texture,uv).level(0).r,d=select(inBox,raw.mul(FIELD.range).add(FIELD.lo),float(FIELD.range+FIELD.lo));
    const quay=smoothstep(20,60,P.z).mul(smoothstep(-200,-130,P.x)),natural=oneMinus(quay);
    // Waves are evaluated on a slowly warped plane (±9 m over a few hundred metres, drifting) so wave fronts bend
    // instead of running ruler-straight; swell only where open to the Atlantic, shorter, less coherent chop in the bay,
    // everything a little calmer at dusk.
    const p=p0.add(vec2(sin(p0.y.mul(.021).add(sin(p0.x.mul(.013)).mul(1.3)).add(t.mul(.03))),cos(p0.x.mul(.017).sub(sin(p0.y.mul(.011)).mul(1.1)).sub(t.mul(.025)))).mul(9));
    const calm=oneMinus(night.mul(.35));
    const {n,lost}=waveSlopes(WAVES,p,t,along,g=>g===0?expo:g===1?mix(.4,1,expo).mul(calm):mix(1.2,1,expo).mul(calm),true);
    const a2=float(.0016).add(lost.mul(2));
    const toCam=cameraPosition.sub(P),dist=max(length(toCam),1e-3),V=toCam.div(dist);
    const R=reflect(V.negate(),n);
    // World-anchored break-up patterns (smooth sums of warped sines, no hashing): `patch` ~15 m (surf coverage, shelf
    // edge), `lace` ~2 m (foam filaments, sun glitter). Each fades to its mean once the pixel cannot resolve it.
    const patch=saturate(sin(p0.x.mul(.41).add(sin(p0.y.mul(.29)).mul(1.6)).add(t.mul(.05))).mul(sin(p0.y.mul(.37).sub(sin(p0.x.mul(.23)).mul(1.4)).sub(t.mul(.04)))).mul(.45)
      .add(sin(p0.x.mul(.22).add(p0.y.mul(.15)).add(sin(p0.x.mul(.13)).mul(2)).add(t.mul(.07))).mul(.3)).add(.5));
    const laceRaw=sin(p.x.mul(2.1).add(sin(p.y.mul(1.7)).mul(1.3)).sub(t.mul(.6))).mul(sin(p.y.mul(2.3).add(sin(p.x.mul(1.3)).mul(1.1)).add(t.mul(.5))))
      .mul(.6).add(sin(p.x.mul(.83).add(sin(p.y.mul(.51)).mul(1.7)).add(t.mul(.3))).mul(sin(p.y.mul(.97).sub(sin(p.x.mul(.43)).mul(1.9)).sub(t.mul(.25)))).mul(.4));
    const lace=mix(.5,laceRaw.mul(.5).add(.5),smoothstep(1.5,4,float(1.2).div(fp)));
    // Body colour: the reference tint, clear turquoise over the shallow shelf (its edge wanders with `patch`), the pale
    // seabed right at the contact. Turquoise is strong on the exposed north shore, muted and greener in the bay.
    const shelf=oneMinus(smoothstep(3,mix(35,70,patch),d)).mul(natural).mul(mix(.3,1,expo)),sand=oneMinus(smoothstep(-1,5,d)).mul(natural);
    // Over the seabed the sun's caustics show as a faint shifting brightness (the same lace pattern).
    const tint=mix(mix(vertexColor().rgb,TURQUOISE,shelf.mul(.85)),SEABED.mul(lace.mul(.4).add(.8)),sand.mul(.45));
    const E=downwelling(L),F=fresnel(dot(n,V),.17).mul(oneMinus(sand.mul(.3)));
    // Sun glitter: an irregular field of short glints. Value noise (an arithmetic hash, no sin, so it is
    // exact on every GPU); any sine-based break-up, however warped, draws regular zig-zag rows. The noise cells are
    // stretched 4x along the sun's azimuth (world-fixed for a given hour): looking down the glitter path the view runs
    // along the sun, so glints stay resolvable as short streaks at grazing angles. Each cell axis fades by the pixel
    // footprint along it, so unresolved glints relax to a smooth lobe without aliasing. A ~70 m gust modulation varies
    // the contrast (rough patches, calm streaks). The mask 1 + k·g keeps the lobe's mean.
    const sun2=normalize(vec2(L.x,L.z).add(vec2(1e-4,0)));
    const glintNoise=(cell,turn,drift)=>{const c=Math.cos(turn),s2=Math.sin(turn);
      const ax=sun2.x.mul(c).sub(sun2.y.mul(s2)),az=sun2.x.mul(s2).add(sun2.y.mul(c));          // stretched axis (near the sun's azimuth)
      const u=p.x.mul(az.negate()).add(p.y.mul(ax)).add(t.mul(drift)).div(cell),v=p.x.mul(ax).add(p.y.mul(az)).add(t.mul(drift*.37)).div(cell*4);
      const iu=u.floor(),iv=v.floor(),fu=u.sub(iu),fv=v.sub(iv);
      const h=(a,b)=>{const x=fract(iu.add(a).mul(.1031)),y=fract(iv.add(b).mul(.1030)),z=fract(iu.add(a).add(iv.add(b)).mul(.0973));
        const d=x.mul(y.add(33.33)).add(y.mul(z.add(33.33))).add(z.mul(x.add(33.33)));return fract(x.add(d).add(y.add(d)).mul(z.add(d)));};
      const su=fu.mul(fu).mul(float(3).sub(fu.mul(2))),sv=fv.mul(fv).mul(float(3).sub(fv.mul(2)));
      const resolved=smoothstep(2.5,5,float(cell).div(max(along(az.negate(),ax),1e-4))).mul(smoothstep(2.5,5,float(cell*4).div(max(along(ax,az),1e-4))));
      return mix(mix(h(0,0),h(1,0),su),mix(h(0,1),h(1,1),su),sv).sub(.5).mul(resolved);};
    const g=glintNoise(2.3,.21,.9).mul(.85);   // the finer near break-up comes from `lace`
    const gust=sin(p0.x.mul(.087).add(sin(p0.y.mul(.051)).mul(2.1)).add(t.mul(.07))).mul(sin(p0.y.mul(.067).sub(p0.x.mul(.029)).sub(t.mul(.05)))).mul(.5).add(.5);
    const glint=mix(float(1),smoothstep(.3,.75,lace).mul(1.6).add(.2),smoothstep(1.5,4,float(1.2).div(fp)))
      .mul(max(float(.25),float(1).add(g.mul(mix(1.6,3.4,gust)))));
    // Where the waves are unresolved (far field, high cameras) the highlight is a blurred lobe; its luminance is kept
    // below the tone mapper's white so it reads as a cream glitter band, while sharp near glints keep their full peak.
    const spec=sunSpecular(n,V,L,a2).mul(glint),lum=max(dot(spec,vec3(.2126,.7152,.0722)),1e-4);
    const specCap=mix(float(4),float(.6),smoothstep(.0018,.0035,a2));
    let col=tint.mul(E).mul(oneMinus(F)).add(skyAlong(R,L).mul(F)).add(spec.mul(min(float(1),specCap.div(lum))));
    // Surf. The main swell's phase drives a surge: the wash runs up the contact and drains back. Its width and coverage
    // vary with `patch` (dark gaps between washes, never one continuous band), `lace` cuts it into filaments, draining
    // water leaves a lacy remnant further out, and on the exposed shore an occasional broken crest rolls in from
    // ~45 m. Seen from far away the bands widen to at least ~1.5 pixels and dim by the same ratio, so they never flicker.
    const phase=p.x.mul(WAVES[0][1]*TAU/WAVES[0][0]).add(p.y.mul(WAVES[0][2]*TAU/WAVES[0][0])).sub(t.mul(Math.sqrt(G*TAU/WAVES[0][0]))).add(patch.mul(2.2));
    const surge=sin(phase).mul(.5).add(.5);
    const width=mix(mix(.5,3.2,expo),.35,quay),fw=width.mul(surge.mul(.85).add(.35)).mul(patch.mul(.8).add(.5)),fwEff=max(fw,fp.mul(1.5));
    const wash=oneMinus(smoothstep(0,fwEff,d)).mul(smoothstep(-2.2,-.3,d)).mul(fw.div(fwEff));
    const cover=mix(.35,1.3,patch).mul(mix(.6,1,expo).add(quay.mul(.4)));
    const rim=smoothstep(.35,.7,wash.mul(cover).add(lace.sub(.5).mul(.8)));
    const drainAt=fw.mul(1.4).add(oneMinus(surge).mul(width).mul(1.2)),drainW=max(width.mul(.6).add(.6),fp.mul(1.5));
    const remnant=exp(d.sub(drainAt).div(drainW).mul(d.sub(drainAt).div(drainW)).negate()).mul(oneMinus(surge)).mul(patch).mul(expo).mul(natural);
    const lacy=smoothstep(.5,.8,remnant.mul(.9).add(lace.sub(.5).mul(.9))).mul(.7);
    const crestAt=oneMinus(fract(phase.div(TAU))).mul(38).add(7),crestW=max(float(.8),fp.mul(1.5));
    const crestBand=exp(d.sub(crestAt).div(crestW).mul(d.sub(crestAt).div(crestW)).negate()).mul(expo.mul(expo)).mul(natural).mul(smoothstep(.5,.9,patch)).mul(float(.8).div(crestW));
    const crest=smoothstep(.6,.9,crestBand.add(lace.sub(.5).mul(.8))).mul(.45);
    const foam=saturate(max(max(rim,lacy),crest)).mul(mix(.6,.9,expo));
    col=mix(col,E.mul(.85),foam);
    // Distance haze is the scene fog (the same range and colour function as the land, applied after this colour), so
    // sea and shore at the same distance fade alike; distant water is pale through the reflected horizon (Fresnel).
    // Seen from below (a camera dipping under y = 0) the surface is a plain dark teal underside instead of nothing.
    return select(frontFacing,col,UNDERSIDE.mul(downwelling(L)).mul(.5));})();
  return m;
}

// Water meshes that are often out of the first view (fountains, the pond) are drawn once regardless of the frustum,
// so the boot compile and the first frame build their pipelines with the real scene, target and object flags; after
// that first draw ordinary frustum culling resumes. Module-level callback: it closes over nothing.
function firstDrawDone(){this.frustumCulled=true;this.onAfterRender=afterRenderNoop;}
function afterRenderNoop(){}
export function compileAtBoot(mesh){mesh.frustumCulled=false;mesh.onAfterRender=firstDrawDone;return mesh;}

// Fountains and the pond: clear tinted water, a gentle ripple, sky Fresnel and the sun. `vertexColors` reads the batch's
// vertex colour as the tint (the Bahía Urbana batch); otherwise `color`. With an `owner` (the scene) equal options share
// one material, so its node graph is built and kept once.
const shared=new WeakMap();
export function smallWaterMaterial({color='#406d69',vertexColors=false}={},owner=null){
  const key=vertexColors?'vertex':new THREE.Color(color).getHexString();
  if(owner){let m=shared.get(owner);if(!m)shared.set(owner,m=new Map());if(!m.has(key))m.set(key,smallWaterMaterial({color,vertexColors}));return m.get(key);}
  const m=new THREE.MeshBasicNodeMaterial();m.name='sj-small-water';
  const tintColour=uniform(new THREE.Color(color));
  m.colorNode=Fn(()=>{
    const P=positionWorld,p=P.xz,t=atmosphere.elapsed,L=atmosphere.sunDirection;
    const fp=max(max(fwidth(P.x),fwidth(P.z)),1e-4);
    const {n,lost}=waveSlopes(RIPPLES.map(([l,dx,dz,s])=>[l,dx,dz,s,2]),p,t.mul(.6),()=>fp,()=>float(1));
    const toCam=cameraPosition.sub(P),V=toCam.div(max(length(toCam),1e-3)),R=reflect(V.negate(),n);
    // A basin sees mostly its rim, the plaza and buildings, not open sky: the sky reflection is partly occluded.
    const F=fresnel(dot(n,V),.2),tint=vertexColors?vertexColor().rgb:tintColour;
    return tint.mul(downwelling(L)).mul(oneMinus(F)).add(skyAlong(R,L).mul(F).mul(.55)).add(sunSpecular(n,V,L,float(.004).add(lost.mul(2))));})();
  return m;
}
