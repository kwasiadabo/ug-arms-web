/**
 * Side-by-side OCR review page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCheck, Save, History, RefreshCw } from 'lucide-react';
import { useApi, useApiMutation, post, put } from '../../lib/query.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { AssetViewer } from '../../components/viewer/AssetViewer.jsx';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  PageLoader,
  ErrorState,
  Alert,
  Textarea,
  Dialog,
  StatusBadge,
  EmptyState,
} from '../../components/ui/index.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { fmtDateTime } from '../../utils/format.js';

/**
 * Shows a file's pages next to their extracted text with the confidence for each page. The reviewer corrects the
 * text and saves it as a new revision, optionally approving it for search; can approve every page at once; can view
 * earlier revisions; and can run OCR again. A failed OCR attempt is explained. OCR is not an authoritative
 * transcription.
 *
 * @returns {JSX.Element}
 */
export default function OcrReviewPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useApi(['ocr-asset', id], `/ocr/assets/${id}`);
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [revOpen, setRevOpen] = useState(false);
  const pages = data?.data.pages || [];
  const page = pages[idx];
  useEffect(() => {
    setText(page?.text || '');
  }, [page]);
  const dirty = page && text !== (page.text || '');
  useUnsavedChanges(dirty);
  const inval = [['ocr-asset', id], 'ocr-queue'];
  const save = useApiMutation(({ approve }) => put(`/ocr/pages/${page.id}`, { text, approve }), {
    success: (_, v) => (v.approve ? 'Saved and approved for search' : 'Correction saved as a new revision'),
    invalidate: inval,
  });
  const approveAll = useApiMutation(() => post(`/ocr/assets/${id}/approve`, {}), {
    success: (r) => `${r.data.approved} page(s) approved for search`,
    invalidate: inval,
  });
  const rerun = useApiMutation(
    () => post(`/digital-assets/${id}/ocr`, { language: data.data.job?.language || 'eng' }),
    { success: 'OCR queued again', invalidate: inval },
  );
  const revisions = useApi(['ocr-revisions', page?.id], page ? `/ocr/pages/${page.id}/revisions` : null, null, {
    enabled: revOpen && Boolean(page),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { asset, job, jobs } = data.data;
  const lastJob = jobs[0];
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'OCR review', to: '/admin/ocr' }, { label: asset.originalFilename }]}
        title={asset.originalFilename}
        meta={
          job && (
            <>
              <Badge tone="blue">
                {job.engine} {job.engineVersion && `· ${job.engineVersion}`}
              </Badge>
              <span className="text-sm text-ink-soft">
                Language {job.language} · mean confidence{' '}
                {job.meanConfidence ? `${Number(job.meanConfidence).toFixed(0)}%` : 'n/a'}
              </span>
            </>
          )
        }
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              loading={rerun.isPending}
              onClick={() => rerun.mutate()}
            >
              Run OCR again
            </Button>
            {pages.length > 0 && (
              <Button size="sm" icon={CheckCheck} loading={approveAll.isPending} onClick={() => approveAll.mutate()}>
                Approve all pages
              </Button>
            )}
          </>
        }
      />
      {lastJob?.status === 'failed' && (
        <Alert tone="danger" className="mb-4" title="The last OCR attempt failed">
          {lastJob.error} The original file is unaffected.
        </Alert>
      )}
      {!pages.length ? (
        <EmptyState
          title="No OCR output yet"
          description={lastJob ? `Latest job: ${lastJob.status}` : 'Queue OCR from the asset page.'}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={ChevronLeft}
              disabled={idx === 0}
              onClick={() => setIdx(idx - 1)}
              aria-label="Previous page"
            />
            <span className="text-sm">
              Page {page.pageNumber} of {pages.length}
            </span>
            <Button
              size="sm"
              variant="secondary"
              icon={ChevronRight}
              disabled={idx >= pages.length - 1}
              onClick={() => setIdx(idx + 1)}
              aria-label="Next page"
            />
            {page.confidence !== null && (
              <Badge tone={page.needsReview ? 'amber' : 'green'}>
                Confidence {Number(page.confidence).toFixed(0)}%{page.needsReview ? ' · needs review' : ''}
              </Badge>
            )}
            <StatusBadge status={page.reviewStatus} />
            {page.approvedForSearch && <Badge tone="green">Searchable</Badge>}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Original" />
              <CardBody>
                <AssetViewer
                  asset={{
                    id: asset.previewAssetId,
                    mediaType: asset.previewAssetId === asset.id ? asset.mediaType : 'image/jpeg',
                    originalFilename: asset.originalFilename,
                  }}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Extracted text"
                description={`Revision ${page.currentRevision}`}
                actions={
                  <Button size="sm" variant="ghost" icon={History} onClick={() => setRevOpen(true)}>
                    Revisions
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                <Textarea
                  aria-label="OCR text"
                  rows={22}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="font-mono text-[13px]"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    icon={Save}
                    disabled={!dirty}
                    loading={save.isPending}
                    onClick={() => save.mutate({ approve: false })}
                  >
                    Save correction
                  </Button>
                  <Button icon={CheckCheck} loading={save.isPending} onClick={() => save.mutate({ approve: true })}>
                    Save and approve
                  </Button>
                </div>
                <p className="text-xs text-ink-soft">
                  OCR is not an authoritative transcription. Earlier revisions are always kept.
                </p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
      <Dialog
        open={revOpen}
        onClose={() => setRevOpen(false)}
        size="lg"
        title={`Revisions of page ${page?.pageNumber}`}
      >
        <ul className="space-y-3">
          {revisions.data?.data.map((r) => (
            <li key={r.id} className="rounded-lg border border-line p-3 text-sm">
              <p className="text-xs font-semibold text-ink-soft">
                Revision {r.revision} · {r.source === 'engine' ? 'OCR engine' : r.editedBy?.fullName} ·{' '}
                {fmtDateTime(r.createdAt)}
              </p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">{r.text}</pre>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
