from __future__ import annotations

import json
import math
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import asyncpg
import httpx
from fastapi import HTTPException
from redis.asyncio import Redis

from .config import Settings


def parse_coordinate(value: str, name: str) -> tuple[float, float]:
    try:
        lat_text, lng_text = value.split(",", 1)
        lat, lng = float(lat_text), float(lng_text)
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, f"{name} must be formatted as lat,lng") from exc
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise HTTPException(422, f"{name} is outside valid latitude/longitude bounds")
    return lat, lng


def haversine_meters(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlng = lat2 - lat1, lng2 - lng1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6_371_000 * 2 * math.asin(math.sqrt(value))


class Resources:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db: asyncpg.Pool | None = None
        self.redis: Redis | None = None
        self.http: httpx.AsyncClient | None = None

    async def connect(self) -> None:
        self.db = await asyncpg.create_pool(self.settings.database_url, min_size=2, max_size=20)
        self.redis = Redis.from_url(self.settings.redis_url, decode_responses=True)
        self.http = httpx.AsyncClient(timeout=httpx.Timeout(12, connect=3))

    async def close(self) -> None:
        if self.http:
            await self.http.aclose()
        if self.redis:
            await self.redis.aclose()
        if self.db:
            await self.db.close()

    def require_db(self) -> asyncpg.Pool:
        if not self.db:
            raise HTTPException(503, "Database is not ready")
        return self.db

    def require_http(self) -> httpx.AsyncClient:
        if not self.http:
            raise HTTPException(503, "HTTP services are not ready")
        return self.http


@asynccontextmanager
async def resource_lifespan(settings: Settings) -> AsyncIterator[Resources]:
    resources = Resources(settings)
    await resources.connect()
    try:
        yield resources
    finally:
        await resources.close()


def jsonable_record(record: asyncpg.Record) -> dict[str, Any]:
    result = dict(record)
    for key in ("opening_hours", "photo_urls"):
        if key in result and isinstance(result[key], str):
            result[key] = json.loads(result[key])
    if "website" in result and result["website"] is not None:
        result["website"] = str(result["website"])
    return result
