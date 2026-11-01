/**
 * User administration detail page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation, post, patch } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  MetaList,
  Button,
  StatusBadge,
  PageLoader,
  ErrorState,
  Alert,
  ConfirmDialog,
  Field,
  Select,
  Input,
} from '../../components/ui/index.js';
import { RoleChecklist } from './UsersPage.jsx';
import { fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Shows an account's profile, roles, status and recent sign-in attempts. Administrators can edit the profile and
 * roles (removing a role signs the user out everywhere), and can activate, suspend, deactivate or unlock the
 * account, resend the invitation or sign out all sessions; status changes require a reason.
 *
 * @returns {JSX.Element}
 */
export default function UserDetailPage() {
  const { id } = useParams();
  const { user: me } = useCan();
  const [action, setAction] = useState(null);
  const [roleIds, setRoleIds] = useState([]);
  const [profile, setProfile] = useState({});
  const { data, isLoading, error, refetch } = useApi(['user', id], `/users/${id}`);
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api.get('/roles').then((r) => r.data.data) });
  const units = useQuery({
    queryKey: ['org-units'],
    queryFn: () => api.get('/organisation-units').then((r) => r.data.data),
  });
  useEffect(() => {
    if (data) {
      setRoleIds(data.data.roles.map((r) => r.id));
      setProfile({
        fullName: data.data.fullName,
        organisationUnitId: data.data.organisationUnitId || '',
        accountExpiresAt: data.data.accountExpiresAt?.slice(0, 10) || '',
      });
    }
  }, [data]);
  const inval = [['user', id], 'users'];
  const save = useApiMutation((b) => patch(`/users/${id}`, b), { success: 'Saved', invalidate: inval });
  const act = useApiMutation(({ path, reason }) => post(`/users/${id}/${path}`, { reason }), {
    success: 'Done',
    invalidate: inval,
    onSuccess: () => setAction(null),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const u = data.data;
  const self = u.id === me.id;
  const changedRoles = JSON.stringify([...roleIds].sort()) !== JSON.stringify(u.roles.map((r) => r.id).sort());
  const actions = [
    u.status === 'pending' && { path: 'resend-invitation', label: 'Resend invitation', variant: 'secondary' },
    u.status !== 'active' && u.status !== 'pending' && { path: 'activate', label: 'Reactivate' },
    u.status === 'active' && { path: 'suspend', label: 'Suspend', variant: 'secondary', reason: true },
    u.status !== 'deactivated' && { path: 'deactivate', label: 'Deactivate', variant: 'danger', reason: true },
    { path: 'revoke-sessions', label: 'Sign out everywhere', variant: 'ghost' },
    u.lockedUntil && new Date(u.lockedUntil) > new Date() && { path: 'unlock', label: 'Unlock', variant: 'secondary' },
  ].filter(Boolean);
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Users', to: '/admin/users' }, { label: u.fullName }]}
        title={u.fullName}
        meta={
          <>
            <StatusBadge status={u.status} />
            <span className="text-sm text-ink-soft">{u.email}</span>
          </>
        }
        actions={
          !self &&
          actions.map((a) => (
            <Button
              key={a.path}
              size="sm"
              variant={a.variant || 'primary'}
              onClick={() => (a.reason ? setAction(a) : act.mutate({ path: a.path }))}
            >
              {a.label}
            </Button>
          ))
        }
      />
      {self && (
        <Alert tone="info" className="mb-4">
          You cannot change your own roles or status. Ask another administrator.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Roles"
              description="Removing a role signs the user out of all sessions."
              actions={
                !self && (
                  <Button
                    size="sm"
                    disabled={!changedRoles}
                    loading={save.isPending}
                    onClick={() => save.mutate({ roleIds })}
                  >
                    Save roles
                  </Button>
                )
              }
            />
            <CardBody>
              <RoleChecklist roles={roles.data || []} value={roleIds} onChange={self ? () => {} : setRoleIds} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Profile"
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  loading={save.isPending}
                  onClick={() =>
                    save.mutate({
                      fullName: profile.fullName,
                      organisationUnitId: profile.organisationUnitId || null,
                      accountExpiresAt: profile.accountExpiresAt || null,
                    })
                  }
                >
                  Save profile
                </Button>
              }
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  value={profile.fullName || ''}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                />
              </Field>
              <Field label="Organisational unit">
                <Select
                  value={profile.organisationUnitId}
                  onChange={(e) => setProfile({ ...profile, organisationUnitId: e.target.value })}
                  placeholder="None"
                >
                  {(units.data || []).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Account expires" help="Leave blank for no expiry">
                <Input
                  type="date"
                  value={profile.accountExpiresAt}
                  onChange={(e) => setProfile({ ...profile, accountExpiresAt: e.target.value })}
                />
              </Field>
            </CardBody>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <MetaList
                columns={1}
                items={[
                  { label: 'Type', value: humanize(u.userType) },
                  { label: 'Email verified', value: fmtDateTime(u.emailVerifiedAt) },
                  { label: 'Last sign-in', value: fmtDateTime(u.lastLoginAt) },
                  { label: 'Active sessions', value: u.activeSessions },
                  { label: 'Locked until', value: u.lockedUntil && fmtDateTime(u.lockedUntil) },
                  {
                    label: 'Deactivated',
                    value: u.deactivatedAt && `${fmtDateTime(u.deactivatedAt)} — ${u.deactivationReason || ''}`,
                  },
                  { label: 'Created', value: fmtDateTime(u.createdAt) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent sign-in attempts" />
            <ul className="divide-y divide-line">
              {u.recentLogins.map((l) => (
                <li key={l.id} className="flex justify-between px-5 py-2 text-xs">
                  <span>
                    {fmtDateTime(l.createdAt)} · {l.ipAddress}
                  </span>
                  <StatusBadge status={l.success ? 'success' : 'failure'} />
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.label}
        tone="danger"
        requireReason
        loading={act.isPending}
        description={
          action?.path === 'deactivate'
            ? 'Access is removed and all sessions revoked immediately. The account and its history are retained.'
            : undefined
        }
        onConfirm={({ reason }) => act.mutate({ path: action.path, reason })}
      />
    </div>
  );
}
