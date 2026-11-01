/**
 * Roles and permission matrix.
 *
 * @author Kwasi Adabo Boakye
 */

import { useMemo, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { useApi, useApiMutation, post, patch } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  Button,
  Badge,
  PageLoader,
  ErrorState,
  Dialog,
  Field,
  Input,
  Textarea,
  Alert,
} from '../../components/ui/index.js';
import { humanize } from '../../utils/format.js';

/**
 * Shows every role against every permission. Users who manage roles can change a role's permissions and save them,
 * or create a new role. Every permission is enforced by the server, and changes to sensitive roles are flagged in
 * the audit trail.
 *
 * @returns {JSX.Element}
 */
export default function RolesPage() {
  const { can } = useCan();
  const roles = useApi('roles', '/roles');
  const perms = useApi('permissions', '/roles/permissions');
  const [draft, setDraft] = useState({});
  const [newRole, setNewRole] = useState(null);
  const save = useApiMutation(({ id, permissionIds }) => patch(`/roles/${id}`, { permissionIds }), {
    success: 'Role permissions saved',
    invalidate: ['roles'],
    onSuccess: (_, v) =>
      setDraft((d) => {
        const n = { ...d };
        delete n[v.id];
        return n;
      }),
  });
  const create = useApiMutation((b) => post('/roles', b), {
    success: 'Role created',
    invalidate: ['roles'],
    onSuccess: () => setNewRole(null),
  });
  const grouped = useMemo(() => {
    const m = new Map();
    for (const p of perms.data?.data || []) m.set(p.groupName, [...(m.get(p.groupName) || []), p]);
    return [...m.entries()];
  }, [perms.data]);
  if (roles.isLoading || perms.isLoading) return <PageLoader />;
  if (roles.error) return <ErrorState error={roles.error} />;
  const list = roles.data.data;

  /**
   * Tells whether a role currently has a permission in the matrix, including unsaved changes.
   *
   * @param {object} r The role.
   * @param {string} pid Permission ID.
   * @returns {boolean}
   */
  const has = (r, pid) => (draft[r.id] ?? r.permissions.map((x) => x.id)).includes(pid);

  /**
   * Adds or removes a permission from a role's unsaved changes.
   *
   * @param {object} r The role.
   * @param {string} pid Permission ID.
   */
  const toggle = (r, pid) => {
    const cur = draft[r.id] ?? r.permissions.map((x) => x.id);
    setDraft({ ...draft, [r.id]: cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid] });
  };
  const editable = can('roles.manage');
  return (
    <div>
      <PageHeader
        title="Roles and permissions"
        description="Every permission is enforced by the server. Changes to sensitive roles are flagged in the audit trail."
        actions={
          editable && (
            <Button icon={Plus} onClick={() => setNewRole({ code: '', name: '', description: '' })}>
              New role
            </Button>
          )
        }
      />
      {!editable && (
        <Alert tone="info" className="mb-4">
          You can view the matrix. Changing it requires the roles.manage permission.
        </Alert>
      )}
      <Card className="overflow-hidden">
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs uppercase text-ink-soft">
                  Permission
                </th>
                {list.map((r) => (
                  <th key={r.id} className="min-w-[110px] px-2 py-3 text-center align-bottom">
                    <span className="block text-xs font-bold leading-tight">{r.name}</span>
                    <span className="block text-[11px] font-normal text-ink-soft">
                      {r.memberCount} member{r.memberCount === 1 ? '' : 's'}
                    </span>
                    {r.isSensitive && (
                      <Badge tone="amber" className="mt-1">
                        Sensitive
                      </Badge>
                    )}
                    {draft[r.id] && (
                      <Button
                        size="sm"
                        className="mt-1"
                        icon={Save}
                        loading={save.isPending}
                        onClick={() => save.mutate({ id: r.id, permissionIds: draft[r.id] })}
                      >
                        Save
                      </Button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(([g, ps]) => [
                <tr key={g} className="bg-canvas">
                  <td
                    colSpan={list.length + 1}
                    className="sticky left-0 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-800"
                  >
                    {humanize(g)}
                  </td>
                </tr>,
                ...ps.map((p) => (
                  <tr key={p.id} className="border-b border-line">
                    <td className="sticky left-0 bg-white px-4 py-1.5 font-mono text-xs">{p.code}</td>
                    {list.map((r) => (
                      <td key={r.id} className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`${r.name}: ${p.code}`}
                          className="accent-brand-700"
                          disabled={!editable}
                          checked={has(r, p.id)}
                          onChange={() => toggle(r, p.id)}
                        />
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </Card>
      <Dialog
        open={Boolean(newRole)}
        onClose={() => setNewRole(null)}
        title="New role"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewRole(null)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              onClick={() => create.mutate({ ...newRole, description: newRole.description || undefined })}
            >
              Create
            </Button>
          </>
        }
      >
        {newRole && (
          <div className="space-y-4">
            <Field label="Code" help="lowercase_with_underscores">
              <Input value={newRole.code} onChange={(e) => setNewRole({ ...newRole, code: e.target.value })} />
            </Field>
            <Field label="Name">
              <Input value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
