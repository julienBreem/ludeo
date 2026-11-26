# Pêche au lancer et combat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bamboo-rod gesture of the Fishing scene with cast → a fish approaches → nibbles → bite → strike → hold/release fight where forcing during a thrash snaps the line.

**Architecture:** A pure, Phaser-free state machine `src/logic/angling.js` owns every timing (approach, nibbles, bite window, thrashes, tension, reel distance, break), advanced by `step(a, dtMs, holding, rng)` from the scene's `update()`. `FishingScene.js` is rewritten to cast, move fish and bobber, read input (finger down/up) and draw the state (line colour, rod bend, splashes). Everything after a landed fish (list slot / off-list release) is kept as it is.

**Tech Stack:** Phaser (local), ES modules, `node:test`. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-26-peche-lancer-combat-design.md` (refines the Fishing phase of `docs/superpowers/specs/2026-11-26-peche-cuisine-design.md`)

## Global Constraints

- Game folder `jeux/peche-cuisine/` only; no import from `jeux/stand-desserts/`; `shared/` untouched.
- Tablet 1280×800, touch targets ≥ 96 px, no text, ≤ 60 particles (fx helpers), every duration scaled by the pace (`dur()` / the `pace` argument).
- Casting needs no precision; a fish only ever reacts to a bobber near it; never an endless wait.
- Strike window ~1.5 s; holding while the fish does not thrash never breaks the line; ~1 s of holding during a thrash breaks it (× calm pace).
- A snapped line, a missed or spooked fish: no coin, no error, she casts again.
- Same fight at every level. Off-list fish landed: as today (cross, release, `results.peche = false`).
- Never `git add -A`/`.`/`git clean`; untracked root files belong to the owner. English code/comments.
- `sw.js` `CACHE_VERSION` bumped (and `tests/registry.test.js`) in the last task.

## Review Focus

1. **Finger lifted outside the canvas or the page losing focus mid-fight**: holding must end (not stay "pressed" and snap the line). → Task 2 binds `pointerup`, `pointerupoutside` and `game.events 'blur'` to `holding = false`; Task 1 test `no hold, no break and no progress`.
2. **The home button tapped while casting or fighting**: it goes home, it never casts or counts as holding. → Task 2 ignores pointers that start on an interactive object.
3. **The targeted fish dives away (pond renewal) during approach or fight**: it must not. → Task 2 excludes the angled fish from `dive`.
4. **No fish within reach of the bobber**: a fish is summoned after a while. → Task 1 test `waiting summons a fish after noFishFallbackMs`.
5. **The fight on a slow tablet (big dt between frames)**: one long frame must not skip a whole thrash window and break or land unfairly. → Task 1 test `a 500 ms frame is split` (step integrates in ≤ 50 ms sub-steps).

---

## File Structure

```
jeux/peche-cuisine/src/logic/angling.js     NEW  state machine + TUNING
jeux/peche-cuisine/src/scenes/FishingScene.js REWRITE (keeps list panel, wander, dive, flyToSlot, showAndRelease)
jeux/peche-cuisine/src/assets.js            PRECACHE gets src/logic/angling.js
tests/peche-cuisine/angling.test.js         NEW
sw.js, tests/registry.test.js               cache v13 (Task 3)
```

### Task 1: Angling state machine

**Files:**
- Create: `jeux/peche-cuisine/src/logic/angling.js`
- Modify: `jeux/peche-cuisine/src/assets.js` (add `'src/logic/angling.js'` to its PRECACHE list)
- Test: `tests/peche-cuisine/angling.test.js`

**Interfaces:**
- Produces:
  - `TUNING` (all ms at pace 1; distances are 0..1 of the reel):
    ```js
    { noticeRadius: 230,          // canvas px: fish farther than this ignore the bobber
      approachSpeed: 0.08,        // canvas px per ms
      noFishFallbackMs: 4000,
      nibbles: [0, 2],            // fake touches before the bite, inclusive
      nibbleMs: 450, nibbleGapMs: [500, 1100],
      biteMs: 1500,
      reelMs: { petit: 2200, moyen: 3500, grand: 5000 },   // holding time to land, thrashes excluded
      thrash: { petit: { gap: [2500, 4000], lasts: [600, 900] },
                moyen: { gap: [1800, 3000], lasts: [800, 1200] },
                grand: { gap: [1200, 2200], lasts: [1000, 1500] } },
      breakMs: 1000,              // tension (holding during a thrash) that snaps the line
      relaxRate: 2 }              // tension falls this many times faster than it rises
    ```
  - `createAngling(pace = 1) -> Angling` — `{ phase: 'waiting', pace, t: 0, fishId: null, size: null, nibblesLeft: 0, distance: 1, tension: 0, thrashing: false, nextThrash: 0, result: null }`.
  - `pickFish(bobber: {x,y}, fishes: {id,x,y}[], radius = TUNING.noticeRadius) -> id | null` — nearest within radius.
  - `approach(a, fishId, size, distPx, rng) -> Angling` — phase `'approach'`, `t = distPx / approachSpeed * pace`, draws `nibblesLeft`; exposes `a.approachMs` (for the scene's tween).
  - `strike(a) -> Angling` — in `'bite'`: phase `'fight'`, schedules `nextThrash`; in `'approach'`/`'nibble'`/`'gap'`: phase `'over'`, result `'spooked'`; otherwise unchanged.
  - `step(a, dtMs, holding: boolean, rng) -> { a, events: string[] }` — integrates in sub-steps of ≤ 50 ms. Phases and events:
    - `'waiting'`: after `noFishFallbackMs·pace` → event `'summon'` once (the scene then calls `approach`).
    - `'approach'` → when `t` runs out: `'nibble'` (event `'nibble'`) if `nibblesLeft > 0`, else `'bite'` (event `'bite'`).
    - `'nibble'` (nibbleMs) → `'gap'` (drawn nibbleGapMs) → next nibble or `'bite'`.
    - `'bite'`: after `biteMs·pace` → `'over'`, result `'missed'`, event `'missed'`.
    - `'fight'`: thrash on/off from `TUNING.thrash[size]` (events `'thrashStart'`/`'thrashEnd'`); `distance -= dt / (reelMs[size]·pace)` while holding and not thrashing; `tension += dt` while holding and thrashing, else `tension = max(0, tension - dt·relaxRate)`; `tension ≥ breakMs·pace` → `'over'`, `'broken'`; `distance ≤ 0` → `'over'`, `'landed'`. Events `'broken'` / `'landed'`.
  - `tension01(a) -> 0..1` = `tension / (breakMs·pace)`.

- [ ] **Step 1: Write the failing tests** (seeded `makeRng`; a `run(a, ms, holdingFn, rng)` helper stepping 16 ms frames, collecting events, `holdingFn(a)` deciding the finger):

```js
test('pickFish: nearest within the radius, null when all are far', () => {});
test('approach then 0..2 nibbles then a bite; approach time = dist / speed × pace', () => {});
test('strike during a nibble or the approach spooks the fish', () => {});
test('the bite lasts biteMs × pace, then the fish is missed', () => {});
test('waiting summons a fish after noFishFallbackMs, once', () => {});
test('always holding snaps the line on a grand fish (≥ 90 % of 50 seeds)', () => {});
test('releasing during every thrash lands every size (100 % of 50 seeds, each within 30 s)', () => {});
test('a hesitant player (releases 400 ms after a thrash starts) still lands every size', () => {});
test('holding while the fish does not thrash never raises the tension', () => {});
test('no hold, no break and no progress', () => { /* 20 s without holding: still fight, distance 1, tension 0 */ });
test('a grand fish takes longer to land than a petit (mean over 50 seeds)', () => {});
test('calm pace 1.5: the line snaps 1.5 × later', () => {});
test('a 500 ms frame is split: same result as 16 ms frames for a hold-through-thrash player', () => {});
```

- [ ] **Step 2: Run** `node --test tests/peche-cuisine/angling.test.js` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `angling.js` (pure; never mutate the input — return a new object).
- [ ] **Step 4: Run** the file, then `npm test` — Expected: PASS (registry precache test included).
- [ ] **Step 5: Commit** `feat(peche): angling state machine for cast, bite and fight`.

### Task 2: Fishing scene with cast and fight

**Files:**
- Modify: `jeux/peche-cuisine/src/scenes/FishingScene.js` (rewrite the bamboo part)

**Interfaces:**
- Consumes: Task 1 (`TUNING`, `createAngling`, `pickFish`, `approach`, `strike`, `step`, `tension01`); existing `factors()` / `dur()` from `ui/pace.js` (pass `factors().anim` as `pace`); existing `matchSlot`, `spawnCatch`, list panel, pond wander (`pondPoint`, `startSwim`, `dive`, `nextCatch`), `flyToSlot`, `showAndRelease`, `finish`, `goHome`.
- Produces: same round effects as today (`round.filled`, `round.caught`, `round.results.peche`).

Behaviour:
- **Cast**: in phase idle, a pointerdown on the water (inside the inner pond ellipse 640,440 r 500×250, above y 700) that did not start on an interactive object casts: the bobber flies from the rod tip to the point (`dur(450)`), splash ring, then `createAngling(pace)`; `pickFish` among pond fish (excluding none) → `approach`: that fish stops wandering and swims to the bobber over `a.approachMs` (faces it); none → wait; on `'summon'` pick a random pond fish and `approach` with its distance. A tap elsewhere (not water) does nothing.
- **Nibble**: bobber small shake + fish bumps it. **Bite**: bobber sinks (dips under, bigger splash); a pointerdown anywhere (not on the home button) calls `strike`.
- **Fight**: `holding` = finger down (set on pointerdown, cleared on `pointerup`, `pointerupoutside` and `this.game.events` `'blur'`). The hooked fish sits between the bobber point and the shore point under the rod tip, lerped by `a.distance`; it wiggles hard and throws splashes while `a.thrashing`. Line colour from `tension01`: white (0) → orange (0.5) → red (1); the rod image rotates up to 25° with the tension (rod bends). Holding without thrash: the line shortens visibly.
- **Results**: `'landed'` → existing `matchSlot` → `flyToSlot` or `showAndRelease` (phase busy meanwhile). `'broken'` → the line flashes and vanishes ("clac": a short white burst at the bobber), the fish swims off (`startSwim`), the bobber is gone; phase idle. `'missed'`/`'spooked'` → fish swims off, bobber reels back; phase idle.
- The angled fish is never chosen by `dive` and never replaced while angled.
- `update(time, delta)`: `step` the angling, handle events, redraw line/rod; nothing when no angling.
- Remove the old `onFishTap`/`startBite`/`missBite`/`hook` path; per-run fields reset in `create()`.

- [ ] **Step 1:** Implement the scene.
- [ ] **Step 2:** `node --check` the scene; `npm test` — Expected: PASS.
- [ ] **Step 3:** Serve the repo root and open `/jeux/peche-cuisine/index.html?debug` (unregister the service worker and hard-reload after each change). With `window.__game.scene.getScene('Fishing')` check by hand: a cast near a listed fish brings it, a strike in the bite window starts the fight, holding through a grand fish's thrash snaps the line, releasing on each thrash lands it, an off-list fish can be left alone, the home button during a fight goes home.
- [ ] **Step 4: Commit** `feat(peche): fishing by casting, bite and hold-release fight`.

### Task 3: Tuning pass and release

**Files:**
- Modify (values only, if the play test calls for it): `jeux/peche-cuisine/src/logic/angling.js` `TUNING` (and the matching test thresholds only if a value they encode changed on purpose)
- Modify: `sw.js`, `tests/registry.test.js` (`CACHE_VERSION` `'v13'`)

- [ ] **Step 1:** Play 3 full fishing phases in the browser at the normal and the calm pace; note any timing that feels too fast or too slow for a 6-year-old (thrash warning, break, reel length, wait for a bite).
- [ ] **Step 2:** Adjust `TUNING` values; `npm test` — PASS.
- [ ] **Step 3: Commit** `chore(peche): tune the fight; cache v13`.
