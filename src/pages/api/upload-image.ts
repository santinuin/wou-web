/**
 * /api/upload-image
 *
 * Recibe un archivo de imagen desde Sanity Studio (R2UrlInput) y lo escribe
 * en el bucket R2.
 *
 * Auth: header  Authorization: Bearer <UPLOAD_SECRET>
 * Body: multipart/form-data con campo "file" (File)
 *
 * Response 200: { url: "https://media.wou.com.ar/uploads/YYYY/MM/uuid.ext" }
 * Response 401: { error: "Unauthorized" }
 * Response 400: { error: "No file provided" }
 * Response 500: { error: "Upload failed: ..." }
 *
 * Notas Astro v6 / Cloudflare:
 *  · `prerender = false` → la ruta corre como Worker on-demand (sin esto se
 *    prerenderiza estática y devuelve 405).
 *  · El binding R2 y los secrets se leen via `import { env } from 'cloudflare:workers'`.
 *    `Astro.locals.runtime.env` fue REMOVIDO en Astro v6.
 *  · CORS: se usa `export const ALL` (no `OPTIONS`+`POST` separados) porque el
 *    adapter no enruta `export const OPTIONS` al handler de Astro.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const ALLOWED_ORIGINS = [
  'https://wou.sanity.studio',
  'https://wou-test.sanity.studio',
  'http://localhost:3333',
];

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function buildKey(filename: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safe = filename
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-_]/g, '');
  const uuid = crypto.randomUUID().slice(0, 8);
  return `uploads/${yyyy}/${mm}/${uuid}-${safe}`;
}

export const ALL: APIRoute = async ({ request }) => {
  const origin  = request.headers.get('Origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  // ── OPTIONS: preflight CORS ────────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  // env (binding R2 + secrets) — Astro v6: desde 'cloudflare:workers'
  const cfEnv = env as unknown as CloudflareEnv;

  // ── 1. Autenticación ───────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!cfEnv.UPLOAD_SECRET || token !== cfEnv.UPLOAD_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  // ── 2. Extraer archivo del multipart ───────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid multipart body' }), { status: 400, headers });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'No file provided (expected field "file")' }), { status: 400, headers });
  }

  // ── 3. Validar tipo MIME ───────────────────────────────────────────────────
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response(
      JSON.stringify({ error: `Tipo de archivo no permitido: ${file.type}` }),
      { status: 415, headers },
    );
  }

  // ── 4. Subir a R2 ─────────────────────────────────────────────────────────
  const key    = buildKey(file.name);
  const buffer = await file.arrayBuffer();

  try {
    await cfEnv.WOU_MEDIA.put(key, buffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Upload failed: ${err?.message ?? String(err)}` }),
      { status: 500, headers },
    );
  }

  // ── 5. Retornar URL pública ────────────────────────────────────────────────
  const base = (cfEnv.R2_PUBLIC_BASE ?? 'https://media.wou.com.ar').replace(/\/$/, '');
  const url  = `${base}/${key}`;

  return new Response(JSON.stringify({ url }), { status: 200, headers });
};
