#!/usr/bin/env bash
# Shared helpers for the region build pipeline.
set -euo pipefail

REGIONS_DIR="${REGIONS_DIR:-config/regions}"
DATA_DIR="${DATA_DIR:-data}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: required tool '$1' not found in PATH" >&2
    exit 1
  }
}

# Resolve the active region config path from $REGION.
require_region() {
  : "${REGION:?set REGION=<slug> (see ${REGIONS_DIR}/<slug>.yaml)}"
  local cfg="${REGIONS_DIR}/${REGION}.yaml"
  [ -f "$cfg" ] || { echo "error: region config not found: $cfg" >&2; exit 1; }
  printf '%s' "$cfg"
}

# cfg <file> <yq-expression>
cfg() { yq -r "${2}" "${1}"; }

# Output/data directory for the active region (created on demand).
region_out() {
  local out="${DATA_DIR}/${REGION}"
  mkdir -p "${out}"
  printf '%s' "${out}"
}

# Absolute path of a possibly-relative path.
abspath() { (cd "$(dirname "$1")" && printf '%s/%s' "$(pwd)" "$(basename "$1")"); }

# Pick a container runtime: $CONTAINER_RUNTIME, else a working docker, else podman.
pick_runtime() {
  local r="${CONTAINER_RUNTIME:-}"
  if [ -n "$r" ]; then
    command -v "$r" >/dev/null 2>&1 || { echo "error: CONTAINER_RUNTIME=$r not found" >&2; exit 1; }
    printf '%s' "$r"; return
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then printf 'docker'; return; fi
  if command -v podman >/dev/null 2>&1; then printf 'podman'; return; fi
  echo "error: need docker or podman (or set CONTAINER_RUNTIME)" >&2; exit 1
}
