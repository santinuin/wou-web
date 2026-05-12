import { defineField, defineType } from 'sanity';

export const articleType = defineType({
  name: 'article',
  title: 'Artículo',
  type: 'document',

  // ── Núcleo invariante ────────────────────────────────────────────────────
  fields: [
    defineField({
      name: 'title',
      title: 'Título',
      type: 'string',
      validation: (Rule) => Rule.required().min(10).max(160),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Fecha de publicación',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'body',
      title: 'Cuerpo',
      type: 'blockContent',
    }),

    // ── Experimental — confirmar con equipo editorial ─────────────────────
    // [EXP] ¿Tipos suficientes? ¿Se agrega 'podcast', 'video', 'live'?
    defineField({
      name: 'format',
      title: 'Formato editorial [EXP]',
      type: 'string',
      options: {
        list: [
          { title: 'Noticia', value: 'news' },
          { title: 'Opinión', value: 'opinion' },
          { title: 'Análisis', value: 'analysis' },
          { title: 'Reportaje', value: 'feature' },
          { title: 'Entrevista', value: 'interview' },
        ],
        layout: 'radio',
      },
    }),
    // [EXP] ¿Autor único o múltiples autores (array de references)?
    defineField({
      name: 'author',
      title: 'Autor [EXP]',
      type: 'reference',
      to: { type: 'author' },
    }),
    // [EXP] ¿Una imagen principal o galería de portada?
    defineField({
      name: 'mainImage',
      title: 'Imagen principal [EXP]',
      type: 'image',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Texto alternativo',
          description: 'Requerido para accesibilidad y SEO.',
          validation: (Rule) => Rule.required(),
        },
        { name: 'caption', type: 'string', title: 'Epígrafe' },
      ],
    }),
    // [EXP] ¿Categorías planas o árbol jerárquico (sección > subsección)?
    defineField({
      name: 'categories',
      title: 'Categorías [EXP]',
      type: 'array',
      of: [{ type: 'reference', to: { type: 'category' } }],
    }),
    // [EXP] ¿Flag booleano o sistema de curaduría por posición (drag & drop)?
    defineField({
      name: 'featured',
      title: '¿Destacado? [EXP]',
      type: 'boolean',
      initialValue: false,
    }),
    // [EXP] ¿SEO gestionado aquí o via plugin sanity-plugin-seo?
    defineField({
      name: 'excerpt',
      title: 'Resumen / Meta descripción [EXP]',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(200),
    }),
    // [EXP] Palabra del título que se destaca visualmente en la portada (más grande)
    defineField({
      name: 'highlightWord',
      title: 'Palabra destacada [EXP]',
      type: 'string',
      description: 'Una palabra del título que se mostrará más grande en la tarjeta hero.',
      validation: (Rule) => Rule.max(40),
    }),
  ],

  preview: {
    select: {
      title: 'title',
      format: 'format',
      media: 'mainImage',
    },
    prepare({ title, format, media }) {
      const labels: Record<string, string> = {
        news: 'Noticia',
        opinion: 'Opinión',
        analysis: 'Análisis',
        feature: 'Reportaje',
        interview: 'Entrevista',
      };
      return {
        title: title ?? '(sin título)',
        subtitle: format ? labels[format] : '[EXP — sin formato asignado]',
        media,
      };
    },
  },

  orderings: [
    {
      title: 'Fecha de publicación (más nueva primero)',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
  ],
});
