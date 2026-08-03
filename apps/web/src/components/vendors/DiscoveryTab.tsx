"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { 
  Sparkles, ShieldCheck, Trash2, CheckCircle2, AlertTriangle, 
  HelpCircle, Loader2, Play, Archive, Inbox, Globe, Building2 
} from 'lucide-react';

export function DiscoveryTab() {
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
      alert("Vendor discovery scan queued. Results will appear in the inbox in a few minutes.");
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
      alert("Failed to confirm: " + e.message);
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
      alert("Failed to create custom vendor: " + e.message);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissMutation.mutateAsync({ id });
      utils.vendors.getDiscoveries.invalidate();
    } catch (e: any) {
      alert("Failed to dismiss: " + e.message);
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
            <input
              type="url"
              placeholder="https://example.com"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              className="bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sage-500/20 w-full md:w-64"
            />
            <button
              onClick={handleStartScan}
              disabled={isScanning}
              className="bg-sage-700 hover:bg-sage-600 disabled:opacity-50 text-white font-medium text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-panel-elevated"
            >
              {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Scan Website
            </button>
          </div>
          {scanError && <p className="text-[11px] text-rose-600 font-semibold">{scanError}</p>}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-[#0D0F11] border border-white/10 rounded-2xl shadow-panel-elevated overflow-hidden">
        
        {/* Navigation Sub-Tabs */}
        <div className="border-b border-white/10 bg-[#08090A]/50 flex px-6 justify-between items-center">
          <div className="flex gap-4">
            <button
              onClick={() => setSubTab('inbox')}
              className={`py-4 text-xs font-semibold uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-colors ${subTab === 'inbox' ? 'border-sage-600 text-[#C9A227]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6]'}`}
            >
              <Inbox className="w-4 h-4" />
              Actionable Inbox
            </button>
            <button
              onClick={() => setSubTab('archive')}
              className={`py-4 text-xs font-semibold uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-colors ${subTab === 'archive' ? 'border-sage-600 text-[#C9A227]' : 'border-transparent text-[#6E747A] hover:text-[#F4F5F6]'}`}
            >
              <Archive className="w-4 h-4" />
              Scan Logs & Archive
            </button>
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
            {displayDiscoveries.map(({ discovery, matchedVendor }: any) => {
              // Deduce confidence matching if undocumented
              let matchBadge = null;
              if (discovery.status === 'undocumented') {
                if (matchedVendor) {
                  matchBadge = (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Global Registry Match
                    </span>
                  );
                } else {
                  matchBadge = (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-900/50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <HelpCircle className="w-3 h-3 text-amber-400" />
                      Unrecognized Domain
                    </span>
                  );
                }
              } else {
                let badgeStyle = 'bg-white/5 text-[#9BA1A6] border-white/10';
                if (discovery.status === 'added_to_register') {
                  badgeStyle = 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20';
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
                    <div className="w-10 h-10 rounded-xl bg-white/5/50 border border-white/5 flex items-center justify-center shrink-0">
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
                        <span className="text-ink-200 text-xs">|</span>
                        <span className="text-xs text-[#6E747A]">
                          First seen: {new Date(discovery.firstDetectedAt).toLocaleDateString()}
                        </span>
                        <span className="text-ink-200 text-xs">|</span>
                        {matchBadge}
                      </div>
                    </div>
                  </div>

                  {discovery.status === 'undocumented' && (
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleDismiss(discovery.id)}
                        className="p-2 border border-white/10 text-[#6E747A] hover:text-ink-950 hover:bg-white/5 rounded-lg transition-colors"
                        title="Dismiss / Ignore"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {matchedVendor ? (
                        <button
                          onClick={() => handleConfirmGlobal(discovery.id, matchedVendor.id)}
                          className="bg-sage-700 hover:bg-sage-600 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-panel-elevated transition-colors"
                        >
                          Link {matchedVendor.name}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenCustomModal({ discovery })}
                          className="bg-indigo-500/10 text-indigo-400 border border-indigo-900/50 hover:bg-indigo-100 font-semibold text-xs px-4 py-2 rounded-lg shadow-panel-elevated transition-colors"
                        >
                          Add Custom Vendor
                        </button>
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
              <button 
                onClick={() => { setIsCustomModalOpen(false); setSelectedDiscovery(null); }} 
                className="text-[#6E747A] hover:text-[#F4F5F6] text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6E747A] uppercase tracking-wider">Service Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6E747A] uppercase tracking-wider">Domain (Website)</label>
                <input
                  type="text"
                  value={selectedDiscovery.discovery.detectedDomain}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#6E747A]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#6E747A] uppercase tracking-wider">Category</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full bg-[#0D0F11] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                >
                  <option value="Analytics">Analytics</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Hosting">Hosting / Infrastructure</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="HR / Payroll">HR / Payroll</option>
                  <option value="Other">Other</option>
                </select>
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
              <button
                onClick={() => { setIsCustomModalOpen(false); setSelectedDiscovery(null); }}
                className="px-3.5 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-xs font-semibold text-[#E6E8EA] transition-colors shadow-panel-elevated"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCustom}
                className="bg-sage-700 hover:bg-sage-600 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-panel-elevated transition-colors"
              >
                Create and Link
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
