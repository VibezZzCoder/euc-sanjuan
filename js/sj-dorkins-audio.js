/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// What the player hears of Officer Dorkins: his siren, its sting when he turns up, the hum of his hover wheel and his
// paddle (wind-up, swing, hit), his wheel's low-battery beeps (one when it starts to fade, three falling ones when he
// breaks off; synthesized here, no file), plus the paper tear at the booking desk. From the San Francisco edition
// (js/nemesis-audio.js, © 2026 VibezZzCoder, MIT; first written for the New York edition).
//
//   - The siren is EUC Thrills' chase siren: two CC0 loops (far wail, close wail; audio/euc/PROVENANCE.md) crossfade by
//     his range, the level follows his range on EUC Thrills' curve (silent beyond 60 m, full inside 8 m) and both loops
//     lean a few percent sharp while he closes. After ten seconds of a chase it settles down, and it ducks under his
//     wind-up and swing so the paddle is the thing to hear.
//   - San Juan's mix: the loops pass a gentle low-pass (nothing thin or bright reaches the speakers) and sit under the
//     rider's own wheel and the city at range; levels are measured against them (see SIREN below).
//   - No sound graph exists while he is not around: the two loops are fetched and decoded once (at the first Ride) and
//     kept as buffers; the nodes are made when he appears and taken apart after he has gone and the siren has faded.
//   - A failed load leaves the chase silent; nothing throws into the frame loop.
import { AUDIO } from './euc/data/tuning.js';

export const COP_SAMPLE_FILES = Object.freeze({ sirenFar: 'siren_far_loop.wav', sirenClose: 'siren_close_loop.wav' });

export const SIREN = Object.freeze({
  level: 0.2,
  farMetres: AUDIO.sirenFarMetres, nearMetres: AUDIO.sirenNearMetres, curve: AUDIO.sirenDistanceCurve,
  blendFarMetres: AUDIO.sirenBlendFarMetres, blendNearMetres: AUDIO.sirenBlendNearMetres,
  responseSeconds: AUDIO.sirenResponseSeconds, releaseSeconds: AUDIO.sirenReleaseSeconds,
  dopplerPerMs: AUDIO.sirenDopplerPerMs, dopplerMax: AUDIO.sirenDopplerMax, rateSeconds: AUDIO.sirenRateSeconds,
  settleAfter: 10, settle: 0.56, settleSeconds: 3,
  stingLevel: 0.22, stingSeconds: 1.7, pan: 0.55, swingDuck: 0.6,
  lowpassHz: 2600, // the loops' brightest partials sit near 1.1 kHz; above this there is only edge
  lingerSeconds: 3, // after he has gone, the graph stays this long so the release can fade
});

export const HUM = Object.freeze({ level: 0.012, refMetres: 4, rangeMetres: 70, baseHz: 92, perSpeedHz: 2.4,
  cutoffHz: 420, cutoffPerSpeed: 40, airLevel: 0.6, response: 0.15 });

export const PADDLE_SOUND = Object.freeze({
  windupLevel: 0.2, windupFromHz: 450, windupToHz: 2200, windupQ: 1.4,
  // the low wind-up sweeps lower, the high one higher (the same noise burst); a held paddle that moves again clicks once
  lowScale: 0.55, highScale: 1.45, resumeHz: 1500,
  swingLevel: 0.16, swingHz: AUDIO.swingNoiseHz, swingQ: AUDIO.swingNoiseQ, swingSeconds: AUDIO.swingNoiseSeconds,
  hitLevel: 0.3, hitFromHz: AUDIO.hitThumpFromHz, hitToHz: AUDIO.hitThumpToHz, hitSeconds: AUDIO.hitThumpSeconds,
  hitNoiseHz: AUDIO.hitNoiseHz, hitNoiseSeconds: AUDIO.hitNoiseSeconds,
  tearLevel: 0.12, tearHz: 1800, tearSeconds: 0.32,
});

/** His wheel's low-battery beeps: short soft square tones through a low-pass, falling in pitch. */
export const BATTERY_SOUND = Object.freeze({ level: 0.07, seconds: 0.11, gap: 0.17, lowHz: [1240], outHz: [1240, 990, 740], cutoffHz: 2400 });

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : Number.isFinite(v) ? v : lo);
const mapRange = (v, a, b) => clamp((v - a) / (b - a));

/** 1 at the start of a chase, easing down to SIREN.settle after settleAfter seconds. */
export function settleFactor(chaseTime) {
  const t = clamp((chaseTime - SIREN.settleAfter) / SIREN.settleSeconds);
  return 1 - (1 - SIREN.settle) * t * t * (3 - 2 * t);
}
/** The siren's range-driven targets before smoothing: { gain, blend (0 far wail .. 1 close), rate }. */
export function sirenTargets(range, closing = 0, chaseTime = 0) {
  if (!Number.isFinite(range)) return { gain: 0, blend: null, rate: 1 };
  const proximity = mapRange(range, SIREN.farMetres, SIREN.nearMetres) ** SIREN.curve;
  return { gain: SIREN.level * proximity * settleFactor(chaseTime), blend: mapRange(range, SIREN.blendFarMetres, SIREN.blendNearMetres),
    rate: 1 + clamp(closing * SIREN.dopplerPerMs, -SIREN.dopplerMax, SIREN.dopplerMax) };
}
export function humTargets(distance, speed, present = true) {
  const d = Math.max(HUM.refMetres, Number.isFinite(distance) ? distance : Infinity);
  const fade = present ? clamp((HUM.rangeMetres - d) / (HUM.rangeMetres * 0.4)) : 0;
  const s = Math.abs(Number.isFinite(speed) ? speed : 0);
  return { gain: HUM.level * (HUM.refMetres / d) * fade, hz: HUM.baseHz + HUM.perSpeedHz * Math.min(s, 25),
    cutoff: HUM.cutoffHz + HUM.cutoffPerSpeed * Math.min(s, 25), air: HUM.airLevel * Math.min(1, s / 17) };
}

function decode(context, data) {
  return new Promise((resolve, reject) => {
    const pending = context.decodeAudioData(data, resolve, reject);
    if (pending && typeof pending.then === 'function') pending.then(resolve, reject);
  });
}

// The live graph while he is around.
class OfficerGraph {
  constructor(context, output, buffers, noise) {
    this.context = context; this.noise = noise; this.nodes = []; this.targets = {}; this.oneShots = new Set(); this.blend = 0;
    const own = node => (this.nodes.push(node), node);
    const gain = value => { const node = own(context.createGain()); node.gain.value = value; return node; };
    this.out = context.createStereoPanner ? own(context.createStereoPanner()) : gain(1);
    this.out.connect(output);
    const tone = own(context.createBiquadFilter()); tone.type = 'lowpass'; tone.frequency.value = SIREN.lowpassHz; tone.Q.value = 0.5;
    tone.connect(this.out);
    this.tone = tone;
    this.farGain = gain(0); this.closeGain = gain(0); this.farGain.connect(tone); this.closeGain.connect(tone);
    const now = context.currentTime;
    this.sources = [];
    for (const [key, target] of [['sirenFar', this.farGain], ['sirenClose', this.closeGain]]) {
      const buffer = buffers[key]; if (!buffer) continue;
      const source = own(context.createBufferSource()); source.buffer = buffer; source.loop = true; source.connect(target);
      source.start(now, (now * 0.37) % buffer.duration); this.sources.push(source);
      this[key === 'sirenFar' ? 'far' : 'close'] = source;
    }
    this.buffers = buffers;
    // the hum: a sawtooth drone and its octave through a low-pass, plus thruster air
    this.humHz = own(context.createConstantSource()); this.humHz.offset.value = HUM.baseHz;
    const drone = own(context.createOscillator()); drone.type = 'sawtooth'; drone.frequency.value = 0; this.humHz.connect(drone.frequency);
    const octave = own(context.createOscillator()); octave.type = 'sine'; octave.frequency.value = 0; octave.detune.value = 9;
    this.humHz.connect(gain(2)).connect(octave.frequency);
    this.humFilter = own(context.createBiquadFilter()); this.humFilter.type = 'lowpass'; this.humFilter.frequency.value = HUM.cutoffHz; this.humFilter.Q.value = 0.9;
    this.humGain = gain(0);
    drone.connect(this.humFilter); octave.connect(gain(0.5)).connect(this.humFilter); this.humFilter.connect(this.humGain).connect(this.out);
    this.sources.push(this.humHz, drone, octave);
    if (noise) {
      const air = own(context.createBufferSource()); air.buffer = noise; air.loop = true;
      const band = own(context.createBiquadFilter()); band.type = 'bandpass'; band.frequency.value = 900; band.Q.value = 0.8;
      this.airGain = gain(0); air.connect(band).connect(this.airGain).connect(this.humGain); this.sources.push(air);
    }
    for (const s of this.sources) if (s !== this.far && s !== this.close) s.start(now);
  }
  to(name, param, value, now, tc, epsilon = 0.0002) {
    const last = this.targets[name];
    if (last && Math.abs(last.value - value) < epsilon && last.tc === tc) return;
    param.cancelScheduledValues(now); param.setTargetAtTime(value, now, tc); this.targets[name] = { value, tc };
  }
  update(view, now) {
    const S = SIREN, siren = sirenTargets(view.chasing ? view.range : Infinity, view.closing, view.chaseTime);
    if (view.swinging) siren.gain *= S.swingDuck;
    const tc = view.chasing ? S.responseSeconds : S.releaseSeconds;
    if (siren.blend !== null) this.blend = siren.blend;
    const angle = this.blend * Math.PI / 2;
    this.to('far', this.farGain.gain, siren.gain * Math.cos(angle), now, tc);
    this.to('close', this.closeGain.gain, siren.gain * Math.sin(angle), now, tc);
    for (const [name, source] of [['farRate', this.far], ['closeRate', this.close]]) if (source) this.to(name, source.playbackRate, siren.rate, now, S.rateSeconds, 0.001);
    const hum = humTargets(view.range, view.speed, view.present);
    this.to('hum', this.humGain.gain, hum.gain, now, HUM.response, 0.00005);
    this.to('humHz', this.humHz.offset, hum.hz, now, HUM.response, 0.5);
    this.to('humCutoff', this.humFilter.frequency, hum.cutoff, now, HUM.response, 5);
    if (this.airGain) this.to('air', this.airGain.gain, hum.air, now, HUM.response, 0.01);
    if (this.out.pan) this.to('pan', this.out.pan, clamp(view.pan, -1, 1) * S.pan, now, 0.08, 0.02);
  }
  sting(now) {
    const buffer = this.buffers.sirenClose; if (!buffer) return;
    const S = SIREN, c = this.context, source = c.createBufferSource(), envelope = c.createGain();
    source.buffer = buffer;
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(S.stingLevel, now + 0.04);
    envelope.gain.setValueAtTime(S.stingLevel, now + S.stingSeconds - 0.6); envelope.gain.linearRampToValueAtTime(0, now + S.stingSeconds);
    source.connect(envelope).connect(this.tone); this.track(source, envelope); source.start(now, 0, S.stingSeconds + 0.05);
  }
  cue(kind, now) {
    const P = PADDLE_SOUND;
    if (kind === 'windup') this.burst(now, P.windupFromHz * P.lowScale, P.windupToHz * P.lowScale, P.windupQ, 0.7, P.windupLevel, 0.6);
    else if (kind === 'windupHigh') this.burst(now, P.windupFromHz * P.highScale, P.windupToHz * P.highScale, P.windupQ, 0.7, P.windupLevel, 0.6);
    else if (kind === 'resume') this.burst(now, P.resumeHz, P.resumeHz * 1.3, 1.6, 0.09, P.windupLevel, 0.01);
    else if (kind === 'swing') this.burst(now, P.swingHz, P.swingHz * 0.7, P.swingQ, P.swingSeconds, P.swingLevel, 0.02);
    else if (kind === 'batteryLow' || kind === 'battery') {
      const B = BATTERY_SOUND, tones = kind === 'battery' ? B.outHz : B.lowHz;
      tones.forEach((hz, i) => this.beep(now + i * B.gap, hz));
    }
    else if (kind === 'tear') this.burst(now, P.tearHz, P.tearHz * 0.6, 0.9, P.tearSeconds, P.tearLevel, 0.03);
    else { this.thump(now, P.hitFromHz, P.hitToHz, P.hitSeconds, P.hitLevel); this.burst(now, P.hitNoiseHz, P.hitNoiseHz * 0.8, 0.9, P.hitNoiseSeconds, P.hitLevel * 0.6, 0.004); }
  }
  burst(at, fromHz, toHz, q, seconds, level, peakAt) {
    if (!this.noise) return;
    const c = this.context, source = c.createBufferSource(), band = c.createBiquadFilter(), envelope = c.createGain();
    source.buffer = this.noise; band.type = 'bandpass'; band.Q.value = q;
    band.frequency.setValueAtTime(fromHz, at); band.frequency.exponentialRampToValueAtTime(toHz, at + seconds);
    envelope.gain.setValueAtTime(0.0001, at); envelope.gain.exponentialRampToValueAtTime(level, at + peakAt); envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    source.connect(band).connect(envelope).connect(this.out); this.track(source, band, envelope);
    source.start(at, ((at * 7.13) % 1) * Math.max(0, this.noise.duration - seconds - 0.05)); source.stop(at + seconds + 0.02);
  }
  beep(at, hz) {
    const B = BATTERY_SOUND, c = this.context, osc = c.createOscillator(), tone = c.createBiquadFilter(), envelope = c.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(hz, at);
    tone.type = 'lowpass'; tone.frequency.value = B.cutoffHz; tone.Q.value = 0.4;
    envelope.gain.setValueAtTime(0.0001, at); envelope.gain.exponentialRampToValueAtTime(B.level, at + 0.008);
    envelope.gain.setValueAtTime(B.level, at + B.seconds - 0.03); envelope.gain.exponentialRampToValueAtTime(0.0001, at + B.seconds);
    osc.connect(tone).connect(envelope).connect(this.out); this.track(osc, tone, envelope); osc.start(at); osc.stop(at + B.seconds + 0.02);
  }
  thump(at, fromHz, toHz, seconds, level) {
    const c = this.context, osc = c.createOscillator(), envelope = c.createGain();
    osc.frequency.setValueAtTime(fromHz, at); osc.frequency.exponentialRampToValueAtTime(toHz, at + seconds);
    envelope.gain.setValueAtTime(0.0001, at); envelope.gain.exponentialRampToValueAtTime(level, at + 0.004); envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(envelope).connect(this.out); this.track(osc, envelope); osc.start(at); osc.stop(at + seconds + 0.02);
  }
  track(source, ...nodes) {
    this.oneShots.add(source);
    source.onended = () => { if (!this.oneShots.delete(source)) return; source.disconnect(); for (const node of nodes) node.disconnect(); };
  }
  dispose() {
    const now = this.context.currentTime;
    for (const source of this.oneShots) { try { source.stop(now); } catch { /* ended */ } source.onended(); }
    for (const s of this.sources) { try { s.stop(); } catch { /* not started */ } }
    for (const node of this.nodes) node.disconnect();
  }
}

/** One per audio context. update(view) every frame he is around; silence() when the ride stops; dispose() at the end. */
export function createDorkinsAudio(context, output) {
  const buffers = {}, controller = new AbortController();
  let graph = null, disposed = false, lastAt = 0, noise = null;
  const last = { sting: -1, windup: -1, windupHigh: -1, resume: -1, swing: -1, hit: -1, tear: -1, battery: -1, batteryLow: -1 };
  try {
    noise = context.createBuffer(1, Math.round(context.sampleRate * 2), context.sampleRate);
    const data = noise.getChannelData(0); let seed = 0x2545f491;
    for (let i = 0; i < data.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = ((seed >>> 0) / 4294967296) * 2 - 1; }
  } catch { noise = null; }
  for (const [key, file] of Object.entries(COP_SAMPLE_FILES)) {
    fetch(new URL(`../audio/euc/${file}`, import.meta.url), { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then(data => disposed ? null : decode(context, data))
      .then(buffer => { if (buffer && !disposed) buffers[key] = buffer; })
      .catch(error => { if (!disposed && error?.name !== 'AbortError') console.warn(`[audio] siren ${file} unavailable`, error?.message ?? error); });
  }
  // the paper tear at the booking desk: a lone one-shot (no officer graph), stopped by silence()
  const shots = new Set();
  function tear() {
    if (disposed || !noise || context.state !== 'running') return;
    const P = PADDLE_SOUND, at = context.currentTime, source = context.createBufferSource(), band = context.createBiquadFilter(), envelope = context.createGain();
    source.buffer = noise; band.type = 'bandpass'; band.Q.value = 0.9;
    band.frequency.setValueAtTime(P.tearHz, at); band.frequency.exponentialRampToValueAtTime(P.tearHz * 0.6, at + P.tearSeconds);
    envelope.gain.setValueAtTime(0.0001, at); envelope.gain.exponentialRampToValueAtTime(P.tearLevel, at + 0.03); envelope.gain.exponentialRampToValueAtTime(0.0001, at + P.tearSeconds);
    source.connect(band).connect(envelope).connect(output);
    shots.add(source); source.onended = () => { if (shots.delete(source)) { source.disconnect(); band.disconnect(); envelope.disconnect(); } };
    source.start(at, 0.37); source.stop(at + P.tearSeconds + 0.02);
  }
  const api = {
    tear,
    get live() { return !!graph; },
    stats: () => ({ graph: !!graph, buffers: Object.keys(buffers).length }),
    update(view) {
      if (disposed || !view) return;
      try {
        const now = context.currentTime;
        if (view.present && !graph && buffers.sirenFar && buffers.sirenClose) {
          graph = new OfficerGraph(context, output, buffers, noise);
          // events from before the graph existed are not replayed, except the sting of the ambush that made it
          for (const k of Object.keys(last)) last[k] = view[k] ?? 0;
          if (view.chasing && view.chaseTime < 0.5) last.sting = (view.sting ?? 0) - 1;
        }
        if (!graph) { for (const k of Object.keys(last)) last[k] = view[k] ?? 0; return; }
        graph.update(view, now);
        if (view.sting !== last.sting) { graph.sting(now); last.sting = view.sting; }
        for (const kind of ['windup', 'windupHigh', 'resume', 'swing', 'hit', 'tear', 'batteryLow', 'battery']) {
          const count = view[kind] ?? 0;
          if (count !== last[kind]) { if (last[kind] >= 0) graph.cue(kind, now); last[kind] = count; }
        }
        if (view.present) lastAt = now;
        else if (now - lastAt > SIREN.lingerSeconds) { graph.dispose(); graph = null; }
      } catch (error) {
        if (!api.warned) console.warn('[audio] officer sound failed', error);
        api.warned = true;
      }
    },
    /** Silence at once (the ride stopped, the page is hidden): the graph is taken apart; it is made again when needed. */
    silence() {
      if (graph) { graph.dispose(); graph = null; }
      for (const s of [...shots]) { try { s.stop(); } catch { /* ended */ } s.onended(); }
    },
    dispose() { if (disposed) return; api.silence(); disposed = true; controller.abort(); },
  };
  return api;
}
