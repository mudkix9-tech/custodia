'use client';

import React, { useState, useRef } from 'react';
import { trpc } from '@/utils/trpc';
import { Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';

export default function DpaAnalyzerPage() {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = trpc.ai.analyzeDpa.useMutation({
    onSuccess: (data) => {
      setAnalysis(data);
    },
    onError: (err) => {
      toast('Could not analyse the DPA', { tone: 'error', description: err.message });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setAnalysis(null);
    }
  };

  const handleAnalyze = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Str = (e.target?.result as string).split(',')[1];
      analyzeMutation.mutate({ fileBase64: base64Str });
    };
    reader.readAsDataURL(file);
  };

  const statusColors = {
    present: 'bg-green-500/20 text-green-400 border-green-200',
    weak: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    missing: 'bg-red-500/20 text-red-400 border-red-900/50'
  };

  const statusIcons = {
    present: <CheckCircle2 className="w-5 h-5 text-green-400" />,
    weak: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
    missing: <AlertCircle className="w-5 h-5 text-red-400" />
  };

  return (
    <div className="max-w-[900px] mx-auto p-8 fade-up space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/vendors" className="text-sm text-indigo-400 hover:underline mb-2 inline-block">&larr; Back to Vendors</Link>
          <h1 className="text-3xl font-serif text-[#F4F5F6] mb-2 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-indigo-400" /> AI DPA Analyzer
          </h1>
          <p className="text-[#9BA1A6] text-[15px]">Automatically review Vendor Data Processing Agreements against Article 28.</p>
        </div>
      </div>

      {!analysis && (
        <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-8 text-center">
          <div className="max-w-md mx-auto space-y-6">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-[#F4F5F6]">Upload DPA (PDF)</h3>
              <p className="text-sm text-[#6E747A] mt-1">Select a signed or draft DPA to analyze for GDPR compliance gaps.</p>
            </div>
            
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#0D0F11] border border-white/10 hover:bg-white/5 text-[#E6E8EA] font-medium py-3 rounded-xl transition-colors"
              >
                {file ? file.name : 'Select PDF File'}
              </button>

              <button 
                onClick={handleAnalyze}
                disabled={!file || analyzeMutation.isPending}
                className="w-full bg-[#C9A227] hover:bg-[#E5C463] disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-panel-elevated"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Analyzing Document...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" /> Analyze DPA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated p-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#F4F5F6]">Analysis Results</h2>
              <p className="text-sm text-[#6E747A] mt-1">File: {file?.name}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-serif text-indigo-400">{analysis.overall_score}/100</div>
              <div className="text-sm font-medium text-[#6E747A] uppercase tracking-wide">Compliance Score</div>
            </div>
          </div>

          <div className="space-y-4">
            {analysis.clauses?.map((clause: any, i: number) => (
              <ClauseItem key={i} clause={clause} statusColors={statusColors} statusIcons={statusIcons} />
            ))}
          </div>

          <div className="flex justify-center mt-8">
            <button 
              onClick={() => { setAnalysis(null); setFile(null); }}
              className="text-indigo-400 font-medium hover:underline"
            >
              Analyze another document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClauseItem({ clause, statusColors, statusIcons }: any) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-[#0D0F11] border border-white/10 rounded-xl shadow-panel-elevated overflow-hidden transition-all">
      <div 
        className="p-5 flex items-center gap-4 cursor-pointer hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">
          {statusIcons[clause.status as keyof typeof statusIcons]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h4 className="text-base font-semibold text-[#F4F5F6] capitalize">
              {clause.id.replace(/_/g, ' ')}
            </h4>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider ${statusColors[clause.status as keyof typeof statusColors]}`}>
              {clause.status}
            </span>
          </div>
          <p className="text-sm text-[#6E747A] mt-1 truncate">
            {clause.notes || (clause.status === 'present' ? 'Clause verified compliant.' : 'Review required.')}
          </p>
        </div>
        <div className="flex-shrink-0 text-[#6E747A]">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>
      
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-white/10 bg-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <h5 className="text-xs font-bold text-[#6E747A] uppercase tracking-wider mb-2">Analysis Notes</h5>
              <p className="text-sm text-[#E6E8EA] leading-relaxed bg-[#0D0F11] p-3 rounded-lg border border-white/10 shadow-panel-elevated">
                {clause.notes || 'No specific notes provided. Clause appears compliant with Article 28.'}
              </p>
            </div>
            <div>
              <h5 className="text-xs font-bold text-[#6E747A] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Extracted Excerpt</span>
                {clause.location && <span className="text-[#6E747A] font-normal">Found in: {clause.location}</span>}
              </h5>
              <div className="text-sm text-[#9BA1A6] leading-relaxed bg-[#0D0F11] p-3 rounded-lg border border-white/10 shadow-panel-elevated italic h-full">
                {clause.excerpt ? `"${clause.excerpt}"` : 'No relevant excerpt extracted.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
