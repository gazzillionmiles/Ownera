import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const mode = process.env.MAINTENANCE_MODE;
  console.log('MAINTENANCE_MODE', mode);
  if (mode !== 'false' && mode !== '0' && mode !== 'off') {
    return new NextResponse(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maintenance • Ownera</title><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#121316;color:#FAF8F5;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#18191D;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:48px 40px;max-width:420px;text-align:center;box-shadow:0 20px 25px -5px rgb(0 0 0 / .1)}.logo{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#2CB7A5,#34d399);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;color:#09090b;font-weight:700;font-size:28px}.title{font-size:28px;font-weight:700;margin:0 0 12px}.msg{color:#a1a1aa;font-size:15px;line-height:1.5}</style></head><body><div class="card"><div class="logo">O</div><h1 class="title">Under maintenance</h1><p class="msg">Ownera is temporarily unavailable.<br>We'll be back shortly.<br><span style="font-size:11px;opacity:.6">MAINTENANCE_MODE=${mode ?? 'on (default)'}</span></p></div></body></html>`,
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
