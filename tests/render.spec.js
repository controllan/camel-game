const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { gotoGame, readIndexHtml, extractMatrixRows, settleAndPaint, waitAnimsDone } = require('./helpers');

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
  // Almost every assertion here samples desert art (camel 84x70, dune/sun/sky
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
      expect(b.right - b.left).toBeCloseTo(84, 9);
    }
    // v8 camera-fit margins: the 84 px camel clamps to 4 (trailer) .. 1280 - 84
    // - 4 = 1192 (leader), so the whole sprite stays on canvas with a 4 px
    // lane margin on each side. The lerp settles to within isSettled()'s 0.5 px
    // of the 4 / 1192 clamp targets.
    expect(bounds[0].left).toBeCloseTo(4, 0);
    expect(bounds[1].left).toBeCloseTo(1192, 0);
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
          expect(b.right - b.left).toBeCloseTo(84, 9);
          expect(b.top).toBeGreaterThanOrEqual(0);
          expect(b.bottom).toBeLessThanOrEqual(720);
        }
      });
    }
  }

  test('scene draws sky, sun, dunes and decor (expected colors present)', async ({ page }) => {
    await settleAndPaint(page);
    // The desert scene must already be on the canvas; the paint wait also
    // rules out a stale pre-setTheme frame (isSettled() alone cannot see a
    // theme change that leaves every target x untouched).
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

  test('camels rasterise fixed body/shade tones, blanket ink and the per-lane robe', async ({ page }) => {
    await settleAndPaint(page);
    const tally = await pixelTally(page);
    // v8 palette: body/shade/deep/deepest + the slate leg/hoof band are fixed
    // tones shared by every camel (only the rider robe is palette-swapped).
    // Frame 0 paints 728 body, 205 shade, 271 deep, 180 deepest and 3 slate
    // band px per camel, so 4 idle camels paint ~2900 body px.
    expect(tally['#d8a662'] || 0).toBeGreaterThanOrEqual(4 * 200); // body across 4 camels
    expect(tally['#b0786b'] || 0).toBeGreaterThan(0);   // fixed shade
    expect(tally['#6f473e'] || 0).toBeGreaterThan(0);   // v8 shadeDeep
    expect(tally['#55312e'] || 0).toBeGreaterThan(0);   // v8 shadeDeepest
    expect(tally['#53565e'] || 0).toBeGreaterThan(0);   // slate leg/hoof band (3 px)
    // v8 decorated saddle blanket: pad/padDark greens, cream/red stripe bands
    // and the white fringe must reach the canvas in the desert theme.
    for (const color of ['#4a7f65', '#37634e', '#efd39e', '#e18683', '#e7e8ea']) {
      expect(tally[color] || 0).toBeGreaterThan(0);
    }
    // The retired v7 art must not come back: no light-blue pad ink, no digit ink.
    expect(tally['#bfe3ea'] || 0).toBe(0);
    expect(tally['#123a44'] || 0).toBe(0);             // retired digit ink
    expect(tally[LANE_ROBE[0]] || 0).toBeGreaterThan(0); // lane 0 rider robe
    expect(tally[LANE_ROBE[1]] || 0).toBeGreaterThan(0); // lane 1 rider robe
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
    // Paint the mutated scene, settle the camera glide, and pin the exact
    // eased-in sprite position before capturing the idle reference pose: a
    // sub-pixel lerp tail would otherwise shift the 84 px snapshot crop between
    // samples and inflate distinctWalkFrames with non-pose variants.
    await settleAndPaint(page);
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // walk gait frame length (index.html ANIM_FRAME_MS)
      const canvas = document.getElementById('game');
      const snap = () => {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const x = Math.max(0, Math.round(b.left) - 1);
        const y = Math.max(0, Math.round(b.top));
        return canvas.getContext('2d').getImageData(x, y, 84, 70).data.join(',');
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
    await settleAndPaint(page);
    const same = await page.evaluate(() => new Promise((resolve) => {
      const canvas = document.getElementById('game');
      const snap = () => {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const x = Math.max(0, Math.round(b.left) - 1);
        const y = Math.max(0, Math.round(b.top));
        return canvas.getContext('2d').getImageData(x, y, 84, 70).data.join(',');
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
    // isSettled() tracks camel positions, not the sky: a paint wait after the
    // theme has been applied is required before sampling the top band.
    await settleAndPaint(page);
    const first = await decorRegion();
    await gotoGame(page);
    // Reload restores the persisted desert theme, but only if the debounced save
    // already flushed; pin it again so the comparison is theme-stable either way.
    await page.evaluate(() => GameCore.setTheme('desert'));
    await settleAndPaint(page);
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
    await settleAndPaint(page);
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
    await settleAndPaint(page);
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

  test('84x70 camel sprite rasterises body, blanket and rider (v8 palette)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await settleAndPaint(page);
    const b = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0]);
    expect(b.right - b.left).toBeCloseTo(84, 9); // SPRITE_W buffer
    expect(b.bottom - b.top).toBeCloseTo(70, 9); // SPRITE_H buffer
    const seen = await page.evaluate(({ left, top }) => {
      const d = document.getElementById('game').getContext('2d')
        .getImageData(Math.round(left), Math.round(top), 84, 70).data;
      const want = { body: 0xd8a662, outline: 0x1c1208, shade: 0xb0786b, deep: 0x6f473e,
        deepest: 0x55312e, harness: 0x53565e, turban: 0xf0ece0, skin: 0xd8a878,
        robe: 0xe84a3a, pad: 0x4a7f65, padDark: 0x37634e, stripeCream: 0xefd39e,
        stripeRed: 0xe18683, fringe: 0xe7e8ea, retired: 0xbfe3ea };
      const got = Object.fromEntries(Object.keys(want).map((k) => [k, 0]));
      // Every camel tone (the lane-0 v8 palette) plus the rider so the real drawn
      // bbox and the rider block can be measured inside the 84x70 buffer.
      const camel = new Set(Object.values(want));
      const rider = new Set([0xe84a3a, 0xf0ece0, 0xd8a878]); // robe + turban + skin
      let minC = 84, maxC = -1, minR = 70, maxR = -1;
      let rPx = 0, rMinC = 84, rMaxC = -1, rMinR = 70, rMaxR = -1;
      for (let ry = 0; ry < 70; ry += 1) {
        for (let rx = 0; rx < 84; rx += 1) {
          const i = (ry * 84 + rx) * 4;
          const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
          for (const k in want) if (h === want[k]) got[k] += 1;
          if (camel.has(h)) {
            if (rx < minC) minC = rx;
            if (rx > maxC) maxC = rx;
            if (ry < minR) minR = ry;
            if (ry > maxR) maxR = ry;
          }
          if (rider.has(h)) {
            rPx += 1;
            if (rx < rMinC) rMinC = rx;
            if (rx > rMaxC) rMaxC = rx;
            if (ry < rMinR) rMinR = ry;
            if (ry > rMaxR) rMaxR = ry;
          }
        }
      }
      return { got, bbox: { w: maxC - minC + 1, h: maxR - minR + 1, minC, maxC, minR, maxR },
        rider: { px: rPx, minC: rMinC, maxC: rMaxC, minR: rMinR, maxR: rMaxR } };
    }, { left: b.left, top: b.top });
    // Tone-count bands only, not exact pins: a benign 1 px art tweak may shift a
    // count, so the v8 frame-0 counts (728 body / 205 shade / 271 deep / 180
    // deepest / 3 slate band / 860+ outline px) are bracketed; a missing or
    // double-drawn sprite (0 / ~2x) still fails. The bbox and rider pins below
    // stay exact on purpose: they mirror the frame matrices and catch frame
    // swappage, a lost rider or a leaked bob offset.
    expect(seen.got.body).toBeGreaterThan(640);
    expect(seen.got.body).toBeLessThan(820);
    expect(seen.got.shade).toBeGreaterThan(150);
    expect(seen.got.shade).toBeLessThan(260);
    expect(seen.got.deep).toBeGreaterThan(220);
    expect(seen.got.deep).toBeLessThan(330);
    expect(seen.got.deepest).toBeGreaterThan(140);
    expect(seen.got.deepest).toBeLessThan(230);
    expect(seen.got.harness).toBeGreaterThan(0); // 3 px slate leg/hoof band in v8
    expect(seen.got.harness).toBeLessThan(10);
    expect(seen.got.outline).toBeGreaterThan(700);
    // Decorated v8 saddle blanket: every ink family is rasterised; the retired
    // v7 light-blue pad tone must stay at exactly 0.
    expect(seen.got.pad).toBeGreaterThan(60);
    expect(seen.got.padDark).toBeGreaterThan(40);
    expect(seen.got.stripeCream).toBeGreaterThan(15);
    expect(seen.got.stripeRed).toBeGreaterThan(0);
    expect(seen.got.fringe).toBeGreaterThan(0);
    expect(seen.got.retired).toBe(0);
    // Real drawn bbox of the idle v8 camel inside the 84x70 frame: 80x68 at
    // matrix (2,2) - cols 2-81, rows 2-69.
    expect(seen.bbox.w).toBe(80);
    expect(seen.bbox.h).toBe(68);
    expect(seen.bbox.minC).toBe(2);
    expect(seen.bbox.maxC).toBe(81);
    expect(seen.bbox.minR).toBe(2);
    expect(seen.bbox.maxR).toBe(69);
    // Rider still drawn (no art-rewrite side effect): robe + turban + skin
    // occupy the documented 11x15 block cols 29-39 / rows 5-19, its lowest row
    // on the camel's back band - the rider sits, it does not float.
    expect(seen.got.robe).toBeGreaterThan(0);
    expect(seen.got.turban).toBeGreaterThan(0);
    expect(seen.got.skin).toBeGreaterThan(0);
    expect(seen.rider.px).toBeGreaterThanOrEqual(90); // robe 58 + turban 15 + skin 23
    expect({ minC: seen.rider.minC, maxC: seen.rider.maxC, minR: seen.rider.minR, maxR: seen.rider.maxR })
      .toEqual({ minC: 29, maxC: 39, minR: 5, maxR: 19 });
    // Retired digit ink must not come back either.
    const digitInk = await page.evaluate(({ left, top }) => {
      const d = document.getElementById('game').getContext('2d')
        .getImageData(Math.round(left), Math.round(top), 84, 70).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) === 0x123a44) n += 1;
      }
      return n;
    }, { left: b.left, top: b.top });
    expect(digitInk).toBe(0);
    // Standing feet (sprite row 69): two hoof clusters painted as solid outline
    // runs (17 + 18 px in frame 0); nothing of the leg/body may paint on it.
    const idle = await page.evaluate(({ left, top }) => {
      const d = document.getElementById('game').getContext('2d')
        .getImageData(Math.round(left), Math.round(top), 84, 70).data;
      const got = { outline: 0, shade: 0, body: 0 };
      for (let rx = 0; rx < 84; rx += 1) {
        const i = (69 * 84 + rx) * 4;
        const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        if (h === 0x1c1208) got.outline += 1;
        else if (h === 0xb0786b) got.shade += 1;
        else if (h === 0xd8a662 || h === 0x6f473e || h === 0x55312e) got.body += 1;
      }
      return got;
    }, { left: b.left, top: b.top });
    // Bands around the two v8 hoof clusters (17 + 18 outline px): a benign hoof
    // retouch passes, a collapsed hoof row (0 / one cluster) fails. body is
    // behaviour: nothing may paint a leg on the hoof line.
    expect(idle.outline).toBeGreaterThanOrEqual(30);
    expect(idle.outline).toBeLessThanOrEqual(40);
    expect(idle.shade).toBe(0);
    expect(idle.body).toBe(0);
  });

  test('camel v8 blanket ink lands in every lane; the rider robe carries the lane colour (2 and 8 camels)', async ({ page }) => {
    for (const count of [2, 8]) {
      await page.evaluate((n) => { GameCore.setCamelCount(n); GameCore.setGoal(null); GameCore.resetRace(); }, count);
      // isSettled() is trivially true while visualLeft is still null on a fresh
      // page, so the canvas can still hold the pre-reset layout's pixels. Paint
      // the mutated scene and pin the eased position before sampling it.
      await settleAndPaint(page);
      const res = await page.evaluate(({ palette }) => {
        const g = document.getElementById('game').getContext('2d');
        const rgb = palette.map((h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16)));
        // v8 decorated blanket ink: pad green, pad dark green, cream + red
        // stripes and the white fringe (all unique to CAMEL_PAL).
        const BLANKET = new Set([0x4a7f65, 0x37634e, 0xefd39e, 0xe18683, 0xe7e8ea]);
        return GameDebug.getCamelSpriteBounds().map((b, lane) => {
          const d = g.getImageData(Math.round(b.left), Math.round(b.top), 84, 70).data;
          let blanket = 0, retired = 0, digitInk = 0, robe = 0, turban = 0, skin = 0, others = 0;
          for (let i = 0; i < d.length; i += 4) {
            const h = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
            if (BLANKET.has(h)) blanket += 1;       // v8 pad / stripe / fringe ink
            else if (h === 0xbfe3ea) retired += 1;  // retired v7 light-blue pad ink
            else if (h === 0x123a44) digitInk += 1; // retired digit ink
            else if (h === 0xf0ece0) turban += 1;   // rider turban
            else if (h === 0xd8a878) skin += 1;     // rider face / hand
            for (let p = 0; p < rgb.length; p += 1) {
              if (d[i] === rgb[p][0] && d[i + 1] === rgb[p][1] && d[i + 2] === rgb[p][2]) {
                if (p === lane) robe += 1; else others += 1;
              }
            }
          }
          return { blanket, retired, digitInk, robe, turban, skin, others };
        });
      }, { palette: LANE_ROBE });
      expect(res.length).toBe(count);
      for (const lane of res) {
        expect(lane.blanket).toBeGreaterThanOrEqual(200); // decorated blanket per camel
        expect(lane.retired).toBe(0);                     // v7 light-blue pad stays gone
        expect(lane.digitInk).toBe(0);
        expect(lane.robe).toBeGreaterThanOrEqual(40);     // lane identity: >= 40 px robe
        expect(lane.others).toBe(0);                      // no other lane's colour leaks in
        expect(lane.turban).toBeGreaterThan(0);           // rider still drawn
        expect(lane.skin).toBeGreaterThan(0);
      }
    }
  });

  test('walk bob: the rider sits exactly 1 px higher on pass frames (2 and 4), hooves stay planted', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await settleAndPaint(page);
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      const canvas = document.getElementById('game');
      // All v8 camel ink (palette-unique, so no background decor can fake the
      // silhouette) for the hoof row, and the rider (robe + turban + skin) for
      // the bob. The head/body shifts up 1 row on the pass frames, but the
      // measured top row stays 2 because the ear's two top `OOO` rows are
      // identical; the rider bbox makes the bob unambiguous.
      const camelTones = new Set([0x1c1208, 0xd8a662, 0xb0786b, 0x6f473e, 0x55312e,
        0x53565e, 0x4a7f65, 0x37634e, 0xefd39e, 0xe18683, 0xe7e8ea]);
      const riderTones = new Set([0xe84a3a, 0xf0ece0, 0xd8a878]);
      function measure(tones) {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d')
          .getImageData(Math.round(b.left), Math.round(b.top), 84, 70).data;
        let minR = 70, maxR = -1;
        for (let ry = 0; ry < 70; ry += 1) {
          for (let rx = 0; rx < 84; rx += 1) {
            const i = (ry * 84 + rx) * 4;
            if (tones.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) {
              if (ry < minR) minR = ry;
              if (ry > maxR) maxR = ry;
            }
          }
        }
        return minR + '|' + maxR;
      }
      const camel = GameCore.getState().camels[0];
      GameCore.setScore(camel.id, camel.score); // trigger the walk without moving
      const byFrame = new Map(); // walk frame index -> Map(measure -> count)
      function tick(now) {
        if (GameCore.getState().camels[0].animUntil > now) {
          const fi = (Math.floor(now / FRAME_MS) % 4) + 1;
          if (!byFrame.has(fi)) byFrame.set(fi, new Map());
          const m = byFrame.get(fi);
          const k = measure(camelTones) + '/' + measure(riderTones);
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
    const rider = {};
    const feet = {};
    for (const fi of ['1', '2', '3', '4']) {
      const [camelBox, riderBox] = res[fi].split('/');
      feet[fi] = camelBox.split('|')[1]; // maxR of the camel silhouette
      rider[fi] = riderBox;
    }
    // Contact frames (1, 3) seat the rider on rows 5-19; the pass frames (2, 4)
    // ride the baked 1 px bob to rows 4-18. The absolute rows are pinned to the
    // v8 matrices; the relation is the behaviour.
    expect(rider['1']).toBe('5|19');
    expect(rider['3']).toBe('5|19');
    expect(rider['2']).toBe('4|18'); // one row higher (bob)
    expect(rider['4']).toBe('4|18');
    // Hooves stay planted on the buffer's bottom row (69) in every frame: the bob
    // lifts the body + rider, never the feet.
    for (const fi of ['1', '2', '3', '4']) expect(feet[fi], `frame ${fi} feet`).toBe('69');
  });

  test('rider robe takes each lane palette colour (8 camels)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(8); GameCore.setGoal(null); GameCore.resetRace(); });
    await settleAndPaint(page);
    // Count every lane-palette robe pixel inside the sprite's 84x70 buffer: the
    // per-lane robe is the only thing that differs, so each lane must paint its
    // own colour (>= 40 px, matrix count 58) and none of the others'.
    const res = await page.evaluate(({ palette }) => {
      const bounds = GameDebug.getCamelSpriteBounds();
      const g = document.getElementById('game').getContext('2d');
      const rgb = palette.map((h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16)));
      return bounds.map((b, lane) => {
        const d = g.getImageData(Math.round(b.left), Math.round(b.top), 84, 70).data;
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
      expect(r.own).toBeGreaterThanOrEqual(40); // this lane's robe colour is drawn
      expect(r.others).toBe(0); // ...and no other lane's robe colour leaks in
    }
  });

  test('dune lane tokens rasterise (top, shade, edge, rim)', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.setGoal(null); GameCore.resetRace(); });
    await settleAndPaint(page);
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
        expect(b.right - b.left).toBeCloseTo(84, 9);
        expect(b.bottom - b.top).toBeCloseTo(70, 9);
      });
    }
  });

  test('rendered dune crest is continuous across the whole track', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.resetRace(); });
    await settleAndPaint(page);
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

  test('camel v8 sprite: five 84x70 frames, decorated blanket, feet on row 69, rider rides the bob', () => {
    // Byte-level contract for the shipped v8 matrices (docs/art/camel-drafts-v5.md):
    // 5 frames of 70 rows x 84 cols (stand + 4 walk), the reference-traced
    // decorated saddle blanket (P/Q pad, C/X stripes, F fringe) and no `L` cell.
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
      expect(row.length).toBe(84);
      expect(row).not.toMatch(/L/);                // blanket char stays retired
      expect(row).toMatch(/^[.OBSDGRWKZQPCXF]*$/); // v8 legend, nothing else
    }
    // All 5 frames are pairwise distinct matrices; the exact bottom-row hoof
    // layout pins each contact/pass pose (swapped contacts fail on the stride).
    const frames = [];
    for (let f = 0; f < 5; f += 1) frames.push(rows.slice(f * 70, (f + 1) * 70).join('/'));
    expect(new Set(frames).size).toBe(5);
    const HOOF_ROWS = [
      '...........OOOOOOOOOOOOOOOOO.........OOOOOOOOOOOOOOOOOO.............................', // 0 standing
      '.............OOOOOOOOOOOOOOOOO.....OOOOOOOOOOOOOOOOOO...............................', // 1 contact A
      '...........OOOOOOOOOOOOOOOOO.........OOOOOOOOOOOOOOOOOO.............................', // 2 pass A
      '.........OOOOOOOOOOOOOOOOO.............OOOOOOOOOOOOOOOOOO...........................', // 3 contact B
      '...........OOOOOOOOOOOOOOOO..........OOOOOOO.OOOOOOOOOOO............................', // 4 pass B
    ];
    // Painted bbox per frame (docs/art/camel-drafts-v5.md validation table):
    // 80x68 / 80x68 / 79x68 / 80x68 / 81x68, rows 2-69 in every frame; the walk
    // stride shifts the left edge 1-2 cols while the hooves stay on row 69.
    const BBOX = [
      { minC: 2, maxC: 81, minR: 2, maxR: 69 },
      { minC: 2, maxC: 81, minR: 2, maxR: 69 },
      { minC: 3, maxC: 81, minR: 2, maxR: 69 },
      { minC: 2, maxC: 81, minR: 2, maxR: 69 },
      { minC: 1, maxC: 81, minR: 2, maxR: 69 },
    ];
    for (let f = 0; f < 5; f += 1) {
      const frame = rows.slice(f * 70, (f + 1) * 70);
      expect(frame[69], `frame ${f} hoof row`).toBe(HOOF_ROWS[f]);
      expect(frame[69]).toMatch(/^[.O]+$/);
      let minC = 84, maxC = -1, minR = 70, maxR = -1;
      for (let y = 0; y < 70; y += 1) {
        for (let x = 0; x < 84; x += 1) {
          if (frame[y][x] !== '.') {
            if (x < minC) minC = x;
            if (x > maxC) maxC = x;
            if (y < minR) minR = y;
            if (y > maxR) maxR = y;
          }
        }
      }
      expect({ minC, maxC, minR, maxR }, `frame ${f} bbox`).toEqual(BBOX[f]);
    }
    // Decorated saddle blanket contract: the v8 palette keys exist, every frame
    // actually paints the pad/stripe/fringe inks, and the per-lane robe paints at
    // least its documented 58 px per frame.
    const palSrc = extractConst(html, 'CAMEL_PAL');
    for (const key of ['pad', 'padDark', 'stripeCream', 'stripeRed', 'fringe', 'shadeDeepest']) {
      expect(palSrc, 'CAMEL_PAL.' + key).toContain(key + ':');
    }
    for (let f = 0; f < 5; f += 1) {
      const frame = rows.slice(f * 70, (f + 1) * 70).join('');
      // Lower bound, not an exact pin: the robe must paint its full documented
      // 58 px per frame, but a pocket-filling art tweak elsewhere must not break it.
      expect((frame.match(/R/g) || []).length, `frame ${f} robe px`).toBeGreaterThanOrEqual(58);
      for (const ch of ['P', 'Q', 'C', 'X', 'F']) {
        expect(frame.includes(ch), `frame ${f} blanket char ${ch}`).toBe(true);
      }
    }
    // Rider seat (docs/art/camel-drafts-v5.md): the v8 rider glyph (turban W,
    // face/hands K, tunic R) bbox and its lowest robe row are pinned - pass
    // frames bob 1 px up - and every lowest robe pixel touches camel ink below
    // or diagonally below. The v8 rider's right-hand column overhangs the
    // saddle, so the probe is 8-connected; a shifted or detached rider still
    // fails on the pinned bbox/seat and a fully floating boot row.
    const RIDER_BBOX = [
      { minC: 29, maxC: 39, minR: 5, maxR: 19, seat: 19 }, // 0 standing
      { minC: 29, maxC: 39, minR: 5, maxR: 19, seat: 19 }, // 1 contact A
      { minC: 29, maxC: 39, minR: 4, maxR: 18, seat: 18 }, // 2 pass A (bob)
      { minC: 29, maxC: 39, minR: 5, maxR: 19, seat: 19 }, // 3 contact B
      { minC: 29, maxC: 39, minR: 4, maxR: 18, seat: 18 }, // 4 pass B (bob)
    ];
    for (let f = 0; f < 5; f += 1) {
      const frame = rows.slice(f * 70, (f + 1) * 70);
      const lowest = new Map();
      let minC = 84, maxC = -1, minR = 70, maxR = -1;
      for (let y = 0; y < 70; y += 1) {
        for (let x = 0; x < 84; x += 1) {
          if (frame[y][x] === 'R') lowest.set(x, y);
          if ('RWK'.includes(frame[y][x])) {
            if (x < minC) minC = x;
            if (x > maxC) maxC = x;
            if (y < minR) minR = y;
            if (y > maxR) maxR = y;
          }
        }
      }
      const seat = Math.max(...lowest.values());
      expect({ minC, maxC, minR, maxR, seat }, `frame ${f} rider`).toEqual(RIDER_BBOX[f]);
      expect(lowest.size, `frame ${f} robe columns`).toBe(10);
      for (const [x, y] of lowest) {
        const touches = [frame[y + 1]?.[x], frame[y + 1]?.[x - 1], frame[y + 1]?.[x + 1]]
          .some((ch) => ch !== undefined && ch !== '.');
        expect(touches, `frame ${f} col ${x} rider seat`).toBe(true);
      }
    }
  });

  test('boar sprite: five 60x42 frames, rider seated on the back, hooves on row 41', () => {
    // Boar companion to the camel matrix contract (docs/art/boar-sprite.md): the
    // blanket-free 5 frames are 42 rows x 60 cols, `L` is retired from BOAR_PAL,
    // and the hunter (cap C, skin K, robe R) seats on the flank with no
    // transparent gap under any robe column - pinned per frame so a rider shift
    // or a re-introduced blanket box fails. Pass frames 2/4 bob the rider +1 row.
    const html = readIndexHtml();
    const rows = extractMatrixRows(html, 'const BOAR =');
    expect(rows.length).toBe(5 * 42);
    for (const row of rows) {
      expect(row.length).toBe(60);
      expect(row).not.toMatch(/L/);
      expect(row).toMatch(/^[.BCDEGHKORSTWY]*$/);
    }
    const RIDER = [
      { minC: 22, maxC: 31, minR: 1, maxR: 13, seat: 13 }, // 0 standing
      { minC: 22, maxC: 31, minR: 1, maxR: 13, seat: 13 }, // 1 contact A
      { minC: 22, maxC: 31, minR: 2, maxR: 14, seat: 14 }, // 2 pass A (bob)
      { minC: 22, maxC: 31, minR: 1, maxR: 13, seat: 13 }, // 3 contact B
      { minC: 22, maxC: 31, minR: 2, maxR: 14, seat: 14 }, // 4 pass B (bob)
    ];
    for (let f = 0; f < 5; f += 1) {
      const frame = rows.slice(f * 42, (f + 1) * 42);
      const lowest = new Map();
      let minC = 60, maxC = -1, minR = 42, maxR = -1;
      let cap = 0, skin = 0, robe = 0;
      for (let y = 0; y < 42; y += 1) {
        for (let x = 0; x < 60; x += 1) {
          const ch = frame[y][x];
          if (ch === 'R') { robe += 1; lowest.set(x, y); }
          if (ch === 'C') cap += 1;
          if (ch === 'K') skin += 1;
          if ('CKR'.includes(ch)) {
            if (x < minC) minC = x;
            if (x > maxC) maxC = x;
            if (y < minR) minR = y;
            if (y > maxR) maxR = y;
          }
        }
      }
      const seat = Math.max(...lowest.values());
      expect({ minC, maxC, minR, maxR, seat, cap, skin, robe }, `frame ${f} rider`)
        .toEqual({ ...RIDER[f], cap: 7, skin: 15, robe: 55 });
      expect(lowest.size, `frame ${f} robe columns`).toBe(8);
      for (const [x, y] of lowest) {
        expect(frame[y + 1] && frame[y + 1][x], `frame ${f} col ${x} rider seat`).not.toBe('.');
      }
    }
  });

  test('no legacy blanket contract: no L cell in CAMEL/BOAR, no blanket palette key, no L CHAR_KEY', () => {
    // Three independent ways the retired v7 blanket box could sneak back in: a
    // matrix `L` cell, a palette key literally named `blanket` (with the
    // light-blue tone) or the shared L -> blanket char key. The v8 camel blanket
    // uses its own pad/padDark/stripeCream/stripeRed/fringe keys and P/Q/C/X/F
    // chars (asserted by the v8 camel matrix test), so all three legacy paths
    // must stay gone.
    const html = readIndexHtml();
    for (const decl of ['const CAMEL =', 'const BOAR =']) {
      const rows = extractMatrixRows(html, decl);
      expect(rows.length, decl).toBeGreaterThan(0);
      expect(rows.join(''), decl + ' L cells').not.toMatch(/L/);
    }
    for (const pal of ['CAMEL_PAL', 'BOAR_PAL']) {
      const src = extractConst(html, pal);
      expect(src, pal + ' blanket key').not.toMatch(/blanket/);
      expect(src, pal + ' blanket tone').not.toMatch(/bfe3ea/);
    }
    // `L` legitimately keys LEAF_LITTER_PAL and MESA_PAL through their own
    // palette objects (decor legend test below), so only the shared CHAR_KEY
    // entry is dead and must be gone.
    expect(extractConst(html, 'CHAR_KEY')).not.toMatch(/\bL\s*:/);
  });

  test('every drawn sprite cell resolves through palette → CHAR_KEY → COL (no invisible art)', () => {
    // Deleting L from CHAR_KEY makes it dead, but LEAF_LITTER_PAL.L and
    // MESA_PAL.L keep working through their own palettes. drawSprite silently
    // SKIPS a char that resolves nowhere, so a stale legend char would render
    // as transparent art with no error. This scans EVERY sprite matrix the
    // renderer draws (all THEMES kinds + both animal sprites, plus the
    // milestone/finish flags) with the live CHAR_KEY/COL tables in the exact
    // drawSprite resolution order, so one unresolved cell fails here.
    const html = readIndexHtml();
    const CHAR_KEY = new Function(extractConst(html, 'CHAR_KEY') + ' return CHAR_KEY;')();
    const COL = new Function(extractConst(html, 'COL') + ' return COL;')();
    // Sprite matrices are the all-caps const arrays of equal-length [.A-Za-z]
    // rows (excludes PALETTE / DUNE_STREAKS numbers and CONFETTI_COLORS hexes).
    const matrixNames = [...new Set([...html.matchAll(/const ([A-Z][A-Z0-9_]*) = \[/g)].map((m) => m[1]))]
      .filter((name) => {
        const rows = extractMatrixRows(html, 'const ' + name + ' =');
        return rows.length >= 2
          && rows.every((r) => /^[.A-Za-z]+$/.test(r))
          && new Set(rows.map((r) => r.length)).size === 1;
      });
    // (sprite, palette) pairs the renderer feeds to drawSprite: regex the theme
    // registry (decor kinds + animal sprites) so new wiring is covered, plus the
    // two flags drawn by drawMilestones/drawFinish.
    const pairs = [...new Set([...html.matchAll(/sprite: (\w+), pal: (\w+)/g)].map((m) => m[1] + '|' + m[2]))]
      .map((p) => p.split('|'));
    pairs.push(['MILESTONE', 'MILESTONE_PAL'], ['FINISH_FLAG', 'FINISH_PAL']);
    // Coverage: every matrix-shaped const must have a (sprite, palette) pair, so
    // a sprite cannot be drawn without entering this scan.
    const drawn = new Set(pairs.map((p) => p[0]));
    for (const name of matrixNames) {
      expect(drawn.has(name), `matrix ${name} has no (sprite, palette) pair in this scan`).toBe(true);
    }
    const unresolved = [];
    for (const [sprite, palName] of pairs) {
      let palette = new Function(extractConst(html, palName) + ' return ' + palName + ';')();
      if (typeof palette === 'function') palette = palette('#e84a3a'); // per-lane robe factory
      const warned = new Set();
      for (const row of extractMatrixRows(html, 'const ' + sprite + ' =')) {
        for (const ch of row) {
          if (ch === '.' || warned.has(ch)) continue;
          warned.add(ch);
          const key = CHAR_KEY[ch];
          const color = (palette[ch] !== undefined) ? palette[ch]
            : (key && palette[key] !== undefined) ? palette[key]
            : (key && COL[key] !== undefined) ? COL[key]
            : undefined;
          if (color === undefined) unresolved.push(`${sprite} char '${ch}'`);
        }
      }
    }
    expect(unresolved).toEqual([]);
    // Sanity: the scan really covers the full shipped art set (42 matrices, 42 pairs).
    expect(matrixNames.length).toBeGreaterThanOrEqual(42);
    expect(pairs.length).toBeGreaterThanOrEqual(42);
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
    // Repaint at score 0 and read the hoof row + the row below it. setScore
    // triggers a 1400ms walk on every lane, and a pass frame plants the hooves
    // shifted sideways on the bottom sprite row, so wait for the walk to end
    // instead of sampling whatever phase is current.
    await page.evaluate(() => { for (const c of GameCore.getState().camels) GameCore.setScore(c.id, 0); });
    await waitAnimsDone(page);
    await settleAndPaint(page);
    const rows = await page.evaluate(() => {
      const tones = new Set([0x1c1208, 0xd8a662, 0xb0786b, 0x6f473e, 0x55312e, 0x53565e, 0x4a7f65, 0x37634e,
        0xefd39e, 0xe18683, 0xe7e8ea,
        0xe84a3a, 0x3a6ae8, 0x3aa84a, 0xe8c83a, 0x9a4ae8, 0xe88a3a, 0x3ad8d8, 0xe85a9a,
        0xf0ece0, 0xd8a878]);
      const g = document.getElementById('game').getContext('2d');
      return GameDebug.getCamelSpriteBounds().map((b) => {
        const lx = Math.max(0, Math.round(b.left));
        const w = Math.min(1280 - lx, 84);
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
    // lane-8 label pill may overlap later hooves, but the first hoof cluster is
    // always clear, and the last lane is fully unobstructed.
    rows.forEach((r, i) => {
      expect(r.hoof, `lane ${i} hoof row`).toBeGreaterThanOrEqual(3);
      expect(r.below, `lane ${i} below the surface`).toBe(0);
    });
    expect(rows[7].hoof).toBeGreaterThanOrEqual(16); // both hoof clusters visible
  });

  test('every walk frame keeps the sprite inside 84x70 with feet on the bottom row', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(2); GameCore.setGoal(null); GameCore.resetRace(); });
    // Exact painted position before the walk: the min/max column assertions
    // below compare against fixed sprite columns, so a wandering crop fails.
    await settleAndPaint(page);
    const res = await page.evaluate(() => new Promise((resolve) => {
      const FRAME_MS = 320; // ANIM_FRAME_MS
      const canvas = document.getElementById('game');
      const tones = new Set([0x1c1208, 0xd8a662, 0xb0786b, 0x6f473e, 0x55312e,
        0x53565e, 0x4a7f65, 0x37634e, 0xefd39e, 0xe18683, 0xe7e8ea]);
      function measure() {
        const b = GameDebug.getCamelSpriteBounds()[0];
        const d = canvas.getContext('2d')
          .getImageData(Math.round(b.left), Math.round(b.top), 84, 70).data;
        let minR = 70, maxR = -1, minC = 84, maxC = -1;
        for (let ry = 0; ry < 70; ry += 1) {
          for (let rx = 0; rx < 84; rx += 1) {
            const i = (ry * 84 + rx) * 4;
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
    // v8 painted bbox per rendered walk frame (docs/art/camel-drafts-v5.md
    // validation table): 80x68 / 79x68 / 80x68 / 81x68, rows 2-69 in every
    // frame, the walk stride shifts the left edge 1-2 cols, hooves on row 69.
    const BBOX = {
      1: { maxR: 69, minR: 2, minC: 2, maxC: 81 },
      2: { maxR: 69, minR: 2, minC: 3, maxC: 81 },
      3: { maxR: 69, minR: 2, minC: 2, maxC: 81 },
      4: { maxR: 69, minR: 2, minC: 1, maxC: 81 },
    };
    for (const fi of ['1', '2', '3', '4']) {
      const [maxR, minR, minC, maxC] = res[fi].split('|').map(Number);
      expect({ maxR, minR, minC, maxC }, `frame ${fi} bbox`).toEqual(BBOX[fi]);
      expect(maxR - minR + 1).toBeLessThanOrEqual(70);
      expect(maxC - minC + 1).toBeLessThanOrEqual(84);
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

  test('retired CHAR_KEY.L: decor L cells still paint their own palette tone', async ({ page }) => {
    // Highest-risk regression of the CHAR_KEY cleanup: sprites that legitimately
    // use `L` in their OWN legend (LEAF_LITTER_PAL.L #8a5a3a, MESA_PAL.L
    // #5f4360) must still render exactly those tones - a cell whose only colour
    // came from the deleted L -> blanket fallback would silently go transparent.
    // Draw both matrices offscreen with the shipped drawSprite: every 'L' cell
    // must paint its palette tone, and no non-'.' cell may stay transparent.
    await gotoGame(page);
    const leafSrc = extractConst(html, 'LEAF_LITTER');
    const leafPalSrc = extractConst(html, 'LEAF_LITTER_PAL');
    const mesaSrc = extractConst(html, 'MESA');
    const mesaPalSrc = extractConst(html, 'MESA_PAL');
    const res = await page.evaluate(({ program, leafSrc, leafPalSrc, mesaSrc, mesaPalSrc }) => {
      const LEAF_LITTER = new Function(leafSrc + ' return LEAF_LITTER;')();
      const LEAF_LITTER_PAL = new Function(leafPalSrc + ' return LEAF_LITTER_PAL;')();
      const MESA = new Function(mesaSrc + ' return MESA;')();
      const MESA_PAL = new Function(mesaPalSrc + ' return MESA_PAL;')();
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 64;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const built = new Function('ctx', program)(ctx);
      built.drawSprite(LEAF_LITTER, 3, 3, LEAF_LITTER_PAL); // L = #8a5a3a
      built.drawSprite(MESA, 40, 3, MESA_PAL);             // L = #5f4360
      const d = ctx.getImageData(0, 0, 160, 64).data;
      const probe = (rows, x0, y0, lTone) => {
        let lCells = 0, lPainted = 0, nonDot = 0, unresolved = 0;
        for (let y = 0; y < rows.length; y += 1) {
          for (let x = 0; x < rows[y].length; x += 1) {
            const ch = rows[y][x];
            if (ch === '.') continue;
            nonDot += 1;
            const i = ((y0 + y) * 160 + (x0 + x)) * 4;
            if (d[i + 3] === 0) unresolved += 1;
            if (ch === 'L') {
              lCells += 1;
              if (((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) === lTone) lPainted += 1;
            }
          }
        }
        return { lCells, lPainted, nonDot, unresolved };
      };
      return { leaf: probe(LEAF_LITTER, 3, 3, 0x8a5a3a), mesa: probe(MESA, 40, 3, 0x5f4360) };
    }, { program, leafSrc, leafPalSrc, mesaSrc, mesaPalSrc });
    // LEAF_LITTER carries 10 L cells, MESA 30; each must rasterise its own tone
    // and the matrices must have zero transparent cells.
    expect(res.leaf).toEqual({ lCells: 10, lPainted: 10, nonDot: 30, unresolved: 0 });
    expect(res.mesa).toEqual({ lCells: 30, lPainted: 30, nonDot: 490, unresolved: 0 });
  });
});
