import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schema } from '../src/schemas';
import { deployPlugin } from './plugins/deploy';

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
              .title('🔴 Círculo Rojo')
              .schemaType('redCircle')
              .child(S.documentTypeList('redCircle').title('Círculo Rojo')),

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

  schema,
});
