'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAiGuidanceStore } from '@/store/aiGuidanceStore';
import { trpc } from '@/utils/trpc';
import { 
  Lightbulb, 
  X, 
  Send, 
  Bot, 
  User, 
  ThumbsUp, 
  ThumbsDown, 
  Compass, 
  AlertCircle, 
  Check, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { RopaFormData, GuidanceContext } from '@/types/aiGuidance';
import { useLocale } from 'next-intl';

export function AiGuidancePanel() {
  const locale = useLocale();
  const { 
    isOpen, 
    context, 
    chatHistory, 
    closePanel, 
    openPanel, 
    addChatMessage, 
    applyField 
  } = useAiGuidanceStore();

  const getSuggestionsMutation = trpc.ai.getContextualSuggestions.useMutation();
  const feedbackMutation = trpc.ai.submitFeedback.useMutation();
  const copilotMutation = trpc.ai.askCopilot.useMutation();

  const [suggestions, setSuggestions] = useState<any>(null);
  const [confidence, setConfidence] = useState<string>('');
  const [sources, setSources] = useState<any[]>([]);
  const [logId, setLogId] = useState<string | null>(null);
  const [feedbackSubmittedFor, setFeedbackSubmittedFor] = useState<Record<string, 'helpful' | 'not_helpful'>>({});
  
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stringify context to watch for changes
  const contextKey = context ? JSON.stringify({ module: context.module, entityId: context.entityId }) : '';

  useEffect(() => {
    if (isOpen && context) {
      setSuggestions(null);
      getSuggestionsMutation.mutate({
        module: context.module,
        entityId: context.entityId || undefined,
        formData: context.formData || undefined,
        locale,
      }, {
        onSuccess: (data) => {
          setSuggestions(data.suggestions);
          setConfidence(data.confidence);
          setSources(data.sources || []);
          setLogId(data.logId);
        }
      });
    }
  }, [isOpen, contextKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, getSuggestionsMutation.isPending]);

  if (!context) return null;

  const handleFeedback = async (targetLogId: string | null, feedback: 'helpful' | 'not_helpful') => {
    if (!targetLogId) return;
    try {
      await feedbackMutation.mutateAsync({
        logId: targetLogId,
        feedback,
      });
      setFeedbackSubmittedFor(prev => ({ ...prev, [targetLogId]: feedback }));
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || copilotMutation.isPending) return;

    const userQuery = chatInput.trim();
    addChatMessage({ role: 'user', content: userQuery });
    setChatInput('');

    // Format chat history for backend
    const apiHistory = chatHistory.map(h => ({
      role: h.role,
      content: h.content,
    }));

    copilotMutation.mutate({
      question: userQuery,
      history: apiHistory,
      moduleContext: context.module,
      entityId: context.entityId || undefined,
      locale,
    }, {
      onSuccess: (data) => {
        addChatMessage({ role: 'assistant', content: data.answer });
      },
      onError: (err) => {
        addChatMessage({ 
          role: 'assistant', 
          content: `Error: ${err.message || 'I encountered an error trying to process your request.'}` 
        });
      }
    });
  };

  // Helper to parse markdown-style links like [Text](Url) and render them safely in React
  const renderTextWithLinks = (text: string) => {
    if (!text) return '';
    const parts = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <a 
          key={matchIndex} 
          href={linkUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#C9A227] underline font-medium hover:text-[#C9A227] transition-colors"
        >
          {linkText}
        </a>
      );
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <>
      {/* Collapsed Handle */}
      {!isOpen && (
        <button
          onClick={openPanel}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-[#0D0F11] border border-r-0 border-white/10 rounded-l-xl shadow-md p-3.5 flex flex-col items-center gap-2 hover:bg-[#08090A] transition-colors select-none cursor-pointer border-r-transparent"
          style={{ writingMode: 'vertical-lr' }}
        >
          <Lightbulb className="w-4 h-4 text-amber-500 rotate-180 shrink-0" />
          <span className="text-[12.5px] font-semibold text-[#E6E8EA] tracking-wider">AI Guidance</span>
        </button>
      )}

      {/* Slide-out Panel */}
      <div className={`fixed top-0 right-0 h-screen w-[380px] bg-[#0D0F11] border-l border-white/10 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#08090A] shrink-0">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#C9A227]" />
            <div>
              <h3 className="font-semibold text-[#F4F5F6] text-sm">AI Guidance</h3>
              <p className="text-[10px] text-[#6E747A]">Grounded in GDPR & Org Context</p>
            </div>
          </div>
          <button 
            onClick={closePanel} 
            className="p-1 rounded-lg hover:bg-ink-900/5 text-[#6E747A] hover:text-[#F4F5F6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Skeletons while Loading Suggestions */}
          {getSuggestionsMutation.isPending && (
            <div className="space-y-4">
              <div className="h-4 bg-ink-900/5 rounded w-1/3 animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-3 bg-ink-900/5 rounded animate-pulse"></div>
                <div className="h-3 bg-ink-900/5 rounded w-5/6 animate-pulse"></div>
                <div className="h-3 bg-ink-900/5 rounded w-4/5 animate-pulse"></div>
              </div>
              <div className="pt-4 space-y-3">
                <div className="h-20 bg-ink-900/5 rounded-xl animate-pulse"></div>
                <div className="h-20 bg-ink-900/5 rounded-xl animate-pulse"></div>
              </div>
            </div>
          )}

          {/* Render Suggestions */}
          {!getSuggestionsMutation.isPending && suggestions && (
            <div className="space-y-5">
              
              {/* ROPA Suggestions */}
              {context.module === 'ropa' && (
                <div className="space-y-4">
                  <div className="bg-[#08090A] p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide">Suggested Lawful Basis</span>
                      <button 
                        onClick={() => applyField('lawfulBasis', suggestions.lawfulBasis)}
                        className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[11px] font-semibold px-2 py-1 rounded transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    <div className="text-[13px] font-semibold text-[#F4F5F6] uppercase">
                      {suggestions.lawfulBasis.replace('_', ' ')}
                    </div>
                    <p className="text-[12px] text-[#9BA1A6] leading-relaxed">{suggestions.lawfulBasisNotes}</p>
                  </div>

                  <div className="bg-[#08090A] p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide">Suggested Retention</span>
                      <button 
                        onClick={() => applyField('retention', suggestions.retentionPeriod)}
                        className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[11px] font-semibold px-2 py-1 rounded transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    <div className="text-[13px] font-semibold text-[#F4F5F6]">
                      {suggestions.retentionPeriod.replace('_', ' ')}
                    </div>
                    <p className="text-[12px] text-[#9BA1A6] leading-relaxed">{suggestions.retentionJustification}</p>
                  </div>

                  <div className="bg-[#08090A] p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide">Suggested Categories</span>
                      <button 
                        onClick={() => applyField('dataCategories', suggestions.dataCategories)}
                        className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] text-[11px] font-semibold px-2 py-1 rounded transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.dataCategories.map((c: string) => (
                        <span key={c} className="bg-[#0D0F11] px-2 py-0.5 border border-white/10 text-[#E6E8EA] text-[11.5px] rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="text-[12px] text-[#9BA1A6] leading-relaxed">{suggestions.dataCategoriesReasoning}</p>
                  </div>

                  {suggestions.warnings && suggestions.warnings.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-red-500 uppercase tracking-wide">Completeness Alerts</span>
                      {suggestions.warnings.map((w: string, i: number) => (
                        <div key={i} className="p-3 bg-red-500/10 border border-red-900/50 text-red-400 text-[12px] rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Vendor Suggestions */}
              {context.module === 'vendors' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Data Transfer Guidance</span>
                    <p className="text-[12.5px] text-[#E6E8EA] leading-relaxed">{suggestions.transferGuidance}</p>
                  </div>

                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Compliance Risk Analysis</span>
                    <p className="text-[12.5px] text-[#E6E8EA] leading-relaxed">{suggestions.riskExplanation}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Recommended Compliance Steps</span>
                    <ul className="space-y-1.5">
                      {suggestions.complianceChecklist?.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-[12.5px] text-[#9BA1A6]">
                          <Check className="w-4 h-4 text-[#C9A227] mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Breach Suggestions */}
              {context.module === 'breaches' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Supervisory Authority notification</span>
                    <p className="text-[12.5px] text-[#E6E8EA] leading-relaxed">{suggestions.supervisoryAuthorityDecision}</p>
                  </div>

                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Affected Individuals notification</span>
                    <p className="text-[12.5px] text-[#E6E8EA] leading-relaxed">{suggestions.dataSubjectsDecision}</p>
                  </div>

                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">EDPB Breach Guidelines Context</span>
                    <p className="text-[12px] text-[#9BA1A6] leading-relaxed">{suggestions.guidelines}</p>
                  </div>

                  {suggestions.notificationTemplate && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Template Notification Language</span>
                      <pre className="bg-white/5 p-3 rounded-lg border border-white/10 text-[11.5px] text-[#E6E8EA] overflow-x-auto whitespace-pre-wrap font-mono max-h-48">
                        {suggestions.notificationTemplate}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* DSAR Suggestions */}
              {context.module === 'dsar' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-1">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Exercised Right Identified</span>
                    <span className="text-[13px] font-semibold text-[#F4F5F6]">{suggestions.rightType}</span>
                  </div>

                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Applicable Deadline Details</span>
                    <p className="text-[12.5px] text-[#E6E8EA] leading-relaxed">{suggestions.deadlineGuidance}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Suggested Data Packages</span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.suggestedData?.map((item: string, idx: number) => (
                        <span key={idx} className="bg-[#08090A] px-2 py-1 border border-white/5 text-[#E6E8EA] text-[12px] rounded-lg">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">GDPR Exemptions Checklist</span>
                    <ul className="space-y-1">
                      {suggestions.exemptions?.map((exemp: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-[12px] text-[#9BA1A6] leading-relaxed">
                          <Check className="w-3.5 h-3.5 text-[#C9A227] mt-0.5 shrink-0" />
                          <span>{exemp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Cookie Consent Suggestions */}
              {context.module === 'consent' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Cookie Compliance Scan Warning</span>
                    <p className="text-[12.5px] text-[#E6E8EA] leading-relaxed">{suggestions.cookieAnalysis}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Recommended Banner Actions</span>
                    <ul className="space-y-1.5">
                      {suggestions.actionSteps?.map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-[12.5px] text-[#9BA1A6]">
                          <Check className="w-4 h-4 text-[#C9A227] mt-0.5 shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Compliance Scoring / Gap Explanation */}
              {context.module === 'compliance_scoring' && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Regulatory Violation Explanation</span>
                    <p className="text-[12.5px] text-[#E6E8EA] leading-relaxed">{suggestions.violationExplanation}</p>
                  </div>

                  <div className="p-4 bg-[#08090A] rounded-xl border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Enforcement Precedent & Fines</span>
                    <p className="text-[12.5px] text-[#E6E8EA] leading-relaxed">{suggestions.riskLevelEnforcement}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#6E747A] uppercase tracking-wide block">Remediation Roadmap</span>
                    <ul className="space-y-1.5 mb-3">
                      {suggestions.remediationSteps?.map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-[12.5px] text-[#9BA1A6]">
                          <ArrowRight className="w-4 h-4 text-[#C9A227] mt-0.5 shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {suggestions.remediationLink && (
                      <a
                        href={suggestions.remediationLink}
                        onClick={closePanel}
                        className="w-full py-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors mt-2"
                      >
                        Resolve Gap <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Sources & Feedback Logging Card */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                
                {/* Confidence Meter */}
                <div className="flex items-center justify-between text-[11px] font-medium text-[#6E747A]">
                  <span>Confidence Level:</span>
                  <span className={`uppercase font-bold ${
                    confidence === 'high' ? 'text-[#C9A227]' :
                    confidence === 'medium' ? 'text-amber-400' :
                    'text-[#9BA1A6]'
                  }`}>{confidence}</span>
                </div>

                {/* Was this helpful feedback log */}
                <div className="bg-[#08090A] p-3.5 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="text-[12px] text-[#E6E8EA]">Was this advice helpful?</span>
                  <div className="flex items-center gap-1">
                    {feedbackSubmittedFor[logId || ''] ? (
                      <span className="text-[11px] text-[#C9A227] font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Thank you!
                      </span>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleFeedback(logId, 'helpful')}
                          disabled={feedbackMutation.isPending}
                          className="p-1.5 rounded hover:bg-white/10 text-[#6E747A] hover:text-[#F4F5F6] transition-colors"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleFeedback(logId, 'not_helpful')}
                          disabled={feedbackMutation.isPending}
                          className="p-1.5 rounded hover:bg-white/10 text-[#6E747A] hover:text-clay-600 transition-colors"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Sources References list */}
                {sources.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#6E747A] uppercase tracking-wide block">Sources & Citations</span>
                    <div className="text-[11px] space-y-1">
                      {sources.slice(0, 3).map((src: any, idx: number) => (
                        <div key={idx} className="truncate">
                          <a 
                            href={src.url || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[#C9A227] hover:underline hover:text-[#C9A227] font-medium"
                          >
                            [{idx + 1}] {src.title}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Follow-up Chat Area */}
          <div className="border-t border-white/10 pt-5 space-y-4">
            <h4 className="font-semibold text-[#F4F5F6] text-xs flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-[#C9A227]" />
              Ask follow-up questions
            </h4>

            {/* Conversation list */}
            <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`flex gap-2.5 ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {chat.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-[#C9A227]/10 border border-sage-100 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-[#C9A227]" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                    chat.role === 'user'
                      ? 'bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] rounded-tr-none'
                      : 'bg-white/5 text-[#E6E8EA] rounded-tl-none border border-white/5'
                  }`}>
                    {chat.role === 'user' ? chat.content : renderTextWithLinks(chat.content)}
                  </div>

                  {chat.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-[#9BA1A6]" />
                    </div>
                  )}
                </div>
              ))}
              
              {copilotMutation.isPending && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-[#C9A227]/10 border border-sage-100 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-[#C9A227]" />
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-none px-3 py-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-ink-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-ink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 bg-ink-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask follow-up..."
                disabled={copilotMutation.isPending}
                className="flex-1 bg-[#08090A] border border-white/10 rounded-xl px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || copilotMutation.isPending}
                className="bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] p-2 rounded-xl hover:bg-[#E5C463] transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </>
  );
}
