# San Juan provenance

The 3D looks for Red Rider, Trollina, FloWithZo, Adonisb2 and Officer Dorkins come from EUC Thrills v1.6.1 (`35ce848`). The third pin, file selections and hashes are in `../js/euc/MANIFEST.json`.

- `sf-import.json`: exact selected files from committed SF source `397f207d49d02e705d5a82e311cfedd193912817`, with
  full hashes before San Juan adaptation. No SF world data was imported.
  `js/gamepad-controls.js` is now a San Juan adaptation: optional generic menu-owner/input/close callbacks reuse
  the donor's map neutral/fresh-input gate for title and pause as well; disabled polling also blocks UI actions.
  The original donor hash remains in that inventory; this adaptation does not update the pinned source.
  `js/euc-audio.js` is also a San Juan adaptation: removing the optional 4.1 kHz PWM/coil
  oscillator/modulation/filter/gain/glide branch leaves the useful motor/tyre/wind and event/warning paths intact.
  The original SF import hash remains provenance, not a claim of current byte equality.
  `js/euc-recovery.js` is a San Juan adaptation too: `findPlacementTarget` tests the standing volume before the
  footprint grid (same answers, proven on 72,000 placements and 400 get-up searches; the get-up search is ~2.5× faster).
  `assets/euc-badge.svg` keeps its row because the path is the same; the drawing was replaced entirely by San
  Juan's own garita badge.
  If `FORK_GUIDE.md` changes, refresh its `editionSha256`; the source hash still identifies the original SF file.
- [actors-import.json](actors-import.json): vehicle lofts and street-sound synthesis and scheduling from EUC
  Thrills New York; traffic behaviour, skinned pedestrian figures and reactions, and the shared actor body index
  and vehicle crash shapes from EUC Thrills San Francisco. Adaptations are MIT; credit VibezZzCoder and the
  underlying work of Mr.doob (slop-newyork) and Kamil (slop-sanfrancisco) where inherited. The body index and
  crash-shape helpers come from the San Francisco edition itself. `publicRelease` identifies a published tree
  with the same donor file bytes. Check current San Juan hashes with `node tools/actors-provenance.mjs --check`.
  Wardrobe, unbranded liveries, parked rows and the lane and walk networks are San Juan work. The networks combine
  OSM-derived city data (ODbL) with authored details and are built by MIT code; neither donor's geography was used.
- [dorkins-import.json](dorkins-import.json): Officer Dorkins's rig, flight, sight and paddle contact, chase rules,
  siren and cue sound, and the booking (director, desk scene, checked placement) from EUC Thrills San Francisco
  (several first written for the New York edition), MIT, VibezZzCoder. The officer's look, paddle and siren loops
  are EUC Thrills' generated NPC assets already listed in `NOTICE-EUC-THRILLS.md`. The pursuit graph over San Juan's
  walk and lane networks, the where-he-may-be rule, the Cuartelillo del Monociclo site and desk are San Juan work.
  `tests/dorkins.test.mjs` checks the current San Juan hashes.
- [riders-import.json](riders-import.json): the rider-swap transaction (`js/sj-riders-selection.js`) adapts
  `RiderSelection` from EUC Thrills San Francisco (`js/game-menu.js`, MIT, VibezZzCoder), and the riding-style
  sentences of the picker come from the same file. `tests/riders.test.mjs` checks the recorded San Juan hashes. The
  picker's markup, styles and host flow (`js/sj-riders.js`, `js/sj-riders-art.js`, `css/riders.css`) are San Juan
  work. The rider portraits are the original EUC Thrills v1.1.0 chooser drawings (`src/ui/menus.ts`, `RIDER_CARDS`),
  generated unchanged into `js/euc/ui/riderPortraits.js` and recorded in `../js/euc/MANIFEST.json`; identity-bearing
  (see `../NOTICE-EUC-THRILLS.md`).
- [skate-import.json](skate-import.json): the skatepark geometry kit (`js/sj-skate-kit.js`) adapts the San
  Francisco edition's skatepark kit (with its New York inheritance) and the original EUC Thrills Foundry Yard
  profiles and feature dimensions, MIT, VibezZzCoder. The two parks' sites, layouts, approaches, paint and lettering
  are San Juan work; El Bowl approximates a real community bowl.
- `geodata.json`: cached OSM/USGS URLs, full hashes, query text, datum evidence and bounded build counts/limitations.
- `../data/plaza-detail.json`: ODbL plaza/fountain/gazebo rings and bench points, extracted from the same cached OSM
  input by `tools/build-plaza-detail.py` with a recorded input hash. It does not rebuild or modify terrain/roads.
  New plaza geometry/materials are authored in `js/sj-plaza.js`; no reference photographs are shipped as textures.
  Photo study sources include Commons pages [119654687](https://commons.wikimedia.org/?curid=119654687),
  [151531420](https://commons.wikimedia.org/?curid=151531420), [131971241](https://commons.wikimedia.org/?curid=131971241),
  [151596781](https://commons.wikimedia.org/?curid=151596781), [122798497](https://commons.wikimedia.org/?curid=122798497),
  [80303584](https://commons.wikimedia.org/?curid=80303584) and [131971302](https://commons.wikimedia.org/?curid=131971302).
  Exact facade dimensions, small-structure heights and planting positions remain explicitly authored approximations.
- The cathedral corridor uses building way255583481 and street ways247332271/248557858/248557857 from the unchanged
  city dataset. `js/sj-corridor-layout.js` owns inferred stair/facade dimensions; `js/sj-cathedral.js` authors the
  exterior in the existing primitive kit. Photo studies: Commons [158245895](https://commons.wikimedia.org/?curid=158245895)
  (2025 monochrome detail), [1798720](https://commons.wikimedia.org/?curid=1798720) (2007) and
  [15687347](https://commons.wikimedia.org/?curid=15687347) (2009). These guide silhouette and entrance hierarchy,
  not surveyed heights, current paint or interior access. No photo pixels are included in the runtime.
- `../js/euc/MANIFEST.json`: generated EUC source pins and transformations. `../vendor/MANIFEST.json`: renderer pin.
- `../audio/euc/PROVENANCE.md`: individual sample rights and sources. `../NOTICE-EUC-THRILLS.md`: required upstream notice.

`tools/build-city.py` performs deterministic offline generation. Raw cached downloads remain outside the runtime;
the OSM-derived `data/city.json`, boundary and build rules retain ODbL availability. Fort interior/roof/collision
details are not claimed as surveyed replicas.

Offline builders read the exact source inputs from `SJ_DATA_DIR` (default: `inputs/` in the source checkout). Verify their hashes against `geodata.json`; a fresh Overpass query may differ. No input download is required to run the game. `data/stairs.json` retains its array of OSM-derived ways; its credit is recorded in `geodata.json`.
