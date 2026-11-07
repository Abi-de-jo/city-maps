#!/usr/bin/env bash
# Download the OSM source extract and clip it down to the region.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

need curl; need yq

cfgfile="$(require_region)"
out="$(region_out)"
src="$(cfg "$cfgfile" '.osm.source')"

echo "==> source: ${src}"
curl -fL --retry 3 --retry-delay 5 -o "${out}/source.osm.pbf" "${src}"

poly="$(cfg "$cfgfile" '.osm.boundary_file // ""')"
bbox="$(yq -r '.osm.bbox | join(",")' "$cfgfile" 2>/dev/null || echo "")"
clip="$(cfg "$cfgfile" '.osm.clip // "auto"')"

use_poly=false; use_bbox=false
case "${clip}" in
  polygon) use_poly=true ;;
  bbox)    use_bbox=true ;;
  none)    : ;;
  auto)
    if [ -n "${poly}" ] && [ "${poly}" != "null" ] && [ -f "${poly}" ]; then use_poly=true
    elif [ -n "${bbox}" ] && [ "${bbox}" != "null" ]; then use_bbox=true; fi ;;
  *) echo "error: unknown osm.clip='${clip}' (auto|polygon|bbox|none)" >&2; exit 1 ;;
esac

if [ "${use_poly}" = true ]; then
  need osmium
  echo "==> clipping to boundary: ${poly}"
  osmium extract --overwrite -p "${poly}" -o "${out}/region.osm.pbf" "${out}/source.osm.pbf"
  rm -f "${out}/source.osm.pbf"
elif [ "${use_bbox}" = true ]; then
  need osmium
  echo "==> clipping to bbox: ${bbox}"
  osmium extract --overwrite -b "${bbox}" -o "${out}/region.osm.pbf" "${out}/source.osm.pbf"
  rm -f "${out}/source.osm.pbf"
else
  echo "==> clip disabled; using the source extract as-is"
  mv "${out}/source.osm.pbf" "${out}/region.osm.pbf"
fi

echo "==> wrote ${out}/region.osm.pbf"
ls -lh "${out}/region.osm.pbf"
