const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

// Count every distinct RGB color on the canvas. Used to prove that real art
// (camel palette colors, sky/sun/dune/decor colors) is actually rasterised,
// not merely that the canvas exists or that lane fills are non-black.
async function pixelTally(page) {
  return page.evaluate(() => {
    const g = document.getElementById('game').getContext('2d');
    const d = g.getImageData(0, 0, 480, 270).data;
    const tally = {};
    for (let i = 0; i < d.length; i += 4) {
      const h = '#' + [d[i], d[i + 1], d[i + 2]]
        .map((v) => v.toString(16).padStart(2, '0')).join('');
      tally[h] = (tally[h] || 0) + 1;
    }
    return tally;
  });
}

test.describe('Renderer camera and bounds', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('canvas buffer is 480x270', async ({ page }) => {
    const size = await page.evaluate(() => GameDebug.getCanvasSize());
    expect(size).toEqual({ width: 480, height: 270 });
  });

  test('canvas uses nearest-neighbour scaling', async ({ page }) => {
    const enabled = await page.evaluate(
      () => document.getElementById('game').getContext('2d').imageSmoothingEnabled,
    );
    expect(enabled).toBe(false);
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

  // 2 and 8 camels, goal AND infinite mode, checked before AND after settling.
  for (const count of [2, 8]) {
    for (const mode of ['goal', 'infinite']) {
      test(`every camel stays in the canvas: ${count} camels, ${mode}`, async ({ page }) => {
        await page.evaluate(({ count, mode }) => {
          GameCore.setCamelCount(count);
          if (mode === 'infinite') GameCore.setGoal(null);
          else GameCore.setGoal(200);
          GameCore.resetRace();
          GameCore.setScore('camel-0', 0);
          GameCore.setScore('camel-1', 5000);
        }, { count, mode });

        // Immediately, before any lerp settling has necessarily happened.
        const during = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
        for (const b of during) {
          expect(b.left).toBeGreaterThanOrEqual(0);
          expect(b.right).toBeLessThanOrEqual(480);
        }

        await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
        const after = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
        for (const b of after) {
          expect(b.left).toBeGreaterThanOrEqual(0);
          expect(b.right).toBeLessThanOrEqual(480);
          expect(b.right - b.left).toBe(24);
          expect(b.top).toBeGreaterThanOrEqual(0);
          expect(b.bottom).toBeLessThanOrEqual(270);
        }
      });
    }
  }

  test('scene draws sky, sun, dunes and decor (expected colors present)', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const tally = await pixelTally(page);
    for (const color of ['#1a1030', '#241640', '#2e1c4a']) { // sky bands
      expect(tally[color] || 0).toBeGreaterThan(0);
    }
    expect((tally['#e8a03a'] || 0) + (tally['#f0c060'] || 0)).toBeGreaterThan(0); // sun
    for (const color of ['#3a2a4a', '#4a3550']) { // dune bands
      expect(tally[color] || 0).toBeGreaterThan(0);
    }
    expect((tally['#2f6b3a'] || 0) + (tally['#6b4a2a'] || 0) + (tally['#6b5570'] || 0))
      .toBeGreaterThan(0); // decor bodies
  });

  test('camels render with per-lane palette colors', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const tally = await pixelTally(page);
    // Camel 1 body = PALETTE[0], Camel 2 body = PALETTE[1]. Each frame has ~99
    // body pixels; both colors must appear and the scene must not be palette-flat.
    expect(tally[LANE_BODY[0]] || 0).toBeGreaterThan(50);
    expect(tally[LANE_BODY[1]] || 0).toBeGreaterThan(50);
  });

  test('visualLeft lerps toward the target instead of snapping', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(null);
      GameCore.resetRace();
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const r = await page.evaluate(() => new Promise((resolve) => {
      GameCore.setScore('camel-1', 5000);
      let n = 0;
      function tick() {
        n += 1;
        if (n < 3) { requestAnimationFrame(tick); return; }
        resolve({
          left: GameDebug.getCamelSpriteBounds()[1].left,
          settled: GameDebug.isSettled(),
        });
      }
      requestAnimationFrame(tick);
    }));
    // After a few real frames the sprite must still be far from its ~454px
    // target and not yet reported settled — i.e. it interpolated, not snapped.
    expect(r.settled).toBe(false);
    expect(r.left).toBeLessThan(300);
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const endLeft = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[1].left);
    expect(endLeft).toBeGreaterThan(400);
  });

  test('walk animation shows distinct frames while moving, stops after ANIM_MS', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(null);
      GameCore.resetRace();
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const res = await page.evaluate(() => new Promise((resolve) => {
      const canvas = document.getElementById('game');
      const snap = () => {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const x = Math.max(0, Math.round(b.left) - 1);
        const y = Math.max(0, Math.round(b.top));
        return canvas.getContext('2d').getImageData(x, y, 26, 18).data.join(',');
      };
      const standing = snap();
      const camel = GameCore.getState().camels[0];
      // Same score => sprite stays put but a 600ms walk anim is triggered.
      GameCore.setScore(camel.id, camel.score);
      const walk = new Set();
      let settledFrames = 0;
      function tick() {
        const now = performance.now();
        const animating = GameCore.getState().camels[0].animUntil > now;
        const k = snap();
        if (animating) {
          if (k !== standing) walk.add(k);
          requestAnimationFrame(tick);
          return;
        }
        settledFrames += 1;
        if (settledFrames < 2) { requestAnimationFrame(tick); return; }
        resolve({ distinctWalkFrames: walk.size, after: k, standing });
      }
      requestAnimationFrame(tick);
    }));
    expect(res.distinctWalkFrames).toBeGreaterThanOrEqual(2); // frames 1 and 2
    expect(res.after).toBe(res.standing); // returns to idle pose after ANIM_MS
  });

  test('idle camels do not animate (no idle bob)', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(null);
      GameCore.resetRace();
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const same = await page.evaluate(() => new Promise((resolve) => {
      const canvas = document.getElementById('game');
      const snap = () => {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const x = Math.max(0, Math.round(b.left) - 1);
        const y = Math.max(0, Math.round(b.top));
        return canvas.getContext('2d').getImageData(x, y, 26, 18).data.join(',');
      };
      const first = snap();
      let n = 0;
      function tick() {
        n += 1;
        if (n < 6) { requestAnimationFrame(tick); return; }
        resolve(snap() === first);
      }
      requestAnimationFrame(tick);
    }));
    expect(same).toBe(true);
  });

  test('decor is deterministic across reloads (fixed seed)', async ({ page }) => {
    const decorRegion = () => page.evaluate(
      () => document.getElementById('game').getContext('2d').getImageData(0, 0, 480, 70).data.join(','),
    );
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const first = await decorRegion();
    await gotoGame(page);
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const second = await decorRegion();
    expect(second).toBe(first);
  });

  for (const count of [2, 8]) {
    test(`frame fully painted, no transparent pixels: ${count} camels`, async ({ page }) => {
      await page.evaluate((n) => {
        GameCore.setCamelCount(n);
        GameCore.resetRace();
      }, count);
      await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
      const transparent = await page.evaluate(() => {
        const d = document.getElementById('game').getContext('2d').getImageData(0, 0, 480, 270).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] === 0) n += 1;
        return n;
      });
      expect(transparent).toBe(0);
    });
  }

  test('world-anchored decor shifts on screen when the camera window pans', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(2);
      GameCore.setGoal(null);
      GameCore.resetRace();
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    // Collect the x-columns occupied by decor body colors only (sky/sun/dune use
    // different colors), so the comparison isolates decor from the dune bands.
    const decorColumns = () => page.evaluate(() => {
      const decor = new Set(['6b4a2a', '2f6b3a', '6b5570']);
      const d = document.getElementById('game').getContext('2d').getImageData(0, 0, 480, 70).data;
      const cols = [];
      for (let x = 0; x < 480; x += 1) {
        let hit = false;
        for (let y = 0; y < 70 && !hit; y += 1) {
          const i = (y * 480 + x) * 4;
          const h = [d[i], d[i + 1], d[i + 2]]
            .map((v) => v.toString(16).padStart(2, '0')).join('');
          if (decor.has(h)) hit = true;
        }
        if (hit) cols.push(x);
      }
      return { window: GameDebug.getCameraWindow(), cols };
    });
    const before = await decorColumns();
    await page.evaluate(() => {
      for (const c of GameCore.getState().camels) GameCore.setScore(c.id, 400);
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const after = await decorColumns();
    expect(after.window).not.toEqual(before.window); // camera actually panned
    expect(before.cols.length).toBeGreaterThan(0); // decor drawn before
    expect(after.cols.length).toBeGreaterThan(0); // decor drawn after
    expect(after.cols).not.toEqual(before.cols); // decor moved on screen
  });

  test('huge spread bounds decor draw count and the frame still renders', async ({ page }) => {
    // Spread far beyond DECOR_MAX_SPAN: decor is skipped, but the frame completes.
    await page.evaluate(() => {
      GameCore.setCamelCount(2);
      GameCore.setGoal(null);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 0);
      GameCore.setScore('camel-1', 100000);
    });
    // Force the game loop to actually render a frame at the huge span, then
    // read the CURRENT counter. A poll here could latch a stale value left by
    // a previous, narrower frame and pass without ever drawing the huge span.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const win = await page.evaluate(() => GameDebug.getCameraWindow());
    expect(win.max - win.min).toBeGreaterThan(1500); // window is genuinely huge, not stale
    // drawDecor bails before drawing anything once span > DECOR_MAX_SPAN (1500).
    const decorDrawn = await page.evaluate(() => GameDebug.getScene().decorDrawn);
    expect(decorDrawn).toBe(0);
    const painted = await page.evaluate(() => {
      const d = document.getElementById('game').getContext('2d').getImageData(0, 0, 480, 270).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n += 1;
      return n;
    });
    expect(painted).toBe(480 * 270);

    // Within the decor range the counter is live and still bounded.
    await page.evaluate(() => { GameCore.setScore('camel-1', 1000); });
    await expect.poll(
      () => page.evaluate(() => GameDebug.getScene().decorDrawn),
      { timeout: 5000 },
    ).toBeGreaterThan(0);
    const bounded = await page.evaluate(() => GameDebug.getScene().decorDrawn);
    expect(bounded).toBeLessThanOrEqual(24);
  });
});

// Camel body color for lane index i = GameCore.PALETTE[i % 8] (see index.html).
const LANE_BODY = ['#e84a3a', '#3a6ae8'];
