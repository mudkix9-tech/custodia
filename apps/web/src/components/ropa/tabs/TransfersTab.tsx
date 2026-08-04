"use client";

import React, { useState } from 'react';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

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
      <Input
        value={value || ''}
        onChange={e => setValue(e.target.value)}
        onBlur={onBlur}
        className="bg-transparent border-none shadow-none focus-visible:ring-1 focus-visible:ring-sage-500/20 rounded px-2 py-1 h-8 w-full text-[#F4F5F6] placeholder:text-white/20"
      />
    );
  };

  const SelectCell = ({ getValue, row, column, table, options }: any) => {
    const value = getValue();
    return (
      <Select
        value={value || 'none'}
        onValueChange={(val) => table.options.meta?.updateData(row.index, column.id, val === 'none' ? '' : val)}
      >
        <SelectTrigger className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-sage-500/20">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" disabled>Select...</SelectItem>
          {options.map((opt: string) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const VendorSelectCell = ({ getValue, row, column, table }: any) => {
    const value = getValue();
    return (
      <Select
        value={value || 'none'}
        onValueChange={(val) => table.options.meta?.updateData(row.index, column.id, val === 'none' ? null : val)}
      >
        <SelectTrigger className="bg-transparent border-none shadow-none h-8 px-2 py-1 w-full text-[#F4F5F6] focus:ring-1 focus:ring-sage-500/20">
          <SelectValue placeholder="No vendor linked" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No vendor linked</SelectItem>
          {orgVendors.map((ov: any) => (
            <SelectItem key={ov.vendorId} value={ov.vendorId}>{ov.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const TiaStatusCell = ({ row }: any) => {
    const transfer = row.original;
    if (!transfer.vendorId) return <span className="text-xs text-[#6E747A]">Link vendor to assess</span>;
    
    if (transfer.tiaCompleted) {
      if (transfer.tiaRiskLevel === 'critical') {
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs font-medium border border-red-900/50">
              <AlertTriangle className="w-3 h-3" /> Suspended
            </span>
            <Link href={`/vendors/${transfer.vendorId}`} className="text-[#6E747A] hover:text-[#F4F5F6]">
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-[#C9A227]/10 text-[#C9A227] px-2 py-1 rounded text-xs font-medium border border-[#C9A227]/30">
            <ShieldCheck className="w-3 h-3" /> TIA: Completed
          </span>
          <Link href={`/vendors/${transfer.vendorId}`} className="text-[#6E747A] hover:text-[#F4F5F6]">
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs font-medium border border-amber-900/50">
          <AlertTriangle className="w-3 h-3" /> TIA: Required
        </span>
        <Link href={`/vendors/${transfer.vendorId}`} className="text-[#6E747A] hover:text-[#F4F5F6]">
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
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Delete" 
          onClick={() => handleDelete(row.original.id)} 
          className="w-7 h-7 text-[#6E747A] hover:text-clay-600 hover:bg-white/5"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
      size: 50,
    }
  ];


  return (
    <div className="space-y-6 fade-up">
      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-2">International Transfers</h2>
        <p className="text-[12px] text-[#6E747A] mb-4">Document cross-border data transfers outside of the EEA or recognized adequate countries.</p>
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
