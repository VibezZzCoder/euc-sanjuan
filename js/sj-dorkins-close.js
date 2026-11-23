/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Officer Dorkins at close range: he winds up only when the swing can actually be delivered from where he is (his
// swoop to the strike spot beside the rider is a clear, allowed flight), and when furniture, a fountain rim or a parked
// car keeps him from that spot he comes round another side, over the top of it or down from above. He never gives up
// here: when no side works for the moment he hovers a few metres off and looks again. Over a bench or a car's bonnet
// beside the rider he strikes from a little higher (the paddle still meets the rider's body).
// San Juan's own. Checks are spread over frames under a small time budget; nothing here moves the rider.
import { SWING } from './sj-dorkins-swing.js';

export const CLOSE = Object.freeze({ range: 12, recheck: 0.2, blockedBeforeMove: 0.5, repositionSeconds: 3, holdSeconds: 1.2,
  radii: [3.2, 4.6], angles: 12, lifts: [2.4, 4.4], above: 3, budgetMs: 0.8, hover: 1.1, holdOff: 4.5,
  heights: [SWING.swoopHeight, 0.9, 1.5], moving: 2.5, bodyClear: 0.9 });

/** The point beside the rider the paddle swoop aims at (as js/sj-dorkins-brain.js swoop does). */
export function strikeSpot(o, out = { x: 0, y: 0, z: 0 }, height = SWING.swoopHeight, turn = 0) {
  const h = o.heading + turn;
  out.x = o.x + Math.cos(h) * SWING.lateral; out.z = o.z - Math.sin(h) * SWING.lateral; out.y = o.y + height;
  return out;
}
/** The strike set-up turned this far round the rider (radians): his place and facing both turn; 0 is beside the
 * rider's right, facing the rider's way. Tried in this order: a rider against a wall, in a doorway, a corner or under a
 * balcony is attacked from the open side. A moving rider is attacked only from the first. */
export const STRIKE_TURNS = Object.freeze([0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]);

export function createCloseRange(queries, tuning = CLOSE) {
  const t = { ...CLOSE, ...tuning };
  const spot = { x: 0, y: 0, z: 0 }, a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 }, up = { x: 0, y: 0, z: 0 }, over = { x: 0, y: 0, z: 0 };
  let strikeHeight = SWING.swoopHeight, strikeTurn = 0, canStrike = false, checkIn = 0, blocked = 0, holding = false, target = null, targetTime = 0, scan = -1, best = null, bestD = Infinity;
  const stats = { checks: 0, repositions: 0, overs: 0, holds: 0, maxMs: 0 };
  // a straight checked flight in pieces of ≤ 8 m
  function clearPath(from, to, pieces = 3) {
    const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z), n = Math.max(1, Math.ceil(d / 8));
    if (n > pieces) return false;
    a.x = from.x; a.y = from.y; a.z = from.z;
    for (let i = 1; i <= n; i++) {
      const s = i / n; b.x = from.x + (to.x - from.x) * s; b.y = from.y + (to.y - from.y) * s; b.z = from.z + (to.z - from.z) * s;
      if (!queries.clearFlight(a, b)) return false;
      a.x = b.x; a.y = b.y; a.z = b.z;
    }
    return true;
  }
  /** Straight, or up, across at a height and down (over a car, a bench, a low wall): the lift used (0 straight) or −1. */
  function reach(from, to) {
    if (clearPath(from, to)) return 0;
    for (const lift of t.lifts) {
      const top = Math.max(from.y, to.y) + lift;
      up.x = from.x; up.y = top; up.z = from.z; over.x = to.x; over.y = top; over.z = to.z;
      if (clearPath(from, up, 1) && clearPath(up, over) && clearPath(over, to, 1)) { stats.overs++; return lift; }
    }
    return -1;
  }
  // the first turn round the rider (and the lowest height) whose spot is open, free of people and vehicles, and reached
  // by a straight checked swoop from `from`; sets `found` {height, turn}
  const found = { height: 0, turn: 0 };
  function setupFrom(from, o) {
    const turns = Math.abs(o.speed ?? 0) > t.moving ? 1 : STRIKE_TURNS.length;
    for (let k = 0; k < turns; k++) for (const h of k ? t.heights.slice(0, 1) : t.heights) { // turned set-ups: low only
      strikeSpot(o, spot, h, STRIKE_TURNS[k]);
      if (queries.allowed(spot.x, spot.z, spot.y) && !(queries.bodyNear && queries.bodyNear(spot.x, spot.z, spot.y, t.bodyClear))
        && clearPath(from, spot)) { found.height = h; found.turn = STRIKE_TURNS[k]; return true; }
    }
    return false;
  }
  function deliverable(state, o) {
    stats.checks++;
    if (!setupFrom(state, o)) return false;
    strikeHeight = found.height; strikeTurn = found.turn; return true;
  }
  function reset() { canStrike = false; checkIn = 0; blocked = 0; target = null; scan = -1; best = null; bestD = Infinity; holding = false; }
  // one side candidate p: from p the swing works, and he can get to p (straight or over the top)
  function consider(state, p) {
    const d = Math.hypot(p.x - state.x, p.z - state.z);
    if (d >= bestD || !queries.allowed(p.x, p.z, p.y) || !setupFrom(p, o0)) return;
    const lift = reach(state, p);
    if (lift < 0) return;
    best = { x: p.x, y: p.y, z: p.z, lift }; bestD = d + lift; // a straight approach wins over a climb of the same length
  }
  let o0 = null;
  return {
    stats, reset, reach,
    get canStrike() { return canStrike; },
    /** The swoop height (above the rider's floor) the last deliverable check found. */
    get strikeHeight() { return strikeHeight; },
    /** The turn round the rider of that set-up (STRIKE_TURNS). */
    get strikeTurn() { return strikeTurn; },
    get target() { return target; },
    get holding() { return holding; },
    struck() { blocked = 0; },
    resetTotal() { blocked = 0; },
    /**
     * Once per chase frame with his flight state, the visible rider observation {x, y, z, heading} (or null when he
     * does not see the rider) and their distance. Returns 'chase' | 'reposition'.
     */
    update(dt, state, o, distance) {
      const t0 = performance.now();
      try {
        if (!(distance < t.range)) { canStrike = false; blocked = 0; target = null; scan = -1; holding = false; return 'chase'; }
        if (!o) { // a moment out of sight (round the van): keep going where he was going
          canStrike = false;
          if (target) { targetTime += dt; if (Math.hypot(state.x - target.x, state.z - target.z) >= 0.8 && targetTime <= t.repositionSeconds) return 'reposition'; target = null; holding = false; }
          return 'chase';
        }
        checkIn -= dt;
        if (checkIn <= 0) { checkIn = t.recheck; canStrike = deliverable(state, o); }
        if (canStrike) { blocked = 0; target = null; scan = -1; holding = false; return 'chase'; }
        blocked += dt;
        if (target) {
          targetTime += dt;
          // arrived: stay there (the swing is checked again at once) for a moment before looking elsewhere
          if (!target.there && Math.hypot(state.x - target.x, state.z - target.z) < 0.8) { target.there = true; target.since = targetTime; checkIn = 0; }
          const done = holding ? targetTime > t.holdSeconds
            : target.there ? targetTime - target.since > t.holdSeconds : targetTime > t.repositionSeconds;
          if (done) { target = null; holding = false; checkIn = 0; blocked = t.blockedBeforeMove; }
          else return 'reposition';
        }
        if (blocked < t.blockedBeforeMove) return 'chase';
        // look for a place from which the swing works, a few candidates a frame: above the strike spot first, then
        // round the rider at two radii
        if (scan < 0) { scan = 0; best = null; bestD = Infinity; o0 = { x: o.x, y: o.y, z: o.z, heading: o.heading, speed: o.speed }; }
        const total = 1 + t.radii.length * t.angles, deadline = t0 + t.budgetMs;
        while (scan < total && performance.now() < deadline) {
          const k = scan++;
          if (k === 0) { consider(state, { x: o0.x, y: o0.y + t.above, z: o0.z }); continue; } // straight above the rider
          const r = t.radii[(k - 1) % t.radii.length], ang = o0.heading + Math.floor((k - 1) / t.radii.length) * 2 * Math.PI / t.angles;
          const x = o0.x + Math.sin(ang) * r, z = o0.z + Math.cos(ang) * r;
          const floor = queries.supportAt(x, z, o0.y + 2.5);
          if (!floor || floor.offCourse || floor.water || Math.abs(floor.height - o0.y) > 1.5) continue;
          consider(state, { x, y: floor.height + t.hover, z });
        }
        if (scan < total) return 'chase';
        scan = -1;
        if (best) { target = best; targetTime = 0; stats.repositions++; return 'reposition'; }
        // nothing works this moment: hover a few metres off on his own side, high enough to be seen, and look again soon
        const away = Math.atan2(state.x - o.x, state.z - o.z);
        for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
          const x = o.x + Math.sin(away + turn) * t.holdOff, z = o.z + Math.cos(away + turn) * t.holdOff;
          const floor = queries.supportAt(x, z, o.y + 2.5);
          if (!floor || floor.offCourse || floor.water || Math.abs(floor.height - o.y) > 2) continue;
          const p = { x, y: floor.height + t.hover + 1.5, z, lift: 0 };
          if (queries.allowed(x, z, p.y) && reach(state, p) >= 0) { target = p; targetTime = 0; holding = true; stats.holds++; return 'reposition'; }
        }
        blocked = 0;
        return 'chase';
      } finally { const ms = performance.now() - t0; if (ms > stats.maxMs) stats.maxMs = ms; }
    },
  };
}
