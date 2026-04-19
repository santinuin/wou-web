import { defineField, defineType } from 'sanity';

// Documento singleton — solo debe existir uno en el dataset.
export const radioStreamType = defineType({
  name: 'radioStream',
  title: 'Stream de Radio',
  type: 'document',
  fields: [
    defineField({
      name: 'isLive',
      title: '¿En vivo ahora?',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'station',
      title: 'Nombre de la estación',
      type: 'string',
      initialValue: 'WOU 95.1',
    }),
    defineField({
      name: 'description',
      title: 'Descripción de la radio',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'youtubeStreamId',
      title: 'ID del stream de YouTube',
      type: 'string',
      description: 'El ID que aparece en youtube.com/watch?v=ESTE_ID',
    }),
    defineField({
      name: 'streamUrl',
      title: 'URL del stream de audio (HLS / Icecast)',
      type: 'url',
    }),
    defineField({
      name: 'stationLogo',
      title: 'Logo circular de la emisora',
      type: 'image',
      options: { hotspot: true },
    }),
  ],

  preview: {
    select: { station: 'station', isLive: 'isLive' },
    prepare({ station, isLive }) {
      return {
        title: station ?? 'Radio',
        subtitle: isLive ? '🔴 EN VIVO' : '⚫ Offline',
      };
    },
  },
});
