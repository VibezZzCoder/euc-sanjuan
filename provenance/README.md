# San Juan provenance

- `sf-import.json`: exact selected files from committed SF source `397f207d49d02e705d5a82e311cfedd193912817`, with
  full hashes before San Juan adaptation. No SF world data was imported.
  `js/gamepad-controls.js` is now a San Juan adaptation: optional generic menu-owner/input/close callbacks reuse
  the donor's map neutral/fresh-input gate for title and pause as well; disabled polling also blocks UI actions.
  The original donor hash remains in that inventory; this adaptation does not update the pinned source.
  `js/euc-audio.js` is also a San Juan adaptation: removing the optional 4.1 kHz PWM/coil
  oscillator/modulation/filter/gain/glide branch leaves the useful motor/tyre/wind and event/warning paths intact.
  The original SF import hash remains provenance, not a claim of current byte equality.
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
