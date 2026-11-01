/**
 * Small coloured labels for workflow statuses and access levels. Colours follow a fixed mapping, so the same status
 * always looks the same everywhere.
 *
 * @author Kwasi Adabo Boakye
 */

import { cn } from './cn.js';
import { humanize } from '../../utils/format.js';

const tones = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  gold: 'bg-gold-50 text-gold-700 ring-gold-100',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
};

const STATUS_TONE = {
  draft: 'neutral',
  in_review: 'amber',
  approved: 'blue',
  published: 'green',
  withdrawn: 'red',
  superseded: 'neutral',
  submitted: 'amber',
  under_review: 'amber',
  queried: 'violet',
  query_raised: 'violet',
  resubmitted: 'amber',
  accepted: 'green',
  partially_accepted: 'blue',
  rejected: 'red',
  cancelled: 'neutral',
  closed: 'neutral',
  planned: 'neutral',
  in_progress: 'blue',
  processing: 'blue',
  quality_review: 'amber',
  rework_required: 'violet',
  completed: 'green',
  failed: 'red',
  queued: 'neutral',
  running: 'blue',
  succeeded: 'green',
  passed: 'green',
  investigating: 'amber',
  recovered: 'blue',
  resolved: 'green',
  open: 'amber',
  awaiting_researcher: 'violet',
  awaiting_approval: 'amber',
  scheduled: 'blue',
  fulfilled: 'green',
  issued: 'blue',
  returned: 'green',
  overdue: 'red',
  lost: 'red',
  damaged: 'red',
  available: 'green',
  reserved: 'blue',
  in_transit: 'blue',
  in_conservation: 'amber',
  missing: 'red',
  disposed: 'neutral',
  active: 'green',
  pending: 'amber',
  suspended: 'amber',
  deactivated: 'neutral',
  pending_approval: 'amber',
  blocked: 'red',
  executed: 'neutral',
  on_hold: 'violet',
  recommended: 'blue',
  booked: 'blue',
  checked_in: 'green',
  no_show: 'red',
  valid: 'green',
  invalid: 'red',
  imported: 'green',
  skipped: 'neutral',
  uploaded: 'neutral',
  validating: 'blue',
  ready: 'blue',
  completed_with_errors: 'amber',
  clean: 'green',
  infected: 'red',
  ok: 'green',
  fixity_failed: 'red',
  at_risk: 'amber',
  quarantined: 'red',
  eligible: 'green',
  open_access: 'green',
  staff_only: 'neutral',
  restricted: 'amber',
  embargoed: 'violet',
  confidential: 'red',
  proposed: 'neutral',
  success: 'green',
  failure: 'red',
  denied: 'red',
  warning: 'amber',
};

/**
 * Renders a coloured label.
 *
 * @param {object} props
 * @param {string} [props.tone='neutral'] Colour name.
 * @param {import('react').ReactNode} props.children Text.
 * @returns {JSX.Element|null}
 */
export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Renders a workflow status as a readable, coloured label.
 *
 * @param {object} props
 * @param {string} props.status Status code, for example "in_review".
 * @returns {JSX.Element|null}
 */
export function StatusBadge({ status, className }) {
  if (!status) return null;
  return (
    <Badge tone={STATUS_TONE[status] || 'neutral'} className={className}>
      {humanize(status)}
    </Badge>
  );
}

const ACCESS_TONE = {
  open: 'green',
  staff_only: 'neutral',
  restricted: 'amber',
  embargoed: 'violet',
  confidential: 'red',
  closed: 'red',
};

/**
 * Renders an access level as a coloured label; "open" is shown as "Open access".
 *
 * @param {object} props
 * @param {string} props.level Access level.
 * @returns {JSX.Element|null}
 */
export function AccessBadge({ level }) {
  if (!level) return null;
  return <Badge tone={ACCESS_TONE[level]}>{level === 'open' ? 'Open access' : humanize(level)}</Badge>;
}
