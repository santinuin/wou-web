<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { gsap } from 'gsap';

  interface Category {
    title: string;
    slug: string;
  }

  let { categories = [] }: { categories: Category[] } = $props();

  let pillsEl: HTMLElement | null = null;
  let tl: gsap.core.Timeline | null = null;
  let isOpen = $state(false);
  let closing = false;

  async function enter() {
    closing = false;
    if (!isOpen) {
      isOpen = true;
      await tick();
    }
    if (!pillsEl) return;

    tl?.kill();
    const pills = Array.from(pillsEl.querySelectorAll<HTMLElement>('a'));
    tl = gsap.timeline().fromTo(
      pills,
      { opacity: 0, y: -12, scale: 0.75 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.28,
        stagger: { each: 0.045, from: 'center' },
        ease: 'back.out(1.6)',
      }
    );
  }

  function leave() {
    if (!pillsEl || !isOpen) return;
    closing = true;
    tl?.kill();
    const pills = Array.from(pillsEl.querySelectorAll<HTMLElement>('a'));
    tl = gsap.timeline({
      onComplete: () => {
        if (closing) isOpen = false;
      },
    }).to(pills, {
      opacity: 0,
      y: -10,
      scale: 0.8,
      duration: 0.18,
      stagger: { each: 0.03, from: 'center' },
      ease: 'power2.in',
    });
  }

  onDestroy(() => tl?.kill());
</script>

<div
  class="SBMenu"
  onmouseenter={enter}
  onmouseleave={leave}
  role="navigation"
  aria-label="Menú de secciones expandible"
>
  <button
    class="PillButton PillButton--primary"
    aria-expanded={isOpen}
    aria-haspopup="true"
    onclick={() => (isOpen ? leave() : enter())}
  >
    + SECCIONES
  </button>

  {#if isOpen}
    <div class="SBMenu__pills" bind:this={pillsEl}>
      {#each categories as cat}
        <a href="/categoria/{cat.slug}" class="PillButton PillButton--category">
          {cat.title}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .SBMenu {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .SBMenu__pills {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.5rem 0.65rem;
    justify-content: center;
    white-space: nowrap;
  }
</style>
