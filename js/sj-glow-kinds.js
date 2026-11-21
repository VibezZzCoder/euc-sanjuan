/*! El Viejo San Juan: EUC Thrills — (c) 2026 VibezZzCoder — MIT — https://github.com/VibezZzCoder/euc-sanjuan */
// Window glow kinds (data only; shared by layouts that run before the build and by js/sj-glow.js).
// Window kinds: which openings may be lit from inside at blue hour, how often and how warmly (L12: most closed shutters
// stay dark with at most a restrained slat leak; open-looking shops and restaurants warmer and more often; fewer, varied
// upper panes; L9: a few occupied-looking lower fronts and one terrace/business pocket in La Perla; L13: brighter
// neutral terminal sources). `share` is the fraction lit (deterministic per opening), `tints` sRGB room colours,
// `power` the glow (linear, ×night), `cls` what emits: 'room' glass with a lit room behind (vertical gradient, darker
// reveal and sill, a mullion on some, one half sometimes dimmer), 'louvre' a closed louvred shutter (only its slat
// lines and centre seam), 'seam' a closed timber leaf (only a thin rim and the head of the opening).
export const PANES={
  shop:   {cls:'room',  share:.65,power:.55,tints:['#ffcf86','#ffd9a0','#ffe4bc','#fff0d6']},   // ground-floor shop / service glazing
  office: {cls:'room',  share:.3, power:.4, tints:['#ffe0b0','#fff0d8','#e9eef0']},             // modern upper panes
  stair:  {cls:'room',  share:.55,power:.35,tints:['#f0f2ec','#fff0d8']},                       // stair-core landing windows
  transomShop:{cls:'room',share:.5,power:.25,tints:['#ffb860','#ffc678']},                     // shop-front fanlights over the doors
  transom:{cls:'room',  share:.16,power:.2, tints:['#ffb860','#ffc678']},                       // other fanlights
  open:   {cls:'room',  share:.42,power:.4, tints:['#ffc27a','#ffd29a','#ffe2b8','#fff1dc']},   // open dark upper recesses: a lit room behind
  leak:   {cls:'louvre',share:.08,power:.3, tints:['#ffb868','#ffc884']},                       // light through closed louvred shutters
  civic:  {cls:'room',  share:.14,power:.35,tints:['#ffe2b0','#fff0d6']},                       // civic and church glazing, sparingly
  houseRoom:{cls:'room',share:.12,power:.45,tints:['#ffc27a','#ffd7a0','#f2f2ea']},             // La Perla open recesses
  houseShutter:{cls:'louvre',share:.06,power:.35,tints:['#ffc27a','#ffd7a0']},                 // La Perla louvred shutters
  houseDoor:{cls:'seam',share:.08,power:.5, tints:['#ffc27a','#f2f2ea']},                       // La Perla doors: rim and head only
  terminal:{cls:'room', share:.75,power:.5, tints:['#eef3f2','#fff3de']},                       // terminal and ferry bands (neutral)
  doorSeam:{cls:'seam', share:.4, power:.5, tints:['#ffc27a','#ffd29a']},                       // closed ground-floor leaves (plaza kit)
  doorPlaza:{cls:'seam',share:.6, power:.6, tints:['#ffc27a','#ffd29a','#ffe2b8']},             // the same on the plaza fronts and City Hall
  upperSeam:{cls:'seam',share:.12,power:.4, tints:['#ffc27a','#ffd29a']},                       // closed upper leaves (plaza kit)
  pocket: {cls:'room',  share:1,  power:.75, tints:['#ffc27a','#ffd29a']},                       // La Perla terrace/business pocket (inferred, #68)
  pocketDim:{cls:'room', share:1,  power:.3, tints:['#ffc27a']},                                 // a quieter room upstairs
  pocketCool:{cls:'room',share:1, power:.9, tints:['#e8eef4']},                                 // its cool-white shop light (#68)
  pocketAccent:{cls:'room',share:1,power:.7,tints:['#5f7dff']},                               // its one electric-blue accent (#68)
};
export const PANE_CLASSES=['room','louvre','seam'];
export const PANE_LIST=Object.keys(PANES);
/** Pane kind index for compact layout records (glowPanes arrays). */
export const paneKind=k=>PANE_LIST.indexOf(k);

