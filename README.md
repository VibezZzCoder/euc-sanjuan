# El Viejo San Juan: EUC Thrills

El Viejo San Juan is a new Old San Juan riding world built for [EUC Thrills](https://github.com/VibezZzCoder/EUC-thrills)
by VibezZzCoder. You ride an electric unicycle through the walled old city of San Juan, Puerto Rico: its streets,
plazas, city walls, forts and waterfront, on real hills.

The world combines newly authored streets, landmarks and rideable surfaces with OpenStreetMap geography and USGS
elevation. It uses the EUC Thrills riding engine and adapts selected integration code from the EUC Thrills New York
and San Francisco editions, including MIT-licensed work by Mr.doob and Kamil (@unable0_). San Juan has its own
world data and save settings.

**Status: work in progress.** Ride from Plaza de Armas past the cathedral and through Puerta de San Juan, or
follow Paseo del Morro along the city walls. Explore La Perla, the southern waterfront and La Puntilla, and
ride public stairs in both directions, including the Capitol steps. Use the searchable map to jump to landmarks.

## Run it locally

The game is plain HTML, CSS and JavaScript modules with no build step. It serves the bundled Three.js and data
locally and uses system fonts for the interface.

```bash
python3 tools/serve.py
```

Then open **http://127.0.0.1:8004** in a current browser on the same machine. The game tries WebGPU with a
WebGL2 fallback, and defaults to WebGL2 on phones. Add `?webgpu=0` to force WebGL2 or `?webgpu=1` to request WebGPU.
To play from another device, use a web server that device can reach.

Controls: WASD or arrow keys ride, Space hops, Shift charges or tucks, R gets up, M opens the map and Esc pauses.
Touch screens get a floating stick and buttons, and standard game controllers are supported. Choose Chase, Wide
or Look-around from the Camera menu, or cycle views with C or controller Y. The pause menu sets 3D resolution
and frame limit.

Checks (Node.js 22.15 or newer, Python 3.9+):

```bash
node --test tests/*.test.mjs        # headless tests
node tools/csp.mjs --check          # Content-Security-Policy matches the inline scripts
node tools/vendor-three.mjs --check # vendored three.js and fonts match vendor/MANIFEST.json
node tools/build-streets-cache.mjs --check
python3 tools/package.py            # portable copy of the runtime files in dist/
```

`node tools/vendor-euc.mjs --check` verifies the installed EUC modules, licence and audio without an upstream checkout. To compare them with a fresh generation, use two clean EUC Thrills Git checkouts: base `5f45fff19b258e140833841ba2473069af751a12` and code donor `d37efc07cddc0d76ff7aa585901710d357b8e5a1`. Run `npm ci` in the base checkout to supply TypeScript, then run this from San Juan (substitute the two directory paths):

```bash
node tools/vendor-euc.mjs --check --src /path/to/base --donor /path/to/donor --no-preloads
```

Neither upstream checkout nor GIS tooling is needed to play the game.

## Current limits

- Cool Rider is the only playable rider. Source assets for the other ten riders are included, but rider
  selection and pursuit gameplay aren't available.
- The city uses fixed daylight and a static sea surface.
- Fort interiors, some gates, the cemetery and the Coast Guard base remain closed. A map arrival is not a
  promise that every route between places is rideable.
- Building shapes, heights and colours are simplified or inferred from mapped footprints and photographs; this is not
  a surveyed replica.
- Tested in Chromium and on phones during development; other browsers and devices may behave differently.

## Build on the city

Want to make a walking tour, a different riding game or something else in Old San Juan? The
[fork guide](FORK_GUIDE.md) shows how to load the city without the EUC game shell, adapt its terrain and collision
to your own game, and carry over the right credits.

## License and data

- **Code:** MIT. See [LICENSE](LICENSE) (© 2026 Mr.doob; © 2026 Kamil (@unable0_), San Francisco contributions;
  © 2026 VibezZzCoder, EUC adaptation and San Juan work) and [js/euc/LICENSE](js/euc/LICENSE) for the EUC Thrills
  riding engine.
- **EUC Thrills assets:** original licensed assets are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  with exceptions for real riders' identities, logos, contributed recordings and generated vocal layers.
  Attribute as:

  > Assets from *EUC Thrills* by VibezZzCoder — CC BY 4.0 — https://github.com/VibezZzCoder/EUC-thrills

  The full notice, its exceptions and per-file audio rights are in [NOTICE-EUC-THRILLS.md](NOTICE-EUC-THRILLS.md)
  and [audio/euc/PROVENANCE.md](audio/euc/PROVENANCE.md). Read [FORK_GUIDE.md](FORK_GUIDE.md) before reusing riders.
- **Map data:** [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under the
  [Open Database Licence (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
  The OSM-derived data in `data/` and the build rules in `tools/` are part of this repository; sources, query text
  and hashes are in [provenance/geodata.json](provenance/geodata.json).
- **Elevation:** USGS 3D Elevation Program (3DEP) 1 m DEM, public domain, resampled for the game. It is not a claim
  of survey accuracy, and no endorsement by USGS is implied.
- **three.js:** MIT, vendored at a pinned commit; see `vendor/three/LICENSE` and `vendor/MANIFEST.json`.
- **Fonts:** Inter and Overpass under the SIL Open Font License, see `fonts/`.

More detail: [NOTICE.md](NOTICE.md), [LICENSING.md](LICENSING.md), [provenance/README.md](provenance/README.md).

[Local credits, source and geographic data downloads](credits.html).
