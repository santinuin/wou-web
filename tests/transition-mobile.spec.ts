import { test, expect } from '@playwright/test';

test('TransitionSection mobile — overlay alineado con O', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const wrapper = page.locator('.TSec-wrapper');
  const wrapperBox = await wrapper.boundingBox();
  expect(wrapperBox).toBeTruthy();

  const vh = page.viewportSize()!.height;
  const vw = page.viewportSize()!.width;
  const scrollRange = wrapperBox!.height - vh;

  // ── Frame A-end: scroll al 50% → fin de Fase A, SVG centrado ────────
  await page.evaluate(({ top, range }) => window.scrollTo(0, top + range * 0.5),
    { top: wrapperBox!.y, range: scrollRange });
  await page.waitForTimeout(500);

  const svgBox  = await page.locator('.TSec__logo svg').boundingBox();
  const overlay = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.TSec > div[style*="border-radius"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width/2, cy: r.y + r.height/2 };
  });

  const svgOCenterX = svgBox ? svgBox.x + svgBox.width  * (54.5 / 109) : null;
  const svgOCenterY = svgBox ? svgBox.y + svgBox.height * (18   / 37)   : null;

  console.log(`vw=${vw} vh=${vh}`);
  console.log(`SVG box: x=${svgBox?.x.toFixed(1)} y=${svgBox?.y.toFixed(1)} w=${svgBox?.width.toFixed(1)} h=${svgBox?.height.toFixed(1)}`);
  console.log(`O center in viewport: x=${svgOCenterX?.toFixed(1)} y=${svgOCenterY?.toFixed(1)}`);
  console.log(`Overlay center: cx=${overlay?.cx.toFixed(1)} cy=${overlay?.cy.toFixed(1)}`);
  console.log(`Delta: dx=${overlay && svgOCenterX ? (overlay.cx - svgOCenterX).toFixed(1) : '?'}  dy=${overlay && svgOCenterY ? (overlay.cy - svgOCenterY).toFixed(1) : '?'}`);

  await page.screenshot({ path: 'tests/screenshots/tmob-1-phaseA-end.png', fullPage: false });

  // ── Frame B-mid: scroll al 75% ────────────────────────────────────────
  await page.evaluate(({ top, range }) => window.scrollTo(0, top + range * 0.75),
    { top: wrapperBox!.y, range: scrollRange });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/screenshots/tmob-2-phaseB-mid.png', fullPage: false });
});
