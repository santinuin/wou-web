import { test, expect } from '@playwright/test';

/**
 * Verifica la animación de transición:
 *  1. NewsGrid empieza invisible (opacity 0, scale 0.97) — fade desde el fondo
 *  2. NewsGrid es opaco tras la transición completa
 *  3. Scroll stall — el NewsGrid queda fijo en el top durante ~50vh de scroll extra
 */

test.describe('TransitionAnimation — NewsGrid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Esperar a que el componente Svelte monte y GSAP inicialice
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLElement>('.NewsGrid');
      if (!el) return false;
      // GSAP setea opacity a '0' inline via style
      return el.style.opacity === '0' || el.style.transform !== '';
    }, { timeout: 10_000 });
  });

  test('1. NewsGrid inicia con opacity 0 (invisible antes de la transición)', async ({ page }) => {
    const opacity = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.NewsGrid');
      return el ? parseFloat(window.getComputedStyle(el).opacity) : -1;
    });
    expect(opacity, 'NewsGrid debe empezar invisible').toBeCloseTo(0, 1);
  });

  test('2. NewsGrid tiene scale < 1 inicial (efecto profundidad)', async ({ page }) => {
    const scaleX = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.NewsGrid');
      if (!el) return -1;
      const matrix = new DOMMatrix(window.getComputedStyle(el).transform);
      return matrix.a; // scaleX
    });
    // scale 0.97 → matrix.a ≈ 0.97
    expect(scaleX, 'NewsGrid debe tener scale inicial < 1 para el efecto profundidad').toBeLessThan(0.99);
    expect(scaleX).toBeGreaterThan(0.90); // razonable
  });

  test('3. NewsGrid es completamente visible tras la transición', async ({ page }) => {
    const vh = await page.evaluate(() => window.innerHeight);

    // Scroll hasta pasada la wrapper (200vh) para completar la animación
    await page.evaluate((scrollTo) => window.scrollTo({ top: scrollTo, behavior: 'instant' }), vh * 3);

    // Esperar que el scrub (1.2s) alcance 100% de progress
    await page.waitForTimeout(2000);

    const { opacity, scaleX } = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.NewsGrid');
      if (!el) return { opacity: -1, scaleX: -1 };
      const cs = window.getComputedStyle(el);
      const matrix = new DOMMatrix(cs.transform);
      return { opacity: parseFloat(cs.opacity), scaleX: matrix.a };
    });

    expect(opacity, 'NewsGrid debe ser opaco al terminar la transición').toBeGreaterThan(0.9);
    expect(scaleX,  'NewsGrid debe llegar a scale 1 al terminar la transición').toBeGreaterThan(0.99);
  });

  test('4. Scroll stall — NewsGrid queda fijo debajo del header durante ~50vh extra', async ({ page }) => {
    const vh = await page.evaluate(() => window.innerHeight);

    // Completar la transición
    await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 3);
    await page.waitForTimeout(2000);

    const headerH = await page.evaluate(() =>
      document.getElementById('siteHeader')?.offsetHeight ?? 0
    );

    // Scroll para que el stallWrap llegue al top del viewport
    const stallDocTop = await page.evaluate(() => {
      const el = document.querySelector('.TSec-stall-wrap') ?? document.querySelector('.NewsGrid');
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    });
    if (stallDocTop === null) throw new Error('.TSec-stall-wrap no encontrado');

    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), stallDocTop);
    await page.waitForTimeout(400);

    const topAtPinStart = await page.evaluate(() =>
      document.querySelector('.NewsGrid')?.getBoundingClientRect().top ?? null
    );

    // Scroll 40vh adicional (dentro del stall de 50vh)
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), vh * 0.4);
    await page.waitForTimeout(300);

    const topDuringStall = await page.evaluate(() =>
      document.querySelector('.NewsGrid')?.getBoundingClientRect().top ?? null
    );

    expect(topAtPinStart).not.toBeNull();
    expect(topDuringStall).not.toBeNull();

    const drift = Math.abs((topDuringStall ?? 0) - (topAtPinStart ?? 0));
    expect(drift, `NewsGrid se movió ${drift.toFixed(1)}px — el stall no está activo`).toBeLessThan(5);

    expect(topAtPinStart!, `NewsGrid (top=${topAtPinStart}px) debe quedar debajo del header (${headerH}px)`).toBeGreaterThanOrEqual(headerH - 5);
  });
});
