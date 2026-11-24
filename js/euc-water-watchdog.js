/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Immersion watchdog (shore recovery) — © 2026 VibezZzCoder, MIT. Host-side, no
// generated physics edits: it only decides *when* to place the rider and *where*, through the host's own checked placement.
//
// Why: the stock controller's water branch retries `respawn(true)` from the wet origin and a ring of recent safe points
// on the bank's edge, facing the way the rider was going. After a ride straight down a steep bank all of those can fail
// (the rider waits in the sea), or succeed right at the water's edge facing the sea, so a held throttle rides straight
// back in, again and again.
//
// When: the rider is "wet" while the sampler flags water at or under the water line, or while grounded ≥ 5 cm under the
// water line with the sea within 6 m (submerged beach/shelf; crashed or not). Wet time accumulates across native
// placements and brief dry frames and clears only after `grace` s of dry riding or a long jump (map, restart). A rescue
// fires after `timeout` s wet in the sea, `wadeTimeout` s wading, on the third native water bounce within `bounceWindow` s
// (placed back on the edge and ridden straight in again), on recover pressed while wet, or after `crashTimeout` s down on
// land with no native get-up. After a rescue it re-arms at once.
//
// Where (dry recovery): never at the water's edge. Candidates are recent dry public
// anchors at least `inland` m from any sea (searched in 16 directions), placed stationary and heading straight away from
// the nearest sea. A second watchdog rescue within `escalateWithin` s (the incident did not end) escalates: anchors at least
// `deep` m from the sea, then the nearest named arrival at least `inland` m from the sea, then the host spawn.
//
// Where (crash on dry land): the rider's own level first. A rider down on dry ground is not in the sea, so the sea-distance
// rules above do not apply: the nearest recent anchor within `levelRadius` m whose floor is within `level` m of the fallen
// rider's, then a ring round the fallen rider at that floor; only when none of those stands does the sea list follow.
// Dry rescues never escalate (escalation is for a rider ridden back into the sea), so a narrow promenade under a wall
// does not send a rider who keeps pressing get-up up onto the wall walk or to a shore point on another level.
import { findPlacementTarget, placementDepartureClear } from './euc-recovery.js';

export const WATCHDOG = { timeout: 2, wade: 0.05, wadeTimeout: 3, grace: 1.5, bounces: 3, bounceWindow: 8, crashTimeout: 6, retry: 0.5,
  anchorEvery: 0.25, anchorSpacing: 1.5, anchors: 24, keep: 16, jump: 25, inland: 6, deep: 12, escalateWithin: 10,
  level: 1.5, levelRadius: 30, ring: [3, 5] };

export function createWaterWatchdog({ sampler, spawn, place, arrivals = null, recovery = null, maxStepUp = 0.216, timeout = WATCHDOG.timeout }) {
  const anchors = [], inlandAnchors = [], deepAnchors = [];
  let down = 0, wet = 0, dryFor = 0, clock = 0, lastWet = -1e9, lastRescue = -1e9, sinceAnchor = 0, retryIn = 0;
  let serial = null, lastX = NaN, lastZ = NaN, manualWas = false, lastAt = null;
  const bounces = [], probe = { normal: {} };
  const W = () => sampler.waterLevel ?? 0;
  // Sea in the sampler's sense (water flag), probed at y = water line.
  const sea = (x, z) => sampler.isWater(x, z, W());
  // Distance to the nearest sea (16 directions, 1 m steps up to `R`) and the heading pointing away from it.
  function seaAround(x, z, R) {
    let near = Infinity, sx = 0, sz = 0;
    for (let a = 0; a < 16; a++) { const s = Math.sin(a * Math.PI / 8), c = Math.cos(a * Math.PI / 8);
      for (let d = 1; d <= R; d++) if (sea(x + s * d, z + c * d)) { if (d < near) near = d; sx += s / d; sz += c / d; break; } }
    return { near, away: near < Infinity ? Math.atan2(-sx, -sz) : null };
  }
  const immersedAt = (x, y, z) => Number.isFinite(y) && y <= W() + 0.02 && sampler.isWater(x, z, y);
  const nearSea = (x, z, y) => { for (let a = 0; a < 8; a++) { const s = Math.sin(a * Math.PI / 4), c = Math.cos(a * Math.PI / 4);
    for (const d of [2, 4, 6]) if (sampler.isWater(x + s * d, z + c * d, y)) return true; } return false; };
  const wadingAt = (c, x, y, z) => Number.isFinite(y) && !c.airborne && y <= W() - WATCHDOG.wade && nearSea(x, z, y);

  const list = () => (typeof arrivals === 'function' ? arrivals() : arrivals) ?? [];
  function candidates(escalate, from) {
    const out = [], away = (p, fallback) => seaAround(p.x, p.z, WATCHDOG.deep).away ?? fallback;
    if (!escalate) for (let i = inlandAnchors.length - 1; i >= 0; i--) { const a = inlandAnchors[i]; if (Math.hypot(a.x - from.x, a.z - from.z) > 120) continue; out.push({ ...a, headingY: away(a, a.headingY + Math.PI), min: WATCHDOG.inland }); }
    // the nearest shore recovery points (a checked public spot every ~65 m along the shore routes) before anything
    // farther, so an escalated rescue lands close; a spot within 3 m of the last rescue is skipped when escalating.
    if (recovery?.length) { const pts = [];
      for (let i = 0; i + 2 < recovery.length; i += 3) { const x = recovery[i], z = recovery[i + 1], d = Math.hypot(x - from.x, z - from.z);
        if (d < 150) pts.push({ x, z, headingY: recovery[i + 2], d, same: !!(escalate && lastAt && Math.hypot(x - lastAt.x, z - lastAt.z) < 3) }); }
      // Escalating: another point within 90 m first; the same (inland, checked) point again rather than a long jump.
      pts.sort((p, q) => (p.same && q.d < 90 ? 1 : 0) - (q.same && p.d < 90 ? 1 : 0) || p.d - q.d);
      // Reusing the same point within the escalation window means the input drove the rider straight back from it (held
      // reverse, facing away from the sea): turn that placement round, so the same input now leads inland.
      // It also stands 6 m further inland along its heading, so the second placement is a new spot.
      for (const q of pts) out.push(q.same ? { x: q.x + Math.sin(q.headingY) * 6, z: q.z + Math.cos(q.headingY) * 6, headingY: q.headingY + Math.PI, min: WATCHDOG.inland }
        : { x: q.x, z: q.z, headingY: q.headingY, min: WATCHDOG.inland }); }
    for (let i = deepAnchors.length - 1; i >= 0; i--) { const a = deepAnchors[i]; out.push({ ...a, headingY: away(a, a.headingY + Math.PI), min: WATCHDOG.inland }); }
    const named = list().filter(Boolean).map(a => ({ x: a.x, z: a.z, y: a.y, headingY: a.headingY ?? 0, d: Math.hypot(a.x - from.x, a.z - from.z) }))
      .sort((p, q) => p.d - q.d);
    for (const a of named) out.push({ ...a, min: WATCHDOG.inland });
    if (spawn) out.push({ x: spawn.x, z: spawn.z, headingY: spawn.headingY ?? 0, y: spawn.y, min: 0 });
    // Last resort (no spawn/arrivals given, nothing inland recorded yet): any recent dry anchor, heading away from the sea.
    for (let i = anchors.length - 1; i >= 0; i--) { const a = anchors[i]; out.push({ ...a, headingY: away(a, a.headingY + Math.PI), min: 0 }); }
    return out;
  }
  // Own-level candidates for a crash on dry land: nearest recent anchors on the fallen rider's floor, then a ring round it.
  function levelCandidates(from) {
    const out = [], y = from.y;
    for (const a of anchors) { const d = Math.hypot(a.x - from.x, a.z - from.z);
      if (d <= WATCHDOG.levelRadius && Math.abs(a.y - y) <= WATCHDOG.level) out.push({ x: a.x, z: a.z, y: a.y, headingY: a.headingY, d }); }
    out.sort((p, q) => p.d - q.d);
    const h = Number.isFinite(from.headingY) ? from.headingY : 0;
    for (const r of WATCHDOG.ring) for (let i = 0; i < 8; i++) { const a = h + i * Math.PI / 4;
      out.push({ x: from.x + Math.sin(a) * r, z: from.z + Math.cos(a) * r, y, headingY: h }); }
    return out;
  }
  function rescue(from) {
    // The fallen rider's floor (a body still settling may be a little above it).
    if (from.dry) { const g = sampler.sampleGround(from.x, from.z, probe, from.y + 0.05).height;
      if (Number.isFinite(g) && g <= from.y + 0.05 && from.y - g < 3) from.y = g; }
    if (from.dry) for (const c of levelCandidates(from)) {
      const target = findPlacementTarget(sampler, { x: c.x, z: c.z, headingY: c.headingY, referenceY: c.y, maxStepUp });
      if (!target || Math.abs(target.y - from.y) > WATCHDOG.level || !placementDepartureClear(sampler, target, { departure: 1.2, maxStepUp })) continue;
      if (place(target.x, target.z, target.headingY, target.y)) return { ...target, escalated: false };
    }
    const escalate = !from.dry && clock - lastRescue < WATCHDOG.escalateWithin;
    for (const c of candidates(escalate, from)) {
      const ref = Number.isFinite(c.y) ? c.y : sampler.sampleGround(c.x, c.z, probe, Infinity).height;
      const target = findPlacementTarget(sampler, { x: c.x, z: c.z, headingY: c.headingY, referenceY: ref, maxStepUp });
      if (!target || !placementDepartureClear(sampler, target, { departure: 1.2, maxStepUp })) continue;
      if (c.min && seaAround(target.x, target.z, c.min).near <= c.min) continue;
      if (place(target.x, target.z, target.headingY, target.y)) { lastRescue = clock; lastAt = { x: target.x, z: target.z }; return { ...target, escalated: escalate }; }
    }
    return null;
  }
  const done = placed => { serial = null; wet = 0; dryFor = 0; down = 0; bounces.length = 0; lastX = placed.x; lastZ = placed.z; return placed; };

  return {
    anchors,
    inlandAnchors,
    /** Call once per host update after the rider stepped. `manual`: the recover input is held/pressed. */
    observe(controller, dt, manual = false) {
      const x = controller.x, y = controller.y, z = controller.z, step = Math.max(0, dt);
      clock += step;
      const jumped = Math.hypot(x - lastX, z - lastZ) > WATCHDOG.jump;
      let bounced = false;
      if (serial === null) serial = controller.placementSerial;
      if (serial !== controller.placementSerial || jumped) {
        if (jumped) { anchors.length = 0; inlandAnchors.length = 0; deepAnchors.length = 0; wet = 0; bounces.length = 0; lastRescue = -1e9; }
        else if (clock - lastWet < 0.6) { bounces.push(clock); bounced = true; }
        serial = controller.placementSerial; retryIn = 0;
        if (!controller.crashed) down = 0;
      }
      lastX = x; lastZ = z;
      while (bounces.length && clock - bounces[0] > WATCHDOG.bounceWindow) bounces.shift();
      if (bounced && bounces.length >= WATCHDOG.bounces) { const placed = rescue({ x, z }); if (placed) return done(placed); }
      const pressed = manual && !manualWas; manualWas = manual;
      const immersed = immersedAt(x, y, z), wading = !immersed && wadingAt(controller, x, y, z);
      if (immersed || wading) {
        wet += step; lastWet = clock; retryIn -= step; dryFor = 0;
        if ((wet >= (immersed ? timeout : WATCHDOG.wadeTimeout) || pressed) && retryIn <= 0) {
          const placed = rescue({ x, z });
          if (placed) return done(placed);
          retryIn = WATCHDOG.retry;
        }
        return null;
      }
      dryFor += step;
      if (dryFor >= WATCHDOG.grace) wet = 0;
      // A crash on land that the native get-up cannot place (no admissible target round the fallen body, e.g. against a
      // railing or rip-rap): after crashTimeout of being down, or on recover while down for over 1 s, the same rescue.
      if (controller.crashed) {
        down += step; retryIn -= step;
        if ((down >= WATCHDOG.crashTimeout || (pressed && down > 1)) && retryIn <= 0) {
          const placed = rescue({ x, y, z, headingY: controller.headingY, dry: true });
          if (placed) return done(placed);
          retryIn = WATCHDOG.retry;
        }
        return null;
      }
      down = 0;
      sinceAnchor += step;
      if (sinceAnchor >= WATCHDOG.anchorEvery && !controller.airborne && y > W() + 0.05
        && !sampler.isOffLimits(x, z, y) && !sampler.isWater(x, z, y)) {
        sinceAnchor = 0;
        const last = anchors.at(-1);
        if (!last || Math.hypot(last.x - x, last.z - z) >= WATCHDOG.anchorSpacing) {
          const a = { x, y, z, headingY: controller.headingY };
          anchors.push(a); if (anchors.length > WATCHDOG.anchors) anchors.shift();
          const near = seaAround(x, z, WATCHDOG.deep).near;
          if (near > WATCHDOG.inland) { inlandAnchors.push(a); if (inlandAnchors.length > WATCHDOG.keep) inlandAnchors.shift(); }
          if (near > WATCHDOG.deep) { deepAnchors.push(a); if (deepAnchors.length > WATCHDOG.keep) deepAnchors.shift(); }
        }
      }
      return null;
    },
  };
}
