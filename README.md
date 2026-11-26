# best-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Nurcholis46/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Nurcholis46/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Emberwing Ring Run** — an original 3D flight game that runs in a desktop browser from static files. Take off from an island strip, thread 12 glowing rings in order before the clock runs out, watch your fuel, and land gently back on the runway for the bonus. Chase and cockpit views, a full instrument panel (altitude, airspeed, heading tape, artificial horizon), stall behaviour, fuel and hull management, and synthesised WebAudio engine sound. No libraries, no build step, no network requests while playing. All names, art and sound are original.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

## How to fly

- **SHIFT / CTRL** — throttle up / down. Roll down the strip and pull **↓** (pitch up) past ~60 kt to lift off.
- **↑ ↓** — pitch (note: ↑ pushes the nose down, like a real stick) · **← →** — bank · **Q / E** — rudder. Bank turns the nose.
- **Hold the mouse** on the canvas to steer with the pointer.
- **C** — chase / cockpit camera · **P** — pause · **M** — mute · **R** — restart · **ENTER** — start / fly again.

Fly through the gold ring next; the pillar of light marks it from far away and an arrow points to it off-screen. Each ring scores 250 (350 dead-centre) and adds 12 seconds. Full throttle burns fuel fast — land on the strip to refuel. After the last ring, land on the runway: a gentle, aligned touchdown pays 500, a perfect one 900. Crash, ditch in the sea, or run out of time or fuel and the sortie ends.

---

<sub>Entered on [make.fun](https://make.fun/?ref=mt29fv3h&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
