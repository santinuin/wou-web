import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Test visual de scroll completo — ida y vuelta.
 * Captura screenshots en puntos clave para detectar layout bugs.
 */

const SHOTS_DIR = path.join(process.cwd(), 'tests/screenshots');

test('scroll completo ida y vuelta — detectar layout bugs', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // dar tiempo a GSAP

  const vh = await page.evaluate(() => window.innerHeight);

  // ── SCROLL HACIA ABAJO ────────────────────────────────────────────────────

  // 1. Estado inicial
  await page.screenshot({ path: `${SHOTS_DIR}/01-inicio.png`, fullPage: false });

  // 2. Mitad de la animación (transición al 50%)
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 1.5);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS_DIR}/02-transicion-50pct.png`, fullPage: false });

  // 3. Fin de la animación (100% del scrub)
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 2);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS_DIR}/03-transicion-completa.png`, fullPage: false });

  // 4. Scroll muerto del wrapper (newsGrid debería estar fijo arriba)
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 2.5);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS_DIR}/04-scroll-muerto.png`, fullPage: false });

  // 5. Fin del wrapper — stallWrap se libera (este es el momento crítico)
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 3);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS_DIR}/05-wrapper-fin.png`, fullPage: false });

  // 6. Dentro del newsGrid en flujo normal
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 4);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS_DIR}/06-newsgrid-normal.png`, fullPage: false });

  // 7. RedCircle — verificar que aparece en el lugar correcto
  const redCircleTop = await page.evaluate(() => {
    const el = document.querySelector('.RedCircleSection');
    return el ? el.getBoundingClientRect().top + window.scrollY : null;
  });

  if (redCircleTop !== null) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), redCircleTop);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS_DIR}/07-redcircle.png`, fullPage: false });
  }

  // ── SCROLL HACIA ARRIBA (vuelta) ─────────────────────────────────────────

  // 8. Volver al newsGrid
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 4);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS_DIR}/08-vuelta-newsgrid.png`, fullPage: false });

  // 9. Volver al inicio del wrapper
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 2.5);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS_DIR}/09-vuelta-scroll-muerto.png`, fullPage: false });

  // 10. Volver durante la transición
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 1.5);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS_DIR}/10-vuelta-transicion.png`, fullPage: false });

  // 11. Inicio de vuelta
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SHOTS_DIR}/11-vuelta-inicio.png`, fullPage: false });

  // ── ASSERTIONS DE LAYOUT ─────────────────────────────────────────────────

  // Verificar que RedCircle está donde debería (después del newsGrid, no antes)
  const { newsGridBottom, redCircleTop: rcTop } = await page.evaluate(() => {
    const ng = document.querySelector('.TSec-stall-wrap, .NewsGrid');
    const rc = document.querySelector('.RedCircleSection');
    return {
      newsGridBottom: ng ? ng.getBoundingClientRect().bottom + window.scrollY : null,
      redCircleTop:   rc ? rc.getBoundingClientRect().top  + window.scrollY : null,
    };
  });

  console.log(`newsGridBottom: ${newsGridBottom}px, redCircleTop: ${rcTop}px`);

  expect(newsGridBottom, 'newsGridBottom no encontrado').not.toBeNull();
  expect(rcTop,          'RedCircleSection no encontrada').not.toBeNull();
  expect(rcTop!, `RedCircle (${rcTop}px) aparece ANTES del newsGrid (${newsGridBottom}px)`).toBeGreaterThanOrEqual(newsGridBottom! - 5);

  // Verificar que al volver a scroll 0 la transición se ve correctamente
  const stallWrapOpacity = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.TSec-stall-wrap');
    return el ? window.getComputedStyle(el).opacity : null;
  });
  // Al volver al inicio, el scrub revierte la animación → stallWrap vuelve a opacity 0
  expect(parseFloat(stallWrapOpacity ?? '1')).toBeLessThan(0.1);
});
