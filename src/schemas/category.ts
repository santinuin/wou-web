import { defineField, defineType } from 'sanity';

export const categoryType = defineType({
  name: 'category',
  title: 'Categoría',
  type: 'document',

  // ── Núcleo invariante ────────────────────────────────────────────────────
  fields: [
    defineField({
      name: 'title',
      title: 'Título',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),

    // ── Experimental ─────────────────────────────────────────────────────
    // [EXP] ¿Descripción en texto plano o rich text?
    defineField({
      name: 'description',
      title: 'Descripción [EXP]',
      type: 'text',
      rows: 3,
    }),
    // [EXP] ¿Color hex, variable CSS o referencia a un tema de diseño?
    defineField({
      name: 'color',
      title: 'Color de acento [EXP]',
      type: 'string',
      description: 'Hex color para badges (ej: #3b82f6)',
    }),
  ],

  preview: {
    select: { title: 'title' },
  },
});
