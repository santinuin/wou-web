<!--
  ProgramsAnimation — isla Svelte que orquesta la animación scroll-driven
  de la sección Programs. Inspirada en wodniack.dev/work.

  Responsabilidades:
    - Construir los paths SVG de la máscara píldora (depende del ruler).
    - Inyectar las letras "ghost" (W O U repetidas) dentro de la escena.
    - Driver de scroll vía GSAP ScrollTrigger (scrub).
    - Lerp del scroll progress en gsap.ticker para suavizar.
    - Por cada item: calcular --progress local en función del global.
    - Recompute completo en resize (debounced).

  Performance:
    - client:visible — GSAP no se descarga hasta que la sección entra al
      viewport. Pesa ~70kb gzipped (gsap + ScrollTrigger).
    - Cleanup completo en $effect → return: ScrollTrigger.kill, ticker
      remove, ghosts removidos del DOM, listeners abortados.
    - El consumidor (.astro) inyecta el markup via children/snippet; esta
      isla NO renderiza items: los toma del DOM y les setea CSS vars.

  Decisiones que difieren del original wodniack:
    - Sin canvas decorativo (línea de puntos). Simplificación.
    - Sin escena 3D con perspective heavy. Mantengo perspective leve.
    - Mask "abierta" desde el inicio (no se anima entrada/salida con scale).
      Razón: la sección sigue de RedCircle (otra animación full-viewport),
      una entrada con expansión adicional sería ruido visual.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  type GsapModule = typeof import('gsap').gsap;
  type ScrollTriggerModule = typeof import('gsap/ScrollTrigger').default;
  type ScrollTriggerInstance = ReturnType<ScrollTriggerModule['create']>;

  interface Props {
    /** Cantidad de programas — driver del cálculo per-item progress y altura. */
    count: number;
    children?: Snippet;
  }

  const { count, children }: Props = $props();

  // ── Constantes de animación ─────────────────────────────────────────────
  const SCROLL_PER_ITEM_LVH = 40; // 40lvh por programa → N items = N*40lvh scroll
  const LERP_FACTOR = 0.12; // suavizado por frame del scroll progress
  const GHOST_LETTERS = ['W', 'O', 'U']; // 3 filas × ghosts horizontales
  // Ítem visible (content-visibility) cuando |progress| < este umbral.
  // 1.4 deja un colchón para no parpadear en los bordes.
  const ITEM_INVIEW_THRESHOLD = 1.4;
  // Phase split: [0, PHASE2_START) → sweep clásico; [PHASE2_START, 1] →
  // la píldora se abre como ventana y los items caen en posición.
  const PHASE2_START = 0.65;

  let host: HTMLDivElement;
  let section: HTMLElement | null = null;
  let sticky: HTMLElement | null = null;
  let scene: HTMLElement | null = null;
  let ruler: HTMLElement | null = null;
  let title: HTMLElement | null = null;
  let maskSvg: SVGSVGElement | null = null;
  let maskInner: SVGPathElement | null = null;
  let maskOuter: SVGPathElement | null = null;
  let maskLines: SVGPathElement | null = null;
  let items: HTMLElement[] = [];

  type Ghost = {
    el: HTMLSpanElement;
    /** Offset horizontal (índice respecto al centro). */
    ix: number;
    /** Fila vertical (-1..1 según letra). */
    iy: number;
    /** Opacidad base. */
    opacity: number;
    /** Y absoluta dentro de la escena (px desde top del sticky). */
    y: number;
    /** X absoluta dentro de la escena. */
    x: number;
  };
  let ghosts: Ghost[] = [];

  let gsap: GsapModule | null = null;
  let ScrollTrigger: ScrollTriggerModule | null = null;
  let trigger: ScrollTriggerInstance | null = null;

  let targetProgress = 0;
  let currentProgress = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  // Factor de escala máximo que la píldora debe alcanzar para cubrir el
  // viewport completo. Se recalcula en buildMask() según sticky/ruler.
  let maxScale = 8;

  function queryRefs() {
    section = host.closest<HTMLElement>('.ProgramsSection');
    if (!section) return false;
    sticky = section.querySelector<HTMLElement>('[data-sticky]');
    scene = section.querySelector<HTMLElement>('[data-scene]');
    ruler = section.querySelector<HTMLElement>('[data-ruler]');
    title = section.querySelector<HTMLElement>('[data-title]');
    maskSvg = section.querySelector<SVGSVGElement>('[data-mask-svg]');
    maskInner = section.querySelector<SVGPathElement>('[data-mask-inner]');
    maskOuter = section.querySelector<SVGPathElement>('[data-mask-outer]');
    maskLines = section.querySelector<SVGPathElement>('[data-mask-lines]');
    items = Array.from(section.querySelectorAll<HTMLElement>('[data-program]'));
    return Boolean(sticky && scene && ruler && maskSvg && maskInner && maskOuter && maskLines);
  }

  function setSectionHeight() {
    if (!section) return;
    // N * 40lvh — escala con la cantidad de programas. Mínimo 200lvh.
    const h = Math.max(200, count * SCROLL_PER_ITEM_LVH);
    section.style.setProperty('--height', `${h}lvh`);
  }

  /** Construye los paths SVG de la píldora a partir de la posición del ruler. */
  function buildMask() {
    if (!sticky || !ruler || !maskSvg || !maskInner || !maskOuter || !maskLines) return;
    const sRect = sticky.getBoundingClientRect();
    const rRect = ruler.getBoundingClientRect();
    const W = sRect.width;
    const H = sRect.height;

    maskSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    maskSvg.setAttribute('preserveAspectRatio', 'none');

    const rx = rRect.width;
    const ry = rRect.height;
    const rl = rRect.left - sRect.left;
    const rt = rRect.top - sRect.top;

    // Escala necesaria para que la píldora cubra el viewport completo:
    // horizontalmente rx*S ≥ W, verticalmente ry*S ≥ H. Tomamos el máximo
    // de ambos ratios. La píldora es alta y angosta, así que el ancho
    // suele ser el constrain. ×1.2 de margen por si el origin no queda
    // perfectamente centrado tras un refresh de ScrollTrigger.
    maxScale = Math.max(W / rx, H / ry) * 1.2;

    // Rectángulo viewport (el "agujero" exterior con evenodd).
    const viewportRect = `M -1 -1 L ${W + 1} -1 L ${W + 1} ${H + 1} L -1 ${H + 1} Z`;

    // Píldora exterior (radio = ancho/2).
    const r1 = rx / 2;
    const c1 = {
      tl: { x: rl, y: rt },
      tr: { x: rl + rx, y: rt },
      br: { x: rl + rx, y: rt + ry },
      bl: { x: rl, y: rt + ry },
    };
    const pillOuter =
      `M ${c1.tl.x} ${c1.tl.y + r1} ` +
      `A ${r1} ${r1} 0 0 1 ${c1.tr.x} ${c1.tr.y + r1} ` +
      `L ${c1.br.x} ${c1.br.y - r1} ` +
      `A ${r1} ${r1} 0 0 1 ${c1.bl.x} ${c1.bl.y - r1} Z`;
    maskOuter.setAttribute('d', `${viewportRect} ${pillOuter}`);

    // Píldora interior (8-12px más chica → grosor del borde).
    const inset = window.innerWidth > 767 ? 12 : 8;
    const c2 = {
      tl: { x: c1.tl.x + inset, y: c1.tl.y + inset },
      tr: { x: c1.tr.x - inset, y: c1.tr.y + inset },
      br: { x: c1.br.x - inset, y: c1.br.y - inset },
      bl: { x: c1.bl.x + inset, y: c1.bl.y - inset },
    };
    const r2 = (c2.tr.x - c2.tl.x) / 2;
    const pillInner =
      `M ${c2.tl.x} ${c2.tl.y + r2} ` +
      `A ${r2} ${r2} 0 0 1 ${c2.tr.x} ${c2.tr.y + r2} ` +
      `L ${c2.br.x} ${c2.br.y - r2} ` +
      `A ${r2} ${r2} 0 0 1 ${c2.bl.x} ${c2.bl.y - r2} Z`;
    maskInner.setAttribute('d', `${viewportRect} ${pillInner}`);

    // Líneas de grilla — dan textura "scanline" dentro de la píldora.
    const cols = window.innerWidth > 767 ? 10 : 6;
    const rows = 10;
    const colStep = W / cols;
    const rowStep = H / rows;
    let lines = '';
    for (let i = 1; i < cols; i++) {
      const x = colStep * i;
      lines += `M ${x} 0 L ${x} ${H} `;
    }
    for (let i = 1; i < rows; i++) {
      const y = rowStep * i;
      lines += `M 0 ${y} L ${W} ${y} `;
    }
    maskLines.setAttribute('d', lines);
    // Clipea las líneas al hueco de la píldora (sólo se ven dentro).
    maskLines.style.clipPath = `path('${pillOuter}')`;
  }

  /** Genera y posiciona las letras ghost en la escena. */
  function buildGhosts() {
    if (!scene || !sticky || !title) return;

    // Limpiar ghosts previos
    ghosts.forEach((g) => g.el.remove());
    ghosts = [];

    const sceneRect = sticky.getBoundingClientRect();
    const W = sceneRect.width;
    const H = sceneRect.height;

    // Determinar la altura de cada glifo a partir del title invisible.
    const letterEls = title.querySelectorAll<HTMLElement>('[data-letter]');
    if (!letterEls.length) return;
    const letterRect = letterEls[0].getBoundingClientRect();
    const letterW = letterRect.width;
    const letterH = letterRect.height;

    // Total de ghosts horizontales por fila — densidad relativa al ancho viewport.
    // En mobile reducimos drasticamente para no saturar.
    const density = window.innerWidth > 767 ? 0.65 : 0.4;
    const total = Math.max(3, Math.round((W / letterW) * density) + 2);

    // Step horizontal entre ghosts (px) — en CSS usamos --ghost-step.
    const step = letterW * 1.0;
    scene.style.setProperty('--ghost-step', `${step}px`);

    // Y central de la fila i (3 letras → 3 filas centradas verticalmente).
    const rowGap = letterH * 0.92;
    const totalRowsHeight = rowGap * GHOST_LETTERS.length;
    const firstRowY = (H - totalRowsHeight) / 2 + letterH / 2;

    for (let row = 0; row < GHOST_LETTERS.length; row++) {
      const letter = GHOST_LETTERS[row];
      const y = firstRowY + row * rowGap;
      // iy: -1..+1 según fila (top → bottom).
      const iy = ((row + 0.5) / GHOST_LETTERS.length - 0.5) * 2;

      for (let i = 0; i < total; i++) {
        const ix = i - (total - 1) / 2; // centrado
        const span = document.createElement('span');
        span.dataset.ghost = '';
        span.textContent = letter;
        span.setAttribute('aria-hidden', 'true');

        // Opacidad: las del centro más visibles, las de los bordes más fade.
        const distNorm = Math.abs(ix) / ((total - 1) / 2 || 1);
        const opacity = 0.06 + (1 - distNorm) * 0.1;

        // Algunas letras delante de la píldora (z-index 4 vs 1) para profundidad.
        const inFront = (row + i) % 6 === 0 && row !== 1;
        span.style.zIndex = String(inFront ? 4 : 1);

        span.style.setProperty('--ix', String(ix));
        span.style.setProperty('--iy', String(iy));
        span.style.setProperty('--ghost-x', `${W / 2}px`);
        span.style.setProperty('--ghost-y', `${y}px`);
        span.style.setProperty('--ghost-opacity', opacity.toFixed(3));

        scene.appendChild(span);
        ghosts.push({ el: span, ix, iy, opacity, y, x: W / 2 });
      }
    }
  }

  /** Recalcula --progress y visibilidad de cada item según scroll global. */
  function updateItems(p: number, reveal: number) {
    // Fórmula: cada item i centra su progreso a scroll = (i+1)/(N+1).
    // itemProgress[i] = p * (N+1) - (i+1) → barre [-1, +1] dentro de su ventana.
    const denom = count + 1;
    for (let i = 0; i < items.length; i++) {
      const ip = p * denom - (i + 1);
      items[i].style.setProperty('--progress', ip.toFixed(4));
      // Durante reveal mantenemos todos los items en escena: el CSS los
      // interpola hacia sus rest-positions aun cuando --progress quedara
      // fuera del rango de sweep.
      const inview = reveal > 0.02 || Math.abs(ip) < ITEM_INVIEW_THRESHOLD;
      if (inview) items[i].setAttribute('data-inview', '');
      else items[i].removeAttribute('data-inview');
    }
  }

  /** Setea --ghost-progress por ghost. Cada uno está desfasado en X. */
  function updateGhosts(p: number, reveal: number) {
    if (!scene) return;
    // Todos los ghosts comparten el mismo progress global, pero vía
    // --ix individual fluyen lateralmente con --state como amplitud.
    // p∈[0,1] → state grows in middle, fades at edges (entry/exit).
    // bell curve: 1 - (2p - 1)²
    const bell = Math.max(0, 1 - Math.pow(2 * p - 1, 2));
    // Durante la apertura de la ventana (reveal>0) dejamos las letras
    // completamente visibles — forman el fondo del lienzo final.
    const state = Math.max(bell, reveal);
    scene.style.setProperty('--state', state.toFixed(3));
    // ghost-progress común — driver de --head en el CSS scoped.
    scene.style.setProperty('--ghost-progress', p.toFixed(4));
    for (const g of ghosts) g.el.style.setProperty('--ghost-progress', p.toFixed(4));
  }

  /** smoothstep(0,1,x) — curva S clásica usada para suavizar el reveal. */
  function smoothstep(x: number) {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  }

  function tick() {
    if (!section) return;
    // Lerp suaviza saltos del scroll cuando el navegador throttlea.
    currentProgress += (targetProgress - currentProgress) * LERP_FACTOR;
    if (Math.abs(targetProgress - currentProgress) < 0.0001) {
      currentProgress = targetProgress;
    }
    section.style.setProperty('--scroll-progress', currentProgress.toFixed(4));

    // reveal: 0 durante phase 1 (sweep); 0→1 durante phase 2 (apertura
    // de ventana). La píldora escala con esto hasta cubrir todo el
    // viewport; los items transitan a sus posiciones de descanso.
    const raw = (currentProgress - PHASE2_START) / (1 - PHASE2_START);
    const reveal = smoothstep(raw);
    section.style.setProperty('--reveal', reveal.toFixed(4));
    const scale = 1 + reveal * (maxScale - 1);
    section.style.setProperty('--mask-scale', scale.toFixed(3));

    updateItems(currentProgress, reveal);
    updateGhosts(currentProgress, reveal);
  }

  function recompute() {
    setSectionHeight();
    buildMask();
    buildGhosts();
    if (ScrollTrigger) ScrollTrigger.refresh();
  }

  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(recompute, 200);
  }

  onMount(() => {
    let cancelled = false;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([g, st]) => {
      if (cancelled) return;
      gsap = g.gsap;
      ScrollTrigger = st.default;
      gsap.registerPlugin(ScrollTrigger);

      if (!queryRefs()) return;
      setSectionHeight();
      buildMask();
      buildGhosts();

      trigger = ScrollTrigger.create({
        trigger: section!,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          targetProgress = self.progress;
        },
      });

      gsap.ticker.add(tick);
      // Tick inicial para asentar valores antes del primer scroll
      tick();
    });

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (gsap) gsap.ticker.remove(tick);
      if (trigger) trigger.kill();
      ghosts.forEach((g) => g.el.remove());
      ghosts = [];
      trigger = null;
    };
  });
</script>

<!-- Wrapper "host" con caja real (no display:contents): el observer de
     `client:visible` de Astro mide la posición del wrapper inyectado, y
     un wrapper sin caja no se detecta como visible → la isla nunca
     hidrata. Posicionamos absoluto sobre la sección para no afectar el
     flow del sticky interno. -->
<div bind:this={host} class="ProgramsAnimation__host">
  {@render children?.()}
</div>

<style>
  .ProgramsAnimation__host {
    position: absolute;
    inset: 0;
    display: block;
  }
</style>
