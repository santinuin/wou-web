/**
 * r2Image — bloque custom para imágenes inline en Portable Text.
 *
 * Por qué existe este tipo en lugar del tipo nativo `image` de Sanity:
 *   - El tipo nativo `image` crea un documento `sanity.imageAsset` por cada imagen.
 *   - Con 22.837+ archivos históricos, eso excedería el límite de 25.000 documentos del plan Growth.
 *   - En cambio, `r2Image` almacena solo la URL pública de Cloudflare R2 — cero documentos extra.
 *
 * Flujo de upload para redactores en el Studio:
 *   1. El redactor sube la imagen al Worker de R2 (o directo al dashboard de R2).
 *   2. Copia la URL pública (https://media.wou.com.ar/uploads/...).
 *   3. Pega la URL en este campo.
 *
 * El campo `_type: 'r2Image'` permite que el renderer de Portable Text
 * en el frontend lo identifique y use el componente R2ImageBlock.astro.
 */
import { defineType, defineField } from 'sanity';

export const r2ImageType = defineType({
  name: 'r2Image',
  title: 'Imagen (R2)',
  type: 'object',
  fields: [
    defineField({
      name: 'url',
      title: 'URL de la imagen',
      type: 'url',
      description: 'URL pública en Cloudflare R2. Ej: https://media.wou.com.ar/uploads/2024/01/foto.jpg',
      validation: (Rule) =>
        Rule.required().uri({ scheme: ['https'] }),
    }),
    defineField({
      name: 'alt',
      title: 'Texto alternativo',
      type: 'string',
      description: 'Descripción de la imagen para accesibilidad y SEO.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'caption',
      title: 'Epígrafe',
      type: 'string',
      description: 'Texto opcional debajo de la imagen.',
    }),
    defineField({
      name: 'width',
      title: 'Ancho (px)',
      type: 'number',
      description: 'Ancho original en píxeles. Ayuda al navegador a reservar espacio.',
    }),
    defineField({
      name: 'height',
      title: 'Alto (px)',
      type: 'number',
      description: 'Alto original en píxeles.',
    }),
  ],
  preview: {
    select: { url: 'url', alt: 'alt' },
    prepare({ url, alt }) {
      return {
        title: alt ?? 'Sin descripción',
        subtitle: url ?? 'Sin URL',
        // No hay media preview porque no es un sanity.imageAsset
      };
    },
  },
});
