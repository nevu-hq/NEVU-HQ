'use client';

import { useState } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';

export function PersonalAssistantDrawer({ holdingId, sessionId }: { holdingId?: string; sessionId?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/personal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg, holdingId, sessionId })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Failed to fetch personal insight.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network connection error.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-white text-black p-4 shadow-2xl flex items-center gap-2 hover:bg-neutral-200 transition cursor-pointer"
      >
        <Sparkles size={18} />
        <span className="text-xs font-semibold uppercase tracking-wider">Personal AI</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-neutral-950 border-l border-white/10 flex flex-col h-full shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Bot size={18} />
                <span>Personal Assistant</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-auto space-y-3">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${m.role === 'user' ? 'bg-white text-black' : 'card border border-white/10'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 p-6">
                  <Bot size={28} className="mb-2" />
                  <p className="text-sm">Your private second opinion layer.</p>
                  <p className="text-xs mt-1">Ask questions regarding your holdings, context, or private notes.</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex gap-2 bg-neutral-900/50">
              <input
                className="input flex-1 text-sm"
                placeholder="Ask your assistant..."
                value={input}
                onChange={e => setInput(e.target.value)}
              />
              <button type="submit" className="btn primary" disabled={loading}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}