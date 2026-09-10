import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { requirePlatformPermission } from '@/lib/ownera/rbac';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();
    try {
      await requirePlatformPermission(
        serviceSupabase,
        user.id,
        'platform.providers.manage'
      );
    } catch (authErr: any) {
      return NextResponse.json(
        { error: authErr.message || 'Platform administrator access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all';
    const searchQuery = (searchParams.get('search') || '').toLowerCase().trim();

    // 1. Fetch all providers
    let query = serviceSupabase
      .from('providers')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('verification_status', statusFilter);
    }

    const { data: rawProviders, error: fetchErr } = await query;

    if (fetchErr) {
      console.error('[API/admin/providers GET] Fetch error:', fetchErr);
      return NextResponse.json(
        { error: 'Failed to fetch providers' },
        { status: 500 }
      );
    }

    // 2. Fetch stats across all providers (unfiltered)
    const { data: allStatuses } = await serviceSupabase
      .from('providers')
      .select('verification_status');

    const stats = {
      total: (allStatuses || []).length,
      pending: (allStatuses || []).filter(
        (p) =>
          p.verification_status === 'pending' ||
          p.verification_status === 'unverified'
      ).length,
      verified: (allStatuses || []).filter(
        (p) => p.verification_status === 'verified'
      ).length,
      banned: (allStatuses || []).filter(
        (p) => p.verification_status === 'banned'
      ).length,
      rejected: (allStatuses || []).filter(
        (p) => p.verification_status === 'rejected'
      ).length,
    };

    // 3. Optional client-side search filtering if requested
    let providers = rawProviders || [];
    if (searchQuery) {
      providers = providers.filter((p) => {
        const name = (p.company_name || '').toLowerCase();
        const contact = (p.contact_person || '').toLowerCase();
        const phone = (p.phone || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const cities = Array.isArray(p.operating_cities)
          ? p.operating_cities.join(' ').toLowerCase()
          : '';
        return (
          name.includes(searchQuery) ||
          contact.includes(searchQuery) ||
          phone.includes(searchQuery) ||
          email.includes(searchQuery) ||
          cities.includes(searchQuery)
        );
      });
    }

    return NextResponse.json({ providers, stats });
  } catch (err: any) {
    console.error('[API/admin/providers GET] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
