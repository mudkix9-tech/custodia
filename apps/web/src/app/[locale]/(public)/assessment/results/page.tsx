"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { trpc } from '@/utils/trpc';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Send, Copy, ArrowRight, Clock, Download, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { captureLeadEmail } from '@/actions/lead-assessment';
import { Logo } from '@/components/layout/MarketingHeader';

const categoryRouteMap: Record<string, string> = {
  'Data Mapping': '/ropa',
  'Lawful Basis': '/ropa',
  'Vendor Management': '/vendors',
  'Data Subject Rights': '/dsar',
  'Security': '/settings/security',
  'Privacy Notices': '/policies',
  'Cookie Consent': '/consent',
  'Client Compliance': '/ropa',
  'Governance': '/settings',
};

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

function getFixIssueLink(category?: string | null): string {
  return (category && categoryRouteMap[category]) ? categoryRouteMap[category] : '/ropa';
}

function shortArticle(ref?: string | null): string {
  if (!ref) return 'Art. 5';
  const matches = Array.from(ref.matchAll(/Article (\d+)/g)).map((m) => m[1]);
  if (matches.length === 0) return 'Art. 5';
  return 'Art. ' + Array.from(new Set(matches)).join(', ');
}

function bandFor(score: number) {
  if (score >= 75) return { label: 'Defensible', color: '#7FA88B', border: 'rgba(127,168,139,0.45)' };
  if (score >= 45) return { label: 'Material exposure', color: '#C48A3F', border: 'rgba(196,138,63,0.45)' };
  return { label: 'High exposure', color: '#C0554C', border: 'rgba(192,85,76,0.45)' };
}

function verdictFor(score: number) {
  if (score >= 75) {
    return "Your programme is broadly defensible. The findings below are refinements rather than exposures — close them to move from compliant-in-substance to demonstrable on request.";
  }
  if (score >= 45) {
    return "You have the outline of a compliance programme without the evidence to prove it. In an inquiry, the gap between what you do and what you can show is where liability sits — and most of the findings below are documentation, not new work.";
  }
  return "Several foundational obligations are unmet, including ones a supervisory authority can verify without contacting you. Treat the high-severity findings as this quarter's priority.";
}

function AssessmentResultsContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const t = useTranslations('marketing.assessmentResults');
  const router = useRouter();
  const id = searchParams?.get('id');
  const { data: session, status } = useSession();

  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [note, setNote] = useState('');

  const generatePdfMutation = trpc.export.generateAssessmentReportPdf.useMutation();

  // States:
  // State 1: Anonymous just finished (score + partial teaser + email gate)
  // State 2: Magic link sent (check email)
  // State 3: Authenticated full results
  const isUnlocked = status === 'authenticated' || id === "mock-id";
  const currentState = isUnlocked ? 3 : (isMagicLinkSent ? 2 : 1);

  const { data: resultsData, isLoading, isError } = trpc.assessments.getResults.useQuery(
    { assessmentId: id! },
    { enabled: !!id && id !== "mock-id" }
  );

  useEffect(() => {
    if (!isLoading && id !== "mock-id") {
      if (!id || isError || !resultsData || typeof resultsData.assessment?.overallScore !== 'number') {
        router.push('/assessment?error=not_found');
      }
    }
  }, [isLoading, isError, resultsData, id, router]);

  if (isLoading && id !== "mock-id") {
    return (
      <div className="min-h-screen bg-[#08090A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A227]" />
      </div>
    );
  }

  if (!isLoading && id !== "mock-id" && (!id || isError || !resultsData || typeof resultsData.assessment?.overallScore !== 'number')) {
    return null;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const ok = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim());
    if (!ok) {
      setNote(t('emailNoteError'));
      return;
    }

    try {
      setIsCapturing(true);
      if (id && id !== "mock-id") {
        await captureLeadEmail(id, email, marketingConsent);
      }
      await signIn('resend', { email, redirect: false, callbackUrl: window.location.href });
      setIsMagicLinkSent(true);
    } catch (err) {
      console.error(err);
      if (process.env.NODE_ENV === 'development') setIsMagicLinkSent(true);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const finalScore = id === "mock-id" ? 34 : (resultsData?.assessment?.overallScore ?? 0);
  const isExpired = resultsData?.assessment?.expiresAt && new Date(resultsData.assessment.expiresAt) < new Date();

  const mockActionItems = [
    { priority: 'High', title: 'Address risk regarding: vendor data processing agreements', category: 'Vendor Management', gdprArticleReference: 'Article 28 (Processor)', description: 'Missing DPAs with critical sub-processors.' },
    { priority: 'High', title: 'Address risk regarding: encryption at rest', category: 'Security', gdprArticleReference: 'Article 32 (Security of processing)', description: 'Data is not encrypted at rest.' },
  ];
  const mockCategoryScores = [
    { category: 'Vendor Management', score: 38 }, { category: 'Security', score: 44 }, { category: 'Data Mapping', score: 71 },
  ];

  const realActionItems = (id === "mock-id" ? mockActionItems : (resultsData?.actionItems || [])) as Array<{
    priority: string; title: string; category?: string | null; gdprArticleReference: string; description: string;
  }>;
  const categoryScores = (id === "mock-id" ? mockCategoryScores : (resultsData?.categoryScores || [])) as Array<{ category: string; score: number }>;

  const sortedFindings = [...realActionItems].sort((a, b) => (a.priority === 'High' ? 0 : 1) - (b.priority === 'High' ? 0 : 1));
  const highCount = sortedFindings.filter((f) => f.priority === 'High').length;
  const mediumCount = sortedFindings.length - highCount;

  const sortedCategoryScores = [...categoryScores].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.category);
    const ib = CATEGORY_ORDER.indexOf(b.category);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const gateAfter = 3;
  const shownFindings = currentState === 3 ? sortedFindings : sortedFindings.slice(0, gateAfter);
  const lockedCount = Math.max(sortedFindings.length - shownFindings.length, 0);

  const band = bandFor(finalScore);
  const reportDate = resultsData?.assessment?.completedAt
    ? new Date(resultsData.assessment.completedAt as unknown as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const reportRef = 'GA-' + (id || '').slice(0, 4).toUpperCase();

  if (isExpired && !isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 border border-[#C48A3F]/40 bg-[#C48A3F]/10 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-[#C48A3F]" />
          </div>
          <h1 className="text-2xl font-normal text-[#F4F5F6] mb-4">{t('expiredTitle')}</h1>
          <p className="text-[#9BA1A6] mb-8">{t('expiredDesc')}</p>
          <Link href="/assessment" className="inline-flex [font-family:var(--font-plex-sans)] text-[15px] font-medium text-[#08090A] bg-[#C9A227] hover:bg-[#E5C463] px-6 py-3.5 transition-colors">{t('startNewBtn')}</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-white/7 relative">
        <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          {currentState === 3 && (
            <button onClick={handleCopyLink} className="flex items-center gap-2 [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.06em] text-[#9BA1A6] hover:text-[#E6E8EA] border border-white/14 px-3 py-2 transition-colors cursor-pointer">
              {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-[#7FA88B]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? t('copied') : t('shareLink')}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* STATE 1: score + teaser + email gate */}
        {currentState === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden">
            <div aria-hidden="true" className="absolute -top-[200px] left-1/4 w-[700px] h-[420px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(201,162,39,0.13),transparent_70%)]" />
            <section className="border-b border-white/7 relative">
              <div className="max-w-[1120px] mx-auto px-6 py-14 sm:py-16 relative">
                <div className="flex flex-wrap gap-4 items-center [font-family:var(--font-plex-mono)] text-[11px] tracking-[0.14em] uppercase text-[#6E747A]">
                  <span className="text-[#C9A227]">{t('assessmentComplete')}</span>
                  <span>{t('ref', { ref: reportRef })}</span>
                  <span>{reportDate}</span>
                </div>
                <div className="mt-8 flex items-end gap-4 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[64px] sm:text-[84px] leading-[0.9] font-light tracking-[-0.045em] text-[#F4F5F6]">{finalScore}</span>
                    <span className="text-xl text-[#6E747A]">/ 100</span>
                  </div>
                  <span className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.1em] uppercase px-2.5 py-1.5 border" style={{ color: band.color, borderColor: band.border }}>
                    {band.label}
                  </span>
                </div>
                <div className="mt-[22px] h-1.5 bg-white/7 relative max-w-2xl">
                  <div className="h-1.5 transition-[width] duration-1000" style={{ background: band.color, width: `${Math.max(finalScore, 2)}%` }} />
                </div>
                <div className="mt-2 [font-family:var(--font-plex-mono)] text-[10.5px] text-[#6E747A]">{t('medianScore')}</div>
                <p className="mt-6 max-w-2xl text-[16.5px] leading-[1.66] text-[#9BA1A6] text-pretty">{verdictFor(finalScore)}</p>

                <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/8 border border-white/8 max-w-2xl">
                  <div className="bg-[#0B0C0E] px-4 py-5">
                    <div className="text-[28px] font-light tracking-[-0.02em] text-[#C0554C]">{highCount}</div>
                    <div className="mt-1.5 [font-family:var(--font-plex-mono)] text-[10px] tracking-[0.1em] uppercase text-[#6E747A]">{t('highSeverity')}</div>
                  </div>
                  <div className="bg-[#0B0C0E] px-4 py-5">
                    <div className="text-[28px] font-light tracking-[-0.02em] text-[#C48A3F]">{mediumCount}</div>
                    <div className="mt-1.5 [font-family:var(--font-plex-mono)] text-[10px] tracking-[0.1em] uppercase text-[#6E747A]">{t('mediumSeverity')}</div>
                  </div>
                  <div className="bg-[#0B0C0E] px-4 py-5">
                    <div className="text-[28px] font-light tracking-[-0.02em] text-[#F4F5F6]">{sortedFindings.length}</div>
                    <div className="mt-1.5 [font-family:var(--font-plex-mono)] text-[10px] tracking-[0.1em] uppercase text-[#6E747A]">{t('totalFindings')}</div>
                  </div>
                </div>
              </div>
            </section>

            {sortedCategoryScores.length > 0 && (
              <section className="border-b border-white/7 bg-[#0B0C0E]">
                <div className="max-w-[1120px] mx-auto px-6 py-14">
                  <h3 className="text-xl font-normal tracking-[-0.02em] text-[#F4F5F6]">{t('scoreByCategory')}</h3>
                  <div className="mt-7 grid gap-px bg-white/8 border border-white/8">
                    {sortedCategoryScores.map((c) => {
                      const cColor = c.score >= 75 ? '#7FA88B' : c.score >= 45 ? '#C48A3F' : '#C0554C';
                      return (
                        <div key={c.category} className="bg-[#0B0C0E] grid grid-cols-[minmax(140px,1.5fr)_minmax(80px,2fr)_auto] gap-5 items-center px-5 py-4">
                          <span className="text-[15px] text-[#EDEFF0]">{c.category}</span>
                          <span className="block h-1 bg-white/7">
                            <span className="block h-1" style={{ background: cColor, width: `${Math.max(c.score, 2)}%` }} />
                          </span>
                          <span className="[font-family:var(--font-plex-mono)] text-[13px] min-w-[42px] text-right" style={{ color: cColor }}>{c.score}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            <section className="border-b border-white/7">
              <div className="max-w-[1120px] mx-auto px-6 py-14">
                <div className="flex flex-wrap gap-5 items-baseline justify-between">
                  <h3 className="text-xl font-normal tracking-[-0.02em] text-[#F4F5F6]">{t('findings')}</h3>
                  <p className="max-w-[420px] text-sm leading-[1.6] text-[#7E8489]">{t('findingsDesc')}</p>
                </div>
                <div className="mt-7 grid gap-3">
                  {shownFindings.map((f, i) => {
                    const isHigh = f.priority === 'High';
                    const color = isHigh ? '#C0554C' : '#C48A3F';
                    const border = isHigh ? 'rgba(192,85,76,0.45)' : 'rgba(196,138,63,0.45)';
                    return (
                      <div key={i} className="border border-white/9 bg-[#0A0B0D]" style={{ borderLeft: `2px solid ${color}` }}>
                        <div className="px-[22px] py-5 grid gap-3">
                          <div className="flex flex-wrap gap-3.5 items-center [font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.1em] uppercase">
                            <span className="text-[#5C6266]">{String(i + 1).padStart(2, '0')}</span>
                            <span className="px-2 py-[3px] border" style={{ color, borderColor: border }}>{f.priority}</span>
                            <span className="text-[#8A9095]">{shortArticle(f.gdprArticleReference)}</span>
                          </div>
                          <h4 className="text-[17.5px] font-medium tracking-[-0.014em] text-[#EDEFF0] text-pretty">{f.title}</h4>
                          <p className="text-[14.5px] leading-[1.65] text-[#8A9095] max-w-[780px] text-pretty">{f.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {lockedCount > 0 && (
                  <div className="mt-3.5 border border-dashed border-[#C9A227]/35 bg-[#C9A227]/[0.04] px-[22px] py-5 flex flex-wrap gap-4 items-center justify-between">
                    <span className="text-[15px] text-[#DDE0E2]">{t('furtherFindings', { count: lockedCount })}</span>
                    <a href="#unlock" className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.1em] uppercase text-[#C9A227]">{t('unlockBelow')}</a>
                  </div>
                )}
              </div>
            </section>

            <section id="unlock" className="bg-[#0B0C0E]">
              <div className="max-w-[560px] mx-auto px-6 py-16">
                <div className="border border-white/10 bg-gradient-to-b from-[#0E1012] to-[#0A0B0D] px-7 py-8 shadow-[0_40px_100px_-50px_rgba(0,0,0,0.9)]">
                  <div className="[font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.14em] uppercase text-[#6E747A]">{t('sendReportHeader')}</div>
                  <p className="mt-4 text-[14.5px] leading-[1.6] text-[#9BA1A6]">{t('sendReportDesc')}</p>
                  <form onSubmit={handleUnlock} className="mt-[22px] grid gap-2.5">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setNote(''); }}
                      placeholder={t('emailPlaceholder')}
                      className="w-full bg-[#08090A] border border-white/16 text-[#E6E8EA] text-[15px] px-[15px] py-3.5 focus:border-[#C9A227]"
                    />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder={t('companyPlaceholder')}
                      className="w-full bg-[#08090A] border border-white/16 text-[#E6E8EA] text-[15px] px-[15px] py-3.5 focus:border-[#C9A227]"
                    />
                    <label className="flex items-start gap-2.5 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#C9A227] bg-[#08090A] border border-white/20"
                      />
                      <span className="text-[13px] leading-[1.5] text-[#8A9095]">{t('marketingConsent')}</span>
                    </label>
                    <button
                      type="submit"
                      disabled={isCapturing}
                      className="[font-family:var(--font-plex-sans)] mt-2 text-[15px] font-medium text-[#08090A] bg-[#C9A227] hover:bg-[#E5C463] disabled:opacity-60 disabled:cursor-not-allowed px-5 py-3.5 transition-colors cursor-pointer"
                    >
                      {isCapturing ? 'Processing…' : 'Email me the full report'}
                    </button>
                  </form>
                  <div className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: note ? '#C0554C' : '#6E747A' }}>
                    {note || t('emailNote')}
                  </div>
                  <div className="mt-5 pt-[18px] border-t border-white/7 grid gap-2 [font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.06em] text-[#6E747A]">
                    <span>{t('storedEU')}</span>
                    <span>{t('deleted90Days')}</span>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {/* STATE 2: Magic Link Sent */}
        {currentState === 2 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="max-w-[560px] mx-auto px-6 py-24 text-center">
            <div className="w-16 h-16 border border-white/10 bg-[#0B0C0E] flex items-center justify-center mx-auto mb-8">
              <Send className="w-7 h-7 text-[#C9A227]" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-normal tracking-[-0.02em] text-[#F4F5F6] mb-4">{t('checkEmailTitle')}</h1>
            <p className="text-[16px] leading-[1.6] text-[#9BA1A6] mb-8">
              {t('checkEmailDesc1')}<span className="text-[#F4F5F6] font-medium">{email}</span>.<br />{t('checkEmailDesc2')}
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button onClick={() => handleUnlock({ preventDefault: () => {} } as React.FormEvent)} className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.1em] uppercase text-[#C9A227] border border-[#C9A227]/40 px-4 py-2.5 transition-colors cursor-pointer">{t('resendLink')}</button>
              <button onClick={() => setIsMagicLinkSent(false)} className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.1em] uppercase text-[#8A9095] border border-white/14 px-4 py-2.5 transition-colors cursor-pointer">{t('wrongEmail')}</button>
            </div>
          </motion.div>
        )}

        {/* STATE 3: Authenticated Results */}
        {currentState === 3 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <section className="border-b border-white/7">
              <div className="max-w-[1120px] mx-auto px-6 py-14">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <div className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.14em] uppercase text-[#C9A227]">{t('fullReportBadge')}</div>
                    <h1 className="mt-3 text-3xl font-normal tracking-[-0.02em] text-[#F4F5F6]">{t('fullReportTitle')}</h1>
                    <p className="mt-1 text-xs text-[#6E747A]">Ref {reportRef} · {reportDate}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!id) return;
                      try {
                        setIsDownloading(true);
                        const result = await generatePdfMutation.mutateAsync({ assessmentId: id });
                        if (result.success && result.pdfData) {
                          const linkSource = `data:application/pdf;base64,${result.pdfData}`;
                          const downloadLink = document.createElement("a");
                          downloadLink.href = linkSource;
                          downloadLink.download = result.filename || 'Assessment_Report.pdf';
                          downloadLink.click();
                        }
                      } catch (err) {
                        console.error("Failed to download PDF", err);
                      } finally {
                        setIsDownloading(false);
                      }
                    }}
                    disabled={isDownloading || !id}
                    className="[font-family:var(--font-plex-sans)] inline-flex items-center gap-2 text-[15px] font-medium text-[#08090A] bg-[#C9A227] hover:bg-[#E5C463] disabled:opacity-60 disabled:cursor-not-allowed px-6 py-3.5 transition-colors cursor-pointer"
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isDownloading ? 'Generating…' : 'Download PDF report'}
                  </button>
                </div>

                <div className="mt-10 flex items-end gap-4 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[64px] sm:text-[84px] leading-[0.9] font-light tracking-[-0.045em] text-[#F4F5F6]">{finalScore}</span>
                    <span className="text-xl text-[#6E747A]">/ 100</span>
                  </div>
                  <span className="[font-family:var(--font-plex-mono)] text-[11px] tracking-[0.1em] uppercase px-2.5 py-1.5 border" style={{ color: band.color, borderColor: band.border }}>
                    {band.label}
                  </span>
                </div>
                <div className="mt-[22px] h-1.5 bg-white/7 max-w-2xl">
                  <div className="h-1.5" style={{ background: band.color, width: `${Math.max(finalScore, 2)}%` }} />
                </div>
                <p className="mt-6 max-w-2xl text-[16.5px] leading-[1.66] text-[#9BA1A6] text-pretty">{verdictFor(finalScore)}</p>
              </div>
            </section>

            {sortedCategoryScores.length > 0 && (
              <section className="border-b border-white/7 bg-[#0B0C0E]">
                <div className="max-w-[1120px] mx-auto px-6 py-14">
                  <h3 className="text-xl font-normal tracking-[-0.02em] text-[#F4F5F6]">{t('scoreByCategory')}</h3>
                  <div className="mt-7 grid gap-px bg-white/8 border border-white/8">
                    {sortedCategoryScores.map((c) => {
                      const cColor = c.score >= 75 ? '#7FA88B' : c.score >= 45 ? '#C48A3F' : '#C0554C';
                      return (
                        <div key={c.category} className="bg-[#0B0C0E] grid grid-cols-[minmax(140px,1.5fr)_minmax(80px,2fr)_auto] gap-5 items-center px-5 py-4">
                          <span className="text-[15px] text-[#EDEFF0]">{c.category}</span>
                          <span className="block h-1 bg-white/7">
                            <span className="block h-1" style={{ background: cColor, width: `${Math.max(c.score, 2)}%` }} />
                          </span>
                          <span className="[font-family:var(--font-plex-mono)] text-[13px] min-w-[42px] text-right" style={{ color: cColor }}>{c.score}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            <section className="border-b border-white/7">
              <div className="max-w-[1120px] mx-auto px-6 py-14">
                <h3 className="text-xl font-normal tracking-[-0.02em] text-[#F4F5F6] mb-7">{t('actionPlan')}</h3>
                <div className="grid gap-3">
                  {sortedFindings.map((f, i) => {
                    const isHigh = f.priority === 'High';
                    const color = isHigh ? '#C0554C' : '#C48A3F';
                    const border = isHigh ? 'rgba(192,85,76,0.45)' : 'rgba(196,138,63,0.45)';
                    return (
                      <div key={i} className="border border-white/9 bg-[#0A0B0D]" style={{ borderLeft: `2px solid ${color}` }}>
                        <div className="px-[22px] py-5 grid gap-3">
                          <div className="flex flex-wrap gap-3.5 items-center [font-family:var(--font-plex-mono)] text-[10.5px] tracking-[0.1em] uppercase">
                            <span className="text-[#5C6266]">{String(i + 1).padStart(2, '0')}</span>
                            <span className="px-2 py-[3px] border" style={{ color, borderColor: border }}>{f.priority}</span>
                            <span className="text-[#8A9095]">{shortArticle(f.gdprArticleReference)}</span>
                            <span className="flex-1" />
                            <Link href={getFixIssueLink(f.category)} className="flex items-center gap-1.5 normal-case tracking-normal text-[13px] text-[#C9A227] hover:text-[#E5C463]">
                              {t('fixIssue')} <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                          <h4 className="text-[17.5px] font-medium tracking-[-0.014em] text-[#EDEFF0] text-pretty">{f.title}</h4>
                          <p className="text-[14.5px] leading-[1.65] text-[#8A9095] max-w-[780px] text-pretty">{f.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {session?.user && (
              <section>
                <div className="max-w-[1120px] mx-auto px-6 py-16">
                  <div className="border border-white/10 bg-gradient-to-b from-[#0E1012] to-[#0A0B0D] px-8 py-12 text-center relative overflow-hidden">
                    <div aria-hidden="true" className="absolute top-0 right-0 w-64 h-64 bg-[#C9A227]/10 rounded-full blur-[80px]" />
                    <div className="relative">
                      <h3 className="text-2xl font-normal tracking-[-0.02em] text-[#F4F5F6] mb-4">{t('fixAutomaticallyTitle')}</h3>
                      <p className="text-[15px] leading-[1.65] text-[#9BA1A6] mb-8 max-w-lg mx-auto">{t('fixAutomaticallyDesc')}</p>
                      <Link href="/pricing" className="inline-flex [font-family:var(--font-plex-sans)] text-[15px] font-medium text-[#08090A] bg-[#C9A227] hover:bg-[#E5C463] px-6 py-3.5 transition-colors">{t('viewPlans')}</Link>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </motion.div>
        )}
      </main>
    </>
  );
}

export default function AssessmentResults() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08090A] flex items-center justify-center"><div className="text-[#9BA1A6]">Loading results...</div></div>}>
      <AssessmentResultsContent />
    </Suspense>
  );
}
