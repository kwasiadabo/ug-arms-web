/**
 * Loading, empty, error and notice states, so every page communicates what is happening in the same way.
 *
 * @author Kwasi Adabo Boakye
 */

import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from './cn.js';
import { errorMessage } from '../../lib/api.js';

/**
 * Renders a pulsing placeholder shape while content loads.
 *
 * @param {object} props
 * @param {string} [props.className] Size and shape classes.
 * @returns {JSX.Element|null}
 */
export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-100', className)} aria-hidden />;
}

/**
 * Renders a placeholder for a whole page while it loads, announced to screen readers.
 *
 * @param {object} props
 * @param {string} [props.label='Loading'] Accessible label.
 * @returns {JSX.Element|null}
 */
export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="space-y-4 p-1" role="status" aria-label={label}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/**
 * Explains that there is nothing to show yet, with an optional action.
 *
 * @param {object} props
 * @param {import('react').ComponentType} [props.icon] Icon.
 * @param {string} props.title Heading.
 * @param {string} [props.description] Explanation.
 * @param {import('react').ReactNode} [props.action] Button.
 * @returns {JSX.Element|null}
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-700">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-[15px] font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Explains why something could not be loaded, with specific wording for "not found" and "access not permitted", and
 * a retry button for other errors.
 *
 * @param {object} props
 * @param {*} props.error The request error.
 * @param {() => void} [props.onRetry] Retry handler.
 * @param {string} [props.title] Heading for other errors.
 * @returns {JSX.Element|null}
 */
export function ErrorState({ error, onRetry, title = 'This could not be loaded', className }) {
  const status = error?.response?.status;
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-700">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-[15px] font-bold">
        {status === 404 ? 'Not found' : status === 403 ? 'Access not permitted' : title}
      </h3>
      <p className="mt-1 max-w-md text-sm text-ink-soft">
        {status === 403 ? 'Your account does not have permission to view this.' : errorMessage(error)}
      </p>
      {onRetry && status !== 403 && status !== 404 && (
        <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Renders an inline notice. Danger notices are announced immediately to screen readers; others politely.
 *
 * @param {object} props
 * @param {'info'|'warning'|'danger'|'success'|'brand'} [props.tone='info'] Tone.
 * @param {string} [props.title] Heading.
 * @param {import('react').ComponentType} [props.icon] Icon.
 * @returns {JSX.Element|null}
 */
export function Alert({ tone = 'info', title, children, className, icon: Icon }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    brand: 'border-brand-200 bg-brand-50 text-brand-900',
  };
  return (
    <div
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', tones[tone], className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && 'mt-0.5')}>{children}</div>
      </div>
    </div>
  );
}
