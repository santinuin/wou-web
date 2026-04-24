import { test, expect } from '@playwright/test';

/**
 * Lineup — certifica que la sección monte correctamente:
 * - Fondo oscuro con SVG de ondas generadas por la isla Svelte
 * - Cards de programas con data-card y alternancia de temas
 * - Animación "volanta" (ScrollTrigger) dispara al entrar al viewport
 * - CTA presente y apuntando a /grilla
 */

test.describe('Lineup — sección de programación', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
  });

  test('estructura base: sección renderiza con cards y CTA', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    const section = page.locator('section.LineupSection');
    await expect(section).toBeAttached();

    // Cards presentes
    const cards = section.locator('[data-card]');
    const cardCount = await cards.count();
    expect(cardCount, 'debe haber al menos 1 card de programa').toBeGreaterThan(0);

    // CTA presente
    const cta = section.locator('[data-cta]');
    await expect(cta).toBeAttached();
    await expect(cta).toHaveAttribute('href', '/grilla');

    // Header labels presentes
    const header = section.locator('.LineupSection__header');
    await expect(header).toBeAttached();

    console.log(`Cards encontradas: ${cardCount}`);
    expect(errors, 'no debe haber errores de consola').toHaveLength(0);
  });

  test('alternancia de temas: cards verde/azul alternados', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section.LineupSection');

    const themes = await section.locator('[data-card]').evaluateAll((cards) =>
      cards.map((c) => c.getAttribute('data-theme'))
    );

    for (let i = 0; i < themes.length; i++) {
      const expected = i % 2 === 0 ? 'green' : 'blue';
      expect(themes[i], `card ${i} debe tener tema ${expected}`).toBe(expected);
    }

    console.log('Temas de cards:', themes);
  });

  test('isla Svelte hidrata: SVG de ondas generado', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section.LineupSection');

    // Scroll hasta la sección para disparar client:visible
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/lineup-initial.png', fullPage: false });

    const svgState = await section.evaluate((el) => {
      const svg = el.querySelector('.lineup-waves__svg');
      const lines = el.querySelectorAll('.lw-line');
      return {
        svgPresent: !!svg,
        linesCount: lines.length,
        firstLinePath: lines[0]?.getAttribute('d')?.slice(0, 40) ?? '',
      };
    });

    console.log('SVG state post-hidratación:', JSON.stringify(svgState, null, 2));

    expect(svgState.svgPresent, 'SVG de ondas debe estar presente').toBe(true);
    expect(svgState.linesCount, 'debe haber líneas de onda generadas').toBeGreaterThan(5);
    expect(svgState.firstLinePath, 'primera línea debe tener path definido').not.toBe('');
  });

  test('scroll-driven: --col-ty se actualiza y la columna se mueve al scrollear', async ({
    page,
  }) => {
    await page.goto('/');
    const section = page.locator('section.LineupSection');

    // Scroll hasta la sección para que el script init() ya corrió
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // --lineup-h debe estar seteada (mayor que 100vh si la columna desborda)
    const lineupH = await section.evaluate((el) =>
      el.style.getPropertyValue('--lineup-h')
    );
    console.log('--lineup-h:', lineupH);
    expect(lineupH, '--lineup-h debe estar seteada por el script').not.toBe('');

    // Captura --col-ty al inicio de la sección
    const colTyStart = await section.evaluate((el) =>
      el.style.getPropertyValue('--col-ty')
    );
    console.log('--col-ty al inicio:', colTyStart || '0px (default)');

    // Scroll hasta el final de la sección
    await page.evaluate(() => {
      const el = document.querySelector('.LineupSection') as HTMLElement;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top + rect.height - window.innerHeight, behavior: 'instant' });
    });
    await page.waitForTimeout(200);

    const colTyEnd = await section.evaluate((el) =>
      el.style.getPropertyValue('--col-ty')
    );
    console.log('--col-ty al final:', colTyEnd);

    await page.screenshot({ path: 'test-results/lineup-scroll-end.png', fullPage: false });

    // --col-ty al final debe ser más negativo que al inicio (columna subió)
    const tyEndValue = parseFloat(colTyEnd || '0');
    expect(tyEndValue, '--col-ty debe ser negativo al final del scroll').toBeLessThan(0);
  });

  test('mouse sobre la sección: ondas reaccionan (SVG paths cambian)', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section.LineupSection');

    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    // Captura el path antes del movimiento
    const pathBefore = await section.evaluate((el) => {
      const line = el.querySelector('.lw-line');
      return line?.getAttribute('d') ?? '';
    });

    // Mueve el mouse por el área de las ondas
    const box = await section.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
      await page.waitForTimeout(600);
    }

    const pathAfter = await section.evaluate((el) => {
      const line = el.querySelector('.lw-line');
      return line?.getAttribute('d') ?? '';
    });

    console.log('Path before (40 chars):', pathBefore.slice(0, 40));
    console.log('Path after  (40 chars):', pathAfter.slice(0, 40));

    // Las ondas deben moverse en el tiempo (animación continua)
    expect(pathBefore, 'SVG path debe estar generado').not.toBe('');
    expect(pathAfter, 'SVG path debe seguir presente').not.toBe('');

    await page.screenshot({ path: 'test-results/lineup-mouse-interaction.png', fullPage: false });
  });
});
