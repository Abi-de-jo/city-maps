from __future__ import annotations

import json
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, status

from .models import PlaceCreate, ReviewCreate
from .services import Resources, jsonable_record

router = APIRouter(tags=["places"])


def meili_headers(resources: Resources) -> dict[str, str]:
    return {"Authorization": f"Bearer {resources.settings.meili_master_key}"}


async def index_place(resources: Resources, place: dict[str, Any]) -> None:
    document = {
        "place_id": str(place["place_id"]),
        "name": place["name"],
        "category": place["category"],
        "address": place["address"],
        "phone": place.get("phone"),
        "_geo": {"lat": place["lat"], "lng": place["lng"]},
    }
    response = await resources.require_http().post(
        f"{resources.settings.meili_url}/indexes/places/documents",
        headers=meili_headers(resources),
        json=[document],
    )
    if response.status_code >= 400:
        raise HTTPException(502, "Place was saved but could not be added to search")


@router.get("/places/autocomplete")
async def autocomplete(
    request: Request,
    q: str = Query(min_length=1, max_length=120),
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_meters: int = Query(default=20_000, ge=50, le=100_000),
    category: str | None = Query(default=None, min_length=1, max_length=80),
) -> dict[str, Any]:
    resources: Resources = request.app.state.resources
    safe_category = category.replace("'", "\\'") if category else None
    filters = [f"_geoRadius({lat}, {lng}, {radius_meters})"]
    if safe_category:
        filters.append(f"category = '{safe_category}'")
    payload = {
        "q": q,
        "limit": 10,
        "filter": " AND ".join(filters),
        "sort": [f"_geoPoint({lat}, {lng}):asc"],
        "attributesToHighlight": ["name", "address"],
        "highlightPreTag": "<mark>",
        "highlightPostTag": "</mark>",
        "attributesToRetrieve": ["place_id", "name", "category", "address", "_geo"],
        "showRankingScore": True,
    }
    try:
        response = await resources.require_http().post(
            f"{resources.settings.meili_url}/indexes/places/search",
            headers=meili_headers(resources),
            json=payload,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Search service is unavailable") from exc
    predictions = []
    for hit in response.json().get("hits", []):
        formatted = hit.get("_formatted", {})
        predictions.append({
            "place_id": hit["place_id"],
            "name": hit["name"],
            "category": hit.get("category"),
            "address": hit.get("address"),
            "highlighted_name": formatted.get("name", hit["name"]),
            "highlighted_address": formatted.get("address", hit.get("address")),
            "distance_meters": round(hit.get("_geoDistance", 0)),
            "location": hit.get("_geo"),
            "ranking_score": hit.get("_rankingScore"),
        })
    return {"status": "OK", "predictions": predictions}


@router.get("/places/nearby")
async def nearby_places(
    request: Request,
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_meters: int = Query(default=5_000, ge=50, le=100_000),
    category: str | None = Query(default=None, min_length=1, max_length=80),
    limit: int = Query(default=30, ge=1, le=100),
) -> dict[str, Any]:
    rows = await request.app.state.resources.require_db().fetch(
        """
        SELECT place_id::text, name, category, address,
               ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
               ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
        FROM places
        WHERE status = 'published'
          AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
          AND ($4::text IS NULL OR category = $4)
        ORDER BY location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        LIMIT $5
        """,
        lng,
        lat,
        radius_meters,
        category,
        limit,
    )
    return {
        "status": "OK",
        "places": [
            {
                "place_id": row["place_id"], "name": row["name"],
                "category": row["category"], "address": row["address"],
                "location": {"lat": row["lat"], "lng": row["lng"]},
                "distance_meters": round(row["distance_meters"]),
            }
            for row in rows
        ],
    }


@router.get("/places/{place_id}")
async def get_place(request: Request, place_id: uuid.UUID) -> dict[str, Any]:
    db = request.app.state.resources.require_db()
    place = await db.fetchrow(
        """
        SELECT place_id, name, category, address, phone, website, opening_hours,
               photo_urls, average_rating, review_count,
               ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
        FROM places WHERE place_id = $1 AND status = 'published'
        """,
        place_id,
    )
    if not place:
        raise HTTPException(404, "Place not found")
    reviews = await db.fetch(
        """
        SELECT review_id, author_name, rating, text, created_at
        FROM reviews WHERE place_id = $1 AND status = 'published'
        ORDER BY created_at DESC LIMIT 50
        """,
        place_id,
    )
    result = jsonable_record(place)
    result["place_id"] = str(result["place_id"])
    result["reviews"] = [dict(review) | {"review_id": str(review["review_id"])} for review in reviews]
    return result


@router.post("/places", status_code=status.HTTP_201_CREATED)
async def create_place(request: Request, payload: PlaceCreate) -> dict[str, Any]:
    resources: Resources = request.app.state.resources
    async with resources.require_db().acquire() as connection:
        async with connection.transaction():
            place = await connection.fetchrow(
                """
                INSERT INTO places
                  (name, category, address, phone, website, opening_hours, photo_urls, location)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb,
                        ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography)
                RETURNING place_id, name, category, address, phone, website, opening_hours,
                          photo_urls, average_rating, review_count,
                          ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
                """,
                payload.name,
                payload.category.lower(),
                payload.address,
                payload.phone,
                str(payload.website) if payload.website else None,
                json.dumps(payload.opening_hours),
                json.dumps([str(url) for url in payload.photo_urls]),
                payload.lat,
                payload.lng,
            )
    result = jsonable_record(place)
    result["place_id"] = str(result["place_id"])
    await index_place(resources, result)
    return result


@router.post("/places/{place_id}/reviews", status_code=status.HTTP_201_CREATED)
async def create_review(
    request: Request, place_id: uuid.UUID, payload: ReviewCreate
) -> dict[str, Any]:
    row = await request.app.state.resources.require_db().fetchrow(
        """
        INSERT INTO reviews (place_id, author_name, rating, text)
        SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM places WHERE place_id = $1)
        RETURNING review_id, author_name, rating, text, created_at
        """,
        place_id,
        payload.author_name,
        payload.rating,
        payload.text,
    )
    if not row:
        raise HTTPException(404, "Place not found")
    return dict(row) | {"review_id": str(row["review_id"])}
