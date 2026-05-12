<script lang="ts">
  import { onMount } from 'svelte';

  export let station: string = 'WOU! RADIO 95.1';
  export let placeholder: string = '';

  let videoId: string | null = null;
  let isLive = false;
  let showIframe = false;

  onMount(async () => {
    try {
      const res = await fetch('/api/youtube-live');
      if (res.ok) {
        const data = await res.json();
        videoId = data.videoId;
        isLive = data.isLive;
      }
    } catch {}
  });

  $: embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1`
    : null;

  function activate() {
    if (embedUrl) showIframe = true;
  }
</script>

<div class="relative w-full h-full bg-brand-black overflow-hidden">

  {#if showIframe && embedUrl}
    <iframe
      src={embedUrl}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen
      class="absolute inset-0 w-full h-full border-0"
      title={station}
    ></iframe>

  {:else}
    {#if placeholder}
      <img
        src={placeholder}
        alt=""
        aria-hidden="true"
        class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />
    {/if}

    <button
      on:click={activate}
      disabled={!videoId}
      class="absolute inset-0 w-full h-full flex items-center justify-center group cursor-pointer bg-transparent"
      aria-label="Reproducir {station} en YouTube"
    >
      <!-- Play button -->
      <div class="w-14 h-10 bg-[#FF0000] rounded-lg flex items-center justify-center shadow-lg transition-transform {videoId ? 'group-hover:scale-110' : 'opacity-30'}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>

      {#if !videoId}
        <span class="absolute bottom-3 text-white/30 text-xs tracking-widest uppercase font-sans">
          Sin stream
        </span>
      {/if}
    </button>
  {/if}

</div>
