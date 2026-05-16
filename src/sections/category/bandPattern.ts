/**
 * Patrón cíclico de banda — 7 filas distintas que se repiten al cargar más.
 *
 * | # | type | Layout                                  | cols |
 * |---|------|-----------------------------------------|------|
 * | 1 | a    | 2-col asimétrica, izquierda más ancha   | 2    |
 * | 2 | b    | 3-col equal                             | 3    |
 * | 3 | c    | 2-col equal (más alta)                  | 2    |
 * | 4 | d    | 2-col asimétrica, derecha más ancha     | 2    |
 * | 5 | e    | 1 card wide horizontal                  | 1    |
 * | 6 | f    | 2-col asimétrica, derecha mucho más     | 2    |
 * | 7 | g    | 3-col equal                             | 3    |
 *
 * Total por ciclo: 7 filas, 15 artículos.
 *
 * Reutilizado por CategoryGrid.astro (render inicial) y LoadMore.svelte
 * (paginación al hacer click en "+ Noticias").
 */
export type BandType = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

export interface BandRow {
  cols: number;
  type: BandType;
}

export const BAND_PATTERN: BandRow[] = [
  { cols: 2, type: 'a' },
  { cols: 3, type: 'b' },
  { cols: 2, type: 'c' },
  { cols: 2, type: 'd' },
  { cols: 1, type: 'e' },
  { cols: 2, type: 'f' },
  { cols: 3, type: 'g' },
];
