import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schema } from '../src/schemas';
import { deployPlugin } from './plugins/deploy';
import { R2UrlInput } from './components/R2UrlInput';

/**
 * sanity.config.ts — Studio configuration.
 *
 * R2UrlInput se inyecta aquí (en el Studio) y no en src/schemas/
 * para evitar contaminar el build de Astro con imports de React.
 *
 * Inyección: se clona el tipo `r2Image` y `article.mainImage.url`
 * añadiendo `components: { input: R2UrlInput }` al campo `url`.
 */

// ── Parchear el schema con el input custom ────────────────────────────────────
//
// Sanity permite registrar tipos modificados. Clonamos los tipos que necesitan
// el input custom y reemplazamos el campo `url` en cada uno.
//
function patchUrlField(types: typeof schema.types) {
  return types.map((type) => {
    // r2Image: parchear el campo `url` con R2UrlInput
    if (type.name === 'r2Image') {
      return {
        ...type,
        fields: (type as any).fields?.map((f: any) =>
          f.name === 'url'
            ? { ...f, components: { input: R2UrlInput } }
            : f
        ),
      };
    }

    // article: parchear mainImage.url con R2UrlInput
    if (type.name === 'article') {
      return {
        ...type,
        fields: (type as any).fields?.map((f: any) => {
          if (f.name === 'mainImage' && f.fields) {
            return {
              ...f,
              fields: f.fields.map((mf: any) =>
                mf.name === 'url'
                  ? { ...mf, components: { input: R2UrlInput } }
                  : mf
              ),
            };
          }
          return f;
        }),
      };
    }

    return type;
  });
}

const patchedSchema = {
  types: patchUrlField(schema.types),
};

export default defineConfig({
  projectId: import.meta.env.SANITY_STUDIO_PROJECT_ID,
  dataset:   import.meta.env.SANITY_STUDIO_DATASET ?? 'production',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Portal de Noticias')
          .items([

            // ── Sección principal ────────────────────────────────────────
            S.listItem()
              .title('📰 Artículos')
              .schemaType('article')
              .child(
                S.documentTypeList('article')
                  .title('Artículos')
                  .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])
                  .filter('_type == "article"')
              ),

            // Vista dinámica por categoría
            S.listItem()
              .title('📂 Por categoría')
              .child(
                S.documentTypeList('category')
                  .title('Categorías')
                  .defaultOrdering([{ field: 'order', direction: 'asc' }, { field: 'title', direction: 'asc' }])
                  .child((categoryId) =>
                    S.documentList()
                      .title('Artículos')
                      .schemaType('article')
                      .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])
                      .filter('_type == "article" && $categoryId in categories[]._ref')
                      .params({ categoryId })
                  )
              ),

            S.listItem()
              .title('⭐ Destacados')
              .schemaType('article')
              .child(
                S.documentTypeList('article')
                  .title('Artículos destacados')
                  .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])
                  .filter('_type == "article" && featured == true')
              ),

            // needsReview: posts migrados que necesitan revisión editorial
            S.listItem()
              .title('⚠️ Requieren revisión')
              .schemaType('article')
              .child(
                S.documentTypeList('article')
                  .title('Para revisar')
                  .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])
                  .filter('_type == "article" && needsReview == true')
              ),

            S.divider(),

            // ── Taxonomías ───────────────────────────────────────────────
            S.listItem()
              .title('📂 Categorías')
              .schemaType('category')
              .child(
                S.documentTypeList('category')
                  .title('Categorías')
                  .defaultOrdering([{ field: 'order', direction: 'asc' }])
              ),

            S.listItem()
              .title('👤 Autores')
              .schemaType('author')
              .child(
                S.documentTypeList('author')
                  .title('Autores')
                  .defaultOrdering([{ field: 'name', direction: 'asc' }])
              ),

            S.divider(),

            // ── Secciones del portal ─────────────────────────────────────
            S.listItem()
              .title('✍️ Editoriales')
              .schemaType('editorial')
              .child(S.documentTypeList('editorial').title('Editoriales')),

            S.listItem()
              .title('📢 Publicidad')
              .schemaType('advertisement')
              .child(S.documentTypeList('advertisement').title('Publicidades')),

            S.divider(),

            // ── Radio ────────────────────────────────────────────────────
            S.listItem()
              .title('📻 Programas de radio')
              .schemaType('radioShow')
              .child(S.documentTypeList('radioShow').title('Programas')),

            S.listItem()
              .title('🎙️ Stream de radio')
              .id('radioStreamSingleton')
              .child(
                S.document()
                  .schemaType('radioStream')
                  .documentId('radioStream')
                  .title('Configuración del stream')
              ),

            S.listItem()
              .title('▶️ Videos / Programas TV')
              .schemaType('program')
              .child(S.documentTypeList('program').title('Videos')),
          ]),
    }),

    // Vision: playground GROQ en el Studio — imprescindible para verificar queries
    visionTool({ defaultApiVersion: '2025-05-26' }),

    // Deploy: botón "Publicar sitio" → dispara rebuild en Cloudflare Pages
    deployPlugin(),
  ],

  schema: patchedSchema,
});
