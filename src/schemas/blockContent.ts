/**
 * blockContent — tipo reutilizable de Portable Text para el cuerpo de artículos.
 *
 * Cambio respecto a la versión anterior:
 *   - Se eliminó el bloque nativo `image` (crearía sanity.imageAsset → consume documentos).
 *   - Se agregó el bloque custom `r2Image` → almacena URL de R2, cero documentos extra.
 */
import { defineArrayMember, defineType } from 'sanity';

export const blockContentType = defineType({
  title: 'Block Content',
  name: 'blockContent',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'Heading 2', value: 'h2' },
        { title: 'Heading 3', value: 'h3' },
        { title: 'Cita', value: 'blockquote' },
      ],
      lists: [
        { title: 'Viñetas', value: 'bullet' },
        { title: 'Numerada', value: 'number' },
      ],
      marks: {
        decorators: [
          { title: 'Negrita', value: 'strong' },
          { title: 'Cursiva', value: 'em' },
          { title: 'Código', value: 'code' },
        ],
        annotations: [
          {
            title: 'Enlace',
            name: 'link',
            type: 'object',
            fields: [
              {
                title: 'URL',
                name: 'href',
                type: 'url',
                validation: (Rule) =>
                  Rule.uri({ scheme: ['http', 'https', 'mailto', 'tel'] }),
              },
              {
                title: 'Abrir en nueva pestaña',
                name: 'blank',
                type: 'boolean',
              },
            ],
          },
        ],
      },
    }),
    // ⚠️ r2Image en lugar del nativo `image` — ver src/schemas/r2Image.ts
    defineArrayMember({ type: 'r2Image' }),
  ],
});
