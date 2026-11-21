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
- **© OpenStreetMap contributors — Open Database Licence (ODbL).** https://www.openstreetmap.org/copyright
  `data/city.json`, boundary/road/building derivatives and the generation rules remain available under ODbL.
  Licence: <https://opendatacommons.org/licenses/odbl/1-0/>. [Download the derived layers](credits.html).
  The source extract timestamps and hashes are in `provenance/geodata.json`; inferred dimensions are labelled.
- **USGS 3DEP**, public-domain 1 m DEM, PR_PuertoRicoUSVI_D24. The city resamples it to a 2 m heightfield.
  San Juan-area vendor metadata specifies PRVD02/GEOID18 and a 10 cm RMSEV class; game resampling and authored
  geometry are not a survey-accuracy claim. https://www.usgs.gov/3d-elevation-program
- **Three.js**, MIT, local reviewed pin and licence in `vendor/three/`; see `vendor/MANIFEST.json`.
- Inter and Overpass fonts: SIL Open Font License 1.1; see the licences in `fonts/`.

San Juan uses independent storage. Facades and building-height defaults are illustrative.
