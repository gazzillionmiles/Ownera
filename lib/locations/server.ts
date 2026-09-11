import fs from 'fs';
import path from 'path';

export interface LocationState {
  name: string;
  state_code: string;
  cities_count: number;
}

export interface LocationItem {
  id: string;
  name: string;
  state?: string;
  country?: string;
}

interface CountryData {
  name: string;
  iso2: string;
  states: {
    name: string;
    state_code: string;
    cities: string[];
  }[];
}

interface CountryIndexEntry {
  name: string;
  iso2: string;
  states_count: number;
}

const LOCATIONS_DIR = path.join(process.cwd(), 'data', 'locations');

// Per-country parsed data, loaded lazily on first request for that country
// (previously the code parsed the entire 45MB world file on every cold
// start, even though ~99% of traffic only ever needs one country).
const countryCache = new Map<string, CountryData | null>();
let countryIndexCache: CountryIndexEntry[] | null = null;

// Cache the *computed* (filtered/sorted) combined-city list per country so
// repeat "all cities in country, no state" requests don't redo an O(n log n)
// sort of thousands of cities on every request.
const allCitiesCache = new Map<string, { name: string; state: string }[]>();

function loadCountryIndex(): CountryIndexEntry[] {
  if (countryIndexCache) return countryIndexCache;

  const indexPath = path.join(LOCATIONS_DIR, '_index.json');
  if (!fs.existsSync(indexPath)) {
    console.warn(
      '[Locations] index not found at:',
      indexPath,
      '- run scripts/split-locations.mjs'
    );
    countryIndexCache = [];
    return countryIndexCache;
  }

  try {
    countryIndexCache = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    return countryIndexCache!;
  } catch (err) {
    console.error('[Locations] Error parsing location index:', err);
    countryIndexCache = [];
    return countryIndexCache;
  }
}

function resolveIso2(countryNameOrIso2: string): string | null {
  const q = countryNameOrIso2.toLowerCase();
  const match = loadCountryIndex().find(
    (c) => c.name.toLowerCase() === q || c.iso2.toLowerCase() === q
  );
  return match ? match.iso2.toLowerCase() : null;
}

function loadCountry(countryNameOrIso2: string): CountryData | null {
  const iso2 = resolveIso2(countryNameOrIso2);
  if (!iso2) return null;

  if (countryCache.has(iso2)) {
    return countryCache.get(iso2)!;
  }

  const filePath = path.join(LOCATIONS_DIR, `${iso2}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn('[Locations] country file not found at:', filePath);
    countryCache.set(iso2, null);
    return null;
  }

  try {
    const data: CountryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    countryCache.set(iso2, data);
    return data;
  } catch (err) {
    console.error('[Locations] Error parsing country file:', iso2, err);
    countryCache.set(iso2, null);
    return null;
  }
}

function sortBySearchRelevance<T extends { name: string }>(
  list: T[],
  q: string
): T[] {
  return [...list].sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q);
    const bStarts = b.name.toLowerCase().startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.name.localeCompare(b.name);
  });
}

function paginate<T>(list: T[], page: number, limit: number) {
  const total = list.length;
  const startIndex = Math.max(0, (page - 1) * limit);
  const data = list.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + data.length < total;
  return { data, total, hasMore, page };
}

/**
 * Fetch states for a given country (defaulting to India)
 */
export function getStates({
  country = 'India',
  search = '',
  page = 1,
  limit = 25,
}: {
  country?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const cTarget = loadCountry(country);
  if (!cTarget) {
    return { data: [], total: 0, hasMore: false, page };
  }

  let statesList: LocationState[] = cTarget.states.map((s) => ({
    name: s.name,
    state_code: s.state_code,
    cities_count: s.cities.length,
  }));

  const q = search.trim().toLowerCase();
  if (q) {
    statesList = sortBySearchRelevance(
      statesList.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.state_code && s.state_code.toLowerCase().includes(q))
      ),
      q
    );
  } else {
    statesList.sort((a, b) => a.name.localeCompare(b.name));
  }

  return paginate(statesList, page, limit);
}

/**
 * Fetch cities for a country and state
 */
export function getCities({
  country = 'India',
  state = '',
  search = '',
  page = 1,
  limit = 25,
}: {
  country?: string;
  state?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const cTarget = loadCountry(country);
  if (!cTarget) {
    return { data: [], total: 0, hasMore: false, page };
  }
  const iso2 = cTarget.iso2.toLowerCase();

  let rawCities: { name: string; state: string }[];

  if (state.trim()) {
    const sTarget = cTarget.states.find(
      (s) =>
        s.name.toLowerCase() === state.toLowerCase() ||
        (s.state_code && s.state_code.toLowerCase() === state.toLowerCase())
    );
    rawCities = sTarget
      ? sTarget.cities.map((ci) => ({ name: ci, state: sTarget.name }))
      : [];
  } else {
    // Combine + sort all cities in the country once per country, then reuse
    // that sorted list for every subsequent request instead of rebuilding
    // and re-sorting a multi-thousand-item array on every call.
    const cacheKey = iso2;
    let combined = allCitiesCache.get(cacheKey);
    if (!combined) {
      combined = [];
      for (const s of cTarget.states) {
        for (const ci of s.cities) {
          combined.push({ name: ci, state: s.name });
        }
      }
      combined.sort((a, b) => a.name.localeCompare(b.name));
      allCitiesCache.set(cacheKey, combined);
    }
    rawCities = combined;
  }

  const q = search.trim().toLowerCase();
  let filtered = rawCities;

  if (q) {
    filtered = sortBySearchRelevance(
      rawCities.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
      ),
      q
    );
  }
  // else: already sorted (either the cached combined list, or a single
  // state's city list which we sort below on first touch).
  else if (state.trim()) {
    filtered = [...rawCities].sort((a, b) => a.name.localeCompare(b.name));
  }

  return paginate(filtered, page, limit);
}

/**
 * Fetch available countries
 */
export function getCountries({
  search = '',
  page = 1,
  limit = 50,
}: {
  search?: string;
  page?: number;
  limit?: number;
} = {}) {
  let list = loadCountryIndex();

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q)
    );
  }

  // Put India at the top by default
  list = [...list].sort((a, b) => {
    if (a.name === 'India') return -1;
    if (b.name === 'India') return 1;
    return a.name.localeCompare(b.name);
  });

  return paginate(list, page, limit);
}
