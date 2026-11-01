/**
 * Workflow history timeline.
 *
 * @author Kwasi Adabo Boakye
 */

import { fmtDateTime, humanize } from '../../utils/format.js';
import { StatusBadge } from '../ui/index.js';

/**
 * Shows workflow steps and comments in order: what was done, the resulting status, who did it, when, and why.
 *
 * @param {object} props
 * @param {object[]} [props.items=[]] History entries.
 * @param {string} [props.empty] Text shown when there is no history.
 * @returns {JSX.Element|null}
 */
export function Timeline({ items = [], empty = 'No history yet.' }) {
  if (!items.length) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((h) => (
        <li key={h.id} className="relative">
          <span
            className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-200"
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{humanize(h.action)}</span>
            {h.toState && <StatusBadge status={h.toState} />}
          </div>
          <p className="text-xs text-ink-soft">
            {h.actor?.fullName || h.author?.fullName || 'System'} · {fmtDateTime(h.createdAt)}
          </p>
          {(h.reason || h.body) && <p className="mt-1 whitespace-pre-line text-sm">{h.reason || h.body}</p>}
        </li>
      ))}
    </ol>
  );
}
