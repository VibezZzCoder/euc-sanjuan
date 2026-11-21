/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Time of day (js/sj-atmosphere.js): shared contract, solar convention, sky/haze continuity, preference.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three/webgpu'?{url:new URL('../vendor/three/build/three.webgpu.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const A=await import('../js/sj-atmosphere.js');
const {readFileSync}=await import('node:fs');

test('the shared contract keeps its field names',()=>{
  assert.deepEqual(A.TIMES,['midday','golden','blue']);
  for(const k of ['sunDirection','sunColor','skyZenith','skyHorizon','haze','night','elapsed'])assert.ok(A.atmosphere[k]?.isNode,k);
  assert.ok(A.TIMES.includes(A.atmosphere.time));
  assert.equal(typeof A.hazeToward,'function');assert.ok(A.hazeView?.isNode);
});

test('compass convention: x east, z south (build-city.py projects z = −north)',()=>{
  const near=(v,x,y,z)=>assert.ok(Math.abs(v.x-x)<1e-9&&Math.abs(v.y-y)<1e-9&&Math.abs(v.z-z)<1e-9,JSON.stringify(v));
  near(A.sunVector(0,0),0,0,-1);near(A.sunVector(90,0),1,0,0);near(A.sunVector(180,0),0,0,1);near(A.sunVector(270,0),-1,0,0);
  assert.match(readFileSync(new URL('../tools/build-city.py',import.meta.url),'utf8'),/return x, -north/);
  // El Morro's esplanade is north-west of Plaza de Armas in the city data: −x, −z.
  const city=JSON.parse(readFileSync(new URL('../data/city.json',import.meta.url),'utf8'));
  const at=n=>city.places.find(p=>p.name.startsWith(n));
  assert.ok(at('El Morro').x<at('Plaza de Armas').x&&at('El Morro').z<at('Plaza de Armas').z);
});

test('hours follow San Juan solar geometry and the blue hour has no direct sun',()=>{
  const {midday:m,golden:g,blue:b}=A.PRESETS;
  assert.ok(m.sun[1]>60,'high tropical sun');
  assert.ok(g.sun[1]>3&&g.sun[1]<15&&g.sun[0]>255&&g.sun[0]<300,'low sun in the west sector');
  assert.ok(b.sun[1]<-3&&b.sun[1]>-7&&b.sun[0]>255&&b.sun[0]<300,'civil twilight, glow in the west');
  assert.equal(b.light.sun,0);assert.equal(b.light.shadow,0);assert.equal(b.night,1);
  assert.equal(m.night,0);assert.equal(g.night,0);
  for(const id of A.TIMES)assert.ok(A.PRESETS[id].exposure<=1.5,'leave exposure headroom for emissive lamps');
});

test('the sky meets the haze at the horizon (fogged land melts into it) and the sun warms as it sinks',()=>{
  for(const id of A.TIMES){const d=A.derive(id);
    for(let az=0;az<360;az+=15){const above=A.skyRadianceCPU(d,A.sunVector(az,.01)),below=A.skyRadianceCPU(d,A.sunVector(az,-.01));
      for(let i=0;i<3;i++)assert.ok(Math.abs(above[i]-below[i])<2e-3,`${id} ${az}: ${above} vs ${below}`);}
    // Away from the sun the horizon is exactly the haze colour.
    const away=A.skyRadianceCPU(d,A.sunVector(d.p.sun[0]+180,0));for(let i=0;i<3;i++)assert.ok(Math.abs(away[i]-d.haze[i])<1e-6);
    for(const v of [...d.zenith,...d.haze,...d.sunColour])assert.ok(Number.isFinite(v)&&v>=0);}
  const warmth=id=>{const c=A.derive(id).sunColour;return c[2]/c[0];};
  assert.ok(warmth('golden')<warmth('midday')-.15,'golden sun is warmer');
  assert.deepEqual(A.derive('blue').disc,[0,0,0],'no disc below the horizon');
});

test('preference: default golden, saved choice, ?time override does not save, blocked storage is harmless',()=>{
  const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const p=A.createTimePreference(()=>storage);assert.equal(p.value,'golden');
  assert.equal(p.set('blue'),true);assert.equal(store.get(A.TIME_KEY),'blue');assert.equal(p.set('noon'),false);
  assert.equal(A.createTimePreference(()=>storage).value,'blue');
  store.set(A.TIME_KEY,'midnight');assert.equal(A.createTimePreference(()=>storage).value,'golden');
  const blocked=A.createTimePreference(()=>{throw new Error('blocked');});assert.equal(blocked.value,'golden');assert.equal(blocked.set('midday'),true);
  assert.equal(A.timeOverride(new URLSearchParams('time=midday')),'midday');assert.equal(A.timeOverride(new URLSearchParams('time=dusk')),null);
  assert.match(A.TIME_KEY,/^euc-sanjuan-/);
});

test('the selector offers the three hours on the title screen and in Pause',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const id of ['time-title','time-of-day']){const m=html.match(new RegExp(`<select id="${id}">(.*?)</select>`));assert.ok(m,id);
    assert.deepEqual([...m[1].matchAll(/value="(\w+)"/g)].map(x=>x[1]),A.TIMES);}
});

test('clouds drift with the trades (toward the west-south-west) and the shader samples upwind',()=>{
  assert.ok(A.WIND.x<0&&A.WIND.y>0&&Math.abs(A.WIND.x)>Math.abs(A.WIND.y),'x east / z south: west-south-west');
  const src=readFileSync(new URL('../js/sj-atmosphere.js',import.meta.url),'utf8');
  assert.match(src,/\.sub\(vec2\(WIND\.x,WIND\.y\)\.mul\(atmosphere\.elapsed\)\)/,'pattern moves along +WIND');
});

test('sunlit hours add a warm low-chroma bounce to the shade; blue hour adds none',()=>{
  for(const id of ['midday','golden']){const b=A.derive(id).bounce;assert.ok(b[0]>b[2]&&b[0]>0,id+' warm bounce');
    const max=Math.max(...b),min=Math.min(...b);assert.ok((max-min)/max<.6,id+' warm stone, not saturated orange (linear chroma; pure orange ≈ 1)');}
  assert.deepEqual(A.derive('blue').bounce,[0,0,0]);
  const g=A.derive('golden').sunColour;assert.ok(g[1]<.85&&g[2]<.5,'golden key is amber, not cream-white');
});
