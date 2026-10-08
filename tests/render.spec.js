const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { gotoGame, readIndexHtml, extractMatrixRows } = require('./helpers');

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

// Extract `const NAME = ...;` from index.html with string-aware depth counting
// (object literals, arrays and arrow-fn palettes all end at a depth-0 `;`).
function extractConst(html, name) {
  const idx = html.indexOf('const ' + name + ' = ');
  expect(idx, 'const ' + name).toBeGreaterThan(-1);
  let depth = 0, inStr = false, quote = '';
  for (let i = idx; i < html.length; i += 1) {
    const ch = html[i];
    if (inStr) { if (ch === quote) inStr = false; continue; }
    if (ch === "'" || ch === '"') { inStr = true; quote = ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    else if (ch === ';' && depth === 0) return html.slice(idx, i + 1);
  }
  throw new Error('unterminated const ' + name);
}

// Extract `function NAME(...) {...}` by brace matching from the opening `{`.
function extractFunction(html, name) {
  const idx = html.indexOf('function ' + name + '(');
  expect(idx, 'function ' + name).toBeGreaterThan(-1);
  const start = html.indexOf('{', idx);
  let depth = 0, i = start, inStr = false, quote = '';
  for (; i < html.length; i += 1) {
    const ch = html[i];
    if (inStr) { if (ch === quote) inStr = false; continue; }
    if (ch === "'" || ch === '"') { inStr = true; quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
  }
  return html.slice(idx, i);
}

test.describe('Renderer camera and bounds', () => {
  // Almost every assertion here samples desert art (camel 92x70, dune/sun/sky
  // tones, robe palette). The app now defaults to forest, so pin desert explicitly.
  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
    await page.evaluate(() => GameCore.setTheme('desert'));
  });

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
      expect(b.right - b.left).toBeCloseTo(92, 9);
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
          expect(b.right - b.left).toBeCloseTo(92, 9);
          expect(b.top).toBeGreaterThanOrEqual(0);
          expect(b.bottom).toBeLessThanOrEqual(720);
        }
      });
    }
  }

  test('scene draws sky, sun, dunes and decor (expected colors present)', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    // isSettled() is trivially true before the first frame; let the loop paint the
    // desert scene before sampling so the tally cannot read a stale/empty canvas.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
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
    // Body and shade are fixed warm-sand tones shared by every camel (only the
    // robe is palette-swapped); the saddle blanket is a fixed light blue with no
    // per-lane digit on it any more. The v6 idle frame paints 204 body px and
    // 276 blanket px per camel, so 4 idle camels paint 816 body px.
    expect(tally['#d9a05b'] || 0).toBeGreaterThanOrEqual(4 * 200); // body across 4 camels
    expect(tally['#b4763a'] || 0).toBeGreaterThan(0);   // fixed shade
    expect(tally['#82521f'] || 0).toBeGreaterThan(0);   // v6 deep shade
    expect(tally['#bfe3ea'] || 0).toBeGreaterThan(0);   // saddle blanket
    expect(tally['#123a44'] || 0).toBe(0);             // blanket digit ink removed canvas-wide
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
        return canvas.getContext('2d').getImageData(x, y, 92, 70).data.join(',');
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
        return canvas.getContext('2d').getImageData(x, y, 92, 70).data.join(',');
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
    // isSettled() tracks camel positions, not the sky: wait for a completed
    // paint after the theme has been applied before sampling the top band.
    const settleAndPaint = async () => {
      await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    };
    await settleAndPaint();
    const first = await decorRegion();
    await gotoGame(page);
    // Reload restores the persisted desert theme, but only if the debounced save
    // already flushed; pin it again so the comparison is theme-stable either way.
    await page.evaluate(() => GameCore.setTheme('desert'));
    await settleAndPaint();
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
    // Desert v2 runs the per-layer streams with floor spacing 12 / cap 180
    // (docs/art/theme-art.md §2.14), so within DECOR_MAX_SPAN the window can
    // hold at most background 14 + midground 10 + floor 180 = 204 candidates.
    // A live counter above 0 but bounded here proves the caps hold while the
    // cull keeps the frame cheap.
    expect(bounded).toBeLessThanOrEqual(204);
  });

  test('92x70 camel sprite rasterises blanket, body, shade and outline', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const b = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0]);
    expect(b.right - b.left).toBeCloseTo(92, 9); // SPRITE_W buffer
    expect(b.bottom - b.top).toBeCloseTo(70, 9); // SPRITE_H buffer
    const seen = await page.evaluate(({ left, top }) => {
      const d = document.getElementById('game').getContext('2d')
        .getImageData(Math.round(left), Math.round(top), 92, 70).data;
      const want = { body: 0xd9a05b, blanket: 0xbfe3ea, outline: 0x1c1208, shade: 0xb4763a, deep: 0x82521f, harness: 0x53565e };
      const got = { body: 0, blanket: 0, outline: 0, shade: 0, deep: 0, harness: 0 };
      // Every camel tone (the lane-0 v6 palette) so the real drawn bbox can be
      // measured inside the 92x70 buffer.
      const camel = new Set([0x1c1208, 0xd9a05b, 0xb4763a, 0x82521f, 0x53565e, 0xe84a3a,
        0xf0ece0, 0xd8a878, 0xbfe3ea]);
      let minC = 92, maxC = -1, minR = 70, maxR = -1;
      for (let ry = 0; ry < 70; ry += 1) {
        for (let rx = 0; rx < 92; rx += 1) {
          const i = (ry * 92 + rx) * 4;
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
    // Art-count bands, not exact pins (a benign 1 px art tweak must not trip the
    // suite); the doc's v6 counts are 204 body / 276 blanket px, so a missing or
    // double-drawn sprite (0 / ~2x) still fails.
    expect(seen.got.body).toBeGreaterThan(170);
    expect(seen.got.body).toBeLessThan(240);
    expect(seen.got.blanket).toBeGreaterThan(230);
    expect(seen.got.blanket).toBeLessThan(320);
    expect(seen.got.outline).toBeGreaterThan(0);
    expect(seen.got.shade).toBeGreaterThan(0);
    expect(seen.got.deep).toBeGreaterThan(0);  // v6 deep shade token
    expect(seen.got.harness).toBeGreaterThan(0);
    // The blanket is one hole-free patch with no digit area: no #123a44 ink in
    // the whole buffer (docs/art/camel-drafts-v3.md, digit-area convention retired).
    const digitInk = await page.evaluate(({ left, top }) => {
      const d = document.getElementById('game').getContext('2d')
        .getImageData(Math.round(left), Math.round(top), 92, 70).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) === 0x123a44) n += 1;
      }
      return n;
    }, { left: b.left, top: b.top });
    expect(digitInk).toBe(0);
    // Real drawn bbox of the idle v6 camel inside the 92x70 frame. Draft A's
    // painted bbox is exactly 84x68 (cols 7-90, rows 2-69).
    expect(seen.bbox.w).toBe(84);
    expect(seen.bbox.h).toBe(68);
    expect(seen.bbox.minC).toBe(7);
    expect(seen.bbox.maxC).toBe(90);
    expect(seen.bbox.minR).toBe(2);
    expect(seen.bbox.maxR).toBe(69);
    // Standing feet (sprite row 69): four 5 px hooves, each OOSOO, so 16 outline
    // px + 4 shade px of hoof detail; nothing of the leg/body above them.
    const idle = await page.evaluate(({ left, top }) => {
      const d = document.getElementById('game').getContext('2d')
        .getImageData(Math.round(left), Math.round(top), 92, 70).data;
      const row = (r) => {
        const got = { outline: 0, shade: 0, body: 0 };
        for (let rx = 0; rx < 92; rx += 1) {
          const i = (r * 92 + rx) * 4;
          const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
          if (h === 0x1c1208) got.outline += 1;
          else if (h === 0xb4763a) got.shade += 1;
          else if (h === 0xd9a05b || h === 0x82521f) got.body += 1;
        }
        return got;
      };
      return { feet: row(69) };
    }, { left: b.left, top: b.top });
    // Bands around the four OOSOO hooves (~16 outline + 4 shade px): a benign
    // hoof retouch passes, a collapsed hoof row (0 / two hooves) fails. body is
    // behaviour: nothing may paint below the hoof line.
    expect(idle.feet.outline).toBeGreaterThanOrEqual(12);
    expect(idle.feet.outline).toBeLessThanOrEqual(20);
    expect(idle.feet.shade).toBeGreaterThanOrEqual(2);
    expect(idle.feet.shade).toBeLessThanOrEqual(6);
    expect(idle.feet.body).toBe(0);
  });

  test('saddle blanket stays one plain light-blue patch for every lane, with no digit ink', async ({ page }) => {
    for (const count of [2, 8]) {
      await page.evaluate((n) => { GameCore.setCamelCount(n); GameCore.setGoal(null); GameCore.resetRace(); }, count);
      await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
      // isSettled() is trivially true while visualLeft is still null on a fresh
      // page, so the canvas can still hold the pre-reset layout's pixels. Let the
      // game loop paint the current scene before sampling it.
      await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));
      const res = await page.evaluate(() => {
        const g = document.getElementById('game').getContext('2d');
        return GameDebug.getCamelSpriteBounds().map((b) => {
          const d = g.getImageData(Math.round(b.left), Math.round(b.top), 92, 70).data;
          let blanket = 0, digitInk = 0;
          for (let i = 0; i < d.length; i += 4) {
            const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
            if (h === 0xbfe3ea) blanket += 1;
            else if (h === 0x123a44) digitInk += 1;
          }
          return { blanket, digitInk };
        });
      });
      // v6 draft A idle frame: 276 blanket px, flat (hole-free, 0 digit px).
      expect(res.length).toBe(count);
      for (const lane of res) {
        expect(lane.blanket).toBeGreaterThan(230); // v6 idle blanket px, banded
        expect(lane.blanket).toBeLessThan(320);
        expect(lane.digitInk).toBe(0);
      }
    }
  });

  test('saddle blanket rises 1 px with the body on the pass frames (2 and 4)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    // Paint the settled scene before the walk so the sample buffer is current.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      const canvas = document.getElementById('game');
      // Topmost blanket row anywhere in the lane-0 92x70 buffer: draft A's bob is
      // baked in, so on pass frames 2/4 the whole blanket sits 1 px higher than
      // on the contact frames (row 23 -> row 22), while the hooves stay planted.
      function blanketTopRow() {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d')
          .getImageData(Math.round(b.left), Math.round(b.top), 92, 70).data;
        for (let ry = 0; ry < 70; ry += 1) {
          for (let rx = 0; rx < 92; rx += 1) {
            const i = (ry * 92 + rx) * 4;
            if (d[i] === 0xbf && d[i + 1] === 0xe3 && d[i + 2] === 0xea) return ry;
          }
        }
        return -1;
      }
      const camel = GameCore.getState().camels[0];
      GameCore.setScore(camel.id, camel.score); // trigger the walk without moving
      const byFrame = new Map(); // walk frame index -> Map(topRow -> count)
      function tick(now) {
        if (GameCore.getState().camels[0].animUntil > now) {
          const fi = (Math.floor(now / FRAME_MS) % 4) + 1;
          if (!byFrame.has(fi)) byFrame.set(fi, new Map());
          const m = byFrame.get(fi);
          const k = blanketTopRow();
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
    // Contact frames (1, 3) share the idle blanket top row (23); the pass frames
    // (2, 4) sit exactly 1 px higher with the baked-in bob.
    // Buffer row of the contact-frame blanket top (draft A: 23); only the ±1
    // relations below are behaviour, so the absolute row is bounded, not pinned.
    expect(res['1']).toBeGreaterThan(0);
    expect(res['1']).toBeLessThan(70);
    expect(res['2']).toBe(res['1'] - 1);
    expect(res['3']).toBe(res['1']);
    expect(res['4']).toBe(res['1'] - 1);
  });

  test('rider robe takes each lane palette colour (8 camels)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(8); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    // Count every lane-palette robe pixel inside the sprite's 92x70 buffer: the
    // per-lane robe is the only thing that differs, so each lane must paint its
    // own colour and none of the other lanes' colours.
    const res = await page.evaluate(({ palette }) => {
      const bounds = GameDebug.getCamelSpriteBounds();
      const g = document.getElementById('game').getContext('2d');
      const rgb = palette.map((h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16)));
      return bounds.map((b, lane) => {
        const d = g.getImageData(Math.round(b.left), Math.round(b.top), 92, 70).data;
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
        expect(b.right - b.left).toBeCloseTo(92, 9);
        expect(b.bottom - b.top).toBeCloseTo(70, 9);
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
    // Dense-forest floor cover + midground/broad trees (docs/art/theme-art.md §3.3).
    expect(dim('const GRASS_TUFT_A =')).toEqual({ w: 10, h: 8 });
    expect(dim('const GRASS_TUFT_B =')).toEqual({ w: 12, h: 8 });
    expect(dim('const FERN =')).toEqual({ w: 16, h: 12 });
    expect(dim('const LEAF_LITTER =')).toEqual({ w: 14, h: 6 });
    expect(dim('const FOREST_TREE_TALL =')).toEqual({ w: 48, h: 72 });
    expect(dim('const FOREST_TREE_BROAD =')).toEqual({ w: 44, h: 60 });
    // Desert ambience (docs/art/theme-art.md §2.10): 16 sprites at exact 2x dims.
    expect(dim('const SAND_RIPPLE =')).toEqual({ w: 20, h: 6 });
    expect(dim('const PEBBLE_A =')).toEqual({ w: 12, h: 7 });
    expect(dim('const PEBBLE_B =')).toEqual({ w: 14, h: 8 });
    expect(dim('const SCRUB_A =')).toEqual({ w: 16, h: 10 });
    expect(dim('const SCRUB_B =')).toEqual({ w: 14, h: 12 });
    expect(dim('const TUMBLEWEED =')).toEqual({ w: 16, h: 14 });
    expect(dim('const BARREL_CACTUS =')).toEqual({ w: 14, h: 12 });
    expect(dim('const DEAD_BRANCH =')).toEqual({ w: 20, h: 10 });
    expect(dim('const BONES =')).toEqual({ w: 16, h: 10 });
    expect(dim('const HOOF_PRINTS =')).toEqual({ w: 12, h: 8 });
    expect(dim('const SAGUARO =')).toEqual({ w: 28, h: 64 });
    expect(dim('const SAGUARO_TALL =')).toEqual({ w: 32, h: 72 });
    expect(dim('const BARREL_CLUSTER =')).toEqual({ w: 24, h: 20 });
    expect(dim('const DESERT_SHRUB =')).toEqual({ w: 20, h: 14 });
    expect(dim('const MESA =')).toEqual({ w: 48, h: 24 });
    expect(dim('const DEAD_TREE =')).toEqual({ w: 32, h: 56 });
    // v2 flat floor marks (docs/art/theme-art.md §2.13): 4 marks at exact dims.
    expect(dim('const WIND_STREAK_A =')).toEqual({ w: 44, h: 8 });
    expect(dim('const WIND_STREAK_B =')).toEqual({ w: 64, h: 10 });
    expect(dim('const DRIFT_MOUND =')).toEqual({ w: 32, h: 10 });
    expect(dim('const HOOF_TRAIL =')).toEqual({ w: 40, h: 10 });
  });

  test('v2 flat floor marks: legend-only chars, clean border, documented blobs', () => {
    // docs/art/theme-art.md §2.13/§5 acceptance for the four flat marks: every
    // matrix is rectangular, uses only its legend chars plus '.', keeps a 1 px
    // transparent border (row 0/h-1 and col 0/w-1 all '.', no strays), and is a
    // single 4-connected blob - except the two documented multi-blob exceptions,
    // HOOF_TRAIL (4 prints) and HOOF_PRINTS (2 prints).
    const html = readIndexHtml();
    const V2 = [
      { decl: 'const WIND_STREAK_A =', legend: /^[.ORS]*$/, blobs: 1 },
      { decl: 'const WIND_STREAK_B =', legend: /^[.ORS]*$/, blobs: 1 },
      { decl: 'const DRIFT_MOUND =', legend: /^[.OBS]*$/, blobs: 1 },
      { decl: 'const HOOF_TRAIL =', legend: /^[.ODS]*$/, blobs: 4 },
    ];
    const components = (rows) => {
      const h = rows.length, w = rows[0].length;
      const seen = new Set();
      let n = 0;
      const fill = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (!fill(x, y) || seen.has(y * w + x)) continue;
          n += 1;
          const stack = [[x, y]];
          while (stack.length) {
            const [cx, cy] = stack.pop();
            if (!fill(cx, cy) || seen.has(cy * w + cx)) continue;
            seen.add(cy * w + cx);
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
          }
        }
      }
      return n;
    };
    for (const { decl, legend, blobs } of V2) {
      const rows = extractMatrixRows(html, decl);
      const w = Math.max(...rows.map((r) => r.length));
      expect(rows.length, decl).toBeGreaterThan(1);
      expect(rows.join('').replace(/\./g, '').length, `${decl} has fill`).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.length, `${decl} rectangular`).toBe(w);
        expect(row, `${decl} legend-only`).toMatch(legend);
      }
      // Clean transparent border on all four sides (no stray/border pixels).
      expect(rows[0], `${decl} top border`).toMatch(/^\.*$/);
      expect(rows[rows.length - 1], `${decl} bottom border`).toMatch(/^\.*$/);
      for (const row of rows) {
        expect(row[0], `${decl} left border`).toBe('.');
        expect(row[w - 1], `${decl} right border`).toBe('.');
      }
      expect(components(rows), `${decl} blob count`).toBe(blobs);
    }
  });

  test('camel v6 sprite: five 92x70 frames, legend-only chars, hooves on row 69', () => {
    // Byte-level contract for the draft-A matrices copied from
    // docs/art/camel-drafts-v3.md: 5 frames of 70 rows x 92 cols (stand + 4 walk).
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
    const idx = html.indexOf('const CAMEL = [');
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
    const rows = [...html.slice(start, i).matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(rows.length).toBe(5 * 70);
    for (const row of rows) {
      expect(row.length).toBe(92);
      expect(row).toMatch(/^[.OBSDGRWKL]*$/); // shared draft-A legend, nothing else
    }
    // All 5 frames are pairwise distinct matrices, and the bottom-row hoof
    // layout pins each contact/pass pose: swapped contacts (A <-> B share a
    // bbox and blanket row) fail on the footprint pattern.
    const frames = [];
    for (let f = 0; f < 5; f += 1) frames.push(rows.slice(f * 70, (f + 1) * 70).join('/'));
    expect(new Set(frames).size).toBe(5);
    const HOOF_PATTERNS = [
      'OOSOO|OOSOO|OOSOO|OOSOO', // 0 standing
      'OOSOO|OOSOO|OOSOOSOO',    // 1 contact A
      'O|OOSOO|OOSOO|O',         // 2 pass A (front hoof lifting)
      'OOSOOSOO|OOSOO|OOSOO',    // 3 contact B (mirrored spread)
      'OOSOO|O|O|OOSOO',         // 4 pass B (mirrored lift)
    ];
    for (let f = 0; f < 5; f += 1) {
      expect(rows.slice(f * 70, (f + 1) * 70)[69].split('.').filter(Boolean).join('|'), `frame ${f} hooves`)
        .toBe(HOOF_PATTERNS[f]);
    }
    for (let f = 0; f < 5; f += 1) {
      const frame = rows.slice(f * 70, (f + 1) * 70);
      // Painted bbox spans cols 7-90 on every frame; the bottom row is hooves
      // only (O/S) with at least two planted OOSOO hooves on it.
      let minC = 92, maxC = -1;
      for (let y = 0; y < 70; y += 1) {
        for (let x = 0; x < 92; x += 1) {
          if (frame[y][x] !== '.') { if (x < minC) minC = x; if (x > maxC) maxC = x; }
        }
      }
      expect({ minC, maxC }).toEqual({ minC: 7, maxC: 90 });
      expect(frame[69]).toMatch(/^[.OS]+$/);
      expect((frame[69].match(/OOSOO/g) || []).length).toBeGreaterThanOrEqual(2);
    }
  });

  test('every decor sprite legend char resolves through its own palette', () => {
    // drawSprite skips a char with no palette/CHAR_KEY mapping, so an undefined
    // legend char yields invisible art instead of an error. Assert each documented
    // sprite's own palette keys cover every non-'.' char in its matrix
    // (docs/art/theme-art.md §3.3, "all chars resolve, no undefined fallback").
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
    const rowsFor = (decl) => {
      const idx = html.indexOf(decl);
      expect(idx, decl).toBeGreaterThan(-1);
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
    const paletteKeys = (decl) => {
      const idx = html.indexOf(decl);
      expect(idx, decl).toBeGreaterThan(-1);
      const start = html.indexOf('{', idx);
      const body = html.slice(start + 1, html.indexOf('}', start));
      return new Set([...body.matchAll(/([A-Za-z]+)\s*:/g)].map((m) => m[1]));
    };
    // drawSprite resolves a char through palette[char] first, then
    // palette[CHAR_KEY[char]] (index.html). Mirror that so 'O' -> 'outline' etc.
    const charKey = (() => {
      const idx = html.indexOf('const CHAR_KEY = {');
      expect(idx).toBeGreaterThan(-1);
      const start = html.indexOf('{', idx);
      const body = html.slice(start + 1, html.indexOf('};', start));
      const map = new Map();
      for (const m of body.matchAll(/([A-Za-z])\s*:\s*'([A-Za-z]+)'/g)) map.set(m[1], m[2]);
      return map;
    })();
    const resolves = (keys, ch) => keys.has(ch) || (charKey.has(ch) && keys.has(charKey.get(ch)));
    const SPRITES = [
      ['const FOREST_TREE_CONIFER =', 'const FOREST_TREE_PAL_CONIFER ='],
      ['const FOREST_TREE_DECIDUOUS =', 'const FOREST_TREE_PAL_DECIDUOUS ='],
      ['const FOREST_TREE_BROAD =', 'const FOREST_TREE_BROAD_PAL ='],
      ['const FOREST_BUSH =', 'const FOREST_BUSH_PAL ='],
      ['const FOREST_TREE_TALL =', 'const FOREST_TREE_TALL_PAL ='],
      ['const GRASS_TUFT_A =', 'const GRASS_TUFT_PAL ='],
      ['const GRASS_TUFT_B =', 'const GRASS_TUFT_PAL ='],
      ['const FERN =', 'const FERN_PAL ='],
      ['const LEAF_LITTER =', 'const LEAF_LITTER_PAL ='],
      ['const MUSHROOM_RED =', 'const MUSHROOM_RED_PAL ='],
      ['const MUSHROOM_BROWN =', 'const MUSHROOM_BROWN_PAL ='],
      ['const MOSS =', 'const MOSS_PAL ='],
      ['const STONE =', 'const STONE_PAL ='],
      ['const STONE_ALT =', 'const STONE_PAL ='],
      ['const PINE_NEEDLES =', 'const NEEDLES_PAL ='],
      // Desert ambience (docs/art/theme-art.md §2.9/§2.10). HOOF_PRINTS/MESA
      // override `O` (sand ink / haze outline) and must still resolve per letter.
      ['const SAND_RIPPLE =', 'const SAND_RIPPLE_PAL ='],
      ['const PEBBLE_A =', 'const PEBBLE_PAL ='],
      ['const PEBBLE_B =', 'const PEBBLE_PAL ='],
      ['const SCRUB_A =', 'const SCRUB_PAL ='],
      ['const SCRUB_B =', 'const SCRUB_PAL ='],
      ['const TUMBLEWEED =', 'const TUMBLEWEED_PAL ='],
      ['const BARREL_CACTUS =', 'const BARREL_CACTUS_PAL ='],
      ['const DEAD_BRANCH =', 'const DEAD_BRANCH_PAL ='],
      ['const BONES =', 'const BONES_PAL ='],
      ['const HOOF_PRINTS =', 'const HOOF_PRINTS_PAL ='],
      ['const SAGUARO =', 'const SAGUARO_PAL ='],
      ['const SAGUARO_TALL =', 'const SAGUARO_TALL_PAL ='],
      ['const BARREL_CLUSTER =', 'const BARREL_CLUSTER_PAL ='],
      ['const DESERT_SHRUB =', 'const DESERT_SHRUB_PAL ='],
      ['const MESA =', 'const MESA_PAL ='],
      ['const DEAD_TREE =', 'const DEAD_TREE_PAL ='],
      // v2 flat floor marks (docs/art/theme-art.md §2.13). HOOF_TRAIL reuses
      // HOOF_PRINTS_PAL like its 2-blob sibling.
      ['const WIND_STREAK_A =', 'const WIND_STREAK_PAL ='],
      ['const WIND_STREAK_B =', 'const WIND_STREAK_PAL ='],
      ['const DRIFT_MOUND =', 'const DRIFT_MOUND_PAL ='],
      ['const HOOF_TRAIL =', 'const HOOF_PRINTS_PAL ='],
    ];
    for (const [spr, pal] of SPRITES) {
      const keys = paletteKeys(pal);
      const chars = new Set(rowsFor(spr).join('').replace(/\./g, ''));
      for (const ch of chars) {
        expect(resolves(keys, ch), `${spr} char '${ch}' missing from ${pal}`).toBe(true);
      }
    }
  });

  test('lane fit: feet land on the terrain surface with the lane clamp inert (2 and 8 lanes)', async ({ page }) => {
    // Spec fit proof: at 8 lanes (laneHeight 74, sprite 70 + 2 px feet offset =
    // 72) the clamp must never activate, so sprite top == laneBottom - FEET_OFFSET
    // - terrain - SPRITE_H.
    const HORIZON_Y = 120, LANE_BOTTOM = 712, FEET_OFFSET = 2, SPRITE_H = 70;
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

  test('hooves paint the surface row in every lane (8 lanes, clamp inert)', async ({ page }) => {
    // Pixel-level companion to the lane-fit proof above: that test pins the top
    // for lane 0 only, so sweep all 8 lanes and assert the painted bottom row.
    await page.evaluate(() => { GameCore.setCamelCount(8); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const swept = await page.evaluate(({ scores }) => {
      const HORIZON = 120, LANE_BOTTOM = 712, FEET = 2, SPRITE_H = 70;
      const n = GameCore.getState().camels.length;
      const laneH = (LANE_BOTTOM - HORIZON) / n;
      const out = [];
      for (const score of scores) {
        for (const c of GameCore.getState().camels) GameCore.setScore(c.id, score);
        const h = Math.round(GameCore.terrainHeightAt(score));
        GameDebug.getCamelSpriteBounds().forEach((b, i) => {
          const laneTop = Math.round(HORIZON + i * laneH);
          const laneBottom = Math.round(HORIZON + (i + 1) * laneH);
          out.push({ score, i, top: b.top, bottom: b.bottom, laneTop, laneBottom,
            expectedTop: laneBottom - FEET - h - SPRITE_H,
            min: Math.round(laneTop), max: Math.round(laneBottom - SPRITE_H) });
        });
      }
      return out;
    }, { scores: [0, 40, 80, 120, 200, 333] });
    // Every lane, every terrain height: exact surface placement (h = ±2 included),
    // so the clamp can never clip the 70 px sprite in a 74 px lane.
    for (const p of swept) {
      expect(p.expectedTop, `score ${p.score} lane ${p.i}`).toBeGreaterThanOrEqual(p.min);
      expect(p.expectedTop).toBeLessThanOrEqual(p.max);
      expect(p.top).toBe(p.expectedTop);
      expect(p.bottom).toBe(p.top + 70);
      expect(p.top).toBeGreaterThanOrEqual(p.laneTop);
      expect(p.bottom).toBeLessThanOrEqual(p.laneBottom);
    }
    // Repaint at score 0 and read the hoof row + the row below it.
    await page.evaluate(() => { for (const c of GameCore.getState().camels) GameCore.setScore(c.id, 0); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const rows = await page.evaluate(() => {
      const tones = new Set([0x1c1208, 0xd9a05b, 0xb4763a, 0x82521f, 0x53565e, 0xe84a3a,
        0x3a6ae8, 0x3aa84a, 0xe8c83a, 0x9a4ae8, 0xe88a3a, 0x3ad8d8, 0xe85a9a,
        0xf0ece0, 0xd8a878, 0xbfe3ea]);
      const g = document.getElementById('game').getContext('2d');
      return GameDebug.getCamelSpriteBounds().map((b) => {
        const lx = Math.max(0, Math.round(b.left));
        const w = Math.min(1280 - lx, 92);
        const hoofY = Math.round(b.top) + 69;
        const count = (y) => {
          const d = g.getImageData(lx, y, w, 1).data;
          let n = 0;
          for (let k = 0; k < d.length; k += 4) {
            if (tones.has((d[k] << 16) | (d[k + 1] << 8) | d[k + 2])) n += 1;
          }
          return n;
        };
        return { hoof: count(hoofY), below: count(hoofY + 1), hoofY };
      });
    });
    // Every lane paints hoof ink exactly on the surface's bottom sprite row. A
    // lane-8 label pill may overlap later hooves, but the first hoof (cols 15-19)
    // is always clear, and the last lane is fully unobstructed.
    rows.forEach((r, i) => {
      expect(r.hoof, `lane ${i} hoof row`).toBeGreaterThanOrEqual(3);
      expect(r.below, `lane ${i} below the surface`).toBe(0);
    });
    expect(rows[7].hoof).toBeGreaterThanOrEqual(16); // all four hooves visible
  });

  test('every walk frame keeps the sprite inside 92x70 with feet on the bottom row', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      const canvas = document.getElementById('game');
      const tones = new Set([0x1c1208, 0xd9a05b, 0xb4763a, 0x82521f, 0x53565e, 0xe84a3a,
        0x3a6ae8, 0x3aa84a, 0xe8c83a, 0x9a4ae8, 0xe88a3a, 0x3ad8d8, 0xe85a9a,
        0xf0ece0, 0xd8a878, 0xbfe3ea]);
      function measure() {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d')
          .getImageData(Math.round(b.left), Math.round(b.top), 92, 70).data;
        let minR = 70, maxR = -1, minC = 92, maxC = -1;
        for (let ry = 0; ry < 70; ry += 1) {
          for (let rx = 0; rx < 92; rx += 1) {
            const i = (ry * 92 + rx) * 4;
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
      expect(maxR, `frame ${fi} feet`).toBe(69); // hooves on the sprite's bottom row
      expect(minR).toBeGreaterThanOrEqual(0);
      expect(minR).toBeLessThanOrEqual(maxR);
      expect(minC).toBe(7);   // painted bbox spans cols 7-90 on every frame
      expect(maxC).toBe(90);
      expect(maxR - minR + 1).toBeLessThanOrEqual(70);
    }
  });
});

// ---------------------------------------------------------------------------
// drawSprite run-coalescing guard (perf fix: one fillRect per contiguous
// same-colour run per row, was one per pixel). Both tests assert OUTPUT
// IDENTITY, not call counts: a per-pixel revert (same pixels, slower) must
// still pass, while any coalescing bug - a run skipped after a gap, a stale
// run colour, an off-by-one run width, a missing trailing flush - changes
// pixels and fails.
// ---------------------------------------------------------------------------
test.describe('drawSprite run-coalescing identity', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const program = [
    extractConst(html, 'CHAR_KEY'),
    extractConst(html, 'COL'),
    extractFunction(html, 'drawSprite'),
    'return { drawSprite: drawSprite, CHAR_KEY: CHAR_KEY };',
  ].join('\n');

  test('synthetic matrix: exact pixels for merged runs, gaps and colour changes', async ({ page }) => {
    await gotoGame(page);
    // Chars 'a'/'b'/'c' hit the palette directly; 'q' is not a CHAR_KEY legend
    // char (asserted below), so it must render as a transparent gap that still
    // flushes the open run. Each row targets one bug shape: a colour change, a
    // gap between two same-colour runs, single-pixel runs, a leading/trailing
    // run (flush at x=0 and at row.length), and a fully transparent row.
    const matrix = [
      'aabcc..',
      '.a.q.aa',
      'bb..aa.',
      'a.b.a..',
      '...aaa.',
      'aaa....',
      'qaqaq..',
      '.......',
    ];
    const palette = { a: '#ff0000', b: '#00ff00', c: '#0000ff' };
    const res = await page.evaluate(({ program, matrix, palette }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 20;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const built = new Function('ctx', program)(ctx);
      built.drawSprite(matrix, 4.6, 3.4, palette); // Math.round -> (5, 3)
      return {
        q: built.CHAR_KEY.q,
        data: Array.from(ctx.getImageData(0, 0, 32, 20).data),
      };
    }, { program, matrix, palette });
    expect(res.q).toBeUndefined(); // 'q' is a real gap, not a legend char
    const hex = (ch) => (ch === '.' || !palette[ch]) ? null : palette[ch];
    const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    for (let y = 0; y < 20; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const ch = (y >= 3 && y < 3 + matrix.length && x >= 5 && x < 5 + matrix[y - 3].length)
          ? matrix[y - 3][x - 5] : '.';
        const want = hex(ch);
        const i = (y * 32 + x) * 4;
        const got = [res.data[i], res.data[i + 1], res.data[i + 2], res.data[i + 3]];
        if (want) {
          expect(got, `px ${x},${y} (${ch})`).toEqual([...rgb(want), 255]);
        } else {
          expect(got, `px ${x},${y} (transparent)`).toEqual([0, 0, 0, 0]);
        }
      }
    }
  });

  test('real camel + boar frames: output byte-identical to the per-pixel reference', async ({ page }) => {
    await gotoGame(page);
    const camelSrc = extractConst(html, 'CAMEL');
    const boarSrc = extractConst(html, 'BOAR');
    const camelPalSrc = extractConst(html, 'CAMEL_PAL');
    const boarPalSrc = extractConst(html, 'BOAR_PAL');
    const res = await page.evaluate(({ program, camelSrc, boarSrc, camelPalSrc, boarPalSrc }) => {
      const CAMEL = new Function(camelSrc + ' return CAMEL;')();
      const BOAR = new Function(boarSrc + ' return BOAR;')();
      const CAMEL_PAL = new Function(camelPalSrc + ' return CAMEL_PAL;')();
      const BOAR_PAL = new Function(boarPalSrc + ' return BOAR_PAL;')();
      const mk = () => {
        const c = document.createElement('canvas');
        c.width = 1280; c.height = 360;
        return c.getContext('2d', { willReadFrequently: true });
      };
      const ctxA = mk(); // shipped run-coalesced drawSprite
      const ctxB = mk(); // historical per-pixel algorithm
      const A = new Function('ctx', program)(ctxA);
      const B = new Function('ctx', program)(ctxB);
      // Per-pixel reference: the exact pre-fix algorithm (HEAD drawSprite),
      // sharing the live CHAR_KEY/COL tables so resolution order is identical.
      function perPixel(ctx, rows, x, y, palette, CHAR_KEY, COL) {
        const ox = Math.round(x);
        const oy = Math.round(y);
        for (let ry = 0; ry < rows.length; ry += 1) {
          const row = rows[ry];
          for (let rx = 0; rx < row.length; rx += 1) {
            const ch = row[rx];
            if (ch === '.') continue;
            const key = CHAR_KEY[ch];
            let color;
            if (palette && palette[ch] !== undefined) color = palette[ch];
            else if (palette && key && palette[key] !== undefined) color = palette[key];
            else if (key && COL[key] !== undefined) color = COL[key];
            if (color === undefined) continue;
            ctx.fillStyle = color;
            ctx.fillRect(ox + rx, oy + ry, 1, 1);
          }
        }
      }
      const ROBES = ['#e84a3a', '#3a6ae8', '#3aa84a', '#e8c83a', '#9a4ae8', '#e88a3a', '#3ad8d8', '#e85a9a'];
      const draws = [];
      for (let f = 0; f < CAMEL.length; f += 1) draws.push([CAMEL[f], 30 + f * 100, 40, CAMEL_PAL(ROBES[f % 8])]);
      for (let f = 0; f < BOAR.length; f += 1) draws.push([BOAR[f], 30 + f * 70, 160, BOAR_PAL(ROBES[(f + 3) % 8])]);
      draws.push([CAMEL[1], -13.4, -7.6, CAMEL_PAL(ROBES[0])]);   // clipped at the origin
      draws.push([BOAR[3], 1220.5, 300.5, BOAR_PAL(ROBES[1])]);   // clipped at the right/bottom edge
      draws.push([CAMEL[3], 640.2, 120.8, CAMEL_PAL(ROBES[2])]);  // overlapping fractional offset
      for (const d of draws) A.drawSprite(d[0], d[1], d[2], d[3]);
      for (const d of draws) perPixel(ctxB, d[0], d[1], d[2], d[3], B.CHAR_KEY, B.COL);
      const a = ctxA.getImageData(0, 0, 1280, 360).data;
      const b = ctxB.getImageData(0, 0, 1280, 360).data;
      let diff = 0, painted = 0, hashA = 2166136261, hashB = 2166136261;
      for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) diff += 1;
        if (i % 4 === 0) {
          if (a[i + 3] !== 0) painted += 1;
          hashA ^= a[i]; hashA = Math.imul(hashA, 16777619);
          hashB ^= b[i]; hashB = Math.imul(hashB, 16777619);
        }
      }
      return { diff, painted, hashA: hashA >>> 0, hashB: hashB >>> 0 };
    }, { program, camelSrc, boarSrc, camelPalSrc, boarPalSrc });
    // Non-vacuous: both canvases carry a lot of real art, and a cursor-parked
    // scene check would be meaningless, so this asserts the actual byte count.
    expect(res.painted).toBeGreaterThan(20000);
    expect(res.diff).toBe(0);
    expect(res.hashA).toBe(res.hashB);
  });
});
