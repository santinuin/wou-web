<script lang="ts">
  /**
   * LoadMore — paginación infinita para páginas de categoría.
   *
   * Migrado de WordPress API directo → endpoint interno /api/category-posts
   * que a su vez consulta Sanity. Sin acceso directo al CMS desde el browser.
   *
   * Props:
   *   categorySlug       slug de la categoría (reemplaza el categoryId numérico de WP)
   *   initialOffset      cuántos artículos ya muestra el SSG (= articles.length)
   *   initialPatternOffset   en qué punto del patrón de banda arranca este componente
   */
  import { BAND_PATTERN, type BandType } from '@/sections/category/bandPattern';

  export let categorySlug: string;
  export let initialOffset: number = 16;
  export let initialPatternOffset: number = 0;

  const PER_PAGE = 12;

  let loadCount = 0;
  let loading = false;
  let hasMore = true;
  let container: HTMLDivElement;
  let patternOffset = initialPatternOffset;

  interface NormalizedArticle {
    title: string;
    slug: string;
    categoryTitle: string | null;
    imageUrl: string | null;
    imageAlt: string | null;
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildSupportCard(a: NormalizedArticle): string {
    const alt = escapeHtml(a.imageAlt ?? a.title);
    const img = a.imageUrl
      ? `<img src="${a.imageUrl}" alt="${alt}" width="560" height="360" loading="lazy" decoding="async" class="SupportCard__image" />`
      : '';
    const badge = a.categoryTitle
      ? `<span class="SupportCard__category">${escapeHtml(a.categoryTitle)}</span>`
      : '';
    return `<a href="/articulo/${escapeHtml(a.slug)}" class="SupportCard" aria-label="${escapeHtml(a.title)}">
      <div class="SupportCard__image-zone">${img}</div>
      <div class="SupportCard__body">${badge}<h3 class="SupportCard__title">${a.title}</h3></div>
    </a>`;
  }

  function buildWideSupportCard(a: NormalizedArticle): string {
    const alt = escapeHtml(a.imageAlt ?? a.title);
    const img = a.imageUrl
      ? `<img src="${a.imageUrl}" alt="${alt}" width="560" height="360" loading="lazy" decoding="async" class="WideSupportCard__image" />`
      : '';
    const badge = a.categoryTitle
      ? `<span class="WideSupportCard__category">${escapeHtml(a.categoryTitle)}</span>`
      : '';
    return `<a href="/articulo/${escapeHtml(a.slug)}" class="WideSupportCard" aria-label="${escapeHtml(a.title)}">
      <div class="WideSupportCard__image-zone">${img}</div>
      <div class="WideSupportCard__body">${badge}<h3 class="WideSupportCard__title">${a.title}</h3></div>
    </a>`;
  }

  function buildRowHTML(articles: NormalizedArticle[], cols: number, type: BandType): string {
    const cards = articles
      .map((a) => (cols === 1 ? buildWideSupportCard(a) : buildSupportCard(a)))
      .join('');
    return `<div class="CategoryGrid__row CategoryGrid__row--${type}">${cards}</div>`;
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;

    // Offset acumulativo: SSG ya mostró `initialOffset` artículos,
    // cada click de LoadMore suma PER_PAGE más.
    const offset = initialOffset + loadCount * PER_PAGE;
    const params = new URLSearchParams({
      category: categorySlug,
      offset: String(offset),
      limit: String(PER_PAGE),
    });

    try {
      const res = await fetch(`/api/category-posts?${params}`);
      if (!res.ok) { hasMore = false; return; }

      const articles: NormalizedArticle[] = await res.json();
      if (!Array.isArray(articles) || articles.length === 0) { hasMore = false; return; }

      let cursor = 0;
      while (cursor < articles.length) {
        const slot = BAND_PATTERN[patternOffset % BAND_PATTERN.length];
        const chunk = articles.slice(cursor, cursor + slot.cols);
        if (chunk.length === 0) break;
        container.insertAdjacentHTML('beforeend', buildRowHTML(chunk, slot.cols, slot.type));
        cursor += slot.cols;
        patternOffset++;
      }

      loadCount++;
      if (articles.length < PER_PAGE) hasMore = false;
    } catch {
      hasMore = false;
    } finally {
      loading = false;
    }
  }
</script>

<div bind:this={container} class="LoadMore__rows"></div>

{#if hasMore}
  <div class="LoadMore__wrap">
    <button
      class="PillButton PillButton--primary"
      on:click={loadMore}
      disabled={loading}
      aria-label="Cargar más noticias"
    >
      {#if loading}
        Cargando…
      {:else}
        + Noticias
      {/if}
    </button>
  </div>
{/if}

<style>
  .LoadMore__rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .LoadMore__wrap {
    display: flex;
    justify-content: center;
    padding: 3rem 0 1rem;
  }
</style>
