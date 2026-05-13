'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Award } from 'lucide-react';
import Link from 'next/link';

export default function LearnModulePage() {
  const params = useParams();
  const router = useRouter();
  const completionId = params.id as string;
  
  const { data: completions, isLoading } = trpc.training.myModules.useQuery();
  const trackProgress = trpc.training.trackProgress.useMutation();
  const submitQuiz = trpc.training.submitQuiz.useMutation();
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideStartTime, setSlideStartTime] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);

  const completion = completions?.find(c => c.id === completionId);
  const module = completion?.module as any;

  useEffect(() => {
    setSlideStartTime(Date.now());
    return () => {
      // Record time on unmount or slide change
      if (module && currentSlideIndex < module.content.length) {
        const slide = module.content[currentSlideIndex];
        const timeSpentMs = Date.now() - slideStartTime;
        if (timeSpentMs > 1000) {
          trackProgress.mutate({ completionId, slideId: slide.id, timeSpentMs });
        }
      }
    };
  }, [currentSlideIndex]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bone-50 flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!completion || !module) {
    return (
      <div className="min-h-screen bg-bone-50 flex flex-col items-center justify-center p-8">
        <p className="text-ink-600 mb-4">Module not found or not assigned to you.</p>
        <Link href="/training" className="text-indigo-600 hover:underline">Return to Training</Link>
      </div>
    );
  }

  const slides = module.content || [];
  const quiz = module.quiz;
  const isQuizPhase = currentSlideIndex === slides.length;
  const isFinished = currentSlideIndex > slides.length || quizSubmitted || completion.status === 'passed';

  const handleNext = () => {
    setCurrentSlideIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) setCurrentSlideIndex(prev => prev - 1);
  };

  const handleSubmitQuiz = async () => {
    try {
      const res = await submitQuiz.mutateAsync({ completionId, answers: quizAnswers });
      setQuizResult(res);
      setQuizSubmitted(true);
    } catch (e: any) {
      alert(e.message || 'Failed to submit quiz.');
    }
  };

  if (isFinished && (quizSubmitted || completion.status === 'passed')) {
    const passed = quizResult?.passed ?? completion.quizPassed;
    const score = quizResult?.score ?? completion.quizScore;
    
    return (
      <div className="min-h-screen bg-bone-50 flex flex-col items-center p-8">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-ink-900/10 p-12 text-center fade-in mt-12">
          <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-6 ${passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
            {passed ? <Award className="w-12 h-12" /> : <AlertCircle className="w-12 h-12" />}
          </div>
          
          <h1 className="text-3xl font-bold text-ink-900 mb-4">
            {passed ? 'Congratulations!' : 'Training Failed'}
          </h1>
          
          <p className="text-lg text-ink-600 mb-8">
            {passed 
              ? `You have successfully completed "${module.title}".` 
              : `You did not pass "${module.title}".`}
          </p>
          
          <div className="inline-flex flex-col items-center justify-center bg-bone-50 p-6 rounded-2xl mb-8 border border-ink-900/10">
            <span className="text-sm font-medium text-ink-500 uppercase tracking-wider mb-1">Final Score</span>
            <span className={`text-4xl font-bold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>{score}%</span>
            <span className="text-sm text-ink-500 mt-2">Required to pass: {module.passingScore}%</span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {passed ? (
              <button 
                className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                onClick={() => window.open(`/api/export/certificate?id=${completion.id}`, '_blank')}
              >
                Download Certificate
              </button>
            ) : (
              <button 
                className="w-full sm:w-auto px-8 py-3 bg-rose-600 text-white font-medium rounded-xl hover:bg-rose-700 transition-colors shadow-sm"
                onClick={() => router.push('/training')}
              >
                Return to Dashboard
              </button>
            )}
            <Link 
              href="/training" 
              className="w-full sm:w-auto px-8 py-3 bg-white border border-ink-900/10 text-ink-900 font-medium rounded-xl hover:bg-bone-50 transition-colors"
            >
              Back to Training
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round(((currentSlideIndex) / (slides.length + 1)) * 100);

  return (
    <div className="min-h-screen bg-bone-50 flex flex-col font-sans">
      <header className="h-16 px-6 bg-white border-b border-ink-900/10 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/training" className="text-ink-500 hover:text-ink-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-4 w-px bg-ink-900/10"></div>
          <h1 className="text-[15px] font-bold text-ink-900">{module.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-[12px] font-medium text-ink-500">
            <span>{progressPercent}% Complete</span>
          </div>
          <div className="w-32 h-2 bg-bone-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-3xl flex-1 flex flex-col">
          
          {!isQuizPhase ? (
            // SLIDE VIEW
            <div className="bg-white rounded-3xl shadow-sm border border-ink-900/10 p-8 sm:p-12 flex-1 flex flex-col fade-in relative overflow-hidden">
              {slides[currentSlideIndex].type === 'scenario' && (
                 <div className="absolute top-0 right-0 px-4 py-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-widest rounded-bl-xl border-l border-b border-indigo-100">
                   Scenario
                 </div>
              )}
              
              <h2 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-8 font-display">
                {slides[currentSlideIndex].title}
              </h2>

              <div className="flex-1 flex flex-col justify-center">
                {slides[currentSlideIndex].type === 'text' && (
                  <div className="prose prose-sage max-w-none text-ink-700 text-[16px] leading-relaxed">
                    <p>{slides[currentSlideIndex].content}</p>
                  </div>
                )}
                
                {slides[currentSlideIndex].type === 'key_point' && (
                  <div className="space-y-4">
                    {slides[currentSlideIndex].keyPoints?.map((kp: string, i: number) => (
                      <div key={i} className="flex items-start gap-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                        <CheckCircle className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                        <span className="text-[15px] font-medium text-indigo-900 leading-relaxed">{kp}</span>
                      </div>
                    ))}
                  </div>
                )}

                {slides[currentSlideIndex].type === 'scenario' && (
                  <div className="space-y-8">
                    <div className="text-[17px] text-ink-800 font-medium leading-relaxed bg-bone-50 p-6 rounded-2xl border border-ink-900/10">
                      {slides[currentSlideIndex].scenario?.situation}
                    </div>
                    <div className="space-y-3">
                      {slides[currentSlideIndex].scenario?.options.map((opt: any, i: number) => (
                        <ScenarioOption key={i} option={opt} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // QUIZ VIEW
            <div className="bg-white rounded-3xl shadow-sm border border-ink-900/10 p-8 sm:p-12 flex-1 flex flex-col fade-in">
              <div className="mb-8 border-b border-ink-900/10 pb-6 text-center">
                <h2 className="text-3xl font-bold text-ink-900 font-display">Knowledge Check</h2>
                <p className="text-ink-500 mt-2">Answer the following {quiz.questions.length} questions to complete the module.</p>
              </div>

              <div className="flex-1 space-y-12">
                {quiz.questions.map((q: any, i: number) => (
                  <div key={q.id} className="space-y-4">
                    <h3 className="text-[17px] font-bold text-ink-900 flex gap-3">
                      <span className="text-indigo-600">{i + 1}.</span> 
                      {q.question}
                    </h3>
                    <div className="space-y-2 pl-7">
                      {q.options.map((opt: any) => (
                        <label key={opt.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          quizAnswers[q.id] === opt.id 
                            ? 'border-indigo-500 bg-indigo-50/30 shadow-[0_0_0_1px_rgba(99,102,241,1)]' 
                            : 'border-ink-900/10 hover:border-ink-900/30 bg-white'
                        }`}>
                          <input 
                            type="radio" 
                            name={q.id} 
                            value={opt.id}
                            checked={quizAnswers[q.id] === opt.id}
                            onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt.id })}
                            className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-ink-900/20"
                          />
                          <span className="text-[15px] text-ink-800">{opt.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between shrink-0">
            <button 
              onClick={handlePrev}
              disabled={currentSlideIndex === 0}
              className="px-6 py-3 bg-white border border-ink-900/10 text-ink-900 text-[14px] font-medium rounded-xl hover:bg-bone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>
            
            {!isQuizPhase ? (
              <button 
                onClick={handleNext}
                className="px-8 py-3 bg-indigo-600 text-white text-[14px] font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={handleSubmitQuiz}
                disabled={Object.keys(quizAnswers).length < quiz.questions.length || submitQuiz.isPending}
                className="px-8 py-3 bg-emerald-600 text-white text-[14px] font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                {submitQuiz.isPending ? 'Grading...' : 'Submit Answers'}
              </button>
            )}
          </div>
          
        </div>
      </main>
    </div>
  );
}

// Helper component for Scenario interactive reveals
function ScenarioOption({ option }: { option: any }) {
  const [revealed, setRevealed] = useState(false);
  
  return (
    <div className="space-y-2 fade-in">
      <button 
        onClick={() => setRevealed(true)}
        disabled={revealed}
        className={`w-full text-left p-4 rounded-xl border transition-all ${
          revealed 
            ? (option.correct ? 'border-emerald-500 bg-emerald-50/50' : 'border-rose-500 bg-rose-50/50')
            : 'border-ink-900/10 hover:border-ink-900/30 hover:bg-white bg-white shadow-sm'
        }`}
      >
        <span className={`text-[15px] ${revealed ? (option.correct ? 'text-emerald-900 font-medium' : 'text-rose-900 opacity-50') : 'text-ink-800'}`}>
          {option.text}
        </span>
      </button>
      
      {revealed && (
        <div className={`p-4 rounded-xl text-[13.5px] leading-relaxed fade-in ${option.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          <strong>{option.correct ? 'Correct! ' : 'Incorrect. '}</strong>
          {option.explanation}
        </div>
      )}
    </div>
  );
}
