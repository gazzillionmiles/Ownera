import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { createAdminClient } from '@/lib/supabase/service';
import { updateServiceIssueSchema } from '@/src/shared/validations/ownera';
import {
  requireSocietyPermission,
  isPlatformAdmin,
  AuthorizationError,
} from '@/lib/ownera/auth';

export async function PATCH(
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
    const parsed = updateServiceIssueSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const serviceSupabase = createAdminClient();

    const { data: issue, error: issueErr } = await serviceSupabase
      .from('service_issues')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (issueErr || !issue) {
      return NextResponse.json({ error: 'Issue report not found' }, { status: 404 });
    }

    // Authorization: platform admin, the society's secretary/committee, or
    // the vendor the issue was raised against.
    const isPlatform = await isPlatformAdmin(user.id, serviceSupabase);
    let isSocietyManager = false;
    if (!isPlatform) {
      try {
        await requireSocietyPermission(
          serviceSupabase,
          user.id,
          issue.society_id,
          'society.issues.manage'
        );
        isSocietyManager = true;
      } catch {
        isSocietyManager = false;
      }
    }

    let isAssignedProvider = false;
    if (!isPlatform && !isSocietyManager && issue.provider_id) {
      const { data: ownProvider } = await serviceSupabase
        .from('providers')
        .select('id')
        .eq('id', issue.provider_id)
        .eq('user_id', user.id)
        .maybeSingle();
      isAssignedProvider = Boolean(ownProvider);
    }

    if (!isPlatform && !isSocietyManager && !isAssignedProvider) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the society secretary/committee, the vendor involved, or a platform admin can update this issue',
        },
        { status: 403 }
      );
    }

    const { status, resolutionNotes } = parsed.data;

    const { data: updatedIssue, error: updateErr } = await serviceSupabase
      .from('service_issues')
      .update({
        status,
        resolution_notes:
          resolutionNotes !== undefined ? resolutionNotes : issue.resolution_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('[API/service-issues/[id] PATCH] Update error:', updateErr);
      return NextResponse.json(
        { error: 'Failed to update issue report' },
        { status: 500 }
      );
    }

    // Notify the resident who filed the report when its status changes.
    if (status !== issue.status) {
      await serviceSupabase.from('notifications').insert({
        user_id: issue.user_id,
        title: 'Update on Your Reported Issue',
        message: `Your reported issue is now "${status.replace('_', ' ')}".${
          resolutionNotes ? ` Note: ${resolutionNotes.substring(0, 120)}` : ''
        }`,
        link: `/home`,
        type: 'general',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Issue report updated.',
      issue: updatedIssue,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API/service-issues/[id] PATCH] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
