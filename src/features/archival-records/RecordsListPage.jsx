/**
 * List of archival descriptions for staff.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApi } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { SearchInput, FilterSelect } from '../../components/search/SearchInput.jsx';
import { Button, StatusBadge, AccessBadge, EmptyState } from '../../components/ui/index.js';
import { humanize, relative } from '../../utils/format.js';
import { LEVELS, STATUSES, ACCESS_LEVELS } from './constants.js';

/**
 * Lists descriptions at every level, filterable by level, status and access level and searchable, with a button to
 * create a new description for authorised users.
 *
 * @param {object} props
 * @param {boolean} [props.topLevel=false] Show only collections and fonds.
 * @param {boolean} [props.embedded=false] Render without the page header, inside another page.
 * @returns {JSX.Element}
 */
export default function RecordsListPage({ topLevel = false, embedded = false }) {
  const navigate = useNavigate();
  const { can } = useCan();
  const [p, set] = useQueryParams({ pageSize: 25, sort: 'updatedAt', order: 'desc' });
  const { data, isLoading, error, refetch } = useApi(['records', topLevel], '/records', {
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    order: p.order,
    q: p.q,
    level: p.level,
    status: p.status,
    accessLevel: p.accessLevel,
    topLevel: topLevel ? 'true' : undefined,
  });
  const columns = useMemo(
    () => [
      {
        id: 'referenceCode',
        header: 'Reference',
        sortKey: 'referenceCode',
        cell: ({ row }) => <span className="font-mono text-[12.5px] text-gold-700">{row.original.referenceCode}</span>,
      },
      {
        id: 'title',
        header: 'Title',
        sortKey: 'title',
        cell: ({ row }) => (
          <div className="min-w-[240px]">
            <p className="font-semibold">{row.original.title}</p>
            {row.original.dateExpression && <p className="text-xs text-ink-soft">{row.original.dateExpression}</p>}
          </div>
        ),
      },
      { id: 'level', header: 'Level', cell: ({ row }) => humanize(row.original.level) },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      { id: 'access', header: 'Access', cell: ({ row }) => <AccessBadge level={row.original.effectiveAccessLevel} /> },
      { id: 'children', header: 'Parts', cell: ({ row }) => row.original.childCount || '—' },
      {
        id: 'updatedAt',
        header: 'Updated',
        sortKey: 'updatedAt',
        cell: ({ row }) => <span className="whitespace-nowrap text-ink-soft">{relative(row.original.updatedAt)}</span>,
      },
    ],
    [],
  );
  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Archival descriptions"
          description="Every level of description, from fonds to item. Use filters to find work in progress."
          actions={
            can('records.create') && (
              <Button icon={Plus} to="/admin/records/new">
                New description
              </Button>
            )
          }
        />
      )}
      <DataTable
        id="records"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        sort={p.sort}
        order={p.order}
        onChange={(patch) => set(patch, { resetPage: !('page' in patch) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/records/${r.id}`)}
        empty={
          <EmptyState title="No descriptions found" description="Adjust the filters or create a new description." />
        }
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} placeholder="Title, reference, content…" />
            <FilterSelect
              label="Level"
              value={p.level}
              onChange={(v) => set({ level: v })}
              options={LEVELS.map((l) => ({ value: l, label: humanize(l) }))}
            />
            <FilterSelect
              label="Status"
              value={p.status}
              onChange={(v) => set({ status: v })}
              options={STATUSES.map((l) => ({ value: l, label: humanize(l) }))}
            />
            <FilterSelect
              label="Access"
              value={p.accessLevel}
              onChange={(v) => set({ accessLevel: v })}
              options={ACCESS_LEVELS.map((l) => ({ value: l, label: humanize(l) }))}
            />
          </>
        }
      />
    </div>
  );
}
