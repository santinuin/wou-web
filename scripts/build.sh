#!/bin/bash
set -e
npm run build
node scripts/patch-wrangler-output.cjs
