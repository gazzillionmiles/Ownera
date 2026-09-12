import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { listProviderReviewsQuerySchema } from '@/src/shared/validations/ownera';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    // Matches the existing "Anyone authenticated can view ratings" RLS
    // policy on service_ratings — reviews are visible platform-wide to any
    // signed-in resident comparing vendors, not just the vendor's own society.
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = listProviderReviewsQuerySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { limit, offset } = parsed.data;
    const serviceSupabase = createAdminClient();

    const { data: provider, error: providerErr } = await serviceSupabase
      .from('providers')
      .select('id, company_name, rating')
      .eq('id', providerId)
      .maybeSingle();

    if (providerErr || !provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    const { data: ratings, error: ratingsErr, count } = await serviceSupabase
      .from('service_ratings')
      .select(
        'id, rating, review, created_at, campaign_id, user_id, campaign:service_campaigns(title)',
        { count: 'exact' }
      )
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ratingsErr) {
      console.error('[API/providers/[id]/reviews GET] Fetch error:', ratingsErr);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    // Look up reviewer first names separately (profiles isn't a FK-declared
    // relationship from service_ratings, so it can't be embedded in the
    // select above). Only a first name is surfaced — never the flat number —
    // to avoid exposing a resident's exact unit to vendors/other societies.
    const userIds = Array.from(new Set((ratings || []).map((r) => r.user_id)));
    let namesByUserId: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await serviceSupabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      namesByUserId = Object.fromEntries(
        (profiles || []).map((p) => [p.id, (p.name || '').split(' ')[0] || 'Resident'])
      );
    }

    const reviews = (ratings || []).map((r: any) => ({
      id: r.id,
      rating: r.rating,
      review: r.review,
      created_at: r.created_at,
      campaign_title: r.campaign?.title || null,
      reviewer_name: namesByUserId[r.user_id] || 'Verified Resident',
    }));

    // Computed from the full set (not just this page) so the breakdown stays
    // accurate regardless of pagination.
    const { data: allRatingValues } = await serviceSupabase
      .from('service_ratings')
      .select('rating')
      .eq('provider_id', providerId);

    const ratingCounts = [0, 0, 0, 0, 0, 0]; // index 1-5 used
    (allRatingValues || []).forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) ratingCounts[r.rating] += 1;
    });

    return NextResponse.json({
      success: true,
      provider: { id: provider.id, company_name: provider.company_name, rating: provider.rating },
      reviews,
      totalCount: count ?? reviews.length,
      ratingBreakdown: {
        1: ratingCounts[1],
        2: ratingCounts[2],
        3: ratingCounts[3],
        4: ratingCounts[4],
        5: ratingCounts[5],
      },
    });
  } catch (err: any) {
    console.error('[API/providers/[id]/reviews GET] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
