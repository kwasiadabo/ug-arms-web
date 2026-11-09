/**
 * Dialog that registers an approved accession's boxes as physical items in one step.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useRef, useState } from 'react';
import { useApi, useApiMutation, post } from '../../lib/query.js';
import { useCan } from '../../hooks/useCan.js';
import { Alert, Button, Checkbox, Dialog, Field, Input, Skeleton } from '../../components/ui/index.js';
import { errorMessage } from '../../lib/api.js';
import { LocationPicker } from '../locations/ItemsPage.jsx';

/**
 * Lists the boxes not yet registered, grouped from the accepted items by the department's box number. For each box
 * the archivist scans or types its barcode (Enter moves to the next box, as a scanner sends it) or chooses Generate,
 * and can adjust the suggested title. All chosen boxes go to one location unless a box is given its own. Registering
 * is all or nothing: if any box is refused, for example because a shelf is full, nothing is saved and the message
 * names the box.
 *
 * @param {object} props
 * @param {string} props.accessionId The accession.
 * @param {() => void} props.onClose Called to close the dialog.
 * @returns {JSX.Element}
 */
export function RegisterBoxesDialog({ accessionId, onClose }) {
  const { can } = useCan();
  const plan = useApi(['accession-boxes', accessionId], `/accessions/${accessionId}/boxes`);
  const [rows, setRows] = useState([]);
  const [location, setLocation] = useState(null);
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const inputs = useRef([]);
  const open = (plan.data?.data.boxes || []).filter((b) => !b.registered);

  useEffect(() => {
    if (!plan.data) return;
    setRows(
      plan.data.data.boxes
        .filter((b) => !b.registered)
        .map((b) => ({
          boxNumber: b.boxNumber,
          include: true,
          barcode: '',
          generateBarcode: false,
          title: b.suggestedTitle,
          location: null,
        })),
    );
  }, [plan.data]);

  const register = useApiMutation((body) => post(`/accessions/${accessionId}/boxes`, body), {
    success: (r) => `${r.data.length} box${r.data.length === 1 ? '' : 'es'} registered`,
    invalidate: [
      ['accession', accessionId],
      ['accession-boxes', accessionId],
    ],
    onSuccess: onClose,
  });

  /**
   * Changes one box's settings.
   *
   * @param {number} i Box index.
   * @param {object} patch Fields to change.
   */
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const chosen = rows.filter((r) => r.include);
  const ready =
    chosen.length > 0 &&
    chosen.every((r) => (r.generateBarcode || r.barcode.trim()) && (r.location || location)) &&
    (!override || overrideReason.trim().length >= 3);

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title="Register boxes"
      description="One physical item per box, linked to this accession and to every item packed in the box."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ready}
            loading={register.isPending}
            onClick={() =>
              register.mutate({
                boxes: chosen.map((r) => ({
                  boxNumber: r.boxNumber,
                  barcode: r.generateBarcode ? undefined : r.barcode.trim(),
                  generateBarcode: r.generateBarcode,
                  title: r.title.trim() || undefined,
                  locationId: (r.location || location).id,
                  override: override || undefined,
                  overrideReason: override ? overrideReason.trim() : undefined,
                })),
              })
            }
          >
            Register {chosen.length || ''} box{chosen.length === 1 ? '' : 'es'}
          </Button>
        </>
      }
    >
      {plan.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : plan.error ? (
        <Alert tone="danger">{errorMessage(plan.error)}</Alert>
      ) : !plan.data.data.canRegister ? (
        <Alert tone="info">{plan.data.data.reason}</Alert>
      ) : !open.length ? (
        <Alert tone="success">
          Every box on this accession is registered.
          {plan.data.data.unboxedCount > 0 &&
            ` ${plan.data.data.unboxedCount} accepted item(s) have no box number; register those individually.`}
        </Alert>
      ) : (
        <div className="space-y-4">
          {register.error && <Alert tone="danger">{errorMessage(register.error)}</Alert>}
          <Field label="Shelve on" required help="Every box goes here unless you give it its own location below">
            <div>
              {location && <p className="mb-1 text-sm font-semibold">{location.label}</p>}
              <LocationPicker onPick={(l) => setLocation(l)} />
            </div>
          </Field>
          <ol className="divide-y divide-line rounded-lg border border-line">
            {rows.map((r, i) => {
              const box = open[i];
              return (
                <li key={r.boxNumber} className={`space-y-3 p-3 ${r.include ? '' : 'opacity-60'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Checkbox
                      label={/^box\b/i.test(r.boxNumber) ? r.boxNumber : `Box ${r.boxNumber}`}
                      description={`${box.items.length} item${box.items.length === 1 ? '' : 's'}: ${box.items
                        .map((x) => x.description)
                        .join('; ')
                        .slice(0, 160)}`}
                      checked={r.include}
                      onChange={(e) => set(i, { include: e.target.checked })}
                    />
                  </div>
                  {r.include && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Barcode" required>
                        <div className="flex items-center gap-3">
                          <Input
                            ref={(el) => {
                              inputs.current[i] = el;
                            }}
                            value={r.generateBarcode ? '' : r.barcode}
                            disabled={r.generateBarcode}
                            placeholder={r.generateBarcode ? 'Generated on registering' : 'Scan or type'}
                            autoFocus={i === 0}
                            maxLength={120}
                            onChange={(e) => set(i, { barcode: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              inputs.current
                                .slice(i + 1)
                                .find(Boolean)
                                ?.focus();
                            }}
                          />
                          <Checkbox
                            label="Generate"
                            checked={r.generateBarcode}
                            onChange={(e) => set(i, { generateBarcode: e.target.checked })}
                          />
                        </div>
                      </Field>
                      <Field label="Title / label">
                        <Input value={r.title} maxLength={1000} onChange={(e) => set(i, { title: e.target.value })} />
                      </Field>
                      <div className="sm:col-span-2">
                        {r.location ? (
                          <p className="text-sm">
                            Own location: <span className="font-semibold">{r.location.label}</span>{' '}
                            <button
                              type="button"
                              className="text-brand-700 hover:underline"
                              onClick={() => set(i, { location: null, picking: false })}
                            >
                              Use the shared location
                            </button>
                          </p>
                        ) : r.picking ? (
                          <LocationPicker onPick={(l) => set(i, { location: l, picking: false })} />
                        ) : (
                          <button
                            type="button"
                            className="text-sm text-brand-700 hover:underline"
                            onClick={() => set(i, { picking: true })}
                          >
                            Shelve this box elsewhere
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {plan.data.data.unboxedCount > 0 && (
            <p className="text-sm text-ink-soft">
              {plan.data.data.unboxedCount} accepted item(s) have no box number and are not listed; register them
              individually with Register physical item.
            </p>
          )}
          {can('physical.override_capacity') && (
            <div className="space-y-2">
              <Checkbox
                label="Override capacity if a location is full"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              {override && (
                <Field label="Override reason" required>
                  <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                </Field>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
