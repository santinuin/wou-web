/**
 * Formatea una fecha como tiempo relativo en español.
 * Se ejecuta en build-time (SSG) — el resultado es estático.
 */
export function timeAgo(date: Date | string): string {
  const diffMin = Math.floor(
    (Date.now() - new Date(date).getTime()) / 60_000
  );
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  return `Hace ${Math.floor(diffH / 24)} d`;
}

/**
 * Formatea una fecha en formato largo en español.
 * Ej: "9 de abril de 2026"
 */
export function formatDateLong(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formatea una fecha como "09 • 04 • 2026".
 */
export function formatDateDots(date: Date | string): string {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd} • ${mm} • ${yyyy}`;
}

// Entidades nombradas más frecuentes en excerpts y títulos de WordPress.
// Las que vienen numéricas (&#1234;) las maneja decodeHtmlEntities aparte.
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  iexcl: '¡',
  iquest: '¿',
  copy: '©',
  reg: '®',
  trade: '™',
};

/**
 * Decodifica entidades HTML (numéricas y las nombradas más comunes).
 * Pensada para texto plano que viene del REST API de WordPress —
 * no usa DOM porque corre en el edge (Cloudflare Worker).
 */
export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&([a-zA-Z]+);/g, (match, name) => {
      const decoded = NAMED_HTML_ENTITIES[name.toLowerCase()];
      return decoded ?? match;
    });
}

/**
 * Quita tags HTML y decodifica entidades, devolviendo texto plano.
 * Útil para excerpts y títulos provenientes del REST API de WordPress.
 */
export function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).trim();
}
