'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { Play, Pause } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function VoiceMessage({
  path,
}: {
  path: string;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      const { data, error: signedUrlError } =
        await createClient()
          .storage
          .from('nevu-files')
          .createSignedUrl(path, 3600);

      if (!active) return;

      if (signedUrlError) {
        setError(signedUrlError.message);
        setLoading(false);
        return;
      }

      if (!data?.signedUrl) {
        setError('Voice note could not be loaded.');
        setLoading(false);
        return;
      }

      setUrl(data.signedUrl);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [path]);

  async function toggle() {
    if (!audio.current || !url) return;

    try {
      if (audio.current.paused) {
        await audio.current.play();
      } else {
        audio.current.pause();
      }
    } catch {
      setError('Unable to play this voice note.');
    }
  }

  if (error) {
    return (
      <div className="text-xs text-red-300">
        Voice note unavailable: {error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-52">
      <button
        type="button"
        className="btn p-2"
        onClick={() => void toggle()}
        disabled={!url || loading}
      >
        {loading ? (
          <span className="text-xs">…</span>
        ) : audio.current?.paused !== false ? (
          <Play size={15} />
        ) : (
          <Pause size={15} />
        )}
      </button>

      <div className="flex-1">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-2/5 bg-white/50" />
        </div>

        <div className="text-[10px] muted mt-1">
          {loading
            ? 'Loading voice note…'
            : 'Voice note · 1×'}
        </div>
      </div>

      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onEnded={() => {
          if (audio.current) {
            audio.current.currentTime = 0;
          }
        }}
      />
    </div>
  );
}
