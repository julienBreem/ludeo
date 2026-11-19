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
