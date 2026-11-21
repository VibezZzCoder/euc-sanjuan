/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from mrdoob/slop-newyork (MIT, (c) 2026 Mr.doob) */
// The city's sound material, synthesized once into plain sample arrays: no files, no downloads.
//
// Every generator returns a Float32Array of mono samples at `rate`, mean-free, with short endpoint fades, so a buffer
// starts and ends at zero. `LIFE_SOUND_JOBS` lists them as small independent jobs; js/sj-life-audio.js runs a few per
// frame after the first Ride, so no single frame pays for all of them.
//
// Footsteps, formant pseudo-speech, the horn reeds and the four-stroke exhaust loop follow the procedural city audio
// of the New York edition (js/audio-events.js, js/audio-synthesis.js), re-voiced for a slow old town: soft soles on
// stone with the grit band lowered, a compact car's two-reed horn without its upper harmonics, a small petrol and a
// small diesel exhaust at crawling revs with no valve clatter. The surprised outbursts, the sett rumble, the plaza
// murmur bed and the distant-traffic bed are new.
// A job's `run` returns its samples, or a generator that yields between slices of work and returns them.

const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smoothstep = (v) => { const x = clamp(v); return x * x * (3 - 2 * x); };

/** Small seeded generator in [0, 1). */
export function soundRandom(seed) {
  let state = ((seed | 0) * 2654435761) >>> 0;
  state = Math.imul(state ^ (state >>> 16), 0x7feb352d);
  state = Math.imul(state ^ (state >>> 15), 0x846ca68b);
  state ^= state >>> 16;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

/** Remove the mean, fade the ends (fadeIn/fadeOut seconds) and scale to `peak`. */
function finish(samples, rate, peak, fadeIn = 0.002, fadeOut = 0.012) {
  const n = samples.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += samples[i];
  mean /= n;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / (rate * fadeIn), (n - 1 - i) / (rate * fadeOut));
    samples[i] = (samples[i] - mean) * fade;
    const a = Math.abs(samples[i]);
    if (a > max) max = a;
  }
  const scale = max > 0 ? peak / max : 0;
  for (let i = 0; i < n; i++) samples[i] *= scale;
  return samples;
}

/** Loops: mean-free and scaled to an RMS (never above `ceiling`), no fades: the content itself wraps. */
function finishLoop(samples, rms, ceiling = 0.9) {
  const n = samples.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += samples[i];
  mean /= n;
  let energy = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    samples[i] -= mean;
    energy += samples[i] * samples[i];
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const scale = Math.min(ceiling / Math.max(peak, 1e-6), rms / Math.max(Math.sqrt(energy / n), 1e-6));
  for (let i = 0; i < n; i++) samples[i] *= scale;
  return samples;
}

/** Two-second noise loop, softened above ~5 kHz; filter state is warmed one full turn so the loop seam is plain noise. */
export function noiseLoop(rate) {
  const n = Math.round(rate * 2), s = new Float32Array(n), random = soundRandom(0x73616e6a);
  for (let i = 0; i < n; i++) s[i] = random() * 2 - 1;
  const k = 1 - Math.exp(-TAU * 5000 / rate);
  let y = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { y += (s[i] - y) * k; if (pass) s[i] = y; }
  // second pass wrote the filtered values; the first only warmed the state
  return finishLoop(s, 0.3, 0.95);
}

/**
 * Four-stroke exhaust loop at `referenceRPM`: twenty whole cycles, so pitching it with playbackRate keeps every firing.
 * Each firing is a short pressure release plus a damped body resonance and a little low noise (no valve clatter).
 */
export function exhaustLoop(rate, { cylinders = 4, diesel = false, seed = 1, referenceRPM = 1000 } = {}) {
  const cycles = 20, length = Math.round(cycles * 120 / referenceRPM * rate);
  const s = new Float32Array(length), timing = soundRandom(seed), noise = soundRandom(seed ^ 0x65786861);
  const strength = Array.from({ length: cylinders }, () => 0.85 + timing() * 0.3);
  const lag = Array.from({ length: cylinders }, () => (timing() - 0.5) * 0.04);
  const resonance = (diesel ? 82 : 118) * (0.96 + timing() * 0.08);
  const span = Math.round(rate * (diesel ? 0.06 : 0.05)), interval = length / (cycles * cylinders);
  for (let firing = 0; firing < cycles * cylinders; firing++) {
    const c = firing % cylinders;
    let index = (Math.round((firing + lag[c] + (timing() - 0.5) * 0.015) * interval) + length) % length;
    const level = strength[c] * (0.9 + timing() * 0.2), decay = (diesel ? 0.02 : 0.013) * (0.95 + timing() * 0.1);
    // exponentials and the resonance as per-sample recurrences (same shape as evaluating them at each t)
    const kTail = Math.exp(-1 / (rate * decay)), kAttack = Math.exp(-1 / (rate * 0.0007));
    const kFast = Math.exp(-1 / (rate * 0.0024)), kSlow = Math.exp(-1 / (rate * 0.009));
    const w = TAU * resonance / rate, cw = Math.cos(w), sw = Math.sin(w);
    let low = 0, tail = 1, attack = 1, fast = 1, slow = 1, sn = 0, cs = 1;
    for (let i = 0; i < span; i++) {
      const white = noise() * 2 - 1;
      low += (white - low) * 0.12;
      s[index] += level * (1 - attack) * (fast - 0.36 * slow + sn * tail * 0.36 + low * tail * (diesel ? 0.55 : 0.3));
      tail *= kTail; attack *= kAttack; fast *= kFast; slow *= kSlow;
      const ns = sn * cw + cs * sw; cs = cs * cw - sn * sw; sn = ns;
      if (++index === length) index = 0;
    }
  }
  return finishLoop(s, 0.3);
}

/**
 * Tyres over setts: irregular soft knocks (one per stone, about 22 per second at `referenceSpeed` 5 m/s), each a
 * short burst of low-passed noise. Played faster for faster cars, which also brightens it a little.
 */
export function settLoop(rate, seed = 7) {
  const n = Math.round(rate * 2), s = new Float32Array(n), random = soundRandom(seed);
  const span = Math.round(rate * 0.03), k = 1 - Math.exp(-TAU * 650 / rate), k2 = 1 - Math.exp(-TAU * 160 / rate);
  for (let t = random() * 0.02; t < 2; t += 0.032 + random() * 0.03) {
    let index = Math.round(t * rate) % n, a = 0, b = 0;
    const level = 0.4 + random() * 0.6, decay = 0.005 + random() * 0.006;
    for (let i = 0; i < span; i++) {
      const white = random() * 2 - 1;
      a += (white - a) * k; b += (a - b) * k2;
      const time = i / rate;
      s[index] += (a - b * 0.6) * level * (1 - Math.exp(-time / 0.0008)) * Math.exp(-time / decay);
      if (++index === n) index = 0;
    }
  }
  return finishLoop(s, 0.3);
}

/** A soft sole on stone: heel, roll and a light scuff; the grit band sits lower and quieter than a city shoe. */
export function footstep(rate, seed) {
  const random = soundRandom(seed);
  const soleTime = 0.03 + random() * 0.035, scuffTime = soleTime + 0.03 + random() * 0.03;
  const contacts = Array.from({ length: 4 }, () => ({ time: random() * 0.09, decay: 200 + random() * 260, level: 0.02 + random() * 0.05 }));
  const k = [160, 820, 2600].map((f) => 1 - Math.exp(-TAU * f / rate));
  const bands = [0, 0, 0], n = Math.round(rate * 0.22), s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate, noise = random() * 2 - 1;
    for (let b = 0; b < 3; b++) bands[b] += (noise - bands[b]) * k[b];
    const body = bands[1] - bands[0], grit = bands[2] - bands[1];
    const heel = (1 - Math.exp(-t * 1500)) * Math.exp(-t * 95);
    const sole = Math.max(0, t - soleTime), roll = (1 - Math.exp(-sole * 900)) * Math.exp(-sole * 55);
    const scuff = Math.max(0, t - scuffTime), drag = (1 - Math.exp(-scuff * 120)) * Math.exp(-scuff * 40);
    let fragments = 0;
    for (const c of contacts) if (t > c.time) fragments += Math.exp(-(t - c.time) * c.decay) * c.level;
    s[i] = (bands[0] * 0.35 + body * 0.95 + grit * 0.25) * heel + (bands[0] * 0.3 + body * 0.6 + grit * 0.08) * roll
      + grit * 0.12 * drag + grit * fragments * 0.6;
  }
  return finish(s, rate, 0.55);
}

// Six voices from low to high: pitch (Hz), formant scale, breathiness.
export const SPEAKERS = Object.freeze([
  { pitch: 102, formants: 0.88, breath: 0.07 }, { pitch: 118, formants: 0.93, breath: 0.1 },
  { pitch: 136, formants: 0.97, breath: 0.08 }, { pitch: 178, formants: 1.04, breath: 0.12 },
  { pitch: 200, formants: 1.09, breath: 0.1 }, { pitch: 222, formants: 1.13, breath: 0.13 },
]);
const VOWELS = [[600, 1170, 2380], [470, 1740, 2460], [340, 2010, 2650], [470, 890, 2300], [420, 1450, 2350]];

/**
 * A run of syllables without words or language: a glottal pulse train with jitter and shimmer through three moving
 * formant resonators, with nasal, fricative and plosive onsets. `exclaim` gives a short rising-then-falling outburst.
 */
export function speech(rate, speaker, seed, { exclaim = false } = {}) {
  const random = soundRandom(seed);
  const duration = exclaim ? 0.26 + random() * 0.12 : 0.55 + random() * 0.3;
  const count = exclaim ? 1 + (random() < 0.5 ? 1 : 0) : 2 + Math.floor(random() * 3);
  const segments = Array.from({ length: count }, () => ({
    vowel: VOWELS[Math.floor(random() * VOWELS.length)], weight: 0.65 + random() * 0.7, consonant: Math.floor(random() * 5),
    transition: 0.028 + random() * 0.038, stress: 0.62 + random() * 0.38, pitch: 0.96 + random() * 0.1,
  }));
  const total = segments.reduce((sum, g) => sum + g.weight, 0);
  let cursor = 0;
  for (const g of segments) { g.start = cursor; g.duration = duration * g.weight / total; cursor += g.duration; }
  const resonators = [95, 135, 190].map((bandwidth, i) => {
    const radius = Math.exp(-Math.PI * bandwidth / rate);
    return { radius, a: 0, b: radius * radius, gain: (1 - radius) * [1, 0.75, 0.3][i], frequency: segments[0].vowel[i] * speaker.formants, y1: 0, y2: 0 };
  });
  const fall = 0.08 + random() * 0.1, open = 0.52 + speaker.breath * 0.5, closing = 0.19;
  const kb = 1 - Math.exp(-TAU * 1500 / rate), ko = 1 - Math.exp(-TAU * 2600 / rate);
  const kf = 1 - Math.exp(-32 / (rate * 0.022)), kp = 1 - Math.exp(-1 / (rate * 0.025));
  const nasal = [250, 1180, 2250];
  let phase = random(), lastFlow = 0, breath = 0, low = 0, out = 0, index = 0, jitter = 1, shimmer = 1;
  let pitch = speaker.pitch, stress = segments[0].stress;
  const n = Math.ceil(duration * rate), s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    while (index + 1 < count && t >= segments[index + 1].start) index++;
    const g = segments[index], previous = segments[Math.max(0, index - 1)], local = t - g.start;
    const art = smoothstep(local / g.transition);
    const voiced = g.consonant === 0 ? 0.35 + art * 0.65 : g.consonant === 1 ? 0.7 + art * 0.3 : art;
    if (i % 32 === 0) for (let r = 0; r < 3; r++) {
      const res = resonators[r], from = g.consonant === 0 ? nasal[r] : previous.vowel[r];
      res.frequency += ((from + (g.vowel[r] - from) * art) * speaker.formants - res.frequency) * kf;
      res.a = 2 * res.radius * Math.cos(TAU * res.frequency / rate);
    }
    const noise = random() * 2 - 1;
    breath += (noise - breath) * kb; low += (noise - low) * 0.025;
    const u = t / duration;
    // an outburst rises sharply into its first stress and falls away; speech drifts down over the phrase
    const contour = exclaim ? 1.18 + 0.35 * Math.sin(Math.PI * Math.min(1, u * 1.6)) - 0.3 * u : 1.06 - fall * u;
    pitch += (speaker.pitch * g.pitch * contour - pitch) * kp;
    stress += (g.stress - stress) * kp;
    phase += pitch * jitter * (1 + 0.014 * Math.sin(t * 21) + 0.008 * Math.sin(t * 37)) / rate;
    if (phase >= 1) { phase -= 1; jitter = 0.99 + random() * 0.02; shimmer = 0.93 + random() * 0.14; }
    const flow = phase < open ? 0.5 - 0.5 * Math.cos(Math.PI * phase / open) : phase < open + closing ? Math.cos(Math.PI * 0.5 * (phase - open) / closing) : 0;
    const pulse = (flow - lastFlow) * rate / (speaker.pitch * 8);
    lastFlow = flow;
    const excitation = pulse * shimmer * voiced + breath * speaker.breath * voiced * (exclaim ? 1.6 : 1);
    let vowel = 0;
    for (const res of resonators) { const y = excitation + res.a * res.y1 - res.b * res.y2; res.y2 = res.y1; res.y1 = y; vowel += y * res.gain; }
    const fricative = g.consonant === 2 ? (breath - low) * 0.08 * (1 - art)
      : g.consonant === 3 ? (noise - breath) * 0.06 * Math.exp(-Math.max(0, local - 0.012) * 180)
      : g.consonant === 4 ? breath * 0.05 * (1 - art) : 0;
    const envelope = smoothstep(t / (exclaim ? 0.018 : 0.025)) * smoothstep((duration - t) / (exclaim ? 0.07 : 0.085));
    out += ((vowel * stress + fricative) * envelope - out) * ko;
    s[i] = out;
  }
  return finish(s, rate, 0.5);
}

/** A compact car's horn: two detuned reeds a third apart, few harmonics, a soft onset and release. */
export function horn(rate, seed, taps) {
  const random = soundRandom(seed);
  const f = [395 + random() * 40, 492 + random() * 45], phases = [random(), random()];
  const harmonics = [1, 0.62, 0.3, 0.12, 0.05]; // fundamental-led: round, not a nasal buzz
  const end = taps[taps.length - 1][1], n = Math.ceil((end + 0.02) * rate), s = new Float32Array(n);
  let flutter = 0, air = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate, noise = random() * 2 - 1;
    flutter += (noise - flutter) * 0.008; air += (noise - air) * 0.2;
    let gate = 0;
    for (const [a, b] of taps) if (t >= a && t < b + 0.04) gate = Math.max(gate, (1 - Math.exp(-(t - a) * 140)) * smoothstep((b + 0.04 - t) / 0.04));
    let tone = 0;
    for (let r = 0; r < 2; r++) {
      phases[r] += f[r] * (1 + flutter * 0.04 + Math.sin(t * 67 + r) * 0.002) / rate;
      let buzz = 0;
      for (let h = 0; h < harmonics.length; h++) buzz += Math.sin(TAU * phases[r] * (h + 1)) * harmonics[h];
      tone += buzz * (r ? 0.85 : 1);
    }
    s[i] = (tone + air * 0.12) * gate;
  }
  // a gentle one-pole low-pass rounds the reeds off
  const k = 1 - Math.exp(-TAU * 1700 / rate);
  let y = 0, y2 = 0;
  for (let i = 0; i < n; i++) { y += (s[i] - y) * k; y2 += (y - y2) * k; s[i] = y2; }
  return finish(s, rate, 0.6, 0.004, 0.02);
}
export const HORN_TAPS = Object.freeze([[[0, 0.16]], [[0, 0.1], [0.19, 0.3]], [[0, 0.3]]]);

/**
 * A plaza heard from inside it: many overlapping distant syllables at random rates plus a few shuffling steps, folded
 * into a loop of `seconds` so nothing restarts at the seam, then low-passed. Built from already generated pieces.
 */
export function* murmurLoop(rate, syllables, steps, seed, seconds = 6) {
  const n = Math.round(rate * seconds), s = new Float32Array(n), random = soundRandom(seed);
  const place = (src, at, gain, speed) => {
    const len = Math.floor((src.length - 1) / speed);
    let o = at;
    for (let i = 0; i < len; i++) {
      const p = i * speed, j = p | 0;
      s[o] += (src[j] + (src[j + 1] - src[j]) * (p - j)) * gain;
      if (++o === n) o = 0;
    }
  };
  const voices = Math.round(seconds * 7);
  for (let k = 0; k < voices; k++) {
    place(syllables[Math.floor(random() * syllables.length)], Math.floor(random() * n), 0.25 + random() * 0.75, 0.9 + random() * 0.2);
    if (k % 6 === 5) yield;
  }
  for (let k = 0; k < seconds * 5; k++) place(steps[Math.floor(random() * steps.length)], Math.floor(random() * n), 0.15 + random() * 0.25, 0.9 + random() * 0.2);
  yield;
  const k1 = 1 - Math.exp(-TAU * 1400 / rate);
  let y = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { y += (s[i] - y) * k1; if (pass) s[i] = y; }
  yield;
  return finishLoop(s, 0.25);
}

/**
 * The jobs, in the order they run. Each returns one sample array; `after` jobs read earlier results.
 * `essential` jobs (car loops) run in the first frame; the rest a few per frame.
 */
export function lifeSoundJobs(rate) {
  const jobs = [
    { key: 'noise', essential: true, run: () => noiseLoop(rate) },
    { key: 'engineSmall', essential: true, run: () => exhaustLoop(rate, { cylinders: 4, seed: 0x736d61 }) },
    { key: 'engineLarge', essential: true, run: () => exhaustLoop(rate, { cylinders: 4, diesel: true, seed: 0x6c7267 }) },
    { key: 'setts', essential: true, run: () => settLoop(rate) },
  ];
  for (let i = 0; i < 3; i++) jobs.push({ key: 'horn' + i, run: () => horn(rate, 17 + i, HORN_TAPS[i]) });
  for (let i = 0; i < 6; i++) jobs.push({ key: 'step' + i, run: () => footstep(rate, i + 1) });
  SPEAKERS.forEach((speaker, v) => {
    for (let i = 0; i < 3; i++) jobs.push({ key: `talk${v}_${i}`, run: () => speech(rate, speaker, 20 + v * 4 + i) });
    jobs.push({ key: `exclaim${v}`, run: () => speech(rate, speaker, 90 + v, { exclaim: true }) });
  });
  const talkKeys = SPEAKERS.flatMap((_, v) => [0, 1, 2].map((i) => `talk${v}_${i}`));
  const stepKeys = [0, 1, 2, 3, 4, 5].map((i) => 'step' + i);
  for (let i = 0; i < 2; i++) jobs.push({ key: 'murmur' + i, run: (done) => murmurLoop(rate, talkKeys.map((k) => done[k]), stepKeys.map((k) => done[k]), 0x6d75 + i, i ? 7 : 6) });
  return jobs;
}
