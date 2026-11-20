# El Viejo San Juan: EUC Thrills — credits and data

Old San Juan riding world by VibezZzCoder, 2026. https://github.com/VibezZzCoder/euc-sanjuan

- Riding code/assets: **EUC Thrills by VibezZzCoder**, MIT code; original assets CC BY 4.0 with exceptions.
  https://github.com/VibezZzCoder/EUC-thrills — see `NOTICE-EUC-THRILLS.md` and `js/euc/LICENSE`.
  Existing contributed recordings, identity marks and other exceptions retain their own terms.
- Engine integration adapted from the pinned EUC San Francisco implementation; historical city engine:
  unable12/slop-sanfrancisco (Kamil) and mrdoob/slop-newyork (Mr.doob), MIT. See `LICENSE` and
  `provenance/sf-import.json` for exact imported files and pre-adaptation hashes.
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
