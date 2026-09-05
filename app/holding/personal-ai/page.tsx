'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Plus, 
  Settings, 
  Trash2, 
  Sparkles, 
  Cpu, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Terminal, 
  ShieldCheck, 
  Layers, 
  Sliders, 
  Zap, 
  Code2, 
  Globe, 
  MessageSquare,
  Lock
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export default function PersonalAIChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'providers' | 'agents' | 'settings'>('chat');
  
  // Settings and config state
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiSaved, setApiSaved] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('general-assistant');
  const [systemPrompt, setSystemPrompt] = useState('You are an advanced AI assistant embedded securely within the NEVU HQ platform.');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/personal-ai/sessions');
      const data = await res.json();
      if (data.sessions && data.sessions.length > 0) {
        setSessions(data.sessions);
        if (!currentSessionId) {
          setCurrentSessionId(data.sessions[0].id);
        }
      } else {
        createNewSession();
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/personal-ai/messages?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/personal-ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat Session' })
      });
      const data = await res.json();
      if (data.session) {
        setSessions([data.session, ...sessions]);
        setCurrentSessionId(data.session.id);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentSessionId) return;

    const userText = inputMessage;
    setInputMessage('');

    const tempUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/personal-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: userText,
          provider: selectedProvider,
          agent: selectedAgent,
          systemPrompt
        })
      });

      const data = await res.json();
      if (data.reply) {
        const tempAssistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempAssistantMsg]);
      } else if (data.error) {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: `Error: ${data.error}`,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveApiKeyConfig = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem(`nevu_ai_key_${selectedProvider}`, apiKey);
    setApiSaved(true);
    setTimeout(() => setApiSaved(false), 3000);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-600/20 rounded-lg border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide">NEVU PERSONAL AI</h1>
              <p className="text-xs text-slate-400">Secure Core Matrix</p>
            </div>
          </div>
        </div>

        <div className="p-3">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat Session</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-xs font-semibold text-slate-500 px-3 py-1 uppercase tracking-wider">Recent Sessions</div>
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-center space-x-2 truncate ${
                currentSessionId === session.id 
                  ? 'bg-slate-800 text-indigo-400 border border-slate-700/60 font-medium' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">{session.title || 'Untitled Session'}</span>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-1">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'chat' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800/60'}`}
          >
            <Bot className="w-4 h-4" />
            <span>Active Terminal</span>
          </button>
          <button 
            onClick={() => setActiveTab('providers')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'providers' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800/60'}`}
          >
            <Key className="w-4 h-4" />
            <span>Provider Accounts</span>
          </button>
          <button 
            onClick={() => setActiveTab('agents')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'agents' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800/60'}`}
          >
            <Cpu className="w-4 h-4" />
            <span>Agent Assignment</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/50 backdrop-blur">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Memory Server Connected</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">Provider: <strong className="text-slate-200 uppercase">{selectedProvider}</strong></span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">Agent: <strong className="text-slate-200">{selectedAgent}</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setActiveTab('settings')}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              title="Boardroom & Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Dynamic Views */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
                  <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-200">Start a Conversation</h2>
                  <p className="text-sm text-slate-400">
                    Your session memory is fully synced server-side. Type a message below to begin testing communication resilience and agent workflows.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-2xl rounded-xl p-4 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-lg' 
                        : msg.role === 'system'
                        ? 'bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-lg'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow'
                    }`}>
                      <div className="font-semibold text-xs opacity-75 mb-1">
                        {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System Notice' : selectedAgent}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur">
              <div className="flex items-center space-x-2 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your test message here..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
                />
                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium text-sm transition flex items-center space-x-2 shadow-lg shadow-indigo-600/20"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Send</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="flex-1 p-8 max-w-3xl mx-auto w-full space-y-6 overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Provider Account Linking</h2>
              <p className="text-sm text-slate-400 mt-1">Configure your AI provider API credentials to securely power your agent sessions.</p>
            </div>

            <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Select AI Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="openai">OpenAI (GPT-4o / GPT-4 Turbo)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="gemini">Google Gemini Pro</option>
                  <option value="groq">Groq (Ultra-fast Llama 3)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">API Secret Key</label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={saveApiKeyConfig}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium text-sm transition shadow-lg shadow-indigo-600/20"
                  >
                    Save Key
                  </button>
                </div>
                {apiSaved && (
                  <p className="text-xs text-emerald-400 mt-2 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>API Key securely saved to local storage profile.</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="flex-1 p-8 max-w-3xl mx-auto w-full space-y-6 overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Agent Assignment & System Prompt</h2>
              <p className="text-sm text-slate-400 mt-1">Customize the personality, directives, and operational focus of your active assistant.</p>
            </div>

            <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Assigned Persona</label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="general-assistant">General Assistant Core</option>
                  <option value="code-architect">Code Architect & Debugger</option>
                  <option value="boardroom-strategist">Boardroom Executive Strategist</option>
                  <option value="security-analyst">Security & Compliance Officer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">System Directive Prompt</label>
                <textarea
                  rows={5}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <button
                onClick={() => alert('Agent configurations updated successfully!')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium text-sm transition shadow-lg shadow-indigo-600/20"
              >
                Update Agent Profile
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 p-8 max-w-3xl mx-auto w-full space-y-6 overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Boardroom & Platform Controls</h2>
              <p className="text-sm text-slate-400 mt-1">Manage platform hooks, inactive interface buttons, and security flags.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm">Inactive Indicators & Buttons</h3>
                  <p className="text-xs text-slate-400">Lock out legacy modules or toggle warning badges on unlinked components.</p>
                </div>
                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                  Active Guard
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <h3 className="font-semibold text-sm">Supabase Server Memory Persistence</h3>
                  <p className="text-xs text-slate-400">Ensures chat sessions survive browser refreshes seamlessly.</p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
                  Operational
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
