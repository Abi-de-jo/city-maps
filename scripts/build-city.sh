#!/usr/bin/env bash
# Build a configured city dataset. Set CITY_SLUG=chennai to build Chennai and
# OSM_SOURCE_MODE=overpass to use a direct bounding-box download.
set -euo pipefail

source "$(dirname "$0")/lib.sh"

city_slug="${CITY_SLUG:-trichy}"
case "$city_slug" in
  trichy)
    city_name="Tiruchirappalli"
    default_bbox="78.55,10.68,78.85,10.95"
    ;;
  chennai)
    city_name="Chennai"
    default_bbox="79.95,12.75,80.40,13.35"
    ;;
  *)
    echo "error: CITY_SLUG must be 'trichy' or 'chennai'" >&2
    exit 64
    ;;
esac
bbox="${CITY_BBOX:-$default_bbox}"
source_mode="${OSM_SOURCE_MODE:-geofabrik}"
geofabrik_url="${OSM_PBF_URL:-https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf}"
runtime="$(pick_runtime)"

need curl
need osmium

data_dir="data"
work_dir="${data_dir}/${city_slug}-build"
region_pbf="${data_dir}/${city_slug}.osm.pbf"
pmtiles_file="${data_dir}/${city_slug}.pmtiles"
mkdir -p "$work_dir/planetiler" "${data_dir}/${city_slug}/valhalla" "${data_dir}/${city_slug}/osrm"

if [ "$source_mode" = "overpass" ]; then
  echo "==> Downloading ${city_name} OSM XML from Overpass"
  curl --fail --location --retry 4 --output "${data_dir}/${city_slug}.osm" \
    "https://overpass-api.de/api/map?bbox=${bbox}"
  osmium cat "${data_dir}/${city_slug}.osm" --overwrite --output "$region_pbf"
elif [ "$source_mode" = "geofabrik" ]; then
  echo "==> Downloading the Geofabrik Southern Zone extract"
  source_pbf="${work_dir}/southern-zone-latest.osm.pbf"
  curl --fail --location --retry 4 --continue-at - --output "$source_pbf" "$geofabrik_url"
  echo "==> Cropping the exact ${city_name} bounding box ${bbox}"
  osmium extract --bbox "$bbox" --strategy complete_ways --overwrite \
    --output "$region_pbf" "$source_pbf"
else
  echo "error: OSM_SOURCE_MODE must be 'geofabrik' or 'overpass'" >&2
  exit 64
fi

osmium fileinfo --extended "$region_pbf"
data_abs="$(cd "$data_dir" && pwd)"

echo "==> Building data/${city_slug}.pmtiles with Planetiler"
"$runtime" run --rm --memory=12g -e JAVA_TOOL_OPTIONS=-Xmx10g \
  -v "$data_abs:/data" ghcr.io/onthegomap/planetiler:latest \
  --osm-path="/data/${city_slug}.osm.pbf" --output="/data/${city_slug}.pmtiles" \
  --download --force --download_dir="/data/${city_slug}-build/planetiler"

scripts/fetch-glyphs.sh

echo "==> Building OSRM MLD graphs for car, bicycle, and pedestrian routing"
for profile in car bicycle foot; do
  profile_dir="${data_dir}/${city_slug}/osrm/${profile}"
  mkdir -p "$profile_dir"
  cp "$region_pbf" "${profile_dir}/${city_slug}.osm.pbf"
  profile_abs="$(cd "$profile_dir" && pwd)"
  "$runtime" run --rm --memory=6g -v "$profile_abs:/data" osrm/osrm-backend:v5.27.1 \
    osrm-extract -p "/opt/${profile}.lua" "/data/${city_slug}.osm.pbf"
  "$runtime" run --rm --memory=6g -v "$profile_abs:/data" osrm/osrm-backend:v5.27.1 \
    osrm-partition "/data/${city_slug}.osrm"
  "$runtime" run --rm --memory=6g -v "$profile_abs:/data" osrm/osrm-backend:v5.27.1 \
    osrm-customize "/data/${city_slug}.osrm"
done

echo "==> Building the Valhalla multi-profile graph used by the unified API"
cp "$region_pbf" "${data_dir}/${city_slug}/valhalla/${city_slug}.osm.pbf"
valhalla_abs="$(cd "${data_dir}/${city_slug}/valhalla" && pwd)"
"$runtime" run --rm --memory=6g \
  -e tile_urls="" -e build_tiles=True -e serve_tiles=False -e force_rebuild=True \
  -e build_admins=True -e build_time_zones=True \
  -v "$valhalla_abs:/custom_files" \
  ghcr.io/gis-ops/docker-valhalla/valhalla:latest

echo "==> Starting PostGIS, Redis, and Meilisearch"
CITY_SLUG="$city_slug" CITY_NAME="$city_name" CITY_BBOX="$bbox" docker compose -f docker-compose.backend.yml \
  up -d --wait postgis redis meilisearch

echo "==> Importing ${city_name} roads, buildings, and POIs into PostGIS"
CITY_SLUG="$city_slug" CITY_NAME="$city_name" docker compose -f docker-compose.backend.yml --profile tools run --rm importer \
  --create --slim --drop --hstore-all --multi-geometry --latlong \
  --host postgis --port 5432 --username "${POSTGRES_USER:-maps}" \
  --database "${POSTGRES_DB:-maps}" "/maps/${city_slug}.osm.pbf"

echo "==> Syncing amenities, shops, tourism, offices, healthcare, and bus stops"
CITY_SLUG="$city_slug" CITY_NAME="$city_name" CITY_BBOX="$bbox" docker compose -f docker-compose.backend.yml build api
CITY_SLUG="$city_slug" CITY_NAME="$city_name" CITY_BBOX="$bbox" docker compose -f docker-compose.backend.yml \
  run --rm --no-deps api python scripts/sync_places.py

echo "==> ${city_name} build complete"
ls -lh "$region_pbf" "$pmtiles_file" "${data_dir}/${city_slug}/osrm/car/${city_slug}.osrm"
