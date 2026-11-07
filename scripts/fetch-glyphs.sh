#!/usr/bin/env bash
# Cache the open MapLibre demo glyphs used by the bundled map style.
set -euo pipefail

base_url="${GLYPH_SOURCE_URL:-https://demotiles.maplibre.org/font}"
font="Noto Sans Regular"
target="frontend/public/fonts/${font}"
mkdir -p "$target"

for range in 0-255 256-511; do
  encoded_font="Noto%20Sans%20Regular"
  curl --fail --location --retry 3 \
    --output "$target/${range}.pbf" "$base_url/$encoded_font/$range.pbf"
done

echo "Cached local glyph ranges in $target"
