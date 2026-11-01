/**
 * Audit explorer for auditors and compliance officers.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { ShieldCheck, FileDown } from 'lucide-react';
import { download, api } from '../../lib/api.js';
import { useApi, useApiMutation } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { SearchInput, FilterSelect } from '../../components/search/SearchInput.jsx';
import { Button, StatusBadge, Dialog, Alert, Input, Badge } from '../../components/ui/index.js';
import { fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Lists audit events with filters for actor, action prefix, outcome and date range; the filters live in the URL.
 * Selecting an event shows its resource, correlation ID, before and after values and hash. "Verify integrity"
 * recomputes the hash chain and reports whether it is intact, and the filtered events can be exported as CSV (the
 * export itself is audited). Passwords, tokens and document contents are never logged.
 *
 * @returns {JSX.Element}
 */
export default function AuditPage() {
  const [p, set] = useQueryParams({ pageSize: 50 });
  const [detail, setDetail] = useState(null);
  const filters = {
    q: p.q,
    action: p.action,
    resourceType: p.resourceType,
    resourceId: p.resourceId,
    outcome: p.outcome,
    from: p.from,
    to: p.to,
    correlationId: p.correlationId,
  };
  const { data, isLoading, error, refetch } = useApi('audit', '/audit/events', {
    page: p.page,
    pageSize: p.pageSize,
    ...filters,
  });
  const verify = useApiMutation(() => api.get('/audit/verify-chain').then((r) => r.data));
  const columns = useMemo(
    () => [
      {
        id: 'when',
        header: 'When',
        cell: ({ row }) => <span className="whitespace-nowrap">{fmtDateTime(row.original.occurredAt)}</span>,
      },
      { id: 'actor', header: 'Actor', cell: ({ row }) => row.original.actorLabel || humanize(row.original.actorType) },
      {
        id: 'action',
        header: 'Action',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.action}</span>,
      },
      {
        id: 'resource',
        header: 'Resource',
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.resourceType}
            <span className="block font-mono text-ink-soft">{row.original.resourceId?.slice(0, 18)}</span>
          </span>
        ),
      },
      { id: 'outcome', header: 'Outcome', cell: ({ row }) => <StatusBadge status={row.original.outcome} /> },
      { id: 'flags', header: '', cell: ({ row }) => row.original.sensitive && <Badge tone="amber">Sensitive</Badge> },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Audit explorer"
        description="Append-only, hash-chained record of authentication, changes, access decisions, exports and preservation events. Passwords, tokens and document contents are never logged."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={ShieldCheck}
              loading={verify.isPending}
              onClick={() => verify.mutate()}
            >
              Verify integrity
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={FileDown}
              onClick={() =>
                download(`/audit/events/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v))}`)
              }
            >
              Export CSV
            </Button>
          </>
        }
      />
      {verify.data && (
        <Alert tone={verify.data.data.valid ? 'success' : 'danger'} className="mb-4">
          {verify.data.data.valid
            ? `Hash chain intact across ${verify.data.data.checked.toLocaleString()} events.`
            : `Chain broken at event ${verify.data.data.brokenAtSeq}. Investigate immediately.`}
        </Alert>
      )}
      <DataTable
        id="audit"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={setDetail}
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} placeholder="Actor, action or resource ID" />
            <Input
              aria-label="Action prefix"
              placeholder="Action prefix, e.g. access."
              defaultValue={p.action}
              onBlur={(e) => set({ action: e.target.value })}
              className="h-9 w-48"
            />
            <FilterSelect
              label="Outcome"
              value={p.outcome}
              onChange={(v) => set({ outcome: v })}
              options={['success', 'failure', 'denied']}
            />
            <Input
              type="date"
              aria-label="From"
              defaultValue={p.from}
              onChange={(e) => set({ from: e.target.value })}
              className="h-9 w-auto"
            />
            <Input
              type="date"
              aria-label="To"
              defaultValue={p.to}
              onChange={(e) => set({ to: e.target.value })}
              className="h-9 w-auto"
            />
          </>
        }
      />
      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        size="xl"
        title={detail?.action}
        description={
          detail &&
          `${fmtDateTime(detail.occurredAt)} · ${detail.actorLabel || detail.actorType} · ${detail.ipAddress || ''}`
        }
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold">Resource:</span> {detail.resourceType} {detail.resourceId}
            </p>
            <p>
              <span className="font-semibold">Correlation ID:</span>{' '}
              <button
                type="button"
                className="font-mono text-brand-700 hover:underline"
                onClick={() => {
                  set({ correlationId: detail.correlationId });
                  setDetail(null);
                }}
              >
                {detail.correlationId}
              </button>
            </p>
            {detail.reason && (
              <p>
                <span className="font-semibold">Reason:</span> {detail.reason}
              </p>
            )}
            {['before', 'after', 'metadata'].map(
              (k) =>
                detail[k] && (
                  <div key={k}>
                    <p className="font-semibold">{humanize(k)}</p>
                    <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-canvas p-3 text-xs">
                      {JSON.stringify(detail[k], null, 2)}
                    </pre>
                  </div>
                ),
            )}
            <p className="break-all font-mono text-[11px] text-ink-soft">
              hash {detail.hash}
              <br />
              prev {detail.prevHash}
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
