/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The walk network: where the people of the old city can walk, built once at boot from the live world (the sampler's
// solids, support layers, water and closed places), not from the mapped lines alone.
//
// Sources, each traced at ≤1.5 m stations and kept only where every station is dry, public, on one support layer and
// clear for a walking torso (an upright box 0.44 m wide from 0.28 m to 1.72 m above the ground):
//   sidewalks   offset from the kerbed streets (generic kerbs are flush; widths follow the street kinds)
//   lanes       the edge of quiet streets that have no sidewalk (La Perla, service lanes), never an avenue
//   footways    mapped footways and pedestrian streets; the authored promenades (Paseo del Morro, the Princesa walk,
//               the waterfront promenade) replace the mapped centre lines they supersede
//   corners     at every junction the sidewalks of neighbouring streets meet round the corner, and an unmarked
//               crossing joins the two sides of each street mouth
//   plazas      a 3 m lattice inside each square (people go round the fountains, kiosks, trees and benches, never
//               through a square's centre)
//   stairs      the registered public flights (js/sj-stairs.js): two lanes up each wide flight, joined at their real
//               landings; heights are the drawn treads, not the smooth riding support
//   joins       short checked links from loose ends to the nearest walk (the mapped graph is fragmented)
// Every link is straight; heights are kept per link at ≤1.5 m stations (Float32Array), so walking needs no sampler
// queries. Records needed after boot (seats, look points, lamps) are packed here, before the construction handoff.
import { stairFlightRecords, stairDrawnHeight } from './sj-stairs.js';
import { laneOffsets } from './sj-street-sides.js';
import { GROUND_AREAS } from './sj-streets-data.js';
import { QUINTO } from './sj-norzagaray-layout.js';
import { PLAZA as RAICES } from './sj-princesa-layout.js';

export const WALK = Object.freeze({ SIDEWALK: 1, FOOTWAY: 2, PROMENADE: 3, PLAZA: 4, STAIR: 5, CROSSING: 6, LANE: 7, JOIN: 8 });
export const WALK_NAMES = ['', 'sidewalk', 'footway', 'promenade', 'plaza', 'stair', 'crossing', 'lane', 'join'];

// Sidewalk width each side by street kind (generic streets: js/sj-streets-layout.js)
const SIDEWALK = { primary: 1.9, secondary: 1.9, tertiary: 1.6, primary_link: 1.4, secondary_link: 1.4, tertiary_link: 1.4,
  residential: 1.25, unclassified: 1.25, living_street: 1.25 };
const DRIVE = new Set(['primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential',
  'unclassified', 'service', 'living_street']);
const LANE_KINDS = new Set(['residential', 'unclassified', 'service', 'living_street']);
const FOOT = new Set(['footway', 'pedestrian', 'steps', 'path']);
const PROMENADE_NAMES = /^(Paseo de la Princesa|Paseo Peatonal de la Princesa|Paseo del Morro)$/;
export const TORSO = Object.freeze({ half: 0.22, low: 0.28, high: 1.72, reach: 0.3 });
const LAYER_STEP = 0.3; // largest height change per metre between stations on one walk (not a stair)
const STATION = 2; // m between traced stations; a torso box spans up to two of them

// Places with their pedestrian tiers [midday, golden, blue] (0 none … 5 a full public zone). Tier counts are people in a
// representative 80 m stretch or one visible square.
export const TIER_PEOPLE = [0, 2, 5.5, 10.5, 18, 27];
export const PLACES = [
  { key: 'street', tiers: [2, 2.3, 1.5] }, // the rest of the old grid
  { key: 'armas', tiers: [4, 4, 3], square: 487051052 },
  { key: 'colon', tiers: [3, 4, 3], square: 196605697 },
  { key: 'sanjose', tiers: [2, 3, 2], square: 196605698 },
  { key: 'quinto', tiers: [2, 2.5, 1], ring: QUINTO },
  { key: 'raices', tiers: [2.5, 3, 3], ring: RAICES }, // (busy, but not the whole town in one square; lamp pools at blue)
  { key: 'square', tiers: [2, 2.5, 2] }, // the other squares
  { key: 'fortaleza', tiers: [4, 4, 3], roads: /^Calle de la Fortaleza$/ },
  { key: 'sanfrancisco', tiers: [4, 4, 3], roads: /^Calle de San Francisco$/ },
  { key: 'cristo', tiers: [3, 4, 2], roads: /^Calle del Cristo$/ },
  { key: 'sansebastian', tiers: [2, 3, 3], roads: /^Calle de San Sebasti/ },
  { key: 'luna', tiers: [1, 2, 1], roads: /^Calle de la Luna$/ },
  { key: 'sol', tiers: [1, 2, 1], roads: /^Calle del Sol$/ },
  { key: 'norzagaray', tiers: [1, 1.5, 1], roads: /Norzagaray/ }, // (a long open walk: a few at a time)
  { key: 'recinto', tiers: [3, 3, 2], roads: /^Calle del Recinto Sur$/ },
  { key: 'princesa', tiers: [3, 4, 3], roads: /Princesa/ },
  { key: 'morro', tiers: [2, 2, 1], roads: /^Paseo del Morro$/ },
  { key: 'lawn', tiers: [3, 4, 1] },
  { key: 'perla', tiers: [1.5, 2, 1] }, // everyday knots in the lanes (photo 65), not a crowd
  { key: 'piers', tiers: [4, 4, 3], roads: /^(Calle Marina|Paseo Dr\. Gilberto Concepci)/ },
  { key: 'bahia', tiers: [1.5, 2, 1.5] },
  { key: 'capitol', tiers: [2, 2, 1] },
  { key: 'cristobal', tiers: [3, 2, 1] }
];
const PLACE = Object.fromEntries(PLACES.map((p, i) => [p.key, i]));
export const HOURS = ['midday', 'golden', 'blue'];
// The empty lot by the Cataño ferry terminal stays empty (the owner's reserve): no walk inside either outline.
export const RESERVED = [
  [[517.77, 162.75], [500.85, 108.14], [535.56, 98.40], [551.26, 153.33]],
  [[488, 162], [495, 153], [491, 126], [493, 119], [505, 158], [507, 164], [493, 168]],
];

const inRing = (x, z, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
const ringBox = (ring) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return [x0, x1, z0, z1];
};
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};

// Is an upright box (the walking torso, its bottom a plane following the walked surface) clear of the city's solids?
// The same question as the sampler's isVolumeClear, asked of its solid boxes and prisms only (no allocation per call);
// overhead ceilings are checked separately at the traced stations, where the surface is sampled anyway.
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
// A walker at `off` (m right of the centre line) stays out of every lane's car-and-person gap: the widest car's half
// width + the person's radius + the drivers' 0.35 m margin (js/sj-traffic.js obstacleGap), + 0.1 of sideways give,
// + 0.12 to spare. Otherwise every passing car would brake for them.
const KERB_LANE_GAP = 0.98 + 0.3 + 0.35 + 0.1 + 0.12;
function kerbClearOfLanes(road, index, off) {
  for (const lane of laneOffsets(road, index)) if (Math.abs(off - lane.offset) < KERB_LANE_GAP) return false;
  return true;
}

export function createSolidsClear(sampler) {
  const EPS = 1e-8, corner = [0, 1, 2, 3].map(() => ({ x: 0, z: 0 })), other = [0, 1, 2, 3].map(() => ({ x: 0, z: 0 }));
  const q = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, boxIds = [], prismIds = [];
  let fp = null, floorY = 0, minY = 0;
  const bottomAt = (x, z) => (fp ? fp.y + fp.dx * (x - fp.x) + fp.dz * (z - fp.z) + minY - floorY : minY);
  const inside = (ring, x, z) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      if ((a.z > z) !== (b.z > z) && x < a.x + (z - a.z) * (b.x - a.x) / (b.z - a.z)) c = !c;
    }
    return c;
  };
  const inPrism = (p, x, z) => {
    if (!inside(p.outer ?? p.poly, x, z)) return false;
    if (p.holes) for (const h of p.holes) if (inside(h, x, z)) return false;
    return true;
  };
  // segment a→b against c→d: the parameter along a→b of the crossing, or −1
  const cross = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const ux = bx - ax, uz = bz - az, vx = dx - cx, vz = dz - cz, det = ux * vz - uz * vx;
    if (Math.abs(det) < EPS) return -1;
    const t = ((cx - ax) * vz - (cz - az) * vx) / det, s = ((cx - ax) * uz - (cz - az) * ux) / det;
    return t >= -EPS && t <= 1 + EPS && s >= -EPS && s <= 1 + EPS ? Math.min(1, Math.max(0, t)) : -1;
  };
  // any point of the overlap of the torso footprint and the solid where the solid's top is above the torso's bottom
  const overlaps = (rings, holes, contains, top) => {
    for (const c of corner) if (contains(c.x, c.z) && top > bottomAt(c.x, c.z) + EPS) return true;
    const ringList = holes ? [rings, ...holes] : null;
    for (let r = 0; r < (ringList ? ringList.length : 1); r++) {
      const ring = ringList ? ringList[r] : rings;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i];
        if (insideBox(b.x, b.z) && top > bottomAt(b.x, b.z) + EPS) return true;
        for (let k = 0; k < 4; k++) {
          const c = corner[k], d = corner[(k + 1) & 3], t = cross(c.x, c.z, d.x, d.z, a.x, a.z, b.x, b.z);
          if (t >= 0 && top > bottomAt(c.x + (d.x - c.x) * t, c.z + (d.z - c.z) * t) + EPS) return true;
        }
      }
    }
    return false;
  };
  let bx = 0, bz = 0, bs = 0, bc = 0, bhw = 0, bhl = 0;
  const insideBox = (x, z) => { const dx = x - bx, dz = z - bz; return Math.abs(dx * bc - dz * bs) <= bhw && Math.abs(dx * bs + dz * bc) <= bhl; };
  let cur = null;
  const inCur = (x, z) => inPrism(cur, x, z);
  let ox = 0, oz = 0, os = 0, oc = 0, ohw = 0, ohl = 0;
  const inOther = (x, z) => { const dx = x - ox, dz = z - oz; return Math.abs(dx * oc - dz * os) <= ohw + EPS && Math.abs(dx * os + dz * oc) <= ohl + EPS; };
  return (body) => {
    const { x, z, headingY: h, halfWidthMetres: hw, halfLengthMetres: hl, maxY } = body;
    fp = body.floorPlane ?? null; floorY = body.floorY ?? body.minY; minY = body.minY;
    bx = x; bz = z; bc = Math.cos(h); bs = Math.sin(h); bhw = hw; bhl = hl;
    q.minX = q.minZ = Infinity; q.maxX = q.maxZ = -Infinity;
    for (let k = 0; k < 4; k++) {
      const u = CORNERS[k][0] * hw, v = CORNERS[k][1] * hl, c = corner[k];
      c.x = x + bc * u + bs * v; c.z = z - bs * u + bc * v;
      q.minX = Math.min(q.minX, c.x); q.maxX = Math.max(q.maxX, c.x); q.minZ = Math.min(q.minZ, c.z); q.maxZ = Math.max(q.maxZ, c.z);
    }
    let lower = Infinity; for (const c of corner) lower = Math.min(lower, bottomAt(c.x, c.z));
    boxIds.length = 0;
    for (const id of sampler.boxIndex.query(q, boxIds)) {
      const b = sampler.boxStore.get(id), cl = b.collider, top = cl.centre.y + cl.halfExtents.y;
      if (top <= lower + EPS || cl.centre.y - cl.halfExtents.y >= maxY - EPS) continue;
      ox = cl.centre.x; oz = cl.centre.z; oc = b.cos; os = b.sin; ohw = cl.halfExtents.x; ohl = cl.halfExtents.z;
      const xc = oc * ohw, xs = os * ohw, zc = oc * ohl, zs = os * ohl;
      other[0].x = ox - xc - zs; other[0].z = oz + xs - zc; other[1].x = ox + xc - zs; other[1].z = oz - xs - zc;
      other[2].x = ox + xc + zs; other[2].z = oz - xs + zc; other[3].x = ox - xc + zs; other[3].z = oz + xs + zc;
      if (overlaps(other, null, inOther, top)) return false;
    }
    prismIds.length = 0;
    for (const id of sampler.prismIndex.query(q, prismIds)) {
      const p = sampler.prismAt(id);
      if (!(p.maxY > lower + EPS && p.minY < maxY - EPS)) continue;
      cur = p;
      if (overlaps(p.outer ?? p.poly, p.holes?.length ? p.holes : null, inCur, p.maxY)) return false;
    }
    return true;
  };
}

// A uniform grid of integer ids over the plan (build-time only)
function grid(cell) {
  const map = new Map();
  const key = (i, j) => (i + 4096) * 8192 + (j + 4096);
  return {
    add(x0, x1, z0, z1, id) {
      for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        const k = key(i, j); let a = map.get(k); if (!a) map.set(k, a = []); a.push(id);
      }
    },
    near(x, z, r, out) {
      out.length = 0;
      for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) {
        const a = map.get(key(i, j)); if (a) for (const id of a) out.push(id);
      }
      return out;
    }
  };
}

/**
 * Build the network. Returns compact typed arrays (see the end of this function) plus `stats` (link counts by kind,
 * dropped links by cause, build time). `options.fast` skips nothing; it exists for tests that time the build.
 */
export function buildWalkNetwork(world) {
  const t0 = performance.now();
  const { sampler, height, isDry } = world;
  const roads = world.city.roads;
  const probe = { normal: {} };
  const dropped = { short: 0, island: 0, join: 0, corner: 0, crossing: 0, stair: 0, reserve: 0, moved: 0 };
  const closedAt = sampler.offLimitsAt ?? (() => false);
  const solidsClear = createSolidsClear(sampler);
  // an overhead ceiling (a bore, an arcade) lower than a walking head above the surface just sampled into `g`
  const lowCeiling = (g, x, z) => {
    const sup = g.support, roof = sup?.ceiling ?? (sup?.ceilingOffset ? g.height + sup.ceilingOffset : sampler.grade?.roofAt?.(x, z, g.height));
    return Number.isFinite(roof) && roof > g.height && roof < g.height + TORSO.high;
  };
  const east = world.worldedge?.closure?.x != null ? world.worldedge.closure.x - 3.5 : Infinity;

  // ---- nodes and links (build-time JS arrays) ----
  const NX = [], NZ = [], NY = [], nodeGrid = grid(2), scratch = [], scratch2 = [];
  const LA = [], LB = [], LK = [], LW = [], LP = [], LPROF = [], LSTAIR = [], LROAD = [], LC = [];
  const node = (x, z, y, merge = 0.06) => {
    for (const id of nodeGrid.near(x, z, merge, scratch)) if (Math.hypot(NX[id] - x, NZ[id] - z) <= merge && Math.abs(NY[id] - y) < 0.6) return id;
    const id = NX.length; NX.push(x); NZ.push(z); NY.push(y); nodeGrid.add(x, x, z, z, id); return id;
  };
  let SRC = 0; const LS = []; // debug: which builder step made the link
  const link = (a, b, kind, width, place, prof, stair = -1, road = -1) => {
    if (a === b) return -1;
    LS.push(SRC); LC.push(0); LA.push(a); LB.push(b); LK.push(kind); LW.push(width); LP.push(place); LPROF.push(prof); LSTAIR.push(stair); LROAD.push(road);
    return LA.length - 1;
  };

  // ---- carriageways (for footway stations that stand in a street) ----
  const carriage = grid(16), CS = [];
  for (let ri = 0; ri < roads.length; ri++) {
    const r = roads[ri]; if (!DRIVE.has(r.kind)) continue;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i], h = r.width / 2;
      const id = CS.length; CS.push([a[0], a[1], b[0], b[1], h, ri]);
      carriage.add(Math.min(a[0], b[0]) - h, Math.max(a[0], b[0]) + h, Math.min(a[1], b[1]) - h, Math.max(a[1], b[1]) + h, id);
    }
  }
  const inCarriage = (x, z, margin = 0.1) => {
    for (const id of carriage.near(x, z, 0.1, scratch2)) { const s = CS[id]; if (segDist(x, z, s[0], s[1], s[2], s[3]) < s[4] - margin) return true; }
    return false;
  };
  // in the carriageway of a street other than `own` (a sidewalk or lane is in its own street's edge by design)
  const inOtherCarriage = (x, z, own, margin) => {
    for (const id of carriage.near(x, z, 0.1, scratch2)) { const s = CS[id]; if (s[5] !== own && segDist(x, z, s[0], s[1], s[2], s[3]) < s[4] - margin) return true; }
    return false;
  };
  // does the straight a→b run more than `margin` into a carriageway anywhere (sampled every 0.5 m)?
  const chordInCarriage = (ax, az, bx, bz, margin) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
    for (let i = 0; i <= n; i++) if (inCarriage(ax + (bx - ax) * i / n, az + (bz - az) * i / n, margin)) return true;
    return false;
  };

  // ---- one straight candidate, traced at ≤1 m stations ----
  // Returns runs [{i0, i1, heights}] of consecutive passing stations (indices into the n+1 stations).
  const H = new Float64Array(4096), OK = new Uint8Array(4096), WHY = new Uint8Array(4096);
  const CAUSE = ['', 'water', 'layer', 'closed', 'carriage', 'solid'];
  const droppedMetres = { water: 0, layer: 0, closed: 0, carriage: 0, solid: 0 };
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: TORSO.half, halfLengthMetres: 0.6, minY: 0, maxY: 0, floorPlane: null, floorY: 0 };
  const plane = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
  // half: the clear half-width checked (torso plus the lateral room people get on the link)
  function trace(ax, az, bx, bz, y0, { street = false, carriageOk = false, half = TORSO.half, maxStep = LAYER_STEP, minRun = 1.4, own = -1 } = {}) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.min(4000, Math.max(1, Math.ceil(len / STATION)));
    let prev = y0, cause = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      OK[i] = 0; WHY[i] = 0;
      if (x > east || !isDry(x, z)) { cause = cause ?? 'water'; WHY[i] = 1; continue; }
      const ref = prev == null ? height(x, z) + 0.35 : prev + 0.5;
      const g = sampler.cityGround(x, z, probe, ref);
      if (g.water || !Number.isFinite(g.height)) { cause = cause ?? 'water'; WHY[i] = 1; continue; }
      if (prev != null && Math.abs(g.height - prev) > maxStep * Math.max(1, len / n)) { cause = cause ?? 'layer'; WHY[i] = 2; prev = null; continue; }
      if (closedAt(x, z, g.height)) { cause = cause ?? 'closed'; WHY[i] = 3; continue; }
      if (lowCeiling(g, x, z)) { cause = cause ?? 'solid'; WHY[i] = 5; continue; }
      if (!carriageOk && (street ? own !== -1 && inOtherCarriage(x, z, own, half + 0.15) : inCarriage(x, z))) { cause = cause ?? 'carriage'; WHY[i] = 4; continue; }
      H[i] = g.height; OK[i] = 1; prev = g.height;
    }
    // torso volume over every pair of station intervals: an upright box whose bottom follows the walked surface (a plane
    // through the span's end stations), split per interval where the surface bends
    const heading = Math.atan2(bx - ax, bz - az), sh = Math.sin(heading), ch = Math.cos(heading), step = len / n;
    body.headingY = heading; body.halfWidthMetres = half; body.floorPlane = plane;
    const span = (i, j) => {
      let ka = -1, kb = -1;
      for (let k = i; k <= j; k++) if (OK[k]) { if (ka < 0) ka = k; kb = k; }
      if (ka < 0) return;
      const g = kb > ka ? (H[kb] - H[ka]) / ((kb - ka) * step) : 0;
      if (j - i > 1) for (let k = ka + 1; k < kb; k++) if (OK[k] && Math.abs(H[ka] + g * (k - ka) * step - H[k]) > 0.12) { span(i, k); span(k, j); return; }
      const tc = (i + j) / 2;
      body.x = ax + (bx - ax) * tc / n; body.z = az + (bz - az) * tc / n;
      body.halfLengthMetres = (j - i) * step / 2 + TORSO.reach; // a person standing at a station reaches past it
      const yc = H[ka] + g * (tc - ka) * step;
      plane.x = body.x; plane.z = body.z; plane.y = yc; plane.dx = g * sh; plane.dz = g * ch;
      body.floorY = yc; body.minY = yc + TORSO.low; body.maxY = yc + TORSO.high;
      if (!solidsClear(body)) { for (let k = i; k <= j; k++) if (OK[k]) { OK[k] = 0; WHY[k] = 5; } cause = cause ?? 'solid'; }
    };
    for (let i = 0; i < n; i += 2) span(i, Math.min(n, i + 2));
    const runs = [];
    for (let i = 0; i <= n;) {
      if (!OK[i]) { i++; continue; }
      let j = i; while (j < n && OK[j + 1]) j++;
      if ((j - i) * len / n >= minRun && (j > i || n === 0)) runs.push({ i0: i, i1: j, n, len, heights: Float32Array.from(H.subarray(i, j + 1)) });
      else if (j > i) dropped.short++;
      i = j + 1;
    }
    return { runs, cause, n, len };
  }
  // one torso box over a straight piece a→b whose surface passes through ya, ym (middle), yb
  function boxClear(ax, az, ya, bx, bz, yb, ym, half) {
    const len = Math.hypot(bx - ax, bz - az), heading = Math.atan2(bx - ax, bz - az);
    if (Math.abs(ym - (ya + yb) / 2) > 0.12) {
      return boxClear(ax, az, ya, (ax + bx) / 2, (az + bz) / 2, ym, (ya + ym) / 2, half)
        && boxClear((ax + bx) / 2, (az + bz) / 2, ym, bx, bz, yb, (ym + yb) / 2, half);
    }
    const g = len > 0 ? (yb - ya) / len : 0;
    body.headingY = heading; body.halfWidthMetres = half; body.floorPlane = plane;
    body.x = (ax + bx) / 2; body.z = (az + bz) / 2; body.halfLengthMetres = len / 2 + TORSO.reach;
    plane.x = body.x; plane.z = body.z; plane.y = (ya + yb) / 2; plane.dx = g * Math.sin(heading); plane.dz = g * Math.cos(heading);
    body.floorY = plane.y; body.minY = plane.y + TORSO.low; body.maxY = plane.y + TORSO.high;
    return solidsClear(body);
  }
  // Trace and emit links for one candidate: run ends at the candidate's ends use (and merge with) end nodes
  function emit(ax, az, bx, bz, kind, width, place, opts = {}, road = -1) {
    const r = trace(ax, az, bx, bz, opts.y0 ?? null, { half: TORSO.half + width, ...opts, own: opts.street ? road : -1 });
    if (r.cause) for (let i = 0; i <= r.n; i++) if (WHY[i]) droppedMetres[CAUSE[WHY[i]]] += r.len / (r.n + 1);
    const out = [];
    for (const run of r.runs) {
      const p = (i) => [ax + (bx - ax) * i / r.n, az + (bz - az) * i / r.n];
      const [x0, z0] = p(run.i0), [x1, z1] = p(run.i1);
      const a = node(x0, z0, run.heights[0]), b = node(x1, z1, run.heights[run.heights.length - 1]);
      SRC = 1; const id = link(a, b, kind, width, place, run.heights, -1, road);
      if (id >= 0) out.push(id);
    }
    return { links: out, passed: r.runs.reduce((s, q) => s + (q.i1 - q.i0) * r.len / r.n, 0), len: r.len, cause: r.cause };
  }

  // ---- places ----
  const squares = GROUND_AREAS.filter((g) => g.kind === 'square' && g.ring?.length >= 3).map((g) => ({ ring: g.ring, id: g.id, name: g.name }));
  const plazaRings = [];
  for (const s of squares) {
    const def = PLACES.findIndex((p) => p.square === s.id);
    plazaRings.push({ ring: s.ring, place: def >= 0 ? def : PLACE.square, name: s.name || String(s.id) });
  }
  plazaRings.push({ ring: QUINTO, place: PLACE.quinto, name: 'Plaza del Quinto Centenario' });
  for (const p of world.bahia?.plazas ?? []) if (p.ring?.length >= 3) plazaRings.push({ ring: p.ring, place: PLACE.bahia, name: `Bahía ${p.name}` });
  for (const p of plazaRings) p.box = ringBox(p.ring);
  const raicesBox = ringBox(RAICES);
  const morroLawn = world.city.places.find((p) => /El Morro/.test(p.name));
  const cristobal = world.city.places.find((p) => /San Crist/.test(p.name));
  const placeAt = (x, z, y, road = -1) => {
    for (const p of plazaRings) if (x >= p.box[0] && x <= p.box[1] && z >= p.box[2] && z <= p.box[3] && inRing(x, z, p.ring)) return p.place;
    if (x >= raicesBox[0] && x <= raicesBox[1] && z >= raicesBox[2] && z <= raicesBox[3] && inRing(x, z, RAICES)) return PLACE.raices;
    const name = road >= 0 ? roads[road].name || '' : '';
    if (name) for (let i = 0; i < PLACES.length; i++) if (PLACES[i].roads?.test(name)) return i;
    if (x > 940) return PLACE.capitol;
    if (x > 840 && z > 120) return PLACE.bahia;
    if (z > 150 && x > 120) return PLACE.piers;
    if (morroLawn && Math.hypot(x - morroLawn.x, z - morroLawn.z) < 170 && z < -380) return PLACE.lawn;
    if (cristobal && Math.hypot(x - cristobal.x, z - cristobal.z) < 90) return PLACE.cristobal;
    if (x > -260 && x < 430 && z < -300 && y < 15) return PLACE.perla;
    return PLACE.street;
  };
  const inPlaza = (x, z) => {
    for (const p of plazaRings) if (x >= p.box[0] && x <= p.box[1] && z >= p.box[2] && z <= p.box[3] && inRing(x, z, p.ring)) return true;
    return false;
  };

  // ---- stairs: approaches of registered flights (mapped walks over them are skipped) ----
  const flights = stairFlightRecords();
  const nearFlight = (ax, az, bx, bz, pad) => flights.some((f) => {
    if (Math.max(ax, bx) < f.box[0] - pad - 3 || Math.min(ax, bx) > f.box[1] + pad + 3
      || Math.max(az, bz) < f.box[2] - pad - 3 || Math.min(az, bz) > f.box[3] + pad + 3) return false;
    const loc = (x, z) => { const dx = x - f.ox, dz = z - f.oz; return [dx * f.cx + dz * f.cz, dx * f.ex + dz * f.ez]; };
    const A = loc(ax, az), B = loc(bx, bz); let t0 = 0, t1 = 1;
    for (const [i, lo, hi] of [[0, f.u0 - pad, f.u1 + pad], [1, f.footS - pad, f.topS + pad]]) {
      const d = B[i] - A[i];
      if (Math.abs(d) < 1e-10) { if (A[i] < lo || A[i] > hi) return false; continue; }
      const l = (lo - A[i]) / d, h = (hi - A[i]) / d; t0 = Math.max(t0, Math.min(l, h)); t1 = Math.min(t1, Math.max(l, h)); if (t0 > t1) return false;
    }
    return true;
  });

  globalThis.__walkTrace?.('1. drive cha', performance.now() - t0);
  // A quick look before a full trace: the share of a few evenly spaced points along `line` that are dry, public and
  // clear for a torso (lines under 8 m always get the full trace)
  const probeLine = (line, half) => {
    let total = 0; for (let i = 1; i < line.length; i++) total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    if (total < 8) return 1;
    const count = Math.min(6, Math.max(3, Math.round(total / 10)));
    let ok = 0;
    for (let q = 0; q < count; q++) {
      let at = total * (q + 0.5) / count, i = 1;
      for (; i < line.length - 1; i++) { const l = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); if (at <= l) break; at -= l; }
      const a = line[i - 1], b = line[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = Math.min(1, at / l);
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (!isDry(x, z)) continue;
      const g = sampler.cityGround(x, z, probe, height(x, z) + 0.35);
      if (g.water || closedAt(x, z, g.height)) continue;
      body.x = x; body.z = z; body.headingY = Math.atan2(b[0] - a[0], b[1] - a[1]); body.halfWidthMetres = half; body.halfLengthMetres = 0.8;
      body.floorPlane = null; body.minY = g.height + TORSO.low; body.maxY = g.height + TORSO.high;
      if (solidsClear(body)) ok++;
    }
    return ok / count;
  };
  // ---- 1. drive chains: sidewalks, lanes, corners and crossings ----
  const vkey = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const vdeg = new Map();
  for (const r of roads) if (DRIVE.has(r.kind)) for (let i = 0; i < r.points.length; i++) {
    const k = vkey(r.points[i]); vdeg.set(k, (vdeg.get(k) ?? 0) + (i === 0 || i === r.points.length - 1 ? 1 : 2));
  }
  const chains = [];
  for (let ri = 0; ri < roads.length; ri++) {
    const r = roads[ri]; if (!DRIVE.has(r.kind)) continue;
    let start = 0;
    for (let i = 1; i < r.points.length; i++) {
      const end = i === r.points.length - 1 || vdeg.get(vkey(r.points[i])) > 2;
      if (end) { chains.push({ road: ri, pts: r.points.slice(start, i + 1) }); start = i; }
    }
  }
  // junction table: chain ends by vertex
  const ends = new Map();
  chains.forEach((c, ci) => {
    for (const at of [0, 1]) {
      const p = at ? c.pts[c.pts.length - 1] : c.pts[0], q = at ? c.pts[c.pts.length - 2] : c.pts[1];
      const k = vkey(p); let e = ends.get(k); if (!e) ends.set(k, e = { x: p[0], z: p[1], list: [] });
      e.list.push({ ci, at, angle: Math.atan2(q[1] - p[1], q[0] - p[0]) });
    }
  });
  // offset polyline (miter), trimmed by `trim0`/`trim1` metres at its ends
  const offsetLine = (pts, off, trim0, trim1) => {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(n - 1, i + 1)];
      let n1x = 0, n1z = 0, n2x = 0, n2z = 0;
      if (i > 0) { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; n1x = -dz / l; n1z = dx / l; }
      if (i < n - 1) { const dx = c[0] - b[0], dz = c[1] - b[1], l = Math.hypot(dx, dz) || 1; n2x = -dz / l; n2z = dx / l; }
      if (i === 0) { n1x = n2x; n1z = n2z; } if (i === n - 1) { n2x = n1x; n2z = n1z; }
      let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      const cos = Math.max(0.5, mx * n1x + mz * n1z);
      out.push([b[0] + mx * off / cos, b[1] + mz * off / cos]);
    }
    // trim along the line
    const cut = (line, d) => {
      let rem = d;
      while (line.length > 1) {
        const a = line[0], b = line[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (l > rem) { const t = rem / l; line[0] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; return line; }
        rem -= l; line.shift();
      }
      return line.length > 1 ? line : null;
    };
    let line = cut(out, trim0); if (!line) return null;
    line.reverse(); line = cut(line, trim1); if (!line) return null; line.reverse();
    return line;
  };
  const half = (ci) => roads[chains[ci].road].width / 2;
  const sideWidth = (ci) => SIDEWALK[roads[chains[ci].road].kind] ?? 0;
  // trim at each chain end: clear of the widest other street at that junction
  for (const [, e] of ends) {
    const deg = e.list.length;
    for (const m of e.list) {
      let t = 0;
      if (deg >= 3 || (deg === 2 && Math.abs(Math.cos(e.list[0].angle - e.list[1].angle)) < 0.6)) {
        for (const o of e.list) if (o !== m) t = Math.max(t, half(o.ci) + 0.35);
      }
      (m.at ? (chains[m.ci].trim1 = t) : (chains[m.ci].trim0 = t));
    }
  }
  const sideEnds = new Map(); // `${ci},${side},${at}` → node id
  const stats = { sidewalk: 0, lane: 0 };
  for (let ci = 0; ci < chains.length; ci++) {
    const c = chains[ci], r = roads[c.road], sw = sideWidth(ci);
    // lanes: quiet streets without a sidewalk (service lanes, the narrow La Perla streets), walked along the edge
    const mid = c.pts[Math.floor(c.pts.length / 2)];
    const laneOk = LANE_KINDS.has(r.kind) && r.width >= 2.5 && (r.kind === 'service' ? r.width <= 6 : r.width <= 5.2
      || placeAt(mid[0], mid[1], height(mid[0], mid[1])) === PLACE.perla);
    for (const side of [1, -1]) {
      let built = null, kind = 0, off = 0;
      // the sidewalk's middle, or nearer the kerb where the facades stand close
      for (const share of sw > 0 ? [Math.min(0.5, 0.55 / sw), 0.22] : []) {
        if (built) break;
        off = r.width / 2 + 0.15 + sw * share;
        const line = offsetLine(c.pts, side * off, c.trim0 ?? 0, c.trim1 ?? 0);
        if (line && probeLine(line, TORSO.half + (share > 0.3 ? 0.3 : 0.12)) >= 0.34) {
          let passed = 0, total = 0; const res = [];
          for (let i = 1; i < line.length; i++) {
            if (nearFlight(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], 0.4)) continue;
            const e = emit(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], WALK.SIDEWALK, share > 0.3 ? 0.3 : 0.12,
              -1, { street: true }, c.road);
            passed += e.passed; total += e.len; res.push(...e.links);
          }
          if (total > 0 && passed / total >= 0.4) { built = { line, links: res, cover: passed / total }; kind = WALK.SIDEWALK; stats.sidewalk += passed; }
          else for (const id of res) LK[id] = 0; // too broken to read as a sidewalk: drop, try nearer the kerb or the lane
        }
      }
      // a narrow drawn sidewalk (the old grid's commercial streets): single file just inside the kerb, keeping every
      // clear stretch of 8 m or more even where the side as a whole is broken
      if ((!built || built.cover < 0.9) && sw > 0) {
        const kerbOff = r.width / 2 + 0.42;
        const line = offsetLine(c.pts, side * kerbOff, c.trim0 ?? 0, c.trim1 ?? 0);
        if (line && probeLine(line, TORSO.half + 0.05) >= 0.2) {
          const res = []; let passed = 0;
          for (let i = 1; i < line.length; i++) {
            if (nearFlight(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], 0.4)) continue;
            const e = emit(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], WALK.SIDEWALK, 0.05, -1, { street: true, minRun: 8 }, c.road);
            res.push(...e.links); passed += e.passed;
          }
          if (built) {
            // beside a kept piece of the wider sidewalk this one is not needed
            for (const id of res) {
              const mx = (NX[LA[id]] + NX[LB[id]]) / 2, mz = (NZ[LA[id]] + NZ[LB[id]]) / 2;
              for (const sid of built.links) if (LK[sid] && segDist(mx, mz, NX[LA[sid]], NZ[LA[sid]], NX[LB[sid]], NZ[LB[sid]]) < 2.2) { LK[id] = 0; break; }
            }
          } else if (res.length) { built = { line, links: res, cover: 0.5 }; kind = WALK.SIDEWALK; off = kerbOff; }
          stats.sidewalk += passed;
        }
      }
      // the old grid's narrow streets where the facades stand at the kerb: walk along the kerb in the carriageway's edge
      // (clear of a passing car's flank)
      // (also where this side's sidewalk is broken: only the pieces beside its gaps are kept)
      const kerbEdge = (!built || built.cover < 0.9) && !laneOk && /^(residential|unclassified|living_street)$/.test(r.kind)
        && r.width <= 8 && kerbClearOfLanes(r, c.road, side * (r.width / 2 - 0.38));
      // (on the parked side too: it is traced against the parked cars, so only the gaps between rows remain)
      if (kerbEdge) {
        const kerbOff = r.width / 2 - 0.38;
        const line = offsetLine(c.pts, side * kerbOff, c.trim0 ?? 0, c.trim1 ?? 0);
        if (line && probeLine(line, TORSO.half + 0.1) >= 0.34) {
          const res = []; let passed = 0;
          for (let i = 1; i < line.length; i++) {
            if (nearFlight(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], 0.4)) continue;
            const e = emit(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], WALK.LANE, 0.1, -1, { street: true }, c.road);
            res.push(...e.links); passed += e.passed;
          }
          if (built) {
            // beside a sidewalk piece the kerb edge is not needed
            for (const id of res) {
              const mx = (NX[LA[id]] + NX[LB[id]]) / 2, mz = (NZ[LA[id]] + NZ[LB[id]]) / 2;
              for (const sid of built.links) if (LK[sid] && segDist(mx, mz, NX[LA[sid]], NZ[LA[sid]], NX[LB[sid]], NZ[LB[sid]]) < 2.2) { LK[id] = 0; break; }
            }
          } else if (res.length) { built = { line, links: res, cover: 1 }; kind = WALK.LANE; off = kerbOff; }
          stats.lane += passed;
        }
      }
      if (!built && laneOk) {
        off = Math.max(0, r.width / 2 - 0.6);
        const line = offsetLine(c.pts, side * off, c.trim0 ?? 0, c.trim1 ?? 0);
        if (line && (side > 0 || off > 0.4)) {
          const res = []; let passed = 0;
          for (let i = 1; i < line.length; i++) {
            if (nearFlight(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], 0.4)) continue;
            const e = emit(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], WALK.LANE, 0.3, -1, { street: true }, c.road);
            res.push(...e.links); passed += e.passed;
          }
          if (res.length) { built = { line, links: res }; kind = WALK.LANE; stats.lane += passed; }
        }
      }
      if (!built) continue;
      // the end nodes this side offers its junctions (only where the traced line reaches its trimmed end)
      for (const at of [0, 1]) {
        const p = at ? built.line[built.line.length - 1] : built.line[0];
        const id = nodeGrid.near(p[0], p[1], 0.07, scratch).find((k) => Math.hypot(NX[k] - p[0], NZ[k] - p[1]) < 0.07);
        if (id != null) sideEnds.set(`${ci},${side},${at}`, id);
      }
      void kind;
    }
  }
  // corners and crossings round every junction
  const joinTrace = (a, b, kind, place, opts) => {
    const len = Math.hypot(NX[b] - NX[a], NZ[b] - NZ[a]);
    if (len < 0.25) return 0;
    const width = opts.width ?? (kind === WALK.CROSSING ? 0.45 : 0.25);
    const r = trace(NX[a], NZ[a], NX[b], NZ[b], NY[a], { half: TORSO.half + width, minRun: 0, ...opts });
    if (r.runs.length !== 1 || r.runs[0].i0 !== 0 || r.runs[0].i1 !== r.n || Math.abs(r.runs[0].heights[r.runs[0].heights.length - 1] - NY[b]) > 0.45) return 0;
    SRC = 2; return link(a, b, kind, width, place, r.runs[0].heights) >= 0 ? 1 : 0;
  };
  let corners = 0, crossings = 0;
  // a node at the pavement corner between two side ends round junction e: out along their bisector, clear of every
  // carriageway, with both straight legs clear too (−1 if none)
  const cornerNode = (a, b, e) => {
    const ax = NX[a] - e.x, az = NZ[a] - e.z, bx = NX[b] - e.x, bz = NZ[b] - e.z;
    const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
    let ux = ax / la + bx / lb, uz = az / la + bz / lb; const lu = Math.hypot(ux, uz);
    if (lu < 0.2) return -1;
    ux /= lu; uz /= lu;
    for (let t = Math.min(la, lb); t <= Math.max(la, lb) * 2.5; t += 0.4) {
      const x = e.x + ux * t, z = e.z + uz * t;
      if (inCarriage(x, z, -0.3) || !isDry(x, z)) continue;
      if (chordInCarriage(NX[a], NZ[a], x, z, 0.45) || chordInCarriage(x, z, NX[b], NZ[b], 0.45)) continue;
      const g = sampler.cityGround(x, z, probe, Math.max(NY[a], NY[b]) + 0.5);
      if (g.water || !Number.isFinite(g.height) || Math.abs(g.height - NY[a]) > 0.6 || closedAt(x, z, g.height)) continue;
      return node(x, z, g.height);
    }
    return -1;
  };
  for (const [, e] of ends) {
    if (e.list.length < 2) continue;
    const pts = [];
    for (const m of e.list) for (const side of [1, -1]) {
      const id = sideEnds.get(`${m.ci},${side},${m.at}`);
      if (id == null) continue;
      pts.push({ id, ci: m.ci, side, angle: Math.atan2(NZ[id] - e.z, NX[id] - e.x) });
    }
    if (pts.length < 2) continue;
    pts.sort((a, b) => a.angle - b.angle);
    const junction = e.list.length >= 3 || (e.list.length === 2 && Math.abs(Math.cos(e.list[0].angle - e.list[1].angle)) < 0.6);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if (p === q || p.id === q.id) continue;
      const place = placeAt((NX[p.id] + NX[q.id]) / 2, (NZ[p.id] + NZ[q.id]) / 2, NY[p.id], chains[p.ci].road);
      if (p.ci !== q.ci) {
        // round the corner on the pavement; a straight chord that cuts into the carriageway goes via the corner itself,
        // or, where there is no pavement round it, it is a crossing (people look for cars)
        // (between two lanes, which are walked in the street's edge, the corner is lane too)
        const laneEnd = inCarriage(NX[p.id], NZ[p.id], 0.45) || inCarriage(NX[q.id], NZ[q.id], 0.45);
        if (laneEnd) { if (joinTrace(p.id, q.id, WALK.LANE, place, { street: true, width: 0.1 })) corners++; else dropped.corner++; }
        else if (!chordInCarriage(NX[p.id], NZ[p.id], NX[q.id], NZ[q.id], 0.45)) {
          if (joinTrace(p.id, q.id, WALK.SIDEWALK, place, { street: true })) corners++; else dropped.corner++;
        } else {
          const m = cornerNode(p.id, q.id, e);
          if (m >= 0 && joinTrace(p.id, m, WALK.SIDEWALK, place, { street: true, width: 0.1 }) && joinTrace(m, q.id, WALK.SIDEWALK, place, { street: true, width: 0.1 })) corners++;
          else if (joinTrace(p.id, q.id, WALK.CROSSING, place, { street: true })) { crossings++; dropped.cornerToCrossing = (dropped.cornerToCrossing ?? 0) + 1; }
          else dropped.corner++;
        }
      }
      else if (junction && pts.length >= 3) {
        const r = roads[chains[p.ci].road];
        if (!/^(primary|secondary)$/.test(r.kind) || r.width <= 10) {
          if (joinTrace(p.id, q.id, WALK.CROSSING, place, { street: true })) crossings++; else dropped.crossing++;
        }
      }
    }
  }

  globalThis.__walkTrace?.('2. footways', performance.now() - t0);
  // ---- 2. footways, pedestrian streets, mapped steps, authored promenades ----
  const supersededWays = new Set();
  const areaList = Object.keys(world).map((k) => world[k]).filter((a) => a && typeof a === 'object' && !Array.isArray(a));
  for (const a of areaList) for (const id of a.supersededWays ?? []) supersededWays.add(id);
  const authored = [];
  if (world.gate?.path?.length) authored.push({ points: world.gate.path, name: 'Paseo del Morro', place: PLACE.morro });
  if (world.princesa?.path?.length) authored.push({ points: world.princesa.path, name: 'Paseo de la Princesa', place: PLACE.princesa });
  for (const a of areaList) for (const l of a.routeLines ?? []) if (l.points?.length >= 2) authored.push({ points: l.points, name: l.name, place: -1 });
  if (world.gate?.passage && world.gate.frame) {
    // through the gate on one side, single file: the rest of the bore stays a clear riding line
    const g = world.gate; authored.push({ points: [g.frame.P(g.passage.uOut - 4.5, -0.6), g.frame.P(g.passage.uIn + 4, -0.6)], name: 'Puerta de San Juan', place: PLACE.morro, width: 0.05, pinch: true });
  }
  // the gate bore, mouth to mouth: only the single-file line walks it
  const bore = (() => {
    const g = world.gate; if (!g?.passage || !g.frame) return () => false;
    const o = g.frame.P(0, 0), e = g.frame.P(1, 0), ux = e[0] - o[0], uz = e[1] - o[1], l = Math.hypot(ux, uz) || 1;
    const u0 = g.passage.uOut, u1 = g.passage.uIn;
    return (x, z) => { const rx = x - o[0], rz = z - o[1], u = (rx * ux + rz * uz) / l / l, v = (-rx * uz + rz * ux) / l; return u > Math.min(u0, u1) && u < Math.max(u0, u1) && Math.abs(v) < 2.6; };
  })();
  const mappedPromenade = (r) => PROMENADE_NAMES.test(r.name || '') && (/Morro/.test(r.name) ? !!world.gate?.path : !!world.princesa?.path);
  let footLen = 0;
  const pinchLinks = new Set(); // links where nobody stops (a gate bore)
  for (let ri = 0; ri < roads.length; ri++) {
    const r = roads[ri];
    if (!FOOT.has(r.kind) || supersededWays.has(r.id) || mappedPromenade(r)) continue;
    const kind = PROMENADE_NAMES.test(r.name || '') ? WALK.PROMENADE : WALK.FOOTWAY;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i];
      if (nearFlight(a[0], a[1], b[0], b[1], 0.6)) { dropped.stair++; continue; }
      if (bore(a[0], a[1]) || bore(b[0], b[1]) || bore((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) continue;
      if (inPlaza((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) && inPlaza(a[0], a[1]) && inPlaza(b[0], b[1])) continue; // the lattice walks it
      const e = emit(a[0], a[1], b[0], b[1], kind, Math.max(0.15, Math.min(0.5, r.width / 2 - 0.45)), -1, {}, ri);
      footLen += e.passed;
    }
  }
  for (const l of authored) {
    for (let i = 1; i < l.points.length; i++) {
      const a = l.points[i - 1], b = l.points[i];
      if (nearFlight(a[0], a[1], b[0], b[1], 0.6)) continue;
      // (where an authored walk runs into a street's carriageway it stops there: the joins make that a crossing)
      // (the gate's own line runs through the mapped service way in the bore: that is the gate, not a street)
      const e = emit(a[0], a[1], b[0], b[1], WALK.PROMENADE, l.width ?? 0.9, l.place, l.pinch ? { carriageOk: true } : { street: true }, -2);
      if (l.pinch) for (const id of e.links) pinchLinks.add(id);
      footLen += e.passed;
    }
  }

  globalThis.__walkTrace?.('3. plaza lat', performance.now() - t0);
  // ---- 3. plaza lattices ----
  const LAT = 3;
  let plazaNodes = 0;
  const plazaOf = [];
  for (const p of [...plazaRings, { ring: RAICES, place: PLACE.raices, name: 'Raíces' }]) {
    const [x0, x1, z0, z1] = p.box ?? ringBox(p.ring);
    const cols = Math.floor((x1 - x0) / LAT), rows = Math.floor((z1 - z0) / LAT);
    if (cols < 1 || rows < 1) continue;
    const ox = x0 + (x1 - x0 - cols * LAT) / 2, oz = z0 + (z1 - z0 - rows * LAT) / 2;
    const id = new Int32Array((cols + 1) * (rows + 1)).fill(-1);
    const nodeBody = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0.4, halfLengthMetres: 0.4, minY: 0, maxY: 0 };
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
      const x = ox + i * LAT, z = oz + j * LAT;
      if (!inRing(x, z, p.ring) || x > east || !isDry(x, z)) continue;
      // inset from the square's edge
      let near = false;
      for (let k = 0, m = p.ring.length - 1; k < p.ring.length && !near; m = k++) {
        const a = p.ring[m], b = p.ring[k];
        if (segDist(x, z, a[0], a[1], b[0], b[1]) < 0.7) near = true;
      }
      if (near) continue;
      const g = sampler.cityGround(x, z, probe, height(x, z) + 0.35);
      if (g.water || closedAt(x, z, g.height) || inCarriage(x, z, 0.3) || lowCeiling(g, x, z)) continue;
      nodeBody.x = x; nodeBody.z = z; nodeBody.minY = g.height + TORSO.low; nodeBody.maxY = g.height + TORSO.high;
      if (!solidsClear(nodeBody)) continue;
      id[i * (rows + 1) + j] = node(x, z, g.height, 0.3);
      plazaNodes++;
    }
    const place = p.place;
    const at = (i, j) => (i < 0 || j < 0 || i > cols || j > rows ? -1 : id[i * (rows + 1) + j]);
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
      const a = at(i, j); if (a < 0) continue;
      for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const b = at(i + di, j + dj); if (b < 0) continue;
        if (Math.abs(NY[a] - NY[b]) > 0.9) continue;
        if (di && dj && ((i + j) & 1)) continue; // half the diagonals: enough to round obstacles
        // the ends are checked lattice nodes: sample the middle only, then one torso box (wide, else narrow)
        const mx = (NX[a] + NX[b]) / 2, mz = (NZ[a] + NZ[b]) / 2;
        if (!isDry(mx, mz)) continue;
        const g = sampler.cityGround(mx, mz, probe, Math.max(NY[a], NY[b]) + 0.5);
        if (g.water || Math.abs(g.height - NY[a]) > 0.2 * (di && dj ? 1.42 : 1) * LAT / 2 + 0.1 || Math.abs(g.height - NY[b]) > 0.2 * (di && dj ? 1.42 : 1) * LAT / 2 + 0.1
          || closedAt(mx, mz, g.height) || lowCeiling(g, mx, mz)) continue;
        let width = 0.55;
        if (!boxClear(NX[a], NZ[a], NY[a], NX[b], NZ[b], NY[b], g.height, TORSO.half + width)) {
          width = 0.1;
          if (!boxClear(NX[a], NZ[a], NY[a], NX[b], NZ[b], NY[b], g.height, TORSO.half + width)) continue;
        }
        const l = link(a, b, WALK.PLAZA, width, place, Float32Array.of(NY[a], g.height, NY[b])); plazaOf.push(l);
      }
    }
  }

  globalThis.__walkTrace?.('4. stairs', performance.now() - t0);
  // ---- 4. stairs: lanes up each public flight, from landing to landing ----
  let stairLinks = 0;
  flights.forEach((f, fi) => {
    if (!(f.n > 0) && !f.drape) return;
    const width = f.u1 - f.u0;
    const lanes = width > 3.2 ? [0.3, 0.7] : width > 1.2 ? [0.5] : [];
    const laneWidth = Math.min(0.6, width * 0.15);
    for (const k of lanes) {
      const u = f.u0 + width * k;
      const P = (s) => [f.ox + f.cx * u + f.ex * s, f.oz + f.cz * u + f.ez * s];
      // the lane must be clear for a walking torso over the drawn treads, landings included (a door or a cheek ends it)
      const clearPiece = (sa, sb) => {
        const [xa, za] = P(sa), [xb, zb] = P(sb);
        let lo = Infinity, hi = -Infinity;
        for (let q = 0; q <= 4; q++) { const y = stairDrawnHeight(f, u, sa + (sb - sa) * q / 4); lo = Math.min(lo, y); hi = Math.max(hi, y); }
        body.x = (xa + xb) / 2; body.z = (za + zb) / 2; body.headingY = Math.atan2(xb - xa, zb - za);
        body.floorPlane = null; body.halfWidthMetres = TORSO.half + laneWidth; body.halfLengthMetres = Math.abs(sb - sa) / 2 + TORSO.reach;
        body.minY = hi + TORSO.low; body.maxY = lo + TORSO.high;
        return body.maxY > body.minY + 0.5 && sampler.isVolumeClear(body);
      };
      let s0 = f.footS - 0.7, s1 = f.topS + 0.7, ok = true;
      while (s0 < f.footS && !clearPiece(s0, f.footS)) s0 += 0.35;
      while (s1 > f.topS && !clearPiece(f.topS, s1)) s1 -= 0.35;
      for (let sa = f.footS; sa < f.topS && ok; sa += 1) ok = clearPiece(sa, Math.min(f.topS, sa + 1));
      if (!ok || s0 >= f.footS || s1 <= f.topS) { dropped.stair++; continue; }
      const n = Math.max(2, Math.ceil((s1 - s0) / 0.25));
      const heights = new Float32Array(n + 1);
      for (let i = 0; i <= n; i++) heights[i] = stairDrawnHeight(f, u, s0 + (s1 - s0) * i / n);
      const [ax, az] = P(s0), [bx, bz] = P(s1);
      if (!isDry(ax, az) || !isDry(bx, bz) || closedAt(ax, az, heights[0]) || closedAt(bx, bz, heights[n])) { dropped.stair++; continue; }
      const a = node(ax, az, heights[0], 0.05), b = node(bx, bz, heights[n], 0.05);
      if (link(a, b, WALK.STAIR, laneWidth, placeAt((ax + bx) / 2, (az + bz) / 2, heights[0]), heights, fi) >= 0) stairLinks++;
    }
  });

  globalThis.__walkTrace?.('5. joins', performance.now() - t0);
  // ---- 5. joins: loose ends to the nearest walk, split where they meet it ----
  const linkGrid = grid(8);
  const indexLink = (l) => { const a = LA[l], b = LB[l]; linkGrid.add(Math.min(NX[a], NX[b]), Math.max(NX[a], NX[b]), Math.min(NZ[a], NZ[b]), Math.max(NZ[a], NZ[b]), l); };
  for (let l = 0; l < LA.length; l++) if (LK[l]) indexLink(l);
  const degree = () => { const d = new Int32Array(NX.length); for (let l = 0; l < LA.length; l++) if (LK[l]) { d[LA[l]]++; d[LB[l]]++; } return d; };
  // split link l at fraction t; returns the new node
  const split = (l, t) => {
    const a = LA[l], b = LB[l], prof = LPROF[l], m = prof.length - 1;
    const k = Math.max(1, Math.min(m - 1, Math.round(t * m)));
    if (m < 2) return t < 0.5 ? a : b;
    const tt = k / m, x = NX[a] + (NX[b] - NX[a]) * tt, z = NZ[a] + (NZ[b] - NZ[a]) * tt;
    const c = node(x, z, prof[k], 0.02);
    LB[l] = c; LPROF[l] = prof.slice(0, k + 1);
    SRC = 3; const l2 = link(c, b, LK[l], LW[l], LP[l], prof.slice(k), LSTAIR[l], LROAD[l]);
    if (pinchLinks.has(l)) pinchLinks.add(l2);
    indexLink(l2);
    return c;
  };
  const near = [];
  const alias = new Map(); // node → the node it was merged into
  const root = (n0) => { while (alias.has(n0)) n0 = alias.get(n0); return n0; };
  let joins = 0;
  const tryJoin = (n0, maxD, kindHint, maxStep = LAYER_STEP) => {
    const x = NX[n0], z = NZ[n0], y = NY[n0];
    let best = null;
    for (const l of linkGrid.near(x, z, maxD, near)) {
      if (!(LK[l] > 0) || LK[l] === WALK.STAIR || LA[l] === n0 || LB[l] === n0) continue;
      const a = LA[l], b = LB[l];
      const dx = NX[b] - NX[a], dz = NZ[b] - NZ[a], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - NX[a]) * dx + (z - NZ[a]) * dz) / l2));
      const px = NX[a] + dx * t, pz = NZ[a] + dz * t, d = Math.hypot(px - x, pz - z);
      const prof = LPROF[l], py = prof[Math.round(t * (prof.length - 1))];
      if (d > maxD || Math.abs(py - y) > 0.6 + d * 0.15) continue;
      if (!best || d < best.d) best = { l, t, d };
    }
    if (!best) { globalThis.__walkJoin?.(x, z, 'none'); return false; }
    const end = best.t < 0.02 ? LA[best.l] : best.t > 0.98 ? LB[best.l] : null;
    const target = end ?? split(best.l, best.t);
    if (target === n0) return false;
    if (Math.hypot(NX[target] - x, NZ[target] - z) < 0.3) { // the same place
      const ra = root(n0), rb = root(target); if (ra !== rb) alias.set(ra, rb); joins++; return true;
    }
    const crossing = chordInCarriage(x, z, NX[target], NZ[target], 0.4);
    const r = trace(x, z, NX[target], NZ[target], y, { carriageOk: true, half: TORSO.half + 0.2, minRun: 0, maxStep });
    if (r.runs.length === 1 && r.runs[0].i0 === 0 && r.runs[0].i1 === r.n) {
      SRC = 4; const l = link(n0, target, crossing ? WALK.CROSSING : kindHint, 0.2, -1, r.runs[0].heights); indexLink(l); joins++; return true;
    }
    dropped.join++;
    globalThis.__walkJoin?.(x, z, 'trace', r.cause, LK[best.l], best.d);
    return false;
  };
  {
    const d = degree();
    for (let n0 = 0; n0 < d.length; n0++) if (d[n0] === 1) tryJoin(n0, 4.5, WALK.JOIN);
    // stair landings and plaza rims reach a little further
    const d2 = degree();
    for (let l = 0; l < LA.length; l++) if (LK[l] === WALK.STAIR) for (const n0 of [LA[l], LB[l]]) if (d2[n0] <= 1 && tryJoin(n0, 6, WALK.JOIN, 0.55)) d2[n0]++;
  }
  {
    // plaza rim nodes meet the sidewalks and footways round the square (one join every ~6 m of rim)
    const d = degree(), done = [];
    // nodes whose links are all lattice links, with fewer than the full eight neighbours (the rim of a square)
    const plazaOnly = new Int8Array(NX.length);
    for (let l = 0; l < LA.length; l++) if (LK[l] > 0) for (const n0 of [LA[l], LB[l]]) plazaOnly[n0] = LK[l] === WALK.PLAZA ? (plazaOnly[n0] === -1 ? -1 : 1) : -1;
    for (let n0 = 0; n0 < NX.length; n0++) {
      if (plazaOnly[n0] !== 1 || d[n0] === 0 || d[n0] > 5) continue;
      if (done.some(([x, z]) => Math.hypot(x - NX[n0], z - NZ[n0]) < 6)) continue;
      let hasNonPlaza = false;
      for (const l of linkGrid.near(NX[n0], NZ[n0], 3.6, near)) if (LK[l] && LK[l] !== WALK.PLAZA) { hasNonPlaza = true; break; }
      if (!hasNonPlaza) continue;
      // join only to non-plaza walks
      const saved = [];
      for (const l of linkGrid.near(NX[n0], NZ[n0], 3.6, near)) if (LK[l] === WALK.PLAZA) { saved.push(l); LK[l] = -LK[l]; }
      if (tryJoin(n0, 3.6, WALK.JOIN)) done.push([NX[n0], NZ[n0]]);
      for (const l of saved) LK[l] = -LK[l];
    }
  }

  globalThis.__walkTrace?.('6. pack', performance.now() - t0);
  // ---- 6. pack: drop dead links and small islands ----
  // a link whose end was merged into a nearby node no longer runs where it was traced: trace it again (or drop it)
  for (let l = 0; l < LA.length; l++) {
    const a = root(LA[l]), b = root(LB[l]);
    if (a === LA[l] && b === LB[l]) continue;
    LA[l] = a; LB[l] = b;
    if (!(LK[l] > 0) || a === b || LK[l] === WALK.STAIR) continue;
    const r = trace(NX[a], NZ[a], NX[b], NZ[b], NY[a], { carriageOk: true, half: TORSO.half + LW[l], minRun: 0, maxStep: 0.45 });
    if (r.runs.length === 1 && r.runs[0].i0 === 0 && r.runs[0].i1 === r.n) LPROF[l] = r.runs[0].heights;
    else { LK[l] = 0; dropped.moved++; }
  }
  const reservedBoxes = RESERVED.map(ringBox);
  const reserved = (x, z) => {
    for (let r = 0; r < RESERVED.length; r++) {
      const b = reservedBoxes[r];
      if (x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && inRing(x, z, RESERVED[r])) return true;
    }
    return false;
  };
  // the full width people take, not only the centre line: each side of a walk (feet included) must be dry, public,
  // outside the reserves and on the same surface (no other layer, no scarp edge); else the walk is single file
  {
    const edge = (x, z, y) => {
      if (!isDry(x, z) || reserved(x, z)) return NaN;
      const g = sampler.cityGround(x, z, probe, y + 0.5);
      return !g.water && Number.isFinite(g.height) && Math.abs(g.height - y) < 0.2 && !closedAt(x, z, g.height) ? g.height : NaN;
    };
    let narrowed = 0, refit = 0, ledges = 0;
    for (let l = 0; l < LA.length; l++) {
      if (!(LK[l] > 0) || LK[l] === WALK.STAIR || LK[l] === WALK.PLAZA || LA[l] === LB[l]) continue;
      // the centre line between its stations: a short crossing or join over a drop goes; a longer walk whose profile
      // misses the surface between stations is measured again every metre
      {
        const a = LA[l], b = LB[l], prof = LPROF[l], m = prof.length - 1, len = Math.hypot(NX[b] - NX[a], NZ[b] - NZ[a]);
        let worst = 0;
        for (let q = 1, n = Math.max(2, Math.ceil(len / 2)); q < n; q++) {
          const t = q / n, x = NX[a] + (NX[b] - NX[a]) * t, z = NZ[a] + (NZ[b] - NZ[a]) * t, f = t * m, j = Math.min(m - 1, Math.floor(f));
          const y = m > 0 ? prof[j] + (prof[j + 1] - prof[j]) * (f - j) : prof[0];
          const g = sampler.cityGround(x, z, probe, y + 0.5);
          worst = Math.max(worst, Number.isFinite(g.height) ? Math.abs(g.height - y) : 9);
        }
        if (worst > 0.12) {
          if (len < 4 || LK[l] === WALK.CROSSING || LK[l] === WALK.JOIN || worst > 0.6) { LK[l] = 0; ledges++; continue; }
          const n = Math.max(2, Math.ceil(len)), np = new Float32Array(n + 1);
          let ok = true;
          for (let q = 0; q <= n && ok; q++) {
            const t = q / n, x = NX[a] + (NX[b] - NX[a]) * t, z = NZ[a] + (NZ[b] - NZ[a]) * t, f = t * m, j = Math.min(m - 1, Math.floor(f));
            const y = m > 0 ? prof[j] + (prof[j + 1] - prof[j]) * (f - j) : prof[0];
            const g = sampler.cityGround(x, z, probe, y + 0.5);
            ok = Number.isFinite(g.height) && Math.abs(g.height - y) < 0.6; np[q] = g.height;
          }
          if (!ok) { LK[l] = 0; ledges++; continue; }
          np[0] = prof[0]; np[n] = prof[m]; LPROF[l] = np; refit++;
        }
      }
      if (LW[l] < 0.2) continue;
      const a = LA[l], b = LB[l], prof = LPROF[l], m = prof.length - 1;
      const dx = NX[b] - NX[a], dz = NZ[b] - NZ[a], len = Math.hypot(dx, dz) || 1, rx = -dz / len, rz = dx / len;
      // (near both ends, where a walk meets a ledge or a scarp, and every 4 m between)
      const off = LW[l] + 0.15, n = Math.max(2, Math.ceil(len / 4) + 1);
      let ok = true, cross = 0;
      for (let q = 0; q < n && ok; q++) {
        const t = Math.min(len - 0.3, Math.max(0.3, len * q / (n - 1))) / len, x = NX[a] + dx * t, z = NZ[a] + dz * t, y = prof[Math.round(t * m)];
        const hr = edge(x + rx * off, z + rz * off, y), hl = edge(x - rx * off, z - rz * off, y);
        ok = hr === hr && hl === hl; // (not NaN)
        if (ok) cross += (hr - hl) / (2 * off) / n;
      }
      if (!ok) { LW[l] = 0.05; narrowed++; } else LC[l] = Math.max(-0.35, Math.min(0.35, cross));
    }
    dropped.narrowed = narrowed; dropped.ledge = ledges; dropped.refit = refit;
  }
  let L = 0; const keep = new Int32Array(LA.length).fill(-1);
  const adj = Array.from({ length: NX.length }, () => []);
  for (let l = 0; l < LA.length; l++) if (LK[l] > 0 && LA[l] !== LB[l]) { adj[LA[l]].push(l); adj[LB[l]].push(l); }
  const comp = new Int32Array(NX.length).fill(-1), compLen = [];
  for (let s = 0; s < NX.length; s++) {
    if (comp[s] >= 0 || !adj[s].length) continue;
    const c = compLen.length; let len = 0, count = 0; const stack = [s]; comp[s] = c;
    while (stack.length) {
      const n0 = stack.pop(); count++;
      for (const l of adj[n0]) { const o = LA[l] === n0 ? LB[l] : LA[l]; if (comp[o] < 0) { comp[o] = c; stack.push(o); len += Math.hypot(NX[o] - NX[n0], NZ[o] - NZ[n0]); } }
    }
    compLen.push(len >= 25 ? len : -len); // (a long straight piece of sidewalk is one link or two: length decides)
  }
  const nodeMap = new Int32Array(NX.length).fill(-1); let N = 0;
  for (let l = 0; l < LA.length; l++) {
    if (!(LK[l] > 0) || LA[l] === LB[l]) continue;
    if (compLen[comp[LA[l]]] < 0) { dropped.island++; continue; }
    const a = LA[l], b = LB[l];
    if (reserved(NX[a], NZ[a]) || reserved(NX[b], NZ[b]) || reserved((NX[a] + NX[b]) / 2, (NZ[a] + NZ[b]) / 2)) { dropped.reserve++; continue; }
    if (!pinchLinks.has(l) && (bore(NX[a], NZ[a]) || bore(NX[b], NZ[b]) || bore((NX[a] + NX[b]) / 2, (NZ[a] + NZ[b]) / 2))) { dropped.bore = (dropped.bore ?? 0) + 1; continue; }
    keep[l] = L++;
    for (const n0 of [LA[l], LB[l]]) if (nodeMap[n0] < 0) nodeMap[n0] = N++;
  }
  const net = {
    nodes: N, links: L,
    nx: new Float32Array(N), nz: new Float32Array(N), ny: new Float32Array(N),
    a: new Int32Array(L), b: new Int32Array(L), kind: new Uint8Array(L), width: new Float32Array(L), place: new Uint8Array(L),
    len: new Float32Array(L), dirX: new Float32Array(L), dirZ: new Float32Array(L),
    profStart: new Int32Array(L), profCount: new Uint16Array(L), stair: new Int16Array(L), road: new Int32Array(L),
    lit: new Uint8Array(L), shade: new Uint8Array(L), cross: new Float32Array(L), pinch: new Uint8Array(L),
    adjStart: new Int32Array(N + 1), adjLink: null, prof: null, flights,
  };
  for (let n0 = 0; n0 < NX.length; n0++) if (nodeMap[n0] >= 0) { const m = nodeMap[n0]; net.nx[m] = NX[n0]; net.nz[m] = NZ[n0]; net.ny[m] = NY[n0]; }
  let profTotal = 0;
  for (let l = 0; l < LA.length; l++) if (keep[l] >= 0) profTotal += LPROF[l].length;
  net.prof = new Float32Array(profTotal);
  const counts = {}; let p0 = 0;
  for (let l = 0; l < LA.length; l++) {
    const k = keep[l]; if (k < 0) continue;
    const a = nodeMap[LA[l]], b = nodeMap[LB[l]];
    net.a[k] = a; net.b[k] = b; net.kind[k] = LK[l]; net.width[k] = LW[l];
    const dx = net.nx[b] - net.nx[a], dz = net.nz[b] - net.nz[a], len = Math.hypot(dx, dz) || 1e-3;
    net.len[k] = len; net.dirX[k] = dx / len; net.dirZ[k] = dz / len;
    const prof = LPROF[l]; net.prof.set(prof, p0); net.profStart[k] = p0; net.profCount[k] = prof.length; p0 += prof.length;
    // node heights are the profile ends (the walking surface at the node)
    net.stair[k] = LSTAIR[l]; net.road[k] = LROAD[l]; net.cross[k] = LC[l]; net.pinch[k] = pinchLinks.has(l) ? 1 : 0; (net.src ??= new Uint8Array(L))[k] = LS[l];
    const mx = (net.nx[a] + net.nx[b]) / 2, mz = (net.nz[a] + net.nz[b]) / 2;
    net.place[k] = LP[l] >= 0 ? LP[l] : placeAt(mx, mz, prof[0], LROAD[l]);
    const name = WALK_NAMES[LK[l]]; counts[name] = counts[name] ?? { links: 0, metres: 0 }; counts[name].links++; counts[name].metres += len;
  }
  // adjacency (CSR)
  const deg = new Int32Array(N);
  for (let k = 0; k < L; k++) { deg[net.a[k]]++; deg[net.b[k]]++; }
  for (let n0 = 0; n0 < N; n0++) net.adjStart[n0 + 1] = net.adjStart[n0] + deg[n0];
  net.adjLink = new Int32Array(net.adjStart[N]);
  const fill = net.adjStart.slice(0, N);
  for (let k = 0; k < L; k++) { net.adjLink[fill[net.a[k]]++] = k; net.adjLink[fill[net.b[k]]++] = k; }
  for (const c of Object.values(counts)) c.metres = Math.round(c.metres);
  // pinch points: the gate bore, the stairs and the walks that meet a stair's ends (nobody stops or gathers there)
  for (let k = 0; k < L; k++) {
    if (net.kind[k] !== WALK.STAIR) continue;
    net.pinch[k] = 1;
    for (const n0 of [net.a[k], net.b[k]]) for (let j = net.adjStart[n0]; j < net.adjStart[n0 + 1]; j++) net.pinch[net.adjLink[j]] = 1;
  }

  globalThis.__walkTrace?.('7. after-boo', performance.now() - t0);
  // ---- 7. after-boot records: seats, look points, lamps, shade ----
  packRecords(world, net, placeAt);
  // seats and look points reach the walk from their nearest node on a checked straight line
  {
    const g = grid(6);
    for (let n0 = 0; n0 < N; n0++) g.add(net.nx[n0], net.nx[n0], net.nz[n0], net.nz[n0], n0);
    net.seatNode = new Int32Array(net.seatCount).fill(-1);
    for (let i = 0; i < net.seatCount; i++) {
      const o = i * 5, h = net.seats[o + 3], gy = net.seats[o + 4];
      const fx = net.seats[o] + Math.sin(h) * 0.55, fz = net.seats[o + 1] + Math.cos(h) * 0.55;
      let best = -1, bestD = 7;
      for (const n0 of g.near(fx, fz, 7, near)) {
        const d = Math.hypot(net.nx[n0] - fx, net.nz[n0] - fz);
        if (d >= bestD || Math.abs(net.ny[n0] - gy) > 0.5) continue;
        if (d > 0.3) {
          const r = trace(net.nx[n0], net.nz[n0], fx, fz, net.ny[n0], { carriageOk: true, half: 0.2, minRun: 0 });
          if (r.runs.length !== 1 || r.runs[0].i0 !== 0 || r.runs[0].i1 !== r.n) continue;
        }
        best = n0; bestD = d;
      }
      net.seatNode[i] = best;
    }
    const looks = [];
    net.lookStart = new Int32Array(net.lookCount + 1);
    for (let i = 0; i < net.lookCount; i++) {
      const x = net.looks[i * 3], z = net.looks[i * 3 + 1], r = net.looks[i * 3 + 2], c = [];
      for (const n0 of g.near(x, z, r + 4.5, near)) { const d = Math.hypot(net.nx[n0] - x, net.nz[n0] - z); if (d > r + 0.6 && d < r + 4.5) c.push(n0); }
      c.sort((a, b) => a - b);
      for (let k = 0; k < c.length && k < 16; k += Math.max(1, Math.floor(c.length / 16))) looks.push(c[k]);
      net.lookStart[i + 1] = looks.length;
    }
    net.lookNodes = Int32Array.from(looks);
  }
  // attach(x, z, y): the nearest node reached on a checked straight line (≤ 7 m) or −1. Build-time only: the caller
  // deletes it once its own records are placed (it holds the construction arrays).
  net.attach = (x, z, y) => {
    let best = -1, bestD = 7;
    for (let n0 = 0; n0 < N; n0++) {
      const d = Math.hypot(net.nx[n0] - x, net.nz[n0] - z);
      if (d >= bestD || Math.abs(net.ny[n0] - y) > 0.5) continue;
      if (d > 0.3) {
        const r = trace(net.nx[n0], net.nz[n0], x, z, net.ny[n0], { carriageOk: true, half: 0.2, minRun: 0 });
        if (r.runs.length !== 1 || r.runs[0].i0 !== 0 || r.runs[0].i1 !== r.n) continue;
      }
      best = n0; bestD = d;
    }
    return best;
  };
  net.stats = {
    nodes: N, links: L, byKind: counts, dropped, droppedMetres: Object.fromEntries(Object.entries(droppedMetres).map(([k, v]) => [k, Math.round(v)])),
    corners, crossings, joins, stairLinks, plazaNodes, sidewalkMetres: Math.round(stats.sidewalk), laneMetres: Math.round(stats.lane),
    footMetres: Math.round(footLen), components: compLen.filter((c) => c > 0).length, ms: Math.round(performance.now() - t0)
  };
  return net;
}

// Seats (benches the people may sit on), look points (fountains to stop at), lamps (blue hour gathers people near
// them) and shade (trees), packed into typed arrays. Construction records are released right after boot.
function packRecords(world, net, placeAt) {
  const benches = [];
  const seen = new Set();
  const addBench = (b) => {
    if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.z) || !Number.isFinite(b.heading)) return;
    const k = `${Math.round(b.x * 10)},${Math.round(b.z * 10)}`; if (seen.has(k)) return; seen.add(k);
    benches.push(b);
  };
  for (const b of world.plaza?.benches ?? []) addBench(b);
  for (const k of Object.keys(world)) {
    const a = world[k]; if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
    for (const b of a.benches ?? []) addBench(b);
    for (const b of a.plaza?.benches ?? []) addBench(b);
  }
  // two seats per bench, facing the bench heading, ~0.53 m above its ground
  const seats = [];
  for (const b of benches) {
    const c = Math.cos(b.heading), s = Math.sin(b.heading), y = Number.isFinite(b.y) ? b.y : world.height(b.x, b.z);
    for (const u of [-0.45, 0.45]) {
      const x = b.x + c * u + s * -0.02, z = b.z - s * u + c * -0.02;
      seats.push(x, z, y + 0.53, b.heading, y);
    }
  }
  net.seats = Float32Array.from(seats); net.seatCount = seats.length / 5;
  net.seatPlace = new Uint8Array(net.seatCount);
  for (let i = 0; i < net.seatCount; i++) net.seatPlace[i] = placeAt(net.seats[i * 5], net.seats[i * 5 + 1], net.seats[i * 5 + 4]);
  // fountains people stop at
  const looks = [];
  const look = (x, z, r) => { if (Number.isFinite(x) && Number.isFinite(z)) looks.push(x, z, r); };
  if (world.plaza?.fountain) look(world.plaza.fountain.x, world.plaza.fountain.z, world.plaza.fountain.radius);
  if (world.princesa?.fountain) look(world.princesa.fountain.x, world.princesa.fountain.z, world.princesa.fountain.stepRadius ?? world.princesa.fountain.radius);
  if (world.bahia?.fountain) look(world.bahia.fountain.x, world.bahia.fountain.z, 3.5);
  const q = world.norzagaray?.quinto?.fountain; if (q && Number.isFinite(q.x)) look(q.x, q.z, q.radius ?? 4.6);
  net.looks = Float32Array.from(looks); net.lookCount = looks.length / 3;
  // lamps
  const lamps = [];
  for (const k of Object.keys(world)) {
    const a = world[k]; if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
    for (const l of a.lamps ?? []) if (Number.isFinite(l?.x)) lamps.push(l.x, l.z);
    for (const l of a.lanterns ?? []) if (l?.at) lamps.push(l.at[0], l.at[2]);
    for (const l of a.plaza?.lamps ?? []) if (Number.isFinite(l?.x)) lamps.push(l.x, l.z);
    for (const l of a.quinto?.lamps ?? []) if (Number.isFinite(l?.x)) lamps.push(l.x, l.z);
  }
  const trees = (world.city.trees ?? []).map((t) => (Array.isArray(t) ? t : [t.x, t.z]));
  const g = new Map(), cellKey = (i, j) => (i + 4096) * 8192 + (j + 4096), key = (x, z) => cellKey(Math.floor(x / 12), Math.floor(z / 12));
  const put = (x, z, kind) => { const k = key(x, z); let a = g.get(k); if (!a) g.set(k, a = []); a.push(x, z, kind); };
  for (let i = 0; i < lamps.length; i += 2) put(lamps[i], lamps[i + 1], 1);
  for (const [x, z] of trees) put(x, z, 2);
  for (let k = 0; k < net.links; k++) {
    const mx = (net.nx[net.a[k]] + net.nx[net.b[k]]) / 2, mz = (net.nz[net.a[k]] + net.nz[net.b[k]]) / 2;
    const i0 = Math.floor(mx / 12), j0 = Math.floor(mz / 12);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const a = g.get(cellKey(i, j)); if (!a) continue;
      for (let n = 0; n < a.length; n += 3) {
        const d = Math.hypot(a[n] - mx, a[n + 1] - mz);
        if (a[n + 2] === 1 && d < 11) net.lit[k] = 1;
        if (a[n + 2] === 2 && d < 4.5) net.shade[k] = 1;
      }
    }
  }
  net.lampCount = lamps.length / 2;
}

/** Height of the walking surface on link `k` at `s` metres from its first node (stairs: the drawn treads). */
export function walkHeight(net, k, s) {
  const st = net.stair[k];
  const len = net.len[k];
  const t = len > 0 ? Math.max(0, Math.min(1, s / len)) : 0;
  const c = net.profCount[k] - 1, o = net.profStart[k];
  if (st >= 0) {
    // stair lanes: exact drawn height from the flight record (treads and nosings)
    const f = net.flights[st];
    const x = net.nx[net.a[k]] + net.dirX[k] * len * t, z = net.nz[net.a[k]] + net.dirZ[k] * len * t;
    const dx = x - f.ox, dz = z - f.oz;
    return stairDrawnHeight(f, dx * f.cx + dz * f.cz, dx * f.ex + dz * f.ez);
  }
  if (c <= 0) return net.prof[o];
  const f = t * c, i = Math.min(c - 1, Math.floor(f)), w = f - i;
  return net.prof[o + i] * (1 - w) + net.prof[o + i + 1] * w;
}

/** The walked surface `side` metres right of link k's centre line (a→b), `s` metres along it: the centre profile and
 * the walk's measured cross slope (stairs: the treads, as walkHeight). */
export function walkHeightAt(net, k, s, side) {
  return walkHeight(net, k, s) + net.cross[k] * side;
}
