// effects.js — a tiny capped particle system for Emberwing Ring Run.
// Gold sparks on ring passes, dust on takeoff/landing, splash on ditching,
// grey smoke from a bent hull, wingtip puffs in hard turns and speed
// streaks at full chat. Particles are world-space points drawn through the
// same projector as everything else; the pool is hard-capped so the frame
// rate never pays for a big burst.

const MAX_PARTICLES = 420;

export function newEffects() {
  return { particles: [], smokeTimer: 0, contrailTimer: 0 };
}

function spawn(fx, p) {
  if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();
  fx.particles.push(p);
}

function burst(fx, x, y, z, count, color, speed, life, size, gravity = 0, spread = 1) {
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.7;
    const up = Math.cos(i * 78.233) * 0.8;
    spawn(fx, {
      x, y, z,
      vx: Math.cos(t) * speed * spread, vy: up * speed * 0.7, vz: Math.sin(t) * speed * spread,
      life: life * (0.6 + ((i * 37) % 10) / 14), maxLife: life,
      size: size * (0.7 + ((i * 53) % 10) / 16), color, gravity, drag: 0.6,
    });
  }
}

// Ring / gate pass: a ring of gold sparks at the hoop.
export function ringBurst(fx, ring) {
  burst(fx, ring.x, ring.y, ring.z, 26, '255,210,63', 16, 0.9, 2.6, -2);
  burst(fx, ring.x, ring.y, ring.z, 10, '255,244,190', 8, 0.6, 2.0, -1);
}

// Dust kicked up by wheels on grass/dirt or a firm touchdown.
export function dustPuff(fx, x, y, z, strength = 1) {
  burst(fx, x, y + 1, z, Math.round(14 * strength), '196,172,128', 7 * strength, 1.1, 3.2, 1.5, 1.4);
}

// White spray when the plane ditches in the sea.
export function splash(fx, x, y, z) {
  burst(fx, x, y + 1, z, 34, '220,242,255', 13, 1.0, 3.0, -14, 0.8);
}

// Confetti-ish sparkle over the cargo target on a good drop.
export function targetSparkle(fx, x, y, z) {
  burst(fx, x, y + 2, z, 22, '120,255,170', 9, 1.2, 2.4, -3);
}

// A soft grey-brown puff cloud for a crash impact (bigger than dust).
export function crashPuff(fx, x, y, z) {
  burst(fx, x, y + 1.5, z, 30, '150,140,128', 11, 1.6, 4.2, 1.2, 1.2);
  burst(fx, x, y + 1, z, 12, '255,170,90', 8, 0.5, 2.6, -4);
}

// Per-frame emitters: damage smoke, hard-turn wingtip puffs, speed streaks.
export function emitContinuous(fx, a, dt) {
  if (a.hull < 40 && a.airborne && !a.crashed) {
    fx.smokeTimer -= dt;
    if (fx.smokeTimer <= 0) {
      fx.smokeTimer = 0.06;
      spawn(fx, {
        x: a.x, y: a.y, z: a.z, vx: 0, vy: 2.2, vz: 0,
        life: 1.4, maxLife: 1.4, size: 3.4, color: '90,90,95', gravity: 2.5, drag: 0.2, grow: true,
      });
    }
  }
  if (a.airborne && Math.abs(a.roll) > 0.75 && a.speed > 45) {
    fx.contrailTimer -= dt;
    if (fx.contrailTimer <= 0) {
      fx.contrailTimer = 0.05;
      const side = a.roll > 0 ? 1 : -1;
      const rx = Math.cos(a.heading) * side * 7.5;
      const rz = Math.sin(a.heading) * side * 7.5;
      spawn(fx, {
        x: a.x + rx, y: a.y - 0.4, z: a.z + rz, vx: 0, vy: 0.4, vz: 0,
        life: 0.8, maxLife: 0.8, size: 2.2, color: '245,250,255', gravity: 0, drag: 0.3, grow: true,
      });
    }
  }
  if (a.airborne && a.speed > 78) {
    // Speed streaks: short-lived motes streaming past the airframe.
    const bx = -Math.sin(a.heading), bz = Math.cos(a.heading);
    spawn(fx, {
      x: a.x + bx * 26 + Math.cos(a.heading) * ((fx.particles.length % 9) - 4) * 2.4,
      y: a.y + ((fx.particles.length % 5) - 2) * 1.6,
      z: a.z + bz * 26 + Math.sin(a.heading) * ((fx.particles.length % 9) - 4) * 2.4,
      vx: bx * 30, vy: 0, vz: bz * 30,
      life: 0.35, maxLife: 0.35, size: 1.4, color: '230,244,255', gravity: 0, drag: 0,
    });
  }
}

export function stepEffects(fx, dt) {
  const list = fx.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) { list.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    const d = Math.pow(p.drag, dt * 3);
    p.vx *= d; p.vz *= d;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.grow) p.size += dt * 3.2;
  }
}

export function drawEffects(ctx, project, fx) {
  for (const p of fx.particles) {
    const s = project(p.x, p.y, p.z);
    if (!s) continue;
    const alpha = Math.max(0, Math.min(0.9, p.life / p.maxLife));
    const r = Math.max(1, p.size * s.scale * 0.55);
    ctx.fillStyle = `rgba(${p.color},${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
