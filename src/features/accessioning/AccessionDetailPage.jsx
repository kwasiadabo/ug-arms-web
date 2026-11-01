/**
 * Accession detail page: details, received items with per-item decisions, links to catalogue descriptions, physical
 * items, supporting documents, approvals and the workflow actions.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FileDown, Plus, Trash2, ShieldAlert, Library, Link2, Paperclip, Upload } from 'lucide-react';
import { api, download } from '../../lib/api.js';
import { useApi, useApiMutation, post, put, patch } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Timeline } from '../../components/feedback/Timeline.jsx';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  MetaList,
  StatusBadge,
  Badge,
  PageLoader,
  ErrorState,
  Alert,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Textarea,
  Tabs,
} from '../../components/ui/index.js';
import { RecordPicker } from '../archival-records/Pickers.jsx';
import { fmtDate, fmtDateTime, humanize, fmtBytes } from '../../utils/format.js';

const FIELDS = [
  ['title', 'Title', 'text', 2],
  ['accessionDate', 'Accession date', 'date'],
  ['transferDate', 'Transfer date', 'date'],
  ['donorName', 'Donor / depositor'],
  ['contactPerson', 'Contact person'],
  ['contactEmail', 'Contact email'],
  ['transferMethod', 'Transfer method'],
  ['transferAuthority', 'Transfer authority', 'text', 2],
  ['legalBasis', 'Legal basis or agreement', 'text', 2],
  ['extent', 'Extent'],
  ['quantity', 'Quantity', 'number'],
  ['physicalCondition', 'Physical condition', 'area', 2],
  ['provenance', 'Provenance', 'area', 2],
  ['custodialHistory', 'Custodial history', 'area', 2],
  ['confidentialityConcerns', 'Known confidentiality concerns', 'area', 2],
  ['rightsStatement', 'Copyright and reproduction rights', 'area', 2],
  ['restrictionsNote', 'Restrictions and embargoes', 'area', 2],
  ['embargoUntil', 'Embargo until', 'date'],
  ['completenessNote', 'Completeness', 'area', 2],
  ['appraisalNote', 'Appraisal note', 'area', 2],
];

/**
 * Dialog for editing an accession's details, such as dates, source, authority, extent, condition, provenance and
 * rights.
 *
 * @param {object} props
 * @param {object} props.a The accession.
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @returns {JSX.Element}
 */
function EditDialog({ a, open, onClose }) {
  const { register, handleSubmit, reset } = useForm();
  useEffect(() => {
    if (open) reset(Object.fromEntries(FIELDS.map(([k]) => [k, a[k] ?? ''])));
  }, [open, a, reset]);
  const save = useApiMutation((b) => patch(`/accessions/${a.id}`, b), {
    success: 'Accession updated',
    invalidate: [['accession', a.id]],
    onSuccess: onClose,
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Edit accession"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={handleSubmit((v) =>
              save.mutate({
                ...Object.fromEntries(
                  Object.entries(v).map(([k, x]) => [k, x === '' ? null : k === 'quantity' ? Number(x) : x]),
                ),
                version: a.version,
              }),
            )}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, l, t, span]) => (
          <Field key={k} label={l} className={span === 2 ? 'sm:col-span-2' : ''}>
            {t === 'area' ? <Textarea rows={2} {...register(k)} /> : <Input type={t || 'text'} {...register(k)} />}
          </Field>
        ))}
      </div>
    </Dialog>
  );
}

/**
 * Shows an accession with flags for missing information and quarantine. It lets authorised users edit details and
 * received items, submit for approval, and (for approvers) start a review and approve, query or reject with
 * per-item decisions; querying and rejecting require a reason. Other actions are placing it in or releasing it from
 * quarantine, downloading the receipt once approved, uploading supporting documents, linking existing descriptions,
 * and creating a new collection from the accession.
 *
 * @returns {JSX.Element}
 */
export default function AccessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useCan();
  const [tab, setTab] = useState('items');
  const [action, setAction] = useState(null);
  const [edit, setEdit] = useState(false);
  const [quarantine, setQuarantine] = useState(null);
  const [items, setItems] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [colOpen, setColOpen] = useState(false);
  const [col, setCol] = useState({ level: 'fonds', localIdentifier: '', title: '' });
  const [files, setFiles] = useState([]);
  const { data, isLoading, error, refetch } = useApi(['accession', id], `/accessions/${id}`);
  useEffect(() => {
    if (data) {
      setItems(
        data.data.items.map((i) => ({
          id: i.id,
          description: i.description,
          format: i.format || '',
          quantity: i.quantity || 1,
          extent: i.extent || '',
          condition: i.condition || '',
        })),
      );
      setDecisions(
        Object.fromEntries(data.data.items.map((i) => [i.id, i.status === 'rejected' ? 'rejected' : 'accepted'])),
      );
    }
  }, [data]);
  const inval = [['accession', id], 'accessions'];
  const act = useApiMutation((b) => post(`/accessions/${id}/transition`, b), {
    success: 'Updated',
    invalidate: inval,
    onSuccess: () => setAction(null),
  });
  const saveItems = useApiMutation((b) => put(`/accessions/${id}/items`, { items: b }), {
    success: 'Items saved',
    invalidate: inval,
  });
  const q = useApiMutation((b) => post(`/accessions/${id}/quarantine`, b), {
    success: 'Updated',
    invalidate: inval,
    onSuccess: () => setQuarantine(null),
  });
  const link = useApiMutation((recordId) => post(`/accessions/${id}/link-records`, { recordIds: [recordId] }), {
    success: 'Linked',
    invalidate: inval,
  });
  const createCol = useApiMutation((b) => post(`/accessions/${id}/create-collection`, b), {
    success: 'Draft collection created',
    onSuccess: (r) => navigate(`/admin/records/${r.data.id}`),
  });
  const uploadDocs = useApiMutation(
    () => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      return api.post(`/accessions/${id}/documents`, fd).then((r) => r.data);
    },
    { success: 'Documents uploaded', invalidate: inval, onSuccess: () => setFiles([]) },
  );
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const a = data.data;
  const editable = ['draft', 'queried'].includes(a.status) && can('accession.create');
  const labels = {
    submit: 'Submit for approval',
    start_review: 'Start review',
    query: 'Query',
    approve: 'Approve',
    reject: 'Reject',
    close: 'Close',
  };
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Accessions', to: '/admin/accessions' }, { label: a.accessionNumber }]}
        eyebrow={a.accessionNumber}
        title={a.title}
        meta={
          <>
            <StatusBadge status={a.status} />
            {a.isQuarantined && (
              <Badge tone="red">
                <ShieldAlert className="h-3 w-3" /> Quarantined
              </Badge>
            )}
            {a.transferSubmission && (
              <Link
                to={`/admin/transfers/${a.transferSubmission.id}`}
                className="text-sm text-brand-700 hover:underline"
              >
                From transfer {a.transferSubmission.referenceNumber}
              </Link>
            )}
          </>
        }
        actions={
          <>
            {a.availableActions.map((x) => (
              <Button
                key={x}
                size="sm"
                variant={x === 'reject' ? 'danger' : x === 'query' ? 'secondary' : 'primary'}
                onClick={() => setAction(x)}
              >
                {labels[x]}
              </Button>
            ))}
            {editable && (
              <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
                Edit details
              </Button>
            )}
            {can('accession.create') && (
              <Button size="sm" variant="ghost" onClick={() => setQuarantine(a.isQuarantined ? 'release' : 'place')}>
                {a.isQuarantined ? 'Release quarantine' : 'Quarantine'}
              </Button>
            )}
            {['approved', 'closed'].includes(a.status) && (
              <Button
                size="sm"
                variant="secondary"
                icon={FileDown}
                onClick={() => download(`/accessions/${id}/receipt`)}
              >
                Receipt
              </Button>
            )}
          </>
        }
      />
      {a.missing.length > 0 && (
        <Alert tone="warning" className="mb-4" title="Missing information flagged">
          {a.missing.map(humanize).join(', ')}
        </Alert>
      )}
      {a.isQuarantined && (
        <Alert tone="danger" className="mb-4" title="Quarantined">
          {a.quarantineReason}
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'items', label: 'Items', count: a.items.length },
              { value: 'catalogue', label: 'Catalogue links', count: a.recordLinks.length },
              { value: 'physical', label: 'Physical items', count: a.physicalItems.length },
              { value: 'documents', label: 'Documents', count: a.documents.length },
              { value: 'history', label: 'History' },
            ]}
          />
          {tab === 'items' && (
            <Card>
              <CardHeader
                title="Items received"
                description={
                  a.status === 'under_review'
                    ? 'Choose accepted or rejected for each item before approving.'
                    : undefined
                }
                actions={
                  editable && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Plus}
                        onClick={() =>
                          setItems([...items, { description: '', format: '', quantity: 1, extent: '', condition: '' }])
                        }
                      >
                        Add item
                      </Button>
                      <Button
                        size="sm"
                        loading={saveItems.isPending}
                        onClick={() =>
                          saveItems.mutate(
                            items
                              .filter((i) => i.description.trim())
                              .map((i) => ({
                                ...i,
                                quantity: Number(i.quantity) || 1,
                                format: i.format || null,
                                extent: i.extent || null,
                                condition: i.condition || null,
                              })),
                          )
                        }
                      >
                        Save items
                      </Button>
                    </>
                  )
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas/70 text-xs uppercase text-ink-soft">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Format</th>
                      <th className="px-3 py-2 text-left">Qty</th>
                      <th className="px-3 py-2 text-left">Extent</th>
                      <th className="px-3 py-2 text-left">Condition</th>
                      <th className="px-3 py-2 text-left">Decision</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((it, i) => (
                      <tr key={it.id || i}>
                        <td className="px-3 py-2 text-xs text-ink-soft">{i + 1}</td>
                        {['description', 'format', 'quantity', 'extent', 'condition'].map((k) => (
                          <td key={k} className="px-1 py-1">
                            {editable ? (
                              <input
                                aria-label={`${k} ${i + 1}`}
                                value={it[k]}
                                onChange={(e) =>
                                  setItems(items.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))
                                }
                                className="h-8 w-full rounded-md border border-transparent px-1.5 hover:border-line focus:border-brand-600 focus:outline-none"
                              />
                            ) : (
                              <span className="px-1.5">{it[k]}</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-1">
                          {a.status === 'under_review' && can('accession.approve') && it.id ? (
                            <select
                              aria-label={`Decision ${i + 1}`}
                              value={decisions[it.id]}
                              onChange={(e) => setDecisions({ ...decisions, [it.id]: e.target.value })}
                              className="h-8 rounded-md border border-line px-1.5"
                            >
                              <option value="accepted">Accept</option>
                              <option value="rejected">Reject</option>
                            </select>
                          ) : (
                            <StatusBadge status={a.items[i]?.status} />
                          )}
                        </td>
                        <td>
                          {editable && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Remove item"
                              onClick={() => setItems(items.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!items.length && <CardBody className="text-sm text-ink-soft">No items recorded.</CardBody>}
            </Card>
          )}
          {tab === 'catalogue' && (
            <Card>
              <CardHeader
                title="Linked archival descriptions"
                actions={
                  a.status === 'approved' &&
                  can('records.create') && (
                    <Button size="sm" icon={Library} onClick={() => setColOpen(true)}>
                      Create collection from accession
                    </Button>
                  )
                }
              />
              <ul className="divide-y divide-line">
                {a.recordLinks.map((l) => (
                  <li key={l.id}>
                    <Link
                      to={`/admin/records/${l.record.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-canvas"
                    >
                      <span>
                        <span className="text-xs text-gold-700">{l.record.referenceCode}</span>{' '}
                        <span className="font-semibold">{l.record.title}</span>
                      </span>
                      <StatusBadge status={l.record.status} />
                    </Link>
                  </li>
                ))}
              </ul>
              {a.status === 'approved' && can('records.update') && (
                <CardBody className="border-t border-line">
                  <p className="mb-2 text-sm font-semibold">
                    <Link2 className="mr-1 inline h-4 w-4" />
                    Link an existing description
                  </p>
                  <RecordPicker onPick={(r) => link.mutate(r.id)} />
                </CardBody>
              )}
              {a.status !== 'approved' && !a.recordLinks.length && (
                <CardBody className="text-sm text-ink-soft">
                  Descriptions can be linked once the accession is approved.
                </CardBody>
              )}
            </Card>
          )}
          {tab === 'physical' && (
            <Card>
              <CardHeader
                title="Physical items and locations"
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    to={`/admin/storage/items?new=1&accessionId=${a.id}`}
                  >
                    Register physical item
                  </Button>
                }
              />
              <ul className="divide-y divide-line">
                {a.physicalItems.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/admin/storage/items/${p.id}`}
                      className="flex items-center justify-between px-5 py-3 text-sm hover:bg-canvas"
                    >
                      <span>
                        <span className="font-mono text-xs text-gold-700">{p.barcode}</span> {p.title}
                        <span className="block text-xs text-ink-soft">
                          {p.currentLocation
                            ? `${p.currentLocation.code} — ${p.currentLocation.name}`
                            : 'Location not assigned'}
                        </span>
                      </span>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
              {!a.physicalItems.length && (
                <CardBody className="text-sm text-ink-soft">
                  No physical items registered against this accession.
                </CardBody>
              )}
            </Card>
          )}
          {tab === 'documents' && (
            <Card>
              <CardHeader title="Supporting documents" />
              {can('accession.create') && (
                <CardBody className="flex flex-wrap items-center gap-3 border-b border-line">
                  <label className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-line px-4 py-3 text-sm text-ink-soft">
                    <input type="file" multiple className="sr-only" onChange={(e) => setFiles([...e.target.files])} />
                    <Paperclip className="mr-2 inline h-4 w-4" />
                    {files.length ? files.map((f) => f.name).join(', ') : 'Deeds of gift, agreements, inventories'}
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
              )}
              <ul className="divide-y divide-line">
                {a.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{d.originalFilename}</span>
                      <span className="block text-xs text-ink-soft">
                        {fmtBytes(d.sizeBytes)} · {fmtDateTime(d.createdAt)}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={FileDown}
                      onClick={() => download(`/accessions/${id}/documents/${d.id}`)}
                    >
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {tab === 'history' && (
            <Card>
              <CardBody>
                <Timeline items={a.history} />
              </CardBody>
            </Card>
          )}
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Accession details" />
            <CardBody>
              <MetaList
                columns={1}
                items={[
                  { label: 'Source', value: a.sourceUnit?.name || a.donorName || humanize(a.sourceType) },
                  { label: 'Accession date', value: fmtDate(a.accessionDate) },
                  { label: 'Transfer date', value: fmtDate(a.transferDate) },
                  { label: 'Contact', value: [a.contactPerson, a.contactEmail].filter(Boolean).join(' · ') },
                  { label: 'Transfer authority', value: a.transferAuthority },
                  { label: 'Legal basis', value: a.legalBasis },
                  { label: 'Extent', value: a.extent || (a.quantity && `${a.quantity} item(s)`) },
                  { label: 'Condition', value: a.physicalCondition },
                  { label: 'Provenance', value: a.provenance },
                  { label: 'Rights', value: a.rightsStatement },
                  { label: 'Restrictions', value: a.restrictionsNote },
                  { label: 'Embargo until', value: fmtDate(a.embargoUntil) },
                  { label: 'Responsible officer', value: a.responsibleOfficer?.fullName },
                  { label: 'Approved by', value: a.approvedBy && `${a.approvedBy.fullName}, ${fmtDate(a.approvedAt)}` },
                  { label: 'Receipt', value: a.receiptNumber },
                ]}
              />
            </CardBody>
          </Card>
          {a.approvals.length > 0 && (
            <Card>
              <CardHeader title="Approvals" />
              <ul className="divide-y divide-line">
                {a.approvals.map((x) => (
                  <li key={x.id} className="px-5 py-2.5 text-sm">
                    <StatusBadge status={x.decision} /> {x.approver?.fullName} · {fmtDate(x.createdAt)}
                    {x.reason && <p className="text-ink-soft">{x.reason}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={labels[action]}
        confirmLabel={labels[action]}
        tone={action === 'reject' ? 'danger' : 'primary'}
        loading={act.isPending}
        requireReason={['query', 'reject'].includes(action) ? true : 'optional'}
        description={
          action === 'approve'
            ? `${Object.values(decisions).filter((d) => d === 'accepted').length} of ${a.items.length} items will be accepted.`
            : action === 'submit' && a.missing.length
              ? `Missing information will be flagged to the approver: ${a.missing.map(humanize).join(', ')}`
              : undefined
        }
        onConfirm={({ reason }) =>
          act.mutate({
            action,
            reason,
            ...(action === 'approve' && {
              itemDecisions: Object.entries(decisions).map(([itemId, decision]) => ({ itemId, decision })),
            }),
          })
        }
      />
      <ConfirmDialog
        open={Boolean(quarantine)}
        onClose={() => setQuarantine(null)}
        title={quarantine === 'place' ? 'Place in quarantine' : 'Release from quarantine'}
        requireReason
        loading={q.isPending}
        onConfirm={({ reason }) => q.mutate({ quarantine: quarantine === 'place', reason })}
      />
      <EditDialog a={a} open={edit} onClose={() => setEdit(false)} />
      <Dialog
        open={colOpen}
        onClose={() => setColOpen(false)}
        title="Create a collection from this accession"
        description="A draft fonds or collection is created with details copied from the accession and linked to it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setColOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={createCol.isPending}
              disabled={!col.localIdentifier}
              onClick={() => createCol.mutate({ ...col, title: col.title || undefined })}
            >
              Create draft
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Level">
            <select
              className="h-10 w-full rounded-lg border border-line px-2"
              value={col.level}
              onChange={(e) => setCol({ ...col, level: e.target.value })}
            >
              <option value="fonds">Fonds</option>
              <option value="collection">Collection</option>
            </select>
          </Field>
          <Field label="Local identifier" required>
            <Input value={col.localIdentifier} onChange={(e) => setCol({ ...col, localIdentifier: e.target.value })} />
          </Field>
          <Field label="Title" help={`Defaults to “${a.title}”`}>
            <Input value={col.title} onChange={(e) => setCol({ ...col, title: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
