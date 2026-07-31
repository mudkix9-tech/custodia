"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { trpc } from '@/utils/trpc';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldCheck, Mail, AlertCircle, CheckCircle2, AlertTriangle, Lock, Send, Copy, ArrowRight, Clock, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { captureLeadEmail } from '@/actions/lead-assessment';

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

function getFixIssueLink(category?: string | null): string {
  return (category && categoryRouteMap[category]) ? categoryRouteMap[category] : '/ropa';
}
function ConfettiEffect() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationFrameId: number;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const colors = ['#8BA381', '#596E51', '#FFE01B', '#F9AB00', '#635BFF'];
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      d: Math.random() * canvas.height,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tiltAngle: 0
    }));
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;
        
        ctx.beginPath();
        ctx.lineWidth = p.r * 2;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });
      
      const active = particles.some(p => p.y < canvas.height);
      if (active) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };
    
    draw();
    
    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50 w-full h-full" />;
}

function AssessmentResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams?.get('id');
  const { data: session, status } = useSession();
  
  const [email, setEmail] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const generatePdfMutation = trpc.export.generateAssessmentReportPdf.useMutation();
  
  // States:
  // State 1: Anonymous just finished (show email capture)
  // State 2: Magic link sent (show check email)
  // State 3: Authenticated full results
  
  const isUnlocked = status === 'authenticated' || id === "mock-id";
  const currentState = isUnlocked ? 3 : (isMagicLinkSent ? 2 : 1);
  
  // TRPC
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
      <div className="min-h-screen bg-bone-50 py-12 px-4 sm:px-6 relative">
        <div className="max-w-4xl mx-auto">
          <header className="p-6 border-b border-ink-900/5 flex justify-between items-center bg-bone-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-sage-700/20 rounded-lg animate-pulse" />
              <div className="w-24 h-6 bg-ink-900/10 rounded animate-pulse" />
            </div>
          </header>
          <main className="max-w-4xl mx-auto px-6 py-16">
            {currentState === 3 ? (
              <div className="animate-pulse">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-ink-900/10">
                  <div>
                    <div className="w-64 h-8 bg-ink-900/10 rounded mb-2" />
                    <div className="w-48 h-4 bg-ink-900/5 rounded" />
                  </div>
                  <div className="w-48 h-10 bg-ink-900/10 rounded-xl" />
                </div>
                <div className="grid md:grid-cols-3 gap-8 mb-12">
                  <div className="md:col-span-1 bg-white border border-ink-900/10 rounded-3xl p-8 flex flex-col items-center justify-center shadow-card">
                    <div className="w-24 h-4 bg-ink-900/10 rounded mb-6" />
                    <div className="w-32 h-32 rounded-full border-8 border-ink-900/5 mb-6" />
                    <div className="w-24 h-6 bg-ink-900/10 rounded-full" />
                  </div>
                  <div className="md:col-span-2 bg-sage-700/10 rounded-3xl p-10 flex flex-col justify-center shadow-card">
                    <div className="w-48 h-8 bg-sage-700/20 rounded mb-8" />
                    <div className="space-y-6">
                      {[1, 2, 3].map(i => (
                        <div key={i}>
                          <div className="flex justify-between mb-2">
                            <div className="w-32 h-4 bg-sage-700/20 rounded" />
                            <div className="w-8 h-4 bg-sage-700/20 rounded" />
                          </div>
                          <div className="w-full h-2 bg-sage-700/10 rounded-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="w-48 h-8 bg-ink-900/10 rounded mb-6" />
                <div className="space-y-4 mb-12">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white border border-ink-900/10 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-start gap-4 shadow-sm">
                      <div className="w-6 h-6 bg-ink-900/10 rounded-full shrink-0 mt-1" />
                      <div className="flex-1 w-full">
                        <div className="w-64 h-6 bg-ink-900/10 rounded mb-2" />
                        <div className="w-32 h-5 bg-ink-900/5 rounded mb-3" />
                        <div className="w-full h-4 bg-ink-900/5 rounded mb-2" />
                        <div className="w-3/4 h-4 bg-ink-900/5 rounded" />
                      </div>
                      <div className="w-24 h-8 bg-ink-900/10 rounded-lg shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center animate-pulse">
                <div className="w-64 h-10 bg-ink-900/10 rounded-lg mx-auto mb-12" />
                <div className="bg-white border border-ink-900/10 rounded-3xl p-10 max-w-2xl mx-auto shadow-card relative overflow-hidden mb-12">
                  <div className="w-64 h-4 bg-ink-900/10 rounded mx-auto mb-6" />
                  <div className="w-48 h-48 rounded-full border-8 border-ink-900/5 mx-auto mb-8" />
                  <div className="w-64 h-8 bg-ink-900/10 rounded mx-auto mb-3" />
                  <div className="w-96 h-4 bg-ink-900/10 rounded mx-auto mb-8" />
                  <div className="w-full max-w-md mx-auto h-12 bg-ink-900/5 rounded-xl mb-4" />
                  <div className="w-full max-w-md mx-auto h-12 bg-ink-900/10 rounded-xl" />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // Prevent rendering if redirecting
  if (!isLoading && id !== "mock-id" && (!id || isError || !resultsData || typeof resultsData.assessment?.overallScore !== 'number')) {
    return null;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

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
  
  const realActionItems = (id === "mock-id" ? [
    { priority: 'High', title: 'Address risk in Vendor Management', category: 'Vendor Management', gdprArticleReference: 'Article 28 (Processor)', description: 'Missing DPAs with critical sub-processors.' },
    { priority: 'High', title: 'Address risk in Security', category: 'Security', gdprArticleReference: 'Article 32 (Security of processing)', description: 'Data is not encrypted at rest.' }
  ] : (resultsData?.actionItems || [])) as Array<{ priority: string; title: string; category?: string; gdprArticleReference: string; description: string }>;
  const highPriorityCount = realActionItems.filter((item) => item.priority === 'High').length;
  const totalActionItems = realActionItems.length;

  if (isExpired && !isUnlocked) {
    return (
      <div className="min-h-screen bg-bone-50 text-ink-900 font-sans flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-serif mb-4">Assessment Expired</h1>
          <p className="text-ink-600 mb-8">This assessment was completed over 30 days ago and is no longer available.</p>
          <Link href="/assessment" className="inline-flex bg-sage-700 hover:bg-sage-600 text-bone-50 font-medium py-3 px-6 rounded-xl transition-all">
            Start New Assessment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bone-50 py-12 px-4 sm:px-6 relative">
      <ConfettiEffect />
      <style>{`
        @media print {
          body, html {
            background: white !important;
            color: black !important;
          }
          header, footer, nav, button, .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .shadow-card {
            box-shadow: none !important;
            border: 1px solid rgba(0,0,0,0.1) !important;
          }
        }
      `}</style>
      <div className="max-w-4xl mx-auto">
      <header className="p-6 border-b border-ink-900/5 flex justify-between items-center bg-bone-50">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-sage-700 rounded-lg flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-serif text-ink-900">Custodia</span>
        </Link>
        
        {currentState === 3 && (
          <button onClick={handleCopyLink} className="flex items-center gap-2 text-[13px] font-medium text-ink-600 hover:text-ink-900 bg-white border border-ink-900/10 px-3 py-1.5 rounded-lg shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-white">
            {copiedLink ? <CheckCircle2 className="w-4 h-4 text-sage-600" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? 'Copied URL' : 'Share Results'}
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        
        {/* STATE 1: Anonymous Gate */}
        {currentState === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-4xl md:text-5xl font-serif tracking-tight mb-12 text-ink-900">
              Assessment Complete.
            </h1>
            
            <div className="bg-white border border-ink-900/10 rounded-3xl p-10 max-w-2xl mx-auto shadow-card relative overflow-hidden mb-12">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px]" />
              
              <p className="text-[15px] font-medium text-ink-600 mb-6 uppercase tracking-wider">Your preliminary GDPR compliance score</p>
              
              {/* Dial Visualization */}
              <div className="relative w-48 h-48 mx-auto mb-8 max-w-xs md:max-w-none">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="transparent" stroke="#EAE8E4" strokeWidth="8" />
                  <motion.circle 
                    cx="50" cy="50" r="45" fill="transparent" stroke={finalScore < 50 ? "#EF4444" : finalScore <= 75 ? "#F59E0B" : "#00A67E"} strokeWidth="8"
                    strokeDasharray={`${finalScore * 2.82} 282`}
                    initial={{ strokeDasharray: "0 282" }}
                    animate={{ strokeDasharray: `${finalScore * 2.82} 282` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black text-ink-900">{finalScore}%</span>
                  <span className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${finalScore < 50 ? 'text-red-500' : finalScore <= 75 ? 'text-amber-500' : 'text-sage-600'}`}>
                    {finalScore < 50 ? 'High Risk' : finalScore <= 75 ? 'Moderate Risk' : 'Low Risk'}
                  </span>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-ink-900 mb-3">{totalActionItems} recommendations to review.</h2>
              <p className="text-[15px] text-ink-600 mb-8 max-w-lg mx-auto">Enter your email to see your full breakdown, action plan, and GDPR article references.</p>

              <form onSubmit={handleUnlock} className="flex flex-col gap-4 max-w-md mx-auto">
                 <div className="text-left w-full">
                   <label htmlFor="results-email" className="block text-xs font-bold text-ink-700 uppercase tracking-wider mb-2">Business Email Address</label>
                   <div className="relative">
                     <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                     <input 
                       id="results-email"
                       type="email" 
                       required
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       placeholder="name@agency.com" 
                       className="w-full bg-bone-50 border border-ink-900/10 rounded-xl py-3.5 pl-12 pr-4 text-ink-900 placeholder-ink-400 focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500/20 transition-all focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
                     />
                     </div>
                   </div>
                   
                   <label className="flex items-start gap-3 mt-2 cursor-pointer group">
                     <div className="relative flex items-center justify-center mt-0.5">
                       <input 
                         type="checkbox" 
                         checked={marketingConsent}
                         onChange={(e) => setMarketingConsent(e.target.checked)}
                         className="peer appearance-none w-5 h-5 border border-ink-900/20 rounded-md bg-white checked:bg-sage-600 checked:border-sage-600 focus:outline-none focus:ring-2 focus:ring-sage-500/30 transition-all cursor-pointer"
                       />
                       <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 14 10" fill="none">
                         <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                       </svg>
                     </div>
                     <span className="text-sm text-left text-ink-600 leading-tight">Keep me updated about Custodia, including product news and offers</span>
                   </label>
                   
                   <button type="submit" disabled={isCapturing} className="w-full bg-sage-700 hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed text-bone-50 font-medium py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-card focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-white hover:scale-[1.02] active:scale-[0.98] touch-manipulation mt-2">
                   {isCapturing ? 'Processing...' : 'See my results'} <Lock className="w-4 h-4" />
                 </button>
              </form>
              <p className="text-[12px] font-medium text-ink-400 mt-5">We will email you a secure magic link. No password required.</p>
            </div>
          </motion.div>
        )}

        {/* STATE 2: Magic Link Sent */}
        {currentState === 2 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
            <div className="w-20 h-20 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
              <Send className="w-10 h-10 text-sage-600" />
            </div>
            <h1 className="text-4xl font-serif text-ink-900 mb-4">Check your email</h1>
            <p className="text-[16px] text-ink-600 mb-8 max-w-md mx-auto">
              We&apos;ve sent a magic link to <span className="font-semibold text-ink-900">{email}</span>.<br />
              Click the link to securely access your complete GDPR gap assessment.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => handleUnlock({ preventDefault: () => {} } as React.FormEvent)} className="text-[13px] font-medium text-sage-600 hover:text-sage-700 bg-sage-50 px-4 py-2 rounded-lg transition-colors touch-manipulation">
                Resend Magic Link
              </button>
              <button onClick={() => setIsMagicLinkSent(false)} className="text-[13px] font-medium text-ink-500 hover:text-ink-700 bg-bone-100 px-4 py-2 rounded-lg transition-colors touch-manipulation">
                Wrong email?
              </button>
            </div>
          </motion.div>
        )}

        {/* STATE 3: Authenticated Results */}
        {currentState === 3 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="print-container">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-ink-900/10 no-print">
              <div>
                <h1 className="text-3xl font-serif text-ink-900 font-bold">GDPR Audit Readiness Report</h1>
                <p className="text-xs text-ink-500 mt-1">Generated dynamically for your digital agency</p>
              </div>
              <button 
                onClick={async () => {
                  if (id) {
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
                      // Fallback or error toast
                    } finally {
                      setIsDownloading(false);
                    }
                  }
                }} 
                disabled={isDownloading || !id}
                className="inline-flex items-center justify-center gap-2 bg-[#596E51] text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-sage-600 transition-colors shadow-md hover:scale-[1.01] active:scale-[0.99] touch-manipulation focus-visible:ring-2 focus-visible:ring-[#8BA381] focus-visible:outline-none shrink-0 disabled:opacity-70 disabled:pointer-events-none"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
                {isDownloading ? 'Generating...' : 'Download PDF Report'}
              </button>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {/* Score Card */}
              <div className="md:col-span-1 bg-white border border-ink-900/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-card relative overflow-hidden">
                <p className="text-[13px] font-semibold tracking-widest uppercase text-ink-500 mb-6">Overall Score</p>
                <div className="relative w-32 h-32 mb-6 max-w-xs md:max-w-none">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="transparent" stroke="#EAE8E4" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="transparent" stroke={finalScore < 50 ? "#EF4444" : finalScore <= 75 ? "#F59E0B" : "#00A67E"} strokeWidth="8" strokeDasharray={`${finalScore * 2.82} 282`} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-black text-ink-900">{finalScore}%</span>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider ${finalScore < 50 ? 'bg-red-50 text-red-600' : finalScore <= 75 ? 'bg-amber-50 text-amber-600' : 'bg-sage-50 text-sage-700'}`}>
                  {finalScore < 50 ? 'High Risk' : finalScore <= 75 ? 'Moderate Risk' : 'Low Risk'}
                </div>
              </div>

              {/* Comparison */}
              <div className="md:col-span-2 bg-sage-700 text-bone-50 rounded-3xl p-10 flex flex-col justify-center shadow-card relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-sage-600/30 rounded-full blur-3xl"></div>
                <h3 className="text-2xl font-serif mb-8 relative z-10">How do you compare?</h3>
                <div className="space-y-6 relative z-10">
                  <div>
                    <div className="flex justify-between text-[13px] font-medium mb-2">
                      <span className="text-sage-100">Your Agency</span>
                      <span className="font-bold">{finalScore}%</span>
                    </div>
                    <div className="w-full h-2 bg-sage-900/50 rounded-full overflow-hidden">
                      <div className="h-full bg-bone-50 rounded-full" style={{ width: `${finalScore}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[13px] font-medium mb-2">
                      <span className="text-sage-300">Average EU Agency</span>
                      <span className="text-sage-300 font-bold">41%</span>
                    </div>
                    <div className="w-full h-2 bg-sage-900/50 rounded-full overflow-hidden">
                      <div className="h-full bg-sage-400 rounded-full" style={{ width: '41%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[13px] font-medium mb-2">
                      <span className="text-sage-300">Agencies using Custodia</span>
                      <span className="text-sage-100 font-bold">87%</span>
                    </div>
                    <div className="w-full h-2 bg-sage-900/50 rounded-full overflow-hidden">
                      <div className="h-full bg-sage-300 rounded-full" style={{ width: '87%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Items List */}
            <h2 className="text-2xl font-serif text-ink-900 mb-6">Your Action Plan</h2>
            <div className="space-y-4 mb-12">
              {realActionItems.map((item, i) => (
                <div key={i} className="bg-white border border-ink-900/10 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-start gap-4 shadow-sm">
                  <div className="shrink-0 mt-1">
                    {item.priority === 'High' ? (
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-[16px] font-semibold text-ink-900">{item.title}</h4>
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${item.priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                        {item.priority}
                      </span>
                    </div>
                    <div className="inline-block bg-bone-50 border border-ink-900/10 rounded text-[12px] font-medium text-ink-500 px-2 py-1 mb-3">
                      {item.gdprArticleReference}
                    </div>
                    <p className="text-[14px] text-ink-600 leading-relaxed mb-4">
                      {item.description}
                    </p>
                  </div>
                  <div className="sm:text-right sm:self-center shrink-0">
                    <Link href={getFixIssueLink(item.category)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-sage-600 hover:text-sage-700 bg-sage-50 px-3 py-1.5 rounded-lg transition-colors touch-manipulation">
                      Fix Issue <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            {session?.user && (
              <div className="bg-ink-900 rounded-3xl p-10 text-center relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sage-500/10 rounded-full blur-[80px]" />
                <div className="relative z-10">
                  <h3 className="text-2xl font-serif text-bone-50 mb-4">Fix these issues automatically.</h3>
                  <p className="text-[15px] text-bone-50/70 mb-8 max-w-lg mx-auto">
                    Custodia replaces your spreadsheets with a dynamic compliance operating system. Start resolving these action items today.
                  </p>
                  <Link href="/pricing" className="inline-flex bg-sage-600 hover:bg-sage-500 text-white font-medium py-3.5 px-8 rounded-xl transition-all shadow-card touch-manipulation">
                    View Custodia Plans
                  </Link>
                </div>
              </div>
            )}
            
          </motion.div>
        )}
      </main>
      </div>
    </div>
  );
}

export default function AssessmentResults() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bone-50 flex items-center justify-center p-6"><div className="text-ink-600">Loading results...</div></div>}>
      <AssessmentResultsContent />
    </Suspense>
  );
}
