import { test, expect } from '@playwright/test';

test.describe('Header — WindWidget spacing', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('hay espacio visible entre el pipe y el valor de viento', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('#siteHeader');
    await expect(header).toBeAttached();

    // Captura screenshot en estado expandido (scroll = 0)
    await page.screenshot({ path: 'test-results/header-wind-expanded.png', fullPage: false });

    // Mide la separación entre .header-normal y astro-island
    const gap = await page.evaluate(() => {
      const pipe = document.querySelector<HTMLElement>('.header-normal');
      const island = pipe?.nextElementSibling as HTMLElement | null;
      if (!pipe || !island) return null;
      const pipeRight = pipe.getBoundingClientRect().right;
      const islandLeft = island.getBoundingClientRect().left;
      return Math.round(islandLeft - pipeRight);
    });

    console.log('Gap pipe → WindWidget (px):', gap);
    expect(gap, 'debe haber espacio positivo entre el pipe y el widget').toBeGreaterThan(0);

    // Estado scrolled
    await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'instant' as ScrollBehavior }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/header-wind-scrolled.png', fullPage: false });
  });
});
