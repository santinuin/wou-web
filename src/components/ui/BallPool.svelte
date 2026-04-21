<!--
  BallPool — isla Svelte que ejecuta el motor de física Matter.js sobre los
  `<li>` renderizados por el slot. Matter.js NO usa canvas: solo calcula
  posición y rotación de cada cuerpo, y este componente sincroniza esos
  valores al DOM vía `transform: translate(x,y) rotate(rad)` en cada frame.

  El padre (RedCircle.astro) provee el markup de cada bola (con <Image> de
  Astro ya optimizada). Aquí solo añadimos física y drag. Esto mantiene:
    - build-time image optimization en Astro
    - zero JS en el hidrato inicial hasta que la sección entra al viewport
    - separación limpia: la isla es genérica y reusable
-->
<script lang="ts">
  // Matter.js toca `window` al evaluarse, por lo que se importa dinámicamente
  // en onMount para no romper el SSR de Astro (prerender estático).
  import type MatterNS from 'matter-js';

  let Matter: typeof MatterNS | null = null;

  // ── Parámetros de física (ajustar sensación del pool) ────────────────────
  const GRAVITY_SCALE = 0.0011;
  const RESTITUTION = 0.45;
  const FRICTION = 0.05;
  const FRICTION_AIR = 0.015;
  const MOUSE_STIFFNESS = 0.2;
  const WALL_THICKNESS = 200;

  // Cada bola tiene un tamaño relativo para que la composición no sea uniforme.
  // Factor aplicado sobre `--ball-size` leída desde CSS.
  const SIZE_VARIATIONS = [1.0, 0.72, 1.15, 0.85, 1.3, 0.95, 1.05, 0.8];

  interface Props {
    children?: import('svelte').Snippet;
  }
  const { children }: Props = $props();

  let container: HTMLUListElement;
  let items: HTMLElement[] = [];
  let engine: MatterNS.Engine | null = null;
  let runner: MatterNS.Runner | null = null;
  let bodies: MatterNS.Body[] = [];
  let frameId = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let ceilingTimer: ReturnType<typeof setTimeout> | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let dragListenersCtrl: AbortController | null = null;
  let ready = $state(false);

  // Umbral en px para considerar que el puntero se movió lo suficiente como
  // para clasificar la interacción como "arrastre" en lugar de "click".
  const DRAG_THRESHOLD = 6;

  function getCssBallSize(): number {
    const v = getComputedStyle(container).getPropertyValue('--ball-size').trim();
    if (v.endsWith('px')) return parseFloat(v);
    if (v.endsWith('vw')) return (parseFloat(v) / 100) * window.innerWidth;
    const num = parseFloat(v);
    return Number.isFinite(num) ? num : 220;
  }

  function init() {
    if (!Matter) return;
    const { Engine, Runner, Bodies, Composite, Mouse, MouseConstraint } = Matter;

    items = Array.from(container.querySelectorAll<HTMLElement>('.BallPool--ball'));
    if (!items.length) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const baseSize = getCssBallSize();

    // Aplicar tamaños variables a cada bola antes de crear cuerpos físicos
    items.forEach((li, i) => {
      const factor = SIZE_VARIATIONS[i % SIZE_VARIATIONS.length];
      const size = Math.round(baseSize * factor);
      li.style.setProperty('--ball-individual-size', size + 'px');
    });

    engine = Engine.create({ gravity: { x: 0, y: 1, scale: GRAVITY_SCALE } });
    runner = Runner.create();

    const wallOpts: MatterNS.IChamferableBodyDefinition = {
      isStatic: true,
      render: { visible: false },
    };
    // Caja: suelo + paredes laterales. El techo se agrega DESPUÉS de que los
    // cuerpos hayan terminado de entrar desde arriba (ver ceilingTimer) —
    // si se agregara ahora, los cuerpos (con y < 0) quedarían atrapados
    // fuera del viewport y no podrían caer.
    const floor = Bodies.rectangle(
      width / 2,
      height + WALL_THICKNESS / 2,
      width + WALL_THICKNESS * 2,
      WALL_THICKNESS,
      wallOpts,
    );
    const leftWall = Bodies.rectangle(
      -WALL_THICKNESS / 2,
      height / 2,
      WALL_THICKNESS,
      height * 3,
      wallOpts,
    );
    const rightWall = Bodies.rectangle(
      width + WALL_THICKNESS / 2,
      height / 2,
      WALL_THICKNESS,
      height * 3,
      wallOpts,
    );
    const ceiling = Bodies.rectangle(
      width / 2,
      -WALL_THICKNESS / 2,
      width + WALL_THICKNESS * 2,
      WALL_THICKNESS,
      wallOpts,
    );
    Composite.add(engine.world, [floor, leftWall, rightWall]);

    // Las bolas caen agrupadas desde el centro horizontal con una pequeña
    // dispersión aleatoria. Se spawneen JUSTO por encima del borde superior
    // visible (y < 0 con `overflow: hidden` las oculta) para que la caída
    // suceda dentro del área visible al usuario y se vea "amontonada".
    const CLUSTER_WIDTH = Math.min(width * 0.25, 320);
    const centerX = width / 2;

    bodies = items.map((li, i) => {
      const jitterX = (Math.random() - 0.5) * CLUSTER_WIDTH;
      const startX = centerX + jitterX;

      const factor = SIZE_VARIATIONS[i % SIZE_VARIATIONS.length];
      const radius = (baseSize * factor) / 2;
      // Pequeño stagger vertical — las primeras bolas arrancan apenas sobre
      // el borde superior, las siguientes un poco más arriba. Todas caen
      // visiblemente dentro del viewport.
      const startY = -radius - i * (radius * 0.45) - Math.random() * 40;
      const body = Bodies.circle(startX, startY, radius, {
        restitution: RESTITUTION,
        friction: FRICTION,
        frictionAir: FRICTION_AIR,
        density: 0.002,
        render: { visible: false },
      });
      Composite.add(engine!.world, body);
      return body;
    });

    const mouse = Mouse.create(container);
    mouse.pixelRatio = window.devicePixelRatio || 1;
    // Matter enlaza un `mousewheel` con preventDefault() que bloquea el scroll
    // de la página cuando el cursor está sobre la sección. No usamos wheel
    // para física, así que lo removemos. El handler no está tipado en la API
    // pública pero vive en `mouse.mousewheel`.
    const wheelHandler = (mouse as unknown as { mousewheel: EventListener })
      .mousewheel;
    if (wheelHandler) {
      container.removeEventListener('wheel', wheelHandler);
      container.removeEventListener('DOMMouseScroll', wheelHandler);
      container.removeEventListener('mousewheel', wheelHandler);
    }
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: MOUSE_STIFFNESS,
        render: { visible: false },
      },
    });
    Composite.add(engine.world, mouseConstraint);

    // Permitir scroll vertical de la página cuando el usuario no está arrastrando.
    // Matter.js reemplaza los listeners por defecto; los volvemos pasivos.
    // Solo bloqueamos touchmove cuando hay un drag activo.
    container.addEventListener(
      'touchmove',
      (e) => {
        if (mouseConstraint.body) e.preventDefault();
      },
      { passive: false },
    );

    // Arrancamos el Runner solo cuando la sección entra realmente al viewport.
    // `client:visible` puede hidratar antes de que el usuario vea el contenido
    // (threshold 0) — si corriera la simulación desde ahí, las bolas podrían
    // asentarse antes de que el usuario mire la sección.
    const startSim = () => {
      if (!Matter || !engine || !runner) return;
      Matter.Runner.run(runner, engine);
      // Cerramos la "caja" agregando el techo una vez que todos los cuerpos
      // ya terminaron de entrar al viewport desde arriba. Con un spawn y
      // caída típica de ~1.5s, 2s es un margen cómodo sin ser perceptible
      // como "espera".
      ceilingTimer = setTimeout(() => {
        if (engine) Composite.add(engine.world, ceiling);
      }, 2000);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.25) {
            startSim();
            io.disconnect();
            break;
          }
        }
      },
      { threshold: [0, 0.25, 0.5] },
    );
    io.observe(container);
    intersectionObserver = io;

    // ── Drag vs click ─────────────────────────────────────────────────────
    // Si el usuario arrastra una bola y suelta el click, NO debe navegar al
    // link. Solo un click "limpio" (sin movimiento significativo) dispara
    // la navegación. Usamos pointer events y cancelamos el click en fase
    // de captura cuando detectamos arrastre.
    dragListenersCtrl = new AbortController();
    const { signal } = dragListenersCtrl;
    let pointerStart: { x: number; y: number } | null = null;
    let wasDragged = false;
    container.addEventListener(
      'pointerdown',
      (e) => {
        pointerStart = { x: e.clientX, y: e.clientY };
        wasDragged = false;
      },
      { signal },
    );
    container.addEventListener(
      'pointermove',
      (e) => {
        if (!pointerStart) return;
        const dx = e.clientX - pointerStart.x;
        const dy = e.clientY - pointerStart.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) wasDragged = true;
      },
      { signal },
    );
    container.addEventListener(
      'click',
      (e) => {
        if (wasDragged) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      { signal, capture: true },
    );
    container.addEventListener(
      'pointerup',
      () => {
        pointerStart = null;
      },
      { signal },
    );
    // Cancelar drag nativo: si el pointer se cancela fuera, reseteamos.
    container.addEventListener(
      'pointercancel',
      () => {
        pointerStart = null;
        wasDragged = false;
      },
      { signal },
    );

    const tick = () => {
      frameId = requestAnimationFrame(tick);
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const li = items[i];
        if (!li) continue;
        const { x, y } = body.position;
        // Las bolas usan margin negativo del 50% para centrar visualmente.
        li.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
      }
    };
    tick();

    ready = true;
  }

  function destroy() {
    if (intersectionObserver) intersectionObserver.disconnect();
    intersectionObserver = null;
    if (ceilingTimer) clearTimeout(ceilingTimer);
    ceilingTimer = null;
    if (dragListenersCtrl) dragListenersCtrl.abort();
    dragListenersCtrl = null;
    if (frameId) cancelAnimationFrame(frameId);
    if (Matter) {
      if (runner) Matter.Runner.stop(runner);
      if (engine) {
        Matter.World.clear(engine.world, false);
        Matter.Engine.clear(engine);
      }
    }
    frameId = 0;
    runner = null;
    engine = null;
    bodies = [];
    ready = false;
  }

  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      destroy();
      init();
    }, 250);
  }

  // `$effect` solo corre en el cliente — evitamos el problema de Svelte 5
  // donde `onDestroy` se ejecuta también durante SSR para cleanup y rompe
  // al tocar APIs del browser como `window.removeEventListener`.
  $effect(() => {
    let cancelled = false;
    import('matter-js').then((mod) => {
      if (cancelled) return;
      Matter = (mod.default ?? mod) as typeof MatterNS;
      init();
    });
    window.addEventListener('resize', handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      destroy();
    };
  });
</script>

<ul
  bind:this={container}
  class="BallPool"
  class:is-ready={ready}
  aria-label="Círculo Rojo — explorá arrastrando las bolas"
>
  {@render children?.()}
</ul>

<style>
  .BallPool {
    position: absolute;
    inset: 0;
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
    cursor: grab;
    touch-action: pan-y;
  }
  .BallPool:active {
    cursor: grabbing;
  }
  /* Los <li> están ocultos hasta que Matter.js calcula la primera posición,
     para evitar el flash del layout "apilado arriba-izquierda". */
  .BallPool :global(.BallPool--ball) {
    visibility: hidden;
  }
  .BallPool.is-ready :global(.BallPool--ball) {
    visibility: visible;
  }
</style>
