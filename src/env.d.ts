/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SANITY_PROJECT_ID: string;
  readonly PUBLIC_SANITY_DATASET: string;
  readonly SANITY_API_READ_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ── Cloudflare Workers Runtime env ───────────────────────────────────────────
// Disponible solo en rutas on-demand (prerender: false) vía Astro.locals.runtime.env
interface CloudflareEnv {
  /** R2 bucket binding — escritura de media uploads */
  WOU_MEDIA: R2Bucket;
  /** Token secreto para autorizar uploads desde Sanity Studio */
  UPLOAD_SECRET: string;
  /** URL pública base del bucket, ej: https://media.wou.com.ar */
  R2_PUBLIC_BASE: string;
}
