import { defineCollection, z } from 'astro:content';
import { sanityClient, isSanityConfigured } from './lib/cms/client';
import {
  ALL_ADVERTISEMENTS_QUERY,
  ALL_AUTHORS_QUERY,
  ALL_CATEGORIES_QUERY,
  ALL_PROGRAMS_QUERY,
  ALL_RADIO_SHOWS_QUERY,
} from './lib/cms/queries';
import { fetchRecentSanityPosts } from './lib/cms/sanity-posts';

/**
 * Gotchas críticos de Sanity + Zod:
 *
 * 1. Sanity retorna null (no undefined) para campos opcionales vacíos.
 *    Usar .nullish() en todos los escalares opcionales.
 *
 * 2. body (Portable Text) → z.any(). Validación estructural ocurre en
 *    el componente vía <PortableText>, no aquí.
 *
 * 3. mainImage es un objeto { url, alt } de R2, no un sanity.imageAsset.
 *    getImageUrl() lo detecta y devuelve url directo.
 *
 * 4. Los loaders corren UNA VEZ en astro build / astro dev.
 */

const SanitySlugSchema = z.object({
  _type: z.literal('slug'),
  current: z.string(),
});

// ─── Articles (Sanity) ────────────────────────────────────────────────────────

const articles = defineCollection({
  loader: async () => {
    if (!isSanityConfigured) return [];

    // 50 artículos recientes para la home y el build inicial.
    // Las páginas on-demand (articulo/[slug]) fetchen directamente desde Sanity.
    const posts = await fetchRecentSanityPosts(50);

    // El loader espera un array de objetos con `id` en la raíz.
    // fetchRecentSanityPosts ya devuelve { id, data: {...} } — aplanamos para el loader.
    return posts.map(({ id, data }) => ({ id, ...data }));
  },

  schema: z.object({
    wpId: z.number().nullish(),
    title: z.string(),
    slug: z.object({ current: z.string() }),
    publishedAt: z.string().nullish(),
    modifiedAt: z.string().nullish(),
    // body solo existe en el articulo individual (on-demand), no en el loader de build
    body: z.any().nullish(),
    excerpt: z.string().nullish(),
    mainImage: z
      .object({
        url: z.string(),
        alt: z.string().nullish(),
        width: z.number().nullish(),
        height: z.number().nullish(),
      })
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
    tags: z.array(z.string()).nullish(),
    author: z.string().nullish(),
    featured: z.boolean().nullish(),
    highlightWord: z.string().nullish(),
    originalUrl: z.string().nullish(),
    seo: z.any().nullish(),
    needsReview: z.boolean().nullish(),
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
    // avatar ahora es un objeto { url, alt } — no sanity.imageAsset
    avatar: z.object({ url: z.string().nullish(), alt: z.string().nullish() }).nullish(),
    bio: z.array(z.any()).nullish(),
    email: z.string().nullish(),
    socialLinks: z
      .object({
        twitter: z.string().nullish(),
        instagram: z.string().nullish(),
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

// ─── Programs ─────────────────────────────────────────────────────────────────

const programs = defineCollection({
  loader: async () => {
    if (!isSanityConfigured) return [];
    type RawProgram = { _id: string; [key: string]: unknown };
    const data = await sanityClient.fetch<RawProgram[]>(ALL_PROGRAMS_QUERY);
    return data.map((p) => ({ id: p._id, ...p }));
  },

  schema: z.object({
    _id: z.string(),
    title: z.string(),
    youtubeUrl: z.string(),
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

export const collections = {
  articles,
  authors,
  categories,
  programs,
  radioShows,
  advertisements,
};
