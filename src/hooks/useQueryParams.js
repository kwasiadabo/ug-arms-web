/**
 * Hook that keeps table and filter state in the URL, so views can be shared, bookmarked and survive a page refresh.
 *
 * @author Kwasi Adabo Boakye
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Reads the current query-string parameters merged over the defaults, and returns a setter that updates them. The
 * page and page size are numbers. Empty values are removed, and changing any filter returns to the first page
 * unless told otherwise.
 *
 * @param {object} [defaults={}] Default values, such as `{ pageSize: 25 }`.
 * @returns {[object, (patch: object, options?: { resetPage?: boolean }) => void]}
 */
export function useQueryParams(defaults = {}) {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => {
    const out = { ...defaults };
    for (const [k, v] of params.entries()) out[k] = v;
    out.page = Number(out.page || 1);
    out.pageSize = Number(out.pageSize || defaults.pageSize || 25);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const set = useCallback(
    (patch, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === null || v === '') next.delete(k);
            else next.set(k, String(v));
          }
          if (resetPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [values, set];
}

/**
 * Returns a copy of an object without empty strings, null or undefined values, ready to use as API parameters.
 *
 * @param {object} o The parameters.
 * @returns {object}
 */
export const clean = (o) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null));
