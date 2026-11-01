/**
 * Reading-room scheduling page for reading-room officers.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CalendarRange, CalendarX, UserCheck } from 'lucide-react';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  Button,
  StatusBadge,
  Dialog,
  Field,
  Input,
  Textarea,
  Select,
  PageLoader,
  EmptyState,
  ConfirmDialog,
  Checkbox,
} from '../../components/ui/index.js';
import { fmtDate } from '../../utils/format.js';

/**
 * Formats a timestamp as HH:MM in UTC, as the schedule is shown in UTC.
 *
 * @param {string|Date} d The timestamp.
 * @returns {string}
 */
const time = (d) => new Date(d).toISOString().slice(11, 16);

/**
 * Shows the day's appointment slots for a chosen reading room and date, with who is booked. The officer checks a
 * researcher in, recording how their identity was verified, completes the visit or records a no-show. Officers can
 * also create reading rooms, generate slots from daily start times (existing slots are kept, closure days skipped
 * and weekends optionally skipped), and close the room on a day with a reason.
 *
 * @returns {JSX.Element}
 */
export default function ReadingRoomPage() {
  const rooms = useApi('reading-rooms', '/reading-rooms');
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [newRoom, setNewRoom] = useState(null);
  const [slots, setSlots] = useState(null);
  const [closure, setClosure] = useState(null);
  const [checkIn, setCheckIn] = useState(null);
  const [identity, setIdentity] = useState('University ID card');
  const room = roomId || rooms.data?.data[0]?.id;
  const schedule = useApi(['rr-schedule', room, date], room ? `/reading-rooms/${room}/schedule` : null, { date });
  const inval = ['reading-rooms', 'rr-schedule'];
  const createRoom = useApiMutation((b) => post('/reading-rooms', b), {
    success: 'Reading room created',
    invalidate: inval,
    onSuccess: () => setNewRoom(null),
  });
  const genSlots = useApiMutation((b) => post(`/reading-rooms/${room}/slots/generate`, b), {
    success: (r) => `${r.data.created} slot(s) created`,
    invalidate: inval,
    onSuccess: () => setSlots(null),
  });
  const addClosure = useApiMutation((b) => post(`/reading-rooms/${room}/closures`, b), {
    success: 'Closure recorded',
    invalidate: inval,
    onSuccess: () => setClosure(null),
  });
  const apptAction = useApiMutation(({ id, action, ...b }) => post(`/appointments/${id}/${action}`, b), {
    success: 'Updated',
    invalidate: inval,
    onSuccess: () => setCheckIn(null),
  });
  if (rooms.isLoading) return <PageLoader />;
  return (
    <div>
      <PageHeader
        title="Reading room"
        description="Daily schedule, check-in with identity verification, slot capacity and closures."
        actions={
          <>
            {rooms.data?.data.length > 1 && (
              <Select
                aria-label="Reading room"
                value={room}
                onChange={(e) => setRoomId(e.target.value)}
                className="h-9 w-auto"
              >
                {rooms.data.data.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
            <Input
              type="date"
              aria-label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-auto"
            />
            {room && (
              <Button
                size="sm"
                variant="secondary"
                icon={CalendarRange}
                onClick={() =>
                  setSlots({
                    from: date,
                    to: date,
                    times: '09:00, 13:00',
                    durationMinutes: 180,
                    capacity: rooms.data.data.find((r) => r.id === room)?.capacity || 4,
                    skipWeekends: true,
                  })
                }
              >
                Generate slots
              </Button>
            )}
            {room && (
              <Button size="sm" variant="secondary" icon={CalendarX} onClick={() => setClosure({ date, reason: '' })}>
                Add closure
              </Button>
            )}
            <Button
              size="sm"
              icon={Plus}
              onClick={() => setNewRoom({ name: '', location: '', capacity: 8, rules: '' })}
            >
              New room
            </Button>
          </>
        }
      />
      {!room ? (
        <EmptyState title="No reading rooms" description="Create a reading room to start accepting bookings." />
      ) : (
        <Card>
          <CardHeader title={`Schedule for ${fmtDate(date)}`} description="Times in UTC" />
          {schedule.data?.data.length ? (
            <ul className="divide-y divide-line">
              {schedule.data.data.map((s) => (
                <li key={s.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {time(s.startsAt)}–{time(s.endsAt)}{' '}
                      {!s.isActive && <span className="text-xs text-red-700">(closed)</span>}
                    </p>
                    <span className="text-xs text-ink-soft">
                      {s.appointments.filter((a) => ['booked', 'checked_in'].includes(a.status)).length}/{s.capacity}{' '}
                      booked
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {s.appointments.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2 text-sm"
                      >
                        <span>
                          <span className="font-semibold">{a.researcherName}</span> ·{' '}
                          <Link
                            className="text-brand-700 hover:underline"
                            to={`/admin/research-requests/${a.requestId}`}
                          >
                            {a.request?.requestNumber}
                          </Link>
                        </span>
                        <span className="flex items-center gap-2">
                          <StatusBadge status={a.status} />
                          {a.status === 'booked' && (
                            <>
                              <Button size="sm" icon={UserCheck} onClick={() => setCheckIn(a)}>
                                Check in
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => apptAction.mutate({ id: a.id, action: 'no_show' })}
                              >
                                No-show
                              </Button>
                            </>
                          )}
                          {a.status === 'checked_in' && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                to={`/admin/circulation?requestId=${a.requestId}&appointmentId=${a.id}`}
                              >
                                Issue items
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => apptAction.mutate({ id: a.id, action: 'complete' })}
                              >
                                End visit
                              </Button>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No slots on this date" description="Generate slots or choose another date." />
          )}
        </Card>
      )}
      <Dialog
        open={Boolean(checkIn)}
        onClose={() => setCheckIn(null)}
        title={`Check in ${checkIn?.researcherName}`}
        description="Verify identity according to reading-room policy before issuing material."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCheckIn(null)}>
              Cancel
            </Button>
            <Button
              loading={apptAction.isPending}
              disabled={!identity}
              onClick={() => apptAction.mutate({ id: checkIn.id, action: 'check_in', identityMethod: identity })}
            >
              Confirm check-in
            </Button>
          </>
        }
      >
        <Field label="Identity verified using">
          <Input value={identity} onChange={(e) => setIdentity(e.target.value)} />
        </Field>
      </Dialog>
      <Dialog
        open={Boolean(newRoom)}
        onClose={() => setNewRoom(null)}
        title="New reading room"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewRoom(null)}>
              Cancel
            </Button>
            <Button
              loading={createRoom.isPending}
              disabled={!newRoom?.name}
              onClick={() =>
                createRoom.mutate({
                  ...newRoom,
                  capacity: Number(newRoom.capacity),
                  location: newRoom.location || undefined,
                  rules: newRoom.rules || undefined,
                })
              }
            >
              Create
            </Button>
          </>
        }
      >
        {newRoom && (
          <div className="space-y-4">
            <Field label="Name" required>
              <Input value={newRoom.name} onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })} />
            </Field>
            <Field label="Location">
              <Input value={newRoom.location} onChange={(e) => setNewRoom({ ...newRoom, location: e.target.value })} />
            </Field>
            <Field label="Seats">
              <Input
                type="number"
                value={newRoom.capacity}
                onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
              />
            </Field>
            <Field label="Rules shown to researchers">
              <Textarea
                rows={3}
                value={newRoom.rules}
                onChange={(e) => setNewRoom({ ...newRoom, rules: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
      <Dialog
        open={Boolean(slots)}
        onClose={() => setSlots(null)}
        title="Generate appointment slots"
        description="Existing slots are kept. Closure days are skipped."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSlots(null)}>
              Cancel
            </Button>
            <Button
              loading={genSlots.isPending}
              onClick={() =>
                genSlots.mutate({
                  ...slots,
                  times: slots.times
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                  durationMinutes: Number(slots.durationMinutes),
                  capacity: Number(slots.capacity),
                })
              }
            >
              Generate
            </Button>
          </>
        }
      >
        {slots && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From">
              <Input type="date" value={slots.from} onChange={(e) => setSlots({ ...slots, from: e.target.value })} />
            </Field>
            <Field label="To">
              <Input type="date" value={slots.to} onChange={(e) => setSlots({ ...slots, to: e.target.value })} />
            </Field>
            <Field label="Start times (UTC)" help="Comma-separated HH:MM" className="sm:col-span-2">
              <Input value={slots.times} onChange={(e) => setSlots({ ...slots, times: e.target.value })} />
            </Field>
            <Field label="Duration (minutes)">
              <Input
                type="number"
                value={slots.durationMinutes}
                onChange={(e) => setSlots({ ...slots, durationMinutes: e.target.value })}
              />
            </Field>
            <Field label="Seats per slot">
              <Input
                type="number"
                value={slots.capacity}
                onChange={(e) => setSlots({ ...slots, capacity: e.target.value })}
              />
            </Field>
            <Checkbox
              className="sm:col-span-2"
              label="Skip weekends"
              checked={slots.skipWeekends}
              onChange={(e) => setSlots({ ...slots, skipWeekends: e.target.checked })}
            />
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(closure)}
        onClose={() => setClosure(null)}
        title={`Close the reading room on ${closure?.date}?`}
        description="Slots on this day are deactivated. Existing bookings stay and should be rescheduled."
        requireReason
        reasonLabel="Reason (e.g. public holiday)"
        loading={addClosure.isPending}
        onConfirm={({ reason }) => addClosure.mutate({ date: closure.date, reason })}
      />
    </div>
  );
}
