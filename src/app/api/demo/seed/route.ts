import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';
import { STANDARDIZED_SERVICES_CATALOG } from '@/src/constants/serviceCategories';

export async function POST() {
  try {
    const supabase = createAdminClient();

    // 1. Delete legacy services: chimney, mattress, and sofa
    await supabase
      .from('services')
      .delete()
      .in('slug', ['chimney-cleaning', 'mattress-cleaning', 'sofa-cleaning']);

    // 2. Upsert Standard 12-Category Services Catalog
    const payload = STANDARDIZED_SERVICES_CATALOG.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      category: s.category,
      description: s.description,
      inclusions: s.inclusions,
      exclusions: s.exclusions,
      typical_duration_minutes: s.typical_duration_minutes,
      suggested_campaign_days: s.suggested_campaign_days,
      suggested_slot_duration_minutes: s.suggested_slot_duration_minutes,
      base_price_estimate: s.base_price_estimate,
      icon: s.icon,
    }));

    const { error } = await supabase.from('services').upsert(payload, { onConflict: 'slug' });
    if (error) {
      console.error('[API/demo/seed] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to seed services', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Standard 12-category services catalog initialized successfully (Chimney, Mattress, and Sofa removed).',
    });
  } catch (err: any) {
    console.error('[API/demo/seed] Error:', err);
    return NextResponse.json({ error: 'Failed to initialize catalog', details: err.message }, { status: 500 });
  }
}
