const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

// Count exact-RGB pixels in a horizontal band of the single 1280x720 canvas
// buffer. Used to prove that Task 4 art is actually rasterised, not merely that
// a state flag flipped.
async function countColor(page, hex, y0, y1) {
  const rgb = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  return page.evaluate(({ rgb, y0, y1 }) => {
    const d = document.getElementById('game').getContext('2d')
      .getImageData(0, y0, 1280, y1 - y0).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) n += 1;
    }
    return n;
  }, { rgb, y0, y1 });
}

// The milestone label ink is #e8e0d0, but 12px text is fully anti-aliased so it
// never lands as a single exact RGB. Count its bright, warm off-white glyph
// pixels instead: every channel above the dark sky/dune/decor band, and not the
// neutral flag pole (#d8d8d8, r===g===b) that shares the horizon band.
async function countLabelInk(page, y0, y1) {
  return page.evaluate(({ y0, y1 }) => {
    const d = document.getElementById('game').getContext('2d')
      .getImageData(0, y0, 1280, y1 - y0).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 140 && g > 140 && b > 140 && !(r === g && g === b)) n += 1;
    }
    return n;
  }, { y0, y1 });
}

// Rect-scoped variant of countLabelInk: samples the same bright, warm
// off-white ink counter inside a canvas sub-box so label absence can be
// proven spill-free (decor spill elsewhere in the band cannot leak in).
async function countLabelInkIn(page, x0, x1, y0, y1) {
  return page.evaluate(({ x0, x1, y0, y1 }) => {
    const d = document.getElementById('game').getContext('2d')
      .getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 140 && g > 140 && b > 140 && !(r === g && g === b)) n += 1;
    }
    return n;
  }, { x0, x1, y0, y1 });
}

async function settle(page) {
  await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
}

async function winLane(page, lane, score) {
  await page.locator('.lane').nth(lane).locator('[data-exact]').fill(String(score));
  await page.locator('.lane').nth(lane).locator('[data-action="set"]').click();
}

test.describe('Goal end state and infinite mode', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('drive a camel to goal 200 -> winner banner, inputs disabled', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('200');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#live')).toHaveText('Team 1 wins!');
    await expect(page.locator('.lane').nth(0).locator('[data-action="add"][data-n="1"]')).toBeDisabled();
    await expect(page.locator('.lane').nth(0).locator('[data-action="set"]')).toBeDisabled();
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toBeDisabled();
  });

  test('New race resets to 0 and re-enables controls', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('200');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#live')).toHaveText('Team 1 wins!');
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
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.raceOver).toBe(false);
    expect(s.winnerId).toBe(null);
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const bounds = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
    for (const b of bounds) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(1280);
    }
  });

  test('winner banner uses active language', async ({ page }) => {
    await page.locator('#lang-de').click();
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('200');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#live')).toHaveText('Team 1 gewinnt!');
  });

  test('winner banner is rasterised on the canvas and cleared by New race', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(200); GameCore.resetRace(); });
    await settle(page);
    // Banner gold lives in the top strip; milestones (96-120) and camels (>=120)
    // are outside it, so a hit here is the banner itself.
    expect(await countColor(page, '#e8c83a', 6, 22)).toBe(0);

    await winLane(page, 0, 200);
    await expect(page.locator('#live')).toHaveText('Team 1 wins!');
    await expect.poll(() => countColor(page, '#e8c83a', 6, 22)).toBeGreaterThan(0);

    await page.locator('#newRace').click();
    await expect(page.locator('#live')).toHaveText('');
    await expect.poll(() => countColor(page, '#e8c83a', 6, 22)).toBe(0);
  });

  test('finish line is rasterised in goal mode and gone in infinite mode', async ({ page }) => {
    // Leader near the goal keeps the goal (and its pole stripe) on screen.
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(200); GameCore.resetRace(); GameCore.setScore('camel-0', 180); });
    await settle(page);
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().goalScreenX)).toBeGreaterThan(0);
    // #1a1a1a (checkerDark) is used only by the finish art in the track band.
    await expect.poll(() => countColor(page, '#1a1a1a', 120, 720)).toBeGreaterThan(0);

    await page.locator('#infinite').check();
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(false);
    await expect.poll(() => countColor(page, '#1a1a1a', 120, 720)).toBe(0);

    await page.locator('#infinite').uncheck();
    await expect.poll(() => countColor(page, '#1a1a1a', 120, 720)).toBeGreaterThan(0);
  });

  test('finish line stays hidden while the goal is outside the camera window', async ({ page }) => {
    // Scores 0, goal 200: the initial window is ~[-20, 80], so the clamped goal
    // would otherwise pin the flag clipped to the right edge.
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(200); GameCore.resetRace(); });
    await settle(page);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const win = await page.evaluate(() => GameDebug.getCameraWindow());
    expect(200 < win.min || 200 > win.max).toBe(true);
    // #1a1a1a (checkerDark) is drawn only by the finish art in the track band.
    expect(await countColor(page, '#1a1a1a', 120, 720)).toBe(0);

    // Bring the goal into the window: the finish raster reappears.
    await page.evaluate(() => { GameCore.setScore('camel-0', 180); });
    await settle(page);
    await expect.poll(async () => {
      const w = await page.evaluate(() => GameDebug.getCameraWindow());
      return w.min <= 200 && 200 <= w.max;
    }).toBe(true);
    await expect.poll(() => countColor(page, '#1a1a1a', 120, 720)).toBeGreaterThan(0);
  });

  test('milestone flags render at normal spread and drop past DECOR_MAX_SPAN', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(5000); GameCore.resetRace(); });
    await settle(page);
    const normalWin = await page.evaluate(() => GameDebug.getCameraWindow());
    expect(normalWin.max - normalWin.min).toBeLessThanOrEqual(1500);
    // Milestone flags share the banner gold but sit at the horizon (y 96-120).
    await expect.poll(() => countColor(page, '#e8c83a', 96, 120)).toBeGreaterThan(0);

    await page.evaluate(() => { GameCore.setScore('camel-1', 4000); });
    await expect.poll(async () => {
      const w = await page.evaluate(() => GameDebug.getCameraWindow());
      return w.max - w.min > 1500;
    }).toBe(true);
    // Two real frames at the huge span, so the guard is exercised now.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    expect(await countColor(page, '#e8c83a', 96, 120)).toBe(0);
  });

  test('milestone numbers rasterise, but are skipped when the step cannot fit the label', async ({ page }) => {
    // Only drawMilestones' fillText uses #e8e0d0, so a nonzero count in the
    // horizon band proves the number (not merely the flag) is rasterised.
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(5000); GameCore.resetRace(); });
    await settle(page);
    const normalWin = await page.evaluate(() => GameDebug.getCameraWindow());
    expect(normalWin.max - normalWin.min).toBeLessThanOrEqual(1500);
    // Milestone 50 sits in-window with a wide 50-point step: its label must draw.
    await expect.poll(() => countLabelInk(page, 96, 120)).toBeGreaterThan(0);

    // Five-digit spread at the 1500 cap (1460 <= DECOR_MAX_SPAN): flags stay,
    // but the ~21.3px step is below a 5-digit label's width + 8 (~44px), so
    // numbers skip while flags still draw.
    await page.locator('#infinite').check();
    await page.evaluate(() => { GameCore.setScore('camel-0', 10000); GameCore.setScore('camel-1', 11460); });
    await settle(page);
    const wideWin = await page.evaluate(() => GameDebug.getCameraWindow());
    expect(wideWin.max - wideWin.min).toBeLessThanOrEqual(1500);
    expect(wideWin.max - wideWin.min).toBeGreaterThan(1000);
    await expect.poll(() => countColor(page, '#e8c83a', 96, 120)).toBeGreaterThan(0); // flags still present
    // Spill-free sub-box centred on milestone 10700's label slot: the label
    // is the only ink the skip guard removes, so emptiness here proves the
    // guard fired (0 spill pixels observed at this slot in the probe runs).
    const labelCx = await page.evaluate(() => {
      const w = GameDebug.getCameraWindow();
      return Math.round(GameCore.mapScoreToScreenX(10700, w, 1280) + 34);
    });
    expect(await countLabelInkIn(page, labelCx - 15, labelCx + 15, 96, 120)).toBe(0); // label skipped
  });

  test('winner burst spawns confetti that animates, and New race clears it', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(200); GameCore.resetRace(); });
    await settle(page);

    const { frames, drawn } = await page.evaluate(() => new Promise((resolve, reject) => {
      // Confetti is the only art drawn as 4x4 fillRect (the saddle digit is
      // 2x2, sprites are 1x1, the finish stripe is 8x8, lane/banner fills are
      // larger), so counting 4x4 draw calls per frame proves the burst is
      // spawned, updated and cleared.
      const proto = CanvasRenderingContext2D.prototype;
      const original = proto.fillRect;
      let current = [];
      proto.fillRect = function (x, y, w, h) {
        if (w === 4 && h === 4) current.push(x + ',' + y);
        return original.apply(this, arguments);
      };
      const out = [];
      const counts = [];
      let reset = false;
      let ticks = 0;
      // Restore the prototype patch even when an assertion or frame throws.
      const restore = () => { proto.fillRect = original; };
      function tick() {
        try {
          ticks += 1;
          out.push(current);
          current = [];
          counts.push(GameDebug.getScene().confettiDrawn);
          if (!reset && ticks >= 25) { reset = true; document.getElementById('newRace').click(); }
          if (ticks < 50) { requestAnimationFrame(tick); }
          else { restore(); resolve({ frames: out, drawn: counts }); }
        } catch (e) {
          restore();
          reject(e);
        }
      }
      GameCore.setScore('camel-0', 200);
      requestAnimationFrame(tick);
    }));

    const duringWin = frames.slice(0, 25);
    const afterReset = frames.slice(25);
    expect(Math.max(...duringWin.map((f) => f.length))).toBeGreaterThan(0); // spawned
    // Spawn-once: no frame may draw more than the configured burst size (60).
    expect(Math.max(...drawn)).toBeLessThanOrEqual(60);
    const moved = duringWin.filter((f, i) => (
      i > 0 && f.length > 0 && duringWin[i - 1].length > 0 && f.join() !== duringWin[i - 1].join()
    )).length;
    expect(moved).toBeGreaterThan(0); // positions updated frame to frame
    expect(Math.max(...afterReset.map((f) => f.length))).toBe(0); // cleared by New race
  });

  test('after the goal further score input is rejected and a new race can be won by another camel', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await winLane(page, 0, 200);
    await expect(page.locator('#live')).toHaveText('Team 1 wins!');

    const rejected = await page.evaluate(() => ({
      add: GameCore.addScore('camel-1', 5),
      set: GameCore.setScore('camel-1', 500),
      scores: GameCore.getState().camels.map((c) => c.score),
    }));
    expect(rejected.add).toBe(false);
    expect(rejected.set).toBe(false);
    expect(rejected.scores).toEqual([200, 0, 0, 0]);
    await expect(page.locator('.lane').nth(1).locator('[data-action="add"][data-n="1"]')).toBeDisabled();

    await page.locator('#newRace').click();
    await expect(page.locator('.lane').nth(1).locator('[data-action="add"][data-n="1"]')).toBeEnabled();
    await winLane(page, 1, 200);
    await expect(page.locator('#live')).toHaveText('Team 2 wins!');
  });

  test('shrink dropping the winner before the first win frame: no crash, race void, loop alive', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // A swallowed frame error must not hide: also capture console errors.
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    // P1 repro: win, then shrink so the winner lane is gone, all before a
    // single post-win frame can render.
    await page.evaluate(() => {
      GameCore.setCamelCount(8); GameCore.setGoal(200); GameCore.resetRace();
      GameCore.setScore('camel-7', 200);
      GameCore.setCamelCount(2);
    });
    // A live loop keeps calling fillRect every frame; a dead loop calls none.
    const drawn = await page.evaluate(() => new Promise((resolve) => {
      const proto = CanvasRenderingContext2D.prototype;
      const original = proto.fillRect;
      let count = 0;
      proto.fillRect = function () { count += 1; return original.apply(this, arguments); };
      let frames = 0;
      function tick() {
        let again = false;
        try {
          frames += 1;
          if (frames >= 5) { resolve(count); return; }
          again = true;
          requestAnimationFrame(tick);
        } finally {
          // Restore the prototype patch even if a frame or assertion throws.
          if (!again) proto.fillRect = original;
        }
      }
      requestAnimationFrame(tick);
    }));
    expect(drawn).toBeGreaterThan(0);

    const s = await page.evaluate(() => GameCore.getState());
    expect(s.camels.length).toBe(2);
    expect(s.raceOver).toBe(false);
    expect(s.winnerId).toBe(null);
    await expect(page.locator('#live')).toHaveText('');
    const enabled = await page.evaluate(() => Array.from(document.querySelectorAll('.lane [data-action="add"]')).every((b) => !b.disabled));
    expect(enabled).toBe(true);
    await expect.poll(() => countColor(page, '#e8c83a', 6, 22)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('post-race shrink removing the winner: race void, no phantom winner, confetti cleared', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.evaluate(() => {
      GameCore.setCamelCount(8); GameCore.setGoal(200); GameCore.resetRace(); GameCore.setScore('camel-7', 200);
    });
    await expect.poll(() => page.evaluate(() => GameDebug.getState().raceOver)).toBe(true);
    // One win frame renders (banner + confetti spawned) before the shrink.
    await expect.poll(() => countColor(page, '#e8c83a', 6, 22)).toBeGreaterThan(0);

    await page.evaluate(() => { GameCore.setCamelCount(2); });
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.camels.length).toBe(2);
    expect(s.raceOver).toBe(false);
    expect(s.winnerId).toBe(null);
    expect(await page.evaluate(() => document.getElementById('live').textContent)).toBe('');
    const enabled = await page.evaluate(() => Array.from(document.querySelectorAll('.lane [data-action="add"]')).every((b) => !b.disabled));
    expect(enabled).toBe(true);
    // Banner gone; no stale "Camel 0 wins!".
    await expect.poll(() => countColor(page, '#e8c83a', 6, 22)).toBe(0);
    const confetti = await page.evaluate(() => new Promise((resolve) => {
      const proto = CanvasRenderingContext2D.prototype;
      const original = proto.fillRect;
      let count = 0;
      proto.fillRect = function (x, y, w, h) { if (w === 4 && h === 4) count += 1; return original.apply(this, arguments); };
      let frames = 0;
      function tick() {
        let again = false;
        try {
          frames += 1;
          if (frames >= 3) { resolve(count); return; }
          again = true;
          requestAnimationFrame(tick);
        } finally {
          if (!again) proto.fillRect = original;
        }
      }
      requestAnimationFrame(tick);
    }));
    expect(confetti).toBe(0);
    expect(errors).toEqual([]);
  });

  test('finish pole stripe alternates light and dark checker colors', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(200); GameCore.resetRace(); GameCore.setScore('camel-0', 180); });
    await settle(page);
    const goalScreenX = await page.evaluate(() => GameDebug.getScene().goalScreenX);
    expect(goalScreenX).toBeGreaterThan(0);
    const { light, dark } = await page.evaluate(({ gx }) => {
      const stripeX = Math.round(gx) - 6 + 8;
      const img = document.getElementById('game').getContext('2d')
        .getImageData(stripeX, 120, 8, 720 - 120).data;
      let light = 0, dark = 0;
      for (let i = 0; i < img.length; i += 4) {
        if (img[i] === 240 && img[i + 1] === 240 && img[i + 2] === 240) light += 1;
        if (img[i] === 26 && img[i + 1] === 26 && img[i + 2] === 26) dark += 1;
      }
      return { light, dark };
    }, { gx: goalScreenX });
    expect(light).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(0);
  });

  test('changing the goal after the race does not create a second winner or unlock controls', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); });
    await winLane(page, 0, 250);
    await expect(page.locator('#live')).toHaveText('Team 1 wins!');

    for (const value of ['100', '9000']) {
      await page.evaluate((v) => {
        const el = document.getElementById('goalScore');
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
      const s = await page.evaluate(() => GameCore.getState());
      expect(s.raceOver).toBe(true);
      expect(s.winnerId).toBe('camel-0');
      await expect(page.locator('#live')).toHaveText('Team 1 wins!');
    }
    expect(await page.evaluate(() => GameCore.getState().camels.map((c) => c.score))).toEqual([250, 0, 0, 0]);

    await page.locator('#newRace').click();
    expect(await page.evaluate(() => GameCore.getState().raceOver)).toBe(false);
  });

  test('toggling infinite after the race then New race keeps state sane and restores the finish line', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(200); GameCore.resetRace(); GameCore.setScore('camel-0', 200); });
    await expect(page.locator('#live')).toHaveText('Team 1 wins!');

    await page.locator('#infinite').check();
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(false);
    expect(await page.evaluate(() => GameCore.getState().raceOver)).toBe(true); // still over until New race

    await page.locator('#newRace').click();
    await expect(page.locator('#live')).toHaveText('');
    expect(await page.evaluate(() => GameCore.getState().raceOver)).toBe(false);
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(false); // still infinite

    await page.locator('#infinite').uncheck();
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(true);
    expect(await page.evaluate(() => GameCore.getState().goalScore)).toBe(200);
  });

  test('infinite mode never ends: 5000 then more keeps raceOver false and no winner', async ({ page }) => {
    await page.locator('#infinite').check();
    await expect.poll(() => page.evaluate(() => GameDebug.getScene().finishVisible)).toBe(false);

    await page.evaluate(() => { GameCore.setScore('camel-0', 5000); GameCore.addScore('camel-0', 500); });
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.camels[0].score).toBe(5500);
    expect(s.raceOver).toBe(false);
    expect(s.winnerId).toBe(null);
    await expect(page.locator('#live')).toHaveText('');
  });
});
