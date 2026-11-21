/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from mrdoob/slop-newyork (MIT, (c) 2026 Mr.doob) and unable12/slop-sanfrancisco (MIT) */
// People on foot: singles, pairs and small groups on the sidewalks, plazas, promenades and public stairs of the old
// city. They walk with somewhere to go, pause in the shade, stop at a fountain for a photograph, sit on the plaza
// benches, talk, wait at a corner while a car comes and cross when it is clear, step aside for a rider they see coming
// and stumble when one runs into them. Density follows the place and the hour (js/sj-walk.js PLACES).
//
// Part of city life (js/sj-life.js documents the interface). The figure and its walk come from js/sj-people-figure.js;
// the reaction to the rider (anticipating sidestep, admitted-impact shove, pause and return) and the meeting scheduler
// are adapted from the San Francisco edition's js/sf-dynamic-bodies.js (itself from the New York edition's
// js/traffic.js); see provenance/actors-import.json. Where people go is San Juan's own walk network.
import * as THREE from 'three/webgpu';
import { PersonCrowd, PersonRig, POSE } from './sj-people-figure.js';
import { dressPerson } from './sj-people-look.js';
import { buildWalkNetwork, walkHeight, walkHeightAt, WALK, PLACES, TIER_PEOPLE, HOURS } from './sj-walk.js';
import { createAccents, SEAT_KIND } from './sj-people-accents.js';

const CFG = Object.freeze({
  radius: 90,         // people live within this distance of the focus
  recycle: 112,       // and are recycled beyond it
  lively: 2.6,        // people per tier count: the tiers are the relative shape, this the overall liveliness
  birthFar: { desktop: 58, phone: 45 }, // in view, a person may appear (out of a doorway, round a corner) only beyond this
  retireFar: { desktop: 70, phone: 55 }, // … and go (into a doorway, round a corner) only beyond this
  reachShare: 0.6,    // people on the walks within reach: this share of their spawn weight
  reach: 140,         // walk-network metres from the rider over which births are steered (ahead of the rider)
  cell: 48,           // spawn cells
  draw: { desktop: 125, phone: 95 },
  near: { desktop: 30, phone: 22 },
  hourShare: { midday: 1, golden: 1, blue: 0.62 },
  plazaMetres: 1200,  // lattice metres of a typical square: a tier's count spreads over that much plaza
  streetMetres: 340,  // walk metres per tier count on streets (round 3: halved, now that people are where the rider rides)
});
const STATE = { OFF: 0, WALK: 1, STAND: 2, SIT: 3, WAIT: 4, FREE: 5 };
const ACT = { NONE: 0, PHOTO: POSE.PHOTO, TALK: POSE.TALK };
const GOAL = { NODE: 0, SEAT: 1, LOOK: 2 };
const KIND_SPAWN = [0, 1, 1, 1, 1, 0.25, 0, 0.7, 0.4]; // by WALK kind: where people may appear
const KIND_ROUTE = [0, 1, 1, 1.1, 1, 0.9, 0.45, 0.7, 0.8];
const HIST = 4;      // leader route history (links) for the followers
const TWO_PI = Math.PI * 2;
// Math.hypot boxes its result where it is not inlined: plain square roots in the per-frame code
const hyp = (x, z) => Math.sqrt(x * x + z * z);
const hyp3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const wrap = (a) => a - Math.round(a / TWO_PI) * TWO_PI;

// A person's body in the shared body index. Its own class (not an object literal: literals of the same keys share
// their hidden class with the other packages' bodies, whose fields end up generic), every number field first a
// non-integer: the fields stay plain doubles and writing them every frame allocates nothing.
class PersonBody {
  constructor(slot, onEucImpact) {
    this.x = 0.5; this.z = 0.5; this.headingY = 0.5; this.halfWidthMetres = 0.3; this.halfLengthMetres = 0.22;
    this.minY = 0.5; this.maxY = 1.75; this.velocityX = 0.5; this.velocityZ = 0.5;
    this.kind = 'person'; this.slot = slot; this.onEucImpact = onEucImpact;
    this.x = this.z = this.headingY = this.minY = this.velocityX = this.velocityZ = 0;
  }
}

export async function createPeople(context) {
  const { scene, world, rider, focus, bodies } = context;
  const phone = !!context.phone;
  const cap = Math.max(0, context.caps?.people ?? 0);
  const rnd = context.random('people');
  const lookRnd = context.random('people-look');
  const socialRnd = context.random('people-social');

  // no people (?people=0, or life off): nothing is built at all, carts and kite included
  if (cap === 0) {
    return { update() {}, publish() {}, refocus() {}, clearAround() {}, setHour() {}, warm() {}, audible: () => 0, dispose() {},
      stats: () => ({ active: 0, target: 0, cap: 0, near: 0, far: 0, network: null, carts: 0, kite: false }) };
  }
  const net = buildWalkNetwork(world);
  const L = net.links;
  // the accents (piragua carts, the El Morro kite) add their people to the seat table: customer pairs after the bench
  // pairs (pairs stay aligned), then the vendors and the kite group, who keep their places while the focus is near
  // (?accents=0: the people without the carts and the kite)
  const accents = context.params?.get?.('accents') === '0'
    ? { seats: [], carts: [], kite: null, update() {}, publish() {}, warm() {}, dispose() {} }
    : createAccents({ world, net, scene });
  {
    const extra = accents.seats, n = extra.length / 7, order = [];
    for (let q = 0; q < n; q++) if (extra[q * 7 + 5] === SEAT_KIND.CUSTOMER) order.push(q);
    for (let q = 0; q < n; q++) if (extra[q * 7 + 5] !== SEAT_KIND.CUSTOMER) order.push(q);
    const count = net.seatCount + n, seats = new Float32Array(count * 5), kind = new Uint8Array(count), group = new Int16Array(count).fill(-1);
    const node = new Int32Array(count);
    seats.set(net.seats); node.set(net.seatNode);
    order.forEach((q, j) => {
      const at = net.seatCount + j;
      for (let f = 0; f < 5; f++) seats[at * 5 + f] = extra[q * 7 + f];
      kind[at] = extra[q * 7 + 5]; group[at] = extra[q * 7 + 6];
      node[at] = kind[at] === SEAT_KIND.CUSTOMER ? net.attach(extra[q * 7], extra[q * 7 + 1], extra[q * 7 + 4]) : -1;
    });
    net.seats = seats; net.seatKind = kind; net.seatGroup = group; net.seatNode = node; net.seatCount = count;
  }
  delete net.attach; // build-time only
  const PERMANENT = (q) => net.seatKind[q] >= SEAT_KIND.VENDOR;
  const STANDING = (q) => net.seatKind[q] !== SEAT_KIND.BENCH && net.seatKind[q] !== SEAT_KIND.GRASS;
  const drawFar = CFG.draw[phone ? 'phone' : 'desktop'], nearLod = CFG.near[phone ? 'phone' : 'desktop'];
  const birthFar = CFG.birthFar[phone ? 'phone' : 'desktop'], retireFar = CFG.retireFar[phone ? 'phone' : 'desktop'];
  // a person may plausibly step out or go in here: a sidewalk or kerb lane, which run beside the façades (and their
  // corners); never open paving, a lattice crossing in a square or a footway in the open
  const doorway = (k) => { const kind = net.kind[k]; return kind === WALK.SIDEWALK || kind === WALK.LANE; };

  // ---- spawn weights per link and hour, gathered in cells ----
  const plazaKind = WALK.PLAZA;
  const weight = HOURS.map(() => new Float32Array(L));
  for (let k = 0; k < L; k++) {
    const place = PLACES[net.place[k]], kind = net.kind[k];
    for (let h = 0; h < 3; h++) {
      const tier = place.tiers[h], i = Math.floor(tier), f = tier - i;
      const count = TIER_PEOPLE[i] * (1 - f) + (TIER_PEOPLE[Math.min(5, i + 1)] ?? TIER_PEOPLE[5]) * f;
      let w = CFG.lively * net.len[k] * count / (kind === plazaKind ? CFG.plazaMetres : CFG.streetMetres) * KIND_SPAWN[kind];
      if (h === 2) w *= net.lit[k] ? 1.6 : 0.65;   // blue hour: where it is lit
      else if (h === 0 && net.shade[k]) w *= 1.4;   // midday: the shade
      weight[h][k] = net.blocked?.[k] ? 0 : w;
    }
  }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let n = 0; n < net.nodes; n++) { x0 = Math.min(x0, net.nx[n]); x1 = Math.max(x1, net.nx[n]); z0 = Math.min(z0, net.nz[n]); z1 = Math.max(z1, net.nz[n]); }
  const CX = Math.max(1, Math.ceil((x1 - x0) / CFG.cell) + 1), CZ = Math.max(1, Math.ceil((z1 - z0) / CFG.cell) + 1);
  const cellOf = (x, z) => Math.max(0, Math.min(CX - 1, Math.floor((x - x0) / CFG.cell))) * CZ + Math.max(0, Math.min(CZ - 1, Math.floor((z - z0) / CFG.cell)));
  const midX = new Float32Array(L), midZ = new Float32Array(L);
  const cellCount = new Int32Array(CX * CZ + 1);
  for (let k = 0; k < L; k++) {
    midX[k] = (net.nx[net.a[k]] + net.nx[net.b[k]]) / 2; midZ[k] = (net.nz[net.a[k]] + net.nz[net.b[k]]) / 2;
    cellCount[cellOf(midX[k], midZ[k]) + 1]++;
  }
  for (let c = 0; c < CX * CZ; c++) cellCount[c + 1] += cellCount[c];
  const cellStart = cellCount, cellLinks = new Int32Array(L), fillAt = cellStart.slice(0, CX * CZ);
  for (let k = 0; k < L; k++) cellLinks[fillAt[cellOf(midX[k], midZ[k])]++] = k;
  const cellCum = HOURS.map(() => new Float32Array(L)), cellTotal = HOURS.map(() => new Float32Array(CX * CZ));
  for (let h = 0; h < 3; h++) for (let c = 0; c < CX * CZ; c++) {
    let sum = 0;
    for (let i = cellStart[c]; i < cellStart[c + 1]; i++) { sum += weight[h][cellLinks[i]]; cellCum[h][i] = sum; }
    cellTotal[h][c] = sum;
  }
  const cellCX = (c) => x0 + (Math.floor(c / CZ) + 0.5) * CFG.cell, cellCZ = (c) => z0 + ((c % CZ) + 0.5) * CFG.cell;

  // ---- people (slots) ----
  const N = cap;
  const state = new Uint8Array(N), act = new Uint8Array(N), dir = new Int8Array(N);
  const link = new Int32Array(N), s = new Float32Array(N), lat = new Float32Array(N), dodge = new Float32Array(N);
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N), yaw = new Float32Array(N);
  const vx = new Float32Array(N), vz = new Float32Array(N), pace = new Float32Array(N), timer = new Float32Array(N);
  const faceX = new Float32Array(N), faceZ = new Float32Array(N), walked = new Float32Array(N), nextPause = new Float32Array(N);
  const goalNode = new Int32Array(N), goalKind = new Uint8Array(N), goalRef = new Int32Array(N), goalBest = new Float32Array(N), goalAge = new Float32Array(N);
  const leader = new Int16Array(N), slot = new Uint8Array(N), groupSize = new Uint8Array(N);
  const hist = new Int32Array(N * HIST), histDir = new Int8Array(N * HIST);
  const ox = new Float32Array(N), oz = new Float32Array(N), svx = new Float32Array(N), svz = new Float32Array(N), cooldown = new Float32Array(N);
  const seatOf = new Int32Array(N).fill(-1), bumped = new Uint16Array(N), talking = new Uint8Array(N), heightOf = new Float32Array(N);
  const freeFX = new Float32Array(N), freeFZ = new Float32Array(N), freeFY = new Float32Array(N), freeTX = new Float32Array(N), freeTZ = new Float32Array(N), freeTY = new Float32Array(N), freeT = new Float32Array(N);
  const drawnFrame = new Uint32Array(N), rigDt = new Float32Array(N), social = new Float32Array(N), partner = new Int16Array(N).fill(-1);
  const pendingLink = new Int32Array(N).fill(-1);
  const pass = new Float32Array(N), passGoal = new Float32Array(N), slowTo = new Float32Array(N), sep = new Float32Array(N), dropBack = new Float32Array(N);
  // followers: the path distance behind their leader, eased (never set at once); a leader's walked speed this frame
  const lagNow = new Float32Array(N), leaderV = new Float32Array(N), groupHold = new Uint8Array(N), carWait = new Float32Array(N);
  // waiting and standing strangers keep their own spot: a step back along the walk
  const qBack = new Float32Array(N), latGoal = new Float32Array(N), fSide = new Int8Array(N), retreatUntil = new Float32Array(N);
  // the legs of a walk into or out of a seat: 2 = to the seat's front, 1 = into the seat / back to the walk; leaving
  const leg = new Uint8Array(N), leaving = new Uint8Array(N), fresh = new Uint8Array(N), born = new Uint32Array(N), prevLink = new Int32Array(N).fill(-1), lastLink = new Int32Array(N).fill(-1), turnedAt = new Float32Array(N).fill(-99);
  const seatOcc = new Int16Array(net.seatCount).fill(-1);
  const rigs = [], records = [];
  for (let i = 0; i < N; i++) {
    rigs.push(new PersonRig());
    records.push(new PersonBody(i, (speed, nx, nz) => react(i, speed, nx, nz)));
  }
  const crowd = new PersonCrowd(Math.max(1, N), { farDistance: nearLod, castShadow: true });
  for (const m of crowd.meshes) scene.add(m);

  let hour = Math.max(0, HOURS.indexOf(context.hour?.name ?? 'golden'));
  let active = 0, target = 0, frame = 0, clock = 0, targetClock = -1, sweep = 0, lastFocusSerial = -1;
  const counters = { spawned: 0, recycled: 0, shoved: 0, sidesteps: 0, waits: 0, crossings: 0, seated: 0, conversations: 0, photos: 0, jumps: 0, gaveUp: 0 };

  // ---- geometry helpers ----
  const nodeOf = (k, d) => (d > 0 ? net.b[k] : net.a[k]);          // the node a walker on link k, direction d, heads to
  const otherEnd = (k, n) => (net.a[k] === n ? net.b[k] : net.a[k]);
  const groundAt = (i, x, z) => {
    const st = state[i];
    if (st === STATE.SIT || st === STATE.FREE) {
      const dx = freeTX[i] - freeFX[i], dz = freeTZ[i] - freeFZ[i], l2 = dx * dx + dz * dz;
      const t = l2 > 1e-6 ? Math.max(0, Math.min(1, ((x - freeFX[i]) * dx + (z - freeFZ[i]) * dz) / l2)) : 1;
      return freeFY[i] + (freeTY[i] - freeFY[i]) * t;
    }
    const k = link[i], a = net.a[k], rx = x - net.nx[a], rz = z - net.nz[a];
    return walkHeightAt(net, k, rx * net.dirX[k] + rz * net.dirZ[k], -rx * net.dirZ[k] + rz * net.dirX[k]);
  };
  const rigGround = (owner, x, z) => groundAt(owner, x, z);
  // The walking surface under a person for the rig: the plane of the link's profile piece they stand on (stairs, and
  // the short walks to and from a seat, keep the exact callback)
  function surface(rig, i) {
    const st = state[i], k = link[i];
    if (st === STATE.SIT || st === STATE.FREE || net.stair[k] >= 0) { rig.groundFn = rigGround; rig.groundOwner = i; return; }
    const a = net.a[k], len = net.len[k], c = net.profCount[k] - 1, o = net.profStart[k];
    const ux = net.dirX[k], uz = net.dirZ[k];
    const along = Math.max(0, Math.min(len, (px[i] - net.nx[a]) * ux + (pz[i] - net.nz[a]) * uz));
    const f = c > 0 ? along / len * c : 0, j = Math.min(c - 1, Math.floor(f));
    const g = c > 0 ? (net.prof[o + j + 1] - net.prof[o + j]) / (len / c) : 0, cs = net.cross[k];
    const side = -(px[i] - net.nx[a]) * uz + (pz[i] - net.nz[a]) * ux;
    rig.groundFn = null;
    // (the plane along the profile piece and across the walk's cross slope)
    rig.gx0 = px[i]; rig.gz0 = pz[i]; rig.gy0 = walkHeight(net, k, along) + cs * side; rig.gdx = g * ux - cs * uz; rig.gdz = g * uz + cs * ux;
  }

  // ---- the arrival's run-out: from where the rider is placed, 16 m along their heading, nobody stops, gathers, sits
  // down across it or appears in it, until they have ridden away ----
  const runout = { on: false, x: 0, z: 0, ux: 0, uz: 1 };
  function setRunout() {
    runout.on = !!rider.valid; runout.x = rider.x; runout.z = rider.z;
    runout.ux = Math.sin(rider.heading ?? 0); runout.uz = Math.cos(rider.heading ?? 0);
  }
  const inRunout = (x, z) => {
    if (!runout.on) return false;
    const dx = x - runout.x, dz = z - runout.z, al = dx * runout.ux + dz * runout.uz, sd = -dx * runout.uz + dz * runout.ux;
    return al > -2 && al < 18 && sd > -1.8 && sd < 1.8;
  };
  // a seat whose way to and from the walk crosses the run-out
  const seatInRunout = (q) => {
    if (!runout.on) return false;
    const n0 = net.seatNode[q], sx = net.seats[q * 5], sz = net.seats[q * 5 + 1];
    if (inRunout(sx, sz)) return true;
    if (n0 < 0) return false;
    for (let t = 0.25; t < 1.01; t += 0.25) if (inRunout(sx + (net.nx[n0] - sx) * t, sz + (net.nz[n0] - sz) * t)) return true;
    return false;
  };

  // ---- spawning ----
  function sampleLink(cx, cz, rMin, rMax) {
    const h = hour;
    let total = 0;
    const c0 = Math.max(0, Math.floor((cx - rMax - x0) / CFG.cell)), c1 = Math.min(CX - 1, Math.floor((cx + rMax - x0) / CFG.cell));
    const r0 = Math.max(0, Math.floor((cz - rMax - z0) / CFG.cell)), r1 = Math.min(CZ - 1, Math.floor((cz + rMax - z0) / CFG.cell));
    for (let i = c0; i <= c1; i++) for (let j = r0; j <= r1; j++) total += cellTotal[h][i * CZ + j];
    if (!(total > 0)) return -1;
    for (let attempt = 0; attempt < 8; attempt++) {
      let r = rnd() * total, c = -1;
      for (let i = c0; i <= c1 && c < 0; i++) for (let j = r0; j <= r1; j++) { r -= cellTotal[h][i * CZ + j]; if (r <= 0) { c = i * CZ + j; break; } }
      if (c < 0 || !(cellTotal[h][c] > 0)) continue;
      const pick = rnd() * cellTotal[h][c];
      let lo = cellStart[c], hi = cellStart[c + 1] - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cellCum[h][m] < pick) lo = m + 1; else hi = m; }
      const k = cellLinks[lo], d = hyp(midX[k] - cx, midZ[k] - cz);
      if (d >= rMin && d <= rMax) return k;
    }
    return -1;
  }
  function expected(cx, cz, r) {
    let e = 0;
    for (let c = 0; c < CX * CZ; c++) if (hyp(cellCX(c) - cx, cellCZ(c) - cz) < r) e += cellTotal[hour][c];
    return e;
  }
  // camera view test for spawning out of sight
  const frustum = new THREE.Frustum(), projView = new THREE.Matrix4(), sphere = new THREE.Sphere();
  let camX = 0, camY = 0, camZ = 0, haveCamera = false;
  const inView = (x, y, z, r = 1.2) => { if (!haveCamera) return false; sphere.center.set(x, y + 0.9, z); sphere.radius = r; return frustum.intersectsSphere(sphere); };
  function freeSlot() { for (let i = 0; i < N; i++) if (state[i] === STATE.OFF) return i; return -1; }

  function place(i, k, sAt, d, latOff) {
    link[i] = k; s[i] = sAt; dir[i] = d; lat[i] = latOff; dodge[i] = 0;
    const a = net.a[k];
    const rx = -net.dirZ[k] * d, rz = net.dirX[k] * d;
    px[i] = net.nx[a] + net.dirX[k] * sAt + rx * latOff; pz[i] = net.nz[a] + net.dirZ[k] * sAt + rz * latOff;
    py[i] = walkHeight(net, k, sAt) + net.cross[k] * latOff * d;
    yaw[i] = Math.atan2(net.dirX[k] * d, net.dirZ[k] * d);
    vx[i] = vz[i] = 0; fresh[i] = 1; lastLink[i] = k; prevLink[i] = -1;
  }
  function dressSlot(i, opts) {
    const look = dressPerson(lookRnd, opts);
    rigs[i].dress(look);
    pace[i] = look.speed; heightOf[i] = look.height;
    const r = records[i];
    r.halfWidthMetres = Math.max(0.16, 0.27 * look.scale + 0.03 * look.girth);
    r.halfLengthMetres = Math.max(0.12, 0.19 * look.scale);
    return look;
  }
  function activate(i) {
    state[i] = STATE.WALK; act[i] = ACT.NONE; timer[i] = 0; ox[i] = oz[i] = svx[i] = svz[i] = cooldown[i] = 0;
    seatOf[i] = -1; bumped[i] = 0; talking[i] = 0; partner[i] = -1; walked[i] = 0; pass[i] = 0; sep[i] = 0; dropBack[i] = 0;
    lagNow[i] = 0; leaderV[i] = 0; groupHold[i] = 0; fSide[i] = 0; carWait[i] = 0; qBack[i] = 0; leg[i] = 0; leaving[i] = 0; nextPause[i] = 25 + rnd() * 60;
    social[i] = clock + 5 + socialRnd() * 20; goalAge[i] = 0;
    for (let h = 0; h < HIST; h++) hist[i * HIST + h] = -1;
    active++; counters.spawned++; born[i] = counters.spawned;
  }
  /** Spawn a group on link k. Returns how many people were placed. */
  function spawnGroup(k, initial) {
    if (net.kind[k] === WALK.CROSSING || net.pinch[k] && !initial) return 0;
    const len = net.len[k], tier = PLACES[net.place[k]].tiers[hour];
    const r = rnd();
    let size = r < 0.4 ? 1 : r < 0.8 ? 2 : r < 0.9 ? 3 : tier >= 3 ? 4 + (rnd() < 0.4 ? 1 : 0) : 2;
    size = Math.min(size, N - active, target - active + 1);
    if (size <= 0) return 0;
    const d = rnd() < 0.5 ? 1 : -1, sAt = 1 + rnd() * Math.max(0.1, len - 2);
    const a = net.a[k], x = net.nx[a] + net.dirX[k] * sAt, z = net.nz[a] + net.dirZ[k] * sAt, y = walkHeight(net, k, sAt);
    if (rider.valid && hyp(x - rider.x, z - rider.z) < context.clear.rider + 2) return 0;
    if (inRunout(x, z)) return 0;
    for (let j = 0; j < N; j++) if (state[j] !== STATE.OFF && hyp(px[j] - x, pz[j] - z) < 2 + size * 0.8 && Math.abs(py[j] - y) < 1) return 0; // room for the group
    // born in view only far off (beyond the near figures) and where someone plausibly appears: out of a doorway on a
    // walk beside the façades, round a corner; never on open paving where anyone is drawn
    if (!initial) {
      // (every member of the group: the last is up to 0.8 m per place behind the first)
      for (let m = 0; m < size; m++) {
        const sm = Math.max(0, Math.min(len, sAt - d * m * 0.8)), mx = net.nx[a] + net.dirX[k] * sm, mz = net.nz[a] + net.dirZ[k] * sm;
        if (!inView(mx, y, mz, 3)) continue;
        const dc = hyp3(mx - camX, y - camY, mz - camZ);
        if (dc < drawFar + 3 && !(dc >= birthFar && doorway(k))) return 0;
      }
    }
    const kids = size >= 3 && rnd() < 0.4 ? (size >= 4 && rnd() < 0.5 ? 2 : 1) : 0;
    const older = rnd() < 0.15;
    const w = Math.max(0, net.width[k] - 0.1);
    const latLead = size > 1 ? 0 : (rnd() * 0.6 + 0.1) * w; // keep right of travel, within the walk (company: the middle)
    let lead = -1, hat = false, placed = 0;
    for (let m = 0; m < size; m++) {
      const i = freeSlot(); if (i < 0) break;
      const child = m >= size - kids;
      const look = dressSlot(i, { child, older: older && !child, noHat: hat });
      hat ||= look.hatOn;
      leader[i] = lead < 0 ? -1 : lead; slot[i] = m; groupSize[i] = size;
      place(i, k, Math.max(0, Math.min(len, sAt - d * m * 0.8)), d, latLead);
      activate(i); latGoal[i] = latLead;
      lagNow[i] = Math.min(Math.abs(sAt - Math.max(0, Math.min(len, sAt - d * m * 0.8))), m * 0.8);
      if (lead < 0) { lead = i; chooseGoal(i); }
      else pace[i] = pace[lead];
      placed++;
    }
    if (lead >= 0) {
      groupSize[lead] = placed;
      // on arrival in a square (or a lit frontage at blue hour) some company is already standing talking
      if (initial && placed > 1 && (net.kind[k] === WALK.PLAZA || (hour === 2 && net.lit[k])) && rnd() < 0.45) {
        state[lead] = STATE.STAND; timer[lead] = 4 + rnd() * 14; act[lead] = ACT.TALK;
        faceX[lead] = px[lead] - net.dirX[k] * d * 5; faceZ[lead] = pz[lead] - net.dirZ[k] * d * 5;
      }
      for (let i = 0; i < N; i++) if (leader[i] === lead) { groupSize[i] = placed; pace[lead] = Math.min(pace[lead], pace[i]); }
      for (let i = 0; i < N; i++) if (leader[i] === lead) pace[i] = pace[lead];
    }
    return placed;
  }
  /** Seat one person (or a pair) on a free bench near the focus at once. */
  function spawnSitter(seat) {
    if (seatOcc[seat] >= 0 || (net.seatNode[seat] < 0 && !PERMANENT(seat)) || (!PERMANENT(seat) && seatInRunout(seat))) return 0;
    const i = freeSlot(); if (i < 0) return 0;
    const n0 = net.seatNode[seat], k = n0 >= 0 ? net.adjLink[net.adjStart[n0]] : 0;
    if (k == null) return 0;
    dressSlot(i, { older: !PERMANENT(seat) && rnd() < 0.35, child: net.seatKind[seat] === SEAT_KIND.GRASS && rnd() < 0.5 });
    leader[i] = -1; slot[i] = 0; groupSize[i] = 1;
    place(i, k, n0 >= 0 && net.a[k] === n0 ? 0 : net.len[k], 1, 0);
    activate(i);
    sitDown(i, seat, true);
    timer[i] = 10 + rnd() * 70;
    // a bench pair, talking, now and then
    const pair = seat ^ 1;
    if (net.seatKind[seat] === SEAT_KIND.BENCH && pair < net.seatCount && net.seatKind[pair] === SEAT_KIND.BENCH && net.seatNode[pair] >= 0 && seatOcc[pair] < 0 && rnd() < 0.4) {
      const j = freeSlot();
      if (j >= 0 && active < target) {
        dressSlot(j, { older: rnd() < 0.35 });
        leader[j] = i; slot[j] = 1; groupSize[j] = groupSize[i] = 2;
        place(j, k, n0 >= 0 && net.a[k] === n0 ? 0 : net.len[k], 1, 0);
        activate(j); pace[j] = pace[i] = Math.min(pace[i], pace[j]);
        sitDown(j, pair, true); act[i] = act[j] = ACT.TALK;
        return 2;
      }
    }
    return 1;
  }

  // ---- the rider's reach on the walks (births go where the rider is going, not behind blocks) ----
  const reachD = new Float32Array(net.nodes).fill(Infinity), reachQ = new Int32Array(net.nodes), reachInQ = new Uint8Array(net.nodes);
  const touched = new Int32Array(net.nodes);
  let touchedN = 0, reachN = 0, reachAt = -99, reachX = 1e9, reachZ = 1e9, reachWeight = 0;
  const reachLinks = new Int32Array(L), reachCum = new Float32Array(L);
  function updateReach() {
    if (!rider.valid) { reachN = 0; return; }
    if (clock - reachAt < 0.5 && hyp(rider.x - reachX, rider.z - reachZ) < 8) return;
    reachAt = clock; reachX = rider.x; reachZ = rider.z;
    for (let q = 0; q < touchedN; q++) reachD[touched[q]] = Infinity;
    touchedN = 0; reachN = 0;
    // start from the nodes of the walks in the rider's cell and its neighbours within 25 m (the rider may stand in the
    // middle of a street or a square)
    let head = 0, tail = 0;
    const cx = Math.floor((rider.x - x0) / CFG.cell), cz = Math.floor((rider.z - z0) / CFG.cell);
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      if (i < 0 || j < 0 || i >= CX || j >= CZ) continue;
      const c = i * CZ + j;
      for (let q = cellStart[c]; q < cellStart[c + 1]; q++) {
        const k = cellLinks[q];
        for (let e = 0; e < 2; e++) {
          const n0 = e ? net.b[k] : net.a[k], d = hyp(net.nx[n0] - rider.x, net.nz[n0] - rider.z);
          if (d > 25 || Math.abs(net.ny[n0] - rider.y) > 3 || d >= reachD[n0]) continue;
          if (reachD[n0] === Infinity) touched[touchedN++] = n0;
          reachD[n0] = d;
          if (!reachInQ[n0]) { reachInQ[n0] = 1; reachQ[tail] = n0; tail = (tail + 1) % net.nodes; }
        }
      }
    }
    if (head === tail) {
      // nothing within 25 m: the nearest walk node within 60 m
      let best = -1, bd = 60;
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
        if (i < 0 || j < 0 || i >= CX || j >= CZ) continue;
        const c = i * CZ + j;
        for (let q = cellStart[c]; q < cellStart[c + 1]; q++) {
          const n0 = net.a[cellLinks[q]], d = hyp(net.nx[n0] - rider.x, net.nz[n0] - rider.z);
          if (d < bd && Math.abs(net.ny[n0] - rider.y) < 3) { bd = d; best = n0; }
        }
      }
      if (best >= 0) { reachD[best] = bd; touched[touchedN++] = best; reachInQ[best] = 1; reachQ[tail] = best; tail = (tail + 1) % net.nodes; }
    }
    // shortest walk distance (a queue relaxation, bounded by CFG.reach)
    while (head !== tail) {
      const n0 = reachQ[head]; head = (head + 1) % net.nodes; reachInQ[n0] = 0;
      const d0 = reachD[n0];
      for (let j = net.adjStart[n0]; j < net.adjStart[n0 + 1]; j++) {
        const k = net.adjLink[j], o = otherEnd(k, n0), d = d0 + net.len[k];
        if (d > CFG.reach || d >= reachD[o] || net.blocked[k]) continue;
        if (reachD[o] === Infinity) touched[touchedN++] = o;
        reachD[o] = d;
        if (!reachInQ[o]) { reachInQ[o] = 1; reachQ[tail] = o; tail = (tail + 1) % net.nodes; }
      }
    }
    // the links reached, weighted by their spawn weight and by where the rider is going
    const sp = hyp(rider.vx, rider.vz), fx = sp > 1 ? rider.vx / sp : Math.sin(rider.heading ?? 0), fz = sp > 1 ? rider.vz / sp : Math.cos(rider.heading ?? 0);
    let sum = 0; reachWeight = 0;
    for (let q = 0; q < touchedN; q++) {
      const n0 = touched[q];
      for (let j = net.adjStart[n0]; j < net.adjStart[n0 + 1]; j++) {
        const k = net.adjLink[j];
        if (net.a[k] !== n0 && reachD[net.a[k]] !== Infinity) continue; // (each link once)
        const w = weight[hour][k];
        if (!(w > 0)) continue;
        const dx = midX[k] - rider.x, dz = midZ[k] - rider.z, d = hyp(dx, dz) || 1, ahead = (dx * fx + dz * fz) / d;
        const f = ahead > 0.3 ? 3 : ahead < -0.3 ? 0.35 : 1;
        sum += w * f; reachWeight += w; reachLinks[reachN] = k; reachCum[reachN] = sum; reachN++;
      }
    }
  }
  // a reached link whose nearer end is between rMin and rMax walk metres from the rider (−1 if none in 12 picks)
  function sampleNear(rMin, rMax) {
    for (let t = 0; t < 12 && reachN; t++) {
      const k = sampleAhead(), d = Math.min(reachD[net.a[k]], reachD[net.b[k]]);
      if (d >= rMin && d <= rMax) return k;
    }
    return -1;
  }
  function sampleAhead() {
    if (!reachN) return -1;
    const pick = rnd() * reachCum[reachN - 1];
    let lo = 0, hi = reachN - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (reachCum[m] < pick) lo = m + 1; else hi = m; }
    return reachLinks[lo];
  }

  function refill(initial) {
    if (!focus) return;
    updateReach();
    if (clock >= targetClock || initial) {
      targetClock = clock + 1;
      // what the place supports: round the focus, or along the rider's own walks (a lively street the disc undercounts)
      const e = Math.max(expected(focus.x, focus.z, CFG.radius), reachWeight * CFG.reachShare);
      target = Math.min(Math.floor(cap * CFG.hourShare[HOURS[hour]]), Math.round(e));
    }
    let budget = initial ? N : 3, tries = initial ? N * 3 : 6;
    if (initial && net.seatCount) {
      // some benches round the arrival are already taken
      const sitShare = [0.35, 0.4, 0.25][hour];
      for (let q = 0; q < net.seatCount && active < target; q++) {
        if (net.seatKind[q] !== SEAT_KIND.BENCH) continue;
        const sx = net.seats[q * 5], sz = net.seats[q * 5 + 1];
        if (hyp(sx - focus.x, sz - focus.z) > CFG.radius * 0.8 || rnd() > sitShare) continue;
        if (rider.valid && hyp(sx - rider.x, sz - rider.z) < context.clear.rider) continue;
        spawnSitter(q);
      }
    }
    // vendors and the kite group: in their places while the focus is near (out of sight when they arrive)
    for (let q = 0; q < net.seatCount; q++) {
      if (!PERMANENT(q) || seatOcc[q] >= 0) continue;
      const sx = net.seats[q * 5], sz = net.seats[q * 5 + 1], sy = net.seats[q * 5 + 4];
      if (hyp(sx - focus.x, sz - focus.z) > CFG.radius * 0.9) continue;
      if (rider.valid && hyp(sx - rider.x, sz - rider.z) < 3) continue;
      if (!initial && inView(sx, sy, sz, 1.5) && hyp3(sx - camX, sy - camY, sz - camZ) < drawFar + 3) continue;
      spawnSitter(q);
    }
    // on arrival, people on the rider's own street close by (just beyond the clear ring), as the place allows
    if (initial && reachN) {
      const k0 = sampleNear(0, 30), t0 = k0 >= 0 ? PLACES[net.place[k0]].tiers[hour] : 0;
      for (let g = Math.round(Math.max(0, t0 - 1.5) * 1.6), t = 0; g > 0 && t < 30 && active < target; t++) {
        const k = sampleNear(context.clear.rider, 34);
        if (k >= 0 && spawnGroup(k, true) > 0) g--;
      }
    }
    // (as many on the rider's own walks as they support: a quiet street stays quiet whatever is round it)
    let onReach = 0;
    if (reachN) for (let i = 0; i < N; i++) if (state[i] !== STATE.OFF && (reachD[net.a[link[i]]] !== Infinity || reachD[net.b[link[i]]] !== Infinity)) onReach++;
    const reachRoom = reachWeight * CFG.reachShare - onReach;
    while (active < target && budget > 0 && tries-- > 0) {
      // most births along the rider's own walks (ahead first), the rest anywhere round the focus (squares, parallel streets)
      const k = reachN && reachRoom > 0 && rnd() < (initial ? 0.5 : 0.7) ? sampleAhead() : sampleLink(focus.x, focus.z, initial ? 0 : 30, CFG.radius);
      if (k < 0) continue; // (a missed pick is one try, not the end of the fill)
      budget -= spawnGroup(k, initial) > 0 ? 1 : 0;
    }
  }
  function release(i) {
    if (state[i] === STATE.OFF) return;
    if (seatOf[i] >= 0 && seatOcc[seatOf[i]] === i) seatOcc[seatOf[i]] = -1;
    endTalk(i);
    state[i] = STATE.OFF; seatOf[i] = -1; rigs[i].placed = false; active--;
    // followers of a released leader are released with it
    for (let j = 0; j < N; j++) if (leader[j] === i && state[j] !== STATE.OFF) release(j);
    leader[i] = -1;
  }
  const leaderOf = (i) => (leader[i] >= 0 && state[leader[i]] !== STATE.OFF ? leader[i] : i);

  // ---- goals ----
  function chooseGoal(i) {
    goalAge[i] = 0; act[i] = ACT.NONE;
    const x = px[i], z = pz[i], tier = PLACES[net.place[link[i]]].tiers[hour], r = rnd();
    const pSeat = (hour === 2 ? 0.12 : 0.18) + 0.03 * tier, pLook = 0.12;
    if (r < pSeat && net.seatCount) {
      let best = -1, bestD = 70;
      for (let q = 0; q < net.seatCount - 1; q += 2) {
        const kind = net.seatKind[q];
        if (kind > SEAT_KIND.CUSTOMER || net.seatNode[q] < 0 || seatOcc[q] >= 0 || (groupSize[i] > 1 && seatOcc[q + 1] >= 0) || seatInRunout(q)) continue;
        const d = hyp(net.seats[q * 5] - x, net.seats[q * 5 + 1] - z) * (0.7 + rnd() * 0.6) * (kind === SEAT_KIND.CUSTOMER ? 0.5 : 1);
        if (d < bestD) { best = q; bestD = d; }
      }
      if (best >= 0 && groupSize[i] <= 2) { goalKind[i] = GOAL.SEAT; goalRef[i] = best; goalNode[i] = net.seatNode[best]; goalBest[i] = Infinity; return; }
    }
    if (r < pSeat + pLook && net.lookCount) {
      for (let q = 0; q < net.lookCount; q++) {
        const n0 = net.lookStart[q], n1 = net.lookStart[q + 1];
        if (n1 > n0 && hyp(net.looks[q * 3] - x, net.looks[q * 3 + 1] - z) < 90) {
          goalKind[i] = GOAL.LOOK; goalRef[i] = q; goalNode[i] = net.lookNodes[n0 + Math.floor(rnd() * (n1 - n0))]; goalBest[i] = Infinity; return;
        }
      }
    }
    const k = sampleLink(x, z, 25, 120);
    goalKind[i] = GOAL.NODE; goalRef[i] = -1; goalNode[i] = k >= 0 ? (rnd() < 0.5 ? net.a[k] : net.b[k]) : -1; goalBest[i] = Infinity;
  }

  // ---- the next link at a node ----
  const candidates = new Int32Array(64), candW = new Float32Array(64);
  function nextLink(i, n0) {
    const cur = link[i], g = goalNode[i];
    const gx = g >= 0 ? net.nx[g] : px[i], gz = g >= 0 ? net.nz[g] : pz[i];
    const here = hyp(net.nx[n0] - gx, net.nz[n0] - gz);
    let count = 0, total = 0;
    for (let j = net.adjStart[n0]; j < net.adjStart[n0 + 1] && count < 64; j++) {
      const k = net.adjLink[j];
      if (k === cur || net.blocked[k]) continue;
      const o = otherEnd(k, n0), kind = net.kind[k];
      const progress = (here - hyp(net.nx[o] - gx, net.nz[o] - gz)) / Math.max(0.5, net.len[k]);
      const t = PLACES[net.place[k]].tiers[hour];
      let w = (0.12 + Math.max(0, progress) ** 2 * 5) * KIND_ROUTE[kind] * (0.5 + t * 0.15);
      if (kind === WALK.CROSSING && progress < 0.3) w *= 0.25;
      if (k === hist[i * HIST]) w *= 0.15;
      candidates[count] = k; candW[count] = w; total += w; count++;
    }
    if (!count) return -1;
    let r = rnd() * total;
    for (let c = 0; c < count; c++) { r -= candW[c]; if (r <= 0) return candidates[c]; }
    return candidates[count - 1];
  }
  function enter(i, k, n0) {
    // record the route for followers, then step onto k from node n0
    for (let h = HIST - 1; h > 0; h--) { hist[i * HIST + h] = hist[i * HIST + h - 1]; histDir[i * HIST + h] = histDir[i * HIST + h - 1]; }
    hist[i * HIST] = link[i]; histDir[i * HIST] = dir[i];
    link[i] = k; dir[i] = net.a[k] === n0 ? 1 : -1; s[i] = dir[i] > 0 ? 0 : net.len[k];
    const w = net.width[k];
    lat[i] = Math.max(-w, Math.min(w, lat[i]));
    // across open paving everyone takes their own line (not a file down the lattice); elsewhere keep right
    // (a leader with company keeps to the middle: the companions beside them have room, and nobody is swept across)
    if (leader[i] < 0) latGoal[i] = groupSize[i] > 1 ? 0 : net.kind[k] === WALK.PLAZA ? (rnd() * 2 - 1) * 0.9 * w : Math.max(-w, Math.min(w, latGoal[i]));
  }

  // ---- cars (last frame's bodies round the focus, gathered once per frame) ----
  const near = [], cars = [];
  let carCount = 0;
  function gatherCars() {
    carCount = 0;
    if (!focus) return;
    // (emptied with pop: setting length 0 releases the array's storage, and the query's pushes would regrow it)
    while (near.length) near.pop();
    bodies.dynamicBodiesNear(focus.x, focus.z, CFG.recycle + 12, near);
    for (let q = 0; q < near.length; q++) if (near[q].kind === 'vehicle') cars[carCount++] = near[q];
  }
  // Is (x, z) at walking height y inside a car's footprint grown by `pad` (its oriented box, with height overlap), now
  // or, when `predict`, where the car will be 0.6 and 1.2 s on? A car slower than 0.3 m/s is where it stands.
  // (its numbers go in through CQ: x, y, z, pad; numbers passed as arguments to a call that is not inlined are boxed)
  const CQ = new Float64Array(4);
  function carAt(predict) {
    const x = CQ[0], y = CQ[1], z = CQ[2], pad = CQ[3];
    for (let q = 0; q < carCount; q++) {
      const v = cars[q];
      if (y + 1.7 < v.minY || y - 0.3 > v.maxY) continue;
      const vxq = v.velocityX || 0, vzq = v.velocityZ || 0, sp2 = vxq * vxq + vzq * vzq;
      // (a fast car needs longer to stop for someone stepping out: 2.4 s ahead above 4 m/s)
      const steps = predict && sp2 > 0.09 ? (sp2 > 16 ? 5 : 3) : 1;
      const dx0 = x - v.x, dz0 = z - v.z, hl = v.halfLengthMetres + pad, hw = v.halfWidthMetres + pad;
      const reach = hl + hw + (steps > 1 ? Math.sqrt(sp2) * 0.6 * (steps - 1) : 0);
      if (dx0 * dx0 + dz0 * dz0 > reach * reach) continue;
      const sh = Math.sin(v.headingY), ch = Math.cos(v.headingY);
      for (let t = 0; t < steps; t++) {
        const dx = dx0 - vxq * t * 0.6, dz = dz0 - vzq * t * 0.6;
        const al = dx * sh + dz * ch, sd = dx * ch - dz * sh;
        if (al < hl && al > -hl && sd < hw && sd > -hw) return true;
      }
    }
    return false;
  }
  // A crossing is clear when no car's footprint (grown by a person's room) stands on its corridor and none will in the
  // next four seconds on its present course. A car that has stopped short of the corridor has stopped for us.
  function vehicleOnCrossing(k, waited = 0) {
    // (someone who has waited a while takes a shorter gap: 4 s, then 2 s after 10 s, 1 s after 20 s)
    const horizon = waited > 20 ? 3 : waited > 10 ? 5 : 9;
    const a = net.a[k], ax = net.nx[a], az = net.nz[a], len = net.len[k], ux = net.dirX[k], uz = net.dirZ[k];
    const y = (net.ny[a] + net.ny[net.b[k]]) / 2;
    for (let q = 0; q < carCount; q++) {
      const v = cars[q];
      if (y + 1.7 < v.minY || y - 0.3 > v.maxY) continue;
      const vxq = v.velocityX || 0, vzq = v.velocityZ || 0, sp = Math.sqrt(vxq * vxq + vzq * vzq);
      const ex = v.x - ax, ez = v.z - az, t0 = ex * ux + ez * uz;
      const lim = len / 2 + v.halfLengthMetres + v.halfWidthMetres + 2 + sp * 4;
      if (Math.abs(t0 - len / 2) > lim || Math.abs(-ex * uz + ez * ux) > lim) continue;
      // a car that has stopped or creeps in a queue (it stops for anyone in front of it) blocks only where its body
      // stands; a moving one with room to spare, now and every half second for 4 s
      const slow = sp < 1;
      const pad = slow ? 0.25 : 0.7;
      const sh = Math.sin(v.headingY), ch = Math.cos(v.headingY), hl = v.halfLengthMetres + pad, hw = v.halfWidthMetres + pad;
      const steps = slow ? 1 : horizon;
      for (let t = 0; t < steps; t++) {
        const cx = v.x + vxq * t * 0.5, cz = v.z + vzq * t * 0.5;
        // the corridor's points every 0.5 m against the car's box at that time
        for (let d = 0; d <= len; d += 0.5) {
          const dx = ax + ux * d - cx, dz = az + uz * d - cz;
          const al = dx * sh + dz * ch, sd = dx * ch - dz * sh;
          if (al < hl && al > -hl && sd < hw && sd > -hw) return true;
        }
      }
    }
    return false;
  }

  // ---- the rider (SF edition: anticipating sidestep, admitted-impact shove, pause and return) ----
  function react(i, speed, nx, nz) {
    if (state[i] === STATE.OFF || cooldown[i] > 0 || ![speed, nx, nz].every(Number.isFinite) || speed <= 1.5) return false;
    const length = hyp(nx, nz);
    if (length < 1e-9) return false;
    endTalk(i);
    const push = Math.min(4.5, 1.2 + speed * 0.6);
    svx[i] = nx / length * push; svz[i] = nz / length * push;
    cooldown[i] = 3; bumped[i]++; counters.shoved++;
    // stumble, pause, look at the rider (not on a stair: they walk on), then walk on
    const l = leaderOf(i);
    if (net.kind[link[l]] !== WALK.STAIR && state[l] !== STATE.SIT) {
      if (state[l] === STATE.WALK || state[l] === STATE.WAIT) { state[l] = STATE.STAND; timer[l] = 0; }
      timer[l] = Math.max(timer[l], 2.2);
      faceX[l] = rider.x; faceZ[l] = rider.z;
    }
    // a bench sitter gets up and walks out of the bench; a vendor or the kite family stumble where they are and return
    if (state[i] === STATE.SIT && !(seatOf[i] >= 0 && PERMANENT(seatOf[i]))) standUp(i);
    return true;
  }
  // the stumble of someone in a permanent place (a vendor, the kite family): away, then back to the place
  function stepSeatShove(i, dt) {
    cooldown[i] = Math.max(0, cooldown[i] - dt);
    if (!ox[i] && !oz[i] && !svx[i] && !svz[i]) return;
    let x = ox[i] + svx[i] * dt, z = oz[i] + svz[i] * dt;
    const k = Math.exp(-7 * dt);
    svx[i] *= k; svz[i] *= k;
    if (hyp(svx[i], svz[i]) < 0.05) {
      svx[i] = svz[i] = 0;
      const off = hyp(x, z), step = 0.5 * dt;
      if (off <= step) x = z = 0; else if (cooldown[i] < 2.2) { x -= x / off * step; z -= z / off * step; }
    }
    const d = hyp(x, z);
    if (d > 0.45) { x *= 0.45 / d; z *= 0.45 / d; }
    ox[i] = x; oz[i] = z;
  }
  function stepShove(i, dt) {
    cooldown[i] = Math.max(0, cooldown[i] - dt);
    if (!ox[i] && !oz[i] && !svx[i] && !svz[i]) return;
    let x = ox[i] + svx[i] * dt, z = oz[i] + svz[i] * dt;
    const k = Math.exp(-7 * dt);
    svx[i] *= k; svz[i] *= k;
    if (hyp(svx[i], svz[i]) < 0.05) {
      svx[i] = svz[i] = 0;
      const off = hyp(x, z), step = 0.5 * dt;
      const l = leaderOf(i);
      if (off <= step) x = z = 0;
      else if (state[l] !== STATE.STAND || timer[l] <= 0.6) { x -= x / off * step; z -= z / off * step; }
    }
    const d = hyp(x, z);
    if (d > 0.75) { x *= 0.75 / d; z *= 0.75 / d; }
    // stay inside the walk's checked corridor: no further aside than the link's room, no further along than its ends
    const kk = link[i], rx = -net.dirZ[kk], rz = net.dirX[kk], ux = net.dirX[kk], uz = net.dirZ[kk];
    const side = x * rx + z * rz, room = net.width[kk], base = (lat[i] + dodge[i]) * dir[i];
    const lo = -room - base, hi = room - base;
    if (side < lo || side > hi) { const c = Math.max(lo, Math.min(hi, side)) - side; x += rx * c; z += rz * c; }
    const along = x * ux + z * uz, alo = -s[i], ahi = net.len[kk] - s[i];
    if (along < alo || along > ahi) { const c = Math.max(alo, Math.min(ahi, along)) - along; x += ux * c; z += uz * c; }
    ox[i] = x; oz[i] = z;
  }
  function stepDodge(i, dt) {
    let goal = 0;
    if (rider.valid && !rider.crashed && state[i] !== STATE.SIT) {
      const dx = px[i] - rider.x, dz = pz[i] - rider.z, d2 = dx * dx + dz * dz;
      const speed = rider.speed, reach = Math.max(4, Math.min(9, Math.abs(speed) * 1.6));
      if (d2 < reach * reach && Math.abs(py[i] - rider.minY) < 0.6) {
        const k = link[i], ux = net.dirX[k] * dir[i], uz = net.dirZ[k] * dir[i], rxn = -uz, rzn = ux;
        const sp = hyp(rider.vx, rider.vz);
        if (sp > 2) {
          const fx = rider.vx / sp, fz = rider.vz / sp;
          const ahead = dx * fx + dz * fz, side = dx * fz - dz * fx;
          if (ahead > -0.3 && ahead < reach && Math.abs(side) < 1.3) {
            const away = (rxn * fz - rzn * fx) * (side >= 0 ? 1 : -1);
            if (Math.abs(away) > 0.3) goal = away > 0 ? 0.6 : -0.6;
            else goal = side >= 0 ? 0.6 : -0.6;
          }
        }
        if (goal === 0 && state[i] === STATE.WALK) {
          const toward = -(dx * ux + dz * uz), lateral = -(dx * rxn + dz * rzn);
          if (toward > 0 && toward < 1.8 && Math.abs(lateral) < 0.9) goal = lateral >= 0 ? -0.6 : 0.6;
        }
      }
    }
    if (goal !== 0 && !dodge[i]) counters.sidesteps++;
    if (goal === 0 && !dodge[i]) return;
    // never past the walk's clear corridor: a wall or a kerb drop is not a safe side
    const room = net.width[link[i]], base = lat[i];
    goal = Math.max(-room - base, Math.min(room - base, goal));
    dodge[i] += Math.max(-1.4 * dt, Math.min(1.4 * dt, goal - dodge[i]));
    if (Math.abs(dodge[i]) < 1e-3 && goal === 0) dodge[i] = 0;
  }
  // a slow or standing rider in the way ahead: wait a moment, then turn back
  function riderBlocks(i) {
    if (!rider.valid || Math.abs(rider.speed) > 0.7) return false;
    const k = link[i], ux = net.dirX[k] * dir[i], uz = net.dirZ[k] * dir[i];
    const dx = rider.x - px[i], dz = rider.z - pz[i];
    const ahead = dx * ux + dz * uz, side = Math.abs(-dx * uz + dz * ux);
    return ahead > 0 && ahead < 1.9 && side < 0.85 && Math.abs(py[i] - rider.minY) < 0.8;
  }

  // ---- seats and conversations ----
  function sitDown(i, seat, instant = false) {
    seatOcc[seat] = i; seatOf[i] = seat;
    const o = seat * 5, h = net.seats[o + 3];
    freeTX[i] = net.seats[o]; freeTZ[i] = net.seats[o + 1]; freeTY[i] = net.seats[o + 4];
    if (instant) { freeFX[i] = freeTX[i]; freeFZ[i] = freeTZ[i]; freeFY[i] = freeTY[i]; px[i] = freeTX[i]; pz[i] = freeTZ[i]; py[i] = freeTY[i]; state[i] = STATE.SIT; yaw[i] = h; }
    else {
      freeFX[i] = px[i]; freeFZ[i] = pz[i]; freeFY[i] = py[i];
      // approach the front of the seat, then turn and settle back into it (a standing place: walk to it)
      const ahead = STANDING(seat) ? 0 : 0.5;
      freeTX[i] = net.seats[o] + Math.sin(h) * ahead; freeTZ[i] = net.seats[o + 1] + Math.cos(h) * ahead;
      freeT[i] = 0; state[i] = STATE.FREE; leg[i] = 2; leaving[i] = 0;
    }
    timer[i] = net.seatKind[seat] === SEAT_KIND.CUSTOMER ? 14 + rnd() * 18 : 20 + rnd() * 70; counters.seated++;
  }
  // Up from a seat: out to its front, then back to the walk at the seat's node, the way they came (never a jump)
  function standUp(i) {
    const seat = seatOf[i];
    if (seat >= 0 && seatOcc[seat] === i) seatOcc[seat] = -1;
    seatOf[i] = -1;
    act[i] = ACT.NONE; timer[i] = 0;
    for (let j = 0; j < N; j++) if (j !== i && groupOf(j) === groupOf(i) && state[j] === STATE.SIT && act[j] === ACT.TALK) act[j] = ACT.NONE;
    let n0 = seat >= 0 ? net.seatNode[seat] : -1;
    // (no checked way from this seat: back to the nearer end of the walk they left)
    if (n0 < 0) { const k = link[i]; n0 = hyp(net.nx[net.a[k]] - px[i], net.nz[net.a[k]] - pz[i]) < hyp(net.nx[net.b[k]] - px[i], net.nz[net.b[k]] - pz[i]) ? net.a[k] : net.b[k]; }
    if (seat < 0) { freeFX[i] = px[i]; freeFZ[i] = pz[i]; freeFY[i] = py[i]; freeTX[i] = net.nx[n0]; freeTZ[i] = net.nz[n0]; freeTY[i] = net.ny[n0]; freeT[i] = 0; state[i] = STATE.FREE; leg[i] = 1; leaving[i] = 1; goalRef[i] = n0; return; }
    const o = seat * 5, h = net.seats[o + 3], ahead = STANDING(seat) ? 0 : 0.5;
    freeFX[i] = px[i]; freeFZ[i] = pz[i]; freeFY[i] = py[i];
    freeTX[i] = net.seats[o] + Math.sin(h) * ahead; freeTZ[i] = net.seats[o + 1] + Math.cos(h) * ahead; freeTY[i] = net.seats[o + 4];
    freeT[i] = 0; state[i] = STATE.FREE; leg[i] = 2; leaving[i] = 1; goalRef[i] = n0; // (the node to return to)
  }
  // back on the walk at node n0, at rest on its first link
  function rejoin(i, n0) {
    const k = net.adjLink[net.adjStart[n0]];
    link[i] = k; dir[i] = net.a[k] === n0 ? 1 : -1; s[i] = dir[i] > 0 ? 0 : net.len[k]; lat[i] = 0;
    dodge[i] = pass[i] = sep[i] = qBack[i] = latGoal[i] = 0; ox[i] = oz[i] = 0;
    state[i] = STATE.WALK; leaving[i] = 0; leg[i] = 0;
    for (let h = 0; h < HIST; h++) hist[i * HIST + h] = -1; // a new start: the companions gather from where they are
    if (leader[i] < 0) { chooseGoal(i); for (let j = 0; j < N; j++) if (leader[j] === i && state[j] === STATE.WALK || leader[j] === i && state[j] === STATE.STAND) { lagNow[j] = Math.min(3, hyp(px[j] - px[i], pz[j] - pz[i])); dropBack[j] = 0; } }
    else {
      const l = leader[i], d = hyp(px[i] - px[l], pz[i] - pz[l]);
      // a companion who got up from a seat far from the others goes their own way (the group never pulls them over)
      if (d > 2.5) { for (let j = 0; j < N; j++) if (j === l || leader[j] === l) groupSize[j] = Math.max(1, groupSize[j] - 1); leader[i] = -1; groupSize[i] = 1; slot[i] = 0; chooseGoal(i); }
      else lagNow[i] = d;
    }
  }
  function endTalk(i) {
    const p = partner[i];
    if (p >= 0) { partner[p] = -1; talking[p] = 0; if (act[p] === ACT.TALK) act[p] = ACT.NONE; }
    partner[i] = -1; talking[i] = 0;
  }

  // ---- strangers on the same walk: fall in behind, pass on the right where there is room, else one turns back ----
  const HASH = 2048, cellHead = new Int32Array(HASH), cellNext = new Int32Array(Math.max(1, N));
  const cellOfP = (ix, iz) => ((ix * 73856093) ^ (iz * 19349663)) & (HASH - 1);
  const groupOf = (i) => (leader[i] >= 0 ? leader[i] : i);
  function buildHash() {
    cellHead.fill(-1);
    for (let i = 0; i < N; i++) {
      if (state[i] === STATE.OFF) continue;
      const h = cellOfP(Math.floor(px[i] / 2), Math.floor(pz[i] / 2));
      cellNext[i] = cellHead[h]; cellHead[h] = i;
    }
  }
  function avoid(i) {
    slowTo[i] = 1e9; passGoal[i] = 0;
    const k = link[i], ux = net.dirX[k] * dir[i], uz = net.dirZ[k] * dir[i], room = net.width[k], g = groupOf(i);
    const ix = Math.floor(px[i] / 2), iz = Math.floor(pz[i] / 2);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (let j = cellHead[cellOfP(ix + a, iz + b)]; j >= 0; j = cellNext[j]) {
        if (j === i || groupOf(j) === g || Math.abs(py[j] - py[i]) > 0.8) continue;
        const dx = px[j] - px[i], dz = pz[j] - pz[i], ahead = dx * ux + dz * uz;
        if (ahead <= -0.35 || ahead > 2.4) continue;
        const side = -dx * uz + dz * ux; // + to my right
        if (side > 0.75 || side < -0.75) continue;
        const along = vx[j] * ux + vz[j] * uz;
        if (ahead <= 0.05) {
          // side by side, the same way (two walks merging at a node): the one without right of way drops back
          if (state[j] === STATE.WALK && along > 0.2 && g > groupOf(j) && side < 0.5 && side > -0.5) slowTo[i] = Math.min(slowTo[i], along * 0.5);
          continue;
        }
        if (state[j] === STATE.WALK && along > 0.3) {
          // the same way: fall in behind at their pace
          if (ahead < 1.4) slowTo[i] = Math.min(slowTo[i], Math.max(0, along - (1.4 - ahead) * 0.8));
        } else if (room >= 0.28) {
          // oncoming or standing: keep right of the oncoming, go round the standing on their free side
          passGoal[i] = state[j] === STATE.WALK ? room : side > 0 ? -room : room;
        } else if (ahead < 2.4 && (state[j] !== STATE.WALK || g > groupOf(j)) && net.kind[k] !== WALK.CROSSING) {
          // no room to pass: the one without right of way turns back (never face to face for ever)
          slowTo[i] = -1;
        }
      }
    }
  }

  // personal space: anyone (followers too) eases sideways, inside their walk's room, away from a stranger closer than 0.7 m
  function separate(i, dt) {
    let goal = 0, blocked = false, crowded = false;
    if (state[i] === STATE.WALK || state[i] === STATE.STAND || state[i] === STATE.WAIT) {
      const k = link[i], ux = net.dirX[k] * dir[i], uz = net.dirZ[k] * dir[i], g = groupOf(i);
      const ix = Math.floor(px[i] / 2), iz = Math.floor(pz[i] / 2);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        for (let j = cellHead[cellOfP(ix + a, iz + b)]; j >= 0; j = cellNext[j]) {
          if (j === i || state[j] === STATE.SIT || Math.abs(py[j] - py[i]) > 0.8) continue;
          const dx = px[j] - px[i], dz = pz[j] - pz[i], d2 = dx * dx + dz * dz;
          if (groupOf(j) === g) {
            // a companion closer than 0.45 m: the later in the group drops back (single file, never inside each other)
            if (d2 < 0.2 && leader[i] >= 0 && (leader[j] < 0 || slot[j] < slot[i])) blocked = true;
            if (d2 < 0.2) { const side = -dx * uz + dz * ux, push = 0.45 - Math.sqrt(d2); goal += side > 0 || (side === 0 && i > j) ? -push : push; }
            continue;
          }
          if (d2 > 0.49) continue;
          const side = -dx * uz + dz * ux, push = 0.7 - Math.sqrt(d2);
          goal += side > 0 || (side === 0 && i > j) ? -push : push;
          // a follower drops back behind a stranger ahead (side by side: the group without right of way)
          const fwd = dx * ux + dz * uz;
          if (leader[i] >= 0 && d2 < 0.3 && (fwd > 0.05 || (fwd > -0.2 && g > groupOf(j)))) blocked = true;
          // waiting or standing: whoever is further on keeps the spot, the other stands a little back
          if (state[i] !== STATE.WALK && leader[i] < 0 && d2 < 0.36 && (fwd > 0.05 || (fwd > -0.05 && g > groupOf(j)))) crowded = true;
        }
      }
    }
    const room = net.width[link[i]];
    goal = Math.max(-room, Math.min(room, goal));
    sep[i] += Math.max(-1.2 * dt, Math.min(1.2 * dt, goal - sep[i]));
    dropBack[i] = blocked ? Math.min(2, dropBack[i] + 1.3 * dt) : Math.max(0, dropBack[i] - 0.5 * dt);
    // (a step back is a real step along the walk: walked again when they go on; at most 2.5 m)
    if (leader[i] < 0 && crowded && qBack[i] < 2.5 && net.kind[link[i]] !== WALK.STAIR) {
      const step = Math.min(0.6 * dt, 2.5 - qBack[i]), k = link[i];
      const to = Math.max(0, Math.min(net.len[k], s[i] - dir[i] * step));
      qBack[i] += Math.abs(to - s[i]); s[i] = to;
    } else if (state[i] === STATE.WALK) qBack[i] = 0;
  }

  // ---- the walk of a leader (or a single) ----
  function arrive(i) {
    const g = goalNode[i], n0 = nodeOf(link[i], dir[i]);
    if (g === n0 || g < 0) {
      if (goalKind[i] === GOAL.SEAT && seatOcc[goalRef[i]] < 0) {
        sitDown(i, goalRef[i]);
        // a companion takes the seat beside
        // (only a seat with its own way back to the walk)
        const pair = goalRef[i] ^ 1;
        if (pair < net.seatCount && net.seatNode[pair] >= 0) for (let j = 0; j < N; j++) if (leader[j] === i && state[j] !== STATE.OFF && seatOcc[pair] < 0) { sitDown(j, pair); act[i] = act[j] = ACT.TALK; break; }
        return true;
      }
      if (goalKind[i] === GOAL.LOOK) {
        const q = goalRef[i];
        state[i] = STATE.STAND; timer[i] = 5 + rnd() * 8; faceX[i] = net.looks[q * 3]; faceZ[i] = net.looks[q * 3 + 1];
        act[i] = rnd() < 0.55 ? ACT.PHOTO : ACT.NONE; if (act[i] === ACT.PHOTO) counters.photos++;
        return true;
      }
      // a stop at the destination: in the shade at midday, talking in company (never in a gate or at a stair head:
      // another goal, walking on)
      if (net.pinch[link[i]] || net.kind[link[i]] === WALK.CROSSING || inRunout(px[i], pz[i])) { chooseGoal(i); return false; }
      state[i] = STATE.STAND; timer[i] = 2 + rnd() * (net.shade[link[i]] && hour === 0 ? 14 : 7);
      // company in a square or by a lit frontage at blue hour stop for a proper conversation
      if (groupSize[i] > 1 && (net.kind[link[i]] === WALK.PLAZA || (hour === 2 && net.lit[link[i]]))) timer[i] = 8 + rnd() * 16;
      const k = link[i]; faceX[i] = px[i] + net.dirX[k] * dir[i] * 5; faceZ[i] = pz[i] + net.dirZ[k] * dir[i] * 5;
      act[i] = groupSize[i] > 1 ? ACT.TALK : ACT.NONE;
      return true;
    }
    return false;
  }
  function stepLeader(i, dt) {
    const st = state[i];
    goalAge[i] += dt; leaderV[i] = 0;
    if (st === STATE.SIT) {
      if (seatOf[i] >= 0 && PERMANENT(seatOf[i])) return;
      timer[i] -= dt;
      if (timer[i] <= 0) { standUp(i); for (let j = 0; j < N; j++) if (leader[j] === i && state[j] === STATE.SIT) standUp(j); }
      return;
    }
    if (st === STATE.FREE) { stepFree(i, dt); return; }
    if (st === STATE.STAND) {
      timer[i] -= dt;
      if (timer[i] <= 0) { state[i] = STATE.WALK; act[i] = ACT.NONE; endTalk(i); if (goalAge[i] > 2) chooseGoal(i); }
      return;
    }
    if (st === STATE.WAIT) {
      timer[i] -= dt;
      const n0 = nodeOf(link[i], dir[i]), k = pendingLink[i];
      if (k >= 0 && net.kind[k] === WALK.CROSSING) {
        if (frame % 4 === i % 4 && !vehicleOnCrossing(k, -timer[i])) {
          // clear: cross from the kerb (if they stood back to make room, walk up to it first and look again)
          const atKerb = (dir[i] > 0 ? net.len[link[i]] - s[i] : s[i]) < 0.05;
          state[i] = STATE.WALK; pendingLink[i] = -1;
          if (atKerb) { enter(i, k, n0); counters.crossings++; }
        }
        else if (timer[i] < -40) { counters.gaveUp++; state[i] = STATE.WALK; pendingLink[i] = -1; turnBack(i); chooseGoal(groupLeadAfterTurn); }
        faceX[i] = midX[k]; faceZ[i] = midZ[k];
        return;
      }
      if (timer[i] <= 0) { state[i] = STATE.WALK; turnBack(i); chooseGoal(groupLeadAfterTurn); }
      else if (!riderBlocks(i)) state[i] = STATE.WALK;
      return;
    }
    // walking
    if (riderBlocks(i)) {
      if (net.kind[link[i]] === WALK.STAIR) { turnBack(i); return; }
      state[i] = STATE.WAIT; timer[i] = 1.5 + rnd(); pendingLink[i] = -1; counters.waits++;
      faceX[i] = rider.x; faceZ[i] = rider.z; return;
    }
    avoid(i);
    // nobody can pass: turn back (but not again at once: a group just turned waits for the way to clear)
    if (slowTo[i] < 0) { if (clock - turnedAt[i] > 3) { turnBack(i); chooseGoal(groupLeadAfterTurn); return; } slowTo[i] = 0; }
    // walking pace: slower on stairs and steep ground, a little faster on a crossing, no faster than the one ahead
    const k0 = link[i];
    let v = Math.min(slowTo[i], pace[i] * (net.kind[k0] === WALK.STAIR ? 0.7 : net.kind[k0] === WALK.CROSSING ? 1.15 : 1));
    // a companion is held up (a car in their step, still getting up): wait for them (as long as for a car of one's own)
    if (groupHold[i]) {
      v = 0; carWait[i] += dt;
      if (carWait[i] > (net.kind[link[i]] === WALK.CROSSING ? 3 : 25)) { carWait[i] = 0; turnBack(i); retreatUntil[groupLeadAfterTurn] = clock + 3; chooseGoal(groupLeadAfterTurn); leaderV[i] = 0; return; }
    }
    // the step about to be taken: into a car's footprint now or in a moment? Stop short. (On a crossing only a car
    // standing in the way stops them: they finish crossing.) Long blocked: another way.
    {
      const ux = net.dirX[k0] * dir[i], uz = net.dirZ[k0] * dir[i];
      const crossing = net.kind[k0] === WALK.CROSSING;
      // (on a crossing they pass in front of a car that has stopped for them: only its body ahead stops them; someone
      // a car has come up against walks on out of its way; held up in the carriageway, back to the kerb so it can go)
      CQ[0] = px[i]; CQ[1] = py[i]; CQ[2] = pz[i]; CQ[3] = 0.1;
      const insideNow = carAt(false);
      CQ[0] = px[i] + ux * 0.45; CQ[2] = pz[i] + uz * 0.45; CQ[3] = crossing ? 0.2 : 0.35;
      if (!insideNow && carAt(!crossing)) {
        v = 0; carWait[i] += dt;
        if (carWait[i] > (crossing ? 3 : 25)) { carWait[i] = 0; turnBack(i); retreatUntil[groupLeadAfterTurn] = clock + 3; chooseGoal(groupLeadAfterTurn); leaderV[i] = 0; return; }
      } else if (!groupHold[i]) carWait[i] = Math.max(0, carWait[i] - dt);
    }
    leaderV[i] = v;
    let left = v * dt;
    walked[i] += left;
    for (let guard = 0; guard < 4 && left > 0; guard++) {
      const k = link[i], len = net.len[k];
      const room = dir[i] > 0 ? len - s[i] : s[i];
      if (left < room) { s[i] += dir[i] * left; left = 0; break; }
      s[i] = dir[i] > 0 ? len : 0; left -= room;
      const n0 = nodeOf(k, dir[i]);
      if (arrive(i)) return;
      const next = nextLink(i, n0);
      if (next < 0) { turnBack(i); if (leader[i] >= 0) return; continue; }
      // into the gate bore only when the rider is not about to come through: wait outside its mouth
      if (net.pinch[next] && net.kind[next] === WALK.PROMENADE && rider.valid && hyp(rider.x - midX[next], rider.z - midZ[next]) < net.len[next] / 2 + 14) {
        state[i] = STATE.WAIT; timer[i] = 1.2 + rnd(); pendingLink[i] = -1; counters.waits++; faceX[i] = rider.x; faceZ[i] = rider.z;
        return;
      }
      // (a crossing that runs on into another is crossed in one go: nobody waits in the carriageway)
      if (net.kind[next] === WALK.CROSSING && net.kind[k] !== WALK.CROSSING && vehicleOnCrossing(next)) {
        state[i] = STATE.WAIT; timer[i] = 0; pendingLink[i] = next; counters.waits++;
        return;
      }
      if (net.kind[next] === WALK.CROSSING) counters.crossings++;
      enter(i, next, n0);
    }
    // a short look round now and then (never on a stair or in the street)
    const kind = net.kind[link[i]];
    if (walked[i] > nextPause[i] && kind !== WALK.STAIR && kind !== WALK.CROSSING && kind !== WALK.LANE && !net.pinch[link[i]] && !inRunout(px[i], pz[i])) {
      walked[i] = 0; nextPause[i] = 30 + rnd() * 70;
      state[i] = STATE.STAND; timer[i] = 1.5 + rnd() * 4;
      faceX[i] = px[i] + Math.sin(yaw[i] + (rnd() - 0.5) * 2.5) * 5; faceZ[i] = pz[i] + Math.cos(yaw[i] + (rnd() - 0.5) * 2.5) * 5;
    }
    // no progress towards the goal for a long while: another goal
    const g = goalNode[i];
    if (g >= 0) {
      const d = hyp(net.nx[g] - px[i], net.nz[g] - pz[i]);
      if (d < goalBest[i] - 2) { goalBest[i] = d; goalAge[i] = 0; }
      else if (goalAge[i] > 45) chooseGoal(i);
    } else if (goalAge[i] > 30) chooseGoal(i);
  }
  // Turn round. A group that turns is led by whoever is now in front: the walk behind the new leader is the old route
  // reversed, so nobody passes through anybody and nobody jumps.
  let groupLeadAfterTurn = -1;
  function turnBack(i) {
    groupLeadAfterTurn = i; turnedAt[i] = clock;
    const flip = (j) => { dir[j] = -dir[j]; lat[j] = -lat[j]; latGoal[j] = lat[j]; dodge[j] = -dodge[j]; sep[j] = -sep[j]; };
    let front = -1, far = 0.6;
    if (leader[i] < 0) for (let j = 0; j < N; j++) if (leader[j] === i && state[j] === STATE.WALK && lagNow[j] + dropBack[j] > far) { front = j; far = lagNow[j] + dropBack[j]; }
    if (front < 0) {
      flip(i); pass[i] = -pass[i];
      // companions beside or close behind: their spot is now ahead (a short negative lag), eased back into place
      for (let j = 0; j < N; j++) if (leader[j] === i) { lagNow[j] = -(lagNow[j] + dropBack[j]); dropBack[j] = 0; }
      for (let h = 0; h < HIST; h++) hist[i * HIST + h] = -1;
      return;
    }
    // where is the new leader on the old leader's route: on its link (h = -1) or on history entry h
    const entry = dir[i] > 0 ? s[i] : net.len[link[i]] - s[i];
    let h = -1, rem = far - entry;
    if (rem > 0) {
      for (h = 0; h < HIST; h++) {
        const kk = hist[i * HIST + h];
        // (past the end of the recorded route the companion stood at its start: that is where it is)
        if (kk < 0) { h--; far -= rem; if (h < 0) far = entry; break; }
        if (rem <= net.len[kk]) break;
        rem -= net.len[kk];
      }
      if (h >= HIST) { h = HIST - 1; }
    }
    // its new history: the links from it towards the old leader (nearest first), walked the other way
    const nh = []; const nd = [];
    for (let q = h - 1; q >= -1; q--) { if (q >= 0 && hist[i * HIST + q] < 0) break; nh.push(q >= 0 ? hist[i * HIST + q] : link[i]); nd.push(q >= 0 ? -histDir[i * HIST + q] : -dir[i]); }
    for (let q = 0; q < HIST; q++) { hist[front * HIST + q] = q < nh.length ? nh[q] : -1; histDir[front * HIST + q] = q < nh.length ? nd[q] : 1; }
    if (h < 0) for (let q = 0; q < HIST; q++) hist[front * HIST + q] = -1;
    // the group, re-ordered from the new front
    const members = [];
    for (let j = 0; j < N; j++) if (j === i || leader[j] === i) members.push(j);
    const backFrom = (j) => (j === i ? far : far - (lagNow[j] + dropBack[j]));
    members.sort((a, b) => backFrom(a) - backFrom(b));
    flip(front); pass[front] = -pass[i]; leader[front] = -1; slot[front] = 0; turnedAt[front] = clock; groupLeadAfterTurn = front;
    goalNode[front] = goalNode[i]; goalKind[front] = goalKind[i]; goalRef[front] = goalRef[i]; goalBest[front] = Infinity; goalAge[front] = 0;
    walked[front] = walked[i]; nextPause[front] = nextPause[i]; pendingLink[front] = -1; dropBack[front] = 0; lagNow[front] = 0;
    let m = 1;
    for (const j of members) {
      if (j === front) continue;
      const back = Math.max(0, backFrom(j));
      leader[j] = front; slot[j] = m++; lagNow[j] = back; dropBack[j] = 0;
      if (j === i) { state[i] = STATE.WALK; lat[i] = -lat[i]; dodge[i] = -dodge[i]; sep[i] = -sep[i]; dir[i] = -dir[i]; }
    }
    for (let j = 0; j < N; j++) if (leader[j] === front) { lagNow[j] = Math.max(0, lagNow[j]); }
    if (globalThis.__hand) for (let j = 0; j < N; j++) if (leader[j] === front) {
      const p = pathPoint(front, lagNow[j] + dropBack[j]), a = net.a[p.k];
      const x = net.nx[a] + net.dirX[p.k] * p.s, z = net.nz[a] + net.dirZ[p.k] * p.s;
      globalThis.__hand(j, Math.hypot(x - px[j], z - pz[j]), h, nh.length, far, entry);
    }
  }
  function stepFree(i, dt) {
    // straight to the front of a seat (or back), then into the seat (or onto the walk)
    const dx = freeTX[i] - freeFX[i], dz = freeTZ[i] - freeFZ[i], len = hyp(dx, dz);
    freeT[i] += pace[i] * (leg[i] === 1 && !leaving[i] ? 0.6 : 0.8) * dt;
    if (freeT[i] >= len) {
      px[i] = freeTX[i]; pz[i] = freeTZ[i]; py[i] = freeTY[i];
      freeFX[i] = freeTX[i]; freeFZ[i] = freeTZ[i]; freeFY[i] = freeTY[i]; freeT[i] = 0;
      if (leaving[i]) {
        const n0 = goalRef[i];
        if (leg[i] === 2 && n0 >= 0) { leg[i] = 1; freeTX[i] = net.nx[n0]; freeTZ[i] = net.nz[n0]; freeTY[i] = net.ny[n0]; return; }
        if (n0 >= 0) rejoin(i, n0); else { state[i] = STATE.WALK; leaving[i] = 0; leg[i] = 0; }
        return;
      }
      const seat = seatOf[i];
      if (seat < 0) { state[i] = STATE.WALK; leg[i] = 0; return; }
      const o = seat * 5;
      if (leg[i] === 2 && !STANDING(seat)) { leg[i] = 1; freeTX[i] = net.seats[o]; freeTZ[i] = net.seats[o + 1]; freeTY[i] = net.seats[o + 4]; return; }
      state[i] = STATE.SIT; leg[i] = 0; yaw[i] = net.seats[o + 3];
      return;
    }
    const t = len > 0 ? freeT[i] / len : 1;
    px[i] = freeFX[i] + dx * t; pz[i] = freeFZ[i] + dz * t; py[i] = freeFY[i] + (freeTY[i] - freeFY[i]) * t;
  }

  // ---- followers: in formation behind or beside their leader, on the leader's route ----
  const pp = { k: 0, s: 0, d: 1 };
  function pathPoint(l, lag) {
    let k = link[l], d = dir[l];
    const len = net.len[k], entry = d > 0 ? s[l] : len - s[l];
    if (lag < 0) { pp.k = k; pp.d = d; pp.s = Math.max(0, Math.min(len, s[l] - d * lag)); return pp; } // a little ahead
    if (lag <= entry) { pp.k = k; pp.d = d; pp.s = s[l] - d * lag; return pp; }
    let rem = lag - entry;
    for (let h = 0; h < HIST; h++) {
      const kk = hist[l * HIST + h]; if (kk < 0) break;
      const dd = histDir[l * HIST + h], ll = net.len[kk];
      if (rem <= ll) { pp.k = kk; pp.d = dd; pp.s = dd > 0 ? ll - rem : rem; return pp; }
      rem -= ll; k = kk; d = dd;
    }
    pp.k = k; pp.d = d; pp.s = d > 0 ? 0 : net.len[k];
    return pp;
  }
  function stepFollower(i, l, dt) {
    if (state[i] === STATE.SIT) { if (state[l] !== STATE.SIT && state[l] !== STATE.FREE) standUp(i); return; }
    if (state[i] === STATE.FREE) { stepFree(i, dt); if (state[i] === STATE.FREE) groupHold[l] = 1; return; }
    // Every companion a place of their own (centres at least 0.45 m apart): abreast where the walk has room, a small
    // ring when the group stops, single file where neither fits. Sideways places point away from the walk's nearer edge.
    // (the side is kept until the leader is well over on it: a companion never crosses through the leader)
    if (fSide[i] === 0 || (fSide[i] > 0 && lat[l] > 0.25) || (fSide[i] < 0 && lat[l] < -0.25)) fSide[i] = lat[l] > 0 ? -1 : 1;
    const m = slot[i], wl = net.width[link[l]], away = fSide[i], stopped = groupSize[l] > 1
      && (state[l] === STATE.STAND || state[l] === STATE.WAIT || state[l] === STATE.SIT || state[l] === STATE.FREE);
    let lag, side;
    if (stopped) {
      // gathered round, facing in: beside, behind on either side, the other side
      lag = m === 1 ? 0 : m === 4 ? 0 : 0.5; side = (m === 1 ? 0.55 : m === 2 ? 0.3 : m === 3 ? -0.3 : -0.55) * away;
    } else {
      lag = m === 1 ? 0.12 : m === 2 ? 1.5 : 1.7; side = (m === 1 ? 0.55 : m === 2 ? 0 : m === 3 ? 0.5 : -0.5) * away;
      if (m === 2 && wl >= 1.0) { lag = 0.25; side = -0.55 * away; }
    }
    // the place the walk allows; too close to the leader (or, for the back pair, to each other): single file
    const eff = (sd) => Math.max(-wl, Math.min(wl, lat[l] + sd)) - lat[l];
    const close = (dl, ds) => dl * dl + ds * ds < 0.45 * 0.45;
    if (close(lag, eff(side)) || (m >= 3 && !stopped && Math.abs(eff(0.5 * away) - eff(-0.5 * away)) < 0.45)
      || (stopped && m >= 2 && wl < 0.5) || (!stopped && wl < 0.45)) { lag = m * (stopped ? 0.6 : 0.95); side = 0; }
    // walk into the formation (the path distance and the side eased, never set at once)
    const was = lagNow[i];
    lagNow[i] = was + Math.max(-1.0 * dt, Math.min(0.8 * dt, lag - was));
    let p = pathPoint(l, lagNow[i] + Math.max(0, dropBack[i]));
    // the route changed under them (a turn on the spot, a fresh start): re-anchor to the nearest point of the
    // leader's route, then walk into formation from there
    if (!fresh[i]) {
      const a = net.a[p.k], tx = net.nx[a] + net.dirX[p.k] * p.s, tz = net.nz[a] + net.dirZ[p.k] * p.s;
      if ((tx - px[i]) * (tx - px[i]) + (tz - pz[i]) * (tz - pz[i]) > 1.0) {
        let best = Infinity, bestLag = lagNow[i];
        for (let q = -8; q <= 24; q++) {
          const lg = q * 0.25, pq = pathPoint(l, lg), aq = net.a[pq.k];
          const ex = net.nx[aq] + net.dirX[pq.k] * pq.s - px[i], ez = net.nz[aq] + net.dirZ[pq.k] * pq.s - pz[i], dd = ex * ex + ez * ez;
          if (dd < best) { best = dd; bestLag = lg; }
        }
        if (best > 1.0) {
          // nowhere near the leader's route: they part company, walking on from where they are
          for (let j = 0; j < N; j++) if (j === l || leader[j] === l) groupSize[j] = Math.max(1, groupSize[j] - 1);
          leader[i] = -1; groupSize[i] = 1; slot[i] = 0; state[i] = STATE.WALK; chooseGoal(i);
          return;
        }
        lagNow[i] = bestLag; dropBack[i] = 0;
        p = pathPoint(l, lagNow[i]);
      }
    }
    // the step about to be taken: into a car (now or about to be there)? then stay (fall back) and hold the group
    {
      const k = p.k, a = net.a[k], sx = Math.max(0, Math.min(net.len[k], p.s));
      const x = net.nx[a] + net.dirX[k] * (sx + p.d * 0.45), z = net.nz[a] + net.dirZ[k] * (sx + p.d * 0.45);
      // (walking back from a car with their group, the way they came, they do not hold it up)
      CQ[0] = x; CQ[1] = py[i]; CQ[2] = z; CQ[3] = net.kind[k] === WALK.CROSSING ? 0.2 : 0.35;
      if (state[l] === STATE.WALK && clock > retreatUntil[l] && carAt(net.kind[k] !== WALK.CROSSING)) {
        lagNow[i] = Math.min(12, was + leaderV[l] * dt); groupHold[l] = 1;
        p = pathPoint(l, lagNow[i] + Math.max(0, dropBack[i]));
      }
    }
    // walking the other way now (the group turned, or a hairpin): keep the side they are on
    if (net.dirX[link[i]] * dir[i] * net.dirX[p.k] * p.d + net.dirZ[link[i]] * dir[i] * net.dirZ[p.k] * p.d < -0.2) { lat[i] = -lat[i]; sep[i] = -sep[i]; dodge[i] = -dodge[i]; }
    link[i] = p.k; dir[i] = p.d; s[i] = Math.max(0, Math.min(net.len[p.k], p.s));
    const w = net.width[p.k];
    const goal = Math.max(-w, Math.min(w, lat[l] + side));
    lat[i] += Math.max(-0.7 * dt, Math.min(0.7 * dt, goal - lat[i]));
    state[i] = state[l] === STATE.WALK ? STATE.WALK : STATE.STAND;
    if (state[i] === STATE.STAND) {
      // in a conversation the whole group takes part (who speaks takes turns: speaking())
      act[i] = act[l] === ACT.TALK || (groupSize[l] > 1 && m === 1 && act[l] !== ACT.PHOTO) ? ACT.TALK : ACT.NONE;
      faceX[i] = act[l] === ACT.PHOTO ? faceX[l] : px[l]; faceZ[i] = act[l] === ACT.PHOTO ? faceZ[l] : pz[l];
    } else act[i] = ACT.NONE;
  }

  // ---- position, height and heading from the walk state ----
  function resolve(i, dt) {
    const st = state[i];
    let x = 0, z = 0, y = 0; // (numbers from the start: an undefined that later holds a number is a boxed value)
    if (st === STATE.SIT) {
      // in the seat, or a step out of it for a moment (a vendor or the kite family after a bump)
      const seat = seatOf[i], o = seat * 5;
      x = (seat >= 0 ? net.seats[o] : freeTX[i]) + ox[i]; z = (seat >= 0 ? net.seats[o + 1] : freeTZ[i]) + oz[i]; y = py[i];
    } else if (st === STATE.FREE) { x = px[i]; z = pz[i]; y = py[i]; }
    else {
      const k = link[i], a = net.a[k], d = dir[i];
      // every offset together (keep-right, formation, sidestep, shove) stays inside the link's checked corridor:
      // aside no further than its room, along no further than its ends
      const ux = net.dirX[k], uz = net.dirZ[k], w = net.width[k];
      let side = (lat[i] + dodge[i] + pass[groupOf(i)] + sep[i]) * d + (ox[i] * -uz + oz[i] * ux);
      let along = s[i] + ox[i] * ux + oz[i] * uz;
      side = side < -w ? -w : side > w ? w : side;
      along = along < 0 ? 0 : along > net.len[k] ? net.len[k] : along;
      x = net.nx[a] + ux * along - uz * side;
      z = net.nz[a] + uz * along + ux * side;
      // the walked profile, read here (a call with a number argument and result would box both, for every person)
      if (net.stair[k] >= 0) y = walkHeight(net, k, along);
      else {
        const c = net.profCount[k] - 1, o = net.profStart[k], len = net.len[k];
        if (c <= 0) y = net.prof[o];
        else { const f = (len > 0 ? (along < 0 ? 0 : along > len ? 1 : along / len) : 0) * c, j = f < c - 1 ? Math.floor(f) : c - 1, wt = f - j; y = net.prof[o + j] * (1 - wt) + net.prof[o + j + 1] * wt; }
        y += net.cross[k] * side;
      }
      // never a jump: a change of place (a corner taken off-centre, a new formation spot) is walked at no more than a
      // brisk pace; anything larger than 2.5 m is a new placement and the feet are planted afresh
      if (!fresh[i] && dt > 0) {
        const jx = x - px[i], jz = z - pz[i], jump = Math.sqrt(jx * jx + jz * jz), cap = (pace[i] * 1.5 + 0.5) * dt;
        if (jump > 2.5) { rigs[i].placed = false; counters.jumps++; globalThis.__jump?.(i, jump, st, leader[i], k); }
        else if (jump > cap) {
          const f = cap / jump; x = px[i] + jx * f; z = pz[i] + jz * f;
          // … and still inside the checked corridor of this link, or of the one just left (round a corner)
          const q = lastLink[i] !== k ? lastLink[i] : prevLink[i];
          let inPrev = false;
          const cal = (x - net.nx[a]) * ux + (z - net.nz[a]) * uz, csd = -(x - net.nx[a]) * uz + (z - net.nz[a]) * ux;
          if (cal >= 0 && cal <= net.len[k] && csd >= -w && csd <= w) { along = cal; y = walkHeight(net, k, cal) + net.cross[k] * csd; inPrev = true; }
          else if (q >= 0 && q !== k) {
            const qa = net.a[q], qx = x - net.nx[qa], qz = z - net.nz[qa], qal = qx * net.dirX[q] + qz * net.dirZ[q], qsd = -qx * net.dirZ[q] + qz * net.dirX[q];
            // (its torso boxes were checked a quarter metre past its ends: TORSO.reach)
            if (qal >= -0.25 && qal <= net.len[q] + 0.25 && qsd >= -net.width[q] && qsd <= net.width[q]) { inPrev = true; y = walkHeightAt(net, q, Math.max(0, Math.min(net.len[q], qal)), qsd); }
          }
          if (!inPrev) {
            let al = (x - net.nx[a]) * ux + (z - net.nz[a]) * uz, sd = -(x - net.nx[a]) * uz + (z - net.nz[a]) * ux;
            al = al < 0 ? 0 : al > net.len[k] ? net.len[k] : al; sd = sd < -w ? -w : sd > w ? w : sd;
            x = net.nx[a] + ux * al - uz * sd; z = net.nz[a] + uz * al + ux * sd; along = al;
            y = walkHeight(net, k, al) + net.cross[k] * sd;
          }
        }
      }
    }
    // never into a car: a step (along or aside) that would enter a car's body from outside it is not taken this frame
    if (!fresh[i] && st !== STATE.SIT && carCount) {
      CQ[0] = x; CQ[1] = y; CQ[2] = z; CQ[3] = 0.12;
      if (carAt(false)) { CQ[0] = px[i]; CQ[2] = pz[i]; if (!carAt(false)) { x = px[i]; z = pz[i]; y = py[i]; } }
    }
    fresh[i] = 0;
    if (st !== STATE.SIT && st !== STATE.FREE) { if (link[i] !== lastLink[i]) { prevLink[i] = lastLink[i]; lastLink[i] = link[i]; } }
    if (dt > 0) { vx[i] = (x - px[i]) / dt; vz[i] = (z - pz[i]) / dt; if (hyp(vx[i], vz[i]) > 6) vx[i] = vz[i] = 0; }
    px[i] = x; pz[i] = z; py[i] = y;
    // heading: along the walk, at the person faced while standing
    if (st === STATE.WALK) { const k = link[i]; yaw[i] = Math.atan2(net.dirX[k] * dir[i], net.dirZ[k] * dir[i]); }
    else if (st === STATE.FREE) {
      // settling back into a seat faces out of it; otherwise the way they walk
      if (leg[i] === 1 && !leaving[i] && seatOf[i] >= 0) yaw[i] = net.seats[seatOf[i] * 5 + 3];
      else { const dx = freeTX[i] - freeFX[i], dz = freeTZ[i] - freeFZ[i]; if (dx * dx + dz * dz > 1e-4) yaw[i] = Math.atan2(dx, dz); }
    }
    else if (st !== STATE.SIT) { const dx = faceX[i] - x, dz = faceZ[i] - z; if (dx * dx + dz * dz > 0.04) yaw[i] = Math.atan2(dx, dz); }
    // (each field written only when it changes: a number stored in an object field is a new heap number in this engine)
    const r = records[i], h = yaw[i];
    const top = st === STATE.SIT && !(seatOf[i] >= 0 && STANDING(seatOf[i])) ? y + 1.32 * (heightOf[i] / 1.75) : y + heightOf[i];
    const wx = st === STATE.SIT ? 0 : vx[i], wz = st === STATE.SIT ? 0 : vz[i];
    if (r.x !== x) r.x = x;
    if (r.z !== z) r.z = z;
    if (r.headingY !== h) r.headingY = h;
    if (r.minY !== y) r.minY = y;
    if (r.maxY !== top) r.maxY = top;
    if (r.velocityX !== wx) r.velocityX = wx;
    if (r.velocityZ !== wz) r.velocityZ = wz;
  }

  // ---- strangers meet and talk (SF edition's meeting scheduler, on the walk network) ----
  const meet = new Map();
  let nextMeeting = 0;
  function meetings() {
    if (clock < nextMeeting) return;
    nextMeeting = clock + 1;
    meet.clear();
    for (let i = 0; i < N; i++) {
      if (state[i] !== STATE.WALK || leader[i] >= 0 || groupSize[i] > 1 || partner[i] >= 0 || clock < social[i] || cooldown[i] > 0 || dodge[i]) continue;
      const kind = net.kind[link[i]]; if (kind === WALK.STAIR || kind === WALK.CROSSING || kind === WALK.LANE || net.pinch[link[i]] || inRunout(px[i], pz[i])) continue;
      const key = Math.floor(px[i] / 2) * 4096 + Math.floor(pz[i] / 2);
      let found = -1;
      for (let dx = -1; dx <= 1 && found < 0; dx++) for (let dz = -1; dz <= 1 && found < 0; dz++) {
        const q = meet.get(key + dx * 4096 + dz);
        if (q === undefined) continue;
        const d = hyp(px[i] - px[q], pz[i] - pz[q]);
        // (more often in a square, and by a lit frontage at blue hour)
        const chance = net.kind[link[i]] === WALK.PLAZA || (hour === 2 && net.lit[link[i]]) ? 0.4 : 0.15;
        if (d < 0.75 || d > 2 || Math.abs(py[i] - py[q]) > 0.3 || socialRnd() > chance) continue;
        found = q;
      }
      if (found >= 0) {
        const q = found, t = 6 + socialRnd() * 6;
        for (const [p, o] of [[i, q], [q, i]]) {
          partner[p] = o; talking[p] = 1; state[p] = STATE.STAND; timer[p] = t; act[p] = ACT.TALK;
          faceX[p] = px[o]; faceZ[p] = pz[o]; social[p] = clock + 30 + socialRnd() * 60;
        }
        counters.conversations++;
      } else meet.set(key, i);
    }
  }

  // ---- per frame ----
  let drawnNear = 0, drawnFar = 0;
  function update(dt, camera) {
    frame++;
    if (dt > 0) clock += dt;
    if (camera) {
      camera.updateMatrixWorld();
      projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projView); haveCamera = true;
      camX = camera.position.x; camY = camera.position.y; camZ = camera.position.z;
    } else if (focus) { haveCamera = false; camX = focus.x; camZ = focus.z; camY = rider.y + 2; }
    if (focus && focus.serial !== lastFocusSerial) { lastFocusSerial = focus.serial; }
    if (dt > 0) {
      // recycle the far, fill up to the target (out of sight)
      for (let c = 0; c < 12 && N; c++) {
        const i = sweep = (sweep + 1) % N;
        if (state[i] === STATE.OFF || leader[i] >= 0) continue;
        const d = hyp(px[i] - focus.x, pz[i] - focus.z);
        // (never retired in view where they are drawn: they walk on out of sight or out of range first)
        const dc = hyp3(px[i] - camX, py[i] - camY, pz[i] - camZ);
        // (in view, only far off and into a doorway or round a corner)
        const seen = inView(px[i], py[i], pz[i], 2) && dc < drawFar + 3 && !(dc >= retireFar && doorway(link[i]) && state[i] === STATE.WALK);
        // a rider on the move leaves people behind: those well behind make room for people ahead
        const sp = hyp(rider.vx, rider.vz);
        const behind = rider.valid && Math.abs(rider.speed) > 2 && sp > 0.5 && cooldown[i] <= 0 && active >= target - 2
          && ((px[i] - rider.x) * rider.vx + (pz[i] - rider.z) * rider.vz) / sp < -40;
        if (!seen && (d > CFG.recycle || (active > target + 2 && d > 60) || (behind && state[i] !== STATE.SIT))) { release(i); counters.recycled++; }
        else if (seen && d > CFG.recycle + 60) { release(i); counters.recycled++; } // (a safety bound)
      }
      if (runout.on && rider.valid && hyp(rider.x - runout.x, rider.z - runout.z) > 30) runout.on = false;
      refill(false);
      meetings();
      buildHash();
      gatherCars();
      for (let i = 0; i < N; i++) {
        if (state[i] === STATE.OFF) continue;
        passGoal[i] = 0;
        if (leader[i] >= 0 && state[leader[i]] === STATE.OFF) leader[i] = -1;
        if (leader[i] < 0) { stepLeader(i, dt); groupHold[i] = 0; }
      }
      for (let i = 0; i < N; i++) if (state[i] !== STATE.OFF && leader[i] >= 0) stepFollower(i, leader[i], dt);
      for (let i = 0; i < N; i++) {
        if (state[i] === STATE.OFF) continue;
        if (leader[i] < 0) {
          pass[i] += Math.max(-0.9 * dt, Math.min(0.9 * dt, (state[i] === STATE.WALK ? passGoal[i] : 0) - pass[i]));
          if (state[i] === STATE.WALK) lat[i] += Math.max(-0.35 * dt, Math.min(0.35 * dt, latGoal[i] - lat[i]));
        }
        if (state[i] !== STATE.SIT && state[i] !== STATE.FREE) { stepDodge(i, dt); stepShove(i, dt); separate(i, dt); }
        else if (state[i] === STATE.SIT && seatOf[i] >= 0 && PERMANENT(seatOf[i])) stepSeatShove(i, dt);
        else cooldown[i] = Math.max(0, cooldown[i] - dt);
      }
    }
    for (let i = 0; i < N; i++) if (state[i] !== STATE.OFF) resolve(i, dt);
    draw(dt);
    updateAccents();
  }
  function draw(dt) {
    crowd.begin();
    drawnNear = drawnFar = 0;
    for (let i = 0; i < N; i++) {
      if (state[i] === STATE.OFF) continue;
      const d = hyp3(px[i] - camX, pz[i] - camZ, py[i] - camY);
      rigDt[i] += dt;
      if (d > drawFar || !inViewOrNoCamera(i)) continue;
      const far = d > nearLod;
      // far people step their walk at half rate, alternating
      if (far && dt > 0 && ((frame + i) & 1) && rigs[i].placed) { crowd.add(rigs[i], d); drawnFar++; continue; }
      const rig = rigs[i], step = Math.min(0.1, rigDt[i]);
      // (not posed for a while, out of view: the old feet mean nothing now; a fresh pose where they stand)
      if (rigDt[i] > 0.3) rig.placed = false;
      rigDt[i] = 0;
      const seat = seatOf[i];
      // numbers go to the rig through its fields (no boxed arguments per frame)
      rig.inDt = step; rig.inX = px[i]; rig.inZ = pz[i]; rig.inHeading = yaw[i]; rig.inAir = 0;
      if (state[i] === STATE.SIT && !(seat >= 0 && STANDING(seat))) {
        const o = seat * 5, grass = seat >= 0 && net.seatKind[seat] === SEAT_KIND.GRASS;
        rig.seatY = seat >= 0 ? (grass ? net.seats[o + 4] + 0.12 : net.seats[o + 2]) : py[i] + 0.5;
        rig.gy0 = seat >= 0 ? net.seats[o + 4] : py[i];
        rig.sitTalk = act[i] === ACT.TALK && speaking(i) ? 1 : 0;
        rig.seat();
      } else {
        if (state[i] === STATE.SIT) {
          // standing places: a vendor talking to customers, the kite flyer's raised arm, a companion chatting
          const kind = net.seatKind[seat];
          rig.mode = kind === SEAT_KIND.FLYER ? ACT.PHOTO : kind === SEAT_KIND.COMPANION ? ACT.TALK
            : kind === SEAT_KIND.VENDOR ? (customersAt(net.seatGroup[seat]) ? ACT.TALK : ACT.NONE) : ACT.NONE;
        } else rig.mode = act[i];
        surface(rig, i);
        rig.walk();
      }
      drawnFrame[i] = frame;
      crowd.add(rig, d);
      if (far) drawnFar++; else drawnNear++;
    }
    crowd.end();
  }
  const inViewOrNoCamera = (i) => !haveCamera || inView(px[i], py[i], pz[i], 1.3);
  function customersAt(group) {
    for (let q = 0; q < net.seatCount; q++) if (net.seatGroup[q] === group && net.seatKind[q] === SEAT_KIND.CUSTOMER && seatOcc[q] >= 0 && state[seatOcc[q]] === STATE.SIT) return true;
    return false;
  }
  const hand = { x: 0, y: 0, z: 0 };
  let flyerSeat = -1;
  for (let q = 0; q < net.seatCount; q++) if (net.seatKind[q] === SEAT_KIND.FLYER) flyerSeat = q;
  function updateAccents() {
    let h = null;
    // the line from the flyer's raised right palm (as drawn this frame); with the flyer not drawn (far away), no line
    let flyerDrawn = false;
    if (flyerSeat >= 0 && seatOcc[flyerSeat] >= 0) {
      const f = seatOcc[flyerSeat];
      if (drawnFrame[f] === frame && rigs[f].placed) { rigs[f].palm(1, hand); h = hand; flyerDrawn = true; }
    }
    accents.update(context.atmosphere?.elapsed ?? clock, focus?.x ?? 0, focus?.z ?? 0, h, flyerDrawn);
  }

  return {
    update,
    publish(index) {
      for (let i = 0; i < N; i++) if (state[i] !== STATE.OFF) index.add(records[i]);
      accents.publish(index, focus?.x ?? 0, focus?.z ?? 0);
    },
    refocus() {
      setRunout();
      for (let i = 0; i < N; i++) if (state[i] !== STATE.OFF) release(i);
      active = 0; seatOcc.fill(-1);
      refill(true);
    },
    clearAround(x, z, radius) {
      for (let i = 0; i < N; i++) {
        if (state[i] === STATE.OFF) continue;
        if (hyp(px[i] - x, pz[i] - z) < radius) release(leaderOf(i));
      }
    },
    setHour(name) { const h = HOURS.indexOf(name); if (h >= 0) { hour = h; targetClock = -1; } },
    warm(on) { crowd.warming = !!on; accents.warm(on); updateAccents(); },
    stats: () => ({
      active, target, cap: N, near: drawnNear, far: drawnFar, hour: HOURS[hour],
      sitting: count(STATE.SIT), standing: count(STATE.STAND), waiting: count(STATE.WAIT), ...counters,
      network: net.stats, carts: accents.carts.length, kite: !!accents.kite,
    }),
    /** People near a listener: fills reusable records {x, y, z, speed, talking, seed, bumped}; returns the count. */
    audible(out, x, z, radius) {
      let n = 0;
      for (let i = 0; i < N; i++) {
        if (state[i] === STATE.OFF || hyp(px[i] - x, pz[i] - z) > radius) continue;
        const r = out[n] || (out[n] = { x: 0, y: 0, z: 0, speed: 0, talking: false, seed: 0, bumped: 0 });
        r.x = px[i]; r.y = py[i] + heightOf[i] * 0.9; r.z = pz[i]; r.speed = hyp(vx[i], vz[i]);
        r.talking = act[i] === ACT.TALK && speaking(i); r.seed = rigs[i].seed * 131 + i; r.bumped = bumped[i];
        n++;
      }
      return n;
    },
    dispose() { crowd.dispose(); accents.dispose(); },
    // for tests and tools
    debug: { rigs, turnBack: (i) => turnBack(i), groupSize, reachInfo: () => ({ reachN, touchedN, target, active }), leaderV, carWait, groupHold, pace, prevLink, dropBack, slowTo, born, lagNow, slot, turnedAt, hist, clockOf: () => clock, fns: { stepFollower, stepLeader, draw, resolve, stepDodge, stepShove, pathPoint, update }, net, accents, state, link, s, dir, px, py, pz, records, leader, seatOf, STATE, act, counters, react, timer, pendingLink },
  };
  // who in a conversation is speaking now: turns of a few seconds, round the group (or between two who met)
  function speaking(i) {
    const p = partner[i];
    if (p >= 0) { const lo = Math.min(i, p); return ((Math.floor(clock / 2.6 + lo * 0.37) & 1) === 0) === (i === lo); }
    const g = groupOf(i), n = Math.max(1, groupSize[g]);
    let talkers = 0, mine = -1;
    for (let j = 0; j < N; j++) if (state[j] !== STATE.OFF && groupOf(j) === g && act[j] === ACT.TALK) { if (j === i) mine = talkers; talkers++; }
    if (talkers < 2) return talkers === 1 && n > 1; // the one talking to companions (who listen)
    return Math.floor(clock / 2.6 + g * 0.37) % talkers === mine;
  }
  function count(st) { let c = 0; for (let i = 0; i < N; i++) if (state[i] === st) c++; return c; }
}
