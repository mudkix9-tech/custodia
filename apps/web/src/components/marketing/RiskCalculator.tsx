"use client";

import { useState } from 'react';
import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, HelpCircle, ShieldCheck, Check, ArrowRight, Copy, ChevronRight, Calculator, Loader2 
} from 'lucide-react';
import Link from 'next/link';

import { useRiskCalculator } from '@/hooks/useRiskCalculator';
import { requestLeadPdf } from '@/actions/lead-assessment';

const CALCULATOR_QUESTIONS = [
  {
    id: 'jurisdiction',
    text: 'Where are your client targets or website visitors located?',
    options: [
      { text: 'We regularly process data of EU/UK citizens', value: 'eu', score: 30 },
      { text: 'We act as a sub-processor of EU datasets', value: 'sub', score: 20 },
      { text: 'We process only US/non-EU datasets', value: 'us', score: 5 }
    ]
  },
  {
    id: 'ropa',
    text: 'Do you maintain an active register of data processing activities?',
    options: [
      { text: 'Yes, we have an up-to-date processing ledger', value: 'yes', score: 0 },
      { text: 'No, we rely on static spreadsheets or have none', value: 'no', score: 35 },
      { text: 'We do not maintain any structured compliance records', value: 'unknown', score: 40 }
    ]
  },
  {
    id: 'cookies',
    text: 'How do you collect and log tracking cookie consent?',
    options: [
      { text: 'We audit and block trackers prior to consent', value: 'automated', score: 0 },
      { text: 'We have a standard banner, but no cookie logs', value: 'basic', score: 20 },
      { text: 'We load tracking codes without consent triggers', value: 'none', score: 35 }
    ]
  },
  {
    id: 'special',
    text: 'Do you handle sensitive data (health, minors, banking, location)?',
    options: [
      { text: 'Yes, we handle sensitive client/user datasets', value: 'yes', score: 25 },
      { text: 'No, we only process basic business contact info', value: 'no', score: 5 }
    ]
  }
];

export default function RiskCalculator() {
  const {
    calcStep,
    setCalcStep,
    calcAnswers,
    calcScores,
    copiedCalculatorLink,
    handleCalculatorSelect,
    resetCalculator,
    handleCopyCalculatorLink,
    riskLevel,
    riskColor,
    riskText,
    prefillUrl,
    leadId,
    isSaving,
  } = useRiskCalculator(CALCULATOR_QUESTIONS);

  const [email, setEmail] = useState('');
  const [pdfRequested, setPdfRequested] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const handlePdfRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !leadId) return;
    setIsPdfLoading(true);
    try {
      await requestLeadPdf(leadId, email);
      setPdfRequested(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <section id="risk-calculator" className="w-full bg-[#191D17] border-y border-[#252B21]/60 relative z-10 scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20">
        
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-sans font-extrabold text-[#F5F3ED] mb-3 tracking-tight text-balance">Evaluate your GDPR exposure</h2>
          <p className="text-[#9CA297] max-w-xl mx-auto text-xs sm:text-sm">
            Calculate your organization&apos;s compliance risk profile in 60 seconds. Receive instant recommendations.
          </p>
        </div>

        <div className="bg-[#1F241D]/45 border border-[#2F362D]/90 rounded-2xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-[#8BA381]/25 to-transparent" />
          
          {calcStep < CALCULATOR_QUESTIONS.length ? (
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  {calcStep > 0 && (
                    <button 
                      onClick={() => setCalcStep(prev => prev - 1)}
                      className="text-[10px] text-[#9CA297] hover:text-[#F5F3ED] flex items-center gap-1 bg-[#141712]/50 border border-[#2F362D] px-2.5 py-1 rounded transition-colors touch-manipulation"
                    >
                      <ArrowLeft className="w-3 h-3" /> Back
                    </button>
                  )}
                  <span className="text-[10px] font-bold text-[#8BA381] uppercase tracking-wider">
                    Question {calcStep + 1} of {CALCULATOR_QUESTIONS.length}
                  </span>
                </div>
                <div className="flex gap-1">
                  {CALCULATOR_QUESTIONS.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`w-5 h-1 rounded-full transition-all ${
                        idx <= calcStep ? 'bg-[#8BA381]' : 'bg-[#2F362D]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-[#F5F3ED] mb-6 leading-snug flex items-center gap-2 flex-wrap">
                <span>{CALCULATOR_QUESTIONS[calcStep].text}</span>
                {CALCULATOR_QUESTIONS[calcStep].id === 'ropa' && (
                  <span className="relative group/term inline-block leading-none">
                    <HelpCircle className="w-3.5 h-3.5 text-[#9CA297]/50 cursor-help hover:text-[#8BA381] transition-colors" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 bg-[#1F241D] border border-[#2F362D] text-[#C5C8C1] text-[10.5px] rounded-xl shadow-2xl opacity-0 invisible group-hover/term:opacity-100 group-hover/term:visible transition-all duration-200 z-50 pointer-events-none normal-case font-normal leading-relaxed backdrop-blur-md">
                      <strong className="text-[#F5F3ED] block mb-1">Record of Processing Activities (ROPA):</strong>
                      A log required under GDPR Article 30 that documents your agency&apos;s data categories, purposes, and recipients of personal data.
                    </span>
                  </span>
                )}
                {CALCULATOR_QUESTIONS[calcStep].id === 'cookies' && (
                  <span className="relative group/term inline-block leading-none">
                    <HelpCircle className="w-3.5 h-3.5 text-[#9CA297]/50 cursor-help hover:text-[#8BA381] transition-colors" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 bg-[#1F241D] border border-[#2F362D] text-[#C5C8C1] text-[10.5px] rounded-xl shadow-2xl opacity-0 invisible group-hover/term:opacity-100 group-hover/term:visible transition-all duration-200 z-50 pointer-events-none normal-case font-normal leading-relaxed backdrop-blur-md">
                      <strong className="text-[#F5F3ED] block mb-1">ePrivacy & Consent Management:</strong>
                      GDPR requires blocking marketing pixels and analytic cookies *before* a visitor selects their consent preferences.
                    </span>
                  </span>
                )}
                {CALCULATOR_QUESTIONS[calcStep].id === 'special' && (
                  <span className="relative group/term inline-block leading-none">
                    <HelpCircle className="w-3.5 h-3.5 text-[#9CA297]/50 cursor-help hover:text-[#8BA381] transition-colors" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 bg-[#1F241D] border border-[#2F362D] text-[#C5C8C1] text-[10.5px] rounded-xl shadow-2xl opacity-0 invisible group-hover/term:opacity-100 group-hover/term:visible transition-all duration-200 z-50 pointer-events-none normal-case font-normal leading-relaxed backdrop-blur-md">
                      <strong className="text-[#F5F3ED] block mb-1">Special Category Data (DPIA):</strong>
                      Sensitive personal data (health, biometric, location, banking) carries high-risk profiles that require a formal Data Protection Impact Assessment (DPIA).
                    </span>
                  </span>
                )}
              </h3>

              <div className="space-y-3">
                {CALCULATOR_QUESTIONS[calcStep].options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCalculatorSelect(CALCULATOR_QUESTIONS[calcStep].id, opt.value, opt.score)}
                    className="w-full text-left bg-[#141712]/55 hover:bg-[#252B21]/80 border border-[#2F362D]/60 hover:border-[#8BA381]/40 p-4.5 rounded-xl transition-all duration-200 text-xs sm:text-sm text-[#C5C8C1] hover:text-[#F5F3ED] font-semibold flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span>{opt.text}</span>
                    <ChevronRight className="w-4 h-4 text-[#5F655A] group-hover:text-[#8BA381] group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
              aria-live="polite"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#6E8B60]/10 border border-[#6E8B60]/20 text-[#8BA381] mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold text-[#F5F3ED] mb-3">Assessment Diagnostic Complete</h3>
              
              <div className={`max-w-md mx-auto border rounded-xl p-5 mb-6 ${riskColor}`}>
                <div className="flex items-center justify-center gap-2.5 mb-2.5">
                  <span className="text-[10px] font-bold tracking-widest uppercase">EXPOSURE LEVEL:</span>
                  <span className={`font-mono font-bold text-xs bg-[#141712]/55 px-2.5 py-0.5 rounded border flex items-center gap-1.5 ${
                    riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'text-red-400 border-red-500/50' :
                    riskLevel === 'MEDIUM' ? 'text-amber-400 border-amber-500/50' : 'text-[#8BA381] border-[#8BA381]/50'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'bg-red-500 animate-pulse' :
                      riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-[#8BA381]'
                    }`} />
                    {riskLevel}
                  </span>
                </div>
                <p className="text-xs leading-relaxed font-semibold">{riskText}</p>
              </div>

              {/* Diagnostic Input Selections Summary Checklist */}
              <div className="mt-6 text-left border-t border-[#2F362D]/40 pt-5 space-y-3 text-[11px] text-[#9CA297] max-w-md mx-auto mb-8 bg-[#141712]/20 p-4.5 rounded-xl border border-[#2F362D]/40">
                <p className="font-bold text-[#F5F3ED] uppercase tracking-wide text-[9px] mb-1">Your Diagnostic Answers:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8BA381] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#F5F3ED]">Audience:</strong> {
                        calcAnswers.jurisdiction === 'eu' ? 'EU/UK citizens' :
                        calcAnswers.jurisdiction === 'sub' ? 'Sub-processor' : 'Non-EU only'
                      }
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8BA381] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#F5F3ED]">ROPA Status:</strong> {
                        calcAnswers.ropa === 'yes' ? 'Audited register' :
                        calcAnswers.ropa === 'no' ? 'Spreadsheets' : 'None maintained'
                      }
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8BA381] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#F5F3ED]">Consent logs:</strong> {
                        calcAnswers.cookies === 'automated' ? 'Pre-consent block' :
                        calcAnswers.cookies === 'basic' ? 'Basic banner' : 'No blockers'
                      }
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8BA381] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#F5F3ED]">Sensitive:</strong> {
                        calcAnswers.special === 'yes' ? 'Sensitive data' : 'Basic contact info'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* PDF Request Form */}
              {isSaving ? (
                <div className="mt-6 flex items-center justify-center gap-2 mb-8 text-[#8BA381] text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving diagnostic...
                </div>
              ) : leadId && !pdfRequested ? (
                <form onSubmit={handlePdfRequest} className="mt-6 text-left border-t border-[#2F362D]/40 pt-6 space-y-3 max-w-md mx-auto mb-8">
                  <p className="font-bold text-[#F5F3ED] text-sm mb-2 text-center">Get Your Detailed Exposure Report</p>
                  <p className="text-[#9CA297] text-xs text-center mb-4">We'll email you a full PDF breakdown of your gap analysis.</p>
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      required 
                      placeholder="work@email.com" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="flex-1 bg-[#141712] border border-[#2F362D] rounded-lg px-4 py-2 text-sm text-[#F5F3ED] focus:outline-none focus:border-[#8BA381] placeholder-[#484E43]"
                    />
                    <button 
                      type="submit" 
                      disabled={isPdfLoading}
                      className="bg-[#2A2920] hover:bg-[#38372D] border border-[#444034] text-[#C9C3AC] px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap disabled:opacity-50"
                    >
                      {isPdfLoading ? 'Sending...' : 'Send PDF'}
                    </button>
                  </div>
                </form>
              ) : pdfRequested ? (
                <div className="mt-6 text-center border-t border-[#2F362D]/40 pt-6 space-y-2 max-w-md mx-auto mb-8">
                  <p className="text-[#8BA381] text-sm font-bold flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> PDF Report Sent!
                  </p>
                  <p className="text-[#9CA297] text-xs">Check your inbox at {email}.</p>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={prefillUrl} className="w-full sm:w-auto bg-gradient-to-r from-[#596E51] to-[#788F6F] hover:from-[#495B42] hover:to-[#677B5D] text-[#F5F3ED] text-xs sm:text-sm font-bold py-3.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2 border border-[#8BA381]/20 focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.02] active:scale-[0.98] touch-manipulation">
                  Verify Exposure in Assessment <ArrowRight className="w-4 h-4" />
                </Link>
                <button 
                  onClick={handleCopyCalculatorLink}
                  className="w-full sm:w-auto bg-[#1F241D] hover:bg-[#2A3127] text-[#C5C8C1] hover:text-[#F5F3ED] border border-[#2F362D] text-xs font-semibold py-3.5 px-6 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 touch-manipulation"
                >
                  {copiedCalculatorLink ? (
                    <>Copied! <Check className="w-3.5 h-3.5 text-[#8BA381]" /></>
                  ) : (
                    <>Share Result Link <Copy className="w-3.5 h-3.5" /></>
                  )}
                </button>
                <button 
                  onClick={resetCalculator}
                  className="w-full sm:w-auto bg-[#141712]/50 hover:bg-[#141712] text-[#9CA297] hover:text-[#F5F3ED] border border-[#2F362D] text-xs font-semibold py-3.5 px-6 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#191D17] hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
                >
                  Reset Calculator
                </button>
              </div>
            </motion.div>
          )}
        </div>

      </div>
    </section>
  );
}
