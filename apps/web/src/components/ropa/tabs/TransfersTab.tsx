"use client";

import React, { useState } from 'react';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export function TransfersTab({ activityId }: { activityId: string }) {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.ropa.transfers.list.useQuery({ processingActivityId: activityId });
  const { data: orgVendorsResp } = trpc.vendors.getOrgVendors.useQuery({ limit: 100 });
  const orgVendors = orgVendorsResp?.data || [];
  const createMutation = trpc.ropa.transfers.create.useMutation();
  const updateMutation = trpc.ropa.transfers.update.useMutation();
  const deleteMutation = trpc.ropa.transfers.delete.useMutation();
  const { confirm, dialog } = useConfirm();

  const handleAdd = async () => {
    await createMutation.mutateAsync({
      processingActivityId: activityId,
      destinationCountry: 'United States',
      transferMechanism: 'Standard Contractual Clauses (SCCs)',
    });
    utils.ropa.transfers.list.invalidate();
  };

  const handleInlineEdit = async (rowId: string, columnId: string, value: any) => {
    await updateMutation.mutateAsync({
      id: rowId,
      data: { [columnId]: value }
    });
    utils.ropa.transfers.list.invalidate();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove transfer?',
      description: 'Are you sure you want to remove this data transfer?',
      variant: 'destructive',
      confirmText: 'Remove',
    });
    if (confirmed) {
      await deleteMutation.mutateAsync({ id });
      utils.ropa.transfers.list.invalidate();
    }
  };

  const EditableCell = ({ getValue, row, column, table }: any) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);
    
    const onBlur = () => {
      if (value !== initialValue) {
        table.options.meta?.updateData(row.index, column.id, value);
      }
    };

    return (
      <input
        value={value || ''}
        onChange={e => setValue(e.target.value)}
        onBlur={onBlur}
        className="bg-transparent border-none outline-none focus:ring-2 focus:ring-sage-500/20 rounded px-2 py-1 w-full text-ink-900 placeholder:text-ink-300"
      />
    );
  };

  const SelectCell = ({ getValue, row, column, table, options }: any) => {
    const value = getValue();
    return (
      <select
        value={value || ''}
        onChange={(e) => table.options.meta?.updateData(row.index, column.id, e.target.value)}
        className="bg-transparent hairline rounded px-2 py-1 w-full text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
      >
        <option value="" disabled>Select...</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  };

  const VendorSelectCell = ({ getValue, row, column, table }: any) => {
    const value = getValue();
    return (
      <select
        value={value || ''}
        onChange={(e) => table.options.meta?.updateData(row.index, column.id, e.target.value)}
        className="bg-transparent hairline rounded px-2 py-1 w-full text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20"
      >
        <option value="">No vendor linked</option>
        {orgVendors.map((ov: any) => (
          <option key={ov.vendorId} value={ov.vendorId}>{ov.name}</option>
        ))}
      </select>
    );
  };

  const TiaStatusCell = ({ row }: any) => {
    const transfer = row.original;
    if (!transfer.vendorId) return <span className="text-xs text-ink-400">Link vendor to assess</span>;
    
    if (transfer.tiaCompleted) {
      if (transfer.tiaRiskLevel === 'critical') {
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-medium border border-red-200">
              <AlertTriangle className="w-3 h-3" /> Suspended
            </span>
            <Link href={`/vendors/${transfer.vendorId}`} className="text-ink-400 hover:text-ink-900">
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-sage-50 text-sage-700 px-2 py-1 rounded text-xs font-medium border border-sage-200">
            <ShieldCheck className="w-3 h-3" /> TIA: Completed
          </span>
          <Link href={`/vendors/${transfer.vendorId}`} className="text-ink-400 hover:text-ink-900">
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-medium border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> TIA: Required
        </span>
        <Link href={`/vendors/${transfer.vendorId}`} className="text-ink-400 hover:text-ink-900">
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    );
  };

  const columns = [
    {
      accessorKey: 'destinationCountry',
      header: 'Destination Country',
      cell: EditableCell,
    },
    {
      accessorKey: 'transferMechanism',
      header: 'Transfer Mechanism',
      cell: (props: any) => <SelectCell {...props} options={[
        'Standard Contractual Clauses (SCCs)',
        'Adequacy Decision',
        'Binding Corporate Rules (BCRs)',
        'Derogation (Art. 49)',
        'Other'
      ]} />,
    },
    {
      accessorKey: 'safeguards',
      header: 'Supplementary Safeguards',
      cell: EditableCell,
    },
    {
      accessorKey: 'vendorId',
      header: 'Vendor (Data Importer)',
      cell: VendorSelectCell,
    },
    {
      id: 'tiaStatus',
      header: 'TIA Status',
      cell: TiaStatusCell,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <button aria-label="Delete" onClick={() => handleDelete(row.original.id)} className="p-1.5 text-ink-400 hover:text-clay-600 hover:bg-bone-100 rounded-md transition-colors"><Trash2 className="w-4 h-4" />
        </button>
      ),
      size: 50,
    }
  ];


  return (
    <div className="space-y-6 fade-up">
      <div className="bg-bone-50 hairline rounded-2xl p-6">
        <h2 className="text-[14px] font-medium text-ink-900 mb-2">International Transfers</h2>
        <p className="text-[12px] text-ink-500 mb-4">Document cross-border data transfers outside of the EEA or recognized adequate countries.</p>
        <DataGrid
          mode="compact"
          columns={columns as any}
          data={data}
          isLoading={isLoading}
          enableInlineAdd={true}
          onAddRow={handleAdd}
          onInlineEdit={handleInlineEdit}
          emptyStateMessage="No international transfers documented."
        />
      </div>
    </div>
  );
}
