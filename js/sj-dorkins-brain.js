/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Officer Dorkins: his flight. A kinematic hover pose (not a second rider controller) that chases what he last saw,
// follows a route on the pursuit graph when the rider is far or out of a straight line, and only ever moves along a
// sweep the flight queries admit. From the San Francisco edition (js/sf-nemesis-brain.js, © 2026 VibezZzCoder, MIT;
// pursuit tuning first written for the New York edition). San Juan's own: the graph (js/sj-dorkins-graph.js), route
// planning spread over frames under a small time budget (a search never costs a frame), probes at 20 Hz instead of every
// frame, and a route link that his checked flight cannot follow is marked blocked for the rest of the session.
import { createPursuitMemory } from './sj-dorkins-memory.js';
import { PENDING } from './sj-dorkins-graph.js';

export const HOVER = Object.freeze({
  cruiseSpeed: 24, acceleration: 9, climbSpeed: 7, climbAcceleration: 14,
  highAltitude: 7, lowAltitude: 1.1, lowFrom: 12, highFrom: 45,
  followDistance: 3, arriveDeceleration: 6, turnRate: 3,
  lookAhead: 4, searchDwell: 1.5, maxStep: 0.05,
  routeInterval: 2, routeRange: 45, routeAttach: 24, routeHeight: 1.1,
  swoopGain: 3, swoopSpeed: 22, swoopAcceleration: 20, swoopTurnRate: 8,
  planMs: 1, probeSeconds: 0.05, stuckSeconds: 1,
});

const ROUTE_END_SPEED = 9, ROUTE_TURN_MIN = 4;
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const wrap = x => x - Math.PI * 2 * Math.floor((x + Math.PI) / (Math.PI * 2));
const finitePoint = p => p && [p.x, p.y, p.z].every(Number.isFinite);

/**
 * `queries` are the flight queries (js/sj-dorkins-flight.js); `graph` the pursuit graph or null. Flight advances only
 * along an admitted sweep. `visible` is the only gate for reading an observation.
 */
export function createFlightBrain(queries, graph = null, tuning = HOVER) {
  if (!queries || typeof queries.clearFlight !== 'function' || typeof queries.supportAt !== 'function') {
    throw new TypeError('Officer flight needs flight and ground queries');
  }
  tuning = { ...HOVER, ...tuning };
  const memory = createPursuitMemory();
  const state = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, speed: 0, bank: 0, pitch: 0, mode: 'idle' };
  let placed = false, searching = false, anchors = [], anchor = -1, dwell = 0;
  let detour = 0, detourTime = 0, probeIn = 0, blocked = false;
  let route = [], routeIndex = 0, replanIn = 0, routeGoal = null, stuck = 0;
  let swoopAim = null;
  const finder = graph ? graph.pathfinder((a, b) => queries.corridorClear(a, b)) : null;
  // planning state: 'idle' | 'search'; the start/goal attachments are chosen when a plan begins
  const plan = { phase: 'idle', goal: null, startNode: -1, goalNode: -1 };

  function validPlacement(position) {
    if (!finitePoint(position)) return false;
    const ground = queries.supportAt(position.x, position.z, position.y);
    return !!ground && !ground.offCourse && !ground.water && Number.isFinite(ground.height)
      && ground.height <= position.y + 1e-4 && queries.allowed(position.x, position.z, position.y) && queries.clearFlight(position, position);
  }

  function place(position, heading = 0) {
    if (!Number.isFinite(heading) || !validPlacement(position)) return false;
    Object.assign(state, { x: position.x, y: position.y, z: position.z, vx: 0, vy: 0, vz: 0,
      heading, speed: 0, bank: 0, pitch: 0, mode: 'idle' });
    placed = true; searching = false; anchors = []; anchor = -1; dwell = detour = detourTime = probeIn = 0; blocked = false;
    route = []; routeIndex = 0; replanIn = 0; routeGoal = swoopAim = null; stuck = 0;
    plan.phase = 'idle'; plan.goal = null;
    memory.clear();
    return true;
  }

  // Sweeps are limited to 10 m; long checks are divided, not bypassed.
  function clearSegment(a, b, check = queries.clearFlight) {
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 8));
    if (count > 8) return false;
    let prev = a;
    for (let i = 1; i <= count; i++) {
      const t = i / count, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
      if (!check(prev, p)) return false;
      prev = p;
    }
    return true;
  }
  const corridor = (a, b) => clearSegment(a, b, queries.corridorClear);

  // the nearest graph node on his layer reached by a checked corridor from `actual` (−1 if none)
  function attach(pos, floor, actual) {
    for (const i of graph.nearby(pos.x, pos.z, tuning.routeAttach, 6, { referenceY: floor, maxHeight: 3 })) {
      if (corridor(actual, { x: graph.x[i], y: graph.y[i] + tuning.routeHeight, z: graph.z[i] })) return i;
    }
    return -1;
  }
  // Start a plan (cheap), then advance it under the frame's time budget; returns a route when one is ready.
  function beginPlan(target) {
    plan.phase = 'idle';
    if (!finder) return;
    const startFloor = queries.supportAt(state.x, state.z, state.y);
    const goalFloor = queries.supportAt(target.x, target.z, target.y);
    if (!startFloor || !goalFloor || !Number.isFinite(startFloor.height) || !Number.isFinite(goalFloor.height)) return;
    plan.goal = { x: target.x, y: goalFloor.height + tuning.routeHeight, z: target.z };
    plan.startFloor = startFloor.height; plan.goalFloor = goalFloor.height;
    plan.startNode = plan.goalNode = -1; plan.phase = 'attach';
  }
  function advancePlan(deadline) {
    if (plan.phase === 'attach') {
      plan.startNode = attach(state, plan.startFloor, state);
      if (plan.startNode < 0) { plan.phase = 'idle'; return []; }
      plan.phase = 'attachGoal';
      if (performance.now() > deadline) return PENDING;
    }
    if (plan.phase === 'attachGoal') {
      plan.goalNode = attach(plan.goal, plan.goalFloor, plan.goal);
      if (plan.goalNode < 0 || !finder.begin(plan.startNode, plan.goalNode)) { plan.phase = 'idle'; return []; }
      plan.phase = 'search';
      if (performance.now() > deadline) return PENDING;
    }
    if (plan.phase === 'search') {
      const result = finder.run(deadline);
      if (result === PENDING) return PENDING;
      plan.phase = 'idle';
      return result;
    }
    return [];
  }

  function advanceReplannedStart(path) {
    let i = 0;
    while (i + 1 < path.length) {
      const a = path[i], b = path[i + 1], dx = b.x - a.x, dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-8 && Math.abs(a.y - b.y) < 1e-6) { i++; continue; }
      if (len2 < 1e-8) break;
      const u = ((state.x - a.x) * dx + (state.z - a.z) * dz) / len2;
      const t = clamp(u, 0, 1), x = a.x + dx * t, z = a.z + dz * t, y = a.y + (b.y - a.y) * t + tuning.routeHeight;
      if (u <= 0 || Math.hypot(state.x - x, state.z - z) > 3 || Math.abs(state.y - y) > 3
        || !corridor(state, { x: b.x, y: b.y + tuning.routeHeight, z: b.z })) break;
      i++;
    }
    return i;
  }

  function searchTarget(dt, visible, observation) {
    if (visible && memory.observe(observation, true)) {
      searching = false; anchors = []; anchor = -1; dwell = 0;
      return memory.lastSeen();
    }
    const known = memory.lastSeen();
    if (!known) return null;
    if (!searching) { searching = true; anchors = memory.searchAnchors(queries); anchor = -1; dwell = 0; }
    let target = anchor < 0 ? known : anchors[anchor];
    if (Math.hypot(target.x - state.x, target.z - state.z) < 4 && Math.abs(target.y - state.y) < 5) {
      dwell += dt;
      if (dwell >= tuning.searchDwell && anchors.length) { anchor = (anchor + 1) % anchors.length; target = anchors[anchor]; dwell = 0; }
    } else dwell = 0;
    return target;
  }

  const moveFrom = { x: 0, y: 0, z: 0 }, moveCandidates = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
  function move(dt, wantVx, wantVz, aimY, acceleration, turnRate, face) {
    const desiredVy = clamp((aimY - state.y) * 2.5, -tuning.climbSpeed, tuning.climbSpeed);
    const vy = state.vy + clamp(desiredVy - state.vy, -tuning.climbAcceleration * dt, tuning.climbAcceleration * dt);
    let ax = wantVx - state.vx, az = wantVz - state.vz;
    const change = Math.hypot(ax, az), maxChange = acceleration * dt;
    if (change > maxChange) { ax *= maxChange / change; az *= maxChange / change; }
    const vx = state.vx + ax, vz = state.vz + az;
    const from = moveFrom; from.x = state.x; from.y = state.y; from.z = state.z;
    const c0 = moveCandidates[0], c1 = moveCandidates[1], c2 = moveCandidates[2];
    c0.x = state.x + vx * dt; c0.y = state.y + vy * dt; c0.z = state.z + vz * dt;
    c1.x = c0.x; c1.y = state.y; c1.z = c0.z;
    c2.x = state.x; c2.y = c0.y; c2.z = state.z;
    let next = null;
    for (let i = 0; i < 3 && !next; i++) if (queries.clearFlight(from, moveCandidates[i])) next = moveCandidates[i];
    if (next) {
      state.vx = (next.x - state.x) / dt; state.vy = (next.y - state.y) / dt; state.vz = (next.z - state.z) / dt;
      state.x = next.x; state.y = next.y; state.z = next.z;
    } else state.vx = state.vy = state.vz = 0;
    state.speed = Math.hypot(state.vx, state.vz);
    const desiredHeading = face === null ? (state.speed > 0.2 ? Math.atan2(state.vx, state.vz) : state.heading) : face;
    const turn = clamp(wrap(desiredHeading - state.heading), -turnRate * dt, turnRate * dt);
    state.heading = wrap(state.heading + turn);
    const ease = 1 - Math.exp(-dt * 6);
    state.bank += (clamp(Math.atan(state.speed * turn / dt / 9.81), -0.6, 0.6) - state.bank) * ease;
    state.pitch += (clamp(0.12 * state.speed / tuning.cruiseSpeed, -0.35, 0.35) - state.pitch) * ease;
    return !!next;
  }

  function routeSpeed() {
    const decel2 = 2 * tuning.arriveDeceleration;
    let cap = tuning.cruiseSpeed, prev = null;
    for (let i = routeIndex - 1; i >= 0 && i >= routeIndex - 4 && !prev; i--) {
      if (Math.hypot(route[i].x - route[routeIndex].x, route[i].z - route[routeIndex].z) > 1e-6) prev = route[i];
    }
    let d = Math.hypot(route[routeIndex].x - state.x, route[routeIndex].z - state.z);
    for (let i = routeIndex; i < route.length && i < routeIndex + 16; i++) {
      const p = route[i], n = route[i + 1];
      let v = ROUTE_END_SPEED;
      if (n) {
        const bx = n.x - p.x, bz = n.z - p.z, lb = Math.hypot(bx, bz);
        if (lb <= 1e-6) continue;
        v = tuning.cruiseSpeed;
        if (prev) {
          const ax = p.x - prev.x, az = p.z - prev.z, la = Math.hypot(ax, az);
          const angle = la > 1e-6 ? Math.acos(clamp((ax * bx + az * bz) / (la * lb), -1, 1)) : 0;
          if (angle > 1e-3) v = clamp(Math.sqrt(tuning.acceleration * Math.min(la, lb) / angle), ROUTE_TURN_MIN, tuning.cruiseSpeed);
        }
        cap = Math.min(cap, Math.sqrt(v * v + decel2 * d));
        d += lb;
      } else cap = Math.min(cap, Math.sqrt(v * v + decel2 * d));
      if (cap <= ROUTE_TURN_MIN) break;
      prev = p;
    }
    return cap;
  }

  function reachedWaypoint(p, n) {
    if (Math.abs(p.y + tuning.routeHeight - state.y) >= 3) return false;
    const h = Math.hypot(p.x - state.x, p.z - state.z);
    if (h < 2) return true;
    return !!n && h < 6 && (state.x - p.x) * (n.x - p.x) + (state.z - p.z) * (n.z - p.z) > 0
      && corridor(state, { x: n.x, y: n.y + tuning.routeHeight, z: n.z });
  }

  const probe = { x: 0, y: 0, z: 0 };
  function update(dt, observation, visible) {
    if (!placed || !Number.isFinite(dt) || dt <= 0) return state;
    dt = Math.min(dt, tuning.maxStep); swoopAim = null;
    const target = searchTarget(dt, visible, observation);
    if (!target) { state.mode = 'idle'; return state; }
    const directDistance = Math.hypot(target.x - state.x, target.z - state.z);
    probeIn -= dt;
    const probing = probeIn <= 0;
    if (probing) {
      probeIn = tuning.probeSeconds;
      const f = Math.min(1, tuning.lookAhead / (directDistance || 1));
      probe.x = state.x + (target.x - state.x) * f; probe.y = state.y; probe.z = state.z + (target.z - state.z) * f;
      blocked = !queries.clearFlight(state, probe);
    }
    const closeAndClear = visible && !searching && !blocked && directDistance < tuning.routeRange * 0.8;
    const wantRoute = !!finder && !closeAndClear && (directDistance > tuning.routeRange || blocked || routeIndex < route.length);
    replanIn -= dt;
    if (wantRoute && plan.phase === 'idle' && (replanIn <= 0 || !routeGoal || Math.hypot(target.x - routeGoal.x, target.y - routeGoal.y, target.z - routeGoal.z) > 15)) {
      beginPlan(target); replanIn = tuning.routeInterval; routeGoal = { ...target };
    }
    if (plan.phase !== 'idle') {
      const result = advancePlan(performance.now() + tuning.planMs);
      if (result !== PENDING) { route = result; routeIndex = advanceReplannedStart(route); stuck = 0; }
    }
    if (!wantRoute) { route = []; routeIndex = 0; plan.phase = 'idle'; }
    while (routeIndex < route.length && reachedWaypoint(route[routeIndex], route[routeIndex + 1])) { routeIndex++; stuck = 0; }
    const waypoint = routeIndex < route.length ? route[routeIndex] : null;
    const aim = waypoint || target;
    const dx = aim.x - state.x, dz = aim.z - state.z, distance = Math.hypot(dx, dz);
    const ux = distance > 1e-6 ? dx / distance : Math.sin(state.heading);
    const uz = distance > 1e-6 ? dz / distance : Math.cos(state.heading);
    const gap = Math.max(0, distance - (waypoint || searching ? 0 : tuning.followDistance));
    const speed = waypoint ? routeSpeed() : Math.min(tuning.cruiseSpeed, Math.sqrt(2 * tuning.arriveDeceleration * gap), 2 * gap);
    const mix = clamp((directDistance - tuning.lowFrom) / (tuning.highFrom - tuning.lowFrom), 0, 1);
    const smooth = mix * mix * (3 - 2 * mix);
    const floor = queries.supportAt(state.x, state.z, state.y);
    const aimY = floor && !floor.offCourse && Number.isFinite(floor.height)
      ? Math.max(floor.height + 0.4, waypoint ? waypoint.y + tuning.routeHeight
        : target.y + tuning.lowAltitude + (tuning.highAltitude - tuning.lowAltitude) * smooth) : state.y;
    detourTime = Math.max(0, detourTime - dt);
    if (probing && detourTime === 0) {
      probe.x = state.x + ux * tuning.lookAhead; probe.y = state.y; probe.z = state.z + uz * tuning.lookAhead;
      if (!queries.clearFlight(state, probe)) {
        const left = { x: state.x + uz * tuning.lookAhead, y: state.y, z: state.z - ux * tuning.lookAhead };
        const right = { x: state.x - uz * tuning.lookAhead, y: state.y, z: state.z + ux * tuning.lookAhead };
        detour = queries.clearFlight(state, left) ? 1 : queries.clearFlight(state, right) ? -1 : 0;
        detourTime = 1;
      } else detour = 0;
    }
    const moved = move(dt, (detour ? uz * detour : ux) * speed, (detour ? -ux * detour : uz) * speed,
      aimY, tuning.acceleration, tuning.turnRate, null);
    // a route link the checked flight cannot follow: block it and plan again at once
    if (waypoint && (!moved || state.speed < 0.3) && speed > 1) {
      stuck += dt;
      if (stuck >= tuning.stuckSeconds) { if (waypoint.edge >= 0) finder?.block(waypoint.edge); route = []; routeIndex = 0; replanIn = 0; stuck = 0; }
    } else stuck = Math.max(0, stuck - dt);
    state.mode = searching ? 'search' : detour ? 'detour' : waypoint ? 'path' : 'pursuit';
    return state;
  }

  /** A wind-up uses only an explicitly visible observation. A committed swing reads no target. */
  function swoop(dt, observation, visible, { lateral = 0, height = 1.1, commit = false } = {}) {
    if (!placed || !Number.isFinite(dt) || dt <= 0) return state;
    dt = Math.min(dt, tuning.maxStep);
    let vx = state.vx, vz = state.vz;
    if (!commit) {
      if (!visible || !finitePoint(observation) || ![observation.heading, observation.vx, observation.vz, lateral, height].every(Number.isFinite)) return state;
      memory.observe(observation, true);
      const h = observation.heading;
      const x = observation.x + Math.cos(h) * lateral + observation.vx * 0.1;
      const z = observation.z - Math.sin(h) * lateral + observation.vz * 0.1;
      vx = observation.vx + (x - state.x) * tuning.swoopGain;
      vz = observation.vz + (z - state.z) * tuning.swoopGain;
      const speed = Math.hypot(vx, vz);
      if (speed > tuning.swoopSpeed) { vx *= tuning.swoopSpeed / speed; vz *= tuning.swoopSpeed / speed; }
      swoopAim = { heading: h, y: observation.y + height };
    }
    move(dt, vx, vz, swoopAim ? swoopAim.y : state.y, tuning.swoopAcceleration,
      tuning.swoopTurnRate, swoopAim ? swoopAim.heading : state.heading);
    state.mode = 'swoop';
    return state;
  }

  /** Fly toward an explicit departure point; the host decides when to hide him. */
  function leave(dt, destination) {
    if (!placed || !Number.isFinite(dt) || dt <= 0 || !finitePoint(destination)) return state;
    dt = Math.min(dt, tuning.maxStep); swoopAim = null; plan.phase = 'idle';
    const dx = destination.x - state.x, dz = destination.z - state.z, d = Math.hypot(dx, dz);
    const speed = Math.min(tuning.cruiseSpeed, 2 * d, Math.sqrt(2 * tuning.arriveDeceleration * d));
    move(dt, d ? dx / d * speed : 0, d ? dz / d * speed : 0, destination.y, tuning.acceleration, tuning.turnRate, null);
    state.mode = 'leave';
    return state;
  }

  function seedObservation(observation, visible) { return placed && memory.observe(observation, visible === true); }
  return { state, place, update, swoop, leave, seedObservation, lastSeen: () => memory.lastSeen(), finder,
    get route() { return route; }, get planning() { return plan.phase; } };
}
