import { defineField, defineType } from 'sanity';

export const radioShowType = defineType({
  name: 'radioShow',
  title: 'Programa de radio',
  type: 'document',

  fields: [
    defineField({
      name: 'name',
      title: 'Nombre del programa',
      type: 'string',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'days',
      title: 'Días',
      type: 'string',
      description: 'Ej: Lunes a viernes',
    }),
    defineField({
      name: 'time',
      title: 'Horario',
      type: 'string',
      description: 'Ej: 18hs',
    }),
    defineField({
      name: 'order',
      title: 'Orden',
      type: 'number',
      initialValue: 0,
      description: 'Posición en la grilla (menor = aparece primero)',
    }),
  ],

  orderings: [
    {
      title: 'Orden manual',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],

  preview: {
    select: { title: 'name', subtitle: 'days' },
    prepare({ title, subtitle }) {
      return {
        title: title ?? '(sin nombre)',
        subtitle: subtitle ?? 'Programa de radio',
      };
    },
  },
});
