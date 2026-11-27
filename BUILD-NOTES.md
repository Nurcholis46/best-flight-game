# Emberwing Ring Run — build notes

Entry for make.fun bounty `best-flight-game-20261126-0057` ("Make the best flight game", $500).

## The game

An original 3D flight game in pure Canvas 2D (software projection, no engine, no assets, no network requests). You fly the **Emberwing**, a little red-and-cream prop plane, from an island airstrip. Pick one of three sorties on the title screen (keys 1/2/3):

1. **Ring Run** — thread 12 glowing rings in order. The next ring is gold with a light pillar and an off-screen arrow. Each ring scores 250 (350 dead-centre) and adds 12 seconds to the clock.
2. **Slalom Sprint** — 8 low gates between pairs of striped pylons along the east coast, against a shorter clock. Each gate scores 200 (+6 s) but only counts if you cross between the pylons below the height cap.
3. **Cargo Drop** — carry a crate to a glowing ground target west of the strip and release it with SPACE. The crate falls under a little parachute and scores up to 1000 by distance from the centre; then land on the strip.

Shared systems: quick successive scores chain a **combo multiplier** (x2 at two in a row, x3 at four, 12 s window), **wind** gusts push the plane sideways (stronger at altitude; HUD arrow + airfield windsock show it), full throttle burns fuel ~5× faster than idle (landing on the strip refuels), and after the last objective a gentle aligned touchdown pays 500, a perfect one 900. Crash, ditch in the sea, run out of time or fuel, and the sortie ends.

Flight model (arcade with consequences): throttle trades against climb, the wing stalls below ~43 kt and the nose drops, bank turns the nose, rudder yaws flat, rough-field landings bend the hull. Two cameras: chase view (the Emberwing as a real 3D-projected polygon model — tapered fuselage, low wing with red tips, glass canopy, spinning prop disc, fixed gear — banking in frame, camera looking slightly into the turn with a speed FOV kick and touchdown shake) and cockpit view (full dashboard with lit airspeed/altitude/fuel gauges, artificial horizon, throttle quadrant, warning lamps). HUD always shows altitude (ft + AGL), airspeed (kt), vertical speed, heading compass tape, wind arrow, throttle, fuel, hull, score, clock, combo meter, mission objective and a minimap. The island is dressed with seeded scenery — pine forests, a coastal village, a red-white lighthouse, hangar, tower, windsock, fuel drums — over sun-lit three-grid terrain with distance haze, shoreline foam, sea sparkle and a snowy mountain massif plus a sister island on the horizon. Particles mark ring passes (gold sparks), takeoffs/landings (dust), ditching (splash), damage (smoke), hard turns (wingtip puffs) and high speed (streaks). All sound is synthesised WebAudio (engine hum follows throttle, ring chimes, landing thuds, fanfare).

## Controls

| Input | Action |
|---|---|
| 1 / 2 / 3 (title) | pick Ring Run / Slalom Sprint / Cargo Drop |
| SHIFT / CTRL | throttle up / down |
| ↓ / ↑ | pitch up / down (stick-style) |
| ← → | bank left / right |
| Q / E | rudder yaw |
| SPACE | drop the crate (Cargo Drop) |
| Hold mouse | steer with pointer |
| C | chase / cockpit camera |
| P / M / R | pause / mute / restart |
| ENTER | start / fly again |

## Layout

- `game/index.html` — page shell (842 bytes)
- `game/src/config.js` — all tuning numbers and colours (missions, combo, wind, sun)
- `game/src/input.js` — keyboard + mouse state
- `game/src/audio.js` — synthesised WebAudio sound
- `game/src/world.js` — analytic island heightfield (+ sister island, snowy massif), runway, ring course, clouds, smooth height-band terrain colours
- `game/src/aircraft.js` — flight model: throttle, lift/stall, bank-turn, fuel, wind drift, landing judgement
- `game/src/missions.js` — the three sorties: slalom gates, cargo crate + scoring, combo multiplier, wind gusts
- `game/src/scenery.js` — seeded island dressing: pine trees, village houses, lighthouse, hangar, tower, windsock, fuel drums, slalom pylons (visual only; collision stays terrain-based)
- `game/src/effects.js` — capped particle system: ring sparks, dust, splash, smoke, contrails, speed streaks
- `game/src/render.js` — software-3D renderer: sky + sun, sparkling sea, three-grid sun-lit terrain with haze and shoreline foam, runway with threshold markings + numbers, glowing rings / gates / cargo target, two-tone clouds, 3D-projected Emberwing model
- `game/src/hud.js` — instruments (incl. vertical speed, wind arrow, combo meter, minimap), cockpit dashboard, title with mission select, end/pause screens
- `game/src/main.js` — game loop, mission logic, screenshot poses (`?shot=cover|cockpit|slalom|landing|cargo|title|end`, legacy `start|play` aliased)
- `main.ts` — hand-in: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` via `buildDossier`
- `vendor/makefun-game.ts` — kit copy, byte-identical (sha256 dc671875…)
- `screenshots/` — 4 real renders (1280×720 JPEG, 62–95 KiB each), cover first by name

## Local verification (26 Nov 2026)

- `node serve.ts` serves the game; headless Chromium renders all four screenshot poses with no console errors (screenshots taken from those renders, converted PNG→JPEG with ffmpeg, unedited otherwise).
- `node --check` passes on all 8 game modules.
- Headless physics test (Node, importing `aircraft.js`/`world.js`): takeoff at rotate speed ✓, ring-plane crossing detected dead-centre ✓, gentle runway landing → `perfect` + refuel ✓, held dive → `crash` ✓, slow flight → stall sink ✓.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/game`, `out/screenshots`, `out/dossier.json` (476,781 bytes); two runs produce byte-identical dossiers.
- `game/` totals 52,736 bytes in 9 files; no `http(s)://`, CDN or `fetch(` references anywhere under `game/`.

## Rules compliance notes

Followed `RULES.txt` from the kit: static files under `game/` only, `game/index.html` ≤ 1 MiB, 4 screenshots ≤ 256 KiB with long side 1280 / short side 720, OSI-approved MIT `LICENSE` at root, `vendor/makefun-game.ts` unchanged, `main.ts` hands in via `buildDossier` with the scorer's caps. Nothing in the brief conflicted with RULES.txt. No bundle/check/submit was run by the build agent — that is the top-level agent's step.
