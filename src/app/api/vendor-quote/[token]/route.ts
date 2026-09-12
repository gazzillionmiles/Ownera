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

    if (!cleanToken || cleanToken.length < 4 || cleanToken.length > 128) {
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

    // Look up invite by token using standard PostgREST join
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
      .eq('invite_token', cleanToken)
      .maybeSingle();

    if (invErr || !invite) {
      if (invErr) {
        console.error('[API/vendor-quote/[token] GET] Query error:', invErr);
      }
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
      .select('*')
      .eq('vendor_invite_id', invite.id)
      .maybeSingle();

    const rawCampaign = invite.campaign as any;
    const cleanCampaign = rawCampaign
      ? {
          id: rawCampaign.id,
          title: rawCampaign.title || rawCampaign.custom_service_name || 'Service Camp',
          description: rawCampaign.description,
          event_date: rawCampaign.event_date,
          target_customers: rawCampaign.target_customers || 20,
          minimum_customers: rawCampaign.minimum_customers || 5,
          current_price: rawCampaign.current_price,
          status: rawCampaign.status,
          society: rawCampaign.society
            ? {
                id: rawCampaign.society.id,
                name: rawCampaign.society.name,
                city: rawCampaign.society.city,
                address: rawCampaign.society.address,
              }
            : null,
          service: rawCampaign.service
            ? {
                id: rawCampaign.service.id,
                name: rawCampaign.service.name,
                category: rawCampaign.service.category,
              }
            : null,
        }
      : null;

    // Check if this vendor's quote was selected
    const isSelected = Boolean(
      (existingBid && existingBid.status === 'accepted') ||
      (existingBid && rawCampaign?.selected_bid_id === existingBid.id) ||
      (invite.provider_id && rawCampaign?.selected_provider_id === invite.provider_id)
    );

    let bookings: any[] = [];
    if (isSelected && rawCampaign?.id) {
      const { data: rawBookings } = await serviceSupabase
        .from('bookings')
        .select(`
          id,
          flat_number,
          quantity,
          total_amount,
          status,
          slot:booking_slots(id, slot_time),
          user_profile:profiles(name, phone)
        `)
        .eq('campaign_id', rawCampaign.id)
        .in('status', ['confirmed', 'scheduled', 'completed', 'disputed', 'in_progress'])
        .order('flat_number', { ascending: true });

      bookings = (rawBookings || []).map((b: any) => ({
        id: b.id,
        flat_number: b.flat_number,
        quantity: b.quantity,
        total_amount: b.total_amount,
        status: b.status,
        slot_time: b.slot?.slot_time || 'Coordinated Slot',
        resident_name: b.user_profile?.name || 'Resident',
        resident_phone: b.user_profile?.phone || null,
      }));
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        business_name: invite.business_name,
        phone: invite.phone,
        status: invite.status,
      },
      campaign: cleanCampaign,
      existing_quote: existingBid
        ? {
            id: existingBid.id,
            price_per_unit: existingBid.price_per_unit,
            available_date: existingBid.available_date,
            available_start_time: existingBid.available_start_time,
            technicians_count: existingBid.technicians_count,
            estimated_duration_minutes: existingBid.estimated_duration_minutes,
            simultaneous_capacity: existingBid.simultaneous_capacity,
            total_capacity: existingBid.total_capacity,
            notes: existingBid.notes,
            status: existingBid.status,
          }
        : null,
      is_selected: isSelected,
      bookings,
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

    if (!cleanToken || cleanToken.length < 4 || cleanToken.length > 128) {
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
      .select('*, campaign:service_campaigns(*)')
      .eq('invite_token', cleanToken)
      .maybeSingle();

    if (invErr || !invite) {
      if (invErr) {
        console.error('[API/vendor-quote/[token] POST] Query error:', invErr);
      }
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
    if (campaign && CLOSED_STATUSES.includes(campaign.status)) {
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
          rating: null,
          total_jobs_completed: 0,
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const cleanToken = token?.trim();

    if (!cleanToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { bookingId, notes } = body;

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const serviceSupabase = createAdminClient();

    // Verify token belongs to active invite
    const { data: invite, error: invErr } = await serviceSupabase
      .from('campaign_vendor_invites')
      .select('*, campaign:service_campaigns(*)')
      .eq('invite_token', cleanToken)
      .maybeSingle();

    if (invErr || !invite) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    const campaign = invite.campaign as any;
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify booking belongs to this campaign
    const { data: booking, error: bErr } = await serviceSupabase
      .from('bookings')
      .select('*, user_profile:profiles(name, phone)')
      .eq('id', bookingId)
      .eq('campaign_id', campaign.id)
      .single();

    if (bErr || !booking) {
      return NextResponse.json({ error: 'Booking not found for this campaign' }, { status: 404 });
    }

    // Mark completed
    await serviceSupabase
      .from('bookings')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    // Record in service_completions
    await serviceSupabase.from('service_completions').insert({
      booking_id: bookingId,
      provider_id: invite.provider_id || booking.provider_id,
      marked_completed_at: new Date().toISOString(),
      resident_status: 'unconfirmed',
      notes: notes || 'Marked completed via outside vendor service portal',
    });

    // Update campaign participant status
    await serviceSupabase
      .from('campaign_participants')
      .update({ status: 'completed' })
      .eq('campaign_id', campaign.id)
      .eq('user_id', booking.user_id);

    // Increment provider total_jobs_completed if provider exists
    const provId = invite.provider_id || booking.provider_id;
    if (provId) {
      const { data: prov } = await serviceSupabase
        .from('providers')
        .select('total_jobs_completed')
        .eq('id', provId)
        .maybeSingle();

      if (prov) {
        await serviceSupabase
          .from('providers')
          .update({ total_jobs_completed: (prov.total_jobs_completed || 0) + 1 })
          .eq('id', provId);
      }
    }

    // Send notification to resident
    await serviceSupabase.from('notifications').insert({
      user_id: booking.user_id,
      title: 'Service Completed! 🌟',
      message: `Your ${campaign.title || 'service'} has been marked completed by the technician. Please rate your experience!`,
      link: `/home`,
      type: 'completion',
    });

    return NextResponse.json({
      success: true,
      message: `Unit ${booking.flat_number} marked completed! Resident has been prompted for review.`,
    });
  } catch (err: any) {
    console.error('[API/vendor-quote/[token] PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
