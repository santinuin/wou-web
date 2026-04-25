import { test } from '@playwright/test';

test('NewsGrid — sticky reveal', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);

  const reveal = page.locator('.NGReveal');
  const box    = await reveal.boundingBox();
  if (!box) { console.log('NGReveal no encontrado'); return; }

  console.log(`NGReveal: top=${box.y.toFixed(0)} height=${box.height.toFixed(0)}`);

  const vh       = page.viewportSize()!.height;
  const revealVH = 0.85;

  // Justo antes de entrar al reveal
  await page.evaluate((y) => window.scrollTo(0, y), box.y - 20);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'tests/screenshots/ng-0-before.png' });

  // 20 % del reveal (levemente visible)
  await page.evaluate((y) => window.scrollTo(0, y), box.y + vh * revealVH * 0.2);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'tests/screenshots/ng-1-20pct.png' });

  // 50 % (mitad)
  await page.evaluate((y) => window.scrollTo(0, y), box.y + vh * revealVH * 0.5);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'tests/screenshots/ng-2-50pct.png' });

  // 85 % (casi completo)
  await page.evaluate((y) => window.scrollTo(0, y), box.y + vh * revealVH * 0.85);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'tests/screenshots/ng-3-85pct.png' });

  // 100 % (reveal completo, sticky liberado)
  await page.evaluate((y) => window.scrollTo(0, y), box.y + vh * revealVH + 10);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'tests/screenshots/ng-4-done.png' });

  console.log('Screenshots guardados en tests/screenshots/ng-*.png');
});
