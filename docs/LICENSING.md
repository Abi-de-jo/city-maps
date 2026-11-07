# Licensing & attribution

## Required in the product

- **OpenStreetMap** — data is © OpenStreetMap contributors, licensed **ODbL**.
  You MUST display **"© OpenStreetMap contributors"**. The basemap source in
  `styles/google-like.json` carries this attribution; keep it visible in the UI.
  If you publicly distribute a derived *database* (e.g. the PMTiles DB), ODbL's
  share-alike applies to that database.
- **Elevation** — check and display the attribution required by the elevation
  provider configured for the deployment.

## Our code

- Application/rendering code: MIT; see `LICENSE`.

## Third-party software (self-hosted, do not vendor data)

- MapLibre GL JS — BSD-3-Clause
- Planetiler — Apache-2.0
- Valhalla — MIT
- Photon — Apache-2.0
- Meilisearch — MIT
- Caddy — Apache-2.0

## Satellite imagery

The current demonstration UI contains Google satellite tile URLs. Those tiles
are not open data and are not covered by this repository's MIT license. Do not
ship, proxy, cache, or redistribute them without a license and terms that allow
your use case. Replace the source with an imagery provider you are authorized to
use before a public production deployment.

## Do NOT

- Treat third-party imagery as part of the open-source code license.
- Redistribute Google imagery (satellite/Street View).
- Strip attribution from OSM-derived output.
