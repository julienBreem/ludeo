# Ludeo éducatif — Lot 1 (socle commun + commande + pâte): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared difficulty layer (7 themes × 3 levels, per-phase overrides, result history, parent-validated level proposals, parent "Difficulté" section) and the first two educational phases of the dessert stand (Commande = `lecture`, Pâte = `nombres`) at 3 levels each. The other phases keep today's behaviour and are listed as "bientôt" in the parent space; they come in later lots (Moule + Cuisson, Glaçage + Toppings, Service + Boutique).

**Architecture:** Pure logic in `shared/` (`themes.js`, `difficulty.js`, `history.js`; recommendations and store extended). Games declare their phases in `collection.js` (`PHASES`). The stand resolves all phase levels at the start of each client (`round.levels`) through `shared/runtime.js`, and records each phase result at Service. Exercise generation for the two phases is pure logic in the stand (`src/logic/orderText.js`, `src/logic/recipe.js`), node-tested.

**Tech Stack:** unchanged (HTML/CSS home, Phaser 3.90.0 game, ES modules, `node --test`, CDP smoke, GitHub Pages).

**Spec:** `docs/superpowers/specs/2026-11-19-educatif-design.md` (read "Décisions" and "Précisions").

## Global Constraints

- Themes (ids, exact): `lecture`, `nombres`, `geometrie`, `temps`, `couleurs-fractions`, `logique`, `monnaie`. Levels 1–3.
- Age recommendation for every theme: age ≤ 6 → 1, age 7 → 2, age ≥ 8 → 3. Parent validates (recommendation), nothing applies by itself.
- Effective level of a phase = its override if set, else its theme level (default 1).
- Proposals per phase: "too hard" = ≥ 3 failures among the last 4 counted results → propose level − 1 (not below 1); "too easy" = 5 successes in a row → propose + 1 (not above 3). One proposal per phase at a time. Ignoring clears that phase's history. Any level change of the phase clears its history. Overrides persist when the theme level changes; the parent can remove them.
- Counted results: the phase's point at Service (ok / not ok). Commande has no result (no proposals). Abandoned rounds (home, shop) record nothing.
- Levels for a client are read when the client arrives and kept until Service.
- Outside the reading phase, text is never the only information (picture/number/pictogram first).
- No counting/reading aids that do the work for the child.
- Every shared setting still applies to the home and every game. All v1 constraints hold (no ads/off-origin requests, no sound, ≥ 96 px, ≤ 60 particles, relative paths, local storage only, style S2, no npm deps).
- Save compatibility: `collection.v1` gains fields with defaults (old saves load fine); `standDesserts.v1` unchanged.
- `CACHE_VERSION` → `'v6'` (last task).

## Execution

- Agent per task, no per-task review, final Opus review + one fix wave.
- Models: T1, T6 → Sonnet 5.5; T2, T4, T5 → Opus 5.5; T3 (art) → Fable 5.2 with one parent checkpoint.
- Order: T1 → T2 → T3 (worktree) in parallel with T4 → merge T3 → T5 → T6.

## Review Focus

1. Old `collection.v1` saves (no levels/overrides/history) and garbage values load as defaults; a theme or phase id unknown to the catalog is ignored, not fatal. *(T1 test)*
2. Proposal thresholds exactly at the boundary (2 vs 3 failures in 4; 4 vs 5 successes) and never below 1 / above 3. *(T1 test)*
3. A level change by the parent mid-round does not change the current client. *(T2 check)*
4. French grammar of generated orders (gender/number agreement: « une étoile », « deux fraises », « un cœur rose et violet ») across all shapes/colours/toppings. *(T4 test)*
5. Pâte N3 never asks for a negative complement or a quantity above 20; prefilled + to-add always equals the target. *(T5 test)*

---

### Task 1: Shared difficulty logic

**Files:** Create `shared/themes.js`, `shared/difficulty.js`, `shared/history.js`; modify `shared/store.js`, `shared/recommendations.js`, `shared/effective.js` (if needed); tests `tests/shared/difficulty.test.js`.

**Interfaces (produces):**
- `themes.js`: `THEMES: Array<{id, name: string /* French, parent-facing */, levels: [string, string, string] /* one-line French description per level */}>` with the 7 ids; `isTheme(id)`.
- `store.js`: `defaultCollection()` gains `levels: {}` (theme → 1..3), `overrides: {}` (`"<gameId>/<phaseId>"` → 1..3), `history: {}` (`"<gameId>/<phaseId>"` → boolean[] newest last, max 5). `loadCollection` keeps valid entries only.
- `difficulty.js`: `recommendedLevel(age): 1|2|3`; `themeLevel(c, themeId): 1|2|3` (default 1); `phaseLevel(c, gameId, phase: {id, theme}): 1|2|3`; `setThemeLevel(c, themeId, n)`, `setOverride(c, gameId, phaseId, n|null)` (both clear the affected phases' history).
- `history.js`: `recordResult(c, gameId, phaseId, ok): Collection` (keeps last 5); `phaseProposal(c, gameId, phase): null | {direction: 'down'|'up', to: 1|2|3}`.
- `recommendations.js`: new kinds — `niveau` (one per theme whose level ≠ `recommendedLevel(age)`; signature = age) and `phase` (one per phase with a proposal; id `phase:<gameId>/<phaseId>`; signature = `direction+to`; text names the game's French name, the phase name and the new level). Apply/ignore as specified in Global Constraints. The functions need the registry's games/phases: pass them in (`recommendations(c, now, games)`), keep `shared/` free of registry imports.

- [ ] **Step 1: Failing tests:** defaults and garbage load; phaseLevel override vs theme; recommendedLevel 5/6/7/8; recordResult trims to 5; thresholds (3/4 fails → down, 2/4 → none; 5 ok in a row → up, 4 → none; bounds 1 and 3); ignoring a phase proposal clears history; setOverride clears history; niveau recommendation reappears when age changes.
- [ ] **Step 2:** `npm test` FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5: Commit** `feat(shared): themes, levels, history and proposals`.

---

### Task 2: Wiring — registry phases, runtime, parent "Difficulté", stand plumbing

**Files:** `jeux/stand-desserts/collection.js` (+ `PHASES`), `jeux/registry.js` + its test, `shared/runtime.js`, `shared/parent.js`, `shared/home.js` (recommendation call site), `jeux/stand-desserts/src/game-state.js` (round levels), `src/scenes/ServiceScene.js` (record results), `src/debug.js` (`?level=` debug param).

**Interfaces:**
- `PHASES = [{id: 'commande', name: 'Commande', theme: 'lecture', levels: 3}, {id: 'pate', name: 'Pâte', theme: 'nombres', levels: 3}, {id: 'moule', name: 'Moule', theme: 'geometrie', levels: 1}, {id: 'cuisson', name: 'Cuisson', theme: 'temps', levels: 1}, {id: 'couleur', name: 'Glaçage', theme: 'couleurs-fractions', levels: 1}, {id: 'toppings', name: 'Toppings', theme: 'logique', levels: 1}, {id: 'service', name: 'Service', theme: 'monnaie', levels: 1}]` — `levels: 1` = not yet educational ("bientôt"; no proposals, no override control).
- Registry test: every phase's theme `isTheme`; ids unique per game.
- `runtime.js`: `phaseLevels(gameId): Record<phaseId, 1|2|3>` (honours `?level=<phase>:<n>,…` only under the debug flag); `recordPhaseResult(gameId, phaseId, ok)` (no-op for `levels: 1` phases and `commande`).
- Stand: `newRound()` stores `round.levels = phaseLevels('stand-desserts')`; Service, after scoring, calls `recordPhaseResult` for each scored phase once (guarded by `round.paid`-style flag).
- Parent space: new **Difficulté** section — per theme a 1/2/3 choice with its one-line description and the recommended level marked; under each game, its phases with effective level, an "niveau propre" control (1/2/3 / « comme le thème ») for `levels: 3` phases, « bientôt » for the others. Recommendation cards for `niveau` and `phase`.

- [ ] **Step 1:** Implement. **Step 2:** `npm test` green; CDP: set theme `nombres` to 2 → stand round has `levels.pate === 2`; override pâte to 3; change theme mid-round → current client unchanged, next client changed; forced 3 failures in 4 on pâte (debug) → proposal card appears, Appliquer sets override; smoke PASS. **Step 3: Commit** `feat: difficulty levels in the parent space and the stand`.

---

### Task 3: Art for Commande and Pâte (Fable, worktree `feat/art-edu1`)

**Under `jeux/stand-desserts/assets/`:** empty packaging `empty-<ingredient>` for the 6 ingredients (cracked shell, folded flour bag, butter paper, empty sugar pot, empty milk bottle, chocolate wrapper; ~120 px), `egg-box` (2×5 open carton, cells visible, 400×200) and `egg-box-5` (a closed box of 5 eggs, draggable, 200×120), `tray` (small plate for prefilled empties, 260×120), `plate-side` (the board next to the bowl, ~420×300), `dice-1..5` constellation pictograms (dots, 96×96), `label-tag` (rounded label for words, 9-slice friendly, 200×64), `icon-eye` (glossy disc like the other icons), `pict-forme`, `pict-couleur`, `pict-topping` (neutral grey category pictograms, 96×96).
**Checkpoint (parent):** one sheet: the Pâte screen composed at N1/N2/N3 (bowl, plate with empties, egg box partly filled, tray, recipe card with dice / "2 + 1" / "7 (déjà 3)"), the Commande bubble at N1 with label tags and leader lines around a cake, the eye button. STOP and wait. Then licences + precache + tests; commit.

---

### Task 4: Commande — 3 levels (`lecture`)

**Files:** create `jeux/stand-desserts/src/logic/orderText.js` (+ `tests/…/orderText.test.js`); modify `src/scenes/StandScene.js`, `src/ui/orderReminder.js`, `src/scenes/ServiceScene.js` (commande error picture).

**Interfaces:**
- `orderText.js`: `NOUNS` (shape, colour, topping words with gender/plural), `orderWords(order): Array<{key, kind: 'forme'|'couleur'|'topping', word: string}>` (N1/N2 labels; toppings with digit count at N2: « 2 fraises »), `orderSentence(order): string` (N3, numbers in letters, correct agreement, e.g. « Un cœur rose et violet, avec deux fraises et une étoile. »).
- N1: label tags around the bubble's cake with leader lines to each element (shape outline, each glaze zone, each topping kind), never overlapping the cake; tapping a tag highlights its element. Bubble enlarged as needed.
- N2: the picture shows 5 s × pace factor, then hides; word list with category pictograms remains; the strip shows the words.
- N3: the sentence only; the strip shows the sentence; an eye button shows the picture for 2 s (free, repeatable).
- Service: on any failed point, the related word is highlighted in the recap (N2/N3).

- [ ] **Step 1: Failing tests** for agreement over every shape × colour × topping combination the catalog allows (gender of shapes: cœur m., étoile f., etc.), numbers in letters 1–6, plural forms, sentence punctuation. **Step 2:** implement logic; **Step 3:** scenes; **Step 4:** CDP screenshots at N1 (tags not covering the cake on all shapes incl. licorne, 3 zones + 3 kinds), N2 (hide after 5 s), N3 (sentence, eye); `npm test` green; commit `feat(stand): order at three reading levels`.

---

### Task 5: Pâte — 3 levels (`nombres`)

**Files:** create `jeux/stand-desserts/src/logic/recipe.js` (+ test); modify `src/scenes/DoughScene.js`, `src/logic/scoring.js` (`judgeDough` against the generated target), `src/scenes/ServiceScene.js` (pâte error recap).

**Interfaces:**
- `recipe.js`: `makeRecipe(dessert, level, rng): {target: Record<ing, number>, display: Record<ing, {kind: 'dice'|'digit'|'sum'|'complement', a?, b?, n}>, prefilled: Record<ing, number>, double: boolean}` — N1: target counts 1–5 shown as dice; N2: digits ≤ 10 with exactly one ingredient as a sum `a + b` (a, b ≥ 1); N3: values ≤ 20, one ingredient as complement (`prefilled` > 0, `target` > `prefilled`) and sometimes `double` (all displayed values doubled to get the target; target ≤ 20), sums may appear. Intruders unchanged.
- `judgeDough(added, stirProgress, dessert, target)` compares `prefilled + added` with `target`.
- Scene: plate beside the bowl collects each poured ingredient's empty packaging, sorted by kind; shells fill `egg-box` cells (second box after 10); `egg-box-5` draggable at N2–N3 (adds 5); N3 prefilled empties sit on the `tray`; the recipe card renders dice / digits / « 2 + 1 » / « 7 » with « déjà 3 » shown as the tray; « ×2 » badge when double.
- Service recap for pâte: the recipe line with what she put vs what was needed (and the operation).

- [ ] **Step 1: Failing tests:** bounds per level (N1 1–5; N2 ≤ 10, one sum; N3 ≤ 20, complement positive, prefilled+missing = target, double ≤ 20), determinism with seeded rng, judgeDough with prefilled. **Step 2:** implement; **Step 3:** scene; **Step 4:** CDP screenshots at N1/N2/N3 and a correct N3 complement round → ok; `npm test` green; commit `feat(stand): dough at three number levels`.

---

### Task 6: Smoke, cache, deploy notes

**Files:** `tests/e2e/smoke.mjs`, `smoke-steps.json`, `sw.js` (`'v6'`), `DEPLOY.md` (short note: the Difficulté section).
- Smoke: plays one round at each level for Commande and Pâte (via the parent space, not debug params), checks a "too hard" proposal appears after 3 forced pâte failures and that Appliquer lowers only pâte; keeps all existing checks.
- [ ] `npm test` green; SMOKE PASS; commit `test: educational lot 1 smoke; cache v6`.
