/**
 * Transfer submissions list and the "new transfer" dialog. Liaisons see their own unit's transfers; reviewers see
 * all of them.
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
import { Alert, Button, StatusBadge, Dialog, Field, Input, Textarea, Select } from '../../components/ui/index.js';
import { fmtDate, humanize } from '../../utils/format.js';

const STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'query_raised',
  'resubmitted',
  'accepted',
  'partially_accepted',
  'rejected',
  'cancelled',
];

/**
 * Dialog that starts a draft transfer. Liaisons can choose only their own unit, while reviewers may choose any
 * unit; choosing another unit prepares the transfer on that department's behalf, as a Records Officer does when the
 * department has no liaison. The transfer authority (the memo or decision authorising the transfer) and contact
 * details are recorded.
 * After creation the transfer opens so the inventory can be added.
 *
 * @param {object} props
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @returns {JSX.Element}
 */
export function NewTransferDialog({ open, onClose }) {
  const { user, can } = useCan();
  const navigate = useNavigate();
  const units = useQuery({
    queryKey: ['org-units'],
    queryFn: () => api.get('/organisation-units').then((r) => r.data.data),
  });
  const [f, setF] = useState({
    title: '',
    originatingUnitId: user.organisationUnitId || '',
    contactName: user.fullName,
    contactEmail: user.email,
    proposedTransferDate: '',
    transferAuthority: '',
    reason: '',
    totalExtent: '',
  });
  const create = useApiMutation((b) => post('/transfers', b), {
    success: 'Draft transfer created',
    invalidate: ['transfers'],
    onSuccess: (res) => navigate(`/admin/transfers/${res.data.id}`),
  });

  /**
   * Returns a change handler that stores an input's value in the form state.
   *
   * @param {string} k Form field name.
   * @returns {(e: Event) => void}
   */
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  /**
   * Changes the originating unit. Switching to another unit means preparing the transfer on that unit's behalf, so
   * the contact fields, which start as the current user's own details, are cleared for the department's contact;
   * switching back restores them if they are still empty.
   *
   * @param {Event} e Change event of the unit select.
   */
  const setUnit = (e) => {
    const unitId = e.target.value;
    const own = unitId === user.organisationUnitId;
    const mineOrBlank = (v, mine) => !v || v === mine;
    setF({
      ...f,
      originatingUnitId: unitId,
      contactName: mineOrBlank(f.contactName, user.fullName) ? (own ? user.fullName : '') : f.contactName,
      contactEmail: mineOrBlank(f.contactEmail, user.email) ? (own ? user.email : '') : f.contactEmail,
    });
  };
  const unitOptions = (units.data || []).filter((u) => can('transfer.review') || u.id === user.organisationUnitId);
  const onBehalf = Boolean(f.originatingUnitId) && f.originatingUnitId !== user.organisationUnitId;
  const onBehalfUnit = unitOptions.find((u) => u.id === f.originatingUnitId);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New transfer submission"
      description="Start a draft. You can add the inventory and documents before submitting."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={!f.title || !f.originatingUnitId || !f.contactName}
            onClick={() =>
              create.mutate(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v])))
            }
          >
            Create draft
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Title"
          required
          className="sm:col-span-2"
          help="e.g. Department of History correspondence, 1960–1985"
        >
          <Input value={f.title} onChange={set('title')} />
        </Field>
        {onBehalf && (
          <Alert
            tone="info"
            className="sm:col-span-2"
            title={`Submitting on behalf of ${onBehalfUnit?.name || 'this unit'}`}
          >
            You are acting as the department&apos;s liaison. Enter the department&apos;s contact person and the transfer
            authority they gave you. Another reviewer will decide on this transfer.
          </Alert>
        )}
        <Field label="Originating unit" required>
          <Select value={f.originatingUnitId} onChange={setUnit} placeholder="Select unit">
            {unitOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Proposed transfer date">
          <Input type="date" value={f.proposedTransferDate} onChange={set('proposedTransferDate')} />
        </Field>
        <Field
          label={onBehalf ? 'Department contact person' : 'Contact person'}
          required
          help={onBehalf ? 'The person in the department who can answer questions about these records' : undefined}
        >
          <Input value={f.contactName} onChange={set('contactName')} />
        </Field>
        <Field label="Contact email">
          <Input type="email" value={f.contactEmail} onChange={set('contactEmail')} />
        </Field>
        <Field
          label="Transfer authority"
          className="sm:col-span-2"
          help="Who authorised the transfer (memo, decision, schedule)"
        >
          <Input value={f.transferAuthority} onChange={set('transferAuthority')} />
        </Field>
        <Field label="Estimated extent">
          <Input value={f.totalExtent} onChange={set('totalExtent')} />
        </Field>
        <Field label="Reason for transfer" className="sm:col-span-2">
          <Textarea rows={3} value={f.reason} onChange={set('reason')} />
        </Field>
      </div>
    </Dialog>
  );
}

/**
 * Lists transfers with their originating unit, preparer, status and submission date, filterable by status, with a
 * button to start a new transfer for users who may submit.
 *
 * @returns {JSX.Element}
 */
export default function TransfersPage() {
  const navigate = useNavigate();
  const { can } = useCan();
  const [open, setOpen] = useState(false);
  const [p, set] = useQueryParams({ pageSize: 25, sort: 'createdAt', order: 'desc' });
  const { data, isLoading, error, refetch } = useApi('transfers', '/transfers', {
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    order: p.order,
    q: p.q,
    status: p.status,
  });
  const columns = useMemo(
    () => [
      {
        id: 'ref',
        header: 'Reference',
        sortKey: 'referenceNumber',
        cell: ({ row }) => (
          <span className="font-mono text-[12.5px] text-gold-700">{row.original.referenceNumber || 'Draft'}</span>
        ),
      },
      {
        id: 'title',
        header: 'Title',
        sortKey: 'title',
        cell: ({ row }) => <span className="font-semibold">{row.original.title}</span>,
      },
      { id: 'unit', header: 'Originating unit', cell: ({ row }) => row.original.originatingUnit?.name },
      {
        id: 'by',
        header: 'Prepared by',
        cell: ({ row }) => (
          <span>
            {row.original.submittedBy?.fullName}
            {row.original.submittedOnBehalf && <span className="block text-xs text-ink-soft">on behalf of unit</span>}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'submitted',
        header: 'Submitted',
        sortKey: 'submittedAt',
        cell: ({ row }) => fmtDate(row.original.submittedAt),
      },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Transfer submissions"
        description={
          can('transfer.review')
            ? 'Records offered by departments and units, with their inventories and decisions.'
            : "Your unit's transfers to the Archives."
        }
        actions={
          can('transfer.submit') && (
            <Button icon={Plus} onClick={() => setOpen(true)}>
              New transfer
            </Button>
          )
        }
      />
      <DataTable
        id="transfers"
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
        onRowClick={(r) => navigate(`/admin/transfers/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} />
            <FilterSelect
              label="Status"
              value={p.status}
              onChange={(v) => set({ status: v })}
              options={STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            />
          </>
        }
      />
      {open && <NewTransferDialog open={open} onClose={() => setOpen(false)} />}
    </div>
  );
}
