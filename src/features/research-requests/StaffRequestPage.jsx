/**
 * Staff view of a research request, where decisions are made.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useApi, useApiMutation, post, patch } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Timeline } from '../../components/feedback/Timeline.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  MetaList,
  Button,
  StatusBadge,
  AccessBadge,
  Badge,
  PageLoader,
  ErrorState,
  Alert,
  Dialog,
  Field,
  Textarea,
  Input,
  Select,
  Checkbox,
  Tabs,
} from '../../components/ui/index.js';
import { fmtDate, fmtDateTime, humanize, fmtMoney } from '../../utils/format.js';

const LABELS = {
  start_review: 'Start review',
  request_clarification: 'Ask researcher',
  approve: 'Approve',
  reject: 'Reject',
  start_fulfilment: 'Start fulfilment',
  fulfil: 'Mark fulfilled',
  close: 'Close',
  cancel: 'Cancel',
};

/**
 * Dialog for approving, rejecting or asking for clarification, or for giving the second approval. Each requested
 * item gets its own decision. The message to the researcher is kept separate from the internal note, and conditions
 * such as supervised consultation can be set. A second approver sees the first approver's decisions and conditions.
 *
 * @param {object} props
 * @param {object} props.r The request.
 * @param {string} props.action The action being taken.
 * @param {() => void} props.onClose Called to close the dialog.
 * @returns {JSX.Element}
 */
function DecisionDialog({ r, action, onClose }) {
  const [form, setForm] = useState({ publicNote: '', internalNote: '', conditions: r.conditions || '' });
  const [decisions, setDecisions] = useState({});
  useEffect(() => {
    setDecisions(Object.fromEntries(r.items.map((i) => [i.id, i.decision === 'rejected' ? 'rejected' : 'approved'])));
  }, [r.items]);
  const act = useApiMutation((b) => post(`/research-requests/${r.id}/actions`, b), {
    success: 'Recorded',
    invalidate: [['staff-request', r.id], 'research-queue'],
    onSuccess: onClose,
  });
  const second = action === 'approve' && r.status === 'awaiting_approval';
  const needsPublic = ['reject', 'request_clarification'].includes(action);
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={second ? 'Second approval' : LABELS[action]}
      description={
        action === 'approve' && r.requiresSecondApproval && !second
          ? 'This request involves restricted material. Your approval sends it to a second approver.'
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={action === 'reject' ? 'danger' : 'primary'}
            loading={act.isPending}
            disabled={needsPublic && form.publicNote.trim().length < 3}
            onClick={() =>
              act.mutate({
                action,
                publicNote: form.publicNote || undefined,
                internalNote: form.internalNote || undefined,
                conditions: form.conditions || undefined,
                ...(action === 'approve' && {
                  itemDecisions: Object.entries(decisions).map(([itemId, decision]) => ({ itemId, decision })),
                }),
              })
            }
          >
            {LABELS[action]}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action === 'approve' && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {r.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="text-xs text-gold-700">{i.record?.referenceCode}</span> {i.record?.title}{' '}
                  <AccessBadge level={i.record?.effectiveAccessLevel} />
                </span>
                <select
                  aria-label="Item decision"
                  value={decisions[i.id]}
                  onChange={(e) => setDecisions({ ...decisions, [i.id]: e.target.value })}
                  className="h-8 rounded-md border border-line px-1.5"
                >
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </li>
            ))}
          </ul>
        )}
        <Field
          label="Message to the researcher"
          required={needsPublic}
          help="Shown to the researcher. Do not include sensitive internal reasons."
        >
          <Textarea
            rows={3}
            value={form.publicNote}
            onChange={(e) => setForm({ ...form, publicNote: e.target.value })}
          />
        </Field>
        {action === 'approve' && (
          <Field label="Conditions" help="e.g. Supervised consultation only; no photography">
            <Input value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
          </Field>
        )}
        <Field label="Internal note" help="Staff only">
          <Textarea
            rows={2}
            value={form.internalNote}
            onChange={(e) => setForm({ ...form, internalNote: e.target.value })}
          />
        </Field>
      </div>
    </Dialog>
  );
}

/**
 * Shows a request with the researcher, research purpose, requested material (restricted items marked), copy orders,
 * approvals and messages, and the actions available to the user: start review, approve, reject, ask for
 * clarification, give the second approval, or move fulfilment on. Copy orders can be delivered only after rights
 * clearance has been recorded and the delivered file attached.
 *
 * @returns {JSX.Element}
 */
export default function StaffRequestPage() {
  const { id } = useParams();
  const { user } = useCan();
  const [tab, setTab] = useState('items');
  const [action, setAction] = useState(null);
  const [comment, setComment] = useState('');
  const [rep, setRep] = useState(null);
  const { data, isLoading, error, refetch } = useApi(['staff-request', id], `/research-requests/${id}`);
  const inval = [['staff-request', id]];
  const addComment = useApiMutation((b) => post(`/research-requests/${id}/comments`, b), {
    success: 'Sent',
    invalidate: inval,
    onSuccess: () => setComment(''),
  });
  const simple = useApiMutation((b) => post(`/research-requests/${id}/actions`, b), {
    success: 'Updated',
    invalidate: [...inval, 'research-queue'],
  });
  const updRep = useApiMutation(({ rid, ...b }) => patch(`/research-requests/reproductions/${rid}`, b), {
    success: 'Copy updated',
    invalidate: inval,
    onSuccess: () => setRep(null),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const r = data.data;
  const dialogActions = ['approve', 'reject', 'request_clarification'];
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Research requests', to: '/admin/research-requests' }, { label: r.requestNumber }]}
        eyebrow={`${r.requestNumber} · ${humanize(r.requestType)}`}
        title={r.contactName}
        meta={
          <>
            <StatusBadge status={r.status} />
            {r.requiresSecondApproval && <Badge tone="violet">Two-person approval</Badge>}
            {r.restrictionsAcknowledged && <Badge tone="neutral">Conditions acknowledged</Badge>}
          </>
        }
        actions={r.availableActions.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={
              a === 'reject' ? 'danger' : ['cancel', 'request_clarification'].includes(a) ? 'secondary' : 'primary'
            }
            onClick={() => (dialogActions.includes(a) ? setAction(a) : simple.mutate({ action: a }))}
          >
            {a === 'approve' && r.status === 'awaiting_approval' ? 'Give second approval' : LABELS[a]}
          </Button>
        ))}
      />
      {r.status === 'awaiting_approval' && r.decisionById === user.id && (
        <Alert tone="info" className="mb-4">
          You gave the first approval. A different person with approval rights must decide next.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Research purpose" />
            <CardBody className="whitespace-pre-line text-sm">{r.purpose}</CardBody>
          </Card>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'items', label: 'Requested items', count: r.items.length },
              { value: 'visits', label: 'Appointments', count: r.appointments.length },
              { value: 'circulation', label: 'Circulation', count: r.circulations.length },
              { value: 'copies', label: 'Copies', count: r.reproductions.length },
              { value: 'history', label: 'History' },
            ]}
          />
          {tab === 'items' && (
            <Card>
              <ul className="divide-y divide-line">
                {r.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <Link to={`/admin/records/${i.recordId}`} className="min-w-0 hover:underline">
                      <span className="text-xs text-gold-700">
                        {i.record?.referenceCode} · {humanize(i.record?.level)}
                      </span>
                      <span className="block font-semibold">{i.record?.title}</span>
                      {i.notes && <span className="block text-xs text-ink-soft">{i.notes}</span>}
                    </Link>
                    <span className="flex shrink-0 gap-1">
                      {['restricted', 'embargoed', 'confidential', 'closed'].includes(
                        i.record?.effectiveAccessLevel,
                      ) && <Lock className="h-4 w-4 text-amber-700" aria-label="Restricted" />}
                      <AccessBadge level={i.record?.effectiveAccessLevel} />
                      <StatusBadge status={i.decision} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {tab === 'visits' && (
            <Card>
              <ul className="divide-y divide-line">
                {r.appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      {fmtDateTime(a.slot.startsAt)} · {a.slot.readingRoom.name}
                      {a.identityMethod && <span className="block text-xs text-ink-soft">ID: {a.identityMethod}</span>}
                    </span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
              {!r.appointments.length && <CardBody className="text-sm text-ink-soft">No visit booked.</CardBody>}
            </Card>
          )}
          {tab === 'circulation' && (
            <Card>
              <ul className="divide-y divide-line">
                {r.circulations.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      <span className="font-mono text-xs text-gold-700">{c.physicalItem?.barcode}</span>{' '}
                      {c.physicalItem?.title}
                      <span className="block text-xs text-ink-soft">
                        Issued {fmtDateTime(c.issuedAt)}
                        {c.returnedAt && ` · returned ${fmtDateTime(c.returnedAt)}`}
                      </span>
                    </span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
              {!r.circulations.length && <CardBody className="text-sm text-ink-soft">Nothing issued.</CardBody>}
            </Card>
          )}
          {tab === 'copies' && (
            <Card>
              <ul className="divide-y divide-line">
                {r.reproductions.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      {x.record?.title}
                      <span className="block text-xs text-ink-soft">
                        {x.rightsCleared ? 'Rights cleared' : 'Rights not yet cleared'}
                        {x.rightsNote ? ` — ${x.rightsNote}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={x.status} />
                      <Button size="sm" variant="secondary" onClick={() => setRep({ ...x, rid: x.id })}>
                        Update
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
              {!r.reproductions.length && <CardBody className="text-sm text-ink-soft">No copy orders.</CardBody>}
            </Card>
          )}
          {tab === 'history' && (
            <Card>
              <CardBody>
                <Timeline items={r.history} />
              </CardBody>
            </Card>
          )}
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Researcher" />
            <CardBody>
              <MetaList
                columns={1}
                items={[
                  { label: 'Email', value: r.contactEmail },
                  { label: 'Phone', value: r.contactPhone },
                  { label: 'Affiliation', value: r.affiliation },
                  { label: 'Account', value: r.requesterId ? 'Registered researcher' : 'Anonymous enquiry' },
                  { label: 'Preferred date', value: fmtDate(r.preferredDate) },
                  { label: 'Delivery', value: r.deliveryPreference },
                  { label: 'Conditions', value: r.conditions },
                  { label: 'Public decision note', value: r.publicDecisionNote },
                  { label: 'Internal note', value: r.internalDecisionNote },
                  {
                    label: 'Fee',
                    value:
                      r.feeAmount !== null && r.feeAmount !== undefined
                        ? `${fmtMoney(r.feeAmount, r.feeCurrency || undefined)} · ${humanize(r.paymentStatus)}`
                        : null,
                  },
                ]}
              />
            </CardBody>
          </Card>
          {r.approvals.length > 0 && (
            <Card>
              <CardHeader title="Approvals" />
              <ul className="divide-y divide-line">
                {r.approvals.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <StatusBadge status={a.decision} /> {a.approver?.fullName}{' '}
                    <span className="text-xs text-ink-soft">
                      ({humanize(a.stage)}) {fmtDateTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Messages" />
            <CardBody className="space-y-3">
              {r.comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg p-3 text-sm ${c.visibility === 'internal' ? 'bg-amber-50' : 'bg-canvas'}`}
                >
                  <p className="text-xs font-semibold text-ink-soft">
                    {c.author?.fullName || r.contactName} · {fmtDateTime(c.createdAt)}
                    {c.visibility === 'internal' && ' · internal'}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{c.body}</p>
                </div>
              ))}
              <Textarea rows={3} aria-label="Message" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!comment.trim()}
                  onClick={() => addComment.mutate({ body: comment, visibility: 'internal' })}
                >
                  Internal note
                </Button>
                <Button
                  size="sm"
                  disabled={!comment.trim()}
                  loading={addComment.isPending}
                  onClick={() => addComment.mutate({ body: comment, visibility: 'shared' })}
                >
                  Message researcher
                </Button>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
      {action && <DecisionDialog r={r} action={action} onClose={() => setAction(null)} />}
      <Dialog
        open={Boolean(rep)}
        onClose={() => setRep(null)}
        title="Update copy order"
        description="A copy can be delivered only after rights are cleared and the delivered file is attached."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRep(null)}>
              Cancel
            </Button>
            <Button
              loading={updRep.isPending}
              onClick={() =>
                updRep.mutate({
                  rid: rep.rid,
                  status: rep.status,
                  rightsCleared: rep.rightsCleared,
                  rightsNote: rep.rightsNote || undefined,
                  deliveredAssetId: rep.deliveredAssetId || undefined,
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        {rep && (
          <div className="space-y-4">
            <Field label="Status">
              <Select value={rep.status} onChange={(e) => setRep({ ...rep, status: e.target.value })}>
                {['pending', 'approved', 'in_production', 'delivered', 'rejected'].map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Checkbox
              label="Copyright and reproduction rights cleared"
              checked={rep.rightsCleared}
              onChange={(e) => setRep({ ...rep, rightsCleared: e.target.checked })}
            />
            <Field label="Rights note">
              <Input value={rep.rightsNote || ''} onChange={(e) => setRep({ ...rep, rightsNote: e.target.value })} />
            </Field>
            <Field label="Delivered asset ID" help="Upload the copy to the description, then paste its asset ID">
              <Input
                value={rep.deliveredAssetId || ''}
                onChange={(e) => setRep({ ...rep, deliveredAssetId: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
