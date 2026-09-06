import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[API/services] Error fetching services:', error);
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
    }

    return NextResponse.json({ services: services || [] });
  } catch (err: any) {
    console.error('[API/services] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
