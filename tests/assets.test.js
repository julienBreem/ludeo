import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INGREDIENTS, DESSERTS, ITEMS } from '../jeux/stand-desserts/src/logic/catalog.js';
import { ASSETS, PRECACHE } from '../jeux/stand-desserts/src/assets.js';

// The stand's folder: ASSETS and PRECACHE paths are relative to it.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'jeux', 'stand-desserts');

function walk(dir, keep) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel, keep));
    else if (keep(rel)) out.push(rel);
  }
  return out;
}

test('every catalog item has its textures', () => {
  const keys = new Set(ASSETS.map(a => a.key));
  const expected = [
    ...INGREDIENTS.map(i => `ing-${i}`),
    ...Object.keys(DESSERTS).map(d => `dessert-${d}`),
  ];
  for (const item of ITEMS) {
    if (item.kind === 'shape') {
      expected.push(...['fill', 'line', 'side', 'rim'].map(p => `shape-${item.key}-${p}`));
      expected.push(`mold-${item.key}-back`, `mold-${item.key}-front`);
    }
    if (item.kind === 'topping') expected.push(`topping-${item.key}`);
    if (item.kind === 'deco') expected.push(`deco-${item.key}`);
  }
  expected.push(
    'pot', 'bowl', 'whisk', 'oven', 'flame', 'lumps',
    ...Object.keys(DESSERTS).map(d => `side-pattern-${d}`),
    'client-head', 'client-body',
    ...[1, 2, 3, 4, 5].map(n => `client-hair-${n}`),
    ...['glasses', 'cap', 'bow', 'beard', 'moustache', 'earrings'].map(a => `client-acc-${a}`),
    ...['chat', 'ours', 'lapin', 'chien'].map(a => `client-animal-${a}`),
    'client-eyes-open', 'client-eyes-closed',
    'client-mouth-content', 'client-mouth-bof', 'client-mouth-fache',
    'plate', 'crumbs',
    'stand-awning', 'stand-counter', 'bubble', 'coin',
    'icon-ok', 'icon-ko', 'icon-restart', 'icon-next', 'icon-shop', 'icon-go', 'icon-out',
  );
  const missing = expected.filter(k => !keys.has(k));
  assert.deepEqual(missing, []);
});

test('every ASSETS file exists on disk and is valid SVG', () => {
  for (const a of ASSETS) {
    const file = path.join(ROOT, a.file);
    assert.ok(fs.existsSync(file), `${a.file} is missing`);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.includes('<svg'), `${a.file} has no <svg`);
    const vb = text.match(/viewBox="0 0 (\d+) (\d+)"/);
    assert.ok(vb, `${a.file} has no viewBox`);
    assert.deepEqual([a.w, a.h], [Number(vb[1]), Number(vb[2])], `${a.file} size differs from its viewBox`);
    assert.ok(text.trimEnd().endsWith('</svg>'), `${a.file} is truncated`);
  }
});

test('every file under assets/ is listed in ASSETS (no orphan, no forgotten)', () => {
  const onDisk = walk('assets', () => true).sort();
  const listed = ASSETS.map(a => a.file).sort();
  assert.deepEqual(onDisk, listed);
});

test('every ASSETS file and every src/**/*.js is in PRECACHE', () => {
  const cached = new Set(PRECACHE);
  const wanted = [...ASSETS.map(a => a.file), ...walk('src', f => f.endsWith('.js'))];
  assert.deepEqual(wanted.filter(f => !cached.has(f)), []);
  assert.equal(cached.size, PRECACHE.length, 'PRECACHE has duplicates');
});

test('every PRECACHE entry exists on disk', () => {
  const missing = PRECACHE.filter(f => f !== './' && !fs.existsSync(path.join(ROOT, f)));
  assert.deepEqual(missing, []);
});

test('keys are unique', () => {
  const keys = ASSETS.map(a => a.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('the game precache leaves the collection files to the home', () => {
  for (const f of ['./', 'manifest.webmanifest', 'sw.js', 'vendor/phaser.min.js']) {
    assert.ok(!PRECACHE.includes(f), `${f} belongs to the home precache`);
  }
});
