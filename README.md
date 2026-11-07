# 🗺️ City Maps — Full-Featured All-India & Multi-City Map Platform

A modern, high-performance, open-source mapping platform built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **MapLibre GL JS**, with an optional **FastAPI + PostGIS + Redis + Meilisearch** backend stack.

Features **nationwide India coverage**, 3D extruded buildings, 3D elevation terrain, satellite imagery, multi-mode routing (Car, Motorcycle, Walking), turn-by-turn navigation, real-time GPS tracking, place autocomplete, nearby category exploration, and custom compact vehicle markers.

---

## 👨‍💻 Created by **codebyabi**

Follow for tutorials, source code, and full-stack software development projects:

- **YouTube**: [youtube.com/@codebyabi](https://youtube.com/@codebyabi) (`@codebyabi`)
- **Instagram**: [instagram.com/codebyabi](https://instagram.com/codebyabi) (`@codebyabi`)

---

## ✨ Key Features

- **🗺️ Comprehensive Street Basemap**: Fast vector tiles powered by OpenFreeMap Liberty and OpenMapTiles with zero API key requirement.
- **🛰️ Satellite & Hybrid Imagery**: High-resolution satellite tiles with crisp road labels, borders, and place names.
- **🏢 3D Building Extrusions ("3D Blocks")**: Real-time GPU-rendered 3D buildings (`fill-extrusion`) with interactive click-to-inspect and custom height scaling.
- **⛰️ 3D Terrain & Hillshade**: Realistic elevation heightmaps rendered from Terrarium DEM rasters on demand.
- **🔍 Multi-Engine Search & Autocomplete**: Unified search querying **Nominatim**, **Photon (Elasticsearch)**, and **Overpass API**, with exact-match relevance scoring and nationwide India prioritization (`countrycodes=in`).
- **📍 Nearby POI Exploration**: One-tap category filters for Restaurants, ATMs & Banks, Hospitals, Pharmacies, Petrol Bunks, Shopping, Temples/Mosques/Churches, and Bus Stops with interactive map clustering.
- **🚗 Turn-by-Turn Directions & Alternatives**: Driving, motorcycle, and walking routes calculated via OSRM with step-by-step navigation instructions, alternative routes, and human-friendly duration formatting (`days`, `hours`, `minutes`).
- **🏎️ Custom Vehicle & Character Markers**:
  - **Car**: Compact 2D Yellow Mini Cooper (`SLW 287R`).
  - **Bike**: Compact 2D Yellow Vespa Scooter with Mr. Bean graphic.
  - **Walking**: Upright 3D pedestrian figurine with elevation drop shadow.
- **📍 High-Accuracy GPS & Navigation**: Live position tracking, heading direction arrow, accuracy radius indicator, off-route rerouting, and anti-drift walking distance tracker.
- **🧹 Instant Filter Reset**: Dedicated "Clear filter" chip, active category toggle-off, and search box `X` button that never overlaps or blocks navigation.
- **🎨 Map Studio & Dark Mode**: Live theme customizer (Street, Satellite, Dark mode) with configurable building, road, and water color palettes.

---

## 🌐 External APIs & Technologies Used

| Feature | Provider / Technology | Endpoint / Source | Purpose |
|---|---|---|---|
| **Street Basemap** | **OpenFreeMap / OpenMapTiles** | `https://tiles.openfreemap.org/styles/liberty` | Vector tiles, road network, boundaries, water polygons, and labels |
| **Sprites & Icons** | **OpenFreeMap Sprites** | `https://tiles.openfreemap.org/sprites/ofm_f384/ofm` | SVG map symbols, road shields, and transit badges |
| **Fonts & Glyphs** | **OpenFreeMap Fonts** | `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf` | PBF font glyphs (Noto Sans, Open Sans) rendered by MapLibre |
| **Satellite Imagery** | **Google Tile Endpoints (`lyrs=y`)** | `https://mt{0-3}.google.com/vt/lyrs=y&hl=en&gl=IN&...` | Hybrid satellite imagery + Indian administrative labels |
| **3D Buildings** | **MapLibre GL fill-extrusion** | OpenMapTiles `building` vector layer | Extrudes 3D polygon blocks at `zoom >= 14` based on building height |
| **3D Terrain DEM** | **AWS Open Data (Terrarium)** | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | RGB-encoded elevation heightmaps for 3D mountain relief |
| **Nationwide Search** | **Nominatim (OpenStreetMap)** | `https://nominatim.openstreetmap.org/search` | Resolves monuments, cities, streets, and places with `countrycodes=in` |
| **Instant Autocomplete** | **Photon (Komoot)** | `https://photon.komoot.io/api/` | Fast prefix autocomplete scored by proximity to user coordinates |
| **Nearby Places** | **Overpass API (Kumi Systems)** | `https://overpass.kumi.systems/api/interpreter` | Spatial POI queries (`around:radius,lat,lng`) for amenities |
| **Reverse Geocoding** | **Nominatim Reverse** | `https://nominatim.openstreetmap.org/reverse` | Converts coordinate clicks and GPS fixes into postal addresses |
| **Driving Routing** | **OSRM Routed-Car** | `https://routing.openstreetmap.de/routed-car/route/v1/driving` | Fast highway and road routing with turn instructions |
| **Bike Routing** | **OSRM Routed-Bike** | `https://routing.openstreetmap.de/routed-bike/route/v1/driving` | Motorcycle and bicycle paths |
| **Walking Routing** | **OSRM Routed-Foot** | `https://routing.openstreetmap.de/routed-foot/route/v1/driving` | Pedestrian paths, sidewalks, and walking time estimates |

---

## 🚀 Quick Start (Localhost)

### Prerequisites
- **Node.js 22+**
- **npm** (or pnpm / yarn / bun)

### 1. Clone & Install
```bash
git clone https://github.com/Abi-de-jo/city-maps.git
cd city-maps/frontend
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Start
```bash
npm run build
npm run start
```

The Next.js standalone server listens on port `3000` by default.

---

## 🐳 Docker Deployment

The repository includes a production-ready, resource-optimized Docker Compose configuration (`docker-compose.instabox.yml`) designed to run on any VPS or cloud VM (including **Instabox**, DigitalOcean, AWS EC2, or Hetzner).

### Services Included in Docker Stack:
- **`frontend`**: Next.js 16 standalone web application (Port `3000`).
- **`backend`**: FastAPI API Gateway with Uvicorn (Port `8000`).
- **`postgis`**: PostGIS 16-3.4 database initialized with `init.sql` schema (Port `5432`).
- **`redis`**: Redis 7.4 cache & rate limiter (Port `6379`).
- **`meilisearch`**: Meilisearch v1.11 fast search engine (Port `7700`).

### Run with Docker Compose:
```bash
# Start all services
docker compose -f docker-compose.instabox.yml up -d --build

# Check container status
docker compose -f docker-compose.instabox.yml ps

# Check logs
docker compose -f docker-compose.instabox.yml logs -f frontend
```

### Expose with SSL (HTTPS) on Instabox:
Browser Geolocation (`navigator.geolocation`) requires HTTPS in production. On an Instabox server:
```bash
instabox-port publish 3000 --name "City Maps Web"
instabox-port publish 8000 --name "City Maps API"
```
This automatically provisions public TLS certificates (`https://3000-<machineId>.instabox.tech`).

---

## 🛠️ How to Add New Features

### 1. Adding a New City / Region
Regions are configured in `frontend/lib/cities.ts`. To add a new city (e.g. Pune or Ahmedabad):

```ts
// frontend/lib/cities.ts
export const CITIES: Record<string, CityConfig> = {
  // Existing cities...
  pune: {
    id: "pune",
    name: "Pune",
    searchName: "Pune",
    center: [73.8567, 18.5204],
    zoom: 12,
    bounds: [[65.0, 5.0], [100.0, 38.0]], // Full India camera envelope
    bbox: [73.75, 18.40, 73.98, 18.62],
    defaultOrigin: [73.8567, 18.5204],
    defaultOriginLabel: "Pune City Centre",
  },
};
```
The new city will automatically appear in the Map Studio quick-switch buttons and URL parameters (`/?region=pune`).

---

### 2. Adding a New Nearby Category Filter
1. Define the OpenStreetMap tag filter in `frontend/app/api/v1/places/nearby/route.ts`:
   ```ts
   const CATEGORY_MAP: Record<string, string> = {
     // Existing categories...
     ev_charging: '["amenity"="charging_station"]',
   };
   ```
2. Add the UI button to `CATEGORIES` in `frontend/components/CityMap.tsx`:
   ```ts
   const CATEGORIES = [
     // Existing chips...
     ["ev_charging", "EV Charging"],
   ] as const;
   ```
3. Add a matching map pin icon in `poiMarkerPresentation`:
   ```ts
   if (value === "ev_charging") {
     return { kind: "fuel", icon: svgIcon('<path d="..."/>') };
   }
   ```

---

### 3. Customizing Vehicle Markers
Vehicle images are stored in `frontend/public/`:
- `frontend/public/car-marker.png`: 2D image for car driving mode.
- `frontend/public/bike-marker.png`: 2D image for motorcycle / bike mode.

To change them:
1. Place a transparent PNG in `frontend/public/`.
2. Update the `width`, `height`, and image path in `getOrigin3DMarkerHTML()` in `frontend/components/CityMap.tsx`.

---

### 4. Adding Backend Endpoints (FastAPI)
The backend is located in `backend/app/`:
- `main.py`: App initialization, rate limiting, and CORS.
- `places.py`: Place queries, indexing, and reviews.
- `directions.py`: Route calculations.
- `traffic.py`: Traffic overrides and live speeds.
- `geocode.py`: Reverse geocoding.

Add a new router and register it in `backend/app/main.py`:
```python
app.include_router(my_new_router, prefix="/api/v1")
```
Interactive Swagger docs are accessible at `http://localhost:8000/api/docs`.

---

## 📁 Repository Structure

```text
├── backend/                         # FastAPI Python backend microservice
│   ├── app/
│   │   ├── main.py                  # API entry point & CORS
│   │   ├── config.py                # Pydantic Settings
│   │   ├── directions.py            # Directions & routing router
│   │   ├── places.py                # Place search & reviews router
│   │   ├── traffic.py               # Traffic speed overrides router
│   │   └── geocode.py               # Reverse geocoding router
│   ├── sql/init.sql                 # PostGIS schema and triggers
│   └── Dockerfile                   # Python 3.12 multi-stage Docker build
│
├── frontend/                        # Next.js 16 Web Application
│   ├── app/
│   │   ├── page.tsx                 # Root map page with region resolver
│   │   ├── layout.tsx               # Root layout & font metadata
│   │   ├── globals.css              # Map styling, UI controls, animations
│   │   └── api/v1/                  # Built-in Next.js route handlers
│   │       ├── directions/route.ts  # OSRM routing with human duration
│   │       ├── places/search/       # Multi-provider nationwide search
│   │       ├── places/nearby/       # Overpass nearby POI query
│   │       ├── places/details/      # Place details & Wikimedia photos
│   │       └── geocode/reverse/     # Nominatim reverse geocoder
│   ├── components/
│   │   ├── CityMap.tsx              # Core MapLibre interactive canvas
│   │   ├── DirectionsDrawer.tsx     # Route planning drawer
│   │   ├── PlaceDetailsSheet.tsx    # Bottom sheet place details
│   │   └── MapCanvas.tsx            # Standalone map canvas
│   ├── lib/
│   │   ├── cities.ts                # City & all-India registry
│   │   └── api.ts                   # Frontend API client
│   ├── public/
│   │   ├── car-marker.png           # Compact 2D Yellow Mini Cooper
│   │   ├── bike-marker.png          # Compact 2D Yellow Vespa Scooter
│   │   └── maplibre-gl-worker.mjs   # Standalone MapLibre web worker
│   └── Dockerfile                   # Node 22 Alpine standalone Docker build
│
├── docker-compose.instabox.yml      # Production stack (Frontend + Backend + PostGIS + Redis + Meilisearch)
├── docker-compose.backend.yml       # Local backend development compose
├── Makefile                         # Helper build commands
└── README.md                        # Documentation
```

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Map and imagery data retain their respective licenses:
- OpenStreetMap data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL).
- Vector tiles powered by [OpenFreeMap](https://openfreemap.org).
- Routing data powered by [OSRM](https://project-osrm.org).

---

## 🌟 Support & Community

If you find this project helpful, please **star the repository ⭐** and subscribe to the channels:

- 📺 **YouTube**: [@codebyabi](https://youtube.com/@codebyabi)
- 📸 **Instagram**: [@codebyabi](https://instagram.com/codebyabi)
