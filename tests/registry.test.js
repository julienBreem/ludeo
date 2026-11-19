import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_SETTINGS, CATEGORIES, GAMES, HOME_PRECACHE, categoriesWithGames } from '../jeux/registry.js';
import { isTheme } from '../shared/themes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = f => fs.existsSync(path.join(ROOT, f));

// Files under dir (relative to ROOT), recursively; [] when dir does not exist.
function walk(dir) {
  if (!exists(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

test('SHARED_SETTINGS are rythme and soir', () => {
  assert.deepEqual(SHARED_SETTINGS, ['rythme', 'soir']);
});

test('every game supports every shared setting', () => {
  assert.ok(GAMES.length > 0);
  for (const g of GAMES) {
    const missing = SHARED_SETTINGS.filter(s => !g.supports.includes(s));
    assert.deepEqual(missing, [], `${g.id} does not support ${missing.join(', ')}`);
  }
});

test('games: unique ids, known category, page in their folder, reset function', () => {
  const ids = GAMES.map(g => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const g of GAMES) {
    assert.ok(CATEGORIES.some(c => c.id === g.category), `${g.id}: unknown category ${g.category}`);
    assert.equal(g.path, `jeux/${g.id}/index.html`);
    assert.ok(exists(g.path), `${g.path} is missing`);
    assert.equal(typeof g.reset, 'function');
  }
});

test('every game has its own tile picture, on disk and in its precache', () => {
  for (const g of GAMES) {
    assert.ok(g.tile && !g.tile.endsWith('/undefined'), `${g.id} has no TILE`);
    assert.ok(g.tile.startsWith(`jeux/${g.id}/`), `${g.id}: tile outside its folder`);
    assert.ok(exists(g.tile), `${g.tile} is missing`);
    assert.ok(g.precache.includes(g.tile), `${g.tile} not in ${g.id}'s precache`);
  }
});

test('every game lists its phases: unique ids, a known theme, a French name, 1 or 3 levels', () => {
  for (const g of GAMES) {
    assert.ok(Array.isArray(g.phases) && g.phases.length > 0, `${g.id} has no PHASES`);
    const ids = g.phases.map(p => p.id);
    assert.equal(new Set(ids).size, ids.length, `${g.id}: duplicate phase ids`);
    for (const p of g.phases) {
      assert.ok(isTheme(p.theme), `${g.id}/${p.id}: unknown theme ${p.theme}`);
      assert.ok(typeof p.name === 'string' && p.name.length > 0, `${g.id}/${p.id}: no name`);
      assert.ok(p.levels === 1 || p.levels === 3, `${g.id}/${p.id}: levels must be 1 or 3`);
      assert.ok(!/[/:]/.test(p.id), `${g.id}/${p.id}: '/' and ':' are reserved in phase ids`);
    }
  }
});

test('the stand phases, their themes and which ones have levels', () => {
  const g = GAMES.find(x => x.id === 'stand-desserts');
  assert.deepEqual(g.phases.map(p => [p.id, p.theme, p.levels]), [
    ['commande', 'lecture', 3], ['pate', 'nombres', 3], ['moule', 'geometrie', 1], ['cuisson', 'temps', 1],
    ['couleur', 'couleurs-fractions', 1], ['toppings', 'logique', 1], ['service', 'monnaie', 1],
  ]);
  assert.deepEqual(g.phases.filter(p => p.scored === false).map(p => p.id), ['commande']);
});

test('the stand is registered as specified', () => {
  const g = GAMES.find(x => x.id === 'stand-desserts');
  assert.ok(g);
  assert.equal(g.category, 'compter-observer');
  assert.equal(g.path, 'jeux/stand-desserts/index.html');
  assert.deepEqual(g.supports, ['rythme', 'soir']);
});

test('the stand reset clears only its own save', () => {
  const data = { 'standDesserts.v1': '{"version":1,"coins":12,"owned":[]}', 'collection.v1': '{"version":1}' };
  const storage = { removeItem: k => { delete data[k]; } };
  GAMES.find(x => x.id === 'stand-desserts').reset(storage);
  assert.deepEqual(Object.keys(data), ['collection.v1']);
});

test('every precache path (home + games) exists on disk, is relative, without duplicates', () => {
  const all = [...HOME_PRECACHE, ...GAMES.flatMap(g => g.precache)];
  for (const f of all) {
    assert.ok(!f.startsWith('/') && !/^[a-z]+:/i.test(f), `${f} is not relative`);
    if (f !== './') assert.ok(exists(f), `${f} is missing`);
  }
  assert.equal(new Set(all).size, all.length, 'precache has duplicates');
  assert.ok(HOME_PRECACHE.includes('./') && HOME_PRECACHE.includes('index.html'));
  assert.ok(!all.includes('sw.js'), 'sw.js must not cache itself');
});

test("every file under each game's src/ and assets/ is in that game's precache", () => {
  for (const g of GAMES) {
    const dir = `jeux/${g.id}`;
    const cached = new Set(g.precache);
    const files = [...walk(`${dir}/src`), ...walk(`${dir}/assets`)];
    assert.ok(files.length > 0, `${dir} has no files`);
    assert.deepEqual(files.filter(f => !cached.has(f)), [], `${g.id}: files missing from its precache`);
    assert.ok(cached.has(`${dir}/index.html`) && cached.has(`${dir}/collection.js`));
    assert.deepEqual(g.precache.filter(f => !f.startsWith(`${dir}/`)), [], `${g.id} precaches outside its folder`);
  }
});

test('every shared module and shared/assets file is in the home precache', () => {
  const cached = new Set(HOME_PRECACHE);
  const files = [...walk('shared').filter(f => f.endsWith('.js')), ...walk('shared/assets')];
  assert.deepEqual(files.filter(f => !cached.has(f)), []);
  assert.ok(cached.has('jeux/registry.js') && cached.has('vendor/phaser.min.js'));
});

test('categoriesWithGames returns only non-empty categories, with their games', () => {
  const cats = categoriesWithGames();
  assert.ok(cats.length > 0);
  for (const c of cats) {
    assert.ok(c.games.length > 0, `${c.id} is empty`);
    assert.ok(c.games.every(g => g.category === c.id));
    assert.equal(typeof c.tile, 'string');
  }
  const withGames = new Set(GAMES.map(g => g.category));
  assert.deepEqual(cats.map(c => c.id), CATEGORIES.filter(c => withGames.has(c.id)).map(c => c.id));
});

test('categoriesWithGames drops a category without games', () => {
  // Temporarily adds an empty category to the registry.
  CATEGORIES.push({ id: 'vide', tile: 'x.svg' });
  try {
    assert.ok(!categoriesWithGames().some(c => c.id === 'vide'));
  } finally {
    CATEGORIES.pop();
  }
});

test('PWA: manifest, icons and service worker', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.orientation, 'landscape');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.background_color, '#4fc3f7');
  assert.equal(m.theme_color, '#4fc3f7');
  for (const size of ['192x192', '512x512']) {
    const icon = m.icons.find(i => i.sizes === size);
    assert.ok(icon, `no ${size} icon`);
    assert.equal(icon.purpose, 'any maskable');
    assert.ok(exists(icon.src), `${icon.src} is missing`);
    assert.ok(HOME_PRECACHE.includes(icon.src), `${icon.src} not in HOME_PRECACHE`);
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_VERSION = 'v6'/);
  assert.match(sw, /const CACHE = `ludeo-\$\{CACHE_VERSION\}`/, "the collection's own cache prefix");
  assert.match(sw, /k\.startsWith\('ludeo-'\) && k !== CACHE/, "activate deletes only this collection's older caches");
  assert.equal(m.name, 'Ludeo');
  assert.match(sw, /cache: 'reload'/, 'precache requests must bypass the HTTP cache');
  assert.match(sw, /import \{ HOME_PRECACHE, GAMES \} from '\.\/jeux\/registry\.js'/);
});

test('pages use relative paths only', () => {
  const pages = ['index.html', ...GAMES.map(g => g.path)];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(r => r[1]);
    assert.ok(refs.length > 0);
    for (const r of refs) assert.ok(!r.startsWith('/') && !/^[a-z]+:/i.test(r), `${p}: ${r} is not relative`);
  }
  const game = fs.readFileSync(path.join(ROOT, 'jeux/stand-desserts/index.html'), 'utf8');
  assert.match(game, /src="\.\.\/\.\.\/vendor\/phaser\.min\.js"/);
  const main = fs.readFileSync(path.join(ROOT, 'jeux/stand-desserts/src/main.js'), 'utf8');
  assert.match(main, /register\('\.\.\/\.\.\/sw\.js', \{ type: 'module', updateViaCache: 'none' \}\)/, 'the game registers the root service worker');
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(home, /register\('sw\.js', \{ type: 'module', updateViaCache: 'none' \}\)/, 'sw.js imports bypass the HTTP cache on update');
});
