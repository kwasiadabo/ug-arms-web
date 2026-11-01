/**
 * Transfer detail page: the inventory editor, the reviewer's line-by-line decision, supporting documents, the
 * discussion with the department and the workflow actions.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, Upload, Save, FileDown, PackagePlus, Paperclip } from 'lucide-react';
import { api, download, errorMessage } from '../../lib/api.js';
import { useApi, useApiMutation, post, put, patch } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Timeline } from '../../components/feedback/Timeline.jsx';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  MetaList,
  StatusBadge,
  PageLoader,
  ErrorState,
  Alert,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Textarea,
  Select,
  Tabs,
} from '../../components/ui/index.js';
import { fmtDate, fmtDateTime, humanize, fmtBytes } from '../../utils/format.js';

const COLS = [
  ['sourceIdentifier', 'Identifier', 'min-w-36'],
  ['title', 'Title / description', 'min-w-[260px]'],
  ['dateExpression', 'Dates', 'min-w-28'],
  ['dateStart', 'From', 'min-w-32'],
  ['dateEnd', 'To', 'min-w-32'],
  ['format', 'Format', 'min-w-28'],
  ['quantity', 'Qty', 'min-w-16'],
  ['extent', 'Extent', 'min-w-28'],
  ['boxNumber', 'Box', 'min-w-20'],
  ['condition', 'Condition', 'min-w-28'],
  ['confidentiality', 'Confidentiality', 'min-w-32'],
  ['notes', 'Notes', 'min-w-[160px]'],
];

/**
 * Returns an empty inventory line with every column present.
 *
 * @returns {Record<string, string>}
 */
const blankRow = () => Object.fromEntries(COLS.map(([k]) => [k, '']));

/**
 * Spreadsheet-like editor of the inventory. Lines can be edited directly while the transfer is editable, or
 * imported from a CSV or Excel file with a preview of validation problems before saving. The user is warned before
 * leaving with unsaved changes.
 *
 * @param {object} props
 * @param {object} props.transfer The transfer with its inventory lines.
 * @param {boolean} props.editable Whether the inventory may be changed.
 * @returns {JSX.Element}
 */
function InventoryEditor({ transfer, editable }) {
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [importResult, setImportResult] = useState(null);
  useEffect(() => {
    setRows(transfer.items.map((i) => Object.fromEntries(COLS.map(([k]) => [k, i[k] ?? '']))));
    setDirty(false);
  }, [transfer.items]);
  useUnsavedChanges(dirty);
  const save = useApiMutation((items) => put(`/transfers/${transfer.id}/items`, { items }), {
    success: 'Inventory saved',
    invalidate: [['transfer', transfer.id]],
    onSuccess: () => setDirty(false),
  });
  const apply = useApiMutation(
    async (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/transfers/${transfer.id}/items/import`, fd).then((r) => r.data.data);
    },
    { onSuccess: (d) => setImportResult(d) },
  );

  /**
   * Changes one cell of the inventory and marks the editor as having unsaved changes.
   *
   * @param {number} i Line index.
   * @param {string} k Column key.
   * @param {string} v New value.
   */
  const update = (i, k, v) => {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
    setDirty(true);
  };

  /**
   * Prepares inventory lines for saving: completely empty lines are dropped and empty cells are sent as null.
   *
   * @param {object[]} list Inventory lines from the editor.
   * @returns {object[]}
   */
  const toPayload = (list) =>
    list
      .filter((r) => Object.values(r).some((v) => v !== ''))
      .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === '' ? null : v])));
  return (
    <Card>
      <CardHeader
        title="Inventory"
        description={`${rows.length} line${rows.length === 1 ? '' : 's'}. ${editable ? 'Edit directly or import a CSV/Excel inventory.' : 'Read-only at this stage.'}`}
        actions={
          editable && (
            <>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold hover:bg-canvas">
                <Upload className="h-4 w-4" /> Import
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="sr-only"
                  onChange={(e) => e.target.files[0] && apply.mutate(e.target.files[0])}
                />
              </label>
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                onClick={() => {
                  setRows((r) => [...r, blankRow()]);
                  setDirty(true);
                }}
              >
                Add line
              </Button>
              <Button
                size="sm"
                icon={Save}
                disabled={!dirty}
                loading={save.isPending}
                onClick={() => save.mutate(toPayload(rows))}
              >
                Save inventory
              </Button>
            </>
          )
        }
      />
      {save.error?.response?.data?.error?.details && (
        <Alert tone="danger" className="m-4">
          {save.error.response.data.error.details.map((d) => (
            <p key={d.path}>
              {d.path}: {d.message}
            </p>
          ))}
        </Alert>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-canvas/70 text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-2 py-2">#</th>
              {COLS.map(([k, l, w]) => (
                <th key={k} className={`px-2 py-2 text-left font-semibold ${w}`}>
                  {l}
                </th>
              ))}
              {!editable && <th className="px-2 py-2 text-left">Decision</th>}
              {editable && <th />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="px-2 py-1.5 text-xs text-ink-soft">{i + 1}</td>
                {COLS.map(([k, l]) => (
                  <td key={k} className="px-1 py-1">
                    {editable ? (
                      <input
                        aria-label={`${l} line ${i + 1}`}
                        value={r[k]}
                        onChange={(e) => update(i, k, e.target.value)}
                        className="h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 hover:border-line focus:border-brand-600 focus:bg-white focus:outline-none"
                      />
                    ) : (
                      <span className="block px-1.5 py-1">{r[k] || ''}</span>
                    )}
                  </td>
                ))}
                {!editable && (
                  <td className="px-2 py-1.5">
                    <StatusBadge status={transfer.items[i]?.decision} />
                    {transfer.items[i]?.decisionNote && (
                      <p className="text-xs text-ink-soft">{transfer.items[i].decisionNote}</p>
                    )}
                  </td>
                )}
                {editable && (
                  <td className="px-1 py-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove line ${i + 1}`}
                      onClick={() => {
                        setRows((x) => x.filter((_, j) => j !== i));
                        setDirty(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="px-5 py-8 text-center text-sm text-ink-soft">No inventory lines yet.</p>}
      </div>
      <Dialog
        open={Boolean(importResult)}
        onClose={() => setImportResult(null)}
        size="xl"
        title="Inventory import preview"
        description={
          importResult
            ? `${importResult.rows.length} rows read. Columns mapped: ${
                Object.entries(importResult.mapping)
                  .map(([a, b]) => `${a} → ${b}`)
                  .join(', ') || 'none'
              }`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportResult(null)}>
              Cancel
            </Button>
            <Button
              disabled={importResult?.errors.length > 0}
              onClick={() => {
                setRows(
                  importResult.rows.map((r) => ({
                    ...blankRow(),
                    ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])),
                  })),
                );
                setDirty(true);
                setImportResult(null);
              }}
            >
              Use these rows
            </Button>
          </>
        }
      >
        {importResult?.unmappedColumns.length > 0 && (
          <Alert tone="info" className="mb-3">
            Ignored columns: {importResult.unmappedColumns.join(', ')}
          </Alert>
        )}
        {importResult?.errors.length > 0 ? (
          <Alert tone="danger" title="Fix these problems in the file and import again">
            {importResult.errors.slice(0, 30).map((e, i) => (
              <p key={i}>
                Line {e.line}: {e.field} — {e.message}
              </p>
            ))}
          </Alert>
        ) : (
          <Alert tone="success">No validation errors. Review and save the inventory to keep these rows.</Alert>
        )}
      </Dialog>
    </Card>
  );
}

/**
 * Reviewer dialog for deciding a transfer: accept everything, accept some lines and reject others, or reject the
 * transfer. The comment or reason is shared with the department.
 *
 * @param {object} props
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @param {object} props.transfer The transfer with its inventory.
 * @returns {JSX.Element}
 */
function DecisionDialog({ open, onClose, transfer }) {
  const [mode, setMode] = useState('accept');
  const [reason, setReason] = useState('');
  const [decisions, setDecisions] = useState({});
  useEffect(() => {
    if (open) {
      setDecisions(Object.fromEntries(transfer.items.map((i) => [i.id, 'accepted'])));
      setReason('');
      setMode('accept');
    }
  }, [open, transfer.items]);
  const act = useApiMutation((b) => post(`/transfers/${transfer.id}/transition`, b), {
    success: 'Decision recorded',
    invalidate: [['transfer', transfer.id], 'transfers'],
    onSuccess: onClose,
  });
  const anyRejected = Object.values(decisions).includes('rejected');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Decide on this transfer"
      description="Partial acceptance records exactly which inventory lines are accepted."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={act.isPending}
            variant={mode === 'reject' ? 'danger' : 'primary'}
            disabled={mode === 'reject' && reason.trim().length < 3}
            onClick={() =>
              act.mutate(
                mode === 'reject'
                  ? { action: 'reject', reason }
                  : {
                      action: anyRejected ? 'partially_accept' : 'accept',
                      reason: reason || undefined,
                      itemDecisions: Object.entries(decisions).map(([itemId, decision]) => ({ itemId, decision })),
                    },
              )
            }
          >
            {mode === 'reject' ? 'Reject transfer' : anyRejected ? 'Partially accept' : 'Accept all'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Decision">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="accept">Accept (choose lines)</option>
            <option value="reject">Reject the whole transfer</option>
          </Select>
        </Field>
        {mode === 'accept' && (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {transfer.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {i.lineNumber}. {i.title}
                </span>
                <select
                  aria-label={`Decision for line ${i.lineNumber}`}
                  value={decisions[i.id]}
                  onChange={(e) => setDecisions({ ...decisions, [i.id]: e.target.value })}
                  className="h-8 rounded-md border border-line px-2 text-sm"
                >
                  <option value="accepted">Accept</option>
                  <option value="rejected">Reject</option>
                </select>
              </li>
            ))}
          </ul>
        )}
        <Field
          label={mode === 'reject' ? 'Reason (shared with the department)' : 'Comment (shared with the department)'}
          required={mode === 'reject'}
        >
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

/**
 * Shows a transfer with its status, inventory, details, supporting documents, submitted versions and discussion. It
 * offers the actions the user may take now: submit, resubmit or cancel for the department; start review, raise a
 * query and decide for reviewers; and create the accession once the transfer is accepted. Raising a query requires
 * a reason.
 *
 * @returns {JSX.Element}
 */
export default function TransferDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useCan();
  const [tab, setTab] = useState('inventory');
  const [action, setAction] = useState(null);
  const [decide, setDecide] = useState(false);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [details, setDetails] = useState({});
  const { data, isLoading, error, refetch } = useApi(['transfer', id], `/transfers/${id}`);
  const inval = [['transfer', id], 'transfers'];
  const act = useApiMutation((b) => post(`/transfers/${id}/transition`, b), {
    success: 'Updated',
    invalidate: inval,
    onSuccess: () => setAction(null),
  });
  const addComment = useApiMutation((b) => post(`/transfers/${id}/comments`, b), {
    success: 'Comment added',
    invalidate: inval,
    onSuccess: () => setComment(''),
  });
  const createAccession = useApiMutation(() => post(`/transfers/${id}/create-accession`, {}), {
    success: (r) => (r.meta.created ? 'Accession created' : 'Opened existing accession'),
    onSuccess: (r) => navigate(`/admin/accessions/${r.data.id}`),
  });
  const uploadDocs = useApiMutation(
    () => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      return api.post(`/transfers/${id}/documents`, fd).then((r) => r.data);
    },
    { success: 'Documents uploaded', invalidate: inval, onSuccess: () => setFiles([]) },
  );
  const saveDetails = useApiMutation((b) => patch(`/transfers/${id}`, b), {
    success: 'Details saved',
    invalidate: inval,
    onSuccess: () => setEditOpen(false),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const t = data.data;
  const editable = ['draft', 'query_raised'].includes(t.status) && can('transfer.submit');
  const simple = t.availableActions.filter((a) => !['accept', 'partially_accept', 'reject'].includes(a));
  const labels = {
    submit: 'Submit to the Archives',
    resubmit: 'Resubmit',
    start_review: 'Start review',
    raise_query: 'Raise a query',
    cancel: 'Cancel transfer',
  };
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Transfers', to: '/admin/transfers' }, { label: t.referenceNumber || 'Draft' }]}
        eyebrow={t.referenceNumber || 'Draft transfer'}
        title={t.title}
        meta={
          <>
            <StatusBadge status={t.status} />
            <span className="text-sm text-ink-soft">{t.originatingUnit?.name}</span>
            {t.revision > 0 && <span className="text-xs text-ink-soft">Revision {t.revision}</span>}
          </>
        }
        actions={
          <>
            {simple.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === 'cancel' ? 'ghost' : a === 'raise_query' ? 'secondary' : 'primary'}
                onClick={() => setAction(a)}
              >
                {labels[a]}
              </Button>
            ))}
            {t.availableActions.includes('accept') && (
              <Button size="sm" onClick={() => setDecide(true)}>
                Record decision
              </Button>
            )}
            {['accepted', 'partially_accepted'].includes(t.status) && can('accession.create') && (
              <Button
                size="sm"
                icon={PackagePlus}
                loading={createAccession.isPending}
                onClick={() => createAccession.mutate()}
              >
                {t.accessionId ? 'Open accession' : 'Create accession'}
              </Button>
            )}
          </>
        }
      />
      {t.status === 'query_raised' && (
        <Alert tone="warning" className="mb-4" title="The Archives has raised a query">
          {t.comments.filter((c) => c.visibility === 'shared').at(-1)?.body} Update the details or inventory and
          resubmit.
        </Alert>
      )}
      {editable && t.validation.length > 0 && (
        <Alert tone="info" className="mb-4" title="Complete before submitting">
          {t.validation.slice(0, 8).map((v) => (
            <p key={v.field}>
              {humanize(v.field)}: {v.message}
            </p>
          ))}
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'inventory', label: 'Inventory', count: t.items.length },
              { value: 'documents', label: 'Documents', count: t.documents.length },
              { value: 'history', label: 'History' },
              { value: 'revisions', label: 'Submitted versions', count: t.revisions.length },
            ]}
          />
          {tab === 'inventory' && <InventoryEditor transfer={t} editable={editable} />}
          {tab === 'documents' && (
            <Card>
              <CardHeader
                title="Supporting documents"
                description="Transfer agreements, signed lists, correspondence"
              />
              {editable || can('transfer.review') ? (
                <CardBody className="flex flex-wrap items-center gap-3 border-b border-line">
                  <label className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-line px-4 py-3 text-sm text-ink-soft hover:border-brand-300">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.csv,.txt,.docx,.xlsx"
                      className="sr-only"
                      onChange={(e) => setFiles([...e.target.files])}
                    />
                    <Paperclip className="mr-2 inline h-4 w-4" />
                    {files.length ? files.map((f) => f.name).join(', ') : 'Choose PDF, image, Word, Excel or CSV files'}
                  </label>
                  <Button
                    icon={Upload}
                    disabled={!files.length}
                    loading={uploadDocs.isPending}
                    onClick={() => uploadDocs.mutate()}
                  >
                    Upload
                  </Button>
                </CardBody>
              ) : null}
              <ul className="divide-y divide-line">
                {t.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{d.originalFilename}</span>
                      <span className="block text-xs text-ink-soft">
                        {d.mediaType} · {fmtBytes(d.sizeBytes)} · SHA-256 {d.sha256?.slice(0, 12)}… ·{' '}
                        {fmtDateTime(d.createdAt)}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={FileDown}
                      onClick={() => download(`/transfers/${id}/documents/${d.id}`)}
                    >
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
              {!t.documents.length && <CardBody className="text-sm text-ink-soft">No documents attached.</CardBody>}
            </Card>
          )}
          {tab === 'history' && (
            <Card>
              <CardBody>
                <Timeline items={t.history} />
              </CardBody>
            </Card>
          )}
          {tab === 'revisions' && (
            <Card>
              <ul className="divide-y divide-line">
                {t.revisions.map((r) => (
                  <li key={r.id} className="px-5 py-3 text-sm">
                    Revision {r.revision} — submitted {fmtDateTime(r.createdAt)}. The original inventory and each
                    correction are preserved.
                  </li>
                ))}
              </ul>
              {!t.revisions.length && <CardBody className="text-sm text-ink-soft">Not submitted yet.</CardBody>}
            </Card>
          )}
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader
              title="Details"
              actions={
                editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDetails({
                        title: t.title,
                        contactName: t.contactName,
                        contactEmail: t.contactEmail || '',
                        proposedTransferDate: t.proposedTransferDate || '',
                        transferAuthority: t.transferAuthority || '',
                        reason: t.reason || '',
                        totalExtent: t.totalExtent || '',
                        recordsDateRange: t.recordsDateRange || '',
                        confidentialityNotes: t.confidentialityNotes || '',
                      });
                      setEditOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                )
              }
            />
            <CardBody>
              <MetaList
                columns={1}
                items={[
                  { label: 'Contact', value: [t.contactName, t.contactEmail].filter(Boolean).join(' · ') },
                  { label: 'Proposed transfer date', value: fmtDate(t.proposedTransferDate) },
                  { label: 'Transfer authority', value: t.transferAuthority },
                  { label: 'Extent', value: t.totalExtent },
                  { label: 'Date range', value: t.recordsDateRange },
                  { label: 'Reason', value: t.reason },
                  { label: 'Confidentiality', value: t.confidentialityNotes },
                  { label: 'Decision', value: t.decisionNote },
                  {
                    label: 'Accession',
                    value: t.accessionId && (
                      <Link className="text-brand-700 hover:underline" to={`/admin/accessions/${t.accessionId}`}>
                        Open accession
                      </Link>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Discussion" />
            <CardBody className="space-y-3">
              {t.comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg p-3 text-sm ${c.visibility === 'internal' ? 'bg-amber-50' : 'bg-canvas'}`}
                >
                  <p className="text-xs font-semibold text-ink-soft">
                    {c.author?.fullName} · {fmtDateTime(c.createdAt)}
                    {c.visibility === 'internal' && ' · internal'}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{c.body}</p>
                </div>
              ))}
              {!t.comments.length && <p className="text-sm text-ink-soft">No comments yet.</p>}
              <Textarea
                rows={3}
                aria-label="Add a comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment…"
              />
              <div className="flex justify-end gap-2">
                {can('transfer.review') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!comment.trim()}
                    onClick={() => addComment.mutate({ body: comment, visibility: 'internal' })}
                  >
                    Internal note
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!comment.trim()}
                  loading={addComment.isPending}
                  onClick={() => addComment.mutate({ body: comment, visibility: 'shared' })}
                >
                  Send
                </Button>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={labels[action]}
        loading={act.isPending}
        confirmLabel={labels[action]}
        tone={action === 'cancel' ? 'danger' : 'primary'}
        requireReason={action === 'raise_query' ? true : action === 'cancel' ? 'optional' : false}
        reasonLabel={action === 'raise_query' ? 'Query for the department' : 'Reason'}
        description={
          action === 'submit' || action === 'resubmit'
            ? 'A snapshot of the details and inventory is kept with this submission.'
            : undefined
        }
        onConfirm={({ reason }) => act.mutate({ action, reason })}
      />
      {decide && <DecisionDialog open={decide} onClose={() => setDecide(false)} transfer={t} />}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        size="lg"
        title="Edit transfer details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saveDetails.isPending}
              onClick={() =>
                saveDetails.mutate(
                  Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v === '' ? null : v])),
                )
              }
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['title', 'Title', 'sm:col-span-2'],
            ['contactName', 'Contact person'],
            ['contactEmail', 'Contact email'],
            ['proposedTransferDate', 'Proposed transfer date', '', 'date'],
            ['totalExtent', 'Extent'],
            ['transferAuthority', 'Transfer authority', 'sm:col-span-2'],
            ['recordsDateRange', 'Date range of records'],
          ].map(([k, l, c, type]) => (
            <Field key={k} label={l} className={c}>
              <Input
                type={type || 'text'}
                value={details[k] || ''}
                onChange={(e) => setDetails({ ...details, [k]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Reason" className="sm:col-span-2">
            <Textarea
              value={details.reason || ''}
              onChange={(e) => setDetails({ ...details, reason: e.target.value })}
            />
          </Field>
          <Field label="Confidentiality notes" className="sm:col-span-2">
            <Textarea
              value={details.confidentialityNotes || ''}
              onChange={(e) => setDetails({ ...details, confidentialityNotes: e.target.value })}
            />
          </Field>
        </div>
      </Dialog>
      {errorMessage && null}
    </div>
  );
}
