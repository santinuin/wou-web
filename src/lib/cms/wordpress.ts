const WP_BASE = 'https://wou.com.ar/wp-json/wp/v2';

export interface WpPost {
  id: number;
  slug: string;
  date: string;
  modified: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url: string; alt_text: string }>;
    'wp:term'?: Array<Array<{ id: number; name: string; slug: string }>>;
    author?: Array<{ name: string }>;
  };
}

/**
 * Extrae el contenido real del HTML generado por Elementor.
 * Usa un contador de profundidad para manejar divs anidados correctamente.
 * Posts con editor clásico (sin Elementor) se devuelven tal cual.
 */
export function extractElementorContent(html: string): string {
  if (!html.includes('elementor-text-editor')) return html;

  const results: string[] = [];
  const marker = 'elementor-text-editor';
  let searchFrom = 0;

  while (true) {
    const markerIdx = html.indexOf(marker, searchFrom);
    if (markerIdx === -1) break;

    const openTagEnd = html.indexOf('>', markerIdx) + 1;
    let depth = 1;
    let pos = openTagEnd;

    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          results.push(html.slice(openTagEnd, nextClose).trim());
        }
        pos = nextClose + 6;
      }
    }

    searchFrom = openTagEnd;
  }

  return results.join('\n') || html;
}

/**
 * Trae un post individual por slug para rutas on-demand.
 */
export async function fetchWpPostBySlug(slug: string): Promise<WpPost | null> {
  const res = await fetch(
    `${WP_BASE}/posts?slug=${encodeURIComponent(slug)}&status=publish&_embed`
  );
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    const posts: WpPost[] = JSON.parse(text);
    return posts[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Trae los N posts más recientes para prerender en build-time.
 * Una sola request — la home nunca necesita el catálogo completo.
 */
export async function fetchRecentWpPosts(count = 50): Promise<WpPost[]> {
  // per_page=50 máximo con _embed — donWeb cierra la conexión con valores mayores
  const res = await fetch(
    `${WP_BASE}/posts?per_page=${Math.min(count, 50)}&page=1&status=publish&_embed`
  );
  if (!res.ok) return [];
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return [];
  const text = await res.text();
  if (!text.trim()) return [];
  try {
    const posts: WpPost[] = JSON.parse(text);
    return Array.isArray(posts) ? posts : [];
  } catch {
    return [];
  }
}

/**
 * Trae todos los posts publicados paginando de 50 en 50.
 * Solo usar si se necesita el catálogo completo (migraciones, sitemaps, etc.).
 */
export async function fetchAllWpPosts(): Promise<WpPost[]> {
  const posts: WpPost[] = [];
  let page = 1;

  while (true) {
    // per_page=50 máximo con _embed — donWeb cierra la conexión con valores mayores
    const res = await fetch(
      `${WP_BASE}/posts?per_page=50&page=${page}&status=publish&_embed`
    );

    if (!res.ok) break;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) break;

    const text = await res.text();
    if (!text.trim()) break;

    let batch: WpPost[];
    try {
      batch = JSON.parse(text);
    } catch {
      break;
    }

    if (!Array.isArray(batch) || batch.length === 0) break;

    posts.push(...batch);
    page++;
  }

  return posts;
}
