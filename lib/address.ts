/**
 * One-line US addresses ↔ the contact's address / city / zip columns.
 * The form sends one line ("4100 Chain Bridge Rd, Fairfax, VA 22030"); we split it.
 * City keeps the town only for Virginia (home turf); other states are kept as "Bethesda, MD"
 * (contacts has no state column). See docs/DECISIONS.md.
 */
export const HOME_STATE = "VA";

export type AddressParts = { street: string | null; city: string | null; zip: string | null };

const STATE_ZIP = /^([A-Za-z]{2})(?:\s+(\d{5})(?:-\d{4})?)?$/;
const ZIP_ONLY = /^(\d{5})(?:-\d{4})?$/;
const COUNTRY = /^(usa|us|u\.s\.a?\.?|united states( of america)?)$/i;

export function parseAddressLine(line: string | null | undefined): AddressParts {
  const parts = (line ?? "")
    .split(",")
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  while (parts.length && COUNTRY.test(parts.at(-1)!)) parts.pop();
  if (!parts.length) return { street: null, city: null, zip: null };
  if (parts.length === 1) return { street: parts[0], city: null, zip: null };

  let state: string | null = null;
  let zip: string | null = null;
  let end = parts.length;
  const last = parts.at(-1)!;
  const sz = last.match(STATE_ZIP);
  const z = last.match(ZIP_ONLY);
  if (sz) {
    state = sz[1].toUpperCase();
    zip = sz[2] ?? null;
    end -= 1;
  } else if (z) {
    zip = z[1];
    end -= 1;
    const st = parts[end - 1]?.match(/^([A-Za-z]{2})$/);
    if (st && end - 1 >= 1) {
      state = st[1].toUpperCase();
      end -= 1;
    }
  } else {
    // "Fairfax VA 22030" in one piece
    const m = last.match(/^(.*?)\s+([A-Za-z]{2})(?:\s+(\d{5})(?:-\d{4})?)?$/);
    if (m && end >= 2) {
      parts[end - 1] = m[1];
      state = m[2].toUpperCase();
      zip = m[3] ?? null;
    }
  }
  if (end < 2) return { street: parts.slice(0, end).join(", ") || null, city: null, zip };
  const town = parts[end - 1];
  const street = parts.slice(0, end - 1).join(", ");
  const city = state && state !== HOME_STATE ? `${town}, ${state}` : town;
  return { street: street || null, city: city || null, zip };
}

/** Back to one line for the address box: "4100 Chain Bridge Rd, Fairfax, VA 22030". */
export function formatAddressLine(street: string | null | undefined, city: string | null | undefined, zip: string | null | undefined): string {
  const c = (city ?? "").trim();
  const cityState = c ? (/,\s*[A-Za-z]{2}$/.test(c) ? c : `${c}, ${HOME_STATE}`) : "";
  const tail = [cityState, zip?.trim()].filter(Boolean).join(" ");
  return [street?.trim(), tail].filter(Boolean).join(", ");
}

/** For Maps links and the jacket header. */
export function addressForMaps(street: string | null | undefined, city: string | null | undefined, zip: string | null | undefined): string {
  return street || city ? formatAddressLine(street, city, zip) : "";
}

export type AddressSuggestion = {
  id: string;
  main: string;
  secondary: string;
  /** Full one-line address when the provider already gave it; otherwise call details with id. */
  line: string | null;
};

export type AddressProvider = "google" | "geoapify" | "photon";

/**
 * Navigate button: Google Maps driving directions. On an iPhone with the Google Maps app this
 * universal link opens the app; otherwise Google Maps in Safari.
 */
export function directionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}
