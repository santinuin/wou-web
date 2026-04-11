import { defineConfig } from 'astro/config';
// @sanity/astro distribuye CJS y ESM. El runner SSR de Vite puede resolver el CJS
// haciendo que el default import sea { default: fn } en lugar de fn directamente.
// El guard asegura que siempre sea la factory function correcta.
import _sanityPkg from '@sanity/astro';
const sanity = /** @type {Function} */ (_sanityPkg.default ?? _sanityPkg);
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

// loadEnv inyecta las variables antes de que Vite las procese,
// necesario para que la integración de Sanity las reciba en builds estáticos.
const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? 'production',
  process.cwd(),
  ''
);

export default defineConfig({
  output: 'static',

  integrations: [
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID || 'unconfigured',
      dataset: PUBLIC_SANITY_DATASET || 'production',
      useCdn: false,
      apiVersion: '2024-01-01',
      perspective: 'published',
      // studioBasePath está OMITIDO intencionalmente.
      // Si se incluye, @sanity/astro inyecta una ruta con prerender: false,
      // lo que fuerza modo hybrid/server y rompe output: 'static'.
      // El Studio se accede via: bun run studio → http://localhost:3333
    }),
    svelte(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  image: {
    // Permite que <Image> de Astro descargue y optimice imágenes remotas de Sanity
    // en build-time. El HTML final referencia /_astro/... — nunca cdn.sanity.io.
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.sanity.io' }],
  },
});
