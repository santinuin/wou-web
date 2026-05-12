export const prerender = false;

import type { APIRoute } from 'astro';

const CHANNEL_HANDLE = '@-WouRadio-';
const CHANNEL_ID     = 'UC3C3wmr69AvQKvs7f3pJD9w';
const FILTER         = 'cambalache';

export const GET: APIRoute = async () => {
  // 1. Intentar detectar stream en vivo
  try {
    const res = await fetch(`https://www.youtube.com/${CHANNEL_HANDLE}/live`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html.includes('"isLiveBroadcast"') || html.includes('"isLive":true')) {
        const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
        if (match?.[1]) {
          return json({ videoId: match[1], isLive: true }, 'no-store');
        }
      }
    }
  } catch {}

  // 2. Sin vivo: último video que coincida con el filtro (Cambalache)
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
      if (titleMatch?.[1]?.toLowerCase().includes(FILTER)) {
        return json({ videoId: idMatch[1], isLive: false }, 'max-age=300');
      }
    }

    // Fallback: primer video del canal
    const firstId = entries[0]?.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? null;
    return json({ videoId: firstId, isLive: false }, 'max-age=300');
  } catch {}

  return json({ videoId: null, isLive: false }, 'no-store');
};

function json(data: unknown, cache: string) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cache,
    },
  });
}
