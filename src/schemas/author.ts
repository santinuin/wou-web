/**
 * author — perfil de redactor/colaborador.
 *
 * Migrado de WordPress headless → Sanity.
 * El campo `image` (antes sanity.imageAsset) ahora es un objeto { url } apuntando a R2.
 */
import { defineField, defineType } from 'sanity';

export const authorType = defineType({
  name: 'author',
  title: 'Autor',
  type: 'document',

  fields: [
    // ── Trazabilidad WordPress ────────────────────────────────────────────
    defineField({
      name: 'wpId',
      title: 'WordPress ID',
      type: 'number',
      readOnly: true,
    }),
    defineField({
      name: 'wpLogin',
      title: 'Usuario WordPress',
      type: 'string',
      readOnly: true,
    }),

    // ── Datos del autor ───────────────────────────────────────────────────
    defineField({
      name: 'name',
      title: 'Nombre completo',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),

    // ── Avatar — URL de R2, nunca sanity.imageAsset ───────────────────────
    defineField({
      name: 'avatar',
      title: 'Foto de perfil',
      type: 'object',
      description: 'URL pública en Cloudflare R2 o Gravatar.',
      fields: [
        {
          name: 'url',
          type: 'url',
          title: 'URL de la imagen',
        },
        {
          name: 'alt',
          type: 'string',
          title: 'Texto alternativo',
        },
      ],
    }),

    // ── Biografía ─────────────────────────────────────────────────────────
    defineField({
      name: 'bio',
      title: 'Biografía',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [{ title: 'Normal', value: 'normal' }],
          lists: [],
          marks: {
            decorators: [
              { title: 'Negrita', value: 'strong' },
              { title: 'Cursiva', value: 'em' },
            ],
            annotations: [],
          },
        },
      ],
    }),

    // ── Contacto ──────────────────────────────────────────────────────────
    defineField({
      name: 'email',
      title: 'Email',
      type: 'email',
    }),
    defineField({
      name: 'socialLinks',
      title: 'Redes sociales',
      type: 'object',
      fields: [
        { name: 'twitter', type: 'url', title: 'Twitter / X' },
        { name: 'instagram', type: 'url', title: 'Instagram' },
        { name: 'linkedin', type: 'url', title: 'LinkedIn' },
      ],
    }),
  ],

  preview: {
    select: { title: 'name', avatarUrl: 'avatar.url' },
    prepare({ title }) {
      return { title: title ?? '(sin nombre)' };
    },
  },
});
