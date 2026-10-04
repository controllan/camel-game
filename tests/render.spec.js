const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { gotoGame } = require('./helpers');

// Rider robe colour for lane index i = GameCore.PALETTE[i % 8] (see index.html).
const LANE_ROBE = [
  '#e84a3a', '#3a6ae8', '#3aa84a', '#e8c83a',
  '#9a4ae8', '#e88a3a', '#3ad8d8', '#e85a9a',
];

// Count every distinct RGB color on the canvas. Used to prove that real art
// (camel palette colors, sky/sun/dune/decor colors) is actually rasterised,
// not merely that the canvas exists or that lane fills are non-black.
async function pixelTally(page) {
  return page.evaluate(() => {
    const g = document.getElementById('game').getContext('2d');
    const d = g.getImageData(0, 0, 1280, 720).data;
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

  test('canvas buffer is 1280x720', async ({ page }) => {
    const size = await page.evaluate(() => GameDebug.getCanvasSize());
    expect(size).toEqual({ width: 1280, height: 720 });
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
      expect(b.right).toBeLessThanOrEqual(1280);
      expect(b.right - b.left).toBeCloseTo(66, 9);
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
      expect(b.right).toBeLessThanOrEqual(1280);
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
          expect(b.right).toBeLessThanOrEqual(1280);
        }

        await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
        const after = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
        for (const b of after) {
          expect(b.left).toBeGreaterThanOrEqual(0);
          expect(b.right).toBeLessThanOrEqual(1280);
          expect(b.right - b.left).toBeCloseTo(66, 9);
          expect(b.top).toBeGreaterThanOrEqual(0);
          expect(b.bottom).toBeLessThanOrEqual(720);
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

  test('camels rasterise fixed body/shade plus per-lane robe and blanket colours', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const tally = await pixelTally(page);
    // Body and shade are fixed brown tones shared by every camel (only the robe
    // is palette-swapped); the saddle blanket is a fixed light blue with a dark
    // digit drawn by code. v5 idle bodies paint 690 fill px per camel, so 4 idle
    // camels paint 2760 body px.
    expect(tally['#c9803a'] || 0).toBeGreaterThanOrEqual(4 * 650); // body across 4 camels
    expect(tally['#8a5220'] || 0).toBeGreaterThan(0);   // fixed shade
    expect(tally['#bfe3ea'] || 0).toBeGreaterThan(0);   // saddle blanket
    expect(tally['#123a44'] || 0).toBeGreaterThan(0);   // blanket digit ink
    expect(tally[LANE_ROBE[0]] || 0).toBeGreaterThan(0); // lane 0 robe
    expect(tally[LANE_ROBE[1]] || 0).toBeGreaterThan(0); // lane 1 robe
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
    // After a few real frames the sprite must still be far from its ~605px
    // target and not yet reported settled — i.e. it interpolated, not snapped.
    expect(r.settled).toBe(false);
    expect(r.left).toBeLessThan(400);
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const endLeft = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[1].left);
    expect(endLeft).toBeGreaterThan(500);
  });

  test('score glide eases over ~900ms and converges exactly to the target', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(null);
      GameCore.resetRace();
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const r = await page.evaluate(() => new Promise((resolve) => {
      const t0 = performance.now();
      GameCore.setScore('camel-1', 5000);
      let firstLeft = null;
      function tick() {
        const b = GameDebug.getCamelSpriteBounds()[1].left;
        if (firstLeft === null) firstLeft = b;
        if (GameDebug.isSettled()) {
          resolve({ elapsed: performance.now() - t0, firstLeft, endLeft: b });
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));
    // Unhurried Volksfest amble: not a snap (old 300ms constant settled in a
    // few frames) yet still converges well under the poll budget.
    expect(r.elapsed).toBeGreaterThan(600);
    expect(r.elapsed).toBeLessThan(2000);
    expect(r.firstLeft).toBeLessThan(400); // moved gradually from the start
    expect(r.endLeft).toBeGreaterThan(500); // converged near the right edge
  });

  test('walk animation shows distinct frames while moving, stops after ANIM_MS', async ({ page }) => {
    await page.evaluate(() => {
      GameCore.setCamelCount(4);
      GameCore.setGoal(null);
      GameCore.resetRace();
    });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    // Ensure the scene is painted before capturing the idle reference pose
    // (isSettled() is trivially true while visualLeft is still null).
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // walk gait frame length (index.html ANIM_FRAME_MS)
      const canvas = document.getElementById('game');
      const snap = () => {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const x = Math.max(0, Math.round(b.left) - 1);
        const y = Math.max(0, Math.round(b.top));
        return canvas.getContext('2d').getImageData(x, y, 66, 62).data.join(',');
      };
      const standing = snap();
      const camel = GameCore.getState().camels[0];
      // Same score => sprite stays put but a 1400ms walk anim is triggered.
      GameCore.setScore(camel.id, camel.score);
      const walk = new Set();
      // Bucket every sample by the walk-frame index the renderer derives from
      // the rAF clock (floor(now / 320ms) % 4 + 1). The modal snapshot per
      // bucket is that frame's pose, letting us compare frames 2 and 4 directly.
      const byFrame = new Map(); // frameIndex -> Map(snapshot -> count)
      let settledFrames = 0;
      function tick(now) {
        const animating = GameCore.getState().camels[0].animUntil > now;
        const k = snap();
        if (animating) {
          if (k !== standing) walk.add(k);
          const fi = (Math.floor(now / FRAME_MS) % 4) + 1;
          let counts = byFrame.get(fi);
          if (!counts) { counts = new Map(); byFrame.set(fi, counts); }
          counts.set(k, (counts.get(k) || 0) + 1);
          requestAnimationFrame(tick);
          return;
        }
        settledFrames += 1;
        if (settledFrames < 2) { requestAnimationFrame(tick); return; }
        const modal = {};
        for (const [fi, counts] of byFrame) {
          let best = null, bestN = -1;
          for (const [s, n] of counts) if (n > bestN) { bestN = n; best = s; }
          modal[fi] = best;
        }
        resolve({ distinctWalkFrames: walk.size, modal, after: k, standing });
      }
      requestAnimationFrame(tick);
    }));
    // Four gait poses this cycle: contact A, pass A, contact B, pass B.
    expect(res.distinctWalkFrames).toBe(4);
    // Each of the four walk frames genuinely renders (sampled over the cycle).
    expect(Object.keys(res.modal).sort()).toEqual(['1', '2', '3', '4']);
    // The two pass poses (frames 2 and 4) must differ — the corrected frame 4
    // is a mirrored pass, not a byte-identical copy of frame 2.
    expect(res.modal[2]).not.toBe(res.modal[4]);
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
        return canvas.getContext('2d').getImageData(x, y, 66, 62).data.join(',');
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
      () => document.getElementById('game').getContext('2d').getImageData(0, 0, 1280, 120).data.join(','),
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
        const d = document.getElementById('game').getContext('2d').getImageData(0, 0, 1280, 720).data;
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
      const d = document.getElementById('game').getContext('2d').getImageData(0, 0, 1280, 120).data;
      const cols = [];
      for (let x = 0; x < 1280; x += 1) {
        let hit = false;
        for (let y = 0; y < 120 && !hit; y += 1) {
          const i = (y * 1280 + x) * 4;
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
      const d = document.getElementById('game').getContext('2d').getImageData(0, 0, 1280, 720).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n += 1;
      return n;
    });
    expect(painted).toBe(1280 * 720);

    // Within the decor range the counter is live and still bounded.
    await page.evaluate(() => { GameCore.setScore('camel-1', 1000); });
    await expect.poll(
      () => page.evaluate(() => GameDebug.getScene().decorDrawn),
      { timeout: 5000 },
    ).toBeGreaterThan(0);
    const bounded = await page.evaluate(() => GameDebug.getScene().decorDrawn);
    expect(bounded).toBeLessThanOrEqual(24);
  });

  test('66x62 sprite rasterises blanket, digit ink, body and outline', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const b = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0]);
    expect(b.right - b.left).toBeCloseTo(66, 9); // SPRITE_W buffer
    expect(b.bottom - b.top).toBeCloseTo(62, 9); // SPRITE_H buffer
    const seen = await page.evaluate(({ left, top }) => {
      const d = document.getElementById('game').getContext('2d')
        .getImageData(Math.round(left), Math.round(top), 66, 62).data;
      const want = { body: 0xc9803a, blanket: 0xbfe3ea, digit: 0x123a44, outline: 0x1a1208, shade: 0x8a5220, harness: 0x53565e };
      const got = { body: 0, blanket: 0, digit: 0, outline: 0, shade: 0, harness: 0 };
      // Every camel tone (the lane-0 palette) so the real drawn bbox can be
      // measured inside the 66x62 buffer; the v5 camel is slimmer than its frame.
      const camel = new Set([0x1a1208, 0xc9803a, 0x8a5220, 0x53565e, 0xe84a3a,
        0xf0ece0, 0xd8a878, 0xbfe3ea, 0x123a44]);
      let minC = 66, maxC = -1, minR = 62, maxR = -1;
      for (let ry = 0; ry < 62; ry += 1) {
        for (let rx = 0; rx < 66; rx += 1) {
          const i = (ry * 66 + rx) * 4;
          const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
          for (const k in want) if (h === want[k]) got[k] += 1;
          if (camel.has(h)) {
            if (rx < minC) minC = rx;
            if (rx > maxC) maxC = rx;
            if (ry < minR) minR = ry;
            if (ry > maxR) maxR = ry;
          }
        }
      }
      return { got, bbox: { w: maxC - minC + 1, h: maxR - minR + 1, minC, maxC, minR, maxR } };
    }, { left: b.left, top: b.top });
    expect(seen.got.body).toBeGreaterThan(0);
    expect(seen.got.blanket).toBeGreaterThan(0);
    expect(seen.got.digit).toBeGreaterThan(0);
    expect(seen.got.outline).toBeGreaterThan(0);
    expect(seen.got.shade).toBeGreaterThan(0);
    expect(seen.got.harness).toBeGreaterThan(0);
    // Real drawn bbox of the idle v5 camel inside the 66x62 frame. The art doc
    // records painted bboxes 62-63 x 58-59, so assert that range instead of an
    // exact pixel size: a benign art tweak must not read as a regression.
    expect(seen.bbox.w).toBeGreaterThanOrEqual(62);
    expect(seen.bbox.w).toBeLessThanOrEqual(66);
    expect(seen.bbox.h).toBeGreaterThanOrEqual(58);
    expect(seen.bbox.h).toBeLessThanOrEqual(62);
    // It must still fit inside the 66x62 frame, with feet on the bottom row.
    expect(seen.bbox.minC).toBeGreaterThanOrEqual(0);
    expect(seen.bbox.maxC).toBeLessThanOrEqual(65);
    expect(seen.bbox.minR).toBeGreaterThanOrEqual(0);
    expect(seen.bbox.maxR).toBe(61);
    // Standing feet (sprite row 61): flat outline hooves only, no body/shade
    // below the hoof line (the v5 camel stands on the buffer's bottom row).
    const idle = await page.evaluate(({ left, top }) => {
      const d = document.getElementById('game').getContext('2d')
        .getImageData(Math.round(left), Math.round(top), 66, 62).data;
      const row = (r) => {
        let outline = 0, body = 0;
        for (let rx = 0; rx < 66; rx += 1) {
          const i = (r * 66 + rx) * 4;
          const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
          if (h === 0x1a1208) outline += 1;
          else if (h === 0xc9803a || h === 0x8a5220) body += 1;
        }
        return { outline, body };
      };
      return { feet: row(61) };
    }, { left: b.left, top: b.top });
    expect(idle.feet.outline).toBe(24); // four flat hooves on the bottom row
    expect(idle.feet.body).toBe(0); // no camel tone below the hoof line
  });

  test('blanket digit is the 6x10 glyph for every lane number', async ({ page }) => {
    // Full 6x10 font derived from the 3x5 index.html DIGIT_FONT (each glyph is
    // the exact 2x nearest-neighbour upscale); a wrong/blank glyph in any lane
    // shows up as a non-zero mismatch.
    const SRC = {
      '1': ['.#.', '##.', '.#.', '.#.', '###'],
      '2': ['###', '..#', '###', '#..', '###'],
      '3': ['###', '..#', '###', '..#', '###'],
      '4': ['#.#', '#.#', '###', '..#', '..#'],
      '5': ['###', '#..', '###', '..#', '###'],
      '6': ['###', '#..', '###', '#.#', '###'],
      '7': ['..#', '..#', '..#', '..#', '..#'],
      '8': ['###', '#.#', '###', '#.#', '###'],
    };
    const up = (row) => row[0] + row[0] + row[1] + row[1] + row[2] + row[2];
    const GLYPHS = {};
    for (const n in SRC) {
      const out = [];
      for (const row of SRC[n]) { const u = up(row); out.push(u, u); }
      GLYPHS[n] = out;
    }
    for (const count of [2, 8]) {
      await page.evaluate((n) => { GameCore.setCamelCount(n); GameCore.setGoal(null); GameCore.resetRace(); }, count);
      await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
      // isSettled() is trivially true while visualLeft is still null on a fresh
      // page, so the canvas can still hold the pre-reset layout's pixels. Let the
      // game loop paint the current scene before sampling it.
      await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));
      const res = await page.evaluate(({ glyph }) => {
        const bounds = GameDebug.getCamelSpriteBounds();
        const g = document.getElementById('game').getContext('2d');
        function mismatches(lane, want) {
          const b = bounds[lane];
          const d = g.getImageData(Math.round(b.left) + 24, Math.round(b.top) + 36, 6, 10).data;
          let bad = 0;
          for (let ry = 0; ry < 10; ry += 1) {
            for (let rx = 0; rx < 6; rx += 1) {
              const i = (ry * 6 + rx) * 4;
              const ink = d[i] === 0x12 && d[i + 1] === 0x3a && d[i + 2] === 0x44;
              if (ink !== (want[ry][rx] === '#')) bad += 1;
            }
          }
          return bad;
        }
        return bounds.map((_, lane) => mismatches(lane, glyph[String(lane + 1)]));
      }, { glyph: GLYPHS });
      expect(res).toEqual(Array(count).fill(0));
    }
  });

  test('blanket digit tracks the 2px body bob on the pass frames (2 and 4)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    // Paint the settled scene before the walk so the sample buffer is current.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      // Lane-0 digit 1 as the 6x10 glyph (2x upscale of the 3x5 source).
      const GLYPH = ['..##..', '..##..', '####..', '####..', '..##..', '..##..', '..##..', '..##..', '######', '######'];
      const canvas = document.getElementById('game');
      // Mismatch of the drawn 6x10 glyph against the lane-0 digit at row offset 0 or 2.
      function mismatch(rowOffset) {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d')
          .getImageData(Math.round(b.left) + 24, Math.round(b.top) + 36 + rowOffset, 6, 10).data;
        let bad = 0;
        for (let ry = 0; ry < 10; ry += 1) {
          for (let rx = 0; rx < 6; rx += 1) {
            const i = (ry * 6 + rx) * 4;
            const ink = d[i] === 0x12 && d[i + 1] === 0x3a && d[i + 2] === 0x44;
            if (ink !== (GLYPH[ry][rx] === '#')) bad += 1;
          }
        }
        return bad;
      }
      const camel = GameCore.getState().camels[0];
      GameCore.setScore(camel.id, camel.score); // trigger the walk without moving
      const byFrame = new Map(); // walk frame index -> Map('off0/off1' -> count)
      function tick(now) {
        if (GameCore.getState().camels[0].animUntil > now) {
          const fi = (Math.floor(now / FRAME_MS) % 4) + 1;
          const k = mismatch(0) + '/' + mismatch(2);
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
    // Contact frames (1, 3): digit stays at anchor row 36; the +2 offset must NOT match.
    expect(off(1)[0]).toBe(0);
    expect(off(1)[1]).toBeGreaterThan(0);
    expect(off(3)[0]).toBe(0);
    expect(off(3)[1]).toBeGreaterThan(0);
    // Bob frames (2, 4): digit drops 2 px to row 38; only the +2 offset matches.
    expect(off(2)[1]).toBe(0);
    expect(off(2)[0]).toBeGreaterThan(0);
    expect(off(4)[1]).toBe(0);
    expect(off(4)[0]).toBeGreaterThan(0);
  });

  test('rider robe takes each lane palette colour (8 camels)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(8); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    // Count every lane-palette robe pixel inside the sprite's 66x62 buffer: the
    // per-lane robe is the only thing that differs, so each lane must paint its
    // own colour and none of the other lanes' colours.
    const res = await page.evaluate(({ palette }) => {
      const bounds = GameDebug.getCamelSpriteBounds();
      const g = document.getElementById('game').getContext('2d');
      const rgb = palette.map((h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16)));
      return bounds.map((b, lane) => {
        const d = g.getImageData(Math.round(b.left), Math.round(b.top), 66, 62).data;
        const counts = palette.map(() => 0);
        for (let i = 0; i < d.length; i += 4) {
          for (let p = 0; p < rgb.length; p += 1) {
            if (d[i] === rgb[p][0] && d[i + 1] === rgb[p][1] && d[i + 2] === rgb[p][2]) counts[p] += 1;
          }
        }
        const own = counts[lane];
        const others = counts.reduce((a, v, p) => a + (p === lane ? 0 : v), 0);
        return { own, others };
      });
    }, { palette: LANE_ROBE });
    expect(res.length).toBe(8);
    for (const r of res) {
      expect(r.own).toBeGreaterThan(0); // this lane's robe colour is drawn
      expect(r.others).toBe(0); // ...and no other lane's robe colour leaks in
    }
  });

  test('dune lane tokens rasterise (top, shade, edge, rim)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const tally = await pixelTally(page);
    for (const c of ['#c9a25a', '#a8813f', '#6e4f2a', '#523a1e']) {
      expect(tally[c] || 0).toBeGreaterThan(0);
    }
  });

  test('camel y follows the terrain and stays inside its lane (2 and 8 camels)', async ({ page }) => {
    for (const count of [2, 8]) {
      await page.evaluate((n) => { GameCore.setCamelCount(n); GameCore.setGoal(null); GameCore.resetRace(); }, count);
      await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
      // h(0) rounds to +1, h(80) rounds to -1: the camel sits 2px lower at 80.
      const at0 = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].top);
      await page.evaluate(() => { GameCore.setScore('camel-0', 80); });
      await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
      const at80 = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].top);
      expect(at80 - at0).toBe(2); // 2px lower at the trough (h rounds +1 -> -1)
      await page.evaluate(() => { GameCore.setScore('camel-0', 0); });
      await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);

      const size = await page.evaluate(() => GameDebug.getCanvasSize());
      const laneH = (size.height - 8 - 120) / count;
      const bounds = await page.evaluate(() => GameDebug.getCamelSpriteBounds());
      bounds.forEach((b, i) => {
        expect(b.top).toBeGreaterThanOrEqual(Math.round(120 + i * laneH));
        expect(b.bottom).toBeLessThanOrEqual(Math.round(120 + (i + 1) * laneH));
        expect(b.right - b.left).toBeCloseTo(66, 9);
        expect(b.bottom - b.top).toBeCloseTo(62, 9);
      });
    }
  });

  test('rendered dune crest is continuous across the whole track', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const res = await page.evaluate(() => {
      const W = 1280, Y0 = 120, H = 8;
      const d = document.getElementById('game').getContext('2d').getImageData(0, Y0, W, H).data;
      // The topmost dune-rim pixel per column is lane 0's crest line.
      const crest = [];
      for (let x = 0; x < W; x += 1) {
        let top = -1;
        for (let ry = 0; ry < H && top < 0; ry += 1) {
          const i = (ry * W + x) * 4;
          if (d[i] === 0x52 && d[i + 1] === 0x3a && d[i + 2] === 0x1e) top = Y0 + ry;
        }
        crest.push(top);
      }
      let maxStep = 0, holes = 0;
      for (let x = 0; x < W; x += 1) {
        if (crest[x] < 0) holes += 1;
        if (x > 0 && crest[x] >= 0 && crest[x - 1] >= 0) {
          maxStep = Math.max(maxStep, Math.abs(crest[x] - crest[x - 1]));
        }
      }
      return { maxStep, holes, first: crest[0] };
    });
    expect(res.holes).toBe(0);       // every column has its dune crest
    expect(res.maxStep).toBeLessThanOrEqual(1); // continuous, no jumps
  });

  test('decor, milestone and finish sprites are authored at the 2x art dimensions', () => {
    // Art-budget contract from the geometry spec: every listed sprite is 2x the
    // old 640x360 art. Pulled from index.html so a silent revert to 1x fails.
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
    const rowsFor = (decl) => {
      const idx = html.indexOf(decl);
      expect(idx).toBeGreaterThan(-1);
      const start = html.indexOf('[', idx);
      let depth = 0, i = start, inStr = false;
      for (; i < html.length; i += 1) {
        const ch = html[i];
        if (ch === "'") inStr = !inStr;
        if (inStr) continue;
        if (ch === '[') depth += 1;
        else if (ch === ']') { depth -= 1; if (depth === 0) { i += 1; break; } }
      }
      return [...html.slice(start, i).matchAll(/'([^']*)'/g)].map((m) => m[1]);
    };
    const dim = (decl) => {
      const r = rowsFor(decl);
      return { w: Math.max(...r.map((x) => x.length)), h: r.length };
    };
    expect(dim('const PALM =')).toEqual({ w: 32, h: 40 });
    expect(dim('const CACTUS =')).toEqual({ w: 24, h: 32 });
    expect(dim('const ROCK =')).toEqual({ w: 24, h: 16 });
    expect(dim('const MILESTONE =')).toEqual({ w: 20, h: 28 });
    expect(dim('const FINISH_FLAG =')).toEqual({ w: 24, h: 28 });
  });

  test('lane fit: feet land on the terrain surface with the lane clamp inert (2 and 8 lanes)', async ({ page }) => {
    // Spec fit proof: at 8 lanes (laneHeight 74, sprite 62) the clamp must never
    // activate, so sprite top == laneBottom - FEET_OFFSET - terrain - SPRITE_H.
    const HORIZON_Y = 120, LANE_BOTTOM = 712, FEET_OFFSET = 2, SPRITE_H = 62;
    for (const count of [2, 8]) {
      await page.evaluate((n) => { GameCore.setCamelCount(n); GameCore.setGoal(null); GameCore.resetRace(); }, count);
      await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
      const res = await page.evaluate(({ HORIZON_Y, LANE_BOTTOM, FEET_OFFSET, SPRITE_H }) => {
        const n = GameCore.getState().camels.length;
        const laneH = (LANE_BOTTOM - HORIZON_Y) / n;
        const out = [];
        for (const score of [0, 40, 80, 120, 200, 333]) {
          GameCore.setScore('camel-0', score);
          const b = GameDebug.getCamelSpriteBounds()[0];
          const h = Math.round(GameCore.terrainHeightAt(score));
          const laneBottom = HORIZON_Y + laneH; // lane 0
          out.push({
            top: b.top,
            bottom: b.bottom,
            expectedTop: Math.round(laneBottom - FEET_OFFSET - h - SPRITE_H),
            min: HORIZON_Y,
            max: Math.round(laneBottom - SPRITE_H),
          });
        }
        return { laneH, out };
      }, { HORIZON_Y, LANE_BOTTOM, FEET_OFFSET, SPRITE_H });
      expect(res.laneH).toBeCloseTo((LANE_BOTTOM - HORIZON_Y) / count, 9);
      for (const p of res.out) {
        expect(p.top).toBe(p.expectedTop); // clamp inert: exact surface placement
        expect(p.top).toBeGreaterThanOrEqual(p.min);
        expect(p.top).toBeLessThanOrEqual(p.max);
        expect(p.bottom).toBe(p.top + SPRITE_H);
      }
    }
  });

  test('every walk frame keeps the sprite inside 66x62 with feet on the bottom row', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      const canvas = document.getElementById('game');
      const tones = new Set([0x1a1208, 0xc9803a, 0x8a5220, 0x53565e, 0xe84a3a,
        0x3a6ae8, 0x3aa84a, 0xe8c83a, 0x9a4ae8, 0xe88a3a, 0x3ad8d8, 0xe85a9a,
        0xf0ece0, 0xd8a878, 0xbfe3ea, 0x123a44]);
      function measure() {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d')
          .getImageData(Math.round(b.left), Math.round(b.top), 66, 62).data;
        let minR = 62, maxR = -1, minC = 66, maxC = -1;
        for (let ry = 0; ry < 62; ry += 1) {
          for (let rx = 0; rx < 66; rx += 1) {
            const i = (ry * 66 + rx) * 4;
            const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
            if (tones.has(h)) {
              if (ry < minR) minR = ry;
              if (ry > maxR) maxR = ry;
              if (rx < minC) minC = rx;
              if (rx > maxC) maxC = rx;
            }
          }
        }
        return maxR + '|' + minR + '|' + minC + '|' + maxC;
      }
      const camel = GameCore.getState().camels[0];
      GameCore.setScore(camel.id, camel.score); // trigger a walk without moving
      const byFrame = new Map(); // frame index -> Map(measure -> count)
      function tick(now) {
        if (GameCore.getState().camels[0].animUntil > now) {
          const fi = (Math.floor(now / FRAME_MS) % 4) + 1;
          if (!byFrame.has(fi)) byFrame.set(fi, new Map());
          const m = byFrame.get(fi);
          const k = measure();
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
    for (const fi of ['1', '2', '3', '4']) {
      const [maxR, minR, minC, maxC] = res[fi].split('|').map(Number);
      expect(maxR, `frame ${fi} feet`).toBe(61); // feet on the sprite's bottom row
      expect(minR).toBeGreaterThanOrEqual(0);
      expect(minR).toBeLessThanOrEqual(maxR);
      expect(minC).toBeGreaterThanOrEqual(0);
      expect(maxC).toBeLessThanOrEqual(65);
      expect(maxR - minR + 1).toBeLessThanOrEqual(62);
    }
  });
});
