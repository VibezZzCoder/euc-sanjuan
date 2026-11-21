/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Parked cars of Old San Juan: one-sided, broken rows on the old streets and a partial fill of a few open lots.
// Reference photographs (research pack 04, 05, 10, 81, 98, 01, 02; Wikimedia Commons "Calle San Sebastián
// 2021-08-09" by G. Edward Johnson, CC BY 4.0, viewed only): groups of two to five cars with irregular bumper gaps,
// whole blocks left empty, wheels on the carriageway beside the kerb, the opposite kerb clear, mixed types and colours,
// facing the direction of travel on one-way streets.
//
// Built once during the world build (js/sj-world.js loadCity), before the sampler: every parked car is a static solid
// (upright prisms fitted to its body sections) registered with the city's colliders, so the rider, the camera,
// placement and recovery treat it like any wall. The vehicle kit (js/sj-vehicles.js) draws the same records.
//
// Sides come from js/sj-street-sides.js (`parkingSide`, `parkedOffset`), shared with the moving traffic's lanes.
// A car is placed only where every check holds: on its own road's drawn carriageway, clear of junctions, stair and
// plaza mouths, footways, arrivals, the reserved lot by the Cataño ferry terminal and the roads beside it, every solid,
// tree, closed or private ground, raised floors and the sea; a moderate grade. Seeded: the same city every run.
import { DRIVE_KINDS, PARK, parkingSide, parkedOffset, isOneWay, flowSign } from './sj-street-sides.js';
import { VEHICLE_TYPES, VEHICLE_TYPE_INDEX, FLEET, LIVERIES, PAINTS, BODY_SECTIONS, pickWeighted } from './sj-vehicle-types.js';
import { GROUND_AREAS } from './sj-streets-data.js';

/** Parked cars are part of the city unless the page asks for ?parked=0 (comparisons). */
export const parkingEnabled = () => !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('parked') === '0');

export const PARKING = Object.freeze({
  stride: 10,              // record: x, y, z, heading, pitch, roll, type, livery, paint, seed
  bumper: [0.5, 1.4],      // m between bumpers inside a group
  groupGap: [4.5, 15],     // m between groups
  group: [2, 5],           // cars per group
  emptyBlock: 0.28,        // share of runs between junctions left empty
  footClear: 6,            // m from a node shared with a footway, pedestrian way or cycleway
  stairClear: 9,           // m from a stair or pedestrian-area end
  arrivalClear: 20,        // m round the road point a rider is placed on at a map arrival
  placeClear: 12,          // m round the arrival's own point
  solidMargin: 0.25,       // m kept between a parked car and any solid
  laneClear: 2.3,          // m of carriageway beside a kerb car free of any solid across the street (a lane sweeps
                           // 2.0 m and slides off façades into this room), 0.25–2.0 m above the road
  treeClear: 1.1,          // m between a car and a tree trunk
  maxGrade: 0.25,          // along the car
  maxCross: 0.12,          // across the car
  maxWheelGap: 0.05,       // m: a wheel off the ground (or into it) by more than this on twisted ground
  lotShare: 0.55,          // share of a lot's bays filled
});

// The reserved lot by the Cataño ferry terminal (owner): both outlines stay empty, and nothing parks on the through
// roads beside it.
export const RESERVE = Object.freeze({
  point: [496.1, 178.3],
  radius: 45,
  rings: [
    [[517.77, 162.75], [500.85, 108.14], [535.56, 98.4], [551.26, 153.33]],
    [[488, 162], [495, 153], [491, 126], [493, 119], [505, 158], [507, 164], [493, 168]],
  ],
  roads: [1388699368, 1388699366, 22227527, 143318965, 22224648, 1388699367],
});
// Open lots that may hold a partial fill (mapped parking areas with a public entrance; garages, terminals and private
// grounds excluded). Bays run along the lot's longest edge.
export const LOTS = Object.freeze([59744982, 256258082, 458529524]);
const LOT_CAP = { 59744982: 64, 256258082: 30, 458529524: 14 };
// Roads (index in city.roads) whose photographs show a long broken line: Calle de San Sebastián 259147610 (Wikimedia
// Commons "Calle San Sebastian 2021-08-09", viewed only; research pack 10).
const LONG_ROWS = new Set([207]);

const factsOf = (facts) => () => structuredClone(facts);

function rngOf(seed) {
  let a = (seed | 0) ^ 0x5bd1e995;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (u, [a, b]) => a + (b - a) * u;

function inRing(x, z, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0] ?? r[i].x, zi = r[i][1] ?? r[i].z, xj = r[j][0] ?? r[j].x, zj = r[j][1] ?? r[j].z;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
const px = (p) => p[0] ?? p.x, pz = (p) => p[1] ?? p.z;
function segmentsCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const d = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / d, u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
/** Do the rectangle `rect` (4 corners [x, z]) and the ring `ring` overlap? */
export function rectRingOverlap(rect, ring) {
  for (const [x, z] of rect) if (inRing(x, z, ring)) return true;
  for (const p of ring) if (inRing(px(p), pz(p), rect)) return true;
  for (let i = 0; i < 4; i++) {
    const a = rect[i], b = rect[(i + 1) % 4];
    for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) {
      if (segmentsCross(a[0], a[1], b[0], b[1], px(ring[k]), pz(ring[k]), px(ring[j]), pz(ring[j]))) return true;
    }
  }
  return false;
}
function pointRectDistance(x, z, cx, cz, hx, hz, s, c) {
  const dx = x - cx, dz = z - cz;
  const u = Math.abs(dx * c - dz * s) - hx, v = Math.abs(dx * s + dz * c) - hz;   // u across, v along
  return Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0);
}
function segmentDistance(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0;
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
/** Footprint corners of a car centred at (x, z) facing `heading`: rear-left, front-left, front-right, rear-right. */
export function footprint(x, z, heading, length, width, grow = 0) {
  const s = Math.sin(heading), c = Math.cos(heading), hl = length / 2 + grow, hw = width / 2 + grow;
  // forward (s, c); model +x (left of travel) (c, −s)
  return [[x - s * hl + c * hw, z - c * hl - s * hw], [x + s * hl + c * hw, z + c * hl - s * hw],
    [x + s * hl - c * hw, z + c * hl + s * hw], [x - s * hl - c * hw, z - c * hl + s * hw]];
}

// Uniform grid over item bounding boxes (construction only).
function gridIndex(cell = 16) {
  const m = new Map();
  let stamp = 0;
  return {
    add(item, x0, x1, z0, z1) {
      item._q = 0;
      for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        const k = i * 100003 + j;
        let l = m.get(k);
        if (!l) m.set(k, l = []);
        l.push(item);
      }
    },
    query(x0, x1, z0, z1, out) {
      out.length = 0;
      const q = ++stamp;
      for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        const l = m.get(i * 100003 + j);
        if (l) for (const it of l) if (it._q !== q) { it._q = q; out.push(it); }
      }
      return out;
    },
  };
}

function ringOfCollider(c) {
  const poly = c.outer ?? c.polygon ?? c.poly;
  if (poly?.length >= 3) return { ring: poly, minY: c.minY ?? 0, maxY: c.maxY ?? c.roof ?? 0 };
  if (c.centre && c.halfExtents) {
    const r = c.rotationY ?? 0, s = Math.sin(r), k = Math.cos(r), hx = c.halfExtents.x, hz = c.halfExtents.z, x = c.centre.x, z = c.centre.z;
    // three.js rotation about +Y: local x → (cos, −sin), local z → (sin, cos)
    const ring = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([u, v]) => [x + u * k + v * s, z - u * s + v * k]);
    return { ring, minY: c.centre.y - c.halfExtents.y, maxY: c.centre.y + c.halfExtents.y };
  }
  if (c.obb) {
    const o = c.obb, ring = [[-o.hx, -o.hz], [o.hx, -o.hz], [o.hx, o.hz], [-o.hx, o.hz]].map(([u, v]) => [o.cx + u * o.cs - v * o.sn, o.cz + u * o.sn + v * o.cs]);
    return { ring, minY: c.minY ?? 0, maxY: c.maxY ?? 0 };
  }
  if ([c.minX, c.maxX, c.minZ, c.maxZ].every(Number.isFinite)) {
    return { ring: [[c.minX, c.minZ], [c.maxX, c.minZ], [c.maxX, c.maxZ], [c.minX, c.maxZ]], minY: c.minY ?? 0, maxY: c.maxY ?? 0 };
  }
  return null;
}

/**
 * @param {object} a
 *   city, height, isDry       the mapped city and its ground
 *   solids                    every collider registered so far (buildings, area and plaza solids, soft foliage too)
 *   tops                      raised floors (bores, bridges, wall walks): no car stands on one
 *   offLimits                 [(x, z, y) => bool] closed and private ground
 *   places                    map arrivals [{x, z}]
 *   trees                     tree and palm positions ([x, z] or {x, z})
 *   paved                     the streets layout's drawn pieces (carriageway check)
 */
export function createParkingLayout({ city, height, isDry, solids = [], tops = [], offLimits = [], places = [], trees = [], paved = [] }) {
  const started = Date.now();
  const roads = city.roads;
  const reject = { curve: 0, across: 0, twist: 0, carriage: 0, solid: 0, tree: 0, closed: 0, top: 0, sea: 0, grade: 0, arrival: 0, reserve: 0, foot: 0 };

  // ---- indexes ----------------------------------------------------------------------------------------------------
  const solidIndex = gridIndex(16);
  for (const c of solids) {
    const r = ringOfCollider(c);
    if (!r || !(r.maxY > r.minY)) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of r.ring) { x0 = Math.min(x0, px(p)); x1 = Math.max(x1, px(p)); z0 = Math.min(z0, pz(p)); z1 = Math.max(z1, pz(p)); }
    if (x1 - x0 > 400 || z1 - z0 > 400) { r.big = true; }
    solidIndex.add({ ...r, x0, x1, z0, z1 }, x0, x1, z0, z1);
  }
  const topIndex = gridIndex(16);
  for (const t of tops) {
    if (!t.poly?.length) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of t.poly) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    topIndex.add({ t, x0, x1, z0, z1 }, x0, x1, z0, z1);
  }
  const treeIndex = gridIndex(8);
  for (const t of trees) { const x = px(t), z = pz(t); if (Number.isFinite(x) && Number.isFinite(z)) treeIndex.add({ x, z }, x, x, z, z); }
  const pieceIndex = gridIndex(16);
  for (const p of paved) {
    if (!p.ring?.length) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of p.ring) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    pieceIndex.add({ p, x0, x1, z0, z1 }, x0, x1, z0, z1);
  }
  // Road nodes: a vertex another road also passes through (1 m). Drive junctions clear PARK.junctionClear; nodes shared
  // only with footways and cycleways clear footClear; stair and pedestrian-area ends clear stairClear.
  const nodeIndex = gridIndex(8), nodes = [];
  roads.forEach((r, i) => r.points.forEach(([x, z], k) => { const n = { x, z, road: i, end: k === 0 || k === r.points.length - 1 }; nodes.push(n); nodeIndex.add(n, x, x, z, z); }));
  const near = [];
  const clearOf = (i) => {
    const out = [];
    roads[i].points.forEach(([x, z], k) => {
      let radius = 0;
      for (const n of nodeIndex.query(x - 1, x + 1, z - 1, z + 1, near)) {
        if (n.road === i || Math.hypot(n.x - x, n.z - z) > 1) continue;
        const kind = roads[n.road].kind;
        radius = Math.max(radius, DRIVE_KINDS.has(kind) ? PARK.junctionClear : kind === 'steps' || (kind === 'pedestrian' && n.end) ? PARK.stairClear : PARKING.footClear);
      }
      if ((k === 0 || k === roads[i].points.length - 1)) radius = Math.max(radius, PARK.junctionClear);
      if (radius) out.push({ x, z, radius });
    });
    return out;
  };
  // Walk ways (footway, pedestrian, steps, cycleway): no car over their ribbon; stair and pedestrian-area ends kept open.
  const walkIndex = gridIndex(16);
  roads.forEach((r, i) => {
    if (DRIVE_KINDS.has(r.kind)) return;
    for (let k = 1; k < r.points.length; k++) {
      const a = r.points[k - 1], b = r.points[k], w = r.width / 2 + 0.3;
      walkIndex.add({ a, b, w, i }, Math.min(a[0], b[0]) - w, Math.max(a[0], b[0]) + w, Math.min(a[1], b[1]) - w, Math.max(a[1], b[1]) + w);
    }
    if (r.kind === 'steps' || r.kind === 'pedestrian') for (const p of [r.points[0], r.points.at(-1)]) {
      const it = { a: p, b: p, w: PARKING.stairClear, i };
      walkIndex.add(it, p[0] - it.w, p[0] + it.w, p[1] - it.w, p[1] + it.w);
    }
  });
  // Arrivals: the road point a rider is placed on (as the host chooses it: the nearest road segments within 35 m).
  const arrivalPoints = [];
  for (const p of places) {
    arrivalPoints.push([p.x, p.z, PARKING.placeClear]);
    const segs = [];
    for (const r of roads) if (r.kind !== 'steps') for (let k = 1; k < r.points.length; k++) {
      const a = r.points[k - 1], b = r.points[k], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if (l < 8) continue;
      const f = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (l * l)));
      const x = a[0] + dx * f, z = a[1] + dz * f, d = Math.hypot(x - p.x, z - p.z);
      if (d <= 35) segs.push([d, x, z]);
    }
    segs.sort((a, b) => a[0] - b[0]);
    for (const s of segs.slice(0, 3)) arrivalPoints.push([s[1], s[2], PARKING.arrivalClear]);
  }
  const reserveRoads = new Set(RESERVE.roads);

  // ---- one car ----------------------------------------------------------------------------------------------------
  const scratch = [], rect = [];
  const groundAt = (x, z) => height(x, z);
  /** Checks shared by kerb rows and lots; `road` (index) is the carriageway the car must stand on, or null in a lot. */
  const no = (reason) => { reject[reason]++; return null; };
  function place(x, z, heading, t, road, lotId, across = null) {
    const s = Math.sin(heading), c = Math.cos(heading);
    const corners = footprint(x, z, heading, t.length, t.width);
    const grown = footprint(x, z, heading, t.length, t.width, PARKING.solidMargin);
    for (let k = 0; k < 4; k++) rect[k] = grown[k];
    // Sea, closed ground, reserve
    const probes = [[x, z], ...corners];
    for (const [qx, qz] of probes) if (!isDry(qx, qz)) return no('sea', road);
    for (const [qx, qz] of probes) { const y = groundAt(qx, qz); for (const f of offLimits) if (f(qx, qz, y)) return no('closed', road); }
    if (Math.hypot(x - RESERVE.point[0], z - RESERVE.point[1]) < RESERVE.radius) return no('reserve', road);
    const wide = footprint(x, z, heading, t.length, t.width, 3);
    for (const ring of RESERVE.rings) if (rectRingOverlap(wide, ring)) return no('reserve', road);
    for (const [ax, az, r] of arrivalPoints) if (Math.hypot(x - ax, z - az) < r) return no('arrival', road);
    // Grade: wheel contact heights
    const ax = t.axle, tr = t.track, ox = s * t.axleOffset, oz = c * t.axleOffset;
    const h = (u, v) => groundAt(x + ox + s * v + c * u, z + oz + c * v - s * u);   // u: left (+) / right, v: forward
    const fl = h(tr, ax), fr = h(-tr, ax), rl = h(tr, -ax), rr = h(-tr, -ax);
    const pitch = Math.atan2((fl + fr - rl - rr) / 2, 2 * ax), roll = Math.atan2((fl + rl - fr - rr) / 2, 2 * tr);
    if (Math.abs(Math.tan(pitch)) > PARKING.maxGrade) return no('grade', road);
    if (Math.abs(Math.tan(roll)) > PARKING.maxCross) return no('grade', road);
    // A rigid car on twisted ground: each wheel stands |twist|/4 off the best plane through the four contacts.
    if (Math.abs(fl - fr - rl + rr) / 4 > PARKING.maxWheelGap) return no('twist', road);
    const y = (fl + fr + rl + rr) / 4;
    const lo = Math.min(fl, fr, rl, rr), hi = Math.max(fl, fr, rl, rr);
    // Raised floors
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [qx, qz] of rect) { x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); z0 = Math.min(z0, qz); z1 = Math.max(z1, qz); }
    for (const it of topIndex.query(x0, x1, z0, z1, scratch)) {
      if (it.x1 < x0 || it.x0 > x1 || it.z1 < z0 || it.z0 > z1) continue;
      if (rectRingOverlap(corners, it.t.poly)) return no('top', road);
    }
    // Solids (any height range meeting the car's) and trees
    for (const it of solidIndex.query(x0, x1, z0, z1, scratch)) {
      if (it.x1 < x0 || it.x0 > x1 || it.z1 < z0 || it.z0 > z1) continue;
      if (it.maxY < lo - 0.3 || it.minY > hi + t.height) continue;
      if (rectRingOverlap(rect, it.ring)) return no('solid', road);
    }
    // Room for the moving lane beside the car, measured across the street to the nearest solid.
    if (across) {
      const [ux, uz] = across, w0 = t.width / 2 + 0.05;
      for (const v of [-t.length / 2 - 0.6, -t.length / 4, 0, t.length / 4, t.length / 2 + 0.6]) {
        for (let d = w0; d <= w0 + PARKING.laneClear + 1e-6; d += 0.15) {
          const qx = x + s * v + ux * d, qz = z + c * v + uz * d, gy = groundAt(qx, qz);
          for (const it of solidIndex.query(qx, qx, qz, qz, scratch)) {
            if (it.maxY < gy + 0.25 || it.minY > gy + 2) continue;
            if (inRing(qx, qz, it.ring)) return no('across', road);
          }
        }
      }
    }
    for (const it of treeIndex.query(x0 - 2, x1 + 2, z0 - 2, z1 + 2, scratch)) {
      if (pointRectDistance(it.x, it.z, x, z, t.width / 2, t.length / 2, s, c) < PARKING.treeClear) return no('tree', road);
    }
    // Footways, stairs and pedestrian-area mouths
    for (const it of walkIndex.query(x0, x1, z0, z1, scratch)) {
      // A footway running along the street is its sidewalk (the carriageway check below keeps the car off it); only
      // ways crossing the car's line, and stair and pedestrian-area ends, count here.
      if (it.a !== it.b) {
        const dx = it.b[0] - it.a[0], dz = it.b[1] - it.a[1], l = Math.hypot(dx, dz) || 1;
        if (Math.abs((dx * s + dz * c) / l) > 0.9) continue;
      }
      for (const [qx, qz] of [[x, z], ...corners]) if (segmentDistance(qx, qz, it.a[0], it.a[1], it.b[0], it.b[1]) < it.w) return no('foot', road);
      if (pointRectDistance(it.a[0], it.a[1], x, z, t.width / 2, t.length / 2, s, c) < it.w * 0.999 && it.a === it.b) return no('foot', road);
    }
    // Drawn surface: on a kerb row every probe stands on its own road's carriageway piece and on no sidewalk, plaza or
    // other paving; in a lot, on the lot's own parking pieces.
    const id = road === null ? null : roads[road].id;
    for (const [qx, qz] of probes) {
      let own = false;
      for (const it of pieceIndex.query(qx, qx, qz, qz, scratch)) {
        if (it.x1 < qx || it.x0 > qx || it.z1 < qz || it.z0 > qz || !inRing(qx, qz, it.p.ring)) continue;
        const p = it.p;
        if (road !== null) {
          // Its own carriageway pieces, the gutter strips inside the kerb included (margin pieces of the same road).
          if (p.road === id && (p.kind === 'asphalt' || p.kind === 'sett')) own = true;
          else return no('carriage', road);
        } else {
          if (p.kind === 'parking' && p.area === lotId) own = true;
          else return no('carriage', road);
        }
      }
      if (!own) return no('carriage', road);
    }
    return { x, y, z, heading, pitch, roll, lo, hi };
  }

  const cars = [];
  const colliders = [];
  const typeTable = FLEET.filter((f) => f.parked > 0);
  // A parked car's solids: one upright prism per body section (bonnet, windscreen steps, cabin, rear or bed), its
  // top following the car's grade and cross-slope, its foot below the lowest ground under it.
  function addCar(p, t, typeIndex, livery, paintIndex, seed, road, s) {
    cars.push({ ...p, type: typeIndex, livery, paint: paintIndex, seed, road, s });
    const sn = Math.sin(p.heading), cs = Math.cos(p.heading), sp = Math.sin(p.pitch), cp = Math.cos(p.pitch), sr = Math.abs(Math.sin(p.roll));
    // a flat-topped prism on a grade stands proud at its low end: pieces short enough for at most 5 cm
    const piece = Math.max(0.25, 0.05 / Math.max(Math.abs(sp), 1e-3));
    for (const [a0, a1, hw, top] of BODY_SECTIONS[t.id]) for (let n = Math.ceil((a1 - a0) / piece - 1e-6), k = 0; k < n; k++) {
      const z0 = a0 + (a1 - a0) * k / n, z1 = a0 + (a1 - a0) * (k + 1) / n;
      const outer = [[-hw, z0], [-hw, z1], [hw, z1], [hw, z0]].map(([u, v]) => ({ x: p.x + sn * v + cs * u, z: p.z + cs * v - sn * u }));
      let ground = Infinity;
      for (const q of outer) ground = Math.min(ground, groundAt(q.x, q.z));
      colliders.push({ outer, holes: [], minY: Math.min(ground, p.y) - 0.15, maxY: p.y + Math.max(z0 * sp, z1 * sp) + top * cp + hw * sr,
        surface: 'pavement', support: false, parkedCar: true });
    }
  }
  function pickType(u, v, w, roadWidth) {
    const f = typeTable[pickWeighted(typeTable, 'parked', u)];
    let typeIndex = VEHICLE_TYPE_INDEX[f.type];
    if (VEHICLE_TYPES[typeIndex].width > roadWidth / 2.4) typeIndex = VEHICLE_TYPE_INDEX.hatch;
    const livery = LIVERIES.indexOf(f.livery);
    const paintIndex = pickWeighted(PAINTS, 'weight', v);
    return { typeIndex, livery, paintIndex, seed: Math.floor(w * 1e6) };
  }

  // ---- kerb rows --------------------------------------------------------------------------------------------------
  roads.forEach((road, i) => {
    if (!DRIVE_KINDS.has(road.kind) || reserveRoads.has(road.id)) return;
    const side = parkingSide(road, i);
    if (!side) return;
    const rng = rngOf(i * 7919 + 17);
    const pts = road.points, cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const L = cum.at(-1);
    const at = (s, out) => {
      let k = 1;
      while (k < pts.length - 1 && cum[k] < s) k++;
      const a = pts[k - 1], b = pts[k], l = cum[k] - cum[k - 1] || 1, f = Math.max(0, Math.min(1, (s - cum[k - 1]) / l));
      out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f;
      return out;
    };
    // Clear intervals in arc length round the nodes of this road (and the nodes of others lying on it).
    const blocked = clearOf(i).map((n) => {
      let best = 0, bd = Infinity;
      for (let k = 0; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - n.x, pts[k][1] - n.z); if (d < bd) { bd = d; best = k; } }
      return [cum[best] - n.radius, cum[best] + n.radius];
    }).sort((a, b) => a[0] - b[0]);
    const runs = [];
    let from = 0;
    for (const [a, b] of blocked) { if (a > from) runs.push([from, a]); from = Math.max(from, b); }
    if (from < L) runs.push([from, L]);
    // Direction the parked cars face: the flow on a one-way street, the side's own direction on a two-way one.
    const along = isOneWay(road) ? flowSign(road) : side;
    const A = [0, 0], B = [0, 0];
    const longest = Math.max(0, ...runs.map(([a, b]) => b - a));
    for (const [r0, r1] of runs) {
      if (r1 - r0 < 9) continue;
      // A street the photographs show with a long line gets one group of six to eight in its longest run.
      const long = LONG_ROWS.has(i) && r1 - r0 === longest;
      if (!long && rng() < PARKING.emptyBlock) continue;
      let s = r0 + rng() * 3, left = 0, carsInRun = 0, first = long, inLong = false;
      while (s < r1) {
        if (left <= 0) {
          if (carsInRun) s += between(rng(), PARKING.groupGap);
          left = Math.round(between(rng(), [PARKING.group[0] - 0.49, PARKING.group[1] + 0.49]));
          if (rng() < 0.12) left = 1;   // the odd lone car
          if (first) { left = Math.round(between(rng(), [5.51, 8.49])); first = false; inLong = true; } else inLong = false;
        }
        const look = pickType(rng(), rng(), rng(), road.width);
        const t = VEHICLE_TYPES[look.typeIndex];
        const s0 = s, s1 = s + t.length;
        if (s1 > r1) break;
        at(s0, A); at(s1, B);
        const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1;
        const off = parkedOffset(road, i, t.width);
        // right-hand normal of the point order (−dz, dx)
        const cx = (A[0] + B[0]) / 2 + (-dz / l) * off, cz = (A[1] + B[1]) / 2 + (dx / l) * off;
        let heading = Math.atan2(dx, dz);
        if (along < 0) heading += Math.PI;
        // The car's outer flank stays inside the kerb on a curve: distance from the polyline at every corner
        let inside = true;
        for (const [qx, qz] of footprint(cx, cz, heading, t.length, t.width)) {
          let d = Infinity;
          for (let k = 1; k < pts.length; k++) d = Math.min(d, segmentDistance(qx, qz, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]));
          if (d > road.width / 2 - 0.12) { inside = false; break; }
        }
        const p = inside ? place(cx, cz, heading, t, i, null, [Math.sign(off) * dz / l, -Math.sign(off) * dx / l]) : no('curve', i);
        if (p) { addCar(p, t, look.typeIndex, look.livery, look.paintIndex, look.seed, i, s0); carsInRun++; left--; s = s1 + between(rng(), PARKING.bumper); }
        else if (inLong && carsInRun === 0) s += 1;   // the long line starts where the kerb allows
        else { left = 0; s = s1 + 2; }
      }
    }
  });

  // ---- lots -------------------------------------------------------------------------------------------------------
  const lotCount = {}, lines = [], edges = new Set();
  for (const id of LOTS) {
    const area = GROUND_AREAS.find((g) => g.id === id);
    if (!area) continue;
    const ring = area.ring, rng = rngOf(id % 100000);
    let best = 0, ux = 1, uz = 0;
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > best) { best = l; ux = (b[0] - a[0]) / l; uz = (b[1] - a[1]) / l; }
    }
    const nx = -uz, nz = ux;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of ring) { const u = x * ux + z * uz, v = x * nx + z * nz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    // Double rows of 2.6 m × 5.5 m bays back to back, then a 6.5 m running aisle. Every bay that passes the checks is a
    // candidate; runs of one to six neighbouring bays are filled until the lot's share is reached.
    const bayW = 2.6, bayD = 5.5, aisle = 6.5, bays = [];
    for (let v = v0 + 1; v + bayD < v1; v += 2 * bayD + aisle) {
      for (const row of [0, 1]) {
        const vc = v + bayD * (row + 0.5);
        for (let u = u0 + 1 + bayW / 2; u < u1 - 1; u += bayW) {
          const x = u * ux + vc * nx, z = u * uz + vc * nz;
          const look = pickType(rng(), rng(), rng(), 99);
          const t = VEHICLE_TYPES[look.typeIndex];
          if (t.length > bayD - 0.3) continue;
          // Nose in: facing out of the double row toward its aisle; some backed in
          const heading = Math.atan2(row ? nx : -nx, row ? nz : -nz) + (rng() < 0.2 ? Math.PI : 0);
          const p = place(x, z, heading, t, null, id);
          if (!p) continue;
          bays.push({ p, t, look });
          // painted bay edges on verified hardstand (each edge once)
          for (const e of [-0.5, 0.5]) {
            const key = `${row}:${Math.round((u + e * bayW) * 10)}:${Math.round(v * 10)}`;
            if (edges.has(key)) continue;
            edges.add(key);
            const lx = (u + e * bayW) * ux + vc * nx, lz = (u + e * bayW) * uz + vc * nz, h = Math.atan2(nx, nz), half = bayD / 2 - 0.25;
            const y0 = height(lx - nx * half, lz - nz * half), y1 = height(lx + nx * half, lz + nz * half);
            if (Math.abs(height(lx, lz) - (y0 + y1) / 2) > 0.05) continue;   // a straight line cannot follow a hump
            lines.push(lx, (y0 + y1) / 2, lz, h, Math.atan2(y1 - y0, 2 * half), 2 * half);
          }
        }
      }
    }
    const cap = LOT_CAP[id] ?? 20, share = Math.min(PARKING.lotShare, cap / Math.max(1, bays.length));
    lotCount[id] = 0;
    for (let k = 0; k < bays.length && lotCount[id] < cap;) {
      const run = 1 + Math.floor(rng() * 6);
      if (rng() < share) {
        for (let j = 0; j < run && k < bays.length && lotCount[id] < cap; j++, k++) {
          const { p, t, look } = bays[k];
          addCar(p, t, look.typeIndex, look.livery, look.paintIndex, look.seed, -1, id); lotCount[id]++;
        }
      } else k += run;
    }
  }

  const records = new Float32Array(cars.length * PARKING.stride);
  cars.forEach((c, k) => records.set([c.x, c.y, c.z, c.heading, c.pitch, c.roll, c.type, c.livery, c.paint, c.seed], k * PARKING.stride));
  return {
    cars: { count: cars.length, stride: PARKING.stride, records },
    // bay paint on the lots: x, y, z, heading, pitch, length per line
    lines: { count: lines.length / 6, stride: 6, records: Float32Array.from(lines) },
    colliders,
    list: cars,
    // A closure made here would keep this scope's construction indexes alive (one shared context): module-level helper.
    qa: factsOf({ cars: cars.length, kerb: cars.filter((c) => c.road >= 0).length, lots: lotCount, reject: { ...reject }, ms: Date.now() - started }),
  };
}
