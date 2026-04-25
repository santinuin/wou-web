import { test, expect } from '@playwright/test';
import path from 'path';

test('NewsGrid — diagnóstico visual', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Screenshot de la página completa para ver dónde está NewsGrid
  await page.screenshot({
    path: path.join('tests', 'screenshots', 'newsgrid-full.png'),
    fullPage: true,
  });

  // Revisar si el contenedor existe en el DOM
  const gridHandle = page.locator('.NewsGrid');
  const gridCount = await gridHandle.count();
  console.log('NewsGrid en DOM:', gridCount);

  // Comprobar cuántas bandas de noticias se renderizaron
  const bands = await page.locator('.NewsBand').count();
  const ads1  = await page.locator('.AdsBand1').count();
  const ads2  = await page.locator('.AdsBand2').count();
  const reels = await page.locator('.ReelsBand').count();
  console.log('NewsBand:', bands, '| AdsBand1:', ads1, '| AdsBand2:', ads2, '| ReelsBand:', reels);

  // Si no hay bandas, verificar si hay artículos en las categorías esperadas
  const html = await page.content();
  const hasNewsgrid = html.includes('NewsGrid');
  console.log('Clase NewsGrid en HTML:', hasNewsgrid);

  // Obtener errores de consola del browser
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Scroll hasta el área donde debería estar NewsGrid (después de TransitionSection)
  await page.evaluate(() => {
    const el = document.querySelector('.NewsGrid');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join('tests', 'screenshots', 'newsgrid-viewport.png'),
  });

  // Imprimir la posición del NewsGrid en la página
  const boundingBox = await gridHandle.first().boundingBox();
  console.log('BoundingBox NewsGrid:', JSON.stringify(boundingBox));

  // Verificar colecciones: buscar indicadores de que el fetch de Sanity falló
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const hasPolitica  = bodyText.toLowerCase().includes('política') || bodyText.toLowerCase().includes('politica');
  const hasLocales   = bodyText.toLowerCase().includes('locales');
  console.log('Texto "Política" en página:', hasPolitica);
  console.log('Texto "Locales" en página:', hasLocales);

  console.log('Errores de consola:', consoleErrors);
});
