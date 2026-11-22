# San Juan Spin-off: EUC Thrills

*El Viejo San Juan* is a new Old San Juan riding world built for [EUC Thrills](https://github.com/VibezZzCoder/EUC-thrills)
by VibezZzCoder: the San Juan Spin-off, a sibling of the New York and San Francisco editions that also plays on its
own. (Source files carry the work's name as "El Viejo San Juan: EUC Thrills".) You ride an electric unicycle through the walled old city of San Juan, Puerto Rico: its streets,
plazas, city walls, forts and waterfront, on real hills.

The world combines newly authored streets, landmarks and rideable surfaces with OpenStreetMap geography and USGS
elevation. It uses the EUC Thrills riding engine and adapts selected integration code from the EUC Thrills New York
and San Francisco editions, including MIT-licensed work by Mr.doob and Kamil (@unable0_). San Juan has its own
world data and save settings.

**Status: work in progress.** Ride from Plaza de Armas past the cathedral and through Puerta de San Juan, or
follow Paseo del Morro along the city walls. Explore La Perla, the southern waterfront and La Puntilla, and
ride public stairs in both directions, including the Capitol steps. Use the searchable map to jump to landmarks.
The Caribbean sea has waves, surf, turquoise shallows, sky reflections and sun glitter, with gentler ripples in
fountains and the pond. At blue hour, lamps, windows and floodlit landmarks come on, and the El Morro light flashes.
The rebuilt riding camera pulls in around walls and tunnels,
keeps clear of the sea, frames for portrait screens and eases back after a manual orbit. The Polvorín de Santa Elena
roof and wall are repaired, and the wheel pushes through shrubs and hedges with drag instead of hitting a solid obstacle.

Look for parked rows, slow cars following the one-way grid and stopping or yielding at corners, and people
on sidewalks, in plazas and on public stairs. There are piragua carts and a kite on the El Morro lawn.
Engines, horns, footsteps and the murmur of conversation are synthesized as you ride.

Two places to play: **Skatepark del Muelle**, a fictional harbour-front park with a raised bowl, a mini ramp, a pump
line into a banked corner, kickers, a euro gap and a street section; and **El Bowl** in La Perla, the real hand-built
community skate bowl, approximated and rideable. Ramps use the transition behaviour of the original EUC Thrills
skatepark; the wheel's tuning is unchanged. Both are on the map.

The menus are drawn from the old city's own street furniture: ceramic street plaques, a tile border, a poster for
the loading screen. The HUD names the street or plaza you are on, and Pause can show a frame-rate counter.

Ride as any of **eleven riders**. Choose from the title screen or from Pause: the crew is a sheet of stamps, and each
rider brings their own look, wheel and crash sounds. The Drunkard rides with his hands-off weave; everyone else has
the same speed, grip and brakes.

**Officer Dorkins** patrols on his hover wheel. He arrives from behind, a knock-down from his paddle is a warning,
and after three warnings the next one takes you to his paperwork desk, the invented *Cuartelillo del Monociclo* on
the forecourt of La Princesa, the old jail on the promenade. Hop or swerve when he winds up, and lose him by breaking
his line of sight and getting away. He leaves the two skate spots alone unless he followed you in, and Pause can
send him off duty.

On a phone, add the game to the Home Screen to play it full screen as its own app. It still needs a connection:
there is no offline mode.

## Run it locally

The game is plain HTML, CSS and JavaScript modules with no build step. It serves the bundled Three.js and data
locally, with local Inter, Overpass and Fraunces fonts for the interface.

```bash
python3 tools/serve.py
```

Then open **http://127.0.0.1:8004** in a current browser on the same machine. The game tries WebGPU with a
WebGL2 fallback, and defaults to WebGL2 on phones. Add `?webgpu=0` to force WebGL2 or `?webgpu=1` to request WebGPU;
`?time=midday`, `?time=golden` or `?time=blue` overrides the saved hour for that visit.
`?rider=<id>` starts as that rider for one visit (for example `?rider=trollina`), and `?cop=0` leaves Officer
Dorkins out entirely.
Use `?life=0` to turn off moving cars, pedestrians and street sound, or `?parked=0` to remove parked cars and
their solid bodies. `?cars=N` and `?people=N` override the moving-car and pedestrian caps for that visit
(0 turns off that population). Parked cars and scenery such as the carts and kite are independent of those caps.
City materials are compiled during loading rather than on the ride. To play from another device, use a web server
that device can reach.

Controls: WASD or arrow keys ride, Space hops, Shift charges or tucks, R gets up, M opens the map and Esc pauses.
Touch screens get a floating stick and buttons, and standard game controllers are supported. Choose Chase, Wide
or Look-around from the Camera menu, or cycle views with C or controller Y. Choose Midday, Golden hour (the default)
or Blue hour on the title screen or in Pause; your choice is saved. Pause also sets 3D resolution and frame limit, can show an FPS counter,
changes rider and switches Officer Dorkins's patrol on or off. Menus work with a controller: D-pad to move, A to choose, B to go back.

Checks (Node.js 22.15 or newer, Python 3.9+):

```bash
node --test tests/*.test.mjs        # headless tests
node tools/csp.mjs --check          # Content-Security-Policy matches the inline scripts
node tools/vendor-three.mjs --check # vendored three.js and fonts match vendor/MANIFEST.json
node tools/build-streets-cache.mjs --check
node tools/actors-provenance.mjs --check
python3 tools/package.py            # portable copy of the runtime files in dist/
```

`node tools/vendor-euc.mjs --check` verifies the installed EUC modules, licence and audio without an upstream checkout. To compare them with a fresh generation, use two clean EUC Thrills Git checkouts: base `5f45fff19b258e140833841ba2473069af751a12` and code donor `d37efc07cddc0d76ff7aa585901710d357b8e5a1`. Run `npm ci` in the base checkout to supply TypeScript, then run this from San Juan (substitute the two directory paths):

```bash
node tools/vendor-euc.mjs --check --src /path/to/base --donor /path/to/donor --no-preloads
```

Neither upstream checkout nor GIS tooling is needed to play the game.

## Current limits

- Officer Dorkins flies: he is not a solid body, he does not follow the line of public stairs, and he gives up
  when street furniture keeps him from reaching you. His desk is scenery for the booking only. Riders differ in
  look, wheel and sound; only The Drunkard rides differently.
- Motor traffic uses a connected subset of streets. No cars drive in La Perla, the tunnels or Puerta de San Juan.
  City life gathers around the rider rather than simulating every block at once; some streets are much quieter
  than the plazas and waterfront, and a few sidewalks too narrow to walk stay empty.
- Cars brake for the rider and for people, but a rider who cuts into a lane right in front of a car can still be hit.
  Hitting a person at speed crashes the rider, as hitting any obstacle does.
- Small visual slips remain: two people heading for neighbouring bench seats can overlap for a moment, a walker
  can stand slightly off the ground on a few uneven spots, and a distant car can leave view on the longest avenue.
- Blue hour is the darkest hour by design, and it is deliberately dim away from lamps, which use baked lighting without
  per-lamp shadows. The sea stays physically flat; the reef shelf is an approximation and does not reflect lamps.
- Orbiting into a wall at a tunnel mouth can still bump the camera or briefly pull it close.
- Fort interiors, some gates, the cemetery and the Coast Guard base remain closed. A map arrival is not a
  promise that every route between places is rideable.
- Building shapes, heights and colours are simplified or inferred from mapped footprints and photographs; this is not
  a surveyed replica.
- The game has been played in desktop Chrome and on an iPhone, and its menus and touch handling are checked on older
  and current WebKit. Other browsers and devices may vary. Game text cannot be selected or copied.

## Build on the city

Want to make a walking tour, a different riding game or something else in Old San Juan? The
[fork guide](FORK_GUIDE.md) shows how to load the city without the EUC game shell, adapt its terrain and collision
to your own game, and carry over the right credits.

## License and data

- **Code:** MIT. See [LICENSE](LICENSE) (© 2026 Mr.doob; © 2026 Kamil (@unable0_), San Francisco contributions;
  © 2026 VibezZzCoder, EUC adaptation and San Juan work) and [js/euc/LICENSE](js/euc/LICENSE) for the EUC Thrills
  riding engine.
- **Riders and Officer Dorkins:** the rider-choice transaction, the chase and the booking adapt the
  [San Francisco edition](https://github.com/VibezZzCoder/euc-sanfrancisco) of EUC Thrills (MIT, VibezZzCoder), which
  inherited them from the New York edition. See [provenance/riders-import.json](provenance/riders-import.json) and
  [provenance/dorkins-import.json](provenance/dorkins-import.json) for the files and what changed. The picker's
  design, his routes through this city, his pace, the desk and the booking's words were made for San Juan. Officer
  Dorkins and the *Cuartelillo* are fictional and carry no real police or agency marks.
- **City life:** vehicle lofts and street sound adapt the [New York edition](https://github.com/VibezZzCoder/euc-nyc)
  of EUC Thrills and its Mr.doob lineage. Traffic, pedestrian figures and reactions, and actor collisions adapt
  the [San Francisco edition](https://github.com/VibezZzCoder/euc-sanfrancisco), including Kamil's and Mr.doob's
  work where inherited. See [the exact source record](provenance/actors-import.json) for the MIT code.
  San Juan's own liveries, parked rows, wardrobe, lanes and walks were made for this city; the liveries carry no
  real maker, company or agency marks. Lane and walk routes derive from OSM data (ODbL); their algorithms are MIT.
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
- **Fonts:** Inter and Overpass (`fonts/`) and Fraunces (`assets/type/`) under the SIL Open Font License 1.1.

More detail: [NOTICE.md](NOTICE.md), [LICENSING.md](LICENSING.md), [provenance/README.md](provenance/README.md).

[Local credits, source and geographic data downloads](credits.html).
