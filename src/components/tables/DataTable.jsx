/**
 * Data table used by list pages: server-side paging and sorting, column visibility remembered per table in this
 * browser, optional row selection with bulk actions, and loading, error and empty states.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import { Button, Skeleton, EmptyState, ErrorState, cn } from '../ui/index.js';

/**
 * Renders a page of rows. Changes to paging and sorting are reported through `onChange`, so the state can live in
 * the URL. The selection is cleared when the page or data changes.
 *
 * @param {object} props
 * @param {string} [props.id] Identifier used to remember column visibility.
 * @param {object[]} props.columns Column definitions.
 * @param {object[]} props.data Rows.
 * @param {number} props.total Total number of rows.
 * @param {(patch: object) => void} props.onChange Called with new paging or sorting.
 * @returns {JSX.Element|null}
 */
export function DataTable({
  id,
  columns,
  data = [],
  total = 0,
  page = 1,
  pageSize = 25,
  sort,
  order,
  onChange,
  loading,
  error,
  onRetry,
  onRowClick,
  empty,
  selectable,
  bulkActions,
  getRowId = (r) => r.id,
  toolbar,
}) {
  const storageKey = id ? `ugarms.cols.${id}` : null;
  const [visibility, setVisibility] = useState(() => {
    try {
      return storageKey ? JSON.parse(localStorage.getItem(storageKey)) || {} : {};
    } catch {
      return {};
    }
  });
  const [selection, setSelection] = useState({});
  const [colsOpen, setColsOpen] = useState(false);
  useEffect(() => {
    if (storageKey)
      try {
        localStorage.setItem(storageKey, JSON.stringify(visibility));
      } catch {
        /* ignore */
      }
  }, [visibility, storageKey]);
  useEffect(() => {
    setSelection({});
  }, [page, data]);

  const cols = useMemo(
    () =>
      selectable
        ? [
            {
              id: '_select',
              enableSorting: false,
              enableHiding: false,
              header: ({ table }) => (
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  className="accent-brand-700"
                  checked={table.getIsAllRowsSelected()}
                  onChange={table.getToggleAllRowsSelectedHandler()}
                />
              ),
              cell: ({ row }) => (
                <input
                  type="checkbox"
                  aria-label="Select row"
                  className="accent-brand-700"
                  checked={row.getIsSelected()}
                  onChange={row.getToggleSelectedHandler()}
                  onClick={(e) => e.stopPropagation()}
                />
              ),
            },
            ...columns,
          ]
        : columns,
    [columns, selectable],
  );

  const table = useReactTable({
    data,
    columns: cols,
    getRowId,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: visibility, rowSelection: selection },
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    enableRowSelection: Boolean(selectable),
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);

  /**
   * Sorts by a column, ascending first, then switches direction on repeated clicks.
   *
   * @param {string} colId Column to sort by.
   */
  const toggleSort = (colId) => {
    if (sort !== colId) onChange?.({ sort: colId, order: 'asc' });
    else onChange?.({ sort: colId, order: order === 'asc' ? 'desc' : 'asc' });
  };

  return (
    <div className="card overflow-hidden">
      {(toolbar || id) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              icon={Columns3}
              onClick={() => setColsOpen((o) => !o)}
              aria-expanded={colsOpen}
            >
              Columns
            </Button>
            {colsOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide() && c.id !== '_select')
                  .map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-canvas"
                    >
                      <input
                        type="checkbox"
                        className="accent-brand-700"
                        checked={c.getIsVisible()}
                        onChange={c.getToggleVisibilityHandler()}
                      />
                      {typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
      {selectable && selected.length > 0 && bulkActions && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-50 px-4 py-2 text-sm">
          <span className="font-semibold text-brand-800">{selected.length} selected</span>
          {bulkActions(selected, () => setSelection({}))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas/70 text-xs uppercase tracking-wide text-ink-soft">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = h.column.columnDef.enableSorting !== false && h.column.columnDef.sortKey;
                  const active = sortable && sort === h.column.columnDef.sortKey;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={cn('whitespace-nowrap px-4 py-2.5 font-semibold', h.column.columnDef.className)}
                      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 uppercase hover:text-ink"
                          onClick={() => toggleSort(h.column.columnDef.sortKey)}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {active ? (
                            order === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {loading &&
              Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                <tr key={i}>
                  {table.getVisibleLeafColumns().map((c) => (
                    <td key={c.id} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[180px]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-brand-50/50',
                    row.getIsSelected() && 'bg-brand-50/60',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn('px-4 py-3 align-top', cell.column.columnDef.cellClassName)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && error && <ErrorState error={error} onRetry={onRetry} />}
        {!loading &&
          !error &&
          data.length === 0 &&
          (empty || <EmptyState title="Nothing to show" description="No items match the current filters." />)}
      </div>
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-sm text-ink-soft">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              Rows
              <select
                className="rounded-md border border-line bg-white px-1.5 py-1 text-xs"
                value={pageSize}
                onChange={(e) => onChange?.({ pageSize: e.target.value, page: 1 })}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={page <= 1}
              onClick={() => onChange?.({ page: page - 1 })}
              aria-label="Previous page"
            />
            <span className="text-xs">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              disabled={page >= totalPages}
              onClick={() => onChange?.({ page: page + 1 })}
              aria-label="Next page"
            />
          </div>
        </div>
      )}
    </div>
  );
}
