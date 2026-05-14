<!--
  ScrollCarousel — isla Svelte que orquesta un carrusel scroll-driven con GSAP.
  Agnóstico al contenido: recibe los items como children snippet de Astro.

  Fases del timeline (scrub linkeado a ScrollTrigger):

    [0.00 → 0.75]   Intro (la "ventana" se abre)
      · mask.scale:    1 → maxScale       (ease power4.in)
      · scene.scale:   0.75 → 1           (ease power3.in)
      · inner.clipPath inset(0 1rem) → 0  (ease power3.in)
      · pointsProgress 0 → 1              (ease power4.inOut)
      · state          0 → 1              (ease power4.in)

    [0.75 → end]   Pase de items
      · items[i] progress 1 → -1          (stagger 0.25, ease slow)
      · animationProgress 0 → 10000       (continua, para letras/canvas)

    [end-1.00 → end]   Outro (la ventana se cierra)
      · state          1 → 0              (ease power4.inOut)
      · mask.scale     maxScale → 1       (ease power4.inOut)
      · scene.scale    1 → 0.75           (ease power3.inOut)
      · inner.clipPath 0 → inset(0 1rem)  (ease power3.inOut)
      · pointsProgress 1 → 0              (ease power4.inOut)

  Además de los tweens, en cada frame (gsap.ticker):
    · --scroll-progress (0..1) — driver de los translates sticky
    · moveLetters() — por ghost, --progress cíclico según animationProgress
    · drawPoints()  — puntitos en canvas, flow según animationProgress
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  type GsapModule = typeof import('gsap').gsap;
  type ScrollTriggerModule = typeof import('gsap/ScrollTrigger').default;

  interface Props {
    count: number;
    children?: Snippet;
  }

  const { count, children }: Props = $props();

  const LETTERS = ['W', 'O', 'U'];

  let host: HTMLDivElement;
  let section: HTMLElement | null = null;
  let outer: HTMLElement | null = null;
  let inner: HTMLElement | null = null;
  let scene: HTMLElement | null = null;
  let ruler: HTMLElement | null = null;
  let titleInner: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let maskEl: HTMLElement | null = null;
  let maskSvg: SVGSVGElement | null = null;
  let maskInner: SVGPathElement | null = null;
  let maskOuter: SVGPathElement | null = null;
  let maskLines: SVGPathElement | null = null;
  let items: HTMLElement[] = [];

  let maskMaxScale = 1;
  let bounding = { width: 0, height: 0 };

  type Letter = {
    el: HTMLElement;
    freq: number;
    total: number;
    ghosts: Array<{ el: HTMLSpanElement; i: number }>;
  };
  let letters: Letter[] = [];

  type Point = { x: number; y: number; dx: number; dy: number; flowX: number };
  let points: Point[] = [];

  const state = { value: 0 };
  const animationProgress = { value: 0 };
  const pointsProgress = { value: 0 };

  let gsap: GsapModule | null = null;
  let ScrollTrigger: ScrollTriggerModule | null = null;
  let tl: ReturnType<NonNullable<GsapModule>['timeline']> | null = null;

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRender = { anim: -1, pts: -1 };
  let speed = 1;

  // ── queryRefs ───────────────────────────────────────────────────────
  function queryRefs(): boolean {
    section = host.closest<HTMLElement>('.VideosSection');
    if (!section) return false;
    outer = section.querySelector<HTMLElement>('[data-outer]');
    inner = section.querySelector<HTMLElement>('[data-inner]');
    scene = section.querySelector<HTMLElement>('[data-scene]');
    ruler = section.querySelector<HTMLElement>('[data-ruler]');
    titleInner = section.querySelector<HTMLElement>('[data-title]');
    canvas = section.querySelector<HTMLCanvasElement>('[data-canvas]');
    maskEl = section.querySelector<HTMLElement>('[data-mask]');
    maskSvg = section.querySelector<SVGSVGElement>('[data-mask-svg]');
    maskInner = section.querySelector<SVGPathElement>('[data-mask-inner]');
    maskOuter = section.querySelector<SVGPathElement>('[data-mask-outer]');
    maskLines = section.querySelector<SVGPathElement>('[data-mask-lines]');
    items = Array.from(section.querySelectorAll<HTMLElement>('[data-video]'));
    ctx = canvas?.getContext('2d') ?? null;
    return Boolean(
      outer && inner && scene && ruler && titleInner && canvas && ctx &&
      maskEl && maskSvg && maskInner && maskOuter && maskLines
    );
  }

  // ── setSize ─────────────────────────────────────────────────────────
  function setSize() {
    if (!section || !canvas) return;
    section.style.setProperty('--height', `${count * 50}lvh`);

    bounding = { width: window.innerWidth, height: window.innerHeight };

    canvas.width = bounding.width;
    canvas.height = bounding.height;

    speed = Math.hypot(bounding.width, bounding.height) * 4;
  }

  // ── setCtxStyle ─────────────────────────────────────────────────────
  function setCtxStyle() {
    if (!ctx || !section) return;
    const color = getComputedStyle(section).getPropertyValue('--color-brand-green').trim();
    ctx.strokeStyle = color || '#B9FFC1';
  }

  // ── setMask ────────────────────────────────────────────────────────
  function setMask() {
    if (!maskEl || !ruler || !section || !maskSvg || !maskInner || !maskOuter || !maskLines) return;

    const width = maskEl.clientWidth;
    const height = maskEl.clientHeight;

    maskSvg.style.width = `${width}px`;
    maskSvg.style.height = `${height}px`;

    const elRect = section.getBoundingClientRect();
    const rulerRect = ruler.getBoundingClientRect();
    const rulerW = rulerRect.width;
    const rulerH = rulerRect.height;
    const offsetX = rulerRect.left - elRect.left;
    const offsetY = rulerRect.top - elRect.top;

    const dOuter = `M -1 0 L ${width + 2} 0 L ${width + 2} ${height} L -1 ${height} Z`;

    const corners = {
      tl: { x: offsetX, y: offsetY },
      tr: { x: offsetX + rulerW, y: offsetY },
      br: { x: offsetX + rulerW, y: offsetY + rulerH },
      bl: { x: offsetX, y: offsetY + rulerH },
    };

    let radius = (corners.tr.x - corners.tl.x) / 2;

    maskMaxScale = bounding.width / radius;

    let dInner =
      `M ${corners.tl.x} ${corners.tl.y + radius} ` +
      `A ${radius} ${radius} 0 0 1 ${corners.tr.x} ${corners.tr.y + radius} ` +
      `L ${corners.br.x} ${corners.br.y - radius} ` +
      `A ${radius} ${radius} 0 0 1 ${corners.bl.x} ${corners.bl.y - radius} Z`;
    const linesClip = `${dOuter} ${dInner}`;

    maskOuter.setAttribute('d', `${dOuter} ${dInner}`);

    const thickness = bounding.width > 767 ? 16 : 8;
    corners.tl.x += thickness;
    corners.tl.y += thickness;
    corners.tr.x -= thickness;
    corners.tr.y += thickness;
    corners.br.x -= thickness;
    corners.br.y -= thickness;
    corners.bl.x += thickness;
    corners.bl.y -= thickness;

    radius = (corners.tr.x - corners.tl.x) / 2;

    dInner =
      `M ${corners.tl.x} ${corners.tl.y + radius} ` +
      `A ${radius} ${radius} 0 0 1 ${corners.tr.x} ${corners.tr.y + radius} ` +
      `L ${corners.br.x} ${corners.br.y - radius} ` +
      `A ${radius} ${radius} 0 0 1 ${corners.bl.x} ${corners.bl.y - radius} Z`;

    maskInner.setAttribute('d', `${dOuter} ${dInner}`);

    const vLines = bounding.width > 767 ? 12 : 8;
    const gapX = width / vLines;
    const gapY = height * 0.1;
    const hLines = Math.ceil(height / gapY);

    let dLines = '';
    for (let i = 1; i < vLines; i++) {
      const x = gapX * i;
      dLines += `M ${x} 0 L ${x} ${height} `;
    }
    for (let i = 0; i < hLines; i++) {
      const y = gapY * i;
      dLines += `M 0 ${y} L ${width} ${y} `;
    }
    maskLines.setAttribute('d', dLines);
    maskLines.style.clipPath = `path(evenodd, '${linesClip}')`;
  }

  // ── setPoints ──────────────────────────────────────────────────────
  function setPoints() {
    points = [];
    const gap = 24;
    const cols = Math.ceil((bounding.width * 1.2) / gap);
    const rows = Math.ceil((bounding.height * 1.2) / gap);

    const offsetX = (bounding.width - cols * gap) * 0.5;
    const offsetY = (bounding.height - rows * gap) * 0.5;

    const hW = bounding.width * 0.5;
    const hH = bounding.height * 0.5;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * gap + offsetX;
        const y = j * gap + offsetY;
        points.push({ x, y, dx: hW - x, dy: hH - y, flowX: 0 });
      }
    }
  }

  // ── setLetters ─────────────────────────────────────────────────────
  function setLetters() {
    if (!titleInner || !scene) return;

    letters.forEach((l) => l.ghosts.forEach((g) => g.el.remove()));
    letters = [];

    const letterEls = Array.from(titleInner.querySelectorAll<HTMLElement>('[data-letter]'));
    const sceneRect = scene.getBoundingClientRect();
    const multiplier = bounding.width > 767 ? 0.75 : 0.5;

    letterEls.forEach((letterEl, j) => {
      const rect = letterEl.getBoundingClientRect();
      const letterW = rect.width;
      const total = Math.round((bounding.width / letterW) * multiplier) + 2;
      const top = rect.top - sceneRect.top;
      const left = rect.left - sceneRect.left;
      const freq = 1 + Math.random();

      const ghosts: Letter['ghosts'] = [];

      for (let i = 0; i < total; i++) {
        const el = document.createElement('span');
        el.className = 'VideosSection__ghost';
        el.textContent = letterEl.textContent ?? '';
        el.dataset.letter = letterEl.textContent ?? '';
        el.dataset.ghost = '';
        el.setAttribute('aria-hidden', 'true');

        const ix = i - total * 0.5;
        const iy = ((j + 1) / (letterEls.length + 1) - 0.5) * 2;
        const p = (i / total - 0.5) * 2;
        const ap = Math.abs(p);

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
        el.style.zIndex = String(j !== 1 && j !== 2 && (j + letterEls.length + i) % 5 === 0 ? 3 : 1);
        el.style.setProperty('--ix', String(ix));
        el.style.setProperty('--iy', String(iy));
        el.style.setProperty('--p', String(p));
        el.style.setProperty('--ap', String(ap));

        scene!.appendChild(el);
        ghosts.push({ el, i });
      }

      letters.push({ el: letterEl, freq, total, ghosts });
    });
  }

  // ── moveLetters / drawPoints (por frame) ───────────────────────────
  function moveLetters() {
    const ap = animationProgress.value;
    for (const letter of letters) {
      const letterSpeed = speed * letter.freq;
      const tot = letter.total;
      for (let i = 0; i < letter.ghosts.length; i++) {
        const g = letter.ghosts[i];
        const progress =
          (((ap % letterSpeed) / letterSpeed + g.i / tot) % 1) / 0.7 - 0.15;
        g.el.style.setProperty('--progress', progress.toFixed(4));
      }
    }
  }

  function drawPoints() {
    if (!ctx) return;
    const ap = animationProgress.value;
    const pp = pointsProgress.value;

    const rAp = Math.round(ap * 100) / 100;
    const rPp = Math.round(pp * 100) / 100;
    if (rAp === lastRender.anim && rPp === lastRender.pts) return;

    ctx.clearRect(0, 0, bounding.width, bounding.height);
    ctx.beginPath();

    const flowX = (ap * -0.05) % 24;
    const k = (1 - pp) * 0.2;
    for (const p of points) {
      const x = p.x + p.dx * k + flowX;
      const y = p.y + p.dy * k;
      ctx.rect(x, y, 0.5, 0.5);
    }
    ctx.stroke();

    lastRender.anim = rAp;
    lastRender.pts = rPp;
  }

  // ── updateItemsInview ──────────────────────────────────────────────
  function updateItemsInview() {
    for (const item of items) {
      const p = parseFloat(item.style.getPropertyValue('--progress') || '1');
      if (Math.abs(p) < 1) item.setAttribute('data-inview', '');
      else item.removeAttribute('data-inview');
    }
  }

  // ── Timeline ───────────────────────────────────────────────────────
  function buildTimeline() {
    if (!gsap || !ScrollTrigger || !section || !maskEl || !scene || !inner) return;

    if (tl) tl.kill();

    tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 25%',
        end: 'bottom 75%',
        scrub: 1,
      },
      onUpdate: () => {
        if (scene) scene.style.setProperty('--state', state.value.toFixed(4));
        updateItemsInview();
      },
    });

    // ── Intro (0 → 0.75): la ventana se abre ────────────────────────
    tl.fromTo(maskEl, { scale: 1 }, { scale: maskMaxScale, duration: 0.75, ease: 'power4.in' }, 0);
    tl.fromTo(scene, { scale: 0.75 }, { scale: 1, duration: 0.75, ease: 'power3.in' }, 0);
    tl.fromTo(
      inner,
      { clipPath: 'inset(0 1rem)' },
      { clipPath: 'inset(0 0rem)', duration: 0.75, ease: 'power3.in' },
      0
    );
    tl.fromTo(pointsProgress, { value: 0 }, { value: 1, duration: 1, ease: 'power4.inOut' }, 0);
    tl.fromTo(state, { value: 0 }, { value: 1, duration: 0.75, ease: 'power4.in' }, 0);

    // ── Pase de items (0.75 → end) ──────────────────────────────────
    tl.fromTo(
      items,
      { '--progress': 1 },
      {
        '--progress': -1,
        ease: 'slow(0.15, 0.6)',
        stagger: 0.25,
      },
      0.75
    );

    tl.fromTo(
      animationProgress,
      { value: 0 },
      { value: 10000, duration: tl.totalDuration(), ease: 'power1.out' },
      0.75
    );

    // ── Outro (end-1 → end): la ventana se cierra ───────────────────
    tl.fromTo(
      state,
      { value: 1 },
      { value: 0, duration: 0.75, ease: 'power4.inOut', immediateRender: false },
      '-=1'
    );
    tl.fromTo(
      maskEl,
      { scale: maskMaxScale },
      { scale: 1, duration: 0.75, ease: 'power4.inOut', immediateRender: false },
      '-=1'
    );
    tl.fromTo(
      scene,
      { scale: 1 },
      { scale: 0.75, duration: 0.75, ease: 'power3.inOut', immediateRender: false },
      '-=1'
    );
    tl.fromTo(
      inner,
      { clipPath: 'inset(0 0rem)' },
      { clipPath: 'inset(0 1rem)', duration: 0.75, ease: 'power3.inOut', immediateRender: false },
      '-=1'
    );
    tl.fromTo(
      pointsProgress,
      { value: 1 },
      { value: 0, duration: 1, ease: 'power4.inOut', immediateRender: false },
      '-=1'
    );
  }

  // ── tick (por frame) ───────────────────────────────────────────────
  function tick() {
    if (!section || !ScrollTrigger) return;
    const scrollProgress =
      Math.max(Math.min(1, ScrollTrigger.positionInViewport(section, 'top')), 0) * -1 +
      (1 - Math.max(Math.min(1, ScrollTrigger.positionInViewport(section, 'bottom')), 0));

    section.style.setProperty('--scroll-progress', scrollProgress.toFixed(4));

    moveLetters();
    drawPoints();
  }

  // ── Resize (debounced) ─────────────────────────────────────────────
  function recompute() {
    setCtxStyle();
    setSize();
    setMask();
    setPoints();
    setLetters();
    buildTimeline();
    ScrollTrigger?.refresh();
  }
  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(recompute, 200);
  }

  onMount(() => {
    let cancelled = false;

    // Set mask paths immediately (no GSAP needed) so the SVG is ready
    // before GSAP chunks finish downloading — avoids the flash on production.
    if (queryRefs()) {
      setCtxStyle();
      setSize();
      setMask();
      setPoints();
      setLetters();
      section?.setAttribute('data-mask-ready', '');
    }

    Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('gsap/EasePack'),
    ]).then(([g, st, ep]) => {
      if (cancelled) return;
      gsap = g.gsap;
      ScrollTrigger = st.default;
      const SlowMo = (ep as { SlowMo: object }).SlowMo;
      gsap.registerPlugin(ScrollTrigger, SlowMo);

      if (!queryRefs()) return;

      recompute();

      gsap.ticker.add(tick);
      tick();
    });

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (gsap) gsap.ticker.remove(tick);
      if (tl) tl.kill();
      letters.forEach((l) => l.ghosts.forEach((g) => g.el.remove()));
      letters = [];
    };
  });
</script>

<div bind:this={host} class="ScrollCarousel__host">
  {@render children?.()}
</div>

<style>
  /* Host con caja real (no display:contents): el IntersectionObserver
     del client:visible de Astro necesita medir algo que ocupe espacio. */
  .ScrollCarousel__host {
    position: absolute;
    inset: 0;
    display: block;
  }
</style>
