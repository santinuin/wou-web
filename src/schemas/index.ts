import type { SchemaTypeDefinition } from 'sanity';
import { articleType } from './article';
import { authorType } from './author';
import { blockContentType } from './blockContent';
import { categoryType } from './category';
import { editorialType } from './editorial';
import { programType } from './program';
import { r2ImageType } from './r2Image';
import { radioShowType } from './radioShow';
import { radioStreamType } from './radioStream';
import { advertisementType } from './advertisement';

export const schema: { types: SchemaTypeDefinition[] } = {
  // r2ImageType debe registrarse ANTES de blockContentType
  // porque blockContent lo referencia como miembro de array.
  types: [
    r2ImageType,
    articleType,
    authorType,
    blockContentType,
    categoryType,
    editorialType,
    programType,
    radioShowType,
    radioStreamType,
    advertisementType,
  ],
};
