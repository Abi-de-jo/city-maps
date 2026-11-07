from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status

from .models import TrafficUpdate

router = APIRouter(tags=["traffic"])


@router.post("/traffic/update", status_code=status.HTTP_202_ACCEPTED)
async def update_traffic(
    request: Request,
    payload: TrafficUpdate,
    x_api_key: str = Header(default=""),
) -> dict[str, Any]:
    resources = request.app.state.resources
    if x_api_key != resources.settings.traffic_api_key:
        raise HTTPException(401, "A valid traffic API key is required")
    if payload.expires_at.timestamp() <= __import__("time").time():
        raise HTTPException(422, "expires_at must be in the future")
    row = await resources.require_db().fetchrow(
        """
        INSERT INTO traffic_overrides
          (edge_id, road_name, speed_kph, normal_speed_kph, geometry, expires_at)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6)
        ON CONFLICT (edge_id) DO UPDATE SET
          road_name = EXCLUDED.road_name, speed_kph = EXCLUDED.speed_kph,
          normal_speed_kph = EXCLUDED.normal_speed_kph, geometry = EXCLUDED.geometry,
          expires_at = EXCLUDED.expires_at, updated_at = NOW()
        RETURNING edge_id, speed_kph, normal_speed_kph, expires_at
        """,
        payload.edge_id,
        payload.road_name,
        payload.speed_kph,
        payload.normal_speed_kph,
        json.dumps(payload.geometry),
        payload.expires_at,
    )
    if resources.redis:
        ttl = max(1, int(payload.expires_at.timestamp() - __import__("time").time()))
        await resources.redis.setex(
            f"traffic:{payload.edge_id}", ttl, payload.model_dump_json()
        )
        await resources.redis.publish("traffic-updates", payload.model_dump_json())
    return {"status": "accepted", **dict(row)}


@router.get("/traffic")
async def traffic_layer(request: Request) -> dict[str, Any]:
    rows = await request.app.state.resources.require_db().fetch(
        """
        SELECT edge_id, road_name, speed_kph, normal_speed_kph,
               ST_AsGeoJSON(geometry)::json AS geometry
        FROM traffic_overrides WHERE expires_at > NOW()
        """
    )
    features = []
    for row in rows:
        ratio = row["speed_kph"] / row["normal_speed_kph"]
        features.append({
            "type": "Feature",
            "id": row["edge_id"],
            "geometry": json.loads(row["geometry"]) if isinstance(row["geometry"], str) else row["geometry"],
            "properties": {
                "road_name": row["road_name"],
                "speed_kph": row["speed_kph"],
                "congestion": "heavy" if ratio < 0.4 else "moderate" if ratio < 0.7 else "light",
            },
        })
    return {"type": "FeatureCollection", "features": features}
