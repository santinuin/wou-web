<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { gsap } from 'gsap';

  interface Section {
    title: string;
    slug: string;
    color?: string | null;
  }

  let { sections = [] }: { sections: Section[] } = $props();

  let isOpen = $state(false);
  let navEl: HTMLElement | null = null;
  let tl: gsap.core.Timeline | null = null;

  const GRAY = '#FFFFFF8C'; // brand-gray token

  function finalColor(s: Section) {
    return s.color ?? GRAY;
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

    const links = Array.from(navEl.querySelectorAll<HTMLElement>('a[data-color]'));
    if (!links.length) return;

    const navWidth = navEl.clientWidth;
    const PAD = 40; // px-10 = 2.5rem = 40px

    tl = gsap.timeline()
      .to(links, {
        x: (_, el) => navWidth - PAD - el.offsetLeft - el.offsetWidth,
        color: '#ffffff',
        duration: 0.45,
        stagger: 0.07,
        ease: 'power2.inOut',
      })
      .to(links, {
        x: 0,
        color: (_, el) => (el as HTMLElement).dataset.color ?? GRAY,
        duration: 0.45,
        stagger: 0.07,
        ease: 'power2.inOut',
      }, '+=0.1');
  }

  async function onToggle() {
    isOpen = !isOpen;
    if (isOpen) {
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

  /*
    Click-outside: cierra el modal cuando el click cae fuera del nav.
    Consulta el DOM directamente (en vez de leer isOpen/navEl del closure)
    para evitar valores stale en Svelte 5.
    Ignora clicks sobre el botón de toggle: el header ya despacha
    sections-menu-toggle que maneja el cierre.
  */
  function onDocumentClick(e: MouseEvent) {
    const nav = document.querySelector<HTMLElement>('[aria-label="Menú de secciones"]');
    if (!nav) return;
    const target = e.target as Node;
    const toggleBtn = document.querySelector('[aria-label="Ver todas las secciones"]');
    if (toggleBtn?.contains(target)) return;
    if (!nav.contains(target)) close();
  }

  onMount(() => {
    window.addEventListener('sections-menu-toggle', onToggle);
    window.addEventListener('keydown', onKeydown);
    document.addEventListener('click', onDocumentClick);
  });

  onDestroy(() => {
    window.removeEventListener('sections-menu-toggle', onToggle);
    window.removeEventListener('keydown', onKeydown);
    document.removeEventListener('click', onDocumentClick);
    tl?.kill();
  });
</script>

{#if isOpen}
  <nav
    bind:this={navEl}
    class="fixed right-0 top-0 w-1/2 h-screen bg-brand-blue pointer-events-auto z-[49] overflow-y-auto"
    aria-label="Menú de secciones"
  >
    <div class="min-h-full flex flex-col justify-center px-10 py-20">
      <ul class="flex flex-col gap-0.5">
        {#each sections as section}
          <li>
            <a
              href={section.slug}
              data-color={finalColor(section)}
              class="font-alumni font-extrabold uppercase leading-[0.88] inline-block"
              style="font-size: clamp(1.75rem, 4.2vw, 5rem); color: {finalColor(section)};"
            >
              {section.title}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </nav>
{/if}
