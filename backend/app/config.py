from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://maps:maps@localhost:5432/maps"
    redis_url: str = "redis://localhost:6379/0"
    meili_url: str = "http://localhost:7700"
    meili_master_key: str = "development-key"
    valhalla_url: str = "http://localhost:8002"
    photon_url: str = "http://localhost:2322"
    traffic_api_key: str = "development-traffic-key"
    city_name: str = "Local City"
    city_bbox: tuple[float, float, float, float] = (78.55, 10.68, 78.85, 10.95)
    cors_origins: list[str] = Field(default=["http://localhost:3000"])

    @field_validator("city_bbox", mode="before")
    @classmethod
    def parse_bbox(cls, value: object) -> object:
        if isinstance(value, str):
            clean = value.strip("[]() \t\n")
            values = tuple(float(item.strip()) for item in clean.split(","))
            if len(values) != 4:
                raise ValueError("CITY_BBOX must contain MIN_LON,MIN_LAT,MAX_LON,MAX_LAT")
            return values
        if isinstance(value, (list, tuple)):
            values = tuple(float(item) for item in value)
            if len(values) != 4:
                raise ValueError("CITY_BBOX must contain MIN_LON,MIN_LAT,MAX_LON,MAX_LAT")
            return values
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, (list, tuple)):
            return [str(item) for item in value]
        return value

@lru_cache
def get_settings() -> Settings:
    return Settings()
