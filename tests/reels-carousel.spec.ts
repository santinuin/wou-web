import { test, expect } from '@playwright/test';

test.describe('ReelsCarousel — debug', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('la sección ReelsBand existe y no bloquea el scroll vertical', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. ¿Existe la sección?
    const section = page.locator('.ReelsBand');
    const sectionCount = await section.count();
    console.log('ReelsBand count:', sectionCount);

    if (sectionCount === 0) {
      console.log('ReelsBand NO existe — items.length === 0 o fetch falló');
      return;
    }

    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/reels-01-section-visible.png' });

    // 2. ¿Cuántos cards hay?
    const cards = page.locator('.rc-item');
    const cardCount = await cards.count();
    console.log('rc-item count:', cardCount);

    // 3. Dimensiones del track
    const trackBox = await page.locator('.rc-track').boundingBox();
    console.log('rc-track boundingBox:', trackBox);

    // 4. ¿Las imágenes tienen src?
    const imgs = page.locator('.rc-play-btn img');
    const imgCount = await imgs.count();
    const firstSrc = imgCount > 0 ? await imgs.first().getAttribute('src') : 'N/A';
    console.log('images count:', imgCount, '— first src:', firstSrc);

    // 5. Medir si bloquea scroll vertical
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    console.log('scrollY before wheel:', scrollBefore, '→ after:', scrollAfter);
    const scrollDelta = scrollAfter - scrollBefore;
    console.log('scroll delta (should be > 0):', scrollDelta);

    // 6. Screenshot tras scroll
    await page.screenshot({ path: 'test-results/reels-02-after-scroll.png' });

    // 7. Verificaciones
    expect(cardCount, 'Debería haber al menos 1 card').toBeGreaterThan(0);
    expect(scrollDelta, 'El wheel debería mover la página hacia abajo').toBeGreaterThan(0);
  });

  test('el carousel scroll horizontal funciona', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const section = page.locator('.ReelsBand');
    if (await section.count() === 0) {
      console.log('ReelsBand no existe, skip');
      return;
    }

    await section.scrollIntoViewIfNeeded();
    const track = page.locator('.rc-track');
    const trackBox = await track.boundingBox();
    if (!trackBox) { console.log('track no visible'); return; }

    const scrollLeftBefore = await track.evaluate((el) => (el as HTMLElement).scrollLeft);
    console.log('track.scrollLeft before:', scrollLeftBefore);

    // Botón siguiente
    const btnNext = page.locator('.rc-btn--next');
    const btnDisabled = await btnNext.getAttribute('disabled');
    console.log('rc-btn--next disabled:', btnDisabled);

    if (btnDisabled === null) {
      await btnNext.click();
      await page.waitForTimeout(500);
      const scrollLeftAfter = await track.evaluate((el) => (el as HTMLElement).scrollLeft);
      console.log('track.scrollLeft after click next:', scrollLeftAfter);
      expect(scrollLeftAfter).toBeGreaterThan(scrollLeftBefore);
    }

    await page.screenshot({ path: 'test-results/reels-03-after-next.png' });
  });

  test('click en una card lanza el iframe de YouTube', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const section = page.locator('.ReelsBand');
    if (await section.count() === 0) { return; }

    await section.scrollIntoViewIfNeeded();
    const firstPlayBtn = page.locator('.rc-play-btn').first();
    if (await firstPlayBtn.count() === 0) { return; }

    await firstPlayBtn.click();
    await page.waitForTimeout(500);

    const iframe = page.locator('.rc-player iframe');
    const iframeCount = await iframe.count();
    console.log('iframe count after click:', iframeCount);

    if (iframeCount > 0) {
      const src = await iframe.getAttribute('src');
      console.log('iframe src:', src);
      expect(src).toContain('youtube.com/embed');
      expect(src).toContain('autoplay=1');
    }

    await page.screenshot({ path: 'test-results/reels-04-playing.png' });
    expect(iframeCount, 'Debería aparecer un iframe de YouTube al hacer click').toBeGreaterThan(0);
  });
});
