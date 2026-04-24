import type { SchemaTypeDefinition } from 'sanity';
import { articleType } from './article';
import { authorType } from './author';
import { blockContentType } from './blockContent';
import { categoryType } from './category';
import { editorialType } from './editorial';
import { programType } from './program';
import { radioStreamType } from './radioStream';
import { redCircleType } from './redCircle';

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [articleType, authorType, blockContentType, categoryType, editorialType, programType, radioStreamType, redCircleType],
};
