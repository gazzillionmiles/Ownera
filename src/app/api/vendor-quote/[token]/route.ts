import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service';
import { submitVendorQuoteSchema } from '@/src/shared/validations/ownera';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const serviceSupabase = createAdminClient();

    // Look up invite by token
    const { data: invite, error: invErr } = await serviceSupabase
      .from('campaign_vendor_invites')
      .select(`
        *,
        campaign:service_campaigns(
          *,
          society:societies(*),
          service:services(*)
        )
      `)
      .eq('invite_token', token.trim())
      .maybeSingle();

    if (invErr || !invite) {
      return NextResponse.json({ error: 'Invalid or expired vendor invitation link' }, { status: 404 });
    }

    // Check if an existing quote has already been submitted for this invite
    const { data: existingBid } = await serviceSupabase
      .from('provider_bids')
      .select('*')
      .eq('vendor_invite_id', invite.id)
      .maybeSingle();

    return NextResponse.json({
      invite,
      campaign: invite.campaign,
      existing_quote: existingBid || null,
    });
  } catch (err: any) {
    console.error('[API/vendor-quote/[token] GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const serviceSupabase = createAdminClient();

    // Verify token
    const { data: invite, error: invErr } = await serviceSupabase
      .from('campaign_vendor_invites')
      .select('*, campaign:service_campaigns(*)')
      .eq('invite_token', token.trim())
      .maybeSingle();

    if (invErr || !invite) {
      return NextResponse.json({ error: 'Invalid or expired vendor invitation link' }, { status: 404 });
    }

    const json = await request.json();
    const parsed = submitVendorQuoteSchema.safeParse({
      ...json,
      campaignId: invite.campaign_id,
      inviteToken: token,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid quote details', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      pricePerUnit,
      availableDate,
      availableStartTime,
      simultaneousCapacity,
      techniciansCount,
      estimatedDurationMinutes,
      totalCapacity,
      warrantyDays,
      inclusions,
      exclusions,
      notes,
    } = parsed.data;

    // Ensure a provider profile placeholder exists or link to existing
    let providerId = invite.provider_id;

    if (!providerId) {
      // Auto-create or find provider by phone
      const { data: existingProv } = await serviceSupabase
        .from('providers')
        .select('id')
        .eq('phone', invite.phone)
        .maybeSingle();

      if (existingProv) {
        providerId = existingProv.id;
      } else {
        const { data: newProv, error: pErr } = await serviceSupabase
          .from('providers')
          .insert({
            user_id: invite.invited_by, // Temporary association for unauthenticated vendor
            company_name: invite.business_name,
            contact_person: invite.business_name,
            phone: invite.phone,
            email: `${invite.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '')}@vendor.ownera.in`,
            verification_status: 'verified',
            rating: 4.8,
            total_jobs_completed: 10,
          })
          .select()
          .single();

        if (pErr || !newProv) {
          console.error('[API/vendor-quote] Error creating provider profile:', pErr);
          return NextResponse.json({ error: 'Failed to create vendor record' }, { status: 500 });
        }
        providerId = newProv.id;
      }

      // Link provider_id back to invite
      await serviceSupabase
        .from('campaign_vendor_invites')
        .update({ provider_id: providerId, status: 'quote_submitted' })
        .eq('id', invite.id);
    } else {
      await serviceSupabase
        .from('campaign_vendor_invites')
        .update({ status: 'quote_submitted' })
        .eq('id', invite.id);
    }

    // Insert or update quote in provider_bids
    const { data: existingBid } = await serviceSupabase
      .from('provider_bids')
      .select('id')
      .eq('vendor_invite_id', invite.id)
      .maybeSingle();

    let bid;

    if (existingBid) {
      const { data: updated, error: uErr } = await serviceSupabase
        .from('provider_bids')
        .update({
          price_per_unit: pricePerUnit,
          available_date: availableDate,
          available_start_time: availableStartTime,
          simultaneous_capacity: simultaneousCapacity,
          technicians_count: techniciansCount,
          estimated_duration_minutes: estimatedDurationMinutes,
          total_capacity: totalCapacity,
          warranty_days: warrantyDays,
          inclusions,
          exclusions,
          notes,
          status: 'submitted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBid.id)
        .select()
        .single();

      if (uErr) return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
      bid = updated;
    } else {
      const { data: created, error: cErr } = await serviceSupabase
        .from('provider_bids')
        .insert({
          campaign_id: invite.campaign_id,
          provider_id: providerId,
          vendor_invite_id: invite.id,
          price_per_unit: pricePerUnit,
          available_date: availableDate,
          available_start_time: availableStartTime,
          simultaneous_capacity: simultaneousCapacity,
          technicians_count: techniciansCount,
          estimated_duration_minutes: estimatedDurationMinutes,
          total_capacity: totalCapacity,
          warranty_days: warrantyDays,
          inclusions,
          exclusions,
          notes,
          status: 'submitted',
        })
        .select()
        .single();

      if (cErr) {
        console.error('[API/vendor-quote POST] Insert bid error:', cErr);
        return NextResponse.json({ error: 'Failed to record quote' }, { status: 500 });
      }
      bid = created;
    }

    // Notify campaign creator
    if (invite.invited_by) {
      await serviceSupabase.from('notifications').insert({
        user_id: invite.invited_by,
        title: 'Vendor Quote Received 🎯',
        message: `${invite.business_name} submitted a quote of ₹${pricePerUnit}/unit for "${invite.campaign?.title}". Compare offers now!`,
        link: `/home`,
        type: 'bid',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Quote of ₹${pricePerUnit}/unit submitted successfully! The organizer has been notified.`,
      bid,
    });
  } catch (err: any) {
    console.error('[API/vendor-quote/[token] POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
