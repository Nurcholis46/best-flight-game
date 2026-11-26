# Emberwing Ring Run — build notes

Entry for make.fun bounty `best-flight-game-20261126-0057` ("Make the best flight game", $500).

## The game

An original 3D flight game in pure Canvas 2D (software projection, no engine, no assets, no network requests). You fly the **Emberwing**, a little red-and-cream prop plane, from an island airstrip:

1. **Take off** — throttle up with SHIFT, roll down the strip, pull ↓ past ~60 kt.
2. **Thread 12 glowing rings in order** — the next ring is gold with a light pillar and an off-screen arrow. Each ring scores 250 (350 dead-centre) and adds 12 seconds to the clock.
3. **Mind the fuel** — full throttle burns ~5× faster than idle. Landing on the strip refuels you.
4. **Land for the bonus** — after the last ring, a gentle aligned touchdown on the runway pays 500, a perfect one 900. Crash, ditch in the sea, run out of time or fuel, and the sortie ends.

Flight model (arcade with consequences): throttle trades against climb, the wing stalls below ~43 kt and the nose drops, bank turns the nose, rudder yaws flat, rough-field landings bend the hull. Two cameras: chase view (aircraft in frame, banking) and cockpit view (full dashboard with lit airspeed/altitude/fuel gauges, artificial horizon, throttle quadrant, warning lamps). HUD always shows altitude (ft + AGL), airspeed (kt), heading compass tape, throttle, fuel, hull, score, clock and ring counter. All sound is synthesised WebAudio (engine hum follows throttle, ring chimes, landing thuds, fanfare).

## Controls

| Input | Action |
|---|---|
| SHIFT / CTRL | throttle up / down |
| ↓ / ↑ | pitch up / down (stick-style) |
| ← → | bank left / right |
| Q / E | rudder yaw |
| Hold mouse | steer with pointer |
| C | chase / cockpit camera |
| P / M / R | pause / mute / restart |
| ENTER | start / fly again |

## Layout

- `game/index.html` — page shell (842 bytes)
- `game/src/config.js` — all tuning numbers and colours
- `game/src/input.js` — keyboard + mouse state
- `game/src/audio.js` — synthesised WebAudio sound
- `game/src/world.js` — analytic island heightfield, runway, ring course, clouds
- `game/src/aircraft.js` — flight model: throttle, lift/stall, bank-turn, fuel, landing judgement
- `game/src/render.js` — software-3D renderer: sky, sea, two-grid terrain mesh, runway, rings, clouds, chase-view aircraft
- `game/src/hud.js` — instruments, cockpit dashboard, title/end/pause screens
- `game/src/main.js` — game loop, mission logic, screenshot poses (`?shot=start|play|cockpit|end`)
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
