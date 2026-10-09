# Camel sprite v7 — 76×70 reference-matched stocky dromedary rider (no saddle blanket)

Procedural pixel art for the Camel Race / Kamel Rennen racer. Facing **right**, one
lane per camel. No image files: the matrices below drive the `drawSprite` pixel loop
(legend — see [Legend](#legend-char--palette)). At the `1280×720` buffer the camel is
drawn at **1:1** (no runtime scaling); the display scale is applied to the whole canvas.

This is **draft A** from [`docs/art/camel-drafts-v4.md`](camel-drafts-v4.md), promoted
to **v7 (`76×70`)** and shipped in `index.html`: a reference-matched stocky single-hump
dromedary with **no saddle blanket** — animal + rider only. The v6 `92×70` dromedary
(with its plain blue blanket) is retired. See [Selection](#selection--history).

| Item | Value |
|---|---|
| Size | **76 × 70** buffer px (uniform matrix all frames); painted bbox **72 × 68** at (col, row) **(3, 2)** on the standing/contact frames `0, 1, 3`; bob frames `2, 4` **71 × 69 @ (4, 1)** and **73 × 69 @ (2, 1)** |
| Frames | 1 standing + 4-frame walk: `[stand, contact A, pass A, contact B, pass B]` (index 0 idle, 1–4 walk) |
| Feet | hooves on the **bottom row** (row 69) in every frame |
| Bob | baked into the matrices: body/neck/head/rider **+1 px up** on pass frames `2, 4`; planted hooves stay on row 69, so `drawSprite` needs no bob offset |
| Blanket | **none** — no `L` cell, no `blanket` key; lane identity = team-name label + rider robe `R` (per-lane) |
| Height budget | 70 px sprite + **2 px** feet offset in a **74.0 px** lane (`1280×720`, 8 lanes) → **2 px slack**; at the ±2 px dune crest (`h = +2`) the sprite top sits exactly on the lane top |
| Team label | 12 px monospace `#e8e0d0` on a dark pill **4 px above the sprite top**; clamped to the canvas |
| Previews | throwaway-rendered outside the repo (see [drafts v4](camel-drafts-v4.md)): `/tmp/art-previews/camel-v7-drafts-contact.png` (A/B/C bare + dressed, 6×, grid), `/tmp/art-previews/camel-v7-walk.png` (draft A stand + 4 walk frames, 6× + 1× sand strip) |
| Status | **v7 (draft A)**, shipped in `index.html` (`const CAMEL`, registry `w: 76, h: 70`); supersedes v6 `92×70` |

Body is **brown** per the pixel-art reference. The **rider's robe** takes the lane
colour (palette-swap). The lane/team is identified by the **team-name label above the
animal** plus the robe colour — there is no blanket and no per-lane digit.

## Goal

Match the reference art with the **stocky single-hump dromedary** silhouette of draft A:
four-tone brown body (`B`/`S`/`D`), dark outline `O`, grey harness `G`, short thick
neck, blocky head with a drooping muzzle, thin tufted tail, and a fairground rider
seated **directly on the back** (no saddle box). The canvas team-name label above each
animal makes each lane read as a distinct racer at a glance. The 1 px pass-frame bob is
baked into the matrices instead of shifting at runtime.

## Reference art

Traced from the user-provided reference image `camel-pixalart.png` (repo root,
508×564; camel bbox 397×397 px, feet on the last row — a stocky ~1:1 dromedary with one
hump). The file is **gitignored and never committed, never linked or embedded in docs,
never loaded at runtime** — only the matrices below ship. Crop/measure/trace ran in a
throwaway script outside the repo; [`camel-drafts-v4.md`](camel-drafts-v4.md) is the
full round, this file is the promoted, shipped form.

## Dressed variant

`const CAMEL` (below) is the **dressed** form the game renders: draft A body/legs with
the rider (`W` turban, `K` face/hands, lane-colour `R` robe, dark `O` boots, `G` reins
and girth) and **no blanket** — the `L` pad and the `blanket` palette key are gone; the
per-lane digit stays retired (team name = canvas label above the animal).
`CAMEL_A_BARE` is the rider-less standing reference (silhouette/anatomy source).

## Palette

Fixed tones (draft A). Contrast ratios are WCAG.

| Token | Hex | Use |
|---|---|---|
| `outline` | `#1c1208` | silhouette outline, hooves, eye, nostril |
| `body` | `#de914d` | camel body light (lit top surfaces) |
| `shade` | `#c37c3a` | body mid (barrel, legs) |
| `shadeDeep` | `#b27035` | body deep (belly, lee edges, seams, tail; legend `D`) |
| `harness` | `#53565e` | grey neck strap / girth / reins (legend `G`) |
| `eyeWhite` | `#f0ece0` | rider turban (legend `W`) |
| `skin` | `#d8a878` | rider face + hands (legend `K`) |
| `robe` | **lane colour** | rider robe (legend `R`) — 8-colour game palette (below) |

The three body tones model lit crest / mid bulk / deep shade; `outline` is the near-black
ink. Every legend char routes through the sprite palette (see
[Implementer notes](#implementer-notes)).

Contrast checks (WCAG, computed): `outline`↔`body` **7.25:1**, `outline`↔`shade`
**5.50:1**, `outline`↔`shadeDeep` **4.62:1**. Non-text contrast needs ≥ 3:1 — the
outline passes on all three body tones; the body-tone steps themselves are deliberately
low-contrast (`body`↔`shade` 1.32:1, `body`↔`shadeDeep` 1.57:1, `shade`↔`shadeDeep`
1.19:1) to match the reference shading, and the silhouette is read from the outline
(7.72:1 vs dune sand `#c9a25a`).

Lane colours (robe only, in lane order):

| Lane | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| | `#e84a3a` | `#3a6ae8` | `#3aa84a` | `#e8c83a` | `#9a4ae8` | `#e88a3a` | `#3ad8d8` | `#e85a9a` |

## Legend (char → palette)

Every char resolves through the sprite's palette object. Only **`R` is per-lane**; all
others are fixed. Legend is **`. O B S D G R W K`** (validator whitelist). **`L` is not a
camel char** and `CHAR_KEY` has no `L` key (both removed); forest decor sprites that use
`L` (leaf litter, mesa) carry their own `L` palette key.

| char | meaning | colour | per-lane? |
|---|---|---|---|
| `.` | transparent | — | — |
| `O` | outline / hoof / eye / nostril | `#1c1208` | no |
| `B` | camel body light | `#de914d` | no |
| `S` | camel body mid | `#c37c3a` | no |
| `D` | body deep (`shadeDeep`) | `#b27035` | no |
| `G` | harness grey (straps, girth, reins) | `#53565e` | no |
| `R` | rider robe | lane colour | **yes** |
| `W` | white (turban) | `#f0ece0` | no |
| `K` | skin (face, hands) | `#d8a878` | no |

## Matrices (v7 — authoritative)

5 dressed frames, each **70 rows × 76 chars**. Frame 0 = standing; 1–4 = walk
(`contact A → pass A → contact B → pass B`), i.e. `[stand, contactA, passA, contactB, passB]`.
Bob (body +1 px up) is baked into frames 2/4. The block below is byte-identical to
`const CAMEL` in `index.html` (and cell-for-cell identical to `CAMEL_A_STAND[0] + CAMEL_A_WALK`
in [drafts v4](camel-drafts-v4.md)).

### `const CAMEL` — 5 frames (76 wide × 70 tall)

```js
  const CAMEL = [
    [ // frame 0 - standing (idle)
      '............................................................................',
      '............................................................................',
      '.................................................OOOOOOOOOOOOOOOO...........',
      '.................................................ODDDDBBBBBBBBBBO...........',
      '.................................................ODDDDBBBBBBBBBBOO..........',
      '.................................................ODDDBBBBBBBBBBBBOOOOOOOOO..',
      '.................................................ODDDBBBBBBBBBBBBBDDDDDDBO..',
      '.................................................OOOOBBBBBBBBBBBBBDDDDDDBOO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSSOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSOOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSO...',
      '....................................OOOOO...........OSSSSSSSSSSDDDDDOOOOO...',
      '..................................OOOOOOOO..........OSSSSSSSSSSDDDDDO.......',
      '...................OOOOOOOOOOOOOOOOOOWWWOOO.........OBBBBBBBBBBBBBOOO.......',
      '...................OBBBBBBBBBBBBBOOWWWWWWOO........OOBBBBBBBBBBBBBO.........',
      '.................OOOBBBBBBBBBBBBBOOWWWWWWOO........OBBBBBBBBBBBBBOO.........',
      '.................OBBBBBBBBBBBBBBBBOKKKKKKOO.......OOBBBBBBBBBBBGBO..........',
      '...............OOOBBBBBBBBBBBBBBBBOKKKKKKOO.......OBBBBBBBBBBBBGBO..........',
      '...............OSSSSSSSSSSSSSSSSSSSOKKKKKOOO.....OOBBBBBBBBBBBBGBO..........',
      '.............OOOSSSSSSSSSSSSSSSSSSSOKKKKKOOOOO...ODDBBBBBBBBBBGBOO..........',
      '.............OSSSSSSSSSSSSSSSSSSSORRRRRRROOOOOOOOODDBBBBBBBBBBGBO...........',
      '...........OODDDDDSSSSSSSSSSSSSSSORRRRRRRRRRKOSOODDBBBBBBBBBBGBOO...........',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRRROOOSOODDSSSSSSSSSSGSO............',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRODDDSSSSDDSSSSSSSSSSGSO............',
      '..........OOOBBBSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSDDSSSSSSSSSSGSO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSSSSSSSSSSSOOOOO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSGSSSSSSSSSSSSSSO................',
      '........OOOBBBSSSSSSSSSSSSSSSSSSSORRRROOOOSSGSSSSSSSSSSSSSSOOO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSOOOOOOOOSSSGSSSSSSSSSSSSSSSBO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBO..............',
      '.......OOSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBOO.............',
      '.......OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......OODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDOOO.............',
      '.....OODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDO...............',
      '.....ODDDSSDDDOOOOOBSSSDOOOOOOOOOOOOOSSDDDOOODBSSSDDDDDDDDDDO...............',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO.ODBSSSDDDDDDDDDDO...............',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO.OOBSSSDOOOOOOOOOO...............',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....OODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....ODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....ODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...OODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...ODDDOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...ODDDOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...ODDDOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...OOOOOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OOOOOOO...OOOOOOO...........OOOOOOO..OOOOOOO........................',
      '........OOOSOOO...OOOSOOO...........OOOSOOO..OOOSOOO........................',
      '........OOOSOOO...OOOSOOO...........OOOSOOO..OOOSOOO........................'
    ],
    [ // frame 1 - contact A (near-front forward, far-front back)
      '............................................................................',
      '............................................................................',
      '.................................................OOOOOOOOOOOOOOOO...........',
      '.................................................ODDDDBBBBBBBBBBO...........',
      '.................................................ODDDDBBBBBBBBBBOO..........',
      '.................................................ODDDBBBBBBBBBBBBOOOOOOOOO..',
      '.................................................ODDDBBBBBBBBBBBBBDDDDDDBO..',
      '.................................................OOOOBBBBBBBBBBBBBDDDDDDBOO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSSOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSOOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSO...',
      '....................................OOOOO...........OSSSSSSSSSSDDDDDOOOOO...',
      '..................................OOOOOOOO..........OSSSSSSSSSSDDDDDO.......',
      '...................OOOOOOOOOOOOOOOOOOWWWOOO.........OBBBBBBBBBBBBBOOO.......',
      '...................OBBBBBBBBBBBBBOOWWWWWWOO........OOBBBBBBBBBBBBBO.........',
      '.................OOOBBBBBBBBBBBBBOOWWWWWWOO........OBBBBBBBBBBBBBOO.........',
      '.................OBBBBBBBBBBBBBBBBOKKKKKKOO.......OOBBBBBBBBBBBGBO..........',
      '...............OOOBBBBBBBBBBBBBBBBOKKKKKKOO.......OBBBBBBBBBBBBGBO..........',
      '...............OSSSSSSSSSSSSSSSSSSSOKKKKKOOO.....OOBBBBBBBBBBBBGBO..........',
      '.............OOOSSSSSSSSSSSSSSSSSSSOKKKKKOOOOO...ODDBBBBBBBBBBGBOO..........',
      '.............OSSSSSSSSSSSSSSSSSSSORRRRRRROOOOOOOOODDBBBBBBBBBBGBO...........',
      '...........OODDDDDSSSSSSSSSSSSSSSORRRRRRRRRRKOSOODDBBBBBBBBBBGBOO...........',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRRROOOSOODDSSSSSSSSSSGSO............',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRODDDSSSSDDSSSSSSSSSSGSO............',
      '..........OOOBBBSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSDDSSSSSSSSSSGSO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSSSSSSSSSSSOOOOO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSGSSSSSSSSSSSSSSO................',
      '........OOOBBBSSSSSSSSSSSSSSSSSSSORRRROOOOSSGSSSSSSSSSSSSSSOOO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSOOOOOOOOSSSGSSSSSSSSSSSSSSSBO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBO..............',
      '.......OOSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBOO.............',
      '.......OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......OODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDOOO.............',
      '.....OODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDO...............',
      '.....ODDDDDDOOOOOOOOOBSSSDOOOOOOOOOOOOOSSDDDBSSSDDDDDDDDDDDDO...............',
      '.....ODDDDDDO.......OBSSSDO...........OSSDDDBSSSDDDDDDDDDDDDO...............',
      '.....ODDDDDDO.......OBSSSDO...........OSSDDDBSSSDOOOOOOOOOOOO...............',
      '.....ODDDDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '.....ODDDDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '.....ODDDDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '....OODDDDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '....ODDDSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '....ODDDSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '...OODDDSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '...ODDDSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '...ODDDSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '...ODDDSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '...OOOOSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '......OSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '......OSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '......OSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '......OSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '......OSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '......OSSDDDO.......OBSSSDO...........OSSDDDBSSSDO..........................',
      '......OOOOOOO.......OOOOOOO...........OOOOOOOOOOOO..........................',
      '......OOOSOOO.......OOOSOOO...........OOOSOOOOSOOO..........................',
      '......OOOSOOO.......OOOSOOO...........OOOSOOOOSOOO..........................'
    ],
    [ // frame 2 - pass A (1 px bob, legs under body)
      '............................................................................',
      '.................................................OOOOOOOOOOOOOOOO...........',
      '.................................................ODDDDBBBBBBBBBBO...........',
      '.................................................ODDDDBBBBBBBBBBOO..........',
      '.................................................ODDDBBBBBBBBBBBBOOOOOOOOO..',
      '.................................................ODDDBBBBBBBBBBBBBDDDDDDBO..',
      '.................................................OOOOBBBBBBBBBBBBBDDDDDDBOO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSSOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSOOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSO...',
      '....................................OOOOO...........OSSSSSSSSSSDDDDDOOOOO...',
      '..................................OOOOOOOO..........OSSSSSSSSSSDDDDDO.......',
      '...................OOOOOOOOOOOOOOOOOOWWWOOO.........OBBBBBBBBBBBBBOOO.......',
      '...................OBBBBBBBBBBBBBOOWWWWWWOO........OOBBBBBBBBBBBBBO.........',
      '.................OOOBBBBBBBBBBBBBOOWWWWWWOO........OBBBBBBBBBBBBBOO.........',
      '.................OBBBBBBBBBBBBBBBBOKKKKKKOO.......OOBBBBBBBBBBBGBO..........',
      '...............OOOBBBBBBBBBBBBBBBBOKKKKKKOO.......OBBBBBBBBBBBBGBO..........',
      '...............OSSSSSSSSSSSSSSSSSSSOKKKKKOOO.....OOBBBBBBBBBBBBGBO..........',
      '.............OOOSSSSSSSSSSSSSSSSSSSOKKKKKOOOOO...ODDBBBBBBBBBBGBOO..........',
      '.............OSSSSSSSSSSSSSSSSSSSORRRRRRROOOOOOOOODDBBBBBBBBBBGBO...........',
      '...........OODDDDDSSSSSSSSSSSSSSSORRRRRRRRRRKOSOODDBBBBBBBBBBGBOO...........',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRRROOOSOODDSSSSSSSSSSGSO............',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRODDDSSSSDDSSSSSSSSSSGSO............',
      '..........OOOBBBSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSDDSSSSSSSSSSGSO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSSSSSSSSSSSOOOOO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSGSSSSSSSSSSSSSSO................',
      '........OOOBBBSSSSSSSSSSSSSSSSSSSORRRROOOOSSGSSSSSSSSSSSSSSOOO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSOOOOOOOOSSSGSSSSSSSSSSSSSSSBO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBO..............',
      '.......OOSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBOO.............',
      '.......OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......OODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......OODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDOOO.............',
      '......OODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDO...............',
      '......ODDDSDDDOOOOOBSSSDOOOOOOOOOOOOOSSDDDOOODBSSSDDDDDDDDDDO...............',
      '......ODDDSDDDO...OBSSSDO...........OSSDDDO.ODBSSSDDDDDDDDDDO...............',
      '......ODDDSDDDO...OBSSSDO...........OSSDDDO.OOBSSSDOOOOOOOOOO...............',
      '......ODDDSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '......ODDDSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '......ODDDSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '.....OODDDSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....OODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....ODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....ODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....ODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....OOOOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OOOOOOO...OOOOOOO...........OOOOOOO..OOOOOOO........................',
      '........OOOSOOO...OOOSOOO...........OOOSOOO..OOOSOOO........................',
      '........OOOSOOO...OOOSOOO...........OOOSOOO..OOOSOOO........................'
    ],
    [ // frame 3 - contact B (mirror of contact A)
      '............................................................................',
      '............................................................................',
      '.................................................OOOOOOOOOOOOOOOO...........',
      '.................................................ODDDDBBBBBBBBBBO...........',
      '.................................................ODDDDBBBBBBBBBBOO..........',
      '.................................................ODDDBBBBBBBBBBBBOOOOOOOOO..',
      '.................................................ODDDBBBBBBBBBBBBBDDDDDDBO..',
      '.................................................OOOOBBBBBBBBBBBBBDDDDDDBOO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSSOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSOOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSO...',
      '....................................OOOOO...........OSSSSSSSSSSDDDDDOOOOO...',
      '..................................OOOOOOOO..........OSSSSSSSSSSDDDDDO.......',
      '...................OOOOOOOOOOOOOOOOOOWWWOOO.........OBBBBBBBBBBBBBOOO.......',
      '...................OBBBBBBBBBBBBBOOWWWWWWOO........OOBBBBBBBBBBBBBO.........',
      '.................OOOBBBBBBBBBBBBBOOWWWWWWOO........OBBBBBBBBBBBBBOO.........',
      '.................OBBBBBBBBBBBBBBBBOKKKKKKOO.......OOBBBBBBBBBBBGBO..........',
      '...............OOOBBBBBBBBBBBBBBBBOKKKKKKOO.......OBBBBBBBBBBBBGBO..........',
      '...............OSSSSSSSSSSSSSSSSSSSOKKKKKOOO.....OOBBBBBBBBBBBBGBO..........',
      '.............OOOSSSSSSSSSSSSSSSSSSSOKKKKKOOOOO...ODDBBBBBBBBBBGBOO..........',
      '.............OSSSSSSSSSSSSSSSSSSSORRRRRRROOOOOOOOODDBBBBBBBBBBGBO...........',
      '...........OODDDDDSSSSSSSSSSSSSSSORRRRRRRRRRKOSOODDBBBBBBBBBBGBOO...........',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRRROOOSOODDSSSSSSSSSSGSO............',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRODDDSSSSDDSSSSSSSSSSGSO............',
      '..........OOOBBBSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSDDSSSSSSSSSSGSO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSSSSSSSSSSSOOOOO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSGSSSSSSSSSSSSSSO................',
      '........OOOBBBSSSSSSSSSSSSSSSSSSSORRRROOOOSSGSSSSSSSSSSSSSSOOO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSOOOOOOOOSSSGSSSSSSSSSSSSSSSBO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBO..............',
      '.......OOSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBOO.............',
      '.......OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......OODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDOOO.............',
      '.....OODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDO...............',
      '.....ODDDOOSSDDDOBSSSDOOOOOOOOOOOOOSSDDDOOOOODDDBSSSDDDDDDDDO...............',
      '.....ODDDOOSSDDDOBSSSDO...........OSSDDDO...ODDDBSSSDDDDDDDDO...............',
      '.....ODDDOOSSDDDOBSSSDO...........OSSDDDO...OOOOBSSSDOOOOOOOO...............',
      '.....ODDDOOSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '.....ODDDOOSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '.....ODDDOOSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '....OODDDOOSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '....ODDDOOOSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '....ODDDO.OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '...OODDDO.OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '...ODDDOO.OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '...ODDDO..OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '...ODDDO..OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '...OOOOO..OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '..........OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '..........OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '..........OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '..........OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '..........OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '..........OSSDDDOBSSSDO...........OSSDDDO......OBSSSDO......................',
      '..........OOOOOOOOOOOOO...........OOOOOOO......OOOOOOO......................',
      '..........OOOSOOOOOSOOO...........OOOSOOO......OOOSOOO......................',
      '..........OOOSOOOOOSOOO...........OOOSOOO......OOOSOOO......................'
    ],
    [ // frame 4 - pass B (1 px bob, legs +1/-1)
      '............................................................................',
      '.................................................OOOOOOOOOOOOOOOO...........',
      '.................................................ODDDDBBBBBBBBBBO...........',
      '.................................................ODDDDBBBBBBBBBBOO..........',
      '.................................................ODDDBBBBBBBBBBBBOOOOOOOOO..',
      '.................................................ODDDBBBBBBBBBBBBBDDDDDDBO..',
      '.................................................OOOOBBBBBBBBBBBBBDDDDDDBOO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSSOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSOOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSO...',
      '....................................OOOOO...........OSSSSSSSSSSDDDDDOOOOO...',
      '..................................OOOOOOOO..........OSSSSSSSSSSDDDDDO.......',
      '...................OOOOOOOOOOOOOOOOOOWWWOOO.........OBBBBBBBBBBBBBOOO.......',
      '...................OBBBBBBBBBBBBBOOWWWWWWOO........OOBBBBBBBBBBBBBO.........',
      '.................OOOBBBBBBBBBBBBBOOWWWWWWOO........OBBBBBBBBBBBBBOO.........',
      '.................OBBBBBBBBBBBBBBBBOKKKKKKOO.......OOBBBBBBBBBBBGBO..........',
      '...............OOOBBBBBBBBBBBBBBBBOKKKKKKOO.......OBBBBBBBBBBBBGBO..........',
      '...............OSSSSSSSSSSSSSSSSSSSOKKKKKOOO.....OOBBBBBBBBBBBBGBO..........',
      '.............OOOSSSSSSSSSSSSSSSSSSSOKKKKKOOOOO...ODDBBBBBBBBBBGBOO..........',
      '.............OSSSSSSSSSSSSSSSSSSSORRRRRRROOOOOOOOODDBBBBBBBBBBGBO...........',
      '...........OODDDDDSSSSSSSSSSSSSSSORRRRRRRRRRKOSOODDBBBBBBBBBBGBOO...........',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRRROOOSOODDSSSSSSSSSSGSO............',
      '...........OSDDDDDSSSSSSSSSSSSSSSORRRRRRRODDDSSSSDDSSSSSSSSSSGSO............',
      '..........OOOBBBSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSDDSSSSSSSSSSGSO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSSSSSSSSSSSSSSSSOOOOO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSORRRRRRROSSGSSSSSSSSSSSSSSO................',
      '........OOOBBBSSSSSSSSSSSSSSSSSSSORRRROOOOSSGSSSSSSSSSSSSSSOOO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSOOOOOOOOSSSGSSSSSSSSSSSSSSSBO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBO..............',
      '.......OOSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBOO.............',
      '.......OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......OODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '.....OODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '.....ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '.....ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDOOO.............',
      '....OODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDO...............',
      '....ODDDOOSSDDDOOOBSSSDOOOOOOOOOOOOOSSDDDOOOODDBSSSDDDDDDDDDO...............',
      '....ODDDOOSSDDDO.OBSSSDO...........OSSDDDO..ODDBSSSDDDDDDDDDO...............',
      '....ODDDOOSSDDDO.OBSSSDO...........OSSDDDO..OOOBSSSDOOOOOOOOO...............',
      '....ODDDOOSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '....ODDDOOSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '....ODDDOOSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '...OODDDOOSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '...ODDDOOOSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '...ODDDO.OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '..OODDDO.OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '..ODDDOO.OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '..ODDDO..OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '..ODDDO..OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '..OOOOO..OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '.........OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '.........OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '.........OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '.........OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '.........OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '.........OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '.........OSSDDDO.OBSSSDO...........OSSDDDO....OBSSSDO.......................',
      '.........OOOOOOO.OOOOOOO...........OOOOOOO....OOOOOOO.......................',
      '.........OOOSOOO.OOOSOOO...........OOOSOOO....OOOSOOO.......................',
      '.........OOOSOOO.OOOSOOO...........OOOSOOO....OOOSOOO.......................'
    ]
  ];
```

### `CAMEL_A_BARE` — standing reference (76 wide × 70 tall)

Rider omitted. Not rendered by the game; the rider-less standing frame from
[drafts v4](camel-drafts-v4.md), kept as the silhouette/anatomy source.

```js
  const CAMEL_A_BARE = [
    [ // frame 0 - standing bare (no rider)
      '............................................................................',
      '............................................................................',
      '.................................................OOOOOOOOOOOOOOOO...........',
      '.................................................ODDDDBBBBBBBBBBO...........',
      '.................................................ODDDDBBBBBBBBBBOO..........',
      '.................................................ODDDBBBBBBBBBBBBOOOOOOOOO..',
      '.................................................ODDDBBBBBBBBBBBBBDDDDDDBO..',
      '.................................................OOOOBBBBBBBBBBBBBDDDDDDBOO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBOOOBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OBBBBBBBBBBBBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSBBBBBBBBBBO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSSOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSOOO.',
      '....................................................OSSSSSSSSSSSSSSSSSSSO...',
      '....................................................OSSSSSSSSSSDDDDDOOOOO...',
      '....................................................OSSSSSSSSSSDDDDDO.......',
      '...................OOOOOOOOOOOOOOO..................OBBBBBBBBBBBBBOOO.......',
      '...................OBBBBBBBBBBBBBO.................OOBBBBBBBBBBBBBO.........',
      '.................OOOBBBBBBBBBBBBBOOO...............OBBBBBBBBBBBBBOO.........',
      '.................OBBBBBBBBBBBBBBBBBO..............OOBBBBBBBBBBBGBO..........',
      '...............OOOBBBBBBBBBBBBBBBBBOOOO...........OBBBBBBBBBBBBGBO..........',
      '...............OSSSSSSSSSSSSSSSSSSSSSSO..........OOBBBBBBBBBBBBGBO..........',
      '.............OOOSSSSSSSSSSSSSSSSSSSSSSOOOOOOOO...ODDBBBBBBBBBBGBOO..........',
      '.............OSSSSSSSSSSSSSSSSSSSSSSSSSSSDDDDOOOOODDBBBBBBBBBBGBO...........',
      '...........OODDDDDSSSSSSSSSSSSSSSSSSSSSSSDDDDSSOODDBBBBBBBBBBGBOO...........',
      '...........OSDDDDDSSSSSSSSSSSSSSSSSSSSSSSDDDDSSOODDSSSSSSSSSSGSO............',
      '...........OSDDDDDSSSSSSSSSSSSSSSSSSSSSSSDDDDSSSSDDSSSSSSSSSSGSO............',
      '..........OOOBBBSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSDDSSSSSSSSSSGSO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSOOOOO............',
      '..........OBBBSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSO................',
      '........OOOBBBSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSOOO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBO..............',
      '........OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBO..............',
      '.......OOSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSBOO.............',
      '.......OSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '.......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......OODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSGSSSSSSSSSSSSSSSSBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDDBO.............',
      '......ODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDOOO.............',
      '.....OODDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDGDDDDDDDDDDDDDDDO...............',
      '.....ODDDSSDDDOOOOOBSSSDOOOOOOOOOOOOOSSDDDOOODBSSSDDDDDDDDDDO...............',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO.ODBSSSDDDDDDDDDDO...............',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO.OOBSSSDOOOOOOOOOO...............',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '.....ODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....OODDDSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....ODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '....ODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...OODDDOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...ODDDOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...ODDDOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...ODDDOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '...OOOOOOSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OSSDDDO...OBSSSDO...........OSSDDDO..OBSSSDO........................',
      '........OOOOOOO...OOOOOOO...........OOOOOOO..OOOOOOO........................',
      '........OOOSOOO...OOOSOOO...........OOOSOOO..OOOSOOO........................',
      '........OOOSOOO...OOOSOOO...........OOOSOOO..OOOSOOO........................'
    ],
  ];
```

## Silhouette / anatomy (shared per frame)

- **Hump**: single, rows 20–29, crest 13 px wide (cols 20–32), base 33 px, 10 rows tall
  (crest sits 7 rows above the body back line); `D` `hump_crease` seam where the hump's
  front slope meets the saddle hollow and behind the rump.
- **Body**: barrel rows 27–48, rump rear col 7, chest front col 61; `B` rim on the
  rump's rear edge and the chest front, `S` bulk, `D` belly band + lee edge.
- **Neck**: rows 17–30, 14 px wide at the base, 14 rows tall (short + thick, like the
  reference); 1 px `G` strap down the neck front (rows 22–30).
- **Head**: blocky skull rows 3–18 (cols 53–65) + drooping muzzle rows 6–18 to col 73;
  `D` ear (cols 50–53, rows 3–6), `O` 3×2 eye (cols 58–60, rows 8–9), `D` muzzle bridge
  band + `D` under-jaw, `O` nostril (col 73, row 14).
- **Legs**: fill 5 px + outline each, 23 rows (47–69); **rear pair 17 px** wide (fill gap
  5 px), **front pair 16 px** (gap 4 px); hooves `O` rows 67–69 with a 1 px `S` split;
  far legs shaded (`S S D D D`), near legs lit (`B S S S D`).
- **Tail**: `D` line + tuft, rows 44–59, flicking +1 / −1 px on the pass frames.
- **Rider** (17 px tall, 19 px wide): turban 4 rows, face 4, tunic 8, boots `O` 2 — seat
  row 31; boots land on the body's back band (**no blanket, no gap, no float**).

## High-detail rendering notes

- **Four-tone body** — surfaces are painted `B` lit / `S` mid / `D` deep shade inside the
  `O` ink, so hump, neck, legs and belly read with volume without extra chars.
- **Hooves** — `O` blocks on rows 67–69 with a 1 px `S` split (two-toe read).
- **Eye** — a 3×2 `O` block with a `D` brow, readable at 1× on sand.
- **Tail tuft** — a short `D` tuft that flicks +1/−1 px on the pass frames.

## Gait & timing

```
contact A ──► pass A ──► contact B ──► pass B ──┐
    ▲                                            │
    └────────────────────────────────────────────┘
```

- Cycle = 4 walk frames × **320 ms** ≈ **1280 ms**; idle = frame 0, **no idle motion**.
- Index while animating: `(Math.floor(now / 320) % 4) + 1`, else `0`.
- **Contact A (1)**: rear pair spread wide (far leg −2, near leg +2), front pair at the
  pass (far +2, near −2); tail neutral. **Contact B (3)** mirrors it.
- **Pass A (2)**: legs back under the body; body + head + rider **1 px up** (bob); tail
  +1 px. **Pass B (4)**: far legs +1/−1, bob 1 px up, tail −1 px.
- The **bob is baked into the matrices**: rows shift up by 1 on frames 2/4 while the leg
  fill starts 1 row higher, so the **hooves stay planted on row 69 in every frame** and
  `drawSprite` applies no offset. A/B pass poses differ in leg placement and tail flick
  → no duplicate frames.
- Only **legs, the 1 px bob, head/neck and tail** move; the hump and body outline are
  otherwise identical across frames → no silhouette jitter.

## No saddle blanket (removed)

- No `L` cell exists in any frame; `CAMEL_PAL` has **no `blanket` key** and `CHAR_KEY`
  has **no `L` entry** (both removed, shared with the boar change). No `#bfe3ea` pixel is
  painted anywhere on or around the camel.
- Lane/team identity = the **canvas team-name label above the animal** plus the
  **per-lane rider robe colour** `R`. The digit convention (`DIGIT_FONT`,
  `drawBlanketNumber`, `CAMEL_ANCHOR`, ink `#123a44`) is retired; nothing is painted
  after `drawSprite(...)`.

## Team-name label

- The team is identified by the canvas label **above** the animal: team name in
  **12 px monospace** `#e8e0d0` on a dark pill (16 px tall, `rgba(26,18,8,0.72)` + 1 px
  `rgba(0,0,0,0.55)` outline, **4 px above the sprite top**, 4 px text pad), tracking
  the animal's visual centre and **clamped to the canvas**; geometry is recomputed every
  frame, so a rename redraws on the same frame.
- Verified in the current worktree (`index.html` `drawTeamLabels`): `TEAM_LABEL_GAP = 4`,
  `TEAM_LABEL_H = 16`, no digit draw call and no `CAMEL_ANCHOR`; the label anchor
  inherits the sprite size via `camelTopY` (`SPRITE_H = 70`).

## Implementer notes

- **Constants**: `SPRITE_W = 76`, `SPRITE_H = 70` (from the theme registry), buffer
  **1280×720**, `HORIZON_Y = 120`, `LANE_BOTTOM = 712` (720 − 8), `LANE_MARGIN = 4`,
  `TERRAIN_FEET_OFFSET = 2`, `ANIM_FRAME_MS = 320` (walk cycle **1280 ms**;
  `ANIM_MS = 1400`).
- **Palette factory** (shipped `index.html`, copy verbatim):

  ```js
  const CAMEL_PAL = (robe) => ({
    outline: '#1c1208', body: '#de914d', shade: '#c37c3a', shadeDeep: '#b27035',
    harness: '#53565e', robe: robe, eyeWhite: '#f0ece0', skin: '#d8a878',
  });
  ```
- **Registry entry** (theme `desert`, shipped):

  ```js
  animal: {
    id: 'camel', sprite: CAMEL, pal: CAMEL_PAL, w: 76, h: 70, rider: 'turban', // rider: declarative-only
  },
  laneFit: { spriteHMax: 70, laneMinPx: 74 },
  ```
- **`drawSprite` legend**: route *every* char through the sprite palette
  (`O→outline, B→body, S→shade, D→shadeDeep, G→harness, R→robe, W→eyeWhite, K→skin`;
  `.` skipped), falling back to `CHAR_KEY`/`COL` for decoration sprites. `CHAR_KEY` has
  **no `L`**; forest decor that uses `L` (leaf litter, mesa) keys it in its own palette.
- **Shared `D → shadeDeep` key**: the boar palette carries `shadeDeep: '#26221a'` (its
  bristle/reins/boots tone) and `harness: '#2e2918'` (its `G` legs tone), so the one
  `CHAR_KEY` serves both animals.
- **Digit + blanket draw retired**: no `drawBlanketNumber` call after `drawSprite(...)`;
  `CAMEL_ANCHOR`, `blanket.anchor`, `blanket.digitColor` and the `blanket` palette key
  do not exist in the shipped code. Team identity = the canvas team-name label
  (see [Team-name label](#team-name-label)) + robe colour.
- **Lane math**: `camelTopY(i,n) = clamp(laneTopY, laneBottomY − SPRITE_H, laneSurfaceY − SPRITE_H)`
  keeps the feet 2 px above the surface. At `n = 8`, `laneHeight = 74.0 px`; the 70 px
  sprite + 2 px feet offset = 72 px, so the slack is **2 px** — even at the dune crest
  `h = +2` the sprite top lands exactly on the lane top and the clamp stays inert.
- **`camelTargetLeft` clamp** uses `SPRITE_W = 76`: the sprite is centred on the mapped
  score (`cx − SPRITE_W/2`) and clamped to
  `LANE_MARGIN … CANVAS_W − SPRITE_W − LANE_MARGIN` = **4 … 1200** (v6 was `4 … 1184`;
  the narrower v7 camel has 16 px more travel on each side). Team labels clamp to the
  canvas (`x ∈ [0, CANVAS_W − w]`, defensive `y` clamps).

## Validation (run on the matrices above)

Re-checked against the shipped `const CAMEL` extracted from `index.html` for this doc
(the same matrices as the drafts v4 validator, which additionally measured the fill
blob, holes and pairwise similarity):

| Check | Result |
|---|---|
| exact 70 rows × 76 chars (all frames) | ✓ |
| legend-only chars (`. O B S D G R W K`) | ✓ (no `L`) |
| outline encloses body (no fill 4-adjacent to exterior `.`) | ✓ (0 offenders, all frames) |
| no interior holes (every `.` component touches the border) | ✓ (0 hole cells, all frames) |
| single 4-connected blob (no strays / border fill) | ✓ (fill-only `B S D G` blob per drafts v4) |
| hooves on the bottom row (row 69) every frame | ✓ (row 69 = `O`/`S` hoof blocks) |
| painted bbox within 76 × 70 | 72×68 @ (3,2) · 72×68 @ (3,2) · 71×69 @ (4,1) · 72×68 @ (3,2) · 73×69 @ (2,1) (frames 0–4) |
| painted px per frame (0–4) | 2584 / 2516 / 2597 / 2579 / 2634 |
| all 5 poses pairwise distinct (similarity < 0.98) | ✓ (closest pair **frames 0 vs 2 = 0.8135**) |
| no `L` px | 0 in every frame |

## v7 geometry (buffer 1280×720, sprite 76×70, 8 lanes)

| Constant | Value | Derivation |
|---|---|---|
| Buffer | **1280 × 720** (16:9) | spec (2× the old 640×360) |
| `SPRITE_W` / `SPRITE_H` | **76 / 70** | v7 matrix dims (painted bbox 72 × 68 standing/contact) |
| `HORIZON_Y` | **120** | spec |
| `LANE_BOTTOM` | **712** | 720 − 8 |
| Lane region | **592** | `712 − 120` |
| Lane height (n=8) | **74.0 px** | `592 / 8` |
| Lane height (n=4) | **148.0 px** | `592 / 4` |
| `LANE_MARGIN` | **4** | spec |
| `TERRAIN_FEET_OFFSET` | **2** | unchanged |
| Terrain amplitude | **±2 px** | `TERRAIN { A1:1.2, L1:160, PH1:0, A2:0.8, L2:130, PH2:1.7 }` |
| `ANIM_FRAME_MS` | **320** | gait cycle 1280 ms; frame order 1→2→3→4→1 |

8-lane fit: `laneHeight(8) − SPRITE_H − TERRAIN_FEET_OFFSET = 74 − 70 − 2 = 2 px`
slack; at the dune crest `h = +2` the sprite top lands exactly on the lane top and the
`camelTopY` clamp stays inert. Camera margins: `camelTargetLeft` clamp `4 … 1200`; team
labels clamp to the canvas.

## Dune lane tokens (terrain feature, approved 1A)

Palette for the sand-dune lane ribbons under the dark night sky. Adds one shared
ribbon under each lane so camels appear to run along rolling dunes.

| Token | Hex | Use |
|---|---|---|
| `duneTop` | `#c9a25a` | lit sand (ribbon fill) |
| `duneShade` | `#a8813f` | shaded sand / lee side |
| `duneEdge` | `#6e4f2a` | dark crease between ribbons |
| `duneRim` | `#523a1e` | thin darker rim under the lit crest |

Contrast checks: `duneTop`↔`duneShade` 1.50, `duneTop`↔`duneEdge` 3.13,
`duneTop`↔sky `#1a1030` 7.58, `duneRim`↔`duneTop` 4.44.
The brown camel (`#de914d`) on `duneTop` is only **1.06** — acceptable because the
camel's dark outline reads at **7.72** against the sand (see acceptance criteria).

### Shared terrain profile `h(x)`

One deterministic height field reused by every lane (lane-y offset only):

```
h(x) = A1*sin(2π*x/λ1 + φ1) + A2*sin(2π*x/λ2 + φ2)
A1 = 1.2 px,  λ1 = 160 px,  φ1 = 0
A2 = 0.8 px,  λ2 = 130 px,  φ2 = 1.7
```

| Requirement | Value |
|---|---|
| Amplitude | `A1 + A2 ≤ 2 px` (kept; amplitude not doubled at 1280×720 so the 8-lane fit holds) |
| Wavelength | `λ ∈ [120, 200] px` → reads as rolling dunes, not noise |
| Deterministic | pure `Math.sin`, **no `Math.random`**, stable across frames |
| Smooth | max slope `2π(A1/λ1 + A2/λ2) ≈ 0.09 px/px` → `|h(x+1)-h(x)| ≤ 1 px` |
| Same for all lanes | identical `h(x)`; lanes differ only by their vertical offset |

Draw per lane *before* the camel: fill `laneTopY..laneBottomY` with `duneTop`, offset the
crest line by `h(worldX)`, stroke `duneRim` 1 px under the crest and `duneEdge` along the
ribbon bottom; clamp `h` to `[-2, +2]`.

## Palette-swap

Only `R` changes per camel. `O`/`B`/`S`/`D`/`G`/`K`/`W` are fixed, so the silhouette,
face, turban and harness stay identical and every robe colour reads clearly. The
throwaway previews (outside the repo) render draft A dressed on sand `#c9a25a`.

## Acceptance criteria (Playwright-testable)

1. **Sprite size** — for lane 0 with any score, the painted camel's bounding box is
   ≤ 76 px wide and ≤ 70 px tall (matrix uniform `76 × 70`).
2. **Feet on the lane** — the camel's lowest painted row equals
   `laneBottomY(0, n) - 2` (± dune `h`, clamped inside the lane); feet on row 69 of the
   sprite (hoof `O` blocks never move with the bob).
3. **Standing frame** — with no score change, sampling the lane returns frame 0 (the
   standing matrix); no idle motion between two rAF ticks.
4. **Walk cycle** — after a score change, the frame index advances `1→2→3→4→1` at
   320 ms steps and returns to 0 after `ANIM_MS`.
5. **Bob** — on frames 2/4 the body (neck, head, rider) sits **1 px higher** than
   frame 0 (baked into the matrix); the planted hooves remain on row 69.
6. **Palette-swap** — **no `#bfe3ea` blanket pixel is painted anywhere** (no `L` cell,
   no `blanket` key); rider-robe pixels equal the camel's lane colour; harness pixels are
   `#53565e` in every lane.
7. **Team name** — the team name is drawn as a canvas label above the sprite (12 px
   monospace `#e8e0d0` on a dark pill, clamped to the canvas); no digit and no blanket
   patch are painted.
8. **Fixed tones** — body pixels are `#de914d`, outline pixels `#1c1208` and deep-shade
   pixels `#b27035` in every lane.
9. **Dune profile** — sampling the crest line gives the same `h(x)` for every lane;
   `|h| ≤ 2` for all `x`; two samples `x` and `x+1` differ by ≤ 1.
10. **Readability** — with the camel on `duneTop`, at least one outline pixel `#1c1208`
    stays adjacent to the camel in x so the silhouette reads (contrast 7.72).

## Selection & history

**Draft A (stocky reference-matched dromedary)** was chosen from
[`docs/art/camel-drafts-v4.md`](camel-drafts-v4.md) and shipped as **v7 (`76×70`)**,
replacing the v6 `92×70` dromedary and dropping the saddle blanket from both animals
(user request). Earlier rounds: **v6** promoted draft A of
[camel-drafts-v3.md](camel-drafts-v3.md); **T2 (two-hump Bactrian)** was chosen from
[drafts v2](camel-drafts-v2.md) on **2026-10-04**; **v5 (`66×62`)** promoted v4 to the
1280×720 buffer.

| Version | Size | Notes |
|---|---|---|
| v3 | 34×24 | single-hump draft (deleted after promotion) |
| v4 | 33×31 | two-hump Bactrian, 640×360 buffer, 3×5 digit (retired) |
| v5 | 66×62 | 1280×720 buffer, two-hump Bactrian, 6×10 digit (retired — team name is now a canvas label) |
| v6 | 92×70 | naturalistic dromedary + plain blue blanket, `D` = `shadeDeep`, bob baked, no digit |
| **v7 (draft A)** | **76×70** | stocky reference-matched dromedary, **no blanket** (`L` + `blanket` key removed), cleaned reference tones, bob baked, hooves on row 69; shipped in `index.html` |

v3 history: **Draft A** had been chosen from `docs/art/camel-drafts.md` on 2026-10-03
(a 34×24 single-hump design; drafts doc deleted after promotion).

## Appendix A — v4 matrices (superseded, `33×31`)

Kept for history/diff. Not rendered (v7 supersedes). 31 rows × 33 chars.

```
  const CAMEL_V4 = [
    [ // frame 0 — standing (idle)
      '......................OOO........',
      '..........OOOOOO......OSSOO......',
      '..........OWWWWO....OOSBBBBO.....',
      '..........OWWWWO....OSBSSSBBOOO..',
      '..........OWWWWO....OBBBBBBBGBBO.',
      '..........OOKKOO.....OBBBBBGBBBO.',
      '........OOORRRRO.....OSBSSSGOSSO.',
      '.......OOBORRRROOO...OSBBBSGOOOO.',
      '........OOORRRROBBO...OSBBBGO....',
      '.......OBBORRRROBBBO..OSBBBGO....',
      '.......OBSORRRROSSBO..OSBBBO.....',
      '......OBSSORRRROSSBBOOSBBBGO.....',
      '.....OOBSSOLLLLOSSSBBBBBSGGO.....',
      '....OOBBSSOLLLLOSSSSSSSSGGO......',
      '...O.OBSSSOLLLLOGGGGGGGSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSO........',
      '...O..OSSSOOOOOOSSSSSSSOO........',
      '...OO.OSSSSSSSSSSSSSSSO..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSO....OSSSSO...........',
      '..O.SSSSSSO.....OSSSO............',
      '...OSSSSSSO.....OSSSO............',
      '....OSSSSO.....OSSSO.............',
      '.....OSSSO......OSSO.............',
      '......OSO........OSO.............',
      '......OSO........OSO.............',
      '......OSO........OSO.............',
      '......OSO........OSO.............',
      '.....OOOOO......OOOOO............',
    ],
    [ // frame 1 — contact A
      '.......................OOO.......',
      '..........OOOOOO.......OSSOO.....',
      '..........OWWWWO.....OOSBBBBO....',
      '..........OWWWWO.....OSBSSSBBOOO.',
      '..........OWWWWO.....OBBBBBBBGBBO',
      '..........OOKKOO......OBBBBBGBBBO',
      '........OOORRRRO......OSBSSSGOSSO',
      '.......OOBORRRROOO....OSBBBSGOOOO',
      '........OOORRRROBBO...OSBBBGO....',
      '.......OBBORRRROBBBO..OSBBBGO....',
      '.......OBSORRRROSSBO..OSBBBO.....',
      '......OBSSORRRROSSBBOOSBBBGO.....',
      '.....OOBSSOLLLLOSSSBBBBBSGGO.....',
      '....OOBBSSOLLLLOSSSSSSSSGGO......',
      '...O.OBSSSOLLLLOGGGGGGGSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSO........',
      '...O..OSSSOOOOOOSSSSSSSOO........',
      '...OO.OSSSSSSSSSSSSSSSO..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSO....OSSSSO...........',
      '..O.OOSSSOO.....OOOSO............',
      '......OSO..........OSO...........',
      '......OSO..........OSO...........',
      '......OSO..........OSO...........',
      '.....OSO............OSO..........',
      '.....OSO............OSO..........',
      '....OSO..............OSO.........',
      '...OSO................OSO........',
      '..OOOOO..............OOOOO.......',
    ],
    [ // frame 2 — pass A (bob)
      '.................................',
      '......................OOO........',
      '..........OOOOOO......OSSOO......',
      '..........OWWWWO....OOSBBBBO.....',
      '..........OWWWWO....OSBSSSBBOOO..',
      '..........OWWWWO....OBBBBBBBGBBO.',
      '..........OOKKOO.....OBBBBBGBBBO.',
      '........OOORRRRO.....OSBSSSGOSSO.',
      '.......OOBORRRROOO...OSBBBSGOOOO.',
      '........OOORRRROBBO...OSBBBGO....',
      '.......OBBORRRROBBBO..OSBBBGO....',
      '.......OBSORRRROSSBO..OSBBBO.....',
      '......OBSSORRRROSSBBOOSBBBGO.....',
      '.....OOBSSOLLLLOSSSBBBBBSGGO.....',
      '....OOBBSSOLLLLOSSSSSSSSGGO......',
      '...O.OBSSSOLLLLOGGGGGGGSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSO........',
      '...O..OSSSOOOOOOSSSSSSSOO........',
      '..OOO.OSSSSSSSSSSSSSSSO..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOOSSSOOO....OOOSSO...........',
      '......OSO..........OSO...........',
      '......OSO..........OSO...........',
      '......OSO..........OSO...........',
      '......OSO..........OSO...........',
      '......OSO..........OSO...........',
      '.....OSO............OSO..........',
      '.....OSO............OSO..........',
      '....OOOOO..........OOOOO.........',
    ],
    [ // frame 3 — contact B
      '.....................OOO.........',
      '..........OOOOOO.....OSSOO.......',
      '..........OWWWWO...OOSBBBBO......',
      '..........OWWWWO...OSBSSSBBOOO...',
      '..........OWWWWO...OBBBBBBBGBBO..',
      '..........OOKKOO....OBBBBBGBBBO..',
      '........OOORRRRO....OSBSSSGOSSO..',
      '.......OOBORRRROOO..OOBBBSGOOOO..',
      '........OOORRRROBBO...OSBBBGO....',
      '.......OBBORRRROBBBO..OSBBBGO....',
      '.......OBSORRRROSSBO..OSBBBO.....',
      '......OBSSORRRROSSBBOOSBBBGO.....',
      '.....OOBSSOLLLLOSSSBBBBBSGGO.....',
      '....OOBBSSOLLLLOSSSSSSSSGGO......',
      '...O.OBSSSOLLLLOGGGGGGGSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSO........',
      '...O..OSSSOOOOOOSSSSSSSOO........',
      '...OO.OSSSSSSSSSSSSSSSO..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOSSSSSSO....OSSSSO...........',
      '..O.OOSSSOO.....OOOSO............',
      '......OSO..........OSO...........',
      '......OSO..........OSO...........',
      '......OSO..........OSO...........',
      '.......OSO........OSO............',
      '.......OSO........OSO............',
      '........OSO......OSO.............',
      '.........OSO....OSO..............',
      '........OOOOO..OOOOO.............',
    ],
    [ // frame 4 — pass B (bob)
      '.................................',
      '......................OOO........',
      '..........OOOOOO......OSSOO......',
      '..........OWWWWO....OOSBBBBO.....',
      '..........OWWWWO....OSBSSSBBOOO..',
      '..........OWWWWO....OBBBBBBBGBBO.',
      '..........OOKKOO.....OBBBBBGBBBO.',
      '........OOORRRRO.....OSBSSSGOSSO.',
      '.......OOBORRRROOO...OSBBBSGOOOO.',
      '........OOORRRROBBO...OSBBBGO....',
      '.......OBBORRRROBBBO..OSBBBGO....',
      '.......OBSORRRROSSBO..OSBBBO.....',
      '......OBSSORRRROSSBBOOSBBBGO.....',
      '.....OOBSSOLLLLOSSSBBBBBSGGO.....',
      '....OOBBSSOLLLLOSSSSSSSSGGO......',
      '...O.OBSSSOLLLLOGGGGGGGSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSSO.......',
      '...O.OBSSSOLLLLOSSSSSSSSO........',
      '...O..OSSSOOOOOOSSSSSSSOO........',
      '...OOOOSSSSSSSSSSSSSSSO..........',
      '..O.OOSSSSSSSOOOSSSSSO...........',
      '..O.OSSSSSSSO...OSSSSO...........',
      '..OOOOOSSSOO....OOSSSO...........',
      '.......OSO........OSO............',
      '.......OSO........OSO............',
      '.......OSO........OSO............',
      '.......OSO........OSO............',
      '.......OSO........OSO............',
      '........OSO......OSO.............',
      '........OSO......OSO.............',
      '.......OOOOO....OOOOO............',
    ],
  ];
```

