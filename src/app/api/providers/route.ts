import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { registerProviderSchema } from '@/src/shared/validations/ownera';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await getVerifiedUser(request, supabase);

    const serviceSupabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const selfOnly = searchParams.get('self') === 'true';

    // Column list mirrors the Provider interface in src/types/ownera.ts
    // instead of `select('*')`.
    const PROVIDER_COLUMNS =
      'id, user_id, company_name, contact_person, phone, email, services_offered, operating_cities, verification_status, rating, total_jobs_completed, completion_rate, bio, created_at, updated_at';

    if (selfOnly) {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: provider, error } = await serviceSupabase
        .from('providers')
        .select(PROVIDER_COLUMNS)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[API/providers] Error fetching self provider:', error);
        return NextResponse.json(
          { error: 'Failed to fetch provider' },
          { status: 500 }
        );
      }

      return NextResponse.json({ provider });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    );
    const rangeStart = (page - 1) * limit;
    const rangeEnd = rangeStart + limit - 1;

    const {
      data: providers,
      error,
      count,
    } = await serviceSupabase
      .from('providers')
      .select(PROVIDER_COLUMNS, { count: 'exact' })
      .order('rating', { ascending: false })
      .range(rangeStart, rangeEnd);

    if (error) {
      console.error('[API/providers] Error fetching providers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch providers' },
        { status: 500 }
      );
    }

    const total = count ?? 0;
    const hasMore = rangeStart + (providers?.length || 0) < total;

    return NextResponse.json({
      providers: providers || [],
      page,
      limit,
      total,
      hasMore,
    });
  } catch (err: any) {
    console.error('[API/providers] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = registerProviderSchema.safeParse(json);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join('. ');
      return NextResponse.json(
        { error: errorMsg, details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      companyName,
      contactPerson,
      phone,
      email,
      servicesOffered,
      operatingCities,
      bio,
    } = parsed.data;

    const serviceSupabase = createAdminClient();

    // Check if provider profile already exists for this user to avoid missing constraint error (42P10)
    const { data: existingProvider, error: selectError } = await serviceSupabase
      .from('providers')
      .select('id, verification_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error(
        '[API/providers] Error checking existing provider:',
        selectError
      );
    }

    if (existingProvider && existingProvider.verification_status === 'banned') {
      return NextResponse.json(
        { error: 'Your vendor account has been suspended by administrators.' },
        { status: 403 }
      );
    }

    let provider;
    if (existingProvider) {
      // Preserve verified status if already approved, or re-submit as pending if previously rejected/unverified
      const nextStatus =
        existingProvider.verification_status === 'verified'
          ? 'verified'
          : 'pending';

      const { data, error: updateError } = await serviceSupabase
        .from('providers')
        .update({
          company_name: companyName,
          contact_person: contactPerson,
          phone,
          email,
          services_offered: servicesOffered,
          operating_cities: operatingCities,
          verification_status: nextStatus,
          bio: bio || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProvider.id)
        .select()
        .single();

      if (updateError) {
        console.error('[API/providers] Update error:', updateError);
        return NextResponse.json(
          {
            error: 'Failed to update provider profile',
            details: updateError.message,
          },
          { status: 500 }
        );
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
          verification_status: 'pending',
          bio: bio || null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[API/providers] Insert error:', insertError);
        return NextResponse.json(
          {
            error: 'Failed to save provider profile',
            details: insertError.message,
          },
          { status: 500 }
        );
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
