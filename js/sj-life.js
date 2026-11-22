/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// City life: the one place where the game meets its traffic and its people.
//
// The host (js/main.js) builds it after the world and before the construction records are released, hands its
// `dynamicWorld` to the rider and calls `update` once per riding frame before the rider steps:
//
//   traffic.update → people.update      each moves its actors, reading the rider and last frame's bodies
//   bodies.begin → publish → commit     one shared snapshot of every moving body for the rider's controller
//   kit.commit                          vehicle draw buffers
//
// Every part receives the same `context`:
//   scene, world, atmosphere, renderer, phone, params
//   caps      {cars, people}: population caps for this device (?cars= and ?people= override, ?life=0 gives 0)
//   rider     {valid, x, y, z, heading, vx, vz, speed, crashed, minY, maxY, halfWidth, halfLength}: last committed pose
//   focus     {x, z, serial}: the point life gathers round (the rider); serial counts jumps (teleports)
//   hour      {name, night}: 'midday' | 'golden' | 'blue'; night is 1 only at blue hour
//   bodies    the shared index (js/sj-actor-bodies.js); dynamicBodiesNear(x, z, r, out) reads the last snapshot
//   random    (name) → a seeded generator returning numbers in [0, 1): the same city every run
//   sides     street cross-sections (js/sj-street-sides.js)
//   kit       the vehicle kit (js/sj-vehicles.js)
//   clear     {rider: m}: no actor is placed nearer to the rider than this
// and returns {update, publish, refocus, clearAround, setHour, warm, stats, dispose}.
import { createEucDynamicWorld, EUC_DYNAMIC_HULL } from './euc-dynamic.js';
import { createActorBodyIndex } from './sj-actor-bodies.js';
import * as sides from './sj-street-sides.js';
import { createVehicleKit } from './sj-vehicles.js';
import { createTraffic } from './sj-traffic.js';
import { createPeople } from './sj-people.js';
import { seededRandom } from './sj-life-random.js';
import { createLifeAudio } from './sj-life-audio.js';
import { buildWalkNetwork } from './sj-walk.js';

export { seededRandom };

export const LIFE_CAPS = Object.freeze({
  desktop: Object.freeze({ cars: 40, people: 220 }),
  phone: Object.freeze({ cars: 28, people: 130 }),
});
const TELEPORT_METRES = 12; // a larger jump in one frame is a teleport, not riding

export async function createCityLife({ scene, world, atmosphere, renderer, phone = false, params = new URLSearchParams(), hour = 'golden' }) {
  const enabled = params.get('life') !== '0';
  const base = LIFE_CAPS[phone ? 'phone' : 'desktop'];
  const cap = (key) => {
    if (!enabled) return 0;
    const value = Number(params.get(key));
    return params.has(key) && Number.isFinite(value) ? Math.max(0, Math.min(600, Math.round(value))) : base[key];
  };
  const caps = { cars: cap('cars'), people: cap('people') };
  const bodies = createActorBodyIndex(16);
  const rider = { valid: false, x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0, crashed: false, minY: 0, maxY: 0,
    halfWidth: EUC_DYNAMIC_HULL.halfWidthMetres, halfLength: EUC_DYNAMIC_HULL.halfLengthMetres };
  const focus = { x: 0, z: 0, serial: 0 };
  const hourState = { name: hour, night: hour === 'blue' ? 1 : 0 };
  const context = { scene, world, atmosphere, renderer, phone, params, caps, rider, focus, hour: hourState, bodies,
    random: seededRandom, sides, kit: null, clear: { rider: 14 } };
  const kit = context.kit = createVehicleKit(context);
  const traffic = await createTraffic(context);
  const people = await createPeople(context);
  const parts = [traffic, people];
  // Read-only city graphs for other host parts (the officer's pursuit graph, js/sj-dorkins-graph.js): the lane graph
  // traffic drives and the walk network people use. With no people the walk network is still built here, while the
  // construction records exist, unless the officer is off too (?cop=0).
  const graphs = Object.freeze({ lanes: traffic.lanes ?? null,
    walk: people.debug?.net ?? (params.get('cop') !== '0' ? buildWalkNetwork(world) : null) });
  const dynamicWorld = createEucDynamicWorld({ bodiesNear: bodies.dynamicBodiesNear, version: bodies.bodyVersion });
  const ms = { traffic: 0, people: 0, publish: 0, kit: 0 };
  const smooth = (key, value) => { ms[key] += (value - ms[key]) * 0.05; };
  let audio = null;

  function publish() {
    bodies.begin();
    for (const part of parts) part.publish(bodies);
    bodies.commit();
  }
  function readRider(entity) {
    const p = entity.position, h = entity.heading, speed = entity.speed || 0;
    rider.x = p.x; rider.y = p.y; rider.z = p.z; rider.heading = h; rider.speed = speed;
    rider.vx = Math.sin(h) * speed; rider.vz = Math.cos(h) * speed;
    rider.crashed = !!entity.controller?.crashed;
    rider.minY = p.y; rider.maxY = p.y + EUC_DYNAMIC_HULL.heightMetres;
    rider.valid = true;
  }

  return {
    enabled, caps, context, bodies, dynamicWorld, kit, traffic, people, graphs,
    /** Once per riding frame, before the rider steps. `entity` is the rider entity; dt 0 only refreshes the snapshot. */
    update(dt, entity, camera) {
      if (entity) {
        const jumped = rider.valid && Math.hypot(entity.position.x - rider.x, entity.position.z - rider.z) > TELEPORT_METRES + Math.abs(rider.speed) * dt * 3;
        readRider(entity);
        focus.x = rider.x; focus.z = rider.z;
        if (jumped) { focus.serial++; for (const part of parts) part.refocus(); }
      }
      const t0 = performance.now();
      traffic.update(dt, camera);
      const t1 = performance.now();
      people.update(dt, camera);
      const t2 = performance.now();
      publish();
      const t3 = performance.now();
      kit.commit(camera, focus);
      const t4 = performance.now();
      if (dt > 0) { smooth('traffic', t1 - t0); smooth('people', t2 - t1); smooth('publish', t3 - t2); smooth('kit', t4 - t3); }
    },
    /** Gather life round a new place (the spawn, a map arrival): everything repopulates out of the rider's sight. */
    focus(entity, camera = null) {
      readRider(entity);
      focus.x = rider.x; focus.z = rider.z; focus.serial++;
      for (const part of parts) part.refocus();
      this.update(0, null, camera);
    },
    /** Empty a disc before the rider is placed in it; parked cars are part of the built city and stay. */
    clearAround(x, z, radius = 6) {
      for (const part of parts) part.clearAround(x, z, radius);
      publish();
    },
    setHour(name) {
      hourState.name = name; hourState.night = name === 'blue' ? 1 : 0;
      for (const part of parts) part.setHour(name);
      audio?.setHour(name);
    },
    /** The city's sound (js/sj-life-audio.js) in the game's AudioContext, under `destination`; null with ?life=0. */
    createAudio(audioContext, destination) {
      if (!enabled) return null;
      audio?.dispose();
      return audio = createLifeAudio({ context: audioContext, destination, traffic, people, phone, hour: hourState.name });
    },
    warm(on) { kit.warm(on); for (const part of parts) part.warm(on); },
    stats: () => ({ enabled, caps, traffic: traffic.stats(), people: people.stats(), kit: kit.stats(), bodies: bodies.stats.bodies,
      ms: { traffic: +ms.traffic.toFixed(3), people: +ms.people.toFixed(3), publish: +ms.publish.toFixed(3), kit: +ms.kit.toFixed(3) } }),
    dispose() { audio?.dispose(); for (const part of parts) part.dispose(); kit.dispose(); },
  };
}
