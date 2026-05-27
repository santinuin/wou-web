/**
 * migrate-sample.ts — Migración de muestra: 10 posts más recientes por categoría.
 *
 * Para validar el flujo editorial antes de la migración completa.
 * TODOS los posts quedan con needsReview: true para revisión manual en el Studio.
 *
 * No requiere Fase 2 (media-url-map.json) — las imágenes del cuerpo mantienen
 * la URL original de WordPress; el redactor las reemplaza durante la revisión.
 * La mainImage sí se intenta resolver desde el urlMap si existe.
 *
 * Pre-requisitos:
 *   bun add -d @sanity/client @sanity/block-tools @sanity/schema jsdom @types/jsdom
 *
 * Variables de entorno (en .env.migration o exportadas en la shell):
 *   PUBLIC_SANITY_PROJECT_ID=xv9180xg
 *   PUBLIC_SANITY_DATASET=production
 *   SANITY_API_WRITE_TOKEN=<token editor o administrator de Sanity>
 *
 * Ejecutar:
 *   bun run scripts/migrate-sample.ts
 *
 * Reanudable: los wpId ya migrados se saltan automáticamente.
 */

import { createClient } from '@sanity/client';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// ─── Config ───────────────────────────────────────────────────────────────────

const WP_BASE = 'https://wou.com.ar/wp-json/wp/v2';

const POSTS_PER_CATEGORY = 10;

// Categorías a migrar: slug de WordPress → display
const TARGET_CATEGORIES = [
  'circulo-rojo',
  'politica',
  'locales',
  'policiales',
  'opinion',
  'deportes',
  'sociedad',
  'cultura',
  'economia',
  'turismo',
  'ambiente',
  'nacionales',
];

const sanity = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID!,
  dataset:   process.env.PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2025-05-26',
  token:     process.env.SANITY_API_WRITE_TOKEN!,
  useCdn:    false,
});

const LOG_FILE = 'migration-sample-log.json';

// urlMap es opcional — si existe se usa para reemplazar URLs de media
const urlMap: Record<string, string> = existsSync('media-url-map.json')
  ? JSON.parse(readFileSync('media-url-map.json', 'utf8'))
  : {};

const log: {
  done: number[];
  skipped: number[];
  failed: { id: number; slug?: string; reason: string }[];
} = existsSync(LOG_FILE)
  ? JSON.parse(readFileSync(LOG_FILE, 'utf8'))
  : { done: [], skipped: [], failed: [] };

const doneSet = new Set(log.done);

// ─── Helpers HTML ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim();
}

function stripShortcodes(html: string): string {
  return html.replace(/\[\/?[a-z_][a-z0-9_-]*[^\]]*\]/gi, '');
}

function extractElementorContent(html: string): string {
  if (!html.includes('elementor-text-editor')) return html;
  const results: string[] = [];
  const marker = 'elementor-text-editor';
  let searchFrom = 0;
  while (true) {
    const markerIdx = html.indexOf(marker, searchFrom);
    if (markerIdx === -1) break;
    const openTagEnd = html.indexOf('>', markerIdx) + 1;
    let depth = 1, pos = openTagEnd;
    while (depth > 0 && pos < html.length) {
      const nextOpen  = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 4; }
      else { depth--; if (depth === 0) results.push(html.slice(openTagEnd, nextClose).trim()); pos = nextClose + 6; }
    }
    searchFrom = openTagEnd;
  }
  return results.join('\n') || html;
}

function resolveMediaUrl(url: string): string {
  return urlMap[url] ?? url;
}

// ─── Conversión HTML → Portable Text ─────────────────────────────────────────

async function htmlToPortableText(html: string): Promise<any[]> {
  try {
    const { htmlToBlocks } = await import('@sanity/block-tools');
    const { Schema }       = await import('@sanity/schema');
    const { JSDOM }        = await import('jsdom');

    const schema = Schema.compile({
      name: 'migration',
      types: [{
        name: 'migrationContent',
        type: 'document',
        fields: [{ name: 'body', type: 'array', of: [{ type: 'block' }] }],
      }],
    });

    const blockContentType = schema
      .get('migrationContent')
      ?.fields.find((f: any) => f.name === 'body')?.type;

    if (!blockContentType) throw new Error('Schema de migración no compiló');

    const blocks = htmlToBlocks(html, blockContentType, {
      parseHtml: (rawHtml: string) => new JSDOM(rawHtml).window.document,
      rules: [
        {
          deserialize(el: Element, _next: Function, block: Function) {
            if (el.tagName !== 'IMG') return undefined;
            const src = el.getAttribute('src') ?? '';
            if (!src) return undefined;
            return block({
              _type: 'r2Image',
              url:    resolveMediaUrl(src),
              alt:    el.getAttribute('alt') || undefined,
              width:  parseInt(el.getAttribute('width')  ?? '0', 10) || undefined,
              height: parseInt(el.getAttribute('height') ?? '0', 10) || undefined,
            });
          },
        },
      ],
    });

    return blocks;
  } catch (err: any) {
    // Fallback: texto plano si falta la dependencia o hay error de parseo
    console.warn(`    ⚠ htmlToBlocks falló (${err.message}) — texto plano`);
    const plain = stripHtml(html);
    return plain
      ? [{ _type: 'block', style: 'normal', children: [{ _type: 'span', text: plain }] }]
      : [];
  }
}

// ─── Fetch WordPress ──────────────────────────────────────────────────────────

async function fetchWpCategories(): Promise<any[]> {
  const res = await fetch(`${WP_BASE}/categories?per_page=100`);
  if (!res.ok) throw new Error(`WP categories HTTP ${res.status}`);
  return res.json();
}

async function fetchWpAuthors(): Promise<any[]> {
  const res = await fetch(`${WP_BASE}/users?per_page=100`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchPostsByWpCategoryId(wpCategoryId: number): Promise<any[]> {
  const res = await fetch(
    `${WP_BASE}/posts?categories=${wpCategoryId}&per_page=${POSTS_PER_CATEGORY}&orderby=date&order=desc&status=publish&_embed`,
  );
  if (!res.ok) return [];
  return res.json();
}

// ─── Importar a Sanity ────────────────────────────────────────────────────────

async function importAuthors(wpAuthors: any[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  if (!wpAuthors.length) return map;

  console.log(`\n👤 Importando ${wpAuthors.length} autores…`);
  for (const a of wpAuthors) {
    const sanityId = `author-wp-${a.id}`;
    await sanity.createOrReplace({
      _type:   'author',
      _id:     sanityId,
      wpId:    a.id,
      wpLogin: a.slug,
      name:    a.name,
      slug:    { _type: 'slug', current: a.slug },
      avatar:  a.avatar_urls?.['96']
        ? { url: resolveMediaUrl(a.avatar_urls['96']), alt: a.name }
        : undefined,
    });
    map[a.id] = sanityId;
    process.stdout.write('·');
  }
  console.log(' OK');
  return map;
}

async function importCategories(
  wpCategories: any[],
  targetSlugs: string[],
): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  const toImport = wpCategories.filter((c) => targetSlugs.includes(c.slug));

  console.log(`\n📂 Importando ${toImport.length} categorías…`);
  for (const cat of toImport) {
    const sanityId = `category-wp-${cat.id}`;
    await sanity.createOrReplace({
      _type:       'category',
      _id:         sanityId,
      wpId:        cat.id,
      title:       cat.name,
      slug:        { _type: 'slug', current: cat.slug },
      description: cat.description || undefined,
    });
    map[cat.id] = sanityId;
    console.log(`  ✓ ${cat.name}`);
  }
  return map;
}

// ─── Migrar posts por categoría ───────────────────────────────────────────────

async function importPostsForCategory(
  wpCategory: any,
  authorMap: Record<number, string>,
  categoryMap: Record<number, string>,
): Promise<void> {
  const posts = await fetchPostsByWpCategoryId(wpCategory.id);

  if (!posts.length) {
    console.log(`  (sin posts publicados)`);
    return;
  }

  for (const wp of posts) {
    if (doneSet.has(wp.id)) {
      process.stdout.write('·');
      log.skipped.push(wp.id);
      continue;
    }

    try {
      // 1. Limpiar HTML
      const rawHtml = wp.content?.rendered ?? '';
      const cleanHtml = stripShortcodes(extractElementorContent(rawHtml));

      // 2. Portable Text — todos marcados needsReview: true (revisión editorial manual)
      const body = cleanHtml.trim() ? await htmlToPortableText(cleanHtml) : [];

      // 3. Imagen principal (URL de WP → R2 si existe en el mapa)
      const media     = wp._embedded?.['wp:featuredmedia']?.[0];
      const wpImgUrl  = media?.source_url;
      const mainImage = wpImgUrl
        ? {
            url:    resolveMediaUrl(wpImgUrl),
            alt:    media?.alt_text || stripHtml(wp.title?.rendered ?? '') || null,
            width:  media?.media_details?.width  ?? undefined,
            height: media?.media_details?.height ?? undefined,
          }
        : undefined;

      // 4. Categorías (solo las que están en el mapa)
      const categoryRefs = (wp.categories ?? [])
        .filter((id: number) => categoryMap[id])
        .map((id: number, i: number) => ({
          _type: 'reference',
          _ref:  categoryMap[id],
          _key:  `cat-${id}-${i}`,
        }));

      // 5. Tags
      const tags: string[] = (wp._embedded?.['wp:term']?.[1] ?? []).map((t: any) => t.name);

      // 6. Título y excerpt limpios
      const title   = stripHtml(wp.title?.rendered ?? '') || 'Sin título';
      const excerpt = stripHtml(wp.excerpt?.rendered ?? '').slice(0, 300) || undefined;

      const doc = {
        _type:       'article',
        _id:         `article-wp-${wp.id}`,
        wpId:        wp.id,
        title,
        slug:        { _type: 'slug', current: wp.slug },
        publishedAt: wp.date_gmt  ? `${wp.date_gmt}Z`      : undefined,
        modifiedAt:  wp.modified_gmt ? `${wp.modified_gmt}Z` : undefined,
        excerpt,
        body,
        mainImage,
        categories:  categoryRefs.length ? categoryRefs : undefined,
        tags:        tags.length ? tags : undefined,
        author:      authorMap[wp.author]
          ? { _type: 'reference', _ref: authorMap[wp.author] }
          : undefined,
        featured:    false,
        originalUrl: wp.link ?? undefined,
        // Todos marcados para revisión editorial manual
        needsReview: true,
      };

      // createOrReplace con _id sin prefijo "drafts." → crea documento publicado
      await sanity.createOrReplace(doc);

      log.done.push(wp.id);
      doneSet.add(wp.id);
      process.stdout.write('✓');
    } catch (err: any) {
      process.stdout.write('✗');
      log.failed.push({ id: wp.id, slug: wp.slug, reason: err.message });
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.PUBLIC_SANITY_PROJECT_ID || !process.env.SANITY_API_WRITE_TOKEN) {
    console.error('❌ Faltan variables de entorno:');
    console.error('   PUBLIC_SANITY_PROJECT_ID y SANITY_API_WRITE_TOKEN son requeridas.');
    console.error('\nEjemplo:');
    console.error('   PUBLIC_SANITY_PROJECT_ID=xv9180xg SANITY_API_WRITE_TOKEN=sk... bun run scripts/migrate-sample.ts');
    process.exit(1);
  }

  console.log('🚀 Migración de muestra: 10 posts por categoría\n');
  console.log(`   Proyecto: ${process.env.PUBLIC_SANITY_PROJECT_ID}`);
  console.log(`   Dataset:  ${process.env.PUBLIC_SANITY_DATASET ?? 'production'}`);
  console.log(`   urlMap:   ${Object.keys(urlMap).length} entradas (${Object.keys(urlMap).length ? 'URLs de media se resolverán' : 'sin mapa — se usan URLs de WP'})`);
  console.log(`   Categorías: ${TARGET_CATEGORIES.join(', ')}\n`);

  // 1. Traer catálogos de WP
  console.log('Obteniendo categorías y autores de WordPress…');
  const [wpCategories, wpAuthors] = await Promise.all([
    fetchWpCategories(),
    fetchWpAuthors(),
  ]);

  // 2. Importar autores y categorías a Sanity
  const authorMap   = await importAuthors(wpAuthors);
  const categoryMap = await importCategories(wpCategories, TARGET_CATEGORIES);

  // 3. Por cada categoría target, migrar 10 posts
  const targetWpCategories = wpCategories.filter((c) => TARGET_CATEGORIES.includes(c.slug));

  if (!targetWpCategories.length) {
    console.error('\n❌ No se encontraron las categorías en WordPress. Verificar los slugs.');
    process.exit(1);
  }

  for (const cat of targetWpCategories) {
    console.log(`\n📂 ${cat.name} (id: ${cat.id})`);
    await importPostsForCategory(cat, authorMap, categoryMap);
    // Guardar progreso tras cada categoría
    writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    await new Promise((r) => setTimeout(r, 200));
  }

  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));

  const total = TARGET_CATEGORIES.length * POSTS_PER_CATEGORY;
  console.log(`\n\n✅ Migración de muestra completada:`);
  console.log(`   Posts migrados:   ${log.done.length} / ~${total} esperados`);
  console.log(`   Ya existían:      ${log.skipped.length}`);
  console.log(`   Errores:          ${log.failed.length}`);

  if (log.failed.length) {
    console.log(`\n⚠️  Errores:`);
    log.failed.forEach((f) => console.log(`   [${f.id}] ${f.slug} — ${f.reason}`));
  }

  console.log('\n📋 Próximos pasos:');
  console.log('   1. Abrir https://wou-test.sanity.studio/');
  console.log('   2. Ir a ⚠️  "Requieren revisión" — todos los posts migrados aparecen ahí');
  console.log('   3. Por cada artículo: verificar título, imagen, categoría, excerpt');
  console.log('   4. Desactivar "Requiere revisión" cuando esté listo');
  console.log('   5. Usar el botón 🚀 "Publicar sitio" para rebuildar el frontend');
}

main().catch((err) => {
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  console.error('\n💥 Error fatal:', err.message);
  process.exit(1);
});
