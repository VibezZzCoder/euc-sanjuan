/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Officer Dorkins at close range: he winds up only when the swing can actually be delivered from where he is (his
// swoop to the strike spot beside the rider is a clear, allowed flight), and when furniture, a fountain rim or a parked
// car keeps him from that spot he comes round another side; if no side works he holds off a few metres away, and
// after a while near the rider without a swing he could use he gives up and leaves.
// San Juan's own. Checks are spread over frames under a small time budget; nothing here moves the rider.
import { SWING } from './sj-dorkins-swing.js';

export const CLOSE = Object.freeze({ range: 12, recheck: 0.2, blockedBeforeMove: 0.8, repositionSeconds: 3.5, giveUpSeconds: 9,
  radii: [3.2, 4.6], angles: 12, budgetMs: 0.8, hover: 1.1, holdOff: 6.5 });

/** The point beside the rider the paddle swoop aims at (as js/sj-dorkins-brain.js swoop does). */
export function strikeSpot(o, out = { x: 0, y: 0, z: 0 }) {
  out.x = o.x + Math.cos(o.heading) * SWING.lateral; out.z = o.z - Math.sin(o.heading) * SWING.lateral; out.y = o.y + SWING.swoopHeight;
  return out;
}

export function createCloseRange(queries, tuning = CLOSE) {
  const t = { ...CLOSE, ...tuning };
  const spot = { x: 0, y: 0, z: 0 }, a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 };
  let canStrike = false, checkIn = 0, blocked = 0, blockedTotal = 0, holding = false, target = null, targetTime = 0, scan = -1, best = null, bestD = Infinity;
  const stats = { checks: 0, repositions: 0, giveUps: 0, maxMs: 0 };
  // a straight checked flight in pieces of ≤ 8 m
  function clearPath(from, to) {
    const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z), n = Math.max(1, Math.ceil(d / 8));
    if (n > 3) return false;
    a.x = from.x; a.y = from.y; a.z = from.z;
    for (let i = 1; i <= n; i++) {
      const s = i / n; b.x = from.x + (to.x - from.x) * s; b.y = from.y + (to.y - from.y) * s; b.z = from.z + (to.z - from.z) * s;
      if (!queries.clearFlight(a, b)) return false;
      a.x = b.x; a.y = b.y; a.z = b.z;
    }
    return true;
  }
  function deliverable(state, o) {
    strikeSpot(o, spot);
    stats.checks++;
    return queries.allowed(spot.x, spot.z, spot.y) && clearPath(state, spot);
  }
  function reset() { canStrike = false; checkIn = 0; blocked = 0; target = null; scan = -1; best = null; bestD = Infinity; holding = false; }
  return {
    stats, reset,
    get canStrike() { return canStrike; },
    get target() { return target; },
    /** After a swing (wind-up) or an admitted hit the count of close time without a usable swing starts again. */
    struck() { blockedTotal = 0; },
    resetTotal() { blockedTotal = 0; },
    /**
     * Once per chase frame with his flight state, the visible rider observation {x, y, z, heading} (or null when he
     * does not see the rider) and their distance. Returns 'chase' | 'reposition' | 'giveup'.
     */
    update(dt, state, o, distance) {
      const t0 = performance.now();
      try {
        if (!(distance < t.range)) { canStrike = false; blocked = 0; target = null; scan = -1; holding = false; blockedTotal = Math.max(0, blockedTotal - dt); return 'chase'; }
        if (!o) { // a moment out of sight (round the bench): keep going where he was going, keep counting
          canStrike = false; blockedTotal += dt;
          if (blockedTotal >= t.giveUpSeconds) { stats.giveUps++; reset(); blockedTotal = 0; return 'giveup'; }
          if (target) { targetTime += dt; if (holding || (Math.hypot(state.x - target.x, state.z - target.z) >= 0.8 && targetTime <= t.repositionSeconds)) return 'reposition'; target = null; }
          return 'chase';
        }
        checkIn -= dt;
        if (checkIn <= 0) { checkIn = t.recheck; canStrike = deliverable(state, o); }
        blockedTotal += dt; // near the rider without a swing he has used
        if (canStrike && !holding) { blocked = 0; target = null; scan = -1; if (blockedTotal >= t.giveUpSeconds) { stats.giveUps++; reset(); blockedTotal = 0; return 'giveup'; } return 'chase'; }
        blocked += dt;
        if (blockedTotal >= t.giveUpSeconds) { stats.giveUps++; reset(); blockedTotal = 0; return 'giveup'; }
        if (target) {
          targetTime += dt;
          if (Math.hypot(state.x - target.x, state.z - target.z) < 0.8 || targetTime > t.repositionSeconds) {
            if (holding) return 'reposition'; // hold off there until he gives up
            target = null; checkIn = 0; blocked = 0;
          } else return 'reposition';
        }
        if (blocked < t.blockedBeforeMove) return 'chase';
        // look for a side of the rider from which the swing works, a few candidates a frame
        if (scan < 0) { scan = 0; best = null; bestD = Infinity; }
        const total = t.radii.length * t.angles, deadline = t0 + t.budgetMs;
        while (scan < total && performance.now() < deadline) {
          const r = t.radii[scan % t.radii.length], k = Math.floor(scan / t.radii.length), ang = o.heading + k * 2 * Math.PI / t.angles;
          scan++;
          const x = o.x + Math.sin(ang) * r, z = o.z + Math.cos(ang) * r;
          const floor = queries.supportAt(x, z, o.y + 2.5);
          if (!floor || floor.offCourse || floor.water || Math.abs(floor.height - o.y) > 1.5) continue;
          const p = { x, y: floor.height + t.hover, z };
          const d = Math.hypot(p.x - state.x, p.z - state.z);
          if (d >= bestD || !queries.allowed(x, z, p.y) || !clearPath(p, strikeSpot(o, spot)) || !clearPath(state, p)) continue;
          best = p; bestD = d;
        }
        if (scan < total) return 'chase';
        scan = -1;
        if (best) { target = best; targetTime = 0; stats.repositions++; return 'reposition'; }
        // no side works: hold off a few metres away on his own side of the rider (the siren never sits at arm's length)
        const away = Math.atan2(state.x - o.x, state.z - o.z);
        for (const turn of [0, 0.5, -0.5, 1, -1]) {
          const x = o.x + Math.sin(away + turn) * t.holdOff, z = o.z + Math.cos(away + turn) * t.holdOff;
          const floor = queries.supportAt(x, z, o.y + 2.5);
          if (!floor || floor.offCourse || floor.water || Math.abs(floor.height - o.y) > 2) continue;
          const p = { x, y: floor.height + t.hover + 1, z };
          if (queries.allowed(x, z, p.y) && clearPath(state, p)) { target = p; targetTime = 0; holding = true; stats.holds = (stats.holds ?? 0) + 1; return 'reposition'; }
        }
        blocked = 0;
        return 'chase';
      } finally { const ms = performance.now() - t0; if (ms > stats.maxMs) stats.maxMs = ms; }
    },
  };
}
