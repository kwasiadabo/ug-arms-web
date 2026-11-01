/**
 * Import centre: list of bulk imports and the upload dialog.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { Button, StatusBadge, Dialog, Field, Select } from '../../components/ui/index.js';
import { fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Lists imports with their type, status and row counts, and lets administrators upload a CSV or Excel file of a
 * chosen type. Nothing is written to the catalogue until the import is run.
 *
 * @returns {JSX.Element}
 */
export default function ImportsPage() {
  const navigate = useNavigate();
  const [p, set] = useQueryParams({ pageSize: 25 });
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('archival_records');
  const [file, setFile] = useState(null);
  const { data, isLoading, error, refetch } = useApi('imports', '/imports', { page: p.page, pageSize: p.pageSize });
  const templates = useApi('import-templates', '/imports/templates');
  const upload = useApiMutation(
    () => {
      const fd = new FormData();
      fd.append('importType', type);
      fd.append('file', file);
      return api.post('/imports', fd).then((r) => r.data);
    },
    {
      success: 'File uploaded. Review the column mapping.',
      invalidate: ['imports'],
      onSuccess: (r) => navigate(`/admin/imports/${r.data.id}`),
    },
  );
  const columns = useMemo(
    () => [
      {
        id: 'file',
        header: 'File',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.sourceFilename}</p>
            <p className="text-xs text-ink-soft">{humanize(row.original.importType)}</p>
          </div>
        ),
      },
      { id: 'rows', header: 'Rows', cell: ({ row }) => row.original.totalRows },
      {
        id: 'result',
        header: 'Imported / skipped / failed / invalid',
        cell: ({ row }) =>
          `${row.original.importedRows} / ${row.original.skippedRows} / ${row.original.failedRows} / ${row.original.invalidRows}`,
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'by', header: 'By', cell: ({ row }) => row.original.createdBy?.fullName },
      { id: 'when', header: 'Uploaded', cell: ({ row }) => fmtDateTime(row.original.createdAt) },
    ],
    [],
  );
  const tpl = templates.data?.data.find((t) => t.key === type);
  return (
    <div>
      <PageHeader
        title="Import centre"
        description="Controlled migration of legacy registers and catalogues: map columns, validate, dry-run, import in batches, retry safely, and reconcile."
        actions={
          <Button icon={Upload} onClick={() => setOpen(true)}>
            New import
          </Button>
        }
      />
      <DataTable
        id="imports"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/imports/${r.id}`)}
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="New import"
        description="Upload a CSV or Excel (.xlsx) file. Nothing is written to the catalogue until you run the import."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!file} loading={upload.isPending} onClick={() => upload.mutate()}>
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Template">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {templates.data?.data.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          {tpl && (
            <div className="rounded-lg bg-canvas p-3 text-xs">
              <p className="font-semibold">Fields</p>
              <p className="mt-1">{tpl.fields.map((f) => `${f.label}${f.required ? ' *' : ''}`).join(' · ')}</p>
              <p className="mt-1 text-ink-soft">
                Rows are matched by “{tpl.fields.find((f) => f.name === tpl.keyField)?.label}” so re-running never
                duplicates earlier imports.
              </p>
            </div>
          )}
          <label className="block cursor-pointer rounded-lg border-2 border-dashed border-line px-4 py-4 text-sm text-ink-soft">
            <input type="file" accept=".csv,.xlsx" className="sr-only" onChange={(e) => setFile(e.target.files[0])} />
            <Upload className="mr-2 inline h-4 w-4" />
            {file?.name || 'Choose a .csv or .xlsx file'}
          </label>
        </div>
      </Dialog>
    </div>
  );
}
