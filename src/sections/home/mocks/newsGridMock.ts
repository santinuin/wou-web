// Tipo mínimo que comparten CollectionEntry<'articles'> y los mocks.
// NewsBand y NewsGrid usan este tipo — no importan CollectionEntry directamente.
export type ArticleLike = {
  id: string;
  data: {
    _id: string;
    title: string;
    slug: { current: string };
    publishedAt?: string | null;
    excerpt?: string | null;
    featured?: boolean | null;
    mainImage?: { alt?: string | null; [key: string]: unknown } | null;
    categories?: { _id: string; title: string }[] | null;
  };
};

function mock(
  id: string,
  title: string,
  category: string,
  featured: boolean,
  excerpt: string | null = null,
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
      mainImage: null,
      categories: [{ _id: `cat-${category}`, title: category }],
    },
  };
}

export const MOCK_ARTICLES: ArticleLike[] = [
  // ── Política ──────────────────────────────────────────────────────────────
  mock('politica-1', 'Sueldos de pobreza',           'Política', true,  'En una provincia donde los indicadores de pobreza no dejan de escalar.'),
  mock('politica-2', 'Entre necesidad e ilegalidad', 'Política', false),
  mock('politica-3', 'Río Gallegos, KM 0',           'Política', false),
  mock('politica-4', 'El oficialismo empieza a partirse', 'Política', false),

  // ── Locales ───────────────────────────────────────────────────────────────
  mock('locales-1', 'Tu muni en el celular',         'Locales', true, 'El Municipio adhiere a "Mi Muni, Mi Cuenta" y facilita el pago de impuestos.'),
  mock('locales-2', 'Bloqueo de celulares en cárceles', 'Locales', false),
  mock('locales-3', 'Jugarte: Primer round',         'Locales', false),
  mock('locales-4', 'Planazo en la Ortiz',           'Locales', false),

  // ── Policiales ────────────────────────────────────────────────────────────
  mock('policiales-1', 'Abigeato en la ruta',        'Policiales', true, 'Un control policial en cercanías de Piedra Buena terminó con el secuestro de carne.'),
  mock('policiales-2', 'Justicia por Cristian Pérez','Policiales', false),
  mock('policiales-3', 'Detenido por amenazar a un periodista', 'Policiales', false),
  mock('policiales-4', 'Robo de hierros',            'Policiales', false),

  // ── Opinión ───────────────────────────────────────────────────────────────
  mock('opinion-1', 'El dilema de Vidal',            'Opinión', true, 'Santa Cruz: lealtad a los propios o apertura a los advenedizos.'),
  mock('opinion-2', 'Tragedia en Santa Cruz',        'Opinión', false),
  mock('opinion-3', 'Mi opinión que no le interesa a nadie', 'Opinión', false),
  mock('opinion-4', 'Estado elefante y sueldos bajos', 'Opinión', false),
];
