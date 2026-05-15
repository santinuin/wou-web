import { test, expect } from '@playwright/test';

/**
 * Verifica la animación de transición "mask reveal":
 *  1. El stallWrap (newsGrid) empieza invisible (opacity 0)
 *  2. El stallWrap es completamente visible tras la transición
 *  3. El stallWrap está fixed en el top durante la transición (misma posición que el TSec)
 *  4. El scroll muerto del wrapper actúa como stall — el newsGrid permanece en el top
 */

test.describe('TransitionAnimation — máscara + reveal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLElement>('.TSec-stall-wrap');
      return el != null && el.style.opacity === '0';
    }, { timeout: 10_000 });
  });

  test('1. stallWrap inicia con opacity 0 (newsGrid oculto detrás de la máscara)', async ({ page }) => {
    const opacity = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.TSec-stall-wrap');
      return el ? parseFloat(el.style.opacity) : -1;
    });
    expect(opacity).toBeCloseTo(0, 1);
  });

  test('2. stallWrap tiene position fixed y z-index 1 al inicio (detrás del TSec)', async ({ page }) => {
    const { pos, z } = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.TSec-stall-wrap');
      if (!el) return { pos: '', z: '' };
      const cs = window.getComputedStyle(el);
      return { pos: cs.position, z: cs.zIndex };
    });
    expect(pos).toBe('fixed');
    expect(Number(z)).toBe(1);
  });

  test('3. stallWrap es completamente visible tras la transición', async ({ page }) => {
    const vh = await page.evaluate(() => window.innerHeight);
    await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), vh * 3);
    await page.waitForTimeout(2000); // esperar que el scrub (1.2s) se asiente

    const opacity = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.TSec-stall-wrap');
      return el ? parseFloat(window.getComputedStyle(el).opacity) : -1;
    });
    expect(opacity).toBeGreaterThan(0.9);
  });

  test('4. Stall — newsGrid permanece en el top durante el scroll muerto del wrapper', async ({ page }) => {
    const vh = await page.evaluate(() => window.innerHeight);

    // Scroll al fin de la animación (100vh dentro del wrapper de 200vh).
    // La transición completó pero el wrapper aún no terminó → scroll muerto.
    const wrapperTop = await page.evaluate(() => {
      const w = document.querySelector('.TSec-wrapper');
      return w ? w.getBoundingClientRect().top + window.scrollY : 0;
    });
    const animEnd = wrapperTop + vh; // fin de la animación (end: +=100%)
    await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), animEnd);
    await page.waitForTimeout(1500); // esperar scrub

    // El stallWrap (fixed, opacity 1) debe estar en el top del viewport
    const topAtAnimEnd = await page.evaluate(() =>
      document.querySelector('.TSec-stall-wrap')?.getBoundingClientRect().top ?? null
    );

    // Scroll 40vh más — aún dentro del scroll muerto (wrapper tiene 100vh más)
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), vh * 0.4);
    await page.waitForTimeout(300);

    const topDuringStall = await page.evaluate(() =>
      document.querySelector('.TSec-stall-wrap')?.getBoundingClientRect().top ?? null
    );

    expect(topAtAnimEnd).not.toBeNull();
    expect(topDuringStall).not.toBeNull();

    // El stallWrap es fixed → debe quedarse en top:0 ± margen pequeño
    expect(Math.abs(topAtAnimEnd ?? 0)).toBeLessThan(5);

    const drift = Math.abs((topDuringStall ?? 0) - (topAtAnimEnd ?? 0));
    expect(drift, `stallWrap se movió ${drift.toFixed(1)}px — el stall no está activo`).toBeLessThan(5);
  });
});
