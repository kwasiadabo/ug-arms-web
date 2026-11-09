/**
 * The Digitisation tab of an accession: how much of its material is digitised, the projects and batches that include
 * it, and, for digitisation managers, proposing a project and planning batches from the accession.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ScanLine } from 'lucide-react';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from '../../components/ui/index.js';
import { FitTable } from '../../components/tables/FitTable.jsx';
import { UserPicker } from '../archival-records/Pickers.jsx';

const STATE = {
  digitised: { label: 'Digitised', tone: 'green' },
  in_batch: { label: 'In a batch', tone: 'amber' },
  not_started: { label: 'Not started', tone: 'neutral' },
};

/**
 * Dialog that proposes a project for the accession; a different person approves it before batches can be planned.
 *
 * @param {object} props
 * @param {object} props.accession The accession.
 * @param {() => void} props.onClose Called to close the dialog.
 * @returns {JSX.Element}
 */
function ProposeProjectDialog({ accession, onClose }) {
  const [title, setTitle] = useState(`Digitisation of ${accession.title} (${accession.accessionNumber})`);
  const [description, setDescription] = useState('');
  const propose = useApiMutation((b) => post(`/digitisation/accessions/${accession.id}/projects`, b), {
    success: 'Project created. It needs approval by someone else before batches can be planned.',
    invalidate: [['accession-digitisation', accession.id]],
    onSuccess: onClose,
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Create a digitisation project"
      description="Linked to this accession. Another authorised person approves it before any batch is planned."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={propose.isPending}
            disabled={title.trim().length < 3}
            onClick={() => propose.mutate({ title: title.trim(), description: description.trim() || undefined })}
          >
            Create project
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <Input value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Purpose" help="For example preservation of fragile material, or research demand">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

/**
 * Dialog that creates a batch in a project linked to the accession, filled with the boxes chosen from those not yet
 * digitised or planned, and optionally the described items that are not in a box.
 *
 * @param {object} props
 * @param {object} props.accession The accession.
 * @param {object} props.summary The accession's digitisation summary.
 * @param {() => void} props.onClose Called to close the dialog.
 * @returns {JSX.Element}
 */
function PlanBatchDialog({ accession, summary, onClose }) {
  const projects = summary.projects.filter((p) => p.linked && ['approved', 'active'].includes(p.status));
  const boxes = summary.boxes.filter((b) => b.state === 'not_started');
  const loose = summary.unboxed.filter((u) => u.state === 'not_started');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [chosen, setChosen] = useState(boxes.map((b) => b.physicalItemId));
  const [includeUnboxed, setIncludeUnboxed] = useState(loose.length > 0);
  const [operator, setOperator] = useState(null);
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const plan = useApiMutation((b) => post(`/digitisation/accessions/${accession.id}/batches`, b), {
    success: (r) => `Batch ${r.data.batch.batchNumber} planned with ${r.data.items.length} item(s)`,
    invalidate: [['accession-digitisation', accession.id]],
    onSuccess: onClose,
  });
  const count = chosen.length + (includeUnboxed ? loose.length : 0);
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Plan a digitisation batch"
      description="Only material not yet digitised or already in a batch is offered."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={plan.isPending}
            disabled={!projectId || count === 0}
            onClick={() =>
              plan.mutate({
                projectId,
                physicalItemIds: chosen,
                includeUnboxed,
                operatorId: operator?.id,
                ocrEnabled,
              })
            }
          >
            Plan batch with {count} item{count === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Project" required>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.title}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-semibold">Boxes and volumes</p>
          {boxes.length ? (
            <ul className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-line p-3">
              {boxes.map((b) => (
                <li key={b.physicalItemId}>
                  <Checkbox
                    label={`${b.barcode} · ${b.title}`}
                    checked={chosen.includes(b.physicalItemId)}
                    onChange={(e) =>
                      setChosen((c) =>
                        e.target.checked ? [...c, b.physicalItemId] : c.filter((x) => x !== b.physicalItemId),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Every registered box is already digitised or in a batch.</p>
          )}
        </div>
        {loose.length > 0 && (
          <Checkbox
            label={`Include ${loose.length} described item${loose.length === 1 ? '' : 's'} not in a box`}
            description={loose
              .map((u) => u.description)
              .join('; ')
              .slice(0, 200)}
            checked={includeUnboxed}
            onChange={(e) => setIncludeUnboxed(e.target.checked)}
          />
        )}
        <div>
          <p className="mb-1 text-[13px] font-semibold">
            Operator {operator && <span className="font-normal">— {operator.label}</span>}
          </p>
          <UserPicker
            permission="digitisation.capture"
            placeholder="The Digitisation Officer who will capture it (optional)"
            onPick={(u) => setOperator(u)}
          />
        </div>
        <Checkbox
          label="Run OCR on the captured files"
          checked={ocrEnabled}
          onChange={(e) => setOcrEnabled(e.target.checked)}
        />
      </div>
    </Dialog>
  );
}

/**
 * Shows the digitisation of an accession's material and, for digitisation managers, the actions to plan more.
 *
 * @param {object} props
 * @param {object} props.accession The accession.
 * @returns {JSX.Element}
 */
export function AccessionDigitisation({ accession }) {
  const { can, canAny } = useCan();
  const { data, isLoading, error } = useApi(
    ['accession-digitisation', accession.id],
    `/accessions/${accession.id}/digitisation`,
  );
  const [dialog, setDialog] = useState(null);
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  const s = data.data;
  const manage = can('digitisation.manage') && s.canPlan;
  const openProject = s.projects.find((p) => p.linked && ['proposed', 'approved', 'active'].includes(p.status));
  const plannable = s.projects.some((p) => p.linked && ['approved', 'active'].includes(p.status));
  const seesBatches = canAny('digitisation.manage', 'digitisation.capture', 'digitisation.qa');
  const pct = s.counts.total ? Math.round((s.counts.digitised / s.counts.total) * 100) : 0;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Digitisation"
          description={
            s.counts.total
              ? `${s.counts.digitised} of ${s.counts.total} digitised · ${s.counts.inBatch} in a batch · ${s.counts.notStarted} not started`
              : 'No registered boxes or described items to digitise yet.'
          }
          actions={
            manage && (
              <>
                {!openProject && (
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => setDialog('propose')}>
                    Create project
                  </Button>
                )}
                {plannable && s.counts.notStarted > 0 && (
                  <Button size="sm" icon={ScanLine} onClick={() => setDialog('plan')}>
                    Plan batch
                  </Button>
                )}
              </>
            )
          }
        />
        <CardBody className="space-y-3">
          {!s.canPlan && <Alert tone="info">{s.reason}</Alert>}
          {openProject?.status === 'proposed' && (
            <Alert tone="info">
              Project {openProject.code} is waiting for approval. Batches can be planned once someone other than the
              proposer approves it.
            </Alert>
          )}
          {s.counts.total > 0 && (
            <div aria-label={`${pct}% digitised`} className="h-2 w-full overflow-hidden rounded-full bg-canvas">
              <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
            </div>
          )}
        </CardBody>
      </Card>

      {s.projects.length > 0 && (
        <Card>
          <CardHeader title="Projects and batches" />
          <ul className="divide-y divide-line">
            {s.projects.map((p) => (
              <li key={p.id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {seesBatches ? (
                    <Link
                      to={`/admin/digitisation/projects/${p.id}`}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {p.code} · {p.title}
                    </Link>
                  ) : (
                    <span className="font-semibold">
                      {p.code} · {p.title}
                    </span>
                  )}
                  <StatusBadge status={p.status} />
                  {!p.linked && <Badge>Includes items from this accession</Badge>}
                </div>
                {p.batches.length ? (
                  <ul className="space-y-1 text-sm">
                    {p.batches.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center gap-2">
                        {seesBatches ? (
                          <Link
                            to={`/admin/digitisation/batches/${b.id}`}
                            className="font-mono text-xs text-brand-700 hover:underline"
                          >
                            {b.batchNumber}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">{b.batchNumber}</span>
                        )}
                        <StatusBadge status={b.status} />
                        <span className="text-ink-soft">
                          {b.qaPassed} of {b.items} item{b.items === 1 ? '' : 's'} passed quality review ·{' '}
                          {b.percentComplete}% complete
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-soft">No batches yet.</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {s.boxes.length + s.unboxed.length > 0 && (
        <Card>
          <CardHeader title="Material" description="Registered boxes and volumes, and described items not in a box" />
          <FitTable watch={s.boxes.length + s.unboxed.length}>
            <thead className="bg-canvas/70 text-xs uppercase text-ink-soft">
              <tr>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-left">State</th>
                <th className="px-4 py-2 text-left">Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ...s.boxes.map((b) => ({ key: b.physicalItemId, name: `${b.barcode} · ${b.title}`, ...b })),
                ...s.unboxed.map((u) => ({ key: u.accessionItemId, name: `${u.description} (not in a box)`, ...u })),
              ].map((m) => (
                <tr key={m.key}>
                  <td data-label="Item" className="px-4 py-2">
                    {m.physicalItemId ? (
                      <Link to={`/admin/storage/items/${m.physicalItemId}`} className="text-brand-700 hover:underline">
                        {m.name}
                      </Link>
                    ) : (
                      m.name
                    )}
                  </td>
                  <td data-label="State" className="px-4 py-2">
                    <Badge tone={STATE[m.state].tone}>{STATE[m.state].label}</Badge>
                  </td>
                  <td data-label="Batch" className="px-4 py-2 font-mono text-xs">
                    {m.batchNumber || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </FitTable>
        </Card>
      )}

      {dialog === 'propose' && <ProposeProjectDialog accession={accession} onClose={() => setDialog(null)} />}
      {dialog === 'plan' && <PlanBatchDialog accession={accession} summary={s} onClose={() => setDialog(null)} />}
    </div>
  );
}
