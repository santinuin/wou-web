/**
 * sanity-posts.ts — funciones de fetch de artículos desde Sanity.
 *
 * Reemplaza wordpress.ts para la colección `articles`.
 * Mantiene el mismo shape normalizado que los componentes consumen,
 * garantizando que el cambio de CMS no requiera modificar páginas ni secciones.
 *
 * Shape normalizado de salida (compatible con el anterior de WordPress):
 * {
 *   id: string,           // _id de Sanity
 *   data: {
 *     wpId: number | null,
 *     title: string,
 *     slug: { current: string },
 *     publishedAt: string | null,
 *     modifiedAt: string | null,
 *     body: PortableTextBlock[] | null,   // Portable Text (solo en articulo/[slug])
 *     excerpt: string | null,
 *     mainImage: { url: string; alt: string | null; width?: number; height?: number } | null,
 *     categories: { _id: string; title: string; slug: { current: string } }[],
 *     tags: string[],
 *     author: string | null,
 *     featured: boolean | null,
 *     originalUrl: string | null,
 *     seo: { title?: string; description?: string; canonicalUrl?: string } | null,
 *     needsReview: boolean | null,
 *   }
 * }
 */

import { sanityClient } from './client';
import {
  RECENT_ARTICLES_QUERY,
  ARTICLES_BY_CATEGORY_QUERY,
  ARTICLE_BY_SLUG_QUERY,
} from './queries';

// ─── Tipos internos (shape crudo de Sanity antes de normalizar) ───────────────

interface SanitySlug { _type: 'slug'; current: string }
interface SanityCategory { _id: string; title: string; slug: SanitySlug }
interface SanityMainImage { url: string; alt?: string | null; width?: number; height?: number }
interface SanityAuthorFull {
  name: string;
  slug?: SanitySlug;
  avatar?: { url?: string; alt?: string } | null;
  bio?: unknown[];
  socialLinks?: Record<string, string>;
}

interface RawArticleCard {
  _id: string;
  title: string;
  slug: SanitySlug;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  wpId?: number | null;
  excerpt?: string | null;
  featured?: boolean | null;
  highlightWord?: string | null;
  mainImage?: SanityMainImage | null;
  author?: string | null;             // string en queries de lista
  categories?: SanityCategory[] | null;
  tags?: string[] | null;
  originalUrl?: string | null;
}

interface RawArticleFull extends Omit<RawArticleCard, 'author'> {
  body?: unknown[] | null;
  author?: string | SanityAuthorFull | null;  // objeto completo en query individual
  seo?: {
    title?: string | null;
    description?: string | null;
    canonicalUrl?: string | null;
    noIndex?: boolean | null;
  } | null;
  needsReview?: boolean | null;
}

// ─── Normalización ────────────────────────────────────────────────────────────

function normalizeArticle(raw: RawArticleCard | RawArticleFull) {
  const authorName =
    typeof raw.author === 'string'
      ? raw.author
      : typeof raw.author === 'object' && raw.author !== null
        ? (raw.author as SanityAuthorFull).name
        : null;

  return {
    id: raw._id,
    data: {
      wpId: raw.wpId ?? null,
      title: raw.title,
      slug: raw.slug,
      publishedAt: raw.publishedAt ?? null,
      modifiedAt: raw.modifiedAt ?? null,
      body: (raw as RawArticleFull).body ?? null,
      excerpt: raw.excerpt ?? null,
      mainImage: raw.mainImage
        ? {
            url: raw.mainImage.url,
            alt: raw.mainImage.alt ?? null,
            width: raw.mainImage.width,
            height: raw.mainImage.height,
          }
        : null,
      categories: (raw.categories ?? []).map((c) => ({
        _id: c._id,
        title: c.title,
        slug: c.slug,
      })),
      tags: raw.tags ?? [],
      author: authorName,
      featured: raw.featured ?? null,
      highlightWord: raw.highlightWord ?? null,
      originalUrl: raw.originalUrl ?? null,
      seo: (raw as RawArticleFull).seo ?? null,
      needsReview: (raw as RawArticleFull).needsReview ?? null,
    },
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Trae los N artículos más recientes.
 * Uso: build-time (content.config.ts articles loader).
 */
export async function fetchRecentSanityPosts(n = 50) {
  const raw = await sanityClient.fetch<RawArticleCard[]>(
    RECENT_ARTICLES_QUERY,
    { n: n - 1 }  // GROQ [0...$n] es inclusivo en ambos extremos
  );
  return raw.map(normalizeArticle);
}

/**
 * Trae artículos de una categoría con paginación por offset.
 * Uso: build-time (getStaticPaths de category page) y API route para LoadMore.
 *
 * @param categorySlug  slug de la categoría (ej: 'politica')
 * @param offset        índice de inicio (0-based)
 * @param limit         cantidad de artículos a devolver
 */
export async function fetchSanityPostsByCategory(
  categorySlug: string,
  offset = 0,
  limit = 16
) {
  const raw = await sanityClient.fetch<RawArticleCard[]>(
    ARTICLES_BY_CATEGORY_QUERY,
    { categorySlug, offset, limit: offset + limit }
  );
  return raw.map(normalizeArticle);
}

/**
 * Trae un artículo completo por slug (incluye body en Portable Text).
 * Uso: on-demand en src/pages/articulo/[slug].astro
 */
export async function fetchSanityPostBySlug(slug: string) {
  const raw = await sanityClient.fetch<RawArticleFull | null>(
    ARTICLE_BY_SLUG_QUERY,
    { slug }
  );
  if (!raw) return null;
  return normalizeArticle(raw);
}
