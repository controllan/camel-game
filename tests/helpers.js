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
