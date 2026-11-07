# Adding a district or city

A region needs one data-pipeline file and one frontend registry entry. Use a
lowercase URL-safe slug such as `madurai`, `coimbatore`, or `salem`.

## 1. Choose coordinates

Collect the center `[longitude, latitude]`, bounding box
`[minLongitude, minLatitude, maxLongitude, maxLatitude]`, camera bounds, and a
recognizable default route origin. MapLibre coordinate arrays use longitude
first. Route query strings use `lat,lng` where explicitly documented.

## 2. Add the pipeline config

```bash
cp config/regions/trichy.yaml config/regions/madurai.yaml
```

```yaml
name: Madurai
slug: madurai

osm:
  source: "https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf"
  clip: bbox
  bbox: [78.00, 9.80, 78.30, 10.10]

view:
  center: [78.1198, 9.9252]
  zoom: 13

map:
  max_bounds: [[77.90, 9.70], [78.40, 10.20]]
```

Use a polygon boundary instead of a bbox when administrative-border precision
is required. Keep the source extract as small as possible.

## 3. Register it in the application

Open `frontend/lib/cities.ts`, extend the ID union:

```ts
id: "trichy" | "chennai" | "madurai";
```

Add the city inside `CITIES`:

```ts
madurai: {
  id: "madurai",
  name: "Madurai",
  searchName: "Madurai",
  center: [78.1198, 9.9252],
  zoom: 13,
  bounds: [[77.90, 9.70], [78.40, 10.20]],
  bbox: [78.00, 9.80, 78.30, 10.10],
  defaultOrigin: [78.1198, 9.9252],
  defaultOriginLabel: "Madurai city centre",
},
```

Use a scalable resolver:

```ts
export function getCity(value: string | null | undefined): CityConfig {
  return value && value in CITIES
    ? CITIES[value as CityConfig["id"]]
    : CITIES.trichy;
}
```

The city selector, search bbox, nearby queries, reverse geocoding, and deep
links then use the selected configuration automatically.

## 4. Run and test

```bash
cd frontend
npm run typecheck
npm run dev
```

Open `http://localhost:3000/?region=madurai&lng=78.1198&lat=9.9252&z=13`.
Test search, categories, map clicks, routes, GPS, and camera limits.

## 5. Build self-hosted data (optional)

The online frontend does not require local PMTiles. Build local data only for
the self-hosted stack:

```bash
make basemap REGION=madurai
REGION=madurai scripts/build-city.sh
```

Generated data belongs under `data/` and is ignored by Git.

## Production checklist

- Confirm coordinates and bounds cover the district.
- Confirm all routing profiles work locally.
- Keep OpenStreetMap attribution visible.
- Test GPS over HTTPS on a real phone.
- Verify provider policies and rate limits.
- Run typecheck and production build.
- Add the region URL to web/mobile deep links.
