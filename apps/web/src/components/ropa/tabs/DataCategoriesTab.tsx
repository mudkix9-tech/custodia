"use client";

import React, { useState } from 'react';
import { DataGrid } from 'ui';
import { trpc } from '@/utils/trpc';
import { Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function DataCategoriesTab({ activityId }: { activityId: string }) {
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.ropa.dataCategories.list.useQuery({ processingActivityId: activityId });
  const createMutation = trpc.ropa.dataCategories.create.useMutation();
  const updateMutation = trpc.ropa.dataCategories.update.useMutation();
  const deleteMutation = trpc.ropa.dataCategories.delete.useMutation();
  const { confirm, dialog } = useConfirm();

  const handleAdd = async () => {
    await createMutation.mutateAsync({
      processingActivityId: activityId,
      category: 'New Category',
      categoryGroup: 'General',
    });
    utils.ropa.dataCategories.list.invalidate();
  };

  const handleInlineEdit = async (rowId: string, columnId: string, value: any) => {
    await updateMutation.mutateAsync({
      id: rowId,
      data: { [columnId]: value }
    });
    utils.ropa.dataCategories.list.invalidate();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove data category?',
      description: 'Are you sure you want to remove this data category?',
      variant: 'destructive',
      confirmText: 'Remove',
    });
    if (confirmed) {
      await deleteMutation.mutateAsync({ id });
      utils.ropa.dataCategories.list.invalidate();
    }
  };

  // Create editable cell component
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

  const columns = [
    {
      accessorKey: 'categoryType',
      header: 'Category Type',
      cell: EditableCell,
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: EditableCell,
    },
    {
      accessorKey: 'retentionPeriod',
      header: 'Retention Period',
      cell: EditableCell,
    },
    {
      accessorKey: 'isSpecialCategory',
      header: 'Special Category',
      cell: ({ getValue, row, column, table }: any) => {
        return (
          <input
            type="checkbox"
            checked={getValue() || false}
            onChange={(e) => table.options.meta?.updateData(row.index, column.id, e.target.checked)}
            className="rounded border-white/20 text-[#C9A227] focus:ring-sage-500/20 bg-transparent"
          />
        );
      }
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
      {dialog}
      <div className="bg-[#08090A] hairline rounded-2xl p-6">
        <h2 className="text-[14px] font-medium text-[#F4F5F6] mb-4">Data Categories</h2>
        <DataGrid
          mode="compact"
          columns={columns as any}
          data={data}
          isLoading={isLoading}
          enableInlineAdd={true}
          onAddRow={handleAdd}
          onInlineEdit={handleInlineEdit}
          emptyStateMessage="No data categories added yet."
        />
      </div>
    </div>
  );
}
