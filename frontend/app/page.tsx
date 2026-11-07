import CityMap from "@/components/CityMap";
import { getCity } from "@/lib/cities";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function finiteOr(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const city = getCity(first(query.region));
  const lng = finiteOr(first(query.lng), city.center[0]);
  const lat = finiteOr(first(query.lat), city.center[1]);
  const zoom = Math.min(19.8, Math.max(4, finiteOr(first(query.z), city.zoom)));
  return <CityMap city={city} initialCenter={[lng, lat]} initialZoom={zoom} />;
}
