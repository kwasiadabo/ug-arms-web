/**
 * Digitisation batch detail page: capture, upload, processing and quality review.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Upload, CheckCircle2, XCircle, RotateCcw, SkipForward } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Timeline } from '../../components/feedback/Timeline.jsx';
import {
  Card,
  CardBody,
  MetaList,
  Button,
  StatusBadge,
  Badge,
  PageLoader,
  ErrorState,
  Dialog,
  Field,
  Input,
  Textarea,
  ConfirmDialog,
  Alert,
  Tabs,
  Checkbox,
} from '../../components/ui/index.js';
import { RecordPicker } from '../archival-records/Pickers.jsx';
import { Progress } from './DigitisationPage.jsx';
import { UploadProgress } from '../../components/forms/UploadProgress.jsx';
import { humanize, fmtDateTime } from '../../utils/format.js';

const CHECKS = ['completeness', 'orientation', 'pageOrder', 'colour', 'resolution', 'focus', 'fileNaming'];
const LABELS = {
  start: 'Start capture',
  submit_capture: 'Submit capture',
  processing_complete: 'Processing complete',
  request_rework: 'Request rework',
  approve: 'Approve batch',
  complete: 'Complete',
  fail: 'Mark failed',
};

/**
 * One item in a batch: its expected and captured pages, the uploaded master files with their processing, OCR and
 * quality status, and the actions for the current stage. Operators upload files and mark the item captured or
 * skipped; reviewers open the quality review.
 *
 * @param {object} props
 * @param {object} props.item The batch item.
 * @param {object} props.batch The batch.
 * @param {boolean} props.canCapture Whether the user may capture.
 * @param {boolean} props.canQa Whether the user may review this batch.
 * @param {(item: object) => void} props.onReview Opens the quality review for the item.
 * @returns {JSX.Element}
 */
function ItemRow({ item, batch, canCapture, canQa, onReview }) {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null);
  const inval = [['dig-batch', batch.id]];
  const upload = useApiMutation(
    () => {
      const fd = new FormData();
      if (item.recordId) fd.append('recordId', item.recordId);
      if (item.physicalItemId) fd.append('physicalItemId', item.physicalItemId);
      fd.append('digitisationItemId', item.id);
      files.forEach((f) => fd.append('files', f));
      setProgress(0);
      return api
        .post('/digital-assets', fd, {
          headers: { 'Idempotency-Key': `${item.id}-${files.map((f) => `${f.name}:${f.size}`).join('|')}` },
          timeout: 0,
          onUploadProgress: (e) => setProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null),
        })
        .then((r) => r.data)
        .finally(() => setProgress(null));
    },
    {
      success: (r) =>
        `${r.data.length} file(s) uploaded${r.meta.rejected?.length ? `; ${r.meta.rejected.length} rejected: ${r.meta.rejected[0].error}` : ''}`,
      invalidate: inval,
      onSuccess: () => setFiles([]),
    },
  );
  const captured = useApiMutation((b) => post(`/digitisation/items/${item.id}/captured`, b), {
    success: 'Item updated',
    invalidate: inval,
  });
  const capturing = ['in_progress', 'rework_required'].includes(batch.status);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {item.sequence}. {item.label}
          </p>
          <p className="text-xs text-ink-soft">
            {item.record ? (
              <Link className="hover:underline" to={`/admin/records/${item.record.id}`}>
                {item.record.referenceCode}
              </Link>
            ) : (
              'No description linked'
            )}
            {item.physicalItem && ` · ${item.physicalItem.barcode}`} · {item.capturedPages ?? 0}/
            {item.expectedPages ?? '?'} pages
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      {item.assets.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {item.assets
            .filter((a) => a.role === 'preservation_master')
            .map((a) => (
              <li key={a.id}>
                <Link
                  to={`/admin/assets/${a.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas"
                >
                  {a.originalFilename}
                  <StatusBadge status={a.status} />
                  {a.ocrStatus !== 'not_applicable' && <Badge tone="blue">OCR {humanize(a.ocrStatus)}</Badge>}
                  {a.qaStatus !== 'not_required' && (
                    <Badge tone={a.qaStatus === 'passed' ? 'green' : a.qaStatus === 'failed' ? 'red' : 'amber'}>
                      QA {a.qaStatus}
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canCapture && capturing && ['pending', 'rework', 'captured'].includes(item.status) && (
          <>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line px-3 text-[13px] hover:border-brand-300">
              <Upload className="h-4 w-4" />
              {files.length ? `${files.length} file(s)` : 'Choose master files'}
              <input
                type="file"
                multiple
                accept=".tif,.tiff,.jp2,.png,.jpg,.jpeg,.pdf"
                className="sr-only"
                onChange={(e) => setFiles([...e.target.files])}
              />
            </label>
            {files.length > 0 && (
              <Button size="sm" loading={upload.isPending} onClick={() => upload.mutate()}>
                Upload
              </Button>
            )}
            {item.status !== 'captured' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  captured.mutate({
                    capturedPages: item.assets
                      .filter((a) => a.role === 'preservation_master')
                      .reduce((n, a) => n + (a.pageCount || 1), 0),
                  })
                }
              >
                Mark captured
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={SkipForward}
              onClick={() => captured.mutate({ skip: true, notes: 'Skipped at capture' })}
            >
              Skip
            </Button>
          </>
        )}
        <div className="basis-full">
          <UploadProgress percent={progress} />
        </div>
        {canQa && batch.status === 'quality_review' && (
          <Button size="sm" variant="secondary" onClick={() => onReview(item)}>
            Quality review
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Shows a batch with its progress, items and history, and the workflow actions the user may take: start capture,
 * submit capture, mark processing complete, request rework (with a reason), approve, complete or fail. The capture
 * operator cannot review their own batch. Reviewers record a pass, fail or rework outcome per item, with comments
 * for failures.
 *
 * @returns {JSX.Element}
 */
export default function BatchDetailPage() {
  const { id } = useParams();
  const { can, user } = useCan();
  const [tab, setTab] = useState('items');
  const [action, setAction] = useState(null);
  const [adding, setAdding] = useState(null);
  const [review, setReview] = useState(null);
  const { data, isLoading, error, refetch } = useApi(['dig-batch', id], `/digitisation/batches/${id}`, null, {
    refetchInterval: (q) => (q.state.data?.data.progress.assetsProcessing ? 5000 : false),
  });
  const inval = [['dig-batch', id], 'digitisation-batches'];
  const act = useApiMutation((b) => post(`/digitisation/batches/${id}/transition`, b), {
    success: 'Batch updated',
    invalidate: inval,
    onSuccess: () => setAction(null),
  });
  const addItems = useApiMutation((items) => post(`/digitisation/batches/${id}/items`, { items }), {
    success: 'Items added',
    invalidate: inval,
    onSuccess: () => setAdding(null),
  });
  const doReview = useApiMutation((b) => post(`/digitisation/items/${review.id}/review`, b), {
    success: 'Review recorded',
    invalidate: inval,
    onSuccess: () => setReview(null),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const b = data.data;
  const pr = b.progress;
  const canCapture = can('digitisation.capture') || can('digitisation.manage');
  const canQa = can('digitisation.qa') && b.operatorId !== user.id;
  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Digitisation', to: '/admin/digitisation' },
          { label: b.project.code, to: `/admin/digitisation/projects/${b.project.id}` },
          { label: b.batchNumber },
        ]}
        eyebrow={b.batchNumber}
        title={b.project.title}
        meta={
          <>
            <StatusBadge status={b.status} />
            <Progress value={pr.percentComplete} />
          </>
        }
        actions={
          <>
            {b.availableActions.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === 'fail' ? 'ghost' : a === 'request_rework' ? 'secondary' : 'primary'}
                onClick={() => setAction(a)}
              >
                {LABELS[a]}
              </Button>
            ))}
            {['planned', 'in_progress', 'rework_required'].includes(b.status) && canCapture && (
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                onClick={() => setAdding({ label: '', expectedPages: '', recordId: '', recordLabel: '' })}
              >
                Add item
              </Button>
            )}
          </>
        }
      />
      {pr.assetsProcessing > 0 && (
        <Alert tone="info" className="mb-4">
          {pr.assetsProcessing} file(s) are being validated, checksummed and processed. This page refreshes
          automatically.
        </Alert>
      )}
      {pr.ocrFailed > 0 && (
        <Alert tone="warning" className="mb-4">
          {pr.ocrFailed} OCR job(s) failed. The files are stored safely; retry OCR from the asset page.
        </Alert>
      )}
      {b.status === 'quality_review' && !canQa && can('digitisation.qa') && (
        <Alert tone="info" className="mb-4">
          You captured this batch, so another reviewer must carry out quality assurance.
        </Alert>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ['Items', `${pr.captured}/${pr.items} captured`],
          ['QA passed', pr.qaPassed],
          ['QA failed / rework', pr.qaFailed],
          ['Pages', `${pr.capturedPages}/${pr.expectedPages || '?'}`],
        ].map(([l, v]) => (
          <Card key={l} className="p-4">
            <p className="text-xs font-semibold text-ink-soft">{l}</p>
            <p className="mt-1 text-xl font-extrabold">{v}</p>
          </Card>
        ))}
      </div>
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'items', label: 'Items', count: b.items.length },
          { value: 'reviews', label: 'QA reviews', count: b.reviews.length },
          { value: 'spec', label: 'Specification' },
          { value: 'history', label: 'History' },
        ]}
      />
      {tab === 'items' && (
        <Card>
          <ul className="divide-y divide-line">
            {b.items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                batch={b}
                canCapture={canCapture}
                canQa={canQa}
                onReview={(x) =>
                  setReview({
                    ...x,
                    outcome: 'pass',
                    comments: '',
                    checks: Object.fromEntries(CHECKS.map((c) => [c, true])),
                  })
                }
              />
            ))}
          </ul>
          {!b.items.length && (
            <CardBody className="text-sm text-ink-soft">
              Add the physical items or descriptions to be captured.
            </CardBody>
          )}
        </Card>
      )}
      {tab === 'reviews' && (
        <Card>
          <ul className="divide-y divide-line">
            {b.reviews.map((r) => (
              <li key={r.id} className="px-5 py-3 text-sm">
                <p className="font-semibold">
                  {r.outcome === 'pass' ? (
                    <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />
                  ) : r.outcome === 'fail' ? (
                    <XCircle className="mr-1 inline h-4 w-4 text-red-600" />
                  ) : (
                    <RotateCcw className="mr-1 inline h-4 w-4 text-amber-600" />
                  )}
                  {humanize(r.outcome)} — {b.items.find((i) => i.id === r.itemId)?.label}
                </p>
                <p className="text-ink-soft">
                  {r.reviewer?.fullName}, {fmtDateTime(r.createdAt)}
                </p>
                {r.comments && <p>{r.comments}</p>}
                <p className="text-xs text-ink-soft">
                  {Object.entries(r.checks || {})
                    .filter(([, v]) => v === false)
                    .map(([k]) => `${humanize(k)} failed`)
                    .join(', ')}
                </p>
              </li>
            ))}
          </ul>
          {!b.reviews.length && <CardBody className="text-sm text-ink-soft">No reviews yet.</CardBody>}
        </Card>
      )}
      {tab === 'spec' && (
        <Card>
          <CardBody>
            <MetaList
              items={[
                { label: 'Operator', value: b.operator?.fullName },
                { label: 'QA reviewer', value: b.qaReviewer?.fullName },
                { label: 'Capture device', value: b.captureDevice },
                { label: 'Resolution', value: b.resolutionDpi && `${b.resolutionDpi} dpi` },
                { label: 'Colour profile', value: b.colourProfile },
                { label: 'File naming', value: b.fileNamingPattern },
                { label: 'OCR', value: b.ocrEnabled ? `Enabled (${b.ocrLanguage})` : 'Disabled' },
                {
                  label: 'Quality profile',
                  value:
                    b.project.qualityProfile &&
                    `${b.project.qualityProfile.name}: min ${b.project.qualityProfile.minResolutionDpi} dpi`,
                },
                { label: 'Capture started', value: fmtDateTime(b.captureStartedAt) },
                { label: 'Notes', value: b.notes, wide: true },
              ]}
            />
          </CardBody>
        </Card>
      )}
      {tab === 'history' && (
        <Card>
          <CardBody>
            <Timeline items={b.history} />
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={LABELS[action]}
        loading={act.isPending}
        confirmLabel={LABELS[action]}
        tone={action === 'fail' ? 'danger' : 'primary'}
        requireReason={action === 'request_rework' ? true : 'optional'}
        onConfirm={({ reason }) => act.mutate({ action, reason })}
      />
      <Dialog
        open={Boolean(adding)}
        onClose={() => setAdding(null)}
        title="Add item to batch"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button
              disabled={!adding?.label}
              loading={addItems.isPending}
              onClick={() =>
                addItems.mutate([
                  {
                    label: adding.label,
                    recordId: adding.recordId || undefined,
                    expectedPages: adding.expectedPages ? Number(adding.expectedPages) : undefined,
                  },
                ])
              }
            >
              Add
            </Button>
          </>
        }
      >
        {adding && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[13px] font-semibold">
                Description {adding.recordLabel && <span className="font-normal">— {adding.recordLabel}</span>}
              </p>
              <RecordPicker
                onPick={(r) =>
                  setAdding({ ...adding, recordId: r.id, recordLabel: r.sub, label: adding.label || r.label })
                }
              />
            </div>
            <Field label="Label" required>
              <Input value={adding.label} onChange={(e) => setAdding({ ...adding, label: e.target.value })} />
            </Field>
            <Field label="Expected pages">
              <Input
                type="number"
                value={adding.expectedPages}
                onChange={(e) => setAdding({ ...adding, expectedPages: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
      <Dialog
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title={`Quality review: ${review?.label}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(null)}>
              Cancel
            </Button>
            <Button
              loading={doReview.isPending}
              variant={review?.outcome === 'pass' ? 'primary' : 'danger'}
              onClick={() =>
                doReview.mutate({
                  outcome: review.outcome,
                  checks: review.checks,
                  comments: review.comments || undefined,
                })
              }
            >
              Record {humanize(review?.outcome)}
            </Button>
          </>
        }
      >
        {review && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {CHECKS.map((c) => (
                <Checkbox
                  key={c}
                  label={humanize(c)}
                  checked={review.checks[c]}
                  onChange={(e) => {
                    const checks = { ...review.checks, [c]: e.target.checked };
                    setReview({
                      ...review,
                      checks,
                      outcome: Object.values(checks).every(Boolean)
                        ? review.outcome
                        : review.outcome === 'pass'
                          ? 'rework'
                          : review.outcome,
                    });
                  }}
                />
              ))}
            </div>
            <Field label="Outcome">
              <select
                className="h-10 w-full rounded-lg border border-line px-2"
                value={review.outcome}
                onChange={(e) => setReview({ ...review, outcome: e.target.value })}
              >
                <option value="pass">Pass</option>
                <option value="rework">Rework required</option>
                <option value="fail">Fail</option>
              </select>
            </Field>
            <Field label="Comments" required={review.outcome !== 'pass'}>
              <Textarea
                rows={3}
                value={review.comments}
                onChange={(e) => setReview({ ...review, comments: e.target.value })}
              />
            </Field>
            <p className="text-xs text-ink-soft">
              Rejected captures are never overwritten. Replacement files are uploaded as new assets and keep their own
              checksums.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
