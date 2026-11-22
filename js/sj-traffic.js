/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from mrdoob/slop-newyork (MIT, (c) 2026 Mr.doob) and unable12/slop-sanfrancisco (MIT) */
// Moving traffic: a closed population of cars crawling the mapped one-way streets of Old San Juan. It stops in full
// at the old grid's corners and takes turns there, queues patiently, gives way to people and to the rider, and recycles
// its cars out of the rider's sight. The interface is the one every part of city life implements (js/sj-life.js).
//
//   lanes, connectors, junctions   js/sj-traffic-graph.js, built once from the live world
//   street decisions               js/sj-traffic-data.js (foot streets, bores, speed classes, density by place/hour)
//   drawing                        the vehicle kit (context.kit): assign / pose / hide per slot
//
// Car following is the Intelligent Driver Model and the stop-sign sequence (a full stop, then the order of arrival,
// a timeout only while the junction is clear) of the San Francisco edition's js/traffic.js; the junction claims, the
// lane graph, the manners towards people and the rider, and the population are written for this city.
import { buildLaneGraph, LONG_VEHICLE, GRAPH } from './sj-traffic-graph.js';
import { FLEET, PAINTS, LIVERIES, VEHICLE_TYPE_INDEX, pickWeighted } from './sj-vehicle-types.js';
import { SPEEDS, HOUR_INDEX, HOUR_POPULATION } from './sj-traffic-data.js';

// Intelligent Driver Model: max acceleration, comfortable braking, time headway, standstill gap (SF edition's car
// driver, a little gentler for narrow old streets).
const DRIVER = { a: 1.6, b: 2.6, T: 1.4, s0: 2.2 };
const SQRT_AB = 2 * Math.sqrt(DRIVER.a * DRIVER.b);
const LOOKAHEAD = 60;        // m a driver looks ahead for cars, lines, people and the rider
const STOP_HOLD = 0.9;       // s at a standstill at the line before a stop counts
const STOP_TIMEOUT = 6;      // s of waiting after which the order of arrival no longer holds, if the junction is clear
const STOP_NEAR = 2.6;       // m: front this close to the line counts as at the line
const YIELD_TIME = 4.5;      // s: a car with right of way arriving within this keeps the side street waiting
const COURTESY = 10;        // s at a stop line after which cars with right of way let the waiting car in
const HORN_DELAY = 6;        // s blocked by the rider before the one horn
const HORN_COOLDOWN = 40;    // s before the same car sounds again
const HORN_GAP = 8;          // s between any two horns
const HOLD_AFTER_HIT = 2.5;  // s a car stays put after the rider crashed into or near it
const STUCK_REROUTE = 25;    // s waiting without cause: try another way out of the junction
const STUCK_RECYCLE = 45;    // s: take the car away unseen
const STUCK_FORCE = 120;     // s: take it away even in view (only away from the rider)
const SPAWN_MIN = 18, SPAWN_MAX = 165;   // m from the focus: the ring new cars appear in
const RETIRE = 200;          // m from the focus beyond which an unseen car is moved closer
const SEEN_FAR = 340;        // m: the vehicle kit draws to 330 m: farther than this counts as out of sight
const ARRIVED = 3;           // m: a rider still this near where they were placed has not started yet (no horn)
const PREDICT = 1.5;         // s ahead the rider's path is swept against a car's lane
const SIGHT_RAYS = 6;         // sight rays per frame (beyond them a car counts as seen: it stays)
const FAR_RAY = 120;          // m from the eye beyond which a car is looked at from its own side
const SIGHT_SKIP = 10;        // m next to a car whose obstacles (parked rows, posts) do not hide it
const SIGHT_FAR_LEN = 60;     // m of that ray
const SIGHT_RECHECK = 3;      // s before a car seen in view is looked at again
const POISED_NEAR = 3;        // m off a car's corridor within which a still rider facing across it counts as about to enter
const POISED_EASE = 0.8;      // m/s² a car eases off past such a rider
const RIDER_ACCEL_FOR = 1;    // s the rider's present acceleration is assumed to go on (then their speed holds)
const RIDER_ACCEL_MAX = 6;    // m/s²: estimates above this are clipped (teleports, crashes)
const SIDE_BRAKE = 5.5;       // m/s²: the most a car brakes for a rider coming in from the side ahead of it
const GRAVITY = 9.81;

const HORN = 'horn';

export async function createTraffic(context) {
  const { world, kit, sides, caps } = context;
  const N = Math.max(0, Math.min(kit.capacity | 0, caps.cars | 0));
  const random = context.random('traffic');
  const G = buildLaneGraph(world, sides);
  const { SX, SZ, SY, STX, STZ, SROLL, SCAP, start, count, len, step, kind, stop, turn, twin, node, target, outStart, outs,
    conflictLo, conflictHi, local, cls, laneWeight, junctionAt, stopBack, startBack, longOk, routeWeight, SDL, SDR, RG, gStart, gCount, gStep } = G;
  const CLASS_NAMES = ['service', 'grid', 'spine', 'avenue'];
  const SPEED_RANGE = CLASS_NAMES.map((name) => SPEEDS[name]);

  // ---- Car state (typed arrays, index = kit slot)
  const alive = new Uint8Array(N), type = new Uint8Array(N);
  const half = new Float32Array(N), halfW = new Float32Array(N), axle = new Float32Array(N), height = new Float32Array(N);
  const bendCap = new Float32Array(N), recheck = new Float64Array(N), progress = new Float64Array(N), offset = new Float32Array(N), track = new Float32Array(N), isLong = new Uint8Array(N);
  const route = new Int32Array(N * 4), prev = new Int32Array(N).fill(-1);   // route[i*4] is the current path
  const pos = new Float64Array(N), speed = new Float32Array(N), accel = new Float32Array(N), temper = new Float32Array(N);
  const claim = new Int32Array(N * 2).fill(-1), release = new Float64Array(N * 2), odo = new Float64Array(N);
  const stopDone = new Uint8Array(N), stopAt = new Float64Array(N), stopHold = new Float32Array(N);
  const wait = new Float32Array(N), stuck = new Float32Array(N), caused = new Uint8Array(N), forRider = new Uint8Array(N);
  const riderBlock = new Float32Array(N), hornCool = new Float32Array(N), hold = new Float32Array(N);
  const X = new Float64Array(N), Y = new Float64Array(N), Z = new Float64Array(N), H = new Float32Array(N);
  const pitch = new Float32Array(N), roll = new Float32Array(N), dynPitch = new Float32Array(N), pitchVel = new Float32Array(N);
  const yawRate = new Float32Array(N), steer = new Float32Array(N), lamps = new Uint8Array(N);
  const VX = new Float32Array(N), VZ = new Float32Array(N);
  const bodyX = new Float64Array(N), bodyZ = new Float64Array(N), bodyH = new Float32Array(N), written = new Uint8Array(N);
  const reason = new Uint8Array(N); // why the last junction entry was refused (for checks): see mayEnter
  const bodies = Array.from({ length: N }, () => ({ x: 0, z: 0, headingY: 0, halfWidthMetres: 1, halfLengthMetres: 2, minY: 0, maxY: 1,
    velocityX: 0, velocityZ: 0, kind: 'vehicle', crashProfile: [], crashPitch: 0, crashRoll: 0 }));


  // scalars written every frame live in a typed array (no number boxing in steady state)
  const S = new Float64Array(20), TIME = 0, HORN_GAP_LEFT = 1, OBS_SPEED = 2, DESIRED = 3, STARVED = 4, ARRIVE_X = 5, ARRIVE_Z = 6,
    STARTED = 7, PRED = 8, PRED_SPEED = 9, NEXT_FILL = 10, RAX = 11, RAZ = 12, RPVX = 13, RPVZ = 14, RPX = 15, RPZ = 16,
    RPOK = 17, SIDE = 18;
  // Numbers handed to the hot helpers go through this scratch array rather than as arguments: a number passed to (or
  // returned from) a call the engine does not inline is boxed on the heap, every car, every frame.
  const A = new Float64Array(26), AS = 0, AD = 1, GAP = 2, LEAD = 3, S0 = 4, TH = 5, RES = 6, OX = 7, OZ = 8, OR = 9,
    REACH = 10, DS = 11, DL = 12, DT = 13, OBS = 14, TAIL = 15, WSIDE = 16, WT = 17, WDX = 18, WDZ = 19, WEST = 20,
    PP = 21, PS = 22, WP = 23, WS = 24;
  let hour = HOUR_INDEX[context.hour?.name] ?? 1, population = 0;
  let rrRecycle = 0, active = 0, frameNo = 0;
  let refocusPending = true, riderWasCrashed = false;
  const counters = { horns: 0, recycled: 0, rerouted: 0, unstuck: 0, spawnMisses: 0, spawned: 0 };
  const lastUnstuck = { x: 0, z: 0, reason: 0, path: -1, seen: false };
  const lastRetire = { x: 0, z: 0, camValid: false, far: false, surplus: false, camDist: 0, dot: 0, cos: 0 };
  const events = [];             // pending one-shot events (pooled records)
  const eventPool = Array.from({ length: 8 }, () => ({ type: '', x: 0, y: 0, z: 0 }));
  let eventCount = 0;

  // ---- Paths
  const len2 = (a, b) => Math.sqrt(a * a + b * b); // (Math.hypot returns a heap number on every call)
  const P = { x: 0, y: 0, z: 0, tx: 0, tz: 1, roll: 0, cap: 30, dl: 0, dr: 0 };
  // Point at A[AS] metres along path p.
  function pathPoint(p, out) {
    const n = count[p];
    let f = A[AS] / step[p];
    if (!(f > 0)) f = 0;
    if (f > n - 1.000001) f = n - 1.000001;
    const k = f | 0, t = f - k, o = start[p] + k;
    out.x = SX[o] + (SX[o + 1] - SX[o]) * t; out.z = SZ[o] + (SZ[o + 1] - SZ[o]) * t; out.y = SY[o] + (SY[o + 1] - SY[o]) * t;
    out.tx = STX[o] + (STX[o + 1] - STX[o]) * t; out.tz = STZ[o] + (STZ[o + 1] - STZ[o]) * t;
    out.roll = SROLL[o] + (SROLL[o + 1] - SROLL[o]) * t; out.cap = SCAP[t < 0.5 ? o : o + 1];
    out.dl = SDL[o] + (SDL[o + 1] - SDL[o]) * t; out.dr = SDR[o] + (SDR[o + 1] - SDR[o]) * t;
    A[PP] = p; A[PS] = A[AS] < 0 ? 0 : A[AS]; // where the point is (for the wheels on rough paths)
    return out;
  }
  // A point A[AD] metres from car i's centre along its route (behind the start of its path: its previous path).
  function routePoint(i, out) {
    let p = route[i * 4], s = pos[i] + A[AD];
    if (s < 0) {
      const q = prev[i];
      if (q >= 0 && s + len[q] >= 0) { A[AS] = s + len[q]; return pathPoint(q, out); }
      A[AS] = 0; pathPoint(p, out); out.x += out.tx * s; out.z += out.tz * s; return out;
    }
    for (let k = 1; k < 4 && s > len[p]; k++) { s -= len[p]; p = route[i * 4 + k]; }
    if (s > len[p]) { const over = s - len[p]; A[AS] = len[p]; pathPoint(p, out); out.x += out.tx * over; out.z += out.tz * over; return out; }
    A[AS] = s;
    return pathPoint(p, out);
  }
  // Distance from car i's centre to the start of its route entry k (k ≥ 1).
  function distTo(i, k) {
    let d = len[route[i * 4]] - pos[i];
    for (let j = 1; j < k; j++) d += len[route[i * 4 + j]];
    return d;
  }

  // ---- Choosing the way on
  // A long vehicle (pickup, van) keeps to the turns that hold it (longOk); `avoid` is a turn not to take.
  function chooseConnector(lane, avoid = -1, long = 0) {
    let total = 0;
    for (let k = outStart[lane]; k < outStart[lane + 1]; k++) {
      const c = outs[k];
      if (c === avoid || (long && !longOk[c])) continue;
      total += moveWeight(c);
    }
    if (total <= 0) {
      for (let k = outStart[lane]; k < outStart[lane + 1]; k++) if (outs[k] !== avoid && (!long || longOk[outs[k]])) return outs[k];
      return outs[outStart[lane]];
    }
    let u = random() * total;
    for (let k = outStart[lane]; k < outStart[lane + 1]; k++) {
      const c = outs[k];
      if (c === avoid || (long && !longOk[c])) continue;
      u -= moveWeight(c);
      if (u <= 0) return c;
    }
    return outs[outStart[lane + 1] - 1];
  }
  function moveWeight(c) {
    const t = target[c];
    return (laneWeight[t * 3 + hour] + 0.06) * (turn[c] === 0 ? 1.5 : 1) * routeWeight[t];
  }
  // Fill route entries after `from` (1..3) so the route always looks three paths ahead.
  function extendRoute(i, from) {
    for (let k = from; k < 4; k++) {
      const last = route[i * 4 + k - 1];
      route[i * 4 + k] = kind[last] === 0 ? chooseConnector(last, -1, isLong[i]) : outs[outStart[last]];
    }
  }

  // ---- Junctions
  const conflicts = (a, b) => {
    if (a === b) return false;
    const bit = local[b];
    if (bit < 0 || local[a] < 0) return true;
    return bit < 32 ? (conflictLo[a] >>> bit) & 1 : (conflictHi[a] >>> (bit - 32)) & 1;
  };
  // Is the junction of connector c held by a car whose movement crosses it?
  function boxBusy(i, c) {
    const n = node[c];
    for (let j = 0; j < N; j++) {
      if (j === i || !alive[j]) continue;
      for (let k = 0; k < 2; k++) {
        const d = claim[j * 2 + k];
        if (d >= 0 && node[d] === n && conflicts(c, d)) { blocker[0] = j; return true; }
      }
    }
    return false;
  }
  const hasClaim = (i, c) => claim[i * 2] === c || claim[i * 2 + 1] === c;
  function takeClaim(i, c, clearAt) {
    const k = claim[i * 2] < 0 ? 0 : claim[i * 2 + 1] < 0 ? 1 : (release[i * 2] < release[i * 2 + 1] ? 0 : 1);
    claim[i * 2 + k] = c; release[i * 2 + k] = clearAt;
  }
  // Free metres on lane t from its start to the first car's tail (on into the next path when t is empty and short).
  // (into A[TAIL])
  function tailOn(p, skip) {
    let tail = Infinity;
    for (let j = 0; j < N; j++) {
      if (!alive[j] || j === skip || route[j * 4] !== p) continue;
      const r = pos[j] - half[j];
      if (r < tail) { tail = r; blocker[0] = j; }
    }
    A[TAIL] = tail;
  }
  // The car keeping car i out of a junction (set by the checks below): waiting on one that waits for the rider, a
  // person or a hold is waiting with cause, not stuck.
  const blocker = new Int32Array(1);
  function blockedBy(i) {
    const j = blocker[0];
    if (j >= 0 && (caused[j] || forRider[j] || hold[j] > 0)) caused[i] = 1;
  }
  // May car i, its front `d` metres before the line, enter connector c now?
  // (front A[DL] metres before the line)
  function mayEnter(i, c) {
    const d = A[DL];
    const lane = route[i * 4], t = target[c];
    if (stop[lane] && !stopDone[i]) { reason[i] = 1; return false; }
    // a shared single lane is taken in turn: nobody coming the other way, nobody about to
    const tw = twin[t];
    if (tw >= 0) {
      for (let j = 0; j < N; j++) {
        if (!alive[j] || j === i) continue;
        if (route[j * 4] === tw || claimedInto(j, tw)) { reason[i] = 2; return false; }
      }
    }
    blocker[0] = -1;
    if (boxBusy(i, c)) { reason[i] = 3; blockedBy(i); return false; }
    if (!corridorClear(i, c)) { reason[i] = 7; blockedBy(i); return false; }
    // a plain joint between two road records: nothing crosses there
    if (!junctionAt[node[c]]) return true;
    // the first in line claims; a car behind it follows only a car already crossing the same way
    for (let j = 0; j < N; j++) {
      if (alive[j] && j !== i && route[j * 4] === lane && pos[j] > pos[i] && !hasClaim(j, c)) { reason[i] = 10; blocker[0] = j; blockedBy(i); return false; }
    }
    // room to clear the junction: the queue on the way out, less cars already crossing into it
    const need = 2 * half[i] + 1.5;
    tailOn(t, i);
    let free = A[TAIL];
    if (free === Infinity) { const nx = route[i * 4 + 3]; tailOn(nx, i); free = len[t] + Math.min(len[nx], A[TAIL]); }
    free -= startBack[t];
    for (let j = 0; j < N; j++) {
      if (!alive[j] || j === i || route[j * 4] === t) continue;
      if ((hasClaim(j, c) || (route[j * 4] === c)) && claimedInto(j, t)) free -= 2 * half[j] + 1.5;
    }
    if (free < need) { reason[i] = 4; blockedBy(i); return false; }
    const n = node[c];
    if (stop[lane]) {
      const waited = wait[i] > STOP_TIMEOUT;
      // first to stop goes first, among the movements that cross
      if (!waited) for (let j = 0; j < N; j++) {
        if (!alive[j] || j === i || !stopDone[j] || claim[j * 2] >= 0 && node[claim[j * 2]] === n) continue;
        const lj = route[j * 4];
        if (kind[lj] !== 0 || node[lj] !== n || !stop[lj] || stopAt[j] >= stopAt[i]) continue;
        if (len[lj] - stopBack[lj] - pos[j] - half[j] > STOP_NEAR) continue;
        if (conflicts(c, route[j * 4 + 1])) { reason[i] = 5; return false; }
      }
    }
    // a lane with right of way: its cars arriving soon keep the others waiting, except a car that has waited long at
    // its stop line: those that can still stop comfortably let it in (see the courtesy below)
    const patient = stop[lane] && wait[i] > COURTESY;
    for (let j = 0; j < N; j++) {
      if (!alive[j] || j === i) continue;
      const lj = route[j * 4];
      if (kind[lj] !== 0 || node[lj] !== n || lj === lane || stop[lj] || !stop[lane] && !(G.rank[lj] > G.rank[lane])) continue;
      if (hasClaim(j, route[j * 4 + 1])) continue; // already crossing: the junction claim covers it
      const dj = len[lj] - stopBack[lj] - pos[j] - half[j];
      if (dj > LOOKAHEAD) continue;
      if (speed[j] < 0.3 && dj < STOP_NEAR) continue; // waiting itself: it sees our claim when it decides
      if (patient && speed[j] * speed[j] < 2 * DRIVER.b * Math.max(0, dj - 0.5)) continue;
      if (dj / Math.max(speed[j], 0.5) < YIELD_TIME && conflicts(c, route[j * 4 + 1])) { reason[i] = 6; return false; }
    }
    // courtesy: with right of way, still able to stop comfortably, let in a crossing car that has waited long at its line
    if (!stop[lane] && speed[i] * speed[i] < 2 * DRIVER.b * Math.max(0, d - 0.5) + 0.5) {
      for (let j = 0; j < N; j++) {
        if (!alive[j] || j === i || !stopDone[j] || wait[j] <= COURTESY || reason[j] !== 6) continue; // waiting for us, nothing else
        const lj = route[j * 4];
        if (kind[lj] !== 0 || node[lj] !== n || !stop[lj] || hasClaim(j, route[j * 4 + 1])) continue;
        if (len[lj] - stopBack[lj] - pos[j] - half[j] > STOP_NEAR) continue;
        if (conflicts(c, route[j * 4 + 1])) { reason[i] = 9; return false; }
      }
    }
    reason[i] = 0;
    return true;
  }
  // Is connector c physically clear of every car that is not simply ahead on it (a car standing across it from a
  // neighbouring junction, a car left in the way)? The catch-all behind the junction claims.
  function corridorClear(i, c) {
    const o = start[c], n = count[c];
    const r = halfW[i] + 0.3;
    for (let j = 0; j < N; j++) {
      if (!alive[j] || j === i) continue;
      const q = route[j * 4];
      if (q === c || q === target[c]) continue; // ahead on the same way: following and the exit room handle it
      // waiting behind its own stop line at this junction: placed clear of every turn (stopBack), the claims order it
      if (kind[q] === 0 && node[q] === node[c] && len[q] - stopBack[q] - pos[j] - half[j] > -0.3) continue;
      const mx = SX[o + (n >> 1)], mz = SZ[o + (n >> 1)];
      const reach = len[c] * 0.5 + half[j] + r + 1;
      if ((X[j] - mx) ** 2 + (Z[j] - mz) ** 2 > reach * reach) continue;
      const s = Math.sin(H[j]), co = Math.cos(H[j]);
      for (let k = 0; k < n; k++) {
        const dx = SX[o + k] - X[j], dz = SZ[o + k] - Z[j];
        const along = dx * s + dz * co, lat = dx * co - dz * s;
        if (Math.abs(along) < half[j] + r && Math.abs(lat) < halfW[j] + r) { blocker[0] = j; return false; }
      }
    }
    return true;
  }
  // Is the way through connector c and the first car length beyond it free of the rider and of people? (A car only
  // enters a junction it can leave; someone standing on its exit keeps it at the line, outside.)
  function exitBlocked(i, c) {
    const t = target[c], r = context.rider;
    const reachOut = startBack[t] + 2 * half[i] + 1.5;
    const top = SY[start[c]] + height[i];
    let riderIn = r.valid && r.maxY > SY[start[c]] - 1.5 && r.minY < top + 1.5;
    const rr = Math.max(r.halfWidth, r.halfLength), lateral = halfW[i] + 0.35;
    // people near enough to the turn and its way out to matter (the rest skip the per-sample test)
    const mo = start[c] + (count[c] >> 1), mx = SX[mo], mz = SZ[mo], reachAll = len[c] * 0.5 + reachOut + lateral + 1.5;
    let nearCount = 0;
    for (let q = 0; q < peopleCount; q++) {
      const b = people[q], dx = b.x - mx, dz = b.z - mz;
      if (dx * dx + dz * dz < reachAll * reachAll) exitPeople[nearCount++] = b;
    }
    for (let pass = 0; pass < 2; pass++) {
      const p = pass ? t : c, o = start[p];
      const n = pass ? Math.min(count[p], Math.ceil(reachOut / step[p]) + 1) : count[p];
      for (let k = 0; k < n; k++) {
        const x = SX[o + k], z = SZ[o + k];
        if (riderIn) { const dx = r.x - x, dz = r.z - z, m = lateral + rr; if (dx * dx + dz * dz < m * m) return true; }
        for (let q = 0; q < nearCount; q++) {
          const b = exitPeople[q], m = lateral + Math.max(b.halfWidthMetres, b.halfLengthMetres);
          const dx = b.x - x, dz = b.z - z;
          if (dx * dx + dz * dz < m * m && b.minY < SY[o + k] + height[i] && b.maxY > SY[o + k]) return true;
        }
      }
    }
    return false;
  }
  // Does car j hold or approach a claim on a connector into path t?
  function claimedInto(j, t) {
    for (let k = 0; k < 2; k++) { const d = claim[j * 2 + k]; if (d >= 0 && target[d] === t) return true; }
    return route[j * 4] >= 0 && kind[route[j * 4]] === 1 && target[route[j * 4]] === t;
  }

  // ---- Obstacles: the rider and people in the way
  // people (kind 'person') in last frame's snapshot round the focus, gathered once per frame
  const people = [], exitPeople = [];
  const peopleSink = { push(b) { if (b.kind === 'person') people[peopleCount++] = b; } };
  // people binned in a grid round the focus each frame (GRID_N × GRID_N cells of GRID m), so a car reads only the cells
  // ahead of it: cellHead[c] is the first person in cell c, cellNext[k] the next after person k (−1 ends a list)
  const GRID = 16, GRID_N = 40, cellHead = new Int32Array(GRID_N * GRID_N), cellNext = new Int32Array(1024);
  let gridX = 0, gridZ = 0;
  function binPeople() {
    cellHead.fill(-1);
    gridX = context.focus.x - GRID * GRID_N / 2; gridZ = context.focus.z - GRID * GRID_N / 2;
    const n = Math.min(peopleCount, cellNext.length);
    for (let k = 0; k < n; k++) {
      const cx = Math.floor((people[k].x - gridX) / GRID), cz = Math.floor((people[k].z - gridZ) / GRID);
      if (cx < 0 || cz < 0 || cx >= GRID_N || cz >= GRID_N) { cellNext[k] = -2; continue; }
      const c = cz * GRID_N + cx;
      cellNext[k] = cellHead[c]; cellHead[c] = k;
    }
  }
  let peopleCount = 0; // live entries of `people` (the array keeps its storage)
  function gatherPeople() {
    peopleCount = 0;
    const index = context.bodies;
    if (!index) return;
    // one query round the focus wide enough for every live car's look ahead, appending people straight into `people`
    // (an array emptied and filled again every frame would give back its storage and grow anew: garbage every frame)
    let reach = 0;
    for (let i = 0; i < N; i++) if (alive[i]) reach = Math.max(reach, len2(X[i] - context.focus.x, Z[i] - context.focus.z));
    index.dynamicBodiesNear(context.focus.x, context.focus.z, Math.min(reach + LOOKAHEAD + 5, GRID * GRID_N / 2), peopleSink);
    binPeople();
  }
  const Q = { x: 0, y: 0, z: 0, tx: 0, tz: 1, roll: 0, cap: 30, dl: 0, dr: 0 };
  // Gap (m, from the front bumper) to a round obstacle of radius r at (ox, oz) on car i's way, or Infinity.
  // An obstacle beside the car's own body gives 0: the car does not move into it.
  // Obstacle at (A[OX], A[OZ]), radius A[OR]; looks A[REACH] ahead; the gap goes to A[RES].
  function obstacleGap(i) {
    const ox = A[OX], oz = A[OZ], r = A[OR], reach = A[REACH];
    A[RES] = Infinity;
    const dx = ox - X[i], dz = oz - Z[i];
    const lim = reach + half[i] + r + 2;
    if (dx * dx + dz * dz > lim * lim) return;
    const lateral = halfW[i] + r + 0.35;
    // only what is level with the front bumper or ahead of it: beside or behind the car, moving on cannot touch it
    for (let d = half[i] * 0.5; d <= reach + half[i]; d += 1) {
      A[AD] = d;
      routePoint(i, Q);
      const ex = ox - Q.x, ez = oz - Q.z;
      const along = ex * Q.tx + ez * Q.tz;
      if (along < -0.6 || along > 0.6) continue;
      const lat = -ex * Q.tz + ez * Q.tx;
      if (lat > lateral || lat < -lateral) continue;
      if (d + along + r < half[i] - 0.2) continue;
      A[RES] = Math.max(0, d + along - half[i] - r);
      return;
    }
  }
  // Nearest gap to the rider or a person ahead of car i (sets S[OBS_SPEED] and forRider[i]).
  // Looks A[REACH] ahead; the nearest gap goes to A[OBS].
  function obstaclesAhead(i) {
    const reach = A[REACH];
    let best = Infinity;
    S[OBS_SPEED] = 0; forRider[i] = 0; S[PRED] = Infinity; S[PRED_SPEED] = 0; S[SIDE] = 0;
    const rider = context.rider;
    if (rider.valid) {
      const top = Y[i] + height[i], bottom = Y[i] + 0.05;
      if (rider.maxY > bottom && rider.minY < top) {
        const r = Math.max(rider.halfWidth, rider.halfLength) * 0.9;
        const fx = Math.sin(H[i]), fz = Math.cos(H[i]);
        const riderAlong = Math.max(0, rider.vx * fx + rider.vz * fz);
        // where the rider is now, on the car's way ahead (a hard limit: the car never moves into them)
        A[OX] = rider.x; A[OZ] = rider.z; A[OR] = r;
        obstacleGap(i);
        const g0 = A[RES];
        if (g0 < best) { best = g0; forRider[i] = 1; S[OBS_SPEED] = riderAlong; }
        // where the rider is going: their path over the next PREDICT seconds, swept against the corridor ahead of the
        // car's front as it moves on (a soft term: the car eases off, it does not freeze). A rider in line behind the car
        // cannot come out ahead without going through it: ignored (a rider who hits the car meets its native contact).
        A[OR] = r; predictRider(i);
      }
    }
    {
      const lim = reach + half[i] + 3, hx = Math.sin(H[i]), hz = Math.cos(H[i]), lat0 = halfW[i] + 1.5;
      // the grid cells of the box round the car and its look ahead
      const ax = X[i] + hx * lim * 0.5, az = Z[i] + hz * lim * 0.5, rb = lim * 0.5 + lat0 + lim * 0.25;
      const c0 = Math.max(0, Math.floor((ax - rb - gridX) / GRID)), c1 = Math.min(GRID_N - 1, Math.floor((ax + rb - gridX) / GRID));
      const r0 = Math.max(0, Math.floor((az - rb - gridZ) / GRID)), r1 = Math.min(GRID_N - 1, Math.floor((az + rb - gridZ) / GRID));
      for (let cz = r0; cz <= r1; cz++) for (let cx = c0; cx <= c1; cx++) for (let k = cellHead[cz * GRID_N + cx]; k >= 0; k = cellNext[k]) {
        const b = people[k];
        const ex = b.x - X[i], ez = b.z - Z[i];
        if (ex * ex + ez * ez > lim * lim) continue;
        // ahead of the front, inside a corridor that widens with distance (lanes bend): only then the route walk
        const ahead = ex * hx + ez * hz, side = ex * hz - ez * hx;
        if (ahead < half[i] - 1 || side > lat0 + ahead * 0.5 || side < -lat0 - ahead * 0.5) continue;
        if (b.maxY <= Y[i] + 0.05 || b.minY >= Y[i] + height[i]) continue;
        A[OX] = b.x; A[OZ] = b.z; A[OR] = Math.max(b.halfWidthMetres, b.halfLengthMetres);
        obstacleGap(i);
        const g = A[RES];
        if (g < best) { best = g; forRider[i] = 0; S[OBS_SPEED] = Math.max(0, (b.velocityX || 0) * Math.sin(H[i]) + (b.velocityZ || 0) * Math.cos(H[i])); }
      }
    }
    A[OBS] = best;
  }

  // The rider's path over PREDICT s against car i's corridor (car frame, the car going on at its speed): their speed and
  // the acceleration they have now, held for RIDER_ACCEL_FOR s (a rider setting off across the street is foreseen
  // before they are fast). Two kinds of conflict:
  // - the rider comes into the corridor ahead of the car's front: S[PRED] (gap from the front) and S[PRED_SPEED] (their
  //   speed along the car's way), a soft IDM term;
  // - the rider comes in from the side into the front half of the car as it passes: S[SIDE], the deceleration that
  //   keeps the front short of where they cross (at least a clear ease-off, at most SIDE_BRAKE); the car does not
  //   accelerate meanwhile. Contact on the rear half cannot be avoided by braking and is left to the native contact.
  function predictRider(i) {
    const rider = context.rider, r = A[OR], fx = Math.sin(H[i]), fz = Math.cos(H[i]);
    const ex = rider.x - X[i], ez = rider.z - Z[i];
    const a0 = ex * fx + ez * fz, l0 = -ex * fz + ez * fx;
    const va = rider.vx * fx + rider.vz * fz, vl = -rider.vx * fz + rider.vz * fx;
    let aa = S[RAX] * fx + S[RAZ] * fz, al = -S[RAX] * fz + S[RAZ] * fx;
    if (aa * va + al * vl < 0 && rider.speed > 1) { aa = 0; al = 0; } // slowing down: predicted at their present speed
    const lateral = halfW[i] + r + 0.35;
    if (a0 < half[i] && l0 < lateral && l0 > -lateral) return; // in line beside or behind: cannot get ahead without contact
    if (a0 - r - half[i] > LOOKAHEAD) return;
    const outside = l0 >= lateral || l0 <= -lateral;
    // poised at the edge: nearly still, a few metres off the corridor ahead of the front, facing across it towards the
    // car's path: the car eases off and does not speed up past them (they may set off at any moment)
    if (outside && rider.speed < 1.5 && a0 > half[i] - 1 && a0 - r - half[i] < speed[i] * PREDICT + 3 && (l0 > 0 ? l0 : -l0) < lateral + POISED_NEAR) {
      const hx = Math.sin(rider.heading), hz = Math.cos(rider.heading), across = -hx * fz + hz * fx; // facing, across the car's way
      if ((l0 > 0 && across < -0.7) || (l0 < 0 && across > 0.7)) { if (S[SIDE] < POISED_EASE) S[SIDE] = POISED_EASE; }
    }
    for (let t = 0.1; t <= PREDICT + 1e-6; t += 0.1) {
      const tc = t < RIDER_ACCEL_FOR ? t : RIDER_ACCEL_FOR, k = tc * t - tc * tc * 0.5;
      const la = a0 + va * t + aa * k, ll = l0 + vl * t + al * k;
      if (ll >= lateral || ll <= -lateral) continue;
      const front = half[i] + speed[i] * t;
      if (la - r >= front - 0.3) {
        const g = Math.max(0, a0 - r - half[i]);
        if (g < S[PRED]) { S[PRED] = g; S[PRED_SPEED] = Math.max(0, va); }
        return;
      }
      if (outside && la + r > speed[i] * t) {
        const g = la - r - half[i] - 0.3, v = speed[i];
        const need = v * v / (2 * Math.max(g, 0.05));
        const b = need < 1.5 ? 1.5 : need > SIDE_BRAKE ? SIDE_BRAKE : need;
        if (b > S[SIDE]) S[SIDE] = b;
        return;
      }
      return; // into the corridor beside the rear half: braking does not help
    }
  }

  // ---- Intelligent Driver Model
  // Braking for something A[GAP] metres ahead moving at A[LEAD], standstill gap A[S0], headway A[TH]: into A[RES].
  function brake(i) {
    const v = speed[i];
    const desired = A[S0] + Math.max(0, v * A[TH] + (v * (v - A[LEAD])) / SQRT_AB);
    A[RES] = -DRIVER.a * (desired / Math.max(A[GAP], 0.1)) ** 2;
  }

  // ---- One car, one step
  const front = { x: 0, y: 0, z: 0, tx: 0, tz: 1, roll: 0, cap: 30, dl: 0, dr: 0 }, rear = { x: 0, y: 0, z: 0, tx: 0, tz: 1, roll: 0, cap: 30, dl: 0, dr: 0 };
  const mid = { x: 0, y: 0, z: 0, tx: 0, tz: 1, roll: 0, cap: 30, dl: 0, dr: 0 };
  function drive(i) {
    const dt = A[DT], p = route[i * 4];
    let worst = 0, limit = Infinity; // braking term; hard limit on metres this step
    caused[i] = 0;
    // the car ahead on the route
    let leadGap = Infinity, leadCaused = 0;
    const r1 = route[i * 4 + 1], r2 = route[i * 4 + 2], r3 = route[i * 4 + 3];
    const d1 = len[p] - pos[i], d2 = d1 + len[r1], d3 = d2 + len[r2];
    for (let j = 0; j < N; j++) {
      if (j === i || !alive[j]) continue;
      const q = route[j * 4];
      let d;
      if (q === p) { if (pos[j] <= pos[i]) continue; d = pos[j] - pos[i]; }
      else if (q === r1) d = d1 + pos[j];
      else if (q === r2) d = d2 + pos[j];
      else if (q === r3) d = d3 + pos[j];
      else continue;
      const gap = d - half[i] - half[j];
      if (gap < leadGap) { leadGap = gap; leadCaused = caused[j] || forRider[j] || hold[j] > 0 ? 1 : 0; A[GAP] = gap; A[LEAD] = speed[j]; A[S0] = DRIVER.s0; A[TH] = DRIVER.T; brake(i); worst = Math.min(worst, A[RES]); }
    }
    if (leadGap < Infinity) { limit = Math.min(limit, Math.max(0, leadGap - 0.4)); if (leadGap < 12 && leadCaused) caused[i] = 1; }
    // the rider and people
    const reach = Math.min(LOOKAHEAD, 10 + speed[i] * speed[i] / (2 * DRIVER.b) + speed[i] * 2);
    A[REACH] = reach;
    obstaclesAhead(i);
    const og = A[OBS];
    if (og < Infinity) {
      A[GAP] = og; A[LEAD] = S[OBS_SPEED]; A[S0] = 1.6; A[TH] = 0.9; brake(i);
      worst = Math.min(worst, A[RES]);
      limit = Math.min(limit, Math.max(0, og - 0.6));
      if (og < 8) caused[i] = 1;
    } else forRider[i] = 0;
    if (S[PRED] < Infinity) {
      A[GAP] = S[PRED]; A[LEAD] = S[PRED_SPEED]; A[S0] = 1.6; A[TH] = 0.9; brake(i);
      worst = Math.min(worst, Math.max(-5, A[RES])); // eases off; only a rider actually in the way stops it outright
    }
    const side = S[SIDE];
    // the line at the end of a lane
    if (kind[p] === 0) {
      const c = route[i * 4 + 1], dLine = len[p] - stopBack[p] - pos[i] - half[i];
      // a claim taken but the junction not yet entered: give it back if someone has stepped onto the way out and the
      // car can still stop comfortably at the line
      if (hasClaim(i, c) && dLine > 0 && speed[i] * speed[i] < 2 * DRIVER.b * (dLine + 0.3) && exitBlocked(i, c)) {
        for (let k = 0; k < 2; k++) if (claim[i * 2 + k] === c) claim[i * 2 + k] = -1;
      }
      if (!hasClaim(i, c)) {
        // full stop at a stop line
        if (stop[p] && !stopDone[i]) {
          if (dLine < STOP_NEAR && speed[i] < 0.3) { stopHold[i] += dt; if (stopHold[i] >= STOP_HOLD) { stopDone[i] = 1; stopAt[i] = S[TIME]; } }
          else stopHold[i] = 0;
        }
        const decide = Math.max(10, speed[i] * speed[i] / (2 * DRIVER.b) + 6);
        let go = false;
        // someone (the rider, a person) in the junction or just beyond: wait at the line, not inside
        const blocked = og < dLine + len[c] + 2 * half[i] + 1 || (dLine < decide && exitBlocked(i, c));
        if (dLine < decide && hold[i] <= 0 && !blocked) {
          A[DL] = dLine;
          go = mayEnter(i, c);
          // waited long without cause: another way out of this junction
          if (!go && stuck[i] > STUCK_REROUTE && dLine < STOP_NEAR) {
            const other = chooseConnector(p, c, isLong[i]);
            if (other !== c && mayEnter(i, other)) { route[i * 4 + 1] = other; extendRoute(i, 2); go = true; counters.rerouted++; stuck[i] = 0; }
          }
          if (go) { const cc = route[i * 4 + 1]; takeClaim(i, cc, odo[i] + len[p] - pos[i] + len[cc] + startBack[target[cc]] + half[i] + 0.4); }
        }
        if (blocked) { reason[i] = 8; caused[i] = 1; }
        if (!go) {
          A[GAP] = Math.max(0.05, dLine + 0.4); A[LEAD] = 0; A[S0] = 0.5; A[TH] = 0; brake(i);
          worst = Math.min(worst, A[RES]);
          limit = Math.min(limit, Math.max(0, dLine));
        }
      }
    }
    // bends ahead: the speed at each sample, reachable braking comfortably from here
    // this street's speed for this driver; steep streets slower beyond 8 % (SF edition)
    const range = SPEED_RANGE[cls[p]];
    const v0 = ((range[0] + (range[1] - range[0]) * temper[i]) / 3.6) * Math.max(0.5, 1 - Math.max(0, Math.abs(Math.tan(pitch[i])) - 0.08) * 2.5);
    // the bend cap is refreshed every third frame (cars in turn): bends do not move, a car covers a metre or less
    if ((frameNo + i) % 3 === 0 || bendCap[i] <= 0) {
      let cap = 30;
      const ahead = Math.min(40, speed[i] * speed[i] / 2 + 8);
      for (let d = 0; d <= ahead; d += 1.5) {
        A[AD] = d;
        routePoint(i, mid);
        const allowed = Math.sqrt(mid.cap * mid.cap + 2 * 1.4 * d);
        if (allowed < cap) cap = allowed;
      }
      bendCap[i] = cap;
    }
    const cap = Math.min(v0, bendCap[i]);
    S[DESIRED] = Math.min(v0, Math.max(cap, 0.8));
    // the grade: gravity along the slope, felt in part; uphill never below a crawl (SF edition)
    const grade = Math.tan(pitch[i]);
    const gravity = -GRAVITY * grade * 0.5;
    const freeAcc = DRIVER.a * (1 - (speed[i] / Math.max(0.5, S[DESIRED])) ** 4);
    let free = freeAcc + gravity;
    if (gravity < 0) free = Math.max(free, Math.min(freeAcc, 0.3));
    let a = Math.min(free + worst, (S[DESIRED] - speed[i]) * 2 + 0.3);
    if (side > 0 && a > -side) a = -side; // a rider coming in from the side ahead: brake, never speed up into them
    if (hold[i] > 0) { hold[i] -= dt; a = -6; limit = 0; }
    a = Math.max(-8, Math.min(DRIVER.a, a));
    let v = Math.max(0, speed[i] + a * dt);
    let ds = (speed[i] + v) * 0.5 * dt;
    if (ds > limit) { ds = Math.max(0, limit); v = Math.min(v, ds / Math.max(dt, 1e-6)); }
    accel[i] = dt > 0 ? (v - speed[i]) / dt : 0;
    speed[i] = v;
    A[DS] = ds;
    advance(i);
    // waiting: with a cause (the rider, people, a hold or a queue behind one) or without
    // stuck: time without 2.5 m of progress, not counting waits with a cause (a queue that moves is not stuck)
    if (odo[i] - progress[i] >= 2.5) { progress[i] = odo[i]; stuck[i] = 0; }
    if (v < 0.2) {
      wait[i] += dt;
      if (!caused[i] && hold[i] <= 0) stuck[i] += dt;
    } else wait[i] = 0;
    if (forRider[i] && v < 0.4 && og < 6) riderBlock[i] += dt; else riderBlock[i] = Math.max(0, riderBlock[i] - dt * 2);
    hornCool[i] = Math.max(0, hornCool[i] - dt);
    if (riderBlock[i] > HORN_DELAY && hornCool[i] <= 0 && S[HORN_GAP_LEFT] <= 0 && S[STARTED]) {
      pushEvent(HORN, X[i] + Math.sin(H[i]) * half[i], Y[i] + 1, Z[i] + Math.cos(H[i]) * half[i]);
      hornCool[i] = HORN_COOLDOWN; S[HORN_GAP_LEFT] = HORN_GAP; riderBlock[i] = 0; counters.horns++;
    }
  }
  // Move car i A[DS] metres along its route.
  function advance(i) {
    const ds = A[DS];
    pos[i] += ds; odo[i] += ds;
    while (pos[i] > len[route[i * 4]]) {
      const p = route[i * 4];
      pos[i] -= len[p];
      prev[i] = p;
      route[i * 4] = route[i * 4 + 1]; route[i * 4 + 1] = route[i * 4 + 2]; route[i * 4 + 2] = route[i * 4 + 3];
      extendRoute(i, 3);
      if (kind[route[i * 4]] === 0) { stopDone[i] = 0; stopHold[i] = 0; }
      // entering a junction without having claimed it (a plain joint): claim it now
      const c = route[i * 4];
      if (kind[c] === 1 && !hasClaim(i, c)) takeClaim(i, c, odo[i] - pos[i] + len[c] + startBack[target[c]] + half[i] + 0.4);
    }
    for (let k = 0; k < 2; k++) if (claim[i * 2 + k] >= 0 && odo[i] >= release[i * 2 + k]) claim[i * 2 + k] = -1;
  }
  // Pose from the wheels: both axles on the route (the wheelbase centre `offset` ahead of the footprint centre), the
  // body a rigid plane through the four tyre contacts (the ground under each wheel track), lifted where needed so that
  // no tyre sinks into a twisted patch. (x, z) is the footprint centre and y the ground under it, as the kit expects.
  // The ground under a wheel A[WSIDE] (1 left, −1 right) A[WT] metres off axle point `a` (on path A[WP], A[WS] metres
  // along it), the body heading (A[WDX], A[WDZ]), into A[RES]: the wheel taken into that path's frame (along and across its tangent) and the
  // ground stored across the tracks interpolated there (G.RG: 7 values per row, centre then 0.65 / 0.75 / 0.85 m left
  // and right, every 0.25 m; rough paths only). A[WEST] (the lane's estimate) where the path has none.
  function wheelGround(a) {
    const p = A[WP] | 0, side = A[WSIDE], t = A[WT], dx = A[WDX], dz = A[WDZ];
    if (!(p >= 0) || !G.rough[p]) { A[RES] = A[WEST]; return; }
    const along = side * t * (dz * a.tx - dx * a.tz), lat = side * t * (dz * a.tz + dx * a.tx);
    const m = gCount[p];
    let f = (A[WS] + along) / gStep[p];
    if (!(f > 0)) f = 0;
    if (f > m - 1.000001) f = m - 1.000001;
    const k = f | 0, u = f - k, r0 = (gStart[p] + k) * 7, r1 = r0 + 7;
    const al = lat < 0 ? -lat : lat;
    let q = (al - 0.65) / 0.1;
    if (q < 0) q = 0; else if (q > 1.999999) q = 1.999999;
    const j = q | 0, v = q - j, c = (lat >= 0 ? 1 : 4) + j;
    const g0 = RG[r0 + c] + (RG[r0 + c + 1] - RG[r0 + c]) * v, g1 = RG[r1 + c] + (RG[r1 + c + 1] - RG[r1 + c]) * v;
    A[RES] = g0 + (g1 - g0) * u;
  }
  function locate(i) {
    A[AD] = offset[i] + axle[i]; routePoint(i, front);
    const fp = A[PP] | 0, fs = A[PS];
    A[AD] = offset[i] - axle[i]; routePoint(i, rear);
    const rp = A[PP] | 0, rs = A[PS];
    let dx = front.x - rear.x, dz = front.z - rear.z;
    const l = len2(dx, dz) || 1; dx /= l; dz /= l;
    const k = track[i] / G.track;
    let fl = front.y + front.dl * k, fr = front.y + front.dr * k, rl = rear.y + rear.dl * k, rr = rear.y + rear.dr * k;
    // on a path where the street's own support is not the terrain's shape (islands, raised surfaces, banks) and near
    // the rider: the ground under each wheel itself (the lane's samples, taken along its tangent, miss narrow features)
    if (G.rough[fp] || G.rough[rp]) {
      A[WT] = track[i]; A[WDX] = dx; A[WDZ] = dz;
      A[WP] = fp; A[WS] = fs;
      A[WSIDE] = 1; A[WEST] = fl; wheelGround(front); fl = A[RES];
      A[WSIDE] = -1; A[WEST] = fr; wheelGround(front); fr = A[RES];
      A[WP] = rp; A[WS] = rs;
      A[WSIDE] = 1; A[WEST] = rl; wheelGround(rear); rl = A[RES];
      A[WSIDE] = -1; A[WEST] = rr; wheelGround(rear); rr = A[RES];
    }
    let tp = ((fl + fr) - (rl + rr)) / (4 * axle[i]);                    // rise per metre forward
    let tr = ((fl + rl) - (fr + rr)) / (4 * Math.max(0.3, track[i]));   // rise per metre to the left
    if (tr > GRAPH.maxRoll) tr = GRAPH.maxRoll; else if (tr < -GRAPH.maxRoll) tr = -GRAPH.maxRoll;
    let yc = (fl + fr + rl + rr) / 4;                                  // at the wheelbase centre
    // centred between the highest and the lowest contact (a twist the rigid body cannot follow is shared: a quarter of
    // it at each tyre, half above and half below, rather than half of it under one floating tyre)
    let hi = -Infinity, lo = Infinity;
    for (let w = 0; w < 4; w++) {
      const sf = w < 2 ? 1 : -1, sl = w & 1 ? -1 : 1;
      const ground = w === 0 ? fl : w === 1 ? fr : w === 2 ? rl : rr;
      const r = ground - (yc + sf * axle[i] * tp + sl * track[i] * tr);
      if (r > hi) hi = r; if (r < lo) lo = r;
    }
    yc += Math.max(-0.4, Math.min(0.4, (hi + lo) * 0.5));
    X[i] = (front.x + rear.x) * 0.5 - dx * offset[i]; Z[i] = (front.z + rear.z) * 0.5 - dz * offset[i];
    Y[i] = yc - tp * offset[i];
    H[i] = Math.atan2(dx, dz);
    pitch[i] = Math.atan(tp);
    roll[i] = Math.atan(tr);
  }
  function pose(i) {
    const dt = A[DT];
    const before = H[i];
    locate(i);
    let dYaw = H[i] - before;
    dYaw -= Math.round(dYaw / (Math.PI * 2)) * Math.PI * 2;
    if (dt > 0) {
      yawRate[i] += (dYaw / dt - yawRate[i]) * Math.min(1, dt * 8);
      const s = Math.max(-0.6, Math.min(0.6, Math.atan((2 * axle[i] * yawRate[i]) / Math.max(speed[i], 0.5))));
      steer[i] += (s - steer[i]) * Math.min(1, dt * 10);
      // a little body pitch: the nose dips under braking and lifts pulling away
      pitchVel[i] += ((0.008 * accel[i] - dynPitch[i]) * 68 - pitchVel[i] * 10.8) * dt;
      dynPitch[i] = Math.max(-0.05, Math.min(0.05, dynPitch[i] + pitchVel[i] * dt));
    }
    const sp = speed[i], sh = Math.sin(H[i]), ch = Math.cos(H[i]);
    VX[i] = sh * sp; VZ[i] = ch * sp;
    let l = 0;
    if (accel[i] < -0.4 || sp < 0.25) l |= kit.LAMPS.BRAKE;
    const p = route[i * 4];
    const c = kind[p] === 1 ? p : route[i * 4 + 1];
    const near = kind[p] === 1 || len[p] - pos[i] < 30;
    if (near && turn[c] !== 0) l |= turn[c] > 0 ? kit.LAMPS.RIGHT : kit.LAMPS.LEFT;
    lamps[i] = l;
    kit.pose(i, X[i], Y[i], Z[i], H[i], pitch[i] + dynPitch[i], roll[i], odo[i], steer[i], l);
    // the body record only changes when the car moves (a standing car keeps last frame's record)
    if (sp > 0 || written[i] === 0 || bodyX[i] !== X[i] || bodyZ[i] !== Z[i] || bodyH[i] !== H[i]) {
      writeBody(i);
      bodyX[i] = X[i]; bodyZ[i] = Z[i]; bodyH[i] = H[i]; written[i] = 1;
    }
  }

  // Car i's body record: js/sj-actor-bodies.js writeVehicleBody, the same arithmetic in the same order, reading the pose
  // from this part's arrays (a call with ten numbers boxes them on the heap, every car, every frame). The pitch it takes
  // is the renderer's Euler X angle: the kit draws the car rotated by −pitch (positive pitch lifts the nose), so is this.
  function writeBody(i) {
    const body = bodies[i], profile = kit.crashProfile(type[i]);
    const x = X[i], y = Y[i], z = Z[i], headingY = H[i], pitchE = -pitch[i], rollE = roll[i];
    const sp = Math.sin(pitchE), cp = Math.cos(pitchE), sr = Math.sin(rollE), cr = Math.cos(rollE);
    const cpcr = cp * cr, spcr = sp * cr;
    const acpsr = Math.abs(cp * sr), acpcr = Math.abs(cpcr), asp = Math.abs(sp);
    const acr = Math.abs(cr), asr = Math.abs(sr), aspsr = Math.abs(sp * sr), aspcr = Math.abs(spcr), acp = Math.abs(cp);
    let min = Infinity, max = -Infinity;
    for (let k = 0; k < profile.length; k++) {
      const s = profile[k];
      const cy = (s.minY + s.maxY) / 2, hy = (s.maxY - s.minY) / 2;
      const ly = cpcr * cy - sp * s.z;
      const ry = acpsr * s.halfWidthMetres + acpcr * hy + asp * s.halfLengthMetres;
      min = Math.min(min, ly - ry); max = Math.max(max, ly + ry);
    }
    const upright = acpcr > 0.01;
    const anchor = upright ? min / cpcr : 0;
    const ox = -sr * anchor, oz = spcr * anchor;
    const sin = Math.sin(headingY), cos = Math.cos(headingY);
    body.x = x + cos * ox + sin * oz; body.z = z - sin * ox + cos * oz;
    body.headingY = headingY; body.minY = y + min; body.maxY = y + max;
    body.velocityX = VX[i]; body.velocityZ = VZ[i]; body.kind = 'vehicle';
    body.crashPitch = upright ? pitchE : 0; body.crashRoll = upright ? rollE : 0;
    const parts = body.crashProfile;
    body.halfWidthMetres = body.halfLengthMetres = 0;
    for (let k = 0; k < profile.length; k++) {
      const s = profile[k], cy = (s.minY + s.maxY) / 2, hy = (s.maxY - s.minY) / 2;
      const lx = -sr * cy - ox, lz = spcr * cy + cp * s.z - oz;
      const rx = acr * s.halfWidthMetres + asr * hy;
      const rz = aspsr * s.halfWidthMetres + aspcr * hy + acp * s.halfLengthMetres;
      body.halfWidthMetres = Math.max(body.halfWidthMetres, Math.abs(lx) + rx);
      body.halfLengthMetres = Math.max(body.halfLengthMetres, Math.abs(lz) + rz);
      let part = parts[k];
      if (!part) part = parts[k] = { z: 0, halfWidthMetres: 0, halfLengthMetres: 0, minY: 0, maxY: 0 };
      part.z = upright ? s.z : lz;
      part.halfWidthMetres = upright ? s.halfWidthMetres : Math.abs(lx) + rx;
      part.halfLengthMetres = upright ? s.halfLengthMetres : rz;
      if (upright) { part.minY = s.minY - anchor; part.maxY = s.maxY - anchor; }
      else {
        const ly = cpcr * cy - sp * s.z;
        const ry = acpsr * s.halfWidthMetres + acpcr * hy + asp * s.halfLengthMetres;
        part.minY = ly - ry - min; part.maxY = ly + ry - min;
      }
    }
    if (parts.length !== profile.length) parts.length = profile.length;
  }

  // ---- Population
  const cam = { valid: false, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, cos: 0.5 };
  function readCamera(camera) {
    if (!camera?.matrixWorld) { cam.valid = false; return; }
    const e = camera.matrixWorld.elements;
    cam.x = e[12]; cam.y = e[13]; cam.z = e[14];
    const l = Math.hypot(e[8], e[9], e[10]) || 1;
    cam.fx = -e[8] / l; cam.fy = -e[9] / l; cam.fz = -e[10] / l;
    const fov = ((camera.fov ?? 60) * Math.PI) / 180, aspect = Math.max(1, camera.aspect ?? 1);
    cam.cos = Math.cos(Math.min(1.45, Math.atan(Math.tan(fov / 2) * len2(1, aspect)) + 0.2));
    // a camera far from the rider (a teleport this frame) says nothing about what the rider will see
    const r = context.rider;
    cam.valid = !r.valid || len2(cam.x - r.x, cam.z - r.z) < 40;
  }
  const rayOrigin = { x: 0, y: 0, z: 0 }, rayDir = { x: 0, y: 0, z: 0 };
  let raysLeft = 0;
  // Could the rider see a car at (x, y, z)? Out of range, out of view or behind a solid counts as unseen.
  function seen(x, y, z, reach = 3) {
    const r = context.rider;
    let ox, oy, oz, fx, fz, cos;
    if (cam.valid) { ox = cam.x; oy = cam.y; oz = cam.z; fx = cam.fx; fz = cam.fz; cos = cam.cos; }
    else if (r.valid) { ox = r.x - Math.sin(r.heading) * 5; oy = r.y + 2.5; oz = r.z - Math.cos(r.heading) * 5; fx = Math.sin(r.heading); fz = Math.cos(r.heading); cos = 0.35; }
    else return false;
    // aimed at the roof: a low ray grazes parked rows, posts and walls in front of a car that is plainly in view
    const dx = x - ox, dy = y + 1.6 - oy, dz = z - oz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > SEEN_FAR) return false;
    if (d < reach + 4) return true;
    const fy = cam.valid ? cam.fy : 0, fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    const dot = (dx * fx + (cam.valid ? dy * cam.fy : 0) + dz * fz) / (d * fl);
    if (dot < cos - reach / d) return false;
    // hidden only if the roof's centre and both its sides are behind something well short of the car (a car partly
    // round a corner is still in view)
    // A far car (beyond FAR_RAY) is looked at from its own side: a ray from SIGHT_SKIP m out from it back towards the
    // eye, SIGHT_FAR_LEN long (what hides a far car in these streets stands near it; the sampler's raycast costs, and
    // allocates, in proportion to its length). Something near the eye is then missed: the car stays, the safe side.
    const hl = Math.sqrt(dx * dx + dz * dz) || 1, sx = -dz / hl * 1.2, sz = dx / hl * 1.2;
    const far = d > FAR_RAY, skip = reach + SIGHT_SKIP;
    for (let k = 0; k < 3; k++) {
      if (raysLeft <= 0) return true;
      raysLeft--;
      const o = k === 0 ? 0 : k === 1 ? 1 : -1;
      const tx = x + sx * o, ty = y + 1.6, tz = z + sz * o; // the roof's centre or one side
      const ex = ox - tx, ey = oy - ty, ez = oz - tz, el = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
      let hit;
      if (far) {
        rayOrigin.x = tx + ex / el * skip; rayOrigin.y = ty + ey / el * skip; rayOrigin.z = tz + ez / el * skip;
        rayDir.x = ex; rayDir.y = ey; rayDir.z = ez;
        hit = world.sampler.raycast(rayOrigin, rayDir, SIGHT_FAR_LEN, true);
        if (hit === null) return true;
      } else {
        rayOrigin.x = ox; rayOrigin.y = oy; rayOrigin.z = oz;
        rayDir.x = -ex; rayDir.y = -ey; rayDir.z = -ez;
        hit = world.sampler.raycast(rayOrigin, rayDir, el, true);
        if (!(hit !== null && hit < el - skip)) return true;
      }
    }
    return false;
  }

  // Spawn candidates: slots inside the ring round the focus, with cumulative weights for this hour.
  const candidates = new Int32Array(G.slotPath.length), cumulative = new Float64Array(G.slotPath.length);
  let candidateCount = 0, candidateX = NaN, candidateZ = NaN, candidateHour = -1;
  function gatherCandidates() {
    const fx = context.focus.x, fz = context.focus.z;
    candidateCount = 0;
    let total = 0;
    for (let k = 0; k < G.slotPath.length; k++) {
      const w = G.slotW[k * 3 + hour];
      if (!(w > 0)) continue;
      const p = G.slotPath[k];
      A[AS] = G.slotS[k]; pathPoint(p, P);
      const d = len2(P.x - fx, P.z - fz);
      if (d < SPAWN_MIN || d > SPAWN_MAX) continue;
      total += w;
      candidates[candidateCount] = k; cumulative[candidateCount] = total; candidateCount++;
    }
    candidateX = fx; candidateZ = fz; candidateHour = hour;
  }
  function pickCandidate() {
    if (!candidateCount) return -1;
    const u = random() * cumulative[candidateCount - 1];
    let lo = 0, hi = candidateCount - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cumulative[m] < u) lo = m + 1; else hi = m; }
    return candidates[lo];
  }
  // Is lane p at position s free for a car of half length h?
  function slotFree(p, s, h) {
    const tw = twin[p];
    A[AS] = s; pathPoint(p, P);
    for (let j = 0; j < N; j++) {
      if (!alive[j]) continue;
      const q = route[j * 4];
      if (q === tw || (tw >= 0 && claimedInto(j, tw))) return false;
      if (claimedInto(j, p) && s < 4 * h + 8) return false;
      if (q === p && Math.abs(pos[j] - s) < h + half[j] + 7) return false;
      const dx = X[j] - P.x, dz = Z[j] - P.z;
      if (dx * dx + dz * dz < 36) return false;
    }
    return true;
  }
  // Long vehicles (pickups, vans) only on a lane of their network; elsewhere a car of the ordinary sizes.
  const SHORT_FLEET = FLEET.filter((row) => kit.types[VEHICLE_TYPE_INDEX[row.type]].length < LONG_VEHICLE);
  function chooseVehicle(i, longAllowed) {
    const table = longAllowed ? FLEET : SHORT_FLEET;
    const row = table[pickWeighted(table, 'moving', random())];
    const t = VEHICLE_TYPE_INDEX[row.type], spec = kit.types[t];
    const livery = Math.max(0, LIVERIES.indexOf(row.livery));
    const paint = row.livery === 'civil' ? pickWeighted(PAINTS, 'weight', random()) : 0;
    type[i] = t; half[i] = spec.length / 2; halfW[i] = spec.width / 2; axle[i] = spec.axle; height[i] = spec.height;
    offset[i] = spec.axleOffset ?? 0; track[i] = spec.track ?? 0.8; isLong[i] = spec.length >= LONG_VEHICLE ? 1 : 0;
    temper[i] = random();
    kit.assign(i, t, livery, paint);
  }
  function place(i, p, s) {
    alive[i] = 1; active++; written[i] = 0;
    route[i * 4] = p; prev[i] = -1; pos[i] = s; extendRoute(i, 1);
    claim[i * 2] = claim[i * 2 + 1] = -1;
    stopDone[i] = 0; stopHold[i] = 0; wait[i] = 0; stuck[i] = 0; progress[i] = odo[i]; bendCap[i] = 0; caused[i] = 0; forRider[i] = 0;
    riderBlock[i] = 0; hold[i] = 0; accel[i] = 0; yawRate[i] = 0; steer[i] = 0; dynPitch[i] = 0; pitchVel[i] = 0;
    const range = SPEEDS[CLASS_NAMES[cls[p]]] ?? SPEEDS.grid;
    speed[i] = ((range[0] + (range[1] - range[0]) * temper[i]) / 3.6) * 0.6;
    locate(i);
    counters.spawned++;
  }
  // Put car i somewhere in the ring, unseen if `hidden` (a few tries).
  function spawn(i, hidden, tries = 8) {
    const r = context.rider, clear = context.clear?.rider ?? 14;
    for (let t = 0; t < tries; t++) {
      const k = pickCandidate();
      if (k < 0) break;
      const p = G.slotPath[k], s = G.slotS[k];
      chooseVehicleDims(i);
      if (len[p] < 2 * half[i] + 2) continue;
      const sc = Math.max(half[i] + 0.5, Math.min(len[p] - half[i] - 0.5, s));
      A[AS] = sc; pathPoint(p, P);
      if (r.valid && len2(P.x - r.x, P.z - r.z) < clear + half[i]) continue;
      if (!slotFree(p, sc, half[i])) continue;
      if (hidden && seen(P.x, P.y, P.z)) continue;
      if (!arrivedClear(p, sc)) continue;
      chooseVehicle(i, longOk[p]);
      place(i, p, Math.max(half[i] + 0.5, Math.min(len[p] - half[i] - 0.5, s)));
      return true;
    }
    counters.spawnMisses++;
    return false;
  }
  // While a rider has not yet moved off the spot they were placed on, no car appears on a lane that leads to them.
  function arrivedClear(p, s) {
    if (S[STARTED]) return true;
    const o = start[p], ax = S[ARRIVE_X], az = S[ARRIVE_Z];
    for (let k = Math.max(0, Math.floor(s / step[p])); k < count[p]; k++) {
      const dx = SX[o + k] - ax, dz = SZ[o + k] - az;
      if (dx * dx + dz * dz < 25) return false;
    }
    const nx = outStart[p] < outStart[p + 1] ? target[outs[outStart[p]]] : -1; // and the lane straight after it
    if (nx >= 0) for (let k = 0; k < count[nx]; k++) {
      const dx = SX[start[nx] + k] - ax, dz = SZ[start[nx] + k] - az;
      if (dx * dx + dz * dz < 25) return false;
    }
    return true;
  }
  // sizes before the vehicle is chosen: the largest type, so a slot checked here fits whichever comes
  function chooseVehicleDims(i) { half[i] = 2.7; halfW[i] = 1; }
  function despawn(i) {
    if (!alive[i]) return;
    alive[i] = 0; active--;
    claim[i * 2] = claim[i * 2 + 1] = -1;
    route[i * 4] = -1;
    kit.hide(i);
  }
  function repopulate() {
    for (let i = 0; i < N; i++) despawn(i);
    gatherCandidates();
    raysLeft = 64;
    let placed = 0;
    for (let i = 0; i < N && placed < population; i++) {
      if (spawn(i, true, 10) || spawn(i, false, 10)) placed++;
    }
    A[DT] = 0;
    for (let i = 0; i < N; i++) if (alive[i]) pose(i);
  }
  function retargetPopulation() { population = Math.min(N, Math.round(N * HOUR_POPULATION[hour])); }
  retargetPopulation();

  function pushEvent(type, x, y, z) {
    if (eventCount >= eventPool.length) return;
    const e = eventPool[eventCount++];
    e.type = type; e.x = x; e.y = y; e.z = z;
  }

  return {
    lanes: G, // the lane graph, read-only for other parts (js/sj-life.js graphs)
    update(dt, camera) {
      readCamera(camera);
      if (!N) return;
      if (refocusPending) { refocusPending = false; repopulate(); }
      S[TIME] += dt;
      S[HORN_GAP_LEFT] = Math.max(0, S[HORN_GAP_LEFT] - dt);
      // the rider came off near a car: that car stays put for a moment
      const r = context.rider;
      if (r.valid && r.crashed && !riderWasCrashed) {
        for (let i = 0; i < N; i++) if (alive[i] && len2(X[i] - r.x, Z[i] - r.z) < half[i] + 3) hold[i] = HOLD_AFTER_HIT;
      }
      riderWasCrashed = r.valid && r.crashed;
      // the rider's acceleration, smoothed over about 0.1 s (reset when they appear, jump or crash)
      if (dt > 0) {
        if (r.valid && !r.crashed && S[RPOK] && (r.x - S[RPX]) ** 2 + (r.z - S[RPZ]) ** 2 < 9) {
          const k = Math.min(1, dt / 0.1);
          let ax = (r.vx - S[RPVX]) / dt, az = (r.vz - S[RPVZ]) / dt;
          const m = Math.sqrt(ax * ax + az * az);
          if (m > RIDER_ACCEL_MAX) { ax *= RIDER_ACCEL_MAX / m; az *= RIDER_ACCEL_MAX / m; }
          S[RAX] += (ax - S[RAX]) * k; S[RAZ] += (az - S[RAZ]) * k;
        } else { S[RAX] = 0; S[RAZ] = 0; }
        S[RPOK] = r.valid && !r.crashed ? 1 : 0; S[RPX] = r.x; S[RPZ] = r.z; S[RPVX] = r.vx; S[RPVZ] = r.vz;
      }
      if (!S[STARTED] && r.valid && (r.x - S[ARRIVE_X]) ** 2 + (r.z - S[ARRIVE_Z]) ** 2 > ARRIVED * ARRIVED) S[STARTED] = 1;
      if (dt > 0) {
        frameNo++;
        gatherPeople();
        for (let i = 0; i < N; i++) if (alive[i]) { A[DT] = Math.min(dt, 0.05); drive(i); }
      }
      for (let i = 0; i < N; i++) if (alive[i]) { A[DT] = dt; pose(i); }
      if (dt <= 0) return;
      // recycling: far, surplus or stuck cars leave unseen and come back in the ring
      const fx = context.focus.x, fz = context.focus.z;
      if (len2(fx - candidateX, fz - candidateZ) > 25 || candidateHour !== hour) gatherCandidates();
      raysLeft = SIGHT_RAYS; // the sampler's raycast allocates a little: a small budget per frame
      for (let n = 0; n < Math.min(N, 6); n++) {
        const i = rrRecycle = (rrRecycle + 1) % N;
        if (!alive[i]) continue;
        const d = len2(X[i] - fx, Z[i] - fz);
        const far = d > RETIRE, surplus = active > population && d > 60, stuckLong = stuck[i] > STUCK_RECYCLE;
        const forced = stuck[i] > STUCK_FORCE && (!r.valid || len2(X[i] - r.x, Z[i] - r.z) > 30);
        if (!(far || surplus || stuckLong || forced)) continue;
        if (!forced && S[TIME] < recheck[i]) continue;
        if (!forced && seen(X[i], Y[i], Z[i], half[i])) { recheck[i] = S[TIME] + SIGHT_RECHECK; continue; } // in view: look again in a while
        if (stuckLong || forced) {
          counters.unstuck++;
          // the last car taken away stuck: where and why (the refusal code of its last junction decision)
          const u = lastUnstuck; u.x = +X[i].toFixed(1); u.z = +Z[i].toFixed(1); u.reason = reason[i]; u.path = route[i * 4]; u.seen = !!forced;
        }
        { const q = lastRetire, dx = X[i] - cam.x, dz = Z[i] - cam.z; q.x = X[i]; q.z = Z[i]; q.camValid = cam.valid; q.far = far; q.surplus = surplus;
          q.camDist = Math.sqrt(dx * dx + dz * dz); q.dot = (dx * cam.fx + dz * cam.fz) / (q.camDist * (Math.sqrt(cam.fx * cam.fx + cam.fz * cam.fz) || 1)); q.cos = cam.cos; }
        despawn(i);
        counters.recycled++;
        if (active < population) { spawn(i, true, 4); if (alive[i]) { A[DT] = 0; pose(i); } }
      }
      // short of the target (after clearAround, a dense hour): fill in unseen, a couple per frame (never in view: on open
      // ground the street waits for a car to come round a corner or from behind)
      S[STARVED] = active < population ? S[STARVED] + dt : 0;
      if (S[TIME] >= S[NEXT_FILL]) for (let i = 0, tries = 0; i < N && active < population && tries < 2; i++) {
        if (alive[i]) continue;
        tries++;
        if (spawn(i, true, 3)) { A[DT] = 0; pose(i); } else S[NEXT_FILL] = S[TIME] + 0.25; // nothing out of sight: a moment
      }
    },
    publish(index) {
      for (let i = 0; i < N; i++) if (alive[i]) index.add(bodies[i]);
    },
    refocus() {
      refocusPending = true;
      // where the rider has just been placed (the spawn, a map arrival): no horn until they have moved off it
      const r = context.rider;
      S[ARRIVE_X] = r.valid ? r.x : context.focus.x; S[ARRIVE_Z] = r.valid ? r.z : context.focus.z; S[STARTED] = 0;
    },
    clearAround(x, z, radius) {
      for (let i = 0; i < N; i++) if (alive[i] && len2(X[i] - x, Z[i] - z) < radius + half[i] + 1) despawn(i);
    },
    setHour(name) {
      const h = HOUR_INDEX[name];
      if (h === undefined || h === hour) return;
      hour = h; retargetPopulation();
    },
    warm() {},
    /** Cars near a listener as reusable records {id, x, y, z, speed, acceleration, typeIndex, waitingForRider}; returns the count.
     *  `id` is the car's slot: the same for as long as that car lives; when it is recycled the slot later carries another car. */
    audible(out, x, z, radius) {
      let n = 0;
      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        const dx = X[i] - x, dz = Z[i] - z;
        if (dx * dx + dz * dz > radius * radius) continue;
        const rec = out[n] || (out[n] = { id: 0, x: 0, y: 0, z: 0, speed: 0, acceleration: 0, typeIndex: 0, waitingForRider: false });
        rec.id = i; rec.x = X[i]; rec.y = Y[i]; rec.z = Z[i]; rec.speed = speed[i]; rec.acceleration = accel[i]; rec.typeIndex = type[i];
        rec.waitingForRider = forRider[i] === 1 && speed[i] < 0.4;
        n++;
      }
      return n;
    },
    /** One-shot events since the last call ({type: 'horn', x, y, z}); records are reused: read them at once. */
    drainEvents(out) {
      out.length = 0;
      for (let k = 0; k < eventCount; k++) out.push(eventPool[k]);
      const n = eventCount;
      eventCount = 0;
      return n;
    },
    stats() {
      let waiting = 0, maxStuck = 0;
      for (let i = 0; i < N; i++) if (alive[i]) { if (speed[i] < 0.2) waiting++; maxStuck = Math.max(maxStuck, stuck[i]); }
      return { active, capacity: N, target: population, waiting, maxStuck: +maxStuck.toFixed(1), ...counters, lastUnstuck, lastRetire, graph: G.stats };
    },
    dispose() { for (let i = 0; i < N; i++) despawn(i); },
    // read-only views for checks
    // read-only views for checks, and `place` to put a given vehicle on a lane (checks only, never game code)
    inspect: () => ({ G, N, reason, alive, route, prev, hold, pos, speed, accel, X, Y, Z, H, pitch, roll, VX, VZ, type, axle, offset, track,
      isLong, half, halfW, height, claim, wait, stuck, forRider, odo, bodies,
      place(i, p, s, typeIndex, v = 0) {
        despawn(i);
        const spec = kit.types[typeIndex];
        type[i] = typeIndex; half[i] = spec.length / 2; halfW[i] = spec.width / 2; axle[i] = spec.axle; height[i] = spec.height;
        offset[i] = spec.axleOffset ?? 0; track[i] = spec.track ?? 0.8; isLong[i] = spec.length >= LONG_VEHICLE ? 1 : 0; temper[i] = 0.5;
        kit.assign(i, typeIndex, 0, 0);
        place(i, p, s); speed[i] = v; A[DT] = 0; pose(i);
      } }),
  };
}
