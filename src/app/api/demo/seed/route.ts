import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Ensure Standard Services Catalog
    const acServiceId = '11111111-1111-1111-1111-111111111001';
    const pestControlServiceId = '11111111-1111-1111-1111-111111111002';

    await supabase.from('services').upsert([
      {
        id: acServiceId,
        name: 'AC Servicing',
        slug: 'ac-servicing',
        category: 'Cooling & HVAC',
        description: 'Standardized jet-pump filter, coil cleaning, drain flush, and gas pressure check for split/window ACs.',
        inclusions: ['Jet-pump indoor filter wash', 'Outdoor unit deep water cleaning', 'Drain tray and pipe flush', 'Refrigerant gas pressure check', 'Operating current and airflow check'],
        exclusions: ['Gas top-up or refilling (billed separately if below spec)', 'Capacitor or PCB circuit board replacement'],
        typical_duration_minutes: 45,
        suggested_campaign_days: 7,
        suggested_slot_duration_minutes: 60,
        base_price_estimate: 699.00,
        icon: 'Wind',
      },
      {
        id: pestControlServiceId,
        name: 'Pest Control',
        slug: 'pest-control',
        category: 'Pest & Hygiene',
        description: 'Odorless gel & spray treatment for cockroaches, ants, and common household pests across all rooms.',
        inclusions: ['Kitchen cabinet gel baiting', 'Bathroom drain anti-pest spraying', 'Wall perimeter crack & crevice sealing spray', '30-day retreat warranty'],
        exclusions: ['Termite drilling / wood treatment', 'Bedbug chemical fogging'],
        typical_duration_minutes: 60,
        suggested_campaign_days: 7,
        suggested_slot_duration_minutes: 90,
        base_price_estimate: 999.00,
        icon: 'Bug',
      },
    ], { onConflict: 'slug' });

    return NextResponse.json({
      success: true,
      message: 'Standard services catalog initialized successfully.',
    });
  } catch (err: any) {
    console.error('[API/demo/seed] Error:', err);
    return NextResponse.json({ error: 'Failed to initialize catalog', details: err.message }, { status: 500 });
  }
}

