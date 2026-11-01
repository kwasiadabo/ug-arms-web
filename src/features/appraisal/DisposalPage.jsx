/**
 * List of disposal cases.
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
import { fmtDate, humanize } from '../../utils/format.js';

/**
 * Lists disposal cases with their status, filterable by status. Executed cases are kept permanently as evidence.
 *
 * @returns {JSX.Element}
 */
export default function DisposalPage() {
  const navigate = useNavigate();
  const [p, set] = useQueryParams({ pageSize: 25 });
  const { data, isLoading, error, refetch } = useApi('disposal-cases', '/disposal/cases', {
    page: p.page,
    pageSize: p.pageSize,
    status: p.status,
  });
  const columns = useMemo(
    () => [
      {
        id: 'no',
        header: 'Case',
        cell: ({ row }) => <span className="font-mono text-xs text-gold-700">{row.original.caseNumber}</span>,
      },
      {
        id: 'appraisal',
        header: 'Appraisal',
        cell: ({ row }) => `${row.original.appraisalCase?.caseNumber} — ${row.original.appraisalCase?.title}`,
      },
      { id: 'action', header: 'Action', cell: ({ row }) => humanize(row.original.action) },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'created', header: 'Created', cell: ({ row }) => fmtDate(row.original.createdAt) },
      { id: 'executed', header: 'Executed', cell: ({ row }) => fmtDate(row.original.executedAt) },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Authorised disposal"
        description="Disposal cases with dry-run evidence, distinct approvals and certificates. Executed cases are permanent evidence."
      />
      <DataTable
        id="disposal"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/disposal/${r.id}`)}
        toolbar={
          <FilterSelect
            label="Status"
            value={p.status}
            onChange={(v) => set({ status: v })}
            options={['draft', 'pending_approval', 'approved', 'executed', 'blocked', 'cancelled'].map((s) => ({
              value: s,
              label: humanize(s),
            }))}
          />
        }
      />
    </div>
  );
}
