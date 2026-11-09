/**
 * Table that never scrolls sideways: when its columns do not fit, rows are stacked as "Column: value" pairs.
 *
 * @author Kwasi Adabo Boakye
 */

import { useStackedTable } from '../../hooks/useStackedTable.js';
import { cn } from '../ui/index.js';

/**
 * Renders a table inside a measuring container (see `useStackedTable`). Put a `data-label` on each body cell that
 * should show its column name when the rows are stacked.
 *
 * @param {object} props
 * @param {*} [props.watch] Value whose change should trigger a new measurement, such as the number of rows.
 * @param {string} [props.className] Classes for the table.
 * @param {import('react').ReactNode} props.children The table's head and body.
 * @returns {JSX.Element}
 */
export function FitTable({ watch, className, children }) {
  const fit = useStackedTable(watch);
  return (
    <div ref={fit.containerRef} className="overflow-x-auto">
      <table ref={fit.tableRef} className={cn('w-full text-sm', className, fit.className)}>
        {children}
      </table>
    </div>
  );
}
