/**
 * Access approvals page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useQueryParams } from '../../hooks/useQueryParams.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Card,
  CardHeader,
  Button,
  StatusBadge,
  Tabs,
  ConfirmDialog,
  EmptyState,
  Alert,
  Badge,
} from '../../components/ui/index.js';
import { fmtDate, fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Lists access changes awaiting a second approver, such as opening a description, lifting a restriction or granting
 * an inheritance exception. A different authorised person approves or rejects each one with a reason. A second tab
 * lists embargoes past their date and expired restrictions awaiting review. Making access stricter never appears
 * here, because it applies immediately.
 *
 * @returns {JSX.Element}
 */
export default function AccessRequestsPage() {
  const { can, user } = useCan();
  const [p, set] = useQueryParams({ tab: 'pending' });
  const [decide, setDecide] = useState(null);
  const reqs = useApi(
    'access-requests',
    '/permissions/requests',
    { status: p.tab === 'pending' ? 'pending' : undefined, pageSize: 100 },
    { enabled: p.tab !== 'review' },
  );
  const review = useApi('access-review', '/permissions/review-queue', null, { enabled: p.tab === 'review' });
  const act = useApiMutation(
    ({ id, decision, reason }) => post(`/permissions/requests/${id}/decision`, { decision, reason }),
    {
      success: (_, v) => `Request ${v.decision === 'approve' ? 'approved' : 'rejected'}`,
      invalidate: ['access-requests'],
      onSuccess: () => setDecide(null),
    },
  );
  return (
    <div>
      <PageHeader
        title="Access approvals"
        description="Changes that make material more accessible need a second, different authorised person. Tightening applies immediately."
      />
      <Tabs
        className="mb-4"
        value={p.tab}
        onChange={(tab) => set({ tab })}
        tabs={[
          { value: 'pending', label: 'Pending' },
          { value: 'all', label: 'All decisions' },
          { value: 'review', label: 'Embargo review' },
        ]}
      />
      {p.tab !== 'review' ? (
        <Card>
          <ul className="divide-y divide-line">
            {reqs.data?.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {humanize(r.changeType)}: {r.fromLevel && `${humanize(r.fromLevel)} → `}
                    {r.toLevel ? humanize(r.toLevel) : 'lift'} <StatusBadge status={r.status} />
                  </p>
                  {r.target && (
                    <Link className="text-brand-700 hover:underline" to={`/admin/records/${r.target.id}`}>
                      {r.target.referenceCode} — {r.target.title}
                    </Link>
                  )}
                  <p className="mt-1">{r.reason}</p>
                  <p className="text-xs text-ink-soft">
                    Requested by {r.requestedBy?.fullName}, {fmtDateTime(r.createdAt)}
                    {r.decidedBy && ` · decided by ${r.decidedBy.fullName}: ${r.decisionReason}`}
                  </p>
                </div>
                {r.status === 'pending' &&
                  can('permissions.approve') &&
                  (r.requestedById === user.id ? (
                    <Badge>Awaiting another approver</Badge>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setDecide({ id: r.id, decision: 'reject' })}>
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => setDecide({ id: r.id, decision: 'approve' })}>
                        Approve
                      </Button>
                    </div>
                  ))}
              </li>
            ))}
          </ul>
          {reqs.data && !reqs.data.data.length && <EmptyState title="No access requests" />}
        </Card>
      ) : (
        <div className="space-y-6">
          <Alert tone="info">
            Expired embargoes are flagged for review. They are not opened automatically unless the configured policy
            allows it.
          </Alert>
          <Card>
            <CardHeader title="Embargoed descriptions past their date" />
            <ul className="divide-y divide-line">
              {review.data?.data.embargoes.map((e) => (
                <li key={e.id}>
                  <Link to={`/admin/records/${e.id}`} className="block px-5 py-2.5 text-sm hover:bg-canvas">
                    {e.referenceCode} — {e.title}{' '}
                    <span className="text-ink-soft">(until {fmtDate(e.embargoUntil)})</span>
                  </Link>
                </li>
              ))}
            </ul>
            {review.data && !review.data.data.embargoes.length && <EmptyState title="None due" />}
          </Card>
          <Card>
            <CardHeader title="Expired restrictions awaiting review" />
            <ul className="divide-y divide-line">
              {review.data?.data.restrictions.map((r) => (
                <li key={r.id}>
                  <Link to={`/admin/records/${r.targetId}`} className="block px-5 py-2.5 text-sm hover:bg-canvas">
                    {humanize(r.restrictionType)} expired {fmtDate(r.expiresAt)} — {r.legalBasis}
                  </Link>
                </li>
              ))}
            </ul>
            {review.data && !review.data.data.restrictions.length && <EmptyState title="None due" />}
          </Card>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(decide)}
        onClose={() => setDecide(null)}
        title={decide?.decision === 'approve' ? 'Approve access change' : 'Reject access change'}
        tone={decide?.decision === 'approve' ? 'primary' : 'danger'}
        requireReason
        loading={act.isPending}
        onConfirm={({ reason }) => act.mutate({ ...decide, reason })}
      />
    </div>
  );
}
