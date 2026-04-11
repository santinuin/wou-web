import { test, expect, type Page } from '@playwright/test';

/**
 * Suite de auditoría Day-One.
 * Verifica: errores de consola JS, recursos 404/5xx y A11y básica (WCAG 2.1 AA).
 *
 * Ejecutar: bun run audit
 * Reporte:  bun run audit:report
 */

const PAGES_TO_AUDIT = [
  { name: 'Home', path: '/' },
  // Agregar rutas aquí a medida que se creen
];

for (const { name, path } of PAGES_TO_AUDIT) {
  test.describe(`Auditoría: ${name} (${path})`, () => {
    let consoleErrors: string[] = [];
    let networkErrors: string[] = [];

    test.beforeEach(async ({ page }: { page: Page }) => {
      consoleErrors = [];
      networkErrors = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('response', (response) => {
        if (response.status() >= 400)
          networkErrors.push(`${response.status()} ${response.url()}`);
      });

      await page.goto(path);
    });

    test('no tiene errores de consola JS', async () => {
      expect(consoleErrors, `Errores:\n${consoleErrors.join('\n')}`).toHaveLength(0);
    });

    test('no tiene recursos 404 o 5xx', async () => {
      const critical = networkErrors.filter((e) => !e.includes('favicon'));
      expect(critical, `Errores de red:\n${critical.join('\n')}`).toHaveLength(0);
    });

    test('tiene <main id="main-content">', async ({ page }) => {
      await expect(page.locator('main#main-content')).toBeVisible();
    });

    test('tiene <header role="banner">', async ({ page }) => {
      await expect(page.locator('header[role="banner"]')).toBeVisible();
    });

    test('tiene <footer role="contentinfo">', async ({ page }) => {
      await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();
    });

    test('tiene exactamente un <h1>', async ({ page }) => {
      expect(await page.locator('h1').count()).toBe(1);
    });

    test('todas las imágenes tienen atributo alt', async ({ page }) => {
      const missing = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img'))
          .filter((img) => !img.hasAttribute('alt') || img.alt.trim() === '')
          .map((img) => img.src)
      );
      expect(missing, `Imágenes sin alt:\n${missing.join('\n')}`).toHaveLength(0);
    });

    test('todos los enlaces tienen texto accesible', async ({ page }) => {
      const empty = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a'))
          .filter((a) => {
            const text = (a.textContent ?? '').trim();
            return !text && !a.getAttribute('aria-label') && !a.getAttribute('aria-labelledby');
          })
          .map((a) => a.outerHTML.slice(0, 100))
      );
      expect(empty, `Enlaces sin texto accesible:\n${empty.join('\n')}`).toHaveLength(0);
    });

    test('el lang del documento es "es"', async ({ page }) => {
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('es');
    });

    test('tiene meta description con contenido', async ({ page }) => {
      const content = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(content).toBeTruthy();
      expect(content!.length).toBeGreaterThan(10);
    });
  });
}
