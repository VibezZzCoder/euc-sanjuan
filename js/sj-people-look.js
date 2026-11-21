/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// What the people of the old city wear: a wardrobe, not presets. Every garment, colour, skin tone and hair is picked
// independently from the reference palette (warm-weather everyday dress seen in the photo pack: plain tees, polos and
// sleeveless tops, denim and khaki shorts, light trousers, simple dresses and skirts, trainers and sandals, an
// occasional cap, brimmed hat, day-pack or shoulder bag). Nothing here codes who is local or a visitor.
import { STYLE } from './sj-people-figure.js';

// Main colours appear far more often than accents (weights). sRGB 0xRRGGBB.
const TOPS = [[0xe8e1d3, 8], [0xf0eee8, 6], [0xa9a7a0, 5], [0x373b42, 6], [0x33435b, 5], [0x8eaec3, 5], [0x26282c, 3],
  [0x4e8e87, 2], [0xc46c5e, 2], [0xbe849a, 2], [0xa9a055, 1.5], [0x3e9aa3, 1.2], [0xa8443e, 1.2], [0x9db25a, 0.8], [0xd9c9a3, 2]];
const BOTTOMS = [[0x627783, 8], [0x405169, 6], [0xa79779, 6], [0x42474c, 5], [0xd8d5cc, 3], [0x2a2b2e, 3], [0x737456, 1.5],
  [0x845150, 1], [0x8a9aa6, 2]];
const DRESSES = [[0x2f3b55, 4], [0xd9d4c8, 3], [0x5a6f8c, 3], [0x3a3c40, 3], [0xa35b52, 3], [0x9aa58c, 1.5], [0xc98a7c, 1.5],
  [0x4e8e87, 1]];
const SHOES = { light: [[0xd9d6cf, 5], [0xe8e6e0, 3], [0xa9a7a0, 2]], dark: [[0x2e3033, 5], [0x3d3a36, 2], [0x33435b, 1]],
  sandal: [[0x5b4332, 4], [0x2b2b2b, 3], [0x8a6a4a, 2]] };
const CAPS = [[0x33435b, 4], [0xe3ddcf, 3], [0x3a3d42, 3], [0xb8545a, 2], [0x4e8e87, 2], [0x8c3a3a, 1]];
const BRIMS = [[0xc7a97b, 5], [0xd8cdb4, 3], [0x5e5a52, 1]];
const PACKS = [[0x2e3033, 4], [0x33435b, 3], [0x6f8f86, 2], [0x8a4a44, 1.5], [0x7a6a52, 1.5]];
const BAGS = [[0x5b4332, 4], [0x2b2b2b, 3], [0xa8443e, 1.5], [0x8a6a4a, 2], [0xc7b79b, 1.5]];
// A continuum of skin tones (light through tan, medium and deep browns, warm and neutral): interpolated, not binned.
const SKIN = [0xf1d2b8, 0xe2b896, 0xd0a079, 0xbd8a63, 0xa3714e, 0x8a5b3e, 0x6f4630, 0x573524, 0x43281c];
const SKIN_WEIGHT = [0.6, 1, 1.3, 1.4, 1.4, 1.2, 1, 0.8, 0.5];
const HAIR = [[0x15110e, 9], [0x2b1d14, 7], [0x4a3320, 4], [0x6e5034, 2], [0x9b7b52, 1], [0x5e3020, 1]];
const GREY = [[0x7d7a76, 3], [0xa8a49e, 2], [0xcfcac2, 2]];

function pick(random, table) {
  let total = 0; for (const [, w] of table) total += w;
  let r = random() * total;
  for (const [v, w] of table) { r -= w; if (r <= 0) return v; }
  return table[table.length - 1][0];
}
const lerpRGB = (a, b, t) => {
  const c = (s) => ((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t;
  return (Math.round(c(16)) << 16) | (Math.round(c(8)) << 8) | Math.round(c(0));
};
function skinTone(random) {
  let total = 0; for (const w of SKIN_WEIGHT) total += w;
  let r = random() * total, i = 0;
  for (; i < SKIN.length - 1; i++) { r -= SKIN_WEIGHT[i]; if (r <= 0) break; }
  const j = Math.min(SKIN.length - 1, i + 1);
  return lerpRGB(SKIN[i], SKIN[j], random());
}
const range = (random, a, b) => a + (b - a) * random();

/**
 * Dress one person. options: child (a child beside an adult), older, noHat (another member of the group wears one).
 * Returns the PersonRig look plus `speed` (m/s, walking pace) and `height`.
 */
export function dressPerson(random, { child = false, older = false, noHat = false } = {}) {
  const female = random() < 0.52;
  const height = child ? range(random, 1.0, 1.45) : female ? range(random, 1.52, 1.74) : range(random, 1.62, 1.88);
  const girth = child ? range(random, 0.9, 1.0) : range(random, 0.9, 1.16) + (older ? 0.04 : 0);
  // top: tee, sleeveless, polo, shirt
  const t = random();
  let top = female ? (t < 0.42 ? 0 : t < 0.78 ? 1 : t < 0.88 ? 2 : 3) : (t < 0.5 ? 0 : t < 0.62 ? 1 : t < 0.82 ? 2 : 3);
  // bottom: trousers, shorts, cropped, skirt (with a dress more than half the time)
  const b = random();
  let bottom = child ? (b < 0.7 ? 1 : 0) : female ? (b < 0.24 ? 0 : b < 0.52 ? 1 : b < 0.66 ? 2 : 3) : (b < 0.36 ? 0 : b < 0.9 ? 1 : 2);
  if (older && bottom === 1 && random() < 0.5) bottom = 0;
  const dress = bottom === 3 && random() < 0.6;
  if (dress && top === 2) top = random() < 0.5 ? 0 : 1;
  const topColour = dress ? pick(random, DRESSES) : pick(random, TOPS);
  let bottomColour = bottom === 3 && !dress ? pick(random, DRESSES) : pick(random, BOTTOMS);
  if (Math.abs((topColour >> 16) - (bottomColour >> 16)) < 6 && random() < 0.7) bottomColour = pick(random, BOTTOMS);
  // shoes: sandals go with shorts and skirts more often
  const bare = bottom === 1 || bottom === 3;
  const s = random();
  const shoe = s < (bare ? 0.42 : 0.15) ? 2 : s < 0.62 ? 0 : 1;
  const shoeColour = pick(random, shoe === 2 ? SHOES.sandal : shoe === 0 ? SHOES.light : SHOES.dark);
  // hair: short to long, volume for curls and coils; grey with age; some older men bald
  const hair = female ? (random() < 0.8 ? range(random, 0.55, 1.0) : range(random, 0.1, 0.5)) : (random() < 0.75 ? range(random, 0.0, 0.35) : range(random, 0.35, 0.5));
  const bald = !female && !child && (older ? random() < 0.35 : random() < 0.06);
  const hairColour = older && random() < 0.75 ? pick(random, GREY) : pick(random, HAIR);
  // worn items
  let hat = 0, accent = 0x33435b;
  if (!noHat) { const h = random(); hat = h < 0.16 ? 1 : h < 0.23 ? 2 : 0; }
  if (hat === 1) accent = pick(random, CAPS); else if (hat === 2) accent = pick(random, BRIMS);
  const g = random();
  let bag = child ? (g < 0.25 ? 1 : 0) : g < 0.12 ? 1 : g < (female ? 0.32 : 0.18) ? 2 : 0;
  if (bag && !hat) accent = pick(random, bag === 1 ? PACKS : BAGS);
  if (bag && hat) bag = 0; // one accessory each: a cap or a bag
  const stripes = (top === 0 || dress) && random() < 0.1;
  const style = top * STYLE.TOP + bottom * STYLE.BOTTOM + shoe * STYLE.SHOE + hat * STYLE.HAT + bag * STYLE.BAG
    + (dress ? STYLE.DRESS : 0) + (bald ? STYLE.BALD : 0) + (stripes ? STYLE.STRIPES : 0);
  const pace = child ? range(random, 0.75, 1.0) : older ? range(random, 0.7, 1.0) : range(random, 0.85, 1.35);
  return {
    seed: Math.floor(random() * 997) + 1, scale: height / 1.75, female, girth, hair: bald ? 0 : hair,
    armSwing: range(random, 0.8, 1.15), stride: range(random, 0.92, 1.08) * (child ? 0.9 : 1),
    top: topColour, bottom: bottomColour, skin: skinTone(random), hairColour, shoe: shoeColour, accent, style,
    speed: pace, height, child, hatOn: hat > 0
  };
}
