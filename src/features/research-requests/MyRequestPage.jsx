/**
 * Researcher's view of one of their requests.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import {
  Card,
  CardHeader,
  CardBody,
  StatusBadge,
  PageLoader,
  ErrorState,
  Button,
  Textarea,
  Field,
  Select,
  Alert,
  ConfirmDialog,
} from '../../components/ui/index.js';
import { Breadcrumbs } from '../../components/layout/PageHeader.jsx';
import { fmtDate, fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Lets the researcher book a reading-room visit for an approved request: choose a room and see its slots for the
 * next 30 days, with times in UTC (the same as Ghana time). Full slots are shown but cannot be booked, and slots on
 * closure days are not offered.
 *
 * @param {object} props
 * @param {object} props.request The approved request.
 * @returns {JSX.Element}
 */
function Booking({ request }) {
  const rooms = useQuery({
    queryKey: ['reading-rooms'],
    queryFn: () => api.get('/reading-rooms').then((r) => r.data.data),
  });
  const [roomId, setRoomId] = useState('');
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const room = roomId || rooms.data?.[0]?.id;
  const avail = useQuery({
    queryKey: ['availability', room, from],
    queryFn: () => api.get(`/reading-rooms/${room}/availability`, { params: { from, to } }).then((r) => r.data.data),
    enabled: Boolean(room),
  });
  const book = useApiMutation((slotId) => post('/appointments', { slotId, requestId: request.id }), {
    success: 'Visit booked. A confirmation has been sent.',
    invalidate: ['my-request', 'my-appointments', 'availability'],
  });
  const byDay = useMemo(() => {
    const m = new Map();
    for (const s of avail.data?.slots || []) {
      const d = s.startsAt.slice(0, 10);
      m.set(d, [...(m.get(d) || []), s]);
    }
    return [...m.entries()];
  }, [avail.data]);
  if (!rooms.data?.length)
    return (
      <Alert tone="info">
        No reading rooms are currently accepting bookings. An archivist will contact you to arrange your visit.
      </Alert>
    );
  return (
    <div className="space-y-3">
      {rooms.data.length > 1 && (
        <Field label="Reading room">
          <Select value={room} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.data.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {byDay.length === 0 && <p className="text-sm text-ink-soft">No open slots in the next 30 days.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {byDay.map(([day, slots]) => (
          <div key={day} className="rounded-lg border border-line p-3">
            <p className="text-sm font-bold">{fmtDate(day)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant="secondary"
                  disabled={!s.available || book.isPending}
                  onClick={() => book.mutate(s.id)}
                >
                  {new Date(s.startsAt).toISOString().slice(11, 16)} UTC {s.available ? '' : '(full)'}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shows the request's status, the requested material and the message thread with the Archives. When the archivist
 * asks for more information the researcher replies here; when approved, the decision, conditions and the booking
 * panel appear. Visits can be cancelled, and the request can be cancelled while it is still open.
 *
 * @returns {JSX.Element}
 */
export default function MyRequestPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useApi(['my-request', id], `/research-requests/${id}`);
  const [message, setMessage] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const act = useApiMutation((body) => post(`/research-requests/${id}/actions`, body), {
    success: 'Updated',
    invalidate: ['my-request', 'my-requests'],
  });
  const comment = useApiMutation((body) => post(`/research-requests/${id}/comments`, body), {
    success: 'Message sent',
    invalidate: ['my-request'],
    onSuccess: () => setMessage(''),
  });
  const cancelAppt = useApiMutation(
    (apptId) => post(`/appointments/${apptId}/cancel`, { reason: 'Cancelled by researcher' }),
    { success: 'Visit cancelled', invalidate: ['my-request'] },
  );
  useEffect(() => {
    if (data) document.title = `Request ${data.data.requestNumber} · UG Archives`;
  }, [data]);
  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <PageLoader />
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const r = data.data;
  const activeAppt = r.appointments.find((a) => ['booked', 'checked_in'].includes(a.status));
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ label: 'My research', to: '/my' }, { label: r.requestNumber || 'Request' }]} />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Request {r.requestNumber}</h1>
          <p className="text-ink-soft">
            {humanize(r.requestType)} · submitted {fmtDate(r.submittedAt)}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </header>
      {r.status === 'awaiting_researcher' && (
        <Alert tone="warning" title="The archivist needs more information">
          {r.publicDecisionNote}
        </Alert>
      )}
      {r.status === 'rejected' && (
        <Alert tone="danger" title="This request was not approved">
          {r.publicDecisionNote}
        </Alert>
      )}
      {['approved', 'scheduled', 'in_progress'].includes(r.status) && (
        <Alert tone="success" title="Approved">
          {r.publicDecisionNote}
          {r.conditions && (
            <p className="mt-1">
              <span className="font-semibold">Conditions:</span> {r.conditions}
            </p>
          )}
        </Alert>
      )}
      <Card>
        <CardHeader title="Requested material" />
        <ul className="divide-y divide-line">
          {r.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <Link to={`/records/${i.recordId}`} className="hover:underline">
                <span className="text-xs text-gold-600">{i.record?.referenceCode}</span>{' '}
                <span className="font-semibold">{i.record?.title}</span>
              </Link>
              {i.decision !== 'pending' && <StatusBadge status={i.decision} />}
            </li>
          ))}
        </ul>
      </Card>
      {r.status === 'approved' && r.requestType !== 'enquiry' && (
        <Card>
          <CardHeader
            title="Book a reading-room visit"
            description="Choose an available slot. Bring photo identification."
          />
          <CardBody>
            <Booking request={r} />
          </CardBody>
        </Card>
      )}
      {activeAppt && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">Visit: {fmtDateTime(activeAppt.slot.startsAt)}</p>
              <p className="text-sm text-ink-soft">{activeAppt.slot.readingRoom.name}</p>
            </div>
            {activeAppt.status === 'booked' && (
              <Button
                variant="secondary"
                onClick={() => cancelAppt.mutate(activeAppt.id)}
                loading={cancelAppt.isPending}
              >
                Cancel visit
              </Button>
            )}
          </CardBody>
        </Card>
      )}
      {r.reproductions.length > 0 && (
        <Card>
          <CardHeader title="Copies" />
          <ul className="divide-y divide-line">
            {r.reproductions.map((x) => (
              <li key={x.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>{x.record?.title}</span>
                <StatusBadge status={x.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader title="Messages" />
        <CardBody className="space-y-4">
          {r.comments.length ? (
            r.comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-canvas p-3 text-sm">
                <p className="text-xs font-semibold text-ink-soft">
                  {c.author?.fullName || 'Archives'} · {fmtDateTime(c.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-line">{c.body}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-soft">No messages yet.</p>
          )}
          {!['closed', 'cancelled', 'fulfilled'].includes(r.status) && (
            <div className="space-y-2">
              <Field label={r.status === 'awaiting_researcher' ? 'Your response' : 'Send a message'}>
                <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
              </Field>
              <div className="flex flex-wrap justify-between gap-2">
                {r.availableActions.includes('cancel') && (
                  <Button variant="ghost" className="text-red-700" onClick={() => setCancelOpen(true)}>
                    Cancel request
                  </Button>
                )}
                <Button
                  disabled={message.trim().length < 2}
                  loading={act.isPending || comment.isPending}
                  onClick={() =>
                    r.status === 'awaiting_researcher'
                      ? act.mutate({ action: 'respond', message }, { onSuccess: () => setMessage('') })
                      : comment.mutate({ body: message })
                  }
                >
                  {r.status === 'awaiting_researcher' ? 'Send response' : 'Send'}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this request?"
        confirmLabel="Cancel request"
        tone="danger"
        loading={act.isPending}
        onConfirm={() => act.mutate({ action: 'cancel' }, { onSuccess: () => setCancelOpen(false) })}
      />
    </div>
  );
}
