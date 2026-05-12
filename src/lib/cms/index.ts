/**
 * Punto de entrada público de la capa CMS.
 *
 * Todos los imports relacionados con el CMS en páginas y componentes
 * deben venir de '@/lib/cms', nunca de '@sanity/client' directamente.
 *
 * Para cambiar de CMS: reemplazar los archivos de esta carpeta.
 * Las páginas y componentes no necesitan modificación.
 */
export { sanityClient, isSanityConfigured } from './client';
export { urlForImage, getImageUrl } from './image';
export * from './queries';
export { fetchRecentWpPosts, fetchAllWpPosts, fetchWpPostBySlug, fetchWpPostsByCategory, extractElementorContent } from './wordpress';
