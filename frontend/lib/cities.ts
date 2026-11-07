export type CityConfig = {
  id: "trichy" | "chennai";
  name: string;
  searchName: string;
  center: readonly [number, number];
  zoom: number;
  bounds: readonly [readonly [number, number], readonly [number, number]];
  bbox: readonly [number, number, number, number];
  defaultOrigin: readonly [number, number];
  defaultOriginLabel: string;
};

export const CITIES: Record<CityConfig["id"], CityConfig> = {
  trichy: {
    id: "trichy",
    name: "Trichy",
    searchName: "Tiruchirappalli",
    center: [78.7047, 10.7905],
    zoom: 13,
    bounds: [[78.42, 10.58], [78.98, 11.08]],
    bbox: [78.55, 10.68, 78.85, 10.95],
    defaultOrigin: [78.6928, 10.8315],
    defaultOriginLabel: "Chatram Bus Stand, Trichy",
  },
  chennai: {
    id: "chennai",
    name: "Chennai",
    searchName: "Chennai",
    center: [80.2707, 13.0827],
    zoom: 13,
    bounds: [[79.95, 12.75], [80.40, 13.35]],
    bbox: [79.95, 12.75, 80.40, 13.35],
    defaultOrigin: [80.2754, 13.0827],
    defaultOriginLabel: "Chennai Central",
  },
};

export function getCity(value: string | null | undefined): CityConfig {
  return value === "chennai" ? CITIES.chennai : CITIES.trichy;
}
