"use client";

import React, { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { AlertTriangle, Plus, ShieldAlert, ArrowRight, Loader2, Save, Trash2 } from 'lucide-react';
import { DataGrid } from 'ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export interface DpiaResidualRisk {
  id: string;
  description: string;
  riskCategory: 'confidentiality' | 'integrity' | 'availability' | 'unlawful_processing' | 'discrimination' | 'other';
  likelihood: 'low' | 'medium' | 'high';
  severity: 'low' | 'medium' | 'high';
  residualRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  relatedVendorId?: string | null;
  relatedProcessingActivityId?: string | null;
  mitigationRequired: boolean;
  mitigationDescription?: string | null;
  mitigationOwner?: string | null;
  mitigationDueDate?: string | null;
  mitigationStatus: 'not_started' | 'in_progress' | 'completed';
  // Both are part of the server's dpiaResidualRiskSchema and round-trip through
  // the jsonb column; the interface simply never listed them.
  prePopulatedType?: 'missing_dpa' | 'clause_gaps' | 'missing_certs' | 'high_risk_flag' | null;
  alreadyReflectedInBaseScore?: boolean | null;
}

function computeResidualRiskLevel(likelihood: 'low' | 'medium' | 'high', severity: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' | 'critical' {
  if (likelihood === 'low') {
    if (severity === 'high') return 'medium';
    return 'low';
  }
  if (likelihood === 'medium') {
    if (severity === 'low') return 'low';
    if (severity === 'medium') return 'medium';
    return 'high';
  }
  // High likelihood
  if (severity === 'low') return 'medium';
  if (severity === 'high') return 'critical';
  return 'high';
}

function getRiskLevelBadge(level: string) {
  switch (level) {
    case 'low':
      return 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/50';
    case 'medium':
      return 'bg-amber-500/10 text-amber-400 border-amber-900/50';
    case 'high':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'critical':
      return 'bg-red-500/10 text-red-400 border-red-900/50';
    default:
      return 'bg-white/5 text-[#9BA1A6] border-white/10';
  }
}

const matchVendorFromDescription = (description: string, orgVendors: any[]) => {
  if (!description || !orgVendors || orgVendors.length === 0) return null;
  const descLower = description.toLowerCase().trim();
  for (const v of orgVendors) {
    const namesToCheck = [v.name, ...(v.aliases || [])].map((n: string) => n.toLowerCase().trim()).filter(Boolean);
    for (const name of namesToCheck) {
      const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
      if (regex.test(descLower)) return v;
    }
  }
  return null;
};

export function DpiaTab({ activityId, dpiaId, onDpiaLinked }: { activityId: string, dpiaId?: string | null, onDpiaLinked: (id: string) => void }) {
  const [isCreating, setIsCreating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [localResidualRisks, setLocalResidualRisks] = useState<DpiaResidualRisk[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Queries
  const { data: dpia, refetch: refetchDpia, isLoading: isLoadingDpia } = trpc.dpia.get.useQuery(
    { id: dpiaId! },
    { enabled: !!dpiaId }
  );

  const { data: risks, refetch: refetchRisks } = trpc.dpia.risks.list.useQuery(
    { dpiaId: dpiaId! },
    { enabled: !!dpiaId }
  );

  const { data: allDpias } = trpc.dpia.list.useQuery(undefined, { enabled: !dpiaId });
  const { data: orgVendorsResp } = trpc.vendors.getOrgVendors.useQuery({ limit: 100 });
  const orgVendors = orgVendorsResp?.data || [];

  const { data: ropaResp } = trpc.ropa.list.useQuery({ limit: 100 });
  const ropaActivities = ropaResp?.data || [];

  const { data: recipients = [] } = trpc.ropa.recipients.list.useQuery({ processingActivityId: activityId });
  const { data: teamMembers = [] } = trpc.team.list.useQuery();

  // Mutations
  const createDpiaMutation = trpc.dpia.create.useMutation();
  const updateActivityMutation = trpc.ropa.update.useMutation();
  const createRiskMutation = trpc.dpia.risks.create.useMutation();
  const updateResidualRisksMutation = trpc.dpia.updateResidualRisks.useMutation();
  const updateMitigationStatusMutation = trpc.dpia.updateMitigationStatus.useMutation();

  const handleMitigationStatusChange = async (riskId: string, newStatus: 'not_started' | 'in_progress' | 'completed') => {
    if (!dpiaId) return;
    
    // Optimistic update
    setLocalResidualRisks(prev => prev.map(r => r.id === riskId ? { ...r, mitigationStatus: newStatus } : r));
    
    try {
      await updateMitigationStatusMutation.mutateAsync({
        dpiaId,
        riskId,
        mitigationStatus: newStatus
      });
      refetchRisks();
    } catch (error) {
      console.error('Failed to update mitigation status', error);
      // Revert to fetched state on error
      if (dpia?.residualRisks) {
        setLocalResidualRisks(dpia.residualRisks);
      }
    }
  };

  // Initialize local residual risks from query
  useEffect(() => {
    if (dpia?.residualRisks) {
      setLocalResidualRisks(dpia.residualRisks);
    } else {
      setLocalResidualRisks([]);
    }
  }, [dpia?.residualRisks]);

  // Debounced auto-save for residual risks
  useEffect(() => {
    if (!dpiaId) return;

    // Check if there is an actual difference to prevent infinite loop/save on load
    const isDifferent = JSON.stringify(localResidualRisks) !== JSON.stringify(dpia?.residualRisks || []);
    if (!isDifferent) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await updateResidualRisksMutation.mutateAsync({
          dpiaId,
          residualRisks: localResidualRisks
        });
        setSaveStatus('saved');
        refetchDpia();
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        setSaveStatus('error');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [localResidualRisks, dpiaId]);

  // Smooth scroll and highlight risk card based on URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#risk-')) {
      const targetId = hash.substring(1);
      const element = document.getElementById(targetId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-[#C9A227]/50', 'ring-offset-2', 'transition-all', 'duration-500');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-[#C9A227]/50', 'ring-offset-2');
          }, 3000);
        }, 500);
      }
    }
  }, [localResidualRisks]);

  const handleCreateDpia = async () => {
    setIsCreating(true);
    try {
      const newDpia = await createDpiaMutation.mutateAsync({
        title: 'New DPIA for Activity',
        processingActivityIds: [activityId]
      });
      await updateActivityMutation.mutateAsync({
        id: activityId,
        data: { dpiaId: newDpia.id }
      });
      onDpiaLinked(newDpia.id);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLinkDpia = async (existingId: string) => {
    setIsLinking(true);
    try {
      await updateActivityMutation.mutateAsync({
        id: activityId,
        data: { dpiaId: existingId }
      });
      onDpiaLinked(existingId);
    } finally {
      setIsLinking(false);
    }
  };

  const handleAddRisk = async () => {
    if (!dpiaId) return;
    await createRiskMutation.mutateAsync({
      dpiaId,
      description: 'New Risk Identified',
      likelihood: 3,
      severity: 3
    });
    refetchRisks();
  };

  const handleAddResidualRisk = () => {
    if (!dpiaId) return;
    
    const randomId = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const newRisk: DpiaResidualRisk = {
      id: randomId,
      description: '',
      riskCategory: 'other',
      likelihood: 'low',
      severity: 'low',
      residualRiskLevel: 'low',
      relatedProcessingActivityId: activityId, // Pre-populate with current ROPA activity
      mitigationRequired: false,
      mitigationStatus: 'not_started',
    };

    setLocalResidualRisks(prev => [...prev, newRisk]);
  };

  const handleAddHighRiskVendorRisk = (vendor: any) => {
    const randomId = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const newRisk: DpiaResidualRisk = {
      id: randomId,
      description: `High risk profile flagged for vendor: ${vendor.name}`,
      riskCategory: 'other',
      likelihood: 'high',
      severity: 'high',
      residualRiskLevel: 'critical',
      relatedVendorId: vendor.orgVendorId,
      relatedProcessingActivityId: activityId,
      mitigationRequired: true,
      mitigationStatus: 'not_started',
      mitigationDescription: `Implement continuous security monitoring and conduct annual security audits for ${vendor.name}.`,
      prePopulatedType: 'high_risk_flag',
      alreadyReflectedInBaseScore: false,
    };

    setLocalResidualRisks(prev => [...prev, newRisk]);
  };

  // Find linked vendors that are high or critical risk
  const highRiskVendors = recipients
    .filter((r: any) => r.recipientType === 'vendor' && r.vendorId)
    .map((r: any) => orgVendors.find((v: any) => v.orgVendorId === r.vendorId))
    .filter((v: any) => v && (v.riskLevel === 'high' || v.riskLevel === 'critical'));

  // Filter to only those that haven't been auto-documented yet
  const activeHighRiskVendors = highRiskVendors.filter((vendor: any) => {
    return !localResidualRisks.some(r => r.relatedVendorId === vendor.orgVendorId && r.prePopulatedType === 'high_risk_flag');
  });

  const handleDeleteResidualRisk = (id: string) => {
    setLocalResidualRisks(prev => prev.filter(r => r.id !== id));
  };

  const handleFieldChange = (id: string, field: keyof DpiaResidualRisk, value: any) => {
    setLocalResidualRisks(prev => prev.map(risk => {
      if (risk.id !== id) return risk;
      const updatedRisk = { ...risk, [field]: value };
      
      // Recompute residualRiskLevel if likelihood or severity changes
      if (field === 'likelihood' || field === 'severity') {
        updatedRisk.residualRiskLevel = computeResidualRiskLevel(
          updatedRisk.likelihood,
          updatedRisk.severity
        );
      }
      return updatedRisk;
    }));
  };

  if (isLoadingDpia && dpiaId) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#C9A227]" /></div>;
  }

  if (!dpiaId || !dpia) {
    return (
      <div className="space-y-6 max-w-3xl fade-up">
        <div className="bg-[#08090A] hairline rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 text-clay-600" />
          </div>
          <h2 className="text-[16px] font-medium text-[#F4F5F6]">Data Protection Impact Assessment</h2>
          <p className="text-[13.5px] text-[#6E747A] max-w-lg mx-auto leading-relaxed">
            A DPIA is required if this processing activity is likely to result in a high risk to the rights and freedoms of individuals.
          </p>
          
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button
              onClick={handleCreateDpia}
              disabled={isCreating}
              className="flex items-center gap-2"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create New DPIA
            </Button>
          </div>
        </div>

        {allDpias && allDpias.length > 0 && (
          <div className="bg-[#08090A] hairline rounded-2xl p-6">
            <h3 className="text-[13px] font-medium text-[#F4F5F6] mb-4">Or Link Existing DPIA</h3>
            <div className="space-y-2">
              {allDpias.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-[#0D0F11] hairline rounded-xl">
                  <div>
                    <div className="text-[13px] font-medium text-[#F4F5F6]">{d.title}</div>
                    <div className="text-[12px] text-[#6E747A]">Status: {d.status}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLinkDpia(d.id)}
                    disabled={isLinking}
                    className="text-[#C9A227] hover:text-[#C9A227] border-[#C9A227]/30 hover:bg-[#C9A227]/10 transition-colors"
                  >
                    Link to this activity
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const riskColumns = [
    { header: 'Risk Description', accessorKey: 'description' },
    { 
      header: 'Likelihood (1-5)', 
      accessorKey: 'likelihood',
      cell: (info: any) => (
        <span className="px-2 py-1 bg-white/5 rounded text-[#E6E8EA] font-medium">L{info.getValue()}</span>
      )
    },
    { 
      header: 'Severity (1-5)', 
      accessorKey: 'severity',
      cell: (info: any) => (
        <span className="px-2 py-1 bg-white/5 rounded text-[#E6E8EA] font-medium">S{info.getValue()}</span>
      )
    },
    { 
      header: 'Risk Score', 
      accessorKey: 'initialRiskScore',
      cell: (info: any) => {
        const score = info.getValue();
        const color = score >= 15 ? 'bg-red-500/15 text-red-400' : score >= 8 ? 'bg-amber-500/15 text-amber-400' : 'bg-[#C9A227]/15 text-[#C9A227]';
        return <span className={`px-2 py-1 rounded font-medium ${color}`}>{score}</span>;
      }
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl fade-up">
      {/* DPIA Header */}
      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[16px] font-medium text-[#F4F5F6]">{dpia.title}</h2>
            <div className="text-[13px] text-[#6E747A] mt-1">Status: <span className="font-medium text-[#E6E8EA]">{dpia.status}</span></div>
          </div>
          <Button variant="outline" className="text-[#E6E8EA] flex items-center gap-1.5 h-auto py-1.5 px-3 text-[12.5px]">
            View Full DPIA <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-ink-900/8">
          <div>
            <label className="text-[12.5px] font-medium text-[#E6E8EA]">Overall Initial Risk Level</label>
            <div className="mt-1 text-[14px] font-medium text-clay-600">{dpia.overallRiskLevel || 'Not Calculated'}</div>
          </div>
          <div>
            <label className="text-[12.5px] font-medium text-[#E6E8EA]">Residual Risk Level</label>
            <div className="mt-1 text-[14px] font-medium text-[#C9A227]">{dpia.residualRiskLevel || 'Pending Mitigations'}</div>
          </div>
        </div>
      </div>

      {/* High Risk Vendor Warnings */}
      {activeHighRiskVendors.map((vendor: any) => (
        <div key={vendor.orgVendorId} className="bg-amber-500/10 border border-amber-900/50 rounded-xl p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-amber-300 animate-in fade-in duration-200">
          <div className="flex gap-3 leading-relaxed">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="text-[13px]">
              <span className="font-bold block mb-0.5 text-amber-950">High Risk Vendor Warning</span>
              Vendor <strong>{vendor.name}</strong> linked to this activity is currently flagged as <strong>{vendor.riskLevel} risk</strong> (Score: {vendor.riskScore}). Consider documenting this as a residual risk in your assessment.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => handleAddHighRiskVendorRisk(vendor)}
            className="text-amber-300 bg-[#0D0F11] border-amber-900/50 hover:bg-amber-500/15 self-start sm:self-center shrink-0 shadow-panel-elevated"
          >
            Document Risk
          </Button>
        </div>
      ))}

      {/* Risk Matrix & Mitigations (Initial Risks) */}
      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-medium text-[#F4F5F6]">Initial Risk Assessment</h3>
          <Button 
            variant="outline"
            size="icon"
            onClick={handleAddRisk}
            className="w-7 h-7 bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 border-none"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {risks && risks.length > 0 ? (
          <DataGrid 
            columns={riskColumns} 
            data={risks} 
            mode="compact" 
          />
        ) : (
          <div className="py-8 text-center border border-dashed border-white/20 rounded-xl bg-[#0D0F11]/50">
            <p className="text-[13px] text-[#6E747A]">No initial risks identified yet.</p>
          </div>
        )}
      </div>

      {/* Residual Risks & Mitigations (Structured) */}
      <div className="bg-[#08090A] hairline rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-medium text-[#F4F5F6]">Residual Risks & Mitigations</h3>
            {saveStatus === 'saving' && (
              <span className="text-[11px] text-[#6E747A] flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </span>
            )}
            {saveStatus === 'saved' && <span className="text-[11px] text-[#C9A227] font-medium">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-[11px] text-clay-600 font-medium">⚠ Save failed</span>}
          </div>
          <Button 
            variant="outline"
            size="sm"
            onClick={handleAddResidualRisk}
            className="bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 border-none flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Residual Risk
          </Button>
        </div>

        {localResidualRisks.length > 0 ? (
          <div className="space-y-4">
            {localResidualRisks.map((risk, index) => {
              const matchedVendor = matchVendorFromDescription(risk.description, orgVendors);

              return (
                <div key={risk.id || index} id={`risk-${risk.id}`} className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated space-y-4 transition-all duration-300">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-[13px] font-medium text-[#E6E8EA]">Residual Risk #{index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteResidualRisk(risk.id)}
                      className="text-[#6E747A] hover:text-clay-600 hover:bg-red-500/10"
                      title="Delete residual risk"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-[12.5px] font-medium text-[#E6E8EA]">Risk Description</label>
                      <Textarea
                        value={risk.description || ''}
                        onChange={(e) => handleFieldChange(risk.id, 'description', e.target.value)}
                        placeholder="e.g. Unauthorized access to health records via third-party vendor"
                        rows={3}
                      />
                      
                      {/* Vendor suggestion banner */}
                      {matchedVendor && risk.relatedVendorId !== matchedVendor.orgVendorId && (
                        <div className="mt-1 flex items-center justify-between p-2 bg-[#C9A227]/10 border border-[#C9A227]/30 rounded-lg text-[12px] text-[#C9A227]">
                          <span className="flex items-center gap-1.5">
                            💡 Suggestion: Link to vendor <strong>{matchedVendor.name}</strong>?
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => handleFieldChange(risk.id, 'relatedVendorId', matchedVendor.orgVendorId)}
                            className="text-[11px] font-bold text-[#C9A227] hover:text-[#E5C463] bg-[#0D0F11] border-[#C9A227]/30 h-auto py-0.5 px-2"
                          >
                            Link Vendor
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Categories, Vendor, Activity Links */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[12.5px] font-medium text-[#E6E8EA]">Risk Category</label>
                          <Select
                            value={risk.riskCategory || 'other'}
                            onValueChange={(value) => handleFieldChange(risk.id, 'riskCategory', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="confidentiality">Confidentiality</SelectItem>
                              <SelectItem value="integrity">Integrity</SelectItem>
                              <SelectItem value="availability">Availability</SelectItem>
                              <SelectItem value="unlawful_processing">Unlawful Processing</SelectItem>
                              <SelectItem value="discrimination">Discrimination</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[12.5px] font-medium text-[#E6E8EA]">Related Vendor</label>
                          <Select
                            value={risk.relatedVendorId || 'none'}
                            onValueChange={(value) => handleFieldChange(risk.id, 'relatedVendorId', value === 'none' ? null : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="None / Not Vendor Related" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None / Not Vendor Related</SelectItem>
                              {orgVendors.map((v) => (
                                <SelectItem key={v.orgVendorId} value={v.orgVendorId}>{v.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {/* Compact Vendor Risk Card */}
                          {risk.relatedVendorId && (() => {
                            // getOrgVendors merges the vendor row in, so a vendor
                            // deleted from the catalogue leaves the entry without
                            // an id — don't render a card keyed on undefined.
                            const vObj = orgVendors.find(v => v.orgVendorId === risk.relatedVendorId);
                            return vObj?.id ? <VendorRiskCard vendorId={vObj.id} /> : null;
                          })()}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[12.5px] font-medium text-[#E6E8EA]">Related Processing Activity (ROPA)</label>
                        <Select
                          value={risk.relatedProcessingActivityId || 'none'}
                          onValueChange={(value) => handleFieldChange(risk.id, 'relatedProcessingActivityId', value === 'none' ? null : value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="None / Primary Subject Activity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None / Primary Subject Activity</SelectItem>
                            {ropaActivities.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Likelihood, Severity, Calculated Residual Level */}
                  <div className="grid grid-cols-3 gap-4 items-end pt-3 border-t border-white/5">
                    <div className="space-y-1.5">
                      <label className="text-[12.5px] font-medium text-[#E6E8EA]">Likelihood</label>
                      <Select
                        value={risk.likelihood || 'low'}
                        onValueChange={(value) => handleFieldChange(risk.id, 'likelihood', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12.5px] font-medium text-[#E6E8EA]">Severity</label>
                      <Select
                        value={risk.severity || 'low'}
                        onValueChange={(value) => handleFieldChange(risk.id, 'severity', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 flex flex-col justify-end">
                      <span className="text-[12.5px] font-medium text-[#6E747A] mb-1">Residual Risk Level</span>
                      <div className="flex">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${getRiskLevelBadge(risk.residualRiskLevel)}`}>
                          {risk.residualRiskLevel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mitigation Required Checkbox */}
                  <div className="pt-2">
                    <label className="flex items-center gap-2.5 cursor-pointer text-[13px] font-medium text-[#E6E8EA]">
                      <Switch
                        checked={risk.mitigationRequired || false}
                        onCheckedChange={(checked) => handleFieldChange(risk.id, 'mitigationRequired', checked)}
                        className="mt-0.5"
                      />
                      Mitigation Required to Accept Residual Risk
                    </label>
                  </div>

                  {/* Mitigation Details (Rendered Conditionally) */}
                  {risk.mitigationRequired && (
                    <div className="bg-[#08090A] border border-white/5 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-[#E6E8EA]">Mitigation Description</label>
                        <Textarea
                          value={risk.mitigationDescription || ''}
                          onChange={(e) => handleFieldChange(risk.id, 'mitigationDescription', e.target.value)}
                          placeholder="e.g. Implement strict MFA on all third-party endpoints and perform quarterly audits"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-semibold text-[#E6E8EA]">Mitigation Owner</label>
                          <Select
                            value={risk.mitigationOwner || 'none'}
                            onValueChange={(value) => handleFieldChange(risk.id, 'mitigationOwner', value === 'none' ? null : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {teamMembers.map((member: any) => (
                                <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[12px] font-semibold text-[#E6E8EA]">Due Date</label>
                          <Input
                            type="date"
                            value={risk.mitigationDueDate || ''}
                            onChange={(e) => handleFieldChange(risk.id, 'mitigationDueDate', e.target.value)}
                          />
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[12px] font-semibold text-[#E6E8EA] mb-1.5">Mitigation Status</label>
                          <div className="flex items-center gap-1 bg-[#08090A] p-1 rounded-lg border border-white/10">
                            <Button
                              variant={risk.mitigationStatus === 'not_started' ? 'default' : 'ghost'}
                              onClick={() => handleMitigationStatusChange(risk.id, 'not_started')}
                              className={`flex-1 h-auto py-1.5 px-2 text-[12px] ${
                                risk.mitigationStatus === 'not_started' 
                                  ? 'bg-ink-900 text-white shadow-panel-elevated' 
                                  : 'text-[#9BA1A6] hover:bg-[#0D0F11] hover:text-[#F4F5F6]'
                              }`}
                            >
                              Not Started
                            </Button>
                            <Button
                              variant={risk.mitigationStatus === 'in_progress' ? 'default' : 'ghost'}
                              onClick={() => handleMitigationStatusChange(risk.id, 'in_progress')}
                              className={`flex-1 h-auto py-1.5 px-2 text-[12px] ${
                                risk.mitigationStatus === 'in_progress' 
                                  ? 'bg-amber-500/15 text-amber-300 shadow-panel-elevated border border-amber-900/50 hover:bg-amber-500/15 hover:text-amber-300' 
                                  : 'text-[#9BA1A6] hover:bg-[#0D0F11] hover:text-[#F4F5F6]'
                              }`}
                            >
                              In Progress
                            </Button>
                            <Button
                              variant={risk.mitigationStatus === 'completed' ? 'default' : 'ghost'}
                              onClick={() => handleMitigationStatusChange(risk.id, 'completed')}
                              className={`flex-1 h-auto py-1.5 px-2 text-[12px] ${
                                risk.mitigationStatus === 'completed' 
                                  ? 'bg-[#C9A227]/15 text-[#C9A227] shadow-panel-elevated border border-[#C9A227]/50 hover:bg-[#C9A227]/20 hover:text-[#E5C463]' 
                                  : 'text-[#9BA1A6] hover:bg-[#0D0F11] hover:text-[#F4F5F6]'
                              }`}
                            >
                              Completed
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center border border-dashed border-white/20 rounded-xl bg-[#0D0F11]/50">
            <p className="text-[13px] text-[#6E747A]">No residual risks documented yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VendorRiskCard({ vendorId }: { vendorId: string }) {
  const { data, isLoading } = trpc.vendors.getOrgVendorDetails.useQuery({ vendorId }, { enabled: !!vendorId });

  if (isLoading) return <div className="text-[11px] text-[#6E747A] py-2">Loading vendor risk profile...</div>;
  if (!data) return null;

  const { orgVendor, vendor } = data;

  return (
    <div className="mt-3 bg-[#0D0F11] border border-white/10 rounded-xl p-4 text-[#F4F5F6] shadow-panel-elevated leading-relaxed text-left">
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#6E747A]">Vendor Risk Profile</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border
          ${orgVendor.riskLevel === 'low' ? 'bg-[#C9A227]/10 text-[#C9A227] border-[#C9A227]/50' : 
            orgVendor.riskLevel === 'critical' ? 'bg-red-500/10 text-red-400 border-red-900/50' : 
            'bg-amber-500/10 text-amber-400 border-amber-900/50'}
        `}>
          {orgVendor.riskLevel} Risk ({orgVendor.riskScore})
        </span>
      </div>

      {Boolean(orgVendor.riskFactors) && (
        <div className="text-left space-y-2">
          {Object.entries(orgVendor.riskFactors as Record<string, any>).map(([key, factor]: [string, any]) => {
            if (factor.points === 0) return null; // Only show active risk factors to keep it compact!
            return (
              <div key={key} className="space-y-0.5">
                <div className="flex justify-between text-[11px] font-medium">
                  <span className="text-[#E6E8EA] capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="font-semibold text-clay-600">+{factor.points} pts</span>
                </div>
                <div className="text-[10.5px] text-[#6E747A] leading-tight">
                  {factor.detail}
                </div>
              </div>
            );
          })}
          {Object.values(orgVendor.riskFactors as Record<string, any>).every(f => f.points === 0) && (
            <div className="text-[11px] text-[#C9A227] text-center py-1 font-medium">
              ✓ No active risk factors detected.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
