/**
 * Type-ahead pickers for linking authority records, vocabulary terms, descriptions and staff members.
 *
 * @author Kwasi Adabo Boakye
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { humanize } from '../../utils/format.js';

/**
 * Generic type-ahead: searches as the user types (after a short pause) and lists matching items to pick from.
 *
 * @param {object} props
 * @param {(q: string) => Promise<Array<{ id: string, label: string, sub?: string }>>} props.fetcher Returns the
 *   matches for the typed text.
 * @param {(item: object) => void} props.onPick Called with the chosen item.
 * @param {string} props.queryKey Cache key prefix.
 * @param {number} [props.minChars=1] Characters required before searching.
 * @returns {JSX.Element}
 */
export function TypeAhead({ placeholder, fetcher, onPick, queryKey, minChars = 1, label }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const d = useDebounce(q, 250);
  const { data = [] } = useQuery({
    queryKey: [queryKey, d],
    queryFn: () => fetcher(d),
    enabled: open && d.length >= minChars,
  });
  return (
    <div className="relative max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
        aria-hidden
      />
      <input
        type="search"
        aria-label={label || placeholder}
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25"
      />
      {open && data.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-white shadow-lg"
        >
          {data.map((o) => (
            <li key={o.id} role="option" aria-selected="false">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(o);
                  setQ('');
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
              >
                <span className="truncate">{o.label}</span>
                {o.sub && <span className="shrink-0 text-xs text-ink-soft">{o.sub}</span>}
                <Plus className="h-3.5 w-3.5 shrink-0 text-brand-700" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Picks an authority record (optionally of one entity type) to link as a creator.
 *
 * @param {object} props
 * @param {(item: { id: string, label: string, sub?: string, raw?: object }) => void} props.onPick Called with the
 *   chosen item.
 * @returns {JSX.Element}
 */
export const AuthorityPicker = ({ onPick, entityType }) => (
  <TypeAhead
    queryKey="authority-pick"
    placeholder="Add a creator from authority records…"
    onPick={onPick}
    fetcher={(q) =>
      api
        .get('/authority-records', { params: { q, entityType, pageSize: 10 } })
        .then((r) => r.data.data.map((a) => ({ id: a.id, label: a.authorizedName, sub: humanize(a.entityType) })))
    }
  />
);

/**
 * Picks a term from a controlled vocabulary; matching starts as soon as the box is focused.
 *
 * @param {object} props
 * @param {(item: { id: string, label: string, sub?: string, raw?: object }) => void} props.onPick Called with the
 *   chosen item.
 * @returns {JSX.Element}
 */
export const TermPicker = ({ vocabulary, onPick }) => (
  <TypeAhead
    queryKey={`term-pick-${vocabulary}`}
    minChars={0}
    placeholder="Add a subject term…"
    onPick={onPick}
    fetcher={(q) =>
      api
        .get(`/vocabularies/${vocabulary}/terms`, { params: { q } })
        .then((r) => r.data.data.map((t) => ({ id: t.id, label: t.label })))
    }
  />
);

/**
 * Picks an archival description by reference code or title.
 *
 * @param {object} props
 * @param {(item: { id: string, label: string, sub?: string, raw?: object }) => void} props.onPick Called with the
 *   chosen item.
 * @returns {JSX.Element}
 */
export const RecordPicker = ({ onPick, placeholder = 'Find a description by reference or title…' }) => (
  <TypeAhead
    queryKey="record-pick"
    placeholder={placeholder}
    onPick={onPick}
    fetcher={(q) =>
      api
        .get('/records', { params: { q, pageSize: 10 } })
        .then((r) => r.data.data.map((x) => ({ id: x.id, label: x.title, sub: x.referenceCode, raw: x })))
    }
  />
);

/**
 * Picks an active staff member, optionally only those holding a given permission.
 *
 * @param {object} props
 * @param {(item: { id: string, label: string, sub?: string, raw?: object }) => void} props.onPick Called with the
 *   chosen item.
 * @returns {JSX.Element}
 */
export const UserPicker = ({ onPick, placeholder = 'Find a staff member…', permission }) => (
  <TypeAhead
    queryKey={`user-pick-${permission || ''}`}
    placeholder={placeholder}
    onPick={onPick}
    fetcher={(q) =>
      api
        .get('/users/directory', { params: { q, permission } })
        .then((r) => r.data.data.map((u) => ({ id: u.id, label: u.fullName, sub: u.email })))
    }
  />
);
