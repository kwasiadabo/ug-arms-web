/**
 * Accessible tabs following the WAI-ARIA tabs pattern.
 *
 * @author Kwasi Adabo Boakye
 */

import { useRef } from 'react';
import { cn } from './cn.js';

/**
 * Renders a controlled tab list. Left and right arrow keys move between visible tabs, and only the selected tab is
 * in the keyboard tab order. Tabs may be hidden and may show a count.
 *
 * @param {object} props
 * @param {Array<{ value: string, label: string, count?: number, hidden?: boolean }>} props.tabs The tabs.
 * @param {string} props.value Selected tab.
 * @param {(value: string) => void} props.onChange Called with the new tab.
 * @returns {JSX.Element|null}
 */
export function Tabs({ tabs, value, onChange, className }) {
  const refs = useRef([]);

  /**
   * Moves the selection to the previous or next visible tab when an arrow key is pressed, wrapping around at the
   * ends.
   *
   * @param {KeyboardEvent} e The key event.
   * @param {number} i Index of the focused tab.
   */
  const onKey = (e, i) => {
    const visible = tabs.filter((t) => !t.hidden);
    const idx = visible.findIndex((t) => t.value === tabs[i].value);
    let next = null;
    if (e.key === 'ArrowRight') next = visible[(idx + 1) % visible.length];
    if (e.key === 'ArrowLeft') next = visible[(idx - 1 + visible.length) % visible.length];
    if (next) {
      e.preventDefault();
      onChange(next.value);
      refs.current[tabs.indexOf(next)]?.focus();
    }
  };
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map(
        (t, i) =>
          !t.hidden && (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              aria-selected={value === t.value}
              tabIndex={value === t.value ? 0 : -1}
              onClick={() => onChange(t.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                value === t.value
                  ? 'border-brand-700 text-brand-800'
                  : 'border-transparent text-ink-soft hover:text-ink',
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-ink-soft">
                  {t.count}
                </span>
              )}
            </button>
          ),
      )}
    </div>
  );
}
