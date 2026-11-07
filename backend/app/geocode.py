from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

router = APIRouter(tags=["geocoding"])


@router.get("/geocode/reverse")
async def reverse_geocode(
    request: Request,
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
) -> dict[str, Any]:
    resources = request.app.state.resources
    row = await resources.require_db().fetchrow(
        """
        WITH candidates AS (
          SELECT place_id::text, name, address, category, location, 1 AS priority FROM places
          WHERE status = 'published'
          UNION ALL
          SELECT 'osm:' || osm_type || ':' || osm_id, name,
                 COALESCE(address, name), category, location, 2 FROM osm_pois
        )
        SELECT place_id, name, address, category,
               ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
        FROM candidates
        WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 50)
        ORDER BY priority, distance_meters LIMIT 1
        """,
        lng,
        lat,
    )
    if row:
        return {
            "status": "OK",
            "place_id": row["place_id"],
            "formatted_address": row["address"] or row["name"],
            "name": row["name"],
            "category": row["category"],
            "distance_meters": round(row["distance_meters"]),
            "location": {"lat": lat, "lng": lng},
            "source": "postgis",
        }
    try:
        response = await resources.require_http().get(
            f"{resources.settings.photon_url}/reverse", params={"lat": lat, "lon": lng, "limit": 1}
        )
        response.raise_for_status()
        features = response.json().get("features", [])
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Reverse geocoding service is unavailable") from exc
    if not features:
        raise HTTPException(404, "No road, building, or place was found within 50 meters")
    feature = features[0]
    properties = feature.get("properties", {})
    address_parts = [
        properties.get("name"), properties.get("street"), properties.get("city"),
        properties.get("state"), properties.get("postcode"), properties.get("country"),
    ]
    return {
        "status": "OK",
        "place_id": f"photon:{properties.get('osm_type', 'unknown')}:{properties.get('osm_id', 'unknown')}",
        "formatted_address": ", ".join(dict.fromkeys(part for part in address_parts if part)),
        "name": properties.get("name"),
        "category": properties.get("type"),
        "location": {"lat": lat, "lng": lng},
        "source": "photon",
    }
