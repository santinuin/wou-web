/**
 * FASE 3: Migración de posts WordPress → Sanity
 *
 * Pre-requisitos:
 *   1. media-url-map.json debe existir (Fase 2 completada)
 *   2. Sanity: autores y categorías ya importados (este script los importa primero)
 *   3. bun add -d @sanity/block-tools @sanity/schema jsdom @types/jsdom
 *
 * Variables de entorno en .env.migration:
 *   PUBLIC_SANITY_PROJECT_ID=
 *   PUBLIC_SANITY_DATASET=production
 *   SANITY_API_WRITE_TOKEN=       ← token con permisos editor o administrator
 *
 * Ejecutar:
 *   bun run scripts/migrate-posts-to-sanity.ts
 *
 * Genera:
 *   migration-posts-log.json   { done: [], failed: [] }
 *
 * Es reanudable: si se interrumpe, volver a ejecutar y continúa donde quedó.
 */

import { createClient } from '@sanity/client';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// ─── Configuración ────────────────────────────────────────────────────────────

const WP_BASE = 'https://wou.com.ar/wp-json/wp/v2';

const sanity = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2025-05-26',
  token: process.env.SANITY_API_WRITE_TOKEN!,
  useCdn: false,
});

const LOG_FILE = 'migration-posts-log.json';
const MAP_FILE = 'media-url-map.json';

// ─── Estado persistente ───────────────────────────────────────────────────────

const log: { done: number[]; failed: { id: number; slug?: string; reason: string }[] } =
  existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE, 'utf8')) : { done: [], failed: [] };

const urlMap: Record<string, string> = existsSync(MAP_FILE)
  ? JSON.parse(readFileSync(MAP_FILE, 'utf8'))
  : {};

const doneSet = new Set(log.done);

if (Object.keys(urlMap).length === 0) {
  console.error('❌ media-url-map.json vacío o inexistente. Ejecutar primero Fase 2.');
  process.exit(1);
}

// ─── Limpieza de HTML de Elementor / WPBakery ─────────────────────────────────

/**
 * Extrae el contenido real del HTML de Elementor (misma lógica que wordpress.ts).
 * Si no hay Elementor, devuelve el HTML tal cual.
 */
function extractElementorContent(html: string): string {
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
        if (depth === 0) results.push(html.slice(openTagEnd, nextClose).trim());
        pos = nextClose + 6;
      }
    }
    searchFrom = openTagEnd;
  }

  return results.join('\n') || html;
}

/** Reemplaza todas las URLs de WP en el HTML por las URLs de R2. */
function replaceMediaUrls(html: string): string {
  let result = html;

  // URLs absolutas de WordPress (ordenadas por largo desc para evitar reemplazos parciales)
  const sortedEntries = Object.entries(urlMap).sort(([a], [b]) => b.length - a.length);
  for (const [wpUrl, r2Url] of sortedEntries) {
    result = result.replaceAll(wpUrl, r2Url);
  }

  // URLs relativas /wp-content/uploads/...
  result = result.replace(
    /(["'])\/wp-content\/uploads\/([^"']+)\1/g,
    (match, quote, path) => {
      const fullWpUrl = `https://wou.com.ar/wp-content/uploads/${path}`;
      const r2Url = urlMap[fullWpUrl];
      return r2Url ? `${quote}${r2Url}${quote}` : match;
    },
  );

  return result;
}

/** Elimina shortcodes de WPBakery y otros plugins. */
function stripShortcodes(html: string): string {
  return html.replace(/\[\/?[a-z_][a-z0-9_-]*[^\]]*\]/gi, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

// ─── Conversión HTML → Portable Text ─────────────────────────────────────────

/**
 * Convierte HTML limpio a Portable Text usando @sanity/block-tools + jsdom.
 *
 * Importación dinámica porque estas dependencias solo existen en el script
 * de migración — no en el build normal del proyecto.
 */
async function htmlToPortableText(html: string): Promise<any[]> {
  try {
    const { htmlToBlocks } = await import('@sanity/block-tools');
    const { Schema } = await import('@sanity/schema');
    const { JSDOM } = await import('jsdom');

    // Schema mínimo para definir el tipo de contenido
    const schema = Schema.compile({
      name: 'migration',
      types: [
        {
          name: 'migrationContent',
          type: 'document',
          fields: [
            {
              name: 'body',
              type: 'array',
              of: [
                { type: 'block' },
                // r2Image se agrega como objeto custom a los bloques que contienen <img>
              ],
            },
          ],
        },
      ],
    });

    const blockContentType = schema
      .get('migrationContent')
      ?.fields.find((f: any) => f.name === 'body')?.type;

    if (!blockContentType) {
      throw new Error('No se pudo compilar el schema de migración');
    }

    const blocks = htmlToBlocks(html, blockContentType, {
      parseHtml: (rawHtml: string) => new JSDOM(rawHtml).window.document,
      rules: [
        // Regla custom: convertir <img> en bloques r2Image en vez de bloques de texto vacíos
        {
          deserialize(el: Element, next: Function, block: Function) {
            if (el.tagName !== 'IMG') return undefined;
            const src = el.getAttribute('src') ?? '';
            const alt = el.getAttribute('alt') ?? '';
            const width = parseInt(el.getAttribute('width') ?? '0', 10) || undefined;
            const height = parseInt(el.getAttribute('height') ?? '0', 10) || undefined;

            if (!src) return undefined;

            // Aplicar mapeo de URLs WP → R2 también aquí (por si quedó alguno)
            const resolvedUrl = urlMap[src] ?? src;

            return block({
              _type: 'r2Image',
              url: resolvedUrl,
              alt: alt || undefined,
              width,
              height,
            });
          },
        },
      ],
    });

    return blocks;
  } catch (err: any) {
    console.warn(`    ⚠ htmlToBlocks falló: ${err.message} — usando fallback de texto plano`);
    // Fallback: un único bloque de texto con el contenido plano
    const plain = stripHtml(html);
    return plain
      ? [{ _type: 'block', style: 'normal', children: [{ _type: 'span', text: plain }] }]
      : [];
  }
}

// ─── Fetch de WordPress ───────────────────────────────────────────────────────

async function fetchWpAuthors(): Promise<any[]> {
  const res = await fetch(`${WP_BASE}/users?per_page=100`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchWpCategories(): Promise<any[]> {
  const items: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${WP_BASE}/categories?per_page=100&page=${page}`);
    if (res.status === 400 || !res.ok) break;
    const data = await res.json();
    if (!data.length) break;
    items.push(...data);
    page++;
  }
  return items;
}

// ─── Importación a Sanity ─────────────────────────────────────────────────────

async function importAuthors(wpAuthors: any[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  console.log(`\n👤 Importando ${wpAuthors.length} autores…`);

  for (const a of wpAuthors) {
    const doc = {
      _type: 'author',
      _id: `author-wp-${a.id}`,
      wpId: a.id,
      wpLogin: a.slug,
      name: a.name,
      slug: { _type: 'slug', current: a.slug },
      bio: a.description ? undefined : undefined, // WP bio es texto plano, no rich text
      email: a.email || undefined,
      avatar: a.avatar_urls?.['96']
        ? { url: urlMap[a.avatar_urls['96']] ?? a.avatar_urls['96'], alt: a.name }
        : undefined,
    };

    await sanity.createOrReplace(doc);
    map[a.id] = `author-wp-${a.id}`;
    console.log(`  ✓ ${a.name}`);
  }

  return map;
}

async function importCategories(wpCategories: any[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  console.log(`\n📂 Importando ${wpCategories.length} categorías…`);

  // Primera pasada: crear todas sin parent
  for (const cat of wpCategories) {
    const doc = {
      _type: 'category',
      _id: `category-wp-${cat.id}`,
      wpId: cat.id,
      title: cat.name,
      slug: { _type: 'slug', current: cat.slug },
      description: cat.description || undefined,
    };
    await sanity.createOrReplace(doc);
    map[cat.id] = `category-wp-${cat.id}`;
    console.log(`  ✓ ${cat.name}`);
  }

  // Segunda pasada: asignar parent donde corresponda
  for (const cat of wpCategories.filter((c) => c.parent > 0)) {
    if (map[cat.parent]) {
      await sanity
        .patch(`category-wp-${cat.id}`)
        .set({ parent: { _type: 'reference', _ref: map[cat.parent] } })
        .commit();
    }
  }

  return map;
}

async function importPosts(
  authorMap: Record<number, string>,
  categoryMap: Record<number, string>,
) {
  console.log('\n📰 Importando artículos…');

  let page = 1;
  const PER_PAGE = 10; // Bajo por el procesamiento HTML — no saturar Sanity API

  while (true) {
    console.log(`\n  Página ${page}…`);

    const res = await fetch(
      `${WP_BASE}/posts?per_page=${PER_PAGE}&page=${page}&status=any&_embed`,
    );

    if (res.status === 400) break; // No hay más páginas
    if (!res.ok) { console.error(`  ✗ HTTP ${res.status}`); break; }

    const posts: any[] = await res.json();
    if (!posts.length) break;

    for (const wp of posts) {
      if (doneSet.has(wp.id)) {
        process.stdout.write('·');
        continue;
      }

      try {
        // 1. Extraer y limpiar HTML
        const rawContent = wp.content?.rendered ?? '';
        const elementorContent = extractElementorContent(rawContent);
        const cleanedHtml = replaceMediaUrls(stripShortcodes(elementorContent));

        // 2. Convertir a Portable Text
        let body: any[] = [];
        let needsReview = false;

        if (cleanedHtml.trim()) {
          body = await htmlToPortableText(cleanedHtml);
          // Heurística: si el body tiene muy poco contenido vs el original, marcar para revisión
          const originalLength = stripHtml(rawContent).length;
          const bodyText = body.map((b: any) => b.children?.map((c: any) => c.text).join('') ?? '').join('');
          if (originalLength > 200 && bodyText.length < originalLength * 0.3) {
            needsReview = true;
          }
        }

        // 3. Imagen principal
        const featuredMedia = wp._embedded?.['wp:featuredmedia']?.[0];
        const wpImageUrl: string | undefined = featuredMedia?.source_url;
        const mainImage = wpImageUrl
          ? {
              url: urlMap[wpImageUrl] ?? wpImageUrl,
              alt: featuredMedia?.alt_text || stripHtml(wp.title?.rendered ?? '') || null,
              width: featuredMedia?.media_details?.width ?? undefined,
              height: featuredMedia?.media_details?.height ?? undefined,
            }
          : undefined;

        // 4. Categorías y tags
        const categoryRefs = (wp.categories ?? [])
          .filter((id: number) => categoryMap[id])
          .map((id: number, i: number) => ({
            _type: 'reference',
            _ref: categoryMap[id],
            _key: `cat-${id}-${i}`,
          }));

        const tags: string[] = (wp._embedded?.['wp:term']?.[1] ?? []).map((t: any) => t.name);

        // 5. Excerpt limpio
        const excerpt = stripHtml(wp.excerpt?.rendered ?? '').slice(0, 300) || undefined;

        // 6. Título limpio (WP puede tener HTML entities en el título)
        const title = stripHtml(wp.title?.rendered ?? '').replace(/&amp;/g, '&').replace(/&#8220;/g, '"').replace(/&#8221;/g, '"').replace(/&#8217;/g, "'") || 'Sin título';

        // 7. SEO (Yoast/AIOSEO — si está disponible en el JSON)
        const yoast = wp.yoast_head_json ?? {};
        const seo = (yoast.title || yoast.description)
          ? {
              title: yoast.og_title ?? yoast.title ?? undefined,
              description: yoast.og_description ?? yoast.description ?? undefined,
              canonicalUrl: wp.link ?? undefined,
            }
          : { canonicalUrl: wp.link ?? undefined };

        const doc = {
          _type: 'article',
          _id: `article-wp-${wp.id}`,
          wpId: wp.id,
          title,
          slug: { _type: 'slug', current: wp.slug },
          publishedAt: wp.date_gmt ? `${wp.date_gmt}Z` : undefined,
          modifiedAt: wp.modified_gmt ? `${wp.modified_gmt}Z` : undefined,
          excerpt,
          body,
          mainImage,
          categories: categoryRefs.length ? categoryRefs : undefined,
          tags: tags.length ? tags : undefined,
          author: authorMap[wp.author]
            ? { _type: 'reference', _ref: authorMap[wp.author] }
            : undefined,
          featured: false,
          originalUrl: wp.link ?? undefined,
          needsReview,
          seo,
        };

        await sanity.createOrReplace(doc);

        // Publicar solo los posts que estaban publicados en WP
        if (wp.status === 'publish') {
          await sanity.publish(`article-wp-${wp.id}`);
        }

        log.done.push(wp.id);
        doneSet.add(wp.id);
        process.stdout.write(needsReview ? '⚠' : '✓');
      } catch (err: any) {
        process.stdout.write('✗');
        log.failed.push({ id: wp.id, slug: wp.slug, reason: err.message });
      }
    }

    // Guardar progreso al final de cada página
    writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));

    page++;
    await new Promise((r) => setTimeout(r, 300)); // Pausa entre páginas
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.PUBLIC_SANITY_PROJECT_ID || !process.env.SANITY_API_WRITE_TOKEN) {
    console.error('❌ PUBLIC_SANITY_PROJECT_ID y SANITY_API_WRITE_TOKEN son requeridos.');
    process.exit(1);
  }

  console.log('🚀 Migración WordPress → Sanity\n');
  console.log(`   Proyecto: ${process.env.PUBLIC_SANITY_PROJECT_ID}`);
  console.log(`   Dataset:  ${process.env.PUBLIC_SANITY_DATASET ?? 'production'}`);
  console.log(`   URL map:  ${Object.keys(urlMap).length} entradas\n`);

  const wpAuthors = await fetchWpAuthors();
  const wpCategories = await fetchWpCategories();

  const authorMap = await importAuthors(wpAuthors);
  const categoryMap = await importCategories(wpCategories);

  await importPosts(authorMap, categoryMap);

  // Guardar log final
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));

  console.log(`\n\n✅ Migración completada:`);
  console.log(`   Posts migrados: ${log.done.length}`);
  console.log(`   Errores: ${log.failed.length}`);

  if (log.failed.length > 0) {
    console.log(`\n⚠️  Posts con errores:`);
    log.failed.slice(0, 10).forEach((f) => {
      console.log(`   [${f.id}] ${f.slug} — ${f.reason}`);
    });
    if (log.failed.length > 10) {
      console.log(`   … y ${log.failed.length - 10} más. Ver ${LOG_FILE}`);
    }
  }

  console.log('\n📋 Próximos pasos:');
  console.log('   1. Verificar 20 artículos al azar en Sanity Studio');
  console.log('   2. Revisar los marcados con ⚠ (needsReview: true)');
  console.log('   3. Ejecutar bun run build y verificar que no haya errores');
}

main().catch((err) => {
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  console.error('\n💥 Error fatal:', err);
  process.exit(1);
});
