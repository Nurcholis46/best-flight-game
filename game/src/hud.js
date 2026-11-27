// hud.js — instruments and screens.
// Chase view gets a slim HUD; cockpit view gets a full dashboard with lit
// gauges. Both always show altitude, speed and heading, plus throttle,
// fuel, hull, score, the clock, vertical speed, wind, the combo meter, the
// mission objective and a minimap of the island.

import { COLORS, PLANE, WORLD } from './config.js';
import { headingDegrees, speedKnots, altitudeAboveGround } from './aircraft.js';
import { terrainHeight } from './world.js';
import { MISSIONS } from './missions.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.panel;
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill(); ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 3);
}

function compassTape(ctx, cx, y, headingDeg) {
  const width = 300, pxPerDeg = 2.4;
  panel(ctx, cx - width / 2, y, width, 30);
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - width / 2 + 4, y + 2, width - 8, 26); ctx.clip();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -70; d <= 70; d += 10) {
    const deg = ((Math.round(headingDeg / 10) * 10 + d) % 360 + 360) % 360;
    const x = cx + (deg - headingDeg + (deg - headingDeg > 180 ? -360 : deg - headingDeg < -180 ? 360 : 0)) * pxPerDeg;
    const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg / 10).padStart(2, '0');
    ctx.fillStyle = deg % 90 === 0 ? COLORS.hudAccent : COLORS.hud;
    ctx.fillText(label, x, y + 20);
    ctx.fillRect(x - 0.5, y + 23, 1, 5);
  }
  ctx.restore();
  ctx.fillStyle = COLORS.hudAccent;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + 30); ctx.lineTo(cx + 6, y + 30); ctx.lineTo(cx, y + 22);
  ctx.closePath(); ctx.fill();
}

function artificialHorizon(ctx, cx, cy, r, pitch, roll) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const off = pitch * r * 1.4;
  ctx.fillStyle = '#3f7fc4';
  ctx.fillRect(-r * 1.6, -r * 1.6 + off, r * 3.2, r * 1.6);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r * 1.6, off, r * 3.2, r * 1.6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 1.6, off - 1, r * 3.2, 2);
  ctx.restore();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = COLORS.hudAccent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy); ctx.lineTo(cx - r * 0.18, cy);
  ctx.lineTo(cx, cy + r * 0.12); ctx.lineTo(cx + r * 0.18, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function gauge(ctx, cx, cy, r, frac, label, valueText, danger) {
  ctx.fillStyle = '#101c2e';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = danger ? COLORS.danger : COLORS.panelEdge;
  ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const t = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.strokeStyle = 'rgba(160,220,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(t) * r * 0.78, cy + Math.sin(t) * r * 0.78);
    ctx.lineTo(cx + Math.cos(t) * r * 0.92, cy + Math.sin(t) * r * 0.92);
    ctx.stroke();
  }
  const t = Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
  ctx.strokeStyle = danger ? COLORS.danger : COLORS.hudAccent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(t) * r * 0.8, cy + Math.sin(t) * r * 0.8);
  ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(valueText, cx, cy + r * 0.55);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(label, cx, cy + r * 0.78);
}

// Cockpit dashboard: dark panel across the bottom with lit round gauges.
function drawDashboard(ctx, w, h, a) {
  const dashH = Math.min(210, h * 0.3);
  const y0 = h - dashH;
  ctx.fillStyle = '#141a24';
  ctx.fillRect(0, y0, w, dashH);
  ctx.fillStyle = '#1d2635';
  ctx.fillRect(0, y0, w, 10);
  ctx.strokeStyle = 'rgba(160,210,255,0.25)';
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
  const shade = ctx.createLinearGradient(0, y0 - 60, 0, y0);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, y0 - 60, w, 60);
  const cy = y0 + dashH * 0.55;
  const r = Math.min(64, dashH * 0.36);
  const altFt = Math.round(a.y * 3.281);
  const spd = Math.round(speedKnots(a));
  gauge(ctx, w * 0.16, cy, r, spd / 220, 'AIRSPEED KT', String(spd), a.stall);
  artificialHorizon(ctx, w * 0.38, cy, r, a.pitch, a.roll);
  gauge(ctx, w * 0.60, cy, r, (a.y % 1000) / 1000, 'ALTITUDE FT', String(altFt), false);
  gauge(ctx, w * 0.78, cy, r * 0.78, a.fuel / PLANE.fuelCapacity, 'FUEL', `${Math.round(a.fuel)}`, a.fuel < 18);
  const tx = w * 0.90, ty = y0 + 26, th = dashH - 52;
  ctx.fillStyle = '#0c1420';
  ctx.fillRect(tx, ty, 26, th);
  ctx.strokeStyle = COLORS.panelEdge; ctx.strokeRect(tx, ty, 26, th);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.fillRect(tx + 3, ty + th * (1 - a.throttle) - 5, 20, 10);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', tx + 13, ty + th + 12);
  const lamps = [
    ['STALL', a.stall], ['FUEL', a.fuel < 18], ['GEAR', !a.airborne],
  ];
  lamps.forEach(([label, on], i) => {
    const lx = w * 0.44 + i * 52, ly = y0 + 20;
    ctx.fillStyle = on ? (label === 'GEAR' ? '#3ddc84' : COLORS.danger) : '#243144';
    ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '8px system-ui, sans-serif';
    ctx.fillText(label, lx, ly + 20);
  });
}

// Minimap land mask, computed once from the same heightfield.
let mapCache = null;
function minimapLand() {
  if (mapCache) return mapCache;
  const N = 36, RANGE = 3400;
  const cells = [];
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const x = -RANGE + (ix / (N - 1)) * RANGE * 2;
      const z = -RANGE + (iz / (N - 1)) * RANGE * 2;
      cells.push({ ix, iz, h: terrainHeight(x, z) });
    }
  }
  mapCache = { cells, N, RANGE };
  return mapCache;
}

function drawMinimap(ctx, x, y, size, state) {
  panel(ctx, x, y, size, size);
  const { cells, N, RANGE } = minimapLand();
  const cell = size / N;
  for (const c of cells) {
    if (c.h <= 0.3) continue;
    ctx.fillStyle = c.h > 70 ? '#c9cdd2' : c.h > 30 ? '#4c8a52' : '#6db06a';
    ctx.fillRect(x + c.ix * cell, y + c.iz * cell, cell + 0.5, cell + 0.5);
  }
  const toMap = (wx, wz) => [
    x + ((wx + RANGE) / (RANGE * 2)) * size,
    y + ((wz + RANGE) / (RANGE * 2)) * size,
  ];
  // Runway.
  const [rx0, rz0] = toMap(WORLD.runway.x, WORLD.runway.z - WORLD.runway.length / 2);
  const [rx1, rz1] = toMap(WORLD.runway.x, WORLD.runway.z + WORLD.runway.length / 2);
  ctx.strokeStyle = '#e8e4da';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(rx0, rz0); ctx.lineTo(rx1, rz1); ctx.stroke();
  ctx.lineWidth = 1;
  // Objectives.
  const dot = (wx, wz, col, r = 2.6) => {
    const [mx, mz] = toMap(wx, wz);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
  };
  if (state.missionId === 'slalom') {
    state.gates.forEach((g, i) => dot(g.x, g.z, g.done ? '#3ddc84' : i === state.nextGate ? '#ffd23f' : '#7fd4ff'));
  } else if (state.missionId === 'cargo') {
    const [mx, mz] = toMap(state.cargoTarget.x, state.cargoTarget.z);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 7, mz); ctx.lineTo(mx + 7, mz); ctx.moveTo(mx, mz - 7); ctx.lineTo(mx, mz + 7); ctx.stroke();
    ctx.lineWidth = 1;
    if (state.crate && state.crate.state !== 'loaded') dot(state.crate.x, state.crate.z, '#ffb27f', 2.2);
  } else {
    state.rings.forEach((r, i) => dot(r.x, r.z, r.done ? '#3ddc84' : i === state.nextRing ? '#ffd23f' : '#7fd4ff'));
  }
  // Plane arrow (heading 0 = north = up on the map).
  const a = state.plane;
  const [px, pz] = toMap(a.x, a.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(a.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MAP · N↑', x + 5, y + 11);
}

function missionOf(state) {
  return MISSIONS.find((m) => m.id === state.missionId) || MISSIONS[0];
}

function objectiveLine(state) {
  if (state.missionId === 'slalom') {
    return state.nextGate >= state.gates.length
      ? 'All gates! Land on the strip for the bonus'
      : `Gate ${state.nextGate + 1} of ${state.gates.length} — stay low, between the pylons`;
  }
  if (state.missionId === 'cargo') {
    if (state.crate.state === 'loaded') return 'Fly to the glowing target, SPACE to drop the crate';
    if (state.crate.state === 'falling') return 'Crate away…';
    return `Crate down (${state.crate.dist} m out) — now land on the strip`;
  }
  return state.nextRing >= state.rings.length
    ? 'All rings! Land on the strip for the bonus'
    : `Ring ${state.nextRing + 1} of ${state.rings.length} — follow the gold pillar`;
}

export function drawHud(ctx, w, h, state) {
  const a = state.plane;
  const cockpit = state.cameraMode === 'cockpit';
  compassTape(ctx, w / 2, 12, headingDegrees(a));

  // Left cluster: altitude / speed / vertical speed / wind.
  panel(ctx, 12, 12, 208, cockpit ? 96 : 152);
  ctx.fillStyle = COLORS.hud;
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${Math.round(a.y * 3.281)} ft`, 22, 40);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(`ALT · AGL ${Math.round(altitudeAboveGround(a) * 3.281)} ft`, 22, 56);
  ctx.fillStyle = a.stall ? COLORS.danger : COLORS.hud;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${Math.round(speedKnots(a))} kt`, 22, 82);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(a.stall ? 'STALL — NOSE DOWN!' : 'AIRSPEED', 22, 98);
  const vsFpm = Math.round(a.vy * 196.85);
  ctx.fillStyle = vsFpm < -900 ? COLORS.danger : COLORS.hud;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`${vsFpm >= 0 ? '+' : ''}${vsFpm} fpm`, 120, 40);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('VERT SPEED', 120, 56);
  // Wind arrow (direction the wind blows toward, relative to the nose).
  const wind = state.wind || { dir: 0, speed: 0 };
  ctx.fillText(`WIND ${Math.round(wind.speed * 1.944)} kt`, 120, 74);
  const rel = wind.dir - a.heading;
  ctx.save();
  ctx.translate(196, 66);
  ctx.rotate(rel);
  ctx.fillStyle = '#7fd4ff';
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(4.5, 6); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  if (!cockpit) {
    bar(ctx, 22, 116, 176, 8, a.throttle, COLORS.hudAccent, 'THROTTLE');
    bar(ctx, 22, 140, 176, 8, a.fuel / PLANE.fuelCapacity, a.fuel < 18 ? COLORS.danger : '#3ddc84', 'FUEL');
  }

  // Right cluster: mission, score, clock, combo, hull.
  panel(ctx, w - 208, 12, 196, 146);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(missionOf(state).name.toUpperCase(), w - 198, 32);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${state.score}`, w - 198, 58);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('SCORE', w - 198, 74);
  const t = Math.max(0, state.timeLeft);
  ctx.fillStyle = t < 20 ? COLORS.danger : COLORS.hud;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, w - 110, 58);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('TIME', w - 110, 74);
  // Combo meter.
  const combo = state.combo || { mult: 1, timer: 0 };
  ctx.fillStyle = combo.mult > 1 ? COLORS.hudAccent : COLORS.hudDim;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`COMBO x${combo.mult}`, w - 198, 96);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(w - 110, 88, 88, 7);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.fillRect(w - 110, 88, 88 * Math.max(0, Math.min(1, combo.timer / 12)), 7);
  bar(ctx, w - 198, 120, 170, 8, a.hull / 100, a.hull < 35 ? COLORS.danger : '#7fd4ff', 'HULL');
  if (cockpit) bar(ctx, w - 198, 142, 170, 8, a.fuel / PLANE.fuelCapacity, a.fuel < 18 ? COLORS.danger : '#3ddc84', 'FUEL');

  // Objective line under the compass.
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hud;
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6;
  ctx.fillText(objectiveLine(state), w / 2, 62);
  ctx.shadowBlur = 0;

  if (cockpit) drawDashboard(ctx, w, h, a);
  else {
    artificialHorizon(ctx, w - 64, h - 64, 46, a.pitch, a.roll);
    drawMinimap(ctx, 12, h - 162, 150, state);
  }
  if (cockpit) drawMinimap(ctx, 12, 122, 130, state);

  // Next-objective direction arrow when it is off-view.
  if (state.ringScreen && !state.ringScreen.onScreen && state.phase === 'play') {
    const ang = Math.atan2(state.ringScreen.y - h / 2, state.ringScreen.x - w / 2);
    const ax = w / 2 + Math.cos(ang) * 90, ay = h / 2 + Math.sin(ang) * 90;
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = COLORS.hudAccent;
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Centre reticle.
  ctx.strokeStyle = 'rgba(234,246,255,0.55)';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 10, 0, Math.PI * 2);
  ctx.moveTo(w / 2 - 18, h / 2); ctx.lineTo(w / 2 - 12, h / 2);
  ctx.moveTo(w / 2 + 12, h / 2); ctx.lineTo(w / 2 + 18, h / 2);
  ctx.stroke();

  if (state.message) {
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudAccent;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
    ctx.fillText(state.message, w / 2, h * 0.24);
    ctx.shadowBlur = 0;
  }
}

export function drawTitle(ctx, w, h, state) {
  ctx.fillStyle = 'rgba(6,12,24,0.34)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('EMBERWING', w / 2, h * 0.24);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('R I N G   R U N', w / 2, h * 0.24 + 40);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('Three sorties over one little island. Mind the fuel, land gently.', w / 2, h * 0.24 + 72);
  // Mission select.
  const listY = h * 0.42;
  MISSIONS.forEach((m, i) => {
    const selected = state.missionId === m.id;
    const y = listY + i * 46;
    if (selected) {
      panel(ctx, w / 2 - 270, y - 24, 540, 40);
    }
    ctx.fillStyle = selected ? COLORS.hudAccent : COLORS.hud;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(`${m.key}  ·  ${m.name}`, w / 2, y);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = selected ? COLORS.hud : COLORS.hudDim;
    ctx.fillText(m.blurb, w / 2, y + 18);
  });
  const ctrlY = listY + MISSIONS.length * 46 + 26;
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('SHIFT / CTRL  throttle      ↑ ↓  pitch      ← →  bank      Q / E  rudder', w / 2, ctrlY);
  ctx.fillText('SPACE drop crate · hold mouse to steer · C camera · P pause · M mute · R restart', w / 2, ctrlY + 24);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Press ENTER to fly', w / 2, ctrlY + 62);
  if (state.best > 0) {
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Best score: ${state.best}`, w / 2, ctrlY + 88);
  }
}

export function drawEnd(ctx, w, h, state) {
  ctx.fillStyle = 'rgba(6,12,24,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = state.won ? '#3ddc84' : COLORS.danger;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(state.won ? 'MISSION COMPLETE!' : state.endTitle, w / 2, h * 0.34);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(state.endLine, w / 2, h * 0.34 + 36);
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`Score ${state.score}`, w / 2, h * 0.34 + 84);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  const progress = state.missionId === 'slalom'
    ? `Gates ${state.gatesDone}/${state.gates.length}`
    : state.missionId === 'cargo'
      ? `Crate ${state.crate.dist} m from target (+${state.crate.score})`
      : `Rings ${state.ringsDone}/${state.rings.length}`;
  ctx.fillText(
    `${missionOf(state).name} · ${progress} · Best ${state.best} · Press ENTER to fly again`,
    w / 2, h * 0.34 + 118,
  );
}

export function drawPaused(ctx, w, h) {
  ctx.fillStyle = 'rgba(6,12,24,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', w / 2, h / 2);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('Press P to resume', w / 2, h / 2 + 30);
}
