/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Street cross-sections for city life: which mapped roads carry cars, on which side a row of parked cars may stand
// and where the moving lane runs beside it. Pure functions of the mapped road records, shared by the parked cars and
// the moving traffic so the two always agree.
//
// A road's `width` is its clear width between the kerbs. Looking along a road's point order, +1 is the right-hand side
// and −1 the left; lateral offsets are metres to the right of the centre line. Traffic keeps to the right.
// World axes: x east, z south; the right-hand normal of a direction (dx, dz) is (−dz, dx).

export const DRIVE_KINDS = new Set(['primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
  'residential', 'unclassified', 'service']);
// Kinds whose kerb can carry a row of parked cars by default (arterials and service lanes only by an override).
const PARKING_KINDS = new Set(['residential', 'tertiary', 'unclassified']);

export const PARK = Object.freeze({
  lane: 2.1,          // m of carriageway a parked row takes
  gutter: 0.3,        // m between the kerb and a parked car's flank
  junctionClear: 9,   // m from a junction node kept free of parked cars
  minRoadWidth: 5.5,  // a narrower street has no row
  minRoadLength: 28,  // nor has a shorter one
  twoLanes: 5.4,      // free width from which a two-way street carries two lanes
});

export const isOneWay = (road) => road.oneway === 'yes' || road.oneway === '-1';
/** +1 when traffic runs along the point order, −1 against it (only meaningful for one-way roads). */
export const flowSign = (road) => (road.oneway === '-1' ? -1 : 1);
export const rightNormal = (dx, dz, out = { x: 0, z: 0 }) => {
  const length = Math.hypot(dx, dz) || 1;
  out.x = -dz / length;
  out.z = dx / length;
  return out;
};

// Decisions the mapped data cannot give, by index in city.roads: +1 or −1 fixes the parked side, 0 forbids a row.
// Fill it from the reference photographs; an index is stable for a given data/city.json. The comment names the way
// and the side as seen on the ground.
export const PARKING_OVERRIDES = new Map([
  [175, -1], // Calle del Cristo 248557858, southbound: the east kerb (rows toward the chapel, rears to the viewer)
  [69, 0],   // Calle del Cristo 22230837, the short two-way block north of San Sebastián: clear
  [174, -1], // Caleta de las Monjas 248557857, eastbound: the north kerb (cars face a camera looking west)
  [36, 0], [37, 0], // Caleta de las Monjas, short two-way stubs: clear
  [207, -1], // Calle de San Sebastián 259147610, westbound: the left kerb of travel (the long tight row)
  [520, -1], // Calle de San Sebastián 620979003, eastbound: the left kerb of travel
  [82, -1],  // Calle de San Sebastián 22231248, eastbound: the left kerb of travel
  [47, 1],   // Calle San Miguel 22228973 (La Perla), two-way: one file on the inland (south) side, the other side clear
  [41, -1],  // Calle San Miguel 22228326 (La Perla), two-way: the inland (south) side
  [168, -1], // Calle de San Francisco 247332273, Plaza de Armas north side: the plaza kerb (south)
  [42, 1],   // Calle Rafael Cordero 22228550, Plaza de Armas south side: the plaza kerb (north)
  [31, -1],  // Calle de San José 22226343, southbound, Plaza de Armas west side: the plaza kerb (east)
  [43, 0],   // Calle de Rafael Cordero 22228551, the steep block by Caleta de las Monjas: clear
]);

function hash(n) {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Side of `road` (city.roads[index]) that carries parked cars: +1 right, −1 left, 0 none. */
export function parkingSide(road, index) {
  if (PARKING_OVERRIDES.has(index)) return PARKING_OVERRIDES.get(index);
  if (!PARKING_KINDS.has(road.kind) || !isOneWay(road)) return 0;
  if (road.width < PARK.minRoadWidth || road.length < PARK.minRoadLength) return 0;
  const h = hash(Number(road.id) + index * 7919);
  if (h % 5 === 0) return 0; // about one street in five stays clear on both sides
  return (h >>> 3) & 1 ? 1 : -1;
}

/**
 * Moving lanes of a drivable road: [{offset, dir, width}], offset in metres right of the centre line, dir +1 along the
 * point order, −1 against it, 0 for a single lane that both directions take in turn.
 */
export function laneOffsets(road, index) {
  const side = parkingSide(road, index);
  const free = road.width - (side ? PARK.lane : 0);
  const shift = side ? -side * PARK.lane / 2 : 0;
  if (isOneWay(road)) return [{ offset: shift, dir: flowSign(road), width: free }];
  if (free >= PARK.twoLanes) {
    return [{ offset: shift + free / 4, dir: 1, width: free / 2 }, { offset: shift - free / 4, dir: -1, width: free / 2 }];
  }
  return [{ offset: shift, dir: 0, width: free }];
}

/** Centre line of the parked row for a car `carWidth` wide, metres right of the road's centre line; null without a row. */
export function parkedOffset(road, index, carWidth) {
  const side = parkingSide(road, index);
  return side ? side * (road.width / 2 - PARK.gutter - carWidth / 2) : null;
}
