/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Two small accents of the old city's street life, placed at boot from the live world:
// - piragua carts (shaved ice with syrup) at the Plaza de Armas gazebo and on the Paseo de la Princesa by the Raíces
//   fountain: a waist-high two-wheeled box with a blue umbrella and a shelf of coloured syrup bottles (reference photo
//   27 and the Wikimedia Commons "Piragua truck, Old San Juan" view; no product marks), a vendor behind it and a place
//   for two customers in front. The cart is a body the rider stops against, like a parked car.
// - one kite over the El Morro lawn (reference photo 19; the park lists kite flying on the esplanade), held by a small
//   group standing and sitting on the grass, well off the paths.
// The people are seats in the people's own seat table (js/sj-people.js): `kind` 1 customer, 2 vendor, 3 kite flyer,
// 4 standing companion, 5 sitting on the grass.
import * as THREE from 'three/webgpu';

export const SEAT_KIND = Object.freeze({ BENCH: 0, CUSTOMER: 1, VENDOR: 2, FLYER: 3, COMPANION: 4, GRASS: 5 });
const CART = { halfX: 0.62, halfZ: 0.42, height: 2.35 };

function box(geos, colour, w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  paint(g, colour); geos.push(g);
}
function paint(g, colour) {
  const c = new THREE.Color(colour), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.index) { const ng = g.toNonIndexed(); g.copy(ng); ng.dispose(); }
  return g;
}
function merge(geos) {
  let count = 0; for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    o += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
// The cart, standing at the origin facing +Z (its customers' side), wheels on the ground at y 0
function cartGeometry() {
  const geos = [];
  box(geos, '#e9e4d8', 1.1, 0.78, 0.72, 0, 0.62, 0);            // the box
  box(geos, '#2f6fa8', 1.12, 0.2, 0.74, 0, 0.32, 0);            // a blue skirt band
  box(geos, '#2f6fa8', 1.12, 0.06, 0.74, 0, 1.03, 0);           // top rim
  box(geos, '#c9c5bb', 1.02, 0.04, 0.6, 0, 1.08, -0.02);         // the ice block lid
  box(geos, '#d8e6ea', 0.36, 0.22, 0.3, -0.28, 1.2, -0.05);     // the ice block
  // the bottle shelf at the back: a few coloured syrups
  box(geos, '#7a6a52', 1.02, 0.05, 0.18, 0, 1.12, -0.26);
  const syrups = ['#c8202e', '#e8a51c', '#2e8f3e', '#e05a1a', '#8a2a8a'];
  syrups.forEach((c, i) => box(geos, c, 0.07, 0.24, 0.07, -0.36 + i * 0.18, 1.27, -0.26));
  // handle, wheels and the umbrella
  box(geos, '#3a3d40', 0.05, 0.05, 0.5, -0.45, 0.95, -0.55); box(geos, '#3a3d40', 0.05, 0.05, 0.5, 0.45, 0.95, -0.55);
  box(geos, '#3a3d40', 0.95, 0.05, 0.05, 0, 0.95, -0.8);
  for (const sx of [-1, 1]) {
    const w = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 14); w.rotateZ(Math.PI / 2); w.translate(sx * 0.6, 0.24, 0.05);
    geos.push(paint(w, '#2a2b2e'));
  }
  // the two stabiliser posts, from the ground 2 cm into the box's underside (at 0.22 m)
  box(geos, '#3a3d40', 0.04, 0.24, 0.04, 0.35, 0.12, -0.3); box(geos, '#3a3d40', 0.04, 0.24, 0.04, -0.35, 0.12, -0.3);
  const pole = new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6); pole.translate(0.4, 1.7, -0.25); geos.push(paint(pole, '#d8d8d4'));
  // the umbrella: one open cone, drawn from both sides (the material is double-sided), its pole meeting the apex
  const um = new THREE.ConeGeometry(0.95, 0.32, 10, 1, true); um.translate(0.4, 2.2, -0.25); geos.push(paint(um, '#2d76b8'));
  return merge(geos);
}

export function createAccents({ world, net, scene, inBuild = null }) {
  const { sampler, isDry, height } = world;
  const closedAt = sampler.offLimitsAt ?? (() => false);
  const probe = { normal: {} };
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0, halfLengthMetres: 0, minY: 0, maxY: 0 };
  // distance from (x,z) to the nearest walk link's corridor edge
  const g = new Map(), key = (i, j) => i * 100000 + j;
  for (let k = 0; k < net.links; k++) {
    const mx = (net.nx[net.a[k]] + net.nx[net.b[k]]) / 2, mz = (net.nz[net.a[k]] + net.nz[net.b[k]]) / 2;
    const r = net.len[k] / 2 + 1, i0 = Math.floor((mx - r) / 8), i1 = Math.floor((mx + r) / 8), j0 = Math.floor((mz - r) / 8), j1 = Math.floor((mz + r) / 8);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const kk = key(i, j); let a = g.get(kk); if (!a) g.set(kk, a = []); a.push(k); }
  }
  // walks whose corridor comes within `margin` of (x,z); a square's lattice links may be closed instead (people go
  // round on the rest of the lattice), any other walk keeps its clearance
  const PLAZA_KIND = 4;
  const walksNear = (x, z, margin, out) => {
    out.length = 0;
    for (let i = Math.floor((x - 9) / 8); i <= Math.floor((x + 9) / 8); i++) for (let j = Math.floor((z - 9) / 8); j <= Math.floor((z + 9) / 8); j++) {
      for (const k of g.get(key(i, j)) ?? []) {
        if (out.includes(k)) continue;
        const ax = net.nx[net.a[k]], az = net.nz[net.a[k]], t = Math.max(0, Math.min(net.len[k], (x - ax) * net.dirX[k] + (z - az) * net.dirZ[k]));
        const d = Math.hypot(x - ax - net.dirX[k] * t, z - az - net.dirZ[k] * t);
        if (d < net.width[k] + 0.3 + margin) out.push(k);
      }
    }
    return out;
  };
  const scratch = [];
  const clearOfWalks = (x, z, margin, plazaOk = false) => walksNear(x, z, margin, scratch).every((k) => plazaOk && net.kind[k] === PLAZA_KIND);
  net.blocked ??= new Uint8Array(net.links);
  const flatClear = (x, z, hx, hz, heading, top, margin = 0) => {
    if (!isDry(x, z)) return null;
    const gr = sampler.cityGround(x, z, probe, height(x, z) + 0.35);
    if (gr.water || closedAt(x, z, gr.height)) return null;
    const c = Math.cos(heading), s = Math.sin(heading);
    let lo = Infinity, hi = -Infinity;
    for (const [u, v] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz], [0, 0]]) {
      const px = x + c * u + s * v, pz = z - s * u + c * v;
      if (!isDry(px, pz)) return null;
      const q = sampler.cityGround(px, pz, probe, gr.height + 0.4).height;
      lo = Math.min(lo, q); hi = Math.max(hi, q);
    }
    if (hi - lo > 0.14) return null;
    body.x = x; body.z = z; body.headingY = heading; body.halfWidthMetres = hx + margin; body.halfLengthMetres = hz + margin;
    body.minY = hi + 0.08; body.maxY = lo + top;
    return sampler.isVolumeClear(body) ? { y: lo } : null;
  };
  const seats = [];   // [x, z, seatY, heading, groundY, kind, group]
  const carts = [];
  // ---- the carts ----
  const targets = [];
  if (world.plaza?.gazebo && world.plaza?.fountain) {
    const gz = world.plaza.gazebo, f = world.plaza.fountain, d = Math.hypot(f.x - gz.x, f.z - gz.z) || 1;
    targets.push({ x: gz.x + (f.x - gz.x) / d * 6.5, z: gz.z + (f.z - gz.z) / d * 6.5, face: [f.x, f.z] });
  }
  if (world.princesa?.fountain) {
    const f = world.princesa.fountain;
    targets.push({ x: f.x + 15, z: f.z - 6, face: [f.x, f.z] });
  }
  for (const t of targets) {
    let best = null;
    for (let r = 0; r <= 9 && !best; r += 1) for (let a = 0; a < 16 && !best; a++) {
      const x = t.x + Math.cos(a / 16 * Math.PI * 2) * r, z = t.z + Math.sin(a / 16 * Math.PI * 2) * r;
      // the cart faces the walk (its customers' side) and turns its back to the focus point's far side
      const heading = Math.atan2(t.face[0] - x, t.face[1] - z);
      if (!clearOfWalks(x, z, 0.85, true)) continue;
      const spot = flatClear(x, z, CART.halfX + 0.05, CART.halfZ + 0.6, heading, CART.height - 0.2, 0.25);
      if (!spot) continue;
      // vendor behind, two customers in front, each clear and reachable from the walk
      const c = Math.cos(heading), s = Math.sin(heading), P = (u, v) => [x + c * u + s * v, z - s * u + c * v];
      const vendor = P(0.05, -1.0), cust = [P(-0.38, 1.05), P(0.42, 1.0)];
      if (![vendor, ...cust].every(([px, pz]) => flatClear(px, pz, 0.22, 0.22, heading, 1.8))) continue;
      best = { x, z, y: spot.y, heading, vendor, cust };
    }
    if (!best) continue;
    for (const k of walksNear(best.x, best.z, 1.0, scratch)) net.blocked[k] = 1; // lattice links round the cart close
    const group = carts.length;
    carts.push(best);
    for (const [px, pz] of best.cust) seats.push(px, pz, best.y, best.heading + Math.PI, best.y, SEAT_KIND.CUSTOMER, group);
    seats.push(best.vendor[0], best.vendor[1], best.y, best.heading, best.y, SEAT_KIND.VENDOR, group);
  }
  // ---- the kite on the El Morro lawn ----
  let kite = null;
  const lawn = world.city.places.find((p) => /El Morro/.test(p.name));
  if (lawn) {
    let best = null;
    for (let r = 10; r <= 80 && !best; r += 4) for (let a = 0; a < 24 && !best; a++) {
      const x = lawn.x + Math.cos(a / 24 * Math.PI * 2) * r, z = lawn.z + Math.sin(a / 24 * Math.PI * 2) * r;
      const gr = sampler.cityGround(x, z, probe, height(x, z) + 0.35);
      if (gr.surface !== 'grass' || !clearOfWalks(x, z, 9)) continue;
      const spot = flatClear(x, z, 2.2, 2.2, 0, 2.2);
      if (spot) best = { x, z, y: spot.y };
    }
    if (best) {
      // flown out over the lawn towards the sea (the north-west, away from the town)
      const wind = Math.atan2(-0.55, -0.83);
      kite = { ...best, wind };
      const c = Math.cos(wind), s = Math.sin(wind), P = (u, v) => [best.x + c * u + s * v, best.z - s * u + c * v];
      const g0 = carts.length;
      seats.push(best.x, best.z, best.y, wind, best.y, SEAT_KIND.FLYER, g0);
      const [ax, az] = P(-1.1, -0.6), [bx, bz] = P(0.9, -1.4);
      seats.push(ax, az, best.y, wind + 0.4, best.y, SEAT_KIND.COMPANION, g0);
      seats.push(bx, bz, best.y + 0.1, wind + 0.2, sampler.cityGround(bx, bz, probe, best.y + 0.4).height, SEAT_KIND.GRASS, g0);
    }
  }

  // ---- drawing ----
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  const cartMesh = new THREE.InstancedMesh(cartGeometry(), material, Math.max(1, carts.length));
  cartMesh.name = 'PiraguaCarts';
  cartMesh.castShadow = true; cartMesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();
  carts.forEach((c, i) => { q.setFromAxisAngle(up, c.heading); at.set(c.x, c.y, c.z); cartMesh.setMatrixAt(i, m.compose(at, q, one)); });
  cartMesh.count = carts.length;
  cartMesh.instanceMatrix.needsUpdate = true;
  cartMesh.computeBoundingSphere();
  scene.add(cartMesh);
  const cartBodies = carts.map((c) => ({ x: c.x, z: c.z, headingY: c.heading, halfWidthMetres: CART.halfX, halfLengthMetres: CART.halfZ,
    minY: c.y, maxY: c.y + 1.15, velocityX: 0, velocityZ: 0, kind: 'cart' }));

  // kite: a diamond with a ribbon tail, and its line to the flyer's hand
  let kiteMesh = null, line = null, linePos = null;
  if (kite) {
    const kg = new THREE.BufferGeometry();
    const v = new Float32Array([0, 0.62, 0, -0.42, 0.12, 0, 0, -0.58, 0, 0, 0.62, 0, 0, -0.58, 0, 0.42, 0.12, 0,
      // tail bows
      ...[1, 2, 3, 4, 5].flatMap((k) => { const y = -0.58 - k * 0.34, x = Math.sin(k * 1.3) * 0.08; return [x - 0.1, y + 0.05, 0, x + 0.1, y - 0.05, 0, x - 0.1, y - 0.05, 0, x - 0.1, y + 0.05, 0, x + 0.1, y + 0.05, 0, x + 0.1, y - 0.05, 0]; })]);
    const col = new Float32Array(v.length);
    const paintTri = (i, c) => { const cc = new THREE.Color(c); for (let k = 0; k < 3; k++) { col[(i * 3 + k) * 3] = cc.r; col[(i * 3 + k) * 3 + 1] = cc.g; col[(i * 3 + k) * 3 + 2] = cc.b; } };
    paintTri(0, '#d23a2a'); paintTri(1, '#f2c12e');
    for (let t = 2; t < v.length / 9; t++) paintTri(t, t % 4 < 2 ? '#d23a2a' : '#2a6ab0');
    kg.setAttribute('position', new THREE.BufferAttribute(v, 3)); kg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    kg.computeVertexNormals(); kg.computeBoundingSphere();
    kiteMesh = new THREE.Mesh(kg, material);
    kiteMesh.name = 'Kite'; kiteMesh.castShadow = false;
    scene.add(kiteMesh);
    linePos = new Float32Array(13 * 3);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xe8e4da, transparent: true, opacity: 0.7 }));
    line.name = 'KiteLine'; line.frustumCulled = false;
    scene.add(line);
  }
  let warming = false;
  const tmp = new THREE.Vector3();
  return {
    seats, carts, kite,
    update(elapsed, focusX, focusZ, hand, flyerDrawn = true) {
      if (!kite) return;
      const near = warming || Math.hypot(kite.x - focusX, kite.z - focusZ) < 380;
      kiteMesh.visible = near; line.visible = near && (warming || flyerDrawn);
      if (!near) return;
      const t = elapsed;
      const reach = 30 + Math.sin(t * 0.21) * 3, alt = 21 + Math.sin(t * 0.37) * 2.2 + Math.sin(t * 1.1) * 0.6;
      const side = Math.sin(t * 0.29) * 4 + Math.sin(t * 0.83) * 1.2;
      const fx = Math.sin(kite.wind), fz = Math.cos(kite.wind), rx = -fz, rz = fx;
      const kx = kite.x + fx * reach + rx * side, kz = kite.z + fz * reach + rz * side, ky = kite.y + alt;
      kiteMesh.position.set(kx, ky, kz);
      kiteMesh.lookAt(kite.x, kite.y + 1.6, kite.z);
      kiteMesh.rotateZ(Math.sin(t * 1.7) * 0.25);
      // the line, sagging a little, from the hand (or the flyer's raised arm) to the kite's bridle
      const hx = hand?.x ?? kite.x + fx * 0.45, hy = hand?.y ?? kite.y + 1.75, hz = hand?.z ?? kite.z + fz * 0.45;
      kiteMesh.updateMatrixWorld(); tmp.set(0, 0.05, 0).applyMatrix4(kiteMesh.matrixWorld);
      for (let i = 0; i <= 12; i++) {
        const u = i / 12, sag = Math.sin(Math.PI * u) * 1.6;
        linePos[i * 3] = hx + (tmp.x - hx) * u; linePos[i * 3 + 1] = hy + (tmp.y - hy) * u - sag; linePos[i * 3 + 2] = hz + (tmp.z - hz) * u;
      }
      line.geometry.attributes.position.needsUpdate = true;
    },
    publish(index, focusX, focusZ) {
      for (const b of cartBodies) if (Math.hypot(b.x - focusX, b.z - focusZ) < 140) index.add(b);
    },
    warm(on) { warming = !!on; if (kiteMesh && on) kiteMesh.visible = line.visible = true; },
    dispose() {
      for (const o of [cartMesh, kiteMesh, line]) if (o) { o.removeFromParent(); o.geometry.dispose(); }
      material.dispose(); line?.material.dispose();
    },
  };
}
