'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  MessageSquareText,
  Phone,
  Video,
  MoreVertical,
  UserPlus,
  Search,
  RefreshCw,
  Plus,
  Users,
} from 'lucide-react';

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
  holding_id?: string | null;
  session_id?: string | null;
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

  const [title, setTitle] = useState('Holding Discussion');
  const [capital, setCapital] = useState('');

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadHoldingMessages = useCallback(
    async (holdingId: string) => {
      const result = await sb
        .from('nevu_messages')
        .select('*')
        .eq('holding_id', holdingId)
        .order('created_at', {
          ascending: true,
        });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setMessages((result.data || []) as Message[]);
    },
    [sb]
  );

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

      const [adminRes, holdingRes] = await Promise.all([
        sb
          .from('nevu_administrators')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),

        sb
          .from('holdings')
          .select('*')
          .eq('administrator_id', user.id)
          .maybeSingle(),
      ]);

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
        .order('started_at', {
          ascending: false,
        });

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

      await loadHoldingMessages(holdingRes.data.id);

      setLoading(false);
    },
    [sb, loadHoldingMessages]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!holding?.id) {
      return;
    }

    const channel = sb
      .channel('nevu-holding-chat-' + holding.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nevu_messages',
          filter: 'holding_id=eq.' + holding.id,
        },
        (payload) => {
          const incoming = payload.new as Message;

          setMessages((current) => {
            if (
              current.some(
                (message) =>
                  message.id === incoming.id
              )
            ) {
              return current;
            }

            return [...current, incoming];
          });
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [sb, holding?.id]);

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
          title.trim() || 'Holding Discussion',
        purpose:
          'Holding-wide discussion',
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

    setTitle('Holding Discussion');
    setCapital('');
    setCreating(false);

    await load(result.data.id);
  }

  async function refresh() {
    if (!holding?.id) {
      return;
    }

    setRefreshing(true);
    await load(session?.id);
    setRefreshing(false);
  }

  const visibleMessages = messages.filter((message) => {
    if (!search.trim()) {
      return true;
    }

    const query = search.toLowerCase();

    return (
      message.message
        ?.toLowerCase()
        .includes(query) ||
      message.sender_type
        .toLowerCase()
        .includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center muted">
        Opening NEVU Chat…
      </div>
    );
  }

  return (
    <AppShell
      username={
        admin?.username || 'Administrator'
      }
      holdingName={
        holding?.holding_name || 'Your Holding'
      }
    >
      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          height: 'calc(100vh - 150px)',
          minHeight: '650px',
          background: '#0b0d14',
          borderColor: '#24293f',
          color: '#f3f4f6',
        }}
      >
        <div
          className="flex h-full"
          style={{
            background: '#171b2c',
          }}
        >
          <aside
            className="w-[340px] flex flex-col border-r"
            style={{
              background: '#131622',
              borderColor: '#24293f',
            }}
          >
            <div
              className="p-5 flex items-center justify-between border-b"
              style={{
                borderColor: '#24293f',
              }}
            >
              <div className="flex items-center gap-2 font-bold text-lg">
                <MessageSquareText
                  size={21}
                  style={{ color: '#6366f1' }}
                />
                <span>NEVU Chat</span>
              </div>

              <div className="flex items-center gap-4 text-gray-400">
                <UserPlus
                  size={18}
                  className="cursor-pointer"
                />

                <MoreVertical
                  size={18}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search discussions..."
                  className="w-full rounded-xl py-2.5 pl-10 pr-3 outline-none"
                  style={{
                    background: '#0b0d14',
                    border: '1px solid #24293f',
                    color: '#f3f4f6',
                  }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div
                className="px-4 py-4 cursor-pointer border-l-2"
                style={{
                  background:
                    'rgba(99,102,241,0.08)',
                  borderColor: '#6366f1',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-semibold"
                    style={{
                      background: '#6366f1',
                    }}
                  >
                    {(
                      holding?.holding_name ||
                      'HQ'
                    )
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between">
                      <span className="font-semibold">
                        Holding Discussion
                      </span>

                      <span className="text-xs text-gray-500">
                        Live
                      </span>
                    </div>

                    <div className="text-sm text-gray-400 truncate">
                      Everyone in this holding
                    </div>
                  </div>
                </div>
              </div>

              {sessions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setSession(item);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: '#22273d',
                      }}
                    >
                      <MessageSquareText size={17} />
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm truncate">
                        {item.title}
                      </div>

                      <div className="text-xs text-gray-500">
                        {new Date(
                          item.started_at
                        ).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 flex flex-col min-w-0">
            <header
              className="px-6 py-4 flex items-center justify-between border-b"
              style={{
                background: '#131622',
                borderColor: '#24293f',
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-semibold"
                  style={{
                    background: '#6366f1',
                  }}
                >
                  {(
                    holding?.holding_name ||
                    'HQ'
                  )
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div>
                  <h2 className="font-semibold">
                    {holding?.holding_name ||
                      'Holding Discussion'}
                  </h2>

                  <div className="text-xs text-green-400">
                    ● Holding room · Live
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-5 text-gray-400">
                <Users size={19} />

                <Phone
                  size={19}
                  className="cursor-pointer"
                />

                <Video
                  size={19}
                  className="cursor-pointer"
                />

                <RefreshCw
                  size={18}
                  onClick={() => {
                    void refresh();
                  }}
                  className={
                    refreshing
                      ? 'animate-spin cursor-pointer'
                      : 'cursor-pointer'
                  }
                />
              </div>
            </header>

            <div
              className="flex-1 overflow-y-auto p-6 space-y-4"
              style={{
                backgroundColor: '#0b0d14',
                backgroundImage:
                  'radial-gradient(#24293f 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }}
            >
              {visibleMessages.map((message) => {
                const isAdmin =
                  message.sender_type ===
                    'administrator' ||
                  message.sender_type === 'user';

                const agent = AGENTS.find(
                  (item) =>
                    item.key ===
                    message.agent_key
                );

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
                      className="max-w-[65%] rounded-2xl px-4 py-3"
                      style={{
                        background: isAdmin
                          ? '#6366f1'
                          : '#22273d',
                        color: '#f3f4f6',
                        borderTopRightRadius:
                          isAdmin ? '4px' : '16px',
                        borderTopLeftRadius:
                          isAdmin ? '16px' : '4px',
                      }}
                    >
                      <div
                        className="text-[10px] mb-1"
                        style={{
                          opacity: 0.65,
                        }}
                      >
                        {isAdmin
                          ? admin?.username ||
                            'Administrator'
                          : agent?.name ||
                            message.sender_type}
                      </div>

                      {message.deleted_at ? (
                        <div className="text-sm opacity-60">
                          Message deleted
                        </div>
                      ) : message.message_type ===
                          'voice' &&
                        message.storage_path ? (
                        <VoiceMessage
                          path={
                            message.storage_path
                          }
                        />
                      ) : message.storage_path ? (
                        <AttachmentPreview
                          path={
                            message.storage_path
                          }
                          name={
                            message.message ||
                            'Attachment'
                          }
                          image={
                            message.message_type ===
                            'image'
                          }
                        />
                      ) : (
                        <div className="text-sm whitespace-pre-wrap">
                          {message.message || ''}
                        </div>
                      )}

                      <div className="text-[9px] opacity-50 mt-2 text-right">
                        {new Date(
                          message.created_at
                        ).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!visibleMessages.length && (
                <div className="h-full min-h-[300px] flex items-center justify-center text-center text-gray-500">
                  <div>
                    <MessageSquareText
                      className="mx-auto mb-3"
                      size={30}
                    />

                    <p>No messages yet.</p>

                    <p className="text-xs mt-1">
                      Start the holding discussion below.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div
              className="p-4 border-t"
              style={{
                background: '#131622',
                borderColor: '#24293f',
              }}
            >
              {holding && (
                <PollList
                  holdingId={holding.id}
                  sessionId={session?.id || ''}
                />
              )}

              {holding && (
                <Composer
                  holdingId={holding.id}
                  sessionId={session?.id || undefined}
                  onSent={() => {
                    void load(session?.id);
                  }}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="btn"
          onClick={() => {
            void createSession();
          }}
          disabled={creating}
        >
          <Plus
            size={15}
            className="inline mr-1"
          />

          {creating
            ? 'Creating…'
            : 'New Discussion Session'}
        </button>
      </div>

      {error && (
        <div className="card p-3 text-sm red mt-3">
          {error}
        </div>
      )}
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
      const {
        data,
        error: signedUrlError,
      } = await createClient()
        .storage
        .from('nevu-files')
        .createSignedUrl(path, 3600);

      if (!active) {
        return;
      }

      if (signedUrlError) {
        setError(signedUrlError.message);
        return;
      }

      if (!data?.signedUrl) {
        setError(
          'Attachment could not be loaded.'
        );
        return;
      }

      setUrl(data.signedUrl);
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
      <div className="text-xs opacity-60">
        Loading attachment…
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
