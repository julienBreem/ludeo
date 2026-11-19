// Shared constants: reference resolution, palette, sizes.
export const W = 1280;
export const H = 800;
export const OUTLINE = 0x222222;
export const BG = 0x4fc3f7;
export const COUNTER = 0xff9800;
export const TOUCH = 110; // icon button size (>= 96 px tap target)

export const COLOR_HEX = {
  rose: 0xff8fb7,
  violet: 0x7c4dff,
  jaune: 0xffeb3b,
  blanc: 0xffffff,
  bleu: 0x2979ff,
  vert: 0x00e676,
};

// Multiply tints applied to dessert-* and shape-*-side (raw = as drawn).
export const BAKE_TINT = { raw: 0xffffff, pale: 0xfff3c4, dore: 0xe0a65a, brule: 0x5d4037 };

// 3/4 view: the top face is squashed vertically by this factor.
export const TOP_SQUASH = 0.55;

// Raw batter colour (bowl batter, cake with no shape yet).
export const BATTER = 0xffe9ae;
