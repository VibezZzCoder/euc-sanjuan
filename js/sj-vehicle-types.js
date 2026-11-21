/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// The vehicles of Old San Juan: body types, sizes and the mix seen on its streets. Data only, shared by the vehicle
// models, the parked rows and the moving traffic.
//
// Sizes are metres, measured from the drawn models (js/sj-vehicle-models.js; a test keeps them equal). A vehicle's origin
// is on the ground under the centre of its footprint; heading 0 faces +Z. `axle` is half the wheelbase; the wheelbase's
// centre sits `axleOffset` ahead of the footprint centre. `track` is the half distance between the wheel centres.
// `width` is the body without mirrors; `height` includes the tallest accessory (the service pickup's rack).

export const VEHICLE_TYPES = Object.freeze([
  { id: 'crossover', length: 4.34, width: 1.88, height: 1.71, axle: 1.349, axleOffset: 0.014, wheelRadius: 0.353, track: 0.794 },
  { id: 'sedan', length: 4.46, width: 1.84, height: 1.43, axle: 1.386, axleOffset: 0.030, wheelRadius: 0.346, track: 0.776 },
  { id: 'hatch', length: 3.92, width: 1.80, height: 1.47, axle: 1.257, axleOffset: -0.079, wheelRadius: 0.346, track: 0.768 },
  { id: 'pickup', length: 5.11, width: 1.96, height: 1.92, axle: 1.728, axleOffset: 0.090, wheelRadius: 0.392, track: 0.837 },
  { id: 'boxy', length: 4.29, width: 1.93, height: 1.85, axle: 1.300, axleOffset: 0.065, wheelRadius: 0.400, track: 0.811 },
  { id: 'van', length: 5.01, width: 1.95, height: 1.71, axle: 1.470, axleOffset: 0.082, wheelRadius: 0.359, track: 0.820 },
  // Medium-roof cargo van: the delivery livery (added after the six types above; their indices are unchanged).
  { id: 'cargo', length: 5.13, width: 1.92, height: 2.27, axle: 1.548, axleOffset: 0.155, wheelRadius: 0.327, track: 0.817 },
].map(Object.freeze));

// Solid sections of a parked car (js/sj-parking-layout.js): [[zRear, zFront, halfWidth, top], …] in metres along the car
// from the footprint centre, fitted to the drawn body without mirrors or accessories (bodySections in
// js/sj-vehicle-models.js; a test keeps this table equal to it).
export const BODY_SECTIONS = Object.freeze({
  crossover: [[-2.17, -1.93, 0.9, 1.22], [-1.93, -1.69, 0.93, 1.48], [-1.69, 0, 0.94, 1.61], [0, 0.24, 0.91, 1.5], [0.24, 0.48, 0.92, 1.41], [0.48, 0.72, 0.92, 1.29], [0.72, 1.45, 0.94, 1.1], [1.45, 1.93, 0.94, 1.05], [1.93, 2.17, 0.89, 0.97]],
  sedan: [[-2.23, -1.98, 0.89, 0.96], [-1.98, -1.73, 0.9, 1.07], [-1.73, -1.48, 0.92, 1.25], [-1.48, -1.24, 0.92, 1.32], [-1.24, 0.25, 0.92, 1.43], [0.25, 0.5, 0.9, 1.33], [0.5, 0.74, 0.9, 1.15], [0.74, 0.99, 0.91, 1.07], [0.99, 1.73, 0.91, 0.96], [1.73, 2.23, 0.9, 0.88]],
  hatch: [[-1.96, -1.71, 0.88, 1.29], [-1.71, 0.25, 0.9, 1.47], [0.25, 0.49, 0.89, 1.28], [0.49, 0.74, 0.89, 1.08], [0.74, 1.47, 0.9, 0.97], [1.47, 1.96, 0.89, 0.89]],
  pickup: [[-2.56, -0.85, 0.98, 1.23], [-0.85, -0.61, 0.96, 1.67], [-0.61, 0.61, 0.94, 1.79], [0.61, 0.85, 0.95, 1.68], [0.85, 1.1, 0.95, 1.45], [1.1, 2.31, 0.98, 1.25], [2.31, 2.56, 0.94, 1.18]],
  boxy: [[-1.93, 0.94, 0.97, 1.85], [0.94, 1.18, 0.96, 1.44], [1.18, 2.14, 0.96, 1.14]],
  van: [[-2.51, -2.27, 0.93, 1.33], [-2.27, 0.84, 0.97, 1.71], [0.84, 1.07, 0.96, 1.56], [1.07, 1.31, 0.97, 1.43], [1.31, 1.55, 0.97, 1.29], [1.55, 1.79, 0.97, 1.06], [1.79, 2.27, 0.96, 0.99], [2.27, 2.51, 0.91, 0.9]],
  cargo: [[-2.56, 0.61, 0.96, 2.27], [0.61, 0.85, 0.95, 2.2], [0.85, 1.1, 0.95, 2.12], [1.1, 1.34, 0.95, 1.84], [1.34, 1.59, 0.96, 1.61], [1.59, 1.83, 0.95, 1.25], [1.83, 2.07, 0.95, 1.03], [2.07, 2.32, 0.93, 0.95], [2.32, 2.56, 0.91, 0.88]],
});

/** The widest body of the fleet (a moving lane must hold it). */
export const WIDEST_VEHICLE = Math.max(...VEHICLE_TYPES.map((t) => t.width));

export const VEHICLE_TYPE_INDEX = Object.freeze(Object.fromEntries(VEHICLE_TYPES.map((t, i) => [t.id, i])));

// Liveries: what a body is dressed as. Civil cars take a colour from PAINTS; the others fix their own look.
// No real maker, company or agency marks: a plain word (TAXI, POLICÍA) and a colour scheme are the whole livery.
export const LIVERIES = Object.freeze(['civil', 'taxi', 'delivery', 'patrol', 'service']);

// The mix, as weights out of 100 for moving traffic and for parked rows.
export const FLEET = Object.freeze([
  { type: 'crossover', livery: 'civil',    moving: 34, parked: 35 },
  { type: 'sedan',     livery: 'civil',    moving: 28, parked: 29 },
  { type: 'hatch',     livery: 'civil',    moving: 9,  parked: 11 },
  { type: 'pickup',    livery: 'civil',    moving: 8,  parked: 9 },
  { type: 'boxy',      livery: 'civil',    moving: 4,  parked: 5 },
  { type: 'van',       livery: 'civil',    moving: 5,  parked: 4 },
  { type: 'cargo',     livery: 'delivery', moving: 5,  parked: 3 },
  { type: 'van',       livery: 'taxi',     moving: 4,  parked: 2 },
  { type: 'pickup',    livery: 'service',  moving: 2,  parked: 2 },
  { type: 'crossover', livery: 'patrol',   moving: 1,  parked: 0 },
].map(Object.freeze));

// Civil paint, weighted: pearl and silver first, a few strong colours.
export const PAINTS = Object.freeze([
  { hex: '#e6e5df', weight: 26 }, // pearl / off-white
  { hex: '#a4abb0', weight: 21 }, // silver / cool grey
  { hex: '#30363a', weight: 18 }, // black / charcoal
  { hex: '#575a60', weight: 10 }, // dark graphite
  { hex: '#35536a', weight: 10 }, // denim / navy
  { hex: '#9a3b3b', weight: 8 },  // red / burgundy
  { hex: '#8f886a', weight: 5 },  // tan / olive / cream
  { hex: '#1d79a0', weight: 2 },  // bright blue / teal
].map(Object.freeze));

/** Pick an entry of a weighted table (`key` names the weight field) with a uniform random number in [0, 1). */
export function pickWeighted(table, key, u) {
  let total = 0;
  for (const row of table) total += row[key];
  let at = u * total;
  for (let i = 0; i < table.length; i++) {
    at -= table[i][key];
    if (at < 0) return i;
  }
  return table.length - 1;
}

// Lamp flags of a moving vehicle (kit.pose).
export const LAMPS = Object.freeze({ BRAKE: 1, LEFT: 2, RIGHT: 4 });
