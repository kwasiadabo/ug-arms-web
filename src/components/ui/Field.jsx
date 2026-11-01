/**
 * Form controls and the field wrapper that connects labels, help text and errors for screen readers.
 *
 * @author Kwasi Adabo Boakye
 */

import { forwardRef, useId, cloneElement, isValidElement } from 'react';
import { cn } from './cn.js';

const base =
  'w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600/25 focus:border-brand-600 disabled:bg-canvas disabled:text-ink-soft';

/**
 * Text input styled for the theme; `invalid` shows the error state and sets aria-invalid.
 *
 * @param {object} props Native input attributes plus `invalid`.
 * @param {import('react').Ref} ref Forwarded to the input.
 * @returns {JSX.Element}
 */
export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(base, 'h-10', invalid ? 'border-red-500' : 'border-line', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

/**
 * Multi-line text input styled for the theme; `invalid` shows the error state.
 *
 * @param {object} props Native textarea attributes plus `invalid`.
 * @param {import('react').Ref} ref Forwarded to the textarea.
 * @returns {JSX.Element}
 */
export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(base, 'py-2 leading-relaxed', invalid ? 'border-red-500' : 'border-line', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

/**
 * Drop-down list styled for the theme, with an optional empty first option.
 *
 * @param {object} props Native select attributes plus `invalid` and `placeholder`.
 * @param {import('react').Ref} ref Forwarded to the select.
 * @returns {JSX.Element}
 */
export const Select = forwardRef(function Select({ className, invalid, children, placeholder, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(base, 'h-10 pr-8', invalid ? 'border-red-500' : 'border-line', className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
});

/**
 * Checkbox with a clickable label and optional description.
 *
 * @param {object} props
 * @param {string} props.label Label.
 * @param {string} [props.description] Explanation under the label.
 * @returns {JSX.Element|null}
 */
export function Checkbox({ label, description, className, ...props }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 accent-brand-700"
        {...props}
      />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        {description && <span className="block text-ink-soft">{description}</span>}
      </label>
    </div>
  );
}

/**
 * Wraps a single form control with its label, required marker, help text and error message. The control receives
 * matching id, aria-describedby, aria-required and invalid properties, so screen readers announce everything
 * together.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.label Label.
 * @param {boolean} [props.required] Whether the field is required.
 * @param {string} [props.help] Help text.
 * @param {string} [props.error] Error message.
 * @param {import('react').ReactElement} props.children The control.
 * @returns {JSX.Element|null}
 */
export function Field({ label, required, help, error, children, className, hint }) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        invalid: Boolean(error),
        'aria-describedby': [helpId, errId].filter(Boolean).join(' ') || undefined,
        'aria-required': required || undefined,
      })
    : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={id} className="text-[13px] font-semibold text-ink">
            {label}
            {required && (
              <span className="ml-0.5 text-red-600" aria-hidden>
                *
              </span>
            )}
          </label>
          {hint && <span className="text-xs font-normal text-ink-soft">{hint}</span>}
        </div>
      )}
      {control}
      {help && !error && (
        <p id={helpId} className="text-xs text-ink-soft">
          {help}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
