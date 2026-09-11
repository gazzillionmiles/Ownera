import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { inviteVendorSchema } from '@/src/shared/validations/ownera';
import { isCommittee, isPlatformAdmin } from '@/lib/ownera/rbac';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getVerifiedUser(request, supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = inviteVendorSchema.safeParse({ ...json, campaignId: id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid invitation payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { option, providerId, businessName, phone, whatsappNumber } =
      parsed.data;
    const serviceSupabase = createAdminClient();

    // Fetch poll
    const { data: poll, error: pollErr } = await serviceSupabase
      .from('service_campaigns')
      .select('*, society:societies(*)')
      .eq('id', id)
      .maybeSingle();

    if (pollErr || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Verify caller is the creator or secretary/committee
    const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
    const isSecOrCom = await isCommittee(
      user.id,
      poll.society_id,
      serviceSupabase
    );
    const isCreator = poll.organizer_id === user.id;

    if (!isCreator && !isSecOrCom && !isPlatform) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the campaign creator or society secretary can invite vendors',
        },
        { status: 403 }
      );
    }

    // Unapproved society campaigns cannot invite providers
    if (
      poll.scope === 'society' &&
      poll.secretary_approval_status === 'pending'
    ) {
      return NextResponse.json(
        {
          error:
            'Society campaign must be approved by the Secretary before inviting providers',
        },
        { status: 400 }
      );
    }

    // Generate secure token for vendor quote access
    const inviteToken = `vq_${crypto.randomBytes(16).toString('hex')}`;

    if (option === 'existing_provider') {
      if (!providerId) {
        return NextResponse.json(
          { error: 'providerId required for existing provider' },
          { status: 400 }
        );
      }

      const { data: provider } = await serviceSupabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();

      if (!provider) {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 }
        );
      }

      // Record in campaign_vendor_invites
      const { data: invite, error: invErr } = await serviceSupabase
        .from('campaign_vendor_invites')
        .insert({
          campaign_id: id,
          provider_id: provider.id,
          business_name: provider.company_name,
          phone: provider.phone,
          whatsapp_number: provider.phone,
          invited_by: user.id,
          status: 'invited',
          invite_token: inviteToken,
        })
        .select()
        .single();

      if (invErr) {
        console.error('[API/polls/[id]/invite-vendor] Insert error:', invErr);
        return NextResponse.json(
          { error: 'Failed to record provider invitation' },
          { status: 500 }
        );
      }

      // Backwards-compatible campaign_provider_invites
      await serviceSupabase.from('campaign_provider_invites').upsert(
        {
          campaign_id: id,
          provider_id: provider.id,
          status: 'invited',
        },
        { onConflict: 'campaign_id,provider_id' }
      );

      // Notify provider user if registered
      if (provider.user_id) {
        await serviceSupabase.from('notifications').insert({
          user_id: provider.user_id,
          title: 'New Service Campaign Invitation! 🎯',
          message: `You've been invited to submit a quote for "${poll.title}" at ${poll.society?.name || 'Society'}.`,
          link: `/partner`,
          type: 'bid',
        });
      }

      // Update campaign status
      if (
        poll.status === 'poll_active' ||
        poll.status === 'approved' ||
        poll.status === 'open'
      ) {
        await serviceSupabase
          .from('service_campaigns')
          .update({
            status: 'quotes_invited',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }

      return NextResponse.json({
        success: true,
        message: `Invited ${provider.company_name} to submit a quote!`,
        invite,
      });
    } else {
      // Option B: Custom local vendor
      if (!businessName || !phone) {
        return NextResponse.json(
          {
            error:
              'Business name and phone number are required to invite a vendor',
          },
          { status: 400 }
        );
      }

      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').slice(-10);

      // Check if this phone number belongs to a registered service provider
      const { data: matchedProvider } = await serviceSupabase
        .from('providers')
        .select('id, user_id, company_name')
        .or(`phone.ilike.%${cleanPhone}%`)
        .maybeSingle();

      const { data: invite, error: invErr } = await serviceSupabase
        .from('campaign_vendor_invites')
        .insert({
          campaign_id: id,
          provider_id: matchedProvider?.id || null,
          business_name: businessName.trim(),
          phone: phone.trim(),
          whatsapp_number: whatsappNumber
            ? whatsappNumber.trim()
            : phone.trim(),
          invited_by: user.id,
          status: 'invited',
          invite_token: inviteToken,
        })
        .select()
        .single();

      if (invErr) {
        console.error(
          '[API/polls/[id]/invite-vendor] Custom vendor insert error:',
          invErr
        );
        return NextResponse.json(
          { error: 'Failed to create vendor invitation' },
          { status: 500 }
        );
      }

      // If matched existing provider, also populate campaign_provider_invites and notify
      if (matchedProvider) {
        await serviceSupabase.from('campaign_provider_invites').upsert(
          {
            campaign_id: id,
            provider_id: matchedProvider.id,
            status: 'invited',
          },
          { onConflict: 'campaign_id,provider_id' }
        );

        if (matchedProvider.user_id) {
          await serviceSupabase.from('notifications').insert({
            user_id: matchedProvider.user_id,
            title: 'New Service Campaign Invitation! 🎯',
            message: `You've been invited to submit a quote for "${poll.title}" at ${poll.society?.name || 'Society'}.`,
            link: `/partner`,
            type: 'bid',
          });
        }
      }

      // Update campaign status
      if (
        poll.status === 'poll_active' ||
        poll.status === 'approved' ||
        poll.status === 'open'
      ) {
        await serviceSupabase
          .from('service_campaigns')
          .update({
            status: 'quotes_invited',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }

      const origin = request.nextUrl.origin;
      const quoteUrl = `${origin}/vendor-quote/${inviteToken}`;
      const whatsappText = `Hello ${businessName},\n\nYou have been invited to submit a bulk service offer on Ownera for *${poll.title}* at *${poll.society?.name || 'Society'}* (Event Date: ${poll.event_date}).\n\nSubmit your price and crew capacity here:\n${quoteUrl}`;

      return NextResponse.json({
        success: true,
        message: `Invitation generated for ${businessName}!`,
        invite,
        inviteUrl: quoteUrl,
        whatsappShareUrl: `https://api.whatsapp.com/send?phone=${encodeURIComponent(whatsappNumber || phone)}&text=${encodeURIComponent(whatsappText)}`,
      });
    }
  } catch (err: any) {
    console.error('[API/polls/[id]/invite-vendor] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
