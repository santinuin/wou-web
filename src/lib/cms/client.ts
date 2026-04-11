import { createClient } from '@sanity/client';

/**
 * Cliente Sanity exclusivo para build-time.
 *
 * Invariantes que no deben cambiar:
 * - useCdn: false            → fetch directo a la API, no al cache CDN
 * - perspective: 'published' → solo contenido publicado, nunca borradores
 * - token: SANITY_API_READ_TOKEN (sin prefijo PUBLIC_, nunca llega al browser)
 *
 * Este archivo solo debe importarse desde:
 *   - src/content.config.ts  (loaders de Content Collections)
 *   - src/lib/cms/image.ts   (imageUrlBuilder)
 *
 * Las páginas .astro consumen datos exclusivamente via getCollection() / getEntry().
 */
export const sanityClient = createClient({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET,
  // Versión fija — nunca usar 'latest' para evitar breaking changes silenciosos
  apiVersion: '2024-01-01',
  useCdn: false,
  perspective: 'published',
  token: import.meta.env.SANITY_API_READ_TOKEN,
});
