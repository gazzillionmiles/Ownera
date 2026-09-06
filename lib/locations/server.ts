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

let cachedCountries: CountryData[] | null = null;

function loadLocations(): CountryData[] {
  if (cachedCountries) {
    return cachedCountries;
  }

  const filePath = path.join(process.cwd(), 'countries+states+cities.json');
  if (!fs.existsSync(filePath)) {
    console.warn('[Locations] countries+states+cities.json not found at:', filePath);
    return [];
  }

  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const raw = JSON.parse(rawContent);

    cachedCountries = raw.map((c: any) => ({
      name: c.name,
      iso2: c.iso2,
      states: (c.states || []).map((s: any) => ({
        name: s.name,
        state_code: s.state_code || '',
        cities: (s.cities || []).map((ci: any) => (typeof ci === 'string' ? ci : ci.name)).filter(Boolean),
      })),
    }));

    return cachedCountries!;
  } catch (err) {
    console.error('[Locations] Error parsing countries+states+cities.json:', err);
    return [];
  }
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
  const countries = loadLocations();
  const cTarget = countries.find(
    (c) =>
      c.name.toLowerCase() === country.toLowerCase() ||
      c.iso2.toLowerCase() === country.toLowerCase()
  );

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
    statesList = statesList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.state_code && s.state_code.toLowerCase().includes(q))
    );
    statesList.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    });
  } else {
    statesList.sort((a, b) => a.name.localeCompare(b.name));
  }

  const total = statesList.length;
  const startIndex = Math.max(0, (page - 1) * limit);
  const data = statesList.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + data.length < total;

  return {
    data,
    total,
    hasMore,
    page,
  };
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
  const countries = loadLocations();
  const cTarget = countries.find(
    (c) =>
      c.name.toLowerCase() === country.toLowerCase() ||
      c.iso2.toLowerCase() === country.toLowerCase()
  );

  if (!cTarget) {
    return { data: [], total: 0, hasMore: false, page };
  }

  let rawCities: { name: string; state: string }[] = [];

  if (state.trim()) {
    const sTarget = cTarget.states.find(
      (s) =>
        s.name.toLowerCase() === state.toLowerCase() ||
        (s.state_code && s.state_code.toLowerCase() === state.toLowerCase())
    );
    if (sTarget) {
      rawCities = sTarget.cities.map((ci) => ({ name: ci, state: sTarget.name }));
    }
  } else {
    // If no state provided, combine all cities in the country
    for (const s of cTarget.states) {
      for (const ci of s.cities) {
        rawCities.push({ name: ci, state: s.name });
      }
    }
  }

  const q = search.trim().toLowerCase();
  let filtered = rawCities;

  if (q) {
    filtered = rawCities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
    );
    filtered.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    });
  } else {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  const total = filtered.length;
  const startIndex = Math.max(0, (page - 1) * limit);
  const data = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + data.length < total;

  return {
    data,
    total,
    hasMore,
    page,
  };
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
  const countries = loadLocations();
  let list = countries.map((c) => ({
    name: c.name,
    iso2: c.iso2,
    states_count: c.states.length,
  }));

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q)
    );
  }

  // Put India at the top by default
  list.sort((a, b) => {
    if (a.name === 'India') return -1;
    if (b.name === 'India') return 1;
    return a.name.localeCompare(b.name);
  });

  const total = list.length;
  const startIndex = Math.max(0, (page - 1) * limit);
  const data = list.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + data.length < total;

  return {
    data,
    total,
    hasMore,
    page,
  };
}
