/**
 * Research requests queue for research services staff.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { SearchInput, FilterSelect } from '../../components/search/SearchInput.jsx';
import { StatusBadge, Badge, Tabs } from '../../components/ui/index.js';
import { fmtDate, humanize, relative } from '../../utils/format.js';

const QUEUES = {
  action: 'submitted,under_review,awaiting_approval',
  waiting: 'awaiting_researcher',
  active: 'approved,scheduled,in_progress',
  done: 'fulfilled,closed,rejected,cancelled',
};

/**
 * Lists research requests in tabs (needing action, awaiting a second approval and so on), filterable by type,
 * oldest first. Requests for restricted material that need a second approval are marked.
 *
 * @returns {JSX.Element}
 */
export default function RequestsQueuePage() {
  const navigate = useNavigate();
  const [p, set] = useQueryParams({ pageSize: 25, queue: 'action', sort: 'submittedAt', order: 'asc' });
  const status = p.status || QUEUES[p.queue];
  const { data, isLoading, error, refetch } = useApi('research-queue', '/research-requests', {
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    order: p.order,
    q: p.q,
    status,
    requestType: p.requestType,
    assignedToMe: p.assignedToMe,
  });
  const columns = useMemo(
    () => [
      {
        id: 'no',
        header: 'Request',
        sortKey: 'submittedAt',
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-xs text-gold-700">{row.original.requestNumber}</p>
            <p className="text-xs text-ink-soft">{relative(row.original.submittedAt)}</p>
          </div>
        ),
      },
      {
        id: 'who',
        header: 'Researcher',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.contactName}</p>
            <p className="text-xs text-ink-soft">{row.original.affiliation || row.original.contactEmail}</p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="flex items-center gap-1">
            {humanize(row.original.requestType)}
            {row.original.requiresSecondApproval && <Badge tone="violet">2nd approval</Badge>}
          </span>
        ),
      },
      { id: 'items', header: 'Items', cell: ({ row }) => row.original.items?.length },
      {
        id: 'date',
        header: 'Preferred date',
        sortKey: 'preferredDate',
        cell: ({ row }) => fmtDate(row.original.preferredDate),
      },
      { id: 'assigned', header: 'Assigned', cell: ({ row }) => row.original.assignedTo?.fullName || '—' },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Research requests"
        description="Enquiries, consultation, restricted access and copy requests. Decisions are recorded with public and internal reasons."
      />
      <Tabs
        className="mb-4"
        value={p.queue}
        onChange={(queue) => set({ queue, status: '' })}
        tabs={[
          { value: 'action', label: 'Needs action' },
          { value: 'waiting', label: 'Awaiting researcher' },
          { value: 'active', label: 'Approved & scheduled' },
          { value: 'done', label: 'Closed' },
        ]}
      />
      <DataTable
        id="research"
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
        onRowClick={(r) => navigate(`/admin/research-requests/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} placeholder="Number, name or email" />
            <FilterSelect
              label="Type"
              value={p.requestType}
              onChange={(v) => set({ requestType: v })}
              options={['consultation', 'restricted_access', 'digital_copy', 'reproduction', 'enquiry'].map((t) => ({
                value: t,
                label: humanize(t),
              }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-brand-700"
                checked={p.assignedToMe === 'true'}
                onChange={(e) => set({ assignedToMe: e.target.checked ? 'true' : '' })}
              />{' '}
              Mine
            </label>
          </>
        }
      />
    </div>
  );
}
