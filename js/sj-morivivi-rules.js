/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Moriviví (Mimosa pudica, the sensitive plant that grows wild all over Puerto Rico) on the El Morro lawn and San
// Cristóbal's grass: where its mats grow and how they fold. No renderer here: js/sj-morivivi.js draws what this places,
// and the headless tests check the same rules.
//
// Where: grass only (plain lawn, dry, open, not a closed place, not steep), clear of the walks, of every solid and soft
// body and of the kite field's people, blankets and rack. Mats grow in drifts of two to six, weighted to where the plant
// was photographed and to the verges of the paths and the feet of the walls. Seeded: the same lawn on every load.
//
// Touch: a grounded wheel (or a sliding fallen rider) within REACH of a mat's outline folds it in a wave from the touched
// side; it stays shut WAIT_MIN..WAIT_MAX seconds of riding time (seeded per mat), then opens over about five seconds,
// the far side first. Touched again meanwhile, it stays shut and the wait starts over. At blue hour every mat sleeps.
import { seededRandom } from './sj-life-random.js';
import { MOAT_LAWNS, CALLE } from './sj-fort-layout.js';

export const FOLD = Object.freeze({
  reach: 0.35,        // metres beyond the outline that a wheel brushes
  air: 0.4,           // a wheel higher than this above the mat touches nothing
  wave: 0.6,          // seconds for the fold to run across the mat
  leaf: 0.3,          // seconds one leaf takes to close
  waitMin: 22, waitMax: 30,
  openWave: 1.8,      // seconds between the far side and the touched side starting to open
  openLeaf: 3.2,      // seconds one leaf takes to open
  refresh: 1,         // a mat still under the wheel has its wait renewed at most once a second
});
export const OUTLINE = 10;   // radial samples of a mat's outline

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A mat's fold state: f0 fold start, o0 open start, floor the fold it already had, angle the wave direction (radians,
 *  in the x/z plane: the wave runs along (cos, sin)). Open, never touched. */
export function openState() { return { f0: -1e9, o0: -1e9, floor: 0, angle: 0 }; }

/** Fold of one leaf (0 open … 1 shut) at riding time t; w is the leaf's place along the wave, −1 the touched side, +1 the
 *  far side. The vertex stage of js/sj-morivivi.js computes the same expression. */
export function foldAmount(s, t, w = 0, night = 0) {
  const fold = clamp01((t - s.f0 - (w + 1) * 0.5 * FOLD.wave) / FOLD.leaf);
  const open = clamp01((t - s.o0 - (1 - w) * 0.5 * FOLD.openWave) / FOLD.openLeaf);
  return Math.max((1 - open) * Math.max(s.floor, fold), night);
}

/** The mat as a whole (its middle leaf). */
export const matFold = (s, t) => foldAmount(s, t, 0);

/**
 * A touch at riding time t, the wave running along `angle`; `wait` is the mat's own wait. Returns 'fold' when the mat
 * starts folding (it was open or opening), 'renew' when a shut mat only has its wait renewed, '' when nothing changed
 * (the renewal is at most once per FOLD.refresh seconds).
 */
export function touchState(s, t, angle, wait) {
  const now = matFold(s, t);
  if (now >= 0.999 && t >= s.f0) {
    if (t + wait - s.o0 < FOLD.refresh) return '';
    s.o0 = t + wait; return 'renew';
  }
  // still folding (the wave has not crossed yet): the fold already under way keeps going
  if (t >= s.f0 && t < s.f0 + FOLD.wave + FOLD.leaf && s.o0 > t) {
    if (t + wait - s.o0 < FOLD.refresh) return '';
    s.o0 = t + wait; return 'renew';
  }
  s.floor = now; s.f0 = t; s.o0 = t + wait; s.angle = angle;
  return 'fold';
}

/** Outline radius of a mat at heading `a` (radians in the x/z plane, atan2(dz, dx)). */
export function outlineAt(mat, a) {
  const u = (((a / (Math.PI * 2)) % 1) + 1) % 1 * OUTLINE, i = Math.floor(u) % OUTLINE, f = u - Math.floor(u);
  return mat.r * (mat.outline[i] * (1 - f) + mat.outline[(i + 1) % OUTLINE] * f);
}

/** Whether a wheel at (x, y, z) touches the mat: on the ground (or a sliding fallen rider) and within reach. */
export function touches(mat, x, y, z, onGround) {
  if (!onGround || y - mat.y > FOLD.air) return false;
  const dx = x - mat.x, dz = z - mat.z, d = Math.hypot(dx, dz);
  if (d > mat.r * 1.2 + FOLD.reach) return false;
  return d <= outlineAt(mat, Math.atan2(dz, dx)) + FOLD.reach;
}

// ---- placement ----
// The photographed spots (world metres, x east, z south) and the lawns' extents.
export const SPOTS = Object.freeze([
  { photo: 101, x: -756, z: -567, lawn: 'morro', hero: true },
  { photo: 103, x: -775, z: -556, lawn: 'morro' },
  { photo: 104, x: -753, z: -539, lawn: 'morro' },
  { photo: 105, x: -713, z: -332, lawn: 'morro' },
  { photo: 106, x: -768, z: -372, lawn: 'morro' },
  { photo: 108, x: 678, z: -249, lawn: 'cristobal' },
  { photo: 109, x: 668, z: -240, lawn: 'cristobal' },
]);
export const LAWNS = Object.freeze({
  morro: { x0: -880, x1: -460, z0: -622, z1: -290, paths: 10, walls: 3, verge: [2, 4] },
  cristobal: { x0: 540, x1: 820, z0: -330, z1: -150, paths: 4, walls: 1, verge: [2, 4] },
});
const CELL = 2;           // raster metres (the ground mask's own cell)
const SLOPE = 0.3;        // steepest ground a mat grows on (rise over run; the rider stands on much steeper)
const DRIFT_GAP = 13;     // metres between drift anchors
export const RAY = [0, 0.36, 0.7, 1]; // the mat's low layer: its rings, as drawn by js/sj-morivivi.js
const BEND = 0.009;       // metres the lawn may bow away from the low layer between two of its points
const KEEP = { seat: 1.3, blanket: 1.9, rack: 2.4 };
const LIGHTHOUSE = [-729.55, -611.96];

// ---- moats and walks ----
const inRing = (x, z, ring) => { let v = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [a, b] = ring[i], [c, d] = ring[j];
  if ((b > z) !== (d > z) && x < ((c - a) * (z - b)) / (d - b) + a) v = !v; } return v; };
const toSegment = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
/** Moat ground no mat may touch: El Morro's mapped moat floor and the north terrace below the esplanade (the fort layout's
 *  `MOAT_LAWNS`), and San Cristóbal's great moat (the forttops layout's `ownedGround` of kind 'moat'). */
export function moatRings(world) {
  return [...MOAT_LAWNS, ...(world.forttops?.ownedGround ?? []).filter((o) => o.kind === 'moat').map((o) => o.ring)];
}
/** Signed distance to the nearest moat ring: negative inside a ring. */
export function moatDistance(rings, x, z) {
  let best = Infinity;
  for (const r of rings) {
    let d = Infinity; for (let i = 0, j = r.length - 1; i < r.length; j = i++) d = Math.min(d, toSegment(x, z, r[j], r[i]));
    if (inRing(x, z, r)) return -d;
    best = Math.min(best, d);
  }
  return best;
}
/**
 * Moat ground: inside a moat ring, or ground beside one (within MOAT_SPREAD m) that lies at the moat's floor level (less than
 * MOAT_RISE above the ring's median floor height) — the moat's unmapped continuation, not the esplanade above its lip.
 * Returns a point test (x, z, y) → boolean.
 */
export const MOAT_SPREAD = 30, MOAT_RISE = 1.8;
export function moatGround(world, rings = moatRings(world)) {
  const floors = rings.map((r) => {
    const xs = r.map((p) => p[0]), zs = r.map((p) => p[1]), h = [];
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 2) if (inRing(x, z, r)) h.push(world.height(x, z));
    h.sort((a, b) => a - b); return h.length ? h[h.length >> 1] : -Infinity;
  });
  const boxes = rings.map((r) => { const xs = r.map((p) => p[0]), zs = r.map((p) => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; });
  return (x, z, y) => rings.some((r, i) => {
    const b = boxes[i];
    if (x < b[0] - MOAT_SPREAD || x > b[1] + MOAT_SPREAD || z < b[2] - MOAT_SPREAD || z > b[3] + MOAT_SPREAD) return false;
    if (inRing(x, z, r)) return true;
    if (y >= floors[i] + MOAT_RISE) return false;
    for (let a = 0, b = r.length - 1; a < r.length; b = a++) if (toSegment(x, z, r[b], r[a]) < MOAT_SPREAD) return true;
    return false;
  });
}
/** A mat's furthest reach from its centre: its outline with the drawn lobes and the leaves and runners that overhang it. */
export const reachOf = (m) => m.r * Math.max(...m.outline) * 1.07 + 0.3;
export const GAPS = Object.freeze({ near: 10, nearRun: 30, far: 25, farRun: 20 });
/**
 * The walks of the El Morro lawn as polylines: Calle del Morro (the main walk across the esplanade) and every chain of walk
 * links that runs beside the lawn (`lawnBeside(x, z)`), joined through nodes where only two such links meet.
 */
export function lawnWalks(net, lawnBeside) {
  const walks = [CALLE.map(([x, z]) => [x, z])];
  if (!net) return walks;
  const L = LAWNS.morro, use = new Uint8Array(net.links);
  for (let k = 0; k < net.links; k++) {
    const ax = net.nx[net.a[k]], az = net.nz[net.a[k]], bx = net.nx[net.b[k]], bz = net.nz[net.b[k]];
    if (Math.min(ax, bx) < L.x0 || Math.max(ax, bx) > L.x1 || Math.min(az, bz) < L.z0 || Math.max(az, bz) > L.z1) continue;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, w = net.width[k] + 2.5;
    if (lawnBeside(mx + net.dirZ[k] * w, mz - net.dirX[k] * w) || lawnBeside(mx - net.dirZ[k] * w, mz + net.dirX[k] * w)) use[k] = 1;
  }
  const at = new Map();
  for (let k = 0; k < net.links; k++) if (use[k]) for (const n of [net.a[k], net.b[k]]) { let l = at.get(n); if (!l) at.set(n, l = []); l.push(k); }
  const done = new Uint8Array(net.links);
  const extend = (k, n, out) => {
    for (;;) {
      const next = n === net.a[k] ? net.b[k] : net.a[k]; out.push([net.nx[next], net.nz[next]]);
      const l = at.get(next); if (!l || l.length !== 2) return;
      const k2 = l[0] === k ? l[1] : l[0]; if (done[k2]) return; done[k2] = 1; k = k2; n = next;
    }
  };
  for (let k = 0; k < net.links; k++) {
    if (!use[k] || done[k]) continue; done[k] = 1;
    const fwd = [[net.nx[net.a[k]], net.nz[net.a[k]]]]; extend(k, net.a[k], fwd);
    const back = []; extend(k, net.b[k], back);
    const line = [...back.reverse(), ...fwd];
    let len = 0; for (let i = 1; i < line.length; i++) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    if (len >= 15) walks.push(line);
  }
  return walks;
}
/** Samples every metre along a walk: {x, z, nx, nz} (nx, nz: the walk's left normal). */
export function walkSamples(line) {
  const out = [];
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i], l = Math.hypot(bx - ax, bz - az); if (l < 1e-6) continue;
    for (let t = 0; t < l; t += 1) out.push({ x: ax + ((bx - ax) * t) / l, z: az + ((bz - az) * t) / l, nx: -(bz - az) / l, nz: (bx - ax) / l });
  }
  return out;
}
/** For each sample, the distance to the nearest mat's centre less that mat's radius (updated in place with more mats). */
export function nearestMat(samples, mats, out = new Float32Array(samples.length).fill(Infinity)) {
  for (const m of mats) for (let i = 0; i < samples.length; i++) {
    const dx = samples[i].x - m.x; if (dx > 40 || dx < -40) continue;
    const d = Math.hypot(dx, samples[i].z - m.z) - m.r; if (d < out[i]) out[i] = d;
  }
  return out;
}
/** Runs (in samples, i.e. metres) of lawn-side samples farther than `limit` from every mat, longest first; a sample with
 *  no lawn beside it ends a run. */
export function gapRuns(dist, lawnSide, limit) {
  const runs = []; let n = 0, from = 0;
  for (let i = 0; i <= dist.length; i++) {
    if (i < dist.length && lawnSide[i] && dist[i] > limit) { if (!n) from = i; n++; } else if (n) { runs.push({ length: n, from, to: i - 1 }); n = 0; }
  }
  return runs.sort((a, b) => b.length - a.length);
}

/**
 * Places the mats from the live world: `world` (sampler, isDry, height, softBodies), `net` (the walk network) and
 * `accents` (the kite field's seats, blankets and rack). Returns {drifts, mats, stats}; each mat is
 * {x, y, z, r, outline[OUTLINE], lawn, drift, dry, seed, wait}. Read at build time only.
 */
export function placeMorivivi({ world, net, accents = null, seed = 'morivivi', timings = null }) {
  const mark = timings ? (name) => { timings[name] = (timings[name] ?? 0) - (timings._t ?? 0) + (timings._t = performance.now()); } : () => {};
  if (timings) timings._t = performance.now();
  const { sampler, isDry, height } = world;
  const closedAt = sampler.offLimitsAt ?? (() => false);
  const soft = world.softBodies;
  const probe = { normal: {} };
  const rng = seededRandom(seed);
  const between = (a, b) => a + (b - a) * rng();
  // what may not be grown on: the kite field's people and things
  const keep = [];
  if (accents) {
    const s = accents.seats ?? [];
    for (let q = 0; q + 6 < s.length; q += 7) keep.push([s[q], s[q + 1], KEEP.seat]);
    for (const p of accents.picnics ?? []) keep.push([p.x, p.z, KEEP.blanket]);
    if (accents.rack) keep.push([accents.rack.x, accents.rack.z, KEEP.rack]);
    for (const k of accents.kites ?? []) keep.push([k.x, k.z, KEEP.seat]);
  }
  const kept = (x, z, r) => keep.some(([kx, kz, kr]) => (x - kx) ** 2 + (z - kz) ** 2 < (kr + r) ** 2);
  // lawn ground at a point: the plain drawn terrain, grass, dry, open; null otherwise
  const mask = sampler.coreMask, mh = mask?.header, lawnClass = mh?.classes?.indexOf('lawn') ?? -1;
  const lawnAt = (x, z) => {
    if (!isDry(x, z)) return null;
    if (lawnClass >= 0 && mask.mask) {
      const i = Math.floor((x - mh.originX) / mh.cell), j = Math.floor((z - mh.originZ) / mh.cell);
      if (i < 0 || j < 0 || i >= mh.w || j >= mh.h || mask.mask[j * mh.w + i] !== lawnClass) return null;
    }
    const h = height(x, z), g = sampler.cityGround(x, z, probe, h + 0.35);
    if (g.surface !== 'grass' || g.water || Math.abs(g.height - h) > 0.005 || closedAt(x, z, g.height)) return null;
    return g.height;
  };
  const moats = moatRings(world), lowMoat = moatGround(world, moats);
  const inMoat = (x, z) => lowMoat(x, z, height(x, z));
  // (cheapest tests first: the ground class, then the moat, then the closed places)
  const lawnCell = (x, z) => {
    if (!isDry(x, z)) return false;
    if (lawnClass >= 0 && mask.mask) {
      const i = Math.floor((x - mh.originX) / mh.cell), j = Math.floor((z - mh.originZ) / mh.cell);
      if (i < 0 || j < 0 || i >= mh.w || j >= mh.h || mask.mask[j * mh.w + i] !== lawnClass) return false;
      const y = height(x, z);
      return !lowMoat(x, z, y) && !closedAt(x, z, y);
    }
    return !inMoat(x, z) && lawnAt(x, z) != null;
  };
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0, halfLengthMetres: 0, minY: 0, maxY: 0 };
  mark('setup');
  const lawns = {};
  for (const [name, L] of Object.entries(LAWNS)) {
    // raster: cls 1 = lawn, 0 = anything else; path 1 = ground a rider uses (a walk, paving, a street), 0 = a wall, a
    // closed place or the sea (the walks are burnt in as paths)
    const nx = Math.round((L.x1 - L.x0) / CELL) + 1, nz = Math.round((L.z1 - L.z0) / CELL) + 1;
    const cls = new Uint8Array(nx * nz), path = new Uint8Array(nx * nz);
    // (the raster reads the ground classes only; every mat is checked against the full ground below)
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) cls[j * nx + i] = lawnCell(L.x0 + i * CELL, L.z0 + j * CELL) ? 1 : 0;
    mark('r-cells');
    // only the ground bordering the lawn decides what kind of edge a lawn cell is nearest to
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i; if (cls[c]) continue;
      let border = false;
      for (let v = -1; v <= 1 && !border; v++) for (let u = -1; u <= 1; u++) { const a = i + u, b = j + v; if (a >= 0 && b >= 0 && a < nx && b < nz && cls[b * nx + a]) { border = true; break; } }
      const x = L.x0 + i * CELL, z = L.z0 + j * CELL;
      if (!border || !isDry(x, z) || inMoat(x, z)) continue;
      const g = sampler.cityGround(x, z, probe, height(x, z) + 0.35);
      if (!g.water && !closedAt(x, z, g.height) && Math.abs(g.height - height(x, z)) < 0.6) path[c] = 1;
    }
    mark('r-border');
    if (net) for (let k = 0; k < net.links; k++) {
      const ax = net.nx[net.a[k]], az = net.nz[net.a[k]], bx = net.nx[net.b[k]], bz = net.nz[net.b[k]], w = net.width[k] + 0.3;
      if (Math.max(ax, bx) < L.x0 - w || Math.min(ax, bx) > L.x1 + w || Math.max(az, bz) < L.z0 - w || Math.min(az, bz) > L.z1 + w) continue;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - w - L.x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + w - L.x0) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - w - L.z0) / CELL)), j1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz) + w - L.z0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = L.x0 + i * CELL, z = L.z0 + j * CELL, t = Math.max(0, Math.min(net.len[k], (x - ax) * net.dirX[k] + (z - az) * net.dirZ[k]));
        if (Math.hypot(x - ax - net.dirX[k] * t, z - az - net.dirZ[k] * t) <= w) { const c = j * nx + i; cls[c] = 0; path[c] = 1; }
      }
    }
    mark('r-walks');
    // distance to the nearest non-lawn cell, and whether that cell is a path (two-pass chamfer)
    const dist = new Float32Array(nx * nz), near = new Uint8Array(nx * nz);
    for (let c = 0; c < nx * nz; c++) { dist[c] = cls[c] ? 1e9 : 0; near[c] = path[c]; }
    const relax = (c, o, d) => { if (dist[o] + d < dist[c]) { dist[c] = dist[o] + d; near[c] = near[o]; } };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i; if (!cls[c]) continue;
      if (i > 0) relax(c, c - 1, 1); if (j > 0) relax(c, c - nx, 1);
      if (i > 0 && j > 0) relax(c, c - nx - 1, 1.414); if (i < nx - 1 && j > 0) relax(c, c - nx + 1, 1.414);
    }
    for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const c = j * nx + i; if (!cls[c]) continue;
      if (i < nx - 1) relax(c, c + 1, 1); if (j < nz - 1) relax(c, c + nx, 1);
      if (i < nx - 1 && j < nz - 1) relax(c, c + nx + 1, 1.414); if (i > 0 && j < nz - 1) relax(c, c + nx - 1, 1.414);
    }
    const at = (x, z) => { const i = Math.round((x - L.x0) / CELL), j = Math.round((z - L.z0) / CELL); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
    lawns[name] = { L, nx, nz, cls, dist, near, at };
  }
  mark('raster');
  const edge = (name, x, z) => { const w = lawns[name], c = w.at(x, z); return c < 0 ? 0 : w.dist[c] * CELL; };
  // a mat fits: its whole outline (and a ring inside it) on lawn, not steep, clear of bodies, the walks and the kite field
  const fits = (name, x, z, r, outline) => {
    const y = lawnAt(x, z); if (y == null) return null;
    if (moatDistance(moats, x, z) < reachOf({ r, outline }) + 0.1) return null;
    if (edge(name, x, z) < Math.min(1.9, r * 0.55)) return null;
    if (kept(x, z, r)) return null;
    let lo = y, hi = y;
    for (let i = 0; i < OUTLINE; i++) for (const f of [0.55, 1]) {
      const a = (i / OUTLINE) * Math.PI * 2, rr = r * outline[i] * f + (f === 1 ? 0.25 : 0), px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      const q = lawnAt(px, pz); if (q == null || lowMoat(px, pz, q)) return null;
      if (soft && !soft.empty && soft.contains(px, q + 0.3, pz)) return null;
      lo = Math.min(lo, q); hi = Math.max(hi, q);
      if (Math.abs(q - y) / rr > SLOPE) return null;
    }
    if (hi - lo > r * 2 * SLOPE) return null;
    // smooth enough for the mat's low layer to follow it: along each ray and round the rim, the lawn between two samples
    // stays within BEND of the straight line joining them
    const RS = OUTLINE * 2, m = { r, outline }, rim = [];
    const hAt = (a, f) => { const rr = outlineAt(m, a) * f * 1.07; return height(x + Math.cos(a) * rr, z + Math.sin(a) * rr); };
    for (let i = 0; i < RS; i++) {
      const a = (i / RS) * Math.PI * 2, hs = RAY.map((f) => hAt(a, f));
      for (let k = 1; k < RAY.length; k++) if (Math.abs(hAt(a, (RAY[k - 1] + RAY[k]) / 2) - (hs[k - 1] + hs[k]) / 2) > BEND) return null;
      rim.push(hs);
    }
    for (let i = 0; i < RS; i++) for (let k = 1; k < RAY.length; k++) {
      if (Math.abs(hAt(((i + 0.5) / RS) * Math.PI * 2, RAY[k]) - (rim[i][k] + rim[(i + 1) % RS][k]) / 2) > BEND) return null;
    }
    body.x = x; body.z = z; body.headingY = 0; body.halfWidthMetres = body.halfLengthMetres = r * 1.05;
    body.minY = hi + 0.05; body.maxY = lo + 0.7;
    return sampler.isVolumeClear(body) ? y : null;
  };
  const mats = [], drifts = [];
  const overlaps = (x, z, r) => mats.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + r + 0.15);
  const newOutline = () => {
    for (;;) {
      const o = []; for (let i = 0; i < OUTLINE; i++) o.push(between(0.62, 1.15));
      // smoothed once so the edge wanders instead of jagging; never a disc (lobes and bays at least a fifth apart)
      const s = o.map((v, i) => (v * 2 + o[(i + 1) % OUTLINE] + o[(i + OUTLINE - 1) % OUTLINE]) / 4);
      if (Math.max(...s) / Math.min(...s) >= 1.2) return s;
    }
  };
  const newMat = (name, x, z, drift) => {
    for (let t = 0; t < 3; t++) {
      const r = drift.hero && !mats.some((m) => m.drift === drift.index) ? between(1.05, 1.2) : between(0.5, 1.15), outline = newOutline();
      if (overlaps(x, z, r)) continue;
      const y = fits(name, x, z, r, outline); if (y == null) continue;
      const m = { x, y, z, r, outline, lawn: name, drift: drift.index, dry: rng() < 0.2, seed: Math.floor(rng() * 4294967296), wait: between(FOLD.waitMin, FOLD.waitMax) };
      mats.push(m); return m;
    }
    return null;
  };
  // a drift round an anchor: `count` mats a step or two apart, the first on the anchor
  const grow = (name, x, z, count, kind, extra = {}) => {
    if (drifts.some((d) => Math.hypot(d.x - x, d.z - z) < (extra.gap ?? DRIFT_GAP))) return null;
    const drift = { index: drifts.length, lawn: name, x, z, kind, mats: 0, ...extra };
    const first = mats.length;
    if (!newMat(name, x, z, drift)) return null;
    for (let t = 0; t < count * 7 && mats.length - first < count; t++) {
      const base = mats[first + Math.floor(rng() * (mats.length - first))], a = rng() * Math.PI * 2, d = base.r + between(0.75, 1.5);
      newMat(name, base.x + Math.cos(a) * d, base.z + Math.sin(a) * d, drift);
    }
    drift.mats = mats.length - first;
    if (drift.mats < Math.min(2, count)) { mats.length = first; return null; }
    drifts.push(drift);
    return drift;
  };
  // 1) the photographed spots: a drift within 15 m of each where there is lawn (nearest lawn otherwise, named in stats)
  const spotStats = [];
  for (const s of SPOTS) {
    const w = lawns[s.lawn], cands = [];
    // only the cells within 60 m of the spot (the same cells, in the same order, as a scan of the whole lawn)
    const j0 = Math.max(0, Math.floor((s.z - 60 - w.L.z0) / CELL)), j1 = Math.min(w.nz - 1, Math.ceil((s.z + 60 - w.L.z0) / CELL));
    const i0 = Math.max(0, Math.floor((s.x - 60 - w.L.x0) / CELL)), i1 = Math.min(w.nx - 1, Math.ceil((s.x + 60 - w.L.x0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * w.nx + i; if (!w.cls[c]) continue;
      const x = w.L.x0 + i * CELL, z = w.L.z0 + j * CELL, d = Math.hypot(x - s.x, z - s.z);
      if (d > 60 || w.dist[c] < 1.9) continue;
      if (s.hero) {
        // photo 101: on the esplanade lawn at the lip of the moat, the fort and the lighthouse beyond it across the moat
        // the lip: walking towards the lighthouse, moat ground begins 2–9 m ahead and stays below for a while (the moat)
        const lx = LIGHTHOUSE[0] - x, lz = LIGHTHOUSE[1] - z, ll = Math.hypot(lx, lz), y0 = height(x, z);
        let lip = -1; for (let t = 1; t <= 9 && lip < 0; t += 0.5) if (inMoat(x + (lx / ll) * t, z + (lz / ll) * t)) lip = t;
        if (lip < 2) continue;
        let across = 0; for (let t = lip; t < lip + 20; t += 1) if (inMoat(x + (lx / ll) * t, z + (lz / ll) * t) && height(x + (lx / ll) * t, z + (lz / ll) * t) < y0 - 1.5) across++;
        if (across < 6) continue;
        cands.push([d + Math.abs(lip - 4) * 2, x, z, d]);
        continue;
      }
      // near the spot first; at an edge (a wall foot or a verge) rather than mid-lawn, as photographed
      cands.push([d + Math.abs(w.dist[c] - 2.2) * 1.5 + (d > 15 ? 40 : 0), x, z, d]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    let placed = null;
    for (const [, x, z, d] of cands.slice(0, 80)) {
      placed = grow(s.lawn, x, z, s.hero ? 6 : 3 + Math.floor(rng() * 3), s.hero ? 'hero' : 'photo', { photo: s.photo, hero: !!s.hero });
      if (placed) { placed.fromSpot = +d.toFixed(1); break; }
    }
    // a spot whose nearest lawn already has a drift (two photographs of one place) shares it
    const shared = placed ? null : drifts.filter((dr) => dr.lawn === s.lawn).sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
    spotStats.push({ photo: s.photo, drift: (placed ?? shared)?.index ?? -1, metres: placed ? placed.fromSpot : shared ? +Math.hypot(shared.x - s.x, shared.z - s.z).toFixed(1) : null });
  }
  mark('spots');
  // 2) the verges: lawn 2–4 m from paving or a walk, in a seeded scatter at least DRIFT_GAP apart
  const scatter = (w, keepCell) => {
    const list = [];
    for (let c = 0; c < w.nx * w.nz; c++) if (w.cls[c] && keepCell(c)) list.push(c);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  };
  for (const [name, w] of Object.entries(lawns)) {
    let made = 0;
    for (const c of scatter(w, (c) => w.near[c] && w.dist[c] >= 1.9 && w.dist[c] <= 4.1)) {
      if (made >= w.L.paths) break;
      const x = w.L.x0 + (c % w.nx) * CELL + between(-0.8, 0.8), z = w.L.z0 + Math.floor(c / w.nx) * CELL + between(-0.8, 0.8);
      if (grow(name, x, z, w.L.verge[0] + Math.floor(rng() * (w.L.verge[1] - w.L.verge[0] + 1)), 'verge')) made++;
    }
  }
  mark('verges');
  // 3) the feet of walls and closed places (worn, sunny, disturbed turf)
  for (const [name, w] of Object.entries(lawns)) {
    let made = 0;
    for (const c of scatter(w, (c) => !w.near[c] && w.dist[c] >= 1.9 && w.dist[c] <= 3.5)) {
      if (made >= w.L.walls) break;
      if (grow(name, w.L.x0 + (c % w.nx) * CELL, w.L.z0 + Math.floor(c / w.nx) * CELL, 2 + Math.floor(rng() * 3), 'wall', { gap: 20 })) made++;
    }
  }
  mark('walls');
  // 4) the walks of the El Morro lawn: no long stretch without a mat close to the walk (GAPS). The longest open stretch
  // gets a verge drift near its middle, on one side or the other (alternating), until none is left or none fits.
  const morro = lawns.morro;
  const lawnBeside = (x, z) => { const c = morro.at(x, z); return c >= 0 && morro.cls[c] === 1; };
  const walks = lawnWalks(net, lawnBeside).map((line) => {
    const samples = walkSamples(line);
    const side = samples.map((p) => { for (const o of [2, 4, 6, 8]) if (lawnBeside(p.x + p.nx * o, p.z + p.nz * o) || lawnBeside(p.x - p.nx * o, p.z - p.nz * o)) return 1; return 0; });
    return { samples, side, dist: nearestMat(samples, mats.filter((m) => m.lawn === 'morro')) };
  });
  const dead = new Set();
  let turn = 0, added = 0;
  for (let round = 0; round < 60; round++) {
    let worst = null;
    for (const [wi, wk] of walks.entries()) for (const [limit, run] of [[GAPS.near, GAPS.nearRun - 6], [GAPS.far, GAPS.farRun - 4]]) {
      for (const g of gapRuns(wk.dist, wk.side, limit)) {
        if (g.length <= run) break;
        const key = wi + ':' + g.from + ':' + limit; if (dead.has(key)) continue;
        if (!worst || g.length - run > worst.over) worst = { wk, g, key, over: g.length - run };
        break;
      }
    }
    if (!worst) break;
    const { wk, g } = worst, mid = (g.from + g.to) >> 1;
    let made = null; const before = mats.length;
    for (let k = 0; k < 40 && !made; k++) {
      const i = Math.max(g.from, Math.min(g.to, mid + (k >> 1) * 2 * (k & 1 ? 1 : -1))), p = wk.samples[i];
      for (const sd of [turn & 1 ? 1 : -1, turn & 1 ? -1 : 1]) {
        const off = (k < 20 ? between(2.4, 4.6) : between(4.6, 7.5)) * sd, x = p.x + p.nx * off, z = p.z + p.nz * off;
        if ((made = grow('morro', x, z, 2 + Math.floor(rng() * 4), 'verge', { gap: 9 }))) break;
      }
    }
    if (made) { turn++; added++; const fresh = mats.slice(before); for (const o of walks) nearestMat(o.samples, fresh, o.dist); } else dead.add(worst.key);
  }
  mark('walks');
  const stats = { drifts: drifts.length, mats: mats.length, spots: spotStats, walkDrifts: added, walksUnfilled: dead.size,
    byLawn: Object.fromEntries(Object.keys(LAWNS).map((n) => [n, { drifts: drifts.filter((d) => d.lawn === n).length, mats: mats.filter((m) => m.lawn === n).length }])) };
  for (const n of Object.keys(lawns)) delete lawns[n].cls;
  return { drifts, mats, stats };
}
