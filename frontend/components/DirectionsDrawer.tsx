"use client";

import {
  ArrowDownUp, Bike, Car, ChevronDown, ChevronUp, Circle, Footprints,
  GripVertical, LocateFixed, Plus, RotateCcw, Trash2, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { autocomplete, getDirections } from "@/lib/api";
import type { Coordinate, PlacePrediction, RoutePoint, RouteResult, TravelMode } from "@/lib/types";

const MODES: { value: TravelMode; label: string; icon: typeof Car }[] = [
  { value: "driving", label: "Car", icon: Car },
  { value: "two_wheeler", label: "Motorbike", icon: Bike },
  { value: "cycling", label: "Cycle", icon: Bike },
  { value: "walking", label: "Walk", icon: Footprints },
];

function duration(seconds?: number) {
  if (!seconds) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function distance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

type PlaceInputProps = {
  label: string;
  value?: RoutePoint;
  center: Coordinate;
  onChange: (value?: RoutePoint) => void;
};

function PlaceInput({ label, value, center, onChange }: PlaceInputProps) {
  const [text, setText] = useState(value?.name ?? "");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => setText(value?.name ?? ""), [value?.place_id, value?.name]);
  useEffect(() => {
    if (text.trim().length < 2 || text === value?.name) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      autocomplete(text, center).then((items) => { setResults(items); setOpen(true); }).catch(() => setResults([]));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [text, center.lat, center.lng, value?.name]);

  return (
    <div className="field-wrap">
      <input
        className="route-input"
        aria-label={label}
        placeholder={label}
        value={text}
        onChange={(event) => { setText(event.target.value); onChange(undefined); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="field-results floating-panel">
          {results.map((place) => (
            <button key={place.place_id} className="result-button" onClick={() => { onChange(place); setText(place.name); setOpen(false); }}>
              <span className="result-icon"><Circle size={13} /></span>
              <span className="result-main"><span className="result-name">{place.name}</span><span className="result-address">{place.address}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  center: Coordinate;
  origin?: RoutePoint;
  destination?: RoutePoint;
  waypoints: RoutePoint[];
  routes: RouteResult[];
  activeRoute: number;
  mode: TravelMode;
  onOrigin: (point?: RoutePoint) => void;
  onDestination: (point?: RoutePoint) => void;
  onWaypoints: (points: RoutePoint[]) => void;
  onRoutes: (routes: RouteResult[]) => void;
  onActiveRoute: (index: number) => void;
  onMode: (mode: TravelMode) => void;
  onClose: () => void;
};

export default function DirectionsDrawer(props: Props) {
  const {
    center, origin, destination, waypoints, routes, activeRoute, mode,
    onOrigin, onDestination, onWaypoints, onRoutes, onActiveRoute, onMode, onClose,
  } = props;
  const [etas, setEtas] = useState<Partial<Record<TravelMode, number>>>({});
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!origin || !destination) {
      onRoutes([]);
      setEtas({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(async () => {
      try {
        const validWaypoints = waypoints.filter((point) => point.name.trim());
        const selected = await getDirections(origin, destination, validWaypoints, mode);
        if (!cancelled) {
          onRoutes(selected);
          onActiveRoute(0);
          setEtas((current) => ({ ...current, [mode]: selected[0]?.traffic_duration_seconds }));
        }
        const otherModes = MODES.map((item) => item.value).filter((item) => item !== mode);
        const estimates = await Promise.allSettled(
          otherModes.map(async (travelMode) => ({ travelMode, routes: await getDirections(origin, destination, validWaypoints, travelMode) })),
        );
        if (!cancelled) {
          const next = { [mode]: selected[0]?.traffic_duration_seconds } as Partial<Record<TravelMode, number>>;
          estimates.forEach((result) => {
            if (result.status === "fulfilled") next[result.value.travelMode] = result.value.routes[0]?.traffic_duration_seconds;
          });
          setEtas(next);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "No route was found.");
          onRoutes([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [origin, destination, waypoints, mode]);

  const selectedRoute = routes[activeRoute];

  return (
    <aside className="drawer" aria-label="Directions">
      <div className="drawer-header">
        <div className="drawer-topline"><h1 className="drawer-title">Directions</h1><button className="icon-button" aria-label="Close directions" onClick={onClose}><X /></button></div>
        <div className="route-fields">
          <div className="route-field-icons"><span className="route-dot" /><span className="route-line" /><span className="route-square" /></div>
          <div className="route-inputs">
            <PlaceInput label="Choose starting point" value={origin} center={center} onChange={onOrigin} />
            {waypoints.map((point, index) => (
              <div className="waypoint-row" key={`${point.place_id}-${index}`}>
                <GripVertical size={18} color="#fff" />
                <PlaceInput label={`Stop ${index + 1}`} value={point} center={center} onChange={(next) => next ? onWaypoints(waypoints.map((item, itemIndex) => itemIndex === index ? next : item)) : onWaypoints(waypoints.filter((_, itemIndex) => itemIndex !== index))} />
                <button className="icon-button" aria-label={`Remove stop ${index + 1}`} onClick={() => onWaypoints(waypoints.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={17} /></button>
              </div>
            ))}
            <PlaceInput label="Choose destination" value={destination} center={center} onChange={onDestination} />
          </div>
          <button className="icon-button" aria-label="Swap start and destination" onClick={() => { onOrigin(destination); onDestination(origin); }}><ArrowDownUp size={20} /></button>
        </div>
        {waypoints.length < 8 && <button className="add-stop" onClick={() => onWaypoints([...waypoints, { place_id: `pending-${Date.now()}`, name: "", location: center }])}><Plus size={15} style={{ display: "inline", marginRight: 5 }} />Add stop</button>}
      </div>
      <div className="mode-tabs" role="tablist">
        {MODES.map((item) => {
          const Icon = item.icon;
          return <button key={item.value} className={`mode-tab ${mode === item.value ? "active" : ""}`} onClick={() => onMode(item.value)} role="tab" aria-selected={mode === item.value}><Icon size={20} /><span>{item.label}</span><span className="mode-eta">{duration(etas[item.value])}</span></button>;
        })}
      </div>
      <div className="route-scroll">
        {loading && <div className="status-message">Finding the best routes…</div>}
        {error && <div className="status-message error-message">{error}</div>}
        {!loading && routes.map((route, index) => (
          <div key={`${route.distance_meters}-${index}`} className={`route-summary ${activeRoute === index ? "active" : ""}`} onClick={() => onActiveRoute(index)}>
            <div className="route-duration">{duration(route.traffic_duration_seconds)}</div>
            <div className="route-meta">{distance(route.distance_meters)} · {mode === "driving" || mode === "two_wheeler" ? "Current traffic" : "Estimated time"}</div>
            {route.summary && <div className="route-streets">via {route.summary}</div>}
          </div>
        ))}
        {selectedRoute && (
          <>
            <button className="steps-toggle" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={16} style={{ display: "inline" }} /> : <ChevronDown size={16} style={{ display: "inline" }} />} {expanded ? "Hide" : "Show"} steps</button>
            {expanded && <ol className="step-list">{selectedRoute.legs.flatMap((leg) => leg.steps).map((step, index) => <li className="step-item" key={`${step.begin_shape_index}-${index}`}><span className="result-icon">{step.maneuver.includes("uturn") ? <RotateCcw size={16} /> : <LocateFixed size={16} />}</span><span className="step-text">{step.voice_instruction}</span><span className="step-distance">{distance(step.distance_meters)}</span></li>)}</ol>}
          </>
        )}
      </div>
    </aside>
  );
}
