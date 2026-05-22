// Tipo mínimo que comparten CollectionEntry<'advertisements'> y los mocks.
export type AdLike = {
  id: string;
  data: {
    _id: string;
    title: string;
    brand?: string | null;
    image?: { url: string; alt?: string | null } | null;
    url?: string | null;
    placement: string;
    order?: number | null;
  };
};

// Tipo mínimo que comparten CollectionEntry<'articles'> y los mocks.
// NewsBand y NewsGrid usan este tipo — no importan CollectionEntry directamente.
export type ArticleLike = {
  id: string;
  data: {
    _id?: string;
    wpId?: number;
    title: string;
    slug: { current: string };
    publishedAt?: string | null;
    excerpt?: string | null;
    featured?: boolean | null;
    highlightWord?: string | null;
    // Acepta tanto referencias Sanity como objetos { url } de WordPress
    mainImage?: { url?: string | null; alt?: string | null; [key: string]: unknown } | null;
    categories?: { _id: string; title: string }[] | null;
  };
};

function mock(
  id: string,
  title: string,
  category: string,
  featured: boolean,
  excerpt: string | null = null,
  highlightWord: string | null = null,
): ArticleLike {
  return {
    id,
    data: {
      _id: id,
      title,
      slug: { current: id },
      publishedAt: new Date().toISOString(),
      excerpt,
      featured,
      highlightWord,
      mainImage: null,
      categories: [{ _id: `cat-${category}`, title: category }],
    },
  };
}

export const MOCK_ARTICLES: ArticleLike[] = [
  // ── Política ──────────────────────────────────────────────────────────────
  mock('politica-1', 'Sueldos de pobreza',           'Política', true,  'En una provincia donde los indicadores de pobreza no dejan de escalar.', 'pobreza'),
  mock('politica-2', 'Entre necesidad e ilegalidad', 'Política', false),
  mock('politica-3', 'Río Gallegos, KM 0',           'Política', false),
  mock('politica-4', 'El oficialismo empieza a partirse', 'Política', false),

  // ── Locales ───────────────────────────────────────────────────────────────
  mock('locales-1', 'Tu muni en el celular',         'Locales', true, 'El Municipio adhiere a "Mi Muni, Mi Cuenta" y facilita el pago de impuestos.', ''),
  mock('locales-2', 'Bloqueo de celulares en cárceles', 'Locales', false),
  mock('locales-3', 'Jugarte: Primer round',         'Locales', false),
  mock('locales-4', 'Planazo en la Ortiz',           'Locales', false),

  // ── Policiales ────────────────────────────────────────────────────────────
  mock('policiales-1', 'Abigeato en la ruta',        'Policiales', true, 'Un control policial en cercanías de Piedra Buena terminó con el secuestro de carne.', 'Abigeato'),
  mock('policiales-2', 'Justicia por Cristian Pérez','Policiales', false),
  mock('policiales-3', 'Detenido por amenazar a un periodista', 'Policiales', false),
  mock('policiales-4', 'Robo de hierros',            'Policiales', false),

  // ── Opinión ───────────────────────────────────────────────────────────────
  mock('opinion-1', 'El dilema de Vidal',            'Opinión', true, 'Santa Cruz: lealtad a los propios o apertura a los advenedizos.', 'Vidal'),
  mock('opinion-2', 'Tragedia en Santa Cruz',        'Opinión', false),
  mock('opinion-3', 'Mi opinión que no le interesa a nadie', 'Opinión', false),
  mock('opinion-4', 'Estado elefante y sueldos bajos', 'Opinión', false),
];

// ── Mocks de anuncios ────────────────────────────────────────────────────────
// SVG data URLs: funcionan sin red, visibles en headless.

function svgUrl(label: string, bg: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='160'>
    <rect width='600' height='160' fill='${bg}'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
      font-family='sans-serif' font-size='20' font-weight='bold' fill='white'
      opacity='0.7'>${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const MOCK_ADS1: AdLike[] = [
  {
    id: 'mock-ad1-wide',
    data: { _id: 'mock-ad1-wide',  title: 'Tu marca aquí', brand: 'Anuncio principal',
      image: { url: svgUrl('Anuncio principal · 2fr', '#1c3f8f'), alt: 'Anuncio' },
      url: null, placement: 'ads1', order: 1 },
  },
  {
    id: 'mock-ad1-2',
    data: { _id: 'mock-ad1-2', title: 'Tu marca aquí', brand: 'Anuncio',
      image: { url: svgUrl('Anuncio · 1fr', '#2a5a9e'), alt: 'Anuncio' },
      url: null, placement: 'ads1', order: 2 },
  },
  {
    id: 'mock-ad1-3',
    data: { _id: 'mock-ad1-3', title: 'Tu marca aquí', brand: 'Anuncio',
      image: { url: svgUrl('Anuncio · 1fr', '#2a5a9e'), alt: 'Anuncio' },
      url: null, placement: 'ads1', order: 3 },
  },
];

export const MOCK_ADS2: AdLike[] = [
  {
    id: 'mock-ad2-1',
    data: { _id: 'mock-ad2-1', title: 'Tu marca aquí', brand: 'Publicidad',
      image: { url: svgUrl('Anuncio 1', '#1c3f8f'), alt: 'Anuncio' },
      url: null, placement: 'ads2', order: 1 },
  },
  {
    id: 'mock-ad2-2',
    data: { _id: 'mock-ad2-2', title: 'Tu marca aquí', brand: 'Publicidad',
      image: { url: svgUrl('Anuncio 2', '#1c3f8f'), alt: 'Anuncio' },
      url: null, placement: 'ads2', order: 2 },
  },
  {
    id: 'mock-ad2-3',
    data: { _id: 'mock-ad2-3', title: 'Tu marca aquí', brand: 'Publicidad',
      image: { url: svgUrl('Anuncio 3', '#1c3f8f'), alt: 'Anuncio' },
      url: null, placement: 'ads2', order: 3 },
  },
  {
    id: 'mock-ad2-4',
    data: { _id: 'mock-ad2-4', title: 'Tu marca aquí', brand: 'Publicidad',
      image: { url: svgUrl('Anuncio 4', '#1c3f8f'), alt: 'Anuncio' },
      url: null, placement: 'ads2', order: 4 },
  },
];
