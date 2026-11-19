// End-to-end smoke test: opens the collection home, taps the stand's tile, then plays full rounds
// in headless Chrome over CDP with real mouse gestures (Home → Stand → Dough → Mold → Bake → Paint → Toppings → Service → Stand → …) and fails on any console
// error/warning, uncaught exception, off-origin request, or a scene that does not move on.
//
// Not part of `npm test` (its glob only picks tests/**/*.test.js). No dependencies (Node ≥ 22,
// for the global WebSocket). To run, from the repo root:
//
//   python3 -m http.server 8000 &          # serve the collection
//   node tests/e2e/smoke.mjs [outDir]      # steps: tests/e2e/smoke-steps.json
//   kill %1
//
// Env: CHROME=<path to Chrome> (default: macOS Google Chrome), URL=<collection home url>
// (default http://localhost:8000/; the stand is at jeux/stand-desserts/index.html below it). Screenshots go to outDir (default: a temp folder).
// Exit code 0 = pass, 1 = fail.
//
// The game state is read (never written) through a hook on Phaser's SceneManager.update that
// exposes the SceneManager as window.__sm; inputs are only CDP mouse events.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESSERTS, INGREDIENTS } from '../../jeux/stand-desserts/src/logic/catalog.js';
import { GREEN_MIN, GREEN_MAX } from '../../jeux/stand-desserts/src/logic/bake.js';
import { COLOR_HEX } from '../../jeux/stand-desserts/src/config.js';
import { bitesFor } from '../../jeux/stand-desserts/src/logic/scoring.js';
import { BRUSH_RADIUS } from '../../jeux/stand-desserts/src/logic/paint.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'stand-smoke-'));
const stepsFile = process.argv[3] ?? path.join(HERE, 'smoke-steps.json');
const URL = process.env.URL ?? 'http://localhost:8000/';
const GAME_URL = new globalThis.URL('jeux/stand-desserts/index.html', URL).href;
const TILE = '#tile-compter-observer';
const ORIGIN = new globalThis.URL(URL).origin;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const SCENE_TIMEOUT = 10000;

// Layout constants of the scenes (screen px, 1280×800 canvas at 1:1).
const OK_BTN = [1201, 721];
const LEFT_BTN = [79, 721]; // ↺ in prep scenes, shop in Stand, back in Shop

fs.mkdirSync(outDir, { recursive: true });
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const chrome = spawn(CHROME, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,800', `--user-data-dir=${path.join(outDir, 'profile')}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });

let ws;
const problems = [];
const requests = [];
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, m => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`eval failed: ${expr.slice(0, 80)}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result.value;
}

// ---- input gestures --------------------------------------------------------------------------
const mouse = (type, x, y, buttons = type === 'mouseReleased' ? 0 : 1) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });

async function tap([x, y], holdMs = 60) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await mouse('mousePressed', x, y);
  await sleep(holdMs);
  await mouse('mouseReleased', x, y);
}

async function drag(points, stepMs = 16) {
  const [x0, y0] = points[0];
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, buttons: 0 });
  await mouse('mousePressed', x0, y0);
  await sleep(40);
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 24));
    for (let k = 1; k <= n; k++) {
      await mouse('mouseMoved', ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
      await sleep(stepMs);
    }
  }
  const [xn, yn] = points[points.length - 1];
  await sleep(40);
  await mouse('mouseReleased', xn, yn);
}

// ---- game state (read only) --------------------------------------------------------------------
const HOOK = `(() => {
  if (typeof Phaser === 'undefined') return false;
  const P = Phaser.Scenes.SceneManager.prototype;
  if (!P.__smokeHook) { P.__smokeHook = true; const o = P.update; P.update = function (...a) { window.__sm = this; return o.apply(this, a); }; }
  return !!window.__sm;
})()`;

const activeScenes = () => evaluate(`window.__sm ? window.__sm.getScenes(true).map(s => s.scene.key) : []`);
const sceneEval = (key, body) => evaluate(`(() => { const s = window.__sm.getScene(${JSON.stringify(key)}); return (${body})(s); })()`);
// Screen x of the first image with that texture at shelf height (toppings shelf).
const shelfX = (key, texture) => sceneEval(key, `s => s.children.list.find(o => o.texture?.key === ${JSON.stringify(texture)} && Math.abs(o.y - 728) < 4)?.x`);

async function waitScene(key, timeout = SCENE_TIMEOUT) {
  const t0 = Date.now();
  let last = [];
  while (Date.now() - t0 < timeout) {
    last = await activeScenes();
    if (last.length === 1 && last[0] === key) {
      // the camera has finished fading in
      const ready = await sceneEval(key, 's => !s.cameras.main.fadeEffect.isRunning');
      if (ready) return;
    }
    await sleep(100);
  }
  throw new Error(`stuck: expected scene ${key}, active ${JSON.stringify(last)} after ${timeout} ms`);
}

async function waitFor(desc, fn, timeout = SCENE_TIMEOUT) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await fn()) return;
    await sleep(80);
  }
  throw new Error(`timeout waiting for ${desc}`);
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(r.data, 'base64'));
  log('  shot', `${name}.png`);
}

function check(cond, msg) {
  if (!cond) throw new Error(`check failed: ${msg}`);
  log('  ok:', msg);
}

let order = null; // order of the current round, read in Dough
let wrongColor = null; // colour painted on zone 0 in a 'wrong' paint (not in the order)
let lastClient = null; // client of the previous Stand (null after a page load)
let roundClient = null; // client of the current round
const toppingTotal = o => o.toppings.reduce((n, t) => n + t.count, 0);

// Pixels with alpha in the served cake's eaten texture (async snapshot of the DynamicTexture).
const EATEN_INK = `s => new Promise(resolve => {
  const img = s.cake.eatenImage;
  if (!img) return resolve(null);
  img.texture.snapshot(snap => {
    const c = document.createElement('canvas');
    c.width = snap.width; c.height = snap.height;
    const x = c.getContext('2d');
    x.drawImage(snap, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    resolve(n);
  });
})`;

// ---- one action per scene ------------------------------------------------------------------------
const actions = {
  // Home → tap the stand's tile (a real tap on its centre) → the stand's page.
  async start({ shot: name } = {}) {
    await send('Page.navigate', { url: URL });
    await waitFor('home tile', () => evaluate(`document.readyState === 'complete' && !!document.querySelector('${TILE}')`), 15000);
    const c = await evaluate(`(() => { const r = document.querySelector('${TILE}').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (name) await shot(name);
    await tap(c);
    await waitFor('stand page', () => evaluate(`location.href === ${JSON.stringify(GAME_URL)}`).catch(() => false), 15000);
    log('  ok: home tile opens', GAME_URL);
    await waitFor('Phaser hook', () => evaluate(HOOK).catch(() => false), 15000);
    await waitScene('Stand', 20000);
    lastClient = null;
  },

  // v1.1: one bubble with the finished cake; ✓ starts the preparation. The client must differ
  // from the previous Stand's client.
  async stand({ shot: name } = {}) {
    await waitScene('Stand');
    await waitFor('client at the stand', () => sceneEval('Stand', 's => s.ready'));
    const client = await sceneEval('Stand', 's => JSON.stringify(s.client.client)');
    if (lastClient) check(client !== lastClient, `new client differs from the previous one (${client})`);
    lastClient = client;
    roundClient = client;
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Dough');
  },

  async shopVisit({ shot: name } = {}) {
    await waitScene('Stand');
    await tap(LEFT_BTN);
    await waitScene('Shop');
    if (name) await shot(name);
    await tap(LEFT_BTN);
    await waitScene('Stand');
    log('  ok: Shop -> Stand');
  },

  // Buys the star mold (8 coins, first card of the shapes row), leaves within the 450 ms purchase
  // lock, comes back: the Shop must accept taps again (busy reset per visit) and no bob tween of
  // the destroyed cards may survive the re-render.
  async shopBuy({ shot: name } = {}) {
    await waitScene('Stand');
    await tap(LEFT_BTN);
    await waitScene('Shop');
    const before = await sceneEval('Shop', 's => ({ coins: Number(s.coinText.text), tweens: s.tweens.getTweens().length })');
    check(before.coins >= 8, `${before.coins} coins before buying`);
    await tap([548, 165]);
    await sleep(80);
    const after = await sceneEval('Shop', 's => ({ coins: Number(s.coinText.text), busy: s.busy, tweens: s.tweens.getTweens().filter(t => t.isActive() || t.isPlaying()).length, bobs: s.tweens.getTweens().filter(t => t.repeat === -1).length, alive: s.tweens.getTweens().filter(t => t.repeat === -1).every(t => t.targets.every(o => o.active)) })');
    check(after.coins === before.coins - 8, `bought: ${before.coins} -> ${after.coins} coins`);
    check(after.alive, `no bob tween left on destroyed cards (${after.bobs} bob tweens)`);
    if (name) await shot(name);
    await tap(LEFT_BTN); // leave while the purchase lock is still on
    await waitScene('Stand');
    await tap(LEFT_BTN);
    await waitScene('Shop');
    check((await sceneEval('Shop', 's => s.busy')) === false, 'Shop accepts taps on the next visit (busy reset)');
    await tap(LEFT_BTN);
    await waitScene('Stand');
  },

  async dough({ shot: name } = {}) {
    await waitScene('Dough');
    const r = await sceneEval('Dough', 's => ({ order: s.round.order })');
    order = r.order;
    log('  order', JSON.stringify(order));
    const opening = [520, 396];
    for (const [key, n] of Object.entries(DESSERTS[order.dessert].recipe)) {
      const x = 250 + INGREDIENTS.indexOf(key) * 156;
      for (let k = 0; k < n; k++) {
        await drag([[x, 725], [x, 600], opening]);
        await sleep(700);
      }
    }
    await waitFor('whisk', () => sceneEval('Dough', 's => s.whisk.visible'));
    // whisk: press it at home, then 6 loops round the bowl opening
    const pts = [[980, 560]];
    for (let i = 0; i <= 6 * 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push([520 + Math.cos(a) * 200, 404 + Math.sin(a) * 110]);
    }
    await drag(pts, 10);
    const prog = await sceneEval('Dough', 's => s.tracker.progress()');
    check(prog >= 1, `dough stirred (progress ${prog.toFixed(2)})`);
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Mold');
  },

  async mold({ shot: name } = {}) {
    await waitScene('Mold');
    const x = await sceneEval('Mold', `s => s.cards[${JSON.stringify(order.shape)}].card.x`);
    await tap([x, 540]);
    await waitFor('pour done', () => sceneEval('Mold', 's => s.chosen && !s.pouring'));
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Bake');
  },

  async bake({ doubleTap = false, shot: name } = {}) {
    await waitScene('Bake');
    const heat = DESSERTS[order.dessert].heat;
    await tap([[900, 1030, 1160][heat - 1], 290]);
    if (doubleTap) {
      // ▶ then a second tap 120 ms later: the cake must stay in the oven
      await tap([1030, 520], 40);
      await sleep(120);
      await tap([1030, 520], 40);
      await sleep(200);
      const phase = await sceneEval('Bake', 's => s.phase');
      check(phase === 'baking', `oven double tap does not take the cake out (phase ${phase})`);
    } else {
      await tap([1030, 520]);
    }
    const mid = (GREEN_MIN + GREEN_MAX) / 2;
    await waitFor('golden', () => sceneEval('Bake', `s => s.timer && s.timer.gauge() >= ${mid}`), 30000);
    await tap([1030, 520]);
    const g = await sceneEval('Bake', 's => s.finalGauge');
    check(g >= GREEN_MIN && g <= GREEN_MAX, `taken out golden (gauge ${g.toFixed(3)})`);
    await sleep(800);
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Paint');
  },

  // Paints each glaze zone with its colour: the zone's columns in zig-zags, the brush path kept
  // a brush radius inside the inner zone lines so it does not spill on the neighbour.
  // color 'wrong': zone 0 gets an owned colour that is not in the order.
  async paint({ color = 'order', shot: name } = {}) {
    await waitScene('Paint');
    const geo = await sceneEval('Paint', `s => {
      const zones = Array.from(s.zones); const n = Math.max(...zones) + 1; const box = [];
      for (let z = 0; z < n; z++) box.push({ x0: 99, x1: -1, y0: 99, y1: -1 });
      zones.forEach((z, i) => { if (z < 0) return; const b = box[z]; const x = i % 64; const y = Math.floor(i / 64);
        b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); });
      return { keys: s.colorKeys, box, pots: s.pots.map(p => p.x) };
    }`);
    const zoneColors = [...order.glaze];
    wrongColor = null;
    if (color === 'wrong') {
      wrongColor = geo.keys.filter(k => !order.glaze.includes(k)).at(-1);
      zoneColors[0] = wrongColor;
    }
    const CELL = 480 / 64;
    const sx = u => 540 + (u - 32) * CELL;
    const sy = v => 375 + (v - 32) * CELL;
    const inset = BRUSH_RADIUS - 0.5;
    for (let z = 0; z < zoneColors.length; z++) {
      const b = geo.box[z];
      const u0 = z === 0 ? b.x0 - 1 : b.x0 + inset;
      const u1 = z === zoneColors.length - 1 ? b.x1 + 2 : b.x1 + 1 - inset;
      await tap([geo.pots[geo.keys.indexOf(zoneColors[z])], 728]);
      await sleep(250);
      const pts = [];
      for (let v = b.y0 - 1, dir = 1; v <= b.y1 + 2; v += 2, dir = -dir) {
        pts.push([sx(dir > 0 ? u0 : u1), sy(v)], [sx(dir > 0 ? u1 : u0), sy(v)]);
      }
      await drag(pts, 4);
    }
    const cov = await sceneEval('Paint', `s => {
      const out = []; const want = ${JSON.stringify(zoneColors)};
      for (let z = 0; z < want.length; z++) {
        let t = 0; let n = 0; const w = s.colorKeys.indexOf(want[z]) + 1;
        s.zones.forEach((zz, i) => { if (zz !== z) return; t++; if (s.grid.cells[i] === w) n++; });
        out.push(n / t);
      }
      return out;
    }`);
    for (let z = 0; z < zoneColors.length; z++) {
      check(cov[z] > 0.85, `zone ${z} painted ${zoneColors[z]} (coverage ${cov[z].toFixed(2)})`);
    }
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Toppings');
  },

  // race: ✓ then ↺ 60 ms apart; the step must still move on and keep the ✓ result.
  async toppings({ race = false, shot: name } = {}) {
    await waitScene('Toppings');
    const spots = [[640, 330], [570, 400], [710, 400], [640, 440], [580, 320], [700, 320]];
    let i = 0;
    for (const { key, count } of order.toppings) {
      const x = await shelfX('Toppings', `topping-${key}`);
      for (let k = 0; k < count; k++) {
        await drag([[x, 728], [x, 600], spots[i++]]);
        await sleep(400);
      }
    }
    const n = await sceneEval('Toppings', 's => s.placed.length');
    check(n === toppingTotal(order), `${n} toppings placed (${order.toppings.map(t => `${t.count} ${t.key}`).join(', ')})`);
    if (name) await shot(name);
    if (race) {
      await tap(OK_BTN, 30);
      await sleep(60);
      await tap(LEFT_BTN, 30);
      await sleep(60);
      await tap(OK_BTN, 30);
    } else {
      await tap(OK_BTN);
    }
    await waitScene('Service');
    const res = await sceneEval('Service', 's => s.round.results.toppings');
    check(res?.ok === true, `toppings result kept after ✓ (${JSON.stringify(res)})`);
  },

  async service({ shot: name, expectCoins } = {}) {
    await waitScene('Service');
    const served = await sceneEval('Service', 's => JSON.stringify(s.client.client)');
    if (roundClient) check(served === roundClient, 'the Stand client is served');
    await waitFor('next button', () => sceneEval('Service', 's => s.next.visible && s.next.input?.enabled'), 20000);
    const info = await sceneEval('Service', `s => ({
      order: s.round.order,
      results: s.round.results,
      earned: s.coinsEarned,
      paid: s.round.paid ?? false,
      coinsPaid: s.round.coinsPaid ?? 0,
      bites: s.cake.bitesEaten(),
      eatenImage: !!s.cake.eatenImage,
      parts: s.cake.list.length,
      intact: !!(s.cake.side && s.cake.top && s.cake.line) && s.cake.visible && s.cake.alpha === 1,
      standing: s.cake.standing.filter(t => t.active && t.visible).length,
      parentMask: !!s.cake.mask,
      pots: s.children.list.flatMap(function walk(o) { return o.list ? o.list.flatMap(walk) : [o]; })
        .filter(o => o.texture && o.texture.key === 'pot').map(o => o.tintTopLeft),
    })`);
    const ink = await sceneEval('Service', EATEN_INK);
    log('  results', JSON.stringify(Object.fromEntries(Object.entries(info.results).map(([k, v]) => [k, v.ok ? 'ok' : v.reason]))));
    check(!info.parentMask, 'no mask on the whole served cake');
    if (expectCoins !== undefined) check(info.earned === expectCoins, `${info.earned} coins earned`);
    check(info.paid === (info.earned > 0) && info.coinsPaid === (info.earned > 0 ? info.earned : 0), `paid once (${info.coinsPaid})`);
    check(info.bites === bitesFor(info.earned), `${info.bites} bites for ${info.earned}/5`);
    if (info.earned === 5) {
      check(info.eatenImage && info.parts === 1 && info.standing === 0 && ink === 0,
        `5/5: nothing of the cake is visible, toppings included (parts ${info.parts}, standing ${info.standing}, ink ${ink})`);
    } else if (info.earned === 0) {
      check(!info.eatenImage && info.intact && info.standing === toppingTotal(info.order) && ink === null,
        `0/5: the cake is intact (${info.standing} toppings standing)`);
    } else {
      check(info.eatenImage && ink > 0, `${info.earned}/5: part of the cake is left (ink ${ink})`);
    }
    if (info.results.couleur && !info.results.couleur.ok && wrongColor) {
      const want = COLOR_HEX[wrongColor];
      check(info.pots.includes(want), `wrong-colour picture shows the painted pot ${wrongColor} (pots ${info.pots.map(c => c.toString(16))})`);
    }
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Stand');
  },

  // Opens the Service directly with the debug sample round and a forced score
  // (?scene=Service&score=N), runs the Service checks, then goes on to the Stand.
  async forcedService({ score, shot: name }) {
    const u = new globalThis.URL(GAME_URL);
    u.searchParams.set('scene', 'Service');
    u.searchParams.set('score', String(score));
    await send('Page.navigate', { url: u.href });
    await waitFor('Phaser hook', () => evaluate(HOOK), 15000);
    await waitScene('Service', 20000);
    roundClient = await sceneEval('Service', 's => JSON.stringify(s.client.client)');
    lastClient = roundClient; // the next Stand client must differ from the sample client
    wrongColor = null;
    await actions.service({ shot: name, expectCoins: score });
  },
};

// ---- run ----------------------------------------------------------------------------------------
let failed = null;
try {
  let targets;
  for (let i = 0; i < 75 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(200); }
  }
  if (!targets) throw new Error(`Chrome did not start (${CHROME})`);
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) {
      problems.push(`console.${m.params.type}: ${m.params.args.map(a => a.value ?? a.description).join(' ')}`);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      problems.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    }
  });
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  for (const step of steps) {
    log(`> ${step.do}${Object.keys(step).length > 1 ? ' ' + JSON.stringify(step) : ''}`);
    await actions[step.do](step);
    if (problems.length) throw new Error(`console problems: ${problems.join(' | ')}`);
  }
  const offOrigin = requests.filter(u => !u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:'));
  if (offOrigin.length) throw new Error(`off-origin requests: ${offOrigin.join(', ')}`);
  log(`requests: ${requests.length}, off-origin: 0`);
} catch (e) {
  failed = e;
  try { await shot('FAIL'); } catch {}
}
try { ws?.close(); } catch {}
chrome.kill();
log(`screenshots: ${outDir}`);
if (failed) {
  console.error(`SMOKE FAIL: ${failed.message}`);
  process.exit(1);
}
log('SMOKE PASS');
process.exit(0);
