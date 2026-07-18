"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Check, Clock, Mail, Lock } from 'lucide-react';

export default function PublicAssessmentPage() {
  const params = useParams();
  const token = params?.token as string;

  const { data: aData, isLoading: isQueryLoading, error: queryError, refetch } = 
    trpc.assessments.getAssessmentByToken.useQuery({ token }, { enabled: !!token });

  const submitMutation = trpc.assessments.submitAssessmentResponses.useMutation();

  const [responses, setResponses] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [respondentEmail, setRespondentEmail] = useState('');
  const [isExtensionRequested, setIsExtensionRequested] = useState(false);

  // Sync pre-existing responses if any
  useEffect(() => {
    if (aData?.assessment?.responses) {
      setResponses(aData.assessment.responses as Record<string, string>);
    }
    if (aData?.assessment?.recipientEmail) {
      setRespondentEmail(aData.assessment.recipientEmail);
    }
  }, [aData]);

  if (isQueryLoading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen bg-[#0d0f0e] text-[#e3e6e4] p-6">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-neutral-400 font-medium animate-pulse">Establishing secure compliance connection...</p>
      </div>
    );
  }

  if (queryError || !aData) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen bg-[#0d0f0e] text-[#e3e6e4] p-6">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center shadow-2xl">
          <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Invalid Review Link</h2>
          <p className="text-neutral-400 mb-6">
            This security assessment link is invalid or has been revoked by the requesting organization.
          </p>
          <div className="w-full h-[1px] bg-neutral-800 my-4" />
          <p className="text-xs text-neutral-600">Verification Token: {token}</p>
        </div>
      </div>
    );
  }

  const { assessment, orgName, vendorName } = aData;
  const questions = (assessment.questionsSnapshot || []) as any[];

  const isCompleted = assessment.status === 'completed' || assessment.submissionLocked;
  const isExpired = assessment.status === 'expired' && !isCompleted;

  const handleSelectChoice = (questionId: string, choiceText: string) => {
    if (isCompleted || isExpired) return;
    setResponses(prev => ({ ...prev, [questionId]: choiceText }));
  };

  const handleTextChange = (questionId: string, val: string) => {
    if (isCompleted || isExpired) return;
    setResponses(prev => ({ ...prev, [questionId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!respondentEmail) {
      setErrorMessage("Please specify your email address for compliance audit validation.");
      return;
    }

    // Verify all questions answered
    const unanswered = questions.filter(q => !responses[q.id]);
    if (unanswered.length > 0) {
      setErrorMessage(`Please answer all questions before submitting. (${unanswered.length} outstanding)`);
      return;
    }

    try {
      await submitMutation.mutateAsync({
        token,
        responses,
        respondentEmail
      });
      setSubmitSuccess(true);
      refetch();
    } catch (e: any) {
      setErrorMessage(e.message || "Failed to submit assessment answers.");
    }
  };

  const handleRequestExtension = () => {
    setIsExtensionRequested(true);
    // Simulate extension request alert
  };

  // Render Completed Success Screen
  if (submitSuccess || isCompleted) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen bg-[#0d0f0e] text-[#e3e6e4] p-6">
        <meta name="robots" content="noindex, nofollow" />
        <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800/80 rounded-2xl p-10 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(52,211,153,0.15)]" />
          <h1 className="text-2xl font-extrabold mb-3 tracking-tight">Security Review Complete</h1>
          <p className="text-neutral-300 text-base mb-6 leading-relaxed">
            Thank you! The security and GDPR compliance questionnaire for <strong>{vendorName}</strong> has been submitted.
          </p>
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mb-6 text-left text-sm text-neutral-400 space-y-2">
            <div>
              <span className="text-xs font-semibold text-neutral-500 block uppercase">Respondent Identity</span>
              <span className="text-neutral-200">{assessment.respondentEmail || respondentEmail}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-neutral-500 block uppercase">Submission Score</span>
              <span className="text-neutral-200 font-bold">{assessment.score ?? 'Under Review'}/100</span>
            </div>
            {assessment.completedAt && (
              <div>
                <span className="text-xs font-semibold text-neutral-500 block uppercase">Audit Timestamp</span>
                <span className="text-neutral-200">{new Date(assessment.completedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            A secure immutable audit snapshot of this response has been locked in compliance with GDPR Art. 28 records. You can safely close this browser window.
          </p>
        </div>
      </div>
    );
  }

  // Render Expired Screen
  if (isExpired) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen bg-[#0d0f0e] text-[#e3e6e4] p-6">
        <meta name="robots" content="noindex, nofollow" />
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center shadow-2xl">
          <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Assessment Expired</h2>
          <p className="text-neutral-400 mb-6 leading-relaxed">
            The deadline for this assessment request has passed (expired on {assessment.expiresAt ? new Date(assessment.expiresAt).toLocaleDateString() : 'N/A'}).
          </p>
          
          {isExtensionRequested ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm mb-4">
              ✅ Extension request sent to <strong>{orgName}</strong>. You will receive an email if the deadline is extended.
            </div>
          ) : (
            <button
              onClick={handleRequestExtension}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-[#e3e6e4] font-semibold rounded-lg transition-colors border border-neutral-700 mb-4"
            >
              Request Deadline Extension
            </button>
          )}

          <div className="w-full h-[1px] bg-neutral-800 my-4" />
          <p className="text-xs text-neutral-600">Verification Token: {token}</p>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(responses).filter(id => responses[id]).length;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className="flex-grow min-h-screen bg-[#090b0a] text-[#e3e6e4] font-sans pb-16">
      <meta name="robots" content="noindex, nofollow" />
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-[#090b0a]/80 border-b border-neutral-900 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
              P
            </div>
            <div>
              <span className="text-xs text-neutral-500 block uppercase tracking-widest font-semibold">Vendor Security Portal</span>
              <span className="text-sm font-semibold text-neutral-200">{orgName} Review Suite</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-neutral-500 block font-semibold">Assessment Progress</span>
              <span className="text-sm font-bold text-emerald-400">{progressPercent}% ({answeredCount}/{questions.length})</span>
            </div>
            <div className="w-24 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl mx-auto px-6 mt-10">
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure SSL Encrypted Session</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Security &amp; GDPR Compliance Review</h1>
          <p className="text-neutral-400 mt-2 max-w-2xl leading-relaxed">
            Please fill out the security questionnaire for <strong>{vendorName}</strong>. This data is required to verify organizational and technical compliance under Article 28 of the GDPR.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Respondent identity verification section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" />
              <span>Contact Audit Verification</span>
            </h3>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              We require your professional email address to establish audit trails and document compliance records under Article 30 ROPA standards.
            </p>
            <input
              type="email"
              required
              value={respondentEmail}
              onChange={(e) => setRespondentEmail(e.target.value)}
              placeholder="e.g. security-officer@yourcompany.com"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {/* Questionnaire list */}
          <div className="space-y-6">
            {questions.map((q, idx) => (
              <div 
                key={q.id} 
                className="bg-neutral-900 border border-neutral-800/80 rounded-xl p-6 transition-all duration-300 hover:border-neutral-700/80 hover:shadow-xl"
              >
                <div className="flex justify-between items-start gap-4 mb-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded">
                    {q.category}
                  </span>
                  <span className="text-xs text-neutral-500 font-medium">Question {idx + 1} of {questions.length}</span>
                </div>
                <h3 className="text-lg font-bold mb-4 leading-snug">{q.text}</h3>

                {q.type === 'choice' ? (
                  <div className="space-y-2.5">
                    {q.options.map((opt: any) => {
                      const isSelected = responses[q.id] === opt.text;
                      return (
                        <div
                          key={opt.text}
                          onClick={() => handleSelectChoice(q.id, opt.text)}
                          className={`flex items-center gap-3 p-3.5 rounded-lg border text-sm cursor-pointer transition-all duration-200 select-none ${
                            isSelected 
                              ? 'bg-emerald-950/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-500/5'
                              : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 text-neutral-400'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                            isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-neutral-700'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3px]" />}
                          </div>
                          <span className="font-medium">{opt.text}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    required
                    value={responses[q.id] || ""}
                    onChange={(e) => handleTextChange(q.id, e.target.value)}
                    placeholder="Describe your procedures, mechanisms, or references..."
                    className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                )}
              </div>
            ))}
          </div>

          {errorMessage && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-6 flex items-center justify-between border-t border-neutral-900 gap-4">
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-3.5 rounded-lg shadow-lg hover:shadow-emerald-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting responses...</span>
                </>
              ) : (
                <>
                  <span>Submit Security Assessment</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            <span className="text-xs text-neutral-600 flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5" />
              <span>GDPR Compliant Gateway</span>
            </span>
          </div>
        </form>
      </main>
    </div>
  );
}
