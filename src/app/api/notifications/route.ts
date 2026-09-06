import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createAdminClient();

    const { data: notifications, error } = await serviceSupabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[API/notifications] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    return NextResponse.json({ notifications: notifications || [] });
  } catch (err: any) {
    console.error('[API/notifications] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const serviceSupabase = createAdminClient();

    if (json.all) {
      await serviceSupabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id);
    } else if (json.id) {
      await serviceSupabase
        .from('notifications')
        .update({ read: true })
        .eq('id', json.id)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/notifications] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
