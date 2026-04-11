import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schema } from './src/schemas';

export default defineConfig({
  // SANITY_STUDIO_* → contexto browser del Studio (bun run studio)
  // PUBLIC_*        → contexto Astro/Vite
  // Ambos apuntan a los mismos valores; SANITY_STUDIO_* tiene prioridad aquí.
  projectId:
    import.meta.env.SANITY_STUDIO_PROJECT_ID ??
    import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset:
    import.meta.env.SANITY_STUDIO_DATASET ??
    import.meta.env.PUBLIC_SANITY_DATASET,

  plugins: [
    structureTool(),
    // visionTool: GROQ playground en el Studio.
    // Imprescindible durante la fase exploratoria para probar queries
    // antes de comprometerse con el schema.
    visionTool({ defaultApiVersion: '2024-01-01' }),
  ],

  schema,
});
