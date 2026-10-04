# Camel sprite v5 — 66×62 two-hump Bactrian rider + numbered saddle blanket

Procedural pixel art for the Camel Race / Kamel Rennen racer. Facing **right**, one
lane per camel. No image files: the matrices below drive the `drawSprite` pixel loop
(legend — see [Legend](#legend-char--palette)). At the `1280×720` buffer the camel is
drawn at **1:1** (no runtime scaling); the display scale is applied to the whole canvas.

This is **T2, the two-hump Bactrian**, promoted from v4 (`33×31`) to the 2× resolution
**v5 (`66×62`)**. The silhouette, palette and gait of v4 are preserved and refined with
more tonal rows. See [Selection](#selection--history).

| Item | Value |
|---|---|
| Size | **66 × 62** buffer px (uniform matrix all frames); painted bbox **62–63 × 58–59** |
| Frames | 1 standing + 4-frame walk: `contact A → pass A → contact B → pass B` |
| Feet | on the **bottom row** (row 61) in every frame |
| Bob | whole body +1 px on the pass frames `2, 4`; feet stay on row 61; blanket +2 px |
| Height budget | 62 px sprite in a **74.0 px** lane (`1280×720`, 8 lanes) with ±2 px dune bobbing → **12 px slack** |
| Digit | **6×10** grid, sprite-local anchor **`(24, 36)`**, **+2 rows** on bob frames 2/4 |
| Previews | gitignored `test-results/ux-tmp/`: `camel-v5-frames.png` (5 frames 8× + grid), `camel-v5-loop.png` (4 walk poses 4×), `camel-v5-dressed.png` (3 robes × digits 1–8), `camel-v5-1x.png` (1× strip on sand `#c9a25a`) |
| Status | **v5**, supersedes v4 `33×31`; **dressed form is what the game renders** |

Body is **brown** per the pixel-art reference. The **rider's robe** takes the lane
colour (palette-swap). The **saddle blanket** is light blue and carries a **6×10 pixel
digit** (the camel's number) drawn by code.

## Goal

Match the reference art palette with the **T2 two-hump Bactrian** silhouette: brown
body (`B`/`S`), dark outline `O`, grey harness `G`, thin hanging tail, a fairground
rider and a numbered saddle blanket so each lane reads as a distinct racer at a glance.
v5 keeps that silhouette recognisable at 2× and adds more tonal rows (bristle-like
shading on humps/neck/legs), cleaner knees/hooves, a readable eye and a tail tuft.

## Reference art

User-provided pixel-art and fairground-photo references informed the palette/silhouette
(removed from the repo for copyright reasons; art stays procedural and the removed
images are **not** linked or loaded). The camel silhouette/palette is authored from the
v4 matrices plus the design notes in this file.

## Dressed variant

`const CAMEL` (below) is the **dressed** form the game renders: T2 body/legs with the
rider (`W` turban, `K` face, lane-colour `R` robe, dark `O` boots, `G` reins) and the flat `L` blanket
overlaid; the digit is painted by code (see [Saddle blanket + number](#saddle-blanket--number)).
`const CAMEL_BARE` is the rider-less standing reference (silhouette/anatomy source).

## Palette

Fixed tones (unchanged from v4 — the reference-faithful browns). Contrast ratios are WCAG.

| Token | Hex | Use |
|---|---|---|
| `outline` | `#1a1208` | silhouette outline, hooves, eye |
| `body` | `#c9803a` | camel body (lit orange) |
| `shade` | `#8a5220` | bulk orange, legs, belly, tail |
| `harness` | `#53565e` | grey neck-strap / belly-band / reins (legend `G`) |
| `white` | `#f0ece0` | rider turban |
| `skin` | `#d8a878` | rider face |
| `blanket` | `#bfe3ea` | saddle blanket (light blue) |
| `digit` | `#123a44` | number on the blanket (contrast on blanket **8.98** ✓ AA) |
| `robe` | **lane colour** | rider robe — 8-colour game palette (below) |

**No new tones or legend chars in v5.** The higher detail is modelled with the existing
pair `body #c9803a` / `shade #8a5220` (lit crests and alternating tonal rows read as
bristle/fur), plus `harness #53565e` for straps/reins and `outline #1a1208` for the eye,
knee creases and hoof lines. Every legend char still routes through the sprite palette.

Lane colours (robe only, in lane order):

| Lane | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| | `#e84a3a` | `#3a6ae8` | `#3aa84a` | `#e8c83a` | `#9a4ae8` | `#e88a3a` | `#3ad8d8` | `#e85a9a` |

## Legend (char → palette)

Every char resolves through the sprite's palette object. Only **`R` is per-lane**; all
others are fixed. Legend is **`. O B S G R W K L`** (validator whitelist).

| char | meaning | colour | per-lane? |
|---|---|---|---|
| `.` | transparent | — | — |
| `O` | outline | `#1a1208` | no |
| `B` | camel body (lit) | `#c9803a` | no |
| `S` | camel shade | `#8a5220` | no |
| `G` | harness grey (straps + reins) | `#53565e` | no |
| `R` | rider robe | lane colour | **yes** |
| `W` | white (turban) | `#f0ece0` | no |
| `K` | skin (face) | `#d8a878` | no |
| `L` | saddle blanket | `#bfe3ea` | no |

## Matrices (v5 — authoritative)

5 dressed frames, each **62 rows × 66 chars**. Frame 0 = standing; 1–4 = walk
(`contact A → pass A → contact B → pass B`). Bob (body +1 px) is baked into frames 2/4.

### `const CAMEL` — 5 frames (66 wide × 62 tall)

```
  const CAMEL = [
    [ // frame 0 — standing (idle)
      '..................................................................',
      '..................................................................',
      '..................................................................',
      '.................................................O................',
      '..........................O.....................OBO...............',
      '.......................OOOWOOO.................OBSBO..............',
      '......................OWWWWWWWO................OSBSO...O..........',
      '.....................OWWWWWWWWWO................OBSSOOOBOOOO......',
      '...................OOWWWWWWWWWWO................OBSBBBSSBBSBOO....',
      '...................OWWWWWWWWWWWWO...O...........OBSBSSSBSSSSBBO...',
      '...................OWWWWWWWWWWWO.OOOBOOO.......OBBSBBBSBBBSBSSBO..',
      '...................OWWWWWWWWWWWWOBSBSBSBOO.....OBBSBBBSBOOSBBBSBOO',
      '...................OOWWWWWWWWWWWBSSSBSSSBBO....OBBSBBBSBOOSBBBBSBO',
      '.....................OWWWWWWWWWWSBSBBBSBSSBO..OBBBSBBBSBBBSBBBBBSO',
      '..................OOOBBKKKWKKKSBBBSBBBSBBBSBO..OBBSBBBSBBBSBBBBBBO',
      '................OOSBBBBKKKKKKKSBBBSBBBSBBBSSO..OBBSBBBSBBBSBSSSSBO',
      '...............OBBSSSRRKKKKKKKRRSSSBBBSBBBSBSOOBBBSBBBSBBSSSSSSSSO',
      '...............OSSSBSRRKKKKKKKRRSSSBBBSBBBSBBBSBBBSBBBSBSSSSSSOOOO',
      '..............OSBSSSRRRRRKKKKRRRRSSBBBSBBBSBBSSBBBSBBBSSSSSSOO....',
      '.............OSBBRRRRRRRRRRRRRRRRRSSBBSBBBSBBBSBBBSBBBSSSSOO......',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBSBBBSBBBSSSO........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBGGSBBBSBBBSBBSSSO.........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBGGBBBSBBBSBBSSSO.........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBGGBBSBBBSSSSSO..........',
      '............OBSBBRRRRRRRRRRRRRRRRRRRBBSBBBSGGBSBBBSSSSSO..........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBGGSBBBSSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBGGBBBSSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBGGBBSSSO............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBGGSSSO............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBBGGSO.............',
      '.........OOOOBSBBBSBRRRRRRRRRRRRRRRBBBSBBBSBBBSBSSGGO.............',
      '.......OOBSBBBGGBBSBBRRRRRRRRRRRRRSBBBSBBBSBBBSBSSSGO.............',
      '......OBBSSSSBGGBSSSBRROOOOOROOOOOSBSBSBBBSBBBSBSSSO..............',
      '.....OSSSBSBBBGGBBSBSRROOOOOROOOOOSBSBSBBBSSBBSBSSSO..............',
      '....OBSBBBBBBBGGBBBBBBLOOOOOLOOOOOBBSBBBBBBSBBBBSSO...............',
      '....OSBBBBBBBBGGBBBBBBLLLLLLLLLLLLBBSBBBBBBSBBBBSSO...............',
      '....OBBBBBBBBSGGBBBBBSLLLLLLLLLLLLBBSBBBBBBSBBBBSSSO..............',
      '...OBBBBBBBBBSGGBBBBBBLLLLLLLLLLLLBBSBBBBBBSBBBBSSO...............',
      '....OBBBBBBBBSGGBBBBBBLLLLLLLLLLLLBSSBBBBBSSBBBBSSO...............',
      '....OSSBBBBBBSGGBBBBBBLLLLLLLLLLLLBSSBBBBBSSBBBBSSO...............',
      '....OSSBBBSSSSSBBBBBBBLLLLLLLLLLLLSSSBBBBBSSBBBBSO................',
      '.....OSBBBSSSSSBBBBBBSLLLLLLLLLLLLSSSBBBBBSSBBBBSO................',
      '......OBBSSSSSSBBBBBBSLLLLLLLLLLLLSSSBBBBBSSBBBBO.................',
      '.......OBSSSSSSBBBBBBSLLLLLLLLLLLLSSSSSSSSSSBBBSO.................',
      '.......OBSOOOBOBBSSSSOLLLLLLLLLLLLOOOBBSSSSOBSSSO.................',
      '.......OBO...O.OBSSSO.OLLLLLLLLLLO...OBSSSO.OBSO..................',
      '.......OBO.....OBSSSO.OLLLOOOOOOOO...OBSSSO.OBSO..................',
      '......OBSO.....OBSSSO.OBSO...........OBSSSO.OBSO..................',
      '.....OBSO.....OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '....OBSSO.....OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '....OBSSO.....OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '....OBSSO.....OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '.....OBO......OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '......O.......OBSSSO..OBSO..........OBSSSO..OBSO..................',
      '..............OBSSSO..OBSO..........OBSSSO..OBSO..................',
      '..............OBSSSO..OBSO..........OBSSSO..OBSO..................',
      '..............OBSSSO.OBSSO..........OBSSSO.OBSSO..................',
      '..............OBSSSO.OBSSO..........OBSSSO.OBSSO..................',
      '.............OBBSSSO.OBSSO.........OBBSSSO.OBSSO..................',
      '.............OBBSSSO.OBSSO.........OBBSSSO.OBSSO..................',
      '.............OBBSSSO.OBSSO.........OBBSSSO.OBSSO..................',
      '.............OOOOOOO.OOOOO.........OOOOOOO.OOOOO..................',
    ],
    [ // frame 1 — contact A
      '..................................................................',
      '..................................................................',
      '..................................................................',
      '..................................................O...............',
      '..........................O......................OBO..............',
      '.......................OOOWOOO..................OBSBO.............',
      '......................OWWWWWWWO.................OSSSO...O.........',
      '.....................OWWWWWWWWWO.................OSBSOOOBOOOO.....',
      '...................OOWWWWWWWWWWO.................OSBBBSBSBSBBOO...',
      '...................OWWWWWWWWWWWWO...O............OSBBSSSBSSSSBBO..',
      '...................OWWWWWWWWWWWO.OOOBOOO........OBSBBBSBBBSBBSSBO.',
      '...................OWWWWWWWWWWWWOBSBSBSBOO......OBSBBBSBBOOBBBBSBO',
      '...................OOWWWWWWWWWWWBSSSBSSSBBO.....OBSBBBSBBOOBBBBBSO',
      '.....................OWWWWWWWWWWSBSBBBSBSSBO...OBBSBBBSBBBSBBBBBBO',
      '..................OOOBBKKKWKKKSBBBSBBBSBBBSBO...OBSBBBSBBBSBBBBBBO',
      '................OOSBBBBKKKKKKKSBBBSBBBSBBBSSO...OBSBBBSBBBSBBSSSSO',
      '...............OBBSSSRRKKKKKKKRRSSSBBBSBBBSBSO.OBBSBBBSBBBSSSSSSSO',
      '...............OSSSBSRRKKKKKKKRRSSSBBBSBBBSBBO.OBBSBBBSBBSSSSSSOOO',
      '..............OSBSSSRRRRRKKKKRRRRSSBBBSBBBSBBSOSBBSBBBSBSSSSSOO...',
      '.............OSBBRRRRRRRRRRRRRRRRRSSBBSBBBSBBBSBBBSBBBSBSSSOO.....',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBSBBBSBBBSSSSO.......',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBGGBBBSBBBSBBBSSSO........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBGGBBSBBBSBBBSSSO........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSGGBSBBBSBSSSSO.........',
      '............OBSBBRRRRRRRRRRRRRRRRRRRBBSBBBSBGGSBBBSBSSSSO.........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBGGBBBSSSSSO..........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBGGBBSSSSSO..........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBSGGBSSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBBGGSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBBSGGSO............',
      '.........OOOOBSBBBSBRRRRRRRRRRRRRRRBBBSBBBSBBBSBBSSGGO............',
      '.......OOBSBBBGGBBSBBRRRRRRRRRRRRRSBBBSBBBSBBBSBSSSSGO............',
      '......OBBSSSSBGGBSSSBRROOOOOROOOOOSBBBSBBBSBBBSBSSSSO.............',
      '.....OSSSBSBBBGGBBSBSRROOOOOROOOOOSBBBSBBBSBBBSBSSSSO.............',
      '....OBSBBBBBBBGGBBBBBBLOOOOOLOOOOOBBBBBBBSSBBBBBSSSO..............',
      '....OSBBBBBBBBGGBBBBBBLLLLLLLLLLLLBBBBBBBSSBBBBSSSSO..............',
      '....OBBBBBBBBSGGBBBBBSLLLLLLLLLLLLBBBBBBBSSBBBBSSSSO..............',
      '...OBBBBBBBBBSGGBBBBBBLLLLLLLLLLLLBBBBBBSSSBBBBSSSO...............',
      '....OBBBBBBBBSGGBBBBBBLLLLLLLLLLLLBSBBBSSSSBBBSSSSO...............',
      '....OSSBBBBBBSGGSBBBBBLLLLLLLLLLLLBSBBBSSSSBBBSSSSO...............',
      '....OSSSBBBSSSSSSBBBBBLLLLLLLLLLLLSSBBSSSSSBBSSSSO................',
      '.....OSSBBBSSSSSSBBBBBLLLLLLLLLLLLSSBBSSSSSBBSSSSO................',
      '......OSBBSSSSSSSBBBBBLLLLLLLLLLLLSSSBSSSSSBSSSSO.................',
      '.......OBBSSSSSSSBBBBBLLLLLLLLLLLLSSSSSSSSSBSSSO..................',
      '........OBSOOBOOBBSSSSLLLLLLLLLLLLOOBBSSSSOBSSSO..................',
      '........OBO..O..OBBSSSLLLLLLLLLLLO..OBSSSO.OBSSO..................',
      '........OBO.....OBBSSSOLLLLLOOOOOO.OBBSSSO.OBSO...................',
      '.......OBSO.....OBSSSO.OBSSO.......OBBSSSOOBSSO...................',
      '......OBSO......OBBSSSOOBSSO.......OBSSSO.OBSSO...................',
      '.....OBSSO......OBBSSSO.OBSO......OBBSSSO.OBSSO...................',
      '.....OBSSO......OBBSSSO.OBSO......OBBSSSO.OBSO....................',
      '.....OBSSO......OBBSSSO.OBSO......OBBSSSOOBSSO....................',
      '......OBO.......OBBSSSO.OBSSO.....OBSSSO.OBSSO....................',
      '.......O.........OBSSSO.OBSSO....OBBSSSO.OBSSO....................',
      '.................OBSSSO.OBSSO....OBBSSSO.OBSO.....................',
      '.................OBSSSO..OBSO....OBSSSO.OBSSO.....................',
      '.................OBSSSO..OBSO...OBBSSSO.OBSSO.....................',
      '.................OBSSSO..OBSSO..OBBSSSOOBSSSO.....................',
      '.................OBBSSSO.OBSSO..OBSSSO.OBSSO......................',
      '.................OBBSSSO.OBSSO.OBBSSSO.OBSSO......................',
      '.................OBBSSSO.OBSSO.OBBSSSO.OBSSO......................',
      '.................OOOOOOO.OOOOO.OOOOOOO.OOOOO......................',
    ],
    [ // frame 2 — pass A (bob)
      '..................................................................',
      '..................................................................',
      '..................................................................',
      '..................................................................',
      '.................................................O................',
      '..........................O.....................OBO...............',
      '.......................OOOWOOO.................OBSBO..............',
      '......................OWWWWWWWO................OSBSO...O..........',
      '.....................OWWWWWWWWWO................OBSSOOOBOOOO......',
      '...................OOWWWWWWWWWWO................OBSBBBSSBBSBOO....',
      '...................OWWWWWWWWWWWWO...O...........OBSBSSSBSSSSBBO...',
      '...................OWWWWWWWWWWWO.OOOBOOO.......OBBSBBBSBBBSBSSBO..',
      '...................OWWWWWWWWWWWWOBSBSBSBOO.....OBBSBBBSBOOSBBBSBOO',
      '...................OOWWWWWWWWWWWBSSSBSSSBBO....OBBSBBBSBOOSBBBBSBO',
      '.....................OWWWWWWWWWWSBSBBBSBSSBO..OBBBSBBBSBBBSBBBBBSO',
      '..................OOOBBKKKWKKKSBBBSBBBSBBBSBO..OBBSBBBSBBBSBBBBBBO',
      '................OOSBBBBKKKKKKKSBBBSBBBSBBBSSO..OBBSBBBSBBBSBSSSSBO',
      '...............OBBSSSRRKKKKKKKRRSSSBBBSBBBSBSOOBBBSBBBSBBSSSSSSSSO',
      '...............OSSSBSRRKKKKKKKRRSSSBBBSBBBSBBBSBBBSBBBSBSSSSSSOOOO',
      '..............OSBSSSRRRRRKKKKRRRRSSBBBSBBBSBBSSBBBSBBBSSSSSSOO....',
      '.............OSBBRRRRRRRRRRRRRRRRRSSBBSBBBSBBBSBBBSBBBSSSSOO......',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBSBBBSBBBSSSO........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBGGSBBBSBBBSBBSSSO.........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBGGBBBSBBBSBBSSSO.........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBGGBBSBBBSSSSSO..........',
      '............OBSBBRRRRRRRRRRRRRRRRRRRBBSBBBSGGBSBBBSSSSSO..........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBGGSBBBSSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBGGBBBSSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBGGBBSSSO............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBGGSSSO............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBBGGSO.............',
      '.........OOOOBSBBBSBRRRRRRRRRRRRRRRBBBSBBBSBBBSBBSGGO.............',
      '.......OOBSBBBGGBBSBBRRRRRRRRRRRRRSBBBSBBBSBBBSBBSSGO.............',
      '......OBBSSSSBGGBSSSBRROOOOOROOOOOSBSBSBBBSBBBSBBSSO..............',
      '.....OSSSBSBBBGGBBSBSRROOOOOROOOOOSBSBSBBBSSBBSBBSSO..............',
      '....OBSBBBBBBBGGBBBBBBBOOOOOBOOOOOBBSBBBBBBSBBBBBSO...............',
      '....OSBBBBBBBBGGBBBBBBLLLLLLLLLLLLBBSBBBBBSSBBBBBSO...............',
      '....OBBBBBBBBSGGBBBBBSLLLLLLLLLLLLBBSBBBBBSSBBBBBSSO..............',
      '...OBBBBBBBBBSGGBBBBBBLLLLLLLLLLLLBBSBBBBBSSBBBBBSO...............',
      '....OBBBBBBBBSGGBBBBBBLLLLLLLLLLLLBSSBBBBBSSBBBBBSO...............',
      '....OSSBBBBBBSGGBBBBBBLLLLLLLLLLLLBSSBBBBSSSBBBBBSO...............',
      '....OSSSBBBSSSSBBBBBBBLLLLLLLLLLLLSSSBBBBSSSBBBBSO................',
      '.....OSSBBBSSSSBBBBBBSLLLLLLLLLLLLSSSBBBBSSSBBBBSO................',
      '......OSBBSSSSSBBBBBBSLLLLLLLLLLLLSSSSSSSSSSBBBSO.................',
      '.......OBBBBBBSSSSSSSSLLLLLLLLLLLLBBBBBBSSSSSSSSO.................',
      '........OBSOOBOBBSSSSOLLLLLLLLLLLLOOOBBSSSSOBSSSO.................',
      '........OBO..O.OBSSSO.OLLLLLLLLLLO...OBSSSO.OBSSO.................',
      '........OBO...OBBSSSO.OLLLLLLLLLLO..OBBSSSO.OBSSO.................',
      '.......OBSO...OBBSSSO.OLLLLOOOOOOO..OBBSSSO.OBSSO.................',
      '......OBSO....OBBSSSO.OBSSO.........OBBSSSO.OBSSO.................',
      '.....OBSSO....OBSSSO..OBSSO.........OBSSSO..OBSSO.................',
      '.....OBSSO....OBSSSO..OBSSO.........OBSSSO..OBSSO.................',
      '.....OBSSO....OBSSSO..OBSSO.........OBSSSO..OBSSO.................',
      '......OBO....OBBSSSO..OBSSO........OBBSSSO..OBSSO.................',
      '.......O.....OBBSSSO..OBSSO........OBBSSSO..OBSSO.................',
      '.............OBBSSSO..OBSSO........OBBSSSO..OBSSO.................',
      '.............OBSSSO...OBSSO........OBSSSO...OBSSO.................',
      '.............OBSSSO...OBSSO........OBSSSO...OBSSO.................',
      '.............OBSSSO...OBSSO........OBSSSO...OBSSO.................',
      '............OBBSSSO...OBSSO.......OBBSSSO...OBSSO.................',
      '............OBBSSSO...OBSSO.......OBBSSSO...OBSSO.................',
      '............OOOOOOO...OOOOO.......OOOOOOO...OOOOO.................',
    ],
    [ // frame 3 — contact B
      '..................................................................',
      '..................................................................',
      '..................................................................',
      '................................................O.................',
      '..........................O....................OBO................',
      '.......................OOOWOOO................OBSBO...............',
      '......................OWWWWWWWO...............OSBSO...O...........',
      '.....................OWWWWWWWWWO...............OBBSOOOBOOOO.......',
      '...................OOWWWWWWWWWWO...............OBBSBBBSBBBBOO.....',
      '...................OWWWWWWWWWWWWO...O..........OBBSSSSSSSSSBBO....',
      '...................OWWWWWWWWWWWO.OOOBOOO......OBBBSBBBSBBBSSSBO...',
      '...................OWWWWWWWWWWWWOBSBSBSBOO....OBBBSBBBSOOBSBBSBOO.',
      '...................OOWWWWWWWWWWWBSSSBSSSBBO...OBBBSBBBSOOBSBBBSBO.',
      '.....................OWWWWWWWWWWSBSBBBSBSSBO.OSBBBSBBBSBBBSBBBBSO.',
      '..................OOOBBKKKWKKKSBBBSBBBSBBBSBO.OBBBSBBBSBBBSBBBBBO.',
      '................OOSBBBBKKKKKKKSBBBSBBBSBBBSSO.OBBBSBBBSBBBSSSSSBO.',
      '...............OBBSSSRRKKKKKKKRRSSSBBBSBBBSBSOSBBBSBBBSBSSSSSSSSO.',
      '...............OSSSBSRRKKKKKKKRRSSSBBBSBBBSBBBSBBBSBBBSSSSSSSOOOO.',
      '..............OSBSSSRRRRRKKKKRRRRSSBBBSBBBSBBSSBBBSBBBSSSSSOO.....',
      '.............OSBBRRRRRRRRRRRRRRRRRSSBBSBBBSBBBSBBBSBBBSSSOO.......',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBSBBBSBBSSSO.........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSGGBSBBBSBBBSBSSSO..........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBGGSBBBSBBBSBSSSO..........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBGGBBBSBBBSSSSO...........',
      '............OBSBBRRRRRRRRRRRRRRRRRRRBBSBBBGGBBSBBBSSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSGGBSBBBSSSO............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBGGSBBBSSSO............',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBGGBBBSSO.............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSGGSSSO.............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBGGSO..............',
      '.........OOOOBSBBBSBRRRRRRRRRRRRRRRBBBSBBBSBBBSBBGGO..............',
      '.......OOBSBBBGGBBSBBRRRRRRRRRRRRRSBBBSBBBSBBBSBBSGO..............',
      '......OBBSSSSBGGBSSSBRROOOOOROOOOOSBSSSBBBSBBBSBBSO...............',
      '.....OSSSBSBBBGGBBSBSRROOOOOROOOOOSBSSSBBBSBSBSBBSO...............',
      '....OBSBBBBBBBGGBBBBBBLOOOOOLOOOOOBBSSBBBBBBSBBBBSO...............',
      '....OSBBBBBBBBGGBBBBBBLLLLLLLLLLLLBBSSBBBBBBSBBBBSO...............',
      '....OBBBBBBBBBGGBBBBBSLLLLLLLLLLLLBBSSBBBBBBSBBBBSSO..............',
      '...OBBBBBBBBBBGGBBBBBBLLLLLLLLLLLLBBSSSBBBBBSSBBBSO...............',
      '....OBBBBBBBBBGGBBBBBBLLLLLLLLLLLLBSSSSBBBBBSSSBBSO...............',
      '....OSBBBBBBBBGGBBBBBBLLLLLLLLLLLLBSSSSBBBBBSSSBBSO...............',
      '....OSBBBSSSSBBBBBBBSBLLLLLLLLLLLLSSSSSBBBBBSSSSSO................',
      '.....OBBBSSSSBBBBBBBSBLLLLLLLLLLLLSSSSSBBBBBSSSSSO................',
      '......OBSSSSSBBBSBBSSBLLLLLLLLLLLLSSSSSBBBBBSSSSO.................',
      '......OBSSSSSBBBSBBSSBLLLLLLLLLLLLSSSSSSSSSBOSSSO.................',
      '......OBSOOOOBBBSSSSOBLLLLLLLLLLLLOOOOBBSSSO.OBSO.................',
      '......OBO....OBBSSSO.OLLLLLLLLLLLO....OBSSSO.OBSO.................',
      '......OBO....OBBSSSO.OLLLOOOOOOOOO....OBSSSO.OBSSO................',
      '.....OBSO....OBBSSSOOBSSO.............OBSSSO.OBSSO................',
      '....OBSO.....OBSSSO.OBSSO.............OBBSSSOOBSSO................',
      '...OBSSO....OBBSSSO.OBSSO.............OBBSSSO.OBSO................',
      '...OBSSO....OBBSSSO.OBSO..............OBBSSSO.OBSO................',
      '...OBSSO....OBBSSSOOBSSO..............OBBSSSO.OBSO................',
      '....OBO.....OBSSSO.OBSSO..............OBBSSSO.OBSSO...............',
      '.....O.....OBBSSSO.OBSSO...............OBSSSO.OBSSO...............',
      '...........OBBSSSO.OBSO................OBSSSO.OBSSO...............',
      '...........OBSSSO.OBSSO................OBSSSO..OBSO...............',
      '..........OBBSSSO.OBSSO................OBSSSO..OBSO...............',
      '..........OBBSSSOOBSSSO................OBSSSO..OBSSO..............',
      '..........OBSSSO.OBSSO.................OBBSSSO.OBSSO..............',
      '.........OBBSSSO.OBSSO.................OBBSSSO.OBSSO..............',
      '.........OBBSSSO.OBSSO.................OBBSSSO.OBSSO..............',
      '.........OOOOOOO.OOOOO.................OOOOOOO.OOOOO..............',
    ],
    [ // frame 4 — pass B (bob)
      '..................................................................',
      '..................................................................',
      '..................................................................',
      '..................................................................',
      '.................................................O................',
      '..........................O.....................OBO...............',
      '.......................OOOWOOO.................OBSBO..............',
      '......................OWWWWWWWO................OSBSO...O..........',
      '.....................OWWWWWWWWWO................OBSSOOOBOOOO......',
      '...................OOWWWWWWWWWWO................OBSBBBSSBBSBOO....',
      '...................OWWWWWWWWWWWWO...O...........OBSBSSSBSSSSBBO...',
      '...................OWWWWWWWWWWWO.OOOBOOO.......OBBSBBBSBBBSBSSBO..',
      '...................OWWWWWWWWWWWWOBSBSBSBOO.....OBBSBBBSBOOSBBBSBOO',
      '...................OOWWWWWWWWWWWBSSSBSSSBBO....OBBSBBBSBOOSBBBBSBO',
      '.....................OWWWWWWWWWWSBSBBBSBSSBO..OBBBSBBBSBBBSBBBBBSO',
      '..................OOOBBKKKWKKKSBBBSBBBSBBBSBO..OBBSBBBSBBBSBBBBBBO',
      '................OOSBBBBKKKKKKKSBBBSBBBSBBBSSO..OBBSBBBSBBBSBSSSSBO',
      '...............OBBSSSRRKKKKKKKRRSSSBBBSBBBSBSOOBBBSBBBSBBSSSSSSSSO',
      '...............OSSSBSRRKKKKKKKRRSSSBBBSBBBSBBBSBBBSBBBSBSSSSSSOOOO',
      '..............OSBSSSRRRRRKKKKRRRRSSBBBSBBBSBBSSBBBSBBBSSSSSSOO....',
      '.............OSBBRRRRRRRRRRRRRRRRRSSBBSBBBSBBBSBBBSBBBSSSSOO......',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBSBBBSBBBSSSO........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBGGSBBBSBBBSBBSSSO.........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBGGBBBSBBBSBBSSSO.........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBGGBBSBBBSSSSSO..........',
      '............OBSBBRRRRRRRRRRRRRRRRRRRBBSBBBSGGBSBBBSSSSSO..........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBGGSBBBSSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBGGBBBSSSSO...........',
      '.............OSBBRRRRRRRRRRRRRRRRRRSBBSBBBSBBBGGBBSSSO............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBGGSSSO............',
      '.............OSBBRRRRRRRRRRRRRRRRRRBBBSBBBSBBBSBSGGSO.............',
      '.........OOOOBSBBBSBRRRRRRRRRRRRRRRBBBSBBBSBBBSBSSGGO.............',
      '.......OOBSBBBGGBBSBBRRRRRRRRRRRRRSBBBSBBBSBBBSBSSSGO.............',
      '......OBBSSSSBGGBSSSBRROOOOOROOOOOSBSBSBBBSBBBSBSSSO..............',
      '.....OSSSBSBBBGGBBSBSRROOOOOROOOOOSBSBSBBBSSBBSBSSSO..............',
      '....OBSBBBBBBBGGBBBBBBBOOOOOBOOOOOBBSBBBBBBSBBBBSSO...............',
      '....OSBBBBBBBBGGBBBBBBLLLLLLLLLLLLBBSBBBBBBSBBBBSSO...............',
      '....OBBBBBBBBSGGBBBBBSLLLLLLLLLLLLBBSBBBBBBSBBBBSSSO..............',
      '...OBBBBBBBBBSGGBBBBBBLLLLLLLLLLLLBBSBBBBBBSBBBSSSO...............',
      '....OBBBBBBBBSGGBBBBBBLLLLLLLLLLLLBSSBBBBBBSBBBSSSO...............',
      '....OSBBBBBBBSGGBBBBBBLLLLLLLLLLLLBSSBBBBBBSBBBSSSO...............',
      '....OSBBBSSSSSSBBBBBBBLLLLLLLLLLLLSSSBBBBBBSBBBSSO................',
      '.....OBBBSSSSSSBBBBBBSLLLLLLLLLLLLSSSBBBBBBSBBBSSO................',
      '......OBSSSSSSSBBBBBBSLLLLLLLLLLLLSSSSSSSSBSBBBSO.................',
      '......OBBBBBBSSSSSSSSSLLLLLLLLLLLLBBBBBSSSSSSSSO..................',
      '......OBSOOOOBOBBSSSSOLLLLLLLLLLLLOOOBBSSSSOBSSO..................',
      '......OBO....O.OBSSSO.OLLLLLLLLLLO...OBSSSO.OBSO..................',
      '......OBO......OBSSSO.OLLLLLLLLLLO...OBSSSO.OBSO..................',
      '.....OBSO......OBSSSO.OLLLOOOOOOOO...OBSSSO.OBSO..................',
      '....OBSO.......OBSSSO.OBSO...........OBSSSO.OBSO..................',
      '...OBSSO.......OBBSSSOBSSO...........OBBSSSOBSSO..................',
      '...OBSSO.......OBBBBSSSSSO...........OBBBBSSSSSO..................',
      '...OBSSO.......OBBBBSSSSSO...........OBBBBSSSSSO..................',
      '....OBO........OBBBSSSSSO............OBBBSSSSSO...................',
      '.....O.........OBBBSSSSSO............OBBBSSSSSO...................',
      '...............OBBBSSSSSO............OBBBSSSSSO...................',
      '...............OBBBSSSSSO............OBBBSSSSSO...................',
      '..............OBBBBSSSSSO...........OBBBBSSSSSO...................',
      '..............OBBBBSSSSSO...........OBBBBSSSSSO...................',
      '..............OBBBBSSSSSO...........OBBBBSSSSSO...................',
      '..............OBBBBSSSSSO...........OBBBBSSSSSO...................',
      '..............OOOOOOOOOOO...........OOOOOOOOOOO...................',
    ],
  ];
```

### `const CAMEL_BARE` — standing reference (66 wide × 62 tall)

Rider/blanket omitted. Not rendered by the game; shown so the silhouette/anatomy is
readable and so a rider-less variant is available.

```
  const CAMEL_BARE = [
      '..................................................................',
      '..................................................................',
      '..................................................................',
      '.................................................O................',
      '................................................OBO...............',
      '...............................................OBSBO..............',
      '...............................................OSBSO...O..........',
      '................................................OBSSOOOBOOOO......',
      '................................................OBSBBBSSBBSBOO....',
      '....................................O...........OBSBSSSBSSSSBBO...',
      '.................................OOOBOOO.......OBBSBBBSBBBSBSSBO..',
      '...............................OOBSBSBSBOO.....OBBSBBBSBOOSBBBSBOO',
      '..............................OBBSSSBSSSBBO....OBBSBBBSBOOSBBBBSBO',
      '.....................O.......OSSSBSBBBSBSSBO..OBBBSBBBSBBBSBBBBBSO',
      '..................OOOBOOO...OBSBBBSBBBSBBBSBO..OBBSBBBSBBBSBBBBBBO',
      '................OOSBBSSBBOO.OSSBBBSBBBSBBBSSO..OBBSBBBSBBBSBSSSSBO',
      '...............OBBSSSBSSSBBOSBSBBBSBBBSBBBSBSOOBBBSBBBSBBSSSSSSSSO',
      '...............OSSSBBBSBBSSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBSSSSSSOOOO',
      '..............OSBBSBBBSBBBSSBBSBBBSBBBSBBBSBBSSBBBSBBBSSSSSSOO....',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSSSSOO......',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSSSO........',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBGGSBBBSBBBSBBSSSO.........',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBGGBBBSBBBSBBSSSO.........',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBBGGBBSBBBSSSSSO..........',
      '............OBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSGGBSBBBSSSSSO..........',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBGGSBBBSSSSO...........',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBGGBBBSSSSO...........',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBGGBBSSSO............',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBGGSSSO............',
      '.............OSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBGGSO.............',
      '.........OOOOBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBSSGGO.............',
      '.......OOBSBBBGGBBSBBBSBBBSBBBSBBBSBBBSBBBSBBBSBSSSGO.............',
      '......OBBSSSSBGGBBSBBBSBBBSBBBSBBSSSSBSBBBSBBBSBSSSO..............',
      '.....OSSSBSBBBGGBBSBBSSBBBSBBSSSSSSSSBSBBBSSBBSBSSSO..............',
      '....OBSBBBBBBBGGBBBBBSBBBBSBSSSSSSSSSBBBBBBSBBBBSSO...............',
      '....OSBBBBBBBBGGBBBBBSBBBBSSSSSSSSSSSBBBBBBSBBBBSSO...............',
      '....OBBBBBBBBSGGBBBBBSBBBBSSSSSSSSSSSBBBBBBSBBBBSSSO..............',
      '...OBBBBBBBBBSGGBBBBBSBBBBSSSSSSSSSSSBBBBBBSBBBBSSO...............',
      '....OBBBBBBBBSGGBBBBBSBBBBSSSSSSSSSSSBBBBBSSBBBBSSO...............',
      '....OSSBBBBBBSGGBBBBSSBBBBSSSSSSSSSSSBBBBBSSBBBBSSO...............',
      '....OSSBBBSSSSSBBBBBSSBBBBSSSSSSSSSSSBBBBBSSBBBBSO................',
      '.....OSBBBSSSSSBBBBBSSBBBBSSSSSSSSSSSBBBBBSSBBBBSO................',
      '......OBBSSSSSSBBBBBSSBBBBSSSSSSSSSSSBBBBBSSBBBBO.................',
      '.......OBSSSSSSBBBBBSSBBBBSSSSSSSSSSSSSSSSSSBBBSO.................',
      '.......OBSOOOBOBBSSSSOBSSSOBOOOOOOOOOBBSSSSOBSSSO.................',
      '.......OBO...O.OBSSSO.OBSO.O.........OBSSSO.OBSO..................',
      '.......OBO.....OBSSSO.OBSO...........OBSSSO.OBSO..................',
      '......OBSO.....OBSSSO.OBSO...........OBSSSO.OBSO..................',
      '.....OBSO.....OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '....OBSSO.....OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '....OBSSO.....OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '....OBSSO.....OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '.....OBO......OBBSSSO.OBSO..........OBBSSSO.OBSO..................',
      '......O.......OBSSSO..OBSO..........OBSSSO..OBSO..................',
      '..............OBSSSO..OBSO..........OBSSSO..OBSO..................',
      '..............OBSSSO..OBSO..........OBSSSO..OBSO..................',
      '..............OBSSSO.OBSSO..........OBSSSO.OBSSO..................',
      '..............OBSSSO.OBSSO..........OBSSSO.OBSSO..................',
      '.............OBBSSSO.OBSSO.........OBBSSSO.OBSSO..................',
      '.............OBBSSSO.OBSSO.........OBBSSSO.OBSSO..................',
      '.............OBBSSSO.OBSSO.........OBBSSSO.OBSSO..................',
      '.............OOOOOOO.OOOOO.........OOOOOOO.OOOOO..................',
  ];
```

## Silhouette / anatomy (shared per frame)

- **Two humps** (Bactrian): rear hump crest rows ~15–20, front hump crest rows ~11–17,
  valley centred ~col 29; lit `B` over `S` bulk with alternating tonal rows for fur.
- **Neck** rising right (rows ~18–34) into a raised **head** (rows ~5–20) with a
  right-pointing **muzzle** (cols ~58–65) and an **ear** nub (rows ~4–10).
- **Eye**: readable `O` block at sprite-local `(56, 11)` (+neck/+bob offsets) on the head.
- **Harness** `G`: neck→chest strap plus a short girth strap on the flank; the
  **reins** run from the rider's fore hand to the neck.
- **Tail**: thin `S`/`O` line hanging from the rump with a small **tuft**; the tuft
  flicks ±1 px between frames.
- **Legs**: two visible legs (rear + front; far-side pair hinted by the same shape),
  `O`-edged shanks with `B`/`S` tonal split, **cleaner knees** (a single `O` crease row)
  and flat **hooves** on row 61.
- **Rider**: white `W` turban, `K` face, lane-colour `R` robe with arms, seated on the
  back; dark `O` boots at the feet; reins `G` to the head.

## High-detail rendering notes

- **Bristle shading** — each vertical run of body is painted top-lit: rows 0–1 `B`
  (lit crest), row 2 `S` (crest shadow), then `B` down to ~62 % of the run and `S`
  below; sparse `S` fur ticks (`x % 4 == 2`) streak the humps/neck. This doubles the
  number of tonal rows vs v4 without adding legend chars.
- **Knees/hooves** — leg tone split lit-from-the-left (left ~45 % `B`, rest `S`) with a
  flat 5 px `O` hoof block on the bottom row.
- **Eye** — a 2×2 `O` mark, clearly readable at 1× on sand.
- **Tail tuft** — rounded `S`/`O` tuft that flicks between frames.

## Gait & timing

```
contact A ──► pass A ──► contact B ──► pass B ──┐
    ▲                                            │
    └────────────────────────────────────────────┘
```

- Cycle = 4 walk frames × **320 ms** ≈ **1280 ms**; idle = frame 0, **no idle motion**.
- Index while animating: `(Math.floor(now / 320) % 4) + 1`, else `0`.
- **Contact** (1, 3): hooves stride (rear/front swap lead), head/neck block shifts
  `+1` px (frame 1) / `-1` px (frame 3); tail tuft swings.
- **Pass** (2, 4): whole body drops **1 px** (the bob) while the feet stay on row 61;
  A/B poses differ in hoof placement and tail flick (no duplicate frames).
- Only **legs, head/neck, tail, blanket and the 1 px bob** move. Humps and body outline
  stay put → no silhouette jitter.

## Saddle blanket + number

- **Blanket** `L` = cols **22–33**, rows **34–46** (standing); on bob frames (2, 4) it
  shifts **+2 px** (rows 36–48) so the code's `+2` digit offset lands inside the flat
  area. Drawn *after* legs/rider; the rider's dark `O` boots are drawn last, above the blanket.
- **Digit area** = flat `L` at cols **24–29** × rows **36–45** (10 tall) on frames
  0/1/3, and rows **38–47** on bob frames 2/4. Verified flat `L` on all five frames.
- **Digit** = **6 × 10 px** (anchor below), drawn by code **after** the sprite.
  Draw the camel's 1-based **lane index**; fall back to `0` if index > 8.
- Sprite-local **anchor = `(24, 36)`** (col, row); on bob frames add **`+2`** to the row.

```
 1      2      3      4      5      6      7      8      9      0
.#.    ###    ###    #.#    ###    ###    ..#    ###    ###    ###
##.    ..#    ..#    #.#    #..    #..    ..#    #.#    #.#    #.#
.#.    ###    ###    ###    ###    ###    ..#    ###    ###    #.#
.#.    #..    ..#    ..#    ..#    #.#    ..#    #.#    ..#    #.#
###    ###    ###    ..#    ###    ###    ..#    ###    ###    ###
```

## Digit font (6×10)

- Glyph grid **6 wide × 10 tall**. Each glyph is an **exact 2× nearest-neighbour
  upscale** of the existing **3×5 `DIGIT_FONT`** in `index.html` (single source of
  truth) — do **not** author a second table: every `#` in the 3×5 glyph becomes a
  **2×2** block, every `.` a 2×2 transparent block.
- Anchor pinned **sprite-local `(24, 36)`**; **`+2` rows** on bob frames `2, 4`.
- Colour `#123a44` (`#123a44` on `#bfe3ea` = contrast **8.98** ≥ AA 4.5).

## Implementer notes

- **Constants**: `SPRITE_W = 66`, `SPRITE_H = 62`, buffer **1280×720**,
  `HORIZON_Y = 120`, `LANE_BOTTOM = 712` (720 − 8), `LANE_MARGIN = 4`,
  `ANIM_FRAME_MS = 320` (walk cycle `1280 ms` when `ANIM_MS ≥ 1280`).
- **Palette factory** (unchanged keys):

  ```js
  const CAMEL_PAL = (robe) => ({
    outline:'#1a1208', body:'#c9803a', shade:'#8a5220', harness:'#53565e',
    robe: laneColor, white:'#f0ece0', skin:'#d8a878', blanket:'#bfe3ea',
  });
  ```
- **`drawSprite` legend**: route *every* char through the sprite palette
  (`O→outline, B→body, S→shade, G→harness, R→robe, W→white, K→skin, L→blanket`;
  `.` skipped), falling back to the fixed `COL` for decoration sprites.
- **Digit anchor + draw**: for camel v5 the blanket anchor is
  `CAMEL_ANCHOR = { x: 24, y: 36 }`. `drawBlanketNumber` draws the 2×-upscaled glyph at
  `left + 24 + rx*2`, `top + 36 + (frameIndex===2||frameIndex===4 ? 2 : 0) + ry*2`,
  `fillRect(..., 2, 2)`. **Note for Task 7/Task 8:** the plan's placeholder
  `+ 11 / + 12` and the `render.spec.js` digit sample offsets are v4 values — replace
  them with the pinned `+ 24 / + 36` (and `6×10` sample) here.
- **Lane math**: `camelTopY(i,n) = laneBottomY(i,n) - SPRITE_H - 2` keeps the feet 2 px
  above the lane bottom. At `n = 8`, `laneHeight = 74.0 px`; the 62 px sprite with ±2 px
  dunes and the 1 px bob leaves **12 px slack** (no clamp).
- **`camelTargetLeft` clamp** uses `SPRITE_W = 66`.

## Validation (run on the matrices above)

A throwaway Python validator (gitignored, `test-results/ux-tmp/camel_v5_gen.py`) was run
on the matrices above, **all checks pass**:

| Check | Result |
|---|---|
| exact 62 rows × 66 chars (all frames) | ✓ |
| legend-only chars (`. O B S G R W K L`) | ✓ |
| outline encloses body (no fill 4-adjacent to exterior `.`) | ✓ |
| single 4-connected blob (no isolated pixels) | ✓ |
| no strays / no border fill | ✓ |
| feet present on the bottom row (row 61) every frame | ✓ |
| painted bbox within 66 × 62 | 63×59, 63×59, 63×58, 62×59, 63×58 |
| all 5 poses pairwise distinct (IoU < 0.98) | ✓ (closest pair **pass A vs pass B = 0.913**) |
| digit area flat `L` on all 5 frames (incl. bob pair) | ✓ |
| digit area at anchor col/row in the ceiling matrix | ✓ (cols 24–29 × rows 36–45 / 38–47) |

Frame-similarity (IoU, dressed set; 1.000 = identical):

```
              stand  cA     pA     cB     pB
standing      1.000  0.863  0.899  0.860  0.902
contactA      0.863  1.000  0.823  0.795  0.839
passA         0.899  0.823  1.000  0.804  0.913
contactB      0.860  0.795  0.804  1.000  0.837
passB         0.902  0.839  0.913  0.837  1.000
```

Closest pair is **pass A vs pass B = 0.913** (< 0.98): the two pass poses differ in hoof
placement and tail flick. No pair reaches 0.98 → **no duplicate frames**. The 4 walk
frames loop sensibly `1→2→3→4→1`, alternating contact/pass with the body bob on 2/4.

Measured painted-pixel counts (frame 0): total **2099** (`B` 690, `S` 507, `O` 364,
`R` 249, `L` 135, `W` 84, `G` 39, `K` 31). Use these to derive any "idle bodies" tally
threshold in `render.spec.js` (a single camel body `#c9803a` = **690 px**; 4 lanes
≈ 2760; 8 lanes ≈ 5520).

Enclosure method: fill (`B/S/G/R/W/K/L`) 4-adjacent to *exterior* `.` is recolored to `O`
(concave notches and inter-leg gaps stay open; border fill banned outright).

## v5 geometry (buffer 1280×720, sprite 66×62, 8 lanes)

| Constant | Value | Derivation |
|---|---|---|
| Buffer | **1280 × 720** (16:9) | spec (2× the old 640×360) |
| `SPRITE_W` / `SPRITE_H` | **66 / 62** | exact v5 matrix dims (bbox 62–63 × 58–59) |
| `HORIZON_Y` | **120** | spec |
| `LANE_BOTTOM` | **712** | 720 − 8 |
| Lane region | **592** | `712 − 120` |
| Lane height (n=8) | **74.0 px** | `592 / 8` |
| Lane height (n=4) | **148.0 px** | `592 / 4` |
| `LANE_MARGIN` | **4** | spec |
| `TERRAIN_FEET_OFFSET` | **2** | unchanged |
| Terrain amplitude | **±2 px** | unchanged (`A1=1.2, A2=0.8`) |
| `ANIM_FRAME_MS` | **320** | gait cycle 1280 ms; frame order 1→2→3→4→1 |

8-lane fit: `laneHeight(8) − SPRITE_H = 74 − 62 = 12 px` slack, vs ±2 px dunes + 1 px bob.

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
The brown camel (`#c9803a`) on `duneTop` is only 1.33 — acceptable because the
camel's dark outline reads at **7.76** against the sand (see acceptance criteria).

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

Only `R` changes per camel. `K`/`W`/`L`/`O`/`B`/`S`/`G` are fixed, so the silhouette,
face, turban, blanket and harness stay identical and every robe colour reads clearly.
The gitignored `camel-v5-dressed.png` proves red/blue/green robes and digits 1–8 at 4×.

## Acceptance criteria (Playwright-testable)

1. **Sprite size** — for lane 0 with any score, the painted camel's bounding box is
   ≤ 66 px wide and ≤ 62 px tall.
2. **Feet on the lane** — the camel's lowest painted row equals
   `laneBottomY(0, n) - 2` (± dune `h`, clamped inside the lane); feet on row 61 of the
   sprite.
3. **Standing frame** — with no score change, sampling the lane returns frame 0 (the
   standing matrix); no idle motion between two rAF ticks.
4. **Walk cycle** — after a score change, the frame index advances `1→2→3→4→1` at
   320 ms steps and returns to 0 after `ANIM_MS`.
5. **Bob** — on frames 2/4 the body (and blanket) is 1 px (2 px for the blanket) lower
   than frame 0; the feet remain on the bottom row.
6. **Palette-swap** — blanket pixels are `#bfe3ea` for every camel; rider-robe pixels
   equal the camel's lane colour; harness pixels are `#53565e` in every lane.
7. **Number** — the pixels at sprite-relative cols **24–29 / rows 36–45**
   (+2 rows on frames 2 and 4) match the 2×-upscaled 6×10 glyph for the camel's 1-based
   lane number, colour `#123a44`.
8. **Fixed tones** — body pixels are `#c9803a` and outline pixels `#1a1208` in every lane.
9. **Dune profile** — sampling the crest line gives the same `h(x)` for every lane;
   `|h| ≤ 2` for all `x`; two samples `x` and `x+1` differ by ≤ 1.
10. **Readability** — with the camel on `duneTop`, at least one outline pixel `#1a1208`
    stays adjacent to the camel in x so the silhouette reads (contrast 7.76).

## Selection & history

**T2 (Two-hump Bactrian)** was chosen by the user from `docs/art/camel-drafts-v2.md` on
**2026-10-04**, over the v3 single-hump design. **v5 (`66×62`)** promotes v4 to the
1280×720 buffer with more detailed tonal shading; v4 (`33×31`) is retained below.

| Version | Size | Notes |
|---|---|---|
| v3 | 34×24 | single-hump draft (deleted after promotion) |
| v4 | 33×31 | two-hump Bactrian, 640×360 buffer, 3×5 digit |
| **v5** | **66×62** | 1280×720 buffer, high-detail tonal shading, 6×10 digit |

v3 history: **Draft A** had been chosen from `docs/art/camel-drafts.md` on 2026-10-03
(a 34×24 single-hump design; drafts doc deleted after promotion).

## Appendix A — v4 matrices (superseded, `33×31`)

Kept for history/diff. Not rendered (v5 supersedes). 31 rows × 33 chars.

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
