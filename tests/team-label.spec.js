const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

// Team-name labels above each animal. Geometry is exposed through the debug
// surface (GameDebug.getScene().teamLabels) so these tests assert positions
// without pixel archaeology; one test also proves the ink actually changes.

async function settle(page) {
  await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
}

// After a score batch that widens the camera window, isSettled() can be
// transiently true until the next frame recomputes the window (the stale window
// still targets the old positions); wait for the widened window first, then for
// the ease to finish. Keeps the edge/name tests free of a settle race.
async function settleWide(page) {
  await expect.poll(() => page.evaluate(() => {
    const w = GameDebug.getCameraWindow();
    return w.max - w.min;
  })).toBeGreaterThan(50000);
  await settle(page);
}

// FNV-1a hash of a canvas rect: cheap signature for a before/after pixel diff.
function bandHash(page, rect) {
  return page.evaluate(({ x, y, w, h }) => {
    const d = document.getElementById('game').getContext('2d').getImageData(x, y, w, h).data;
    let hash = 2166136261;
    for (let i = 0; i < d.length; i++) {
      hash ^= d[i];
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }, rect);
}

// A fixed band above the animal that fully contains the label pill (and NOT
// the sprite below it), independent of the label's width, so the same rect can
// be read before and after a rename.
function fixedLabelBand(l) {
  const cx = l.x + l.w / 2;
  const w = 240;
  let x = Math.round(cx - w / 2);
  if (x < 0) x = 0; else if (x + w > 1280) x = 1280 - w;
  const y = Math.max(0, l.y - 4);
  const h = Math.min(l.h + 8, 720 - y);
  return { x: x, y: y, w: w, h: h };
}

test.describe('Team name labels', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  for (const themeId of ['desert', 'forest']) {
    test(`one label per lane, centered above its animal, inside the canvas (${themeId})`, async ({ page }) => {
      await page.evaluate((themeId) => {
        GameCore.setTheme(themeId);
        GameCore.setCamelCount(8);
        GameCore.setGoal(null);
        GameCore.resetRace();
      }, themeId);
      await settle(page);
      const r = await page.evaluate(() => ({
        labels: GameDebug.getScene().teamLabels,
        bounds: GameDebug.getCamelSpriteBounds(),
      }));
      expect(r.labels.length).toBe(8);
      for (let i = 0; i < 8; i++) {
        const l = r.labels[i];
        const b = r.bounds[i];
        expect(l.id).toBe(b.id);
        expect(typeof l.name).toBe('string');
        expect(l.h).toBe(16);
        // centered on the animal's visual x (same visualLeft the sprite drew at)
        expect(Math.abs((l.x + l.w / 2) - (b.left + b.right) / 2)).toBeLessThanOrEqual(1);
        // above the sprite's top with a small gap
        expect(l.y + l.h).toBeLessThanOrEqual(b.top);
        expect(b.top - (l.y + l.h)).toBeGreaterThanOrEqual(2);
        expect(b.top - (l.y + l.h)).toBeLessThanOrEqual(6);
        // clamped inside the canvas
        expect(l.x).toBeGreaterThanOrEqual(0);
        expect(l.x + l.w).toBeLessThanOrEqual(1280);
        expect(l.y).toBeGreaterThanOrEqual(0);
        expect(l.y + l.h).toBeLessThanOrEqual(720);
      }
    });
  }

  test('label x follows the animal when its score changes', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setTheme('desert');
      GameCore.setCamelCount(4);
      GameCore.setGoal(null);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 0);
    });
    await settle(page);
    const before = await page.evaluate(() => ({
      l: GameDebug.getScene().teamLabels[0],
      b: GameDebug.getCamelSpriteBounds()[0],
    }));
    await page.evaluate(() => GameCore.setScore('camel-0', 600));
    // Sample MID-lerp (LERP_MS = 900), where the label's live source matters:
    // the label must ride the animal's lerped visualLeft, not jump to the new
    // target while the sprite is still easing. Rendering the label at the target
    // x leaves the sprite behind it, so the centre would no longer match.
    const mid = await page.evaluate(async () => {
      let frames = 0;
      while (GameDebug.isSettled() && frames < 120) {
        await new Promise((r) => requestAnimationFrame(r));
        frames += 1;
      }
      await new Promise((r) => requestAnimationFrame(r));
      return {
        settled: GameDebug.isSettled(),
        l: GameDebug.getScene().teamLabels[0],
        b: GameDebug.getCamelSpriteBounds()[0],
      };
    });
    expect(mid.settled).toBe(false); // genuinely sampled mid-motion
    expect(Math.abs((mid.l.x + mid.l.w / 2) - (mid.b.left + mid.b.right) / 2)).toBeLessThanOrEqual(1);
    await settle(page);
    const after = await page.evaluate(() => ({
      l: GameDebug.getScene().teamLabels[0],
      b: GameDebug.getCamelSpriteBounds()[0],
    }));
    // the animal moved ...
    expect(after.b.left - before.b.left).toBeGreaterThan(50);
    // ... and so did its label (not stuck); the centre tracks the new visual x
    expect(after.l.x - before.l.x).toBeGreaterThan(50);
    expect(Math.abs((after.l.x + after.l.w / 2) - (after.b.left + after.b.right) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs((before.l.x + before.l.w / 2) - (before.b.left + before.b.right) / 2)).toBeLessThanOrEqual(1);
  });

  for (const themeId of ['desert', 'forest']) {
    test(`renaming a team updates the label metadata and the canvas ink (${themeId})`, async ({ page }) => {
      await page.evaluate((themeId) => {
        GameCore.setTheme(themeId);
        GameCore.setCamelCount(3);
        GameCore.setGoal(null);
        GameCore.resetRace();
      }, themeId);
      await settle(page);
      const before = await page.evaluate(() => GameDebug.getScene().teamLabels[0]);
      expect(before.name).toBe('Team 1');
      const band = fixedLabelBand(before);
      const hashBefore = await bandHash(page, band);
      // User path: type into the Team input.
      await page.locator('.lane').nth(0).locator('[data-name-input]').fill('BOLT');
      await expect.poll(() => page.evaluate(() => GameDebug.getScene().teamLabels[0].name)).toBe('BOLT');
      const after = await page.evaluate(() => GameDebug.getScene().teamLabels[0]);
      expect(after.name).toBe('BOLT');
      const hashAfter = await bandHash(page, band);
      expect(hashAfter).not.toBe(hashBefore);
    });
  }

  test('a 16-char name stays within the canvas at both edges', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setTheme('desert');
      GameCore.setCamelCount(8);
      GameCore.setGoal(null);
      GameCore.resetRace();
      GameCore.setCamelName('camel-0', 'ABCDEFGHIJKLMNOP');
      GameCore.setCamelName('camel-1', 'ZYXWVUTSRQPONMLK');
      GameCore.setScore('camel-0', 0);
      GameCore.setScore('camel-1', 100000);
    });
    await settleWide(page);
    const labels = await page.evaluate(() => GameDebug.getScene().teamLabels);
    const long = labels.filter((l) => l.name.length === 16);
    expect(long.length).toBe(2);
    for (const l of long) {
      expect(l.w).toBeGreaterThan(100); // long enough to need clamping
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.x + l.w).toBeLessThanOrEqual(1280);
    }
  });

  // Wide camera-extreme spread pins the trailing lane to the left edge and the
  // leading lane to the right edge. Long (16-char) names are wide enough that the
  // x-clamp must actually engage on both sides: short default names fit inside the
  // lane margins (camelTargetLeft keeps the sprite in) and never need clamping.
  for (const laneCount of [2, 8]) {
    test(`labels stay clamped at extreme camera positions (${laneCount} lanes)`, async ({ page }) => {
      await page.evaluate((laneCount) => {
        GameCore.setTheme('forest');
        GameCore.setCamelCount(laneCount);
        GameCore.setGoal(null);
        GameCore.resetRace();
        for (let i = 0; i < laneCount; i++) GameCore.setCamelName('camel-' + i, 'ABCDEFGHIJKLMNOP');
        GameCore.setScore('camel-0', 0);
        GameCore.setScore('camel-' + (laneCount - 1), 100000);
      }, laneCount);
      await settleWide(page);
      const labels = await page.evaluate(() => GameDebug.getScene().teamLabels);
      expect(labels.length).toBe(laneCount);
      for (const l of labels) {
        expect(l.x).toBeGreaterThanOrEqual(0);
        expect(l.x + l.w).toBeLessThanOrEqual(1280);
        expect(l.y).toBeGreaterThanOrEqual(0);
        expect(l.y + l.h).toBeLessThanOrEqual(720);
      }
      // The clamp really engaged (not merely never triggered): the trailer is
      // pinned to the left edge, the leader to the right edge.
      const trailer = labels.find((l) => l.id === 'camel-0');
      const leader = labels.find((l) => l.id === 'camel-' + (laneCount - 1));
      expect(trailer.x).toBe(0);
      expect(leader.x + leader.w).toBe(1280);
    });
  }

  test('isSettled() is honest across a lane grow and a shrink', async ({ page }) => {
    // Use the default scene untouched (fixed goal/window) so the ONLY thing that
    // changes in this test is the lane set: no camera-window transition can
    // masquerade as unsettled, which keeps the assertions non-vacuous.
    await settle(page);
    expect(await page.evaluate(() => GameDebug.isSettled())).toBe(true);

    // Grow synchronously in a single task: no frame can run between the mutation
    // and the read, so the added lanes have no painted visualLeft entry yet.
    // The honest hook must report unsettled rather than hand back last frame.
    const grownUnsettled = await page.evaluate(() => {
      GameCore.setCamelCount(8);
      return GameDebug.isSettled();
    });
    expect(grownUnsettled).toBe(false);

    // It converges only once a frame has painted all eight lanes.
    await settle(page);
    expect(await page.evaluate(() => GameDebug.getScene().teamLabels.length)).toBe(8);

    // Shrink must not deadlock: deleted ids linger in runtime.visualLeft, but the
    // hook only inspects current lanes, so it settles again to the 2-lane scene.
    await page.evaluate(() => GameCore.setCamelCount(2));
    await settle(page);
    expect(await page.evaluate(() => GameDebug.getScene().teamLabels.length)).toBe(2);
    expect(await page.evaluate(() => GameDebug.isSettled())).toBe(true);
  });

  test('getScene keeps its existing fields alongside teamLabels', async ({ page }) => {
    const scene = await page.evaluate(() => GameDebug.getScene());
    expect(scene).toHaveProperty('finishVisible');
    expect(scene).toHaveProperty('goalScreenX');
    expect(scene).toHaveProperty('decorDrawn');
    expect(scene).toHaveProperty('decorKinds');
    expect(scene).toHaveProperty('midground');
    expect(scene).toHaveProperty('confettiDrawn');
    expect(Array.isArray(scene.teamLabels)).toBe(true);
    expect(scene.teamLabels.length).toBeGreaterThan(0);
    expect(scene.teamLabels[0]).toEqual({
      id: expect.any(String), name: expect.any(String),
      x: expect.any(Number), y: expect.any(Number),
      w: expect.any(Number), h: expect.any(Number),
    });
  });
});
