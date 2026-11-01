/**
 * Appraisal case detail page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileBarChart, Gavel, Ban } from 'lucide-react';
import { useApi, useApiMutation, post } from '../../lib/query.js';
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
import { fmtDate, fmtDateTime, humanize } from '../../utils/format.js';

const LABELS = {
  start_review: 'Start review',
  place_on_hold: 'Place on hold',
  release_hold: 'Release hold',
  recommend: 'Record recommendation',
  request_approval: 'Request approval',
  approve: 'Approve',
  reject: 'Reject',
  close: 'Close',
};
const TONE = {
  eligible: 'green',
  blocked_legal_hold: 'red',
  blocked_permanent: 'gold',
  blocked_active_request: 'amber',
  blocked_restriction: 'amber',
  excluded: 'neutral',
};

/**
 * Shows a case with each item's current eligibility (legal holds, permanent status and active requests are
 * re-checked each time the case moves), the report, the history and any disposal cases. It offers the workflow
 * actions the user may take: start review, record a recommendation with rationale, request approval, approve or
 * reject with a reason, place on or release from hold. Users may also exclude an item with a reason, refresh the
 * report, and create a disposal case from an approved recommendation.
 *
 * @returns {JSX.Element}
 */
export default function AppraisalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useCan();
  const [action, setAction] = useState(null);
  const [rec, setRec] = useState({ recommendation: 'retain_permanent', rationale: '' });
  const [disposal, setDisposal] = useState(null);
  const [exclude, setExclude] = useState(null);
  const { data, isLoading, error, refetch } = useApi(['appraisal', id], `/appraisal/cases/${id}`);
  const inval = [['appraisal', id], 'appraisal-cases'];
  const act = useApiMutation((b) => post(`/appraisal/cases/${id}/transition`, b), {
    success: 'Updated',
    invalidate: inval,
    onSuccess: () => setAction(null),
  });
  const report = useApiMutation(() => post(`/appraisal/cases/${id}/report`, {}), {
    success: 'Appraisal report generated',
    invalidate: inval,
  });
  const createDisposal = useApiMutation((b) => post('/disposal/cases', b), {
    success: 'Disposal case created with dry run',
    onSuccess: (r) => navigate(`/admin/disposal/${r.data.id}`),
  });
  const doExclude = useApiMutation(
    ({ itemId, reason }) => post(`/appraisal/cases/${id}/items/${itemId}/exclude`, { reason }),
    { success: 'Item excluded', invalidate: inval, onSuccess: () => setExclude(null) },
  );
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const c = data.data;
  const rs = c.reportSummary;
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Appraisal', to: '/admin/appraisal' }, { label: c.caseNumber }]}
        eyebrow={c.caseNumber}
        title={c.title}
        meta={
          <>
            <StatusBadge status={c.status} />
            <span className="text-sm text-ink-soft">Recommendation: {humanize(c.recommendation)}</span>
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={FileBarChart}
              loading={report.isPending}
              onClick={() => report.mutate()}
            >
              Generate report
            </Button>
            {c.availableActions.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === 'reject' ? 'danger' : ['place_on_hold', 'close'].includes(a) ? 'secondary' : 'primary'}
                onClick={() => setAction(a)}
              >
                {LABELS[a]}
              </Button>
            ))}
            {c.status === 'approved' &&
              ['dispose', 'return_to_department', 'transfer_to_archives'].includes(c.recommendation) &&
              can('appraisal.create') && (
                <Button size="sm" icon={Gavel} onClick={() => setDisposal('destroy_physical')}>
                  Create disposal case
                </Button>
              )}
          </>
        }
      />
      <Alert tone="info" className="mb-4">
        An elapsed retention period is never sufficient on its own. Disposal requires this appraisal's approval, a dry
        run, distinct approvals and a typed confirmation.
      </Alert>
      {c.status === 'on_hold' && (
        <Alert tone="warning" className="mb-4" title="On hold">
          {c.holdReason}
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Items and eligibility"
              description="Checked against legal holds, permanent status and active requests each time the case moves"
            />
            <ul className="divide-y divide-line">
              {c.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    {i.record && (
                      <Link className="hover:underline" to={`/admin/records/${i.record.id}`}>
                        <span className="text-xs text-gold-700">{i.record.referenceCode}</span>{' '}
                        <span className="font-semibold">{i.record.title}</span>
                      </Link>
                    )}
                    {i.physicalItem && (
                      <span>
                        {i.physicalItem.barcode} {i.physicalItem.title}
                      </span>
                    )}
                    {i.asset && <span>{i.asset.originalFilename}</span>}
                    {i.blockReason && <span className="block text-xs text-ink-soft">{i.blockReason}</span>}
                    {i.record && (
                      <span className="block text-xs text-ink-soft">
                        {i.record.isPermanent ? 'Permanent' : 'Not permanent'} · {humanize(i.record.custodyStatus)}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={TONE[i.eligibility]}>{humanize(i.eligibility)}</Badge>
                    {can('appraisal.create') &&
                      i.eligibility !== 'excluded' &&
                      !['approved', 'executed', 'closed'].includes(c.status) && (
                        <Button size="sm" variant="ghost" icon={Ban} onClick={() => setExclude(i.id)}>
                          Exclude
                        </Button>
                      )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="History" />
            <CardBody>
              <Timeline items={c.history} />
            </CardBody>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Case" />
            <CardBody>
              <MetaList
                columns={1}
                items={[
                  {
                    label: 'Schedule',
                    value:
                      c.schedule &&
                      `${c.schedule.code} — ${c.schedule.title} (${c.schedule.retentionYears ?? '—'} years, then ${humanize(c.schedule.finalAction)})`,
                  },
                  { label: 'Opened by', value: `${c.openedBy?.fullName}, ${fmtDate(c.createdAt)}` },
                  { label: 'Rationale', value: c.rationale },
                  {
                    label: 'Recommended by',
                    value: c.recommendedBy && `${c.recommendedBy.fullName}, ${fmtDate(c.recommendedAt)}`,
                  },
                  { label: 'Decided by', value: c.decidedBy && `${c.decidedBy.fullName}, ${fmtDate(c.decidedAt)}` },
                  { label: 'Decision note', value: c.decisionNote },
                ]}
              />
            </CardBody>
          </Card>
          {rs?.generatedAt && (
            <Card>
              <CardHeader title="Appraisal report" description={fmtDateTime(rs.generatedAt)} />
              <CardBody>
                <MetaList
                  columns={1}
                  items={Object.entries(rs.counts).map(([k, v]) => ({ label: humanize(k), value: v }))}
                />
              </CardBody>
            </Card>
          )}
          {c.disposalCases.length > 0 && (
            <Card>
              <CardHeader title="Disposal cases" />
              <ul className="divide-y divide-line">
                {c.disposalCases.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/admin/disposal/${d.id}`}
                      className="flex justify-between px-5 py-2.5 text-sm hover:bg-canvas"
                    >
                      <span>
                        {d.caseNumber} · {humanize(d.action)}
                      </span>
                      <StatusBadge status={d.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
      {action === 'recommend' ? (
        <Dialog
          open
          onClose={() => setAction(null)}
          title="Record recommendation"
          footer={
            <>
              <Button variant="secondary" onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button
                loading={act.isPending}
                disabled={rec.rationale.trim().length < 5}
                onClick={() => act.mutate({ action: 'recommend', ...rec })}
              >
                Save recommendation
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Recommendation">
              <Select value={rec.recommendation} onChange={(e) => setRec({ ...rec, recommendation: e.target.value })}>
                {[
                  'retain_permanent',
                  'transfer_to_archives',
                  'extend_retention',
                  'dispose',
                  'return_to_department',
                ].map((r) => (
                  <option key={r} value={r}>
                    {humanize(r)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rationale" required>
              <Textarea
                rows={5}
                value={rec.rationale}
                onChange={(e) => setRec({ ...rec, rationale: e.target.value })}
              />
            </Field>
          </div>
        </Dialog>
      ) : (
        <ConfirmDialog
          open={Boolean(action)}
          onClose={() => setAction(null)}
          title={LABELS[action]}
          loading={act.isPending}
          tone={action === 'reject' ? 'danger' : 'primary'}
          requireReason={['approve', 'reject', 'place_on_hold'].includes(action) ? true : 'optional'}
          onConfirm={({ reason }) => act.mutate({ action, reason })}
        />
      )}
      <Dialog
        open={Boolean(disposal)}
        onClose={() => setDisposal(null)}
        title="Create disposal case"
        description="A dry run lists exactly what would be affected. Nothing happens until it is approved and executed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDisposal(null)}>
              Cancel
            </Button>
            <Button
              loading={createDisposal.isPending}
              onClick={() => createDisposal.mutate({ appraisalCaseId: c.id, action: disposal })}
            >
              Create with dry run
            </Button>
          </>
        }
      >
        <Field label="Action">
          <Select value={disposal || ''} onChange={(e) => setDisposal(e.target.value)}>
            {['destroy_physical', 'delete_digital', 'transfer_external', 'return_to_department'].map((a) => (
              <option key={a} value={a}>
                {humanize(a)}
              </option>
            ))}
          </Select>
        </Field>
      </Dialog>
      <ConfirmDialog
        open={Boolean(exclude)}
        onClose={() => setExclude(null)}
        title="Exclude this item from the case?"
        requireReason
        loading={doExclude.isPending}
        onConfirm={({ reason }) => doExclude.mutate({ itemId: exclude, reason })}
      />
    </div>
  );
}
