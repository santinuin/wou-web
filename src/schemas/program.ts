import { defineField, defineType } from 'sanity';

/**
 * Program — últimos programas del canal de YouTube de WOU.
 * Alimentan la sección "Programs" del home: una animación scroll-driven
 * que reproduce el efecto de videos atravesando una máscara píldora.
 *
 * Fase exploratoria: la estructura puede cambiar. Casi todos los campos
 * son `[EXP]`. El núcleo invariante es `title` + `youtubeUrl`.
 */
export const programType = defineType({
  name: 'program',
  title: 'Programa',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Título del programa',
      type: 'string',
      description: 'Ej: "WOUW Noticias".',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'guest',
      title: 'Invitado / Bajada [EXP]',
      type: 'string',
      description: 'Línea secundaria debajo del título. Ej: "Germán Ortiz y Nancy Páez".',
    }),
    defineField({
      name: 'youtubeUrl',
      title: 'URL de YouTube',
      type: 'url',
      description: 'Link completo al video. El videoId se extrae en build-time.',
      validation: (Rule) =>
        Rule.required().uri({ scheme: ['http', 'https'] }).custom((url) => {
          if (!url) return true;
          const match = String(url).match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
          );
          return match ? true : 'URL no reconocida como YouTube video';
        }),
    }),
    defineField({
      name: 'order',
      title: 'Orden [EXP]',
      type: 'number',
      description: 'Posición dentro de la sección (menor = aparece primero).',
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
    select: { title: 'title', subtitle: 'guest' },
    prepare({ title, subtitle }) {
      return { title: title ?? '(sin título)', subtitle: subtitle ?? 'Programa' };
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
