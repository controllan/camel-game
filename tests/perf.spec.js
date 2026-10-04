const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('Performance acceptance', () => {
  // Forest decor differs from desert (9 sprite kinds incl. floor cover + an extra
  // rng draw per floor cell), so gate both themes with the same budget.
  for (const themeId of ['desert', 'forest']) {
    test(`>=55 fps over >=120 rAF frames, 8 lanes, score spread 0 vs 5000 (${themeId})`, async ({ page }) => {
      await gotoGame(page);
      const result = await page.evaluate((theme) => new Promise((resolve) => {
        GameCore.setCamelCount(8);
        GameCore.setGoal(null);
        GameCore.resetRace();
        GameCore.setTheme(theme);
        GameCore.setScore('camel-0', 5000);
        // Warm up JIT/first-layout for 10 frames before sampling so the average
        // is not skewed by one-off startup cost.
        const WARM_UP = 10;
        const SAMPLE = 180;
        let frame = 0;
        let t0 = 0;
        function tick() {
          frame += 1;
          if (frame === WARM_UP) t0 = performance.now();
          if (frame >= WARM_UP + SAMPLE) {
            const elapsed = performance.now() - t0;
            resolve({ frames: SAMPLE, fps: SAMPLE / (elapsed / 1000) });
          } else {
            requestAnimationFrame(tick);
          }
        }
        requestAnimationFrame(tick);
      }), themeId);
      expect(result.frames).toBeGreaterThanOrEqual(120);
      expect(result.fps).toBeGreaterThanOrEqual(55);
    });
  }
});
