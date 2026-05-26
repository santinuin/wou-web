/**
 * FASE 2: Migración de media WordPress → Cloudflare R2
 *
 * Pre-requisitos:
 *   bun add -d @aws-sdk/client-s3
 *   Variables de entorno en .env.migration (NO commitear):
 *     CF_ACCOUNT_ID=
 *     R2_ACCESS_KEY_ID=
 *     R2_SECRET_ACCESS_KEY=
 *     R2_BUCKET=wou-media
 *     R2_PUBLIC_BASE=https://media.wou.com.ar
 *
 * Ejecutar:
 *   bun run scripts/migrate-media-to-r2.ts
 *
 * Genera:
 *   media-url-map.json      { wpUrl → r2Url } (guardar en lugar seguro)
 *   migration-media-log.json  { done: [], failed: [] }
 *
 * Es reanudable: si se interrumpe, volver a ejecutar y continúa donde quedó.
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// ─── Configuración ────────────────────────────────────────────────────────────

const WP_BASE = 'https://wou.com.ar/wp-json/wp/v2';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const R2_BUCKET = process.env.R2_BUCKET ?? 'wou-media';
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE ?? 'https://media.wou.com.ar';
const R2_ENDPOINT = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const LOG_FILE = 'migration-media-log.json';
const MAP_FILE = 'media-url-map.json';

// ─── Estado persistente (reanudable) ─────────────────────────────────────────

const log: { done: number[]; failed: { id: number; url?: string; reason: string }[] } =
  existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE, 'utf8')) : { done: [], failed: [] };

const urlMap: Record<string, string> =
  existsSync(MAP_FILE) ? JSON.parse(readFileSync(MAP_FILE, 'utf8')) : {};

const doneSet = new Set(log.done);

// ─── Cliente R2 ───────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function keyExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

function wpUrlToR2Key(wpUrl: string): string {
  // https://wou.com.ar/wp-content/uploads/2024/01/foto.jpg
  //   → uploads/2024/01/foto.jpg
  const urlObj = new URL(wpUrl);
  return urlObj.pathname.replace(/^\/wp-content\//, '');
}

async function uploadToR2(
  wpUrl: string,
  contentType: string,
): Promise<string> {
  const key = wpUrlToR2Key(wpUrl);
  const r2Url = `${R2_PUBLIC_BASE}/${key}`;

  // No re-subir si ya está en el mapa o existe en R2
  if (urlMap[wpUrl]) return urlMap[wpUrl];
  if (await keyExists(key)) {
    urlMap[wpUrl] = r2Url;
    return r2Url;
  }

  const res = await fetch(wpUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  urlMap[wpUrl] = r2Url;
  return r2Url;
}

// ─── Fetch paginado de media WordPress ───────────────────────────────────────

async function fetchAllMedia(): Promise<any[]> {
  const items: any[] = [];
  let page = 1;

  while (true) {
    console.log(`  → Fetching media página ${page}…`);
    const res = await fetch(`${WP_BASE}/media?per_page=100&page=${page}`);

    if (res.status === 400) break; // WP devuelve 400 cuando no hay más páginas
    if (!res.ok) {
      console.error(`  ✗ HTTP ${res.status} en página ${page}`);
      break;
    }

    const data: any[] = await res.json();
    if (!data.length) break;

    items.push(...data);
    page++;
    await new Promise((r) => setTimeout(r, 150)); // Rate limiting suave
  }

  return items;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!CF_ACCOUNT_ID) {
    console.error('❌ CF_ACCOUNT_ID no está definido. Revisar .env.migration');
    process.exit(1);
  }

  console.log('🚀 Migración de media WordPress → Cloudflare R2\n');
  console.log(`   Bucket: ${R2_BUCKET}`);
  console.log(`   URL pública: ${R2_PUBLIC_BASE}\n`);

  console.log('📦 Fetching catálogo de media de WordPress…');
  const mediaItems = await fetchAllMedia();
  console.log(`   Total: ${mediaItems.length} items\n`);

  const pending = mediaItems.filter((item) => !doneSet.has(item.id));
  console.log(`   Ya migrados: ${doneSet.size} | Pendientes: ${pending.length}\n`);

  const BATCH_SIZE = 4; // Paralelo controlado para no saturar WP ni R2
  let processed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (item) => {
        const wpUrl = item.source_url;
        if (!wpUrl) {
          log.failed.push({ id: item.id, reason: 'sin source_url (video embed u otro tipo)' });
          doneSet.add(item.id); // No reintentar
          return;
        }

        try {
          const contentType: string = item.mime_type ?? 'application/octet-stream';

          // Subir imagen principal
          await uploadToR2(wpUrl, contentType);

          // Subir también las resoluciones adicionales (thumbnails de WP)
          if (item.media_details?.sizes) {
            for (const sizeData of Object.values(item.media_details.sizes) as any[]) {
              if (sizeData?.source_url && sizeData.source_url !== wpUrl) {
                try {
                  await uploadToR2(sizeData.source_url, contentType);
                } catch {
                  // Los thumbnails son opcionales — no bloquear por ellos
                }
              }
            }
          }

          log.done.push(item.id);
          doneSet.add(item.id);
          processed++;

          if (processed % 100 === 0) {
            console.log(`⏳ ${processed} archivos subidos…`);
          }
        } catch (err: any) {
          console.error(`✗ [${item.id}] ${wpUrl?.split('/').pop()} — ${err.message}`);
          log.failed.push({ id: item.id, url: wpUrl, reason: err.message });
        }
      }),
    );

    // Guardar progreso cada batch
    writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    writeFileSync(MAP_FILE, JSON.stringify(urlMap, null, 2));

    await new Promise((r) => setTimeout(r, 50));
  }

  // Guardar estado final
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  writeFileSync(MAP_FILE, JSON.stringify(urlMap, null, 2));

  const totalMapped = Object.keys(urlMap).length;
  console.log(`\n✅ Completado:`);
  console.log(`   Subidos en esta ejecución: ${processed}`);
  console.log(`   Total en URL map: ${totalMapped}`);
  console.log(`   Errores: ${log.failed.length}`);
  console.log(`\n📄 Archivos generados:`);
  console.log(`   ${MAP_FILE}   ← guardar en lugar seguro`);
  console.log(`   ${LOG_FILE}`);

  if (log.failed.length > 0) {
    console.log(`\n⚠️  ${log.failed.length} archivos fallaron. Revisar ${LOG_FILE} → array "failed".`);
  }
}

main().catch((err) => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
