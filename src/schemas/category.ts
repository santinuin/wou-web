/**
 * category — sección/categoría editorial.
 *
 * Migrado de WordPress headless → Sanity.
 * Se agregó wpId para trazabilidad y parent para jerarquías opcionales.
 */
import { defineField, defineType } from 'sanity';

export const categoryType = defineType({
  name: 'category',
  title: 'Categoría',
  type: 'document',

  fields: [
    // ── Trazabilidad WordPress ────────────────────────────────────────────
    defineField({
      name: 'wpId',
      title: 'WordPress ID',
      type: 'number',
      readOnly: true,
    }),

    // ── Núcleo ────────────────────────────────────────────────────────────
    defineField({
      name: 'title',
      title: 'Nombre',
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
    defineField({
      name: 'description',
      title: 'Descripción',
      type: 'text',
      rows: 3,
    }),

    // ── Jerarquía (opcional) ──────────────────────────────────────────────
    defineField({
      name: 'parent',
      title: 'Categoría padre',
      type: 'reference',
      to: [{ type: 'category' }],
      description: 'Para subcategorías. Dejar vacío para categorías de primer nivel.',
    }),

    // ── UI ────────────────────────────────────────────────────────────────
    defineField({
      name: 'color',
      title: 'Color de acento',
      type: 'string',
      description: 'Hex color para badges (ej: #3b82f6)',
    }),
    defineField({
      name: 'order',
      title: 'Orden en el menú',
      type: 'number',
      description: 'Número menor = aparece primero.',
    }),
  ],

  preview: {
    select: { title: 'title', order: 'order' },
    prepare({ title, order }) {
      return {
        title: title ?? '(sin nombre)',
        subtitle: order != null ? `Posición ${order}` : undefined,
      };
    },
  },

  orderings: [
    {
      title: 'Orden en el menú',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
});
