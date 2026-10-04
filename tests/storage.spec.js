const { test, expect } = require('@playwright/test');
const http = require('node:http');
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

  test('server returns 403 for traversal outside root and 400 for malformed URIs', async () => {
    const u = new URL(srv.url);
    const rawGet = (rawPath) => new Promise((resolve, reject) => {
      const req = http.request({ host: u.hostname, port: u.port, path: rawPath }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.end();
    });
    expect(await rawGet('/../camel-game-evil/x')).toBe(403);
    expect(await rawGet('/%E0%A4%A')).toBe(400);
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

  test('infinite flag and null goal round-trip across reload', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameStorage.save(); });
    await page.reload();
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.infinite).toBe(true);
    expect(s.goalScore).toBe(null);
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

  test('rapid score changes collapse into one debounced write', async ({ page }) => {
    await page.addInitScript(() => {
      window.__keyWrites = [];
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'camelRace.v1') window.__keyWrites.push(v); return orig.call(this, k, v); };
    });
    await page.reload();
    // 8 synchronous mutations inside one debounce window.
    await page.evaluate(() => { for (let i = 0; i < 8; i++) GameCore.addScore('camel-0', 1); });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('camelRace.v1') != null)).toBe(true);
    const r = await page.evaluate(() => ({ writes: window.__keyWrites.length, score: JSON.parse(localStorage.getItem('camelRace.v1')).camels[0].score }));
    expect(r.score).toBe(8);
    expect(r.writes).toBe(1); // no per-mutation thrash
  });

  test('pagehide synchronously flushes a pending debounce (no explicit save)', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.addScore('camel-0', 7); // schedules debounce; debounce has not fired
      const before = localStorage.getItem('camelRace.v1');
      window.dispatchEvent(new Event('pagehide')); // synchronous flush
      return { before, after: JSON.parse(localStorage.getItem('camelRace.v1')).camels[0].score };
    });
    expect(r.before).toBe(null); // proves the 200 ms debounce had not written yet
    expect(r.after).toBe(7);
  });

  test('visibilitychange to hidden synchronously flushes a pending debounce', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.addScore('camel-1', 3); // schedules debounce; not yet written
      const before = localStorage.getItem('camelRace.v1');
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      return { before, after: JSON.parse(localStorage.getItem('camelRace.v1')).camels[1].score };
    });
    expect(r.before).toBe(null);
    expect(r.after).toBe(3);
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

  // enabled by Task 10 (theme selector)
  test.fixme('theme + language applied before first paint; load does not steal focus', async ({ page }) => {
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
