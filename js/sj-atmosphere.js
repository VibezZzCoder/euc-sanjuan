/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Time of day: sky, sun, environment light, haze and exposure from one preset table.
// Sky, sun, sea, lamps and windows all read the `atmosphere` uniforms so they agree on the hour. Colours are linear
// working-space values. Animation reads `elapsed` (riding time), never wall-clock time, so stills are reproducible.
//
// World axes: x = east, y = up, z = south (tools/build-city.py projects with z = −north). Compass azimuth is measured
// from north through east; the vector toward the sun is (cos h·sin A, sin h, −cos h·cos A). Solar positions are for
// San Juan (18.466° N, 66.118° W) on 20 April, Atlantic Standard Time, from the NOAA low-precision solar formulas:
// midday 13:30 (elevation 72.6°, azimuth 249.5°), golden hour 17:45 (12.6°, 278.4°: low over the harbour mouth,
// raking the west walls and El Morro; a little higher than the last minutes so the plazas still catch it), blue hour 19:00 (−4.8°, 284.1°; sunset 18:40, no direct sun).
//
// Sky: an analytic model calibrated to photographs of the old city (zenith-to-horizon gradient, a brighter horizon on
// the sun's side, a forward-scattering glow around the sun and the solar disc). Its value at the horizon is, by
// construction, the haze that fogs distant land and sea, so they melt into it at every hour. The sun's colour is the
// solar beam after Rayleigh and Mie extinction along its air path (the Preetham coefficients of three.js SkyMesh),
// so it warms and dims as the sun sinks. The environment light is this sky (with sunlit ground below), baked to PMREM.
import * as THREE from 'three/webgpu';
import {Fn,uniform as nodeUniform,renderGroup,float,vec3,vec2,vec4,select,dot,max,pow,mix,clamp,smoothstep,normalize,length,texture,
  positionWorld,cameraPosition,fog,rangeFogFactor} from '../vendor/three/build/three.tsl.js';

export const TIMES=['midday','golden','blue'];
export const DEFAULT_TIME='golden';
export const TIME_LABELS={midday:'Midday',golden:'Golden hour',blue:'Blue hour'};
export const TIME_KEY='euc-sanjuan-time-of-day';

// One row per hour (sRGB colours).
// sun: compass azimuth / elevation in degrees; turbidity: haze in the air path that colours the sun.
// sky: zenith, horizon away from the sun, horizon toward the sun, `lobe` how tightly the bright horizon hugs the sun's
//   azimuth, `band` the depth of the pale horizon band (elevation sine at which the gradient is about halfway), glow
//   colour with a wide and a tight forward lobe [power, amount], `hug` how strongly the glow keeps to the horizon,
//   disc brightness (× sun colour).
// light: sun illuminance (0 = no direct sun), `warm` the exponent applied to the transmitted sun colour (lower =
//   whiter), environment intensity, `desat` how far the environment light is pulled toward grey (sunlit walls and
//   paving bounce light into the shade), shadow intensity.
// clouds: scattered trade-wind cumulus (D2): coverage threshold on the noise (higher = fewer), edge softness, opacity,
//   sunlit and shaded colours and their brightness; they drift west-south-west with riding time.
// bounce: [sRGB colour, gain] warm light from sunlit walls and paving reaching the shade, added over the upper half of
//   the environment (scaled by the sun; none at blue hour).
// ground: lower half of the environment (sunlit paving and walls, scaled by the sun). fog: range in metres.
// exposure: tone-mapping exposure. night: artificial lights (0 day … 1 fully on). glow: the rider's headlight drive
// (euc-rider.js; the beam starts above 0.6).
export const PRESETS={
  midday:{sun:[249.5,72.6],turbidity:2.4,
    sky:{zenith:'#2f78c4',horizon:'#9fbfd8',horizonSun:'#b9d0e0',lobe:2,band:.1,glow:'#fff4e2',wide:[10,.12],tight:[600,1.2],hug:0,disc:40},
    clouds:{cover:.55,soft:.13,opacity:.92,lit:'#f5f3ea',shade:'#9aacc0',bright:1.05},
    light:{sun:3.6,warm:.45,env:.8,desat:.4,shadow:1},ground:'#9a8c76',bounce:['#cfcac0',.8],fog:[600,4800],exposure:1.05,night:0,glow:0},
  golden:{sun:[278.4,12.6],turbidity:3,
    sky:{zenith:'#3a78c0',horizon:'#b8c0c6',horizonSun:'#f4c58a',lobe:3,band:.16,glow:'#ffc985',wide:[6,.35],tight:[400,3],hug:2,disc:30},
    clouds:{cover:.6,soft:.13,opacity:.9,lit:'#ffd8ae',shade:'#7d89a6',bright:.95},
    light:{sun:5.2,warm:1,env:1.2,desat:.45,shadow:1},ground:'#ceb199',bounce:['#e0c29a',.4],fog:[420,4200],exposure:1.15,night:0,glow:.3},
  blue:{sun:[284.1,-4.8],turbidity:3,
    sky:{zenith:'#24375f',horizon:'#5c6b92',horizonSun:'#c8968c',lobe:4,band:.22,glow:'#b07c7a',wide:[8,.25],tight:[1,0],hug:4,disc:0},
    clouds:{cover:.58,soft:.15,opacity:.85,lit:'#c89a98',shade:'#3f4968',bright:.42},
    light:{sun:0,warm:1,env:1.3,desat:.5,shadow:0},ground:'#2b2a33',fog:[320,3600],exposure:1.5,night:1,glow:.84},
};

const DEG=Math.PI/180;
// Every atmosphere uniform is shared by all materials and updated once per render (the render group), as three.js does
// for scene fog; in the default per-object group each draw re-uploaded them (about 2 ms a frame on the overview).
const uniform=value=>nodeUniform(value).setGroup(renderGroup);
/** Unit vector toward a compass azimuth / elevation in world axes (x east, z south). */
export function sunVector(azimuth,elevation,out=new THREE.Vector3()){
  const a=azimuth*DEG,e=elevation*DEG;return out.set(Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e));}

export const atmosphere={
  time:DEFAULT_TIME,
  sunDirection:uniform(new THREE.Vector3(0,1,0)),   // unit vector from the scene toward the sun
  sunColor:uniform(new THREE.Color(1,1,1)),          // linear sun radiance colour including intensity
  skyZenith:uniform(new THREE.Color()),
  skyHorizon:uniform(new THREE.Color()),              // horizon away from the sun
  haze:uniform(new THREE.Color()),                    // fog / far-horizon colour away from the sun (hazeToward for exact)
  hazeSun:uniform(new THREE.Color()),                 // horizon colour toward the sun, before the glow
  hazeLobe:uniform(2),                                // how tightly hazeSun hugs the sun's azimuth
  night:uniform(0),
  elapsed:uniform(0),
};

// ---- Sky model: one definition, evaluated on the GPU (TSL) and on the CPU (tests, derived values) ----
const S={band:uniform(.1),hug:uniform(0),glow:uniform(new THREE.Color()),wide:uniform(new THREE.Vector2(8,0)),tight:uniform(new THREE.Vector2(600,0)),
  disc:uniform(new THREE.Color()),discOn:uniform(1),envPass:uniform(0),ground:uniform(new THREE.Color()),desat:uniform(0),bounce:uniform(new THREE.Color())};
const DISC_COS=Math.cos(.32*DEG);
const C={cover:uniform(.6),soft:uniform(.15),opacity:uniform(.9),lit:uniform(new THREE.Color()),shade:uniform(new THREE.Color())};
// Cloud feature velocity in cloud-plane units (x east, z south) per riding second: toward the west-south-west, carried by
// the trades from the east-north-east. The shader samples at uv − WIND·t so the pattern moves along +WIND.
export const WIND=new THREE.Vector2(-.0026,.0011);

// Tiling fBm value noise (4 octaves, 128²) in a small mip-mapped texture: sampled, so distant clouds are filtered
// instead of shimmering. Deterministic, built once in memory (no image load).
let cloudNoise=null;
function cloudTexture(){
  if(cloudNoise)return cloudNoise;
  const N=128,data=new Uint8Array(N*N*4),hash=(x,y,s)=>{let h=Math.imul(x*374761393+y*668265263+s*1442695041,1274126177);h^=h>>>13;h=Math.imul(h,1103515245);return ((h^h>>>16)>>>0)/4294967296;};
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){let v=0,a=.5,norm=0;
    for(let o=0;o<4;o++){const cells=4<<o,x=i*cells/N,y=j*cells/N,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
      const g=(a2,b2)=>hash(((x0+a2)%cells+cells)%cells,((y0+b2)%cells+cells)%cells,o);
      v+=a*((g(0,0)*(1-sx)+g(1,0)*sx)*(1-sy)+(g(0,1)*(1-sx)+g(1,1)*sx)*sy);norm+=a;a*=.5;}
    const b=Math.round(255*v/norm),k=4*(j*N+i);data[k]=data[k+1]=data[k+2]=b;data[k+3]=255;}
  const t=new THREE.DataTexture(data,N,N,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;
  t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;
  return cloudNoise=t;
}
/** Cloud layer toward a unit direction: rgb colour, alpha (0 at and below the horizon). */
const cloudLayer=Fn(([dir])=>{
  const y=max(dir.y,0),uv=vec2(dir.x,dir.z).div(y.add(.1)).mul(.32).sub(vec2(WIND.x,WIND.y).mul(atmosphere.elapsed));   // sample upwind: features travel along +WIND
  const tex=cloudTexture(),n=texture(tex,uv).r.mul(.7).add(texture(tex,uv.mul(2.3).add(vec2(.37,.61))).r.mul(.3));
  const density=smoothstep(C.cover,C.cover.add(C.soft),n);
  const a=density.mul(smoothstep(.03,.22,y)).mul(C.opacity);
  // Lit toward the sun and on thin edges, darker in dense cores and away from the sun.
  const cosT=dot(dir,atmosphere.sunDirection);
  const shade=clamp(cosT.mul(.3).add(.55).sub(n.sub(C.cover).mul(2.2)),0,1);
  return vec4(mix(C.shade,C.lit,shade),a);
});

// Horizon colour and forward glow toward a direction; `e` its elevation sine (clamped ≥ 0), `toward` the cosine of the
// horizontal angle to the sun, `cosT` the cosine of the angle to the sun.
const skyCore=(e,toward,cosT,discMask)=>{
  const hor=mix(atmosphere.haze,atmosphere.hazeSun,pow(clamp(toward.mul(.5).add(.5),0,1),atmosphere.hazeLobe));
  const up=e.mul(S.band.add(1)).div(e.add(S.band));
  const base=mix(hor,atmosphere.skyZenith,up);
  const c=max(cosT,0),glow=S.glow.mul(pow(c,S.wide.x).mul(S.wide.y).add(pow(c,S.tight.x).mul(S.tight.y))).mul(pow(max(float(1).sub(up),0),S.hug));
  return base.add(glow).add(S.disc.mul(discMask));
};
const towardSun=dir=>{const sun=atmosphere.sunDirection,h=max(length(vec2(dir.x,dir.z)),.0001),sh=max(length(vec2(sun.x,sun.z)),.0001);
  return {t:dir.x.mul(sun.x).add(dir.z.mul(sun.z)).div(h.mul(sh)),sh};};
/** Sky radiance toward a unit direction (above the horizon). */
export const skyRadiance=Fn(([dir])=>{
  const {t}=towardSun(dir),cosT=dot(dir,atmosphere.sunDirection);
  return skyCore(clamp(dir.y,0,1),t,cosT,clamp(cosT.sub(DISC_COS).mul(30000),0,1).mul(S.discOn));
});
/** Haze toward a direction: the sky at the horizon in that azimuth (glow included, no disc). */
export const hazeToward=Fn(([dir])=>{
  const {t,sh}=towardSun(dir);
  return skyCore(float(0),t,t.mul(sh),float(0));
});
/** The haze seen along the current fragment's view ray (fog, sea horizon). */
export const hazeView=hazeToward(normalize(positionWorld.sub(cameraPosition)));

/** Visible sky: the haze at and below the horizon, the sky above (continuous). In the environment pass the lower
 * hemisphere is the sunlit ground, for bounce light, and the whole is pulled toward grey by `desat`. */
export const skyDome=Fn(([dir])=>{
  const cloud=cloudLayer(dir);
  const sky=select(dir.y.greaterThan(0),mix(skyRadiance(dir),cloud.rgb,cloud.a),hazeToward(dir));
  const env=mix(sky,S.ground,float(1).sub(smoothstep(-.25,0,dir.y)));
  const grey=mix(env,vec3(dot(env,vec3(.2126,.7152,.0722))),S.desat);
  // Bounce: sunlit walls and paving seen from shade, a warm low-chroma radiance over the upper hemisphere (environment only).
  return mix(sky,grey.add(S.bounce.mul(smoothstep(0,.35,dir.y))),S.envPass);
});
/** A sky material for a camera-centred mesh (its positions are directions × radius). */
export function skyMaterial(){
  const m=new THREE.MeshBasicNodeMaterial({fog:false,depthWrite:false,side:THREE.DoubleSide});
  m.colorNode=skyDome(normalize(positionWorld.sub(cameraPosition)));return m;
}

// Fog range (uniforms, so an hour change does not rebuild shaders).
const fogNear=uniform(500),fogFar=uniform(4400);
export const fogNode=fog(hazeView,rangeFogFactor(fogNear,fogFar));

// ---- Preference ----
export function createTimePreference(getStorage=()=>globalThis.localStorage){
  let value=DEFAULT_TIME;
  try{const saved=getStorage().getItem(TIME_KEY);if(TIMES.includes(saved))value=saved;}catch{/* in-memory default */}
  return {get value(){return value;},
    set(next){if(!TIMES.includes(next)||next===value)return false;value=next;
      try{getStorage().setItem(TIME_KEY,value);}catch{/* still applies this visit */}return true;}};
}
/** `?time=midday|golden|blue` overrides the saved choice for this visit without saving it. */
export const timeOverride=params=>{const t=params?.get?.('time');return TIMES.includes(t)?t:null;};

// ---- Derived values (pure; also used by tests and the CPU sky preview) ----
const TOTAL_RAYLEIGH=[5.804542996261093e-6,1.3562911419845635e-5,3.0265902468824876e-5];
const MIE_CONST=[1.8399918514433978e14,2.7798023919660528e14,4.0790479543861094e14];
/** Transmittance of the direct solar beam at elevation sine y (Preetham optical lengths; clear Rayleigh, Mie by turbidity). */
export function sunTransmittance(y,turbidity){
  const z=Math.acos(Math.max(0,Math.min(1,y))),inv=1/(Math.cos(z)+.15*Math.pow(93.885-z/DEG,-1.253)),c=.2*turbidity*10e-18;
  return [0,1,2].map(i=>Math.exp(-(TOTAL_RAYLEIGH[i]*8400*inv+.434*c*MIE_CONST[i]*.005*1250*inv)));}
const lin=hex=>{const c=new THREE.Color(hex);return [c.r,c.g,c.b];};
export function derive(id){
  const p=PRESETS[id];if(!p)throw new Error('Unknown time of day '+id);
  const sun=sunVector(p.sun[0],p.sun[1]),k=p.sky;
  const f=sunTransmittance(sun.y,p.turbidity),m=Math.max(...f),sunColour=f.map(v=>Math.pow(v/m,p.light.warm));
  return {p,sun,sunColour,zenith:lin(k.zenith),haze:lin(k.horizon),hazeSun:lin(k.horizonSun),hazeLobe:k.lobe,
    band:k.band,hug:k.hug,glow:lin(k.glow),wide:k.wide,tight:k.tight,disc:sunColour.map(v=>v*k.disc*(sun.y>0?1:0)),
    ground:lin(p.ground).map(v=>v*Math.max(.04,p.light.sun/3.6*Math.max(.35,sun.y))),
    bounce:lin(p.bounce?.[0]??'#000000').map(v=>v*(p.bounce?.[1]??0)*p.light.sun/3.6)};
}
/** CPU version of the sky (same formulas); dir {x,y,z} unit; returns linear [r,g,b]. */
export function skyRadianceCPU(d,dir,{disc=true}={}){
  const s=d.sun,h=Math.max(Math.hypot(dir.x,dir.z),1e-4),sh=Math.max(Math.hypot(s.x,s.z),1e-4);
  const toward=(dir.x*s.x+dir.z*s.z)/(h*sh),e=Math.max(0,Math.min(1,dir.y));
  const cosT=dir.y>0?dir.x*s.x+dir.y*s.y+dir.z*s.z:toward*sh,c=Math.max(cosT,0);
  const a=Math.pow(Math.min(1,Math.max(0,toward*.5+.5)),d.hazeLobe),up=e*(d.band+1)/(e+d.band),g=(Math.pow(c,d.wide[0])*d.wide[1]+Math.pow(c,d.tight[0])*d.tight[1])*Math.pow(Math.max(0,1-up),d.hug);
  const dm=disc&&dir.y>0?Math.max(0,Math.min(1,(cosT-DISC_COS)*30000)):0;
  return [0,1,2].map(i=>{const hor=d.haze[i]+(d.hazeSun[i]-d.haze[i])*a;return hor+(d.zenith[i]-hor)*up+d.glow[i]*g+d.disc[i]*dm;});
}

// ---- Runtime ----
/**
 * Creates the sun, the environment and the fog node. `apply(id)` switches the hour (uniforms, light
 * values and one PMREM bake into the same render target: no shader rebuild). `aim(focus,camera)` fits the sun's
 * shadow box ahead of the view, snapped to shadow texels. `advance(dt)` moves riding time.
 */
export function createAtmosphere({renderer,scene,phone=false}){
  const sun=new THREE.DirectionalLight('#ffffff',3);sun.name='sj-sun';sun.castShadow=true;
  const size=phone?1024:2048,half=phone?44:58;
  sun.shadow.mapSize.set(size,size);
  Object.assign(sun.shadow.camera,{left:-half,right:half,top:half,bottom:-half,near:1,far:700});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=phone?.08:.05;sun.shadow.bias=-.0002;
  scene.add(sun,sun.target);
  // The haze fog goes in through the renderer's own scene-fog path: a plain THREE.Fog on the scene whose cached node is
  // ours. Setting scene.fogNode instead makes every fogged material look node-driven to three.js's material observer,
  // which then refreshes every render object every frame (measured: 725 vs 180 updates a frame on the overview, about
  // 2–3 ms of CPU). If the pinned renderer ever lacks the cache, fall back to scene.fogNode (correct, slower).
  scene.fog??=new THREE.Fog('#a7cbd0',500,4400);
  if(typeof renderer._nodes?.getCacheNode==='function')renderer._nodes.getCacheNode('fog',scene.fog,()=>fogNode);else scene.fogNode=fogNode;
  // Environment: the sky alone, on a small sphere at the PMREM camera, baked into one reused target.
  const pmrem=new THREE.PMREMGenerator(renderer),envScene=new THREE.Scene();
  const envSky=new THREE.Mesh(new THREE.SphereGeometry(50,32,16),skyMaterial());envSky.frustumCulled=false;envScene.add(envSky);
  let envTarget=null,current=null;const lightDir=new THREE.Vector3(0,1,0);
  const bake=()=>{S.discOn.value=0;S.envPass.value=1;
    envTarget=pmrem.fromScene(envScene,0,.1,100,{size:256,renderTarget:envTarget});
    S.discOn.value=1;S.envPass.value=0;scene.environment=envTarget.texture;};
  sun.shadow.autoUpdate=true;
  function apply(id){
    const d=derive(id),p=d.p;atmosphere.time=id;
    atmosphere.sunDirection.value.copy(d.sun);
    atmosphere.haze.value.fromArray(d.haze);atmosphere.hazeSun.value.fromArray(d.hazeSun);atmosphere.hazeLobe.value=d.hazeLobe;
    atmosphere.skyZenith.value.fromArray(d.zenith);atmosphere.skyHorizon.value.fromArray(d.haze);
    S.band.value=d.band;S.hug.value=d.hug;S.glow.value.fromArray(d.glow);S.wide.value.fromArray(d.wide);S.tight.value.fromArray(d.tight);
    S.disc.value.fromArray(d.disc);S.ground.value.fromArray(d.ground);S.bounce.value.fromArray(d.bounce);
    {const c=p.clouds;C.cover.value=c.cover;C.soft.value=c.soft;C.opacity.value=c.opacity;C.lit.value.set(c.lit).multiplyScalar(c.bright);C.shade.value.set(c.shade).multiplyScalar(c.bright);}
    atmosphere.night.value=p.night;
    sun.color.fromArray(d.sunColour);sun.intensity=p.light.sun;sun.shadow.intensity=p.light.shadow;
    // No direct sun (blue hour): the light stays in the scene at zero (same shaders) and its shadow map is not redrawn,
    // except once on the first hour applied, so the shadow pass is compiled at start-up whatever hour the rider chose.
    sun.shadow.autoUpdate=p.light.sun>0&&p.light.shadow>0;sun.shadow.needsUpdate=sun.shadow.autoUpdate||!current;S.desat.value=p.light.desat;
    atmosphere.sunColor.value.copy(sun.color).multiplyScalar(sun.intensity);
    lightDir.copy(d.sun);
    scene.environmentIntensity=p.light.env;
    fogNear.value=p.fog[0];fogFar.value=p.fog[1];if(scene.fog?.isFog){scene.fog.near=p.fog[0];scene.fog.far=p.fog[1];scene.fog.color.fromArray(d.haze);}
    if(scene.background?.isColor)scene.background.fromArray(d.haze);
    renderer.toneMappingExposure=p.exposure;
    const city=globalThis.window?.NYC?.cityUniforms;if(city?.uInteriorGlow)city.uInteriorGlow.value=p.glow;
    current=d;bake();return d;
  }
  // Shadow box: centred ahead of the camera on the focus, its light-space origin snapped to whole texels so the
  // shadow edges do not crawl as the rider moves. The sun sits far up the light ray so long low-sun shadows from
  // casters well outside the box still land in it.
  const right=new THREE.Vector3(),up=new THREE.Vector3(),fwd=new THREE.Vector3(),centre=new THREE.Vector3(),texel=2*half/size;
  function aim(focus,camera){
    fwd.set(0,0,-1);if(camera){camera.getWorldDirection(fwd);}fwd.y=0;if(fwd.lengthSq()<1e-6)fwd.set(0,0,-1);fwd.normalize();
    centre.set(focus.x,focus.y,focus.z).addScaledVector(fwd,half*.42);
    right.set(0,1,0).cross(lightDir);if(right.lengthSq()<1e-6)right.set(1,0,0);right.normalize();up.copy(lightDir).cross(right).normalize();
    const u=centre.dot(right),v=centre.dot(up);
    centre.addScaledVector(right,Math.round(u/texel)*texel-u).addScaledVector(up,Math.round(v/texel)*texel-v);
    sun.target.position.copy(centre);sun.position.copy(centre).addScaledVector(lightDir,320);sun.target.updateMatrixWorld();sun.updateMatrixWorld();
  }
  return {sun,apply,aim,
    get current(){return current;},
    advance(dt){atmosphere.elapsed.value+=dt;},
    dispose(){if(envTarget&&scene.environment===envTarget.texture)scene.environment=null;pmrem.dispose();cloudNoise?.dispose();cloudNoise=null;envTarget?.dispose();
      envSky.geometry.dispose();envSky.material.dispose();scene.remove(sun,sun.target);sun.dispose();}};
}
