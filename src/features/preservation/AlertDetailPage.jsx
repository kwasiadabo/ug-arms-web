/**
 * Preservation alert detail page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LifeBuoy, Upload } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  MetaList,
  Button,
  StatusBadge,
  Badge,
  PageLoader,
  ErrorState,
  Alert,
  Dialog,
  Field,
  Textarea,
  Select,
  ConfirmDialog,
} from '../../components/ui/index.js';
import { humanize, fmtDateTime } from '../../utils/format.js';

/**
 * Shows an alert with the affected file, its recent preservation events, its replicas and the resolution.
 * Preservation managers can mark the alert as investigating, resolved or closed, with a reason. For a failed fixity
 * check or a missing file, authorised users can recover the file from a verified replica or an uploaded copy; the
 * copy must match the originally recorded checksum, and a fresh fixity check runs afterwards.
 *
 * @returns {JSX.Element}
 */
export default function AlertDetailPage() {
  const { id } = useParams();
  const { can } = useCan();
  const [recover, setRecover] = useState(false);
  const [statusAction, setStatusAction] = useState(null);
  const [form, setForm] = useState({ replicaId: '', note: '', file: null });
  const { data, isLoading, error, refetch } = useApi(['alert', id], `/preservation/alerts/${id}`);
  const inval = [['alert', id], 'preservation-alerts', 'preservation-summary'];
  const doRecover = useApiMutation(
    () => {
      const fd = new FormData();
      fd.append('note', form.note);
      if (form.replicaId) fd.append('replicaId', form.replicaId);
      if (form.file) fd.append('file', form.file);
      return api.post(`/preservation/alerts/${id}/recover`, fd).then((r) => r.data);
    },
    {
      success: (r) => `Recovered. Fresh verification: ${r.data.verification.status}`,
      invalidate: inval,
      onSuccess: () => setRecover(false),
    },
  );
  const setStatus = useApiMutation((b) => post(`/preservation/alerts/${id}/status`, b), {
    success: 'Alert updated',
    invalidate: inval,
    onSuccess: () => setStatusAction(null),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const a = data.data;
  const open = ['open', 'investigating'].includes(a.status);
  const verified = a.replicas.filter((r) => r.status === 'verified');
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Preservation', to: '/admin/preservation' }, { label: humanize(a.alertType) }]}
        title={humanize(a.alertType)}
        meta={
          <>
            <StatusBadge status={a.status} />
            <Badge tone={['critical', 'high'].includes(a.severity) ? 'red' : 'amber'}>{humanize(a.severity)}</Badge>
            <span className="text-sm text-ink-soft">Raised {fmtDateTime(a.createdAt)}</span>
          </>
        }
        actions={
          can('preservation.manage') && (
            <>
              {a.status === 'open' && (
                <Button size="sm" variant="secondary" onClick={() => setStatusAction('investigating')}>
                  Start investigation
                </Button>
              )}
              {open && can('preservation.recover') && ['fixity_failure', 'missing_file'].includes(a.alertType) && (
                <Button size="sm" icon={LifeBuoy} onClick={() => setRecover(true)}>
                  Recover asset
                </Button>
              )}
              {open && !['fixity_failure', 'missing_file'].includes(a.alertType) && (
                <Button size="sm" onClick={() => setStatusAction('resolved')}>
                  Mark resolved
                </Button>
              )}
              {['recovered', 'resolved'].includes(a.status) && (
                <Button size="sm" variant="secondary" onClick={() => setStatusAction('closed')}>
                  Close case
                </Button>
              )}
            </>
          )
        }
      />
      <Alert tone={open ? 'danger' : 'success'} className="mb-6">
        {a.message}
      </Alert>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Affected asset" />
            <CardBody>
              <MetaList
                items={[
                  {
                    label: 'File',
                    value: (
                      <Link className="text-brand-700 hover:underline" to={`/admin/assets/${a.asset.id}`}>
                        {a.asset.originalFilename}
                      </Link>
                    ),
                  },
                  { label: 'Role', value: humanize(a.asset.role) },
                  {
                    label: 'Recorded SHA-256',
                    value: <span className="break-all font-mono text-xs">{a.asset.sha256}</span>,
                    wide: true,
                  },
                  {
                    label: 'Observed SHA-256',
                    value: a.fixityCheck?.actualSha256 ? (
                      <span className="break-all font-mono text-xs">{a.fixityCheck.actualSha256}</span>
                    ) : (
                      a.fixityCheck?.error
                    ),
                    wide: true,
                  },
                  { label: 'Preservation status', value: humanize(a.asset.preservationStatus) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent preservation events" />
            <ul className="divide-y divide-line">
              {a.events.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>
                    <span className="font-semibold">{humanize(e.eventType)}</span>{' '}
                    <span className="text-ink-soft">— {e.detail}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-ink-soft">
                    <StatusBadge status={e.outcome} />
                    <br />
                    {fmtDateTime(e.eventAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Replicas" />
            <ul className="divide-y divide-line">
              {a.replicas.map((r) => (
                <li key={r.id} className="px-5 py-2.5 text-sm">
                  <span className="font-semibold">{r.target}</span> <StatusBadge status={r.status} />
                  <span className="block text-xs text-ink-soft">
                    {r.verifiedAt ? `Verified ${fmtDateTime(r.verifiedAt)}` : r.error}
                  </span>
                </li>
              ))}
            </ul>
            {!a.replicas.length && (
              <CardBody className="text-sm text-ink-soft">
                No replicas recorded. Recovery needs a verified copy from backup.
              </CardBody>
            )}
          </Card>
          {a.resolution && (
            <Card>
              <CardHeader title="Resolution" />
              <CardBody className="text-sm">
                <p>{a.resolution}</p>
                {a.recoverySource && <p className="mt-1 text-ink-soft">Source: {a.recoverySource}</p>}
                <p className="mt-1 text-xs text-ink-soft">
                  {a.resolvedBy?.fullName} · {fmtDateTime(a.resolvedAt)}
                </p>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
      <Dialog
        open={recover}
        onClose={() => setRecover(false)}
        size="lg"
        title="Recover from a verified copy"
        description="The copy must match the originally recorded checksum. After restoring, a fresh fixity check runs automatically."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecover(false)}>
              Cancel
            </Button>
            <Button
              loading={doRecover.isPending}
              disabled={form.note.trim().length < 5 || (!form.replicaId && !form.file)}
              onClick={() => doRecover.mutate()}
            >
              Restore and verify
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Source">
            <Select
              value={form.replicaId}
              onChange={(e) => setForm({ ...form, replicaId: e.target.value, file: null })}
            >
              <option value="">Upload a copy from backup</option>
              {verified.map((r) => (
                <option key={r.id} value={r.id}>
                  Replica: {r.target}
                </option>
              ))}
            </Select>
          </Field>
          {!form.replicaId && (
            <label className="block cursor-pointer rounded-lg border-2 border-dashed border-line px-4 py-3 text-sm text-ink-soft">
              <input type="file" className="sr-only" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} />
              <Upload className="mr-2 inline h-4 w-4" />
              {form.file ? form.file.name : 'Choose the verified copy'}
            </label>
          )}
          <Field label="Investigation and recovery notes" required>
            <Textarea rows={4} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Dialog>
      <ConfirmDialog
        open={Boolean(statusAction)}
        onClose={() => setStatusAction(null)}
        title={`Mark as ${humanize(statusAction)}`}
        requireReason
        reasonLabel="Notes"
        loading={setStatus.isPending}
        onConfirm={({ reason }) => setStatus.mutate({ status: statusAction, note: reason })}
      />
    </div>
  );
}
