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
