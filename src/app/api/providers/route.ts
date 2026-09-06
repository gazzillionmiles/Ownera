import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const serviceSupabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const selfOnly = searchParams.get('self') === 'true';

    if (selfOnly) {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: provider, error } = await serviceSupabase
        .from('providers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[API/providers] Error fetching self provider:', error);
        return NextResponse.json({ error: 'Failed to fetch provider' }, { status: 500 });
      }

      return NextResponse.json({ provider });
    }

    const { data: providers, error } = await serviceSupabase
      .from('providers')
      .select('*')
      .order('rating', { ascending: false });

    if (error) {
      console.error('[API/providers] Error fetching providers:', error);
      return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
    }

    return NextResponse.json({ providers: providers || [] });
  } catch (err: any) {
    console.error('[API/providers] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const { companyName, contactPerson, phone, email, servicesOffered, operatingCities, bio } = json;

    if (!companyName || !phone || !email) {
      return NextResponse.json({ error: 'Company name, phone and email are required' }, { status: 400 });
    }

    const serviceSupabase = createAdminClient();

    const { data: provider, error } = await serviceSupabase
      .from('providers')
      .upsert(
        {
          user_id: user.id,
          company_name: companyName,
          contact_person: contactPerson || user.user_metadata?.name || 'Provider',
          phone,
          email,
          services_offered: servicesOffered || ['AC Servicing', 'Pest Control', 'Deep Cleaning'],
          operating_cities: operatingCities || ['Bengaluru'],
          verification_status: 'verified',
          bio,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[API/providers] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to save provider profile' }, { status: 500 });
    }

    // Update active role to provider
    await serviceSupabase
      .from('profiles')
      .update({ active_role: 'provider' })
      .eq('id', user.id);

    return NextResponse.json({ success: true, provider });
  } catch (err: any) {
    console.error('[API/providers] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
