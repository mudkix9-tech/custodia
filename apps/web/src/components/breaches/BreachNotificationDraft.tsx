import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';

export default function BreachNotificationDraft({ breachId }: { breachId: string }) {
  const { data: notifications, isLoading, refetch } = trpc.breaches.notifications.list.useQuery({ breachId });
  const generateMutation = trpc.breaches.notifications.generate.useMutation({
    onSuccess: () => refetch()
  });

  if (isLoading) return <div className="animate-pulse h-32 bg-white/10 rounded-lg"></div>;

  const draft = notifications && notifications[0]; // For simplicity, we just use the first draft

  if (!draft) {
    return (
      <div className="text-center py-12">
        <h3 className="text-sm font-medium text-[#F4F5F6]">No draft available</h3>
        <p className="text-sm text-[#9BA1A6] mt-1 mb-6">Generate an automated draft notification based on the risk assessment.</p>
        <button
          onClick={() => generateMutation.mutate({ breachId })}
          disabled={generateMutation.isPending}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md shadow-panel-elevated disabled:opacity-50"
        >
          {generateMutation.isPending ? 'Generating...' : 'Auto-Generate Draft'}
        </button>
      </div>
    );
  }

  const content = draft.contentJson;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-[#F4F5F6]">Supervisory Authority Notification</h3>
          <p className="text-sm text-[#9BA1A6] mt-1">Review the auto-generated notification letter.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium px-2.5 py-1 bg-yellow-500/20 text-yellow-400 rounded-full capitalize">{draft.status}</span>
        </div>
      </div>

      <div className="bg-[#08090A] rounded-lg border border-white/10 p-6 font-serif prose prose-invert max-w-none">
        <h2 className="text-xl border-b pb-4">Data Breach Notification to {(content as any)?.authority}</h2>
        
        <h4>1. Nature of the personal data breach</h4>
        <p>{(content as any)?.nature_of_breach}</p>
        
        <h4>2. Categories and approximate number of data subjects concerned</h4>
        <p>{(content as any)?.categories_affected?.join(', ') || 'Not specified'} (approx. {(content as any)?.approximate_records} records)</p>
        
        <h4>3. Likely consequences of the personal data breach</h4>
        <p>{(content as any)?.likely_consequences}</p>
        
        <h4>4. Measures taken or proposed to be taken to address the breach</h4>
        <p>{(content as any)?.measures_taken}</p>
        
        <h4>5. Data Protection Officer Contact</h4>
        <p>{(content as any)?.dpo_contact}</p>
      </div>

      <div className="flex justify-end pt-4 border-t border-white/10">
        <button className="px-4 py-2 text-sm font-medium text-white bg-[#C9A227] hover:bg-[#E5C463] rounded-md">
          Edit Draft
        </button>
      </div>
    </div>
  );
}
