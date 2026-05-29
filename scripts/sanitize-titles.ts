/**
 * Sanitiza los títulos de todos los artículos en Sanity:
 *   - Convierte de TODO EN MAYÚSCULAS a Sentence case
 *   - Preserva acrónimos conocidos (WOU, ANSES, AFIP, etc.)
 *   - Solo parchea documentos cuyo título realmente cambia
 *
 * Prerequisitos:
 *   SANITY_API_WRITE_TOKEN en .env  (rol Editor o Administrator)
 *   sanity.io/manage → API → Tokens → Add API token
 *
 * Ejecutar:
 *   bun run scripts/sanitize-titles.ts
 *
 * Es reanudable: si se interrumpe, volver a ejecutar — saltea los ya procesados.
 * Genera: sanitize-titles-log.json  { done: [], failed: [], skipped: [] }
 */

import { createClient } from '@sanity/client';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// ─── Config ───────────────────────────────────────────────────────────────────

const sanity = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID ?? 'xv9180xg',
  dataset: process.env.PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2025-05-26',
  token: process.env.SANITY_API_WRITE_TOKEN!,
  useCdn: false,
});

const LOG_FILE = 'sanitize-titles-log.json';

// Acrónimos y siglas que deben permanecer en mayúsculas.
// Agregar acá los que sean relevantes para el portal.
const ACRONYMS = new Set([
  'WOU',
  'ANSES', 'AFIP', 'ARCA', 'PAMI', 'IOMA', 'CONICET',
  'PJ', 'PRO', 'UCR', 'FDT', 'JxC', 'LLA', 'UOM', 'ATE', 'UPCN', 'CTA',
  'INDEC', 'BCRA', 'FMI', 'BCE',
  'TV', 'AM', 'FM', 'HCD', 'GBA',
  'COVID', 'OMS', 'OPS',
  'km', 'km²',
]);

// ─── Sentence case ────────────────────────────────────────────────────────────

/**
 * Convierte un string a sentence case preservando acrónimos.
 * Estrategia:
 *  1. Pasa todo a minúsculas.
 *  2. Capitaliza el primer carácter real del string.
 *  3. Para cada token, si matchea un acrónimo conocido → lo restaura en mayúsculas.
 */
function toSentenceCase(title: string): string {
  if (!title) return title;

  // Paso 1: minúsculas
  let result = title.toLowerCase();

  // Paso 2: capitalizar primer carácter real (saltea espacios/comillas iniciales)
  result = result.replace(/^([\s"'¿¡]*)([a-záéíóúüñ])/u, (_, prefix, first) =>
    prefix + first.toUpperCase()
  );

  // Paso 3: restaurar acrónimos — busca tokens completos (word boundary)
  for (const acronym of ACRONYMS) {
    const pattern = new RegExp(`(?<![a-záéíóúüñ])${acronym.toLowerCase()}(?![a-záéíóúüñ])`, 'gi');
    result = result.replace(pattern, acronym);
  }

  return result;
}

// ─── Log de progreso ──────────────────────────────────────────────────────────

type Log = { done: string[]; failed: string[]; skipped: string[] };

function loadLog(): Log {
  if (!existsSync(LOG_FILE)) return { done: [], failed: [], skipped: [] };
  return JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
}

function saveLog(log: Log) {
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    console.error('❌  Falta SANITY_API_WRITE_TOKEN en .env');
    console.error('   Crear en sanity.io/manage → API → Tokens → rol Editor');
    process.exit(1);
  }

  console.log('📥 Fetching articles from Sanity...');

  const articles = await sanity.fetch<{ _id: string; title: string }[]>(
    `*[_type == "article" && defined(title)] { _id, title }`
  );

  console.log(`   ${articles.length} artículos encontrados.\n`);

  const log = loadLog();
  const processed = new Set([...log.done, ...log.failed, ...log.skipped]);

  let changed = 0;
  let skipped = 0;
  let failed = 0;

  for (const article of articles) {
    if (processed.has(article._id)) {
      console.log(`⏭  [ya procesado] ${article._id}`);
      continue;
    }

    const newTitle = toSentenceCase(article.title);

    if (newTitle === article.title) {
      console.log(`✓  [sin cambio]   ${article.title}`);
      log.skipped.push(article._id);
      skipped++;
      saveLog(log);
      continue;
    }

    try {
      await sanity.patch(article._id).set({ title: newTitle }).commit();
      console.log(`✅  ${article.title}`);
      console.log(`  → ${newTitle}`);
      log.done.push(article._id);
      changed++;
    } catch (err) {
      console.error(`❌  Error en ${article._id}: ${err}`);
      log.failed.push(article._id);
      failed++;
    }

    saveLog(log);

    // Pequeña pausa para no saturar la API de Sanity
    await Bun.sleep(80);
  }

  console.log('\n─────────────────────────────────');
  console.log(`✅  Actualizados: ${changed}`);
  console.log(`⏭  Sin cambio:   ${skipped}`);
  console.log(`❌  Fallidos:     ${failed}`);
  console.log(`📄  Log: ${LOG_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
