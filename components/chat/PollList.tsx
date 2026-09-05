'use client';

import {
  useEffect,
  useState,
} from 'react';
import { BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type PollOption = {
  id: string;
  label: string;
  sort_order: number;
};

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
};

export function PollList({
  holdingId,
  sessionId,
  hqSessionId,
}: {
  holdingId?: string;
  sessionId?: string;
  hqSessionId?: string;
}) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selected, setSelected] =
    useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [voting, setVoting] =
    useState<string | null>(null);

  async function load() {
    const sb = createClient();

    setError('');

    try {
      if (hqSessionId) {
        const pollResult = await sb
          .from('nevu_hq_polls')
          .select('*')
          .eq('hq_session_id', hqSessionId)
          .order('created_at', {
            ascending: false,
          });

        if (pollResult.error) {
          throw new Error(
            pollResult.error.message
          );
        }

        const result: Poll[] = [];

        for (const poll of pollResult.data || []) {
          const optionResult = await sb
            .from('nevu_hq_poll_options')
            .select('*')
            .eq('poll_id', poll.id)
            .order('sort_order');

          if (optionResult.error) {
            throw new Error(
              optionResult.error.message
            );
          }

          result.push({
            ...poll,
            options:
              optionResult.data || [],
          });
        }

        setPolls(result);
        return;
      }

      if (holdingId && sessionId) {
        const pollResult = await sb
          .from('nevu_polls')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', {
            ascending: false,
          });

        if (pollResult.error) {
          throw new Error(
            pollResult.error.message
          );
        }

        const result: Poll[] = [];

        for (const poll of pollResult.data || []) {
          const optionResult = await sb
            .from('nevu_poll_options')
            .select('*')
            .eq('poll_id', poll.id)
            .order('sort_order');

          if (optionResult.error) {
            throw new Error(
              optionResult.error.message
            );
          }

          result.push({
            ...poll,
            options:
              optionResult.data || [],
          });
        }

        setPolls(result);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Polls could not be loaded.'
      );
    }
  }

  useEffect(() => {
    void load();
  }, [holdingId, sessionId, hqSessionId]);

  async function vote(poll: Poll) {
    const optionId = selected[poll.id];

    if (!optionId || voting) return;

    setVoting(poll.id);
    setError('');

    try {
      const sb = createClient();

      const {
        data: { user },
      } = await sb.auth.getUser();

      if (!user) {
        throw new Error(
          'You must be signed in to vote.'
        );
      }

      const table = hqSessionId
        ? 'nevu_hq_poll_votes'
        : 'nevu_poll_votes';

      const result = await sb
        .from(table)
        .upsert(
          {
            poll_id: poll.id,
            option_id: optionId,
            voter_user_id: user.id,
          },
          {
            onConflict:
              'poll_id,option_id,voter_user_id',
          }
        );

      if (result.error) {
        throw new Error(
          result.error.message
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Vote could not be saved.'
      );
    } finally {
      setVoting(null);
    }
  }

  if (!polls.length && !error) {
    return null;
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {polls.map((poll) => (
        <div
          key={poll.id}
          className="card p-4"
        >
          <div className="flex gap-2 items-center">
            <BarChart3 size={16} />

            <div className="font-medium text-sm">
              {poll.question}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {poll.options.map((option) => (
              <label
                key={option.id}
                className="flex gap-2 items-center text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name={`poll-${poll.id}`}
                  checked={
                    selected[poll.id] ===
                    option.id
                  }
                  onChange={() =>
                    setSelected((current) => ({
                      ...current,
                      [poll.id]:
                        option.id,
                    }))
                  }
                />

                {option.label}
              </label>
            ))}
          </div>

          <button
            type="button"
            className="btn mt-3"
            onClick={() => void vote(poll)}
            disabled={
              !selected[poll.id] ||
              voting === poll.id
            }
          >
            {voting === poll.id
              ? 'Saving…'
              : 'Vote'}
          </button>
        </div>
      ))}
    </div>
  );
}
