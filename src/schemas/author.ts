import { defineField, defineType } from 'sanity';

export const authorType = defineType({
  name: 'author',
  title: 'Autor',
  type: 'document',

  // ── Núcleo invariante ────────────────────────────────────────────────────
  fields: [
    defineField({
      name: 'name',
      title: 'Nombre',
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

    // ── Experimental — confirmar con el equipo ────────────────────────────
    // [EXP] ¿Foto de perfil o avatar generado?
    defineField({
      name: 'image',
      title: 'Foto de perfil [EXP]',
      type: 'image',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Texto alternativo',
          description: 'Requerido para accesibilidad.',
        },
      ],
    }),
    // [EXP] ¿Bio en rich text o texto plano?
    defineField({
      name: 'bio',
      title: 'Biografía [EXP]',
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
    // [EXP] ¿Email público o solo interno?
    defineField({
      name: 'email',
      title: 'Email [EXP]',
      type: 'email',
    }),
    // [EXP] ¿Qué redes sociales? ¿Array de objetos o campos fijos?
    defineField({
      name: 'socialLinks',
      title: 'Redes sociales [EXP]',
      type: 'object',
      fields: [
        { name: 'twitter', type: 'url', title: 'Twitter / X' },
        { name: 'linkedin', type: 'url', title: 'LinkedIn' },
      ],
    }),
  ],

  preview: {
    select: { title: 'name', media: 'image' },
  },
});
