/**
 * Digitisation project detail page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
  PageLoader,
  ErrorState,
  Dialog,
  Field,
  Input,
  Checkbox,
  ConfirmDialog,
  Alert,
} from '../../components/ui/index.js';
import { UserPicker } from '../archival-records/Pickers.jsx';
import { Progress } from './DigitisationPage.jsx';
import { fmtDate, humanize } from '../../utils/format.js';

/**
 * Shows a project and its batches. Authorised users can move the project through its statuses (approval requires an
 * approver other than the proposer) and, once it is approved or active, create a batch with the capture
 * specification and an assigned operator, who is notified.
 *
 * @returns {JSX.Element}
 */
export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useCan();
  const [status, setStatus] = useState(null);
  const [batch, setBatch] = useState(null);
  const { data, isLoading, error, refetch } = useApi(['dig-project', id], `/digitisation/projects/${id}`);
  const change = useApiMutation((b) => post(`/digitisation/projects/${id}/status`, b), {
    success: 'Project updated',
    invalidate: [['dig-project', id]],
    onSuccess: () => setStatus(null),
  });
  const create = useApiMutation((b) => post(`/digitisation/projects/${id}/batches`, b), {
    success: 'Batch created',
    onSuccess: (r) => navigate(`/admin/digitisation/batches/${r.data.id}`),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const p = data.data;
  const next =
    { proposed: ['approved', 'cancelled'], approved: ['active', 'cancelled'], active: ['completed', 'cancelled'] }[
      p.status
    ] || [];
  const q = p.qualityProfile;
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Digitisation', to: '/admin/digitisation?tab=projects' }, { label: p.code }]}
        eyebrow={p.code}
        title={p.title}
        meta={
          <>
            <StatusBadge status={p.status} />
            <span className="text-sm text-ink-soft">Priority {humanize(p.priority)}</span>
          </>
        }
        actions={
          <>
            {next.map(
              (s) =>
                (s !== 'approved' || can('records.approve') || can('digitisation.manage')) && (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === 'cancelled' ? 'ghost' : 'primary'}
                    onClick={() => setStatus(s)}
                  >
                    {s === 'approved'
                      ? 'Approve project'
                      : s === 'active'
                        ? 'Mark active'
                        : s === 'completed'
                          ? 'Complete'
                          : 'Cancel'}
                  </Button>
                ),
            )}
            {['approved', 'active'].includes(p.status) && can('digitisation.manage') && (
              <Button
                size="sm"
                icon={Plus}
                onClick={() =>
                  setBatch({
                    resolutionDpi: q?.minResolutionDpi || 300,
                    colourProfile: q?.colourMode || '',
                    captureDevice: '',
                    fileNamingPattern: `${p.code.replace(/\W+/g, '_')}_{seq:4}`,
                    ocrEnabled: true,
                    ocrLanguage: 'eng',
                  })
                }
              >
                New batch
              </Button>
            )}
          </>
        }
      />
      {p.status === 'proposed' && (
        <Alert tone="info" className="mb-4">
          This project awaits approval. The approver must be someone other than the person who proposed it.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Batches" />
          <ul className="divide-y divide-line">
            {p.batches.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/admin/digitisation/batches/${b.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-canvas"
                >
                  <span>
                    <span className="font-mono text-xs text-gold-700">{b.batchNumber}</span>
                    <span className="block text-sm">
                      {b.operator?.fullName || 'No operator assigned'} · {b.progress.items} items
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Progress value={b.progress.percentComplete} />
                    <StatusBadge status={b.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {!p.batches.length && <CardBody className="text-sm text-ink-soft">No batches yet.</CardBody>}
        </Card>
        <Card>
          <CardHeader title="Project" />
          <CardBody>
            <MetaList
              columns={1}
              items={[
                {
                  label: 'Source',
                  value: p.sourceRecord && (
                    <Link className="text-brand-700 hover:underline" to={`/admin/records/${p.sourceRecord.id}`}>
                      {p.sourceRecord.referenceCode} — {p.sourceRecord.title}
                    </Link>
                  ),
                },
                {
                  label: 'Quality profile',
                  value:
                    q &&
                    `${q.name}: ${q.minResolutionDpi} dpi, ${q.colourMode || ''}${q.bitDepth ? `, ${q.bitDepth}-bit` : ''}, master ${q.masterFormat}, access ${q.accessFormat}`,
                },
                { label: 'Description', value: p.description },
                { label: 'Start', value: fmtDate(p.startDate) },
                { label: 'Target', value: fmtDate(p.targetDate) },
                { label: 'Approved by', value: p.approvedBy && `${p.approvedBy.fullName}, ${fmtDate(p.approvedAt)}` },
              ]}
            />
          </CardBody>
        </Card>
      </div>
      <ConfirmDialog
        open={Boolean(status)}
        onClose={() => setStatus(null)}
        title={`Change status to ${humanize(status)}?`}
        requireReason="optional"
        loading={change.isPending}
        onConfirm={({ reason }) => change.mutate({ status, reason })}
      />
      <Dialog
        open={Boolean(batch)}
        onClose={() => setBatch(null)}
        size="lg"
        title="New batch"
        description="Record the capture specification. The operator is notified."
        footer={
          <>
            <Button variant="secondary" onClick={() => setBatch(null)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              onClick={() =>
                create.mutate({
                  ...batch,
                  operatorLabel: undefined,
                  resolutionDpi: Number(batch.resolutionDpi) || undefined,
                  colourProfile: batch.colourProfile || undefined,
                  captureDevice: batch.captureDevice || undefined,
                })
              }
            >
              Create batch
            </Button>
          </>
        }
      >
        {batch && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mb-1 text-[13px] font-semibold">
                Scanning operator {batch.operatorLabel && <span className="font-normal">— {batch.operatorLabel}</span>}
              </p>
              <UserPicker
                permission="digitisation.capture"
                onPick={(u) => setBatch({ ...batch, operatorId: u.id, operatorLabel: u.label })}
              />
            </div>
            <Field label="Capture device">
              <Input
                value={batch.captureDevice}
                onChange={(e) => setBatch({ ...batch, captureDevice: e.target.value })}
                placeholder="Scanner or camera model"
              />
            </Field>
            <Field label="Resolution (dpi)">
              <Input
                type="number"
                value={batch.resolutionDpi}
                onChange={(e) => setBatch({ ...batch, resolutionDpi: e.target.value })}
              />
            </Field>
            <Field label="Colour profile">
              <Input
                value={batch.colourProfile}
                onChange={(e) => setBatch({ ...batch, colourProfile: e.target.value })}
                placeholder="Adobe RGB (1998)"
              />
            </Field>
            <Field label="File naming pattern">
              <Input
                value={batch.fileNamingPattern}
                onChange={(e) => setBatch({ ...batch, fileNamingPattern: e.target.value })}
              />
            </Field>
            <Checkbox
              className="sm:col-span-2"
              label="Run OCR on captured images"
              checked={batch.ocrEnabled}
              onChange={(e) => setBatch({ ...batch, ocrEnabled: e.target.checked })}
            />
            {batch.ocrEnabled && (
              <Field label="OCR language" help="Tesseract language code, e.g. eng">
                <Input
                  value={batch.ocrLanguage}
                  onChange={(e) => setBatch({ ...batch, ocrLanguage: e.target.value })}
                />
              </Field>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
