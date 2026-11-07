from __future__ import annotations

import json
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from .models import TravelMode
from .services import Resources, parse_coordinate

router = APIRouter(tags=["directions"])

MODE_COSTING: dict[TravelMode, str] = {
    "driving": "auto",
    "two_wheeler": "motor_scooter",
    "cycling": "bicycle",
    "walking": "pedestrian",
}

MANEUVER_TYPES = {
    0: "none", 1: "start", 2: "start-right", 3: "start-left", 4: "arrive",
    5: "arrive-right", 6: "arrive-left", 8: "straight", 9: "slight-right",
    10: "turn-right", 11: "sharp-right", 12: "uturn-right", 13: "uturn-left",
    14: "sharp-left", 15: "turn-left", 16: "slight-left", 17: "ramp-straight",
    18: "ramp-right", 19: "ramp-left", 20: "exit-right", 21: "exit-left",
    22: "stay-straight", 23: "stay-right", 24: "stay-left", 25: "merge",
    26: "roundabout-enter", 27: "roundabout-exit", 37: "ferry-enter", 38: "ferry-exit",
}


def decode_polyline6(encoded: str) -> list[list[float]]:
    coordinates: list[list[float]] = []
    index = lat = lng = 0
    while index < len(encoded):
        deltas: list[int] = []
        for _ in range(2):
            result = shift = 0
            while True:
                if index >= len(encoded):
                    raise ValueError("Malformed route geometry")
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lng += deltas[1]
        coordinates.append([lng / 1e6, lat / 1e6])
    return coordinates


def bounds_for(coordinates: list[list[float]]) -> dict[str, dict[str, float]]:
    lngs = [point[0] for point in coordinates]
    lats = [point[1] for point in coordinates]
    return {
        "southwest": {"lat": min(lats), "lng": min(lngs)},
        "northeast": {"lat": max(lats), "lng": max(lngs)},
    }


async def traffic_multiplier(resources: Resources, coordinates: list[list[float]]) -> float:
    row = await resources.require_db().fetchrow(
        """
        WITH route AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom)
        SELECT COALESCE(
          SUM(ST_Length(ST_Intersection(t.geometry::geography, route.geom::geography)) *
              GREATEST(1.0, t.normal_speed_kph / t.speed_kph)) /
          NULLIF(SUM(ST_Length(ST_Intersection(t.geometry::geography, route.geom::geography))), 0),
          1.0
        ) AS multiplier
        FROM traffic_overrides t, route
        WHERE t.expires_at > NOW()
          AND ST_DWithin(t.geometry::geography, route.geom::geography, 25)
        """,
        json.dumps({"type": "LineString", "coordinates": coordinates}),
    )
    return min(max(float(row["multiplier"] or 1), 1), 5)


def normalize_route(raw: dict[str, Any], multiplier: float) -> dict[str, Any]:
    trip = raw["trip"]
    leg_shapes = [decode_polyline6(leg["shape"]) for leg in trip["legs"]]
    coordinates = [point for index, leg in enumerate(leg_shapes) for point in leg[index > 0 :]]
    encoded = trip["legs"][0]["shape"] if len(trip["legs"]) == 1 else ""
    legs = []
    for leg in trip["legs"]:
        steps = []
        for maneuver in leg.get("maneuvers", []):
            steps.append({
                "maneuver": MANEUVER_TYPES.get(maneuver.get("type", 0), "continue"),
                "street_name": (maneuver.get("street_names") or [""])[0],
                "distance_meters": round(float(maneuver.get("length", 0)) * 1000),
                "duration_seconds": round(float(maneuver.get("time", 0))),
                "voice_instruction": maneuver.get("verbal_pre_transition_instruction")
                or maneuver.get("instruction", "Continue"),
                "begin_shape_index": maneuver.get("begin_shape_index", 0),
                "end_shape_index": maneuver.get("end_shape_index", 0),
            })
        legs.append({
            "distance_meters": round(float(leg["summary"]["length"]) * 1000),
            "duration_seconds": round(float(leg["summary"]["time"])),
            "steps": steps,
        })
    duration = round(float(trip["summary"]["time"]))
    street_names = dict.fromkeys(
        step["street_name"] for leg in legs for step in leg["steps"] if step["street_name"]
    )
    return {
        "summary": " · ".join(street_names)[:160],
        "distance_meters": round(float(trip["summary"]["length"]) * 1000),
        "duration_seconds": duration,
        "traffic_duration_seconds": round(duration * multiplier),
        "bounds": bounds_for(coordinates),
        "overview_polyline": {
            "encoding": "polyline6",
            "points": encoded,
            "geojson": {"type": "LineString", "coordinates": coordinates},
        },
        "legs": legs,
    }


@router.get("/directions")
async def directions(
    request: Request,
    origin: str = Query(description="Origin formatted as lat,lng"),
    destination: str = Query(description="Destination formatted as lat,lng"),
    waypoints: str | None = Query(default=None, description="Pipe-separated lat,lng positions"),
    mode: TravelMode = "driving",
    alternatives: bool = False,
) -> dict[str, Any]:
    resources: Resources = request.app.state.resources
    points = [parse_coordinate(origin, "origin")]
    if waypoints:
        raw_waypoints = [value for value in waypoints.split("|") if value]
        if len(raw_waypoints) > 8:
            raise HTTPException(422, "A route can contain at most 8 waypoints")
        points.extend(
            parse_coordinate(value, f"waypoint {index + 1}")
            for index, value in enumerate(raw_waypoints)
        )
    points.append(parse_coordinate(destination, "destination"))
    payload = {
        "locations": [{"lat": lat, "lon": lng, "type": "break"} for lat, lng in points],
        "costing": MODE_COSTING[mode],
        "directions_options": {"units": "kilometers", "language": "en-US"},
        "shape_format": "polyline6",
        "alternates": 2 if alternatives else 0,
    }
    try:
        response = await resources.require_http().get(
            f"{resources.settings.valhalla_url}/route", params={"json": json.dumps(payload)}
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Routing service could not calculate this route") from exc
    data = response.json()
    candidates = [data, *data.get("alternates", [])]
    normalized = []
    for candidate in candidates:
        try:
            first_shape = candidate["trip"]["legs"][0]["shape"]
            multiplier = (
                await traffic_multiplier(resources, decode_polyline6(first_shape))
                if mode in {"driving", "two_wheeler"} else 1
            )
            normalized.append(normalize_route(candidate, multiplier))
        except (KeyError, ValueError, TypeError) as exc:
            raise HTTPException(502, "Routing service returned an invalid route") from exc
    return {"status": "OK", "mode": mode, "routes": normalized}
