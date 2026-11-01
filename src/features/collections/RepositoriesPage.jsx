/**
 * Management of repositories, the archival institutions or services that hold collections.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useApi, useApiMutation, post, patch } from '../../lib/query.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  Button,
  Dialog,
  Field,
  Input,
  Textarea,
  Select,
  AccessBadge,
  PageLoader,
  ErrorState,
} from '../../components/ui/index.js';
import { humanize } from '../../utils/format.js';

const EMPTY = {
  code: '',
  name: '',
  authorizedFormOfName: '',
  address: '',
  contactEmail: '',
  contactPhone: '',
  openingTimes: '',
  description: '',
  accessConditions: '',
  accessLevel: 'open',
};

// A repository's code identifies it in reference codes and cannot be changed after creation.

/**
 * Returns the repository fields without the code, which cannot be changed after creation.
 *
 * @param {object} fields Repository fields.
 * @returns {object}
 */
const withoutCode = ({ code: _code, ...rest }) => rest;

/**
 * Lists repositories and lets authorised users create and edit them: name, authorised form of name, address,
 * contacts, opening times, description, access conditions and the base access level. Every description inherits its
 * access from its repository's base level.
 *
 * @returns {JSX.Element}
 */
export default function RepositoriesPage() {
  const { data, isLoading, error, refetch } = useApi('repositories', '/repositories');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const save = useApiMutation(
    (f) => (editing === 'new' ? post('/repositories', f) : patch(`/repositories/${editing}`, withoutCode(f))),
    { success: 'Repository saved', invalidate: ['repositories'], onSuccess: () => setEditing(null) },
  );
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  /**
   * Returns a change handler that stores an input's value in the form state.
   *
   * @param {string} k Form field name.
   * @returns {(e: Event) => void}
   */
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  /**
   * Prepares the form for saving: empty values become null, and an empty code is left out.
   *
   * @param {object} f Form values.
   * @returns {object}
   */
  const toPayload = (f) =>
    Object.fromEntries(
      Object.entries(f)
        .map(([k, v]) => [k, v === '' ? null : v])
        .filter(([k, v]) => !(k === 'code' && !v)),
    );
  return (
    <div>
      <PageHeader
        title="Repositories"
        description="Archival institutions and their access defaults (ISDIAH-informed). The repository's access level is the base of every inherited restriction."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setForm(EMPTY);
              setEditing('new');
            }}
          >
            New repository
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {data.data.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-gold-700">{r.code}</p>
                <h2 className="text-lg font-bold">{r.name}</h2>
                <p className="text-sm text-ink-soft">{r.address}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={Pencil}
                onClick={() => {
                  setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])) });
                  setEditing(r.id);
                }}
              >
                Edit
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <AccessBadge level={r.accessLevel} />
              {!r.isActive && <span className="text-xs text-red-700">Inactive</span>}
            </div>
            {r.description && <p className="mt-3 line-clamp-3 text-sm text-ink-soft">{r.description}</p>}
          </Card>
        ))}
      </div>
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New repository' : 'Edit repository'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate(toPayload(form))}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required>
            <Input value={form.code} onChange={set('code')} disabled={editing !== 'new'} />
          </Field>
          <Field label="Base access level">
            <Select value={form.accessLevel} onChange={set('accessLevel')}>
              {['open', 'staff_only', 'restricted', 'embargoed', 'confidential', 'closed'].map((l) => (
                <option key={l} value={l}>
                  {humanize(l)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={set('name')} />
          </Field>
          <Field label="Authorised form of name" className="sm:col-span-2">
            <Input value={form.authorizedFormOfName} onChange={set('authorizedFormOfName')} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input value={form.address} onChange={set('address')} />
          </Field>
          <Field label="Contact email">
            <Input type="email" value={form.contactEmail} onChange={set('contactEmail')} />
          </Field>
          <Field label="Contact phone">
            <Input value={form.contactPhone} onChange={set('contactPhone')} />
          </Field>
          <Field label="Opening times" className="sm:col-span-2">
            <Input value={form.openingTimes} onChange={set('openingTimes')} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea value={form.description} onChange={set('description')} />
          </Field>
          <Field label="Access conditions" className="sm:col-span-2">
            <Textarea value={form.accessConditions} onChange={set('accessConditions')} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
