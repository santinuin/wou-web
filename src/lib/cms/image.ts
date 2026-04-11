import imageUrlBuilder from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url';
import { sanityClient } from './client';

const builder = imageUrlBuilder(sanityClient);

/**
 * Retorna un ImageUrlBuilder fluido para encadenar (.width().format().url()).
 *
 * La URL resultante apunta a cdn.sanity.io y se pasa al componente <Image>
 * de Astro, que la descarga y re-optimiza en build-time.
 * El HTML final referencia /_astro/... — nunca cdn.sanity.io directamente.
 *
 * @example
 * const url = urlForImage(article.mainImage).width(1200).format('webp').url();
 * <Image src={url} width={1200} height={630} alt="..." />
 */
export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}

/**
 * Helper de conveniencia: URL lista a las dimensiones indicadas con formato automático.
 */
export function getImageUrl(
  source: SanityImageSource,
  options: { width?: number; height?: number } = {}
): string {
  let ref = builder.image(source).auto('format');
  if (options.width) ref = ref.width(options.width);
  if (options.height) ref = ref.height(options.height);
  return ref.url();
}
