'use client';

import { useEffect, useState } from 'react';
import { Sparkles, LockKeyhole } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

type Session = {
  id: string;
  title: string | null;
  purpose: string | null;
  started_at: string;
  status: string;
};

type Message = {
  id: string;
  session_id: string;
  sender_type: string;
  agent_key: string | null;
  message: string;
  created_at: string;
};

export default function PersonalAI() {
  const [admin, setAdmin] = useState<any>(null);
  const [holding, setHolding] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] =
    useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [note, setNote] = useState('');
  const [present, setPresent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    const sb = createClient();

    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const adminResult = await sb
      .from('nevu_administrators')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (adminResult.error) {
      setError(adminResult.error.message);
    }

    setAdmin(adminResult.data);

    const holdingResult = await sb
      .from('holdings')
      .select('*')
      .eq('administrator_id', user.id)
      .maybeSingle();

    if (holdingResult.error) {
      setError(holdingResult.error.message);
      setLoading(false);
      return;
    }

    const holding = holdingResult.data;

    setHolding(holding);

    if (!holding) {
      setError(
        'No NEVU Holding is linked to this Administrator.'
      );
      setLoading(false);
      return;
    }

    const presenceResult = await sb
      .from('nevu_presence')
      .select('personal_ai_present')
      .eq('user_id', user.id)
      .maybeSingle();

    if (presenceResult.error) {
      setError(presenceResult.error.message);
    }

    setPresent(
      Boolean(
        presenceResult.data?.personal_ai_present
      )
    );

    const sessionResult = await sb
      .from('nevu_sessions')
      .select(
        'id,title,purpose,started_at,status'
      )
      .eq('holding_id', holding.id)
      .order('started_at', {
        ascending: false,
      })
      .limit(20);

    if (sessionResult.error) {
      setError(sessionResult.error.message);
      setLoading(false);
      return;
    }

    const loadedSessions =
      (sessionResult.data || []) as Session[];

    setSessions(loadedSessions);

    if (loadedSessions.length > 0) {
      setActiveSession(loadedSessions[0]);
    }

    setLoading(false);
  }

  async function loadMessages(
    sessionId: string
  ) {
    const sb = createClient();

    const result = await sb
      .from('nevu_messages')
      .select(
        'id,session_id,sender_type,agent_key,message,created_at'
      )
      .eq('session_id', sessionId)
      .order('created_at', {
        ascending: true,
      });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessages(
      (result.data || []) as Message[]
    );
  }

  async function createSession() {
    if (!holding) return;

    setError('');

    const sb = createClient();

    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const result = await sb
      .from('nevu_sessions')
      .insert({
        holding_id: holding.id,
        title: 'Personal AI Session',
        purpose:
          'Administrator personal AI conversation',
        current_capital: 0,
        created_by: user.id,
        status: 'active',
      })
      .select(
        'id,title,purpose,started_at,status'
      )
      .single();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    const newSession =
      result.data as Session;

    setSessions((current) => [
      newSession,
      ...current,
    ]);

    setActiveSession(newSession);
    setMessages([]);
  }

  async function toggle() {
    if (!holding) return;

    setError('');

    const sb = createClient();

    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const next = !present;

    const result = await sb
      .from('nevu_presence')
      .update({
        personal_ai_present: next,
      })
      .eq('user_id', user.id);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setPresent(next);
  }

  async function ask() {
    const text = note.trim();

    if (
      !holding ||
      !text ||
      sending
    ) {
      return;
    }

    setSending(true);
    setError('');

    try {
      let currentSession =
        activeSession;

      if (!currentSession) {
        const sb = createClient();

        const {
          data: { user },
        } = await sb.auth.getUser();

        if (!user) {
          window.location.href = '/login';
          return;
        }

        const result = await sb
          .from('nevu_sessions')
          .insert({
            holding_id: holding.id,
            title: 'Personal AI Session',
            purpose:
              'Administrator personal AI conversation',
            current_capital: 0,
            created_by: user.id,
            status: 'active',
          })
          .select(
            'id,title,purpose,started_at,status'
          )
          .single();

        if (result.error) {
          throw result.error;
        }

        currentSession =
          result.data as Session;

        setSessions((current) => [
          currentSession as Session,
          ...current,
        ]);

        setActiveSession(
          currentSession
        );
      }

      if (!currentSession) {
        throw new Error(
          'Unable to create a Personal AI session.'
        );
      }

      const response = await fetch(
        '/api/ai/personal',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            'x-holding-id':
              holding.id,
          },
          body: JSON.stringify({
            prompt: text,
            sessionId:
              currentSession.id,
            agentKey:
              'personal_assistant',
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Personal AI request failed.'
        );
      }

      await loadMessages(
        data?.sessionId ||
          currentSession.id
      );

      setNote('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Personal AI unavailable.'
      );
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!activeSession?.id) {
      setMessages([]);
      return;
    }

    void loadMessages(
      activeSession.id
    );
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession?.id) {
      return;
    }

    const sb = createClient();

    const channel = sb
      .channel(
        'personal-ai-' +
          activeSession.id
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nevu_messages',
          filter:
            'session_id=eq.' +
            activeSession.id,
        },
        (payload) => {
          const incoming =
            payload.new as Message;

          setMessages((current) => {
            if (
              current.some(
                (message) =>
                  message.id ===
                  incoming.id
              )
            ) {
              return current;
            }

            return [
              ...current,
              incoming,
            ];
          });
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(
        channel
      );
    };
  }, [activeSession?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center muted">
        Opening Personal AI...
      </div>
    );
  }

  return (
    <AppShell
      username={
        admin?.username ||
        'Administrator'
      }
      holdingName={
        holding?.holding_name ||
        'Your Holding'
      }
    >
      <div className="max-w-5xl space-y-5">

        <div>
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="text-xs uppercase tracking-[.25em] muted">
                Private Advisor
              </div>

              <h1 className="text-3xl font-semibold mt-2">
                Personal AI
              </h1>

              <p className="muted text-sm mt-1">
                Private to{' '}
                {admin?.username ||
                  'the Administrator'}.
              </p>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() => {
                void toggle();
              }}
              disabled={!holding}
            >
              {present
                ? '● AI Active'
                : '○ Activate Personal AI'}
            </button>
          </div>
        </div>

        <div className="card p-4 flex gap-3 text-sm">
          <LockKeyhole size={17} />

          <div>
            The Personal AI reviews the
            Administrator&apos;s
            conversation and NEVU agent
            context. Conversations are
            stored on the NEVU server and
            remain private to this Holding.
          </div>
        </div>

        <div className="grid md:grid-cols-[240px_1fr] gap-5">

          <aside className="glass rounded-2xl p-4 h-fit">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">
                  Sessions
                </h2>

                <p className="text-xs muted">
                  Server memory
                </p>
              </div>

              <button
                type="button"
                className="btn"
                onClick={() => {
                  void createSession();
                }}
                disabled={!holding}
              >
                +
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-sm muted">
                No Personal AI sessions yet.
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((item) => {
                  const selected =
                    activeSession?.id ===
                    item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveSession(
                          item
                        );
                      }}
                      className={
                        selected
                          ? 'w-full text-left rounded-xl p-3 bg-white/10'
                          : 'w-full text-left rounded-xl p-3 bg-white/5'
                      }
                    >
                      <div className="text-sm truncate">
                        {item.title ||
                          'Personal AI Session'}
                      </div>

                      <div className="text-xs muted mt-1">
                        {new Date(
                          item.started_at
                        ).toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="glass rounded-2xl p-5">

            <div className="flex items-center gap-3">
              <Sparkles size={20} />

              <div>
                <h2 className="font-semibold">
                  Private second opinion
                </h2>

                <p className="text-xs muted">
                  Conversation memory is
                  stored on the NEVU server.
                </p>
              </div>
            </div>

            <div className="mt-5 min-h-[300px] max-h-[520px] overflow-y-auto space-y-4">

              {!activeSession && (
                <div className="text-center py-16">
                  <p className="muted text-sm">
                    Create a Personal AI
                    session to begin.
                  </p>

                  <button
                    type="button"
                    className="btn primary mt-4"
                    onClick={() => {
                      void createSession();
                    }}
                    disabled={!holding}
                  >
                    Create Session
                  </button>
                </div>
              )}

              {activeSession &&
                messages.length === 0 && (
                  <div className="text-center py-16">
                    <p className="muted text-sm">
                      This Personal AI
                      session is ready.
                    </p>
                  </div>
                )}

              {messages.map((message) => {
                const administrator =
                  message.sender_type ===
                    'administrator' ||
                  message.sender_type ===
                    'user';

                return (
                  <div
                    key={message.id}
                    className={
                      administrator
                        ? 'flex justify-end'
                        : 'flex justify-start'
                    }
                  >
                    <div
                      className={
                        administrator
                          ? 'max-w-[85%] rounded-2xl px-4 py-3 bg-white text-black'
                          : 'max-w-[85%] rounded-2xl px-4 py-3 bg-white/10'
                      }
                    >
                      <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1">
                        {administrator
                          ? 'Administrator'
                          : 'Personal AI'}
                      </div>

                      <div className="whitespace-pre-wrap text-sm leading-6">
                        {message.message}
                      </div>

                      <div className="text-[10px] opacity-40 mt-2">
                        {new Date(
                          message.created_at
                        ).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-5">
              <textarea
                className="input min-h-32 w-full"
                placeholder="Ask your Personal AI to consider the discussion..."
                value={note}
                onChange={(event) => {
                  setNote(
                    event.target.value
                  );
                }}
                disabled={
                  !activeSession ||
                  sending
                }
              />

              <button
                type="button"
                className="btn primary mt-3"
                onClick={() => {
                  void ask();
                }}
                disabled={
                  !activeSession ||
                  !note.trim() ||
                  sending
                }
              >
                {sending
                  ? 'Thinking...'
                  : 'Consider this'}
              </button>
            </div>

          </section>
        </div>
      </div>
    </AppShell>
  );
}
