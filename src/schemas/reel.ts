import { defineField, defineType } from 'sanity';

export const reelType = defineType({
  name: 'reel',
  title: 'Reel',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Título',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'youtubeUrl',
      title: 'URL de YouTube Shorts',
      type: 'url',
      description: 'Ej: https://www.youtube.com/shorts/abcd1234567',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Fecha',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'order',
      title: 'Orden',
      type: 'number',
      description: 'Posición en la grilla (1 = primero a la izquierda).',
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    select: { title: 'title', order: 'order' },
    prepare({ title, order }) {
      return {
        title: title ?? '(sin título)',
        subtitle: order != null ? `Posición ${order}` : 'Reel',
      };
    },
  },

  orderings: [
    {
      title: 'Orden manual',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
});
