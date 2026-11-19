# Task 6 report — art and asset manifest (DONE)

Branch feat/art, worktree .superpowers/worktrees/art. Commits: e6669b1 (checkpoint A samples), 8dc73bb (full S2 art), a563681 (molds), final commit "feat: game art and asset manifest" (src/assets.js, tests/assets.test.js, ASSETS-LICENSES.md).
`npm test`: 67 tests pass, 0 fail, no warnings. The assets test failed before src/assets.js existed and passes after.

## What exists

- 69 hand-written SVGs in assets/<family>/<texture-key>.svg, style S2 (glossy 3D cartoon), all original, CC0.
- src/assets.js: `ASSETS` (69 entries, key/file/w/h, w and h equal each file's viewBox) and `PRECACHE` ('./', index.html, manifest.webmanifest, vendor/phaser.min.js, src/assets.js, the 10 src/logic files on disk, then every ASSETS file). New src modules must be added to PRECACHE by hand; the test fails otherwise. Task 14 appends icons.
- tests/assets.test.js: catalog coverage (incl. shape-*-side and mold-*-back/front), files exist and are SVG with a viewBox matching w/h, no orphan under assets/ (assets/icons/ excluded), ASSETS and src/**/*.js are in PRECACHE with no duplicates, keys unique. It checks disk -> PRECACHE only; index.html, manifest and vendor are listed but not required to exist yet.
- ASSETS-LICENSES.md: one row per file.

## Sizes (w x h)

- 160x160: ing-*, topping-*, icon-*, coin
- 400x400: dessert-*, shape-*-fill/-line/-side, mold-*-back/-front, lumps
- 300x300: client-head, client-hair-1..3, client-body, face-content/-bof/-fache, deco-pancarte
- oven 500x450, bowl 520x360, whisk 160x400, pot 200x200, flame 160x200, bubble 440x340
- 1280x180: stand-awning, deco-auvent, deco-guirlande; stand-counter 1280x260

## Geometry the scenes rely on

Cake (all 400x400 textures share one frame; the cake centre is the frame centre 200,200):
- Top-down layers, bottom to top: dessert-<d> masked by shape-<k>-fill, lumps if the dough failed, glaze cells under the same mask, toppings, shape-<k>-line.
- 3/4 view: draw shape-<k>-side at the cake centre, then the top-down layers in a container at the same centre with scaleY 0.55 (the squash is about the frame centre, so y 200 stays put). The side band continues 64px below the squashed face. Toppings stand unsquashed at squashed positions.
- In a mold: mold-<k>-back, then the batter or cake top face only (fill-masked, scaleY 0.55, same centre; no side band), then mold-<k>-front. The mold opening is exactly the squashed fill, so batter fits at rim level only (pouring = stream plus top face growing from the centre). The mold is 74px deep, so the unmolded cake's 64px side fits inside its outline.
- shape-<k>-fill: solid white, opaque inside, transparent outside; silhouettes centred, roughly 320px across.
- shape-<k>-line: translucent brown outline plus inner rim highlight; licorne also has eye, horn stripes and mane lines (kept by decision).
- lumps: all blobs within 75px of the centre, so it fits every shape even unmasked.

Tinted in code (drawn in white or light values, shading in grey or alpha, multiply tint stays clean):
- dessert-* and shape-*-side: bake tint (raw = white leaves the pale dough colour as drawn).
- pot: glaze colour. client-body: clothes colour.
- client-head: drawn in the default light skin; white tint keeps it, a darker tint gives darker skins.
Not meant to be tinted: molds (rond orange-red, carre teal, coeur pink, etoile yellow, licorne violet), hair, faces, everything else.

Client: every part uses the same 300x300 frame; stack client-body, client-head, client-hair-N, face-* at the same x,y. Head centre 150,124 (radius 86); the body is open at the bottom (y 300) and should sink behind the counter.

Kitchen: bowl opening is the ellipse cx 260, cy 116, rx 214, ry 60. Oven window stage is x 58..442, y 150..388 with the rack at y 330. Whisk is handle-up, wires reach y 384. Bubble tail is at the lower left (tip 8,276); content area about x 60..400, y 36..288.

Stand: stand-awning scallops hang to y 172; deco-auvent has the same frame and replaces it. deco-guirlande hangs from the top corners and the middle. stand-counter's worktop is its top 52px.

Icons are complete glossy discs (no extra button circle needed): ok green, ko red, restart orange-red, next blue, go orange, out violet (oven mitt), shop pink.

## Concerns

- mold-*-front cuts its opening with an SVG `<mask>`, and molds and side bands use `<use xlink:href>` inside clipPath/mask. Rendered correctly with WebKit (qlmanage); not yet loaded through Phaser's SVG loader in Chrome — check in Task 7's browser step.
- Several pieces use feGaussianBlur soft shadows (client-body, client-head, bubble, mold backs); same check applies.
- The preview sheets and the generator scripts are in the session scratchpad (art-sheets/, art-gen/), not in the repo.

# v1.1 art (Task 2) — geometry and contracts

Branch feat/art-v11. 30 new SVGs; client-hair-1..3 redrawn; the 5 shape-*-side got thin darker edges around the cream band; face-content/-bof/-fache removed.

## Client (every layer in the same 300x300 frame, stacked at the same x,y)

- Layer order: client-body -> client-head | client-animal-<chat|ours|lapin|chien> -> client-hair-N (none = bald) -> client-acc-* -> client-eyes-<open|closed> -> client-mouth-<content|bof|fache>.
- Anchors: head centre 150,124. Eye line y 128, eye centres x 114 and 186 (blink = swap to client-eyes-closed, or squash the eyes layer about y 128). Mouth anchor x 150, y 172 (mouths span y 160..190). Animal noses stay above y 156, so the mouths fit every head.
- Moods are carried by the mouth only.
- Hairs: 1 fringe + two side buns, 2 short tousled, 3 long, 4 side fringe + ponytail, 5 swept back + top bun.
- Animal heads are complete (ears, muzzle, nose, cheeks), untinted, and take no hair. Accessories were not designed for them.

Tinted in code (multiply; drawn white / light grey):
- client-body: shirt colour. Used on the sheets: 0xff8a65, 0xffd54f, 0x69f0ae, 0x4fc3f7, 0xb388ff, 0xff80ab.
- client-head: skin. 0xffffff (as drawn), 0xeccbb0, 0xc9a58f, 0x9c7a66. The base is already orange, so keep tints greyish or they turn red.
- client-hair-N: the highlights are white, so the tint is the hair's highlight colour. Recommended HAIR_HEX: brun 0xa9673a, noir 0x3d3944, blond 0xffd866, roux 0xf07a35, gris 0xcfd2dc.
- client-acc-cap, client-acc-bow: any colour (used: 0x29b6f6, 0xff5252, 0x66bb6a, 0xff5c93, 0xffd54f).
- client-acc-beard, client-acc-moustache: tint with the client's hair colour; untinted they are white.
Not tinted: client-acc-glasses, client-acc-earrings, animal heads, eyes, mouths.

Accessory rules: the cap covers the head top (y 8..100) and goes with bald and hairs 2, 3, 4 only — never hair 1 or 5. The bow sits at the top right (about 202,50) and works with every hair and bald. The mouth is drawn over the beard and over the lower edge of the moustache.

## Flank per dessert (3/4 view, out of the mold)

Stack, all at the cake centre:
1. shape-<k>-side, bake tint (as v1).
2. side-pattern-<dessert> (400x400), same bake tint, masked by the alpha of shape-<k>-side.
3. Nothing on top of the band; then the squashed top container as before.

- side-pattern-gateau is a transparent overlay of sponge pores: the side texture's own sponge and cream band (which follows the outline) show through.
- side-pattern-tarte (fluted crust, 28px flutes) and side-pattern-cupcake (pink pleated paper, 24px pleats) are opaque and hide the cream band; they carry their own left-to-right shading.
- A flat pattern cannot carry anything that follows the outline (horizontal layers, top lip); that is why the gateau layers stay in shape-<k>-side.
- Patterns have content in y 90..380, full width.

## Tart rim

- shape-<k>-rim (400x400, top-down frame, one per shape): a crust ring about 19px wide just inside the outline, transparent in the middle, already clipped to the shape (no mask).
- Only for dessert 'tarte' with a shape, in every view that shows the top face. Bake tint, like dessert-*.
- Order inside the squashed top container: masked group (dessert, lumps, glaze) -> shape-<k>-rim -> shape-<k>-line -> toppings.
- It hides the outer 19px of the glaze; glaze painting and scoring are unaffected.
- Generated from each shape-<k>-fill path (concentric clipped strokes); a new shape needs its rim generated the same way.

## Plate and crumbs

- plate: 480x280, drawn with the cake's 0.55 squash. Well centre 240,136 (well radii 182 x 96). Draw the plate under the cake and place the cake so that cake-frame point (200,264) — the centre of its base at scale 1 — lands on the well centre; scale that offset with the cake.
- crumbs: 200x80, one golden cluster, untinted; scale, rotate or flip copies.

# Home art (collection home screen) — geometry and placement

Branch feat/art-home. Six SVGs in shared/assets/, all S2. Numbers below are in the 1280x800 home frame, as composed on the approved sheet.

- home-bg-day / home-bg-evening (1280x800): the same landscape. Sun drawn in the day one at (640,112), r 56. Hill tops at about y 560..640, 640..730 and 700..780; cottage at about x 1040..1110, y 540..612. The middle is empty for the tiles. The evening one has no sun and no moon; its stars and fireflies are still (nothing blinks).
- moon (200x200): evening only, drawn over home-bg-evening at x 560, y 32, scale 0.8 (160 px), so it sits where the day sun is.
- Avatar: white disc r 84 centred at (116,108) with a soft shadow 6 px lower; inner disc r 76 filled #ffe9a8, used as the clip. The client parts (300x300 frame) are stacked at scale 0.56 with frame point (150,140) on the disc centre: head and shoulders show.
- icon-gear (160x160): top-left corner at (1150,34), scale 0.62 (about 100 px). Red dot: r 13, #ff1f5a, white 4 px ring, centred at (1238,46) (the disc's top right).
- cat-compter-observer (480x360): a complete card (rx 44, darker base 8 px lower), no extra tile background needed. Shown at scale 1.1 (528x396), centred horizontally, top at y 250.
- icon-home (160x160): complete glossy disc like the stand icons (turquoise); icon-gear is grey-blue on purpose (parent button).
- Evening: the backgrounds and the moon are drawn for the evening and take no filter. Avatar, tile and gear were dimmed on the sheet with saturate .75 then RGB x .84/.76/.76; the home's real filter should stay close to that.

# Educational lot 1 art (Commande = reading, Pâte = numbers) — geometry and contracts

Branch feat/art-edu1. 20 new SVGs, all S2, none meant to be tinted. Layout numbers marked "sheet" are the ones used on the checkpoint sheet (1280x800 frame); they are suggestions.

## Empty packaging — empty-<ingredient> (120x120, assets/ingredients/)

- oeuf: half shell with a cracked rim. farine: bag flattened and folded over. sucre: empty sugar pot, lid beside it, a sugar cube on its label (the ingredient sprite is loose cubes, so the cube label is the link). beurre: wrapping paper open, print of the block. lait: see-through empty bottle, cap off. chocolat: torn wrapper with foil.
- The drawing fills about 80% of the frame, centred; each has its own ground shadow at the bottom (y 100..110).
- They stay readable down to about 45 px. Below that, do not go.

## egg-box (400x200), assets/kitchen/

- egg-box: open carton seen from above, 2 rows of 5. Cell centres: x 52, 126, 200, 274, 348 (pitch 74); y 62 (back row) and 130 (front row). Cells are ellipses rx 31, ry 28. Fill order suggested: back row left to right, then front row.
- A shell in a cell: empty-oeuf centred 4 px above the cell centre, at 0.6 x the box's scale (72 px in the 400 px frame). No front layer is needed.
- Sheet: box at scale 0.78, centre (620,580); second box (after 10) at (945,580).
- egg-box-5 (the 5-egg carton) was removed after the parent's review (spec 2 bis): the multi-grab replaces it.

## plate-side (420x300), the board beside the bowl

- Wooden board seen from above. Top face: x 8..412, y 8..270 (corner radius 36); the 16 px below is its thickness. Hanging hole at (380,42), r 11: keep items clear of it.
- Area for the empties: x 30..390, y 28..248 (360x220).
- Suggested slots (frame units; multiply by the board's scale): one lane per kind present in the recipe (eggs go to the egg box), lane pitch = min(72, 220 / max(3, kinds)), lanes centred vertically in the area.
  - at most 5 per kind: empties at scale 0.5, first centre x 66, pitch 66.
  - at most 10 per kind: scale 0.36, first centre x 52, pitch 33, plus 10 px after the 5th (groups of five, like the carton).
- Sheet: board at scale 1.1, centre (1030,350); bowl at scale 0.8, centre (270,450).

## tray (260x120), what is already in the bowl

- Lilac, like the bowl, so it reads as "belongs to the bowl". Rim ellipse centre (130,54), radii 124x48; well centre (130,56), radii 102x35.
- Items stand in the well: centres on y 44..50, x 58..202, at scale 0.4 (pitch 36).
- Sheet: centre (150,262), above the bowl's left side. On the recipe card, "already there" is a lilac pill (fill #e4d9ff, stroke #6a3fd6) holding the tray at scale 0.2 and the number.

## dice-1..5 (96x96, assets/ui/)

- A die face (x 5..91, y 3..87, base 6 px lower) with dark blue dots r 10 at x 27/48/69, y 25/46/67. 2 and 3 are diagonals from the top left. Sheet: scale 0.62 on the recipe card under a 64 px ingredient.

## label-tag (200x64), word label

- 9-slice: left 26, right 26, top 26, bottom 30 (the bottom includes the 6 px darker base). Face: x 2..198, y 2..56. Text area: x 18..182, y 6..52; text centre y 29.
- The gloss line under the top edge stretches with the middle column. Meant to be stretched in width; keep the height at 64.
- Leader lines on the sheet: 4 px #3b5b7a over a 9 px white line, ending in a white dot r 9 with the same stroke, drawn over the cake; labels are drawn last.

## icon-eye (160x160) and pict-forme / pict-couleur / pict-topping (96x96)

- icon-eye: complete glossy disc like the other icons (yellow, the one hue no other button uses).
- pict-*: neutral grey category pictograms (three shapes; a pot with a drip; a star and a cherry), drawn inside the frame with about 4 px margin. Sheet: scale 0.46 at the left of a label, word shifted 22 px right.

# Educational lot 2 art (Moule = geometry, Cuisson = time) — geometry and contracts

Branch feat/art-edu2. 41 new SVGs, all S2. Review sheet rendered with headless Chromium: `sips` ignores the transform of a `<use>`d path inside clipPath/mask, so shape-*-side and the moulds (old ones too) come out wrong with sips although they are right in the browser.

## Shapes triangle, rectangle, ovale, losange, hexagone

- Full set each: shape-<k>-fill/-line/-side/-rim and mold-<k>-back/-front, generated from the etoile files with only the path (and the mould colour) changed. Every existing rule applies unchanged: 400x400 frame, centre 200,200, 0.55 squash about y 200, 64 px side band, 19 px rim, 74 px deep mould whose opening is the squashed fill, plate well point (200,264).
- Fill = one closed path, solid white, no holes. Corners are rounded by a quadratic through the vertex (cut distance below), so the visible corner sits a few px inside the listed vertex.
- Corner vertices (top-down frame, clockwise), for corner highlights, hints and tangram cuts:
  - triangle (3 corners, cut 30): (200,40), (370,344), (30,344). Isosceles, almost equilateral; base at the bottom.
  - rectangle (4 corners, cut 34): (32,92), (368,92), (368,308), (32,308). 336 x 216, lying down (the carre is 304 x 304).
  - ovale (no corner): ellipse centre 200,200, rx 172, ry 106, lying down (the rond is r 160).
  - losange (4 corners, 4 equal sides, cut 26): (200,34), (334,200), (200,366), (66,200). 268 x 332, standing.
  - hexagone (6 corners, regular, R 168, cut 26, flat top and bottom): (116,54.5), (284,54.5), (368,200.0), (284,345.5), (116,345.5), (32,200.0).
- In the 3/4 view, multiply (y - 200) by 0.55 to place a corner on the squashed face.
- In 3/4 the ovale face is 344 x 117 and the rond face 320 x 176: the trap pair differs mostly by flatness, less than in the top-down view. Same for rectangle (336 x 119) against carre (304 x 167).
- Mould colours (not tinted): triangle green #3fcf4e, rectangle blue #3d7dff, ovale grey-blue #8f9db5, losange magenta #d44fe0, hexagone caramel #b9743f. Existing: rond orange-red, carre teal, coeur pink, etoile yellow, licorne violet.

## Geometry pictograms — pict-coin, pict-cote, pict-rond (96x96, assets/ui/)

- Neutral grey like pict-forme/-couleur/-topping; the highlighted part is dark grey #3b4554 with a white halo.
- pict-coin: a piece of a shape with its far side torn off (zigzag), the corner at (48,14) highlighted (two legs and a dot). pict-cote: same idea, the straight side y 22, x 12..84 highlighted with a dot at each end. Both are torn pieces on purpose: they do not show a whole triangle or square, so they do not give the answer away.
- pict-rond: a plain disc, centre 48,48, r 40 ("pas de coin").

## Kitchen timer (assets/kitchen/) — levels 1 and 2

- timer-face-sector (400x400): the level 1 face — red body, white dial, a tick every 30 degrees, no numbers. It holds NO green: the green is timer-sector.
- timer-sector (400x400, same frame, draw it at the same x,y over the face, under the hand): the green sector alone. Pie slice from the pivot to radius 146, from 135 to 210 degrees clockwise from the top.
- timer-face-numbers (400x400): the level 2 face — same body, numbers 1..5, no green.
- timer-hand (80x130): points up. Pivot (40,92) = origin (0.5, 0.7077). Tip 72 px from the pivot: it stops under the numbers and never hides one.
- Pivot of all three 400x400 layers: (200,196) = origin (0.5, 0.49). Dial radius 150, body radius 186, darker base 10 px lower (the frame's bottom 4 px are empty).
- Angles are clockwise from the white start mark at the top. A full run is 300 degrees: hand angle = 300 x gauge. Number k is at 60 x k degrees (1 at 60, 3 at 180 straight down, 5 at 300); digit centres on radius 106, digits 50 px high.
- The sector as drawn is the current green band (gauge 0.45..0.70 -> 135..210 degrees). To move it, rotate the layer about the pivot; its width (75 degrees) is fixed. For another width draw the slice in code (radius 146, fill #5df08f, stroke #0a8f43 4 px) under the hand.
- Order: face -> timer-sector (level 1 only) -> timer-hand.

## Alarm clock (assets/kitchen/) — level 3

- clock-face (400x440): blue alarm clock with two bells and feet. Pivot of both hands (200,250) = origin (0.5, 0.5682). Dial radius 148, rim radius 176. Hours 1..12, digit centres on radius 123 (hour h at 30 x h degrees clockwise from the top); a short grey tick at each half hour (15 + 30 x h degrees), radius 132..142.
- clock-hour-hand (80x140): dark blue, points up, carries the yellow hub cap. Pivot (40,100) = origin (0.5, 0.7143). Tip 88 px from the pivot. Angle = 30 x hours (2 h 30 -> 75 degrees).
- clock-alarm-hand (80x200): magenta, points up. Pivot (40,188) = origin (0.5, 0.94). A thin hand to 98 px from the pivot (it stops before the numbers), then a pointer and a round knob riding on the rim: knob centre (40,26), 162 px from the pivot, radius 21. The knob is the thing to drag; at clock scale 0.9 it is about 38 px wide, so give it a larger hit zone (or take the drag anywhere on the dial and use the pointer's angle).
- Order: clock-face -> clock-alarm-hand -> clock-hour-hand. When the hour hand reaches the alarm it covers the thin hand; the knob on the rim stays visible.
- There is no minute hand: the hour hand moves alone.
- Small start clock: clock-face + clock-hour-hand at the same pivot. The digits stay readable down to about scale 0.45; at 0.3 only the hand position reads.
- icon-alarm (160x160, assets/ui/): complete glossy disc, magenta like the alarm hand, white bell.
