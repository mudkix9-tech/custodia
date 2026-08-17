"use client";

import React, { useState, useEffect } from 'react';
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
import { ChevronDown, ChevronUp, Search, Plus } from 'lucide-react';
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
  enableInlineAdd?: boolean;
  isLoading?: boolean;
  emptyStateMessage?: string;
  /** Rendered instead of `emptyStateMessage` when the list is empty, so a caller
   *  can offer a way to create the first row rather than a bare grey sentence. */
  emptyState?: React.ReactNode;
  globalFilter?: string;
  setGlobalFilter?: (value: string) => void;
  /** Drop the grid's own panel chrome when a caller has already drawn one
   *  around it, so the two borders do not stack. */
  bare?: boolean;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export function DataGrid<TData, TValue>({
  mode = 'full',
  columns,
  data,
  onRowClick,
  onInlineEdit,
  onAddRow,
  enableInlineAdd = false,
  isLoading = false,
  emptyStateMessage = "No data found.",
  emptyState,
  bare = false,
  globalFilter,
  setGlobalFilter,
}: DataGridProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const isFull = mode === 'full';
  const isMobile = useIsMobile();

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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E747A]" />
                <input
                  value={globalFilter ?? ''}
                  onChange={e => setGlobalFilter(e.target.value)}
                  placeholder="Search all columns..."
                  className="pl-9 pr-4 py-2 bg-[#08090A] border border-white/10 rounded-lg text-[13px] text-[#F4F5F6] placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 transition-colors"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABLE/CARD CONTAINER */}
      <div className={cn(
        "overflow-hidden",
        !bare && "rounded-2xl border border-white/10 bg-[#0D0F11]",
        !isFull && "shadow-none"
      )}>
        {isMobile ? (
          <div className="space-y-3 p-4">
            {isLoading ? (
               Array.from({ length: isFull ? 5 : 3 }).map((_, i) => (
                 <div key={i} className="bg-[#0D0F11] p-4 rounded-xl border border-white/10 space-y-3 animate-pulse">
                   <div className="h-4 bg-white/10 rounded w-1/3"></div>
                   <div className="h-4 bg-white/10 rounded w-1/2"></div>
                 </div>
               ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <div key={row.id} className="bg-[#0D0F11] p-4 rounded-xl border border-white/10 space-y-2">
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                      <span className="text-sm text-[#9BA1A6]">{typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : cell.column.id}</span>
                      <span className="text-sm text-[#F4F5F6] font-medium">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              emptyState ? (
                <div>{emptyState}</div>
              ) : (
              <div className="h-32 flex items-center justify-center text-center text-[#9BA1A6]">
                {emptyStateMessage}
              </div>
              )
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px] text-left">
              <thead className="bg-[#08090A] text-[11px] uppercase tracking-[0.12em] text-[#6E747A] border-b border-white/10 sticky top-0 z-10">
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
                              className: header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-1 hover:text-[#F4F5F6] transition-colors' : '',
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
                  Array.from({ length: isFull ? 5 : 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {columns.map((col, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-white/10 rounded animate-pulse" />
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
                        "border-b border-white/5 transition-colors group",
                        isFull && onRowClick && "cursor-pointer hover:bg-white/5",
                        i % 2 === 0 && "bg-white/[0.02]",
                        !isFull && "h-10"
                      )}
                      style={{ height: isFull ? '48px' : '40px' }}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-4 py-2 text-[#E6E8EA]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className={emptyState ? 'p-0' : 'h-32 text-center text-[#9BA1A6]'}>
                      {emptyState ?? emptyStateMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FOOTERS & PAGINATION */}
      {isFull ? (
        <div className="flex items-center justify-between text-[12.5px] text-[#9BA1A6] px-4 pb-4">
          <div>
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length)} of{' '}
            {data.length} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#0D0F11] text-[#E6E8EA] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#0D0F11] text-[#E6E8EA] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        enableInlineAdd && onAddRow && (
          <button 
            onClick={onAddRow}
            className="flex items-center gap-2 text-[12.5px] text-[#C9A227] hover:text-[#E5C463] font-medium transition-colors w-fit"
          >
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        )
      )}
    </div>
  );
}
