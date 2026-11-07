# City Maps

City Maps is a multi-city mapping platform built with Next.js App Router and
MapLibre GL JS. The current registry includes Tiruchirappalli (Trichy) and
Chennai, with place search, nearby categories, route alternatives, 3D buildings,
terrain, GPS positioning, live walking tracking, and responsive desktop/mobile
interfaces.

## Features

- Street, satellite, and dark map modes
- Search from Nominatim, Photon, and Overpass
- Nearby restaurants, hospitals, pharmacies, fuel, shops, temples, and hotels
- Driving, cycling, and walking routes with alternatives and turn instructions
- Route-facing car, motorcycle, and pedestrian navigation markers
- High-accuracy GPS, accuracy indicator, live position, and off-route rerouting
- Walking distance/time tracker with anti-drift filtering
- 3D buildings, terrain, layer controls, and live theme customization
- Place details, photos, opening hours, phone, website, save, and share actions
- Trichy and Chennai region switching through one URL and one registry
- Next.js JSON route handlers that can also serve a website or mobile client

## Included regions

| Region | URL |
|---|---|
| Trichy | `/?region=trichy&lng=78.7047&lat=10.7905&z=13` |
| Chennai | `/?region=chennai&lng=80.2707&lat=13.0827&z=13` |

## Quick start

Requirements: Node.js 22+, npm, and a modern browser.

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000/?region=trichy>. Browser geolocation works on
`localhost`; a deployed site must use HTTPS.

### Production build

```bash
cd frontend
npm ci
npm run build
npm run start
```

The build uses Next.js standalone output. The `postbuild` script copies the
matching `_next/static` and `public` assets into the standalone package so CSS
and JavaScript hashes cannot drift from the server bundle.

## Main URLs and APIs

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/places/search` | Text search and autocomplete |
| `GET /api/v1/places/nearby` | Category search around a coordinate |
| `GET /api/v1/places/details` | Rich details for a selected place |
| `GET /api/v1/directions` | Driving, cycling, and walking routes |
| `GET /api/v1/geocode/reverse` | Convert a map click to an address |
| `GET /styles/:name` | Map style proxy/handler |

Example:

```bash
curl "http://localhost:3000/api/v1/places/nearby?region=trichy&category=hospital&lat=10.7905&lng=78.7047&radius_meters=5000"
```

## Add another district or city

Region behavior is driven by two matching definitions:

1. `config/regions/<slug>.yaml` controls OSM extraction and data builds.
2. `frontend/lib/cities.ts` controls the live UI, bounds, search bias, and URL.

Follow [Adding a district or city](docs/ADD-A-REGION.md) for the complete
process, including bounding-box selection, build commands, validation, and a
copy-ready TypeScript example.

## Enable GPS correctly

GPS is already implemented. It requires:

- HTTPS in production (or `localhost` during development)
- browser/device Location Services enabled
- Precise Location permission for the browser or installed app
- an Android/iOS WebView configured to forward location permission

See [GPS and live navigation](docs/GPS.md) for browser, Android, iOS, privacy,
accuracy, troubleshooting, and live walking tracker details.

## Add it to another website or mobile app

You can deploy this as a standalone map, embed it with `allow="geolocation"`,
call its JSON APIs, wrap the responsive UI in a mobile WebView, or reuse the API
with MapLibre Native. See [Web and mobile integration](docs/WEB-AND-MOBILE.md)
for working examples and required Android/iOS settings.

## Deployment

See [Deployment](docs/DEPLOYMENT.md) for standalone Node deployment, reverse
proxy headers, HTTPS, environment variables, health checks, Docker services,
and production hardening.

## External data and service dependencies

The default zero-key experience calls public community services. They are ideal
for development and light use, but production traffic should use self-hosted or
contracted endpoints with caching and rate limits.

| Capability | Current source |
|---|---|
| Street basemap | OpenFreeMap / OpenStreetMap-derived data |
| Search | Nominatim, Photon, Overpass |
| Routing | routing.openstreetmap.de OSRM profiles |
| Terrain | AWS-hosted Terrarium elevation tiles |
| Place media | Wikimedia/Wikipedia and category fallback images |
| Satellite | Google tile endpoint in the current UI |

Important: Google satellite tiles are not an open-source dataset and their
undocumented tile endpoints are not suitable for an open-source production
deployment. Replace that source with imagery you are licensed to display before
publishing a production satellite mode. Do not proxy, cache, or redistribute
Google imagery without permission.

## Optional self-hosted data stack

The repository also contains a larger PostGIS, Meilisearch, Valhalla, Redis,
PMTiles, and Caddy pipeline for operators who do not want to depend on public
APIs.

```bash
cp .env.example .env
scripts/build-city.sh
docker compose --env-file .env -f docker-compose.backend.yml up -d
```

The data pipeline needs Docker, `curl`, `osmium-tool`, and substantially more
disk space than the frontend-only setup.

## Repository structure

```text
backend/                    Optional FastAPI/self-hosted service layer
config/regions/             Region extraction definitions
docs/                       Region, GPS, integration, deployment, architecture
frontend/
  app/                      Next.js pages and API route handlers
  components/CityMap.tsx    Active map interface
  lib/cities.ts             Runtime city registry
  scripts/                  Standalone build preparation
infra/caddy/                Reverse-proxy examples
scripts/                    OSM, tiles, DEM, and city build pipeline
styles/                     MapLibre style assets
```

## Validation

```bash
cd frontend
npm run typecheck
npm run build
```

## License and attribution

Application code is released under the [MIT License](LICENSE). Map and place
data retain their own licenses and attribution requirements. Keep visible
OpenStreetMap attribution when displaying OSM-derived data. Read
[Licensing and attribution](docs/LICENSING.md) before deployment.
