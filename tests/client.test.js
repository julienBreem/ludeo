import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/logic/rng.js';
import {
  generateClient, sameClient, HAIRS, HAIR_COLORS, SKINS, SHIRTS, ACCESSORIES, ANIMALS,
} from '../src/logic/client.js';

test('never the same client twice in a row over 5000 draws', () => {
  const rng = makeRng(1); let prev = null;
  for (let i = 0; i < 5000; i++) {
    const c = generateClient(rng, prev);
    assert.ok(!sameClient(c, prev));
    prev = c;
  }
});

test('sameClient compares by value', () => {
  const a = { kind: 'animal', animal: 'chat', shirt: 1 };
  assert.ok(sameClient(a, { ...a }));
  assert.ok(!sameClient(a, { ...a, shirt: 2 }));
  assert.ok(!sameClient(a, { kind: 'human', hair: 0, hairColor: 0, skin: 0, shirt: 1, accessory: null }));
  assert.ok(!sameClient(a, null));
});

test('animal share ~ 0.2 (+-0.03 over 10000)', () => {
  const rng = makeRng(2); let animals = 0; const n = 10000;
  for (let i = 0; i < n; i++) {
    const c = generateClient(rng);
    if (c.kind === 'animal') { animals++; assert.ok(ANIMALS.includes(c.animal)); assert.ok(c.shirt >= 0 && c.shirt < SHIRTS); }
  }
  assert.ok(Math.abs(animals / n - 0.2) < 0.03, String(animals / n));
});

test('human fields in range; accessory share ~ 0.5', () => {
  const rng = makeRng(3); let humans = 0; let acc = 0;
  for (let i = 0; i < 10000; i++) {
    const c = generateClient(rng);
    if (c.kind !== 'human') continue;
    humans++;
    assert.ok(Number.isInteger(c.hair) && c.hair >= 0 && c.hair < HAIRS);
    assert.ok(c.hairColor >= 0 && c.hairColor < HAIR_COLORS);
    assert.ok(c.skin >= 0 && c.skin < SKINS);
    assert.ok(c.shirt >= 0 && c.shirt < SHIRTS);
    assert.ok(c.accessory === null || ACCESSORIES.includes(c.accessory));
    if (c.accessory) acc++;
  }
  assert.ok(Math.abs(acc / humans - 0.5) < 0.03, String(acc / humans));
});
