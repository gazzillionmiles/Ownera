import { Society, SocietyMember } from '@/src/types/ownera';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface SocietiesData {
  societies: Society[];
  memberships: SocietyMember[];
}

let societiesCache: { data: SocietiesData; timestamp: number } | null = null;
let inflightSocietiesPromise: Promise<SocietiesData> | null = null;

export function getSocietiesCache(): Society[] | null {
  if (societiesCache && Date.now() - societiesCache.timestamp < 30000) {
    return societiesCache.data.societies;
  }
  return null;
}

export async function fetchUserSocieties(forceRefresh = false): Promise<SocietiesData> {
  const now = Date.now();
  if (!forceRefresh && societiesCache && now - societiesCache.timestamp < 30000) {
    return societiesCache.data;
  }
  if (!forceRefresh && inflightSocietiesPromise) {
    return inflightSocietiesPromise;
  }
  inflightSocietiesPromise = fetch('/api/societies')
    .then(async (res) => {
      if (res.status === 401) {
        throw new ApiError('Unauthorized', 401);
      }
      if (!res.ok) {
        throw new ApiError('Failed to fetch societies', res.status);
      }
      const data = (await res.json()) as SocietiesData;
      societiesCache = { data, timestamp: Date.now() };
      return data;
    })
    .finally(() => {
      inflightSocietiesPromise = null;
    });

  return inflightSocietiesPromise;
}

export function invalidateSocietiesCache() {
  societiesCache = null;
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(
      `API error: ${res.statusText}`,
      res.status
    );
  }

  const json = await res.json();
  return {
    data: json as T,
    success: true,
    message: 'Success',
  };
}
