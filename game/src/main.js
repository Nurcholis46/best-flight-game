// main.js — Emberwing Ring Run: game loop, mission logic and screens.
// Take off from the island strip, fly the 12-ring course in order before
// the clock runs out, mind the fuel gauge, and land back on the runway
// for the bonus. Screenshot mode (?shot=start|play|cockpit|end) poses the
// aircraft with a simple autopilot so the cover shots show real gameplay.

import { GAME } from './config.js';
import { controls, installInput, wasPressed, clearPresses } from './input.js';
import { initAudio, setEngine, ringChime, thud, fanfare, toggleMute } from './audio.js';
import { buildCourse, buildClouds } from './world.js';
import { newAircraft, stepAircraft } from './aircraft.js';
import { makeCamera, updateCamera, renderScene } from './render.js';
import { drawHud, drawTitle, drawEnd, drawPaused } from './hud.js';

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
  clouds: buildClouds(7),
  nextRing: 0,
  ringsDone: 0,
  score: 0,
  timeLeft: GAME.startTime,
  message: '',
  messageUntil: 0,
  won: false,
  endTitle: '',
  endLine: '',
  best,
  cameraMode: 'chase',
  ringScreen: null,
  prevRingSide: 0,
};
const camera = makeCamera();

function say(text, now, seconds = 2.2) {
  state.message = text;
  state.messageUntil = now + seconds;
  statusEl.textContent = text;
}

function resetFlight() {
  state.plane = newAircraft();
  state.rings = buildCourse();
  state.nextRing = 0;
  state.ringsDone = 0;
  state.score = 0;
  state.timeLeft = GAME.startTime;
  state.won = false;
  state.prevRingSide = 0;
  camera.x = state.plane.x; camera.y = state.plane.y + 6; camera.z = state.plane.z + 17;
  camera.yaw = 0; camera.pitch = 0; camera.roll = 0;
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

// Which side of the next ring's plane is the aircraft on? A sign flip while
// close to the centre means a pass.
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
    const centreDist = Math.hypot(a.y - ring.y, dist);
    const centred = Math.abs(a.y - ring.y) < 7 && dist < ring.radius * 0.55;
    ring.done = true;
    state.ringsDone += 1;
    state.nextRing += 1;
    state.prevRingSide = 0;
    state.score += GAME.ringScore + (centred ? GAME.centreBonus : 0);
    state.timeLeft += GAME.ringTimeBonus;
    ringChime(centred);
    say(centred ? `DEAD CENTRE! +${GAME.ringScore + GAME.centreBonus}` : `RING ${state.ringsDone} +${GAME.ringScore}`, now);
    if (state.nextRing >= state.rings.length) {
      say('ALL RINGS! Land on the strip for the bonus', now, 3.5);
    }
    return;
  }
  state.prevRingSide = side;
}

function applyMouseSteer() {
  if (!controls.mouseSteer) return;
  const dead = 0.08;
  if (Math.abs(controls.mouseX) > dead) controls.roll = Math.max(-1, Math.min(1, controls.mouseX * 1.6));
  if (Math.abs(controls.mouseY) > dead) controls.pitch = Math.max(-1, Math.min(1, -controls.mouseY * 1.4));
}

// A gentle autopilot used only for screenshot poses: point the nose at the
// next ring and keep the speed healthy.
function autopilot() {
  const a = state.plane;
  const ring = state.rings[Math.min(state.nextRing, state.rings.length - 1)];
  const wantHeading = Math.atan2(ring.x - a.x, -(ring.z - a.z));
  let dh = wantHeading - a.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  controls.roll = Math.max(-1, Math.min(1, dh * 1.15));
  const dy = ring.y - a.y;
  controls.pitch = Math.max(-1, Math.min(1, dy * 0.012));
  controls.throttleUp = a.throttle < 0.82;
  controls.throttleDown = false;
}

function stepPlay(dt, now) {
  if (shotMode) autopilot();
  else applyMouseSteer();
  const event = stepAircraft(state.plane, controls, dt);
  const a = state.plane;

  if (event === 'takeoff') say('AIRBORNE — chase the gold ring!', now);
  if (event === 'perfect' || event === 'landed') {
    thud(false);
    const bonus = event === 'perfect' ? GAME.perfectLandingScore : GAME.landingScore;
    if (state.nextRing >= state.rings.length) {
      state.score += bonus;
      endFlight(true, 'COURSE COMPLETE!', event === 'perfect' ? 'A greaser of a landing. The tower applauds.' : 'Down safe on the strip. Course complete!');
    } else {
      say(event === 'perfect' ? 'PERFECT TOUCHDOWN — refuelled!' : 'Down safe — refuelled on the strip', now, 3);
    }
  }
  if (event === 'crash') { thud(true); endFlight(false, 'CRASHED', 'The Emberwing is in pieces. Fly gentler next time.'); }
  if (event === 'ditch') { thud(true); endFlight(false, 'DITCHED', 'You put her in the sea. The island wins this round.'); }

  if (a.airborne) checkRing(now);
  if (a.airborne) state.timeLeft -= dt;
  if (state.timeLeft <= 0 && state.phase === 'play') {
    endFlight(false, 'OUT OF TIME', 'The clock beat you. Rings buy seconds — keep moving!');
  }
  if (a.fuel <= 0 && a.airborne && a.speed < 12) {
    endFlight(false, 'OUT OF FUEL', 'The tank ran dry mid-course. Throttle discipline matters.');
  }
  setEngine(a.throttle, a.airborne);
}

// Pose the world for a screenshot: title over the runway, mid-flight chase
// toward a ring, cockpit over the island, or the results screen.
function setupShot() {
  resetFlight();
  const a = state.plane;
  if (shotMode === 'start') {
    state.phase = 'title';
    a.throttle = 0.35; a.speed = 18;
    camera.x = 13; camera.y = 18; camera.z = 398; camera.yaw = 0.05; camera.pitch = -0.09;
  } else if (shotMode === 'play') {
    state.phase = 'play';
    // On the incoming leg to ring 2, 175 m out and a touch off-centre, so
    // the gold ring reads beside the banking aircraft, not behind it.
    const ring = state.rings[1];
    a.x = ring.x - Math.sin(ring.heading) * 175 + Math.cos(ring.heading) * 20;
    a.z = ring.z + Math.cos(ring.heading) * 175 + Math.sin(ring.heading) * 20;
    a.y = ring.y + 4; a.heading = ring.heading; a.pitch = 0.03; a.roll = 0.3;
    a.speed = 58; a.throttle = 0.8; a.airborne = true; a.fuel = 72;
    state.score = 750; state.timeLeft = 118; state.nextRing = 1; state.ringsDone = 1;
    state.rings[0].done = true;
    say('RING 1 +250', 0, 999);
  } else if (shotMode === 'cockpit') {
    state.phase = 'play';
    state.cameraMode = 'cockpit'; camera.mode = 'cockpit';
    // On the incoming leg to ring 5, 260 m out, island spread below.
    const ring = state.rings[4];
    a.x = ring.x - Math.sin(ring.heading) * 260;
    a.z = ring.z + Math.cos(ring.heading) * 260;
    a.y = ring.y + 10; a.heading = ring.heading; a.pitch = -0.04; a.roll = -0.18;
    a.speed = 64; a.throttle = 0.72; a.airborne = true; a.fuel = 58;
    state.score = 1250; state.timeLeft = 96; state.nextRing = 4; state.ringsDone = 4;
    state.rings.forEach((r, i) => { r.done = i < 4; });
  } else if (shotMode === 'end') {
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

  // Clouds drift slowly east.
  for (const c of state.clouds) {
    c.x += c.drift * dt;
    if (c.x > 2800) c.x = -2800;
  }

  camera.mode = state.cameraMode;
  if (!(shotMode === 'start' || shotMode === 'end')) updateCamera(camera, state.plane, dt);
  const project = renderScene(ctx, W, H, camera, state, now);

  // Where is the next ring on screen (for the off-screen arrow)?
  const ring = state.rings[state.nextRing];
  if (ring) {
    const p = project(ring.x, ring.y, ring.z);
    state.ringScreen = p
      ? { x: p.x, y: p.y, onScreen: p.x > 0 && p.x < W && p.y > 0 && p.y < H }
      : { x: W / 2, y: 40, onScreen: false };
  } else state.ringScreen = null;

  if (state.phase === 'title') drawTitle(ctx, W, H, state.best);
  else if (state.phase === 'end') { drawHud(ctx, W, H, state); drawEnd(ctx, W, H, state); }
  else if (state.phase === 'pause') { drawHud(ctx, W, H, state); drawPaused(ctx, W, H); }
  else drawHud(ctx, W, H, state);
}
requestAnimationFrame(frame);
