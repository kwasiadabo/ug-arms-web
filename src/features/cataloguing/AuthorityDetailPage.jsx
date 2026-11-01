/**
 * Authority record detail page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FileDown, Plus, Trash2, Pencil } from 'lucide-react';
import { download } from '../../lib/api.js';
import { useApi, useApiMutation, post, patch, del } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
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
  Dialog,
  Field,
  Input,
  Textarea,
  Select,
  Alert,
  ConfirmDialog,
} from '../../components/ui/index.js';
import { AuthorityPicker } from '../archival-records/Pickers.jsx';
import { humanize } from '../../utils/format.js';

const EDIT_FIELDS = [
  ['authorizedName', 'Authorised name'],
  ['datesOfExistence', 'Dates of existence'],
  ['identifier', 'Identifier'],
  ['places', 'Places'],
  ['legalStatus', 'Legal status'],
  ['history', 'History', true],
  ['functions', 'Functions, occupations and activities', true],
  ['mandates', 'Mandates / sources of authority', true],
  ['internalStructure', 'Internal structure / genealogy', true],
  ['generalContext', 'General context', true],
  ['sources', 'Sources', true],
];

/**
 * Shows an authority record with its description, the descriptions that name it as creator, and its relationships
 * to other authorities. Authorised users can edit it, add and remove relationships, export it as EAC-CPF, and merge
 * a duplicate into another record with a reason. Merging moves all links and keeps this record, marked as merged,
 * for traceability.
 *
 * @returns {JSX.Element}
 */
export default function AuthorityDetailPage() {
  const { id } = useParams();
  const { can } = useCan();
  const [edit, setEdit] = useState(false);
  const [rel, setRel] = useState(null);
  const [merge, setMerge] = useState(null);
  const { data, isLoading, error, refetch } = useApi(['authority', id], `/authority-records/${id}`);
  const { register, handleSubmit, reset } = useForm();
  useEffect(() => {
    if (data && edit)
      reset({
        ...Object.fromEntries(EDIT_FIELDS.map(([k]) => [k, data.data[k] ?? ''])),
        otherNames: (data.data.otherNames || []).join('; '),
        verificationStatus: data.data.verificationStatus,
        status: data.data.status,
      });
  }, [data, edit, reset]);
  const inval = [['authority', id], 'authorities'];
  const save = useApiMutation((b) => patch(`/authority-records/${id}`, b), {
    success: 'Saved',
    invalidate: inval,
    onSuccess: () => setEdit(false),
  });
  const addRel = useApiMutation((b) => post(`/authority-records/${id}/relationships`, b), {
    success: 'Relationship added',
    invalidate: inval,
    onSuccess: () => setRel(null),
  });
  const removeRel = useApiMutation((relId) => del(`/authority-records/${id}/relationships/${relId}`), {
    success: 'Removed',
    invalidate: inval,
  });
  const doMerge = useApiMutation(
    ({ reason }) => post(`/authority-records/${id}/merge`, { targetId: merge.id, reason, confirm: true }),
    { success: 'Merged', invalidate: inval, onSuccess: () => setMerge(null) },
  );
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const a = data.data;
  const editable = can('authority.manage') && a.status !== 'merged';
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Authority records', to: '/admin/authorities' }, { label: a.authorizedName }]}
        eyebrow={humanize(a.entityType)}
        title={a.authorizedName}
        meta={
          <>
            <StatusBadge status={a.status} />
            <Badge tone={a.verificationStatus === 'verified' ? 'green' : 'neutral'}>
              {humanize(a.verificationStatus)}
            </Badge>
            {a.datesOfExistence && <span className="text-sm text-ink-soft">{a.datesOfExistence}</span>}
          </>
        }
        actions={
          <>
            {editable && (
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={FileDown}
              onClick={() => download(`/authority-records/${id}/export/eac`)}
            >
              EAC-CPF
            </Button>
          </>
        }
      />
      {a.status === 'merged' && (
        <Alert tone="info" className="mb-4">
          Merged into{' '}
          <Link className="font-semibold underline" to={`/admin/authorities/${a.mergedInto?.id}`}>
            {a.mergedInto?.authorizedName}
          </Link>
          .
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Description" />
            <CardBody>
              <MetaList
                items={[
                  { label: 'Other names', value: a.otherNames, wide: true },
                  { label: 'Identifier', value: a.identifier },
                  { label: 'Places', value: a.places },
                  { label: 'Legal status', value: a.legalStatus },
                  { label: 'History', value: a.history, wide: true },
                  { label: 'Functions', value: a.functions, wide: true },
                  { label: 'Mandates', value: a.mandates, wide: true },
                  { label: 'Internal structure', value: a.internalStructure, wide: true },
                  { label: 'General context', value: a.generalContext, wide: true },
                  { label: 'Sources', value: a.sources, wide: true },
                  { label: 'Organisation unit', value: a.organisationUnit?.name },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Linked descriptions" description="Descriptions that name this authority as creator" />
            <ul className="divide-y divide-line">
              {a.linkedRecords.map((r) => (
                <li key={`${r.id}-${r.role}`}>
                  <Link to={`/admin/records/${r.id}`} className="block px-5 py-3 text-sm hover:bg-canvas">
                    <span className="text-xs text-gold-700">{r.referenceCode}</span>{' '}
                    <span className="font-semibold">{r.title}</span>{' '}
                    <span className="text-xs text-ink-soft">({r.role})</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!a.linkedRecords.length && (
              <CardBody className="text-sm text-ink-soft">Not yet linked to any description.</CardBody>
            )}
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader
              title="Relationships"
              actions={
                editable && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    onClick={() => setRel({ relationType: 'associative', dates: '', note: '' })}
                  >
                    Add
                  </Button>
                )
              }
            />
            <ul className="divide-y divide-line">
              {a.relationships.outgoing.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <span>
                    {humanize(r.relationType)} →{' '}
                    <Link className="font-semibold hover:underline" to={`/admin/authorities/${r.target.id}`}>
                      {r.target.authorizedName}
                    </Link>
                  </span>
                  {editable && (
                    <button type="button" aria-label="Remove relationship" onClick={() => removeRel.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-ink-soft" />
                    </button>
                  )}
                </li>
              ))}
              {a.relationships.incoming.map((r) => (
                <li key={r.id} className="px-5 py-2.5 text-sm">
                  <Link className="font-semibold hover:underline" to={`/admin/authorities/${r.source.id}`}>
                    {r.source.authorizedName}
                  </Link>{' '}
                  → {humanize(r.relationType)}
                </li>
              ))}
            </ul>
            {!a.relationships.outgoing.length && !a.relationships.incoming.length && (
              <CardBody className="text-sm text-ink-soft">No relationships.</CardBody>
            )}
          </Card>
          {editable && (
            <Card>
              <CardHeader
                title="Merge duplicate"
                description="Moves links from this record into another and marks this one as merged."
              />
              <CardBody>
                <AuthorityPicker entityType={a.entityType} onPick={(t) => t.id !== a.id && setMerge(t)} />
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
      <Dialog
        open={edit}
        onClose={() => setEdit(false)}
        size="xl"
        title="Edit authority record"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              onClick={handleSubmit((v) =>
                save.mutate({
                  ...Object.fromEntries(
                    Object.entries(v)
                      .filter(([k]) => k !== 'otherNames')
                      .map(([k, x]) => [k, x === '' ? null : x]),
                  ),
                  authorizedName: v.authorizedName,
                  otherNames: v.otherNames
                    ? v.otherNames
                        .split(';')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : [],
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
          {EDIT_FIELDS.map(([k, l, area]) => (
            <Field key={k} label={l} className={area ? 'sm:col-span-2' : ''}>
              {area ? <Textarea rows={3} {...register(k)} /> : <Input {...register(k)} />}
            </Field>
          ))}
          <Field label="Other names" help="Separate with semicolons" className="sm:col-span-2">
            <Input {...register('otherNames')} />
          </Field>
          <Field label="Verification">
            <Select {...register('verificationStatus')}>
              {['unverified', 'provisional', 'verified'].map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select {...register('status')}>
              {['draft', 'approved', 'deprecated'].map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(rel)}
        onClose={() => setRel(null)}
        title="Add relationship"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRel(null)}>
              Cancel
            </Button>
            <Button
              disabled={!rel?.targetId}
              loading={addRel.isPending}
              onClick={() =>
                addRel.mutate({
                  targetId: rel.targetId,
                  relationType: rel.relationType,
                  dates: rel.dates || undefined,
                  note: rel.note || undefined,
                })
              }
            >
              Add
            </Button>
          </>
        }
      >
        {rel && (
          <div className="space-y-4">
            <Field label="Relationship">
              <Select value={rel.relationType} onChange={(e) => setRel({ ...rel, relationType: e.target.value })}>
                {[
                  'hierarchical_parent',
                  'hierarchical_child',
                  'predecessor',
                  'successor',
                  'family',
                  'associative',
                  'member_of',
                  'head_of',
                ].map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <p className="mb-1 text-[13px] font-semibold">
                Related authority {rel.targetName && <span className="font-normal">— {rel.targetName}</span>}
              </p>
              <AuthorityPicker onPick={(t) => setRel({ ...rel, targetId: t.id, targetName: t.label })} />
            </div>
            <Field label="Dates">
              <Input value={rel.dates} onChange={(e) => setRel({ ...rel, dates: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(merge)}
        onClose={() => setMerge(null)}
        title={`Merge into “${merge?.label}”?`}
        description="All creator and subject links move to the target. This record is kept as merged for traceability."
        tone="danger"
        requireReason
        confirmLabel="Merge"
        loading={doMerge.isPending}
        onConfirm={({ reason }) => doMerge.mutate({ reason })}
      />
    </div>
  );
}
