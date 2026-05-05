/**
 * Utilidades para parsear URLs de YouTube en build-time.
 * Sin side effects, sin fetch: el build no debe golpear la red.
 */

// ── Stream del canal ────────────────────────────────────────────────────────

const CHANNEL_ID = 'UC3C3wmr69AvQKvs7f3pJD9w';
const YT_API = 'https://www.googleapis.com/youtube/v3/search';

export interface YoutubeStreamInfo {
  videoId: string | null;
  isLive: boolean;
}

/**
 * Obtiene el stream actual (si hay vivo) o el último stream grabado.
 * Usa YouTube Data API si YOUTUBE_API_KEY está definida; si no, RSS feed.
 * Llamar solo en build-time (frontmatter de .astro o content loader).
 *
 * @param filter - Palabra clave para filtrar por título (ej: "Cambalache").
 *                 Si no se pasa, trae cualquier stream del canal.
 */
export async function getYoutubeStream(filter?: string): Promise<YoutubeStreamInfo> {
  const apiKey = import.meta.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY no configurada — RSS fallback');
    return getRssFallback();
  }

  const q = filter ? `&q=${encodeURIComponent(filter)}` : '';
  const base = `${YT_API}?part=id&channelId=${CHANNEL_ID}&type=video&maxResults=1&key=${apiKey}${q}`;

  try {
    // Si hay filtro de programa, no tiene sentido buscar "vivo de Cambalache"
    // porque el vivo del canal es siempre uno solo. Sí buscamos vivo sin filtro.
    if (!filter) {
      const liveRes = await fetch(`${base}&eventType=live`);
      const liveData = await liveRes.json();
      const liveId: string | null = liveData.items?.[0]?.id?.videoId ?? null;
      if (liveId) return { videoId: liveId, isLive: true };
    }

    const completedRes = await fetch(`${base}&eventType=completed&order=date`);
    const completedData = await completedRes.json();
    const completedId: string | null = completedData.items?.[0]?.id?.videoId ?? null;
    return { videoId: completedId, isLive: false };
  } catch (err) {
    console.error('[youtube] Error API:', err);
    return getRssFallback();
  }
}

async function getRssFallback(): Promise<YoutubeStreamInfo> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
    );
    const xml = await res.text();
    const match = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    return { videoId: match?.[1] ?? null, isLive: false };
  } catch {
    return { videoId: null, isLive: false };
  }
}

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
