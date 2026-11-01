/**
 * Researcher's own area ("My research").
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus } from 'lucide-react';
import { useApi, useApiMutation, del } from '../../lib/query.js';
import { useAuth } from '../../store/auth.js';
import { Tabs, Card, StatusBadge, EmptyState, Button, PageLoader } from '../../components/ui/index.js';
import { fmtDate, fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Shows the researcher's requests, saved descriptions and booked visits in tabs, with a button to make a new
 * request. Saved descriptions can be removed or used to start a consultation request.
 *
 * @returns {JSX.Element}
 */
export default function MyResearchPage() {
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('requests');
  useEffect(() => {
    document.title = 'My research · UG Archives';
  }, []);
  const requests = useApi('my-requests', '/research-requests/mine', { pageSize: 50 });
  const saved = useApi('my-saved', '/me/research-list');
  const appts = useApi('my-appointments', '/me/appointments');
  const remove = useApiMutation((id) => del(`/me/research-list/${id}`), {
    success: 'Removed',
    invalidate: ['my-saved'],
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="label-eyebrow">Researcher account</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Welcome, {user?.fullName?.split(' ')[0]}</h1>
        <Button icon={Plus} to="/request">
          New request
        </Button>
      </div>
      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'requests', label: 'Requests', count: requests.data?.meta.total },
          { value: 'saved', label: 'Saved records', count: saved.data?.data.length },
          { value: 'appointments', label: 'Visits', count: appts.data?.data.length },
        ]}
      />
      <div className="mt-6">
        {tab === 'requests' &&
          (requests.isLoading ? (
            <PageLoader />
          ) : requests.data?.data.length ? (
            <Card as="ul" className="divide-y divide-line">
              {requests.data.data.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/my/requests/${r.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-canvas"
                  >
                    <span>
                      <span className="block font-semibold">
                        {r.requestNumber || 'Draft'} · {humanize(r.requestType)}
                      </span>
                      <span className="block text-sm text-ink-soft">
                        Submitted {fmtDate(r.submittedAt || r.createdAt)}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </Card>
          ) : (
            <EmptyState
              title="No requests yet"
              description="Search the catalogue and request access, copies or a reading-room visit."
              action={<Button to="/search">Search the archives</Button>}
            />
          ))}
        {tab === 'saved' &&
          (saved.data?.data.length ? (
            <Card as="ul" className="divide-y divide-line">
              {saved.data.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link to={`/records/${s.recordId}`} className="min-w-0 hover:underline">
                    <span className="block text-xs text-gold-600">{s.record?.referenceCode}</span>
                    <span className="block font-semibold">{s.record?.title}</span>
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="secondary" to={`/request?type=consultation&recordId=${s.recordId}`}>
                      Request
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </Card>
          ) : (
            <EmptyState title="Nothing saved" description="Use “Save to research list” on any description." />
          ))}
        {tab === 'appointments' &&
          (appts.data?.data.length ? (
            <Card as="ul" className="divide-y divide-line">
              {appts.data.data.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <span>
                    <span className="block font-semibold">{fmtDateTime(a.slot.startsAt)}</span>
                    <span className="block text-sm text-ink-soft">
                      {a.slot.readingRoom.name} · Request {a.request?.requestNumber}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </Card>
          ) : (
            <EmptyState
              title="No visits booked"
              description="Once a request is approved you can book a reading-room slot from the request page."
            />
          ))}
      </div>
    </div>
  );
}
