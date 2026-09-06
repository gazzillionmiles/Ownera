import { NextRequest, NextResponse } from 'next/server';
import { getStates, getCities, getCountries } from '@/lib/locations/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'cities').toLowerCase();
    const country = searchParams.get('country') || 'India';
    const state = searchParams.get('state') || '';
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));

    if (type === 'countries') {
      const result = getCountries({ search, page, limit });
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    if (type === 'states') {
      const result = getStates({ country, search, page, limit });
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    // Default: cities
    const result = getCities({ country, state, search, page, limit });
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    console.error('[API/locations] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch location data', data: [], total: 0, hasMore: false },
      { status: 500 }
    );
  }
}
