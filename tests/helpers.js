const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

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

module.exports = { INDEX_URL, readIndexHtml, extractMatrixRows, gotoGame, openGame, openHttpGame };
