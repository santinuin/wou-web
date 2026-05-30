/**
 * article — documento principal del CMS.
 *
 * Migrado de WordPress headless → Sanity + Cloudflare R2.
 *
 * Invariantes de costo (no negociables):
 *   - `mainImage` es un objeto { url, alt } con URL de R2, NO un sanity.imageAsset.
 *   - `tags` es string[], NO referencias a documentos separados.
 *   - El cuerpo usa `blockContent` que solo admite `r2Image` (sin sanity.imageAsset).
 *   → Resultado: 0 documentos extra por imágenes. Límite de 25.000 preservado.
 */
import { defineField, defineType } from 'sanity';

export const articleType = defineType({
  name: 'article',
  title: 'Artículo',
  type: 'document',

  fields: [
    // ── Identificación WordPress (trazabilidad post-migración) ────────────
    defineField({
      name: 'wpId',
      title: 'WordPress ID',
      type: 'number',
      description: 'ID original en WordPress. Solo lectura — no editar.',
      readOnly: true,
    }),

    // ── Núcleo editorial ──────────────────────────────────────────────────
    defineField({
      name: 'title',
      title: 'Título',
      type: 'string',
      validation: (Rule) => Rule.required().min(5).max(200),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
      description: '⚠️ Cambiar el slug rompe URLs indexadas en Google.',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Fecha de publicación',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'modifiedAt',
      title: 'Última modificación',
      type: 'datetime',
    }),

    // ── Imagen principal — URL de R2, nunca sanity.imageAsset ─────────────
    defineField({
      name: 'mainImage',
      title: 'Imagen principal',
      type: 'object',
      fields: [
        {
          name: 'url',
          type: 'url',
          title: 'Imagen principal',
          description: 'Arrastrá una imagen (el Studio la sube automáticamente a R2) o pegá la URL.',
          validation: (Rule) => Rule.required().uri({ scheme: ['https'] }),
          // El input custom R2UrlInput se inyecta en studio/sanity.config.ts
        },
        {
          name: 'alt',
          type: 'string',
          title: 'Texto alternativo',
          description: 'Requerido para accesibilidad y SEO.',
          validation: (Rule) => Rule.required(),
        },
        { name: 'width', type: 'number', title: 'Ancho (px)' },
        { name: 'height', type: 'number', title: 'Alto (px)' },
      ],
    }),

    // ── Cuerpo del artículo (Portable Text con r2Image) ───────────────────
    defineField({
      name: 'body',
      title: 'Cuerpo',
      type: 'blockContent',
      description: 'Para insertar imágenes: usar el bloque "Imagen (R2)" con la URL de media.wou.com.ar.',
    }),

    // ── Taxonomías ─────────────────────────────────────────────────────────
    defineField({
      name: 'categories',
      title: 'Categorías',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
    }),
    // Tags como strings — NO documentos separados (evita consumir cupo de documentos)
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),
    defineField({
      name: 'author',
      title: 'Autor',
      type: 'reference',
      to: [{ type: 'author' }],
    }),

    // ── Metadatos editoriales ─────────────────────────────────────────────
    defineField({
      name: 'excerpt',
      title: 'Bajada / Resumen',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: 'featured',
      title: '¿Destacado en portada?',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'highlightWord',
      title: 'Palabra destacada',
      type: 'string',
      description: 'Una palabra del título que se mostrará más grande en la tarjeta hero.',
      validation: (Rule) => Rule.max(40),
    }),

    // ── SEO ───────────────────────────────────────────────────────────────
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'object',
      fields: [
        { name: 'title', type: 'string', title: 'Meta título (si difiere del título)' },
        { name: 'description', type: 'text', title: 'Meta descripción', validation: (Rule) => Rule.max(160) },
        { name: 'canonicalUrl', type: 'url', title: 'URL canónica' },
        { name: 'noIndex', type: 'boolean', title: 'Excluir de buscadores', initialValue: false },
      ],
    }),

    // ── Trazabilidad de migración ─────────────────────────────────────────
    defineField({
      name: 'originalUrl',
      title: 'URL original (WordPress)',
      type: 'url',
      readOnly: true,
      description: 'URL de referencia post-migración.',
    }),
    defineField({
      name: 'needsReview',
      title: '⚠️ Requiere revisión editorial',
      type: 'boolean',
      initialValue: false,
      description: 'Marcado por el script de migración cuando el HTML no pudo parsearse limpiamente.',
    }),
  ],

  preview: {
    select: {
      title: 'title',
      publishedAt: 'publishedAt',
      imageUrl: 'mainImage.url',
      featured: 'featured',
    },
    prepare({ title, publishedAt, featured }) {
      const date = publishedAt ? new Date(publishedAt).toLocaleDateString('es-AR') : '(sin fecha)';
      return {
        title: `${featured ? '⭐ ' : ''}${title ?? '(sin título)'}`,
        subtitle: date,
      };
    },
  },

  orderings: [
    {
      title: 'Publicación (más nueva primero)',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
    {
      title: 'Modificación (más reciente)',
      name: 'modifiedAtDesc',
      by: [{ field: 'modifiedAt', direction: 'desc' }],
    },
  ],
});
