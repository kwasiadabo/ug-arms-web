/**
 * Figure tile used on the dashboard.
 *
 * @author Kwasi Adabo Boakye
 */

import { Link } from 'react-router-dom';
import { cn } from '../ui/index.js';
import { fmtNumber } from '../../utils/format.js';

/**
 * Shows a labelled figure with an optional icon and hint; numbers are formatted for the locale, and the tile links
 * to the related list when `to` is given.
 *
 * @param {object} props
 * @param {string} props.label Label.
 * @param {number|string} props.value Figure.
 * @param {string} [props.to] Link target.
 * @param {'brand'|'gold'|'red'|'blue'} [props.tone='brand'] Icon colour.
 * @returns {JSX.Element|null}
 */
export function StatCard({ label, value, icon: Icon, to, hint, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    gold: 'bg-gold-50 text-gold-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-sky-50 text-sky-700',
  };
  const body = (
    <div className="card flex h-full items-start justify-between gap-3 p-4 transition-shadow hover:shadow-md">
      <div>
        <p className="text-[12.5px] font-semibold text-ink-soft">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums">
          {typeof value === 'number' ? fmtNumber(value) : (value ?? '—')}
        </p>
        {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
      </div>
      {Icon && (
        <span className={cn('rounded-lg p-2', tones[tone])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      )}
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  );
}
