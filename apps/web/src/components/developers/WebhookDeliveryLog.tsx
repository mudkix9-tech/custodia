import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import DeliveryDetailPanel from './DeliveryDetailPanel';

export default function WebhookDeliveryLog({ webhookId }: { webhookId: string }) {
  const deliveriesQuery = trpc.webhooks.getDeliveries.useQuery({ webhookId });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (deliveriesQuery.isLoading) return <div className="p-4 text-sm text-slate-500">Loading deliveries...</div>;
  if (!deliveriesQuery.data || deliveriesQuery.data.length === 0) {
    return <div className="p-4 text-sm text-slate-500">No deliveries yet.</div>;
  }

  const toggleRow = (id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden bg-white mt-4">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
          <tr>
            <th className="p-3 font-medium">Event</th>
            <th className="p-3 font-medium">Date</th>
            <th className="p-3 font-medium">Status Code</th>
            <th className="p-3 font-medium">Response Time</th>
            <th className="p-3 font-medium">State</th>
            <th className="p-3 font-medium text-right">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {deliveriesQuery.data.map((delivery: any) => (
            <React.Fragment key={delivery.id}>
              <tr
                className={`hover:bg-slate-50 cursor-pointer ${expandedRow === delivery.id ? 'bg-slate-50' : ''}`}
                onClick={() => toggleRow(delivery.id)}
              >
                <td className="p-3 font-mono text-xs">{delivery.eventType}</td>
                <td className="p-3">{new Date(delivery.createdAt!).toLocaleString()}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                    ${delivery.responseStatus && delivery.responseStatus >= 200 && delivery.responseStatus < 300 ? 'bg-green-100 text-green-700' :
                      delivery.responseStatus && delivery.responseStatus >= 400 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                    {delivery.responseStatus || 'N/A'}
                  </span>
                </td>
                <td className="p-3">{delivery.responseTimeMs ? `${delivery.responseTimeMs}ms` : '-'}</td>
                <td className="p-3 capitalize">{delivery.status}</td>
                <td className="p-3 text-right">
                  <button className="text-slate-500 hover:text-slate-900 text-xs font-medium">
                    {expandedRow === delivery.id ? 'Hide' : 'View'}
                  </button>
                </td>
              </tr>
              {expandedRow === delivery.id && (
                <tr>
                  <td colSpan={6} className="p-0 border-t border-slate-100 bg-slate-50">
                    <DeliveryDetailPanel delivery={delivery as any} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
