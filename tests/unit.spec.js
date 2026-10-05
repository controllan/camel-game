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
        GameCore.mapScoreToScreenX(0, w, 1280),
        GameCore.mapScoreToScreenX(50, w, 1280),
        GameCore.mapScoreToScreenX(100, w, 1280),
        GameCore.mapScoreToScreenX(-50, w, 1280),
        GameCore.mapScoreToScreenX(150, w, 1280),
        GameCore.mapScoreToScreenX(50, w), // default buffer width is 1280
      ];
    });
    expect(r).toEqual([0, 640, 1280, 0, 1280, 640]);
  });

  test('terrainHeightAt is deterministic, bounded to ±2 and continuous', async ({ page }) => {
    const r = await page.evaluate(() => {
      let min = Infinity, max = -Infinity, maxStep = 0;
      for (let x = 0; x <= 1280; x += 1) {
        const h = GameCore.terrainHeightAt(x);
        if (h < min) min = h;
        if (h > max) max = h;
        if (x > 0) maxStep = Math.max(maxStep, Math.abs(h - GameCore.terrainHeightAt(x - 1)));
      }
      // Non-finite input must not throw and resolves to h(0).
      const nan = GameCore.terrainHeightAt(NaN);
      // Fixed value vector computed from the documented field
      // h(x)=1.2*sin(2*pi*x/160)+0.8*sin(2*pi*x/130+1.7). A constant (e.g.
      // return 0) or a wrong phase/amplitude cannot satisfy these.
      const vector = [0, 13, 40, 80, 160, 171].map((x) => [x, GameCore.terrainHeightAt(x)]);
      return {
        first: GameCore.terrainHeightAt(0),
        repeat: GameCore.terrainHeightAt(0),
        min, max, maxStep, nan, vector,
      };
    });
    expect(r.first).toBe(r.repeat); // pure: same input -> same output, no randomness
    expect(r.nan).toBe(r.first);
    expect(r.min).toBeGreaterThanOrEqual(-2);
    expect(r.max).toBeLessThanOrEqual(2);
    expect(r.maxStep).toBeLessThanOrEqual(1); // small step continuity
    const expected = [
      [0, 0.7933], [13, 1.1676], [40, 0.8223],
      [80, -0.5255], [160, -0.0067], [171, 0.0911],
    ];
    expect(r.vector.map((p) => p[0])).toEqual(expected.map((p) => p[0]));
    r.vector.forEach(([, v], i) => expect(v).toBeCloseTo(expected[i][1], 4));
  });

  test('default lane names are Team 1..8 in both languages', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(8);
      GameCore.resetRace();
      const names = GameCore.getState().camels.map((c) => c.name);
      GameCore.setLanguage('de');
      const deNames = GameCore.getState().camels.map((c) => c.name);
      return { names, deNames, tplEn: GameCore.camelName(0, 'en'), tplDe: GameCore.camelName(0, 'de') };
    });
    expect(r.names).toEqual(['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6', 'Team 7', 'Team 8']);
    expect(r.deNames).toEqual(r.names);
    expect(r.tplEn).toBe('Team 1');
    expect(r.tplDe).toBe('Team 1');
  });

  test('setCamelName trims, and rejects empty/over-16/missing without changing state', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      const before = GameCore.getState().camels[0].name;
      const trimmed = GameCore.setCamelName('camel-0', '  Lightning  ');
      const afterTrim = GameCore.getState().camels[0].name;
      const empty = GameCore.setCamelName('camel-0', '   ');
      const emptyStr = GameCore.setCamelName('camel-0', '');
      const tooLong = GameCore.setCamelName('camel-0', 'x'.repeat(17));
      const stillLightning = GameCore.getState().camels[0].name;
      const max16 = GameCore.setCamelName('camel-0', 'y'.repeat(16));
      const finalName = GameCore.getState().camels[0].name;
      const missing = GameCore.setCamelName('nope', 'x');
      return { before, trimmed, afterTrim, empty, emptyStr, tooLong, stillLightning, max16, finalName, missing };
    });
    expect(r.before).toBe('Team 1');
    expect(r.trimmed).toBe(true);
    expect(r.afterTrim).toBe('Lightning');
    expect(r.empty).toBe(false);
    expect(r.emptyStr).toBe(false);
    expect(r.tooLong).toBe(false);
    expect(r.stillLightning).toBe('Lightning');
    expect(r.max16).toBe(true);
    expect(r.finalName).toBe('y'.repeat(16));
    expect(r.missing).toBe(false);
  });

  test('setCamelName strips control/bidi/zero-width chars, then applies trim/empty/16 rules', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      const bidi = GameCore.setCamelName('camel-0', '\u202eTeam');
      const afterBidi = GameCore.getState().camels[0].name;
      const nul = GameCore.setCamelName('camel-0', 'A\u0000B');
      const afterNul = GameCore.getState().camels[0].name;
      const zwsp = GameCore.setCamelName('camel-0', 'Ze\u200bro');
      const afterZwsp = GameCore.getState().camels[0].name;
      // 17 visible chars after stripping the format char -> still rejected.
      const tooLong = GameCore.setCamelName('camel-0', '\u202e' + 'x'.repeat(17));
      const afterTooLong = GameCore.getState().camels[0].name;
      // Only format chars -> strips to empty -> rejected, state untouched.
      const onlyFmt = GameCore.setCamelName('camel-0', '\u202e\u200b');
      const afterOnlyFmt = GameCore.getState().camels[0].name;
      const max16 = GameCore.setCamelName('camel-0', '\u202e' + 'y'.repeat(16));
      const afterMax16 = GameCore.getState().camels[0].name;
      return { bidi, afterBidi, nul, afterNul, zwsp, afterZwsp, tooLong, afterTooLong, onlyFmt, afterOnlyFmt, max16, afterMax16 };
    });
    expect(r.bidi).toBe(true);
    expect(r.afterBidi).toBe('Team');
    expect(r.nul).toBe(true);
    expect(r.afterNul).toBe('AB');
    expect(r.zwsp).toBe(true);
    expect(r.afterZwsp).toBe('Zero');
    expect(r.tooLong).toBe(false);
    expect(r.afterTooLong).toBe('Zero');
    expect(r.onlyFmt).toBe(false);
    expect(r.afterOnlyFmt).toBe('Zero');
    expect(r.max16).toBe(true);
    expect(r.afterMax16).toBe('y'.repeat(16));
  });

  test('restore path strips control/bidi/zero-width and is surrogate-safe', async ({ page }) => {
    const r = await page.evaluate(() => {
      const name = (v) => GameCore.deserialize({ version: 1, camelCount: 2, camels: [{ name: v, score: 1 }] }).fields.camels[0].name;
      return {
        bidi: name('\u202eTeam'),
        nul: name('A\u0000B'),
        zwsp: name('Ze\u200bro'),
        onlyFmt: name('\u202e\u200b'),
        surrogate: name('x'.repeat(15) + '\u{1F42A}'),
      };
    });
    expect(r.bidi).toBe('Team');
    expect(r.nul).toBe('AB');
    expect(r.zwsp).toBe('Zero');
    expect(r.onlyFmt).toBe('Team 1');
    expect(Array.from(r.surrogate).length).toBe(16);
    expect(r.surrogate).toBe('x'.repeat(15) + '\u{1F42A}');
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

  test('setLanguage switches language, rejects unsupported codes and keeps names', async ({ page }) => {
    const r = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setCamelName('camel-0', 'Bolt');
      const ok = GameCore.setLanguage('de');
      const names = GameCore.getState().camels.map((c) => c.name);
      const bad = GameCore.setLanguage('fr');
      const after = GameCore.getState();
      return { ok, names, bad, language: after.language, namesAfter: after.camels.map((c) => c.name) };
    });
    expect(r.ok).toBe(true);
    // Custom names and Team defaults are session-only and never translated.
    expect(r.names).toEqual(['Bolt', 'Team 2', 'Team 3', 'Team 4']);
    expect(r.bad).toBe(false);
    expect(r.language).toBe('de');
    expect(r.namesAfter).toEqual(['Bolt', 'Team 2', 'Team 3', 'Team 4']);
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

test.describe('Persistence validation', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('serialize produces the exact schema with version 1', async ({ page }) => {
    const obj = await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(200);
      GameCore.resetRace();
      return GameCore.serialize();
    });
    expect(obj.version).toBe(1);
    expect(Object.keys(obj).sort()).toEqual(
      ['camelCount', 'camels', 'goalScore', 'infinite', 'language', 'raceOver', 'theme', 'version', 'winnerId'].sort());
    expect(obj.camelCount).toBe(4);
    expect(obj.camels.length).toBe(4);
    expect(obj.camels[0]).toEqual({ name: 'Team 1', score: 0 });
    expect(obj.goalScore).toBe(200);
    expect(obj.infinite).toBe(false);
    expect(obj.language).toBe('en');
    expect(obj.theme).toBe('forest');
    expect(obj.raceOver).toBe(false);
    expect(obj.winnerId).toBe(null);
  });

  test('deserialize clamps every field; bad root -> defaults + writeBack', async ({ page }) => {
    const r = await page.evaluate(() => ({
      nullRoot: GameCore.deserialize(null),
      arrayRoot: GameCore.deserialize([1, 2, 3]),
      badVersion: GameCore.deserialize({ version: 99, camelCount: 6 }),
      clamped: GameCore.deserialize({
        version: 1, camelCount: 99, camels: [{ name: '  A\u0000B  ', score: -3 }, { score: 2.5 }],
        goalScore: 99999, infinite: false, language: 'fr', theme: 'nope', raceOver: true, winnerId: 'camel-7',
      }),
      infinite: GameCore.deserialize({ version: 1, infinite: true, goalScore: 500, camelCount: 2, camels: [], winnerId: 'camel-1', raceOver: true }),
    }));
    expect(r.nullRoot.writeBack).toBe(true);
    expect(r.arrayRoot.writeBack).toBe(true);
    expect(r.badVersion.writeBack).toBe(false);           // unknown version: no overwrite
    expect(r.badVersion.fields.camelCount).toBe(4);        // fresh defaults
    expect(r.clamped.fields.camelCount).toBe(8);
    expect(r.clamped.fields.camels[0].name).toBe('AB');    // sanitized + trimmed + <=16
    expect(r.clamped.fields.camels[0].score).toBe(0);      // negative -> 0
    expect(r.clamped.fields.camels[1].name).toBe('Team 2');
    expect(r.clamped.fields.camels[1].score).toBe(0);      // non-integer -> 0
    expect(r.clamped.fields.goalScore).toBe(10000);        // clamped
    expect(r.clamped.fields.language).toBe('en');
    expect(r.clamped.fields.theme).toBe('forest');
    expect(r.clamped.fields.raceOver).toBe(true);
    expect(r.clamped.fields.winnerId).toBe('camel-7');    // lane exists in the clamped 8-camel race
    expect(r.infinite.fields.goalScore).toBe(null);        // infinite forces null
    expect(r.infinite.fields.winnerId).toBe('camel-1');
  });

  test('winnerId must match an existing lane; raceOver false forces null', async ({ page }) => {
    const r = await page.evaluate(() => ({
      missing: GameCore.deserialize({ version: 1, camelCount: 2, camels: [], raceOver: true, winnerId: 'camel-5' }).fields.winnerId,
      notOver: GameCore.deserialize({ version: 1, camelCount: 2, camels: [], raceOver: false, winnerId: 'camel-0' }).fields.winnerId,
      ok: GameCore.deserialize({ version: 1, camelCount: 2, camels: [], raceOver: true, winnerId: 'camel-1' }).fields.winnerId,
    }));
    expect(r.missing).toBe(null);
    expect(r.notOver).toBe(null);
    expect(r.ok).toBe('camel-1');
  });

  test('applyFields rebuilds camels; setTheme validates against registry', async ({ page }) => {
    const r = await page.evaluate(() => {
      const res = GameCore.deserialize({
        version: 1, camelCount: 3, camels: [{ name: 'X', score: 7 }, { name: 'Y', score: 8 }, { name: 'Z', score: 9 }],
        goalScore: 100, infinite: false, language: 'de', theme: 'forest', raceOver: false, winnerId: null,
      });
      GameCore.applyFields(res.fields);
      const s = GameCore.getState();
      return {
        ids: s.camels.map((c) => c.id),
        scores: s.camels.map((c) => c.score),
        theme: s.theme,
        language: s.language,
        themeIds: GameCore.getThemeIds().sort(),
        badSet: GameCore.setTheme('nope'),
        goodSet: GameCore.setTheme('desert'),
      };
    });
    expect(r.ids).toEqual(['camel-0', 'camel-1', 'camel-2']);
    expect(r.scores).toEqual([7, 8, 9]);
    expect(r.theme).toBe('forest');
    expect(r.language).toBe('de');
    expect(r.themeIds).toEqual(['desert', 'forest']);
    expect(r.badSet).toBe(false);
    expect(r.goodSet).toBe(true);
  });

  test('deserialize falls back per field for absent/non-integer/out-of-range values', async ({ page }) => {
    const r = await page.evaluate(() => {
      const f = (raw) => GameCore.deserialize(raw).fields;
      return {
        countFloat: f({ version: 1, camelCount: 2.5 }).camelCount,                       // non-integer -> 4
        countLow: f({ version: 1, camelCount: 1 }).camelCount,                           // clamp min 2
        goalLow: f({ version: 1, camelCount: 2, infinite: false, goalScore: 0 }).goalScore,   // clamp min 1
        goalAbsent: f({ version: 1, camelCount: 2, infinite: false }).goalScore,         // -> 200
        goalFloat: f({ version: 1, camelCount: 2, infinite: false, goalScore: 12.5 }).goalScore, // non-int -> 200
        raceOverBad: f({ version: 1, camelCount: 2, raceOver: 'yes' }).raceOver,         // -> false
        scoreHuge: f({ version: 1, camelCount: 2, camels: [{ name: 'A', score: Number.MAX_SAFE_INTEGER + 1 }] }).camels[0].score, // -> 0
        nameLong: f({ version: 1, camelCount: 2, camels: [{ name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', score: 1 }] }).camels[0].name, // <=16
        nameEmpty: f({ version: 1, camelCount: 2, camels: [{ name: '   ', score: 1 }] }).camels[0].name, // Team 1
      };
    });
    expect(r.countFloat).toBe(4);
    expect(r.countLow).toBe(2);
    expect(r.goalLow).toBe(1);
    expect(r.goalAbsent).toBe(200);
    expect(r.goalFloat).toBe(200);
    expect(r.raceOverBad).toBe(false);
    expect(r.scoreHuge).toBe(0);
    expect(r.nameLong).toBe('ABCDEFGHIJKLMNOP');
    expect(r.nameEmpty).toBe('Team 1');
  });

  test('GameStorage exposes KEY/VERSION and probes without throwing', async ({ page }) => {
    const r = await page.evaluate(() => ({
      key: GameStorage.KEY, ver: GameStorage.VERSION,
      has: ['available', 'load', 'save', 'clear'].every((k) => typeof GameStorage[k] === 'function'),
    }));
    expect(r.key).toBe('camelRace.v1');
    expect(r.ver).toBe(1);
    expect(r.has).toBe(true);
  });
});
