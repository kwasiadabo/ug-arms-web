/**
 * Form dialog for adding or editing one transfer inventory line, with every field visible at once.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Field, Input, Textarea } from '../../components/ui/index.js';
import { nextIdentifier } from './inventoryIdentifier.js';
import { validateLine } from './inventoryLine.js';

const FORM_ID = 'inventory-line-form';

/**
 * Shows the fields of one inventory line in a form. A new line starts with the next identifier in the unit's
 * sequence. The line is checked before it is accepted, and "Add and add another" keeps the form open with a fresh
 * line for entering several in a row. The line joins the inventory, which is then saved with "Save inventory".
 *
 * @param {object} props
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @param {Record<string, string>} props.line Starting values: a blank line, or the line being edited.
 * @param {number|null} props.lineNumber Number of the line being edited, or null for a new line.
 * @param {string[]} props.otherIdentifiers Identifiers of the other lines, to prevent duplicates.
 * @param {string} props.prefix Identifier prefix for new lines, such as "HIST".
 * @param {(line: Record<string, string>) => void} props.onSubmit Receives the accepted line.
 * @returns {JSX.Element}
 */
export function InventoryLineDialog({ open, onClose, line, lineNumber, otherIdentifiers, prefix, onSubmit }) {
  const [values, setValues] = useState(line);
  const [errors, setErrors] = useState({});
  const [added, setAdded] = useState(0);
  const another = useRef(false);
  const titleRef = useRef(null);
  const isNew = lineNumber === null;

  useEffect(() => {
    if (open) {
      setValues(line);
      setErrors({});
      setAdded(0);
    }
  }, [open, line]);

  /**
   * Returns a change handler that stores a field's value and clears its error.
   *
   * @param {string} k Field name.
   * @returns {(e: Event) => void}
   */
  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((current) => {
      const rest = { ...current };
      delete rest[k];
      return rest;
    });
  };

  /**
   * Checks the line and passes it on; after "Add and add another" the form is reset with the next identifier.
   *
   * @param {Event} e Submit event.
   */
  const submit = (e) => {
    e.preventDefault();
    const found = validateLine(values, otherIdentifiers);
    setErrors(found);
    if (Object.keys(found).length) return;
    const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v ?? '').trim()]));
    onSubmit(clean);
    if (isNew && another.current) {
      const ids = [...otherIdentifiers, clean.sourceIdentifier];
      setValues({
        ...Object.fromEntries(Object.keys(values).map((k) => [k, ''])),
        sourceIdentifier: nextIdentifier(prefix, ids),
      });
      setAdded((n) => n + 1);
      titleRef.current?.focus();
    } else {
      onClose();
    }
    another.current = false;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isNew ? 'Add an inventory line' : `Edit line ${lineNumber}`}
      description={
        added > 0
          ? `${added} line${added === 1 ? '' : 's'} added. Remember to save the inventory when you have finished.`
          : 'One line per file, volume or box. Only the title is required.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {added > 0 ? 'Done' : 'Cancel'}
          </Button>
          {isNew && (
            <Button
              variant="secondary"
              type="submit"
              form={FORM_ID}
              onClick={() => {
                another.current = true;
              }}
            >
              Add and add another
            </Button>
          )}
          <Button type="submit" form={FORM_ID}>
            {isNew ? 'Add line' : 'Update line'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Identifier"
          help="Suggested automatically; change it to the item's own reference if it has one."
          error={errors.sourceIdentifier}
        >
          <Input value={values.sourceIdentifier} onChange={set('sourceIdentifier')} maxLength={120} />
        </Field>
        <Field label="Format" help="For example paper file, bound volume, photographs" error={errors.format}>
          <Input value={values.format} onChange={set('format')} maxLength={80} />
        </Field>
        <Field label="Title / description" required className="sm:col-span-2" error={errors.title}>
          <Input ref={titleRef} value={values.title} onChange={set('title')} maxLength={1000} autoFocus />
        </Field>
        <Field label="Dates as written" className="sm:col-span-2" help="In any form, for example 1960–1965 or c. 1970s">
          <Input value={values.dateExpression} onChange={set('dateExpression')} maxLength={255} />
        </Field>
        <Field label="From" help="YYYY, YYYY-MM-DD or DD/MM/YYYY" error={errors.dateStart}>
          <Input value={values.dateStart} onChange={set('dateStart')} maxLength={20} placeholder="1960" />
        </Field>
        <Field label="To" help="Not before the From date" error={errors.dateEnd}>
          <Input value={values.dateEnd} onChange={set('dateEnd')} maxLength={20} placeholder="1965" />
        </Field>
        <Field label="Quantity" help="Left empty, it counts as 1" error={errors.quantity}>
          <Input value={values.quantity} onChange={set('quantity')} inputMode="numeric" />
        </Field>
        <Field label="Extent" help="How much material: 0.5 linear metres, 3 volumes, 120 sheets, 2 archive boxes">
          <Input value={values.extent} onChange={set('extent')} maxLength={255} placeholder="0.5 linear metres" />
        </Field>
        <Field label="Box" help="The number on the box you packed it in: 3, Box 3 of 12, B-07">
          <Input value={values.boxNumber} onChange={set('boxNumber')} maxLength={60} placeholder="3" />
        </Field>
        <Field label="Condition" help="For example good, fragile, water damage">
          <Input value={values.condition} onChange={set('condition')} maxLength={255} />
        </Field>
        <Field label="Confidentiality" className="sm:col-span-2" help="Anything sensitive or confidential in the item">
          <Input value={values.confidentiality} onChange={set('confidentiality')} maxLength={255} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={values.notes} onChange={set('notes')} maxLength={2000} />
        </Field>
      </form>
    </Dialog>
  );
}
