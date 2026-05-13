"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { AlertTriangle, Plus, ShieldAlert, ArrowRight, Loader2, Save } from 'lucide-react';
import { DataGrid } from 'ui';

export function DpiaTab({ activityId, dpiaId, onDpiaLinked }: { activityId: string, dpiaId?: string | null, onDpiaLinked: (id: string) => void }) {
  const [isCreating, setIsCreating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const { data: dpia, refetch: refetchDpia, isLoading: isLoadingDpia } = trpc.dpia.get.useQuery(
    { id: dpiaId! },
    { enabled: !!dpiaId }
  );

  const { data: risks, refetch: refetchRisks } = trpc.dpia.risks.list.useQuery(
    { dpiaId: dpiaId! },
    { enabled: !!dpiaId }
  );

  const { data: allDpias } = trpc.dpia.list.useQuery(undefined, { enabled: !dpiaId });

  const createDpiaMutation = trpc.dpia.create.useMutation();
  const updateActivityMutation = trpc.ropa.update.useMutation();
  const createRiskMutation = trpc.dpia.risks.create.useMutation();

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

  if (isLoadingDpia && dpiaId) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-sage-600" /></div>;
  }

  if (!dpiaId || !dpia) {
    return (
      <div className="space-y-6 max-w-3xl fade-up">
        <div className="bg-bone-50 hairline rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-clay-50 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 text-clay-600" />
          </div>
          <h2 className="text-[16px] font-medium text-ink-900">Data Protection Impact Assessment</h2>
          <p className="text-[13.5px] text-ink-500 max-w-lg mx-auto leading-relaxed">
            A DPIA is required if this processing activity is likely to result in a high risk to the rights and freedoms of individuals.
          </p>
          
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={handleCreateDpia}
              disabled={isCreating}
              className="px-4 py-2 bg-sage-700 text-bone-50 text-[13px] font-medium rounded-lg shadow-card hover:bg-sage-600 transition-colors flex items-center gap-2"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create New DPIA
            </button>
          </div>
        </div>

        {allDpias && allDpias.length > 0 && (
          <div className="bg-bone-50 hairline rounded-2xl p-6">
            <h3 className="text-[13px] font-medium text-ink-900 mb-4">Or Link Existing DPIA</h3>
            <div className="space-y-2">
              {allDpias.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-white hairline rounded-xl">
                  <div>
                    <div className="text-[13px] font-medium text-ink-900">{d.title}</div>
                    <div className="text-[12px] text-ink-500">Status: {d.status}</div>
                  </div>
                  <button
                    onClick={() => handleLinkDpia(d.id)}
                    disabled={isLinking}
                    className="text-[12px] font-medium text-sage-600 hover:text-sage-700 px-3 py-1.5 bg-sage-50 rounded-md transition-colors"
                  >
                    Link to this activity
                  </button>
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
        <span className="px-2 py-1 bg-bone-100 rounded text-ink-700 font-medium">L{info.getValue()}</span>
      )
    },
    { 
      header: 'Severity (1-5)', 
      accessorKey: 'severity',
      cell: (info: any) => (
        <span className="px-2 py-1 bg-bone-100 rounded text-ink-700 font-medium">S{info.getValue()}</span>
      )
    },
    { 
      header: 'Risk Score', 
      accessorKey: 'initialRiskScore',
      cell: (info: any) => {
        const score = info.getValue();
        const color = score >= 15 ? 'bg-clay-100 text-clay-700' : score >= 8 ? 'bg-amber-100 text-amber-700' : 'bg-sage-100 text-sage-700';
        return <span className={`px-2 py-1 rounded font-medium ${color}`}>{score}</span>;
      }
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl fade-up">
      {/* DPIA Header */}
      <div className="bg-bone-50 hairline rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[16px] font-medium text-ink-900">{dpia.title}</h2>
            <div className="text-[13px] text-ink-500 mt-1">Status: <span className="font-medium text-ink-700">{dpia.status}</span></div>
          </div>
          <button className="px-3 py-1.5 bg-white hairline rounded-lg text-[12.5px] font-medium text-ink-700 hover:bg-bone-100 transition-colors flex items-center gap-1.5">
            View Full DPIA <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 pt-4 border-t border-ink-900/8">
          <div>
            <label className="text-[12.5px] font-medium text-ink-700">Overall Initial Risk Level</label>
            <div className="mt-1 text-[14px] font-medium text-clay-600">{dpia.overallRiskLevel || 'Not Calculated'}</div>
          </div>
          <div>
            <label className="text-[12.5px] font-medium text-ink-700">Residual Risk Level</label>
            <div className="mt-1 text-[14px] font-medium text-sage-600">{dpia.residualRiskLevel || 'Pending Mitigations'}</div>
          </div>
        </div>
      </div>

      {/* Risk Matrix & Mitigations */}
      <div className="bg-bone-50 hairline rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-medium text-ink-900">Risk Assessment & Mitigations</h3>
          <button 
            onClick={handleAddRisk}
            className="p-1.5 bg-sage-50 text-sage-700 rounded-md hover:bg-sage-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {risks && risks.length > 0 ? (
          <DataGrid 
            columns={riskColumns} 
            data={risks} 
            mode="compact" 
          />
        ) : (
          <div className="py-8 text-center border border-dashed border-ink-900/20 rounded-xl bg-white/50">
            <p className="text-[13px] text-ink-500">No risks identified yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
