/**
 * "My account" page for every signed-in user.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogOut, Monitor } from 'lucide-react';
import { useApi, useApiMutation, post, del, put } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  MetaList,
  Button,
  Field,
  Input,
  Tabs,
  Badge,
  Alert,
} from '../../components/ui/index.js';
import { passwordRule } from '../authentication/RegisterPage.jsx';
import { fmtDateTime, humanize } from '../../utils/format.js';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordRule,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

/**
 * Shows the profile, and lets the user change their password, which is required before anything else when the
 * account has a temporary password. Users can see and sign out their active sessions and choose, per event type,
 * whether to be notified in the application and by email.
 *
 * @returns {JSX.Element}
 */
export default function AccountPage() {
  const { user } = useCan();
  const [p, set] = useQueryParams({ tab: 'profile' });
  const sessions = useApi('sessions', '/auth/sessions', null, { enabled: p.tab === 'security' });
  const prefs = useApi('notification-prefs', '/notifications/preferences', null, {
    enabled: p.tab === 'notifications',
  });
  const [prefDraft, setPrefDraft] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const change = useApiMutation((b) => post('/auth/change-password', b), {
    success: 'Password changed. Other sessions were signed out.',
    invalidate: ['sessions'],
    onSuccess: () => {
      reset();
      if (user.mustChangePassword) window.location.assign('/admin');
    },
  });
  const revoke = useApiMutation((id) => del(`/auth/sessions/${id}`), {
    success: 'Session signed out',
    invalidate: ['sessions'],
  });
  const savePrefs = useApiMutation((preferences) => put('/notifications/preferences', { preferences }), {
    success: 'Preferences saved',
    invalidate: ['notification-prefs'],
    onSuccess: () => setPrefDraft(null),
  });
  const list = prefDraft || prefs.data?.data || [];
  return (
    <div>
      <PageHeader title="My account" description={user.email} />
      {user.mustChangePassword && (
        <Alert tone="warning" className="mb-4" title="Password change required">
          Choose a new password before using the rest of the system.
        </Alert>
      )}
      <Tabs
        className="mb-6"
        value={p.tab}
        onChange={(tab) => set({ tab })}
        tabs={[
          { value: 'profile', label: 'Profile' },
          { value: 'security', label: 'Password & sessions' },
          { value: 'notifications', label: 'Notifications' },
        ]}
      />
      {p.tab === 'profile' && (
        <Card>
          <CardBody>
            <MetaList
              items={[
                { label: 'Name', value: user.fullName },
                { label: 'Email', value: user.email },
                { label: 'Roles', value: user.roles.map(humanize) },
                { label: 'Permissions', value: `${user.permissions.length} granted`, wide: true },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-1">
              {user.permissions.map((x) => (
                <Badge key={x}>{x}</Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
      {p.tab === 'security' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Change password" />
            <CardBody>
              <form className="space-y-4" onSubmit={handleSubmit(({ confirm, ...b }) => change.mutate(b))} noValidate>
                <Field label="Current password" error={errors.currentPassword?.message}>
                  <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
                </Field>
                <Field
                  label="New password"
                  help="At least 10 characters with a letter and a number"
                  error={errors.newPassword?.message}
                >
                  <Input type="password" autoComplete="new-password" {...register('newPassword')} />
                </Field>
                <Field label="Confirm new password" error={errors.confirm?.message}>
                  <Input type="password" autoComplete="new-password" {...register('confirm')} />
                </Field>
                <Button type="submit" loading={isSubmitting || change.isPending}>
                  Change password
                </Button>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Active sessions" />
            <ul className="divide-y divide-line">
              {sessions.data?.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="flex items-start gap-2">
                    <Monitor className="mt-0.5 h-4 w-4 text-ink-soft" />
                    <span>
                      <span className="line-clamp-1">{s.userAgent || 'Unknown device'}</span>
                      <span className="block text-xs text-ink-soft">
                        {s.ipAddress} · last used {fmtDateTime(s.lastUsedAt)}
                      </span>
                    </span>
                  </span>
                  {s.current ? (
                    <Badge tone="green">This device</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" icon={LogOut} onClick={() => revoke.mutate(s.id)}>
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      {p.tab === 'notifications' && (
        <Card>
          <CardHeader
            title="Notification preferences"
            actions={
              prefDraft && (
                <Button size="sm" loading={savePrefs.isPending} onClick={() => savePrefs.mutate(prefDraft)}>
                  Save
                </Button>
              )
            }
          />
          <table className="w-full text-sm">
            <thead className="bg-canvas/70 text-xs uppercase text-ink-soft">
              <tr>
                <th className="px-5 py-2 text-left">Event</th>
                <th className="px-3 py-2">In app</th>
                <th className="px-3 py-2">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((pr, i) => (
                <tr key={pr.eventType}>
                  <td className="px-5 py-2">{humanize(pr.eventType)}</td>
                  {['inApp', 'email'].map((k) => (
                    <td key={k} className="text-center">
                      <input
                        type="checkbox"
                        aria-label={`${k} for ${pr.eventType}`}
                        className="accent-brand-700"
                        checked={pr[k]}
                        onChange={(e) =>
                          setPrefDraft(list.map((x, j) => (j === i ? { ...x, [k]: e.target.checked } : x)))
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
