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

  test('panel stacks below canvas under 900px and the page never scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await gotoGame(page);
    const cb = await page.locator('#game').boundingBox();
    const pb = await page.locator('#panel').boundingBox();
    expect(pb.y).toBeGreaterThanOrEqual(cb.y + cb.height - 1);
    const noScroll = await page.evaluate(() => ({
      h: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      v: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
    }));
    expect(noScroll).toEqual({ h: true, v: true });
  });

  test('canvas has an accessible label and controls expose expected bounds', async ({ page }) => {
    await gotoGame(page);
    await expect(page.locator('#game')).toHaveAttribute('aria-label', /race/i);
    await expect(page.locator('#lang-en')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#camelCount')).toHaveAttribute('type', 'number');
    await expect(page.locator('#camelCount')).toHaveAttribute('min', '2');
    await expect(page.locator('#camelCount')).toHaveAttribute('max', '8');
    await expect(page.locator('#goalScore')).toHaveAttribute('type', 'number');
    await expect(page.locator('#goalScore')).toHaveAttribute('min', '1');
    await expect(page.locator('#goalScore')).toHaveAttribute('max', '10000');
    await expect(page.locator('#infinite')).toHaveAttribute('type', 'checkbox');
    await expect(page.locator('#live')).toHaveAttribute('aria-live', 'polite');
  });

  test('1024x768 keeps the panel beside the canvas and the page never scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoGame(page);
    const cb = await page.locator('#game').boundingBox();
    const pb = await page.locator('#panel').boundingBox();
    expect(pb.x).toBeGreaterThanOrEqual(cb.x + cb.width - 1); // panel right of canvas
    expect(pb.y).toBeLessThanOrEqual(cb.y + 1); // same row: panel top at/above canvas top
    const noScroll = await page.evaluate(() => ({
      h: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      v: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
    }));
    expect(noScroll).toEqual({ h: true, v: true });
  });

  // One coherent rule: the canvas fills the binding dimension of its wrapper
  // (width beside the panel, height once stacked), snapping to a crisp integer
  // multiple only when the fit is already within 8% of it and still fits.
  const FILL_VIEWPORTS = [
    { width: 200, height: 400 },
    { width: 280, height: 500 },
    { width: 400, height: 800 },
    { width: 480, height: 900 },
    { width: 800, height: 900 },
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  for (const vp of FILL_VIEWPORTS) {
    test(`canvas fills its wrapper without overflow at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await gotoGame(page);
      const l = await page.evaluate(() => GameDebug.getCanvasLayout());
      const cb = await page.locator('#game').boundingBox();
      const fillW = (l.cssWidth + 4) / l.wrapperWidth;
      const fillH = (l.cssHeight + 4) / l.wrapperHeight;
      // Fills at least 85% of the binding dimension...
      expect(Math.max(fillW, fillH)).toBeGreaterThanOrEqual(0.85);
      // ...and never overflows the wrapper (2px border on each side), ratio stays 16:9.
      expect(l.cssWidth + 4).toBeLessThanOrEqual(l.wrapperWidth);
      expect(l.cssHeight + 4).toBeLessThanOrEqual(l.wrapperHeight);
      expect(Math.abs(cb.width / cb.height - 16 / 9)).toBeLessThan(0.05);
      const noScroll = await page.evaluate(() => ({
        h: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        v: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
      }));
      expect(noScroll).toEqual({ h: true, v: true });
    });
  }

  test('1920x1080 scales the 1280px buffer up without distortion or overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoGame(page);
    const l = await page.evaluate(() => GameDebug.getCanvasLayout());
    // The binding dimension is width here (panel beside the canvas). The fit is
    // fractional (~1.22) and does not snap to an integer: it is outside
    // SNAP_TOLERANCE (8%) of the nearest integer (1), so it fills the wrapper
    // width without overflowing.
    expect(l.bufferWidth).toBe(1280);
    expect(l.bufferHeight).toBe(720);
    expect(l.scale).toBeGreaterThan(1);
    expect(l.scale).toBeLessThanOrEqual(2);
    expect(l.cssWidth).toBeGreaterThanOrEqual(1280);
    expect(l.cssWidth + 4).toBeLessThanOrEqual(l.wrapperWidth);
    expect(l.cssHeight + 4).toBeLessThanOrEqual(l.wrapperHeight);
  });

  test('1700x1000 snaps the display scale to the 1x integer within the 8% tolerance', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await gotoGame(page);
    const l = await page.evaluate(() => GameDebug.getCanvasLayout());
    // The binding fit here (~1.05x) is within SNAP_TOLERANCE (8%) of 1 and 1x
    // fits the wrapper, so computeScale must return exactly 1 instead of the
    // fractional fit. Disabling the snap branch returns ~1.046875 and fails.
    expect(l.scale).toBe(1);
    expect(l.cssWidth).toBe(1280);
    expect(l.cssHeight).toBe(720);
    expect(l.cssWidth + 4).toBeLessThanOrEqual(l.wrapperWidth);
  });

  test('8 camels scroll inside the panel while the page itself never scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoGame(page);
    await page.locator('#camelCount').fill('8');
    await page.locator('#camelCount').blur();
    await expect(page.locator('.lane')).toHaveCount(8);
    const panel = await page.evaluate(() => {
      const el = document.getElementById('panel');
      return { scrollH: el.scrollHeight, clientH: el.clientHeight };
    });
    expect(panel.scrollH).toBeGreaterThan(panel.clientH);
    const noScroll = await page.evaluate(() => ({
      h: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      v: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
    }));
    expect(noScroll).toEqual({ h: true, v: true });
  });

  test('every control is keyboard reachable and shows a visible focus outline', async ({ page }) => {
    await gotoGame(page);
    const seen = new Set();
    const outlineFailures = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const cs = getComputedStyle(el);
        return {
          key: el.id || (el.getAttribute('data-action') ? 'lane-' + el.getAttribute('data-action') : el.tagName),
          isBody: el.tagName === 'BODY',
          outlineStyle: cs.outlineStyle,
          outlineWidth: parseFloat(cs.outlineWidth),
        };
      });
      if (info.isBody) break;
      seen.add(info.key);
      if (info.outlineStyle !== 'solid' || !(info.outlineWidth > 0)) outlineFailures.push(info.key);
    }
    expect(outlineFailures).toEqual([]);
    for (const required of ['lang-en', 'lang-de', 'theme-desert', 'camelCount', 'goalScore', 'infinite', 'lane-add', 'lane-set', 'newRace']) {
      expect(seen.has(required)).toBe(true);
    }
  });

  test('theme buttons are keyboard reachable with visible focus and EN label', async ({ page }) => {
    await gotoGame(page);
    await expect(page.locator('#themeToggle')).toHaveAttribute('role', 'group');
    await expect(page.locator('#themeToggle')).toHaveAttribute('aria-label', 'Theme');
    // Reach both theme buttons by real Tab presses (not .focus()) and assert the
    // :focus-visible outline is painted on each.
    const reached = {};
    for (let i = 0; i < 40 && Object.keys(reached).length < 2; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const cs = getComputedStyle(el);
        return { id: el.id, body: el.tagName === 'BODY', solid: cs.outlineStyle === 'solid' && parseFloat(cs.outlineWidth) > 0 };
      });
      if (info.body) break;
      if (info.id === 'theme-desert' || info.id === 'theme-forest') reached[info.id] = info.solid;
    }
    expect(reached).toEqual({ 'theme-desert': true, 'theme-forest': true });
  });

  test('page never scrolls at 1024x768, 1280x720, 1920x1080 in both themes', async ({ page }) => {
    for (const vp of [{ width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(vp);
      await gotoGame(page);
      for (const theme of ['desert', 'forest']) {
        await page.evaluate((th) => GameCore.setTheme(th), theme);
        await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
        const noScroll = await page.evaluate(() => ({
          h: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          v: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
        }));
        expect(noScroll, `${theme} @ ${vp.width}x${vp.height}`).toEqual({ h: true, v: true });
      }
    }
  });
});
