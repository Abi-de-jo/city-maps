import type { Coordinate, Place, PlacePrediction, RoutePoint, RouteResult, TravelMode } from "./types";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(body.detail ?? "The map service could not complete this request.");
  }
  return response.json() as Promise<T>;
}

export async function autocomplete(
  query: string,
  center: Coordinate,
  category?: string,
): Promise<PlacePrediction[]> {
  const params = new URLSearchParams({
    q: query,
    lat: String(center.lat),
    lng: String(center.lng),
    radius_meters: "50000",
  });
  if (category) params.set("category", category);
  const data = await request<{ predictions: Array<Omit<PlacePrediction, "location"> & { lat: number; lng: number; location?: Coordinate }> }>(`/places/autocomplete?${params}`);
  return data.predictions.map((place) => ({ ...place, location: place.location ?? { lat: place.lat, lng: place.lng } }));
}

export async function nearby(center: Coordinate, category: string): Promise<PlacePrediction[]> {
  const params = new URLSearchParams({
    lat: String(center.lat), lng: String(center.lng), radius_meters: "10000",
    category, limit: "30",
  });
  const data = await request<{ places: Array<Omit<PlacePrediction, "location"> & { lat: number; lng: number; location?: Coordinate }> }>(`/places/nearby?${params}`);
  return data.places.map((place) => ({ ...place, location: place.location ?? { lat: place.lat, lng: place.lng } }));
}

export function getPlace(placeId: string): Promise<Place> {
  return request<Place>(`/places/${encodeURIComponent(placeId)}`);
}

export async function reverseGeocode(point: Coordinate): Promise<Place> {
  const place = await request<Place>(`/geocode/reverse?lat=${point.lat}&lng=${point.lng}`);
  return { ...place, location: place.location ?? { lat: place.lat ?? point.lat, lng: place.lng ?? point.lng } };
}

export async function getDirections(
  origin: RoutePoint,
  destination: RoutePoint,
  waypoints: RoutePoint[],
  mode: TravelMode,
): Promise<RouteResult[]> {
  const params = new URLSearchParams({
    origin: `${origin.location.lat},${origin.location.lng}`,
    destination: `${destination.location.lat},${destination.location.lng}`,
    mode,
    alternatives: "true",
  });
  if (waypoints.length) {
    params.set("waypoints", waypoints.map((point) => `${point.location.lat},${point.location.lng}`).join("|"));
  }
  type ApiStep = { instruction: string; distance_meters: number; duration_seconds: number; maneuver: string; location: [number, number] };
  type ApiRoute = { summary: string; distance_meters: number; duration_seconds: number; geometry: GeoJSON.LineString; steps: ApiStep[] };
  const data = await request<{ routes: ApiRoute[] | RouteResult[] }>(`/directions?${params}`);
  return data.routes.map((route) => {
    if ("overview_polyline" in route) return route;
    const coordinates = route.geometry.coordinates;
    const lngs = coordinates.map((coordinate) => coordinate[0]);
    const lats = coordinates.map((coordinate) => coordinate[1]);
    return {
      summary: route.summary,
      distance_meters: route.distance_meters,
      duration_seconds: route.duration_seconds,
      traffic_duration_seconds: route.duration_seconds,
      bounds: {
        southwest: { lat: Math.min(...lats), lng: Math.min(...lngs) },
        northeast: { lat: Math.max(...lats), lng: Math.max(...lngs) },
      },
      overview_polyline: { encoding: "polyline6" as const, points: "", geojson: route.geometry },
      legs: [{
        distance_meters: route.distance_meters,
        duration_seconds: route.duration_seconds,
        steps: route.steps.map((step, index) => ({
          maneuver: step.maneuver,
          street_name: step.instruction,
          distance_meters: step.distance_meters,
          duration_seconds: step.duration_seconds,
          voice_instruction: step.instruction,
          begin_shape_index: index,
          end_shape_index: index + 1,
        })),
      }],
    };
  });
}

export function submitReview(
  placeId: string,
  review: { author_name: string; rating: number; text: string },
) {
  return request(`/places/${placeId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
}

export function getTraffic(): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
  return request("/traffic");
}
