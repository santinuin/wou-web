import type { ImageMetadata } from 'astro';

import ambiente   from '@/assets/placeholders/ambiente.png';
import circuoRojo from '@/assets/placeholders/circulo-rojo.png';
import cultura    from '@/assets/placeholders/cultura.png';
import deportes   from '@/assets/placeholders/deportes.png';
import economia   from '@/assets/placeholders/economia.png';
import locales    from '@/assets/placeholders/locales.png';
import nacionales from '@/assets/placeholders/nacionales.png';
import opinion    from '@/assets/placeholders/opinion.png';
import policiales from '@/assets/placeholders/policiales.png';
import politica   from '@/assets/placeholders/politica.png';
import sociedad   from '@/assets/placeholders/sociedad.png';
import turismo    from '@/assets/placeholders/turismo.png';

const MAP: Record<string, ImageMetadata> = {
  'Ambiente':     ambiente,
  'Circulo Rojo': circuoRojo,
  'Círculo Rojo': circuoRojo,
  'Cultura':      cultura,
  'Deportes':     deportes,
  'Economía':     economia,
  'Economia':     economia,
  'Locales':      locales,
  'Nacionales':   nacionales,
  'Opinión':      opinion,
  'Opinion':      opinion,
  'Policiales':   policiales,
  'Política':     politica,
  'Politica':     politica,
  'Sociedad':     sociedad,
  'Turismo':      turismo,
};

export function getPlaceholder(category: string | null | undefined): ImageMetadata {
  return (category && MAP[category]) || nacionales;
}
