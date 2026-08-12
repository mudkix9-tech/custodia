"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '@/utils/trpc';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { assessmentTemplates } from 'db';
import { Logo } from '@/components/marketing/MarketingHeader';
import { evaluateDependsOn } from '@/utils/assessment';
import { saveLeadAssessment } from '@/actions/lead-assessment';

const CATEGORY_ORDER = [
  'Data Mapping', 'Datenkartierung', 'Cartographie des données',
  'Lawful Basis', 'Rechtsgrundlage', 'Base légale',
  'Vendor Management', 'Anbietermanagement', 'Gestion des fournisseurs',
  'Data Subject Rights', 'Betroffenenrechte', 'Droits des personnes concernées',
  'Security', 'Sicherheit', 'Sécurité',
  'Privacy Notices', 'Datenschutzerklärungen', 'Avis de confidentialité',
  'Cookie Consent', 'Cookie-Einwilligung', 'Consentement aux cookies',
  'Governance', 'Governance', 'Gouvernance',
  'Client Compliance', 'Kunden-Compliance', 'Conformité client'
];

const DELIVERABLES = [
  { index: '01', title: 'A scored readiness figure', body: 'One number, benchmarked against comparable EU agencies.' },
  { index: '02', title: 'Every gap mapped to its article', body: 'Findings cite the provision they fail, not a vague category.' },
  { index: '03', title: 'Severity per finding', body: 'So you can tell what needs attention this quarter from what can wait.' },
  { index: '04', title: 'A category-by-category breakdown', body: 'Records, consent, vendors, security and more, scored independently.' },
];

const ARTICLES = ['Art. 5', 'Art. 6', 'Art. 7', 'Art. 9', 'Art. 13–14', 'Art. 15–22', 'Art. 28', 'Art. 30', 'Art. 32–34', 'Art. 44–46'];

export type AssessmentQuestion = typeof assessmentTemplates.$inferSelect;

/** Read-only entry parameters, resolved on the server so this component needs no
 *  useSearchParams(). That hook opts its nearest Suspense boundary out of SSR, which
 *  is what left /assessment server-rendering an empty spinner. */
export type AssessmentEntryParams = {
  jurisdiction?: string;
  ropa?: string;
  cookies?: string;
  special?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export default function AssessmentClient({
  initialQuestions,
  entry,
}: {
  initialQuestions: AssessmentQuestion[];
  entry: AssessmentEntryParams;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(-1); // -1 is intro
  const [answers, setAnswers] = useState<Record<string, { text: string }>>({});
  const [isResumed, setIsResumed] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [savedSessionExists, setSavedSessionExists] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const t = useTranslations('marketing.assessmentFlow');

  // Seeded from the server fetch, so the first paint already has the real
  // questions rather than a loading state. An empty array means the server fetch
  // failed, so leave initialData unset and let the query run normally rather than
  // pinning the cache to nothing.
  const { data: questions, isLoading: isLoadingQuestions } = trpc.assessments.getQuestions.useQuery(
    undefined,
    initialQuestions.length > 0 ? { initialData: initialQuestions as never } : undefined
  );

  useEffect(() => {
    // Check local storage for existing session
    const saved = localStorage.getItem('pvr_assessment_answers');
    if (saved && !hasStarted) {
      setSavedSessionExists(true);
    }
  }, [hasStarted]);

  // Save to local storage whenever answers change (if started)
  useEffect(() => {
    if (hasStarted) {
      localStorage.setItem('pvr_assessment_answers', JSON.stringify(answers));
    }
  }, [answers, hasStarted]);

  // Prefill from URL Search Parameters
  useEffect(() => {
    if (questions && !hasStarted && !savedSessionExists) {
      const jurisdiction = entry.jurisdiction;
      const ropa = entry.ropa;
      const cookies = entry.cookies;
      const special = entry.special;

      if (jurisdiction || ropa || cookies || special) {
        const prefilled: Record<string, { text: string }> = {};

        for (const q of questions) {
          const typedOptions = q.options as Array<{ text: string }>;

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
  }, [questions, entry, hasStarted, savedSessionExists]);

  const handleStartFresh = () => {
    localStorage.removeItem('pvr_assessment_answers');
    setAnswers({});
    setCurrentStep(0);
    setHasStarted(true);
    setSavedSessionExists(false);
  };

  const handleResume = () => {
    const saved = localStorage.getItem('pvr_assessment_answers');
    if (saved && questions) {
      try {
        const parsed = JSON.parse(saved);
        setAnswers(parsed);
        // Determine what step they were on
        let lastUnansweredIndex = 0;
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (!parsed[q.id]) {
            lastUnansweredIndex = i;
            break;
          }
        }
        setCurrentStep(lastUnansweredIndex);
        setIsResumed(true);
        setHasStarted(true);
        setSavedSessionExists(false);
      } catch (e) {
        handleStartFresh();
      }
    } else {
      handleStartFresh();
    }
  };

  const handleSelectOption = async (
    question: { id: string },
    option: { text: string }
  ) => {
    if (isAdvancing || isSubmitting) return;
    setIsAdvancing(true);

    const newAnswers = { ...answers, [question.id]: option };
    setAnswers(newAnswers);

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
          setIsAdvancing(false);
        } else {
          // Finished! Submit to Server Action
          setIsSubmitting(true);
          try {
            const finalPayload = Object.entries(newAnswers).map(([qId, opt]: [string, any]) => ({
              questionId: qId,
              selectedOption: opt.originalText || opt.text
            }));

            const result = await saveLeadAssessment({
              answers: finalPayload,
              locale: locale,
              utmSource: entry.utmSource,
              utmMedium: entry.utmMedium,
              utmCampaign: entry.utmCampaign,
            });

            localStorage.removeItem('pvr_assessment_answers');
            router.push(`/assessment/results?id=${result.leadId}`);
          } catch (error) {
            console.error("Failed to save assessment:", error);
            alert("Failed to submit assessment. Please try again.");
            setIsSubmitting(false);
            setIsAdvancing(false);
          }
        }
      }, 400);
    }
  };

  const displayQuestions = (questions || []).map((q) => {
    const t = (q.translations as Record<string, any>)?.[locale];
    if (t) {
      return {
        ...q,
        questionText: t.questionText || q.questionText,
        category: t.category || q.category,
        options: t.options ? t.options.map((to: any, idx: number) => ({
          ...to,
          originalText: (q.options as any[])[idx]?.text
        })) : q.options
      };
    }
    return {
      ...q,
      options: (q.options as any[]).map(o => ({ ...o, originalText: o.text }))
    };
  });

  // Distinct categories present, in canonical order
  const presentCategories = CATEGORY_ORDER.filter((cat) => displayQuestions.some((q) => q.category === cat));
  const categories = presentCategories.length > 0 ? presentCategories : Array.from(new Set(displayQuestions.map((q) => q.category)));

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

  const currentQuestion = currentStep >= 0 && currentStep < displayQuestions.length ? displayQuestions[currentStep] : null;
  const currentCategoryIndex = currentQuestion ? categories.indexOf(currentQuestion.category) : -1;

  useEffect(() => {
    if (!currentQuestion || isAdvancing || isSubmitting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const options = currentQuestion.options as Array<{ text: string }>;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        handleSelectOption(currentQuestion, options[n - 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, isAdvancing, isSubmitting]);

  // The intro screen only needs two counts from the query, so it is rendered
  // immediately rather than behind a loading gate. Returning a bare spinner here
  // meant the server-rendered HTML for /assessment — the destination of every
  // primary CTA on the marketing site — contained no text at all: nothing for a
  // crawler, no link preview, and an empty screen on the highest-intent click.
  const questionsReady = !isLoadingQuestions && displayQuestions.length > 0;

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-[14px] bg-surface-base/85 border-b border-white/7 flex-none">
        <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center gap-5">
          <Logo />
          <span className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-text-subtle border-l border-white/12 pl-5 hidden sm:inline">
            {t('headerBadge')}
          </span>
          <span className="flex-1" />
          {isResumed && currentStep >= 0 && (
            <span className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.06em] text-accent-gold hidden sm:inline">
              {t('resumed')}
            </span>
          )}
          <span className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.1em] text-text-subtle whitespace-nowrap">
            {currentStep >= 0
              ? t('answered', { answered: answeredCount, total: totalApplicableCount })
              : t('unanswered')}
          </span>
        </div>
        <div className="h-0.5 bg-white/6">
          <div
            className="h-0.5 bg-accent-gold transition-[width] duration-500 ease-out"
            style={{ width: currentStep === -1 ? '0%' : `${progress}%` }}
          />
        </div>
      </header>

      <main className="flex-1 relative">
        <AnimatePresence mode="wait">

          {/* Intro Screen */}
          {currentStep === -1 && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden"
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(110%_70%_at_50%_0%,#000_15%,transparent_72%)]"
              />
              <div
                aria-hidden="true"
                className="absolute -top-[220px] left-1/2 -translate-x-1/2 w-[820px] h-[480px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(201,162,39,0.15),transparent_70%)]"
              />
              <div className="relative max-w-[1120px] mx-auto px-6 py-20 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
                <div>
                  {/* Height is reserved so the counts arriving does not shift the headline. */}
                  <div className="flex items-center gap-3 min-h-[1.1em] [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.16em] uppercase text-accent-gold">
                    <span className="w-6 h-px bg-accent-gold" />
                    {questionsReady && (
                      <span>{t('introReqs', { reqs: displayQuestions.length, categories: categories.length })}</span>
                    )}
                  </div>
                  <h1 className="mt-6 text-[34px] sm:text-[44px] lg:text-[54px] leading-[1.06] tracking-[-0.032em] font-normal text-text-heading text-balance">
                    {t('introTitle')}
                  </h1>
                  <p className="mt-6 max-w-[540px] text-[17.5px] leading-[1.65] text-text-muted">
                    {t('introDesc', { reqs: displayQuestions.length })}
                  </p>
                  <div className="mt-9 flex flex-wrap gap-3.5 items-center">
                    {savedSessionExists ? (
                      <>
                        <button
                          onClick={handleResume}
                          disabled={!questionsReady}
                          className="[font-family:var(--font-plex-sans)] text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-6 py-3.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {t('resumeBtn')}
                        </button>
                        <button
                          onClick={handleStartFresh}
                          disabled={!questionsReady}
                          className="[font-family:var(--font-plex-sans)] text-[15px] text-text-muted hover:text-text-primary border border-white/16 hover:border-white/30 px-[22px] py-3.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {t('startOverBtn')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleStartFresh}
                        disabled={!questionsReady}
                        className="[font-family:var(--font-plex-sans)] text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-6 py-3.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {t('beginBtn')}
                      </button>
                    )}
                  </div>
                  <div className="mt-[22px] [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.06em] text-text-subtle leading-[1.8]">
                    {t('introFootnote')}
                  </div>
                  <div className="mt-10 pt-[22px] border-t border-white/8 text-[13.5px] text-[#7E8489]">
                    {t('usedBy')}
                  </div>
                </div>

                <div className="animate-[cd-fade_.8s_.15s_both]">
                  <div className="border border-white/9 bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom shadow-[0_40px_100px_-50px_rgba(0,0,0,0.9)]">
                    <div className="px-5 py-4 border-b border-white/7 [font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-text-subtle">
                      {t('whatYouGet')}
                    </div>
                    <div className="grid">
                      {[{ index: '01', title: t('d1Title'), body: t('d1Desc') },
                        { index: '02', title: t('d2Title'), body: t('d2Desc') },
                        { index: '03', title: t('d3Title'), body: t('d3Desc') },
                        { index: '04', title: t('d4Title'), body: t('d4Desc') }
                      ].map((d) => (
                        <div key={d.index} className="grid grid-cols-[26px_1fr] gap-3.5 px-5 py-[18px] border-b border-white/[0.055]">
                          <span className="[font-family:var(--font-plex-mono)] text-[11px] text-accent-gold pt-0.5">{d.index}</span>
                          <span>
                            <span className="block text-[15px] font-medium text-[#EDEFF0]">{d.title}</span>
                            <span className="block mt-[5px] text-[13.5px] leading-[1.6] text-[#868C91]">{d.body}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-[18px] flex flex-wrap gap-2">
                      {ARTICLES.map((art) => (
                        <span key={art} className="[font-family:var(--font-plex-mono)] text-[10.5px] text-[#8A9095] border border-white/10 px-2 py-1">
                          {art}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-px bg-white/8 border border-white/8">
                    {[
                      { value: String(displayQuestions.length), label: t('statsReqs') },
                      { value: String(categories.length), label: t('statsCats') },
                      { value: 'EU', label: t('statsEU') },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#0B0C0E] px-4 py-[18px]">
                        <div className="text-[22px] font-light tracking-[-0.02em] text-text-heading">{s.value}</div>
                        <div className="mt-1.5 [font-family:var(--font-plex-mono)] text-[10px] tracking-[0.1em] uppercase text-text-subtle">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Question Screen */}
          {currentQuestion && (
            <motion.div key="quiz" initial={{ opacity: 1 }} animate={{ opacity: 1 }} className="flex flex-col">
              <div className="border-b border-white/7 bg-[#0A0B0C]">
                <div className="max-w-[900px] mx-auto px-6 py-3.5 flex items-center gap-2.5 flex-wrap">
                  {categories.map((cat, i) => (
                    <div key={cat} className="flex-1 min-w-[90px]">
                      <div
                        className="h-[3px]"
                        style={{ background: i < currentCategoryIndex ? '#C9A227' : i === currentCategoryIndex ? 'rgba(201,162,39,0.55)' : 'rgba(255,255,255,0.1)' }}
                      />
                      <div
                        className="mt-2 [font-family:var(--font-plex-mono)] text-[9.5px] tracking-[0.1em] uppercase truncate"
                        style={{ color: i === currentCategoryIndex ? '#C9A227' : i < currentCategoryIndex ? '#8A9095' : '#5C6266' }}
                      >
                        {cat}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex items-start justify-center px-6 py-14 sm:py-20">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3 }}
                    className="w-full max-w-[720px]"
                  >
                    <div className="flex items-center gap-3.5 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.12em] uppercase text-text-subtle">
                      <span className="text-accent-gold">{t('questionHeader', { current: currentStep + 1, total: displayQuestions.length })}</span>
                      <span className="w-4 h-px bg-white/18" />
                      <span>{currentQuestion.category}</span>
                    </div>
                    <h2 className="mt-[22px] text-2xl sm:text-3xl lg:text-[34px] leading-[1.2] tracking-[-0.026em] font-normal text-text-heading text-pretty">
                      {currentQuestion.questionText}
                    </h2>

                    <div className="mt-[34px] grid gap-2.5">
                      {(currentQuestion.options as Array<{ text: string }>).map((option, i) => {
                        const isSelected = answers[currentQuestion.id]?.text === option.text;
                        return (
                          <button
                            key={i}
                            disabled={isAdvancing || isSubmitting}
                            onClick={() => handleSelectOption(currentQuestion, option)}
                            className="grid grid-cols-[30px_1fr_auto] gap-3.5 items-center text-left w-full cursor-pointer [font-family:var(--font-plex-sans)] px-[18px] py-[18px] border transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{
                              background: isSelected ? 'rgba(201,162,39,0.09)' : '#0A0B0D',
                              borderColor: isSelected ? 'rgba(201,162,39,0.6)' : 'rgba(255,255,255,0.1)',
                            }}
                          >
                            <span
                              className="[font-family:var(--font-plex-mono)] text-[11px] border w-6 h-6 grid place-items-center"
                              style={{
                                color: isSelected ? '#C9A227' : '#6E747A',
                                borderColor: isSelected ? 'rgba(201,162,39,0.5)' : 'rgba(255,255,255,0.12)',
                              }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-[16px] font-normal leading-[1.4]" style={{ color: isSelected ? '#F4F5F6' : '#DDE0E2' }}>
                              {option.text}
                            </span>
                            <span className="[font-family:var(--font-plex-mono)] text-[11px] text-accent-gold">
                              {isSelected ? (isSubmitting || isAdvancing ? <Loader2 className="w-4 h-4 animate-spin" /> : '✓') : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-7 flex items-center gap-4 flex-wrap">
                      <button
                        onClick={() => {
                          let prevStep = currentStep - 1;
                          while (prevStep >= 0) {
                            if (evaluateDependsOn(displayQuestions[prevStep].dependsOn as Parameters<typeof evaluateDependsOn>[0], answers)) {
                              break;
                            }
                            prevStep--;
                          }
                          if (prevStep < 0) {
                            setCurrentStep(-1);
                          } else {
                            setCurrentStep(prevStep);
                          }
                        }}
                        disabled={isAdvancing || isSubmitting}
                        className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.1em] uppercase text-[#8A9095] hover:text-text-primary border border-white/14 px-4 py-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('back')}
                      </button>
                      <span className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.06em] text-text-subtle">
                        {t('keyboardHint', { count: (currentQuestion.options as Array<{ text: string }>).length })}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </>
  );
}

