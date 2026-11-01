/**
 * Accession register and the dialog for registering an accession that does not come from a departmental transfer
 * (for example a donation).
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
import { SearchInput, FilterSelect } from '../../components/search/SearchInput.jsx';
import { Button, StatusBadge, Badge, Dialog, Field, Input, Select } from '../../components/ui/index.js';
import { fmtDate, humanize } from '../../utils/format.js';

const STATUSES = ['draft', 'submitted', 'under_review', 'queried', 'approved', 'rejected', 'closed'];
const SOURCES = ['department', 'donor', 'external_organisation', 'purchase', 'deposit', 'other'];

/**
 * Lists accessions with filters for status and year, and lets authorised users register a new accession, which then
 * opens for completion.
 *
 * @returns {JSX.Element}
 */
export default function AccessionsPage() {
  const navigate = useNavigate();
  const { can } = useCan();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    title: '',
    sourceType: 'donor',
    donorName: '',
    sourceUnitId: '',
    accessionDate: new Date().toISOString().slice(0, 10),
  });
  const [p, set] = useQueryParams({ pageSize: 25, sort: 'createdAt', order: 'desc' });
  const { data, isLoading, error, refetch } = useApi('accessions', '/accessions', {
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    order: p.order,
    q: p.q,
    status: p.status,
    year: p.year,
  });
  const units = useQuery({
    queryKey: ['org-units'],
    queryFn: () => api.get('/organisation-units').then((r) => r.data.data),
    enabled: open,
  });
  const create = useApiMutation((b) => post('/accessions', b), {
    success: (r) => `Accession ${r.data.accessionNumber} registered`,
    invalidate: ['accessions'],
    onSuccess: (r) => navigate(`/admin/accessions/${r.data.id}`),
  });
  const columns = useMemo(
    () => [
      {
        id: 'no',
        header: 'Accession no.',
        sortKey: 'accessionNumber',
        cell: ({ row }) => (
          <span className="font-mono text-[12.5px] text-gold-700">{row.original.accessionNumber}</span>
        ),
      },
      {
        id: 'title',
        header: 'Title',
        sortKey: 'title',
        cell: ({ row }) => <span className="font-semibold">{row.original.title}</span>,
      },
      {
        id: 'source',
        header: 'Source',
        cell: ({ row }) => row.original.sourceUnit?.name || row.original.donorName || humanize(row.original.sourceType),
      },
      {
        id: 'date',
        header: 'Accession date',
        sortKey: 'accessionDate',
        cell: ({ row }) => fmtDate(row.original.accessionDate),
      },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: ({ row }) => (
          <span className="flex gap-1">
            <StatusBadge status={row.original.status} />
            {row.original.isQuarantined && <Badge tone="red">Quarantine</Badge>}
          </span>
        ),
      },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Accession register"
        description="Formal receipt of material into the custody of the Archives."
        actions={
          can('accession.create') && (
            <Button icon={Plus} onClick={() => setOpen(true)}>
              Register accession
            </Button>
          )
        }
      />
      <DataTable
        id="accessions"
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
        onRowClick={(r) => navigate(`/admin/accessions/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} />
            <FilterSelect
              label="Status"
              value={p.status}
              onChange={(v) => set({ status: v })}
              options={STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            />
            <input
              aria-label="Year"
              placeholder="Year"
              inputMode="numeric"
              defaultValue={p.year}
              onBlur={(e) => set({ year: e.target.value })}
              className="h-9 w-20 rounded-lg border border-line px-2 text-sm"
            />
          </>
        }
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Register a proposed accession"
        description="Accessions from departments are usually created from an accepted transfer. Use this for donations and other sources."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={f.title.length < 3}
              onClick={() => create.mutate(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')))}
            >
              Register
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Source type">
            <Select value={f.sourceType} onChange={(e) => setF({ ...f, sourceType: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Accession date">
            <Input
              type="date"
              value={f.accessionDate}
              onChange={(e) => setF({ ...f, accessionDate: e.target.value })}
            />
          </Field>
          {f.sourceType === 'department' ? (
            <Field label="Source unit" className="sm:col-span-2">
              <Select
                value={f.sourceUnitId}
                onChange={(e) => setF({ ...f, sourceUnitId: e.target.value })}
                placeholder="Select"
              >
                {(units.data || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Donor or depositor" className="sm:col-span-2">
              <Input value={f.donorName} onChange={(e) => setF({ ...f, donorName: e.target.value })} />
            </Field>
          )}
        </div>
      </Dialog>
    </div>
  );
}
