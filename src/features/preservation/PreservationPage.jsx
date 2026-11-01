/**
 * Digital preservation dashboard.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { useApi, useApiMutation, patch } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatCard } from '../../components/feedback/StatCard.jsx';
import { ChartCard } from '../../components/feedback/Charts.jsx';
import { StatusBadge, Badge, Tabs, Card, CardHeader, PageLoader } from '../../components/ui/index.js';
import { relative, humanize, fmtDateTime } from '../../utils/format.js';

const SEV = { critical: 'red', high: 'red', medium: 'amber', low: 'neutral' };

/**
 * Shows open alerts, assets verified, overdue fixity checks and high-risk formats, with charts, and tabs for
 * alerts, fixity checks, preservation events and the format registry. Preservation managers can change a format's
 * risk level and whether it is accepted for upload. Recorded checksums are never altered to make a check pass.
 *
 * @returns {JSX.Element}
 */
export default function PreservationPage() {
  const navigate = useNavigate();
  const { can } = useCan();
  const [p, set] = useQueryParams({ pageSize: 25, tab: 'alerts', status: 'open,investigating' });
  const summary = useApi('preservation-summary', '/preservation/summary');
  const alerts = useApi(
    'preservation-alerts',
    '/preservation/alerts',
    { page: p.page, pageSize: p.pageSize, status: p.status },
    { enabled: p.tab === 'alerts' },
  );
  const checks = useApi(
    'fixity-checks',
    '/preservation/fixity-checks',
    { page: p.page, pageSize: p.pageSize },
    { enabled: p.tab === 'fixity' },
  );
  const events = useApi(
    'preservation-events',
    '/preservation/events',
    { page: p.page, pageSize: p.pageSize },
    { enabled: p.tab === 'events' },
  );
  const formats = useApi('formats', '/preservation/formats', null, { enabled: p.tab === 'formats' });
  const updateFormat = useApiMutation(({ id, ...b }) => patch(`/preservation/formats/${id}`, b), {
    success: 'Format updated',
    invalidate: ['formats', 'preservation-summary'],
  });
  const alertCols = useMemo(
    () => [
      {
        id: 'sev',
        header: 'Severity',
        cell: ({ row }) => <Badge tone={SEV[row.original.severity]}>{humanize(row.original.severity)}</Badge>,
      },
      {
        id: 'type',
        header: 'Alert',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{humanize(row.original.alertType)}</p>
            <p className="text-xs text-ink-soft">{row.original.message}</p>
          </div>
        ),
      },
      {
        id: 'asset',
        header: 'Asset',
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.asset?.originalFilename}{' '}
            <span className="text-xs text-ink-soft">({humanize(row.original.asset?.role)})</span>
          </span>
        ),
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'raised', header: 'Raised', cell: ({ row }) => relative(row.original.createdAt) },
    ],
    [],
  );
  const checkCols = useMemo(
    () => [
      { id: 'asset', header: 'Asset', cell: ({ row }) => row.original.asset?.originalFilename },
      { id: 'status', header: 'Result', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'trigger', header: 'Trigger', cell: ({ row }) => humanize(row.original.triggeredBy) },
      { id: 'when', header: 'Checked', cell: ({ row }) => fmtDateTime(row.original.checkedAt) },
      { id: 'err', header: 'Detail', cell: ({ row }) => row.original.error || `${row.original.durationMs ?? '—'} ms` },
    ],
    [],
  );
  const eventCols = useMemo(
    () => [
      { id: 'when', header: 'When', cell: ({ row }) => fmtDateTime(row.original.eventAt) },
      { id: 'type', header: 'Event', cell: ({ row }) => humanize(row.original.eventType) },
      { id: 'outcome', header: 'Outcome', cell: ({ row }) => <StatusBadge status={row.original.outcome} /> },
      { id: 'agent', header: 'Agent', cell: ({ row }) => row.original.agentName },
      { id: 'detail', header: 'Detail', cell: ({ row }) => <span className="text-xs">{row.original.detail}</span> },
    ],
    [],
  );
  if (summary.isLoading) return <PageLoader />;
  const s = summary.data?.data;
  const open = Object.values(s?.openAlertsBySeverity || {}).reduce((a, b) => a + b, 0);
  return (
    <div>
      <PageHeader
        title="Digital preservation"
        description="Fixity verification, format risk and preservation events (PREMIS-informed). Recorded checksums are never altered to make a check pass."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open alerts" value={open} icon={ShieldAlert} tone={open ? 'red' : 'brand'} />
        <StatCard label="Assets verified OK" value={s?.preservationStatus.ok || 0} icon={ShieldCheck} />
        <StatCard
          label="Fixity overdue (7+ days)"
          value={s?.fixityOverdue}
          icon={Clock}
          tone={s?.fixityOverdue ? 'gold' : 'brand'}
        />
        <StatCard label="High-risk format masters" value={s?.formatRisk.high || 0} icon={AlertTriangle} tone="gold" />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Preservation status"
          kind="pie"
          data={Object.entries(s?.preservationStatus || {}).map(([name, value]) => ({ name, value }))}
        />
        <ChartCard
          title="Fixity results (last 30 days)"
          data={Object.entries(s?.fixityLast30Days || {}).map(([name, value]) => ({ name, value }))}
        />
      </div>
      <Tabs
        className="mb-4"
        value={p.tab}
        onChange={(tab) => set({ tab })}
        tabs={[
          { value: 'alerts', label: 'Alerts' },
          { value: 'fixity', label: 'Fixity checks' },
          { value: 'events', label: 'Events' },
          { value: 'formats', label: 'Format registry' },
        ]}
      />
      {p.tab === 'alerts' && (
        <DataTable
          id="alerts"
          columns={alertCols}
          data={alerts.data?.data}
          total={alerts.data?.meta.total}
          page={p.page}
          pageSize={p.pageSize}
          onChange={(x) => set(x, { resetPage: !('page' in x) })}
          loading={alerts.isLoading}
          error={alerts.error}
          onRowClick={(r) => navigate(`/admin/preservation/alerts/${r.id}`)}
          toolbar={
            <select
              aria-label="Status"
              value={p.status}
              onChange={(e) => set({ status: e.target.value })}
              className="h-9 rounded-lg border border-line px-2 text-sm"
            >
              <option value="open,investigating">Open</option>
              <option value="recovered,resolved,closed">Resolved</option>
              <option value="">All</option>
            </select>
          }
        />
      )}
      {p.tab === 'fixity' && (
        <DataTable
          id="fixity"
          columns={checkCols}
          data={checks.data?.data}
          total={checks.data?.meta.total}
          page={p.page}
          pageSize={p.pageSize}
          onChange={(x) => set(x, { resetPage: !('page' in x) })}
          loading={checks.isLoading}
          onRowClick={(r) => navigate(`/admin/assets/${r.assetId}`)}
        />
      )}
      {p.tab === 'events' && (
        <DataTable
          id="pevents"
          columns={eventCols}
          data={events.data?.data}
          total={events.data?.meta.total}
          page={p.page}
          pageSize={p.pageSize}
          onChange={(x) => set(x, { resetPage: !('page' in x) })}
          loading={events.isLoading}
          onRowClick={(r) => r.assetId && navigate(`/admin/assets/${r.assetId}`)}
        />
      )}
      {p.tab === 'formats' && (
        <Card>
          <CardHeader
            title="Format registry"
            description="Drives upload validation (formats not accepted are rejected) and risk classification."
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/70 text-xs uppercase text-ink-soft">
                <tr>
                  <th className="px-4 py-2 text-left">Format</th>
                  <th className="px-4 py-2 text-left">Media type</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Risk</th>
                  <th className="px-4 py-2 text-left">Accepted</th>
                  <th className="px-4 py-2 text-left">Holdings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {formats.data?.data.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-2 font-semibold">
                      {f.name}
                      <span className="block text-xs font-normal text-ink-soft">.{f.extensions.join(', .')}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{f.mediaType}</td>
                    <td className="px-4 py-2">{humanize(f.category)}</td>
                    <td className="px-4 py-2">
                      {can('preservation.manage') ? (
                        <select
                          aria-label={`Risk for ${f.name}`}
                          value={f.riskLevel}
                          onChange={(e) => updateFormat.mutate({ id: f.id, riskLevel: e.target.value })}
                          className="h-8 rounded-md border border-line px-1.5"
                        >
                          {['low', 'medium', 'high'].map((r) => (
                            <option key={r} value={r}>
                              {humanize(r)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        humanize(f.riskLevel)
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {can('preservation.manage') ? (
                        <input
                          type="checkbox"
                          aria-label={`Accept ${f.name}`}
                          className="accent-brand-700"
                          checked={f.isAcceptedForIngest}
                          onChange={(e) => updateFormat.mutate({ id: f.id, isAcceptedForIngest: e.target.checked })}
                        />
                      ) : f.isAcceptedForIngest ? (
                        'Yes'
                      ) : (
                        'No'
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{s?.formats[f.mediaType] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
