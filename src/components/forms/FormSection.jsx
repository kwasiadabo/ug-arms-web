/**
 * Layout components for long forms.
 *
 * @author Kwasi Adabo Boakye
 */

import { cn } from '../ui/index.js';

/**
 * Groups related fields in a titled card with a two-column grid; the heading labels the section for screen readers.
 *
 * @param {object} props
 * @param {string} props.title Heading.
 * @param {string} [props.description] Explanation.
 * @param {string} [props.id] Anchor for in-page navigation.
 * @returns {JSX.Element|null}
 */
export function FormSection({ title, description, children, className, id }) {
  return (
    <section id={id} className={cn('card scroll-mt-24', className)} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="border-b border-line px-5 py-3.5">
        <h2 id={id ? `${id}-h` : undefined} className="text-[15px] font-bold">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * Keeps the form's save and cancel buttons visible at the bottom of the screen while scrolling.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children The buttons.
 * @returns {JSX.Element|null}
 */
export function FormActions({ children, className }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
