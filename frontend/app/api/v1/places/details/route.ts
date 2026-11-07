import { NextRequest, NextResponse } from "next/server";
import { getCity } from "@/lib/cities";
import { queryOverpass } from "@/lib/overpass";

const CATEGORY_PHOTOS: Record<string, string[]> = {
  bakery: ["https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80", "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80"],
  restaurant: ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80", "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80"],
  cafe: ["https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=80"],
  hospital: ["https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=900&q=80"],
  pharmacy: ["https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=900&q=80"],
  temple: ["https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=900&q=80"],
  hotel: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80"],
  fuel: ["https://images.unsplash.com/photo-1545147986-a9d6f2ab03b5?auto=format&fit=crop&w=900&q=80"],
  shopping: ["https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80"],
  default: ["https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?auto=format&fit=crop&w=900&q=80"],
};

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
}

function parseOsmPlaceId(value: string) {
  const match = /^(?:nom_|osm_)?(node|way|relation)_(\d+)$/.exec(value);
  return match ? { type: match[1], id: match[2] } : null;
}

function commonsFileUrl(file: string) {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=900`;
}

const GENERIC_PLACE_WORDS = new Set([
  "the", "and", "of", "at", "in", "on", "for", "hotel", "restaurant", "cafe", "coffee",
  "house", "home", "temple", "church", "mosque", "beach", "park", "museum", "mall",
  "shop", "store", "hospital", "pharmacy", "bank", "atm", "fuel", "petrol", "bunk",
  "school", "college", "university", "station", "airport", "road", "street", "nagar",
  "chennai", "trichy", "tiruchirappalli", "madurai", "coimbatore", "salem", "tamil",
  "nadu", "india", "sri", "shri", "sree", "new", "old", "main", "north", "south",
  "east", "west", "central", "grand", "royal", "star", "best", "food", "foods", "bar",
  "lodge", "residency", "palace", "inn", "building", "selected", "place", "location",
  "point",
]);

function nameTokens(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !GENERIC_PLACE_WORDS.has(token));
}

function matchesNameTokens(title: string, tokens: string[]) {
  let remaining = title.toLowerCase();
  for (const token of tokens) {
    const index = remaining.indexOf(token);
    if (index === -1) return false;
    remaining = `${remaining.slice(0, index)} ${remaining.slice(index + token.length)}`;
  }
  return true;
}

function isPlaceholderName(name: string) {
  return !name || /^(selected (building|place|location)|building|place|location)$/i.test(name.trim());
}

function upscaleWikimediaThumb(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString().replace(/\/(\d+)px-/, "/900px-");
  } catch {
    return url;
  }
}

async function cachedJsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 86_400 },
  } as RequestInit & { next: { revalidate: number } });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
}

async function getWikipediaPlace(name: string, tokens: string[]) {
  try {
    const summary = await cachedJsonFetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replaceAll(" ", "_"))}`,
      { headers: { "User-Agent": "CityMaps/1.0" } },
    );
    if (summary?.type === "disambiguation") return null;
    if (summary?.title && !matchesNameTokens(summary.title, tokens)) return null;
    const thumbnail = summary?.thumbnail?.source || summary?.originalimage?.source;
    const description = typeof summary?.extract === "string" ? summary.extract.trim() : "";
    if (thumbnail || description) {
      return { photo: thumbnail ? upscaleWikimediaThumb(thumbnail) : null, description };
    }
  } catch {}
  try {
    const search = await cachedJsonFetch(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(name)}&limit=3`,
      { headers: { "User-Agent": "CityMaps/1.0" } },
    );
    const page = (search?.pages || []).find((candidate: any) =>
      candidate?.title && matchesNameTokens(candidate.title, tokens) && candidate.thumbnail?.url
    );
    if (!page) return null;
    return {
      photo: upscaleWikimediaThumb(page.thumbnail.url),
      description: typeof page.description === "string" ? page.description.trim() : "",
    };
  } catch {}
  return null;
}

async function getCommonsPlacePhotos(name: string, lat: number, lng: number, tokens: string[]) {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`${name} filetype:bitmap`)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`;
  const geoUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsprimary=all&ggsnamespace=6&ggsradius=180&ggscoord=${lat}|${lng}&ggslimit=6&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*`;
  const responses = await Promise.all([
    cachedJsonFetch(searchUrl, { headers: { "User-Agent": "CityMaps/1.0" } }).catch(() => null),
    cachedJsonFetch(geoUrl, { headers: { "User-Agent": "CityMaps/1.0" } }).catch(() => null),
  ]);
  const photos: string[] = [];
  for (const response of responses) {
    const pages = response?.query?.pages ? Object.values(response.query.pages) as any[] : [];
    for (const page of pages) {
      if (!page?.title || !matchesNameTokens(page.title, tokens)) continue;
      const imageUrl = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
      if (imageUrl) photos.push(imageUrl);
    }
  }
  return Array.from(new Set(photos));
}

async function getFreePlacePhotos(name: string, lat: number, lng: number) {
  if (isPlaceholderName(name)) return { photos: [] as string[], description: "" };
  const tokens = nameTokens(name);
  if (!tokens.length) return { photos: [] as string[], description: "" };
  const [wikipedia, commons] = await Promise.all([
    getWikipediaPlace(name, tokens),
    getCommonsPlacePhotos(name, lat, lng, tokens),
  ]);
  return {
    photos: Array.from(new Set([...(wikipedia?.photo ? [wikipedia.photo] : []), ...commons])),
    description: wikipedia?.description || "",
  };
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = getCity(searchParams.get("region"));
  const name = (searchParams.get("name") || "").trim();
  const placeId = (searchParams.get("place_id") || "").trim();
  const lat = Number(searchParams.get("lat") || city.center[1]);
  const lng = Number(searchParams.get("lng") || city.center[0]);
  const rawCategory = (searchParams.get("category") || "place").toLowerCase();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ status: "ERROR", error: "Valid lat and lng are required" }, { status: 400 });
  }

  try {
    const osmPlace = parseOsmPlaceId(placeId);
    const cleanName = name.replace(/\s+/g, " ").trim();
    const freePhotosPromise = getFreePlacePhotos(cleanName, lat, lng);
    const overpassQuery = osmPlace
      ? `[out:json][timeout:8];${osmPlace.type}(id:${osmPlace.id});out center tags;`
      : `[out:json][timeout:8];(node(around:120,${lat},${lng})["name"];way(around:120,${lat},${lng})["name"];);out center tags 12;`;
    const [overpassElements, nominatim] = await Promise.all([
      queryOverpass(overpassQuery, 6_000).catch(() => [] as any[]),
      jsonFetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&extratags=1&addressdetails=1`, {
        headers: { "User-Agent": `CityMaps-${city.id}/1.0` },
      }).catch(() => ({})),
    ]);

    const elements = Array.isArray(overpassElements) ? overpassElements : [];
    const normalizedName = cleanName.toLowerCase();
    const exact = elements.find((element: any) => cleanName && element.tags?.name?.toLowerCase() === normalizedName)
      || elements.find((element: any) => cleanName && normalizedName.startsWith(element.tags?.name?.toLowerCase() || "\0"));
    const selected = osmPlace
      ? elements[0]
      : exact || elements.slice().sort((left: any, right: any) => {
        const leftLat = left.lat ?? left.center?.lat ?? lat;
        const leftLng = left.lon ?? left.center?.lon ?? lng;
        const rightLat = right.lat ?? right.center?.lat ?? lat;
        const rightLng = right.lon ?? right.center?.lon ?? lng;
        return distanceMeters(lat, lng, leftLat, leftLng) - distanceMeters(lat, lng, rightLat, rightLng);
      })[0];
    const tags: Record<string, string> = selected?.tags || {};

    const placePhotos: string[] = [];
    if (tags.image?.startsWith("http")) {
      placePhotos.push(tags.image);
    }
    if (tags.wikimedia_commons?.startsWith("File:")) {
      placePhotos.push(commonsFileUrl(tags.wikimedia_commons.slice(5)));
    }
    if (!placePhotos.length && /^Q\d+$/.test(tags.wikidata || "")) {
      try {
        const wikidata = await jsonFetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${tags.wikidata}&property=P18&format=json&origin=*`);
        const file = wikidata?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        if (typeof file === "string" && file) {
          placePhotos.push(commonsFileUrl(file));
        }
      } catch {}
    }
    const freePhotos = await freePhotosPromise;
    const placeSpecificPhotos = Array.from(new Set([...placePhotos, ...freePhotos.photos]));
    const hasPlacePhoto = placeSpecificPhotos.length > 0;

    const zoom = 19;
    const tileX = Math.floor(((lng + 180) / 360) * 2 ** zoom);
    const tileY = Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * 2 ** zoom);
    const aerialUrl = `https://mt1.google.com/vt/lyrs=s&x=${tileX}&y=${tileY}&z=${zoom}&scale=2`;
    const resolvedName = tags.name || tags["name:en"] || (!isPlaceholderName(cleanName) ? cleanName : "") || nominatim.name || nominatim.address?.amenity || "Selected place";
    const usableRawCategory = /^(fill-extrusion|building|place|location|point)$/i.test(rawCategory) ? "" : rawCategory;
    const resolvedCategory = tags.shop || tags.amenity || tags.tourism || tags.healthcare || usableRawCategory || "place";
    const categoryValue = resolvedCategory.toLowerCase();
    const nameValue = resolvedName.toLowerCase();
    const categoryMatchKey = categoryValue.includes("worship") || categoryValue.includes("shrine") ? "temple" : "";
    const matchKey = Object.keys(CATEGORY_PHOTOS).find((key) => key !== "default" && categoryValue.includes(key))
      || categoryMatchKey
      || (Object.prototype.hasOwnProperty.call(CATEGORY_PHOTOS, nameValue) ? nameValue : "default");
    const fallbackPhotos = CATEGORY_PHOTOS[matchKey] || CATEGORY_PHOTOS.default;
    const photos = Array.from(new Set([...placeSpecificPhotos, ...(hasPlacePhoto ? [] : fallbackPhotos), aerialUrl])).slice(0, 6);
    const description = freePhotos.description.length > 280
      ? `${freePhotos.description.slice(0, 277).trimEnd()}…`
      : freePhotos.description;
    const ratingValue = Number(tags.rating || nominatim.extratags?.rating);
    const reviewCountValue = Number(tags["rating:count"] || tags.reviews || nominatim.extratags?.["rating:count"]);
    const resolvedPlaceId = osmPlace
      ? `osm_${osmPlace.type}_${osmPlace.id}`
      : selected?.type && selected?.id
        ? `osm_${selected.type}_${selected.id}`
        : `osm_${Math.round(lat * 1e5)}_${Math.round(lng * 1e5)}`;

    return NextResponse.json({
      status: "OK",
      place: {
        place_id: resolvedPlaceId,
        name: resolvedName,
        tamil_name: tags["name:ta"] || null,
        category: resolvedCategory.replaceAll("_", " "),
        description: description || null,
        address: nominatim.display_name || [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], city.searchName].filter(Boolean).join(", ") || `${city.searchName}, Tamil Nadu`,
        lat,
        lng,
        phone: tags.phone || tags["contact:phone"] || nominatim.extratags?.phone || null,
        website: tags.website || tags["contact:website"] || nominatim.extratags?.website || null,
        opening_hours: tags.opening_hours || nominatim.extratags?.opening_hours || null,
        rating: Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue : null,
        review_count: Number.isFinite(reviewCountValue) && reviewCountValue > 0 ? reviewCountValue : null,
        photos,
        photo_kind: hasPlacePhoto ? "place" : "illustrative",
      },
    });
  } catch (error) {
    return NextResponse.json({ status: "ERROR", error: error instanceof Error ? error.message : "Place details unavailable" }, { status: 500 });
  }
}
