/**
 * Hook that switches a table to the stacked layout (one block of "Column: value" pairs per row) when its columns do
 * not fit, so tables never scroll sideways.
 *
 * @author Kwasi Adabo Boakye
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures a table against its container. While the table is laid out as columns, it stacks as soon as it is wider
 * than the container; once stacked, it returns to columns when the container is wide enough for the width the
 * columns needed. Measuring happens before the browser paints, so the wide layout never flashes.
 *
 * Give `containerRef` to the element around the table and `tableRef` to the table, add the returned `className` to
 * the table, and put a `data-label` on every cell that should show its column name when stacked.
 *
 * @param {*} [watch] Value whose change should trigger a new measurement, such as the rows or visible columns.
 * @returns {{ containerRef: import('react').RefObject, tableRef: import('react').RefObject, stacked: boolean,
 *   className: string }}
 */
export function useStackedTable(watch) {
  const containerRef = useRef(null);
  const tableRef = useRef(null);
  const needed = useRef(0);
  const [stacked, setStacked] = useState(false);

  const measure = useCallback(() => {
    const box = containerRef.current;
    const table = tableRef.current;
    if (!box || !table) return;
    const available = box.clientWidth;
    setStacked((isStacked) => {
      if (!isStacked) {
        if (table.scrollWidth > available + 1) {
          needed.current = table.scrollWidth;
          return true;
        }
        return false;
      }
      return available < needed.current;
    });
  }, []);

  // Re-measure after every change to what the table shows, before paint.
  useLayoutEffect(() => {
    measure();
  }, [measure, watch, stacked]);

  useLayoutEffect(() => {
    const box = containerRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(box);
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, tableRef, stacked, className: stacked ? 'table-stacked' : '' };
}
