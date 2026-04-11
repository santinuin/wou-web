import { defineCollection, z } from 'astro:content';
import { sanityClient } from './lib/cms/client';
import {
  ALL_ARTICLES_QUERY,
  ALL_AUTHORS_QUERY,
  ALL_CATEGORIES_QUERY,
} from './lib/cms/queries';

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

// ─── Articles ─────────────────────────────────────────────────────────────────

const articles = defineCollection({
  loader: async () => {
    type RawArticle = {
      _id: string;
      slug: { _type: 'slug'; current: string };
      [key: string]: unknown;
    };
    const data = await sanityClient.fetch<RawArticle[]>(ALL_ARTICLES_QUERY);
    return data.map((a) => ({ id: a.slug.current, ...a }));
  },

  schema: z.object({
    // Núcleo invariante: tipado estricto
    _id: z.string(),
    title: z.string(),
    slug: SanitySlugSchema,
    publishedAt: z.string().nullish(),
    body: z.array(z.any()).nullish(),
    // Experimental: z.any() / .nullish() hasta que los campos se estabilicen
    format: z.string().nullish(),
    featured: z.boolean().nullish(),
    excerpt: z.string().nullish(),
    mainImage: z.any(),
    author: z.any(),
    categories: z
      .array(
        z.object({
          _id: z.string(),
          title: z.string(),
          slug: SanitySlugSchema.nullish(),
          color: z.string().nullish(),
        })
      )
      .nullish(),
  }),
});

// ─── Authors ──────────────────────────────────────────────────────────────────

const authors = defineCollection({
  loader: async () => {
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
  }),
});

export const collections = { articles, authors, categories };
