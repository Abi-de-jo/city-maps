"use client";

import {
  CircleParking, Cross, Fuel, Hospital, Landmark, Menu, Navigation,
  Pill, Search, Utensils, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { autocomplete, nearby } from "@/lib/api";
import type { Coordinate, PlacePrediction } from "@/lib/types";

const CATEGORIES = [
  { label: "Restaurants", value: "restaurant", icon: Utensils },
  { label: "ATMs", value: "atm", icon: Landmark },
  { label: "Petrol", value: "fuel", icon: Fuel },
  { label: "Hospitals", value: "hospital", icon: Hospital },
  { label: "Pharmacies", value: "pharmacy", icon: Pill },
  { label: "Parking", value: "parking", icon: CircleParking },
];

function matchParts(text: string, query: string) {
  const index = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (index < 0 || !query.trim()) return text;
  return <>{text.slice(0, index)}<strong>{text.slice(index, index + query.trim().length)}</strong>{text.slice(index + query.trim().length)}</>;
}

type Props = {
  center: Coordinate;
  onDirections: () => void;
  onSelect: (place: PlacePrediction) => void;
};

export default function OmniboxSearch({ center, onDirections, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>();
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const next = await autocomplete(query, center, category);
        if (id === requestId.current) {
          setResults(next);
          setOpen(true);
        }
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 240);
    return () => window.clearTimeout(timer);
  }, [query, center.lat, center.lng, category]);

  const select = (place: PlacePrediction) => {
    setQuery(place.name);
    setOpen(false);
    const stored = JSON.parse(localStorage.getItem("city-map-recent") ?? "[]") as PlacePrediction[];
    localStorage.setItem(
      "city-map-recent",
      JSON.stringify([place, ...stored.filter((item) => item.place_id !== place.place_id)].slice(0, 6)),
    );
    onSelect(place);
  };

  const chooseCategory = (value: string) => {
    const next = category === value ? undefined : value;
    setCategory(next);
    if (!query.trim()) setQuery(CATEGORIES.find((item) => item.value === value)?.label ?? "");
    setOpen(true);
    if (next) {
      setLoading(true);
      nearby(center, next)
        .then((places) => setResults(places))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }
  };

  return (
    <div className="omnibox-wrap">
      <div className="omnibox">
        <div className="search-row floating-panel">
          <button className="icon-button" aria-label="Map menu"><Menu size={21} /></button>
          <Search size={20} color="#5f6368" aria-hidden />
          <input
            className="search-input"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search places"
            aria-label="Search places"
            aria-expanded={open}
          />
          {query && (
            <button className="icon-button" aria-label="Clear search" onClick={() => { setQuery(""); setResults([]); }}>
              <X size={19} />
            </button>
          )}
          <button className="icon-button route-button" aria-label="Directions" onClick={onDirections}>
            <Navigation size={21} />
          </button>
        </div>
        {open && (query.trim().length >= 2 || loading) && (
          <div className="search-results floating-panel" role="listbox">
            {loading && <div className="status-message">Searching nearby places…</div>}
            {!loading && results.map((place) => (
              <button key={place.place_id} className="result-button" onClick={() => select(place)} role="option">
                <span className="result-icon"><Cross size={16} /></span>
                <span className="result-main">
                  <span className="result-name">{matchParts(place.name, query)}</span>
                  <span className="result-address">{place.address}</span>
                </span>
                {Boolean(place.distance_meters) && (
                  <span className="result-distance">{place.distance_meters! < 1000 ? `${place.distance_meters} m` : `${(place.distance_meters! / 1000).toFixed(1)} km`}</span>
                )}
              </button>
            ))}
            {!loading && results.length === 0 && <div className="status-message">No nearby places found.</div>}
          </div>
        )}
      </div>
      <div className="category-strip" aria-label="Place categories">
        {CATEGORIES.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.value} className={`pill ${category === item.value ? "active" : ""}`} onClick={() => chooseCategory(item.value)}>
              <Icon size={16} />{item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
