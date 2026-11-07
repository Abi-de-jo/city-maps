from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .directions import router as directions_router
from .geocode import router as geocode_router
from .places import router as places_router
from .services import Resources
from .traffic import router as traffic_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    resources = Resources(settings)
    await resources.connect()
    app.state.resources = resources
    try:
        yield
    finally:
        await resources.close()


app = FastAPI(
    title="City Maps API",
    version="1.0.0",
    description="Open-source place search, directions, reverse geocoding, and traffic API.",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "X-API-Key"],
)


@app.middleware("http")
async def redis_rate_limit(request: Request, call_next):
    if request.url.path in {"/health", "/api/docs", "/api/openapi.json"}:
        return await call_next(request)
    resources: Resources | None = getattr(request.app.state, "resources", None)
    if resources and resources.redis:
        client_ip = request.client.host if request.client else "unknown"
        bucket = int(time.time() // 60)
        key = f"rate:{client_ip}:{bucket}"
        count = await resources.redis.incr(key)
        if count == 1:
            await resources.redis.expire(key, 61)
        if count > 120:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again in one minute."},
                headers={"Retry-After": "60"},
            )
    return await call_next(request)


@app.get("/health", tags=["system"])
async def health(request: Request):
    resources: Resources = request.app.state.resources
    database_ok = await resources.require_db().fetchval("SELECT TRUE")
    redis_ok = bool(await resources.redis.ping()) if resources.redis else False
    return {"status": "ok", "database": database_ok, "redis": redis_ok}


for router in (directions_router, places_router, geocode_router, traffic_router):
    app.include_router(router, prefix="/api/v1")
