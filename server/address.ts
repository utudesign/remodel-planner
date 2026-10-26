import type { AddressProvider, AddressSuggestion } from "@/lib/address";

/**
 * Address type-ahead. Provider picked by env (docs/DECISIONS.md):
 *   GOOGLE_MAPS_API_KEY → Google Places Autocomplete (New): best house-number accuracy.
 *   GEOAPIFY_API_KEY    → Geoapify: free 3,000 requests/day, no card.
 *   neither             → Photon (OpenStreetMap, no key): works, weaker on house numbers.
 * Results are biased to Northern Virginia and limited to the US.
 */
const CENTER = { lat: 38.85, lng: -77.3 }; // Fairfax area
const TIMEOUT_MS = 4000;

export function addressProvider(): AddressProvider {
  if (process.env.GOOGLE_MAPS_API_KEY) return "google";
  if (process.env.GEOAPIFY_API_KEY) return "geoapify";
  return "photon";
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
  return res.json();
}

const join = (...xs: (string | null | undefined)[]) => xs.filter((x) => x && String(x).trim()).join(", ");

// ---------------------------------------------------------------- Google
type GooglePrediction = {
  placePrediction?: {
    placeId: string;
    text?: { text: string };
    structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
  };
};

async function google(q: string, session: string): Promise<AddressSuggestion[]> {
  const j = (await getJson("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY! },
    body: JSON.stringify({
      input: q,
      sessionToken: session,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      locationBias: { circle: { center: { latitude: CENTER.lat, longitude: CENTER.lng }, radius: 50000 } },
    }),
  })) as { suggestions?: GooglePrediction[] };
  return (j.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p) return [];
    return [
      {
        id: p.placeId,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: (p.structuredFormat?.secondaryText?.text ?? "").replace(/, USA$/, ""),
        line: null, // predictions have no ZIP: fetch details on pick
      },
    ];
  });
}

async function googleDetails(placeId: string, session: string): Promise<string> {
  const j = (await getJson(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(session)}`,
    { headers: { "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!, "X-Goog-FieldMask": "formattedAddress" } },
  )) as { formattedAddress?: string };
  return (j.formattedAddress ?? "").replace(/, USA$/, "");
}

// ---------------------------------------------------------------- Geoapify
type GeoapifyResult = {
  place_id: string;
  housenumber?: string;
  street?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  state_code?: string;
  postcode?: string;
  address_line1?: string;
};

async function geoapify(q: string): Promise<AddressSuggestion[]> {
  const u = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  u.searchParams.set("text", q);
  u.searchParams.set("filter", "countrycode:us");
  u.searchParams.set("bias", `proximity:${CENTER.lng},${CENTER.lat}`);
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", "6");
  u.searchParams.set("lang", "en");
  u.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY!);
  const j = (await getJson(u.toString())) as { results?: GeoapifyResult[] };
  return (j.results ?? []).map((r) => {
    const street = r.housenumber && r.street ? `${r.housenumber} ${r.street}` : (r.address_line1 ?? r.street ?? "");
    const town = r.city ?? r.town ?? r.village ?? r.suburb ?? "";
    const stateZip = [r.state_code, r.postcode].filter(Boolean).join(" ");
    return { id: r.place_id, main: street, secondary: join(town, stateZip), line: join(street, town, stateZip) };
  });
}

// ---------------------------------------------------------------- Photon (OSM, no key)
const STATES: Record<string, string> = {
  Virginia: "VA", Maryland: "MD", "District of Columbia": "DC", "West Virginia": "WV", Pennsylvania: "PA",
  Delaware: "DE", "North Carolina": "NC", "New Jersey": "NJ", "New York": "NY",
};
type PhotonFeature = {
  properties: {
    osm_id: number;
    osm_type: string;
    housenumber?: string;
    street?: string;
    name?: string;
    city?: string;
    district?: string;
    locality?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
    type?: string;
  };
};

async function photon(q: string): Promise<AddressSuggestion[]> {
  const u = new URL("https://photon.komoot.io/api/");
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "8");
  u.searchParams.set("lang", "en");
  u.searchParams.set("lat", String(CENTER.lat));
  u.searchParams.set("lon", String(CENTER.lng));
  u.searchParams.append("layer", "house");
  u.searchParams.append("layer", "street");
  const j = (await getJson(u.toString(), { headers: { "User-Agent": "kitchen-sales-tool" } })) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  return (j.features ?? []).flatMap((f) => {
    const p = f.properties;
    if (p.countrycode && p.countrycode !== "US") return [];
    const road = p.street ?? (p.type === "street" ? p.name : undefined);
    if (!road) return [];
    const street = p.housenumber ? `${p.housenumber} ${road}` : road;
    const town = p.city ?? p.locality ?? p.district ?? "";
    const stateZip = [p.state ? (STATES[p.state] ?? p.state) : "", p.postcode].filter(Boolean).join(" ");
    const line = join(street, town, stateZip);
    if (seen.has(line)) return [];
    seen.add(line);
    return [{ id: `${p.osm_type}${p.osm_id}`, main: street, secondary: join(town, stateZip), line }];
  }).slice(0, 6);
}

export async function suggestAddresses(q: string, session: string): Promise<AddressSuggestion[]> {
  switch (addressProvider()) {
    case "google":
      return google(q, session);
    case "geoapify":
      return geoapify(q);
    default:
      return photon(q);
  }
}

export async function addressDetails(id: string, session: string): Promise<string> {
  if (addressProvider() !== "google") throw new Error("Details are only needed for Google");
  return googleDetails(id, session);
}
