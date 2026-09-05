'use client';

import { useRef, useState } from 'react';
import {
Paperclip,
Mic,
Send,
BarChart3,
X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type ComposerProps = {
holdingId?: string;
sessionId?: string;
hqSessionId?: string;
chatId?: string;
onSent?: () => void;
};

export function Composer({
holdingId,
sessionId,
hqSessionId,
chatId,
onSent,
}: ComposerProps) {
const [text, setText] = useState('');
const [recording, setRecording] = useState(false);
const [pollOpen, setPollOpen] = useState(false);
const [pollQ, setPollQ] = useState('');
const [pollOpts, setPollOpts] = useState(['', '']);
const [busy, setBusy] = useState(false);
const [error, setError] = useState('');

const media = useRef<MediaRecorder | null>(null);
const chunks = useRef<Blob[]>([]);
const file = useRef<HTMLInputElement>(null);

const sb = createClient();

async function getUserId() {
const {
data: { user },
error: authError,
} = await sb.auth.getUser();

```
if (authError) {
  throw new Error(authError.message);
}

if (!user) {
  throw new Error('You must be signed in.');
}

return user.id;
```

}

async function sendMessage(payload: {
message_type: 'text' | 'voice' | 'image' | 'file';
message?: string;
storage_path?: string;
}) {
const uid = await getUserId();

```
if (hqSessionId) {
  const result = await sb
    .from('nevu_hq_messages')
    .insert({
      hq_session_id: hqSessionId,
      sender_type: 'administrator',
      sender_user_id: uid,
      sender_holding_id: holdingId,
      ...payload,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  onSent?.();
  return;
}

if (holdingId && sessionId) {
  const result = await sb
    .from('nevu_messages')
    .insert({
      holding_id: holdingId,
      session_id: sessionId,
      sender_type: 'administrator',
      sender_user_id: uid,
      ...payload,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  onSent?.();
  return;
}

if (chatId) {
  const result = await sb
    .from('nevu_holding_chat_messages')
    .insert({
      chat_id: chatId,
      sender_holding_id: holdingId,
      sender_user_id: uid,
      ...payload,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  onSent?.();
  return;
}

throw new Error('No active chat or session was supplied.');
```

}

async function send() {
const value = text.trim();

```
if (!value || busy) {
  return;
}

setBusy(true);
setError('');

try {
  await sendMessage({
    message_type: 'text',
    message: value,
  });

  setText('');
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : 'Message could not be sent.'
  );
} finally {
  setBusy(false);
}
```

}

async function upload(
e: React.ChangeEvent<HTMLInputElement>
) {
const selectedFile = e.target.files?.[0];

```
if (!selectedFile || !holdingId || busy) {
  return;
}

setBusy(true);
setError('');

try {
  const safeName = selectedFile.name.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );

  const path =
    `${holdingId}/files/` +
    `${crypto.randomUUID()}-${safeName}`;

  const uploadResult = await sb.storage
    .from('nevu-files')
    .upload(path, selectedFile, {
      contentType:
        selectedFile.type ||
        'application/octet-stream',
      upsert: false,
    });

  if (uploadResult.error) {
    throw new Error(
      `Attachment upload failed: ${uploadResult.error.message}`
    );
  }

  await sendMessage({
    message_type:
      selectedFile.type.startsWith('image/')
        ? 'image'
        : 'file',
    message: selectedFile.name,
    storage_path: path,
  });
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : 'Attachment could not be uploaded.'
  );
} finally {
  setBusy(false);
  e.target.value = '';
}
```

}

async function voice() {
if (busy) {
return;
}

```
setError('');

if (recording) {
  media.current?.stop();
  setRecording(false);
  return;
}

if (
  !navigator.mediaDevices ||
  !navigator.mediaDevices.getUserMedia
) {
  setError(
    'Voice recording is not supported by this browser.'
  );
  return;
}

if (!holdingId && !hqSessionId && !chatId) {
  setError('No active chat is available.');
  return;
}

try {
  const stream =
    await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

  const recorder = new MediaRecorder(stream);

  media.current = recorder;
  chunks.current = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.current.push(event.data);
    }
  };

  recorder.onerror = () => {
    setError('Voice recording failed.');

    stream
      .getTracks()
      .forEach((track) => track.stop());

    setRecording(false);
  };

  recorder.onstop = async () => {
    setBusy(true);

    try {
      const blob = new Blob(chunks.current, {
        type: recorder.mimeType || 'audio/webm',
      });

      const path =
        `${holdingId || 'hq'}/voice/` +
        `${crypto.randomUUID()}.webm`;

      const uploadResult = await sb.storage
        .from('nevu-files')
        .upload(path, blob, {
          contentType:
            recorder.mimeType || 'audio/webm',
          upsert: false,
        });

      if (uploadResult.error) {
        throw new Error(
          `Voice upload failed: ${uploadResult.error.message}`
        );
      }

      await sendMessage({
        message_type: 'voice',
        message: 'Voice note',
        storage_path: path,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Voice note could not be saved.'
      );
    } finally {
      stream
        .getTracks()
        .forEach((track) => track.stop());

      setBusy(false);
      setRecording(false);
      chunks.current = [];
    }
  };

  recorder.start();
  setRecording(true);
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : 'Microphone access was denied.'
  );

  setRecording(false);
}
```

}

async function createPoll() {
const question = pollQ.trim();

```
const options = pollOpts
  .map((option) => option.trim())
  .filter(Boolean);

if (!question) {
  setError('Enter a poll question.');
  return;
}

if (options.length < 2) {
  setError('A poll needs at least two options.');
  return;
}

setBusy(true);
setError('');

try {
  const uid = await getUserId();

  if (hqSessionId) {
    const pollResult = await sb
      .from('nevu_hq_polls')
      .insert({
        hq_session_id: hqSessionId,
        question,
        multiple_choice: false,
        created_by: uid,
      })
      .select()
      .single();

    if (pollResult.error) {
      throw new Error(pollResult.error.message);
    }

    const optionsResult = await sb
      .from('nevu_hq_poll_options')
      .insert(
        options.map((label, index) => ({
          poll_id: pollResult.data.id,
          label,
          sort_order: index,
        }))
      );

    if (optionsResult.error) {
      throw new Error(optionsResult.error.message);
    }
  } else if (holdingId && sessionId) {
    const pollResult = await sb
      .from('nevu_polls')
      .insert({
        holding_id: holdingId,
        session_id: sessionId,
        question,
        multiple_choice: false,
        created_by: uid,
      })
      .select()
      .single();

    if (pollResult.error) {
      throw new Error(pollResult.error.message);
    }

    const optionsResult = await sb
      .from('nevu_poll_options')
      .insert(
        options.map((label, index) => ({
          poll_id: pollResult.data.id,
          label,
          sort_order: index,
        }))
      );

    if (optionsResult.error) {
      throw new Error(optionsResult.error.message);
    }
  } else {
    throw new Error(
      'No active session is available for this poll.'
    );
  }

  setPollQ('');
  setPollOpts(['', '']);
  setPollOpen(false);

  onSent?.();
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : 'Poll could not be published.'
  );
} finally {
  setBusy(false);
}
```

}

return ( <div className="relative"> <input
     ref={file}
     type="file"
     className="hidden"
     onChange={upload}
     disabled={busy}
   />

```
  {pollOpen && (
    <div className="card p-4 absolute bottom-16 left-0 right-0 z-20 shadow-2xl">
      <div className="flex justify-between items-center">
        <b>Create poll</b>

        <button
          type="button"
          onClick={() => setPollOpen(false)}
          disabled={busy}
        >
          <X size={16} />
        </button>
      </div>

      <input
        className="input mt-3 w-full"
        placeholder="Question"
        value={pollQ}
        onChange={(e) => setPollQ(e.target.value)}
      />

      {pollOpts.map((option, index) => (
        <input
          key={index}
          className="input mt-2 w-full"
          placeholder={`Option ${index + 1}`}
          value={option}
          onChange={(e) =>
            setPollOpts((current) =>
              current.map((item, itemIndex) =>
                itemIndex === index
                  ? e.target.value
                  : item
              )
            )
          }
        />
      ))}

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          className="btn"
          onClick={() =>
            setPollOpts((current) => [
              ...current,
              '',
            ])
          }
          disabled={busy}
        >
          Add option
        </button>

        <button
          type="button"
          className="btn primary"
          onClick={() => void createPoll()}
          disabled={busy}
        >
          {busy ? 'Publishing…' : 'Publish poll'}
        </button>
      </div>
    </div>
  )}

  {error && (
    <div className="mb-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
      {error}
    </div>
  )}

  <div className="card p-2 flex items-center gap-2">
    <button
      type="button"
      className="btn p-2"
      onClick={() => file.current?.click()}
      disabled={busy}
      title="Attach file"
    >
      <Paperclip size={18} />
    </button>

    <button
      type="button"
      className="btn p-2"
      onClick={() =>
        setPollOpen((current) => !current)
      }
      disabled={busy}
      title="Create poll"
    >
      <BarChart3 size={18} />
    </button>

    <input
      className="input border-0 bg-transparent flex-1"
      placeholder="Write a message…"
      value={text}
      disabled={busy}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (
          e.key === 'Enter' &&
          !e.shiftKey
        ) {
          e.preventDefault();
          void send();
        }
      }}
    />

    <button
      type="button"
      className={`btn p-2 ${
        recording ? 'danger' : ''
      }`}
      onClick={() => void voice()}
      disabled={busy && !recording}
      title={
        recording
          ? 'Stop recording'
          : 'Voice note'
      }
    >
      <Mic size={18} />
    </button>

    <button
      type="button"
      className="btn primary p-2"
      onClick={() => void send()}
      disabled={busy || !text.trim()}
      title="Send"
    >
      <Send size={18} />
    </button>
  </div>
</div>
```

);
}
