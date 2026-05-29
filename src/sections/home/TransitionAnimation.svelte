<!--
  TransitionAnimation — controla la transición scrolleada de TransitionSection.

  Fase A (timeline 0→1): el grupo [texto "Abrí la ventana, esto es" + SVG WOU]
    se traslada de derecha a izquierda hasta dejar el SVG centrado.
  Fase B (timeline 1→2): con el SVG centrado, el punto "O" crece, el overlay
    oscuro cubre el viewport y revela el NewsGrid que estaba detrás.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import gsap from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';

  let ctx: ReturnType<typeof gsap.context> | null = null;

  // Dot = la "O" del logo WOU (viewBox 0 0 109 37)
  const DOT_X_PCT = 54.5 / 109;
  const DOT_Y_PCT = 18   / 37;
  const DOT_R_PCT = 8.09 / 109;

  // Fracción del viewport con que el texto asoma por la derecha al inicio.
  const PEEK = 0.1;

  onMount(() => {
    gsap.registerPlugin(ScrollTrigger);

    const wrapper  = document.querySelector<HTMLElement>('.TSec-wrapper');
    const section  = wrapper?.querySelector<HTMLElement>('.TSec');
    const bg       = section?.querySelector<HTMLElement>('.TSec__bg');
    const group    = section?.querySelector<HTMLElement>('.TSec__group');
    const label    = section?.querySelector<HTMLElement>('.TSec__label');
    const svg      = section?.querySelector<SVGElement>('svg');
    const newsGrid = document.querySelector<HTMLElement>('.NewsGrid');

    if (!wrapper || !section || !group || !svg) return;

    const getHeaderH = () => document.getElementById('siteHeader')?.offsetHeight ?? 0;

    // stallWrap: fixed, z-index 1 → queda detrás del TSec-wrapper (z-index 2).
    // El TSec actúa como máscara: cuando su overlay y fondo se esfuman, el
    // newsGrid se revela debajo. placeholder preserva el espacio en el flujo.
    let stallWrap: HTMLElement | null = null;
    let placeholder: HTMLElement | null = null;

    const FIXED_STYLES = {
      position:      'fixed',
      top:           '0',
      left:          '0',
      right:         '0',
      zIndex:        '1',
      boxSizing:     'border-box',
      pointerEvents: 'none',
    } as const;

    const STATIC_STYLES_TO_CLEAR = ['position','top','left','right','zIndex','boxSizing','pointerEvents'] as const;

    if (newsGrid) {
      stallWrap = document.createElement('div');
      stallWrap.className = 'TSec-stall-wrap';
      newsGrid.parentNode?.insertBefore(stallWrap, newsGrid);
      stallWrap.appendChild(newsGrid);

      Object.assign(stallWrap.style, {
        ...FIXED_STYLES,
        opacity:    '0',
        paddingTop: `${getHeaderH()}px`,
        background: 'var(--color-brand-gray)',
      });

      placeholder = document.createElement('div');
      placeholder.className = 'TSec-stall-placeholder';
      placeholder.style.height = `${newsGrid.scrollHeight + getHeaderH()}px`;
      stallWrap.before(placeholder);
    }

    // Overlay oscuro: ocupa todo el section, crece vía clip-path circle()
    // (evita escalar una textura GPU enorme que pixela elementos vecinos).
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:      'absolute',
      inset:         '0',
      background:    'var(--color-brand-blue)',
      pointerEvents: 'none',
      zIndex:        '20',
    });
    section.appendChild(overlay);

    function init() {
      const secRect = section!.getBoundingClientRect();
      const vw = secRect.width;

      const svgRect  = svg!.getBoundingClientRect();
      const groupRect = group!.getBoundingClientRect();
      const svgW = svgRect.width;
      const svgH = svgRect.height;

      // Medir la distancia real SVG→grupo desde el DOM (no calcularla con labelW
      // + gap, que es frágil ante race conditions de carga de fuentes).
      const svgLeftInGroup  = svgRect.left - groupRect.left;
      const svgCenterInGroup = svgLeftInGroup + svgW / 2;

      // ── Fase A ────────────────────────────────────────────────────────
      const xStart = vw * (1 - PEEK);
      const xEnd   = vw / 2 - svgCenterInGroup;

      // ── Fase B: medir posición exacta del "O" posicionando el grupo
      //    temporalmente en xEnd, para que el overlay siga al punto real
      //    aunque xEnd tenga drift por fuente no cargada al medir.
      gsap.set(group!, { yPercent: -50, x: xEnd });
      const svgAtEnd = svg!.getBoundingClientRect();
      const secAtEnd = section!.getBoundingClientRect();
      const dotX = svgAtEnd.left - secAtEnd.left + DOT_X_PCT * svgAtEnd.width;
      const dotY = svgAtEnd.top  - secAtEnd.top  + DOT_Y_PCT * svgAtEnd.height;
      const dotR = svgAtEnd.width * DOT_R_PCT;
      gsap.set(group!, { x: xStart }); // restaurar posición de inicio

      // Radio que cubre la diagonal del viewport desde el punto del dot.
      const coverR = Math.ceil(Math.hypot(secRect.width, secRect.height));
      gsap.set(overlay, {
        clipPath: `circle(${dotR}px at ${dotX}px ${dotY}px)`,
        opacity:  0,
      });

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ paused: true });

        // ── Fase A (0 → 1): el grupo viaja de derecha a izquierda ──────
        tl.fromTo(group!, { x: xStart }, { x: xEnd, ease: 'none', duration: 1 }, 0);

        // ── Fase B (1 → 2): crece el dot y transiciona al NewsGrid ─────
        tl.to(overlay, { opacity: 1, ease: 'none', duration: 0.05 }, 1);
        tl.to(overlay, {
          clipPath: `circle(${coverR}px at ${dotX}px ${dotY}px)`,
          ease: 'power2.in', duration: 0.55,
        }, 1);
        if (label) tl.to(label, { opacity: 0, ease: 'power1.in', duration: 0.35 }, 1);

        // SVG: se inclina gradualmente y crece en sincronía con el overlay
        tl.to(svg!, {
          rotation: -38,
          scale: 14,
          transformOrigin: `${(DOT_X_PCT * 100).toFixed(1)}% ${(DOT_Y_PCT * 100).toFixed(1)}%`,
          ease: 'power2.in',
          duration: 0.55,
        }, 1);

        if (bg) tl.to(bg, { opacity: 0, ease: 'none', duration: 0.20 }, 1.55);
        tl.to(group!, { opacity: 0, ease: 'none', duration: 0.15 }, 1.60);

        tl.to(overlay, { opacity: 0, ease: 'power1.out', duration: 0.25 }, 1.75);
        if (stallWrap) {
          tl.to(stallWrap, { opacity: 1, ease: 'power1.out', duration: 0.25 }, 1.75);
        }

        ScrollTrigger.create({
          trigger:   wrapper,
          start:     'top top',
          end:       '+=300%',
          scrub:     0.3,
          animation: tl,
          onUpdate: () => {
            if (!stallWrap) return;
            const op = parseFloat(stallWrap.style.opacity) || 0;
            stallWrap.style.pointerEvents = op > 0.1 ? 'auto' : 'none';
          },
        });

        // Toggle fixed ↔ static al cruzar el fin del wrapper.
        if (stallWrap && placeholder) {
          ScrollTrigger.create({
            trigger:     wrapper,
            start:       'bottom top',
            onEnter: () => {
              if (!stallWrap || !placeholder) return;
              placeholder.remove();
              for (const prop of STATIC_STYLES_TO_CLEAR) stallWrap!.style[prop] = '';
            },
            onLeaveBack: () => {
              if (!stallWrap || !placeholder) return;
              if (!placeholder.parentNode) stallWrap.before(placeholder);
              Object.assign(stallWrap.style, FIXED_STYLES);
            },
          });
        }
      });
    }

    // Esperar fonts + un RAF para que el reflow con las métricas reales de la
    // fuente ya esté aplicado antes de medir labelW/svgLeftInGroup.
    const run = () => {
      if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(init));
      else requestAnimationFrame(init);
    };

    // Si una fuente carga tarde (font-display: swap), reinicializar.
    const onFontsLoaded = () => { ctx?.revert(); ctx = null; requestAnimationFrame(init); };
    document.fonts.addEventListener('loadingdone', onFontsLoaded);

    if (document.readyState === 'complete') {
      run();
    } else {
      window.addEventListener('load', run, { once: true });
    }

    // Resize: recomputar posiciones (dotX/dotY dependen del viewport actual).
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        ctx?.revert();
        ctx = null;
        init();
      }, 200);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.fonts.removeEventListener('loadingdone', onFontsLoaded);
      clearTimeout(resizeTimer);
    };
  });

  onDestroy(() => {
    ctx?.revert();
  });
</script>
