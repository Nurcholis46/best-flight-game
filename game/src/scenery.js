// scenery.js — the island dressed: pine forests, a coastal village, a
// lighthouse, and airfield clutter (hangar, windsock, fuel drums).
// Everything is placed once with a seeded generator, so every flight sees
// the same island. Scenery is VISUAL ONLY: collision stays terrain-based
// (see aircraft.js) — flying through a tree costs nothing but pride.
// Drawn as projected polygons / billboards through the render projector,
// culled by distance, far items first.

import { terrainHeight, seededRandom, isOnRunway } from './world.js';

const HOUSE_COLORS = ['#e8dcc3', '#d9a05b', '#b7c9d9', '#e3b7a0', '#cfe0b8', '#f0e6ef'];
const ROOF_COLORS = ['#9c4a2f', '#7a3b2e', '#5d6d7e', '#8a5a33'];

export function buildScenery() {
  const rand = seededRandom(42);
  const trees = [];
  // Pine clusters on grassy slopes, kept off the runway and the village.
  for (let i = 0; i < 900 && trees.length < 240; i++) {
    const x = (rand() - 0.5) * 5200;
    const z = (rand() - 0.5) * 5200;
    const h = terrainHeight(x, z);
    if (h < 4 || h > 55) continue;
    if (isOnRunway(x, z)) continue;
    if (Math.abs(x) < 190 && Math.abs(z) < 760) continue; // airfield apron
    if (Math.abs(x) < 85 && Math.abs(z) < 1600) continue;  // approach corridor
    if (Math.hypot(x - 1150, z - 1150) < 260) continue;    // village clearing
    if (Math.hypot(x + 850, z - 780) < 130) continue;      // cargo meadow
    trees.push({ x, z, y: h, s: 0.8 + rand() * 0.9, tint: rand() });
  }
  // Village on the south-east coast: two loose rows of houses.
  const houses = [];
  for (let i = 0; i < 15; i++) {
    const x = 1020 + (i % 5) * 62 + (rand() - 0.5) * 22;
    const z = 1060 + Math.floor(i / 5) * 74 + (rand() - 0.5) * 22;
    houses.push({
      x, z, y: Math.max(1, terrainHeight(x, z)),
      w: 14 + rand() * 8, d: 12 + rand() * 6, h: 6 + rand() * 3,
      rot: (rand() - 0.5) * 0.5,
      wall: HOUSE_COLORS[i % HOUSE_COLORS.length],
      roof: ROOF_COLORS[i % ROOF_COLORS.length],
    });
  }
  return {
    trees, houses,
    lighthouse: { x: 1980, z: -820, y: Math.max(1, terrainHeight(1980, -820)) },
    hangar: { x: -120, z: 180, y: terrainHeight(-120, 180) },
    windsock: { x: 70, z: 320, y: terrainHeight(70, 320) },
    drums: [
      { x: -88, z: 240 }, { x: -82, z: 252 }, { x: -95, z: 254 }, { x: 64, z: -330 },
    ].map((d) => ({ ...d, y: terrainHeight(d.x, d.z) })),
    tower: { x: -95, z: -60, y: terrainHeight(-95, -60) },
  };
}

function poly(ctx, project, pts, fill) {
  const ps = pts.map((p) => project(p[0], p[1], p[2]));
  if (ps.some((p) => !p)) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(ps[0].x, ps[0].y);
  for (let i = 1; i < ps.length; i++) ctx.lineTo(ps[i].x, ps[i].y);
  ctx.closePath(); ctx.fill();
}

function drawTree(ctx, project, t) {
  const base = project(t.x, t.y, t.z);
  const top = project(t.x, t.y + 13 * t.s, t.z);
  if (!base || !top) return;
  const w = Math.max(1.5, 4.6 * t.s * base.scale);
  ctx.strokeStyle = '#5d4630';
  ctx.lineWidth = Math.max(1, 0.5 * base.scale);
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(base.x, base.y - (base.y - top.y) * 0.25); ctx.stroke();
  const greens = ['#2e6b34', '#35793d', '#2a6130'];
  for (let tier = 0; tier < 3; tier++) {
    const f0 = 0.18 + tier * 0.26, f1 = f0 + 0.42;
    const y0 = base.y - (base.y - top.y) * f0;
    const y1 = base.y - (base.y - top.y) * f1;
    const ww = w * (1 - tier * 0.26);
    ctx.fillStyle = greens[(tier + (t.tint > 0.5 ? 1 : 0)) % 3];
    ctx.beginPath();
    ctx.moveTo(base.x - ww, y0); ctx.lineTo(base.x + ww, y0); ctx.lineTo(base.x, y1);
    ctx.closePath(); ctx.fill();
  }
}

function drawHouse(ctx, project, hs) {
  const c = Math.cos(hs.rot), s = Math.sin(hs.rot);
  const corner = (lx, ly, lz) => [hs.x + lx * c - lz * s, hs.y + ly, hs.z + lx * s + lz * c];
  const w = hs.w / 2, d = hs.d / 2, h = hs.h;
  // Walls (two visible faces are enough at this scale, painter order).
  poly(ctx, project, [corner(-w, 0, d), corner(w, 0, d), corner(w, h, d), corner(-w, h, d)], hs.wall);
  poly(ctx, project, [corner(w, 0, d), corner(w, 0, -d), corner(w, h, -d), corner(w, h, d)], shade(hs.wall, 0.8));
  poly(ctx, project, [corner(-w, 0, -d), corner(-w, 0, d), corner(-w, h, d), corner(-w, h, -d)], shade(hs.wall, 0.9));
  // Prism roof.
  poly(ctx, project, [corner(-w - 1, h, d + 1), corner(w + 1, h, d + 1), corner(0, h + 3.4, 0)], hs.roof);
  poly(ctx, project, [corner(w + 1, h, -d - 1), corner(-w - 1, h, -d - 1), corner(0, h + 3.4, 0)], shade(hs.roof, 0.75));
  poly(ctx, project, [corner(-w - 1, h, -d - 1), corner(-w - 1, h, d + 1), corner(0, h + 3.4, 0)], shade(hs.roof, 0.88));
  poly(ctx, project, [corner(w + 1, h, d + 1), corner(w + 1, h, -d - 1), corner(0, h + 3.4, 0)], shade(hs.roof, 0.95));
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function drawLighthouse(ctx, project, lh, time) {
  const H = 34, R = 4.2;
  const bands = ['#e8e4da', '#c8402a', '#e8e4da', '#c8402a', '#e8e4da'];
  for (let i = 0; i < 5; i++) {
    const y0 = lh.y + (H / 5) * i, y1 = lh.y + (H / 5) * (i + 1);
    const r0 = R * (1 - i * 0.07), r1 = R * (1 - (i + 1) * 0.07);
    poly(ctx, project, [
      [lh.x - r0, y0, lh.z], [lh.x + r0, y0, lh.z], [lh.x + r1, y1, lh.z], [lh.x - r1, y1, lh.z],
    ], bands[i]);
    poly(ctx, project, [
      [lh.x, y0, lh.z - r0], [lh.x, y0, lh.z + r0], [lh.x, y1, lh.z + r1], [lh.x, y1, lh.z - r1],
    ], shade(bands[i], 0.78));
  }
  const lamp = project(lh.x, lh.y + H + 2.5, lh.z);
  if (lamp) {
    const blink = 0.55 + 0.45 * Math.sin(time * 1.6);
    ctx.fillStyle = `rgba(255,240,170,${blink.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, Math.max(2, lamp.scale * 2.2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c2f36';
    ctx.fillRect(lamp.x - lamp.scale * 2, lamp.y - lamp.scale * 4.6, lamp.scale * 4, lamp.scale * 1.8);
  }
}

function drawHangar(ctx, project, hg) {
  const w = 26, d = 20, h = 9;
  poly(ctx, project, [[hg.x - w, hg.y, hg.z + d], [hg.x + w, hg.y, hg.z + d], [hg.x + w, hg.y + h, hg.z + d], [hg.x - w, hg.y + h, hg.z + d]], '#7d8a96');
  poly(ctx, project, [[hg.x + w, hg.y, hg.z + d], [hg.x + w, hg.y, hg.z - d], [hg.x + w, hg.y + h, hg.z - d], [hg.x + w, hg.y + h, hg.z + d]], '#687684');
  poly(ctx, project, [[hg.x - w - 2, hg.y + h, hg.z + d + 2], [hg.x + w + 2, hg.y + h, hg.z + d + 2], [hg.x + w + 2, hg.y + h + 5, hg.z], [hg.x - w - 2, hg.y + h + 5, hg.z]], '#4d5a68');
  poly(ctx, project, [[hg.x - w - 2, hg.y + h + 5, hg.z], [hg.x + w + 2, hg.y + h + 5, hg.z], [hg.x + w + 2, hg.y + h, hg.z - d - 2], [hg.x - w - 2, hg.y + h, hg.z - d - 2]], '#5d6c7c');
  // Big door facing the strip.
  poly(ctx, project, [[hg.x + w - 0.2, hg.y + 0.3, hg.z + 12], [hg.x + w - 0.2, hg.y + 0.3, hg.z - 12], [hg.x + w - 0.2, hg.y + 7.5, hg.z - 12], [hg.x + w - 0.2, hg.y + 7.5, hg.z + 12]], '#39434f');
}

function drawWindsock(ctx, project, ws, wind, time) {
  const top = project(ws.x, ws.y + 9, ws.z);
  const base = project(ws.x, ws.y, ws.z);
  if (!top || !base) return;
  ctx.strokeStyle = '#d8dde2';
  ctx.lineWidth = Math.max(1, base.scale * 0.35);
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
  // Sock streams downwind with a lazy flap.
  const flap = Math.sin(time * 3.1) * 0.12;
  const dirx = Math.sin(wind.dir + flap), dirz = -Math.cos(wind.dir + flap);
  const tip = project(ws.x + dirx * 5.2, ws.y + 8.6 - Math.max(0, 4 - wind.speed) * 0.35, ws.z + dirz * 5.2);
  if (!tip) return;
  const mid = project(ws.x + dirx * 2.6, ws.y + 8.8, ws.z + dirz * 2.6);
  ctx.fillStyle = '#e8762a';
  ctx.beginPath();
  ctx.moveTo(top.x, top.y - top.scale * 0.8);
  if (mid) ctx.lineTo(mid.x, mid.y - top.scale * 0.45);
  ctx.lineTo(tip.x, tip.y);
  if (mid) ctx.lineTo(mid.x, mid.y + top.scale * 0.45);
  ctx.lineTo(top.x, top.y + top.scale * 0.8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f5f2ea';
  if (mid) { ctx.beginPath(); ctx.arc(mid.x, mid.y, Math.max(1, top.scale * 0.5), 0, Math.PI * 2); ctx.fill(); }
}

// Slalom pylons: striped poles with a small flag, drawn by render.js via
// this helper so gate art lives with the rest of the scenery.
export function drawPylon(ctx, project, x, y, z, height, time) {
  const base = project(x, y, z);
  const top = project(x, y + height, z);
  if (!base || !top) return;
  const w = Math.max(1.6, base.scale * 1.5);
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const y0 = base.y - (base.y - top.y) * (i / bands);
    const y1 = base.y - (base.y - top.y) * ((i + 1) / bands);
    ctx.fillStyle = i % 2 ? '#f5f2ea' : '#d23b2a';
    ctx.fillRect(base.x - w / 2, y1, w, Math.max(1, y0 - y1));
  }
  const flap = Math.sin(time * 4 + x) * 2;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(top.x + w * 2.2, top.y + flap * 0.3);
  ctx.lineTo(top.x, top.y + w * 1.1);
  ctx.closePath(); ctx.fill();
}

export function drawScenery(ctx, project, cam, scenery, wind, time) {
  const items = [];
  const add = (x, z, kind, ref) => {
    const d = Math.hypot(x - cam.x, z - cam.z);
    if (d < 2800) items.push({ d, kind, ref });
  };
  for (const t of scenery.trees) add(t.x, t.z, 'tree', t);
  for (const hs of scenery.houses) add(hs.x, hs.z, 'house', hs);
  add(scenery.lighthouse.x, scenery.lighthouse.z, 'lighthouse', scenery.lighthouse);
  add(scenery.hangar.x, scenery.hangar.z, 'hangar', scenery.hangar);
  add(scenery.tower.x, scenery.tower.z, 'tower', scenery.tower);
  items.sort((a, b) => b.d - a.d);
  for (const it of items) {
    if (it.kind === 'tree') drawTree(ctx, project, it.ref);
    else if (it.kind === 'house') drawHouse(ctx, project, it.ref);
    else if (it.kind === 'lighthouse') drawLighthouse(ctx, project, it.ref, time);
    else if (it.kind === 'hangar') drawHangar(ctx, project, it.ref);
    else if (it.kind === 'tower') {
      const t = it.ref;
      poly(ctx, project, [[t.x - 4, t.y, t.z + 4], [t.x + 4, t.y, t.z + 4], [t.x + 4, t.y + 13, t.z + 4], [t.x - 4, t.y + 13, t.z + 4]], '#aab4be');
      poly(ctx, project, [[t.x - 5.5, t.y + 13, t.z + 5.5], [t.x + 5.5, t.y + 13, t.z + 5.5], [t.x + 5.5, t.y + 16.5, t.z + 5.5], [t.x - 5.5, t.y + 16.5, t.z + 5.5]], '#274b6d');
      poly(ctx, project, [[t.x + 4, t.y, t.z + 4], [t.x + 4, t.y, t.z - 4], [t.x + 4, t.y + 13, t.z - 4], [t.x + 4, t.y + 13, t.z + 4]], '#8f9aa6');
    }
  }
  // Fuel drums: little billboard barrels near the hangar.
  for (const d of scenery.drums) {
    const p = project(d.x, d.y + 1.1, d.z);
    if (!p) continue;
    const w = Math.max(1.5, p.scale * 1.1), hgt = Math.max(2, p.scale * 2.2);
    ctx.fillStyle = '#b03a2a';
    ctx.fillRect(p.x - w / 2, p.y - hgt / 2, w, hgt);
    ctx.fillStyle = '#d8dde2';
    ctx.fillRect(p.x - w / 2, p.y - hgt * 0.12, w, Math.max(1, hgt * 0.16));
  }
  drawWindsock(ctx, project, scenery.windsock, wind, time);
}
