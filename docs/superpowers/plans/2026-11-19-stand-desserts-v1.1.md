# Stand de desserts v1.1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the shipped v1 game into v1.1: the client shows the finished cake to deduce, 1–3 glaze colours by zones, 1–3 kinds of toppings, a per-dessert flank, varied human and animal clients with separately animated eyes/mouth, a top strip showing the ordered cake with the current step highlighted, and a cake eaten in proportion to the score.

**Architecture:** Evolve the existing code. Pure rules go in `src/logic/` (node-tested): new order shape, glaze zones, topping layout, judges, client generator, bites. Art extends the v1 layered 300×300 client scheme and adds per-dessert flank patterns. Scenes Stand, Bake (strip/flames only), Paint, Toppings, Service and the shared `cakeView`, `client`, `orderReminder` change. Between tasks the game may be temporarily inconsistent on the branch; `npm test` must stay green after every task and the e2e smoke passes again at the end.

**Tech Stack:** unchanged — Phaser 3.90.0 vendored, ES modules, SVG art, `node --test`, CDP smoke (`tests/e2e/smoke.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-19-stand-desserts-v1.1-design.md` (amends `…-design.md`). Art geometry: `docs/superpowers/notes/art-geometry.md`.

## Global Constraints

- All v1 Global Constraints still hold (see `docs/superpowers/plans/2026-11-19-stand-desserts.md`): no ads/links/off-origin requests, no sound, no text needed to play, targets ≥ 96 px, ≤ 60 live particles, no npm deps, relative paths, every new src/*.js and asset in PRECACHE, local save only, style S2.
- **No aid that counts or reads for the child** (future educational version): the strip/bubble show the cake, never "×N" digits for toppings or colour names.
- Order shape: `{ dessert, shape, glaze: string[] (1–3 distinct, left→right), toppings: Array<{key, count}> (1–3 distinct kinds, count ≥ 1, total ≤ 8) }`.
- Zones: 1 = whole top; 2 = left/right halves; 3 = three equal vertical bands — across the shape silhouette's x-extent on the 64×64 grid. Per-zone coverage ≥ `COVERAGE_OK` (0.85) of the zone's own cells.
- Bites by coins: 5 → everything (4 bites, plate + crumbs), 4 → 3, 3 → 2, 1–2 → 1, 0 → a nibble and the plate is pushed away.
- Client: ~1 in 5 is an animal; never the same client twice in a row.
- Bump `CACHE_VERSION` in `sw.js` to `'v3'` (last task).

## Execution

- One fresh agent per task, no per-task review, one final whole-branch review (Opus) + one fix wave — as in v1.
- Models: T1, T4, T5 → Sonnet 5.5; T2 (art) → Fable 5.2 with the parent's two checkpoints; T3, T6, T7 → Opus 5.5.
- Order: T1, then T2 (own worktree, branch `feat/art-v11`) in parallel with T3–T4 using placeholders where art is missing, merge T2 after Checkpoint B, then T5 → T7.

## Review Focus

1. Orders with 3 zones / 3 kinds never repeat a colour or a topping kind and never exceed 8 toppings, including with only the starter set owned. *(T1 test)*
2. A zone with no cells (thin silhouettes: licorne horn band, star tips) must not divide by zero or fail the order; an empty zone counts as satisfied. *(T1 test)*
3. The ideal-cake topping layout places up to 8 toppings inside the silhouette without overlap, even on a small/thin mask. *(T1 test)*
4. The same client never appears twice in a row over thousands of draws. *(T1 test)*
5. After a 5/5 round nothing of the cake (toppings included) remains visible; after 0/5 the cake is intact. *(T7 smoke check)*

---

### Task 1: Logic — order v2, zones, layout, judges, bites, client generator

**Files:**
- Modify: `src/logic/order.js`, `src/logic/scoring.js`, `tests/order.test.js`, `tests/scoring.test.js`
- Create: `src/logic/zones.js`, `src/logic/client.js`, `tests/zones.test.js`, `tests/client.test.js`
- Modify: `src/assets.js` (PRECACHE: new src files)

**Interfaces:**
- Produces:
  - `order.js`: `ZONE_WEIGHTS = [0.5, 0.35, 0.15]`, `KIND_WEIGHTS = [0.5, 0.35, 0.15]`, `MAX_TOPPINGS = 8`; `generateOrder(owned, rng = Math.random): Order` (Order per Global Constraints). Counts drawn 1..4 each, redraw all counts while total > 8. Kinds/colours drawn without replacement from owned.
  - `zones.js`:
    - `zoneMap(mask: Uint8Array, size: number, n: 1|2|3): Int8Array` — −1 outside mask; else band index `min(n−1, floor((x − minX) * n / (maxX − minX + 1)))` where minX/maxX are the mask's extreme columns.
    - `zoneEdges(mask, size, n): number[]` — the n−1 band boundaries in cell x units (for the dotted lines).
    - `layoutToppings(mask: Uint8Array, size: number, count: number, minDist = 9): Array<{u: number, v: number}>` — `count` points (cell units, cell centres) inside the mask, pairwise ≥ `minDist` apart when possible, deterministic (no rng): greedy farthest-point sampling starting from the mask cell nearest the centroid; if fewer fit, keep reducing `minDist` by 1 until all fit.
  - `scoring.js` (replacing the v1 colour/topping judges; other exports unchanged):
    - `judgeColor(cells: Uint8Array, colorKeys: string[], zones: Int8Array, glaze: string[]): Judgement` — for each zone z with ≥ 1 cell: share of its cells painted `glaze[z]` ≥ 0.85, else fail. Reasons: `'mauvaise-couleur'` (another colour is the zone's most-painted) with `{zone, color}` = that wrong colour; else `'pas-couvert'` with `{zone}`. Zones with 0 cells are satisfied.
    - `judgeToppings(placed: string[], toppings: Array<{key,count}>): Judgement` — reasons in priority: `'mauvais-topping'` `{key}` (a placed kind not ordered), `'pas-assez'` `{key}`, `'trop'` `{key}` (first ordered kind short / over, in order).
    - `bitesFor(coins: 0..5): 0|1|2|3|4` — 5→4, 4→3, 3→2, 2→1, 1→1, 0→0.
  - `client.js`: `HAIRS = 6` (index 0 = bald, 1..5 → `client-hair-1..5`), `HAIR_COLORS = 5`, `SKINS = 4`, `SHIRTS = 6`, `ACCESSORIES = ['glasses','cap','bow','beard','moustache','earrings']`, `ANIMALS = ['chat','ours','lapin','chien']`, `ANIMAL_RATE = 0.2`, `ACCESSORY_RATE = 0.5`; `generateClient(rng = Math.random, previous = null): Client` where `Client = {kind:'human', hair, hairColor, skin, shirt, accessory: string|null} | {kind:'animal', animal, shirt}`; `sameClient(a, b): boolean`; result never `sameClient` with `previous` (redraw).

- [ ] **Step 1: Write failing tests** (replace the v1 order/colour/topping tests):

```js
// order
test('2000 starter orders: owned only, distinct, sizes 1..3, total ≤ 8, all sizes reached', () => { /* glaze.length∈1..3, new Set(glaze).size===glaze.length, toppings kinds distinct, each count 1..4, sum ≤ 8; seen glaze sizes {1,2,3} and kind sizes {1,2,3} */ });
test('zone weights roughly 50/35/15', () => { /* 10000 orders, share of size 1 within ±0.03 of 0.5 */ });
// zones
test('zoneMap halves a 10-wide square', () => { /* mask columns 3..12 → cells x 3..7 zone 0, 8..12 zone 1 */ });
test('zoneMap on n=1 is all 0 inside, -1 outside', () => {});
test('zoneEdges returns n-1 boundaries', () => {});
test('layoutToppings: 8 points inside a small disc mask, pairwise distance ≥ 4', () => {});
test('layoutToppings is deterministic', () => {});
// scoring
test('two zones painted correctly → ok', () => {});
test('right colours swapped → mauvaise-couleur with zone 0', () => {});
test('one zone half painted → pas-couvert with that zone', () => {});
test('a zone with no cells is satisfied', () => {});
test('toppings 2 fraise + 3 etoile exact → ok; extra bougie → mauvais-topping {key:"bougie"}; 1 fraise → pas-assez {key:"fraise"}; 4 etoile → trop {key:"etoile"}', () => {});
test('bitesFor table', () => { assert.deepEqual([0,1,2,3,4,5].map(bitesFor), [0,1,1,2,3,4]); });
// client
test('never the same client twice in a row over 5000 draws', () => {});
test('animal share ≈ 0.2 (±0.03 over 10000)', () => {});
test('human fields in range; accessory share ≈ 0.5', () => {});
```

- [ ] **Step 2: Run** `npm test` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** the modules per the interfaces. Remove the v1 `order.color/topping/toppingCount` usage only inside `src/logic` (scenes are updated in later tasks).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(logic): v1.1 orders, glaze zones, topping layout, judges, clients`

---

### Task 2: Art v1.1 (Fable, worktree `feat/art-v11`)

**Files:** Create SVGs under `assets/`; modify `src/assets.js`, `tests/assets.test.js`, `ASSETS-LICENSES.md`.

**Interfaces (texture keys, exact):**
- `side-pattern-gateau`, `side-pattern-tarte`, `side-pattern-cupcake` — 400×400 flank patterns (génoise + crème layers; golden crust; pleated paper case), light enough to take bake tints, to be masked by each `shape-<key>-side` silhouette (keep `shape-<key>-side` as mask + shading).
- `client-hair-1..5` (redraw 1–3, add 4–5: include ponytail and bun) drawn in light grey values for tinting; bald = no hair layer.
- `client-acc-glasses`, `client-acc-cap`, `client-acc-bow`, `client-acc-beard`, `client-acc-moustache`, `client-acc-earrings` (untinted; cap and bow may be drawn white and tinted).
- `client-animal-chat`, `client-animal-ours`, `client-animal-lapin`, `client-animal-chien` — full heads with ears and snout, no eyes/mouth, same 300×300 frame and eye line as `client-head`.
- `client-eyes-open`, `client-eyes-closed`, `client-mouth-content`, `client-mouth-bof`, `client-mouth-fache` — positioned for the human head and reused on animals (document the eye line and mouth anchor y).
- `plate` — a 3/4 plate the cake sits on at Service (≈ 480×200), `crumbs` (≈ 200×80).
- Remove `face-content`, `face-bof`, `face-fache` from ASSETS and disk.
- Same 300×300 frame for every client layer; layer order body → head|animal → hair → accessory(hat over hair) → eyes → mouth.

**Checkpoint A** (stop and report): 2 assembled humans (one older: grey bun + glasses; one with cap), 1 animal, eyes open/closed side by side, and the heart cake in 3/4 with each of the 3 flank patterns. Render PNGs, look, fix, commit, STOP.
**Checkpoint B** (stop and report): sheets — all hairs in all 5 colours, accessories, 4 animals with 3 moods, 12 random assembled clients, the 15 dessert×shape flanks, plate + crumbs. STOP.
Then: update `src/assets.js` (ASSETS + PRECACHE), `tests/assets.test.js` (new keys), `ASSETS-LICENSES.md`; `npm test` green; commit.

---

### Task 3: cakeView — dessert flanks, ideal cake, eating

**Files:** Modify `src/ui/cakeView.js`; create `src/ui/orderCake.js`.

**Interfaces:**
- Consumes: `zoneMap`, `layoutToppings` (T1), `shapeMask` (existing), `side-pattern-<dessert>` (T2; until merged, fall back to the current `shape-<key>-side` look).
- Produces:
  - `drawCake` unchanged signature; the 3/4 side band now = `side-pattern-<cake.dessert>` masked by `shape-<shape>-side`, with that side texture's shading on top, bake-tinted.
  - `idealCake(scene, order): Cake` (orderCake.js) — `{dessert, shape, doughOk: true, bake: 'dore', glaze: {cells, size: GRID, colorKeys: order.glaze}, toppings}` with every masked cell painted `zone+1`'s colour index, and toppings from `layoutToppings(mask, GRID, total)` converted to the 400-frame units `drawCake` uses, kinds assigned in order (`count` each).
  - On the container returned by `drawCake` (3/4 view): `eat(bites: 0..4, {onDone}): void` — plays `bites` successive bite cut-outs from the right edge toward the left (each removes ~¼ of the cake: top, side band and the standing toppings in that part), with crumb particles; `bites === 4` leaves nothing. `nibble()` for 0.

- [ ] **Step 1:** Implement; keep `view: 'top'` unchanged.
- [ ] **Step 2: Verify** with `?scene=Service` screenshots (CDP driver `docs`-free copy at `tests/e2e/`): ideal cakes for 1/2/3 zones on heart, star, licorne; `eat(1..4)` sequence; 4 leaves nothing (toppings included).
- [ ] **Step 3:** `npm test` green; commit `feat(ui): dessert flanks, ideal order cake, eating`.

---

### Task 4: Clients — varied, eyes and mouth separate

**Files:** Modify `src/ui/client.js`, `src/game-state.js`, `src/debug.js`, `src/scenes/StandScene.js`, `src/scenes/ServiceScene.js` (client creation only).

**Interfaces:**
- Consumes: `generateClient`, `sameClient` (T1); T2 textures (until merged, missing layers are skipped).
- Produces: `drawClient(scene, x, y, client: Client, mood = 'content'): Container` with `.eyes`, `.mouth`, `.setMood(m)`, `.bob`; palettes `HAIR_HEX[5]`, `SKIN_HEX[4]`, `SHIRT_HEX[6]` in client.js. `blink(scene, container)` in fx.js squashes **only** `container.eyes` (swap to `client-eyes-closed` for ~120 ms) every 2–5 s; `talk(scene, container, ms)` makes the mouth bob while the order bubble appears. `round.client` replaces `round.clientVariant`; `newRound()` passes the previous round's client to `generateClient`.

- [ ] **Step 1:** Implement. **Step 2:** screenshots of 12 consecutive Stand clients (`?scene=Stand`, reload loop) and a blink frame; no two consecutive identical. **Step 3:** `npm test`; commit `feat: varied clients with separate eyes and mouth`.

---

### Task 5: Order bubble, top strip with highlight, flames by the oven

**Files:** Modify `src/scenes/StandScene.js`, `src/ui/orderReminder.js`, `src/scenes/BakeScene.js`, and the `addOrderReminder` call in Dough, Mold, Paint, Toppings.

**Interfaces:**
- Consumes: `idealCake`, `drawCake` (T3).
- Produces: `addOrderReminder(scene, order, step: 'pate'|'moule'|'cuisson'|'couleur'|'toppings'): Container` — top-left card with the ideal cake in 3/4 (~150 px, cached to a texture per order to avoid BitmapMask cost, as v1 does); the step's element is highlighted with a pulsing glow (side band / outline / whole cake / glaze / toppings). No digits, no icons list.
- Stand: one large bubble with the ideal cake in 3/4 (≈ 360 px); client `talk`s while it pops in; ✓ or tapping the bubble → `goNext`. Remove the 4-step bubbles and dots.
- Bake: target flames shown next to the heat buttons (not in the strip).

- [ ] **Step 1:** Implement. **Step 2:** screenshots of Stand bubbles for 1/2/3 zones and 1/2/3 kinds (toppings countable, none overlapping) and the strip on each step. **Step 3:** `npm test`; commit `feat: order shown as the finished cake; strip highlights the step`.

---

### Task 6: Paint zones and multi-kind toppings

**Files:** Modify `src/scenes/PaintScene.js`, `src/scenes/ToppingsScene.js`.

**Interfaces:** Consumes `zoneMap`, `zoneEdges`, `judgeColor`, `judgeToppings` (T1).
- Paint: dotted vertical lines at `zoneEdges(mask, GRID, order.glaze.length)` drawn over the top-down cake (guides only, painting crosses them); the bar shows **global** coverage (all colours) of the top; ✓ → `results.couleur = judgeColor(grid.cells, colorKeys, zones, order.glaze)`; `cake.glaze` as v1.
- Toppings: all owned kinds on the shelf; sparkle once when every ordered kind count is exact and nothing else is placed; ✓ → `results.toppings = judgeToppings(keys, order.toppings)`.

- [ ] **Step 1:** Implement. **Step 2:** CDP checks: 2-zone order painted right → ok; colours swapped → mauvaise-couleur; 3 kinds exact → ok + sparkle; extra kind → mauvais-topping. Perf: paint move handler still < 1 ms. **Step 3:** `npm test`; commit `feat: glaze zones and multi-kind toppings`.

---

### Task 7: Service eating, failure pictures, smoke, cache bump

**Files:** Modify `src/scenes/ServiceScene.js`, `tests/e2e/smoke.mjs`, `tests/e2e/smoke-steps.json`, `sw.js`.

**Interfaces:** Consumes `bitesFor`, `scoreRound`, `container.eat/nibble`, `plate`, `crumbs`, client `setMood`.
- Sequence: cake slides onto the `plate` on the worktop → client eats `bitesFor(coins)` bites (or nibbles and pushes the plate away at 0) with mouth animation → then the 5 ✅/❌ rows reveal → mood → coins. Failure pictures: colour → the zone's wrong pot (from `reason.color`) or a half-painted mini cake for `pas-couvert`; toppings → the `reason.key` topping with −/+ or a ✗ for `mauvais-topping`.
- Remove the v1 single bite mask.
- Smoke: update to v1.1 orders (paint each zone with its colour, place each kind × count), keep all v1 checks, and add: after a forced 5/5 nothing of the cake is visible; after a forced 0/5 the cake is intact.
- `sw.js`: `CACHE_VERSION = 'v3'`.

- [ ] **Step 1:** Implement. **Step 2:** `npm test` green; `node tests/e2e/smoke.mjs` → SMOKE PASS; screenshots of 5/5, 4/5, 3/5, 1/5, 0/5. **Step 3:** commit `feat: cake eaten by score; v1.1 smoke; cache v3`.
