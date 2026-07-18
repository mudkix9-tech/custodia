"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { ShieldCheck, Upload, FileText, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Check } from 'lucide-react';

interface QuestionAnswer {
  questionId: string;
  textAnswer: string;
}

export default function PublicQuestionnairePage() {
  const params = useParams();
  const token = params?.token as string;

  const { data: qData, isLoading: isQueryLoading, error: queryError, refetch } = 
    trpc.vendors.getQuestionnaireByToken.useQuery({ token }, { enabled: !!token });

  const submitMutation = trpc.vendors.submitQuestionnaireAnswers.useMutation();
  const parseMutation = trpc.ai.parseVendorAnswers.useMutation();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Sync loaded answers
  useEffect(() => {
    if (qData?.answers) {
      const answersMap: Record<string, string> = {};
      qData.answers.forEach((ans: any) => {
        answersMap[ans.questionId] = ans.textAnswer;
      });
      setAnswers(answersMap);
    }
  }, [qData]);

  if (isQueryLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 p-6">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-neutral-400 font-medium animate-pulse">Loading secure questionnaire...</p>
      </div>
    );
  }

  if (queryError || !qData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 p-6">
        <div className="w-full max-w-md bg-neutral-800 border border-neutral-700 rounded-2xl p-8 text-center shadow-2xl">
          <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Link Expired or Invalid</h2>
          <p className="text-neutral-400 mb-6">
            This vendor questionnaire link is invalid, expired, or has been revoked by the sender.
          </p>
          <div className="w-full h-[1px] bg-neutral-700 my-4" />
          <p className="text-xs text-neutral-500">Secure validation token: {token}</p>
        </div>
      </div>
    );
  }

  const isCompletedOrSubmitted = qData.status === 'submitted' || qData.status === 'reviewed';

  if (submitSuccess || isCompletedOrSubmitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 p-6">
        <div className="w-full max-w-lg bg-neutral-800 border border-neutral-700/80 rounded-2xl p-10 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <CheckCircle2 className="w-20 h-20 text-emerald-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(52,211,153,0.2)]" />
          <h1 className="text-3xl font-extrabold mb-3 tracking-tight">Response Submitted</h1>
          <p className="text-neutral-300 text-lg mb-6 leading-relaxed">
            Thank you! Your privacy and security response for <span className="font-semibold text-emerald-400">{qData.vendorName}</span> has been securely submitted.
          </p>
          <p className="text-sm text-neutral-400">
            The requesting organization has been notified and will review your compliance details shortly. You may close this window.
          </p>
          <div className="mt-8 pt-6 border-t border-neutral-700/50 flex justify-center gap-6 text-xs text-neutral-500">
            <span>Secure SSL Encrypted</span>
            <span>•</span>
            <span>GDPR Compliant Ingestion</span>
          </div>
        </div>
      </div>
    );
  }

  const handleTextChange = (qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setErrorMessage("Only PDF documents are supported for AI auto-filling.");
      return;
    }

    setErrorMessage(null);
    setUploadProgress("Reading document content...");
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setUploadProgress("AI is analyzing document and drafting answers...");

        try {
          const result = await parseMutation.mutateAsync({
            token,
            fileBase64: base64
          });

          // Pre-fill answers from response
          const newAnswers: Record<string, string> = { ...answers };
          if (result.answersReview) {
            qData.questions.forEach((q: any) => {
              const matchingReview = result.answersReview.find((r: any) => r.questionId === q.id);
              if (matchingReview && matchingReview.analysis) {
                newAnswers[q.id] = `[AI Drafted] we verify that: ${matchingReview.gapIdentified || matchingReview.analysis}`;
              }
            });
            setAnswers(newAnswers);
          }

          setUploadProgress(null);
        } catch (e: any) {
          setErrorMessage(e.message || "Failed to process PDF file.");
          setUploadProgress(null);
        }
      };
    } catch (e: any) {
      setErrorMessage("Failed to read file.");
      setUploadProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const formattedAnswers: QuestionAnswer[] = qData.questions.map((q: any) => ({
      questionId: q.id,
      textAnswer: answers[q.id] || ""
    }));

    try {
      await submitMutation.mutateAsync({
        token,
        answers: formattedAnswers
      });
      setSubmitSuccess(true);
    } catch (e: any) {
      setErrorMessage(e.message || "Failed to submit answers.");
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      {/* LEFT FORM SIDE */}
      <div className="flex-1 p-8 md:p-12 overflow-y-auto max-w-4xl border-r border-neutral-800">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Partner Assessment Portal</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Security & Privacy Assessment</h1>
          <p className="text-neutral-400 mt-2">
            Please complete the following compliance details for <span className="font-semibold text-neutral-200">{qData.vendorName}</span>. Your answers will assist in finalizing our Data Processing Agreement (DPA) reviews.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {qData.questions.map((q: any, idx: number) => (
            <div key={q.id} className="bg-neutral-900 border border-neutral-800/80 rounded-xl p-6 transition-all duration-300 hover:border-neutral-700/80 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              <div className="flex justify-between items-start gap-4 mb-3">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">
                  Q {idx + 1} • {q.category}
                </span>
              </div>
              <h3 className="text-lg font-bold mb-2 leading-snug">{q.text}</h3>
              <p className="text-xs text-neutral-400 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 mb-4 italic leading-relaxed">
                <span className="font-semibold text-emerald-500/80 not-italic uppercase tracking-wider text-[10px] mr-1">Rationale:</span>
                {q.rationale}
              </p>
              <textarea
                value={answers[q.id] || ""}
                onChange={(e) => handleTextChange(q.id, e.target.value)}
                placeholder="Provide details, policies, or explanations..."
                className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                required
              />
            </div>
          ))}

          {errorMessage && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-4 flex items-center justify-between border-t border-neutral-900">
            <button
              type="submit"
              disabled={submitMutation.isPending || parseMutation.isPending}
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
            <span className="text-xs text-neutral-500">🔒 AES-256 Encrypted Ingestion</span>
          </div>
        </form>
      </div>

      {/* RIGHT AI UPLOADER SIDE */}
      <div className="w-full md:w-96 p-8 bg-neutral-900/50 flex flex-col justify-between border-t md:border-t-0 border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xl font-bold">AI Autocomplete</h2>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed mb-6">
            Upload your completed security questionnaire, SOC 2 report, or privacy policy (PDF). Claude AI will parse the document and draft responses for each field.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-300 min-h-64 ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(52,211,153,0.05)]' 
                : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 hover:bg-neutral-950/60'
            }`}
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <input
              type="file"
              id="file-upload-input"
              className="hidden"
              accept=".pdf"
              onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
            />

            {uploadProgress ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                <p className="text-sm text-neutral-300 font-semibold">{uploadProgress}</p>
                <p className="text-xs text-neutral-500 mt-2">This may take 10-15 seconds...</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-emerald-500/10 rounded-full mb-4 text-emerald-400 border border-emerald-500/20 shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold mb-1">Drag & drop your security PDF</p>
                <p className="text-xs text-neutral-500">or click to browse from files</p>
                <span className="text-[10px] mt-4 text-neutral-600 bg-neutral-950 border border-neutral-900 px-2 py-0.5 rounded">
                  PDF format only • Max 15MB
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">How it works</h4>
          <ul className="text-xs text-neutral-500 space-y-2.5 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0">1</span>
              <span>Upload any document containing your security controls.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0">2</span>
              <span>Claude drafts answers into the form fields.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0">3</span>
              <span>Review, edit, and click Submit to finalize.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
