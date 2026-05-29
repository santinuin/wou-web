/**
 * Fallback para RedCircle cuando la categoría "circulo-rojo" no tiene posts.
 * Los placeholders son SVG inline (data URI) para que el build funcione sin red.
 */

export type RedCircleMockBall = {
  id: string;
  label: string;
  href: string;
  imageUrl: string;
  imageAlt: string;
};

function mockPlaceholder(seed: string, hue: number): string {
  const hue2 = (hue + 40) % 360;
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>" +
    "<defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>" +
    "<stop offset='0' stop-color='hsl(" + hue + ",70%,55%)'/>" +
    "<stop offset='1' stop-color='hsl(" + hue2 + ",70%,35%)'/>" +
    '</linearGradient></defs>' +
    "<rect width='120' height='120' fill='url(%23g)'/>" +
    "<text x='50%' y='54%' font-family='system-ui' font-size='14' font-weight='700' text-anchor='middle' fill='white'>" +
    seed +
    '</text></svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const MOCK_RED_CIRCLES: RedCircleMockBall[] = [
  { id: 'mock-1', label: 'No es un secreto',          href: '#', imageUrl: mockPlaceholder('01', 10),  imageAlt: 'Placeholder 1' },
  { id: 'mock-2', label: 'Alguien que sabe nos dijo', href: '#', imageUrl: mockPlaceholder('02', 45),  imageAlt: 'Placeholder 2' },
  { id: 'mock-3', label: 'Título',                    href: '#', imageUrl: mockPlaceholder('03', 180), imageAlt: 'Placeholder 3' },
  { id: 'mock-4', label: 'Otra vez',                  href: '#', imageUrl: mockPlaceholder('04', 260), imageAlt: 'Placeholder 4' },
  { id: 'mock-5', label: 'En la mira',                href: '#', imageUrl: mockPlaceholder('05', 330), imageAlt: 'Placeholder 5' },
  { id: 'mock-6', label: 'Lo confirmó',               href: '#', imageUrl: mockPlaceholder('06', 140), imageAlt: 'Placeholder 6' },
  { id: 'mock-7', label: 'El dato clave',             href: '#', imageUrl: mockPlaceholder('07', 200), imageAlt: 'Placeholder 7' },
  { id: 'mock-8', label: 'Versión oficial',           href: '#', imageUrl: mockPlaceholder('08', 80),  imageAlt: 'Placeholder 8' },
];
