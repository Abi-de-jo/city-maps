import { NextRequest, NextResponse } from "next/server";
import { getCity } from "@/lib/cities";

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = getCity(searchParams.get("region"));
  const q = (searchParams.get("q") || "").trim();
  const userLat = parseFloat(searchParams.get("lat") || String(city.center[1]));
  const userLng = parseFloat(searchParams.get("lng") || String(city.center[0]));
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 50);
  if (!q) return NextResponse.json({ status: "OK", results: [], predictions: [] });

  const [minLon, minLat, maxLon, maxLat] = city.bbox;
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
  const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
  const safeRegex = q.replace(/["\\]/g, "");
  const overpassQuery = `[out:json][timeout:8];(node["name"~"${safeRegex}",i](${minLat},${minLon},${maxLat},${maxLon});way["name"~"${safeRegex}",i](${minLat},${minLon},${maxLat},${maxLon}););out center 15;`;
  const requests = [
    jsonFetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(`${q} ${city.searchName}`)}&viewbox=${viewbox}&bounded=1&addressdetails=1&extratags=1&limit=12`, { headers: { "User-Agent": `CityMaps-${city.id}/1.0` } }),
    jsonFetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${userLat}&lon=${userLng}&bbox=${bbox}&limit=12`),
    jsonFetch("https://overpass.kumi.systems/api/interpreter", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(overpassQuery)}` }),
  ];
  const [nomRes, phoRes, ovpRes] = await Promise.allSettled(requests);
  const unified = new Map<string, any>();

  if (nomRes.status === "fulfilled" && Array.isArray(nomRes.value)) for (const item of nomRes.value) {
    const lat = parseFloat(item.lat); const lng = parseFloat(item.lon);
    unified.set(`${lat.toFixed(4)}_${lng.toFixed(4)}`, { place_id: `nom_${item.osm_type}_${item.osm_id}`, name: item.name || item.display_name?.split(",")[0] || q, category: item.type || item.category || "place", address: item.display_name || `${city.searchName}, Tamil Nadu`, lat, lng, phone: item.extratags?.phone || item.extratags?.["contact:phone"] || null, website: item.extratags?.website || null, opening_hours: item.extratags?.opening_hours || null, distance_meters: haversineMeters(userLat, userLng, lat, lng) });
  }
  if (phoRes.status === "fulfilled" && Array.isArray(phoRes.value?.features)) for (const feature of phoRes.value.features) {
    const [lng, lat] = feature.geometry.coordinates; const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`; if (unified.has(key)) continue; const p = feature.properties;
    unified.set(key, { place_id: `pho_${p.osm_type}_${p.osm_id}`, name: p.name || p.street || q, category: p.osm_value || p.osm_key || "place", address: [p.street, p.district || p.locality, p.city || city.searchName, p.postcode].filter(Boolean).join(", "), lat, lng, phone: null, website: null, opening_hours: null, distance_meters: haversineMeters(userLat, userLng, lat, lng) });
  }
  if (ovpRes.status === "fulfilled" && Array.isArray(ovpRes.value?.elements)) for (const element of ovpRes.value.elements) {
    const lat = element.lat ?? element.center?.lat; const lng = element.lon ?? element.center?.lon; if (!lat || !lng) continue; const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`; const previous = unified.get(key);
    unified.set(key, { place_id: `osm_${element.type}_${element.id}`, name: element.tags?.name || element.tags?.["name:en"] || element.tags?.["name:ta"] || q, category: element.tags?.amenity || element.tags?.shop || element.tags?.tourism || element.tags?.highway || "place", address: [element.tags?.["addr:housenumber"], element.tags?.["addr:street"], element.tags?.["addr:suburb"], element.tags?.["addr:city"] || city.searchName].filter(Boolean).join(", ") || `${city.searchName}, Tamil Nadu`, lat, lng, phone: element.tags?.phone || element.tags?.["contact:phone"] || previous?.phone || null, website: element.tags?.website || previous?.website || null, opening_hours: element.tags?.opening_hours || previous?.opening_hours || null, distance_meters: haversineMeters(userLat, userLng, lat, lng) });
  }
  const results = Array.from(unified.values()).sort((a, b) => a.distance_meters - b.distance_meters).slice(0, limit);
  return NextResponse.json({ status: "OK", count: results.length, results, predictions: results });
}
