import groq from 'groq';

/**
 * Queries GROQ para Sanity.
 *
 * Regla de imágenes: mainImage es un objeto { url, alt } almacenado en R2.
 * NO usar `asset->` ni `urlForImage()` — no es un sanity.imageAsset.
 * Simplemente leer `mainImage.url` directamente.
 */

// ─── Fragments reutilizables ──────────────────────────────────────────────────

/** Shape mínima de artículo para listas y grids (sin body — más liviana). */
const ARTICLE_CARD_FIELDS = groq`
  _id,
  title,
  slug,
  publishedAt,
  modifiedAt,
  wpId,
  excerpt,
  featured,
  format,
  highlightWord,
  mainImage,
  "author": author->name,
  "categories": categories[]-> {
    "_id": _id,
    title,
    "slug": slug
  },
  tags,
  originalUrl
`;

// ─── Articles ─────────────────────────────────────────────────────────────────

/**
 * N artículos más recientes — build-time para la home.
 * Sin body (demasiado pesado para 50 artículos).
 */
export const RECENT_ARTICLES_QUERY = groq`
  *[_type == "article" && defined(slug.current)]
  | order(publishedAt desc)[0...$n] {
    ${ARTICLE_CARD_FIELDS}
  }
`;

/**
 * Artículos recientes por categoría (slug) — build-time o on-demand.
 * El operador `->` dereferencía el array de refs de categorías para filtrar por slug.
 */
export const ARTICLES_BY_CATEGORY_QUERY = groq`
  *[_type == "article" && defined(slug.current) && $categorySlug in categories[]->slug.current]
  | order(publishedAt desc)[$offset...$limit] {
    ${ARTICLE_CARD_FIELDS}
  }
`;

/** Artículo individual por slug — on-demand (incluye body completo). */
export const ARTICLE_BY_SLUG_QUERY = groq`
  *[_type == "article" && slug.current == $slug && defined(slug.current)][0] {
    _id,
    title,
    slug,
    publishedAt,
    modifiedAt,
    wpId,
    excerpt,
    featured,
    format,
    mainImage,
    body,
    "author": author-> {
      name,
      "slug": slug,
      avatar,
      bio,
      socialLinks
    },
    "categories": categories[]-> {
      "_id": _id,
      title,
      "slug": slug,
      color
    },
    tags,
    originalUrl,
    seo,
    needsReview
  }
`;

/** Artículos destacados para el hero del home. */
export const FEATURED_ARTICLES_QUERY = groq`
  *[_type == "article" && featured == true && defined(slug.current)]
  | order(publishedAt desc)[0...5] {
    ${ARTICLE_CARD_FIELDS}
  }
`;

// ─── Advertisements ───────────────────────────────────────────────────────────

export const ALL_ADVERTISEMENTS_QUERY = groq`
  *[_type == "advertisement" && active == true]
  | order(placement asc, order asc) {
    _id,
    title,
    brand,
    image,
    url,
    placement,
    order
  }
`;

// ─── Authors ──────────────────────────────────────────────────────────────────

export const ALL_AUTHORS_QUERY = groq`
  *[_type == "author"] | order(name asc) {
    _id,
    name,
    slug,
    avatar,
    bio,
    email,
    socialLinks
  }
`;

// ─── Categories ───────────────────────────────────────────────────────────────

export const ALL_CATEGORIES_QUERY = groq`
  *[_type == "category"] | order(order asc, title asc) {
    _id,
    title,
    slug,
    description,
    color,
    order
  }
`;

// ─── Hero ─────────────────────────────────────────────────────────────────────

export const LATEST_NEWS_QUERY = groq`
  *[_type == "article" && defined(slug.current)] | order(publishedAt desc) [0...4] {
    _id,
    title,
    slug,
    publishedAt
  }
`;

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

// ─── Programs ─────────────────────────────────────────────────────────────────

export const ALL_PROGRAMS_QUERY = groq`
  *[_type == "program" && defined(youtubeUrl)]
  | order(order asc, publishedAt desc) [0...8] {
    _id,
    title,
    guest,
    youtubeUrl,
    order,
    publishedAt
  }
`;

// ─── Radio Shows (Lineup) ─────────────────────────────────────────────────────

export const ALL_RADIO_SHOWS_QUERY = groq`
  *[_type == "radioShow"] | order(order asc) {
    _id,
    name,
    slug,
    days,
    time,
    order
  }
`;

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
