import { test, expect } from '@playwright/test';

/**
 * Programs — diagnóstico visual: verifica que la sección monte, que la
 * isla GSAP hidrate (mask paths poblados, ghosts inyectados, height set)
 * y que --scroll-progress se actualice al scrollear.
 */

test.describe('Programs — animación scroll-driven', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('diagnóstico completo: estado inicial + scroll', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    const section = page.locator('section.ProgramsSection');
    await expect(section).toBeAttached();

    // Snapshot del estado pre-hidratación
    const preHydration = await section.evaluate((el) => {
      const items = el.querySelectorAll('[data-program]');
      const ghosts = el.querySelectorAll('[data-ghost]');
      const mask = el.querySelector('[data-mask-outer]') as SVGPathElement | null;
      const inner = el.querySelector('[data-mask-inner]') as SVGPathElement | null;
      return {
        sectionHeight: getComputedStyle(el).height,
        heightVar: el.style.getPropertyValue('--height'),
        scrollProgress: el.style.getPropertyValue('--scroll-progress'),
        itemsCount: items.length,
        ghostsCount: ghosts.length,
        maskOuterD: mask?.getAttribute('d') ?? '',
        maskInnerD: inner?.getAttribute('d') ?? '',
        firstItemTransform: items[0]
          ? getComputedStyle(items[0] as HTMLElement).transform
          : '',
        firstItemProgress: items[0]
          ? (items[0] as HTMLElement).style.getPropertyValue('--progress')
          : '',
      };
    });
    console.log('PRE-HYDRATION:', JSON.stringify(preHydration, null, 2));

    // Forzar entrada al viewport para que client:visible hidrate
    await section.scrollIntoViewIfNeeded();
    // Dar tiempo a GSAP/ScrollTrigger
    await page.waitForTimeout(1500);

    const postHydration = await section.evaluate((el) => {
      const items = el.querySelectorAll('[data-program]');
      const ghosts = el.querySelectorAll('[data-ghost]');
      const mask = el.querySelector('[data-mask-outer]') as SVGPathElement | null;
      const inner = el.querySelector('[data-mask-inner]') as SVGPathElement | null;
      const lines = el.querySelector('[data-mask-lines]') as SVGPathElement | null;
      const ruler = el.querySelector('[data-ruler]') as HTMLElement | null;
      const rulerRect = ruler?.getBoundingClientRect();
      return {
        heightVar: el.style.getPropertyValue('--height'),
        scrollProgress: el.style.getPropertyValue('--scroll-progress'),
        itemsCount: items.length,
        ghostsCount: ghosts.length,
        maskOuterD: (mask?.getAttribute('d') ?? '').slice(0, 80),
        maskInnerD: (inner?.getAttribute('d') ?? '').slice(0, 80),
        maskLinesD: (lines?.getAttribute('d') ?? '').slice(0, 60),
        rulerRect: rulerRect
          ? {
              x: Math.round(rulerRect.x),
              y: Math.round(rulerRect.y),
              w: Math.round(rulerRect.width),
              h: Math.round(rulerRect.height),
            }
          : null,
        firstItemProgress: items[0]
          ? (items[0] as HTMLElement).style.getPropertyValue('--progress')
          : '',
        firstItemHasInview: items[0]
          ? (items[0] as HTMLElement).hasAttribute('data-inview')
          : false,
      };
    });
    console.log('POST-HYDRATION:', JSON.stringify(postHydration, null, 2));

    // Screenshot del estado inicial centrado en la sección
    await page.screenshot({
      path: 'test-results/programs-initial.png',
      fullPage: false,
    });

    // Scrollear progresivamente y muestrear --scroll-progress
    const sectionBox = await section.boundingBox();
    const sectionTop = sectionBox!.y + (await page.evaluate(() => window.scrollY));
    const sectionH = sectionBox!.height;

    const samples: Array<{
      scrollY: number;
      progress: string;
      reveal: string;
      maskScale: string;
      firstItemProgress: string;
    }> = [];
    for (let i = 0; i <= 5; i++) {
      const targetY = sectionTop + (sectionH * i) / 5 - 200;
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }), targetY);
      await page.waitForTimeout(400);
      const sample = await section.evaluate((el) => {
        const items = el.querySelectorAll('[data-program]');
        return {
          scrollY: window.scrollY,
          progress: el.style.getPropertyValue('--scroll-progress'),
          reveal: el.style.getPropertyValue('--reveal'),
          maskScale: el.style.getPropertyValue('--mask-scale'),
          firstItemProgress: items[0]
            ? (items[0] as HTMLElement).style.getPropertyValue('--progress')
            : '',
        };
      });
      samples.push(sample);

      // Screenshot intermedio
      await page.screenshot({
        path: `test-results/programs-scroll-${i}.png`,
        fullPage: false,
      });
    }
    console.log('SCROLL SAMPLES:', JSON.stringify(samples, null, 2));

    console.log('CONSOLE ERRORS:', errors);

    // Aserciones — mínimas, sólo para fallar si nada hidrata
    expect(postHydration.itemsCount).toBe(6);
    expect(postHydration.heightVar, 'height var debería estar seteado').not.toBe('');
    expect(postHydration.maskOuterD, 'mask outer path debería estar lleno').not.toBe('');
    expect(postHydration.ghostsCount, 'ghosts deberían estar inyectados').toBeGreaterThan(0);
    expect(errors, 'no debería haber errores de consola').toHaveLength(0);
  });
});
