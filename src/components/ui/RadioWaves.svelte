<!--
  RadioWaves — dos grupos de olas viajando de derecha a izquierda por morfeo de path.

  Cada grupo es un conjunto de franjas horizontales con un "bump" (protuberancia)
  cuya posición X se anima con GSAP de derecha a izquierda.

  GRUPO SUPERIOR (7 franjas): bump hacia ARRIBA (dir = -1), bumpX inicial = 190
  GRUPO INFERIOR (7 franjas): bump hacia ABAJO  (dir = +1), bumpX inicial = 125

  El offset de ~65 px entre grupos reproduce el aspecto del SVG original y
  mantiene la separación visual durante toda la animación (mismo SPEED → offset fijo).

  Fórmula del bump:
    d   = x − bumpX
    if |d| ≥ BUMP_W → 0 (zona plana)
    else             → amp × (cos(d/BUMP_W × π) + 1) / 2   (arco coseno suave)

  Los parámetros de cada franja se derivan de los V-commands del SVG original:
    baseY   = y del baseline de la arista superior
    bandH   = grosor de la franja (V_bottom − V_top)
    bumpAmp = desplazamiento máximo del pico
-->
<script>
  import { gsap } from "gsap";
  import { onDestroy, onMount } from "svelte";

  let svgEl;
  let tweenTop, tweenBot;

  // ── Parámetros extraídos del SVG original ───────────────────────────────
  // TOP: bump sube (restamos). Amplitudes decrecen de afuera hacia adentro.
  const TOP_BANDS = [
    { baseY: 25.0641, bandH: 2.867, bumpAmp: 29.32 }, // Igual al último de abajo
    { baseY: 31.2717, bandH: 2.964, bumpAmp: 25.19 },
    { baseY: 37.6674, bandH: 3.0513, bumpAmp: 22.09 },
    { baseY: 44.2602, bandH: 3.1428, bumpAmp: 18.53 },
    { baseY: 51.0641, bandH: 3.2437, bumpAmp: 14.77 },
    { baseY: 58.0838, bandH: 3.3445, bumpAmp: 10.97 },
    { baseY: 65.3005, bandH: 3.4455, bumpAmp: 10.5 },
  ];

  // BOT: bump baja (sumamos). Amplitudes crecen de afuera hacia adentro.
  // Derivadas de los control-points máximos de cada return-curve.
  const BOT_BANDS = [
    { baseY: 70.9575, bandH: 3.4455, bumpAmp: 10.5 },
    { baseY: 78.2843, bandH: 3.3445, bumpAmp: 10.97 },
    { baseY: 85.3999, bandH: 3.2437, bumpAmp: 14.77 },
    { baseY: 92.3001, bandH: 3.1428, bumpAmp: 18.53 },
    { baseY: 98.9897, bandH: 3.0513, bumpAmp: 22.09 },
    { baseY: 105.477, bandH: 2.964, bumpAmp: 25.19 },
    { baseY: 111.776, bandH: 2.867, bumpAmp: 29.32 },
  ];

  const BUMP_W = 100; // radio del bump (px en viewBox)
  const SPEED = 40; // px/s — misma velocidad para ambos grupos

  const BX_TOP0 = 0; // posición inicial top (coincide con SVG original)
  const BX_BOT0 = 0; // posición inicial bot (coincide con SVG original)

  // Generamos puntos cada 15px para tener una curva de alta resolución
  const XS = [];
  for (let x = -15; x <= 350; x += 15) {
    XS.push(x);
  }

  // ── Generación de path ──────────────────────────────────────────────────

  // Devuelve 0 en los bordes (x≈−5 y x≈330) y 1 en el centro.
  // Smoothstep: derivada = 0 en los extremos → la curva llega tangente al borde (redondeada).
  const EDGE_W = 100;
  function edgeDamp(x) {
    const t = Math.max(0, Math.min(1, (x - (-5)) / EDGE_W));
    const u = Math.max(0, Math.min(1, (330 - x) / EDGE_W));
    const s = Math.min(t, u);
    return s * s * (3 - 2 * s); // smoothstep
  }

  function bumpOffset(x, bumpX, amp) {
    const d = x - bumpX;
    return (amp * Math.cos((d / BUMP_W) * Math.PI)) * edgeDamp(x);
  }

  // Catmull-Rom → Cubic Bezier (solo comandos C, sin M inicial)
  function curveFrom(pts) {
    let d = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = (p1.x + (p2.x - p0.x) / 6).toFixed(2);
      const c1y = (p1.y + (p2.y - p0.y) / 6).toFixed(3);
      const c2x = (p2.x - (p3.x - p1.x) / 6).toFixed(2);
      const c2y = (p2.y - (p3.y - p1.y) / 6).toFixed(3);
      d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y.toFixed(3)}`;
    }
    return d;
  }

  // dir = -1 → bump hacia arriba (top group)
  // dir = +1 → bump hacia abajo  (bot group)
  function genPath({ baseY, bandH, bumpAmp }, bumpX, dir) {
    const off = (x) => dir * bumpOffset(x, bumpX, bumpAmp);
    const top = XS.map((x) => ({ x, y: baseY + off(x) }));
    const bot = XS.map((x) => ({ x, y: baseY + bandH + off(x) }));
    const botR = [...bot].reverse();
    return (
      `M${top[0].x} ${top[0].y.toFixed(3)}` +
      curveFrom(top) +
      `L${botR[0].x} ${botR[0].y.toFixed(3)}` +
      curveFrom(botR) +
      "Z"
    );
  }

  // ── Animación ───────────────────────────────────────────────────────────

  const WAVE_PERIOD = BUMP_W * 2; // El ancho de una ola completa (valle + cresta)

  function animateGroup(paths, bands, dir, bx0, tweenKey) {
    const state = { bumpX: bx0 };
    const update = () =>
      paths.forEach((p, i) =>
        p.setAttribute("d", genPath(bands[i], state.bumpX, dir)),
      );

    update(); // frame inicial

    // Loop perfecto: desplazamos la onda exactamente un periodo hacia la izquierda
    const t = gsap.to(state, {
      bumpX: bx0 - WAVE_PERIOD,
      duration: WAVE_PERIOD / SPEED,
      ease: "none",
      repeat: -1, // Repetición infinita sin saltos
      onUpdate: update,
    });

    if (tweenKey === "top") tweenTop = t;
    else tweenBot = t;
  }

  onMount(() => {
    const topPaths = Array.from(svgEl.querySelectorAll("[data-top]"));
    const botPaths = Array.from(svgEl.querySelectorAll("[data-bot]"));
    animateGroup(topPaths, TOP_BANDS, -1, BX_TOP0, "top");
    animateGroup(botPaths, BOT_BANDS, -1, BX_BOT0, "bot");
  });

  onDestroy(() => {
    tweenTop?.kill();
    tweenBot?.kill();
  });
</script>

<svg
  bind:this={svgEl}
  viewBox="-5 -8 335 150"
  class="w-full h-full"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
  style="overflow: hidden;"
>
  <!-- Grupo superior: 7 franjas animadas (bump hacia arriba) ───────────── -->
  <path
    data-top
    fill="#B9FFC1"
    d="M190.416 14.9432C202.396 7.66678 217.91 -5.86297 254.12 2.80359C280.636 9.14868 300.293 22.0912 329.988 25.0641V27.9316C300.355 25.1467 280.012 12.7869 253.276 6.76755C217.029 -1.39435 201.443 11.1307 188.973 18.3291C138.9 47.2329 57.6895 25.6422 -5 27.9316V25.0641C58.3985 22.6371 140.623 45.1867 190.416 14.9432Z"
  />
  <path
    data-top
    fill="#B9FFC1"
    d="M187.188 22.3207C200.355 15.1864 215.99 3.84972 252.249 11.4106C279.254 17.04 300.428 28.707 330 31.2717V34.2309C289.853 31.0147 255.526 9.03864 218.154 13.8743C203.826 15.7278 195.379 20.8433 185.489 25.8946C134.756 51.8072 56.1491 32.2672 -5 34.2309V31.2717C56.8704 29.1521 136.748 49.6508 187.188 22.3252V22.3207Z"
  />
  <path
    data-top
    fill="#B9FFC1"
    d="M181.296 30.9736C192.188 26.2435 200.538 21.027 215.073 19.0405C253.337 13.8102 289.279 34.7174 330 37.672V40.7229C300.086 38.7593 276.247 28.9091 247.971 24.5001C210.257 18.6184 195.465 28.1383 179.425 34.6485C126.87 55.9777 54.7311 39.1355 -5 40.7184V37.6674C55.4523 35.9056 128.912 53.7159 181.296 30.969V30.9736Z"
  />
  <path
    data-top
    fill="#B9FFC1"
    d="M177.2 38.9291C194.12 32.6253 208.9 24.2386 246.663 29.5055C275.245 33.4924 300.049 42.5352 330 44.2648V47.4075C288.435 45.2879 249.645 28.877 210.11 33.1712C196.112 34.6898 186.687 38.796 175.232 42.7233C122.286 60.9006 53.2518 46.2193 -5 47.4029V44.2602C53.9242 42.8884 124.45 58.5883 177.2 38.9245V38.9291Z"
  />
  <path
    data-top
    fill="#B9FFC1"
    d="M172.971 47.1368C191.516 41.4065 206.296 34.9697 244.181 39.108C273.362 42.2966 299.914 49.7657 330 51.0687V54.3123C287.787 52.7524 247.078 39.5438 206.663 43.1637C193.068 44.3795 182.848 47.7378 171.027 51.0228C117.616 65.8876 52.0049 53.5094 -5 54.3077V51.0641C52.555 50.0869 119.792 63.5616 172.971 47.1322V47.1368Z"
  />
  <path
    data-top
    fill="#B9FFC1"
    d="M168.875 55.5054C189.218 50.5734 203.851 45.9029 241.76 48.9539C271.528 51.3488 299.694 57.1754 330 58.0838V61.4238C287.09 60.387 244.694 50.4587 203.423 53.3491C190.22 54.2713 179.193 56.8588 167.09 59.4373C113.313 70.9024 50.9291 60.9834 -5 61.4238V58.0838C51.4548 57.4782 115.171 68.5351 168.875 55.51V55.5054Z"
  />
  <path
    data-top
    fill="#B9FFC1"
    d="M165.196 63.9287C187.164 60.1437 201.32 56.9276 239.584 58.9876C269.914 60.6163 299.413 64.75 330 65.3051V68.7506C299.279 68.3423 269.267 64.9977 238.704 63.7085C212.274 62.5937 189.071 64.282 163.729 67.8376C109.108 75.4995 50.5501 68.5855 -5 68.746V65.3005C50.8191 65.0161 110.795 73.2973 165.196 63.9242V63.9287Z"
  />

  <!-- Grupo inferior: 7 franjas animadas (bump hacia abajo) ────────────── -->
  <path
    data-bot
    fill="#B9FFC1"
    d="M121.577 86.3636C134.78 85.4414 145.807 82.8538 157.91 80.2754C211.687 68.8102 274.071 78.7293 330 78.2888V81.6288C273.545 82.2344 209.829 71.1776 156.125 84.2027C135.782 89.1347 121.149 93.8052 83.2396 90.7542C53.4719 88.3593 25.3056 82.5327 -5 81.6243V78.2843C37.9095 79.3211 80.3056 89.2494 121.577 86.359V86.3636Z"
  />
  <path
    data-bot
    fill="#B9FFC1"
    d="M118.337 96.544C131.932 95.3282 142.152 91.9698 153.973 88.6849C207.384 73.8201 272.995 86.1982 330 85.3999V88.6436C272.445 89.6208 205.208 76.1461 152.029 92.5754C133.484 98.3057 118.704 104.743 80.8191 100.604C51.6381 97.4157 25.0856 89.9466 -5 88.6436V85.3999C37.2127 86.9598 77.9218 100.168 118.337 96.5486V96.544Z"
  />
  <path
    data-bot
    fill="#B9FFC1"
    d="M114.89 106.532C128.888 105.013 138.313 100.907 149.768 96.9798C202.714 78.8025 271.748 93.4838 330 92.3001V95.4429C271.076 96.8147 200.55 81.1148 147.8 100.779C130.88 107.082 116.1 115.469 78.3374 110.202C49.7555 106.215 24.9511 97.1725 -5 95.4429V92.3001C36.5648 94.4198 75.3545 110.831 114.89 106.536V106.532Z"
  />
  <path
    data-bot
    fill="#B9FFC1"
    d="M145.575 105.064C198.13 83.7349 270.269 100.573 330 98.9897V102.041C269.548 103.802 196.088 85.9922 143.704 108.739C132.812 113.469 124.462 118.686 109.927 120.672C71.6626 125.902 35.7213 104.995 -5 102.041V98.9897C24.9144 100.953 48.7531 110.804 77.0293 115.213C114.743 121.094 129.535 111.574 145.575 105.064Z"
  />
  <path
    data-bot
    fill="#B9FFC1"
    d="M106.846 125.833C121.174 123.98 129.621 118.864 139.511 113.813C190.244 87.9051 268.851 107.44 330 105.481V108.441C268.13 110.56 188.252 90.0615 137.812 117.387C124.645 124.521 109.01 135.858 72.7506 128.297C45.7457 122.668 24.5721 111.001 -5 108.436V105.477C35.1467 108.693 69.4743 130.669 106.846 125.833Z"
  />
  <path
    data-bot
    fill="#B9FFC1"
    d="M136.015 121.378C186.112 92.4746 267.323 114.07 330 111.776V114.643C266.601 117.07 184.377 94.5208 134.584 124.764C122.604 132.041 107.09 145.57 70.8802 136.904C44.3643 130.559 24.7066 117.616 -4.98779 114.643V111.776C24.6455 114.561 44.9878 126.921 71.7237 132.94C107.971 141.102 123.557 128.577 136.027 121.378H136.015Z"
  />
</svg>
