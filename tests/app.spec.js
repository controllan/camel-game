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

  test('1024x768 keeps panel beside the canvas with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoGame(page);
    const cb = await page.locator('#game').boundingBox();
    const pb = await page.locator('#panel').boundingBox();
    expect(cb.width).toBeGreaterThan(480);
    expect(cb.width).toBeLessThanOrEqual(960);
    expect(pb.x).toBeGreaterThanOrEqual(cb.x + cb.width - 1);
    expect(Math.abs(pb.y - cb.y)).toBeLessThanOrEqual(2);
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(noOverflow).toBe(true);
  });

  test('canvas upscales responsively up to 2x and keeps 16:9 with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await gotoGame(page);
    const capped = await page.locator('#game').boundingBox();
    expect(capped.width).toBe(960);
    expect(Math.abs(capped.width / capped.height - 16 / 9)).toBeLessThan(0.02);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);

    await page.setViewportSize({ width: 1440, height: 900 });
    const wide = await page.locator('#game').boundingBox();
    expect(wide.width).toBeGreaterThan(480);
    expect(wide.width).toBeLessThanOrEqual(960);
    expect(Math.abs(wide.width / wide.height - 16 / 9)).toBeLessThan(0.02);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);

    await page.setViewportSize({ width: 400, height: 800 });
    const narrow = await page.locator('#game').boundingBox();
    expect(narrow.width).toBeLessThanOrEqual(480);
    expect(Math.abs(narrow.width / narrow.height - 16 / 9)).toBeLessThan(0.02);
  });

  test('every control is keyboard reachable and shows a visible focus outline', async ({ page }) => {
    await gotoGame(page);
    const seen = new Set();
    const outlineFailures = [];
    for (let i = 0; i < 30; i++) {
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
