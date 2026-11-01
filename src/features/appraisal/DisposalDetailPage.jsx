/**
 * Disposal case detail page with the dry run, the approvals and execution.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw, ShieldCheck, Flame, FileDown, AlertOctagon } from 'lucide-react';
import { download } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Timeline } from '../../components/feedback/Timeline.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusBadge,
  Badge,
  PageLoader,
  ErrorState,
  Alert,
  ConfirmDialog,
} from '../../components/ui/index.js';
import { fmtBytes, fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Shows exactly what the disposal would affect (the dry run and its fingerprint), what is excluded and why, the
 * approvals given and the required number, the history, and the certificate once executed. Approvers who are not
 * the case author and have not yet approved can approve the exact list shown. Execution requires typing the case
 * number; eligibility is re-checked first, and any new legal hold blocks the case without destroying anything.
 * If some stored files could not be destroyed after execution, the page says so and offers a retry.
 *
 * @returns {JSX.Element}
 */
export default function DisposalDetailPage() {
  const { id } = useParams();
  const { can, user } = useCan();
  const [approveOpen, setApproveOpen] = useState(false);
  const [execOpen, setExecOpen] = useState(false);
  const { data, isLoading, error, refetch } = useApi(['disposal', id], `/disposal/cases/${id}`);
  const inval = [['disposal', id], 'disposal-cases'];
  const dryRun = useApiMutation(() => post(`/disposal/cases/${id}/dry-run`, {}), {
    success: 'Dry run regenerated',
    invalidate: inval,
  });
  const request = useApiMutation(() => post(`/disposal/cases/${id}/request-approval`, {}), {
    success: 'Sent for approval',
    invalidate: inval,
  });
  const approve = useApiMutation(
    ({ reason }) =>
      post(`/disposal/cases/${id}/approve`, { fingerprint: data.data.dryRunSnapshot.fingerprint, reason }),
    {
      success: (r) => `Approval recorded (${r.data.approvals}/${r.data.required})`,
      invalidate: inval,
      onSuccess: () => setApproveOpen(false),
    },
  );
  const execute = useApiMutation(() => post(`/disposal/cases/${id}/execute`, { confirmation: data.data.caseNumber }), {
    success: (r) =>
      r.data.destruction?.failed
        ? `Disposal executed; ${r.data.destruction.failed} stored file(s) could not be destroyed`
        : 'Disposal executed and certificate issued',
    invalidate: inval,
    onSuccess: () => setExecOpen(false),
  });
  const destroyFiles = useApiMutation(() => post(`/disposal/cases/${id}/destroy-files`, {}), {
    success: (r) =>
      r.data.failed ? `${r.data.failed} file(s) still could not be destroyed` : 'All stored files destroyed',
    invalidate: inval,
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  const dr = d.dryRunSnapshot || { targets: [], blocked: [] };
  const current = d.approvals.filter((a) => a.current);
  const iApproved = current.some((a) => a.approverId === user.id);
  const operational = dr.targets.filter((t) => t.type !== 'description_note');
  const destruction = d.executionResult?.destruction;
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Disposal', to: '/admin/disposal' }, { label: d.caseNumber }]}
        eyebrow={`${d.caseNumber} · ${humanize(d.action)}`}
        title={`Disposal for ${d.appraisalCase.caseNumber}`}
        meta={
          <>
            <StatusBadge status={d.status} />
            <span className="text-sm text-ink-soft">
              {current.length}/{d.requiredApprovals} approvals on the current dry run
            </span>
          </>
        }
        actions={
          <>
            {['draft', 'pending_approval'].includes(d.status) && can('appraisal.create') && (
              <Button
                size="sm"
                variant="secondary"
                icon={RefreshCw}
                loading={dryRun.isPending}
                onClick={() => dryRun.mutate()}
              >
                Regenerate dry run
              </Button>
            )}
            {d.status === 'draft' && can('appraisal.create') && (
              <Button size="sm" loading={request.isPending} onClick={() => request.mutate()}>
                Request approval
              </Button>
            )}
            {d.status === 'pending_approval' && can('disposal.approve') && !iApproved && d.createdById !== user.id && (
              <Button size="sm" icon={ShieldCheck} onClick={() => setApproveOpen(true)}>
                Approve this dry run
              </Button>
            )}
            {d.status === 'approved' && can('disposal.execute') && (
              <Button size="sm" variant="danger" icon={Flame} onClick={() => setExecOpen(true)}>
                Execute
              </Button>
            )}
            {d.certificates.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant="secondary"
                icon={FileDown}
                onClick={() => download(`/disposal/certificates/${c.id}/pdf`)}
              >
                Certificate {c.certificateNumber}
              </Button>
            ))}
          </>
        }
      />
      {d.status === 'blocked' && (
        <Alert tone="danger" icon={AlertOctagon} className="mb-4" title="Blocked">
          {d.blockReason}
        </Alert>
      )}
      {d.status === 'executed' && (
        <Alert tone="success" className="mb-4" title="Executed">
          Executed {fmtDateTime(d.executedAt)} by {d.executedBy?.fullName}. The certificate and audit evidence are
          retained permanently.
          {destruction?.files > 0 && !destruction.failed && ` All ${destruction.files} stored file(s) were destroyed.`}
        </Alert>
      )}
      {d.status === 'executed' && destruction?.failed > 0 && (
        <Alert tone="danger" icon={AlertOctagon} className="mb-4" title="Stored files not destroyed">
          <p>
            {destruction.failed} of {destruction.files} stored file(s) could not be destroyed. The records are disposed
            of, but the content is still in storage. This happens when the storage service is unavailable, no disposal
            storage credential is configured, or a legal hold was placed on the files after execution.
          </p>
          {can('disposal.execute') && (
            <Button
              size="sm"
              variant="danger"
              icon={Flame}
              className="mt-3"
              loading={destroyFiles.isPending}
              onClick={() => destroyFiles.mutate()}
            >
              Retry file destruction
            </Button>
          )}
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Dry run: exactly what will be affected"
              description={`Generated ${fmtDateTime(d.dryRunAt)} · fingerprint ${dr.fingerprint?.slice(0, 16)}…`}
            />
            <ul className="divide-y divide-line">
              {dr.targets.map((t) => (
                <li
                  key={`${t.type}-${t.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <Badge tone={t.type === 'description_note' ? 'neutral' : 'red'}>{humanize(t.type)}</Badge>{' '}
                    <span className="font-medium">{t.label}</span>
                    {t.sha256 && (
                      <span className="block font-mono text-[11px] text-ink-soft">
                        SHA-256 {t.sha256} · {fmtBytes(t.sizeBytes)}
                      </span>
                    )}
                    {t.effect && <span className="block text-xs text-ink-soft">{t.effect}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {!operational.length && (
              <CardBody className="text-sm text-ink-soft">Nothing is currently eligible for this action.</CardBody>
            )}
          </Card>
          {dr.blocked?.length > 0 && (
            <Card>
              <CardHeader title="Excluded from this action" description="Blocked items are never touched" />
              <ul className="divide-y divide-line">
                {dr.blocked.map((b) => (
                  <li key={b.caseItemId} className="px-5 py-2.5 text-sm">
                    <Badge tone="amber">{humanize(b.eligibility)}</Badge> {b.reason}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="History" />
            <CardBody>
              <Timeline items={d.history} />
            </CardBody>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader
              title="Approvals"
              description={`${d.requiredApprovals} distinct approvers required, excluding the case author`}
            />
            <ul className="divide-y divide-line">
              {d.approvals.map((a) => (
                <li key={a.id} className="px-5 py-2.5 text-sm">
                  <span className="font-semibold">{a.approver?.fullName}</span>{' '}
                  {a.current ? <Badge tone="green">Current dry run</Badge> : <Badge>Superseded dry run</Badge>}
                  <span className="block text-xs text-ink-soft">
                    {fmtDateTime(a.createdAt)}
                    {a.reason ? ` — ${a.reason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            {!d.approvals.length && <CardBody className="text-sm text-ink-soft">No approvals yet.</CardBody>}
          </Card>
          <Card>
            <CardBody className="text-sm">
              <p className="font-semibold">Appraisal</p>
              <Link className="text-brand-700 hover:underline" to={`/admin/appraisal/${d.appraisalCase.id}`}>
                {d.appraisalCase.caseNumber} — {d.appraisalCase.title}
              </Link>
              <p className="mt-1 text-ink-soft">{d.appraisalCase.rationale}</p>
            </CardBody>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve this disposal"
        description="You are approving the exact list shown. If the list changes, approvals must be given again."
        requireReason="optional"
        confirmLabel="Approve"
        loading={approve.isPending}
        onConfirm={({ reason }) => approve.mutate({ reason })}
      />
      <ConfirmDialog
        open={execOpen}
        onClose={() => setExecOpen(false)}
        tone="danger"
        title="Execute irreversible disposal"
        confirmText={d.caseNumber}
        confirmLabel="Execute disposal"
        loading={execute.isPending}
        description={`This will ${humanize(d.action).toLowerCase()} ${operational.length} target(s). Eligibility is re-checked first; any new legal hold blocks the case.`}
        onConfirm={() => execute.mutate()}
      />
    </div>
  );
}
