"use client";

import { Bookmark, Building2, Car, ChevronRight, Clock3, LocateFixed, Map, MapPin, Menu, Mountain, Navigation, Palette, Printer, Search, Share2, Star, Volume2, VolumeX, X } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapLayerMouseEvent, VisibilitySpecification } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { CITIES, type CityConfig } from "@/lib/cities";

type Place = {
  place_id: string;
  name: string;
  category: string;
  description?: string | null;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  distance_meters?: number;
  photos?: string[];
  photo_kind?: "place" | "nearby" | "illustrative";
  rating?: number | null;
  review_count?: number | null;
  tamil_name?: string | null;
};

type SavedPlace = Pick<Place, "place_id" | "name" | "category" | "address" | "lat" | "lng">;

type RouteStep = { instruction: string; distance_meters: number; duration_seconds: number };
type RouteInfo = {
  route_index: number;
  is_fastest: boolean;
  summary: string;
  distance_meters: number;
  distance_text: string;
  duration_seconds: number;
  duration_text: string;
  midpoint_lnglat: [number, number];
  snapped_origin: [number, number];
  snapped_destination: [number, number];
  geometry: GeoJSON.LineString;
  steps: RouteStep[];
};
type MapMode = "street" | "satellite" | "dark";
const MAX_USABLE_GPS_ACCURACY_METERS = 250;
const ROUTE_LAYER_ORDER = [
  "alt-route-casing",
  "alt-route-line",
  "route-casing",
  "route-line",
  "route-walk-halo",
  "route-walk-dots",
  "route-origin-dest-Connectors",
  "gps-walk-path",
] as const;

function ensureRouteLayersOnTop(map: maplibregl.Map) {
  for (const layerId of ROUTE_LAYER_ORDER) {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  }
}

function ensureGpsLayersOnTop(map: maplibregl.Map) {
  for (const layerId of ["gps-accuracy", "gps-position-halo", "gps-position"] as const) {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  }
}

const CATEGORIES = [
  ["restaurant", "Restaurants"], ["atm", "ATMs & Banks"], ["hospital", "Hospitals"],
  ["pharmacy", "Pharmacies"], ["fuel", "Petrol Bunks"], ["shopping", "Shopping"],
  ["temple", "Temples"], ["hotel", "Hotels"],
] as const;

const TRICHY_LANDMARKS: SavedPlace[] = [
  { place_id: "landmark_rockfort", name: "Rockfort Ucchi Pillayar Temple", category: "temple", address: "Tiruchirappalli", lat: 10.828, lng: 78.6978 },
  { place_id: "landmark_srirangam", name: "Sri Ranganathaswamy Temple Srirangam", category: "temple", address: "Srirangam, Tiruchirappalli", lat: 10.8624, lng: 78.6899 },
  { place_id: "landmark_central_bus", name: "Central Bus Stand", category: "bus station", address: "Cantonment, Tiruchirappalli", lat: 10.7993, lng: 78.6852 },
  { place_id: "landmark_chatram", name: "Chatram Bus Stand", category: "bus station", address: "Tiruchirappalli", lat: 10.8315, lng: 78.6928 },
  { place_id: "landmark_nitt", name: "NIT Trichy", category: "university", address: "Tiruchirappalli", lat: 10.7594, lng: 78.8132 },
  { place_id: "landmark_airport", name: "Trichy International Airport", category: "airport", address: "Tiruchirappalli", lat: 10.7654, lng: 78.7097 },
  { place_id: "landmark_kallanai", name: "Kallanai Dam", category: "landmark", address: "Kallanai, Tiruchirappalli", lat: 10.8313, lng: 78.8267 },
];

const CHENNAI_LANDMARKS: SavedPlace[] = [
  { place_id: "landmark_marina", name: "Marina Beach", category: "beach", address: "Chennai", lat: 13.0500, lng: 80.2824 },
  { place_id: "landmark_central", name: "MGR Chennai Central", category: "railway station", address: "Chennai", lat: 13.0827, lng: 80.2754 },
  { place_id: "landmark_kapaleeshwarar", name: "Kapaleeshwarar Temple", category: "temple", address: "Mylapore, Chennai", lat: 13.0338, lng: 80.2699 },
  { place_id: "landmark_airport_maa", name: "Chennai International Airport", category: "airport", address: "Meenambakkam, Chennai", lat: 12.9941, lng: 80.1709 },
];

const svgIcon = (content: string) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

function poiMarkerPresentation(category: string) {
  const value = category.toLowerCase();
  if (/(restaurant|cafe|fast_food|food_court|ice_cream|bakery)/.test(value)) {
    return { kind: "food", icon: svgIcon('<path d="M3 2v8a3 3 0 0 0 3 3V2M6 13v9M12 2v20M12 8h4a4 4 0 0 0 4-4V2"/>') };
  }
  if (/(atm|bank)/.test(value)) {
    return { kind: "money", icon: svgIcon('<path d="m3 10 9-7 9 7M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>') };
  }
  if (/(hospital|clinic|doctor|healthcare)/.test(value)) {
    return { kind: "medical", icon: svgIcon('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>') };
  }
  if (/(pharmacy|chemist)/.test(value)) {
    return { kind: "pharmacy", icon: svgIcon('<path d="m8.5 3.5 12 12a4.24 4.24 0 0 1-6 6l-12-12a4.24 4.24 0 0 1 6-6ZM6.5 13.5l7-7"/>') };
  }
  if (/(fuel|petrol|gas_station)/.test(value)) {
    return { kind: "fuel", icon: svgIcon('<path d="M3 22V3h10v19M2 22h12M5 7h6M16 8l3 3v8a2 2 0 0 0 4 0v-6l-3-3"/>') };
  }
  if (/(shop|supermarket|mall|convenience|clothes|electronics|jewelry|department_store)/.test(value)) {
    return { kind: "shopping", icon: svgIcon('<path d="M6 8h12l1 13H5L6 8ZM9 9V6a3 3 0 0 1 6 0v3"/>') };
  }
  if (/(place_of_worship|temple|mosque|church|shrine)/.test(value)) {
    return { kind: "worship", icon: svgIcon('<path d="m4 10 8-7 8 7M6 10v10M18 10v10M3 21h18M9 13h6v8"/>') };
  }
  if (/(hotel|guest_house|hostel|motel)/.test(value)) {
    return { kind: "hotel", icon: svgIcon('<path d="M3 4v17M3 15h18v6M7 11h4a3 3 0 0 1 3 3v1M7 11V7h4a3 3 0 0 1 3 3v1"/>') };
  }
  if (/(bus|bus_stop|station)/.test(value)) {
    return { kind: "transit", icon: svgIcon('<path d="M6 17h12M6 17a2 2 0 0 1-2-2V6c0-3 3-4 8-4s8 1 8 4v9a2 2 0 0 1-2 2M7 21v-4M17 21v-4M4 9h16M8 13h.01M16 13h.01"/>') };
  }
  if (/(school|college|university)/.test(value)) {
    return { kind: "education", icon: svgIcon('<path d="m2 10 10-5 10 5-10 5zM6 12v5c3 2 9 2 12 0v-5M22 10v6"/>') };
  }
  if (/(airport|aerodrome|terminal)/.test(value)) {
    return { kind: "airport", icon: svgIcon('<path d="M22 2 9 15M15 3l-3 9-9 3 4 2 2 4 3-9 9-3z"/>') };
  }
  if (/parking/.test(value)) {
    return { kind: "parking", icon: svgIcon('<path d="M7 21V3h6a5 5 0 0 1 0 10H7M7 13h6"/>') };
  }
  return { kind: "place", icon: svgIcon('<path d="M4 20h16M6 17V9h12v8M8 9l4-5 4 5M10 13h4v4"/>') };
}

const POI_MARKER_COLORS: Record<string, string> = {
  food: "#e8710a", money: "#188038", medical: "#d93025", pharmacy: "#9334e6",
  fuel: "#5f6368", shopping: "#a142f4", worship: "#b06000", hotel: "#1a73e8",
  transit: "#1967d2", education: "#137333", airport: "#185abc", parking: "#1967d2",
  place: "#5f6368",
};

function poiMarkerImage(category: string) {
  const marker = poiMarkerPresentation(category);
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 58;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Place pin canvas is unavailable");
  context.fillStyle = "rgba(32,33,36,.22)";
  context.beginPath();
  context.ellipse(24, 53, 9, 3, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(24, 1);
  context.bezierCurveTo(12.4, 1, 3, 10.4, 3, 22);
  context.bezierCurveTo(3, 36.4, 24, 55, 24, 55);
  context.bezierCurveTo(24, 55, 45, 36.4, 45, 22);
  context.bezierCurveTo(45, 10.4, 35.6, 1, 24, 1);
  context.closePath();
  context.fillStyle = POI_MARKER_COLORS[marker.kind] || POI_MARKER_COLORS.place;
  context.fill();
  context.strokeStyle = "#fff";
  context.lineWidth = 2.5;
  context.stroke();
  context.strokeStyle = "#fff";
  context.fillStyle = "#fff";
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  const line = (...points: number[]) => {
    context.beginPath();
    context.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) context.lineTo(points[index], points[index + 1]);
    context.stroke();
  };
  if (marker.kind === "food") {
    line(18, 12, 18, 31); line(15, 12, 15, 19, 21, 19, 21, 12); line(29, 12, 29, 31); line(29, 12, 33, 20, 29, 20);
  } else if (marker.kind === "money") {
    line(14, 17, 24, 11, 34, 17); line(15, 30, 33, 30); line(18, 18, 18, 28); line(24, 18, 24, 28); line(30, 18, 30, 28);
  } else if (marker.kind === "medical" || marker.kind === "pharmacy") {
    context.fillRect(21, 11, 6, 21); context.fillRect(14, 18, 20, 7);
  } else if (marker.kind === "fuel") {
    context.strokeRect(15, 12, 12, 19); context.strokeRect(18, 15, 6, 6); line(27, 16, 32, 20, 32, 29);
  } else if (marker.kind === "shopping") {
    context.strokeRect(15, 17, 18, 15); context.beginPath(); context.arc(24, 17, 5, Math.PI, 0); context.stroke();
  } else if (marker.kind === "worship") {
    line(14, 20, 24, 11, 34, 20); line(17, 20, 17, 31, 31, 31, 31, 20); line(21, 31, 21, 23, 27, 23, 27, 31);
  } else if (marker.kind === "hotel") {
    line(14, 12, 14, 32); context.strokeRect(16, 20, 18, 9); line(14, 29, 35, 29, 35, 32); context.strokeRect(17, 16, 7, 4);
  } else if (marker.kind === "transit") {
    context.strokeRect(15, 11, 18, 19); line(15, 20, 33, 20); context.beginPath(); context.arc(19, 27, 1.5, 0, Math.PI * 2); context.arc(29, 27, 1.5, 0, Math.PI * 2); context.fill();
  } else if (marker.kind === "education") {
    line(13, 18, 24, 12, 35, 18, 24, 24, 13, 18); line(18, 22, 18, 28, 30, 28, 30, 22); line(35, 18, 35, 27);
  } else if (marker.kind === "airport") {
    line(14, 27, 34, 13); line(21, 13, 24, 20, 33, 21); line(19, 24, 15, 20); line(25, 23, 29, 31);
  } else if (marker.kind === "parking") {
    context.font = "bold 22px Arial"; context.textAlign = "center"; context.fillText("P", 24, 30);
  } else {
    context.beginPath(); context.arc(24, 20, 7, 0, Math.PI * 2); context.stroke(); context.beginPath(); context.arc(24, 20, 2.5, 0, Math.PI * 2); context.fill();
  }
  return { id: `poi-${marker.kind}`, data: context.getImageData(0, 0, canvas.width, canvas.height) };
}

function circleImageData(size: number, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Route marker canvas is unavailable");
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  return context.getImageData(0, 0, size, size);
}

function accuracyCircle(lng: number, lat: number, radiusMeters: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const points = 64;
  const latitudeDegrees = radiusMeters / 111_320;
  const longitudeDegrees = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const coordinates: [number, number][] = Array.from({ length: points + 1 }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    return [lng + Math.cos(angle) * longitudeDegrees, lat + Math.sin(angle) * latitudeDegrees];
  });
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coordinates] } };
}

function getDistanceFromRouteMeters(point: [number, number], routeCoords: [number, number][]): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  let minimum = Number.POSITIVE_INFINITY;
  const [pointLng, pointLat] = point;
  for (let index = 0; index < routeCoords.length - 1; index += 1) {
    const [startLng, startLat] = routeCoords[index];
    const [endLng, endLat] = routeCoords[index + 1];
    const dx = endLng - startLng;
    const dy = endLat - startLat;
    const lengthSquared = dx * dx + dy * dy;
    const rawProjection = lengthSquared === 0 ? 0 : ((pointLng - startLng) * dx + (pointLat - startLat) * dy) / lengthSquared;
    const projection = Math.max(0, Math.min(1, rawProjection));
    const projectedLng = startLng + projection * dx;
    const projectedLat = startLat + projection * dy;
    const latitudeDelta = toRad(pointLat - projectedLat);
    const longitudeDelta = toRad(pointLng - projectedLng);
    const a = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(toRad(projectedLat)) * Math.cos(toRad(pointLat)) * Math.sin(longitudeDelta / 2) ** 2;
    minimum = Math.min(minimum, earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  return minimum;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRad(lat2 - lat1);
  const longitudeDelta = toRad(lon2 - lon1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

function getBearingDegrees(start: [number, number], end: [number, number]): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const toDeg = (radians: number) => (radians * 180) / Math.PI;
  const [lng1, lat1] = start.map(toRad);
  const [lng2, lat2] = end.map(toRad);
  const longitudeDelta = lng2 - lng1;
  const y = Math.sin(longitudeDelta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(longitudeDelta);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function getOrigin3DMarkerHTML(
  mode: "driving" | "cycling" | "walking",
  bearingDeg = 0,
): string {
  if (mode === "walking") {
    return `
      <div class="route-origin-model route-origin-pedestrian" aria-hidden="true">
        <div class="route-origin-pulse"></div>
        <svg width="46" height="56" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="headGrad" x1="24" y1="6" x2="40" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#FFDFC4"/><stop offset="1" stop-color="#E0AC69"/></linearGradient>
            <linearGradient id="shirtGrad" x1="18" y1="24" x2="46" y2="50" gradientUnits="userSpaceOnUse"><stop stop-color="#4285F4"/><stop offset="1" stop-color="#174EA6"/></linearGradient>
            <linearGradient id="pantsGrad" x1="22" y1="48" x2="42" y2="74" gradientUnits="userSpaceOnUse"><stop stop-color="#3C4043"/><stop offset="1" stop-color="#202124"/></linearGradient>
          </defs>
          <circle cx="32" cy="14" r="8.5" fill="url(#headGrad)" stroke="#fff" stroke-width="2"/>
          <path d="M24 12C24 7.5 27.5 5 32 5S40 7.5 40 12C37 10 27 10 24 12Z" fill="#202124"/>
          <path d="M21 25C17.5 25 15 28 15 32V43C15 45 16.5 46.5 18.5 46.5 20 46.5 21 45.5 21 43.5V33H23V49H41V33H43V43.5C43 45.5 44 46.5 45.5 46.5 47.5 46.5 49 45 49 43V32C49 28 46.5 25 43 25H21Z" fill="url(#shirtGrad)" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M23.5 48H31V70C31 72 29.5 73.5 27.2 73.5S23.5 72 23.5 70V48Z" fill="url(#pantsGrad)" stroke="#fff" stroke-width="1.5"/>
          <path d="M33 48H40.5V70C40.5 72 39 73.5 36.8 73.5S33 72 33 70V48Z" fill="url(#pantsGrad)" stroke="#fff" stroke-width="1.5"/>
          <ellipse cx="27" cy="73.5" rx="4.5" ry="2.5" fill="#1a73e8" stroke="#fff" stroke-width="1.2"/><ellipse cx="37" cy="73.5" rx="4.5" ry="2.5" fill="#1a73e8" stroke="#fff" stroke-width="1.2"/>
        </svg>
      </div>`;
  }

  if (mode === "cycling") {
    return `
      <div class="route-origin-model route-origin-vehicle route-origin-bike-3d" aria-hidden="true">
        <div class="route-origin-bearing" style="transform:rotate(${bearingDeg}deg)">
          <svg width="54" height="58" viewBox="0 0 64 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="bikeGround3d" cx="50%" cy="38%" r="68%"><stop stop-color="#fff"/><stop offset=".7" stop-color="#E0F7FA"/><stop offset="1" stop-color="#80DEEA"/></radialGradient>
              <linearGradient id="bikeTank3d" x1="23" y1="18" x2="42" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#6FF7FF"/><stop offset=".42" stop-color="#00BCD4"/><stop offset="1" stop-color="#006064"/></linearGradient>
              <radialGradient id="bikeHelmet3d" cx="38%" cy="28%" r="72%"><stop stop-color="#fff"/><stop offset=".22" stop-color="#8AB4F8"/><stop offset=".64" stop-color="#1A73E8"/><stop offset="1" stop-color="#0D47A1"/></radialGradient>
              <linearGradient id="bikeChrome3d" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".45" stop-color="#90A4AE"/><stop offset="1" stop-color="#ECEFF1"/></linearGradient>
            </defs>
            <ellipse cx="32" cy="38" rx="28" ry="27" fill="url(#bikeGround3d)" stroke="#00ACC1" stroke-width="2.5"/>
            <ellipse cx="32" cy="57" rx="13" ry="5" fill="#004D40" fill-opacity=".3"/>
            <path d="M20 4 13-4h38L44 4H20Z" fill="#80DEEA" fill-opacity=".42"/>
            <rect x="27.5" y="5" width="9" height="16" rx="4.5" fill="#202124" stroke="#fff" stroke-width="1.5"/>
            <rect x="26.5" y="49" width="11" height="16" rx="5.5" fill="#202124" stroke="#fff" stroke-width="1.5"/>
            <path d="M15 22h34" stroke="url(#bikeChrome3d)" stroke-width="4.5" stroke-linecap="round"/>
            <circle cx="14" cy="20" r="3.5" fill="#263238" stroke="#fff" stroke-width="1.2"/><circle cx="50" cy="20" r="3.5" fill="#263238" stroke="#fff" stroke-width="1.2"/>
            <path d="M24 13c0-4 3.5-6.5 8-6.5S40 9 40 13l2.5 17c.5 5-4.5 9-10.5 9s-11-4-10.5-9L24 13Z" fill="url(#bikeTank3d)" stroke="#fff" stroke-width="2"/>
            <path d="M20 25c3-4 7-5.5 12-5.5S41 21 44 25l-2 13c-.6 4.5-4.5 7-10 7s-9.4-2.5-10-7l-2-13Z" fill="#174EA6" stroke="#fff" stroke-width="1.8"/>
            <path d="M26 42h12c2 0 3.5 1.7 3 3.7l-2 10H25l-2-10c-.5-2 1-3.7 3-3.7Z" fill="#37474F" stroke="#fff" stroke-width="1.5"/>
            <circle cx="32" cy="29" r="9" fill="url(#bikeHelmet3d)" stroke="#fff" stroke-width="2"/>
            <path d="M25 26c3-3.4 11-3.4 14 0-2 2.7-12 2.7-14 0Z" fill="#17212B"/><ellipse cx="29" cy="24" rx="2.5" ry="1.4" fill="#fff" fill-opacity=".72"/>
            <rect x="28" y="55" width="8" height="3" rx="1.5" fill="#FF1744"/>
          </svg>
        </div>
      </div>`;
  }

  return `
    <div class="route-origin-model route-origin-vehicle route-origin-car-3d" aria-hidden="true">
      <div class="route-origin-bearing" style="transform:rotate(${bearingDeg}deg)">
        <svg width="56" height="64" viewBox="0 0 64 74" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="carGround3d" cx="50%" cy="35%" r="70%"><stop stop-color="#fff"/><stop offset=".72" stop-color="#E8F0FE"/><stop offset="1" stop-color="#8AB4F8"/></radialGradient>
            <linearGradient id="carBody3d" x1="17" y1="8" x2="48" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".36" stop-color="#F8FAFF"/><stop offset=".72" stop-color="#C6DAFC"/><stop offset="1" stop-color="#7BAAF7"/></linearGradient>
            <linearGradient id="carRoof3d" x1="23" y1="24" x2="43" y2="49" gradientUnits="userSpaceOnUse"><stop stop-color="#74A7FF"/><stop offset=".45" stop-color="#4285F4"/><stop offset="1" stop-color="#174EA6"/></linearGradient>
            <linearGradient id="carGlass3d" x1="22" y1="19" x2="43" y2="45" gradientUnits="userSpaceOnUse"><stop stop-color="#D2F4FF"/><stop offset=".28" stop-color="#5F8DB5"/><stop offset="1" stop-color="#17212B"/></linearGradient>
          </defs>
          <ellipse cx="32" cy="38" rx="28.5" ry="31" fill="url(#carGround3d)" stroke="#1A73E8" stroke-width="2.5"/>
          <ellipse cx="32" cy="61" rx="16" ry="6" fill="#174EA6" fill-opacity=".25"/>
          <rect x="13" y="16" width="6" height="14" rx="3" fill="#202124"/><rect x="45" y="16" width="6" height="14" rx="3" fill="#202124"/>
          <rect x="13" y="45" width="6" height="14" rx="3" fill="#202124"/><rect x="45" y="45" width="6" height="14" rx="3" fill="#202124"/>
          <path d="M13 27h6v5h-6c-2 0-2-5 0-5Zm38 0h-6v5h6c2 0 2-5 0-5Z" fill="#1967D2" stroke="#fff" stroke-width="1"/>
          <path d="M22 7c5-3 15-3 20 0 3 3 5 12 5 25v25c0 7-5 10-15 10S17 64 17 57V32c0-13 2-22 5-25Z" fill="url(#carBody3d)" stroke="#185ABC" stroke-width="2.5"/>
          <path d="M20 21c4-4 20-4 24 0l-3 10H23l-3-10Z" fill="url(#carGlass3d)" stroke="#fff" stroke-width="1.3"/>
          <rect x="22.5" y="30" width="19" height="18" rx="5" fill="url(#carRoof3d)" stroke="#fff" stroke-width="1.7"/>
          <path d="M24 33c3-2 7-2.5 11-1.5" stroke="#fff" stroke-opacity=".62" stroke-width="2" stroke-linecap="round"/>
          <path d="M23 48h18l3 8c-5 3-19 3-24 0l3-8Z" fill="url(#carGlass3d)" stroke="#fff" stroke-width="1.3"/>
          <path d="M23 9 20 19M41 9l3 10" stroke="#8AB4F8" stroke-width="1.5" stroke-linecap="round"/>
          <rect x="20" y="7" width="8" height="3.4" rx="1.7" fill="#B9F6FF"/><rect x="36" y="7" width="8" height="3.4" rx="1.7" fill="#B9F6FF"/>
          <rect x="20" y="62" width="8" height="3" rx="1.5" fill="#FF1744"/><rect x="36" y="62" width="8" height="3" rx="1.5" fill="#FF1744"/>
        </svg>
      </div>
    </div>`;
}

type CityMapProps = {
  city: CityConfig;
  initialCenter: [number, number];
  initialZoom: number;
};

export default function CityMap({ city, initialCenter, initialZoom }: CityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const routeBadgeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeAnimationRef = useRef<number | null>(null);
  const routesRef = useRef<RouteInfo[]>([]);
  const activeRouteRef = useRef<RouteInfo | null>(null);
  const activateRouteRef = useRef<(index: number, fit?: boolean) => void>(() => undefined);
  const routeOriginRef = useRef<[number, number]>([city.defaultOrigin[0], city.defaultOrigin[1]]);
  const routeDestinationRef = useRef<[number, number] | null>(null);
  const baseLayerVisibilityRef = useRef(new globalThis.Map<string, VisibilitySpecification>());
  const baseLayerPaintRef = useRef(new globalThis.Map<string, Record<string, unknown>>());
  const satellitePitchOverrideRef = useRef(false);
  const selectedBuildingRef = useRef<string | number | null>(null);
  const gpsWatchRef = useRef<number | null>(null);
  const gpsBestAccuracyRef = useRef(Number.POSITIVE_INFINITY);
  const gpsCenterOnNextFixRef = useRef(false);
  const coarseWarningShownRef = useRef(false);
  const hasGpsFixRef = useRef(false);
  const routeAfterGpsRef = useRef(false);
  const latestHeadingRef = useRef<number | null>(null);
  const travelModeRef = useRef<"driving" | "cycling" | "walking">("driving");
  const userOverrodeOriginRef = useRef(false);
  const liveNavigationRef = useRef(false);
  const directionsAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const routeSearchAbortRef = useRef<AbortController | null>(null);
  const categoryAbortRef = useRef<AbortController | null>(null);
  const detailsAbortRef = useRef<AbortController | null>(null);
  const walkWatchRef = useRef<number | null>(null);
  const walkTimerRef = useRef<number | null>(null);
  const lastWalkCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const walkPathRef = useRef<[number, number][]>([]);
  const lastRerouteAtRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [showRouting, setShowRouting] = useState(false);
  const [originQuery, setOriginQuery] = useState(city.defaultOriginLabel);
  const [destQuery, setDestQuery] = useState("");
  const [originCoord, setOriginCoord] = useState<[number, number]>([city.defaultOrigin[0], city.defaultOrigin[1]]);
  const [destCoord, setDestCoord] = useState<[number, number] | null>(null);
  const [routeField, setRouteField] = useState<"origin" | "destination" | null>(null);
  const [routePredictions, setRoutePredictions] = useState<Place[]>([]);
  const [routeSearching, setRouteSearching] = useState(false);
  const [travelMode, setTravelMode] = useState<"driving" | "cycling" | "walking">("driving");
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [liveNavigation, setLiveNavigation] = useState(false);
  const [navigationMessage, setNavigationMessage] = useState("");
  const [routing, setRouting] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("street");
  const [enable3DBuildings, setEnable3DBuildings] = useState(true);
  const [enable3DTerrain, setEnable3DTerrain] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [buildingColor, setBuildingColor] = useState("#e8eaed");
  const [waterColor, setWaterColor] = useState("#aadaff");
  const [roadColor, setRoadColor] = useState("#ffffff");
  const [buildingScale, setBuildingScale] = useState(1);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "active">("idle");
  const [showMenu, setShowMenu] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentSearches, setRecentSearches] = useState<SavedPlace[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackedDistanceMeters, setTrackedDistanceMeters] = useState(0);
  const [trackedSeconds, setTrackedSeconds] = useState(0);

  const openPlaceDetails = useCallback(async (place: Place) => {
    detailsAbortRef.current?.abort();
    const controller = new AbortController();
    detailsAbortRef.current = controller;
    setSelectedPlace(place);
    setRecentSearches((current) => {
      const next = [place, ...current.filter((item) => item.place_id !== place.place_id)].slice(0, 8);
      try { localStorage.setItem(`citymaps:${city.id}:recent`, JSON.stringify(next)); } catch {}
      return next;
    });
    setPlaceLoading(true);
    try {
      const params = new URLSearchParams({
        region: city.id,
        place_id: place.place_id,
        name: place.name,
        category: place.category,
        lat: String(place.lat),
        lng: String(place.lng),
      });
      const response = await fetch(`/api/v1/places/details?${params}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.status !== "OK") throw new Error(data.error || "Place details unavailable");
      setSelectedPlace({ ...place, ...data.place });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMapError(error instanceof Error ? error.message : "Place details could not be loaded");
      }
    } finally {
      if (detailsAbortRef.current === controller) setPlaceLoading(false);
    }
  }, [city.id]);

  const updatePlacesGeoJSON = useCallback((places: Place[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("places-source") as GeoJSONSource | undefined;
    if (!source) return;
    const clusterIcon = poiMarkerImage(places[0]?.category || "place").id;
    if (map.getLayer("clusters")) map.setLayoutProperty("clusters", "icon-image", clusterIcon);
    const featureCollection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: places.map((place) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [place.lng, place.lat] },
        properties: {
          place_id: place.place_id,
          name: place.name,
          category: place.category,
          address: place.address || "",
          icon_id: poiMarkerImage(place.category || "place").id,
        },
      })),
    };
    source.setData(featureCollection);
  }, []);

  const updateOriginAndDest3DMarkers = useCallback((
    map: maplibregl.Map,
    routeCoords: [number, number][],
    mode: "driving" | "cycling" | "walking",
    destLngLat?: [number, number],
  ) => {
    if (routeCoords.length === 0) return;
    const startPoint = routeCoords[0];
    const nextPoint = routeCoords[Math.min(3, routeCoords.length - 1)];
    const headingDegrees = getBearingDegrees(startPoint, nextPoint);

    originMarkerRef.current?.remove();
    const originElement = document.createElement("div");
    originElement.className = "route-origin-3d-marker";
    originElement.setAttribute("role", "img");
    originElement.setAttribute("aria-label", mode === "driving" ? "Car at route start" : mode === "cycling" ? "Motorcycle at route start" : "Pedestrian at route start");
    originElement.innerHTML = getOrigin3DMarkerHTML(mode, headingDegrees);
    originMarkerRef.current = new maplibregl.Marker({
      element: originElement,
      anchor: mode === "walking" ? "bottom" : "center",
      rotationAlignment: mode === "walking" ? "viewport" : "map",
      pitchAlignment: mode === "walking" ? "viewport" : "map",
    }).setLngLat(startPoint).addTo(map);

    destMarkerRef.current?.remove();
    const endPoint = destLngLat || routeCoords[routeCoords.length - 1];
    const destinationElement = document.createElement("div");
    destinationElement.className = "route-destination-flag";
    destinationElement.setAttribute("role", "img");
    destinationElement.setAttribute("aria-label", "Route destination");
    destinationElement.innerHTML = `
      <svg viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M19 1C8.5 1 1 9 1 19c0 12 18 26 18 26s18-14 18-26C37 9 29.5 1 19 1Z" fill="#EA4335" stroke="#fff" stroke-width="2.5"/>
        <path d="M14 11v17m0-16h11l-2.5 4.5L25 21H14" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    destMarkerRef.current = new maplibregl.Marker({ element: destinationElement, anchor: "bottom" })
      .setLngLat(endPoint)
      .addTo(map);
  }, []);

  const clearRouteOverlays = useCallback(() => {
    if (routeAnimationRef.current !== null) {
      cancelAnimationFrame(routeAnimationRef.current);
      routeAnimationRef.current = null;
    }
    directionsAbortRef.current?.abort();
    directionsAbortRef.current = null;
    if (walkWatchRef.current !== null) {
      navigator.geolocation.clearWatch(walkWatchRef.current);
      walkWatchRef.current = null;
    }
    if (walkTimerRef.current !== null) {
      window.clearInterval(walkTimerRef.current);
      walkTimerRef.current = null;
    }
    setIsTracking(false);
    const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    const map = mapRef.current;
    (map?.getSource("route-source") as GeoJSONSource | undefined)?.setData(empty);
    (map?.getSource("alt-route-source") as GeoJSONSource | undefined)?.setData(empty);
    (map?.getSource("connector-source") as GeoJSONSource | undefined)?.setData(empty);
    (map?.getSource("gps-walk-path-source") as GeoJSONSource | undefined)?.setData(empty);
    routeBadgeMarkersRef.current.forEach((marker) => marker.remove());
    routeBadgeMarkersRef.current = [];
    originMarkerRef.current?.remove();
    originMarkerRef.current = null;
    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
    routesRef.current = [];
    activeRouteRef.current = null;
    routeDestinationRef.current = null;
    setRouteInfo(null);
    setRoutes([]);
    setNavigationMessage("");
    setLiveNavigation(false);
    lastWalkCoordsRef.current = null;
    walkPathRef.current = [];
    setTrackedDistanceMeters(0);
    setTrackedSeconds(0);
  }, []);

  const setupCustomLayers = useCallback(async (map: maplibregl.Map) => {
    const style = map.getStyle();
    style.layers.forEach((layer) => {
      baseLayerVisibilityRef.current.set(layer.id, layer.layout?.visibility || "visible");
      const paint = (layer.paint || {}) as Record<string, unknown>;
      baseLayerPaintRef.current.set(layer.id, {
        "background-color": paint["background-color"],
        "fill-color": paint["fill-color"],
        "fill-outline-color": paint["fill-outline-color"],
        "line-color": paint["line-color"],
        "text-color": paint["text-color"],
        "text-halo-color": paint["text-halo-color"],
        "text-halo-width": paint["text-halo-width"],
      });
    });
    const vectorSourceId = Object.keys(style.sources).find((key) => style.sources[key].type === "vector") || "openmaptiles";
    const firstLabelLayerId = style.layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;
    const firstRoadLayerId = style.layers.find(
      (layer) => layer.type === "line" && /(road|street|highway|transportation)/i.test(layer.id),
    )?.id || firstLabelLayerId;
    if (!map.getSource("trichy-terrain-dem")) {
      map.addSource("trichy-terrain-dem", { type: "raster-dem", encoding: "terrarium", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 15 });
      map.addLayer({ id: "trichy-hillshade", type: "hillshade", source: "trichy-terrain-dem", layout: { visibility: "none" }, paint: { "hillshade-shadow-color": "#59636f", "hillshade-highlight-color": "#ffffff", "hillshade-exaggeration": 0.28 } }, firstLabelLayerId);
    }
    if (map.getLayer("satellite-layer")) map.removeLayer("satellite-layer");
    if (map.getSource("satellite-imagery")) map.removeSource("satellite-imagery");
    map.addSource("satellite-imagery", {
      type: "raster",
      tiles: [
        "https://mt0.google.com/vt/lyrs=y&hl=en&gl=IN&x={x}&y={y}&z={z}",
        "https://mt1.google.com/vt/lyrs=y&hl=en&gl=IN&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=y&hl=en&gl=IN&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=y&hl=en&gl=IN&x={x}&y={y}&z={z}",
      ],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 20,
    });
    map.addLayer({
      id: "satellite-layer",
      type: "raster",
      source: "satellite-imagery",
      minzoom: 0,
      maxzoom: 20.5,
      layout: { visibility: "none" },
      paint: {
        "raster-fade-duration": 300,
        "raster-resampling": "linear",
      },
    }, firstLabelLayerId);
    if (!map.getSource("dark-mode-overlay-source")) {
      map.addSource("dark-mode-overlay-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [[
              [city.bounds[0][0], city.bounds[0][1]],
              [city.bounds[1][0], city.bounds[0][1]],
              [city.bounds[1][0], city.bounds[1][1]],
              [city.bounds[0][0], city.bounds[1][1]],
              [city.bounds[0][0], city.bounds[0][1]],
            ]],
          },
        },
      });
      map.addLayer({
        id: "dark-mode-overlay",
        type: "fill",
        source: "dark-mode-overlay-source",
        layout: { visibility: "none" },
        paint: { "fill-color": "#111318", "fill-opacity": 0.68 },
      }, firstRoadLayerId);
    }
    style.layers.filter((layer) => layer.id.toLowerCase().includes("building")).forEach((layer) => {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    });
    map.addLayer({ id: "gmaps-building-2d", type: "fill", source: vectorSourceId, "source-layer": "building", minzoom: 13, paint: { "fill-color": "#f1f3f4", "fill-outline-color": "#dadce0", "fill-opacity": 0.85 } }, firstLabelLayerId);
    map.addLayer({ id: "gmaps-building-3d", type: "fill-extrusion", source: vectorSourceId, "source-layer": "building", minzoom: 14, paint: { "fill-extrusion-color": ["case", ["boolean", ["feature-state", "selected"], false], "#1a73e8", buildingColor], "fill-extrusion-height": ["*", buildingScale, ["coalesce", ["get", "render_height"], ["get", "height"], 9]], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0], "fill-extrusion-opacity": 0.92, "fill-extrusion-vertical-gradient": true } }, firstLabelLayerId);
    const markerCategories = ["restaurant", "atm", "hospital", "pharmacy", "fuel", "shopping", "temple", "hotel", "bus", "school", "airport", "parking", "place"];
    for (const category of markerCategories) {
      const marker = poiMarkerImage(category);
      if (!map.hasImage(marker.id)) {
        map.addImage(marker.id, marker.data, { pixelRatio: 1.5 });
      }
    }
    if (!map.hasImage("walking-dot-halo")) map.addImage("walking-dot-halo", circleImageData(18, "#ffffff"), { pixelRatio: 2 });
    if (!map.hasImage("walking-dot-blue")) map.addImage("walking-dot-blue", circleImageData(13, "#4285f4"), { pixelRatio: 2 });
    map.addSource("places-source", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 50,
    });
    map.addLayer({
      id: "clusters",
      type: "symbol",
      source: "places-source",
      filter: ["has", "point_count"],
      layout: {
        "icon-image": "poi-place",
        "icon-size": 1,
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    map.addLayer({
      id: "unclustered-point",
      type: "symbol",
      source: "places-source",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["get", "icon_id"],
        "icon-size": 1,
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    if (!map.getSource("alt-route-source")) map.addSource("alt-route-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    if (!map.getSource("route-source")) map.addSource("route-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    if (!map.getSource("connector-source")) map.addSource("connector-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "alt-route-casing",
      type: "line",
      source: "alt-route-source",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#5f6368", "line-width": 9, "line-opacity": 0.8 },
    }, firstLabelLayerId);
    map.addLayer({
      id: "alt-route-line",
      type: "line",
      source: "alt-route-source",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#9aa0a6", "line-width": 6, "line-opacity": 0.95 },
    }, firstLabelLayerId);
    map.addLayer({
      id: "route-casing",
      type: "line",
      source: "route-source",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#185abc",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 7, 18, 13],
      },
    }, firstLabelLayerId);
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route-source",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#4285f4",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4.5, 18, 9],
      },
    }, firstLabelLayerId);
    map.addLayer({
      id: "route-walk-halo",
      type: "symbol",
      source: "route-source",
      layout: {
        visibility: "none",
        "symbol-placement": "line",
        "symbol-spacing": 28,
        "icon-image": "walking-dot-halo",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.9, 18, 1.35],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
      },
    }, firstLabelLayerId);
    map.addLayer({
      id: "route-walk-dots",
      type: "symbol",
      source: "route-source",
      layout: {
        visibility: "none",
        "symbol-placement": "line",
        "symbol-spacing": 28,
        "icon-image": "walking-dot-blue",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.9, 18, 1.35],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "map",
      },
    }, firstLabelLayerId);
    map.addLayer({
      id: "route-origin-dest-Connectors",
      type: "line",
      source: "connector-source",
      layout: { "line-join": "round", "line-cap": "round", visibility: "none" },
      paint: { "line-color": "#5f6368", "line-width": 4, "line-dasharray": [0.05, 1.6] },
    }, firstLabelLayerId);
    map.addSource("gps-accuracy-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "gps-accuracy", type: "fill", source: "gps-accuracy-source", paint: { "fill-color": "#1a73e8", "fill-opacity": 0.13, "fill-outline-color": "#1a73e8" } });
    map.addSource("gps-position-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "gps-position-halo", type: "circle", source: "gps-position-source", paint: { "circle-radius": 13, "circle-color": "#1a73e8", "circle-opacity": 0.2 } });
    map.addLayer({ id: "gps-position", type: "circle", source: "gps-position-source", paint: { "circle-radius": 7, "circle-color": "#1a73e8", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
    map.addSource("gps-walk-path-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "gps-walk-path", type: "line", source: "gps-walk-path-source", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#1a73e8", "line-width": 5, "line-opacity": 0.9 } });
    map.on("click", "alt-route-line", (event: MapLayerMouseEvent) => {
      const routeIndex = Number(event.features?.[0]?.properties?.route_index);
      if (Number.isInteger(routeIndex)) activateRouteRef.current(routeIndex, false);
    });
    map.on("mouseenter", "alt-route-line", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "alt-route-line", () => { map.getCanvas().style.cursor = ""; });
    map.on("click", "clusters", async (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const clusterId = Number(feature.properties?.cluster_id);
      if (!Number.isFinite(clusterId)) return;
      const source = map.getSource("places-source") as GeoJSONSource | undefined;
      if (!source) return;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: 500 });
    });
    map.on("click", "unclustered-point", (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const properties = feature.properties || {};
      const coordinates = feature.geometry.coordinates as [number, number];
      void openPlaceDetails({
        place_id: String(properties.place_id || `map_${coordinates[1]}_${coordinates[0]}`),
        name: String(properties.name || "Local place"),
        category: String(properties.category || "place"),
        address: String(properties.address || city.searchName),
        lat: coordinates[1],
        lng: coordinates[0],
      });
    });
    for (const layerId of ["clusters", "unclustered-point"]) {
      map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
    }
    map.on("click", "gmaps-building-3d", (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (selectedBuildingRef.current !== null) map.removeFeatureState({ source: vectorSourceId, sourceLayer: "building", id: selectedBuildingRef.current });
      if (feature?.id !== undefined) {
        selectedBuildingRef.current = feature.id;
        map.setFeatureState({ source: vectorSourceId, sourceLayer: "building", id: feature.id }, { selected: true });
      }
    });
    map.on("click", (event) => {
      if (map.queryRenderedFeatures(event.point, { layers: ["clusters", "unclustered-point"] }).length > 0) return;
      const rendered = map.queryRenderedFeatures(event.point);
      const labeled = rendered.filter((candidate) => candidate.layer.type === "symbol" && candidate.properties?.name);
      const feature = labeled.find((candidate) => /^poi_/i.test(candidate.layer.id))
        || labeled.find((candidate) => !/(highway|road|street|water|boundary|place|country|state|city|town|village|suburb|neighbourhood)/i.test(candidate.layer.id));
      if (!feature) return;
      const properties = feature.properties || {};
      const name = String(properties.name || properties["name:en"] || properties["name:ta"] || "");
      if (!name) return;
      const category = String(properties.amenity || properties.shop || properties.tourism || properties.healthcare || properties.subclass || properties.class || "place");
      void openPlaceDetails({
        place_id: `map_${feature.id ?? `${event.lngLat.lat}_${event.lngLat.lng}`}`,
        name,
        category,
        address: city.searchName,
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      });
    });
    map.on("mouseenter", "gmaps-building-3d", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "gmaps-building-3d", () => { map.getCanvas().style.cursor = ""; });
    ensureRouteLayersOnTop(map);
    ensureGpsLayersOnTop(map);
  }, [city.bounds, city.searchName, openPlaceDetails]);

  const applyGpsPosition = useCallback((position: GeolocationPosition, moveCamera: boolean) => {
    const map = mapRef.current;
    const { longitude, latitude, accuracy } = position.coords;
    latestHeadingRef.current = position.coords.heading;
    if (!Number.isFinite(accuracy) || accuracy > MAX_USABLE_GPS_ACCURACY_METERS) {
      if (hasGpsFixRef.current) return;
      setGpsStatus("locating");
      setGpsAccuracy(null);
      if (!coarseWarningShownRef.current) {
        coarseWarningShownRef.current = true;
        const distance = Number.isFinite(accuracy) ? accuracy >= 1000 ? `${Math.round(accuracy / 1000)} km` : `${Math.round(accuracy)} m` : "unknown";
        setMapError(`Only an approximate ${distance} location is available. Turn on device Location and enable Precise location for this browser.`);
      }
      return;
    }
    if (accuracy > gpsBestAccuracyRef.current * 1.5 && hasGpsFixRef.current) return;
    gpsBestAccuracyRef.current = Math.min(gpsBestAccuracyRef.current, accuracy);
    hasGpsFixRef.current = true;
    const coordinates: [number, number] = [longitude, latitude];
    setUserLocation(coordinates);
    if (!userOverrodeOriginRef.current || liveNavigationRef.current) {
      setOriginCoord(coordinates);
      setOriginQuery("My location");
    }
    setGpsAccuracy(Math.round(accuracy));
    setGpsStatus("active");
    coarseWarningShownRef.current = false;
    setMapError("");
    if (!map) return;
    const point: GeoJSON.Feature<GeoJSON.Point> = { type: "Feature", properties: { accuracy }, geometry: { type: "Point", coordinates } };
    (map.getSource("gps-position-source") as GeoJSONSource | undefined)?.setData(point);
    (map.getSource("gps-accuracy-source") as GeoJSONSource | undefined)?.setData(accuracyCircle(longitude, latitude, accuracy));
    ensureGpsLayersOnTop(map);
    if (liveNavigationRef.current) {
      originMarkerRef.current?.setLngLat(coordinates);
      if (position.coords.heading !== null && Number.isFinite(position.coords.heading)) {
        const markerBearing = originMarkerRef.current?.getElement().querySelector<HTMLElement>(".route-origin-bearing");
        if (markerBearing) markerBearing.style.transform = `rotate(${position.coords.heading}deg)`;
      }
    }
    if (moveCamera || gpsCenterOnNextFixRef.current) {
      gpsCenterOnNextFixRef.current = false;
      const constrainedBounds = map.getMaxBounds();
      if (constrainedBounds && !constrainedBounds.contains(coordinates)) {
        map.setMaxBounds(null);
      }
      map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 16), duration: 850 });
    }
  }, []);

  const locatePrecisely = useCallback((moveCamera = true) => {
    if (!window.isSecureContext) {
      setMapError("Precise GPS requires HTTPS. Open this map through HTTPS or localhost, then allow location access.");
      return;
    }
    if (!navigator.geolocation) {
      setMapError("GPS location is not supported by this browser.");
      return;
    }
    if (moveCamera) {
      gpsBestAccuracyRef.current = Number.POSITIVE_INFINITY;
      gpsCenterOnNextFixRef.current = true;
      coarseWarningShownRef.current = false;
      hasGpsFixRef.current = false;
      setUserLocation(null);
      setGpsAccuracy(null);
    }
    setGpsStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => applyGpsPosition(position, moveCamera),
      (error) => {
        if (!hasGpsFixRef.current) setGpsStatus("idle");
        if (error.code === error.PERMISSION_DENIED) setMapError("Location is blocked. Enable Location and Precise location for this site in browser permissions, then tap My location again.");
        else if (error.code === error.POSITION_UNAVAILABLE) setMapError("No device GPS fix is available. Turn on system Location and enable Precise location for this browser.");
        else if (!hasGpsFixRef.current) setMapError("GPS is still unavailable. Keep device Location enabled and tap My location again.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
    if (gpsWatchRef.current === null) {
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        (position) => applyGpsPosition(position, false),
        (error) => {
          if (!hasGpsFixRef.current) setGpsStatus("idle");
          if (error.code === error.PERMISSION_DENIED) setMapError("Location is blocked. Enable Location and Precise location for this site, then try again.");
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 60_000 },
      );
    }
  }, [applyGpsPosition]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: initialCenter, zoom: initialZoom, pitch: 45, bearing: -10,
      attributionControl: false, maxPitch: 75, maxZoom: 19.8,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      maxBounds: [
        [city.bounds[0][0], city.bounds[0][1]],
        [city.bounds[1][0], city.bounds[1][1]],
      ],
    });
    mapRef.current = map;
    (window as unknown as { __cityMap: maplibregl.Map }).__cityMap = map;
    map.on("load", async () => {
      map.setMaxZoom(19.8);
      try {
        await setupCustomLayers(map);
        setMapReady(true);
      } catch (error) {
        setMapError(error instanceof Error ? error.message : "Map layers could not be initialized");
      }
    });
    map.on("error", (event) => setMapError(event.error?.message || "Map data could not be loaded"));
    map.on("contextmenu", async (event) => {
      const { lat, lng } = event.lngLat;
      const response = await fetch(`/api/v1/geocode/reverse?region=${city.id}&lat=${lat}&lng=${lng}`);
      const data = await response.json();
      if (data.status === "OK") setSelectedPlace({ place_id: data.place_id, name: data.name, category: "Pinned location", address: data.address, lat, lng });
    });
    return () => {
      routeBadgeMarkersRef.current.forEach((marker) => marker.remove());
      originMarkerRef.current?.remove();
      destMarkerRef.current?.remove();
      if (routeAnimationRef.current !== null) cancelAnimationFrame(routeAnimationRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [city, initialCenter, initialZoom, setupCustomLayers]);

  useEffect(() => {
    return () => {
      if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      directionsAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      routeSearchAbortRef.current?.abort();
      detailsAbortRef.current?.abort();
      if (walkWatchRef.current !== null) navigator.geolocation.clearWatch(walkWatchRef.current);
      if (walkTimerRef.current !== null) window.clearInterval(walkTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    liveNavigationRef.current = liveNavigation;
  }, [liveNavigation]);

  useEffect(() => {
    try {
      setSavedPlaces(JSON.parse(localStorage.getItem(`citymaps:${city.id}:saved`) || "[]"));
      setRecentSearches(JSON.parse(localStorage.getItem(`citymaps:${city.id}:recent`) || "[]"));
    } catch {
      setSavedPlaces([]);
      setRecentSearches([]);
    }
  }, [city.id]);

  useEffect(() => {
    const instruction = routeInfo?.steps[0]?.instruction;
    if (!instruction || voiceMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(instruction);
    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }, [routeInfo, voiceMuted]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.isStyleLoaded()) return;
    const style = map.getStyle();
    if (!style?.layers) return;
    const customLayerIds = new Set([
      "satellite-layer", "dark-mode-overlay", "trichy-hillshade", "gmaps-building-2d", "gmaps-building-3d",
      "clusters", "unclustered-point",
      "alt-route-casing", "alt-route-line", "route-casing", "route-line",
      "route-walk-halo", "route-walk-dots", "route-origin-dest-Connectors",
      "gps-accuracy", "gps-position-halo", "gps-position", "gps-walk-path",
    ]);
    style.layers.forEach((layer) => {
      if (customLayerIds.has(layer.id) || !map.getLayer(layer.id)) return;
      const originalVisibility = baseLayerVisibilityRef.current.get(layer.id) || "visible";
      map.setLayoutProperty(
        layer.id,
        "visibility",
        mapMode === "satellite" && layer.type !== "symbol" && layer.type !== "background" ? "none" : originalVisibility,
      );
    });
    const dark = mapMode === "dark";
    map.getCanvasContainer().style.backgroundColor = mapMode === "satellite" ? "#111318" : "#f8f9fa";
    if (map.getLayer("satellite-layer")) map.setLayoutProperty("satellite-layer", "visibility", mapMode === "satellite" ? "visible" : "none");
    if (map.getLayer("dark-mode-overlay")) map.setLayoutProperty("dark-mode-overlay", "visibility", dark ? "visible" : "none");
    if (map.getLayer("gmaps-building-3d")) {
      map.setLayoutProperty("gmaps-building-3d", "visibility", enable3DBuildings ? "visible" : "none");
      map.setPaintProperty("gmaps-building-3d", "fill-extrusion-color", ["case", ["boolean", ["feature-state", "selected"], false], dark ? "#8ab4f8" : "#1a73e8", dark ? "#2a2c30" : buildingColor]);
      map.setPaintProperty("gmaps-building-3d", "fill-extrusion-height", ["*", buildingScale, ["coalesce", ["get", "render_height"], ["get", "height"], 9]]);
      map.setPaintProperty("gmaps-building-3d", "fill-extrusion-opacity", mapMode === "satellite" ? 0.25 : 0.92);
    }
    if (map.getLayer("gmaps-building-2d")) {
      map.setLayoutProperty("gmaps-building-2d", "visibility", mapMode === "satellite" ? "none" : "visible");
      map.setPaintProperty("gmaps-building-2d", "fill-color", dark ? "#2a2c30" : buildingColor);
      map.setPaintProperty("gmaps-building-2d", "fill-outline-color", dark ? "#3c4043" : "#dadce0");
    }
    style.layers.forEach((layer) => {
      if (!map.getLayer(layer.id)) return;
      const originalPaint = baseLayerPaintRef.current.get(layer.id);
      if (originalPaint) {
        for (const key of ["background-color", "fill-color", "fill-outline-color", "line-color", "text-color", "text-halo-color", "text-halo-width"]) {
          if (originalPaint[key] !== undefined) map.setPaintProperty(layer.id, key as any, originalPaint[key] as any);
        }
      }
      const id = layer.id.toLowerCase();
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", mapMode === "satellite" ? "#111318" : dark ? "#202124" : "#f8f9fa");
      }
      if (layer.type === "fill") {
        if (id.includes("water")) {
          map.setPaintProperty(layer.id, "fill-color", dark ? "#1f2a37" : waterColor);
        } else if (dark) {
          let fill = "#24262a";
          if (/park|wood|grass|landcover/.test(id)) fill = "#1d2a22";
          else if (/hospital|school|pitch|track|cemetery|aeroway|building/.test(id)) fill = "#2a2c30";
          map.setPaintProperty(layer.id, "fill-color", fill);
          if (id.includes("building")) map.setPaintProperty(layer.id, "fill-outline-color", "#3c4043");
        }
      }
      if (layer.type === "line") {
        if (id.includes("waterway")) {
          map.setPaintProperty(layer.id, "line-color", dark ? "#1f2a37" : waterColor);
        } else if (/(road|street|highway|bridge)/i.test(id)) {
          map.setPaintProperty(
            layer.id,
            "line-color",
            dark
              ? /casing/i.test(id)
                ? "#2b2d30"
                : /motorway|trunk|primary/i.test(id)
                  ? "#5f6368"
                  : "#4a4d51"
              : roadColor,
          );
        } else if (dark) {
          map.setPaintProperty(
            layer.id,
            "line-color",
            /rail|transit|aeroway|runway|taxiway|path|pedestrian/i.test(id)
              ? "#3c4043"
              : /boundary/i.test(id)
                ? "#5f6368"
                : "#4a4d51",
          );
        }
      }
      if (layer.type === "symbol") {
        const darkLabels = dark || mapMode === "satellite";
        map.setPaintProperty(layer.id, "text-color", darkLabels ? "#e8eaed" : "#202124");
        map.setPaintProperty(layer.id, "text-halo-color", darkLabels ? "rgba(20, 24, 30, 0.96)" : "rgba(255, 255, 255, 0.98)");
        map.setPaintProperty(layer.id, "text-halo-width", 2.2);
        map.setPaintProperty(layer.id, "text-halo-blur", 0.4);
      }
    });
    if (mapMode === "satellite") {
      map.setTerrain(null);
      if (map.getLayer("trichy-hillshade")) map.setLayoutProperty("trichy-hillshade", "visibility", "none");
      if (!satellitePitchOverrideRef.current && map.getPitch() !== 0) map.easeTo({ pitch: 0, duration: 450 });
    } else if (enable3DTerrain && map.getSource("trichy-terrain-dem")) {
      map.setTerrain({ source: "trichy-terrain-dem", exaggeration: 1.5 });
      map.setLayoutProperty("trichy-hillshade", "visibility", "visible");
    } else {
      map.setTerrain(null);
      if (map.getLayer("trichy-hillshade")) map.setLayoutProperty("trichy-hillshade", "visibility", "none");
    }
    ensureRouteLayersOnTop(map);
    ensureGpsLayersOnTop(map);
  }, [mapReady, mapMode, enable3DBuildings, enable3DTerrain, buildingColor, waterColor, roadColor, buildingScale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer("gps-position-halo")) return;
    if (gpsStatus !== "active") {
      map.setPaintProperty("gps-position-halo", "circle-radius", 13);
      map.setPaintProperty("gps-position-halo", "circle-opacity", 0.2);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.setPaintProperty("gps-position-halo", "circle-radius", 16);
      map.setPaintProperty("gps-position-halo", "circle-opacity", 0.22);
      return;
    }
    let animationFrame = 0;
    const pulseDuration = 1_650;
    const animatePulse = (timestamp: number) => {
      const phase = (timestamp % pulseDuration) / pulseDuration;
      const eased = 1 - (1 - phase) ** 2;
      map.setPaintProperty("gps-position-halo", "circle-radius", 10 + eased * 23);
      map.setPaintProperty("gps-position-halo", "circle-opacity", (1 - phase) * 0.34);
      animationFrame = window.requestAnimationFrame(animatePulse);
    };
    animationFrame = window.requestAnimationFrame(animatePulse);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [gpsStatus, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.isStyleLoaded()) return;
    travelModeRef.current = travelMode;
    const isWalking = travelMode === "walking";
    const isBike = travelMode === "cycling";
    ["route-line", "route-casing"].forEach((layerId) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", isWalking ? "none" : "visible");
    });
    ["route-walk-dots", "route-walk-halo", "route-origin-dest-Connectors"].forEach((layerId) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", isWalking ? "visible" : "none");
    });
    ["alt-route-casing", "alt-route-line"].forEach((layerId) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "visible");
    });
    if (map.getLayer("route-line")) map.setPaintProperty("route-line", "line-color", isBike ? "#00acc1" : "#4285f4");
    if (map.getLayer("route-casing")) map.setPaintProperty("route-casing", "line-color", isBike ? "#006064" : "#185abc");
    const activeRoute = activeRouteRef.current;
    if (activeRoute) {
      updateOriginAndDest3DMarkers(
        map,
        activeRoute.geometry.coordinates as [number, number][],
        travelMode,
        routeDestinationRef.current || activeRoute.snapped_destination,
      );
    }
  }, [mapReady, travelMode, updateOriginAndDest3DMarkers]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    const timer = window.setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearching(true);
      try {
        const center = userLocation ? { lng: userLocation[0], lat: userLocation[1] } : mapRef.current?.getCenter() || { lat: city.center[1], lng: city.center[0] };
        const response = await fetch(`/api/v1/places/search?region=${city.id}&q=${encodeURIComponent(searchQuery)}&lat=${center.lat}&lng=${center.lng}`, { signal: controller.signal });
        const data = await response.json();
        const results: Place[] = data.results || [];
        setSearchResults(results);
        updatePlacesGeoJSON(results);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSearchResults([]);
      } finally {
        if (searchAbortRef.current === controller) setSearching(false);
      }
    }, 280);
    return () => { window.clearTimeout(timer); searchAbortRef.current?.abort(); };
  }, [city, searchQuery, updatePlacesGeoJSON, userLocation]);

  useEffect(() => {
    if (!routeField) { setRoutePredictions([]); return; }
    const query = routeField === "origin" ? originQuery : destQuery;
    if (query.trim().length < 2 || query === "My location") { setRoutePredictions([]); return; }
    const timer = window.setTimeout(async () => {
      routeSearchAbortRef.current?.abort();
      const controller = new AbortController();
      routeSearchAbortRef.current = controller;
      setRouteSearching(true);
      try {
        const center = userLocation ? { lng: userLocation[0], lat: userLocation[1] } : mapRef.current?.getCenter() || { lat: city.center[1], lng: city.center[0] };
        const response = await fetch(`/api/v1/places/search?region=${city.id}&q=${encodeURIComponent(query)}&lat=${center.lat}&lng=${center.lng}&limit=8`, { signal: controller.signal });
        const data = await response.json();
        setRoutePredictions(data.results || []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setRoutePredictions([]);
      } finally {
        if (routeSearchAbortRef.current === controller) setRouteSearching(false);
      }
    }, 260);
    return () => { window.clearTimeout(timer); routeSearchAbortRef.current?.abort(); };
  }, [city, routeField, originQuery, destQuery, userLocation]);

  const activateRoute = useCallback((routeIndex: number, fit = true) => {
    const map = mapRef.current;
    const selected = routesRef.current.find((route) => route.route_index === routeIndex);
    if (!map || !selected) return;
    activeRouteRef.current = selected;
    setRouteInfo(selected);

    const alternatives = routesRef.current
      .filter((route) => route.route_index !== routeIndex)
      .map((route) => ({
        type: "Feature" as const,
        properties: { route_index: route.route_index },
        geometry: route.geometry,
    }));
    (map.getSource("alt-route-source") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: alternatives });

    const requestedDestination = routeDestinationRef.current;
    const connectorFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [
      {
        type: "Feature",
        properties: { endpoint: "origin" },
        geometry: { type: "LineString", coordinates: [routeOriginRef.current, selected.snapped_origin] },
      },
      ...(requestedDestination ? [{
        type: "Feature" as const,
        properties: { endpoint: "destination" },
        geometry: { type: "LineString" as const, coordinates: [selected.snapped_destination, requestedDestination] },
      }] : []),
    ];
    (map.getSource("connector-source") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: connectorFeatures });

    routeBadgeMarkersRef.current.forEach((marker) => marker.remove());
    routeBadgeMarkersRef.current = routesRef.current.map((route) => {
      const badge = document.createElement("button");
      badge.className = `route-eta-badge${route.route_index === routeIndex ? " active" : ""}`;
      badge.type = "button";
      badge.innerHTML = `<strong>${route.duration_text}</strong><span>${route.distance_text}</span>`;
      badge.setAttribute("aria-label", `Choose ${route.duration_text} route, ${route.distance_text}`);
      badge.addEventListener("click", (event) => {
        event.stopPropagation();
        activateRouteRef.current(route.route_index, false);
      });
      return new maplibregl.Marker({ element: badge, anchor: "center" }).setLngLat(route.midpoint_lnglat).addTo(map);
    });

    const routeSource = map.getSource("route-source") as GeoJSONSource | undefined;
    const coordinates = selected.geometry.coordinates as [number, number][];
    updateOriginAndDest3DMarkers(
      map,
      coordinates,
      travelModeRef.current,
      requestedDestination || selected.snapped_destination,
    );
    if (routeAnimationRef.current !== null) cancelAnimationFrame(routeAnimationRef.current);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || coordinates.length < 3) {
      routeSource?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { route_index: routeIndex }, geometry: selected.geometry }],
      });
    } else {
      const startedAt = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / 720);
        const eased = 1 - (1 - progress) ** 4;
        const visibleCount = Math.max(2, Math.ceil(eased * coordinates.length));
        routeSource?.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: { route_index: routeIndex },
            geometry: { type: "LineString", coordinates: coordinates.slice(0, visibleCount) },
          }],
        });
        if (progress < 1) routeAnimationRef.current = requestAnimationFrame(animate);
        else routeAnimationRef.current = null;
      };
      routeAnimationRef.current = requestAnimationFrame(animate);
    }

    if (fit && coordinates.length > 1) {
      const bounds = coordinates.slice(1).reduce(
        (value, coordinate) => value.extend(coordinate),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: { top: 110, right: 90, bottom: 110, left: 430 }, duration: reducedMotion ? 0 : 850, maxZoom: 16 });
    }
    ensureRouteLayersOnTop(map);
  }, [updateOriginAndDest3DMarkers]);
  activateRouteRef.current = activateRoute;

  const handleCategoryClick = async (category: string) => {
    categoryAbortRef.current?.abort();
    const controller = new AbortController();
    categoryAbortRef.current = controller;
    setActiveCategory(category);
    setLoadingCategory(category);
    setMapError("");
    const map = mapRef.current;
    const center = map?.getCenter() || { lat: city.center[1], lng: city.center[0] };
    const bounds = map?.getBounds();
    const northEast = bounds?.getNorthEast();
    const viewportRadius = northEast
      ? calculateDistanceMeters(center.lat, center.lng, northEast.lat, northEast.lng)
      : 6_000;
    const radius = Math.min(15_000, Math.max(500, Math.ceil(viewportRadius * 1.1)));
    try {
      const response = await fetch(`/api/v1/places/nearby?region=${city.id}&category=${category}&lat=${center.lat}&lng=${center.lng}&radius_meters=${radius}&limit=200`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.status !== "OK") throw new Error(data.error || "Nearby places are unavailable");
      const places: Place[] = (data.places || []).filter((place: Place) => !bounds || bounds.contains([place.lng, place.lat]));
      setSearchResults(places);
      updatePlacesGeoJSON(places);
      if (places.length === 0) setMapError(`No ${category} places were found in this map view. Pan or zoom out to search another area.`);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMapError(error instanceof Error ? error.message : "Nearby places could not be loaded");
      }
    } finally {
      if (categoryAbortRef.current === controller) setLoadingCategory(null);
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !activeCategory) return;
    let refreshTimer: number | null = null;
    const refreshVisibleCategory = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void handleCategoryClick(activeCategory), 280);
    };
    map.on("moveend", refreshVisibleCategory);
    return () => {
      map.off("moveend", refreshVisibleCategory);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [activeCategory, mapReady]);

  const calculateRoute = async (
    destLat: number,
    destLng: number,
    destName?: string,
    routeOrigin: [number, number] = originCoord,
    routeMode: "driving" | "cycling" | "walking" = travelMode,
    heading: number | null = null,
  ) => {
    travelModeRef.current = routeMode;
    directionsAbortRef.current?.abort();
    const controller = new AbortController();
    directionsAbortRef.current = controller;
    setShowRouting(true);
    setRouting(true);
    routeOriginRef.current = routeOrigin;
    routeDestinationRef.current = [destLng, destLat];
    setDestCoord([destLng, destLat]);
    if (destName) setDestQuery(destName);
    try {
      const bearingParam = heading !== null && Number.isFinite(heading) ? `&bearing=${heading}` : "";
      const response = await fetch(`/api/v1/directions?origin=${routeOrigin[1]},${routeOrigin[0]}&destination=${destLat},${destLng}&mode=${routeMode}${bearingParam}`, { signal: controller.signal });
      const data = await response.json();
      const nextRoutes: RouteInfo[] = data.routes || [];
      if (!response.ok || nextRoutes.length === 0) throw new Error(data.error || "No route was found between these places");
      routesRef.current = nextRoutes;
      setRoutes(nextRoutes);
      setNavigationMessage(heading !== null ? "Route updated from your current position" : "");
      const map = mapRef.current;
      const bestRoute = nextRoutes[0];
      if (map) {
        if (!map.getSource("route-source")) map.addSource("route-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        if (!map.getSource("alt-route-source")) map.addSource("alt-route-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        if (!map.getSource("connector-source")) map.addSource("connector-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

        const primaryGeoJSON: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: { route_index: bestRoute.route_index },
            geometry: bestRoute.geometry,
          }],
        };
        (map.getSource("route-source") as GeoJSONSource).setData(primaryGeoJSON);

        const alternativeGeoJSON: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: nextRoutes.slice(1).map((route) => ({
            type: "Feature",
            properties: { route_index: route.route_index },
            geometry: route.geometry,
          })),
        };
        (map.getSource("alt-route-source") as GeoJSONSource).setData(alternativeGeoJSON);

        const routeCoordinates = bestRoute.geometry.coordinates as [number, number][];
        const connectorGeoJSON: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: routeCoordinates.length > 1 ? [
            {
              type: "Feature",
              properties: { endpoint: "origin" },
              geometry: { type: "LineString", coordinates: [routeOrigin, routeCoordinates[0]] },
            },
            {
              type: "Feature",
              properties: { endpoint: "destination" },
              geometry: { type: "LineString", coordinates: [[destLng, destLat], routeCoordinates[routeCoordinates.length - 1]] },
            },
          ] : [],
        };
        (map.getSource("connector-source") as GeoJSONSource).setData(connectorGeoJSON);

        const isWalking = routeMode === "walking";
        ["route-casing", "route-line"].forEach((layerId) => {
          if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", isWalking ? "none" : "visible");
        });
        ["route-walk-halo", "route-walk-dots", "route-origin-dest-Connectors"].forEach((layerId) => {
          if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", isWalking ? "visible" : "none");
        });
        ["alt-route-casing", "alt-route-line"].forEach((layerId) => {
          if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "visible");
        });
        ensureRouteLayersOnTop(map);
      }
      activateRouteRef.current(nextRoutes[0].route_index, heading === null);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMapError(error instanceof Error ? error.message : "Route could not be calculated");
    } finally {
      if (directionsAbortRef.current === controller) setRouting(false);
    }
  };

  const choosePlace = (place: Place) => {
    void openPlaceDetails(place); updatePlacesGeoJSON([place]); setSearchResults([]);
    mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 17, pitch: 55 });
  };

  const chooseRoutePlace = (field: "origin" | "destination", place: Place) => {
    const coordinates: [number, number] = [place.lng, place.lat];
    setRouteField(null);
    setRoutePredictions([]);
    if (field === "origin") {
      userOverrodeOriginRef.current = true;
      setOriginQuery(place.name);
      setOriginCoord(coordinates);
      if (destCoord) void calculateRoute(destCoord[1], destCoord[0], destQuery, coordinates);
    } else {
      setDestQuery(place.name);
      setDestCoord(coordinates);
      void calculateRoute(place.lat, place.lng, place.name);
    }
  };

  const useGpsAsOrigin = () => {
    userOverrodeOriginRef.current = false;
    setRouteField(null);
    if (userLocation) {
      setOriginCoord(userLocation);
      setOriginQuery("My location");
      if (destCoord) void calculateRoute(destCoord[1], destCoord[0], destQuery, userLocation);
    } else {
      routeAfterGpsRef.current = true;
      locatePrecisely(true);
    }
  };

  const changeTravelMode = (mode: "driving" | "cycling" | "walking") => {
    travelModeRef.current = mode;
    setTravelMode(mode);
    if (destCoord) void calculateRoute(destCoord[1], destCoord[0], destQuery, originCoord, mode);
  };

  const toggleSavedPlace = (place: Place) => {
    setSavedPlaces((current) => {
      const exists = current.some((item) => item.place_id === place.place_id);
      const next = exists ? current.filter((item) => item.place_id !== place.place_id) : [place, ...current];
      try { localStorage.setItem(`citymaps:${city.id}:saved`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const sharePlace = async (place: Place) => {
    const url = new URL(window.location.href);
    url.searchParams.set("region", city.id);
    url.searchParams.set("lat", String(place.lat));
    url.searchParams.set("lng", String(place.lng));
    url.searchParams.set("z", "18");
    try {
      const usedNativeShare = typeof navigator.share === "function";
      if (usedNativeShare) await navigator.share({ title: place.name, text: place.address, url: url.toString() });
      else await navigator.clipboard.writeText(url.toString());
      setNavigationMessage(usedNativeShare ? "Place shared" : "Place link copied");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMapError("The place link could not be shared.");
    }
  };

  const stopWalkingTracking = useCallback(() => {
    if (walkWatchRef.current !== null) {
      navigator.geolocation.clearWatch(walkWatchRef.current);
      walkWatchRef.current = null;
    }
    if (walkTimerRef.current !== null) {
      window.clearInterval(walkTimerRef.current);
      walkTimerRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startWalkingTracking = useCallback(() => {
    if (!window.isSecureContext) {
      setMapError("Walking GPS requires HTTPS or localhost. Open the secure map and allow precise location access.");
      return;
    }
    if (!navigator.geolocation) {
      setMapError("Geolocation is not supported by this browser.");
      return;
    }
    stopWalkingTracking();
    setMapError("");
    setIsTracking(true);
    setTrackedDistanceMeters(0);
    setTrackedSeconds(0);
    lastWalkCoordsRef.current = null;
    walkPathRef.current = [];
    (mapRef.current?.getSource("gps-walk-path-source") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: [] });
    walkTimerRef.current = window.setInterval(() => setTrackedSeconds((seconds) => seconds + 1), 1000);
    walkWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, heading } = position.coords;
        if (!Number.isFinite(accuracy) || accuracy > 30) return;
        const coordinates: [number, number] = [longitude, latitude];
        const currentPoint = { lat: latitude, lng: longitude };
        const previousPoint = lastWalkCoordsRef.current;
        const map = mapRef.current;
        setUserLocation(coordinates);
        setGpsAccuracy(Math.round(accuracy));
        setGpsStatus("active");
        latestHeadingRef.current = heading;
        (map?.getSource("gps-position-source") as GeoJSONSource | undefined)?.setData({ type: "Feature", properties: { accuracy }, geometry: { type: "Point", coordinates } });
        (map?.getSource("gps-accuracy-source") as GeoJSONSource | undefined)?.setData(accuracyCircle(longitude, latitude, accuracy));
        if (liveNavigationRef.current) {
          originMarkerRef.current?.setLngLat(coordinates);
          if (heading !== null && Number.isFinite(heading)) {
            const markerBearing = originMarkerRef.current?.getElement().querySelector<HTMLElement>(".route-origin-bearing");
            if (markerBearing) markerBearing.style.transform = `rotate(${heading}deg)`;
          }
        }
        if (!previousPoint) {
          lastWalkCoordsRef.current = currentPoint;
          walkPathRef.current = [coordinates];
          return;
        }
        const movement = calculateDistanceMeters(previousPoint.lat, previousPoint.lng, latitude, longitude);
        if (movement < 1) return;
        lastWalkCoordsRef.current = currentPoint;
        walkPathRef.current = [...walkPathRef.current, coordinates];
        setTrackedDistanceMeters((distance) => distance + movement);
        if (walkPathRef.current.length > 1) {
          (map?.getSource("gps-walk-path-source") as GeoJSONSource | undefined)?.setData({
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: walkPathRef.current } }],
          });
          if (map) ensureRouteLayersOnTop(map);
        }
      },
      (error) => {
        setMapError(`GPS error: ${error.message}`);
        stopWalkingTracking();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }, [stopWalkingTracking]);

  const toggleLiveNavigation = () => {
    if (liveNavigation) {
      setLiveNavigation(false);
      setNavigationMessage("Navigation paused");
      if (travelMode === "walking") stopWalkingTracking();
      return;
    }
    if (!destCoord || !activeRouteRef.current) {
      setMapError("Choose a start and destination before starting live navigation.");
      return;
    }
    setLiveNavigation(true);
    setNavigationMessage("Getting your precise location…");
    if (travelMode === "walking" && !isTracking) startWalkingTracking();
    if (userLocation) {
      setOriginCoord(userLocation);
      setOriginQuery("My location");
      lastRerouteAtRef.current = Date.now();
      void calculateRoute(destCoord[1], destCoord[0], destQuery, userLocation, travelMode, latestHeadingRef.current);
    } else {
      routeAfterGpsRef.current = true;
      locatePrecisely(true);
    }
  };

  useEffect(() => {
    if (travelMode !== "walking" && isTracking) stopWalkingTracking();
  }, [isTracking, stopWalkingTracking, travelMode]);

  useEffect(() => {
    if (!userLocation || !routeAfterGpsRef.current) return;
    routeAfterGpsRef.current = false;
    if (destCoord) {
      lastRerouteAtRef.current = Date.now();
      void calculateRoute(destCoord[1], destCoord[0], destQuery, userLocation, travelMode, latestHeadingRef.current);
    }
  }, [userLocation]);

  useEffect(() => {
    if (!liveNavigation || !userLocation || !destCoord || !activeRouteRef.current) return;
    const routeCoordinates = activeRouteRef.current.geometry.coordinates as [number, number][];
    const deviation = getDistanceFromRouteMeters(userLocation, routeCoordinates);
    if (deviation <= 35) {
      setNavigationMessage(`On route · GPS ±${gpsAccuracy ?? "—"} m`);
      return;
    }
    if (Date.now() - lastRerouteAtRef.current < 12_000) return;
    lastRerouteAtRef.current = Date.now();
    setNavigationMessage(`Rerouting · ${Math.round(deviation)} m off route`);
    setOriginCoord(userLocation);
    setOriginQuery("My location");
    void calculateRoute(destCoord[1], destCoord[0], destQuery, userLocation, travelMode, latestHeadingRef.current);
  }, [userLocation, liveNavigation, destCoord, gpsAccuracy, travelMode]);

  const landmarks = city.id === "trichy" ? TRICHY_LANDMARKS : CHENNAI_LANDMARKS;
  const selectedPlaceSaved = selectedPlace ? savedPlaces.some((place) => place.place_id === selectedPlace.place_id) : false;

  return <main className={`trichy-map-app ${mapMode === "dark" ? "map-dark" : ""}`}>
    <div ref={mapContainerRef} className="trichy-map-canvas" />
    {mapError && <div className="map-alert" role="alert"><span>{mapError}</span><button onClick={() => setMapError("")} aria-label="Dismiss error"><X size={16} /></button></div>}

    <section className="search-stack" aria-label={`Search ${city.name}`}>
      <div className="map-searchbox">
        <button className="menu-button" onClick={() => setShowMenu(true)} aria-label="Open saved places and map menu"><Menu size={20} /></button>
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Search ${city.name} places, shops, streets`} aria-label="Search places" />
        {searching ? <span className="search-spinner" aria-label="Searching" /> : <Search size={19} aria-hidden="true" />}
        <button onClick={() => { if (showRouting) clearRouteOverlays(); setShowRouting((value) => !value); }} className="directions-button"><Navigation size={17} />Directions</button>
      </div>
      {searchResults.length > 0 && <div className="trichy-results">
        {searchResults.map((place) => <button key={place.place_id} onClick={() => choosePlace(place)}>
          <MapPin size={17} /><span><strong>{place.name}</strong><small>{place.address}</small></span>{place.distance_meters !== undefined && <em>{place.distance_meters < 1000 ? `${place.distance_meters} m` : `${(place.distance_meters / 1000).toFixed(1)} km`}</em>}
        </button>)}
      </div>}
    </section>

    {showMenu && <aside className="saved-drawer" aria-label="Saved places and map shortcuts">
      <header><strong>City Maps</strong><button onClick={() => setShowMenu(false)} aria-label="Close menu"><X size={19} /></button></header>
      <section><h2><Bookmark size={16} />Saved places</h2>{savedPlaces.length ? savedPlaces.map((place) => <button key={place.place_id} onClick={() => { choosePlace(place); setShowMenu(false); }}><MapPin size={16} /><span><strong>{place.name}</strong><small>{place.address}</small></span></button>) : <p>No saved places yet. Open a place and tap Save.</p>}</section>
      <section><h2><Clock3 size={16} />Recent searches</h2>{recentSearches.length ? recentSearches.map((place) => <button key={place.place_id} onClick={() => { choosePlace(place); setShowMenu(false); }}><Clock3 size={15} /><span><strong>{place.name}</strong><small>{place.address}</small></span></button>) : <p>Your recent places will appear here.</p>}</section>
      <section><h2><Star size={16} />Quick jump in {city.name}</h2>{landmarks.map((place) => <button key={place.place_id} onClick={() => { choosePlace(place); setShowMenu(false); }}><MapPin size={16} /><span><strong>{place.name}</strong><small>{place.address}</small></span></button>)}</section>
      <footer><button onClick={() => window.print()}><Printer size={16} />Print map</button><button onClick={() => void navigator.clipboard.writeText(window.location.href)}><Share2 size={16} />Copy map link</button></footer>
    </aside>}

    <nav className="category-chips" aria-label="Nearby categories">
      {CATEGORIES.map(([id, label]) => {
        const loading = loadingCategory === id;
        return <button key={id} className={activeCategory === id ? "active" : ""} onClick={() => void handleCategoryClick(id)} disabled={loading} aria-busy={loading}>
          {loading && <span className="category-spinner" aria-hidden="true" />}
          <span>{loading ? "Loading…" : label}</span>
        </button>;
      })}
    </nav>

    {showRouting && <aside className="route-panel">
      <header><div><span>Route planner</span><strong>{city.name}</strong></div><div className="route-header-actions"><button onClick={() => { setVoiceMuted((value) => { if (!value) window.speechSynthesis?.cancel(); return !value; }); }} aria-label={voiceMuted ? "Unmute voice guidance" : "Mute voice guidance"} aria-pressed={voiceMuted}>{voiceMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><button onClick={() => { clearRouteOverlays(); setShowRouting(false); }} aria-label="Close directions"><X size={19} /></button></div></header>
      <div className="travel-tabs">{(["driving", "cycling", "walking"] as const).map((mode) => <button key={mode} className={travelMode === mode ? "active" : ""} onClick={() => changeTravelMode(mode)}>{mode === "driving" ? <Car size={17} /> : mode === "cycling" ? <Navigation size={17} /> : <MapPin size={17} />}{mode === "driving" ? "Car" : mode === "cycling" ? "Bike" : "Walk"}</button>)}</div>
      <div className="route-field-wrap">
        <label>Start<input value={originQuery} onFocus={() => setRouteField("origin")} onChange={(event) => { userOverrodeOriginRef.current = true; setOriginQuery(event.target.value); setRouteField("origin"); }} autoComplete="off" /></label>
        {routeField === "origin" && <div className="route-field-results">
          <button className="use-location-option" onMouseDown={(event) => event.preventDefault()} onClick={useGpsAsOrigin}><LocateFixed size={17} /><span><strong>{userLocation ? "My current location" : "Use precise GPS location"}</strong><small>{gpsAccuracy !== null ? `GPS accuracy ±${gpsAccuracy} m` : "Uses this device's location"}</small></span></button>
          {routeSearching && <p>Searching places…</p>}
          {routePredictions.map((place) => <button key={place.place_id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseRoutePlace("origin", place)}><MapPin size={16} /><span><strong>{place.name}</strong><small>{place.address}</small></span></button>)}
        </div>}
      </div>
      <div className="route-field-wrap">
        <label>Destination<input value={destQuery} onFocus={() => setRouteField("destination")} onChange={(event) => { const value = event.target.value; setDestQuery(value); setDestCoord(null); setRouteField("destination"); if (!value.trim()) clearRouteOverlays(); }} placeholder={`Search any place in ${city.name}`} autoComplete="off" /></label>
        {routeField === "destination" && <div className="route-field-results">
          {routeSearching && <p>Searching places…</p>}
          {!routeSearching && destQuery.trim().length < 2 && <p>Type at least 2 letters</p>}
          {routePredictions.map((place) => <button key={place.place_id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseRoutePlace("destination", place)}><MapPin size={16} /><span><strong>{place.name}</strong><small>{place.address}</small></span></button>)}
        </div>}
      </div>
      {travelMode === "walking" && <section className="walking-tracker-card" aria-label="Live walking tracker">
        <div className="walking-tracker-metrics"><div><span>Distance walked</span><strong>{formatDistance(trackedDistanceMeters)}</strong></div><div><span>Time elapsed</span><strong>{formatDuration(trackedSeconds)}</strong></div></div>
        <button className={isTracking ? "walking-stop active" : "walking-start"} onClick={isTracking ? stopWalkingTracking : startWalkingTracking}>{isTracking ? "Stop Walk" : "Start Walk"}</button>
        {isTracking && <p><LocateFixed size={14} />Tracking precise GPS fixes up to ±30 m</p>}
      </section>}
      {routing && <p className="panel-status"><span className="search-spinner" />Snapping to roads and calculating routes…</p>}
      {routeInfo && <div className="route-summary">
        <div><strong>{routeInfo.duration_text}</strong><span>{routeInfo.distance_text}</span></div>
        <p>via {routeInfo.summary}</p>
        {routes.length > 1 && <div className="route-options" aria-label="Alternative routes">{routes.map((route) => <button key={route.route_index} className={routeInfo.route_index === route.route_index ? "active" : ""} onClick={() => activateRoute(route.route_index, true)}><strong>{route.duration_text}</strong><span>{route.distance_text}</span></button>)}</div>}
        <button className={`live-navigation-button${liveNavigation ? " active" : ""}`} onClick={toggleLiveNavigation}><Navigation size={17} />{liveNavigation ? "Pause live navigation" : "Start live navigation"}</button>
        {navigationMessage && <p className="navigation-status" aria-live="polite"><LocateFixed size={14} />{navigationMessage}</p>}
        <ol>{routeInfo.steps.map((step, index) => <li key={`${step.instruction}-${index}`}><ChevronRight size={15} /><span>{step.instruction}</span><em>{step.distance_meters} m</em></li>)}</ol>
      </div>}
    </aside>}

    {selectedPlace && <aside className="place-card rich-place-card">
      <button className="card-close" onClick={() => setSelectedPlace(null)} aria-label="Close place"><X size={18} /></button>
      {selectedPlace.photos?.[0] && <div className="place-photo-hero"><img src={selectedPlace.photos[0]} alt={selectedPlace.photo_kind === "illustrative" ? `Illustrative ${selectedPlace.category} scene` : selectedPlace.photo_kind === "nearby" ? `Nearby view around ${selectedPlace.name}` : selectedPlace.name} />{selectedPlace.photo_kind !== "place" && <span>{selectedPlace.photo_kind === "nearby" ? "Nearby Wikimedia photo" : "Illustrative category photo"}</span>}</div>}
      <div className="place-card-content">
        <span>{selectedPlace.category.replaceAll("_", " ")}</span><h2>{selectedPlace.name}</h2>{selectedPlace.tamil_name && <h3>{selectedPlace.tamil_name}</h3>}
        {selectedPlace.rating ? <p className="place-rating"><strong>{selectedPlace.rating.toFixed(1)}</strong><span aria-label={`${selectedPlace.rating} out of 5 stars`}>★★★★★</span>{selectedPlace.review_count ? ` (${selectedPlace.review_count})` : ""}</p> : <p className="place-rating-unavailable">No verified rating available</p>}
        <p>{selectedPlace.address}</p>
        {selectedPlace.description && <p className="place-description">{selectedPlace.description}</p>}
        {placeLoading && <p className="place-loading"><span className="search-spinner" />Loading place details…</p>}
        {selectedPlace.phone && <a href={`tel:${selectedPlace.phone}`}>Phone: {selectedPlace.phone}</a>}
        {selectedPlace.website && <a href={selectedPlace.website} target="_blank" rel="noreferrer">Visit website</a>}
        {selectedPlace.opening_hours && <small>Hours: {selectedPlace.opening_hours}</small>}
        {selectedPlace.photos && selectedPlace.photos.length > 1 && <div className="place-photo-strip">{selectedPlace.photos.slice(1, 4).map((photo) => <img key={photo} src={photo} alt="Additional place view" />)}</div>}
        <div className="place-secondary-actions"><button onClick={() => toggleSavedPlace(selectedPlace)} aria-pressed={selectedPlaceSaved}><Bookmark size={15} fill={selectedPlaceSaved ? "currentColor" : "none"} />{selectedPlaceSaved ? "Saved" : "Save place"}</button><button onClick={() => void sharePlace(selectedPlace)}><Share2 size={15} />Share link</button></div>
        <div className="place-route-actions"><button onClick={() => { setRouteField(null); void calculateRoute(selectedPlace.lat, selectedPlace.lng, selectedPlace.name); }}><Navigation size={16} />Directions here</button><button onClick={() => { userOverrodeOriginRef.current = true; clearRouteOverlays(); setOriginCoord([selectedPlace.lng, selectedPlace.lat]); setOriginQuery(selectedPlace.name); setDestCoord(null); setDestQuery(""); setShowRouting(true); setRouteField("destination"); }}><MapPin size={16} />Start here</button></div>
      </div>
    </aside>}

    <div className="map-studio-wrap">
      {showCustomizer && <aside className="map-studio">
        <header><div><Palette size={18} /><strong>Map studio</strong></div><button onClick={() => setShowCustomizer(false)} aria-label="Close map studio"><X size={17} /></button></header>
        <div className="mode-segment city-segment" aria-label="Choose city">{Object.values(CITIES).map((option) => <button key={option.id} className={city.id === option.id ? "active" : ""} onClick={() => window.location.assign(`/?region=${option.id}&lng=${option.center[0]}&lat=${option.center[1]}&z=${option.zoom}`)}>{option.name}</button>)}</div>
        <div className="mode-segment">{(["street", "satellite", "dark"] as MapMode[]).map((mode) => <button key={mode} className={mapMode === mode ? "active" : ""} onClick={() => { satellitePitchOverrideRef.current = false; setMapMode(mode); }}>{mode}</button>)}</div>
        <label className="toggle-row"><span><Building2 size={17} />3D buildings</span><input type="checkbox" checked={enable3DBuildings} onChange={(event) => setEnable3DBuildings(event.target.checked)} /></label>
        <label className="toggle-row"><span><Mountain size={17} />3D terrain</span><input type="checkbox" checked={enable3DTerrain} onChange={(event) => setEnable3DTerrain(event.target.checked)} /></label>
        <label className="range-row"><span>Building height <b>{buildingScale.toFixed(1)}×</b></span><input type="range" min="0.5" max="3" step="0.2" value={buildingScale} onChange={(event) => setBuildingScale(parseFloat(event.target.value))} /></label>
        <div className="color-grid"><label>Buildings<input type="color" value={buildingColor} onChange={(event) => setBuildingColor(event.target.value)} /></label><label>Water<input type="color" value={waterColor} onChange={(event) => setWaterColor(event.target.value)} /></label><label>Roads<input type="color" value={roadColor} onChange={(event) => setRoadColor(event.target.value)} /></label></div>
      </aside>}
      <div className="map-action-stack"><button onClick={() => setShowCustomizer((value) => !value)} aria-pressed={showCustomizer}><Map size={18} /><span>Layers</span></button><button onClick={() => { const map = mapRef.current; if (map) { if (mapMode === "satellite") satellitePitchOverrideRef.current = true; map.easeTo({ pitch: map.getPitch() > 10 ? 0 : 55, bearing: map.getPitch() > 10 ? 0 : -15, duration: 600 }); } }}><Building2 size={18} /><span>2D / 3D</span></button><button className={`location-control ${gpsStatus === "active" ? "gps-active" : ""} ${gpsStatus === "locating" ? "gps-locating" : ""}`} onClick={() => locatePrecisely(true)} aria-live="polite"><LocateFixed size={18} /><span>{gpsStatus === "locating" ? "Finding location" : gpsAccuracy !== null ? `Located · ±${gpsAccuracy} m` : "My location"}</span></button></div>
    </div>
  </main>;
}
