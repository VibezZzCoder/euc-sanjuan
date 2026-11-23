/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Officer Dorkins: paddle timing and the relative swept contact of its drawn face. From the San Francisco edition
// (js/nemesis-swing.js, © 2026 VibezZzCoder, MIT; first written for the New York edition); PADDLE/CHASE tuning is EUC Thrills'.
import { PADDLE, CHASE } from './euc/data/tuning.js';

export const SWING = Object.freeze({
  windupSeconds: 0.7, activeSeconds: 0.16, recoverSeconds: 0.4, cooldownSeconds: 1.8,
  triggerRange: 7, maxQuarrySpeed: 32, lateral: PADDLE.pivotOffset + PADDLE.reach,
  swoopHeight: 0.1, headDrop: 1.6, maxHeadDrop: 2.2, leanRoll: 0.35,
  // San Juan: two swings, chosen at the wind-up and shown by it (the paddle drops to the ground, or stays level).
  //   low   he hovers lowHover above the rider's floor and the paddle face sweeps lowAt above it, at the wheel: it
  //         lands only if the face is at or above the bottom of the wheel (lowBand), so a hop on the wind-up visibly
  //         carries the wheel over it;
  //   high  (the rider is in the air, landed within highAfterLanding seconds, or hopped twice in hopRhythm seconds)
  //         the face sweeps at chest height, highAt, and a hop does not clear it.
  // He aims where the rider will be at contact (speed and turn rate), until lockSeconds before the hit; a hard turn, a
  // brake or a burst inside that window takes the rider out of the line.
  // lowTop: a low sweep lands only between the bottom of the wheel and this height above it (the wheel and shins);
  // lowLift: if he is held more than this above the rider's floor late in a low wind-up (lifted over something), the
  // low swing cannot be drawn low: it is called off and the next wind-up is a high one
  lowAt: 0.2, lowHover: 0.12, lowBand: -0.02, lowTop: 0.75, lowLift: 0.6, highAt: 1.0, highHover: 0.35, highAfterLanding: 1, hopRhythm: 3,
  // aimAhead: he places himself this far ahead of the rider's predicted place, so the rider meets the first part of the
  // paddle's arc (a rider who brakes in the lock window falls out of it).
  lockSeconds: 0.45, contactLag: 0.04, aimAhead: 0.5, aimJitter: 0.9,
  // when the rider leaves the ground during the wind-up, he sometimes (waitChance) holds the paddle where it is (the
  // wind-up pauses, never rewinds) up to waitMax seconds for the landing, and aims again
  waitChance: 0.25, waitMax: 0.6,
  hitRadius: CHASE.riderHitRadius + PADDLE.headRadius, riderHeight: 1.75,
});

const smoothstep = t => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

export function createSwing(tuning = SWING) {
  const t = tuning, span = { windup: t.windupSeconds, active: t.activeSeconds, recover: t.recoverSeconds };
  const state = { phase: 'idle', elapsed: 0, cooldown: 0 };
  const contact = { from: 1, to: 0 };
  const progress = () => span[state.phase] > 0 ? Math.min(1, state.elapsed / span[state.phase]) : 1;
  const rest = PADDLE.startAngle + PADDLE.sweepRadians / 2;
  const start = PADDLE.startAngle, end = PADDLE.startAngle + PADDLE.sweepRadians;
  return {
    state, contact,
    get phase() { return state.phase; },
    get ready() { return state.phase === 'idle' && state.cooldown <= 0; },
    start() { state.phase = 'windup'; state.elapsed = 0; contact.from = 1; contact.to = 0; },
    /** Whether the wind-up is paused this frame (he holds the paddle where it is for an airborne rider to land). */
    paused: false,
    /** Seconds until the first moment of contact (the end of the wind-up plus contactLag), or 0 once striking. */
    get untilContact() { return state.phase === 'windup' ? span.windup - state.elapsed + t.contactLag : 0; },
    cancel(cooldown = 1) {
      state.phase = 'idle'; state.elapsed = 0; state.cooldown = cooldown; contact.from = 1; contact.to = 0;
    },
    update(dt) {
      contact.from = 1; contact.to = 0;
      if (!(dt > 0)) return null;
      const until = state.phase === 'windup' ? span.windup - state.elapsed
        : state.phase === 'active' ? -state.elapsed : Infinity;
      if (until <= dt && until + span.active >= 0) {
        contact.from = Math.max(0, until / dt); contact.to = Math.min(1, (until + span.active) / dt);
      }
      state.cooldown = Math.max(0, state.cooldown - dt);
      if (state.phase === 'idle') return null;
      if (this.paused && state.phase === 'windup') { contact.from = 1; contact.to = 0; return null; }
      state.elapsed += dt;
      if (state.elapsed < span[state.phase]) return null;
      state.elapsed -= span[state.phase];
      if (state.phase === 'windup') { state.phase = 'active'; return 'strike'; }
      if (state.phase === 'active') { state.phase = 'recover'; return null; }
      state.phase = 'idle'; state.elapsed = 0; state.cooldown = t.cooldownSeconds;
      return 'done';
    },
    get angle() {
      const p = progress();
      switch (state.phase) {
        case 'windup': return rest + (start - rest) * smoothstep(p);
        case 'active': return start + (end - start) * p;
        case 'recover': return end + (rest - end) * smoothstep(p);
        default: return rest;
      }
    },
    get commitment() {
      const p = progress();
      if (state.phase === 'windup') return smoothstep(p);
      if (state.phase === 'active') return 1;
      if (state.phase === 'recover') return 1 - smoothstep(p);
      return 0;
    },
    /** `aimY` (optional): the height the head sweeps at when fully committed, instead of the fixed drop. */
    headTarget(x, y, z, heading, out, aimY = null) {
      const cos = Math.cos(heading), sin = Math.sin(heading), yaw = heading + this.angle;
      out.x = x - cos * PADDLE.pivotOffset + Math.sin(yaw) * PADDLE.reach;
      const drop = Number.isFinite(aimY) ? Math.max(0, Math.min(t.maxHeadDrop, y + PADDLE.pivotHeight - aimY)) : t.headDrop;
      out.y = y + PADDLE.pivotHeight - drop * this.commitment;
      out.z = z + sin * PADDLE.pivotOffset + Math.cos(yaw) * PADDLE.reach;
      return out;
    },
  };
}

const FULL_FRAME = Object.freeze({ from: 0, to: 1 });

// Return the closest admitted contact time within the striking interval, or null.
// Exposing the time lets the contact test line of sight at the same interpolated 3D poses.
export function sweptContactFraction(ax, ay, az, bx, by, bz, rider, tuning = SWING, previous = rider, interval = FULL_FRAME) {
  let lo = Math.max(0, interval.from), hi = Math.min(1, interval.to);
  if (lo > hi) return null;
  ax -= previous.x; ay -= previous.bottom; az -= previous.z;
  bx -= rider.x; by -= rider.bottom; bz -= rider.z;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const bottom = tuning.band ?? -PADDLE.headRadius, top = tuning.riderHeight;
  if (Math.abs(dy) < 1e-12) {
    if (ay < bottom || ay > top) return null;
  } else {
    const a = (bottom - ay) / dy, b = (top - ay) / dy;
    lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
    if (lo > hi) return null;
  }
  const lengthSq = dx * dx + dz * dz;
  const k = lengthSq > 1e-12 ? Math.max(lo, Math.min(hi, -(ax * dx + az * dz) / lengthSq)) : lo;
  const x = ax + dx * k, z = az + dz * k;
  return x * x + z * z <= tuning.hitRadius * tuning.hitRadius ? k : null;
}

// The whole admitted fraction window {from, to} (height band and hit radius), or null. Lets the contact
// try other in-range poses when the closest one is occluded; each sample is re-admitted exactly.
export function sweptContactWindow(ax, ay, az, bx, by, bz, rider, tuning = SWING, previous = rider, interval = FULL_FRAME) {
  let lo = Math.max(0, interval.from), hi = Math.min(1, interval.to);
  if (lo > hi) return null;
  ax -= previous.x; ay -= previous.bottom; az -= previous.z;
  bx -= rider.x; by -= rider.bottom; bz -= rider.z;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const bottom = tuning.band ?? -PADDLE.headRadius, top = tuning.riderHeight;
  if (Math.abs(dy) < 1e-12) {
    if (ay < bottom || ay > top) return null;
  } else {
    const a = (bottom - ay) / dy, b = (top - ay) / dy;
    lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
    if (lo > hi) return null;
  }
  const A = dx * dx + dz * dz, B = 2 * (ax * dx + az * dz), C = ax * ax + az * az - tuning.hitRadius * tuning.hitRadius;
  if (A <= 1e-12) return C <= 0 ? { from: lo, to: hi } : null;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const root = Math.sqrt(disc), from = Math.max(lo, (-B - root) / (2 * A)), to = Math.min(hi, (-B + root) / (2 * A));
  return from <= to ? { from, to } : null;
}

// Sweep the drawn face and rider over the same active fraction of the frame.
export function sweptHit(ax, ay, az, bx, by, bz, rider, tuning = SWING, previous = rider, interval = FULL_FRAME) {
  return sweptContactFraction(ax, ay, az, bx, by, bz, rider, tuning, previous, interval) !== null;
}
