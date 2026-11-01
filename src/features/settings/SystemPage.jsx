/**
 * System health page for administrators.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo } from 'react';
import { RotateCcw, ExternalLink } from 'lucide-react';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { API_BASE } from '../../lib/api.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { FilterSelect } from '../../components/search/SearchInput.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  StatusBadge,
  Button,
  PageLoader,
  ErrorState,
} from '../../components/ui/index.js';
import { fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Shows the state of the database, Redis and storage, the optional integrations, queue depths and disk space,
 * refreshed every 30 seconds. Background jobs are listed by status and queue, failed jobs show their error and can
 * be retried safely, and there is a link to the API documentation.
 *
 * @returns {JSX.Element}
 */
export default function SystemPage() {
  const health = useApi('health', '/health/details', null, { refetchInterval: 30_000 });
  const [p, set] = useQueryParams({ pageSize: 25, status: 'failed' });
  const jobs = useApi('jobs', '/jobs', { page: p.page, pageSize: p.pageSize, status: p.status, queue: p.queue });
  const retry = useApiMutation((id) => post(`/jobs/${id}/retry`, {}), {
    success: 'Job re-queued',
    invalidate: ['jobs'],
  });
  const columns = useMemo(
    () => [
      {
        id: 'type',
        header: 'Job',
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-xs">{row.original.jobType}</p>
            <p className="text-xs text-ink-soft">{row.original.queue}</p>
          </div>
        ),
      },
      {
        id: 'entity',
        header: 'Entity',
        cell: ({ row }) =>
          row.original.entityType ? `${row.original.entityType} ${row.original.entityId?.slice(0, 8)}` : '—',
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'attempts', header: 'Attempts', cell: ({ row }) => row.original.attempts },
      {
        id: 'error',
        header: 'Last error',
        cell: ({ row }) => <span className="line-clamp-2 max-w-md text-xs text-red-700">{row.original.lastError}</span>,
      },
      { id: 'when', header: 'Created', cell: ({ row }) => fmtDateTime(row.original.createdAt) },
      {
        id: 'retry',
        header: '',
        enableHiding: false,
        cell: ({ row }) =>
          row.original.status === 'failed' && (
            <Button
              size="sm"
              variant="secondary"
              icon={RotateCcw}
              onClick={(e) => {
                e.stopPropagation();
                retry.mutate(row.original.id);
              }}
            >
              Retry
            </Button>
          ),
      },
    ],
    [retry],
  );
  if (health.isLoading) return <PageLoader />;
  if (health.error) return <ErrorState error={health.error} onRetry={health.refetch} />;
  const h = health.data.data;
  return (
    <div>
      <PageHeader
        title="System health"
        description="Dependencies, integrations and background jobs. Failed jobs are visible and can be retried safely."
        actions={
          <Button
            variant="secondary"
            icon={ExternalLink}
            onClick={() => window.open(`${API_BASE}/docs`, '_blank', 'noopener')}
          >
            API documentation
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Dependencies" />
          <ul className="divide-y divide-line">
            {h.checks.map((c) => (
              <li key={c.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="capitalize">
                  {c.name}
                  {c.error && <span className="block text-xs text-red-700">{c.error}</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-soft">
                  {c.latencyMs} ms{' '}
                  <Badge tone={c.status === 'up' ? 'green' : c.status === 'disabled' ? 'neutral' : 'red'}>
                    {c.status}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Integrations" description="Optional services sit behind adapters" />
          <ul className="divide-y divide-line">
            {Object.entries(h.integrations).map(([k, v]) => (
              <li key={k} className="flex justify-between px-5 py-2.5 text-sm">
                <span>{humanize(k)}</span>
                {typeof v === 'boolean' ? (
                  <Badge tone={v ? 'green' : 'neutral'}>{v ? 'Enabled' : 'Disabled'}</Badge>
                ) : (
                  <Badge>{v}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Queues" />
          <CardBody className="space-y-1.5 text-sm">
            {Object.entries(h.queues).map(([q, c]) => (
              <div key={q} className="flex justify-between">
                <span>{q}</span>
                <span className="text-xs text-ink-soft">
                  {c.error ? (
                    <span className="text-red-700">{c.error}</span>
                  ) : (
                    `${c.waiting} waiting · ${c.active} active · ${c.failed} failed`
                  )}
                </span>
              </div>
            ))}
            {!Object.keys(h.queues).length && <p className="text-ink-soft">Queues are disabled; jobs run inline.</p>}
            <p className="pt-2 text-xs text-ink-soft">
              Version {h.version} · up {Math.round(h.uptimeSeconds / 60)} min
            </p>
          </CardBody>
        </Card>
      </div>
      <DataTable
        id="jobs"
        columns={columns}
        data={jobs.data?.data}
        total={jobs.data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={jobs.isLoading}
        error={jobs.error}
        toolbar={
          <>
            <FilterSelect
              label="Status"
              value={p.status}
              onChange={(v) => set({ status: v })}
              options={['queued', 'running', 'succeeded', 'failed']}
            />
            <FilterSelect
              label="Queue"
              value={p.queue}
              onChange={(v) => set({ queue: v })}
              options={['ingest', 'ocr', 'fixity', 'indexing', 'reports', 'notifications', 'maintenance', 'imports']}
            />
          </>
        }
      />
    </div>
  );
}
