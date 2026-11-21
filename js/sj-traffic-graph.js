/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The lane graph of the moving traffic, built once at boot from the mapped roads and checked against the built world.
//
//   roads (city.roads, car kinds)  →  split at every shared vertex (1 mm keys)  →  links between junctions
//   links  →  lanes (js/sj-street-sides.js laneOffsets: offset right of the centre line, away from the parked row)
//   lanes  →  trimmed back from each junction, joined across it by connectors (cubic curves, no U-turns)
//   every lane and connector  →  swept with the widest vehicle against the world: solids (sampler.isVolumeClear on the
//     selected support layer), water, closed and private ground, stairs, grade and the reserved lot; what fails goes
//   what is left  →  its largest strongly connected component, so every car can always go on
//
// Output: paths (lanes then connectors) as typed arrays of samples about a metre apart (x, z, ground y, tangent, roll,
// bend speed), the connections between them, per-junction control and conflict masks, spawn slots, and statistics.
// A road is identified by its index in city.roads; js/sj-traffic-data.js carries the decisions the map cannot.
import { NO_CARS, speedClass, RANK, CLASS_TIER, NAME_TIER, ZONES, TIER_WEIGHT, RESERVED, ROUTE_WEIGHT } from './sj-traffic-data.js';
import { stairFlightRecords } from './sj-stairs.js';
import { VEHICLE_TYPES } from './sj-vehicle-types.js';

// The bodies a lane or turn must hold, posed on their wheelbase (the longest wheelbase and the largest offset of it in
// the group), the widest and tallest of the group, with a little air at the flanks (FLANK) and the ends (END).
// Every lane holds the ordinary cars; the long ones (pickups, vans, the cargo van) keep to what holds them too.
const FLANK = 0.02, END = 0.12;
export const LONG_VEHICLE = 4.8; // m: a vehicle this long or longer drives only where the long body fits
function bodyOf(types) {
  return Object.freeze({
    half: Math.max(...types.map((t) => t.length)) / 2 + END,
    halfWidth: Math.max(...types.map((t) => t.width)) / 2 + FLANK,
    axle: Math.max(...types.map((t) => t.axle)),
    offset: Math.max(...types.map((t) => t.axleOffset)),
    height: Math.max(...types.map((t) => t.height)) + 0.05,
  });
}
export const SWEPT = Object.freeze({
  short: bodyOf(VEHICLE_TYPES.filter((t) => t.length < LONG_VEHICLE)),
  long: bodyOf(VEHICLE_TYPES),
  track: Math.max(...VEHICLE_TYPES.map((t) => t.track)),
});

const KERB_TRACKS = [Math.max(...VEHICLE_TYPES.map((t) => t.track)), Math.min(...VEHICLE_TYPES.map((t) => t.track))];
export const GRAPH = Object.freeze({
  step: 1,             // m between path samples
  sweepHalfWidth: 1.0, // m: half the corridor two paths keep between them (overlap pass, junction stop lines)
  sweepFloor: 0.25,    // m above the road a solid must reach to block a car
  maxGrade: 0.25,
  minRadius: 3.2,      // m: tighter turns are not offered
  maxTurn: 2.6,        // rad: sharper turns (hairpins) are not offered
  conflictGap: 2.5,    // m between two connectors' centre lines below which they cannot be used together
  aLat: 1.3,           // m/s²: sideways acceleration drivers accept in bends (sets the corner crawl)
  slotSpacing: 9,      // m between spawn slots along a lane
  sweepStride: 3,      // lane samples (metres) between swept bodies
  kerb: 0.1,           // m: a step under a tyre that a lane or a turn does not take
  seat: 0.08,          // m: the most a tyre may stand off (or sink into) the ground with the body fitted to its four contacts
  maxRoll: 0.3,        // rise per metre across the car the pose follows (js/sj-traffic.js locate uses the same)
  // a turn's curve (control-arm length, metres straight on first), tried in order until a body fits
  turnShapes: [[0.42, 0], [0.3, 0], [0.55, 0], [0.2, 0], [0.68, 0], [0.42, 1.5], [0.3, 1.5], [0.42, 3], [0.3, 3]],
  mergeJunctions: 22,  // m: junctions joined by a shorter link than this (or than their setbacks and a car) work as one
  mergeRadius: 14,     // m: largest distance of a merged junction's members from its centre
  overlap: 2.1,        // m between the centre lines of two unrelated paths below which they cannot both be used
  nudgeSlope: 0.15,    // m of sideways slide per metre along a lane
});
const CLASSES = ['service', 'grid', 'spine', 'avenue'];

const key = (x, z) => `${x.toFixed(3)},${z.toFixed(3)}`;

function inPolygon(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
const RESERVED_BOX = RESERVED.map((p) => [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0])),
  Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[1]))]);
function reserved(x, z, pad = 2.5) {
  for (let i = 0; i < RESERVED.length; i++) {
    const p = RESERVED[i], b = RESERVED_BOX[i];
    if (x < b[0] - pad || x > b[1] + pad || z < b[2] - pad || z > b[3] + pad) continue;
    if (inPolygon(p, x, z) || inPolygon(p, x + pad, z) || inPolygon(p, x - pad, z) || inPolygon(p, x, z + pad) || inPolygon(p, x, z - pad)) return true;
  }
  return false;
}

// Offset a polyline `offset` metres to the right of its point order (right normal of (dx, dz) is (−dz, dx)).
function offsetLine(points, offset) {
  if (!offset) return points.map((p) => [p[0], p[1]]);
  const n = points.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[Math.min(n - 1, i + 1)];
    let nx = 0, nz = 0;
    if (i > 0) { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; nx += -dz / l; nz += dx / l; }
    if (i < n - 1) { const dx = c[0] - b[0], dz = c[1] - b[1], l = Math.hypot(dx, dz) || 1; nx += -dz / l; nz += dx / l; }
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    // mitre: keep the offset distance from both neighbouring segments, within reason
    let scale = 1;
    if (i > 0 && i < n - 1) {
      const dx = b[0] - a[0], dz = b[1] - a[1], ls = Math.hypot(dx, dz) || 1;
      scale = Math.min(2, 1 / Math.max(0.5, nx * (-dz / ls) + nz * (dx / ls)));
    }
    out.push([b[0] + nx * offset * scale, b[1] + nz * offset * scale]);
  }
  return out;
}
function lineLength(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; }
// Cut `a` metres off the start and `b` off the end of a polyline.
function trimLine(p, a, b) {
  const total = lineLength(p);
  const s0 = Math.min(a, total), s1 = Math.max(s0 + 1e-3, total - b);
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const at = (s) => {
    let i = 0;
    while (i < p.length - 2 && cum[i + 1] < s) i++;
    const l = cum[i + 1] - cum[i] || 1, t = Math.max(0, Math.min(1, (s - cum[i]) / l));
    return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t];
  };
  const out = [at(s0)];
  for (let i = 1; i < p.length - 1; i++) if (cum[i] > s0 + 0.05 && cum[i] < s1 - 0.05) out.push([p[i][0], p[i][1]]);
  out.push(at(s1));
  return out;
}
// Points every `step` metres or less along a polyline (first and last kept).
function resample(p, step) {
  const total = lineLength(p), n = Math.max(2, Math.ceil(total / step) + 1), out = [];
  let i = 0, s = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (i < p.length - 2 && s + Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) < target) {
      s += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); i++;
    }
    const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) || 1, t = Math.max(0, Math.min(1, (target - s) / l));
    out.push([p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t]);
  }
  return { points: out, length: total };
}
// A turn's curve; `run` metres straight on at each end first (a driver going deeper into the junction before turning).
function bezier(p0, t0, p3, t3, shape = 0.42, run = 0) {
  if (run > 0) {
    const a = [p0[0] + t0[0] * run, p0[1] + t0[1] * run], b = [p3[0] - t3[0] * run, p3[1] - t3[1] * run];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1.5) return null;
    return [p0, ...bezier(a, t0, b, t3, shape, 0), p3];
  }
  const d = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]), k = d * shape;
  const p1 = [p0[0] + t0[0] * k, p0[1] + t0[1] * k], p2 = [p3[0] - t3[0] * k, p3[1] - t3[1] * k];
  const n = Math.max(4, Math.ceil(d / 0.25)), out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}
const tangentAt = (p, end) => {
  const a = end ? p[p.length - 2] : p[0], b = end ? p[p.length - 1] : p[1];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};

function turnOf(a, b) {
  const ta = tangentAt(a.points, true), tb = tangentAt(b.points, false);
  return Math.abs(Math.atan2(ta[0] * tb[1] - ta[1] * tb[0], ta[0] * tb[0] + ta[1] * tb[1]));
}
// The largest (by length) strongly connected set of `items` under `next(item) → items` (Tarjan, iterative).
function largestComponent(items, next) {
  const ix = new Map(items.map((l, i) => [l, i]));
  const n = items.length, index = new Int32Array(n).fill(-1), low = new Int32Array(n), onStack = new Uint8Array(n), comp = new Int32Array(n);
  const outs = items.map((l) => next(l).map((t) => ix.get(t)).filter((i) => i !== undefined));
  let counter = 0, comps = 0;
  const stack = [], call = [];
  for (let root = 0; root < n; root++) {
    if (index[root] >= 0) continue;
    call.push([root, 0]);
    while (call.length) {
      const frame = call[call.length - 1], v = frame[0];
      if (frame[1] === 0) { index[v] = low[v] = counter++; stack.push(v); onStack[v] = 1; }
      let pushed = false;
      while (frame[1] < outs[v].length) {
        const w = outs[v][frame[1]++];
        if (index[w] < 0) { call.push([w, 0]); pushed = true; break; }
        if (onStack[w]) low[v] = Math.min(low[v], index[w]);
      }
      if (pushed) continue;
      if (frame[1] === outs[v].length) frame[1]++; // visited all: do not re-enter the push branch
      if (low[v] === index[v]) { let w; do { w = stack.pop(); onStack[w] = 0; comp[w] = comps; } while (w !== v); comps++; }
      call.pop();
      if (call.length) { const u = call[call.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
    }
  }
  const length = new Float64Array(comps);
  items.forEach((l, i) => { length[comp[i]] += l.len; });
  let best = 0;
  for (let i = 1; i < comps; i++) if (length[i] > length[best]) best = i;
  return new Set(items.filter((l, i) => comp[i] === best));
}

/**
 * Build the lane graph. `world` needs city.roads, sampler, height, isDry (and the optional worldedge closure);
 * `sides` is js/sj-street-sides.js.
 */
export function buildLaneGraph(world, sides, { debug = null } = {}) {
  const started = performance.now();
  const { city, sampler } = world;
  const limit = world.worldedge?.closure ? world.worldedge.closure.x - 3.5 : Infinity;
  const dropped = { roads: {}, lanes: {}, connectors: {} };
  const bump = (table, cause) => { table[cause] = (table[cause] ?? 0) + 1; };
  const flights = stairFlightRecords();
  let merged = 0;

  // ---- Roads, split at shared vertices
  const roads = [];
  city.roads.forEach((road, index) => {
    if (!sides.DRIVE_KINDS.has(road.kind)) return;
    const reason = NO_CARS.get(Number(road.id));
    if (reason) { bump(dropped.roads, reason); return; }
    // clip at the fenced east edge: nothing enters or leaves the map
    const cross = (a, b) => [limit, a[1] + ((b[1] - a[1]) * (limit - a[0])) / (b[0] - a[0])];
    let run = [], kept = false;
    const flush = () => { if (run.length >= 2) { roads.push({ road, index, points: run }); kept = true; } run = []; };
    for (let i = 0; i < road.points.length; i++) {
      const p = road.points[i], prev = road.points[i - 1];
      if (p[0] <= limit) { if (prev && prev[0] > limit) run.push(cross(prev, p)); run.push(p); }
      else if (prev && prev[0] <= limit) { run.push(cross(prev, p)); flush(); }
    }
    flush();
    if (!kept) bump(dropped.roads, 'outside');
  });
  const nodes = new Map(); // key → {x, z, neighbours:Set, roads:Set}
  const nodeOf = (p) => {
    const k = key(p[0], p[1]);
    let n = nodes.get(k);
    if (!n) nodes.set(k, n = { k, x: p[0], z: p[1], neighbours: new Set(), roads: new Set(), id: -1, junction: false, width: 0 });
    return n;
  };
  for (const r of roads) {
    const pts = [];
    for (const p of r.points) if (!pts.length || key(p[0], p[1]) !== key(...pts[pts.length - 1])) pts.push(p);
    r.points = pts;
    for (let i = 0; i < pts.length; i++) {
      const n = nodeOf(pts[i]);
      n.roads.add(r);
      n.width = Math.max(n.width, r.road.width);
      if (i > 0) { const m = nodeOf(pts[i - 1]); n.neighbours.add(m.k); m.neighbours.add(n.k); }
    }
  }
  // break nodes: junctions (degree ≠ 2) and every place one road record meets another
  const isBreak = (n) => n.neighbours.size !== 2 || n.roads.size > 1;
  for (const n of nodes.values()) n.junction = n.neighbours.size >= 3;

  // ---- Links (one road between two break nodes)
  let links = [];
  for (const r of roads) {
    let start = 0;
    for (let i = 1; i < r.points.length; i++) {
      if (i === r.points.length - 1 || isBreak(nodes.get(key(...r.points[i])))) {
        const pts = r.points.slice(start, i + 1);
        if (pts.length >= 2 && lineLength(pts) > 0.05) links.push({ r, points: pts, a: nodes.get(key(...pts[0])), b: nodes.get(key(...pts[pts.length - 1])) });
        start = i;
      }
    }
  }
  // Junctions too close to hold a car between them (staggered corners, doubled rows) work as one: merge them and drop
  // the stub between, as long as the merged junction stays compact.
  const parent = new Map(), members = new Map();
  const find = (n) => { while (parent.has(n) && parent.get(n) !== n) n = parent.get(n); return n; };
  const ownSetback = (n) => Math.max(3.5, Math.min(9, n.width / 2 + 1.5));
  for (const l of links) {
    if (!l.a.junction || !l.b.junction || l.a === l.b) continue;
    if (lineLength(l.points) >= Math.min(GRAPH.mergeJunctions, ownSetback(l.a) + ownSetback(l.b) + 5)) continue;
    const a = find(l.a), b = find(l.b);
    if (a !== b) {
      const all = [...(members.get(a) ?? [a]), ...(members.get(b) ?? [b])];
      const cx = all.reduce((t, n) => t + n.x, 0) / all.length, cz = all.reduce((t, n) => t + n.z, 0) / all.length;
      if (all.some((n) => Math.hypot(n.x - cx, n.z - cz) > GRAPH.mergeRadius)) continue;
      parent.set(b, a); members.set(a, all); members.delete(b);
    }
    l.internal = true;
  }
  const clusters = new Map();
  for (const n of nodes.values()) {
    const root = find(n);
    if (!clusters.has(root)) clusters.set(root, { x: 0, z: 0, members: [], width: 0, junction: false, id: -1, radius: 0 });
    const c = clusters.get(root);
    c.members.push(n); c.width = Math.max(c.width, n.width); c.junction ||= n.junction;
  }
  for (const c of clusters.values()) {
    for (const n of c.members) { c.x += n.x / c.members.length; c.z += n.z / c.members.length; }
    for (const n of c.members) c.radius = Math.max(c.radius, Math.hypot(n.x - c.x, n.z - c.z));
  }
  const clusterOf = (n) => clusters.get(find(n));
  links = links.filter((l) => !(l.internal && clusterOf(l.a) === clusterOf(l.b)));
  for (const l of links) { l.a = clusterOf(l.a); l.b = clusterOf(l.b); }
  merged = [...clusters.values()].filter((c) => c.members.length > 1).length;

  // Trim a lane so it ends `setback` metres (straight line) from its junction's centre, or a metre short of a plain
  // joint. Junctions measure from the centre so merged corners trim every arm alike.
  const setback = (c) => (c.junction ? Math.max(3.5, Math.min(9, c.width / 2 + 1.5)) + c.radius : 1.0);
  function trimTo(pts, c, fromEnd) {
    const p = fromEnd ? pts.slice().reverse() : pts;
    let cut = 0;
    if (!c.junction) cut = 1.0;
    else {
      const need = setback(c);
      let s = 0;
      cut = lineLength(p);
      for (let i = 1; i < p.length; i++) {
        const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        const d0 = Math.hypot(p[i - 1][0] - c.x, p[i - 1][1] - c.z), d1 = Math.hypot(p[i][0] - c.x, p[i][1] - c.z);
        if (d1 >= need) { cut = s + (d0 >= need ? 0 : l * Math.max(0, Math.min(1, (need - d0) / Math.max(1e-6, d1 - d0)))); break; }
        s += l;
      }
    }
    return cut;
  }

  // ---- Lanes
  const lanes = [];
  for (let li = 0; li < links.length; li++) {
    const link = links[li], road = link.r.road;
    const length = lineLength(link.points);
    let sa = trimTo(link.points, link.a, false), sb = trimTo(link.points, link.b, true);
    if (sa + sb > length - 1) { const k = Math.max(0, length - 1) / Math.max(1e-6, sa + sb); sa *= k; sb *= k; }
    const cls = speedClass(road);
    const made = [], offsets = sides.laneOffsets(road, link.r.index);
    const hw = GRAPH.sweepHalfWidth;
    for (const lane of offsets) {
      // lateral room in road coordinates (right of the point order): on the carriageway, off the far lane. The parked
      // row is no limit here: parked cars are solids of the built world, so a lane slides off them like off a wall,
      // and a row must leave a car's width free where the street narrows (see the parking rules).
      let lo = -road.width / 2 - 0.25 + hw, hi = road.width / 2 + 0.25 - hw;
      if (offsets.length === 2) { const mid = (offsets[0].offset + offsets[1].offset) / 2;
        if (lane.dir > 0) lo = Math.max(lo, mid + hw - 0.3); else hi = Math.min(hi, mid - hw + 0.3); }
      for (const dir of lane.dir === 0 ? [1, -1] : [lane.dir]) {
        let pts = offsetLine(link.points, lane.offset);
        if (dir < 0) pts = pts.slice().reverse();
        const from = dir > 0 ? link.a : link.b, to = dir > 0 ? link.b : link.a;
        pts = trimLine(pts, dir > 0 ? sa : sb, dir > 0 ? sb : sa);
        const { points, length: len } = resample(pts, GRAPH.step);
        // nudge range in lane coordinates (a lane against the point order has its right on the road's left)
        const nLo = dir > 0 ? lo - lane.offset : lane.offset - hi, nHi = dir > 0 ? hi - lane.offset : lane.offset - lo;
        const l = { kind: 0, link: li, road: link.r.index, roadRec: road, dir, shared: lane.dir === 0, from, to, points, len,
          cls, rank: RANK[cls], twin: -1, ok: true, cause: '', out: [], inn: [], nLo, nHi, nudged: 0 };
        made.push(l);
        lanes.push(l);
        debug?.push(l);
      }
    }
    if (made.length === 2 && made[0].shared) { made[0].twin = made[1]; made[1].twin = made[0]; }
  }

  // ---- Profiles and the sweep
  const probe = { normal: {} };
  const groundY = (x, z) => sampler.sampleGround(x, z, probe, world.height(x, z) + 0.35).height;
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: GRAPH.sweepHalfWidth, halfLengthMetres: 0.6, minY: 0, maxY: 0,
    floorPlane: { x: 0, y: 0, z: 0, dx: 0, dz: 0 }, floorY: 0 };
  function tangents(path) {
    const pts = path.points, n = pts.length;
    path.tx = new Float32Array(n); path.tz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      path.tx[i] = (b[0] - a[0]) / l; path.tz[i] = (b[1] - a[1]) / l;
    }
  }
  function profile(path) {
    const pts = path.points, n = pts.length;
    tangents(path);
    path.y = new Float64Array(n); path.roll = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [x, z] = pts[i], tx = path.tx[i], tz = path.tz[i];
      path.y[i] = groundY(x, z);
      // camber from the terrain, within 4.5°: left side up is a positive roll (left of (tx, tz) is (tz, −tx))
      const hl = world.height(x + tz * SWEPT.track, z - tx * SWEPT.track), hr = world.height(x - tz * SWEPT.track, z + tx * SWEPT.track);
      const roll = Math.atan((hl - hr) / (2 * SWEPT.track));
      path.roll[i] = Number.isFinite(roll) ? Math.max(-0.08, Math.min(0.08, roll)) : 0;

    }
  }
  // Is the widest vehicle clear at sample i, moved `nudge` metres to the right?
  // A point `s` metres along a path (straight on past its ends), moved `nudge` metres to the right.
  function along(path, s, nudge, out) {
    const pts = path.points, n = pts.length, step = path.len / Math.max(1, n - 1);
    let f = s / step, x, z, y, tx, tz;
    if (f <= 0) { tx = path.tx[0]; tz = path.tz[0]; x = pts[0][0] + tx * s; z = pts[0][1] + tz * s; y = path.y[0]; }
    else if (f >= n - 1) { const e = s - path.len; tx = path.tx[n - 1]; tz = path.tz[n - 1]; x = pts[n - 1][0] + tx * e; z = pts[n - 1][1] + tz * e; y = path.y[n - 1]; }
    else {
      const k = Math.floor(f), t = f - k;
      x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t; z = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t;
      y = path.y[k] + (path.y[k + 1] - path.y[k]) * t;
      tx = path.tx[t < 0.5 ? k : k + 1]; tz = path.tz[t < 0.5 ? k : k + 1];
    }
    out.x = x - tz * nudge; out.z = z + tx * nudge; out.y = y;
    return out;
  }
  const fa = { x: 0, y: 0, z: 0 }, ra = { x: 0, y: 0, z: 0 }, fa2 = { x: 0, y: 0, z: 0 }, ra2 = { x: 0, y: 0, z: 0 };
  // A turn continues into the lanes it joins: before its start on the lane in, past its end on the lane out.
  function chain(path, s, nudge, out) {
    if (path.kind === 1 && s < 0 && path.from.points) return along(path.from, path.from.len + s, nudge, out);
    if (path.kind === 1 && s > path.len && path.to.points) return along(path.to, s - path.len, nudge, out);
    return along(path, s, nudge, out);
  }
  // Is swept body `b` (SWEPT.short or .long) clear with its footprint centre at sample i, moved `nudge` metres to the
  // right? The body stands on its axles: both on the path, so in a bend its corners swing out as a real car's do.
  function clearAt(path, i, nudge, b = SWEPT.short) {
    const step = path.len / Math.max(1, path.points.length - 1);
    return clearAtS(path, i * step, nudge, b);
  }
  // The same with the footprint centre `sc` metres along the path (before its start or past its end: straight on).
  function clearAtS(path, sc, nudge, b = SWEPT.short, volume = true) {
    const s = sc + b.offset;
    chain(path, s + b.axle, nudge, fa); chain(path, s - b.axle, nudge, ra);
    let dx = fa.x - ra.x, dz = fa.z - ra.z;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const x = (fa.x + ra.x) / 2 - dx * b.offset, z = (fa.z + ra.z) / 2 - dz * b.offset;
    const y = nudge ? groundY(x, z) : (fa.y + ra.y) / 2;
    const grade = (fa.y - ra.y) / (2 * b.axle);
    body.x = x; body.z = z; body.headingY = Math.atan2(dx, dz);
    body.halfLengthMetres = b.half; body.halfWidthMetres = b.halfWidth;
    body.floorY = y; body.minY = y + GRAPH.sweepFloor; body.maxY = y + b.height;
    const fp = body.floorPlane; fp.x = x; fp.z = z; fp.y = y; fp.dx = grade * dx; fp.dz = grade * dz;
    if (volume && !sampler.isVolumeClear(body)) return false;
    // the body seated on its four tyre contacts (as js/sj-traffic.js poses it): no tyre more than SEAT off the ground
    seatExact = nearTops(path) || nearSupport(path);
    // on a turn past something raised, the narrowest track too (a narrow island tip passes between the widest wheels)
    if (!seated(fa, ra, dx, dz, b.axle, SWEPT.track)) return false;
    // on a turn past something raised, every vehicle of the body's class on its own wheels (a narrow island tip can pass
    // between one car's wheels and under another's)
    if (seatExact && path.kind === 1) {
      const longClass = b === SWEPT.long;
      for (const t of VEHICLE_TYPES) {
        if ((t.length >= LONG_VEHICLE) !== longClass) continue;
        const st = sc + (t.axleOffset ?? 0);
        chain(path, st + t.axle, nudge, fa2); chain(path, st - t.axle, nudge, ra2);
        let ex = fa2.x - ra2.x, ez = fa2.z - ra2.z;
        const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
        if (!seated(fa2, ra2, ex, ez, t.axle, t.track)) return false;
      }
    }
    // a kerb or a raised surface under a tyre (more than KERB above or below what the terrain's own slope gives there),
    // the widest and the narrowest track: only where the street's ground is not the terrain's (the terrain has no steps)
    if (!seatExact) return true;
    for (const axleAt of [fa, ra]) {
      const ya = seatGround(axleAt.x, axleAt.z), ha = world.height(axleAt.x, axleAt.z);
      for (const tk of KERB_TRACKS) for (const side of [1, -1]) {
        const wx = axleAt.x + dz * tk * side, wz = axleAt.z - dx * tk * side;
        const step = seatGround(wx, wz) - ya - (world.height(wx, wz) - ha);
        if (step > GRAPH.kerb || step < -GRAPH.kerb) return false;
      }
    }
    return true;
  }
  const topBox = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, topIds = [];
  // The rigid fit of js/sj-traffic.js locate through the four contacts (the street's own support under each, the widest
  // track), centred between the highest and the lowest contact: does every tyre sit within GRAPH.seat of its ground?
  const seatY = new Float64Array(4);
  let seatExact = true;
  // the street's ground for the seat and kerb tests, cached on a 5 cm lattice (turn shapes, slides and both bodies ask
  // for the same spots many times; a 5 cm shift changes a height by a few millimetres off an edge)
  const seatCache = new Map();
  function seatGround(x, z) {
    const xi = Math.round(x * 20), zi = Math.round(z * 20), key = xi * 131072 + zi;
    let g = seatCache.get(key);
    if (g === undefined) { g = groundY(xi / 20, zi / 20); seatCache.set(key, g); }
    return g;
  }
  // Is any support body (support: true box or prism: kerb islands, raised paving) near path (its bounds and 6 m; a turn
  // with the lanes it joins)? Asked once per path.
  function nearSupport(path) {
    if (path.nearSupport !== undefined) return path.nearSupport;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of [path, path.kind === 1 ? path.from : null, path.kind === 1 ? path.to : null]) if (q?.points) for (const [x, z] of q.points) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const box = { minX: minX - 6, maxX: maxX + 6, minZ: minZ - 6, maxZ: maxZ + 6 };
    let near = false;
    if (sampler.hasBoxSupport) for (const id of sampler.boxIndex.query(box, [])) if (sampler.boxStore.get(id)?.collider?.support === true) { near = true; break; }
    if (!near && sampler.hasPrismSupport) for (const id of sampler.prismIndex.query(box, [])) if (sampler.prismAt(id)?.support === true) { near = true; break; }
    return (path.nearSupport = near);
  }
  function seated(fa, ra, dx, dz, axle, tr0) {
    for (let w = 0; w < 4; w++) {
      const a = w < 2 ? fa : ra, side = w & 1 ? -1 : 1;
      const wx = a.x + dz * tr0 * side, wz = a.z - dx * tr0 * side;
      seatY[w] = seatExact ? seatGround(wx, wz) : world.height(wx, wz);
      if (!Number.isFinite(seatY[w])) return true; // off the map's support: the volume and water tests decide
    }
    const [fl, fr, rl, rr] = seatY;
    const tp = ((fl + fr) - (rl + rr)) / (4 * axle);
    let tr = ((fl + rl) - (fr + rr)) / (4 * tr0);
    if (tr > GRAPH.maxRoll) tr = GRAPH.maxRoll; else if (tr < -GRAPH.maxRoll) tr = -GRAPH.maxRoll;
    const yc = (fl + fr + rl + rr) / 4;
    let hi = -Infinity, lo = Infinity;
    for (let w = 0; w < 4; w++) {
      const r = seatY[w] - (yc + (w < 2 ? 1 : -1) * axle * tp + (w & 1 ? -1 : 1) * tr0 * tr);
      if (r > hi) hi = r; if (r < lo) lo = r;
    }
    return hi - lo <= 2 * GRAPH.seat; // centred: the worst tyre is off by half the spread
  }
  // Is any authored surface near path (its bounds and 6 m)? Asked once per path (a turn: with the lanes it joins).
  function nearTops(path) {
    if (path.nearTops !== undefined) return path.nearTops;
    if (!sampler.topIndex) return (path.nearTops = false);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of [path, path.kind === 1 ? path.from : null, path.kind === 1 ? path.to : null]) if (q?.points) for (const [x, z] of q.points) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    topBox.minX = minX - 6; topBox.maxX = maxX + 6; topBox.minZ = minZ - 6; topBox.maxZ = maxZ + 6;
    return (path.nearTops = sampler.topIndex.query(topBox, topIds).length > 0);
  }
  // Does the long body fit all along a path (as it stands, no further slide)?
  const holdsLong = (path, stride) => holds(path, SWEPT.long, stride);
  function sweep(path, stride, volume = true) {
    const pts = path.points, n = pts.length, step = path.len / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const [x, z] = pts[i], y = path.y[i];
      path.failAt = pts[i];
      if (!world.isDry(x, z)) return 'water';
      if ((i & 1) === 0 && sampler.offLimitsAt?.(x, z, y + 0.5)) return 'private';
      if (reserved(x, z, 0.5)) return 'reserve';
      for (const f of flights) {
        const dx = x - f.ox, dz = z - f.oz, u = dx * f.cx + dz * f.cz, s = dx * f.ex + dz * f.ez;
        if (u > f.u0 - 1 && u < f.u1 + 1 && s > f.footS - 0.5 && s < f.topS + 0.5) return 'stairs';
      }
      if (i > 0) {
        const j = Math.max(0, i - 2), run = (i - j) * step;
        if (run > 0 && Math.abs(path.y[i] - path.y[j]) / run > GRAPH.maxGrade) return 'steep';
      }
    }
    if (volume && !holds(path, SWEPT.short, stride)) return 'solid';
    return '';
  }
  // Footprint-centre positions (metres along the path) at which body `b` is swept: on a lane from end to end (straight
  // on past them, as a car crossing a junction drives: a lane slides off a corner at its mouth); on a turn from a body's
  // half before its start to a body's half past its end, the body on the lanes it joins.
  function positions(path, b, stride, out) {
    out.length = 0;
    const step = path.len / Math.max(1, path.points.length - 1) * stride;
    const lo = path.kind === 0 ? 0 : -b.half;
    const hi = path.kind === 0 ? path.len : path.len + b.half;
    for (let s = lo; s < hi; s += step) out.push(s);
    out.push(hi);
    return out;
  }
  const where = [];
  function holds(path, b, stride) {
    // the seat every lane sample, the volume every `stride` samples (and at the end)
    positions(path, b, 1, where);
    for (let k = 0; k < where.length; k++) {
      const sc = where[k];
      if (!clearAtS(path, sc, 0, b, k % stride === 0 || k === where.length - 1)) { path.failAt = [fa.x, fa.z]; path.failS = sc; return false; }
    }
    return true;
  }
  // Is the whole body (centre at sample i) on lane `path`? Near a lane's ends the body is on a turn: swept there.
  function onPath(path, i, b = SWEPT.short) {
    if (path.kind !== 0) return true;
    const step = path.len / Math.max(1, path.points.length - 1), s = i * step;
    const lo = Math.min(b.half, path.len / 2), hi = Math.max(path.len - b.half, path.len / 2);
    return s >= lo - 1e-6 && s <= hi + 1e-6;
  }
  // A lane that grazes a wall slides sideways within its room, easing in and out (GRAPH.nudgeSlope), then is swept again.
  const NUDGES = [0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1, -1, 1.25, -1.25, 1.5, -1.5];
  function nudgeLane(l) {
    const n = l.points.length, step = l.len / Math.max(1, n - 1);
    const pos = new Float32Array(n), neg = new Float32Array(n);
    let any = false;
    const at = positions(l, SWEPT.short, 1, []);
    for (let k = 0; k < at.length; k++) {
      const sc = at[k];
      const vol = k % GRAPH.sweepStride === 0 || k === at.length - 1;
      const shortOk = clearAtS(l, sc, 0, SWEPT.short, vol);
      // where the short body fits but a long one would not sit on its tyres (a bank beside the lane), slide too if a
      // place within the road suits both; otherwise leave it to the long network's own check
      if (shortOk && clearAtS(l, sc, 0, SWEPT.long, false)) continue;
      const i = Math.max(0, Math.min(n - 1, Math.round(sc / step)));
      let found = NaN;
      for (const d of NUDGES) if (d >= l.nLo && d <= l.nHi && clearAtS(l, sc, d) && clearAtS(l, sc, d, SWEPT.long, false)) { found = d; break; }
      if (shortOk && !Number.isFinite(found)) continue;
      if (!Number.isFinite(found)) { l.failAt = l.points[i]; l.nudgeFail = true; if (debug) (l.trace ??= []).push(['fail', i, n, +l.points[i][0].toFixed(1), +l.points[i][1].toFixed(1)]); return false; }
      if (debug) (l.trace ??= []).push([i, n, found, +l.points[i][0].toFixed(1), +l.points[i][1].toFixed(1)]);
      if (found > 0) pos[i] = found; else neg[i] = -found;
      any = true;
    }
    if (!any) return true;
    const fall = GRAPH.nudgeSlope * step;
    // full slide over a body's length round each tight spot (a ramp under the body would turn it into the wall),
    // easing in and out beyond
    const plateau = Math.ceil((SWEPT.short.half + 1) / step);
    for (const e of [pos, neg]) {
      const src = e.slice();
      for (let i = 0; i < n; i++) if (src[i] > 0) for (let j = Math.max(0, i - plateau); j <= Math.min(n - 1, i + plateau); j++) e[j] = Math.max(e[j], src[i]);
    }
    for (const e of [pos, neg]) {
      for (let i = 1; i < n; i++) e[i] = Math.max(e[i], e[i - 1] - fall);
      for (let i = n - 2; i >= 0; i--) e[i] = Math.max(e[i], e[i + 1] - fall);
    }
    const moved = [];
    let most = 0;
    for (let i = 0; i < n; i++) {
      const d = pos[i] - neg[i];
      most = Math.max(most, Math.abs(d));
      moved.push([l.points[i][0] - l.tz[i] * d, l.points[i][1] + l.tx[i] * d]);
    }
    const { points, length } = resample(moved, GRAPH.step);
    l.points = points; l.len = length; l.nudged = most;
    // what is left of the room for another round (conservative: a slide one way never adds room the other way)
    let right = 0, left = 0;
    for (let i = 0; i < n; i++) { right = Math.max(right, pos[i]); left = Math.max(left, neg[i]); }
    l.nHi -= right; l.nLo += left;
    return true;
  }
  // cheap checks first, then a first component over the possible turns, so the sweep skips lanes that cannot be kept
  for (const l of lanes) {
    profile(l);
    // a service way too narrow for two cars (car parks, yards) takes no traffic: two cars meeting there could not pass
    const cause = l.shared && l.cls === 'service' ? 'narrow' : sweep(l, 2, false);
    if (cause) { l.ok = false; l.cause = cause; }
  }
  {
    const byStart = new Map();
    for (const l of lanes) if (l.ok) { if (!byStart.has(l.from)) byStart.set(l.from, []); byStart.get(l.from).push(l); }
    const turns = (a) => (byStart.get(a.to) ?? []).filter((b) => b.link !== a.link && turnOf(a, b) <= GRAPH.maxTurn);
    const keep = largestComponent(lanes.filter((l) => l.ok), turns);
    for (const l of lanes) if (l.ok && !keep.has(l)) { l.ok = false; l.cause = 'disconnected'; }
  }
  let nudgedLanes = 0;
  for (const l of lanes) {
    if (!l.ok) continue;
    let cause = sweep(l, GRAPH.sweepStride);
    // a slide can bring the lane near something else: slide again from there, a few times at most
    for (let round = 0; round < 4 && cause === 'solid'; round++) {
      const before = l.nudgedTotal ?? 0;
      if (!nudgeLane(l) || !(l.nudged > 0)) break;
      l.nudgedTotal = before + l.nudged;
      profile(l); cause = sweep(l, GRAPH.sweepStride);
      if (debug) (l.trace ??= []).push(['round', cause, l.failAt && l.failAt.map((v) => +v.toFixed(1))]);
      if (!cause) nudgedLanes++;
    }
    if (cause) { l.ok = false; l.cause = cause; }
  }

  // ---- Connectors across junctions
  const connectors = [];
  const byTo = new Map(), byFrom = new Map();
  for (const l of lanes) {
    if (!byTo.has(l.to)) byTo.set(l.to, []);
    byTo.get(l.to).push(l);
    if (!byFrom.has(l.from)) byFrom.set(l.from, []);
    byFrom.get(l.from).push(l);
  }
  for (const [node, ins] of byTo) {
    const outs = byFrom.get(node);
    if (!outs) continue;
    for (const a of ins) {
      if (!a.ok) continue;
      const ta = tangentAt(a.points, true), pa = a.points[a.points.length - 1];
      for (const b of outs) {
        if (!b.ok || b.link === a.link) continue; // no U-turns, also not round a shared single lane
        const tb = tangentAt(b.points, false), pb = b.points[0];
        const turnAngle = Math.atan2(ta[0] * tb[1] - ta[1] * tb[0], ta[0] * tb[0] + ta[1] * tb[1]);
        if (Math.abs(turnAngle) > GRAPH.maxTurn) { bump(dropped.connectors, 'hairpin'); continue; }
        // the usual curve first; where a body would clip a corner, a tighter or a wider one
        let c = null;
        const c0 = {};
        for (const [shape, run] of GRAPH.turnShapes) {
          const curve = bezier(pa, ta, pb, tb, shape, run);
          if (!curve) continue;
          const { points, length } = resample(curve, GRAPH.step * 0.5);
          // tightest bend radius on the curve
          let minR = Infinity;
          for (let i = 2; i < points.length - 2; i++) {
            const p0 = points[i - 2], p1 = points[i], p2 = points[i + 2];
            const a1 = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]), a2 = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
            let d = a2 - a1; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
            const run = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]);
            if (Math.abs(d) > 1e-4) minR = Math.min(minR, run / Math.abs(d));
          }
          // right turn (+1) when the new direction lies on the right-hand normal (−tz, tx) of the old one
          const t = { kind: 1, node, from: a, to: b, points: resample(points, GRAPH.step).points, len: length, minR,
            turn: Math.abs(turnAngle) < 0.6 ? 0 : (-ta[1] * tb[0] + ta[0] * tb[1] > 0 ? 1 : -1), ok: true, cause: '' };
          if (minR < GRAPH.minRadius) { t.ok = false; t.cause = 'tight'; }
          else {
            profile(t);
            const cause = sweep(t, 2);
            if (cause) { t.ok = false; t.cause = cause; }
          }
          if (debug) (c0.shapes ??= []).push([shape, run, t.cause, t.failS?.toFixed?.(1), +t.len.toFixed(1)]);
          if (!c || (t.ok && !c.ok) || (c.cause === 'tight' && t.cause !== 'tight')) c = t;
          if (c.ok) break;
        }
        c.shapes = c0.shapes;
        debug?.push(c);
        if (!c.ok) { bump(dropped.connectors, c.cause); continue; }
        connectors.push(c);
        a.out.push(c); b.inn.push(c);
      }
    }
  }

  // ---- Unrelated paths that cross or touch (two mapped roads drawn on top of each other, a lane through a neighbouring
  // junction): the weaker one goes. Paths meeting at a junction are its business (claims and conflict masks).
  {
    const live = [...lanes.filter((l) => l.ok), ...connectors.filter((c) => c.ok)];
    const cell = 2.2, grid = new Map();
    const cellKey = (x, z) => Math.floor(x / cell) * 1048576 + Math.floor(z / cell);
    live.forEach((p, n) => p.points.forEach((q, k) => {
      const key = cellKey(q[0], q[1]);
      let list = grid.get(key);
      if (!list) grid.set(key, list = []);
      list.push(n, k);
    }));
    const nodesOf = (p) => (p.kind === 1 ? [p.node] : [p.from, p.to]);
    const related = (a, b) => {
      if (a.kind === 0 && b.kind === 0) return a.link === b.link;
      if (a.kind === 1 && b.kind === 1) return a.node === b.node;
      const c = a.kind === 1 ? a : b, l = a.kind === 1 ? b : a;
      return c.from === l || c.to === l || c.node === l.from || c.node === l.to;
    };
    const nearShared = (a, b, q) => {
      for (const n of nodesOf(a)) if (nodesOf(b).includes(n) && Math.hypot(q[0] - n.x, q[1] - n.z) < ownSetbackOf(n) + 8) return true;
      return false;
    };
    const ownSetbackOf = (c) => (c.junction ? Math.max(3.5, Math.min(9, c.width / 2 + 1.5)) + c.radius : 1);
    const strength = (p) => (p.kind === 1 ? -10 + (p.from.rank ?? 0) : p.rank * 10 + (p.cls === 'service' ? 0 : 5)) + Math.min(p.len, 300) / 1000;
    const seen = new Set();
    live.forEach((a, n) => a.points.forEach((q, k) => {
      if (!a.ok) return;
      const ix = Math.floor(q[0] / cell), iz = Math.floor(q[1] / cell), ya = a.y[k];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const list = grid.get((ix + dx) * 1048576 + iz + dz);
        if (!list) continue;
        for (let m = 0; m < list.length; m += 2) {
          const b = live[list[m]];
          if (list[m] <= n || !b.ok || related(a, b)) continue;
          const r = b.points[list[m + 1]];
          if (Math.hypot(r[0] - q[0], r[1] - q[1]) > GRAPH.overlap || Math.abs(b.y[list[m + 1]] - ya) > 2.5) continue;
          if (a.kind === 0 && b.kind === 0 && nearShared(a, b, q)) continue;
          const pair = n * 65536 + list[m];
          if (seen.has(pair)) continue;
          seen.add(pair);
          const victim = strength(a) < strength(b) ? a : b;
          victim.ok = false; victim.cause = 'overlap';
        }
      }
    }));
  }

  // ---- Largest strongly connected component of what is left
  {
    const keep = largestComponent(lanes.filter((l) => l.ok), (l) => l.out.filter((c) => c.ok).map((c) => c.to).filter((t) => t.ok));
    for (const l of lanes) if (l.ok && !keep.has(l)) { l.ok = false; l.cause = 'disconnected'; }
  }
  for (const l of lanes) if (!l.ok) bump(dropped.lanes, l.cause);
  const keptLanes = lanes.filter((l) => l.ok);
  const keptConnectors = connectors.filter((c) => {
    if (c.ok && c.from.ok && c.to.ok) return true;
    bump(dropped.connectors, c.ok ? 'disconnected' : c.cause);
    return false;
  });
  { const kept = new Set(keptConnectors); for (const l of keptLanes) l.out = l.out.filter((c) => kept.has(c)); }
  // The long vehicles' network: lanes and turns that also hold the long body, their largest strongly connected set.
  for (const l of keptLanes) l.long = holdsLong(l, GRAPH.sweepStride);
  for (const c of keptConnectors) c.long = c.from.long && c.to.long && holdsLong(c, 2);
  {
    const keep = largestComponent(keptLanes.filter((l) => l.long), (l) => l.out.filter((c) => c.long).map((c) => c.to).filter((t) => t.long));
    for (const l of keptLanes) l.long = keep.has(l);
    for (const c of keptConnectors) c.long = c.long && c.from.long && c.to.long;
  }
  // a shared single lane is only shared while both of its directions survive
  for (const l of keptLanes) if (l.twin && !l.twin.ok) l.twin = -1;

  // ---- Pack: paths = lanes, then connectors
  const paths = [...keptLanes, ...keptConnectors];
  paths.forEach((p, i) => { p.id = i; });
  const P = paths.length;
  let samples = 0;
  for (const p of paths) samples += p.points.length;
  const SX = new Float32Array(samples), SZ = new Float32Array(samples), SY = new Float32Array(samples);
  const SDL = new Float32Array(samples), SDR = new Float32Array(samples), rough = new Uint8Array(P), gStart = new Int32Array(P).fill(-1), gCount = new Int32Array(P), gStep = new Float32Array(P);
  const gridRows = [];
  const STX = new Float32Array(samples), STZ = new Float32Array(samples), SROLL = new Float32Array(samples), SCAP = new Float32Array(samples);
  const start = new Int32Array(P), count = new Int32Array(P), len = new Float32Array(P), step = new Float32Array(P);
  const kind = new Uint8Array(P), cls = new Uint8Array(P), rank = new Uint8Array(P), stop = new Uint8Array(P), turn = new Int8Array(P);
  const twin = new Int32Array(P).fill(-1), node = new Int32Array(P).fill(-1), source = new Int32Array(P).fill(-1), target = new Int32Array(P).fill(-1);
  const road = new Int32Array(P).fill(-1), local = new Int8Array(P).fill(-1);
  const outStart = new Int32Array(P + 1);
  const conflictLo = new Uint32Array(P), conflictHi = new Uint32Array(P);
  let o = 0;
  for (const p of paths) {
    const i = p.id, n = p.points.length;
    start[i] = o; count[i] = n; len[i] = Math.max(0.05, p.len); step[i] = len[i] / Math.max(1, n - 1);
    kind[i] = p.kind;
    for (let k = 0; k < n; k++) {
      SX[o + k] = p.points[k][0]; SZ[o + k] = p.points[k][1]; SY[o + k] = p.y[k];
      STX[o + k] = p.tx[k]; STZ[o + k] = p.tz[k]; SROLL[o + k] = p.roll[k];
      // the ground under both wheel tracks, relative to the centre line (the tyres' contacts, js/sj-traffic.js): the
      // street's own support there, terrain or authored surface alike
      const [x, z] = p.points[k], tx = p.tx[k], tz = p.tz[k];
      const lx = x + tz * SWEPT.track, lz = z - tx * SWEPT.track, rx = x - tz * SWEPT.track, rz = z + tx * SWEPT.track;
      const authored = nearTops(p) || nearSupport(p); // otherwise the street's ground is the terrain's
      const yl = authored ? groundY(lx, lz) : world.height(lx, lz), yr = authored ? groundY(rx, rz) : world.height(rx, rz);
      // the street's own support differs from the terrain's shape here (an island, a raised surface, a bank): cars near
      // the rider are posed on the ground under their own wheels on this path (js/sj-traffic.js locate)
      if (!rough[i]) {
        const hc = world.height(x, z), el = p.y[k] + world.height(lx, lz) - hc, er = p.y[k] + world.height(rx, rz) - hc;
        // or the ground across the track is not a straight fall (a bank, a gutter): the lane's linear estimate misses it
        const ml = world.height(x + tz * SWEPT.track * 0.5, z - tx * SWEPT.track * 0.5) - hc, mr = world.height(x - tz * SWEPT.track * 0.5, z + tx * SWEPT.track * 0.5) - hc;
        if (Math.abs(yl - el) > 0.02 || Math.abs(yr - er) > 0.02 || Math.abs(el - p.y[k] - 2 * ml) > 0.03 || Math.abs(er - p.y[k] - 2 * mr) > 0.03 ||
          Math.abs(yl - p.y[k]) > 0.15 || Math.abs(yr - p.y[k]) > 0.15) rough[i] = 1;
      }
      SDL[o + k] = Number.isFinite(yl) && Math.abs(yl - p.y[k]) < 1 ? yl - p.y[k] : 0;
      SDR[o + k] = Number.isFinite(yr) && Math.abs(yr - p.y[k]) < 1 ? yr - p.y[k] : 0;
    }
    // bend speed: heading change over ±3 m → v = sqrt(aLat / curvature)
    const w = Math.max(1, Math.round(3 / step[i]));
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - w), b = Math.min(n - 1, k + w);
      let d = Math.atan2(STX[o + b], STZ[o + b]) - Math.atan2(STX[o + a], STZ[o + a]);
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
      const curvature = b > a ? Math.abs(d) / ((b - a) * step[i]) : 0;
      SCAP[o + k] = curvature > 1e-4 ? Math.min(30, Math.sqrt(GRAPH.aLat / curvature)) : 30;
    }
    o += n;
  }
  // a turn's own ground matters on the lanes it joins too (a car on it has an axle on them)
  for (const p of paths) if (p.kind === 1 && rough[p.id]) { rough[p.from.id] = 1; rough[p.to.id] = 1; }
  for (const p of paths) {
    const i = p.id, n = p.points.length;
    // on a rough path: the ground (absolute) at 0.65, 0.75 and 0.85 m left and right of the centre line every 0.25 m
    // along it, which js/sj-traffic.js interpolates under each wheel
    if (rough[i]) {
      const authored = nearTops(p) || nearSupport(p);
      const gs = 0.25, m = Math.max(2, Math.ceil(len[i] / gs) + 1);
      gStart[i] = gridRows.length / 7; gCount[i] = m; gStep[i] = len[i] / (m - 1);
      for (let q = 0; q < m; q++) {
        const f = Math.min(n - 1.000001, q * gStep[i] / step[i]), k = f | 0, t = f - k;
        const x = p.points[k][0] + (p.points[k + 1 < n ? k + 1 : k][0] - p.points[k][0]) * t;
        const z = p.points[k][1] + (p.points[k + 1 < n ? k + 1 : k][1] - p.points[k][1]) * t;
        const y = p.y[k] + (p.y[k + 1 < n ? k + 1 : k] - p.y[k]) * t;
        let tx = p.tx[k] + (p.tx[k + 1 < n ? k + 1 : k] - p.tx[k]) * t, tz = p.tz[k] + (p.tz[k + 1 < n ? k + 1 : k] - p.tz[k]) * t;
        const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        gridRows.push(y);
        for (const off of [0.65, 0.75, 0.85, -0.65, -0.75, -0.85]) {
          const g = authored ? groundY(x + tz * off, z - tx * off) : world.height(x + tz * off, z - tx * off);
          gridRows.push(Number.isFinite(g) && Math.abs(g - y) < 1 ? g : y);
        }
      }
    }
  }
  // junction ids (nodes with connectors)
  const junctions = [];
  for (const c of keptConnectors) if (c.node.id < 0) { c.node.id = junctions.length; junctions.push(c.node); }
  for (const l of keptLanes) {
    const i = l.id;
    cls[i] = CLASSES.indexOf(l.cls); rank[i] = l.rank; road[i] = l.road;
    twin[i] = l.twin && l.twin !== -1 ? l.twin.id : -1;
    node[i] = l.to.id;
  }
  // connections in CSR order: a lane's connectors; a connector's single target lane
  const outList = [];
  for (let i = 0; i < P; i++) {
    outStart[i] = outList.length;
    const p = paths[i];
    if (p.kind === 0) { for (const c of p.out) if (c.from.ok && c.to.ok) outList.push(c.id); }
    else outList.push(p.to.id);
  }
  outStart[P] = outList.length;
  const outs = Int32Array.from(outList);
  for (const c of keptConnectors) {
    const i = c.id;
    node[i] = c.node.id; source[i] = c.from.id; target[i] = c.to.id; turn[i] = c.turn;
    cls[i] = cls[c.to.id]; rank[i] = rank[c.from.id]; road[i] = road[c.to.id];
  }
  // control: at a junction with two or more ways in, lower ranks stop; equal ranks stop all-way (avenues merge)
  const inLanes = junctions.map(() => []);
  for (const l of keptLanes) if (l.out.some((c) => c.from.ok && c.to.ok) && l.to.id >= 0) inLanes[l.to.id].push(l.id);
  let stops = 0, allWay = 0, priority = 0;
  junctions.forEach((n, j) => {
    const ins = inLanes[j];
    if (!n.junction || ins.length < 2) return;
    let lo = 9, hi = 0;
    for (const i of ins) { lo = Math.min(lo, rank[i]); hi = Math.max(hi, rank[i]); }
    if (lo === hi) { if (hi < RANK.avenue) { for (const i of ins) stop[i] = 1; allWay++; } }
    else { for (const i of ins) if (rank[i] < hi) stop[i] = 1; priority++; }
    for (const i of ins) stops += stop[i];
  });
  // conflicts between connectors of one junction: same way in or out, or centre lines closer than conflictGap
  const perNode = junctions.map(() => []);
  for (const c of keptConnectors) perNode[c.node.id].push(c);
  let crowded = 0;
  for (const list of perNode) {
    if (list.length > 64) crowded++;
    list.forEach((c, k) => { local[c.id] = k < 64 ? k : -1; });
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const A = list[a], B = list[b];
      let hit = A.from === B.from || A.to === B.to || A.from.twin === B.to || A.to.twin === B.from;
      for (let i = 0; !hit && i < A.points.length; i++) for (let k = 0; k < B.points.length; k++) {
        const dx = A.points[i][0] - B.points[k][0], dz = A.points[i][1] - B.points[k][1];
        if (dx * dx + dz * dz < GRAPH.conflictGap * GRAPH.conflictGap) { hit = true; break; }
      }
      if (!hit) continue;
      for (const [x, y] of [[A, B], [B, A]]) {
        const bit = local[y.id];
        if (bit < 0) { conflictLo[x.id] = conflictHi[x.id] = 0xffffffff; continue; }
        if (bit < 32) conflictLo[x.id] |= 1 << bit; else conflictHi[x.id] |= 1 << (bit - 32);
      }
    }
    // a crowded junction (never seen in this city) conflicts everything
    if (list.length > 64) for (const c of list) conflictLo[c.id] = conflictHi[c.id] = 0xffffffff;
  }

  // Where a lane's cars stop short of its junction (stopBack, metres before the lane's end) and where cars leaving a
  // junction have cleared it (startBack, metres after a lane's start): clear of every other movement through it.
  const stopBack = new Float32Array(P), startBack = new Float32Array(P);
  const clearOf = (q, list, skip) => {
    const gap = 2 * GRAPH.sweepHalfWidth + 0.2;
    for (const c of list) {
      if (skip(c)) continue;
      for (const r of c.points) if ((r[0] - q[0]) ** 2 + (r[1] - q[1]) ** 2 < gap * gap) return false;
    }
    return true;
  };
  for (const l of keptLanes) {
    const st = len[l.id] / Math.max(1, l.points.length - 1), n = l.points.length;
    const ends = perNode[l.to.id] ?? [], starts = perNode[l.from.id] ?? [];
    for (let k = Math.max(0, n - 1 - Math.ceil(20 / st)); k < n; k++) {
      if (clearOf(l.points[k], ends, (c) => c.from === l)) continue;
      stopBack[l.id] = Math.min(Math.max(0, len[l.id] - 0.5), Math.max(0, len[l.id] - k * st + 0.3));
      break;
    }
    for (let k = Math.min(n - 1, Math.ceil(20 / st)); k >= 0; k--) {
      if (clearOf(l.points[k], starts, (c) => c.to === l)) continue;
      startBack[l.id] = Math.min(len[l.id], k * st + 0.3);
      break;
    }
  }

  // ---- Spawn slots and density
  const slotPath = [], slotS = [], slotW = [];
  const zoneTier = (x, z, name, base) => {
    let tier = NAME_TIER.get(name) ?? base, cap = 9;
    for (const zone of ZONES) if (Math.hypot(x - zone.x, z - zone.z) < zone.r) {
      if (zone.cap) cap = Math.min(cap, zone.tier[0]);
      else tier = tier.map((t, h) => Math.max(t, zone.tier[h]));
    }
    return tier.map((t) => Math.min(t, cap));
  };
  const laneWeight = new Float32Array(P * 3), routeWeight = new Float32Array(P).fill(1);
  for (const l of keptLanes) {
    const pts = l.points, mid = pts[pts.length >> 1];
    const tier = zoneTier(mid[0], mid[1], l.roadRec.name, CLASS_TIER[l.cls]);
    for (let h = 0; h < 3; h++) laneWeight[l.id * 3 + h] = TIER_WEIGHT[tier[h]] * (l.cls === 'service' ? 0.35 : 1);
    routeWeight[l.id] = ROUTE_WEIGHT.get(l.roadRec.name) ?? 1;
    if (l.len < 8) continue;
    for (let s = 4; s < l.len - 4; s += GRAPH.slotSpacing) {
      const k = Math.round(s / step[l.id]), x = pts[k][0], z = pts[k][1];
      if (reserved(x, z, 6)) continue;
      slotPath.push(l.id); slotS.push(s);
      for (let h = 0; h < 3; h++) slotW.push(laneWeight[l.id * 3 + h]);
    }
  }

  const usedRoads = new Set(keptLanes.map((l) => l.road));
  const driveRoads = new Set();
  city.roads.forEach((r, i) => { if (sides.DRIVE_KINDS.has(r.kind)) driveRoads.add(i); });
  let laneMetres = 0;
  for (const l of keptLanes) laneMetres += l.len;
  const stats = {
    roadsDrivable: driveRoads.size, roadsUsed: usedRoads.size, links: links.length,
    lanes: keptLanes.length, connectors: keptConnectors.length, junctions: junctions.filter((n) => n.junction).length,
    controlled: { stopLanes: stops, allWay, priority, crowded }, laneKm: +(laneMetres / 1000).toFixed(2),
    lanesBuilt: lanes.length, droppedRoads: dropped.roads, droppedLanes: dropped.lanes, droppedConnectors: dropped.connectors,
    mergedJunctions: merged, nudgedLanes, longLanes: keptLanes.filter((l) => l.long).length,
    longKm: +(keptLanes.reduce((t, l) => t + (l.long ? l.len : 0), 0) / 1000).toFixed(2), samples, slots: slotPath.length, buildMs: 0,
  };
  const unused = [...driveRoads].filter((i) => !usedRoads.has(i));
  const graph = {
    P, lanes: keptLanes.length, samples, SX, SZ, SY, STX, STZ, SROLL, SCAP, SDL, SDR, rough, RG: Float32Array.from(gridRows), gStart, gCount, gStep, track: SWEPT.track, routeWeight,
    start, count, len, step, kind, cls, rank, stop, turn, twin, node, source, target, road, local, outStart, outs,
    conflictLo, conflictHi, stopBack, startBack, laneWeight, longOk: Uint8Array.from(paths, (p) => (p.long ? 1 : 0)), junctions: junctions.length, junctionAt: Uint8Array.from(junctions, (n) => (n.junction ? 1 : 0)),
    slotPath: Int32Array.from(slotPath), slotS: Float32Array.from(slotS), slotW: Float32Array.from(slotW),
    unusedRoads: Int32Array.from(unused), stats,
  };
  stats.buildMs = +(performance.now() - started).toFixed(1);
  return graph;
}
