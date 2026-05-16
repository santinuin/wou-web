<script lang="ts">
  export let categoryId: number;
  export let initialPage: number = 2;
  export let initialPatternOffset: number = 0;

  const WP_BASE = 'https://wou.com.ar/wp-json/wp/v2';
  const PER_PAGE = 12;
  // Mismo patrón que CategoryGrid.astro
  const ROW_PATTERN = [2, 3, 2, 1, 2, 3];

  let page = initialPage;
  let loading = false;
  let hasMore = true;
  let container: HTMLDivElement;
  let patternOffset = initialPatternOffset;

  interface WpArticle {
    id: number;
    slug: string;
    title: { rendered: string };
    _embedded?: {
      'wp:featuredmedia'?: Array<{ source_url?: string; alt_text?: string }>;
      'wp:term'?: Array<Array<{ id: number; name: string; slug: string }>>;
    };
  }

  interface NormalizedArticle {
    title: string;
    slug: string;
    categoryTitle: string | null;
    imageUrl: string | null;
    imageAlt: string | null;
  }

  function normalize(post: WpArticle): NormalizedArticle {
    return {
      title: post.title.rendered,
      slug: post.slug,
      categoryTitle: post._embedded?.['wp:term']?.[0]?.[0]?.name ?? null,
      imageUrl: post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null,
      imageAlt: post._embedded?.['wp:featuredmedia']?.[0]?.alt_text ?? null,
    };
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
    return `<a href="/${a.slug}" class="SupportCard" aria-label="${escapeHtml(a.title)}">
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
    return `<a href="/${a.slug}" class="WideSupportCard" aria-label="${escapeHtml(a.title)}">
      <div class="WideSupportCard__image-zone">${img}</div>
      <div class="WideSupportCard__body">${badge}<h3 class="WideSupportCard__title">${a.title}</h3></div>
    </a>`;
  }

  function buildRowHTML(articles: NormalizedArticle[], cols: number): string {
    const cards = articles
      .map((a) => (cols === 1 ? buildWideSupportCard(a) : buildSupportCard(a)))
      .join('');
    return `<div class="CategoryGrid__row CategoryGrid__row--${cols}">${cards}</div>`;
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;

    try {
      const res = await fetch(
        `${WP_BASE}/posts?categories=${categoryId}&page=${page}&per_page=${PER_PAGE}&status=publish&_embed`
      );
      if (!res.ok) { hasMore = false; return; }
      const text = await res.text();
      if (!text.trim()) { hasMore = false; return; }
      const posts: WpArticle[] = JSON.parse(text);
      if (!Array.isArray(posts) || posts.length === 0) { hasMore = false; return; }

      const articles = posts.map(normalize);
      let cursor = 0;

      while (cursor < articles.length) {
        const cols = ROW_PATTERN[patternOffset % ROW_PATTERN.length];
        const chunk = articles.slice(cursor, cursor + cols);
        if (chunk.length === 0) break;
        container.insertAdjacentHTML('beforeend', buildRowHTML(chunk, cols));
        cursor += cols;
        patternOffset++;
      }

      page++;
      if (posts.length < PER_PAGE) hasMore = false;
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
      class="LoadMore__btn"
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

  :global(.LoadMore__rows .CategoryGrid__row) {
    display: grid;
    gap: 8px;
  }

  :global(.LoadMore__rows .CategoryGrid__row--1) {
    grid-template-columns: 1fr;
    min-height: 360px;
  }

  :global(.LoadMore__rows .CategoryGrid__row--2) {
    grid-template-columns: 1fr 1fr;
    min-height: 360px;
  }

  :global(.LoadMore__rows .CategoryGrid__row--3) {
    grid-template-columns: repeat(3, 1fr);
    min-height: 320px;
  }

  @media (max-width: 768px) {
    :global(.LoadMore__rows .CategoryGrid__row--3) {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 480px) {
    :global(.LoadMore__rows .CategoryGrid__row--2),
    :global(.LoadMore__rows .CategoryGrid__row--3) {
      grid-template-columns: 1fr;
      min-height: 280px;
    }
  }

  .LoadMore__wrap {
    display: flex;
    justify-content: center;
    padding: 2.5rem 0 1rem;
  }

  .LoadMore__btn {
    background: var(--color-brand-orange);
    color: var(--color-brand-dark);
    font-family: var(--font-alumni);
    font-weight: 900;
    font-size: 2.2rem;
    padding: 0.4rem 2.8rem;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    transition: filter 0.2s ease, transform 0.15s ease;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1.1;
  }

  .LoadMore__btn:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: scale(1.03);
  }

  .LoadMore__btn:disabled {
    opacity: 0.7;
    cursor: wait;
  }
</style>
