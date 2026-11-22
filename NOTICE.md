# El Viejo San Juan: EUC Thrills — credits and data

Old San Juan riding world by VibezZzCoder, 2026. https://github.com/VibezZzCoder/euc-sanjuan

- Riding code/assets: **EUC Thrills by VibezZzCoder**, MIT code; original assets CC BY 4.0 with exceptions.
  https://github.com/VibezZzCoder/EUC-thrills — see `NOTICE-EUC-THRILLS.md` and `js/euc/LICENSE`.
  Existing contributed recordings, identity marks and other exceptions retain their own terms.
- Engine integration adapted from the pinned EUC San Francisco implementation; historical city engine:
  unable12/slop-sanfrancisco (Kamil) and mrdoob/slop-newyork (Mr.doob), MIT. See `LICENSE` and
  `provenance/sf-import.json` for exact imported files and pre-adaptation hashes.
- City life: vehicle models and synthesized street sound adapt the EUC Thrills New York edition
  (including Mr.doob's slop-newyork work); traffic, pedestrian figures and reactions, and actor collisions adapt
  the EUC Thrills San Francisco edition (including Kamil's slop-sanfrancisco work and its New York inheritance).
  These code adaptations are MIT; see [the file-by-file record](provenance/actors-import.json).
  San Juan authored its own vehicle liveries, parked rows, wardrobe, lanes and walks. The liveries use no real
  maker, company or agency marks. The lane and walk networks are built from San Juan's OSM-derived geography
  (ODbL); the algorithms are MIT. No donor city maps or street recordings were imported for city life.
- Changing rider: the swap transaction (rig and crash voice prepared together, committed in one turn) adapts
  `RiderSelection` from the EUC Thrills San Francisco edition, MIT, by VibezZzCoder; see
  [the file-by-file record](provenance/riders-import.json). The picker's stamp-and-postcard design was made for San
  Juan. Rider looks, marks and recordings are the reviewed EUC Thrills set described in `NOTICE-EUC-THRILLS.md`.
- Skatepark del Muelle (a fictional public skatepark on the harbour-front lot; the real lot is a private car park):
  its geometry kit adapts the EUC Thrills San Francisco edition's skatepark kit (exact support from the drawn
  triangles, inscribed bodies, wheel-sweep rail bars; including its New York inheritance) and the original EUC Thrills
  game's Foundry Yard profiles (eased-foot wall profile, eased ramps, soft minimum; bowl, kicker, pyramid and stair
  dimensions). MIT; see [the file-by-file record](provenance/skate-import.json). Layout, paint, lettering and the
  flag panel were authored for San Juan.
- El Bowl in La Perla (OSM 555008330) is a real skate bowl and pool built by hand in 2006 by Chemi Rosado-Seijo
  with Roberto "Boly" Cortez, Luiggi Ramos, residents and visiting skaters. The game's rideable version follows its
  mapped rim and its published descriptions and photos (viewed only, not copied); depth, profiles and paint are
  estimates, and the paintwork is an original arrangement, not any of its murals. Built with the skatepark kit above.
- **© OpenStreetMap contributors — Open Database Licence (ODbL).** https://www.openstreetmap.org/copyright
  `data/city.json`, boundary/road/building derivatives and the generation rules remain available under ODbL.
  Licence: <https://opendatacommons.org/licenses/odbl/1-0/>. [Download the derived layers](credits.html).
  The source extract timestamps and hashes are in `provenance/geodata.json`; inferred dimensions are labelled.
- **USGS 3DEP**, public-domain 1 m DEM, PR_PuertoRicoUSVI_D24. The city resamples it to a 2 m heightfield.
  San Juan-area vendor metadata specifies PRVD02/GEOID18 and a 10 cm RMSEV class; game resampling and authored
  geometry are not a survey-accuracy claim. https://www.usgs.gov/3d-elevation-program
- **Three.js**, MIT, local reviewed pin and licence in `vendor/three/`; see `vendor/MANIFEST.json`.
- Inter and Overpass fonts: SIL Open Font License 1.1; see the licences in `fonts/`.
- Fraunces (ExtraBold, Latin subset), used for the title and street plaques: SIL Open Font License 1.1, © The Fraunces
  Project Authors; licence and source note in `assets/type/`.

San Juan uses independent storage. Facades and building-height defaults are illustrative.
