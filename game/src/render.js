// render.js — a small software-3D renderer on a 2D canvas.
// Painter's algorithm: sky + sun, sea with sparkle, three-grid terrain with
// sun-slope lighting and distance haze, runway with threshold markings,
// scenery (trees/village/lighthouse), glowing rings / slalom gates / cargo
// target, two-tone clouds, particles, then the 3D-projected Emberwing in
// chase view. Camera maths is plain vectors — no engine, no assets.

import { COLORS, WORLD, PLANE } from './config.js';
import { terrainHeight, terrainColorRGB, isOnRunway } from './world.js';
import { drawScenery, drawPylon } from './scenery.js';
import { drawEffects } from './effects.js';

const FOV = 1.15; // focal scale relative to canvas height
const SUN = (() => {
  const s = WORLD.sunDir;
  const len = Math.hypot(s.x, s.y, s.z);
  return { x: s.x / len, y: s.y / len, z: s.z / len };
})();

export function makeCamera() {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, mode: 'chase', fovScale: 1, shake: 0 };
}

// Follow the aircraft: chase view sits behind and above, looking slightly
// into the turn, with a gentle speed FOV kick; cockpit view sits in the
// pilot's seat and rolls fully with the plane. `shake` decays in main.js.
export function updateCamera(cam, a, dt, time = 0) {
  const ease = 1 - Math.pow(0.0015, dt);
  const speedFrac = Math.min(1, a.speed / PLANE.maxSpeed);
  cam.fovScale = 1 + speedFrac * 0.08;
  if (cam.mode === 'cockpit') {
    cam.x = a.x; cam.y = a.y + 1.6; cam.z = a.z;
    cam.yaw = a.heading; cam.pitch = a.pitch; cam.roll = a.roll;
    return;
  }
  const back = 17, up = 6.2;
  const tx = a.x - Math.sin(a.heading) * back;
  const tz = a.z + Math.cos(a.heading) * back;
  const ty = a.y + up - Math.sin(a.pitch) * 4;
  cam.x += (tx - cam.x) * ease;
  cam.y += (ty - cam.y) * ease;
  cam.z += (tz - cam.z) * ease;
  // Look-ahead: aim the camera a touch into the bank so the turn reads.
  const wantYaw = a.heading + a.roll * 0.32;
  let dyaw = wantYaw - cam.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  cam.yaw += dyaw * ease;
  cam.pitch += ((a.pitch * 0.55 - 0.04) - cam.pitch) * ease;
  cam.roll += ((a.roll * 0.35) - cam.roll) * ease;
  if (cam.shake > 0.001) {
    cam.x += Math.sin(time * 47) * cam.shake * 0.5;
    cam.y += Math.cos(time * 39) * cam.shake * 0.5;
  }
}

function projector(cam, w, h) {
  const cy = Math.cos(-cam.yaw), sy = Math.sin(-cam.yaw);
  const cp = Math.cos(-cam.pitch), sp = Math.sin(-cam.pitch);
  const cr = Math.cos(-cam.roll), sr = Math.sin(-cam.roll);
  const focal = h * FOV * (cam.fovScale || 1);
  return (x, y, z) => {
    let dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    let x1 = dx * cy - dz * sy;
    let z1 = dx * sy + dz * cy;
    let y2 = dy * cp - z1 * sp;
    let z2 = dy * sp + z1 * cp;
    let x3 = x1 * cr - y2 * sr;
    let y3 = x1 * sr + y2 * cr;
    if (z2 > -0.5) return null;
    const s = focal / -z2;
    return { x: w / 2 + x3 * s, y: h / 2 - y3 * s, depth: -z2, scale: s };
  };
}

function drawSky(ctx, w, h, cam) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(0.42, COLORS.skyMid);
  grad.addColorStop(0.7, COLORS.skyLow);
  grad.addColorStop(1, '#eef7fd');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const project = projector(cam, w, h);
  const sun = project(cam.x - 4000, cam.y + 2600, cam.z + 5200);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 210);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.18, 'rgba(255,236,170,0.55)');
    glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 210, sun.y - 210, 420, 420);
    ctx.fillStyle = COLORS.sun;
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.9)';
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 17, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSea(ctx, w, h, cam, project, time) {
  const R = 9000;
  const pts = [
    project(cam.x - R, 0, cam.z - R), project(cam.x + R, 0, cam.z - R),
    project(cam.x + R, 0, cam.z + R), project(cam.x - R, 0, cam.z + R),
  ];
  if (pts.some((p) => !p)) {
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(0, h * 0.52, w, h * 0.48);
    return;
  }
  const grad = ctx.createLinearGradient(0, h * 0.4, 0, h);
  grad.addColorStop(0, '#4a86bd');
  grad.addColorStop(0.4, COLORS.sea);
  grad.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fill();
  // Deterministic sun glints on the water near the camera.
  ctx.strokeStyle = 'rgba(255,250,215,0.5)';
  const step = 90;
  const cx = Math.round(cam.x / step) * step;
  const cz = Math.round(cam.z / step) * step;
  for (let gz = cz - 1400; gz < cz + 1400; gz += step) {
    for (let gx = cx - 1400; gx < cx + 1400; gx += step) {
      const hash = ((gx * 73856093) ^ (gz * 19349663) ^ ((Math.floor(time * 2) * 83492791) >>> 0)) >>> 0;
      if (hash % 5 !== 0) continue;
      if (terrainHeight(gx, gz) > 0.5) continue;
      const p = project(gx, 0.3, gz);
      if (!p) continue;
      const len = Math.max(2, p.scale * (2 + (hash % 7)));
      ctx.lineWidth = Math.max(1, p.scale * 0.35);
      ctx.beginPath(); ctx.moveTo(p.x - len / 2, p.y); ctx.lineTo(p.x + len / 2, p.y); ctx.stroke();
    }
  }
}

function mixRGB(c, target, t) {
  return [c[0] + (target[0] - c[0]) * t, c[1] + (target[1] - c[1]) * t, c[2] + (target[2] - c[2]) * t];
}

function drawTerrain(ctx, cam, project) {
  // Three grids: 20 m near, 60 m mid, 150 m far — recognisable relief
  // without blowing the quad budget (~4–5k quads per frame).
  const quads = [];
  const collect = (step, R, skipInner) => {
    const cx = Math.round(cam.x / step) * step;
    const cz = Math.round(cam.z / step) * step;
    for (let gz = cz - R; gz < cz + R; gz += step) {
      for (let gx = cx - R; gx < cx + R; gx += step) {
        if (skipInner && Math.hypot(gx + step / 2 - cam.x, gz + step / 2 - cam.z) < skipInner) continue;
        const h00 = terrainHeight(gx, gz), h10 = terrainHeight(gx + step, gz);
        const h01 = terrainHeight(gx, gz + step), h11 = terrainHeight(gx + step, gz + step);
        const avgH = (h00 + h10 + h01 + h11) / 4;
        if (avgH <= 0.25) continue;
        const p00 = project(gx, h00, gz), p10 = project(gx + step, h10, gz);
        const p01 = project(gx, h01, gz + step), p11 = project(gx + step, h11, gz + step);
        if (!p00 || !p10 || !p01 || !p11) continue;
        const dhdx = (h10 - h00) / step, dhdz = (h01 - h00) / step;
        const slope = Math.hypot(dhdx, dhdz);
        // Surface normal vs sun: slopes facing the sun are bright.
        const inv = 1 / Math.hypot(dhdx, 1, dhdz);
        const lit = Math.max(0.45, Math.min(1.25,
          0.62 + ((-dhdx * inv) * SUN.x + inv * SUN.y + (-dhdz * inv) * SUN.z) * 0.55));
        let rgb = terrainColorRGB(avgH, slope);
        // Subtle within-band variation (smooth sines, no checkerboard hash).
        const vary = 0.94 + 0.09 * (0.5 + 0.5 * Math.sin(gx * 0.013 + gz * 0.009));
        rgb = [rgb[0] * vary * lit, rgb[1] * vary * lit, rgb[2] * vary * lit];
        // Shoreline foam where the land just meets the sea.
        if (avgH < 1.6) rgb = mixRGB(rgb, [240, 248, 250], 0.55);
        const depth = (p00.depth + p11.depth) / 2;
        // Distance haze toward the horizon colour.
        const haze = Math.min(0.72, 1 - Math.exp(-depth / 3200));
        rgb = mixRGB(rgb, WORLD.horizon, haze);
        quads.push({ p00, p10, p11, p01, rgb, depth });
      }
    }
  };
  collect(150, 3000, 1150);
  collect(60, 1200, 360);
  collect(20, 380, 0);
  quads.sort((a, b) => b.depth - a.depth);
  for (const q of quads) {
    const col = `rgb(${Math.round(q.rgb[0])},${Math.round(q.rgb[1])},${Math.round(q.rgb[2])})`;
    ctx.fillStyle = col;
    ctx.strokeStyle = col; // same-colour stroke hides hairline seams
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(q.p00.x, q.p00.y);
    ctx.lineTo(q.p10.x, q.p10.y);
    ctx.lineTo(q.p11.x, q.p11.y);
    ctx.lineTo(q.p01.x, q.p01.y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function drawRunway(ctx, project) {
  const r = WORLD.runway;
  const y = terrainHeight(r.x, r.z) + 0.4;
  const segLen = 60;
  for (let d = -r.length / 2; d < r.length / 2; d += segLen) {
    const corners = [
      project(r.x - r.width / 2, y, r.z + d),
      project(r.x + r.width / 2, y, r.z + d),
      project(r.x + r.width / 2, y, r.z + d + segLen),
      project(r.x - r.width / 2, y, r.z + d + segLen),
    ];
    if (corners.some((p) => !p)) continue;
    ctx.fillStyle = COLORS.runway;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath(); ctx.fill();
  }
  // Threshold piano keys at both ends.
  ctx.fillStyle = COLORS.runwayLine;
  for (const end of [-1, 1]) {
    const z0 = r.z + end * (r.length / 2 - 46);
    for (let i = -3; i <= 3; i++) {
      const x = r.x + i * 5.4;
      const a = project(x - 1.4, y + 0.25, z0);
      const b = project(x + 1.4, y + 0.25, z0);
      const c = project(x + 1.4, y + 0.25, z0 + end * -30);
      const d = project(x - 1.4, y + 0.25, z0 + end * -30);
      if (!a || !b || !c || !d) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
      ctx.closePath(); ctx.fill();
    }
    // Runway number (36 landing northbound, 18 southbound).
    const np = project(r.x, y + 0.3, r.z + end * (r.length / 2 - 95));
    if (np && np.scale > 0.25) {
      ctx.font = `bold ${Math.max(8, np.scale * 13)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(245,245,240,0.9)';
      ctx.fillText(end < 0 ? '36' : '18', np.x, np.y);
    }
  }
  // Centreline dashes and edge lights.
  for (let d = -r.length / 2 + 30; d < r.length / 2 - 30; d += 46) {
    const a = project(r.x, y + 0.2, r.z + d);
    const b = project(r.x, y + 0.2, r.z + d + 22);
    if (!a || !b) continue;
    ctx.lineWidth = Math.max(1, a.scale * 1.6);
    ctx.strokeStyle = COLORS.runwayLine;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.fillStyle = '#ffe9a3';
  for (let d = -r.length / 2; d <= r.length / 2; d += 60) {
    for (const side of [-1, 1]) {
      const p = project(r.x + side * (r.width / 2 - 1.5), y + 0.6, r.z + d);
      if (!p) continue;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.scale * 0.5), 0, Math.PI * 2); ctx.fill();
    }
  }
}

// Thick glowing hoops: soft outer glow, bright core, darker rim, rotating
// chevrons on the next ring, light pillar and number.
function drawRings(ctx, project, rings, nextIndex, time) {
  const ordered = rings
    .map((ring, i) => ({ ring, i, c: project(ring.x, ring.y, ring.z) }))
    .filter((e) => e.c)
    .sort((a, b) => b.c.depth - a.c.depth);
  for (const { ring, i, c } of ordered) {
    const isNext = i === nextIndex;
    const color = ring.done ? COLORS.ringDone : isNext ? COLORS.ringNext : COLORS.ringTodo;
    const pulse = isNext ? 1 + Math.sin(time * 3.2) * 0.05 : 1;
    const R = ring.radius * pulse;
    const right = { x: Math.cos(ring.heading), z: Math.sin(ring.heading) };
    const ringPath = () => {
      ctx.beginPath();
      let started = false;
      for (let k = 0; k <= 36; k++) {
        const t = (k / 36) * Math.PI * 2;
        const p = project(
          ring.x + right.x * Math.cos(t) * R,
          ring.y + Math.sin(t) * R,
          ring.z + right.z * Math.cos(t) * R,
        );
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
    };
    ctx.globalAlpha = ring.done ? 0.35 : 1;
    // Outer glow.
    ringPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = (ring.done ? 0.12 : 0.28);
    ctx.lineWidth = Math.max(4, c.scale * (isNext ? 6.5 : 4.2));
    ctx.stroke();
    // Dark rim, then bright core.
    ctx.globalAlpha = ring.done ? 0.35 : 0.95;
    ringPath();
    ctx.strokeStyle = 'rgba(20,26,36,0.55)';
    ctx.lineWidth = Math.max(3, c.scale * (isNext ? 3.6 : 2.4));
    ctx.stroke();
    ringPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, c.scale * (isNext ? 2.6 : 1.7));
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (isNext) {
      // Rotating chevrons around the hoop.
      ctx.fillStyle = '#fff6cf';
      for (let k = 0; k < 6; k++) {
        const t = time * 1.4 + (k / 6) * Math.PI * 2;
        const p = project(
          ring.x + right.x * Math.cos(t) * R,
          ring.y + Math.sin(t) * R,
          ring.z + right.z * Math.cos(t) * R,
        );
        if (!p) continue;
        const s = Math.max(3, c.scale * 2.2);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.7, p.y + s * 0.6); ctx.lineTo(p.x - s * 0.7, p.y + s * 0.6);
        ctx.closePath(); ctx.fill();
      }
      const top = project(ring.x, ring.y + 260, ring.z);
      const bot = project(ring.x, 0, ring.z);
      if (top && bot) {
        ctx.strokeStyle = 'rgba(255,210,63,0.35)';
        ctx.lineWidth = Math.max(2, c.scale * 3);
        ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(12, c.scale * 7)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), c.x, c.y - c.scale * R - 8);
    }
  }
}

// Slalom gates: striped pylons + a translucent gate plane + number.
function drawGates(ctx, project, gates, nextIndex, time) {
  const ordered = gates
    .map((gate, i) => ({ gate, i, c: project(gate.x, gate.y, gate.z) }))
    .filter((e) => e.c)
    .sort((a, b) => b.c.depth - a.c.depth);
  for (const { gate, i, c } of ordered) {
    const rx = Math.cos(gate.heading), rz = Math.sin(gate.heading);
    for (const side of [-1, 1]) {
      drawPylon(ctx, project,
        gate.x + rx * side * gate.halfWidth, gate.ground,
        gate.z + rz * side * gate.halfWidth, gate.cap - gate.ground, time);
    }
    const isNext = i === nextIndex;
    const col = gate.done ? '61,220,132' : isNext ? '255,210,63' : '127,212,255';
    // Gate plane between the pylons, from ground to cap.
    const corners = [
      project(gate.x - rx * gate.halfWidth, gate.ground + 1, gate.z - rz * gate.halfWidth),
      project(gate.x + rx * gate.halfWidth, gate.ground + 1, gate.z + rz * gate.halfWidth),
      project(gate.x + rx * gate.halfWidth, gate.cap, gate.z + rz * gate.halfWidth),
      project(gate.x - rx * gate.halfWidth, gate.cap, gate.z - rz * gate.halfWidth),
    ];
    if (corners.every((p) => p)) {
      ctx.fillStyle = `rgba(${col},${gate.done ? 0.06 : isNext ? 0.2 : 0.1})`;
      ctx.strokeStyle = `rgba(${col},${isNext ? 0.9 : 0.5})`;
      ctx.lineWidth = Math.max(1.5, c.scale * 0.8);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let k = 1; k < 4; k++) ctx.lineTo(corners[k].x, corners[k].y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (isNext) {
      const top = project(gate.x, gate.cap + 200, gate.z);
      const bot = project(gate.x, gate.ground, gate.z);
      if (top && bot) {
        ctx.strokeStyle = 'rgba(255,210,63,0.3)';
        ctx.lineWidth = Math.max(2, c.scale * 2.4);
        ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      }
      ctx.fillStyle = COLORS.ringNext;
      ctx.font = `bold ${Math.max(12, c.scale * 6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), c.x, c.y - c.scale * 16);
    }
  }
}

// Cargo target: concentric glowing ground rings + beacon pillar + crate.
function drawCargo(ctx, project, state, time) {
  const t = state.cargoTarget;
  if (!t) return;
  const centre = project(t.x, t.y + 0.6, t.z);
  if (centre) {
    for (const [rr, col, alpha] of [[30, '255,210,63', 0.85], [20, '255,120,80', 0.9], [10, '255,210,63', 0.95]]) {
      ctx.beginPath();
      let started = false;
      for (let k = 0; k <= 28; k++) {
        const a = (k / 28) * Math.PI * 2;
        const p = project(t.x + Math.cos(a) * rr, t.y + 0.6, t.z + Math.sin(a) * rr);
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = `rgba(${col},${alpha})`;
      ctx.lineWidth = Math.max(2, centre.scale * 1.8);
      ctx.stroke();
    }
    const top = project(t.x, t.y + 240, t.z);
    if (top) {
      ctx.strokeStyle = `rgba(255,210,63,${0.25 + 0.12 * Math.sin(time * 2.4)})`;
      ctx.lineWidth = Math.max(2, centre.scale * 2.6);
      ctx.beginPath(); ctx.moveTo(centre.x, centre.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    }
  }
  const crate = state.crate;
  if (crate && crate.state !== 'loaded') {
    const p = project(crate.x, crate.y, crate.z);
    if (p) {
      const s = Math.max(3, p.scale * 2.4);
      ctx.fillStyle = '#a87c4f';
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.strokeStyle = '#6e5233';
      ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
      if (crate.state === 'falling') {
        // Little parachute canopy.
        ctx.fillStyle = '#e8762a';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - s * 1.5, s * 1.5, s * 0.55, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240,240,240,0.8)';
        ctx.beginPath();
        ctx.moveTo(p.x - s * 1.4, p.y - s * 1.5); ctx.lineTo(p.x, p.y - s * 0.4);
        ctx.moveTo(p.x + s * 1.4, p.y - s * 1.5); ctx.lineTo(p.x, p.y - s * 0.4);
        ctx.stroke();
      }
    }
  }
}

function drawClouds(ctx, project, clouds) {
  const visible = clouds
    .map((c) => ({ c, p: project(c.x, c.y, c.z) }))
    .filter((e) => e.p)
    .sort((a, b) => b.p.depth - a.p.depth);
  for (const { c, p } of visible) {
    const r = c.r * p.scale;
    if (r < 3) continue;
    // Shaded underside first, then bright tops offset up-left (sun side).
    for (const [ox, oy, s, fill] of [
      [0, 0.14, 1, 'rgba(176,196,216,0.85)'], [-0.55, 0.26, 0.7, 'rgba(176,196,216,0.85)'],
      [0.55, 0.24, 0.75, 'rgba(176,196,216,0.85)'],
      [0, 0, 1, 'rgba(255,255,255,0.88)'], [-0.55, 0.12, 0.7, 'rgba(255,255,255,0.88)'],
      [0.55, 0.1, 0.75, 'rgba(255,255,255,0.88)'], [0, -0.22, 0.62, 'rgba(255,255,255,0.92)'],
    ]) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(p.x + ox * r, p.y + oy * r * 0.5, r * s, r * s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- The Emberwing as a real projected polygon model --------------------
// Local axes: +X right, +Y up, -Z forward (nose at z=-4.4). Sections of a
// tapered fuselage, low wing with dihedral + red tips, tailplane + fin,
// glass canopy, prop disc + spinner, fixed gear. Painter-sorted per face.
function aircraftPolygons(a, time) {
  const polys = [];
  const add = (pts, fill, alpha = 1) => polys.push({ pts, fill, alpha });
  const sections = [
    { z: -4.4, r: 0.22 }, { z: -3.2, r: 0.5 }, { z: -1.2, r: 0.68 },
    { z: 0.6, r: 0.72 }, { z: 2.4, r: 0.5 }, { z: 4.0, r: 0.2 },
  ];
  const ringPt = (sec, k) => {
    const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
    return [Math.cos(ang) * sec.r * 0.92, Math.sin(ang) * sec.r, sec.z];
  };
  const bodyTop = '#f2ecdf', bodySide = '#ddd4c2', bodyLow = '#b9ae98';
  for (let i = 0; i < sections.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const fill = k === 0 ? bodyTop : k === 2 ? bodyLow : bodySide;
      add([ringPt(sections[i], k), ringPt(sections[i], k + 1), ringPt(sections[i + 1], k + 1), ringPt(sections[i + 1], k)], fill);
    }
  }
  // Nose cap so the spinner meets a closed cowling.
  add([ringPt(sections[0], 0), ringPt(sections[0], 1), ringPt(sections[0], 2), ringPt(sections[0], 3)], '#8f2b1a');
  // Racing stripe along the spine.
  for (let i = 0; i < sections.length - 1; i++) {
    const a0 = sections[i], a1 = sections[i + 1];
    add([[-0.09, a0.r * 0.98, a0.z], [0.09, a0.r * 0.98, a0.z], [0.09, a1.r * 0.98, a1.z], [-0.09, a1.r * 0.98, a1.z]], '#c8402a');
  }
  // Low wing with dihedral; red tips.
  const wing = (side) => {
    const root = [0.4 * side, -0.28, -0.9], rootB = [0.4 * side, -0.28, 0.75];
    const mid = [4.4 * side, 0.05, -0.75], midB = [4.4 * side, 0.05, 0.6];
    const tip = [7.6 * side, 0.42, -0.55], tipB = [7.6 * side, 0.42, 0.42];
    add([root, mid, midB, rootB], '#c8402a');
    add([mid, tip, tipB, midB], '#d94f33');
    add([rootB, midB, mid, root], '#8f2b1a'); // underside hint (drawn far-first anyway)
  };
  wing(1); wing(-1);
  // Tailplane + fin.
  add([[-2.3, 0.12, 3.3], [2.3, 0.12, 3.3], [1.9, 0.12, 4.25], [-1.9, 0.12, 4.25]], '#c8402a');
  add([[0, 0.15, 3.2], [0, 1.5, 3.9], [0, 0.15, 4.3]], '#c8402a');
  add([[0, 0.15, 3.2], [0, 0.15, 4.3], [0, 1.5, 3.9]], '#8f2b1a');
  // Canopy: glass hump + highlight.
  add([[-0.42, 0.45, -1.7], [0.42, 0.45, -1.7], [0.36, 0.95, -0.7], [-0.36, 0.95, -0.7]], '#2c5a80');
  add([[-0.36, 0.95, -0.7], [0.36, 0.95, -0.7], [0.3, 0.6, 0.5], [-0.3, 0.6, 0.5]], '#3a6f9c');
  add([[-0.3, 0.72, -1.5], [-0.05, 0.85, -1.0], [-0.05, 0.6, -0.8], [-0.3, 0.52, -1.2]], '#bfe4ff');
  // Fixed gear: legs + wheels.
  for (const side of [-1, 1]) {
    add([[0.5 * side, -0.5, -0.5], [0.85 * side, -1.25, -0.5], [0.95 * side, -1.25, -0.15], [0.6 * side, -0.5, -0.15]], '#3a3f46');
    const wx = 0.9 * side, wy = -1.45, wz = -0.3;
    const wheel = [];
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2;
      wheel.push([wx, wy + Math.sin(t) * 0.34, wz + Math.cos(t) * 0.34]);
    }
    add(wheel, '#22262c');
  }
  add([[0, -0.1, 3.9], [0.12, -0.55, 4.1], [-0.12, -0.55, 4.1]], '#3a3f46'); // tailwheel strut
  // Prop disc (blur) + spinner, spinning with throttle.
  const disc = [];
  for (let k = 0; k < 14; k++) {
    const t = (k / 14) * Math.PI * 2;
    disc.push([Math.cos(t) * 1.85, Math.sin(t) * 1.85, -4.55]);
  }
  add(disc, '#2a2e34', 0.16 + a.throttle * 0.2);
  const bladeAng = time * (6 + a.throttle * 30);
  for (const off of [0, Math.PI]) {
    const t = bladeAng + off;
    add([[0, 0, -4.6], [Math.cos(t) * 1.8, Math.sin(t) * 1.8, -4.6],
      [Math.cos(t + 0.16) * 1.8, Math.sin(t + 0.16) * 1.8, -4.6]], '#1d2026', 0.55);
  }
  add([[0, 0.22, -4.5], [0.2, -0.12, -4.5], [-0.2, -0.12, -4.5], [0, 0, -4.95]], '#8f2b1a');
  return polys;
}

function transformPoint(p, a) {
  let [x, y, z] = p;
  // Roll about the forward (Z) axis.
  const cr = Math.cos(a.roll), sr = Math.sin(a.roll);
  const x1 = x * cr - y * sr, y1 = x * sr + y * cr;
  // Pitch about X (positive pitch = nose up).
  const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
  const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
  // Yaw about Y (heading 0 = north = -Z).
  const ch = Math.cos(a.heading), sh = Math.sin(a.heading);
  const x3 = x1 * ch - z2 * sh, z3 = x1 * sh + z2 * ch;
  return [a.x + x3, a.y + y2, a.z + z3];
}

function drawAircraft3D(ctx, project, cam, a, time) {
  const polys = aircraftPolygons(a, time).map((poly) => {
    const world = poly.pts.map((p) => transformPoint(p, a));
    const depth = world.reduce((sum, p) => sum + Math.hypot(p[0] - cam.x, p[1] - cam.y, p[2] - cam.z), 0) / world.length;
    return { ...poly, world, depth };
  }).sort((p1, p2) => p2.depth - p1.depth);
  for (const poly of polys) {
    const ps = poly.world.map((p) => project(p[0], p[1], p[2]));
    if (ps.some((p) => !p)) continue;
    ctx.globalAlpha = poly.alpha;
    ctx.fillStyle = poly.fill;
    ctx.beginPath();
    ctx.moveTo(ps[0].x, ps[0].y);
    for (let i = 1; i < ps.length; i++) ctx.lineTo(ps[i].x, ps[i].y);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function renderScene(ctx, w, h, cam, state, time) {
  drawSky(ctx, w, h, cam);
  const project = projector(cam, w, h);
  drawSea(ctx, w, h, cam, project, time);
  drawTerrain(ctx, cam, project);
  drawRunway(ctx, project);
  if (state.scenery) drawScenery(ctx, project, cam, state.scenery, state.wind || { dir: 0, speed: 0 }, time);
  if (state.missionId === 'slalom') drawGates(ctx, project, state.gates, state.nextGate, time);
  else if (state.missionId === 'cargo') drawCargo(ctx, project, state, time);
  else drawRings(ctx, project, state.rings, state.nextRing, time);
  drawClouds(ctx, project, state.clouds);
  if (state.effects) drawEffects(ctx, project, state.effects);
  if (cam.mode === 'chase') drawAircraft3D(ctx, project, cam, state.plane, time);
  return project;
}

export { isOnRunway };
