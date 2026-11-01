/**
 * Staff page of one archival description, organised in tabs: overview, contents, digital assets, physical items,
 * links, access, versions and history.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Pencil,
  Plus,
  Upload,
  FileDown,
  Lock,
  ShieldPlus,
  History,
  ExternalLink,
  Trash2,
  MoveRight,
} from 'lucide-react';
import { api, download } from '../../lib/api.js';
import { useApi, useApiMutation, post, put } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Timeline } from '../../components/feedback/Timeline.jsx';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  MetaList,
  Tabs,
  StatusBadge,
  AccessBadge,
  Badge,
  PageLoader,
  ErrorState,
  Alert,
  EmptyState,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  hasMeta,
} from '../../components/ui/index.js';
import { fmtDate, fmtDateTime, humanize, fmtBytes } from '../../utils/format.js';
import { ACTION_LABELS, ACCESS_LEVELS, childLevels } from './constants.js';
import { AuthorityPicker, TermPicker } from './Pickers.jsx';
import { UploadProgress } from '../../components/forms/UploadProgress.jsx';

/**
 * Shows the workflow actions the user may take on the description now (for example submit for review, approve,
 * publish or withdraw) and asks for confirmation. Returning to draft and withdrawing require a reason, and missing
 * required fields are listed before submission or publication.
 *
 * @param {object} props
 * @param {object} props.record The description.
 * @returns {JSX.Element|null}
 */
function WorkflowBar({ record }) {
  const [action, setAction] = useState(null);
  const mutation = useApiMutation((body) => post(`/records/${record.id}/transition`, body), {
    success: (_, v) => `${ACTION_LABELS[v.action]} complete`,
    invalidate: [['record', record.id], 'records'],
    onSuccess: () => setAction(null),
  });
  if (!record.availableActions?.length) return null;
  const needsReason = ['return_to_draft', 'withdraw'].includes(action);
  return (
    <>
      {record.availableActions.map((a) => (
        <Button
          key={a}
          size="sm"
          variant={
            a === 'publish' ? 'gold' : a === 'withdraw' ? 'danger' : a === 'return_to_draft' ? 'secondary' : 'primary'
          }
          onClick={() => setAction(a)}
        >
          {ACTION_LABELS[a]}
        </Button>
      ))}
      <ConfirmDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        loading={mutation.isPending}
        title={`${ACTION_LABELS[action] || ''}: ${record.referenceCode}`}
        confirmLabel={ACTION_LABELS[action]}
        tone={action === 'withdraw' ? 'danger' : 'primary'}
        requireReason={needsReason ? true : 'optional'}
        reasonLabel={needsReason ? 'Reason (required)' : 'Comment (optional)'}
        description={
          action === 'publish'
            ? 'Publishing makes this description discoverable according to its effective access level. Files must be published separately.'
            : action === 'withdraw'
              ? 'The description leaves the public catalogue. Its history is kept.'
              : undefined
        }
        onConfirm={({ reason }) => mutation.mutate({ action, reason })}
      >
        {action === 'submit_for_review' && record.missingForReview?.length > 0 && (
          <Alert tone="warning">Missing: {record.missingForReview.map(humanize).join(', ')}</Alert>
        )}
        {action === 'publish' && record.missingForPublication?.length > 0 && (
          <Alert tone="warning">
            Missing before publication: {record.missingForPublication.map(humanize).join(', ')}
          </Alert>
        )}
      </ConfirmDialog>
    </>
  );
}

/**
 * Renders a titled card of metadata, or nothing when every value is empty.
 *
 * @param {object} props
 * @param {string} props.title Card title.
 * @param {object[]} props.items Label and value pairs.
 * @param {number} [props.columns] Number of columns.
 * @returns {JSX.Element|null}
 */
function MetaCard({ title, items, columns }) {
  if (!hasMeta(items)) return null;
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        <MetaList columns={columns} items={items} />
      </CardBody>
    </Card>
  );
}

/**
 * Shows the description by ISAD(G) area: identity, context, content and structure, access and use, and allied
 * materials and notes. When only identifying information may be shown, the restriction is explained instead of the
 * content.
 *
 * @param {object} props
 * @param {object} props.r The description, as returned by the API.
 * @returns {JSX.Element}
 */
function Overview({ r }) {
  return (
    <div className="space-y-6">
      {r.access?.mode === 'metadata_only' && (
        <Alert tone="warning" icon={Lock} title="Restricted content">
          Your role is not cleared for this access level, so only identifying metadata is shown.
        </Alert>
      )}
      <MetaCard
        title="Identity"
        items={[
          { label: 'Reference code', value: r.referenceCode },
          { label: 'Level', value: humanize(r.level) },
          { label: 'Dates', value: r.dateExpression || [r.dateStart, r.dateEnd].filter(Boolean).join(' – ') },
          { label: 'Extent and medium', value: r.extentAndMedium },
          { label: 'Alternative title', value: r.alternativeTitle },
          { label: 'Collection type', value: r.collectionType },
          { label: 'Repository', value: r.repository?.name },
          { label: 'Originating unit', value: r.originatingUnit?.name },
        ]}
      />
      {r.access?.mode === 'full' && (
        <>
          <MetaCard
            title="Context"
            columns={1}
            items={[
              {
                label: 'Creators',
                value:
                  r.creators
                    ?.map((c) => `${c.authority.authorizedName}${c.role !== 'creator' ? ` (${c.role})` : ''}`)
                    .join('; ') || r.creatorNote,
              },
              { label: 'Administrative / biographical history', value: r.adminBiographicalHistory },
              { label: 'Archival history', value: r.archivalHistory },
              { label: 'Immediate source', value: r.immediateSource },
            ]}
          />
          <MetaCard
            title="Content and structure"
            columns={1}
            items={[
              { label: 'Scope and content', value: r.scopeAndContent },
              { label: 'Appraisal', value: r.appraisalInfo },
              { label: 'Accruals', value: r.accruals },
              { label: 'Arrangement', value: r.arrangement },
            ]}
          />
          <MetaCard
            title="Access and use"
            items={[
              { label: 'Access conditions', value: r.accessConditions, wide: true },
              { label: 'Reproduction conditions', value: r.reproductionConditions, wide: true },
              { label: 'Copyright', value: r.copyrightStatement, wide: true },
              { label: 'Languages', value: r.languages },
              { label: 'Physical characteristics', value: r.physicalCharacteristics },
              { label: 'Finding aids', value: r.findingAids, wide: true },
            ]}
          />
          <MetaCard
            title="Allied materials and notes"
            items={[
              { label: 'Originals', value: r.locationOfOriginals },
              { label: 'Copies', value: r.locationOfCopies },
              { label: 'Related material', value: r.relatedMaterials, wide: true },
              { label: 'Publication note', value: r.publicationNote, wide: true },
              { label: "Archivist's note", value: r.archivistNote, wide: true },
              { label: 'Geographic coverage', value: r.geographicCoverage },
              { label: 'Keywords', value: r.keywords },
              { label: 'Preferred citation', value: r.preferredCitation, wide: true },
              { label: 'Rules', value: r.rulesConventions },
              { label: 'Description date', value: r.descriptionDate && fmtDate(r.descriptionDate) },
            ]}
          />
        </>
      )}
    </div>
  );
}

/**
 * Lists the descriptions directly beneath this one, with a button to add a child for authorised users.
 *
 * @param {object} props
 * @param {object} props.r The description, as returned by the API.
 * @returns {JSX.Element}
 */
function Contents({ r }) {
  const { can } = useCan();
  const navigate = useNavigate();
  const { data, isLoading } = useApi(['record-children', r.id], '/records', {
    parentId: r.id,
    pageSize: 200,
    sort: 'sortOrder',
    order: 'asc',
  });
  return (
    <Card>
      <CardHeader
        title="Contents"
        description="Descriptions directly beneath this one"
        actions={
          can('records.create') &&
          childLevels(r.level).length > 0 &&
          !['withdrawn', 'superseded'].includes(r.status) && (
            <Button size="sm" icon={Plus} to={`/admin/records/new?parentId=${r.id}`}>
              Add child
            </Button>
          )
        }
      />
      {isLoading ? (
        <CardBody>Loading…</CardBody>
      ) : data?.data.length ? (
        <ul className="divide-y divide-line">
          {data.data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => navigate(`/admin/records/${c.id}`)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-canvas"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-gold-700">
                    {c.referenceCode} · {humanize(c.level)}
                  </span>
                  <span className="block font-semibold">{c.title}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <AccessBadge level={c.effectiveAccessLevel} />
                  <StatusBadge status={c.status} />
                  {c.childCount > 0 && <span className="text-xs text-ink-soft">{c.childCount}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No child descriptions" description="Add series, files or items to build the hierarchy." />
      )}
    </Card>
  );
}

/**
 * Lists the description's digital files with their role, type, size, processing status, publication and OCR status
 * (or only that they are restricted), and lets authorised users upload files with a progress bar. Preservation
 * masters are never published; access copies are made automatically for images.
 *
 * @param {object} props
 * @param {object} props.r The description, as returned by the API.
 * @returns {JSX.Element}
 */
function Assets({ r }) {
  const { can } = useCan();
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null);
  const { data, refetch } = useApi(['record-assets', r.id], '/digital-assets', { recordId: r.id, pageSize: 100 });
  const upload = useApiMutation(
    async () => {
      const fd = new FormData();
      fd.append('recordId', r.id);
      files.forEach((f) => fd.append('files', f));
      setProgress(0);
      return api
        .post('/digital-assets', fd, {
          headers: {
            'Idempotency-Key': `${r.id}-${files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join('|')}`,
          },
          onUploadProgress: (e) => setProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null),
          timeout: 0,
        })
        .then((x) => x.data)
        .finally(() => setProgress(null));
    },
    {
      success: (res) =>
        `${res.data.length} file(s) uploaded${res.meta.rejected?.length ? `, ${res.meta.rejected.length} rejected` : ''}`,
      invalidate: [['record-assets', r.id]],
      onSuccess: () => {
        setFiles([]);
        setTimeout(refetch, 2500);
      },
    },
  );
  return (
    <Card>
      <CardHeader
        title="Digital assets"
        description="Preservation masters are never published; derivatives are created automatically for images."
      />
      {can('assets.upload') && (
        <CardBody className="border-b border-line">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-line px-4 py-3 text-sm text-ink-soft hover:border-brand-300">
              <input type="file" multiple className="sr-only" onChange={(e) => setFiles([...e.target.files])} />
              <Upload className="mr-2 inline h-4 w-4" />
              {files.length
                ? `${files.length} file(s) selected: ${files
                    .map((f) => f.name)
                    .join(', ')
                    .slice(0, 120)}`
                : 'Choose files to upload (validated, malware-scanned and checksummed)'}
            </label>
            <Button icon={Upload} disabled={!files.length} loading={upload.isPending} onClick={() => upload.mutate()}>
              Upload
            </Button>
          </div>
          <UploadProgress percent={progress} label={`Uploading ${files.length} file(s)`} />
          {upload.data?.meta?.rejected?.length > 0 && (
            <Alert tone="warning" className="mt-3">
              {upload.data.meta.rejected.map((x) => (
                <p key={x.filename}>
                  <span className="font-semibold">{x.filename}</span>: {x.error}
                </p>
              ))}
            </Alert>
          )}
        </CardBody>
      )}
      {data?.data.length ? (
        <ul className="divide-y divide-line">
          {data.data.map((a) => (
            <li key={a.id}>
              <Link
                to={`/admin/assets/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-canvas"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{a.originalFilename || 'Restricted file'}</span>
                  <span className="text-xs text-ink-soft">
                    {humanize(a.role)} · {a.mediaType} · {fmtBytes(a.sizeBytes)}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {a.restricted ? (
                    <Badge tone="amber">
                      <Lock className="h-3 w-3" /> Restricted
                    </Badge>
                  ) : (
                    <>
                      <StatusBadge status={a.status} />
                      {a.isPublished && <Badge tone="green">Published</Badge>}
                      {a.ocrStatus && a.ocrStatus !== 'not_applicable' && (
                        <Badge tone="blue">OCR {humanize(a.ocrStatus)}</Badge>
                      )}
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No digital files" />
      )}
    </Card>
  );
}

/**
 * Lists the boxes and volumes linked to the description with their location and status.
 *
 * @param {object} props
 * @param {object} props.r The description, as returned by the API.
 * @returns {JSX.Element}
 */
function Physical({ r }) {
  const { data } = useApi(['record-physical', r.id], '/physical-items', { recordId: r.id, pageSize: 100 });
  return (
    <Card>
      <CardHeader
        title="Physical items"
        actions={
          <Button size="sm" variant="secondary" icon={Plus} to={`/admin/storage/items?new=1&recordId=${r.id}`}>
            Register item
          </Button>
        }
      />
      {data?.data.length ? (
        <ul className="divide-y divide-line">
          {data.data.map((i) => (
            <li key={i.id}>
              <Link
                to={`/admin/storage/items/${i.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas"
              >
                <span>
                  <span className="font-mono text-xs text-gold-700">{i.barcode}</span>
                  <span className="block font-semibold">{i.title}</span>
                  <span className="text-xs text-ink-soft">
                    {i.currentLocation ? `${i.currentLocation.code} — ${i.currentLocation.name}` : 'No location'}
                  </span>
                </span>
                <StatusBadge status={i.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No physical items linked" />
      )}
    </Card>
  );
}

/**
 * Shows the effective access, how it is inherited, restrictions, access change requests and researcher grants.
 * Authorised users can change the access level (making it stricter applies immediately; making it looser is sent
 * for a second person's approval), add restrictions, and request that a restriction be lifted, with a reason.
 *
 * @param {object} props
 * @param {object} props.r The description, as returned by the API.
 * @returns {JSX.Element}
 */
function AccessTab({ r }) {
  const { can } = useCan();
  const { data, refetch } = useApi(['record-access', r.id], `/permissions/records/${r.id}`, null, {
    enabled: can('records.restrict') || can('permissions.approve'),
  });
  const [levelOpen, setLevelOpen] = useState(false);
  const [restrictOpen, setRestrictOpen] = useState(false);
  const [form, setForm] = useState({ accessLevel: r.accessLevel, embargoUntil: '', reason: '' });
  const [restriction, setRestriction] = useState({
    restrictionType: 'personal_data',
    legalBasis: '',
    publicExplanation: '',
    internalNotes: '',
    expiresAt: '',
    reviewDate: '',
  });
  const inval = [
    ['record-access', r.id],
    ['record', r.id],
  ];
  const changeLevel = useApiMutation((b) => put(`/permissions/records/${r.id}/level`, b), {
    success: (res) => (res.data.pendingApproval ? 'Change submitted for second approval' : 'Access level changed'),
    invalidate: inval,
    onSuccess: () => setLevelOpen(false),
  });
  const addRestriction = useApiMutation((b) => post(`/permissions/records/${r.id}/restrictions`, b), {
    success: 'Restriction added',
    invalidate: inval,
    onSuccess: () => setRestrictOpen(false),
  });
  const lift = useApiMutation(({ id, reason }) => post(`/permissions/restrictions/${id}/lift`, { reason }), {
    success: (res) => (res.data.pendingApproval ? 'Lift submitted for approval' : 'Restriction lifted'),
    invalidate: inval,
  });
  const [liftId, setLiftId] = useState(null);
  if (!data)
    return (
      <Card>
        <CardBody>
          <MetaList
            items={[
              { label: 'Effective access', value: humanize(r.effectiveAccessLevel) },
              { label: 'Public visibility', value: humanize(r.publicVisibility) },
            ]}
          />
        </CardBody>
      </Card>
    );
  const a = data.data;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Effective access"
          description="The strictest setting on the path from the repository to this description applies, unless an approved exception exists."
          actions={
            can('records.restrict') && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setForm({ accessLevel: r.accessLevel, embargoUntil: r.embargoUntil || '', reason: '' });
                    setLevelOpen(true);
                  }}
                >
                  Change level
                </Button>
                <Button size="sm" icon={ShieldPlus} onClick={() => setRestrictOpen(true)}>
                  Add restriction
                </Button>
              </>
            )
          }
        />
        <CardBody>
          <MetaList
            columns={3}
            items={[
              { label: 'Own level', value: <AccessBadge level={a.record.accessLevel} /> },
              { label: 'Effective level', value: <AccessBadge level={a.record.effectiveAccessLevel} /> },
              { label: 'Public visibility', value: humanize(a.record.publicVisibility) },
              {
                label: 'Inherited from parent',
                value: a.inheritedFrom
                  ? `${a.inheritedFrom.referenceCode} (${humanize(a.inheritedFrom.effectiveAccessLevel)})`
                  : 'Top level',
              },
              { label: 'Embargo until', value: fmtDate(a.record.embargoUntil) },
              { label: 'Flags', value: (a.record.effectiveFlags || []).map(humanize) },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Restrictions" />
        {a.restrictions.length ? (
          <ul className="divide-y divide-line">
            {a.restrictions.map((x) => (
              <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {humanize(x.restrictionType)} <StatusBadge status={x.status} />
                  </p>
                  <p className="text-ink-soft">{x.legalBasis}</p>
                  {x.publicExplanation && <p className="text-xs">Public: {x.publicExplanation}</p>}
                  <p className="text-xs text-ink-soft">
                    {x.expiresAt ? `Expires ${fmtDate(x.expiresAt)} · ` : ''}By {x.authorisedBy?.fullName}{' '}
                    {fmtDate(x.createdAt)}
                  </p>
                </div>
                {can('records.restrict') && ['active', 'expired_pending_review'].includes(x.status) && (
                  <Button size="sm" variant="secondary" onClick={() => setLiftId(x.id)}>
                    Request lift
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <CardBody className="text-sm text-ink-soft">No detailed restrictions.</CardBody>
        )}
      </Card>
      <Card>
        <CardHeader
          title="Access change requests"
          description="Making material more accessible requires a second approver."
        />
        {a.requests.length ? (
          <ul className="divide-y divide-line">
            {a.requests.map((x) => (
              <li key={x.id} className="px-5 py-3 text-sm">
                <p className="font-semibold">
                  {humanize(x.changeType)} {x.fromLevel && `${humanize(x.fromLevel)} → `}
                  {x.toLevel && humanize(x.toLevel)} <StatusBadge status={x.status} />
                </p>
                <p className="text-ink-soft">
                  {x.reason} — {x.requestedBy?.fullName}, {fmtDateTime(x.createdAt)}
                  {x.decidedBy ? ` · decided by ${x.decidedBy.fullName}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <CardBody className="text-sm text-ink-soft">None.</CardBody>
        )}
      </Card>
      {a.grants.length > 0 && (
        <Card>
          <CardHeader title="Researcher grants" />
          <ul className="divide-y divide-line">
            {a.grants.map((g) => (
              <li key={g.id} className="px-5 py-3 text-sm">
                {g.user?.fullName} — {g.permissionLevel} {g.expiresAt ? `until ${fmtDate(g.expiresAt)}` : ''}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={levelOpen}
        onClose={() => setLevelOpen(false)}
        title="Change access level"
        description="Tightening applies at once. Loosening is sent for second approval."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLevelOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={changeLevel.isPending}
              disabled={form.reason.trim().length < 3}
              onClick={() =>
                changeLevel.mutate({
                  accessLevel: form.accessLevel,
                  embargoUntil: form.embargoUntil || undefined,
                  reason: form.reason,
                })
              }
            >
              Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Access level">
            <Select value={form.accessLevel} onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}>
              {ACCESS_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {humanize(l)}
                </option>
              ))}
            </Select>
          </Field>
          {form.accessLevel === 'embargoed' && (
            <Field label="Embargo until" required>
              <Input
                type="date"
                value={form.embargoUntil}
                onChange={(e) => setForm({ ...form, embargoUntil: e.target.value })}
              />
            </Field>
          )}
          <Field label="Reason and basis" required>
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
        </div>
      </Dialog>
      <Dialog
        open={restrictOpen}
        onClose={() => setRestrictOpen(false)}
        title="Add a restriction"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestrictOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={addRestriction.isPending}
              onClick={() =>
                addRestriction.mutate(Object.fromEntries(Object.entries(restriction).filter(([, v]) => v !== '')))
              }
            >
              Add restriction
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select
              value={restriction.restrictionType}
              onChange={(e) => setRestriction({ ...restriction, restrictionType: e.target.value })}
            >
              {[
                'staff_only',
                'restricted',
                'embargoed',
                'confidential',
                'closed',
                'onsite_only',
                'view_only',
                'no_download',
                'reproduction_by_permission',
                'copyright',
                'personal_data',
              ].map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expires" required={restriction.restrictionType === 'embargoed'}>
            <Input
              type="date"
              value={restriction.expiresAt}
              onChange={(e) => setRestriction({ ...restriction, expiresAt: e.target.value })}
            />
          </Field>
          <Field label="Legal or policy basis" className="sm:col-span-2">
            <Input
              value={restriction.legalBasis}
              onChange={(e) => setRestriction({ ...restriction, legalBasis: e.target.value })}
            />
          </Field>
          <Field
            label="Public explanation"
            help="Shown to the public. Must not disclose sensitive details."
            className="sm:col-span-2"
          >
            <Input
              value={restriction.publicExplanation}
              onChange={(e) => setRestriction({ ...restriction, publicExplanation: e.target.value })}
            />
          </Field>
          <Field label="Internal notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={restriction.internalNotes}
              onChange={(e) => setRestriction({ ...restriction, internalNotes: e.target.value })}
            />
          </Field>
          <Field label="Review date">
            <Input
              type="date"
              value={restriction.reviewDate}
              onChange={(e) => setRestriction({ ...restriction, reviewDate: e.target.value })}
            />
          </Field>
        </div>
      </Dialog>
      <ConfirmDialog
        open={Boolean(liftId)}
        onClose={() => setLiftId(null)}
        title="Request to lift restriction"
        requireReason
        confirmLabel="Submit"
        loading={lift.isPending}
        onConfirm={({ reason }) =>
          lift.mutate(
            { id: liftId, reason },
            {
              onSuccess: () => {
                setLiftId(null);
                refetch();
              },
            },
          )
        }
      />
    </div>
  );
}

/**
 * Lists every version of the description. Any two versions can be compared field by field, and authorised users can
 * restore an earlier version with a reason; a published description then returns to draft for review.
 *
 * @param {object} props
 * @param {object} props.r The description, as returned by the API.
 * @returns {JSX.Element}
 */
function Versions({ r }) {
  const { can } = useCan();
  const { data } = useApi(['record-versions', r.id], `/records/${r.id}/versions`);
  const [cmp, setCmp] = useState(null);
  const [restore, setRestore] = useState(null);
  const compare = useQuery({
    queryKey: ['record-compare', r.id, cmp],
    queryFn: () => api.get(`/records/${r.id}/versions/compare`, { params: cmp }).then((x) => x.data.data),
    enabled: Boolean(cmp),
  });
  const doRestore = useApiMutation(({ n, reason }) => post(`/records/${r.id}/versions/${n}/restore`, { reason }), {
    success: 'Version restored as a new draft change',
    invalidate: [
      ['record', r.id],
      ['record-versions', r.id],
    ],
    onSuccess: () => setRestore(null),
  });
  const versions = data?.data || [];
  return (
    <Card>
      <CardHeader
        title="Version history"
        description="Every significant change is kept. Compare any two versions or restore an earlier one."
      />
      <ul className="divide-y divide-line">
        {versions.map((v, i) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-semibold">
                Version {v.versionNumber} <StatusBadge status={v.status} />
              </p>
              <p className="text-ink-soft">
                {v.changeSummary} — {v.changedBy?.fullName || 'System'}, {fmtDateTime(v.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              {i < versions.length - 1 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCmp({ from: versions[i + 1].versionNumber, to: v.versionNumber })}
                >
                  Compare with previous
                </Button>
              )}
              {i > 0 && can('records.restore_version') && (
                <Button size="sm" variant="ghost" onClick={() => setRestore(v.versionNumber)}>
                  Restore
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={Boolean(cmp)}
        onClose={() => setCmp(null)}
        size="xl"
        title={cmp ? `Changes from version ${cmp.from} to ${cmp.to}` : ''}
      >
        {compare.data?.changes.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-soft">
                <th className="py-1 pr-3">Field</th>
                <th className="py-1 pr-3">Before</th>
                <th className="py-1">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {compare.data.changes.map((c) => (
                <tr key={c.field} className="align-top">
                  <td className="py-2 pr-3 font-semibold">{humanize(c.field)}</td>
                  <td className="py-2 pr-3 whitespace-pre-line bg-red-50/60 text-red-900">
                    {JSON.stringify(c.from) === 'null'
                      ? '—'
                      : String(Array.isArray(c.from) ? c.from.join(', ') : c.from)}
                  </td>
                  <td className="py-2 whitespace-pre-line bg-emerald-50/60 text-emerald-900">
                    {c.to === null ? '—' : String(Array.isArray(c.to) ? c.to.join(', ') : c.to)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-ink-soft">{compare.isLoading ? 'Loading…' : 'No differences.'}</p>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(restore)}
        onClose={() => setRestore(null)}
        title={`Restore version ${restore}?`}
        description="Descriptive fields are restored as a new version. Published descriptions return to draft for review."
        requireReason
        confirmLabel="Restore"
        loading={doRestore.isPending}
        onConfirm={({ reason }) => doRestore.mutate({ n: restore, reason })}
      />
    </Card>
  );
}

/**
 * Manages the creators (authority records) and subjects (vocabulary terms) linked to the description, and lists the
 * accessions it came from.
 *
 * @param {object} props
 * @param {object} props.r The description, as returned by the API.
 * @returns {JSX.Element}
 */
function Links({ r }) {
  const { can } = useCan();
  const editable = can('records.update') && !['withdrawn', 'superseded'].includes(r.status);
  const inval = [['record', r.id]];
  const setCreators = useApiMutation((creators) => put(`/records/${r.id}/creators`, { creators }), {
    success: 'Creators updated',
    invalidate: inval,
  });
  const setSubjects = useApiMutation((subjects) => put(`/records/${r.id}/subjects`, { subjects }), {
    success: 'Subjects updated',
    invalidate: inval,
  });
  const creators = r.creators || [];
  const subjects = r.subjects || [];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Creators" description="Linked authority records (ISAAR-CPF)" />
        <CardBody className="space-y-3">
          <ul className="flex flex-wrap gap-2">
            {creators.map((c) => (
              <li
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm"
              >
                <Link to={`/admin/authorities/${c.authorityId}`} className="hover:underline">
                  {c.authority.authorizedName}
                </Link>
                <span className="text-xs text-ink-soft">{c.role}</span>
                {editable && (
                  <button
                    type="button"
                    aria-label="Remove creator"
                    onClick={() =>
                      setCreators.mutate(
                        creators
                          .filter((x) => x.id !== c.id)
                          .map((x) => ({ authorityId: x.authorityId, role: x.role })),
                      )
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <AuthorityPicker
              onPick={(a) =>
                setCreators.mutate([
                  ...creators.map((x) => ({ authorityId: x.authorityId, role: x.role })),
                  { authorityId: a.id, role: 'creator' },
                ])
              }
            />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Subjects" description="Controlled vocabulary terms" />
        <CardBody className="space-y-3">
          <ul className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <li
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800"
              >
                {s.term?.label || s.authority?.authorizedName}
                {editable && (
                  <button
                    type="button"
                    aria-label="Remove subject"
                    onClick={() =>
                      setSubjects.mutate(
                        subjects
                          .filter((x) => x.id !== s.id)
                          .map((x) => ({
                            termId: x.termId || undefined,
                            authorityId: x.authorityId || undefined,
                            subjectType: x.subjectType,
                          })),
                      )
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && (
            <TermPicker
              vocabulary="subjects"
              onPick={(t) =>
                setSubjects.mutate([
                  ...subjects.map((x) => ({
                    termId: x.termId || undefined,
                    authorityId: x.authorityId || undefined,
                    subjectType: x.subjectType,
                  })),
                  { termId: t.id, subjectType: 'subject' },
                ])
              }
            />
          )}
        </CardBody>
      </Card>
      {r.accessions?.length > 0 && (
        <Card>
          <CardHeader title="Accessions" />
          <ul className="divide-y divide-line">
            {r.accessions.map((a) => (
              <li key={a.id}>
                <Link to={`/admin/accessions/${a.id}`} className="block px-5 py-3 text-sm hover:bg-canvas">
                  <span className="font-semibold">{a.accessionNumber}</span> {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/**
 * Dialog for moving the description, with everything below it, under a different parent; access is recalculated
 * afterwards.
 *
 * @param {object} props
 * @param {object} props.r The description.
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @returns {JSX.Element}
 */
function MoveDialog({ r, open, onClose }) {
  const [parentRef, setParentRef] = useState('');
  const [reason, setReason] = useState('');
  const search = useApi(
    ['move-target', parentRef],
    '/records',
    { q: parentRef, pageSize: 8 },
    { enabled: parentRef.length > 1 },
  );
  const move = useApiMutation((parentId) => post(`/records/${r.id}/move`, { parentId, reason }), {
    success: 'Moved',
    invalidate: [['record', r.id], 'records'],
    onSuccess: onClose,
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Move within the hierarchy"
      description="The whole subtree moves with this description. Access is recalculated."
    >
      <div className="space-y-3">
        <Field label="Reason">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Find the new parent">
          <Input
            value={parentRef}
            onChange={(e) => setParentRef(e.target.value)}
            placeholder="Reference code or title"
          />
        </Field>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {search.data?.data
            .filter((x) => x.id !== r.id)
            .map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="text-xs text-gold-700">{x.referenceCode}</span> {x.title}{' '}
                  <span className="text-xs text-ink-soft">({humanize(x.level)})</span>
                </span>
                <Button size="sm" variant="secondary" loading={move.isPending} onClick={() => move.mutate(x.id)}>
                  Move here
                </Button>
              </li>
            ))}
        </ul>
        {r.level === 'fonds' || r.level === 'collection' ? null : null}
      </div>
    </Dialog>
  );
}

/**
 * Shows a description with its breadcrumb trail, status and access badges, workflow actions and tabs. Authorised
 * users can edit, move, export it as an EAD finding aid, and view its public page. Tabs the user may not use are
 * hidden, and restricted content is masked.
 *
 * @returns {JSX.Element}
 */
export default function RecordDetailPage() {
  const { id } = useParams();
  const { can } = useCan();
  const [tab, setTab] = useState('overview');
  const [moveOpen, setMoveOpen] = useState(false);
  const { data, isLoading, error, refetch } = useApi(['record', id], `/records/${id}`);
  const hist = useApi(['record-history', id], `/records/${id}/history`, null, {
    enabled: tab === 'history' && can('records.read'),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const r = data.data;
  const full = r.access?.mode === 'full';
  const editable =
    can('records.update') &&
    !['withdrawn', 'superseded'].includes(r.status) &&
    (!['approved', 'published'].includes(r.status) || can('records.approve'));
  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Descriptions', to: '/admin/records' },
          ...(r.breadcrumbs || []).map((b) => ({ label: b.title, to: `/admin/records/${b.id}` })),
          { label: r.title },
        ]}
        eyebrow={`${r.referenceCode} · ${humanize(r.level)}`}
        title={r.title}
        meta={
          <>
            <StatusBadge status={r.status} />
            <AccessBadge level={r.effectiveAccessLevel} />
            {r.publicVisibility !== 'hidden' && <Badge tone="green">Publicly discoverable</Badge>}
            {r.isPermanent && <Badge tone="gold">Permanent</Badge>}
            {r.custodyStatus === 'departmental' && <Badge tone="blue">Departmental custody</Badge>}
          </>
        }
        actions={
          <>
            {full && <WorkflowBar record={r} />}
            {editable && full && (
              <Button size="sm" variant="secondary" icon={Pencil} to={`/admin/records/${r.id}/edit`}>
                Edit
              </Button>
            )}
            {editable && full && r.parentId && (
              <Button size="sm" variant="ghost" icon={MoveRight} onClick={() => setMoveOpen(true)}>
                Move
              </Button>
            )}
            {can('records.export') && (
              <Button size="sm" variant="ghost" icon={FileDown} onClick={() => download(`/records/${r.id}/export/ead`)}>
                EAD
              </Button>
            )}
            {r.publicVisibility !== 'hidden' && (
              <Button size="sm" variant="ghost" icon={ExternalLink} to={`/records/${r.id}`}>
                Public view
              </Button>
            )}
          </>
        }
      />
      {r.status === 'in_review' && (
        <Alert tone="info" className="mb-4">
          Submitted for review {fmtDateTime(r.submittedForReviewAt)}.
        </Alert>
      )}
      {r.status === 'withdrawn' && (
        <Alert tone="danger" className="mb-4" title="Withdrawn">
          {r.withdrawalReason}
        </Alert>
      )}
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Description' },
          { value: 'contents', label: 'Contents', count: r.childCount },
          { value: 'links', label: 'Creators & subjects', hidden: !full },
          { value: 'assets', label: 'Digital assets', hidden: !can('assets.read') || !full },
          { value: 'physical', label: 'Physical items', hidden: !can('physical.read') },
          { value: 'access', label: 'Access' },
          { value: 'versions', label: 'Versions', hidden: !full || !can('records.read') },
          { value: 'history', label: 'History', hidden: !can('records.read') },
        ]}
      />
      {tab === 'overview' && <Overview r={r} />}
      {tab === 'contents' && <Contents r={r} />}
      {tab === 'links' && <Links r={r} />}
      {tab === 'assets' && <Assets r={r} />}
      {tab === 'physical' && <Physical r={r} />}
      {tab === 'access' && <AccessTab r={r} />}
      {tab === 'versions' && <Versions r={r} />}
      {tab === 'history' && (
        <Card>
          <CardHeader title="Workflow history" actions={<History className="h-4 w-4 text-ink-soft" />} />
          <CardBody>
            <Timeline items={hist.data?.data} />
          </CardBody>
        </Card>
      )}
      <MoveDialog r={r} open={moveOpen} onClose={() => setMoveOpen(false)} />
    </div>
  );
}
