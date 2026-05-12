import { defineCollection, z } from 'astro:content';
import { sanityClient, isSanityConfigured } from './lib/cms/client';
import {
  ALL_ADVERTISEMENTS_QUERY,
  ALL_AUTHORS_QUERY,
  ALL_CATEGORIES_QUERY,
  ALL_PROGRAMS_QUERY,
  ALL_RADIO_SHOWS_QUERY,
  ALL_RED_CIRCLES_QUERY,
} from './lib/cms/queries';
import { fetchRecentWpPosts, extractElementorContent } from './lib/cms/wordpress';

/**
 * Gotchas críticos de Sanity + Zod codificados aquí:
 *
 * 1. Sanity retorna null (no undefined) para campos opcionales vacíos.
 *    typeof null === "object" → z.optional() falla silenciosamente.
 *    Usar .nullish() en todos los campos escalares opcionales (acepta undefined Y null).
 *
 * 2. Objetos complejos (imágenes, rich text) → z.any().
 *    La validación estructural ocurre en los componentes via urlForImage()
 *    y PortableText, no en Zod. Esto también permite que los schemas de Sanity
 *    evolucionen sin romper el build de Astro.
 *
 * 3. El campo id de cada ítem debe ser único y estable → slug.current.
 *    Fallback a _id para documentos sin slug (borradores, nuevos).
 *
 * 4. Los loaders corren UNA VEZ en astro build / astro dev.
 *    Cero llamadas a Sanity en runtime.
 */

const SanitySlugSchema = z.object({
  _type: z.literal('slug'),
  current: z.string(),
});

// ─── Articles (WordPress headless) ────────────────────────────────────────────

const articles = defineCollection({
  loader: async () => {
    const posts = await fetchRecentWpPosts(50);
    return posts.map((post) => ({
      // id requerido por Astro Content Collections
      id: String(post.id),
      wpId: post.id,
      title: post.title.rendered,
      // Normalizado a la misma forma que Sanity para que los componentes no cambien
      slug: { current: post.slug },
      publishedAt: post.date,
      modifiedAt: post.modified,
      content: extractElementorContent(post.content.rendered),
      excerpt: post.excerpt.rendered.replace(/<[^>]+>/g, '').trim(),
      // mainImage como { url, alt } — getImageUrl() lo detecta y devuelve url directo
      // Verificar source_url específicamente: algunos media no lo tienen (videos, embeds)
      mainImage: post._embedded?.['wp:featuredmedia']?.[0]?.source_url
        ? {
            url: post._embedded['wp:featuredmedia'][0].source_url,
            alt: post._embedded['wp:featuredmedia'][0].alt_text || null,
          }
        : null,
      // Categorías normalizadas al shape { _id, title } que usan los componentes
      categories:
        post._embedded?.['wp:term']?.[0]?.map((c) => ({
          _id: String(c.id),
          title: c.name,
          slug: { current: c.slug },
        })) ?? [],
      tags:
        post._embedded?.['wp:term']?.[1]?.map((t) => ({
          _id: String(t.id),
          name: t.name,
          slug: t.slug,
        })) ?? [],
      author: post._embedded?.author?.[0]?.name ?? null,
      originalUrl: post.link,
    }));
  },

  schema: z.object({
    wpId: z.number(),
    title: z.string(),
    slug: z.object({ current: z.string() }),
    publishedAt: z.string().nullish(),
    modifiedAt: z.string().nullish(),
    content: z.string().nullish(),
    excerpt: z.string().nullish(),
    mainImage: z
      .object({ url: z.string(), alt: z.string().nullish() })
      .nullish(),
    categories: z
      .array(
        z.object({
          _id: z.string(),
          title: z.string(),
          slug: z.object({ current: z.string() }).nullish(),
        })
      )
      .nullish(),
    tags: z.any(),
    author: z.string().nullish(),
    originalUrl: z.string().nullish(),
  }),
});

// ─── Authors ──────────────────────────────────────────────────────────────────

const authors = defineCollection({
  loader: async () => {
    if (!isSanityConfigured) return [];
    type RawAuthor = {
      _id: string;
      slug?: { _type: 'slug'; current: string };
      [key: string]: unknown;
    };
    const data = await sanityClient.fetch<RawAuthor[]>(ALL_AUTHORS_QUERY);
    return data.map((a) => ({ id: a.slug?.current ?? a._id, ...a }));
  },

  schema: z.object({
    _id: z.string(),
    name: z.string(),
    slug: SanitySlugSchema.nullish(),
    image: z.any(),
    bio: z.array(z.any()).nullish(),
    email: z.string().nullish(),
    socialLinks: z
      .object({
        twitter: z.string().nullish(),
        linkedin: z.string().nullish(),
      })
      .nullish(),
  }),
});

// ─── Categories ───────────────────────────────────────────────────────────────

const categories = defineCollection({
  loader: async () => {
    if (!isSanityConfigured) return [];
    type RawCategory = {
      _id: string;
      slug?: { _type: 'slug'; current: string };
      title: string;
      [key: string]: unknown;
    };
    const data = await sanityClient.fetch<RawCategory[]>(ALL_CATEGORIES_QUERY);
    return data.map((c) => ({ id: c.slug?.current ?? c._id, ...c }));
  },

  schema: z.object({
    _id: z.string(),
    title: z.string(),
    slug: SanitySlugSchema.nullish(),
    description: z.string().nullish(),
    color: z.string().nullish(),
    order: z.number().nullish(),
  }),
});

// ─── Red Circles ──────────────────────────────────────────────────────────────

const redCircles = defineCollection({
  loader: async () => {
    if (!isSanityConfigured) return [];
    type RawRedCircle = {
      _id: string;
      slug: { _type: 'slug'; current: string };
      [key: string]: unknown;
    };
    const data = await sanityClient.fetch<RawRedCircle[]>(ALL_RED_CIRCLES_QUERY);
    return data.map((c) => ({ id: c.slug.current, ...c }));
  },

  schema: z.object({
    _id: z.string(),
    label: z.string(),
    slug: SanitySlugSchema,
    href: z.string().nullish(),
    image: z.any(),
    order: z.number().nullish(),
    publishedAt: z.string().nullish(),
  }),
});

// ─── Programs ─────────────────────────────────────────────────────────────────

const programs = defineCollection({
  loader: async () => {
    if (!isSanityConfigured) return [];
    type RawProgram = {
      _id: string;
      [key: string]: unknown;
    };
    const data = await sanityClient.fetch<RawProgram[]>(ALL_PROGRAMS_QUERY);
    // No hay slug en program: el id de la collection = _id
    return data.map((p) => ({ id: p._id, ...p }));
  },

  schema: z.object({
    _id: z.string(),
    title: z.string(),
    youtubeUrl: z.string(),
    // [EXP]: todos nullish hasta que se estabilice
    guest: z.string().nullish(),
    order: z.number().nullish(),
    publishedAt: z.string().nullish(),
  }),
});

// ─── Radio Shows (Lineup) ─────────────────────────────────────────────────────

const radioShows = defineCollection({
  loader: async () => {
    if (!isSanityConfigured) return [];
    type RawRadioShow = {
      _id: string;
      slug?: { _type: 'slug'; current: string };
      [key: string]: unknown;
    };
    const data = await sanityClient.fetch<RawRadioShow[]>(ALL_RADIO_SHOWS_QUERY);
    return data.map((s) => ({ id: s.slug?.current ?? s._id, ...s }));
  },

  schema: z.object({
    _id: z.string(),
    name: z.string(),
    slug: SanitySlugSchema.nullish(),
    days: z.string().nullish(),
    time: z.string().nullish(),
    order: z.number().nullish(),
  }),
});

// ─── Advertisements ───────────────────────────────────────────────────────────

const advertisements = defineCollection({
  loader: async () => {
    if (!isSanityConfigured) return [];
    type RawAd = { _id: string; [key: string]: unknown };
    const data = await sanityClient.fetch<RawAd[]>(ALL_ADVERTISEMENTS_QUERY);
    return data.map((a) => ({ id: a._id, ...a }));
  },
  schema: z.object({
    _id: z.string(),
    title: z.string(),
    brand: z.string().nullish(),
    image: z.any(),
    url: z.string().nullish(),
    placement: z.string(),
    order: z.number().nullish(),
  }),
});

export const collections = { articles, authors, categories, programs, radioShows, redCircles, advertisements };
