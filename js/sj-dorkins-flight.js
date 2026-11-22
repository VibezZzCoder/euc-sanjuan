/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Officer Dorkins: the geometry questions his flight asks of the city (support, sight, a clear swept volume) and the
// rule of where he may be. Adapted from the San Francisco edition (js/sf-nemesis-flight.js, © 2026 VibezZzCoder, MIT).
// Nothing here moves a rider or a city actor; every answer comes from the same sampler the wheel rides on.
//
// Where he may be (`allowed`): over dry ground inside the drawn world, never over the sea, never over a closed site
// (the sampler's offLimitsAt: cemetery, Coast Guard base, fort interiors, La Fortaleza's grounds, closed piers, private
// courtyards) and never past the fenced east edge. clearFlight asks it at every sample of every sweep, so no step of
// his flight, no route edge and no spawn can put him there.

const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

export const FLIGHT = Object.freeze({ halfWidth: 0.4, halfLength: 0.4, height: 2.1, step: 0.5, maxSweep: 10, edgeMargin: 3.5 });

/** `world` is the built world (sampler, terrain, worldedge); returns { allowed, supportAt, clearLine, clearFlight, stats }. */
export function createFlightQueries(world) {
  const sampler = world?.sampler;
  if (!sampler || typeof sampler.sampleGround !== 'function' || typeof sampler.raycast !== 'function'
    || typeof sampler.raycastObstacle !== 'function' || typeof sampler.isVolumeClear !== 'function') {
    throw new TypeError('Officer flight needs ground, raycast and volume queries');
  }
  const t = world.terrain;
  const x0 = t ? t.x0 + 2 : -Infinity, z0 = t ? t.z0 + 2 : -Infinity;
  const x1 = t ? t.x0 + (t.nx - 1) * t.step - 2 : Infinity, z1 = t ? t.z0 + (t.nz - 1) * t.step - 2 : Infinity;
  const east = Number.isFinite(world.worldedge?.closure?.x) ? world.worldedge.closure.x - FLIGHT.edgeMargin : Infinity;
  const closed = typeof sampler.offLimitsAt === 'function' ? sampler.offLimitsAt : null;
  const ground = { height: 0, normal: { x: 0, y: 1, z: 0 }, surface: 'pavement', offCourse: false };
  const origin = { x: 0, y: 0, z: 0 }, direction = { x: 0, y: 0, z: 0 };
  const stats = { flights: 0, refused: 0 };

  /** Inside the world, east of nothing closed, and not over private ground (the caller has the floor height). */
  function allowedXZ(x, z, y) {
    return x > x0 && x < x1 && z > z0 && z < z1 && x < east && !(closed && closed(x, z, y));
  }
  /** A point he may hover over: dry, public, inside the world, with its own floor below `y`. */
  function allowed(x, z, y) {
    if (![x, z, y].every(Number.isFinite)) return false;
    const g = sampler.sampleGround(x, z, ground, y);
    return Number.isFinite(g.height) && !g.offCourse && !g.water && g.height <= y + 1e-4 && allowedXZ(x, z, g.height);
  }

  function supportAt(x, z, referenceY) {
    if (![x, z, referenceY].every(Number.isFinite)) return null;
    const result = sampler.sampleGround(x, z, ground, referenceY);
    if (!Number.isFinite(result.height)) return null;
    return { height: result.height, offCourse: !!result.offCourse, water: !!result.water, registered: !!result.registered };
  }

  function clearLine(a, b) {
    if (!finitePoint(a) || !finitePoint(b)) return false;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 1e-8) return true;
    origin.x = a.x; origin.y = a.y; origin.z = a.z;
    direction.x = dx / distance; direction.y = dy / distance; direction.z = dz / distance;
    return sampler.raycast(origin, direction, distance) === null;
  }

  // Reused scratch: clearFlight runs several times per officer frame.
  const body = { x: 0, z: 0, headingY: 0, halfWidthMetres: 0, halfLengthMetres: 0, minY: 0, maxY: 0, floorY: 0 };
  const lateral = { x: 0, z: 0 }, from = { x: 0, y: 0, z: 0 }, to = { x: 0, y: 0, z: 0 };
  const NO_OPTIONS = Object.freeze({});
  /**
   * A bounded, conservative check of one straight sweep of his upright footprint (centre and four corners on their
   * own floors, the static volume, three obstacle rays and six thin sight rays), plus the where-he-may-be rule at
   * every sample. Not a navigation system.
   */
  function clearFlight(a, b, { halfWidth = FLIGHT.halfWidth, halfLength = FLIGHT.halfLength, height = FLIGHT.height, step = FLIGHT.step } = NO_OPTIONS) {
    stats.flights++;
    if (!finitePoint(a) || !finitePoint(b) || !(halfWidth > 0) || !(halfLength > 0) || !(height > 0) || !(step > 0)) return false;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > FLIGHT.maxSweep) return false;
    const horizontal = Math.hypot(dx, dz);
    const headingY = horizontal > 1e-8 ? Math.atan2(dx, dz) : 0;
    const sideX = Math.cos(headingY), sideZ = -Math.sin(headingY);
    const forwardX = Math.sin(headingY), forwardZ = Math.cos(headingY);
    body.headingY = headingY; body.halfWidthMetres = halfWidth; body.halfLengthMetres = halfLength;
    const count = Math.max(1, Math.ceil(distance / step));
    for (let i = 0; i <= count; i++) {
      const s = i / count;
      const x = a.x + dx * s, z = a.z + dz * s, minY = a.y + dy * s;
      const center = sampler.sampleGround(x, z, ground, minY);
      // San Juan: the centre must stand over dry, public, in-world ground on a floor below him.
      if (!Number.isFinite(center.height) || center.offCourse || center.water || center.height > minY + 1e-4
        || !allowedXZ(x, z, center.height)) { stats.refused++; return false; }
      const normal = center.normal;
      const nx = normal?.x, ny = normal?.y, nz = normal?.z;
      const gx = Number.isFinite(nx) && Number.isFinite(ny) && ny > 1e-8 ? -nx / ny : 0;
      const gz = Number.isFinite(nz) && Number.isFinite(ny) && ny > 1e-8 ? -nz / ny : 0;
      const floorY = center.height;
      for (let c = 0; c < 4; c++) {
        const side = c < 2 ? -halfWidth : halfWidth, forward = c & 1 ? halfLength : -halfLength;
        const ox = sideX * side + forwardX * forward, oz = sideZ * side + forwardZ * forward;
        const corner = supportAt(x + ox, z + oz, minY + gx * ox + gz * oz);
        if (!corner || (!corner.offCourse && corner.height > minY + 1e-4)) return false;
      }
      body.x = x; body.z = z; body.minY = minY; body.maxY = minY + height; body.floorY = floorY;
      if (!sampler.isVolumeClear(body)) return false;
    }
    if (distance < 1e-8) return true;
    direction.x = dx / distance; direction.y = dy / distance; direction.z = dz / distance;
    lateral.x = sideX; lateral.z = sideZ;
    for (let u = 0; u < 3; u++) {
      origin.x = a.x; origin.y = a.y + (u === 0 ? 0.02 : u === 1 ? height / 2 : height); origin.z = a.z;
      if (sampler.raycastObstacle(origin, direction, distance, halfWidth, lateral) !== null) return false;
    }
    for (let k = 0; k < 6; k++) {
      const side = k < 2 ? -halfWidth : k < 4 ? 0 : halfWidth, up = k & 1 ? height : 0.02;
      from.x = a.x + sideX * side; from.y = a.y + up; from.z = a.z + sideZ * side;
      to.x = b.x + sideX * side; to.y = b.y + up; to.z = b.z + sideZ * side;
      if (!clearLine(from, to)) return false;
    }
    return true;
  }

  /**
   * A cheaper corridor check for route links (the movement itself still sweeps with clearFlight every step): every
   * ≤ 2 m the where-he-may-be rule on the floor under him and one static volume covering that stretch of his envelope,
   * plus two obstacle rays along it for thin walls.
   */
  const box = { x: 0, z: 0, headingY: 0, halfWidthMetres: FLIGHT.halfWidth, halfLengthMetres: 0, minY: 0, maxY: 0, floorY: 0 };
  function corridorClear(a, b) {
    if (!finitePoint(a) || !finitePoint(b)) return false;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, horizontal = Math.hypot(dx, dz);
    if (horizontal > FLIGHT.maxSweep) return false;
    const pieces = Math.max(1, Math.ceil(horizontal / 2)), headingY = horizontal > 1e-8 ? Math.atan2(dx, dz) : 0;
    box.headingY = headingY; box.halfLengthMetres = horizontal / pieces / 2 + FLIGHT.halfLength;
    for (let i = 0; i < pieces; i++) {
      const s0 = i / pieces, s1 = (i + 1) / pieces, s = (s0 + s1) / 2;
      const x = a.x + dx * s, z = a.z + dz * s, y0 = a.y + dy * s0, y1 = a.y + dy * s1, lo = Math.min(y0, y1);
      const g = sampler.sampleGround(x, z, ground, a.y + dy * s);
      if (!Number.isFinite(g.height) || g.offCourse || g.water || g.height > lo + 1e-4 || !allowedXZ(x, z, g.height)) return false;
      box.x = x; box.z = z; box.minY = lo; box.maxY = Math.max(y0, y1) + FLIGHT.height; box.floorY = g.height;
      if (!sampler.isVolumeClear(box)) return false;
    }
    if (horizontal < 1e-8) return true;
    const distance = Math.hypot(dx, dy, dz);
    direction.x = dx / distance; direction.y = dy / distance; direction.z = dz / distance;
    lateral.x = Math.cos(headingY); lateral.z = -Math.sin(headingY);
    for (const up of [FLIGHT.height / 2, FLIGHT.height]) {
      origin.x = a.x; origin.y = a.y + up; origin.z = a.z;
      if (sampler.raycastObstacle(origin, direction, distance, FLIGHT.halfWidth, lateral) !== null) return false;
    }
    return true;
  }

  return { allowed, allowedXZ, supportAt, clearLine, clearFlight, corridorClear, stats, graph: null };
}
