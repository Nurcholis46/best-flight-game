// world.js — the island, the runway and the ring course.
// Terrain is a smooth analytic heightfield (layered sines), flattened around
// the runway so takeoffs and landings have a fair strip of ground. The same
// height function drives both rendering and collision, so what you see is
// exactly what you can hit.

import { WORLD } from './config.js';

// Small deterministic noise: sum of sines at incommensurate frequencies.
function swell(x, z) {
  return (
    Math.sin(x * 0.0011 + 1.7) * Math.cos(z * 0.0013 - 0.6) * 55 +
    Math.sin(x * 0.0031 - 0.4) * Math.sin(z * 0.0027 + 2.1) * 26 +
    Math.sin(x * 0.009 + z * 0.006) * 7 +
    Math.cos(x * 0.021 - z * 0.017) * 2.2
  );
}

// Island mask: land rises near the origin and falls away to sea at distance.
function islandMask(x, z) {
  const d = Math.hypot(x, z);
  const fall = Math.max(0, 1 - d / 3400);
  return fall * fall * (3 - 2 * fall); // smoothstep
}

// Keep the runway area flat at a gentle plateau height.
function runwayFlatten(x, z, h) {
  const r = WORLD.runway;
  const along = Math.abs(z - r.z) / (r.length / 2 + 260);
  const across = Math.abs(x - r.x) / (r.width / 2 + 300);
  const t = Math.min(1, Math.max(along, across));
  const blend = t * t * (3 - 2 * t);
  return 6 + (h - 6) * blend;
}

export function terrainHeight(x, z) {
  const mask = islandMask(x, z);
  const base = mask * (48 + swell(x, z) * 0.5) - 8;
  return runwayFlatten(x, z, base);
}

export function isOnRunway(x, z) {
  const r = WORLD.runway;
  return Math.abs(x - r.x) <= r.width / 2 && Math.abs(z - r.z) <= r.length / 2;
}

export function groundHeight(x, z) {
  return Math.max(WORLD.seaLevel, terrainHeight(x, z));
}

// The ring course: a flowing circuit out over the island and back to the
// runway, each ring facing the next so the course reads as one route.
export function buildCourse() {
  const points = [
    [0, 90, -1050], [420, 150, -1750], [1050, 210, -1650],
    [1500, 160, -900], [1350, 120, -150], [900, 190, 450],
    [350, 140, 950], [-350, 180, 1050], [-1000, 130, 650],
    [-1450, 200, -100], [-1200, 150, -900], [-550, 110, -1350],
  ];
  return points.map(([x, y, z], i) => {
    // Each ring faces the incoming leg (from the previous ring, or from
    // the runway for the first) so the pilot always flies through it
    // looking at its face, never edge-on.
    const prev = i === 0 ? [0, 40, -200] : points[i - 1];
    return {
      x, y, z,
      heading: Math.atan2(x - prev[0], -(z - prev[2])),
      radius: WORLD.ringRadius,
      done: false,
    };
  });
}

// Puffy low clouds scattered over the island, drawn as soft billboards.
export function buildClouds(seed = 7) {
  let s = seed * 2654435761 % 4294967296;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const clouds = [];
  for (let i = 0; i < 42; i++) {
    clouds.push({
      x: (rand() - 0.5) * 5200,
      y: 340 + rand() * 220,
      z: (rand() - 0.5) * 5200,
      r: 60 + rand() * 110,
      drift: 1.5 + rand() * 2.5,
    });
  }
  return clouds;
}

export function terrainColor(h, slope) {
  if (h <= 0.4) return '#2e6da8';            // sea handled by caller too
  if (h < 3) return '#d9c27a';               // beach sand
  if (h < 26) return slope > 0.55 ? '#6fae63' : '#5da85c';
  if (h < 52) return slope > 0.6 ? '#7d776c' : '#3f7d44';
  if (h < 78) return '#8a8378';              // bare rock
  return '#f4f7fa';                          // snow caps
}
