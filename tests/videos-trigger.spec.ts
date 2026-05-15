import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Diagnóstico: ¿por qué la animación de Videos se dispara antes?
 *
 * Hipótesis principal: el placeholder del stallWrap no tiene la misma
 * altura que el stallWrap en modo static → layout shift → el ScrollTrigger
 * de Videos se calculó con una posición distinta a la real.
 *
 * Mediciones clave:
 *   A) Posición de VideosSection en el DOM antes de que onEnter dispare
 *   B) Posición de VideosSection después de que onEnter dispare (layout shift)
 *   C) A qué scroll comienza visualmente la animación (mask scale != 1)
 *   D) A qué scroll *debería* comenzar según la posición real de la sección
 */

const SHOTS = path.join(process.cwd(), 'tests/screenshots');

test('diagnóstico: layout shift + trigger point de Videos', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // GSAP + client:idle

  const vh = 800;

  // ── A) Mediciones antes de onEnter (stallWrap aún fixed) ─────────────
  const before = await page.evaluate(() => {
    const wrapper     = document.querySelector<HTMLElement>('.TSec-wrapper');
    const placeholder = document.querySelector<HTMLElement>('.TSec-stall-placeholder');
    const stallWrap   = document.querySelector<HTMLElement>('.TSec-stall-wrap');
    const videos      = document.querySelector<HTMLElement>('.VideosSection');
    const newsGrid    = document.querySelector<HTMLElement>('.NewsGrid');
    const header      = document.getElementById('siteHeader');

    return {
      wrapperBottom:       wrapper  ? wrapper.getBoundingClientRect().bottom  + window.scrollY : null,
      placeholderHeight:   placeholder ? parseFloat(placeholder.style.height) : null,
      stallWrapPos:        stallWrap ? window.getComputedStyle(stallWrap).position : null,
      stallWrapPaddingTop: stallWrap ? parseFloat(window.getComputedStyle(stallWrap).paddingTop) : null,
      newsGridScrollH:     newsGrid ? newsGrid.scrollHeight : null,
      headerHeight:        header   ? header.offsetHeight : null,
      videosTop:           videos   ? videos.getBoundingClientRect().top + window.scrollY : null,
      videosHeight:        videos   ? videos.offsetHeight : null,
      scrollY:             window.scrollY,
    };
  });
  console.log('\n── ANTES de onEnter ──');
  console.log(JSON.stringify(before, null, 2));

  // ── Scroll hasta onEnter (wrapper.bottom = viewport.top) ─────────────
  const onEnterScroll = (before.wrapperBottom ?? 0) - 1;
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), onEnterScroll);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/vt-01-pre-onenter.png`, fullPage: false });

  // Cruzar onEnter
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), (before.wrapperBottom ?? 0) + 10);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/vt-02-post-onenter.png`, fullPage: false });

  // ── B) Mediciones después de onEnter (stallWrap static) ──────────────
  const after = await page.evaluate(() => {
    const stallWrap = document.querySelector<HTMLElement>('.TSec-stall-wrap');
    const videos    = document.querySelector<HTMLElement>('.VideosSection');

    return {
      stallWrapPos:        stallWrap ? window.getComputedStyle(stallWrap).position : null,
      stallWrapHeight:     stallWrap ? stallWrap.offsetHeight : null,
      stallWrapPaddingTop: stallWrap ? parseFloat(window.getComputedStyle(stallWrap).paddingTop) : null,
      videosTop:           videos ? videos.getBoundingClientRect().top + window.scrollY : null,
      scrollY:             window.scrollY,
    };
  });
  console.log('\n── DESPUÉS de onEnter ──');
  console.log(JSON.stringify(after, null, 2));

  const layoutShift = (after.videosTop ?? 0) - (before.videosTop ?? 0);
  console.log(`\n⚠ Layout shift de Videos: ${layoutShift.toFixed(1)}px`);
  if (Math.abs(layoutShift) > 5) {
    console.log(`  → El ScrollTrigger se calculó con Videos en ${before.videosTop?.toFixed(0)}px`);
    console.log(`    pero ahora está en ${after.videosTop?.toFixed(0)}px`);
    console.log(`    Desfase: ${layoutShift.toFixed(1)}px → animación dispara ${layoutShift > 0 ? 'antes' : 'después'} de lo esperado`);
  } else {
    console.log('  ✓ Sin layout shift significativo');
  }

  // ── C) Buscar el scroll donde la máscara empieza a moverse ───────────
  const videosTopAfter = after.videosTop ?? 0;
  const animStartExpected = videosTopAfter - vh * 0.25; // start: 'top 25%'

  // Ir al punto esperado de inicio de animación
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), animStartExpected);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/vt-03-anim-start-expected.png`, fullPage: false });

  const maskAtExpected = await page.evaluate(() => {
    const maskEl = document.querySelector<HTMLElement>('[data-mask]');
    return maskEl ? window.getComputedStyle(maskEl).transform : null;
  });
  console.log(`\n── En scroll esperado de inicio (${animStartExpected.toFixed(0)}px) ──`);
  console.log(`Mask transform: ${maskAtExpected}`);

  // Ir 200px antes del inicio esperado para ver si ya arrancó
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), animStartExpected - 200);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/vt-04-anim-200px-before.png`, fullPage: false });

  const maskBefore = await page.evaluate(() => {
    const maskEl = document.querySelector<HTMLElement>('[data-mask]');
    return maskEl ? window.getComputedStyle(maskEl).transform : null;
  });
  console.log(`\n── 200px antes del inicio esperado ──`);
  console.log(`Mask transform: ${maskBefore}`);

  // ── D) Progreso real al inicio del viewport de Videos ─────────────────
  await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), videosTopAfter);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/vt-05-videos-top.png`, fullPage: false });

  const stateAtTop = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('.VideosSection');
    const maskEl  = document.querySelector<HTMLElement>('[data-mask]');
    return {
      scrollProgress: section?.style.getPropertyValue('--scroll-progress'),
      maskTransform:  maskEl ? window.getComputedStyle(maskEl).transform : null,
    };
  });
  console.log(`\n── En scroll = Videos.top (${videosTopAfter.toFixed(0)}px) ──`);
  console.log(JSON.stringify(stateAtTop, null, 2));

  // ── E) Recorrer la animación en 6 puntos ─────────────────────────────
  const videosH = before.videosHeight ?? vh * 4;
  console.log('\n── Progreso de la animación (6 puntos) ──');
  for (let i = 0; i <= 5; i++) {
    const scrollTarget = animStartExpected + (videosH * i) / 5;
    await page.evaluate((s) => window.scrollTo({ top: s, behavior: 'instant' }), scrollTarget);
    await page.waitForTimeout(400);

    const state = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>('.VideosSection');
      const maskEl  = document.querySelector<HTMLElement>('[data-mask]');
      const items   = document.querySelectorAll<HTMLElement>('[data-video]');
      return {
        scrollY:        window.scrollY,
        scrollProgress: section?.style.getPropertyValue('--scroll-progress') ?? '',
        firstItemProg:  items[0]?.style.getPropertyValue('--progress') ?? '',
        maskTransform:  maskEl ? window.getComputedStyle(maskEl).transform : '',
      };
    });
    console.log(`  [${i}/5] scrollY=${state.scrollY} | sp=${state.scrollProgress} | item[0]=${state.firstItemProg}`);
    await page.screenshot({ path: `${SHOTS}/vt-anim-${i}.png`, fullPage: false });
  }

  // ── Aserciones ────────────────────────────────────────────────────────
  expect(
    Math.abs(layoutShift),
    `Layout shift de ${layoutShift.toFixed(1)}px desplaza el trigger de Videos`
  ).toBeLessThan(10);
});
