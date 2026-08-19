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
import { ChevronDown, ChevronUp, Search, Plus, Check, Minus } from 'lucide-react';
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

  // -------------------------------------------------------------------------
  // L107. Row selection, controlled by the caller.
  //
  // Deliberately not TanStack's own `rowSelection` state, which the grid already
  // holds and nothing reads. Selection here has to survive a page being appended
  // by an infinite query, and it has to be able to contain ids that are *not*
  // loaded — "select all 340 matching this filter" is the whole feature, and a
  // selection model that can only hold rendered rows cannot express it. That is
  // why the previous select-all checkbox was removed rather than wired: it looked
  // like it meant the filter and meant the page.
  // -------------------------------------------------------------------------
  enableRowSelection?: boolean;
  /** Ids of selected rows. May include rows not on this page. */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Row → id. Defaults to `row.id`. */
  getRowId?: (row: TData) => string;
  /** Rendered above the table while anything is selected. */
  selectionToolbar?: React.ReactNode;
  /** Accessible labels, so the grid carries no untranslated English. */
  labels?: {
    search?: string;
    selectRow?: string;
    selectAll?: string;
    previous?: string;
    next?: string;
    showing?: (from: number, to: number, total: number) => string;
    addRow?: string;
  };
}

/**
 * A tri-state checkbox. Native `<input type="checkbox">` styled through
 * appearance-none loses its indeterminate rendering in every browser, and the
 * indeterminate state is the one that matters here — it is what tells someone
 * that some of the loaded rows are selected and some are not.
 */
function SelectBox({ checked, indeterminate, onChange, label }: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cn(
        'flex h-4 w-4 items-center justify-center rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60',
        checked || indeterminate
          ? 'border-[#C9A227] bg-[#C9A227] text-[#08090A]'
          : 'border-white/25 bg-transparent hover:border-white/50',
      )}
    >
      {indeterminate ? <Minus className="h-3 w-3" /> : checked ? <Check className="h-3 w-3" /> : null}
    </button>
  );
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
  enableRowSelection = false,
  selectedIds,
  onSelectionChange,
  getRowId,
  selectionToolbar,
  labels,
}: DataGridProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const isFull = mode === 'full';
  const isMobile = useIsMobile();

  const rowId = getRowId ?? ((row: TData) => String((row as any)?.id ?? ''));
  const selected = React.useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const selectable = enableRowSelection && !!onSelectionChange;

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange?.([...next]);
  };

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

  // The header box acts on the rows actually rendered, which is what its label
  // says. `data` may hold several appended cursor pages while the grid paginates
  // client-side, so selecting all of `data` from a control sitting above ten rows
  // would be the "looks like the filter, means the page" confusion in reverse.
  // Selecting everything that matches the filter is a separate, explicit action the
  // caller offers through `selectionToolbar`.
  const pageIds = table.getRowModel().rows.map((row) => rowId(row.original)).filter(Boolean);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = !allPageSelected && pageIds.some((id) => selected.has(id));

  const toggleAllOnPage = () => {
    const next = new Set(selected);
    if (allPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange?.([...next]);
  };

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
                  placeholder={labels?.search ?? 'Search all columns...'}
                  aria-label={labels?.search ?? 'Search all columns'}
                  className="pl-9 pr-4 py-2 bg-[#08090A] border border-white/10 rounded-lg text-[13px] text-[#F4F5F6] placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 transition-colors"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {selectable && selected.size > 0 && selectionToolbar && (
        <div role="region" aria-label={labels?.selectAll ?? 'Selection'}>{selectionToolbar}</div>
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
                    {selectable && (
                      <th scope="col" className="w-10 px-4 py-3">
                        <SelectBox
                          checked={allPageSelected}
                          indeterminate={somePageSelected}
                          onChange={toggleAllOnPage}
                          label={labels?.selectAll ?? 'Select all rows on this page'}
                        />
                      </th>
                    )}
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        scope="col"
                        colSpan={header.colSpan}
                        className="px-4 py-3 font-semibold"
                        aria-sort={
                          header.column.getIsSorted() === 'asc' ? 'ascending'
                            : header.column.getIsSorted() === 'desc' ? 'descending'
                            : header.column.getCanSort() ? 'none' : undefined
                        }
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            {...(header.column.getCanSort() ? {
                              role: 'button' as const,
                              tabIndex: 0,
                              className: 'cursor-pointer select-none flex items-center gap-1 hover:text-[#F4F5F6] transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/60',
                              onClick: header.column.getToggleSortingHandler(),
                              onKeyDown: (e: React.KeyboardEvent) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  header.column.toggleSorting();
                                }
                              },
                            } : { className: '' })}
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
                      {Array.from({ length: columns.length + (selectable ? 1 : 0) }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-white/10 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, i) => {
                    const id = rowId(row.original);
                    const isSelected = selectable && selected.has(id);
                    // R141. A clickable row that cannot be reached or activated from
                    // the keyboard is a row screen-reader and keyboard users cannot
                    // open at all — the register's only way into a record.
                    const interactive = isFull && !!onRowClick;
                    return (
                    <tr
                      key={row.id}
                      onClick={() => isFull && onRowClick?.(row.original)}
                      {...(interactive ? {
                        tabIndex: 0,
                        role: 'link' as const,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick?.(row.original);
                          }
                        },
                      } : {})}
                      aria-selected={selectable ? isSelected : undefined}
                      className={cn(
                        "border-b border-white/5 transition-colors group",
                        isFull && onRowClick && "cursor-pointer hover:bg-white/5",
                        i % 2 === 0 && "bg-white/[0.02]",
                        isSelected && "bg-[#C9A227]/10",
                        !isFull && "h-10",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]/60"
                      )}
                      style={{ height: isFull ? '48px' : '40px' }}
                    >
                      {selectable && (
                        <td className="w-10 px-4 py-2">
                          <SelectBox
                            checked={!!isSelected}
                            onChange={() => toggleRow(id)}
                            label={labels?.selectRow ?? 'Select row'}
                          />
                        </td>
                      )}
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-4 py-2 text-[#E6E8EA]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={columns.length + (selectable ? 1 : 0)} className={emptyState ? 'p-0' : 'h-32 text-center text-[#9BA1A6]'}>
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
          <div aria-live="polite">
            {(() => {
              const from = table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1;
              const to = Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length);
              return labels?.showing
                ? labels.showing(from, to, data.length)
                : `Showing ${from} to ${to} of ${data.length} results`;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#0D0F11] text-[#E6E8EA] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {labels?.previous ?? 'Previous'}
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#0D0F11] text-[#E6E8EA] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {labels?.next ?? 'Next'}
            </button>
          </div>
        </div>
      ) : (
        enableInlineAdd && onAddRow && (
          <button 
            onClick={onAddRow}
            className="flex items-center gap-2 text-[12.5px] text-[#C9A227] hover:text-[#E5C463] font-medium transition-colors w-fit"
          >
            <Plus className="w-3.5 h-3.5" /> {labels?.addRow ?? 'Add Row'}
          </button>
        )
      )}
    </div>
  );
}
