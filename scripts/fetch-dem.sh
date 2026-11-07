#!/usr/bin/env bash
# Fetch Copernicus GLO-30 DEM tiles covering the region's bbox.
# Source: AWS Open Data bucket s3://copernicus-dem-30m (no credentials needed).
set -euo pipefail
source "$(dirname "$0")/lib.sh"

need yq; need aws

cfgfile="$(require_region)"
out="$(region_out)"
demdir="${out}/dem"
mkdir -p "${demdir}"

read -r minlon minlat maxlon maxlat < <(yq -r '.osm.bbox | @tsv' "$cfgfile")

flr() { awk -v v="$1" 'BEGIN{ f=int(v); if (v<0 && v!=f) f--; printf "%d", f }'; }
pad2() { printf '%02d' "${1#-}"; }
pad3() { printf '%03d' "${1#-}"; }

tile_name() {
  local lat="$1" lon="$2" ns ew
  [ "$lat" -ge 0 ] && ns="N" || ns="S"
  [ "$lon" -ge 0 ] && ew="E" || ew="W"
  printf 'Copernicus_DSM_COG_10_%s%s_00_%s%s_00_DEM.tif' \
    "$ns" "$(pad2 "$lat")" "$ew" "$(pad3 "$lon")"
}

for ((lat = $(flr "$minlat"); lat <= $(flr "$maxlat"); lat++)); do
  for ((lon = $(flr "$minlon"); lon <= $(flr "$maxlon"); lon++)); do
    name="$(tile_name "$lat" "$lon")"
    echo "==> ${name}"
    aws s3 cp --no-sign-request --only-show-errors \
      "s3://copernicus-dem-30m/${name}" "${demdir}/${name}"
  done
done

echo "==> DEM tiles in ${demdir}"
ls -1 "${demdir}"
