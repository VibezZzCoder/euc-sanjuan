/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Officer Dorkins: where his routes run. A compact graph built once at boot, as typed arrays, from what the city
// already has:
//   walk links   the walk network of the people (js/sj-walk.js): sidewalks, quiet-street edges, footways, promenades,
//                crossings, plaza walks, the Puerta de San Juan bore and its checked joins; public stairs are left out
//                (they are the rider's escape, not his road; he crosses one only in a clear direct flight)
//   lane links   the traffic lane graph (js/sj-traffic-graph.js), sampled every ≤ 8 m: it ties together the parts of
//                the town the walks leave apart (the walk network does not need to be connected; the streets are)
//   joins        short links between those two, and between walk pieces, where they come within a few metres of each
//                other on the same level
// Both sources keep their layers apart (each is traced on one support layer per link), and joins only meet nodes within
// a step of the same height, so the bores and the streets above them stay separate. Neither network is copied: walk
// nodes and links are read in place; only the lane samples he uses and the joins get arrays of their own.
//
// The search is bounded A* with reusable typed scratch, as in the San Francisco edition (js/sf-nemesis-brain.js,
// © 2026 VibezZzCoder, MIT). A link's flight sweep is checked the first time a search needs it and the answer is kept
// (the city's static geometry never changes), so routes get cheaper as he patrols. Walk routes carry the walk's own
// surface heights every few metres, so a straight sweep never cuts into a crest.
import { WALK, walkHeight } from './sj-walk.js';

export const PURSUIT = Object.freeze({ cell: 32, piece: 8, laneStep: 8, joinRadius: 9, joinRise: 1.2, joinsPerNode: 2,
  maxPops: 6000, maxChecks: 900, heap: 8192, routeHeight: 1.1 });
const EDGE = Object.freeze({ WALK: 0, LANE: 1, JOIN: 2 });
/** run() returns this while a search is still under way. */
export const PENDING = Object.freeze([]);

/**
 * `walk` is the walk network and `lanes` the traffic lane graph (either may be null). Returns the graph:
 * { nodes, edges, x, y, z (Float32Array per node), component, nearby(...), pathfinder(clear), bytes, ms, stats }.
 */
export function buildPursuitGraph({ walk = null, lanes = null } = {}, { exclude = [WALK.STAIR] } = {}) {
  const t0 = performance.now();
  if (walk && !(walk.nx instanceof Float32Array && walk.adjStart instanceof Int32Array)) throw new TypeError('invalid walk network');
  if (lanes && !(lanes.SX instanceof Float32Array && lanes.start instanceof Int32Array)) throw new TypeError('invalid lane graph');
  const NW = walk?.nodes ?? 0, LW = walk?.links ?? 0;
  // ---- lane nodes: every path sampled at its ends and every ≤ laneStep metres between
  const P = lanes?.P ?? 0, first = new Int32Array(P), last = new Int32Array(P);
  let laneNodes = 0;
  for (let p = 0; p < P; p++) laneNodes += Math.max(1, Math.ceil((lanes.count[p] - 1) / PURSUIT.laneStep)) + 1;
  const N = NW + laneNodes;
  const x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N);
  if (walk) { x.set(walk.nx); y.set(walk.ny); z.set(walk.nz); }
  const extraA = [], extraB = [], extraKind = [];
  let n = NW;
  for (let p = 0; p < P; p++) {
    const s0 = lanes.start[p], c = lanes.count[p], pieces = Math.max(1, Math.ceil((c - 1) / PURSUIT.laneStep));
    first[p] = n;
    for (let i = 0; i <= pieces; i++) {
      const k = s0 + Math.round((c - 1) * i / pieces);
      x[n] = lanes.SX[k]; y[n] = lanes.SY[k]; z[n] = lanes.SZ[k];
      if (i) { extraA.push(n - 1); extraB.push(n); extraKind.push(EDGE.LANE); }
      n++;
    }
    last[p] = n - 1;
  }
  for (let p = 0; p < P; p++) for (let j = lanes.outStart[p]; j < lanes.outStart[p + 1]; j++) {
    const q = lanes.outs[j]; extraA.push(last[p]); extraB.push(first[q]); extraKind.push(EDGE.LANE);
  }
  const usable = new Uint8Array(LW), skip = new Set(exclude);
  for (let k = 0; k < LW; k++) usable[k] = skip.has(walk.kind[k]) || !(walk.len[k] > 0.05) ? 0 : 1;

  // ---- spatial grid (CSR) over every node; rebuilt once after the joins are known (node set does not change)
  const cell = PURSUIT.cell;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < N; i++) { minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]); minZ = Math.min(minZ, z[i]); maxZ = Math.max(maxZ, z[i]); }
  if (!N) minX = minZ = maxX = maxZ = 0;
  const cols = Math.max(1, Math.floor((maxX - minX) / cell) + 1), rows = Math.max(1, Math.floor((maxZ - minZ) / cell) + 1);
  const cellStart = new Int32Array(cols * rows + 1), cellNodes = new Int32Array(N);
  const cellOf = i => Math.floor((x[i] - minX) / cell) + Math.floor((z[i] - minZ) / cell) * cols;
  for (let i = 0; i < N; i++) cellStart[cellOf(i) + 1]++;
  for (let c = 0; c < cols * rows; c++) cellStart[c + 1] += cellStart[c];
  { const fill = cellStart.slice(0, cols * rows); for (let i = 0; i < N; i++) cellNodes[fill[cellOf(i)]++] = i; }

  // ---- components (union-find) over walk + lane links; joins then tie different components together
  const parent = new Int32Array(N); for (let i = 0; i < N; i++) parent[i] = i;
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const unite = (i, j) => { const a = find(i), b = find(j); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  for (let k = 0; k < LW; k++) if (usable[k]) unite(walk.a[k], walk.b[k]);
  for (let e = 0; e < extraA.length; e++) unite(extraA[e], extraB[e]);
  const degree = new Int32Array(N);
  for (let k = 0; k < LW; k++) if (usable[k]) { degree[walk.a[k]]++; degree[walk.b[k]]++; }
  for (let e = 0; e < extraA.length; e++) { degree[extraA[e]]++; degree[extraB[e]]++; }
  const before = find.bind(null), root0 = new Int32Array(N); for (let i = 0; i < N; i++) root0[i] = before(i);
  // joins: from each node, the nearest nodes of other pieces within joinRadius and a step of height (at most
  // joinsPerNode, one per piece). Walk-to-walk joins only between different pieces; lane nodes join any walk node.
  const R = PURSUIT.joinRadius, near = [], nearD = [];
  let joins = 0;
  for (let i = 0; i < N; i++) {
    if (!degree[i]) continue;
    near.length = nearD.length = 0;
    const c0 = Math.max(0, Math.floor((x[i] - R - minX) / cell)), c1 = Math.min(cols - 1, Math.floor((x[i] + R - minX) / cell));
    const r0 = Math.max(0, Math.floor((z[i] - R - minZ) / cell)), r1 = Math.min(rows - 1, Math.floor((z[i] + R - minZ) / cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) for (let j = cellStart[c + r * cols]; j < cellStart[c + r * cols + 1]; j++) {
      const o = cellNodes[j]; if (o <= i || !degree[o] || root0[o] === root0[i]) continue;
      if ((i >= NW) === (o >= NW) && i >= NW) continue; // lane to lane: their own connectors already decide
      const d = Math.hypot(x[o] - x[i], z[o] - z[i]);
      if (d > R || d < 0.05 || Math.abs(y[o] - y[i]) > Math.min(PURSUIT.joinRise, 0.25 + 0.3 * d)) continue;
      let at = near.length; while (at && nearD[at - 1] > d) at--;
      near.splice(at, 0, o); nearD.splice(at, 0, d);
    }
    const seen = [];
    for (const o of near) {
      if (seen.length >= PURSUIT.joinsPerNode) break;
      if (seen.includes(root0[o])) continue;
      seen.push(root0[o]); extraA.push(i); extraB.push(o); extraKind.push(EDGE.JOIN); joins++; unite(i, o);
    }
  }
  const XE = extraA.length, E = LW + XE;
  const ea = Int32Array.from(extraA), eb = Int32Array.from(extraB), ek = Uint8Array.from(extraKind), elen = new Float32Array(XE);
  for (let e = 0; e < XE; e++) elen[e] = Math.hypot(x[eb[e]] - x[ea[e]], z[eb[e]] - z[ea[e]]);
  // adjacency (CSR) of edge ids: walk links 0..LW-1, then the extra edges
  const adjStart = new Int32Array(N + 1);
  for (let k = 0; k < LW; k++) if (usable[k]) { adjStart[walk.a[k] + 1]++; adjStart[walk.b[k] + 1]++; }
  for (let e = 0; e < XE; e++) { adjStart[ea[e] + 1]++; adjStart[eb[e] + 1]++; }
  for (let i = 0; i < N; i++) adjStart[i + 1] += adjStart[i];
  const adjEdge = new Int32Array(adjStart[N]);
  { const fill = adjStart.slice(0, N);
    for (let k = 0; k < LW; k++) if (usable[k]) { adjEdge[fill[walk.a[k]]++] = k; adjEdge[fill[walk.b[k]]++] = k; }
    for (let e = 0; e < XE; e++) { adjEdge[fill[ea[e]]++] = LW + e; adjEdge[fill[eb[e]]++] = LW + e; } }
  const component = new Int32Array(N).fill(-1);
  let components = 0, reach = 0;
  { const label = new Map(); for (let i = 0; i < N; i++) if (adjStart[i + 1] > adjStart[i]) { const r = find(i); if (!label.has(r)) label.set(r, components++); component[i] = label.get(r); reach++; } }
  const edgeA = e => e < LW ? walk.a[e] : ea[e - LW];
  const edgeB = e => e < LW ? walk.b[e] : eb[e - LW];
  const edgeLen = e => e < LW ? walk.len[e] : elen[e - LW];
  /** Surface height `s` metres along edge e measured from node `from` (one of its ends). */
  function heightAlong(e, from, s) {
    if (e < LW) return walkHeight(walk, e, walk.a[e] === from ? s : walk.len[e] - s);
    const a = ea[e - LW], b = eb[e - LW], len = elen[e - LW] || 1, t = Math.max(0, Math.min(1, s / len));
    return from === a ? y[a] + (y[b] - y[a]) * t : y[b] + (y[a] - y[b]) * t;
  }

  /** At most `limit` (≤ 256) node ids within `radius`, nearest first (then lower id); the layer filter comes first. */
  const found = [], foundD = [];
  function nearby(px, pz, radius = 200, limit = 32, { minDistance = 0, referenceY = null, maxHeight = Infinity } = {}) {
    if (![px, pz, radius, limit].every(Number.isFinite) || radius < 0 || radius > 1024 || limit < 1 || limit > 256
      || !(minDistance >= 0) || minDistance > radius || (referenceY !== null && !Number.isFinite(referenceY)) || !(maxHeight >= 0)) return [];
    found.length = foundD.length = 0;
    const r2 = radius * radius, min2 = minDistance * minDistance;
    const c0 = Math.max(0, Math.floor((px - radius - minX) / cell)), c1 = Math.min(cols - 1, Math.floor((px + radius - minX) / cell));
    const r0 = Math.max(0, Math.floor((pz - radius - minZ) / cell)), r1 = Math.min(rows - 1, Math.floor((pz + radius - minZ) / cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const g = c + r * cols;
      for (let j = cellStart[g]; j < cellStart[g + 1]; j++) {
        const id = cellNodes[j]; if (component[id] < 0) continue;
        const d = (x[id] - px) ** 2 + (z[id] - pz) ** 2;
        if (d < min2 || d > r2 || (referenceY !== null && Math.abs(y[id] - referenceY) > maxHeight)) continue;
        let at = found.length;
        while (at && (foundD[at - 1] > d || (foundD[at - 1] === d && found[at - 1] > id))) at--;
        if (at < limit) { found.splice(at, 0, id); foundD.splice(at, 0, d); if (found.length > limit) { found.pop(); foundD.pop(); } }
      }
    }
    return found.slice();
  }

  /**
   * Bounded A*. `clear(p, q)` checks one flight sweep (≤ PURSUIT.piece metres) between two lifted points; its answer
   * per edge is kept for the session. Returns route points {x, y, z} on the surface (the caller lifts them), or [].
   */
  function pathfinder(clear) {
    const costs = new Float64Array(N), previous = new Int32Array(N), via = new Int32Array(N);
    const visited = new Uint32Array(N), closed = new Uint32Array(N);
    const edgeState = new Uint8Array(E); // 0 not yet checked, 1 clear, 2 blocked: static geometry, kept
    const heapIds = new Int32Array(PURSUIT.heap), heapScores = new Float64Array(PURSUIT.heap);
    const p = { x: 0, y: 0, z: 0 }, q = { x: 0, y: 0, z: 0 }, lift = PURSUIT.routeHeight;
    let stamp = 0, size = 0;
    const stats = { searches: 0, checks: 0, found: 0, failed: 0, budget: 0 };
    function push(id, score) {
      if (size === heapIds.length) return false;
      let i = size++;
      while (i) { const up = (i - 1) >> 1; if (heapScores[up] <= score) break; heapIds[i] = heapIds[up]; heapScores[i] = heapScores[up]; i = up; }
      heapIds[i] = id; heapScores[i] = score; return true;
    }
    function pop() {
      const top = heapIds[0], id = heapIds[--size], score = heapScores[size];
      if (size) {
        let i = 0;
        while (i * 2 + 1 < size) { let c = i * 2 + 1; if (c + 1 < size && heapScores[c + 1] < heapScores[c]) c++; if (heapScores[c] >= score) break; heapIds[i] = heapIds[c]; heapScores[i] = heapScores[c]; i = c; }
        heapIds[i] = id; heapScores[i] = score;
      }
      return top;
    }
    function checkEdge(e) {
      const from = edgeA(e), to = edgeB(e), len = edgeLen(e), pieces = Math.max(1, Math.ceil(len / PURSUIT.piece));
      p.x = x[from]; p.z = z[from]; p.y = heightAlong(e, from, 0) + lift;
      for (let i = 1; i <= pieces; i++) {
        const s = i / pieces;
        q.x = x[from] + (x[to] - x[from]) * s; q.z = z[from] + (z[to] - z[from]) * s; q.y = heightAlong(e, from, len * s) + lift;
        if (!clear(p, q)) return false;
        p.x = q.x; p.y = q.y; p.z = q.z;
      }
      return true;
    }
    function edgeClear(e) {
      if (edgeState[e] === 0) { stats.checks++; edgeState[e] = checkEdge(e) ? 1 : 2; }
      return edgeState[e] === 1;
    }
    // One search at a time, resumable: begin() sets it up, run(deadline) works until the search ends or the clock
    // passes `deadline` (performance.now() milliseconds) and then returns PENDING; call run again on a later frame.
    let goal = -1, start = -1, pops = 0, checks = 0, open = false, gx = 0, gy = 0, gz = 0;
    const h = i => Math.hypot(x[i] - gx, y[i] - gy, z[i] - gz);
    const fail = () => { open = false; stats.failed++; return []; };
    function begin(from, to) {
      stats.searches++; open = false;
      if (!(from >= 0 && to >= 0 && from < N && to < N) || component[from] < 0 || component[from] !== component[to]) { stats.failed++; return false; }
      stamp = (stamp + 1) >>> 0;
      if (!stamp) { visited.fill(0); closed.fill(0); stamp = 1; }
      size = 0; pops = checks = 0; start = from; goal = to; gx = x[goal]; gy = y[goal]; gz = z[goal];
      costs[start] = 0; visited[start] = stamp; previous[start] = -1; via[start] = -1; push(start, h(start));
      return open = true;
    }
    function run(deadline = Infinity) {
      if (!open) return [];
      let found = false;
      while (size) {
        if (pops >= PURSUIT.maxPops) return fail();
        if (performance.now() > deadline) return PENDING;
        pops++;
        const u = pop();
        if (closed[u] === stamp) continue;
        if (u === goal) { found = true; break; }
        closed[u] = stamp;
        for (let j = adjStart[u]; j < adjStart[u + 1]; j++) {
          const e = adjEdge[j], v = edgeA(e) === u ? edgeB(e) : edgeA(e);
          const next = costs[u] + Math.hypot(edgeLen(e), y[v] - y[u]);
          if (visited[v] === stamp && next >= costs[v]) continue;
          if (edgeState[e] === 0 && ++checks > PURSUIT.maxChecks) { stats.budget++; return fail(); }
          if (!edgeClear(e)) continue;
          costs[v] = next; previous[v] = u; via[v] = e; visited[v] = stamp;
          if (!push(v, next + h(v))) return fail();
        }
      }
      open = false;
      if (!found) { stats.failed++; return []; }
      stats.found++;
      const ids = [];
      for (let i = goal; i >= 0; i = previous[i]) ids.push(i);
      ids.reverse();
      const route = [{ x: x[start], y: y[start], z: z[start], edge: -1 }];
      for (let m = 1; m < ids.length; m++) {
        const u = ids[m - 1], v = ids[m], e = via[v], len = edgeLen(e), pieces = Math.max(1, Math.ceil(len / PURSUIT.piece));
        for (let i = 1; i <= pieces; i++) {
          const s = i / pieces;
          route.push({ x: x[u] + (x[v] - x[u]) * s, y: i === pieces ? y[v] : heightAlong(e, u, len * s), z: z[u] + (z[v] - z[u]) * s, edge: e });
        }
      }
      return route;
    }
    /** The whole search at once (tests, tools): no deadline. */
    const search = (from, to) => (begin(from, to) ? run(Infinity) : []);
    /** Mark an edge blocked after the flight along it was refused (static geometry the corridor check let through). */
    const block = e => { if (e >= 0 && e < E) edgeState[e] = 2; };
    return { begin, run, search, block, edgeClear, stats, edgeState, get busy() { return open; }, bytes: costs.byteLength + previous.byteLength + via.byteLength + visited.byteLength
      + closed.byteLength + edgeState.byteLength + heapIds.byteLength + heapScores.byteLength };
  }

  const bytes = [x, y, z, usable, component, cellStart, cellNodes, ea, eb, ek, elen, adjStart, adjEdge, first, last].reduce((s, a) => s + a.byteLength, 0);
  const stats = { walkNodes: NW, laneNodes, walkEdges: usable.reduce((s, v) => s + v, 0), laneEdges: XE - joins, joins, components, reach };
  return { nodes: N, edges: E, walkLinks: LW, x, y, z, component, components, reach, edgeA, edgeB, edgeLen, edgeKind: e => e < LW ? EDGE.WALK : ek[e - LW],
    adjStart, adjEdge, nearby, pathfinder, heightAlong, bytes, ms: performance.now() - t0, stats, point: id => ({ x: x[id], y: y[id], z: z[id] }) };
}
export { EDGE };
