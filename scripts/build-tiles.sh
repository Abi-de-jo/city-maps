#!/usr/bin/env bash
# Build a vector basemap (PMTiles) from the clipped region extract.
# Uses Planetiler (OpenMapTiles schema) in a container — a town builds in minutes.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

runtime="$(pick_runtime)"

cfgfile="$(require_region)"
out="$(region_out)"
out_abs="$(abspath "${out}")"
heap="${TILES_HEAP:-8g}"

[ -f "${out}/region.osm.pbf" ] || { echo "error: run 'make fetch REGION=${REGION}' first" >&2; exit 1; }

sources_dir="${out}/sources"
mkdir -p "${sources_dir}"

# If a local water-polygons file is present, use it instead of downloading from
# osmdata.openstreetmap.de (needed where that host is unreachable; see
# scripts/make-empty-water-polygons.py). Inland water still comes from OSM.
water_args=()
if [ -f "${sources_dir}/water-polygons-split-3857.zip" ]; then
  echo "==> using local water-polygons placeholder"
  water_args=(--water_polygons_path=/data/sources/water-polygons-split-3857.zip --download_water_polygons=false)
fi

echo "==> planetiler -> ${out}/basemap.pmtiles (heap ${heap}, runtime ${runtime})"
"${runtime}" run --rm \
  -e JAVA_TOOL_OPTIONS="-Xmx${heap}" \
  -v "${out_abs}:/data" \
  ghcr.io/onthegomap/planetiler:latest \
    --osm-path=/data/region.osm.pbf \
    --output=/data/basemap.pmtiles \
    --download_dir=/data/sources \
    --download --force "${water_args[@]}"

echo "==> wrote ${out}/basemap.pmtiles"
ls -lh "${out}/basemap.pmtiles"
