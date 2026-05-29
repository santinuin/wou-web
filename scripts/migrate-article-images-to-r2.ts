/**
 * Migra las imágenes de los artículos de WordPress → Cloudflare R2
 * y actualiza los documentos en Sanity.
 *
 * Qué migra:
 *   - mainImage.url  (imagen principal del artículo)
 *   - body[].url     (bloques r2Image dentro del Portable Text)
 *
 * Prerequisitos:
 *   bun add -d @aws-sdk/client-s3
 *   Variables en .env:
 *     CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE
 *     PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, SANITY_API_WRITE_TOKEN
 *
 * Ejecutar:
 *   bun run scripts/migrate-article-images-to-r2.ts
 *
 * Es reanudable: guarda progreso en article-images-migration-log.json
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@sanity/client';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// ─── Config ───────────────────────────────────────────────────────────────────

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const R2_BUCKET     = process.env.R2_BUCKET ?? 'wou-media';
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE!;
const WP_HOST       = 'https://wou.com.ar';

const sanity = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID ?? 'xv9180xg',
  dataset:   process.env.PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2025-05-26',
  token: process.env.SANITY_API_WRITE_TOKEN!,
  useCdn: false,
});

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const LOG_FILE = 'article-images-migration-log.json';

type Log = { done: string[]; failed: string[]; skipped: string[] };

function loadLog(): Log {
  if (!existsSync(LOG_FILE)) return { done: [], failed: [], skipped: [] };
  return JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
}
function saveLog(log: Log) {
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('wou.com.ar/wp-content/') || url.includes('wou.com.ar/wp-');
}

function wpUrlToR2Key(wpUrl: string): string {
  // https://wou.com.ar/wp-content/uploads/2024/01/foto.jpg
  //   → uploads/2024/01/foto.jpg
  try {
    const u = new URL(wpUrl);
    return u.pathname.replace(/^\/wp-content\//, '');
  } catch {
    return `uploads/misc/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  }
}

async function keyExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadToR2(wpUrl: string): Promise<string> {
  const key = wpUrlToR2Key(wpUrl);

  if (await keyExists(key)) {
    return `${R2_PUBLIC_BASE}/${key}`;
  }

  const res = await fetch(wpUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${wpUrl}`);

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${R2_PUBLIC_BASE}/${key}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    console.error('❌  Falta SANITY_API_WRITE_TOKEN en .env'); process.exit(1);
  }
  if (!CF_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    console.error('❌  Faltan credenciales R2 en .env'); process.exit(1);
  }

  console.log('📥  Fetching articles from Sanity...');

  type RawArticle = {
    _id: string;
    mainImage?: { url?: string; alt?: string | null; width?: number; height?: number };
    body?: Array<{ _key: string; _type: string; url?: string; alt?: string; [k: string]: unknown }>;
  };

  const articles = await sanity.fetch<RawArticle[]>(
    `*[_type == "article"] { _id, mainImage, body }`
  );

  const wpArticles = articles.filter(a =>
    isWpUrl(a.mainImage?.url) ||
    (a.body ?? []).some(b => b._type === 'r2Image' && isWpUrl(b.url))
  );

  console.log(`   ${articles.length} artículos totales, ${wpArticles.length} con imágenes de WordPress.\n`);

  const log = loadLog();
  const processed = new Set([...log.done, ...log.failed, ...log.skipped]);

  let migrated = 0, failed = 0, skipped = 0;

  for (const article of wpArticles) {
    if (processed.has(article._id)) {
      console.log(`⏭  [ya procesado] ${article._id}`);
      continue;
    }

    const patch: Record<string, unknown> = {};
    let hasChanges = false;

    // ── mainImage ─────────────────────────────────────────────────────────────
    if (isWpUrl(article.mainImage?.url)) {
      try {
        const newUrl = await uploadToR2(article.mainImage!.url!);
        patch['mainImage.url'] = newUrl;
        hasChanges = true;
        console.log(`  🖼  mainImage: ${article.mainImage!.url!.split('/').pop()}`);
        console.log(`       → ${newUrl}`);
      } catch (e) {
        console.error(`  ❌  mainImage falló en ${article._id}: ${e}`);
      }
    }

    // ── body r2Image blocks ───────────────────────────────────────────────────
    const body = article.body ?? [];
    for (const block of body) {
      if (block._type !== 'r2Image' || !isWpUrl(block.url)) continue;
      try {
        const newUrl = await uploadToR2(block.url!);
        // Patch a nivel de array item usando la _key del bloque
        patch[`body[_key=="${block._key}"].url`] = newUrl;
        hasChanges = true;
        console.log(`  🖼  body[${block._key}]: ${block.url!.split('/').pop()}`);
        console.log(`       → ${newUrl}`);
      } catch (e) {
        console.error(`  ❌  body block ${block._key} falló: ${e}`);
      }
    }

    if (!hasChanges) {
      log.skipped.push(article._id);
      skipped++;
      saveLog(log);
      continue;
    }

    try {
      let p = sanity.patch(article._id);
      for (const [path, value] of Object.entries(patch)) {
        p = p.set({ [path]: value });
      }
      await p.commit();

      console.log(`✅  ${article._id}\n`);
      log.done.push(article._id);
      migrated++;
    } catch (e) {
      console.error(`❌  Error al parchear ${article._id}: ${e}\n`);
      log.failed.push(article._id);
      failed++;
    }

    saveLog(log);
    await Bun.sleep(100);
  }

  console.log('\n──────────────────────────────────');
  console.log(`✅  Migrados:  ${migrated}`);
  console.log(`⏭  Sin cambio: ${skipped}`);
  console.log(`❌  Fallidos:  ${failed}`);
  console.log(`📄  Log: ${LOG_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
