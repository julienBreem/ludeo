# Village des singes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the collection's second game, a reading/writing game where the child builds one monkey house per letter and teaches the monkey words (listen by syllables, write with letter cubes, 3 levels capped by the parent's level), with two pre-generated voices and hand-drawn layered SVG art.

**Architecture:** A new Phaser game in `jeux/village-singes/`, built like the stand: pure logic in `src/logic/` (node-tested), data in `src/data/`, scenes in `src/scenes/`, shared Phaser components in `src/ui/`. It plugs into the collection through `collection.js` (registry, home category "lire et écrire", parent reset) and into the shared difficulty layer through one phase `mots` (theme `lecture`) whose level is the **ceiling**. Audio files and part-split SVGs are produced offline by scripts in `tools/village-singes/` (not published) and committed.

**Tech Stack:** Phaser 3.90.0 (vendored), ES modules, `node --test`, CDP smoke script (Node ≥ 22, headless Chrome). Offline tools: `~/tools/tts-local/.venv/bin/python` (mlx-audio, Chatterbox, Kokoro, audiotsm, soundfile), macOS `afconvert`.

**Spec:** `docs/superpowers/specs/2026-11-19-village-singes-design.md` (read it whole; "Niveaux", "Mini-jeu des mots", "Son", "Dessins" and "Licences" are binding). Prototypes: `docs/superpowers/specs/village-singes-prototypes/` (reference SVGs, animation page, reference voices). Shared difficulty layer: `docs/superpowers/specs/2026-11-19-educatif-design.md`.

## Global Constraints

- **Work in a separate git worktree on branch `feat/village-singes` created from `dc03c81`.** Another session is editing the stand in the main worktree (branch `feat/edu-lot2`, uncommitted changes): never touch `jeux/stand-desserts/**`, never `git add -A`, never stage `singe.jpeg` or other untracked root files.
- Game id `village-singes`; folder `jeux/village-singes/`; NAME `Village des singes`; CATEGORY `lire-ecrire`; SUPPORTS `['rythme', 'soir']`; PHASES `[{ id: 'mots', name: 'Mots', theme: 'lecture', levels: 3 }]`.
- Canvas 1280×800, Phaser FIT/CENTER like the stand; landscape tablet, Chrome; touch targets ≥ 96 px; ≤ 60 particles; relative paths only; local storage only; no npm dependencies; no network requests off origin.
- Save key `villageSinges.v1`; collection settings are read only through `shared/runtime.js` (`getEffective`, `onEffectiveChange`, `phaseLevels`, `recordPhaseResult`).
- Letters v1, fixed order: `a, i, o, m, l, s`. Lowercase print everywhere; the house door shows capital + lowercase (`M m`). Font: **Andika** (SIL OFL 1.1), bundled woff2.
- Levels: 1 = model shown (copy), 2 = model shown then hidden when she starts (eye button shows it again), 3 = dictation (picture + voice, replay button). Distractor cubes: L1 none, L2 1–2 very different, L3 confusable pairs when seen. House level: first 4 words L1, the rest L2, replay of all words L3 — each capped by the ceiling (`phaseLevels('village-singes').mots`); ceiling 1 → no replay; ceiling 2 → replay at L2.
- A word is **ok** when written with ≤ 2 wrong cube drops. Results are recorded only for words played at the ceiling level (`recordPhaseResult` already enforces it).
- Graphemes the child has not learned (not a built house) are **pre-filled in grey** and are not cubes. Cubes fill **left to right**; a wrong cube slides back gently; no failure counter shown, no time limit.
- Voices: **monkey** says every syllable, every word and his reactions; **narrator** says instructions and the letter sounds (house letter + every cube). Both through Chatterbox `mlx-community/chatterbox-multilingual-v3`, `lang_code fr`, reference audio `docs/superpowers/specs/village-singes-prototypes/voix-reference-singe.wav` / `voix-reference-narratrice.wav`. Files are AAC `.m4a`. Never redirect a Qwen3/mlx-audio run's output to `/dev/null` (it silently fails): pipe it.
- No isolated sound may be spelled (« ès », « cé ache »): every letter sound is checked by the voiced/unvoiced measurement and validated by the parent by ear.
- Art: hand-drawn SVG, direction of `village-singes-prototypes/v2/singe.svg`: natural proportions, white eyes with black pupils, no shine, no pink cheeks, thick outline `#1e120a`, fur tufts, darker brown cel shading. Every animated/touchable piece is its own top-level `<g id>`. No AI images.
- Every image and sound is listed in `jeux/village-singes/ASSETS-LICENSES.md`, including the SIWIS attribution: Yamagishi, Honnet, Garner, Lazaridis, *The SIWIS French Speech Synthesis Database*, University of Edinburgh (CSTR), 2017, https://doi.org/10.7488/ds/1705 (CC BY 4.0).
- Every shared setting still applies: pace scales animation durations, pauses between two utterances and scene fades; evening = the stand's canvas filter, no confetti/sparkles, calm pace.
- `CACHE_VERSION` in `sw.js` is bumped once, in the last task, to the next unused value at that time.

## Review Focus

1. **The parent lowers the level while a house is above it** → the next word plays at the new ceiling, never above (Task 3 test `wordLevel caps at the ceiling`).
2. **Damaged or foreign save** (edited localStorage, houses out of letter order, unknown word ids, storage that throws) → the game starts clean or keeps only the valid prefix, never crashes (Task 3 tests on `loadState`).
3. **Double tap / tap during speech** (second drop while the syllable is spoken, double tap on a silhouette or on "replay") → a word is earned once, a cube is placed once (Task 3 test `earnWord is idempotent`; Task 9 input lock while a sound plays).
4. **Nothing left to earn** (all objects earned, ceiling 1) → no replay offer and no request bubbles (Task 3 tests on `canReplay` and `pickRequest`).
5. **A sound does not play** (missing file, autoplay refused before the first touch) → the scene goes on after a short fallback delay; the mouth stops (Task 7 test on `settleAfter`).

---

### Task 1: The game in the collection (empty village)

**Files:**
- Create: `jeux/village-singes/index.html` (copy of the stand's page: title `Village des singes`, body background `#8cc560`, loads `../../vendor/phaser.min.js` and `src/main.js`), `jeux/village-singes/collection.js`, `jeux/village-singes/src/main.js`, `src/config.js`, `src/assets.js`, `src/debug.js`, `src/ui/pace.js`, `src/ui/flow.js`, `src/scenes/BootScene.js`, `src/scenes/VillageScene.js`, `src/logic/save.js` (stub with `resetState` only, completed in Task 3), `jeux/village-singes/assets/ui/tile.svg` (placeholder, final art Task 6), `shared/assets/cat-lire-ecrire.svg` (placeholder, final art Task 6)
- Modify: `jeux/registry.js` (import, `GAMES`, `CATEGORIES` gets `{ id: 'lire-ecrire', tile: 'shared/assets/cat-lire-ecrire.svg' }` after `compter-observer`, `HOME_PRECACHE` gets the new tile), `tests/registry.test.js`
- Test: `tests/registry.test.js`, `tests/village/assets.test.js`

**Interfaces:**
- Produces: `collection.js` exports `ID`, `NAME`, `CATEGORY`, `TILE = 'assets/ui/tile.svg'`, `SUPPORTS`, `PHASES`, `PRECACHE`, `reset(storage)`.
- Produces: `src/config.js` → `W = 1280`, `H = 800`, `OUTLINE = 0x1e120a`, `BG = 0x8cc560`.
- Produces: `src/assets.js` → `ASSETS: {key, file, w, h}[]` (SVG), `AUDIO: {key, file}[]` (filled in Task 5), `FONT_FILE = 'assets/fonts/Andika-Regular.woff2'` (Task 7), `PRECACHE: string[]` = every ASSETS/AUDIO file, the font, `index.html` and every `src/**/*.js` (relative to the game folder).
- Produces: `src/ui/pace.js` → `installSettings(canvas)`, `dur(ms)`, `fade()`, `eveningOn()`, `EVENING_FILTER` — same behaviour as `jeux/stand-desserts/src/ui/pace.js` (read it; copy, do not import across games). `src/ui/flow.js` → `goTo(scene, key, data?)` fading with `fade()`.
- Produces: scene keys `'Boot'`, `'Village'`. Boot loads ASSETS then starts `Village` (or `?debug&scene=<Key>` through `debug.js`, as the stand does). Village shows the background color and a home button (≥ 96 px, top left) that fades to `../../index.html`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/registry.test.js (add)
test('the village is registered as specified', () => {
  const g = GAMES.find(x => x.id === 'village-singes');
  assert.ok(g);
  assert.equal(g.name, 'Village des singes');
  assert.equal(g.category, 'lire-ecrire');
  assert.deepEqual(g.supports, ['rythme', 'soir']);
  assert.deepEqual(g.phases, [{ id: 'mots', name: 'Mots', theme: 'lecture', levels: 3 }]);
});
test('categories: compter-observer then lire-ecrire, each with its tile in the home precache', () => {
  assert.deepEqual(CATEGORIES.map(c => c.id), ['compter-observer', 'lire-ecrire']);
  for (const c of CATEGORIES) assert.ok(HOME_PRECACHE.includes(c.tile));
});
```

`tests/village/assets.test.js`: the stand's `tests/assets.test.js` checks, for the village: every ASSETS/AUDIO file exists; every file under `jeux/village-singes/assets/` is listed (ASSETS, AUDIO or FONT_FILE); every `src/**/*.js` and asset is in PRECACHE; every PRECACHE entry exists; keys unique; SVG files parse (start with `<svg`).

- [ ] **Step 2: Run `npm test` — the new tests fail** (no village game).
- [ ] **Step 3: Implement the files above.** `reset(storage)` calls `resetState(storage)` from `src/logic/save.js` (`storage.removeItem('villageSinges.v1')` in a try).
- [ ] **Step 4: Run `npm test` — all pass.** Serve the repo (`python3 -m http.server 8000`), open `http://localhost:8000/`: a second category tile appears, it opens the village (one game → direct), the home button returns; `?debug&now=2026-11-19T21:00` on the village shows the evening filter.
- [ ] **Step 5: Commit** `feat(village): the village in the collection (empty scene)`.

### Task 2: Letters and words (data) — parent checkpoint

**Files:**
- Create: `jeux/village-singes/src/data/letters.js`, `jeux/village-singes/src/logic/words.js`
- Test: `tests/village/letters.test.js`

**Interfaces:**
- Produces: `LETTERS: Letter[]` where `Letter = { id: string, grapheme: string, capital: string, job: { id: string, name: string }, words: Word[] }` and `Word = { id: string, syllables: string[], graphemes: string[], image: string /* ASSETS key 'obj-<id>' */ }`. `id` of a word is the word itself (lowercase, unique across all letters).
- Produces: `src/logic/words.js` → `wordText(word): string`, `syllableOfGrapheme(word): number[]` (syllable index of each grapheme), `syllableEnds(word): number[]` (indices of the graphemes that end a syllable), `GRAPHEMES: string[]` (single letters a–z, `é`, `è`, `ch`, `ou`, `on`, `an`).

- [ ] **Step 1: Write the failing tests** — `tests/village/letters.test.js`:
  - letters are exactly `['a','i','o','m','l','s']` in that order, capitals `A I O M L S`;
  - each letter has 8–10 words; word ids unique across letters; `image === 'obj-' + id`;
  - `syllables.join('') === graphemes.join('') === id`; 1–3 syllables; every grapheme in `GRAPHEMES`;
  - every syllable boundary falls on a grapheme boundary (`syllableEnds` covers the last grapheme and has one entry per syllable);
  - each word contains its house grapheme;
  - no silent final letter: last grapheme not in `['e','s','t','x','d','z','p','g']`;
  - each job `name` starts with the house letter (case-insensitive);
  - `syllableEnds({ syllables: ['mo','to'], graphemes: ['m','o','t','o'] })` deep-equals `[1, 3]`.
- [ ] **Step 2: Run** `node --test tests/village/letters.test.js` — fails.
- [ ] **Step 3: Write `words.js` and the word list.** Words follow the spec rules ("Mots, objets, métiers"): the house letter makes its main sound; short regular words, mostly 2 syllables, child vocabulary (Belgian French), picturable objects; later houses reuse earlier letters (lama, mamie…). Jobs: a job name per letter starting with it (e.g. m musicien; the others are the builder's proposal).
- [ ] **Step 4: Run the test — passes.**
- [ ] **Step 5: CHECKPOINT (parent).** Send the list to the parent as one table per letter (word, syllables, job) and STOP until they validate or correct it. Apply corrections, re-run the test.
- [ ] **Step 6: Commit** `feat(village): letters, words and jobs (validated)`.

### Task 3: Progress and save (pure logic)

**Files:**
- Create: `jeux/village-singes/src/logic/progress.js`; complete `src/logic/save.js`
- Test: `tests/village/progress.test.js`, `tests/village/save.test.js`

**Interfaces:**
- Consumes: `LETTERS` (Task 2).
- Produces (`progress.js`; `State = { version: 1, houses: House[] }`, `House = { letter: string, plot: number, earned: string[], replayed: string[] }`; all functions pure, never mutate):
  - `INSTALL_AT = 4`, `PLOT_COUNT = 6`
  - `nextLetter(state): Letter | null` — next letter of `LETTERS` without a house
  - `buildHouse(state, plot): State` — adds a house for `nextLetter` on a free plot; unchanged if none or plot taken/out of range
  - `houseOf(state, letterId): House | undefined`
  - `learnedGraphemes(state): string[]` — graphemes of built houses
  - `isInstalled(house): boolean` — `earned.length >= INSTALL_AT`
  - `canReplay(house, letter, ceiling): boolean` — all words earned, `ceiling >= 2`, replay not complete
  - `wordLevel(house, letter, ceiling): 1|2|3` — `earned < 4` → 1; not all earned → `min(2, ceiling)`; replay → `min(3, ceiling)`
  - `earnWord(state, letterId, wordId): State` — adds to `earned` if not there, else (only when every word of the letter is already earned) to `replayed`; never duplicates
  - `hasBonus(house, letter): boolean` — every word in `replayed`
  - `wordOk(mistakes: number): boolean` — `mistakes <= 2`
  - `pickRequest(state, rng = Math.random): { letterId, wordId } | null` — a random unearned word of a built, installed house; `null` when none
- Produces (`save.js`): `STORAGE_KEY = 'villageSinges.v1'`, `defaultState()`, `loadState(storage): State`, `saveState(storage, state): boolean`, `resetState(storage)`.

- [ ] **Step 1: Write the failing tests.** Names and assertions (use the real `LETTERS`; `a = LETTERS[0]`):
  - `nextLetter follows a, i, o, m, l, s and ends with null`
  - `buildHouse refuses a taken plot and a plot outside 0..5`
  - `wordLevel`: 0 earned → 1; 4 earned, ceiling 3 → 2; all earned, ceiling 3 → 3; all earned, ceiling 2 → 2;
  - `wordLevel caps at the ceiling`: 5 earned, ceiling 1 → 1
  - `canReplay`: all earned + ceiling 1 → false; ceiling 2 → true; all replayed → false
  - `earnWord is idempotent`: earning `a.words[0].id` twice leaves `earned` with it once and `replayed` empty (replay mode only when all words earned)
  - `isInstalled` true at 4 earned
  - `wordOk(2)` true, `wordOk(3)` false
  - `pickRequest` returns null with no house, null when every word of installed houses is earned, otherwise a word of an installed house that is not earned
  - save: round trip; `loadState` of a throwing storage → `defaultState()`; of `'{'` → default; houses out of letter order (`i` before `a`) → keeps the valid prefix only; unknown word ids and duplicates dropped; duplicate plots → the later house dropped; `version: 2` → default
- [ ] **Step 2: Run** `node --test tests/village/` — fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — passes.**
- [ ] **Step 5: Commit** `feat(village): progress and save`.

### Task 4: The writing task (cubes)

**Files:**
- Create: `jeux/village-singes/src/logic/cubes.js`
- Test: `tests/village/cubes.test.js`

**Interfaces:**
- Consumes: `Word`, `syllableEnds` (Task 2).
- Produces: `CONFUSABLE = { b: 'd', d: 'b', p: 'q', q: 'p', m: 'n', n: 'm', u: 'n' }`; `writingTask(word, learned: string[], level: 1|2|3, rng = Math.random) → { slots: { g: string, given: boolean }[], cubes: string[], model: 'shown'|'hidden'|'none' }` — `given` = grapheme not in `learned`; `cubes` = one per non-given slot + distractors, shuffled by `rng`; `firstOpenSlot(task, filled: boolean[]): number` (−1 when full); `fits(task, slotIndex, g): boolean`.

- [ ] **Step 1: Write the failing tests** (`moto = { id: 'moto', syllables: ['mo','to'], graphemes: ['m','o','t','o'] }`, `rng` seeded):
  - learned `['a','i','o','m']`, level 1 → slots given `[false,false,true,false]`, cubes sorted `['m','o','o']`, model `'shown'`
  - level 2 → model `'hidden'`, 1 or 2 distractors, each a learned grapheme that is not in the word
  - level 3 with learned including `n` → cubes include `'n'` (confusable of `m`); model `'none'`
  - with learned `['o']` only (word with one learned grapheme) → exactly the needed cubes, no distractor available, no crash
  - `firstOpenSlot` skips given slots; `fits` true only for the slot's grapheme
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — passes.**
- [ ] **Step 5: Commit** `feat(village): writing task with pre-filled letters and distractors`.

### Task 5: Voices and sounds — parent checkpoint

**Files:**
- Create: `jeux/village-singes/src/data/lines.js`, `jeux/village-singes/src/audio.js`, `tools/village-singes/audio-manifest.mjs`, `tools/village-singes/gen_audio.py`, `tools/village-singes/voicing.py`, `tools/village-singes/listen.html`, `tools/village-singes/voix-reference-singe.wav`, `tools/village-singes/voix-reference-narratrice.wav` (moved from `docs/…/village-singes-prototypes/`, `git mv`), `jeux/village-singes/assets/audio/{singe,narratrice}/*.m4a`, `jeux/village-singes/ASSETS-LICENSES.md` (sound part)
- Modify: `jeux/village-singes/src/assets.js` (`AUDIO` from `audioManifest()`)
- Test: `tests/village/audio.test.js`

**Interfaces:**
- Consumes: `LETTERS` (Task 2).
- Produces: `LINES` (narrator, exact copy) and `REACTIONS` (monkey, exact copy):

```js
export const LINES = {
  construire: 'Touche un terrain libre pour construire une maison.',
  maison: 'Touche une ombre pour apprendre un mot au singe.',
  ecouter: 'Touche chaque morceau du mot.',
  ecrire: 'Écris le mot avec les cubes.',
  cache: 'Regarde bien le mot, il va se cacher.',
  dictee: 'Écoute bien le mot, puis écris-le.',
  encore: 'Tu peux revenir écrire les mots, en plus difficile.',
  collection: 'Voici tous les objets de tes singes.',
};
export const REACTIONS = {
  bonjour: 'Bonjour ! Tu m\'apprends des mots ?',
  super: 'Super !',
  merci: 'Merci ! Je l\'ai appris !',
  metier: 'Regarde, j\'ai mon costume !',
};
```
- Produces: `audioManifest(letters = LETTERS): { key, file, voice: 'singe'|'narratrice', text, kind: 'syllable'|'word'|'sound'|'line'|'reaction' }[]` with keys `syl-<syllable>`, `word-<id>`, `snd-<grapheme>`, `line-<id>`, `react-<id>`; `file = 'assets/audio/<voice>/<key>.m4a'`; syllables de-duplicated; `snd-` for every letter grapheme (narrator); a word or syllable may carry an optional `tts` text in the data when the plain spelling is mispronounced.
- Produces: `tools/village-singes/audio-manifest.mjs` prints the manifest as JSON (single source for the Python script).

- [ ] **Step 1: Write the failing tests** — `tests/village/audio.test.js`: manifest keys unique; every word of `LETTERS` has `word-<id>` (voice `singe`) and every syllable `syl-<s>` (voice `singe`); every letter has `snd-<g>` (voice `narratrice`); every `LINES` key has `line-` (narratrice) and every `REACTIONS` key `react-` (singe); every manifest file exists on disk; `AUDIO` equals the manifest's `{key, file}`.
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Write `gen_audio.py`** (run with `~/tools/tts-local/.venv/bin/python`, `HF_HOME=~/tools/tts-local/hf`): reads the JSON from `node tools/village-singes/audio-manifest.mjs`, generates each missing file with Chatterbox (reference audio by voice), converts with `afconvert -f m4af -d aac`, `--only <key>` and `--force` options. Letter sounds (`kind: 'sound'`): vowels straight; continuant consonants by the onset-stretch technique validated in brainstorming (take the onset of a word such as « sac » → « s », stretch to ~0.8 s by overlap-add of 40 ms Hann grains, fade 80 ms; reference implementation in the spike, re-write it in `voicing.py`) — voiced continuants (m, l) by a stretch of the onset's stable middle; `voicing.py` also prints the per-20 ms noise/voiced profile used to reject spelled sounds (a sound whose profile alternates voiced/unvoiced segments like « ès ès » is rejected).
- [ ] **Step 4: Generate every file, run the test — passes.** Write the sound part of `ASSETS-LICENSES.md` (Chatterbox MIT; narrator reference from Kokoro ff_siwis, Apache 2.0, SIWIS attribution exactly as in Global Constraints; monkey reference from Qwen3-TTS VoiceDesign, Apache 2.0).
- [ ] **Step 5: CHECKPOINT (parent).** `listen.html` (served from the repo root) lists every sound grouped by letter with a play button; ask the parent to listen on the tablet and name the bad ones. STOP until validated; regenerate the named ones (`--only … --force`, or a `tts` spelling in the data), repeat.
- [ ] **Step 6: Commit** `feat(village): narrator and monkey sounds (validated)`.

### Task 6: Art — parent checkpoint

**Files:**
- Create: `tools/village-singes/split-svg.mjs`; layered sources `tools/village-singes/art/singe.svg`, `tools/village-singes/art/cabane.svg`, `tools/village-singes/art/tenue-<job.id>.svg` (one per job); generated parts `jeux/village-singes/assets/singe/singe-<part>.svg`, `assets/singe/tenue-<job.id>-<part>.svg`, `assets/cabane/cabane-<part>.svg`; `assets/objets/obj-<word.id>.svg` (one per word); `assets/decor/terrain.svg` (1280×800), `assets/decor/interieur.svg` (1280×800), `assets/decor/maison-enfant.svg`, `assets/decor/emplacement.svg`, `assets/decor/bonus-medaille.svg`; `assets/ui/cube.svg`, `assets/ui/case.svg`, `assets/ui/oeil.svg`, `assets/ui/reecouter.svg`, `assets/ui/maison.svg` (home button), `assets/ui/bulle.svg`, final `assets/ui/tile.svg`, final `shared/assets/cat-lire-ecrire.svg` (home S2 style), `jeux/village-singes/src/ui/parts.js`
- Modify: `src/assets.js` (ASSETS), `jeux/village-singes/ASSETS-LICENSES.md`, `shared/ASSETS-LICENSES.md` (category tile)
- Test: `tests/village/split-svg.test.js`, `tests/village/art.test.js`

**Interfaces:**
- Produces: `split-svg.mjs <in.svg> <outDir> <prefix>` writes one file per **top-level** `<g id="…">` named `<prefix>-<id>.svg`, each with the source's root attributes (same viewBox) and `<defs>`, so every part drawn at the same origin lines up.
- Produces: monkey parts `tail, leg-left, leg-right, body, arm-left, arm-right, head, mouth-closed, mouth-open, eyelids, pupils` (viewBox `0 0 400 500`; mouth, eyelids and pupils are top-level groups drawn after `head`); outfit parts `body, arm-left, arm-right, head` (hat); hut parts `base, door, shutter-left, shutter-right, roof, sign` (viewBox `0 0 400 420`; the letter itself is Phaser text, not in the SVG).
- Produces: `parts.js` → `MONKEY_PARTS: { id, pivot: { x, y } }[]` in draw order, `OUTFIT_PARTS`, `HUT_PARTS` (pivots in viewBox units: arm-left `158,250`, arm-right `242,250`, head `200,232`, tail `248,372`, door hinge `164,260`, sign `200,118`).

- [ ] **Step 1: Write the failing tests** — `split-svg.test.js`: a fixture with two top-level groups and a nested group gives exactly two files with the root viewBox and `<defs>`, nested group kept inside its parent. `art.test.js`: every `MONKEY_PARTS`/`HUT_PARTS` file exists, an outfit file set exists for every `job.id`, an `obj-<id>` exists for every word, every new file is in ASSETS.
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Draw.** Start from `docs/superpowers/specs/village-singes-prototypes/v2/singe.svg` and `cabane.svg` (already in the validated direction) — arms drawn a little away from the body, no overlap between animated parts. Render each file with headless Chrome (`--headless=new --screenshot`) and look at every render before keeping it; fix any defect (extra limbs, wrong colours, unreadable object).
- [ ] **Step 4: CHECKPOINT (parent).** One contact sheet per family (monkey + 6 outfits; hut; objects per letter; décor + UI) at 1280×800. STOP until validated. Then licence rows (CC0, drawn for the project), `split-svg` run, tests pass.
- [ ] **Step 5: Commit** `art(village): monkey, outfits, hut, objects, décor (validated)`.

### Task 7: Phaser components (monkey, hut, sound, font)

**Files:**
- Create: `jeux/village-singes/src/ui/sound.js`, `src/ui/monkey.js`, `src/ui/hut.js`, `src/ui/text.js`, `jeux/village-singes/assets/fonts/Andika-Regular.woff2`, `jeux/village-singes/assets/fonts/OFL.txt`
- Modify: `index.html` (`@font-face` for Andika), `src/scenes/BootScene.js` (load AUDIO, wait `document.fonts.load('64px Andika')`), `src/assets.js` (`FONT_FILE`), `ASSETS-LICENSES.md` (font: SIL OFL 1.1)
- Test: `tests/village/sound.test.js`

**Interfaces:**
- Produces: `sound.js` → `settleAfter(promise, ms): Promise<void>` (resolves when the promise settles or after `ms`, whichever first — pure, tested); `play(scene, key): Promise<number>` (plays a loaded sound, resolves with its duration in ms when it ends; on error or when blocked resolves after `settleAfter(…, 1200)`); `sayAll(scene, keys, gapMs): Promise<void>` (sequence with `dur(gapMs)` pauses).
- Produces: `class Monkey extends Phaser.GameObjects.Container` — `constructor(scene, x, y, { job = null, scale = 1 })`, `say(key): Promise<void>` (plays the sound, toggles mouth-open/closed every 120 ms while it plays, small head nod), `blink()`, `wave(): Promise<void>`, `look(dir: -1|0|1)`, `setJob(jobId|null)`, `setBonus(on)`, `walk(fromX, toX)`; blinks by itself every 3–5 s (paused in tests by `?debug`).
- Produces: `class Hut extends Phaser.GameObjects.Container` — `constructor(scene, x, y, letter: Letter, { scale = 1 })`, `openDoor(): Promise<void>`, `closeDoor()`, `toggleShutters()`, `swingSign()`; the sign shows `capital + ' ' + grapheme` in Andika; `onTap(cb)`.
- Produces: `text.js` → `FONT = 'Andika'`, `label(scene, x, y, str, size, color)`.

- [ ] **Step 1: Write the failing test** — `sound.test.js`: `settleAfter(new Promise(() => {}), 50)` resolves in ≥ 50 ms and < 200 ms; `settleAfter(Promise.reject(new Error()), 1000)` resolves (does not reject) quickly; `settleAfter(Promise.resolve(), 1000)` resolves quickly.
- [ ] **Step 2: Run — fails.**
- [ ] **Step 3: Implement.** Durations go through `dur()`; under evening no particles. Add `?debug&scene=Parts` (in `debug.js`) showing a Monkey (buttons: say `word-` of the first word, wave, look, each job) and a Hut (door, shutters, sign) for manual checks.
- [ ] **Step 4: Run tests — pass; open `?debug&scene=Parts`**: the monkey speaks with a moving mouth, blinks, waves; the hut opens; the letter is in Andika; evening filter applies.
- [ ] **Step 5: Commit** `feat(village): monkey, hut, sounds and font components`.

### Task 8: Village and collection screens

**Files:**
- Create: `jeux/village-singes/src/scenes/CollectionScene.js`
- Modify: `src/scenes/VillageScene.js`, `src/config.js` (`PLOTS: {x, y}[6]`, `PLAYER_HOUSE: {x, y}`), `src/main.js`

**Interfaces:**
- Consumes: `progress.js`, `save.js`, `Monkey`, `Hut`, `play`, `LINES`.
- Produces: scene `'Village'` (no data) and `'Collection'` (no data); Village → `goTo(this, 'House', { letterId })`.

Behaviour (spec "Village", "Collection"): terrain, child's house with avatar (`drawAvatar` from `shared/avatar.js` into a canvas texture) at `PLAYER_HOUSE`, tap → Collection; free plots show `emplacement`; first visit and every visit with a free plot and a next letter: narrator `line-construire`; tap a free plot → `buildHouse`, save, the hut appears, a monkey arrives, points, narrator `snd-<g>`, monkey `react-bonjour`; built huts tap → House. Installed monkeys walk near their hut in outfit (and medal if `hasBonus`). After 20 s on the screen (scaled by `dur`), one request bubble at a time from `pickRequest` above that monkey; tap → House of that letter. Collection: one row per letter (built: letter, monkey with/without outfit, earned objects and empty slots; not built: greyed letter), narrator `line-collection`, back button.

No pure logic here (the rules are Task 3's).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Check in Chrome at 1280×800**: build all six houses in order with `?debug` and a seeded save; the seventh tap on a plot does nothing; bubble appears and leads to the right house; collection rows match the save; reload keeps everything.
- [ ] **Step 3: Run `npm test` — still passes.**
- [ ] **Step 4: Commit** `feat(village): village and collection screens`.

### Task 9: House and word mini-game

**Files:**
- Create: `jeux/village-singes/src/scenes/HouseScene.js`, `src/scenes/WordScene.js`, `src/ui/cubes.js`
- Modify: `src/main.js`, `src/config.js` (`SLOTS: {x, y}[10]` object places in the interior)

**Interfaces:**
- Consumes: `writingTask`, `firstOpenSlot`, `fits` (Task 4); `wordLevel`, `earnWord`, `canReplay`, `isInstalled`, `hasBonus`, `learnedGraphemes`, `wordOk` (Task 3); `syllableEnds` (Task 2); `phaseLevels`, `recordPhaseResult` from `shared/runtime.js`; `Monkey`, `play`, `sayAll`.
- Produces: scene `'House'` with data `{ letterId }`; scene `'Word'` with data `{ letterId, wordId }`, returning to `'House'`.

Behaviour (spec "Écran de la maison", "Mini-jeu des mots"):
- House: interior, earned objects at their `SLOTS` place, silhouettes (tinted black, alpha 0.25) for the others; narrator `line-maison` on entry when something is left; tap silhouette → Word; when all earned and `canReplay(house, letter, ceiling)`: narrator `line-encore` and every object becomes tappable for replay; at the 4th earned word the monkey puts on the outfit (short scene) and says `react-metier`; medal when `hasBonus`. Back button → Village.
- Word, read `ceiling = phaseLevels('village-singes').mots` and `level = wordLevel(house, letter, ceiling)` **once on entry**.
  1. Listen: picture, monkey, the word in Andika split into syllables with alternating colours; tap a syllable → monkey `syl-<s>`; slide under the word or the "whole word" button → monkey `word-<id>`; narrator `line-ecouter` on entry; step 2 unlocks when each syllable was tapped once.
  2. Write: narrator `line-ecrire` (L1) / `line-cache` (L2) / `line-dictee` (L3, then monkey `word-<id>`); slots from `writingTask`, given slots in grey; the active slot highlighted; tap a cube → narrator `snd-<g>`; drop on the active slot: fits → snaps, and if the slot ends a syllable → monkey `syl-<s>`; does not fit → slides back (`dur(300)`), `mistakes += 1`; L2: the model hides at the first drop, eye button shows it 2 s; L3: replay button says the word again. Input locked while a sound plays.
  3. Done: monkey `word-<id>` then `react-merci` (first earn) or `react-super` (replay), the object flies to the house; `earnWord`, save; `recordPhaseResult('village-singes', 'mots', wordOk(mistakes), level)` (it ignores levels below the ceiling); → House.

- [ ] **Step 1: Write a failing test for the one piece of pure logic added here** — in `tests/village/cubes.test.js`: `syllableEnds`-based `spokenSyllableAt(word, slotIndex): string | null` (exported from `src/logic/cubes.js`) returns `'mo'` at slot 1 and `'to'` at slot 3 of `moto`, null at 0 and 2.
- [ ] **Step 2: Run — fails. Step 3: implement `spokenSyllableAt`. Step 4: passes.**
- [ ] **Step 5: Implement the two scenes and `ui/cubes.js`.**
- [ ] **Step 6: Check in Chrome**: a first word of house `a` at L1 with given grey letters; a wrong drop slides back and the word still completes; `?debug&level=3` gives dictation; parent level set to 1 in the parent space → a house with 6 earned words plays L1 and offers no replay; double tap on a silhouette opens one Word scene.
- [ ] **Step 7: Run `npm test` — passes. Commit** `feat(village): house and word mini-game`.

### Task 10: End-to-end smoke, cache version, docs

**Files:**
- Create: `tests/e2e/village.mjs` (own copy of the CDP launch/mouse helpers of `tests/e2e/smoke.mjs` — do not modify `smoke.mjs`, the other session owns it)
- Modify: `sw.js` (`CACHE_VERSION` → next unused value), `DEPLOY.md` (one line: the village, the offline tools in `tools/village-singes/` are not published)

- [ ] **Step 1: Write `village.mjs`**: home → parent space (profile 6 years, apply recommendations) → tile "lire et écrire" → village → build house `a` → open it → play one word fully with real mouse drags (read the expected graphemes from `window.__sm` like the stand smoke reads its state) including one wrong drop → object visible in the house → play 3 more words → back to the village: the monkey wears the outfit → home button → parent resets the village → back: no house. Fails on any console error, off-origin request, or a scene that does not move on.
- [ ] **Step 2: Run** `python3 -m http.server 8000 & node tests/e2e/village.mjs; kill %1` — exit code 0.
- [ ] **Step 3: Bump `CACHE_VERSION`, run `npm test` — passes.**
- [ ] **Step 4: Commit** `test(village): end-to-end smoke; bump cache`.
