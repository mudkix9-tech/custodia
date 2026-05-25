import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';

export default function DeliveryDetailPanel({ delivery }: { delivery: any }) {
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

  const handleRedeliver = () => {
    if (confirm('This will resend the webhook payload to your endpoint. Continue?')) {
      redeliverMutation.mutate({ webhookId: delivery.webhookId, deliveryId: delivery.id });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-2">Request Payload</h4>
          <div className="bg-slate-900 text-slate-100 p-3 rounded overflow-auto text-xs font-mono max-h-48">
            <pre>{JSON.stringify(delivery.payload, null, 2)}</pre>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-2">Response Body</h4>
          <div className="bg-slate-100 border border-slate-200 p-3 rounded overflow-auto text-xs font-mono max-h-48 text-slate-700">
            <pre>{delivery.responseBody || 'No response body'}</pre>
          </div>
          {delivery.lastError && (
            <div className="mt-2 text-xs text-red-600 font-medium">
              Error: {delivery.lastError}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <div className="text-xs text-slate-500">
          Attempts: {delivery.attempts} / {delivery.maxAttempts}
        </div>
        <div className="flex items-center gap-3">
          {redeliverSuccess === true && <span className="text-xs text-green-600 font-medium">Redelivery queued</span>}
          {redeliverSuccess === false && <span className="text-xs text-red-600 font-medium">Failed to queue redelivery</span>}
          {(delivery.status === 'failed' || delivery.status === 'exhausted') && (
            <button
              onClick={handleRedeliver}
              disabled={redeliverMutation.isPending}
              className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Redeliver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
