import { defineCliConfig } from 'sanity/cli';

// El CLI corre en contexto Node.js (no Vite) → process.env, nunca import.meta.env
export default defineCliConfig({
  api: {
    projectId: process.env.PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.PUBLIC_SANITY_DATASET!,
  },
});
