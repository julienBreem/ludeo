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
