const { test, expect } = require('@playwright/test');
const { gotoGame, readIndexHtml, extractMatrixRows, INDEX_URL } = require('./helpers');

test.describe('Default theme + registry', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('static no-JS markup advertises the forest/boar default', async ({ browser }) => {
    // JS disabled: prove the pre-hydration fallbacks match the shipped default,
    // so the first paint and no-script users never read camel/desert copy.
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(INDEX_URL);
    await expect(page).toHaveTitle('BOAR RACE');
    await expect(page.locator('#title')).toHaveText('BOAR RACE');
    await expect(page.locator('#camelCountLabel')).toHaveText('Wild boars');
    await expect(page.locator('#game')).toHaveAttribute('aria-label',
      'Wild boar race track. Racers move left to right to the goal.');
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'false');
    await ctx.close();
  });

  test('default theme is forest; registry has desert + forest', async ({ page }) => {
    const r = await page.evaluate(() => ({ theme: GameCore.getState().theme, ids: GameCore.getThemeIds().sort() }));
    expect(r.theme).toBe('forest');
    expect(r.ids).toEqual(['desert', 'forest']);
  });

  test('fresh profile with no stored state loads forest: boar, Forest pressed, BOAR RACE', async ({ page }) => {
    // The beforeEach load is a fresh context: no persisted camelRace.v1 exists.
    expect(await page.evaluate(() => localStorage.getItem('camelRace.v1'))).toBe(null);
    const t = await page.evaluate(() => GameDebug.getTheme());
    expect(t.id).toBe('forest');
    expect(t.animalId).toBe('boar');
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#title')).toHaveText('BOAR RACE');
    expect(await page.title()).toBe('BOAR RACE');
    await expect(page.locator('#camelCountLabel')).toHaveText('Wild boars');
    await expect(page.locator('#game')).toHaveAttribute('aria-label',
      'Wild boar race track. Racers move left to right to the goal.');
  });

  test('renderer falls back to the forest theme for an unknown theme id', async ({ page }) => {
    // syncTheme protects against an out-of-registry state.theme (e.g. a path
    // that bypasses setTheme): the defensive fallback must be the shipped
    // default (forest), not desert.
    await page.evaluate(() => {
      const s = GameCore.getState();
      GameCore.applyFields({
        camelCount: s.camelCount,
        camels: s.camels.map((c) => ({ name: c.name, score: c.score })),
        goalScore: s.goalScore,
        infinite: s.infinite,
        language: s.language,
        theme: 'no-such-theme',
        raceOver: s.raceOver,
        winnerId: s.winnerId,
      });
    });
    const t = await page.evaluate(() => GameDebug.getTheme());
    expect(t.id).toBe('forest');
    expect(t.animalId).toBe('boar');
  });
});

test.describe('Theme registry (desert)', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('GameDebug reports active animal + sprite size (desert)', async ({ page }) => {
    await page.evaluate(() => GameCore.setTheme('desert'));
    const t = await page.evaluate(() => GameDebug.getTheme());
    expect(t).toEqual({ id: 'desert', animalId: 'camel', w: 76, h: 70 });
  });

  test('desert ambience density: per-layer stream caps hold and the sand carpet covers the lanes', async ({ page }) => {
    // docs/art/theme-art.md §2.11.3 / §2.14.1: at the default camera (W=100,
    // 4 lanes) the v2 desert dresses the dune with 3 background / 2 midground /
    // 35 floor props, 12 of them `flat` mid-field marks (§2.13). The doc's
    // generator counts 33 floor at this camera; this renderer's stream sampling
    // (unchanged since v1) admits 2 more candidates, so pin the measured,
    // seeded value (deterministic). The floor cap (180/lane-spread) is the
    // clutter guard.
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('desert'));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const scene = await page.evaluate(() => {
      const s = GameDebug.getScene();
      return { drawn: s.decorDrawn, flat: s.decorFlat, layers: s.decorLayers, kinds: s.decorKinds, midground: s.midground.length };
    });
    expect(scene.layers).toEqual({ background: 3, midground: 2, floor: 35 });
    expect(scene.midground).toBe(2);
    expect(scene.drawn).toBe(40);
    expect(scene.flat).toBe(12); // §2.14: 12 large flat marks roam the lane field
    // Density guard: soft sand detail dominates (>= 30 floor props); caps bounded.
    expect(scene.layers.floor).toBeGreaterThanOrEqual(30);
    expect(scene.flat).toBeGreaterThan(0);
    expect(scene.flat).toBeLessThan(scene.layers.floor);
    expect(scene.layers.background).toBeLessThanOrEqual(14);
    expect(scene.layers.midground).toBeLessThanOrEqual(10);
    expect(scene.drawn).toBeLessThanOrEqual(204); // 14 + 10 + 180 (§2.14.2)
    // Desert families only — no forest kind may leak into the desert registry.
    const FOREST_KINDS = new Set(['trees', 'grass_tufts', 'fern', 'moss', 'pine_needles', 'leaf_litter', 'mushrooms', 'stones', 'midground']);
    expect(scene.kinds.length).toBeGreaterThan(0);
    for (const k of scene.kinds) expect(FOREST_KINDS.has(k), k).toBe(false);
    // v2 tones (§2.8 / §2.12 / §2.13) rasterise in the lane band: lit grain
    // #dcb87a, dark grain + streak #a8813f, the three ramp zones
    // #c39d5a/#bd985a/#b8935a, and the DRIFT_MOUND lit crest #d8b87a (unique to
    // a flat mark, so it proves the §2.14 mid-field placement actually drew).
    const carpet = await page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      const d = g.getImageData(0, 120, 1280, 720 - 120).data;
      const tones = { speckle: 0, dark: 0, zone2: 0, zone3: 0, zone4: 0, mound: 0 };
      const map = { 0xdcb87a: 'speckle', 0xa8813f: 'dark', 0xc39d5a: 'zone2', 0xbd985a: 'zone3', 0xb8935a: 'zone4', 0xd8b87a: 'mound' };
      for (let i = 0; i < d.length; i += 4) {
        const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        const key = map[h];
        if (key) tones[key] += 1;
      }
      return tones;
    });
    expect(carpet.speckle).toBeGreaterThan(100); // lit sand grain (§2.8)
    expect(carpet.dark).toBeGreaterThan(100);    // dark grain clusters + dune streaks
    expect(carpet.zone2).toBeGreaterThan(100);   // ramp zone 2 (§2.12)
    expect(carpet.zone3).toBeGreaterThan(100);   // ramp zone 3 (§2.12)
    expect(carpet.zone4).toBeGreaterThan(100);   // ramp toe zone 4 (§2.12)
    expect(carpet.mound).toBeGreaterThan(0);     // flat DRIFT_MOUND crest (§2.13/§2.14)
  });

  test('desert ground v2: 3-tone lane ramp in every lane and dune streaks clamped to the lane', async ({ page }) => {
    // §2.12: after the base fill each lane paints 3 hard-edged ramp zones at
    // 40/60/80 % laneH, then 3 sine streak bands in ground.shade, each clamped
    // to [crest+5, laneBottom-2-(thick-1)] so it never crosses the rim (which
    // itself paints shade at crest+3..crest+4) or the bottom edge.
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('desert'));
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const res = await page.evaluate(({ BANDS }) => {
      const W = 1280, HORIZON = 120, LANE_BOTTOM = 712;
      const n = GameCore.getState().camels.length;
      const laneH = (LANE_BOTTOM - HORIZON) / n;
      const win = GameDebug.getCameraWindow();
      const span = win.max - win.min;
      const d = document.getElementById('game').getContext('2d').getImageData(0, 0, W, 720).data;
      const at = (x, y) => { const i = (y * W + x) * 4; return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; };
      const RAMP = [0xc39d5a, 0xbd985a, 0xb8935a];
      const SHADE = 0xa8813f;
      const lanes = [];
      for (let i = 0; i < n; i += 1) {
        const top = Math.round(HORIZON + i * laneH);
        const bottom = Math.round(HORIZON + (i + 1) * laneH);
        const zones = [0, 0, 0];
        let above = 0, below = 0;
        const bands = BANDS.map((b) => ({ hit: 0, cols: 0, clamped: 0 }));
        for (let x = 0; x < W; x += 1) {
          const world = win.min + ((x + 0.5) / W) * span;
          let crest = Math.max(HORIZON, top - Math.round(GameCore.terrainHeightAt(world)));
          if (crest > bottom - 2) crest = bottom - 2;
          for (let y = top; y <= bottom; y += 1) {
            const h = at(x, y);
            const zi = RAMP.indexOf(h);
            if (zi >= 0) zones[zi] += 1;
            if (h === SHADE && y < crest + 3) above += 1;
            if (h === SHADE && y > bottom - 2) below += 1;
          }
          BANDS.forEach((b, bi) => {
            const periodWorld = span / W * b.periodPx;
            const y0 = top + Math.round(b.frac * (bottom - top));
            let y = y0 + Math.round(b.amp * Math.sin(2 * Math.PI * (world / periodWorld + b.phase + i * 0.17)));
            const raw = y;
            y = Math.min(Math.max(y, crest + 5), bottom - 2 - (b.thick - 1));
            if (y !== raw) bands[bi].clamped += 1;
            bands[bi].cols += 1;
            // The streak row must actually be painted in ground.shade. Carpet
            // speckle may overwrite a few columns, so require a high hit rate.
            if (at(x, y) === SHADE) bands[bi].hit += 1;
          });
        }
        lanes.push({ i, top, bottom, zones, above, below, bands });
      }
      return lanes;
    }, { BANDS: [
      { thick: 2, amp: 7, periodPx: 360, phase: 0.00, frac: 0.30 },
      { thick: 1, amp: 5, periodPx: 260, phase: 0.33, frac: 0.55 },
      { thick: 1, amp: 8, periodPx: 400, phase: 0.66, frac: 0.80 },
    ] });
    expect(res.length).toBe(4);
    for (const lane of res) {
      // All three ramp zones are painted in EVERY lane (not just canvas-wide).
      lane.zones.forEach((count, zi) => expect(count, `lane ${lane.i} zone ${zi + 1}`).toBeGreaterThan(1000));
      expect(lane.above, `lane ${lane.i} shade above the rim band`).toBe(0);
      expect(lane.below, `lane ${lane.i} shade below the bottom rim`).toBe(0);
      lane.bands.forEach((b, bi) => {
        expect(b.hit / b.cols, `lane ${lane.i} band ${bi + 1} streak hit rate`).toBeGreaterThan(0.9);
      });
    }
  });

  test('desert v2 flat marks land inside the lane field, never on the lane edge', async ({ page }) => {
    // §2.14: `flat:true` kinds are seeded into [laneTop+8, laneBottom-6-spriteH],
    // so their rendered position must be mid-field, not lane-surface-rooted. The
    // mound's lit crest #d8b87a is unique to DRIFT_MOUND, so scanning that tone
    // bounds the real placements; the sprite rows carrying the tone are read
    // from the shipped matrix so the bounds follow the art, not magic offsets.
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('desert'));
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const html = readIndexHtml();
    const rows = extractMatrixRows(html, 'const DRIFT_MOUND =');
    const spriteH = rows.length;
    // The scan tone must be a palette tone of the mound; its sprite rows give the
    // row window any crest pixel can occupy.
    const palIdx = html.indexOf('const DRIFT_MOUND_PAL = {');
    const pal = html.slice(palIdx, html.indexOf('}', palIdx));
    const tone = [...pal.matchAll(/([A-Za-z])\s*:\s*'(#[0-9a-f]{6})'/g)].find((m) => m[2] === '#d8b87a');
    expect(tone, 'DRIFT_MOUND_PAL must map a char to the scan tone #d8b87a').not.toBeUndefined();
    const toneRows = rows.map((r, y) => (r.includes(tone[1]) ? y : -1)).filter((y) => y >= 0);
    expect(toneRows.length).toBeGreaterThan(0);
    const toneFirst = toneRows[0];
    const toneLast = toneRows[toneRows.length - 1];
    const res = await page.evaluate(() => {
      const { width: W, height: H } = GameDebug.getCanvasSize();
      const HORIZON = 120, LANE_BOTTOM = H - 8;
      const n = GameCore.getState().camels.length;
      const laneH = (LANE_BOTTOM - HORIZON) / n;
      const d = document.getElementById('game').getContext('2d').getImageData(0, 0, W, H).data;
      const lanes = [];
      for (let i = 0; i < n; i += 1) {
        lanes.push({ i, top: Math.round(HORIZON + i * laneH), bottom: Math.round(HORIZON + (i + 1) * laneH), count: 0, minRow: 1e9, maxRow: -1 });
      }
      for (let y = HORIZON; y < LANE_BOTTOM; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const k = (y * W + x) * 4;
          if (((d[k] << 16) | (d[k + 1] << 8) | d[k + 2]) !== 0xd8b87a) continue;
          const lane = lanes[Math.min(n - 1, Math.floor((y - HORIZON) / laneH))];
          lane.count += 1;
          if (y < lane.minRow) lane.minRow = y;
          if (y > lane.maxRow) lane.maxRow = y;
        }
      }
      const scene = GameDebug.getScene();
      return { lanes, flat: scene.decorFlat };
    });
    expect(res.flat).toBeGreaterThan(0); // flat kinds were placed this frame
    const placed = res.lanes.filter((l) => l.count > 0);
    expect(placed.length).toBeGreaterThan(0); // non-vacuous: at least one mound visible
    for (const lane of placed) {
      // Every visible crest pixel belongs to a mound whose anchor (sprite top
      // edge) was seeded into [laneTop+8, laneBottom-6-spriteH]; the tone spans
      // sprite rows toneFirst..toneLast, so minRow-toneFirst lower-bounds an
      // anchor and maxRow-toneLast upper-bounds one (robust to crest-top
      // occlusion). Lane-surface rooting drifts marks toward laneBottom and
      // fails; so does seeding a mark above laneTop+8.
      expect(lane.minRow - toneFirst, `lane ${lane.i} top anchor >= laneTop+8`).toBeGreaterThanOrEqual(lane.top + 8);
      expect(lane.maxRow - toneLast, `lane ${lane.i} bottom anchor <= laneBottom-6-spriteH`).toBeLessThanOrEqual(lane.bottom - 6 - spriteH);
    }
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

  test('forest floor is densely covered at default zoom (all floor-prop tones present)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('forest'));
    // Keep all camels level so the window stays at the default zoom (W=100) while
    // the world scrolls; sample the whole lane band each frame.
    const tones = { blade: 0, moss: 0, cap: 0, stone: 0, stoneShade: 0, needles: 0, leaf: 0 };
    for (const score of [0, 200, 400, 600, 800, 1000]) {
      await page.evaluate((sc) => {
        for (const c of GameCore.getState().camels) GameCore.setScore(c.id, sc);
      }, score);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const win = await page.evaluate(() => GameDebug.getCameraWindow());
      expect(win.max - win.min).toBeLessThanOrEqual(100); // default zoom
      const r = await page.evaluate(() => {
        const g = document.getElementById('game').getContext('2d');
        const d = g.getImageData(0, 120, 1280, 720 - 120).data;
        let blade = 0, moss = 0, cap = 0, stone = 0, stoneShade = 0, needles = 0, leaf = 0;
        for (let i = 0; i < d.length; i += 4) {
          const rr = d[i], gg = d[i + 1], bb = d[i + 2];
          if (rr === 0x7a && gg === 0xc2 && bb === 0x5a) blade++;        // grass/fern blade H
          else if (rr === 0x3f && gg === 0x7a && bb === 0x35) moss++;      // MOSS light
          else if (rr === 0xc0 && gg === 0x39 && bb === 0x2b) cap++;       // MUSHROOM_RED cap
          else if (rr === 0x8a && gg === 0x8a && bb === 0x92) stone++;     // STONE light (also STONE_ALT)
          else if (rr === 0x5a && gg === 0x5a && bb === 0x62) stoneShade++; // STONE shade (STONE only)
          else if (rr === 0x8a && gg === 0x5a && bb === 0x3a) needles++;   // needle / leaf body
          else if (rr === 0xb0 && gg === 0x7a && bb === 0x4a) leaf++;      // LEAF_LITTER light
        }
        return { blade, moss, cap, stone, stoneShade, needles, leaf };
      });
      tones.blade += r.blade; tones.moss += r.moss; tones.cap += r.cap;
      tones.stone += r.stone; tones.stoneShade += r.stoneShade;
      tones.needles += r.needles; tones.leaf += r.leaf;
    }
    // Every family tone is rasterised (sprite survived the lane fill).
    expect(tones.blade).toBeGreaterThan(0);   // grass/fern blade #7ac25a
    expect(tones.moss).toBeGreaterThan(0);    // moss #3f7a35
    expect(tones.cap).toBeGreaterThan(0);     // mushroom cap #c0392b
    expect(tones.stone).toBeGreaterThan(0);   // stone light #8a8a92 (STONE or STONE_ALT)
    // #5a5a62 is the STONE shade, which STONE_ALT never paints: this fires only
    // when the full STONE sprite (not merely STONE_ALT) is wired in.
    expect(tones.stoneShade).toBeGreaterThan(0);
    expect(tones.needles).toBeGreaterThan(0); // needles/leaf body #8a5a3a
    // Density: not a lone prop — the floor band is dense grass cover.
    const total = tones.blade + tones.moss + tones.cap + tones.stone + tones.needles + tones.leaf;
    expect(total).toBeGreaterThan(200);
  });

  test('floor props render in every lane at default zoom (4 lanes, W=100)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('forest'));
    // Sum floor-prop pixels per lane across several pans: boar occlusion varies with
    // the score, so a lane momentarily covered still accumulates hits. Every lane
    // must hold floor props, not only the upper ones (per-lane stream fairness).
    const totals = [0, 0, 0, 0];
    for (const score of [0, 150, 300, 450, 600, 750]) {
      await page.evaluate((sc) => {
        for (const c of GameCore.getState().camels) GameCore.setScore(c.id, sc);
      }, score);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const perLane = await page.evaluate(() => {
        const g = document.getElementById('game').getContext('2d');
        const HORIZON_Y = 120, LANE_BOTTOM = 712;
        const n = GameCore.getState().camels.length;
        const laneH = (LANE_BOTTOM - HORIZON_Y) / n;
        const out = [];
        for (let lane = 0; lane < n; lane++) {
          const top = Math.round(HORIZON_Y + lane * laneH);
          const h = Math.round(laneH);
          const d = g.getImageData(0, top, 1280, h).data;
          let props = 0;
          for (let i = 0; i < d.length; i += 4) {
            const rr = d[i], gg = d[i + 1], bb = d[i + 2];
            if ((rr === 0x7a && gg === 0xc2 && bb === 0x5a)
              || (rr === 0x3f && gg === 0x7a && bb === 0x35)
              || (rr === 0xc0 && gg === 0x39 && bb === 0x2b)
              || (rr === 0x8a && gg === 0x8a && bb === 0x92)
              || (rr === 0x5a && gg === 0x5a && bb === 0x62)
              || (rr === 0x8a && gg === 0x5a && bb === 0x3a)
              || (rr === 0xb0 && gg === 0x7a && bb === 0x4a)) props++;
          }
          out.push(props);
        }
        return out;
      });
      perLane.forEach((v, i) => { totals[i] += v; });
    }
    expect(totals.length).toBe(4);
    for (const t of totals) expect(t).toBeGreaterThan(0); // every lane shows floor props
  });

  test('forest grass carpet speckles every lane and survives the zoom-out cull', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('forest'));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const perLane = await page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      const HORIZON_Y = 120, LANE_BOTTOM = 712;
      const n = GameCore.getState().camels.length;
      const laneH = (LANE_BOTTOM - HORIZON_Y) / n;
      const out = [];
      for (let i = 0; i < n; i++) {
        const top = Math.round(HORIZON_Y + i * laneH);
        const bottom = Math.round(HORIZON_Y + (i + 1) * laneH);
        const d = g.getImageData(0, top, 1280, bottom - top).data;
        let speckle = 0;
        for (let j = 0; j < d.length; j += 4) {
          if (d[j] === 0x5a && d[j + 1] === 0x8a && d[j + 2] === 0x48) speckle++;
        }
        out.push(speckle);
      }
      return out;
    });
    expect(perLane.length).toBe(4);
    for (const c of perLane) expect(c).toBeGreaterThan(0); // carpet in every lane

    // Past DECOR_MAX_SPAN world decor is culled, but the carpet stays.
    await page.evaluate(() => {
      GameCore.setCamelCount(2);
      GameCore.setScore('camel-0', 0);
      GameCore.setScore('camel-1', 100000);
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const culled = await page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      const d = g.getImageData(0, 120, 1280, 720 - 120).data;
      let speckle = 0;
      for (let j = 0; j < d.length; j += 4) {
        if (d[j] === 0x5a && d[j + 1] === 0x8a && d[j + 2] === 0x48) speckle++;
      }
      return { decorDrawn: GameDebug.getScene().decorDrawn, speckle };
    });
    expect(culled.decorDrawn).toBe(0);
    expect(culled.speckle).toBeGreaterThan(0);
  });

  test('forest grass carpet is world-anchored (speckles scroll with the ground)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('forest'));
    // Union (across every lane) of screen x-columns carrying a carpet speckle
    // (#5a8a48), plus the camel x-columns that over-paint the carpet. A screen-space
    // pattern re-stamps the same px per k, so its camel-free columns are invariant
    // under panning; a world-anchored pattern shifts them with the ground.
    const sample = () => page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      const HORIZON_Y = 120, LANE_BOTTOM = 712;
      const n = GameCore.getState().camels.length;
      const laneH = (LANE_BOTTOM - HORIZON_Y) / n;
      const cols = new Set();
      for (let lane = 0; lane < n; lane++) {
        const top = Math.round(HORIZON_Y + lane * laneH);
        const h = Math.round(laneH);
        const d = g.getImageData(0, top, 1280, h).data;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < 1280; x++) {
            const i = (y * 1280 + x) * 4;
            if (d[i] === 0x5a && d[i + 1] === 0x8a && d[i + 2] === 0x48) cols.add(x);
          }
        }
      }
      // Boar sprites over-paint carpet pixels; their columns must be excluded from
      // the comparison or a moving boar fakes a pattern shift on its own.
      const occluded = new Set();
      for (const b of GameDebug.getCamelSpriteBounds()) {
        for (let x = Math.floor(b.left) - 1; x <= Math.ceil(b.right) + 1; x++) occluded.add(x);
      }
      return {
        cols: [...cols].sort((a, b) => a - b),
        occluded: [...occluded],
        win: GameDebug.getCameraWindow(),
      };
    });
    const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const panAll = (score) => page.evaluate((sc) => {
      for (const c of GameCore.getState().camels) GameCore.setScore(c.id, sc);
    }, score);

    await panAll(0);
    await settle();
    const before = await sample();
    // 37 is not an integer number of world cells at the default window (W=100),
    // so unchanged camel-free columns would mean the pattern is screen-space.
    await panAll(37);
    await settle();
    const after = await sample();
    expect(after.win.min).toBeGreaterThan(0); // camera actually panned
    // Compare only columns occluded by neither frame's boars, so sprite pixels
    // cannot masquerade as a pattern shift.
    const excluded = new Set([...before.occluded, ...after.occluded]);
    const freeCols = (s) => s.cols.filter((x) => !excluded.has(x));
    const beforeFree = freeCols(before);
    const afterFree = freeCols(after);
    const afterSet = new Set(afterFree);
    const overlap = beforeFree.filter((x) => afterSet.has(x)).length;
    expect(beforeFree.length).toBeGreaterThan(0); // carpet drawn before the pan
    expect(afterFree.length).toBeGreaterThan(0); // ...and after
    // A screen-space pattern re-stamps the same px, so its camel-free columns are
    // ~identical (overlap ratio ~1). A world-anchored pattern shifts the whole set
    // by ~473 screen px, leaving only a small accidental overlap.
    expect(overlap / Math.min(beforeFree.length, afterFree.length)).toBeLessThan(0.5);
  });

  test('wide-zoom floor decor spreads across the window width and every lane', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(8); GameCore.setGoal(null); GameCore.resetRace(); });
    await page.evaluate(() => GameCore.setTheme('forest'));
    // Spread the field so the window is wide (but still inside DECOR_MAX_SPAN).
    await page.evaluate(() => {
      GameCore.setScore('camel-1', 1400);
      for (let i = 2; i < 8; i++) GameCore.setScore('camel-' + i, i * 180);
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const win = await page.evaluate(() => GameDebug.getCameraWindow());
    expect(win.max - win.min).toBeGreaterThan(1000);
    expect(win.max - win.min).toBeLessThanOrEqual(1500);
    // Count floor-prop pixels (exact art RGB) per lane band AND across the window
    // width. Every floor sprite sits just above its anchor lane's surface, so it
    // cannot leak into the neighbour band; a lane-order cap starves the lower
    // lanes, and breaking at the cap left-clusters every prop into the left ~20%.
    const res = await page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      const HORIZON_Y = 120, LANE_BOTTOM = 712, W = 1280, H = 720;
      const n = GameCore.getState().camels.length;
      const laneH = (LANE_BOTTOM - HORIZON_Y) / n;
      const isProp = (rr, gg, bb) =>
        (rr === 0x7a && gg === 0xc2 && bb === 0x5a)      // grass/fern blade
        || (rr === 0x3f && gg === 0x7a && bb === 0x35)      // moss
        || (rr === 0xc0 && gg === 0x39 && bb === 0x2b)      // mushroom cap
        || (rr === 0x8a && gg === 0x8a && bb === 0x92)      // stone
        || (rr === 0x8a && gg === 0x5a && bb === 0x3a)      // needle / leaf body
        || (rr === 0xb0 && gg === 0x7a && bb === 0x4a);     // leaf litter
      const d = g.getImageData(0, 0, W, H).data;
      const perLane = new Array(n).fill(0);
      const cols = new Set();
      for (let y = HORIZON_Y; y < LANE_BOTTOM; y++) {
        const lane = Math.min(n - 1, Math.floor((y - HORIZON_Y) / laneH));
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (isProp(d[i], d[i + 1], d[i + 2])) { perLane[lane]++; cols.add(x); }
        }
      }
      const colArr = [...cols].sort((a, b) => a - b);
      return {
        perLane,
        left: colArr.filter((x) => x < W / 2).length,
        right: colArr.filter((x) => x >= W / 2).length,
        span: colArr.length ? colArr[colArr.length - 1] - colArr[0] : 0,
        decorDrawn: GameDebug.getScene().decorDrawn,
      };
    });
    expect(res.perLane.length).toBe(8);
    for (const c of res.perLane) expect(c).toBeGreaterThan(0); // every lane gets floor props
    // The cap now samples the whole window: props must reach both halves and span it.
    expect(res.left).toBeGreaterThan(0);
    expect(res.right).toBeGreaterThan(0);
    expect(res.span).toBeGreaterThan(1280 * 0.6);
    expect(res.decorDrawn).toBeLessThanOrEqual(144); // background 14 + midground 10 + floor 120
  });

  test('midground trees stand in the lanes and are occluded by the boars', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(2);
      GameCore.setGoal(null);
      GameCore.resetRace();
      GameCore.setTheme('forest');
    });
    // Both camels level => default zoom (window span 100), stationary boars
    // (target left is score-independent at level scores). A midground cell is
    // world-anchored: at a level window its screen x is (world - (score - 20))
    // * 12.8, so the cell we read re-renders exactly on the boar column (x 256)
    // once both camels sit at its world position p. One deterministic jump
    // instead of scanning ~300 scores of rAF frames (~600 rAF / ~12 s on slow
    // CI). Observe at a positive score so p is a valid non-negative score.
    await page.evaluate(() => {
      for (const c of GameCore.getState().camels) GameCore.setScore(c.id, 520);
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const pick = await page.evaluate(() => {
      const win = GameDebug.getCameraWindow();
      const span = win.max - win.min;
      let best = null;
      for (const m of GameDebug.getScene().midground) {
        const d = Math.abs(m.x - 256); // boar column at level scores
        if (!best || d < best.d) best = { d, score: Math.round(win.min + (m.x / 1280) * span) };
      }
      return best;
    });
    expect(pick).not.toBeNull();
    // Re-render at the tree's world position, then probe the same tree: canopy
    // above the boar must show, the body where the boar stands must be
    // over-painted. Both sample bands derive from the boar's bounding box.
    await page.evaluate((s) => {
      for (const c of GameCore.getState().camels) GameCore.setScore(c.id, s);
    }, pick.score);
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const r = await page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      const tone = (x, y, w, h) => {
        const d = g.getImageData(Math.round(x), Math.round(y), w, h).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if ((d[i] === 0x2f && d[i + 1] === 0x6b && d[i + 2] === 0x3a)   // TALL canopy T
            || (d[i] === 0x3a && d[i + 1] === 0x8a && d[i + 2] === 0x4a)) n++; // BROAD canopy T
        }
        return n;
      };
      const scene = GameDebug.getScene();
      const bounds = GameDebug.getCamelSpriteBounds();
      // The tree re-rendered on the boar column; its anchor y sits in the boar
      // band of its own lane, which selects the same-lane boar to probe.
      let tree = null;
      for (const m of scene.midground) {
        if (!tree || Math.abs(m.x - 256) < Math.abs(tree.x - 256)) tree = m;
      }
      const boar = bounds.find((b) => tree.y >= b.top && tree.y <= b.bottom) || bounds[0];
      const cx = (boar.left + boar.right) / 2;
      return {
        midgroundCount: scene.midground.length,
        treeX: tree.x,
        // The team-name label sits directly above the boar (pill top-20..top-4,
        // outline spanning top-21..top-4), so it overlaps the old canopy band
        // (top-26..top-7) only in rows top-20..top-7. Sample the canopy in the
        // sliver between the label bottom and the boar top (top-3..top-1), which
        // the tree still paints where the boar does not.
        above: tone(cx - 8, boar.top - 3, 17, 3),  // canopy just above the boar's head
        inside: tone(cx - 8, boar.top + 10, 17, 16), // same tree where the boar body stands
      };
    });
    expect(r.midgroundCount).toBeGreaterThan(0);
    expect(Math.abs(r.treeX - 256)).toBeLessThanOrEqual(1); // jumped onto the boar column
    expect(r.above).toBeGreaterThan(0);   // tree canopy renders above the boar
    expect(r.inside).toBe(0);             // boar over-paints the tree where it stands
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
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#theme-desert')).toHaveText('Desert');
    await page.locator('#lang-de').click();
    await expect(page.locator('#theme-desert')).toHaveText('Wüste');
    await expect(page.locator('#theme-forest')).toHaveText('Wald');
    await expect(page.locator('#themeToggle')).toHaveAttribute('aria-label', 'Thema');
    // aria-pressed must track the active theme both ways, not just the default.
    await page.locator('#theme-desert').click();
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#theme-forest').click();
    await expect(page.locator('#theme-forest')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'false');
  });

  test('switch is instant and does not reset scores', async ({ page }) => {
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="10"]').click();
    await page.locator('#theme-desert').click(); // default is forest: switch away...
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#theme-forest').click(); // ...and back to the default
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
    await page.locator('#theme-desert').click(); // real switch (default is forest)
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.theme).toBe('desert');
    expect(s.raceOver).toBe(true);
    expect(s.winnerId).toBe('camel-0');
  });

  test('selected (non-default) theme persists across reload', async ({ page }) => {
    await page.locator('#theme-desert').click();
    await expect.poll(() => page.evaluate(() => {
      const t = localStorage.getItem('camelRace.v1');
      return t ? JSON.parse(t).theme : null;
    })).toBe('desert');
    await page.reload();
    await expect(page.locator('#theme-desert')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => GameCore.getState().theme)).toBe('desert');
    await expect(page.locator('#camelCountLabel')).toHaveText('Camels');
  });
});

// The boar blanket flat area + bob are pinned by docs/art/boar-sprite.md. The
// camel blanket tests in render.spec sample the whole 92x70 sprite buffer with
// the bob baked into the frame matrices, so without these the forest anchor
// (18,18) and the separate +1 px blanket drop are untested.
test.describe('Forest boar blanket', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('blanket flat area stays solid at the boar anchor (18,18) for every lane', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.setTheme('forest'); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    // isSettled() is trivially true on a fresh page; paint the current scene first.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const res = await page.evaluate(() => {
      const g = document.getElementById('game').getContext('2d');
      return GameDebug.getCamelSpriteBounds().map((b) => {
        const d = g.getImageData(Math.round(b.left), Math.round(b.top), 60, 42).data;
        let blanket = 0, digitInk = 0;
        for (let i = 0; i < d.length; i += 4) {
          const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
          if (h === 0xbfe3ea) blanket += 1;
          else if (h === 0x123a44) digitInk += 1;
        }
        // The idle boar's whole blanket is the flat 6x10 area at the anchor.
        const p = g.getImageData(Math.round(b.left) + 18, Math.round(b.top) + 18, 6, 10).data;
        let patch = 0;
        for (let i = 0; i < p.length; i += 4) {
          if (((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]) === 0xbfe3ea) patch += 1;
        }
        return { blanket, digitInk, patch };
      });
    });
    expect(res.length).toBe(4);
    for (const lane of res) {
      expect(lane.blanket).toBe(60);  // all 60 blanket px sit in the flat area
      expect(lane.patch).toBe(60);    // ...which is solid at the documented anchor
      expect(lane.digitInk).toBe(0);  // no digit ink remains on the blanket
    }
  });

  test('blanket drops +1 px with the body on bob frames 2 and 4', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.setTheme('forest'); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      const canvas = document.getElementById('game');
      // Non-blanket pixels in the 6x10 rect at anchor row 18 (+1 row for the bob).
      function mismatch(rowOffset) {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d').getImageData(Math.round(b.left) + 18, Math.round(b.top) + 18 + rowOffset, 6, 10).data;
        let bad = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (!(d[i] === 0xbf && d[i + 1] === 0xe3 && d[i + 2] === 0xea)) bad += 1;
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
    // Contact frames (1, 3): blanket sits at anchor row 18; the +1 offset is not all blanket.
    expect(off(1)[0]).toBe(0);
    expect(off(1)[1]).toBeGreaterThan(0);
    expect(off(3)[0]).toBe(0);
    expect(off(3)[1]).toBeGreaterThan(0);
    // Bob frames (2, 4): the blanket drops 1 px to row 19; only the +1 offset is all blanket.
    expect(off(2)[1]).toBe(0);
    expect(off(2)[0]).toBeGreaterThan(0);
    expect(off(4)[1]).toBe(0);
    expect(off(4)[0]).toBeGreaterThan(0);
  });
});

// v6 boar face (docs/art/boar-sprite.md acceptance #8 + #10). Standalone: the
// forest boar renders exactly 11 tusk `T` + 3 eye-white `W` = 14 px of `#f0ece0`,
// and 2 dark `#14100b` eyes (1 boar pupil + 1 hunter eye) per sprite frame. The
// camel/mushroom/milestone art never paints `#f0ece0` or `#14100b` inside a
// boar's 60x42 lane box, so the exact per-lane counts cannot pass vacuously.
test.describe('Forest boar v6 art (enlarged tusk + white eye / dark pupil)', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  // Standing frame 0 sprite-relative cells (x = col, y = row), verbatim from the
  // doc matrices. Near canine is the enlarged 2-wide tusks; far tusk is 1x2.
  const NEAR_TUSK = [[48, 19], [47, 20], [48, 20], [47, 21], [48, 21], [47, 22], [48, 22], [47, 23], [48, 23]];
  const FAR_TUSK = [[46, 21], [46, 22]];
  const EYE_WHITE = [[44, 15], [44, 16], [45, 16]]; // sclera, 3 px
  const PUPIL = [45, 15]; // dark pupil, diagonally adjacent to the sclera

  test('all 8 lanes: #f0ece0 tusks + #f0ece0 sclera beside #14100b pupil at fixed cells', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(8); GameCore.setGoal(null); GameCore.setTheme('forest'); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const res = await page.evaluate(({ near, far, white, pupil }) => {
      const g = document.getElementById('game').getContext('2d');
      return GameDebug.getCamelSpriteBounds().map((b) => {
        const d = g.getImageData(Math.round(b.left), Math.round(b.top), 60, 42).data;
        const at = (x, y) => { const i = (y * 60 + x) * 4; return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; };
        const onCream = ([x, y]) => at(x, y) === 0xf0ece0;
        // The near canine must be genuinely 2 px wide on rows 20-22 (enlarged),
        // not a single 1 px column that would also match a smaller tusk.
        const twoWide = [20, 21, 22].every((y) => onCream([47, y]) && onCream([48, y]));
        let cream = 0, dark = 0;
        for (let i = 0; i < d.length; i += 4) {
          const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
          if (h === 0xf0ece0) cream += 1;
          else if (h === 0x14100b) dark += 1;
        }
        return {
          near: near.every(onCream),
          far: far.every(onCream),
          white: white.every(onCream),
          pupil: at(pupil[0], pupil[1]) === 0x14100b,
          twoWide,
          cream,
          dark,
        };
      });
    }, { near: NEAR_TUSK, far: FAR_TUSK, white: EYE_WHITE, pupil: PUPIL });
    expect(res.length).toBe(8);
    for (const lane of res) {
      expect(lane.near).toBe(true);   // enlarged near canine, 2-wide
      expect(lane.far).toBe(true);    // smaller far-side tusk
      expect(lane.twoWide).toBe(true);
      expect(lane.white).toBe(true);  // white sclera
      expect(lane.pupil).toBe(true);  // dark pupil beside it
      expect(lane.cream).toBe(14);    // 11 tusk + 3 sclera, and nothing else
      expect(lane.dark).toBe(2);      // boar pupil + hunter eye
    }
  });

  // Acceptance #10 says the T/W/Y cells hold in EVERY frame; the standing test
  // above only renders frame 0. Sweep the 4 walk frames (2/4 bob +1 row) using the
  // same rAF grouping as the blanket bob test.
  test('face cells hold in all 5 frames (tusk/sclera/pupil shift +1 row on bob frames 2, 4)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.setTheme('forest'); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const CELLS = {
      near: [[48, 19], [47, 20], [48, 20], [47, 21], [48, 21], [47, 22], [48, 22], [47, 23], [48, 23]],
      far: [[46, 21], [46, 22]],
      white: [[44, 15], [44, 16], [45, 16]],
      pupil: [45, 15],
    };
    const res = await page.evaluate((cells) => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      const canvas = document.getElementById('game');
      function probe(ro) {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d').getImageData(Math.round(b.left), Math.round(b.top), 60, 42).data;
        const at = (x, y) => { const i = ((y + ro) * 60 + x) * 4; return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; };
        const cellsOk = cells.near.concat(cells.far, cells.white).every(([x, y]) => at(x, y) === 0xf0ece0) ? 1 : 0;
        const pupilOk = at(cells.pupil[0], cells.pupil[1]) === 0x14100b ? 1 : 0;
        const twoWide = [20, 21, 22].every((y) => at(47, y) === 0xf0ece0 && at(48, y) === 0xf0ece0) ? 1 : 0;
        let cream = 0, dark = 0;
        for (let i = 0; i < d.length; i += 4) {
          const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
          if (h === 0xf0ece0) cream += 1; else if (h === 0x14100b) dark += 1;
        }
        return `${cellsOk},${pupilOk},${twoWide},${cream},${dark}`;
      }
      const c = GameCore.getState().camels[0];
      GameCore.setScore(c.id, c.score); // trigger the walk without moving
      const byFrame = new Map();
      function tick(now) {
        if (GameCore.getState().camels[0].animUntil > now) {
          const fi = (Math.floor(now / FRAME_MS) % 4) + 1;
          const ro = (fi === 2 || fi === 4) ? 1 : 0;
          const sig = probe(ro);
          if (!byFrame.has(fi)) byFrame.set(fi, new Map());
          const m = byFrame.get(fi);
          m.set(sig, (m.get(sig) || 0) + 1);
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
    }), CELLS);
    expect(Object.keys(res).sort()).toEqual(['1', '2', '3', '4']);
    for (const fi of ['1', '2', '3', '4']) {
      // cells ok, pupil ok, near tusk 2-wide, exactly 14 cream + 2 dark px.
      expect(res[fi], `frame ${fi}`).toBe('1,1,1,14,2');
    }
  });
});

test.describe('Titles track theme + language (registry-driven)', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('all four theme/language combinations update h1 + document.title + canvas label + count label', async ({ page }) => {
    const cases = [
      { theme: 'desert', lang: 'en', title: 'CAMEL RACE', label: 'Camel race track. Racers move left to right to the goal.', count: 'Camels' },
      { theme: 'desert', lang: 'de', title: 'KAMEL RENNEN', label: 'Kamelrennen. Rennläufer bewegen sich von links nach rechts zum Ziel.', count: 'Kamele' },
      { theme: 'forest', lang: 'en', title: 'BOAR RACE', label: 'Wild boar race track. Racers move left to right to the goal.', count: 'Wild boars' },
      { theme: 'forest', lang: 'de', title: 'WILDSCHWEIN RENNEN', label: 'Wildschweinrennen. Rennläufer bewegen sich von links nach rechts zum Ziel.', count: 'Wildschweine' },
    ];
    for (const c of cases) {
      await page.locator('#theme-' + c.theme).click();
      await page.locator('#lang-' + c.lang).click();
      await expect(page.locator('#title'), `${c.theme}/${c.lang}`).toHaveText(c.title);
      expect(await page.title(), `${c.theme}/${c.lang}`).toBe(c.title);
      await expect(page.locator('#game'), `${c.theme}/${c.lang}`).toHaveAttribute('aria-label', c.label);
      await expect(page.locator('#camelCountLabel'), `${c.theme}/${c.lang}`).toHaveText(c.count);
    }
    // Switch back to the start and confirm the title reverts (both directions).
    await page.locator('#theme-desert').click();
    await page.locator('#lang-en').click();
    await expect(page.locator('#title')).toHaveText('CAMEL RACE');
    expect(await page.title()).toBe('CAMEL RACE');
    await expect(page.locator('#game')).toHaveAttribute('aria-label',
      'Camel race track. Racers move left to right to the goal.');
    await expect(page.locator('#camelCountLabel')).toHaveText('Camels');
  });

  test('persisted forest + DE restores the title during parse (before first paint)', async ({ page }) => {
    // Capture the title/h1 as soon as the document has parsed (inline scripts
    // have run, no paint yet) to prove the restored theme is applied pre-paint.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        window.__titleAtDCL = document.title;
        window.__h1AtDCL = document.getElementById('title').textContent;
      });
    });
    await page.evaluate(() => {
      localStorage.setItem('camelRace.v1', JSON.stringify({
        version: 1, camelCount: 2, camels: [{ name: 'A', score: 0 }, { name: 'B', score: 0 }],
        goalScore: 200, infinite: false, language: 'de', theme: 'forest', raceOver: false, winnerId: null,
      }));
    });
    await page.reload();
    expect(await page.evaluate(() => window.__titleAtDCL)).toBe('WILDSCHWEIN RENNEN');
    expect(await page.evaluate(() => window.__h1AtDCL)).toBe('WILDSCHWEIN RENNEN');
    await expect(page.locator('#title')).toHaveText('WILDSCHWEIN RENNEN');
    expect(await page.title()).toBe('WILDSCHWEIN RENNEN');
    await expect(page.locator('#camelCountLabel')).toHaveText('Wildschweine');
    await expect(page.locator('#game')).toHaveAttribute('aria-label',
      'Wildschweinrennen. Rennläufer bewegen sich von links nach rechts zum Ziel.');
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
