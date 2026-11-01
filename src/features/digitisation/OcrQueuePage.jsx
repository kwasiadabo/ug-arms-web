/**
 * OCR review queue.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { FilterSelect } from '../../components/search/SearchInput.jsx';
import { StatusBadge } from '../../components/ui/index.js';
import { relative, humanize } from '../../utils/format.js';

/**
 * Lists files with OCR output, their page count, mean confidence and review status, filterable by status. OCR text
 * is stored separately from the file and becomes searchable only after an authorised person approves it.
 *
 * @returns {JSX.Element}
 */
export default function OcrQueuePage() {
  const navigate = useNavigate();
  const [p, set] = useQueryParams({ pageSize: 25 });
  const { data, isLoading, error, refetch } = useApi('ocr-queue', '/ocr/queue', {
    page: p.page,
    pageSize: p.pageSize,
    status: p.status,
  });
  const columns = useMemo(
    () => [
      {
        id: 'file',
        header: 'File',
        cell: ({ row }) => <span className="font-semibold">{row.original.originalFilename}</span>,
      },
      {
        id: 'record',
        header: 'Description',
        cell: ({ row }) =>
          row.original.record ? `${row.original.record.referenceCode} — ${row.original.record.title}` : '—',
      },
      { id: 'pages', header: 'Pages', cell: ({ row }) => row.original.pageCount ?? '—' },
      {
        id: 'confidence',
        header: 'Mean confidence',
        cell: ({ row }) => {
          const c = row.original.ocrJobs?.[0]?.meanConfidence;
          return c ? `${Number(c).toFixed(0)}%` : '—';
        },
      },
      {
        id: 'status',
        header: 'OCR status',
        cell: ({ row }) => (
          <div>
            <StatusBadge status={row.original.ocrStatus} />
            {row.original.ocrJobs?.[0]?.error && (
              <p className="mt-1 max-w-xs text-xs text-red-700">{row.original.ocrJobs[0].error}</p>
            )}
          </div>
        ),
      },
      { id: 'updated', header: 'Updated', cell: ({ row }) => relative(row.original.updatedAt) },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="OCR review queue"
        description="OCR text is stored separately from the file and is searchable only after an authorised person approves it."
      />
      <DataTable
        id="ocr"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/ocr/${r.id}`)}
        toolbar={
          <FilterSelect
            label="Status"
            value={p.status}
            onChange={(v) => set({ status: v })}
            options={['succeeded', 'failed', 'queued', 'running'].map((s) => ({ value: s, label: humanize(s) }))}
          />
        }
      />
    </div>
  );
}
