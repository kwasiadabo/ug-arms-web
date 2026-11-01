/**
 * Release version and development credit, shown in the public footer, the staff sidebar and the sign-in pages.
 *
 * @author Kwasi Adabo Boakye
 */

import { cn } from '../ui/index.js';

/** Release version. Keep in step with package.json (a unit test checks this). */
export const APP_VERSION = '1.0.0';
export const DEVELOPED_BY = 'Variable-x Solutions in collaboration with Globe Inform';

/**
 * Renders the version and credit line; stacked on two lines for narrow places, or in compact form (the collapsed
 * sidebar) only the version.
 *
 * @param {object} props
 * @param {boolean} [props.compact=false] Show only the version.
 * @param {boolean} [props.stacked=false] Put the version and the credit on separate lines.
 * @param {string} [props.className] Colour and spacing classes.
 * @returns {JSX.Element}
 */
export function Credits({ compact = false, stacked = false, className }) {
  if (compact)
    return (
      <p className={cn('text-[10px]', className)} title={`Version ${APP_VERSION}. Developed by ${DEVELOPED_BY}.`}>
        v{APP_VERSION}
      </p>
    );
  if (stacked)
    return (
      <div className={cn('text-[11px] leading-snug', className)}>
        <p className="font-semibold">Version {APP_VERSION}</p>
        <p>Developed by {DEVELOPED_BY}</p>
      </div>
    );
  return (
    <p className={cn('text-xs leading-relaxed', className)}>
      Version {APP_VERSION} · Developed by {DEVELOPED_BY}
    </p>
  );
}
