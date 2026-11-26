// hud.js — instruments and screens.
// Chase view gets a slim HUD; cockpit view gets a full dashboard with lit
// gauges. Both always show altitude, speed and heading, plus throttle,
// fuel, hull, score, the clock and the ring counter.

import { COLORS, PLANE } from './config.js';
import { headingDegrees, speedKnots, altitudeAboveGround } from './aircraft.js';

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
  // Fixed aircraft symbol.
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
  // Lit tick ring.
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
  // Glareshield shadow.
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
  // Throttle quadrant.
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
  // Warning lamps.
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

export function drawHud(ctx, w, h, state) {
  const a = state.plane;
  const cockpit = state.cameraMode === 'cockpit';
  compassTape(ctx, w / 2, 12, headingDegrees(a));

  // Left cluster: altitude / speed / heading readouts.
  panel(ctx, 12, 12, 196, cockpit ? 74 : 122);
  ctx.fillStyle = COLORS.hud;
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${Math.round(a.y * 3.281)} ft`, 22, 40);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(`ALTITUDE  ·  AGL ${Math.round(altitudeAboveGround(a) * 3.281)} ft`, 22, 56);
  ctx.fillStyle = a.stall ? COLORS.danger : COLORS.hud;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${Math.round(speedKnots(a))} kt`, 22, 82);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(a.stall ? 'STALL — NOSE DOWN!' : 'AIRSPEED', 22, 98);
  if (!cockpit) {
    bar(ctx, 22, 116, 170, 8, a.throttle, COLORS.hudAccent, 'THROTTLE');
  }

  // Right cluster: score, clock, rings, fuel, hull.
  panel(ctx, w - 208, 12, 196, 132);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${state.score}`, w - 198, 40);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('SCORE', w - 198, 56);
  const t = Math.max(0, state.timeLeft);
  ctx.fillStyle = t < 20 ? COLORS.danger : COLORS.hud;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, w - 110, 40);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText('TIME', w - 110, 56);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`RING ${Math.min(state.nextRing + 1, state.rings.length)} / ${state.rings.length}`, w - 198, 82);
  bar(ctx, w - 198, 96, 170, 8, a.fuel / PLANE.fuelCapacity, a.fuel < 18 ? COLORS.danger : '#3ddc84', 'FUEL');
  bar(ctx, w - 198, 124, 170, 8, a.hull / 100, a.hull < 35 ? COLORS.danger : '#7fd4ff', 'HULL');

  if (cockpit) drawDashboard(ctx, w, h, a);
  else artificialHorizon(ctx, w - 64, h - 64, 46, a.pitch, a.roll);

  // Next-ring direction arrow at screen centre when the ring is off-view.
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

export function drawTitle(ctx, w, h, best) {
  ctx.fillStyle = 'rgba(6,12,24,0.34)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('EMBERWING', w / 2, h * 0.3);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('R I N G   R U N', w / 2, h * 0.3 + 40);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  const lines = [
    'Take off, thread all 12 glowing rings in order, then land on the strip.',
    'Every ring buys time. Full throttle drinks fuel. Land gently or bend the plane.',
    '',
    'SHIFT / CTRL  throttle      ↑ ↓  pitch      ← →  bank      Q / E  rudder',
    'Hold mouse to steer · C camera · P pause · M mute · R restart',
    '',
    'Press ENTER to fly',
  ];
  lines.forEach((line, i) => {
    ctx.fillStyle = i === lines.length - 1 ? COLORS.hudAccent : COLORS.hudDim;
    ctx.font = i === lines.length - 1 ? 'bold 20px system-ui, sans-serif' : '16px system-ui, sans-serif';
    ctx.fillText(line, w / 2, h * 0.44 + i * 26);
  });
  if (best > 0) {
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Best score: ${best}`, w / 2, h * 0.44 + lines.length * 26 + 10);
  }
}

export function drawEnd(ctx, w, h, state) {
  ctx.fillStyle = 'rgba(6,12,24,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = state.won ? '#3ddc84' : COLORS.danger;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(state.won ? 'COURSE COMPLETE!' : state.endTitle, w / 2, h * 0.34);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(state.endLine, w / 2, h * 0.34 + 36);
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`Score ${state.score}`, w / 2, h * 0.34 + 84);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(
    `Rings ${state.ringsDone}/${state.rings.length} · Best ${state.best} · Press ENTER to fly again`,
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
