/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// People on foot (js/sj-people.js, js/sj-walk.js): the walk network built from the real world, and a few simulated
// minutes of the full desktop population. Seeded; CPU only.
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
const { WALK, walkHeight, walkHeightAt, RESERVED } = await import('../js/sj-walk.js');
const { seededRandom } = await import('../js/sj-life-random.js');
const { createActorBodyIndex } = await import('../js/sj-actor-bodies.js');
const { stairDrawnHeight } = await import('../js/sj-stairs.js');
const { GROUND_AREAS } = await import('../js/sj-streets-data.js');

const ARMAS = GROUND_AREAS.find((g) => g.id === 487051052).ring;
const inRing = (x, z, ring) => { let s = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) s = !s; } return s; };

function makeLife(hour = 'midday', at = { x: -30, z: -25 }) {
  const bodies = createActorBodyIndex(16);
  const rider = { valid: true, x: 400, y: 0, z: 400, heading: 0, vx: 0, vz: 0, speed: 0, crashed: false, minY: -100, maxY: -98, halfWidth: 0.35, halfLength: 0.5 };
  const context = { scene: new THREE.Scene(), world, atmosphere: null, renderer: null, phone: false, params: new URLSearchParams(),
    caps: { cars: 40, people: 180 }, rider, focus: { x: at.x, z: at.z, serial: 1 }, hour: { name: hour, night: hour === 'blue' ? 1 : 0 },
    bodies, random: seededRandom, sides: null, kit: null, clear: { rider: 14 } };
  return { context, bodies, rider };
}
async function start(hour, at, extra = null) {
  const life = makeLife(hour, at);
  const people = await createPeople(life.context);
  people.refocus(); people.update(0, null);
  const frame = (dt) => {
    people.update(dt, null);
    life.bodies.begin(); people.publish(life.bodies); if (extra) for (const b of extra) life.bodies.add(b); life.bodies.commit();
  };
  return { ...life, people, frame };
}

const main = await start('midday', { x: -30, z: -25 });
const net = main.people.debug.net;

test('the walk network: nothing in the sea, in a closed place or through a solid; heights on the walked surface', () => {
  assert.ok(net.links > 5000 && net.nodes > 3000, `network ${net.links} links / ${net.nodes} nodes`);
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0.16, halfLengthMetres: 0.16, minY: 0, maxY: 0 };
  let checked = 0;
  for (let k = 0; k < net.links; k += 3) {
    const a = net.a[k], len = net.len[k];
    for (const t of [0.25, 0.5, 0.75]) {
      const x = net.nx[a] + net.dirX[k] * len * t, z = net.nz[a] + net.dirZ[k] * len * t, y = walkHeight(net, k, len * t);
      assert.ok(world.isDry(x, z), `link ${k} in the sea at ${x.toFixed(1)},${z.toFixed(1)}`);
      assert.ok(!world.sampler.offLimitsAt(x, z, y), `link ${k} in a closed place at ${x.toFixed(1)},${z.toFixed(1)}`);
      if (net.kind[k] === WALK.STAIR) continue;
      body.x = x; body.z = z; body.minY = y + 0.4; body.maxY = y + 1.6;
      assert.ok(world.sampler.isVolumeClear(body), `link ${k} (${net.kind[k]}) through a solid at ${x.toFixed(1)},${z.toFixed(1)}`);
      checked++;
    }
  }
  assert.ok(checked > 3000);
  // the empty lot by the Cataño terminal stays empty
  for (let k = 0; k < net.links; k++) for (const t of [0, 0.5, 1]) {
    const x = net.nx[net.a[k]] + net.dirX[k] * net.len[k] * t, z = net.nz[net.a[k]] + net.dirZ[k] * net.len[k] * t;
    assert.ok(!RESERVED.some((r) => inRing(x, z, r)), `walk ${k} in the reserved lot`);
  }
  for (let n = 0; n < net.nodes; n++) assert.ok(world.isDry(net.nx[n], net.nz[n]), `node ${n} in the sea`);
});

test('public stairs are walked on their drawn treads and joined at their real landings', () => {
  let stairs = 0, joined = 0;
  const deg = (n) => net.adjStart[n + 1] - net.adjStart[n];
  for (let k = 0; k < net.links; k++) {
    if (net.kind[k] !== WALK.STAIR) continue;
    stairs++;
    const f = net.flights[net.stair[k]];
    // ends on the landings beyond the flight, heights the drawn surface there
    for (const [n, s] of [[net.a[k], 0], [net.b[k], net.len[k]]]) {
      const dx = net.nx[n] - f.ox, dz = net.nz[n] - f.oz, u = dx * f.cx + dz * f.cz, ss = dx * f.ex + dz * f.ez;
      assert.ok(ss < f.footS - 0.3 || ss > f.topS + 0.3, 'a stair end lies on a landing, not on a tread');
      assert.ok(Math.abs(walkHeight(net, k, s) - stairDrawnHeight(f, u, ss)) < 1e-4);
    }
    // halfway up: the drawn tread height, which differs from the smooth riding support
    const mid = net.len[k] / 2, x = net.nx[net.a[k]] + net.dirX[k] * mid, z = net.nz[net.a[k]] + net.dirZ[k] * mid;
    const dx = x - f.ox, dz = z - f.oz;
    assert.ok(Math.abs(walkHeight(net, k, mid) - stairDrawnHeight(f, dx * f.cx + dz * f.cz, dx * f.ex + dz * f.ez)) < 1e-4);
    assert.ok(deg(net.a[k]) > 1 || deg(net.b[k]) > 1, 'every stair lane is reached from one of its landings');
    if (deg(net.a[k]) > 1 && deg(net.b[k]) > 1) joined++;
  }
  // a few flights end at a closed portico or a terrace with no other walk (dead ends people turn back from)
  assert.ok(stairs >= 12, `${stairs} stair lanes`);
  assert.ok(joined / stairs >= 0.6, `${joined}/${stairs} stair lanes joined at both landings`);
});

function populationChecks(t, seconds) {
  const d = t.people.debug, S = d.STATE;
  // a torso-sized box (the figure's shoulders), from the knees to the head
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0.18, halfLengthMetres: 0.18, minY: 0, maxY: 0 };
  const avenue = world.city.roads.filter((r) => /^(primary|secondary)/.test(r.kind));
  const inAvenue = (x, z) => avenue.some((r) => r.points.some((p, i) => i > 0 && (() => {
    const a = r.points[i - 1], dx = p[0] - a[0], dz = p[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < r.width / 2 - 0.6;
  })()));
  let samples = 0, stillOnStair = 0, avenueHits = 0, walking = 0, brushing = 0, longWait = 0, onGround = 0, offGround = 0, worstGround = 0;
  const probe = { normal: {} };
  const still = new Float32Array(d.px.length), waited = new Float32Array(d.px.length);
  const group = (i) => (d.leader[i] >= 0 ? d.leader[i] : i);
  for (let f = 0; f < 60 * seconds; f++) {
    t.frame(1 / 60);
    if (f % 30) continue;
    for (let i = 0; i < d.px.length; i++) {
      const st = d.state[i]; if (st === S.OFF) continue;
      const x = d.px[i], z = d.pz[i], y = d.py[i];
      waited[i] = st === S.WAIT ? waited[i] + 0.5 : 0;
      if (waited[i] > 45) longWait++;
      if (st === S.WALK) {
        // strangers do not walk through each other
        walking++;
        for (let j = 0; j < d.px.length; j++) {
          if (j === i || d.state[j] === S.OFF || d.state[j] === S.SIT || group(j) === group(i) || Math.abs(d.py[j] - y) > 0.8) continue;
          if (Math.hypot(d.px[j] - x, d.pz[j] - z) < 0.25) { brushing++; break; }
        }
      }
      if (st !== S.SIT && st !== S.FREE) {
        // on the network: inside the checked corridor of the person's link (every offset included)
        // (round a corner a person may still be in the corridor of the link just left)
        // (its torso boxes were checked a quarter metre past its ends)
        const inside = (k, reach) => {
          const a = net.a[k], rx = x - net.nx[a], rz = z - net.nz[a];
          const along = rx * net.dirX[k] + rz * net.dirZ[k], signed = -rx * net.dirZ[k] + rz * net.dirX[k];
          return along > -reach && along < net.len[k] + reach && Math.abs(signed) < net.width[k] + 0.01 ? { along: Math.max(0, Math.min(net.len[k], along)), signed } : null;
        };
        let k = d.link[i], at = inside(k, 0.01);
        if (!at && d.prevLink[i] >= 0) { k = d.prevLink[i]; at = inside(k, 0.26); }
        assert.ok(at, `person ${i} outside the checked corridor of link ${d.link[i]}`);
        const along = at.along, signed = at.signed;
        const onWalk = (q) => { const r = inside(q, 0.26); return r && Math.abs(y - walkHeightAt(net, q, r.along, r.signed)) < 0.01; };
        assert.ok(onWalk(k) || (d.prevLink[i] >= 0 && onWalk(d.prevLink[i])) || onWalk(d.link[i]), 'feet on the walked surface');
        // the feet on the real support where the person stands (off the centre line too; stairs keep their treads)
        if (net.kind[k] !== WALK.STAIR) {
          const g = world.sampler.cityGround(x, z, probe, y + 0.5), e = Math.abs(g.height - y);
          onGround++; if (e > 0.12) offGround++; worstGround = Math.max(worstGround, e);
        }
        body.x = x; body.z = z; body.minY = y + 0.45; body.maxY = y + 1.5;
        assert.ok(world.sampler.isVolumeClear(body), `person ${i} inside a solid at ${x.toFixed(1)},${z.toFixed(1)} (link kind ${net.kind[k]})`);
        if (net.kind[k] === WALK.STAIR && (st === S.STAND || st === S.WAIT)) { still[i] += 0.5; if (still[i] > 1.5) stillOnStair++; } else still[i] = 0;
        if (net.kind[k] !== WALK.CROSSING && inAvenue(x, z)) avenueHits++;
      }
      samples++;
    }
  }
  assert.equal(stillOnStair, 0, 'nobody stands still on a stair');
  assert.equal(longWait, 0, 'nobody waits face to face for ever');
  // (was 2.7–4.5 % before mutual avoidance; merging groups on single-file sidewalks still overlap briefly)
  assert.ok(brushing / walking < 0.025, `strangers within 0.25 m in ${(100 * brushing / walking).toFixed(2)} % of walking samples`);
  assert.equal(avenueHits, 0, 'nobody walks along an avenue carriageway');
  assert.ok(offGround / onGround < 0.01 && worstGround < 0.35, `feet off their support by > 12 cm in ${(100 * offGround / onGround).toFixed(2)} % (worst ${worstGround.toFixed(2)} m)`);
  return samples;
}
test('a few minutes of the full population: on the walks, clear of solids and parked cars, never still on a stair or along an avenue', async () => {
  assert.ok(world.parking?.colliders?.length > 100, 'parked cars are solids in this world');
  assert.ok(populationChecks(main, 150) > 20000);
  const st = main.people.stats();
  assert.ok(st.seated > 0 && st.crossings > 0, `seated ${st.seated}, crossings ${st.crossings}`);
  // streets lined with parked cars on one kerb: the San Sebastián grid and the La Perla lanes
  for (const at of [{ x: 60, z: -230 }, { x: 150, z: -380 }]) assert.ok(populationChecks(await start('golden', at), 45) > 1000);
});

test('nobody jumps: bench leavers walk out, formations re-form on foot, a bumped vendor stumbles in place', async () => {
  // every live person's move per 1/60 s update over two simulated minutes at Raíces and the Plaza de Armas, the Armas
  // vendor bumped slowly once (2.7 m/s, as by an upright rider)
  for (const at of [{ x: -180, z: 222 }, { x: 10, z: 10 }]) {
    const t = await start('golden', at), d = t.people.debug, N = d.px.length;
    const lx = new Float32Array(N), lz = new Float32Array(N), born = new Uint32Array(N), on = new Uint8Array(N);
    let worst = 0, over = 0, updates = 0, vendor = -1, vendorFar = 0;
    for (let f = 0; f < 60 * 120; f++) {
      if (f === 1800 && at.x === 10) for (let i = 0; i < N; i++) if (d.state[i] === d.STATE.SIT && Math.hypot(d.px[i] - 24.55, d.pz[i] - 16.11) < 1.5) { vendor = i; d.records[i].onEucImpact(2.7, 1, 0); }
      t.frame(1 / 60);
      for (let i = 0; i < N; i++) {
        const live = d.state[i] !== d.STATE.OFF;
        if (live && on[i] && born[i] === d.born[i]) {
          const m = Math.hypot(d.px[i] - lx[i], d.pz[i] - lz[i]); updates++;
          worst = Math.max(worst, m); if (m > 0.1) over++;
        }
        on[i] = live ? 1 : 0; born[i] = d.born[i]; lx[i] = d.px[i]; lz[i] = d.pz[i];
      }
      if (vendor >= 0) vendorFar = Math.max(vendorFar, Math.hypot(d.px[vendor] - 24.55, d.pz[vendor] - 16.11));
    }
    assert.equal(d.counters.jumps, 0, 'no re-placement of a live person');
    assert.ok(worst < 1 && over / updates < 0.001, `largest move in one update ${worst.toFixed(2)} m; ${over} of ${updates} over 10 cm`);
    if (at.x === 10) { assert.ok(vendor >= 0, 'the Armas vendor is at the cart'); assert.ok(vendorFar < 1.6, `the bumped vendor stays by the cart (${vendorFar.toFixed(2)} m)`); }
  }
});

test('riding a street: people appear and go in view only far off (beyond 58 m; 70 m to go), and the street is not empty', async () => {
  const pts = world.city.roads.filter((r) => r.name === 'Calle de la Fortaleza').sort((a, b) => b.points.length - a.points.length)[0].points;
  const t = await start('golden', { x: pts[0][0], z: pts[0][1] }), d = t.people.debug, N = d.px.length;
  const cam = new THREE.PerspectiveCamera(62, 1280 / 800, 0.15, 5000), fr = new THREE.Frustum(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const born = new Uint32Array(N), on = new Uint8Array(N), lx = new Float32Array(N), lz = new Float32Array(N), ly = new Float32Array(N);
  let seg = 1, along = 0, nearBirth = 0, nearRetire = 0, births = 0, seen = 0, samples = 0;
  // (the arrival's own fill is not a birth in view: the screen is covered then)
  for (let i = 0; i < N; i++) { on[i] = d.state[i] !== d.STATE.OFF ? 1 : 0; born[i] = d.born[i]; lx[i] = d.px[i]; ly[i] = d.py[i]; lz[i] = d.pz[i]; }
  const inView = (x, y, z) => { v.set(x, y + 0.9, z); return fr.containsPoint(v) ? cam.position.distanceTo(v) : Infinity; };
  for (let f = 0; f < 60 * 30 && seg < pts.length; f++) {
    const a = pts[seg - 1], b = pts[seg], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    along += 6.9 / 60; if (along > l) { along -= l; seg++; if (seg >= pts.length) break; continue; }
    const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l, x = a[0] + ux * along, z = a[1] + uz * along, y = world.height(x, z);
    Object.assign(t.rider, { x, z, y, minY: y, maxY: y + 1.9, vx: ux * 6.9, vz: uz * 6.9, speed: 6.9, heading: Math.atan2(ux, uz) });
    t.context.focus.x = x; t.context.focus.z = z;
    cam.position.set(x, y + 1.65, z); cam.lookAt(x + ux * 30, y + 1.2, z + uz * 30); cam.updateMatrixWorld();
    t.people.update(1 / 60, cam); t.bodies.begin(); t.people.publish(t.bodies); t.bodies.commit();
    fr.setFromProjectionMatrix(m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (let i = 0; i < N; i++) {
      const live = d.state[i] !== d.STATE.OFF;
      if (on[i] && (!live || born[i] !== d.born[i]) && inView(lx[i], ly[i], lz[i]) < 68) nearRetire++;
      if (live && (!on[i] || born[i] !== d.born[i])) { births++; if (inView(d.px[i], d.py[i], d.pz[i]) < 56) nearBirth++; }
      on[i] = live ? 1 : 0; born[i] = d.born[i]; lx[i] = d.px[i]; ly[i] = d.py[i]; lz[i] = d.pz[i];
    }
    if (f % 30 === 0) { samples++; for (let i = 0; i < N; i++) if (on[i] && inView(d.px[i], d.py[i], d.pz[i]) < 60) seen++; }
  }
  assert.ok(births > 10, `${births} births while riding`);
  assert.equal(nearBirth, 0, 'a person appeared in view nearer than the far limit');
  assert.equal(nearRetire, 0, 'a person vanished in view nearer than the far limit');
  assert.ok(seen / samples >= 4, `people in view within 60 m: ${(seen / samples).toFixed(1)} on average (frustum only)`);
});

test('companions never inside each other: a pair and a trio stopped (talking, waiting) and turning back keep 0.45 m apart', async () => {
  // a stopped car standing on one crossing: a leader made to wait for it waits (as at a real kerb)
  const car = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0.95, halfLengthMetres: 2.2, minY: 0, maxY: 0, velocityX: 0, velocityZ: 0, kind: 'vehicle' };
  const t = await start('golden', { x: 10, z: 10 }, [car]), d = t.people.debug, S = d.STATE, N = d.px.length;
  const kc = [...Array(net.links).keys()].find((k) => net.kind[k] === WALK.CROSSING && Math.hypot(net.nx[net.a[k]] - 10, net.nz[net.a[k]] - 10) < 80);
  Object.assign(car, { x: (net.nx[net.a[kc]] + net.nx[net.b[kc]]) / 2, z: (net.nz[net.a[kc]] + net.nz[net.b[kc]]) / 2, minY: net.ny[net.a[kc]] - 1, maxY: net.ny[net.a[kc]] + 2 });
  for (let f = 0; f < 120; f++) t.frame(1 / 60);
  const members = (l) => [...Array(N).keys()].filter((j) => j === l || d.leader[j] === l);
  const minApart = (l) => { const g = members(l); let m = 9; for (const a of g) for (const b of g) if (a < b) m = Math.min(m, Math.hypot(d.px[a] - d.px[b], d.pz[a] - d.pz[b])); return m; };
  for (const size of [2, 3]) {
    const l = [...Array(N).keys()].find((i) => d.leader[i] < 0 && d.state[i] === S.WALK && d.groupSize[i] === size && members(i).every((j) => d.state[j] === S.WALK));
    assert.ok(l !== undefined, `a walking group of ${size}`);
    for (const st of [S.STAND, S.WAIT]) {
      d.state[l] = st; d.timer[l] = st === S.WAIT ? 0 : 30; d.pendingLink[l] = st === S.WAIT ? kc : -1; d.act[l] = st === S.WAIT ? 0 : 2;
      for (let f = 0; f < 180; f++) t.frame(1 / 60);          // gather (3 s)
      let worst = 9;
      for (let f = 0; f < 240; f++) { t.frame(1 / 60); if (st === S.STAND && d.state[l] === st) d.timer[l] = 30; if (d.state[l] === st) worst = Math.min(worst, minApart(l)); }
      assert.equal(d.state[l], st, 'still stopped');
      assert.ok(worst >= 0.45, `${size} stopped (state ${st}): companions ${worst.toFixed(2)} m apart`);
    }
    d.state[l] = S.WALK; d.timer[l] = 0; d.pendingLink[l] = -1;
    for (let f = 0; f < 60; f++) t.frame(1 / 60);
    const g = members(l); const lead = () => g.find((j) => d.leader[j] < 0) ?? l;
    d.turnBack(lead());
    let worst = 9;
    for (let f = 0; f < 240; f++) { t.frame(1 / 60); const ll = lead(); if (d.state[ll] !== S.OFF) worst = Math.min(worst, minApart(ll)); }
    assert.ok(worst >= 0.3, `${size} turning back: companions ${worst.toFixed(2)} m apart`);
  }
});

test('legs: no splits while walking, turning and re-forming (feet within 1.3 leg lengths, never wide apart with a sunk pelvis)', async () => {
  const at = { x: -172.1, z: 238.1 }, t = await start('golden', at), d = t.people.debug, y0 = world.height(at.x, at.z);
  const cam = new THREE.PerspectiveCamera(70, 1.6, 0.1, 500);
  let frames = 0, split = 0, wide = 0, sunk = 0;
  for (let f = 0; f < 60 * 90; f++) {
    const a = f / 600 * Math.PI * 2;
    cam.position.set(at.x + Math.sin(a) * 3, y0 + 2, at.z + Math.cos(a) * 3); cam.lookAt(at.x + Math.sin(a) * 40, y0 + 1, at.z + Math.cos(a) * 40); cam.updateMatrixWorld();
    t.people.update(1 / 60, cam); t.bodies.begin(); t.people.publish(t.bodies); t.bodies.commit();
    for (let i = 0; i < d.px.length; i++) {
      const st = d.state[i]; if (st !== d.STATE.WALK && st !== d.STATE.STAND && st !== d.STATE.WAIT) continue;
      const r = d.rigs[i]; if (!r.placed || Math.hypot(d.px[i] - cam.position.x, d.pz[i] - cam.position.z) > 30 || d.net.stair[d.link[i]] >= 0) continue;
      const L = r.legLength, sep = Math.hypot(r.feet[0].ax - r.feet[1].ax, r.feet[0].az - r.feet[1].az), pel = (r.pelvisY - r.groundAt(r.x, r.z)) / (0.96 * r.s);
      frames++; if (sep > L && pel < 0.75) split++; if (sep > 1.3 * L) wide++; if (pel < 0.65) sunk++;
    }
  }
  assert.ok(frames > 50000, `${frames} near rig frames`);
  assert.equal(split, 0, 'feet wide apart with the pelvis sunk');
  assert.equal(wide, 0, 'feet more than 1.3 leg lengths apart');
  assert.equal(sunk, 0, 'pelvis below 0.65 of standing height');
});

test('places and hours: Plaza de Armas busier than Calle de la Luna at midday; fewer people at blue hour', async () => {
  const d = main.people.debug;
  const luna = world.city.roads.filter((r) => r.name === 'Calle de la Luna');
  const nearLuna = (x, z) => luna.some((r) => r.points.some((p, i) => i > 0 && (() => {
    const a = r.points[i - 1], dx = p[0] - a[0], dz = p[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 7;
  })()));
  let armas = 0, lunaCount = 0;
  for (let f = 0; f < 60 * 30; f++) {
    main.frame(1 / 60);
    if (f % 60) continue;
    for (let i = 0; i < d.px.length; i++) {
      if (d.state[i] === d.STATE.OFF) continue;
      if (inRing(d.px[i], d.pz[i], ARMAS)) armas++;
      else if (nearLuna(d.px[i], d.pz[i]) && Math.hypot(d.px[i] + 30, d.pz[i] + 25) < 90) lunaCount++;
    }
  }
  assert.ok(armas > lunaCount * 1.5, `Plaza de Armas ${armas} vs Calle de la Luna ${lunaCount} person-seconds`);
  const blue = await start('blue', { x: -30, z: -25 });
  for (let f = 0; f < 60 * 5; f++) blue.frame(1 / 60);
  const a = main.people.stats().active, b = blue.people.stats().active;
  assert.ok(b < a * 0.8, `blue hour ${b} vs midday ${a}`);
  main.people.setHour('blue');
  for (let f = 0; f < 60 * 40; f++) main.frame(1 / 60);
  assert.ok(main.people.stats().active < a * 0.85, 'switching the hour thins the crowd by recycling');
  main.people.setHour('midday');
});

test('the rider: sidestep, admitted impact shove, pause and recovery; a slow rider is not trapped', async () => {
  const t = await start('midday', { x: -12, z: 25 });
  const d = t.people.debug, S = d.STATE;
  for (let f = 0; f < 60; f++) t.frame(1 / 60);
  // a walker on a plain walk: the rider comes straight at them at 4 m/s
  const i = [...d.px.keys()].find((j) => d.state[j] === S.WALK && d.leader[j] < 0 && t.people.debug.net.kind[d.link[j]] !== WALK.STAIR
    && t.people.debug.net.width[d.link[j]] > 0.5);
  assert.ok(i !== undefined);
  const before = t.people.stats().sidesteps;
  const k = d.link[i], ux = net.dirX[k] * d.dir[i], uz = net.dirZ[k] * d.dir[i];
  for (let f = 0; f < 50; f++) {
    const dist = 6 - f * 4 / 60;
    Object.assign(t.rider, { x: d.px[i] + ux * dist, z: d.pz[i] + uz * dist, y: d.py[i], minY: d.py[i], maxY: d.py[i] + 1.9, vx: -ux * 4, vz: -uz * 4, speed: 4, heading: Math.atan2(-ux, -uz) });
    t.frame(1 / 60);
  }
  assert.ok(t.people.stats().sidesteps > before, 'the walker steps aside');
  // the controller admits an impact: shove, stumble, pause, recover and walk on
  t.rider.x = 400; t.rider.z = 400; t.rider.speed = 0;
  const x0 = d.px[i], z0 = d.pz[i];
  // a head-on hit pushes along the walk (a sideways push is held by the walk's clear corridor: walls stay walls)
  const kk = d.link[i], nx = net.dirX[kk] * d.dir[i], nz = net.dirZ[kk] * d.dir[i];
  assert.equal(d.records[i].onEucImpact(4.2, nx, nz), true);
  for (let f = 0; f < 20; f++) t.frame(1 / 60);
  assert.ok(Math.hypot(d.px[i] - x0, d.pz[i] - z0) > 0.2, 'shoved');
  assert.equal(d.records[i].onEucImpact(4.2, nx, nz), false, 'one reaction per impact (cooldown)');
  for (let f = 0; f < 60 * 6; f++) t.frame(1 / 60);
  assert.ok(d.state[i] === S.WALK || d.state[i] === S.STAND || d.state[i] === S.SIT || d.state[i] === S.WAIT, 'walks on');
  assert.equal(t.people.stats().shoved, 1);
  // a rider standing still in a walker's way: they wait a moment, then go round or turn back, never stand there
  const j = [...d.px.keys()].find((q) => d.state[q] === S.WALK && d.leader[q] < 0 && net.kind[d.link[q]] !== WALK.STAIR);
  const kj = d.link[j], vx = net.dirX[kj] * d.dir[j], vz = net.dirZ[kj] * d.dir[j];
  Object.assign(t.rider, { x: d.px[j] + vx * 1.2, z: d.pz[j] + vz * 1.2, y: d.py[j], minY: d.py[j], maxY: d.py[j] + 1.9, vx: 0, vz: 0, speed: 0 });
  let waited = false;
  for (let f = 0; f < 60 * 6; f++) { t.frame(1 / 60); if (d.state[j] === S.WAIT) waited = true; }
  assert.ok(waited, 'waits for the standing rider');
  const gap = Math.hypot(d.px[j] - t.rider.x, d.pz[j] - t.rider.z);
  assert.ok(d.state[j] !== S.WAIT || gap > 1.2, 'does not stay pressed against the rider');
});

test('people wait at a corner while a car is on the crossing, then cross when it is clear', async () => {
  // a parked vehicle body on every crossing round Plaza de Armas
  const t0 = await start('midday', { x: -12, z: 25 });
  const crossings = [];
  for (let k = 0; k < net.links; k++) {
    if (net.kind[k] !== WALK.CROSSING) continue;
    const x = (net.nx[net.a[k]] + net.nx[net.b[k]]) / 2, z = (net.nz[net.a[k]] + net.nz[net.b[k]]) / 2;
    if (Math.hypot(x + 12, z - 25) < 140) crossings.push({ k, x, z });
  }
  const vehicles = crossings.map(({ x, z }) => ({ x, z, headingY: 0, halfWidthMetres: 0.9, halfLengthMetres: 2.2, minY: world.height(x, z), maxY: world.height(x, z) + 1.6, velocityX: 0, velocityZ: 0, kind: 'vehicle' }));
  const t = await start('midday', { x: -12, z: 25 }, vehicles);
  const d = t.people.debug;
  const blocked = new Set(crossings.map((c) => c.k));
  let onBlocked = 0;
  for (let f = 0; f < 60 * 60; f++) {
    t.frame(1 / 60);
    if (f % 10) continue;
    for (let i = 0; i < d.px.length; i++) if (d.state[i] !== d.STATE.OFF && blocked.has(d.link[i]) && d.leader[i] < 0) onBlocked++;
  }
  const s = t.people.stats();
  assert.ok(s.waits > 0, 'people waited at the kerb');
  assert.equal(onBlocked, 0, 'nobody stepped onto a crossing with a car on it');
  for (let f = 0; f < 60 * 60; f++) t0.frame(1 / 60);
  assert.ok(t0.people.stats().crossings > 0, 'without cars they cross');
});

test('with the real traffic at a busy corner: nobody inside a car, nobody waits for ever or gives up a crossing', async () => {
  const sides = await import('../js/sj-street-sides.js'), { createTraffic } = await import('../js/sj-traffic.js'), { VEHICLE_TYPES, LAMPS } = await import('../js/sj-vehicle-types.js');
  for (const at of [{ x: -33.38, z: 52.82 }, { x: 1135.0, z: -35.09 }]) {
    const life = makeLife('golden', at);
    life.context.sides = sides;
    const profiles = VEHICLE_TYPES.map((t) => [{ z: 0, halfLengthMetres: t.length / 2, halfWidthMetres: t.width / 2, minY: 0, maxY: t.height }]);
    life.context.kit = { types: VEHICLE_TYPES, capacity: 40, LAMPS, assign() {}, pose() {}, hide() {}, crashProfile: (i) => profiles[i] };
    const traffic = await createTraffic(life.context), people = await createPeople(life.context), d = people.debug;
    traffic.refocus(); people.refocus();
    const near = [], waited = new Float32Array(d.px.length);
    let inside = 0, longest = 0;
    for (let f = 0; f < 30 * 60; f++) {
      traffic.update(1 / 30, null); people.update(1 / 30, null);
      life.bodies.begin(); traffic.publish(life.bodies); people.publish(life.bodies); life.bodies.commit();
      near.length = 0; life.bodies.dynamicBodiesNear(at.x, at.z, 60, near);
      for (let i = 0; i < d.px.length; i++) {
        if (!d.state[i]) { waited[i] = 0; continue; }
        waited[i] = d.state[i] === d.STATE.WAIT ? waited[i] + 1 / 30 : 0; longest = Math.max(longest, waited[i]);
        for (const v of near) {
          if (v.kind !== 'vehicle' || d.py[i] + 1.6 < v.minY || d.py[i] > v.maxY) continue;
          const dx = d.px[i] - v.x, dz = d.pz[i] - v.z, sh = Math.sin(v.headingY), ch = Math.cos(v.headingY);
          if (Math.abs(dx * sh + dz * ch) < v.halfLengthMetres + 0.1 && Math.abs(dx * ch - dz * sh) < v.halfWidthMetres + 0.1) inside++;
        }
      }
    }
    assert.ok(d.counters.crossings > 10, `${d.counters.crossings} crossings`);
    assert.equal(inside, 0, 'a person inside a car');
    assert.ok(longest < 35 && d.counters.gaveUp === 0, `longest wait ${longest.toFixed(1)} s, ${d.counters.gaveUp} crossings given up`);
    people.dispose();
  }
});

test('piragua carts and the El Morro kite: placed off the walks, nobody walks through a cart, the cart stops the rider', async () => {
  const st = main.people.stats(), A = main.people.debug.accents, d = main.people.debug;
  assert.equal(st.carts, 2, 'a cart at the Plaza de Armas gazebo and one on the Paseo de la Princesa');
  assert.ok(st.kite, 'a kite over the El Morro lawn');
  const inCart = (x, z, pad) => A.carts.some((c) => {
    const dx = x - c.x, dz = z - c.z, s = Math.sin(c.heading), co = Math.cos(c.heading);
    return Math.abs(dx * co - dz * s) < 0.62 + pad && Math.abs(dx * s + dz * co) < 0.42 + pad;
  });
  let through = 0, vendors = 0;
  for (let f = 0; f < 60 * 40; f++) {
    main.frame(1 / 60);
    if (f % 20) continue;
    for (let i = 0; i < d.px.length; i++) if (d.state[i] !== d.STATE.OFF && inCart(d.px[i], d.pz[i], 0.1)) through++;
  }
  for (let q = 0; q < d.net.seatCount; q++) if (d.net.seatKind[q] === 2 && d.seatOf.includes(q)) vendors++;
  assert.equal(through, 0, 'nobody inside a cart');
  assert.ok(vendors >= 1, 'the Plaza de Armas vendor is at the cart');
  const out = []; main.bodies.dynamicBodiesNear(A.carts[0].x, A.carts[0].z, 2, out);
  assert.ok(out.some((b) => b.kind === 'cart'), 'the cart is a body the rider meets');
});

test('same seed, same city', async () => {
  const a = await start('golden', { x: 500, z: -80 }), b = await start('golden', { x: 500, z: -80 });
  for (let f = 0; f < 600; f++) { a.frame(1 / 60); b.frame(1 / 60); }
  const da = a.people.debug, db = b.people.debug;
  assert.deepEqual([...da.px], [...db.px]);
  assert.deepEqual([...da.state], [...db.state]);
  assert.ok(a.people.stats().active > 50);
});
