/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Soft foliage: shrubs and clipped hedges the wheel drags through instead of crashing against (the EUC Thrills
// `soft` prop rule: a soft box never reaches the solids; the controller's SoftBodyField applies the stock drag,
// wobble and ragdoll damping). Area layouts mark a foliage prism with `soft: true`; construction consumers still see
// it as occupied ground (placement spacing, later owners), but loadCity keeps it out of the sampler and packs it here.
import { SoftBodyField } from './euc/simulation/softBodies.js';

// A round prism (regular polygon) becomes the square of the same area, as EUC Thrills' ROUND_TO_BOX does for round
// props; a rectangular prism (a hedge piece) becomes its exact box.
export function softBoxOf(c) {
  const p = c.outer.map(q => [q.x, q.z]), n = p.length;
  let area = 0, cx = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % n], k = x0 * z1 - x1 * z0;
    area += k; cx += (x0 + x1) * k; cz += (z0 + z1) * k;
  }
  area /= 2; cx /= 6 * area; cz /= 6 * area;
  const centre = { x: cx, y: (c.minY + c.maxY) / 2, z: cz }, hy = (c.maxY - c.minY) / 2;
  if (n === 4) {
    const e0 = [p[1][0] - p[0][0], p[1][1] - p[0][1]], e1 = [p[2][0] - p[1][0], p[2][1] - p[1][1]];
    if (Math.abs(e0[0] * e1[0] + e0[1] * e1[1]) < 1e-6 * Math.hypot(...e0) * Math.hypot(...e1) + 1e-9) {
      // local X along e0; SoftBodyField maps world → local with rotationY (localX = dx·cos − dz·sin).
      return { centre, halfExtents: { x: Math.hypot(...e0) / 2, y: hy, z: Math.hypot(...e1) / 2 }, rotationY: -Math.atan2(e0[1], e0[0]) };
    }
  }
  const h = Math.sqrt(Math.abs(area)) / 2;
  return { centre, halfExtents: { x: h, y: hy, z: h }, rotationY: 0 };
}

const CELL = 8;   // metres per broad-phase cell
// Packed field: 12 floats per body (x, z, minY, maxY, halfX, halfZ, cos, sin, minX, maxX, minZ, maxZ) and a uniform
// grid of body index lists. Same contains() test as SoftBodyField over the same boxes, without the linear scan.
export class SoftFoliageField extends SoftBodyField {
  constructor(boxes = []) {
    super([]);
    const n = boxes.length, d = new Float32Array(n * 12);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    boxes.forEach((b, i) => {
      const cos = Math.cos(b.rotationY), sin = Math.sin(b.rotationY);
      const rx = Math.abs(b.halfExtents.x * cos) + Math.abs(b.halfExtents.z * sin), rz = Math.abs(b.halfExtents.x * sin) + Math.abs(b.halfExtents.z * cos);
      d.set([b.centre.x, b.centre.z, b.centre.y - b.halfExtents.y, b.centre.y + b.halfExtents.y, b.halfExtents.x, b.halfExtents.z, cos, sin,
        b.centre.x - rx, b.centre.x + rx, b.centre.z - rz, b.centre.z + rz], i * 12);
      x0 = Math.min(x0, b.centre.x - rx); x1 = Math.max(x1, b.centre.x + rx); z0 = Math.min(z0, b.centre.z - rz); z1 = Math.max(z1, b.centre.z + rz);
    });
    this.count = n; this.data = d;
    if (!n) { this.nx = this.nz = 0; this.start = new Uint32Array(1); this.items = new Uint32Array(0); return; }
    this.x0 = x0; this.z0 = z0;
    const nx = this.nx = Math.max(1, Math.ceil((x1 - x0) / CELL)), nz = this.nz = Math.max(1, Math.ceil((z1 - z0) / CELL));
    const cells = (i, f) => {
      const a = Math.max(0, Math.floor((d[i * 12 + 8] - x0) / CELL)), b = Math.min(nx - 1, Math.floor((d[i * 12 + 9] - x0) / CELL));
      const c = Math.max(0, Math.floor((d[i * 12 + 10] - z0) / CELL)), e = Math.min(nz - 1, Math.floor((d[i * 12 + 11] - z0) / CELL));
      for (let j = c; j <= e; j++) for (let k = a; k <= b; k++) f(j * nx + k);
    };
    const start = this.start = new Uint32Array(nx * nz + 1);
    for (let i = 0; i < n; i++) cells(i, k => start[k + 1]++);
    for (let k = 0; k < nx * nz; k++) start[k + 1] += start[k];
    const fill = start.slice(0, -1), items = this.items = new Uint32Array(start[nx * nz]);
    for (let i = 0; i < n; i++) cells(i, k => { items[fill[k]++] = i; });
  }
  get empty() { return this.count === 0; }
  contains(x, y, z) {
    if (!this.count) return false;
    const i = Math.floor((x - this.x0) / CELL), j = Math.floor((z - this.z0) / CELL);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return false;
    const d = this.data, k = j * this.nx + i;
    for (let q = this.start[k], e = this.start[k + 1]; q < e; q++) {
      const o = this.items[q] * 12;
      if (x < d[o + 8] || x > d[o + 9] || z < d[o + 10] || z > d[o + 11] || y < d[o + 2] || y > d[o + 3]) continue;
      const dx = x - d[o], dz = z - d[o + 1];
      if (Math.abs(dx * d[o + 6] - dz * d[o + 7]) <= d[o + 4] && Math.abs(dx * d[o + 7] + dz * d[o + 6]) <= d[o + 5]) return true;
    }
    return false;
  }
  /** Diagnostic: the packed boxes as {x,z,minY,maxY,halfX,halfZ,cos,sin}. */
  boxes() {
    const out = [];
    for (let i = 0; i < this.count; i++) { const d = this.data, o = i * 12; out.push({ x: d[o], z: d[o + 1], minY: d[o + 2], maxY: d[o + 3], halfX: d[o + 4], halfZ: d[o + 5], cos: d[o + 6], sin: d[o + 7] }); }
    return out;
  }
}
