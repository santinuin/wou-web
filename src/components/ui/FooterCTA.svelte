<!--
  FooterCTA — isla interactiva del footer.

  Adaptación del CTA de wodniack.dev al branding WOU. Mantiene la estructura
  original de wodniack (botón GO + círculo que expande vía clip-path + texto
  grande animado por slices + grid SVG distorsionado) y cambia sólo paleta,
  tipografía, texto y enlaces.

  Arquitectura:
   · Isla Svelte con GSAP. Hidratada con client:visible desde Footer.astro.
   · Sin ScrollTrigger: toda la animación es reactiva a estado hover/focus.
   · gsap.ticker maneja la distorsión del grid cada frame. Se pausa cuando
     la sección está fuera del viewport o el usuario prefiere menos movimiento.

  Accesibilidad:
   · Trigger es un <button>. El estado activo se dispara por mouseenter,
     touchstart y focusin (navegable por teclado).
   · El <a mailto:> interior es tabbable: al enfocarlo, focusin reabre el CTA.
   · prefers-reduced-motion: deshabilita ticker, timeline y transiciones.
-->
<script>
  import { gsap } from 'gsap';
  import { onMount, onDestroy } from 'svelte';

  const EMAIL = 'mail@radiowou.com.ar';

  // DOM refs
  let sectionEl;
  let hoverEl;
  let ctaEl;
  let gridEl;
  let gridSvg;
  let gridPath;

  // Estado mutable fuera de reactividad Svelte (GSAP tweens leen por referencia).
  // Usamos un objeto plano (no rune) porque GSAP necesita mutar `.op` y `.progress`
  // directamente y los tweens sobre runes $sim.raw no funcionan.
  const sim = {
    wave: { progress: 0, op: 0, speed: 1.5, strength: 1 },
    grid: {
      vLines: 0, hLines: 0, gapX: 0, gapY: 0,
      width: 0, height: 0,
      points: [],
    },
    reducedMotion: false,
    waveTimeout: 0,
  };

  // `active` es reactivo para que el class:is-active se aplique vía Svelte,
  // así el compilador no descarta las reglas CSS como "unused selector".
  let active = $state(false);

  let pulseTl = null;
  let tickerFn = null;
  let resizeFn = null;
  let io = null;

  function setSize() {
    // El círculo expandido mide ~100% del ancho del viewport. La altura no
    // limita: si el círculo excede el alto visible, el overflow:hidden de
    // la sección lo recorta. Así garantizamos que el texto "WOU!" (que
    // escala con --size) llene ~95vw independiente del alto.
    const vw = sectionEl.getBoundingClientRect().width;
    const size = Math.max(280, Math.min(vw * 0.6, 700));
    ctaEl.style.setProperty('--size', size + 'px');
  }

  function setGrid() {
    const rect = gridEl.getBoundingClientRect();
    const g = sim.grid;
    g.width = rect.width;
    g.height = rect.height;
    const cols = window.innerWidth > 767 ? 16 : 10;
    g.gapX = rect.width / cols;
    g.gapY = g.gapX;
    g.vLines = Math.round(rect.width / g.gapX) + 1;
    g.hLines = Math.round(rect.height / g.gapY) + 1;
    g.points = [];
    for (let x = 0; x < g.vLines; x++) {
      for (let y = 0; y < g.hLines; y++) {
        const ox = x * g.gapX;
        const oy = y * g.gapY;
        g.points.push({ x: ox, y: oy, ox, oy });
      }
    }
    gridSvg.setAttribute('width', String(rect.width));
    gridSvg.setAttribute('height', String(rect.height));
    gridSvg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  }

  function createPulse() {
    // Pulso ambient del grid cuando no hay hover. yoyo para vaivén.
    pulseTl = gsap.timeline({ repeat: -1, yoyo: true })
      .to(sim.wave, { op: 0.3, duration: 2.5, ease: 'sine.inOut' });
  }

  function waveShock() {
    // "Golpe" expansivo al entrar: aro que viaja del centro hacia afuera.
    gsap.fromTo(sim.wave,
      { progress: 0 },
      { progress: 1, duration: 1.6, ease: 'expo.out', overwrite: true });
  }

  function activate() {
    if (active) return;
    active = true;
    pulseTl?.pause();
    clearTimeout(sim.waveTimeout);
    // Shock y amplitud del pulso arrancan en sync con el clip-path del
    // círculo (1s con delay 0.2s). Así el grid se deforma a la par del
    // crecimiento — no como un evento separado.
    gsap.fromTo(sim.wave,
      { progress: 0 },
      { progress: 1, duration: 1.0, delay: 0.2, ease: 'power3.out', overwrite: true },
    );
    gsap.to(sim.wave, {
      op: 1, duration: 0.5, ease: 'expo.out',
    });
  }

  function deactivate() {
    if (!active) return;
    active = false;
    pulseTl?.play(0);
    // Retraemos el shock junto con el círculo: la deformación baja sola.
    gsap.to(sim.wave, {
      progress: 0, duration: 0.6, ease: 'power2.in', overwrite: true,
    });
    gsap.to(sim.wave, {
      op: 0, duration: 0.7, ease: 'expo.inOut',
    });
  }

  function handleFocusOut(e) {
    // Sólo desactivamos si el foco sale completamente del wrapper.
    if (!hoverEl.contains(e.relatedTarget)) deactivate();
  }

  function handleDocTouch(e) {
    if (!hoverEl.contains(e.target)) deactivate();
  }

  // Cada frame: distorsiona puntos del grid y reescribe el path.
  // Dos componentes sumados:
  //   pulse  → seno radial viajero modulado por wave.op (hover fade)
  //   shock  → anillo expansivo cuando progress 0→1 (impacto inicial)
  function tick() {
    const g = sim.grid;
    if (!g.points.length) return;
    const cx = g.width / 2;
    const cy = g.height / 2;
    const t = performance.now() * 0.001;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    for (const p of g.points) {
      const dx = p.ox - cx;
      const dy = p.oy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const nx = dx / dist;
      const ny = dy / dist;
      const falloff = Math.max(0, 1 - dist / (maxDist * 1.25));

      const phase = t * sim.wave.speed * 1.8 - dist * 0.022;
      const pulse = Math.sin(phase) * sim.wave.op * sim.wave.strength * 16 * falloff;

      // Shock: el aro arranca en el radio del botón (≈64px) y avanza hasta
      // un 15% más allá del radio del círculo expandido, siguiendo su
      // perímetro. La amplitud sigue sin(progress·π): arranca en 0, pica a
      // mitad de expansión y vuelve a 0 al final — así el grid "empuja"
      // junto con la onda.
      let shock = 0;
      if (sim.wave.progress > 0 && sim.wave.progress < 1) {
        const circleRadiusMax = ctaEl
          ? ctaEl.clientWidth / 2
          : Math.min(g.width, g.height) / 2;
        const startRadius = 64; // radio del botón
        const endRadius = circleRadiusMax * 1.15;
        const shockRadius = startRadius + sim.wave.progress * (endRadius - startRadius);
        const delta = Math.abs(dist - shockRadius);
        const width = 160;
        if (delta < width) {
          const lifecycle = Math.sin(sim.wave.progress * Math.PI);
          shock = Math.cos((delta / width) * Math.PI / 2) * 65 * lifecycle;
        }
      }

      const disp = pulse + shock;
      p.x = p.ox + nx * disp;
      p.y = p.oy + ny * disp;
    }

    // Path con líneas verticales (Mx constante, y variable) y horizontales.
    let d = '';
    for (let x = 0; x < g.vLines; x++) {
      for (let y = 0; y < g.hLines; y++) {
        const p = g.points[x * g.hLines + y];
        d += (y === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' ';
      }
    }
    for (let y = 0; y < g.hLines; y++) {
      for (let x = 0; x < g.vLines; x++) {
        const p = g.points[x * g.hLines + y];
        d += (x === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' ';
      }
    }
    gridPath.setAttribute('d', d);
  }

  onMount(() => {
    sim.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setSize();
    setGrid();

    if (!sim.reducedMotion) {
      createPulse();
      tickerFn = tick;
      gsap.ticker.add(tickerFn);
    }

    resizeFn = () => { setSize(); setGrid(); };
    window.addEventListener('resize', resizeFn);

    hoverEl.addEventListener('mouseenter', activate);
    hoverEl.addEventListener('mouseleave', deactivate);
    hoverEl.addEventListener('touchstart', activate, { passive: true });
    hoverEl.addEventListener('focusin', activate);
    hoverEl.addEventListener('focusout', handleFocusOut);
    document.addEventListener('touchstart', handleDocTouch, { passive: true });

    io = new IntersectionObserver((entries) => {
      if (!tickerFn || sim.reducedMotion) return;
      const visible = entries[0].isIntersecting;
      if (visible) gsap.ticker.add(tickerFn);
      else gsap.ticker.remove(tickerFn);
    }, { threshold: 0 });
    io.observe(sectionEl);
  });

  onDestroy(() => {
    // Svelte 5 ejecuta onDestroy también durante el cleanup de SSR.
    // Si no hay window/document (server), no hay nada que limpiar.
    if (typeof window === 'undefined') return;
    pulseTl?.kill();
    if (tickerFn) gsap.ticker.remove(tickerFn);
    if (resizeFn) window.removeEventListener('resize', resizeFn);
    io?.disconnect();
    clearTimeout(sim.waveTimeout);
    document.removeEventListener('touchstart', handleDocTouch);
  });
</script>

<div class="s-cta" bind:this={sectionEl}>
  <!-- Grid distorsionado (fondo animado) -->
  <div class="s__grid" bind:this={gridEl}>
    <svg class="s__grid__svg" bind:this={gridSvg} aria-hidden="true">
      <path class="s__grid__path" bind:this={gridPath} d="" />
    </svg>
  </div>

  <div class="s__inner">
    <div class="s__hover" class:is-active={active} bind:this={hoverEl}>

      <!-- Trigger: logo W·U! (mismos paths que el Header) -->
      <button type="button" class="s__button" aria-label="Abrir información de contacto">
        <span class="s__button__inner">
          <svg
            class="s__button__logo"
            viewBox="0 0 109 37"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <!-- W -->
            <path class="s__button__logo-letter" fill-rule="evenodd" clip-rule="evenodd" d="M40.9047 0.143066H44.7054L43.6443 3.78441C43.0267 4.26144 42.4408 4.77028 41.9024 5.31091C40.8255 6.39218 39.8912 7.63247 39.0835 9.01586C37.4841 11.7826 36.6923 14.772 36.6923 18.0159C36.6923 19.6219 36.8982 21.1802 37.2941 22.6908C37.4207 23.1519 37.5633 23.5971 37.7216 24.0424L34.2219 36H31.3713C30.8171 36 30.2787 35.9364 29.7244 35.7932C29.2176 35.666 28.7109 35.4752 28.1883 35.2049C26.9372 34.5689 26.1613 33.6466 25.8604 32.454L22.0755 17.4911L16.6279 36.0159H13.7774C13.2232 36.0159 12.6689 35.9523 12.1146 35.8091C11.5762 35.6819 11.0536 35.4752 10.5469 35.2208C9.2958 34.5848 8.51983 33.6625 8.20311 32.4699L0 0.143066H3.86401C4.97254 0.143066 6.03356 0.429285 7.07874 0.985823C7.66468 1.30384 8.13976 1.68547 8.51983 2.1466C8.91574 2.62363 9.18495 3.14837 9.34331 3.73671L12.8273 17.4275L16.7388 4.05473C16.8338 3.689 17.008 3.33918 17.2455 3.00526C17.4514 2.70314 17.7048 2.41692 18.0057 2.1466C18.2432 1.92399 18.5283 1.71727 18.845 1.51056C19.1617 1.30384 19.4784 1.12893 19.7793 1.00172C20.3336 0.763208 20.8878 0.572395 21.4263 0.413384C22.0755 0.238473 22.6615 0.143066 23.1682 0.143066H26.0821L30.437 17.4116L34.3644 3.99112C34.5702 3.35508 34.9345 2.76674 35.4571 2.27381C35.9163 1.82858 36.4864 1.43105 37.199 1.08123C37.8167 0.779109 38.4343 0.556494 39.0202 0.397483C39.6853 0.222572 40.3188 0.143066 40.9205 0.143066H40.9047Z"/>
            <!-- • (punto central: eje de expansión) -->
            <path class="s__button__logo-dot" fill-rule="evenodd" clip-rule="evenodd" d="M48.8228 23.8041C49.6146 24.5832 50.4856 25.1715 51.4358 25.5532C52.3543 25.9348 53.3836 26.1256 54.4763 26.1256C55.569 26.1256 56.5984 25.9348 57.5327 25.5532C58.4829 25.1715 59.3538 24.5832 60.1615 23.8041C60.9691 23.009 61.5867 22.1344 61.9826 21.1804C62.3944 20.2263 62.5844 19.1768 62.5844 18.032C62.5844 16.8871 62.3785 15.8376 61.9826 14.8677C61.5709 13.9136 60.9691 13.0231 60.1615 12.2281C59.3538 11.433 58.4829 10.8447 57.5327 10.4472C56.6142 10.0655 55.6007 9.89062 54.508 9.89062C53.7637 9.89062 53.0669 9.97013 52.4018 10.145C51.7367 10.32 51.1032 10.5903 50.4856 10.9401C49.868 11.3058 49.3137 11.7192 48.807 12.2122C48.3161 12.7051 47.8885 13.2616 47.5084 13.8818C47.1284 14.5178 46.8591 15.1698 46.6691 15.8376C46.4949 16.5055 46.3999 17.2369 46.3999 18.0002C46.3999 19.1609 46.6058 20.2104 47.0017 21.1804C47.3976 22.1344 48.0152 23.009 48.807 23.8041H48.8228Z"/>
            <!-- U -->
            <path class="s__button__logo-letter" fill-rule="evenodd" clip-rule="evenodd" d="M88.2071 5.27926C88.2071 3.92767 88.7455 2.79869 89.8065 1.90823C90.7092 1.14498 91.9761 0.620247 93.623 0.318126H93.6706C93.9239 0.270423 94.1615 0.238621 94.3515 0.22272C94.6207 0.190918 94.8424 0.190918 95.0166 0.190918H97.1387V22.0549C97.1387 23.8199 96.9011 25.4577 96.426 26.9365C96.1885 27.668 95.9035 28.3517 95.5551 29.0036C95.2067 29.6556 94.8108 30.2439 94.3673 30.7687C93.9556 31.2616 93.528 31.7068 93.0846 32.1202C92.6412 32.5337 92.1661 32.9153 91.6752 33.281C91.1526 33.6627 90.6142 33.9966 90.0758 34.2669C89.5057 34.5531 88.9356 34.8075 88.3338 34.9983C87.8112 35.1733 87.2886 35.3164 86.7818 35.4436C86.2909 35.5708 85.8 35.6662 85.2933 35.7457C84.3114 35.9047 83.3929 35.9842 82.5536 35.9842C82.2052 35.9842 81.8251 35.9842 81.4134 35.9365C81.0333 35.9047 80.6374 35.8729 80.2415 35.8252C79.8615 35.7775 79.4339 35.698 78.9588 35.6026C78.4996 35.5072 78.0403 35.3959 77.6127 35.2687C77.1218 35.1255 76.6467 34.9665 76.1875 34.7757C75.7282 34.5849 75.269 34.3782 74.8256 34.1556C73.9229 33.6786 73.0519 33.0743 72.2126 32.327C71.8009 31.9612 71.405 31.5478 71.0249 31.1185C70.6448 30.6733 70.2964 30.2121 70.0114 29.7669C69.7105 29.2899 69.4413 28.781 69.1879 28.2245C69.4571 27.827 69.7105 27.4294 69.9639 27.016C70.7557 25.6485 71.3575 24.2174 71.7534 22.7068C72.1493 21.1962 72.3551 19.6379 72.3551 18.0319C72.3551 16.4259 72.1493 14.8676 71.7534 13.357C71.3575 11.8464 70.7557 10.3994 69.9639 9.03191C69.378 8.03014 68.7128 7.09198 67.9844 6.23332V0.190918H70.2331C70.344 0.190918 70.4865 0.190918 70.6607 0.22272L70.9616 0.270423C71.4525 0.349929 71.4208 0.334028 71.5317 0.36583C71.7375 0.397632 72.0384 0.477137 72.4185 0.588445C72.7669 0.699752 73.0994 0.811059 73.3845 0.938268C73.5904 1.03367 73.7646 1.11318 73.9071 1.20859C74.0654 1.30399 74.2238 1.4153 74.3822 1.54251C74.588 1.68562 74.7306 1.81283 74.8097 1.89233C74.9681 2.03544 75.0948 2.16265 75.2056 2.27396C75.364 2.44887 75.5224 2.65558 75.6491 2.8782C75.7599 3.08491 75.8708 3.29163 75.9499 3.51424C76.0291 3.73685 76.0766 3.94357 76.1241 4.16618C76.1558 4.3888 76.1875 4.61141 76.1875 4.83403V21.3234C76.1875 21.9118 76.2192 22.4524 76.2667 22.9135C76.33 23.4065 76.4092 23.8835 76.5042 24.3128C76.5992 24.7263 76.7259 25.1079 76.8843 25.4577C77.011 25.7598 77.1535 26.0142 77.3118 26.2369C77.5019 26.4913 77.6919 26.7457 77.8819 26.9524C78.072 27.1591 78.2779 27.3499 78.4996 27.5407C78.6896 27.6998 78.8796 27.8429 79.0855 27.9542C79.2755 28.0655 79.4814 28.1609 79.6873 28.2404C79.9406 28.3358 80.194 28.4153 80.4474 28.4789C80.6691 28.5425 80.8908 28.5902 81.1284 28.622C81.3501 28.6538 81.5876 28.6856 81.841 28.7015C82.0785 28.7174 82.3161 28.7333 82.5694 28.7333C82.9337 28.7333 83.2979 28.7174 83.6305 28.6697C83.9789 28.622 84.2797 28.5584 84.549 28.4789C85.1032 28.3199 85.6892 28.0019 86.3226 27.5248C86.5601 27.3499 86.766 27.1114 86.9877 26.8093C87.2253 26.4595 87.447 26.0142 87.637 25.5054C87.8429 24.9489 87.9854 24.3446 88.0804 23.6768C88.1754 22.993 88.2388 22.2298 88.2388 21.3552V5.27926H88.2071Z"/>
            <!-- ! stem -->
            <path class="s__button__logo-letter" fill-rule="evenodd" clip-rule="evenodd" d="M100.417 3.21201C101.145 2.11484 102.286 1.36749 103.616 0.874558C105.516 0.174912 106.973 0.174912 109 0L108.541 18.811C108.398 24.9806 106.435 26.1095 100.528 26.1095L99.7676 8.72968L99.6568 6.18551C99.6092 5.02473 99.7676 4.19788 100.417 3.21201Z"/>
            <!-- ! dot -->
            <path class="s__button__logo-letter" fill-rule="evenodd" clip-rule="evenodd" d="M104.487 27.5249C106.799 27.5249 108.668 29.4012 108.668 31.7228C108.668 34.0443 106.799 35.9207 104.487 35.9207C102.175 35.9207 100.306 34.0443 100.306 31.7228C100.306 29.4012 102.175 27.5249 104.487 27.5249Z"/>
          </svg>
        </span>
      </button>

      <!-- Círculo expandible -->
      <div class="s__cta" bind:this={ctaEl}>

        <div class="s__cta__line s__cta__line--top" aria-hidden="true">
          <div class="s__cta__text">
            {#each ['R', 'A', 'D', 'I', 'O'] as letter}
              <span class="s__cta__char">
                <span class="s__cta__char__slice">{letter}</span>
                <span class="s__cta__char__slice">{letter}</span>
                <span class="s__cta__char__slice">{letter}</span>
                <span class="s__cta__char__slice">{letter}</span>
              </span>
            {/each}
          </div>
        </div>

        <div class="s__cta__line s__cta__line--bottom" aria-hidden="true">
          <div class="s__cta__text">
            {#each ['W', 'O', 'U', '!'] as letter}
              <span class="s__cta__char">
                <span class="s__cta__char__slice">{letter}</span>
                <span class="s__cta__char__slice">{letter}</span>
                <span class="s__cta__char__slice">{letter}</span>
                <span class="s__cta__char__slice">{letter}</span>
              </span>
            {/each}
          </div>
        </div>

        <a href="mailto:{EMAIL}" class="s__cta__link" aria-label="Enviar correo a WOU">
          {EMAIL}
        </a>

        <div class="s__cta__stars" aria-hidden="true">
          <svg class="s__cta__star" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m24.5 0 3.3 21.2L49 24.5l-21.2 3.3L24.5 49l-3.3-21.2L0 24.5l21.2-3.3L24.5 0z"/></svg>
          <svg class="s__cta__star" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m24.5 0 3.3 21.2L49 24.5l-21.2 3.3L24.5 49l-3.3-21.2L0 24.5l21.2-3.3L24.5 0z"/></svg>
          <svg class="s__cta__star" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m24.5 0 3.3 21.2L49 24.5l-21.2 3.3L24.5 49l-3.3-21.2L0 24.5l21.2-3.3L24.5 0z"/></svg>
          <svg class="s__cta__star" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m24.5 0 3.3 21.2L49 24.5l-21.2 3.3L24.5 49l-3.3-21.2L0 24.5l21.2-3.3L24.5 0z"/></svg>
        </div>

        <div class="a-dots" aria-hidden="true"></div>
      </div>
    </div>
  </div>
</div>

<style>
  .s-cta {
    --color-navy:   #0B1E5C;
    --color-teal:   #12C2B3;
    --color-dark:   #0A1838;
    --color-cream:  #EDE6D6;

    --font-display: 'Bowlby One', 'Libre Franklin', sans-serif;
    --font-mono:    'Libre Franklin', sans-serif;

    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
  }

  /* ── Grid SVG ──────────────────────────────────────────────────── */
  .s__grid { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
  .s__grid__svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .s__grid__path {
    fill: none;
    stroke: var(--color-teal);
    stroke-width: 1px;
    opacity: 0.13;
  }

  /* ── Layout interno ────────────────────────────────────────────── */
  .s__inner {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  /* Wrapper sin posicionamiento: así .s__cta se ubica respecto a .s-cta */
  .s__hover { display: block; }

  /* ── Botón (logo W·U!) ─────────────────────────────────────────── */
  .s__button {
    position: relative;
    z-index: 4;
    width: 8rem;
    height: 8rem;
    padding: 0;
    margin: 0;
    border: 0;
    cursor: pointer;
    background: transparent;
  }
  .s__button:focus-visible { outline: none; }

  .s__button__inner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--color-dark);
    border-radius: 999rem;
    opacity: 1;
    /* Sólo fade de opacidad (sin scale): el círculo grande por debajo, que
       tiene el mismo color dark, toma el relevo. Perceptualmente parece
       un solo círculo creciendo. */
    transition: opacity 0.35s ease 0.1s;
    will-change: opacity;
  }

  .s__button__logo {
    display: block;
    width: 62%;
    height: auto;
  }
  .s__button__logo-letter { fill: var(--color-cream); }
  .s__button__logo-dot    { fill: var(--color-teal);  }

  /* Al activar: el botón se funde mientras el círculo grande crece
     desde el mismo centro y con el mismo color, cubriendo el botón. */
  .s__hover.is-active .s__button__inner {
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  /* Anillo focus visible para teclado */
  .s__hover:focus-within .s__button__inner {
    outline: 2px solid var(--color-teal);
    outline-offset: 6px;
  }

  /* ── Círculo expandible ────────────────────────────────────────── */
  .s__cta {
    --size: 480px;
    position: absolute;
    top: calc(50% - var(--size) / 2);
    left: calc(50% - var(--size) / 2);
    z-index: 2;
    width: var(--size);
    height: var(--size);
    background: var(--color-dark);
    border-radius: 999rem;
    /* Arranca con el radio visual del botón (4rem = 64px). El usuario ve
       un único círculo dark que crece: el botón y el .s__cta están
       perfectamente alineados en el centro y con el mismo color. */
    clip-path: circle(4rem at 50% 50%);
    overflow: hidden;
    color: var(--color-cream);
    font-family: var(--font-display);
    font-weight: 400;
    font-size: calc(var(--size) * 0.20);
    line-height: 1;
    text-align: center;
    text-transform: uppercase;
    transition: clip-path 0.6s cubic-bezier(0.86, 0, 0.07, 1);
    will-change: clip-path;
    pointer-events: none;
  }

  .s__cta::before,
  .s__cta::after {
    position: absolute;
    inset: 0;
    z-index: 4;
    border-radius: 999rem;
    transition: border-width 0.6s cubic-bezier(0.86, 0, 0.07, 1);
    will-change: border-width;
    content: '';
    pointer-events: none;
  }
  .s__cta::before { border: calc(var(--size) * 0.5) solid var(--color-teal); }
  .s__cta::after  { border: calc(var(--size) * 0.5) solid var(--color-dark); }

  .s__hover.is-active .s__cta {
    clip-path: circle(50% at 50% 50%);
    transition: clip-path 1s cubic-bezier(1, 0, 0, 1) 0.2s;
    pointer-events: auto;
  }
  .s__hover.is-active .s__cta::before {
    border-width: 1rem;
    transition: border-width 1.1s cubic-bezier(1, 0, 0, 1) 0.2s;
  }
  .s__hover.is-active .s__cta::after {
    border-width: 1px;
    transition: border-width 1.005s cubic-bezier(1, 0, 0, 1) 0.2s;
  }

  /* ── Email link ────────────────────────────────────────────────── */
  .s__cta__link {
    position: absolute;
    top: calc(50% + var(--size) * 0.36);
    left: 50%;
    z-index: 3;
    display: block;
    padding: 1em 1.25em 1em 2em;
    background: var(--color-dark);
    opacity: 0;
    transform: translate3d(-50%, 1em, 0);
    color: var(--color-teal);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 14px;
    line-height: 1;
    letter-spacing: 0.08em;
    text-decoration: none;
    text-transform: uppercase;
    transition: transform 0.3s linear, opacity 0.3s linear;
    will-change: transform, opacity;
  }
  .s__cta__link::before {
    position: absolute;
    top: calc(50% - 3px);
    left: 0.75em;
    border-top: 3px solid transparent;
    border-left: 6px solid var(--color-teal);
    border-bottom: 3px solid transparent;
    content: '';
  }
  .s__hover.is-active .s__cta__link {
    opacity: 1;
    transform: translate3d(-50%, 0, 0);
    transition:
      transform 0.6s cubic-bezier(0.19, 1, 0.22, 1) 1s,
      opacity 0.3s cubic-bezier(0.19, 1, 0.22, 1) 1s;
  }

  /* ── Líneas del texto grande RADIO / WOU! ───────────────────────── */
  .s__cta__line {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    translate: -50% -50%;
    scale: 0.5;
    transition: scale 0.6s cubic-bezier(0.55, 0.055, 0.675, 0.19);
    will-change: scale;
  }
  .s__cta__line--top    { clip-path: inset(-100% 0 calc(50% + 0.01em)); }
  .s__cta__line--bottom { clip-path: inset(calc(50% + 0.01em) 0 -100%); letter-spacing: 0.014em; }

  .s__hover.is-active .s__cta__line {
    scale: 1;
    transition: scale 1.8s cubic-bezier(0.23, 1, 0.32, 1) 0.6s;
  }

  .s__cta__text {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
    height: 0.8em;
  }
  .s__cta__char { position: relative; height: 100%; }
  .s__cta__char:nth-child(1) { --delay: 0.1s; }
  .s__cta__char:nth-child(2) { --delay: 0.2s; }
  .s__cta__char:nth-child(3) { --delay: 0.3s; }
  .s__cta__char:nth-child(4) { --delay: 0.4s; }
  .s__cta__char:nth-child(5) { --delay: 0.5s; }

  .s__cta__char__slice {
    --offset: 0s;
    --move-delay: calc(var(--delay) + var(--offset));
    position: relative;
    display: block;
    height: 100%;
    animation: s-cta-char-up-down 2s infinite var(--move-delay);
    will-change: transform;
  }
  .s__cta__char__slice:not(:first-child) {
    position: absolute;
    top: 0;
    left: 0;
    animation:
      s-cta-char-up-down 2s infinite var(--move-delay),
      s-cta-char-toggle 2s linear infinite var(--toggle-delay);
  }
  .s__cta__char__slice:nth-child(2) { --offset: calc(0.02s + 0.12s); }
  .s__cta__char__slice:nth-child(3) { --offset: calc(0.02s + 0.08s); }
  .s__cta__char__slice:nth-child(4) { --offset: calc(0.02s + 0.04s); }

  .s__cta__line--top .s__cta__char__slice { --toggle-delay: calc(var(--delay) + var(--offset) + 0.45s); }
  .s__cta__line--top .s__cta__char__slice:nth-child(2) { clip-path: inset(0 0 calc(100% - 0.03em)); }
  .s__cta__line--top .s__cta__char__slice:nth-child(3) { clip-path: inset(0 0 calc(100% - 0.06em)); }
  .s__cta__line--top .s__cta__char__slice:nth-child(4) { clip-path: inset(0 0 calc(100% - 0.09em)); }

  .s__cta__line--bottom .s__cta__char__slice { --toggle-delay: calc(var(--delay) + var(--offset) + 1.45s); }
  .s__cta__line--bottom .s__cta__char__slice:nth-child(2) { clip-path: inset(calc(100% - 0.03em) 0 0); }
  .s__cta__line--bottom .s__cta__char__slice:nth-child(3) { clip-path: inset(calc(100% - 0.06em) 0 0); }
  .s__cta__line--bottom .s__cta__char__slice:nth-child(4) { clip-path: inset(calc(100% - 0.09em) 0 0); }

  /* ── Patrón de puntos de fondo ───────────────────────────────────── */
  .a-dots {
    position: absolute;
    top: -10%;
    left: -10%;
    width: 120%;
    height: 120%;
    scale: 1.1;
    opacity: 0.4;
    transition: scale 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19);
    will-change: scale;
  }
  .a-dots::before {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 200%;
    height: 200%;
    background:
      repeating-linear-gradient(0deg,  transparent, transparent 2px, var(--color-dark) 3px, var(--color-dark) 100%) center / 48px 48px repeat,
      repeating-linear-gradient(90deg, var(--color-teal), var(--color-teal) 2px, transparent 3px, transparent 48px) center / 48px 48px repeat;
    transform: translate3d(-50%, -50%, 0) scale(0.5);
    content: '';
  }
  .s__hover.is-active .a-dots {
    scale: 1;
    transition: scale 1.8s cubic-bezier(0.23, 1, 0.32, 1) 0.6s;
  }

  /* ── Estrellas decorativas ───────────────────────────────────────── */
  .s__cta__stars {
    position: absolute;
    inset: 0;
    z-index: 1;
    scale: 1.25;
    transition: scale 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19);
    will-change: scale;
  }
  .s__cta__star {
    position: absolute;
    width: calc(var(--size) * 0.032);
    height: auto;
    fill: var(--color-teal);
    animation: s-cta-star-float 6s infinite ease-in-out;
  }
  .s__cta__star:nth-child(1) { top: 12%; left: 25%; animation-duration: 8s; }
  .s__cta__star:nth-child(2) { top: 33%; left: 82%; width: calc(var(--size) * 0.022); animation-duration: 9s; }
  .s__cta__star:nth-child(3) { top: 60%; left: 11%; width: calc(var(--size) * 0.022); animation-duration: 7s; }
  .s__cta__star:nth-child(4) { top: 83%; left: 74%; }
  .s__hover.is-active .s__cta__stars {
    scale: 1;
    transition: scale 2s cubic-bezier(0.23, 1, 0.32, 1) 0.4s;
  }

  /* ── Keyframes ───────────────────────────────────────────────────── */
  @keyframes s-cta-char-up-down {
    0%   { transform: translateZ(0); animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1); }
    25%  { transform: translate3d(0, -52%, 0); animation-timing-function: cubic-bezier(0.645, 0.045, 0.355, 1); }
    75%  { transform: translate3d(0,  52%, 0); animation-timing-function: cubic-bezier(0.55, 0.055, 0.675, 0.19); }
    100% { transform: translateZ(0); }
  }
  @keyframes s-cta-char-toggle {
    0%     { opacity: 1; }
    50%    { opacity: 1; }
    50.01% { opacity: 0; }
    100%   { opacity: 0; }
  }
  @keyframes s-cta-star-float {
    0%   { transform: translateZ(0); }
    50%  { transform: translate3d(0, -15%, 0) scale(0.5); }
    100% { transform: translateZ(0); }
  }

  /* ── Responsive ──────────────────────────────────────────────────── */
  @media (max-width: 767px) {
    .s__button {
      width: 5rem;
      height: 5rem;
      font-size: 1.7rem;
      line-height: 5rem;
    }
  }

  /* ── Prefiere reducir movimiento ─────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .s-cta *,
    .s-cta *::before,
    .s-cta *::after {
      transition: none !important;
      animation: none !important;
    }
    /* Estado abierto por defecto para que el email sea alcanzable sin drama. */
    .s__cta { clip-path: circle(50% at 50% 50%); pointer-events: auto; }
    .s__cta::before { border-width: 1rem; }
    .s__cta::after  { border-width: 1px; }
    .s__cta__line   { scale: 1; }
    .s__cta__link   { opacity: 1; transform: translate3d(-50%, 0, 0); }
    .a-dots         { scale: 1; }
    .s__cta__stars  { scale: 1; }
  }
</style>
