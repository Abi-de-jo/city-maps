import { NextRequest, NextResponse } from "next/server";
import { getCity } from "@/lib/cities";
import { queryOverpass } from "@/lib/overpass";

const CATEGORY_MAP: Record<string, string> = {
  restaurant: '["amenity"~"restaurant|cafe|fast_food|food_court|ice_cream|bakery"]',
  atm: '["amenity"~"atm|bank"]',
  hospital: '["amenity"~"hospital|clinic|doctors"]',
  pharmacy: '["amenity"="pharmacy"]',
  fuel: '["amenity"="fuel"]',
  hotel: '["tourism"~"hotel|guest_house|hostel"]',
  shopping: '["shop"~"supermarket|mall|convenience|clothes|electronics|jewelry|department_store"]',
  temple: '["amenity"="place_of_worship"]["religion"="hindu"]["name"]',
  bus: '["highway"="bus_stop"]',
};

const GENERIC_TEMPLE_NAMES = new Set(["temple", "hindu temple", "place of worship", "amman kovil", "shivan kovil"]);

function isNamedTemple(name: string, type?: string) {
  const normalized = name.trim().toLowerCase();
  return type === "place_of_worship" && !GENERIC_TEMPLE_NAMES.has(normalized) && !normalized.includes("pond");
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

function toNearbyPlace(element: any, category: string, lat: number, lng: number, cityName: string) {
  const placeLat = element.lat ?? element.center?.lat;
  const placeLng = element.lon ?? element.center?.lon;
  if (!placeLat || !placeLng) return null;
  const name = element.tags?.name || element.tags?.["name:en"] || element.tags?.["name:ta"] || "Local Place";
  const placeCategory = element.tags?.amenity || element.tags?.shop || element.tags?.tourism || category;
  if (category === "temple" && !isNamedTemple(name, placeCategory)) return null;
  return {
    place_id: `osm_${element.type}_${element.id}`,
    name,
    category: placeCategory,
    address: [element.tags?.["addr:housenumber"], element.tags?.["addr:street"], element.tags?.["addr:suburb"], element.tags?.["addr:city"] || cityName].filter(Boolean).join(", ") || `${cityName}, Tamil Nadu`,
    lat: placeLat,
    lng: placeLng,
    phone: element.tags?.phone || element.tags?.["contact:phone"] || null,
    website: element.tags?.website || element.tags?.["contact:website"] || null,
    opening_hours: element.tags?.opening_hours || null,
    distance_meters: distanceMeters(lat, lng, placeLat, placeLng),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = getCity(searchParams.get("region"));
  const lat = parseFloat(searchParams.get("lat") || String(city.center[1]));
  const lng = parseFloat(searchParams.get("lng") || String(city.center[0]));
  const radius = Math.min(Math.max(parseInt(searchParams.get("radius_meters") || "5000", 10) || 5000, 100), 15000);
  const category = (searchParams.get("category") || "restaurant").toLowerCase();
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "40", 10) || 40, 1), 200);
  const safeCategory = category.replace(/[^a-z_]/g, "") || "restaurant";
  const osmFilter = CATEGORY_MAP[safeCategory] || `["amenity"="${safeCategory}"]`;
  const overpassLimit = Math.min(Math.max(limit * 10, 200), 500);
  const query = `[out:json][timeout:10];(node${osmFilter}(around:${radius},${lat},${lng});way${osmFilter}(around:${radius},${lat},${lng}););out center tags ${overpassLimit};`;

  try {
    const elements = await queryOverpass(query, 10_000).catch(() => [] as any[]);
    const unique = new globalThis.Map<string, any>();
    for (const element of elements) {
      const place = toNearbyPlace(element, safeCategory, lat, lng, city.searchName);
      if (place) unique.set(place.place_id, place);
    }
    const places = Array.from(unique.values()).sort((left, right) => left.distance_meters - right.distance_meters).slice(0, limit);
    if (places.length > 0) {
      return NextResponse.json({ status: "OK", count: places.length, places, source: "overpass" });
    }
  } catch {}

  const terms = safeCategory === "temple" ? ["temple", "kovil"] : [safeCategory];
  const latitudeDegrees = radius / 111_320;
  const longitudeDegrees = radius / (111_320 * Math.cos(lat * Math.PI / 180));
  const minLon = Math.max(-180, lng - longitudeDegrees);
  const maxLon = Math.min(180, lng + longitudeDegrees);
  const minLat = Math.max(-90, lat - latitudeDegrees);
  const maxLat = Math.min(90, lat + latitudeDegrees);
  const responses = await Promise.allSettled(terms.map(async (term) => {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(term)}&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1&addressdetails=1&extratags=1&namedetails=1&limit=50`, {
      headers: { "User-Agent": `CityMaps-${city.id}/1.0` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}`);
    return response.json();
  }));
  const fallback = responses.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!fallback.length) {
    return NextResponse.json({ status: "ERROR", places: [], error: "Places services are unavailable" }, { status: 502 });
  }
  const unique = new globalThis.Map<string, any>();
  for (const item of fallback) {
    const name = item.namedetails?.name || item.name || item.display_name?.split(",")[0] || "";
    if (safeCategory === "temple" && !isNamedTemple(name, item.type)) continue;
    const placeLat = parseFloat(item.lat);
    const placeLng = parseFloat(item.lon);
    const placeDistance = distanceMeters(lat, lng, placeLat, placeLng);
    if (placeDistance > radius) continue;
    unique.set(`${item.osm_type}_${item.osm_id}`, {
      place_id: `nom_${item.osm_type}_${item.osm_id}`,
      name,
      category: item.type || item.category || safeCategory,
      address: item.display_name || `${city.searchName}, Tamil Nadu`,
      lat: placeLat,
      lng: placeLng,
      phone: item.extratags?.phone || item.extratags?.["contact:phone"] || null,
      website: item.extratags?.website || null,
      opening_hours: item.extratags?.opening_hours || null,
      distance_meters: placeDistance,
    });
  }
  const places = Array.from(unique.values()).sort((left, right) => left.distance_meters - right.distance_meters).slice(0, limit);
  return NextResponse.json({ status: "OK", count: places.length, places, source: "nominatim-fallback" });
}
