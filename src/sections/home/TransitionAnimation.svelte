<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import gsap from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';

  let ctx: ReturnType<typeof gsap.context> | null = null;

  onMount(() => {
    gsap.registerPlugin(ScrollTrigger);

    const wrapper  = document.querySelector<HTMLElement>('.TSec-wrapper');
    const section  = wrapper?.querySelector<HTMLElement>('.TSec');
    const bg       = section?.querySelector<HTMLElement>('.TSec__bg');
    const group    = section?.querySelector<HTMLElement>('.TSec__group');
    const svg      = section?.querySelector<SVGElement>('svg');
    const newsGrid = document.querySelector<HTMLElement>('.NewsGrid');

    if (!wrapper || !section || !svg) return;

    if (newsGrid) gsap.set(newsGrid, { opacity: 0 });

    // Overlay: empieza como el dot y se expande hasta cubrir todo el viewport
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

      // Dot (la "O" entre W y U!) en viewBox 0 0 109 37:
      //   centro ≈ (54.5/109, 18/37), radio ≈ 8.09/109 del ancho del SVG
      const dotX = svgRect.left - secRect.left + svgRect.width  * (54.5 / 109);
      const dotY = svgRect.top  - secRect.top  + svgRect.height * (18   / 37);
      const dotR = svgRect.width * (8.09 / 109);

      const endScale = Math.ceil(Math.hypot(secRect.width, secRect.height) / dotR) + 1;

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

        // Fase 1 (0 → 55 %): dot se expande hasta llenar el viewport
        tl.to(overlay, { scale: endScale, ease: 'power2.in', duration: 0.55 });

        // Fase 2 (55 → 75 %): fondo azul y grupo de texto desaparecen
        //   (el overlay los cubre — el cambio no se ve)
        tl.to([bg, group].filter(Boolean), { opacity: 0, ease: 'none', duration: 0.2 }, 0.55);

        // Fase 3 (75 → 100 %): overlay se desvanece → NewsGrid aparece
        tl.to(overlay,  { opacity: 0, ease: 'power1.out', duration: 0.25 }, 0.75);
        tl.to(newsGrid, { opacity: 1, ease: 'none',       duration: 0.25 }, 0.75);

        ScrollTrigger.create({
          trigger:   wrapper,
          start:     'top top',
          // La animación dura exactamente 100vh (mientras la sección es sticky).
          // Al terminar, la sección es transparente y scrollea hacia arriba;
          // el body background (dark) y el NewsGrid (dark) se ven seamless.
          end:       '+=100%',
          scrub:     1.2,
          animation: tl,
        });
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
