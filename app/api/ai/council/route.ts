import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AGENTS, AgentKey, ProviderKey } from '@/lib/types';

const boundaries: Record<AgentKey, string> = {
  educator: 'Only provide rigorous educational notes. Label data Real-time, Delayed, or Educational. Do not issue the final portfolio verdict.',
  analyst: 'Only perform fundamental and quantitative company analysis. Do not act as the Risk Officer or Compliance agent.',
  market_context: 'Only report market conditions, sentiment, macroeconomic factors and clearly labelled predictions. Nigeria and Africa are primary.',
  risk_officer: 'Only assess short-term, long-term and combined risk and downside scenarios. Do not issue the final verdict.',
  portfolio_architect: 'Own portfolio construction, proposals, monitoring and updates. Never execute a change without the exact Administrator approval phrase.',
  compliance_decision: 'Compile the distinct specialist views, compare current analysis with archive context, calculate confidence, apply the 70% rule and issue Buy/Hold/Reduce/Avoid. Veto rule violations. Your important response must use these 11 headings in order: Agent Perspectives; Recommended Path; Reasons; Alternatives; Risk Level; Combined Verdict; Confidence Score; Short Educational Note; Data Freshness Label; Uncertainty Statement; Archive Comparison. End with machine-readable lines VERDICT: <Buy|Hold|Reduce|Avoid> and CONFIDENCE: <0-100>.',
  personal_assistant: 'Private to the Administrator. Review available discussion context and offer additional considerations/second opinions without replacing individual agent voices.',
  minute_keeper: 'Record exact minutes and confirm when archiving work is complete. Do not invent statements.',
  archive: 'Retrieve/refer to relevant historical records and, after approval, prepare the official Decision Record. Do not invent historical data.'
};

function systemPrompt(key: AgentKey) {
  return `You are ${AGENTS.find(a => a.key === key)?.name} inside NEVU HQ. You are not a general AI. Stay strictly within your role. ${boundaries[key]} Core constitutional rules: factual accuracy; Nigeria → Africa primary focus; capital protection first; transparency; no invented data; uncertainty must be explicit. Every important output must label data freshness. Your response must be clearly attributable to your role.`;
}

async function direct(provider: ProviderKey, prompt: string) {
  const key = provider === 'openai' ? process.env.OPENAI_API_KEY : provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : provider === 'google_gemini' ? process.env.GEMINI_API_KEY : provider === 'xai_grok' ? process.env.XAI_API_KEY : provider === 'huggingface_llama' ? process.env.HF_TOKEN : undefined;
  if (!key) return null;
  if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: .2 }), cache: 'no-store' });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';
  }
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest', max_tokens: 1800, messages: [{ role: 'user', content: prompt }] }), cache: 'no-store' });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const d = await r.json();
    return d.content?.map((x: any) => x.text || '').join('') || '';
  }
  if (provider === 'google_gemini') {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: .2 } }), cache: 'no-store' });
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.map((x: any) => x.text || '').join('') || '';
  }
  if (provider === 'xai_grok') {
    const r = await fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.XAI_MODEL || 'grok-3-mini', messages: [{ role: 'user', content: prompt }], temperature: .2 }), cache: 'no-store' });
    if (!r.ok) throw new Error(`xAI ${r.status}`);
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';
  }
  if (provider === 'huggingface_llama') {
    const model = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';
    const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 1200, return_full_text: false } }), cache: 'no-store' });
    if (!r.ok) throw new Error(`Hugging Face ${r.status}`);
    const d = await r.json();
    return Array.isArray(d) ? (d[0]?.generated_text || '') : d.generated_text || '';
  }
  return null;
}

async function bridge(provider: string, prompt: string) {
  const url = process.env.NEVU_BRIDGE_URL;
  if (!url || !process.env.NEVU_BRIDGE_SECRET) return null;
  const selected = provider === 'local_bridge' ? (process.env.NEVU_BRIDGE_DEFAULT_PROVIDER || 'chatgpt') : provider;
  const r = await fetch(`${url}/run`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-nevu-secret': process.env.NEVU_BRIDGE_SECRET || '' }, body: JSON.stringify({ platform: selected === 'openai' ? 'chatgpt' : selected === 'anthropic' ? 'claude' : selected === 'google_gemini' ? 'gemini' : selected === 'xai_grok' ? 'grok' : 'llama', prompt }), cache: 'no-store' });
  if (!r.ok) throw new Error(`Bridge ${r.status}`);
  const d = await r.json();
  return d.response || '';
}

export async function POST(req: Request) {
  try {
    const { sessionId, prompt } = await req.json();
    const sb = await createClient();
    const adminSb = createAdminClient();
    
    const u = await sb.auth.getUser();
    if (!u.data.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Safe lookup using maybeSingle() to prevent crash on empty tables
    const h = (await sb.from('holdings').select('id').eq('administrator_id', u.data.user.id).maybeSingle()).data;
    if (!h) return NextResponse.json({ error: 'Holding not found' }, { status: 403 });

    const session = (await sb.from('nevu_sessions').select('*').eq('id', sessionId).eq('holding_id', h.id).maybeSingle()).data;
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const assignments = (await sb.from('nevu_agent_assignments').select('*').eq('holding_id', h.id)).data || [];
    const map = Object.fromEntries(assignments.map((x: any) => [x.agent_key, x]));
    const transcript = (await sb.from('nevu_messages').select('sender_type,agent_key,message,created_at').eq('session_id', sessionId).order('created_at')).data || [];
    const context = transcript.map((x: any) => `[${x.sender_type}${x.agent_key ? `:${x.agent_key}` : ''}] ${x.message}`).join('\n');
    
    const outputs: any[] = [];
    for (const agent of AGENTS.filter(a => a.key !== 'personal_assistant')) {
      const provider = (map[agent.key]?.enabled === false ? 'local_bridge' : (map[agent.key]?.provider || 'local_bridge')) as ProviderKey;
      const task = `NEVU SESSION PROMPT:\n${prompt}\n\nSESSION CONTEXT:\n${context}\n\nOTHER COMPLETED SPECIALIST OUTPUTS:\n${outputs.map(o => `[${o.agent}] ${o.response}`).join('\n\n')}\n\nROLE DIRECTIVE:\n${systemPrompt(agent.key)}\n\nReturn only your distinct specialist contribution.`;
      
      let response = '';
      try {
        response = await direct(provider, task) || await bridge(provider, task) || `[${agent.name}] Provider not connected. No invented analysis was produced.`;
      } catch (e) {
        response = `[${agent.name}] Provider error: ${e instanceof Error ? e.message : 'unknown error'}`;
      }
      
      outputs.push({ agent: agent.name, key: agent.key, provider, response });
      await adminSb.from('nevu_messages').insert({ holding_id: h.id, session_id: sessionId, sender_type: 'agent', agent_key: agent.key, message_type: 'text', message: response });
    }

    const compliance = outputs.find(o => o.key === 'compliance_decision');
    if (compliance) {
      const verdict = (compliance.response.match(/VERDICT:\s*(Buy|Hold|Reduce|Avoid)/i)?.[1] || 'Hold') as any;
      const confidence = Number(compliance.response.match(/CONFIDENCE:\s*(\d+(?:\.\d+)?)/i)?.[1] || 0);
      await adminSb.from('nevu_decisions').insert({ holding_id: h.id, session_id: sessionId, title: prompt.slice(0, 120), recommended_path: compliance.response, verdict, confidence, status: 'pending_approval', freshness: 'See agent labels', uncertainty: 'See Compliance & Decision output', archive_comparison: 'See Archive output' });
    }

    const assistant = outputs.find(o => o.key === 'personal_assistant');
    return NextResponse.json({ outputs, compliance: compliance?.response || null, assistant: assistant?.response || null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AI orchestration failed' }, { status: 500 });
  }
}