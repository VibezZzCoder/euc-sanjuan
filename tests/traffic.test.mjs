/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Moving traffic (js/sj-traffic.js, js/sj-traffic-graph.js) on the real world, headless, with a stand-in vehicle kit.
// The lane graph against the built world, then a few simulated minutes of the full population and its manners.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three/webgpu') return { url: new URL('../vendor/three/build/three.webgpu.js', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
globalThis.fetch = async (url) => { const b = readFileSync(url); return { ok: true, json: async () => JSON.parse(b), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadCity } = await import('../js/sj-world.js');
const sides = await import('../js/sj-street-sides.js');
const { createTraffic } = await import('../js/sj-traffic.js');
const { NO_CARS } = await import('../js/sj-traffic-data.js');
const { seededRandom } = await import('../js/sj-life-random.js');
const { createActorBodyIndex } = await import('../js/sj-actor-bodies.js');
const { overlaps } = await import('../js/euc-dynamic.js');
const { VEHICLE_TYPES, LAMPS } = await import('../js/sj-vehicle-types.js');
const { writeVehicleBody } = await import('../js/sj-actor-bodies.js');
const { createEucDynamicWorld } = await import('../js/euc-dynamic.js');
const { LONG_VEHICLE } = await import('../js/sj-traffic-graph.js');
const { stairFlightRecords } = await import('../js/sj-stairs.js');
const world = await loadCity();

const DT = 1 / 30;
function makeContext({ cars = 40, focus = [-2, 9], hour = 'golden' } = {}) {
  // three slices along the body (bonnet, cabin, tail) like the kit's, so pitch shows in the crash contact
  const profiles = VEHICLE_TYPES.map((t) => [-1, 0, 1].map((k) => ({ z: k * t.length / 3, halfLengthMetres: t.length / 6,
    halfWidthMetres: t.width / 2, minY: 0, maxY: k === 0 ? t.height : t.height * 0.7 })));
  const kit = { types: VEHICLE_TYPES, capacity: cars, LAMPS, posed: 0, assign() {}, pose() { this.posed++; }, hide() {}, commit() {},
    warm() {}, stats: () => ({}), dispose() {}, crashProfile: (t) => profiles[t] };
  return { world, kit, sides, caps: { cars, people: 0 }, random: seededRandom, bodies: createActorBodyIndex(16), clear: { rider: 14 },
    rider: { valid: false, x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0, crashed: false, minY: 0, maxY: 0, halfWidth: 0.35, halfLength: 0.5 },
    focus: { x: focus[0], z: focus[1], serial: 1 }, hour: { name: hour, night: hour === 'blue' ? 1 : 0 } };
}
function frame(traffic, context, extra = null) {
  traffic.update(DT, null);
  context.bodies.begin();
  traffic.publish(context.bodies);
  if (extra) context.bodies.add(extra);
  context.bodies.commit();
}
const upright = (b) => ({ x: b.x, z: b.z, headingY: b.headingY, halfWidthMetres: b.halfWidthMetres, halfLengthMetres: b.halfLengthMetres, minY: b.minY, maxY: b.maxY });

const context = makeContext();
const traffic = await createTraffic(context);
const view = traffic.inspect();
const G = view.G;

test('every lane runs the way its road allows', () => {
  let checked = 0;
  for (let p = 0; p < G.lanes; p++) {
    const road = world.city.roads[G.road[p]];
    if (road.oneway !== 'yes' && road.oneway !== '-1') continue;
    const o = G.start[p] + (G.count[p] >> 1), x = G.SX[o], z = G.SZ[o];
    // the nearest segment of the mapped road: the lane's tangent must run along its point order (against for -1)
    let best = Infinity, dot = 0;
    for (let k = 1; k < road.points.length; k++) {
      const [ax, az] = road.points[k - 1], [bx, bz] = road.points[k], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const f = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + dx * f - x, az + dz * f - z);
      if (d < best) { best = d; dot = (G.STX[o] * dx + G.STZ[o] * dz) / Math.sqrt(l2); }
    }
    assert.ok(best < 4, `lane ${p} lies ${best.toFixed(2)} m off its road`);
    assert.ok(road.oneway === 'yes' ? dot > 0.5 : dot < -0.5, `lane ${p} on road ${G.road[p]} runs against its one-way`);
    checked++;
  }
  assert.ok(checked > 100, `one-way lanes checked: ${checked}`);
});

test('no lane or turn in the sea, a closed place, a foot street, on stairs or through a solid', () => {
  const flights = stairFlightRecords();
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0.95, halfLengthMetres: 1.6, minY: 0, maxY: 0, floorPlane: { x: 0, y: 0, z: 0, dx: 0, dz: 0 }, floorY: 0 };
  let samples = 0;
  for (let p = 0; p < G.P; p++) {
    const road = world.city.roads[G.road[p]];
    assert.ok(sides.DRIVE_KINDS.has(road.kind) && !NO_CARS.has(Number(road.id)), `path ${p} on road ${G.road[p]} (${road.kind})`);
    for (let k = 0; k < G.count[p]; k++) {
      const o = G.start[p] + k, x = G.SX[o], z = G.SZ[o], y = G.SY[o];
      assert.ok(world.isDry(x, z), `path ${p} wet at ${x.toFixed(1)},${z.toFixed(1)}`);
      assert.ok(!world.sampler.offLimitsAt(x, z, y + 0.5), `path ${p} on closed ground at ${x.toFixed(1)},${z.toFixed(1)}`);
      for (const f of flights) {
        const dx = x - f.ox, dz = z - f.oz, u = dx * f.cx + dz * f.cz, s = dx * f.ex + dz * f.ez;
        assert.ok(!(u > f.u0 && u < f.u1 && s > f.footS && s < f.topS), `path ${p} on a stair at ${x.toFixed(1)},${z.toFixed(1)}`);
      }
      // the builder's own sweep, seen independently: lanes in 3 m boxes, turns in 1.2 m boxes, the widest vehicle
      const lane = G.kind[p] === 0;
      if (lane && k % 3 && k !== G.count[p] - 1) continue;
      body.halfLengthMetres = lane ? 1.55 : 0.6;
      const j = Math.min(G.count[p] - 1, k + 1), i = Math.max(0, k - 1), grade = j > i ? (G.SY[G.start[p] + j] - G.SY[G.start[p] + i]) / ((j - i) * G.step[p]) : 0;
      body.x = x; body.z = z; body.headingY = Math.atan2(G.STX[o], G.STZ[o]); body.floorY = y; body.minY = y + 0.3; body.maxY = y + 1.9;
      Object.assign(body.floorPlane, { x, z, y, dx: grade * G.STX[o], dz: grade * G.STZ[o] });
      assert.ok(world.sampler.isVolumeClear(body), `path ${p} blocked by a solid at ${x.toFixed(1)},${z.toFixed(1)}`);
      samples++;
    }
  }
  assert.ok(samples > 3000);
});

test('the lane graph is one strongly connected component', () => {
  const lanesOut = (p) => { const out = []; for (let k = G.outStart[p]; k < G.outStart[p + 1]; k++) out.push(G.target[G.outs[k]]); return out; };
  const lanesIn = Array.from({ length: G.lanes }, () => []);
  for (let p = 0; p < G.lanes; p++) for (const q of lanesOut(p)) lanesIn[q].push(p);
  for (const next of [lanesOut, (p) => lanesIn[p]]) {
    const seen = new Uint8Array(G.lanes), stack = [0];
    seen[0] = 1;
    while (stack.length) for (const q of next(stack.pop())) if (!seen[q]) { seen[q] = 1; stack.push(q); }
    assert.equal(seen.reduce((a, b) => a + b, 0), G.lanes);
  }
  assert.ok(G.stats.laneKm > 12, `lane km ${G.stats.laneKm}`);
  // Calle del Sol keeps its through traffic (its long westbound way, end to end)
  let sol = 0;
  for (let p = 0; p < G.lanes; p++) if (world.city.roads[G.road[p]].name === 'Calle del Sol') sol += G.len[p];
  assert.ok(sol > 500, `Calle del Sol: ${sol.toFixed(0)} m of lane`);
  // the long vehicles' lanes are one strongly connected set too
  const longOut = (p) => { const out = []; for (let k = G.outStart[p]; k < G.outStart[p + 1]; k++) if (G.longOk[G.outs[k]]) out.push(G.target[G.outs[k]]); return out; };
  const longLanes = []; for (let p = 0; p < G.lanes; p++) if (G.longOk[p]) longLanes.push(p);
  const seen = new Set([longLanes[0]]), stack = [longLanes[0]];
  while (stack.length) for (const q of longOut(stack.pop())) { assert.ok(G.longOk[q]); if (!seen.has(q)) { seen.add(q); stack.push(q); } }
  assert.equal(seen.size, longLanes.length);
});

test('the full population runs for minutes: no car inside another, none off its lane, none stuck', () => {
  traffic.refocus();
  let worstOff = 0, overlapsSeen = 0, longOff = 0, inSolid = 0, sunk = 0, checked = 0;
  const probe = { normal: {} };
  const point = { x: 0, z: 0 };
  for (let f = 0; f < 150 / DT; f++) {
    // the focus tours the old town, the waterfront and back
    const t = f * DT;
    context.focus.x = t < 50 ? -2 : t < 100 ? 300 : 505;
    context.focus.z = t < 50 ? 9 : t < 100 ? 215 : -75;
    frame(traffic, context);
    if (f % 6) continue;
    for (let i = 0; i < view.N; i++) {
      if (!view.alive[i]) continue;
      const p = view.route[i * 4];
      const s = view.pos[i], k = Math.min(G.count[p] - 1, Math.round(s / G.step[p])), o = G.start[p] + k;
      point.x = G.SX[o]; point.z = G.SZ[o];
      worstOff = Math.max(worstOff, Math.hypot(view.X[i] - point.x, view.Z[i] - point.z));
      for (let j = i + 1; j < view.N; j++) if (view.alive[j] && overlaps(upright(view.bodies[i]), view.bodies[j], -0.05)) overlapsSeen++;
      // long vehicles only where they fit; the posed body (its own size) clear of buildings, walls and parked cars;
      // every tyre on the ground
      if (view.isLong[i] && !G.longOk[p]) longOff++;
      if (f % 30 === 0) {
        checked++;
        const t = VEHICLE_TYPES[view.type[i]], tp = Math.tan(view.pitch[i]), fx = Math.sin(view.H[i]), fz = Math.cos(view.H[i]);
        const box = { x: view.X[i], z: view.Z[i], headingY: view.H[i], halfWidthMetres: t.width / 2 - 0.02, halfLengthMetres: t.length / 2 - 0.05,
          minY: view.Y[i] + 0.3, maxY: view.Y[i] + t.height - 0.05, floorY: view.Y[i],
          floorPlane: { x: view.X[i], z: view.Z[i], y: view.Y[i], dx: tp * fx, dz: tp * fz } };
        if (!world.sampler.isVolumeClear(box)) inSolid++;
        const tr = Math.tan(view.roll[i]);
        for (const sf of [1, -1]) for (const sl of [1, -1]) {
          const a = t.axleOffset + sf * t.axle, b = sl * t.track; // along, and to the left
          const x = view.X[i] + fx * a + fz * b, z = view.Z[i] + fz * a - fx * b;
          const y = view.Y[i] + a * tp + b * tr, g = world.sampler.sampleGround(x, z, probe, y + 0.5).height;
          if (g - y > 0.18) sunk++; // (narrow raised island tips at Plaza del Inmigrante reach 15 cm under one tyre)
        }
      }
    }
  }
  const stats = traffic.stats();
  assert.equal(overlapsSeen, 0, 'cars overlapped');
  assert.equal(longOff, 0, 'a long vehicle left the lanes that hold it');
  assert.ok(checked > 1000 && inSolid === 0, `posed bodies inside a solid: ${inSolid} of ${checked}`);
  assert.equal(sunk, 0, 'a tyre more than 18 cm under the ground');
  assert.ok(worstOff < 0.9, `a car ${worstOff.toFixed(2)} m off its lane`);
  assert.equal(stats.active, stats.target);
  assert.ok(stats.maxStuck < 45 && stats.unstuck === 0, `stuck: ${JSON.stringify(stats)}`);
});

// A car on a clear lane, and a point `ahead` metres in front of it along its way.
function carAhead(ahead) {
  for (let i = 0; i < view.N; i++) {
    if (!view.alive[i] || view.speed[i] < 2) continue;
    if (Math.hypot(view.X[i] - context.focus.x, view.Z[i] - context.focus.z) > 110) continue; // stays in the ring
    const p = view.route[i * 4];
    if (G.kind[p] !== 0 || G.len[p] - view.pos[i] < ahead + 12) continue;
    const s = view.pos[i] + ahead, o = G.start[p] + Math.round(s / G.step[p]);
    // nothing else there yet: the spot is clear of every car by 8 m
    let clear = true;
    for (let j = 0; j < view.N; j++) if (view.alive[j] && j !== i && Math.hypot(view.X[j] - G.SX[o], view.Z[j] - G.SZ[o]) < 8) clear = false;
    if (!clear) continue;
    return { i, x: G.SX[o], y: G.SY[o], z: G.SZ[o], heading: Math.atan2(G.STX[o], G.STZ[o]) };
  }
  return null;
}

test('cars stop for a person in the lane and do not touch them', () => {
  let spot = carAhead(25);
  for (let f = 0; f < 20 / DT && !spot; f++) { frame(traffic, context); spot = carAhead(25); }
  assert.ok(spot, 'a moving car on a long lane');
  const person = { x: spot.x, z: spot.z, headingY: 0, halfWidthMetres: 0.3, halfLengthMetres: 0.3, minY: spot.y, maxY: spot.y + 1.75,
    velocityX: 0, velocityZ: 0, kind: 'person' };
  let closest = Infinity;
  for (let f = 0; f < 15 / DT; f++) {
    frame(traffic, context, person);
    for (let i = 0; i < view.N; i++) if (view.alive[i]) {
      assert.ok(!overlaps(upright(view.bodies[i]), person, 0), 'a car touched the person');
      if (i === spot.i) closest = Math.min(closest, Math.hypot(view.X[i] - person.x, view.Z[i] - person.z));
    }
  }
  assert.ok(view.speed[spot.i] < 0.3, `the car still moves at ${view.speed[spot.i]}`);
  assert.ok(closest < 9, `the car stopped ${closest.toFixed(1)} m away`);
});

test('cars stop for the rider ahead, wait, and sound one horn after a while', () => {
  for (let f = 0; f < 3 / DT; f++) frame(traffic, context); // let the person go
  const spot = carAhead(22);
  assert.ok(spot, 'a moving car on a long lane');
  const r = context.rider;
  Object.assign(r, { valid: true, x: spot.x, z: spot.z, y: spot.y, minY: spot.y, maxY: spot.y + 1.9, heading: spot.heading, speed: 0, vx: 0, vz: 0 });
  const rider = { x: r.x, z: r.z, headingY: r.heading, halfWidthMetres: r.halfWidth, halfLengthMetres: r.halfLength, minY: r.minY, maxY: r.maxY };
  const out = [];
  let horns = 0, firstHorn = -1;
  traffic.drainEvents(out);
  for (let f = 0; f < 30 / DT; f++) {
    frame(traffic, context);
    for (let i = 0; i < view.N; i++) if (view.alive[i]) assert.ok(!overlaps(rider, view.bodies[i], 0), 'a car pushed into the rider');
    const n = traffic.drainEvents(out);
    for (let k = 0; k < n; k++) if (out[k].type === 'horn') { horns++; if (firstHorn < 0) firstHorn = f * DT; }
  }
  assert.ok(view.speed[spot.i] < 0.3 && view.forRider[spot.i] === 1, 'the car waits for the rider');
  assert.equal(horns, 1, `horns in 30 s: ${horns}`);
  assert.ok(firstHorn > 4, `horn after ${firstHorn.toFixed(1)} s`);
  r.valid = false;
});

test('a rider parked across a junction: nobody touches them, and the corner clears after they leave', () => {
  // the turn with most cars heading for it, within 150 m of the focus: the rider stops in the middle of it
  let best = null;
  for (let c = G.lanes; c < G.P; c++) {
    const o = G.start[c] + (G.count[c] >> 1), x = G.SX[o], z = G.SZ[o];
    if (Math.hypot(x - context.focus.x, z - context.focus.z) > 150) continue;
    let cars = 0;
    for (let i = 0; i < view.N; i++) if (view.alive[i] && view.route[i * 4] === G.source[c] && view.route[i * 4 + 1] === c) cars++;
    if (!best || cars > best.cars) best = { x, z, y: G.SY[o], cars };
  }
  assert.ok(best && best.cars > 0, 'a turn with cars heading for it');
  const r = context.rider;
  Object.assign(r, { valid: true, x: best.x, z: best.z, y: best.y, minY: best.y, maxY: best.y + 1.9, heading: 0.7, speed: 0, vx: 0, vz: 0 });
  const rider = { x: r.x, z: r.z, headingY: r.heading, halfWidthMetres: r.halfWidth, halfLengthMetres: r.halfLength, minY: r.minY, maxY: r.maxY };
  const before = traffic.stats().unstuck;
  let waited = 0;
  for (let f = 0; f < 40 / DT; f++) {
    frame(traffic, context);
    for (let i = 0; i < view.N; i++) if (view.alive[i]) {
      assert.ok(!overlaps(rider, view.bodies[i], 0), 'a car drove into the parked rider');
      if (view.forRider[i] && view.speed[i] < 0.3) waited++;
    }
  }
  assert.ok(waited > 0, 'some car came to the junction and waited for the rider');
  r.valid = false;
  for (let f = 0; f < 50 / DT; f++) frame(traffic, context);
  const stats = traffic.stats();
  assert.ok(stats.maxStuck < 45 && stats.unstuck === before, `after the rider left: ${JSON.stringify({ maxStuck: stats.maxStuck, unstuck: stats.unstuck, last: stats.lastUnstuck, rider: [r.x, r.z] })}`);
});

// ---- The rider around a moving car: compared with the same city without the rider (same seed, same frames).
async function pairedCity(focus) {
  const a = makeContext({ focus }), b = makeContext({ focus });
  const ta = await createTraffic(a), tb = await createTraffic(b);
  ta.refocus(); tb.refocus();
  const va = ta.inspect(), vb = tb.inspect();
  for (let f = 0; f < 20 / DT; f++) {
    frame(ta, a); frame(tb, b);
    if (process.env.TRAFFIC_DEBUG) for (let i = 0; i < va.N; i++) if (va.X[i] !== vb.X[i] || va.alive[i] !== vb.alive[i]) { console.log('PAIR DIVERGED frame', f, 'car', i, va.alive[i], vb.alive[i]); f = 1e9; break; }
  }
  return { a, b, ta, tb, va, vb };
}
// A car on a long free lane: no car within 70 m ahead, at least 75 m to its line, moving, well inside the ring of life
// (a car out at its edge may be recycled in one city and not in the other).
function freeCar(v, focus, minSpeed = 3) {
  const G = v.G;
  for (let i = 0; i < v.N; i++) {
    if (!v.alive[i] || v.speed[i] < minSpeed || Math.hypot(v.X[i] - focus.x, v.Z[i] - focus.z) > 110) continue;
    const p = v.route[i * 4];
    if (G.kind[p] !== 0 || G.len[p] - v.pos[i] < 75) continue;
    let clear = true;
    for (let j = 0; j < v.N; j++) if (j !== i && v.alive[j] && v.route[j * 4] === p && v.pos[j] > v.pos[i] && v.pos[j] - v.pos[i] < 70) clear = false;
    if (clear) return i;
  }
  return -1;
}
// Step both cities until one has a free car (at most 30 s).
function waitForFreeCar(pc, minSpeed = 3) {
  let i = freeCar(pc.vb, pc.b.focus, minSpeed);
  for (let f = 0; f < 30 / DT && i < 0; f++) { frame(pc.ta, pc.a); frame(pc.tb, pc.b); i = freeCar(pc.vb, pc.b.focus, minSpeed); }
  return i;
}
// Run `seconds` with the rider placed every frame in car i's frame: along (centre to centre, + ahead), lateral (+ right).
function riderAround(world, pc, i, seconds, motion) {
  const { a, b, ta, tb, va, vb } = pc, r = b.rider;
  const trace = [];
  let along = 0, lateral = 0, vAlong = 0, vLat = 0, touched = 0;
  for (let f = 0; f < seconds / DT; f++) {
    const t = f * DT, v = vb.speed[i];
    ({ along, lateral, vAlong, vLat } = motion(t, v, vb.half[i], { along, lateral }));
    const fx = Math.sin(vb.H[i]), fz = Math.cos(vb.H[i]);
    const x = vb.X[i] + fx * along - fz * lateral, z = vb.Z[i] + fz * along + fx * lateral;
    Object.assign(r, { valid: true, x, z, y: vb.Y[i], minY: vb.Y[i], maxY: vb.Y[i] + 1.9, heading: vb.H[i],
      vx: fx * vAlong - fz * vLat, vz: fz * vAlong + fx * vLat, speed: Math.hypot(vAlong, vLat) });
    const rb = { x, z, headingY: vb.H[i], halfWidthMetres: r.halfWidth, halfLengthMetres: r.halfLength, minY: r.minY, maxY: r.maxY };
    frame(ta, a); frame(tb, b);
    if (overlaps(rb, vb.bodies[i], 0)) touched++;
    trace.push([va.speed[i], vb.speed[i], lateral]);
  }
  r.valid = false;
  return { trace, touched };
}

test('a rider behind or beside a moving car does not brake it (following, closing in, overtaking, a lane away)', async () => {
  const cases = {
    'matching its speed 3 m behind': (t, v, h) => ({ along: -(h + 0.5 + 3), lateral: 0, vAlong: v, vLat: 0 }),
    'closing from 18 m behind': (t, v, h, s) => {
      const along = t === 0 ? -(h + 0.5 + 18) : Math.min(-(h + 1.1), s.along + (v + 4) * DT);
      return { along, lateral: 0, vAlong: along > -(h + 1.2) ? v : v + 4, vLat: 0 };
    },
    'overtaking on the left': (t, v, h, s) => ({ along: t === 0 ? -10 : Math.min(12, s.along + 3 * DT), lateral: -2.7, vAlong: v + 3, vLat: 0 }),
    'overtaking on the right': (t, v, h, s) => ({ along: t === 0 ? -10 : Math.min(12, s.along + 3 * DT), lateral: 2.7, vAlong: v + 3, vLat: 0 }),
    'riding alongside a lane away': () => ({ along: 0, lateral: 3, vAlong: 0, vLat: 0 }),
  };
  for (const [name, motion] of Object.entries(cases)) {
    const pc = await pairedCity([150, -290]); // a fresh pair each time: the rider changes the city around it
    const i = waitForFreeCar(pc);
    assert.ok(i >= 0, 'a free moving car');
    const { trace } = riderAround(world, pc, i, 5, (t, v, h, s) => {
      const m = motion(t, v, h, s);
      if (name === 'riding alongside a lane away') m.vAlong = v;
      return m;
    });
    let worst = 0;
    for (const [sa, sb] of trace) worst = Math.max(worst, Math.abs(sa - sb));
    if (worst >= 0.05 && process.env.TRAFFIC_DEBUG) console.log('CASE', name, 'car', i, 'reason', pc.vb.reason[i], 'forRider', pc.vb.forRider[i], 'route', [...pc.vb.route.slice(i * 4, i * 4 + 4)], 'pos', pc.vb.pos[i].toFixed(1), trace.filter((q, k) => k % 10 === 0).map((q) => q.map((v) => v.toFixed(2)).join('/')).join(' '), 'A route', [...pc.va.route.slice(i * 4, i * 4 + 4)], pc.va.pos[i].toFixed(1));
    if (worst >= 0.05) console.log('CASE', name, 'car', i, 'path', pc.vb.route[i * 4], 'reason', pc.vb.reason[i], 'forRider', pc.vb.forRider[i], trace.filter((q, k) => k % 15 === 0).map((q) => q.map((v) => v.toFixed(2)).join('/')).join(' '));
    assert.ok(worst < 0.05, `${name}: the car's speed differs by ${worst.toFixed(2)} m/s from the same city without the rider`);
  }
});

test('a rider cutting in ahead: the car eases off in time, does not freeze, does not touch them', async () => {
  const pc = await pairedCity([150, -290]);
  const i = waitForFreeCar(pc);
  assert.ok(i >= 0, 'a free moving car');
  const lateralLimit = pc.vb.halfW[i] + 0.35 * 0.9 + 0.35;
  const { trace, touched } = riderAround(world, pc, i, 6, (t, v, h, s) => {
    const lateral = t < 0.5 ? 2.8 : Math.max(0, (t === 0 ? 2.8 : s.lateral) - 1.6 * DT);
    return { along: t === 0 ? h + 9 : s.along + (v - (lateral > 0 ? v : v - 2.5)) * DT, lateral, vAlong: lateral > 0 ? v : v - 2.5, vLat: lateral > 0 && t >= 0.5 ? -1.6 : 0 };
  });
  assert.equal(touched, 0, 'the car touched the rider');
  let worstDecel = 0, slowed = 0;
  for (let k = 1; k < trace.length; k++) {
    const [, vb, lat] = trace[k];
    if (lat > lateralLimit) worstDecel = Math.max(worstDecel, (trace[k - 1][1] - vb) / DT);
    slowed = Math.max(slowed, trace[k][0] - vb);
  }
  assert.ok(worstDecel <= 5.2, `before the rider is in its way the car brakes at ${worstDecel.toFixed(1)} m/s²`);
  assert.ok(slowed > 0.5, `the car slowed for the cut-in (by ${slowed.toFixed(2)} m/s)`);
  // no stop from speed within a few frames (the earlier freeze: 20 km/h to zero in 0.13 s)
  for (let k = 5; k < trace.length; k++) assert.ok(!(trace[k - 5][1] > 3 && trace[k][1] < 0.5), 'the car froze');
});

// The rider sets off at right angles across the lane from 3.4 m beside it, 5.1 m ahead of the centre of a car coming on
// (Norzagaray, both flanks): fixed in the street, accelerating at 6.5 m/s² to 6 m/s, as a rider does from a standstill.
function perpendicularEntry(pc, i, flank) {
  const { a, b, ta, tb, va, vb } = pc, r = b.rider;
  const fx = Math.sin(vb.H[i]), fz = Math.cos(vb.H[i]), x0 = vb.X[i], z0 = vb.Z[i], v0 = vb.speed[i];
  const out = { v0, vMax: v0, vAtLane: null, contact: null, trace: [] };
  const lateralLimit = vb.halfW[i] + 0.35 * 0.9 + 0.35;
  let lat = 3.4 * flank, vLat = 0;
  for (let f = 0; f < 3 / DT; f++) {
    const t = f * DT, acc = t < 0.1 ? 65 * t : 6.5;
    vLat = Math.min(6, vLat + acc * DT); lat -= flank * vLat * DT;
    const x = x0 + fx * 5.1 - fz * lat, z = z0 + fz * 5.1 + fx * lat, hd = vb.H[i] + flank * Math.PI / 2; // facing across the lane, the way they go
    Object.assign(r, { valid: true, x, z, y: vb.Y[i], minY: vb.Y[i], maxY: vb.Y[i] + 1.9, heading: hd,
      vx: fz * vLat * flank, vz: -fx * vLat * flank, speed: vLat });
    const rb = { x, z, headingY: hd, halfWidthMetres: r.halfWidth, halfLengthMetres: r.halfLength, minY: r.minY, maxY: r.maxY };
    frame(ta, a); frame(tb, b);
    const ex = x - vb.X[i], ez = z - vb.Z[i], l = -ex * Math.cos(vb.H[i]) + ez * Math.sin(vb.H[i]);
    if (out.contact === null) out.vMax = Math.max(out.vMax, vb.speed[i]); // from the first frame: poised at the edge
    if (out.vAtLane === null && Math.abs(l) < lateralLimit) out.vAtLane = vb.speed[i];
    if (out.contact === null && overlaps(rb, vb.bodies[i], 0)) out.contact = { t: +t.toFixed(2), carSpeed: vb.speed[i], relative: Math.hypot(vLat, vb.speed[i]) };
    if (f % 6 === 0) out.trace.push([+t.toFixed(2), +vb.speed[i].toFixed(2), +l.toFixed(2)]);
  }
  r.valid = false;
  return out;
}

test('a rider setting off across the lane close ahead of a car: it brakes at once, never speeds up into them', async () => {
  for (const flank of [1, -1]) {
    const pc = await pairedCity([150, -290]);
    const i = waitForFreeCar(pc, 4.5);
    assert.ok(i >= 0, 'a free moving car');
    const o = perpendicularEntry(pc, i, flank);
    if (process.env.TRAFFIC_DEBUG) console.log('PERP', flank, JSON.stringify(o));
    const side = flank > 0 ? 'left' : 'right';
    assert.ok(o.vMax <= o.v0 + 0.05, `${side}: the car sped up from ${o.v0.toFixed(2)} to ${o.vMax.toFixed(2)} m/s`);
    assert.ok(o.vAtLane !== null && o.vAtLane <= o.v0 - 1.5, `${side}: ${o.vAtLane?.toFixed(2)} m/s from ${o.v0.toFixed(2)} as the rider reached the lane`);
  }
});

test('a rider standing on a junction\'s way out keeps the cars at the line, outside the junction', () => {
  // the turn with most cars heading for it near the focus; the rider stands just past its end
  let best = null;
  for (let c = G.lanes; c < G.P; c++) {
    if (!G.junctionAt[G.node[c]]) continue;
    const o = G.start[c] + G.count[c] - 1, x = G.SX[o], z = G.SZ[o];
    if (Math.hypot(x - context.focus.x, z - context.focus.z) > 150) continue;
    let cars = 0;
    for (let i = 0; i < view.N; i++) if (view.alive[i] && view.route[i * 4] === G.source[c] && view.route[i * 4 + 1] === c) cars++;
    if (!best || cars > best.cars) best = { c, x: x + G.STX[o] * 1.5, z: z + G.STZ[o] * 1.5, y: G.SY[o], cars };
  }
  assert.ok(best && best.cars > 0, 'a turn with cars heading for it');
  const r = context.rider;
  Object.assign(r, { valid: true, x: best.x, z: best.z, y: best.y, minY: best.y, maxY: best.y + 1.9, heading: 0, speed: 0, vx: 0, vz: 0 });
  const inside = new Float32Array(view.N);
  // cars already inside the junction when the rider steps there may stand where they are; none may enter after
  frame(traffic, context);
  const before = new Set();
  for (let i = 0; i < view.N; i++) {
    if (!view.alive[i]) continue;
    const p = view.route[i * 4];
    if (G.kind[p] === 1 && G.node[p] === G.node[best.c]) before.add(i);
    // too close to its line to stop before it even braking hard (6 m/s²): it goes in and stops short of the rider
    else if (G.kind[view.route[i * 4 + 1]] === 1 && G.node[view.route[i * 4 + 1]] === G.node[best.c] &&
      G.len[p] - G.stopBack[p] - view.pos[i] - view.half[i] < view.speed[i] ** 2 / 12 + 0.5) before.add(i);
  }
  let waited = 0, longest = 0;
  if (process.env.TRAFFIC_DEBUG) for (let i = 0; i < view.N; i++) if (view.alive[i] && G.node[view.route[i * 4 + 1]] === G.node[best.c]) console.log('AT STEP car', i, 'lane', view.route[i * 4], 'pos', view.pos[i].toFixed(2), '/', G.len[view.route[i * 4]].toFixed(2), 'stop', G.stop?.[view.route[i * 4]], 'speed', view.speed[i].toFixed(2), 'reason', view.reason[i], 'claimed', view.claim?.[i]);
  for (let f = 0; f < 40 / DT; f++) {
    frame(traffic, context);
    for (let i = 0; i < view.N; i++) {
      if (!view.alive[i]) { inside[i] = 0; continue; }
      const p = view.route[i * 4];
      if (G.kind[p] === 1 && G.node[p] === G.node[best.c] && view.speed[i] < 0.2 && !before.has(i)) inside[i] += DT; else inside[i] = 0;
      if (process.env.TRAFFIC_DEBUG && inside[i] > 3 && inside[i] < 3 + DT * 1.5) console.log('STOOD car', i, 'turn', p, 'best', best.c, 'target', G.target[p], 'bestTarget', G.target[best.c], 'reason', view.reason[i], 'forRider', view.forRider[i], 'pos', view.pos[i].toFixed(1), '/', G.len[p].toFixed(1), 'at', view.X[i].toFixed(1), view.Z[i].toFixed(1), 'rider', best.x.toFixed(1), best.z.toFixed(1), 'next', view.route[i * 4 + 1]);
      longest = Math.max(longest, inside[i]);
      if (p === G.source[best.c] && view.route[i * 4 + 1] === best.c && view.speed[i] < 0.2) waited++;
    }
  }
  r.valid = false;
  assert.ok(waited > 0, 'some car waited for the rider at the line');
  assert.ok(longest < 3, `a car stood ${longest.toFixed(1)} s inside the junction`);
});

test('every tyre on the ground on every lane and turn (longest wheelbase and a short car, every metre)', async () => {
  // a fresh traffic of one car, placed every metre along every path its body may use; its four tyre contacts (as the
  // kit draws it) against the street's ground: none more than 8 cm off it (above or below)
  const ctx = makeContext({ cars: 1 });
  const t1 = await createTraffic(ctx), v1 = t1.inspect(), g1 = v1.G, probe = { normal: {} };
  const longest = VEHICLE_TYPES.reduce((a, t) => (t.axle > a.axle ? t : a)), short = VEHICLE_TYPES.find((t) => t.id === 'hatch');
  for (const t of [longest, short]) {
    const ti = VEHICLE_TYPES.indexOf(t), isLong = t.length >= LONG_VEHICLE;
    let worst = 0, at = null, n = 0;
    for (let p = 0; p < g1.P; p++) {
      if (isLong && !g1.longOk[p]) continue;
      for (let s = t.length / 2 + 0.5; s <= g1.len[p] - t.length / 2 - 0.5; s += 1) {
        const o = g1.start[p] + Math.min(g1.count[p] - 1, Math.round(s / g1.step[p]));
        ctx.focus.x = g1.SX[o]; ctx.focus.z = g1.SZ[o];
        v1.place(0, p, s, ti, 0);
        const tp = Math.tan(v1.pitch[0]), tr = Math.tan(v1.roll[0]), fx = Math.sin(v1.H[0]), fz = Math.cos(v1.H[0]);
        for (const sf of [1, -1]) for (const sl of [1, -1]) {
          const a = t.axleOffset + sf * t.axle, b = sl * t.track;
          const x = v1.X[0] + fx * a + fz * b, z = v1.Z[0] + fz * a - fx * b, y = v1.Y[0] + a * tp + b * tr;
          const off = Math.abs(y - world.sampler.sampleGround(x, z, probe, y + 0.5).height);
          if (off > worst) { worst = off; at = [x.toFixed(1), z.toFixed(1), p]; }
        }
        n++;
      }
    }
    assert.ok(n > 5000, `${t.id}: ${n} placements`);
    assert.ok(worst < 0.08, `${t.id}: a tyre ${(worst * 100).toFixed(1)} cm off the ground at ${at}`);
  }
  t1.dispose?.();
});

test('crash contact is pitched as the car is drawn, on a hill and on the flat', () => {
  // the kit draws a car rotated by Euler YXZ (−pitch, heading, roll) about its footprint centre
  const rotate = (h, a, rr, y, z) => {
    const ux = -y * Math.sin(rr), uy = y * Math.cos(rr), uz = z;
    const wx = ux, wy = uy * Math.cos(a) - uz * Math.sin(a), wz = uy * Math.sin(a) + uz * Math.cos(a);
    return [wx * Math.cos(h) + wz * Math.sin(h), wy, -wx * Math.sin(h) + wz * Math.cos(h)];
  };
  let hill = -1, flat = -1;
  for (let f = 0; f < 60 / DT && (hill < 0 || flat < 0); f++) {
    frame(traffic, context);
    for (let i = 0; i < view.N; i++) {
      if (!view.alive[i]) continue;
      if (hill < 0 && Math.abs(view.pitch[i]) > 0.06) hill = i;
      if (flat < 0 && Math.abs(view.pitch[i]) < 0.005 && Math.abs(view.roll[i]) < 0.005) flat = i;
    }
    if (hill < 0 && f === Math.round(20 / DT)) context.focus.x = -150, context.focus.z = -60; // the steep old town
  }
  assert.ok(hill >= 0 && flat >= 0, 'a car on a hill and one on the flat');
  for (const i of [hill, flat]) {
    const body = view.bodies[i], profile = context.kit.crashProfile(view.type[i]);
    // the record is the shared helper's, with the drawn pitch
    const ref = { crashProfile: [] };
    writeVehicleBody(ref, profile, view.X[i], view.Y[i], view.Z[i], view.H[i], -view.pitch[i], view.roll[i], view.VX[i], view.VZ[i]);
    for (const key of ['x', 'z', 'minY', 'maxY', 'halfWidthMetres', 'halfLengthMetres', 'crashPitch', 'crashRoll']) assert.equal(body[key], ref[key], key);
    // each crash slice where the drawn slice is
    const dyn = createEucDynamicWorld({ bodiesNear: (x, z, rad, out) => out.push(body) });
    dyn.didPlace({ body: { x: body.x, z: body.z } });
    const parts = dyn.crashObstacleBodies({ x: body.x, z: body.z });
    profile.forEach((sl, k) => {
      const [dx, dy, dz] = rotate(view.H[i], -view.pitch[i], view.roll[i], (sl.minY + sl.maxY) / 2, sl.z);
      const part = parts[k];
      const e = Math.hypot(part.x - (view.X[i] + dx), part.z - (view.Z[i] + dz), (part.minY + part.maxY) / 2 - (view.Y[i] + dy));
      assert.ok(e < 0.05, `${i === hill ? 'hill' : 'flat'} car slice ${k}: contact ${e.toFixed(3)} m from the drawn slice`);
    });
  }
});

test('no horn at a rider who has just been placed; one after they have moved off and a car waits on them', () => {
  const r = context.rider;
  // a spot on a lane with cars, placed as at a spawn: refocus with the rider there
  let p = -1;
  for (let q = 0; q < G.lanes && p < 0; q++) if (G.len[q] > 60 && !G.stop[q] && Math.hypot(G.SX[G.start[q]] - context.focus.x, G.SZ[G.start[q]] - context.focus.z) < 150) p = q;
  assert.ok(p >= 0);
  const o = G.start[p] + Math.round(40 / G.step[p]);
  Object.assign(r, { valid: true, x: G.SX[o], z: G.SZ[o], y: G.SY[o], minY: G.SY[o], maxY: G.SY[o] + 1.9, heading: 0, speed: 0, vx: 0, vz: 0 });
  traffic.refocus();
  const out = [];
  traffic.drainEvents(out);
  // a car arrives behind the standing rider (placed there for the check)
  frame(traffic, context);
  view.place(0, p, 12, 1, 4);
  let horns = 0;
  for (let f = 0; f < 20 / DT; f++) { frame(traffic, context); horns += traffic.drainEvents(out); }
  assert.equal(horns, 0, 'a horn before the rider moved');
  assert.ok(view.speed[0] < 0.3 && view.forRider[0], 'the car waits for the rider');
  // the rider rolls 4 m on, stops again in the lane: now the car may sound, once
  const o2 = G.start[p] + Math.round(44 / G.step[p]);
  Object.assign(r, { x: G.SX[o2], z: G.SZ[o2] });
  for (let f = 0; f < 20 / DT; f++) { frame(traffic, context); horns += traffic.drainEvents(out); }
  r.valid = false;
  assert.equal(horns, 1, `horns after the rider moved: ${horns}`);
});

test('same seed, same streets', async () => {
  const run = async () => {
    const c = makeContext({ cars: 20, focus: [505, -75] });
    const t = await createTraffic(c), v = t.inspect();
    t.refocus();
    for (let f = 0; f < 20 / DT; f++) frame(t, c);
    let h = 0;
    for (let i = 0; i < v.N; i++) if (v.alive[i]) h = (h * 31 + Math.round(v.X[i] * 100) + Math.round(v.Z[i] * 7)) % 1e9;
    return h;
  };
  assert.equal(await run(), await run());
});
