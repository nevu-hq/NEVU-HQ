'use client';

import { useEffect, useState } from 'react';
import { Sparkles, LockKeyhole } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

export default function PersonalAI() {
  const [a, setA] = useState<any>();
  const [h, setH] = useState<any>();
  const [sessions, setSessions] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [present, setPresent] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const u = await sb.auth.getUser();
      if (!u.data.user) {
        location.href = '/login';
        return;
      }
      setA((await sb.from('nevu_administrators').select('*').eq('id', u.data.user.id).single()).data);
      const hh = (await sb.from('holdings').select('*').eq('administrator_id', u.data.user.id).single()).data;
      setH(hh);
      if (hh) {
        const pr = (await sb.from('nevu_presence').select('personal_ai_present').eq('user_id', u.data.user.id).single()).data;
        setPresent(!!pr?.personal_ai_present);
        setSessions((await sb.from('nevu_sessions').select('*').eq('holding_id', hh.id).order('started_at', { ascending: false }).limit(8)).data || []);
      }
    })();
  }, []);

  async function toggle() {
    if (!h) return;
    const sb = createClient();
    const uid = (await sb.auth.getUser()).data.user?.id;
    if (!uid) return;
    await sb.from('nevu_presence').update({ personal_ai_present: !present }).eq('user_id', uid);
    setPresent(!present);
  }

  async function ask() {
    if (!h || !note) return;
    const sb = createClient();
    const s = sessions[0];
    
    const mm = s
      ? (await sb.from('nevu_messages').select('sender_type,agent_key,message,created_at').eq('session_id', s.id).order('created_at', { ascending: false }).limit(30)).data || []
      : [];

    const hs = (await sb.from('nevu_hq_sessions').select('id').eq('status', 'active').order('started_at', { ascending: false }).limit(1)).data?.[0];
    
    const hm = hs
      ? (await sb.from('nevu_hq_messages').select('sender_type,sender_holding_id,agent_key,message,created_at').eq('hq_session_id', hs.id).order('created_at', { ascending: false }).limit(30)).data || []
      : [];

    const context = [...mm.reverse(), ...hm.reverse()]
      .map((m: any) => `${m.sender_type === 'agent' ? m.agent_key : m.sender_type}: ${m.message}`)
      .join('\n');

    const res = await fetch('/api/ai/personal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: note, context }),
    });
    
    const data = await res.json();
    setReply(data.reply || data.error || 'Personal AI unavailable.');
  }

  return (
    <AppShell username={a?.username} holdingName={h?.holding_name}>
      <div className="max-w-4xl space-y-5">
        <div>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs uppercase tracking-[.25em] muted">Private Advisor</div>
            </div>
            <button className="btn" onClick={toggle}>
              {present ? '● AI Active' : '○ Activate Personal AI'}
            </button>
          </div>
          <h1 className="text-3xl font-semibold">Personal AI</h1>
          <p className="muted text-sm mt-1">Private to {a?.username || 'the Administrator'}.</p>
        </div>
        
        <div className="card p-4 flex gap-3 text-sm">
          <LockKeyhole size={17} />
          <div>
            The Personal AI reviews what the Administrator and NEVU agents have said in the current Holding context. It does not replace their individual voices; it can point out additional considerations such as “Let's also consider here…”
          </div>
        </div>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Sparkles size={20} />
            <div>
              <h2 className="font-semibold">Private second opinion</h2>
              <p className="text-xs muted">No other Holding can read this conversation.</p>
            </div>
          </div>
          <textarea
            className="input mt-5 min-h-32"
            placeholder="Ask your Personal AI to consider the discussion…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn primary mt-3" onClick={ask}>
            Consider this
          </button>
          {reply && <div className="card p-4 mt-5 text-sm whitespace-pre-wrap">{reply}</div>}
        </section>
      </div>
    </AppShell>
  );
}