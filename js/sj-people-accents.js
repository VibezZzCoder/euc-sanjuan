/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Accents of the old city's street life, placed at boot from the live world:
// - piragua carts (shaved ice with syrup) at the Plaza de Armas gazebo and on the Paseo de la Princesa by the Raíces
//   fountain: a waist-high two-wheeled box with a blue umbrella and a shelf of coloured syrup bottles (reference photo
//   27 and the Wikimedia Commons "Piragua truck, Old San Juan" view; no product marks), a vendor behind it and a place
//   for two customers in front. The cart is a body the rider stops against, like a parked car.
// - the kite field on the El Morro lawn (reference photo 19: a delta with a long ribbon over the esplanade; the park
//   lists kite flying there, and on a breezy afternoon the sky over the lawn is full of them): twenty-two kites of three
//   kinds (the diamond chiringa with its bow tail, a delta with ribbons, a six-sided chiringa with a cloth tail), each
//   on its own line to a flyer on the grass, some with company; families on picnic blankets watching; and one kite
//   seller's rack beside the path. All of it stands well off the paths; the rack is a body like a cart.
// The people are seats in the people's own seat table (js/sj-people.js): `kind` 1 customer, 2 vendor, 3 kite flyer,
// 4 standing companion, 5 sitting on the grass. `group` joins a flyer to a kite (KITE_GROUP + its index).
import * as THREE from 'three/webgpu';
import { attribute, uniform } from 'three/tsl';

export const SEAT_KIND = Object.freeze({ BENCH: 0, CUSTOMER: 1, VENDOR: 2, FLYER: 3, COMPANION: 4, GRASS: 5 });
export const KITE_GROUP = 100;
const CART = { halfX: 0.62, halfZ: 0.42, height: 2.35 };
const RACK = { halfX: 1.0, halfZ: 0.5, height: 2.05 };
const KITES = 22, PICNICS = 8, LINE_PARTS = 12;
// kite cloth is thin: it carries some of its colour whichever side the light is on (less at blue hour)
const KITE_GLOW = { midday: 0.3, golden: 0.32, blue: 0.1 };
const PALETTES = [['#d23a2a', '#f2c12e', '#f4f1e6'], ['#2a6ab0', '#f4f1e6', '#f2c12e'], ['#e2572b', '#2e8f6e', '#f4f1e6'], ['#8a3ea8', '#f2c12e', '#f4f1e6'],
  ['#1f9aa8', '#e84a6a', '#f4f1e6'], ['#f4f1e6', '#d23a2a', '#2a6ab0'], ['#3aa64a', '#f2c12e', '#f4f1e6'], ['#e84a8a', '#2a6ab0', '#f4f1e6']];
// Kite patterns in the kite's own plane (x to its right, y up its spine, metres at scale 1): panels as triangles with a
// palette index, and tails hanging from a point: `bows` is the chiringa's string of cloth bows, otherwise a ribbon.
const KITE_KINDS = [
  { name: 'diamond', panels: [[0, 0.62, -0.42, 0.12, 0, 0.12, 0], [0, 0.62, 0, 0.12, 0.42, 0.12, 1], [-0.42, 0.12, 0, -0.58, 0, 0.12, 1], [0, 0.12, 0, -0.58, 0.42, 0.12, 0]],
    tails: [{ x: 0, y: -0.58, length: 2.3, parts: 6, width: 0.2, bows: true, colours: [0, 1] }] },
  { name: 'delta', panels: [[0, 0.5, -0.95, -0.3, -0.16, -0.3, 0], [0, 0.5, 0.16, -0.3, 0.95, -0.3, 0], [0, 0.5, -0.16, -0.3, 0.16, -0.3, 1]],
    tails: [{ x: 0, y: -0.3, length: 3.4, parts: 9, width: 0.08, colours: [1, 1] }, { x: -0.6, y: -0.3, length: 1.3, parts: 4, width: 0.06, colours: [0, 0] }, { x: 0.6, y: -0.3, length: 1.3, parts: 4, width: 0.06, colours: [0, 0] }] },
  { name: 'hexagon', panels: [0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2, b = ((i + 1) / 6) * Math.PI * 2;
      return [0, 0, Math.sin(a) * 0.5, Math.cos(a) * 0.5, Math.sin(b) * 0.5, Math.cos(b) * 0.5, i % 3]; }),
    tails: [{ x: 0, y: -0.5, length: 3.0, parts: 8, width: 0.1, colours: [0, 2] }] },
];
const kiteVertices = (kind) => kind.panels.length * 3 + kind.tails.reduce((n, t) => n + t.parts * 6, 0);
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

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
// flat triangles from a list of points [x,y,z, …] (three per triangle), in one colour
function flat(geos, colour, points) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
  g.computeVertexNormals();
  geos.push(paint(g, colour));
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

// The kite seller's rack, at the origin facing +Z (the path): two posts, two rails of small kites, a crate of spools
function rackGeometry() {
  const geos = [], wood = '#6b4a2e';
  for (const sx of [-1, 1]) { box(geos, wood, 0.06, 2.05, 0.06, sx * 0.95, 1.025, 0); box(geos, wood, 0.07, 0.06, 0.8, sx * 0.95, 0.03, 0); }
  box(geos, wood, 1.96, 0.05, 0.05, 0, 2.02, 0); box(geos, wood, 1.96, 0.04, 0.04, 0, 1.14, 0);
  const hang = (x, y, half, pal, z) => {
    const [a, b] = PALETTES[pal], top = y + half * 1.45, low = y - half * 1.55;
    flat(geos, a, [x, top, z, x - half, y, z, x, low, z]); flat(geos, b, [x, top, z, x, low, z, x + half, y, z]);
    box(geos, '#e8e4da', 0.012, 0.12, 0.012, x, top + 0.06, z);              // its loop over the rail
    box(geos, a, 0.03, 0.3, 0.006, x + 0.03, low - 0.15, z);                 // a folded tail
  };
  [-0.69, -0.23, 0.23, 0.69].forEach((x, i) => hang(x, 1.58, 0.19, [0, 4, 6, 3][i], 0.035));
  [-0.46, 0, 0.46].forEach((x, i) => hang(x, 0.72, 0.19, [1, 7, 2][i], 0.035));
  box(geos, '#9a7b52', 0.46, 0.34, 0.36, 0.64, 0.17, 0.3);                    // the crate
  ['#f4f1e6', '#d23a2a', '#2a6ab0'].forEach((c, i) => { const w = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10); w.translate(0.5 + i * 0.14, 0.39, 0.3); geos.push(paint(w, c)); });
  return merge(geos);
}

export function createAccents({ world, net, scene, inBuild = null, hour = 'golden' }) {
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
  // ---- the kite field on the El Morro lawn ----
  const kites = [], picnics = [], lawnGeos = [];
  let rack = null;
  const lawn = world.city.places.find((p) => /El Morro/.test(p.name));
  if (lawn) {
    const rng = mulberry(0x4b17e5), between = (a, b) => a + (b - a) * rng();
    // out over the lawn towards the sea (the north-west, away from the town): the trade wind's lee
    const wind = Math.atan2(-0.55, -0.83);
    const grassAt = (x, z) => {
      if (!isDry(x, z)) return null;
      const gr = sampler.cityGround(x, z, probe, height(x, z) + 0.35);
      return gr.surface === 'grass' && !gr.water && !closedAt(x, z, gr.height) ? gr.height : null;
    };
    const closedUnder = (x, z) => isDry(x, z) && closedAt(x, z, height(x, z));
    const far = (list, x, z, d) => list.every((o) => Math.hypot(o.x - x, o.z - z) >= d);
    const person = (x, z, heading, kind, group, sit = false) => {
      const y = grassAt(x, z);
      if (y == null || !flatClear(x, z, 0.22, 0.22, heading, 1.8)) return false;
      seats.push(x, z, sit ? y + 0.1 : y, heading, y, kind, group);
      return true;
    };
    // candidate spots: a low-discrepancy scatter over the esplanade, so the field spreads out instead of clumping
    const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
    let cand = 0, restarted = false;
    const next = () => { cand++; return [lawn.x - 185 + halton(cand, 2) * 400, lawn.z - 150 + halton(cand, 3) * 305]; };
    // the first ten stand on the fort's side of where the rider arrives (the way the path leads and the eye looks),
    // the rest anywhere on the esplanade
    const AHEAD = 10;
    for (let tries = 0; kites.length < KITES && tries < 1800; tries++) {
      if (kites.length === AHEAD && cand > 0 && !restarted) { cand = 0; restarted = true; }
      const [x, z] = next(), i = kites.length;
      if (i < AHEAD && !restarted && (x - lawn.x) * Math.sin(wind) + (z - lawn.z) * Math.cos(wind) < 12) continue;
      if (grassAt(x, z) == null || !far(kites, x, z, 24) || !clearOfWalks(x, z, 9)) continue;
      // (the lawn rolls: a flyer needs a foothold, not a terrace)
      const spot = flatClear(x, z, 0.4, 0.4, 0, 2.2);
      if (!spot) continue;
      // one in six is a beginner's kite on a short line; the rest ride high on 26 to 56 m of line
      const low = i % 6 === 4, length = low ? between(11, 15) : between(26, 56), elevation = low ? between(0.5, 0.62) : between(0.52, 0.95);
      const az = wind + between(-0.24, 0.24), reach = length * Math.cos(elevation);
      // over the fort or another closed place only well above it: the line clears walls and roofs by a wide margin
      const rise = length * Math.sin(elevation - 0.08);
      if ([0.25, 0.5, 0.75, 1].some((u) => { const qx = x + Math.sin(az) * reach * u, qz = z + Math.cos(az) * reach * u;
        return closedUnder(qx, qz) && spot.y + 1.75 + rise * u - length * 0.035 < height(qx, qz) + 16; })) continue;
      const kind = KITE_KINDS[i % KITE_KINDS.length], palette = PALETTES[(i * 5 + (i >> 3)) % PALETTES.length];
      kites.push({ x, z, y: spot.y, wind: az, group: KITE_GROUP + i, kind, palette, low, length, elevation, scale: low ? between(1.2, 1.5) : between(1.5, 2.3),
        swing: between(0.09, 0.2) * (low ? 1.5 : 1), rate: between(0.8, 1.25), phase: rng() * 40 });
      const c = Math.cos(az), s = Math.sin(az), P = (u, v) => [x + c * u + s * v, z - s * u + c * v], group = KITE_GROUP + i;
      seats.push(x, z, spot.y, az, spot.y, SEAT_KIND.FLYER, group);
      // who is with the flyer: a family, nobody, two sitting behind, a friend alongside
      const company = [[[-1.1, -0.6, 0.4, 0], [0.9, -1.4, 0.2, 1]], [], [[-1.2, -1.0, 0.15, 1], [-0.3, -1.9, -0.2, 1]], [[1.0, -0.5, -0.5, 0]]][i % 4];
      for (const [u, v, turn, sit] of company) person(...P(u, v), az + turn, sit ? SEAT_KIND.GRASS : SEAT_KIND.COMPANION, group, !!sit);
    }
    // families on blankets, facing the kites
    while (picnics.length < PICNICS && cand < 1500) {
      const [x, z] = next(), i = picnics.length, heading = wind + between(-0.5, 0.5);
      if (grassAt(x, z) == null || !far(kites, x, z, 9) || !far(picnics, x, z, 16) || !clearOfWalks(x, z, 4)) continue;
      const spot = flatClear(x, z, 0.5, 0.5, heading, 1.4);
      if (!spot || Math.abs((grassAt(x + Math.sin(heading) * 0.8, z + Math.cos(heading) * 0.8) ?? 1e9) - (grassAt(x - Math.sin(heading) * 0.8, z - Math.cos(heading) * 0.8) ?? -1e9)) > 0.2) continue;
      const c = Math.cos(heading), s = Math.sin(heading), P = (u, v) => [x + c * u + s * v, z - s * u + c * v], group = 200 + i;
      picnics.push({ x, z, y: spot.y, heading });
      person(...P(-0.45, 0.05), heading + between(-0.3, 0.3), SEAT_KIND.GRASS, group, true);
      person(...P(0.5, -0.15), heading + between(-0.3, 0.3), SEAT_KIND.GRASS, group, true);
      if (i % 3 === 0) person(...P(1.55, 0.25), heading + Math.PI * 0.75, SEAT_KIND.COMPANION, group);
      else if (i % 3 === 1) person(...P(-0.1, 0.85), heading + between(-0.2, 0.2), SEAT_KIND.GRASS, group, true);
      // the blanket: a check of two colours laid on the grass (it follows the ground)
      const [ca, cb] = PALETTES[(i * 5 + 1) % PALETTES.length], N = 4, hx = 1.05, hz = 0.8;
      const at = (iu, iv) => { const [bx, bz] = P(-hx + (2 * hx * iu) / N, -hz + (2 * hz * iv) / N); return [bx, (grassAt(bx, bz) ?? spot.y) + 0.035, bz]; };
      for (let iu = 0; iu < N; iu++) for (let iv = 0; iv < N; iv++) {
        const p00 = at(iu, iv), p10 = at(iu + 1, iv), p11 = at(iu + 1, iv + 1), p01 = at(iu, iv + 1);
        flat(lawnGeos, (iu + iv) % 2 ? ca : cb, [...p00, ...p01, ...p11, ...p00, ...p11, ...p10]);
      }
    }
    // the kite seller's rack: on the grass a few steps off the path, facing it, near where the rider arrives
    for (let r = 10; r <= 90 && !rack; r += 3) for (let a = 0; a < 24 && !rack; a++) {
      const x = lawn.x + Math.cos((a / 24) * Math.PI * 2) * r, z = lawn.z + Math.sin((a / 24) * Math.PI * 2) * r;
      if (grassAt(x, z) == null || !clearOfWalks(x, z, 2.2) || clearOfWalks(x, z, 4.6) || !far(kites, x, z, 8) || !far(picnics, x, z, 6)) continue;
      // face the nearest point of the nearest walk
      let face = null, best = Infinity;
      for (const k of walksNear(x, z, 4.6, scratch)) {
        const ax = net.nx[net.a[k]], az = net.nz[net.a[k]], t = Math.max(0, Math.min(net.len[k], (x - ax) * net.dirX[k] + (z - az) * net.dirZ[k]));
        const qx = ax + net.dirX[k] * t, qz = az + net.dirZ[k] * t, d = Math.hypot(x - qx, z - qz);
        if (d < best) { best = d; face = [qx, qz]; }
      }
      if (!face) continue;
      const heading = Math.atan2(face[0] - x, face[1] - z), spot = flatClear(x, z, RACK.halfX, RACK.halfZ, heading, RACK.height, 0.2);
      if (!spot) continue;
      const c = Math.cos(heading), s = Math.sin(heading), P = (u, v) => [x + c * u + s * v, z - s * u + c * v];
      const vendor = P(-1.5, 0.15), browser = P(0.15, 1.2);
      if (![vendor, browser].every(([px, pz]) => grassAt(px, pz) != null && flatClear(px, pz, 0.22, 0.22, heading, 1.8))) continue;
      rack = { x, z, y: spot.y, heading };
      seats.push(vendor[0], vendor[1], spot.y, heading + 0.5, spot.y, SEAT_KIND.VENDOR, 300);
      seats.push(browser[0], browser[1], spot.y, heading + Math.PI, spot.y, SEAT_KIND.COMPANION, 300);
      const g = rackGeometry(); g.rotateY(heading); g.translate(x, spot.y, z); lawnGeos.push(g);
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

  // the lawn's still things: the picnic blankets and the kite seller's rack, one mesh
  let lawnMesh = null;
  if (lawnGeos.length) {
    lawnMesh = new THREE.Mesh(merge(lawnGeos), material);
    lawnMesh.name = 'LawnThings'; lawnMesh.castShadow = true; lawnMesh.receiveShadow = true;
    scene.add(lawnMesh);
  }
  const rackBody = rack && { x: rack.x, z: rack.z, headingY: rack.heading, halfWidthMetres: RACK.halfX, halfLengthMetres: RACK.halfZ,
    minY: rack.y, maxY: rack.y + 1.9, velocityX: 0, velocityZ: 0, kind: 'cart' };

  // the kites: every kite in one mesh whose points are written each frame (panels, and tails that stream and wave),
  // and every line in one set of segments. Two draws for the whole field.
  let kiteMesh = null, line = null, kitePos = null, kiteNor = null, linePos = null, kiteMaterial = null, lineMaterial = null;
  const glow = uniform(KITE_GLOW[hour] ?? KITE_GLOW.golden);
  let centreX = 0, centreZ = 0;
  if (kites.length) {
    let total = 0;
    for (const k of kites) { k.first = total; total += kiteVertices(k.kind); centreX += k.x / kites.length; centreZ += k.z / kites.length; }
    kitePos = new Float32Array(total * 3); kiteNor = new Float32Array(total * 3);
    const col = new Float32Array(total * 3), tint = new THREE.Color();
    for (const k of kites) {
      let v = k.first;
      const put = (index, n) => { tint.set(k.palette[index]); for (let j = 0; j < n; j++, v++) { col[v * 3] = tint.r; col[v * 3 + 1] = tint.g; col[v * 3 + 2] = tint.b; } };
      for (const panel of k.kind.panels) put(panel[6], 3);
      for (const tail of k.kind.tails) for (let j = 0; j < tail.parts; j++) put(tail.colours[j % tail.colours.length], 6);
    }
    const kg = new THREE.BufferGeometry();
    const dynamic = (array) => { const a = new THREE.BufferAttribute(array, 3); a.setUsage(THREE.DynamicDrawUsage); return a; };
    kg.setAttribute('position', dynamic(kitePos)); kg.setAttribute('normal', dynamic(kiteNor)); kg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    kiteMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    kiteMaterial.emissiveNode = attribute('color', 'vec3').mul(glow);
    kiteMesh = new THREE.Mesh(kg, kiteMaterial);
    kiteMesh.name = 'Kites'; kiteMesh.castShadow = false; kiteMesh.frustumCulled = false;
    scene.add(kiteMesh);
    linePos = new Float32Array(kites.length * LINE_PARTS * 6);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', dynamic(linePos));
    lineMaterial = new THREE.LineBasicMaterial({ color: 0xe8e4da, transparent: true, opacity: 0.45 });
    line = new THREE.LineSegments(lg, lineMaterial);
    line.name = 'KiteLines'; line.frustumCulled = false;
    scene.add(line);
  }
  let warming = false;
  const hand = { x: 0, y: 0, z: 0 };
  // one kite: where it is now, how it faces its flyer and banks into its weave, then its points.
  // (Nothing is allocated per frame: the frame of the kite being written lives in these variables.)
  let px = 0, py = 0, pz = 0, ax = 0, ay = 0, az2 = 0, bx = 0, by = 0, bz = 0, fx = 0, fy = 0, fz = 0, S = 1, v = 0, T = 0, tx = 0, ty = 0, tw = 0;
  const point = (x, y, w) => {
    kitePos[v] = px + (ax * x + bx * y + fx * w) * S; kitePos[v + 1] = py + (ay * x + by * y + fy * w) * S; kitePos[v + 2] = pz + (az2 * x + bz * y + fz * w) * S;
    kiteNor[v] = fx; kiteNor[v + 1] = fy; kiteNor[v + 2] = fz; v += 3;
  };
  // a point d metres down a tail (into tx, ty, tw): it streams down the kite's spine (down and downwind) and waves
  // more towards its end
  const along = (tail, n, d) => {
    const u = d / tail.length, wave = 0.2 + tail.length * 0.05;
    tx = tail.x + Math.sin(T * 4.4 - d * 2.3 + n * 1.7) * wave * u; ty = tail.y - d * 0.96; tw = Math.cos(T * 3.7 - d * 2.0 + n) * wave * 0.7 * u;
  };
  function fly(k, index, t, handOf) {
    T = t * k.rate + k.phase;
    const elevation = k.elevation + Math.sin(T * 0.37) * 0.06 + Math.sin(T * 1.1) * 0.02 + (k.low ? Math.sin(T * 0.9) * 0.16 : 0);
    const az = k.wind + Math.sin(T * 0.29) * k.swing + Math.sin(T * 0.83) * k.swing * 0.3;
    const reach = k.length * Math.cos(elevation);
    px = k.x + Math.sin(az) * reach; pz = k.z + Math.cos(az) * reach; py = k.y + 1.75 + k.length * Math.sin(elevation);
    const held = handOf !== null && handOf(index, hand) === true;
    const hx = held ? hand.x : k.x + Math.sin(k.wind) * 0.45, hy = held ? hand.y : k.y + 1.75, hz = held ? hand.z : k.z + Math.cos(k.wind) * 0.45;
    // the kite's frame: f from the kite to the hand (its face looks down the line), r to its right, u up its spine
    fx = hx - px; fy = hy - py; fz = hz - pz; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;      // up × f
    const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;                           // f × r
    const roll = Math.cos(T * 0.29) * k.swing * 1.5 + Math.sin(T * 1.7) * 0.1 + (k.low ? Math.sin(T * 2.3) * 0.18 : 0), cr = Math.cos(roll), sr = Math.sin(roll);
    ax = rx * cr + ux * sr; ay = uy * sr; az2 = rz * cr + uz * sr;                        // right, rolled
    bx = ux * cr - rx * sr; by = uy * cr; bz = uz * cr - rz * sr;                         // up, rolled
    S = k.scale; v = k.first * 3;
    const panels = k.kind.panels, tails = k.kind.tails;
    for (let i = 0; i < panels.length; i++) { const p = panels[i]; point(p[0], p[1], 0); point(p[2], p[3], 0); point(p[4], p[5], 0); }
    for (let n = 0; n < tails.length; n++) {
      const tail = tails[n], half = tail.width / 2;
      for (let j = 0; j < tail.parts; j++) {
        if (tail.bows) {
          along(tail, n, ((j + 1) / tail.parts) * tail.length);
          const x = tx, y = ty, w = tw, tilt = Math.sin(T * 5 + j * 1.9) * 0.05;
          point(x - half, y + 0.05 + tilt, w); point(x + half, y - 0.05 - tilt, w); point(x - half, y - 0.05 + tilt, w);
          point(x - half, y + 0.05 + tilt, w); point(x + half, y + 0.05 - tilt, w); point(x + half, y - 0.05 - tilt, w);
        } else {
          along(tail, n, (j / tail.parts) * tail.length); const x0 = tx, y0 = ty, w0 = tw;
          along(tail, n, ((j + 1) / tail.parts) * tail.length); const x1 = tx, y1 = ty, w1 = tw;
          point(x0 - half, y0, w0); point(x1 - half, y1, w1); point(x1 + half, y1, w1);
          point(x0 - half, y0, w0); point(x1 + half, y1, w1); point(x0 + half, y0, w0);
        }
      }
    }
    // the line from the hand to the kite's bridle, sagging a little; no line without a flyer drawn to hold it
    const o = index * LINE_PARTS * 6, sag = k.length * 0.035, show = held || warming;
    for (let j = 0; j < LINE_PARTS; j++) for (let e = 0; e < 2; e++) {
      const u = show ? (j + e) / LINE_PARTS : 1, q = o + (j * 2 + e) * 3;
      linePos[q] = hx + (px - hx) * u; linePos[q + 1] = hy + (py - hy) * u - Math.sin(Math.PI * u) * sag; linePos[q + 2] = hz + (pz - hz) * u;
    }
  }
  return {
    seats, carts, kites, picnics, rack,
    /** handOf(kiteIndex, out): fills out with the flyer's raised palm and returns true while that flyer is drawn. */
    update(elapsed, focusX, focusZ, handOf = null) {
      if (!kiteMesh) return;
      const near = warming || Math.hypot(centreX - focusX, centreZ - focusZ) < 520;
      kiteMesh.visible = line.visible = near;
      if (!near) return;
      for (let i = 0; i < kites.length; i++) fly(kites[i], i, elapsed, handOf);
      kiteMesh.geometry.attributes.position.needsUpdate = true; kiteMesh.geometry.attributes.normal.needsUpdate = true;
      line.geometry.attributes.position.needsUpdate = true;
    },
    publish(index, focusX, focusZ) {
      for (const b of cartBodies) if (Math.hypot(b.x - focusX, b.z - focusZ) < 140) index.add(b);
      if (rackBody && Math.hypot(rackBody.x - focusX, rackBody.z - focusZ) < 140) index.add(rackBody);
    },
    setHour(name) { glow.value = KITE_GLOW[name] ?? KITE_GLOW.golden; },
    warm(on) { warming = !!on; if (kiteMesh && on) kiteMesh.visible = line.visible = true; },
    dispose() {
      for (const o of [cartMesh, lawnMesh, kiteMesh, line]) if (o) { o.removeFromParent(); o.geometry.dispose(); }
      material.dispose(); kiteMaterial?.dispose(); lineMaterial?.dispose();
    },
  };
}
