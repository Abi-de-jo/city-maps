import { NextRequest, NextResponse } from "next/server";
import { getCity } from "@/lib/cities";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = getCity(searchParams.get("region"));
  const lat = searchParams.get("lat") || String(city.center[1]);
  const lng = searchParams.get("lng") || String(city.center[0]);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": `CityMaps-${city.id}/1.0` },
    });
    if (!res.ok) throw new Error(`Nominatim returned HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json({
      status: "OK",
      place_id: `osm_${data.osm_type}_${data.osm_id}`,
      name: data.name || data.address?.road || data.address?.suburb || "Pinned Location",
      address: data.display_name || `${lat}, ${lng}`,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      region: city.id,
    });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", error: err.message }, { status: 500 });
  }
}
