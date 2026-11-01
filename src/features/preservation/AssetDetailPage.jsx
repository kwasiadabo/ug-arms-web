/**
 * Digital asset detail page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock, ShieldCheck, ScanText, Globe, EyeOff, Trash2, RefreshCw } from 'lucide-react';
import { useApi, useApiMutation, post, patch, del } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { AssetViewer } from '../../components/viewer/AssetViewer.jsx';
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
  Tabs,
  ConfirmDialog,
  Dialog,
  Field,
  Select,
  Input,
  Checkbox,
  EmptyState,
} from '../../components/ui/index.js';
import { fmtBytes, fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Shows a file with a preview of its access copy, its technical details, its derivatives, preservation events,
 * fixity checks and checksums. Depending on permissions, users can run a fixity check, run OCR, reprocess a failed
 * ingest, publish or withdraw access copies, delete a derivative with a reason, and change its rights and access
 * settings (a file can be stricter than its description but never more open). Files the user is not cleared to view
 * are described as restricted.
 *
 * @returns {JSX.Element}
 */
export default function AssetDetailPage() {
  const { id } = useParams();
  const { can } = useCan();
  const [tab, setTab] = useState('overview');
  const [confirm, setConfirm] = useState(null);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [rights, setRights] = useState({});
  const { data, isLoading, error, refetch } = useApi(['asset', id], `/digital-assets/${id}`, null, {
    refetchInterval: (q) => (['processing', 'uploaded'].includes(q.state.data?.data.status) ? 4000 : false),
  });
  const inval = [['asset', id], 'assets'];
  const publish = useApiMutation(
    ({ assetId, publish: pub, reason }) => post(`/digital-assets/${assetId}/publish`, { publish: pub, reason }),
    { success: 'Updated', invalidate: inval, onSuccess: () => setConfirm(null) },
  );
  const fixity = useApiMutation(() => post('/preservation/fixity', { assetIds: [id] }), {
    success: 'Fixity check queued',
    invalidate: inval,
  });
  const ocr = useApiMutation(() => post(`/digital-assets/${id}/ocr`, { language: 'eng' }), {
    success: 'OCR queued',
    invalidate: inval,
  });
  const reprocess = useApiMutation(() => post(`/digital-assets/${id}/reprocess`, {}), {
    success: 'Reprocessing queued',
    invalidate: inval,
  });
  const remove = useApiMutation(({ assetId, reason }) => del(`/digital-assets/${assetId}`, { reason }), {
    success: 'Asset deleted (metadata retained)',
    invalidate: inval,
    onSuccess: () => setConfirm(null),
  });
  const saveRights = useApiMutation((b) => patch(`/digital-assets/${id}`, b), {
    success: 'Saved',
    invalidate: inval,
    onSuccess: () => setRightsOpen(false),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const a = data.data;
  if (a.restricted)
    return (
      <EmptyState
        icon={Lock}
        title="Restricted file"
        description="Your role is not cleared to view this file. Its description remains visible to authorised staff."
      />
    );
  const access = a.derivatives.find((d) => d.role === 'access_derivative');
  const viewable = access || (!['image/tiff', 'image/jp2'].includes(a.mediaType) ? a : null);
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Digital assets', to: '/admin/assets' }, { label: a.originalFilename }]}
        eyebrow={humanize(a.role)}
        title={a.originalFilename}
        meta={
          <>
            <StatusBadge status={a.status} />
            <StatusBadge status={a.preservationStatus} />
            <Badge tone={a.malwareStatus === 'clean' ? 'green' : a.malwareStatus === 'skipped' ? 'neutral' : 'red'}>
              Scan: {humanize(a.malwareStatus)}
            </Badge>
            {a.isPublished && <Badge tone="green">Published</Badge>}
            {a.record && (
              <Link to={`/admin/records/${a.record.id}`} className="text-sm text-brand-700 hover:underline">
                {a.record.referenceCode}
              </Link>
            )}
          </>
        }
        actions={
          <>
            {can('preservation.manage') && (
              <Button
                size="sm"
                variant="secondary"
                icon={ShieldCheck}
                loading={fixity.isPending}
                onClick={() => fixity.mutate()}
              >
                Verify fixity
              </Button>
            )}
            {(can('ocr.review') || can('digitisation.capture')) &&
              ['image/tiff', 'image/jpeg', 'image/png', 'image/jp2', 'application/pdf'].includes(a.mediaType) &&
              a.status === 'available' && (
                <Button size="sm" variant="secondary" icon={ScanText} onClick={() => ocr.mutate()}>
                  Run OCR
                </Button>
              )}
            {a.status === 'failed' && can('preservation.manage') && (
              <Button size="sm" icon={RefreshCw} onClick={() => reprocess.mutate()}>
                Reprocess
              </Button>
            )}
            {can('assets.upload') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRights({
                    accessLevel: a.accessLevel,
                    downloadAllowed: a.downloadAllowed,
                    rightsStatement: a.rightsStatement || '',
                    copyrightHolder: a.copyrightHolder || '',
                    licence: a.licence || '',
                  });
                  setRightsOpen(true);
                }}
              >
                Rights & access
              </Button>
            )}
          </>
        }
      />
      {a.status === 'processing' && (
        <Alert tone="info" className="mb-4">
          Processing: extracting technical metadata and creating derivatives…
        </Alert>
      )}
      {a.status === 'quarantined' && (
        <Alert tone="danger" className="mb-4">
          This file is quarantined because the malware scan could not complete. It is not available for use.
        </Alert>
      )}
      {a.ingestError && (
        <Alert tone="danger" className="mb-4">
          {a.ingestError}
        </Alert>
      )}
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'derivatives', label: 'Derivatives', count: a.derivatives.length },
          { value: 'preservation', label: 'Preservation', count: a.events.length },
          { value: 'technical', label: 'Technical metadata' },
        ]}
      />
      {tab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader title="Preview" description={access ? 'Showing the access derivative' : undefined} />
            <CardBody>
              {viewable && a.status === 'available' ? (
                <AssetViewer asset={viewable} />
              ) : (
                <p className="text-sm text-ink-soft">No browser preview for this format.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="File" />
            <CardBody>
              <MetaList
                columns={1}
                items={[
                  { label: 'Media type (detected)', value: a.mediaType },
                  { label: 'Declared by browser', value: a.declaredMediaType },
                  { label: 'Size', value: fmtBytes(a.sizeBytes) },
                  { label: 'SHA-256', value: <span className="break-all font-mono text-xs">{a.sha256}</span> },
                  { label: 'Dimensions', value: a.width && `${a.width} × ${a.height} px` },
                  { label: 'Pages', value: a.pageCount },
                  { label: 'Duration', value: a.durationSeconds && `${Number(a.durationSeconds).toFixed(1)} s` },
                  { label: 'Format risk', value: humanize(a.formatRisk) },
                  { label: 'OCR', value: humanize(a.ocrStatus) },
                  { label: 'QA', value: humanize(a.qaStatus) },
                  {
                    label: 'Access',
                    value: `${humanize(a.accessLevel)}${a.downloadAllowed ? ', download allowed' : ''}`,
                  },
                  { label: 'Rights', value: a.rightsStatement },
                  { label: 'Last fixity', value: fmtDateTime(a.lastFixityAt) },
                  { label: 'Next fixity', value: fmtDateTime(a.nextFixityAt) },
                  {
                    label: 'Duplicate of',
                    value: a.duplicateOfId && (
                      <Link className="text-brand-700 hover:underline" to={`/admin/assets/${a.duplicateOfId}`}>
                        another asset
                      </Link>
                    ),
                  },
                  { label: 'Uploaded', value: fmtDateTime(a.createdAt) },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      )}
      {tab === 'derivatives' && (
        <Card>
          <CardHeader
            title="Derivatives"
            description="Access copies and thumbnails are separate assets; the master is never overwritten."
          />
          <ul className="divide-y divide-line">
            {a.derivatives.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-semibold">{humanize(d.role)}</span>{' '}
                  <span className="text-ink-soft">
                    {d.mediaType} · {d.width}×{d.height} · {fmtBytes(d.sizeBytes)}
                  </span>
                </span>
                <span className="flex gap-2">
                  {d.isPublished && <Badge tone="green">Published</Badge>}
                  {can('assets.publish') && d.role !== 'thumbnail' && (
                    <Button
                      size="sm"
                      variant={d.isPublished ? 'secondary' : 'primary'}
                      icon={d.isPublished ? EyeOff : Globe}
                      onClick={() => setConfirm({ type: 'publish', assetId: d.id, publish: !d.isPublished })}
                    >
                      {d.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                  )}
                  {can('assets.publish') && d.role === 'thumbnail' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => publish.mutate({ assetId: d.id, publish: !d.isPublished })}
                    >
                      {d.isPublished ? 'Hide thumbnail' : 'Publish thumbnail'}
                    </Button>
                  )}
                  {can('assets.delete') && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete derivative"
                      onClick={() => setConfirm({ type: 'delete', assetId: d.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {!a.derivatives.length && <CardBody className="text-sm text-ink-soft">No derivatives.</CardBody>}
        </Card>
      )}
      {tab === 'preservation' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Preservation events" />
            <ul className="divide-y divide-line">
              {a.events.map((e) => (
                <li key={e.id} className="px-5 py-2.5 text-sm">
                  <span className="font-semibold">{humanize(e.eventType)}</span> <StatusBadge status={e.outcome} />
                  <p className="text-ink-soft">{e.detail}</p>
                  <p className="text-xs text-ink-soft">
                    {e.agentName} · {fmtDateTime(e.eventAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Fixity checks" />
              <ul className="divide-y divide-line">
                {a.fixity.map((f) => (
                  <li key={f.id} className="flex justify-between px-5 py-2.5 text-sm">
                    <span>
                      {fmtDateTime(f.checkedAt)} · {humanize(f.triggeredBy)}
                    </span>
                    <StatusBadge status={f.status} />
                  </li>
                ))}
              </ul>
              {!a.fixity.length && <CardBody className="text-sm text-ink-soft">Not yet verified.</CardBody>}
            </Card>
            <Card>
              <CardHeader title="Checksums" />
              <ul className="divide-y divide-line">
                {a.checksums.map((c) => (
                  <li key={c.id} className="px-5 py-2.5 text-xs">
                    <span className="font-semibold">{c.algorithm}</span> ({c.source}){' '}
                    <span className="block break-all font-mono">{c.value}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
      {tab === 'technical' && (
        <Card>
          <CardBody>
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-canvas p-4 text-xs">
              {JSON.stringify({ technical: a.technicalMetadata, extracted: a.extractedMetadata }, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        loading={publish.isPending || remove.isPending}
        title={
          confirm?.type === 'delete'
            ? 'Delete this derivative?'
            : confirm?.publish
              ? 'Publish this file?'
              : 'Unpublish this file?'
        }
        tone={confirm?.type === 'delete' || !confirm?.publish ? 'danger' : 'primary'}
        description={
          confirm?.type === 'delete'
            ? 'The stored object is marked deleted; its metadata and checksum remain as evidence.'
            : confirm?.publish
              ? 'It will be viewable by anyone who can see the published description, subject to its access rules.'
              : undefined
        }
        requireReason={confirm?.type === 'delete' ? true : 'optional'}
        onConfirm={({ reason }) =>
          confirm.type === 'delete'
            ? remove.mutate({ assetId: confirm.assetId, reason })
            : publish.mutate({ assetId: confirm.assetId, publish: confirm.publish, reason })
        }
      />
      <Dialog
        open={rightsOpen}
        onClose={() => setRightsOpen(false)}
        title="Rights and access"
        description="An asset can be stricter than its description but never more open."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRightsOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saveRights.isPending}
              onClick={() =>
                saveRights.mutate({
                  ...rights,
                  rightsStatement: rights.rightsStatement || null,
                  copyrightHolder: rights.copyrightHolder || null,
                  licence: rights.licence || null,
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Access level">
            <Select value={rights.accessLevel} onChange={(e) => setRights({ ...rights, accessLevel: e.target.value })}>
              {['inherit', 'open', 'staff_only', 'restricted', 'embargoed', 'confidential', 'closed'].map((l) => (
                <option key={l} value={l}>
                  {humanize(l)}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox
            label="Allow download where access permits"
            checked={Boolean(rights.downloadAllowed)}
            onChange={(e) => setRights({ ...rights, downloadAllowed: e.target.checked })}
          />
          <Field label="Rights statement">
            <Input
              value={rights.rightsStatement}
              onChange={(e) => setRights({ ...rights, rightsStatement: e.target.value })}
            />
          </Field>
          <Field label="Copyright holder">
            <Input
              value={rights.copyrightHolder}
              onChange={(e) => setRights({ ...rights, copyrightHolder: e.target.value })}
            />
          </Field>
          <Field label="Licence">
            <Input value={rights.licence} onChange={(e) => setRights({ ...rights, licence: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
