import { defineField, defineType } from 'sanity';

/**
 * Red Circle — tarjeta interactiva que alimenta la sección "RedCircle"
 * del home. Física con Matter.js: círculos rojos con texto blanco caen
 * y se arrastran con el mouse. Al hacer hover sobre cada bola se revela
 * una imagen editorial asociada.
 *
 * Campos mínimos y directos — no comparte estructura con `article` porque
 * el copy visible en la bola suele ser más corto y editorial (ej: "NO ES
 * UN SECRETO") que un titular de noticia.
 */
export const redCircleType = defineType({
  name: 'redCircle',
  title: 'Círculo Rojo',
  type: 'document',

  fields: [
    defineField({
      name: 'label',
      title: 'Texto en la bola',
      type: 'string',
      description: 'Texto corto que se muestra dentro del círculo. Ej: "NO ES UN SECRETO".',
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'label', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'href',
      title: 'Enlace destino [EXP]',
      type: 'string',
      description: 'URL a la que se dirige la bola. Si queda vacío, usa /circulo-rojo/<slug>.',
    }),
    defineField({
      name: 'image',
      title: 'Imagen (hover)',
      type: 'image',
      description: 'Imagen que aparece al hacer hover sobre la bola.',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Texto alternativo',
          validation: (Rule) => Rule.required(),
        },
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Orden [EXP]',
      type: 'number',
      description: 'Posición relativa dentro de la sección (menor = aparece primero).',
      initialValue: 0,
    }),
    defineField({
      name: 'publishedAt',
      title: 'Publicado el',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
  ],

  preview: {
    select: { title: 'label', media: 'image' },
    prepare({ title, media }) {
      return { title: title ?? '(sin texto)', subtitle: 'Círculo Rojo', media };
    },
  },

  orderings: [
    {
      title: 'Orden manual',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
    {
      title: 'Más reciente',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
  ],
});
