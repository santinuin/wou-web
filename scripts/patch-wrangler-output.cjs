// Patches dist/server/wrangler.json after astro build for CF Pages compatibility.
// The adapter generates fields that fail CF Pages wrangler validation:
//   - triggers: {}  → must have only a "crons" property, not be empty
//   - kv_namespaces with no "id" → CF Pages requires real KV namespace IDs
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../dist/server/wrangler.json');

if (!fs.existsSync(file)) {
  console.log('patch-wrangler-output: dist/server/wrangler.json not found, skipping.');
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(file, 'utf8'));

// Fix triggers: {} → { crons: [] }
if (config.triggers !== undefined) {
  config.triggers = { crons: [] };
}

// Remove SESSION KV binding (no real namespace ID — sessions not used in this project)
if (Array.isArray(config.kv_namespaces)) {
  config.kv_namespaces = config.kv_namespaces.filter(kv => kv.binding !== 'SESSION');
  if (config.kv_namespaces.length === 0) delete config.kv_namespaces;
}

// Same fix for previews.kv_namespaces if present
if (config.previews?.kv_namespaces) {
  config.previews.kv_namespaces = config.previews.kv_namespaces.filter(kv => kv.binding !== 'SESSION');
  if (config.previews.kv_namespaces.length === 0) delete config.previews.kv_namespaces;
}

fs.writeFileSync(file, JSON.stringify(config));
console.log('patch-wrangler-output: patched dist/server/wrangler.json for CF Pages compatibility.');
