import groq from 'groq';

// IMPORTANTE: no usar `asset->` en queries de imágenes.
// El operador de deref convierte el reference stub { asset: { _ref, _type } }
// en un documento completo, lo que rompe el schema Zod en content.config.ts.
// @sanity/image-url funciona directamente con reference stubs — no es necesario.

// ─── Articles ─────────────────────────────────────────────────────────────────

export const ALL_ARTICLES_QUERY = groq`
  *[_type == "article" && defined(slug.current)] | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    format,
    featured,
    excerpt,
    mainImage,
    "author": author-> {
      name,
      slug,
      image
    },
    categories[]-> {
      _id,
      title,
      slug,
      color
    },
    body
  }
`;

// Lista ligera para páginas de índice — omite el campo body
export const ARTICLES_LIST_QUERY = groq`
  *[_type == "article" && defined(slug.current)] | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    format,
    featured,
    excerpt,
    mainImage,
    "author": author-> {
      name,
      slug
    },
    categories[]-> {
      _id,
      title,
      color
    }
  }
`;

// Artículos destacados para el hero del home
export const FEATURED_ARTICLES_QUERY = groq`
  *[_type == "article" && featured == true && defined(slug.current)]
  | order(publishedAt desc)[0...5] {
    _id,
    title,
    slug,
    publishedAt,
    format,
    excerpt,
    mainImage,
    "author": author-> { name, slug }
  }
`;

// Filtrar por formato editorial — pasar $format como parámetro
export const ARTICLES_BY_FORMAT_QUERY = groq`
  *[_type == "article" && format == $format && defined(slug.current)]
  | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    mainImage,
    "author": author-> { name, slug }
  }
`;

export const ARTICLE_BY_SLUG_QUERY = groq`
  *[_type == "article" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    publishedAt,
    format,
    featured,
    excerpt,
    mainImage,
    body,
    "author": author-> {
      name,
      slug,
      image,
      bio,
      socialLinks
    },
    categories[]-> {
      _id,
      title,
      slug,
      color
    }
  }
`;

// ─── Authors ──────────────────────────────────────────────────────────────────

export const ALL_AUTHORS_QUERY = groq`
  *[_type == "author"] | order(name asc) {
    _id,
    name,
    slug,
    image,
    bio,
    email,
    socialLinks
  }
`;

// ─── Categories ───────────────────────────────────────────────────────────────

export const ALL_CATEGORIES_QUERY = groq`
  *[_type == "category"] | order(title asc) {
    _id,
    title,
    slug,
    description,
    color
  }
`;
