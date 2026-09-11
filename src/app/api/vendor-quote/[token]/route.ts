import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/service';
import { submitVendorQuoteSchema } from '@/src/shared/validations/ownera';
import {
  getClientIp,
  checkRateLimit,
  createRateLimitResponse,
} from '@/lib/ratelimit';

const CLOSED_STATUSES = [
  'quote_selected',
  'booking_open',
  'confirmed',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const cleanToken = token?.trim();

    if (!cleanToken || !/^vq_[a-zA-Z0-9_-]{16,64}$/.test(cleanToken)) {
      return NextResponse.json(
        { error: 'Invalid invitation link format' },
        { status: 400 }
      );
    }

    // Rate limiting: 60 requests per minute per IP
    const ip = getClientIp(request);
    const rl = await checkRateLimit({
      key: `ratelimit:vendor-quote:get:${ip}`,
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.success) {
      return createRateLimitResponse('Too many requests. Please wait a moment.');
    }

    const serviceSupabase = createAdminClient();

    // Look up invite by token with strict column projection
    const { data: invite, error: invErr } = await serviceSupabase
      .from('campaign_vendor_invites')
      .select(`
        id,
        business_name,
        phone,
        status,
        campaign_id,
        invite_token,
        created_at,
        campaign:service_campaigns(
          id,
          title,
          description,
          event_date,
          target_customers,
          minimum_customers,
          current_price,
          status,
          society:societies(
            id,
            name,
            city,
            locality
          ),
          service:services(
            id,
            name,
            category
          )
        )
      `)
      .eq('invite_token', cleanToken)
      .maybeSingle();

    if (invErr || !invite || !invite.campaign) {
      return NextResponse.json(
        { error: 'Invalid or expired vendor invitation link' },
        { status: 404 }
      );
    }

    if (invite.status === 'declined') {
      return NextResponse.json(
        { error: 'This vendor invitation link is no longer active.' },
        { status: 410 }
      );
    }

    // Check if an existing quote has already been submitted for this invite
    const { data: existingBid } = await serviceSupabase
      .from('provider_bids')
      .select(`
        id,
        price_per_unit,
        available_date,
        available_start_time,
        technicians_count,
        estimated_duration_minutes,
        simultaneous_capacity,
        total_capacity,
        notes,
        status
      `)
      .eq('vendor_invite_id', invite.id)
      .maybeSingle();

    return NextResponse.json({
      invite: {
        id: invite.id,
        business_name: invite.business_name,
        phone: invite.phone,
        status: invite.status,
      },
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
    const cleanToken = token?.trim();

    if (!cleanToken || !/^vq_[a-zA-Z0-9_-]{16,64}$/.test(cleanToken)) {
      return NextResponse.json(
        { error: 'Invalid invitation link format' },
        { status: 400 }
      );
    }

    // Rate limiting: 15 submissions per 10 minutes per IP
    const ip = getClientIp(request);
    const rl = await checkRateLimit({
      key: `ratelimit:vendor-quote:post:${ip}`,
      limit: 15,
      windowSeconds: 600,
    });
    if (!rl.success) {
      return createRateLimitResponse(
        'Too many submissions. Please wait before trying again.'
      );
    }

    const serviceSupabase = createAdminClient();

    // Verify token and fetch associated campaign status
    const { data: invite, error: invErr } = await serviceSupabase
      .from('campaign_vendor_invites')
      .select(`
        id,
        campaign_id,
        provider_id,
        business_name,
        phone,
        invited_by,
        status,
        campaign:service_campaigns(
          id,
          title,
          status,
          event_date
        )
      `)
      .eq('invite_token', cleanToken)
      .maybeSingle();

    if (invErr || !invite || !invite.campaign) {
      return NextResponse.json(
        { error: 'Invalid or expired vendor invitation link' },
        { status: 404 }
      );
    }

    if (invite.status === 'declined') {
      return NextResponse.json(
        { error: 'This vendor invitation link is no longer active.' },
        { status: 410 }
      );
    }

    const campaign = invite.campaign as any;
    if (CLOSED_STATUSES.includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Quote submissions are closed for this service event.' },
        { status: 400 }
      );
    }

    // Check if an existing quote is already accepted
    const { data: existingBid } = await serviceSupabase
      .from('provider_bids')
      .select('id, status')
      .eq('vendor_invite_id', invite.id)
      .maybeSingle();

    if (existingBid && existingBid.status === 'accepted') {
      return NextResponse.json(
        { error: 'Your quote has already been accepted and cannot be modified.' },
        { status: 400 }
      );
    }

    const json = await request.json();
    const parsed = submitVendorQuoteSchema.safeParse({
      ...json,
      campaignId: invite.campaign_id,
      inviteToken: cleanToken,
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
      // Check if phone matches an existing provider
      const { data: existingProv } = await serviceSupabase
        .from('providers')
        .select('id')
        .eq('phone', invite.phone)
        .maybeSingle();

      if (existingProv) {
        providerId = existingProv.id;
      } else {
        const provPayload = {
          company_name: invite.business_name,
          contact_person: invite.business_name,
          phone: invite.phone,
          email: `${invite.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '')}_${Date.now()}@vendor.ownera.in`,
          verification_status: 'verified',
          rating: 4.8,
          total_jobs_completed: 10,
        };

        // Try inserting with null user_id (unregistered provider)
        let createdProv: any = null;
        const { data: newProv, error: pErr } = await serviceSupabase
          .from('providers')
          .insert({
            ...provPayload,
            user_id: null,
          })
          .select('id')
          .single();

        if (pErr) {
          // If NOT NULL constraint exists in DB, generate a shadow auth user
          if (pErr.code === '23502') {
            const shadowEmail = `vendor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@vendor.ownera.in`;
            const { data: authUser, error: authErr } =
              await serviceSupabase.auth.admin.createUser({
                email: shadowEmail,
                password: crypto.randomBytes(16).toString('hex'),
                email_confirm: true,
              });

            if (!authErr && authUser?.user) {
              const { data: retryProv } = await serviceSupabase
                .from('providers')
                .insert({
                  ...provPayload,
                  user_id: authUser.user.id,
                })
                .select('id')
                .single();
              createdProv = retryProv;
            }
          }
        } else {
          createdProv = newProv;
        }

        if (!createdProv) {
          console.error('[API/vendor-quote] Error creating provider profile:', pErr);
          return NextResponse.json(
            { error: 'Failed to create vendor record' },
            { status: 500 }
          );
        }
        providerId = createdProv.id;
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
          warranty_days: Number(warrantyDays) || 0,
          inclusions,
          exclusions,
          notes,
          status: 'submitted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBid.id)
        .select(`
          id,
          price_per_unit,
          available_date,
          available_start_time,
          technicians_count,
          estimated_duration_minutes,
          simultaneous_capacity,
          total_capacity,
          notes,
          status
        `)
        .single();

      if (uErr) {
        return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
      }
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
          warranty_days: Number(warrantyDays) || 0,
          inclusions,
          exclusions,
          notes,
          status: 'submitted',
        })
        .select(`
          id,
          price_per_unit,
          available_date,
          available_start_time,
          technicians_count,
          estimated_duration_minutes,
          simultaneous_capacity,
          total_capacity,
          notes,
          status
        `)
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
        title: 'New Vendor Quote Received! 🎯',
        message: `${invite.business_name} quoted ₹${pricePerUnit}/unit for "${campaign.title}".`,
        link: '/home',
        type: 'bid',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Your quote of ₹${pricePerUnit} per home was submitted!`,
      bid,
    });
  } catch (err: any) {
    console.error('[API/vendor-quote/[token] POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
