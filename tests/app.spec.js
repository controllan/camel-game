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

  test('1920x1080 scales the 512px buffer to at least 3x', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoGame(page);
    const l = await page.evaluate(() => GameDebug.getCanvasLayout());
    // The binding dimension is width here (panel beside the canvas): the real
    // fill snaps to a crisp 3x (3 * 512 = 1536px) without overflowing.
    expect(l.bufferWidth).toBe(512);
    expect(l.bufferHeight).toBe(288);
    expect(l.cssWidth).toBeGreaterThanOrEqual(1536);
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
    for (const required of ['lang-en', 'lang-de', 'camelCount', 'goalScore', 'infinite', 'lane-add', 'lane-set', 'newRace']) {
      expect(seen.has(required)).toBe(true);
    }
  });
});
