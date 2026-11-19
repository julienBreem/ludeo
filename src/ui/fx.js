// Small particle effects and tweens. Particle textures fx-dot, fx-puff and fx-star are
// generated in BootScene (makeFxTextures). A global budget keeps at most MAX_PARTICLES
// alive at once: each emitter reserves its maximum up front and releases it when destroyed.
import { W } from '../config.js';

export const MAX_PARTICLES = 60;
const FX_DEPTH = 1000;

let reserved = 0;

// Live particle budget in use (for checks).
export function particleBudgetUsed() {
  return reserved;
}

// Draws the three particle textures once (called from BootScene).
export function makeFxTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
  g.generateTexture('fx-dot', 16, 16);
  g.clear();
  for (let r = 16; r > 0; r -= 2) g.fillStyle(0xffffff, 0.12).fillCircle(16, 16, r);
  g.generateTexture('fx-puff', 32, 32);
  g.clear();
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 6 : 15;
    pts.push({ x: 16 + Math.cos(a) * r, y: 16 + Math.sin(a) * r });
  }
  g.fillStyle(0xffffff, 1).fillPoints(pts, true);
  g.generateTexture('fx-star', 32, 32);
  g.destroy();
}

// Creates an emitter that may keep at most `want` particles alive (less if the budget is short).
// burst: emit everything at once; otherwise emit `want` particles over `spread` ms.
function emit(scene, x, y, key, config, want, { burst = true, spread = 0 } = {}) {
  const n = Math.min(want, MAX_PARTICLES - reserved);
  if (n <= 0) return null;
  reserved += n;
  const lifespan = typeof config.lifespan === 'number' ? config.lifespan : (config.lifespan?.max ?? 1000);
  const em = scene.add.particles(x, y, key, { ...config, emitting: false, maxAliveParticles: n });
  em.setDepth(FX_DEPTH);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    reserved -= n;
  };
  em.once('destroy', release);
  if (burst) {
    em.explode(n);
  } else {
    const every = Math.max(16, spread / n);
    let left = n;
    scene.time.addEvent({
      delay: every,
      repeat: n - 1,
      callback: () => { if (em.active && left-- > 0) em.emitParticle(1); },
    });
  }
  scene.time.delayedCall(spread + lifespan + 100, () => em.destroy());
  return em;
}

export function splash(scene, x, y, color = 0xffffff) {
  return emit(scene, x, y, 'fx-dot', {
    speed: { min: 120, max: 320 }, angle: { min: 200, max: 340 }, gravityY: 900,
    scale: { start: 0.9, end: 0.3 }, lifespan: 600, tint: color,
  }, 10);
}

// Cake crumbs falling from a bite (count <= 10; colours: an array of tints).
export function crumbs(scene, x, y, colors, count = 8) {
  return emit(scene, x, y, 'fx-dot', {
    x: { min: -14, max: 14 }, y: { min: -20, max: 20 },
    speed: { min: 60, max: 200 }, angle: { min: 200, max: 340 }, gravityY: 1100,
    scale: { min: 0.35, max: 0.75 }, lifespan: 700, tint: colors,
  }, Math.min(10, count));
}

export function flourPuff(scene, x, y) {
  return emit(scene, x, y, 'fx-puff', {
    speed: { min: 30, max: 110 }, angle: { min: 180, max: 360 },
    scale: { start: 1, end: 3 }, alpha: { start: 0.9, end: 0 }, lifespan: 900,
  }, 8);
}

export function sparkle(scene, x, y) {
  return emit(scene, x, y, 'fx-star', {
    speed: { min: 80, max: 220 }, rotate: { min: 0, max: 360 },
    scale: { start: 1.1, end: 0 }, lifespan: 700, tint: [0xffeb3b, 0xffffff, 0xff8fb7],
  }, 12);
}

export function steam(scene, x, y) {
  return emit(scene, x, y, 'fx-puff', {
    x: { min: -40, max: 40 }, speedY: { min: -120, max: -60 }, speedX: { min: -15, max: 15 },
    scale: { start: 1, end: 3.5 }, alpha: { start: 0.8, end: 0 }, lifespan: 1200,
  }, 10, { burst: false, spread: 900 });
}

export function smoke(scene, x, y) {
  return emit(scene, x, y, 'fx-puff', {
    x: { min: -40, max: 40 }, speedY: { min: -100, max: -50 }, speedX: { min: -20, max: 20 },
    scale: { start: 1.4, end: 4 }, alpha: { start: 0.85, end: 0 }, lifespan: 1500, tint: 0x4e4e4e,
  }, 10, { burst: false, spread: 1200 });
}

export function confetti(scene) {
  return emit(scene, W / 2, -20, 'fx-dot', {
    x: { min: -W / 2, max: W / 2 }, speedY: { min: 150, max: 380 }, speedX: { min: -80, max: 80 },
    gravityY: 200, rotate: { min: 0, max: 360 }, scaleX: 0.9, scaleY: 0.45, lifespan: 2600,
    tint: [0xff8fb7, 0x7c4dff, 0xffeb3b, 0x2979ff, 0x00e676, 0xff9800],
  }, 40, { burst: false, spread: 800 });
}

// Scale 0 -> 1.1 -> 1 (relative to the target's current scale).
export function popIn(scene, target) {
  const sx = target.scaleX;
  const sy = target.scaleY;
  target.setScale(0);
  return scene.tweens.chain({
    targets: target,
    tweens: [
      { scaleX: sx * 1.1, scaleY: sy * 1.1, duration: 180, ease: 'Quad.easeOut' },
      { scaleX: sx, scaleY: sy, duration: 120, ease: 'Quad.easeIn' },
    ],
  });
}

// Random eye blink every 2-5 s on container.eyes only: swap to client-eyes-closed for ~120 ms
// (fallback on the v1 face image: a quick scaleY squash). Returns a stop function.
export function blink(scene, container) {
  const eyes = container.eyes;
  let timer = null;
  let stopped = false;
  const schedule = () => {
    timer = scene.time.delayedCall(2000 + Math.random() * 3000, () => {
      if (stopped || !eyes.active) return;
      if (eyes.texture.key === 'client-eyes-open' && scene.textures.exists('client-eyes-closed')) {
        eyes.setTexture('client-eyes-closed');
        scene.time.delayedCall(120, () => { if (eyes.active) eyes.setTexture('client-eyes-open'); });
      } else if (eyes.texture.key.startsWith('face-')) {
        const sy = eyes.scaleY;
        scene.tweens.add({
          targets: eyes, scaleY: sy * 0.15, duration: 70, yoyo: true, ease: 'Quad.easeInOut',
          onComplete: () => { if (eyes.active) eyes.scaleY = sy; },
        });
      }
      schedule();
    });
  };
  schedule();
  return () => { stopped = true; timer?.remove(); };
}

// The mouth bobs (scaleY about its anchor) for `ms` while the client talks. No mouth layer
// (v1 face fallback): nothing happens.
export function talk(scene, container, ms = 1500) {
  const mouth = container.mouth;
  if (!mouth?.active) return null;
  const sy = mouth.scaleY;
  const dur = 140;
  return scene.tweens.add({
    targets: mouth, scaleY: sy * 0.55, duration: dur, yoyo: true, repeat: Math.max(0, Math.round(ms / (dur * 2)) - 1),
    ease: 'Sine.easeInOut', onComplete: () => { if (mouth.active) mouth.scaleY = sy; },
  });
}

// A few warm dots drifting up (oven heat). Call repeatedly while baking.
export function heatRise(scene, x, y) {
  return emit(scene, x, y, 'fx-dot', {
    x: { min: -150, max: 150 }, speedY: { min: -110, max: -60 }, speedX: { min: -10, max: 10 },
    scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, lifespan: 1000, tint: [0xffb74d, 0xff7043, 0xffee58],
  }, 4, { burst: false, spread: 500 });
}
