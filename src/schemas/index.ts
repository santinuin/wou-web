import type { SchemaTypeDefinition } from 'sanity';
import { articleType } from './article';
import { authorType } from './author';
import { blockContentType } from './blockContent';
import { categoryType } from './category';

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [articleType, authorType, blockContentType, categoryType],
};
