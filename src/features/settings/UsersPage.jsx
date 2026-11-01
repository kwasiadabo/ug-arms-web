/**
 * User administration list, account creation and bulk provisioning.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { SearchInput, FilterSelect } from '../../components/search/SearchInput.jsx';
import {
  Button,
  StatusBadge,
  Dialog,
  Field,
  Input,
  Select,
  Checkbox,
  Alert,
  Badge,
} from '../../components/ui/index.js';
import { relative, humanize } from '../../utils/format.js';

/**
 * Checklist of roles for an account, with each role's description and a mark on sensitive roles.
 *
 * @param {object} props
 * @param {object[]} props.roles Available roles.
 * @param {string[]} props.value Selected role IDs.
 * @param {(ids: string[]) => void} props.onChange Called with the new selection.
 * @returns {JSX.Element}
 */
export function RoleChecklist({ roles, value, onChange }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {roles.map((r) => (
        <Checkbox
          key={r.id}
          label={
            <>
              {r.name}
              {r.isSensitive && (
                <Badge tone="amber" className="ml-1">
                  Sensitive
                </Badge>
              )}
            </>
          }
          description={r.description}
          checked={value.includes(r.id)}
          onChange={(e) => onChange(e.target.checked ? [...value, r.id] : value.filter((x) => x !== r.id))}
        />
      ))}
    </div>
  );
}

/**
 * Dialog for creating several accounts from a CSV file (email, full name, role codes, unit code and user type). A
 * dry run validates the file first; each new user then receives an activation email.
 *
 * @param {object} props
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @returns {JSX.Element}
 */
function ImportDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const run = useApiMutation(
    ({ dryRun }) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/users/import?dryRun=${dryRun}`, fd).then((r) => r.data);
    },
    { invalidate: ['users'], onSuccess: (r) => setResult(r.data) },
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Bulk provision accounts"
      description="CSV columns: email, fullName, roleCodes (separated by ;), unitCode, userType. Each new user receives an activation email."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="secondary"
            disabled={!file}
            loading={run.isPending}
            onClick={() => run.mutate({ dryRun: true })}
          >
            Validate
          </Button>
          <Button
            disabled={!file || !result?.dryRun || result.results.some((r) => r.status === 'invalid')}
            loading={run.isPending}
            onClick={() => run.mutate({ dryRun: false })}
          >
            Create accounts
          </Button>
        </>
      }
    >
      <label className="block cursor-pointer rounded-lg border-2 border-dashed border-line px-4 py-3 text-sm text-ink-soft">
        <input
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={(e) => {
            setFile(e.target.files[0]);
            setResult(null);
          }}
        />
        <Upload className="mr-2 inline h-4 w-4" />
        {file?.name || 'Choose a CSV file'}
      </label>
      {result && (
        <div className="mt-4 max-h-72 overflow-y-auto">
          <Alert
            tone={result.results.some((r) => ['invalid', 'failed'].includes(r.status)) ? 'warning' : 'success'}
            className="mb-2"
          >
            {result.dryRun ? 'Validation' : 'Import'}: {result.total} row(s)
          </Alert>
          <ul className="divide-y divide-line text-sm">
            {result.results.map((r) => (
              <li key={r.row} className="flex justify-between gap-2 py-1.5">
                <span>
                  Row {r.row}: {r.email}
                  {r.errors.length > 0 && <span className="block text-xs text-red-700">{r.errors.join('; ')}</span>}
                </span>
                <StatusBadge status={r.status === 'created' ? 'succeeded' : r.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}

/**
 * Lists accounts with their roles, unit, type, status and last sign-in, filterable by status and role.
 * Administrators can create an account (the person receives an activation email and sets their own password) or
 * provision accounts in bulk. Deactivated users keep their history so past actions stay attributed.
 *
 * @returns {JSX.Element}
 */
export default function UsersPage() {
  const navigate = useNavigate();
  const [p, set] = useQueryParams({ pageSize: 25, sort: 'fullName', order: 'asc' });
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [f, setF] = useState({
    email: '',
    fullName: '',
    userType: 'staff',
    organisationUnitId: '',
    roleIds: [],
    sendInvitation: true,
  });
  const { data, isLoading, error, refetch } = useApi('users', '/users', {
    page: p.page,
    pageSize: p.pageSize,
    sort: p.sort,
    order: p.order,
    q: p.q,
    status: p.status,
    roleId: p.roleId,
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then((r) => r.data.data) });
  const units = useQuery({
    queryKey: ['org-units'],
    queryFn: () => api.get('/organisation-units').then((r) => r.data.data),
  });
  const create = useApiMutation((b) => post('/users', b), {
    success: 'Account created; activation email sent',
    invalidate: ['users'],
    onSuccess: (r) => navigate(`/admin/users/${r.data.id}`),
  });
  const columns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        sortKey: 'fullName',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.fullName}</p>
            <p className="text-xs text-ink-soft">{row.original.email}</p>
          </div>
        ),
      },
      {
        id: 'roles',
        header: 'Roles',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((r) => (
              <Badge key={r.id}>{r.name}</Badge>
            ))}
          </div>
        ),
      },
      { id: 'unit', header: 'Unit', cell: ({ row }) => row.original.organisationUnit?.name || '—' },
      { id: 'type', header: 'Type', cell: ({ row }) => humanize(row.original.userType) },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'login',
        header: 'Last sign-in',
        sortKey: 'lastLoginAt',
        cell: ({ row }) => relative(row.original.lastLoginAt),
      },
    ],
    [],
  );
  return (
    <div>
      <PageHeader
        title="Users"
        description="Least-privilege accounts. Deactivated users keep their history for audit attribution."
        actions={
          <>
            <Button variant="secondary" icon={Upload} onClick={() => setImportOpen(true)}>
              Bulk import
            </Button>
            <Button icon={Plus} onClick={() => setOpen(true)}>
              New user
            </Button>
          </>
        }
      />
      <DataTable
        id="users"
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
        onRowClick={(r) => navigate(`/admin/users/${r.id}`)}
        toolbar={
          <>
            <SearchInput value={p.q} onChange={(q) => set({ q })} placeholder="Name or email" />
            <FilterSelect
              label="Status"
              value={p.status}
              onChange={(v) => set({ status: v })}
              options={['pending', 'active', 'suspended', 'deactivated'].map((s) => ({ value: s, label: humanize(s) }))}
            />
            <FilterSelect
              label="Role"
              value={p.roleId}
              onChange={(v) => set({ roleId: v })}
              options={(roles.data || []).map((r) => ({ value: r.id, label: r.name }))}
            />
          </>
        }
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="New user account"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!f.email || !f.fullName}
              onClick={() => create.mutate({ ...f, organisationUnitId: f.organisationUnitId || null })}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Organisational unit">
            <Select
              value={f.organisationUnitId}
              onChange={(e) => setF({ ...f, organisationUnitId: e.target.value })}
              placeholder="None"
            >
              {(units.data || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account type">
            <Select value={f.userType} onChange={(e) => setF({ ...f, userType: e.target.value })}>
              <option value="staff">Staff</option>
              <option value="researcher">Researcher</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-2 text-[13px] font-semibold">Roles</p>
            <RoleChecklist roles={roles.data || []} value={f.roleIds} onChange={(roleIds) => setF({ ...f, roleIds })} />
          </div>
          <Checkbox
            className="sm:col-span-2"
            label="Send activation email"
            checked={f.sendInvitation}
            onChange={(e) => setF({ ...f, sendInvitation: e.target.checked })}
          />
        </div>
      </Dialog>
      {importOpen && <ImportDialog open onClose={() => setImportOpen(false)} />}
    </div>
  );
}
