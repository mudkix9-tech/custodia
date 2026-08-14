'use client';

import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { Send, Bot, User, Sparkles, AlertCircle } from 'lucide-react';

export default function CopilotPage() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: "Hello! I'm your Custodia Co-Pilot. Ask me anything about GDPR compliance, Article 28 requirements, or your organization's specific processing activities." }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const copilotMutation = trpc.ai.askCopilot.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    },
    onError: (err) => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${err.message || 'I encountered an error trying to process your request.'}` 
      }]);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || copilotMutation.isPending) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    copilotMutation.mutate({ question: userMessage });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F6] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            Compliance Co-Pilot
          </h1>
          <p className="text-sm text-[#9BA1A6] mt-1">
            Context-aware AI assistant grounded in official GDPR text and your organization's data.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-[#0D0F11] rounded-lg border border-white/10 shadow-panel-elevated flex flex-col overflow-hidden">
        
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-indigo-400" />
                </div>
              )}
              
              <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white/5 text-[#E6E8EA] rounded-tl-none'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-[#9BA1A6]" />
                </div>
              )}
            </div>
          ))}
          {copilotMutation.isPending && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-indigo-400" />
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
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors"
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
