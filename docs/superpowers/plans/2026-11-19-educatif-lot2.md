# Ludeo éducatif — Lot 2 (Moule = géométrie, Cuisson = temps): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Moule (`geometrie`) and Cuisson (`temps`) phases of the dessert stand educational at 3 levels each, on top of lot 1's shared difficulty layer.

**Architecture:** Same as lot 1: pure exercise logic in `jeux/stand-desserts/src/logic/` (node-tested), scenes consume `round.levels`, results recorded at Service via the lot-1 runtime. The phases' `PHASES` entries switch to `levels: 3`.

**Tech Stack:** unchanged.

**Spec:** `docs/superpowers/specs/2026-11-19-educatif-design.md` — sections "3. Moule" and "4. Cuisson", "Règles communes", "Précisions". Lot 1 plan (shared interfaces, conventions): `docs/superpowers/plans/2026-11-19-educatif-lot1.md`.

## Global Constraints

- All lot 1 Global Constraints hold (themes, levels, proposals, text rules, no counting aids, shared settings everywhere, v1 constraints).
- New shapes: starter **triangle, rectangle, ovale**; shop **losange 10, hexagone 14**. Existing rond/carré/cœur (starter) and étoile/licorne (shop) unchanged. Existing saves keep their purchases (new starter items are added by `loadState`'s "re-add missing starters").
- Moule N2/N3 and Toppings-style rule: during the Moule phase at N2–N3 the top strip does not show the shape.
- Cuisson: heat flames at all levels; N3 accelerated clock 1 h ≈ 6 s × pace anim factor.
- `CACHE_VERSION` → `'v7'`.

## Execution

- Agent per task, no per-task review, final Opus review + one fix wave. Art without waiting for the parent (sheet kept for later review). Merge into local master after the fix wave.
- Models: T1 → Fable 5.2 (art, worktree `feat/art-edu2`); T2 → Sonnet 5.5; T3, T4 → Opus 5.5; T5 → Sonnet 5.5.

## Review Focus

1. Every shape (old and new) has fill/line/side/rim/mold textures and works in all cake views; triangle and losange zones/topping layouts stay valid. *(T1/T2 tests)*
2. Moule N2 clues are true for the target and false for every distractor offered. *(T2 test)*
3. Tangram pieces (N3) always reconstitute exactly the target silhouette; pieces snap within tolerance and can't be lost off-screen. *(T3)*
4. Cuisson N2/N3 judgement windows are symmetric around the target and scale with pace; the alarm-setting mistake at N3 yields under/over-baked, never a stuck flow. *(T4)*
5. Old saves load with the new starter shapes added and no coin loss. *(T2 test)*

---

### Task 1: Art (Fable, worktree `feat/art-edu2`)
New shapes `triangle`, `rectangle`, `ovale`, `losange`, `hexagone`: `shape-<k>-fill/-line/-side/-rim`, `mold-<k>-back/-front` (same frames and conventions as the existing shapes; see art-geometry notes). Geometry pictograms: `pict-coins-<n>` is NOT needed (numbers use dice) — draw `pict-coin` (a corner highlighted) and `pict-cote` (a side highlighted), `pict-rond` (no corner). Tangram pieces are generated in code from the silhouettes (no art). Cuisson: `timer-face-sector` (round kitchen timer, green sector layer separate), `timer-face-numbers` (1–5), `timer-hand`, `clock-face` (hours, half-hour ticks), `clock-hour-hand`, `clock-alarm-hand` (distinct colour), `icon-alarm`. Produce a review sheet for the parent (shapes in 3/4 and molds; timer/clock), add licences, assets manifest, geometry notes; `npm test` green; commit.

### Task 2: Shapes in the catalog + Moule logic
**Files:** `src/logic/catalog.js` (new ITEMS), `src/logic/shapes.js` (create: `SHAPE_PROPS = {rond: {corners: 0, sides: 0}, ovale: {corners: 0, sides: 0}, triangle: {corners: 3, sides: 3}, carre: {corners: 4, sides: 4, equalSides: true}, rectangle: {corners: 4, sides: 4, equalSides: false}, losange: {corners: 4, sides: 4, equalSides: true}, hexagone: {corners: 6, sides: 6}, coeur: {fun: 'pointe'}, etoile: {fun: 'branches', n: 5}, licorne: {fun: 'corne'}}`), `src/logic/moldExercise.js` (create: `makeMoldExercise(order, level, owned, rng) → {choices: shape[4] (N1: target + close distractor + 2 others; N2: choices where the clue is true only for the target), clue: null | {kind: 'corners'|'sides'|'equalSides'|'noCorner'|'fun', n?}, pieces: null | Array<{polygon: [u,v][], rotation}> (N3: 2–3 pieces cut from the target silhouette mask)}`), tests.
- [ ] Tests: catalog starters/prices; old-save load adds new starters; for 500 seeded exercises per level, N2 clue true for target and false for every other choice; N1 has a close distractor when available (rond↔ovale, carré↔rectangle↔losange); N3 pieces partition the target mask (union = mask, pairwise overlap ≈ 0). Commit `feat(stand): geometric shapes and mould exercises`.

### Task 3: Moule scene at 3 levels
**Files:** `src/scenes/MoldScene.js`, `src/ui/orderReminder.js` (hide shape at N2–N3 during Moule), `src/scenes/ServiceScene.js` (recap: expected mould with its clue), `collection.js` (`moule` → `levels: 3`).
- N1: 4 moulds; tapping shows the shape name as a small label (complement only).
- N2: clue card (dice for n + pictogram, word under); tapping a mould makes its corners glow one by one as she taps them (she taps each corner; no auto count).
- N3: target silhouette outline as an empty slot; 2–3 pieces (rotated) to drag and rotate (tap to rotate 90°) into place; snaps within tolerance; ✓ when filled; judged right if every piece is placed correctly.
- [ ] CDP screenshots per level; `npm test`; commit `feat(stand): mould at three geometry levels`.

### Task 4: Cuisson at 3 levels
**Files:** `src/logic/bake.js` (add level-aware targets: `bakeTarget(dessert, level) → {kind: 'sector'|'number'|'clock', …}` and judgement windows), `src/scenes/BakeScene.js`, tests, `collection.js` (`cuisson` → `levels: 3`).
- N1: round timer with green sector (current mechanics re-skinned).
- N2: numbered 1–5 timer; target per dessert (cupcake 2, gâteau 3, tarte 4); invisible tolerance ±0.35 of a number (scaled by pace greenWindow); no green sector.
- N3: clock face; start time on a small clock + "2 h" complement; she sets the alarm hand (drag, snaps to hours/half-hours), then starts; time runs 1 h ≈ 6 s × anim factor; take out when the hour hand reaches the alarm; wrong alarm → pale/burnt outcome by the real elapsed baking; durations 1 h, later ½ h.
- [ ] Tests for targets and windows per level and pace; CDP per level; commit `feat(stand): baking at three time levels`.

### Task 5: Smoke, cache v7
Smoke plays Moule and Cuisson at each level via the parent space; `CACHE_VERSION = 'v7'`; `npm test` green; SMOKE PASS; commit.
