// Client colours shared by the stand (Phaser tints) and the home (canvas tints), indexed by the
// Client fields (illustrator's values, art-geometry notes v1.1).
// Hair colours are the *highlight* colour of each hair (brown, black, blond, red, grey): the hair
// art has white highlights, so the multiply tint sets them. Skins stay greyish (the head is
// drawn orange already).
export const HAIR_HEX = [0xa9673a, 0x3d3944, 0xffd866, 0xf07a35, 0xcfd2dc];
export const SKIN_HEX = [0xffffff, 0xeccbb0, 0xc9a58f, 0x9c7a66];
export const SHIRT_HEX = [0xff6f91, 0x42a5f5, 0x66bb6a, 0xffca28, 0xab7cf0, 0xff9a4d];

// cap and bow: shirt colour; beard and moustache: hair colour; the others are not tinted
export const ACC_TINT = { cap: 'shirt', bow: 'shirt', beard: 'hair', moustache: 'hair' };
