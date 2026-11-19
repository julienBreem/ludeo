# Collection — home screen and shared settings: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-game project into a collection: an HTML home screen (avatar, category tiles, parent space with profile / pace / evening mode / recommendations / per-game reset), a shared settings module every game must apply, and the dessert stand moved to `jeux/stand-desserts/` applying pace and evening mode.

**Architecture:** Root = home (`index.html`, HTML/CSS), `shared/` (pure settings logic + a small browser runtime), `vendor/` (Phaser, shared), `jeux/registry.js` (games and categories), `jeux/<id>/` (one folder per game with its own `collection.js` declaring precache list, reset and supported settings). One module service worker at the root precaches the home and every registered game. Games read effective settings through `shared/runtime.js`.

**Tech Stack:** unchanged — plain ES modules, HTML/CSS for the home, Phaser 3.90.0 for games, `node --test`, CDP smoke.

**Spec:** `docs/superpowers/specs/2026-11-19-accueil-collection-design.md` (read "Décisions" and "Précisions").

## Global Constraints

- **Every shared setting (pace, evening mode, and future ones) applies to the home AND every game.** `SHARED_SETTINGS = ['rythme', 'soir']`; a test fails if a registered game does not declare them all.
- Nothing changes without the parent: recommendations only apply on "Appliquer".
- Child-facing home has **no text**; the parent space may use French text. 24 h times.
- No parent-space protection (plain tap on a drawn S2 gear).
- The stand keeps its save key `standDesserts.v1` (progress preserved). Home settings use `collection.v1`.
- Installed app keeps its address: root `manifest.webmanifest` `start_url: './'` now opens the home. `CACHE_VERSION` → `'v4'`, cache name prefix unchanged (`stand-`) so old caches are cleaned.
- Pace table: age ≤ 6 → `calme`, otherwise `normal` (`rapide` never recommended). Factors: `calme {transition: 2.5, anim: 1.5, greenWindow: 1.5, particles: 0.5}`, `normal` all 1, `rapide {transition: 0.6, anim: 1, greenWindow: 1, particles: 1}`.
- Evening mode: parent-enabled window (default 19:00 → 07:00, wraps midnight); while active it forces pace `calme`, softens/darkens/warms visuals, removes confetti and sparkles; re-evaluated every 60 s.
- All v1 constraints: no ads/off-origin requests, no sound, ≥ 96 px targets, ≤ 60 particles, no npm deps, relative paths, local storage only, style S2.

## Execution

- Agent per task, no per-task review, final Opus review + one fix wave (same as v1.1).
- Models: T1, T4, T5, T6 → Sonnet 5.5; T2 → Opus 5.5; T3 (art) → Fable 5.2 with one parent checkpoint.
- Order: T1 → T2 → (T3 in a worktree in parallel with T4/T5) → merge T3 → T6.

## Review Focus

1. Evening window across midnight (22:00→06:00, 19:00→07:00, start == end) and exactly at the boundaries. *(T1 test)*
2. A recommendation ignored for age 6 must come back at age 7, and never come back while the age is unchanged. *(T1 test)*
3. Corrupted / missing `collection.v1` or throwing storage → home and games run with defaults. *(T1 test)*
4. After the move, an already-installed tablet (cache `stand-v3`, start URL `./`) gets the home and still has its dessert progress. *(T2 + T6 smoke: seed `standDesserts.v1`, load, check coins)*
5. Evening mode starting mid-game softens visuals without breaking the flow, and the stand's flow never sticks at slow pace. *(T5 check, T6 smoke)*

---

### Task 1: Shared settings logic

**Files:** Create `shared/profile.js`, `shared/pace.js`, `shared/evening.js`, `shared/store.js`, `shared/recommendations.js`, `shared/effective.js`; tests `tests/shared/*.test.js`.

**Interfaces (produces):**
- `profile.js`: `ageFrom({month, year}, now: Date): number` (full years; month 1–12).
- `pace.js`: `PACES = ['calme','normal','rapide']`, `PACE_FACTORS` (Global Constraints), `recommendedPace(age): 'calme'|'normal'`.
- `evening.js`: `parseHHMM(s): number` (minutes), `isEvening(now: Date, {enabled, start, end}): boolean` — false if disabled or start === end; wraps midnight; start inclusive, end exclusive.
- `store.js`: `COLLECTION_KEY = 'collection.v1'`; `defaultCollection(): {version: 1, profile: null, avatar: null, pace: 'normal', evening: {enabled: false, start: '19:00', end: '07:00'}, ignored: {}}`; `loadCollection(storage)`, `saveCollection(storage, c): boolean` — same robustness as `src/logic/save.js` (missing/garbage/wrong types/throwing → defaults, never throws).
- `recommendations.js`: `recommendations(c, now): Array<{id: 'profil'|'rythme'|'soir', text: string, signature: string}>` — `profil` when no profile (signature `'none'`); `rythme` when profile and `c.pace !== recommendedPace(age)` (signature = `String(age)`, text names the age and the pace); `soir` when evening not enabled (signature `'off'`); each filtered out when `c.ignored[id] === signature`. `applyRecommendation(c, id, now): Collection` (profil → no-op, the UI opens the profile; rythme → set pace; soir → enable with defaults). `ignoreRecommendation(c, rec): Collection`.
- `effective.js`: `effectiveSettings(c, now): {pace, evening: boolean, factors}` — evening forces `calme`.

- [ ] **Step 1: Failing tests** covering: ageFrom around a birthday; recommendedPace 5/6/7/12; isEvening for 19:00→07:00 at 18:59/19:00/23:30/06:59/07:00, for 22:00→06:00, disabled, start==end; store robustness (missing, garbage, wrong types, throwing storage); rythme recommendation ignored at age 6 hidden at 6 and shown at 7; soir hidden after ignore; profil shown without profile; effectiveSettings evening → calme.
- [ ] **Step 2:** `npm test` → FAIL. Make the test glob include `tests/**/*.test.js` (already does).
- [ ] **Step 3: Implement.** **Step 4:** `npm test` → PASS. **Step 5: Commit** `feat(shared): profile, pace, evening, recommendations`.

---

### Task 2: Restructure into a collection

**Files:** `git mv` the stand into `jeux/stand-desserts/` (`index.html`, `src/`, `assets/`, `ASSETS-LICENSES.md`); keep `vendor/` at root; create `jeux/registry.js`, `jeux/stand-desserts/collection.js`, root `index.html` (temporary minimal home: one big tile linking to the game — T4 replaces it), `shared/runtime.js`; modify `sw.js`, `manifest.webmanifest`, `tests/*`, `tests/e2e/smoke.mjs`, `DEPLOY.md`.

**Interfaces:**
- `jeux/stand-desserts/collection.js`: `ID = 'stand-desserts'`, `CATEGORY = 'compter-observer'`, `SUPPORTS = ['rythme','soir']`, `PRECACHE: string[]` (root-relative, from the game's `src/assets.js`, prefixed `jeux/stand-desserts/`), `reset(storage): void` (uses the stand's `resetState`).
- `jeux/registry.js`: `SHARED_SETTINGS = ['rythme','soir']`; `CATEGORIES = [{id: 'compter-observer', tile: 'shared/assets/cat-compter-observer.svg'}]`; `GAMES = [{id, category, path: 'jeux/stand-desserts/index.html', supports, precache, reset}]` (static imports of each game's collection.js); `categoriesWithGames(): Category[]`; `HOME_PRECACHE` (root files: `./`, `index.html`, `manifest.webmanifest`, `vendor/phaser.min.js`, `shared/**`, `jeux/registry.js`, home assets, icons).
- `shared/runtime.js` (browser): `getCollection()`, `getEffective(now = new Date())`, `onEffectiveChange(cb)` (checks every 60 s, calls cb when pace/evening changes), `updateCollection(fn)`.
- `sw.js`: precache = `HOME_PRECACHE` + every `GAMES[i].precache`; `CACHE_VERSION = 'v4'`.
- The game page loads `../../vendor/phaser.min.js`; its `?scene=` debug param still works at `jeux/stand-desserts/index.html?scene=…`.

- [ ] **Step 1:** Tests: registry — every game supports every `SHARED_SETTINGS` entry; every precache path (home + games) exists on disk; every file under each game folder's `assets/` and `src/` is in that game's precache; `categoriesWithGames()` returns only non-empty categories. Update existing tests' import paths.
- [ ] **Step 2:** Move and wire. **Step 3:** `npm test` PASS; smoke updated to start at the root, tap the tile, then play as before → SMOKE PASS; offline reload of root and of the game works; seeding `standDesserts.v1` with coins before load keeps them. **Step 4: Commit** `refactor: dessert stand becomes the first game of the collection`.

---

### Task 3: Home art (Fable, worktree `feat/art-home`)

**Keys/files under `shared/assets/`:** `cat-compter-observer.svg` (tile illustration: cake + counting dots, ~480×360), `icon-home.svg` and `icon-gear.svg` (glossy discs like the stand icons, 160×160), `home-bg-day.svg` and `home-bg-evening.svg` (1280×800, calm), `moon.svg`. Avatars reuse the stand's client parts (no new art).
**Checkpoint (parent):** one sheet with the home mockup composed at 1280×800 in day and evening, plus the icons. STOP, report, wait. Then add licence rows (`shared/ASSETS-LICENSES.md`) and the files to `HOME_PRECACHE`; commit.

---

### Task 4: Home screen and parent space (HTML/CSS)

**Files:** root `index.html`, `shared/home.css`, `shared/home.js`, `shared/parent.js`, `shared/avatar.js`.

**Interfaces:** consumes T1 logic, `shared/runtime.js`, `jeux/registry.js`; `drawAvatar(canvas, avatar)` composites the stand's client layers (`jeux/stand-desserts/assets/client/*`) with tints on a 2D canvas (multiply + destination-in), using the stand's palettes (import them from the stand's `src/ui/client.js` palette exports or move the palettes to a shared module).
- Home: avatar top-left, S2 gear top-right with a red dot when `recommendations()` is non-empty; one large tile per `categoriesWithGames()`; tapping a tile with one game navigates (with a 300 ms fade, longer at calme pace) to its path; with several games, shows that category's games as tiles. Evening: `home-bg-evening`, softened palette, moon. Pace applies to the fade and tile animations. No text for the child.
- Parent space (overlay or page, French text): Profil (prénom, mois/année de naissance, avatar picker with random/previous/next), Rythme (3 choices, the recommended one marked), Mode soir (on/off, start/end 24 h), Recommandations (cards with explanation, Appliquer / Ignorer), Jeux (per game: reset button with confirmation calling the game's `reset`). Every change saved via `updateCollection`.

- [ ] **Step 1:** Implement. **Step 2:** CDP screenshots: first launch (no profile → dot, profil recommendation); profile age 6 with pace normal → rythme recommendation; Appliquer → calme, dot gone; Ignorer at 6 then set birth to make 7 → comes back (normal is recommended at 7 → if pace calme it now recommends normal); evening on and a forced clock (`?now=2026-11-19T20:00` debug param read by runtime) → evening home; reset game clears stand coins. **Step 3:** `npm test`; commit `feat: home screen and parent space`.

---

### Task 5: The stand applies shared settings

**Files:** `jeux/stand-desserts/src/ui/flow.js`, `src/ui/fx.js`, `src/logic/bake.js` (or the Bake scene), `src/scenes/StandScene.js`, `src/main.js`, scenes with notable tweens (client walk, pour, eat).

**Interfaces:** consumes `getEffective`, `onEffectiveChange` (T2). Produces `src/ui/pace.js` in the game: `factors()` (current effective factors), `dur(ms)` (ms × anim), `fade()` (250 × transition).
- Transitions: `FADE_MS` × `transition`; main tweens and timed delays × `anim`; bake: the green window length × `greenWindow` (scale the gauge rate inside the green band only, so total time to green is unchanged); particles counts × `particles`.
- Evening: CSS filter on the game canvas (`brightness(0.8) saturate(0.7) sepia(0.15)`, transition 1.5 s) when `evening` is true; `confetti` and `sparkle` become no-ops while evening is on.
- Live: `onEffectiveChange` updates the filter immediately and the pace from the next scene.
- Stand: home button (`shared/assets/icon-home.svg`, ≥ 96 px, bottom-left next to the shop or top-left) navigating to `../../index.html`; remove the 3 s corner reset (the parent space does it now).

- [ ] **Step 1:** Implement. **Step 2:** CDP: calme vs normal — measured fade durations and green-window ms; evening via `?now=` → filtered canvas, no confetti on 5/5; switching evening on mid-game (advance fake clock) → filter fades in, flow continues; home button returns home. **Step 3:** `npm test`; commit `feat(stand): apply pace and evening mode; home button`.

---

### Task 6: Smoke, deploy guide, cache

**Files:** `tests/e2e/smoke.mjs`, `smoke-steps.json`, `DEPLOY.md`, `sw.js` (confirm v4).
- Smoke: root → profile set via parent space → recommendation applied → tile → two full stand rounds at calme pace → home button → evening forced via `?now=` → stand runs with filter and no confetti; seeded `standDesserts.v1` coins survive; 0 off-origin requests.
- DEPLOY.md (French): new layout (upload everything except docs/tests/.superpowers/package.json), the home is now the start page, how to add a game later (folder + collection.js + registry line + it must support all shared settings).

- [ ] **Step 1:** Implement. **Step 2:** `npm test` green; SMOKE PASS. **Step 3:** commit `test: collection smoke; deploy guide`.
