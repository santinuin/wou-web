/**
 * Utilidades para parsear URLs de YouTube en build-time.
 * Sin side effects, sin fetch: el build no debe golpear la red.
 */

const YT_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

/** Devuelve el videoId de 11 chars o null si la URL no es válida. */
export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(YT_ID_REGEX);
  return m ? m[1] : null;
}

/**
 * Thumbnail por defecto de YouTube. `maxresdefault` es la de más calidad
 * pero no siempre existe (videos viejos o privados); `hqdefault` siempre
 * existe. En build no verificamos — el <img> tendrá loading="lazy" y el
 * onerror fallback vive en el markup del consumidor.
 */
export function getYouTubeThumbUrl(videoId: string, quality: 'max' | 'hq' = 'max'): string {
  const file = quality === 'max' ? 'maxresdefault.jpg' : 'hqdefault.jpg';
  return `https://i.ytimg.com/vi/${videoId}/${file}`;
}

export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}
