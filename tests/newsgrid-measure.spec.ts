import { test } from '@playwright/test';

test('medir layout de bandas y screenshot del grid', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const bands = await page.locator('.NewsBand').all();
  for (let i = 0; i < bands.length; i++) {
    const band  = bands[i];
    const hero  = band.locator('.NewsBand__hero');
    const s1    = band.locator('.NewsBand__s1');
    const s3    = band.locator('.NewsBand__s3');
    const bandBox = await band.boundingBox();
    const heroBox = await hero.boundingBox();
    const s1Box   = await s1.boundingBox();
    const s3Box   = await s3.boundingBox();

    const heroRatio = bandBox && heroBox ? ((heroBox.width / bandBox.width) * 100).toFixed(1) : '?';
    console.log(
      `Banda ${i + 1}: ${bandBox?.width}x${bandBox?.height}px` +
      ` | hero ${heroBox?.width}x${heroBox?.height} (${heroRatio}% ancho)` +
      ` | s1 ${s1Box?.width}x${s1Box?.height}` +
      ` | s3 ${s3Box?.width}x${s3Box?.height}`
    );
  }

  // Screenshot recortado solo de la sección NewsGrid
  const grid = page.locator('.NewsGrid');
  await grid.screenshot({ path: 'tests/screenshots/newsgrid-crop.png' });
  console.log('Screenshot guardado en tests/screenshots/newsgrid-crop.png');
});
