/**
 * r2Image — bloque custom para imágenes inline en Portable Text.
 *
 * Por qué existe este tipo en lugar del tipo nativo `image` de Sanity:
 *   - El tipo nativo `image` crea un documento `sanity.imageAsset` por cada imagen.
 *   - Con 22.837+ archivos históricos, eso excedería el límite de 25.000 documentos del plan Growth.
 *   - En cambio, `r2Image` almacena solo la URL pública de Cloudflare R2 — cero documentos extra.
 *
 * El input custom con drag-and-drop se inyecta desde el Studio (studio/sanity.config.ts)
 * para no contaminar este schema con imports de React (incompatible con el build de Astro).
 *
 * Flujo para redactores en el Studio:
 *   1. Arrastrán una imagen en el campo "URL de la imagen" → se sube automáticamente a R2.
 *   2. El campo `url` se rellena con la URL pública. Solo resta completar el `alt`.
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
      description: 'Arrastrá una imagen (el Studio la sube automáticamente a R2) o pegá una URL.',
      validation: (Rule) =>
        Rule.required().uri({ scheme: ['https'] }),
      // El input custom R2UrlInput se inyecta en studio/sanity.config.ts
      // para mantener este schema sin dependencias de React.
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
      description: 'Se completa automáticamente al subir. Ayuda al navegador a reservar espacio.',
    }),
    defineField({
      name: 'height',
      title: 'Alto (px)',
      type: 'number',
      description: 'Se completa automáticamente al subir.',
    }),
  ],
  preview: {
    select: { url: 'url', alt: 'alt' },
    prepare({ url, alt }) {
      return {
        title: alt ?? 'Sin descripción',
        subtitle: url ?? 'Sin URL',
      };
    },
  },
});
