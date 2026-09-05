import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const sb = await createClient();
  const user = (await sb.auth.getUser()).data.user;
  if (!user) return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 });
  const url = process.env.NEVU_BRIDGE_URL;
  const secret = process.env.NEVU_BRIDGE_SECRET;
  if (!url || !secret) return NextResponse.json({ connected: false, error: 'NEVU_BRIDGE_URL or NEVU_BRIDGE_SECRET is not configured.' }, { status: 503 });
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/health`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) return NextResponse.json({ connected: false, error: 'Bridge health check failed.' }, { status: 503 });
    return NextResponse.json({ connected: true, service: data.service || 'nevu-ai-bridge' });
  } catch {
    return NextResponse.json({ connected: false, error: 'NEVU Bridge is offline or unreachable.' }, { status: 503 });
  }
}
