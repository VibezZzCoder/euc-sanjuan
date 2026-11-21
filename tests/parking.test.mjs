/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Parked cars (js/sj-parking-layout.js) on the built world: every car on its road's parking strip and nowhere it must
// not be, the moving lanes free, the arrivals unchanged, the only new solids the parked cars, the same city every run.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three/webgpu') return { url: new URL('../vendor/three/build/three.webgpu.js', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
globalThis.fetch = async (url) => { const b = readFileSync(url); return { ok: true, json: async () => JSON.parse(b), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadCity, areasOf } = await import('../js/sj-world.js');
const sidesModule = await import('../js/sj-street-sides.js');
const { DRIVE_KINDS, PARK, parkingSide, parkedOffset, laneOffsets, isOneWay, flowSign } = sidesModule;
const { VEHICLE_TYPES, WIDEST_VEHICLE, BODY_SECTIONS } = await import('../js/sj-vehicle-types.js');
const { buildLaneGraph } = await import('../js/sj-traffic-graph.js');
const { RESERVE, footprint, rectRingOverlap } = await import('../js/sj-parking-layout.js');

const world = await loadCity();
const again = await loadCity();
globalThis.location = { search: '?parked=0' };
const bare = await loadCity();
delete globalThis.location;
const { city } = world, roads = city.roads, cars = world.parking.list;
const inRing = (x, z, r) => { let a = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0] ?? r[i].x, zi = r[i][1] ?? r[i].z, xj = r[j][0] ?? r[j].x, zj = r[j][1] ?? r[j].z; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) a = !a; } return a; };
const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)) : 0; return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
const roadDist = (x, z, r) => { let d = Infinity; for (let k = 1; k < r.points.length; k++) d = Math.min(d, segDist(x, z, r.points[k - 1], r.points[k])); return d; };
// Points filling a car's footprint (0.3 m grid, edges included).
function fill(c) {
  const t = VEHICLE_TYPES[c.type], s = Math.sin(c.heading), k = Math.cos(c.heading), out = [];
  for (let v = -t.length / 2; v <= t.length / 2 + 1e-6; v += t.length / 14) for (let u = -t.width / 2; u <= t.width / 2 + 1e-6; u += t.width / 6) out.push([c.x + s * v + k * u, c.z + k * v - s * u]);
  return out;
}

test('a city-wide count in the planned range, mostly at the kerbs, the same every run', () => {
  const q = world.parking.qa();
  assert.ok(cars.length >= 250 && cars.length <= 450, `cars ${cars.length}`);
  assert.ok(q.kerb >= 180, `kerb ${q.kerb}`);
  assert.deepEqual([...again.parking.cars.records], [...world.parking.cars.records]);
  assert.equal(bare.parking, null);
});

test('kerb cars stand on their road\'s parking strip, facing the traffic, clear of junctions and stair or plaza mouths', () => {
  // Junction nodes recomputed here: a drive road's vertex another road also passes through.
  const nodes = [];
  roads.forEach((r, i) => r.points.forEach((p, k) => nodes.push({ p, i, kind: r.kind, end: k === 0 || k === r.points.length - 1 })));
  for (const c of cars.filter((c) => c.road >= 0)) {
    const road = roads[c.road], t = VEHICLE_TYPES[c.type], side = parkingSide(road, c.road);
    assert.ok(DRIVE_KINDS.has(road.kind) && side !== 0, `${c.road} has no parking side`);
    // lateral position: the parked offset from the centre line, on the parking side
    const off = parkedOffset(road, c.road, t.width), d = roadDist(c.x, c.z, road);
    assert.ok(Math.abs(d - Math.abs(off)) < 0.12, `${road.name} lateral ${d.toFixed(2)} vs ${off.toFixed(2)}`);
    for (const [x, z] of footprint(c.x, c.z, c.heading, t.length, t.width)) assert.ok(roadDist(x, z, road) <= road.width / 2 - 0.1, `${road.name} corner past the kerb`);
    // facing: along the flow on one-way streets
    let best = 1, k = 1;
    for (let j = 1; j < road.points.length; j++) { const e = segDist(c.x, c.z, road.points[j - 1], road.points[j]); if (e < best || j === 1) { best = e; k = j; } }
    const a = road.points[k - 1], b = road.points[k], along = Math.sin(c.heading) * (b[0] - a[0]) + Math.cos(c.heading) * (b[1] - a[1]);
    const want = isOneWay(road) ? flowSign(road) : side;
    assert.ok(Math.sign(along) === want, `${road.name} facing`);
    for (const n of nodes) {
      if (n.i === c.road) continue;
      const touches = road.points.some((q) => Math.hypot(q[0] - n.p[0], q[1] - n.p[1]) < 1);
      if (!touches) continue;
      const dist = Math.hypot(c.x - n.p[0], c.z - n.p[1]) - t.length / 2;
      const need = DRIVE_KINDS.has(n.kind) ? PARK.junctionClear : n.kind === 'steps' ? 9 : 6;
      assert.ok(dist >= need - 0.6, `${road.name}: ${dist.toFixed(1)} m from a ${n.kind} node`);
    }
    for (const r of roads) if (r.kind === 'steps') for (const p of [r.points[0], r.points.at(-1)]) assert.ok(Math.hypot(c.x - p[0], c.z - p[1]) > 9, `${road.name} by a stair`);
  }
});

test('no car on the sea, closed ground, the reserve or the roads beside it, a raised floor or another solid', () => {
  const areas = areasOf(world), off = areas.map((a) => a.offLimitsAt).filter(Boolean);
  const reserveIds = new Set(RESERVE.roads);
  const solids = [...world.plaza.colliders, ...world.corridor.colliders, ...world.gate.colliders, ...world.fort.colliders, ...areas.flatMap((a) => a.colliders ?? [])];
  const buildings = city.buildings.map((b) => ({ outer: b.outer, minY: b.base, maxY: b.roof }));
  const rings = [...solids, ...buildings].map((c) => {
    if (c.outer) return { ring: c.outer, minY: c.minY, maxY: c.maxY };
    if (c.centre) { const r = c.rotationY ?? 0, s = Math.sin(r), k = Math.cos(r), h = c.halfExtents; return { ring: [[-h.x, -h.z], [h.x, -h.z], [h.x, h.z], [-h.x, h.z]].map(([u, v]) => [c.centre.x + u * k + v * s, c.centre.z - u * s + v * k]), minY: c.centre.y - h.y, maxY: c.centre.y + h.y }; }
    return null;
  }).filter(Boolean).map((r) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of r.ring) { const x = p[0] ?? p.x, z = p[1] ?? p.z; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { ...r, x0, x1, z0, z1 }; });
  const grid = new Map(), cell = 16, key = (i, j) => i * 100003 + j;
  for (const r of rings) for (let i = Math.floor(r.x0 / cell); i <= Math.floor(r.x1 / cell); i++) for (let j = Math.floor(r.z0 / cell); j <= Math.floor(r.z1 / cell); j++) {
    if (!grid.has(key(i, j))) grid.set(key(i, j), []);
    grid.get(key(i, j)).push(r);
  }
  for (const c of cars) {
    const t = VEHICLE_TYPES[c.type], pts = fill(c);
    if (c.road >= 0) assert.ok(!reserveIds.has(roads[c.road].id), 'reserve road');
    assert.ok(Math.hypot(c.x - RESERVE.point[0], c.z - RESERVE.point[1]) > RESERVE.radius, 'reserve point');
    for (const ring of RESERVE.rings) assert.ok(!rectRingOverlap(footprint(c.x, c.z, c.heading, t.length, t.width, 1), ring), 'reserve lot');
    for (const [x, z] of pts) {
      assert.ok(world.isDry(x, z), 'sea');
      const y = world.height(x, z);
      for (const f of off) assert.ok(!f(x, z, y), `closed ground at ${x.toFixed(1)},${z.toFixed(1)}`);
      for (const r of grid.get(key(Math.floor(x / cell), Math.floor(z / cell))) ?? []) {
        if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1 || r.maxY < y - 0.3 || r.minY > y + t.height) continue;
        assert.ok(!inRing(x, z, r.ring), `a solid under the car at ${x.toFixed(1)},${z.toFixed(1)}`);
      }
      // the drawn ground is the terrain: no raised floor under the car
      const g = world.sampler.sampleGround(x, z, { normal: {} }, y + 0.35);
      assert.ok(Math.abs(g.height - y) < 0.05, `raised floor under the car at ${x.toFixed(1)},${z.toFixed(1)}`);
    }
  }
  // Cars apart from each other
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 7) continue;
    const ta = VEHICLE_TYPES[a.type], tb = VEHICLE_TYPES[b.type];
    assert.ok(!rectRingOverlap(footprint(a.x, a.z, a.heading, ta.length + 0.4, ta.width), footprint(b.x, b.z, b.heading, tb.length, tb.width)), 'cars overlap');
  }
});

test('the moving lane of every road is free of parked cars for the widest vehicle', () => {
  const half = WIDEST_VEHICLE / 2;
  let checked = 0;
  roads.forEach((road, i) => {
    if (!DRIVE_KINDS.has(road.kind)) return;
    const near = cars.filter((c) => roadDist(c.x, c.z, road) < road.width);
    if (!near.length) return;
    for (const lane of laneOffsets(road, i)) {
      for (let k = 1; k < road.points.length; k++) {
        const a = road.points[k - 1], b = road.points[k], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        for (let s = 0; s <= l; s += 1) {
          const x = a[0] + dx * s / l - dz / l * lane.offset, z = a[1] + dz * s / l + dx / l * lane.offset;
          for (const c of near) {
            const t = VEHICLE_TYPES[c.type], sn = Math.sin(c.heading), cs = Math.cos(c.heading), ex = x - c.x, ez = z - c.z;
            const u = Math.abs(ex * cs - ez * sn) - t.width / 2, v = Math.abs(ex * sn + ez * cs) - t.length / 2;
            const d = Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0);
            if (c.road === i) assert.ok(d >= half, `${road.name} lane at ${x.toFixed(1)},${z.toFixed(1)}: ${d.toFixed(2)} m`);
            checked++;
          }
        }
      }
    }
  });
  assert.ok(checked > 1000);
});

test('arrivals and the spawn are unchanged, and the only new solids are the parked cars', () => {
  const places = (w) => [...w.city.places, ...w.corridor.places, ...(w.gate.places ?? []), ...(w.fort.places ?? []), ...areasOf(w).flatMap((a) => a.places ?? [])];
  // the host's arrival rule (js/main.js findArrival)
  const arrival = (w, p, h) => w.sampler.findPlacementTarget({ x: p.x, z: p.z, headingY: h, referenceY: w.height(p.x, p.z), maxStepUp: 0.216 });
  function find(w, point) {
    const segs = [];
    for (const road of w.city.roads) if (road.kind !== 'steps') for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 8) continue;
      const f = Math.max(0, Math.min(1, ((point.x - a[0]) * dx + (point.z - a[1]) * dz) / (length * length)));
      const x = a[0] + dx * f, z = a[1] + dz * f; segs.push({ x, z, d: Math.hypot(x - point.x, z - point.z), heading: Math.atan2(dx, dz) });
    }
    segs.sort((a, b) => a.d - b.d);
    for (const s of segs.slice(0, 24)) {
      if (s.d > 35) continue;
      for (const heading of [s.heading, s.heading + Math.PI]) {
        const start = arrival(w, s, heading); if (!start) continue;
        let clear = true;
        for (let d = 0.5; d <= 16; d += 0.5) if (!arrival(w, { x: start.x + Math.sin(heading) * d, z: start.z + Math.cos(heading) * d }, heading)) { clear = false; break; }
        if (clear) return [+start.x.toFixed(4), +start.z.toFixed(4), +start.y.toFixed(4), +heading.toFixed(4)];
      }
    }
    return null;
  }
  const a = places(world).map((p) => find(world, p)), b = places(bare).map((p) => find(bare, p));
  assert.ok(a.filter(Boolean).length >= 25);
  assert.deepEqual(a, b);
  // Solids: the parked world's sampler holds the bare world's colliders plus one prism per body section of each car.
  const parked = world.parking.colliders;
  assert.ok(parked.length >= cars.reduce((n, c) => n + BODY_SECTIONS[VEHICLE_TYPES[c.type].id].length, 0));
  for (const c of parked) assert.ok(c.parkedCar && c.support === false && c.outer.length === 4 && c.maxY > c.minY);
  // every parked car blocks the rider's hull at its centre, and the bare world is clear there
  for (const c of cars.slice(0, 60)) {
    const y = world.height(c.x, c.z);
    const body = { x: c.x, z: c.z, headingY: 0, halfWidthMetres: 0.25, halfLengthMetres: 0.25, minY: y + 0.3, maxY: y + 1.2 };
    assert.equal(world.sampler.isVolumeClear(body), false, 'parked car is solid');
    assert.equal(bare.sampler.isVolumeClear(body), true, 'nothing else there');
  }
});

// World height of a section's top at footprint-relative z (the kit's pose: the body pitched and rolled about the centre).
const sectionTop = (c, z, top, hw) => c.y + z * Math.sin(c.pitch) + top * Math.cos(c.pitch) + hw * Math.abs(Math.sin(c.roll));

test('parked solids follow the drawn body: open air over a bonnet, solid at the cabin, no roof-height ends', () => {
  const S = world.sampler, down = { x: 0, y: -1, z: 0 };
  let bonnets = 0;
  for (const c of cars) {
    const t = VEHICLE_TYPES[c.type], secs = BODY_SECTIONS[t.id], sn = Math.sin(c.heading), cs = Math.cos(c.heading);
    const at = (v, u = 0) => ({ x: c.x + sn * v + cs * u, z: c.z + cs * v - sn * u });
    // 25 cm inside each end the solid's top is the drawn section's top (within 5 cm), never the roof
    for (const [v, sec] of [[secs[0][0] + 0.25, secs[0]], [secs.at(-1)[1] - 0.25, secs.at(-1)]]) {
      const q = at(v), from = { x: q.x, y: c.y + 4, z: q.z }, d = S.raycast(from, down, 6, true);
      assert.ok(d !== null, 'end is solid');
      const here = secs.filter((x) => x[0] - 0.01 <= v && v <= x[1] + 0.01);   // a section boundary takes the higher
      const top = from.y - d, want = Math.max(...here.map((x) => sectionTop(c, v, x[3], x[2])));
      assert.ok(top <= want + 0.05, `${t.id} at ${c.x.toFixed(1)},${c.z.toFixed(1)} v ${v.toFixed(2)}: ${(top - want).toFixed(3)} m above the drawn body (pitch ${c.pitch.toFixed(3)}, roll ${c.roll.toFixed(3)})`);
      const roof = Math.max(...secs.map((x) => x[3]));
      if (roof - sec[3] > 0.5) assert.ok(top < sectionTop(c, v, roof, 0) - 0.4, `${t.id} end at roof height`);
    }
    // A ray across the car just above the bonnet passes; one at mid-cabin height hits. The bare world is open there.
    const nose = secs.at(-1), cabin = secs.reduce((a, b) => (b[3] > a[3] ? b : a));
    if (nose[3] < cabin[3] - 0.4) {
      const v = (nose[0] + nose[1]) / 2, q = at(v, t.width / 2 + 0.3), y = sectionTop(c, v, nose[3], nose[2]) + 0.12, L = t.width + 0.6;
      const dir = { x: -cs, y: 0, z: sn };   // toward the car's right, through it
      if (bare.sampler.raycast({ x: q.x, y, z: q.z }, dir, L, true) === null) {
        { const hit = S.raycast({ x: q.x, y, z: q.z }, dir, L, true); assert.equal(hit, null, `${t.id} at ${c.x.toFixed(1)},${c.z.toFixed(1)} bonnet ray blocked at ${hit?.toFixed(2)} (y ${y.toFixed(2)}, pitch ${c.pitch.toFixed(3)} roll ${c.roll.toFixed(3)})`); }
        bonnets++;
      }
    }
    const v = (cabin[0] + cabin[1]) / 2, q = at(v, t.width / 2 + 0.3), y = sectionTop(c, v, cabin[3], 0) - 0.3, L = t.width + 0.6;
    if (bare.sampler.raycast({ x: q.x, y, z: q.z }, { x: -cs, y: 0, z: sn }, L, true) === null) {
      const d = S.raycast({ x: q.x, y, z: q.z }, { x: -cs, y: 0, z: sn }, L, true);
      assert.ok(d !== null && Math.abs(d - (t.width / 2 + 0.3 - cabin[2])) < 0.2, `${t.id} cabin ray ${d}`);
    }
  }
  assert.ok(bonnets > 150, `bonnet rays checked: ${bonnets}`);
});

test('the traffic lane graph is the same with and without parked cars (lanes, lane kilometres, slides)', () => {
  // Long bodies (pickups, vans) are swept separately: a parked row may keep them off a narrow lane that short cars
  // still use, so those two figures are compared with a small allowance instead of exactly.
  const strip = (g) => { const { buildMs, longLanes, longKm, ...rest } = g.stats; void buildMs; void longLanes; void longKm; return rest; };
  const a = buildLaneGraph(world, sidesModule), b = buildLaneGraph(bare, sidesModule);
  assert.deepEqual(strip(a), strip(b));
  if (b.stats.longKm !== undefined) {
    assert.ok(a.stats.longKm >= b.stats.longKm * 0.94, `long-vehicle lanes lost to parked cars: ${a.stats.longKm} of ${b.stats.longKm} km`);
  }
  assert.deepEqual([...a.SX], [...b.SX]); assert.deepEqual([...a.SZ], [...b.SZ]);
});

test('no wheel off twisted ground, one long broken line on San Sebastián, bay paint only on the lots', () => {
  for (const c of cars) {
    const t = VEHICLE_TYPES[c.type], s = Math.sin(c.heading), k = Math.cos(c.heading), ox = s * t.axleOffset, oz = k * t.axleOffset;
    const h = (u, v) => world.height(c.x + ox + s * v + k * u, c.z + oz + k * v - s * u);
    const twist = Math.abs(h(t.track, t.axle) - h(-t.track, t.axle) - h(t.track, -t.axle) + h(-t.track, -t.axle)) / 4;
    assert.ok(twist <= 0.05 + 1e-6, `wheel ${twist.toFixed(3)} m off the ground at ${c.x.toFixed(1)},${c.z.toFixed(1)}`);
  }
  const row = cars.filter((c) => c.road === 207).sort((a, b) => a.s - b.s);
  let best = 0, run = 0, end = -Infinity;
  for (const c of row) { run = c.s - end > 2.5 ? 1 : run + 1; best = Math.max(best, run); end = c.s + VEHICLE_TYPES[c.type].length; }
  assert.ok(best >= 6 && best <= 8, `longest San Sebastián group ${best}`);
  const L = world.parking.lines;
  assert.ok(L.count > 100);
  for (let i = 0; i < L.count; i++) {
    const x = L.records[i * 6], z = L.records[i * 6 + 2];
    assert.ok(world.isDry(x, z) && Math.abs(L.records[i * 6 + 1] - world.height(x, z)) <= 0.06, `bay line at ${x.toFixed(1)},${z.toFixed(1)}`);
  }
});
