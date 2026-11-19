import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avatarLayers, PRESETS, stepAvatar, randomAvatar, DEFAULT_AVATAR } from '../../shared/avatar.js';
import { CAP_HAIRS } from '../../shared/client.js';

test('human layers: body, head, hair, accessory, eyes, mouth, tinted like the stand', () => {
  const l = avatarLayers({ kind: 'human', hair: 2, hairColor: 1, skin: 1, shirt: 0, accessory: 'cap' });
  assert.deepEqual(l.map(x => x.file), ['client-body', 'client-head', 'client-hair-2', 'client-acc-cap', 'client-eyes-open', 'client-mouth-content']);
  assert.equal(l[0].tint, '#ff6f91');
  assert.equal(l[1].tint, '#eccbb0');
  assert.equal(l[2].tint, '#3d3944');
  assert.equal(l[3].tint, '#ff6f91'); // cap takes the shirt colour
});

test('animal has no head, hair or accessory; no avatar uses the default', () => {
  const l = avatarLayers({ kind: 'animal', animal: 'chat', shirt: 2 });
  assert.deepEqual(l.map(x => x.file), ['client-body', 'client-animal-chat', 'client-eyes-open', 'client-mouth-content']);
  assert.deepEqual(avatarLayers(null), avatarLayers(DEFAULT_AVATAR));
});

test('presets are distinct and respect the cap rule; stepping cycles', () => {
  assert.equal(PRESETS.length, 24);
  for (const p of PRESETS) if (p.accessory === 'cap') assert.ok(CAP_HAIRS.includes(p.hair));
  assert.deepEqual(stepAvatar(PRESETS[0], -1), PRESETS[23]);
  assert.deepEqual(stepAvatar(PRESETS[23], 1), PRESETS[0]);
  assert.deepEqual(stepAvatar(PRESETS[5], 1), PRESETS[6]);
  assert.deepEqual(stepAvatar(null, 1), PRESETS[0]);
});

test('random avatar differs from the current one', () => {
  for (let i = 0; i < 50; i++) {
    const a = randomAvatar(PRESETS[0]);
    assert.notDeepEqual(a, PRESETS[0]);
  }
});
