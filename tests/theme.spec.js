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

  test('forest layers floor decor over the lanes + treeline above the horizon (all 5 families)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('forest'));
    const seen = new Set();
    // Exact art RGB per floor family (docs/art/theme-art.md §2.5). A hit proves the
    // sprite survived the opaque lane fill, i.e. floor decor is layered ABOVE the
    // ground; reverting the layering drops these counters to 0 while the treeline
    // (above HORIZON_Y, never overpainted) stays.
    const hits = { cap: 0, moss: 0, stone: 0, needles: 0, treeline: 0 };
    // Deterministic seeded placement: as the camera pans the drawn kind set grows.
    for (const score of [0, 200, 400, 600, 800, 1000, 1200, 1300]) {
      await page.evaluate((sc) => { GameCore.setScore('camel-1', sc); }, score);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const kinds = await page.evaluate(() => GameDebug.getScene().decorKinds);
      kinds.forEach((k) => seen.add(k));
      const r = await page.evaluate(() => {
        const g = document.getElementById('game').getContext('2d');
        // Floor sprites anchor on a lane surface (y > HORIZON_Y): sample the lane band.
        const floor = g.getImageData(0, 120, 1280, 720 - 120).data;
        // Background trees base on HORIZON_Y and rise into the sky: sample above it.
        const sky = g.getImageData(0, 0, 1280, 120).data;
        let cap = 0, moss = 0, stone = 0, needles = 0, treeline = 0;
        for (let i = 0; i < floor.length; i += 4) {
          const r = floor[i], gg = floor[i + 1], b = floor[i + 2];
          if (r === 0xc0 && gg === 0x39 && b === 0x2b) cap++;          // MUSHROOM_RED cap
          else if (r === 0x3f && gg === 0x7a && b === 0x35) moss++;      // MOSS
          else if (r === 0x8a && gg === 0x8a && b === 0x92) stone++;     // STONE
          else if (r === 0x8a && gg === 0x5a && b === 0x3a) needles++;   // PINE_NEEDLES / brown cap
        }
        for (let i = 0; i < sky.length; i += 4) {
          const r = sky[i], gg = sky[i + 1], b = sky[i + 2];
          if ((r === 0x2f && gg === 0x6b && b === 0x3a) || (r === 0x3a && gg === 0x8a && b === 0x4a)) treeline++;
        }
        return { cap, moss, stone, needles, treeline };
      });
      hits.cap += r.cap; hits.moss += r.moss; hits.stone += r.stone; hits.needles += r.needles; hits.treeline += r.treeline;
    }
    for (const k of ['trees', 'mushrooms', 'moss', 'stones', 'pine_needles']) {
      expect([...seen]).toContain(k);
    }
    expect(hits.cap).toBeGreaterThan(0);      // MUSHROOM_RED cap #c0392b
    expect(hits.moss).toBeGreaterThan(0);     // MOSS #3f7a35
    expect(hits.stone).toBeGreaterThan(0);    // STONE #8a8a92
    expect(hits.needles).toBeGreaterThan(0);  // PINE_NEEDLES #8a5a3a
    expect(hits.treeline).toBeGreaterThan(0); // tree canopy above the horizon
  });

  test('forest draws grass ground (forest ground.top pixels present)', async ({ page }) => {
    await page.evaluate(() => GameCore.setTheme('forest'));
    await expect.poll(() => page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      const d = g.getImageData(0, 200, 1280, 400).data;
      let hit = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 0x4a && d[i + 1] === 0x7a && d[i + 2] === 0x3a) hit++;
      }
      return hit;
    })).toBeGreaterThan(1000);
  });

  test('forest draws the moon (dusk moon disc + rim present)', async ({ page }) => {
    await page.evaluate(() => GameCore.setTheme('forest'));
    await expect.poll(() => page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      // Sample the moon slot (centre 1020,76 r32) so lane/dune pixels cannot leak in.
      const d = g.getImageData(1020 - 32, 76 - 32, 65, 65).data;
      let moon = 0, rim = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 0xf0 && d[i + 1] === 0xe8 && d[i + 2] === 0xc0) moon++;
        if (d[i] === 0xd8 && d[i + 1] === 0xc8 && d[i + 2] === 0x90) rim++;
      }
      return moon + rim;
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

test.describe('Theme selector UI + persistence', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('selector labels localize; aria-pressed tracks active theme', async ({ page }) => {
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-desert')).toHaveText('Desert');
    await page.locator('#lang-de').click();
    await expect(page.locator('#theme-desert')).toHaveText('Wüste');
    await expect(page.locator('#theme-forest')).toHaveText('Wald');
    await expect(page.locator('#themeToggle')).toHaveAttribute('aria-label', 'Thema');
    // aria-pressed must track the active theme both ways, not just the default.
    await page.locator('#theme-forest').click();
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#theme-desert').click();
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'false');
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

// The boar digit anchor + bob are pinned by docs/art/boar-sprite.md. The desert
// digit tests in render.spec sample +24/+36 and +2 bob, so without these the
// forest anchor (18,18) and +1 bob are untested.
test.describe('Forest boar blanket digit', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  // 3x5 source glyphs; each is the exact 2x nearest-neighbour upscale used by the
  // renderer, so a wrong/offset sample shows up as non-zero mismatches.
  const SRC = {
    '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '###', '..#', '###'],
    '4': ['#.#', '#.#', '###', '..#', '..#'],
  };
  function glyphs() {
    const up = (row) => row[0] + row[0] + row[1] + row[1] + row[2] + row[2];
    const out = {};
    for (const n in SRC) { const rows = []; for (const row of SRC[n]) { const u = up(row); rows.push(u, u); } out[n] = rows; }
    return out;
  }

  test('digit sits at the boar anchor (18,18) for every lane', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.setTheme('forest'); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    // isSettled() is trivially true on a fresh page; paint the current scene first.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const res = await page.evaluate(({ want }) => {
      const bounds = GameDebug.getCamelSpriteBounds();
      const g = document.getElementById('game').getContext('2d');
      return bounds.map((b, lane) => {
        const d = g.getImageData(Math.round(b.left) + 18, Math.round(b.top) + 18, 6, 10).data;
        const glyph = want[String(lane + 1)];
        let bad = 0;
        for (let ry = 0; ry < 10; ry += 1) {
          for (let rx = 0; rx < 6; rx += 1) {
            const i = (ry * 6 + rx) * 4;
            const ink = d[i] === 0x12 && d[i + 1] === 0x3a && d[i + 2] === 0x44;
            if (ink !== (glyph[ry][rx] === '#')) bad += 1;
          }
        }
        return bad;
      });
    }, { want: glyphs() });
    expect(res).toEqual([0, 0, 0, 0]);
  });

  test('digit drops +1 px with the body on bob frames 2 and 4', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.setTheme('forest'); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      const GLYPH = ['..##..', '..##..', '####..', '####..', '..##..', '..##..', '..##..', '..##..', '######', '######'];
      const canvas = document.getElementById('game');
      function mismatch(rowOffset) {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d').getImageData(Math.round(b.left) + 18, Math.round(b.top) + 18 + rowOffset, 6, 10).data;
        let bad = 0;
        for (let ry = 0; ry < 10; ry += 1) {
          for (let rx = 0; rx < 6; rx += 1) {
            const i = (ry * 6 + rx) * 4;
            const ink = d[i] === 0x12 && d[i + 1] === 0x3a && d[i + 2] === 0x44;
            if (ink !== (GLYPH[ry][rx] === '#')) bad += 1;
          }
        }
        return bad;
      }
      const camel = GameCore.getState().camels[0];
      GameCore.setScore(camel.id, camel.score); // trigger the walk without moving
      const byFrame = new Map();
      function tick(now) {
        if (GameCore.getState().camels[0].animUntil > now) {
          const fi = (Math.floor(now / FRAME_MS) % 4) + 1;
          const k = mismatch(0) + '/' + mismatch(1);
          if (!byFrame.has(fi)) byFrame.set(fi, new Map());
          const m = byFrame.get(fi);
          m.set(k, (m.get(k) || 0) + 1);
          requestAnimationFrame(tick);
          return;
        }
        const modal = {};
        for (const [fi, m] of byFrame) {
          let best = null, bn = -1;
          for (const [s, n] of m) if (n > bn) { bn = n; best = s; }
          modal[fi] = best;
        }
        resolve(modal);
      }
      requestAnimationFrame(tick);
    }));
    expect(Object.keys(res).sort()).toEqual(['1', '2', '3', '4']);
    const off = (fi) => res[fi].split('/').map(Number);
    // Contact frames (1, 3): digit at anchor row 18; the +1 offset must NOT match.
    expect(off(1)[0]).toBe(0);
    expect(off(1)[1]).toBeGreaterThan(0);
    expect(off(3)[0]).toBe(0);
    expect(off(3)[1]).toBeGreaterThan(0);
    // Bob frames (2, 4): digit drops 1 px to row 19; only the +1 offset matches.
    expect(off(2)[1]).toBe(0);
    expect(off(2)[0]).toBeGreaterThan(0);
    expect(off(4)[1]).toBe(0);
    expect(off(4)[0]).toBeGreaterThan(0);
  });
});

test.describe('Theme persistence (forest)', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('a forest-themed finished race reloads with theme, banner and no confetti', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('camelRace.v1', JSON.stringify({
        version: 1, camelCount: 2, camels: [{ name: 'A', score: 10 }, { name: 'B', score: 0 }],
        goalScore: 10, infinite: false, language: 'en', theme: 'forest', raceOver: true, winnerId: 'camel-0',
      }));
    });
    await page.reload();
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#live')).toHaveText('A wins!');
    expect(await page.evaluate(() => GameCore.getState().theme)).toBe('forest');
    expect(await page.evaluate(() => GameDebug.getTheme().animalId)).toBe('boar');
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().confettiDrawn)).toBe(0);
  });
});
