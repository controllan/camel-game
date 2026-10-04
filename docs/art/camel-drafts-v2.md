# Camel drafts v2 — reference-trace round (T0–T4)

Standing pose + dressed variant each. Facing right, feet on bottom row.
Legend: `.` transparent, `O` outline #1a1208, `B` body #c9803a, `S` shade #8a5220,
`H` gloss highlight #e0a45f (T3 only), `R` robe per-lane, `W` turban #f0ece0,
`K` skin #d8a878, `L` blanket #bfe3ea, `E` eye (unused here), **`G` NEW: harness grey
#53565e** (the reference's grey neck-strap/belly-band lines — was approximated as
shade before; needs one palette entry if promoted).
Robe lanes: #e84a3a #3a6ae8 #3aa84a #e8c83a #9a4ae8 #e88a3a #3ad8d8 #e85a9a.
Digit ink #123a44, 3×5 font from `camel-sprite.md`.

Previews (gitignored): `test-results/ux-tmp/contact-sheet.png` (1585×1062:
bare row / dressed row w/ digits 1–5 @8× +1px grid, 1× sand strip, robe proof),
plus `contact-bare.png`, `contact-dressed.png`, `strip-1x-sand.png` (#c9a25a),
`robe-proof.png` (T0 red/blue/green).

## T0 method — pixel-exact trace (read first)

`docs/reference/camel-pixel-art.png` is 626×626 RGBA. Block-grid detection:
8-px-period edge-energy test peaked at **B=8** (X ratio 3.55, Y ratio 3.16, best of
4–16); 8×8-uniformity sweep over origins was flat (~36% everywhere — the file is
soft/AA'd, not hard blocks), so origin **(3,1)** taken from the inner-variance
minimum neighbourhood; centre-sampling each 8×8 block gives a **77×78 native
grid**. Non-background bbox = blocks x23–53 × y25–55 → **31×31 native px**.
Classification per block (tuned thresholds, verified against rendered crops):
bg/blue-edge → `.`, near-black/slate → `O`, orange r≥215 → `B`, other orange →
`S`, neutral grey → `G`. Origin-shift cross-check (3,1 vs 4,1): 63/961 cells
differ — AA-boundary wobble only, silhouette identical.
T0 = full 31×31 crop + 1 transparent col each side → **33×31**, plus 7 same-colour
join cells (4,13 4,14 3,18 3,19 3,20 2,21 all →`O`, tail stubs (0,21)(0,22)→`.`
+ (1,21)(1,22)→`O`) bridging sub-pixel AA gaps so the sprite is one 4-connected
blob. T0 vs raw extraction similarity: **0.9932** (only the 7 join cells differ).

Native palette (centre-sample medians; modes in brackets):
| label | median | mode | maps to |
|---|---|---|---|
| bg transparent | #5493b5 | #5493b5 | — (blue bg) |
| O outline | #272317 | #2f1a17-ish dark browns | #1a1208 |
| B lit orange | #eb8d3b | #e8873b | #c9803a body |
| S bulk orange | #bd6c25 | #cf7826 (#207,120,38) | #8a5220 shade |
| G harness grey | #53565d | #4e565e | **new token #53565e** |

Note: the trace uses no `H` — the reference models light with the bright-orange
`B`, not a separate highlight tone (T3 adds `H` deliberately).

Budget: **no draft fits 34×24** (all are 30–31 tall). One buffer change covers
all drafts T0–T4: **640×360** (16:9, 1.25× scale; HORIZON_Y 70→88, LANE_BOTTOM 284→356,
lane height at n=8 ≈ **33.5 px** ≥ 31 sprite + 2 feet offset). Shipped: **T2**
at 33 wide (T0–T3 are 33 wide; T4's 40-wide variant was NOT shipped);
SPRITE_H 24→31. Digit anchors per draft below.

## T0 Trace — 33×31 — needs 640×360 buffer

Style: the reference itself, standing, one hump, tail line, grey harness.
Digit anchor: cols **7–9 × rows 12–16** (blanket cols 5–12 × rows 11–17;
rows 12–16 verified flat `L`).
How it differs: baseline; ear-tip row 0 and hooves row 30 touch canvas edge
(no strays — contiguous silhouette cells).

Bare:
[
      '......................OOG........',
      '......................OSSOO......',
      '....................OOSBBBBO.....',
      '....................OSBSSSBBOOO..',
      '....................OBBBBBBBGBBO.',
      '.....................OBBBBBGBBBO.',
      '.....................OSBSSSGOSSO.',
      '...............OOO...OSBBBSGOOOO.',
      '........OOO...OBBBO...OSBBBGO....',
      '.......OBBBOOOBBBBBO..OSBBBGO....',
      '.......OBSBBGBBSSSBO..OSBBBO.....',
      '......OBSSSSGSSSSSBBOOSBBBGO.....',
      '.....OOBSSSSSGBSSSSBBBBBSGGO.....',
      '....OOBBSSSSSSGGSSSSSSSSGGO......',
      '...O.OBSSSSSSSSSGGGGGGGSSG.......',
      '...O.OBSSSSSSSSSSSSSSSSSSG.......',
      '...O.OBSSSSSSSSSSSSSSSSSG........',
      '...O..OSSSSSSSSSSSSSSSSSG........',
      '...OO.OSSSSSSSSSSSSSSSS..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSS....OSSSSG...........',
      '..O.SSSSSSS.....OSSSO............',
      '...OSSSSSSG.....OSSSS............',
      '...OSSSSSO......OSSSSO...........',
      '...OSSSSSO......OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSSO....OSSSSSS..........',
      '.....OSSSSSO....OSSSSSS..........',
      '.....OOOOOOO....OOOOOOO..........',
]

Dressed (rider cols 6–11 rows 3–11, blanket cols 5–12 rows 11–17):
[
      '......................OOG........',
      '......................OSSOO......',
      '....................OOSBBBBO.....',
      '......OOOOOO........OSBSSSBBOOO..',
      '......OWWWWO........OBBBBBBBGBBO.',
      '......OWWWWO.........OBBBBBGBBBO.',
      '......OWWWWO.........OSBSSSGOSSO.',
      '......OOKKOO...OOO...OSBBBSGOOOO.',
      '......ORRRRO..OBBBO...OSBBBGO....',
      '......ORRRROOOBBBBBO..OSBBBGO....',
      '......ORRRROGBBSSSBO..OSBBBO.....',
      '.....OORRRROOSSSSSBBOOSBBBGO.....',
      '.....OLLLLLLOGBSSSSBBBBBSGGO.....',
      '....OOLLLLLLOSGGSSSSSSSSGGO......',
      '...O.OLLLLLLOSSSGGGGGGGSSG.......',
      '...O.OLLLLLLOSSSSSSSSSSSSG.......',
      '...O.OLLLLLLOSSSSSSSSSSSG........',
      '...O.OOOOOOOOSSSSSSSSSSSG........',
      '...OO.OSSSSSSSSSSSSSSSS..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSS....OSSSSG...........',
      '..O.SSSSSSS.....OSSSO............',
      '...OSSSSSSG.....OSSSS............',
      '...OSSSSSO......OSSSSO...........',
      '...OSSSSSO......OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSSO....OSSSSSS..........',
      '.....OSSSSSO....OSSSSSS..........',
      '.....OOOOOOO....OOOOOOO..........',
]

## T1 Trace, race-tuned — 33×31 — needs 640×360 buffer

Style: T0 + derby tweaks, same palette, no new chars.
Digit anchor: cols **7–9 × rows 12–16** (same dress as T0).
How it differs vs T0 (sim 0.952): head block shifted +1 up with a 1-px neck
extension row (row 5: `O SSSS O`); legs thinned 1 px each side (rear outline
moved x3→x4, front outline x21→x20 with belly rejoin at row 28); hooves unchanged.

Bare:
[
      '......................OSSOO......',
      '....................OOSBBBBO.....',
      '....................OSBSSSBBOOO..',
      '....................OBBBBBBBGBBO.',
      '.....................OBBBBBGBBBO.',
      '.....................OSSSSO......',
      '.....................OSBSSSGOSSO.',
      '...............OOO...OSBBBSGOOOO.',
      '........OOO...OBBBO...OSBBBGO....',
      '.......OBBBOOOBBBBBO..OSBBBGO....',
      '.......OBSBBGBBSSSBO..OSBBBO.....',
      '......OBSSSSGSSSSSBBOOSBBBGO.....',
      '.....OOBSSSSSGBSSSSBBBBBSGGO.....',
      '....OOBBSSSSSSGGSSSSSSSSGGO......',
      '...O.OBSSSSSSSSSGGGGGGGSSG.......',
      '...O.OBSSSSSSSSSSSSSSSSSSG.......',
      '...O.OBSSSSSSSSSSSSSSSSSG........',
      '...O..OSSSSSSSSSSSSSSSSSG........',
      '...OO.OSSSSSSSSSSSSSSSS..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSS....OSSSSG...........',
      '..O.SSSSSSS.....OSSSO............',
      '...OSSSSSSG.....OSSSS............',
      '....OSSSSO......OSSSSO...........',
      '....OSSSSO......OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSSO....OSSSSOSS.........',
      '.....OSSSSSO....OSSSSSS..........',
      '.....OOOOOOO....OOOOOOO..........',
]

Dressed:
[
      '......................OSSOO......',
      '....................OOSBBBBO.....',
      '....................OSBSSSBBOOO..',
      '......OOOOOO........OBBBBBBBGBBO.',
      '......OWWWWO.........OBBBBBGBBBO.',
      '......OWWWWO.........OSSSSO......',
      '......OWWWWO.........OSBSSSGOSSO.',
      '......OOKKOO...OOO...OSBBBSGOOOO.',
      '......ORRRRO..OBBBO...OSBBBGO....',
      '......ORRRROOOBBBBBO..OSBBBGO....',
      '......ORRRROGBBSSSBO..OSBBBO.....',
      '.....OORRRROOSSSSSBBOOSBBBGO.....',
      '.....OLLLLLLOGBSSSSBBBBBSGGO.....',
      '....OOLLLLLLOSGGSSSSSSSSGGO......',
      '...O.OLLLLLLOSSSGGGGGGGSSG.......',
      '...O.OLLLLLLOSSSSSSSSSSSSG.......',
      '...O.OLLLLLLOSSSSSSSSSSSG........',
      '...O.OOOOOOOOSSSSSSSSSSSG........',
      '...OO.OSSSSSSSSSSSSSSSS..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSS....OSSSSG...........',
      '..O.SSSSSSS.....OSSSO............',
      '...OSSSSSSG.....OSSSS............',
      '....OSSSSO......OSSSSO...........',
      '....OSSSSO......OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSSO....OSSSSOSS.........',
      '.....OSSSSSO....OSSSSSS..........',
      '.....OOOOOOO....OOOOOOO..........',
]

## T2 Two-hump Bactrian — 33×31 — needs 640×360 buffer

Style: reference palette/style, second hump over the shoulders for comparison
against the preferred dromedary.
Digit anchor: cols **11–13 × rows 12–16** (blanket cols 10–15 × rows 11–17;
rider shifted right: turban cols 11–14 rows 2–4, robe cols 11–14 rows 6–11).
How it differs vs T0 (sim 0.990): rear-hump crest row 6 cols 8–11 (`O B B O`)
on a filled row-7 neck (`O B B`), valley cols 12–14 kept; everything below
row 8 identical.

Bare:
[
      '......................OOG........',
      '......................OSSOO......',
      '....................OOSBBBBO.....',
      '....................OSBSSSBBOOO..',
      '....................OBBBBBBBGBBO.',
      '.....................OBBBBBGBBBO.',
      '........OBBO.........OSBSSSGOSSO.',
      '.......OOBBOO..OOO...OSBBBSGOOOO.',
      '........OOO...OBBBO...OSBBBGO....',
      '.......OBBBOOOBBBBBO..OSBBBGO....',
      '.......OBSBBGBBSSSBO..OSBBBO.....',
      '......OBSSSSGSSSSSBBOOSBBBGO.....',
      '.....OOBSSSSSGBSSSSBBBBBSGGO.....',
      '....OOBBSSSSSSGGSSSSSSSSGGO......',
      '...O.OBSSSSSSSSSGGGGGGGSSG.......',
      '...O.OBSSSSSSSSSSSSSSSSSSG.......',
      '...O.OBSSSSSSSSSSSSSSSSSG........',
      '...O..OSSSSSSSSSSSSSSSSSG........',
      '...OO.OSSSSSSSSSSSSSSSS..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSS....OSSSSG...........',
      '..O.SSSSSSS.....OSSSO............',
      '...OSSSSSSG.....OSSSS............',
      '...OSSSSSO......OSSSSO...........',
      '...OSSSSSO......OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSSO....OSSSSSS..........',
      '.....OSSSSSO....OSSSSSS..........',
      '.....OOOOOOO....OOOOOOO..........',
]

Dressed:
[
      '......................OOG........',
      '..........OOOOOO......OSSOO......',
      '..........OWWWWO....OOSBBBBO.....',
      '..........OWWWWO....OSBSSSBBOOO..',
      '..........OWWWWO....OBBBBBBBGBBO.',
      '..........OOKKOO.....OBBBBBGBBBO.',
      '........OBORRRRO.....OSBSSSGOSSO.',
      '.......OOBORRRROOO...OSBBBSGOOOO.',
      '........OOORRRROBBO...OSBBBGO....',
      '.......OBBORRRROBBBO..OSBBBGO....',
      '.......OBSORRRROSSBO..OSBBBO.....',
      '......OBSSORRRROSSBBOOSBBBGO.....',
      '.....OOBSSOLLLLOSSSBBBBBSGGO.....',
      '....OOBBSSOLLLLOSSSSSSSSGGO......',
      '...O.OBSSSOLLLLOGGGGGGGSSG.......',
      '...O.OBSSSOLLLLOSSSSSSSSSG.......',
      '...O.OBSSSOLLLLOSSSSSSSSG........',
      '...O..OSSSOOOOOOSSSSSSSSG........',
      '...OO.OSSSSSSSSSSSSSSSS..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSS....OSSSSG...........',
      '..O.SSSSSSS.....OSSSO............',
      '...OSSSSSSG.....OSSSS............',
      '...OSSSSSO......OSSSSO...........',
      '...OSSSSSO......OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSO.....OSSSSO...........',
      '....OSSSSSSO....OSSSSSS..........',
      '.....OSSSSSO....OSSSSSS..........',
      '.....OOOOOOO....OOOOOOO..........',
]

## T3 Volksfest chunky — 33×31 — needs 640×360 buffer

Style: thicker legs, rounder rump, gloss bands; new use of `H` (no new char).
Digit anchor: cols **7–9 × rows 12–16** (same dress as T0).
How it differs vs T0 (sim 0.976): legs +1 px wider each side (rear x10, front
x15/x22 outlines, rows 24–28); rump +2 cells (2,15 2,16 →`O`); `H` gloss on
hump crest (15–17,8), rump top (7–8,11), neck (23,8).

Bare:
[
      '......................OOG........',
      '......................OSSOO......',
      '....................OOSBBBBO.....',
      '....................OSBSSSBBOOO..',
      '....................OBBBBBBBGBBO.',
      '.....................OBBBBBGBBBO.',
      '.....................OSBSSSGOSSO.',
      '...............OOO...OSBBBSGOOOO.',
      '........OOO...OHHHO...OHBBBGO....',
      '.......OBBBOOOBBBBBO..OSBBBGO....',
      '.......OBSBBGBBSSSBO..OSBBBO.....',
      '......OHHSSSGSSSSSBBOOSBBBGO.....',
      '.....OOBSSSSSGBSSSSBBBBBSGGO.....',
      '....OOBBSSSSSSGGSSSSSSSSGGO......',
      '...O.OBSSSSSSSSSGGGGGGGSSG.......',
      '..OO.OBSSSSSSSSSSSSSSSSSSG.......',
      '..OO.OBSSSSSSSSSSSSSSSSSG........',
      '...O..OSSSSSSSSSSSSSSSSSG........',
      '...OO.OSSSSSSSSSSSSSSSS..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSS....OSSSSG...........',
      '..O.SSSSSSS.....OSSSO............',
      '...OSSSSSSG.....OSSSS............',
      '...OSSSSSSO....OOSSSSSO..........',
      '...OSSSSSSO....OOSSSSSO..........',
      '....OSSSSSO....OOSSSSSO..........',
      '....OSSSSSO....OOSSSSSO..........',
      '....OSSSSSSO...OOSSSSSS..........',
      '.....OSSSSSO....OSSSSSS..........',
      '.....OOOOOOO....OOOOOOO..........',
]

Dressed:
[
      '......................OOG........',
      '......................OSSOO......',
      '....................OOSBBBBO.....',
      '......OOOOOO........OSBSSSBBOOO..',
      '......OWWWWO........OBBBBBBBGBBO.',
      '......OWWWWO.........OBBBBBGBBBO.',
      '......OWWWWO.........OSBSSSGOSSO.',
      '......OOKKOO...OOO...OSBBBSGOOOO.',
      '......ORRRRO..OHHHO...OHBBBGO....',
      '......ORRRROOOBBBBBO..OSBBBGO....',
      '......ORRRROGBBSSSBO..OSBBBO.....',
      '.....OORRRROOSSSSSBBOOSBBBGO.....',
      '.....OLLLLLLOGBSSSSBBBBBSGGO.....',
      '....OOLLLLLLOSGGSSSSSSSSGGO......',
      '...O.OLLLLLLOSSSGGGGGGGSSG.......',
      '..OO.OLLLLLLOSSSSSSSSSSSSG.......',
      '..OO.OLLLLLLOSSSSSSSSSSSG........',
      '...O.OOOOOOOOSSSSSSSSSSSG........',
      '...OO.OSSSSSSSSSSSSSSSS..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSS....OSSSSG...........',
      '..O.SSSSSSS.....OSSSO............',
      '...OSSSSSSG.....OSSSS............',
      '...OSSSSSSO....OOSSSSSO..........',
      '...OSSSSSSO....OOSSSSSO..........',
      '....OSSSSSO....OOSSSSSO..........',
      '....OSSSSSO....OOSSSSSO..........',
      '....OSSSSSSO...OOSSSSSS..........',
      '.....OSSSSSO....OSSSSSS..........',
      '.....OOOOOOO....OOOOOOO..........',
]

## T4 Reference style, larger — 40×30 — needs 640×360 buffer

Style: hand-scaled T0 at 5:4 columns (every 4th column doubled, col 0 dropped,
ear-tip row dropped) so muzzle/harness/hump read at 1×. Same palette, no `H`.
Digit anchor: cols **8–10 × rows 12–16** (blanket cols 6–14 × rows 11–17).
How it differs: 40 wide (fits SPRITE_W=40; height 30 ≤ 31 — same buffer change,
no extra cost); curves chunkier, single-cell AA noise averaged out by the
column doubling.

Bare:
[
      '..........................OSSSOO........',
      '........................OOSBBBBBOO......',
      '........................OSBSSSSBBBOOO...',
      '........................OBBBBBBBBBGBBOO.',
      '.........................OBBBBBBGGBBBOO.',
      '.........................OSBBSSSGGOSSOO.',
      '.................OOOO....OSBBBBSGGOOOOO.',
      '.........OOO....OBBBBO....OSSBBBGGO.....',
      '.......OOBBBOOOOBBBBBBOO..OSSBBBGGO.....',
      '.......OOBSBBBGBBSSSSBOO..OSSBBBOO......',
      '......OBBSSSSSGSSSSSSBBBOOSBBBBGOO......',
      '.....OOBBSSSSSSGBSSSSSBBBBBBBSGGOO......',
      '....OOBBBSSSSSSSGGGSSSSSSSSSSGGO........',
      '..OO.OBSSSSSSSSSSSSGGGGGGGGSSSG.........',
      '..OO.OBSSSSSSSSSSSSSSSSSSSSSSSG.........',
      '..OO.OBSSSSSSSSSSSSSSSSSSSSSSG..........',
      '..OO..OSSSSSSSSSSSSSSSSSSSSSSG..........',
      '..OOO.OSSSSSSSSSSSSSSSSSSSS.............',
      '.O..OOSSSSSSSSSOOOOSSSSSSO..............',
      '.O..OSSSSSSSSSO....OSSSSSO..............',
      '.OOOOSSSSSSSSS.....OSSSSSG..............',
      '.O..SSSSSSSS.......OSSSSO...............',
      '..OOSSSSSSSG.......OSSSSS...............',
      '..OOSSSSSSO........OSSSSSO..............',
      '..OOSSSSSSO........OSSSSSO..............',
      '....OSSSSSSO.......OSSSSSO..............',
      '....OSSSSSSO.......OSSSSSO..............',
      '....OSSSSSSSOO.....OSSSSSSS.............',
      '.....OSSSSSSOO.....OSSSSSSS.............',
      '.....OOOOOOOOO.....OOOOOOOO.............',
]

Dressed:
[
      '..........................OSSSOO........',
      '........................OOSBBBBBOO......',
      '.......OOOOOOO..........OSBSSSSBBBOOO...',
      '.......OWWWWWO..........OBBBBBBBBBGBBOO.',
      '.......OWWWWWO...........OBBBBBBGGBBBOO.',
      '.......OWWWWWO...........OSBBSSSGGOSSOO.',
      '.......OOOKKOO...OOOO....OSBBBBSGGOOOOO.',
      '.......ORRRRRO..OBBBBO....OSSBBBGGO.....',
      '.......ORRRRROOOBBBBBBOO..OSSBBBGGO.....',
      '.......ORRRRROGBBSSSSBOO..OSSBBBOO......',
      '......OORRRRROGSSSSSSBBBOOSBBBBGOO......',
      '.....OOORRRRROOGBSSSSSBBBBBBBSGGOO......',
      '....OOOLLLLLLLOSGGGSSSSSSSSSSGGO........',
      '..OO.OOLLLLLLLOSSSSGGGGGGGGSSSG.........',
      '..OO.OOLLLLLLLOSSSSSSSSSSSSSSSG.........',
      '..OO.OOLLLLLLLOSSSSSSSSSSSSSSG..........',
      '..OO..OLLLLLLLOSSSSSSSSSSSSSSG..........',
      '..OOO.OOOOOOOOOSSSSSSSSSSSS.............',
      '.O..OOSSSSSSSSSOOOOSSSSSSO..............',
      '.O..OSSSSSSSSSO....OSSSSSO..............',
      '.OOOOSSSSSSSSS.....OSSSSSG..............',
      '.O..SSSSSSSS.......OSSSSO...............',
      '..OOSSSSSSSG.......OSSSSS...............',
      '..OOSSSSSSO........OSSSSSO..............',
      '..OOSSSSSSO........OSSSSSO..............',
      '....OSSSSSSO.......OSSSSSO..............',
      '....OSSSSSSO.......OSSSSSO..............',
      '....OSSSSSSSOO.....OSSSSSSS.............',
      '.....OSSSSSSOO.....OSSSSSSS.............',
      '.....OOOOOOOOO.....OOOOOOOO.............',
]

## Validation (throwaway node scripts, not kept beyond work/ JSON)

| check | T0 | T1 | T2 | T3 | T4 | dressed ×5 |
|---|---|---|---|---|---|---|
| exact dims | 33×31 ✓ | 33×31 ✓ | 33×31 ✓ | 33×31 ✓ | 40×30 ✓ | ✓ |
| legend-only chars | ✓ | ✓ | ✓ | ✓ (+H T3) | ✓ | ✓ (+R/W/K/L) |
| single 4-connected blob | ✓ 1 | ✓ 1 | ✓ 1 | ✓ 1 | ✓ 1 | ✓ 1 |
| feet on bottom row | ✓ O row | ✓ | ✓ | ✓ | ✓ | ✓ |
| no strays | ✓ (edge cells are feet/ear-tip runs) | ✓ | ✓ | ✓ | ✓ | ✓ |

Known/accepted: strict outline-enclosure scan flags ~50 interior-adjacent cells
per draft — these are the reference's own 1-px AA gaps (faithful trace, not
errors); the blob/edge checks above are the binding ones. Digit flat-area
verified `L` on all five dressed matrices at the anchors listed.
Similarities to T0 bare: T0-vs-extraction 0.9932 · T1 0.952 · T2 0.990 ·
T3 0.976 · T4 n/a (different size, mechanical 5:4 upscale of T0).

## Acceptance criteria (playwright-testable, post-promotion @640×360)

1. Bounding box of the promoted draft ≤ 40×31 painted px.
2. Lowest painted row = laneBottom − 2 (± dune h).
3. Blanket pixels #bfe3ea for every lane; robe pixels = lane colour.
4. Glyph pixels at the draft's digit anchor match DIGIT_FONT, colour #123a44.
5. Body/outline/harness pixels fixed (#c9803a / #1a1208 / #53565e) in all lanes.
6. Rider turban #f0ece0 + skin #d8a878 identical across lanes.

## T2 full set

**T2 picked by the user on 2026-10-04** — production source is
`docs/art/camel-sprite.md` v4 (1 standing + 4 walk frames, 33×31 dressed,
bare standing only; enclosure-fixed trace, walk legs/hock rows redrawn,
digit anchor cols 11–13 × rows 12–16 +1 on bob). This v2 doc keeps the
original T2 standing/dressed draft matrices above as reference.
