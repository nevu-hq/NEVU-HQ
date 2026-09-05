'use client';
import { useEffect, useState } from 'react';
import { Save, Plug, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import { AGENTS, PROVIDERS } from '@/lib/types';

export default function Settings() {
  const [a, setA] = useState<any>();
  const [h, setH] = useState<any>();
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [connections, setConnections] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  async function load() {
    const sb = createClient();
    const u = await sb.auth.getUser();
    if (!u.data.user) { location.href = '/login'; return; }
    setA((await sb.from('nevu_administrators').select('*').eq('id', u.data.user.id).maybeSingle()).data);
    const hh = (await sb.from('holdings').select('*').eq('administrator_id', u.data.user.id).maybeSingle()).data;
    setH(hh);
    if (!hh) return;
    const r = (await sb.from('nevu_agent_assignments').select('*').eq('holding_id', hh.id)).data || [];
    setAssign(Object.fromEntries(r.map((x: any) => [x.agent_key, x.provider])));
    const connRes = await sb.from('nevu_ai_connections').select('*').eq('holding_id', hh.id);
    if (!connRes.error) setConnections(Object.fromEntries((connRes.data || []).map((c: any) => [c.provider, c])));
  }

  useEffect(() => { void load(); }, []);

  async function handleConnect(providerKey: string) {
    if (!h) return;
    setMsg('');
    // This is deliberately not a fake OAuth connection. A connection is only marked active after a real bridge/provider test succeeds.
    setTesting(providerKey);
    try {
      if (providerKey === 'local_bridge') {
        const url = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/bridge-status` : '/api/ai/bridge-status';
        const r = await fetch(url, { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || !d.connected) throw new Error(d.error || 'NEVU Bridge is not online.');
      } else {
        throw new Error('No direct provider credential is configured. Use the NEVU browser bridge or add a server-side provider credential.');
      }
      const sb = createClient();
      const { error } = await sb.from('nevu_ai_connections').upsert({ holding_id: h.id, provider: providerKey, connection_type: providerKey === 'local_bridge' ? 'bridge' : 'server', status: 'connected', account_label: providerKey === 'local_bridge' ? 'NEVU Bridge' : providerKey, available_models: [] }, { onConflict: 'holding_id,provider' });
      if (error) throw new Error(error.message);
      await load();
      setMsg(`${providerKey} connection verified.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Connection test failed.');
    } finally { setTesting(null); }
  }

  async function handleDisconnect(providerKey: string) {
    if (!h) return;
    const sb = createClient();
    await sb.from('nevu_ai_connections').delete().eq('holding_id', h.id).eq('provider', providerKey);
    setConnections(prev => { const copy = { ...prev }; delete copy[providerKey]; return copy; });
    setMsg(`Disconnected ${providerKey}.`);
  }

  async function save() {
    if (!h) return;
    setSaving(true); setMsg('');
    const sb = createClient();
    try {
      for (const ag of AGENTS) {
        const provider = assign[ag.key] || 'local_bridge';
        const { error } = await sb.from('nevu_agent_assignments').upsert({ holding_id: h.id, agent_key: ag.key, provider, enabled: true }, { onConflict: 'holding_id,agent_key' });
        if (error) throw new Error(`Error saving ${ag.name}: ${error.message}`);
      }
      setMsg('AI role routing saved.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to save settings.'); }
    finally { setSaving(false); }
  }

  return <AppShell username={a?.username} holdingName={h?.holding_name}>
    <div className="space-y-6">
      <div><div className="text-xs uppercase tracking-[.25em] muted">Administrator Controls</div><h1 className="text-3xl font-semibold">Settings</h1><p className="muted text-sm mt-1">Configure real provider connections and agent routing.</p></div>
      <section className="card p-5"><h2 className="font-semibold">AI Connections</h2><p className="text-xs muted mt-1">NEVU never marks a provider connected using a fake account label. A connection must be verified.</p>
        <div className="border rounded-lg overflow-hidden divide-y mt-4">
          {PROVIDERS.map(p => { const conn = connections[p.key]; const connected = conn?.status === 'connected'; return <div key={p.key} className="p-4 flex items-center justify-between gap-4">
            <div><div className="font-medium text-sm">{p.name}</div><div className="text-xs muted mt-1">{connected ? <span className="flex items-center text-green-600 gap-1"><CheckCircle2 size={13}/> Connected{conn.account_label ? ` · ${conn.account_label}` : ''}</span> : <span className="flex items-center gap-1"><XCircle size={13}/> Not connected</span>}</div></div>
            {connected ? <button type="button" className="btn text-xs" onClick={() => handleDisconnect(p.key)}>Disconnect</button> : <button type="button" className="btn primary text-xs flex items-center gap-1" onClick={() => handleConnect(p.key)} disabled={testing === p.key}><Plug size={13}/>{testing === p.key ? 'Testing…' : 'Verify connection'}</button>}
          </div> })}
        </div>
      </section>
      <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">AI role routing</h2><p className="text-xs muted mt-1">Choose which provider each NEVU role should use.</p></div><button type="button" className="btn primary" onClick={save} disabled={saving}><Save size={15} className="inline mr-1"/>{saving ? 'Saving…' : 'Save All Settings'}</button></div>
        <div className="mt-5 space-y-2">{AGENTS.map(ag => <div key={ag.key} className="card p-3 flex items-center justify-between gap-3"><div><div className="text-sm font-medium">{ag.name}</div><div className="text-[11px] muted">{ag.short}</div></div><select className="input max-w-xs text-xs" value={assign[ag.key] || 'local_bridge'} onChange={e => setAssign(x => ({ ...x, [ag.key]: e.target.value }))}>{PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select></div>)}</div>
        {msg && <div className="mt-3 text-sm font-medium">{msg}</div>}
      </section>
      <div className="card p-4 text-sm"><b>Provider accounts:</b> consumer ChatGPT/Claude/Gemini/Grok accounts are not connected merely by a button click. The NEVU browser bridge must be running and logged into the chosen provider, or a server-side API credential must be configured.</div>
    </div>
  </AppShell>;
}
