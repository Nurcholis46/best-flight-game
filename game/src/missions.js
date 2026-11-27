// missions.js — the three Emberwing sorties, the combo multiplier and wind.
// Ring Run is the classic 12-ring circuit; Slalom Sprint threads 8 low
// gates between striped pylons along the east coast against a shorter
// clock; Cargo Drop carries a crate to a glowing ground target (SPACE to
// release) and scores by how close it lands, then you land on the strip.
// All three share the fuel / hull / landing-bonus systems in aircraft.js.

import { GAME } from './config.js';
import { terrainHeight, CARGO_TARGET } from './world.js';

export const MISSIONS = [
  {
    id: 'rings', key: '1', name: 'Ring Run',
    blurb: '12 rings in order, then land on the strip.',
    startTime: GAME.startTime,
  },
  {
    id: 'slalom', key: '2', name: 'Slalom Sprint',
    blurb: '8 low gates between the pylons. Stay under the caps!',
    startTime: GAME.slalomTime,
  },
  {
    id: 'cargo', key: '3', name: 'Cargo Drop',
    blurb: 'Drop the crate on the glowing target (SPACE), then land.',
    startTime: GAME.cargoTime,
  },
];

// Slalom gates down the east coast, flown southward. Each gate is a pair of
// striped pylons; you must cross between them below the height cap.
export function buildSlalom() {
  const points = [
    [820, -1450], [1010, -980], [1140, -480], [1120, 60],
    [980, 560], [760, 1010], [470, 1340], [140, 1560],
  ];
  return points.map(([x, z], i) => {
    const prev = i === 0 ? [0, -200] : points[i - 1];
    const heading = Math.atan2(x - prev[0], -(z - prev[1]));
    const ground = Math.max(0, terrainHeight(x, z));
    return {
      x, z, y: ground + 22, ground,
      heading,
      halfWidth: 19,                 // pylons stand this far either side
      cap: ground + 58,              // fly below this or the gate does not count
      radius: 24, done: false,
    };
  });
}

// The cargo target: a glowing ring on the meadow west of the strip.
export function buildCargoTarget() {
  return {
    x: CARGO_TARGET.x, z: CARGO_TARGET.z,
    y: Math.max(0, terrainHeight(CARGO_TARGET.x, CARGO_TARGET.z)),
    radius: 30,
  };
}

export function newCrate() {
  return { state: 'loaded', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, score: 0, dist: 0 };
}

// Release the crate from the aircraft with the plane's velocity.
export function dropCrate(crate, a) {
  if (crate.state !== 'loaded') return false;
  crate.state = 'falling';
  crate.x = a.x; crate.y = a.y - 2; crate.z = a.z;
  crate.vx = Math.sin(a.heading) * a.speed;
  crate.vz = -Math.cos(a.heading) * a.speed;
  crate.vy = a.vy;
  return true;
}

// Advance a falling crate; returns 'landed' on ground contact.
export function stepCrate(crate, dt) {
  if (crate.state !== 'falling') return null;
  crate.vy -= 9.8 * dt;
  crate.vx *= Math.pow(0.55, dt); // parachute drag
  crate.vz *= Math.pow(0.55, dt);
  if (crate.vy < -7) crate.vy = -7; // canopy terminal velocity
  crate.x += crate.vx * dt;
  crate.y += crate.vy * dt;
  crate.z += crate.vz * dt;
  const ground = Math.max(0, terrainHeight(crate.x, crate.z));
  if (crate.y <= ground + 1) {
    crate.y = ground + 1;
    crate.state = 'landed';
    return 'landed';
  }
  return null;
}

export function scoreCrate(crate, target) {
  const dist = Math.hypot(crate.x - target.x, crate.z - target.z);
  crate.dist = Math.round(dist);
  crate.score = Math.max(0, Math.round(GAME.cargoMaxScore - dist * GAME.cargoFalloff));
  return crate.score;
}

// Combo multiplier: scores within GAME.comboWindow seconds chain up.
// 2 chained = x2, 4+ chained = x3. Returns the multiplier to apply.
export function newCombo() {
  return { count: 0, mult: 1, timer: 0 };
}
export function comboHit(combo) {
  combo.count = combo.timer > 0 ? combo.count + 1 : 1;
  combo.timer = GAME.comboWindow;
  combo.mult = combo.count >= 4 ? 3 : combo.count >= 2 ? 2 : 1;
  return combo.mult;
}
export function stepCombo(combo, dt) {
  if (combo.timer > 0) {
    combo.timer -= dt;
    if (combo.timer <= 0) { combo.count = 0; combo.mult = 1; }
  }
}

// Did the aircraft cross a slalom gate plane between the pylons and under
// the cap? `prevSide` is last frame's signed distance to the gate plane.
export function gateSide(gate, a) {
  const nx = Math.sin(gate.heading), nz = -Math.cos(gate.heading);
  return (a.x - gate.x) * nx + (a.z - gate.z) * nz;
}
export function gatePassed(gate, a) {
  const rx = Math.cos(gate.heading), rz = Math.sin(gate.heading);
  const lateral = Math.abs((a.x - gate.x) * rx + (a.z - gate.z) * rz);
  return lateral <= gate.halfWidth && a.y <= gate.cap && a.y >= gate.ground;
}

// Deterministic gusts: a slow veer plus a faster ripple, in m/s.
export function windAt(time) {
  const dir = 0.9 + Math.sin(time * 0.021) * 0.7 + Math.sin(time * 0.11) * 0.18;
  const speed = 3.2 + Math.sin(time * 0.047 + 1.3) * 1.6 + Math.sin(time * 0.23) * 0.7;
  return {
    x: Math.sin(dir) * speed,
    z: -Math.cos(dir) * speed,
    speed: Math.max(0, speed),
    dir, // radians, 0 = blowing toward north
  };
}
