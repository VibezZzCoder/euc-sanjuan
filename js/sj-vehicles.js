/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Vehicle kit: draws the moving fleet and the parked rows with the modelled vehicles of js/sj-vehicle-models.js.
//
//   kit.assign(slot, typeIndex, liveryIndex, paintIndex)   when a slot is given a vehicle (no allocation)
//   kit.pose(slot, x, y, z, headingY, pitch, roll, travel, steer, lamps)   every frame for a live slot
//   kit.hide(slot)                                         a slot without a vehicle
//   kit.commit(camera, focus)                              once per frame, after every pose
//   kit.crashProfile(typeIndex)                            slices for js/sj-actor-bodies.js writeVehicleBody
// (x, y, z) is the ground point under the centre of the footprint; heading 0 faces +Z; pitch lifts the nose;
// `travel` is metres rolled (wheel spin), `steer` the front wheel angle in radians, `lamps` a LAMPS bit set.
//
// Drawing: per body type one near pool (full body, wheels drawn by two shared wheel pools) and one far pool (a ~480-
// triangle stand-in with its wheels built in), instanced, filled each commit from every visible vehicle by distance.
// The sun's shadow map gets a third, coarse pool per type on a layer only the shadow camera sees. Every vehicle sits on
// a soft contact shadow; at blue hour running vehicles light their lamps (material uniform) and lay a faint additive
// pool of light on the road ahead. Parked cars (world.parking, js/sj-parking-layout.js) are static instances of the
// same pools, read once when the kit is made; `?parked=0` leaves them out.
import * as THREE from 'three/webgpu';
import { Fn, uv, float, vec3, abs, max, smoothstep, attribute, mix } from 'three/tsl';
import { VEHICLE_TYPES, LIVERIES, PAINTS, LAMPS } from './sj-vehicle-types.js';
import { SJ_SPECS, LIVERY_CODE, TRIM_CODE, carStyleCode, buildCarGeometry, buildCarProxyGeometry, buildCarCasterGeometry,
  buildSteerableWheelGeo, createLoftedCarMaterial, createCarWheelMaterial, setVehicleEnvironment } from './sj-vehicle-models.js';
import { vehicleCrashSlices } from './sj-actor-bodies.js';
import { atmosphere as hour } from './sj-atmosphere.js';

export const VEHICLE_LOD = Object.freeze({
  near: { desktop: 72, phone: 48 },   // m: full body + wheel instances inside, stand-in beyond
  far: 330,                           // m: nothing drawn beyond (the haze starts near 350 m)
  caster: { desktop: 88, phone: 72 }, // m: shadow casters (the sun's shadow box reaches ~85 m ahead of the camera)
  contact: 150,                       // m: contact shadows
  pool: 110,                          // m: lamp pools on the road at blue hour
});
// Blue-hour lamp pool: at most `length` m of free road ahead, `width` m wide, none when less than `min` m is free.
const POOL = Object.freeze({ length: 5.5, width: 2.8, min: 1.5 });
export const SHADOW_LAYER = 5;        // layer seen only by the sun's shadow camera
const WHEEL_BASE_RADIUS = SJ_SPECS.sedan.wheelRadius;
// Liveries with a fixed paint (civil cars take PAINTS); the service pickup takes one of these neutral tones.
const LIVERY_PAINT = { taxi: '#f0f0eb', delivery: '#ecece8', patrol: '#f2f3f0' };
const SERVICE_PAINTS = ['#e6e5df', '#a4abb0', '#6f7377'];
const METALLIC_PAINTS = new Set([1, 3, 4, 7]);

function hash(n) {
  let h = (n | 0) ^ 0x2c1b3c6d;
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  h = Math.imul(h ^ (h >>> 12), 0x9e3779b1);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Paint (linear RGB, written to `out` at `o`) and style code of a vehicle. `seed` varies trim and wheels. */
export function vehicleLook(typeIndex, liveryIndex, paintIndex, seed, running, out, o) {
  const livery = LIVERIES[liveryIndex] ?? 'civil';
  const type = VEHICLE_TYPES[typeIndex].id;
  const h = hash(seed * 31 + typeIndex * 7 + paintIndex);
  const hex = livery === 'service' ? SERVICE_PAINTS[paintIndex % SERVICE_PAINTS.length]
    : LIVERY_PAINT[livery] ?? PAINTS[paintIndex % PAINTS.length].hex;
  const c = _colour.set(hex);
  out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b;
  const civil = livery === 'civil';
  let trim = TRIM_CODE.plain;
  if (type === 'crossover' && civil && h % 10 < 3) trim = TRIM_CODE.rails;
  else if (type === 'boxy' && civil && h % 10 < 4) trim = TRIM_CODE.twoTone;
  else if (civil && h % 17 === 0) trim = TRIM_CODE.blackout;
  const metallic = civil && (METALLIC_PAINTS.has(paintIndex % PAINTS.length) || (h >>> 8) % 4 === 0) ? 1 : 0;
  const wheel = civil ? (h >>> 4) % 4 : livery === 'patrol' ? 3 : 0;
  return carStyleCode({ livery: LIVERY_CODE[livery], metallic, trim, wheel, running: running ? 1 : 0 });
}
const _colour = new THREE.Color();

// Contact shadow: a soft dark rounded rectangle under the body (uv 0..1 over the footprint plus a margin).
function contactMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  m.colorNode = vec3(0.02, 0.022, 0.025);
  m.opacityNode = Fn(() => {
    const q = abs(uv().sub(0.5)).mul(2.0);
    const e = max(q.x.mul(1.0), q.y);
    return smoothstep(1.0, 0.55, e).mul(smoothstep(1.0, 0.72, q.x)).mul(float(0.5).add(hour.night.mul(0.22)));
  })();
  m.fog = true;
  return m;
}
// Blue-hour lamp pool: an additive warm wash on the road ahead of a running vehicle's nose.
function poolMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  m.colorNode = Fn(() => {
    const u = uv();
    const across = smoothstep(0.5, 0.0, abs(u.x.sub(0.5)).mul(mix(float(1.6), float(0.9), u.y)));
    const along = smoothstep(0.0, 0.15, u.y).mul(smoothstep(1.0, 0.35, u.y));
    return vec3(1.0, 0.82, 0.58).mul(across.mul(along).mul(hour.night).mul(0.09));
  })();
  m.fog = true;
  return m;
}

export function createVehicleKit(context) {
  const { scene, caps, world, phone = false, params = new URLSearchParams() } = context;
  const started = performance.now();
  setVehicleEnvironment({ night: hour.night, elapsed: hour.elapsed });
  const capacity = Math.max(0, caps.cars | 0);
  const T = VEHICLE_TYPES.length;
  const specs = VEHICLE_TYPES.map((t) => SJ_SPECS[t.id]);
  const nearD = phone ? VEHICLE_LOD.near.phone : VEHICLE_LOD.near.desktop;
  const casterD = phone ? VEHICLE_LOD.caster.phone : VEHICLE_LOD.caster.desktop;

  // ---- parked cars, copied out of the construction records ------------------------------------------------------
  const source = params.get('parked') === '0' ? null : world?.parking?.cars ?? null;
  const parkedCount = source ? source.count : 0;
  const total = capacity + parkedCount;
  // Per vehicle (moving slots first, then parked): type, pose, paint, style. Matrices of parked cars are computed once.
  const type = new Uint8Array(Math.max(1, total));
  const live = new Uint8Array(Math.max(1, total));
  const pose = new Float32Array(Math.max(1, total) * 9);      // x, y, z, heading, pitch, roll, travel, steer, lamps
  const paint = new Float32Array(Math.max(1, total) * 3);
  const style = new Float32Array(Math.max(1, total));
  const wasNear = new Uint8Array(Math.max(1, total));
  const bodyM = new Float32Array(Math.max(1, total) * 16);    // model matrix (wheelbase centre on the ground)
  const wheelM = new Float32Array(Math.max(1, total) * 64);   // four wheel matrices
  const parkedTypeCount = new Uint32Array(T);
  for (let i = 0; i < parkedCount; i++) {
    const k = capacity + i, r = source.records, o = i * source.stride;
    type[k] = r[o + 6]; live[k] = 1;
    pose.set([r[o], r[o + 1], r[o + 2], r[o + 3], r[o + 4], r[o + 5], 0, 0, 0], k * 9);
    style[k] = vehicleLook(type[k], r[o + 7], r[o + 8], r[o + 9], false, paint, k * 3);
    parkedTypeCount[type[k]]++;
  }

  // ---- pools ------------------------------------------------------------------------------------------------------
  const owned = [];
  const meshOf = (geometry, material, count) => {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
    mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false;
    owned.push(mesh); scene.add(mesh);
    return mesh;
  };
  // At least one slot, as meshOf reserves: an empty pool (?life=0 with ?parked=0) still draws one instance at the boot compile.
  const withLookAttributes = (g, n) => {
    const slots = Math.max(1, n);
    g.setAttribute('paintColor', new THREE.InstancedBufferAttribute(new Float32Array(slots * 3), 3));
    g.setAttribute('carState', new THREE.InstancedBufferAttribute(new Float32Array(slots * 4), 4));
    return g;
  };
  const casterMaterial = new THREE.MeshBasicNodeMaterial();
  const pools = VEHICLE_TYPES.map((t, i) => {
    const n = capacity + parkedTypeCount[i];
    const material = createLoftedCarMaterial(specs[i]);
    const near = meshOf(withLookAttributes(buildCarGeometry(specs[i], false), n), material, n);
    const far = meshOf(withLookAttributes(buildCarProxyGeometry(specs[i]), n), material, n);
    const caster = meshOf(buildCarCasterGeometry(specs[i]), casterMaterial, n);
    near.receiveShadow = far.receiveShadow = true;
    caster.castShadow = true; caster.layers.set(SHADOW_LAYER);
    near.name = `sj-vehicles-near-${t.id}`; far.name = `sj-vehicles-far-${t.id}`; caster.name = `sj-vehicles-shadow-${t.id}`;
    const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    return { near, far, caster, nearTri: tri(near.geometry), farTri: tri(far.geometry), casterTri: tri(caster.geometry) };
  });
  context.atmosphere?.sun?.shadow?.camera?.layers.enable(SHADOW_LAYER);
  const wheelStyles = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, total) * 2), 1);
  const wheelMaterial = createCarWheelMaterial({ instanced: true, wheelRadius: WHEEL_BASE_RADIUS });
  const wheelGeo = [-1, 1].map((side) => { const g = buildSteerableWheelGeo(specs[1], side); g.setAttribute('wheelStyle', wheelStyles); return g; });
  const wheelsL = meshOf(wheelGeo[0], wheelMaterial, total * 2), wheelsR = meshOf(wheelGeo[1], wheelMaterial, total * 2);
  wheelsL.name = 'sj-vehicles-wheels-left'; wheelsR.name = 'sj-vehicles-wheels-right';
  wheelsL.receiveShadow = wheelsR.receiveShadow = true;
  const wheelTri = (wheelGeo[0].index ? wheelGeo[0].index.count : wheelGeo[0].attributes.position.count) / 3;
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const contact = meshOf(plane, contactMaterial(), total);
  contact.name = 'sj-vehicles-contact'; contact.renderOrder = 2;
  const poolPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  const lampPools = meshOf(poolPlane, poolMaterial(), capacity);
  lampPools.name = 'sj-vehicles-lamp-pools'; lampPools.renderOrder = 3;
  // Painted bay edges on the open lots (world.parking.lines): static, one faint lit decal.
  const lineSource = params.get('parked') === '0' ? null : world?.parking?.lines ?? null;
  const lineMaterial = new THREE.MeshStandardNodeMaterial({ color: '#d9d4c4', roughness: 0.9, metalness: 0, transparent: true, opacity: 0.5,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const bayLines = meshOf(plane, lineMaterial, lineSource?.count ?? 0);
  bayLines.name = 'sj-vehicles-bay-lines'; bayLines.receiveShadow = true;
  owned.push({ dispose() { plane.dispose(); poolPlane.dispose(); casterMaterial.dispose(); wheelMaterial.dispose(); lineMaterial.dispose(); } });

  // ---- pose → matrices (no allocation) ----------------------------------------------------------------------------
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(),
    sc = new THREE.Vector3(1, 1, 1), wq = new THREE.Quaternion(), we = new THREE.Euler(0, 0, 0, 'YXZ'), mw = new THREE.Matrix4(),
    local = new THREE.Matrix4();
  function writeMatrices(k) {
    const o = k * 9, t = VEHICLE_TYPES[type[k]], s = specs[type[k]];
    const x = pose[o], y = pose[o + 1], z = pose[o + 2], h = pose[o + 3], pitch = pose[o + 4], roll = pose[o + 5];
    e.set(-pitch, h, roll); q.setFromEuler(e);
    // Model origin: the wheelbase centre, `axleOffset` ahead of the footprint centre along the posed body axis.
    v.set(0, 0, t.axleOffset).applyQuaternion(q);
    m4.compose(v.set(x + v.x, y + v.y, z + v.z), q, sc);
    m4.toArray(bodyM, k * 16);
    const spin = pose[o + 6] / s.wheelRadius, steer = pose[o + 7], ws = s.wheelRadius / WHEEL_BASE_RADIUS;
    for (let w = 0; w < 4; w++) {
      const side = w & 1 ? 1 : -1, front = w < 2;
      we.set(spin + (front ? 0 : 0.55), front ? steer : 0, 0); wq.setFromEuler(we);
      local.compose(v.set(side * s.wheelX, s.wheelRadius, front ? s.wheelZ : -s.wheelZ), wq, sc.set(ws, ws, ws));
      sc.set(1, 1, 1);
      mw.multiplyMatrices(m4, local).toArray(wheelM, k * 64 + w * 16);
    }
  }
  for (let k = capacity; k < total; k++) writeMatrices(k);
  if (lineSource?.count) {
    for (let i = 0, r = lineSource.records; i < lineSource.count; i++) {
      const o = i * lineSource.stride;
      e.set(-r[o + 4], r[o + 3], 0); q.setFromEuler(e);
      m4.compose(v.set(r[o], r[o + 1] + 0.02, r[o + 2]), q, sc.set(0.1, 1, r[o + 5])).toArray(bayLines.instanceMatrix.array, i * 16);
    }
    sc.set(1, 1, 1);
    bayLines.count = lineSource.count; bayLines.visible = true; bayLines.instanceMatrix.needsUpdate = true;
  }

  // ---- per-frame fill ---------------------------------------------------------------------------------------------
  const frustum = new THREE.Frustum(), viewProj = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 3.4);
  const counts = { near: 0, far: 0, casters: 0, drawn: 0, triangles: 0, pools: 0 };
  let warming = false, lastCamera = null, lastFocus = null;
  // One reusable update range per attribute (the backend empties the list after each upload): no allocation per frame.
  const ranges = new WeakMap();
  const flag = (attr, n) => {
    let r = ranges.get(attr);
    if (!r) ranges.set(attr, r = { start: 0, count: 0 });
    r.count = Math.max(1, n) * attr.itemSize;
    const list = attr.updateRanges;
    list.length = 0; list.push(r);
    attr.needsUpdate = true;
  };
  const copy16 = (dst, d, src, s) => { for (let i = 0; i < 16; i++) dst[d + i] = src[s + i]; };
  function putLook(mesh, slot, k) {
    const pa = mesh.geometry.attributes.paintColor.array, st = mesh.geometry.attributes.carState.array;
    pa[slot * 3] = paint[k * 3]; pa[slot * 3 + 1] = paint[k * 3 + 1]; pa[slot * 3 + 2] = paint[k * 3 + 2];
    const lamps = pose[k * 9 + 8];
    st[slot * 4] = lamps & LAMPS.BRAKE ? 1 : 0; st[slot * 4 + 1] = lamps & LAMPS.LEFT ? 1 : 0;
    st[slot * 4 + 2] = lamps & LAMPS.RIGHT ? 1 : 0; st[slot * 4 + 3] = style[k];
  }
  function finish(mesh) {
    mesh.visible = mesh.count > 0;
    if (!mesh.count) return;
    flag(mesh.instanceMatrix, mesh.count);
    const a = mesh.geometry.attributes;
    if (a.paintColor) { flag(a.paintColor, mesh.count); flag(a.carState, mesh.count); }
  }
  // Blue-hour pool of light on the road ahead of a running vehicle, only over the free road before the next body (any
  // moving or parked vehicle within a lane's width ahead), its far end laid on the ground there.
  const xAxis = new THREE.Vector3(), yAxis = new THREE.Vector3(), zAxis = new THREE.Vector3(), poolSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  function freeAhead(k, limit) {
    const o = k * 9, x = pose[o], z = pose[o + 2], s = Math.sin(pose[o + 3]), c = Math.cos(pose[o + 3]);
    const front = VEHICLE_TYPES[type[k]].length / 2;
    let free = limit;
    for (let j = 0; j < total; j++) {
      if (j === k || !live[j]) continue;
      const dx = pose[j * 9] - x, dz = pose[j * 9 + 2] - z;
      const along = dx * s + dz * c;
      if (along <= 0 || along > limit + 8) continue;
      if (Math.abs(dx * c - dz * s) > 1.7) continue;
      free = Math.min(free, along - front - VEHICLE_TYPES[type[j]].length / 2);
    }
    return free;
  }
  function lampPool(k, camera) {
    const o = k * 9, t = VEHICLE_TYPES[type[k]], h = pose[o + 3], s = Math.sin(h), c = Math.cos(h);
    const len = Math.min(POOL.length, freeAhead(k, POOL.length + 1) - 0.4);
    if (len < POOL.min) return false;
    const reach = t.length / 2 - 0.1;
    const fx = pose[o] + s * reach, fz = pose[o + 2] + c * reach, fy = pose[o + 1] + reach * Math.sin(pose[o + 4]);
    const ex = fx + s * len, ez = fz + c * len, ey = world?.height ? world.height(ex, ez) : fy;
    poolSphere.center.set((fx + ex) / 2, (fy + ey) / 2, (fz + ez) / 2);
    if (camera && !frustum.intersectsSphere(poolSphere)) return false;
    zAxis.set(ex - fx, ey - fy, ez - fz);                       // length `len` along the road, rising with it
    xAxis.set(c, 0, -s).multiplyScalar(POOL.width);
    yAxis.crossVectors(zAxis, xAxis).normalize();
    mw.makeBasis(xAxis, yAxis, zAxis).setPosition(fx, fy + 0.05, fz);
    mw.toArray(lampPools.instanceMatrix.array, lampPools.count++ * 16);
    return true;
  }
  function commit(camera, focus) {
    lastCamera = camera; lastFocus = focus;
    for (const p of pools) p.near.count = p.far.count = p.caster.count = 0;
    wheelsL.count = wheelsR.count = contact.count = lampPools.count = 0;
    counts.near = counts.far = counts.casters = counts.drawn = counts.pools = 0;
    const cx = camera ? camera.position.x : focus?.x ?? 0, cz = camera ? camera.position.z : focus?.z ?? 0;
    if (camera) { viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(viewProj, camera.coordinateSystem); }
    const night = hour.night.value > 0.5;
    const far2 = VEHICLE_LOD.far ** 2, cast2 = casterD ** 2, contact2 = VEHICLE_LOD.contact ** 2, pool2 = VEHICLE_LOD.pool ** 2;
    for (let k = 0; k < total; k++) {
      if (!live[k]) continue;
      const o = k * 9, dx = pose[o] - cx, dz = pose[o + 2] - cz, d2 = dx * dx + dz * dz;
      if (d2 > far2) { wasNear[k] = 0; continue; }
      if (k < capacity) writeMatrices(k);
      const p = pools[type[k]];
      if (d2 < cast2) { copy16(p.caster.instanceMatrix.array, p.caster.count * 16, bodyM, k * 16); p.caster.count++; counts.casters++; }
      if (night && k < capacity && d2 < pool2 && lampPool(k, camera)) counts.pools++;
      sphere.center.set(pose[o], pose[o + 1] + 1, pose[o + 2]);
      if (camera && !frustum.intersectsSphere(sphere)) continue;
      const lim = wasNear[k] ? nearD + 4 : nearD;
      const near = d2 < lim * lim;
      wasNear[k] = near ? 1 : 0;
      const mesh = near ? p.near : p.far, slot = mesh.count++;
      copy16(mesh.instanceMatrix.array, slot * 16, bodyM, k * 16);
      putLook(mesh, slot, k);
      if (near) {
        counts.near++;
        const a = wheelsL.count, b = wheelsR.count;
        const L = wheelsL.instanceMatrix.array, R = wheelsR.instanceMatrix.array;
        copy16(L, a * 16, wheelM, k * 64); copy16(L, a * 16 + 16, wheelM, k * 64 + 32);
        copy16(R, b * 16, wheelM, k * 64 + 16); copy16(R, b * 16 + 16, wheelM, k * 64 + 48);
        wheelStyles.array[a] = wheelStyles.array[a + 1] = style[k];
        wheelsL.count += 2; wheelsR.count += 2;
      } else counts.far++;
      if (d2 < contact2) {
        const t = VEHICLE_TYPES[type[k]], c = contact.count++;
        local.makeScale(t.width + 0.32, 1, t.length + 0.42);
        mw.fromArray(bodyM, k * 16).multiply(local);
        mw.elements[13] += 0.035;
        mw.toArray(contact.instanceMatrix.array, c * 16);
      }
    }
    counts.triangles = 0;
    for (const p of pools) {
      finish(p.near); finish(p.far); finish(p.caster);
      counts.triangles += p.near.count * p.nearTri + p.far.count * p.farTri;
    }
    counts.triangles += (wheelsL.count + wheelsR.count) * wheelTri + (contact.count + lampPools.count) * 2;
    counts.drawn = counts.near + counts.far;
    finish(wheelsL); finish(wheelsR); finish(contact); finish(lampPools);
    if (wheelsL.count) flag(wheelStyles, wheelsL.count);
    if (warming) fillWarm();
  }
  // Boot compile: every pool draws at least one instance (main and shadow pass); the instance sits far under the city.
  function fillWarm() {
    const meshes = [...pools.flatMap((p) => [p.near, p.far, p.caster]), wheelsL, wheelsR, contact, lampPools, bayLines];
    for (const mesh of meshes) {
      if (mesh.count) continue;
      m4.makeTranslation(lastFocus?.x ?? 0, -200, lastFocus?.z ?? 0).toArray(mesh.instanceMatrix.array, 0);
      if (mesh.geometry.attributes.carState) mesh.geometry.attributes.carState.array[3] = carStyleCode({ livery: LIVERY_CODE.patrol, running: 1 });
      mesh.count = 1; finish(mesh);
    }
  }

  const buildMs = performance.now() - started;
  const profiles = specs.map((s, i) => {
    const slices = vehicleCrashSlices(buildCarGeometry(s, false, false), s);
    const off = VEHICLE_TYPES[i].axleOffset;
    return Object.freeze(slices.map((p) => Object.freeze({ ...p, z: p.z + off })));
  });

  return {
    types: VEHICLE_TYPES,
    capacity,
    LAMPS,
    parked: parkedCount,
    assign(slot, typeIndex, liveryIndex, paintIndex) {
      if (slot < 0 || slot >= capacity) return;
      type[slot] = typeIndex;
      style[slot] = vehicleLook(typeIndex, liveryIndex, paintIndex, slot + 1, true, paint, slot * 3);
    },
    pose(slot, x, y, z, headingY, pitch = 0, roll = 0, travel = 0, steer = 0, lamps = 0) {
      if (slot < 0 || slot >= capacity) return;
      const o = slot * 9;
      pose[o] = x; pose[o + 1] = y; pose[o + 2] = z; pose[o + 3] = headingY; pose[o + 4] = pitch; pose[o + 5] = roll;
      pose[o + 6] = travel; pose[o + 7] = steer; pose[o + 8] = lamps;
      live[slot] = 1;
    },
    hide(slot) { if (slot >= 0 && slot < capacity) live[slot] = 0; },
    commit,
    crashProfile: (typeIndex) => profiles[typeIndex],
    warm(on) {
      warming = !!on;
      if (warming) fillWarm(); else if (lastFocus || lastCamera) commit(lastCamera, lastFocus);
    },
    stats: () => ({ capacity, parked: parkedCount, near: counts.near, far: counts.far, casters: counts.casters, pools: counts.pools,
      drawn: counts.drawn, triangles: counts.triangles, buildMs: Math.round(buildMs), layoutMs: world?.parking?.qa?.().ms ?? 0,
      draws: owned.filter((m) => m.isMesh && m.visible && m.layers.mask & 1).length }),
    dispose() {
      for (const m of owned) {
        if (m.isMesh) { scene.remove(m); m.geometry.dispose(); m.dispose(); } else m.dispose();
      }
      for (const s of specs) createLoftedCarMaterial(s).dispose();
    },
  };
}
