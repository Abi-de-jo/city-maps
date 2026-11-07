from __future__ import annotations

import asyncio
import json
import os

import asyncpg
import httpx


CATEGORY_SQL = """
COALESCE(tags->'amenity', tags->'shop', tags->'tourism', tags->'office',
         tags->'leisure', tags->'healthcare',
         CASE WHEN tags->'highway' = 'bus_stop' THEN 'bus_stop' END)
"""


async def configure_meili(client: httpx.AsyncClient, base_url: str, key: str) -> None:
    headers = {"Authorization": f"Bearer {key}"}
    response = await client.post(
        f"{base_url}/indexes", headers=headers, json={"uid": "places", "primaryKey": "place_id"}
    )
    if response.status_code not in {200, 201, 202, 409}:
        response.raise_for_status()
    settings = {
        "searchableAttributes": ["name", "address", "category"],
        "filterableAttributes": ["category", "_geo"],
        "sortableAttributes": ["_geo"],
        "displayedAttributes": ["place_id", "name", "category", "address", "phone", "_geo"],
        "typoTolerance": {"enabled": True},
    }
    response = await client.patch(
        f"{base_url}/indexes/places/settings", headers=headers, json=settings
    )
    response.raise_for_status()


async def main() -> None:
    database_url = os.environ["DATABASE_URL"]
    meili_url = os.environ["MEILI_URL"].rstrip("/")
    meili_key = os.environ["MEILI_MASTER_KEY"]
    db = await asyncpg.connect(database_url)
    try:
        await db.execute("TRUNCATE osm_pois")
        await db.execute(
            f"""
            INSERT INTO osm_pois (osm_type, osm_id, name, category, address, tags, location)
            SELECT source_type, osm_id, NULLIF(name, ''), category,
                   trim(concat_ws(', ', NULLIF(tags->'addr:housenumber', ''),
                                       NULLIF(tags->'addr:street', ''),
                                       NULLIF(tags->'addr:city', ''))),
                   hstore_to_jsonb(tags), ST_Transform(point_geom, 4326)::geography
            FROM (
              SELECT 'node' AS source_type, osm_id, name, tags, way AS point_geom, {CATEGORY_SQL} AS category
              FROM planet_osm_point
              UNION ALL
              SELECT 'way', osm_id, name, tags, ST_PointOnSurface(way), {CATEGORY_SQL}
              FROM planet_osm_polygon
            ) source
            WHERE category IS NOT NULL
            ON CONFLICT (osm_type, osm_id) DO UPDATE SET
              name = EXCLUDED.name, category = EXCLUDED.category, address = EXCLUDED.address,
              tags = EXCLUDED.tags, location = EXCLUDED.location, updated_at = NOW()
            """
        )
        await db.execute(
            """
            INSERT INTO places
              (osm_type, osm_id, name, category, address, phone, website, opening_hours, location)
            SELECT osm_type, osm_id, COALESCE(name, initcap(replace(category, '_', ' '))), category,
                   COALESCE(NULLIF(address, ''), COALESCE(name, initcap(replace(category, '_', ' ')))),
                   tags->>'phone', tags->>'website',
                   CASE WHEN tags ? 'opening_hours'
                        THEN jsonb_build_object('raw', tags->>'opening_hours') ELSE '{}'::jsonb END,
                   location
            FROM osm_pois
            ON CONFLICT (osm_type, osm_id) DO UPDATE SET
              name = EXCLUDED.name, category = EXCLUDED.category, address = EXCLUDED.address,
              phone = EXCLUDED.phone, website = EXCLUDED.website,
              opening_hours = EXCLUDED.opening_hours, location = EXCLUDED.location, updated_at = NOW()
            """
        )
        rows = await db.fetch(
            """
            SELECT place_id::text, name, category, address, phone,
                   ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
            FROM places WHERE status = 'published'
            """
        )
    finally:
        await db.close()

    async with httpx.AsyncClient(timeout=60) as client:
        await configure_meili(client, meili_url, meili_key)
        headers = {"Authorization": f"Bearer {meili_key}"}
        for offset in range(0, len(rows), 1000):
            documents = [
                {
                    "place_id": row["place_id"], "name": row["name"],
                    "category": row["category"], "address": row["address"],
                    "phone": row["phone"], "_geo": {"lat": row["lat"], "lng": row["lng"]},
                }
                for row in rows[offset : offset + 1000]
            ]
            response = await client.post(
                f"{meili_url}/indexes/places/documents",
                headers=headers,
                content=json.dumps(documents),
                params={"primaryKey": "place_id"},
            )
            response.raise_for_status()
    print(f"Synced {len(rows)} searchable places")


if __name__ == "__main__":
    asyncio.run(main())
