<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { gsap } from 'gsap';

  interface Section {
    title: string;
    slug: string;
  }

  let { sections = [] }: { sections: Section[] } = $props();

  let isOpen = $state(false);
  let navEl: HTMLElement | null = null;
  let tl: gsap.core.Timeline | null = null;
  let headerHeight = $state(88); // 5.5rem fallback

  function updateHeaderHeight() {
    const header = document.getElementById('siteHeader');
    if (header) headerHeight = header.offsetHeight;
  }

  function close() {
    tl?.kill();
    tl = null;
    isOpen = false;
    window.dispatchEvent(new CustomEvent('sections-menu-closed'));
  }

  function playIntro() {
    if (!navEl) return;
    tl?.kill();

    const spans = Array.from(navEl.querySelectorAll<HTMLElement>('span.gsap-text'));
    if (!spans.length) return;

    const navWidth = navEl.clientWidth;
    const PAD = 40;

    tl = gsap.timeline()
      .to(spans, {
        x: (i, el) => navWidth - PAD - el.offsetLeft - el.offsetWidth,
        color: 'var(--color-brand-white)',
        duration: 0.45,
        stagger: 0.07,
        ease: 'power2.inOut',
      })
      .to(spans, {
        x: 0,
        color: 'color-mix(in srgb, var(--color-brand-white) 55%, transparent)',
        duration: 0.45,
        stagger: 0.07,
        ease: 'power2.inOut',
      }, '+=0.1');
  }

  async function onToggle() {
    isOpen = !isOpen;
    if (isOpen) {
      updateHeaderHeight();
      await tick();
      playIntro();
    } else {
      tl?.kill();
      tl = null;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) close();
  }

  function onDocumentClick(e: MouseEvent) {
    const nav = document.querySelector<HTMLElement>('[aria-label="Menú de secciones"]');
    if (!nav) return;
    const target = e.target as Node;
    const toggleBtn = document.querySelector('[aria-label="Ver todas las secciones"]');
    if (toggleBtn?.contains(target)) return;
    if (!nav.contains(target)) close();
  }

  onMount(() => {
    updateHeaderHeight();
    window.addEventListener('sections-menu-toggle', onToggle);
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('scroll', updateHeaderHeight, { passive: true });
    window.addEventListener('resize', updateHeaderHeight);
    document.addEventListener('click', onDocumentClick);
  });

  onDestroy(() => {
    window.removeEventListener('sections-menu-toggle', onToggle);
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('scroll', updateHeaderHeight);
    window.removeEventListener('resize', updateHeaderHeight);
    document.removeEventListener('click', onDocumentClick);
    tl?.kill();
  });
</script>

{#if isOpen}
  <nav
    bind:this={navEl}
    class="fixed right-0 w-full lg:w-1/2 bg-brand-blue pointer-events-auto z-49 overflow-y-auto"
    style="top: {headerHeight}px; height: calc(100vh - {headerHeight}px);"
    aria-label="Menú de secciones"
  >
    <div class="min-h-full flex flex-col justify-center py-2 lg:py-4">
      <ul class="flex flex-col">
        {#each sections as section}
          <li class="menu-item">
            <span class="sweep" aria-hidden="true"></span>
            <a
              href={section.slug}
              class="relative z-10 block w-full pl-6 lg:pl-10 pt-2 pb-1"
            >
              <span
                class="gsap-text font-boldonse font-normal uppercase inline-block leading-none align-bottom"
                style="font-size: clamp(2rem, 4.5vw, 2.75rem); color: color-mix(in srgb, var(--color-brand-white) 55%, transparent);"
              >
                {section.title}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </nav>
{/if}

<style>
  .menu-item {
    position: relative;
    overflow: hidden;
  }

  .menu-item .sweep {
    position: absolute;
    inset: 0;
    background: var(--color-brand-white);
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 0.4s cubic-bezier(0.65, 0, 0.35, 1);
  }

  .menu-item:hover .sweep {
    transform: scaleY(1);
  }

  /* !important overrides the inline color set by GSAP */
  .menu-item:hover .gsap-text {
    color: var(--color-brand-teal) !important;
  }
</style>
