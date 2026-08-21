"use client";

import React, { useEffect, useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

/**
 * The respondent's view.
 *
 * Three things it does that the register's own forms do not need to:
 *
 *   - **It saves as you go.** The questionnaire is answered by someone doing it
 *     between other things, and one that loses their answers when they close the
 *     tab is one that never comes back. C33's whole value is the response arriving.
 *   - **"I am not sure" is a real answer** and is offered on every judgement
 *     question. The alternative is a business owner guessing, and a guess that
 *     arrives labelled as an answer is worse than a gap — the reviewer cannot tell
 *     it apart from knowledge.
 *   - **It says what happens next.** Somebody being asked about "people's
 *     information" by their employer needs to know a person reads this and that
 *     nothing they write goes live on its own.
 *
 * The question text is served from the API in English and frozen on the request
 * when it was sent. That is deliberate and it is the same call J93 made about the
 * negative assertions: the questions are the *content* of the request, and the
 * merge screen has to be able to show a reviewer what was actually put to the
 * respondent. Translating the set belongs with translating the record.
 */

export function IntakeForm({ token }: { token: string }) {
  const t = useTranslations('ropa.intake_public');
  const { data, isLoading, error } = trpc.ropa.intake.open.useQuery({ token });

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveProgress = trpc.ropa.intake.saveProgress.useMutation();
  const submit = trpc.ropa.intake.submit.useMutation();

  useEffect(() => {
    if (data?.answers) setAnswers(data.answers as Record<string, unknown>);
  }, [data?.answers]);

  // Autosave, debounced. Nothing here blocks the respondent: a save that fails is
  // shown and retried on the next keystroke rather than interrupting the form.
  useEffect(() => {
    if (!data || submitted || Object.keys(answers).length === 0) return;
    const timer = setTimeout(() => {
      saveProgress.mutateAsync({ token, answers }).catch(() => setSaveError(t('save_failed')));
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  if (isLoading) {
    return <Centre><p className="text-[14px] text-[#9BA1A6]">{t('loading')}</p></Centre>;
  }

  if (error || !data) {
    return (
      <Centre>
        <h1 className="text-xl text-[#F4F5F6]">{t('unavailable')}</h1>
        <p className="text-[13.5px] text-[#9BA1A6] mt-2 max-w-md">{error?.message ?? t('unavailable_hint')}</p>
      </Centre>
    );
  }

  if (submitted || data.status === 'submitted' || data.status === 'merged') {
    return (
      <Centre>
        <CheckCircle2 className="w-10 h-10 text-[#C9A227]" aria-hidden="true" />
        <h1 className="text-xl text-[#F4F5F6] mt-4">{t('thanks')}</h1>
        <p className="text-[13.5px] text-[#9BA1A6] mt-2 max-w-md">{t('thanks_hint', { organisation: data.organizationName })}</p>
      </Centre>
    );
  }

  const questions = (data.questions ?? []) as any[];
  const set = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }));
  const missingRequired = questions.filter((q) => q.required && isBlank(answers[q.id]));

  return (
    <main className="min-h-screen bg-[#08090A] px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <p className="text-[12px] text-[#6E747A] uppercase tracking-wide">{data.organizationName}</p>
          <h1 className="text-2xl font-serif text-[#F4F5F6]">{data.subject}</h1>
          {data.message ? <p className="text-[13.5px] text-[#9BA1A6]">{data.message}</p> : null}
          <div className="flex items-start gap-2 text-[12.5px] text-[#6E747A] bg-[#0D0F11] border border-white/10 rounded-xl p-3">
            <ShieldCheck className="w-4 h-4 text-[#C9A227] shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t('reassurance')}</span>
          </div>
          {data.activity ? (
            <div className="bg-[#0D0F11] border border-white/10 rounded-xl p-4">
              <p className="text-[12px] text-[#6E747A]">{t('about_record')}</p>
              <p className="text-[13.5px] text-[#F4F5F6] mt-1">{data.activity.name}</p>
              <p className="text-[12.5px] text-[#9BA1A6] mt-1">{data.activity.purpose}</p>
            </div>
          ) : null}
        </header>

        {saveError ? <p className="text-[12.5px] text-clay-600">{saveError}</p> : null}

        <ol className="space-y-6">
          {questions.map((q, index) => (
            <li key={q.id} className="bg-[#0D0F11] border border-white/10 rounded-2xl p-5">
              <label htmlFor={`q-${q.id}`} className="block text-[14px] text-[#F4F5F6]">
                <span className="text-[#6E747A] mr-2">{index + 1}.</span>
                {q.prompt}
                {q.required ? <span className="text-[#C9A227] ml-1" aria-hidden="true">*</span> : null}
              </label>
              {q.help ? <p className="text-[12.5px] text-[#6E747A] mt-1.5">{q.help}</p> : null}

              <div className="mt-3">
                {q.type === 'textarea' ? (
                  <textarea
                    id={`q-${q.id}`}
                    rows={4}
                    value={String(answers[q.id] ?? '')}
                    onChange={(e) => set(q.id, e.target.value)}
                    className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[13.5px] text-[#F4F5F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60"
                  />
                ) : q.type === 'multi_select' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options ?? []).map((o: any) => {
                      const current = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                      return (
                        <label key={o.value} className="flex items-center gap-2 text-[13.5px] text-[#E6E8EA] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={current.includes(o.value)}
                            onChange={() => set(q.id, current.includes(o.value) ? current.filter((v) => v !== o.value) : [...current, o.value])}
                            className="rounded border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
                          />
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                ) : q.type === 'single_select' ? (
                  <div className="space-y-2">
                    {(q.options ?? []).map((o: any) => (
                      <label key={o.value} className="flex items-center gap-2 text-[13.5px] text-[#E6E8EA] cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={answers[q.id] === o.value}
                          onChange={() => set(q.id, o.value)}
                          className="border-white/20 text-[#C9A227] focus:ring-[#C9A227]/40 bg-transparent"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <Input
                    id={`q-${q.id}`}
                    value={String(answers[q.id] ?? '')}
                    onChange={(e) => set(q.id, e.target.value)}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-5 space-y-4">
          <div>
            <label htmlFor="respondent" className="text-[13px] text-[#F4F5F6]">{t('your_name')}</label>
            <Input id="respondent" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          {missingRequired.length > 0 ? (
            <p className="text-[12.5px] text-[#6E747A]">{t('still_needed', { count: missingRequired.length })}</p>
          ) : null}
          <div className="flex justify-end">
            <Button
              disabled={missingRequired.length > 0 || submit.isPending}
              onClick={async () => {
                setSaveError(null);
                try {
                  await submit.mutateAsync({ token, answers, submittedByName: name || null });
                  setSubmitted(true);
                } catch (e: any) { setSaveError(e?.message ?? t('submit_failed')); }
              }}
            >
              {t('submit')}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Centre({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#08090A] flex flex-col items-center justify-center text-center px-6">
      {children}
    </main>
  );
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}
