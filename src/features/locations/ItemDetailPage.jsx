/**
 * Physical item detail page.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MoveRight, AlertOctagon, Stethoscope, Printer } from 'lucide-react';
import { download, errorMessage } from '../../lib/api.js';
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
  Badge,
  PageLoader,
  ErrorState,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  Checkbox,
  Alert,
  ConfirmDialog,
} from '../../components/ui/index.js';
import { LocationPicker } from './ItemsPage.jsx';
import { fmtDateTime, humanize } from '../../utils/format.js';

/**
 * Shows an item with its details and its complete movement, condition and circulation history. Authorised users can
 * record a movement (with an authorised capacity override where needed), record a condition assessment, report the
 * item missing with a reason, and print its label. Issued, disposed and withdrawn items cannot be moved here.
 *
 * @returns {JSX.Element}
 */
export default function ItemDetailPage() {
  const { id } = useParams();
  const { can } = useCan();
  const [move, setMove] = useState(null);
  const [cond, setCond] = useState(null);
  const [missing, setMissing] = useState(false);
  const [moveError, setMoveError] = useState(null);
  const { data, isLoading, error, refetch } = useApi(['physical-item', id], `/physical-items/${id}`);
  const inval = [['physical-item', id], 'physical-items'];
  const doMove = useApiMutation((b) => post(`/physical-items/${id}/move`, b), {
    success: 'Movement recorded',
    invalidate: inval,
    silentError: true,
    onSuccess: () => {
      setMove(null);
      setMoveError(null);
    },
    onError: (e) => setMoveError(errorMessage(e)),
  });
  const doCond = useApiMutation((b) => post(`/physical-items/${id}/condition`, b), {
    success: 'Condition recorded',
    invalidate: inval,
    onSuccess: () => setCond(null),
  });
  const doMissing = useApiMutation((b) => post(`/physical-items/${id}/report-missing`, b), {
    success: 'Reported missing',
    invalidate: inval,
    onSuccess: () => setMissing(false),
  });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const i = data.data;
  const movable = !['issued', 'disposed', 'withdrawn'].includes(i.status) && can('physical.move');
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Physical items', to: '/admin/storage/items' }, { label: i.barcode }]}
        eyebrow={`${humanize(i.itemType)} · ${i.barcode}`}
        title={i.title}
        meta={
          <>
            <StatusBadge status={i.status} />
            <Badge
              tone={
                i.conditionRating === 'good'
                  ? 'green'
                  : ['poor', 'critical'].includes(i.conditionRating)
                    ? 'red'
                    : 'neutral'
              }
            >
              Condition: {humanize(i.conditionRating)}
            </Badge>
            {i.isFragile && <Badge tone="amber">Fragile</Badge>}
          </>
        }
        actions={
          <>
            {movable && (
              <Button
                size="sm"
                icon={MoveRight}
                onClick={() => {
                  setMoveError(null);
                  setMove({ movementType: 'permanent', reason: '', override: false, overrideReason: '' });
                }}
              >
                Move
              </Button>
            )}
            {can('physical.move') && (
              <Button
                size="sm"
                variant="secondary"
                icon={Stethoscope}
                onClick={() => setCond({ context: 'routine', rating: 'good', notes: '', recommendedAction: '' })}
              >
                Condition report
              </Button>
            )}
            {can('physical.move') && i.status !== 'missing' && (
              <Button size="sm" variant="ghost" icon={AlertOctagon} onClick={() => setMissing(true)}>
                Report missing
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={Printer}
              onClick={() => download('/locations/labels', { method: 'post', data: { itemIds: [i.id] } })}
            >
              Label
            </Button>
          </>
        }
      />
      {i.status === 'issued' && (
        <Alert tone="info" className="mb-4">
          This item is issued in the reading room. It can only be moved after its return is recorded at the circulation
          desk.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Movement history"
              description="Source, destination, reason and operator for every move"
            />
            <ul className="divide-y divide-line">
              {i.movements.map((m) => (
                <li key={m.id} className="px-5 py-3 text-sm">
                  <p className="font-semibold">
                    {humanize(m.movementType)}: {m.fromLocation?.code || '—'} →{' '}
                    {m.toLocation?.code || (m.movementType === 'issue' ? 'Reading room' : '—')}
                  </p>
                  <p className="text-ink-soft">
                    {m.reason}
                    {m.capacityOverride && (
                      <Badge tone="amber" className="ml-2">
                        Capacity override
                      </Badge>
                    )}
                  </p>
                  {m.overrideReason && <p className="text-xs text-amber-800">Override: {m.overrideReason}</p>}
                  <p className="text-xs text-ink-soft">
                    {m.movedBy?.fullName} · {fmtDateTime(m.movedAt)}
                    {m.expectedReturnAt ? ` · return by ${fmtDateTime(m.expectedReturnAt)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Condition assessments" />
            <ul className="divide-y divide-line">
              {i.conditions.map((c) => (
                <li key={c.id} className="px-5 py-3 text-sm">
                  <StatusBadge status={c.rating} /> <span className="font-semibold">{humanize(c.context)}</span>
                  <p className="text-ink-soft">{c.notes}</p>
                  {c.recommendedAction && <p className="text-xs">Action: {c.recommendedAction}</p>}
                  <p className="text-xs text-ink-soft">
                    {c.assessedBy?.fullName} · {fmtDateTime(c.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
            {!i.conditions.length && <CardBody className="text-sm text-ink-soft">No assessments.</CardBody>}
          </Card>
          {i.circulations.length > 0 && (
            <Card>
              <CardHeader title="Circulation" />
              <ul className="divide-y divide-line">
                {i.circulations.map((c) => (
                  <li key={c.id} className="px-5 py-2.5 text-sm">
                    <StatusBadge status={c.status} /> {c.researcherName} · issued {fmtDateTime(c.issuedAt)}
                    {c.returnedAt && ` · returned ${fmtDateTime(c.returnedAt)}`}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <MetaList
              columns={1}
              items={[
                {
                  label: 'Current location',
                  value: i.currentLocation && (
                    <Link
                      className="text-brand-700 hover:underline"
                      to={`/admin/storage/locations/${i.currentLocation.id}`}
                    >
                      {i.currentLocation.code} — {i.currentLocation.name}
                    </Link>
                  ),
                },
                { label: 'Home location', value: i.homeLocation && `${i.homeLocation.code} — ${i.homeLocation.name}` },
                {
                  label: 'Description',
                  value: i.record && (
                    <Link className="text-brand-700 hover:underline" to={`/admin/records/${i.record.id}`}>
                      {i.record.referenceCode} — {i.record.title}
                    </Link>
                  ),
                },
                {
                  label: 'Accession',
                  value: i.accession && (
                    <Link className="text-brand-700 hover:underline" to={`/admin/accessions/${i.accession.id}`}>
                      {i.accession.accessionNumber}
                    </Link>
                  ),
                },
                { label: 'Size', value: `${Number(i.sizeUnits)} unit(s)` },
                { label: 'Material', value: i.materialType },
                { label: 'Handling', value: i.handlingNotes },
                { label: 'Notes', value: i.notes },
              ]}
            />
          </CardBody>
        </Card>
      </div>
      <Dialog
        open={Boolean(move)}
        onClose={() => setMove(null)}
        title="Record a movement"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMove(null)}>
              Cancel
            </Button>
            <Button
              loading={doMove.isPending}
              disabled={!move?.toLocationId || (move?.reason || '').length < 3}
              onClick={() =>
                doMove.mutate({
                  toLocationId: move.toLocationId,
                  movementType: move.movementType,
                  reason: move.reason,
                  expectedReturnAt: move.expectedReturnAt ? new Date(move.expectedReturnAt).toISOString() : undefined,
                  override: move.override || undefined,
                  overrideReason: move.override ? move.overrideReason : undefined,
                })
              }
            >
              Record move
            </Button>
          </>
        }
      >
        {move && (
          <div className="space-y-4">
            {moveError && <Alert tone="danger">{moveError}</Alert>}
            <div>
              <p className="mb-1 text-[13px] font-semibold">
                Destination {move.toLabel && <span className="font-normal">— {move.toLabel}</span>}
              </p>
              <LocationPicker onPick={(l) => setMove({ ...move, toLocationId: l.id, toLabel: l.label })} />
            </div>
            <Field label="Type">
              <Select value={move.movementType} onChange={(e) => setMove({ ...move, movementType: e.target.value })}>
                <option value="permanent">Permanent relocation</option>
                <option value="temporary">Temporary relocation</option>
                <option value="conservation">To conservation</option>
                <option value="audit_correction">Audit correction</option>
              </Select>
            </Field>
            {move.movementType === 'temporary' && (
              <Field label="Expected return">
                <Input
                  type="datetime-local"
                  value={move.expectedReturnAt || ''}
                  onChange={(e) => setMove({ ...move, expectedReturnAt: e.target.value })}
                />
              </Field>
            )}
            <Field label="Reason" required>
              <Input value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} />
            </Field>
            {can('physical.override_capacity') && (
              <Checkbox
                label="Override capacity if the destination is full"
                checked={move.override}
                onChange={(e) => setMove({ ...move, override: e.target.checked })}
              />
            )}
            {move.override && (
              <Field label="Override reason" required>
                <Input
                  value={move.overrideReason}
                  onChange={(e) => setMove({ ...move, overrideReason: e.target.value })}
                />
              </Field>
            )}
          </div>
        )}
      </Dialog>
      <Dialog
        open={Boolean(cond)}
        onClose={() => setCond(null)}
        title="Condition report"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCond(null)}>
              Cancel
            </Button>
            <Button
              loading={doCond.isPending}
              onClick={() =>
                doCond.mutate({
                  ...cond,
                  notes: cond.notes || undefined,
                  recommendedAction: cond.recommendedAction || undefined,
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        {cond && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Context">
              <Select value={cond.context} onChange={(e) => setCond({ ...cond, context: e.target.value })}>
                {['routine', 'accession', 'audit', 'conservation', 'digitisation'].map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rating">
              <Select value={cond.rating} onChange={(e) => setCond({ ...cond, rating: e.target.value })}>
                {['good', 'fair', 'poor', 'critical'].map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea rows={3} value={cond.notes} onChange={(e) => setCond({ ...cond, notes: e.target.value })} />
            </Field>
            <Field label="Recommended action" className="sm:col-span-2">
              <Input
                value={cond.recommendedAction}
                onChange={(e) => setCond({ ...cond, recommendedAction: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={missing}
        onClose={() => setMissing(false)}
        title="Report this item missing?"
        tone="danger"
        requireReason
        loading={doMissing.isPending}
        onConfirm={({ reason }) => doMissing.mutate({ reason })}
      />
    </div>
  );
}
