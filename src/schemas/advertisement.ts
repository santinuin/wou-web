import { defineField, defineType } from 'sanity';

export const advertisementType = defineType({
  name: 'advertisement',
  title: 'Anuncio',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Título del anuncio',
      type: 'string',
      description: 'Ej: "No hay fiesta sin Zoco"',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'brand',
      title: 'Marca',
      type: 'string',
      description: 'Ej: "ZOCO" — aparece como subtítulo en el preview del Studio.',
    }),
    defineField({
      name: 'image',
      title: 'Imagen',
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
      name: 'url',
      title: 'URL de destino',
      type: 'url',
      description: 'A dónde lleva el click del anuncio.',
    }),
    defineField({
      name: 'placement',
      title: 'Ubicación en la página',
      type: 'string',
      options: {
        list: [
          { title: 'Banda superior  —  1 grande (izq) + 2 chicas (der)', value: 'ads1' },
          { title: 'Banda inferior  —  4 iguales en fila', value: 'ads2' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'active',
      title: '¿Activo?',
      type: 'boolean',
      initialValue: true,
      description: 'Desactivar para pausar el anuncio sin eliminarlo.',
    }),
    defineField({
      name: 'order',
      title: 'Orden',
      type: 'number',
      description:
        'Banda superior: 1 = grande izquierda, 2 y 3 = chicas derecha. Banda inferior: 1–4 de izq a der.',
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    select: {
      title: 'title',
      brand: 'brand',
      placement: 'placement',
      active: 'active',
      media: 'image',
    },
    prepare({ title, brand, placement, active, media }) {
      const place = placement === 'ads1' ? 'Banda superior' : 'Banda inferior';
      return {
        title: brand ? `${brand} — ${title}` : (title ?? '(sin título)'),
        subtitle: `${place}${active ? '' : ' · PAUSADO'}`,
        media,
      };
    },
  },

  orderings: [
    {
      title: 'Ubicación + Orden',
      name: 'placementOrder',
      by: [
        { field: 'placement', direction: 'asc' },
        { field: 'order', direction: 'asc' },
      ],
    },
  ],
});
