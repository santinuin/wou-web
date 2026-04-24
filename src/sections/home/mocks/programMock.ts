/**
 * Mock para la sección Programs mientras la collection `programs` no
 * está poblada en Sanity. Placeholder SVG inline (data URI) para que el
 * build funcione sin red.
 *
 * TODO: eliminar cuando existan programas reales en Sanity.
 */

export type ProgramItem = {
  id: string;
  title: string;
  guest: string | null;
  /** URL del thumbnail — YouTube en prod, data URI en mock. */
  thumbUrl: string;
  /** URL del watch page — `#` en mock. */
  watchUrl: string;
  /** Video ID de 11 chars — string vacío en mock (sólo decorativo). */
  videoId: string;
};

function mockThumb(label: string, hue: number): string {
  const hue2 = (hue + 35) % 360;
  // 16:9 para imitar el aspect ratio del thumbnail real de YouTube
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'>" +
    "<defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>" +
    "<stop offset='0' stop-color='hsl(" + hue + ",60%,35%)'/>" +
    "<stop offset='1' stop-color='hsl(" + hue2 + ",60%,20%)'/>" +
    '</linearGradient></defs>' +
    "<rect width='640' height='360' fill='url(%23g)'/>" +
    "<circle cx='320' cy='180' r='52' fill='rgba(255,255,255,0.15)'/>" +
    "<polygon points='305,150 305,210 355,180' fill='white'/>" +
    "<text x='50%' y='88%' font-family='system-ui' font-size='22' font-weight='700' text-anchor='middle' fill='rgba(255,255,255,0.85)'>" +
    label +
    '</text></svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const MOCK_PROGRAMS: ProgramItem[] = [
  {
    id: 'mock-1',
    title: 'WOUW Noticias',
    guest: 'Germán Ortiz y Nancy Páez',
    thumbUrl: mockThumb('WOUW Noticias', 210),
    watchUrl: '#',
    videoId: '',
  },
  {
    id: 'mock-2',
    title: 'Entrevista exclusiva',
    guest: 'Marketing Invisible',
    thumbUrl: mockThumb('Entrevista', 160),
    watchUrl: '#',
    videoId: '',
  },
  {
    id: 'mock-3',
    title: 'Pulso de la semana',
    guest: 'Panel económico',
    thumbUrl: mockThumb('Pulso semanal', 280),
    watchUrl: '#',
    videoId: '',
  },
  {
    id: 'mock-4',
    title: 'Fuera de cámara',
    guest: 'Invitado especial',
    thumbUrl: mockThumb('Fuera de cámara', 15),
    watchUrl: '#',
    videoId: '',
  },
  {
    id: 'mock-5',
    title: 'El dato',
    guest: 'Redacción WOU',
    thumbUrl: mockThumb('El dato', 120),
    watchUrl: '#',
    videoId: '',
  },
  {
    id: 'mock-6',
    title: 'Radio WOU en vivo',
    guest: null,
    thumbUrl: mockThumb('Radio WOU', 45),
    watchUrl: '#',
    videoId: '',
  },
];
