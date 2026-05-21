<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // ── Perlin noise (2D, Ken Perlin's improved algorithm) ─────────────────────
  class PerlinNoise {
    private p: Uint8Array;

    constructor(seed = Math.random()) {
      const perm = Array.from({ length: 256 }, (_, i) => i);
      let s = Math.round(seed * 2147483647);
      for (let i = 255; i > 0; i--) {
        s = ((s * 16807) >>> 0) % 2147483647;
        const j = ((s / 2147483647) * (i + 1)) | 0;
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      this.p = new Uint8Array(512);
      for (let i = 0; i < 256; i++) this.p[i] = this.p[i + 256] = perm[i];
    }

    private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
    private lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
    private grad(h: number, x: number, y: number) {
      h = h & 3;
      return ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
    }

    noise(x: number, y: number): number {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      const u = this.fade(x);
      const v = this.fade(y);
      const a = this.p[X]     + Y;
      const b = this.p[X + 1] + Y;
      return this.lerp(
        this.lerp(this.grad(this.p[a],     x,     y    ),
                  this.grad(this.p[b],     x - 1, y    ), u),
        this.lerp(this.grad(this.p[a + 1], x,     y - 1),
                  this.grad(this.p[b + 1], x - 1, y - 1), u),
        v
      );
    }
  }

  type Point = {
    x: number; y: number;
    wave: { x: number; y: number };
    cursor: { x: number; y: number; vx: number; vy: number };
  };

  let container: HTMLElement;
  let svgEl: SVGSVGElement;

  let noise: PerlinNoise;
  let lines: Point[][] = [];
  let paths: SVGPathElement[] = [];
  let bounding = { left: 0, top: 0, width: 0, height: 0 };
  let mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false };
  let rafId: number;
  let startTime: number | null = null;
  let section: HTMLElement | null = null;

  function setSize() {
    bounding = {
      left:   0,
      top:    0,
      width:  container.clientWidth,
      height: container.clientHeight,
    };
    svgEl.style.width  = `${bounding.width}px`;
    svgEl.style.height = `${bounding.height}px`;
  }

  function setLines() {
    lines = [];
    paths.forEach((p) => p.remove());
    paths = [];

    const { width, height } = bounding;
    const xGap = 18;
    const yGap = 24;
    const totalLines  = Math.ceil((height + yGap * 2) / yGap);
    const totalPoints = Math.ceil((width  + xGap * 2) / xGap);
    const yStart = (height - yGap * totalLines) / 2;

    for (let i = 0; i <= totalLines; i++) {
      const pts: Point[] = [];
      const yBase = yStart + yGap * i;
      for (let j = 0; j <= totalPoints; j++) {
        pts.push({ x: -xGap + xGap * j, y: yBase,
          wave: { x: 0, y: 0 }, cursor: { x: 0, y: 0, vx: 0, vy: 0 } });
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'lw-line');
      svgEl.appendChild(path);
      paths.push(path);
      lines.push(pts);
    }
  }

  function movePoints(t: number) {
    lines.forEach((pts) => {
      pts.forEach((p) => {
        const n = noise.noise((p.x + t * 0.032) * 0.0018, (p.y + t * 0.012) * 0.0014) * 14;
        p.wave.y = Math.sin(n) * 26;
        p.wave.x = Math.cos(n) * 5;

        const dx = p.x - mouse.sx;
        const dy = p.y - mouse.sy;
        const d  = Math.hypot(dx, dy);
        const l  = Math.max(160, mouse.vs);

        if (d < l) {
          const s = 1 - d / l;
          const f = Math.cos(d * 0.001) * s;
          p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.0011;
          p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.0011;
        }

        p.cursor.vx += (0 - p.cursor.x) * 0.007;
        p.cursor.vy += (0 - p.cursor.y) * 0.007;
        p.cursor.vx *= 0.905;
        p.cursor.vy *= 0.905;
        p.cursor.x  = Math.min(130, Math.max(-130, p.cursor.x + p.cursor.vx * 2));
        p.cursor.y  = Math.min(130, Math.max(-130, p.cursor.y + p.cursor.vy * 2));
      });
    });
  }

  function drawLines() {
    lines.forEach((pts, li) => {
      const p0 = pts[0];
      let d = `M ${(p0.x + p0.wave.x).toFixed(1)} ${(p0.y + p0.wave.y).toFixed(1)}`;
      for (let pi = 1; pi < pts.length; pi++) {
        const p  = pts[pi];
        d += ` L ${(p.x + p.wave.x + p.cursor.x).toFixed(1)} ${(p.y + p.wave.y + p.cursor.y).toFixed(1)}`;
      }
      paths[li].setAttribute('d', d);
    });
  }

  function tick(t: number) {
    mouse.sx += (mouse.x - mouse.sx) * 0.1;
    mouse.sy += (mouse.y - mouse.sy) * 0.1;
    const dx = mouse.x - mouse.lx;
    const dy = mouse.y - mouse.ly;
    const d  = Math.hypot(dx, dy);
    mouse.vs = Math.min(100, mouse.vs + (d - mouse.vs) * 0.1);
    mouse.v  = d;
    mouse.lx = mouse.x;
    mouse.ly = mouse.y;
    mouse.a  = Math.atan2(dy, dx);
    movePoints(t);
    drawLines();
  }

  function loop(ts: number) {
    if (startTime === null) startTime = ts;
    tick(ts - startTime);
    rafId = requestAnimationFrame(loop);
  }

  function onMouseMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    if (!mouse.set) {
      mouse.sx = mouse.lx = mouse.x;
      mouse.sy = mouse.ly = mouse.y;
      mouse.set = true;
    }
  }

  function onResize() { setSize(); setLines(); }

  onMount(() => {
    noise   = new PerlinNoise(Math.random());
    section = container.closest('section');

    setSize();
    setLines();

    section?.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);
    rafId = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    section?.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(rafId);
  });
</script>

<div bind:this={container} class="lineup-waves" aria-hidden="true">
  <svg bind:this={svgEl} class="lineup-waves__svg"></svg>
</div>

<style>
  .lineup-waves {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }
  .lineup-waves__svg {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
  }
  :global(.lw-line) {
    fill: none;
    stroke: var(--color-brand-teal);
    stroke-width: 0.75px;
    opacity: 0.35;
  }
</style>
