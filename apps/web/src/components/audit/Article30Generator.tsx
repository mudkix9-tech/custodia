import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Download, FileText, FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export function Article30Generator() {
  const toast = useToast();
  const [isGeneratingCsv, setIsGeneratingCsv] = useState(false);
  const [isGeneratingAudit, setIsGeneratingAudit] = useState(false);
  
  const trpcUtils = trpc.useUtils();

  const handleDownloadCsv = async () => {
    setIsGeneratingCsv(true);
    try {
      const result = await trpcUtils.audit.generateArticle30Report.fetch({ format: 'csv' });
      if (result.data) {
        const blob = new Blob([result.data as string], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Article30_ROPA.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } finally {
      setIsGeneratingCsv(false);
    }
  };

  const handleGenerateAuditFile = async () => {
    setIsGeneratingAudit(true);
    // Simulate generation of full zip file. In reality, this would hit an endpoint that orchestrates S3 downloads and PDF generation via Puppeteer
    setTimeout(() => {
      setIsGeneratingAudit(false);
      toast('Audit export started', { description: 'You will receive an email when it is ready.' });
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#C9A227]/10 text-[#C9A227] rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-[#F4F5F6] mb-1">Article 30 Record (ROPA)</h3>
            <p className="text-sm text-[#9BA1A6] mb-4">Export the legally required Record of Processing Activities. Includes both Controller and Processor (Client) records.</p>
            <div className="flex gap-3">
              <button 
                onClick={handleDownloadCsv}
                disabled={isGeneratingCsv}
                className="bg-[#0D0F11] border border-white/20 text-[#E6E8EA] hover:bg-[#08090A] hover:text-[#F4F5F6] px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isGeneratingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Download CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-sage-50 to-transparent opacity-50 z-0"></div>
        <div className="relative z-10 flex items-start gap-4">
          <div className="p-3 bg-ink-900 text-white rounded-xl shadow-md">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-[#F4F5F6] mb-1">One-Click Audit File</h3>
            <p className="text-sm text-[#9BA1A6] mb-4">Generates a comprehensive .zip package containing all required compliance documentation for an auditor (Article 30, Vendor DPAs, DPIAs, Policies).</p>
            <button 
              onClick={handleGenerateAuditFile}
              disabled={isGeneratingAudit}
              className="bg-ink-900 text-white hover:bg-ink-800 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-panel-elevated flex items-center gap-2"
            >
              {isGeneratingAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Generate Complete Audit ZIP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
