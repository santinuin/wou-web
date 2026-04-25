import { test } from '@playwright/test';

test('debug click outside', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Ver todas las secciones').click();
  await page.waitForTimeout(300);

  const info = await page.evaluate(() => {
    const el = document.elementFromPoint(200, 400);
    const nav = document.querySelector('[aria-label="Menú de secciones"]');
    return {
      tag: el?.tagName,
      href: (el as HTMLAnchorElement)?.href ?? null,
      isInsideNav: nav?.contains(el) ?? false,
      navVisible: !!nav,
    };
  });
  console.log('elemento en (200,400):', JSON.stringify(info));

  await page.mouse.click(200, 400);
  await page.waitForTimeout(400);

  const afterClick = await page.evaluate(() => ({
    navVisible: !!document.querySelector('[aria-label="Menú de secciones"]'),
    url: location.href,
  }));
  console.log('después del click:', JSON.stringify(afterClick));
});
