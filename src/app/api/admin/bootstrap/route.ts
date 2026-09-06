import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bootstrapPlatformAdmin, isPlatformAdmin, getPlatformAdminRecord } from '@/lib/ownera/rbac';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in first.' },
        { status: 401 }
      );
    }

    const userEmail = user.email || user.user_metadata?.email || '';
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User account has no associated email address' },
        { status: 400 }
      );
    }

    const result = await bootstrapPlatformAdmin(user.id, userEmail);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      admin: result.admin,
    });
  } catch (err: any) {
    console.error('[API/admin/bootstrap] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error during admin bootstrap' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const admin = await getPlatformAdminRecord(user.id);
    const isPlatform = await isPlatformAdmin(user.id);

    return NextResponse.json({
      is_admin: !!admin,
      is_platform_admin: isPlatform,
      role: admin?.role || 'user',
      status: admin?.status || 'none',
    });
  } catch (err: any) {
    console.error('[API/admin/bootstrap GET] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
