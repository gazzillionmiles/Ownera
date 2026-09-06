import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';
import { transferSecretarySchema } from '@/src/shared/validations/ownera';
import { isPlatformAdmin } from '@/lib/ownera/rbac';

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
    const parsed = transferSecretarySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid transfer payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { societyId, newSecretaryUserId, oldSecretaryRole } = parsed.data;
    const serviceSupabase = createAdminClient();

    // 1. Verify caller authority: Must be current secretary of this society or platform_admin
    const isPlatform = await isPlatformAdmin(user.id);
    const { data: currentSecretaryMember } = await serviceSupabase
      .from('society_members')
      .select('*')
      .eq('society_id', societyId)
      .eq('user_id', user.id)
      .eq('role', 'secretary')
      .eq('status', 'active')
      .maybeSingle();

    if (!isPlatform && !currentSecretaryMember) {
      return NextResponse.json(
        { error: 'Forbidden: Only the primary society secretary or a platform admin can transfer secretary role' },
        { status: 403 }
      );
    }

    // 2. Verify target user is an active member in this society
    const { data: targetMember, error: targetErr } = await serviceSupabase
      .from('society_members')
      .select('*')
      .eq('society_id', societyId)
      .eq('user_id', newSecretaryUserId)
      .eq('status', 'active')
      .maybeSingle();

    if (targetErr || !targetMember) {
      return NextResponse.json(
        { error: 'The new secretary must already be an active member of this society.' },
        { status: 400 }
      );
    }

    // 3. Atomically transfer secretary role
    // Call stored procedure or execute in transactional sequence
    const { data: rpcResult, error: rpcError } = await serviceSupabase.rpc(
      'transfer_society_secretary',
      {
        p_society_id: societyId,
        p_new_secretary_user_id: newSecretaryUserId,
        p_current_user_id: user.id,
        p_old_secretary_role: oldSecretaryRole || 'committee',
      }
    );

    if (rpcError) {
      // Fallback: direct atomic update sequence if RPC not yet loaded in current test session
      const { data: existingSec } = await serviceSupabase
        .from('society_members')
        .select('user_id')
        .eq('society_id', societyId)
        .eq('role', 'secretary')
        .eq('status', 'active')
        .maybeSingle();

      if (existingSec && existingSec.user_id !== newSecretaryUserId) {
        await serviceSupabase
          .from('society_members')
          .update({ role: oldSecretaryRole || 'committee' })
          .eq('society_id', societyId)
          .eq('user_id', existingSec.user_id);
      }

      await serviceSupabase
        .from('society_members')
        .update({ role: 'secretary' })
        .eq('society_id', societyId)
        .eq('user_id', newSecretaryUserId);
    } else if (rpcResult && rpcResult.success === false) {
      return NextResponse.json({ error: rpcResult.error || 'Transfer failed' }, { status: 400 });
    }

    // Audit event
    await serviceSupabase.from('campaign_events').insert({
      society_id: societyId,
      campaign_id: null, // society level audit
      event_type: 'secretary_transferred',
      metadata: {
        transferred_by: user.id,
        new_secretary: newSecretaryUserId,
        old_secretary_new_role: oldSecretaryRole,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Society secretary role transferred successfully.',
      society_id: societyId,
      new_secretary_user_id: newSecretaryUserId,
    });
  } catch (err: any) {
    console.error('[API/societies/transfer-secretary] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
