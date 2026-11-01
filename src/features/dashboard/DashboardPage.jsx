/**
 * Role-aware staff dashboard.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Library,
  PackageCheck,
  HardDrive,
  ScanLine,
  ShieldAlert,
  MessageSquareText,
  CalendarDays,
  ArrowLeftRight,
  Boxes,
  FileSearch,
  Inbox,
  Download,
} from 'lucide-react';
import { useApi } from '../../lib/query.js';
import { useAuth } from '../../store/auth.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { StatCard } from '../../components/feedback/StatCard.jsx';
import { ChartCard } from '../../components/feedback/Charts.jsx';
import { Card, CardHeader, PageLoader, ErrorState, StatusBadge, Input, Button } from '../../components/ui/index.js';
import { fmtBytes, relative, humanize, fmtDate } from '../../utils/format.js';

/**
 * Neutralises text that a spreadsheet program would run as a formula, by prefixing an apostrophe. Plain negative
 * numbers are left unchanged. Mirrors the backend's csvSafe.
 *
 * @param {string} value The cell text.
 * @returns {string}
 */
const csvSafe = (value) =>
  /^[=+@\t\r]/.test(value) || (value.startsWith('-') && !/^-\d+(\.\d+)?$/.test(value)) ? `'${value}` : value;

/**
 * Converts the dashboard figures and chart series into CSV text, with every value quoted, escaped and protected against formula injection.
 *
 * @param {object} dash Dashboard data from the API.
 * @returns {string}
 */
function toCsv(dash) {
  const rows = [['Metric', 'Value'], ...Object.entries(dash.metrics).map(([k, v]) => [humanize(k), v])];
  for (const [k, series] of Object.entries(dash.charts))
    for (const r of series) rows.push([`${humanize(k)}: ${r.name}`, r.value ?? r.used]);
  return rows.map((r) => r.map((c) => `"${csvSafe(String(c ?? '')).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Greets the user and shows live figures, the work queues for their role ("Needs your attention"), charts and
 * recent activity for an optional date range. Only the sections the user has permission for are returned by the
 * server, and no figure is estimated or stored. Users who may export reports can download the figures as CSV.
 *
 * @returns {JSX.Element}
 */
export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const can = useAuth((s) => s.can);
  const [range, setRange] = useState({ from: '', to: '' });
  const { data, isLoading, error, refetch } = useApi('dashboard', '/dashboard', range);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  const m = d.metrics;

  /**
   * Downloads the current dashboard figures as a CSV file. The file starts with a byte-order mark so Excel reads it
   * as UTF-8.
   */
  const exportCsv = () => {
    const blob = new Blob([`\uFEFF${toCsv(d)}`], { type: 'text/csv' });
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href,
      download: `dashboard-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  const stats = [
    m.descriptions !== undefined && {
      label: 'Archival descriptions',
      value: m.descriptions,
      icon: FileText,
      to: '/admin/records',
      hint: `${m.recordsThisMonth} created this month`,
    },
    m.collections !== undefined && {
      label: 'Collections & fonds',
      value: m.collections,
      icon: Library,
      to: '/admin/collections',
    },
    m.accessionsAwaitingReview !== undefined && {
      label: 'Accessions awaiting review',
      value: m.accessionsAwaitingReview,
      icon: PackageCheck,
      to: '/admin/accessions?status=submitted',
      tone: 'gold',
    },
    m.digitalAssets !== undefined && {
      label: 'Digital assets',
      value: m.digitalAssets,
      icon: HardDrive,
      to: '/admin/assets',
      hint: fmtBytes(m.storageBytes),
    },
    m.digitisationBatchesInProgress !== undefined && {
      label: 'Digitisation batches active',
      value: m.digitisationBatchesInProgress,
      icon: ScanLine,
      to: '/admin/digitisation',
    },
    m.ocrAwaitingReview !== undefined && {
      label: 'OCR awaiting review',
      value: m.ocrAwaitingReview,
      icon: FileSearch,
      to: '/admin/ocr',
      tone: 'gold',
    },
    m.preservationExceptions !== undefined && {
      label: 'Preservation exceptions',
      value: m.preservationExceptions,
      icon: ShieldAlert,
      to: '/admin/preservation',
      tone: m.preservationExceptions ? 'red' : 'brand',
    },
    m.researchRequestsAwaitingAction !== undefined && {
      label: 'Research requests to action',
      value: m.researchRequestsAwaitingAction,
      icon: MessageSquareText,
      to: '/admin/research-requests',
      tone: 'gold',
    },
    m.appointmentsToday !== undefined && {
      label: "Today's appointments",
      value: m.appointmentsToday,
      icon: CalendarDays,
      to: '/admin/reading-room',
    },
    m.outstandingPhysicalItems !== undefined && {
      label: 'Items out in reading room',
      value: m.outstandingPhysicalItems,
      icon: ArrowLeftRight,
      to: '/admin/circulation?status=issued,overdue',
    },
    m.physicalItems !== undefined && {
      label: 'Physical items',
      value: m.physicalItems,
      icon: Boxes,
      to: '/admin/storage/items',
    },
    m.myUnitTransfers !== undefined && {
      label: "My unit's transfers",
      value: m.myUnitTransfers,
      icon: Inbox,
      to: '/admin/transfers',
    },
  ].filter(Boolean);
  const c = d.charts;
  return (
    <div>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user.fullName.split(' ')[0]}`}
        documentTitle="Dashboard"
        description="Live figures from the catalogue, workflows and preservation system."
        actions={
          <>
            <label className="text-xs font-semibold text-ink-soft">
              From{' '}
              <Input
                type="date"
                className="ml-1 inline-block h-9 w-auto"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-ink-soft">
              To{' '}
              <Input
                type="date"
                className="ml-1 inline-block h-9 w-auto"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </label>
            {can('reports.export') && (
              <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
                CSV
              </Button>
            )}
          </>
        }
      />
      {d.work?.some((w) => w.count > 0) && (
        <Card className="mb-6">
          <CardHeader title="Needs your attention" description="Live queues for your role" />
          <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {d.work
              .filter((w) => w.count > 0)
              .map((w) => (
                <li key={w.key}>
                  <Link to={w.link} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                    <span className="text-sm font-medium">{w.label}</span>
                    <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-brand-900">
                      {w.count}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {c.acquisitionsByYear && (
          <ChartCard title="Acquisitions by year" data={c.acquisitionsByYear} labelFormat={String} />
        )}
        {c.collectionsByType && (
          <ChartCard title="Collections by category" data={c.collectionsByType} kind="pie" labelFormat={String} />
        )}
        {c.recordsByDepartment && (
          <ChartCard
            title="Descriptions by department"
            data={c.recordsByDepartment}
            horizontal
            labelFormat={String}
            height={300}
          />
        )}
        {c.accessLevels && <ChartCard title="Restricted and open descriptions" data={c.accessLevels} kind="pie" />}
        {c.digitisationProgress && <ChartCard title="Digitisation batches by stage" data={c.digitisationProgress} />}
        {c.researchRequestsByStatus && (
          <ChartCard
            title="Research requests by status"
            description="In the selected period"
            data={c.researchRequestsByStatus}
          />
        )}
        {c.formats && (
          <ChartCard
            title="Formats of digital holdings"
            data={c.formats}
            horizontal
            labelFormat={String}
            height={300}
          />
        )}
        {c.preservationStatus && <ChartCard title="Preservation status" data={c.preservationStatus} kind="pie" />}
        {c.fixityLast30Days && <ChartCard title="Fixity checks (last 30 days)" data={c.fixityLast30Days} />}
        {c.storageUtilisation && (
          <ChartCard
            title="Storage utilisation (most full)"
            data={c.storageUtilisation.map((s) => ({
              name: s.name,
              value: s.capacity ? Math.round((Number(s.used) / Number(s.capacity)) * 100) : 0,
            }))}
            horizontal
            labelFormat={String}
            description="Percentage of recorded capacity"
          />
        )}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {d.recent && (
          <Card>
            <CardHeader title="Recently updated descriptions" />
            <ul className="divide-y divide-line">
              {d.recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/admin/records/${r.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{r.title}</span>
                      <span className="text-xs text-ink-soft">
                        {r.referenceCode} · {relative(r.updatedAt)}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {d.activity && (
          <Card>
            <CardHeader
              title="Recent activity"
              actions={
                <Link to="/admin/audit" className="text-sm font-semibold text-brand-700 hover:underline">
                  Audit explorer
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {d.activity.map((a) => (
                <li key={a.seq} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{humanize(a.action)}</span>{' '}
                    <span className="text-ink-soft">by {a.actorLabel || 'system'}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-soft">{relative(a.occurredAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <p className="mt-6 text-xs text-ink-soft">Generated {fmtDate(d.generatedAt)} from live data.</p>
    </div>
  );
}
