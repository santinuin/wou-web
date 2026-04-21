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

// ─── Hero ─────────────────────────────────────────────────────────────────────

// Últimas 4 noticias para el bloque "Ponete al día"
export const LATEST_NEWS_QUERY = groq`
  *[_type == "article" && defined(slug.current)] | order(publishedAt desc) [0...4] {
    _id,
    title,
    slug,
    publishedAt
  }
`;

// Editorial más reciente para el bloque derecho del Hero
export const LATEST_EDITORIAL_QUERY = groq`
  *[_type == "editorial" && defined(slug.current)] | order(publishedAt desc) [0] {
    _id,
    title,
    question,
    image,
    slug,
    publishedAt
  }
`;

// ─── Red Circles ──────────────────────────────────────────────────────────────

// Bolas de la sección "RedCircle" del home — orden manual + más reciente
export const ALL_RED_CIRCLES_QUERY = groq`
  *[_type == "redCircle" && defined(slug.current)]
  | order(order asc, publishedAt desc) {
    _id,
    label,
    slug,
    href,
    image,
    order,
    publishedAt
  }
`;

// Configuración del stream de radio (singleton)
export const RADIO_STREAM_QUERY = groq`
  *[_type == "radioStream"][0] {
    isLive,
    station,
    description,
    youtubeStreamId,
    streamUrl,
    stationLogo
  }
`;
