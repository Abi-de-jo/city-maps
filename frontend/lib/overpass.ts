const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const USER_AGENT = "CityMaps/1.0 (OpenStreetMap place discovery)";

export async function queryOverpass(query: string, timeoutMs = 10_000): Promise<any[]> {
  const attempts = OVERPASS_ENDPOINTS.map(async (endpoint) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Overpass ${endpoint} returned HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data?.elements)) throw new Error(`Overpass ${endpoint} returned invalid data`);
    return data.elements as any[];
  });

  const results = await Promise.allSettled(attempts);
  const successful = results
    .filter((result): result is PromiseFulfilledResult<any[]> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((left, right) => right.length - left.length);

  if (successful.length === 0) throw new Error("All Overpass services are unavailable");
  return successful[0];
}
