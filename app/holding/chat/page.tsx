```tsx
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Bot, Plus, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Composer } from '@/components/chat/Composer';
import { PollList } from '@/components/chat/PollList';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { createClient } from '@/lib/supabase/client';
import { AGENTS } from '@/lib/types';

type Session = {
  id: string;
  title: string;
  purpose?: string | null;
  current_capital?: number | null;
  started_at: string;
  status?: string | null;
};

type Message = {
  id: string;
  session_id?: string;
  sender_type: string;
  sender_user_id?: string | null;
  agent_key?: string | null;
  message_type?: string | null;
  message?: string | null;
  storage_path?: string | null;
  created_at: string;
  deleted_at?: string | null;
};

export default function ChatPage() {
  const sb = useMemo(() => createClient(), []);

  const [admin, setAdmin] = useState<any>(null);
  const [holding, setHolding] = useState<any>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [title, setTitle] = useState('Administrator Chat');
  const [capital, setCapital] = useState('');

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (preferredSessionId?: string) => {
      setError('');

      const {
        data: { user },
        error: authError,
      } = await sb.auth.getUser();

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const adminRes = await sb
        .from('nevu_administrators')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const holdingRes = await sb
        .from('holdings')
        .select('*')
        .eq('administrator_id', user.id)
        .maybeSingle();

      if (adminRes.error) {
        setError(adminRes.error.message);
      }

      if (holdingRes.error) {
        setError(holdingRes.error.message);
      }

      setAdmin(adminRes.data);
      setHolding(holdingRes.data);

      if (!holdingRes.data) {
        setSessions([]);
        setSession(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      const sessionRes = await sb
        .from('nevu_sessions')
        .select('*')
        .eq('holding_id', holdingRes.data.id)
        .order('started_at', { ascending: false });

      if (sessionRes.error) {
        setError(sessionRes.error.message);
        setLoading(false);
        return;
      }

      const list = (sessionRes.data || []) as Session[];

      setSessions(list);

      const selected =
        list.find(
          (item) => item.id === preferredSessionId
        ) ||
        list.find(
          (item) => item.status === 'active'
        ) ||
        list[0] ||
        null;

      setSession(selected);

      if (selected) {
        const messageRes = await sb
          .from('nevu_messages')
          .select('*')
          .eq('session_id', selected.id)
          .order('created_at', { ascending: true });

        if (messageRes.error) {
          setError(messageRes.error.message);
          setMessages([]);
        } else {
          setMessages(
            (messageRes.data || []) as Message[]
          );
        }
      } else {
        setMessages([]);
      }

      setLoading(false);
    },
    [sb]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.id) {
      return;
    }

    const channel = sb
      .channel('nevu-chat-' + session.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nevu_messages',
          filter: 'session_id=eq.' + session.id,
        },
        (payload) => {
          const incoming = payload.new as Message;

          setMessages((current) => {
            const alreadyExists = current.some(
              (message) => message.id === incoming.id
            );

            if (alreadyExists) {
              return current;
            }

            return current.concat(incoming);
          });
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [sb, session?.id]);

  async function createSession() {
    if (!holding || !admin || creating) {
      return;
    }

    setCreating(true);
    setError('');

    const result = await sb
      .from('nevu_sessions')
      .insert({
        holding_id: holding.id,
        title:
          title.trim() || 'Administrator Chat',
        purpose:
          'Administrator-led AI conversation',
        current_capital: Number(capital || 0),
        created_by: admin.id,
        status: 'active',
      })
      .select('*')
      .single();

    if (result.error) {
      setError(result.error.message);
      setCreating(false);
      return;
    }

    setTitle('Administrator Chat');
    setCapital('');
    setCreating(false);

    await load(result.data.id);
  }

  async function selectSession(next: Session) {
    setError('');
    setSession(next);

    const result = await sb
      .from('nevu_messages')
      .select('*')
      .eq('session_id', next.id)
      .order('created_at', { ascending: true });

    if (result.error) {
      setError(result.error.message);
      setMessages([]);
      return;
    }

    setMessages((result.data || []) as Message[]);
  }

  async function refresh() {
    setRefreshing(true);
    await load(session?.id);
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center muted">
        Opening NEVU Chat...
      </div>
    );
  }

  return (
    <AppShell
      username={admin?.username || 'Administrator'}
      holdingName={holding?.holding_name || 'Your Holding'}
    >
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[.25em] muted">
              Holding HQ
            </div>

            <h1 className="text-3xl font-semibold">
              Chat Integration Hub
            </h1>

            <p className="muted text-sm mt-1">
              Server-saved conversations with persistent
              NEVU sessions.
            </p>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => {
              void refresh();
            }}
            disabled={refreshing}
            title="Refresh saved messages"
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? 'animate-spin inline mr-1'
                  : 'inline mr-1'
              }
            />
            Refresh
          </button>
        </div>

        {error && (
          <div className="card p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!session ? (
          <div className="glass rounded-2xl p-6 max-w-2xl">
            <div className="flex items-center gap-2">
              <Bot size={19} />

              <h2 className="text-xl font-semibold">
                Start your first chat session
              </h2>
            </div>

            <p className="muted text-sm mt-2">
              Every message will be stored on the NEVU
              server through Supabase.
            </p>

            <div className="grid md:grid-cols-2 gap-3 mt-5">
              <input
                className="input"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                placeholder="Session title"
              />

              <input
                className="input"
                value={capital}
                onChange={(event) => {
                  setCapital(event.target.value);
                }}
                type="number"
                placeholder="Current capital (optional)"
              />
            </div>

            <button
              type="button"
              className="btn primary mt-4"
              onClick={() => {
                void createSession();
              }}
              disabled={creating}
            >
              <Plus
                size={16}
                className="inline mr-1"
              />

              {creating ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
            <section className="glass rounded-2xl min-h-[650px] flex flex-col">
              <div className="border-b border-white/10 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {session.title}
                  </div>

                  <div className="text-xs muted">
                    Session ID: {session.id.slice(0, 8)}...
                  </div>
                </div>

                <span className="badge green">
                  {session.status || 'active'}
                </span>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-auto max-h-[520px] scrollbar">
                {messages.map((message) => {
                  const isAdmin =
                    message.sender_type ===
                      'administrator' ||
                    message.sender_type === 'user';

                  const agent = AGENTS.find(
                    (item) =>
                      item.key === message.agent_key
                  );

                  let content;

                  if (message.deleted_at) {
                    content = (
                      <div className="text-sm opacity-60">
                        Message deleted
                      </div>
                    );
                  } else if (
                    message.message_type === 'voice' &&
                    message.storage_path
                  ) {
                    content = (
                      <VoiceMessage
                        path={message.storage_path}
                      />
                    );
                  } else if (message.storage_path) {
                    content = (
                      <AttachmentPreview
                        path={message.storage_path}
                        name={
                          message.message ||
                          'Attachment'
                        }
                        image={
                          message.message_type ===
                          'image'
                        }
                      />
                    );
                  } else {
                    content = (
                      <div className="text-sm whitespace-pre-wrap">
                        {message.message || ''}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.id}
                      className={
                        isAdmin
                          ? 'flex justify-end'
                          : 'flex justify-start'
                      }
                    >
                      <div
                        className={
                          isAdmin
                            ? 'max-w-[85%] rounded-2xl p-3 bg-white text-black'
                            : 'max-w-[85%] rounded-2xl p-3 card'
                        }
                      >
                        <div className="text-[10px] muted mb-1">
                          {isAdmin
                            ? 'Administrator'
                            : agent?.name ||
                              message.sender_type}
                        </div>

                        {content}

                        <div className="text-[9px] opacity-50 mt-2">
                          {new Date(
                            message.created_at
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!messages.length && (
                  <div className="h-full min-h-[300px] flex items-center justify-center text-center muted">
                    <div>
                      <Bot className="mx-auto mb-3" />

                      <p>Session opened.</p>

                      <p className="text-xs mt-1">
                        Send the first message below.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white/10 space-y-2">
                <PollList
                  holdingId={holding.id}
                  sessionId={session.id}
                />

                <Composer
                  holdingId={holding.id}
                  sessionId={session.id}
                  onSent={() => {
                    void load(session.id);
                  }}
                />
              </div>
            </section>

            <aside className="space-y-4">
              <div className="card p-4">
                <div className="font-medium">
                  Saved sessions
                </div>

                <div className="mt-3 space-y-2">
                  {sessions.map((item) => {
                    const selected =
                      item.id === session.id;

                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={
                          selected
                            ? 'w-full text-left rounded-xl border p-3 border-white/30 bg-white/5'
                            : 'w-full text-left rounded-xl border p-3 border-white/10 hover:bg-white/5'
                        }
                        onClick={() => {
                          void selectSession(item);
                        }}
                      >
                        <div className="text-sm">
                          {item.title}
                        </div>

                        <div className="text-[10px] muted mt-1">
                          {new Date(
                            item.started_at
                          ).toLocaleString()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card p-4">
                <div className="font-medium">
                  New session
                </div>

                <input
                  className="input mt-3"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  placeholder="Session title"
                />

                <button
                  type="button"
                  className="btn mt-3 w-full"
                  onClick={() => {
                    void createSession();
                  }}
                  disabled={creating}
                >
                  <Plus
                    size={15}
                    className="inline mr-1"
                  />

                  New Session
                </button>
              </div>

              <div className="card p-4 text-xs muted">
                Messages are stored in Supabase and are
                not dependent on browser local storage.
              </div>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AttachmentPreview({
  path,
  name,
  image = false,
}: {
  path: string;
  name: string;
  image?: boolean;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadAttachment() {
      const result = await createClient()
        .storage
        .from('nevu-files')
        .createSignedUrl(path, 3600);

      if (!active) {
        return;
      }

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (!result.data?.signedUrl) {
        setError(
          'Attachment could not be loaded.'
        );
        return;
      }

      setUrl(result.data.signedUrl);
    }

    void loadAttachment();

    return () => {
      active = false;
    };
  }, [path]);

  if (error) {
    return (
      <div className="text-xs text-red-300">
        Attachment unavailable: {error}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="text-xs muted">
        Loading attachment...
      </div>
    );
  }

  if (image) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        <img
          src={url}
          alt={name}
          className="max-w-sm max-h-80 rounded-xl object-contain"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="underline text-sm"
    >
      📎 {name}
    </a>
  );
}
```
