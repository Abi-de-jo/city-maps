from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]


class Coordinate(BaseModel):
    lat: Latitude
    lng: Longitude


class PlaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=80, pattern=r"^[\w -]+$")
    address: str = Field(min_length=1, max_length=500)
    phone: str | None = Field(default=None, max_length=40)
    website: HttpUrl | None = None
    opening_hours: dict[str, list[str]] = Field(default_factory=dict)
    photo_urls: list[HttpUrl] = Field(default_factory=list, max_length=20)
    lat: Latitude
    lng: Longitude

    @field_validator("name", "category", "address")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return " ".join(value.split())


class ReviewCreate(BaseModel):
    author_name: str = Field(min_length=1, max_length=100)
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=2000)


class TrafficUpdate(BaseModel):
    edge_id: str = Field(min_length=1, max_length=100)
    road_name: str | None = Field(default=None, max_length=200)
    speed_kph: float = Field(gt=0, le=200)
    normal_speed_kph: float = Field(gt=0, le=200)
    geometry: dict = Field(description="GeoJSON LineString in WGS84")
    expires_at: datetime

    @field_validator("geometry")
    @classmethod
    def validate_linestring(cls, value: dict) -> dict:
        if value.get("type") != "LineString" or len(value.get("coordinates", [])) < 2:
            raise ValueError("geometry must be a GeoJSON LineString with at least two positions")
        return value


TravelMode = Literal["driving", "two_wheeler", "cycling", "walking"]
