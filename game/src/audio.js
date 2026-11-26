// audio.js — all sound is synthesised with WebAudio; no audio files.
// An engine hum follows the throttle, a bright chime marks each ring,
// and short thuds cover landings and crashes. Everything is optional:
// if the browser has no AudioContext the game simply stays silent.

let ctx = null;
let engineOsc = null;
let engineGain = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
    engineOsc.start();
  } catch {
    ctx = null;
  }
}

export function setEngine(throttle, airborne) {
  if (!ctx || !engineOsc) return;
  const target = muted ? 0 : 0.015 + throttle * 0.05;
  engineGain.gain.setTargetAtTime(airborne || throttle > 0.02 ? target : 0, ctx.currentTime, 0.12);
  engineOsc.frequency.setTargetAtTime(52 + throttle * 78, ctx.currentTime, 0.15);
}

function tone(freq, when, dur, type = 'sine', vol = 0.12) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + dur + 0.02);
}

export function ringChime(centre) {
  tone(880, 0, 0.18, 'sine', 0.14);
  tone(1318, 0.07, 0.22, 'sine', 0.12);
  if (centre) tone(1760, 0.14, 0.3, 'triangle', 0.12);
}

export function thud(hard) {
  tone(hard ? 60 : 90, 0, hard ? 0.4 : 0.18, 'triangle', hard ? 0.3 : 0.15);
}

export function fanfare() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.13));
}

export function toggleMute() {
  muted = !muted;
  if (muted && engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  return muted;
}

export function isMuted() {
  return muted;
}
