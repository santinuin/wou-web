import { test, expect } from '@playwright/test';

test.describe('SectionsMenu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Esperar a que el JS de las islas Svelte hidrate
    await page.waitForLoadState('networkidle');
  });

  test('el nav aparece al clickear Secciones', async ({ page }) => {
    await page.getByLabel('Ver todas las secciones').click();
    const nav = page.getByRole('navigation', { name: 'Menú de secciones' });
    await expect(nav).toBeVisible();
  });

  test('los links tienen data-color y están renderizados', async ({ page }) => {
    await page.getByLabel('Ver todas las secciones').click();
    const nav = page.getByRole('navigation', { name: 'Menú de secciones' });
    await expect(nav).toBeVisible();

    const links = nav.locator('a[data-color]');
    const count = await links.count();
    console.log('links con data-color:', count);
    expect(count).toBeGreaterThan(0);
  });

  test('diagnóstico: mide offsetLeft y clientWidth del nav antes de animar', async ({ page }) => {
    // Interceptar console.log del browser
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.getByLabel('Ver todas las secciones').click();
    const nav = page.getByRole('navigation', { name: 'Menú de secciones' });
    await expect(nav).toBeVisible();

    // Medir desde fuera (Playwright evalúa en el browser)
    const measurements = await page.evaluate(() => {
      const nav = document.querySelector('[aria-label="Menú de secciones"]') as HTMLElement | null;
      if (!nav) return { error: 'nav not found' };

      const links = Array.from(nav.querySelectorAll<HTMLElement>('a[data-color]'));
      return {
        navClientWidth: nav.clientWidth,
        navBCR: nav.getBoundingClientRect(),
        linksCount: links.length,
        firstLink: links[0] ? {
          offsetLeft: links[0].offsetLeft,
          offsetWidth: links[0].offsetWidth,
          offsetParentTag: links[0].offsetParent?.tagName,
          text: links[0].textContent?.trim(),
          computedTransform: getComputedStyle(links[0]).transform,
        } : null,
        lastLink: links[links.length - 1] ? {
          offsetLeft: links[links.length - 1].offsetLeft,
          offsetWidth: links[links.length - 1].offsetWidth,
          text: links[links.length - 1].textContent?.trim(),
          computedTransform: getComputedStyle(links[links.length - 1]).transform,
        } : null,
      };
    });

    console.log('measurements:', JSON.stringify(measurements, null, 2));

    // Esperar a que la animación termine (~1.5s) y verificar que volvió al estado original
    await page.waitForTimeout(1600);

    const afterAnim = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLElement>('[aria-label="Menú de secciones"] a[data-color]')
      );
      return links.map(l => ({
        text: l.textContent?.trim(),
        transform: getComputedStyle(l).transform,
      }));
    });

    console.log('estado post-animación:', JSON.stringify(afterAnim, null, 2));

    // Si la animación funcionó, todos los transforms deben ser none/matrix(1,0,0,1,0,0)
    for (const link of afterAnim) {
      const isReset = link.transform === 'none' || link.transform === 'matrix(1, 0, 0, 1, 0, 0)';
      console.log(`${link.text}: transform="${link.transform}" reset=${isReset}`);
    }
  });

  test('el modal se cierra al clickear fuera (backdrop)', async ({ page }) => {
    await page.getByLabel('Ver todas las secciones').click();
    await expect(page.getByRole('navigation', { name: 'Menú de secciones' })).toBeVisible();
    // Click en la mitad izquierda (fuera del nav)
    await page.mouse.click(200, 400);
    await expect(page.getByRole('navigation', { name: 'Menú de secciones' })).not.toBeVisible();
  });

  test('el modal se cierra con Escape', async ({ page }) => {
    await page.getByLabel('Ver todas las secciones').click();
    await expect(page.getByRole('navigation', { name: 'Menú de secciones' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Menú de secciones' })).not.toBeVisible();
  });
});
