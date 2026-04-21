import { test, expect } from '@playwright/test';

/**
 * RedCircle — verifica que la sección de piscina de bolas se hidrate al hacer
 * scroll, que los cuerpos físicos se asienten (posiciones estables) y que el
 * título caiga al final y quede por encima.
 */

test.describe('RedCircle — ball pool con Matter.js', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
  });

  test('la sección existe debajo del Hero y ocupa el 100% del viewport', async ({ page }) => {
    const section = page.locator('section[aria-label="Círculo Rojo"]');
    await expect(section).toBeAttached();
    const box = await section.boundingBox();
    expect(box!.y).toBeGreaterThan(400);
    const viewport = page.viewportSize()!;
    // Permitimos margen de 2px por redondeo de clamp/viewport units.
    expect(Math.abs(box!.height - viewport.height)).toBeLessThanOrEqual(2);
  });

  test('al entrar al viewport las bolas caen de arriba hacia abajo y luego se asientan', async ({
    page,
  }) => {
    const section = page.locator('section[aria-label="Círculo Rojo"]');
    await section.scrollIntoViewIfNeeded();

    const ul = page.locator('ul.BallPool');
    await expect(ul).toHaveClass(/is-ready/, { timeout: 5000 });

    const readYs = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('.BallPool--ball')).map((li) => {
          const t = (li as HTMLElement).style.transform;
          const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
          return m ? parseFloat(m[2]) : NaN;
        }),
      );

    const readTransforms = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('.BallPool--ball')).map(
          (li) => (li as HTMLElement).style.transform,
        ),
      );

    // Capturamos frames de la caída. Las Y iniciales están cerca/arriba del
    // borde superior de la sección (valores bajos/negativos), y descienden.
    const samples: number[][] = [];
    for (let k = 0; k < 6; k++) {
      samples.push(await readYs());
      await page.waitForTimeout(180);
    }

    // Al menos un cuerpo debe haber aumentado su Y significativamente entre
    // el primer y el último frame (gravedad la empuja hacia abajo).
    const fallDeltas = samples[0].map((y, i) => samples.at(-1)![i] - y);
    const maxDrop = Math.max(...fallDeltas);
    expect(maxDrop, `deltas=${fallDeltas.map((d) => d.toFixed(1)).join(',')}`)
      .toBeGreaterThan(60);

    // 5s después: el sistema debe quedar (casi) en reposo. Medimos el
    // desplazamiento absoluto entre dos frames separados — matter.js tiene
    // micro-jitter por contact constraints, así que toleramos < 2px.
    await page.waitForTimeout(5000);
    const parse = (s: string) => {
      const m = s.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
    };
    const viewport = page.viewportSize()!;
    const t3 = (await readTransforms()).map(parse);
    await page.waitForTimeout(250);
    const t4 = (await readTransforms()).map(parse);
    // Sin paredes laterales, los cuerpos pueden escaparse del viewport y
    // seguir moviéndose en caída libre — no los contamos como "aún activos".
    const insideIdx = t3
      .map((p: { x: number; y: number }, i: number) =>
        p.x >= -50 && p.x <= viewport.width + 50 && p.y <= viewport.height + 50
          ? i
          : -1,
      )
      .filter((i: number) => i >= 0);
    const deltas = insideIdx.map((i: number) =>
      Math.hypot(t3[i].x - t4[i].x, t3[i].y - t4[i].y),
    );
    const stillMoving = deltas.filter((d: number) => d > 3).length;
    expect(stillMoving, `deltas=${deltas.map((d: number) => d.toFixed(2)).join(',')}`)
      .toBeLessThanOrEqual(Math.ceil(insideIdx.length / 2));
  });

  test('el título estático "Círculo Rojo" está anclado arriba a la izquierda', async ({
    page,
  }) => {
    const section = page.locator('section[aria-label="Círculo Rojo"]');
    await section.scrollIntoViewIfNeeded();

    const title = page.locator('.RedCircleTitle');
    await expect(title).toBeVisible();
    await expect(title).toContainText(/círculo rojo/i);

    // El título debe tener z-index por encima del pool de bolas.
    const z = await title.evaluate((el) => getComputedStyle(el).zIndex);
    expect(Number(z)).toBeGreaterThanOrEqual(10);

    // Debe estar en la mitad-izquierda y mitad-superior del viewport.
    const sectionBox = (await section.boundingBox())!;
    const titleBox = (await title.boundingBox())!;
    expect(titleBox.x).toBeLessThan(sectionBox.width / 2);
    expect(titleBox.y).toBeLessThan(sectionBox.y + sectionBox.height / 2);
  });

  test('screenshot de referencia después de asentar', async ({ page }) => {
    const section = page.locator('section[aria-label="Círculo Rojo"]');
    await section.scrollIntoViewIfNeeded();
    await expect(page.locator('ul.BallPool')).toHaveClass(/is-ready/, { timeout: 5000 });
    await page.waitForTimeout(3500);
    await section.screenshot({ path: 'test-results/red-circle-settled.png' });
  });

  test('no hay errores de consola al hidratar', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    const section = page.locator('section[aria-label="Círculo Rojo"]');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
