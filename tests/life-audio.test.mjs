/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The city's sound without an AudioContext: material, ranking and caps, hand-over, events, beds, and the mute gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lifeSoundJobs } from '../js/sj-life-audio-synth.js';
import { createLifeAudioPlan, LIFE_AUDIO_CAPS, RANGE } from '../js/sj-life-audio-plan.js';
import { createLifeAudio } from '../js/sj-life-audio.js';
import { seededRandom } from '../js/sj-life-random.js';

const RATE = 24000;
const listener = { x: 0, y: 1.6, z: 0, rx: 1, rz: 0, fx: 0, fz: 1 };
const small = () => false;
const car = (x, z, speed = 5, typeIndex = 1, acceleration = 0) => ({ x, y: 0, z, speed, acceleration, typeIndex, waitingForRider: false });
const person = (x, z, seed, { speed = 1.3, talking = false, bumped = 0 } = {}) => ({ x, y: 1.6, z, speed, talking, seed, bumped });
const generated = (() => {
  const done = {};
  for (const job of lifeSoundJobs(RATE)) {
    let r = job.run(done);
    if (!(r instanceof Float32Array)) { let s; do s = r.next(); while (!s.done); r = s.value; }
    done[job.key] = r;
  }
  return done;
})();

test('every sound is finite, below full scale, and one-shots start and end at zero', () => {
  for (const [key, s] of Object.entries(generated)) {
    let peak = 0;
    for (const v of s) { assert.ok(Number.isFinite(v), key); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak > 0.01 && peak <= 0.95, `${key} peak ${peak}`);
    if (/^(step|horn|talk|exclaim)/.test(key)) {
      assert.ok(Math.abs(s[0]) < 1e-3 && Math.abs(s[s.length - 1]) < 1e-3, `${key} ends`);
    }
  }
  // no one-shot is long: a horn is under half a second, a phrase under a second
  assert.ok(generated.horn2.length / RATE < 0.4 && generated.talk0_0.length / RATE < 0.95);
});

test('engine voices: nearest and loudest first, capped, and a car keeps its voice', () => {
  for (const phone of [false, true]) {
    const plan = createLifeAudioPlan({ phone, random: seededRandom('a') });
    const cap = LIFE_AUDIO_CAPS[phone ? 'phone' : 'desktop'].motors;
    const cars = Array.from({ length: 30 }, (_, i) => car(Math.cos(i) * (6 + i * 2), Math.sin(i) * (6 + i * 2)));
    plan.tick(0, listener, cars, cars.length, [], 0, small);
    const active = plan.motors.filter((m) => m.state === 1);
    assert.equal(active.length, cap);
    // the chosen are the nearest `cap` (same type and speed, so loudness follows distance)
    const nearest = cars.map((c) => Math.hypot(c.x, c.z)).sort((a, b) => a - b).slice(0, cap);
    for (const m of active) assert.ok(Math.hypot(m.x, m.z) <= nearest[cap - 1] + 1e-6);
    const handovers = plan.counters.handovers;
    // everyone moves back and forth a little (the cap edge sees its distances swap): no voice changes hands
    for (let t = 1; t <= 20; t++) {
      cars.forEach((c, i) => { c.x += ((t + i) % 2 ? 0.6 : -0.6); });
      plan.tick(t * 0.1, listener, cars, cars.length, [], 0, small);
    }
    assert.equal(plan.counters.handovers, handovers, 'voices stay with their cars');
  }
});

test('a new loud car takes a voice only after a released one has faded', () => {
  const plan = createLifeAudioPlan({ random: seededRandom('b') });
  const cars = Array.from({ length: 8 }, (_, i) => car(20 + i * 3, 10));
  plan.tick(0, listener, cars, 8, [], 0, small);
  cars.push(car(2, 3, 6));
  plan.tick(0.1, listener, cars, cars.length, [], 0, small);
  assert.equal(plan.motors.filter((m) => m.state === 2).length, 1, 'the weakest voice fades');
  assert.ok(!plan.motors.some((m) => m.state === 1 && Math.hypot(m.x - 2, m.z - 3) < 0.1), 'not yet reused');
  plan.tick(0.4, listener, cars, cars.length, [], 0, small);
  assert.ok(plan.motors.some((m) => m.state === 1 && m.fresh && Math.hypot(m.x - 2, m.z - 3) < 0.1), 'taken after the fade');
  assert.ok(plan.motors.filter((m) => m.state !== 0).length <= LIFE_AUDIO_CAPS.desktop.motors);
});

test('horns: placed at the car, spaced, out of range dropped, and they take a voice from talk', () => {
  const plan = createLifeAudioPlan({ random: seededRandom('c') });
  assert.ok(plan.horn(listener, 8, 0, 0, 10));
  assert.equal(plan.horn(listener, 8, 0, 0, 10.5), null, 'spacing');
  assert.equal(plan.horn(listener, 400, 0, 0, 20), null, 'range');
  const e = plan.horn(listener, -8, 0, 0, 30);
  assert.ok(e.pan < 0 && e.gain > 0 && e.gain < 1);
  // fill every one-shot voice with conversation, then a horn steals one
  const people = [];
  for (let i = 0; i < 12; i++) people.push(person(3 + i, 2, 100 + i * 2, { talking: true, speed: 0 }), person(3 + i, 3, 101 + i * 2, { talking: true, speed: 0 }));
  for (let t = 0; t < 30; t++) plan.tick(40 + t * 0.1, listener, [], 0, people, people.length, small);
  plan.clearEvents();
  const steal = plan.horn(listener, 5, 0, 5, 43.05);
  assert.ok(steal, 'horn gets a voice');
});

test('footsteps: steady cadence for walkers, none beyond 22 m, none for talkers, voices capped', () => {
  const plan = createLifeAudioPlan({ random: seededRandom('d') });
  const people = [];
  for (let i = 0; i < 10; i++) people.push(person(Math.cos(i) * (5 + i), Math.sin(i) * (5 + i), 10 + i));
  people.push(person(30, 0, 99)); // too far for steps
  people.push(person(21.99, 0, 97)); // on the edge: flat distance inside, the feet just outside
  people.push(person(4, 4, 98, { talking: true, speed: 0 }));
  let steps = 0, far = 0;
  const live = [];
  for (let t = 0; t < 50; t++) {
    const now = t * 0.1;
    plan.tick(now, listener, [], 0, people, people.length, small);
    for (let k = 0; k < plan.eventCount; k++) {
      const e = plan.events[k];
      // every listed event is a filled record: a known kind, a voice of its pool, an audible gain
      assert.ok(['step', 'talk', 'exclaim', 'horn'].includes(e.kind) && e.gain > 0 && e.slot >= 0 && e.slot < (e.kind === 'step' ? 6 : 8));
      if (e.kind !== 'step') continue;
      steps++;
      if (Math.hypot(e.x, e.z) > RANGE.step.range) far++;
      live.push(e.when);
    }
    plan.clearEvents();
  }
  assert.equal(far, 0);
  // 10 walkers × 5 s at about 0.6 s per step; the 6-voice cap thins the densest moments
  assert.ok(steps > 40 && steps <= 100, `steps ${steps}`);
  live.sort((a, b) => a - b);
  for (let i = 0; i + 6 < live.length; i++) assert.ok(live[i + 6] - live[i] >= 0.2 - 1e-9, 'at most six steps sound at once');
});

test('conversation alternates speakers; nothing beyond 30 m; a bump gives one outburst', () => {
  const plan = createLifeAudioPlan({ random: seededRandom('e') });
  const a = person(6, 0, 501, { talking: true, speed: 0 }), b = person(6, 1.2, 502, { talking: true, speed: 0 });
  const far = person(35, 0, 601, { talking: true, speed: 0 }), far2 = person(35, 1, 602, { talking: true, speed: 0 });
  const walker = person(4, -3, 700);
  const people = [a, b, far, far2, walker];
  const speakers = [];
  let exclaims = 0;
  for (let t = 0; t < 200; t++) {
    const now = t * 0.1;
    if (t === 50 || t === 51 || t === 150) walker.bumped++;
    plan.tick(now, listener, [], 0, people, people.length, small);
    for (let k = 0; k < plan.eventCount; k++) {
      const e = plan.events[k];
      if (e.kind === 'talk') { speakers.push(e.x === 6 && e.z === 0 ? 'a' : e.z === 1.2 ? 'b' : 'far'); plan.eventEnd[e.slot] = e.when + 1; }
      if (e.kind === 'exclaim') exclaims++;
    }
    plan.clearEvents();
  }
  assert.ok(!speakers.includes('far'));
  assert.ok(speakers.length >= 6, `turns ${speakers.length}`);
  for (let i = 1; i < speakers.length; i++) assert.notEqual(speakers[i], speakers[i - 1], 'turns alternate');
  assert.equal(exclaims, 2, 'two separate bumps, the double hit counts once');
});

test('plaza murmur follows the crowd: a full plaza hums, a side street is quiet, never above 1', () => {
  const level = (count, hourQuiet = 0) => {
    const plan = createLifeAudioPlan({ random: seededRandom('f') });
    const r = seededRandom('g');
    const people = Array.from({ length: count }, (_, i) => person((r() - 0.5) * 50, (r() - 0.5) * 50, 1000 + i, { speed: 0 }));
    plan.tick(0, listener, [], 0, people, people.length, small, hourQuiet);
    return plan.levels.crowd;
  };
  const street = level(3), plaza = level(60), packed = level(150);
  assert.ok(street < 0.2 && plaza > 0.6 && plaza < packed && packed < 1, `${street} ${plaza} ${packed}`);
  assert.ok(level(60, 1) < plaza, 'blue hour a little quieter');
  // distant traffic bed: cars beyond 30 m only
  const plan = createLifeAudioPlan();
  plan.tick(0, listener, [car(5, 0)], 1, [], 0, small);
  assert.equal(plan.levels.traffic, 0);
  const cars = Array.from({ length: 20 }, (_, i) => car(60 + i * 5, 0));
  plan.tick(0.1, listener, cars, 20, [], 0, small);
  assert.ok(plan.levels.traffic > 0.3 && plan.levels.traffic < 1);
});

// ---- the player against a recording stand-in for the Web Audio API
function fakeContext(state = 'running') {
  const param = () => ({ value: 0, automationRate: 'a-rate', setTargetAtTime() {}, setValueAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => ({ connect(n) { return n; }, disconnect() {}, ...extra });
  const ctx = {
    state, currentTime: 0, sources: 0, started: 0,
    createGain: () => node({ gain: param() }),
    createBiquadFilter: () => node({ frequency: param(), detune: param(), Q: param(), gain: param() }),
    createStereoPanner: () => node({ pan: param() }),
    createBuffer: (channels, length, rate) => ({ length, duration: length / rate, copyToChannel() {}, getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => { ctx.sources++; return node({ playbackRate: param(), detune: param(), start() { ctx.started++; }, stop() {} }); },
  };
  return ctx;
}
const camera = { position: { x: 0, y: 2, z: -5 }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };

test('nothing is scheduled while the context is suspended (muted or paused); horns are drained, not kept', () => {
  let drained = 0;
  const traffic = { audible: (out) => { out[0] = car(3, 3); return 1; }, drainEvents: (out) => { out.length = 0; out.push({ type: 'horn', x: 4, y: 0, z: 0 }); drained++; return 1; } };
  const walkers = Array.from({ length: 6 }, (_, i) => person(i, 3, 50 + i));
  const people = { audible: (out) => { walkers.forEach((w, i) => { out[i] = w; }); return walkers.length; } };
  const ctx = fakeContext('suspended');
  const audio = createLifeAudio({ context: ctx, destination: {}, traffic, people, noWorker: true, budgetMs: Infinity, random: seededRandom('h') });
  const loopsAfterBuild = ctx.sources;
  for (let i = 0; i < 60; i++) audio.update(camera, 1 / 60);
  assert.equal(ctx.sources, loopsAfterBuild, 'no one-shot while suspended');
  assert.equal(drained, 60);
  assert.equal(audio.stats().silent, true);
  ctx.state = 'running';
  for (let i = 0; i < 120; i++) { ctx.currentTime += 1 / 60; audio.update(camera, 1 / 60); }
  const s = audio.stats();
  assert.ok(ctx.sources > loopsAfterBuild, 'sounds once running');
  assert.ok(s.motors <= s.caps.motors && s.jobsLeft === 0 && !s.silent);
  assert.ok(s.horns >= 1, 'a horn after waking (the first frame’s stale ones are dropped)');
  audio.dispose();
});
