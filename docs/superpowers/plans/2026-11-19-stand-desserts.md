# Stand de desserts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An ad-free, offline, installable Phaser web game for a 6-year-old: take a dessert order, prepare it through 5 touch mini-games, get paid, spend coins in a shop.

**Architecture:** Static site, no build step. Pure game logic lives in `src/logic/*.js` (ES modules, no Phaser, unit-tested with `node --test`). Phaser scenes in `src/scenes/` and shared widgets in `src/ui/` consume that logic; Phaser is a vendored global script. A module service worker precaches every file listed in `src/assets.js` for offline play.

**Tech Stack:** Phaser 3.90.0 (vendored `vendor/phaser.min.js`), plain ES modules, SVG art loaded with `this.load.svg`, Node 24 built-in test runner, PWA (manifest + module service worker).

**Spec:** `docs/superpowers/specs/2026-11-19-stand-desserts-design.md` — read it before any task.

## Global Constraints

- No ads, no in-app purchases, no external links, **no network requests at runtime** other than the game's own origin.
- **No text needed to play**: every in-game cue is an icon, number, gauge or face. Text is allowed only inside the hidden parent zone.
- **No sound** in this version. All sprite/animation code must not assume audio.
- **No npm dependencies.** `package.json` exists only for `"type": "module"` and the `test` script. Phaser is the only third-party code, vendored and pinned at 3.90.0.
- Art: style "B" — saturated colours, **5px black (#222222) outlines**, cartoon. Only CC0 third-party art; every file listed in `ASSETS-LICENSES.md`.
- Reference resolution **1280×800, landscape**, `Phaser.Scale.FIT`, centred. Every tappable target ≥ **96×96 px** in reference coordinates.
- Must stay smooth on an older Samsung Galaxy Tab S: paint coverage on a **64×64** grid, at most **60** live particles at once.
- Save locally only (`localStorage`, key `standDesserts.v1`). No accounts, no server code.
- Must be served over **HTTPS** for install/offline (localhost is fine for development).
- No "game over": every client ends at the Service screen, then a new client.
- Every step has ↺ (restart the whole step) and ✓ (lock the step and move on). No per-gesture undo. After ✓, no going back.

## Review Focus

1. Storage unavailable or corrupted (private mode, quota, garbage JSON, `localStorage` throwing) → game starts with the default state and keeps running; nothing crashes. *(Task 2 test)*
2. Shop: tapping an item she can't afford or already owns → nothing is bought, coins unchanged. *(Task 2 test)*
3. Orders only ever use owned items, including with the bare starter set and right after a purchase. *(Task 3 test)*
4. Tablet sleeps, tab is switched, or a frame stalls during baking → the cake must not jump to burnt; baking only advances by clamped per-frame time. *(Task 5 test)*
5. Offline: a file referenced by the game but missing from the precache list (or listed but missing on disk) breaks the installed app silently. *(Task 6 test)*

---

## File Structure

```
index.html                 page shell, loads vendor/phaser.min.js then src/main.js (module)
manifest.webmanifest       PWA manifest
sw.js                      module service worker (imports src/assets.js)
package.json               {"type":"module","scripts":{"test":"node --test tests/"}}
vendor/phaser.min.js       Phaser 3.90.0
assets/…                   SVG art (Task 6), icons/ PNG app icons (Task 14)
ASSETS-LICENSES.md         source + licence for every asset
DEPLOY.md                  upload + tablet install instructions (French)
src/assets.js              ASSETS list + PRECACHE list (single source of truth)
src/config.js              W, H, palette, sizes
src/game-state.js          in-memory State + Round, persisted via logic/save.js
src/main.js                Phaser.Game config, scene registry, SW registration
src/logic/catalog.js       desserts, recipes, ingredients, shop items, prices
src/logic/rng.js           seeded RNG for tests
src/logic/save.js          load/save/reset State
src/logic/economy.js       coins + buying
src/logic/order.js         order generation
src/logic/scoring.js       judges per step + round score
src/logic/round.js         Round data (order + cake being built + results)
src/logic/stir.js          stir gesture tracker
src/logic/bake.js          bake gauge timer + bake state
src/logic/paint.js         paint grid, mask from alpha, coverage
src/ui/button.js           big icon buttons
src/ui/stepBar.js          ↺ / ✓ bar
src/ui/orderReminder.js    order strip shown on every prep screen
src/ui/cakeView.js         draws the cake-in-progress from Round.cake
src/ui/client.js           draws a client (variant + mood)
src/ui/flow.js             scene order + transitions
src/scenes/{Boot,Stand,Dough,Mold,Bake,Paint,Toppings,Service,Shop}Scene.js
tests/*.test.js            one file per logic module + assets test
```

---

### Task 1: Skeleton and catalog

**Files:**
- Create: `package.json`, `src/logic/catalog.js`, `src/logic/rng.js`
- Test: `tests/catalog.test.js`

**Interfaces:**
- Produces:
  - `INGREDIENTS: string[]` = `['oeuf','farine','sucre','beurre','lait','chocolat']`
  - `DESSERTS: Record<'gateau'|'tarte'|'cupcake', {recipe: Record<string,number>, heat: 1|2|3}>` with exact values:
    - `gateau`: recipe `{oeuf:2, farine:1, sucre:1, beurre:1}`, heat `2`
    - `tarte`: recipe `{farine:2, beurre:1, sucre:1}`, heat `3`
    - `cupcake`: recipe `{oeuf:1, farine:1, sucre:1, lait:1}`, heat `1`
  - `ITEMS: Array<{id: string, kind: 'shape'|'color'|'topping'|'deco', key: string, price: number}>`; `id` is `` `${kind}:${key}` ``. Exact list (price 0 = owned from start):
    - shape: rond 0, carre 0, coeur 0, etoile 8, licorne 16
    - color: rose 0, violet 0, jaune 0, blanc 0, bleu 10, vert 12
    - topping: fraise 0, pepites 0, vermicelles 0, bougie 0, etoile 8, bonbon 12, chantilly 14
    - deco: guirlande 10, auvent 15, pancarte 20
  - `starterOwned(): string[]` — ids with price 0
  - `ownedKeys(owned: string[], kind): string[]` — the `key`s of owned items of that kind, in `ITEMS` order
  - `itemById(id): Item | undefined`
  - `makeRng(seed: number): () => number` (mulberry32, returns [0,1)) in `rng.js`

- [ ] **Step 1: Create `package.json`** with exactly `{"name":"stand-desserts","private":true,"type":"module","scripts":{"test":"node --test tests/"}}`.

- [ ] **Step 2: Write the failing tests** in `tests/catalog.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENTS, DESSERTS, ITEMS, starterOwned, ownedKeys, itemById } from '../src/logic/catalog.js';
import { makeRng } from '../src/logic/rng.js';

test('every recipe ingredient exists and each recipe leaves at least one intruder', () => {
  for (const d of Object.values(DESSERTS)) {
    for (const ing of Object.keys(d.recipe)) assert.ok(INGREDIENTS.includes(ing));
    assert.ok(INGREDIENTS.some(i => !(i in d.recipe)));
  }
});
test('starter set matches the spec', () => {
  const s = starterOwned();
  assert.deepEqual(ownedKeys(s, 'shape'), ['rond','carre','coeur']);
  assert.deepEqual(ownedKeys(s, 'color'), ['rose','violet','jaune','blanc']);
  assert.deepEqual(ownedKeys(s, 'topping'), ['fraise','pepites','vermicelles','bougie']);
  assert.deepEqual(ownedKeys(s, 'deco'), []);
});
test('ids are unique and kind-prefixed', () => {
  const ids = ITEMS.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(itemById('topping:etoile').price, 8);
  assert.equal(itemById('shape:etoile').kind, 'shape');
});
test('cheapest shop item is 8 coins', () => {
  assert.equal(Math.min(...ITEMS.filter(i => i.price > 0).map(i => i.price)), 8);
});
test('rng is deterministic and in range', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
});
```

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (modules not found).
- [ ] **Step 4: Implement** `catalog.js` and `rng.js` with the interfaces above.
- [ ] **Step 5: Run** `npm test` — Expected: all PASS.
- [ ] **Step 6: Commit** — `git add package.json src/logic tests && git commit -m "feat: catalog of desserts, recipes and shop items"`

---

### Task 2: Save state and economy

**Files:**
- Create: `src/logic/save.js`, `src/logic/economy.js`
- Test: `tests/save.test.js`, `tests/economy.test.js`

**Interfaces:**
- Consumes: `starterOwned`, `itemById` (Task 1)
- Produces:
  - `type State = {version: 1, coins: number, owned: string[]}`
  - `STORAGE_KEY = 'standDesserts.v1'`
  - `defaultState(): State` — coins 0, owned = `starterOwned()`
  - `loadState(storage): State` — `storage` is localStorage-like (`getItem/setItem/removeItem`). Returns `defaultState()` if missing, unparsable, wrong version, wrong types, or if `storage` is null or throws. Always re-adds starter items missing from `owned`; drops unknown ids.
  - `saveState(storage, state): boolean` — false (no throw) on failure
  - `resetState(storage): State` — removes the key, returns `defaultState()`
  - `addCoins(state, n): State` (new object; n ≥ 0 integer)
  - `canBuy(state, id): boolean` — known id, not owned, `coins >= price`
  - `buy(state, id): State | null` — null when `!canBuy`; otherwise coins − price and id appended

- [ ] **Step 1: Write failing tests.** Use a `fakeStorage()` helper (Map-backed) and a `throwingStorage` whose every method throws.

```js
// tests/save.test.js
test('missing key -> default state', …assert.deepEqual(loadState(fakeStorage()), defaultState()));
test('round trip', () => { const s = fakeStorage(); const st = { ...defaultState(), coins: 7 };
  assert.equal(saveState(s, st), true); assert.deepEqual(loadState(s), st); });
test('garbage JSON -> default', () => { const s = fakeStorage(); s.setItem(STORAGE_KEY, '{oops'); assert.deepEqual(loadState(s), defaultState()); });
test('wrong shape -> default', () => { /* coins: "12", owned: null, version: 2 → each gives defaultState() */ });
test('throwing or null storage never throws', () => {
  assert.deepEqual(loadState(throwingStorage), defaultState());
  assert.deepEqual(loadState(null), defaultState());
  assert.equal(saveState(throwingStorage, defaultState()), false);
  assert.deepEqual(resetState(throwingStorage), defaultState());
});
test('unknown ids dropped, missing starters re-added', () => { /* owned: ['shape:rond','foo:bar'] → owned equals starterOwned() */ });
test('reset removes the key', () => { /* after resetState, getItem(STORAGE_KEY) === null */ });

// tests/economy.test.js
test('buy deducts price and adds item', () => { const s = { ...defaultState(), coins: 10 };
  const r = buy(s, 'topping:etoile'); assert.equal(r.coins, 2); assert.ok(r.owned.includes('topping:etoile')); assert.equal(s.coins, 10); });
test('cannot afford -> null, state untouched', () => { assert.equal(buy({ ...defaultState(), coins: 7 }, 'topping:etoile'), null); });
test('already owned -> null', () => { assert.equal(buy({ ...defaultState(), coins: 99 }, 'shape:rond'), null); });
test('unknown id -> null', () => { assert.equal(buy({ ...defaultState(), coins: 99 }, 'shape:dragon'), null); });
test('addCoins is immutable', () => { const s = defaultState(); assert.equal(addCoins(s, 3).coins, 3); assert.equal(s.coins, 0); });
```

- [ ] **Step 2: Run** `npm test` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** `save.js` and `economy.js` per the interfaces (wrap every storage call in try/catch).
- [ ] **Step 4: Run** `npm test` — Expected: all PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: local save and shop economy"`

---

### Task 3: Order generation

**Files:**
- Create: `src/logic/order.js`
- Test: `tests/order.test.js`

**Interfaces:**
- Consumes: `DESSERTS`, `ownedKeys` (Task 1), `makeRng` (Task 1)
- Produces:
  - `type Order = {dessert: 'gateau'|'tarte'|'cupcake', shape: string, color: string, topping: string, toppingCount: 1|2|3|4|5}`
  - `generateOrder(owned: string[], rng = Math.random): Order` — uniform pick among the 3 desserts and among owned shapes/colors/toppings; `toppingCount` uniform 1..5.

- [ ] **Step 1: Write failing tests:**

```js
test('starter set: 2000 orders only use owned items, counts 1..5, all values reached', () => {
  const rng = makeRng(1); const owned = starterOwned(); const seen = { dessert: new Set(), count: new Set() };
  for (let i = 0; i < 2000; i++) {
    const o = generateOrder(owned, rng);
    assert.ok(o.dessert in DESSERTS);
    assert.ok(ownedKeys(owned, 'shape').includes(o.shape));
    assert.ok(ownedKeys(owned, 'color').includes(o.color));
    assert.ok(ownedKeys(owned, 'topping').includes(o.topping));
    assert.ok(Number.isInteger(o.toppingCount) && o.toppingCount >= 1 && o.toppingCount <= 5);
    seen.dessert.add(o.dessert); seen.count.add(o.toppingCount);
  }
  assert.equal(seen.dessert.size, 3); assert.equal(seen.count.size, 5);
});
test('a purchased item starts appearing in orders', () => {
  const owned = [...starterOwned(), 'shape:etoile']; const rng = makeRng(2);
  assert.ok(Array.from({ length: 500 }, () => generateOrder(owned, rng)).some(o => o.shape === 'etoile'));
});
test('owning only deco extras never leaks deco into orders', () => { /* owned + 'deco:auvent' → no field equals 'auvent' over 500 orders */ });
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement** `generateOrder`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: order generation from owned items"`

---

### Task 4: Judges, round score and Round data

**Files:**
- Create: `src/logic/scoring.js`, `src/logic/round.js`
- Test: `tests/scoring.test.js`

**Interfaces:**
- Consumes: `DESSERTS` (Task 1), `Order` (Task 3)
- Creates `src/logic/bake.js` with `GREEN_MIN = 0.45`, `GREEN_MAX = 0.70` and `bakeState` (below); Task 5 adds the timer to the same file.
- Produces:
  - `type Judgement = {ok: boolean, reason?: string}`
  - `judgeDough(added: Record<string,number>, stirProgress: number, dessert): Judgement` — reasons in priority order: `'intrus'` (any ingredient not in recipe), `'manque'` (any recipe count short), `'trop'` (any count over), `'pas-melange'` (`stirProgress < 1`).
  - `judgeShape(shape, order): Judgement` — reason `'mauvaise-forme'`
  - `bakeState(gauge): 'pale'|'dore'|'brule'` — `< 0.45` pale, `0.45..0.70` inclusive dore, `> 0.70` brule
  - `judgeBake(gauge): Judgement` — reason `'pale'` or `'brule'`
  - `COVERAGE_OK = 0.85`
  - `judgeColor(coverage: Record<string,number>, order): Judgement` — ok iff `coverage[order.color] >= 0.85`; else `'mauvaise-couleur'` if another colour has the largest coverage, otherwise `'pas-couvert'`
  - `judgeToppings(placed: string[], order): Judgement` — reasons in priority: `'mauvais-topping'` (any key ≠ order.topping), `'pas-assez'`, `'trop'`
  - `STEPS = ['pate','moule','cuisson','couleur','toppings']`
  - `scoreRound(results: Record<step, Judgement>): {coins: 0..5, mood: 'content'|'bof'|'fache'}` — coins = number of ok; mood 5 → content, 3–4 → bof, 0–2 → fache
  - `round.js`: `type Cake = {dessert, doughOk: boolean|null, shape: string|null, bake: 'pale'|'dore'|'brule'|null, glaze: {cells: Uint8Array, size: number, colorKeys: string[]}|null, toppings: Array<{key: string, x: number, y: number}>}`; `type Round = {order: Order, cake: Cake, results: Partial<Record<step, Judgement>>}`; `createRound(order): Round`

- [ ] **Step 1: Write failing tests** (one per reason, plus boundaries):

```js
const order = { dessert: 'gateau', shape: 'coeur', color: 'rose', topping: 'fraise', toppingCount: 3 };
test('dough exact + stirred is ok', () => assert.deepEqual(judgeDough({ oeuf: 2, farine: 1, sucre: 1, beurre: 1 }, 1, 'gateau'), { ok: true }));
test('dough intruder beats missing', () => assert.equal(judgeDough({ oeuf: 1, lait: 1 }, 1, 'gateau').reason, 'intrus'));
test('dough missing', () => assert.equal(judgeDough({ oeuf: 1, farine: 1, sucre: 1, beurre: 1 }, 1, 'gateau').reason, 'manque'));
test('dough too much', () => assert.equal(judgeDough({ oeuf: 3, farine: 1, sucre: 1, beurre: 1 }, 1, 'gateau').reason, 'trop'));
test('dough not stirred', () => assert.equal(judgeDough({ oeuf: 2, farine: 1, sucre: 1, beurre: 1 }, 0.99, 'gateau').reason, 'pas-melange'));
test('bake thresholds', () => { assert.equal(bakeState(0.449), 'pale'); assert.equal(bakeState(0.45), 'dore'); assert.equal(bakeState(0.70), 'dore'); assert.equal(bakeState(0.701), 'brule'); });
test('color ok at 0.85', () => assert.equal(judgeColor({ rose: 0.85 }, order).ok, true));
test('color wrong colour dominates', () => assert.equal(judgeColor({ rose: 0.2, violet: 0.7 }, order).reason, 'mauvaise-couleur'));
test('color under-covered', () => assert.equal(judgeColor({ rose: 0.6, violet: 0.1 }, order).reason, 'pas-couvert'));
test('toppings exact', () => assert.equal(judgeToppings(['fraise','fraise','fraise'], order).ok, true));
test('toppings wrong kind beats count', () => assert.equal(judgeToppings(['fraise','bougie'], order).reason, 'mauvais-topping'));
test('toppings too few / too many', () => { assert.equal(judgeToppings(['fraise'], order).reason, 'pas-assez'); assert.equal(judgeToppings(Array(4).fill('fraise'), order).reason, 'trop'); });
test('score and mood', () => { /* 5 ok → {coins:5,mood:'content'}; 3 ok → bof; 2 ok → fache; 0 ok → {coins:0,mood:'fache'} */ });
test('createRound starts empty', () => { const r = createRound(order); assert.equal(r.cake.dessert, 'gateau'); assert.deepEqual(r.cake.toppings, []); assert.deepEqual(r.results, {}); });
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement** `scoring.js`, `round.js`, and `bakeState` + `GREEN_MIN/GREEN_MAX` in `bake.js` (scoring imports them).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: step judges and round scoring"`

---

### Task 5: Gesture and timing math (stir, bake timer, paint grid)

**Files:**
- Create: `src/logic/stir.js`, `src/logic/paint.js`
- Modify: `src/logic/bake.js` (add timer)
- Test: `tests/stir.test.js`, `tests/bake.test.js`, `tests/paint.test.js`

**Interfaces:**
- Produces:
  - `TURNS_NEEDED = 4`; `createStirTracker(cx, cy): {addPoint(x, y): void, breakStroke(): void, progress(): number, reset(): void}` — accumulates the **net signed** angle swept around (cx, cy); points closer than 20 px to the centre are ignored and break the chain (the next valid point only sets a new reference); `progress = min(1, |net| / (2π·4))`. Progress persists across strokes: the scene calls `breakStroke()` on pointer-up, which drops only the reference point; `reset()` (↺) zeroes everything.
  - `MAX_DT = 100`; `bakeRate(heat, target): number` gauge-per-ms — base `1/10000` when `heat === target`; multiplied by `{+1: 2, +2: 3, -1: 0.5, -2: 0.25}[heat - target]`
  - `createBakeTimer(heat, target): {tick(dtMs): void, gauge(): number}` — each tick adds `rate * min(dtMs, 100)` (negative/NaN dt ignored); gauge clamped to [0, 1]
  - `GRID = 64`; `BRUSH_RADIUS = 4` (cells)
  - `maskFromAlpha(rgba: Uint8ClampedArray, w, h, size = 64): Uint8Array` — cell = 1 if the source pixel at the cell centre has alpha > 127
  - `createPaintGrid(mask: Uint8Array, size = 64): {paint(u, v, colorIdx, radius = 4): void, coverage(colorKeys: string[]): Record<string, number>, cells: Uint8Array, clear(): void}` — `u, v` in cell units (floats ok); paints only masked cells; `colorIdx` is 1-based index into `colorKeys`; coverage = painted cells of that colour ÷ masked cells; repainting overwrites.

- [ ] **Step 1: Write failing tests:**

```js
// stir
test('four full circles complete the stir', () => { const t = createStirTracker(0, 0);
  for (let a = 0; a <= 8 * Math.PI + 0.01; a += 0.2) t.addPoint(100 * Math.cos(a), 100 * Math.sin(a)); assert.equal(t.progress(), 1); });
test('two circles = half', () => { /* 0..4π → progress ≈ 0.5 (±0.02) */ });
test('counter-clockwise counts the same', () => { /* angles going negative → 1 */ });
test('wiggling back and forth does not progress', () => { /* 50 times: +0.5 rad then −0.5 rad → progress < 0.05 */ });
test('points near the centre are ignored', () => { /* circle of radius 10 → progress 0 */ });
test('breakStroke does not lose progress', () => { /* 2 circles, breakStroke, 2 more circles starting at a different angle → ≥ 0.98 */ });
// bake
test('at target heat, 10 s fills the gauge', () => { const b = createBakeTimer(2, 2); for (let i = 0; i < 625; i++) b.tick(16); assert.ok(Math.abs(b.gauge() - 1) < 1e-9); });
test('green window at target is 2.5 s', () => { /* time from 0.45 to 0.70 at rate 1/10000 = 2500 ms */ });
test('hotter is faster, colder is slower', () => { assert.equal(bakeRate(3, 2), 2 / 10000); assert.equal(bakeRate(1, 3), 0.25 / 10000); });
test('a huge frame gap is clamped (tablet slept)', () => { const b = createBakeTimer(2, 2); b.tick(60000); assert.equal(b.gauge(), 0.01); });
test('negative or NaN dt is ignored', () => { /* tick(-50), tick(NaN) → gauge 0 */ });
// paint
test('mask from alpha', () => { /* 2×2 rgba image: alpha [255,0,0,255], size 2 → [1,0,0,1] */ });
test('painting a full square mask gives full coverage', () => { const g = createPaintGrid(new Uint8Array(64 * 64).fill(1));
  for (let u = 0; u < 64; u += 2) for (let v = 0; v < 64; v += 2) g.paint(u, v, 1); assert.equal(g.coverage(['rose']).rose, 1); });
test('cells outside the mask are never painted or counted', () => { /* half mask; paint everything → coverage 1, cells outside stay 0 */ });
test('overpainting changes colour share', () => { /* paint all colour 1, then half with colour 2 → rose ≈ 0.5, violet ≈ 0.5 */ });
test('clear resets', () => { /* paint, clear → coverage 0 */ });
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement** the three modules. Stir: per point, `delta = atan2` difference wrapped to (−π, π], add to `net`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: stir, bake and paint math"`

---

### Task 6: Art and asset manifest

**Files:**
- Create: `assets/**.svg`, `src/assets.js`, `ASSETS-LICENSES.md`
- Test: `tests/assets.test.js`

**Interfaces:**
- Consumes: `INGREDIENTS`, `DESSERTS`, `ITEMS` (Task 1)
- Produces:
  - `ASSETS: Array<{key: string, file: string, w: number, h: number}>` — every SVG the game loads, `file` relative to site root
  - `PRECACHE: string[]` — `['./', 'index.html', 'manifest.webmanifest', 'vendor/phaser.min.js', ...all src/**/*.js, ...ASSETS files, ...icons]`. Keep the `src/` list explicit in this file; Task 14 appends icons.
  - Texture keys (exact):
    - `ing-<ingredient>` for each of `INGREDIENTS`
    - `dessert-<gateau|tarte|cupcake>` — square fill texture of the dessert's body (sponge / crust / cupcake), drawn in its **raw** colour; bake states are tints applied in code
    - `shape-<key>-fill` (white silhouette, transparent outside — used as mask, glaze area and paint-coverage source) and `shape-<key>-line` (black 5px outline only) for every shape item
    - `topping-<key>` for every topping item
    - `deco-<key>` for every deco item
    - `pot` (glaze pot drawn white, tinted in code), `bowl`, `whisk`, `oven`, `flame`, `lumps` (overlay for failed dough)
    - `client-head`, `client-hair-1..3`, `client-body` (white, tinted), `face-content`, `face-bof`, `face-fache`
    - `stand-awning`, `stand-counter`, `bubble`, `coin`
    - `icon-ok`, `icon-ko`, `icon-restart`, `icon-next`, `icon-shop`, `icon-go` (▶ start oven), `icon-out` (take out of oven)
  - Sizes: ingredients/toppings/icons 160×160, shapes and desserts 400×400 (all shape silhouettes share the same 400×400 frame, centred), client parts 300×300, oven 500×450, stand pieces 1280-wide.

- [ ] **Step 1: Write the failing test** `tests/assets.test.js`:

```js
test('every catalog item has its textures', () => { /* for each INGREDIENT, DESSERT, and ITEM by kind, the expected key(s) exist in ASSETS */ });
test('every ASSETS file exists on disk and is valid SVG', () => { /* fs.existsSync; content includes '<svg' and a viewBox */ });
test('every file under assets/ is listed in ASSETS (no orphan, no forgotten)', () => { /* walk assets/ (excluding assets/icons/) */ });
test('every ASSETS file and every src/**/*.js is in PRECACHE', () => { /* walk src/ */ });
test('keys are unique', () => {});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Draw the SVGs** in style B (5px `#222` outlines, palette in `src/config.js` from Task 7 — use bg `#4fc3f7`, counter `#ff9800`, accents `#ff1f5a`, `#ffeb3b`, `#00e676`). CC0 sources (e.g. OpenGameArt "SVG dessert ingredients", Kenney) may be used only if restyled to match; otherwise draw originals.
- [ ] **Step 4: Write `src/assets.js`** and fill `ASSETS-LICENSES.md` (one row per file: source URL or "original", licence).
- [ ] **Step 5: Run** `npm test` — Expected: PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: game art and asset manifest"`

---

### Task 7: Phaser shell, shared UI and scene flow

**Files:**
- Create: `vendor/phaser.min.js`, `index.html`, `src/main.js`, `src/config.js`, `src/game-state.js`, `src/ui/button.js`, `src/ui/stepBar.js`, `src/ui/orderReminder.js`, `src/ui/cakeView.js`, `src/ui/client.js`, `src/ui/flow.js`, `src/scenes/BootScene.js`, and placeholder versions of every other scene (coloured background + a ✓ that calls `goNext`)

**Interfaces:**
- Consumes: Tasks 1–6
- Produces:
  - `config.js`: `W = 1280`, `H = 800`, `OUTLINE = 0x222222`, `BG = 0x4fc3f7`, `COUNTER = 0xff9800`, `TOUCH = 110` (button size), `COLOR_HEX = {rose: 0xff8fb7, violet: 0x7c4dff, jaune: 0xffeb3b, blanc: 0xffffff, bleu: 0x2979ff, vert: 0x00e676}`, `BAKE_TINT = {raw: 0xffffff, pale: 0xfff3c4, dore: 0xe0a65a, brule: 0x5d4037}`
  - `game-state.js`: `getState(): State`, `updateState(fn: (State) => State): State` (applies, then `saveState(localStorage-or-null, …)`), `getRound(): Round`, `newRound(): Round` (calls `generateOrder(getState().owned)`), and `getStorage()` that returns `null` if `localStorage` access throws
  - `button.js`: `addIconButton(scene, x, y, textureKey, onTap, {size = TOUCH, tint} = {}): Phaser.GameObjects.Image` — white circle with 5px outline behind the icon, squash tween on press, fires on pointerup inside
  - `stepBar.js`: `addStepBar(scene, {onRestart, onValidate}): {setValidateEnabled(on: boolean): void}` — ↺ bottom-left, ✓ bottom-right; ✓ greyed and inert until enabled
  - `orderReminder.js`: `addOrderReminder(scene, order): Phaser.GameObjects.Container` — top-left white rounded strip: dessert icon, shape outline, colour dot, topping icon ×N (N copies, and the digit)
  - `cakeView.js`: `drawCake(scene, x, y, cake: Cake, {size = 400, bakeGauge}: {size?: number, bakeGauge?: number} = {}): Phaser.GameObjects.Container` — layers bottom→top: `dessert-<d>` masked by `shape-<shape>-fill` (BitmapMask) and tinted by bake (`bakeGauge` lerps raw→pale→dore→brule; else `cake.bake`), `lumps` if `doughOk === false`, glaze drawn from `cake.glaze.cells` (one rect per painted cell in `COLOR_HEX`) under the same mask, toppings at their `x, y` (relative to centre, at `size` scale), then `shape-<shape>-line`. When `shape` is null, draw the batter in the bowl colour instead (used by the Dough scene).
  - `client.js`: `drawClient(scene, x, y, variant: number, mood?: 'content'|'bof'|'fache'): Phaser.GameObjects.Container` — 4 variants (hair texture + skin/body tints); idle bob tween
  - `flow.js`: `ORDER = ['Stand','Dough','Mold','Bake','Paint','Toppings','Service']`; `goNext(scene)` (Service → Stand), `goTo(scene, key)`; both do a 250 ms fade
  - `main.js`: Phaser game `{type: AUTO, width: W, height: H, backgroundColor: BG, scale: {mode: FIT, autoCenter: CENTER_BOTH}, input: {activePointers: 1}, scene: [...] }`

- [ ] **Step 1: Vendor Phaser**: `curl -fL -o vendor/phaser.min.js https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js` — Expected: file > 1 MB, `head -c 200` mentions Phaser.
- [ ] **Step 2: Write the modules** above. `index.html`: viewport `width=device-width, initial-scale=1, user-scalable=no`, `body{margin:0;background:#4fc3f7;overflow:hidden;touch-action:none}`, `<script src="vendor/phaser.min.js">` then `<script type="module" src="src/main.js">`. `BootScene` loads every `ASSETS` entry with `this.load.svg(key, file, {width: w, height: h})` and shows a coin progress bar.
- [ ] **Step 3: Run** `npm test` — Expected: all PASS (the assets test now also sees the new `src/` files in PRECACHE; add them).
- [ ] **Step 4: Verify in the browser**: `python3 -m http.server 8000`, open `http://localhost:8000` in Chrome DevTools device mode, 1280×800, touch. Expected: Boot → Stand placeholder; tapping ✓ walks through all 7 scenes and back to Stand; each prep placeholder shows the order reminder and a sample `drawCake` (use a hard-coded cake: heart, dore, half-painted rose glaze, 3 strawberries); no console errors; no network request leaves localhost.
- [ ] **Step 5: Commit** — `git commit -m "feat: Phaser shell, shared UI and scene flow"`

---

### Task 8: Stand scene (order) and parent zone

**Files:**
- Modify: `src/scenes/StandScene.js`

**Interfaces:**
- Consumes: `newRound`, `getState`, `updateState`, `drawClient`, `addIconButton`, `goNext`, `goTo`, `resetState`, `ownedKeys`

**Behaviour (spec §0):** stand background (awning, counter, owned decos placed at fixed spots), coin counter (coin icon + number) top-right, shop button bottom-left (`icon-shop` → `goTo('Shop')`). A client walks in from the right (tween ~800 ms), then a speech bubble shows the order **one step at a time**: dessert → shape (outline) → colour (big blob) → topping ×N (N icons). Four progress dots above the bubble. ✓ (or tapping the bubble) advances; after the 4th, ✓ → `goNext` (Dough). A new round is created on scene create.
Parent zone: a long press of **3 s** in the top-left 120×120 px opens an overlay (text allowed): "Remettre à zéro ?" with "Oui" / "Non". "Oui" → `resetState` + `updateState(() => defaultState())` + restart scene.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in the browser** (same setup as Task 7): client enters; 4 bubbles in order with dots; ✓ goes to Dough; a 1 s press top-left does nothing, a 3 s press opens the overlay; "Non" closes it; "Oui" sets coins to 0 (check after earning some in Task 12, or set `localStorage` by hand in DevTools first).
- [ ] **Step 3: Commit** — `git commit -m "feat: order taking at the stand"`

---

### Task 9: Dough scene

**Files:** Modify: `src/scenes/DoughScene.js`

**Interfaces:**
- Consumes: `DESSERTS`, `INGREDIENTS`, `createStirTracker`, `judgeDough`, `addStepBar`, `addOrderReminder`, `getRound`

**Behaviour (spec §1):** recipe card top-right: each recipe ingredient icon with "×N". Shelf along the bottom with **all 6** `INGREDIENTS` (intruders included), in a fixed order. Dragging an ingredient copy into the bowl drops it in (small splash particles); dropping elsewhere sends it back. Once at least one ingredient is in, a whisk appears next to the bowl; dragging in circles over the bowl calls `addPoint` (pointer-up → `breakStroke`); the batter swirls and a ring around the bowl fills with `progress()`. ✓ is enabled once any ingredient is added. ↺ empties the bowl and resets the tracker. ✓ → `round.results.pate = judgeDough(...)`, `round.cake.doughOk = result.ok`, `goNext`. No hint is given about correctness before ✓.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in the browser:** exact recipe + 4 circles → (log `round.results.pate` in console) `{ok:true}`; adding milk to a gâteau → `intrus`; 2 circles only → `pas-melange`; ↺ empties everything; dragging off the bowl returns the ingredient.
- [ ] **Step 3: Commit** — `git commit -m "feat: dough mini-game"`

---

### Task 10: Mold and Bake scenes

**Files:** Modify: `src/scenes/MoldScene.js`, `src/scenes/BakeScene.js`

**Interfaces:**
- Consumes: `ownedKeys`, `judgeShape`, `createBakeTimer`, `bakeState`, `judgeBake`, `GREEN_MIN`, `GREEN_MAX`, `drawCake`, `addStepBar`, `addOrderReminder`

**Mold (spec §2):** one big button per owned shape (its outline). Tap = select (highlight + batter pours into it via `drawCake` with that shape). ✓ enabled once selected; ↺ clears. ✓ → `results.moule = judgeShape`, `cake.shape = chosen`, `goNext`.

**Bake (spec §3):** order reminder also shows the target flames (`DESSERTS[d].heat` × `flame`). Three heat buttons (1/2/3 flames), then `icon-go` starts the oven. While baking, `timer.tick(delta)` in `update`; the cake in the oven window grows from 85% to 100% scale with gauge 0→0.45 and is tinted via `drawCake(..., {bakeGauge})`; a vertical gauge (yellow < 0.45, green 0.45–0.70, brown > 0.70) with a moving pointer; a few rising heat particles. `icon-out` stops the timer and shows the result. Heat is locked once started. ✓ enabled only after taking it out. ↺ (any time, including after taking out) resets heat, timer and cake. ✓ → `results.cuisson = judgeBake(gauge)`, `cake.bake = bakeState(gauge)`, `goNext`.

- [ ] **Step 1: Implement both.**
- [ ] **Step 2: Verify in the browser:** at target heat, taking out ~5.5 s after start → `dore`, ok; waiting → `brule`; at heat +1 the green window is visibly shorter; switching tab for 10 s mid-bake and returning → gauge has not jumped; ↺ after a burnt result gives a fresh cake.
- [ ] **Step 3: Commit** — `git commit -m "feat: mold and bake mini-games"`

---

### Task 11: Paint and Toppings scenes

**Files:** Modify: `src/scenes/PaintScene.js`, `src/scenes/ToppingsScene.js`

**Interfaces:**
- Consumes: `maskFromAlpha`, `createPaintGrid`, `GRID`, `judgeColor`, `judgeToppings`, `ownedKeys`, `COLOR_HEX`, `drawCake`, `addStepBar`, `addOrderReminder`

**Paint (spec §4):** cake drawn large (size 480) in the centre. Build the mask once from the `shape-<shape>-fill` texture pixels (draw the source image to a canvas, `getImageData`, `maskFromAlpha`). Pots for owned colours on the shelf (tinted `pot`); tap a pot to select it (it lifts). Dragging over the cake paints grid cells (convert pointer → cell u,v) and redraws the glaze layer; a horizontal fill bar shows coverage of the **selected** colour. ✓ enabled once anything is painted. ↺ clears. ✓ → `results.couleur = judgeColor(grid.coverage(colorKeys), order)`, `cake.glaze = {cells, size: GRID, colorKeys}`, `goNext`.

**Toppings (spec §5):** owned toppings on the shelf; drag a copy onto the cake — kept only if dropped on a mask cell, otherwise it goes back. Placed toppings stay put. ✓ enabled once ≥ 1 placed. ↺ removes all. ✓ → `results.toppings = judgeToppings(keys, order)`, `cake.toppings = [{key, x, y}]` (relative to cake centre, cake size units), `goNext`.

- [ ] **Step 1: Implement both.**
- [ ] **Step 2: Verify in the browser:** painting the whole heart in rose → bar full, `{ok:true}`; painting only half → `pas-couvert`; painting violet over rose → `mauvaise-couleur`; paint never appears outside the silhouette; 3 strawberries on a 3-strawberry order → ok; a topping dropped off the cake returns to the shelf; painting stays smooth with fast scribbling (DevTools Performance: no long frames > 50 ms with CPU 4× slowdown).
- [ ] **Step 3: Commit** — `git commit -m "feat: paint and toppings mini-games"`

---

### Task 12: Service scene

**Files:** Modify: `src/scenes/ServiceScene.js`

**Interfaces:**
- Consumes: `scoreRound`, `STEPS`, `updateState`, `addCoins`, `drawCake`, `drawClient`, `addIconButton`, `goNext`

**Behaviour (spec §6):** the client (same variant as the Stand) on the left, the finished cake handed over (slides from the counter), a "bite" animation. A card on the right reveals the 5 steps one by one (~600 ms apart): step icon (pâte = bowl, moule = shape outline, cuisson = flame, couleur = pot, toppings = topping icon), then `icon-ok` or `icon-ko`; on ko, a small "what went wrong" picture from the `reason`: `intrus` → the intruder ingredient, `manque`/`trop` → that ingredient with −/+, `pas-melange` → `lumps`, `mauvaise-forme` → the shape used, `pale`/`brule` → mini cake tinted pale/burnt, `mauvaise-couleur` → pot in the wrong colour, `pas-couvert` → half-painted mini cake, `mauvais-topping`/`pas-assez`/`trop` → topping icon with −/+. Then the client's face switches to the mood, coins fly one by one into the counter (≤ 5 particles each), `updateState(s => addCoins(s, coins))` saves **once**. `icon-next` appears after the animation → `goNext` (Stand, new client).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in the browser:** a perfect round → 5 ✅, happy face, +5 coins; a burnt cake → cuisson ✕ with burnt mini cake, +4; coins survive a page reload; tapping next twice quickly does not add coins twice.
- [ ] **Step 3: Commit** — `git commit -m "feat: service and payment"`

---

### Task 13: Shop scene

**Files:** Modify: `src/scenes/ShopScene.js`

**Interfaces:**
- Consumes: `ITEMS`, `canBuy`, `buy`, `getState`, `updateState`, `addIconButton`, `goTo`

**Behaviour:** grid of all items with `price > 0`, grouped by kind (shapes, colours, toppings, decos), each a big card: item picture (shape outline / colour blob / topping / deco), price as coin icon + number. Owned → big ✅ badge. Affordable → bright, bounces gently. Not affordable → greyed. Tap affordable → `updateState(s => buy(s, id) ?? s)`, coin animation, card becomes owned. Tap unaffordable/owned → small shake, nothing else. Coin counter top-right. Back button → `goTo('Stand')` (the waiting client is replaced by a fresh one).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in the browser:** with 10 coins (set in DevTools), buying star topping leaves 2 and it appears in later orders' topping shelf; bought deco appears on the stand; tapping an unaffordable card changes nothing; state survives reload.
- [ ] **Step 3: Commit** — `git commit -m "feat: shop"`

---

### Task 14: PWA, offline and deployment

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `assets/icons/icon.svg`, `assets/icons/icon-192.png`, `assets/icons/icon-512.png`, `DEPLOY.md`
- Modify: `src/main.js` (register SW), `src/assets.js` (icons + manifest in PRECACHE), `index.html` (manifest link, theme colour)
- Test: `tests/assets.test.js` (extend)

**Interfaces:**
- Consumes: `PRECACHE` (Task 6)
- Produces: `CACHE_VERSION` constant in `sw.js` (`'v1'`), bumped on every deploy

- [ ] **Step 1: Extend the test**: `PRECACHE` includes `manifest.webmanifest`, `sw.js` is **not** in it, both icon PNGs exist and are listed; `manifest.webmanifest` parses as JSON with `display: 'fullscreen'`, `orientation: 'landscape'`, `start_url: './'`, `scope: './'`, icons 192 and 512 (`purpose: 'any maskable'`), `background_color`/`theme_color` `#4fc3f7`.
- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement.** Icon: a style-B cake on `#4fc3f7`; PNGs via `qlmanage -t -s 512 -o assets/icons assets/icons/icon.svg` (rename output) and `sips -Z 192` for the small one. `sw.js` is a **module** SW (`navigator.serviceWorker.register('sw.js', {type: 'module'})`, only when `'serviceWorker' in navigator`): install → open cache `stand-${CACHE_VERSION}` and `addAll(PRECACHE)`; activate → delete other `stand-*` caches and `clients.claim()`; fetch (GET, same origin) → cache-first, network fallback. Register paths relative so the game works in a sub-folder or sub-domain.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Verify in the browser:** DevTools → Application: manifest valid and installable, SW active; tick "Offline" and reload → the game loads and a full round plays; Lighthouse PWA "installable" passes.
- [ ] **Step 6: Write `DEPLOY.md`** (French): which files to upload (everything except `docs/`, `tests/`, `.superpowers/`, `package.json`), check the HTTPS padlock, bump `CACHE_VERSION` on each update; on the tablet: open the address in Chrome → ⋮ → "Installer l'application" / "Ajouter à l'écran d'accueil"; the update arrives on the next launch with network (open it twice); parent reset = hold the top-left corner 3 s.
- [ ] **Step 7: Commit** — `git commit -m "feat: installable offline PWA and deploy guide"`
