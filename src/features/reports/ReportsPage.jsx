/**
 * Reports centre: run reports on screen and export them.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileSpreadsheet, FileText, FileDown, Lock } from 'lucide-react';
import { api, download, errorMessage } from '../../lib/api.js';
import { useApi } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Tabs,
  StatusBadge,
  EmptyState,
  Badge,
  PageLoader,
  ErrorState,
  cn,
} from '../../components/ui/index.js';
import { fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Formats a report cell for display: timestamps as date and time, decimals to one place, and empty values as blank.
 *
 * @param {*} v The cell value.
 * @returns {string}
 */
const fmtCell = (v) =>
  v === null || v === undefined
    ? ''
    : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)
      ? fmtDateTime(v)
      : typeof v === 'number' && !Number.isInteger(v)
        ? v.toFixed(1)
        : String(v);

/**
 * Lists the reports available to the user, grouped and marked when sensitive. The chosen report runs for an
 * optional date range, and authorised users can export it as CSV, Excel or PDF. A second tab lists large exports
 * generated in the background, which are kept for seven days. Exports apply the same access rules as the screens,
 * and every export is logged.
 *
 * @returns {JSX.Element}
 */
export default function ReportsPage() {
  const { canAny } = useCan();
  const [p, set] = useQueryParams({ tab: 'run' });
  const [range, setRange] = useState({ from: '', to: '' });
  const catalog = useApi('reports', '/reports');
  const exportsList = useApi('exports', '/reports/exports', null, {
    enabled: p.tab === 'exports',
    refetchInterval: 10_000,
  });
  const key = p.report || catalog.data?.data[0]?.key;
  const params = Object.fromEntries(Object.entries(range).filter(([, v]) => v));
  const report = useQuery({
    queryKey: ['report', key, params],
    queryFn: () => api.get(`/reports/${key}`, { params }).then((r) => r.data.data),
    enabled: Boolean(key) && p.tab === 'run',
  });
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of catalog.data?.data || []) m.set(r.group, [...(m.get(r.group) || []), r]);
    return [...m.entries()];
  }, [catalog.data]);

  /**
   * Exports the current report. Small reports download immediately; large ones are queued and appear under Exports
   * when ready.
   *
   * @param {'csv'|'xlsx'|'pdf'} format Output format.
   * @returns {Promise<void>}
   */
  const exportAs = async (format) => {
    try {
      const res = await api.post(
        `/reports/${key}/export`,
        { ...params, format },
        { responseType: 'blob', validateStatus: (s) => s < 500 },
      );
      if (res.status === 202) {
        const json = JSON.parse(await res.data.text());
        toast.success(`Large report queued (${json.data.rows} rows). It will appear under Exports.`);
        return;
      }
      if (res.status >= 400) {
        toast.error(JSON.parse(await res.data.text()).error?.message || 'Export failed');
        return;
      }
      const name = /filename="?([^"]+)"?/.exec(res.headers['content-disposition'] || '')?.[1] || `${key}.${format}`;
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(res.data), download: name });
      a.click();
      toast.success('Export downloaded and logged');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (catalog.isLoading) return <PageLoader />;
  if (catalog.error) return <ErrorState error={catalog.error} />;
  const meta = catalog.data.data.find((r) => r.key === key);
  return (
    <div>
      <PageHeader
        title="Reports centre"
        description="Operational and governance reports from live data. Exports apply the same access rules and every export is logged."
      />
      <Tabs
        className="mb-4"
        value={p.tab}
        onChange={(tab) => set({ tab })}
        tabs={[
          { value: 'run', label: 'Reports' },
          { value: 'exports', label: 'My exports' },
        ]}
      />
      {p.tab === 'run' ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card as="nav" aria-label="Reports" className="max-h-[75vh] overflow-y-auto p-2">
            {groups.map(([g, list]) => (
              <div key={g} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">{g}</p>
                {list.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => set({ report: r.key })}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                      key === r.key ? 'bg-brand-50 font-semibold text-brand-800' : 'hover:bg-canvas',
                    )}
                  >
                    {r.title}
                    {r.sensitive && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-label="Sensitive" />}
                  </button>
                ))}
              </div>
            ))}
          </Card>
          <Card>
            <CardHeader
              title={meta?.title}
              description={meta?.sensitive ? 'Sensitive report: exports are flagged in the audit trail.' : undefined}
              actions={
                <>
                  <label className="text-xs font-semibold text-ink-soft">
                    From{' '}
                    <Input
                      type="date"
                      className="ml-1 inline-block h-8 w-auto"
                      value={range.from}
                      onChange={(e) => setRange({ ...range, from: e.target.value })}
                    />
                  </label>
                  <label className="text-xs font-semibold text-ink-soft">
                    To{' '}
                    <Input
                      type="date"
                      className="ml-1 inline-block h-8 w-auto"
                      value={range.to}
                      onChange={(e) => setRange({ ...range, to: e.target.value })}
                    />
                  </label>
                  {canAny('reports.export', 'audit.read') && (
                    <>
                      <Button size="sm" variant="secondary" icon={FileText} onClick={() => exportAs('csv')}>
                        CSV
                      </Button>
                      <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => exportAs('xlsx')}>
                        Excel
                      </Button>
                      <Button size="sm" variant="secondary" icon={FileDown} onClick={() => exportAs('pdf')}>
                        PDF
                      </Button>
                    </>
                  )}
                </>
              }
            />
            {report.isLoading ? (
              <CardBody>Running…</CardBody>
            ) : report.error ? (
              <ErrorState error={report.error} />
            ) : (
              report.data && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas/70 text-xs uppercase text-ink-soft">
                      <tr>
                        {report.data.columns.map((c) => (
                          <th key={c.key} className="whitespace-nowrap px-4 py-2 text-left">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {report.data.rows.map((r, i) => (
                        <tr key={i}>
                          {report.data.columns.map((c) => (
                            <td key={c.key} className="px-4 py-2">
                              {fmtCell(r[c.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!report.data.rows.length && <EmptyState title="No data for this period" />}
                  {report.data.truncated && (
                    <p className="px-4 py-2 text-xs text-ink-soft">
                      Showing 1,000 of {report.data.total} rows. Export for the full data.
                    </p>
                  )}
                </div>
              )
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader
            title="Exports"
            description="Large exports are generated in the background and kept for seven days."
          />
          <ul className="divide-y divide-line">
            {exportsList.data?.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-semibold">{humanize(e.reportType)}</span>{' '}
                  <Badge>{e.format.toUpperCase()}</Badge>
                  {e.isSensitive && (
                    <Badge tone="amber" className="ml-1">
                      Sensitive
                    </Badge>
                  )}
                  <span className="block text-xs text-ink-soft">
                    {fmtDateTime(e.createdAt)}
                    {e.rowCount !== null && ` · ${e.rowCount} rows`}
                    {e.error && ` · ${e.error}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  {e.status === 'succeeded' && e.filename && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={FileDown}
                      onClick={() => download(`/reports/exports/${e.id}/download`)}
                    >
                      Download
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {exportsList.data && !exportsList.data.data.length && <EmptyState title="No exports yet" />}
        </Card>
      )}
    </div>
  );
}
