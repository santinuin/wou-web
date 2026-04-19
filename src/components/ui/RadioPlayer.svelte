<script lang="ts">
  export let streamUrl: string = '';

  let audio: HTMLAudioElement;
  let playing = false;

  async function toggle() {
    if (!audio) return;
    if (playing) {
      audio.pause();
      playing = false;
    } else {
      try {
        await audio.play();
        playing = true;
      } catch {
        // Autoplay bloqueado por el browser — el usuario debe interactuar primero
      }
    }
  }
</script>

{#if streamUrl}
  <audio bind:this={audio} src={streamUrl} preload="none"></audio>
{/if}

<button
  on:click={toggle}
  class="flex items-center justify-center w-8 h-8 text-brand-white opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
  aria-label={playing ? 'Silenciar radio' : 'Escuchar radio en vivo'}
  title={playing ? 'Silenciar' : 'Escuchar'}
>
  {#if playing}
    <!-- Altavoz activo -->
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  {:else}
    <!-- Altavoz silenciado -->
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/>
      <line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  {/if}
</button>
