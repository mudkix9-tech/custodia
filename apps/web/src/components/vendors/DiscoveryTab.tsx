"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { 
  Sparkles, ShieldCheck, Trash2, CheckCircle2, AlertTriangle, 
  HelpCircle, Loader2, Play, Archive, Inbox, Globe, Building2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/Toast';

// Mirrors the category palette in the consent Coverage panel, so the same category
// reads the same way in both places.
const CONSENT_CATEGORY_STYLES: Record<string, string> = {
  necessary: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  functional: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  analytics: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  marketing: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  default: 'bg-white/5 text-[#9BA1A6] border-white/10',
};

export function DiscoveryTab() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [subTab, setSubTab] = useState<'inbox' | 'archive'>('inbox');
  const [scanUrl, setScanUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Custom vendor modal state
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState<any>(null);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Marketing');

  // Queries
  const { data: discoveries = [], isLoading: listLoading } = trpc.vendors.getDiscoveries.useQuery({
    status: subTab === 'inbox' ? 'undocumented' : undefined
  });

  const triggerMutation = trpc.vendors.triggerDiscoveryScan.useMutation();
  const confirmMutation = trpc.vendors.confirmDiscovery.useMutation();
  const dismissMutation = trpc.vendors.dismissDiscovery.useMutation();

  // Filter archived ones if subTab is archive
  const displayDiscoveries = subTab === 'inbox' 
    ? discoveries.filter((d: any) => d.discovery.status === 'undocumented')
    : discoveries.filter((d: any) => d.discovery.status !== 'undocumented');

  const handleStartScan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      await triggerMutation.mutateAsync({ websiteUrl: scanUrl || undefined });
      setScanUrl('');
      toast('Discovery scan queued', { description: 'Results appear in the inbox in a few minutes.' });
    } catch (e: any) {
      setScanError(e.message || "Failed to start discovery scan.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmGlobal = async (discoveryId: string, vendorId: string) => {
    try {
      await confirmMutation.mutateAsync({ id: discoveryId, vendorId });
      utils.vendors.getDiscoveries.invalidate();
      utils.vendors.getOrgVendors.invalidate();
    } catch (e: any) {
      toast('Could not confirm the vendor', { tone: 'error', description: e.message });
    }
  };

  const handleOpenCustomModal = (discovery: any) => {
    setSelectedDiscovery(discovery);
    setCustomName(discovery.discovery.detectedServiceName || '');
    setCustomCategory('Marketing');
    setIsCustomModalOpen(true);
  };

  const handleConfirmCustom = async () => {
    if (!selectedDiscovery) return;
    try {
      await confirmMutation.mutateAsync({
        id: selectedDiscovery.discovery.id,
        customVendorData: {
          name: customName,
          category: customCategory,
          website: `https://${selectedDiscovery.discovery.detectedDomain}`
        }
      });
      setIsCustomModalOpen(false);
      setSelectedDiscovery(null);
      utils.vendors.getDiscoveries.invalidate();
      utils.vendors.getOrgVendors.invalidate();
    } catch (e: any) {
      toast('Could not create the vendor', { tone: 'error', description: e.message });
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissMutation.mutateAsync({ id });
      utils.vendors.getDiscoveries.invalidate();
    } catch (e: any) {
      toast('Could not dismiss the finding', { tone: 'error', description: e.message });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Scan Control Header */}
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-lg">
          <h3 className="font-semibold text-[#F4F5F6] text-[15px] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C9A227]" />
            Trigger Website & DNS Discovery Scan
          </h3>
          <p className="text-[13px] text-[#6E747A] leading-relaxed">
            Scan your public site for tracking scripts, pixels, CDNs, and MX/SPF records to discover undocumented shadow IT.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              className="w-full md:w-64"
            />
            <Button
              onClick={handleStartScan}
              disabled={isScanning}
              className="shrink-0"
            >
              {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Scan Website
            </Button>
          </div>
          {scanError && <p className="text-[11px] text-rose-600 font-semibold">{scanError}</p>}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
        
        {/* Navigation Sub-Tabs */}
        <div className="border-b border-white/10 bg-[#08090A]/50 flex px-6 justify-between items-center">
          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={() => setSubTab('inbox')}
              className={`py-4 px-0 h-auto rounded-none text-xs font-semibold uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-colors ${subTab === 'inbox' ? 'border-[#C9A227] text-[#C9A227] hover:text-[#C9A227] hover:bg-transparent' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-transparent'}`}
            >
              <Inbox className="w-4 h-4" />
              Actionable Inbox
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSubTab('archive')}
              className={`py-4 px-0 h-auto rounded-none text-xs font-semibold uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-colors ${subTab === 'archive' ? 'border-[#C9A227] text-[#C9A227] hover:text-[#C9A227] hover:bg-transparent' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6] hover:bg-transparent'}`}
            >
              <Archive className="w-4 h-4" />
              Scan Logs & Archive
            </Button>
          </div>
          <span className="text-[10px] text-[#6E747A] font-bold uppercase tracking-widest">
            {displayDiscoveries.length} items
          </span>
        </div>

        {/* Content list */}
        {listLoading ? (
          <div className="p-12 text-center text-xs text-[#6E747A] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
            Loading scan details...
          </div>
        ) : displayDiscoveries.length === 0 ? (
          <div className="p-16 text-center text-xs text-[#6E747A]">
            No discoveries logged in this view.
          </div>
        ) : (
          <div className="divide-y divide-ink-900/5">
            {displayDiscoveries.map(({ discovery, matchedVendor, tracker }: any) => {
              // Deduce confidence matching if undocumented
              let matchBadge = null;
              if (discovery.status === 'undocumented') {
                if (matchedVendor) {
                  matchBadge = (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Global Registry Match
                    </span>
                  );
                } else {
                  matchBadge = (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-900/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <HelpCircle className="w-3 h-3 text-amber-400" />
                      Unrecognized Domain
                    </span>
                  );
                }
              } else {
                let badgeStyle = 'bg-white/5 text-[#9BA1A6] border-white/10';
                if (discovery.status === 'added_to_register') {
                  badgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                } else if (discovery.status === 'dismissed') {
                  badgeStyle = 'bg-neutral-100 text-neutral-500 border-neutral-200';
                }
                matchBadge = (
                  <span className={`inline-flex items-center gap-1 border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeStyle}`}>
                    {discovery.status.replace(/_/g, ' ')}
                  </span>
                );
              }

              return (
                <div key={discovery.id} className="p-6 flex items-start justify-between hover:bg-[#08090A]/20 transition-colors">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/50 border border-white/5 flex items-center justify-center shrink-0">
                      {discovery.discoveryMethod === 'dns_analysis' ? (
                        <Globe className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <Building2 className="w-5 h-5 text-[#C9A227]" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-[#F4F5F6]">
                          {discovery.detectedServiceName || discovery.detectedDomain}
                        </h4>
                        <span className="text-[10px] text-[#6E747A] font-medium">({discovery.detectedDomain})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#6E747A] capitalize">
                          Source: {discovery.discoveryMethod.replace('_', ' ')}
                        </span>
                        <span className="text-[#6E747A] text-xs">|</span>
                        <span className="text-xs text-[#6E747A]">
                          First seen: {new Date(discovery.firstDetectedAt).toLocaleDateString()}
                        </span>
                        <span className="text-[#6E747A] text-xs">|</span>
                        {matchBadge}
                        {/* The consent category this host needs, resolved from the
                            tracker registry. Whoever triages this inbox has to
                            decide whether the banner covers it, and a bare
                            hostname does not answer that. */}
                        {tracker?.requiredCategory && (
                          <>
                            <span className="text-[#6E747A] text-xs">|</span>
                            <span
                              className={`inline-flex items-center gap-1 border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                CONSENT_CATEGORY_STYLES[tracker.requiredCategory] ?? CONSENT_CATEGORY_STYLES.default
                              }`}
                              title={`${tracker.provider} requires consent for "${tracker.requiredCategory}" before it may run.`}
                            >
                              Needs {tracker.requiredCategory} consent
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {discovery.status === 'undocumented' && (
                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDismiss(discovery.id)}
                        className="text-[#6E747A] hover:text-[#F4F5F6] hover:bg-white/5 transition-colors border border-white/10"
                        title="Dismiss / Ignore"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {matchedVendor ? (
                        <Button
                          onClick={() => handleConfirmGlobal(discovery.id, matchedVendor.id)}
                        >
                          Link {matchedVendor.name}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => handleOpenCustomModal({ discovery })}
                          className="bg-indigo-500/10 text-indigo-400 border-indigo-900/50 hover:bg-indigo-500/15 hover:text-indigo-300"
                        >
                          Add Custom Vendor
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Custom Vendor Modal */}
      {isCustomModalOpen && selectedDiscovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0D0F11] border border-white/10 rounded-2xl w-full max-w-[450px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-serif text-lg text-[#F4F5F6]">Add Discovered Vendor</h3>
              <Button
                variant="ghost" 
                onClick={() => { setIsCustomModalOpen(false); setSelectedDiscovery(null); }} 
                className="text-[#6E747A] hover:text-[#F4F5F6] text-xl h-auto px-2 py-1"
              >
                &times;
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6E747A] uppercase tracking-wider">Service Name</label>
                <Input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6E747A] uppercase tracking-wider">Domain (Website)</label>
                <Input
                  type="text"
                  value={selectedDiscovery.discovery.detectedDomain}
                  disabled
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6E747A] uppercase tracking-wider">Category</label>
                <Select
                  value={customCategory}
                  onValueChange={(val) => setCustomCategory(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Analytics">Analytics</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Hosting">Hosting / Infrastructure</SelectItem>
                    <SelectItem value="Customer Support">Customer Support</SelectItem>
                    <SelectItem value="HR / Payroll">HR / Payroll</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-900/50 text-amber-300 rounded-xl p-3.5 text-xs flex gap-2.5 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Profile Verification Warning</span>
                  This vendor will be added as a custom profile marked as auto-discovered. You will be prompted to complete their data locations and certifications inside their details page.
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-[#08090A]/50 flex justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => { setIsCustomModalOpen(false); setSelectedDiscovery(null); }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCustom}
              >
                Create and Link
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
