# Pêche et cuisine — lot 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new game `peche-cuisine` in the collection menu, playable end to end at level 1: fishing → weighing → 2 orders (choose fish → cut → plate) → end screen, with a persistent cooler stock, coins, and the pure logic (stock, fishing list, pond, weights, feasible orders) for all three levels.

**Architecture:** An independent game folder `jeux/peche-cuisine/` built like `jeux/stand-desserts/`: pure logic in `src/logic/` (tested with `node --test`), Phaser scenes in `src/scenes/`, small UI helpers in `src/ui/` **copied and adapted from the stand, never imported from it**. It reads levels and settings only through `shared/runtime.js` and draws clients with `shared/client.js` + the shared client layers, and changes nothing in `shared/` or in the stand.

**Tech Stack:** Phaser (local `vendor/phaser.min.js`), ES modules, `node:test`. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-26-peche-cuisine-design.md`

## Lots (this plan is lot 1)

1. **This plan** — logic for every level, the playable loop at N1, the bamboo rod, the starter content, the cooler and release, placeholder art, menu registration. Phases are declared `levels: 1` (the parent sees « bientôt », no results recorded) until lot 2.
2. N2–N3 of the five phases in the scenes (weighing labels and two-pan balance, cut checks, plating patterns with garnishes), `PHASES` switched to `levels: 3`, results recorded for the parent's proposals.
3. Shop: cooler upgrades (+capacity, +colour), bigger pond, reel rod and landing net with their gestures, garnishes.
4. Final art (hand-drawn layered SVG, validated by the parent).

Each later lot gets its own plan once the previous one is played on the tablet.

## Global Constraints

- Tablet landscape, reference resolution **1280×800**, `Phaser.Scale.FIT` (as the stand).
- Touch targets **≥ 96 px**; icon buttons 110 px (`TOUCH`). At most **60 particles** alive.
- No text needed to understand a screen: pictures, digits, constellations (dice) only.
- No timer pressure; the bite window of the rod is generous and scaled by the pace (`dur()`).
- Shared settings applied: `SUPPORTS = ['rythme', 'soir']` (pace factors via `ui/pace.js`, evening filter on the canvas).
- Offline PWA: every file under `jeux/peche-cuisine/src` and `assets` listed in the game's `PRECACHE`; `sw.js` `CACHE_VERSION` bumped to `'v10'`.
- Relative paths only in pages and loaders (the site may live in a sub-folder).
- Independence: no import from `jeux/stand-desserts/`; no edit of `shared/` or of the stand. The only shared files touched: `jeux/registry.js`, `sw.js`, `tests/registry.test.js`.
- Storage key `pecheCuisine.v1`, its own; `reset` clears only it.
- Never `git add -A` / `git add .` / `git clean`: untracked files at the repo root (e.g. `singe.jpeg`) belong to the owner. Stage named paths only.
- Code, identifiers, comments and commit messages in English; parent-facing names in French.

## Review Focus

1. **The cooler holds no usable fish for an order** (she released everything, or it is full of fish heavier than the level allows): the order step must not crash or loop; the round goes to the end screen. → test in Task 3 (`drawOrder returns null…`) and Task 8 step (kitchen with null order).
2. **The cooler is full during weighing**: each extra fish is released with its animation, never silently lost from the count of caught fish, and the round still has its two orders from what is in stock. → test in Task 2 (`addFish when full…`).
3. **The parent lowered the Cuisine level** with heavy fish in stock: orders stay inside the new range, heavy fish are ignored, the fishing list still counts only usable fish. → test in Task 3 (`orders ignore fish above the level's max`) and Task 4.
4. **Reload or back gesture in the middle of a round**: fish weighed so far are already saved, fish chosen for an order are already removed, coins already given stay; the page restarts at fishing (no duplicate coins). → each persisting step writes through `updateState` at the moment it happens (Task 6, Tasks 8–10).
5. **Storage refused** (private mode): the game still plays from the default state in memory. → test in Task 5 (`loadState with a throwing storage…`).

---

## File Structure

```
jeux/peche-cuisine/
  index.html                 page (copy of the stand's, title « Pêche et cuisine »)
  collection.js              the game as the collection sees it (ID, NAME, CATEGORY, TILE, SUPPORTS, PHASES, PRECACHE, reset)
  ASSETS-LICENSES.md         licences of the art
  assets/…                   SVGs (Task 7)
  src/
    main.js  config.js  assets.js  game-state.js
    logic/
      rng.js        mulberry32 (copy of the stand's)
      fish.js       sizes, weight ranges per level, drawWeight
      stock.js      cooler: add (or release when full), remove, release, starter stock
      orders.js     feasible orders, drawOrder, isExactCombination, suggestCombination
      fishing.js    fishing list, slot matching, pond spawning
      cutting.js    cut marks and snapping (N1)
      scoring.js    coins and client mood
      setup.js      what she owns → colours, capacity, pond size, rod, garnishes (starter only in lot 1)
      save.js       State load/save/reset
      round.js      a round: levels, list, catches, results, orders
    scenes/  BootScene.js FishingScene.js WeighScene.js KitchenScene.js CutScene.js PlateScene.js EndScene.js
    ui/      button.js flow.js pace.js fx.js client.js fishArt.js   (button/pace/fx/client copied from the stand)
tests/peche-cuisine/
  fish.test.js stock.test.js orders.test.js fishing.test.js cutting.test.js scoring.test.js save.test.js round.test.js simulate.test.js assets.test.js
```

`npm test` already runs `tests/**/*.test.js`.

Shared data shape used everywhere:

```js
// A fish in the cooler (weighed). size is the category it was caught as; weight an integer.
/** @typedef {{ id: string, color: string, size: 'petit'|'moyen'|'grand', weight: number }} Fish */
// An order: plates of one colour.
/** @typedef {{ color: string, plates: number }} Order */
// A slot of the fishing list / a fish in the pond before weighing.
/** @typedef {{ color: string, size: 'petit'|'moyen'|'grand' }} Catch */
```

---

### Task 1: Fish sizes and weights

**Files:**
- Create: `jeux/peche-cuisine/src/logic/rng.js` (copy of `jeux/stand-desserts/src/logic/rng.js`)
- Create: `jeux/peche-cuisine/src/logic/fish.js`
- Test: `tests/peche-cuisine/fish.test.js`

**Interfaces:**
- Produces: `makeRng(seed) -> () => number`; `SIZES = ['petit','moyen','grand']`; `weightRange(size, level) -> [min, max]`; `maxWeight(level) -> number`; `drawWeight(size, level, colorWeights: number[], rng) -> number`.

- [ ] **Step 1: Write the failing tests**

```js
test('N1 ranges: petit 1, moyen 2-3, grand 4-5', () => {
  assert.deepEqual(weightRange('petit', 1), [1, 1]);
  assert.deepEqual(weightRange('moyen', 1), [2, 3]);
  assert.deepEqual(weightRange('grand', 1), [4, 5]);
  assert.equal(maxWeight(1), 5);
});
test('N2 and N3 ranges: petit 1-3, moyen 4-6, grand 7-10', () => {
  for (const l of [2, 3]) {
    assert.deepEqual(weightRange('petit', l), [1, 3]);
    assert.deepEqual(weightRange('moyen', l), [4, 6]);
    assert.deepEqual(weightRange('grand', l), [7, 10]);
    assert.equal(maxWeight(l), 10);
  }
});
test('drawWeight stays in range, for every size and level', () => { /* 500 draws each, makeRng(1) */ });
test('drawWeight prefers weights the colour does not have yet', () => {
  // moyen at N2, colour already has 4 and 5: over 600 draws, 6 is drawn more often than 4 and than 5
});
test('drawWeight still draws a weight the colour has (not deterministic)', () => {
  // same setup: 4 is drawn at least once
});
```

- [ ] **Step 2: Run** `node --test tests/peche-cuisine/fish.test.js` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `fish.js`.** `drawWeight`: each value of the range gets weight 2 if absent from `colorWeights`, else 1; draw by `rng()`. Unknown level → treated as 1.
- [ ] **Step 4: Run** the tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(peche): fish sizes and weights by level` (stage the three files).

### Task 2: Cooler stock

**Files:**
- Create: `jeux/peche-cuisine/src/logic/stock.js`
- Test: `tests/peche-cuisine/stock.test.js`

**Interfaces:**
- Consumes: `Fish` shape.
- Produces:
  - `STARTER_STOCK: Catch & {weight}[]` = `[{bleu,petit,1},{bleu,moyen,3},{rouge,petit,1},{rouge,grand,4}]` (all valid at N1).
  - `addFish(stock: Fish[], fish: Fish, capacity: number) -> { stock: Fish[], released: boolean }` (pure; full → same stock, `released: true`).
  - `removeFish(stock, ids: string[]) -> Fish[]`; `releaseFish(stock, id) -> Fish[]` (same as removing one; a separate name for the child's action).
  - `ofColor(stock, color) -> Fish[]`; `usable(stock, level) -> Fish[]` (weight ≤ `maxWeight(level)`).

- [ ] **Step 1: Failing tests** — `addFish below capacity appends`, `addFish when full returns released: true and the same stock`, `removeFish removes only the given ids`, `usable drops fish heavier than the level max` (a fish of 8 is usable at 2, not at 1), `STARTER_STOCK: two colours, a petit in each, every weight ≤ 5`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** (inputs never mutated).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(peche): cooler stock`.

### Task 3: Feasible orders

**Files:**
- Create: `jeux/peche-cuisine/src/logic/orders.js`
- Test: `tests/peche-cuisine/orders.test.js`

**Interfaces:**
- Consumes: `usable`, `ofColor` (Task 2), `maxWeight` (Task 1).
- Produces:
  - `ORDER_RULES = { 1: { max: 5, counts: [1, 2] }, 2: { max: 10, counts: [2] }, 3: { max: 12, counts: [2, 3] } }` — fish per order the level prefers; fallback is always a single fish.
  - `ORDERS_PER_ROUND = 2`.
  - `feasibleOrders(stock, level, colors: string[], counts: number[]) -> Order[]` — every distinct `{color, plates}` with `1 ≤ plates ≤ max` reachable as the sum of exactly k fish of that colour, k in `counts`, using usable fish only.
  - `drawOrder(stock, level, colors, rng, previous?: Order) -> Order | null` — draw uniformly among `feasibleOrders(…, ORDER_RULES[level].counts)`; if empty, among `feasibleOrders(…, [1])`; if still empty, `null`. Avoid returning exactly `previous` when another choice exists.
  - `isExactCombination(fish: Fish[], order) -> boolean` — non-empty, all of `order.color`, weights sum to `order.plates` (any number of fish counts as right).
  - `suggestCombination(stock, order, level) -> Fish[]` — a right combination, preferring a size in `ORDER_RULES[level].counts`, else any; `[]` if none.

- [ ] **Step 1: Failing tests**

```js
test('6 blue from blue 5 and 1 is feasible at N2', () => {
  const s = [f('a','bleu',5), f('b','bleu',1), f('c','bleu',3)];
  assert.ok(feasibleOrders(s, 2, ['bleu'], [2]).some(o => o.plates === 6));
});
test('every drawn order is within the level max and exactly achievable', () => { /* random stocks, 300 draws per level */ });
test('orders ignore fish above the level max', () => {
  const s = [f('a','bleu',8), f('b','bleu',1), f('c','rouge',9)];
  const o = drawOrder(s, 1, ['bleu','rouge'], makeRng(3));
  assert.deepEqual(o, { color: 'bleu', plates: 1 });
});
test('falls back to a single fish when no pair fits', () => { /* N2, stock with one blue 4 only → {bleu,4} */ });
test('drawOrder returns null when nothing is usable', () => {
  assert.equal(drawOrder([], 2, ['bleu'], makeRng(1)), null);
  assert.equal(drawOrder([f('a','bleu',9)], 1, ['bleu'], makeRng(1)), null);
});
test('N3 never asks more than 12 plates', () => { /* stock of four blue 10s and 9s → no order > 12 */ });
test('isExactCombination: right colour and sum only', () => { /* 5+1 for bleu 6 true; 3+3 rouge for bleu 6 false; [] false */ });
test('suggestCombination returns a combination that isExactCombination accepts', () => {});
test('drawOrder avoids repeating the previous order when it can', () => {});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Combinations of up to 3 among ≤ ~16 fish per colour: plain enumeration is enough.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(peche): feasible orders`.

### Task 4: Fishing list and pond

**Files:**
- Create: `jeux/peche-cuisine/src/logic/fishing.js`
- Test: `tests/peche-cuisine/fishing.test.js`

**Interfaces:**
- Consumes: `usable`, `ofColor` (Task 2).
- Produces:
  - `LIST_LENGTH = 4`.
  - `drawFishingList(stock, level, colors, rng) -> Catch[]` (length 4).
  - `matchSlot(list, filled: boolean[], c: Catch) -> number` — index of the first unfilled slot with the same colour and size, or `-1`.
  - `ON_LIST_RATE = 0.6`; `spawnCatch(list, filled, colors, rng) -> Catch` — with probability `ON_LIST_RATE` an unfilled slot's catch (uniform among them), otherwise any colour of `colors` and any size (decoy; it may happen to match).

Properties the list must have (the formula is the builder's):
- at least one `petit`;
- only colours from `colors`;
- for every colour in the list, list + usable stock hold **≥ 2** fish of that colour;
- favours what is missing: a colour with fewer usable fish in stock, and a colour with no usable `petit`, is drawn more often;
- not deterministic.

- [ ] **Step 1: Failing tests** — one test per property above (`always 4 slots with a petit`, `only owned colours`, `every listed colour reaches 2 with the stock`, `a colour missing from the stock is listed in most lists` (stock all blue, colours bleu+rouge: rouge in > 60 % of 500 lists), `a colour with no petit gets a petit more often`, `two different lists over 20 draws with the same stock`), plus `matchSlot finds the first free slot of same colour and size, -1 otherwise`, `spawnCatch: over 1000 draws at least 50 % fill a free slot; only owned colours`, `spawnCatch with every slot filled still returns a catch`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Suggested shape: colour weight `1 / (1 + usableCount + alreadyListed)`, a forced `petit` for the colour lacking one (else for a weighted colour), sizes petit 0.4 / moyen 0.35 / grand 0.25, then fix the "≥ 2 per colour" rule by recolouring a later slot.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(peche): fishing list and pond spawning`.

### Task 5: Setup, save, scoring, cutting, round

**Files:**
- Create: `jeux/peche-cuisine/src/logic/setup.js`, `save.js`, `scoring.js`, `cutting.js`, `round.js`
- Test: `tests/peche-cuisine/save.test.js`, `scoring.test.js`, `cutting.test.js`, `round.test.js`

**Interfaces:**
- Produces:
  - `setup.js`: `ALL_COLORS = ['bleu','rouge','jaune','vert','violet','orange']`; `gameSetup(state) -> { colors: ['bleu','rouge'], capacity: 8, pondSize: 4, rod: 'bambou', garnishes: ['citron','salade'] }` (starter values; lot 3 derives them from `state.owned`).
  - `save.js`: `STORAGE_KEY = 'pecheCuisine.v1'`; `defaultState() -> { version: 1, coins: 0, owned: [], stock: Fish[] (STARTER_STOCK with ids f1..f4), nextFishId: 5 }`; `loadState(storage)`, `saveState(storage, state) -> boolean`, `resetState(storage)`, `currentState(storage, memory)`, `updateStored(storage, memory, fn) -> { state, saved }` — same contracts as the stand's `save.js`; `loadState` validates coins (integer ≥ 0), owned (array of strings), stock (array of valid Fish: known colour, known size, integer weight 1–10, string id), `nextFishId` (integer greater than every id number), else `defaultState()`.
  - `newFish(state, catch, weight) -> { state, fish }` — id `'f' + nextFishId`, increments it (does not add to stock).
  - `scoring.js`: `prepCoins(results) -> 0..2` (peche + pesee); `orderCoins(o: {cuisine, decoupe, dressage}) -> 0..3`; `mood(points) -> 'content' | 'bof' | 'fache'` (3 → content, 1–2 → bof, 0 → fache).
  - `cutting.js`: `cutMarks(weight) -> number[]` (`i / weight` for i = 1..weight−1, along the fish body 0..1); `snapCut(x, marks, done: number[]) -> number` — index of the nearest not-yet-cut mark within `0.5 / weight`, else `-1`.
  - `round.js`: `createRound({ levels, state, rng }) -> Round` with `Round = { levels, list: Catch[], filled: boolean[], caught: Catch[], results: { peche: true, pesee: true, orders: [] }, orderIndex: 0, order: null, chosen: [] }`; the list comes from `drawFishingList(state.stock, levels.cuisine, gameSetup(state).colors, rng)`.

- [ ] **Step 1: Failing tests** — `defaultState has the starter stock with ids f1..f4 and nextFishId 5`; `loadState returns defaults for bad JSON, wrong version, a bad fish, a stale nextFishId`; `loadState with a throwing storage returns defaults`; `save then load round-trips coins, owned and stock`; `resetState removes only pecheCuisine.v1`; `newFish gives f5 then f6`; `prepCoins/orderCoins count true results`; `mood 3/2/0`; `cutMarks(5) = [0.2,0.4,0.6,0.8]`, `cutMarks(1) = []`; `snapCut snaps within half a portion, ignores done marks, -1 far away`; `createRound: 4-slot list, nothing filled, results all true, levels kept`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(peche): setup, save, scoring, cutting and round`.

### Task 6: Simulated play never gets stuck

**Files:**
- Test: `tests/peche-cuisine/simulate.test.js`

**Interfaces:**
- Consumes: Tasks 1–5 only (no new code unless the test finds a bug).

- [ ] **Step 1: Write the test** — for each level 1, 2, 3 and 3 seeds, play 300 rounds from `defaultState()`: draw the list; catch exactly the list (weights via `drawWeight` with the colour's stock weights; `addFish` with capacity 8); then twice `drawOrder` → when non-null, remove `suggestCombination` and assert `isExactCombination` and `plates ≤ ORDER_RULES[level].max`. Randomly (10 % per round) release one fish. Assert: over the whole run, **null orders happen in < 1 % of order draws**, and right after a fishing step at least one order is feasible whenever some usable fish exists. Also one run that starts at level 3 for 50 rounds, then drops to level 1 for 200 rounds (heavy fish stay in stock; with 10 % releases the null rate after the drop stays < 5 %).
- [ ] **Step 2: Run** `node --test tests/peche-cuisine/simulate.test.js` — Expected: PASS; if it fails, fix the list/weights logic (Tasks 1, 4), not the thresholds, and re-run all `tests/peche-cuisine`.
- [ ] **Step 3: Commit** `test(peche): simulated rounds never run out of orders`.

### Task 7: Game shell, art and menu registration

**Files:**
- Create: `jeux/peche-cuisine/index.html`, `collection.js`, `ASSETS-LICENSES.md`, `src/main.js`, `src/config.js`, `src/assets.js`, `src/game-state.js`, `src/ui/button.js`, `src/ui/pace.js`, `src/ui/fx.js`, `src/ui/client.js` (copies of the stand's, import paths adjusted), `src/ui/flow.js`, `src/ui/fishArt.js`, `src/scenes/BootScene.js`, and the SVGs below.
- Modify: `jeux/registry.js` (import + `GAMES`), `sw.js` (`CACHE_VERSION = 'v10'`), `tests/registry.test.js` (`v9` → `v10`, plus a test for this game).
- Test: `tests/peche-cuisine/assets.test.js`, `tests/registry.test.js`

**Interfaces:**
- Consumes: `gameSetup`, `save.js`, `createRound` (Task 5); `phaseLevels` from `shared/runtime.js`; `generateClient` from `shared/client.js`.
- Produces:
  - `collection.js`: `ID = 'peche-cuisine'`, `NAME = 'Pêche et cuisine'`, `CATEGORY = 'compter-observer'`, `TILE = 'assets/fish/fish-body.svg'`, `SUPPORTS = ['rythme','soir']`, `PHASES` = `peche`/Pêche/`logique`, `pesee`/Pesée/`nombres`, `cuisine`/Cuisine/`nombres`, `decoupe`/Découpe/`couleurs-fractions`, `dressage`/Dressage/`logique`, each `levels: 1`; `PRECACHE`; `reset(storage)` → `resetState`.
  - `game-state.js`: `getStorage()`, `getState()`, `updateState(fn) -> State`, `newRound() -> Round` (levels from `phaseLevels(ID)` clamped to 1 in lot 1, `rng = Math.random`), `getRound() -> Round`.
  - `flow.js`: `ORDER = ['Fishing','Weigh','Kitchen','Cut','Plate']`; `goTo(scene, key, data)`, `restart(scene)`, `isLeaving(scene)` (as the stand's); `nextAfterPlate(round) -> 'Kitchen' | 'End'` (Kitchen while `orderIndex < ORDERS_PER_ROUND`).
  - `fishArt.js`: `drawFish(scene, x, y, catch, { weight?, label? }) -> Container` — tinted `fish-body` + untinted `fish-details`, scale by size (petit 0.6, moyen 0.85, grand 1.1; a small extra per weight inside the size, never enough to read the weight), optional `label` tag showing the digit and, at N1, the dice of the weight; `COLOR_HEX` for the six colours in `config.js`.
  - Scene keys: `'Boot','Fishing','Weigh','Kitchen','Cut','Plate','End'`.
- Placeholder SVGs (simple, flat, white parts meant to be tinted; replaced in lot 4): `assets/fish/fish-body.svg`, `fish-details.svg`, `assets/pond/pond-bg.svg`, `bobber.svg`, `rod-bambou.svg`, `splash-ring.svg`, `assets/kitchen/scale.svg`, `label.svg`, `cooler.svg`, `board.svg`, `plate.svg`, `portion.svg`, `knife.svg`, `kitchen-bg.svg`, `counter.svg`, `bubble.svg`, `water-bucket.svg`, `assets/ui/` copies of the stand's `icon-ok`, `icon-restart`, `icon-next`, `coin`, `dice-1..5` (the stand's own drawings, copied, credited in `ASSETS-LICENSES.md`). The home icon is loaded from `../../shared/assets/icon-home.svg` like the stand.

- [ ] **Step 1: Failing tests** — in `tests/registry.test.js`: `the fishing game is registered as specified` (category, path, supports, phases `[id, theme, levels]` exactly as above) and `its reset clears only pecheCuisine.v1`; update the `CACHE_VERSION` assertion to `'v10'`. In `tests/peche-cuisine/assets.test.js`: `every ASSETS file exists and is SVG`, `every file under src/ and assets/ is in PRECACHE` (the registry test also checks it), `fish colours: every ALL_COLORS entry has a COLOR_HEX`.
- [ ] **Step 2: Run** `npm test` — Expected: the new tests FAIL, every other test PASSES.
- [ ] **Step 3: Implement** the shell: `main.js` with the 7 scene classes (scenes other than Boot are minimal stubs in this task that only show their name in small grey text and a ✓ going to the next scene, so the flow can be clicked through), the `pageshow` reload and the service-worker registration as in the stand; Boot loads `ASSETS`, installs settings, makes fx textures, starts `Fishing`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS. Then serve the repo root (`python3 -m http.server 8000`) and open `http://localhost:8000/`: the home shows both games in « compter-observer », the new tile opens the game, ✓ walks Fishing → … → End.
- [ ] **Step 5: Commit** `feat(peche): game shell, placeholder art and menu entry; cache v10`.

### Task 8: Fishing scene (N1, bamboo rod)

**Files:**
- Modify: `jeux/peche-cuisine/src/scenes/FishingScene.js`

**Interfaces:**
- Consumes: `newRound`, `getRound` (Task 7); `matchSlot`, `spawnCatch` (Task 4); `drawFish` (Task 7); `dur`.
- Produces: `round.caught` (4 catches, list order), `round.filled` all true, `round.results.peche`.

Behaviour:
- `create()` calls `newRound()`. List panel at the top-right: 4 slot cards, each a fish picture at its colour and size (N1 = pictures only); a filled slot shows the caught fish and a check.
- Pond: `gameSetup(state).pondSize` fish swim (slow tweens across the water), each from `spawnCatch`; a fish leaving the screen or caught is replaced.
- Bamboo: tap a fish → the line and bobber drop on it, the fish stops; after `dur(600–1200 ms)` the bobber dips (bite) and stays dipped `dur(1800 ms)`; a tap anywhere during the bite hooks it. Missed → the fish swims away, no penalty.
- Hooked: `matchSlot` ≥ 0 → the fish flies to its slot. `-1` → it is shown next to the list with ✗, then jumps back in the water (`splash-ring`), `results.peche = false`.
- All slots filled → ✓ appears; ✓ → `Weigh`. Home button top-left (no confirmation). No ↺ on this phase (nothing to undo: wrong catches are already back in the water).

- [ ] **Step 1:** Implement the scene.
- [ ] **Step 2:** Manual check in the browser (served as in Task 7): catch 4 listed fish; catch one off-list fish and see it released. Check on a narrow tap that each fish's hit area is ≥ 96 px (hit area padded for small fish).
- [ ] **Step 3:** `npm test` — Expected: PASS.
- [ ] **Step 4: Commit** `feat(peche): fishing scene at level 1 with the bamboo rod`.

### Task 9: Weighing scene (N1)

**Files:**
- Modify: `jeux/peche-cuisine/src/scenes/WeighScene.js`

**Interfaces:**
- Consumes: `round.caught`; `drawWeight`, `ofColor` (Tasks 1–2); `newFish`, `addFish` stock (Tasks 2, 5); `updateState`; `prepCoins`.
- Produces: fish added to `state.stock` (or released), coins for the prep phases.

Behaviour (N1): the caught fish wait in a basket; she drags the first one onto the scale; dots light one by one up to its weight (`dur(350 ms)` each), then the label with the digit + dice slides and sticks on the fish. The weight is drawn and the fish saved **at that moment**: `updateState(s => …newFish…addFish(s.stock, fish, capacity))`. If `released`, the fish flips back into a water bucket with a splash (no penalty). Otherwise it slides into the cooler. After the 4th: recap with `prepCoins(results)` coins flying to the counter (`updateState` adds them once), then ✓ → `Kitchen`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Manual check: weights at N1 are petit 1, moyen 2–3, grand 4–5; reload in the middle: fish already weighed are in the cooler (visible in the Kitchen later), coins not given twice (reload restarts at Fishing with a new round).
- [ ] **Step 3:** `npm test` — PASS.
- [ ] **Step 4: Commit** `feat(peche): weighing scene at level 1`.

### Task 10: Kitchen, Cut, Plate and End scenes (N1)

**Files:**
- Modify: `jeux/peche-cuisine/src/scenes/KitchenScene.js`, `CutScene.js`, `PlateScene.js`, `EndScene.js`

**Interfaces:**
- Consumes: `drawOrder`, `isExactCombination`, `suggestCombination`, `ORDERS_PER_ROUND` (Task 3); `cutMarks`, `snapCut`, `orderCoins`, `mood` (Task 5); `releaseFish`; `drawClient` + `generateClient`; `nextAfterPlate` (Task 7).
- Produces: `round.order`, `round.chosen: Fish[]`, `round.results.orders[i] = { cuisine, decoupe, dressage }`, coins, stock updates.

Behaviour:
- **Kitchen.** `round.order = drawOrder(getState().stock, levels.cuisine, colors, Math.random, previousOrder)`. `null` → go to `End` (Review Focus 1). A client (`generateClient`) walks in with a bubble: a fish of the order's colour + the number of plates as a dice (N1, ≤ 5). The cooler is open below, fish in rows by colour with their labels. Tapping a fish moves it to the board; tapping it on the board puts it back. **No total shown.** ✓ (enabled with ≥ 1 fish on the board): `isExactCombination` → `cuisine: true`; else `cuisine: false`, the board clears and `suggestCombination` fish slide onto it with a short glow (« voilà ce qu'il fallait »). Then the chosen fish leave the stock **now** (`updateState(removeFish)`) and → `Cut`. ↺ empties the board.
- **Cut.** Chosen fish one at a time on the board, dotted lines at `cutMarks(weight)`. A vertical swipe across the fish: `snapCut` ≥ 0 → that mark is cut (knife animation, the piece slides a little); `-1` → nothing happens. A fish of weight 1 needs no cut. When every mark of every fish is cut, ✓ → `Plate`; `decoupe: true` at N1. ↺ restarts the scene.
- **Plate.** `order.plates` plates in a row (two rows if more than 6), the portions in a tray; she drags each portion onto a plate. ✓ (once the tray is empty): `dressage = every plate holds exactly 1`. The client eats, `mood(orderCoins(r))`, coins fly in (`updateState` adds them once), `orderIndex += 1`, → `nextAfterPlate(round)`.
- **End.** Coins total, the cooler with every fish: drag a fish to the water bucket to release it (`updateState(releaseFish)`, splash). Buttons: ▶ play again (→ `Fishing`), home (→ collection home).

- [ ] **Step 1:** Implement the four scenes.
- [ ] **Step 2:** Manual check, at N1, three full rounds: an order of 4 from 1 + 3 works; a wrong choice shows the right combination and continues; release fish on the End screen until the cooler is empty, play again: the round still works (fishing refills it; if no order is possible the Kitchen goes straight to End).
- [ ] **Step 3:** `npm test` — PASS.
- [ ] **Step 4: Commit** `feat(peche): kitchen, cutting, plating and end screen at level 1`.

### Task 11: Deploy notes

**Files:**
- Modify: `DEPLOY.md` (one line in its release checklist: the new game and cache `v10`), only if it lists games or cache versions.

- [ ] **Step 1:** Read `DEPLOY.md`; add the line if it applies.
- [ ] **Step 2:** `npm test` — PASS.
- [ ] **Step 3: Commit** `docs(deploy): fishing game in the release` (skip if nothing changed).
