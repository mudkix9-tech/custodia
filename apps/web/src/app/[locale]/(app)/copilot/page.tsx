'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { Send, Bot, User, Sparkles, AlertCircle, BookOpen, Trash2 } from 'lucide-react';
import { Markdown } from '@/components/copilot/Markdown';

type Citation = {
  index: number;
  title: string;
  document: string;
  url: string;
  authority: string | null;
  similarity: number;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  confidence?: string;
};

const GREETING: Message = {
  role: 'assistant',
  content:
    "Hello! I'm your Custodia Co-Pilot. Ask me anything about GDPR compliance, Article 28 requirements, or your organization's specific processing activities.",
};

const STORAGE_KEY = 'custodia.copilot.conversation';
/** Enough to keep a working session; beyond this the prompt gets expensive anyway. */
const MAX_STORED = 50;
/** How many turns to send back as context. The router uses these for query expansion. */
const HISTORY_TURNS = 8;

const SUGGESTIONS = [
  'Do I need a DPIA for tracking employee locations?',
  'What must an Article 28 processor contract contain?',
  'How long can I keep job applicant data?',
];

export default function CopilotPage() {
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // The conversation lived in useState alone, so a refresh — or following a link
  // to the record being discussed and coming back — deleted the whole thread.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch {
      // Corrupt or unavailable storage is not worth failing the page over.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {
      // Quota or private mode; the conversation still works for this session.
    }
  }, [messages, restored]);

  const copilotMutation = trpc.ai.askCopilot.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          confidence: data.confidence,
        },
      ]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'I encountered an error trying to process your request.'}`,
        },
      ]);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || copilotMutation.isPending) return;

      // The subtitle claims the assistant is context-aware, but the mutation used
      // to send `{ question }` alone — the router has always accepted history and
      // locale and uses them for query expansion and answer language.
      const history = messages
        .filter((m) => m !== GREETING && !m.content.startsWith('Error:'))
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setInput('');
      copilotMutation.mutate({ question: trimmed, history, locale });
    },
    [copilotMutation, messages, locale],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const clearConversation = () => {
    setMessages([GREETING]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clean up */
    }
  };

  const hasConversation = messages.length > 1;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-[#F4F5F6] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#C9A227]" />
            Compliance Co-Pilot
          </h1>
          <p className="text-sm text-[#9BA1A6] mt-1">
            Context-aware AI assistant grounded in official GDPR text and your organization&apos;s data.
          </p>
        </div>
        {hasConversation && (
          <button
            onClick={clearConversation}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[13px] text-[#9BA1A6] transition-colors hover:bg-white/5 hover:text-[#E6E8EA]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            New conversation
          </button>
        )}
      </div>

      <div className="flex-1 bg-[#0D0F11] rounded-lg border border-white/10 shadow-panel-elevated flex flex-col overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-[#C9A227]" />
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#C9A227] text-[#08090A] rounded-tr-none'
                    : 'bg-white/5 text-[#E6E8EA] rounded-tl-none'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <Markdown content={msg.content} />
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                )}

                {/* Sources. The router has always retrieved these; nothing showed them. */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6E747A]">
                      <BookOpen className="h-3 w-3" />
                      Sources
                    </p>
                    <ol className="space-y-1.5">
                      {msg.citations.map((c) => (
                        <li key={c.index} className="flex gap-2 text-[12px] leading-snug">
                          <span className="flex-none font-mono text-[#6E747A]">{c.index}.</span>
                          <span className="min-w-0">
                            {c.url ? (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#C9A227] hover:underline"
                              >
                                {c.title}
                              </a>
                            ) : (
                              <span className="text-[#E6E8EA]">{c.title}</span>
                            )}
                            {c.document && c.document !== c.title && (
                              <span className="text-[#6E747A]"> — {c.document}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-[#9BA1A6]" />
                </div>
              )}
            </div>
          ))}

          {/* Starter questions: an empty chat box teaches nothing about what it can do. */}
          {!hasConversation && !copilotMutation.isPending && (
            <div className="flex flex-wrap gap-2 pl-12">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12.5px] text-[#9BA1A6] transition-colors hover:border-[#C9A227]/40 hover:text-[#E6E8EA]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {copilotMutation.isPending && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-[#C9A227]/15 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-[#C9A227]" />
              </div>
              <div className="bg-white/5 rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-[#6E747A] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[#6E747A] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-[#6E747A] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-[#08090A]">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Do I need a DPIA for tracking employee locations?"
              className="flex-1 rounded-lg border border-white/10 bg-[#0D0F11] text-[#F4F5F6] placeholder:text-[#6E747A] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40"
              disabled={copilotMutation.isPending}
            />
            <button
              type="submit"
              disabled={!input.trim() || copilotMutation.isPending}
              className="bg-[#C9A227] hover:bg-[#E5C463] disabled:opacity-50 disabled:cursor-not-allowed text-[#08090A] px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
            >
              <span>Ask</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 text-xs text-center text-[#9BA1A6] flex items-center justify-center gap-1">
            <AlertCircle className="w-3 h-3" />
            AI can make mistakes. Please verify important compliance advice.
          </div>
        </div>
      </div>
    </div>
  );
}
