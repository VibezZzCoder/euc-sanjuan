/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Moving traffic: what the mapped streets cannot say on their own. Data only (js/sj-traffic-graph.js reads it).
//
// Roads are named by OSM way id; an entry applies to every clipped part of that way in city.roads unless it gives
// `parts` (the order of that id's parts in city.roads). Everything else the lane graph decides from the built world:
// solids, water, closed and private ground, stairs and grade remove a lane or a turn wherever they stand.

// Ways no moving car uses, with the reason (the reason is reported in the graph statistics).
export const NO_CARS = new Map([
  // Foot streets mapped with a car class
  [22226154, 'foot'],          // Callejón Cabo Corroras: a stepped alley
  // The Puerta de San Juan and its approach: a pedestrian gate
  [248557853, 'gate'],
  // Bores through the walls: their floors are authored for riders and walkers, not for cars
  [224319347, 'bore'], [224319348, 'bore'], // Calle Bajada Matadero
  [142860683, 'bore'],         // Calle Cementerio
  [260861721, 'bore'],         // the service way under the Capitol's monumental stair
  // Closed or private service ways
  [1071618360, 'private'], [1071618361, 'private'], // Coast Guard base
  [294776923, 'private'], [196837840, 'private'], [294776705, 'private'], // Covadonga terminal gates
]);

// Speed classes, km/h (each car picks its own speed inside the range).
export const SPEEDS = Object.freeze({
  service: [9, 15],
  grid: [12, 20],    // the old one-way grid
  spine: [18, 28],   // Norzagaray, Recinto Sur, Covadonga, Tanca, Comercio
  avenue: [25, 35],  // the harbour and Capitol avenues
});
export const SPINE_NAMES = new Set(['Calle de Norzagaray', 'Calle Norzagaray', 'Calle del Recinto Sur', 'Paseo Covadonga',
  'Calle de la Tanca', 'Calle Comercio', 'Calle Reverendo Gerardo Dávila', 'Calle Paseo de Colón', 'Calle Marina']);
export const AVENUE_KINDS = new Set(['primary', 'primary_link', 'secondary', 'secondary_link']);
// Avenues by name too: a piece of one mapped with a lesser class keeps the avenue's speed and right of way.
export const AVENUE_NAMES = new Set(['Paseo Dr. Gilberto Concepción de Gracia', 'Avenida Luis Muñoz Rivera',
  'Avenida de la Constitución', 'Avenida Manuel Fernández Juncos', 'Calle del Muelle']);

/** Speed class of a mapped road. */
export function speedClass(road) {
  if (AVENUE_KINDS.has(road.kind) || AVENUE_NAMES.has(road.name)) return 'avenue';
  if (SPINE_NAMES.has(road.name)) return 'spine';
  if (road.kind === 'service') return 'service';
  return 'grid';
}

// Right of way at a corner: the arm of the highest rank goes through, lower ranks stop and yield. Equal ranks: an
// all-way stop (first to stop goes first), except where avenues meet (they merge and cross without stopping).
export const RANK = Object.freeze({ service: 0, grid: 1, spine: 2, avenue: 3 });

// How busy a street is, as the design tiers of the look guide (0 none … 5 brief rush), midday / golden / blue.
// A lane takes its class tier, then the highest zone or street-name entry that covers it.
export const TIER_WEIGHT = Object.freeze([0, 0.5, 1, 1.7, 2.6, 3.6]);
export const CLASS_TIER = Object.freeze({ service: [1, 1, 1], grid: [1, 1, 1], spine: [3, 3, 2], avenue: [3, 3, 2] });
export const NAME_TIER = new Map([
  ['Calle de San Francisco', [2, 2, 1]],
  ['Calle de la Fortaleza', [1, 1, 1]],
  ['Calle del Cristo', [1, 1, 1]],
  ['Calle de San Sebastián', [1, 1, 1]],
  ['Calle de la Luna', [1, 1, 1]],
  ['Calle del Sol', [1, 1, 1]],
  ['Calle Marina', [4, 3, 2]],
  ['Calle del Muelle', [4, 3, 2]],
]);
// Zones: centre (x, z) in world metres, radius, tiers. Places from the map arrivals.
export const ZONES = Object.freeze([
  { name: 'Plaza de Armas', x: -2, z: 9, r: 70, tier: [2, 2, 1] },
  { name: 'Plaza Colón', x: 505, z: -75, r: 90, tier: [3, 3, 2] },
  { name: 'San Cristóbal', x: 440, z: -240, r: 110, tier: [3, 3, 2] },
  { name: 'Piers', x: 300, z: 215, r: 150, tier: [4, 3, 2] },
  { name: 'Bahía Urbana', x: 900, z: 170, r: 170, tier: [3, 3, 2] },
  { name: 'Capitol', x: 1120, z: -120, r: 200, tier: [3, 3, 2] },
  { name: 'La Perla', x: 200, z: -360, r: 150, tier: [1, 1, 1], cap: true }, // a cap: never busier than this
]);
// How readily drivers turn into a street (route choice only, not where cars appear): Cristo and Tanca are quiet side
// streets, not through routes; Recinto Sur and the San Francisco retail edge carry more.
export const ROUTE_WEIGHT = new Map([
  ['Calle del Cristo', 0.3],
  ['Calle de la Tanca', 0.55],
  ['Calle del Recinto Sur', 1.8],
  ['Calle de San Francisco', 1.5],
]);
export const HOUR_INDEX = Object.freeze({ midday: 0, golden: 1, blue: 2 });
// Share of the population cap on the streets at each hour.
export const HOUR_POPULATION = Object.freeze([1, 1, 0.72]);

// Ground the moving cars never use (the owner's lot by the Cataño ferry terminal: placement reserve, x/z polygons).
export const RESERVED = Object.freeze([
  [[517.77, 162.75], [500.85, 108.14], [535.56, 98.4], [551.26, 153.33]],
  [[488, 162], [495, 153], [491, 126], [493, 119], [505, 158], [507, 164], [493, 168]],
]);
