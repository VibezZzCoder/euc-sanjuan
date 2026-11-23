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
const { createFlightQueries, FLIGHT, riderReachable, hiddenFrom } = await import('../js/sj-dorkins-flight.js');
const { createFlightBrain } = await import('../js/sj-dorkins-brain.js');
const closeModule = await import('../js/sj-dorkins-close.js');
const { createCloseRange, strikeSpot } = closeModule;
const { SWING } = await import('../js/sj-dorkins-swing.js');
const { skateSpots, exitStep, EXIT_SECONDS } = await import('../js/sj-dorkins.js');
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

test('pursuit graph: no edge jumps between levels (bores and streets above stay apart); stairs are his routes too', () => {
  let worst = 0;
  for (let e = 0; e < graph.edges; e++) {
    const a = graph.edgeA(e), b = graph.edgeB(e), dy = Math.abs(graph.y[b] - graph.y[a]), len = Math.max(0.05, graph.edgeLen(e));
    const kind = graph.edgeKind(e);
    if (kind === EDGE.WALK && walk.kind[e] === 5) continue; // stair links rise steeply by nature (walk heights along them)
    const limit = kind === EDGE.JOIN ? 1.2 : Math.max(1.5, 0.45 * len);
    worst = Math.max(worst, dy / limit);
    assert.ok(dy <= limit + 1e-6, `edge ${e} kind ${kind} rises ${dy.toFixed(2)} m over ${len.toFixed(1)} m`);
  }
  let stairs = 0, stairsTotal = 0;
  for (let k = 0; k < walk.links; k++) if (walk.kind[k] === 5 && walk.len[k] > 0.05) stairsTotal++;
  for (let j = 0; j < graph.adjEdge.length; j++) { const e = graph.adjEdge[j]; if (e < graph.walkLinks && walk.kind[e] === 5) stairs++; }
  assert.ok(stairsTotal > 0 && stairs === 2 * stairsTotal, `every stair link routable (${stairs / 2}/${stairsTotal})`);
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
    const obs = { x: rider.x, y: ry, z: rider.z, heading, vx: 0, vz: 0, speed: 0 };
    brain.seedObservation(obs, true);
    let strikeReady = -1, nearBlocked = 0, worst = 0;
    for (let f = 0; f < 60 * 20; f++) {
      const dt = 1 / 60, st = brain.state, d = Math.hypot(st.x - obs.x, st.y - obs.y, st.z - obs.z);
      const seen = queries.clearLine({ x: st.x, y: st.y + 0.9, z: st.z }, { x: obs.x, y: obs.y + 1.2, z: obs.z });
      const t0 = performance.now(), mode = close.update(dt, st, seen ? obs : null, d); worst = Math.max(worst, performance.now() - t0);
      assert.notEqual(mode, 'giveup', `${name}: he does not give up`);
      if (close.canStrike && d <= SWING.triggerRange && seen) {
        // the swing is deliverable: the swoop toward the strike spot is a clear flight (checked again on this frame; the
        // part rechecks every 0.2 s)
        const spot = strikeSpot(obs, undefined, close.strikeHeight, close.strikeTurn), k = Math.min(1, 8 / Math.max(1e-6, Math.hypot(spot.x - st.x, spot.z - st.z)));
        if (queries.clearFlight(st, { x: st.x + (spot.x - st.x) * k, y: spot.y, z: st.z + (spot.z - st.z) * k })) { strikeReady = f / 60; break; }
      }
      if (d < 3.5) nearBlocked += dt;
      if (mode === 'reposition') brain.leave(dt, close.target); else brain.update(dt, obs, seen);
      assert.ok(queries.allowed(st.x, st.z, st.y), `${name}: officer over allowed ground`);
    }
    console.log(`${name} heading ${heading.toFixed(2)}: strike ready ${strikeReady}s, near and blocked ${nearBlocked.toFixed(1)}s, worst close step ${worst.toFixed(2)} ms, repositions ${close.stats.repositions}, over the top ${close.stats.overs}, holds ${close.stats.holds}`);
    assert.ok(strikeReady >= 0 && strikeReady < 5, `${name}: a deliverable swing within 5 s (${strikeReady})`);
    assert.ok(nearBlocked < 3, `${name}: not parked beside the rider (${nearBlocked.toFixed(1)} s)`);
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

// A brain fed by a fake city-life index: one moving body (a van 2.3 m tall crawling across his way, or parked in it).
function movingQueries(bodies) {
  return { ...queries, movingAhead(st, vx, vz, look) {
    const v = Math.hypot(vx, vz), ux = v > 0.3 ? vx / v : Math.sin(st.heading), uz = v > 0.3 ? vz / v : Math.cos(st.heading), len = 2.5 + v * look;
    let top = -Infinity, gap = Infinity, along = 0;
    for (const b of bodies) {
      if (b.maxY < st.y - 6) continue;
      const dx = b.x - st.x, dz = b.z - st.z, ext = Math.hypot(b.halfWidthMetres, b.halfLengthMetres), a = dx * ux + dz * uz;
      if (Math.abs(dx * uz - dz * ux) > ext + FLIGHT.halfWidth + 0.4 || a < -ext - FLIGHT.halfLength || a > len + ext) continue;
      top = Math.max(top, b.maxY); const g = Math.max(0, a - ext - FLIGHT.halfLength); if (g < gap) { gap = g; along = b.velocityX * ux + b.velocityZ * uz; }
    }
    return top > -Infinity ? { top, gap, along } : null;
  } };
}
const inside = (st, b) => { // his envelope (footprint square, bottom to bottom + height) meets the body box
  const dx = st.x - b.x, dz = st.z - b.z, c = Math.cos(b.headingY), s = Math.sin(b.headingY), r = FLIGHT.halfWidth * Math.SQRT2;
  return Math.abs(dx * c - dz * s) < b.halfWidthMetres + r && Math.abs(dx * s + dz * c) < b.halfLengthMetres + r && st.y < b.maxY && st.y + FLIGHT.height > b.minY;
};

test('moving bodies: he rises over a van in his way (above its roof) and comes down behind; never through it', () => {
  // Calle Fortaleza near the plaza: the rider waits 22 m east of him; a van crawls across, or stands still, between them
  const y0 = world.sampler.sampleGround(-20, 30, { normal: {} }, 200).height;
  for (const speed of [0, 2.5]) {
    const van = { x: -10, z: 30, headingY: 0, halfWidthMetres: 1.0, halfLengthMetres: 2.6, minY: y0, maxY: y0 + 2.3, velocityX: 0, velocityZ: speed };
    const brain = createFlightBrain(movingQueries([van]), graph);
    assert.ok(brain.place({ x: -21, y: y0 + 1.1, z: 30 }, Math.PI / 2));
    const obs = { x: 1, y: y0, z: 30, heading: Math.PI / 2, vx: 0, vz: 0 };
    let peak = 0, through = 0, crossed = -1, aboveRoof = Infinity;
    for (let f = 0; f < 60 * 8; f++) {
      const dt = 1 / 60;
      van.z = 30 + speed * (f / 60 - 2);
      brain.update(dt, obs, true);
      const st = brain.state;
      if (inside(st, van)) through++;
      if (Math.abs(st.x - van.x) < van.halfWidthMetres + 0.3) { peak = Math.max(peak, st.y - y0); if (Math.abs(st.z - van.z) < van.halfLengthMetres) aboveRoof = Math.min(aboveRoof, st.y - van.maxY); }
      if (crossed < 0 && st.x > van.x + 3) crossed = f / 60;
    }
    console.log(`van ${speed} m/s: crossed after ${crossed}s, peak ${peak.toFixed(2)} m above the street, least clearance over the roof ${aboveRoof.toFixed(2)} m, end ${brain.state.x.toFixed(1)},${(brain.state.y - y0).toFixed(1)}`);
    assert.equal(through, 0, 'never inside the van');
    assert.ok(crossed > 0 && crossed < 3, `over it within 3 s (${crossed})`);
    assert.ok(!(aboveRoof < 0.3), `above the roof with margin (${aboveRoof})`);
    assert.ok(brain.state.y - y0 < 2.6, 'came down behind it');
  }
});

test('static furniture and parked cars: he rises over them instead of waiting behind', () => {
  // a parked car between him and the rider on the same side of it: lined up along its length, 3 m each side
  const car = world.parking.list.reduce((b, c) => (Math.hypot(c.x + 40, c.z - 60) < Math.hypot(b.x + 40, b.z - 60) ? c : b));
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const yc = world.sampler.sampleGround(car.x, car.z, { normal: {} }, car.y + 0.3).height;
  for (const dir of [1, -1]) {
    const from = { x: car.x - fx * 5 * dir, z: car.z - fz * 5 * dir }, to = { x: car.x + fx * 5 * dir, z: car.z + fz * 5 * dir };
    const fy = world.sampler.sampleGround(from.x, from.z, { normal: {} }, car.y + 0.3).height, ty = world.sampler.sampleGround(to.x, to.z, { normal: {} }, car.y + 0.3).height;
    const brain = createFlightBrain(queries, graph);
    if (!brain.place({ x: from.x, y: fy + 1.1, z: from.z }, 0)) continue;
    const obs = { x: to.x, y: ty, z: to.z, heading: car.heading, vx: 0, vz: 0 };
    let arrived = -1, peak = 0;
    for (let f = 0; f < 60 * 6 && arrived < 0; f++) {
      brain.update(1 / 60, obs, true); peak = Math.max(peak, brain.state.y - yc);
      if (Math.hypot(brain.state.x - to.x, brain.state.z - to.z) < 4.5) arrived = f / 60;
    }
    console.log(`parked car at ${car.x.toFixed(1)},${car.z.toFixed(1)} dir ${dir}: arrived ${arrived}s, peak ${peak.toFixed(2)} m`);
    assert.ok(arrived >= 0 && arrived < 3, `over the parked car within 3 s (${arrived})`);
  }
});

test('a rider standing beside a wall, in a doorway or a corner is attacked from the open side within 4 s', () => {
  // City Hall's front (a no-effort spot a player found) and seeded sidewalk spots that touch a building wall
  const random = seededRandom('dorkins-walls'), spots = [[-1.81, 7.11]];
  const walkNodes = graph.walkLinks ? [...Array(walk.nodes).keys()] : [];
  for (let tries = 0; spots.length < 31 && tries < 4000; tries++) {
    const i = walkNodes[Math.floor(random() * walkNodes.length)], x = walk.nx[i], z = walk.nz[i], y = walk.ny[i];
    if (Math.abs(x) > 700 || !queries.allowed(x, z, y + 1.1)) continue;
    // a wall within 1.6 m: a horizontal sight ray at chest height is blocked in some direction
    let wall = false;
    for (let a = 0; a < 8 && !wall; a++) wall = !queries.clearLine({ x, y: y + 1.2, z }, { x: x + Math.sin(a * Math.PI / 4) * 1.6, y: y + 1.2, z: z + Math.cos(a * Math.PI / 4) * 1.6 });
    if (wall) spots.push([x, z]);
  }
  const failed = [];
  let worst = 0;
  for (const [x, z] of spots) {
    const ry = world.sampler.sampleGround(x, z, { normal: {} }, world.sampler.sampleGround(x, z, { normal: {} }, 300).height + 0.5).height;
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const obs = { x, y: ry, z, heading, vx: 0, vz: 0, speed: 0 };
      const brain = createFlightBrain(queries, graph), close = createCloseRange(queries);
      let placed = false;
      for (let a = 0; a < 16 && !placed; a++) { const px = x + Math.sin(a * 0.4) * 6, pz = z + Math.cos(a * 0.4) * 6;
        const g = world.sampler.sampleGround(px, pz, { normal: {} }, ry + 3); placed = Number.isFinite(g.height) && brain.place({ x: px, y: g.height + 1.1, z: pz }, 0); }
      if (!placed) continue;
      brain.seedObservation(obs, true);
      let ready = -1;
      for (let f = 0; f < 60 * 6 && ready < 0; f++) {
        const st = brain.state, d = Math.hypot(st.x - x, st.y - ry, st.z - z);
        const seen = queries.clearLine({ x: st.x, y: st.y + 0.9, z: st.z }, { x, y: ry + 1.2, z });
        const t0 = performance.now(), mode = close.update(1 / 60, st, seen ? obs : null, d); worst = Math.max(worst, performance.now() - t0);
        if (close.canStrike && d <= SWING.triggerRange && seen) ready = f / 60;
        else if (mode === 'reposition') brain.leave(1 / 60, close.target); else brain.update(1 / 60, obs, seen);
      }
      if (ready < 0 || ready > 4) failed.push(`(${x.toFixed(1)}, ${z.toFixed(1)}) heading ${heading.toFixed(2)}: ${ready < 0 ? 'none in 6 s' : ready.toFixed(1) + ' s'}`);
    }
  }
  console.log(`wall spots ${spots.length} x 4 headings; not attacked within 4 s: ${failed.length}${failed.length ? '\n  ' + failed.join('\n  ') : ''}; worst close step ${worst.toFixed(2)} ms`);
  assert.ok(spots.length >= 20, `spots ${spots.length}`);
  assert.ok(!failed.some(f => f.startsWith('(-1.8, 7.1)')), 'City Hall');
  assert.ok(failed.length <= Math.ceil(spots.length * 4 * 0.05), `${failed.length} of ${spots.length * 4} spots fail`);
});

test('people: a person standing in his way is passed over with margin, never through', () => {
  const y0 = world.sampler.sampleGround(-20, 30, { normal: {} }, 200).height;
  for (const dz of [0, 0.6, -0.6]) {
    const person = { x: -10, z: 30 + dz, headingY: 0, halfWidthMetres: 0.25, halfLengthMetres: 0.2, minY: y0, maxY: y0 + 1.8, velocityX: 0, velocityZ: 0, kind: 'person' };
    const brain = createFlightBrain(movingQueries([person]), graph);
    assert.ok(brain.place({ x: -21, y: y0 + 1.1, z: 30 }, Math.PI / 2));
    const obs = { x: 1, y: y0, z: 30, heading: Math.PI / 2, vx: 0, vz: 0 };
    let through = 0, crossed = -1;
    for (let f = 0; f < 60 * 6; f++) {
      brain.update(1 / 60, obs, true);
      if (inside(brain.state, person)) through++;
      if (crossed < 0 && brain.state.x > person.x + 2) crossed = f / 60;
    }
    assert.equal(through, 0, `never inside the person (offset ${dz})`);
    assert.ok(crossed > 0 && crossed < 3, `past the person within 3 s (${crossed})`);
  }
});

test('a comeback to a camper in the Calle Cementerio sally port comes through a mouth, not from beside the chamber', () => {
  const ground = (x, z, ref) => world.sampler.sampleGround(x, z, { normal: {} }, ref).height;
  const rider = { x: -343.7, y: ground(-343.7, -403.7, 14) + 0.6, z: -403.7 };
  // the two places a player found him stuck at (beside the passage, across the solid)
  for (const [x, z] of [[-332, -408.5]]) assert.equal(riderReachable(queries, { x, y: ground(x, z, 14) + 0.6, z }, rider, 3.5), false, `beside the chamber ${x},${z}`);
  // along the passage from each mouth at the rider's level
  const mouths = [[-338.39, -416.1], [-340.0, -413.19], [-347.89, -393.74], [-348.95, -388.29]].map(([x, z]) => ({ x, y: ground(x, z, 15) + 0.6, z }));
  const open = mouths.filter(m => riderReachable(queries, m, rider, 3.5));
  console.log(`sally port mouths reaching the camper: ${open.length}/${mouths.length}`);
  assert.ok(open.length >= 2, 'both ends of the passage reach the camper');
});

test('leaving the frame is a courtesy with a time limit: given up after 1.5 s, or at once when the rider is near and in sight', () => {
  assert.ok(EXIT_SECONDS <= 1.5);
  assert.equal(exitStep({ chasing: true, seconds: 0.2, near: false }), 'leave');
  assert.equal(exitStep({ chasing: true, seconds: 0.2, near: true }), 'abandon');
  assert.equal(exitStep({ chasing: true, seconds: EXIT_SECONDS + 0.01, near: false }), 'abandon');
  assert.equal(exitStep({ chasing: false, seconds: 0.2, near: false }), 'stop');
});

test('a comeback point behind masonry is out of view; one in the open is not', () => {
  const ground = (x, z, ref) => world.sampler.sampleGround(x, z, { normal: {} }, ref).height;
  // a camera a few metres behind a rider stopped inside the Calle Cementerio sally port, looking up the passage
  const eye = { x: -342.4, y: ground(-342.4, -407.5, 14) + 2.2, z: -407.5 };
  const outsideUpperMouth = { x: -352, y: ground(-352, -381.4, 30), z: -381.4 };
  const inPassage = { x: -345.0, y: ground(-345.0, -400.5, 14), z: -400.5 };
  assert.equal(hiddenFrom(queries, eye, inPassage), false, 'the passage ahead is seen');
  // beside the passage, across its wall: hidden
  assert.equal(hiddenFrom(queries, eye, { x: -332, y: ground(-332, -408.5, 14), z: -408.5 }), true, 'across the wall');
  console.log(`outside the upper mouth hidden: ${hiddenFrom(queries, eye, outsideUpperMouth)}`);
});

test('on the strip between the wall and the sea (Paseo del Morro) a strike set-up is always legal along the promenade', () => {
  const { strikeSpot, STRIKE_TURNS } = closeModule;
  const line = [[-310.4, 11.2], [-322.7, 3.9], [-342.7, -8.4], [-371.3, -28.8], [-410.1, -53.7], [-443.6, -63.6], [-479.9, -70.1]];
  for (let i = 0; i + 1 < line.length; i++) {
    const [x, z] = line[i], h = Math.atan2(line[i + 1][0] - x, line[i + 1][1] - z), y = world.sampler.sampleGround(x, z, { normal: {} }, 40).height;
    const legal = STRIKE_TURNS.filter(t => { const s = strikeSpot({ x, y, z, heading: h }, {}, SWING.swoopHeight, t); return queries.allowed(s.x, s.z, s.y); });
    assert.ok(legal.length >= 2, `set-ups at ${x},${z}: ${legal.length}`);
  }
});
