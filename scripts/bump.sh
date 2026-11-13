#!/bin/sh
# Cache-busting: stamp every local file URL with a fresh ?v= so browsers
# (and GitHub Pages' 10 minute cache) always load matching new files.
# Run before every commit:  sh scripts/bump.sh
cd "$(dirname "$0")/.." || exit 1
V=$(date +%Y%m%d%H%M%S)
for f in index.html js/*.js; do
  sed -i '' -E "s/\?v=[A-Za-z0-9]+/?v=$V/g" "$f"
done
echo "version $V"
