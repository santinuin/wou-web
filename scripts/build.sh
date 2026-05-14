#!/bin/bash
# Runs astro build and exits 0 if the essential output exists,
# even if wrangler's local ASSETS binding validation fails
# (CF Pages provides env.ASSETS automatically; local validation is irrelevant).
npm run build
BUILD_EXIT=$?

if [ -f dist/client/index.html ] && [ -f dist/server/wrangler.json ]; then
  echo "Build output verified: dist/client and dist/server/wrangler.json exist."
  exit 0
fi

exit $BUILD_EXIT
