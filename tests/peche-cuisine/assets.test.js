import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS, PRECACHE } from '../../jeux/peche-cuisine/src/assets.js';
import { ALL_COLORS } from '../../jeux/peche-cuisine/src/logic/setup.js';
import { COLOR_HEX } from '../../jeux/peche-cuisine/src/config.js';

// The game's folder: ASSETS and PRECACHE paths are relative to it.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'jeux', 'peche-cuisine');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

test('every ASSETS file exists and is SVG', () => {
  const keys = new Set();
  for (const a of ASSETS) {
    assert.ok(!keys.has(a.key), `duplicate key ${a.key}`);
    keys.add(a.key);
    const file = path.join(ROOT, a.file);
    assert.ok(fs.existsSync(file), `${a.file} is missing`);
    const svg = fs.readFileSync(file, 'utf8');
    assert.match(svg, /^\s*<svg[\s>]/, `${a.file} is not an SVG`);
    assert.match(svg, /viewBox="0 0 (\d+) (\d+)"/, `${a.file} has no viewBox`);
    const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    assert.deepEqual([a.w, a.h], [Number(w), Number(h)], `${a.file}: size differs from its viewBox`);
  }
});

test('every file under src/ and assets/ is in PRECACHE', () => {
  const cached = new Set(PRECACHE);
  const files = [...walk('src'), ...walk('assets')];
  assert.deepEqual(files.filter(f => !cached.has(f)), []);
  assert.deepEqual(PRECACHE.filter(f => !fs.existsSync(path.join(ROOT, f))), []);
});

test('fish colours: every ALL_COLORS entry has a COLOR_HEX', () => {
  for (const c of ALL_COLORS) assert.equal(typeof COLOR_HEX[c], 'number', `${c} has no COLOR_HEX`);
});
