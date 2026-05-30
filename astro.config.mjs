import { defineConfig } from 'astro/config';
import _sanityPkg from '@sanity/astro';
const sanity = /** @type {Function} */ (_sanityPkg.default ?? _sanityPkg);
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import { loadEnv } from 'vite';

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? 'production',
  process.cwd(),
  ''
);

export default defineConfig({
  // En Astro v6, output: 'static' ya soporta rutas on-demand via prerender: false.
  // El adapter de Cloudflare maneja las rutas con prerender: false como Workers.
  output: 'static',
  adapter: cloudflare({
    imageService: 'passthrough',
    // platformProxy desactivado: evita que wrangler valide ASSETS en build local.
    // En Cloudflare Pages el binding ASSETS es automático.
    platformProxy: { enabled: false },
  }),

  // CSRF origin-check de Astro desactivado: protege auth basada en cookies
  // de POSTs cross-origin, pero bloquea el upload legítimo del Sanity Studio
  // (multipart/form-data desde sanity.studio → Worker). El endpoint /api/upload-image
  // se autentica por Bearer token (no cookies), así que el check no aporta
  // seguridad; las demás rutas on-demand son GET de solo lectura.
  security: { checkOrigin: false },

  integrations: [
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID || 'unconfigured',
      dataset: PUBLIC_SANITY_DATASET || 'production',
      useCdn: false,
      apiVersion: '2024-01-01',
      perspective: 'published',
    }),
    svelte(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  image: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'wou.com.ar' },
    ],
  },
});
