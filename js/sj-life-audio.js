/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The sound of the living city, mixed under the rider's own sound in the game's one AudioContext.
//
//   createLifeAudio({context, destination, traffic, people, phone, hour}) → {update(camera, dt), setHour, reset, dispose, stats}
//
// What plays (all synthesized by js/sj-life-audio-synth.js; decisions in js/sj-life-audio-plan.js):
//   - up to 8 engine voices (6 on phones) for the nearest, loudest cars: exhaust loop, tyres over setts, road hiss;
//   - one-shot voices (horns, conversation, outbursts) and footstep voices, pooled, each a fixed gain → low-pass →
//     stereo pan chain; a one-shot only creates its AudioBufferSourceNode;
//   - two beds: a plaza murmur that follows how many people are near, a distant-traffic rumble that follows cars farther off.
// Positions use equal-power stereo panning from the camera's right vector, distance gain and an air low-pass: no
// PannerNode, no listener automation. Everything sits in one bus under the game's master gain.
//
// Lifecycle: the host suspends the context when the game is not riding or is muted. While suspended nothing is
// scheduled and horns are drained and dropped; after a mute the bus fades back in; after a pause or a teleport the plan
// restarts, so no stale footsteps or conversation turns play late. Buffers are generated after the first Ride, the
// four car loops at once, the rest a few per frame inside a small time budget.
import { lifeSoundJobs } from './sj-life-audio-synth.js';
import { createLifeAudioPlan, LARGE_TYPES } from './sj-life-audio-plan.js';
import { VEHICLE_TYPES } from './sj-vehicle-types.js';

export const SYNTH_RATE = 24000; // every city sound lives below 6 kHz; half rate halves the generation time

// Linear gains into the bus. The bus goes into the game's master (0.65), beside the rider's own sound.
export const LIFE_MIX = Object.freeze({
  bus: 1,
  engine: 0.075, setts: 0.05, road: 0.032,  // layers of one car voice at its reference distance
  horn: 0.075, step: 0.02, talk: 0.022, exclaim: 0.06,
  crowd: 0.011, traffic: 0.03,
  blue: Object.freeze({ events: 0.9, crowd: 0.8, crowdCutoff: 900 }),
});

const kRate = (...params) => { for (const p of params) if (p?.automationRate !== undefined) p.automationRate = 'k-rate'; };

/** A parameter that is only re-aimed when its target moves. */
class Glide {
  constructor(param) { this.param = param; this.target = NaN; }
  to(value, now, tau, epsilon = 1e-4) {
    if (!Number.isFinite(value) || Math.abs(value - this.target) < epsilon) return;
    this.param.cancelScheduledValues(now);
    this.param.setTargetAtTime(value, now, tau);
    this.target = value;
  }
  set(value, at) {
    this.param.cancelScheduledValues(at);
    this.param.setValueAtTime(value, at);
    this.target = value;
  }
}

export function createLifeAudio({ context, destination, traffic, people, phone = false, hour = 'golden', budgetMs = 1.5, random = Math.random, noWorker = false }) {
  const created = performance.now();
  const plan = createLifeAudioPlan({ phone, random });
  const nodes = [];
  const own = (node) => { nodes.push(node); return node; };
  const gainNode = (value = 0) => { const g = own(context.createGain()); g.gain.value = value; return g; };
  const filter = (type, frequency, q = 0.6) => {
    const f = own(context.createBiquadFilter()); kRate(f.frequency, f.detune, f.Q, f.gain);
    f.type = type; f.frequency.value = frequency; f.Q.value = q; return f;
  };
  const panner = () => { const p = own(context.createStereoPanner()); kRate(p.pan); return p; };

  // ---- sound material: a module worker generates it; without workers it is made here, a slice per frame
  const done = Object.create(null), buffers = Object.create(null);
  const jobs = lifeSoundJobs(SYNTH_RATE);
  let jobIndex = 0, pending = null, generationMs = 0, generationMaxFrameMs = 0, worker = null, workerMs = 0;
  const toBuffer = (samples) => {
    const b = context.createBuffer(1, samples.length, SYNTH_RATE);
    if (b.copyToChannel) b.copyToChannel(samples, 0); else b.getChannelData(0).set(samples);
    return b;
  };
  function receive(key, samples) {
    const start = performance.now();
    buffers[key] = toBuffer(samples);
    jobIndex++;
    if (!carsReady && buffers.engineSmall && buffers.engineLarge && buffers.setts && buffers.noise) buildCars();
    if (jobIndex >= jobs.length) startCrowd();
    const spent = performance.now() - start;
    generationMs += spent; generationMaxFrameMs = Math.max(generationMaxFrameMs, spent);
  }
  function runJobs(limitMs) {
    const start = performance.now();
    while (jobIndex < jobs.length && performance.now() - start < limitMs) {
      const job = jobs[jobIndex];
      if (!pending) {
        const result = job.run(done);
        if (result instanceof Float32Array) { done[job.key] = result; receive(job.key, result); continue; }
        pending = result;
      }
      const step = pending.next();
      if (step.done) { pending = null; done[job.key] = step.value; receive(job.key, step.value); }
    }
    const spent = performance.now() - start;
    generationMs += spent; generationMaxFrameMs = Math.max(generationMaxFrameMs, spent);
    if (jobIndex >= jobs.length) for (const k in done) delete done[k];
  }
  function startWorker() {
    try {
      worker = new Worker(new URL('./sj-life-audio-worker.js', import.meta.url), { type: 'module' });
    } catch { worker = null; return; }
    worker.onmessage = (event) => {
      const { key } = event.data;
      if (disposed) return;
      if (key === 'done') { workerMs = event.data.ms; worker.terminate(); worker = null; return; }
      if (key === 'error') { stopWorker(); return; }
      receive(key, event.data.samples);
    };
    worker.onerror = (event) => { event.preventDefault?.(); stopWorker(); };
    worker.postMessage({ rate: SYNTH_RATE });
  }
  // a failed worker hands over to the main thread from the next job on (its finished jobs are kept)
  function stopWorker() { worker?.terminate(); worker = null; fallback = true; for (const job of jobs.slice(0, jobIndex)) done[job.key] = buffers[job.key]?.getChannelData(0); }
  let fallback = typeof Worker !== 'function' || noWorker;

  // ---- bus
  const now0 = context.currentTime;
  const bus = gainNode(0);
  bus.connect(destination);
  const busGlide = new Glide(bus.gain);
  busGlide.to(LIFE_MIX.bus, now0, 0.3);

  // ---- engine voices (four looping sources each, started once and kept running at the voice's gain) and the
  // distant-traffic bed: built when the car loops exist
  const loops = [], motorChains = [];
  const loop = (buffer, rate = 1) => {
    const s = own(context.createBufferSource()); s.buffer = buffer; s.loop = true; s.playbackRate.value = rate;
    loops.push(s); return s;
  };
  // the graph is built with the voice (at the first Ride); the looping sources join when their buffers arrive
  const motorInputs = plan.motors.map(() => {
    const smallGain = gainNode(0), largeGain = gainNode(0), engineFilter = filter('lowpass', 500, 0.5), engineGain = gainNode(0);
    const settFilter = filter('lowpass', 1100, 0.5), settGain = gainNode(0);
    const roadFilter = filter('bandpass', 850, 0.55), roadGain = gainNode(0);
    const voice = gainNode(0), air = filter('lowpass', 6000, 0.5), pan = panner();
    smallGain.connect(engineFilter); largeGain.connect(engineFilter);
    engineFilter.connect(engineGain).connect(voice);
    settFilter.connect(settGain).connect(voice);
    roadFilter.connect(roadGain).connect(voice);
    voice.connect(air).connect(pan).connect(bus);
    motorChains.push({
      smallRate: null, largeRate: null, settRate: null,
      smallGain: new Glide(smallGain.gain), largeGain: new Glide(largeGain.gain), engineCutoff: new Glide(engineFilter.frequency),
      engine: new Glide(engineGain.gain), sett: new Glide(settGain.gain), road: new Glide(roadGain.gain),
      voice: new Glide(voice.gain), air: new Glide(air.frequency), pan: new Glide(pan.pan),
    });
    return { smallGain, largeGain, settFilter, roadFilter };
  });
  const trafficLow = filter('lowpass', 170, 0.5), trafficLow2 = filter('lowpass', 260, 0.5), trafficGain = gainNode(0);
  trafficLow.connect(trafficLow2).connect(trafficGain).connect(bus);
  const trafficGlide = new Glide(trafficGain.gain);
  let carsReady = false;
  function buildCars() {
    const at = context.currentTime;
    motorInputs.forEach((input, v) => {
      const small = loop(buffers.engineSmall), large = loop(buffers.engineLarge), setts = loop(buffers.setts), road = loop(buffers.noise);
      small.connect(input.smallGain); large.connect(input.largeGain); setts.connect(input.settFilter); road.connect(input.roadFilter);
      const phase = (v * 0.61803398875) % 1;
      for (const s of [small, large, setts, road]) s.start(at, phase * s.buffer.duration);
      const c = motorChains[v];
      c.smallRate = new Glide(small.playbackRate); c.largeRate = new Glide(large.playbackRate); c.settRate = new Glide(setts.playbackRate);
    });
    const source = loop(buffers.noise, 0.73);
    source.connect(trafficLow);
    source.start(at, 0.37 * buffers.noise.duration);
    carsReady = true;
  }

  // ---- one-shot chains
  const live = [];  // every one-shot source still playing, so a reset can stop them
  const chain = () => {
    const input = gainNode(0), lp = filter('lowpass', 8000, 0.5), pan = panner();
    input.connect(lp).connect(pan).connect(bus);
    return { input, gain: new Glide(input.gain), cutoff: new Glide(lp.frequency), pan: new Glide(pan.pan), sources: 0 };
  };
  const eventChains = Array.from({ length: plan.caps.events }, chain);
  const stepChains = Array.from({ length: plan.caps.steps }, chain);
  function onEnded(event) {
    const source = event.target, i = live.indexOf(source);
    if (i >= 0) { live[i] = live[live.length - 1]; live.pop(); }
    source.onended = null;
    source.disconnect();
  }
  function play(buffer, target, when, rate) {
    const s = context.createBufferSource();
    s.buffer = buffer; s.playbackRate.value = rate;
    s.connect(target);
    s.onended = onEnded;
    s.start(when);
    live.push(s);
    return when + buffer.duration / rate;
  }
  // `after` > 0: the chains are fading, stop the sources once they are silent (no click); 0: the context is not running
  const stopAll = (at = 0, after = 0) => {
    for (const s of live) { try { if (after) s.stop(at + after); else { s.onended = null; s.stop(); s.disconnect(); } } catch { /* already stopped */ } }
    live.length = 0;
  };

  // ---- beds
  let crowd = null;
  function startCrowd() {
    if (crowd || !buffers.murmur0) return;
    const at = context.currentTime, lp = filter('lowpass', 1300, 0.5), gain = gainNode(0);
    lp.connect(gain).connect(bus);
    [buffers.murmur0, buffers.murmur1].forEach((buffer, i) => {
      const s = loop(buffer), p = panner();
      p.pan.value = i ? 0.45 : -0.45;
      s.connect(p).connect(lp);
      s.start(at, (i * 0.41) * buffer.duration);
    });
    crowd = { gain: new Glide(gain.gain), cutoff: new Glide(lp.frequency) };
  }

  // ---- state
  const cars = [], persons = [], horns = [];
  const listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0, fx: 0, fz: 1 };
  const followAt = { x: 0, y: 0, z: 0 };
  let nPeople = 0, warned = false, dropHorns = true, accumulator = 0.1, lastWall = NaN, silent = false, disposed = false, haveListener = false;
  let quiet = hour === 'blue' ? 1 : 0, eventsLevel = quiet ? LIFE_MIX.blue.events : 1, msUpdate = 0, msMax = 0;
  const typeLarge = (index) => LARGE_TYPES.has(VEHICLE_TYPES[index]?.id);
  const bufferFor = (e, second = false) => {
    switch (e.kind) {
      case 'step': return buffers['step' + e.variant];
      case 'horn': return buffers['horn' + e.variant];
      case 'exclaim': return buffers['exclaim' + e.voice];
      default: return buffers[`talk${e.voice}_${second ? e.second : e.variant}`];
    }
  };

  function restartPlan(at) {
    plan.reset();
    for (const c of motorChains) c.voice.to(0, at, 0.04);
    for (const c of eventChains) c.gain.to(0, at, 0.02);
    for (const c of stepChains) c.gain.to(0, at, 0.02);
    stopAll(at, 0.12);
    accumulator = -0.05; dropHorns = true; // the first new tick comes after the old sounds have stopped
  }
  function silence() {
    const at = context.currentTime;
    busGlide.set(0, at);
    plan.reset(); stopAll();
    for (const c of motorChains) c.voice.set(0, at);
    silent = true; dropHorns = true;
  }

  function applyMotors(at) {
    if (!carsReady) return;
    for (let v = 0; v < motorChains.length; v++) {
      const m = plan.motors[v], c = motorChains[v];
      if (m.state !== 1) { c.voice.to(0, at, 0.06); continue; }
      if (m.fresh) {
        // a voice taking a new car is silent here: jump its pitch, colour and pan, then fade it in
        c.smallRate.set(m.rate, at); c.largeRate.set(m.rate, at); c.settRate.set(m.settRate, at); c.pan.set(m.pan, at);
        c.smallGain.set(m.large ? 0 : 1, at); c.largeGain.set(m.large ? 1 : 0, at); c.air.set(m.cutoff, at);
        c.voice.to(m.gain, at, 0.09);
      } else {
        c.smallRate.to(m.rate, at, 0.09, 5e-4); c.largeRate.to(m.rate, at, 0.09, 5e-4); c.settRate.to(m.settRate, at, 0.12, 1e-3);
        c.pan.to(m.pan, at, 0.06, 2e-3); c.air.to(m.cutoff, at, 0.1, 5); c.voice.to(m.gain, at, 0.06);
      }
      c.engine.to(m.engine * LIFE_MIX.engine, at, 0.12); c.engineCutoff.to(m.engineCutoff, at, 0.1, 2);
      c.sett.to(m.setts * LIFE_MIX.setts, at, 0.15); c.road.to(m.road * LIFE_MIX.road, at, 0.2);
    }
  }

  function playEvents(at) {
    try { for (let k = 0; k < plan.eventCount; k++) playEvent(plan.events[k], at); }
    finally { plan.clearEvents(); } // never replayed, whatever happened
  }
  function playEvent(e, at) {
      const target = e.kind === 'step' ? stepChains[e.slot] : eventChains[e.slot];
      const buffer = bufferFor(e);
      if (!buffer || !target || !(e.gain > 0)) return; // still being generated, or nothing to place
      let when = Math.max(at, e.when);
      if (e.steal) { target.gain.to(0, at, 0.006); when = Math.max(when, at + 0.035); }
      const level = e.gain * LIFE_MIX[e.kind] * (e.kind === 'step' ? 1 : eventsLevel);
      target.gain.set(level, when); target.pan.set(e.pan, when); target.cutoff.set(e.kind === 'horn' ? Math.min(e.cutoff, 5000) : e.cutoff, when);
      let end = play(buffer, target.input, when, e.rate);
      if (e.second >= 0) { const b2 = bufferFor(e, true); if (b2) end = play(b2, target.input, end + e.gap, e.secondRate); }
      if (e.kind !== 'step') plan.eventEnd[e.slot] = end; // footstep voices are released by the plan's own clock
  }

  function followEvents(at) {
    for (let s = 0; s < eventChains.length; s++) {
      const seed = plan.eventFollow[s];
      if (!seed || plan.eventEnd[s] <= at) continue;
      if (!plan.follow(persons, nPeople, seed, followAt)) continue;
      // a speaker who walks on keeps their direction; their level was set when the phrase started
      const dx = followAt.x - listener.x, dz = followAt.z - listener.z, flat = Math.hypot(dx, dz) || 1;
      const pan = Math.max(-0.8, Math.min(0.8, (dx * listener.rx + dz * listener.rz) / flat * 0.8 * Math.min(1, flat / 1.5)));
      eventChains[s].pan.to(pan, at, 0.08, 2e-3);
    }
  }

  function frame(camera, dt) {
    const t0 = performance.now();
    let n = traffic?.drainEvents ? traffic.drainEvents(horns) : 0;
    if (context.state !== 'running') { if (!silent) silence(); lastWall = t0; return; }
    const at = context.currentTime;
    if (silent) { silent = false; restartPlan(at); busGlide.set(0, at); busGlide.to(LIFE_MIX.bus, at + 0.01, 0.3); }
    else if (Number.isFinite(lastWall) && t0 - lastWall > 300) restartPlan(at); // back from a pause or the map
    lastWall = t0;
    if (fallback && jobIndex < jobs.length) runJobs(budgetMs);

    const p = camera.position, m = camera.matrixWorld.elements;
    let rx = m[0], rz = m[2], fx = -m[8], fz = -m[10];
    const rl = Math.hypot(rx, rz) || 1, fl = Math.hypot(fx, fz) || 1;
    if (haveListener && Math.hypot(p.x - listener.x, p.z - listener.z) > 40) restartPlan(at); // teleport
    listener.x = p.x; listener.y = p.y; listener.z = p.z;
    listener.rx = rx / rl; listener.rz = rz / rl; listener.fx = fx / fl; listener.fz = fz / fl;
    haveListener = true;
    if (dropHorns) { n = 0; dropHorns = false; } // made before this sound existed, while silent or before a jump
    for (let i = 0; i < n; i++) { const h = horns[i]; if (h?.type === 'horn') plan.horn(listener, h.x, h.y, h.z, at); }
    accumulator += dt;
    if (accumulator >= 0.1) {
      accumulator %= 0.1;
      const nc = traffic ? traffic.audible(cars, p.x, p.z, 220) : 0;
      nPeople = people ? people.audible(persons, p.x, p.z, 40) : 0;
      plan.tick(at, listener, cars, nc, persons, nPeople, typeLarge, quiet);
      applyMotors(at);
      followEvents(at);
      trafficGlide.to(plan.levels.traffic * LIFE_MIX.traffic, at, 2, 2e-4);
      if (crowd) {
        crowd.gain.to(plan.levels.crowd * LIFE_MIX.crowd * (quiet ? LIFE_MIX.blue.crowd : 1), at, 1.5, 2e-4);
        crowd.cutoff.to(quiet ? LIFE_MIX.blue.crowdCutoff : 1300, at, 1, 5);
      }
    }
    playEvents(at);
    const spent = performance.now() - t0;
    msUpdate += (spent - msUpdate) * 0.02; msMax = Math.max(msMax, spent);
  }

  if (!fallback) startWorker();
  const createMs = performance.now() - created;

  return {
    plan,
    /** Once per riding frame, after life.update; `camera` is the listener. */
    update(camera, dt = 0) {
      if (disposed) return;
      try { frame(camera, dt); } catch (error) {
        // the city's sound must never stop the ride
        if (!warned) { warned = true; console.warn('[audio] city sound update failed', error); }
      }
    },
    setHour(name) { quiet = name === 'blue' ? 1 : 0; eventsLevel = quiet ? LIFE_MIX.blue.events : 1; },
    /** Drop everything scheduled and start the plan afresh (the host may call this on a jump). */
    reset() { if (!disposed) restartPlan(context.currentTime); },
    /** Silence at once while the context keeps running (the booking scene); the next update fades the city back in. */
    hush() { if (!disposed) silence(); },
    stats() {
      let active = 0, fading = 0;
      for (const m of plan.motors) { if (m.state === 1) active++; else if (m.state === 2) fading++; }
      return {
        caps: plan.caps, motors: active, fading, oneShots: live.length, nodes: nodes.length, silent,
        crowd: +plan.levels.crowd.toFixed(3), traffic: +plan.levels.traffic.toFixed(3), people: plan.levels.people,
        createMs: +createMs.toFixed(2), jobsLeft: jobs.length - jobIndex, worker: !fallback, workerMs: +workerMs.toFixed(1), generationMs: +generationMs.toFixed(1), generationMaxFrameMs: +generationMaxFrameMs.toFixed(2),
        ms: +msUpdate.toFixed(4), msMax: +msMax.toFixed(3), ...plan.counters,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopAll(); worker?.terminate(); worker = null;
      for (const s of loops) { try { s.stop(); } catch { /* not started */ } }
      for (const node of nodes) node.disconnect();
    },
  };
}
