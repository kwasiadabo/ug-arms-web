/**
 * Bulk import detail page: mapping, validation, import, reconciliation and sign-off.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Play, FileDown, ListChecks, Save } from 'lucide-react';
import { download } from '../../lib/api.js';
import { useApi, useApiMutation, post, put } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { Timeline } from '../../components/feedback/Timeline.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusBadge,
  PageLoader,
  ErrorState,
  Alert,
  Tabs,
  Select,
  ConfirmDialog,
} from '../../components/ui/index.js';
import { fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Guides an import through its steps. Columns are mapped to fields (suggested automatically). Every row is then
 * validated as a dry run, and rows can be reviewed by status with their errors. The valid rows are imported, and
 * rejected rows can be downloaded as CSV for correction and re-import without creating duplicates. The
 * reconciliation shows whether every source row is accounted for, and a person other than the one who ran the
 * import signs it off.
 *
 * @returns {JSX.Element}
 */
export default function ImportDetailPage() {
  const { id } = useParams();
  const { user } = useCan();
  const [p, set] = useQueryParams({ tab: 'mapping', rowStatus: 'invalid,failed', pageSize: 25 });
  const [mapping, setMapping] = useState({});
  const [signoff, setSignoff] = useState(false);
  const { data, isLoading, error, refetch } = useApi(['import', id], `/imports/${id}`, null, {
    refetchInterval: (q) => (['running', 'validating'].includes(q.state.data?.data.status) ? 2500 : false),
  });
  const templates = useApi('import-templates', '/imports/templates');
  const rows = useApi(
    ['import-rows', id],
    `/imports/${id}/rows`,
    { status: p.rowStatus, page: p.page, pageSize: p.pageSize },
    { enabled: p.tab === 'rows' },
  );
  useEffect(() => {
    if (data) setMapping(data.data.mapping || {});
  }, [data]);
  const inval = [['import', id], ['import-rows', id], 'imports'];
  const saveMapping = useApiMutation(() => put(`/imports/${id}/mapping`, { mapping }), {
    success: 'Mapping saved',
    invalidate: inval,
  });
  const validate = useApiMutation(() => post(`/imports/${id}/validate`, {}), {
    success: (r) => `Dry run complete: ${r.data.valid} valid, ${r.data.invalid} with errors`,
    invalidate: inval,
    onSuccess: () => set({ tab: 'rows' }),
  });
  const run = useApiMutation(() => post(`/imports/${id}/run`, {}), { success: 'Import started', invalidate: inval });
  const approve = useApiMutation(({ reason }) => post(`/imports/${id}/approve`, { note: reason }), {
    success: 'Reconciliation signed off',
    invalidate: inval,
    onSuccess: () => setSignoff(false),
  });
  const rowCols = useMemo(
    () => [
      { id: 'row', header: 'Row', cell: ({ row }) => row.original.rowNumber },
      {
        id: 'key',
        header: 'Source key',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sourceKey}</span>,
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'errors',
        header: 'Problems',
        cell: ({ row }) => (
          <ul className="text-xs">
            {row.original.errors.map((e, i) => (
              <li key={i} className="text-red-700">
                {e.field ? `${humanize(e.field)}: ` : ''}
                {e.message}
              </li>
            ))}
            {row.original.warnings.map((e, i) => (
              <li key={`w${i}`} className="text-amber-700">
                {e.message}
              </li>
            ))}
          </ul>
        ),
      },
    ],
    [],
  );
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const j = data.data;
  const rec = j.reconciliation;
  const fields = templates.data?.data.find((t) => t.key === j.importType)?.fields || [];
  const required = fields.filter((f) => f.required).map((f) => f.name);
  const missing = required.filter((r) => !Object.values(mapping).includes(r));
  const mappingDirty = JSON.stringify(mapping) !== JSON.stringify(j.mapping);
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Import centre', to: '/admin/imports' }, { label: j.sourceFilename }]}
        eyebrow={humanize(j.importType)}
        title={j.sourceFilename}
        meta={
          <>
            <StatusBadge status={j.status} />
            <span className="text-sm text-ink-soft">
              {j.totalRows} rows · SHA-256 {j.sha256?.slice(0, 12)}…
            </span>
          </>
        }
        actions={
          <>
            {['uploaded', 'ready', 'completed_with_errors', 'failed'].includes(j.status) && (
              <Button
                size="sm"
                variant="secondary"
                icon={ListChecks}
                disabled={missing.length > 0 || mappingDirty}
                loading={validate.isPending}
                onClick={() => validate.mutate()}
              >
                Validate (dry run)
              </Button>
            )}
            {['ready', 'completed_with_errors'].includes(j.status) && rec.valid > 0 && (
              <Button size="sm" icon={Play} loading={run.isPending} onClick={() => run.mutate()}>
                Import {rec.valid} valid row(s)
              </Button>
            )}
            {(rec.invalid > 0 || rec.failed > 0) && (
              <Button size="sm" variant="ghost" icon={FileDown} onClick={() => download(`/imports/${id}/rejected.csv`)}>
                Rejected rows
              </Button>
            )}
            {['completed', 'completed_with_errors'].includes(j.status) &&
              !j.approvedById &&
              j.createdById !== user.id && (
                <Button size="sm" icon={CheckCircle2} onClick={() => setSignoff(true)}>
                  Sign off reconciliation
                </Button>
              )}
          </>
        }
      />
      {j.status === 'running' && (
        <Alert tone="info" className="mb-4">
          Importing in batches… this page updates automatically.
        </Alert>
      )}
      {j.lastError && (
        <Alert tone="danger" className="mb-4">
          {j.lastError}
        </Alert>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-6">
        {[
          ['Total', rec.totalRows],
          ['Valid (pending)', rec.valid],
          ['Invalid', rec.invalid],
          ['Imported', rec.imported],
          ['Skipped (already imported)', rec.skipped],
          ['Failed', rec.failed],
        ].map(([l, v]) => (
          <Card key={l} className="p-3">
            <p className="text-[11px] font-semibold text-ink-soft">{l}</p>
            <p className="text-xl font-extrabold tabular-nums">{v}</p>
          </Card>
        ))}
      </div>
      {['completed', 'completed_with_errors'].includes(j.status) && (
        <Alert tone={rec.balanced ? 'success' : 'danger'} className="mb-4">
          {rec.balanced
            ? 'Reconciled: every source row is accounted for.'
            : 'Row counts do not reconcile. Investigate before sign-off.'}
          {j.approvedBy && ` Signed off by ${j.approvedBy.fullName} on ${fmtDateTime(j.approvedAt)}.`}
        </Alert>
      )}
      <Tabs
        className="mb-4"
        value={p.tab}
        onChange={(tab) => set({ tab })}
        tabs={[
          { value: 'mapping', label: 'Column mapping' },
          { value: 'rows', label: 'Row results' },
          { value: 'history', label: 'History' },
        ]}
      />
      {p.tab === 'mapping' && (
        <Card>
          <CardHeader
            title="Map source columns to fields"
            description="Suggested automatically; adjust as needed. Unmapped columns are ignored."
            actions={
              <Button
                size="sm"
                icon={Save}
                disabled={!mappingDirty}
                loading={saveMapping.isPending}
                onClick={() => saveMapping.mutate()}
              >
                Save mapping
              </Button>
            }
          />
          {missing.length > 0 && (
            <Alert tone="warning" className="mx-5 mt-4">
              Map the required fields: {missing.map((m) => fields.find((f) => f.name === m)?.label).join(', ')}
            </Alert>
          )}
          <CardBody>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-ink-soft">
                <tr>
                  <th className="py-2 text-left">Source column</th>
                  <th className="py-2 text-left">Maps to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {j.headers.map((h) => (
                  <tr key={h}>
                    <td className="py-2 pr-4 font-mono text-xs">{h}</td>
                    <td className="py-2">
                      <Select
                        aria-label={`Field for ${h}`}
                        value={mapping[h] || ''}
                        onChange={(e) => setMapping({ ...mapping, [h]: e.target.value || null })}
                        className="h-9 max-w-sm"
                        placeholder="Ignore this column"
                      >
                        {fields.map((f) => (
                          <option
                            key={f.name}
                            value={f.name}
                            disabled={Object.entries(mapping).some(([c, v]) => v === f.name && c !== h)}
                          >
                            {f.label}
                            {f.required ? ' *' : ''}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
      {p.tab === 'rows' && (
        <DataTable
          id="import-rows"
          columns={rowCols}
          data={rows.data?.data}
          total={rows.data?.meta.total}
          page={p.page}
          pageSize={p.pageSize}
          onChange={(x) => set(x, { resetPage: !('page' in x) })}
          loading={rows.isLoading}
          toolbar={
            <select
              aria-label="Row status"
              value={p.rowStatus}
              onChange={(e) => set({ rowStatus: e.target.value })}
              className="h-9 rounded-lg border border-line px-2 text-sm"
            >
              <option value="invalid,failed">Problems</option>
              <option value="valid">Valid (pending)</option>
              <option value="imported">Imported</option>
              <option value="skipped">Skipped</option>
              <option value="">All</option>
            </select>
          }
        />
      )}
      {p.tab === 'history' && (
        <Card>
          <CardBody>
            <Timeline items={j.history} />
          </CardBody>
        </Card>
      )}
      <ConfirmDialog
        open={signoff}
        onClose={() => setSignoff(false)}
        title="Sign off this import"
        description="Confirm that attempted, imported, skipped and failed rows reconcile with the source file."
        requireReason="optional"
        loading={approve.isPending}
        onConfirm={({ reason }) => approve.mutate({ reason })}
      />
    </div>
  );
}
