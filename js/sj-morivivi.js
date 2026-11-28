/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Moriviví in full bloom on the El Morro lawn and San Cristóbal's grass (placement and fold rules:
// js/sj-morivivi-rules.js). Each mat is part of the turf: a dark low patch with an irregular edge, leaves of two to four
// feathery fingers (each a row of leaflets either side of its midrib, drawn about one and a half to two times life
// size), wiry reddish runners, and pale lilac-pink flower heads with a magenta centre on thin stalks above the leaves
// (drawn about three times life size), with a few reddish-brown buds and spent tan heads.
//
// Drawn only: no collider, no soft body, no support. One mesh per lawn, built at start-up and fitted vertex by vertex to
// the drawn lawn. Folding runs in the vertex stage from the riding clock: each mat's fold state is four numbers written
// only when the mat changes state (touched, or its wait renewed), in a uniform array. Leaflets close upward in pairs
// along each midrib in a wave from the touched side, then the leaf stalks drop; folded leaves go duller and redder; the
// flower heads stay up and sway a little in the trade wind. At blue hour every mat sleeps folded (the night uniform).
import * as THREE from 'three/webgpu';
import { attribute, uniform, uniformArray, positionLocal, positionWorld, cameraPosition, vec2, vec3, vec4, float, clamp, max, smoothstep, sin, cos, dot,
  length, select, mix, varying, step, abs } from 'three/tsl';
import { atmosphere } from './sj-atmosphere.js';
import { seededRandom } from './sj-life-random.js';
import { placeMorivivi, outlineAt, touches, touchState, openState, FOLD, OUTLINE, RAY } from './sj-morivivi-rules.js';

export const NOTE = 'Moriviví · folds at a touch, opens again';
const NOTE_SECONDS = 4.5;
const DRAW = 150;                       // metres: a mat further from the camera is not drawn (it no longer reads)
const LAWN_SHOW = 260;                  // metres from a lawn's mats beyond which its mesh is hidden
const BASE_LIFT = 0.018;                // the mat's dark ground layer above the lawn
const HEAD = 0.02;                      // flower head radius (4 cm across: about three times life size reads from the riding camera)
const WIND = (() => { const x = -0.55, z = -0.83, l = Math.hypot(x, z); return [x / l, z / l]; })(); // as the kites lean
// kinds, carried in the colour's alpha byte
const LEAVES_PER_M2 = 28, HEADS_PER_M2 = 7.5;
const MIN_PX = 2.75, GROW_MAX = 3;      // flower heads never smaller than this many drawing-buffer pixels, grown at most 3×
const SIDE = 0.05, MAT_SCALE = 32767;   // leaflet offsets are stored in units of SIDE metres; mats by index
const K = { BASE: 0, LEAF: 1, RUNNER: 2, HEAD: 3, BUD: 4, STALK: 5 };
// palettes (sRGB): wet-season dark green with bronze tips; one mat in five the dry-month purplish bronze
const PAL = {
  // low layer (centre, middle ring, rim): a step darker than the mown lawn, never near-black; the rim takes the lawn's tone
  wet: { base: '#557640', mid: '#5f7f45', rim: '#6e8a54', leaf: '#6ea444', leaf2: '#82b450', rib: '#4f8034', tip: '#7f9c44' },
  // dry months: olive-bronze low layer, purplish-bronze leaves on red stems (still foliage, never soil)
  dry: { base: '#56603c', mid: '#5e6642', rim: '#6c7a4e', leaf: '#7a5e52', leaf2: '#6e6a44', rib: '#7a3e34', tip: '#946050' },
  lawn: '#7f9c5e',
  runner: ['#8a4a30', '#a2804e', '#7a3e2c'],
  head: { core: '#a8357f', tip: '#f4bfe6', mid: '#e494d4', low: '#c9709f' },
  // flower stalks and leaf stalks: green with a red cast (seen side-on from the riding camera they must not read as soil)
  bud: '#7a3b2a', budTip: '#9a5a3a', spent: '#b49a6c', stalk: '#6e7c3e', petiole: '#5e7a36',
};

/**
 * Builds the plant from the live world (call while the construction records exist, after the accents). Returns null when
 * no mat could be placed. `accents` are the kite field's records (js/sj-people-accents.js).
 */
export function createMorivivi({ world, net, accents, scene }) {
  const placed = placeMorivivi({ world, net, accents });
  const { mats, drifts } = placed;
  if (!mats.length) return null;
  const height = world.height;
  const N = mats.length;
  const lawnNames = [...new Set(mats.map((m) => m.lawn))];
  const colour = new THREE.Color(), parsed = new Map();
  // ---- geometry, one buffer set per lawn ----
  function buildLawn(name) {
    // vertex data written straight into typed arrays (grown by doubling), quantised as it is written
    let cap = 1 << 15, vn = 0, icap = 1 << 16, ni = 0;
    let P = new Float32Array(cap * 3), Nn = new Int8Array(cap * 3), C = new Uint8Array(cap * 4), F = new Int16Array(cap * 4), S = new Int16Array(cap * 4), I = new Uint32Array(icap);
    const grow = (a) => { const b = new a.constructor(a.length * 2); b.set(a); return b; };
    const q = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767), q8 = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 127);
    let tris = 0;
    const groundNormal = (x, z) => {
      const dx = height(x + 0.25, z) - height(x - 0.25, z), dz = height(x, z + 0.25) - height(x, z - 0.25), l = Math.hypot(dx / 0.5, 1, dz / 0.5);
      return [-dx / 0.5 / l, 1 / l, -dz / 0.5 / l];
    };
    // one vertex: position, normal, sRGB colour, kind, fold offset, mat index, side offset (x, z), sway weight, phase
    const vert = (x, y, z, n, hex, jitter, kind, fold, mat, sx = 0, sz = 0, sway = 0, phase = 0) => {
      let c = parsed.get(hex); if (!c) parsed.set(hex, c = new THREE.Color(hex));
      colour.copy(c);
      if (jitter) { colour.r = Math.max(0, colour.r + jitter * 0.6); colour.g = Math.max(0, colour.g + jitter * 0.6); colour.b = Math.max(0, colour.b + jitter * 0.6); }
      if (vn === cap) { cap *= 2; P = grow(P); Nn = grow(Nn); C = grow(C); F = grow(F); S = grow(S); }
      const o3 = vn * 3, o4 = vn * 4;
      P[o3] = x; P[o3 + 1] = y; P[o3 + 2] = z; Nn[o3] = q8(n[0]); Nn[o3 + 1] = q8(n[1]); Nn[o3 + 2] = q8(n[2]);
      C[o4] = Math.min(255, Math.round(colour.r * 255)); C[o4 + 1] = Math.min(255, Math.round(colour.g * 255)); C[o4 + 2] = Math.min(255, Math.round(colour.b * 255)); C[o4 + 3] = kind;
      F[o4] = q(fold[0]); F[o4 + 1] = q(fold[1]); F[o4 + 2] = q(fold[2]); F[o4 + 3] = mat;
      S[o4] = q(sx / SIDE); S[o4 + 1] = q(sz / SIDE); S[o4 + 2] = q(sway); S[o4 + 3] = q(phase / (Math.PI * 2));
      return vn++;
    };
    const tri = (a, b, c) => { if (ni + 3 > icap) { icap *= 2; I = grow(I); } I[ni++] = a; I[ni++] = b; I[ni++] = c; tris++; };
    const ZERO = [0, 0, 0];
    for (let mi = 0; mi < N; mi++) {
      const m = mats[mi]; if (m.lawn !== name) continue;
      const rng = seededRandom('morivivi-mat-' + m.seed), between = (a, b) => a + (b - a) * rng();
      const pal = m.dry ? PAL.dry : PAL.wet, up = groundNormal(m.x, m.z);
      const at = (a, f) => { const r = outlineAt(m, a) * f; return [m.x + Math.cos(a) * r, m.z + Math.sin(a) * r]; };
      const shrink = (x, z, k, lift) => { const fx = m.x + (x - m.x) * k, fz = m.z + (z - m.z) * k; return [fx, height(fx, fz) + lift, fz]; };
      // the low layer: a fan of three rings (10, 20 and 40 points) following the outline, the rim lobed and graded to the
      // lawn's own tone so the mat frays into the grass; folded it pulls in to seven tenths
      const centre = vert(m.x, height(m.x, m.z) + BASE_LIFT, m.z, up, pal.base, 0, K.BASE, ZERO, mi);
      const lobes = 5 + Math.floor(rng() * 4), lobePhase = rng() * 6.283;
      const ringPoint = (r, i, n) => {
        const a = (i / n) * Math.PI * 2, f = RAY[r + 1], last = r === 2;
        const k = last ? f * (1 + 0.05 * Math.sin(a * lobes + lobePhase) + (i % 2 ? -0.025 : 0.02)) : f;
        const [x, z] = at(a, k), y = height(x, z) + BASE_LIFT, [fx, fy, fz] = shrink(x, z, 0.7, BASE_LIFT);
        return vert(x, y, z, up, last ? (i % 3 ? PAL.lawn : pal.rim) : r === 1 ? pal.mid : pal.base, between(-0.02, 0.02), K.BASE, [fx - x, fy - y, fz - z], mi);
      };
      const ring = [10, 20, 40].map((n, r) => Array.from({ length: n }, (_, i) => ringPoint(r, i, n)));
      for (let i = 0; i < 10; i++) tri(centre, ring[0][(i + 1) % 10], ring[0][i]);
      for (let r = 1; r < 3; r++) {
        const inner = ring[r - 1], outer = ring[r], n = inner.length;
        for (let i = 0; i < n; i++) {
          const a0 = inner[i], a1 = inner[(i + 1) % n], o0 = outer[2 * i], o1 = outer[2 * i + 1], o2 = outer[(2 * i + 2) % (2 * n)];
          tri(a0, o1, o0); tri(a0, a1, o1); tri(a1, o2, o1);
        }
      }
      // wiry reddish runners from the crown out past the rim, each with a kink
      const runners = 5 + Math.floor(rng() * 3);
      for (let q = 0; q < runners; q++) {
        const a = ((q + rng() * 0.6) / runners) * Math.PI * 2, hex = PAL.runner[q % PAL.runner.length], w = 0.0018, bend = between(-0.3, 0.3);
        let prev = null;
        for (const [f, da] of [[0.35, 0], [0.8, bend], [1.18, bend * 0.5]]) {
          const [x, z] = at(a + da, f), y = height(x, z) + BASE_LIFT + 0.006, n = groundNormal(x, z), px = -Math.sin(a + da) * w, pz = Math.cos(a + da) * w;
          const pair = [vert(x - px, y, z - pz, n, hex, 0, K.RUNNER, ZERO, mi), vert(x + px, y, z + pz, n, hex, 0, K.RUNNER, ZERO, mi)];
          if (prev) { tri(prev[0], pair[0], pair[1]); tri(prev[0], pair[1], prev[1]); }
          prev = pair;
        }
      }
      // the leaves: hands of two to four fingers; each finger two halves along its midrib, each half two leaflet teeth.
      // Lighter and greener than the low layer; a third of them sit at the rim pointing out, so it overhangs all round.
      const area = Math.PI * m.r * m.r * m.outline.reduce((s, o) => s + o * o, 0) / OUTLINE;
      const leaves = Math.max(22, Math.min(110, Math.round(area * LEAVES_PER_M2)));
      const rimLeaves = Math.round(leaves * 0.34);
      for (let l = 0; l < leaves; l++) {
        const rim = l < rimLeaves;
        const a = rim ? ((l + rng() * 0.8) / rimLeaves) * Math.PI * 2 : rng() * Math.PI * 2;
        const [ax, az] = at(a, rim ? between(0.84, 0.96) : 0.1 + 0.78 * Math.pow(rng(), 0.7)), dir = a + (rim ? between(-0.5, 0.5) : between(-1.2, 1.2));
        const h = rim ? between(0.035, 0.06) : between(0.045, 0.08), n = groundNormal(ax, az);
        const pl = between(0.04, 0.07), bx = ax + Math.cos(dir) * pl, bz = az + Math.sin(dir) * pl;
        const ay = height(ax, az) + BASE_LIFT + 0.003;
        // folded, everything above the attach point pulls halfway in towards it and drops to just above the ground
        const foldOf = (x, y, z) => { const fx = ax + (x - ax) * 0.5, fz = az + (z - az) * 0.5; return [fx - x, height(fx, fz) + BASE_LIFT + 0.022 - y, fz - z]; };
        const ps = 0.002, psx = -Math.sin(dir) * ps, psz = Math.cos(dir) * ps;
        const pa = vert(ax - psx, ay, az - psz, n, PAL.petiole, 0, K.RUNNER, ZERO, mi), pb = vert(ax + psx, ay, az + psz, n, PAL.petiole, 0, K.RUNNER, ZERO, mi);
        const by = height(bx, bz) + h;
        const B = vert(bx, by, bz, n, pal.rib, 0, K.LEAF, foldOf(bx, by, bz), mi);
        tri(pa, pb, B);
        const u = rng(), fingers = u < 0.35 ? 2 : u < 0.8 ? 3 : 4, spread = between(0.75, 1.25), hex = rng() < 0.5 ? pal.leaf : pal.leaf2;
        for (let j = 0; j < fingers; j++) {
          const fa = dir + spread * (j / (fingers - 1) - 0.5), L = between(0.105, 0.14), w = between(0.022, 0.029);
          const cx = Math.cos(fa), cz = Math.sin(fa), nx = -cz, nz = cx;
          const ribAt = (s) => { const x = bx + cx * L * s, z = bz + cz * L * s; return [x, height(x, z) + h * (1 - 0.18 * s), z]; };
          const M = ribAt(0.52), T = ribAt(1), E1 = ribAt(0.28), E2 = ribAt(0.76);
          const mid = vert(M[0], M[1], M[2], n, pal.rib, 0, K.LEAF, foldOf(...M), mi);
          const tip = vert(T[0], T[1], T[2], n, pal.tip, between(-0.03, 0.03), K.LEAF, foldOf(...T), mi);
          for (const side of [-1, 1]) {
            const edge = (r, ww) => { const sx = nx * ww * side, sz = nz * ww * side;
              return vert(r[0] + sx, r[1] + 0.004, r[2] + sz, n, hex, between(-0.05, 0.05), K.LEAF, foldOf(...r), mi, sx, sz); };
            const e1 = edge(E1, w), e2 = edge(E2, w * 0.8);
            if (side < 0) { tri(B, e1, mid); tri(mid, e2, tip); } else { tri(B, mid, e1); tri(mid, tip, e2); }
          }
        }
      }
      // full bloom: many heads open at once (18 to 30 on a big mat), a few buds and a few spent heads, each on its own
      // stalk above the leaves. A head is a puff: a ring of pale filament tips round a darker magenta core.
      const heads = Math.max(6, Math.min(30, Math.round(area * HEADS_PER_M2))), buds = 2 + Math.floor(rng() * 3), spent = 1 + Math.floor(rng() * 2);
      for (let q = 0; q < heads + buds + spent; q++) {
        const kind = q < heads ? 'head' : q < heads + buds ? 'bud' : 'spent';
        const a = rng() * Math.PI * 2, [x, z] = at(a, Math.sqrt(rng()) * 0.88), g = height(x, z), n = groundNormal(x, z);
        const top = kind === 'head' ? between(0.11, 0.14) : kind === 'bud' ? between(0.075, 0.1) : between(0.07, 0.095);
        const rad = kind === 'head' ? HEAD * between(0.9, 1.1) : kind === 'bud' ? 0.007 : 0.011;
        const tall = kind === 'bud' ? 1.7 : 0.9, cy = g + top, phase = rng() * 6.283, sway = top / 0.14;
        // stalk: one thin blade from the ground to the head
        const s0 = vert(x - 0.0015, g + BASE_LIFT, z, n, PAL.stalk, 0, K.STALK, ZERO, mi, 0, 0, 0, phase);
        const s1 = vert(x + 0.0015, g + BASE_LIFT, z + 0.001, n, PAL.stalk, 0, K.STALK, ZERO, mi, 0, 0, 0, phase);
        const s2 = vert(x, cy - rad * 0.6, z, n, PAL.stalk, 0, K.STALK, ZERO, mi, 0, 0, sway, phase);
        tri(s0, s1, s2);
        // every vertex of a head carries its distance from the head's centre (and the head's radius) so the vertex stage can
        // grow it about its centre; its normal points out from the centre
        const k = kind === 'head' ? K.HEAD : K.BUD;
        const part = (ox, oy, oz, hex, jitter = 0) => { const l = Math.hypot(ox, oy, oz) || 1;
          return vert(x + ox, cy + oy, z + oz, [ox / l, oy / l, oz / l], hex, jitter, k, ZERO, mi, l, rad, sway, phase); };
        const turn = rng() * Math.PI;
        if (kind === 'head') {
          const T = part(0, rad * tall * 0.85, 0, PAL.head.core), Bt = part(0, -rad * tall, 0, PAL.head.low);
          const eq = [];
          for (let i = 0; i < 8; i++) {
            const e = turn + (i / 8) * Math.PI * 2, spike = i % 2 === 0, rr = rad * (spike ? between(1.12, 1.3) : 0.78);
            eq.push(part(Math.cos(e) * rr, rad * (spike ? between(-0.25, 0.3) : 0.1), Math.sin(e) * rr, spike ? PAL.head.tip : PAL.head.mid, spike ? between(-0.02, 0.03) : 0));
          }
          for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; tri(T, eq[j], eq[i]); tri(Bt, eq[i], eq[j]); }
        } else {
          const hexTop = kind === 'bud' ? PAL.budTip : PAL.spent, hexMid = kind === 'bud' ? PAL.bud : PAL.spent;
          const T = part(0, rad * tall, 0, hexTop), Bt = part(0, -rad * tall, 0, hexMid), eq = [];
          for (let i = 0; i < 4; i++) { const e = turn + (i / 4) * Math.PI * 2; eq.push(part(Math.cos(e) * rad, 0, Math.sin(e) * rad, hexMid)); }
          for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; tri(T, eq[j], eq[i]); tri(Bt, eq[i], eq[j]); }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P.slice(0, vn * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(Nn.slice(0, vn * 3), 3, true));
    geo.setAttribute('color', new THREE.BufferAttribute(C.slice(0, vn * 4), 4, true));
    geo.setAttribute('aFold', new THREE.BufferAttribute(F.slice(0, vn * 4), 4, true));
    geo.setAttribute('aSide', new THREE.BufferAttribute(S.slice(0, vn * 4), 4, true));
    const count = vn;
    geo.setIndex(new THREE.BufferAttribute(count > 65535 ? I.slice(0, ni) : Uint16Array.from(I.subarray(0, ni)), 1));
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += 0.5;
    return { geo, tris, vertices: count };
  }

  // ---- fold state: four numbers per mat (fold start, open start, the fold it had, wave direction) ----
  const stateValues = [], centreValues = [], state = [];
  for (const m of mats) {
    const s = openState(); state.push(s);
    stateValues.push(new THREE.Vector4(s.f0, s.o0, s.floor, s.angle));
    centreValues.push(new THREE.Vector4(m.x, m.y, m.z, m.r * 1.15));
  }
  const states = uniformArray(stateValues, 'vec4'), centres = uniformArray(centreValues, 'vec4');
  const write = (i) => { const s = state[i]; stateValues[i].set(s.f0, s.o0, s.floor, s.angle); };

  // ---- the material: lit like the rest of the planting, shadows received, none cast ----
  const material = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  const pixelScale = uniform(400), LAWN = new THREE.Color(PAL.lawn);
  {
    const aFold = attribute('aFold', 'vec4'), aSide = attribute('aSide', 'vec4'), col = attribute('color', 'vec4');
    const index = aFold.w.mul(MAT_SCALE).round().toInt(), st = states.element(index), c = centres.element(index), t = atmosphere.elapsed;
    const kind = col.a.mul(255), isLeaf = float(1).sub(step(0.5, abs(kind.sub(K.LEAF)))), isHead = float(1).sub(step(0.5, abs(kind.sub(K.HEAD))));
    const sideXZ = aSide.xy.mul(SIDE).mul(isLeaf), phase = aSide.w.mul(Math.PI * 2);
    // the leaf's place along the wave: −1 on the touched side, +1 on the far side
    const rib = positionLocal.xz.sub(sideXZ);
    const w = clamp(dot(rib.sub(c.xz).div(c.w), vec2(cos(st.w), sin(st.w))), -1, 1);
    const fold = clamp(t.sub(st.x).sub(w.add(1).mul(0.5 * FOLD.wave)).div(FOLD.leaf), 0, 1);
    const open = clamp(t.sub(st.y).sub(float(1).sub(w).mul(0.5 * FOLD.openWave)).div(FOLD.openLeaf), 0, 1);
    const f = max(float(1).sub(open).mul(max(st.z, fold)), atmosphere.night);
    const closing = smoothstep(0, 0.55, f), dropping = smoothstep(0.35, 1, f);
    // leaflets close upward in pairs along the midrib; then the stalk drops towards its attach point
    const side = vec3(sideXZ.x, 0, sideXZ.y), shut = vec3(sideXZ.x.mul(0.16), length(sideXZ).mul(0.85), sideXZ.y.mul(0.16));
    const gust = sin(t.mul(1.3).add(phase)).mul(0.6).add(sin(t.mul(2.9).add(phase.mul(1.7))).mul(0.25));
    const sway = vec3(WIND[0], 0, WIND[1]).mul(gust.mul(0.012).mul(aSide.z));
    // a flower head never falls below MIN_PX on the drawing buffer: it grows about its own centre with distance (at most
    // GROW_MAX times), easing back before the far limit. pixelScale = buffer height × projection[1][1] / 2.
    const out = attribute('normal', 'vec3').normalize(), reach = aSide.x.mul(SIDE).mul(isHead), radius = aSide.y.mul(SIDE).max(0.001);
    const headCentre = positionLocal.sub(out.mul(reach)), far = length(headCentre.sub(cameraPosition));
    const need = far.mul(MIN_PX).div(radius.mul(2).mul(pixelScale));
    const grow = clamp(need, 1, GROW_MAX).sub(1).mul(float(1).sub(smoothstep(DRAW * 0.8, DRAW, far))).mul(isHead);
    const moved = positionLocal.add(aFold.xyz.mul(dropping)).add(shut.sub(side).mul(closing)).add(out.mul(reach.mul(grow))).add(sway);
    // a mat far from the camera collapses to its centre (nothing drawn there)
    material.positionNode = select(length(c.xyz.sub(cameraPosition)).greaterThan(DRAW), c.xyz, moved);
    const folded = varying(f.mul(step(kind, 1.5)));           // base and leaves go duller and redder as they fold
    // the low layer is understorey: irregular leaflet flecks close (domain-warped gratings at incommensurate angles,
    // fading out by 18 m), and with distance it eases towards the lawn's own tone so a drift reads as a slightly darker
    // patch, not a hole
    const P = positionWorld.xz, view = length(positionWorld.sub(cameraPosition)), isBase = float(1).sub(step(0.5, kind)), isBaseV = varying(isBase);
    const warpX = P.x.add(sin(P.y.mul(3.7).add(P.x.mul(1.3))).mul(0.21)), warpZ = P.y.add(sin(P.x.mul(4.3).sub(P.y.mul(2.1))).mul(0.19));
    const rows = sin(warpX.mul(83).add(warpZ.mul(37)).add(sin(warpX.mul(7.3).sub(warpZ.mul(11.9))).mul(3.1)));
    const breaks = sin(warpZ.mul(41).sub(warpX.mul(29)).add(sin(warpZ.mul(5.1).add(warpX.mul(8.7))).mul(2.3)));
    const fleck = rows.mul(0.55).add(breaks.mul(0.45)).add(sin(warpX.mul(19.7).add(warpZ.mul(23.3))).mul(0.35));
    const carpet = smoothstep(0.2, 0.95, fleck).mul(float(1).sub(smoothstep(5, 18, view))).mul(isBase);
    const toLawn = smoothstep(10, 45, view).mul(0.55).mul(isBase);
    const lawn = vec3(LAWN.r, LAWN.g, LAWN.b);
    const base = mix(mix(col.rgb, col.rgb.mul(1.3), carpet), lawn.mul(0.86), toLawn);
    // folding opens the canopy: the leaves go duller and redder, and the low layer between them gives way to the grass
    // and stems underneath (most of the way to the lawn's tone, a little duller and redder), so its rim stops being an edge
    const leafFolded = mix(base, base.mul(vec3(0.92, 0.66, 0.58)), folded.mul(0.8));
    const groundFolded = mix(base, lawn.mul(vec3(0.97, 0.93, 0.87)), folded.mul(0.9));
    material.colorNode = vec4(mix(leafFolded, groundFolded, isBaseV), 1);
    // the flower heads keep a little of their own colour at every hour (more in the blue hour's dark)
    const head = varying(isHead);
    material.emissiveNode = base.mul(head.mul(float(0.1).add(atmosphere.night.mul(0.12))));
  }
  const meshes = {}, counts = { drifts: drifts.length, mats: N, triangles: 0, vertices: 0, byLawn: {} };
  for (const name of lawnNames) {
    const { geo, tris, vertices } = buildLawn(name);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'Morivivi-' + name; mesh.castShadow = false; mesh.receiveShadow = true;
    scene.add(mesh);
    const own = mats.filter((m) => m.lawn === name);
    meshes[name] = { mesh, x0: Math.min(...own.map((m) => m.x)) - LAWN_SHOW, x1: Math.max(...own.map((m) => m.x)) + LAWN_SHOW,
      z0: Math.min(...own.map((m) => m.z)) - LAWN_SHOW, z1: Math.max(...own.map((m) => m.z)) + LAWN_SHOW };
    counts.triangles += tris; counts.vertices += vertices; counts.byLawn[name] = { mats: own.length, triangles: tris, vertices };
  }
  // ---- touch lookup: mats in 8 m cells ----
  const grid = new Map(), cellOf = (x, z) => Math.floor(x / 8) * 100003 + Math.floor(z / 8);
  mats.forEach((m, i) => {
    const r = m.r * 1.2 + FOLD.reach;
    for (let x = Math.floor((m.x - r) / 8); x <= Math.floor((m.x + r) / 8); x++) for (let z = Math.floor((m.z - r) / 8); z <= Math.floor((m.z + r) / 8); z++) {
      const k = x * 100003 + z; let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(i);
    }
  });
  let warming = false, noteUntil = -1, noteShown = false, folds = 0, writes = 0, lastHeight = 800;
  const plant = {
    mats, drifts, counts, stats: placed.stats,
    /** The HUD's quiet line ('' when none): shown once per page, the first time a mat folds under the rider. */
    note: '',
    /**
     * Once per riding frame, after the rider stepped: a grounded wheel (or a sliding fallen rider) folds the mats it
     * reaches. `chase` is true while a chase or booking notice is up: the line then waits for a later fold.
     */
    frame(entity, chase = false) {
      const t = atmosphere.elapsed.value, night = atmosphere.night.value >= 0.5;
      if (plant.note && (t >= noteUntil || chase || night)) plant.note = '';
      if (!entity || night) return;
      const c = entity.controller, p = entity.position, onGround = !!(c?.isGrounded || c?.crashed);
      if (!onGround) return;
      const list = grid.get(cellOf(p.x, p.z)); if (!list) return;
      for (let q = 0; q < list.length; q++) {
        const i = list[q], m = mats[i];
        if (!touches(m, p.x, p.y, p.z, onGround)) continue;
        const d = Math.hypot(m.x - p.x, m.z - p.z), angle = d > 0.05 ? Math.atan2(m.z - p.z, m.x - p.x) : Math.atan2(Math.cos(entity.heading), Math.sin(entity.heading));
        const change = touchState(state[i], t, angle, m.wait);
        if (!change) continue;
        write(i); writes++;
        if (change === 'fold') {
          folds++;
          if (!noteShown && !chase) { noteShown = true; plant.note = NOTE; noteUntil = t + NOTE_SECONDS; }
        }
      }
    },
    /** Each drawn frame: a lawn's mesh only near the camera; the flower heads' pixel floor follows the drawing buffer. */
    view(camera, bufferHeight = 0) {
      const k = (bufferHeight || lastHeight) * camera.projectionMatrix.elements[5] / 2;
      if (bufferHeight) lastHeight = bufferHeight;
      if (k > 0 && k !== pixelScale.value) pixelScale.value = k;
      if (warming) return;
      const x = camera.position.x, z = camera.position.z;
      for (const name in meshes) { const o = meshes[name]; o.mesh.visible = x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1; }
    },
    warm(on) { warming = !!on; if (on) for (const name in meshes) meshes[name].mesh.visible = true; },
    /** Every mat open again (a fresh lawn); for tests and tools. */
    reset() { for (let i = 0; i < N; i++) { Object.assign(state[i], openState()); write(i); } plant.note = ''; },
    /** Every mat shut as if just touched (stills of the folded look). */
    shutAll() { const t = atmosphere.elapsed.value; for (let i = 0; i < N; i++) { Object.assign(state[i], { f0: t - 5, o0: t + 1e6, floor: 1 }); write(i); } },
    foldOf: (i) => state[i],
    /** The riding clock the fold states are written in. */
    clock: () => atmosphere.elapsed.value,
    get folds() { return folds; },
    /** Fold states written so far (folds and renewals). */
    get writes() { return writes; },
    dispose() { for (const name in meshes) { meshes[name].mesh.removeFromParent(); meshes[name].mesh.geometry.dispose(); } material.dispose(); },
  };
  return plant;
}

/** Host part (js/main.js `parts`): drives the plant from the riding loop. Nothing when the plant was not built. */
export function createMoriviviPart(host) {
  const plant = host.life?.plant;
  if (!plant) return null;
  const chase = host.$('chase');
  return {
    frame() { plant.frame(host.entity, !!chase && !chase.hidden); },
    view(camera) { plant.view(camera, host.renderer?.domElement?.height ?? 0); },
    warm(on) { plant.warm(on); },
  };
}
