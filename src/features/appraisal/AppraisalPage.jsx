/**
 * Appraisal cases list and the dialog for opening a case.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { FilterSelect } from '../../components/search/SearchInput.jsx';
import { Button, StatusBadge, Badge, Dialog, Field, Input, Select } from '../../components/ui/index.js';
import { RecordPicker } from '../archival-records/Pickers.jsx';
import { fmtDate, humanize } from '../../utils/format.js';

const STATUSES = [
  'open',
  'under_review',
  'on_hold',
  'recommended',
  'awaiting_approval',
  'approved',
  'rejected',
  'executed',
  'closed',
];

/**
 * Lists appraisal cases filterable by status. Authorised users can open a case for selected descriptions,
 * optionally under an approved retention schedule.
 *
 * @returns {JSX.Element}
 */
export default function AppraisalPage() {
  const navigate = useNavigate();
  const { can } = useCan();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', scheduleId: '', items: [] });
  const [p, set] = useQueryParams({ pageSize: 25 });
  const { data, isLoading, error, refetch } = useApi('appraisal-cases', '/appraisal/cases', {
    page: p.page,
    pageSize: p.pageSize,
    status: p.status,
  });
  const schedules = useQuery({
    queryKey: ['retention-schedules'],
    queryFn: () => api.get('/retention/schedules').then((r) => r.data.data),
    enabled: open,
  });
  const create = useApiMutation((b) => post('/appraisal/cases', b), {
    success: 'Appraisal case opened',
    invalidate: ['appraisal-cases'],
    onSuccess: (r) => navigate(`/admin/appraisal/${r.data.id}`),
  });
  const columns = useMemo(
    () => [
      {
        id: 'no',
        header: 'Case',
        cell: ({ row }) => <span className="font-mono text-xs text-gold-700">{row.original.caseNumber}</span>,
      },
      { id: 'title', header: 'Title', cell: ({ row }) => <span className="font-semibold">{row.original.title}</span> },
      { id: 'schedule', header: 'Schedule', cell: ({ row }) => row.original.schedule?.code || '—' },
      {
        id: 'items',
        header: 'Items',
        cell: ({ row }) => {
          const it = row.original.items;
          const blocked = it.filter((i) => i.eligibility.startsWith('blocked')).length;
          return (
            <span>
              {it.length}
              {blocked > 0 && (
                <Badge tone="red" className="ml-2">
                  {blocked} blocked
                </Badge>
              )}
            </span>
          );
        },
      },
      { id: 'rec', header: 'Recommendation', cell: ({ row }) => humanize(row.original.recommendation) },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: 'opened', header: 'Opened', cell: ({ row }) => fmtDate(row.original.createdAt) },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Appraisal cases"
        description="Review of records for retention, transfer or disposal. Legal holds, permanent holdings and active requests block disposal automatically."
        actions={
          can('appraisal.create') && (
            <Button icon={Plus} onClick={() => setOpen(true)}>
              Open case
            </Button>
          )
        }
      />
      <DataTable
        id="appraisal"
        columns={columns}
        data={data?.data}
        total={data?.meta.total}
        page={p.page}
        pageSize={p.pageSize}
        onChange={(x) => set(x, { resetPage: !('page' in x) })}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/appraisal/${r.id}`)}
        toolbar={
          <FilterSelect
            label="Status"
            value={p.status}
            onChange={(v) => set({ status: v })}
            options={STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
          />
        }
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Open an appraisal case"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!f.title || !f.items.length}
              onClick={() =>
                create.mutate({
                  title: f.title,
                  scheduleId: f.scheduleId || null,
                  items: f.items.map((i) => ({ recordId: i.id })),
                })
              }
            >
              Open case
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Retention schedule" help="Only approved schedules can be used">
            <Select
              value={f.scheduleId}
              onChange={(e) => setF({ ...f, scheduleId: e.target.value })}
              placeholder="None"
            >
              {(schedules.data || [])
                .filter((s) => s.status === 'approved')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.title}
                  </option>
                ))}
            </Select>
          </Field>
          <div>
            <p className="mb-1 text-[13px] font-semibold">Descriptions to appraise</p>
            <RecordPicker
              onPick={(r) => !f.items.find((i) => i.id === r.id) && setF({ ...f, items: [...f.items, r] })}
            />
            <ul className="mt-2 space-y-1">
              {f.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-md bg-canvas px-3 py-1.5 text-sm">
                  <span>
                    {i.sub} {i.label}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setF({ ...f, items: f.items.filter((x) => x.id !== i.id) })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
