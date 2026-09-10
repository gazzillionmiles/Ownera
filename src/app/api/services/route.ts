import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';
import { STANDARDIZED_SERVICES_CATALOG } from '@/src/constants/serviceCategories';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');

    const supabase = createAdminClient();
    // Column list mirrors the ServiceCatalogItem interface in
    // src/types/ownera.ts instead of `select('*')`. This is a small,
    // curated reference table (service types, not user-generated rows), so
    // pagination doesn't apply the way it does for bookings/campaigns/
    // providers — the fix that actually matters here is caching, since the
    // catalog rarely changes but was being re-fetched from the DB on every
    // single request.
    const SERVICE_COLUMNS =
      'id, name, slug, category, description, inclusions, exclusions, typical_duration_minutes, suggested_campaign_days, suggested_slot_duration_minutes, base_price_estimate, icon, created_at';

    let query = supabase
      .from('services')
      .select(SERVICE_COLUMNS)
      .not(
        'slug',
        'in',
        '("chimney-cleaning","mattress-cleaning","sofa-cleaning")'
      )
      .order('name', { ascending: true });

    if (categoryParam) {
      query = query.ilike('category', `%${categoryParam}%`);
    }

    const { data: dbServices, error } = await query;
    const cacheHeaders = {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    };

    if (error || !dbServices || dbServices.length === 0) {
      // Fallback to our complete 12-category standardized catalog
      let fallbackList = STANDARDIZED_SERVICES_CATALOG;
      if (categoryParam) {
        fallbackList = fallbackList.filter(
          (s) =>
            s.category.toLowerCase().includes(categoryParam.toLowerCase()) ||
            s.categoryId.toLowerCase().includes(categoryParam.toLowerCase())
        );
      }
      return NextResponse.json(
        { services: fallbackList },
        { headers: cacheHeaders }
      );
    }

    return NextResponse.json(
      { services: dbServices },
      { headers: cacheHeaders }
    );
  } catch (err: any) {
    console.error('[API/services] Unexpected error:', err);
    return NextResponse.json({ services: STANDARDIZED_SERVICES_CATALOG });
  }
}
