# Forking El Viejo San Juan: EUC Thrills

**Forking is welcome.** Take a ride in a different direction, build something new on these streets, or use the
city for a game that has nothing to do with electric unicycles. The Old San Juan world is an original work, built
for EUC Thrills by **VibezZzCoder**: https://github.com/VibezZzCoder/euc-sanjuan. Credit the work you took and tell players what you
changed. You don't have to call your game EUC Thrills to use the open-licensed parts.

The source includes eleven reviewed rider identities, all playable, and Officer Dorkins as a non-playable character. The 3D looks for Red Rider, Trollina, FloWithZo, Adonisb2 and Officer Dorkins come from EUC Thrills v1.6.1 (`35ce848`).
Check the source and notices at the revision you actually use. This guide is not legal advice.

## What you can reuse

- **Code is MIT.** This includes the San Juan world code and riding engine, plus integration adapted through
  the EUC Thrills NYC/SF editions. Keep [LICENSE](LICENSE) with the full permission and warranty text and all three
  copyright lines: Mr.doob, Kamil (@unable0_), and VibezZzCoder. Keep [NOTICE.md](NOTICE.md) and the applicable upstream notices. Add your own credit below the original credit, not in its place.
  If you keep EUC Thrills engine code, retain [its MIT licence](js/euc/LICENSE) and the
  [carried notice](NOTICE-EUC-THRILLS.md). If you keep three.js, retain its [MIT notice](vendor/three/LICENSE)
  and pin; Inter and Overpass (`fonts/`) and Fraunces (`assets/type/`), if retained, carry their respective SIL
  OFL licences beside the font files.
  If you keep city life, carry the [file-by-file donor credit](provenance/actors-import.json): New York for
  vehicle lofts and synthesized sound, San Francisco for traffic, pedestrian figures and reactions, and
  moving-body helpers. Credit VibezZzCoder and the Mr.doob and Kamil work inherited by those editions.
- **Original licensed EUC Thrills assets are CC BY 4.0.** Attribute what you reuse, link to the
  [licence](https://creativecommons.org/licenses/by/4.0/) and indicate changes. This is not a licence for
  everything in the package. Check the [EUC Thrills notice](NOTICE-EUC-THRILLS.md) and
  [individual audio rights](audio/euc/PROVENANCE.md).
- **Geography has its own terms.** OSM-derived data, including the basis for San Juan's lane and walk routes,
  is under ODbL 1.0, not MIT or CC BY; the routing code is MIT. USGS 3DEP elevation
  is public domain. See [LICENSING.md](LICENSING.md) and the [geodata provenance](provenance/README.md).
  The streets follow real geography, but heights and shapes of some buildings, access details and other
  authored features are approximations, not survey data.

## The real riders are participants, not a reusable character pack

Eight of the reviewed riders are real people: **Red Rider, Adonisb2, Maribel Vargas, Wheel in Motion,
FloWithZo, Seal on a Wheel, Wyldist and Gnarwheel.** The project licences do not confer rights to their names,
likenesses or personas, and the picker's portraits depict them. Maribel, Wheel in Motion and Gnarwheel supplied
logos, which their portraits reproduce. The Adonisb2, Maribel, Wyldist
and Gnarwheel recordings have their own rights; Wyldist's clip contains a filming companion's exclamations,
and Gnarwheel's mixed file includes independently synthesized sound as well as his recordings. Wyldist's SMLS
sleeve mark belongs to a third party. Keeping the game name, leaving the files dormant or changing a display
name does not give you permission to reuse any of this.

Cool Rider, Trollina and The Drunkard are fictional; the applicable original asset rights still come with
file-specific exceptions. The generated vocal portions in Trollina's and The Drunkard's crashes and The
Drunkard's stumble aren't covered by the blanket CC BY 4.0 grant. The Red Rider, Wheel in Motion and FloWithZo
crash audio uses owner-authored recordings with the owner's voice removed, not those riders' voices. Seal's
mix includes a CC0 seal bark, not the rider's voice. A filename alone doesn't tell you whether a sound is
reusable. Do not seek or redistribute private reference material or permission records.

To clean an independent build, start with names, looks and personalized machines, then follow the files,
including the ones loaded later:

1. Trace `js/euc/data/riders.js` and `js/euc/data/machines.js` through `js/euc-roster.js`, rider and machine appearance
   modules, look/atlas/hair helpers, workers and the `js/euc/render/pixels/` painter copies. Check
   `js/euc/render/appearanceImports.js`, `appearancePixelImports.js`, and `js/euc/MANIFEST.json`. Review
   your own previews, NPC imports, saved selections and fallbacks as well. The picker's portraits are generated
   into `js/euc/ui/riderPortraits.js` from the original chooser (`src/ui/menus.ts`) and loaded when the picker
   first opens: remove or replace uncleared ones in the generator (`tools/vendor-euc.mjs`), then rebuild.
2. Remove or replace `js/euc/data/mvLogoAsset.js`, `js/euc/data/wimLogoAsset.js`, `js/euc/data/gnarwheelLogoAsset.js`, the SMLS
   letter paths in both `js/euc/render/wyldistAtlas.js` and `js/euc/render/pixels/wyldistAtlas.js`, and
   identifying lettering, colours/kit combinations and likenesses. Logos and letter paths aren't necessarily
   standalone image files. Don't substitute another mark you can't use.
3. Remove uncleared recordings from `audio/euc/` and from sound mappings/preload lists. If keeping the engine,
   change the generator scope and rebuild the generated closure, not just one menu or atlas. Scan the final
   files and any history you're publishing: deferred modules, audio, artwork, screenshots, source maps and
   old builds count. Required historical notices can still identify content you removed.

## Three ways to build on it

**1. Contribute back or propose another EUC Thrills city.** Focus changes around one area or behavior,
describe how you checked it, and keep geography, render/collision agreement and stock riding physics intact.
Use the same-origin CSP, the pinned vendor versions and the offline data workflow. See `AGENTS.md` in the source clone
for the exact checks. Talk to VibezZzCoder before presenting a separate city as official; participant permissions
do not transfer merely because a city uses the same engine or brand.

**2. Make an independent riding game.** Retain the MIT engine if useful, but give the game its own title,
badge and original cast. Remove or replace real identities, marks and recordings unless independently cleared,
as described above. Reuse generic geometry and individually licensed sounds where appropriate; you don't have
to throw out the physics because a participant used it. Acknowledge EUC Thrills in your credits, not as the publisher
or endorser of your game.

**3. Take the city and bring your own game.** For example, build a walking tour with your own camera,
controls, characters and audio. You don't need an EUC rider to draw the streets. This example omits city life:
open it with `?parked=0` so the world does not register parked-car solids without the vehicle kit drawing them.

1. Start a clean project. Copy the `js/sj-*.js` world/layout/builders and shared geometry helpers, `data/`,
   and [provenance](provenance/README.md), with the licences/notices. Include the geography builders
   (`tools/build-city.py`, `tools/build-plaza-detail.py`, `tools/build-ground-osm.py`, `tools/build-streets.py`,
   `tools/build-worldedge.py`) and the retained bake/cache tooling as useful. Preserve relative URLs, including
   `js/` to `data/`. Use the local Three import mappings from `index.html` and `vendor/three/` if you keep the
   renderer. Do not copy the EUC title shell, rider presentation, roster/appearance assets, WAVs or badge.
2. Keep the world loader intact for the first render. `loadCity()` assembles the data, in metres with Y up,
   including terrain, `height`, `isDry`, area records and `world.sampler`. `AREA_LAYOUTS` defines order;
   `areasOf(world)` returns the registered area objects. `buildWorld(scene, world, progress)` draws the world.
   Keep rideable/walkable `tops` and obstacle `colliders` aligned with the drawn `cuts`, `surfaces` and
   `floorTriangles`. A heightfield alone misses bridges, roofs, stairs and layered passages.

   ```js
   // In a root-level host module, with the local import map configured.
   import * as THREE from 'three/webgpu';
   import { loadCity, buildWorld } from './js/sj-world.js';
   import { createAtmosphere, timeOverride } from './js/sj-atmosphere.js';

   const params = new URLSearchParams(location.search);
   const renderer = new THREE.WebGPURenderer({
     antialias: true, forceWebGL: params.get('webgpu') === '0',
   });
   renderer.outputColorSpace = THREE.SRGBColorSpace;
   renderer.toneMapping = THREE.NeutralToneMapping;
   renderer.shadowMap.enabled = true;
   await renderer.init();
   renderer.setSize(innerWidth, innerHeight);
   document.body.append(renderer.domElement);
   const scene = new THREE.Scene();
   scene.background = new THREE.Color('#a7cbd0');
   const light = createAtmosphere({ renderer, scene });
   const world = await loadCity();
   const scenery = await buildWorld(scene, world);
   light.apply(timeOverride(params) ?? 'golden');

   // A fixed view of Fuente Raíces and the bay. Replace with your own camera.
   const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.15, 5000);
   camera.position.set(-186, world.height(-186, 246) + 2.2, 246);
   camera.lookAt(-206.4, world.height(-206.4, 234.3) + 3.5, 234.3);

   let previous;
   renderer.setAnimationLoop(now => {
     const dt = previous === undefined ? 0 : Math.min(0.05, (now - previous) / 1000);
     previous = now;
     light.advance(dt);
     scenery.update(dt, null);
     light.aim(camera.position, camera);
     renderer.render(scene, camera);
   });
   ```

   Load the host through an external `<script type="module" src="./host.js"></script>` after configuring the
   import map. `createAtmosphere` sets up the sun and fog; `buildWorld` adds the sky, sea and the baked lamp
   light. Don't add a second fill light or set `scene.fogNode`. Set `phone: true` in `createAtmosphere` for the
   smaller sun shadow map, and pass your actor's position to `light.aim` when following one.

   Choose `'midday'`, `'golden'` or `'blue'` with `light.apply(id)`; this changes uniforms and re-bakes the
   sky's environment texture, not the lamp map or shader programs. The short example lets the renderer compile
   on first use. To avoid first-view or first-visit hitches, follow `compileWholeCity` in `js/main.js` after
   building scenery and setting the hour: temporarily show and un-cull all drawables with automatic LOD
   suspended, compile, then submit and finish a frame with the sun shadow pass before restoring the flags.

3. Connect your actor's ground/obstacle queries to `world.sampler` or convert the authored supports and solids
   into your own collision representation. `js/sf-terrain-sampler.js` exports `SfTerrainSampler`
   (with `sampleGround`, `raycastObstacle`, `isOffLimits` and other queries); it uses `SfSupportStore` from
   `js/sf-support-store.js`, `SfStaticBoxStore` and `SfRegionalPrismStore` from `js/sf-static-body-store.js`,
   `lightMaskValue` from `js/sf-light-data.js`, recovery helpers in `js/euc-recovery.js`,
   `PlanTerrainSampler` from `js/euc/simulation/planSampler.js` and tuning from `js/euc/data/tuning.js`.
   The recovery imports also reach `js/euc-dynamic.js` and `js/euc/simulation/world.js`. For a ground query
   with those helpers retained, allocate the output with `createGroundSample()` from `world.js`, then call
   `world.sampler.sampleGround(x, z, sample, actorFeetY)` rather than always selecting the highest deck.
   This is a real engine dependency even with no player. The sampler's generated import closure at this commit
   is `js/euc/data/{surfaces,tuning}.js`, `js/euc/shared/freeze.js`, and
   `js/euc/simulation/{planSampler,world}.js`. Keep those MIT helpers initially, or replace the sampler
   construction in `loadCity()` before removing `js/euc/` completely. Do not keep
   the entire generated folder just to satisfy a few imports. If using `releaseConstruction` in
   `js/sj-handoff.js`, call it after rendering is built and your collider copy is complete. Dispose of scenery
    and remove its scene content when unloading. Stop the render loop and call `light.dispose()` to release
    the atmosphere's resources.
4. Test a sloped street, stairs and a layered passage where the top surface isn't always the walkable floor.
   Set your own title, in-game credits and public data link. Recheck the streets cache/key if you change its
   inputs and the CSP if you carry over the HTML policy. Package your actual project and audit the shipped files;
   a city-only build doesn't need to contain any of the participants or their assets.

### Keep city life in your own host

Use `createCityLife` from `js/sj-life.js` after `buildWorld` and before releasing the construction records.
Copy or pack anything you need later before calling `releaseConstruction`. Follow the shipped host for
`focus`, `clearAround`, `setHour`, `warm`, `update` and `dispose`; feed it your actor pose instead of assuming
a camera is a rider. Each async traffic/people part returns `update`, `publish`, `refocus`, `clearAround`,
`setHour`, `warm`, `stats` and `dispose`. `js/sj-actor-bodies.js` supplies the shared index: parts read the last
snapshot and publish live moving bodies regardless of rendering. Parked bodies belong to the static sampler.
Precompile all draw variants at startup, use seeded randomness and avoid per-actor lights. For synthesized sound,
attach `life.createAudio` to your own audio context and update it only while playing.

Set population caps with `?cars=N` or `?people=N`, or change `LIFE_CAPS` for new defaults. Add a parked street
in the `PARKING_OVERRIDES` cross-section table in `js/sj-street-sides.js` by road index; parking and traffic
share its widths and sides, so keep a lane and crossings clear and rebuild the streets cache. Append new
vehicle types in `js/sj-vehicle-types.js` without reordering the existing entries. To add a place people gather,
give a plaza a ring and hour tiers in `js/sj-walk.js` (or mark it as a square ground area); supply routes,
public stair flights and benches before the handoff. San Juan's liveries, parked rows, wardrobe and placement are
local designs; keep any new liveries free of real maker, company or agency marks unless independently cleared.
Keep the donor record current with `node tools/actors-provenance.mjs` and verify it with `--check`.

## Credits to paste into your game and README

The author asks you to use this line in visible in-game credits and in your README when you reuse the city.
MIT does not prescribe a splash screen or credit format; keep the required notices and meet the separate OSM
and asset attribution terms:

> Old San Juan world from *El Viejo San Juan: EUC Thrills* by VibezZzCoder — https://github.com/VibezZzCoder/euc-sanjuan — MIT code; © OpenStreetMap contributors (ODbL); USGS 3DEP

If you also reuse original licensed EUC Thrills assets, include this separate line and the licence link:

> Assets from *EUC Thrills* by VibezZzCoder — CC BY 4.0 — https://github.com/VibezZzCoder/EUC-thrills

Add a short change note, for example: “Adapted the city for a walking tour; replaced the camera, input, actors
and audio. Added a marked walking route.” Preserve the original copyright notices even if you
don't use the original title. Use the origin name to give credit, not to brand an independent game.

**For map data, make the attribution and download easy to find.** Link the in-game OSM credit to
[OpenStreetMap's attribution page](https://www.openstreetmap.org/copyright), directly or through visible
credits. If you publicly use the derived database, or a work made from that derivative, offer a machine-readable
copy of the derivative or the changes/method needed to reconstruct it as provided by
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); offer it free of charge when distributing over the internet.
Include the derived layers you actually use
(not just the filename `city.json` if streets or boundaries are elsewhere). The share-alike is for the
derived database; it doesn't put unrelated game code or art under ODbL. Keep data provenance with your copy:
the builders document the source inputs, but a fresh live OSM query is not an exact archived input.
Credit [USGS 3DEP](https://www.usgs.gov/3d-elevation-program) for the public-domain elevation, keep its source
and datum details, and don't imply that USGS endorses the game or that the terrain is survey quality.

## What isn't granted, and how to say hello

The open licences don't grant identity, recording, logo, trademark or endorsement rights the project doesn't
own or sublicense. They don't require branding your project EUC Thrills, asking permission for MIT reuse, or
notifying the author. Retain the applicable licence notices and attribution; do not present a reused city as
solely your own work.

As a courtesy, VibezZzCoder would be glad to see what you made. Keep the repository link easy to find and,
if you want, share your project through the [source repository](https://github.com/VibezZzCoder/euc-sanjuan)
or open an [issue](https://github.com/VibezZzCoder/euc-sanjuan/issues) if issues are enabled. No message is required.
