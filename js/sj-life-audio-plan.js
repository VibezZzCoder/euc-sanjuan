/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from mrdoob/slop-newyork (MIT, (c) 2026 Mr.doob) */
// What the city should sound like this instant, decided without any audio objects (js/sj-life-audio.js plays it).
//
// About ten times a second `tick` reads the cars and people near the listener and decides:
//   - which cars hold one of the few engine voices (nearest and loudest first; a car keeps its voice while it stays in
//     the running, so voices change hands rarely; a voice that loses its car fades before it is reused);
//   - footsteps of nearby walkers, scheduled a little ahead in audio time so their rhythm is not tied to the tick;
//   - turns of conversation (pairs alternate; one person talking to a stall or a group speaks less often);
//   - an outburst when a person's `bumped` counter rises;
//   - the level of the plaza murmur and of the distant-traffic bed.
// Horns arrive as one-shot events from traffic and are placed at once.
//
// The ranking with retiring voices counted against the cap, the 22 m step and 30 m talk cut-offs, alternating speakers
// and the outburst on a rising `bumped` counter follow the New York edition's js/audio-system.js; matching cars by
// position (traffic records carry no identity), the scheduled footsteps, the murmur and traffic beds are new.
// Steady state allocates nothing: every record and table here is made once.

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (v) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const hash01 = (seed) => { const h = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };

export const LIFE_AUDIO_CAPS = Object.freeze({
  desktop: Object.freeze({ motors: 8, events: 8, steps: 6 }),
  phone: Object.freeze({ motors: 6, events: 5, steps: 4 }),
});

// Distances in metres; `ref` is where a source is at its full level, `range` where it has faded out.
export const RANGE = Object.freeze({
  car: { ref: 4, range: 75 }, horn: { ref: 6, range: 140 }, step: { ref: 1.8, range: 22 },
  talk: { ref: 2.2, range: 30 }, exclaim: { ref: 2.5, range: 40 },
  crowd: 40, trafficNear: 30, trafficFar: 220,
});
export const PRIORITY = Object.freeze({ talk: 1, exclaim: 3, horn: 4 });
const LOOKAHEAD = 0.16;       // s of footsteps scheduled ahead
const FADE_OUT = 0.25;        // s a released engine voice takes before it can serve another car
const KEEP_BONUS = 1.4;       // a car with a voice ranks this much louder: no hand-over flutter at the cap edge
const HORN_SPACING = 1.2;     // s: safety spacing between horn sounds (traffic already spaces them by seconds)
const EXCLAIM_COOL = 1.5;     // s per person
const TABLE = 256;            // people tracked by seed (open addressing)

/** Engine parameters for a car: playback rate of the exhaust loop (1 = 1000 rpm) and the levels of its layers. */
export function carVoice(speed, acceleration, large, gear, out) {
  const s = Math.abs(speed), throttle = clamp(acceleration / 1.4) * (s < 0.3 ? 0.4 : 1);
  const ratios = large ? GEARS_LARGE : GEARS_SMALL, idle = large ? 760 : 820;
  // gentle drivers: change up early, never rev
  let g = gear;
  if (s < 0.6) g = 0;
  else {
    const up = 1900 + throttle * 900;
    if (g < ratios.length - 1 && s * ratios[g] > up) g++;
    else if (g > 0 && s * ratios[g - 1] < up * 0.7) g--;
  }
  const slip = throttle * 500 * Math.max(0.1, 1 - s / 8);
  const rpm = clamp(Math.max(idle, s * ratios[g]) + slip, idle, 3200);
  const rolling = clamp(s / 10, 0, 1.4);
  out.gear = g;
  out.rate = rpm / 1000;
  out.engine = (large ? 0.4 : 0.32) + throttle * 0.45 + rolling * 0.18; // idling is quiet; pulling away is heard
  out.cutoff = (large ? 300 : 360) + throttle * 420 + rpm * 0.12;
  out.setts = Math.pow(clamp(s / 6, 0, 1.6), 1.2) * 0.55;
  out.settRate = clamp(0.35 + s / 5 * 0.65, 0.35, 1.8);
  out.road = Math.pow(rolling, 1.4) * 0.35;
  // loudness used for ranking only (relative)
  out.loudness = out.engine * 0.6 + out.setts + out.road;
  return out;
}
const GEARS_SMALL = [520, 330, 235, 175, 135], GEARS_LARGE = [470, 300, 215, 160, 125];
export const LARGE_TYPES = Object.freeze(new Set(['pickup', 'van', 'cargo', 'boxy']));

/** Gain (0–1 before the source's own level), stereo pan and an air/occlusion low-pass for a source. */
export function place(listener, x, y, z, ref, range, out) {
  const dx = x - listener.x, dy = y - listener.y, dz = z - listener.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz), flat = Math.sqrt(dx * dx + dz * dz) || 1;
  const side = (dx * listener.rx + dz * listener.rz) / flat, ahead = (dx * listener.fx + dz * listener.fz) / flat;
  const fade = smoothstep((range - d) / (range * 0.3));
  out.distance = d;
  out.gain = (d <= ref ? 1 : ref / d) * fade;
  // equal-power pan keeps a little of each side: never a hard left or right; nearer than 1.5 m it centres
  out.pan = clamp(side * 0.8 * Math.min(1, d / 1.5), -0.8, 0.8);
  out.cutoff = (1500 + 11000 * Math.exp(-d / 55)) * (ahead < -0.2 ? 0.72 : 1);
  return out;
}

function makeEvent() {
  return { kind: '', when: 0, x: 0, y: 0, z: 0, gain: 0, pan: 0, cutoff: 0, slot: -1, steal: false,
    voice: 0, variant: 0, rate: 1, second: -1, secondRate: 1, gap: 0, follow: 0, priority: 0 };
}

export function createLifeAudioPlan({ phone = false, random = Math.random } = {}) {
  const caps = LIFE_AUDIO_CAPS[phone ? 'phone' : 'desktop'];
  const M = caps.motors, E = caps.events, F = caps.steps;
  const scratch = { distance: 0, gain: 0, pan: 0, cutoff: 0 };
  const carScratch = { gear: 0, rate: 1, engine: 0, cutoff: 0, setts: 0, settRate: 1, road: 0, loudness: 0 };

  // engine voices: 0 free, 1 active, 2 fading
  const motors = Array.from({ length: M }, () => ({
    state: 0, until: 0, x: 0, z: 0, type: -1, large: false, gear: 0, fresh: false,
    gain: 0, pan: 0, cutoff: 0, rate: 1, engine: 0, engineCutoff: 0, setts: 0, settRate: 1, road: 0, speed: 0,
  }));
  // one-shot voices (horn, talk, outburst) and footstep voices: busy until `end`
  const eventEnd = new Float64Array(E), eventPriority = new Uint8Array(E), eventFollow = new Float64Array(E);
  const stepEnd = new Float64Array(F);
  const events = Array.from({ length: E + F + 8 }, makeEvent);
  let eventCount = 0;

  // candidate scratch (cars)
  const CN = 64;
  const carScore = new Float32Array(CN), carVoiceOf = new Int16Array(CN), carOrder = new Int16Array(CN), carUsed = new Uint8Array(CN);
  // people tracked by seed
  const tSeed = new Float64Array(TABLE), tSeen = new Float64Array(TABLE), tStep = new Float64Array(TABLE);
  const tBump = new Int32Array(TABLE), tBumpAt = new Float64Array(TABLE), tTalk = new Float64Array(TABLE), tTurn = new Uint8Array(TABLE);
  const tStepN = new Uint32Array(TABLE);
  const PN = 160;
  const pOrder = new Int16Array(PN), pDist = new Float32Array(PN), pSlot = new Int16Array(PN), pPair = new Int16Array(PN);

  let lastHorn = -Infinity;
  const levels = { crowd: 0, traffic: 0, people: 0, cars: 0 };
  const counters = { horns: 0, hornsDropped: 0, steps: 0, stepsDropped: 0, talks: 0, exclaims: 0, steals: 0, handovers: 0 };

  function reset() {
    for (const m of motors) { m.state = 0; m.type = -1; m.gain = 0; }
    eventEnd.fill(0); eventPriority.fill(0); stepEnd.fill(0);
    tSeed.fill(0); tSeen.fill(-1e9); tStep.fill(0); tTalk.fill(0);
    eventCount = 0; lastHorn = -Infinity;
  }
  reset();

  function slotOf(seed, now, create) {
    const key = seed || 1;
    let h = (Math.abs(Math.floor(key * 2654435761)) >>> 0) % TABLE, free = -1;
    for (let probe = 0; probe < TABLE; probe++, h = (h + 1) % TABLE) {
      if (tSeed[h] === key && now - tSeen[h] < 8) return h;
      if (free < 0 && now - tSeen[h] >= 8) free = h;
      if (tSeed[h] === 0) break;
    }
    if (!create || free < 0) return -1;
    tSeed[free] = key; tSeen[free] = now; tStep[free] = 0; tBump[free] = -1; tBumpAt[free] = -1e9; tTalk[free] = 0; tTurn[free] = 0; tStepN[free] = 0;
    return free;
  }

  function pushEvent() { return eventCount < events.length ? events[eventCount++] : null; }

  /** A one-shot voice for `priority`: a free one, else the lowest-priority voice below it (stolen, faded fast). */
  const taken = { slot: -1, steal: false };
  function claim(now, priority) {
    for (let i = 0; i < E; i++) if (eventEnd[i] <= now) { taken.slot = i; taken.steal = false; return taken; }
    let best = -1;
    for (let i = 0; i < E; i++) if (eventPriority[i] < priority && (best < 0 || eventPriority[i] < eventPriority[best])) best = i;
    if (best < 0) return null;
    taken.slot = best; taken.steal = true; counters.steals++;
    return taken;
  }

  function emit(kind, listener, x, y, z, now, when, length, priority, follow) {
    const r = RANGE[kind];
    place(listener, x, y, z, r.ref, r.range, scratch);
    if (scratch.gain <= 0) return null;
    const t = claim(now, priority);
    if (!t) return null;
    const e = pushEvent();
    if (!e) return null;
    e.kind = kind; e.when = when; e.x = x; e.y = y; e.z = z; e.gain = scratch.gain; e.pan = scratch.pan; e.cutoff = scratch.cutoff;
    e.slot = t.slot; e.steal = t.steal; e.second = -1; e.priority = priority; e.follow = follow;
    eventEnd[t.slot] = when + length; eventPriority[t.slot] = priority; eventFollow[t.slot] = follow;
    return e;
  }

  return {
    caps, motors, events, levels, counters,
    get eventCount() { return eventCount; },
    eventEnd, eventFollow, reset,

    /** A horn from traffic: placed at the car; returns the event or null (out of range, spaced, no voice). */
    horn(listener, x, y, z, now) {
      if (now - lastHorn < HORN_SPACING) { counters.hornsDropped++; return null; }
      const e = emit('horn', listener, x, y, z, now, now, 0.4, PRIORITY.horn, 0);
      if (!e) { counters.hornsDropped++; return null; }
      e.variant = Math.floor(random() * 3); e.rate = 0.95 + random() * 0.1;
      lastHorn = now; counters.horns++;
      return e;
    },

    /** Start a frame's event list (horns are added between ticks; `tick` clears it too). */
    clearEvents() { eventCount = 0; },

    /**
     * The 10 Hz decision. `listener` {x, y, z, rx, rz, fx, fz} (right and forward unit vectors on the ground);
     * cars and people are the reusable records from traffic.audible / people.audible with their counts;
     * `typeLarge(typeIndex)` says whether a type gets the deeper engine; `hourQuiet` 0–1 lowers the beds.
     */
    tick(now, listener, cars, nCars, people, nPeople, typeLarge, hourQuiet = 0) {
      // ---- cars
      const nc = Math.min(nCars, CN);
      let bed = 0;
      for (let i = 0; i < nc; i++) {
        const c = cars[i], dx = c.x - listener.x, dz = c.z - listener.z, d = Math.sqrt(dx * dx + dz * dz);
        carVoiceOf[i] = -1; carUsed[i] = 0;
        if (d > RANGE.trafficNear && d < RANGE.trafficFar) bed += (Math.abs(c.speed) > 1 ? 1 : 0.5) * (1 - d / RANGE.trafficFar);
        place(listener, c.x, c.y, c.z, RANGE.car.ref, RANGE.car.range, scratch);
        carVoice(c.speed, c.acceleration, typeLarge(c.typeIndex), 0, carScratch);
        carScore[i] = scratch.gain * carScratch.loudness;
      }
      // existing voices keep their car: nearest unclaimed record of the same type within reach of last tick's spot
      for (let v = 0; v < M; v++) {
        const m = motors[v];
        if (m.state === 2 && now >= m.until) { m.state = 0; m.type = -1; }
        if (m.state !== 1) continue;
        let best = -1, bestD = 2.5 + Math.abs(m.speed) * 0.25;
        for (let i = 0; i < nc; i++) {
          if (carVoiceOf[i] >= 0 || cars[i].typeIndex !== m.type) continue;
          const d = Math.hypot(cars[i].x - m.x, cars[i].z - m.z);
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best >= 0) { carVoiceOf[best] = v; carScore[best] *= KEEP_BONUS; }
      }
      // rank (insertion sort of indices, loudest first)
      let n = 0;
      for (let i = 0; i < nc; i++) {
        if (carScore[i] <= 1e-4) continue;
        let j = n++;
        while (j > 0 && carScore[carOrder[j - 1]] < carScore[i]) { carOrder[j] = carOrder[j - 1]; j--; }
        carOrder[j] = i;
      }
      const chosen = Math.min(n, M);
      for (let k = 0; k < chosen; k++) carUsed[carOrder[k]] = 1;
      // voices whose car fell out of the running fade, and count against the cap until silent
      for (let v = 0; v < M; v++) {
        const m = motors[v];
        if (m.state !== 1) continue;
        let kept = false;
        for (let i = 0; i < nc; i++) if (carVoiceOf[i] === v && carUsed[i]) { kept = true; break; }
        if (!kept) { m.state = 2; m.until = now + FADE_OUT; m.gain = 0; }
      }
      for (let k = 0; k < chosen; k++) {
        const i = carOrder[k], c = cars[i];
        let v = carVoiceOf[i];
        const fresh = v < 0;
        if (fresh) {
          for (let w = 0; w < M; w++) if (motors[w].state === 0) { v = w; break; }
          if (v < 0) continue; // every voice busy or still fading
          counters.handovers++;
        }
        const m = motors[v], large = typeLarge(c.typeIndex);
        if (fresh) { m.gear = 0; m.large = large; }
        place(listener, c.x, c.y, c.z, RANGE.car.ref, RANGE.car.range, scratch);
        carVoice(c.speed, c.acceleration, large, m.gear, carScratch);
        m.state = 1; m.fresh = fresh; m.x = c.x; m.z = c.z; m.type = c.typeIndex; m.speed = c.speed; m.large = large;
        m.gain = scratch.gain; m.pan = scratch.pan; m.cutoff = Math.min(scratch.cutoff, 7000);
        m.gear = carScratch.gear; m.rate = carScratch.rate; m.engine = carScratch.engine; m.engineCutoff = carScratch.cutoff;
        m.setts = carScratch.setts; m.settRate = carScratch.settRate; m.road = carScratch.road;
      }
      levels.cars = chosen;
      levels.traffic = (1 - Math.exp(-bed / 6)) * (1 - hourQuiet * 0.25);

      // ---- people, nearest first
      let np = 0, crowd = 0;
      for (let i = 0; i < nPeople && np < PN; i++) {
        const p = people[i], d = Math.hypot(p.x - listener.x, p.z - listener.z);
        if (d < RANGE.crowd) crowd += 1 - d / RANGE.crowd;
        if (d > RANGE.exclaim) continue;
        let j = np++;
        while (j > 0 && pDist[j - 1] > d) { pOrder[j] = pOrder[j - 1]; pDist[j] = pDist[j - 1]; j--; }
        pOrder[j] = i; pDist[j] = d;
      }
      levels.people = np;
      levels.crowd = (1 - Math.exp(-crowd / 9)) * (1 - hourQuiet * 0.2);
      for (let k = 0; k < np; k++) {
        const p = people[pOrder[k]], slot = slotOf(p.seed, now, true);
        pSlot[k] = slot; pPair[k] = -1;
        if (slot < 0) continue;
        const known = tBump[slot] >= 0;
        tSeen[slot] = now;
        // outburst when the rider has just hit this person
        if (known && p.bumped > tBump[slot] && now - tBumpAt[slot] > EXCLAIM_COOL) {
          const e = emit('exclaim', listener, p.x, p.y, p.z, now, now + 0.03, 0.45, PRIORITY.exclaim, p.seed);
          if (e) { e.voice = Math.floor(hash01(p.seed) * 6); e.variant = 0; e.rate = 0.97 + random() * 0.08; counters.exclaims++; tBumpAt[slot] = now; tTalk[slot] = now + 2.5; }
        }
        tBump[slot] = p.bumped;
        // footsteps
        const speed = p.speed;
        if (speed > 0.25 && pDist[k] < RANGE.step.range && !p.talking) {
          const interval = clamp(0.6 - (speed - 1.2) * 0.14, 0.3, 0.75);
          if (tStep[slot] === 0 || tStep[slot] < now - 0.1) tStep[slot] = now + random() * interval;
          while (tStep[slot] < now + LOOKAHEAD) {
            const when = Math.max(now, tStep[slot]);
            let f = -1;
            for (let s = 0; s < F; s++) if (stepEnd[s] <= when) { f = s; break; }
            if (f < 0) { counters.stepsDropped++; }
            else {
              place(listener, p.x, p.y - 1.5, p.z, RANGE.step.ref, RANGE.step.range, scratch);
              const e = scratch.gain > 0 ? pushEvent() : null;
              if (e) {
                e.kind = 'step'; e.when = when; e.x = p.x; e.y = p.y; e.z = p.z; e.gain = scratch.gain * (0.75 + clamp(speed / 3) * 0.4);
                e.pan = scratch.pan; e.cutoff = scratch.cutoff; e.slot = f; e.steal = false; e.second = -1; e.follow = 0; e.priority = 0;
                e.variant = (tStepN[slot]++ + Math.floor(random() * 3)) % 6; e.rate = 0.92 + random() * 0.16;
                stepEnd[f] = when + 0.2; counters.steps++;
              }
            }
            tStep[slot] += interval * (0.94 + random() * 0.12);
          }
        } else if (slot >= 0) tStep[slot] = 0;
      }
      // conversations: pair each talking person with the nearest other talker within 2.6 m
      for (let k = 0; k < np; k++) {
        const p = people[pOrder[k]];
        if (!p.talking || pPair[k] !== -1 || pDist[k] > RANGE.talk.range || pSlot[k] < 0) continue;
        let best = -1, bestD = 2.6;
        for (let q = 0; q < np; q++) {
          if (q === k || pPair[q] !== -1 || !people[pOrder[q]].talking) continue;
          const o = people[pOrder[q]], d = Math.hypot(o.x - p.x, o.z - p.z);
          if (d < bestD) { bestD = d; best = q; }
        }
        pPair[k] = best >= 0 ? best : -2;
        if (best >= 0) pPair[best] = k;
        // the pair's state lives with its lower seed
        const lead = best >= 0 && people[pOrder[best]].seed < p.seed ? best : k;
        const s = pSlot[lead];
        if (s < 0) continue;
        if (tTalk[s] === 0) tTalk[s] = now + 0.3 + random() * 1.5;
        if (now < tTalk[s]) continue;
        const speakerK = best < 0 ? k : (tTurn[s] ? (lead === k ? best : k) : lead);
        const sp = people[pOrder[speakerK]];
        const e = emit('talk', listener, sp.x, sp.y, sp.z, now, now + 0.02, 1.9, PRIORITY.talk, sp.seed);
        if (!e) { tTalk[s] = now + 0.5; continue; }
        e.voice = Math.floor(hash01(sp.seed) * 6);
        const pitch = 0.95 + hash01(sp.seed * 3.1) * 0.1;
        e.variant = Math.floor(random() * 3); e.rate = pitch * (0.985 + random() * 0.03);
        e.second = random() < 0.6 ? (e.variant + 1 + Math.floor(random() * 2)) % 3 : -1;
        e.secondRate = pitch * (0.985 + random() * 0.03); e.gap = 0.07 + random() * 0.13;
        // the voice end is filled in by the player (buffer lengths); plan the next turn from a nominal length
        const length = e.second >= 0 ? 1.55 + e.gap : 0.75;
        eventEnd[e.slot] = e.when + length;
        tTalk[s] = e.when + length + (best >= 0 ? 0.35 + random() * 0.75 : 1.8 + random() * 2.5);
        tTurn[s] ^= 1;
        counters.talks++;
      }
    },

    /** Where a following event's person is now (talk and outbursts follow their speaker). */
    follow(people, nPeople, seed, out) {
      for (let i = 0; i < nPeople; i++) if (people[i].seed === seed) { out.x = people[i].x; out.y = people[i].y; out.z = people[i].z; return true; }
      return false;
    },
  };
}
