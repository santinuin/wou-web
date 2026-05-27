# CLAUDE.md — Portal de Noticias (wou.com.ar)

Source of truth para Claude Code. Leer antes de cualquier tarea.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Astro v6 · TypeScript strict · Tailwind CSS v4 |
| Runtime | Bun · Svelte (islands) · GSAP 3 · Matter.js 0.19 |
| CMS | **Sanity v3** (headless) — proyecto `xv9180xg`, dataset `production` |
| Media | **Cloudflare R2** — bucket `wou-media`, dominio público `pub-ffe6410d5a39482fb4ab2ebc3fdaecf2.r2.dev` (dev) |
| Deploy | Cloudflare Workers (`wou-dev`) vía GitHub Actions |
| Studio | Sanity Studio deployado en `https://wou-test.sanity.studio/` |

> **Nota migración:** `src/lib/cms/wordpress.ts` existe pero ya no se exporta desde `@/lib/cms` — es solo para los scripts de migración en `scripts/`. No usarlo en el código del frontend.

---

## Invariante central — fetch de artículos

**Dos modos de fetch, sin mezclar:**

| Ruta | Cuándo se ejecuta | Qué fetcha |
|------|-------------------|------------|
| Home y páginas estáticas | `astro build` (build-time) | `fetchRecentSanityPosts(50)` — 50 artículos recientes |
| Páginas de artículo | Runtime (Cloudflare Worker) | `fetchSanityPostBySlug(slug)` — cacheado 30 días en el edge |
| Páginas de categoría | `astro build` (prerender) | `fetchSanityPostsByCategory(slug, 0, 16)` — 16 por categoría |
| LoadMore (browser) | On-demand desde el browser | `GET /api/category-posts?category=X&offset=N&limit=12` |

---

## Arquitectura de datos

```
Sanity CMS (proyecto xv9180xg)
    https://xv9180xg.api.sanity.io/v2025-05-26/data/query/production
            │
            ▼
src/lib/cms/sanity-posts.ts   ← único contacto con Sanity para artículos
  fetchRecentSanityPosts(n)   ← build-time: N artículos recientes
  fetchSanityPostsByCategory  ← build-time + API endpoint: por categoría con offset
  fetchSanityPostBySlug(slug) ← runtime: artículo individual
            │
src/lib/cms/index.ts          ← re-exporta todo (punto de entrada público)
            │
      ┌─────┴──────────────────────────────┐
      ▼                                    ▼
src/content.config.ts          src/pages/articulo/[slug].astro
(loader build-time)            (prerender: false → on-demand Worker)
      │
      ▼
getCollection('articles')
      │
      ▼
secciones .astro (NewsGrid, CategoryHero, etc.)
```

**Endpoint de paginación (Worker):**
```
src/pages/api/category-posts.ts   GET → JSON NormalizedArticle[]
src/pages/api/upload-image.ts     POST → { url } — upload de imágenes a R2
```

---

## Reglas de datos (no negociables)

1. `src/lib/cms/sanity-posts.ts` es el **único** archivo que hace `fetch()` a la API de Sanity para artículos.
2. El loader de `articles` en `src/content.config.ts` es el único fetch point en build-time.
3. Las páginas y secciones `.astro` acceden a artículos via `getCollection('articles')` o las funciones de `@/lib/cms`.
4. Las páginas on-demand (`prerender: false`) usan `fetchSanityPostBySlug()` importado de `@/lib/cms`.
5. Ningún componente importa de `sanity-posts.ts` directamente — siempre via `@/lib/cms`.
6. `wordpress.ts` **NO** se importa desde el frontend — solo desde `scripts/` (migración).

---

## Cloudflare R2 — almacenamiento de media

**Por qué R2 y no Sanity assets:**
- Sanity Growth plan tiene límite de 25.000 documentos.
- Cada `sanity.imageAsset` consume 1 documento. Con 22.837 archivos históricos, se agotaría el límite.
- Solución: todas las imágenes se almacenan como URL string en R2, sin crear documentos Sanity.

**Bucket:** `wou-media`
- Dev URL: `https://pub-ffe6410d5a39482fb4ab2ebc3fdaecf2.r2.dev`
- Producción (futuro): `https://media.wou.com.ar` (custom domain a configurar)
- Path structure: `uploads/YYYY/MM/uuid-filename.ext`

**Upload desde Sanity Studio:**
- El redactor arrastra/selecciona una imagen en el campo → `R2UrlInput.tsx` (Studio) la sube al Worker
- Worker: `POST /api/upload-image` — valida `UPLOAD_SECRET`, escribe en R2, retorna URL
- El campo `url` del documento Sanity se rellena automáticamente

**Tipo custom `r2Image`:**
```typescript
// _type: 'r2Image' — bloque de Portable Text para imágenes inline
{
  _type: 'r2Image',
  url: string,      // https://media.wou.com.ar/uploads/...
  alt: string,      // requerido
  caption?: string,
  width?: number,
  height?: number,
}
```

**Gotcha crítico:** El input custom `R2UrlInput.tsx` vive en `studio/components/` (no en `src/schemas/`) para evitar contaminar el build de Astro con imports de React. Se inyecta en `studio/sanity.config.ts` via `patchUrlField()`.

---

## Schema Sanity — tipos principales

| Tipo | Descripción |
|------|-------------|
| `article` | Documento principal. `mainImage` es `{ url, alt }` (R2), no `sanity.imageAsset`. `tags` es `string[]`. |
| `r2Image` | Bloque custom de Portable Text para imágenes inline. Cero documentos extra. |
| `blockContent` | Portable Text — usa `r2Image` en lugar del `image` nativo de Sanity. |
| `category` | Categorías del portal. Tiene `wpId` para trazabilidad post-migración. |
| `author` | Autor. `avatar` es `{ url, alt }` (R2), no `sanity.imageAsset`. |
| `advertisement` | Publicidades — campo `placement` define zona del sitio. |
| `radioShow` | Programas de radio (lineup). |
| `radioStream` | Singleton — configuración del stream en vivo. |
| `program` | Videos / Programas TV (YouTube embed). |
| `redCircle` | Sección "Círculo Rojo". |
| `editorial` | Editoriales. |

**Registro de tipos en `src/schemas/index.ts`:**
`r2ImageType` debe registrarse **antes** que `blockContentType` (lo referencia como miembro).

---

## Shape normalizado de artículo

Todos los componentes consumen este shape (CMS-agnóstico):

```typescript
{
  id: string;
  data: {
    wpId?: number;                          // ID de WordPress (trazabilidad migración)
    title: string;
    slug: { current: string };
    publishedAt: string | null;
    modifiedAt: string | null;
    body: unknown[] | null;                 // Portable Text (solo en artículo individual)
    excerpt: string | null;
    mainImage: { url: string; alt: string | null; width?: number; height?: number } | null;
    categories: { _id: string; title: string; slug: { current: string } }[];
    tags: string[];                         // strings, NO referencias a documentos
    author: string | null;
    featured: boolean | null;
    highlightWord: string | null;
    needsReview: boolean | null;            // marcado por script de migración
    originalUrl: string | null;             // URL original de WordPress
  }
}
```

`getImageUrl()` en `src/lib/cms/image.ts` detecta el objeto `{ url, alt }` y devuelve `url` directamente, sin pasar por el image builder de Sanity.

---

## Renderizado de Portable Text

El cuerpo del artículo es Portable Text. Se renderiza con `astro-portabletext`:

```astro
import { PortableText } from 'astro-portabletext'
import R2ImageBlock from '@/components/content/R2ImageBlock.astro'

const portableTextComponents = {
  type: { r2Image: R2ImageBlock },
} as unknown as PortableTextComponents

<PortableText value={body as any} components={portableTextComponents} />
```

`R2ImageBlock.astro` renderiza el bloque `r2Image` con `<img src={url} alt={alt} />`.

---

## Deploy — Cloudflare Workers + GitHub Actions

**Flujo completo:**

```
git push → main  (o feature/cms-sanity-cloudflare en testing)
    ↓
GitHub Actions (.github/workflows/deploy.yml)
    ↓
bun install → bun run build → cd dist/server && npx wrangler deploy
    ↓
Cloudflare Worker "wou-dev" actualizado
    ↓
https://wou-dev.santiago-nunez-ingas.workers.dev/
```

**Trigger manual desde Sanity Studio:**
El botón "🚀 Publicar sitio" en `https://wou-test.sanity.studio/` hace `POST` a la GitHub API con `event_type: deploy-from-sanity` → dispara el mismo workflow.

**Secrets requeridos en GitHub Actions** (Settings → Secrets → Actions):

| Secret | Descripción |
|--------|-------------|
| `CF_API_TOKEN` | Cloudflare API Token con permiso "Edit Cloudflare Workers" |
| `CF_ACCOUNT_ID` | Account ID de Cloudflare (visible en el sidebar del dashboard) |
| `PUBLIC_SANITY_PROJECT_ID` | `xv9180xg` |
| `PUBLIC_SANITY_DATASET` | `production` |
| `SANITY_API_READ_TOKEN` | Token Viewer de Sanity (sanity.io/manage → API → Tokens) |

**Variables y secrets en Cloudflare Workers dashboard** (wou-dev → Settings):

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `UPLOAD_SECRET` | Secret (encrypted) | Token para autorizar uploads desde Studio |
| `R2_PUBLIC_BASE` | Secret (encrypted) | URL pública del bucket R2 |

**Bindings en Cloudflare Workers** (wou-dev → Bindings):

| Binding | Tipo | Valor |
|---------|------|-------|
| `WOU_MEDIA` | R2 Bucket | `wou-media` |
| `ASSETS` | Assets | — (generado por el adapter) |

**wrangler.toml:**
```toml
name = "wou-dev"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding     = "WOU_MEDIA"
bucket_name = "wou-media"
```

**Gotcha:** El adapter `@astrojs/cloudflare` inyecta automáticamente un binding `SESSION` (KV) en el `wrangler.json` generado. El script `scripts/patch-wrangler-output.cjs` lo elimina en el postbuild para evitar errores de deploy.

---

## Configuración de entorno

### `.env` (proyecto raíz — build-time de Astro)
```
PUBLIC_SANITY_PROJECT_ID=xv9180xg
PUBLIC_SANITY_DATASET=production
SANITY_API_READ_TOKEN=<token viewer de Sanity>
```

### `studio/.env` (Sanity Studio — NO commitear)
```
SANITY_STUDIO_PROJECT_ID=xv9180xg
SANITY_STUDIO_DATASET=production
SANITY_STUDIO_GITHUB_TOKEN=<PAT con scope "repo">
SANITY_STUDIO_GITHUB_OWNER=santinuin
SANITY_STUDIO_GITHUB_REPO=wou-web
SANITY_STUDIO_UPLOAD_URL=https://wou-dev.santiago-nunez-ingas.workers.dev/api/upload-image
SANITY_STUDIO_UPLOAD_SECRET=<mismo valor que UPLOAD_SECRET en Cloudflare>
```

### Variables de runtime (Cloudflare Workers — solo disponibles en rutas `prerender: false`)
Accesibles via `(context.locals as any).runtime.env`:
```typescript
interface CloudflareEnv {
  WOU_MEDIA: R2Bucket;       // binding R2
  UPLOAD_SECRET: string;
  R2_PUBLIC_BASE: string;
}
```

---

## astro.config.mjs — notas críticas

- `output: 'static'` con adapter `@astrojs/cloudflare` — genera Worker en `dist/server/`.
- `imageService: 'passthrough'` — las imágenes de R2 y WordPress se sirven directo; no se optimizan en build.
- `platformProxy: { enabled: false }` — evita que wrangler valide bindings en build local.
- `pub-ffe6410d5a39482fb4ab2ebc3fdaecf2.r2.dev` en `remotePatterns` — necesario para imágenes de R2 en dev.
- La integración `@sanity/astro` sigue presente para las colecciones auxiliares (autores, programas, etc.).

---

## Sanity Studio

**URL:** `https://wou-test.sanity.studio/`

**Deploy del Studio:**
```bash
cd studio && bun run deploy
```

**Estructura editorial en el Studio:**
- 📰 Artículos — todos los artículos, orden por fecha desc
- ⭐ Destacados — filtro `featured == true`
- ⚠️ Requieren revisión — filtro `needsReview == true` (posts migrados con HTML sucio)
- 📂 Categorías
- 👤 Autores
- 🔴 Círculo Rojo / ✍️ Editoriales / 📢 Publicidad
- 📻 Programas de radio / 🎙️ Stream (singleton) / ▶️ Videos

**Componentes custom del Studio** (en `studio/components/`):
- `R2UrlInput.tsx` — input drag-and-drop para campos `url` en imágenes. Sube a R2 automáticamente.

**Plugin deploy** (`studio/plugins/deploy.tsx`):
- Botón "🚀 Publicar sitio" → `POST https://api.github.com/repos/santinuin/wou-web/dispatches`
- Requiere `SANITY_STUDIO_GITHUB_TOKEN` con scope `repo`.

---

## Scripts de migración (WordPress → Sanity)

En `scripts/` — **no forman parte del build normal**.

| Script | Propósito |
|--------|-----------|
| `migrate-media-to-r2.ts` | Descarga media de WordPress → sube a R2 → genera `media-url-map.json` |
| `migrate-posts-to-sanity.ts` | Convierte posts WP (Elementor/WPBakery) a Portable Text → crea documentos en Sanity |

**Dependencias de los scripts** (instalar antes de correr):
```bash
bun add -d @aws-sdk/client-s3 @sanity/block-tools @sanity/schema jsdom
```

Los scripts son **resumibles** — guardan progreso en archivos JSON y saltan items ya procesados.

---

## Tailwind CSS v4
- Configuración CSS-first en `src/styles/global.css`
- Design tokens en bloque `@theme {}`
- Sin archivo `tailwind.config.js`

## Bun
Usar `bun` para todo: `bun add`, `bun run`, `bunx`.
**Nunca** usar `npm`, `npx`, `yarn` ni `pnpm`.
> Excepción: `npx wrangler deploy` en el paso de deploy (wrangler no está instalado globalmente).

## Scripts disponibles
| Comando               | Propósito                                         |
|-----------------------|---------------------------------------------------|
| `bun run dev`         | Servidor de desarrollo Astro                      |
| `bun run build`       | Build de producción (Astro + Cloudflare adapter)  |
| `bun run preview`     | Preview del build con Wrangler local              |
| `bun run check`       | TypeScript check de archivos .astro               |
| `bun run audit`       | Auditoría A11y + console errors con Playwright    |
| `bun run audit:report`| Ídem con reporte HTML                             |
| `cd studio && bun run dev` | Studio de Sanity en localhost:3333           |
| `cd studio && bun run deploy` | Deploy del Studio a sanity.studio         |

---

## Estructura del código

```
src/
├── layouts/          shells de página (BaseLayout, ArticleLayout futuro...)
├── pages/
│   ├── index.astro                    prerender: true (home estático)
│   ├── articulo/[slug].astro          prerender: false (on-demand + edge cache)
│   ├── categoria/[categoria].astro    prerender: true (12 categorías × 16 artículos)
│   └── api/
│       ├── category-posts.ts          GET — paginación de categorías (LoadMore)
│       └── upload-image.ts            POST — upload de imágenes a R2
├── sections/         composiciones grandes, específicas de una página
│   ├── home/         Hero, TransitionSection, NewsGrid, RedCircle, etc.
│   ├── category/     CategoryHero, CategoryGrid, CategoryNav, bandPattern
│   └── article/      ArticleCard (renderiza Portable Text)
├── components/       piezas reutilizables entre páginas
│   ├── layout/       .astro — Header, Footer
│   ├── content/      .astro — ArticleCard, R2ImageBlock, LiveCard, etc.
│   └── ui/           .svelte para interactivos / .astro para estáticos atómicos
│                     LoadMore.svelte — paginación infinita de categorías
├── lib/              lógica pura, sin markup
│   └── cms/
│       ├── sanity-posts.ts  ← API client Sanity (fuente de verdad de artículos)
│       ├── wordpress.ts     ← SOLO para scripts de migración, NO exportado
│       ├── client.ts        ← sanityClient (colecciones auxiliares)
│       ├── queries.ts       ← queries GROQ (artículos + colecciones auxiliares)
│       ├── image.ts         ← getImageUrl() — soporta { url, alt } de R2
│       └── index.ts         ← re-exporta todo (punto de entrada público)
├── schemas/          schemas Sanity
│   ├── index.ts             registro de tipos (r2ImageType primero)
│   ├── r2Image.ts           bloque custom Portable Text para imágenes R2
│   ├── article.ts           documento principal
│   ├── blockContent.ts      Portable Text (usa r2Image, no image nativo)
│   └── ...otros tipos
├── styles/           global.css (Tailwind v4 @theme)
└── content.config.ts loaders de Content Collections

studio/
├── sanity.config.ts         config + estructura editorial + inyección R2UrlInput
├── plugins/deploy.tsx        botón "Publicar sitio" → GitHub Actions dispatch
├── components/
│   └── R2UrlInput.tsx        input drag-and-drop para uploads a R2
└── .env                     variables del Studio (NO commitear)

scripts/
├── migrate-media-to-r2.ts   migración de media WP → R2
└── migrate-posts-to-sanity.ts migración de posts WP → Sanity

.github/workflows/
└── deploy.yml               CI/CD — build + deploy a Cloudflare Workers
```

---

## Islands architecture — Svelte

Los componentes `.astro` son estáticos por defecto (cero JS al browser).
Usar Svelte **únicamente** cuando un componente requiere interactividad real en el cliente.

**Criterio para crear una island:**
- ¿Necesita estado reactivo?
- ¿Responde a eventos del usuario más allá de un link o form nativo?
- ¿Actualiza el DOM después de carga?
→ Si alguna respuesta es sí: isla Svelte. Si no: componente .astro estático.

**Directivas de hidratación — elegir la mínima necesaria:**
| Directiva        | Cuándo hidratar                  | Caso de uso típico              |
|------------------|----------------------------------|---------------------------------|
| `client:load`    | Inmediatamente al cargar         | Navegación, search visible      |
| `client:idle`    | Cuando el browser está libre     | Widgets no críticos             |
| `client:visible` | Al entrar al viewport            | Componentes below the fold      |
| `client:media`   | Al cumplirse una media query     | Menú mobile                     |

**Gotcha — React en el proyecto:**
React NO está instalado en el proyecto principal (solo Svelte). Los archivos `.tsx` son exclusivos del Studio (`studio/`). Nunca importar componentes React desde `src/`.

---

## Animaciones — GSAP 3

**GSAP (`gsap`)** es la herramienta estándar para animaciones complejas del sitio.

**Regla de oro — jerarquía de animación:**
1. **Transiciones CSS / Tailwind** → efectos simples de 1-2 propiedades.
2. **Keyframes CSS** → animaciones cíclicas sin estado (ticker, pulses).
3. **GSAP** → secuencias, timelines encadenados, ScrollTrigger, física.

**Dónde vive GSAP:** Solo dentro de islas Svelte (`client:*`). Nunca en componentes `.astro`.
- Los plugins se registran una sola vez: `gsap.registerPlugin(ScrollTrigger)`.
- `gsap.context()` / `ctx.revert()` en `onDestroy` para evitar memory leaks.

---

## Físicas interactivas — Matter.js

**`matter-js` 0.19** para simulación de física 2D (ball-pool, draggables con gravedad).

**Regla: Matter.js NO usa canvas.** Los cuerpos sincronizan posición al DOM vía `transform`.

**Dónde vive Matter.js:** Solo dentro de islas Svelte (`client:visible` por defecto).
- `Runner.stop()` + `Engine.clear()` + `World.clear()` en `onDestroy`.
- `touch-action: pan-y` en el contenedor para no bloquear scroll en touch.
