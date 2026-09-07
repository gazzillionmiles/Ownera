import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { registerProviderSchema } from '@/src/shared/validations/ownera';

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
    const parsed = registerProviderSchema.safeParse(json);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join('. ');
      return NextResponse.json({ error: errorMsg, details: parsed.error.format() }, { status: 400 });
    }

    const { companyName, contactPerson, phone, email, servicesOffered, operatingCities, bio } = parsed.data;

    const serviceSupabase = createAdminClient();

    // Check if provider profile already exists for this user to avoid missing constraint error (42P10)
    const { data: existingProvider, error: selectError } = await serviceSupabase
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error('[API/providers] Error checking existing provider:', selectError);
    }

    let provider;
    if (existingProvider) {
      const { data, error: updateError } = await serviceSupabase
        .from('providers')
        .update({
          company_name: companyName,
          contact_person: contactPerson,
          phone,
          email,
          services_offered: servicesOffered,
          operating_cities: operatingCities,
          verification_status: 'verified',
          bio: bio || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProvider.id)
        .select()
        .single();

      if (updateError) {
        console.error('[API/providers] Update error:', updateError);
        return NextResponse.json({ error: 'Failed to update provider profile', details: updateError.message }, { status: 500 });
      }
      provider = data;
    } else {
      const { data, error: insertError } = await serviceSupabase
        .from('providers')
        .insert({
          user_id: user.id,
          company_name: companyName,
          contact_person: contactPerson,
          phone,
          email,
          services_offered: servicesOffered,
          operating_cities: operatingCities,
          verification_status: 'verified',
          bio: bio || null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[API/providers] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to save provider profile', details: insertError.message }, { status: 500 });
      }
      provider = data;
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
