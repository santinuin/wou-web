<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import gsap from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';

  let ctx: ReturnType<typeof gsap.context> | null = null;

  // Dot = la "O" en el logo WOU (viewBox 0 0 109 37)
  const DOT_X_PCT = 54.5 / 109;
  const DOT_Y_PCT = 18   / 37;
  const DOT_R_PCT = 8.09 / 109;

  onMount(() => {
    gsap.registerPlugin(ScrollTrigger);

    const wrapper  = document.querySelector<HTMLElement>('.TSec-wrapper');
    const section  = wrapper?.querySelector<HTMLElement>('.TSec');
    const bg       = section?.querySelector<HTMLElement>('.TSec__bg');
    const group    = section?.querySelector<HTMLElement>('.TSec__group');
    const label    = section?.querySelector<HTMLElement>('.TSec__label');
    const svg      = section?.querySelector<SVGElement>('svg');
    const newsGrid = document.querySelector<HTMLElement>('.NewsGrid');

    if (!wrapper || !section || !svg) return;

    const getHeaderH = () => document.getElementById('siteHeader')?.offsetHeight ?? 0;

    // stallWrap: position fixed, z-index 1 → queda detrás del TSec-wrapper (z-index 2)
    // y del overlay (z-index 20). La TransitionSection actúa como máscara: cuando
    // su overlay y fondo se esfuman, el newsGrid se revela debajo — ya estaba ahí.
    //
    // placeholder: preserva el espacio de layout mientras stallWrap está fixed.
    // Sin él, los elementos siguientes (RedCircle, etc.) suben al espacio del wrapper.
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

      // Placeholder que ocupa el espacio del newsGrid en el flujo del documento.
      // Debe igualar la altura del stallWrap en modo static: newsGrid + paddingTop (headerH).
      // Sin este ajuste el layout shift desplaza VideosSection y rompe su ScrollTrigger.
      placeholder = document.createElement('div');
      placeholder.className = 'TSec-stall-placeholder';
      placeholder.style.height = `${newsGrid.scrollHeight + getHeaderH()}px`;
      stallWrap.before(placeholder);
    }

    // El SVG crece desde el centro del O
    gsap.set(svg, {
      transformOrigin: `${(DOT_X_PCT * 100).toFixed(2)}% ${(DOT_Y_PCT * 100).toFixed(2)}%`,
    });

    // Overlay oscuro: empieza como el dot y se expande hasta cubrir el viewport
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
      const svgRect = svg!.getBoundingClientRect();
      const secRect = section!.getBoundingClientRect();

      const dotX = svgRect.left - secRect.left + svgRect.width  * DOT_X_PCT;
      const dotY = svgRect.top  - secRect.top  + svgRect.height * DOT_Y_PCT;
      const dotR = svgRect.width * DOT_R_PCT;

      const endScale = Math.ceil(Math.hypot(secRect.width, secRect.height) / dotR) + 1;
      const svgScale = endScale * 0.35;

      gsap.set(overlay, {
        width:   dotR * 2,
        height:  dotR * 2,
        left:    dotX - dotR,
        top:     dotY - dotR,
        scale:   1,
        opacity: 1,
      });

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ paused: true });

        // Fase 1 (0→55%): dot y SVG crecen desde el O; label se esfuma
        tl.to(overlay, { scale: endScale, ease: 'power2.in', duration: 0.55 }, 0);
        tl.to(svg,     { scale: svgScale, ease: 'power2.in', duration: 0.55 }, 0);
        if (label) tl.to(label, { opacity: 0, ease: 'power1.in', duration: 0.35 }, 0);

        // Fase 2 (55→75%): fondo azul y grupo desaparecen (cubiertos por overlay)
        if (bg)    tl.to(bg,    { opacity: 0, ease: 'none', duration: 0.20 }, 0.55);
        if (group) tl.to(group, { opacity: 0, ease: 'none', duration: 0.15 }, 0.60);

        // Fase 3 (75→100%): overlay se esfuma → stallWrap emerge desde atrás.
        // El TSec (ahora transparente) se convierte en la máscara que revela el newsGrid.
        tl.to(overlay, { opacity: 0, ease: 'power1.out', duration: 0.25 }, 0.75);
        if (stallWrap) {
          tl.to(stallWrap, { opacity: 1, ease: 'power1.out', duration: 0.25 }, 0.75);
        }

        ScrollTrigger.create({
          trigger:   wrapper,
          start:     'top top',
          end:       '+=100%',
          scrub:     1.2,
          animation: tl,
        });

        // Toggle fixed ↔ static al cruzar el fin del wrapper (en ambas direcciones).
        // onEnter (scroll hacia abajo): liberar stallWrap de fixed → flujo normal.
        //   En ese instante layout.top del stallWrap == viewport.top → sin salto visual.
        //   El placeholder se elimina para no duplicar el espacio.
        // onLeaveBack (scroll hacia arriba): restaurar fixed + placeholder.
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

    if (document.readyState === 'complete') {
      init();
    } else {
      window.addEventListener('load', init, { once: true });
    }
  });

  onDestroy(() => {
    ctx?.revert();
  });
</script>
