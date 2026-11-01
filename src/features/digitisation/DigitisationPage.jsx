/**
 * Digitisation overview: projects and batches.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { SearchInput } from '../../components/search/SearchInput.jsx';
import { Button, StatusBadge, Tabs, Dialog, Field, Input, Textarea, Select, Badge } from '../../components/ui/index.js';
import { RecordPicker } from '../archival-records/Pickers.jsx';
import { fmtDate, humanize } from '../../utils/format.js';

/**
 * Compact progress bar with its percentage, announced to screen readers.
 *
 * @param {object} props
 * @param {number} props.value Percentage complete, 0 to 100.
 * @returns {JSX.Element}
 */
export function Progress({ value }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${value}% complete`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-ink-soft">{value}%</span>
    </div>
  );
}

/**
 * Lists digitisation batches (with project, operator, item count, progress and status) and projects in tabs. Users
 * who manage digitisation can propose a project with a quality profile; an approver must authorise it before
 * batches can be created.
 *
 * @returns {JSX.Element}
 */
export default function DigitisationPage() {
  const navigate = useNavigate();
  const { can } = useCan();
  const [p, set] = useQueryParams({ pageSize: 25, tab: 'batches' });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    title: '',
    description: '',
    priority: 'normal',
    targetDate: '',
    qualityProfileId: '',
    sourceRecordId: '',
    sourceLabel: '',
  });
  const profiles = useQuery({
    queryKey: ['quality-profiles'],
    queryFn: () => api.get('/digitisation/quality-profiles').then((r) => r.data.data),
    enabled: open,
  });
  const projects = useApi(
    'digitisation-projects',
    '/digitisation/projects',
    { page: p.page, pageSize: p.pageSize, q: p.q },
    { enabled: p.tab === 'projects' },
  );
  const batches = useApi(
    'digitisation-batches',
    '/digitisation/batches',
    { page: p.page, pageSize: p.pageSize, status: p.status, mine: p.mine },
    { enabled: p.tab === 'batches' },
  );
  const create = useApiMutation((b) => post('/digitisation/projects', b), {
    success: 'Project proposed',
    invalidate: ['digitisation-projects'],
    onSuccess: (r) => navigate(`/admin/digitisation/projects/${r.data.id}`),
  });
  const projectCols = useMemo(
    () => [
      {
        id: 'code',
        header: 'Code',
        cell: ({ row }) => <span className="font-mono text-xs text-gold-700">{row.original.code}</span>,
      },
      {
        id: 'title',
        header: 'Project',
        cell: ({ row }) => <span className="font-semibold">{row.original.title}</span>,
      },
      { id: 'source', header: 'Source', cell: ({ row }) => row.original.sourceRecord?.referenceCode },
      {
        id: 'priority',
        header: 'Priority',
        cell: ({ row }) => (
          <Badge
            tone={row.original.priority === 'urgent' ? 'red' : row.original.priority === 'high' ? 'amber' : 'neutral'}
          >
            {humanize(row.original.priority)}
          </Badge>
        ),
      },
      { id: 'batches', header: 'Batches', cell: ({ row }) => row.original.batches.length },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'target', header: 'Target', cell: ({ row }) => fmtDate(row.original.targetDate) },
    ],
    [],
  );
  const batchCols = useMemo(
    () => [
      {
        id: 'no',
        header: 'Batch',
        cell: ({ row }) => <span className="font-mono text-xs text-gold-700">{row.original.batchNumber}</span>,
      },
      { id: 'project', header: 'Project', cell: ({ row }) => row.original.project?.title },
      { id: 'operator', header: 'Operator', cell: ({ row }) => row.original.operator?.fullName || '—' },
      {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => `${row.original.progress.captured}/${row.original.progress.items}`,
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: ({ row }) => <Progress value={row.original.progress.percentComplete} />,
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Digitisation"
        description="Projects authorise selection of material; batches track capture, processing, quality assurance and rework."
        actions={
          can('digitisation.manage') && (
            <Button icon={Plus} onClick={() => setOpen(true)}>
              Propose project
            </Button>
          )
        }
      />
      <Tabs
        className="mb-4"
        value={p.tab}
        onChange={(tab) => set({ tab })}
        tabs={[
          { value: 'batches', label: 'Batches' },
          { value: 'projects', label: 'Projects' },
        ]}
      />
      {p.tab === 'projects' ? (
        <DataTable
          id="dig-projects"
          columns={projectCols}
          data={projects.data?.data}
          total={projects.data?.meta.total}
          page={p.page}
          pageSize={p.pageSize}
          onChange={(x) => set(x, { resetPage: !('page' in x) })}
          loading={projects.isLoading}
          error={projects.error}
          onRowClick={(r) => navigate(`/admin/digitisation/projects/${r.id}`)}
          toolbar={<SearchInput value={p.q} onChange={(q) => set({ q })} />}
        />
      ) : (
        <DataTable
          id="dig-batches"
          columns={batchCols}
          data={batches.data?.data}
          total={batches.data?.meta.total}
          page={p.page}
          pageSize={p.pageSize}
          onChange={(x) => set(x, { resetPage: !('page' in x) })}
          loading={batches.isLoading}
          error={batches.error}
          onRowClick={(r) => navigate(`/admin/digitisation/batches/${r.id}`)}
          toolbar={
            <>
              <select
                aria-label="Status"
                value={p.status || ''}
                onChange={(e) => set({ status: e.target.value })}
                className="h-9 rounded-lg border border-line px-2 text-sm"
              >
                <option value="">All statuses</option>
                {[
                  'planned',
                  'in_progress',
                  'processing',
                  'quality_review',
                  'rework_required',
                  'approved',
                  'completed',
                  'failed',
                ].map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-brand-700"
                  checked={p.mine === 'true'}
                  onChange={(e) => set({ mine: e.target.checked ? 'true' : '' })}
                />{' '}
                Assigned to me
              </label>
            </>
          }
        />
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Propose a digitisation project"
        description="An approver must authorise the project before batches can be created."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={f.title.length < 3}
              loading={create.isPending}
              onClick={() =>
                create.mutate({
                  title: f.title,
                  description: f.description || undefined,
                  priority: f.priority,
                  targetDate: f.targetDate || undefined,
                  qualityProfileId: f.qualityProfileId || undefined,
                  sourceRecordId: f.sourceRecordId || undefined,
                })
              }
            >
              Propose
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1 text-[13px] font-semibold">
              Source collection {f.sourceLabel && <span className="font-normal">— {f.sourceLabel}</span>}
            </p>
            <RecordPicker onPick={(r) => setF({ ...f, sourceRecordId: r.id, sourceLabel: `${r.sub} ${r.label}` })} />
          </div>
          <Field label="Quality profile">
            <Select
              value={f.qualityProfileId}
              onChange={(e) => setF({ ...f, qualityProfileId: e.target.value })}
              placeholder="Choose"
            >
              {(profiles.data || []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} ({q.minResolutionDpi} dpi)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              {['low', 'normal', 'high', 'urgent'].map((x) => (
                <option key={x} value={x}>
                  {humanize(x)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target date">
            <Input type="date" value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} />
          </Field>
          <Field label="Description and selection criteria" className="sm:col-span-2">
            <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
