const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { expect } = require('@playwright/test');

const INDEX_PATH = path.resolve(__dirname, '..', 'index.html');
const INDEX_URL = pathToFileURL(INDEX_PATH).href;

// Static index.html source for byte-level art contracts (sprite matrices,
// palettes). Shared so spec files do not re-implement the string-aware scan.
function readIndexHtml() {
  return fs.readFileSync(INDEX_PATH, 'utf8');
}

// Extract the string rows of `const NAME = [ 'row', ... ];` by depth-counting
// brackets while ignoring quotes ('[' inside a row string must not count).
function extractMatrixRows(html, decl) {
  const idx = html.indexOf(decl);
  if (idx < 0) throw new Error('missing declaration: ' + decl);
  const start = html.indexOf('[', idx);
  let depth = 0, i = start, inStr = false;
  for (; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === "'") inStr = !inStr;
    if (inStr) continue;
    if (ch === '[') depth += 1;
    else if (ch === ']') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return [...html.slice(start, i).matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

async function gotoGame(page) {
  await page.goto(INDEX_URL);
}

// Wait until the game loop has completed >=1 frame after the caller's last
// state mutation. The loop re-registers its rAF callback at the end of every
// frame, so at any point between frames its next callback is queued before one
// registered from an evaluate; two chained rAFs therefore run after at least
// one full game frame (syncTheme + updateRuntime + drawScene). This is the
// paint signal: GameDebug.isSettled() alone can still describe the
// pre-mutation frame when the mutation did not move any target x (e.g. a
// theme/count/label change at score 0), so pixels/scene metadata sampled right
// after a mutation could be one frame stale without it.
async function paint(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

// paint() + honest settle + an exact-lerp pin. isSettled() tolerates 0.5 px,
// but the cubic ease only assigns visualLeft = target exactly once p >= 1; a
// sub-pixel tail can still flip the rounded 92 px sprite crop mid-assertion
// (which is what made the walk-frame snapshots disagree). Resolve only after a
// frame has painted the mutated state AND two consecutive frames report
// identical sprite bounds while isSettled() holds, so sampled pixels cannot
// shift under the test.
async function settleAndPaint(page) {
  await paint(page);
  await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
  await page.evaluate(() => new Promise((resolve) => {
    let prev = null;
    function tick() {
      const key = GameDebug.getCamelSpriteBounds()
        .map((b) => b.left + '|' + b.top).join(',');
      if (key === prev && GameDebug.isSettled()) { resolve(); return; }
      prev = key;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }));
}

// Resolve once every current camel has finished its walk animation, i.e. the
// renderer is back on the standing frame. The rAF clock is the same origin the
// renderer compares animUntil against, so this is the real condition, not a
// delay: pass frames plant only two hooves on the sprite's hoof row.
async function waitAnimsDone(page) {
  await expect.poll(() => page.evaluate(
    () => GameCore.getState().camels.every((c) => c.animUntil <= performance.now()),
  )).toBe(true);
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

module.exports = { INDEX_URL, readIndexHtml, extractMatrixRows, gotoGame, openGame, openHttpGame, paint, settleAndPaint, waitAnimsDone };
