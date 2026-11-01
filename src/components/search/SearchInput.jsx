/**
 * Search and filter inputs for list pages.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce.js';
import { cn } from '../ui/index.js';

/**
 * Search box that reports changes after the user pauses typing, and can be cleared.
 *
 * @param {object} props
 * @param {string} [props.value] Current search text.
 * @param {(value: string) => void} props.onChange Called with the new text.
 * @returns {JSX.Element|null}
 */
export function SearchInput({ value = '', onChange, placeholder = 'Search…', className, label = 'Search' }) {
  const [v, setV] = useState(value);
  const d = useDebounce(v, 350);
  useEffect(() => {
    setV(value);
  }, [value]);
  useEffect(() => {
    if (d !== value) onChange(d);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
        aria-hidden
      />
      <input
        type="search"
        aria-label={label}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-8 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25"
      />
      {v && (
        <button
          type="button"
          onClick={() => setV('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:bg-canvas"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Labelled drop-down filter with an "All" option.
 *
 * @param {object} props
 * @param {string} props.label Label.
 * @param {Array<{ value: string, label: string }>} props.options Choices.
 * @param {(value: string) => void} props.onChange Called with the selected value.
 * @returns {JSX.Element|null}
 */
export function FilterSelect({ label, value, onChange, options, className }) {
  return (
    <select
      aria-label={label}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-9 rounded-lg border border-line bg-white px-2.5 text-sm', className)}
    >
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o.value ?? o} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  );
}
