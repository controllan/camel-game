const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('GameCore unit', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('addScore and setScore update scores', async ({ page }) => {
    const score = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 10);
      GameCore.addScore('camel-0', 5);
      return GameCore.getState().camels[0].score;
    });
    expect(score).toBe(15);
  });

  test('setScore sets an absolute value, including lowering to zero', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 50);
      const high = GameCore.getState().camels[0].score;
      GameCore.setScore('camel-0', 12);
      const lowered = GameCore.getState().camels[0].score;
      GameCore.setScore('camel-0', 0);
      const zero = GameCore.getState().camels[0].score;
      return { high, lowered, zero };
    });
    expect(r.high).toBe(50);
    expect(r.lowered).toBe(12);
    expect(r.zero).toBe(0);
  });

  test('validation rejects bad values without changing state', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 7);
      const results = [
        GameCore.addScore('camel-0', -1),
        GameCore.addScore('camel-0', 1.5),
        GameCore.addScore('camel-0', NaN),
        GameCore.setScore('camel-0', -3),
        GameCore.setScore('camel-0', 1.5),
        GameCore.setScore('camel-0', NaN),
        GameCore.setScore('camel-0', 'x'),
      ];
      return { results, score: GameCore.getState().camels[0].score };
    });
    expect(r.results).toEqual([false, false, false, false, false, false, false]);
    expect(r.score).toBe(7);
  });

  test('camel count clamps 2-8, growth keeps scores, shrink drops highest lanes', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(1);
      const low = GameCore.getState().camelCount;
      GameCore.setCamelCount(99);
      const high = GameCore.getState().camelCount;
      GameCore.setCamelCount(6);
      GameCore.setScore('camel-0', 10);
      GameCore.setScore('camel-5', 50);
      GameCore.setCamelCount(8);
      const afterGrow = GameCore.getState().camels.map((c) => c.score);
      GameCore.setCamelCount(2);
      const afterShrink = GameCore.getState().camels.map((c) => ({ id: c.id, score: c.score }));
      return { low, high, afterGrow, afterShrink, len: GameCore.getState().camels.length };
    });
    expect(r.low).toBe(2);
    expect(r.high).toBe(8);
    expect(r.afterGrow.slice(0, 6)).toEqual([10, 0, 0, 0, 0, 50]);
    expect(r.len).toBe(2);
    expect(r.afterShrink).toEqual([{ id: 'camel-0', score: 10 }, { id: 'camel-1', score: 0 }]);
  });

  test('goal and infinite mode are mutually exclusive', async ({ page }) => {
    const r = await page.evaluate(() => {
      const out = {};
      GameCore.setGoal(200);
      out.a = { goalScore: GameCore.getState().goalScore, infinite: GameCore.getState().infinite };
      GameCore.setGoal(null);
      out.b = { goalScore: GameCore.getState().goalScore, infinite: GameCore.getState().infinite };
      GameCore.setGoal(500);
      out.c = { goalScore: GameCore.getState().goalScore, infinite: GameCore.getState().infinite };
      out.bad0 = GameCore.setGoal(0);
      out.bad10001 = GameCore.setGoal(10001);
      out.still = { goalScore: GameCore.getState().goalScore, infinite: GameCore.getState().infinite };
      return out;
    });
    expect(r.a).toEqual({ goalScore: 200, infinite: false });
    expect(r.b).toEqual({ goalScore: null, infinite: true });
    expect(r.c).toEqual({ goalScore: 500, infinite: false });
    expect(r.bad0).toBe(false);
    expect(r.bad10001).toBe(false);
    expect(r.still).toEqual({ goalScore: 500, infinite: false });
  });

  test('computeCameraWindow: clustered, wide spread, goal inclusion, goal far away', async ({ page }) => {
    const r = await page.evaluate(() => ({
      clustered: GameCore.computeCameraWindow([100, 100, 100], null),
      wide: GameCore.computeCameraWindow([0, 5000], null),
      goalNear: GameCore.computeCameraWindow([0, 100], 150),
      goalFar: GameCore.computeCameraWindow([0, 100], 1000),
      equalWithGoal: GameCore.computeCameraWindow([200, 200], 200),
    }));
    expect(r.clustered).toEqual({ min: 80, max: 180 });
    expect(r.wide).toEqual({ min: -20, max: 5020 });
    expect(r.goalNear).toEqual({ min: -20, max: 170 });
    expect(r.goalFar).toEqual({ min: -20, max: 120 });
    expect(r.equalWithGoal).toEqual({ min: 180, max: 280 });
  });

  test('mapScoreToScreenX maps linearly and clamps to canvas', async ({ page }) => {
    const r = await page.evaluate(() => {
      const w = { min: 0, max: 100 };
      return [
        GameCore.mapScoreToScreenX(0, w, 480),
        GameCore.mapScoreToScreenX(50, w, 480),
        GameCore.mapScoreToScreenX(100, w, 480),
        GameCore.mapScoreToScreenX(-50, w, 480),
        GameCore.mapScoreToScreenX(150, w, 480),
      ];
    });
    expect(r).toEqual([0, 240, 480, 0, 480]);
  });

  test('reaching the goal ends the race and locks scores', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(200);
      GameCore.resetRace();
      GameCore.setScore('camel-0', 200);
      const after = GameCore.getState();
      const blocked = GameCore.addScore('camel-1', 5);
      return {
        raceOver: after.raceOver,
        winnerId: after.winnerId,
        blocked,
        otherScore: GameCore.getState().camels[1].score,
      };
    });
    expect(r.raceOver).toBe(true);
    expect(r.winnerId).toBe('camel-0');
    expect(r.blocked).toBe(false);
    expect(r.otherScore).toBe(0);
  });

  test('resetRace clears scores/winner keeps config', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(6);
      GameCore.setGoal(300);
      GameCore.setScore('camel-0', 300);
      GameCore.resetRace();
      const s = GameCore.getState();
      return {
        raceOver: s.raceOver,
        winnerId: s.winnerId,
        scores: s.camels.map((c) => c.score),
        goalScore: s.goalScore,
        camelCount: s.camelCount,
      };
    });
    expect(r.raceOver).toBe(false);
    expect(r.winnerId).toBe(null);
    expect(r.scores).toEqual([0, 0, 0, 0, 0, 0]);
    expect(r.goalScore).toBe(300);
    expect(r.camelCount).toBe(6);
  });

  test('setting a numeric goal at or below the leader immediately ends the race', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.resetRace();
      GameCore.setGoal(null);
      GameCore.setScore('camel-2', 300);
      const before = { raceOver: GameCore.getState().raceOver, winnerId: GameCore.getState().winnerId };
      GameCore.setGoal(250);
      const after = GameCore.getState();
      return { before, raceOver: after.raceOver, winnerId: after.winnerId };
    });
    expect(r.before).toEqual({ raceOver: false, winnerId: null });
    expect(r.raceOver).toBe(true);
    expect(r.winnerId).toBe('camel-2');
  });

  test('resetRace zeroes animUntil on every camel and keeps config', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(5);
      GameCore.resetRace();
      GameCore.addScore('camel-0', 5);
      GameCore.addScore('camel-3', 7);
      const before = GameCore.getState().camels.map((c) => c.animUntil);
      GameCore.resetRace();
      const s = GameCore.getState();
      return {
        anyBefore: before.some((v) => v > 0),
        animUntil: s.camels.map((c) => c.animUntil),
        scores: s.camels.map((c) => c.score),
        camelCount: s.camelCount,
      };
    });
    expect(r.anyBefore).toBe(true);
    expect(r.animUntil).toEqual([0, 0, 0, 0, 0]);
    expect(r.scores).toEqual([0, 0, 0, 0, 0]);
    expect(r.camelCount).toBe(5);
  });

  test('setLanguage de re-localizes names and rejects unsupported languages', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      const ok = GameCore.setLanguage('de');
      const names = GameCore.getState().camels.map((c) => c.name);
      const bad = GameCore.setLanguage('fr');
      const after = GameCore.getState();
      return { ok, names, bad, language: after.language, namesAfter: after.camels.map((c) => c.name) };
    });
    expect(r.ok).toBe(true);
    expect(r.names).toEqual(['Kamel 1', 'Kamel 2', 'Kamel 3', 'Kamel 4']);
    expect(r.bad).toBe(false);
    expect(r.language).toBe('de');
    expect(r.namesAfter).toEqual(['Kamel 1', 'Kamel 2', 'Kamel 3', 'Kamel 4']);
  });

  test('subscribe notifies on score mutation and unsubscribe stops notifications', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.resetRace();
      GameCore.setGoal(null);
      let calls = 0;
      let lastScore = null;
      const unsub = GameCore.subscribe((s) => { calls += 1; lastScore = s.camels[0].score; });
      GameCore.addScore('camel-0', 5);
      const afterFirst = calls;
      const lastAfterFirst = lastScore;
      unsub();
      GameCore.addScore('camel-0', 5);
      return { afterFirst, lastAfterFirst, callsAfterUnsub: calls, score: GameCore.getState().camels[0].score };
    });
    expect(r.afterFirst).toBe(1);
    expect(r.lastAfterFirst).toBe(5);
    expect(r.callsAfterUnsub).toBe(1);
    expect(r.score).toBe(10);
  });
});
