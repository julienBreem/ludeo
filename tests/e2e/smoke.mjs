// End-to-end smoke test of the collection, in headless Chrome over CDP with real mouse gestures:
// Home → parent space (profile of a 6-year-old, both recommendations applied: pace calme, evening
// mode on) → the stand's tile → full rounds at calme pace (Stand → Dough → Mold → Bake → Paint →
// Toppings → Service → Stand → …) → the stand's home button → the evening forced with ?debug&now= (the
// stand runs with the canvas filter and no confetti) → the parent resets the stand, then the back
// gesture returns to it: it shows 0 coins. Coins seeded in standDesserts.v1 must survive until
// that reset. Fails on any console error/warning, uncaught exception, off-origin request, or a scene
// that does not move on.
//
// Not part of `npm test` (its glob only picks tests/**/*.test.js). No dependencies (Node ≥ 22,
// for the global WebSocket). To run, from the repo root:
//
//   python3 -m http.server 8000 &          # serve the collection
//   node tests/e2e/smoke.mjs [outDir]      # steps: tests/e2e/smoke-steps.json
//   kill %1
//
// Env: CHROME=<path to Chrome> (default: macOS Google Chrome), URL=<collection home url>
// (default http://localhost:8000/; the stand is at jeux/stand-desserts/index.html below it; a
// sub-path such as http://localhost:8000/foodStand/ works too). Screenshots go to outDir (default: a temp folder).
// Exit code 0 = pass, 1 = fail.
//
// The game state is read (never written) through a hook on Phaser's SceneManager.update that
// exposes the SceneManager as window.__sm; inputs are only CDP mouse events.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESSERTS } from '../../jeux/stand-desserts/src/logic/catalog.js';
import { GREEN_MIN, GREEN_MAX, LEVEL_NUMBERS, rightAlarm } from '../../jeux/stand-desserts/src/logic/bake.js';
import { COLOR_HEX } from '../../jeux/stand-desserts/src/config.js';
import { bitesFor } from '../../jeux/stand-desserts/src/logic/scoring.js';
import { BRUSH_RADIUS } from '../../jeux/stand-desserts/src/logic/paint.js';
import { clueHolds } from '../../jeux/stand-desserts/src/logic/shapes.js';
import { NOUNS } from '../../jeux/stand-desserts/src/logic/orderText.js';
import { recipeFor } from '../../jeux/stand-desserts/src/logic/colors.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'stand-smoke-'));
const stepsFile = process.argv[3] ?? path.join(HERE, 'smoke-steps.json');
const URL = process.env.URL ?? 'http://localhost:8000/';
const GAME_URL = new globalThis.URL('jeux/stand-desserts/index.html', URL).href;
const TILE = '#tile-compter-observer';
const SEED_COINS = 7; // seeded in standDesserts.v1 before the first visit; must survive everything
const EVENING_NOW = '2026-11-19T20:00'; // ?debug&now= values (shared/runtime.js clock)
const DAY_NOW = '2026-11-19T12:00';
const ORIGIN = new globalThis.URL(URL).origin;
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCENE_TIMEOUT = 10000;

// Layout constants of the scenes (screen px, 1280×800 canvas at 1:1).
const OK_BTN = [1201, 721];
const LEFT_BTN = [79, 721]; // ↺ in prep scenes, shop in Stand, back in Shop
const BAKE_GO = [1160, 540]; // ▶ / oven mitt
const BAKE_DIAL = [905, 565]; // timer / clock pivot

fs.mkdirSync(outDir, { recursive: true });
// One Chrome per run, with its own profile and a DevTools port the OS picks (read back from
// DevToolsActivePort in that profile), so two runs never drive each other's page. The profile
// is removed at the end: one still there means a run is going on (or crashed) in this outDir.
const PROFILE = path.join(outDir, 'profile');
if (fs.existsSync(PROFILE)) {
  console.error(`SMOKE FAIL: ${PROFILE} exists: another smoke run uses this folder (or one crashed; then remove it).`);
  process.exit(1);
}
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const chrome = spawn(CHROME, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=0', '--window-size=1280,800', `--user-data-dir=${PROFILE}`,
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

// Moves the pressed mouse along the points (no press / release).
async function moveTo(...points) {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 24));
    for (let k = 1; k <= n; k++) {
      await mouse('mouseMoved', ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
      await sleep(16);
    }
  }
  await sleep(40);
}

// Dough multi-grab: presses the shelf ingredient at x and holds until the hand holds n (the second
// after 1 s, then one more every 600 ms, x the pace's anim factor); returns what the hand holds,
// the mouse still pressed.
async function grabMany(x, n) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: 725, buttons: 0 });
  const t0 = Date.now();
  await mouse('mousePressed', x, 725);
  await sleep(40);
  if (n > 1) {
    await waitFor(`hand holds 2`, () => evaluate(`window.__sm.getScene('Dough').drag?.n >= 2`), 15000);
    const first = Date.now() - t0;
    // calme pace (anim x1.5): the second one comes after ~1.5 s (a still press of 1 s takes 1)
    if (first < 1300) throw new Error(`check failed: long press picked the second one after ${first} ms (calme: ~1500 ms)`);
    log(`  ok: long press: one more after ${first} ms (calme pace)`);
    await waitFor(`hand holds ${n}`, () => evaluate(`window.__sm.getScene('Dough').drag?.n >= ${n}`), 15000);
  }
  return evaluate(`window.__sm.getScene('Dough').drag?.n ?? 0`);
}

// ---- game state (read only) --------------------------------------------------------------------
const HOOK = `(() => {
  if (typeof Phaser === 'undefined') return false;
  const P = Phaser.Scenes.SceneManager.prototype;
  if (!P.__smokeHook) { P.__smokeHook = true; const o = P.update; P.update = function (...a) { window.__sm = this; return o.apply(this, a); }; }
  // Counts the confetti emitters (they are created at y = -20 and destroyed after ~3 s, too short to poll).
  const F = Phaser.GameObjects.GameObjectFactory.prototype;
  if (!F.__smokeHook) { F.__smokeHook = true; window.__confetti = 0; const o = F.particles; F.particles = function (x, y, ...a) { if (y === -20) window.__confetti++; return o.call(this, x, y, ...a); }; }
  return !!window.__sm;
})()`;

const activeScenes = () => evaluate(`window.__sm ? window.__sm.getScenes(true).map(s => s.scene.key) : []`);
const sceneEval = (key, body) => evaluate(`(() => { const s = window.__sm.getScene(${JSON.stringify(key)}); return (${body})(s); })()`);
// Screen x of the first image with that texture at shelf height (toppings shelf).
const shelfX = (key, texture) => sceneEval(key, `s => s.children.list.find(o => o.texture?.key === ${JSON.stringify(texture)} && Math.abs(o.y - 728) < 4)?.x`);

async function elCenter(sel) {
  const c = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  if (!c) throw new Error(`no element ${sel}`);
  return c;
}
const tapEl = async sel => tap(await elCenter(sel));

// Loads a page of the collection (home) and waits for its tile.
async function loadHome(url) {
  await send('Page.navigate', { url });
  await waitFor('home tile', () => evaluate(`document.readyState === 'complete' && !!document.querySelector('${TILE}')`).catch(() => false), 15000);
}

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
let storedCoins = null; // standDesserts.v1 coins when the stand's home button was pressed
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
  // Fresh profile with seeded coins; the parent space sets the profile (a 6-year-old) and applies
  // both recommendations (rythme → calme, soir → evening mode on). Selects are set by script
  // (a native select popup cannot be tapped over CDP); every button is a real tap.
  async setup({ shot: name } = {}) {
    await loadHome(URL);
    await evaluate(`localStorage.clear(); localStorage.setItem('standDesserts.v1', JSON.stringify({ version: 1, coins: ${SEED_COINS}, owned: [] })); true`);
    await loadHome(URL);
    check(await evaluate(`!document.querySelector('#gear .dot').hidden`), 'first launch: the gear shows its red dot');
    await tapEl('#gear');
    await waitFor('parent space', () => evaluate(`!document.querySelector('#parent').hidden && !!document.querySelector('#p-name')`));
    const year = new Date().getFullYear() - 6;
    await evaluate(`(() => {
      const set = (el, v, ev) => { el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true })); };
      set(document.getElementById('p-name'), 'Test', 'input');
      set(document.getElementById('p-month'), '1', 'change');
      set(document.getElementById('p-year'), '${year}', 'change');
    })()`);
    await waitFor('age 6 recommendation', () => evaluate(`!!document.querySelector('[data-reco=rythme]')`));
    if (name) await shot(name);
    await tapEl('[data-reco=rythme] .primary');
    await waitFor('rythme applied', () => evaluate(`JSON.parse(localStorage.getItem('collection.v1')).pace === 'calme'`));
    await tapEl('[data-reco=soir] .primary');
    await waitFor('soir applied', () => evaluate(`JSON.parse(localStorage.getItem('collection.v1')).evening.enabled === true`));
    const c = await evaluate(`JSON.parse(localStorage.getItem('collection.v1'))`);
    check(c.profile.name === 'Test' && c.profile.year === year && c.pace === 'calme' && c.evening.enabled,
      `profile saved, pace calme, evening mode on (${JSON.stringify(c.profile)})`);
    await tapEl('.p-head button');
    await waitFor('parent closed', () => evaluate(`document.querySelector('#parent').hidden`));
    check(await evaluate(`document.querySelector('#gear .dot').hidden`), 'recommendations applied: the red dot is gone');
    const fade = await evaluate(`document.body.style.getPropertyValue('--fade')`);
    check(fade === '750ms', `home fade follows calme (${fade})`);
  },

  // Home → tap the stand's tile (a real tap on its centre) → the stand's page.
  async start({ shot: name } = {}) {
    await waitFor('home tile', () => evaluate(`!!document.querySelector('${TILE}.has-art')`), 15000);
    // the category's card is shown whole: the tile has the art's 4:3 ratio, at least 96 px
    const [tw, th] = await evaluate(`(() => { const r = document.querySelector('${TILE}').getBoundingClientRect(); return [r.width, r.height]; })()`);
    check(Math.abs(tw / th - 4 / 3) < 0.02 && th >= 96, `category tile is 4:3 (${Math.round(tw)}x${Math.round(th)})`);
    const c = await elCenter(TILE);
    if (name) await shot(name);
    await tap(c);
    await waitFor('stand page', () => evaluate(`location.href === ${JSON.stringify(GAME_URL)}`).catch(() => false), 15000);
    log('  ok: home tile opens', GAME_URL);
    await waitFor('Phaser hook', () => evaluate(HOOK).catch(() => false), 15000);
    await waitScene('Stand', 20000);
    lastClient = null;
    const pace = await evaluate(`import('../../shared/runtime.js').then(m => m.getEffective().pace)`);
    check(pace === 'calme', `the stand runs at the shared pace (${pace})`);
  },

  // The stand's home button (top-left) → the collection home, coins untouched.
  async goHome({ shot: name } = {}) {
    await waitScene('Stand');
    storedCoins = await evaluate(`JSON.parse(localStorage.getItem('standDesserts.v1')).coins`);
    check(storedCoins >= SEED_COINS, `the seeded coins are kept and grew with the rounds (${SEED_COINS} -> ${storedCoins})`);
    await tap([79, 79]);
    await waitFor('the stand fades out', () => evaluate(`!!window.__sm?.getScene('Stand')?.cameras.main.fadeEffect.isRunning`).catch(() => false), 3000);
    log('  ok: the home button fades the stand out');
    await waitFor('home', () => evaluate(`location.href === ${JSON.stringify(new globalThis.URL('index.html', URL).href)} && !!document.querySelector('${TILE}')`).catch(() => false), 15000);
    log('  ok: home button returns to the collection home');
    const after = await evaluate(`JSON.parse(localStorage.getItem('standDesserts.v1')).coins`);
    check(after === storedCoins, `coins survive the trip home (${after})`);
    if (name) await shot(name);
  },

  // Evening forced with ?now=: the home darkens, the stand runs with the canvas filter, the shop
  // still shows the coins, and a 5/5 service throws no confetti.
  async evening({ shot: name } = {}) {
    await loadHome(`${URL}?debug&now=${EVENING_NOW}`);
    check(await evaluate(`document.body.classList.contains('evening') && !document.getElementById('moon').hidden`), `home in evening mode (?now=${EVENING_NOW})`);
    const u = new globalThis.URL(GAME_URL);
    u.searchParams.set('debug', '1');
    u.searchParams.set('now', EVENING_NOW);
    await send('Page.navigate', { url: u.href });
    await waitFor('Phaser hook', () => evaluate(HOOK).catch(() => false), 15000);
    await waitScene('Stand', 20000);
    log('  at', await evaluate(`location.href + ' ' + document.querySelectorAll('canvas').length`));
    const f = await evaluate(`document.querySelector('canvas').style.filter`);
    check(f.includes('brightness(0.8)'), `the stand canvas has the evening filter (${f})`);
    const ev = await evaluate(`import('../../shared/runtime.js').then(m => { const e = m.getEffective(); return [e.evening, e.pace]; })`);
    check(ev[0] === true && ev[1] === 'calme', `evening forces calme (${ev})`);
    await tap(LEFT_BTN);
    await waitScene('Shop');
    const coins = await sceneEval('Shop', 's => Number(s.coinText.text)');
    check(coins === storedCoins, `the shop shows the coins that survived (${coins})`);
    if (name) await shot(name);
    await tap(LEFT_BTN);
    await waitScene('Stand');
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
    const tags = await sceneEval('Stand', 's => s.level === 1 && s.tags ? s.tags.map(it => [it.tag.input.hitArea.width, it.tag.input.hitArea.height]) : null');
    if (tags) check(tags.every(([w, h]) => w >= 96 && h >= 96), `N1 tags: touch targets >= 96 px (${JSON.stringify(tags)})`);
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

  // Buys the star mold (8 coins, found by its picture in the shapes row), leaves within the 450 ms purchase
  // lock, comes back: the Shop must accept taps again (busy reset per visit) and no bob tween of
  // the destroyed cards may survive the re-render.
  async shopBuy({ shot: name } = {}) {
    await waitScene('Stand');
    await tap(LEFT_BTN);
    await waitScene('Shop');
    const before = await sceneEval('Shop', 's => ({ coins: Number(s.coinText.text), tweens: s.tweens.getTweens().length })');
    check(before.coins >= 8, `${before.coins} coins before buying`);
    // the star mould's card (the shapes row also lists the licorne, losange and hexagone)
    const star = await sceneEval('Shop', `s => {
      const has = o => /^mold-etoile/.test(o.texture?.key ?? '') || (o.list ?? []).some(has);
      const card = s.cards.list.find(has);
      return card ? [card.x, card.y] : null; }`);
    check(!!star, `the star mould is on sale (${star})`);
    await tap(star);
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

  // Dough: at N1 one ingredient per drag; at N2-N3 the multi-grab (spec 2 bis): a long press on
  // the shelf until the hand holds what the kind needs, then one drop in the bowl (a short drag when
  // one is needed). `hold`: first, a long press until the hand holds that many of the first kind,
  // dropped outside the bowl: they all go back to the shelf, nothing is poured.
  async dough({ shot: name, hold } = {}) {
    await waitScene('Dough');
    // The recipe depends on the pâte level: read it from the round, with the shelf and bowl layout.
    const r = await sceneEval('Dough', `s => ({ order: s.round.order, recipe: s.round.recipe, shelf: s.shelf, level: s.level,
      open: [s.batter.x, s.batter.y - 10], whisk: [s.whisk.x, s.whisk.y - 80] })`);
    order = r.order;
    log('  order', JSON.stringify(order), 'recipe', JSON.stringify(r.recipe.target), 'prefilled', JSON.stringify(r.recipe.prefilled), 'level', r.level);
    const opening = r.open;
    const kinds = Object.keys(r.recipe.target);
    if (hold) {
      const x = r.shelf[kinds[0]];
      const held = await grabMany(x, hold);
      check(held === hold, `long press: the hand holds ${held} (${r.level <= 1 ? 'dice dots' : 'a digit'} above it)`);
      if (name) await shot(`${name}-hold${hold}`);
      await moveTo([x, 725], [760, 300]);
      await mouse('mouseReleased', 760, 300);
      await sleep(120);
      if (name) await shot(`${name}-drop-outside`);
      await waitFor('hand back on the shelf', () => sceneEval('Dough', 's => !s.drag && !s.children.list.some(o => o.type === "Container" && o.depth === 40)'));
      const added = await sceneEval('Dough', 's => ({ added: s.added, board: s.shells.length + Object.values(s.empties).reduce((a, l) => a + l.length, 0) })');
      check(Object.keys(added.added).length === 0 && added.board === 0, `dropped outside the bowl: all ${hold} back on the shelf, nothing poured (${JSON.stringify(added)})`);
    }
    let longPresses = 0;
    for (const key of kinds) {
      const x = r.shelf[key];
      const need = r.recipe.target[key] - (r.recipe.prefilled[key] ?? 0);
      if (r.level >= 2) {
        const held = await grabMany(x, need);
        check(held === need, `${key}: the hand holds ${held} of ${need}`);
        if (need > 1) longPresses++;
        await moveTo([x, 725], [x, 600], opening);
        await mouse('mouseReleased', opening[0], opening[1]);
        await sleep(700 + need * 220);
      } else {
        for (let k = 0; k < need; k++) {
          await drag([[x, 725], [x, 600], opening]);
          await sleep(700);
        }
      }
      await waitFor(`${key} poured`, () => sceneEval('Dough', `s => (s.added[${JSON.stringify(key)}] ?? 0) === ${need} && (${JSON.stringify(key)} === 'oeuf' ? s.shells.length : (s.empties[${JSON.stringify(key)}] ?? []).length) === ${need}`));
    }
    if (r.level >= 2) check(longPresses >= 1 || kinds.every(k => r.recipe.target[k] - (r.recipe.prefilled[k] ?? 0) === 1), `N${r.level}: ${longPresses} kinds poured with one long press each`);
    log('  ok: every kind poured, its empties on the board', JSON.stringify(await sceneEval('Dough', 's => s.added')));
    await waitFor('whisk', () => sceneEval('Dough', 's => s.whisk.visible'));
    // whisk: press it at home, then 6 loops round the bowl opening
    const pts = [r.whisk];
    for (let i = 0; i <= 6 * 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push([opening[0] + Math.cos(a) * 180, opening[1] + 8 + Math.sin(a) * 100]);
    }
    await drag(pts, 10);
    const prog = await sceneEval('Dough', 's => s.tracker.progress()');
    check(prog >= 1, `dough stirred (progress ${prog.toFixed(2)})`);
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Mold');
  },

  // Mould at the round's Moule level (read from the scene; `level` checks it): N1 taps the ordered
  // mould among 4; N2 checks the clue (true of the ordered shape only), lights a corner, then taps
  // the ordered mould; N3 turns each piece (taps) and drags it into a place it fits. Every level
  // must be judged right.
  // wrong: N1/N2 choose another mould; N3 leave the last piece a near miss (✓ still lights).
  async mold({ level, wrong = false, shot: name } = {}) {
    await waitScene('Mold');
    const n = await sceneEval('Mold', 's => s.level');
    if (level !== undefined) check(n === level, `Moule plays level ${level} (${n})`);
    if (n === 3) {
      await actions.tangram({ shot: name, wrong });
    } else {
      const ex = await sceneEval('Mold', 's => s.ex');
      check(ex.choices.length === 4 && ex.choices.includes(order.shape), `N${n}: 4 moulds with the ordered one (${ex.choices.join(', ')})`);
      if (n === 2) {
        check(ex.choices.every(k => clueHolds(ex.clue, k) === (k === order.shape)), `N2 clue ${JSON.stringify(ex.clue)} fits ${order.shape} only`);
        const words = await sceneEval('Mold', 's => s.children.list.filter(o => o.depth === 400).flatMap(c => (c.list ?? [])).flatMap(o => (o.list ?? [o])).map(o => o.text).filter(Boolean).join(" ")');
        check(words.includes('?') && !words.includes(NOUNS.shape[order.shape].word), `N2: the strip hides the shape (${words})`);
        const corners = await sceneEval('Mold', `s => s.cornerScreen(${JSON.stringify(order.shape)})`);
        if (corners.length) {
          await tap(corners[0]);
          await sleep(300);
          check(await sceneEval('Mold', `s => s.cards[${JSON.stringify(order.shape)}].lit.size`) === 1, 'N2: a tapped corner glows');
        }
      }
      const pick = wrong ? ex.choices.find(k => k !== order.shape) : order.shape;
      const [x, y] = await sceneEval('Mold', `s => { const c = s.cards[${JSON.stringify(pick)}].card; return [c.x, c.y + 118]; }`);
      await tap([x, y]);
      await waitFor('pour done', () => sceneEval('Mold', 's => s.chosen && !s.pouring'));
      if (name) await shot(name);
    }
    await tap(OK_BTN);
    await waitScene('Bake');
    const res = await sceneEval('Bake', 's => s.round.results.moule');
    if (wrong) check(res?.ok === false && res.reason === (n === 3 ? 'pieces' : 'mauvaise-forme'), `Moule N${n} wrong: judged wrong (${JSON.stringify(res)})`);
    else check(res?.ok === true, `Moule N${n} judged right (${JSON.stringify(res)})`);
  },

  // Moule N3: for each piece, the fewest taps to a turn that fits a free place, then a drag there
  // (a little off: it must snap). A first drag to the screen's corner checks it stays on screen.
  // Piece 0 first gets a near miss (dropped 1.4 x the snap distance off its place): no snap, the
  // place's outline glows. wrong: the last piece is left as such a near miss (✓ must still light).
  async tangram({ shot: name, wrong = false } = {}) {
    const count = await sceneEval('Mold', 's => s.pieces.length');
    check(count >= 2 && count <= 3, `N3: ${count} pieces`);
    const p0 = await sceneEval('Mold', 's => [s.pieces[0].img.x, s.pieces[0].img.y]');
    await drag([p0, [1279, 799]]);
    const kept = await sceneEval('Mold', 's => [s.pieces[0].img.x, s.pieces[0].img.y]');
    check(kept[0] < 1280 - 40 && kept[1] < 800 - 40, `N3: a piece dragged to the corner stays on screen (${kept})`);
    for (let i = 0; i < count; i++) {
      const info = await sceneEval('Mold', `s => { const p = s.pieces[${i}]; return { x: p.img.x, y: p.img.y, rot: p.rot,
        fits: s.ex.pieces[${i}].fits, filled: [...s.filled.keys()], homes: s.ex.pieces.map((_, j) => s.home(j)) }; }`);
      const free = r => info.fits[r].some(j => !info.filled.includes(j));
      const turns = [0, 1, 2, 3].find(t => free((info.rot / 90 + t) % 4));
      for (let t = 0; t < turns; t++) {
        await tap([info.x, info.y]);
        await sleep(500);
      }
      const r = (info.rot / 90 + turns) % 4;
      const [hx, hy] = info.homes[info.fits[r].find(j => !info.filled.includes(j))];
      const snapPx = await sceneEval('Mold', 's => s.snapPx');
      const miss = [hx + snapPx * 1.4, hy];
      if (i === 0 || (wrong && i === count - 1)) {
        await drag([[info.x, info.y], miss]);
        await sleep(150);
        const st = await sceneEval('Mold', `s => ({ placed: s.pieces[${i}].place, hint: !!s.hintImg, ok: s.bar.validateButton.input.enabled })`);
        check(st.placed === null && st.hint, `N3: a near miss does not snap and the place glows (${JSON.stringify(st)})`);
        if (name && i === 0) await shot(`${name}-nearmiss`);
        await sleep(1500);
        if (wrong && i === count - 1) {
          check(st.ok, 'N3: ✓ lights with the last piece a near miss');
          break;
        }
        info.x = miss[0];
        info.y = miss[1];
      }
      if (i === 0) {
        await drag([[info.x, info.y], [(info.x + hx) / 2, (info.y + hy) / 2]]);
        if (name) await shot(`${name}-half`);
        await drag([[(info.x + hx) / 2, (info.y + hy) / 2], [hx + 12, hy - 8]]);
      } else {
        await drag([[info.x, info.y], [hx + 12, hy - 8]]);
      }
      await waitFor(`piece ${i} snapped`, () => sceneEval('Mold', `s => s.pieces[${i}].place !== null`), 3000);
    }
    await sleep(400);
    check(await sceneEval('Mold', 's => s.bar.validateButton.input.enabled'), wrong ? 'N3: ✓ with a piece near its place' : 'N3: ✓ once every piece is in place');
    if (name) await shot(name);
  },

  // Bake at the round's Cuisson level (read from the scene): the heat of the dessert, then
  // N1 out in the green, N2 out when the hand is on the dessert's number, N3 the alarm dragged to
  // the start + the duration, out when it rings. `level` checks the round plays that level.
  // wrong: 'heat' (one flame off, the right time: never golden), 'time' (N2: out one number late).
  async bake({ doubleTap = false, level, wrong = null, shot: name } = {}) {
    await waitScene('Bake');
    const n = await sceneEval('Bake', 's => s.level');
    if (level !== undefined) check(n === level, `Cuisson plays level ${level} (${n})`);
    const want = DESSERTS[order.dessert].heat;
    const heat = wrong === 'heat' ? (want === 3 ? 2 : want + 1) : want;
    await tap([[900, 1030, 1160][heat - 1], 290]);
    if (n === 3) {
      const bt = await sceneEval('Bake', 's => s.bt');
      check(Number.isInteger(bt.start) && bt.start >= 1 && bt.start <= 10 && bt.duration === 1, `N3 start ${bt.start} h, ${bt.duration} h`);
      check(await sceneEval('Bake', 's => !s.go.input.enabled && !!s.alarmPulse'), 'N3: ▶ waits for the alarm, the bell pulses');
      const alarm = rightAlarm(bt);
      const pt = (h, r = 110) => [BAKE_DIAL[0] + r * Math.sin((h / 12) * 2 * Math.PI), BAKE_DIAL[1] - r * Math.cos((h / 12) * 2 * Math.PI)];
      await drag([pt(bt.start + 6, 90), pt(alarm + 2), pt(alarm + 0.3)]);
      const set = await sceneEval('Bake', 's => s.alarm');
      check(set === alarm, `N3 alarm dragged to ${alarm} h (${set})`);
      if (name) await shot(`${name}-alarm`);
    }
    if (doubleTap) {
      // ▶ then a second tap 120 ms later: the cake must stay in the oven
      await tap(BAKE_GO, 40);
      await sleep(120);
      await tap(BAKE_GO, 40);
      await sleep(200);
      const phase = await sceneEval('Bake', 's => s.phase');
      check(phase === 'baking', `oven double tap does not take the cake out (phase ${phase})`);
    } else {
      await tap(BAKE_GO);
    }
    if (n === 1) {
      const mid = (GREEN_MIN + GREEN_MAX) / 2;
      await waitFor('golden', () => sceneEval('Bake', `s => s.timer && s.timer.gauge() >= ${mid}`), 30000);
    } else if (n === 2) {
      const num = LEVEL_NUMBERS[order.dessert] + (wrong === 'time' ? 1 : 0);
      await waitFor(`hand on ${num}`, () => sceneEval('Bake', `s => s.timer && s.timer.elapsed() >= ${num}`), 60000);
      if (name) await shot(`${name}-hand`);
    } else {
      await waitFor('alarm rings', () => sceneEval('Bake', 's => s.rang'), 40000);
    }
    await tap(BAKE_GO);
    const st = await sceneEval('Bake', 's => s.finalState');
    if (wrong === 'heat') check(st === (heat > want ? 'brule' : 'pale'), `N${n}: wrong flames at the right time: ${st}, not golden`);
    else if (wrong === 'time') check(st === 'brule', `N${n}: out one number late: ${st}`);
    else check(st === 'dore', `N${n}: taken out golden (${st})`);
    await sleep(800);
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Paint');
  },

  // Paints each glaze zone with its colour: the zone's columns in zig-zags, the brush path kept
  // a brush radius inside the inner zone lines so it does not spill on the neighbour.
  // color 'wrong': zone 0 gets an owned colour that is not in the order (N1).
  // N2 / N3 (Glaçage level from the scene; `level` checks it): every ordered colour that is not a
  // base pot is mixed first: its two bases dragged onto the bowl, then the pot button. N2 also
  // pours one pot and taps the bowl to empty it; N3 checks the rim graduations (no dotted lines).
  async paint({ color = 'order', level, shot: name } = {}) {
    await waitScene('Paint');
    // (a smoke run once saw colorKeys undefined here under heavy load: wait for create() to have run)
    await waitFor('Paint create()', () => sceneEval('Paint', 's => Array.isArray(s.colorKeys) && !!s.pots && s.pots.length > 0'));
    const n = await sceneEval('Paint', 's => s.level');
    if (level !== undefined) check(n === level, `Glaçage plays level ${level} (${n})`);
    const zoneCount = order.glaze.length;
    if (n === 1) check(zoneCount <= 2, `N1: ${zoneCount} band(s), halves at most`);
    if (n === 2) check(zoneCount <= 3 && new Set(order.glaze).size === zoneCount, `N2: ${zoneCount} distinct band(s)`);
    if (n === 3) {
      check([3, 4].includes(zoneCount) && new Set(order.glaze).size < zoneCount, `N3: ${zoneCount} bands, a colour over several (${order.glaze.join(' ')})`);
      const ticks = await sceneEval('Paint', 's => s.ticks?.length ?? 0');
      check(ticks === 2 * (zoneCount - 1), `N3: ${ticks} rim graduations at the band edges`);
      // equal-area bands: each holds 1/n of the silhouette, within one column's cells
      const area = await sceneEval('Paint', `s => {
        const cols = new Array(64).fill(0); const c = new Array(s.nZones).fill(0); let t = 0;
        s.full.forEach((v, i) => { if (!v) return; const x = i % 64; cols[x]++; t++; c[s.edges.filter(e => x >= e).length]++; });
        return { flag: s.round.order.equalArea === true, col: Math.max(...cols), t, c };
      }`);
      check(area.flag && area.c.every(k => Math.abs(k - area.t / zoneCount) <= area.col),
        `N3: bands of equal area (${area.c.join(' | ')} of ${area.t})`);
    }
    const potX = key => sceneEval('Paint', `s => s.pots.find(p => p.key === ${JSON.stringify(key)})?.x ?? null`);
    if (n >= 2) {
      const bowl = await sceneEval('Paint', 's => ({ x: s.bowlRect.centerX, y: s.bowlRect.centerY, bx: s.potButton.x, by: s.potButton.y })');
      const pourPot = async (key) => {
        const x = await potX(key);
        await drag([[x, 728], [x, 640], [bowl.x, bowl.y]]);
        await waitFor(`${key} poured`, () => sceneEval('Paint', 's => s.bowl.pours > 0 && !s.potDrag'));
        await sleep(300);
      };
      if (n === 2) {
        await pourPot('jaune');
        check(await sceneEval('Paint', 's => s.bowl.content') === 'jaune', 'a pot poured into the bowl');
        await tap([bowl.x, bowl.y]);
        check(await sceneEval('Paint', 's => s.bowl.content') === null, 'tapping the bowl empties it');
      }
      for (const key of new Set(order.glaze)) {
        if (await potX(key) !== null) continue;
        const recipe = recipeFor(key);
        check(!!recipe, `${key} has a recipe`);
        await pourPot(recipe[0]);
        await pourPot(recipe[1]);
        await waitFor(`pot button for ${key}`, () => sceneEval('Paint', `s => s.bowl.content === ${JSON.stringify(key)} && s.potButton.visible && s.potButton.scale === 1`));
        if (name) await shot(`${name}-mix-${key}`);
        await tap([bowl.bx, bowl.by]);
        await waitFor(`${key} pot on the shelf`, () => sceneEval('Paint', `s => s.pots.some(p => p.key === ${JSON.stringify(key)} && p.y < 728 && !s.tweens.isTweening(p))`));
        log(`  mixed ${recipe.join(' + ')} = ${key}`);
      }
    }
    const geo = await sceneEval('Paint', `s => {
      const zones = Array.from(s.zones); const n = Math.max(...zones) + 1; const box = [];
      for (let z = 0; z < n; z++) box.push({ x0: 99, x1: -1, y0: 99, y1: -1 });
      zones.forEach((z, i) => { if (z < 0) return; const b = box[z]; const x = i % 64; const y = Math.floor(i / 64);
        b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); });
      return { keys: s.colorKeys, box, pots: Object.fromEntries(s.pots.map(p => [p.key, p.x])) };
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
      await tap([geo.pots[zoneColors[z]], 728]);
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
  // Toppings level from the scene (`level` checks it): N1 counts, free placement; N2 the motif ring:
  // a wrong kind is put in the first free slot, dragged off the cake (it must leave), a drop far
  // from any slot goes back, then every free slot gets its kind; N3 the hint card (at most 3 rows),
  // the solution's counts by free placement. At N2-N3 the strip must not tell the toppings.
  async toppings({ race = false, level, shot: name } = {}) {
    await waitScene('Toppings');
    const info = await sceneEval('Toppings', `s => ({ level: s.level, mode: s.mode, cakeX: s.cakeX,
      slots: s.slots && s.slots.map(q => ({ x: q.x, y: q.y, want: q.want, key: q.key, prefilled: q.prefilled })),
      rows: s.hintCard ? s.round.order.hintCard.hints.length : 0, card: !!(s.hintCard && s.hintCard.visible),
      strip: s.children.list.filter(o => o.depth === 400).flatMap(function walk(o) { return o.list ? o.list.flatMap(walk) : [o]; })
        .filter(o => o.type === 'Text').map(o => o.text).join(' ') })`);
    if (level !== undefined) check(info.level === level, `Toppings plays level ${level} (${info.level}, ${info.mode})`);
    const wantMode = { 1: 'counts', 2: 'motif', 3: 'hints' }[info.level];
    check(info.mode === wantMode, `N${info.level}: mode ${info.mode}`);
    if (info.level >= 2) {
      // the topping words (the shape's own word may be « étoile » too) and a « ? » in their place
      const text = info.strip.replace(NOUNS.shape[order.shape].word, '');
      const words = order.toppings.flatMap(t => [NOUNS.topping[t.key].one, NOUNS.topping[t.key].many, NOUNS.topping[t.key].label?.[1]]).filter(Boolean);
      check(!words.some(w => text.includes(w)) && info.strip.includes('?'), `N${info.level}: the strip does not tell the toppings (« ${info.strip.replace(/\s+/g, ' ').trim()} »)`);
    }
    const dragFromShelf = async (key, to) => {
      const x = await shelfX('Toppings', `topping-${key}`);
      await drag([[x, 728], [x, 600], to]);
      await sleep(350);
    };
    if (info.mode === 'motif') {
      const { motif } = order;
      check(info.slots.length === 6 && info.slots.length === motif.slots && 6 % motif.pattern.length === 0, `N2: a ring of ${info.slots.length} slots, a multiple of the period`);
      check(info.slots.filter(q => q.prefilled).length === motif.prefill && info.slots.every((q, i) => (i < motif.prefill) === !!q.key),
        `N2: the motif's start (${motif.prefill}) is there: ${motif.pattern.join(' ')}`);
      const free = info.slots.filter(q => !q.prefilled);
      // a drop on the cake but out of every free slot's snap reach goes back to the shelf. The spot
      // comes from the scene's own tests: the ring is fitted to each shape, so a fixed point (the
      // cake's centre) is within reach of a slot on some shapes (triangle).
      const away = await sceneEval('Toppings', `s => { let best = null;
        for (let dy = -150; dy <= 150; dy += 10) for (let dx = -200; dx <= 200; dx += 10) {
          const x = Math.round(s.cakeX + dx); const y = 375 + dy;
          if (!s.onCake(x, y) || s.nearestSlot(x, y, q => !q.key)) continue;
          const d = Math.min(...s.slots.filter(q => !q.key).map(q => Math.hypot(q.x - x, q.y - y)));
          if (!best || d > best.d) best = { x, y, d };
        } return best; }`);
      check(away !== null, `N2: a spot on the cake out of the free slots' reach (${away && [away.x, away.y]}, ${away && Math.round(away.d)} px)`);
      await dragFromShelf(free[0].want, [away.x, away.y]);
      check(await sceneEval('Toppings', 's => s.slots.filter(q => q.key).length') === motif.prefill, 'N2: a drop away from the slots goes back');
      // a wrong kind in the first free slot, then dragged off the cake
      const wrongKey = motif.pattern.find(k => k !== free[0].want) ?? 'fraise';
      await dragFromShelf(wrongKey, [Math.round(free[0].x), Math.round(free[0].y)]);
      check(await sceneEval('Toppings', `s => s.slots[${motif.prefill}].key`) === wrongKey, `N2: ${wrongKey} snapped into the free slot`);
      if (name) await shot(`${name}-wrong`);
      await drag([[Math.round(free[0].x), Math.round(free[0].y)], [Math.round(free[0].x), 600], [640, 728]]);
      await sleep(400);
      check(await sceneEval('Toppings', `s => s.slots[${motif.prefill}].key === null && !s.drag`), 'N2: the wrong topping dragged off the cake is gone');
      for (const q of free) await dragFromShelf(q.want, [Math.round(q.x + 14), Math.round(q.y - 10)]);
      const got = await sceneEval('Toppings', 's => s.slots.map(q => q.key)');
      check(got.join() === motif.sequence.join(), `N2: the ring holds the motif (${got.join(' ')})`);
    } else {
      if (info.mode === 'hints') check(info.card && info.rows >= 2 && info.rows <= 3, `N3: the hint card is shown (${info.rows} rows)`);
      const total = toppingTotal(order);
      // spots on the cake, well apart (screen px), from the scene's own hit test
      const spots = await sceneEval('Toppings', `s => { const out = [];
        for (const [dx, dy] of [[0, -40], [-70, 30], [70, 30], [0, 100], [-80, -60], [80, -60], [-140, 60], [140, 60], [-60, 130], [60, 130], [0, -120], [0, 40]]) {
          const x = Math.round(s.cakeX + dx); const y = 375 + dy;
          if (s.onCake(x, y)) out.push([x, y]);
        } return out; }`);
      check(spots.length >= total, `${spots.length} spots on the cake for ${total} toppings`);
      let i = 0;
      for (const { key, count } of order.toppings) {
        for (let k = 0; k < count; k++) await dragFromShelf(key, spots[i++]);
      }
      const n = await sceneEval('Toppings', 's => s.placed.length');
      check(n === total, `${n} toppings placed (${order.toppings.map(t => `${t.count} ${t.key}`).join(', ')})`);
    }
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

  async service({ shot: name, expectCoins, expectConfetti } = {}) {
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
    if (expectConfetti !== undefined) {
      const n = await evaluate('window.__confetti ?? -1');
      check(n >= 0 && (n > 0) === expectConfetti, expectConfetti ? `5/5 by day: confetti thrown (${n} emitter)` : `evening: no confetti (${n} emitter)`);
    }
    if (name) await shot(name);
    await tap(OK_BTN);
    await waitScene('Stand');
  },

  // Lot 1: from the home, the parent space sets the levels with real taps: `themes` = theme levels
  // ({lecture: n, nombres: n, temps: n, 'couleurs-fractions': n, logique: n}), `phase` = pâte's own level (n, or 'theme' for « Comme le thème »).
  async parentLevels({ themes = {}, phase } = {}) {
    await loadHome(URL);
    await tapEl('#gear');
    await waitFor('difficulty section', () => evaluate(`!!document.querySelector('#sec-difficulte [data-theme]')`));
    for (const [t, n] of Object.entries(themes)) {
      await tapEl(`#sec-difficulte [data-theme=${t}] [data-level="${n}"]`);
      await waitFor(`${t} level ${n}`, () => evaluate(`JSON.parse(localStorage.getItem('collection.v1')).levels?.[${JSON.stringify(t)}] === ${n}`));
    }
    if (phase !== undefined) {
      await tapEl(`#sec-difficulte [data-phase=pate] [data-level="${phase}"]`);
      await waitFor(`pâte level ${phase}`, () => evaluate(`(() => { const o = JSON.parse(localStorage.getItem('collection.v1')).overrides ?? {}; const v = Object.entries(o).find(([k]) => k.endsWith('/pate'))?.[1]; return ${phase === 'theme' ? 'v === undefined' : `v === ${phase}`}; })()`));
    }
    await tapEl('.p-head button');
    await waitFor('parent closed', () => evaluate(`document.querySelector('#parent').hidden`));
  },

  // Home → tile → Stand → Dough at the levels set in the parent space: one pâte round played (the
  // recipe is read, not forced), the Commande level read from the round.
  async levelRound({ n, hold, shot: name } = {}) {
    await tap(await elCenter(TILE));
    await waitFor('stand page', () => evaluate(`location.href === ${JSON.stringify(GAME_URL)}`).catch(() => false), 15000);
    await waitFor('Phaser hook', () => evaluate(HOOK).catch(() => false), 15000);
    await waitScene('Stand', 20000);
    lastClient = null;
    await actions.stand();
    const lv = await sceneEval('Dough', 's => s.round.levels');
    check(lv.commande === n && lv.pate === n, `the round plays at the levels set in the parent space (${JSON.stringify(lv)})`);
    const rec = await sceneEval('Dough', 's => s.round.recipe');
    const pre = Object.values(rec.prefilled ?? {}).some(v => v > 0);
    const pour = Object.keys(rec.target).reduce((a, k) => a + rec.target[k] - (rec.prefilled?.[k] ?? 0), 0);
    if (n === 1) check(!pre && !rec.double && Object.values(rec.target).every(v => v <= 4) && pour <= 8, `N1 recipe: plain dice up to 4, ${pour} <= 8 to pour (${JSON.stringify(rec.target)})`);
    if (n === 2) check(!pre && !rec.double && Object.values(rec.target).every(v => v <= 6) && pour <= 10, `N2 recipe: numbers up to 6, ${pour} <= 10 to pour (${JSON.stringify(rec.target)})`);
    if (n === 3) check(Object.values(rec.target).every(v => v <= 10) && pour <= 12, `N3 recipe: numbers up to 10, ${pour} <= 12 to pour (${JSON.stringify(rec.target)})`);
    await actions.dough({ shot: name, hold });
  },

  // Three pâte failures at pâte level 2 (set in the parent space): the parent space proposes to lower
  // the phase; Appliquer lowers pâte only (own level 1), the themes and the other phases stay.
  async pateProposal({ shot: name } = {}) {
    const read = () => evaluate(`(() => { const c = JSON.parse(localStorage.getItem('collection.v1')); return { levels: c.levels, overrides: c.overrides, history: Object.keys(c.history ?? {}) }; })()`);
    const before = await read();
    // three played rounds failed at pâte N2 (&record=1: the sample round counts at the stored levels)
    for (let i = 0; i < 3; i++) {
      await actions.forcedService({ score: 0, record: true });
    }
    await loadHome(URL);
    await tapEl('#gear');
    await waitFor('pâte proposal', () => evaluate(`!!document.querySelector('[data-reco^="phase:"][data-reco$="/pate"]')`));
    const text = await evaluate(`document.querySelector('[data-reco^="phase:"][data-reco$="/pate"] p').textContent`);
    check(/Baisser/.test(text) && /Pâte/.test(text) && /niveau 1/.test(text), `3 pâte failures: a « trop dur » proposal appears (${text})`);
    check(await evaluate(`document.querySelectorAll('[data-reco^="phase:"]').length`) === 1, 'only the pâte phase is proposed');
    if (name) await shot(name);
    await tapEl('[data-reco^="phase:"][data-reco$="/pate"] .primary');
    await waitFor('proposal applied', () => evaluate(`!document.querySelector('[data-reco^="phase:"]')`));
    const after = await read();
    const ov = Object.entries(after.overrides);
    check(ov.length === 1 && ov[0][0].endsWith('/pate') && ov[0][1] === 1, `Appliquer set pâte's own level to 1 and nothing else (${JSON.stringify(after.overrides)})`);
    check(JSON.stringify(after.levels) === JSON.stringify(before.levels), `the themes are unchanged (${JSON.stringify(after.levels)})`);
    const shown = await evaluate(`document.querySelector('[data-phase=pate] .p-level').textContent`);
    check(/niveau 1/.test(shown), `the parent space shows pâte at level 1 (${shown})`);
    await tapEl('.p-head button');
    await loadHome(URL);
    await tap(await elCenter(TILE));
    await waitFor('stand page', () => evaluate(`location.href === ${JSON.stringify(GAME_URL)}`).catch(() => false), 15000);
    await waitFor('Phaser hook', () => evaluate(HOOK).catch(() => false), 15000);
    await waitScene('Stand', 20000);
    await actions.stand();
    const lv = await sceneEval('Dough', 's => s.round.levels');
    check(lv.pate === 1 && lv.commande === 3, `next round: pâte N1, the other phase unchanged (${JSON.stringify(lv)})`);
  },

  // I1: the stand (fresh page) → home button → the parent resets the stand → back gesture
  // (history.back) → the stand must show 0 coins, not the old ones from the back-forward cache.
  async resetThenBack({ shot: name } = {}) {
    await send('Page.navigate', { url: GAME_URL });
    await waitFor('Phaser hook', () => evaluate(HOOK).catch(() => false), 15000);
    await waitScene('Stand', 20000);
    const before = await evaluate(`JSON.parse(localStorage.getItem('standDesserts.v1')).coins`);
    check(before > 0, `coins before the reset (${before})`);
    await evaluate('window.__smokeMarker = 1; true');
    await tap([79, 79]);
    await waitFor('home', () => evaluate(`location.pathname.endsWith('/index.html') && !!document.querySelector('${TILE}')`).catch(() => false), 15000);
    await tapEl('#gear');
    await waitFor('parent space', () => evaluate(`!!document.querySelector('[data-game="stand-desserts"] button')`));
    await tapEl('[data-game="stand-desserts"] button');
    await waitFor('confirmation', () => evaluate(`!!document.querySelector('[data-game="stand-desserts"] button.danger')`));
    await tapEl('[data-game="stand-desserts"] button.danger');
    await waitFor('reset', () => evaluate(`localStorage.getItem('standDesserts.v1') === null`));
    await tapEl('.p-head button');
    await evaluate('history.back(); true');
    await waitFor('back on the stand', () => evaluate(`location.href === ${JSON.stringify(GAME_URL)} && document.readyState === 'complete'`).catch(() => false), 15000);
    await waitFor('Phaser hook', () => evaluate(HOOK).catch(() => false), 15000);
    await waitScene('Stand', 20000);
    check(await evaluate('window.__smokeMarker === undefined'), 'the stand restored by the back gesture reloaded');
    const shown = await sceneEval('Stand', `s => s.children.list.find(o => o.type === 'Text' && o.depth === 500)?.text`);
    check(shown === '0', `after the reset and the back gesture the stand shows 0 coins (${shown})`);
    check(await evaluate(`localStorage.getItem('standDesserts.v1') === null`), 'the reset still holds');
    if (name) await shot(name);
  },

  // Opens the Service directly with the debug sample round and a forced score
  // (?debug&scene=Service&score=N), runs the Service checks, then goes on to the Stand. A sample
  // round saves no result for the parent's proposals unless `record` (&record=1).
  async forcedService({ score, now, expectConfetti, record = false, shot: name }) {
    const u = new globalThis.URL(GAME_URL);
    u.searchParams.set('debug', '1');
    if (now) u.searchParams.set('now', now);
    u.searchParams.set('scene', 'Service');
    u.searchParams.set('score', String(score));
    if (record) u.searchParams.set('record', '1');
    const history = () => evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('collection.v1') ?? '{}').history ?? {})`);
    const before = await history().catch(() => null);
    await send('Page.navigate', { url: u.href });
    await waitFor('Phaser hook', () => evaluate(HOOK), 15000);
    await waitScene('Service', 20000);
    roundClient = await sceneEval('Service', 's => JSON.stringify(s.client.client)');
    lastClient = roundClient; // the next Stand client must differ from the sample client
    wrongColor = null;
    if (!record && before !== null) {
      const after = await history();
      check(after === before, `a debug sample round saves no result (history ${after})`);
    }
    await actions.service({ shot: name, expectCoins: score, expectConfetti });
  },

  // I1: without the debug flag, ?scene= and &score= are ignored: the game starts at the Stand
  // and nothing is saved for the parent's proposals.
  async noDebugEntry() {
    const history = () => evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('collection.v1') ?? '{}').history ?? {})`);
    const before = await history();
    const u = new globalThis.URL(GAME_URL);
    u.searchParams.set('scene', 'Service');
    u.searchParams.set('score', '0');
    await send('Page.navigate', { url: u.href });
    await waitFor('Phaser hook', () => evaluate(HOOK), 15000);
    await waitScene('Stand', 20000);
    log('  ok: ?scene=Service&score=0 without ?debug starts at the Stand');
    check(await history() === before, 'no result saved by a link without ?debug');
    lastClient = null;
  },

  // C1: Commande N2, three clients in one page (Stand -> Shop -> Stand): the picture hides for
  // each of them (Phaser reuses the Stand scene: its per-run state must start again every time).
  async commandeN2Clients({ clients = 3, shot: name } = {}) {
    await loadHome(URL);
    await tap(await elCenter(TILE));
    await waitFor('stand page', () => evaluate(`location.href === ${JSON.stringify(GAME_URL)}`).catch(() => false), 15000);
    await waitFor('Phaser hook', () => evaluate(HOOK).catch(() => false), 15000);
    await evaluate('window.__smokePage = 1; true');
    for (let i = 1; i <= clients; i++) {
      await waitScene('Stand', 20000);
      await waitFor('client at the stand', () => sceneEval('Stand', 's => s.ready'));
      check((await sceneEval('Stand', 's => s.level')) === 2, `client ${i}: Commande N2`);
      // 5 s x the pace (calme) for the picture, then its fade
      await waitFor(`client ${i}: picture hidden`, () => sceneEval('Stand', 's => s.pictureHidden && s.picture.alpha === 0'), 20000);
      check(await evaluate('window.__smokePage === 1'), `client ${i}: picture hidden, same page`);
      if (name) await shot(`${name}-${i}`);
      if (i < clients) {
        await tap(LEFT_BTN);
        await waitScene('Shop');
        await tap(LEFT_BTN);
      }
    }
    lastClient = null;
    await loadHome(URL); // the next step starts from the home, as after parentLevels
  },
};

// ---- run ----------------------------------------------------------------------------------------
let failed = null;
try {
  // This run's Chrome writes its port (first line) into its own profile.
  const portFile = path.join(PROFILE, 'DevToolsActivePort');
  let port = null;
  for (let i = 0; i < 150 && !port; i++) {
    try { port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || null; } catch { /* not yet */ }
    if (!port) await sleep(200);
  }
  let targets;
  for (let i = 0; port && i < 75 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
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
await new Promise(r => (chrome.exitCode !== null || chrome.signalCode !== null ? r() : chrome.once('exit', r)));
fs.rmSync(PROFILE, { recursive: true, force: true });
log(`screenshots: ${outDir}`);
if (failed) {
  console.error(`SMOKE FAIL: ${failed.message}`);
  process.exit(1);
}
log('SMOKE PASS');
process.exit(0);
