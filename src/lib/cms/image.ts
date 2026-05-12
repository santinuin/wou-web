import imageUrlBuilder from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url';
import { sanityClient } from './client';

const builder = imageUrlBuilder(sanityClient);

// Imagen proveniente de WordPress: objeto con url directa
type WpImageSource = { url: string; alt?: string | null };

function isWpImage(source: unknown): source is WpImageSource {
  return (
    typeof source === 'object' &&
    source !== null &&
    'url' in source &&
    typeof (source as WpImageSource).url === 'string'
  );
}

export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}

/**
 * Devuelve una URL de imagen lista para usar.
 * Acepta tanto referencias de Sanity como objetos { url } de WordPress.
 */
export function getImageUrl(
  source: SanityImageSource | WpImageSource | string,
  options: { width?: number; height?: number } = {}
): string {
  if (typeof source === 'string') return source;
  if (isWpImage(source)) return source.url;
  let ref = builder.image(source as SanityImageSource).auto('format');
  if (options.width) ref = ref.width(options.width);
  if (options.height) ref = ref.height(options.height);
  return ref.url();
}
