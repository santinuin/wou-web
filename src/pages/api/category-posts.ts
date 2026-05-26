/**
 * GET /api/category-posts?category=<slug>&offset=<n>&limit=<n>
 *
 * Endpoint de paginación para el componente LoadMore.svelte.
 * Reemplaza el fetch directo a la API de WordPress.
 *
 * Corre como Cloudflare Worker (prerender: false implícito para rutas /api/).
 *
 * Response: NormalizedArticle[]
 * [{
 *   title: string,
 *   slug: string,
 *   categoryTitle: string | null,
 *   imageUrl: string | null,
 *   imageAlt: string | null,
 * }]
 */
import type { APIRoute } from 'astro';
import { fetchSanityPostsByCategory } from '@/lib/cms';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const category = url.searchParams.get('category');
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const limit = parseInt(url.searchParams.get('limit') ?? '12', 10);

  if (!category) {
    return new Response(JSON.stringify({ error: 'category param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Clampear limit para evitar requests abusivos
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const safeOffset = Math.max(offset, 0);

  try {
    const posts = await fetchSanityPostsByCategory(category, safeOffset, safeLimit);

    const normalized = posts.map((p) => ({
      title: p.data.title,
      slug: p.data.slug.current,
      categoryTitle: p.data.categories?.[0]?.title ?? null,
      imageUrl: p.data.mainImage?.url ?? null,
      imageAlt: p.data.mainImage?.alt ?? null,
    }));

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cachear en edge 5 minutos — balance entre frescura y costo de queries
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('[category-posts]', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
