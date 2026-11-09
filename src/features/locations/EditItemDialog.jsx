/**
 * Dialog for changing a physical item's details after it has been registered.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { useApiMutation, patch } from '../../lib/query.js';
import { Button, Checkbox, Dialog, Field, Input, Select, Textarea } from '../../components/ui/index.js';
import { RecordPicker } from '../archival-records/Pickers.jsx';
import { humanize } from '../../utils/format.js';
import { ITEM_TYPES } from './ItemsPage.jsx';

/**
 * Edits an item's title, type, linked description, material, size, fragility and notes. The barcode stays as it is,
 * because it identifies the item on its label, and the location changes only through a recorded movement. Every
 * change is recorded in the audit trail.
 *
 * @param {object} props
 * @param {object} props.item The item, with its linked description if any.
 * @param {() => void} props.onClose Called to close the dialog.
 * @returns {JSX.Element}
 */
export function EditItemDialog({ item, onClose }) {
  const [f, setF] = useState({
    title: item.title,
    itemType: item.itemType,
    materialType: item.materialType || '',
    sizeUnits: String(Number(item.sizeUnits ?? 1)),
    isFragile: Boolean(item.isFragile),
    handlingNotes: item.handlingNotes || '',
    notes: item.notes || '',
  });
  const [record, setRecord] = useState(
    item.record ? { id: item.record.id, label: `${item.record.referenceCode} — ${item.record.title}` } : null,
  );
  const save = useApiMutation((b) => patch(`/physical-items/${item.id}`, b), {
    success: 'Item details saved',
    invalidate: [['physical-item', item.id], 'physical-items'],
    onSuccess: onClose,
  });

  /**
   * Returns a change handler that stores a field's value.
   *
   * @param {string} k Field name.
   * @returns {(e: Event) => void}
   */
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const size = Number(f.sizeUnits);
  const valid = f.title.trim() && Number.isFinite(size) && size >= 0;
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Edit item details"
      description={`Barcode ${item.barcode} stays the same. Use Move to change the location.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            loading={save.isPending}
            onClick={() =>
              save.mutate({
                title: f.title.trim(),
                itemType: f.itemType,
                recordId: record?.id ?? null,
                materialType: f.materialType.trim() || null,
                sizeUnits: size,
                isFragile: f.isFragile,
                handlingNotes: f.handlingNotes.trim() || null,
                notes: f.notes.trim() || null,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title / label" required className="sm:col-span-2">
          <Input value={f.title} maxLength={1000} onChange={set('title')} />
        </Field>
        <Field label="Type">
          <Select value={f.itemType} onChange={set('itemType')}>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Size (capacity units)" help="How much of a location's capacity it takes">
          <Input value={f.sizeUnits} inputMode="decimal" onChange={set('sizeUnits')} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1 text-[13px] font-semibold">Description</p>
          {record ? (
            <p className="mb-2 text-sm">
              {record.label}{' '}
              <button type="button" className="text-brand-700 hover:underline" onClick={() => setRecord(null)}>
                Remove link
              </button>
            </p>
          ) : (
            <p className="mb-2 text-sm text-ink-soft">Not linked to a description.</p>
          )}
          <RecordPicker
            placeholder="Link a description by reference or title…"
            onPick={(r) => setRecord({ id: r.id, label: `${r.sub} — ${r.label}` })}
          />
        </div>
        <Field label="Material type">
          <Input value={f.materialType} maxLength={80} onChange={set('materialType')} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox
            label="Fragile"
            checked={f.isFragile}
            onChange={(e) => setF({ ...f, isFragile: e.target.checked })}
          />
        </div>
        <Field label="Handling notes" className="sm:col-span-2">
          <Textarea rows={2} value={f.handlingNotes} maxLength={2000} onChange={set('handlingNotes')} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={f.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Dialog>
  );
}
