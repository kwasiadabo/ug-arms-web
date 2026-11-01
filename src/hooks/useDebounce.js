/**
 * Debounce hook used by search boxes, so the API is not called on every keystroke.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';

/**
 * Returns a value that only updates after it has stopped changing for the given delay.
 *
 * @param {*} value The changing value.
 * @param {number} [delay=300] Delay in milliseconds.
 * @returns {*}
 */
export function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
