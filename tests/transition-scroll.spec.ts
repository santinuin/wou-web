import { test } from '@playwright/test';

test('TransitionSection — scroll driven frames', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Esperar a que el RAF arranque
  await page.waitForTimeout(300);

  const section = page.locator('.TSec');
  const sectionBox = await section.boundingBox();
  if (!sectionBox) { console.log('TSec no encontrado'); return; }

  console.log(`TSec: top=${sectionBox.y.toFixed(0)} height=${sectionBox.height.toFixed(0)}`);

  // Frame 1: inicio (antes de entrar a la sección)
  await page.evaluate((y) => window.scrollTo(0, y), sectionBox.y);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/tsec-1-start.png' });

  // Frame 2: 25% del scroll (pill a medio expandir)
  const scrollable = sectionBox.height - page.viewportSize()!.height;
  await page.evaluate((y) => window.scrollTo(0, y), sectionBox.y + scrollable * 0.25);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/tsec-2-quarter.png' });

  // Frame 3: 50% (pill llena el viewport)
  await page.evaluate((y) => window.scrollTo(0, y), sectionBox.y + scrollable * 0.5);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/tsec-3-half.png' });

  // Frame 4: 80% (headline visible y escalando)
  await page.evaluate((y) => window.scrollTo(0, y), sectionBox.y + scrollable * 0.8);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/tsec-4-headline.png' });

  // Frame 5: 100% (fin — headline grande, NewsGrid justo debajo)
  await page.evaluate((y) => window.scrollTo(0, y), sectionBox.y + scrollable);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/tsec-5-end.png' });

  console.log('Screenshots guardados en tests/screenshots/tsec-*.png');
});
