<script lang="ts">
  import { onMount } from 'svelte';

  let speed: number | null = null;
  let direction = '';

  function toCompass(deg: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return dirs[Math.round(deg / 45) % 8];
  }

  onMount(async () => {
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=-51.6167&longitude=-69.2167&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh'
      );
      if (!res.ok) return;
      const data = await res.json();
      speed = Math.round(data.current.wind_speed_10m);
      direction = toCompass(data.current.wind_direction_10m);
    } catch {
      // falla silenciosa — muestra el placeholder
    }
  });
</script>

{#if speed !== null}
  RGL: {speed} KM/H {direction}
{:else}
  RGL: — KM/H
{/if}
