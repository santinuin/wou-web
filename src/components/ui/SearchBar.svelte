<script lang="ts">
  /**
   * Ejemplo de island Svelte — barra de búsqueda con estado reactivo.
   *
   * Uso en una página .astro:
   *   import SearchBar from '@/components/ui/SearchBar.svelte';
   *   <SearchBar client:load placeholder="Buscar artículos..." />
   *
   * Directivas disponibles:
   *   client:load    → hidrata al cargar la página (usar para UI visible inmediatamente)
   *   client:idle    → hidrata cuando el browser está libre (contenido no crítico)
   *   client:visible → hidrata cuando el componente entra al viewport (lazy)
   */

  export let placeholder = 'Buscar...';

  let query = '';

  function handleSubmit() {
    if (!query.trim()) return;
    // TODO: implementar lógica de búsqueda
    console.log('Buscar:', query);
  }
</script>

<form on:submit|preventDefault={handleSubmit} role="search">
  <label for="search-input" class="sr-only">Buscar artículos</label>
  <div class="flex gap-2">
    <input
      id="search-input"
      type="search"
      bind:value={query}
      {placeholder}
      class="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
      autocomplete="off"
    />
    <button
      type="submit"
      class="px-4 py-2 bg-gray-900 text-white rounded text-sm"
      aria-label="Ejecutar búsqueda"
    >
      Buscar
    </button>
  </div>
</form>
