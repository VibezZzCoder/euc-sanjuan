/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Officer Dorkins on the real world: the pursuit graph (size, build time, one connected town, layers kept apart at the
// bores), the where-he-may-be rule, a seeded pursuit across the map in which every position he takes is dry, public
// and clear of the static solids, the skate spots, and the booking's checked placements. CPU only, seeded.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const V = new URL('../vendor/three/', import.meta.url).href;
registerHooks({ resolve(s, c, next) {
  if (s === 'three' || s === 'three/webgpu') return { url: V + 'build/three.webgpu.js', shortCircuit: true };
  if (s === 'three/tsl') return { url: V + 'build/three.tsl.js', shortCircuit: true };
  return next(s, c);
} });
globalThis.fetch = async (url) => { const b = readFileSync(url); return { ok: true, json: async () => JSON.parse(b), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadCity } = await import('../js/sj-world.js');
const { buildWalkNetwork } = await import('../js/sj-walk.js');
const { buildLaneGraph } = await import('../js/sj-traffic-graph.js');
const sides = await import('../js/sj-street-sides.js');
const { buildPursuitGraph, EDGE } = await import('../js/sj-dorkins-graph.js');
const { createFlightQueries, FLIGHT } = await import('../js/sj-dorkins-flight.js');
const { createFlightBrain } = await import('../js/sj-dorkins-brain.js');
const { createCloseRange, strikeSpot } = await import('../js/sj-dorkins-close.js');
const { SWING } = await import('../js/sj-dorkins-swing.js');
const { skateSpots } = await import('../js/sj-dorkins.js');
const { BOOKING_SITE, createBookingDirector, createBookingPlacement } = await import('../js/sj-booking-rules.js');
const { createChaseDirector } = await import('../js/sj-dorkins-chase.js');
const { findPlacementTarget, placementDepartureClear } = await import('../js/euc-recovery.js');
const { seededRandom } = await import('../js/sj-life-random.js');

const world = await loadCity();
const walk = buildWalkNetwork(world), lanes = buildLaneGraph(world, sides);
const graph = buildPursuitGraph({ walk, lanes });
const queries = createFlightQueries(world);
queries.graph = graph;

test('pursuit graph: compact, quick, one connected town', () => {
  const g = graph, s = g.stats;
  console.log(`pursuit graph ${g.nodes} nodes, ${g.edges} edges (${s.walkEdges} walk, ${s.laneEdges} lane, ${s.joins} joins), ` +
    `${(g.bytes / 1024).toFixed(0)} KiB + search scratch, ${g.ms.toFixed(1)} ms; components ${s.components}`);
  assert.ok(g.bytes < 768 * 1024, `graph bytes ${g.bytes}`);
  assert.ok(g.ms < 100, `build ${g.ms} ms`);
  const sizes = new Map(); for (let i = 0; i < g.nodes; i++) if (g.component[i] >= 0) sizes.set(g.component[i], (sizes.get(g.component[i]) ?? 0) + 1);
  const largest = Math.max(...sizes.values());
  assert.ok(largest / g.reach > 0.95, `largest component ${largest}/${g.reach}`);
  // the main destinations are all in that component
  const main = [...sizes.entries()].find(([, n]) => n === largest)[0];
  for (const [name, x, z] of [['Plaza de Armas', -1.5, 8.7], ['La Princesa', -143, 226], ['El Morro', -688, -507], ['San Cristóbal', 488, -64], ['Muelle', 496, 178]]) {
    const near = g.nearby(x, z, 60, 8).filter(i => g.component[i] === main);
    assert.ok(near.length, `${name} reaches the main graph`);
  }
  const scratch = g.pathfinder(() => true).bytes;
  assert.ok(g.bytes + scratch < 1.25 * 1024 * 1024, `graph + scratch ${g.bytes + scratch}`);
});

test('pursuit graph: no edge jumps between levels (bores and streets above stay apart); stairs are not his', () => {
  let worst = 0;
  for (let e = 0; e < graph.edges; e++) {
    const a = graph.edgeA(e), b = graph.edgeB(e), dy = Math.abs(graph.y[b] - graph.y[a]), len = Math.max(0.05, graph.edgeLen(e));
    const kind = graph.edgeKind(e);
    if (kind === EDGE.WALK && walk.kind[e] === 5) continue; // stair links are excluded from routing (not in adjacency)
    const limit = kind === EDGE.JOIN ? 1.2 : Math.max(1.5, 0.45 * len);
    worst = Math.max(worst, dy / limit);
    assert.ok(dy <= limit + 1e-6, `edge ${e} kind ${kind} rises ${dy.toFixed(2)} m over ${len.toFixed(1)} m`);
  }
  for (let j = 0; j < graph.adjEdge.length; j++) { const e = graph.adjEdge[j]; if (e < graph.walkLinks) assert.notEqual(walk.kind[e], 5, 'no stair link is routable'); }
  // the Puerta de San Juan bore (a floor under the wall) and the wall walk above: nodes there on both levels, no edge between them
  const nearGate = graph.nearby(-296, 32, 30, 256);
  const low = nearGate.filter(i => graph.y[i] < 6), high = nearGate.filter(i => graph.y[i] > 9);
  for (const i of low) for (let j = graph.adjStart[i]; j < graph.adjStart[i + 1]; j++) {
    const e = graph.adjEdge[j], o = graph.edgeA(e) === i ? graph.edgeB(e) : graph.edgeA(e);
    assert.ok(!high.includes(o), `bore node ${i} joined to the level above (${o})`);
  }
});

test('where he may be: never over the sea, a closed site or past the east fence', () => {
  assert.equal(queries.allowed(-1.5, 8.7, world.height(-1.5, 8.7) + 1.1), true, 'Plaza de Armas');
  assert.equal(queries.allowed(0, 640, 5), false, 'the bay');
  assert.equal(queries.allowed(0, -1200, 5), false, 'the Atlantic');
  // every closed area's private ground (sampled where its own offLimitsAt says closed)
  let closed = 0;
  for (let x = -900; x <= 1400; x += 9) for (let z = -700; z <= 650; z += 9) {
    const g = world.sampler.sampleGround(x, z, { normal: {} }, 200);
    if (!Number.isFinite(g.height) || g.offCourse || g.water) continue;
    if (world.sampler.offLimitsAt(x, z, g.height)) { closed++; assert.equal(queries.allowed(x, z, g.height + 1.1), false, `closed ground at ${x},${z}`); }
  }
  assert.ok(closed > 50, `sampled closed points ${closed}`);
  const east = world.worldedge?.closure?.x;
  if (Number.isFinite(east)) assert.equal(queries.allowedXZ(east + 1, -100, 5), false);
  // a sweep that would cross the sea is refused even at height
  assert.equal(queries.clearFlight({ x: 120, y: 20, z: 300 }, { x: 120, y: 20, z: 309 }), queries.allowed(120, 309, 20) && queries.allowed(120, 300, 20) ? queries.clearFlight({ x: 120, y: 20, z: 300 }, { x: 120, y: 20, z: 309 }) : false);
});

test('seeded pursuit across the map: every position dry, public and clear of solids', () => {
  const random = seededRandom('dorkins-test');
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: FLIGHT.halfWidth * 0.7, halfLengthMetres: FLIGHT.halfLength * 0.7, minY: 0, maxY: 0, floorY: 0 }; // inside the checked square at any heading
  let frames = 0, routed = 0, worstMs = 0;
  const starts = [[-1.5, 30], [-143, 228], [-450, -300], [300, -100], [200, 220], [700, 60], [-600, -420], [100, -330]];
  for (const [sx, sz] of starts) {
    // the rider rides a lane path near the start (or stands still if none)
    // the nearest lane path to the start
    let lanePath = -1, best = 300, k0 = 0;
    for (let p = 0; p < lanes.P; p++) for (let k = lanes.start[p]; k < lanes.start[p] + lanes.count[p]; k++) { const d = Math.hypot(lanes.SX[k] - sx, lanes.SZ[k] - sz); if (d < best) { best = d; lanePath = p; k0 = k; } }
    assert.ok(lanePath >= 0, `lane near ${sx},${sz}`);
    const brain = createFlightBrain(queries, graph);
    // he starts 40–80 m from the rider on the graph, 7 m up
    const r0 = { x: lanes.SX[k0], y: lanes.SY[k0], z: lanes.SZ[k0] };
    const options = graph.nearby(r0.x, r0.z, 80, 64, { minDistance: 40, referenceY: r0.y, maxHeight: 20 });
    let placed = false;
    for (const i of options) if (brain.place({ x: graph.x[i], y: graph.y[i] + 7, z: graph.z[i] }, 0)) { placed = true; break; }
    assert.ok(placed, `placed near ${sx},${sz}`);
    let at = k0 - lanes.start[lanePath], sample = k0, seen = true;
    for (let f = 0; f < 60 * 25; f++) {
      const dt = 1 / 60;
      // the rider: along its lane at ~7 m/s, then onward along the first outgoing path
      at += 7 * dt;
      let p = lanePath;
      if (p >= 0) { while (at >= lanes.count[p] - 1 && lanes.outStart[p + 1] > lanes.outStart[p]) { at -= lanes.count[p] - 1; p = lanePath = lanes.outs[lanes.outStart[p] + Math.floor(random() * (lanes.outStart[p + 1] - lanes.outStart[p]))]; }
        sample = lanes.start[p] + Math.min(lanes.count[p] - 1, Math.floor(at)); }
      const rx = lanes.SX[sample], ry = lanes.SY[sample], rz = lanes.SZ[sample], rh = Math.atan2(lanes.STX[sample], lanes.STZ[sample]);
      const s = brain.state;
      seen = Math.hypot(rx - s.x, rz - s.z) < 110 && queries.clearLine({ x: s.x, y: s.y + 0.9, z: s.z }, { x: rx, y: ry + 1.2, z: rz });
      const t0 = performance.now();
      brain.update(dt, { x: rx, y: ry, z: rz, heading: rh, vx: Math.sin(rh) * 7, vz: Math.cos(rh) * 7 }, seen);
      worstMs = Math.max(worstMs, performance.now() - t0);
      frames++; if (brain.route.length) routed++;
      assert.ok(queries.allowed(s.x, s.z, s.y), `officer at ${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)} is over dry public ground`);
      const g = world.sampler.sampleGround(s.x, s.z, { normal: {} }, s.y);
      body.x = s.x; body.z = s.z; body.headingY = s.heading; body.minY = s.y + 0.01; body.maxY = s.y + FLIGHT.height * 0.98; body.floorY = g.height;
      assert.ok(world.sampler.isVolumeClear(body), `officer body clear at ${s.x.toFixed(1)},${s.z.toFixed(1)}`);
    }
  }
  console.log(`pursuit: ${frames} frames, ${routed} on a route, worst brain step ${worstMs.toFixed(2)} ms`);
  assert.ok(routed > 0, 'some of the chase followed the graph');
});

test('skate spots: both rings are found; their arrival points are inside, the plaza is not', () => {
  const at = skateSpots(world);
  assert.ok(at.spots.length >= 2, `spots ${at.spots.map(s => s.name)}`);
  for (const s of at.spots) {
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    const inside = at(cx, cz) ?? s.ring.map(([x, z]) => at(x * 0.9 + cx * 0.1, z * 0.9 + cz * 0.1)).find(Boolean);
    assert.ok(inside, `inside ${s.name}`);
  }
  assert.equal(at(-1.5, 8.7), null);
  // the two map arrivals are inside; a point 20 m beyond each apron is not
  assert.ok(at(538.88, 147.29), 'Muelle arrival'); assert.ok(at(200.10, -406.59), 'El Bowl arrival (on its apron)');
  for (const s of at.spots) assert.equal(at(s.x1 + 20, (s.z0 + s.z1) / 2), null, `beyond ${s.name}`);
  // a director fed by the real spot test holds the ambush while the rider is in the park
  const d = createChaseDirector({ random: () => 0 });
  const park = at.spots[0], px = (park.x0 + park.x1) / 2, pz = (park.z0 + park.z1) / 2;
  let ambush = null;
  for (let t = 0; t < 120; t += 0.05) ambush = d.update(0.05, { riding: true, skating: at(px, pz) !== null || at.spots[0].ring.some(([x, z]) => at(x * 0.9 + px * 0.1, z * 0.9 + pz * 0.1)) }) ?? ambush;
  assert.equal(ambush, null);
});

test('booking: the surveyed intake and release poses admit on the built world; blocked ones fall to the next; all blocked keeps the capture', () => {
  const hull = { halfWidthMetres: 0.35, halfLengthMetres: 0.5, heightMetres: 1.9 };
  const admit = (site, departure) => {
    const target = findPlacementTarget(world.sampler, { x: site.x, z: site.z, headingY: site.heading, referenceY: site.y, maxStepUp: 0.216 });
    if (!target || Math.abs(target.y - site.y) > 0.5) return false;
    return placementDepartureClear(world.sampler, target, { maxStepUp: 0.216, departure, hull }, () => true);
  };
  for (const site of BOOKING_SITE.intake) assert.ok(admit(site, 0), `intake ${JSON.stringify(site)}`);
  for (const site of BOOKING_SITE.release) assert.ok(admit(site, 1.2), `release ${JSON.stringify(site)}`);
  const g = world.sampler.sampleGround(BOOKING_SITE.desk.x, BOOKING_SITE.desk.z, { normal: {} }, BOOKING_SITE.desk.y + 0.5);
  assert.ok(Math.abs(g.height - BOOKING_SITE.desk.y) < 0.1, `desk floor ${g.height}`);
  assert.equal(world.sampler.offLimitsAt(BOOKING_SITE.desk.x, BOOKING_SITE.desk.z, g.height), false, 'the desk stands on public ground');
  const capture = () => { const chase = createChaseDirector({ random: () => 0 }); chase.soon(); chase.update(0.1, { riding: true }); chase.update(0.1, { riding: true, sees: true, distance: 3 });
    for (let i = 0; i < 4; i++) { chase.knockedDown(); chase.state.recovery = 0; } const booking = createBookingDirector(); booking.start('Cool Rider', 4); return { chase, booking }; };
  // the first release blocked: the next one is used
  { const { chase, booking } = capture(), tried = [];
    const placement = createBookingPlacement({ booking, chase, place: (site, d) => { tried.push(site); return site.x !== BOOKING_SITE.release[0].x || site.heading !== BOOKING_SITE.release[0].heading ? admit(site, d) : false; } });
    assert.ok(placement.transfer()); assert.equal(booking.state.phase, 'intake');
    const site = placement.release();
    assert.deepEqual([site.x, site.heading], [BOOKING_SITE.release[1].x, BOOKING_SITE.release[1].heading]);
    assert.equal(chase.state.phase, 'waiting'); assert.equal(booking.active, false); }
  // all blocked: nothing changes
  { const { chase, booking } = capture();
    const placement = createBookingPlacement({ booking, chase, place: () => false });
    assert.equal(placement.release(), null);
    assert.equal(chase.state.phase, 'captured'); assert.equal(booking.active, true); }
});

// Close range against furniture: a Plaza de Armas bench (rider (−24.98, 21.02), officer stuck at
// (−26.66, 22.65) behind the bench box centred (−26.237, 21.993)), the plaza fountain's rim and a parked car.
function closeCase(name, rider, officerXZ, headings) {
  const ry = world.sampler.sampleGround(rider.x, rider.z, { normal: {} }, rider.y ?? 200).height;
  for (const heading of headings) {
    const brain = createFlightBrain(queries, graph), close = createCloseRange(queries);
    const oy = world.sampler.sampleGround(officerXZ.x, officerXZ.z, { normal: {} }, ry + 3).height + 1.1;
    assert.ok(brain.place({ x: officerXZ.x, y: oy, z: officerXZ.z }, 0), `${name}: officer placed`);
    const obs = { x: rider.x, y: ry, z: rider.z, heading, vx: 0, vz: 0 };
    brain.seedObservation(obs, true);
    let strikeReady = -1, gaveUp = -1, nearBlocked = 0, worst = 0;
    for (let f = 0; f < 60 * 20; f++) {
      const dt = 1 / 60, st = brain.state, d = Math.hypot(st.x - obs.x, st.y - obs.y, st.z - obs.z);
      const seen = queries.clearLine({ x: st.x, y: st.y + 0.9, z: st.z }, { x: obs.x, y: obs.y + 1.2, z: obs.z });
      const t0 = performance.now(), mode = close.update(dt, st, seen ? obs : null, d); worst = Math.max(worst, performance.now() - t0);
      if (mode === 'giveup') { gaveUp = f / 60; break; }
      if (close.canStrike && d <= SWING.triggerRange && seen) {
        // the swing is deliverable: the swoop toward the strike spot is a clear flight
        const spot = strikeSpot(obs);
        assert.ok(queries.clearFlight(st, { x: st.x + (spot.x - st.x) * Math.min(1, 8 / Math.max(1e-6, Math.hypot(spot.x - st.x, spot.z - st.z))), y: spot.y, z: st.z + (spot.z - st.z) * Math.min(1, 8 / Math.max(1e-6, Math.hypot(spot.x - st.x, spot.z - st.z))) }) || d > 8, `${name}: deliverable swing is clear`);
        strikeReady = f / 60; break;
      }
      if (d < 3.5) nearBlocked += dt;
      if (mode === 'reposition') brain.leave(dt, close.target); else brain.update(dt, obs, seen);
      assert.ok(queries.allowed(st.x, st.z, st.y), `${name}: officer over allowed ground`);
    }
    console.log(`${name} heading ${heading.toFixed(2)}: strike ready ${strikeReady}s, gave up ${gaveUp}s, near and blocked ${nearBlocked.toFixed(1)}s, worst close step ${worst.toFixed(2)} ms, repositions ${close.stats.repositions}`);
    assert.ok(strikeReady >= 0 || gaveUp >= 0, `${name}: he either gets a deliverable swing or gives up`);
    assert.ok(strikeReady >= 0 ? strikeReady < 12 : gaveUp < 12, `${name}: within 12 s`);
    assert.ok(nearBlocked < 10, `${name}: not parked beside the rider (${nearBlocked.toFixed(1)} s)`);
  }
}

test('close range: the plaza bench case, the fountain rim and a parked car', () => {
  // the bench: the rider's strike side toward the bench (−2.48) and three other headings
  closeCase('bench', { x: -24.98, z: 21.02, y: 25 }, { x: -26.66, z: 22.65 }, [-2.48, 0, 1.57, 3.1]);
  const f = world.plaza.fountain;
  closeCase('fountain', { x: f.x + f.radius + 1.3, z: f.z, y: f.y + 3 }, { x: f.x - f.radius - 1.3, z: f.z }, [0, Math.PI / 2]);
  const car = world.parking.list.reduce((b, c) => (Math.hypot(c.x + 40, c.z - 60) < Math.hypot(b.x + 40, b.z - 60) ? c : b));
  const sx = Math.cos(car.heading), sz = -Math.sin(car.heading);
  let rider = { x: car.x + sx * 2.3, z: car.z + sz * 2.3, y: car.y + 3 }, officer = { x: car.x - sx * 2.6, z: car.z - sz * 2.6 };
  if (!queries.allowed(rider.x, rider.z, world.sampler.sampleGround(rider.x, rider.z, { normal: {} }, rider.y).height + 1)) [rider, officer] = [{ ...officer, y: car.y + 3 }, { x: rider.x, z: rider.z }];
  closeCase(`parked car at ${car.x.toFixed(1)},${car.z.toFixed(1)}`, rider, officer, [car.heading, car.heading + Math.PI / 2]);
});
