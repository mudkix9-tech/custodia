"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/utils/trpc';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { evaluateDependsOn } from '@/utils/assessment';
import { setCookie, getCookie } from 'cookies-next';

function AssessmentEngineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(-1); // -1 is intro
  const [answers, setAnswers] = useState<Record<string, { text: string; riskWeight?: number }>>({});
  const [isResumed, setIsResumed] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  // TRPC Hooks
  const trpcUtils = trpc.useUtils();
  const { data: questions, isLoading: isLoadingQuestions } = trpc.assessments.getQuestions.useQuery();
  const { data: resumeData, isLoading: isLoadingResume } = trpc.assessments.resumeAssessment.useQuery(undefined, {
    retry: false,
    staleTime: 0,
  });
  
  const startMutation = trpc.assessments.startAssessment.useMutation();
  const submitAnswerMutation = trpc.assessments.submitAnswer.useMutation();
  const calculateMutation = trpc.assessments.calculateResults.useMutation();

  useEffect(() => {
    // Generate anon session ID if it doesn't exist
    let sessionId = getCookie('pvr_anon_session');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setCookie('pvr_anon_session', sessionId, { maxAge: 60 * 60 * 24 * 30 }); // 30 days
    }

    if (resumeData?.assessment && resumeData.assessment.status === 'in_progress' && questions && !hasStarted) {
      setTimeout(() => {
        setAssessmentId(resumeData.assessment.id);
        setAnswers(resumeData.answers as Record<string, { text: string; riskWeight?: number }> || {});
        
        // Determine what step they were on
        let lastUnansweredIndex = 0;
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (!resumeData.answers?.[q.id]) {
            lastUnansweredIndex = i;
            break;
          }
        }
        
        setCurrentStep(lastUnansweredIndex);
        setIsResumed(true);
        setHasStarted(true);
      }, 0);
    }
  }, [resumeData, questions, hasStarted]);

  // Prefill from URL Search Parameters
  useEffect(() => {
    if (questions && !hasStarted) {
      const jurisdiction = searchParams?.get('jurisdiction');
      const ropa = searchParams?.get('ropa');
      const cookies = searchParams?.get('cookies');
      const special = searchParams?.get('special');
      
      if (jurisdiction || ropa || cookies || special) {
        const prefilled: Record<string, { text: string; riskWeight?: number }> = {};
        
        for (const q of questions) {
          const typedOptions = q.options as Array<{ text: string; riskWeight?: number }>;
          
          if (special && q.questionText.includes('special categories')) {
            const option = typedOptions.find(o => special === 'yes' ? o.text.includes('Yes') : o.text.includes('We don\'t process'));
            if (option) prefilled[q.id] = option;
          }
          
          if (cookies && q.questionText.includes('cookie consent banner')) {
            const option = typedOptions.find(o => cookies === 'automated' || cookies === 'basic' ? o.text === 'Yes' : o.text === 'No');
            if (option) prefilled[q.id] = option;
          }
          if (cookies && q.questionText.includes('reject all non-essential cookies')) {
            const option = typedOptions.find(o => cookies === 'automated' ? o.text === 'Yes' : o.text.includes('No'));
            if (option) prefilled[q.id] = option;
          }

          if (ropa && q.questionText.includes('exactly what personal data your organization collects')) {
            const option = typedOptions.find(o => ropa === 'yes' ? o.text.includes('fully') : o.text.includes('No') || o.text.includes('Partially'));
            if (option) prefilled[q.id] = option;
          }
          if (ropa && q.questionText.includes('places where personal data lives')) {
            const option = typedOptions.find(o => ropa === 'yes' ? o.text.includes('fully') : o.text.includes('No') || o.text.includes('Partially'));
            if (option) prefilled[q.id] = option;
          }
        }
        
        if (Object.keys(prefilled).length > 0) {
          setTimeout(() => {
            setAnswers(prev => ({ ...prev, ...prefilled }));
          }, 0);
        }
      }
    }
  }, [questions, searchParams, hasStarted]);

  const handleStart = async () => {
    try {
      const result = await startMutation.mutateAsync();
      setAssessmentId(result.id);
      setCurrentStep(0);
      setHasStarted(true);
    } catch (err) {
      console.error("Failed to start assessment:", err);
      // Fallback for development if DB is not running
      setAssessmentId("mock-id");
      setCurrentStep(0);
      setHasStarted(true);
    }
  };

  const handleSelectOption = async (
    question: { id: string }, 
    option: { text: string; riskWeight?: number }
  ) => {
    // Optimistically save locally
    const newAnswers = { ...answers, [question.id]: option };
    setAnswers(newAnswers);
    
    // Save to backend immediately and wait for it to commit to ensure consistency
    if (assessmentId && assessmentId !== "mock-id") {
      await submitAnswerMutation.mutateAsync({
        assessmentId,
        questionId: question.id,
        selectedOption: option.text,
        riskScore: option.riskWeight ?? 0,
      });
    }

    // Auto-advance logic with dependsOn
    if (questions) {
      let nextStep = currentStep + 1;
      
      // Find the next question that satisfies its dependsOn condition
      while (nextStep < questions.length) {
        const nextQ = questions[nextStep];
        if (evaluateDependsOn(nextQ.dependsOn as Parameters<typeof evaluateDependsOn>[0], newAnswers)) {
          break;
        }
        nextStep++;
      }

      setTimeout(async () => {
        if (nextStep < questions.length) {
          setCurrentStep(nextStep);
        } else {
          // Finished! Calculate results and redirect
          if (assessmentId && assessmentId !== "mock-id") {
            const result = await calculateMutation.mutateAsync({ assessmentId });
            // Pre-populate the cache to prevent read-replica race conditions
            trpcUtils.assessments.getResults.setData(
              { assessmentId },
              { 
                assessment: { overallScore: result.score, id: assessmentId, status: 'calculated' } as any, 
                actionItems: result.actionItems 
              }
            );
          }
          router.push(`/assessment/results?id=${assessmentId}`);
        }
      }, 400);
    }
  };

  if (isLoadingQuestions || isLoadingResume) {
    return (
      <div className="min-h-screen bg-bone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    );
  }

  // Filter out questions that don't meet dependsOn so progress bar is accurate (approximate)
  const displayQuestions = questions || [];
  
  // Calculate true progress
  let answeredCount = 0;
  let totalApplicableCount = 0;
  
  if (questions) {
    for (const q of questions) {
      if (evaluateDependsOn(q.dependsOn as Parameters<typeof evaluateDependsOn>[0], answers)) {
        totalApplicableCount++;
        if (answers[q.id]) {
          answeredCount++;
        }
      }
    }
  }

  const progress = totalApplicableCount > 0 
    ? Math.max(0, (answeredCount / totalApplicableCount) * 100) 
    : 0;

  return (
    <>
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-bone-50 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-sage-700 rounded-lg flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-serif text-ink-900">Privaro</span>
        </Link>
        <div className="flex items-center gap-6">
          {isResumed && currentStep >= 0 && (
            <span className="text-[13px] text-sage-600 font-medium bg-sage-50 px-3 py-1 rounded-full hidden sm:inline-block">
              Welcome back — continuing where you left off
            </span>
          )}
          {currentStep >= 0 && (
            <Link href="/" className="text-[13px] text-ink-500 hover:text-ink-900 font-medium transition-colors">
              Save and exit
            </Link>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      {currentStep >= 0 && (
        <div className="w-full h-1.5 bg-bone-100">
          <motion.div 
            className="h-full bg-sage-500 rounded-r-full" 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <AnimatePresence mode="wait">
          
          {/* Intro Screen */}
          {currentStep === -1 && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl text-center"
            >
              <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-500/20 rounded-full px-4 py-1.5 mb-8 text-[13px] font-medium text-sage-700">
                Takes 3 minutes • Actionable Results
              </div>
              <h1 className="text-4xl md:text-5xl font-serif text-ink-900 tracking-tight mb-6">
                Find out your agency&apos;s GDPR risk score.
              </h1>
              <p className="text-[16px] text-ink-600 mb-10 leading-relaxed max-w-xl mx-auto">
                Answer a few quick questions to identify compliance gaps in your vendor stack, data workflows, and security posture. Get a free, actionable roadmap immediately.
              </p>
              <button 
                onClick={handleStart}
                disabled={startMutation.isPending}
                className="bg-sage-700 hover:bg-sage-600 text-bone-50 text-[15px] font-medium py-3.5 px-8 rounded-xl transition-all flex items-center justify-center gap-2 mx-auto shadow-card disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-white touch-manipulation"
              >
                {startMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Start Assessment <ArrowRight className="w-4 h-4" /></>}
              </button>
            </motion.div>
          )}

          {/* Question Screen */}
          {currentStep >= 0 && currentStep < displayQuestions.length && (
            <motion.div
              key={displayQuestions[currentStep].id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl"
            >
              <div className="mb-4 text-[13px] font-semibold text-sage-600 uppercase tracking-widest">
                {displayQuestions[currentStep].category}
              </div>
              <h2 className="text-2xl md:text-3xl font-serif text-ink-900 mb-10 leading-snug">
                {displayQuestions[currentStep].questionText}
              </h2>

              <div className="space-y-3">
                {(displayQuestions[currentStep].options as Array<{ text: string; riskWeight?: number }>).map((option, i) => {
                  const isSelected = answers[displayQuestions[currentStep].id]?.text === option.text;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSelectOption(displayQuestions[currentStep], option)}
                      className={`w-full cursor-pointer text-left p-5 rounded-xl border transition-all duration-200 flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-white touch-manipulation ${
                        isSelected 
                          ? 'border-sage-500 bg-sage-50 shadow-sm' 
                          : 'border-ink-900/10 bg-white hover:border-ink-900/20 hover:bg-bone-50'
                      }`}
                    >
                      <span className={`text-[15px] font-medium ${isSelected ? 'text-sage-700' : 'text-ink-700 group-hover:text-ink-900'}`}>
                        {option.text}
                      </span>
                      {isSelected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <div className="w-6 h-6 rounded-full bg-sage-600 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Navigation Arrows */}
              <div className="mt-10 flex justify-between items-center">
                <button 
                  onClick={() => {
                    // Find previous applicable step
                    let prevStep = currentStep - 1;
                    while (prevStep >= 0) {
                      if (evaluateDependsOn(displayQuestions[prevStep].dependsOn as Parameters<typeof evaluateDependsOn>[0], answers)) {
                        break;
                      }
                      prevStep--;
                    }
                    setCurrentStep(Math.max(0, prevStep));
                  }}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-2 text-[13.5px] font-medium transition-colors ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-ink-500 hover:text-ink-900'}`}
                >
                  <ArrowLeft className="w-4 h-4" /> Previous Question
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </>
  );
}

export default function AssessmentEngine() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
      </div>
    }>
      <AssessmentEngineContent />
    </Suspense>
  );
}
