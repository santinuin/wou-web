import type { SchemaTypeDefinition } from 'sanity';
import { articleType } from './article';
import { authorType } from './author';
import { blockContentType } from './blockContent';
import { categoryType } from './category';
import { editorialType } from './editorial';
import { radioStreamType } from './radioStream';

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [articleType, authorType, blockContentType, categoryType, editorialType, radioStreamType],
};
