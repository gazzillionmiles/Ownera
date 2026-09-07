import { NextRequest, NextResponse } from 'next/server';
import { validateInviteTokenQuerySchema } from '@/src/shared/validations/ownera';
import { validateInviteToken } from '@/lib/ownera/invite-links';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    const parsed = validateInviteTokenQuerySchema.safeParse({ token });
    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: 'Valid invite token parameter is required', reason: 'not_found' },
        { status: 400 }
      );
    }

    const result = await validateInviteToken(parsed.data.token);

    if (!result.valid) {
      const statusCode = result.reason === 'inactive' ? 410 : 404;
      return NextResponse.json(
        { valid: false, reason: result.reason, error: result.error },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      valid: true,
      society: result.society,
    });
  } catch (err: any) {
    console.error('[API/societies/invite-link/validate GET] Error:', err);
    return NextResponse.json(
      { valid: false, error: 'Internal server error validating invite link', reason: 'error' },
      { status: 500 }
    );
  }
}
