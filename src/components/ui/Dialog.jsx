/**
 * Modal dialogs built on the native `<dialog>` element, which provides focus trapping and Escape handling.
 *
 * @author Kwasi Adabo Boakye
 */

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button.jsx';
import { Field, Input, Textarea } from './Field.jsx';
import { cn } from './cn.js';

/**
 * Renders a modal dialog with a title, optional description, scrollable body and footer. The dialog is labelled by
 * its own title for screen readers, and pressing Escape calls `onClose`.
 *
 * @param {object} props
 * @param {boolean} props.open Whether the dialog is shown.
 * @param {() => void} props.onClose Called to close it.
 * @param {import('react').ReactNode} props.title Title.
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md'] Width.
 * @returns {JSX.Element|null}
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      aria-labelledby={titleId}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-2xl border border-line p-0 text-ink shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[1px]',
        widths[size],
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="text-base font-bold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}

/**
 * Asks the user to confirm an action. It can require a reason, and for destructive actions such as disposal it can
 * require typing an exact phrase before the confirm button is enabled.
 *
 * @param {object} props
 * @param {(input: { reason?: string }) => void} props.onConfirm Called with the reason when confirmed.
 * @param {boolean|'optional'} [props.requireReason] Whether a reason is required (at least three characters) or
 *   optional.
 * @param {string} [props.confirmText] Phrase the user must type.
 * @param {string} [props.tone='primary'] Button variant, for example "danger".
 * @returns {JSX.Element|null}
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  requireReason,
  reasonLabel = 'Reason',
  confirmText,
  loading,
  children,
}) {
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) {
      setReason('');
      setTyped('');
    }
  }, [open]);
  const blocked = (requireReason === true && reason.trim().length < 3) || (confirmText && typed !== confirmText);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone}
            loading={loading}
            disabled={blocked}
            onClick={() => onConfirm({ reason: reason.trim() || undefined })}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {children}
        {requireReason && (
          <Field label={reasonLabel} required={requireReason !== 'optional'}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        {confirmText && (
          <Field
            label={
              <>
                Type <span className="font-mono">{confirmText}</span> to confirm
              </>
            }
            required
          >
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
        )}
      </div>
    </Dialog>
  );
}
