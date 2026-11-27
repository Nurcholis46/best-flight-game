// main.js — Emberwing Ring Run: game loop, mission logic and screens.
// Three sorties from the island strip: Ring Run (12 rings), Slalom Sprint
// (8 low pylon gates) and Cargo Drop (crate onto a ground target), chosen
// with 1/2/3 on the title screen. Combos chain quick scores, wind pushes
// the plane about, and particles mark every takeoff, ring and touchdown.
// Screenshot mode (?shot=cover|cockpit|slalom|landing, plus legacy
// start|play|end) poses the aircraft with a simple autopilot so the cover
// shots show real gameplay.

import { GAME } from './config.js';
import { controls, installInput, wasPressed, clearPresses } from './input.js';
import { initAudio, setEngine, ringChime, thud, fanfare, toggleMute } from './audio.js';
import { buildCourse, buildClouds } from './world.js';
import { newAircraft, stepAircraft } from './aircraft.js';
import { makeCamera, updateCamera, renderScene } from './render.js';
import { drawHud, drawTitle, drawEnd, drawPaused } from './hud.js';
import { buildScenery } from './scenery.js';
import {
  newEffects, ringBurst, dustPuff, splash, crashPuff, targetSparkle,
  emitContinuous, stepEffects,
} from './effects.js';
import {
  MISSIONS, buildSlalom, buildCargoTarget, newCrate, dropCrate, stepCrate,
  scoreCrate, newCombo, comboHit, stepCombo, windAt, gateSide, gatePassed,
} from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot'); // null in normal play

let W = 1280, H = 720;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

let best = 0;
try { best = Number(localStorage.getItem('emberwing-best')) || 0; } catch { best = 0; }

const state = {
  phase: 'title', // title | play | pause | end
  plane: newAircraft(),
  rings: buildCourse(),
  gates: buildSlalom(),
  cargoTarget: buildCargoTarget(),
  crate: newCrate(),
  clouds: buildClouds(7),
  scenery: buildScenery(),
  effects: newEffects(),
  missionId: 'rings',
  nextRing: 0,
  ringsDone: 0,
  nextGate: 0,
  gatesDone: 0,
  score: 0,
  timeLeft: GAME.startTime,
  combo: newCombo(),
  wind: windAt(0),
  message: '',
  messageUntil: 0,
  won: false,
  endTitle: '',
  endLine: '',
  best,
  cameraMode: 'chase',
  ringScreen: null,
  prevRingSide: 0,
  prevGateSide: 0,
  dropPressed: false,
};
const camera = makeCamera();

function say(text, now, seconds = 2.2) {
  state.message = text;
  state.messageUntil = now + seconds;
  statusEl.textContent = text;
}

function missionDef() {
  return MISSIONS.find((m) => m.id === state.missionId) || MISSIONS[0];
}

function resetFlight() {
  state.plane = newAircraft();
  state.rings = buildCourse();
  state.gates = buildSlalom();
  state.cargoTarget = buildCargoTarget();
  state.crate = newCrate();
  state.effects = newEffects();
  state.nextRing = 0;
  state.ringsDone = 0;
  state.nextGate = 0;
  state.gatesDone = 0;
  state.score = 0;
  state.timeLeft = missionDef().startTime;
  state.combo = newCombo();
  state.won = false;
  state.prevRingSide = 0;
  state.prevGateSide = 0;
  camera.x = state.plane.x; camera.y = state.plane.y + 6; camera.z = state.plane.z + 17;
  camera.yaw = 0; camera.pitch = 0; camera.roll = 0; camera.shake = 0;
}

function endFlight(won, title, line) {
  state.phase = 'end';
  state.won = won;
  state.endTitle = title;
  state.endLine = line;
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem('emberwing-best', String(state.best)); } catch { /* private mode */ }
  }
  setEngine(0, false);
  if (won) fanfare();
}

function objectivesDone() {
  if (state.missionId === 'slalom') return state.nextGate >= state.gates.length;
  if (state.missionId === 'cargo') return state.crate.state === 'landed';
  return state.nextRing >= state.rings.length;
}

// Which side of the next ring's plane is the aircraft on?
function ringSide(ring, a) {
  const nx = Math.sin(ring.heading), nz = -Math.cos(ring.heading);
  return (a.x - ring.x) * nx + (a.z - ring.z) * nz;
}

function checkRing(now) {
  const ring = state.rings[state.nextRing];
  if (!ring) return;
  const a = state.plane;
  const side = ringSide(ring, a);
  const dist = Math.hypot(a.x - ring.x, a.y - ring.y, a.z - ring.z);
  if (state.prevRingSide !== 0 && Math.sign(side) !== Math.sign(state.prevRingSide) && dist < ring.radius + 14) {
    const centred = Math.abs(a.y - ring.y) < 7 && dist < ring.radius * 0.55;
    ring.done = true;
    state.ringsDone += 1;
    state.nextRing += 1;
    state.prevRingSide = 0;
    const mult = comboHit(state.combo);
    const gained = (GAME.ringScore + (centred ? GAME.centreBonus : 0)) * mult;
    state.score += gained;
    state.timeLeft += GAME.ringTimeBonus;
    ringChime(centred);
    ringBurst(state.effects, ring);
    say(centred ? `DEAD CENTRE! +${gained}` : `RING ${state.ringsDone} +${gained}${mult > 1 ? ` (x${mult})` : ''}`, now);
    if (state.nextRing >= state.rings.length) {
      say('ALL RINGS! Land on the strip for the bonus', now, 3.5);
    }
    return;
  }
  state.prevRingSide = side;
}

function checkGate(now) {
  const gate = state.gates[state.nextGate];
  if (!gate) return;
  const a = state.plane;
  const side = gateSide(gate, a);
  if (state.prevGateSide !== 0 && Math.sign(side) !== Math.sign(state.prevGateSide)) {
    if (gatePassed(gate, a)) {
      gate.done = true;
      state.gatesDone += 1;
      state.nextGate += 1;
      state.prevGateSide = 0;
      const mult = comboHit(state.combo);
      const gained = GAME.gateScore * mult;
      state.score += gained;
      state.timeLeft += GAME.gateTimeBonus;
      ringChime(false);
      ringBurst(state.effects, { x: gate.x, y: gate.y, z: gate.z });
      say(`GATE ${state.gatesDone} +${gained}${mult > 1 ? ` (x${mult})` : ''}`, now);
      if (state.nextGate >= state.gates.length) {
        say('ALL GATES! Land on the strip for the bonus', now, 3.5);
      }
      return;
    }
    say('MISSED — between the pylons, under the cap!', now, 1.6);
  }
  state.prevGateSide = side;
}

function applyMouseSteer() {
  if (!controls.mouseSteer) return;
  const dead = 0.08;
  if (Math.abs(controls.mouseX) > dead) controls.roll = Math.max(-1, Math.min(1, controls.mouseX * 1.6));
  if (Math.abs(controls.mouseY) > dead) controls.pitch = Math.max(-1, Math.min(1, -controls.mouseY * 1.4));
}

// A gentle autopilot used only for screenshot poses.
function autopilot() {
  const a = state.plane;
  let target = null;
  if (state.missionId === 'slalom') target = state.gates[Math.min(state.nextGate, state.gates.length - 1)];
  else if (state.missionId === 'cargo') target = state.cargoTarget;
  else target = state.rings[Math.min(state.nextRing, state.rings.length - 1)];
  // Head home to the strip on a gentle glide, never a dive.
  if (objectivesDone()) target = { x: 0, y: Math.max(24, a.y - 10), z: 0 };
  if (!target) return;
  const ty = target.y !== undefined ? target.y + (state.missionId === 'cargo' ? 60 : 0) : a.y;
  const wantHeading = Math.atan2(target.x - a.x, -(target.z - a.z));
  let dh = wantHeading - a.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  controls.roll = Math.max(-1, Math.min(1, dh * 1.15));
  controls.pitch = Math.max(-1, Math.min(1, (ty - a.y) * 0.012));
  controls.throttleUp = a.throttle < 0.82;
  controls.throttleDown = false;
}

function stepPlay(dt, now) {
  state.wind = windAt(now);
  // The landing pose flies itself: no autopilot, so it touches down and
  // rolls out with dust instead of climbing away again.
  if (shotMode && shotMode !== 'landing') autopilot();
  else if (!shotMode) applyMouseSteer();
  const event = stepAircraft(state.plane, controls, dt, state.wind);
  const a = state.plane;

  if (event === 'takeoff') {
    say('AIRBORNE — chase the gold marker!', now);
    dustPuff(state.effects, a.x, a.y - 2, a.z, 0.8);
  }
  if (event === 'perfect' || event === 'landed') {
    thud(false);
    dustPuff(state.effects, a.x, a.y - 2, a.z, event === 'perfect' ? 0.7 : 1.2);
    if (event === 'landed') camera.shake = Math.max(camera.shake, 0.6);
    const bonus = event === 'perfect' ? GAME.perfectLandingScore : GAME.landingScore;
    if (objectivesDone()) {
      state.score += bonus;
      endFlight(true, 'MISSION COMPLETE!', event === 'perfect' ? 'A greaser of a landing. The tower applauds.' : 'Down safe on the strip. Mission complete!');
    } else {
      say(event === 'perfect' ? 'PERFECT TOUCHDOWN — refuelled!' : 'Down safe — refuelled on the strip', now, 3);
    }
  }
  if (event === 'crash') {
    thud(true);
    crashPuff(state.effects, a.x, a.y - 1, a.z);
    camera.shake = 2.2;
    endFlight(false, 'CRASHED', 'The Emberwing is in pieces. Fly gentler next time.');
  }
  if (event === 'ditch') {
    thud(true);
    splash(state.effects, a.x, 0, a.z);
    camera.shake = 1.4;
    endFlight(false, 'DITCHED', 'You put her in the sea. The island wins this round.');
  }

  if (a.airborne) {
    if (state.missionId === 'rings') checkRing(now);
    else if (state.missionId === 'slalom') checkGate(now);
    else if (state.missionId === 'cargo' && state.dropPressed) {
      if (dropCrate(state.crate, a)) say('CRATE AWAY!', now, 1.6);
    }
  }
  state.dropPressed = false;

  if (state.missionId === 'cargo') {
    if (stepCrate(state.crate, dt) === 'landed') {
      const gained = scoreCrate(state.crate, state.cargoTarget);
      state.score += gained;
      ringChime(gained > 600);
      targetSparkle(state.effects, state.crate.x, state.crate.y, state.crate.z);
      say(gained > 600 ? `BULLSEYE! Crate +${gained}` : `Crate down ${state.crate.dist} m out +${gained}`, now, 3);
    }
  }

  stepCombo(state.combo, dt);
  emitContinuous(state.effects, a, dt);
  // Dust streaming off the wheels during the ground roll.
  if (!a.airborne && a.speed > 9 && !a.crashed) {
    dustPuff(state.effects, a.x, a.y - 2, a.z + 3, 0.3);
  }

  if (a.airborne) state.timeLeft -= dt;
  if (state.timeLeft <= 0 && state.phase === 'play') {
    endFlight(false, 'OUT OF TIME', 'The clock beat you. Objectives buy seconds — keep moving!');
  }
  if (a.fuel <= 0 && a.airborne && a.speed < 12) {
    endFlight(false, 'OUT OF FUEL', 'The tank ran dry mid-course. Throttle discipline matters.');
  }
  setEngine(a.throttle, a.airborne);
}

// Pose the world for a screenshot.
function setupShot() {
  const mode = shotMode === 'play' ? 'cover' : shotMode === 'start' ? 'title' : shotMode;
  if (mode === 'slalom') state.missionId = 'slalom';
  if (mode === 'cargo') state.missionId = 'cargo';
  resetFlight();
  const a = state.plane;
  if (mode === 'title') {
    state.phase = 'title';
    a.throttle = 0.35; a.speed = 18;
    // Low three-quarter view: plane on the strip, island behind.
    camera.x = 11; camera.y = 12.5; camera.z = 376; camera.yaw = 0.04; camera.pitch = -0.13; camera.roll = 0;
  } else if (mode === 'cover') {
    state.phase = 'play';
    const ring = state.rings[1];
    a.x = ring.x - Math.sin(ring.heading) * 175 + Math.cos(ring.heading) * 20;
    a.z = ring.z + Math.cos(ring.heading) * 175 + Math.sin(ring.heading) * 20;
    a.y = ring.y + 4; a.heading = ring.heading; a.pitch = 0.03; a.roll = 0.3;
    a.speed = 58; a.throttle = 0.8; a.airborne = true; a.fuel = 72;
    state.score = 750; state.timeLeft = 118; state.nextRing = 1; state.ringsDone = 1;
    state.rings[0].done = true;
    state.combo = { count: 2, mult: 2, timer: 9 };
    say('RING 1 +250', 0, 999);
  } else if (mode === 'cargo') {
    state.phase = 'play';
    const t = state.cargoTarget;
    a.x = t.x - 40; a.z = t.z + 260; a.y = t.y + 95; a.heading = 0; a.pitch = -0.05; a.roll = 0.12;
    a.speed = 52; a.throttle = 0.7; a.airborne = true; a.fuel = 61;
    state.score = 0; state.timeLeft = 96;
    state.crate.state = 'falling';
    state.crate.x = t.x - 8; state.crate.z = t.z + 30; state.crate.y = t.y + 34;
    state.crate.vy = -6;
    say('CRATE AWAY!', 0, 999);
  } else if (mode === 'cockpit') {
    state.phase = 'play';
    state.cameraMode = 'cockpit'; camera.mode = 'cockpit';
    // On final approach to the strip, threshold markings ahead.
    a.x = 6; a.z = 1050; a.y = 62; a.heading = 0; a.pitch = -0.06; a.roll = -0.08;
    a.speed = 34; a.throttle = 0.3; a.airborne = true; a.fuel = 44;
    state.score = 2750; state.timeLeft = 64; state.nextRing = 12; state.ringsDone = 12;
    state.rings.forEach((r) => { r.done = true; });
    say('ALL RINGS! Land on the strip for the bonus', 0, 999);
  } else if (mode === 'slalom') {
    state.phase = 'play';
    const gate = state.gates[2];
    a.x = gate.x - Math.sin(gate.heading) * 95;
    a.z = gate.z + Math.cos(gate.heading) * 95;
    a.y = gate.y + 8; a.heading = gate.heading; a.pitch = 0.0; a.roll = 0.22;
    a.speed = 58; a.throttle = 0.8; a.airborne = true; a.fuel = 66;
    state.score = 800; state.timeLeft = 71; state.nextGate = 2; state.gatesDone = 2;
    state.gates[0].done = true; state.gates[1].done = true;
    state.combo = { count: 2, mult: 2, timer: 8 };
    say('GATE 2 +400 (x2)', 0, 999);
  } else if (mode === 'landing') {
    state.phase = 'play';
    // Just touching down on the strip, dust already kicked up.
    a.x = 0; a.z = 210; a.y = 9.5; a.heading = 0; a.pitch = 0.05; a.roll = 0.02;
    a.speed = 33; a.throttle = 0.15; a.airborne = true; a.fuel = 38; a.vy = -2.4;
    state.score = 3400; state.timeLeft = 42; state.nextRing = 11; state.ringsDone = 11;
    state.rings.forEach((r, i) => { r.done = i < 11; });
    dustPuff(state.effects, a.x, a.y - 2, a.z + 6, 1.3);
    dustPuff(state.effects, a.x - 2, a.y - 2, a.z + 12, 1.0);
    say('PERFECT TOUCHDOWN — refuelled!', 0, 999);
  } else if (mode === 'end') {
    state.phase = 'end';
    state.won = true;
    state.endLine = 'A greaser of a landing. The tower applauds.';
    state.score = 3950; state.ringsDone = 12; state.nextRing = 12; state.best = 3950;
    state.rings.forEach((r) => { r.done = true; });
    a.x = 0; a.y = 8; a.z = 60; a.speed = 0; a.throttle = 0;
    camera.x = 20; camera.y = 17; camera.z = 175; camera.yaw = 0.1; camera.pitch = -0.1;
  }
}

installInput(canvas);
if (shotMode) setupShot();

let last = performance.now();
function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  let dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  if (dt <= 0) dt = 0.016;

  // Menu keys.
  if (wasPressed('KeyM')) toggleMute();
  if (wasPressed('KeyC') && !shotMode) {
    state.cameraMode = state.cameraMode === 'chase' ? 'cockpit' : 'chase';
    camera.mode = state.cameraMode;
  }
  if (state.phase === 'title') {
    for (const m of MISSIONS) {
      if (wasPressed(`Digit${m.key}`) || wasPressed(`Numpad${m.key}`)) state.missionId = m.id;
    }
  }
  if (wasPressed('Space') && state.phase === 'play') state.dropPressed = true;
  if (state.phase === 'title' && wasPressed('Enter')) {
    initAudio();
    resetFlight();
    state.phase = 'play';
    say('SHIFT for throttle — roll down the strip, then ↓ at 60 kt', now, 4);
  } else if (state.phase === 'end' && wasPressed('Enter')) {
    initAudio();
    resetFlight();
    state.phase = 'play';
  } else if (state.phase === 'play' && wasPressed('KeyP')) {
    state.phase = 'pause';
  } else if (state.phase === 'pause' && wasPressed('KeyP')) {
    state.phase = 'play';
  }
  if (wasPressed('KeyR') && state.phase !== 'title') {
    resetFlight();
    state.phase = 'play';
  }
  clearPresses();

  if (state.phase === 'play') stepPlay(dt, now);
  if (state.message && now > state.messageUntil) state.message = '';

  for (const c of state.clouds) {
    c.x += c.drift * dt;
    if (c.x > 2800) c.x = -2800;
  }

  stepEffects(state.effects, dt);
  camera.shake *= Math.pow(0.02, dt);
  camera.mode = state.cameraMode;
  // Only the end-screen pose keeps a hand-placed camera; the title pose
  // uses the normal chase camera behind the parked plane.
  const shotStatic = shotMode === 'end';
  if (!shotStatic) updateCamera(camera, state.plane, dt, now);
  const project = renderScene(ctx, W, H, camera, state, now);

  // Where is the next objective on screen (for the off-screen arrow)?
  const target = state.missionId === 'slalom'
    ? state.gates[state.nextGate]
    : state.missionId === 'cargo'
      ? (state.crate.state === 'loaded' ? state.cargoTarget : null)
      : state.rings[state.nextRing];
  if (target) {
    const ty = target.y !== undefined ? target.y : state.plane.y;
    const p = project(target.x, ty, target.z);
    state.ringScreen = p
      ? { x: p.x, y: p.y, onScreen: p.x > 0 && p.x < W && p.y > 0 && p.y < H }
      : { x: W / 2, y: 40, onScreen: false };
  } else state.ringScreen = null;

  if (state.phase === 'title') drawTitle(ctx, W, H, state);
  else if (state.phase === 'end') { drawHud(ctx, W, H, state); drawEnd(ctx, W, H, state); }
  else if (state.phase === 'pause') { drawHud(ctx, W, H, state); drawPaused(ctx, W, H); }
  else drawHud(ctx, W, H, state);
}
requestAnimationFrame(frame);
