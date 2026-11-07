"use client";

import { Box, Compass, Crosshair, Minus, Plus, TrafficCone } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { getTraffic } from "@/lib/api";
import type { Coordinate, RoutePoint, RouteResult } from "@/lib/types";

type Props = {
  routes: RouteResult[];
  activeRoute: number;
  points: RoutePoint[];
  onCenter: (center: Coordinate) => void;
  onActiveRoute: (index: number) => void;
  onPointMove: (index: number, point: Coordinate) => void;
  onContextAction: (action: "from" | "to" | "inspect", point: Coordinate) => void;
};

export default function MapCanvas({ routes, activeRoute, points, onCenter, onActiveRoute, onPointMove, onContextAction }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pointMarkers = useRef<Marker[]>([]);
  const etaMarkers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [pitch3d, setPitch3d] = useState(true);
  const [traffic, setTraffic] = useState(false);
  const [locating, setLocating] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; point: Coordinate }>();

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let cancelled = false;
    const load = async () => {
      try {
        if (cancelled || !container.current) return;
        const map = new maplibregl.Map({
          container: container.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [78.9629, 20.5937],
          zoom: 5,
          maxBounds: [[65.0, 5.0], [100.0, 38.0]],
          attributionControl: false,
        });
        mapRef.current = map;
        (window as unknown as { __cityMap: MapLibreMap }).__cityMap = map;
        map.on("load", () => {
          if (!map.getLayer("building-3d")) {
            map.addLayer({
              id: "building-3d", source: "openmaptiles", "source-layer": "building",
              type: "fill-extrusion", minzoom: 14,
              paint: {
                "fill-extrusion-color": "#d9d0c9",
                "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": .82,
              },
            });
          }
          map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({ id: "route-casing", type: "line", source: "routes", paint: { "line-color": ["case", ["==", ["get", "active"], true], "#ffffff", "#ffffff"], "line-width": ["case", ["==", ["get", "active"], true], 10, 8], "line-opacity": .9 }, layout: { "line-cap": "round", "line-join": "round" } });
          map.addLayer({ id: "route-lines", type: "line", source: "routes", paint: { "line-color": ["case", ["==", ["get", "active"], true], "#1a73e8", "#7f858c"], "line-width": ["case", ["==", ["get", "active"], true], 6, 5], "line-opacity": ["case", ["==", ["get", "active"], true], 1, .8] }, layout: { "line-cap": "round", "line-join": "round" } });
          map.on("click", "route-lines", (event) => {
            const index = Number(event.features?.[0]?.properties?.index ?? 0);
            onActiveRoute(index);
          });
          map.on("mouseenter", "route-lines", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "route-lines", () => { map.getCanvas().style.cursor = ""; });
          setReady(true);
        });
        map.on("moveend", () => { const center = map.getCenter(); onCenter({ lat: center.lat, lng: center.lng }); });
        map.on("contextmenu", (event) => {
          event.preventDefault();
          setMenu({ x: event.point.x, y: event.point.y, point: { lat: event.lngLat.lat, lng: event.lngLat.lng } });
        });
        map.on("error", (event) => setMapError(event.error?.message ?? "Map data could not be displayed"));
      } catch (error) {
        if (!cancelled) setMapError(error instanceof Error ? error.message : "Map could not start");
      }
    };
    void load();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = routes.map((route, index) => ({
      type: "Feature", geometry: route.overview_polyline.geojson,
      properties: { index, active: index === activeRoute },
    }));
    (map.getSource("routes") as GeoJSONSource)?.setData({ type: "FeatureCollection", features });
    etaMarkers.current.forEach((marker) => marker.remove());
    etaMarkers.current = routes.map((route, index) => {
      const coordinates = route.overview_polyline.geojson.coordinates;
      const coordinate = coordinates[Math.floor(coordinates.length / 2)];
      const element = document.createElement("button");
      element.className = "eta-bubble";
      element.textContent = `${Math.max(1, Math.round(route.traffic_duration_seconds / 60))} min`;
      element.onclick = () => onActiveRoute(index);
      return new maplibregl.Marker({ element }).setLngLat(coordinate as [number, number]).addTo(map);
    });
    const route = routes[activeRoute];
    if (route) {
      map.fitBounds(
        [[route.bounds.southwest.lng, route.bounds.southwest.lat], [route.bounds.northeast.lng, route.bounds.northeast.lat]],
        { padding: { top: 90, right: 80, bottom: 80, left: window.innerWidth > 760 ? 470 : 60 }, duration: 700 },
      );
    }
  }, [routes, activeRoute, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    pointMarkers.current.forEach((marker) => marker.remove());
    pointMarkers.current = points.filter((point) => point.name.trim()).map((point, index) => {
      const marker = new maplibregl.Marker({ color: index === 0 ? "#188038" : "#d93025", draggable: true })
        .setLngLat([point.location.lng, point.location.lat]).addTo(map);
      marker.on("dragend", () => { const position = marker.getLngLat(); onPointMove(index, { lat: position.lat, lng: position.lng }); });
      return marker;
    });
  }, [points, ready]);

  const toggleTraffic = async () => {
    const map = mapRef.current;
    if (!map) return;
    if (traffic) {
      if (map.getLayer("traffic-lines")) map.removeLayer("traffic-lines");
      if (map.getSource("traffic")) map.removeSource("traffic");
      setTraffic(false);
      return;
    }
    try {
      const data = await getTraffic();
      map.addSource("traffic", { type: "geojson", data });
      map.addLayer({ id: "traffic-lines", type: "line", source: "traffic", paint: { "line-color": ["match", ["get", "congestion"], "heavy", "#d93025", "moderate", "#f9ab00", "#188038"], "line-width": 5 }, layout: { "line-cap": "round" } });
      setTraffic(true);
    } catch (error) { setMapError(error instanceof Error ? error.message : "Traffic could not be loaded"); }
  };

  const locate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { mapRef.current?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 16 }); setLocating(false); },
      () => { setMapError("Location permission was not available."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return <>
    <div ref={container} className="map-canvas" aria-label="Interactive city map" />
    {mapError && <div className="status-message error-message" style={{ position: "absolute", zIndex: 30, bottom: 20, left: 20 }}>{mapError}</div>}
    <div className="map-controls" aria-label="Map controls">
      <div className="control-group floating-panel"><button className={`icon-button location-pulse ${locating ? "active" : ""}`} onClick={locate} aria-label="My location"><Crosshair size={20} /></button></div>
      <div className="control-group floating-panel"><button className="icon-button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><Plus /></button><button className="icon-button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><Minus /></button></div>
      <div className="control-group floating-panel"><button className="icon-button" onClick={() => mapRef.current?.easeTo({ bearing: 0 })} aria-label="Reset compass"><Compass /></button><button className={`icon-button ${pitch3d ? "active" : ""}`} onClick={() => { const next = !pitch3d; setPitch3d(next); mapRef.current?.easeTo({ pitch: next ? 45 : 0 }); mapRef.current?.setLayoutProperty("building-3d", "visibility", next ? "visible" : "none"); }} aria-label="Toggle 3D buildings"><Box /></button><button className={`icon-button ${traffic ? "active" : ""}`} onClick={toggleTraffic} aria-label="Toggle traffic"><TrafficCone /></button></div>
    </div>
    {menu && <div className="context-menu floating-panel" style={{ left: menu.x, top: menu.y }}><button onClick={() => { onContextAction("from", menu.point); setMenu(undefined); }}>Directions from here</button><button onClick={() => { onContextAction("to", menu.point); setMenu(undefined); }}>Directions to here</button><button onClick={() => { onContextAction("inspect", menu.point); setMenu(undefined); }}>What&apos;s here?</button></div>}
  </>;
}
