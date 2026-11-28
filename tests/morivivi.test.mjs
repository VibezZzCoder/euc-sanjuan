/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Moriviví on the fort lawns (js/sj-morivivi-rules.js, js/sj-morivivi.js): where the mats grow (grass only, off the
// walks, clear of solids and of the kite field, seeded, near the photographed spots), how they sit on the rolling lawn,
// and how they fold and open again. CPU only.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const V = new URL('../vendor/three/', import.meta.url).href;
registerHooks({ resolve(s, c, next) {
  if (s === 'three' || s === 'three/webgpu') return { url: V + 'build/three.webgpu.js', shortCircuit: true };
  if (s === 'three/tsl') return { url: V + 'build/three.tsl.js', shortCircuit: true };
  if (s.startsWith('three/addons/')) return { url: V + 'examples/jsm/' + s.slice(13), shortCircuit: true };
  return next(s, c);
} });
globalThis.fetch = async (url) => { const b = readFileSync(url); return { ok: true, json: async () => JSON.parse(b), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { loadCity } = await import('../js/sj-world.js');
const world = await loadCity();
const THREE = await import('three/webgpu');
const { createPeople } = await import('../js/sj-people.js');
const { seededRandom } = await import('../js/sj-life-random.js');
const { createActorBodyIndex } = await import('../js/sj-actor-bodies.js');
const R = await import('../js/sj-morivivi-rules.js');
const { createMorivivi, NOTE } = await import('../js/sj-morivivi.js');
const { atmosphere } = await import('../js/sj-atmosphere.js');

const lawn = world.city.places.find((p) => /El Morro/.test(p.name));
const context = { scene: new THREE.Scene(), world, atmosphere: null, renderer: null, phone: false, params: new URLSearchParams(), caps: { cars: 40, people: 180 },
  rider: { valid: true, x: 400, y: 0, z: 400, heading: 0, vx: 0, vz: 0, speed: 0, crashed: false, minY: -100, maxY: -98, halfWidth: 0.35, halfLength: 0.5 },
  focus: { x: lawn.x, z: lawn.z, serial: 1 }, hour: { name: 'golden', night: 0 }, bodies: createActorBodyIndex(16), random: seededRandom, sides: null, kit: null, clear: { rider: 14 } };
const people = await createPeople(context);
const A = people.debug.accents, net = people.debug.net;
const scene = new THREE.Scene();
const plant = createMorivivi({ world, net, accents: A, scene });
const { mats, drifts } = plant;
const { sampler, isDry, height } = world, probe = { normal: {} };

test('the moriviví grows in drifts on both fort lawns, near where it was photographed, the same on every load', () => {
  const again = R.placeMorivivi({ world, net, accents: A });
  assert.deepEqual(again.mats, mats, 'seeded: the same mats on every load');
  const by = (n) => mats.filter((m) => m.lawn === n);
  assert.ok(by('morro').length >= 60 && by('cristobal').length >= 12, `mats ${by('morro').length} El Morro / ${by('cristobal').length} San Cristóbal`);
  assert.ok(mats.length <= 170, `${mats.length} mats: a scatter, not a carpet`);
  for (const d of drifts) assert.ok(d.mats >= 2 && d.mats <= 6, `drift ${d.index} of ${d.mats}`);
  for (const m of mats) {
    assert.ok(m.r * 2 * 0.68 >= 0.6 && m.r * 2 <= 2.4, `a mat ${(m.r * 2).toFixed(2)} m across`);
    assert.ok(Math.max(...m.outline) / Math.min(...m.outline) >= 1.2, 'an irregular outline, never a disc');
    assert.ok(m.wait >= R.FOLD.waitMin && m.wait <= R.FOLD.waitMax);
  }
  const dry = mats.filter((m) => m.dry).length / mats.length;
  assert.ok(dry > 0.1 && dry < 0.32, `${(dry * 100).toFixed(0)}% purplish-bronze mats`);
  // a drift within 15 m of each photographed spot that is public lawn (El Morro); the hero drift of photo 101
  // photo 101's drift: on the esplanade lawn at the lip of the moat, the lighthouse across the moat, near the photographed
  // spot (the spot itself is on the moat floor: "on the lawn, not in the moat" wins)
  const hero = drifts.find((d) => d.hero), rings = R.moatRings(world);
  assert.ok(hero && hero.mats >= 5 && Math.hypot(hero.x + 756, hero.z + 567) <= 60, 'the hero drift near photo 101');
  const low = R.moatGround(world, rings), L = [-729.55, -611.96], hl = Math.hypot(L[0] - hero.x, L[1] - hero.z);
  assert.ok(!low(hero.x, hero.z, height(hero.x, hero.z)), 'the hero drift on the esplanade, not at the moat\'s floor level');
  let lip = -1; for (let t = 1; t <= 9 && lip < 0; t += 0.5) { const x = hero.x + (L[0] - hero.x) / hl * t, z = hero.z + (L[1] - hero.z) / hl * t; if (low(x, z, height(x, z))) lip = t; }
  assert.ok(lip >= 2, `the moat's lip ${lip} m in front of the hero drift, towards the lighthouse`);
  // a drift within 15 m of each El Morro spot on the lawn; spots on the moat floor (101, 103, 104) yield to the lawn rule
  for (const s of R.SPOTS.filter((s) => s.lawn === 'morro')) {
    const reach = R.moatDistance(rings, s.x, s.z) < 5 ? 60 : 15;
    assert.ok(drifts.some((d) => Math.hypot(d.x - s.x, d.z - s.z) <= reach), `a drift within ${reach} m of photo ${s.photo}`);
  }
  // San Cristóbal's photographed spots are inside the closed fort: its drifts stand on the nearest public grass
  for (const s of R.SPOTS.filter((s) => s.lawn === 'cristobal')) {
    const g = sampler.cityGround(s.x, s.z, probe, height(s.x, s.z) + 0.35);
    assert.ok(sampler.offLimitsAt(s.x, s.z, g.height), `photo ${s.photo}'s spot is inside the fort`);
  }
});

test('nothing in a moat: El Morro\'s moat floor and north terrace and San Cristóbal\'s great moat, for the whole footprint and every drawn vertex', () => {
  const rings = R.moatRings(world);
  assert.ok(rings.length >= 3, 'El Morro\'s two moat lawns and San Cristóbal\'s great moat');
  const low = R.moatGround(world, rings);
  for (const [i, m] of mats.entries()) {
    const d = R.moatDistance(rings, m.x, m.z);
    assert.ok(d >= R.reachOf(m), `mat ${i} reaches ${(R.reachOf(m) - d).toFixed(2)} m into a moat`);
    // and not on the moat's unmapped continuation at floor level, anywhere under its outline and overhang
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, rr = R.outlineAt(m, a) + 0.25, x = m.x + Math.cos(a) * rr, z = m.z + Math.sin(a) * rr;
      assert.ok(!low(x, z, height(x, z)), `mat ${i} on moat ground at ${x.toFixed(1)}, ${z.toFixed(1)}`); }
  }
  for (const name of ['morro', 'cristobal']) {
    const P = scene.getObjectByName('Morivivi-' + name).geometry.attributes.position.array;
    let inside = 0; for (let v = 0; v < P.length; v += 3) if (R.moatDistance(rings, P[v], P[v + 2]) < 0) inside++;
    assert.equal(inside, 0, `${inside} drawn vertices in a moat (${name})`);
  }
});

test('the walks of the El Morro lawn: never long without a mat near the walk', () => {
  // independent of the placement raster: lawn beside a walk is drawn grass, dry, open and not a moat
  const rings = R.moatRings(world), low = R.moatGround(world, rings);
  const grass = (x, z) => world.isDry(x, z) && !low(x, z, height(x, z)) && sampler.cityGround(x, z, probe, height(x, z) + 0.35).surface === 'grass' && !sampler.offLimitsAt(x, z, height(x, z));
  const walks = R.lawnWalks(net, grass);
  const morro = mats.filter((m) => m.lawn === 'morro');
  let metres = 0;
  for (const line of walks) {
    const samples = R.walkSamples(line);
    const side = samples.map((p) => [2, 4, 6, 8].some((o) => grass(p.x + p.nx * o, p.z + p.nz * o) || grass(p.x - p.nx * o, p.z - p.nz * o)) ? 1 : 0);
    metres += side.reduce((a, b) => a + b, 0);
    const dist = R.nearestMat(samples, morro);
    const near = R.gapRuns(dist, side, R.GAPS.near)[0], far = R.gapRuns(dist, side, R.GAPS.far)[0];
    const where = (g) => g ? `${g.length} m from (${samples[g.from].x.toFixed(0)}, ${samples[g.from].z.toFixed(0)})` : 'none';
    assert.ok(!near || near.length <= R.GAPS.nearRun, `no mat within ${R.GAPS.near} m for ${where(near)}`);
    assert.ok(!far || far.length <= R.GAPS.farRun, `no mat within ${R.GAPS.far} m for ${where(far)}`);
  }
  assert.ok(metres > 600, `${metres} m of lawn-side walk measured`);
});

test('every mat on open lawn: off the walks and paving, clear of closed places, solids, soft bodies and the kite field', () => {
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0, halfLengthMetres: 0, minY: 0, maxY: 0 };
  let samples = 0;
  for (const [i, m] of mats.entries()) {
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2, f = [1, 0.66, 0.33, 0][k % 4], r = R.outlineAt(m, a) * f + (f === 1 ? 0.05 : 0);
      const x = m.x + Math.cos(a) * r, z = m.z + Math.sin(a) * r;
      assert.ok(isDry(x, z), `mat ${i} in the sea`);
      const g = sampler.cityGround(x, z, probe, height(x, z) + 0.35);
      assert.equal(g.surface, 'grass', `mat ${i} on ${g.surface} at ${x.toFixed(1)},${z.toFixed(1)}`);
      assert.ok(Math.abs(g.height - height(x, z)) < 0.006, `mat ${i} on a built surface`);
      assert.ok(!sampler.offLimitsAt(x, z, g.height), `mat ${i} in a closed place`);
      assert.ok(!(world.softBodies?.contains?.(x, g.height + 0.3, z)), `mat ${i} in a shrub`);
      samples++;
    }
    body.x = m.x; body.z = m.z; body.halfWidthMetres = body.halfLengthMetres = m.r; body.minY = m.y + 0.1; body.maxY = m.y + 0.6;
    assert.ok(sampler.isVolumeClear(body), `mat ${i} under a solid`);
    // off every walk's corridor
    for (let k = 0; k < net.links; k++) {
      const ax = net.nx[net.a[k]], az = net.nz[net.a[k]];
      if (Math.abs(ax - m.x) > net.len[k] + 10 || Math.abs(az - m.z) > net.len[k] + 10) continue;
      const t = Math.max(0, Math.min(net.len[k], (m.x - ax) * net.dirX[k] + (m.z - az) * net.dirZ[k]));
      assert.ok(Math.hypot(m.x - ax - net.dirX[k] * t, m.z - az - net.dirZ[k] * t) > net.width[k] + m.r * 0.9, `mat ${i} on walk ${k}`);
    }
    // clear of the kite field's people, blankets and rack
    for (let q = 0; q < A.seats.length; q += 7) assert.ok(Math.hypot(A.seats[q] - m.x, A.seats[q + 1] - m.z) > m.r + 1, `mat ${i} under a lawn person`);
    for (const p of A.picnics) assert.ok(Math.hypot(p.x - m.x, p.z - m.z) > m.r + 1.5, `mat ${i} under a blanket`);
    if (A.rack) assert.ok(Math.hypot(A.rack.x - m.x, A.rack.z - m.z) > m.r + 2, `mat ${i} at the rack`);
    for (const o of mats) if (o !== m) assert.ok(Math.hypot(o.x - m.x, o.z - m.z) > o.r + m.r, `mats ${i} overlap`);
  }
  assert.ok(samples > 3000);
  // the kite field is where it always was
  assert.equal(A.kites.length, 22); assert.equal(A.picnics.length, 8); assert.ok(A.rack);
});

test('the mats follow the rolling lawn: the dark layer never sinks into it nor floats over 3 cm; leaves stay low, folded or open', () => {
  let floatMax = -1, sinkMax = 1, leafLow = 1, leafHigh = -1, foldLow = 1, foldHigh = -1, heads = 0;
  for (const name of ['morro', 'cristobal']) {
    const g = scene.getObjectByName('Morivivi-' + name).geometry;
    const P = g.attributes.position.array, C = g.attributes.color.array, F = Float32Array.from(g.attributes.aFold.array, (v, k) => (k & 3) === 3 ? v : v / 32767), I = g.index.array;
    const kind = (v) => C[v * 4 + 3];
    // the dark layer: corners and interior points of every triangle against the drawn lawn
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t], I[t + 1], I[t + 2]];
      if (kind(a) !== 0) continue;
      for (const [u, v] of [[1, 0], [0, 1], [0, 0], [1 / 3, 1 / 3], [0.5, 0.5], [0.5, 0], [0, 0.5], [0.2, 0.6], [0.6, 0.2]]) {
        const w = 1 - u - v, x = P[a * 3] * u + P[b * 3] * v + P[c * 3] * w, y = P[a * 3 + 1] * u + P[b * 3 + 1] * v + P[c * 3 + 1] * w, z = P[a * 3 + 2] * u + P[b * 3 + 2] * v + P[c * 3 + 2] * w;
        const d = y - height(x, z); floatMax = Math.max(floatMax, d); sinkMax = Math.min(sinkMax, d);
      }
    }
    for (let v = 0; v < P.length / 3; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      if (kind(v) === 1) {
        const d = y - height(x, z); leafLow = Math.min(leafLow, d); leafHigh = Math.max(leafHigh, d);
        const fx = x + F[v * 4], fy = y + F[v * 4 + 1], fz = z + F[v * 4 + 2], e = fy - height(fx, fz);
        foldLow = Math.min(foldLow, e); foldHigh = Math.max(foldHigh, e);
      }
      if (kind(v) === 3) { heads++; assert.ok(y - height(x, z) > 0.085, 'flower heads stand clear of the leaves'); }
    }
  }
  assert.ok(sinkMax >= 0.002, `the dark layer sinks into the lawn (${(sinkMax * 100).toFixed(1)} cm)`);
  assert.ok(floatMax <= 0.03, `the dark layer floats ${(floatMax * 100).toFixed(1)} cm`);
  assert.ok(leafLow > 0.02 && leafHigh < 0.09, `open leaves ${(leafLow * 100).toFixed(1)}–${(leafHigh * 100).toFixed(1)} cm over the lawn`);
  assert.ok(foldLow > 0.01 && foldHigh < 0.06, `folded leaf stalks ${(foldLow * 100).toFixed(1)}–${(foldHigh * 100).toFixed(1)} cm over the lawn`);
  assert.ok(heads > 0);
  assert.ok(plant.counts.byLawn.morro.triangles <= 100000, `${plant.counts.byLawn.morro.triangles} triangles on the El Morro lawn (the worst view)`);
  assert.ok(plant.counts.byLawn.cristobal.triangles <= 80000);
  assert.equal(scene.children.filter((o) => /^Morivivi/.test(o.name)).length, 2, 'one mesh per lawn');
  for (const o of scene.children) if (/^Morivivi/.test(o.name)) assert.equal(o.castShadow, false, 'thin parts cast no shadow');
});

test('fold rules: a grounded touch folds in a wave, a hop does not, it reopens after its wait, a second touch restarts the wait, blue hour sleeps', () => {
  const m = { x: 0, y: 0, z: 0, r: 1, outline: new Array(R.OUTLINE).fill(1) };
  assert.ok(R.touches(m, 0.5, 0.02, 0, true), 'on the mat');
  assert.ok(R.touches(m, 1.3, 0.02, 0, true), 'brushing the edge');
  assert.ok(!R.touches(m, 1.4, 0.02, 0, true), 'beyond reach');
  assert.ok(!R.touches(m, 0.5, 0.5, 0, true), 'a wheel in the air');
  assert.ok(!R.touches(m, 0.5, 0.02, 0, false), 'not on the ground');
  const s = R.openState();
  assert.equal(R.foldAmount(s, 5, 0), 0, 'open before any touch');
  assert.equal(R.touchState(s, 10, 0, 25), 'fold');
  // the wave: the touched side (w = −1) shuts first, the whole mat in under a second; flowers are not part of it
  assert.ok(R.foldAmount(s, 10.2, -1) > 0.5 && R.foldAmount(s, 10.2, 1) === 0, 'a wave from the touched side');
  for (const w of [-1, 0, 1]) assert.equal(R.foldAmount(s, 10.95, w), 1, 'shut in under a second');
  // shut through its wait, then the far side opens first, all open about five seconds later
  for (const w of [-1, 0, 1]) assert.equal(R.foldAmount(s, 34.9, w), 1, 'still shut before the wait ends');
  assert.ok(R.foldAmount(s, 36.5, 1) < R.foldAmount(s, 36.5, -1), 'the far side opens first');
  for (const w of [-1, 0, 1]) assert.equal(R.foldAmount(s, 40.01, w), 0, 'open again');
  // touched again while shut: the wait starts over (renewals at most once a second)
  const r = R.openState(); R.touchState(r, 10, 0, 25);
  assert.equal(R.touchState(r, 20, 0, 25), 'renew'); assert.equal(R.touchState(r, 20.5, 0, 25), '');
  assert.equal(R.foldAmount(r, 40, 0), 1, 'still shut: the wait restarted at the second touch');
  assert.equal(R.foldAmount(r, 51, 0), 0);
  // touched again while opening: it shuts from where it was, never springing open first
  const o = R.openState(); R.touchState(o, 10, 0, 25);
  const before = R.matFold(o, 37);
  assert.ok(before > 0 && before < 1);
  assert.equal(R.touchState(o, 37, Math.PI, 25), 'fold');
  for (const w of [-1, 0, 1]) assert.ok(R.foldAmount(o, 37.01, w) >= before - 1e-9, 'no spring open on a re-touch');
  assert.equal(R.foldAmount(o, 38, 0), 1);
  // blue hour: every leaf folded whatever the state
  assert.equal(R.foldAmount(R.openState(), 5, 0, 1), 1);
});

test('the plant answers the wheel: a grounded wheel folds the mat it rolls onto once, the line shows once, a hop and blue hour change nothing', () => {
  plant.reset();
  atmosphere.night.value = 0; atmosphere.elapsed.value = 100;
  const i = mats.findIndex((m) => drifts[m.drift].hero), m = mats[i];
  const entity = { position: { x: m.x, y: m.y + 0.01, z: m.z }, heading: 0, controller: { isGrounded: false, crashed: false } };
  plant.frame(entity);
  assert.equal(R.matFold(plant.foldOf(i), 101), 0, 'a wheel in the air (a hop) leaves it open');
  entity.controller.isGrounded = true;
  plant.frame(entity);
  assert.equal(plant.foldOf(i).f0, 100, 'folded at the touch');
  assert.equal(plant.note, NOTE, 'the quiet line');
  const folds = plant.folds;
  atmosphere.elapsed.value = 100.2; plant.frame(entity);
  assert.equal(plant.folds, folds, 'still under the wheel: no new fold');
  atmosphere.elapsed.value = 105; plant.frame({ position: { x: 1e4, y: 0, z: 1e4 }, heading: 0, controller: { isGrounded: true } });
  assert.equal(plant.note, '', 'the line goes after a few seconds');
  // the line is shown once per page
  const j = mats.findIndex((o, k) => k !== i && o.drift !== m.drift);
  atmosphere.elapsed.value = 106; plant.frame({ position: { x: mats[j].x, y: mats[j].y, z: mats[j].z }, heading: 0, controller: { isGrounded: true } });
  assert.equal(plant.foldOf(j).f0, 106); assert.equal(plant.note, '');
  // blue hour: touches change nothing
  plant.reset(); atmosphere.night.value = 1; atmosphere.elapsed.value = 200;
  plant.frame(entity);
  assert.equal(plant.foldOf(i).f0, R.openState().f0, 'no touch at blue hour');
  atmosphere.night.value = 0; atmosphere.elapsed.value = 0; plant.reset();
});
