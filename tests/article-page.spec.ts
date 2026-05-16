import { test, expect, type Page } from '@playwright/test';

/**
 * Verificación visual de la página de artículo.
 * Toma screenshot full-page a 1440px y comprueba estructura base.
 *
 * El slug se fetchea en runtime contra la API de WordPress para asegurarnos
 * de probar contra un artículo realmente publicado.
 */

test.describe('Página de artículo', () => {
  let slug: string;

  test.beforeAll(async () => {
    const res = await fetch(
      'https://wou.com.ar/wp-json/wp/v2/posts?per_page=1&_fields=slug'
    );
    const posts = (await res.json()) as Array<{ slug: string }>;
    if (!posts[0]?.slug) throw new Error('No se pudo obtener slug de WordPress');
    slug = posts[0].slug;
  });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('screenshot full-page desktop', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/articulo/${slug}`, { waitUntil: 'networkidle' });

    // Esperar a que la tarjeta esté visible
    await expect(page.locator('.ArticleCard')).toBeVisible();

    // Screenshot full-page
    await page.screenshot({
      path: 'tests/screenshots/article-page-desktop.png',
      fullPage: true,
    });

    // Reportar errores de consola (no falla, solo loguea)
    if (consoleErrors.length > 0) {
      console.log('\n[console errors]\n' + consoleErrors.join('\n'));
    }
  });

  test('news list: item recortado en reposo y en hover', async ({ page }) => {
    await page.goto(`/articulo/${slug}`, { waitUntil: 'networkidle' });

    const firstItem = page.locator('.ArticlePage__related li').first();
    await firstItem.scrollIntoViewIfNeeded();
    await firstItem.waitFor({ state: 'visible' });

    // Estado en reposo
    await page.screenshot({
      path: 'tests/screenshots/article-newslist-rest.png',
      clip: await firstItem.boundingBox().then((b) => ({
        x: 0,
        y: b!.y - 10,
        width: 1440,
        height: b!.height + 20,
      })),
    });

    // Hover sobre el primer item
    await firstItem.hover();
    // Esperar a que la animación termine (transition-duration 500ms)
    await page.waitForTimeout(700);

    await page.screenshot({
      path: 'tests/screenshots/article-newslist-hover.png',
      clip: await firstItem.boundingBox().then((b) => ({
        x: 0,
        y: b!.y - 10,
        width: 1440,
        height: b!.height + 20,
      })),
    });

    // Mide cobertura del sweep (debería ser ~100% del item)
    const sweep = await firstItem
      .locator('span.absolute.inset-0')
      .first()
      .boundingBox();
    const item = await firstItem.boundingBox();
    console.log('\n[sweep coverage]');
    console.log('item:  ', item);
    console.log('sweep: ', sweep);
  });

  test('estructura básica del artículo', async ({ page }) => {
    await page.goto(`/articulo/${slug}`);

    await expect(page.locator('h1.ArticleCard__title')).toBeVisible();
    await expect(page.locator('header[role="banner"], #siteHeader')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();
  });

  test('mide anchos de tarjeta vs related vs nav', async ({ page }) => {
    await page.goto(`/articulo/${slug}`, { waitUntil: 'networkidle' });

    const card = await page.locator('.ArticleCard').boundingBox();
    const related = await page.locator('.ArticlePage__related').boundingBox();
    const nav = await page.locator('.CategoryNav').boundingBox();
    const viewport = page.viewportSize();

    console.log('\n[medidas a 1440px]');
    console.log('viewport:', viewport?.width);
    console.log('card:   ', card?.width, 'left:', card?.x);
    console.log('related:', related?.width, 'left:', related?.x);
    console.log('nav:    ', nav?.width, 'left:', nav?.x);
  });
});
