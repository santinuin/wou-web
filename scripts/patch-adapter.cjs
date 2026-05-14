// Patches @astrojs/cloudflare to use "CF_ASSETS" instead of "ASSETS" as the
// default assets binding name. "ASSETS" is reserved by CF Pages and causes
// wrangler validation to fail during the prerender build step.
// On actual CF Pages, env.ASSETS is provided automatically by the platform
// (the Worker code uses env.ASSETS directly, regardless of the binding name
// in wrangler.json).
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../node_modules/@astrojs/cloudflare/dist/wrangler.js');

if (!fs.existsSync(file)) {
  console.log('patch-adapter: file not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(file, 'utf8');

if (content.includes('"CF_ASSETS"')) {
  console.log('patch-adapter: already patched, skipping.');
  process.exit(0);
}

content = content.replace(
  'const DEFAULT_ASSETS_BINDING_NAME = "ASSETS";',
  'const DEFAULT_ASSETS_BINDING_NAME = "CF_ASSETS";'
);

fs.writeFileSync(file, content);
console.log('patch-adapter: patched DEFAULT_ASSETS_BINDING_NAME → CF_ASSETS');
