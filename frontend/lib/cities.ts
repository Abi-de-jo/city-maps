export type CityConfig = {
  id: "india" | "delhi" | "mumbai" | "bengaluru" | "hyderabad" | "kolkata" | "chennai" | "trichy" | string;
  name: string;
  searchName: string;
  center: readonly [number, number];
  zoom: number;
  bounds: readonly [readonly [number, number], readonly [number, number]];
  bbox: readonly [number, number, number, number];
  defaultOrigin: readonly [number, number];
  defaultOriginLabel: string;
};

const INDIA_BOUNDS: readonly [readonly [number, number], readonly [number, number]] = [
  [65.0, 5.0],
  [100.0, 38.0],
];

export const CITIES: Record<string, CityConfig> = {
  india: {
    id: "india",
    name: "India",
    searchName: "India",
    center: [78.9629, 22.5],
    zoom: 4.8,
    bounds: INDIA_BOUNDS,
    bbox: [68.1, 6.7, 97.4, 35.7],
    defaultOrigin: [77.2090, 28.6139],
    defaultOriginLabel: "New Delhi Central",
  },
  delhi: {
    id: "delhi",
    name: "Delhi NCR",
    searchName: "New Delhi",
    center: [77.2090, 28.6139],
    zoom: 12,
    bounds: INDIA_BOUNDS,
    bbox: [76.84, 28.40, 77.35, 28.88],
    defaultOrigin: [77.2090, 28.6139],
    defaultOriginLabel: "Connaught Place, New Delhi",
  },
  mumbai: {
    id: "mumbai",
    name: "Mumbai",
    searchName: "Mumbai",
    center: [72.8777, 19.0760],
    zoom: 12,
    bounds: INDIA_BOUNDS,
    bbox: [72.75, 18.89, 72.99, 19.28],
    defaultOrigin: [72.8354, 18.9401],
    defaultOriginLabel: "CSMT, Mumbai",
  },
  bengaluru: {
    id: "bengaluru",
    name: "Bengaluru",
    searchName: "Bengaluru",
    center: [77.5946, 12.9716],
    zoom: 12,
    bounds: INDIA_BOUNDS,
    bbox: [77.45, 12.83, 77.75, 13.14],
    defaultOrigin: [77.5736, 12.9784],
    defaultOriginLabel: "KSR Bengaluru Station",
  },
  hyderabad: {
    id: "hyderabad",
    name: "Hyderabad",
    searchName: "Hyderabad",
    center: [78.4747, 17.3616],
    zoom: 12,
    bounds: INDIA_BOUNDS,
    bbox: [78.25, 17.20, 78.60, 17.55],
    defaultOrigin: [78.4747, 17.3616],
    defaultOriginLabel: "Charminar, Hyderabad",
  },
  kolkata: {
    id: "kolkata",
    name: "Kolkata",
    searchName: "Kolkata",
    center: [88.3639, 22.5726],
    zoom: 12,
    bounds: INDIA_BOUNDS,
    bbox: [88.25, 22.45, 88.45, 22.65],
    defaultOrigin: [88.3426, 22.5855],
    defaultOriginLabel: "Howrah Station, Kolkata",
  },
  chennai: {
    id: "chennai",
    name: "Chennai",
    searchName: "Chennai",
    center: [80.2707, 13.0827],
    zoom: 13,
    bounds: INDIA_BOUNDS,
    bbox: [79.95, 12.75, 80.40, 13.35],
    defaultOrigin: [80.2754, 13.0827],
    defaultOriginLabel: "Chennai Central",
  },
  trichy: {
    id: "trichy",
    name: "Trichy",
    searchName: "Tiruchirappalli",
    center: [78.7047, 10.7905],
    zoom: 13,
    bounds: INDIA_BOUNDS,
    bbox: [78.55, 10.68, 78.85, 10.95],
    defaultOrigin: [78.6928, 10.8315],
    defaultOriginLabel: "Chatram Bus Stand, Trichy",
  },
};

export function getCity(value: string | null | undefined): CityConfig {
  if (value && value in CITIES) {
    return CITIES[value];
  }
  return CITIES.india;
}
