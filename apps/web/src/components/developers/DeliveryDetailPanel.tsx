import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function DeliveryDetailPanel({ delivery }: { delivery: any }) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [redeliverSuccess, setRedeliverSuccess] = useState<boolean | null>(null);
  const utils = trpc.useUtils();

  const redeliverMutation = trpc.webhooks.redeliver.useMutation({
    onSuccess: () => {
      setRedeliverSuccess(true);
      utils.webhooks.getDeliveries.invalidate({});
      setTimeout(() => setRedeliverSuccess(null), 3000);
    },
    onError: () => {
      setRedeliverSuccess(false);
      setTimeout(() => setRedeliverSuccess(null), 3000);
    }
  });

  const handleRedeliver = async () => {
    const ok = await confirm({
      title: 'Resend this delivery?',
      description: 'The same payload is posted to your endpoint again. Handlers that are not idempotent will process it twice.',
      confirmText: 'Resend',
    });
    if (ok) redeliverMutation.mutate({ webhookId: delivery.webhookId, deliveryId: delivery.id });
  };

  return (
    <div className="p-4 space-y-4">
      {confirmDialog}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-xs text-[#6E747A] uppercase tracking-wider mb-2">Request Payload</h4>
          <div className="bg-[#08090A] text-[#E6E8EA] p-3 rounded overflow-auto text-xs font-mono max-h-48">
            <pre>{JSON.stringify(delivery.payload, null, 2)}</pre>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-xs text-[#6E747A] uppercase tracking-wider mb-2">Response Body</h4>
          <div className="bg-white/10 border border-white/10 p-3 rounded overflow-auto text-xs font-mono max-h-48 text-[#E6E8EA]">
            <pre>{delivery.responseBody || 'No response body'}</pre>
          </div>
          {delivery.lastError && (
            <div className="mt-2 text-xs text-red-400 font-medium">
              Error: {delivery.lastError}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <div className="text-xs text-[#6E747A]">
          Attempts: {delivery.attempts} / {delivery.maxAttempts}
        </div>
        <div className="flex items-center gap-3">
          {redeliverSuccess === true && <span className="text-xs text-green-400 font-medium">Redelivery queued</span>}
          {redeliverSuccess === false && <span className="text-xs text-red-400 font-medium">Failed to queue redelivery</span>}
          {(delivery.status === 'failed' || delivery.status === 'exhausted') && (
            <button
              onClick={handleRedeliver}
              disabled={redeliverMutation.isPending}
              className="bg-[#0D0F11] border border-white/10 text-[#E6E8EA] px-3 py-1.5 rounded text-xs font-medium hover:bg-white/5 disabled:opacity-50"
            >
              Redeliver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
