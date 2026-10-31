# Tidewater

A private island world for the browser: a real-time tropical island and ocean where you set the time of day,
the sun and the sea yourself, swim and dive the reef, take the boat out, fly a free camera, and surf (pick a
board in the board library, give it your own colours or a picture). Fishing from the pier, the beach or your
own boat is there too, as an option. It runs directly on WebGPU and WGSL with its own small rendering engine,
no framework. The interface speaks English, 简体中文, 日本語, 한국어 and العربية.

**Play it (v2):** https://zzzhengqi.github.io/tidewater-v2/ — needs a WebGPU browser (recent Chrome / Edge;
Safari 26+). The earlier version stays at https://zzzhengqi.github.io/tidewater/ (upstream:
https://dgreenheck.github.io/tidewater/).

![Fishing off the pier at golden hour](docs/screenshot.jpg)

![The beach in the late afternoon](docs/screenshot-beach.jpg)

## Requirements

- A browser with WebGPU: a recent Chrome, Edge or Safari.
- A capable GPU. It targets 60 fps at 2560×1267 on an Apple M5 Pro, and dynamic resolution scales
  the render down on slower machines.
- The first load compiles several hundred shaders, which can take a minute or more. Later visits are
  faster because the browser caches them.

## Features

**Fishing**
- A spinning rod and reel that cast, reel and bend under load, with the bail, rotor and crank animated.
- Bites that depend on the water (shallows, pier, reef, bay, deep water), depth and time of day, across
  18 Caribbean species.
- A line-tension fight: keep the tension in the green band, ease off when the fish runs.
- A full-screen catch card with the fish's length and weight, a fish log with records, and a cooler.
- Joe's fish stand buys your catch; Marta's chandlery sells line, reels, rods, a bigger hold, fuel, a rebuilt
  engine, a fish finder and deck floodlights for night fishing.
- Walk the deck and the wheelhouse while the boat drifts; the boat burns fuel.
- A first-play guide, contextual tips and a minimap. Progress is saved in the browser.

**Ocean**
- Four-cascade FFT ocean (Tessendorf spectra) with foam, whitecaps, wind streaks and swell.
- Depth-aware breaking waves with peeling shoulders, whitewater, spray and foam lace.
- A shallow-water simulation for swash running up and down the sand.
- Boat wake and bow spray, and a whale wake.
- Caustics on the seabed and in the water, with light shafts.
- A split underwater/above-water view at the waterline, with water droplets on the lens after surfacing.
- Refraction of the seabed through the surface, including behind the pier and boats.

**Sky**
- Physically based atmosphere (Hillaire 2020) with a sun, moon and stars.
- Volumetric cumulus and wispy cirrus with cloud shadows on the land.
- Aerial perspective and sea haze.
- God rays, and a lens flare with occlusion.

**World**
- An island with a beach, hills, headlands and rocks.
- A fishing village, a pier, and the vendors' stalls built from Poly Haven scans.
- Realistic vendor characters (Microsoft Rocketbox) with skinned animation.
- A coral reef with fish.
- Palms, bananas, monstera, elephant ear, heliconia, bird of paradise, broadleaf trees, shrubs and dune
  grass, with impostors and dithered LOD fades.
- Beach debris.
- Birds, crabs and marine snow.
- A humpback whale with an escort of fish, blows, fluke dives and breaches.

**Lighting and post**
- Cascaded shadows with contact-hardening penumbrae, and screen-space contact shadows.
- Ground bounce light.
- GTAO ambient occlusion.
- Temporal upscaling and sharpening.
- Bloom, auto exposure and motion blur.
- Night lighting from lanterns, windows and the boat, plus a flashlight that also works underwater.

**Audio**
- Positional audio from real CC0 field recordings: surf timed to each breaking wave, wind, birds, the boat
  engine, footsteps by surface, underwater ambience, whale song, and the rod and reel (casts, the bail,
  reeling, the drag, line snaps, splashes).

## Controls

The full list is generated in game from `src/core/Keymap.js` (F1). New features don't get letter keys of
their own: they go into the equipment wheel (R) or the settings panel (H).

| Key | Action |
|---|---|
| W A S D | Move, steer the boat |
| Mouse | Look (click to capture the mouse, Esc to release) |
| Shift | Sprint / boat boost / fast free camera |
| Space | Jump / swim up / climb / free camera up |
| C | Crouch / dive / free camera down |
| E | Interact: board the boat, take or leave the helm, step ashore, talk to the traders |
| R | Equipment wheel: tap to open, R again for the next item, click or Enter to take it, Esc or a movement key to close |
| Left mouse | Use what you hold (rod: hold to wind up, release to cast · strike · hold to reel) |
| Right mouse | Rod: reel an empty line in |
| I or Tab | Cooler / fish hold and the fish log (fishing on) |
| V | Boat camera at the helm (1st / 3rd person) |
| F | Free camera |
| T | Pause time |
| L | Flashlight |
| M | Mute |
| H | Settings panel |
| P | Photo mode |
| F1 or ? | All controls |
| Esc | Close a panel or the wheel, release the mouse |

### Gameplay options

Settings (H) → Gameplay switches the optional parts on or off, saved in the browser: **Fishing** (the rod on
the wheel, the traders, the cooler and fishing tips), **Minimap**, **Light HUD** (hides the frame-rate box,
mode label and tip cards) and **Overview and tips**.

### Fishing (optional)

Walk the deck of the boat while it drifts, or fish from the pier and the beach: press R and pick the rod.
Cast, wait for the bobber to dip and strike when it's pulled under, then play the fish: keep the line
tension in the green band, ease off when it runs. Different water holds different fish (the shallows, the
pier, the reef, the bay and deep water offshore), and some bite best at dawn, dusk or night. Sell your
catch to Joe at the fish stand on the beach by the pier, and spend it at Marta's chandlery by the
boathouse: stronger line, a faster reel, a longer rod, a bigger fish hold, a larger fuel tank, a rebuilt
engine, a fish finder and deck floodlights for night fishing. With fishing on the boat burns diesel at the
helm; fill up at the chandlery. Progress is saved in the browser.

The settings panel (H) exposes the sea state, time of day, sun azimuth, clouds, haze, post-processing and
more.

## URL options

Add these to the URL, for example `?fly&noAudio`:

| Option | Effect |
|---|---|
| `fly` | Start in the free camera |
| `noAudio` | Disable sound |
| `noClouds` | Skip the volumetric clouds |
| `noHaze` | Skip the haze and sun shafts |
| `noCaustics` | Skip caustics |
| `noVeg` | Skip vegetation |
| `noSim` | Skip the swash (shallow-water) simulation |

## Running locally

```sh
npm install
npm run dev      # http://127.0.0.1:5189
npm run build    # static build in dist/
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

### Languages

The interface is available in English, 简体中文, 日本語, 한국어 and العربية: pick one from the menu at the top of
the settings panel (`H`). The choice is saved in the browser; on a first visit a Chinese browser gets Chinese,
anything else English. All text lives in `src/ui/locales/<language>.js` (see [docs/PROGRESS.md](docs/PROGRESS.md)
for how to add or change a string).

```sh
npm run i18n:check    # every language has every key, no extra or empty ones (part of npm test)
npm run i18n:preview  # rebuilds test/i18n.html
```

To look at every screen in every language without WebGPU, open `test/i18n.html` directly in a browser. It is a
standalone preview (settings, help, start screen, HUD, fishing HUD, catch card, cooler, fish stand, chandlery,
guide, loader); after changing the UI, regenerate it with `npm run i18n:preview`.

## Project layout

| Folder | Contents |
|---|---|
| `src/game/` | The fishing game: rod, bites, the fight, catch card, cooler and log, vendors and stalls, guide, minimap, HUD |
| `src/engine/` | The rendering engine: math, scene graph and geometry, GPU resources, WGSL shader composition, materials, lighting and shadows |
| `src/ocean/` | FFT ocean, water surface and material, shore waves, breakers, swash, wake, caustics, underwater lighting |
| `src/sky/` | Atmosphere, clouds, sky and environment |
| `src/world/` | Terrain, village, pier, reef, fish, vegetation, rocks, debris, wildlife, whale, boat |
| `src/post/` | Post chain: AO, underwater composite, haze, TAAU, motion blur, bloom, lens flare, droplets |
| `src/materials/` | Shared lighting: shadow filtering, bounce light, contact shadows, local lights, LOD fades |
| `src/player/` | Walking, swimming, the boat and the free camera |
| `src/audio/` | The sample-based soundscape |
| `src/ui/` | Settings panel, loading screen and HUD; `i18n.js` and `locales/` hold the interface text in every language |
| `tools/` | Scripts that fetch and convert the characters, stall props and fishing sounds |
| `test/` | i18n check, headless engine smoke test and game-logic tests (`npm test`), the language preview, HUD / loader dev pages |

## Credits and license

The code is released under the MIT license; see [LICENSE](LICENSE). Third-party assets (CC0 audio from
Freesound, CC0 scans from Poly Haven, MIT characters from Microsoft Rocketbox, OFL / Apache fonts) and
technique references are listed in [CREDITS.md](CREDITS.md).
