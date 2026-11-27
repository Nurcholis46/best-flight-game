// aircraft.js — the Emberwing's flight model.
// A deliberately forgiving arcade model with real consequences: throttle
// trades against climb, the wing stalls if you get slow, bank turns the
// nose, fuel burns faster at full power, and the ground is unforgiving
// unless you arrive slowly, level and on the runway.

import { PLANE } from './config.js';
import { groundHeight, isOnRunway } from './world.js';

export function newAircraft() {
  return {
    x: 0, y: 8, z: 330,        // parked on the runway, facing north (-Z)
    heading: 0,                // radians, 0 = north
    pitch: 0,                  // radians, + = nose up
    roll: 0,                   // radians, + = bank right
    speed: 0,                  // m/s along the flight path
    throttle: 0,               // 0..1
    vy: 0,                     // vertical speed, for landing judgement
    fuel: PLANE.fuelCapacity,
    hull: 100,
    airborne: false,
    landed: false,
    crashed: false,
    stall: false,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Advance the aircraft by dt seconds. `controls` comes from input.js.
// `wind` (optional, from missions.js windAt) is a sideways push in m/s that
// grows with altitude; omit it and the model behaves exactly as before.
// Returns an event string when something notable happens this step:
// 'takeoff' | 'landed' | 'perfect' | 'crash' | 'ditch' | null.
export function stepAircraft(a, controls, dt, wind = null) {
  if (a.crashed) return null;

  // Throttle lever.
  if (controls.throttleUp) a.throttle = clamp(a.throttle + PLANE.maxThrottleRate * dt, 0, 1);
  if (controls.throttleDown) a.throttle = clamp(a.throttle - PLANE.maxThrottleRate * dt, 0, 1);

  // Fuel: the engine drinks in proportion to throttle.
  const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurnFull - PLANE.fuelBurnIdle) * a.throttle;
  if (a.fuel > 0) a.fuel = Math.max(0, a.fuel - burn * dt);
  const power = a.fuel > 0 ? a.throttle : 0;

  // Stick: pitch and roll chase the input, then relax toward level.
  const pitchTarget = controls.pitch * 0.62;
  const rollTarget = controls.roll * 1.05;
  a.pitch += clamp(pitchTarget - a.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);
  a.roll += clamp(rollTarget - a.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
  if (controls.roll === 0) a.roll *= Math.pow(0.25, dt); // wings level themselves slowly

  // Bank turns the nose; the rudder adds a flat yaw.
  a.heading += (Math.sin(a.roll) * PLANE.turnFromRoll + controls.yaw * PLANE.yawRate) * dt;

  // Speed: engine pushes toward a throttle-set cruise, climbing bleeds it,
  // diving gains it, drag always takes a cut.
  const cruise = power * PLANE.maxSpeed;
  const gravityAlongPath = -Math.sin(a.pitch) * 9.8;
  a.speed += ((cruise - a.speed) * 0.55 + gravityAlongPath) * dt;
  if (controls.brake && !a.airborne) a.speed = Math.max(0, a.speed - 26 * dt);
  a.speed = clamp(a.speed, 0, PLANE.maxSpeed * 1.35);

  // Lift: enough speed and the wing carries you; too slow and you stall.
  const lift = clamp((a.speed - PLANE.stallSpeed * 0.55) / (PLANE.stallSpeed * 0.9), 0, 1.25);
  a.stall = a.airborne && a.speed < PLANE.stallSpeed;
  const climbRate = Math.sin(a.pitch) * a.speed * lift - (a.stall ? 9 : 0);
  a.vy = a.airborne ? climbRate : 0;

  // Move.
  const vx = Math.sin(a.heading) * Math.cos(a.pitch) * a.speed;
  const vz = -Math.cos(a.heading) * Math.cos(a.pitch) * a.speed;
  a.x += vx * dt;
  a.z += vz * dt;
  a.y += a.vy * dt;
  // Wind drift: gentle at the strip, a real push up high. The plane's own
  // velocity is untouched — the air mass itself moves.
  if (wind && a.airborne) {
    const altFactor = Math.min(1, Math.max(0.15, a.y / 220));
    a.x += wind.x * altFactor * dt;
    a.z += wind.z * altFactor * dt;
  }

  const ground = groundHeight(a.x, a.z);
  const gearHeight = 2.2;

  // On the ground: roll along the runway until rotation speed.
  if (!a.airborne) {
    a.y = ground + gearHeight;
    a.pitch = Math.max(0, a.pitch * 0.4);
    if (a.speed >= PLANE.rotateSpeed && controls.pitch > 0.15) {
      a.airborne = true;
      a.landed = false;
      return 'takeoff';
    }
    return null;
  }

  // Airborne: touching down again.
  if (a.y <= ground + gearHeight) {
    a.y = ground + gearHeight;
    const onStrip = isOnRunway(a.x, a.z);
    const gentle = a.vy > -4.5 && Math.abs(a.roll) < 0.35 && a.speed < 46;
    const aligned = Math.abs(Math.sin(a.heading)) < 0.45;
    a.airborne = false;
    if (ground <= 0.2) { a.crashed = true; a.hull = 0; return 'ditch'; }
    if (onStrip && gentle && aligned) {
      a.landed = true;
      a.fuel = PLANE.fuelCapacity; // ground crew tops you up on the strip
      return a.vy > -2 && a.speed < 34 ? 'perfect' : 'landed';
    }
    if (gentle && a.speed < 34) {
      a.landed = true;
      a.hull = Math.max(0, a.hull - 18); // rough field landing bends things
      return a.hull <= 0 ? (a.crashed = true, 'crash') : 'landed';
    }
    a.crashed = true;
    a.hull = 0;
    return 'crash';
  }
  return null;
}

export function altitudeAboveGround(a) {
  return Math.max(0, a.y - groundHeight(a.x, a.z));
}

export function headingDegrees(a) {
  const deg = (a.heading * 180 / Math.PI) % 360;
  return (deg + 360) % 360;
}

export function speedKnots(a) {
  return a.speed * 1.944;
}
