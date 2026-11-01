/**
 * Retention schedules, records due for review, and legal holds.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Lock, Unlock } from 'lucide-react';
import { useApi, useApiMutation, post, patch } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  Button,
  StatusBadge,
  Tabs,
  Dialog,
  Field,
  Input,
  Textarea,
  Select,
  ConfirmDialog,
  Alert,
  EmptyState,
  Badge,
} from '../../components/ui/index.js';
import { RecordPicker } from '../archival-records/Pickers.jsx';
import { fmtDate, humanize } from '../../utils/format.js';

/**
 * Lists retention schedules. Users who manage retention draft and edit them; approvers approve or retire them with
 * a reason. Only approved schedules are used.
 *
 * @returns {JSX.Element}
 */
function Schedules() {
  const { can } = useCan();
  const { data } = useApi('retention-schedules', '/retention/schedules');
  const [edit, setEdit] = useState(null);
  const [status, setStatus] = useState(null);
  const save = useApiMutation(
    (s) =>
      s.id
        ? patch(
            `/retention/schedules/${s.id}`,
            (({ id, code, status: _s, approvedBy, approvedById, approvedAt, createdAt, updatedAt, ...x }) => x)(s),
          )
        : post('/retention/schedules', s),
    { success: 'Schedule saved', invalidate: ['retention-schedules'], onSuccess: () => setEdit(null) },
  );
  const change = useApiMutation(({ id, ...b }) => post(`/retention/schedules/${id}/status`, b), {
    success: 'Updated',
    invalidate: ['retention-schedules'],
    onSuccess: () => setStatus(null),
  });
  return (
    <Card>
      <CardHeader
        title="Retention schedules"
        description="Configurable defaults. A schedule is used only after approval by an authorised person."
        actions={
          can('retention.manage') && (
            <Button
              size="sm"
              icon={Plus}
              onClick={() =>
                setEdit({
                  code: '',
                  title: '',
                  recordCategory: '',
                  triggerEvent: '',
                  retentionYears: '',
                  finalAction: 'review',
                  legalBasis: '',
                  description: '',
                })
              }
            >
              New schedule
            </Button>
          )
        }
      />
      <ul className="divide-y divide-line">
        {data?.data.map((s) => (
          <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-semibold">
                <span className="font-mono text-xs text-gold-700">{s.code}</span> {s.title}{' '}
                <StatusBadge status={s.status} />
              </p>
              <p className="text-ink-soft">
                {s.recordCategory} · {s.retentionYears ?? '—'} years after {s.triggerEvent}, then{' '}
                {humanize(s.finalAction)}
              </p>
              {s.legalBasis && <p className="text-xs text-ink-soft">Basis: {s.legalBasis}</p>}
              {s.approvedBy && (
                <p className="text-xs text-ink-soft">
                  Approved by {s.approvedBy.fullName} {fmtDate(s.approvedAt)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {s.status === 'draft' && can('retention.manage') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEdit({ ...s, retentionYears: s.retentionYears ?? '' })}
                >
                  Edit
                </Button>
              )}
              {s.status === 'draft' && can('appraisal.approve') && (
                <Button size="sm" onClick={() => setStatus({ id: s.id, status: 'approved' })}>
                  Approve
                </Button>
              )}
              {s.status === 'approved' && can('appraisal.approve') && (
                <Button size="sm" variant="ghost" onClick={() => setStatus({ id: s.id, status: 'retired' })}>
                  Retire
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {data && !data.data.length && (
        <EmptyState
          title="No schedules"
          description="Draft schedules from the University's approved retention policy."
        />
      )}
      <Dialog
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        size="lg"
        title={edit?.id ? 'Edit schedule' : 'New retention schedule'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              onClick={() =>
                save.mutate({
                  ...edit,
                  retentionYears: edit.retentionYears === '' ? null : Number(edit.retentionYears),
                  legalBasis: edit.legalBasis || null,
                  description: edit.description || null,
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
            <Field label="Record category" required>
              <Input
                value={edit.recordCategory}
                onChange={(e) => setEdit({ ...edit, recordCategory: e.target.value })}
              />
            </Field>
            <Field label="Title" required className="sm:col-span-2">
              <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <Field label="Trigger event" required help="e.g. end of financial year, graduation">
              <Input value={edit.triggerEvent} onChange={(e) => setEdit({ ...edit, triggerEvent: e.target.value })} />
            </Field>
            <Field label="Retention (years)">
              <Input
                type="number"
                min="0"
                value={edit.retentionYears}
                onChange={(e) => setEdit({ ...edit, retentionYears: e.target.value })}
              />
            </Field>
            <Field label="Final action">
              <Select value={edit.finalAction} onChange={(e) => setEdit({ ...edit, finalAction: e.target.value })}>
                {['permanent', 'review', 'transfer_to_archives', 'destroy', 'return_to_department'].map((a) => (
                  <option key={a} value={a}>
                    {humanize(a)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Legal or policy basis" className="sm:col-span-2">
              <Input value={edit.legalBasis} onChange={(e) => setEdit({ ...edit, legalBasis: e.target.value })} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={edit.description || ''}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(status)}
        onClose={() => setStatus(null)}
        title={status?.status === 'approved' ? 'Approve schedule' : 'Retire schedule'}
        requireReason
        loading={change.isPending}
        onConfirm={({ reason }) => change.mutate({ ...status, reason })}
      />
    </Card>
  );
}

/**
 * Lists departmental and non-permanent records whose retention period has passed. Nothing is ever disposed of
 * automatically; the list is a prompt to open an appraisal case.
 *
 * @returns {JSX.Element}
 */
function Due() {
  const { data } = useApi('retention-due', '/retention/due');
  return (
    <Card>
      <CardHeader
        title="Due for review"
        description="Departmental and non-permanent records past their retention period. Nothing is disposed automatically; open an appraisal case."
      />
      <ul className="divide-y divide-line">
        {data?.data.map((r) => (
          <li key={r.id}>
            <Link
              to={`/admin/records/${r.id}`}
              className="flex justify-between gap-3 px-5 py-2.5 text-sm hover:bg-canvas"
            >
              <span>
                <span className="text-xs text-gold-700">{r.referenceCode}</span> {r.title}
                <span className="block text-xs text-ink-soft">
                  Trigger {fmtDate(r.retentionTriggerDate)} · {r.schedule.code} ({r.schedule.retentionYears} years →{' '}
                  {humanize(r.schedule.finalAction)})
                </span>
              </span>
              <Badge tone="amber">Due</Badge>
            </Link>
          </li>
        ))}
      </ul>
      {data && !data.data.length && <EmptyState title="Nothing is due" />}
    </Card>
  );
}

/**
 * Lists legal holds. Authorised users place a hold with its authority and the material it covers; a hold blocks
 * disposal of that material and everything beneath it immediately. Releasing a hold requires a reason and a
 * different person from the one who placed it.
 *
 * @returns {JSX.Element}
 */
function Holds() {
  const { can } = useCan();
  const { data } = useApi('legal-holds', '/legal-holds', { pageSize: 100 });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', authority: '', description: '', items: [] });
  const [release, setRelease] = useState(null);
  const create = useApiMutation((b) => post('/legal-holds', b), {
    success: 'Legal hold placed; affected disposals are blocked',
    invalidate: ['legal-holds', 'disposal-cases'],
    onSuccess: () => {
      setOpen(false);
      setF({ title: '', authority: '', description: '', items: [] });
    },
  });
  const rel = useApiMutation(({ id, reason }) => post(`/legal-holds/${id}/release`, { reason }), {
    success: 'Hold released',
    invalidate: ['legal-holds'],
    onSuccess: () => setRelease(null),
  });
  return (
    <Card>
      <CardHeader
        title="Legal holds"
        description="A hold blocks disposal of the named material and everything beneath it. It must be released by a different person."
        actions={
          can('legalhold.manage') && (
            <Button size="sm" icon={Lock} onClick={() => setOpen(true)}>
              Place hold
            </Button>
          )
        }
      />
      <ul className="divide-y divide-line">
        {data?.data.map((h) => (
          <li key={h.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-semibold">
                {h.reference} — {h.title} <StatusBadge status={h.status} />
              </p>
              <p className="text-ink-soft">{h.authority}</p>
              <p className="text-xs text-ink-soft">
                Placed by {h.placedBy?.fullName}, {fmtDate(h.placedAt)} · {h.items.length} item(s):{' '}
                {h.items
                  .map((i) => i.record?.referenceCode)
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {h.releaseReason && <p className="text-xs">Released: {h.releaseReason}</p>}
            </div>
            {h.status === 'active' && can('legalhold.manage') && (
              <Button size="sm" variant="secondary" icon={Unlock} onClick={() => setRelease(h.id)}>
                Release
              </Button>
            )}
          </li>
        ))}
      </ul>
      {data && !data.data.length && <EmptyState title="No legal holds" />}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Place a legal hold"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!f.title || !f.items.length}
              onClick={() =>
                create.mutate({
                  title: f.title,
                  authority: f.authority || undefined,
                  description: f.description || undefined,
                  items: f.items.map((i) => ({ recordId: i.id, includeDescendants: true })),
                })
              }
            >
              Place hold
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="warning">Holds take effect immediately and block any disposal not yet executed.</Alert>
          <Field label="Title" required>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Authority" help="e.g. Office of the Registrar, legal counsel instruction">
            <Input value={f.authority} onChange={(e) => setF({ ...f, authority: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div>
            <p className="mb-1 text-[13px] font-semibold">Material covered</p>
            <RecordPicker
              onPick={(r) => !f.items.find((i) => i.id === r.id) && setF({ ...f, items: [...f.items, r] })}
            />
            <ul className="mt-2 space-y-1">
              {f.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-md bg-canvas px-3 py-1.5 text-sm">
                  <span>
                    {i.sub} {i.label}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setF({ ...f, items: f.items.filter((x) => x.id !== i.id) })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={Boolean(release)}
        onClose={() => setRelease(null)}
        title="Release legal hold"
        requireReason
        loading={rel.isPending}
        onConfirm={({ reason }) => rel.mutate({ id: release, reason })}
      />
    </Card>
  );
}

/**
 * Shows schedules, records due for review and legal holds in tabs; the legal-holds address opens the holds tab
 * directly. Schedules and holds must be validated by the University's authorised policy owners before production
 * use.
 *
 * @returns {JSX.Element}
 */
export default function RetentionPage() {
  const [p, set] = useQueryParams({ tab: window.location.pathname.endsWith('legal-holds') ? 'holds' : 'schedules' });
  return (
    <div>
      <PageHeader
        title="Retention and legal holds"
        description="Schedules and holds are configurable and must be validated by the University's authorised policy owners before production use."
      />
      <Tabs
        className="mb-4"
        value={p.tab}
        onChange={(tab) => set({ tab })}
        tabs={[
          { value: 'schedules', label: 'Schedules' },
          { value: 'due', label: 'Due for review' },
          { value: 'holds', label: 'Legal holds' },
        ]}
      />
      {p.tab === 'schedules' && <Schedules />}
      {p.tab === 'due' && <Due />}
      {p.tab === 'holds' && <Holds />}
    </div>
  );
}
