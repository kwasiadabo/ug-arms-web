/**
 * Card containers and the metadata definition list used on detail pages.
 *
 * @author Kwasi Adabo Boakye
 */

import { cn } from './cn.js';

/**
 * Renders a card container.
 *
 * @param {object} props
 * @param {string} [props.className] Extra classes.
 * @param {string} [props.as='section'] Element to render.
 * @returns {JSX.Element|null}
 */
export function Card({ className, children, as: As = 'section', ...props }) {
  return (
    <As className={cn('card', className)} {...props}>
      {children}
    </As>
  );
}

/**
 * Renders a card's heading with an optional description and actions.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title Heading.
 * @param {import('react').ReactNode} [props.description] Supporting text.
 * @param {import('react').ReactNode} [props.actions] Buttons on the right.
 * @returns {JSX.Element|null}
 */
export function CardHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Renders the padded body of a card.
 *
 * @param {object} props
 * @param {string} [props.className] Extra classes.
 * @returns {JSX.Element|null}
 */
export function CardBody({ className, children }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

/**
 * Tells whether a metadata entry has something worth showing (not empty, not a dash and not an empty list).
 *
 * @param {{ value: * }|null} i The entry.
 * @returns {boolean}
 */
const hasValue = (i) =>
  Boolean(i) &&
  i.value !== undefined &&
  i.value !== null &&
  i.value !== '' &&
  i.value !== '—' &&
  !(Array.isArray(i.value) && !i.value.length);

/**
 * Tells whether any entry in a metadata list has a value, so empty sections can be hidden.
 *
 * @param {Array<{ value: * }>} items The entries.
 * @returns {boolean}
 */
export const hasMeta = (items) => items.some(hasValue);

/**
 * Renders label and value pairs as an accessible definition list, leaving out empty values; lists are joined with
 * commas.
 *
 * @param {object} props
 * @param {Array<{ label: string, value: *, wide?: boolean }>} props.items The entries.
 * @param {number} [props.columns=2] Number of columns on wider screens.
 * @returns {JSX.Element|null}
 */
export function MetaList({ items, columns = 2 }) {
  const shown = items.filter(hasValue);
  if (!shown.length) return null;
  return (
    <dl
      className={cn('grid gap-x-8 gap-y-4', columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-3' : '')}
    >
      {shown.map((i) => (
        <div key={i.label} className={cn(i.wide && 'sm:col-span-full')}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{i.label}</dt>
          <dd className="mt-1 text-sm whitespace-pre-line">{Array.isArray(i.value) ? i.value.join(', ') : i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
