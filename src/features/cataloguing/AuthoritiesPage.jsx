/**
 * List of authority records and the dialog for creating one.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { SearchInput, FilterSelect } from '../../components/search/SearchInput.jsx';
import {
  Button,
  StatusBadge,
  Badge,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  Alert,
} from '../../components/ui/index.js';
import { humanize } from '../../utils/format.js';

export const ENTITY_TYPES = ['person', 'family', 'corporate_body', 'university_unit', 'place', 'subject', 'function'];

/**
 * Lists authority records (persons, families, corporate bodies, University units, places and functions), filterable
 * by type and searchable. While a new record is being typed, possible duplicates are shown so the archivist can
 * reuse an existing record instead.
 *
 * @returns {JSX.Element}
 */
export default function AuthoritiesPage() {
  const navigate = useNavigate();
  const { can } = useCan();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ entityType: 'person', authorizedName: '', datesOfExistence: '', history: '' });
  const dn = useDebounce(f.authorizedName, 400);
  const dupes = useQuery({
    queryKey: ['authority-dupes', dn, f.entityType],
    queryFn: () =>
      api
        .get('/authority-records/duplicates', { params: { name: dn, entityType: f.entityType } })
        .then((r) => r.data.data),
    enabled: open && dn.length > 2,
  });
  const [p, set] = useQueryParams({ pageSize: 25, sort: 'authorizedName', order: 'asc' });
  const { data, isLoading, error, refetch } = useApi('authorities', '/authority-records', {
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    order: p.order,
    q: p.q,
    entityType: p.entityType,
  });
  const create = useApiMutation((b) => post('/authority-records', b), {
    success: 'Authority record created',
    invalidate: ['authorities'],
    onSuccess: (r) => navigate(`/admin/authorities/${r.data.id}`),
  });
  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Authorised name',
        sortKey: 'authorizedName',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.authorizedName}</p>
            {row.original.otherNames?.length > 0 && (
              <p className="text-xs text-ink-soft">Also: {row.original.otherNames.slice(0, 3).join('; ')}</p>
            )}
          </div>
        ),
      },
      { id: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.entityType) },
      { id: 'dates', header: 'Dates', cell: ({ row }) => row.original.datesOfExistence },
      {
        id: 'verification',
        header: 'Verification',
        cell: ({ row }) => (
          <Badge tone={row.original.verificationStatus === 'verified' ? 'green' : 'neutral'}>
            {humanize(row.original.verificationStatus)}
          </Badge>
        ),
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Authority records"
        description="Persons, families, corporate bodies, University units, places and functions, reused across descriptions (ISAAR-CPF informed)."
        actions={
          can('authority.manage') && (
            <Button icon={Plus} onClick={() => setOpen(true)}>
              New authority
            </Button>
          )
        }
      />
      <DataTable
        id="authorities"
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
        onRowClick={(r) => navigate(`/admin/authorities/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} placeholder="Name or identifier" />
            <FilterSelect
              label="Type"
              value={p.entityType}
              onChange={(v) => set({ entityType: v })}
              options={ENTITY_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
            />
          </>
        }
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New authority record"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!f.authorizedName.trim()}
              onClick={() => create.mutate(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')))}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entity type">
            <Select value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })}>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dates of existence">
            <Input value={f.datesOfExistence} onChange={(e) => setF({ ...f, datesOfExistence: e.target.value })} />
          </Field>
          <Field label="Authorised form of name" required className="sm:col-span-2">
            <Input value={f.authorizedName} onChange={(e) => setF({ ...f, authorizedName: e.target.value })} />
          </Field>
          {dupes.data?.length > 0 && (
            <Alert
              tone="warning"
              icon={AlertTriangle}
              className="sm:col-span-2"
              title="Possible duplicates — check before creating"
            >
              <ul className="mt-1 space-y-0.5">
                {dupes.data.map((d) => (
                  <li key={d.id}>
                    <a className="underline" href={`/admin/authorities/${d.id}`} target="_blank" rel="noreferrer">
                      {d.authorizedName}
                    </a>{' '}
                    {d.datesOfExistence && `(${d.datesOfExistence})`} — {Math.round(d.score * 100)}% match
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">Records are never merged automatically.</p>
            </Alert>
          )}
          <Field label="History" className="sm:col-span-2">
            <Textarea rows={4} value={f.history} onChange={(e) => setF({ ...f, history: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
