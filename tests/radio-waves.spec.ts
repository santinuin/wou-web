import { test, expect } from '@playwright/test';

test('RadioWaves — bump viaja de derecha a izquierda vía morfeo de path', async ({ page }) => {
  await page.goto('/');

  const svg = page.locator('div.opacity-80 svg').first();
  await expect(svg).toBeVisible();
  await expect(svg.locator('path')).toHaveCount(14);

  // Esperar a que client:idle hidrate y el tween arranque
  await page.waitForTimeout(1500);

  const getDAttrs = () =>
    svg.evaluate((el) =>
      Array.from(el.querySelectorAll('[data-top]')).map(
        (p) => (p as SVGPathElement).getAttribute('d') ?? ''
      )
    );

  const d1 = await getDAttrs();
  expect(d1).toHaveLength(7);

  await page.waitForTimeout(500);
  const d2 = await getDAttrs();

  // El atributo d de al menos un path debe haber cambiado (bump se movió)
  expect(d1.some((v, i) => v !== d2[i])).toBe(true);

  await page.locator('div.opacity-80').screenshot({ path: 'test-results/radio-waves.png' });
});
