# Architecture

## Target hardware

| Box | Spec | Role |
|---|---|---|
| Node A | 40 vCPU / 40 GB RAM / 200 GB SSD | build pipeline, PostGIS, Meilisearch, Photon, Valhalla, Redis, and API |
| Oracle Always Free | 4 ARM OCPU / 24 GB / up to 200 GB / 10 TB egress | static edge: web app + PMTiles tiles |

For a small town the whole dataset is tiny (see storage budget), so the main box
has large headroom. The Oracle split exists mainly to keep static egress free.

## Services

- **Basemap** — Planetiler builds `basemap.pmtiles` (OpenMapTiles schema) from the
  clipped OSM extract. PMTiles is a single static file read via HTTP Range requests,
  so it needs no tile server.
- **Frontend** — MapLibre GL JS (+ `pmtiles` protocol). Handles rotation, tilt, and
  3D building extrusions.
- **Style** — `styles/google-like.json`, a MapLibre style tuned to Google's palette.
- **Search / geocoding** — Meilisearch for instant ranked autocomplete, PostGIS
  for the nearest local feature, and Photon as reverse-geocoding fallback.
- **Place details** — PostgreSQL/PostGIS loaded with OSM POI tags plus local listings and reviews.
- **Routing** — Valhalla; car, motorbike, bike, and walk,
  turn-by-turn, ETAs, isochrones.
- **Gateway** — FastAPI fronts search, routing, places, reviews, reverse geocoding, and traffic with Redis rate limiting.

## Data flow

```
OSM extract ──clip──▶ region.osm.pbf ──Planetiler──▶ basemap.pmtiles ─▶ Caddy/CDN ─▶ browser
                                    └──Valhalla────▶ valhalla_tiles ──▶ /route
                                    └──osm2pgsql───▶ PostGIS ─▶ Meilisearch + Photon ─▶ /api/v1
```

## Storage budget (small town, 100 GB SSD)

| Item | Est. |
|---|---|
| OS + Docker images | ~20 GB |
| OSM pbf + working files | ~1 GB |
| PostgreSQL/PostGIS | ~3–8 GB |
| Valhalla tiles | ~1 GB |
| PMTiles basemap | ~0.5–2 GB |
| DEM | ~1 GB |
| Cache/logs/headroom | ~10 GB |
| **Total** | **~37–43 GB** |

## Freshness

A town rebuild is handled by `scripts/build-city.sh`. Run it on an operator-defined
schedule when a newer regional extract is available.

## Scaling to more regions

- Tiles + web go to object storage (S3/R2/B2) behind a CDN.
- One routing + one geocode instance per shard; the gateway routes by region.
- Heavy builds stay on a large machine; contributors can publish regions
  independently. Planet-scale on these two boxes is out of scope.
