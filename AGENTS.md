# Working with El Viejo San Juan: EUC Thrills

This is [**El Viejo San Juan: EUC Thrills**](https://github.com/VibezZzCoder/euc-sanjuan), a new Old San Juan
world by **VibezZzCoder** built with the EUC Thrills riding engine and selected integration code from its NYC and
SF editions. Read [FORK_GUIDE.md](FORK_GUIDE.md), [NOTICE.md](NOTICE.md) and [LICENSING.md](LICENSING.md)
before reusing files.

## Know what you are changing

| Paths | Owner or source; terms |
| --- | --- |
| `js/sj-*.js`, `tools/build-*.py`, terrain and detail bake tools | San Juan world and data pipeline, by VibezZzCoder; code is MIT. Generated geographic inputs and outputs retain their data terms. |
| `js/sj-atmosphere.js`, `js/sj-sea.js`, `js/sj-glow.js`, `js/sj-glow-kinds.js` | Time of day, water, baked lamp lighting and lit-window types. The atmosphere's solar attenuation uses the Preetham coefficients from three.js SkyMesh (MIT). |
| `js/sj-camera.js`, `js/sj-camera-crowns*.js`, `tools/bake-camera-crowns.mjs` | San Juan riding camera and its camera-only tree crown bake. The camera does not drive riding physics. |
| `data/`, `js/sj-ground-osm.js`, `js/sj-streets-data.js`, `js/sj-worldedge-data.js`, `provenance/` | OSM-derived geography is ODbL 1.0; USGS 3DEP elevation is public domain. Some layers mix geography with authored details; consult `provenance/geodata.json`. |
| `js/euc/`, `audio/euc/` | Generated riding engine from EUC Thrills by VibezZzCoder (MIT code); original licensed assets are CC BY 4.0, with exceptions. Keep `js/euc/LICENSE`, `NOTICE-EUC-THRILLS.md` and the applicable `audio/euc/PROVENANCE.md`. Edit `tools/vendor-euc.mjs` or the pinned source, not generated modules by hand. |
| `js/main.js`, `js/euc-*.js`, `js/sf-*.js`, input and render helpers | City host and integration, including NYC/SF adaptations with MIT work by Mr.doob and Kamil (@unable0_). Keep all three copyright lines and the complete MIT text in `LICENSE`. |
| `vendor/three/`, `vendor/MANIFEST.json`, retained `fonts/` | Pinned three.js (MIT); keep `vendor/three/LICENSE`. Retained Inter and Overpass fonts carry their SIL OFL notices. |

## Run and verify

From the repository root, use Python 3.9+ for preview, packaging and smoke checks, and Node.js 22.15+ (24 LTS
recommended) for the JS checks. There is no browser build step. GIS dependencies are only needed to regenerate
base geography, not to run the game.

```bash
node --test tests/*.test.mjs
node tools/csp.mjs --check
node tools/vendor-three.mjs --check
node tools/build-streets-cache.mjs --check
node tools/bake-camera-crowns.mjs --check
python3 tools/package.py                 # rebuilds dist/
python3 tools/smoke.py
```

`node tools/vendor-euc.mjs --check` verifies the installed EUC modules, licence and audio without an upstream checkout. To compare them with a fresh generation, use two clean EUC Thrills Git checkouts: base `5f45fff19b258e140833841ba2473069af751a12` and code donor `d37efc07cddc0d76ff7aa585901710d357b8e5a1`. Run `npm ci` in the base checkout to supply TypeScript, then run this from San Juan (substitute the two directory paths):

```bash
node tools/vendor-euc.mjs --check --src /path/to/base --donor /path/to/donor --no-preloads
```

Neither upstream checkout nor GIS tooling is needed to play the game.

For interactive preview, choose one of these commands:

```bash
python3 tools/serve.py                    # http://127.0.0.1:8004/
python3 tools/serve.py --dist             # preview the package on the same port instead
```

- Keep scripts, workers and runtime assets same-origin. If either inline script in `index.html` changes, run
  `node tools/csp.mjs`; check the resulting policy. Do not loosen it to make a change pass.
- When streets-cache inputs change, run `node tools/build-streets-cache.mjs` and commit the regenerated
  `js/sj-streets-cache-key.js` and `data/streets-cache.bin` together. Use the vendor tool rather than editing
  pinned libraries by hand. The key covers the `js/sj-world.js` import graph (including `sj-atmosphere.js`,
  `sj-sea.js`, `sj-glow.js`, `sj-glow-kinds.js` and `sf-terrain-sampler.js`) and the data listed in
  `CACHE_DATA` in `js/sj-streets-cache.js`.
- After changing tree or palm records, run `node tools/bake-camera-crowns.mjs` to regenerate
  `js/sj-camera-crowns-bake.js`; do not edit the baked list by hand.
- Keep the hour a uniform-only change for shaders. `apply()` also updates light values and re-bakes the same
  sky environment target. Don't set `scene.fogNode`; let `createAtmosphere` wire its node through the pinned
  renderer's plain `THREE.Fog` path. Add new scenery before the whole-city startup compile in `js/main.js`.
- World builders report luminous parts to `sj-glow.js`; publish changed building outlines through
  `buildingOverrides` so the light bake follows drawn openings. Keep one scene light for the baked map,
  not a separate shadow-casting light for each lamp. Keep the sea surface flat at `y = 0`.
- For an EUC Thrills city change, keep mapped grades, draw/collision agreement and stock riding physics. Test altered
  surfaces and entrances in both directions and preview important changes on WebGPU and WebGL2 (`?webgpu=0`).

## If you are forking this

1. **Choose what to reuse.**
   - **Contribute back or propose another EUC Thrills city:** keep the import pins, notices and gameplay contracts.
     Offer focused changes upstream. Check with VibezZzCoder before presenting a separate city as official or
     assuming any participant permission extends to it.
   - **Independent riding game:** keep the MIT engine and assets you can independently license. Change the game
     title, badge, links and other branding; carry the origin name in credits, not as your game's identity.
   - **City only, for a non-EUC game:** start with `js/sj-*.js` (omit `sj-camera.js` and the crown files if using your own camera),
     `data/`, `provenance/`, the relevant geography/bake tools and the Three import map and vendor closure.
     Supply your own shell, inputs, actor, camera and audio. Use your own title and artwork. Keep the small set
     of MIT sampling helpers that the city loader imports, or replace the sampler before dropping those modules.
2. **Wire the city contract.** `js/sj-world.js` exports `loadCity()`, `buildWorld(scene, world, progress)`,
   `AREA_LAYOUTS` and `areasOf(world)`. Keep area order and aligned `tops`, `colliders`, `cuts`, `surfaces` and
   `floorTriangles`. Use the returned `world.sampler` for layered support, or adapt `loadCity()` to supply the
   same world shape with your host's collision system. `SfTerrainSampler` in `js/sf-terrain-sampler.js` uses
   `SfSupportStore` in `js/sf-support-store.js`, `SfStaticBoxStore`/`SfRegionalPrismStore` in
   `js/sf-static-body-store.js`, `lightMaskValue` in `js/sf-light-data.js`, `js/euc-recovery.js`,
   `PlanTerrainSampler` in `js/euc/simulation/planSampler.js` and `js/euc/data/tuning.js`. Follow recovery's imports
   through `js/euc-dynamic.js` and `js/euc/simulation/world.js`; trace the rest before deleting.
   Call `releaseConstruction` from `js/sj-handoff.js` only after building and after
   your host has consumed or copied the construction records it needs. Set up the atmosphere and renderer
   as shown in [the fork guide](FORK_GUIDE.md); `buildWorld` adds the baked lamp light.
3. **For independent games, ship only assets you have the rights to use.** Use your own cast, marks and recordings
   unless separately cleared. Read [NOTICE-EUC-THRILLS.md](NOTICE-EUC-THRILLS.md) and
   [audio/euc/PROVENANCE.md](audio/euc/PROVENANCE.md) for the terms. If retaining the engine, configure the
   generator for your asset set and check the packaged result; hiding a rider in a menu doesn't remove its assets.
4. **Carry credit and data terms.** Preserve the MIT text and copyright notices and keep `NOTICE.md` and applicable
   asset and vendor notices. Record what you changed. The author requests this city credit in the README and
   in visible in-game credits:

   > Old San Juan world from *El Viejo San Juan: EUC Thrills* by VibezZzCoder — https://github.com/VibezZzCoder/euc-sanjuan — MIT code; © OpenStreetMap contributors (ODbL); USGS 3DEP

   Where original licensed EUC assets are reused, add this line, indicate changes and link the
   [CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/):

   > Assets from *EUC Thrills* by VibezZzCoder — CC BY 4.0 — https://github.com/VibezZzCoder/EUC-thrills

   Link the in-game OSM credit to [OSM attribution](https://www.openstreetmap.org/copyright), directly or through
   accessible credits. For public use of an OSM-derived database or a work made from it, offer the derived database
   or the means to reconstruct it as specified by [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/);
   preserve share-alike for that database, not unrelated game code. Carry the three.js MIT notice wherever you
   ship three.js. Do not claim sole authorship of the reused city or imply endorsement.

MIT does not prescribe an in-game credit format. The licence notices and the separate asset and OSM terms still
apply. Neither a notification nor EUC Thrills branding is a condition of the open licences.

[Local credits, source and geographic data downloads](credits.html).
