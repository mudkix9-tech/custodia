"use client";

import React, { useState } from 'react';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2, Building2, Globe, ShieldCheck, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function RecipientsTab({ activityId }: { activityId: string }) {
  const utils = trpc.useUtils();
  const { data: recipients = [], isLoading } = trpc.ropa.recipients.list.useQuery({ processingActivityId: activityId });
  const { data: orgVendorsResp } = trpc.vendors.getOrgVendors.useQuery({ limit: 100 });
  const orgVendors = orgVendorsResp?.data || [];
  
  const createMutation = trpc.ropa.recipients.create.useMutation();
  const deleteMutation = trpc.ropa.recipients.delete.useMutation();

  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [customName, setCustomName] = useState('');

  const handleAddVendor = async () => {
    if (!selectedVendorId) return;
    const vendor = orgVendors.find((v: any) => v.id === selectedVendorId) as any;
    if (!vendor) return;

    await createMutation.mutateAsync({
      processingActivityId: activityId,
      recipientType: 'vendor',
      name: vendor.name,
      vendorId: vendor.id,
    });
    setSelectedVendorId('');
    utils.ropa.recipients.list.invalidate();
    utils.ropa.transfers.list.invalidate(); // Because a transfer might have been auto-created
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    await createMutation.mutateAsync({
      processingActivityId: activityId,
      recipientType: 'other',
      name: customName,
    });
    setCustomName('');
    utils.ropa.recipients.list.invalidate();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    utils.ropa.recipients.list.invalidate();
  };

  const columns = [
    {
      accessorKey: 'name',
      header: 'Recipient Name',
      cell: ({ row }: any) => {
        const { vendorData, name } = row.original;
        if (vendorData) {
          return (
            <Link href={`/vendors/${vendorData.id}`} className="font-medium text-ink-900 hover:text-sage-600 transition-colors flex items-center gap-2">
              <Building2 className="w-4 h-4 text-ink-400" />
              {name}
            </Link>
          );
        }
        return <span className="text-ink-900 font-medium">{name}</span>;
      },
    },
    {
      id: 'dpaStatus',
      header: 'DPA Status',
      cell: ({ row }: any) => {
        const { vendorData } = row.original;
        if (!vendorData) return <span className="text-ink-400 text-[13px]">-</span>;
        
        const status = vendorData.dpaStatus;
        if (status === 'signed') return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-sage-50 text-sage-700"><ShieldCheck className="w-3 h-3"/> Signed</span>;
        if (status === 'expired') return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700"><AlertTriangle className="w-3 h-3"/> Expired</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700">Missing</span>;
      }
    },
    {
      id: 'location',
      header: 'Data Processing Locations',
      cell: ({ row }: any) => {
        const { vendorData } = row.original;
        if (!vendorData) return <span className="text-ink-400 text-[13px]">-</span>;

        return (
          <div className="flex items-center gap-1.5 text-[13px] text-ink-600">
            <Globe className="w-3.5 h-3.5 text-ink-400" />
            {vendorData.headquartersCountry || 'Unknown'} 
            {vendorData.usingEuHosting && <span className="text-sage-600 font-medium">(EU)</span>}
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <button 
          onClick={() => handleDelete(row.original.id)}
          className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
      size: 50,
    }
  ];

  return (
    <div className="space-y-6 fade-up">
      <div className="bg-bone-50 border border-ink-900/10 rounded-2xl p-6 shadow-sm">
        <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Add Recipient</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Add Vendor Link */}
          <div className="space-y-3">
            <label className="text-[13px] font-medium text-ink-700 block">Link an Existing Vendor</label>
            <div className="flex gap-3">
              <select 
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
                className="flex-1 bg-white border border-ink-900/10 rounded-xl px-4 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              >
                <option value="">Select a vendor from your register...</option>
                {orgVendors.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <button 
                onClick={handleAddVendor}
                disabled={!selectedVendorId || createMutation.isPending}
                className="bg-sage-700 text-white px-4 py-2 rounded-xl text-[14px] font-medium hover:bg-sage-600 transition-colors disabled:opacity-50"
              >
                Link Vendor
              </button>
            </div>
            <p className="text-[12px] text-ink-500">
              Linking a vendor automatically synchronizes DPA status and generates cross-border transfer records if required.
            </p>
          </div>

          {/* Add Custom Recipient */}
          <div className="space-y-3 md:border-l md:border-ink-900/10 md:pl-8">
            <label className="text-[13px] font-medium text-ink-700 block">Add Other Recipient</label>
            <div className="flex gap-3">
              <input 
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="E.g. Internal HR Team, Local Auditor"
                className="flex-1 bg-white border border-ink-900/10 rounded-xl px-4 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sage-500/20"
              />
              <button 
                onClick={handleAddCustom}
                disabled={!customName.trim() || createMutation.isPending}
                className="bg-white border border-ink-900/10 text-ink-700 px-4 py-2 rounded-xl text-[14px] font-medium hover:bg-bone-50 transition-colors disabled:opacity-50"
              >
                Add Manual
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-ink-900/10 rounded-2xl shadow-sm overflow-hidden">
        <DataGrid
          mode="full"
          columns={columns as any}
          data={recipients}
          isLoading={isLoading}
          emptyStateMessage="No recipients documented for this processing activity."
        />
      </div>
    </div>
  );
}
