const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('Controls and i18n', () => {
  test.beforeEach(async ({ page }) => { await gotoGame(page); });

  test('initial render shows 4 camel lanes', async ({ page }) => {
    await expect(page.locator('.lane')).toHaveCount(4);
    await expect(page.locator('.lane').nth(0).locator('[data-name]')).toHaveText('Camel 1');
  });

  test('+5 moves camel right and updates score display', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const before = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="5"]').click();
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toHaveValue('5');
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const after = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    expect(after).toBeGreaterThan(before);
  });

  test('exact score moves right then left', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    const at0 = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('20');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const at20 = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('5');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const at5 = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    expect(at20).toBeGreaterThan(at0);
    expect(at5).toBeLessThan(at20);
  });

  test('changing count to 6 adds lanes', async ({ page }) => {
    await page.locator('#camelCount').fill('6');
    await page.locator('#camelCount').blur();
    await expect(page.locator('.lane')).toHaveCount(6);
  });

  test('+1 and +10 move camels right and update score display', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const before = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="1"]').click();
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toHaveValue('1');
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="10"]').click();
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toHaveValue('11');
    await expect.poll(() => page.evaluate(() => GameDebug.isSettled())).toBe(true);
    const after = await page.evaluate(() => GameDebug.getCamelSpriteBounds()[0].left);
    expect(after).toBeGreaterThan(before);
  });

  test('camel count clamps to 2-8 and keeps low lanes', async ({ page }) => {
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('7');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await page.locator('#camelCount').fill('99');
    await page.locator('#camelCount').blur();
    await expect(page.locator('.lane')).toHaveCount(8);
    await expect(page.locator('#camelCount')).toHaveValue('8');
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toHaveValue('7');
    await page.locator('#camelCount').fill('1');
    await page.locator('#camelCount').blur();
    await expect(page.locator('.lane')).toHaveCount(2);
    await expect(page.locator('#camelCount')).toHaveValue('2');
    await expect(page.locator('.lane').nth(0).locator('[data-exact]')).toHaveValue('7');
  });

  test('goal input enforces 1-10000 bounds', async ({ page }) => {
    await page.locator('#goalScore').fill('50000');
    await page.locator('#goalScore').blur();
    expect(await page.evaluate(() => GameCore.getState().goalScore)).toBe(200);
    await expect(page.locator('#goalScore')).toHaveValue('200');
    await page.locator('#goalScore').fill('0');
    await page.locator('#goalScore').blur();
    expect(await page.evaluate(() => GameCore.getState().goalScore)).toBe(200);
    await page.locator('#goalScore').fill('1');
    await page.locator('#goalScore').blur();
    expect(await page.evaluate(() => GameCore.getState().goalScore)).toBe(1);
    await page.locator('#goalScore').fill('10000');
    await page.locator('#goalScore').blur();
    expect(await page.evaluate(() => GameCore.getState().goalScore)).toBe(10000);
  });

  test('infinite checkbox disables goal and restores last goal', async ({ page }) => {
    await page.locator('#goalScore').fill('777');
    await page.locator('#goalScore').blur();
    await page.locator('#infinite').check();
    await expect(page.locator('#goalScore')).toBeDisabled();
    let s = await page.evaluate(() => GameCore.getState());
    expect(s.infinite).toBe(true);
    expect(s.goalScore).toBe(null);
    await page.locator('#infinite').uncheck();
    await expect(page.locator('#goalScore')).toBeEnabled();
    s = await page.evaluate(() => GameCore.getState());
    expect(s.infinite).toBe(false);
    expect(s.goalScore).toBe(777);
    await expect(page.locator('#goalScore')).toHaveValue('777');
  });

  test('canvas accessible label localizes', async ({ page }) => {
    await expect(page.locator('#game')).toHaveAttribute('aria-label',
      'Camel race track. Camels race left to right to the goal.');
    await page.locator('#lang-de').click();
    await expect(page.locator('#game')).toHaveAttribute('aria-label',
      'Kamelrennen. Kamele rennen von links nach rechts zum Ziel.');
  });

  test('invalid exact score shows hint and keeps score', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('-3');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#validation')).toBeVisible();
    await expect(page.locator('#validation')).toHaveText('Enter a whole number ≥ 0.');
    const score = await page.evaluate(() => GameCore.getState().camels[0].score);
    expect(score).toBe(0);
  });

  test('invalid exact score rejects floats', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    await expect(page.locator('#validation')).toBeHidden();
    expect(await page.evaluate(() => GameCore.getState().camels[0].score)).toBe(0);
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('1.5');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#validation')).toBeVisible();
    await expect(page.locator('#validation')).toHaveText('Enter a whole number ≥ 0.');
    expect(await page.evaluate(() => GameCore.getState().camels[0].score)).toBe(0);
  });

  test('invalid exact score rejects empty input', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    await expect(page.locator('#validation')).toBeHidden();
    expect(await page.evaluate(() => GameCore.getState().camels[0].score)).toBe(0);
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#validation')).toBeVisible();
    await expect(page.locator('#validation')).toHaveText('Enter a whole number ≥ 0.');
    expect(await page.evaluate(() => GameCore.getState().camels[0].score)).toBe(0);
  });

  test('validation hint localizes when switching language', async ({ page }) => {
    await page.evaluate(() => { GameCore.setCamelCount(4); GameCore.resetRace(); });
    await page.locator('.lane').nth(0).locator('[data-exact]').fill('-3');
    await page.locator('.lane').nth(0).locator('[data-action="set"]').click();
    await expect(page.locator('#validation')).toHaveText('Enter a whole number ≥ 0.');
    await page.locator('#lang-de').click();
    await expect(page.locator('#validation')).toBeVisible();
    await expect(page.locator('#validation')).toHaveText('Bitte eine ganze Zahl ≥ 0 eingeben.');
    await page.locator('#lang-en').click();
    await expect(page.locator('#validation')).toHaveText('Enter a whole number ≥ 0.');
  });

  test('EN/DE toggle switches visible strings', async ({ page }) => {
    await page.locator('#lang-de').click();
    await expect(page.locator('#newRace')).toHaveText('Neues Rennen');
    await expect(page.locator('#goalLabel')).toHaveText('Ziel');
    await expect(page.locator('#camelCountLabel')).toHaveText('Kamele');
    await expect(page.locator('.lane').nth(0).locator('[data-name]')).toHaveText('Kamel 1');
    await expect(page.locator('.lane').nth(0).locator('[data-score-label]')).toHaveText('Punktzahl');
    await expect(page.locator('.lane').nth(0).locator('[data-action="set"]')).toHaveText('Setzen');
    await expect(page.locator('#lang-de')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#lang-en')).toHaveAttribute('aria-pressed', 'false');
  });

  test('language toggle preserves config', async ({ page }) => {
    await page.locator('#goalScore').fill('777');
    await page.locator('#goalScore').blur();
    await page.locator('#lang-de').click();
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.goalScore).toBe(777);
    expect(s.camelCount).toBe(4);
  });

  test('New race resets scores and keeps config', async ({ page }) => {
    await page.locator('#camelCount').fill('5');
    await page.locator('#camelCount').blur();
    await page.locator('#lang-de').click();
    await page.locator('.lane').nth(0).locator('[data-action="add"][data-n="10"]').click();
    await page.locator('.lane').nth(1).locator('[data-exact]').fill('12');
    await page.locator('.lane').nth(1).locator('[data-action="set"]').click();
    await page.locator('#newRace').click();
    const s = await page.evaluate(() => GameCore.getState());
    expect(s.camels.map((c) => c.score)).toEqual([0, 0, 0, 0, 0]);
    expect(s.camelCount).toBe(5);
    expect(s.goalScore).toBe(200);
    expect(s.language).toBe('de');
    await expect(page.locator('.lane')).toHaveCount(5);
    await expect(page.locator('#newRace')).toHaveText('Neues Rennen');
  });
});
