import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';
import { STANDARDIZED_SERVICES_CATALOG } from '@/src/constants/serviceCategories';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');

    const supabase = createAdminClient();
    let query = supabase
      .from('services')
      .select('*')
      .not('slug', 'in', '("chimney-cleaning","mattress-cleaning","sofa-cleaning")')
      .order('name', { ascending: true });

    if (categoryParam) {
      query = query.ilike('category', `%${categoryParam}%`);
    }

    const { data: dbServices, error } = await query;

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
      return NextResponse.json({ services: fallbackList });
    }

    return NextResponse.json({ services: dbServices });
  } catch (err: any) {
    console.error('[API/services] Unexpected error:', err);
    return NextResponse.json({ services: STANDARDIZED_SERVICES_CATALOG });
  }
}
