import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INGREDIENTS, DESSERTS, ITEMS } from '../src/logic/catalog.js';
import { ASSETS, PRECACHE } from '../src/assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
      expected.push(...['fill', 'line', 'side'].map(p => `shape-${item.key}-${p}`));
      expected.push(`mold-${item.key}-back`, `mold-${item.key}-front`);
    }
    if (item.kind === 'topping') expected.push(`topping-${item.key}`);
    if (item.kind === 'deco') expected.push(`deco-${item.key}`);
  }
  expected.push(
    'pot', 'bowl', 'whisk', 'oven', 'flame', 'lumps',
    'client-head', 'client-hair-1', 'client-hair-2', 'client-hair-3', 'client-body',
    'face-content', 'face-bof', 'face-fache',
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
  const onDisk = walk('assets', f => !f.startsWith('assets/icons/')).sort();
  const listed = ASSETS.map(a => a.file).sort();
  assert.deepEqual(onDisk, listed);
});

test('every ASSETS file and every src/**/*.js is in PRECACHE', () => {
  const cached = new Set(PRECACHE);
  const wanted = [...ASSETS.map(a => a.file), ...walk('src', f => f.endsWith('.js'))];
  assert.deepEqual(wanted.filter(f => !cached.has(f)), []);
  assert.equal(cached.size, PRECACHE.length, 'PRECACHE has duplicates');
});

test('keys are unique', () => {
  const keys = ASSETS.map(a => a.key);
  assert.equal(new Set(keys).size, keys.length);
});
