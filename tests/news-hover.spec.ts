import { test, expect } from '@playwright/test';

/**
 * Verifica el hover interactivo del NewsList:
 *  · fondo "barre" de arriba hacia abajo (scale-y 0 → 1)
 *  · aparece el excerpt
 *  · el título se desplaza a la derecha (el preview lo empuja)
 *
 * La miniatura se valida cuando el CMS esté conectado; aquí solo se comprueba
 * la estructura de hover sobre datos mock sin imagen.
 */
test.describe('NewsList — hover', () => {
  test('revela preview y empuja el título', async ({ page }) => {
    await page.goto('/');

    const items = page.locator('ul.flex-1 > li.group');
    await expect(items).toHaveCount(4);

    const target = items.nth(1); // "Fallo por YPF"
    const sweep = target.locator('span[aria-hidden="true"]').first();
    const preview = target.locator('a > span.flex.items-center.gap-4');
    const title = target.locator('a > span.whitespace-nowrap');

    // ── Reposo ───────────────────────────────────────────────────────────
    const sweepScaleBefore = await sweep.evaluate(
      (el) => getComputedStyle(el).scale
    );
    const previewWidthBefore = await preview.evaluate(
      (el) => el.getBoundingClientRect().width
    );
    expect(previewWidthBefore).toBeLessThan(5);

    await page.mouse.move(0, 0);
    const titleBefore = await title.boundingBox();

    // ── Hover ────────────────────────────────────────────────────────────
    await target.hover();
    await page.waitForTimeout(900); // transición de ~700ms + margen

    const sweepScaleAfter = await sweep.evaluate(
      (el) => getComputedStyle(el).scale
    );
    expect(sweepScaleAfter).not.toBe(sweepScaleBefore);

    const previewWidthAfter = await preview.evaluate(
      (el) => el.getBoundingClientRect().width
    );
    expect(previewWidthAfter).toBeGreaterThan(150);

    const excerpt = preview.locator('span', { hasText: /Lorem Ipsum/ });
    await expect(excerpt).toBeVisible();

    const titleAfter = await title.boundingBox();
    expect(titleAfter!.x).toBeGreaterThan(titleBefore!.x + 50);

    await target.screenshot({ path: 'test-results/news-hover.png' });
  });
});
