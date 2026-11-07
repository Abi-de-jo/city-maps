import { NextRequest, NextResponse } from "next/server";

type OsrmStep = {
  name?: string;
  distance?: number;
  duration?: number;
  maneuver?: { type?: string; modifier?: string; location?: [number, number] };
};

const OSRM_SERVERS: Record<"driving" | "cycling" | "walking", string> = {
  driving: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  cycling: "https://routing.openstreetmap.de/routed-bike/route/v1/driving",
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/driving",
};

function parseCoordinate(value: string) {
  const parts = value.split(",").map(Number);
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return null;
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function buildInstruction(step: OsrmStep): string {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier || "";
  const road = step.name ? ` onto ${step.name}` : "";
  if (type === "depart") return `Head ${modifier || "forward"}${road}`;
  if (type === "arrive") return "Arrive at destination";
  if (type === "roundabout" || type === "rotary") return `Take the roundabout${road}`;
  if (type === "turn") return `Turn ${modifier}${road}`;
  if (type === "new name" || type === "continue") return `Continue ${modifier}${road}`;
  return `${type || "Continue"} ${modifier}${road}`.trim();
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const mode = searchParams.get("mode") || "driving";
  const bearing = searchParams.get("bearing");

  if (!origin || !destination) {
    return NextResponse.json({ status: "INVALID_REQUEST", error: "origin and destination required", routes: [] }, { status: 400 });
  }

  const start = parseCoordinate(origin);
  const end = parseCoordinate(destination);
  if (!start || !end) {
    return NextResponse.json({ status: "INVALID_REQUEST", error: "Coordinates must use valid lat,lng values", routes: [] }, { status: 400 });
  }
  if (!new Set(["driving", "cycling", "walking"]).has(mode)) {
    return NextResponse.json({ status: "INVALID_REQUEST", error: "Unsupported travel mode", routes: [] }, { status: 400 });
  }

  const heading = bearing === null ? null : Number(bearing);
  const bearingsParam = heading !== null && Number.isFinite(heading)
    ? `&bearings=${Math.round(((heading % 360) + 360) % 360)},45;0,180`
    : "";

  try {
    const baseUrl = OSRM_SERVERS[mode as keyof typeof OSRM_SERVERS] || OSRM_SERVERS.driving;
    const url =
      `${baseUrl}/${start.lng},${start.lat};${end.lng},${end.lat}` +
      `?overview=full&geometries=geojson&steps=true&alternatives=3&annotations=speed,duration,distance&continue_straight=true${bearingsParam}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) throw new Error(`Routing service returned HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      return NextResponse.json({ status: "ZERO_RESULTS", routes: [] }, { status: 404 });
    }

    const routes = data.routes.slice(0, 3).map((route: any, index: number) => {
      const leg = route.legs?.[0];
      const adjustedDuration = Math.round(route.duration);
      const coordinates: [number, number][] = route.geometry.coordinates;
      const midpoint = coordinates[Math.floor(coordinates.length / 2)] || [start.lng, start.lat];
      return {
        route_index: index,
        is_fastest: index === 0,
        summary: leg?.summary || `Route ${index + 1}`,
        distance_meters: Math.round(route.distance),
        distance_text: route.distance >= 1000 ? `${(route.distance / 1000).toFixed(1)} km` : `${Math.round(route.distance)} m`,
        duration_seconds: adjustedDuration,
        duration_text: formatDuration(adjustedDuration),
        midpoint_lnglat: midpoint,
        snapped_origin: data.waypoints?.[0]?.location || [start.lng, start.lat],
        snapped_destination: data.waypoints?.[1]?.location || [end.lng, end.lat],
        geometry: route.geometry,
        steps: (leg?.steps || []).map((step: OsrmStep) => ({
          instruction: buildInstruction(step),
          road_name: step.name || "Local Road",
          distance_meters: Math.round(step.distance || 0),
          duration_seconds: Math.round(step.duration || 0),
          maneuver_type: step.maneuver?.type || "straight",
          maneuver_modifier: step.maneuver?.modifier || "",
          location: step.maneuver?.location,
        })),
      };
    });
    return NextResponse.json({ status: "OK", routes });
  } catch (error) {
    return NextResponse.json(
      { status: "ERROR", routes: [], error: error instanceof Error ? error.message : "Routing failed" },
      { status: 502 },
    );
  }
}
