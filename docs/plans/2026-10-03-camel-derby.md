# Kamel Derby Implementation Plan

> **For agentic workers:** execute this plan via the orchestrator loop: implement → verify → `code-reviewer` → `git-expert` commit. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the single-file pixel-art camel race game described by the spec — one `index.html`, zero runtime deps, works from `file://`, with a pure `window.GameCore` logic core and a Playwright dev test suite.

**Architecture:** One `index.html` with two inline `<script>` blocks in fixed order: `#core` defines pure `window.GameCore` (state + scoring + camera math, no DOM); `#app` defines `I18N`, the DOM UI controller, the canvas renderer, and `window.GameDebug` test hooks. The renderer runs a delta-time `requestAnimationFrame` loop, reads `GameCore` state each frame, computes a per-frame camera window, and draws everything procedurally. Tests live in `tests/` and load the game via `file://` (`pathToFileURL`).

**Tech Stack:** plain ES2020 JavaScript (no build, no TypeScript), HTML5 Canvas 2D, dev-only `@playwright/test` + pnpm.

**Spec:** `docs/specs/2026-10-03-camel-derby-design.md`

## Global Constraints

- Deliverable: ONE runtime file `index.html` at repo root. Zero runtime dependencies, no build step, no external assets, no network access.
- Must work opened directly from `file://`, offline.
- Dev tooling lives in `tests/`, `package.json`, `playwright.config.js`; dev files MUST NOT modify or be required by `index.html`.
- Dev dependency: `@playwright/test` only. Package manager: pnpm. Test code: plain JS (CommonJS), no TypeScript.
- Canvas buffer exactly `480×270` px. `ctx.imageSmoothingEnabled = false`. CSS `image-rendering: pixelated`. 16:9 preserved, integer-ish upscale.
- Camera auto-fit constants (points): `PAD=20`, `MIN_WINDOW=100`, goal-trigger slack `80`.
- Camel sprite constant `24×16` buffer px; only horizontal screen x from camera; one lane per camel; lerp `~300ms`; walk anim `600ms` (2 frames, incl. left movement); rAF delta-time loop; no artificial delays/sleeps anywhere.
- Camel count `2–8` (default `4`); goal `1–10000` (default `200`) + `∞` checkbox mutually exclusive; per-camel `+1/+5/+10` + exact-score input (invalid → validation hint, state unchanged); New race resets scores keeps config; EN/DE toggle, default EN, session-only.
- Palette (lane index order): `#e84a3a`, `#3a6ae8`, `#3aa84a`, `#e8c83a`, `#9a4ae8`, `#e88a3a`, `#3ad8d8`, `#e85a9a`.
- Goal mode: first camel `score >= goalScore` wins → race stops, input lockout, pixel winner banner, confetti, `aria-live="polite"`. Infinite: no finish line, no winner, no end.
- Art procedural only; seeded PRNG (fixed seed) so decorations are stable across frames; dark desert palette; sun, dunes, palms, cacti, rocks; checkered finish pole (goal mode only); milestone flags every `50` points with `6px monospace` label; confetti cleared on New race; NO idle bob.
- A11y: real DOM buttons/inputs/labels, keyboard reachable, visible focus, `aria-live`, canvas accessible label. Responsive: `<900px` panel stacks below canvas, no horizontal page scrollbar.
- No `TBD`/`TODO`/placeholders. Values copied verbatim from spec.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `index.html` | Whole game: DOM shell, CSS, `#core` (GameCore), `#app` (I18N + UI + renderer + GameDebug) | 1–5 |
| `package.json` | Dev metadata + scripts + `@playwright/test` devDependency | 1 |
| `playwright.config.js` | Playwright config (CommonJS, no webServer — tests use `file://`) | 1 |
| `tests/helpers.js` | Shared `file://` URL, navigation, console-error / network-request capture | 1 |
| `tests/unit.spec.js` | GameCore unit tests via `page.evaluate` | 1 |
| `tests/controls.spec.js` | DOM control + i18n E2E | 2 |
| `tests/render.spec.js` | Camera/bounds E2E via `GameDebug` | 3 |
| `tests/goal.spec.js` | Goal-end + infinite-mode E2E | 4 |
| `tests/app.spec.js` | No console errors, no network, responsive, a11y | 5 |
| `README.md` | Run + test instructions | 5 |

**Module (script) order inside `index.html` (fixed):** `#core` script → `#app` script. `#app` never references `#core` symbols before they are defined.

**Shared API names (identical across all tasks — do not rename):**

- `window.GameCore`: `addScore(camelId,n)`, `setScore(camelId,n)`, `setCamelCount(n)`, `setGoal(scoreOrNull)`, `resetRace()`, `computeCameraWindow(scores, goalScore|null)`, `mapScoreToScreenX(score, window, canvasWidth)`, `setLanguage(lang)`, `getState()`, `subscribe(fn)`, `camelName(index, language)`, `setClock(fn)`, constants `PALETTE, MIN_CAMELS, MAX_CAMELS, GOAL_MIN, GOAL_MAX, PAD, MIN_WINDOW, GOAL_SLACK, ANIM_MS`.
- `window.GameDebug`: `getState()`, `getCameraWindow()`, `getCanvasSize()`, `getCamelSpriteBounds()`, `isSettled()`, `getScene()`.
- `GameCore.getState()` returns `{ camels:[{id,name,color,score,lane,animUntil}], camelCount, goalScore, infinite, language, raceOver, winnerId }`.

## Verification (used by every task)

```bash
pnpm install
pnpm exec playwright install chromium
pnpm test
```

Single file: `pnpm exec playwright test tests/unit.spec.js` (swap filename per task).

---

### Task 1: Shell + GameCore + debug hooks + Playwright bootstrap

**Files:**
- Create: `package.json`, `playwright.config.js`, `tests/helpers.js`, `tests/unit.spec.js`, `index.html`

**Interfaces:**
- Consumes: nothing.
- Produces: `window.GameCore` (all functions above), `window.GameDebug`, geometry constants `CANVAS_W=480`, `CANVAS_H=270`, `HORIZON_Y=70`, `LANE_BOTTOM=266`, `SPRITE_W=24`, `SPRITE_H=16`, `LANE_MARGIN=2`; helper `laneHeight(n)/laneTopY(i,n)/laneBottomY(i,n)/camelTopY(i,n)/camelTargetLeft(score,win)`; runtime object `{visualLeft,lastWinnerId,confetti,frameWindow,finishVisible,goalScreenX}`; stubs `drawScene(s,win,now)` and `updateRuntime(s,dt,now)`.

- [ ] **Step 1: Write `package.json`** (CommonJS — no `"type"` field)

```json
{
  "name": "camel-game",
  "version": "1.0.0",
  "private": true,
  "description": "Single-file pixel-art camel race game (Kamel Derby).",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 2: Write `playwright.config.js`** (CommonJS `require`, no webServer)

```js
// Dev-only Playwright config. Loads index.html over file:// (no HTTP server).
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 3: Write `tests/helpers.js`**

```js
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const INDEX_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function gotoGame(page) {
  await page.goto(INDEX_URL);
}

// Attach capture BEFORE navigation so load-time errors/requests are caught.
async function openGame(page) {
  const errors = [];
  const requests = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('request', (req) => {
    if (!req.url().startsWith('file://')) requests.push(req.url());
  });
  await page.goto(INDEX_URL);
  return { errors, requests };
}

module.exports = { INDEX_URL, gotoGame, openGame };
```

- [ ] **Step 4: Write the failing unit test `tests/unit.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('GameCore unit', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('addScore and setScore update scores', async ({ page }) => {
    const score = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 10);
      GameCore.addScore('camel-0', 5);
      return GameCore.getState().camels[0].score;
    });
    expect(score).toBe(15);
  });

  test('validation rejects bad values without changing state', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 7);
      const results = [
        GameCore.addScore('camel-0', -1),
        GameCore.addScore('camel-0', 1.5),
        GameCore.addScore('camel-0', NaN),
        GameCore.setScore('camel-0', -3),
        GameCore.setScore('camel-0', 1.5),
        GameCore.setScore('camel-0', NaN),
        GameCore.setScore('camel-0', 'x'),
      ];
      return { results, score: GameCore.getState().camels[0].score };
    });
    expect(r.results).toEqual([false, false, false, false, false, false, false]);
    expect(r.score).toBe(7);
  });

  test('camel count clamps 2-8, growth keeps scores, shrink drops highest lanes', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(1);
      const low = GameCore.getState().camelCount;
      GameCore.setCamelCount(99);
      const high = GameCore.getState().camelCount;
      GameCore.setCamelCount(6);
      GameCore.setScore('camel-0', 10);
      GameCore.setScore('camel-5', 50);
      GameCore.setCamelCount(8);
      const afterGrow = GameCore.getState().camels.map((c) => c.score);
      GameCore.setCamelCount(2);
      const afterShrink = GameCore.getState().camels.map((c) => ({ id: c.id, score: c.score }));
      return { low, high, afterGrow, afterShrink, len: GameCore.getState().camels.length };
    });
    expect(r.low).toBe(2);
    expect(r.high).toBe(8);
    expect(r.afterGrow.slice(0, 6)).toEqual([10, 0, 0, 0, 0, 50]);
    expect(r.len).toBe(2);
    expect(r.afterShrink).toEqual([{ id: 'camel-0', score: 10 }, { id: 'camel-1', score: 0 }]);
  });

  test('goal and infinite mode are mutually exclusive', async ({ page }) => {
    const r = await page.evaluate(() => {
      const out = {};
      GameCore.setGoal(200);
      out.a = { goalScore: GameCore.getState().goalScore, infinite: GameCore.getState().infinite };
      GameCore.setGoal(null);
      out.b = { goalScore: GameCore.getState().goalScore, infinite: GameCore.getState().infinite };
      GameCore.setGoal(500);
      out.c = { goalScore: GameCore.getState().goalScore, infinite: GameCore.getState().infinite };
      out.bad0 = GameCore.setGoal(0);
      out.bad10001 = GameCore.setGoal(10001);
      out.still = { goalScore: GameCore.getState().goalScore, infinite: GameCore.getState().infinite };
      return out;
    });
    expect(r.a).toEqual({ goalScore: 200, infinite: false });
    expect(r.b).toEqual({ goalScore: null, infinite: true });
    expect(r.c).toEqual({ goalScore: 500, infinite: false });
    expect(r.bad0).toBe(false);
    expect(r.bad10001).toBe(false);
    expect(r.still).toEqual({ goalScore: 500, infinite: false });
  });

  test('computeCameraWindow: clustered, wide spread, goal inclusion, goal far away', async ({ page }) => {
    const r = await page.evaluate(() => ({
      clustered: GameCore.computeCameraWindow([100, 100, 100], null),
      wide: GameCore.computeCameraWindow([0, 5000], null),
      goalNear: GameCore.computeCameraWindow([0, 100], 150),
      goalFar: GameCore.computeCameraWindow([0, 100], 1000),
      equalWithGoal: GameCore.computeCameraWindow([200, 200], 200),
    }));
    expect(r.clustered).toEqual({ min: 80, max: 180 });
    expect(r.wide).toEqual({ min: -20, max: 5020 });
    expect(r.goalNear).toEqual({ min: -20, max: 170 });
    expect(r.goalFar).toEqual({ min: -20, max: 120 });
    expect(r.equalWithGoal).toEqual({ min: 180, max: 280 });
  });

  test('mapScoreToScreenX maps linearly and clamps to canvas', async ({ page }) => {
    const r = await page.evaluate(() => {
      const w = { min: 0, max: 100 };
      return [
        GameCore.mapScoreToScreenX(0, w, 480),
        GameCore.mapScoreToScreenX(50, w, 480),
        GameCore.mapScoreToScreenX(100, w, 480),
        GameCore.mapScoreToScreenX(-50, w, 480),
        GameCore.mapScoreToScreenX(150, w, 480),
      ];
    });
    expect(r).toEqual([0, 240, 480, 0, 480]);
  });

  test('reaching the goal ends the race and locks scores', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(200);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 200);
      const after = GameCore.getState();
      const blocked = GameCore.addScore('camel-1', 5);
      return {
        raceOver: after.raceOver,
        winnerId: after.winnerId,
        blocked,
        otherScore: GameCore.getState().camels[1].score,
      };
    });
    expect(r.raceOver).toBe(true);
    expect(r.winnerId).toBe('camel-0');
    expect(r.blocked).toBe(false);
    expect(r.otherScore).toBe(0);
  });

  test('resetRace clears scores/winner keeps config', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(6);
      GameCore.setGoal(300);
      GameCore.setScore('camel-0', 300);
      GameCore.resetRace();
      const s = GameCore.getState();
      return {
        raceOver: s.raceOver,
        winnerId: s.winnerId,
        scores: s.camels.map((c) => c.score),
        goalScore: s.goalScore,
        camelCount: s.camelCount,
      };
    });
    expect(r.raceOver).toBe(false);
    expect(r.winnerId).toBe(null);
    expect(r.scores).toEqual([0, 0, 0, 0, 0, 0]);
    expect(r.goalScore).toBe(300);
    expect(r.camelCount).toBe(6);
  });
});
```

- [ ] **Step 5: Run unit tests — expect FAIL**

Run: `pnpm install && pnpm exec playwright install chromium && pnpm exec playwright test tests/unit.spec.js`
Expected: FAIL — `GameCore is not defined` (index.html missing).

- [ ] **Step 6: Write `index.html`** (head + pixel CSS + markup + `#core` GameCore + `#app` scaffold with debug hooks)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KAMEL DERBY</title>
<style>
  :root {
    --bg:#120b1e; --panel:#1c1430; --panel2:#241b3a; --ink:#e8e0f0;
    --accent:#e8c83a; --border:#4a3550; --btn:#2b2140; --btn-hover:#3a2d55;
    --focus:#3ad8d8; --danger:#e84a3a;
  }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:var(--bg); color:var(--ink);
    font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size:14px; }
  body { padding:12px; }
  .app { max-width:1100px; margin:0 auto; }
  header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
  h1 { font-size:18px; letter-spacing:2px; margin:0; color:var(--accent); }
  main { display:flex; gap:12px; align-items:flex-start; }
  canvas#game { display:block; width:100%; max-width:480px; aspect-ratio:16/9;
    image-rendering:pixelated; background:#000; border:2px solid var(--border); }
  #panel { flex:1 1 260px; min-width:220px; background:var(--panel);
    border:2px solid var(--border); padding:10px; }
  .row { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
  label { font-size:13px; }
  input[type=number] { width:80px; background:var(--panel2); color:var(--ink);
    border:2px solid var(--border); padding:4px 6px; font:inherit; }
  input:disabled { opacity:.45; }
  button { background:var(--btn); color:var(--ink); border:2px solid var(--border);
    padding:4px 8px; font:inherit; cursor:pointer; border-radius:0; }
  button:hover:not(:disabled) { background:var(--btn-hover); }
  button:disabled { opacity:.45; cursor:not-allowed; }
  button[aria-pressed="true"] { background:var(--accent); color:#1a1208; }
  .lang button { min-width:44px; }
  :focus-visible { outline:2px solid var(--focus); outline-offset:1px; }
  .lane { border-top:2px solid var(--border); padding-top:8px; margin-top:8px; }
  .lane:first-child { border-top:0; padding-top:0; margin-top:0; }
  .lane .cname { display:inline-block; min-width:84px; font-weight:bold; }
  .lane .btns { display:inline-flex; gap:4px; margin:4px 0; }
  #validation { color:var(--danger); margin:6px 0 0; font-size:13px; }
  #live { position:absolute; width:1px; height:1px; margin:-1px; padding:0; border:0;
    overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
</style>
</head>
<body>
<div class="app">
  <header>
    <h1 id="title">KAMEL DERBY</h1>
    <div class="lang" role="group" aria-label="Language" id="languageToggle">
      <button id="lang-en" type="button" aria-pressed="true">EN</button>
      <button id="lang-de" type="button" aria-pressed="false">DE</button>
    </div>
  </header>
  <main>
    <canvas id="game" width="480" height="270"
      aria-label="Camel race track. Camels race left to right to the goal."></canvas>
    <aside id="panel" aria-label="Controls">
      <div class="row">
        <label for="camelCount" id="camelCountLabel">Camels</label>
        <input id="camelCount" type="number" min="2" max="8" step="1" value="4">
      </div>
      <div class="row">
        <label for="goalScore" id="goalLabel">Goal</label>
        <input id="goalScore" type="number" min="1" max="10000" step="1" value="200">
        <label for="infinite"><input id="infinite" type="checkbox"> <span id="infiniteText">∞</span></label>
      </div>
      <div id="laneControls"></div>
      <div class="row" style="margin-top:8px">
        <button id="newRace" type="button">New race</button>
      </div>
      <p id="validation" role="alert" hidden>Enter a whole number ≥ 0.</p>
    </aside>
  </main>
  <div id="live" aria-live="polite" role="status"></div>
</div>
<script id="core">
window.GameCore = (function () {
  'use strict';
  const PALETTE = ['#e84a3a', '#3a6ae8', '#3aa84a', '#e8c83a', '#9a4ae8', '#e88a3a', '#3ad8d8', '#e85a9a'];
  const MIN_CAMELS = 2, MAX_CAMELS = 8;
  const GOAL_MIN = 1, GOAL_MAX = 10000;
  const PAD = 20, MIN_WINDOW = 100, GOAL_SLACK = 80;
  const ANIM_MS = 600;

  let clock = (typeof performance !== 'undefined' && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };

  const state = {
    camels: [],
    camelCount: 4,
    goalScore: 200,
    infinite: false,
    language: 'en',
    raceOver: false,
    winnerId: null,
  };

  const listeners = new Set();
  function subscribe(fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }
  function emit() { for (const fn of listeners) fn(getState()); }

  function camelName(index, language) {
    return (language === 'de' ? 'Kamel ' : 'Camel ') + (index + 1);
  }

  function makeCamel(index, score) {
    return {
      id: 'camel-' + index,
      name: camelName(index, state.language),
      color: PALETTE[index % PALETTE.length],
      score: score,
      lane: index,
      animUntil: 0,
    };
  }

  function isValidScore(n) {
    return typeof n === 'number' && Number.isInteger(n) && !Number.isNaN(n) && n >= 0;
  }

  function findCamel(id) {
    for (const c of state.camels) if (c.id === id) return c;
    return null;
  }

  function rebuildCamels(count) {
    const next = [];
    for (let i = 0; i < count; i++) {
      const existing = state.camels[i];
      if (existing) {
        next.push({
          id: existing.id,
          name: camelName(i, state.language),
          color: PALETTE[i % PALETTE.length],
          score: existing.score,
          lane: i,
          animUntil: existing.animUntil,
        });
      } else {
        next.push(makeCamel(i, 0));
      }
    }
    state.camels = next;
    state.camelCount = count;
  }

  function checkWinner() {
    if (state.raceOver || state.infinite || state.goalScore == null) return;
    for (const c of state.camels) {
      if (c.score >= state.goalScore) {
        state.raceOver = true;
        state.winnerId = c.id;
        return;
      }
    }
  }

  function addScore(camelId, n) {
    if (state.raceOver) return false;
    const c = findCamel(camelId);
    if (!c) return false;
    if (typeof n !== 'number' || !Number.isInteger(n) || !Number.isFinite(n) || n <= 0) return false;
    c.score += n;
    c.animUntil = clock() + ANIM_MS;
    checkWinner();
    emit();
    return true;
  }

  function setScore(camelId, n) {
    if (state.raceOver) return false;
    const c = findCamel(camelId);
    if (!c) return false;
    if (!isValidScore(n)) return false;
    c.score = n;
    c.animUntil = clock() + ANIM_MS;
    checkWinner();
    emit();
    return true;
  }

  function setCamelCount(n) {
    if (!Number.isInteger(n)) return false;
    const count = Math.max(MIN_CAMELS, Math.min(MAX_CAMELS, n));
    rebuildCamels(count);
    emit();
    return true;
  }

  function setGoal(scoreOrNull) {
    if (scoreOrNull === null) {
      state.infinite = true;
      state.goalScore = null;
    } else {
      if (!Number.isInteger(scoreOrNull) || scoreOrNull < GOAL_MIN || scoreOrNull > GOAL_MAX) return false;
      state.infinite = false;
      state.goalScore = scoreOrNull;
    }
    emit();
    return true;
  }

  function resetRace() {
    for (const c of state.camels) c.score = 0;
    state.raceOver = false;
    state.winnerId = null;
    emit();
    return true;
  }

  function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'de') return false;
    state.language = lang;
    for (let i = 0; i < state.camels.length; i++) state.camels[i].name = camelName(i, lang);
    emit();
    return true;
  }

  function setClock(fn) { clock = fn; }

  function getState() {
    return {
      camels: state.camels.map(function (c) {
        return { id: c.id, name: c.name, color: c.color, score: c.score, lane: c.lane, animUntil: c.animUntil };
      }),
      camelCount: state.camelCount,
      goalScore: state.goalScore,
      infinite: state.infinite,
      language: state.language,
      raceOver: state.raceOver,
      winnerId: state.winnerId,
    };
  }

  function computeCameraWindow(scores, goalScore) {
    if (!Array.isArray(scores) || scores.length === 0) return { min: 0, max: MIN_WINDOW };
    let minScore = Infinity, maxScore = -Infinity;
    for (const s of scores) {
      const v = (typeof s === 'number' && Number.isFinite(s)) ? s : 0;
      if (v < minScore) minScore = v;
      if (v > maxScore) maxScore = v;
    }
    const span = maxScore - minScore;
    const wMin = minScore - PAD;
    let wMax = Math.max(maxScore + PAD, wMin + MIN_WINDOW);
    if (goalScore != null && Number.isFinite(goalScore) && (goalScore - wMin) <= (span + GOAL_SLACK)) {
      wMax = Math.max(wMax, goalScore + PAD);
    }
    return { min: wMin, max: wMax };
  }

  function mapScoreToScreenX(score, window, canvasWidth) {
    const w = window || { min: 0, max: MIN_WINDOW };
    const width = (typeof canvasWidth === 'number' && canvasWidth > 0) ? canvasWidth : 480;
    const span = w.max - w.min;
    if (span <= 0) return 0;
    const x = ((score - w.min) / span) * width;
    return Math.max(0, Math.min(width, x));
  }

  rebuildCamels(state.camelCount);

  return {
    PALETTE: PALETTE,
    MIN_CAMELS: MIN_CAMELS, MAX_CAMELS: MAX_CAMELS,
    GOAL_MIN: GOAL_MIN, GOAL_MAX: GOAL_MAX,
    PAD: PAD, MIN_WINDOW: MIN_WINDOW, GOAL_SLACK: GOAL_SLACK, ANIM_MS: ANIM_MS,
    addScore: addScore, setScore: setScore, setCamelCount: setCamelCount,
    setGoal: setGoal, resetRace: resetRace, setLanguage: setLanguage,
    setClock: setClock, getState: getState, subscribe: subscribe,
    camelName: camelName, computeCameraWindow: computeCameraWindow,
    mapScoreToScreenX: mapScoreToScreenX,
  };
})();
</script>
<script id="app">
(function () {
  'use strict';
  const core = window.GameCore;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const CANVAS_W = canvas.width;   // 480
  const CANVAS_H = canvas.height;  // 270

  const HORIZON_Y = 70;
  const LANE_BOTTOM = CANVAS_H - 4; // 266
  const SPRITE_W = 24;
  const SPRITE_H = 16;
  const LANE_MARGIN = 2;
  const LERP_MS = 300;
  const ANIM_FRAME_MS = 100;

  const runtime = {
    visualLeft: Object.create(null),
    lastWinnerId: null,
    confetti: [],
    frameWindow: null,
    finishVisible: false,
    goalScreenX: null,
  };

  function laneHeight(n) { return (LANE_BOTTOM - HORIZON_Y) / n; }
  function laneTopY(i, n) { return HORIZON_Y + i * laneHeight(n); }
  function laneBottomY(i, n) { return laneTopY(i, n) + laneHeight(n); }
  function camelTopY(i, n) { return laneBottomY(i, n) - SPRITE_H - 2; }
  function mapX(point, win) { return core.mapScoreToScreenX(point, win, CANVAS_W); }
  function camelTargetLeft(score, win) {
    const cx = mapX(score, win);
    return Math.max(LANE_MARGIN, Math.min(CANVAS_W - SPRITE_W - LANE_MARGIN, cx - SPRITE_W / 2));
  }
  function currentWindow(s) {
    return core.computeCameraWindow(s.camels.map(function (c) { return c.score; }), s.goalScore);
  }

  // Task 3 replaces this stub.
  function updateRuntime(s, dt, now) { /* Task 3 */ }
  // Task 3 replaces this stub.
  function drawScene(s, win, now) { /* Task 3 */ }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last);
    last = now;
    const s = core.getState();
    const win = currentWindow(s);
    runtime.frameWindow = win;
    updateRuntime(s, dt, now);
    drawScene(s, win, now);
    window.requestAnimationFrame(frame);
  }

  window.GameDebug = {
    getState: function () { return core.getState(); },
    getCameraWindow: function () {
      const w = runtime.frameWindow || currentWindow(core.getState());
      return { min: w.min, max: w.max };
    },
    getCanvasSize: function () { return { width: CANVAS_W, height: CANVAS_H }; },
    getCamelSpriteBounds: function () {
      const s = core.getState();
      const win = runtime.frameWindow || currentWindow(s);
      const n = s.camels.length;
      return s.camels.map(function (c, i) {
        const v = runtime.visualLeft[c.id];
        const left = (v == null) ? camelTargetLeft(c.score, win) : v;
        const top = camelTopY(i, n);
        return { id: c.id, lane: i, left: left, right: left + SPRITE_W, top: top, bottom: top + SPRITE_H };
      });
    },
    isSettled: function () {
      const s = core.getState();
      const win = runtime.frameWindow || currentWindow(s);
      return s.camels.every(function (c) {
        const v = runtime.visualLeft[c.id];
        if (v == null) return true;
        return Math.abs(v - camelTargetLeft(c.score, win)) <= 0.5;
      });
    },
    getScene: function () {
      return { finishVisible: runtime.finishVisible, goalScreenX: runtime.goalScreenX };
    },
  };

  window.requestAnimationFrame(frame);
})();
</script>
</body>
</html>
```

- [ ] **Step 7: Run unit tests — expect PASS**

Run: `pnpm exec playwright test tests/unit.spec.js`
Expected: PASS, 8 tests passed.

- [ ] **Step 8: Run full suite — expect PASS (only unit tests exist)**

Run: `pnpm test`
Expected: PASS, 8 passed.

- [ ] **Step 9: Commit** (executed by `git-expert` in orchestrator loop)

```bash
git add index.html package.json playwright.config.js tests/helpers.js tests/unit.spec.js
git commit -m "feat: add game shell, GameCore logic, and Playwright bootstrap"
```

---

### Task 2: DOM controls + EN/DE i18n + New race

**Files:**
- Modify: `index.html` (`#app` script — insert I18N + UI controller; leave `updateRuntime`/`drawScene` stubs)
- Create: `tests/controls.spec.js`

**Interfaces:**
- Consumes: `window.GameCore` (Task 1), `window.GameDebug` (Task 1).
- Produces: `I18N` object, `t(lang, key, vars)` helper, `syncDom(s)` function, `buildLane(camel, index)` function, `renderLanes(s)`, `showValidation()`/`hideValidation()`, module var `lastGoal`. DOM ids used by tests: `#camelCount`, `#goalScore`, `#infinite`, `#infiniteText`, `#newRace`, `#validation`, `#live`, `#lang-en`, `#lang-de`, `#laneControls`, `.lane`, `[data-action="add"]`, `[data-action="set"]`, `[data-exact]`, `[data-name]`, `[data-score-label]`.

- [ ] **Step 1: Write the failing E2E test `tests/controls.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('Controls and i18n', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('initial render shows 4 camel lanes', async ({ page }) => {
    await expect(page.locator('.lane')).toHaveCount(4);
    await expect(page.locator('.lane').nth(0).locator('[data-name]')).toHaveText('Camel 1');
  });

  test('+5 moves camel right and updates score display', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const before = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="5"]').click();
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toHaveValue('5');
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const after = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    expect(after).toBeGreaterThan(before);
  });

  test('exact score moves right then left', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    const at0 = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('20');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const at20 = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('5');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const at5 = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    expect(at20).toBeGreaterThan(at0);
    expect(at5).toBeLessThan(at20);
  });

  test('changing count to 6 adds lanes', async ({ page }) => {
    await page.locator('#camelCount').fill('6');
    await page.locator('#camelCount').blur();
    await expect(page.locator('.lane')).toHaveCount(6);
  });

  test('invalid exact score shows hint and keeps score', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('-3');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#validation')).toBeVisible();
    await expect(page.locator('#validation')).toHaveText('Enter a whole number ≥ 0.');
    const score = await page.evaluate(() => GameCore.getState().camels[0].score);
    expect(score).toBe(0);
  });

  test('EN/DE toggle switches visible strings', async ({ page }) => {
    await page.locator('#lang-de').click();
    await expect(page.locator('#newRace')).toHaveText('Neues Rennen');
    await expect(page.locator('#goalLabel')).toHaveText('Ziel');
    await expect(page.locator('#camelCountLabel')).toHaveText('Kamele');
    await expect(page.locator('.lane').nth(0).locator('[data-name]')).toHaveText('Kamel 1');
    await expect(page.locator('.lane').nth(0).locator('[data-score-label]')).toHaveText('Punktzahl');
    await expect(page.locator('.lane').nth(0).locator('[data-action="set"]')).toHaveText('Setzen');
    await expect(page.locator('#lang-de')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lang-en')).toHaveAttribute('aria-pressed', 'false');
  });

  test('language toggle preserves config', async ({ page }) => {
    await page.locator('#goalScore').fill('777');
    await page.locator('#goalScore').blur();
    await page.locator('#lang-de').click();
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.goalScore).toBe(777);
    expect(s.camelCount).toBe(4);
  });
});
```

- [ ] **Step 2: Run new tests — expect FAIL**

Run: `pnpm exec playwright test tests/controls.spec.js`
Expected: FAIL — `.lane` count is 0 (no lanes rendered, no i18n).

- [ ] **Step 3: Insert I18N + UI block into `index.html` `#app` script**

Insert this block immediately AFTER the `currentWindow` function definition and BEFORE the `updateRuntime` stub.

```js
  // ---------- i18n ----------
  const I18N = {
    en: {
      title: 'KAMEL DERBY',
      camelCountLabel: 'Camels',
      goalLabel: 'Goal',
      infiniteLabel: '∞',
      plus1: '+1', plus5: '+5', plus10: '+10',
      scoreLabel: 'Score',
      setButton: 'Set',
      newRace: 'New race',
      winnerBanner: 'Camel {n} wins!',
      languageToggle: 'EN / DE',
      validationHint: 'Enter a whole number ≥ 0.',
      camelName: 'Camel {n}',
      canvasLabel: 'Camel race track. Camels race left to right to the goal.',
    },
    de: {
      title: 'KAMEL DERBY',
      camelCountLabel: 'Kamele',
      goalLabel: 'Ziel',
      infiniteLabel: '∞',
      plus1: '+1', plus5: '+5', plus10: '+10',
      scoreLabel: 'Punktzahl',
      setButton: 'Setzen',
      newRace: 'Neues Rennen',
      winnerBanner: 'Kamel {n} gewinnt!',
      languageToggle: 'EN / DE',
      validationHint: 'Bitte eine ganze Zahl ≥ 0 eingeben.',
      camelName: 'Kamel {n}',
      canvasLabel: 'Kamelrennen. Kamele rennen von links nach rechts zum Ziel.',
    },
  };

  function t(lang, key, vars) {
    let str = I18N[lang][key];
    if (vars) {
      for (const k in vars) str = str.replace('{' + k + '}', String(vars[k]));
    }
    return str;
  }

  // ---------- UI controller ----------
  const camelCountEl = document.getElementById('camelCount');
  const goalEl = document.getElementById('goalScore');
  const infiniteEl = document.getElementById('infinite');
  const laneContainer = document.getElementById('laneControls');
  const validationEl = document.getElementById('validation');
  const liveEl = document.getElementById('live');
  let lastGoal = 200;
  let renderedCount = -1;

  function showValidation() { validationEl.hidden = false; }
  function hideValidation() { validationEl.hidden = true; }

  function buildLane(camel, index) {
    const el = document.createElement('div');
    el.className = 'lane';
    el.dataset.index = String(index);
    el.innerHTML =
      '<span class="cname" data-name></span>' +
      '<div class="btns">' +
        '<button type="button" data-action="add" data-n="1"></button>' +
        '<button type="button" data-action="add" data-n="5"></button>' +
        '<button type="button" data-action="add" data-n="10"></button>' +
      '</div>' +
      '<div class="row">' +
        '<label data-score-label for="exact-' + index + '"></label>' +
        '<input id="exact-' + index + '" type="number" min="0" step="1" data-exact value="0">' +
        '<button type="button" data-action="set"></button>' +
      '</div>';
    return el;
  }

  function renderLanes(s) {
    if (renderedCount !== s.camels.length) {
      laneContainer.replaceChildren.apply(laneContainer, s.camels.map(buildLane));
      renderedCount = s.camels.length;
    }
    const lanes = laneContainer.querySelectorAll('.lane');
    s.camels.forEach(function (c, i) {
      const el = lanes[i];
      if (!el) return;
      const name = el.querySelector('[data-name]');
      name.textContent = c.name;
      name.style.color = c.color;
      el.querySelector('[data-action="add"][data-n="1"]').textContent = t(s.language, 'plus1');
      el.querySelector('[data-action="add"][data-n="5"]').textContent = t(s.language, 'plus5');
      el.querySelector('[data-action="add"][data-n="10"]').textContent = t(s.language, 'plus10');
      el.querySelector('[data-score-label]').textContent = t(s.language, 'scoreLabel');
      el.querySelector('[data-action="set"]').textContent = t(s.language, 'setButton');
      el.querySelector('[data-exact]').value = String(c.score);
      // Task 4 adds input lockout here.
    });
  }

  function syncDom(s) {
    document.getElementById('title').textContent = t(s.language, 'title');
    document.getElementById('camelCountLabel').textContent = t(s.language, 'camelCountLabel');
    document.getElementById('goalLabel').textContent = t(s.language, 'goalLabel');
    document.getElementById('infiniteText').textContent = t(s.language, 'infiniteLabel');
    document.getElementById('newRace').textContent = t(s.language, 'newRace');
    document.getElementById('lang-en').setAttribute('aria-pressed', String(s.language === 'en'));
    document.getElementById('lang-de').setAttribute('aria-pressed', String(s.language === 'de'));
    canvas.setAttribute('aria-label', t(s.language, 'canvasLabel'));

    camelCountEl.value = String(s.camelCount);
    infiniteEl.checked = s.infinite;
    goalEl.disabled = s.infinite;
    if (!s.infinite && s.goalScore != null) goalEl.value = String(s.goalScore);

    renderLanes(s);
    // Task 4 adds winner aria-live announcement here.
  }

  laneContainer.addEventListener('click', function (ev) {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const laneEl = btn.closest('.lane');
    const idx = Number(laneEl.dataset.index);
    const camel = core.getState().camels[idx];
    if (!camel) return;
    const action = btn.dataset.action;
    if (action === 'add') {
      if (core.addScore(camel.id, Number(btn.dataset.n))) hideValidation();
    } else if (action === 'set') {
      const raw = laneEl.querySelector('[data-exact]').value.trim();
      if (/^\d+$/.test(raw)) {
        if (core.setScore(camel.id, Number(raw))) hideValidation();
      } else {
        showValidation();
      }
    }
  });

  camelCountEl.addEventListener('change', function () {
    const v = Number(camelCountEl.value);
    if (Number.isFinite(v)) core.setCamelCount(Math.floor(v));
    camelCountEl.value = String(core.getState().camelCount);
  });

  goalEl.addEventListener('change', function () {
    const v = Number(goalEl.value);
    if (Number.isInteger(v) && v >= GameCore.GOAL_MIN && v <= GameCore.GOAL_MAX) {
      if (core.setGoal(v)) { lastGoal = v; hideValidation(); }
    } else {
      goalEl.value = String(core.getState().goalScore != null ? core.getState().goalScore : lastGoal);
    }
  });

  infiniteEl.addEventListener('change', function () {
    if (infiniteEl.checked) {
      const g = core.getState().goalScore;
      if (g != null) lastGoal = g;
      core.setGoal(null);
    } else {
      core.setGoal(lastGoal);
    }
  });

  document.getElementById('newRace').addEventListener('click', function () {
    hideValidation();
    core.resetRace();
  });

  document.getElementById('lang-en').addEventListener('click', function () { core.setLanguage('en'); });
  document.getElementById('lang-de').addEventListener('click', function () { core.setLanguage('de'); });

  core.subscribe(syncDom);
  hideValidation();
  syncDom(core.getState());
```

- [ ] **Step 4: Run controls tests — expect PASS**

Run: `pnpm exec playwright test tests/controls.spec.js`
Expected: PASS, 7 tests passed.

- [ ] **Step 5: Run full suite — expect PASS**

Run: `pnpm test`
Expected: PASS, 15 passed.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/controls.spec.js
git commit -m "feat: add DOM controls and EN/DE i18n"
```

---

### Task 3: Canvas renderer — camera auto-fit + decor + camel sprites + movement/walk anim

**Files:**
- Modify: `index.html` (`#app` script — add sprite data, art helpers, implement `updateRuntime` and `drawScene`)
- Create: `tests/render.spec.js`

**Interfaces:**
- Consumes: Task 1 geometry + `runtime` + `GameDebug`; Task 2 `I18N`/`t`.
- Produces: sprite matrices `CAMEL` (array of 3 frame row-arrays), `PALM`, `CACTUS`, `ROCK`; helpers `drawSprite(rows, x, y, palette)`, `darken(hex, factor)`, `mulberry32(seed)`, `hash2(a,b)`; constants `SEED=1337`, `DECOR_SPACING=90`, palette colors `COL`, `PALM_PAL`, `CACTUS_PAL`, `ROCK_PAL`, `SKY_BANDS`.

- [ ] **Step 1: Write the failing E2E test `tests/render.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('Renderer camera and bounds', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('canvas buffer is 480x270', async ({ page }) => {
    const size = await page.evaluate(() => GameDebug.getCanvasSize());
    expect(size).toEqual({ width: 480, height: 270 });
  });

  test('all-equal scores keep window >= MIN_WINDOW', async ({ page }) => {
    const win = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.resetRace();
      return GameCore.computeCameraWindow([0, 0, 0, 0], null);
    });
    expect(win.max - win.min).toBeGreaterThanOrEqual(100);
  });

  test('extreme spread keeps every camel sprite inside the canvas', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(null);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 0);
      GameCore.setScore('camel-1', 5000);
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const bounds = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
    expect(bounds.length).toBe(4);
    for (const b of bounds) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(480);
      expect(b.right - b.left).toBe(24);
    }
  });

  test('infinite mode 5000+ stays in bounds', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(null);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 10000);
      GameCore.setScore('camel-1', 0);
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.locator('.lane').nth(1).locator('[data-action="add"][data-n="10"]').click();
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const bounds = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
    for (const b of bounds) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(480);
    }
  });
});
```

- [ ] **Step 2: Run new tests — expect FAIL**

Run: `pnpm exec playwright test tests/render.spec.js`
Expected: FAIL — `isSettled` never true / bounds not in place (no lerp implemented; `updateRuntime` is a stub, `visualLeft` empty so `isSettled` returns true, but extreme-spread bounds are computed from target... they clamp, so bounds tests may pass; the failing one is `infinite mode` needs the `+10` click to work — it will). If all bounds tests pass against the target math, that is acceptable at this step; the goal is to prove the renderer populates `runtime.visualLeft` and draws. Proceed either way; the assertion that matters is the sprite-pixel render below.

Add this assertion to `render.spec.js` before running (proves pixels are drawn):

```js
  test('camels are drawn (non-background pixels present in lane area)', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const nonEmpty = await page.evaluate(() => {
      const c = document.getElementById('game');
      const g = c.getContext('2d');
      const data = g.getImageData(0, 90, 480, 170).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (!(data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0)) count++;
      }
      return count;
    });
    expect(nonEmpty).toBeGreaterThan(1000);
  });
```

- [ ] **Step 3: Replace the `updateRuntime` and `drawScene` stubs in `index.html`, and insert sprite art**

Insert this block immediately BEFORE the current `updateRuntime` stub, then REPLACE the two stub function bodies (`updateRuntime`, `drawScene`) with the implementations below.

```js
  // ---------- art ----------
  const COL = {
    outline: '#1a1208',
    eye: '#0a0a0a',
    hoof: '#3a2410',
    pole: '#d8d8d8',
    checkerLight: '#f0f0f0',
    checkerDark: '#1a1a1a',
    flag: '#e8c83a',
  };
  const SKY_BANDS = ['#1a1030', '#241640', '#2e1c4a'];
  const PALM_PAL = { body: '#6b4a2a', shade: '#4a3320', grass: '#2f6b3a' };
  const CACTUS_PAL = { body: '#2f6b3a', shade: '#24502d', grass: '#2f6b3a' };
  const ROCK_PAL = { body: '#6b5570', shade: '#4a3a50', grass: '#4a3a50' };

  const SEED = 1337;
  const DECOR_SPACING = 90;

  // Camel 24x16. Legend: . transparent, O outline, B body(palette-swap),
  // D body-shade, E eye, H hoof.
  const CAMEL = [
    [ // frame 0: standing
      '........................',
      '....OOO...OOO...........',
      '...OBBBO.OBBBO...OOOO...',
      '..OBBBBBOBBBBBO.OBEBO...',
      '..OBBBBBBBBBBBBOBBBBO...',
      '..OBBBBBBBBBBBBBBBBBO...',
      '..OBBBBBBBBBBBBBBO......',
      '..OBBBBBBBBBBBOO........',
      '..OBBBBBBBBBBBO.........',
      '..OOOOOOOOOOOOO.........',
      '..OBO.OBO..OBO.OBO......',
      '..OBO.OBO..OBO.OBO......',
      '..OBO.OBO..OBO.OBO......',
      '..OOO.OOO..OOO.OOO......',
      '........................',
      '........................',
    ],
    [ // frame 1: walk A
      '........................',
      '....OOO...OOO...........',
      '...OBBBO.OBBBO...OOOO...',
      '..OBBBBBOBBBBBO.OBEBO...',
      '..OBBBBBBBBBBBBOBBBBO...',
      '..OBBBBBBBBBBBBBBBBBO...',
      '..OBBBBBBBBBBBBBBO......',
      '..OBBBBBBBBBBBOO........',
      '..OBBBBBBBBBBBO.........',
      '..OOOOOOOOOOOOO.........',
      '.OBO..OBO...OBO.OBO.....',
      '..OBO.OBO..OBO..OBO.....',
      '..OBO.OBO..OBO..OBO.....',
      '..OOO.OOO..OOO..OOO.....',
      '........................',
      '........................',
    ],
    [ // frame 2: walk B
      '........................',
      '....OOO...OOO...........',
      '...OBBBO.OBBBO...OOOO...',
      '..OBBBBBOBBBBBO.OBEBO...',
      '..OBBBBBBBBBBBBOBBBBO...',
      '..OBBBBBBBBBBBBBBBBBO...',
      '..OBBBBBBBBBBBBBBO......',
      '..OBBBBBBBBBBBOO........',
      '..OBBBBBBBBBBBO.........',
      '..OOOOOOOOOOOOO.........',
      '...OBO.OBO..OBO.OBO.....',
      '..OBO.OBO..OBO..OBO.....',
      '..OBO.OBO..OBO..OBO.....',
      '..OOO.OOO..OOO..OOO.....',
      '........................',
      '........................',
    ],
  ];

  // Palm 16x20. Legend adds: G frond, B trunk.
  const PALM = [
    '....OO......OO..',
    '..OOGGOO..OOGGO.',
    '.OGGOGGOOOGGOGO.',
    'OGOGGGGGGGGOGGGO',
    '.OGGGGGGGGGGOO..',
    '..OGGGGOOOO.....',
    '....OOO.........',
    '.....OO.........',
    '.....OO.........',
    '....OBO.........',
    '....OBO.........',
    '....OBO.........',
    '....OBO.........',
    '....OBO.........',
    '....OBO.........',
    '....OBO.........',
    '....OBO.........',
    '....OBO.........',
    '...OBBBO........',
    '...OOOOO........',
  ];

  // Cactus 12x16. Legend: O outline, B body.
  const CACTUS = [
    '...OO.......',
    '..OBO.......',
    '..OBO.......',
    '..OBO..OO...',
    'OBOBO..OBO..',
    'OBOBOOOOBO..',
    'OBOBO..OBO..',
    '.OOO...OBO..',
    '...OBO.OBO..',
    '...OBO.OO...',
    '...OBO......',
    '...OBO......',
    '...OBO......',
    '...OBO......',
    '...OBO......',
    '...OOO......',
  ];

  // Rock 12x8. Legend: O outline, B body.
  const ROCK = [
    '...OOOO.....',
    '..OBBBBOO...',
    '.OBBBBBBBO..',
    'OBBBBBBBBBO.',
    'OBBBBBBBBBBO',
    'OBBBBBBBBBO.',
    '.OOOOOOOOO..',
    '............',
  ];

  function darken(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * factor);
    const g = Math.round(((n >> 8) & 255) * factor);
    const b = Math.round((n & 255) * factor);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function drawSprite(rows, x, y, palette) {
    const ox = Math.round(x);
    const oy = Math.round(y);
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        let color = null;
        if (ch === 'O') color = COL.outline;
        else if (ch === 'B') color = palette.body;
        else if (ch === 'D') color = palette.shade;
        else if (ch === 'G') color = palette.grass;
        else if (ch === 'E') color = COL.eye;
        else if (ch === 'H') color = COL.hoof;
        else if (ch === 'P') color = COL.pole;
        else if (ch === 'C') color = COL.checkerLight;
        else if (ch === 'K') color = COL.checkerDark;
        else if (ch === 'F') color = COL.flag;
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + rx, oy + ry, 1, 1);
        }
      }
    }
  }

  function hash2(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawSky() {
    const bandH = Math.ceil(HORIZON_Y / SKY_BANDS.length);
    for (let i = 0; i < SKY_BANDS.length; i++) {
      ctx.fillStyle = SKY_BANDS[i];
      ctx.fillRect(0, i * bandH, CANVAS_W, bandH);
    }
  }

  function drawSun() {
    const cx = 408, cy = 30, r = 13;
    for (let dy = -r; dy <= r; dy++) {
      const span = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillStyle = (Math.abs(dy) > r - 3) ? '#f0c060' : '#e8a03a';
      ctx.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
    }
  }

  function drawDuneBand(baseY, offset, color) {
    ctx.fillStyle = color;
    for (let x = 0; x < CANVAS_W; x++) {
      const tt = (x + offset) * 0.05;
      const h = 6 + Math.round(Math.sin(tt) * 4 + Math.sin(tt * 0.5) * 2);
      const top = baseY - h;
      ctx.fillRect(x, top, 1, HORIZON_Y - top + 2);
    }
  }

  function drawDunes(win) {
    drawDuneBand(HORIZON_Y - 18, (win.min * 0.3) % 120, '#3a2a4a');
    drawDuneBand(HORIZON_Y - 6, (win.min * 0.6) % 90, '#4a3550');
  }

  function drawDecor(win) {
    const startK = Math.floor((win.min - DECOR_SPACING) / DECOR_SPACING);
    const endK = Math.ceil((win.max + DECOR_SPACING) / DECOR_SPACING);
    for (let k = startK; k <= endK; k++) {
      const rng = mulberry32(hash2(SEED, k));
      const roll = rng();
      const point = k * DECOR_SPACING + Math.floor(rng() * 40 - 20);
      const x = mapX(point, win) - 8;
      if (x < -16 || x > CANVAS_W + 16) continue;
      if (roll < 0.34) drawSprite(PALM, x, HORIZON_Y - 20, PALM_PAL);
      else if (roll < 0.67) drawSprite(CACTUS, x, HORIZON_Y - 16, CACTUS_PAL);
      else drawSprite(ROCK, x, HORIZON_Y - 8, ROCK_PAL);
    }
  }

  function drawLanes(s) {
    const n = s.camels.length;
    const lh = laneHeight(n);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = (i % 2 === 0) ? '#241b33' : '#2b2140';
      ctx.fillRect(0, Math.round(laneTopY(i, n)), CANVAS_W, Math.ceil(lh));
      ctx.fillStyle = '#3a2d55';
      ctx.fillRect(0, Math.round(laneBottomY(i, n)) - 1, CANVAS_W, 1);
    }
  }

  function drawCamels(s, win, now) {
    const n = s.camels.length;
    s.camels.forEach(function (c, i) {
      const v = runtime.visualLeft[c.id];
      const left = (v == null) ? camelTargetLeft(c.score, win) : v;
      const frameIndex = (now < c.animUntil) ? (Math.floor(now / ANIM_FRAME_MS) % 2) + 1 : 0;
      const pal = { body: c.color, shade: darken(c.color, 0.55), grass: c.color };
      drawSprite(CAMEL[frameIndex], left, camelTopY(i, n), pal);
    });
  }
```

Replace the `updateRuntime` stub body with:

```js
  function updateRuntime(s, dt, now) {
    const win = runtime.frameWindow;
    for (const c of s.camels) {
      const target = camelTargetLeft(c.score, win);
      let v = runtime.visualLeft[c.id];
      if (v == null) {
        runtime.visualLeft[c.id] = target;
        continue;
      }
      const k = 1 - Math.exp(-dt / LERP_MS);
      v += (target - v) * k;
      if (Math.abs(target - v) < 0.5) v = target;
      runtime.visualLeft[c.id] = v;
    }
    const ids = new Set(s.camels.map(function (c) { return c.id; }));
    for (const id of Object.keys(runtime.visualLeft)) {
      if (!ids.has(id)) delete runtime.visualLeft[id];
    }
    runtime.finishVisible = !s.infinite && s.goalScore != null;
    runtime.goalScreenX = runtime.finishVisible ? mapX(s.goalScore, win) : null;
  }
```

Replace the `drawScene` stub body with:

```js
  function drawScene(s, win, now) {
    drawSky();
    drawSun();
    drawDunes(win);
    drawDecor(win);
    drawLanes(s);
    drawCamels(s, win, now);
  }
```

- [ ] **Step 4: Run render tests — expect PASS**

Run: `pnpm exec playwright test tests/render.spec.js`
Expected: PASS, 5 tests passed.

- [ ] **Step 5: Run full suite — expect PASS**

Run: `pnpm test`
Expected: PASS, 20 passed.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render.spec.js
git commit -m "feat: add canvas renderer with camera auto-fit and camel sprites"
```

---

### Task 4: Goal end state — finish line, milestones, winner banner, confetti, lockout, aria-live

**Files:**
- Modify: `index.html` (`#app` script — add finish/milestone/confetti/banner art + drawing, extend `updateRuntime` and `drawScene`, add lockout + aria-live in UI)
- Create: `tests/goal.spec.js`

**Interfaces:**
- Consumes: Task 1 `runtime`, `GameDebug.getScene`; Task 2 `syncDom`/`renderLanes`/`liveEl`/`t`; Task 3 `drawSprite`, `mulberry32`, `hash2`, `mapX`, `laneBottomY`.
- Produces: sprite matrices `FINISH_FLAG` (12×14), `MILESTONE` (10×14); helpers `drawMilestones(win)`, `drawFinish(s, win)`, `spawnConfetti(cx, cy)`, `drawConfetti()`, `drawBanner(s, lang)`; constants `MILESTONE_STEP=50`, `CONFETTI_COUNT=60`, `CONFETTI_SEED=99`, `CONFETTI_COLORS`.

- [ ] **Step 1: Write the failing E2E test `tests/goal.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('Goal end state and infinite mode', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('drive a camel to goal 200 -> winner banner, inputs disabled', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('200');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#live')).toHaveText('Camel 1 wins!');
    await expect(page.locator('.lane').nth(0).locator('[data-action="add"][data-n="1"]')).toBeDisabled();
    await expect(page.locator('.lane').nth(0).locator('[data-action="set"]')).toBeDisabled();
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toBeDisabled();
  });

  test('New race resets to 0 and re-enables controls', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('200');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#live')).toHaveText('Camel 1 wins!');
    await page.locator('#newRace').click();
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toHaveValue('0');
    await expect(page.locator('.lane').nth(0).locator('[data-action="set"]')).toBeEnabled();
    await expect(page.locator('#live')).toHaveText('');
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.raceOver).toBe(false);
    expect(s.winnerId).toBe(null);
    expect(s.goalScore).toBe(200);
  });

  test('goal mode shows finish line, infinite hides it', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(true);
    await page.locator('#infinite').check();
    await expect(page.locator('#goalScore')).toBeDisabled();
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(false);
    await page.locator('#infinite').uncheck();
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(true);
  });

  test('infinite mode 5000+ keeps accepting and camels stay in bounds', async ({ page }) => {
    await page.locator('#infinite').check();
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(false);
    await page.evaluate(() => { GameCore.setScore('camel-0', 5000); });
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="10"]').click();
    const score = await page.evaluate(() => GameCore.getState().camels[0].score);
    expect(score).toBe(5010);
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const bounds = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
    for (const b of bounds) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(480);
    }
  });

  test('winner banner uses active language', async ({ page }) => {
    await page.locator('#lang-de').click();
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('200');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#live')).toHaveText('Kamel 1 gewinnt!');
  });
});
```

- [ ] **Step 2: Run new tests — expect FAIL**

Run: `pnpm exec playwright test tests/goal.spec.js`
Expected: FAIL — `#live` empty (no aria-live wiring), inputs not disabled, `finishVisible` false.

- [ ] **Step 3: Add finish/milestone/confetti/banner art + drawing to `index.html`**

Insert these sprite matrices and constants in the art section (after `ROCK`):

```js
  // Finish flag 12x14. Legend adds: P pole, C checker-light, K checker-dark.
  const FINISH_FLAG = [
    'OO..........',
    'PPOOOOOOOO..',
    'PPOCKCKCKO..',
    'PPOKCKCKCO..',
    'PPOCKCKCKO..',
    'PPOKCKCKCO..',
    'PPOCKCKCKO..',
    'PPOKCKCKCO..',
    'PPOCKCKCKO..',
    'PPOKCKCKCO..',
    'PPOCKCKCKO..',
    'PPOKCKCKCO..',
    'PPOOOOOOOO..',
    'PP..........',
  ];

  // Milestone flag 10x14. Legend adds: P pole, F flag color.
  const MILESTONE = [
    '.PPO......',
    '.PPFFFFFF.',
    '.PPFFFFFF.',
    '.PPFFFFFF.',
    '.PPFFFFFF.',
    '.PPFFFFFF.',
    '.PP.......',
    '.PP.......',
    '.PP.......',
    '.PP.......',
    '.PP.......',
    '.PP.......',
    '.PP.......',
    '.OO.......',
  ];

  const MILESTONE_STEP = 50;
  const CONFETTI_COUNT = 60;
  const CONFETTI_SEED = 99;
  const CONFETTI_COLORS = ['#e84a3a', '#3a6ae8', '#3aa84a', '#e8c83a', '#9a4ae8', '#e88a3a', '#3ad8d8', '#e85a9a', '#f0f0f0'];
```

Insert these drawing helpers in the art section (after `ROCK`, near other draw helpers — place them next to `drawDecor`):

```js
  function drawMilestones(win) {
    ctx.font = '6px monospace';
    ctx.textBaseline = 'top';
    const start = Math.max(MILESTONE_STEP, Math.ceil(win.min / MILESTONE_STEP) * MILESTONE_STEP);
    for (let m = start; m <= win.max; m += MILESTONE_STEP) {
      const x = mapX(m, win) - 2;
      if (x < -12 || x > CANVAS_W + 12) continue;
      drawSprite(MILESTONE, x, HORIZON_Y - 14, { body: '#6b4a2a', shade: '#4a3320', grass: '#6b4a2a' });
      ctx.fillStyle = '#e8e0d0';
      ctx.fillText(String(m), x + 10, HORIZON_Y - 11);
    }
  }

  function drawFinish(s, win) {
    if (!runtime.finishVisible || runtime.goalScreenX == null) return;
    const x = Math.round(runtime.goalScreenX) - 6;
    drawSprite(FINISH_FLAG, x, HORIZON_Y - 14, PALM_PAL);
    const stripeX = x + 4;
    for (let y = HORIZON_Y; y < LANE_BOTTOM; y += 4) {
      ctx.fillStyle = ((y / 4) % 2 === 0) ? COL.checkerLight : COL.checkerDark;
      ctx.fillRect(stripeX, y, 4, 4);
    }
  }

  function spawnConfetti(cx, cy) {
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const rng = mulberry32(hash2(CONFETTI_SEED, i));
      runtime.confetti.push({
        x: cx,
        y: cy,
        vx: (rng() * 2 - 1) * 60,
        vy: -(rng() * 60 + 30),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        age: 0,
        life: 900 + rng() * 300,
      });
    }
  }

  function updateConfetti(dt) {
    const alive = [];
    for (const p of runtime.confetti) {
      p.age += dt;
      p.vy += 140 * dt / 1000;
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      if (p.age < p.life && p.y < CANVAS_H + 4 && p.x > -4 && p.x < CANVAS_W + 4) alive.push(p);
    }
    runtime.confetti = alive;
  }

  function drawConfetti() {
    for (const p of runtime.confetti) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
  }

  function drawBanner(s) {
    if (!s.raceOver || !s.winnerId) return;
    const idx = s.camels.findIndex(function (c) { return c.id === s.winnerId; });
    const text = t(s.language, 'winnerBanner', { n: idx + 1 });
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    const w = Math.ceil(ctx.measureText(text).width) + 16;
    const x = Math.round((CANVAS_W - w) / 2);
    const y = 8;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 2, y - 2, w + 4, 16);
    ctx.fillStyle = COL.flag;
    ctx.fillRect(x, y, w, 12);
    ctx.fillStyle = '#1a1208';
    ctx.fillText(text, x + 8, y + 2);
  }
```

- [ ] **Step 4: Extend `updateRuntime` for winner/confetti/finish**

Replace the `updateRuntime` function with:

```js
  function updateRuntime(s, dt, now) {
    const win = runtime.frameWindow;
    for (const c of s.camels) {
      const target = camelTargetLeft(c.score, win);
      let v = runtime.visualLeft[c.id];
      if (v == null) {
        runtime.visualLeft[c.id] = target;
        continue;
      }
      const k = 1 - Math.exp(-dt / LERP_MS);
      v += (target - v) * k;
      if (Math.abs(target - v) < 0.5) v = target;
      runtime.visualLeft[c.id] = v;
    }
    const ids = new Set(s.camels.map(function (c) { return c.id; }));
    for (const id of Object.keys(runtime.visualLeft)) {
      if (!ids.has(id)) delete runtime.visualLeft[id];
    }

    if (s.raceOver && s.winnerId && runtime.lastWinnerId !== s.winnerId) {
      runtime.lastWinnerId = s.winnerId;
      const idx = s.camels.findIndex(function (c) { return c.id === s.winnerId; });
      const c = s.camels[idx];
      const cx = (runtime.visualLeft[c.id] == null ? camelTargetLeft(c.score, win) : runtime.visualLeft[c.id]) + SPRITE_W / 2;
      spawnConfetti(cx, laneBottomY(idx, s.camels.length) - 20);
    }
    if (!s.raceOver && runtime.lastWinnerId !== null) {
      runtime.lastWinnerId = null;
      runtime.confetti = [];
    }

    updateConfetti(dt);

    runtime.finishVisible = !s.infinite && s.goalScore != null;
    runtime.goalScreenX = runtime.finishVisible ? mapX(s.goalScore, win) : null;
  }
```

- [ ] **Step 5: Extend `drawScene` for milestones, finish, confetti, banner**

Replace the `drawScene` function with:

```js
  function drawScene(s, win, now) {
    drawSky();
    drawSun();
    drawDunes(win);
    drawDecor(win);
    drawMilestones(win);
    drawLanes(s);
    drawFinish(s, win);
    drawCamels(s, win, now);
    drawConfetti();
    drawBanner(s);
  }
```

- [ ] **Step 6: Add lockout + aria-live in the UI**

In `renderLanes` (inside the `s.camels.forEach` block), replace the line `// Task 4 adds input lockout here.` with:

```js
      const lock = s.raceOver;
      el.querySelectorAll('button, input').forEach(function (ctl) { ctl.disabled = lock; });
```

In `syncDom`, replace the line `// Task 4 adds winner aria-live announcement here.` with:

```js
    if (s.raceOver && s.winnerId) {
      const idx = s.camels.findIndex(function (c) { return c.id === s.winnerId; });
      const msg = t(s.language, 'winnerBanner', { n: idx + 1 });
      if (liveEl.textContent !== msg) liveEl.textContent = msg;
    } else if (!s.raceOver && liveEl.textContent !== '') {
      liveEl.textContent = '';
    }
```

- [ ] **Step 7: Run goal tests — expect PASS**

Run: `pnpm exec playwright test tests/goal.spec.js`
Expected: PASS, 5 tests passed.

- [ ] **Step 8: Run full suite — expect PASS**

Run: `pnpm test`
Expected: PASS, 25 passed.

- [ ] **Step 9: Commit**

```bash
git add index.html tests/goal.spec.js
git commit -m "feat: add goal end state with winner banner and confetti"
```

---

### Task 5: README + responsive + a11y polish + full suite green

**Files:**
- Create: `README.md`
- Modify: `index.html` (verify responsive CSS `<900px`, focus, canvas label — no functional change expected)
- Create: `tests/app.spec.js`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `README.md`.

- [ ] **Step 1: Write the failing E2E test `tests/app.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { gotoGame, openGame } = require('./helpers');

test.describe('App-level: errors, network, responsive, a11y', () => {
  test('no console errors and no non-file network requests', async ({ page }) => {
    const { errors, requests } = await openGame(page);
    await page.locator('#lang-de').click();
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="5"]').click();
    await page.locator('#newRace').click();
    await page.locator('#infinite').check();
    await page.locator('#infinite').uncheck();
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
  });

  test('panel stacks below canvas under 900px and no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await gotoGame(page);
    const cb = await page.locator('#game').boundingBox();
    const pb = await page.locator('#panel').boundingBox();
    expect(pb.y).toBeGreaterThanOrEqual(cb.y + cb.height - 1);
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(noOverflow).toBe(true);
  });

  test('canvas has an accessible label and controls are keyboard reachable', async ({ page }) => {
    await gotoGame(page);
    await expect(page.locator('#game')).toHaveAttribute('aria-label', /race/i);
    await expect(page.locator('#lang-en')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#camelCount')).toHaveAttribute('min', '2');
    await expect(page.locator('#camelCount')).toHaveAttribute('max', '8');
    await expect(page.locator('#goalScore')).toHaveAttribute('max', '10000');
    await expect(page.locator('#infinite')).toHaveAttribute('type', 'checkbox');
    await expect(page.locator('#live')).toHaveAttribute('aria-live', 'polite');
  });
});
```

- [ ] **Step 2: Run app tests — expect FAIL only if README/responsive gaps exist; run first**

Run: `pnpm exec playwright test tests/app.spec.js`
Expected: PASS on errors/network/a11y; responsive test PASS if `<900px` CSS from Task 1 is present (it is). If responsive FAILS, add the `@media (max-width:900px)` block from Step 3 and re-run.

- [ ] **Step 3: Verify/ensure responsive CSS in `index.html`**

Confirm this block is present at the end of `<style>` (Task 1 included it; add if missing):

```css
  @media (max-width: 900px) {
    main { flex-direction: column; }
    canvas#game { max-width: 100%; }
    #panel { width: 100%; }
  }
```

- [ ] **Step 4: Write `README.md`**

```markdown
# Kamel Derby

Single-file pixel-art camel race game. One HTML file, zero runtime dependencies, no build step, works offline from `file://`.

## Run

Open `index.html` directly in a browser (double-click, or drag it into a tab). No server needed.

## Test (dev only)

Requires [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm exec playwright install chromium
pnpm test
```
```

- [ ] **Step 5: Run full suite — expect PASS**

Run: `pnpm test`
Expected: PASS, all tests passed (unit + controls + render + goal + app).

- [ ] **Step 6: Final manual verification of acceptance criteria**

Run: `open index.html` (macOS) or open `index.html` in Chrome/Firefox/Safari.
Check, in order: buffer renders pixelated at 16:9; 4 lanes default; `+1/+5/+10` move the right camel right and exact score moves left/right; goal `200` winner banner + confetti + locked inputs; `New race` resets scores and re-enables; `∞` hides finish line and accepts `5000+`; EN/DE toggles every string; at 800px width the panel stacks below the canvas with no horizontal scroll; Tab reaches every control with a visible focus ring.

- [ ] **Step 7: Commit**

```bash
git add index.html README.md tests/app.spec.js
git commit -m "docs: add README and finalize responsive and a11y"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| `index.html` from `file://`, no deps/build/network | 1, 5 |
| Canvas 480×270, `imageSmoothingEnabled=false`, pixelated, 16:9 upscale | 1 |
| Camera auto-fit (`PAD=20`, `MIN_WINDOW=100`, slack `80`, goal inclusion) | 1 (core) + 3 (render) |
| Camel sprite constant 24×16, camera x only, lanes, 300ms lerp, 600ms 2-frame walk, rAF delta | 3 |
| `GameCore` API + `getState` | 1 |
| `GameDebug` hooks | 1 |
| Camel count 2–8 default 4; growth keeps scores; shrink drops highest lanes | 1 + 2 |
| Goal 1–10000 default 200; `∞` mutual exclusion | 1 + 2 |
| `+1/+5/+10` + exact score, invalid → hint unchanged | 2 |
| New race resets scores keeps config | 1 + 2 |
| EN/DE full table verbatim + localized names | 2 |
| Goal mode winner: stop, lockout, banner, confetti, aria-live | 4 |
| Infinite: no finish, no winner, auto-fit forever | 1 + 3 + 4 |
| Procedural seeded art: sky, sun, dunes, palms, cacti, rocks, finish pole, milestones every 50 w/ 6px label | 3 + 4 |
| Palette-swap camel body (8 hex values) | 1 + 3 |
| Confetti cleared on New race | 4 |
| No idle bob | 3 (no bob code) |
| A11y: real controls, focus, aria-live, canvas label | 1 + 5 |
| Responsive `<900px` stack, no h-scroll | 1 + 5 |
| Playwright tests (unit + E2E per Testing Strategy) | 1–5 |
| README run/test instructions | 5 |

**Placeholder scan:** no `TBD`/`TODO`/`fill in`/`similar to`. `/* Task 3 */` stubs are intentional, replaced verbatim in Task 3; the two `// Task 4 adds ... here.` markers are replaced verbatim in Task 4.

**Type/name consistency:** `GameCore.getState` shape, `GameDebug.{getState,getCameraWindow,getCanvasSize,getCamelSpriteBounds,isSettled,getScene}`, `drawScene(s,win,now)`, `updateRuntime(s,dt,now)`, `t(lang,key,vars)`, `camelTargetLeft(score,win)`, `laneTopY/laneBottomY/laneHeight/camelTopY(i,n)`, `mapX(point,win)`, sprite names `CAMEL/PALM/CACTUS/ROCK/FINISH_FLAG/MILESTONE`, `mulberry32/hash2/drawSprite/darken` are identical across all tasks. Test selectors (`[data-action="add"]`, `[data-action="set"]`, `[data-exact]`, `[data-name]`, `[data-score-label]`, `.lane`, `#live`) match the markup and `buildLane` in Task 2.

**Spec gaps found (do not block):** the spec's i18n table does not define a canvas `aria-label` string; plan adds key `canvasLabel` (EN + DE) as the only extension. All other strings copied verbatim.

## Execution Handoff

Present this plan; wait for approval. Then run the orchestrator loop per task: implement → verify (`pnpm exec playwright test tests/<file>.spec.js`, then `pnpm test`) → `code-reviewer` → `git-expert` commit. `git-expert` runs the commit commands; the implementer never commits.
