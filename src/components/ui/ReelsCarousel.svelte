<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface ReelItem {
    videoId: string;
    title: string;
    thumbUrl: string;
  }

  interface Props {
    items: ReelItem[];
  }

  let { items }: Props = $props();

  let track: HTMLElement | undefined;
  let canPrev = $state(false);
  let canNext = $state(true);
  let activeVideoId = $state<string | null>(null);

  function cardStep(): number {
    if (!track) return 200;
    const card = track.querySelector<HTMLElement>('.rc-item');
    if (!card) return 200;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 12;
    return card.offsetWidth + gap;
  }

  function scrollPrev() {
    track?.scrollBy({ left: -cardStep(), behavior: 'smooth' });
  }

  function scrollNext() {
    track?.scrollBy({ left: cardStep(), behavior: 'smooth' });
  }

  function updateNav() {
    if (!track) return;
    canPrev = track.scrollLeft > 2;
    canNext = track.scrollLeft < track.scrollWidth - track.clientWidth - 2;
  }

  function play(videoId: string) {
    activeVideoId = videoId;
  }

  function stop() {
    activeVideoId = null;
  }

  onMount(() => {
    updateNav();
    track!.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('resize', updateNav, { passive: true });
  });

  onDestroy(() => {
    track?.removeEventListener('scroll', updateNav);
    window.removeEventListener('resize', updateNav);
  });
</script>

<div class="rc">
  <div class="rc-track" bind:this={track}>
    {#each items as item (item.videoId)}
      <div class="rc-item">
        <div class="rc-thumb-wrap">
          {#if activeVideoId === item.videoId}
            <div class="rc-player">
              <iframe
                src={`https://www.youtube.com/embed/${item.videoId}?autoplay=1&rel=0&playsinline=1`}
                title={item.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowfullscreen
              ></iframe>
              <button class="rc-close" onclick={stop} aria-label="Cerrar video">✕</button>
            </div>
          {:else}
            <button
              class="rc-play-btn"
              onclick={() => play(item.videoId)}
              aria-label={`Reproducir: ${item.title}`}
            >
              <img src={item.thumbUrl} alt={item.title} loading="eager" decoding="async" />
              <span class="rc-play-icon" aria-hidden="true"></span>
            </button>
          {/if}
        </div>
        <p class="rc-title">{item.title}</p>
      </div>
    {/each}
  </div>

  <button
    class="rc-btn rc-btn--prev"
    onclick={scrollPrev}
    disabled={!canPrev}
    aria-label="Anterior"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  </button>

  <button
    class="rc-btn rc-btn--next"
    onclick={scrollNext}
    disabled={!canNext}
    aria-label="Siguiente"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  </button>
</div>

<style>
  .rc {
    position: relative;
  }

  /* ── Track ───────────────────────────────────────────────────────────── */
  .rc-track {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    touch-action: pan-x;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .rc-track::-webkit-scrollbar {
    display: none;
  }

  /* ── Item ─────────────────────────────────────────────────────────────── */
  .rc-item {
    flex: 0 0 clamp(160px, 20vw, 260px);
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  /* ── Thumbnail wrapper — 9:16 ─────────────────────────────────────────── */
  .rc-thumb-wrap {
    position: relative;
    aspect-ratio: 9 / 16;
    overflow: hidden;
    background: color-mix(in oklab, var(--color-brand-dark) 60%, white);
  }

  /* ── Thumbnail button ─────────────────────────────────────────────────── */
  .rc-play-btn {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    position: relative;
  }
  .rc-play-btn img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }
  .rc-play-btn:hover img {
    transform: scale(1.04);
  }

  /* ── Play icon overlay ────────────────────────────────────────────────── */
  .rc-play-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.25);
    transition: background 0.2s ease;
  }
  .rc-play-icon::after {
    content: '';
    width: 2.5rem;
    height: 2.5rem;
    background: var(--color-brand-teal);
    clip-path: polygon(28% 18%, 28% 82%, 82% 50%);
  }
  .rc-play-btn:hover .rc-play-icon {
    background: rgba(0, 0, 0, 0.08);
  }

  /* ── Iframe player ────────────────────────────────────────────────────── */
  .rc-player {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .rc-player iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
  }

  /* ── Close button ─────────────────────────────────────────────────────── */
  .rc-close {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 0.75rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
  }
  .rc-close:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  /* ── Title ────────────────────────────────────────────────────────────── */
  .rc-title {
    font-family: var(--font-franklin);
    font-weight: 600;
    font-size: 0.75rem;
    line-height: 1.3;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--color-brand-white);
  }

  /* ── Arrow buttons ────────────────────────────────────────────────────── */
  .rc-btn {
    position: absolute;
    top: 40%;
    transform: translateY(-50%);
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--color-brand-teal);
    color: var(--color-brand-dark);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: opacity 0.2s ease, transform 0.15s ease;
  }
  .rc-btn svg {
    width: 1.1rem;
    height: 1.1rem;
  }
  .rc-btn:disabled {
    opacity: 0;
    pointer-events: none;
  }
  .rc-btn:not(:disabled):hover {
    transform: translateY(-50%) scale(1.1);
  }
  .rc-btn--prev {
    left: -1.125rem;
  }
  .rc-btn--next {
    right: -1.125rem;
  }
</style>
