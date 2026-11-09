/**
 * Read-only dialog showing every field of one transfer inventory line at once, for reviewing a submitted transfer.
 *
 * @author Kwasi Adabo Boakye
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Dialog, MetaList, StatusBadge } from '../../components/ui/index.js';

/**
 * Returns the value for display, or a muted "Not given" so reviewers can see what the department left out.
 *
 * @param {*} v The field's value.
 * @returns {import('react').ReactNode}
 */
const shown = (v) =>
  v === null || v === undefined || v === '' ? <span className="italic text-ink-soft">Not given</span> : v;

/**
 * Shows one inventory line with all its fields and, once decided, its decision and note. Previous and Next step
 * through the inventory without closing the dialog.
 *
 * @param {object} props
 * @param {object[]} props.items The transfer's inventory lines, in order.
 * @param {number|null} props.index Index of the line shown, or null when closed.
 * @param {(index: number|null) => void} props.onChange Called with the line to show, or null to close.
 * @returns {JSX.Element|null}
 */
export function InventoryLineView({ items, index, onChange }) {
  const item = index === null ? null : items[index];
  if (!item) return null;
  const decided = item.decision && item.decision !== 'pending';
  return (
    <Dialog
      open
      onClose={() => onChange(null)}
      size="lg"
      title={`Line ${index + 1} of ${items.length}`}
      description={item.title}
      footer={
        <>
          <Button variant="secondary" icon={ChevronLeft} disabled={index === 0} onClick={() => onChange(index - 1)}>
            Previous
          </Button>
          <Button variant="secondary" disabled={index === items.length - 1} onClick={() => onChange(index + 1)}>
            Next <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
          <Button onClick={() => onChange(null)}>Close</Button>
        </>
      }
    >
      <div className="space-y-5">
        {decided && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas p-3 text-sm">
            <span className="font-semibold">Decision:</span>
            <StatusBadge status={item.decision} />
            {item.decisionNote && <span>{item.decisionNote}</span>}
          </div>
        )}
        <MetaList
          items={[
            { label: 'Identifier', value: shown(item.sourceIdentifier) },
            { label: 'Format', value: shown(item.format) },
            { label: 'Title / description', value: shown(item.title), wide: true },
            { label: 'Dates as written', value: shown(item.dateExpression), wide: true },
            // Stored as YYYY-MM-DD; a year alone was saved as 1 January, so it is not formatted as a full date.
            { label: 'From', value: shown(item.dateStart) },
            { label: 'To', value: shown(item.dateEnd) },
            { label: 'Quantity', value: shown(item.quantity) },
            { label: 'Extent', value: shown(item.extent) },
            { label: 'Box', value: shown(item.boxNumber) },
            { label: 'Condition', value: shown(item.condition) },
            { label: 'Confidentiality', value: shown(item.confidentiality), wide: true },
            { label: 'Notes', value: shown(item.notes), wide: true },
          ]}
        />
      </div>
    </Dialog>
  );
}
