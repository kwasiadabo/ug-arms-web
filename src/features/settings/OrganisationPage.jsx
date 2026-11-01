/**
 * Organisation structure management.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useApi, useApiMutation, post, patch } from '../../lib/query.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Checkbox,
  PageLoader,
  ErrorState,
  Badge,
} from '../../components/ui/index.js';
import { humanize } from '../../utils/format.js';

const TYPES = [
  'university',
  'college',
  'faculty',
  'school',
  'department',
  'institute',
  'centre',
  'administrative_unit',
  'external_donor',
  'external_organisation',
];

// A unit's identifier and code are fixed once created; only its other details are sent when saving.

/**
 * Returns the fields of a unit that may be changed, leaving out its identifier and code.
 *
 * @param {object} unit The unit as edited.
 * @returns {object}
 */
const editableFields = ({ id: _id, code: _code, ...rest }) => rest;

/**
 * Shows the colleges, faculties, departments, institutes, administrative units and external donors as an indented
 * hierarchy, and lets authorised users add and edit units. Units are deactivated rather than deleted so historical
 * references keep their meaning. The seeded structure is illustrative and must be replaced with the official
 * hierarchy.
 *
 * @returns {JSX.Element}
 */
export default function OrganisationPage() {
  const { data, isLoading, error, refetch } = useApi(['org-units', 'all'], '/organisation-units', {
    includeInactive: 'true',
  });
  const [edit, setEdit] = useState(null);
  const save = useApiMutation(
    (u) => (u.id ? patch(`/organisation-units/${u.id}`, editableFields(u)) : post('/organisation-units', u)),
    { success: 'Saved', invalidate: ['org-units'], onSuccess: () => setEdit(null) },
  );
  const tree = useMemo(() => {
    const units = data?.data || [];
    const kids = new Map();
    units.forEach((u) => kids.set(u.parentId, [...(kids.get(u.parentId) || []), u]));
    const out = [];

    /**
     * Adds a unit and then, recursively, its children to the ordered list with their depth.
     *
     * @param {object} u The unit.
     * @param {number} d Depth in the hierarchy.
     */
    const walk = (u, d) => {
      out.push({ ...u, depth: d });
      (kids.get(u.id) || []).forEach((c) => walk(c, d + 1));
    };
    (kids.get(null) || []).forEach((u) => walk(u, 0));
    return out;
  }, [data]);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader
        title="Organisational structure"
        description="Colleges, faculties, departments, institutes, centres, administrative units and external donors. The seeded structure is illustrative; configure the official hierarchy here."
        actions={
          <Button
            icon={Plus}
            onClick={() =>
              setEdit({ code: '', name: '', unitType: 'department', parentId: '', contactEmail: '', isActive: true })
            }
          >
            New unit
          </Button>
        }
      />
      <Card as="ul" className="divide-y divide-line">
        {tree.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-3 py-2.5 pr-4 text-sm"
            style={{ paddingLeft: u.depth * 22 + 16 }}
          >
            <span>
              <span className="font-mono text-xs text-gold-700">{u.code}</span>{' '}
              <span className="font-semibold">{u.name}</span>{' '}
              <span className="text-xs text-ink-soft">{humanize(u.unitType)}</span>
              {!u.isActive && <Badge className="ml-2">Inactive</Badge>}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Edit ${u.name}`}
              onClick={() => setEdit({ ...u, parentId: u.parentId || '', contactEmail: u.contactEmail || '' })}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </Card>
      <Dialog
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit unit' : 'New unit'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              onClick={() =>
                save.mutate({
                  id: edit.id,
                  code: edit.code,
                  name: edit.name,
                  unitType: edit.unitType,
                  parentId: edit.parentId || null,
                  contactEmail: edit.contactEmail || null,
                  isActive: edit.isActive,
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" required>
              <Input
                value={edit.code}
                disabled={Boolean(edit.id)}
                onChange={(e) => setEdit({ ...edit, code: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <Select value={edit.unitType} onChange={(e) => setEdit({ ...edit, unitType: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name" required className="sm:col-span-2">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Parent" className="sm:col-span-2">
              <Select
                value={edit.parentId}
                onChange={(e) => setEdit({ ...edit, parentId: e.target.value })}
                placeholder="None (top level)"
              >
                {tree
                  .filter((u) => u.id !== edit.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {'— '.repeat(u.depth)}
                      {u.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Contact email">
              <Input
                type="email"
                value={edit.contactEmail}
                onChange={(e) => setEdit({ ...edit, contactEmail: e.target.value })}
              />
            </Field>
            <Checkbox
              label="Active"
              description="Inactive units keep their historical references"
              checked={edit.isActive}
              onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
