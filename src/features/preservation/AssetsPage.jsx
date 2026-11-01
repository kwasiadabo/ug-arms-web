/**
 * List of digital assets for preservation staff.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { SearchInput, FilterSelect } from '../../components/search/SearchInput.jsx';
import { StatusBadge, Badge, Button } from '../../components/ui/index.js';
import { fmtBytes, humanize, relative } from '../../utils/format.js';

/**
 * Lists preservation masters, original uploads and migrated versions with their status and preservation status,
 * filterable. Preservation managers can select assets and run a fixity check on them.
 *
 * @returns {JSX.Element}
 */
export default function AssetsPage() {
  const navigate = useNavigate();
  const { can } = useCan();
  const [p, set] = useQueryParams({ pageSize: 25, sort: 'createdAt', order: 'desc' });
  const { data, isLoading, error, refetch } = useApi('assets', '/digital-assets', {
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    order: p.order,
    q: p.q,
    status: p.status,
    preservationStatus: p.preservationStatus,
    role: p.role,
  });
  const fixity = useApiMutation((assetIds) => post('/preservation/fixity', { assetIds }), {
    success: (r) => `${r.data.jobIds.length} fixity check(s) queued`,
  });
  const columns = useMemo(
    () => [
      {
        id: 'file',
        header: 'File',
        sortKey: 'originalFilename',
        cell: ({ row }) =>
          row.original.restricted ? (
            <span className="inline-flex items-center gap-1 text-ink-soft">
              <Lock className="h-3.5 w-3.5" /> Restricted
            </span>
          ) : (
            <div>
              <p className="font-semibold">{row.original.originalFilename}</p>
              <p className="text-xs text-ink-soft">{row.original.mediaType}</p>
            </div>
          ),
      },
      { id: 'record', header: 'Description', cell: ({ row }) => row.original.record?.referenceCode || '—' },
      { id: 'role', header: 'Role', cell: ({ row }) => humanize(row.original.role) },
      { id: 'size', header: 'Size', sortKey: 'sizeBytes', cell: ({ row }) => fmtBytes(row.original.sizeBytes) },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'pres',
        header: 'Preservation',
        cell: ({ row }) => <StatusBadge status={row.original.preservationStatus} />,
      },
      {
        id: 'scan',
        header: 'Malware scan',
        cell: ({ row }) =>
          row.original.malwareStatus && (
            <Badge
              tone={
                row.original.malwareStatus === 'clean'
                  ? 'green'
                  : row.original.malwareStatus === 'skipped'
                    ? 'neutral'
                    : 'red'
              }
            >
              {humanize(row.original.malwareStatus)}
            </Badge>
          ),
      },
      { id: 'created', header: 'Uploaded', sortKey: 'createdAt', cell: ({ row }) => relative(row.original.createdAt) },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Digital assets"
        description="Preservation masters, original uploads and migrated versions. Derivatives are shown on each asset."
      />
      <DataTable
        id="assets"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        sort={p.sort}
        order={p.order}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/assets/${r.id}`)}
        selectable={can('preservation.manage')}
        bulkActions={(rows, clear) => (
          <Button
            size="sm"
            variant="secondary"
            loading={fixity.isPending}
            onClick={() =>
              fixity.mutate(
                rows.map((r) => r.id),
                { onSuccess: clear },
              )
            }
          >
            Run fixity check
          </Button>
        )}
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} placeholder="Filename or SHA-256" />
            <FilterSelect
              label="Status"
              value={p.status}
              onChange={(v) => set({ status: v })}
              options={['processing', 'available', 'quarantined', 'failed'].map((s) => ({
                value: s,
                label: humanize(s),
              }))}
            />
            <FilterSelect
              label="Preservation"
              value={p.preservationStatus}
              onChange={(v) => set({ preservationStatus: v })}
              options={['pending', 'ok', 'at_risk', 'fixity_failed', 'missing', 'recovered'].map((s) => ({
                value: s,
                label: humanize(s),
              }))}
            />
          </>
        }
      />
    </div>
  );
}
