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
 * Nota CORS: el adapter de Cloudflare no enruta `export const OPTIONS` a los
 * handlers de Astro (responde 405 sin CORS headers, bloqueando el preflight).
 * Se usa `export const ALL` para capturar OPTIONS y POST en el mismo handler.
 */
import type { APIRoute } from 'astro';

// Corre como Cloudflare Worker (on-demand). Sin esto, con output:'static'
// la ruta se prerenderiza como endpoint estático y devuelve 405 a
// OPTIONS/POST → el preflight CORS del Studio falla con "Failed to fetch".
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

export const ALL: APIRoute = async (context) => {
  const { request } = context;
  const origin  = request.headers.get('Origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  // ── OPTIONS: preflight CORS ────────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  // ── 1. Runtime env (solo disponible en Workers) ────────────────────────────
  const runtime = (context.locals as any).runtime as { env: CloudflareEnv } | undefined;
  const env = runtime?.env;

  if (!env) {
    return new Response(
      JSON.stringify({ error: 'Runtime env not available. Is this a Workers deployment?' }),
      { status: 500, headers },
    );
  }

  // ── 2. Autenticación ───────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!env.UPLOAD_SECRET || token !== env.UPLOAD_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  // ── 3. Extraer archivo del multipart ───────────────────────────────────────
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

  // ── 4. Validar tipo MIME ───────────────────────────────────────────────────
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response(
      JSON.stringify({ error: `Tipo de archivo no permitido: ${file.type}` }),
      { status: 415, headers },
    );
  }

  // ── 5. Subir a R2 ─────────────────────────────────────────────────────────
  const key    = buildKey(file.name);
  const buffer = await file.arrayBuffer();

  try {
    await env.WOU_MEDIA.put(key, buffer, {
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

  // ── 6. Retornar URL pública ────────────────────────────────────────────────
  const base = (env.R2_PUBLIC_BASE ?? 'https://media.wou.com.ar').replace(/\/$/, '');
  const url  = `${base}/${key}`;

  return new Response(JSON.stringify({ url }), { status: 200, headers });
};
