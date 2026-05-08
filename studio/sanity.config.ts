import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schema } from '../src/schemas';
import { deployPlugin } from './plugins/deploy';

export default defineConfig({
  projectId: import.meta.env.SANITY_STUDIO_PROJECT_ID,
  dataset:   import.meta.env.SANITY_STUDIO_DATASET ?? 'production',

  plugins: [
    structureTool(),
    visionTool({ defaultApiVersion: '2024-01-01' }),
    deployPlugin(),
  ],

  schema,
});
