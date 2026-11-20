/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Natural ground finish, city-wide (2026-11-18) — © 2026 VibezZzCoder, MIT. OSM ODbL / USGS DEM.
// area `ground`: render-only. It owns no ground and changes no physics: no colliders, tops, cuts, tints, surfaces,
// floors or places, and it exposes no {x,z} point records (so later owner indices such as wallFoot see nothing of it).
// Its presence switches on, in sj-world.js / sj-plaza.js:
//   - groundPalette(world): the class colour of untinted natural terrain vertices (lawn, rough grass, scrub, earth, rock,
//     wet rock, sand) from slope, height, distance to water / buildings, surface.u8 and mapped OSM natural polygons;
//   - groundMaterial: the terrain material with one small generated detail texture (grass / earth / rock channels);
//   - buildGround: sparse instanced tufts, low shrubs and sea grape on unowned natural ground, filtered at build time
//     against every owner registered in the world (including areas merged after this one).
// Tint hand-off (explicit, per owner): perlaDistrict's shore rock tones (ROCK, its mottled stand-in for the shelf) are
// refined by the ground classes where the bake has natural ground (`refineTones`), and so is the named 'rock' blockout
// margin tone (gate rip-rap margin, cristobal shore rock, princesa sea edge): the gravel/shelf classes replace it
// (polish: one calm bank behind the Paseo del Morro rip-rap). Every other tint wins as before.
// Nulling `ground` reproduces the earlier world byte for byte.

import {ROCK as PERLA_ROCK} from './sj-perla-district-layout.js';

export const GROUND={
  townDist:10,      // m from a building footprint: flatter untagged ground nearer than this stays town ground (streets pave it)
  bankSlope:.45,    // rise/run above which untagged ground is a natural bank even inside the town
  scatterCell:4,    // m, jittered scatter grid (tufts come in clumps of up to 4)
  clear:{building:1.2,collider:3.2,ring:.8,point:1.4,road:1.0},  // m clearances from owners; road: beyond half width
};

export function createGroundLayout() {
  const layout={colliders:[],tops:[],cuts:[],surfaces:[],floorTriangles:[],places:[],constants:{GROUND},refineTones:new Set([...PERLA_ROCK,'rock'])};
  // Async data hook awaited by loadCity: fetch and decode data/ground.bin (sj-ground.js), kept with this layout.
  layout.load=async({terrain})=>{const {loadGroundBake}=await import('./sj-ground.js');await loadGroundBake(layout,terrain);};
  return layout;
}
