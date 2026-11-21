/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The vehicle kit's data and models: type sizes match the drawn models, triangle budgets per level of detail, crash
// slices inside each body, the fleet tables, liveries without real marks, and the per-instance look code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const vendor = (p) => new URL('../vendor/three/' + p, import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three/webgpu' || specifier === 'three') return { url: vendor('build/three.webgpu.js'), shortCircuit: true };
  if (specifier === 'three/tsl') return { url: vendor('build/three.tsl.js'), shortCircuit: true };
  if (specifier.startsWith('three/addons/')) return { url: vendor('examples/jsm/' + specifier.slice(13)), shortCircuit: true };
  return next(specifier, context);
} });
const M = await import('../js/sj-vehicle-models.js');
const { VEHICLE_TYPES, VEHICLE_TYPE_INDEX, FLEET, LIVERIES, PAINTS, WIDEST_VEHICLE, BODY_SECTIONS } = await import('../js/sj-vehicle-types.js');
const { vehicleLook } = await import('../js/sj-vehicles.js');
const { vehicleCrashSlices } = await import('../js/sj-actor-bodies.js');

const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
// Budget per instance (triangles): near body (wheels drawn apart), far stand-in with wheels, shadow caster.
const BUDGET = { near: 2700, far: 620, caster: 420, wheel: 300 };   // far: the service pickup's rack adds ~110

test('every type has a model whose measured size is the table size', () => {
  assert.equal(Object.keys(M.SJ_SPECS).length, VEHICLE_TYPES.length);
  for (const t of VEHICLE_TYPES) {
    const spec = M.SJ_SPECS[t.id];
    assert.ok(spec, t.id);
    const g = M.buildCarGeometry(spec, false);
    g.computeBoundingBox();
    const b = g.boundingBox, d = M.carDimensions(spec);
    const zr = Math.min(b.min.z, spec.zRear), zf = Math.max(b.max.z, spec.zFront);
    assert.ok(Math.abs(zf - zr - t.length) < 0.011, `${t.id} length ${zf - zr}`);
    assert.ok(Math.abs(2 * d.halfWidth - t.width) < 0.011, `${t.id} width`);
    assert.ok(Math.abs(b.max.y - t.height) < 0.011, `${t.id} height ${b.max.y}`);
    assert.ok(Math.abs(spec.wheelZ - t.axle) < 0.002 && Math.abs(spec.wheelRadius - t.wheelRadius) < 0.002 && Math.abs(spec.wheelX - t.track) < 0.002, t.id);
    assert.ok(Math.abs(-(zf + zr) / 2 - t.axleOffset) < 0.002, `${t.id} axleOffset`);
    for (const a of ['position', 'normal', 'uv', 'partId']) assert.ok(g.attributes[a], `${t.id} ${a}`);
    for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v), `${t.id} finite`);
  }
  assert.equal(WIDEST_VEHICLE, Math.max(...VEHICLE_TYPES.map((t) => t.width)));
});

test('triangle census per type and level of detail stays inside the budget', () => {
  const rows = {};
  for (const t of VEHICLE_TYPES) {
    const spec = M.SJ_SPECS[t.id];
    const near = tri(M.buildCarGeometry(spec, false)), far = tri(M.buildCarProxyGeometry(spec)), caster = tri(M.buildCarCasterGeometry(spec));
    rows[t.id] = { near, far, caster };
    assert.ok(near <= BUDGET.near && far <= BUDGET.far && caster <= BUDGET.caster, `${t.id} ${near}/${far}/${caster}`);
  }
  const wheel = tri(M.buildSteerableWheelGeo(M.SJ_SPECS.sedan, 1));
  assert.ok(wheel <= BUDGET.wheel);
  // A near car with its four wheels stays below the New York edition's (about 3.5k).
  for (const [id, r] of Object.entries(rows)) assert.ok(r.near + 4 * wheel < 3700, id);
});

test('crash slices lie inside each body and cover its length', () => {
  for (const t of VEHICLE_TYPES) {
    const spec = M.SJ_SPECS[t.id];
    const slices = vehicleCrashSlices(M.buildCarGeometry(spec, false, false), spec);
    assert.ok(slices.length >= 6, t.id);
    let lo = Infinity, hi = -Infinity;
    for (const s of slices) {
      // mirrors stand out from the body (the cargo van's most: 0.25 m a side)
      assert.ok(s.halfWidthMetres > 0.5 && s.halfWidthMetres <= t.width / 2 + 0.3, `${t.id} width ${s.halfWidthMetres}`);
      assert.ok(s.minY >= -0.01 && s.maxY <= t.height + 0.01 && s.maxY > s.minY, `${t.id} height`);
      lo = Math.min(lo, s.z - s.halfLengthMetres); hi = Math.max(hi, s.z + s.halfLengthMetres);
    }
    assert.ok(hi - lo > t.length - 0.6 && hi - lo < t.length + 0.6, `${t.id} span ${hi - lo}`);
  }
});

test('fleet tables: weights, known types and liveries, no real marks in the vehicle sources', () => {
  for (const key of ['moving', 'parked']) assert.equal(FLEET.reduce((s, f) => s + f[key], 0), 100, key);
  for (const f of FLEET) { assert.ok(f.type in VEHICLE_TYPE_INDEX, f.type); assert.ok(LIVERIES.includes(f.livery), f.livery); }
  assert.deepEqual(LIVERIES, Object.keys(M.LIVERY_CODE));
  assert.equal(PAINTS.reduce((s, p) => s + p.weight, 0), 100);
  // Words the liveries may carry, and names that must never appear (makers, agencies, other cities' cues).
  const sources = ['sj-vehicle-models.js', 'sj-vehicles.js', 'sj-vehicle-types.js', 'sj-parking-layout.js']
    .map((f) => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8'));
  const forbidden = /\b(NYPD|TLC|MTA|Toyota|Honda|Ford|Mercedes|Sprinter|Jeep|Chevrolet|Nissan|Hyundai|Kia|Tesla|Uber|Lyft|Coca|Manhattan|medallion)\b/i;
  for (const text of sources) assert.ok(!forbidden.test(text), text.match(forbidden)?.[0]);
  const models = sources[0];
  const words = [...models.matchAll(/\['([A-ZÁÉÍÓÚ]+)', \d+\]/g)].map((m) => m[1]);
  assert.deepEqual(words, ['TAXI', 'POLICÍA']);
  assert.ok(!/fillText\((?!word)/.test(models), 'only the livery words are written');
});

test('look code: liveries fix their paint, running sets the lamps bit, the same inputs give the same look', () => {
  const out = new Float32Array(3), again = new Float32Array(3);
  const T = VEHICLE_TYPE_INDEX;
  const code = (s) => ({ livery: s & 7, trim: (s >> 4) & 3, running: s >> 8 });
  const patrol = code(vehicleLook(T.crossover, LIVERIES.indexOf('patrol'), 5, 3, true, out, 0));
  assert.equal(patrol.livery, M.LIVERY_CODE.patrol); assert.equal(patrol.running, 1);
  assert.ok(out[0] > 0.8 && out[1] > 0.8 && out[2] > 0.8, 'patrol is white');
  const taxi = code(vehicleLook(T.van, LIVERIES.indexOf('taxi'), 2, 9, false, out, 0));
  assert.equal(taxi.livery, M.LIVERY_CODE.taxi); assert.equal(taxi.running, 0);
  assert.ok(out[0] > 0.8, 'taxi is white');
  let rails = 0;
  for (let seed = 0; seed < 200; seed++) {
    const a = vehicleLook(T.crossover, 0, seed % 8, seed, false, out, 0), b = vehicleLook(T.crossover, 0, seed % 8, seed, false, again, 0);
    assert.equal(a, b); assert.deepEqual([...out], [...again]);
    if (code(a).trim === M.TRIM_CODE.rails) rails++;
  }
  assert.ok(rails > 20 && rails < 100, `rails on a minority of crossovers: ${rails}/200`);
});

test('parked-car solid sections equal the drawn body sections, cover the body and stay below its roof', () => {
  for (const t of VEHICLE_TYPES) {
    const secs = BODY_SECTIONS[t.id];
    const fresh = M.bodySections(M.SJ_SPECS[t.id], t);
    assert.equal(fresh.length, secs.length, t.id);
    fresh.forEach((s, i) => s.forEach((v, k) => assert.ok(Math.abs(v - secs[i][k]) < 0.006, `${t.id} section ${i}`)));
    for (let i = 1; i < secs.length; i++) assert.ok(Math.abs(secs[i][0] - secs[i - 1][1]) < 0.011, `${t.id} gap`);
    for (const [, , hw, top] of secs) assert.ok(hw <= t.width / 2 + 0.005 && top <= t.height + 0.005, t.id);
    const roof = Math.max(...secs.map((s) => s[3]));
    assert.ok(roof - secs.at(-1)[3] > 0.25, `${t.id}: the bonnet is lower than the roof`);
  }
});
