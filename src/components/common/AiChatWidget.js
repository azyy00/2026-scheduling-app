import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Send, X, Zap } from 'lucide-react';

// Floating AI assistant (admin only). Sticky bottom-right launcher that opens a
// chat panel backed by /misc?action=ai-chat. Shows Gemini token usage per reply
// plus a running "today" total — the free tier has daily limits, so keep it visible.
const AiChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState(null);
  const bodyRef = useRef(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (open && isAdmin) {
      api.get('/misc?action=ai-usage').then(({ data }) => setUsage(data)).catch(() => {});
    }
  }, [open, isAdmin]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, sending]);

  if (!isAdmin) return null;

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    const history = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));
    setMessages(m => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const { data } = await api.post('/misc?action=ai-chat', { message: text, history });
      setMessages(m => [...m, { role: 'ai', text: data.reply, tokens: data.usage?.total }]);
      setUsage(u => u ? {
        ...u,
        today: { tokens: (u.today?.tokens || 0) + (data.usage?.total || 0), requests: (u.today?.requests || 0) + 1 },
        allTime: { tokens: (u.allTime?.tokens || 0) + (data.usage?.total || 0), requests: (u.allTime?.requests || 0) + 1 },
      } : u);
    } catch (err) {
      setMessages(m => [...m, { role: 'ai', text: err.response?.data?.message || 'Sorry — I could not reach the AI. Try again in a moment.', error: true }]);
    } finally { setSending(false); }
  };

  const fmtTokens = (n) => {
    const v = Number(n) || 0;
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end">
      {/* Panel */}
      {open && (
        <div className="mb-3 w-[min(92vw,380px)] h-[min(70vh,520px)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop">
          {/* Header */}
          <div className="px-4 py-3 bg-[#7B1C1C] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-tight">AI Assistant</p>
                <p className="text-[10px] text-white/70 truncate">Ask about schedules, instructors & students</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Token usage indicator */}
          <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-900/15 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              <Zap className="w-3 h-3" /> Gemini free tier
            </span>
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
              {usage ? <>Today: {fmtTokens(usage.today.tokens)} tokens · {usage.today.requests} request{usage.today.requests !== 1 ? 's' : ''}</> : 'Loading usage…'}
            </span>
          </div>

          {/* Messages */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
            {messages.length === 0 && (
              <div className="text-center mt-6">
                <Sparkles className="w-6 h-6 text-[#7B1C1C]/40 dark:text-red-300/40 mx-auto mb-2" />
                <p className="text-xs text-gray-400 dark:text-gray-500 px-4">
                  Ask me anything about the system — e.g. “How many irregular students are there?”, “What does Albert Panuelos teach?”, “Which sections have no schedules yet?”
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] ${m.role === 'user' ? 'self-end' : 'self-start'}`}>
                <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-[#7B1C1C] text-white rounded-br-md'
                    : m.error
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/40 rounded-bl-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-md'
                }`}>
                  {m.text}
                </div>
                {m.role === 'ai' && !m.error && m.tokens != null && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ml-1 tabular-nums">{m.tokens} tokens</p>
                )}
              </div>
            ))}
            {sending && (
              <div className="self-start px-3 py-2 rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-800 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={send} className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about the system…"
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]" />
            <button type="submit" disabled={sending || !input.trim()}
              className="w-10 h-10 rounded-xl bg-[#7B1C1C] text-white flex items-center justify-center hover:bg-[#6a1717] transition disabled:opacity-50 shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Launcher */}
      <button onClick={() => setOpen(v => !v)} aria-label="AI Assistant"
        className="w-14 h-14 rounded-full bg-[#7B1C1C] text-white shadow-xl shadow-[#7B1C1C]/30 flex items-center justify-center hover:bg-[#6a1717] hover:scale-105 active:scale-95 transition">
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default AiChatWidget;
