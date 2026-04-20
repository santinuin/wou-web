# CLAUDE.md — Portal de Noticias

Source of truth para Claude Code. Leer antes de cualquier tarea.

## Stack
Astro v6 (output: 'static') · Bun · Sanity v3 · Tailwind CSS v4 · TypeScript strict · GSAP 3 (animaciones)

## Invariante central
**Build-time-only data fetching.**
Sanity se consulta SOLO durante `astro build` / `astro dev`.
Cero llamadas a la API en runtime. Esto garantiza 100% autonomía del CDN.

## Arquitectura de datos

    Sanity CMS
        │
        ▼
    src/lib/cms/            ← capa adaptadora (único contacto con Sanity)
      client.ts             ← sanityClient
      queries.ts            ← todas las queries GROQ
      image.ts              ← urlForImage / getImageUrl
      index.ts              ← re-exporta todo
        │
        ▼
    src/content.config.ts   ← loaders (fetch en build-time)
        │
        ▼
    getCollection() / getEntry() de 'astro:content'
        │
        ▼
    páginas .astro          ← nunca importan @sanity/client directamente

## Reglas de datos (no negociables)
1. Todas las queries GROQ viven en `src/lib/cms/queries.ts` — nunca inline.
2. Los loaders de Content Collections en `src/content.config.ts` son el único fetch point.
3. Las páginas `.astro` usan solo `getCollection()` / `getEntry()` de `astro:content`.
4. `sanityClient` no se importa en páginas `.astro` bajo ningún concepto.
5. No usar `asset->` en GROQ para imágenes — rompe el schema Zod y es innecesario.
6. Los componentes importan de `@/lib/cms`, nunca de `@sanity/client` directamente.

## Gotchas críticos Sanity + Zod
- Sanity retorna `null` (no `undefined`) para campos opcionales vacíos.
- `z.optional()` falla con `null`. Usar `.nullish()` en todos los campos escalares opcionales.
- Objetos complejos (imágenes, rich text): `z.any()` en el schema de la Collection.
- Solo el núcleo invariante (`title`, `slug`, `publishedAt`, `body`) tiene tipado estricto.

## Desacoplamiento del CMS
Para cambiar de CMS: reemplazar `src/lib/cms/`.
Páginas, layouts y componentes no requieren modificación.
Fuga de abstracción conocida: `blockContent` usa PortableText, formato propio de Sanity.

## Schemas Sanity
- Ubicación: `src/schemas/` (importados por `sanity.config.ts`)
- Tipos: `article`, `author`, `category`, `blockContent`
- Nombres de campo en inglés; labels del Studio en español
- El formato editorial (news/opinion/analysis...) es el campo `format`, no un tipo separado
- Campos marcados `[EXP]` son experimentales y pueden cambiar sin consenso
- Tras modificar schemas: `bun run typegen`

## Evolución de schemas (fase exploratoria)
Los campos `[EXP]` pueden cambiar libremente porque:
- Los campos escalares opcionales usan `.nullish()` en content.config.ts
- Los objetos complejos usan `z.any()`
- Solo el núcleo invariante tiene tipos estrictos

Proceso para evolucionar un campo:
1. Modificar `src/schemas/<tipo>.ts`
2. `bun run typegen` para regenerar tipos
3. Agregar el campo a la query en `src/lib/cms/queries.ts`
4. Si el campo es complejo: mantenerlo `z.any()` hasta que la estructura esté estable

Para explorar datos en vivo: `bun run studio` → pestaña "Vision" (GROQ playground).

## Configuración de entorno
| Variable                  | Contexto            | Propósito                          |
|---------------------------|---------------------|------------------------------------|
| PUBLIC_SANITY_PROJECT_ID  | import.meta.env     | Project ID (expuesto al browser)   |
| PUBLIC_SANITY_DATASET     | import.meta.env     | Dataset (expuesto al browser)      |
| SANITY_API_READ_TOKEN     | import.meta.env     | Token de lectura (solo build)      |
| SANITY_STUDIO_*           | import.meta.env     | Expuestas por `bun run studio`     |
| PUBLIC_* en CLI           | process.env         | sanity.cli.ts — contexto Node.js   |

## astro.config.mjs — notas críticas
- Interop guard para `@sanity/astro` es obligatorio (ambigüedad CJS/ESM).
- `studioBasePath` omitido intencionalmente — su presencia rompe `output: 'static'`.
- Studio local: `bun run studio` → http://localhost:3333

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
| `bun run build`       | Build estático de producción                    |
| `bun run preview`     | Preview del build                               |
| `bun run studio`      | Sanity Studio local (http://localhost:3333)     |
| `bun run typegen`     | Generar tipos TypeScript desde schemas Sanity   |
| `bun run check`       | TypeScript check de archivos .astro             |
| `bun run audit`       | Auditoría A11y + console errors con Playwright  |
| `bun run audit:report`| Ídem con reporte HTML                           |

## Estructura de componentes
  src/components/
  ├── layout/    ← .astro — Header, Footer, estructura global
  ├── ui/        ← .svelte para interactivos / .astro para estáticos
  └── content/   ← .astro — ArticleCard, AuthorCard, etc.

## Deploy (Netlify)
- Build: `bun run build` · Publish: `dist`
- SECRETS_SCAN_OMIT_KEYS configurado para PUBLIC_* (son intencionalmente públicas)
- Cache: `/_astro/*` → `max-age=31536000, immutable`

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

**Uso en páginas .astro:**
```astro
---
import SearchBar from '@/components/ui/SearchBar.svelte';
---

<!-- client:visible → solo hidrata cuando el usuario llega a este punto -->
<SearchBar client:visible placeholder="Buscar artículos..." />
```

Ejemplos de componentes que SÍ deben ser islands Svelte:
- SearchBar.svelte — búsqueda con filtrado en tiempo real
- MobileMenu.svelte — drawer de navegación con estado open/close
- NewsletterForm.svelte — formulario con validación y feedback
- ArticleReactions.svelte — likes/reacciones con estado optimista
- BreakingNewsTicker.svelte — ticker con scroll automático

Ejemplos de componentes que NO deben ser islands:
- ArticleCard.astro — tarjeta de artículo (solo presenta datos)
- Header.astro — header estático (el menú mobile sería una island dentro)
- CategoryBadge.astro — badge de categoría (HTML puro)

## Animaciones — GSAP 3

**GSAP (`gsap`)** es la herramienta estándar para animaciones complejas del sitio.
Decisión de arquitectura: GSAP se elige por su performance, control de timelines
y compatibilidad con ScrollTrigger para efectos sincronizados al scroll.

**Regla de oro — jerarquía de animación:**
1. **Transiciones CSS / Tailwind** → efectos simples de 1-2 propiedades
   (hover, focus, reveals lineales). No traer GSAP para esto.
2. **Keyframes CSS** → animaciones cíclicas sin estado (ticker, pulses).
3. **GSAP** → secuencias, timelines encadenados, ScrollTrigger, física
   (stagger, easing avanzado, morph), o cuando CSS se vuelve inmanejable.

**Dónde vive GSAP:**
- Solo dentro de islas Svelte (`client:*`). Nunca en componentes `.astro`.
- Importar desde el componente que lo consume, no globalmente:
  ```svelte
  <script>
    import { gsap } from 'gsap';
    import { onMount } from 'svelte';
    onMount(() => {
      gsap.from('.hero-title', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' });
    });
  </script>
  ```
- Los plugins (`ScrollTrigger`, `Flip`, etc.) se importan por separado y se
  registran una sola vez: `gsap.registerPlugin(ScrollTrigger)`.

**Performance:**
- Preferir `client:visible` para islas con animaciones below-the-fold — GSAP
  no se descarga ni ejecuta hasta que el usuario llega al componente.
- `gsap.context()` / `ctx.revert()` en `onDestroy` para evitar memory leaks
  en componentes que se montan/desmontan.
