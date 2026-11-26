// render.js — a small software-3D renderer on a 2D canvas.
// The world is drawn with a painter's algorithm: sky, sea, terrain mesh,
// runway, rings, clouds, then the aircraft itself in chase view. Camera
// maths is plain vectors, so the game needs no engine and no assets.

import { COLORS, WORLD } from './config.js';
import { terrainHeight, terrainColor, isOnRunway } from './world.js';

const FOV = 1.15; // focal scale relative to canvas height

export function makeCamera() {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, mode: 'chase' };
}

// Follow the aircraft: chase view sits behind and above, cockpit view
// sits in the pilot's seat and rolls fully with the plane.
export function updateCamera(cam, a, dt) {
  const ease = 1 - Math.pow(0.0015, dt);
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
  let dyaw = a.heading - cam.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  cam.yaw += dyaw * ease;
  cam.pitch += ((a.pitch * 0.55) - cam.pitch) * ease;
  cam.roll += ((a.roll * 0.35) - cam.roll) * ease;
}

function projector(cam, w, h) {
  const cy = Math.cos(-cam.yaw), sy = Math.sin(-cam.yaw);
  const cp = Math.cos(-cam.pitch), sp = Math.sin(-cam.pitch);
  const cr = Math.cos(-cam.roll), sr = Math.sin(-cam.roll);
  const focal = h * FOV;
  return (x, y, z) => {
    let dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    // yaw around Y (north = -Z)
    let x1 = dx * cy - dz * sy;
    let z1 = dx * sy + dz * cy;
    // pitch around X
    let y2 = dy * cp - z1 * sp;
    let z2 = dy * sp + z1 * cp;
    // roll around Z
    let x3 = x1 * cr - y2 * sr;
    let y3 = x1 * sr + y2 * cr;
    if (z2 > -0.5) return null; // behind the camera
    const s = focal / -z2;
    return { x: w / 2 + x3 * s, y: h / 2 - y3 * s, depth: -z2, scale: s };
  };
}

function drawSky(ctx, w, h, cam) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, COLORS.skyTop);
  grad.addColorStop(0.45, COLORS.skyMid);
  grad.addColorStop(0.72, COLORS.skyLow);
  grad.addColorStop(1, '#e8f4fb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Sun: fixed in the south-west sky, drawn where the camera points.
  const project = projector(cam, w, h);
  const sun = project(cam.x - 4000, cam.y + 2600, cam.z + 5200);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.25, 'rgba(255,236,170,0.45)');
    glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 130, sun.y - 130, 260, 260);
    ctx.fillStyle = COLORS.sun;
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 17, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSea(ctx, w, h, cam, project) {
  // One huge quad at sea level; the terrain mesh paints the island over it.
  const R = 9000;
  const pts = [
    project(cam.x - R, 0, cam.z - R), project(cam.x + R, 0, cam.z - R),
    project(cam.x + R, 0, cam.z + R), project(cam.x - R, 0, cam.z + R),
  ];
  if (pts.some((p) => !p)) {
    // Fallback: horizon band below screen centre when a corner is behind us.
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(0, h * 0.52, w, h * 0.48);
    return;
  }
  ctx.fillStyle = COLORS.sea;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fill();
}

function drawTerrain(ctx, cam, project) {
  // Two grids: a fine one near the camera so the foreground never has
  // holes where quads straddle the near plane, a coarse one to the horizon.
  const quads = [];
  const collect = (step, R, skipInner) => {
    const cx = Math.round(cam.x / step) * step;
    const cz = Math.round(cam.z / step) * step;
    for (let gz = cz - R; gz < cz + R; gz += step) {
      for (let gx = cx - R; gx < cx + R; gx += step) {
        if (skipInner && Math.hypot(gx + step / 2 - cam.x, gz + step / 2 - cam.z) < skipInner) continue;
        const h00 = terrainHeight(gx, gz), h10 = terrainHeight(gx + step, gz);
        const h01 = terrainHeight(gx, gz + step), h11 = terrainHeight(gx + step, gz + step);
        const p00 = project(gx, h00, gz), p10 = project(gx + step, h10, gz);
        const p01 = project(gx, h01, gz + step), p11 = project(gx + step, h11, gz + step);
        if (!p00 || !p10 || !p01 || !p11) continue;
        const avgH = (h00 + h10 + h01 + h11) / 4;
        if (avgH <= 0.3) continue; // sea already drawn
        const slope = Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00)) / step;
        const depth = (p00.depth + p11.depth) / 2;
        // Deterministic per-cell shade so the mesh reads as land, not tiles.
        const hash = ((gx * 73856093) ^ (gz * 19349663)) >>> 0;
        const shade = 0.9 + (hash % 100) / 100 * 0.2 - slope * 0.25;
        quads.push({ p00, p10, p11, p01, color: terrainColor(avgH, slope), depth, avgH, shade });
      }
    }
  };
  collect(96, 2112, 430);
  collect(32, 448, 0);
  quads.sort((a, b) => b.depth - a.depth);
  for (const q of quads) {
    ctx.fillStyle = shadeColor(q.color, q.shade);
    ctx.beginPath();
    ctx.moveTo(q.p00.x, q.p00.y);
    ctx.lineTo(q.p10.x, q.p10.y);
    ctx.lineTo(q.p11.x, q.p11.y);
    ctx.lineTo(q.p01.x, q.p01.y);
    ctx.closePath(); ctx.fill();
  }
}

// Multiply a #rrggbb colour by a brightness factor.
function shadeColor(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function drawRunway(ctx, project) {
  const r = WORLD.runway;
  const y = terrainHeight(r.x, r.z) + 0.4;
  // Drawn in segments so the parts behind the camera cull cleanly instead
  // of taking the whole strip with them.
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
  // Centreline dashes and edge lights.
  ctx.fillStyle = COLORS.runwayLine;
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

function drawRings(ctx, project, rings, nextIndex, time) {
  // Far rings first so the near one paints over them.
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
    ctx.beginPath();
    let started = false;
    for (let k = 0; k <= 28; k++) {
      const t = (k / 28) * Math.PI * 2;
      const px = ring.x + right.x * Math.cos(t) * R;
      const pz = ring.z + right.z * Math.cos(t) * R;
      const py = ring.y + Math.sin(t) * R;
      const p = project(px, py, pz);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, c.scale * (isNext ? 2.6 : 1.7));
    ctx.globalAlpha = ring.done ? 0.35 : 0.95;
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (isNext) {
      // Light pillar so the target reads from kilometres away.
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

function drawClouds(ctx, project, clouds) {
  const visible = clouds
    .map((c) => ({ c, p: project(c.x, c.y, c.z) }))
    .filter((e) => e.p)
    .sort((a, b) => b.p.depth - a.p.depth);
  for (const { c, p } of visible) {
    const r = c.r * p.scale;
    if (r < 3) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (const [ox, oy, s] of [[0, 0, 1], [-0.55, 0.12, 0.7], [0.55, 0.1, 0.75], [0, -0.22, 0.62]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * r, p.y + oy * r * 0.5, r * s, r * s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The Emberwing seen from behind-above in chase view: tapered fuselage
// (nose up-screen), low wing that banks with the plane, tail feathers,
// canopy and a blurred propeller disc at the nose.
function drawAircraftChase(ctx, w, h, a, time) {
  const cx = w / 2;
  const cy = h * 0.56 + Math.sin(a.pitch) * h * 0.06;
  const bank = a.roll;
  const size = Math.min(w, h) * 0.17;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bank);
  // Main wing with a hint of dihedral.
  ctx.fillStyle = '#c8402a';
  ctx.beginPath();
  ctx.moveTo(-size * 1.6, -size * 0.02);
  ctx.lineTo(-size * 0.3, size * 0.1);
  ctx.lineTo(size * 0.3, size * 0.1);
  ctx.lineTo(size * 1.6, -size * 0.02);
  ctx.lineTo(size * 1.45, size * 0.2);
  ctx.lineTo(-size * 1.45, size * 0.2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8f2b1a';
  ctx.fillRect(-size * 1.6, -size * 0.02, size * 0.16, size * 0.22);
  ctx.fillRect(size * 1.44, -size * 0.02, size * 0.16, size * 0.22);
  // Fuselage: narrow nose, wide cockpit, tapered tail.
  const body = ctx.createLinearGradient(-size * 0.3, 0, size * 0.3, 0);
  body.addColorStop(0, '#a8a294');
  body.addColorStop(0.5, '#ece7db');
  body.addColorStop(1, '#a8a294');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.62);
  ctx.bezierCurveTo(size * 0.2, -size * 0.5, size * 0.34, -size * 0.18, size * 0.32, size * 0.12);
  ctx.bezierCurveTo(size * 0.3, size * 0.38, size * 0.14, size * 0.58, 0, size * 0.66);
  ctx.bezierCurveTo(-size * 0.14, size * 0.58, -size * 0.3, size * 0.38, -size * 0.32, size * 0.12);
  ctx.bezierCurveTo(-size * 0.34, -size * 0.18, -size * 0.2, -size * 0.5, 0, -size * 0.62);
  ctx.closePath(); ctx.fill();
  // Racing stripe down the spine.
  ctx.fillStyle = '#c8402a';
  ctx.fillRect(-size * 0.045, -size * 0.5, size * 0.09, size * 1.05);
  // Canopy.
  ctx.fillStyle = '#274b6d';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.12, size * 0.17, size * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,225,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.05, -size * 0.17, size * 0.06, size * 0.11, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Tailplane and fin.
  ctx.fillStyle = '#c8402a';
  ctx.beginPath();
  ctx.moveTo(-size * 0.58, size * 0.52);
  ctx.lineTo(size * 0.58, size * 0.52);
  ctx.lineTo(size * 0.48, size * 0.64);
  ctx.lineTo(-size * 0.48, size * 0.64);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8f2b1a';
  ctx.beginPath();
  ctx.moveTo(-size * 0.05, size * 0.64);
  ctx.lineTo(size * 0.05, size * 0.64);
  ctx.lineTo(size * 0.03, size * 0.3);
  ctx.lineTo(-size * 0.03, size * 0.3);
  ctx.closePath(); ctx.fill();
  // Propeller blur disc at the nose.
  ctx.strokeStyle = 'rgba(30,30,34,0.3)';
  ctx.lineWidth = size * 0.05;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.62, size * 0.5, size * 0.07, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#3a3f46';
  ctx.beginPath(); ctx.arc(0, -size * 0.62, size * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Exhaust shimmer when the engine works hard.
  if (a.throttle > 0.5 && a.airborne) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const wob = Math.sin(time * 40) * 2;
    ctx.beginPath();
    ctx.ellipse(cx + wob, cy + size * 0.72, size * 0.11, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function renderScene(ctx, w, h, cam, state, time) {
  drawSky(ctx, w, h, cam);
  const project = projector(cam, w, h);
  drawSea(ctx, w, h, cam, project);
  drawTerrain(ctx, cam, project);
  drawRunway(ctx, project);
  drawRings(ctx, project, state.rings, state.nextRing, time);
  drawClouds(ctx, project, state.clouds);
  if (cam.mode === 'chase') drawAircraftChase(ctx, w, h, state.plane, time);
  return project;
}

export { isOnRunway };
