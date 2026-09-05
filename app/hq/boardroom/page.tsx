'use client';

import { useEffect, useState } from 'react';
import { Users, Shield, Bot, BarChart3 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import { Composer } from '@/components/chat/Composer';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { PollList } from '@/components/chat/PollList';

export default function HQBoardroom() {
  const [me, setMe] = useState<any>(null);
  const [holding, setHolding] = useState<any>(null);
  const [directory, setDirectory] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [summoned, setSummoned] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        const u = await sb.auth.getUser();
        if (!u.data.user) {
          location.href = '/login';
          return;
        }

        const a = await sb.from('nevu_administrators').select('*').eq('id', u.data.user.id).maybeSingle();
        const h = await sb.from('holdings').select('id,holding_name').eq('administrator_id', u.data.user.id).maybeSingle();
        
        setMe(a.data || { username: 'Administrator' });
        setHolding(h.data || { holding_name: 'Primary Holding' });

        const d = await sb.rpc('nevu_hq_directory');
        setDirectory(d.data || []);

        let ss = (await sb.from('nevu_hq_sessions').select('*').eq('status', 'active').order('started_at', { ascending: false }).limit(1)).data;
        let s = ss?.[0];

        if (!s) {
          const created = await sb.from('nevu_hq_sessions').insert({
            title: 'NEVU HQ Boardroom Session',
            created_by: u.data.user.id,
            status: 'active',
            started_at: new Date().toISOString()
          }).select().maybeSingle();
          s = created.data;
        } else if (!s.started_at) {
          s.started_at = new Date().toISOString();
        }
        
        setSession(s);

        if (s) {
          const mm = await sb.from('nevu_hq_messages').select('*').eq('hq_session_id', s.id).order('created_at');
          setMessages(mm.data || []);
        }
      } catch (err) {
        console.error('Boardroom load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!session) return;
    const sb = createClient();
    const ch = sb.channel('hq-' + session.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nevu_hq_messages', filter: `hq_session_id=eq.${session.id}` }, p => setMessages(m => [...m, p.new]))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [session]);

  async function summon() {
    if (!session || !holding || !me || !aiQuestion.trim()) return;
    setAiBusy(true);
    try {
      const r = await fetch('/api/ai/hq', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hqSessionId: session.id, question: aiQuestion })
      });
      const d = await r.json();
      if (d.error) alert(d.error);
      setAiQuestion('');
      setSummoned(true);
    } catch (err) {
      console.error('Summon error:', err);
    } finally {
      setAiBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm muted">Opening Boardroom session...</p>
      </div>
    );
  }

  return (
    <AppShell username={me?.username || 'Administrator'} holdingName={holding?.holding_name || 'Holding'}>
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[.25em] muted">NEVU HQ BASE</div>
            <h1 className="text-3xl font-semibold">Boardroom</h1>
            <p className="muted text-sm mt-1">Administrators speak here Holding-to-Holding. Private Holding data stays private.</p>
          </div>
          <span className="badge green">● HQ LIVE</span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
          <section className="glass rounded-2xl min-h-[640px] flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="font-semibold">NEVU HQ Boardroom</div>
                <div className="text-xs muted">
                  Session · {session?.started_at ? new Date(session.started_at).toLocaleString() : 'Active'}
                </div>
              </div>
              <div className="flex gap-2">
                <input 
                  className="input max-w-xs" 
                  placeholder="Ask NEVU AI…" 
                  value={aiQuestion} 
                  onChange={e => setAiQuestion(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={summon} 
                  className={`btn cursor-pointer ${summoned ? 'primary' : ''}`} 
                  disabled={aiBusy}
                >
                  <Bot size={16} className="inline mr-2" />
                  {aiBusy ? 'Thinking…' : 'Call NEVU AI'}
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-auto max-h-[510px] scrollbar">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_user_id === me?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 ${m.sender_user_id === me?.id ? 'bg-white text-black' : 'card'}`}>
                    <div className="text-[10px] muted mb-1">
                      {m.sender_type === 'nevu_ai' ? 'NEVU AI' : m.sender_user_id === me?.id ? 'You' : directory.find(d => d.holding_id === m.sender_holding_id)?.holding_name || 'Administrator'}
                    </div>
                    {m.message_type === 'voice' && m.storage_path ? <VoiceMessage path={m.storage_path} /> : <div className="text-sm whitespace-pre-wrap">{m.message}</div>}
                  </div>
                </div>
              ))}
              {messages.length === 0 && <div className="h-full flex items-center justify-center muted">The Boardroom is ready.</div>}
            </div>

            <div className="p-3 space-y-2">
              <PollList holdingId={holding?.id} hqSessionId={session?.id} />
              <Composer holdingId={holding?.id} hqSessionId={session?.id} />
            </div>
          </section>

          <aside className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2"><Users size={17} /><b>Holdings in HQ</b></div>
              <div className="mt-4 space-y-2">
                {directory.map(d => (
                  <div key={d.holding_id} className="rounded-xl border border-white/10 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm">{d.holding_name}</div>
                      <div className="text-xs muted">CEO · {d.username}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] ${d.presence_status === 'active' ? 'green' : 'muted'}`}>● {d.presence_status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <Shield size={17} />
              <div className="font-medium mt-2">Privacy boundary</div>
              <p className="text-xs muted mt-1">HQ identity and conversation are visible here. Private Discussion Room, Personal AI, Portfolio and Archive data remain inside each Holding.</p>
            </div>

            <div className="card p-4">
              <BarChart3 size={17} />
              <div className="font-medium mt-2">Boardroom polls</div>
              <p className="text-xs muted mt-1">Create governance polls when a collective Holding decision is needed.</p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}