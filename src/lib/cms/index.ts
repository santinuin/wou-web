/**
 * Punto de entrada público de la capa CMS.
 *
 * Para cambiar de CMS: reemplazar los archivos de esta carpeta.
 * Las páginas y componentes no necesitan modificación.
 *
 * Artículos: ahora servidos por Sanity (sanity-posts.ts).
 * WordPress (wordpress.ts) se mantiene solo para los scripts de migración —
 * no debe importarse desde páginas o componentes.
 */
export { sanityClient, isSanityConfigured } from './client';
export { urlForImage, getImageUrl } from './image';
export * from './queries';

// ── Artículos desde Sanity ────────────────────────────────────────────────────
export {
  fetchRecentSanityPosts,
  fetchSanityPostsByCategory,
  fetchSanityPostBySlug,
} from './sanity-posts';
