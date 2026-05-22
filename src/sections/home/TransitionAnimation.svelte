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
        background: 'var(--color-brand-dark)',
      });

      placeholder = document.createElement('div');
      placeholder.className = 'TSec-stall-placeholder';
      placeholder.style.height = `${newsGrid.scrollHeight + getHeaderH()}px`;
      stallWrap.before(placeholder);
    }

    // El SVG escala desde el centro del "O".
    gsap.set(svg, {
      transformOrigin: `${(DOT_X_PCT * 100).toFixed(2)}% ${(DOT_Y_PCT * 100).toFixed(2)}%`,
    });

    // Overlay oscuro: nace como el dot y se expande hasta cubrir el viewport.
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:      'absolute',
      background:    'var(--color-brand-dark)',
      borderRadius:  '50%',
      pointerEvents: 'none',
      zIndex:        '20',
    });
    section.appendChild(overlay);

    function init() {
      const secRect = section!.getBoundingClientRect();
      const vw = secRect.width;

      const svgRect = svg!.getBoundingClientRect();
      const svgW = svgRect.width;
      const svgH = svgRect.height;
      const labelW = label ? label.getBoundingClientRect().width : 0;
      const gapPx = parseFloat(getComputedStyle(group!).columnGap) || 0;

      // ── Fase A: traslación horizontal ────────────────────────────────
      // xStart: grupo corrido a la derecha → solo asoma PEEK del texto.
      // xEnd:   el centro del SVG cae en el centro del viewport.
      const svgCenterInGroup = labelW + gapPx + svgW / 2;
      const xStart = vw * (1 - PEEK);
      const xEnd   = vw / 2 - svgCenterInGroup;

      // ── Fase B: dot "O" con el SVG ya centrado ───────────────────────
      const dotX = vw / 2 + (DOT_X_PCT - 0.5) * svgW;
      const dotY = secRect.height / 2 + (DOT_Y_PCT - 0.5) * svgH;
      const dotR = svgW * DOT_R_PCT;

      const endScale = Math.ceil(Math.hypot(secRect.width, secRect.height) / dotR) + 1;
      const svgScale = endScale * 0.35;

      gsap.set(group!, { yPercent: -50, x: xStart });
      gsap.set(overlay, {
        width:   dotR * 2,
        height:  dotR * 2,
        left:    dotX - dotR,
        top:     dotY - dotR,
        scale:   1,
        opacity: 0,
      });

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ paused: true });

        // ── Fase A (0 → 1): el grupo viaja de derecha a izquierda ──────
        tl.fromTo(group!, { x: xStart }, { x: xEnd, ease: 'none', duration: 1 }, 0);

        // ── Fase B (1 → 2): crece el dot y transiciona al NewsGrid ─────
        tl.to(overlay, { opacity: 1, ease: 'none', duration: 0.05 }, 1);
        tl.to(overlay, { scale: endScale, ease: 'power2.in', duration: 0.55 }, 1);
        tl.to(svg!,    { scale: svgScale, ease: 'power2.in', duration: 0.55 }, 1);
        if (label) tl.to(label, { opacity: 0, ease: 'power1.in', duration: 0.35 }, 1);

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
          scrub:     1.2,
          animation: tl,
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

    // Esperar fonts: el ancho del texto define las distancias de la Fase A.
    const run = () => {
      if (document.fonts) document.fonts.ready.then(init);
      else init();
    };

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
      clearTimeout(resizeTimer);
    };
  });

  onDestroy(() => {
    ctx?.revert();
  });
</script>
