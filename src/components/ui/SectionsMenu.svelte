<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Section {
    title: string;
    slug: string;
    color?: string | null;
  }

  let { sections = [] }: { sections: Section[] } = $props();

  let isOpen = $state(false);

  function onToggle() {
    isOpen = !isOpen;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      window.dispatchEvent(new CustomEvent('sections-menu-closed'));
    }
  }

  onMount(() => {
    window.addEventListener('sections-menu-toggle', onToggle);
    window.addEventListener('keydown', onKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('sections-menu-toggle', onToggle);
    window.removeEventListener('keydown', onKeydown);
  });
</script>

{#if isOpen}
  <nav
    class="absolute inset-0 bg-brand-blue pointer-events-auto z-10 overflow-y-auto"
    aria-label="Menú de secciones"
  >
    <!--
      min-h-full + flex + justify-center: centra la lista cuando entra en pantalla.
      py-12 px-10: padding garantizado en el área scrollable — visible en scroll top y bottom.
    -->
    <div class="min-h-full flex flex-col justify-center px-10 py-12">
    <ul class="flex flex-col gap-0.5">
      {#each sections as section}
        <li>
          <a
            href={section.slug}
            class="font-alumni font-extrabold uppercase leading-[0.88] block transition-opacity hover:opacity-80"
            style="font-size: clamp(1.75rem, 4.2vw, 5rem); {section.color ? `color: ${section.color};` : ''}"
            class:text-brand-gray={!section.color}
          >
            {section.title}
          </a>
        </li>
      {/each}
    </ul>
    </div>
  </nav>
{/if}
