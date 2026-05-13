"use client";

import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  VisibilityState,
  RowSelectionState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, Search, Plus, MoreHorizontal, Download } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface DataGridProps<TData, TValue> {
  mode?: 'full' | 'compact';
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  onInlineEdit?: (rowId: string, columnId: string, value: any) => void;
  onAddRow?: () => void;
  enableBulkActions?: boolean;
  enableInlineAdd?: boolean;
  isLoading?: boolean;
  emptyStateMessage?: string;
  globalFilter?: string;
  setGlobalFilter?: (value: string) => void;
}

export function DataGrid<TData, TValue>({
  mode = 'full',
  columns,
  data,
  onRowClick,
  onInlineEdit,
  onAddRow,
  enableBulkActions = false,
  enableInlineAdd = false,
  isLoading = false,
  emptyStateMessage = "No data found.",
  globalFilter,
  setGlobalFilter,
}: DataGridProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const isFull = mode === 'full';

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      ...(isFull && globalFilter !== undefined ? { globalFilter } : {}),
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    ...(isFull && setGlobalFilter ? { onGlobalFilterChange: setGlobalFilter } : {}),
    getCoreRowModel: getCoreRowModel(),
    ...(isFull ? {
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
    } : {}),
    meta: {
      updateData: (rowIndex: number, columnId: string, value: unknown) => {
        if (onInlineEdit && data[rowIndex]) {
          // Pass the unique row identifier. Assuming 'id' exists.
          const rowId = (data[rowIndex] as any).id || String(rowIndex);
          onInlineEdit(rowId, columnId, value);
        }
      },
    },
  });

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* FULL MODE TOOLBAR */}
      {isFull && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {setGlobalFilter && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  value={globalFilter ?? ''}
                  onChange={e => setGlobalFilter(e.target.value)}
                  placeholder="Search all columns..."
                  className="pl-9 pr-4 py-2 bg-bone-50 hairline rounded-lg text-[13px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-sage-500/20 transition-colors"
                />
              </div>
            )}
            {enableBulkActions && Object.keys(rowSelection).length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-ink-500 ml-2">
                  {Object.keys(rowSelection).length} selected
                </span>
                <button className="bg-bone-100 hover:bg-bone-200 hairline text-ink-800 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2">
                  <Download className="w-4 h-4" /> Export
                </button>
                <button className="bg-bone-100 hover:bg-bone-200 hairline text-ink-800 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2">
                  <MoreHorizontal className="w-4 h-4" /> Actions
                </button>
              </div>
            )}
          </div>
          {/* Column visibility toggle could go here */}
        </div>
      )}

      {/* TABLE CONTAINER */}
      <div className={cn(
        "rounded-2xl hairline overflow-hidden bg-bone-50",
        !isFull && "shadow-none"
      )}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px] text-left">
            <thead className="bg-bone-50 text-[11px] uppercase tracking-[0.12em] text-ink-400 border-b border-ink-900/8 sticky top-0 z-10">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className="px-4 py-3 font-semibold"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          {...{
                            className: header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-1 hover:text-ink-900 transition-colors' : '',
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ChevronUp className="w-3 h-3" />,
                            desc: <ChevronDown className="w-3 h-3" />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                // SKELETON LOADER
                Array.from({ length: isFull ? 5 : 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-ink-900/6">
                    {columns.map((col, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-bone-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => isFull && onRowClick?.(row.original)}
                    className={cn(
                      "border-b border-ink-900/6 transition-colors group",
                      isFull && onRowClick && "cursor-pointer hover:bg-bone-100/60",
                      i % 2 === 0 && "bg-bone-50/50",
                      !isFull && "h-10" // 40px compact row
                    )}
                    style={{ height: isFull ? '48px' : '40px' }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-2 text-ink-900">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-32 text-center text-ink-500">
                    {emptyStateMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTERS & PAGINATION */}
      {isFull ? (
        <div className="flex items-center justify-between text-[12.5px] text-ink-500">
          <div>
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length)} of{' '}
            {data.length} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 rounded-lg hairline bg-bone-50 text-ink-800 hover:bg-bone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 rounded-lg hairline bg-bone-50 text-ink-800 hover:bg-bone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        enableInlineAdd && onAddRow && (
          <button 
            onClick={onAddRow}
            className="flex items-center gap-2 text-[12.5px] text-sage-700 hover:text-sage-600 font-medium transition-colors w-fit"
          >
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        )
      )}
    </div>
  );
}
