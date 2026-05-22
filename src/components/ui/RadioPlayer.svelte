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
    <svg width="24" height="17" viewBox="0 0 24 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.8413 0.54834L5.29782 4.83703H1.08028C0.485387 4.83703 0 5.32215 0 5.92334V11.0721C0 11.6704 0.482427 12.1585 1.08028 12.1585H5.29782L10.8413 16.4471C11.5516 16.9948 12.5786 16.4888 12.5786 15.587V1.40846C12.5786 0.50965 11.5516 -0.00225502 10.8413 0.54834Z" fill="#F0EDE8"/>
      <path d="M15.929 5.49477C15.6182 5.05727 15.0144 4.95608 14.5794 5.26858C14.1443 5.58108 14.0437 6.18822 14.3544 6.62572C14.7451 7.17334 14.9493 7.82215 14.9493 8.50072C14.9493 9.17929 14.7421 9.82512 14.3544 10.3727C14.0437 10.8102 14.1443 11.4174 14.5794 11.7299C14.751 11.8519 14.9464 11.9114 15.1417 11.9114C15.4436 11.9114 15.7395 11.7686 15.929 11.5037C16.5535 10.6227 16.8849 9.58405 16.8849 8.50072C16.8849 7.41739 16.5535 6.37572 15.929 5.49477Z" fill="#F0EDE8"/>
      <path d="M18.5068 8.49774C18.5068 10.09 17.9475 11.6406 16.9353 12.8638C16.5919 13.2775 16.6482 13.8876 17.0596 14.2329C17.2401 14.3847 17.4591 14.4591 17.6781 14.4591C17.9563 14.4591 18.2286 14.34 18.421 14.1079C19.7233 12.5364 20.4425 10.5424 20.4425 8.49774C20.4425 6.4531 19.7233 4.45905 18.421 2.88763C18.0777 2.47394 17.468 2.42036 17.0596 2.76263C16.6482 3.10489 16.5949 3.71798 16.9353 4.13167C17.9504 5.35489 18.5068 6.90548 18.5068 8.49774Z" fill="#F0EDE8"/>
      <path d="M22.0673 8.49774C22.0673 11.0364 21.1469 13.4799 19.4776 15.3817C19.1225 15.7835 19.1609 16.3995 19.5605 16.7537C19.744 16.9174 19.9719 16.9977 20.1998 16.9977C20.4662 16.9977 20.7325 16.8876 20.9249 16.6704C22.9079 14.4144 24 11.5126 24 8.50072C24 5.48882 22.9079 2.58405 20.9249 0.328102C20.5727 -0.0736836 19.96 -0.112374 19.5605 0.244769C19.1609 0.598935 19.1225 1.21501 19.4776 1.61679C21.1469 3.51858 22.0673 5.96203 22.0673 8.50072V8.49774Z" fill="#F0EDE8"/>
    </svg>
  {:else}
    <!-- Altavoz silenciado: cuerpo del parlante + X sólida -->
    <svg width="24" height="17" viewBox="0 0 24 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.8413 0.54834L5.29782 4.83703H1.08028C0.485387 4.83703 0 5.32215 0 5.92334V11.0721C0 11.6704 0.482427 12.1585 1.08028 12.1585H5.29782L10.8413 16.4471C11.5516 16.9948 12.5786 16.4888 12.5786 15.587V1.40846C12.5786 0.50965 11.5516 -0.00225502 10.8413 0.54834Z" fill="#F0EDE8"/>
      <rect x="18.1" y="3.5" width="1.8" height="10" rx="0.9" transform="rotate(45 19 8.5)" fill="#F0EDE8"/>
      <rect x="18.1" y="3.5" width="1.8" height="10" rx="0.9" transform="rotate(-45 19 8.5)" fill="#F0EDE8"/>
    </svg>
  {/if}
</button>
