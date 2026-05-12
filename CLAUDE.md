# CLAUDE.md — Portal de Noticias

Source of truth para Claude Code. Leer antes de cualquier tarea.

## Stack
Astro v6 (output: 'static') · Bun · WordPress REST API (headless) · Tailwind CSS v4 · TypeScript strict · GSAP 3 (animaciones) · Matter.js 0.19 (físicas DOM)

## Invariante central
**Dos modos de fetch, sin mezclar:**

| Ruta | Cuándo se ejecuta | Qué fetcha |
|------|-------------------|------------|
| Home y páginas estáticas | `astro build` | `fetchRecentWpPosts(50)` — 1 request, 50 artículos recientes |
| Páginas de artículo | Runtime (Cloudflare Worker) | `fetchWpPostBySlug(slug)` — 1 request, cacheada 30 días en el edge |

`fetchAllWpPosts()` existe pero está reservado para sitemaps y migraciones. **Nunca usarlo en el build normal** — tarda ~5 min (188 requests a donWeb).

## Arquitectura de datos

    WordPress REST API (donWeb)
        https://wou.com.ar/wp-json/wp/v2
                │
                ▼
    src/lib/cms/wordpress.ts     ← único contacto con la API de WordPress
      fetchRecentWpPosts(n)      ← build-time: N artículos recientes (1 request)
      fetchWpPostBySlug(slug)    ← runtime: artículo individual por slug
      fetchAllWpPosts()          ← migraciones/sitemaps únicamente
      extractElementorContent()  ← extrae texto del HTML de Elementor
                │
                ▼
    src/lib/cms/index.ts         ← re-exporta todo (punto de entrada público)
                │
          ┌─────┴──────────────────┐
          ▼                        ▼
    src/content.config.ts    src/pages/articles/[slug].astro
    (loader build-time)      (prerender: false → on-demand)
          │
          ▼
    getCollection('articles')
          │
          ▼
    secciones .astro (NewsGrid, etc.)

## Reglas de datos (no negociables)
1. `src/lib/cms/wordpress.ts` es el único archivo que hace `fetch()` a la API de WordPress.
2. El loader de `articles` en `src/content.config.ts` es el único fetch point en build-time.
3. Las páginas y secciones `.astro` acceden a artículos via `getCollection('articles')`.
4. Las páginas on-demand (`prerender: false`) usan `fetchWpPostBySlug()` importado de `@/lib/cms`.
5. Ningún componente importa de `wordpress.ts` directamente — siempre via `@/lib/cms`.
6. `fetchAllWpPosts()` no se llama durante el build normal.

## Gotchas críticos WordPress + Astro
- **`per_page` máximo con `_embed`**: donWeb cierra la conexión con valores > 50. Nunca superar 50.
- **Sin header `Accept: application/json`**: donWeb/Apache devuelve body vacío cuando está presente. Omitirlo siempre.
- **`source_url` puede no existir**: algunos media son videos o embeds sin URL de imagen. Verificar `post._embedded?.['wp:featuredmedia']?.[0]?.source_url` específicamente, no solo el objeto.
- **Elementor**: el contenido real está dentro de `div.elementor-text-editor`. `extractElementorContent()` usa un contador de profundidad (no regex) para manejar divs anidados. Posts sin Elementor se devuelven tal cual.
- **Zod y campos opcionales**: WordPress devuelve `null` (no `undefined`) para campos vacíos. Usar `.nullish()` en todos los escalares opcionales del schema.

## Shape normalizado de artículo
Los componentes existentes esperan este shape (compatible con el anterior de Sanity):

```typescript
{
  id: string;                        // String(post.id)
  data: {
    wpId: number;
    title: string;
    slug: { current: string };       // normalizado — antes era Sanity slug
    publishedAt: string | null;
    modifiedAt: string | null;
    content: string | null;          // HTML procesado por extractElementorContent()
    excerpt: string | null;          // texto plano (sin tags HTML)
    mainImage: { url: string; alt: string | null } | null;
    categories: { _id: string; title: string; slug: { current: string } }[];
    tags: any;
    author: string | null;
    originalUrl: string;
  }
}
```

`getImageUrl()` en `src/lib/cms/image.ts` detecta el objeto `{ url, alt }` y devuelve `url` directamente, sin pasar por el builder de Sanity.

## Desacoplamiento del CMS
Para cambiar de CMS: reemplazar `src/lib/cms/wordpress.ts` y el loader en `src/content.config.ts`.
Páginas, layouts y componentes no requieren modificación — consumen el shape normalizado.

## Configuración de entorno
| Variable                 | Contexto        | Propósito                                        |
|--------------------------|-----------------|--------------------------------------------------|
| PUBLIC_SANITY_PROJECT_ID | import.meta.env | Aún presente — colecciones auxiliares (Sanity)   |
| PUBLIC_SANITY_DATASET    | import.meta.env | Aún presente — colecciones auxiliares (Sanity)   |
| SANITY_API_READ_TOKEN    | import.meta.env | Aún presente — colecciones auxiliares (Sanity)   |

La API de WordPress (`wou.com.ar/wp-json/wp/v2`) es pública — no requiere token.

## astro.config.mjs — notas críticas
- `output: 'static'` con adapter `@astrojs/cloudflare@12.x` (v13 tiene bug con ASSETS binding en Pages).
- `imageService: 'passthrough'` — las imágenes de WordPress se sirven directamente desde donWeb/Cloudflare CDN; no se optimizan en build.
- `platformProxy: { enabled: false }` — evita que wrangler valide el binding ASSETS en build local. En Cloudflare Pages el binding es automático.
- `wou.com.ar` en `remotePatterns` — necesario para que Astro permita imágenes del dominio WordPress.
- La integración `@sanity/astro` sigue presente para las colecciones auxiliares (autores, programas, etc.).

## Deploy — Cloudflare Pages + Workers
- **Build**: `bun run build` · **Publish dir**: `dist/client`
- El adapter genera un Cloudflare Worker en `dist/server/` para las rutas `prerender: false`.
- Las rutas on-demand (artículos) responden con `Cache-Control: s-maxage=2592000` (30 días en el edge).
- Variables de entorno: configurar en el dashboard de Cloudflare Pages (no en `wrangler.toml`).
- `wrangler.toml` solo contiene metadatos de nombre y fecha de compatibilidad.

## Actualización de contenido — Deploy Hook manual (pendiente de implementar)

La home es estática: muestra el contenido del momento del último build. Las páginas de artículo (`prerender: false`) siempre están frescas vía WordPress REST API.

**Estrategia elegida: webhook manual desde WordPress**
- Cloudflare Pages provee una **Deploy Hook URL** (se genera en el dashboard, Settings → Builds → Deploy Hooks).
- Un `POST` a esa URL dispara un nuevo build (~10 seg) sin parámetros adicionales.
- El editor tendrá un botón "Publicar en el sitio" en WordPress que hace ese POST.
- Implementación sugerida: snippet en `functions.php` del tema, o plugin liviano. No requiere cambios en el código de Astro.

**Por qué no auto-webhook por cada publicación:**
- El plan gratuito de Cloudflare Pages tiene 500 builds/mes.
- El editor controla cuándo se rebuilda → evita builds innecesarios por borradores o ediciones intermedias.

**Pendiente:** configurar la Deploy Hook URL en Cloudflare Pages y el botón en WordPress.

## Tailwind CSS v4
- Configuración CSS-first en `src/styles/global.css`
- Design tokens en bloque `@theme {}`
- Sin archivo `tailwind.config.js`

## Bun
Usar `bun` para todo: `bun add`, `bun run`, `bunx`.
Nunca usar `npm`, `npx`, `yarn` ni `pnpm`.

## Scripts
| Comando               | Propósito                                       |
|-----------------------|-------------------------------------------------|
| `bun run dev`         | Servidor de desarrollo Astro                    |
| `bun run build`       | Build estático de producción (~10 seg)          |
| `bun run preview`     | Preview del build con Wrangler                  |
| `bun run check`       | TypeScript check de archivos .astro             |
| `bun run audit`       | Auditoría A11y + console errors con Playwright  |
| `bun run audit:report`| Ídem con reporte HTML                           |

## Estructura del código

```
src/
├── layouts/          shells de página (BaseLayout, ArticleLayout futuro...)
├── pages/            rutas Astro
│   ├── index.astro                  prerender: true (home estático)
│   └── articles/[slug].astro        prerender: false (on-demand + edge cache)
├── sections/         composiciones grandes, específicas de una página
│   └── home/         Hero, TransitionSection, NewsGrid, etc.
├── components/       piezas reutilizables entre páginas
│   ├── layout/       .astro — Header, Footer, estructura global
│   ├── content/      .astro — cards y bloques (ArticleCard, LiveCard, etc.)
│   └── ui/           .svelte para interactivos / .astro para estáticos atómicos
├── lib/              lógica pura, sin markup
│   └── cms/
│       ├── wordpress.ts  ← API client WordPress (fuente de verdad de artículos)
│       ├── client.ts     ← sanityClient (colecciones auxiliares)
│       ├── queries.ts    ← queries GROQ para colecciones Sanity
│       ├── image.ts      ← getImageUrl() — soporta WP {url,alt} y Sanity refs
│       └── index.ts      ← re-exporta todo
├── schemas/          schemas Sanity (colecciones auxiliares)
├── styles/           global.css (Tailwind v4 @theme)
└── content.config.ts loaders de Content Collections
```

Los tres niveles de composición, diferenciados:

| Carpeta        | Qué vive ahí                                        | Criterio                                |
|----------------|-----------------------------------------------------|-----------------------------------------|
| `layouts/`     | Shells de página (header + main + footer, slots)    | Lo usa más de una página                |
| `sections/`    | Composiciones grandes (full-viewport o bloques)     | Vive en UNA sola página                 |
| `components/`  | Piezas reutilizables (cards, embeds, badges, UI)    | Se importa desde más de una página/sección |

**Direcciones de import válidas:**
- `pages/*` → `layouts/`, `sections/*`, `components/*`, `lib/*`
- `sections/<page>/*` → `components/*`, `lib/*`
- `components/*` → `components/*` (entre sí), `lib/*`
- Nunca: `components/` importa de `sections/`, ni `lib/` de componentes.

## Islands architecture — Svelte

Los componentes `.astro` son estáticos por defecto (cero JS al browser).
Usar Svelte **únicamente** cuando un componente requiere interactividad real en el cliente.

**Criterio para crear una island:**
- ¿Necesita estado reactivo? (barra de búsqueda, filtros, menú mobile)
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

Ejemplos de componentes que SÍ deben ser islands Svelte:
- SearchBar.svelte — búsqueda con filtrado en tiempo real
- MobileMenu.svelte — drawer de navegación con estado open/close
- NewsletterForm.svelte — formulario con validación y feedback
- BreakingNewsTicker.svelte — ticker con scroll automático

Ejemplos de componentes que NO deben ser islands:
- ArticleCard.astro — tarjeta de artículo (solo presenta datos)
- Header.astro — header estático (el menú mobile sería una island dentro)
- CategoryBadge.astro — badge de categoría (HTML puro)

## Animaciones — GSAP 3

**GSAP (`gsap`)** es la herramienta estándar para animaciones complejas del sitio.

**Regla de oro — jerarquía de animación:**
1. **Transiciones CSS / Tailwind** → efectos simples de 1-2 propiedades (hover, focus, reveals lineales).
2. **Keyframes CSS** → animaciones cíclicas sin estado (ticker, pulses).
3. **GSAP** → secuencias, timelines encadenados, ScrollTrigger, física (stagger, easing avanzado, morph).

**Dónde vive GSAP:**
- Solo dentro de islas Svelte (`client:*`). Nunca en componentes `.astro`.
- Importar desde el componente que lo consume, no globalmente.
- Los plugins (`ScrollTrigger`, `Flip`, etc.) se registran una sola vez: `gsap.registerPlugin(ScrollTrigger)`.
- `gsap.context()` / `ctx.revert()` en `onDestroy` para evitar memory leaks.

## Físicas interactivas — Matter.js

**`matter-js` 0.19** para simulación de física 2D (ball-pool, draggables con gravedad).

**Regla: Matter.js NO usa canvas.** Los cuerpos sincronizan `body.position` y `body.angle`
al DOM cada frame vía `transform: translate(x,y) rotate(rad)` sobre elementos HTML.

**Dónde vive Matter.js:**
- Solo dentro de islas Svelte (`client:*`). Nunca en componentes `.astro`.
- `client:visible` por defecto — no se descarga hasta que el usuario llega a la sección.
- `Runner.stop()` + `Engine.clear()` + `World.clear()` en `onDestroy` para evitar memory leaks.

**Performance:**
- `Mouse.create(container)` — el receptor de eventos debe ser el contenedor DOM del área física.
- En touch, `touch-action: pan-y` deja pasar scroll vertical cuando no hay drag activo.
