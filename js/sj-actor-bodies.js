/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Moving actors as the rider's controller sees them: one shared index of upright body records, rebuilt every frame.
// Adapted from the San Francisco edition's js/sf-dynamic-bodies.js (MIT; see provenance/actors-import.json): the body
// index, the crash slices cut from a vehicle's drawn geometry and the posed vehicle body are its code as ES exports.
//
// A body record is what js/euc-dynamic.js sweeps the rider against (metres, absolute heights, heading 0 along +Z):
//   {x, z, headingY, halfWidthMetres, halfLengthMetres, minY, maxY, velocityX, velocityZ, kind: 'vehicle'|'person', …}
// Owners keep and reuse their records; the index only borrows them between begin() and the next begin().
//   begin()  →  add(body) for every live actor  →  commit()         (once per frame, before the rider steps)
//   dynamicBodiesNear(x, z, radius, out)  appends the bodies whose footprint lies within radius; bodyVersion() counts commits.

// Grid keys: pack integer cells within ±2^14 injectively into a non-negative Smi (≤2^30-1).
// Other cells retain their text key; the two key types cannot collide, and ±0 remain equivalent.
const BODY_CELL_OFFSET = 2 ** 14, BODY_CELL_SPAN = 2 ** 15;
const bodyCellKey = (x, z) => x > -BODY_CELL_OFFSET && x < BODY_CELL_OFFSET && z > -BODY_CELL_OFFSET && z < BODY_CELL_OFFSET
  ? (x + BODY_CELL_OFFSET) * BODY_CELL_SPAN + (z + BODY_CELL_OFFSET) : `${x},${z}`;

export function createActorBodyIndex(cellSize = 16) {
  const cells = new Map(), spare = [];
  // Keep only current/previous rebuild keys, plus a small key-free pool. Counts delimit live
  // bodies; nulling slots releases actors without truncating/reallocating bucket backing arrays.
  const MAX_SPARE = 256, SMALL_BUCKET = 128;
  let spareCount = 0, activeCells = 0;
  const seen = new WeakMap();
  let version = 0, query = 0;
  const stats = { bodies: 0, cells: 0, queryCells: 0, candidates: 0 };
  function begin() {
    for (const bucket of cells.values()) {
      if (bucket.count === 0) {
        // Not reused since the previous begin: expire its key, never retain travel history.
        cells.delete(bucket.key); bucket.key = null;
        if (spareCount < MAX_SPARE && bucket.bodies.length <= SMALL_BUCKET) spare[spareCount++] = bucket;
      } else {
        // A sustained crowd can use any size. After occupancy falls, release a large historical
        // allocation rather than pinning its high-water mark forever in a still-active cell.
        if (bucket.bodies.length > Math.max(SMALL_BUCKET, bucket.count * 2)) bucket.bodies = [];
        else for (let i = 0; i < bucket.count; i++) bucket.bodies[i] = null;
        bucket.count = 0;
      }
    }
    activeCells = 0;
    stats.bodies = 0;
  }
  function add(body) {
    const s = Math.abs(Math.sin(body.headingY)), c = Math.abs(Math.cos(body.headingY));
    const rx = c * body.halfWidthMetres + s * body.halfLengthMetres;
    const rz = s * body.halfWidthMetres + c * body.halfLengthMetres;
    for (let ix = Math.floor((body.x - rx) / cellSize); ix <= Math.floor((body.x + rx) / cellSize); ix++) {
      for (let iz = Math.floor((body.z - rz) / cellSize); iz <= Math.floor((body.z + rz) / cellSize); iz++) {
        const key = bodyCellKey(ix, iz);
        let bucket = cells.get(key);
        if (!bucket) {
          if (spareCount) { bucket = spare[--spareCount]; spare[spareCount] = null; }
          else bucket = { key: null, bodies: [], count: 0 };
          bucket.key = key; cells.set(key, bucket);
        }
        if (bucket.count === 0) activeCells++;
        bucket.bodies[bucket.count++] = body;
      }
    }
    stats.bodies++;
  }
  function commit() { stats.cells = activeCells; version++; }
  function dynamicBodiesNear(x, z, radius, out) {
    stats.queryCells = stats.candidates = 0;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return;
    query++;
    for (let ix = Math.floor((x - radius) / cellSize); ix <= Math.floor((x + radius) / cellSize); ix++) {
      for (let iz = Math.floor((z - radius) / cellSize); iz <= Math.floor((z + radius) / cellSize); iz++) {
        stats.queryCells++;
        const bucket = cells.get(bodyCellKey(ix, iz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.count; i++) {
          const b = bucket.bodies[i];
          if (seen.get(b) === query) continue;
          seen.set(b, query);
          stats.candidates++;
          const dx = x - b.x, dz = z - b.z, s = Math.sin(b.headingY), c = Math.cos(b.headingY);
          const ex = Math.max(0, Math.abs(dx * c - dz * s) - b.halfWidthMetres);
          const ez = Math.max(0, Math.abs(dx * s + dz * c) - b.halfLengthMetres);
          if (ex * ex + ez * ez <= radius * radius) out.push(b);
        }
      }
    }
  }
  return { begin, add, commit, dynamicBodiesNear, bodyVersion: () => version, stats };
}

// Compact longitudinal crash slices from the actual high-detail geometry. Triangles crossing a slice contribute
// their full bounds (conservative at slice seams). Include separately drawn wheels from the same BODY/BUS_SPEC.
export function vehicleCrashSlices(geometry, spec = null) {
  const p = geometry.attributes.position;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const lo = Math.min(box.min.z, spec ? spec.zRear : Infinity);
  const hi = Math.max(box.max.z, spec ? spec.zFront : -Infinity);
  const count = Math.max(1, Math.ceil((hi - lo) / 0.5)), step = (hi - lo) / count;
  const slices = Array.from({ length: count }, (_, i) => ({
    z: lo + (i + 0.5) * step, halfLengthMetres: step / 2,
    halfWidthMetres: 0, minY: Infinity, maxY: -Infinity
  }));
  const index = geometry.index, n = index ? index.count : p.count;
  for (let i = 0; i < n; i += 3) {
    const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
    const z0 = Math.min(p.getZ(a), p.getZ(b), p.getZ(c)), z1 = Math.max(p.getZ(a), p.getZ(b), p.getZ(c));
    const w = Math.max(Math.abs(p.getX(a)), Math.abs(p.getX(b)), Math.abs(p.getX(c)));
    const y0 = Math.min(p.getY(a), p.getY(b), p.getY(c)), y1 = Math.max(p.getY(a), p.getY(b), p.getY(c));
    for (let k = Math.max(0, Math.floor((z0 - lo) / step)); k <= Math.min(count - 1, Math.floor((z1 - lo) / step)); k++) {
      const s = slices[k];
      s.halfWidthMetres = Math.max(s.halfWidthMetres, w); s.minY = Math.min(s.minY, y0); s.maxY = Math.max(s.maxY, y1);
    }
  }
  if (spec) {
    for (const s of slices) {
      if (Math.abs(Math.abs(s.z) - spec.wheelZ) <= spec.wheelRadius + s.halfLengthMetres) {
        s.halfWidthMetres = Math.max(s.halfWidthMetres, spec.wheelX + 0.12);
        s.minY = 0; s.maxY = Math.max(s.maxY, spec.wheelRadius * 2);
      }
    }
  }
  return slices.filter(s => s.maxY >= s.minY);
}

// Native crashProfile slices are relative to (body.x, body.minY, body.z), NOT to the mesh's road origin.
// Re-anchor along the mesh's local Y axis so minY is the true posed lower bound while preserving YXZ pitch/roll.
// This also avoids treating a steep bus as an unpitched Manhattan sedan or double-applying its absolute elevation.
export function writeVehicleBody(body, profile, x, y, z, headingY, pitch, roll, velocityX, velocityZ) {
  const sp = Math.sin(pitch), cp = Math.cos(pitch), sr = Math.sin(roll), cr = Math.cos(roll);
  // These exact products/absolute values are pose-constant, not slice-constant. Keep their original
  // multiplication order; share only within this call (profiles and poses remain independently mutable).
  const cpcr = cp * cr, spcr = sp * cr;
  const acpsr = Math.abs(cp * sr), acpcr = Math.abs(cpcr), asp = Math.abs(sp);
  const acr = Math.abs(cr), asr = Math.abs(sr), aspsr = Math.abs(sp * sr), aspcr = Math.abs(spcr), acp = Math.abs(cp);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < profile.length; i++) {
    const s = profile[i];
    const cy = (s.minY + s.maxY) / 2, hy = (s.maxY - s.minY) / 2;
    const ly = cpcr * cy - sp * s.z;
    const ry = acpsr * s.halfWidthMetres + acpcr * hy + asp * s.halfLengthMetres;
    min = Math.min(min, ly - ry); max = Math.max(max, ly + ry);
  }
  // Street grades stay upright. The near-vertical fallback uses already-posed slices, below.
  const upright = acpcr > 0.01;
  const anchor = upright ? min / cpcr : 0;
  const ox = -sr * anchor, oz = spcr * anchor;
  const sin = Math.sin(headingY), cos = Math.cos(headingY);
  body.x = x + cos * ox + sin * oz; body.z = z - sin * ox + cos * oz;
  body.headingY = headingY; body.minY = y + min; body.maxY = y + max;
  body.velocityX = velocityX; body.velocityZ = velocityZ; body.kind = 'vehicle';
  body.crashPitch = upright ? pitch : 0; body.crashRoll = upright ? roll : 0;
  const parts = body.crashProfile || (body.crashProfile = []);
  body.halfWidthMetres = body.halfLengthMetres = 0;
  for (let i = 0; i < profile.length; i++) {
    const s = profile[i], cy = (s.minY + s.maxY) / 2, hy = (s.maxY - s.minY) / 2;
    const lx = -sr * cy - ox, lz = spcr * cy + cp * s.z - oz;
    const rx = acr * s.halfWidthMetres + asr * hy;
    const rz = aspsr * s.halfWidthMetres + aspcr * hy + acp * s.halfLengthMetres;
    body.halfWidthMetres = Math.max(body.halfWidthMetres, Math.abs(lx) + rx);
    body.halfLengthMetres = Math.max(body.halfLengthMetres, Math.abs(lz) + rz);
    const part = parts[i] || (parts[i] = {});
    part.z = upright ? s.z : lz;
    part.halfWidthMetres = upright ? s.halfWidthMetres : Math.abs(lx) + rx;
    part.halfLengthMetres = upright ? s.halfLengthMetres : rz;
    if (upright) { part.minY = s.minY - anchor; part.maxY = s.maxY - anchor; }
    else {
      const ly = cpcr * cy - sp * s.z;
      const ry = acpsr * s.halfWidthMetres + acpcr * hy + asp * s.halfLengthMetres;
      part.minY = ly - ry - min; part.maxY = ly + ry - min;
    }
  }
  parts.length = profile.length;
  return body;
}
