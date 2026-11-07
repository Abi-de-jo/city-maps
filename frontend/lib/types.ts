export type Coordinate = { lat: number; lng: number };

export type PlacePrediction = {
  place_id: string;
  name: string;
  category?: string;
  address?: string;
  highlighted_name?: string;
  highlighted_address?: string;
  distance_meters?: number;
  location: Coordinate;
};

export type Review = {
  review_id: string;
  author_name: string;
  rating: number;
  text: string;
  created_at: string;
};

export type Place = PlacePrediction & {
  formatted_address?: string;
  phone?: string;
  website?: string;
  opening_hours?: Record<string, string[]> & { raw?: string };
  photo_urls?: string[];
  average_rating?: number;
  review_count?: number;
  reviews?: Review[];
  lat?: number;
  lng?: number;
};

export type RouteStep = {
  maneuver: string;
  street_name: string;
  distance_meters: number;
  duration_seconds: number;
  voice_instruction: string;
  begin_shape_index: number;
  end_shape_index: number;
};

export type RouteResult = {
  summary: string;
  distance_meters: number;
  duration_seconds: number;
  traffic_duration_seconds: number;
  bounds: { southwest: Coordinate; northeast: Coordinate };
  overview_polyline: {
    encoding: "polyline6";
    points: string;
    geojson: GeoJSON.LineString;
  };
  legs: { distance_meters: number; duration_seconds: number; steps: RouteStep[] }[];
};

export type TravelMode = "driving" | "two_wheeler" | "cycling" | "walking";

export type RoutePoint = PlacePrediction & { kind?: "origin" | "destination" | "waypoint" };
