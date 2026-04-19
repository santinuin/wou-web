import { defineField, defineType } from 'sanity';

export const editorialType = defineType({
  name: 'editorial',
  title: 'Editorial Semanal',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Título destacado',
      type: 'string',
      description: 'Ej: "SUELDOS DE POBREZA". Se renderiza en tipografía gigante.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'question',
      title: 'Pregunta / Bajada',
      type: 'text',
      rows: 3,
      description: 'La pregunta editorial que encabeza el bloque.',
      validation: (Rule) => Rule.required().max(300),
    }),
    defineField({
      name: 'image',
      title: 'Imagen destacada',
      type: 'image',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Texto alternativo',
          validation: (Rule) => Rule.required(),
        },
      ],
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
      title: 'Publicado el',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
  ],

  preview: {
    select: { title: 'title', media: 'image' },
    prepare({ title, media }) {
      return { title: title ?? '(sin título)', subtitle: 'Editorial Semanal', media };
    },
  },

  orderings: [
    {
      title: 'Más reciente',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
  ],
});
