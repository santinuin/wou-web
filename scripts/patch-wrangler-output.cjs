// Post-build patch for dist/server/wrangler.json.
// Removes the SESSION KV binding added by @astrojs/cloudflare (no real namespace
// ID exists — sessions are not used in this project).
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../dist/server/wrangler.json');
if (!fs.existsSync(file)) process.exit(0);

const config = JSON.parse(fs.readFileSync(file, 'utf8'));

if (Array.isArray(config.kv_namespaces)) {
  config.kv_namespaces = config.kv_namespaces.filter(kv => kv.binding !== 'SESSION');
  if (config.kv_namespaces.length === 0) delete config.kv_namespaces;
}
if (config.previews?.kv_namespaces) {
  config.previews.kv_namespaces = config.previews.kv_namespaces.filter(kv => kv.binding !== 'SESSION');
  if (config.previews.kv_namespaces.length === 0) delete config.previews.kv_namespaces;
}

fs.writeFileSync(file, JSON.stringify(config));
console.log('postbuild: removed SESSION KV from dist/server/wrangler.json');
