"use client";

import { useState } from "react";
import { reverseGeocode } from "@/lib/api";
import type { Coordinate, PlacePrediction, RoutePoint, RouteResult, TravelMode } from "@/lib/types";
import DirectionsDrawer from "./DirectionsDrawer";
import MapCanvas from "./MapCanvas";
import OmniboxSearch from "./OmniboxSearch";
import PlaceDetailsSheet from "./PlaceDetailsSheet";

const defaultCenter = {
  lng: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? 78.7047),
  lat: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 10.7905),
};

function droppedPoint(point: Coordinate): RoutePoint {
  return { place_id: `coordinate:${point.lat.toFixed(6)},${point.lng.toFixed(6)}`, name: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`, address: "Dropped pin", location: point };
}

export default function MapShell() {
  const [center, setCenter] = useState(defaultCenter);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [selected, setSelected] = useState<PlacePrediction>();
  const [origin, setOrigin] = useState<RoutePoint>();
  const [destination, setDestination] = useState<RoutePoint>();
  const [waypoints, setWaypoints] = useState<RoutePoint[]>([]);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [activeRoute, setActiveRoute] = useState(0);
  const [mode, setMode] = useState<TravelMode>("driving");

  const points = [origin, ...waypoints, destination].filter(Boolean) as RoutePoint[];
  const movePoint = (index: number, location: Coordinate) => {
    const next = droppedPoint(location);
    if (index === 0) setOrigin(next);
    else if (index === points.length - 1) setDestination(next);
    else setWaypoints((current) => current.map((item, itemIndex) => itemIndex === index - 1 ? next : item));
  };
  const contextAction = async (action: "from" | "to" | "inspect", point: Coordinate) => {
    if (action === "from") { setOrigin(droppedPoint(point)); setDirectionsOpen(true); setSelected(undefined); }
    if (action === "to") { setDestination(droppedPoint(point)); setDirectionsOpen(true); setSelected(undefined); }
    if (action === "inspect") {
      try {
        const result = await reverseGeocode(point);
        setSelected({ place_id: result.place_id, name: result.name ?? result.address ?? "Dropped pin", address: result.address ?? result.formatted_address, category: result.category, location: point } as PlacePrediction);
        setDirectionsOpen(false);
      } catch { setSelected(droppedPoint(point)); }
    }
  };

  return <main className="map-shell">
    <MapCanvas routes={routes} activeRoute={activeRoute} points={points} onCenter={setCenter} onActiveRoute={setActiveRoute} onPointMove={movePoint} onContextAction={contextAction} />
    {!directionsOpen && !selected && <OmniboxSearch center={center} onDirections={() => setDirectionsOpen(true)} onSelect={(place) => { setSelected(place); setDirectionsOpen(false); }} />}
    {directionsOpen && <DirectionsDrawer center={center} origin={origin} destination={destination} waypoints={waypoints} routes={routes} activeRoute={activeRoute} mode={mode} onOrigin={setOrigin} onDestination={setDestination} onWaypoints={setWaypoints} onRoutes={setRoutes} onActiveRoute={setActiveRoute} onMode={setMode} onClose={() => { setDirectionsOpen(false); setRoutes([]); }} />}
    {selected && <PlaceDetailsSheet selected={selected} onClose={() => setSelected(undefined)} onDirections={(place) => { setDestination(place); setSelected(undefined); setDirectionsOpen(true); }} />}
  </main>;
}
