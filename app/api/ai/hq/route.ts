import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function call(prompt: string) {
  const bridge = process.env.NEVU_BRIDGE_URL;
  if (bridge) {
    try {
      const r = await fetch(`${bridge}/run`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-nevu-secret': process.env.NEVU_BRIDGE_SECRET || '' }, body: JSON.stringify({ platform: 'auto', agentKey: 'nevu_ai', prompt: `You are NEVU HQ's own Boardroom AI. Respond to the Administrators in the Boardroom. Do not reveal private Holding data. Answer questions using only the information in the conversation and clearly state uncertainty.\n\n${prompt}` }), cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        return d.response || '';
      }
    } catch {}
  }
  if (process.env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: 'You are NEVU HQ Boardroom AI. Do not expose private Holding data.' }, { role: 'user', content: prompt }], temperature: .2 }), cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      return d.choices?.[0]?.message?.content || '';
    }
  }
  return 'NEVU HQ AI is not connected to a provider on this deployment yet. The Boardroom remains available; connect a supported provider or local bridge to receive an AI response.';
}

export async function POST(req: Request) {
  try {
    const { hqSessionId, question } = await req.json();
    const sb = await createClient();
    const u = await sb.auth.getUser();
    if (!u.data.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Safe lookup using maybeSingle()
    const h = (await sb.from('holdings').select('id').eq('administrator_id', u.data.user.id).maybeSingle()).data;
    if (!h) return NextResponse.json({ error: 'Holding not found' }, { status: 403 });

    const transcript = (await sb.from('nevu_hq_messages').select('sender_type,sender_holding_id,message').eq('hq_session_id', hqSessionId).order('created_at').limit(80)).data || [];
    const context = transcript.map((m: any) => `[${m.sender_type}] ${m.message}`).join('\n');
    const response = await call(`BOARDROOM CONTEXT:\n${context}\n\nQUESTION:\n${question}`);
    
    await createAdminClient().from('nevu_hq_messages').insert({ hq_session_id: hqSessionId, sender_type: 'nevu_ai', agent_key: 'nevu_ai', message_type: 'text', message: response });
    return NextResponse.json({ response });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Boardroom AI failed' }, { status: 500 });
  }
}