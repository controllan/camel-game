# Persistence & Themes Implementation Plan

> **For agentic workers:** execute this plan via the orchestrator loop: implement → verify → `code-reviewer` → `git-expert` commit. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restore the whole game across reloads via `localStorage` (`camelRace.v1`) and add a registry-driven two-theme system (**desert** camel / **forest** boar) switchable mid-race without losing scores, all at a `1280×720` buffer.

**Architecture:** Art is re-authored first (camel v5 `66×62`, boar `≤76×70`, forest decor, 2× desert/decor/fonts) and pinned in `docs/art/`. Then pure `window.GameCore` gains persistence (`serialize`/`deserialize`/validation) plus a `theme` field; `window.GameStorage` wraps `localStorage` (probe + try/catch). `#app` boots by restoring before the first paint, wires debounced saves (200 ms) + flush on `pagehide`/`visibilitychange`, and renders one active theme from a `THEMES` registry. Canvas buffer rises `640×360 → 1280×720`.

**Tech Stack:** plain ES2020 JavaScript (no build, no TypeScript), HTML5 Canvas 2D, dev-only `@playwright/test` + pnpm, Node builtins (`node:http`,`node:fs`) for the local storage-test server.

**Spec:** `docs/specs/2026-10-04-persistence-and-themes-design.md`

## Global Constraints

- Deliverable: ONE runtime file `index.html` at repo root. Zero runtime dependencies, no build step, no external assets, no network access.
- Must work opened directly from `file://`, offline. Persistence degrades to in-memory when `localStorage` is unavailable.
- Dev tooling lives in `tests/`, `package.json`, `playwright.config.js`; dev files MUST NOT modify or be required by `index.html`. Dev dep `@playwright/test` only; pnpm; CommonJS test code. No new dev dependencies (server uses `node:http`/`node:fs`/`node:path`).
- Canvas buffer exactly `1280×720` (`<canvas width="1280" height="720">`). `ctx.imageSmoothingEnabled = false`; CSS `image-rendering: pixelated`. Display `scale = min(availW/1280, availH/720)`, `SCALE_MAX = 2`, snap `SNAP_TOLERANCE = 0.08`, floor `SCALE_EPSILON = 0.05`; never distorted, 16:9, page never scrolls.
- Geometry: `HORIZON_Y = 120`, `LANE_BOTTOM = CANVAS_H − 8 = 712`, lane region `592`, `laneHeight(8) = 74.0`, `laneHeight(4) = 148.0`, `LANE_MARGIN = 4`, `TERRAIN_FEET_OFFSET = 2`. Terrain `A1=1.2, L1=160, PH1=0, A2=0.8, L2=130, PH2=1.7`, amplitude `±2` (not doubled).
- Sprite budget: camel v5 `66×62`; boar `≤76×70` (incl. 1 px bob). 8-lane slack `74 − 70 = 4` px; `camelTopY` clamp never activates.
- Digit font `6×10` = exact 2× nearest-neighbour upscale of the existing `3×5` `DIGIT_FONT` (one source of truth).
- Palette (lane colour order, theme-independent): `#e84a3a #3a6ae8 #3aa84a #e8c83a #9a4ae8 #e88a3a #3ad8d8 #e85a9a`. Lane id `"camel-" + laneIndex`. Colour derived from `PALETTE[laneIndex % 8]`, never stored.
- Persistence key `camelRace.v1`, single JSON string, `version` exactly `1`. Debounce `200 ms`; synchronous flush on `pagehide` + `visibilitychange` when hidden.
- Decor seeded `mulberry32(hash2(SEED, k))`, `SEED = 1337`; `decor.spacing = 90`, `decor.maxSpan = 1500`; no `Math.random`.
- Goal `1–10000` (default `200`) or `null` iff infinite; camel count `2–8` (default `4`); names trimmed, sanitized, `≤ 16`, default `Team {n}`.
- Themes `desert` + `forest`, registry-driven, selection persisted. No per-theme scores.
- Art procedural; `wildschwein-pixelart.jpeg` stays gitignored, never linked/embedded/loaded. Only matrices committed.
- No `TBD`/`TODO`/placeholders. No artificial delays/sleeps in code/tests — wait on conditions. Values copied verbatim from spec.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `docs/art/camel-sprite.md` | Camel v5 `66×62` matrices, legend, digit `6×10` rule (authoritative art) | 1 |
| `docs/art/boar-sprite.md` | NEW — boar `≤76×70` trace method, legend, matrices, hunter rider, similarity evidence | 2 |
| `docs/art/wildschwein-sprite-DRAFT.md` | DELETE (superseded by boar-sprite.md) | 2 |
| `docs/art/theme-art.md` | NEW — 2× re-authored desert decor, forest decor set, milestone/finish/sun, digit `6×10` rule | 3 |
| `tests/server.js` | NEW — local static HTTP server (node builtins, ephemeral port) for storage tests | 4 |
| `index.html` `#core` | `GameCore` + persistence (`serialize`/`deserialize`/`applyFields`/`setTheme`) + `GameStorage` | 5,6 |
| `index.html` `#app` | boot restore, debounced save + flush, geometry `1280×720`, `THEMES` registry, decor/animal render, selector UI | 6–10 |
| `tests/unit.spec.js` | GameCore unit incl. `deserialize` validation; updated buffer defaults | 5,7 |
| `tests/storage.spec.js` | NEW — HTTP-served persistence round-trip, reload, degradation | 6 |
| `tests/render.spec.js` | Renderer incl. `1280×720`, camel v5, digit `6×10`, lane fit | 7,8 |
| `tests/perf.spec.js` | NEW — ≥55 fps over ≥120 rAF frames, 8 lanes | 7 |
| `tests/theme.spec.js` | NEW — theme switch/persist, forest decor + boar, desert unchanged | 8,9,10 |
| `tests/app.spec.js` | App-level scale rule, a11y, no network (updated to `1280×720`) | 7,10,11 |
| `tests/controls.spec.js` | Controls/i18n (updated banner band) | 7,10 |
| `tests/goal.spec.js` | Goal end state (updated geometry bands) | 7 |
| `README.md` | Run/play/test + persistence + themes | 11 |

**Module (script) order inside `index.html` (fixed):** `#core` (state + persistence) → `#app` (geometry → i18n → UI controller → `THEMES` registry + art → renderer → boot block). `#app`'s boot block (restore + subscribe + first `syncDom`) moves to the END of the script so `THEMES` exists before restore.

**Shared API names (identical across all tasks — do not rename):**

- `window.GameCore` (existing): `addScore`, `setScore`, `setCamelCount`, `setGoal`, `resetRace`, `setLanguage`, `setCamelName`, `setClock`, `getState`, `subscribe`, `camelName`, `computeCameraWindow`, `mapScoreToScreenX`, `terrainHeightAt`, constants `PALETTE, NAME_TEMPLATES, MIN_CAMELS, MAX_CAMELS, GOAL_MIN, GOAL_MAX, PAD, MIN_WINDOW, GOAL_SLACK, ANIM_MS, TERRAIN`.
- `window.GameCore` (NEW): `serialize()`, `deserialize(raw) → {fields, writeBack}`, `applyFields(fields)`, `setTheme(id)`, `getThemeIds() → string[]`, `registerThemeIds(ids)`, `storageAvailable()`, constants `KEY="camelRace.v1"`, `VERSION=1`.
- `window.GameStorage`: `{ KEY, VERSION, available(), load(), save(), clear() }`.
- `GameCore.getState()` now also returns `theme` (`'desert'|'forest'`).
- `window.GameDebug` (existing): `getState`, `getCameraWindow`, `getCanvasSize`, `getCanvasLayout`, `getCamelSpriteBounds`, `isSettled`, `getScene`. NEW: `getTheme() → {id, animalId, w, h}`; `getScene()` additionally returns `decorKinds: string[]`.
- `THEMES[id]` shape (both entries identical): `{ id, label:{en,de}, palette:{sky:[hex,...], sun, sunRim, accent}, ground:{top,shade,edge,rim}, decor:{spacing,maxSpan,kinds:[{kind,weight,sprite,pal,yOffset}]}, animal:{id,sprite,pal,w,h,rider,blanket:{anchor:{x,y},w,h,digitColor},bobOffset}, laneFit:{spriteHMax,laneMinPx} }`.
- `I18N` NEW keys: `themeLabel`, `themeDesert`, `themeForest`.
- DOM ids NEW: `#themeToggle` (`role="group"` + `aria-label`), `#theme-desert`, `#theme-forest`.
- `tests/server.js` exports `startServer(root?) → Promise<{url, close()}>`.

## Verification (used by every task)

```bash
pnpm install
pnpm exec playwright install chromium
pnpm test
```

Single file: `pnpm exec playwright test tests/<file>.spec.js` (swap filename per task).

---

### Task 1: Camel v5 art `66×62` — matrices + doc (ux-ui-designer)

**Files:**
- Modify: `docs/art/camel-sprite.md` (v4 → v5: new size, matrices, digit `6×10` rule)

**Interfaces:**
- Consumes: nothing (art-only; no game code touched).
- Produces: authoritative matrices for the constants `CAMEL` (5 frames, each `62` rows × `66` chars), `CAMEL_PAL(robe)` keys `{outline, body, shade, harness, robe, white, skin, blanket}`, and blanket anchor `{x, y}`; exact hex tones below. Task 7 copies these verbatim into `index.html`.

**Authoring rules (spec verbatim):**
- Size exactly `66×62` buffer px (matrix `62` rows × `66` chars each); painted bbox `≤ 66×62`.
- 5 frames: 1 standing + 4 distinct walk (`contact A → pass A → contact B → pass B`); 1 px bob on pass frames `2,4`; feet on the bottom row (`row 61`) every frame.
- Legend: `. O B S G R W K L`; only `R` (rider robe) is per-lane. Tones: `outline #1a1208`, `body #c9803a`, `shade #8a5220`, `harness #53565e`, `white #f0ece0`, `skin #d8a878`, `blanket #bfe3ea`, digit ink `#123a44`, robe = lane colour.
- Enclosure pass + single 4-connected blob + no border fill (method in v4 doc).
- Blanket digit area flat `L` `6 wide × 10 tall` (the `6×10` glyph space). Digit drops `2 px` with the body on bob frames `2,4`.
- Shared 8-colour lane palette (Global Constraints) for `robe`.

- [ ] **Step 1: Author matrices into `docs/art/camel-sprite.md` v5**

Rewrite the Size row to `**66 × 62**`; replace the matrices section with the 5 v5 frames; set `HORIZON_Y` context line to `120`, `LANE_BOTTOM` to `712`, lane height at 8 lanes to `74.0 px`. Add a **Digit font** section stating: glyph grid `6×10`, drawn as an exact 2× nearest-neighbour upscale of the existing `3×5` `DIGIT_FONT` (single source of truth), anchor `blanket.anchor = {x, y}` pinned explicitly, `+2` row on bob frames 2/4.

- [ ] **Step 2: Run the matrix validator (throwaway Python; not committed)**

```bash
python3 - <<'PY'
import re, sys
# Paste the 5 v5 matrices (list of list of str) between the markers.
MATRICES = [FRAME0, FRAME1, FRAME2, FRAME3, FRAME4]  # filled from the doc
LEGEND = set('.OBSGRWKL')
def check(m):
    assert all(len(r) == 66 for r in m), ('width', {len(r) for r in m})
    assert len(m) == 62, ('rows', len(m))
    for r in m:
        assert set(r) <= LEGEND, ('legend', set(r) - LEGEND)
    # enclosure: no fill (non-'.') 4-adjacent to exterior '.' via flood fill
    H, W = len(m), len(m[0])
    ext = [[False]*W for _ in range(H)]
    stack = []
    for x in range(W):
        for y in (0, H-1):
            if m[y][x] == '.': stack.append((x, y))
    for y in range(H):
        for x in (0, W-1):
            if m[y][x] == '.': stack.append((x, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= W or y >= H or ext[y][x] or m[y][x] != '.': continue
        ext[y][x] = True
        stack += [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
    for y in range(H):
        for x in range(W):
            if m[y][x] == '.': continue
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x+dx, y+dy
                if 0 <= nx < W and 0 <= ny < H and m[ny][nx] == '.' and ext[ny][nx]:
                    sys.exit(f'enclosure leak at {(x,y)}')
    # single 4-connected blob of non-'.' cells
    seen = set(); cells = {(x, y) for y in range(H) for x in range(W) if m[y][x] != '.'}
    stack = [next(iter(cells))]
    while stack:
        c = stack.pop()
        if c in seen or c not in cells: continue
        seen.add(c); x, y = c
        stack += [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
    assert seen == cells, f'blob: {len(seen)}/{len(cells)}'
    # feet on bottom row
    assert any(m[61][x] != '.' for x in range(W)), 'no feet on row 61'
    return cells
sets = [check(m) for m in MATRICES]
# distinct poses: pixel similarity (identical/total-union) must stay < 0.98 pairwise
for i in range(5):
    for j in range(i+1, 5):
        a, b = sets[i], sets[j]
        sim = len(a & b) / max(1, len(a | b))
        assert sim < 0.98, f'frames {i},{j} too similar: {sim:.3f}'
print('camel v5: OK (dims, legend, enclosure, blob, feet, distinct poses)')
PY
```

Expected: `camel v5: OK (dims, legend, enclosure, blob, feet, distinct poses)`.

- [ ] **Step 3: Render preview PNGs into the gitignored `test-results/ux-tmp/`**

Render each frame at 8× on `#c9a25a` (dune) and a dressed strip (robes `#e84a3a/#3a6ae8`, digits 1–8), writing `test-results/ux-tmp/v5-frames.png` and `test-results/ux-tmp/v5-dressed.png`. `test-results/` is gitignored and **wiped by every Playwright run** — copy any PNG needed for human review out of `test-results/` before running `pnpm test`.

- [ ] **Step 4: Commit** (executed by `git-expert` in orchestrator loop)

```bash
git add docs/art/camel-sprite.md
git commit -m "art: author camel v5 sprite (66x62) and 6x10 digit rule"
```

---

### Task 2: Boar art `≤76×70` traced from reference + new doc (ux-ui-designer)

**Files:**
- Create: `docs/art/boar-sprite.md`
- Delete: `docs/art/wildschwein-sprite-DRAFT.md`

**Interfaces:**
- Consumes: camel v5 conventions (Task 1) — same legend discipline, enclosure pass, 5-frame gait, digit convention.
- Produces: authoritative matrices for the constant `BOAR` (5 frames, each `70` rows × `≤76` chars), `BOAR_PAL(laneColor)` factory keys `{outline, body, shade, highlight, ear, tusk, eye, legs, robe, skin, cap, blanket}`, and `blanket.anchor`. Task 9 copies these verbatim into `index.html`.

**Authoring rules:**
- Traced from `wildschwein-pixelart.jpeg` (repo root, `448×362`, faces **right**). The JPEG is gitignored (`.gitignore` rule `wildschwein-pixelart.jpeg`) and MUST NOT be committed, linked, or loaded at runtime.
- Height cap `70 px` incl. `1 px` bob; width `≤76 px`. Feet on bottom row.
- Rider = **hunter** (green cap/hood `cap #2f6b3a`, skin head, lane-colour tunic `robe`, reins). Saddle blanket `L #bfe3ea` + digit ink `#123a44`; digit area flat `6 wide × 10 tall`.
- Trace method: render the reference silhouette to the target grid, `similarity = |trace ∩ reference| / |trace ∪ reference| ≥ 0.90` (silhouette overlap, IoU). Record the measured value in the doc.

- [ ] **Step 1: Trace + author matrices into `docs/art/boar-sprite.md`**

Doc sections: Size table (`w ≤ 76`, `h ≤ 70`, 5 frames), reference note (gitignored JPEG, never loaded), legend table (chars + hex + per-lane flag for `R`), trace method, matrices (5 frames), rider spec, blanket anchor, similarity evidence.

- [ ] **Step 2: Run the similarity validator (throwaway Python; requires Pillow, dev-only; not committed)**

```bash
python3 - <<'PY'
from PIL import Image
import sys
IMG = Image.open('wildschwein-pixelart.jpeg').convert('L')   # gitignored reference, read-only
TRACE = [FRAME0, FRAME1, FRAME2, FRAME3, FRAME4]              # from the doc
# Reference silhouette target: threshold dark pixels, crop painted bbox, resize
# (nearest) to the trace grid.
px = IMG.load()
W, H = IMG.size
mask = Image.new('1', (W, H), 0)
mp = mask.load()
for y in range(H):
    for x in range(W):
        if px[x, y] < 110: mp[x, y] = 1
bbox = mask.getbbox()
ref = mask.crop(bbox).resize((len(TRACE[0][0]), len(TRACE[0])), Image.NEAREST)
def cells(m):
    return {(x, y) for y in range(len(m)) for x in range(len(m[y])) if m[y][x] != '.'}
for i, m in enumerate(TRACE):
    assert len(m[0]) <= 76 and len(m) <= 70, ('size', len(m[0]), len(m))
    t = cells(m)
    r = {(x, y) for y in range(ref.height) for x in range(ref.width) if ref.getpixel((x, y))}
    iou = len(t & r) / max(1, len(t | r))
    assert iou >= 0.90, f'frame {i} silhouette IoU {iou:.3f} < 0.90'
    print(f'frame {i}: IoU {iou:.3f}')
print('boar: silhouette overlap >= 0.90 for all frames')
PY
```

Expected: five `frame N: IoU 0.9xx` lines then `boar: silhouette overlap >= 0.90 for all frames`.

- [ ] **Step 3: Preview PNGs in gitignored `test-results/ux-tmp/`**

Write `test-results/ux-tmp/boar-frames.png` (5 frames 8×) and `boar-dressed.png`. Reference JPEG bytes are never written into the repo or docs.

- [ ] **Step 4: Delete the superseded draft doc**

```bash
git rm docs/art/wildschwein-sprite-DRAFT.md
```

- [ ] **Step 5: Commit**

```bash
git add docs/art/boar-sprite.md
git commit -m "art: add traced boar sprite (<=76x70) and drop superseded draft"
```

---

### Task 3: 2× decor, fonts, and sky art — desert re-author + forest set (ux-ui-designer)

**Files:**
- Create: `docs/art/theme-art.md`
- Modify: `docs/art/camel-sprite.md` (dune/lane tokens note for `1280×720` only if changed)

**Interfaces:**
- Consumes: Tasks 1–2 (animal conventions).
- Produces: matrices for `PALM`, `CACTUS`, `ROCK` (desert, ≈2× the 640×360 versions), `FOREST_TREE`, `MUSHROOM`, `MOSS`, `STONE`, `PINE_NEEDLES` (forest), `FINISH_FLAG`, `MILESTONE` (≈2×), and the sun/sky band spec for the `120 px` sky. Tasks 7–9 copy these verbatim into `index.html`.

**Authoring rules:**
- Desert decor (`PALM`, `CACTUS`, `ROCK`) re-authored ≈2× current dims (`PALM 32×40`, `CACTUS 24×32`, `ROCK 24×16`).
- Forest: background **trees** along the horizon (treeline) + 4 floor kinds **mushrooms / moss / stones / pine needles**; all seeded, deterministic.
- Milestone flag sprite ≈2× (`20×28`, label font `6px → 12px` monospace); finish flag ≈2×; winner banner font `8px → 16px` monospace; confetti particle `2×2 → 4×4`, velocities/gravity ≈2×.
- Sun/sky re-authored for a `120 px` sky strip (desert: night bands + sun; forest: dusk bands + moon).
- Digit font rule restated: `6×10` = 2× nearest-neighbour upscale of the existing `3×5` `DIGIT_FONT`.

- [ ] **Step 1: Author `docs/art/theme-art.md`**

One table per element: name, matrix dims, legend chars, palette hex, y-offset. Include a mermaid `flowchart` mapping decor kinds to themes.

- [ ] **Step 2: Run the art validator (throwaway Python; not committed)**

```bash
python3 - <<'PY'
import sys
BUDGET = { 'PALM': (32, 40), 'CACTUS': (24, 32), 'ROCK': (24, 16),
           'FOREST_TREE': (40, 56), 'MUSHROOM': (12, 12), 'MOSS': (20, 8),
           'STONE': (16, 10), 'PINE_NEEDLES': (24, 8),
           'FINISH_FLAG': (24, 28), 'MILESTONE': (20, 28) }
MATS = { 'PALM': PALM, 'CACTUS': CACTUS, 'ROCK': ROCK, 'FOREST_TREE': FOREST_TREE,
         'MUSHROOM': MUSHROOM, 'MOSS': MOSS, 'STONE': STONE,
         'PINE_NEEDLES': PINE_NEEDLES, 'FINISH_FLAG': FINISH_FLAG, 'MILESTONE': MILESTONE }
for name, (w, h) in BUDGET.items():
    m = MATS[name]
    assert len(m) == h, (name, 'rows', len(m))
    assert all(len(r) == w for r in m), (name, 'cols', {len(r) for r in m})
    assert any(ch != '.' for r in m for ch in r), (name, 'empty')
print('theme art: dims OK for', ', '.join(BUDGET))
PY
```

Expected: `theme art: dims OK for PALM, CACTUS, ROCK, FOREST_TREE, MUSHROOM, MOSS, STONE, PINE_NEEDLES, FINISH_FLAG, MILESTONE`.

- [ ] **Step 3: Preview PNGs in gitignored `test-results/ux-tmp/`**

`desert-decor-2x.png`, `forest-decor-2x.png`, `sky-120.png`. Copy out for review before running the suite.

- [ ] **Step 4: Commit**

```bash
git add docs/art/theme-art.md docs/art/camel-sprite.md
git commit -m "art: author 2x desert decor, forest decor set, and 120px sky"
```

---

### Task 4: Local static HTTP server test harness

**Files:**
- Create: `tests/server.js`
- Modify: `tests/helpers.js` (export `openHttpGame` capture helper)

**Interfaces:**
- Consumes: Node builtins only.
- Produces: `startServer(root?) → Promise<{url, close()}>` serving the repo root on an ephemeral port; `url` is `http://127.0.0.1:<port>/index.html`. `openHttpGame(page, url)` attaches console/error/request capture before navigation.

- [ ] **Step 1: Write `tests/server.js`**

```js
// Dev-only static server for storage tests (localStorage needs a real origin;
// file:// is opaque). Node builtins only — no new dependencies. Ephemeral port.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function startServer(root) {
  const dir = path.resolve(root || path.resolve(__dirname, '..'));
  const server = http.createServer(function (req, res) {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(dir, rel);
    if (!filePath.startsWith(dir)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(filePath, function (err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const type = path.extname(filePath) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      const port = server.address().port;
      resolve({
        url: 'http://127.0.0.1:' + port + '/index.html',
        close: function () { return new Promise(function (r) { server.close(r); }); },
      });
    });
  });
}

module.exports = { startServer };
```

- [ ] **Step 2: Add `openHttpGame` to `tests/helpers.js`**

Append before `module.exports`:

```js
// Attach capture BEFORE navigation, then load an explicit URL (HTTP origin).
async function openHttpGame(page, url) {
  const errors = [];
  const requests = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith('file://') && !u.startsWith('http://127.0.0.1')) requests.push(u);
  });
  await page.goto(url);
  return { errors, requests };
}

module.exports = { INDEX_URL, gotoGame, openGame, openHttpGame };
```

(Replace the existing `module.exports` line.)

- [ ] **Step 3: Smoke-test the server**

Run: `node -e "require('./tests/server').startServer().then(s=>s.close())"`
Expected: exits 0, no output.

- [ ] **Step 4: Run full suite — expect PASS (no behavior change yet)**

Run: `pnpm test`
Expected: PASS, same count as before this task (98-ish).

- [ ] **Step 5: Commit**

```bash
git add tests/server.js tests/helpers.js
git commit -m "test: add local static HTTP server harness for storage tests"
```

---

### Task 5: `GameCore` persistence module + validation unit tests

**Files:**
- Modify: `index.html` (`#core` script — add `theme` to state, persistence functions, `KEY`/`VERSION`, expose API)
- Modify: `tests/unit.spec.js` (add `deserialize` validation + `serialize` round-trip tests)

**Interfaces:**
- Consumes: existing `state`, `camelName`, `PALETTE`, `NAME_MAX`, `MIN_CAMELS`, `MAX_CAMELS`, `GOAL_MIN`, `GOAL_MAX`.
- Produces: `GameCore.serialize()`, `GameCore.deserialize(raw) → {fields, writeBack}`, `GameCore.applyFields(fields)`, `GameCore.setTheme(id)`, `GameCore.getThemeIds()`, `GameCore.registerThemeIds(ids)`, `GameCore.storageAvailable()`, `GameCore.KEY`, `GameCore.VERSION`, `getState().theme`, `window.GameStorage` (all six members).

- [ ] **Step 1: Write failing unit tests in `tests/unit.spec.js`**

Append a new describe block:

```js
test.describe('Persistence validation', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('serialize produces the exact schema with version 1', async ({ page }) => {
    const obj = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(200);
      GameCore.resetRace();
      return GameCore.serialize();
    });
    expect(obj.version).toBe(1);
    expect(Object.keys(obj).sort()).toEqual(
      ['camelCount', 'camels', 'goalScore', 'infinite', 'language', 'raceOver', 'theme', 'version', 'winnerId'].sort());
    expect(obj.camelCount).toBe(4);
    expect(obj.camels.length).toBe(4);
    expect(obj.camels[0]).toEqual({ name: 'Team 1', score: 0 });
    expect(obj.goalScore).toBe(200);
    expect(obj.infinite).toBe(false);
    expect(obj.language).toBe('en');
    expect(obj.theme).toBe('desert');
    expect(obj.raceOver).toBe(false);
    expect(obj.winnerId).toBe(null);
  });

  test('deserialize clamps every field; bad root -> defaults + writeBack', async ({ page }) => {
    const r = await page.evaluate(() => ({
      nullRoot: GameCore.deserialize(null),
      arrayRoot: GameCore.deserialize([1, 2, 3]),
      badVersion: GameCore.deserialize({ version: 99, camelCount: 6 }),
      clamped: GameCore.deserialize({
        version: 1, camelCount: 99, camels: [{ name: '  A\u0000B  ', score: -3 }, { score: 2.5 }],
        goalScore: 99999, infinite: false, language: 'fr', theme: 'nope', raceOver: true, winnerId: 'camel-7',
      }),
      infinite: GameCore.deserialize({ version: 1, infinite: true, goalScore: 500, camelCount: 2, camels: [], winnerId: 'camel-1', raceOver: true }),
    }));
    expect(r.nullRoot.writeBack).toBe(true);
    expect(r.arrayRoot.writeBack).toBe(true);
    expect(r.badVersion.writeBack).toBe(false);           // unknown version: no overwrite
    expect(r.badVersion.fields.camelCount).toBe(4);        // fresh defaults
    expect(r.clamped.fields.camelCount).toBe(8);
    expect(r.clamped.fields.camels[0].name).toBe('AB');    // sanitized + trimmed + <=16
    expect(r.clamped.fields.camels[0].score).toBe(0);      // negative -> 0
    expect(r.clamped.fields.camels[1].name).toBe('Team 2');
    expect(r.clamped.fields.camels[1].score).toBe(0);      // non-integer -> 0
    expect(r.clamped.fields.goalScore).toBe(10000);        // clamped
    expect(r.clamped.fields.language).toBe('en');
    expect(r.clamped.fields.theme).toBe('desert');
    expect(r.clamped.fields.raceOver).toBe(true);
    expect(r.clamped.fields.winnerId).toBe(null);          // camel-7 does not exist (count 8 ok? -> exists)
    expect(r.infinite.fields.goalScore).toBe(null);        // infinite forces null
    expect(r.infinite.fields.winnerId).toBe('camel-1');
  });

  test('winnerId must match an existing lane; raceOver false forces null', async ({ page }) => {
    const r = await page.evaluate(() => ({
      missing: GameCore.deserialize({ version: 1, camelCount: 2, camels: [], raceOver: true, winnerId: 'camel-5' }).fields.winnerId,
      notOver: GameCore.deserialize({ version: 1, camelCount: 2, camels: [], raceOver: false, winnerId: 'camel-0' }).fields.winnerId,
      ok: GameCore.deserialize({ version: 1, camelCount: 2, camels: [], raceOver: true, winnerId: 'camel-1' }).fields.winnerId,
    }));
    expect(r.missing).toBe(null);
    expect(r.notOver).toBe(null);
    expect(r.ok).toBe('camel-1');
  });

  test('applyFields rebuilds camels; setTheme validates against registry', async ({ page }) => {
    const r = await page.evaluate(() => {
      const res = GameCore.deserialize({
        version: 1, camelCount: 3, camels: [{ name: 'X', score: 7 }, { name: 'Y', score: 8 }, { name: 'Z', score: 9 }],
        goalScore: 100, infinite: false, language: 'de', theme: 'forest', raceOver: false, winnerId: null,
      });
      GameCore.applyFields(res.fields);
      const s = GameCore.getState();
      return {
        ids: s.camels.map((c) => c.id),
        scores: s.camels.map((c) => c.score),
        theme: s.theme,
        language: s.language,
        themeIds: GameCore.getThemeIds().sort(),
        badSet: GameCore.setTheme('nope'),
        goodSet: GameCore.setTheme('desert'),
      };
    });
    expect(r.ids).toEqual(['camel-0', 'camel-1', 'camel-2']);
    expect(r.scores).toEqual([7, 8, 9]);
    expect(r.theme).toBe('forest');
    expect(r.language).toBe('de');
    expect(r.themeIds).toEqual(['desert', 'forest']);
    expect(r.badSet).toBe(false);
    expect(r.goodSet).toBe(true);
  });

  test('GameStorage exposes KEY/VERSION and probes without throwing', async ({ page }) => {
    const r = await page.evaluate(() => ({
      key: GameStorage.KEY, ver: GameStorage.VERSION,
      has: ['available', 'load', 'save', 'clear'].every((k) => typeof GameStorage[k] === 'function'),
    }));
    expect(r.key).toBe('camelRace.v1');
    expect(r.ver).toBe(1);
    expect(r.has).toBe(true);
  });
});
```

- [ ] **Step 2: Run new tests — expect FAIL**

Run: `pnpm exec playwright test tests/unit.spec.js`
Expected: FAIL — `GameCore.serialize is not a function`.

- [ ] **Step 3: Add the persistence module to `index.html` `#core`**

(a) Add `theme: 'desert'` to the `state` object (after `language`).

(b) Insert this block immediately BEFORE `rebuildCamels(state.camelCount);` near the end of the `#core` IIFE:

```js
  // ---------- persistence ----------
  const KEY = 'camelRace.v1';
  const VERSION = 1;
  // Theme ids known to the core for validation; #app registers the live registry.
  let themeIds = new Set(['desert', 'forest']);
  function registerThemeIds(ids) { themeIds = new Set(ids); }
  function getThemeIds() { return Array.from(themeIds); }
  function setTheme(id) {
    if (typeof id !== 'string' || !themeIds.has(id)) return false;
    state.theme = id;
    emit();
    return true;
  }

  function storageAvailable() {
    try {
      const k = '__camel_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  function sanitizeStoredName(v, index) {
    if (typeof v !== 'string') return camelName(index, 'en');
    const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, NAME_MAX);
    return cleaned.length === 0 ? camelName(index, 'en') : cleaned;
  }

  function defaultFields() {
    const camels = [];
    for (let i = 0; i < 4; i++) camels.push({ name: camelName(i, 'en'), score: 0 });
    return { camelCount: 4, camels: camels, goalScore: 200, infinite: false, language: 'en', theme: 'desert', raceOver: false, winnerId: null };
  }

  // Per-field validation; never throws, never propagates NaN. Returns the
  // validated fields plus whether the stored blob should be rewritten.
  function deserialize(raw) {
    const def = defaultFields();
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { fields: def, writeBack: true };
    if (raw.version !== VERSION) return { fields: def, writeBack: false };

    let camelCount = def.camelCount;
    if (Number.isInteger(raw.camelCount)) camelCount = Math.max(MIN_CAMELS, Math.min(MAX_CAMELS, raw.camelCount));

    const src = Array.isArray(raw.camels) ? raw.camels : [];
    const camels = [];
    for (let i = 0; i < camelCount; i++) {
      const c = (src[i] && typeof src[i] === 'object' && !Array.isArray(src[i])) ? src[i] : {};
      let score = 0;
      if (Number.isInteger(c.score) && c.score >= 0 && c.score <= Number.MAX_SAFE_INTEGER) score = c.score;
      camels.push({ name: sanitizeStoredName(c.name, i), score: score });
    }

    let infinite = (typeof raw.infinite === 'boolean') ? raw.infinite : false;
    let goalScore;
    if (infinite) goalScore = null;
    else if (Number.isInteger(raw.goalScore)) goalScore = Math.max(GOAL_MIN, Math.min(GOAL_MAX, raw.goalScore));
    else goalScore = 200;

    const language = (raw.language === 'en' || raw.language === 'de') ? raw.language : 'en';
    const theme = (typeof raw.theme === 'string' && themeIds.has(raw.theme)) ? raw.theme : 'desert';
    const raceOver = (typeof raw.raceOver === 'boolean') ? raw.raceOver : false;

    let winnerId = null;
    if (raceOver && typeof raw.winnerId === 'string') {
      for (let i = 0; i < camelCount; i++) {
        if (raw.winnerId === 'camel-' + i) { winnerId = raw.winnerId; break; }
      }
    }

    return { fields: { camelCount: camelCount, camels: camels, goalScore: goalScore, infinite: infinite, language: language, theme: theme, raceOver: raceOver, winnerId: winnerId }, writeBack: false };
  }

  function applyFields(f) {
    state.language = f.language;
    state.theme = f.theme;
    state.infinite = f.infinite;
    state.goalScore = f.goalScore;
    state.raceOver = f.raceOver;
    state.winnerId = f.winnerId;
    const camels = [];
    for (let i = 0; i < f.camelCount; i++) {
      camels.push({
        id: 'camel-' + i,
        name: f.camels[i].name,
        color: PALETTE[i % PALETTE.length],
        score: f.camels[i].score,
        lane: i,
        animUntil: 0,
      });
    }
    state.camels = camels;
    state.camelCount = f.camelCount;
  }

  function serialize() {
    return {
      version: VERSION,
      camelCount: state.camelCount,
      camels: state.camels.map(function (c) { return { name: c.name, score: c.score }; }),
      goalScore: state.infinite ? null : state.goalScore,
      infinite: state.infinite,
      language: state.language,
      theme: state.theme,
      raceOver: state.raceOver,
      winnerId: state.winnerId,
    };
  }

  function load() {
    if (!storageAvailable()) return { restored: false };
    let text = null;
    try { text = window.localStorage.getItem(KEY); } catch (e) { return { restored: false }; }
    if (text == null) return { restored: false };
    let parsed = null, corrupt = false;
    try { parsed = JSON.parse(text); } catch (e) { corrupt = true; }
    const res = deserialize(corrupt ? null : parsed);
    applyFields(res.fields);
    if (res.writeBack) { try { window.localStorage.setItem(KEY, JSON.stringify(serialize())); } catch (e) { /* ignore */ } }
    emit();
    return { restored: true };
  }

  function save() {
    if (!storageAvailable()) return false;
    try { window.localStorage.setItem(KEY, JSON.stringify(serialize())); return true; } catch (e) { return false; }
  }

  function clear() {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  window.GameStorage = { KEY: KEY, VERSION: VERSION, available: storageAvailable, load: load, save: save, clear: clear };
```

(c) Add `theme: state.theme,` to the object returned by `getState()` (after `language`).

(d) Add to the `return { ... }` object of `#core`:

```js
    KEY: KEY, VERSION: VERSION,
    serialize: serialize, deserialize: deserialize, applyFields: applyFields,
    setTheme: setTheme, getThemeIds: getThemeIds, registerThemeIds: registerThemeIds,
    storageAvailable: storageAvailable,
```

- [ ] **Step 4: Run unit tests — expect PASS**

Run: `pnpm exec playwright test tests/unit.spec.js`
Expected: PASS.

- [ ] **Step 5: Run full suite — expect PASS**

Run: `pnpm test`
Expected: PASS (existing specs unaffected; `theme` added to state is additive).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit.spec.js
git commit -m "feat: add GameCore persistence validation and GameStorage"
```

---

### Task 6: Boot restore, debounced save, flush, degradation + reload E2E

**Files:**
- Modify: `index.html` (`#app` — move boot lines to end; add persistence wiring + boot restore; suppress restored-win confetti)
- Create: `tests/storage.spec.js`

**Interfaces:**
- Consumes: Task 4 `startServer`, Task 5 `GameCore.serialize/deserialize`, `GameStorage`.
- Produces: `SAVE_DEBOUNCE_MS = 200`, `scheduleSave()`, `flushSave()`, boot restore; `runtime.lastWinnerId` seeded for restored finished races.

- [ ] **Step 1: Write the failing `tests/storage.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { startServer } = require('./server');
const { openHttpGame } = require('./helpers');

let srv;
test.beforeAll(async () => { srv = await startServer(); });
test.afterAll(async () => { await srv.close(); });
test.beforeEach(async ({ page }) => { await page.goto(srv.url); });

test.describe('Persistence (HTTP origin)', () => {
  test('harness reports storage available on http origin', async ({ page }) => {
    expect(await page.evaluate(() => GameStorage.available())).toBe(true);
  });

  test('round-trip: config, names, scores, language, theme survive reload', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(6); });
    await page.locator('.lane').nth(0).locator('[data-name-input]').fill('Alpha');
    await page.locator('.lane').nth(1).locator('[data-name-input]').fill('Beta');
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="10"]').click();
    await page.locator('.lane').nth(1).locator('[data-action="add"][data-n="5"]').click();
    await page.locator('#goalScore').fill('321');
    await page.locator('#goalScore').blur();
    await page.locator('#lang-de').click();
    await page.evaluate(() => GameCore.setTheme('forest'));
    await page.evaluate(() => GameStorage.save()); // explicit flush, no clock wait v
    await page.reload();
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.camelCount).toBe(6);
    expect(s.camels[0].name).toBe('Alpha');
    expect(s.camels[1].name).toBe('Beta');
    expect(s.camels[0].score).toBe(10);
    expect(s.camels[1].score).toBe(5);
    expect(s.goalScore).toBe(321);
    expect(s.language).toBe('de');
    expect(s.theme).toBe('forest');
  });

  test('debounced save writes key camelRace.v1 with version 1', async ({ page }) => {
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="5"]').click();
    await expect.poll(() => page.evaluate(() => {
      const t = localStorage.getItem('camelRace.v1');
      return t ? JSON.parse(t).camels[0].score : null;
    })).toBe(5);
    const obj = await page.evaluate(() => JSON.parse(localStorage.getItem('camelRace.v1')));
    expect(obj.version).toBe(1);
  });

  test('New race persists scores 0, raceOver false, winnerId null, keeps config', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(5); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="5"]').click();
    await expect(page.locator('#live')).toHaveText('Team 1 wins!');
    await page.locator('#newRace').click();
    await page.evaluate(() => GameStorage.save());
    await page.reload();
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.camels.every((c) => c.score === 0)).toBe(true);
    expect(s.raceOver).toBe(false);
    expect(s.winnerId).toBe(null);
    expect(s.camelCount).toBe(4);
    expect(s.goalScore).toBe(5);
  });

  test('corrupt JSON -> defaults + safe write-back; unknown version -> defaults, no overwrite', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('camelRace.v1', '{not json'));
    await page.reload();
    const after = await page.evaluate(() => ({
      s: GameCore.getState(), stored: localStorage.getItem('camelRace.v1'),
    }));
    expect(after.s.camelCount).toBe(4);
    expect(JSON.parse(after.stored).version).toBe(1); // rewritten valid defaults
    await page.evaluate(() => localStorage.setItem('camelRace.v1', JSON.stringify({ version: 99, camelCount: 3 })));
    await page.reload();
    const v2 = await page.evaluate(() => ({ s: GameCore.getState(), stored: localStorage.getItem('camelRace.v1') }));
    expect(v2.s.camelCount).toBe(4);
    expect(JSON.parse(v2.stored).version).toBe(99); // not overwritten
  });

  test('restored finished race shows banner but does not replay confetti', async ({ page }) => {
    const obj = {
      version: 1, camelCount: 2,
      camels: [{ name: 'A', score: 10 }, { name: 'B', score: 0 }],
      goalScore: 10, infinite: false, language: 'en', theme: 'desert', raceOver: true, winnerId: 'camel-0',
    };
    await page.evaluate((o) => localStorage.setItem('camelRace.v1', JSON.stringify(o)), obj);
    await page.reload();
    await expect(page.locator('#live')).toHaveText('A wins!');
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().confettiDrawn)).toBe(0);
  });

  test('theme + language applied before first paint; load does not steal focus', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('camelRace.v1', JSON.stringify({
        version: 1, camelCount: 2, camels: [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }],
        goalScore: 200, infinite: false, language: 'de', theme: 'forest', raceOver: false, winnerId: null,
      }));
    });
    await page.reload();
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lang-de')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe('BODY');
  });

  test('storage blocked: playable, no errors, no writes', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('blocked', 'SecurityError'); },
      });
    });
    await page.goto(srv.url);
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="5"]').click();
    expect(await page.evaluate(() => GameCore.getState().camels[0].score)).toBe(5);
    expect(await page.evaluate(() => GameStorage.available())).toBe(false);
    expect(await page.evaluate(() => GameStorage.save())).toBe(false);
    expect(errors).toEqual([]);
  });

  test('no non-local network requests while playing', async ({ page }) => {
    const { errors, requests } = await openHttpGame(page, srv.url);
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="5"]').click();
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run new tests — expect FAIL**

Run: `pnpm exec playwright test tests/storage.spec.js`
Expected: FAIL — the game does not persist yet (reload shows defaults), `#theme-forest` missing.

- [ ] **Step 3: Wire persistence in `index.html` `#app`**

(a) DELETE the three boot lines currently after the language button listeners:

```js
  core.subscribe(syncDom);
  hideValidation();
  syncDom(core.getState());
```

(b) Append this boot block at the END of the `#app` IIFE, immediately BEFORE `window.requestAnimationFrame(frame);` (so `THEMES`, defined in between, exists before restore; Task 8 adds `THEMES`):

```js
  // ---------- persistence wiring + boot (restore before first paint) ----------
  const SAVE_DEBOUNCE_MS = 200;
  const storageOk = GameStorage.available();
  let saveTimer = null;
  function scheduleSave() {
    if (!storageOk) return;
    if (saveTimer != null) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = null; GameStorage.save(); }, SAVE_DEBOUNCE_MS);
  }
  function flushSave() {
    if (saveTimer != null) { clearTimeout(saveTimer); saveTimer = null; }
    if (storageOk) GameStorage.save();
  }
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushSave();
  });

  // Restore before building/refreshing the DOM and before the first frame, so
  // no default theme/language flashes. load() emits with no subscribers yet.
  if (storageOk) GameStorage.load();
  // A restored finished race shows the banner but must NOT replay confetti:
  // seed the winner tracker so updateRuntime sees no live transition.
  if (core.getState().raceOver) runtime.lastWinnerId = core.getState().winnerId;

  core.subscribe(syncDom);
  core.subscribe(scheduleSave); // never fires on load (no emit after subscribe)
  hideValidation();
  syncDom(core.getState());
```

(c) Confirm the file still ends with `window.requestAnimationFrame(frame);` then `applyCanvasLayout();` + resize/`ResizeObserver` wiring (the boot block sits before these; they run after).

- [ ] **Step 4: Run storage tests — expect PASS (except theme selector assertions)**

The `#theme-forest` assertions FAIL until Task 10. Temporarily verify the rest by running with `--grep-invert "first paint"`:

Run: `pnpm exec playwright test tests/storage.spec.js --grep-invert "first paint"`
Expected: PASS on all but the deferred theme-selector test.

- [ ] **Step 5: Run full suite — expect PASS**

Run: `pnpm test`
Expected: PASS (storage tests other than the deferred one).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/storage.spec.js
git commit -m "feat: restore on boot, debounce saves, flush on pagehide"
```

---

### Task 7: Resolution `1280×720` — geometry, scale rule, 2× art integration, digit 6×10, test updates, perf

**Files:**
- Modify: `index.html` (`#app` geometry + canvas markup; `#core` default map width)
- Modify: `tests/render.spec.js`, `tests/unit.spec.js`, `tests/app.spec.js`, `tests/controls.spec.js`, `tests/goal.spec.js`
- Create: `tests/perf.spec.js`

**Interfaces:**
- Consumes: Task 1 camel v5 matrices, Task 3 desert decor/fonts.
- Produces: `HORIZON_Y = 120`, `LANE_BOTTOM = 712`, `SPRITE_W = 66`, `SPRITE_H = 62`, `SCALE_MAX = 2`, digit `6×10` renderer, `mapScoreToScreenX` default width `1280`.

- [ ] **Step 1: Update canvas markup + geometry constants in `index.html`**

Markup:

```html
      <canvas id="game" width="1280" height="720"
        aria-label="Camel race track. Camels race left to right to the goal."></canvas>
```

Constants block (replace the current values):

```js
  const CANVAS_W = canvas.width;   // 1280
  const CANVAS_H = canvas.height;  // 720

  const HORIZON_Y = 120;
  const LANE_BOTTOM = CANVAS_H - 8; // 712
  const SPRITE_W = 66;
  const SPRITE_H = 62;
```

`computeScale` comment/`SCALE_MAX`:

```js
  const SCALE_EPSILON = 0.05, SCALE_MAX = 2;
```

`LANE_MARGIN` → `4`; `CANVAS_BORDER` stays `4`.

- [ ] **Step 2: Bump the core default map width**

In `index.html` `#core` `mapScoreToScreenX`, change the fallback:

```js
    const width = (typeof canvasWidth === 'number' && canvasWidth > 0) ? canvasWidth : 1280;
```

- [ ] **Step 3: Digit `6×10` (2× upscale of the 3×5 table)**

Replace `drawBlanketNumber` body with:

```js
  function drawBlanketNumber(left, top, laneIndex, frameIndex) {
    let n = laneIndex + 1;
    if (n > 9) n = 0; // unreachable safety fallback: lane count is capped at 8
    const glyph = DIGIT_FONT[String(n)];
    if (!glyph) return;
    // 6x10 digit = exact 2x nearest-neighbour upscale of the 3x5 DIGIT_FONT
    // (single source of truth). Drops 2px with the body on bob frames 2/4.
    const rowOffset = (frameIndex === 2 || frameIndex === 4) ? 2 : 0;
    ctx.fillStyle = BLANKET_DIGIT_COLOR;
    for (let ry = 0; ry < 5; ry++) {
      const row = glyph[ry];
      for (let rx = 0; rx < 3; rx++) {
        if (row[rx] === '#') {
          ctx.fillRect(Math.round(left) + 11 + rx * 2, Math.round(top) + 12 + rowOffset + ry * 2, 2, 2);
        }
      }
    }
  }
```

(Task 8 wires the per-theme `theme.animal.blanket.anchor`; for camel v5 the anchor is pinned by Task 1 — use it here once available.)

- [ ] **Step 4: Re-author fonts/sizes (2×)**

In the art section apply:

```js
  function drawMilestones(win) { /* ... */ ctx.font = '12px monospace'; /* sprite MILESTONE now 20x28, stand at HORIZON_Y - 28 */ }
  function drawBanner(s) { /* ... */ ctx.font = '16px monospace'; /* bg rect height 32, gold strip 24 */ }
  function spawnConfetti(cx, cy) { /* vx/vy *2, gravity 280 */ }
  function drawConfetti() { /* ... */ ctx.fillRect(px, py, 4, 4); }
```

Milestone flag origin: `drawSprite(MILESTONE, x, HORIZON_Y - 28 - terrain, ...)`; label at `x + 20, flagY + 6`. Finish flag at `poleTop - 28`; checker stripes `6 px` wide/tall. Sun via theme palette (Task 8).

- [ ] **Step 5: Copy Task 1/3 matrices verbatim**

Replace `CAMEL`, `PALM`, `CACTUS`, `ROCK`, `FINISH_FLAG`, `MILESTONE`, `DIGIT_FONT` (keep 3×5) with the pinned versions from `docs/art/camel-sprite.md` (v5) and `docs/art/theme-art.md`.

- [ ] **Step 6: Update existing test expectations (exact old → new)**

`tests/unit.spec.js`:

```js
// old
expect(r).toEqual([0, 320, 640, 0, 640, 320]);
// new
expect(r).toEqual([0, 640, 1280, 0, 1280, 640]);
```

`tests/render.spec.js` — apply these replacements:

| Old | New |
|---|---|
| `toEqual({ width: 640, height: 360 })` | `toEqual({ width: 1280, height: 720 })` |
| `getImageData(0, 0, 640, 360)` | `getImageData(0, 0, 1280, 720)` |
| `getImageData(0, 0, 640, 88)` | `getImageData(0, 0, 1280, 120)` |
| `getImageData(0, Y0, W, H)` with `const W = 640, Y0 = 88, H = 8` | `const W = 1280, Y0 = 120, H = 8` |
| `for (let x = 0; x < 640; x += 1)` | `for (let x = 0; x < 1280; x += 1)` |
| `(y * 640 + x) * 4` | `(y * 1280 + x) * 4` |
| `toBe(640 * 360)` | `toBe(1280 * 720)` |
| `toBeLessThanOrEqual(640)` (bounds) | `toBeLessThanOrEqual(1280)` |
| `toBeCloseTo(33, 9)` | `toBeCloseTo(66, 9)` |
| `toBeCloseTo(31, 9)` | `toBeCloseTo(62, 9)` |
| `getImageData(x, y, 33, 31)` | `getImageData(x, y, 66, 62)` |
| `for (let ry = 0; ry < 31; ry += 1)` / `rx < 33` | `ry < 62` / `rx < 66` |
| `Math.round(b.left) + 11, Math.round(b.top) + 12, 3, 5` (digit sample) | `Math.round(b.left) + 11, Math.round(b.top) + 12, 6, 10` |
| `+ ry < 5` digit loop / `3x5 glyph` label | `6x10` (every `#` is a 2×2 block) |
| bob offset `+1` digit | `+2` |
| `const laneH = (size.height - 4 - 88) / count;` | `const laneH = (size.height - 8 - 120) / count;` |
| `Math.round(88 + i * laneH)` | `Math.round(120 + i * laneH)` |
| digit row anchor `+ 12 + rowOffset` with rowOffset `{0,1}` | `+ 12 + rowOffset` with rowOffset `{0,2}`, sample `6,10` |

The camel pixel tallies in the "idle bodies" test change (v5 body is denser). Replace the tally threshold with `> 4000` and keep `tally['#123a44'] > 0`.

`tests/app.spec.js`:

| Old | New |
|---|---|
| `expect(l.bufferWidth).toBe(640);` | `expect(l.bufferWidth).toBe(1280);` |
| `expect(l.bufferHeight).toBe(360);` | `expect(l.bufferHeight).toBe(720);` |
| `1920x1080` title "...640px buffer up (integer snap where it fits)" | rename to "...1280px buffer"; `1920/1280 = 1.5`, `2*1280 = 2560 > 1920` → scale fractional `1.5`; assert `expect(l.scale).toBeCloseTo(1.5, 2)` and `expect(l.cssWidth).toBeLessThanOrEqual(1920)` |
| `{ width: 480, height: 900 }` responsive case | unchanged semantics; assert no horizontal scroll still |

`tests/controls.spec.js` banner band: `getImageData(0, 6, 640, 16)` → `getImageData(0, 6, 1280, 24)`.

`tests/goal.spec.js` — apply:

| Old | New |
|---|---|
| `getImageData(0, y0, 640, ...)` | `getImageData(0, y0, 1280, ...)` |
| `getImageData(x0, y0, x1 - x0, y1 - y0)` widths | unchanged (relative) |
| `toBeLessThanOrEqual(640)` | `toBeLessThanOrEqual(1280)` |
| milestone band `(74, 88)` | `(96, 120)` (flag now `20×28` at `HORIZON_Y − 28`) |
| checker band `(88, 360)` / `getImageData(stripeX, 88, 4, 360 - 88)` | `(120, 720)` / `getImageData(stripeX, 120, 6, 720 - 120)` |
| `mapScoreToScreenX(10700, w, 640)` | `mapScoreToScreenX(10700, w, 1280)`, `+ 17` → `+ 34` |
| label band `(74, 88)` | `(96, 120)` |

- [ ] **Step 7: Write `tests/perf.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('Performance acceptance', () => {
  test('>=55 fps over >=120 rAF frames, 8 lanes, score spread 0 vs 5000', async ({ page }) => {
    await gotoGame(page);
    const result = await page.evaluate(() => new Promise((resolve) => {
      GameCore.setCamelCount(8);
      GameCore.setGoal(null);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 5000);
      let frames = 0;
      const t0 = performance.now();
      function tick() {
        frames += 1;
        if (frames >= 180) {
          const elapsed = performance.now() - t0;
          resolve({ frames: frames, fps: frames / (elapsed / 1000) });
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    }));
    expect(result.frames).toBeGreaterThanOrEqual(120);
    expect(result.fps).toBeGreaterThanOrEqual(55);
  });
});
```

- [ ] **Step 8: Run updated specs — expect PASS**

Run each:

```bash
pnpm exec playwright test tests/unit.spec.js
pnpm exec playwright test tests/render.spec.js
pnpm exec playwright test tests/perf.spec.js
pnpm exec playwright test tests/app.spec.js
pnpm exec playwright test tests/controls.spec.js
pnpm exec playwright test tests/goal.spec.js
```

Expected: all PASS. If a pixel-band assertion fails, re-derive the band from the new geometry (do NOT loosen below the spec value).

- [ ] **Step 9: Run full suite — expect PASS**

Run: `pnpm test`
Expected: PASS, including `perf.spec.js`.

- [ ] **Step 10: Commit**

```bash
git add index.html tests/render.spec.js tests/unit.spec.js tests/app.spec.js tests/controls.spec.js tests/goal.spec.js tests/perf.spec.js
git commit -m "feat: raise buffer to 1280x720 with camel v5, 2x art, 6x10 digits"
```

---

### Task 8: Theme registry + desert entry + theme plumbing

**Files:**
- Modify: `index.html` (`#app` — `THEMES` registry, theme-driven sky/ground/decor/animal dispatch, `syncTheme()`, register ids for core validation, `GameDebug.getTheme`)
- Create: `tests/theme.spec.js` (desert-unchanged cases)

**Interfaces:**
- Consumes: Tasks 1–3 art, Task 5 `GameCore.registerThemeIds/setTheme`.
- Produces: `THEMES` object; `syncTheme()` (updates `SPRITE_W/SPRITE_H`, module `theme` ref); `GameDebug.getTheme()`; `runtime.decorKinds`; theme reads from `core.getState().theme` each frame.

- [ ] **Step 1: Write failing `tests/theme.spec.js` (desert)**

```js
const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('Theme registry (desert)', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('default theme is desert; registry has desert + forest', async ({ page }) => {
    const r = await page.evaluate(() => ({ theme: GameCore.getState().theme, ids: GameCore.getThemeIds().sort() }));
    expect(r.theme).toBe('desert');
    expect(r.ids).toEqual(['desert', 'forest']);
  });

  test('GameDebug reports active animal + sprite size', async ({ page }) => {
    const t = await page.evaluate(() => GameDebug.getTheme());
    expect(t).toEqual({ id: 'desert', animalId: 'camel', w: 66, h: 62 });
  });

  test('desert still renders dunes and decor kinds', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().decorDrawn)).toBeGreaterThan(0);
    const kinds = await page.evaluate(() => GameDebug.getScene().decorKinds);
    expect(kinds.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm exec playwright test tests/theme.spec.js`
Expected: FAIL — `GameDebug.getTheme is not a function`.

- [ ] **Step 3: Add `THEMES` + `syncTheme()` in `index.html` `#app`**

Insert after the existing sprite matrices (so `CAMEL`, `PALM`, `CACTUS`, `ROCK`, `MILESTONE`, `FINISH_FLAG` exist) and before the `draw*` functions:

```js
  // ---------- theme registry ----------
  const CAMEL_ANCHOR = { x: 11, y: 12 }; // pinned by docs/art/camel-sprite.md v5
  const THEMES = {
    desert: {
      id: 'desert',
      label: { en: 'Desert', de: 'Wüste' },
      palette: { sky: ['#1a1030', '#241640', '#2e1c4a'], sun: '#e8a03a', sunRim: '#f0c060', accent: '#e8c83a' },
      ground: { top: '#c9a25a', shade: '#a8813f', edge: '#6e4f2a', rim: '#523a1e' },
      decor: {
        spacing: 90, maxSpan: 1500,
        kinds: [
          { kind: 'palm', weight: 0.34, sprite: PALM, pal: PALM_PAL, yOffset: -40 },
          { kind: 'cactus', weight: 0.33, sprite: CACTUS, pal: CACTUS_PAL, yOffset: -32 },
          { kind: 'rock', weight: 0.33, sprite: ROCK, pal: ROCK_PAL, yOffset: -16 },
        ],
      },
      animal: {
        id: 'camel', sprite: CAMEL, pal: CAMEL_PAL, w: 66, h: 62, rider: 'turban',
        blanket: { anchor: CAMEL_ANCHOR, w: 6, h: 10, digitColor: '#123a44' }, bobOffset: 2,
      },
      laneFit: { spriteHMax: 70, laneMinPx: 74 },
    },
  };

  let theme = THEMES.desert;
  let SPRITE_W = theme.animal.w;
  let SPRITE_H = theme.animal.h;
  function syncTheme() {
    const s = core.getState();
    theme = THEMES[s.theme] || THEMES.desert;
    SPRITE_W = theme.animal.w;
    SPRITE_H = theme.animal.h;
  }
```

`SPRITE_W`/`SPRITE_H` become `let` (were `const` in Task 7). Call `syncTheme();` at the top of `frame(now)` (before computing the window) and once at boot before `syncDom`.

Core's default `themeIds` is already `['desert','forest']` (Task 5), so restore validates both ids without registering anything here. Task 9 calls `GameCore.registerThemeIds(Object.keys(THEMES))` once BOTH entries exist (never with a subset), keeping the registry the single source of truth.

- [ ] **Step 4: Make sky/ground/decor/animal theme-driven**

Refactor to read `theme`:

```js
  function drawSky() {
    const bands = theme.palette.sky;
    const bandH = Math.ceil(HORIZON_Y / bands.length);
    for (let i = 0; i < bands.length; i++) { ctx.fillStyle = bands[i]; ctx.fillRect(0, i * bandH, CANVAS_W, bandH); }
  }

  function drawSun() {
    const cx = 1020, cy = 76, r = 32; // 2x for the 120px sky
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillStyle = (Math.abs(dy) > r - 6) ? theme.palette.sunRim : theme.palette.sun;
      ctx.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
    }
  }
```

`drawLanes(s, win)` uses `DUNE` → `theme.ground` (`top/shade/edge/rim`).

`drawDecor(win)`:

```js
  function drawDecor(win) {
    const { spacing, maxSpan, kinds } = theme.decor;
    runtime.decorKinds = [];
    if ((win.max - win.min) > maxSpan) { runtime.decorDrawn = 0; return; }
    const margin = (win.max - win.min) * (32 / CANVAS_W);
    const startK = Math.floor((win.min - spacing) / spacing);
    const endK = Math.ceil((win.max + spacing) / spacing);
    const total = kinds.reduce(function (a, k) { return a + k.weight; }, 0);
    let drawn = 0;
    for (let k = startK; k <= endK; k++) {
      const rng = mulberry32(hash2(SEED, k));
      const roll = rng() * total;
      const point = k * spacing + Math.floor(rng() * 80 - 40);
      if (point < win.min - margin || point > win.max + margin) continue;
      let acc = 0, chosen = kinds[kinds.length - 1];
      for (const kind of kinds) { acc += kind.weight; if (roll <= acc) { chosen = kind; break; } }
      const cx = mapX(point, win);
      drawSprite(chosen.sprite, cx - chosen.sprite[0].length / 2, HORIZON_Y + chosen.yOffset, chosen.pal);
      if (runtime.decorKinds.indexOf(chosen.kind) < 0) runtime.decorKinds.push(chosen.kind);
      drawn++;
    }
    runtime.decorDrawn = drawn;
  }
```

`drawCamels` uses `theme.animal.sprite` and `theme.animal.pal(c.color)`; `drawBlanketNumber` uses `theme.animal.blanket.anchor` and `bobOffset`.

`GameDebug`:

```js
    getTheme: function () { syncTheme(); return { id: theme.id, animalId: theme.animal.id, w: theme.animal.w, h: theme.animal.h }; },
```

`getScene` adds `decorKinds: (runtime.decorKinds || []).slice()`.

`runtime.decorKinds = [];` added to the `runtime` object literal.

- [ ] **Step 5: Run theme + full suite — expect PASS (desert cases)**

Run: `pnpm exec playwright test tests/theme.spec.js`
Expected: PASS (desert cases).
Run: `pnpm test`
Expected: PASS except the deferred `storage.spec.js` "first paint" case (theme selector, Task 10).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/theme.spec.js
git commit -m "feat: add theme registry and theme-driven desert rendering"
```

---

### Task 9: Forest theme — boar, grass ground, forest decor

**Files:**
- Modify: `index.html` (`#app` — `BOAR`, forest decor sprites, `BOAR_PAL`, forest `THEMES` entry)
- Modify: `tests/theme.spec.js` (forest cases)

**Interfaces:**
- Consumes: Task 2 boar matrices + `BOAR_PAL` keys, Task 3 forest decor matrices.
- Produces: `THEMES.forest` entry (id `forest`, animal `boar`, `w ≤ 76`, `h ≤ 70`); `BOAR`, `FOREST_TREE`, `MUSHROOM`, `MOSS`, `STONE`, `PINE_NEEDLES` constants; `FOREST_PAL` ground tokens.

- [ ] **Step 1: Add failing forest tests to `tests/theme.spec.js`**

```js
test.describe('Theme registry (forest)', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('forest selects the boar at <=76x70', async ({ page }) => {
    await page.evaluate(() => GameCore.setTheme('forest'));
    const t = await page.evaluate(() => GameDebug.getTheme());
    expect(t.id).toBe('forest');
    expect(t.animalId).toBe('boar');
    expect(t.w).toBeLessThanOrEqual(76);
    expect(t.h).toBeLessThanOrEqual(70);
    const bounds = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
    const n = bounds.length;
    const laneH = (720 - 8 - 120) / n;
    bounds.forEach((b, i) => {
      expect(b.right - b.left).toBeLessThanOrEqual(76);
      expect(b.bottom - b.top).toBeLessThanOrEqual(70);
      expect(b.top).toBeGreaterThanOrEqual(Math.round(120 + i * laneH));
      expect(b.bottom).toBeLessThanOrEqual(Math.round(120 + (i + 1) * laneH));
    });
  });

  test('forest renders treeline + 4 floor decor kinds', async ({ page }) => {
    await page.evaluate(() => GameCore.setTheme('forest'));
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().decorDrawn)).toBeGreaterThan(0);
    const kinds = await page.evaluate(() => GameDebug.getScene().decorKinds);
    for (const k of ['trees', 'mushrooms', 'moss', 'stones', 'pine_needles']) {
      expect(kinds).toContain(k);
    }
  });

  test('forest draws grass ground (forest ground.top pixels present)', async ({ page }) => {
    await page.evaluate(() => GameCore.setTheme('forest'));
    await expect.poll(() => page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      const d = g.getImageData(0, 200, 1280, 400).data;
      let hit = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 0x3f && d[i + 1] === 0x6b && d[i + 2] === 0x3a) hit++;
      }
      return hit;
    })).toBeGreaterThan(1000);
  });

  test('8-lane boar budget holds (height cap 70, lane 74)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(8); GameCore.setTheme('forest'); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const bounds = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
    expect(bounds.length).toBe(8);
    for (const b of bounds) expect(b.bottom - b.top).toBeLessThanOrEqual(70);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm exec playwright test tests/theme.spec.js`
Expected: FAIL — `THEMES.forest` undefined → falls back to desert.

- [ ] **Step 3: Add forest art constants + registry entry in `index.html`**

Add matrices copied verbatim from `docs/art/boar-sprite.md` and `docs/art/theme-art.md`:

```js
  // Boar <=76x70, 5 frames: 0 standing, 1-4 walk (docs/art/boar-sprite.md).
  const BOAR = [ /* frame 0..4 matrices from the art doc */ ];
  const BOAR_PAL = (robe) => ({
    outline: '#1a1208', body: '#5b5040', shade: '#3d382c', highlight: '#7d6f52',
    ear: '#d9c9a6', tusk: '#f0ece0', eye: '#14100b', legs: '#33302a',
    robe: robe, skin: '#d8a878', cap: '#2f6b3a', blanket: '#bfe3ea',
  });
  const BOAR_ANCHOR = { x: 0, y: 0 }; // pinned by docs/art/boar-sprite.md (6x10 flat area)

  // Forest decor sprites (docs/art/theme-art.md).
  const FOREST_TREE = [ /* ... */ ];
  const MUSHROOM = [ /* ... */ ];
  const MOSS = [ /* ... */ ];
  const STONE = [ /* ... */ ];
  const PINE_NEEDLES = [ /* ... */ ];
  const FOREST_PAL = { body: '#2f6b3a', shade: '#24502d', edge: '#1c3a22', rim: '#122a18' };
```

Add the `forest` entry to `THEMES`:

```js
    forest: {
      id: 'forest',
      label: { en: 'Forest', de: 'Wald' },
      palette: { sky: ['#1e2a3a', '#2a3a4a', '#33465a'], sun: '#e8e0c0', sunRim: '#f0ece0', accent: '#8fd18a' },
      ground: { top: '#3f6b3a', shade: '#2f522d', edge: '#244021', rim: '#16301a' },
      decor: {
        spacing: 90, maxSpan: 1500,
        kinds: [
          { kind: 'trees', weight: 0.30, sprite: FOREST_TREE, pal: FOREST_PAL, yOffset: -56 },
          { kind: 'mushrooms', weight: 0.20, sprite: MUSHROOM, pal: MUSHROOM_PAL, yOffset: -12 },
          { kind: 'moss', weight: 0.18, sprite: MOSS, pal: MOSS_PAL, yOffset: -8 },
          { kind: 'stones', weight: 0.17, sprite: STONE, pal: STONE_PAL, yOffset: -10 },
          { kind: 'pine_needles', weight: 0.15, sprite: PINE_NEEDLES, pal: PINE_PAL, yOffset: -8 },
        ],
      },
      animal: {
        id: 'boar', sprite: BOAR, pal: BOAR_PAL, w: 76, h: 70, rider: 'hunter',
        blanket: { anchor: BOAR_ANCHOR, w: 6, h: 10, digitColor: '#123a44' }, bobOffset: 2,
      },
      laneFit: { spriteHMax: 70, laneMinPx: 74 },
    },
```

Where `MUSHROOM_PAL`, `MOSS_PAL`, `STONE_PAL`, `PINE_PAL` are the small palette objects pinned in `docs/art/theme-art.md`.

Then add `GameCore.registerThemeIds(Object.keys(THEMES));` in the boot block (before `GameStorage.load()`), now that `THEMES` has both `desert` and `forest` — this keeps the core's valid-id set equal to the live registry.

- [ ] **Step 4: Run theme tests — expect PASS**

Run: `pnpm exec playwright test tests/theme.spec.js`
Expected: PASS (desert + forest).

- [ ] **Step 5: Run full suite — expect PASS (incl. Task 6 forest round-trip)**

Run: `pnpm test`
Expected: PASS except the deferred Task 6 "theme + language applied before first paint" case (its `#theme-forest` assertion lands in Task 10).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/theme.spec.js
git commit -m "feat: add forest theme with boar and forest decor"
```

---

### Task 10: Theme selector UI + i18n + persistence + instant-switch tests

**Files:**
- Modify: `index.html` (header markup + CSS reuse of `.lang`, `I18N` keys, `syncDom` theme sync, click listeners, `#app` boot)
- Modify: `tests/theme.spec.js`, `tests/app.spec.js`, `tests/controls.spec.js`

**Interfaces:**
- Consumes: Tasks 5/6 (persistence, `setTheme`), Task 8/9 (`THEMES`).
- Produces: `#themeToggle`/`#theme-desert`/`#theme-forest` buttons; `I18N.themeLabel/themeDesert/themeForest`; instant switch with no score reset; persisted selection.

- [ ] **Step 1: Write failing tests**

Append to `tests/theme.spec.js`:

```js
test.describe('Theme selector UI + persistence', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('selector labels localize; aria-pressed tracks active theme', async ({ page }) => {
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-desert')).toHaveText('Desert');
    await page.locator('#lang-de').click();
    await expect(page.locator('#theme-desert')).toHaveText('Wüste');
    await expect(page.locator('#theme-forest')).toHaveText('Wald');
    await expect(page.locator('#themeToggle')).toHaveAttribute('aria-label', 'Thema');
  });

  test('switch is instant and does not reset scores', async ({ page }) => {
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="10"]').click();
    await page.locator('#theme-forest').click();
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.theme).toBe('forest');
    expect(s.camels[0].score).toBe(10);
    expect(s.raceOver).toBe(false);
    const t = await page.evaluate(() => GameDebug.getTheme());
    expect(t.animalId).toBe('boar');
  });

  test('switch preserves a finished race (no reset)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(5); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="5"]').click();
    await expect(page.locator('#live')).toHaveText('Team 1 wins!');
    await page.locator('#theme-forest').click();
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.raceOver).toBe(true);
    expect(s.winnerId).toBe('camel-0');
  });

  test('selected theme persists across reload', async ({ page }) => {
    await page.locator('#theme-forest').click();
    await expect.poll(() => page.evaluate(() => {
      const t = localStorage.getItem('camelRace.v1');
      return t ? JSON.parse(t).theme : null;
    })).toBe('forest');
    await page.reload();
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => GameCore.getState().theme)).toBe('forest');
  });
});
```

Add to `tests/app.spec.js`:

```js
  test('theme buttons are keyboard reachable with visible focus', async ({ page }) => {
    await gotoGame(page);
    await expect(page.locator('#themeToggle')).toHaveAttribute('role', 'group');
    await page.locator('#theme-forest').focus();
    expect(await page.evaluate(() => document.activeElement.id)).toBe('theme-forest');
  });
```

Add to `tests/controls.spec.js`:

```js
  test('EN/DE includes theme strings', async ({ page }) => {
    await page.locator('#lang-de').click();
    await expect(page.locator('#theme-desert')).toHaveText('Wüste');
    await expect(page.locator('#theme-forest')).toHaveText('Wald');
  });
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm exec playwright test tests/theme.spec.js`
Expected: FAIL — `#theme-desert` not found.

- [ ] **Step 3: Add header markup in `index.html`**

Replace the language toggle block in `<header>`:

```html
    <div class="toggles">
      <div class="lang" role="group" aria-label="Language" id="languageToggle">
        <button id="lang-en" type="button" aria-pressed="true">EN</button>
        <button id="lang-de" type="button" aria-pressed="false">DE</button>
      </div>
      <div class="lang themes" role="group" aria-label="Theme" id="themeToggle">
        <button id="theme-desert" type="button" aria-pressed="true">Desert</button>
        <button id="theme-forest" type="button" aria-pressed="false">Forest</button>
      </div>
    </div>
```

Add CSS (reuses `.lang button[aria-pressed="true"]`):

```css
  .toggles { display:flex; gap:8px; align-items:center; }
  .themes button { min-width:64px; }
```

- [ ] **Step 4: Add i18n keys in `index.html`**

In `I18N.en` add:

```js
      themeLabel: 'Theme',
      themeDesert: 'Desert',
      themeForest: 'Forest',
```

In `I18N.de` add:

```js
      themeLabel: 'Thema',
      themeDesert: 'Wüste',
      themeForest: 'Wald',
```

- [ ] **Step 5: Wire the selector in `#app`**

In `syncDom`, after the language `aria-pressed` lines add:

```js
    document.getElementById('themeToggle').setAttribute('aria-label', t(s.language, 'themeLabel'));
    document.getElementById('theme-desert').textContent = t(s.language, 'themeDesert');
    document.getElementById('theme-forest').textContent = t(s.language, 'themeForest');
    document.getElementById('theme-desert').setAttribute('aria-pressed', String(s.theme === 'desert'));
    document.getElementById('theme-forest').setAttribute('aria-pressed', String(s.theme === 'forest'));
```

After the `lang-de` listener add:

```js
  document.getElementById('theme-desert').addEventListener('click', function () { core.setTheme('desert'); });
  document.getElementById('theme-forest').addEventListener('click', function () { core.setTheme('forest'); });
```

`setTheme` emits → `syncDom` (re-render buttons) + `scheduleSave` (persist). No DOM focus change; no score reset.

- [ ] **Step 6: Run theme/app/controls + storage "first paint" — expect PASS**

Run:

```bash
pnpm exec playwright test tests/theme.spec.js
pnpm exec playwright test tests/app.spec.js
pnpm exec playwright test tests/controls.spec.js
pnpm exec playwright test tests/storage.spec.js
```

Expected: all PASS, including `storage.spec.js` "theme + language applied before first paint".

- [ ] **Step 7: Run full suite — expect PASS (all green)**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/theme.spec.js tests/app.spec.js tests/controls.spec.js
git commit -m "feat: add theme selector UI with i18n, a11y, and persistence"
```

---

### Task 11: Docs wrap-up, deltas, docker/Pages checks, acceptance verification

**Files:**
- Modify: `README.md`, `docs/specs/2026-10-04-persistence-and-themes-design.md` (append resolving notes only), this plan (append `## Implementation Deltas`), `Dockerfile` (verify only)
- Delete: `docs/art/wildschwein-sprite-DRAFT.md` (if not already removed in Task 2)

**Interfaces:**
- Consumes: everything.
- Produces: accurate run/persistence/theme docs; plan delta record; verified acceptance.

- [ ] **Step 1: Update `README.md`**

Append sections (keep the existing Run/Test sections):

```markdown
## Persistence

Progress is saved to `localStorage` under the key `camelRace.v1` (single JSON,
`version: 1`): camel count, each lane's name + score, goal score, infinite flag,
language, theme, race-over flag, and winner. Writes are debounced 200 ms and
flushed synchronously on tab hide/close. Reload restores everything. New race
resets scores / race-over / winner but keeps count, names, goal, language, theme.

Where `localStorage` is unavailable (private mode, opaque `file://` origins,
disabled storage), the game still plays fully in memory and raises no errors.

## Themes

Two themes: **Desert** (camel + dunes) and **Forest** (boar + treeline/grass).
Switch with the theme buttons in the header — instant, no score reset, selection
persisted. Both share one score set, lane colours, and the numbered blanket.
```

- [ ] **Step 2: Verify Docker + Pages unaffected**

Run:

```bash
grep -n "COPY" Dockerfile
```

Expected: `COPY index.html /usr/share/nginx/html/index.html` only — the Dockerfile copies `index.html` alone, so no change is needed for the new features. Confirm `.gitignore` still contains `wildschwein-pixelart.jpeg`:

```bash
grep -n "wildschwein-pixelart.jpeg" .gitignore
```

Expected: one matching line.

- [ ] **Step 3: Append `## Implementation Deltas` to this plan**

Add a section recording any deviation from planned numbers/code, mirroring `docs/plans/2026-10-03-camel-derby.md`'s delta tables (e.g. adjusted pixel-band constants, test counts).

- [ ] **Step 4: Delete the draft doc if still present**

```bash
git rm --cached docs/art/wildschwein-sprite-DRAFT.md 2>/dev/null || true
git rm docs/art/wildschwein-sprite-DRAFT.md 2>/dev/null || true
```

- [ ] **Step 5: Run full suite — expect PASS**

Run: `pnpm test`
Expected: PASS, all specs green (unit, storage, render, perf, theme, controls, goal, app).

- [ ] **Step 6: Manual acceptance verification**

Run: `open index.html`. Check, in order: buffer renders pixelated at 16:9 (`1280×720`); 4 lanes default; `+1/+5/+10` move the right camel; goal win → banner + confetti + locked inputs; `New race` resets; `∞` hides finish line; EN/DE toggles every string incl. theme names; theme toggle swaps desert↔forest instantly with scores intact; reload restores theme/language/names/scores; at 800 px width the panel stacks with no horizontal scroll. Then verify acceptance criteria 1–16 against the spec (every field of `camelRace.v1` round-trips; corrupt JSON recovers; blocked storage plays).

- [ ] **Step 7: Commit**

```bash
git add README.md docs/art/theme-art.md docs/art/camel-sprite.md docs/art/boar-sprite.md docs/plans/2026-10-04-persistence-and-themes.md docs/specs/2026-10-04-persistence-and-themes-design.md
git commit -m "docs: document persistence and themes; record plan deltas"
```

---

## Self-Review

**1. Spec coverage**

| Spec section / acceptance criterion | Task |
|---|---|
| Key & namespace `camelRace.v1`; JSON schema | 5 |
| Per-field validation + fallback table | 5 |
| Write timing (200 ms debounce; `pagehide`/`visibilitychange` flush) | 6 |
| Boot order (restore before first paint) | 6, 10 |
| Graceful degradation `storageAvailable()` | 5, 6 |
| What persists vs. New race vs. never | 5, 6 |
| Theming registry + shape | 8, 9 |
| Renderer consumption / theme-independent camera+scoring+fonts | 8 |
| Switching (instant, no reset, persisted) | 10 |
| Lane colours, rider, blanket | 8, 9 |
| Forest decor treeline + 4 floor kinds, spacing 90 / maxSpan 1500 | 9 |
| Canvas 1280×720, smoothing, scale rule `SCALE_MAX 2` | 7 |
| Vertical layout constants (`HORIZON_Y 120`, `LANE_BOTTOM 712`, lane 592, `74.0`/`148.0`, `LANE_MARGIN 4`, `TERRAIN_FEET_OFFSET 2`) | 7 |
| Sprite budget camel 66×62, boar ≤76×70, 8-lane proof | 1, 2, 7, 9 |
| Terrain `±2` unchanged | 7 |
| Re-authored art 2× (sun, decor, milestone, banner, confetti, digit 6×10) | 3, 7 |
| Performance ≥55 fps / ≥120 frames / 8 lanes / spread 0 vs 5000 | 7 |
| i18n additions `themeLabel/themeDesert/themeForest` | 10 |
| Accessibility (group, aria-pressed, focus, no focus steal) | 10 |
| Art rules (boar trace ≥0.90, camel v5, docs, draft deleted, JPEG out of git) | 1, 2, 11 |
| Test strategy (HTTP server for storage; file:// otherwise; degradation) | 4, 6 |
| Acceptance 1 buffer/scale/no-scroll | 7 |
| Acceptance 2 key + fields round-trip | 5, 6 |
| Acceptance 3 reload restores all fields | 6 |
| Acceptance 4 corrupt / unknown version | 5, 6 |
| Acceptance 5 per-field validation | 5 |
| Acceptance 6 storage blocked playable, no writes | 6 |
| Acceptance 7 debounce + flush | 6 |
| Acceptance 8 New race reset persisted | 6 |
| Acceptance 9 restored finished race no confetti replay | 6 |
| Acceptance 10 theme switch instant/persisted | 10 |
| Acceptance 11 forest boar + treeline + grass + 4 decor kinds | 9 |
| Acceptance 12 desert still renders at new res | 7, 8 |
| Acceptance 13 8 lanes fit budget | 7, 9 |
| Acceptance 14 perf ≥55 fps | 7 |
| Acceptance 15 EN/DE theme strings + digit 6×10 | 10, 7 |
| Acceptance 16 no network; single file; JPEG not in git/runtime | 11 |

**2. Placeholder scan:** no `TBD`/`TODO`/"fill in"/"similar to". Art matrices and palettes are produced by Tasks 1–3 and referenced by constant name in later tasks (a declared task dependency, not a placeholder); all other code and values are exact.

**3. Type/name consistency:** `GameCore.serialize/deserialize/applyFields/setTheme/getThemeIds/registerThemeIds/storageAvailable`, `GameStorage.{KEY,VERSION,available,load,save,clear}`, `getState().theme`, `THEMES[id].{id,label,palette,ground,decor,animal,laneFit}`, `animal.{id,sprite,pal,w,h,rider,blanket:{anchor,w,h,digitColor},bobOffset}`, `decor.kinds[].{kind,weight,sprite,pal,yOffset}`, `syncTheme()`, `SPRITE_W/SPRITE_H`, `runtime.decorKinds`, `GameDebug.getTheme/getScene.decorKinds`, DOM ids `themeToggle/theme-desert/theme-forest`, and test selectors match across tasks. Numbers `720/712/120/592/74.0/148.0/66×62/76×70/±2/6×10/200/ camelRace.v1 /SCALE_MAX 2/90/1500` match the spec verbatim.

**4. Spec gaps found:** none blocking. The spec's `THEMES` snippet shows `weight`/`pal` but not forest palette hexes; Task 9 pins them in `docs/art/theme-art.md` (art-owned, not invented by code). The spec lists `decor.kinds` with `yOffset`; this plan uses that field name exactly.

## Execution Handoff

Present this plan; wait for approval. Then run the orchestrator loop per task: implement (specialist agent; `ux-ui-designer` for Tasks 1–3; `developer` for Tasks 4–11) → verify (`pnpm exec playwright test tests/<file>.spec.js`, then `pnpm test`) → `code-reviewer` → `git-expert` commit. `git-expert` runs the commit commands; the implementer never commits. Art tasks must copy preview PNGs out of `test-results/` before any suite run (Playwright wipes it).
