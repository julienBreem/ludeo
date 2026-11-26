// The open cooler (Kitchen and End): every fish of the stock with its weight label, in rows by
// colour (the setup's colours first), lightest first in a row.
import { ALL_COLORS } from '../logic/setup.js';
import { drawFish } from './fishArt.js';

export const COOLER_FISH_SIZE = 0.5; // drawn scale x the size category's scale
export const COOLER_TAG_SIZE = 0.85; // on-screen scale of the labels
const MIN_HIT = 110; // px on screen, above the 96 px minimum
const MAX_ROW_H = 170;
const MAX_GAP = 125;

// The ice box behind the fish. area: { left, top, w, h }.
export function drawCoolerPanel(scene, area, depth) {
  return scene.add.graphics().setDepth(depth)
    .fillStyle(0x29b6f6, 1).fillRoundedRect(area.left - 14, area.top - 14, area.w + 28, area.h + 28, 30)
    .lineStyle(6, 0x0277bd, 1).strokeRoundedRect(area.left - 14, area.top - 14, area.w + 28, area.h + 28, 30)
    .fillStyle(0xe1f5fe, 1).fillRoundedRect(area.left, area.top, area.w, area.h, 20);
}

// Where each fish sits: [{ fish, x, y }] (the fish's centre; its label hangs below).
export function coolerLayout(stock, colors, area) {
  const order = [...colors, ...ALL_COLORS.filter((c) => !colors.includes(c))];
  const rows = order
    .map((color) => stock.filter((f) => f.color === color)
      .sort((a, b) => a.weight - b.weight || Number(a.id.slice(1)) - Number(b.id.slice(1))))
    .filter((row, i) => row.length > 0 || i < colors.length);
  const rowH = Math.min(MAX_ROW_H, area.h / Math.max(1, rows.length));
  const top = area.top + (area.h - rowH * rows.length) / 2;
  const out = [];
  rows.forEach((row, r) => {
    const gap = row.length > 1 ? Math.min(MAX_GAP, (area.w - 120) / (row.length - 1)) : 0;
    const y = top + rowH * (r + 0.5) - rowH * 0.12;
    row.forEach((fish, i) => out.push({ fish, x: area.left + 70 + i * gap, y }));
  });
  return out;
}

// Draws one cooler fish with its label; the touch area is at least MIN_HIT px on screen.
export function drawCoolerFish(scene, fish, x, y, level) {
  const c = drawFish(scene, x, y, fish, {
    weight: fish.weight, label: true, level, size: COOLER_FISH_SIZE, tagSize: COOLER_TAG_SIZE,
  });
  const s = c.scaleX;
  c.setSize(Math.max(240, MIN_HIT / s), Math.max(140, (MIN_HIT + 20) / s));
  c.fish = fish;
  return c;
}
