import { test, expect } from '@playwright/test';

test('TransitionSection — dos fases de scroll', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600); // RAF + fonts

  const wrapper = page.locator('.TSec-wrapper');
  const group   = page.locator('.TSec__group');
  const section = page.locator('.TSec');

  const wrapperBox = await wrapper.boundingBox();
  expect(wrapperBox, 'TSec-wrapper no encontrado').toBeTruthy();

  const vh = page.viewportSize()!.height;
  // scroll disponible = 300vh - 100vh sticky = 200vh
  const scrollRange = wrapperBox!.height - vh;

  // ── Frame 0: antes de entrar ──────────────────────────────────────────
  await page.evaluate((y) => window.scrollTo(0, y - 10), wrapperBox!.y);
  await page.waitForTimeout(300);
  const groupBefore = await group.boundingBox();
  // El grupo debe estar fuera del viewport por la derecha
  const vw = page.viewportSize()!.width;
  expect(groupBefore!.x, 'grupo debe estar desplazado a la derecha').toBeGreaterThan(vw * 0.5);
  await page.screenshot({ path: 'tests/screenshots/tv-0-before.png', fullPage: false });

  // ── Frame 1: inicio scroll — texto asomándose ────────────────────────
  await page.evaluate((y) => window.scrollTo(0, y), wrapperBox!.y);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/tv-1-peek.png', fullPage: false });

  // ── Frame 2: 25% scroll (Fase A intermedia) ──────────────────────────
  await page.evaluate(({ top, range }) => window.scrollTo(0, top + range * 0.25),
    { top: wrapperBox!.y, range: scrollRange });
  await page.waitForTimeout(400);
  const groupMid = await group.boundingBox();
  await page.screenshot({ path: 'tests/screenshots/tv-2-phaseA-mid.png', fullPage: false });

  // ── Frame 3: 50% scroll — SVG llega al centro (fin Fase A) ──────────
  await page.evaluate(({ top, range }) => window.scrollTo(0, top + range * 0.5),
    { top: wrapperBox!.y, range: scrollRange });
  await page.waitForTimeout(400);
  const svgBox = await page.locator('.TSec__logo svg').boundingBox();
  expect(svgBox, 'SVG debe ser visible').toBeTruthy();
  // El centro del SVG debe estar cerca del centro del viewport
  const svgCenterX = svgBox!.x + svgBox!.width / 2;
  expect(Math.abs(svgCenterX - vw / 2), 'SVG centrado en viewport').toBeLessThan(vw * 0.1);
  await page.screenshot({ path: 'tests/screenshots/tv-3-phaseA-end.png', fullPage: false });

  // ── Frame 4: 75% scroll (Fase B intermedia — dot creciendo) ─────────
  await page.evaluate(({ top, range }) => window.scrollTo(0, top + range * 0.75),
    { top: wrapperBox!.y, range: scrollRange });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/tv-4-phaseB-mid.png', fullPage: false });

  // ── Frame 5: 100% scroll — transición completada ────────────────────
  await page.evaluate(({ top, range }) => window.scrollTo(0, top + range),
    { top: wrapperBox!.y, range: scrollRange });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/screenshots/tv-5-end.png', fullPage: false });

  // La sección de noticias debe ser visible al terminar
  const newsGrid = page.locator('.NewsGrid');
  const ngVisible = await newsGrid.isVisible();
  expect(ngVisible, 'NewsGrid visible al final').toBe(true);

  console.log('Todos los frames capturados en tests/screenshots/tv-*.png');
  console.log(`scrollRange=${scrollRange.toFixed(0)}px  svgCenterX=${svgCenterX.toFixed(0)}  vw/2=${(vw/2).toFixed(0)}`);
});
