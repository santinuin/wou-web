// ── Stream del canal ────────────────────────────────────────────────────────

const CHANNEL_ID = 'UC3C3wmr69AvQKvs7f3pJD9w';
const CHANNEL_HANDLE = '@WouRadio-';

export interface YoutubeStreamInfo {
  videoId: string | null;
  isLive: boolean;
}

/**
 * Obtiene el stream actual (si hay vivo) o el último video del canal.
 * Sin API key: usa la URL /live del canal + RSS feed.
 * Llamar solo en build-time (frontmatter de .astro o content loader).
 *
 * @param filter - Palabra clave para filtrar por título en el RSS (ej: "Cambalache").
 *                 Sin filtro, prioriza el stream en vivo del momento.
 */
export async function getYoutubeStream(filter?: string): Promise<YoutubeStreamInfo> {
  // Siempre verificar si hay un vivo primero — tiene prioridad sobre el filtro
  const liveId = await detectLiveStream();
  if (liveId) return { videoId: liveId, isLive: true };

  // Sin vivo: RSS del canal con filtro opcional por título
  return getRssFallback(filter);
}

/**
 * Detecta si hay un stream en vivo ahora mismo sin API key.
 * Fetch de /<handle>/live — si hay vivo, YouTube sirve esa página con el videoId embebido.
 */
async function detectLiveStream(): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/${CHANNEL_HANDLE}/live`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // La página del vivo incluye este marcador en los metadatos JSON-LD
    if (!html.includes('"isLiveBroadcast"') && !html.includes('"isLive":true')) return null;
    const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * RSS feed público del canal — no requiere API key.
 * Devuelve el primer video que coincida con el filtro de título, o el más reciente.
 */
async function getRssFallback(filter?: string): Promise<YoutubeStreamInfo> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
    );
    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1);

    for (const entry of entries) {
      const idMatch    = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      if (!idMatch) continue;
      if (!filter || titleMatch?.[1]?.toLowerCase().includes(filter.toLowerCase())) {
        return { videoId: idMatch[1], isLive: false };
      }
    }

    // Sin coincidencia con el filtro → último video del canal
    const firstId = entries[0]?.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? null;
    return { videoId: firstId, isLive: false };
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

// ── Últimos Shorts del canal ─────────────────────────────────────────────────

export interface YoutubeVideoInfo {
  videoId: string;
  title: string;
  thumbUrl: string;
}

// Playlist no oficial de Shorts: reemplazar "UC" → "UUSH" en el channel ID.
// YouTube la expone en el RSS igual que cualquier playlist pública.
const SHORTS_PLAYLIST_ID = 'UUSH' + CHANNEL_ID.slice(2);

const YT_VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos';

/**
 * Devuelve los últimos `count` Shorts del canal.
 *
 * Estrategia (en orden):
 * 1. RSS de la playlist de Shorts (no oficial, sin API key, sin quota).
 * 2. Si falla: YouTube Data API con videoDuration=short + filtro de duración ≤ 180 s
 *    (requiere YOUTUBE_API_KEY; puede incluir clips cortos que no son Shorts).
 *
 * Llamar solo en build-time (frontmatter de .astro o content loader).
 */
export async function getLatestYoutubeShorts(count = 5): Promise<YoutubeVideoInfo[]> {
  const fromPlaylist = await getShortsFromPlaylist(count);
  if (fromPlaylist.length > 0) return fromPlaylist;

  console.warn('[youtube] Playlist de Shorts vacía o inaccesible — intentando API fallback');
  return getShortsFromApi(count);
}

// ── Estrategia 1: RSS de la playlist UUSH (no oficial) ──────────────────────

async function getShortsFromPlaylist(count: number): Promise<YoutubeVideoInfo[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${SHORTS_PLAYLIST_ID}`
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return xml
      .split('<entry>')
      .slice(1, count + 1)
      .flatMap((entry) => {
        const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
        const title = entry.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
        if (!videoId) return [];
        return [{ videoId, title, thumbUrl: getYouTubeThumbUrl(videoId, 'hq') }];
      });
  } catch {
    return [];
  }
}

// ── Estrategia 2: API oficial con filtro de duración (fallback) ──────────────

// ISO 8601 duration → segundos (ej: "PT1M30S" → 90)
function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
}

async function getShortsFromApi(count: number): Promise<YoutubeVideoInfo[]> {
  const apiKey = import.meta.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY no configurada — sin fallback disponible');
    return [];
  }

  try {
    const searchUrl =
      `${YT_API}?part=id&channelId=${CHANNEL_ID}&type=video` +
      `&order=date&videoDuration=short&maxResults=${count * 2}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (!searchData.items?.length) return [];

    const ids = (searchData.items as { id: { videoId: string } }[])
      .map((i) => i.id.videoId)
      .join(',');

    const detailsRes = await fetch(
      `${YT_VIDEOS_API}?part=contentDetails,snippet&id=${ids}&key=${apiKey}`
    );
    const detailsData = await detailsRes.json();

    type RawVideo = {
      id: string;
      contentDetails: { duration: string };
      snippet: { title: string };
    };

    return (detailsData.items as RawVideo[])
      .filter((v) => parseDurationSeconds(v.contentDetails.duration) <= 180)
      .slice(0, count)
      .map((v) => ({
        videoId: v.id,
        title: v.snippet.title,
        thumbUrl: getYouTubeThumbUrl(v.id, 'hq'),
      }));
  } catch (err) {
    console.error('[youtube] Error API getShortsFromApi:', err);
    return [];
  }
}
