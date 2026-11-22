/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan — adapted from VibezZzCoder/euc-sanfrancisco (MIT) */
// Officer Dorkins: the chase and the booking that follows a capture. A host part (see the list in js/main.js).
//
// He is EUC Thrills' officer on his hover wheel with the paddle (the generated NPC look, js/euc/render/riderLook.js
// 'cop'), drawn as a kinematic pose: he is not a second rider controller, not a solid body, and never moves the rider
// except through the rider controller's own hardKnock. The rendered rig and chase loop follow the San Francisco edition
// (js/sf-nemesis.js, © 2026 VibezZzCoder, MIT; first written for the New York edition) without its searchlight: the
// light bar is emissive only and no light is added to the scene.
//
// Built once behind the loading screen and compiled with the city; while he is not around the part costs one cheap
// call a frame and no sound graph exists. ?cop=0 builds nothing at all.
import * as THREE from 'three/webgpu';
import { Fn, uv, vec2, length, smoothstep, color, uniform } from 'three/tsl';
import { createPose } from './euc/simulation/EucController.js';
import { PADDLE } from './euc/data/tuning.js';
import { createRidingRig } from './euc/render/ridingRig.js';
import { riderLook } from './euc/render/riderLook.js';
import { machineLook } from './euc/render/machineLook.js';
import { areasOf } from './sj-world.js';
import { buildPursuitGraph } from './sj-dorkins-graph.js';
import { createFlightQueries } from './sj-dorkins-flight.js';
import { createFlightBrain, HOVER } from './sj-dorkins-brain.js';
import { createPaddleContact } from './sj-dorkins-contact.js';
import { createChaseDirector, chaseHudView, CHASE_RULES, CHASE_TEXT } from './sj-dorkins-chase.js';
import { createSwing, SWING } from './sj-dorkins-swing.js';
import { createCloseRange } from './sj-dorkins-close.js';
import { createDorkinsAudio } from './sj-dorkins-audio.js';
import { createBooking, BOOKING_SITE } from './sj-booking.js';

const FACE = PADDLE.reach * 0.62;
// Includes the outstretched paddle, hover bob, lean and the shadow quad's largest visible extent.
const RIG_BOUND = 3.5, SHADOW_BOUND = 2.3, SHADOW_FADE = 12;
// After this long held in view, a departure beyond HOLD_FAR metres from the camera may retire.
const HOLD_LIMIT = 30, HOLD_FAR = 150;
// Spawns keep away from where the rider has just been put (a map arrival, the start, the booking release) and from the
// desk; a spawn under a roof (a bore, an arcade) is refused.
const SPAWN_CLEAR = 30, PLACED_MEMORY = 60, SPAWN_MS = 1;
export const PATROL_KEY = 'euc-sanjuan-dorkins';
const finite = p => p && [p.x, p.y, p.z].every(Number.isFinite);

export function createPatrolPreference(getStorage = () => globalThis.localStorage) {
  let value = true;
  try { value = getStorage().getItem(PATROL_KEY) !== 'off'; } catch { /* private storage: default on */ }
  return {
    get value() { return value; },
    set(next) { next = Boolean(next); if (next === value) return false; value = next;
      try { getStorage().setItem(PATROL_KEY, value ? 'on' : 'off'); } catch { /* this visit still uses the choice */ } return true; },
  };
}

function hoverRig() {
  const rig = createRidingRig(riderLook('cop'), machineLook('standard'));
  rig.group.name = 'dorkins-hover-wheel';
  let paddle = null, shellClone = null;
  rig.group.traverse(o => {
    o.castShadow = false;
    if (!o.isMesh) return;
    o.receiveShadow = true;
    if (o.name === 'euc-shell') { shellClone = o.material.clone(); o.material = shellClone; shellClone.color.set(0x22314f); }
    if (o.name === 'rider-paddle-mesh') paddle = o;
  });
  rig.euc.tyre.visible = false;
  const parts = new THREE.Group(); parts.name = 'dorkins-hover-parts'; rig.euc.group.add(parts);
  const glow = opacity => new THREE.MeshBasicMaterial({ color: 0x46c8ff, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25 * 0.86, 0.028, 10, 48),
    new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x46c8ff, emissiveIntensity: 3, roughness: 0.4 }));
  ring.rotation.y = Math.PI / 2; ring.position.y = 0.25;
  const field = new THREE.Mesh(new THREE.CircleGeometry(0.25 * 0.84, 40), glow(0.22));
  field.rotation.y = Math.PI / 2; field.position.y = 0.25;
  const pods = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 14),
    new THREE.MeshStandardMaterial({ color: 0x1a2236, metalness: 0.6, roughness: 0.35 }), 2);
  const exhaust = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.28, 14, 1, true).rotateX(Math.PI), glow(0.35), 2);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 2; i++) {
    const x = (i ? 1 : -1) * 0.19;
    pods.setMatrixAt(i, matrix.makeTranslation(x, 0.09, 0));
    exhaust.setMatrixAt(i, matrix.makeTranslation(x, -0.14, 0));
  }
  exhaust.position.y = 0.04;
  parts.add(ring, field, pods, exhaust);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2a2a, emissiveIntensity: 6, roughness: 0.3 }));
  bar.position.set(0, 0.64, 0); rig.euc.body.add(bar);
  const red = new THREE.Color(0xff2a2a), blue = new THREE.Color(0x2a5bff);
  return {
    rig, paddle,
    update(time, speed, alarm) {
      bar.material.emissive.copy((time * (alarm ? 7 : 2.2)) % 1 < 0.5 ? red : blue);
      exhaust.scale.set(1, (0.75 + Math.min(1, speed / HOVER.cruiseSpeed) * 0.6) * (0.92 + 0.08 * Math.sin(time * 37)), 1);
    },
    dispose() {
      parts.removeFromParent(); bar.removeFromParent(); pods.dispose(); exhaust.dispose();
      for (const mesh of [ring, field, pods, exhaust, bar]) { mesh.geometry.dispose(); mesh.material.dispose(); }
      shellClone?.dispose(); rig.dispose();
    },
  };
}

// A soft dark disc under him that fades with height (a contact shadow; he casts no real shadow).
function hoverShadow() {
  const strength = uniform(0);
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.colorNode = color(0x020305);
  material.opacityNode = Fn(() => smoothstep(1, 0.15, length(uv().sub(vec2(0.5, 0.5)).mul(2))).mul(strength))();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material);
  mesh.name = 'dorkins-shadow'; mesh.renderOrder = 1; mesh.castShadow = mesh.receiveShadow = false;
  return { mesh, place(x, y, z, height) {
    const h = Math.max(0, height), size = 1.1 + h * 0.15;
    mesh.position.set(x, y + 0.03, z); mesh.scale.set(size, 1, size);
    strength.value = 0.6 * Math.max(0, 1 - h / SHADOW_FADE);
  }, dispose() { mesh.removeFromParent(); mesh.geometry.dispose(); material.dispose(); } };
}

const inRing = (x, z, ring) => { let s = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
  const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) s = !s; } return s; };

const edgeDistance = (x, z, ring) => { let best = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
  const [ax, az] = ring[j], [bx, bz] = ring[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0; best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; };
/** Apron round a skate spot's ring that still counts as the spot (El Bowl's ring is the bowl itself; riders arrive and
 * wait on its apron). */
export const SKATE_APRON = 12;
/** The skate spots (places with a ring: Skatepark del Muelle, El Bowl, each with its apron) as a point test (x, z) → name | null. */
export function skateSpots(world) {
  const spots = areasOf(world).flatMap(a => a.places ?? []).filter(p => Array.isArray(p.ring) && p.ring.length >= 3).map(p => {
    const xs = p.ring.map(q => q[0]), zs = p.ring.map(q => q[1]), m = SKATE_APRON;
    return { name: p.name, ring: p.ring, x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, z0: Math.min(...zs) - m, z1: Math.max(...zs) + m };
  });
  const at = (x, z) => spots.find(s => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && (inRing(x, z, s.ring) || edgeDistance(x, z, s.ring) <= SKATE_APRON))?.name ?? null;
  at.spots = spots;
  return at;
}

export async function createDorkins(host) {
  if (host.params.get('cop') === '0') { const row = host.$('dorkins')?.closest('label'); if (row) row.hidden = true; return null; }
  const { scene, world, life, camera } = host;
  const graphs = life?.graphs ?? {};
  const queries = createFlightQueries(world);
  const graph = graphs.walk || graphs.lanes ? buildPursuitGraph({ walk: graphs.walk, lanes: graphs.lanes }) : null;
  queries.graph = graph;
  const random = life?.context?.random ? life.context.random('dorkins') : Math.random;
  const brain = createFlightBrain(queries, graph), director = createChaseDirector({ random }), swing = createSwing();
  const contact = createPaddleContact(queries, director), close = createCloseRange(queries);
  const hover = hoverRig(), rig = hover.rig, shadow = hoverShadow(), pose = createPose();
  rig.group.visible = shadow.mesh.visible = false;
  scene.add(rig.group, shadow.mesh);
  const skateAt = skateSpots(world);
  let skatePos = null; const skatingNow = () => !!skatePos && skateAt(skatePos.x, skatePos.z) !== null; // asked only when an ambush is due
  // where the rider was just put: no spawn within SPAWN_CLEAR of these for PLACED_MEMORY riding seconds
  const placedAt = [];
  const keepClear = () => [host.spawn, BOOKING_SITE.desk, ...BOOKING_SITE.release, ...placedAt].filter(Boolean);

  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
  const head = new THREE.Vector3(), face = new THREE.Vector3(), departCamera = new THREE.Vector3();
  const facts = { riding: false, crashed: false, distance: Infinity, sees: false, inView: false, skating: false };
  const audioView = { present: false, chasing: false, x: 0, z: 0, range: Infinity, closing: 0, speed: 0,
    chaseTime: 0, sting: 0, windup: 0, swing: 0, hit: 0, tear: 0, swinging: false, pan: 0 };
  let active = false, booking = false, warming = false, time = 0, lastRange = Infinity, rideSeconds = 0;
  let departure = null, departRetry = 0, heldTime = 0;
  let observedController = null, serial, wasCrashed = false, wasRecovering = false;
  const observedPosition = { x: 0, y: 0, z: 0, valid: false };
  const stage = { x: 0, y: 0, z: 0, heading: 0, speed: 0, bank: 0, pitch: 0 };
  const stats = { ambushes: 0, spawnRefused: 0, spawns: 0, hits: 0, captures: 0, escapes: 0, maxFrameMs: 0, lastSpawn: null, spawnFrames: 0, spawnFrameMs: 0, giveUps: 0, placements: 0, toolsClosed: 0, stoodAside: 0 };

  function hide() {
    active = booking = false; departure = null; departRetry = 0; heldTime = 0;
    if (!warming) rig.group.visible = shadow.mesh.visible = false;
    audioView.present = audioView.chasing = audioView.swinging = false;
    audioView.range = Infinity; audioView.closing = 0; lastRange = Infinity;
    facts.sees = false; contact.reset(); swing.cancel(0); close.reset(); search.on = false;
    if (director.state.phase === 'chasing' || director.state.phase === 'leaving') director.postpone(CHASE_RULES.againMin);
  }
  function refreshFrustum() {
    camera.updateWorldMatrix(true, false);
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection, camera.coordinateSystem, camera.reversedDepth);
  }
  function inView(x, y, z, radius = 1.5) { sphere.center.set(x, y, z); sphere.radius = radius; return frustum.intersectsSphere(sphere); }
  function presentationInView(x, y, z, floor) {
    return inView(x, y + 1, z, RIG_BOUND) || (Number.isFinite(floor) && inView(x, floor + 0.03, z, SHADOW_BOUND));
  }
  function render(f) {
    const slow = 1 - Math.min(1, f.speed / 3), commit = swing.commitment;
    pose.x = f.x; pose.y = f.y + 0.04 * slow * Math.sin(time * 2.3); pose.z = f.z;
    pose.headingY = f.heading; pose.speed = f.speed; pose.crouch = pose.tuck = commit;
    pose.rollAngle = pose.riderRoll = f.bank - SWING.leanRoll * commit;
    pose.wheelPitch = f.pitch; pose.riderPitch = f.pitch * 0.5;
    rig.setTrickPose(0, 0); swing.headTarget(pose.x, pose.y, pose.z, pose.headingY, head);
    rig.applySwing(head, swing.angle, commit); rig.apply(pose); rig.applyStatus(0, time, 1);
    hover.update(time, f.speed, swing.phase === 'windup');
    const floor = queries.supportAt(f.x, f.z, f.y);
    shadow.mesh.visible = (active || warming) && !!floor && !floor.offCourse && !floor.water && floor.height <= f.y && f.y - floor.height < SHADOW_FADE;
    if (shadow.mesh.visible) shadow.place(f.x, floor.height, f.z, f.y - floor.height);
  }
  function observe(p) {
    const c = p.controller, s = c?.placementSerial, crashed = !!c?.crashed, recovering = c?.state === 'recovering';
    const changed = observedController !== c;
    const placed = !changed && s !== serial;
    const displaced = observedPosition.valid && (changed || placed || Math.hypot(p.position.x - observedPosition.x,
      p.position.y - observedPosition.y, p.position.z - observedPosition.z) > 5);
    const recovered = observedPosition.valid && (changed || placed || (wasCrashed && !crashed) || (recovering && !wasRecovering));
    if (displaced || crashed || recovered) { contact.reset(); facts.sees = false; }
    if ((crashed || recovered || displaced) && swing.phase === 'windup') swing.cancel();
    if (displaced) lastRange = Infinity;
    director.observePlayer({ crashed, recovered, displaced });
    observedController = c; serial = s; wasCrashed = crashed; wasRecovering = recovering;
    observedPosition.x = p.position.x; observedPosition.y = p.position.y; observedPosition.z = p.position.z; observedPosition.valid = true;
    facts.crashed = crashed;
  }
  // Behind the rider and out of view, on the pursuit graph first, then a bounded radial fallback walked along the
  // rider's own floor; under open sky; away from where the rider was just put; always through the brain's checked place.
  // The search is spread over frames (SPAWN_MS of work a frame, cheapest tests first) and ends at the first admitted
  // candidate, which is checked again against the rider and camera of that frame. A refused search backs off: longer
  // and longer waits, and no new search until the rider has moved on (or a long while has passed).
  const search = { on: false, list: null, i: 0, radial: 0, obs: { x: 0, y: 0, z: 0, heading: 0 }, clearOf: [], refusals: 0, refusedAt: null, refusedTime: 0 };
  const RADIAL = [40, 60, 80].flatMap(d => [0, -0.5, 0.5, -1, 1, -1.4, 1.4].map(angle => [d, angle]));
  function beginSpawn(p) {
    const o = search.obs; o.x = p.position.x; o.y = p.position.y; o.z = p.position.z; o.heading = p.heading;
    const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
    search.list = graph ? graph.nearby(o.x, o.z, 100, 256, { minDistance: 35, referenceY: o.y, maxHeight: 45 })
      .filter(id => (graph.x[id] - o.x) * fx + (graph.z[id] - o.z) * fz <= 0) : [];
    search.i = 0; search.radial = 0; search.clearOf = keepClear(); search.on = true;
  }
  // one candidate: the cheap tests first, the sight line and the checked placement last; returns a pose or null
  function candidate(x, floorY, z, p) {
    const o = search.obs;
    if (search.clearOf.some(q => Math.hypot(q.x - x, q.z - z) < SPAWN_CLEAR)) return null;
    for (const h of [14, 7, 1.2]) {
      const y = floorY + h;
      if (Math.hypot(x - p.position.x, y - p.position.y, z - p.position.z) > CHASE_RULES.sightRange) continue;
      if (presentationInView(x, y, z, floorY)) continue;
      const floor = queries.supportAt(x, z, y);
      if (!floor || floor.offCourse || floor.water || Math.abs(floor.height - floorY) > 2) continue;
      if (!queries.clearLine({ x, y: floorY + 0.5, z }, { x, y: floorY + 16, z })) return null; // roofed: a bore or an arcade
      if (!queries.clearLine({ x, y: y + 0.9, z }, { x: p.position.x, y: p.position.y + 1.2, z: p.position.z })) continue;
      if (!queries.allowed(x, z, y)) continue;
      return { x, y, z };
    }
    return null;
  }
  function stepSpawn(p, budget) {
    const deadline = performance.now() + budget;
    refreshFrustum();
    while (performance.now() < deadline) {
      let pose = null;
      if (search.i < search.list.length) { const id = search.list[search.i++]; pose = candidate(graph.x[id], graph.y[id], graph.z[id], p); }
      else if (search.radial < RADIAL.length) {
        const [d, angle] = RADIAL[search.radial++], o = search.obs, a = o.heading + Math.PI + angle, dx = Math.sin(a), dz = Math.cos(a);
        let y = o.y, floor = null;
        for (let n = 1, steps = Math.ceil(d / 4); n <= steps; n++) {
          floor = queries.supportAt(o.x + dx * d * n / steps, o.z + dz * d * n / steps, y);
          if (!floor || floor.offCourse || floor.water || Math.abs(floor.height - y) > 3) { floor = null; break; }
          y = floor.height;
        }
        if (floor) pose = candidate(o.x + dx * d, y, o.z + dz * d, p);
      } else return 'refused';
      if (pose && brain.place(pose, Math.atan2(p.position.x - pose.x, p.position.z - pose.z))) return pose;
    }
    return 'pending';
  }
  function admitted(pose, p) {
    search.on = false; search.refusals = 0; search.refusedAt = null;
    const observation = { x: p.position.x, y: p.position.y, z: p.position.z, heading: p.heading };
    brain.seedObservation(observation, true);
    director.update(Number.EPSILON, { riding: true, sees: true, distance: Math.hypot(pose.x - observation.x, pose.y - observation.y, pose.z - observation.z) });
    active = true; rig.group.visible = true; contact.reset(); swing.cancel(0); close.reset(); close.resetTotal(); lastRange = Infinity;
    stats.spawns++; stats.lastSpawn = { x: +pose.x.toFixed(1), y: +pose.y.toFixed(1), z: +pose.z.toFixed(1) };
    render(brain.state); audioView.sting++;
  }
  function refused(p) {
    search.on = false; search.refusals++; stats.spawnRefused++;
    search.refusedAt = { x: p.position.x, z: p.position.z }; search.refusedTime = rideSeconds;
    director.postpone(Math.min(30, 3 * 2 ** (search.refusals - 1)));
  }
  // A blocked climb (under a roof) gets a bounded checked sideways waypoint, kept until reached or retried.
  function depart(dt) {
    const f = brain.state;
    departRetry -= dt;
    if (departure && Math.hypot(f.x - departure.x, f.y - departure.y, f.z - departure.z) < 1) { departure = null; departRetry = 0; }
    if (departRetry <= 0) {
      departRetry = 2;
      if (queries.clearFlight(f, { x: f.x, y: f.y + 3, z: f.z })) departure = { x: f.x, y: f.y + 30, z: f.z };
      else {
        const cam = camera.getWorldPosition(departCamera), away = Math.atan2(f.x - cam.x, f.z - cam.z);
        departure = null;
        for (const delta of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, 3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI]) {
          const a = away + delta, next = { x: f.x + Math.sin(a) * 7, y: f.y, z: f.z + Math.cos(a) * 7 };
          if (queries.clearFlight(f, next)) { departure = next; break; }
        }
      }
    }
    return brain.leave(dt, departure || { x: f.x, y: f.y, z: f.z });
  }

  // ---- the riding frame
  function chase(dt, p) {
    observe(p); skatePos = p.position;
    if (booking || warming || !(dt > 0)) { contact.reset(); facts.sees = false; return; }
    dt = Math.min(dt, HOVER.maxStep); facts.riding = true;
    if (!active) {
      facts.distance = Infinity; facts.sees = facts.inView = false;
      if (search.on) {
        const t0 = performance.now(), result = stepSpawn(p, SPAWN_MS);
        const ms = performance.now() - t0; stats.spawnFrames++; if (ms > stats.spawnFrameMs) stats.spawnFrameMs = ms;
        if (result === 'refused') refused(p); else if (result !== 'pending') admitted(result, p);
        return;
      }
      facts.skating = skatingNow;
      if (director.update(dt, facts) === 'ambush') {
        // after a refusal, wait for the rider to move on before searching again (or for a long while)
        const r = search.refusedAt;
        if (r && Math.hypot(p.position.x - r.x, p.position.z - r.z) < 20 && rideSeconds - search.refusedTime < 45) { director.postpone(2); return; }
        stats.ambushes++; beginSpawn(p);
      }
      return;
    }
    if (director.state.phase === 'captured') { contact.reset(); return; }
    time += dt;
    const before = brain.state, chasing = director.state.phase === 'chasing';
    const distance = Math.hypot(p.position.x - before.x, p.position.y - before.y, p.position.z - before.z);
    const observation = { x: p.position.x, y: p.position.y, z: p.position.z, heading: p.heading,
      vx: Math.sin(p.heading) * p.speed, vz: Math.cos(p.heading) * p.speed };
    facts.distance = distance;
    facts.sees = chasing && distance <= CHASE_RULES.sightRange && queries.clearLine(
      { x: before.x, y: before.y + 0.9, z: before.z }, { x: observation.x, y: observation.y + 1.2, z: observation.z });
    // close range: strike only when the swing can be delivered; otherwise come round another side, or give up
    const closeMode = chasing && swing.phase === 'idle' && !facts.crashed && director.state.recovery <= 0
      ? close.update(dt, before, facts.sees ? observation : null, distance) : 'chase';
    if (closeMode === 'giveup') { stats.giveUps++; director.giveUp(); }
    if (chasing && closeMode === 'chase' && close.canStrike && swing.ready && director.state.acquired && facts.sees && distance <= SWING.triggerRange
      && !facts.crashed && director.state.recovery <= 0 && Math.abs(p.speed) <= SWING.maxQuarrySpeed) {
      swing.start(); contact.reset(); audioView.windup++; close.struck();
    } else if (swing.phase === 'windup' && (facts.crashed || !facts.sees || !chasing)) swing.cancel();
    if (swing.update(dt) === 'strike') audioView.swing++;
    const striking = swing.contact.from <= swing.contact.to;
    let f;
    if (chasing && (swing.phase === 'windup' || swing.phase === 'active' || striking))
      f = brain.swoop(dt, observation, facts.sees, { lateral: SWING.lateral, height: SWING.swoopHeight, commit: swing.phase !== 'windup' });
    else if (chasing && closeMode === 'reposition') f = brain.leave(dt, close.target);
    else if (chasing) f = brain.update(dt, observation, facts.sees);
    else f = depart(dt);
    render(f);
    if (hover.paddle) {
      hover.paddle.updateWorldMatrix(true, false); face.set(0, 0, FACE).applyMatrix4(hover.paddle.matrixWorld);
      if (contact.frame({ face, rider: { x: p.position.x, z: p.position.z, bottom: p.position.y },
        interval: striking ? swing.contact : null, controller: p.controller, placementSerial: p.controller?.placementSerial,
        enabled: chasing && !facts.crashed && director.state.recovery <= 0 })) {
        audioView.hit++; facts.crashed = true; stats.hits++; close.struck();
      }
    }
    facts.distance = Math.hypot(p.position.x - f.x, p.position.y - f.y, p.position.z - f.z);
    if (director.state.phase === 'leaving') refreshFrustum();
    const leaving = director.state.phase === 'leaving';
    heldTime = leaving ? heldTime + (facts.inView ? dt : 0) : 0;
    facts.inView = leaving && presentationInView(f.x, f.y, f.z, shadow.mesh.visible ? shadow.mesh.position.y : null)
      && (heldTime < HOLD_LIMIT || camera.getWorldPosition(departCamera).distanceTo(sphere.center.set(f.x, f.y, f.z)) < HOLD_FAR);
    if (facts.inView && leaving) director.hold(dt);
    else {
      const event = director.update(dt, facts);
      if (event === 'escaped' || event === 'missed') stats.escapes++;
      if (event === 'gone') { hide(); return; }
    }
    const range = facts.distance, closing = Number.isFinite(lastRange) ? (lastRange - range) / dt : 0;
    audioView.present = true; audioView.chasing = director.state.phase === 'chasing';
    audioView.x = f.x; audioView.z = f.z; audioView.range = range;
    audioView.closing += (closing - audioView.closing) * (1 - Math.exp(-dt * 4));
    audioView.speed = f.speed; audioView.chaseTime = director.state.chaseTime;
    audioView.swinging = swing.phase === 'windup' || swing.phase === 'active'; lastRange = range;
  }

  // ---- the officer as the booking scene's presenter
  const officer = {
    begin(x, y, z, heading) {
      Object.assign(stage, { x, y, z, heading }); booking = active = true;
      swing.cancel(0); contact.reset(); rig.group.visible = true;
      audioView.present = audioView.chasing = audioView.swinging = false; render(stage); // at the desk: no siren, no hum
    },
    present(dt, action) {
      if (!booking) return;
      if (dt > 0) time += Math.min(dt, HOVER.maxStep);
      render(stage);
      if (action?.writing) {
        pose.crouch = 0.12; pose.riderPitch = 0.08;
        head.set(action.x + Math.sin(action.age * 24) * 0.09, action.y + Math.abs(Math.sin(action.age * 12)) * 0.04, action.z);
        rig.applySwing(head, 0.45, 0.8); rig.apply(pose);
      }
    },
    tear() { if (host.state === 'booking' && !host.muted) audio?.tear(); },
    end() { hide(); }, // also retires him when the booking was skipped before the desk scene began
  };

  // ---- chase notice (#chase): who, what now, warnings, the escape bar; written only when a string changes
  const notice = host.$('chase');
  notice.replaceChildren();
  const el = (tag, cls, parent = notice) => { const e = document.createElement(tag); e.className = cls; parent.append(e); return e; };
  const n = { who: el('span', 'chase-who'), line: el('span', 'chase-line'), heat: el('span', 'chase-heat') };
  n.meter = el('span', 'chase-meter'); n.bar = el('i', 'chase-bar', n.meter); n.meter.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < CHASE_RULES.warningKnockdowns; i++) el('b', 'chase-pip', n.heat).setAttribute('aria-hidden', 'true');
  n.heatText = el('span', 'chase-heat-text', n.heat);
  n.who.textContent = 'Officer Dorkins';
  // Where the notice goes: measured against the riding screen's panels only when its geometry can change (it appears or
  // changes kind or length, the window resizes, the camera tools or the FPS counter toggle, the fallen line comes or
  // goes) — never per frame, never for a new distance figure. It tries the top right under the HUD, then the top left,
  // then lower beside them, or centred, never over the rider's part of the screen and never over a panel. It never moves
  // another panel: when nothing is free while the camera tools are open, it closes them (the Camera button reopens
  // them; reopened, they keep their place and the notice goes below them, beside the rider if it must).
  let placeDue = false, placedLength = -1, closedTools = false;
  const placeSoon = () => { placeDue = true; if (!notice.hidden) placeNotice(); };
  const visibleEl = e => e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
  const overlaps = (p, q) => p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1;
  function placeNotice() {
    placeDue = false; stats.placements++; placedLength = n.line.textContent.length;
    const W = innerWidth, H = innerHeight, body = document.body, tools = host.$('camera-tools');
    const toolsOpen = body.classList.contains('camera-tools-open') && tools && !tools.hidden;
    const panels = [...document.querySelectorAll('#hud button,#speed,#hud .street:not([data-empty]),#fps,#ride-status>*,#touch-controls .touch-buttons button,#camera-tools')]
      .filter(e => e.id !== 'camera-tools' || toolsOpen).filter(visibleEl).map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    const rider = { left: W * 0.3, right: W * 0.7, top: H * (W > H ? 0.45 : 0.42), bottom: H * 0.94 }; // where the chase camera keeps the rider
    const hud = host.$('hud').getBoundingClientRect(), status = panels.filter(r => r.top >= hud.bottom - 1 && r.top < hud.bottom + 80);
    // the HUD's own visible pieces (its street row is hidden in some short windows)
    const hudBottom = Math.max(hud.top, ...[...host.$('hud').querySelectorAll('button,#speed,.street:not([data-empty]),#fps')].filter(visibleEl).map(e => e.getBoundingClientRect().bottom));
    const below = [...new Set([hudBottom + 8, hud.bottom + 8, ...status.map(r => r.bottom + 6), ...(toolsOpen ? [tools.getBoundingClientRect().bottom + 8] : [])])].sort((x, y) => x - y);
    const st = notice.style;
    st.transform = 'none'; st.width = '';
    const width = notice.getBoundingClientRect().width;
    const tryAll = avoidRider => {
      for (const side of ['right', 'left', 'centre']) for (const top of side === 'centre' ? [hud.top, ...below] : below) {
        st.top = `${top}px`;
        if (side === 'right') { st.left = 'auto'; st.right = `${Math.max(10, W - hud.right + 6)}px`; }
        else if (side === 'left') { st.right = 'auto'; st.left = `${Math.max(10, hud.left + 6)}px`; }
        else { st.right = 'auto'; st.left = `${Math.round((W - width) / 2)}px`; }
        const r = notice.getBoundingClientRect();
        if (r.bottom <= H - 4 && r.left >= 0 && r.right <= W && !(avoidRider && overlaps(r, rider)) && !panels.some(q => overlaps(r, q))) return true;
      }
      return false;
    };
    st.visibility = '';
    if (tryAll(true)) return;
    if (toolsOpen && !closedTools) { closedTools = true; stats.toolsClosed++; host.$('camera-button').click(); return; } // the class change places it again
    // reopened on purpose (or no room at all): the tools keep their place and the notice goes below them, beside the rider
    // if it must, narrower in the column left of the touch buttons if that is all there is
    if (tryAll(false)) return;
    const buttons = [...document.querySelectorAll('#touch-controls .touch-buttons button')].filter(visibleEl).map(e => e.getBoundingClientRect().left);
    const narrow = Math.min(width, (buttons.length ? Math.min(...buttons) : W) - 18 - Math.max(10, hud.left + 6));
    if (narrow >= 96) { st.width = `${Math.floor(narrow)}px`; if (tryAll(false)) return; st.width = ''; }
    if (toolsOpen) { st.visibility = 'hidden'; stats.stoodAside++; return; } // nowhere at all: it waits until they close
    st.left = 'auto'; st.right = `${Math.max(10, W - hud.right + 6)}px`; st.top = `${Math.max(...below)}px`;
  }
  new MutationObserver(() => placeSoon()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => placeSoon()).observe(host.$('fps'), { attributes: true, attributeFilter: ['hidden'] });
  { const fallen = host.$('rider-status'); let wasEmpty = !fallen.textContent; // only whether the line is there
    new MutationObserver(() => { const empty = !fallen.textContent; if (empty !== wasEmpty) { wasEmpty = empty; placeSoon(); } })
      .observe(fallen, { childList: true, characterData: true, subtree: true }); }
  const shown = {};
  const put = (key, value, write) => { if (shown[key] !== value) { shown[key] = value; write(value); } };
  function updateNotice() {
    const v = chaseHudView(director.state, facts.distance, CHASE_RULES, swing.phase);
    const on = !booking && (active ? v.cue !== null || v.banner !== null : v.banner === 'escaped' || v.banner === 'released');
    put('on', on, value => { notice.hidden = !value; if (value) placeDue = true; else closedTools = false; });
    if (!on) return;
    const line = v.banner ? v.bannerText : v.cue === 'seen' ? `${v.metres} m away` : CHASE_TEXT[v.cue];
    put('line', line, value => { n.line.textContent = value; if (Math.abs(value.length - placedLength) > 3) placeDue = true; }); // a new figure alone: no re-measure
    put('kind', v.banner ?? v.cue ?? '', value => { notice.dataset.kind = value; placeDue = true; });
    put('heat', v.heat, value => { notice.dataset.heat = String(value); });
    put('heatText', v.heatText, value => { n.heatText.textContent = value; });
    put('hot', v.hot, value => { notice.toggleAttribute('data-hot', value); });
    put('meter', Math.round(v.losing * 20), value => { if (n.meter.hidden !== (value === 0)) placeDue = true; n.meter.hidden = value === 0; n.bar.style.transform = `scaleX(${value / 20})`; });
    if (placeDue) placeNotice();
  }

  // ---- Pause switch "Officer Dorkins on patrol"
  const legend = host.$('legend-dorkins');
  const patrol = createPatrolPreference();
  const box = host.$('dorkins');
  director.setPatrol(patrol.value);
  if (box) { box.checked = patrol.value; box.onchange = () => { patrol.set(box.checked); director.setPatrol(patrol.value); }; }

  // ---- sound and booking
  let audio = null;
  const bookingPart = await createBooking(host, { officer, director, life, stats });

  function frameMs(t0) { const ms = performance.now() - t0; if (ms > stats.maxFrameMs) stats.maxFrameMs = ms; }
  const api = {
    warm(on) {
      warming = !!on;
      if (on) {
        const s = host.spawn ?? { x: 0, y: 0, z: 0, headingY: 0 };
        Object.assign(stage, { x: s.x + 3, y: s.y + 1.2, z: s.z + 3, heading: 0 });
        rig.group.visible = true; render(stage); shadow.place(stage.x, s.y, stage.z, 1.2); shadow.mesh.visible = true;
      } else if (!active) rig.group.visible = shadow.mesh.visible = false;
      bookingPart.warm(on);
    },
    sound(context, out) { audio = createDorkinsAudio(context, out); },
    gate(next, prev) {
      bookingPart.gate(next, prev);
      if (next !== 'riding' || prev === 'booking') { put('on', false, () => { notice.hidden = true; }); audio?.silence(); }
    },
    frame(dt) {
      const t0 = performance.now();
      const p = host.entity;
      if (p && Number.isFinite(p.speed) && Number.isFinite(p.heading) && finite(p.position)) {
        rideSeconds += dt;
        for (let i = placedAt.length - 1; i >= 0; i--) if (rideSeconds - placedAt[i].t > PLACED_MEMORY) placedAt.splice(i, 1);
        chase(dt, p);
      }
      if (director.state.phase === 'captured' && !bookingPart.active) {
        stats.captures++; bookingPart.start(p?.label ?? 'Rider', director.state.knockdowns);
      }
      if (audio && host.state === 'riding' && (active || audioView.present || audio.live)) { // a capture this frame has already left riding
        const e = camera.matrixWorld.elements, dx = audioView.x - e[12], dz = audioView.z - e[14], d = Math.hypot(dx, dz) || 1;
        audioView.pan = (dx * e[0] + dz * e[2]) / d; // the camera's right axis is the matrix's first column
        audio.update(audioView);
      }
      // idle (he is away, no banner left): nothing is computed or written
      if (shown.on || director.state.phase === 'chasing' || director.state.eventAge < CHASE_RULES.bannerSeconds) updateNotice();
      if (active) frameMs(t0);
    },
    idle(dt, now, state) { if (state === 'booking') bookingPart.idle(dt, now); },
    resize() { bookingPart.resize(); placeSoon(); },
    view(cam) { bookingPart.view(cam); },
    cancel() { return bookingPart.cancel(); },
    placed(reason) {
      contact.reset(); facts.sees = false;
      const p = host.entity?.position;
      if (p && reason !== 'rescue') placedAt.push({ x: p.x, z: p.z, t: rideSeconds });
    },
    rider() { contact.reset(); facts.sees = false; observedController = null; observedPosition.valid = false; },
    map(ctx, k) {
      const chasing = active && !booking && director.state.phase === 'chasing';
      if (legend && legend.hidden === chasing) legend.hidden = !chasing;
      if (!chasing) return;
      // drawn where he is; when he is right beside the rider the marker steps out from under the rider's arrow (in CSS
      // pixels) on his side, tied to his true position by a short line
      const f = brain.state, r = 7 * k, p = host.entity.position, dx = f.x - p.x, dz = f.z - p.z, d = Math.hypot(dx, dz), clear = 17 * k;
      let mx = f.x, mz = f.z;
      if (d < clear) {
        const ux = d > 1e-3 ? dx / d : -Math.sin(host.entity.heading), uz = d > 1e-3 ? dz / d : -Math.cos(host.entity.heading);
        mx = p.x + ux * clear; mz = p.z + uz * clear;
        ctx.beginPath(); ctx.moveTo(f.x, f.z); ctx.lineTo(mx, mz); ctx.strokeStyle = '#182c40'; ctx.lineWidth = 2 * k; ctx.stroke();
      }
      ctx.save(); ctx.translate(mx, mz);
      ctx.beginPath(); ctx.arc(0, 0, r + 2 * k, 0, Math.PI * 2); ctx.fillStyle = '#182c40'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#2a5bff'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = '#d8312b'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 2.6 * k, 0, Math.PI * 2); ctx.fillStyle = '#f8f1e3'; ctx.fill();
      ctx.restore();
    },
    away() { bookingPart.away(); audio?.silence(); },
    returned() { bookingPart.returned(); },
    failed() { bookingPart.failed(); audio?.dispose(); audio = null; },
    // read by QA through the host's part list; nothing in the game calls these
    debug: { director, brain, graph, queries, swing, stats, close, skateAt, booking: bookingPart, audioView, get audio() { return audio; },
      get active() { return active; } },
  };
  updateNotice();
  return api;
}
