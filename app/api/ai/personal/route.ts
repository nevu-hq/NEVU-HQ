import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AgentKey, ProviderKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

function providerKeyForEnvironment(provider: ProviderKey) {
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (provider === 'google_gemini') return process.env.GEMINI_API_KEY;
  if (provider === 'xai_grok') return process.env.XAI_API_KEY;
  if (provider === 'huggingface_llama') return process.env.HF_TOKEN;
  return undefined;
}

async function direct(provider: ProviderKey, prompt: string) {
  const key = providerKeyForEnvironment(provider);
  if (!key) return null;

  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }), cache: 'no-store' });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const d = await r.json();
    return d.choices?.[0]?.message?.content || null;
  }
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest', max_tokens: 1800, messages: [{ role: 'user', content: prompt }] }), cache: 'no-store' });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const d = await r.json();
    return d.content?.map((x: any) => x.text || '').join('') || null;
  }
  if (provider === 'google_gemini') {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }), cache: 'no-store' });
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.map((x: any) => x.text || '').join('') || null;
  }
  if (provider === 'xai_grok') {
    const r = await fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.XAI_MODEL || 'grok-3-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }), cache: 'no-store' });
    if (!r.ok) throw new Error(`xAI ${r.status}`);
    const d = await r.json();
    return d.choices?.[0]?.message?.content || null;
  }
  if (provider === 'huggingface_llama') {
    const model = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';
    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 1200, return_full_text: false } }), cache: 'no-store' });
    if (!r.ok) throw new Error(`Hugging Face ${r.status}`);
    const d = await r.json();
    return Array.isArray(d) ? d[0]?.generated_text || null : d.generated_text || null;
  }
  return null;
}

async function bridge(provider: ProviderKey, prompt: string) {
  const url = process.env.NEVU_BRIDGE_URL;
  const secret = process.env.NEVU_BRIDGE_SECRET;
  if (!url || !secret) return null;
  const selected = provider === 'local_bridge' ? 'chatgpt' : provider;
  const platform = selected === 'openai' ? 'chatgpt' : selected === 'anthropic' ? 'claude' : selected === 'google_gemini' ? 'gemini' : selected === 'xai_grok' ? 'grok' : 'llama';
  const r = await fetch(`${url.replace(/\/$/, '')}/run`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-nevu-secret': secret }, body: JSON.stringify({ platform, prompt }), cache: 'no-store' });
  if (!r.ok) throw new Error(`NEVU Bridge ${r.status}`);
  const d = await r.json();
  return d.response || null;
}

export async function POST(req: Request) {
  try {
    const { prompt, sessionId, agentKey = 'personal_assistant' } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: 'Question required' }, { status: 400 });

    const sb = await createClient();
    const adminSb = createAdminClient();
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const holdingId = req.headers.get('x-holding-id');
    const holding = holdingId
      ? (await sb.from('holdings').select('id').eq('id', holdingId).eq('administrator_id', user.id).maybeSingle()).data
      : (await sb.from('holdings').select('id').eq('administrator_id', user.id).maybeSingle()).data;
    if (!holding) return NextResponse.json({ error: 'Holding not found' }, { status: 403 });

    let activeSessionId = sessionId as string | null;
    if (activeSessionId) {
      const check = await sb.from('nevu_sessions').select('id').eq('id', activeSessionId).eq('holding_id', holding.id).maybeSingle();
      if (!check.data) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    } else {
      const existing = await sb.from('nevu_sessions').select('id').eq('holding_id', holding.id).eq('status', 'active').order('started_at', { ascending: false }).limit(1).maybeSingle();
      activeSessionId = existing.data?.id || null;
    }

    if (!activeSessionId) {
      const created = await sb.from('nevu_sessions').insert({ holding_id: holding.id, title: 'Personal AI Session', purpose: 'Administrator personal AI conversation', current_capital: 0, created_by: user.id, status: 'active' }).select('id').single();
      if (created.error || !created.data) return NextResponse.json({ error: created.error?.message || 'Could not create session' }, { status: 500 });
      activeSessionId = created.data.id;
    }

    const userInsert = await adminSb.from('nevu_messages').insert({ holding_id: holding.id, session_id: activeSessionId, sender_type: 'administrator', sender_user_id: user.id, message_type: 'text', message: prompt.trim() }).select('*').single();
    if (userInsert.error) return NextResponse.json({ error: `Could not save message: ${userInsert.error.message}` }, { status: 500 });

    const history = (await sb.from('nevu_messages').select('sender_type,agent_key,message').eq('session_id', activeSessionId).order('created_at', { ascending: true }).limit(30)).data || [];
    const assignment = await sb.from('nevu_agent_assignments').select('provider,enabled').eq('holding_id', holding.id).eq('agent_key', agentKey).maybeSingle();
    const provider = ((assignment.data?.enabled !== false ? assignment.data?.provider : null) || 'local_bridge') as ProviderKey;
    const context = history.map((m: any) => `${m.sender_type}${m.agent_key ? `:${m.agent_key}` : ''}: ${m.message}`).join('\n');
    const task = `You are the ${agentKey} agent inside NEVU HQ. Answer only within that role. Do not invent facts. State uncertainty when information is unavailable.\n\nConversation:\n${context}\n\nLatest request:\n${prompt.trim()}`;

    let response = '';
    let source = provider;
    try {
      response = (await direct(provider, task)) || (await bridge(provider, task)) || '';
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'AI provider failed', sessionId: activeSessionId }, { status: 502 });
    }
    if (!response) response = `The ${agentKey} provider is not connected. Connect a provider or configure NEVU_BRIDGE_URL before requesting AI analysis.`;

    const assistantInsert = await adminSb.from('nevu_messages').insert({ holding_id: holding.id, session_id: activeSessionId, sender_type: 'agent', agent_key: agentKey as AgentKey, message_type: 'text', message: response }).select('*').single();
    if (assistantInsert.error) return NextResponse.json({ error: `AI responded but the response could not be saved: ${assistantInsert.error.message}`, response, sessionId: activeSessionId }, { status: 500 });

    return NextResponse.json({ response, sessionId: activeSessionId, provider: source, userMessage: userInsert.data, assistantMessage: assistantInsert.data });
  } catch (err) {
    console.error('Personal AI error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}
